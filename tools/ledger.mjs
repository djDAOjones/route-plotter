// Shared ledger grammar and inspection. No writes, subprocesses or dependencies.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

export const ID = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*';
export const DATE = '\\d{4}-\\d{2}-\\d{2}';
// The counting rule (specification 3.4): whitespace words after removing HTML comments and fenced blocks; the same rule for every file.
export const words = (s) => active(s).split(/\s+/).filter(Boolean).length;
export const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
// A closing fence is of the opening's character, at least its length, with nothing after it; comments and fences keep their newlines.
const blank = (m) => m.replace(/[^\n]/g, '');
export const active = (s) => s.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, blank)
  .replace(/^([ \t]*)(`{3,})[^\n]*\n[\s\S]*?^\1\2`*[ \t]*$/gm, blank).replace(/^([ \t]*)(~{3,})[^\n]*\n[\s\S]*?^\1\2~*[ \t]*$/gm, blank);
export const sections = (s) => new Map([...active(s).matchAll(/^## ([^\n]+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)]
  .map((m) => [m[1], m[2].trim()]));
export const field = (s, name) => (active(s).match(new RegExp(`^- ${name}: (.+(?:\\n[ \\t]+\\S.*)*)`, 'm')) || [])[1]?.replace(/\n\s+/g, ' ') || '';
export const fieldLines = (s, name) => [...active(s).matchAll(new RegExp(`^- ${name}:(.*)$`, 'gm'))].map((m) => m[1].trim());
// The Push and Network lines (3.5): three Push routes, three Network values; listed hosts must name at least one host.
export function pushRoute(line) {
  if (/\bnever push|\bno push/i.test(line)) return '';
  if (/\bowner[- ]operated\b|\bthe owner pushes\b/i.test(line)) return 'owner';
  return /\bharness\b.*\bpush(?:es)? to (?:the project's origin|origin|[A-Za-z0-9*][A-Za-z0-9.*-]*\.[A-Za-z0-9-]+|a named host|the named host)\b/i.test(line) ? 'harness' : '';
}
export function networkChoice(line) {
  const kind = /^open\b/i.test(line) ? 'open' : /^closed\b/i.test(line) ? 'closed' : /^listed hosts?\b/i.test(line) ? 'listed' : '';
  if (!kind || (kind !== 'listed' && /\b(?:or|and)\b.*\b(open|closed|listed)\b/i.test(line))) return null; // one choice, not a hedge
  const hosts = kind === 'listed' ? [...line.replace(/^listed hosts?:?\s*/i, '').matchAll(/[A-Za-z0-9*][A-Za-z0-9.*-]*\.[A-Za-z0-9-]+/g)].map((m) => m[0]) : [];
  return kind === 'listed' && !hosts.length ? null : { kind, hosts };
}
// Hard budgets (3.4), the profile's Budget line overriding each by name; a raise is the owner's recorded decision.
export const DEFAULT_BUDGETS = { total: 4000, contract: 500, profile: 400, rules: 600, direction: 150, backlog: 1000, slice: 1000, trajectory: 300 };
export const RULES_ALWAYS_GUIDELINE = 400, BRIEF_GUIDELINE = 1500;
export const SESSION_LINE = /^([1-9]\d*)k tokens of context$/; // the one Session grammar (3.15), shared with the sensor
export function options(values = []) {
  const result = { root: process.cwd() };
  const allowed = new Set(['root', ...values]);
  for (let i = 2; i < process.argv.length; i++) {
    const name = process.argv[i].replace(/^--/, '');
    if (!process.argv[i].startsWith('--') || !allowed.has(name)) throw Error(`unknown option: ${process.argv[i]}`);
    if (['audit-prose', 'print', 'force', 'hooks-only'].includes(name)) result[name] = true;
    else {
      const value = process.argv[++i];
      if (!value || value.startsWith('--')) throw Error(`--${name} requires a value`);
      result[name] = value;
    }
  }
  result.root = resolve(result.root);
  return result;
}
export function decisionEntries(text, file, fail = () => {}) {
  const body = active(text);
  const entries = [];
  for (const block of body.split(/^(?=## )/m).filter((s) => s.startsWith('## '))) {
    const head = block.split('\n')[0].slice(3);
    const m = head.match(new RegExp(`^(${DATE}) — (${ID}) — (.+)$`));
    if (!m || !validDate(m[1])) { fail(`${file}: invalid decision heading: ${head}`); continue; }
    const fields = {};
    for (const k of ['Decision', 'Rationale', 'Supersedes', 'Deferred', 'Items']) {
      const matches = [...block.matchAll(new RegExp(`^\\*\\*${k}:\\*\\*([^\\n]*(?:\\n(?!\\*\\*|## )[^\\n]*)*)`, 'gm'))];
      if ((!['Deferred', 'Items'].includes(k) && matches.length !== 1) || matches.length > 1) fail(`${file}: ${head}: needs exactly one ${k} field`);
      fields[k.toLowerCase()] = matches[0]?.[1].trim() || '';
      if (k === 'Supersedes') fields.supersedes = fields.supersedes.replace(/\n[ \t]*/g, ' ');
      if (matches.length && (!fields[k.toLowerCase()] || /^\{.*\}$/.test(fields[k.toLowerCase()]))) fail(`${file}: ${head}: empty ${k}`);
    }
    entries.push({ raw: block, head, date: m[1], id: m[2], title: m[3], file, ...fields });
  }
  return entries;
}
export function archiveRow(file, entries) {
  const dates = entries.map((e) => e.date).sort();
  return `- ${file} — ${dates[0]}..${dates.at(-1)} — ${entries.length} entries — IDs: ${[...new Set(entries.map((e) => e.id))].sort().join(', ')}`;
}
// Rule 1's decisions slice (3.3, as ruled 2026-10-01 at the lab's migration): exactly the latest ten entries, newest first.
// An entry is inherited when the migration inventory (project/migration/inventory.json, written at the v2 snapshot) lists its
// heading: it counts as heading and Deferred line only, its Decision line on demand until it leaves the latest ten. Every
// other entry — written under v3, whatever its date or ID — counts as heading, Decision and Deferred; a project with no
// inventory (a fresh or adopted INTAKE) has no inherited entries. The boundary is fixed at the snapshot and cannot move.
export function decisionSlice(live, inheritedHeads = new Set()) {
  const entries = live.slice(0, 10).map((e) => {
    const inherited = inheritedHeads.has(e.head);
    const text = [`## ${e.head}`, inherited ? '' : `**Decision:** ${e.decision}`, e.deferred ? `**Deferred:** ${e.deferred}` : ''].filter(Boolean).join('\n');
    return { head: e.head, decision: inherited ? '' : e.decision, deferred: e.deferred, inherited, text, words: words(text) };
  });
  return { entries, text: entries.map((e) => e.text).join('\n\n'), words: entries.reduce((n, e) => n + e.words, 0) };
}
// Rule 1's trajectory read (3.3, amended 2026-10-01): the latest item lines — `- ID — outcome (date) — see decisions`, RECALL
// lines excluded — that fit the trajectory budget, never fewer than the last four shipped items; newest phase first and the
// latest lines of a phase first, shown with their phase headings. The words include the headings shown.
export function trajectoryItemLines(tphases, budget = DEFAULT_BUDGETS.trajectory, floor = 4) {
  const candidates = [];
  for (const phase of tphases) {
    const items = phase.lines.filter((l) => !l.startsWith('RECALL — '));
    for (let i = items.length - 1; i >= 0; i--) candidates.push({ phase: phase.name, line: items[i] });
  }
  const render = (lines) => {
    const shown = [];
    for (const { phase, line } of lines) { if (shown.at(-1)?.phase !== phase) shown.push({ phase, lines: [] }); shown.at(-1).lines.push(line); }
    return shown.map((p) => `## ${p.phase}\n${p.lines.map((l) => `- ${l}`).join('\n')}`).join('\n');
  };
  let lines = [];
  for (const c of candidates) {
    const next = [...lines, c];
    if (next.length > floor && words(render(next)) > budget) break;
    lines = next;
  }
  const text = render(lines);
  return { lines, text, words: words(text) };
}
// The owner's signature (3.8): one reviewed line, or one delegated line that cites its authority and needs the owner until replaced.
export function signature(text) {
  const signed = sections(active(text)).get('Signed') || '';
  const reviewed = [...signed.matchAll(/^- Owner: ([^\n,]+), (\d{4}-\d{2}-\d{2})\.?$/gm)].map((m) => ({ name: m[1], date: m[2], delegated: false, authority: '' }));
  const delegated = [...signed.matchAll(/^- Owner \(delegated, not reviewed\): ([^\n,]+), (\d{4}-\d{2}-\d{2}) — see (\S.*)$/gm)].map((m) => ({ name: m[1], date: m[2], delegated: true, authority: m[3].trim() }));
  const all = [...reviewed, ...delegated];
  return all.length === 1 && validDate(all[0].date) ? all[0] : null;
}
// A trace for every removed line (3.7): an open backlog line (matched by ID) or wish line (matched verbatim) removed between
// two states of the ledger leaves a trajectory line, the line moved verbatim, a new decision entry naming it, or a sentence
// in the commit body; a bare mention of an ID is not a trace. Warnings, never failures; the writer answers each flag.
export function removedLineFlags(before, after, message = '') {
  const flags = [];
  const items = (t) => new Map([...active(t).matchAll(new RegExp(`^- \\[( |~|!)\\] (${ID}) — (.+)$`, 'gm'))].map((m) => [m[2], m[0]]));
  const wishes = (t) => active(t).split('\n').filter((l) => /^- \S/.test(l));
  const idea = (l) => l.replace(/\s+— \(from: [^)]*\)\s*$/, '').replace(/^- /, '').trim();
  const movedLines = new Set(['backlog', 'wish'].flatMap((k) => active(after[k] || '').split('\n').map((l) => l.trim()))); // a line moved verbatim is a whole line
  const oldHeads = new Set(decisionEntries(before.decisions || '').map((e) => e.head));
  const newEntries = decisionEntries(after.decisions || '').filter((e) => !oldHeads.has(e.head)); // a decision naming it as superseded or retired, with the reason
  const body = message.split('\n').slice(1); // the commit body, never the title
  const idRe = (id) => new RegExp(`(^|[^A-Z0-9-])${id}([^A-Z0-9-]|$)`);
  const DISPOSED = /\b(superseded?|supersedes|retired?|retires|withdrawn|withdraws|dropped|drops|cancelled|closed|merged|folded|absorbed|replaced|shipped|done|delivered|promoted|paid|obsolete|duplicate)\b/i;
  const disposition = (text, test) => test(text) && DISPOSED.test(text) && text.trim().split(/\s+/).length >= 5; // the form a tool can see: the line, a disposition word and a reason; the writer still judges
  const sentence = (test) => body.some((l) => disposition(l, test));
  const afterItems = items(after.backlog || '');
  for (const [id, line] of items(before.backlog || '')) {
    if (afterItems.has(id)) continue;
    const traced = new RegExp(`^- ${id} — .+ — see decisions$`, 'm').test(active(after.trajectory || '')) || movedLines.has(line.trim())
      || newEntries.some((e) => disposition(`${e.title} ${e.decision}`, (t) => idRe(id).test(t))) || sentence((l) => idRe(id).test(l));
    if (!traced) flags.push(`removed without a trace: backlog ${id} — a trace is its trajectory line, the line moved verbatim to the backlog or wish-list, a decision naming it superseded or retired with the reason, or a sentence in the commit body giving the reason; a bare mention of the ID is not a trace (3.7)`);
  }
  const afterWishes = new Set(wishes(after.wish || '').map(idea));
  for (const line of wishes(before.wish || '')) {
    const text = idea(line);
    const promoted = new RegExp(`^- \\[( |~|!)\\] ${ID} — ${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — since `, 'm').test(active(after.backlog || '')); // the plan verb's promotion: the idea becomes the item's title
    if (afterWishes.has(text) || movedLines.has(line.trim()) || promoted || newEntries.some((e) => disposition(`${e.title} ${e.decision}`, (t) => t.includes(text))) || sentence((l) => l.includes(text) && l.trim() !== text)) continue;
    flags.push(`removed without a trace: wish line "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}" — a trace is the line moved verbatim to the backlog or wish-list, a decision naming it superseded or retired with the reason, or a sentence in the commit body giving the reason; a bare mention is not a trace (3.7)`);
  }
  return flags;
}
export function inspect(root, { auditProse = false } = {}) {
  const fails = [], warns = [], info = [];
  const fail = (m) => fails.push(m), warn = (m) => warns.push(m);
  const P = (p) => join(root, 'project', p);
  const read = (p, required = false) => {
    try { return readFileSync(p, 'utf8'); }
    catch (e) { if (required || e.code !== 'ENOENT') fail(`${relative(root, p)}: ${e.code}`); return ''; }
  };
  const files = Object.fromEntries(['profile', 'brief', 'rules', 'backlog', 'decisions', 'trajectory', 'wish-list'].map((n) => [n, read(P(n + '.md'), true)]));
  const { profile, rules, backlog, trajectory } = files;
  const today = new Date().toISOString().slice(0, 10);
  // Budgets: the profile's Budget line names the total and the per-file hard budgets (3.4).
  const budgets = { ...DEFAULT_BUDGETS };
  const budgetLine = field(profile, 'Budget');
  if (!budgetLine) fail('project/profile.md: needs a Budget line (3.4)');
  else {
    const take = (key, re) => { // one complete number per name: digits with optional thousands commas, ending at a separator
      const all = [...budgetLine.matchAll(new RegExp(re.source + '(?=[,;.]?(?:\\s|$))', re.flags.replace('g', '') + 'g'))];
      if (all.length !== 1) return false;
      budgets[key] = Number(all[0][1].replace(/,/g, '')); return true;
    };
    const N = '(\\d{1,3}(?:,\\d{3})+|\\d+)'; // one complete number, with or without thousands commas
    const found = [take('total', new RegExp(`total ${N}`)), take('contract', new RegExp(`contract ${N}`)), take('profile', new RegExp(`profile ${N}`)), take('rules', new RegExp(`rules ${N}`)),
      take('direction', new RegExp(`Direction ${N}`, 'i')), take('backlog', new RegExp(`backlog ${N}`)), take('slice', new RegExp(`decisions slice ${N}`)), take('trajectory', new RegExp(`trajectory(?: item lines)? ${N}`))];
    if (found.some((ok) => !ok) || Object.values(budgets).some((n) => !Number.isInteger(n) || n <= 0)) fail('project/profile.md: the Budget line must state the total and every per-file hard budget — contract, profile, rules, Direction, backlog, decisions slice, trajectory (3.4)');
  }
  const signatures = [];
  for (const n of ['profile', 'brief', 'rules']) {
    const s = active(files[n]), sig = signature(s);
    if (!sig) fail(`project/${n}.md: needs one visible dated owner signature in ## Signed, reviewed or delegated with its authority (shape only)`);
    else signatures.push({ file: `project/${n}.md`, ...sig });
    if (/\{[^}\n]+\}/.test(s)) fail(`project/${n}.md: unresolved template placeholder`);
    for (const m of s.matchAll(/until: (\d{4}-\d{2}-\d{2})/g)) {
      if (!validDate(m[1])) fail(`project/${n}.md: invalid until: date ${m[1]}`);
      else if (m[1] < today) warn(`project/${n}.md: until: ${m[1]} has passed; retire or ratify the constraint by a decision (3.8)`);
    }
  }
  const counts = { contract: 0, profile: words(profile), rules: words(rules), direction: 0, backlog: words(backlog), slice: 0, trajectory: 0 };
  const ESCALATION = 'move detail into item files, the Rationale or the archive; shorten a Decision line written this session or supersede an earlier entry; never delete a line without a trace or edit a past entry; a budget the project cannot meet is raised by the owner\'s recorded decision';
  const over = (key, label, count) => { if (count > budgets[key]) fail(`${label}: ${count} words, hard budget ${budgets[key]} (3.4) — ${ESCALATION}`); };
  over('profile', 'project/profile.md', counts.profile);
  over('backlog', 'project/backlog.md', counts.backlog);
  if (!/^`[^`]+`(?: — .+)?$/.test(field(profile, 'Gate'))) fail('project/profile.md: needs a Gate command in backticks');
  if (!field(profile, 'Harness')) fail('project/profile.md: needs a Harness line');
  if (/claude/i.test(field(profile, 'Harness')) && /codex/i.test(field(profile, 'Harness')) && !field(profile, 'Handoff')) fail('project/profile.md: two harnesses need a Handoff line');
  if (!pushRoute(field(profile, 'Push'))) fail('project/profile.md: the Push line must say that the harness pushes to the project\'s origin or to a named host, or that it is owner-operated (3.5)');
  if (!networkChoice(field(profile, 'Network'))) fail('project/profile.md: the Network line must be closed, listed hosts with at least one host name, or open (3.5)');
  const secrets = field(profile, 'Secrets');
  if (!secrets || /\{[^}]*\}/.test(secrets) || /placeholder/i.test(secrets)) fail('project/profile.md: the Secrets line is a required choice; "none held" is allowed, a placeholder is not (3.8)');
  const sessionLines = fieldLines(profile, 'Session');
  const session = sessionLines.length === 1 ? sessionLines[0].match(SESSION_LINE) : null;
  if (!session) fail(`project/profile.md: needs exactly one Session line, "- Session: <N>k tokens of context" with a positive whole number of thousands (3.15)${sessionLines.length > 1 ? '; found ' + sessionLines.length : ''}`);
  // The brief: Direction is rule 1's read (3.2); the rest is read at kick-off, after amendments, in the plan verb and on demand.
  const briefSections = sections(files.brief), direction = briefSections.get('Direction') || '';
  if (!direction) fail('project/brief.md: needs a non-empty ## Direction section (3.2)');
  counts.direction = words(direction);
  over('direction', 'project/brief.md ## Direction', counts.direction);
  const briefWords = words(files.brief);
  if (briefWords > BRIEF_GUIDELINE) warn(`project/brief.md: ${briefWords} words, guideline ${BRIEF_GUIDELINE} (read whole at kick-off and in the plan verb)`);
  // The rules file (3.1): Always, By task, Signed; routed files exist; budgets reported.
  const rulesSections = sections(rules), routed = [];
  for (const h of ['Always', 'By task', 'Signed']) if (!rulesSections.has(h)) fail(`project/rules.md: missing ## ${h} (3.1)`);
  over('rules', 'project/rules.md', counts.rules);
  const always = words(rulesSections.get('Always') || '');
  if (always > RULES_ALWAYS_GUIDELINE) warn(`project/rules.md: Always ${always} words, guideline ${RULES_ALWAYS_GUIDELINE} within the file's hard budget`);
  for (const row of (rulesSections.get('By task') || '').split('\n').filter((l) => /^\|/.test(l)).slice(2)) {
    const cells = row.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) { fail(`project/rules.md: By-task row needs task type, document and budget: ${row}`); continue; }
    const [task, doc, budget] = cells, path = doc.replace(/^`|`$/g, '');
    const budgetN = Number(String(budget).replace(/,/g, ''));
    const abs = resolve(root, path);
    if (relative(root, abs).startsWith('..') || !existsSync(abs)) { fail(`project/rules.md: routed document missing: ${path} (${task})`); continue; }
    if (!Number.isInteger(budgetN) || budgetN <= 0) fail(`project/rules.md: routed document needs a word budget: ${path}`);
    let count; try { count = words(readFileSync(abs, 'utf8')); } catch { fail(`project/rules.md: routed document cannot be read as a file: ${path} (${task})`); continue; }
    if (budgetN && count > budgetN) warn(`project/rules.md: routed ${path} is ${count} words, stated budget ${budgetN} (${task})`);
    routed.push({ task, path, words: count, budget: budgetN || 0 });
  }

  const milestones = [], open = new Map(); let ms, ph;
  const itemRe = new RegExp(`^- \\[( |~|!)\\] (${ID}) — (.+?) — since (${DATE})(?: — \\(from: (${ID}), (${DATE})\\))?(?: — blocked: (.+))?$`);
  for (const [lineIndex, line] of active(backlog).split('\n').entries()) {
    const loc = `project/backlog.md:${lineIndex + 1}`;
    let m;
    if ((m = line.match(/^## (.+)$/))) {
      if (!['Current', 'Next', 'Icebox'].includes(m[1]) || milestones.some((s) => s.name === m[1])) fail(`${loc}: unknown or duplicate milestone ${m[1]}`);
      ms = { name: m[1], phases: [] }; milestones.push(ms); ph = null;
    } else if ((m = line.match(/^### (.+)$/))) {
      if (!ms) fail(`${loc}: phase outside milestone`);
      ph = { name: m[1], items: [] }; ms?.phases.push(ph);
    } else if (/^\s*[-*+] /.test(line)) {
      m = line.match(itemRe);
      if (!m) { fail(`${loc}: backlog line does not parse: ${line}`); continue; }
      if (!ms) { fail(`${loc}: item outside milestone`); continue; }
      if (!validDate(m[4]) || (m[6] && !validDate(m[6]))) fail(`${loc}: invalid date`);
      if (/— since |— \(from:/.test(m[3])) fail(`${loc}: repeated item metadata`);
      if (open.has(m[2])) fail(`${loc}: duplicate ID ${m[2]}`);
      if (/ — CLOSED /.test(ph?.name || '')) fail(`${loc}: open item in a closed phase`);
      if (!ph) { ph = { name: '', items: [] }; ms.phases.push(ph); }
      const item = { mark: m[1], id: m[2], title: m[3], since: m[4], from: m[5] ? `${m[5]}, ${m[6]}` : '', blocked: m[7] || '', milestone: ms.name, phase: ph.name };
      open.set(item.id, item); ph.items.push(item);
    }
  }
  for (const h of ['Current', 'Next', 'Icebox']) if (!milestones.some((s) => s.name === h)) fail(`project/backlog.md: missing ## ${h}`);
  const shipped = new Map(), tphases = [], recalls = []; let tp;
  for (const line of active(trajectory).split('\n')) {
    let m;
    if ((m = line.match(/^## (.+)$/))) { tp = { name: m[1], lines: [] }; tphases.push(tp); }
    else if (/^\s*[-*+] /.test(line)) {
      if (!tp) fail('project/trajectory.md: line outside a phase');
      tp?.lines.push(line.slice(2));
      if (line.startsWith('- RECALL — ')) {
        m = line.match(new RegExp(`^- RECALL — ([0-8])/8 \\((${DATE})\\) — scores: ([012]),([012]),([012]),([012]) — (fresh|local) — see decisions$`));
        if (!m || !validDate(m[2]) || Number(m[1]) !== m.slice(3, 7).reduce((n, s) => n + Number(s), 0)) fail('project/trajectory.md: invalid recall date, component scores, total or mode');
        else recalls.push({ score: m[1], date: m[2], mode: m[7] });
        continue;
      }
      m = line.match(new RegExp(`^- (${ID}) — (.+) \\((${DATE})\\) — see decisions$`));
      if (!m || !validDate(m[3])) { fail(`project/trajectory.md: line does not parse: ${line}`); continue; }
      if (shipped.has(m[1])) fail(`project/trajectory.md: duplicate shipped ID ${m[1]}`);
      shipped.set(m[1], { id: m[1], outcome: m[2], date: m[3], phase: tp?.name });
      if (open.has(m[1])) fail(`drift: ${m[1]} is shipped but still open`);
    }
  }
  const trajectoryRead = trajectoryItemLines(tphases, budgets.trajectory);
  counts.trajectory = trajectoryRead.words;
  over('trajectory', `project/trajectory.md latest item lines (the last ${trajectoryRead.lines.length} shipped, never fewer than four)`, counts.trajectory);
  const live = decisionEntries(files.decisions, 'project/decisions.md', fail);
  for (let i = 1; i < live.length; i++) if (live[i].date > live[i - 1].date) fail('project/decisions.md: entries must be newest first');
  if (live.length > 45) warn(`project/decisions.md: ${live.length} live entries (budget 45); run tools/archive.mjs`);
  let inheritedHeads = new Set(); // the migration inventory names every entry that predates v3 (3.3); an unusable one fails, never silently exempts
  if (existsSync(P('migration/inventory.json'))) {
    let inv = null, text = '';
    try { text = readFileSync(P('migration/inventory.json'), 'utf8'); } catch { fail('project/migration/inventory.json: exists but cannot be read; the inherited-entry boundary cannot be read (3.3)'); }
    if (text) { try { inv = JSON.parse(text); } catch { fail('project/migration/inventory.json: not valid JSON; the inherited-entry boundary cannot be read (3.3)'); } }
    if (inv !== null) {
      const list = inv?.record?.decisions;
      if (!Array.isArray(list) || !list.every((d) => d && typeof d.head === 'string' && d.head)) fail('project/migration/inventory.json: record.decisions must be an array of entries with a heading; the inherited-entry boundary cannot be read (3.3)');
      else inheritedHeads = new Set(list.map((d) => d.head));
    }
  }
  const slice = decisionSlice(live, inheritedHeads);
  counts.slice = slice.words;
  over('slice', 'project/decisions.md latest ten (heading, Decision, Deferred)', counts.slice);
  const archives = [], all = [...live];
  if (existsSync(P('archive'))) for (const file of readdirSync(P('archive')).filter((n) => /^decisions-.*\.md$/.test(n)).sort()) {
    const text = read(P('archive/' + file)), entries = decisionEntries(text, 'project/archive/' + file, fail);
    if (!entries.length) fail(`project/archive/${file}: no decision entries`);
    archives.push({ file, entries, text }); all.push(...entries);
  }
  const index = active(read(P('archive/INDEX.md'), archives.length > 0)).split('\n').filter((l) => l.startsWith('- '));
  const expectedRows = archives.map((a) => archiveRow(a.file, a.entries));
  if (index.length !== expectedRows.length || expectedRows.some((row) => !index.includes(row))) fail('project/archive/INDEX.md: archive coverage, dates, counts or IDs differ; regenerate with tools/archive.mjs');
  const heads = new Set();
  for (const e of all) { if (heads.has(e.head)) fail(`graph: duplicate decision heading ${e.head}`); heads.add(e.head); }
  for (const e of all) {
    if (e.supersedes !== 'none' && (!heads.has(e.supersedes) || e.supersedes === e.head)) fail(`graph: ${e.head}: Supersedes must name an exact different live or archived heading`);
    if (e.deferred && e.deferred !== 'none') for (const id of e.deferred.split(/,\s*/)) {
      if (!new RegExp(`^${ID}$`).test(id) || (!open.has(id) && !shipped.has(id))) fail(`graph: ${e.head}: Deferred target ${id} is neither open nor shipped`);
    }
  }
  const byHead = new Map(all.map((e) => [e.head, e]));
  for (const e of all) {
    const seen = new Set([e.head]); let ref = e.supersedes;
    while (byHead.has(ref)) {
      if (seen.has(ref)) { fail(`graph: supersession cycle involving ${e.head}`); break; }
      seen.add(ref); ref = byHead.get(ref).supersedes;
    }
    if (e.items) {
      const ids = e.items.split(/,\s*/);
      if (new Set(ids).size !== ids.length || ids.some((id) => !new RegExp(`^${ID}$`).test(id) || (!open.has(id) && !shipped.has(id)))) fail(`graph: ${e.head}: Items must name unique open or shipped IDs`);
    }
  }
  for (const m of milestones) for (const phase of m.phases) {
    const closed = phase.name.match(new RegExp(`^Phase (\\d+) — .+ — CLOSED (${DATE})$`));
    if (!closed) continue;
    if (!validDate(closed[2])) fail(`backlog: invalid phase-close date ${closed[2]}`);
    const plan = all.find((e) => e.id === `PLAN-${closed[1]}` && e.items);
    if (!plan) fail(`backlog: closed Phase ${closed[1]} needs a PLAN-${closed[1]} Items list`);
    else for (const id of plan.items.split(/,\s*/)) if (!shipped.has(id)) fail(`backlog: closed Phase ${closed[1]} has unfinished planned item ${id}`);
  }
  const wish = active(files['wish-list']).split('\n').filter((l) => /^\s*[-*+] /.test(l));
  const origins = new Set([...open.values()].map((i) => i.from).filter(Boolean));
  for (const line of wish) {
    const m = line.match(new RegExp(`^- .+ — \\(from: (${ID}), (${DATE})\\)$`));
    if (!m || !validDate(m[2])) fail(`project/wish-list.md: line needs (from: ID, valid date): ${line}`);
    else origins.add(`${m[1]}, ${m[2]}`);
  }
  if (auditProse) {
    const defer = /\b(later item|separate item|deferred|parked|follow-up|revisit|after launch|next release)\b/i;
    for (const e of live) if (!e.deferred && defer.test(e.decision + ' ' + e.rationale) && !origins.has(`${e.id}, ${e.date}`)) info.push(`REVIEW ${e.id}: possible uncaptured or already fulfilled deferral; semantic review only`);
    info.push('Prose scan is incomplete and can be wrong; review trajectory and commits for uncaptured or fulfilled work too.');
  }

  const digests = [];
  for (const slug of new Set([...active(profile).matchAll(/digest: ([a-z0-9][a-z0-9.-]*)/g)].map((m) => m[1]))) {
    const file = slug + '.md', t = read(P('digests/' + file), true);
    const fm = t.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    const get = (k) => (fm?.[1].match(new RegExp(`^${k}: (.+)$`, 'm')) || [])[1] || '';
    if (!fm) fail(`project/digests/${file}: no header`);
    for (const k of ['standard', 'source', 'version', 'retrieved', 'next-check', 'licence']) if (!get(k)) fail(`project/digests/${file}: missing ${k}`);
    if (!validDate(get('retrieved')) || !validDate(get('next-check')) || get('next-check') < get('retrieved')) fail(`project/digests/${file}: invalid or reversed review dates`);
    else if (get('next-check') < today) warn(`project/digests/${file}: next-check ${get('next-check')} has passed`);
    for (const h of ['Rules that bite here', 'Checklist by task type', 'Exceptions recorded', 'Deeper references']) if (!sections(t).get(h)) fail(`project/digests/${file}: missing or empty ## ${h}`);
    const source = get('source').split(/\s+/)[0], house = !/^https?:\/\//.test(source);
    if (house && (relative(root, resolve(root, source)).startsWith('..') || !existsSync(resolve(root, source)))) fail(`project/digests/${file}: source must be an HTTP(S) URL or, for a house digest, a repository path that exists`);
    digests.push({ file, standard: get('standard'), version: get('version'), retrieved: get('retrieved'), next: get('next-check'), source, house });
  }
  const items = new Map();
  if (existsSync(P('items'))) for (const f of readdirSync(P('items')).filter((n) => n.endsWith('.md') && !n.startsWith('_'))) {
    const id = f.slice(0, -3), text = active(read(P('items/' + f))), heads = [...text.matchAll(/^# (.+)$/gm)];
    if (!new RegExp(`^${ID}$`).test(id) || heads.length !== 1 || !heads[0]?.[1].startsWith(id + ' — ')) fail(`project/items/${f}: needs one heading matching the filename ID`);
    const s = sections(text);
    for (const h of ['Intent', 'Acceptance criteria', 'Context and sources']) if (!s.get(h)) fail(`project/items/${f}: missing or empty ## ${h}`);
    const criteria = (s.get('Acceptance criteria') || '').split('\n').filter((l) => /^- \S/.test(l)).map((l) => l.slice(2));
    if (!criteria.length) fail(`project/items/${f}: no acceptance criteria`);
    if (!open.has(id) && !shipped.has(id)) warn(`project/items/${f}: orphan; neither open nor shipped`);
    if (/^status:/m.test(text)) fail(`project/items/${f}: status belongs only in backlog`);
    for (const m of text.matchAll(/`((?:[A-Za-z0-9_.-]+\/)+[^`]+)`/g)) {
      const path = resolve(root, m[1]);
      if (relative(root, path).startsWith('..') || !existsSync(path)) warn(`project/items/${f}: local path missing or outside repository: ${m[1]}`);
    }
    items.set(id, { intent: s.get('Intent'), criteria, words: words(text) });
  }
  const structure = active(read(P('structure.md')));
  if (/\{what lives here/.test(structure)) warn('project/structure.md: directory roles need filling');
  for (const m of structure.matchAll(/`([^`]+)`/g)) if (!existsSync(resolve(root, m[1]))) warn(`project/structure.md: missing path ${m[1]}`);
  const contract = read(join(root, 'AGENTS.md'), true);
  const ruleNumbers = [...active(contract).matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  if (ruleNumbers.length !== 12 || ruleNumbers.some((n, i) => n !== i + 1)) fail('AGENTS.md: expected twelve consecutively numbered rules; a budget change needs owner evidence and a checker update');
  counts.contract = words(contract);
  over('contract', 'AGENTS.md', counts.contract);
  const hotWords = counts.contract + counts.profile + counts.rules + counts.direction + counts.backlog + counts.slice + counts.trajectory;
  if (hotWords > budgets.total) fail(`read estimate ${hotWords} words exceeds the total budget ${budgets.total} (3.4) — ${ESCALATION}`);
  info.push(`${open.size} open, ${shipped.size} shipped, ${live.length} live decisions, ${all.length - live.length} archived, ${digests.length} adopted digests`);
  const inherited = slice.entries.filter((e) => e.inherited).length;
  info.push(`read estimate: ${hotWords} whitespace words of ${budgets.total} (contract ${counts.contract}, profile ${counts.profile}, rules ${counts.rules}, Direction ${counts.direction}, backlog ${counts.backlog}, decisions slice ${counts.slice} — ${slice.entries.length - inherited} entries as heading, Decision and Deferred${inherited ? `, ${inherited} inherited as heading and Deferred` : ''}, trajectory ${trajectoryRead.lines.length} item lines ${counts.trajectory}; the base set by the 3.4 rule, not tokens or observed reads)`);
  const openItemWords = [...open.keys()].filter((id) => items.has(id)).reduce((n, id) => n + items.get(id).words, 0);
  info.push(`conditional reads, not counted: the full brief ${briefWords - counts.direction} words beyond Direction; ${[...open.keys()].filter((id) => items.has(id)).length} open item files, ${openItemWords} words; Rationale bodies on demand`);
  for (const r of routed) info.push(`routed read, ${r.task}: ${r.path} (${r.words} words${r.budget ? `, budget ${r.budget}` : ''}); mandatory when that task type fires, reported apart from the base set`);
  const needsOwner = [...open.values()].filter((i) => i.mark === '!');
  if (needsOwner.length) info.push(`needs the owner: ${needsOwner.map((i) => i.id).join(', ')} (already recorded)`);
  const delegated = signatures.filter((s) => s.delegated);
  if (delegated.length) info.push(`delegated signatures needing the owner's review: ${delegated.map((s) => s.file).join(', ')}`);
  return { fails, warns, info, files, milestones, open, shipped, decisions: live, slice, archives, wish: wish.map((s) => s.slice(2)), tphases, trajectoryRead, recall: recalls.sort((a, b) => b.date.localeCompare(a.date))[0], digests, items, hotWords, counts, budgets, routed, signatures, session: session ? Number(session[1]) * 1000 : 0 };
}
