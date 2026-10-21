#!/usr/bin/env node
// Read-only recall across live and archived records; for a wish ID (V31-WISH-IDS), also the commit-body lines naming it.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { active, ID, WISH_ID, decisionEntries, wishToken } from './ledger.mjs';
const args = process.argv.slice(2);
const root = args[0] === '--root' ? resolve(args.splice(0, 2)[1] || '.') : process.cwd();
if (args.length !== 1 || !args[0]) { console.error('find: usage: node tools/find.mjs [--root <dir>] <ID or text>'); process.exit(2); }
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
const decisions = (file, archived = false) => print(file, // the whole entry, matched on its whole active text
  decisionEntries(read(file), file).filter((e) => matches(e.raw))
    .map((e) => `## ${e.head}${archived ? ` [archived: ${file}]` : ''}\n${e.raw.split('\n').slice(1).join('\n').trim()}`));
if (isID) {
  lines('project/backlog.md');
  decisions('project/decisions.md');
  let archives = [];
  try { archives = readdirSync(join(root, 'project')); } // archived chunks sit beside decisions.md
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  for (const file of archives.filter((f) => /^decisions-.*\.md$/.test(f)).sort()) decisions(`project/${file}`, true);
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
if (!found) console.log(`find: nothing matches ${query}`);
