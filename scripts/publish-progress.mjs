#!/usr/bin/env node
/**
 * PROG-01: the client progress page, built from the record by the publishing
 * step (PUB-01).
 *
 * scripts/publish.mjs runs this on v4's build before it checks the build, in
 * a dry run and in a publish: it reads the record as the checkout holds it
 * (project/backlog.md, project/trajectory.md, the item files' titles, and the
 * git history of the first two) and writes the page into <dist>/progress/:
 * its three static files from progress/, and progress.json, the data the page
 * draws. The step then copies the build into docs/ as it always has, so the
 * page is as current as the last publish. v4's own build never reads the
 * record (the gate's guard); the step already does (V40-01). Nothing here
 * reaches the network: the page loads only its own files, as the step's site
 * check requires.
 *
 * Plain names come from progress/names.json; an item or section it does not
 * name shows its own title from the record. Status is read from the backlog's
 * marks ([ ] to do, [~] in progress, [!] needs the owner); an open item with a
 * branch of its own on origin (core-06/...) is in progress too. A record this
 * cannot read gives a page that says so, never a failed publish.
 *
 *   node scripts/publish-progress.mjs [--out <dir>]     (default dist/progress)
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The page's own files, copied as they are beside progress.json. */
export const PAGE_FILES = ['index.html', 'progress.css', 'progress.js'];

const ID = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*(?:\\.\\d+)?';
const OPEN_LINE = new RegExp(`^- \\[([ ~!x])\\] (${ID}) — (.+?) — since (\\d{4}-\\d{2}-\\d{2})`);
const DONE_LINE = new RegExp(`^- (${ID}) — `);
const DATE_IN_BRACKETS = /\((\d{4}-\d{2}-\d{2})\)/g;
const STATUS = { ' ': 'To do', '~': 'In progress', '!': 'Needs sign-off', x: 'Done' };
/** Trajectory lines that are not items: the recall verb's scores at a phase close (verbs/recall.md). */
export const NOT_ITEMS = new Set(['RECALL']);

/** The phase number a heading starts with ("Phase 7 — …", "Phase 8, proposed — …"), or null. */
export function phaseNumber(heading) {
  const match = /^Phase (\d+)\b/.exec(heading.trim());
  return match ? Number(match[1]) : null;
}

/**
 * The backlog's open items, each with the part of the backlog it sits in.
 * @param {string} text project/backlog.md
 * @returns {{ id: string, title: string, status: string, since: string, part: 'current'|'next'|'icebox', group: string, phase: number|null }[]}
 */
export function parseBacklog(text) {
  const items = [];
  let part = null;
  let group = '';
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      const name = h2[1].trim().toLowerCase();
      part = name.startsWith('current') ? 'current' : name.startsWith('next') ? 'next' : name.startsWith('icebox') ? 'icebox' : null;
      group = '';
      continue;
    }
    const h3 = /^### (.+)$/.exec(line);
    if (h3) { group = h3[1].trim(); continue; }
    const bold = /^\*\*(.+)\*\*$/.exec(line);
    if (bold) { group = bold[1].trim(); continue; }
    const item = OPEN_LINE.exec(line);
    if (item && part) {
      items.push({
        id: item[2], title: item[3].trim(), status: STATUS[item[1]], since: item[4], part, group, phase: phaseNumber(group)
      });
    }
  }
  return items;
}

/**
 * The shipped record by section, newest section first as the file has it.
 * @param {string} text project/trajectory.md
 * @returns {{ heading: string, phase: number|null, items: { id: string, date: string|null }[] }[]}
 */
export function parseTrajectory(text) {
  const sections = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      current = { heading: h2[1].trim(), phase: phaseNumber(h2[1]), items: [] };
      sections.push(current);
      continue;
    }
    const item = DONE_LINE.exec(line);
    if (item && current && !NOT_ITEMS.has(item[1])) {
      const dates = [...line.matchAll(DATE_IN_BRACKETS)].map(match => match[1]);
      current.items.push({ id: item[1], date: dates.length ? dates[dates.length - 1] : null });
    }
  }
  return sections;
}

/** How many items a backlog holds open, and how many a trajectory lists shipped. */
export const countOpen = text => parseBacklog(text).length;
export const countShipped = text => parseTrajectory(text).reduce((sum, section) => sum + section.items.length, 0);

/** Each item file's title, from its first line: `# ID — title`. */
export function itemTitles(dir) {
  const titles = {};
  if (!existsSync(dir)) return titles;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md') || name.startsWith('_')) continue;
    const first = readFileSync(join(dir, name), 'utf8').split('\n', 1)[0];
    const match = new RegExp(`^# (${ID}) — (.+)$`).exec(first.trim());
    if (match) titles[match[1]] = match[2].trim();
  }
  return titles;
}

/** A section's plain name: the first key of `sections` its heading starts with, else its heading up to its first dash. */
export function sectionName(heading, sections = {}) {
  for (const [start, name] of Object.entries(sections)) if (heading.startsWith(start)) return name;
  return heading.split(' — ')[0].trim();
}

/** Item IDs that have a branch of their own on origin, named for them in lower case (core-06/drawing-routes → CORE-06). */
export function branchIds(refs) {
  const ids = new Set();
  for (const ref of refs) {
    const first = ref.split('/')[0];
    if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(first)) ids.add(first.toUpperCase());
  }
  return ids;
}

/**
 * The page's data, from the record's text. Pure: `history`, `branches` and
 * `asOf` are read by the caller.
 */
export function buildProgress({ backlog, trajectory, titles = {}, names = {}, branches = new Set(), history = [], asOf = null, commit = null }) {
  const first = names.firstV4Phase ?? 5;
  const plain = (id, fallback) => names.items?.[id] ?? fallback ?? titles[id] ?? id;
  const open = parseBacklog(backlog);
  const shipped = parseTrajectory(trajectory);

  const phases = new Map();
  const phase = (number, heading) => {
    if (!phases.has(number)) {
      phases.set(number, { number, name: names.phases?.[String(number)] ?? sectionName(heading.replace(/^Phase \d+,? (?:proposed )?— ?/, '')), items: [] });
    }
    return phases.get(number);
  };
  const seen = new Set();
  for (const section of [...shipped].reverse()) {
    if (section.phase === null || section.phase < first) continue;
    const into = phase(section.phase, section.heading);
    for (const item of section.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      into.items.push({ id: item.id, name: plain(item.id), status: 'Done', done: item.date, since: null });
    }
  }
  const later = [];
  const otherOpen = [];
  for (const item of open) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const status = item.status === 'To do' && branches.has(item.id) ? 'In progress' : item.status;
    const entry = { id: item.id, name: plain(item.id, titles[item.id] ?? item.title), status, done: null, since: item.since };
    if (item.part === 'icebox') later.push({ ...entry, group: 'Parked' });
    else if (item.phase !== null && item.phase >= first) phase(item.phase, item.group).items.push(entry);
    else if (item.part === 'next') later.push({ ...entry, group: 'After v4.0' });
    else otherOpen.push({ ...entry, group: sectionName(item.group, names.sections) });
  }

  const other = new Map();
  for (const section of shipped) {
    if (section.phase !== null && section.phase >= first) continue;
    if (!section.items.length) continue;
    const name = sectionName(section.heading, names.sections);
    const dates = section.items.map(item => item.date).filter(Boolean).sort();
    const row = other.get(name) ?? { name, items: 0, started: null, finished: null };
    row.items += section.items.length;
    if (dates.length) {
      if (!row.started || dates[0] < row.started) row.started = dates[0];
      if (!row.finished || dates[dates.length - 1] > row.finished) row.finished = dates[dates.length - 1];
    }
    other.set(name, row);
  }

  const v4 = [...phases.values()].sort((a, b) => a.number - b.number);
  const all = v4.flatMap(p => p.items);
  const count = status => all.filter(item => item.status === status).length;
  return {
    asOf,
    commit,
    summary: {
      v4Items: all.length,
      v4Done: count('Done'),
      v4InProgress: count('In progress'),
      v4SignOff: count('Needs sign-off'),
      v4ToDo: count('To do'),
      shipped: countShipped(trajectory),
      open: open.length
    },
    phases: v4,
    otherOpen,
    otherWork: [...other.values()].sort((a, b) => (b.finished ?? '').localeCompare(a.finished ?? '')),
    later,
    history
  };
}

const git = (args, cwd) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
};

/** The paths the page is built from: a commit touching none of them, such as a publish, changes nothing on the page. */
export const SOURCES = ['project/backlog.md', 'project/trajectory.md', 'project/items', 'progress'];

/**
 * Open and shipped counts by day, from main's own line of commits (the first
 * parent at each merge), so work shows on the day it reached main, not the day
 * it was written on its branch. Each commit on that line that changed the
 * backlog or the trajectory counts, the day's last one standing. A shallow
 * clone gives what it holds; no git gives none.
 */
export function readHistory(cwd = ROOT) {
  const log = git(['log', '--first-parent', '--reverse', '--format=%H %cs', 'HEAD', '--', 'project/backlog.md', 'project/trajectory.md'], cwd);
  if (!log) return [];
  const byDay = new Map();
  for (const line of log.split('\n').filter(Boolean)) {
    const [sha, day] = line.split(' ');
    const backlog = git(['show', `${sha}:project/backlog.md`], cwd);
    const trajectory = git(['show', `${sha}:project/trajectory.md`], cwd);
    if (backlog === null || trajectory === null) continue;
    byDay.set(day, { date: day, open: countOpen(backlog), shipped: countShipped(trajectory) });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The record's revision the page shows: the last commit on main's line that
 * changed what the page is built from. A publish's own commit changes none of
 * it, so building again from the same record gives the same page, and the step
 * finds nothing new to publish.
 */
export function readRevision(cwd = ROOT) {
  const head = git(['log', '--first-parent', '-1', '--format=%cI %h', 'HEAD', '--', ...SOURCES], cwd)?.trim().split(' ') ?? [];
  return { asOf: head[0] || null, commit: head[1] || null };
}

/** What a page script may load: by fetch() only, a literal file beside it. Anything else is a reason the page is refused. */
export function scriptLoads(text) {
  const problems = [];
  const files = [];
  for (const [pattern, words] of [
    [/\bXMLHttpRequest\b/, 'uses XMLHttpRequest'], [/\bWebSocket\b/, 'opens a WebSocket'], [/\bEventSource\b/, 'opens an EventSource'],
    [/\bsendBeacon\b/, 'sends a beacon'], [/\bimport\s*\(/, 'calls import()'], [/\bimportScripts\b/, 'calls importScripts()'],
    [/\.src\s*=|setAttribute\(\s*['"](?:src|href)['"]/, 'sets a src or href']
  ]) if (pattern.test(text)) problems.push(words);
  for (const match of text.matchAll(/\bfetch\s*\(([^,)]*)/g)) {
    const literal = /^\s*(['"])([^'"`]*)\1\s*$/.exec(match[1]);
    if (!literal) problems.push(`fetches a path that is not a literal: fetch(${match[1].trim()}`);
    else if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(literal[2])) problems.push(`fetches outside its own folder: ${literal[2]}`);
    else files.push(literal[2]);
  }
  return { files, problems };
}

/** Refuse a built page that loads anything but its own files: what the step's site check does not read in a script. */
export function checkPage(dir) {
  const present = new Set(readdirSync(dir));
  const problems = [];
  for (const file of [...present].filter(name => name.endsWith('.js'))) {
    const { files, problems: found } = scriptLoads(readFileSync(join(dir, file), 'utf8'));
    problems.push(...found.map(problem => `${file} ${problem}`));
    for (const name of files) if (!present.has(name)) problems.push(`${file} fetches a missing file: ${name}`);
  }
  if (problems.length) throw new Error(`progress page check: ${problems.join('; ')}`);
}

/** The checkout's branch names on origin, without the remote's prefix. */
export function readBranches(cwd = ROOT) {
  const refs = git(['for-each-ref', '--format=%(refname:lstrip=3)', 'refs/remotes/origin'], cwd);
  return branchIds((refs ?? '').split('\n').filter(name => name && name !== 'HEAD' && name !== 'main'));
}

/** The page's data from the record in `cwd`; what cannot be read is said, not thrown. */
export function readProgress(cwd = ROOT) {
  const { asOf, commit } = readRevision(cwd);
  try {
    const read = path => readFileSync(join(cwd, path), 'utf8');
    return buildProgress({
      backlog: read('project/backlog.md'),
      trajectory: read('project/trajectory.md'),
      titles: itemTitles(join(cwd, 'project', 'items')),
      names: JSON.parse(read('progress/names.json')),
      branches: readBranches(cwd),
      history: readHistory(cwd),
      asOf,
      commit
    });
  } catch (error) {
    return { asOf, commit, error: `The record could not be read: ${error.message}` };
  }
}

/** Write the page into `out`: its own files from progress/ and the data from the record in `cwd`. */
export function writeProgress({ cwd = ROOT, out = join(cwd, 'dist', 'progress') } = {}) {
  const data = readProgress(cwd);
  mkdirSync(out, { recursive: true });
  for (const file of PAGE_FILES) copyFileSync(join(cwd, 'progress', file), join(out, file));
  writeFileSync(join(out, 'progress.json'), `${JSON.stringify(data, null, 1)}\n`);
  checkPage(out);
  return data;
}

/** One line on what the page says, for the step's summary. */
export const progressLine = data => (data.error
  ? `The progress page says the record could not be read (${data.error}).`
  : `The progress page: ${data.summary.v4Done} of ${data.summary.v4Items} v4 items done, ${data.summary.shipped} shipped in all, ${data.history.length} days of history.`);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--out');
  const out = at > -1 ? resolve(process.argv[at + 1]) : undefined;
  console.log(progressLine(writeProgress(out ? { out } : {})));
}
