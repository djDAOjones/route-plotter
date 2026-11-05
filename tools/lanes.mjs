#!/usr/bin/env node
// pm-next-v3.1 parallel writers (specification 3.19, V31-WRITERS). Zero dependencies; an add-on outside the core that no rule reads.
//   node tools/lanes.mjs [--root <dir>] overlap <brief-file> <brief-file> ...
//   node tools/lanes.mjs [--root <dir>] union project/decisions.md|project/trajectory.md
//   node tools/lanes.mjs [--root <dir>] reset-claim <end-commit> --starts-quiet
// overlap reads each brief's one `Expected paths:` line, comma-separated repository-relative files or directories, and
// refuses two briefs naming one path or a path inside another's directory, compared case-folded; this installation's own
// decisions and trajectory files, named exactly, are exempt, for union joins them. Paths are compared as written: a symlink
// alias is not resolved, since a path may not exist yet. No ledger field is read or added.
// union, in a conflicted merge, reads Git's three stages of the one file and writes their union to the working file, never
// staging it: decision entries by heading, trajectory lines by phase and ID, each kept byte for byte; what one side changed
// from the merge base is taken. It refuses, writing nothing: a side with a lost separator (a heading with no blank line
// before it) or conflict markers; an entry or line a side lost, unless each side that lost it holds the entry verbatim in an
// archive chunk (project/decisions-*.md); a key both sides changed differently; a repeated key; a trajectory phase holding a
// comment, a fence or text a blank line parts from its line, which is joined by hand; one shipped ID in two phases. Its
// result is parsed again and held to every kept entry exactly once before it is written.
// reset-claim removes an abandoned partial claim (3.15), so the next chat started claims the end by the usual exclusive
// create, exactly one chat told it holds it. It is the owner's: --starts-quiet is his statement that no chat is starting in
// this checkout or any linked worktree and no start is still running, which no tool can prove, a stalled process outliving
// the notice's deadline. Only a regular file whose bytes are a strict prefix of a claim for that end, and which the notice
// would not read as a claim, is removed: unchanged after a wait past the deadline, then moved aside and read again, put back
// if it changed. A whole claim is never removed, of whatever age: no time is read. The former chat's stopping, then the
// owner's word, is that recovery.
// A refusal is one plain sentence and exit 1; a usage error exit 2.
import { spawnSync } from 'node:child_process';
import { closeSync, constants, fstatSync, linkSync, openSync, readFileSync, readSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { active, decisionEntries } from './ledger.mjs';

const USAGE = 'usage: node tools/lanes.mjs [--root <dir>] overlap <brief-file> <brief-file> ... | union project/decisions.md|project/trajectory.md | reset-claim <end-commit> --starts-quiet';
const NOTICE_DEADLINE_MS = 1900, QUIET_WAIT_MS = 2000, MAX_CLAIM = 4096; // handover.mjs's deadline and claim bound
const SHARED = ['project/decisions.md', 'project/trajectory.md'];
const strip = (s) => s.replace(/^\n+|\n+$/g, ''); // framing newlines only, never a block's own bytes
const args = process.argv.slice(2);
const root = args[0] === '--root' ? resolve(args.splice(0, 2)[1] || '.') : process.cwd();
const refuse = (sentence) => { console.error(`lanes: ${sentence}`); process.exit(1); };
const usage = () => { console.error(`lanes: ${USAGE}`); process.exit(2); };
const verb = args.shift();
if (verb === 'overlap' && args.length >= 2) overlap(args);
else if (verb === 'union' && args.length === 1) union(args[0]);
else if (verb === 'reset-claim' && args.length === 2 && args[1] === '--starts-quiet') resetClaim(args[0]);
else if (verb === 'reset-claim' && args.length === 1 && !args[0].startsWith('--')) refuse('--starts-quiet is required: it is the owner\'s statement that no chat is starting in this checkout or a linked worktree and no start is still running, which this tool cannot see.');
else usage();

// Overlap.
function expected(file) {
  let text; try { text = readFileSync(resolve(root, file), 'utf8'); } catch { refuse(`${file} cannot be read.`); }
  const lines = active(text).split('\n').filter((l) => /^Expected paths:/.test(l));
  if (lines.length !== 1) refuse(`${file} needs exactly one "Expected paths:" line; it has ${lines.length}.`);
  const paths = lines[0].slice('Expected paths:'.length).split(',').map((s) => s.trim().replace(/^`|`$/g, '')).filter(Boolean);
  if (!paths.length) refuse(`${file}: its "Expected paths:" line names no path.`);
  return paths.map((raw) => {
    const clean = posix.normalize(raw.replace(/^\.\//, ''));
    if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw) || clean === '.' || clean === '..' || clean.startsWith('../') || /[*?[\]{}\\]/.test(raw)) refuse(`${file}: "${raw}" is not a plain repository-relative path.`);
    return { raw, path: clean.replace(/\/$/, ''), key: clean.replace(/\/$/, '').normalize('NFC').toLowerCase() };
  });
}
function overlap(files) {
  const named = files.map((file) => ({ file, paths: expected(file) })), hits = [];
  const inside = (a, b) => a === b || b.startsWith(`${a}/`);
  const prefix = git(['rev-parse', '--show-prefix'], { nullOnFail: true })?.trim() || ''; // briefs' paths are from the repository's root
  const joined = SHARED.map((f) => `${prefix}${f}`);
  named.forEach((one, i) => named.slice(i + 1).forEach((two) => {
    for (const a of one.paths) for (const b of two.paths) {
      if (a.path === b.path && joined.includes(a.path)) continue;
      if (inside(a.key, b.key) || inside(b.key, a.key)) hits.push(`${one.file} "${a.raw}" and ${two.file} "${b.raw}"`);
    }
  }));
  if (hits.length) refuse(`these writers overlap, so do not start them together: ${hits.join('; ')}.`);
  console.log(`lanes: no overlap across ${files.length} briefs`);
}

// Git, from the installation's root, without the caller's routing.
function git(gitArgs, { nullOnFail = false } = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const r = spawnSync('git', ['--no-pager', ...gitArgs], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, env });
  if (r.status === 0) return r.stdout;
  if (nullOnFail) return null;
  refuse(`git ${gitArgs[0]} failed here, so nothing was changed.`);
}

// The union. A file is a preamble and keyed blocks, each block's text without its surrounding blank lines.
function parts(text, side, file) {
  if (text.includes('\r')) refuse(`${side}'s ${file} holds carriage returns; nothing was written.`);
  const raw = text.split('\n'), live = active(text).split('\n');
  if (raw.some((l) => /^(<{7}|={7}|>{7})( |$)/.test(l))) refuse(`${side}'s ${file} holds conflict markers; nothing was written.`);
  const starts = live.flatMap((l, i) => (l.startsWith('## ') ? [i] : []));
  for (const i of starts) if (i > 0 && raw[i - 1].trim()) refuse(`${side}'s ${file} has lost the separator before "${raw[i].slice(0, 80)}": no blank line above that heading; nothing was written.`);
  const chunk = (from, to) => strip(raw.slice(from, to).join('\n'));
  return { lead: chunk(0, starts[0] ?? raw.length), blocks: starts.map((s, n) => ({ head: raw[s], text: chunk(s, starts[n + 1] ?? raw.length) })) };
}
function keyed(list, side, file) {
  const map = new Map();
  for (const b of list) { if (map.has(b.key)) refuse(`${side}'s ${file} repeats "${b.key.slice(0, 80)}"; nothing was written.`); map.set(b.key, b.text); }
  return map;
}
// One value by three-way rules; `lost` answers a base block a side no longer has.
function pick(key, b, o, t, file, lost) {
  if (b !== undefined && o === undefined && t === undefined) { // both lost it
    if (lost(key, b, 'ours') && lost(key, b, 'theirs')) return undefined;
    refuse(`both sides lost "${key.slice(0, 80)}" from ${file}, and an archive chunk on each is needed; nothing was written.`);
  }
  if (o === t) return o;
  if (o === undefined || t === undefined) {
    if (b === undefined) return o ?? t; // new on one side
    const side = o === undefined ? 'ours' : 'theirs', kept = o ?? t;
    if (kept !== b) refuse(`"${key.slice(0, 80)}" was removed on ${side} and changed on the other; nothing was written.`);
    if (lost(key, b, side)) return undefined;
    refuse(`${side} lost "${key.slice(0, 80)}" from ${file}, and no archive chunk on that side holds it; nothing was written.`);
  }
  if (b === o) return t;
  if (b === t) return o;
  refuse(`both sides changed "${key.slice(0, 80)}" differently in ${file}; nothing was written.`);
}
// Ours's order, then each block only theirs has placed by `before`, its own order kept.
function ordered(oursKeys, theirsKeys, kept, before) {
  const out = oursKeys.filter((k) => kept.has(k));
  let next = 0;
  for (const k of theirsKeys.filter((x) => kept.has(x) && !out.includes(x))) { next = Math.max(before(k, out), next); out.splice(next, 0, k); next += 1; }
  return out;
}
function chunks(rev) {
  const names = (git(['ls-tree', '--name-only', rev, 'project/'], { nullOnFail: true }) || '').split('\n').filter((n) => /^project\/decisions-.*\.md$/.test(n) || /\/decisions-.*\.md$/.test(n));
  return names.flatMap((n) => {
    const text = git(['show', `${rev}:./project/${n.split('/').pop()}`], { nullOnFail: true });
    return text === null ? [] : parts(text, rev, n).blocks.map((b) => b.text);
  });
}
function unionDecisions(base, ours, theirs, file) {
  const load = (s, side) => { const p = parts(s, side, file); return { lead: p.lead, map: keyed(p.blocks.map((b) => ({ key: b.head, text: b.text })), side, file) }; };
  const B = load(base, 'base'), O = load(ours, 'ours'), T = load(theirs, 'theirs');
  const archived = { ours: null, theirs: null };
  const lost = (_, text, side) => { archived[side] ??= new Set(chunks(side === 'ours' ? 'HEAD' : 'MERGE_HEAD')); return archived[side].has(text); };
  const kept = new Map(), dropped = [];
  for (const key of new Set([...O.map.keys(), ...T.map.keys(), ...B.map.keys()])) {
    const v = pick(key, B.map.get(key), O.map.get(key), T.map.get(key), file, lost);
    if (v !== undefined) kept.set(key, v); else if (B.map.has(key)) dropped.push(key);
  }
  const date = (k) => (k.match(/^## (\d{4}-\d{2}-\d{2}) — /) || [])[1] || '';
  const order = ordered([...O.map.keys()], [...T.map.keys()], kept, (k, out) => { const i = out.findIndex((x) => date(x) <= date(k)); return i < 0 ? out.length : i; });
  const lead = pick('the preamble', B.lead, O.lead, T.lead, file, () => false);
  const result = `${[lead, ...order.map((k) => kept.get(k))].join('\n\n')}\n`;
  const fails = []; decisionEntries(result, file, (m) => fails.push(m));
  if (fails.length) refuse(`the union would not parse (${fails[0]}); nothing was written.`);
  const again = parts(result, 'the union', file).blocks;
  held(again.map((b) => b.head), again.map((b) => b.text), kept, file);
  return { result, count: order.length, dropped: dropped.length, label: 'entries' };
}
function unionTrajectory(base, ours, theirs, file) {
  const lineBlocks = (text) => {
    const lines = text.split('\n'), head = [], items = [], recalls = {}; let cur = null, parted = false;
    for (const l of lines.slice(1)) {
      if (l.startsWith('- ')) { const id = l.slice(2).split(' — ')[0]; cur = { id, key: id === 'RECALL' ? `${l} #${(recalls[l] = (recalls[l] || 0) + 1)}` : id, text: l }; items.push(cur); parted = false; } // a phase may hold RECALL lines, identical ones too
      else if (!l.trim()) parted = cur !== null;
      else if (!cur) head.push(l);
      else if (parted) refuse(`text a blank line parts from its line under "${lines[0].slice(0, 80)}" in ${file} cannot be placed; join this file by hand.`);
      else cur.text += `\n${l}`;
    }
    return { intro: strip(head.join('\n')), items };
  };
  const load = (s, side) => {
    const p = parts(s, side, file), map = new Map();
    for (const b of p.blocks) {
      if (active(b.text) !== b.text) refuse(`${side}'s ${file} holds a comment or fence under "${b.head.slice(0, 80)}", which this tool does not place; join this file by hand.`);
      if (map.has(b.head)) refuse(`${side}'s ${file} repeats "${b.head.slice(0, 80)}"; nothing was written.`);
      const { intro, items } = lineBlocks(b.text);
      map.set(b.head, { intro, lines: keyed(items.map((i) => ({ key: i.key, text: i.text })), `${side}, ${b.head.slice(3, 40)},`, file) });
    }
    return { lead: p.lead, map };
  };
  const B = load(base, 'base'), O = load(ours, 'ours'), T = load(theirs, 'theirs');
  const never = () => false, none = { intro: undefined, lines: new Map() };
  const kept = new Map(); let count = 0;
  for (const head of new Set([...O.map.keys(), ...T.map.keys(), ...B.map.keys()])) {
    const b = B.map.get(head), o = O.map.get(head), t = T.map.get(head);
    if (b && (!o || !t)) refuse(`${!o ? 'ours' : 'theirs'} lost "${head.slice(0, 80)}" from ${file}; nothing was written.`);
    const intro = pick(`${head} preamble`, b?.intro, o?.intro, t?.intro, file, never);
    const lines = new Map();
    const of = (x) => (x || none).lines;
    for (const key of new Set([...of(o).keys(), ...of(t).keys(), ...of(b).keys()])) {
      const v = pick(`${key} in ${head.slice(3)}`, of(b).get(key), of(o).get(key), of(t).get(key), file, never);
      if (v !== undefined) lines.set(key, v);
    }
    // A phase's trailing RECALL lines stay its last: a new line from theirs goes before them.
    const order = ordered([...of(o).keys()], [...of(t).keys()], lines, (k, out) => { if (k.startsWith('- RECALL — ')) return out.length; let at = out.length; while (at > 0 && out[at - 1].startsWith('- RECALL — ')) at -= 1; return at; });
    kept.set(head, { intro, order, lines }); count += order.length;
  }
  const shipped = [...kept.values()].flatMap((v) => v.order).filter((k) => !k.startsWith('- RECALL — '));
  const twice = shipped.find((k, i) => shipped.indexOf(k) !== i);
  if (twice) refuse(`${twice} would ship in two phases of ${file}; nothing was written.`);
  const heads = [...O.map.keys()].filter((h) => kept.has(h)), tKeys = [...T.map.keys()];
  // A phase only theirs has goes before the phase that follows it there.
  for (const h of tKeys.filter((x) => !heads.includes(x)).reverse()) {
    const next = tKeys.slice(tKeys.indexOf(h) + 1).find((x) => heads.includes(x));
    heads.splice(next ? heads.indexOf(next) : heads.length, 0, h);
  }
  const lead = pick('the preamble', B.lead, O.lead, T.lead, file, never);
  const section = (h) => { const s = kept.get(h); return [h, ...(s.intro ? [s.intro] : []), ...(s.order.length ? [s.order.map((k) => s.lines.get(k)).join('\n')] : [])].join('\n\n'); };
  const result = `${[lead, ...heads.map(section)].join('\n\n')}\n`;
  const again = parts(result, 'the union', file).blocks;
  held(again.map((b) => b.head), heads, new Map(heads.map((h) => [h, h])), file);
  for (const h of heads) {
    const got = lineBlocks(again.find((b) => b.head === h).text).items.map((i) => i.text), want = kept.get(h).order.map((k) => kept.get(h).lines.get(k));
    if (got.join('\n') !== want.join('\n')) refuse(`the union lost or reordered a line of "${h.slice(0, 80)}"; nothing was written.`);
  }
  return { result, count, dropped: 0, label: 'lines' };
}
// The result, parsed again: every kept block exactly once, byte for byte.
function held(keys, values, kept, file) {
  if (keys.length !== kept.size) refuse(`the union of ${file} has ${keys.length} blocks for ${kept.size} kept; nothing was written.`);
  for (const [key, text] of kept) {
    const at = keys.indexOf(key);
    if (at < 0 || keys.lastIndexOf(key) !== at || values[at] !== text) refuse(`the union of ${file} did not keep "${key.slice(0, 80)}" exactly once; nothing was written.`);
  }
}
function union(path) {
  const file = posix.normalize(path.replace(/^\.\//, ''));
  if (!SHARED.includes(file)) refuse(`${path} is not a file this tool joins: only ${SHARED.join(' and ')}.`);
  const stages = new Map(git(['ls-files', '-u', '--', file]).split('\n').filter(Boolean).map((l) => [l.split('\t')[0].split(' ')[2], true]));
  if (!stages.size) refuse(`${file} is not in conflict here, so there is nothing to join.`);
  if (!['1', '2', '3'].every((s) => stages.has(s))) refuse(`${file} is missing a side of its conflict (a base, ours and theirs are needed), so nothing was written.`);
  const [base, ours, theirs] = ['1', '2', '3'].map((s) => git(['show', `:${s}:./${file}`]));
  const out = (file.endsWith('decisions.md') ? unionDecisions : unionTrajectory)(base, ours, theirs, file);
  const target = join(root, file), tmp = `${target}.lanes-${process.pid}.tmp`;
  writeFileSync(tmp, out.result); renameSync(tmp, target);
  console.log(`lanes: ${file}: union written, ${out.count} ${out.label}${out.dropped ? `, ${out.dropped} archived by one side` : ''}; read the diff, then git add it and run the checker`);
}

// The reset.
function bytesOf(file) {
  let fd; try { fd = openSync(file, constants.O_RDONLY | (constants.O_NONBLOCK || 0) | (constants.O_NOFOLLOW || 0)); } catch (e) { if (e.code === 'ENOENT') refuse('that end has no claim file, so there is nothing to reset.'); refuse('the claim file cannot be opened as a regular file; it was left as it is.'); }
  try {
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > MAX_CLAIM) refuse('the claim file is not a regular file of at most 4 KiB; it was left as it is.');
    const buf = Buffer.alloc(MAX_CLAIM), n = readSync(fd, buf, 0, MAX_CLAIM, 0);
    return { text: buf.subarray(0, n).toString('latin1'), ino: st.ino };
  } finally { closeSync(fd); }
}
// `{"v":1,"end":"<end>","holder":"<16 hex>","at":"<ISO>"}\n`, position by position: whole where the start notice would read
// it as a claim, as handover.mjs's take does; partial if a strict prefix; and -1 for anything take never wrote.
function claimShape(text, end) {
  try { const c = JSON.parse(text); if (c && c.v === 1 && c.end === end && typeof c.holder === 'string' && c.holder) return 'whole'; } catch { /* not whole */ }
  const lit = (s) => [...s].map((c) => (x) => x === c), hex = /[0-9a-f]/, dig = /\d/, cls = (re) => (x) => re.test(x);
  const shape = [...lit(`{"v":1,"end":"${end}","holder":"`), ...Array(16).fill(cls(hex)), ...lit('","at":"'),
    ...[...'dddd-dd-ddTdd:dd:dd.dddZ'].flatMap((c) => (c === 'd' ? [cls(dig)] : lit(c))), ...lit('"}\n')];
  if (text.length > shape.length || ![...text].every((c, i) => shape[i](c))) return -1;
  return text.length === shape.length ? 'whole' : 'partial';
}
function resetClaim(rev) {
  const end = git(['rev-parse', '--verify', '-q', `${rev}^{commit}`], { nullOnFail: true })?.trim();
  if (!end) refuse(`${rev} is not a commit in this repository.`);
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim(), file = join(common, 'pm-next', 'handover', `${end}.json`);
  const first = bytesOf(file), shape = claimShape(first.text, end);
  if (shape === 'whole') refuse('that claim is whole: it names a chat, and no claim is taken over, of whatever age; once that chat has stopped, the owner\'s word reassigns the end.');
  if (shape !== 'partial') refuse('those bytes are not a partial claim for that end, so the file was left as it is for the owner to read.');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(QUIET_WAIT_MS, NOTICE_DEADLINE_MS + 100));
  const second = bytesOf(file);
  if (second.text !== first.text || second.ino !== first.ino) refuse('the claim file changed during the wait, so a chat is starting; it was left as it is.');
  const aside = join(dirname(file), `.${end}.reset-${process.pid}.tmp`);
  renameSync(file, aside);
  if (bytesOf(aside).text !== first.text) { // written in the gap: its chat holds the end
    linkSync(aside, file); unlinkSync(aside);
    refuse('the claim file changed as it was moved aside, so a chat was still starting; it was put back.');
  }
  unlinkSync(aside);
  console.log('lanes: the partial claim is removed; the next chat started in this checkout claims the end');
}
