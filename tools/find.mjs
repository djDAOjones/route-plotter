#!/usr/bin/env node
// Read-only recall across live and archived records.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { active, ID, decisionEntries } from './ledger.mjs';
const args = process.argv.slice(2);
const root = args[0] === '--root' ? resolve(args.splice(0, 2)[1] || '.') : process.cwd();
if (args.length !== 1 || !args[0]) { console.error('find: usage: node tools/find.mjs [--root <dir>] <ID or text>'); process.exit(2); }
const query = args[0], isID = new RegExp(`^${ID}$`).test(query);
const token = isID ? new RegExp(`(?<![\\p{L}\\p{N}_-])${query}(?![\\p{L}\\p{N}_-])`, 'u') : null;
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
  try { archives = readdirSync(join(root, 'project/archive')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  for (const file of archives.filter((f) => /^decisions-.*\.md$/.test(f)).sort()) decisions(`project/archive/${file}`, true);
  lines('project/trajectory.md');
}
lines('project/wish-list.md');
if (isID) {
  const file = `project/items/${query}.md`, text = read(file).trim();
  if (text) print(file, [text]);
}
if (!found) console.log(`find: nothing matches ${query}`);
