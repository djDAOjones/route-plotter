#!/usr/bin/env node
// Read-only recall across live and archived records; for a wish ID (V31-WISH-IDS), also the commit-body lines naming it.
// A decision entry prints as its heading, Decision and Deferred lines, `--full` the whole entry, and an entry that a later
// entry's Supersedes line names says so, read at the time from the live file and the archived chunks (V31-FIND-SUMMARY).
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { active, ID, WISH_ID, decisionEntries, summaryText, supersededBy, supersededLines, wishToken } from './ledger.mjs';
const args = process.argv.slice(2);
let root = process.cwd(), full = false;
for (;;) { // the options come first, in either order
  if (args[0] === '--root') root = resolve(args.splice(0, 2)[1] || '.');
  else if (args[0] === '--full') { full = true; args.shift(); }
  else break;
}
if (args.length !== 1 || !args[0]) { console.error('find: usage: node tools/find.mjs [--root <dir>] [--full] <ID or text>'); process.exit(2); }
const query = args[0], isWish = new RegExp(`^${WISH_ID}$`).test(query), isID = isWish || new RegExp(`^${ID}$`).test(query);
// an item's ID also matches its wishes, ORIGIN.N; a wish ID never matches a longer number
const token = isWish ? wishToken(query) : isID ? new RegExp(`(?<![\\p{L}\\p{N}_.-])${query}(?![\\p{L}\\p{N}_-])`, 'u') : null;
const matches = (s) => isID ? token.test(s) : s.includes(query);
const read = (file) => {
  try { return active(readFileSync(join(root, file), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; return ''; }
};
let found = false;
const print = (file, lines) => {
  if (!lines.length) return;
  console.log(`${file}:\n${lines.join('\n')}`); found = true;
};
const lines = (file) => print(file, read(file).split('\n').filter((s) => s.startsWith('- ') && matches(s)));
// Every decision entry, the live file's then each chunk's, newest first: the Supersedes lines are read across all of them.
const chunks = (() => {
  try { return readdirSync(join(root, 'project')).filter((f) => /^decisions-.*\.md$/.test(f)).sort(); } // archived chunks sit beside decisions.md
  catch (e) { if (e.code !== 'ENOENT') throw e; return []; }
})();
const entriesOf = (file) => decisionEntries(read(file), file);
const superseded = isID ? supersededBy(['project/decisions.md', ...[...chunks].reverse().map((f) => `project/${f}`)].flatMap(entriesOf)) : new Map();
let summarised = false;
const decisions = (file, archived = false) => print(file, // matched on the whole entry's active text
  entriesOf(file).filter((e) => matches(e.raw)).map((e) => {
    const [head, ...rest] = full ? [`## ${e.head}`, e.raw.split('\n').slice(1).join('\n').trim()] : summaryText(e).split('\n');
    if (!full) summarised = true;
    return [`${head}${archived ? ` [archived: ${file}]` : ''}`, ...supersededLines(superseded.get(e.head)), ...rest].join('\n');
  }));
if (isID) {
  lines('project/backlog.md');
  decisions('project/decisions.md');
  for (const file of chunks) decisions(`project/${file}`, true);
  lines('project/trajectory.md');
}
lines('project/wish-list.md');
if (isID && !isWish) {
  const file = `project/items/${query}.md`, text = read(file).trim();
  if (text) print(file, [text]);
}
const history = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch { return ''; } }; // not a repository: none
if (isWish) { // a wish's trace may be a commit-body line, so the history is part of its record
  const log = history('log', '--format=%x00%h%n%B', '-F', `--grep=${query}`, '--');
  print('commit messages', log.split('\0').filter(Boolean).flatMap((c) => { const [hash, , ...body] = c.split('\n'); return body.filter((l) => token.test(l)).map((l) => `${hash}: ${l}`); }));
} else if (isID) { // the numbers an origin has issued, from every line its wish list ever held and every commit message
  const used = new Set([...(history('log', '--format=%B') + history('log', '-p', '--format=', '--', 'project/wish-list.md') + '\n' + read('project/wish-list.md')).matchAll(new RegExp(`(?<![\\p{L}\\p{N}_.-])${query}\\.([1-9][0-9]*)(?![\\p{L}\\p{N}_]|\\.[\\p{L}\\p{N}])`, 'gu'))].map((m) => Number(m[1])));
  if (used.size) print('wish numbers used', [`${query}: ${[...used].sort((a, b) => a - b).map((n) => `${query}.${n}`).join(', ')}; the next is ${query}.${Math.max(...used) + 1}`]);
}
if (summarised) console.log('find: decision entries show the heading, Decision and Deferred lines; --full prints each whole.');
if (!found) console.log(`find: nothing matches ${query}`);
