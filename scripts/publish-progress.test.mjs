/**
 * PROG-01: the progress page's data is read from the record correctly, and the
 * page the publishing step builds passes the step's own site check (it loads
 * nothing from another site). Node's own runner, no dependency:
 * `node --test scripts/publish-progress.test.mjs`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ROOT, PAGE_FILES, branchIds, buildProgress, checkPage, countShipped, parseBacklog, parseTrajectory, phaseNumber,
  progressLine, readHistory, readRevision, scriptLoads, sectionName, writeProgress
} from './publish-progress.mjs';
import { checkSite } from './publish.mjs';

const BACKLOG = `# Backlog

## Current

### Phase 6 — foundations — the owner's word — CLOSED 2026-11-19

### Phase 7 — the core, end to end — the owner's overnight word

- [ ] CORE-06 — Drawing routes on the canvas — since 2026-11-18 — (from: PLAN-6, 2026-11-18)
- [~] CORE-07 — The scene outline — since 2026-11-18
- [ ] CORE-13 — The settings the drawing already takes — since 2026-11-20

## Next

**The v4 programme's later phases, in order**

**Phase 8, proposed — features as modules**

- [ ] FEAT-01 — The Add feature list — since 2026-11-18

**Phase 9, proposed — presets and v4.0**

- [!] V40-01 — Declare v4.0 — since 2026-11-18 — blocked: the owner's declaration

**Medium term — the owner's word of 2026-10-15**

- [ ] AI-01 — AI-editable saves — since 2026-10-15

## Icebox

- [ ] ICE-01 — Swatch-picker popover · UI polish — since 2026-10-01
`;

const TRAJECTORY = `# Trajectory

## Phase 7 — the core, end to end — the owner's overnight word

- CORE-01 — the project model stands (2026-11-19) — see decisions
- CORE-05 — the editor shell stands, after D121 (2026-11-20) and its review (2026-11-25) — see decisions

## Phase 6 — v4's foundations

- STACK-01 — v3 frozen (2026-11-18) — see decisions
- RECALL — 8/8 (2026-11-19) — scores: 2,2,2,2 — fresh — see decisions

## pm-next v3.1 — the owner's relayed word

## Phase 2 — The owner's after-TST-04 items

- DEF-14 — a defect fixed (2026-10-06) — see decisions

## Ahead of Phase 2's last defects

- DEF-98 — another (2026-10-13) — see decisions
`;

const NAMES = {
  firstV4Phase: 5,
  phases: { 7: 'The core', 8: 'Features' },
  items: { 'CORE-06': 'Drawing routes on the map' },
  sections: { 'Phase 2 —': 'Follow-ups and defects', "Ahead of Phase 2's last defects": 'Follow-ups and defects' }
};

test('a phase number is read only from the start of a heading', () => {
  assert.equal(phaseNumber('Phase 7 — the core'), 7);
  assert.equal(phaseNumber('Phase 8, proposed — features'), 8);
  assert.equal(phaseNumber("Ahead of Phase 2's last defects"), null);
  assert.equal(phaseNumber('Medium term'), null);
});

test('the backlog gives each open item its status, part and phase', () => {
  const items = parseBacklog(BACKLOG);
  assert.deepEqual(items.map(item => [item.id, item.status, item.part, item.phase]), [
    ['CORE-06', 'To do', 'current', 7],
    ['CORE-07', 'In progress', 'current', 7],
    ['CORE-13', 'To do', 'current', 7],
    ['FEAT-01', 'To do', 'next', 8],
    ['V40-01', 'Needs sign-off', 'next', 9],
    ['AI-01', 'To do', 'next', null],
    ['ICE-01', 'To do', 'icebox', null]
  ]);
  assert.equal(items[0].title, 'Drawing routes on the canvas');
  assert.equal(items[0].since, '2026-11-18');
});

test("the trajectory counts items, not the recall verb's scores, and dates each by its last bracketed date", () => {
  const sections = parseTrajectory(TRAJECTORY);
  assert.deepEqual(sections.map(section => [section.phase, section.items.map(item => item.id)]), [
    [7, ['CORE-01', 'CORE-05']], [6, ['STACK-01']], [null, []], [2, ['DEF-14']], [null, ['DEF-98']]
  ]);
  assert.equal(sections[0].items[1].date, '2026-11-25');
  assert.equal(countShipped(TRAJECTORY), 5);
});

test('a branch named for an item marks it in progress; other branch names mark nothing', () => {
  assert.deepEqual([...branchIds(['core-06/drawing-routes', 'pm/5.0.1', 'tidy/2026-11-12', 'prog-01/live-page'])].sort(),
    ['CORE-06', 'PROG-01']);
});

test('the page data groups v4 by phase, done first, and sorts the rest into other work, later and parked', () => {
  const data = buildProgress({
    backlog: BACKLOG, trajectory: TRAJECTORY, names: NAMES, branches: new Set(['CORE-06']),
    titles: { 'CORE-13': 'The settings the drawing takes' }, asOf: '2026-11-25T12:00:00Z', commit: 'abc1234'
  });
  assert.deepEqual(data.phases.map(phase => [phase.number, phase.name]), [
    [6, 'v4\'s foundations'], [7, 'The core'], [8, 'Features'], [9, 'presets and v4.0']
  ]);
  const core = data.phases[1].items;
  assert.deepEqual(core.map(item => [item.id, item.status]), [
    ['CORE-01', 'Done'], ['CORE-05', 'Done'], ['CORE-06', 'In progress'], ['CORE-07', 'In progress'], ['CORE-13', 'To do']
  ]);
  assert.equal(core[2].name, 'Drawing routes on the map', 'a plain name wins');
  assert.equal(core[4].name, 'The settings the drawing takes', "an item file's title comes before the backlog's");
  assert.equal(core[3].name, 'The scene outline', "the backlog's title is the last resort");
  assert.equal(core[1].done, '2026-11-25');
  assert.equal(core[2].since, '2026-11-18');
  assert.deepEqual(data.later.map(item => [item.id, item.group]), [['AI-01', 'After v4.0'], ['ICE-01', 'Parked']]);
  assert.deepEqual(data.otherWork, [{ name: 'Follow-ups and defects', items: 2, started: '2026-10-06', finished: '2026-10-13' }]);
  assert.deepEqual(data.summary, { v4Items: 8, v4Done: 3, v4InProgress: 2, v4SignOff: 1, v4ToDo: 2, shipped: 5, open: 7 });
  assert.equal(data.asOf, '2026-11-25T12:00:00Z');
});

test("a section's plain name falls back to its heading's first part", () => {
  assert.equal(sectionName('The big run — defects outside the waves', {}), 'The big run');
  assert.equal(sectionName('MVP — football crowds', { MVP: 'Football crowds and mobs' }), 'Football crowds and mobs');
});

test("every item the record holds open in a v4 phase reaches the page, and nothing in the record's own words is lost", () => {
  const read = path => readFileSync(join(ROOT, path), 'utf8');
  const names = JSON.parse(read('progress/names.json'));
  const data = buildProgress({ backlog: read('project/backlog.md'), trajectory: read('project/trajectory.md'), names });
  const onPage = new Set([...data.phases.flatMap(phase => phase.items), ...data.later, ...data.otherOpen].map(item => item.id));
  for (const item of parseBacklog(read('project/backlog.md'))) assert.ok(onPage.has(item.id), item.id);
  assert.ok(data.phases.length > 0);
  assert.equal(data.summary.shipped, countShipped(read('project/trajectory.md')));
  for (const phase of data.phases) for (const item of phase.items) assert.ok(item.name && item.status, item.id);
});

test("the built page passes the publishing step's site check: it loads only its own files", () => {
  const site = mkdtempSync(join(tmpdir(), 'progress-site-'));
  try {
    writeFileSync(join(site, 'index.html'), '<!doctype html><title>v4</title>');
    const data = writeProgress({ out: join(site, 'progress') });
    const { files } = checkSite(site);
    for (const file of [...PAGE_FILES, 'progress.json']) assert.ok(files.includes(`progress/${file}`), file);
    assert.deepEqual(JSON.parse(readFileSync(join(site, 'progress', 'progress.json'), 'utf8')), JSON.parse(JSON.stringify(data)));
    const script = readFileSync(join(site, 'progress', 'progress.js'), 'utf8');
    assert.doesNotMatch(script, /(?:https?:)?\/\/(?!www\.w3\.org\/2000\/svg)[a-z0-9-]+\.[a-z]/i, 'the script names no other site');
    assert.deepEqual(scriptLoads(script), { files: ['progress.json'], problems: [] }, 'it loads its data and nothing else');
    assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML|document\.write/, 'the script writes text, never markup');
    assert.match(progressLine(data), /^The progress page: \d+ of \d+ v4 items done/);
  } finally {
    rmSync(site, { recursive: true, force: true });
  }
});

test('a record that cannot be read gives a page that says so, and the step goes on', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'progress-record-'));
  try {
    mkdirSync(join(cwd, 'progress'));
    for (const file of PAGE_FILES) copyFileSync(join(ROOT, 'progress', file), join(cwd, 'progress', file));
    const data = writeProgress({ cwd, out: join(cwd, 'out') });
    assert.match(data.error, /^The record could not be read: /);
    assert.deepEqual(JSON.parse(readFileSync(join(cwd, 'out', 'progress.json'), 'utf8')), JSON.parse(JSON.stringify(data)));
    assert.match(progressLine(data), /could not be read/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a page script that loads anything but a file beside it is refused, and the refusal stops the step's build", () => {
  for (const [script, problem] of [
    ["fetch('//example.test/data.json')", /fetches outside its own folder/],
    ["fetch('https://example.test/data.json')", /fetches outside its own folder/],
    ["fetch('../version.json')", /fetches outside its own folder/],
    ['fetch(address)', /not a literal/],
    ['fetch(`progress.json`)', /not a literal/],
    ["new XMLHttpRequest()", /XMLHttpRequest/],
    ["new WebSocket('wss://example.test')", /WebSocket/],
    ["navigator.sendBeacon('/x')", /beacon/],
    ["import('./x.js')", /import\(\)/],
    ["image.src = 'https://example.test/p.png'", /src or href/],
    ["link.setAttribute('href', address)", /src or href/]
  ]) assert.match(scriptLoads(script).problems.join('; '), problem, script);
  assert.deepEqual(scriptLoads("fetch('progress.json', { cache: 'no-cache' })"), { files: ['progress.json'], problems: [] });
  const dir = mkdtempSync(join(tmpdir(), 'progress-page-'));
  try {
    writeFileSync(join(dir, 'progress.js'), "fetch('data.json')");
    assert.throws(() => checkPage(dir), /fetches a missing file: data\.json/);
    writeFileSync(join(dir, 'data.json'), '{}');
    assert.doesNotThrow(() => checkPage(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("history follows main's own line, so branch work counts on the day it merged; a publish's commit changes nothing", () => {
  const cwd = mkdtempSync(join(tmpdir(), 'progress-git-'));
  const at = day => ({ ...process.env, GIT_AUTHOR_DATE: `${day}T12:00:00Z`, GIT_COMMITTER_DATE: `${day}T12:00:00Z` });
  const run = (args, day) => execFileSync('git', args, { cwd, env: at(day), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const record = (open, shipped) => {
    mkdirSync(join(cwd, 'project'), { recursive: true });
    writeFileSync(join(cwd, 'project', 'backlog.md'), `## Current\n\n${Array.from({ length: open }, (_, i) => `- [ ] CORE-${i + 1} — Item — since 2026-11-01\n`).join('')}`);
    writeFileSync(join(cwd, 'project', 'trajectory.md'), `## Phase 7 — the core\n\n${Array.from({ length: shipped }, (_, i) => `- DONE-${i + 1} — shipped (2026-11-01) — see decisions\n`).join('')}`);
  };
  try {
    run(['init', '-q', '-b', 'main'], '2026-11-01');
    run(['config', 'user.email', 'test@example.test'], '2026-11-01');
    run(['config', 'user.name', 'Test'], '2026-11-01');
    record(2, 0);
    run(['add', '-A'], '2026-11-01');
    run(['commit', '-q', '-m', 'A'], '2026-11-01');
    run(['checkout', '-q', '-b', 'core-1/work'], '2026-11-02');
    record(1, 1);
    run(['commit', '-q', '-am', 'B, on its branch'], '2026-11-02');
    run(['checkout', '-q', 'main'], '2026-11-03');
    writeFileSync(join(cwd, 'other.txt'), 'x');
    run(['add', '-A'], '2026-11-03');
    run(['commit', '-q', '-m', 'C, elsewhere'], '2026-11-03');
    run(['merge', '-q', '--no-ff', '-m', 'Merge B', 'core-1/work'], '2026-11-05');
    const merged = run(['rev-parse', '--short', 'HEAD'], '2026-11-05');
    assert.deepEqual(readHistory(cwd), [
      { date: '2026-11-01', open: 2, shipped: 0 },
      { date: '2026-11-05', open: 1, shipped: 1 }
    ]);
    mkdirSync(join(cwd, 'docs'));
    writeFileSync(join(cwd, 'docs', 'index.html'), 'site');
    run(['add', '-A'], '2026-11-06');
    run(['commit', '-q', '-m', 'PUB-01: publish'], '2026-11-06');
    assert.deepEqual(readRevision(cwd), { asOf: '2026-11-05T12:00:00Z', commit: merged }, "the publish's own commit is not the record's revision");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
