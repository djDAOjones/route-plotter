#!/usr/bin/env node
// pm-next-v3.1 brief tool (specification 3.19). Zero dependencies; an add-on outside the core that no rule reads.
//   node tools/brief.mjs [--root <dir>] <ID>
// Prints one open item's start packet, for the orchestrate verb's brief, from the ledger alone — the project/ files,
// never Git, the network or anything outside the installation: the item's backlog line, milestone and phase, its
// blockers, its item file's Intent, Acceptance criteria and Now, the decisions naming it as heading and Decision line,
// newest first, its open wish lines and the profile's Gate line, within 600 words by the counting rule of 3.4, the count
// printed last. A section that does not fit is replaced by a line naming where it is, never clipped; decisions are shown
// whole, newest first, the older ones that do not fit counted and named; a packet that cannot fit even so is refused. An unknown, shipped or ambiguous ID — two open
// lines, or open and shipped at once — or a wish ID is one plain sentence and exit 1; a usage error exit 2. An item's ID
// never matches its own wish IDs (ID.N) or a longer ID it prefixes (ID-X).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ID, DATE, WISH_ID, WISH_LINE, active, sections, field, decisionEntries, words } from './ledger.mjs';

export const BUDGET = 600;
const args = process.argv.slice(2);
const root = args[0] === '--root' ? resolve(args.splice(0, 2)[1] || '.') : process.cwd();
const say = (sentence, code = 1) => { console.error(`brief: ${sentence}`); process.exit(code); };
if (args.length !== 1 || !args[0]) say('usage: node tools/brief.mjs [--root <dir>] <ID>', 2);
const query = args[0];
if (new RegExp(`^${WISH_ID}$`, 'u').test(query)) say(`${query} is a wish line, not an item; the plan verb promotes it, and node tools/find.mjs ${query} recalls it.`);
if (!new RegExp(`^${ID}$`, 'u').test(query)) say(`${query} is not an item ID; give one ID exactly as the backlog line writes it.`);
const read = (file, required = false) => {
  try { return active(readFileSync(join(root, 'project', file), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; if (required) say(`project/${file} is missing under ${root}, so there is no ledger to brief from.`); return ''; }
};
// The ID as a whole token: never inside a longer ID (ID-X), a wish ID (ID.N) or a word.
const token = new RegExp(`(?<![\\p{L}\\p{N}_.-])${query}(?![\\p{L}\\p{N}_-]|\\.[\\p{L}\\p{N}])`, 'u');

// The backlog line, by the checker's grammar (ledger.mjs inspect), with its milestone and phase.
const backlog = read('backlog.md', true);
const itemRe = new RegExp(`^- \\[( |~|!)\\] (${ID}) — (.+?) — since (${DATE})(?: — \\(from: (${ID}), (${DATE})\\))?(?: — blocked: (.+))?$`, 'u');
const hits = []; let milestone = '', phase = '';
for (const [i, line] of backlog.split('\n').entries()) {
  let m;
  if ((m = line.match(/^## (.+)$/))) { milestone = m[1].trim(); phase = ''; }
  else if ((m = line.match(/^### (.+)$/))) phase = m[1].trim();
  else if ((m = line.match(itemRe)) && m[2] === query) hits.push({ line: line.trim(), at: i + 1, mark: m[1], blocked: m[7] || '', milestone, phase });
  else if (!m && new RegExp(`^- \\[.\\] ${query} — `, 'u').test(line)) hits.push({ line: line.trim(), at: i + 1, unparsed: true, milestone, phase });
}
const shippedLine = read('trajectory.md').split('\n').find((l) => l.startsWith(`- ${query} — `));
if (hits.length > 1) say(`${query} is on ${hits.length} backlog lines (project/backlog.md lines ${hits.map((h) => h.at).join(', ')}), so the record is ambiguous; the checker reports it, and no brief is printed.`);
if (hits.length === 1 && hits[0].unparsed) say(`${query}'s backlog line (project/backlog.md line ${hits[0].at}) does not parse; node tools/check.mjs names the fault, and no brief is printed.`);
const shippedOn = shippedLine && ((shippedLine.match(/\((\d{4}-\d{2}-\d{2})\)(?!.*\(\d{4}-\d{2}-\d{2}\))/) || [, 'undated'])[1]);
if (hits.length && shippedLine) say(`${query} is both open (project/backlog.md line ${hits[0].at}) and shipped (project/trajectory.md: ${shippedOn}), so the record is ambiguous; no brief is printed.`);
if (!hits.length) {
  if (shippedLine) say(`${query} has shipped (project/trajectory.md: ${shippedOn}) and has no open backlog line; node tools/find.mjs ${query} recalls it.`);
  say(`${query} is not an open item: no backlog line carries it and no trajectory line ships it.`);
}
const hit = hits[0];

// The decisions naming it: by its heading — ID or title — its Items line or its Decision line; live, then archived chunks.
const archived = (() => { try { return readdirSync(join(root, 'project')).filter((f) => /^decisions-.*\.md$/.test(f)).sort().reverse(); } catch { return []; } })();
const decisions = ['decisions.md', ...archived].flatMap((file) => decisionEntries(read(file), `project/${file}`).map((e) => ({ ...e, archived: file === 'decisions.md' ? '' : file })))
  .filter((e) => e.id === query || token.test(e.head) || token.test(e.items || '') || token.test(e.decision || ''))
  .sort((a, b) => b.date.localeCompare(a.date)); // stable: within a date, the file's newest-first order
const wishes = read('wish-list.md').split('\n').filter((l) => l.match(WISH_LINE)?.[3] === query);
const where = `project/items/${query}.md`;
const item = existsSync(join(root, where)) ? read(`items/${query}.md`) : null, parts = item === null ? new Map() : sections(item);
const gate = field(read('profile.md'), 'Gate');

// The packet: fixed blocks, then the item's sections and the wish lines, each whole or as a pointer naming where it is,
// then the decisions, newest first, each whole, the rest counted and named. Printed order is fixed; what is whole is chosen.
const state = { ' ': 'open', '~': 'in progress', '!': 'needs the owner' }[hit.mark];
const fixed = [
  `# Brief — ${query}`,
  `Backlog: ${hit.line}`,
  `Milestone: ${hit.milestone || 'none'}; phase: ${hit.phase || 'none'}; status: ${state}`,
  `Blockers: ${hit.blocked || 'none on the backlog line'}${hit.mark === '!' ? '; the [!] mark: the owner decides before it starts' : ''}`,
  `Gate: ${gate || 'none in project/profile.md'}`,
];
// V31-MODEL-POLICY: where the project keeps a model policy, the brief names it, so a session or second model briefed
// from this packet takes its model, effort and checks from the record.
if ((() => { try { return readdirSync(join(root, 'project')).includes('model-policy.md'); } catch { return false; } })()) fixed.push('Model policy: project/model-policy.md — the model, effort and second-model checks for each step (rule 9)');
const optional = []; // { whole, pointer, rank, full }
if (item === null) fixed.push(`Item file: none (${where} is absent); the backlog line is the whole item.`);
else for (const [name, rank] of [['Intent', 3], ['Acceptance criteria', 2], ['Now', 1]]) {
  const body = parts.get(name);
  optional.push({ whole: `## ${name}\n\n${body || `None in ${where}.`}`, pointer: `## ${name}\n\nCut for the budget: read ${where}.`, rank });
}
optional.push({ whole: `## Open wish lines\n\n${wishes.length ? wishes.join('\n') : 'None from this item.'}`, pointer: `## Open wish lines\n\n${wishes.length} cut for the budget: node tools/find.mjs ${query} lists them.`, rank: 4 });
for (const b of optional) b.full = words(b.whole) <= words(b.pointer); // the minimum takes each section's shorter form
const shownAs = (e) => `${e.date} — ${e.id} — ${e.title}${e.archived ? ` [archived: project/${e.archived}]` : ''}\nDecision: ${e.decision}`;
const countLine = (n) => `brief: ${n} words of ${BUDGET}`;
let shown = 0;
const render = () => {
  const list = decisions.slice(0, shown).map(shownAs);
  if (shown < decisions.length) list.push(`${decisions.length - shown} ${shown ? 'older ' : ''}cut for the budget: node tools/find.mjs --full ${query} prints them whole.`);
  const body = [...fixed, ...optional.map((b) => b.full ? b.whole : b.pointer),
    `## Decisions naming it by heading, Items or Decision line (${decisions.length}, newest first)\n\n${list.length ? list.join('\n\n') : 'None.'}`].join('\n\n');
  return `${body}\n\n${countLine(words(body) + words(countLine(0)))}`;
};
const fits = () => words(render()) <= BUDGET;
if (!fits()) say(`${query}'s packet cannot be held within ${BUDGET} words even with every section cut (${words(render())} words, its backlog line or Gate line too long); node tools/find.mjs ${query} prints the record.`);
for (const b of [...optional].sort((x, y) => x.rank - y.rank)) { b.full = true; if (!fits()) b.full = false; }
while (shown < decisions.length) { shown++; if (!fits()) { shown--; break; } }
console.log(render());
