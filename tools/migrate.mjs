#!/usr/bin/env node
// pm-next-v3 migrate tool (specification 3.10, 8): the snapshot, the preservation inventory, the census skeleton, the
// checks after the migration and after a rollback, and the printed rollback. It never performs the migration's edits and
// never performs the rollback: a session does both, following the migration note in CHANGELOG.md. Self-contained on
// purpose — after `git revert <migration>` the tree is v2's again, so a copy of this file taken from the migration commit
// with `git show` must run alone. The snapshot is the commit: Git holds the bytes, the inventory holds their hashes and
// the record's substance. What it checks is that the record was kept, in the forms a tool can compare; whether an
// obligation kept its force, or a re-applied edit its behaviour, is the session's reading. Zero dependencies.
// usage: node tools/migrate.mjs [--root <dir>] --snapshot [--base <pristine v2 dir>] [--rules <path,...>]
//        node tools/migrate.mjs [--root <dir>] --verify [--commit <rev>]          after the migration commit
//        node tools/migrate.mjs [--root <dir>] --verify --rolled-back [--commit <rev>]   after the revert
//        node tools/migrate.mjs [--root <dir>] --rollback [--commit <rev>]        prints the steps; performs nothing
import { readFileSync, writeFileSync, existsSync, mkdirSync, lstatSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ID = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*', DATE = '\\d{4}-\\d{2}-\\d{2}';
const INVENTORY = 'project/migration/inventory.json', CENSUS = 'project/migration/census.md';
const REPLACED = /^(AGENTS\.md|CLAUDE\.md|tools\/.+|verbs\/.+)$/; // replaced as a reviewed set; a local edit lives here, at any depth
const SETTINGS = /^(\.claude|\.codex|harness)\//; // locally verified harness settings, tracked or ignored: kept, never written over
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EDIT = (p) => new RegExp(`^- Migration edit: ${esc(p)} — (re-applied|retired) — \\S.+$`, 'm'); // the disposition line, its why mandatory
const blank = (m) => m.replace(/[^\n]/g, '');
const active = (s) => s.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, blank)
  .replace(/^([ \t]*)(`{3,})[^\n]*\n[\s\S]*?^\1\2`*[ \t]*$/gm, blank).replace(/^([ \t]*)(~{3,})[^\n]*\n[\s\S]*?^\1\2~*[ \t]*$/gm, blank);
const section = (s, name) => { // boundaries found on the active text (a heading inside a fence is not one); the raw lines between them returned, fences and comments included
  const raw = s.replace(/\r\n/g, '\n').split('\n'), act = active(s).split('\n'), start = act.findIndex((l) => l === `## ${name}`);
  if (start < 0) return '';
  let end = act.findIndex((l, i) => i > start && /^## /.test(l)); if (end < 0) end = act.length;
  return raw.slice(start + 1, end).join('\n').trim();
};
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const utf8 = new TextDecoder('utf-8', { fatal: true });
const fails = [], warns = [], notes = [];

// ---- options: flags only
const args = { root: process.cwd() };
for (let i = 2; i < process.argv.length; i++) {
  const name = process.argv[i].replace(/^--/, '');
  if (!process.argv[i].startsWith('--') || !['root', 'snapshot', 'verify', 'rolled-back', 'rollback', 'base', 'rules', 'commit'].includes(name)) { console.error(`migrate: unknown option ${process.argv[i]}`); process.exit(2); }
  if (['snapshot', 'verify', 'rolled-back', 'rollback'].includes(name)) args[name] = true;
  else { const v = process.argv[++i]; if (!v || v.startsWith('--')) { console.error(`migrate: --${name} requires a value`); process.exit(2); } args[name] = v; }
}
const root = resolve(args.root);
if ([args.snapshot, args.verify, args.rollback].filter(Boolean).length !== 1) { console.error('migrate: one of --snapshot, --verify or --rollback'); process.exit(2); }
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).trim();
const read = (p) => { try { return utf8.decode(readFileSync(join(root, p))); } catch (e) { if (e.code === 'ENOENT') return ''; fails.push(`${p}: not readable as UTF-8 text`); return ''; } };
const prefix = git('rev-parse', '--show-prefix'); // the installation may sit below the repository root
const top = git('rev-parse', '--show-toplevel');
const self = relative(top, fileURLToPath(import.meta.url)).split('\\').join('/'); // the executing file, not an adapter that imported it
const show = (rev, p) => { try { return execFileSync('git', ['show', `${rev}:${prefix}${p}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch { return null; } };
const tracked = () => git('ls-files', '-z').split('\0').filter(Boolean).sort(); // relative to the installation
const lines = (t) => t.replace(/\r\n/g, '\n').split('\n');

// ---- the record's substance (3.10, 8): what the migration keeps, in the forms a tool can compare
function record(files) {
  const all = (t, re) => [...active(t).matchAll(re)];
  const open = all(read('project/backlog.md'), new RegExp(`^- \\[( |~|!)\\] (${ID}) — .+? — since (${DATE})(?: — \\(from: (${ID}, ${DATE})\\))?(?: — blocked: (.+))?$`, 'gm'))
    .map((m) => ({ id: m[2], mark: m[1], since: m[3], from: m[4] || '', blocked: m[5] || '' })); // the title may be trimmed; mark, date, provenance and the blocker stay
  const shipped = all(read('project/trajectory.md'), new RegExp(`^- (?:${ID}|RECALL) — .+$`, 'gm')).map((m) => m[0]); // shipped and RECALL lines, verbatim
  const entries = (t) => t.replace(/\r\n/g, '\n').split(/^(?=## )/m).filter((b) => new RegExp(`^## ${DATE} — ${ID} — `).test(b)).map((b) => b.trim());
  const archived = existsSync(join(root, 'project/archive')) ? readdirSync(join(root, 'project/archive')).filter((n) => /^decisions-.*\.md$/.test(n)).sort().map((n) => `project/archive/${n}`) : []; // on disk: a verbatim move may be uncommitted at verify time
  const decisions = [...entries(read('project/decisions.md')), ...archived.flatMap((f) => entries(read(f)))]
    .map((b) => ({ head: b.split('\n')[0].slice(3), sha256: sha(b) })); // a past entry is never edited: its raw text is hashed, fences included
  const wishes = all(read('project/wish-list.md'), /^- (\S.*)$/gm).map((m) => m[1]); // verbatim, provenance included
  const hashed = (re) => Object.fromEntries(files.filter((f) => typeof re === 'function' ? re(f) : re.test(f)).map((f) => [f, sha(readFileSync(join(root, f)))]));
  const items = Object.fromEntries(files.filter((f) => /^project\/items\/[^_][^/]*\.md$/.test(f)).map((f) => [f, sha(section(read(f), 'Acceptance criteria'))]));
  const signatures = Object.fromEntries(['project/profile.md', 'project/brief.md'].map((f) => [f, (section(read(f), 'Signed').match(/^- Owner.*$/m) || [''])[0]]));
  const REWRITTEN = /^project\/(profile|brief|backlog|decisions|trajectory|wish-list|structure)\.md$|^project\/items\//; // compared by substance above; every other project file byte for byte
  return { open, shipped, decisions, wishes, items, digests: hashed(/^project\/digests\/[^_][^/]*\.md$/), archive: hashed(/^project\/archive\//), project: files.filter((f) => f.startsWith('project/')), kept: hashed((f) => f.startsWith('project/') && !REWRITTEN.test(f)), signatures };
}
// ---- the census skeleton (8): one row per obligation-shaped unit — a list item with its continuation lines, a numbered
// rule, a table body row, a prose paragraph, a heading, a fenced block — of the installed contract, profile and brief and
// of every named rules home; the session fills the rest and closes the source list.
const plain = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '').replace(/</g, '‹').replace(/>/g, '›'); // an excerpt carries no link, code span or tag: the census is read where it is, not followed
function censusRows(sources) {
  const rows = [];
  for (const file of sources) {
    const text = read(file); if (!text) { fails.push(`census source missing: ${file}`); continue; }
    let para = null, table = 0; // table: 0 outside, 1 at the header row, 2 past the separator
    const flush = () => { if (para) { rows.push({ source: `${file}:${para.line}`, text: plain(para.words.slice(0, 14).join(' ')) + (para.words.length > 14 ? ' …' : '') }); para = null; } };
    const raw = text.replace(/\r\n/g, '\n').split('\n');
    active(text).split('\n').forEach((line, i) => {
      if (/^([ \t]*)(`{3,}|~{3,})/.test(raw[i]) && !line.trim()) { // a fenced block, blanked by active(): one row from its opening line, since a command can be an obligation
        if (!para?.fence) { flush(); para = { line: i + 1, words: ['fenced', 'block:', ...(raw[i + 1] || '').trim().split(/\s+/)], fence: true }; } else flush(); return;
      }
      if (para?.fence) return; // inside the fence
      if (/^\|/.test(line)) { flush(); if (table === 0) { table = 1; return; } if (table === 1 && /^\|[\s|:-]*$/.test(line)) { table = 2; return; } }
      else table = 0;
      if (/^\s*(?:[-*+] |\d+\. )\S/.test(line) || table === 2) { flush(); para = { line: i + 1, words: line.replace(/^\s*(?:[-*+] |\d+\. |\| ?)/, '').trim().split(/\s+/), item: true }; }
      else if (/^#/.test(line)) { flush(); para = { line: i + 1, words: ['heading:', ...line.replace(/^#+\s*/, '').trim().split(/\s+/)] }; flush(); } // a heading is a row: a rule can be one
      else if (/^\s*$/.test(line)) flush();
      else if (/^\s+\S/.test(line) && para?.item) para.words.push(...line.trim().split(/\s+/)); // a list item's continuation belongs to its row
      else { if (!para || para.item) { flush(); para = { line: i + 1, words: [] }; } para.words.push(...line.trim().split(/\s+/)); }
    });
    flush();
  }
  return rows;
}
const censusTable = (rows, sources) => `# Migration census\n\nEvery obligation-shaped unit of the pre-migration rulebooks (${sources.join(', ')}), one row each (specification 8): a list item with its continuation lines, a numbered rule, a table body row, a prose paragraph, a heading, a fenced block. A row holding more than one obligation names every destination. Fill Destination — where v3 holds it: rules Always; rules By task → path; profile; Direction; a digest; a decision; an item; or retired by a decision — and Applicability: always; by task: type; migration-only until: date or event; or n/a: why (descriptive, not an obligation). The verify step fails on any row left empty, deleted or altered in its first three cells. The table shows where each obligation of these sources went; closing the source list and reading each destination in context are the session's, stated in the MIGRATE decision.\n\n| Row | Source | Obligation | Destination | Applicability |\n| --- | --- | --- | --- | --- |\n${rows.map((r, i) => `| C${i + 1} | ${r.source} | ${r.text.replace(/\|/g, '\\|')} | | |`).join('\n')}\n`;
const censusParse = (text) => [...active(text).matchAll(/^\| (C\d+) \|([^|]*)\|((?:[^|\\]|\\\|)*)\|([^|]*)\|([^|]*)\|$/gm)].map((m) => ({ row: m[1], source: m[2].trim(), text: m[3].trim().replace(/\\\|/g, '|'), destination: m[4].trim(), applicability: m[5].trim() }));

if (args.snapshot) {
  if (git('status', '--porcelain', '--', '.')) { console.error('migrate: the installation has uncommitted changes; the snapshot is the commit, so commit or discard them first'); process.exit(1); }
  if (existsSync(join(root, 'project/rules.md'))) warns.push('project/rules.md already exists; is this a v2 installation?');
  if (existsSync(join(root, INVENTORY))) { console.error(`migrate: ${INVENTORY} exists; a second snapshot would hide the first — before migrating, delete project/migration/ and run the snapshot again; after migrating, there is no second snapshot`); process.exit(1); }
  if (self.startsWith('..')) { console.error(`migrate: this copy of the tool (${self}) lies outside the repository, so the rollback could not recover it with git show; copy v3's tools/migrate.mjs into the installation's tools/ and commit it alone first, or run v3's copy from inside the repository`); process.exit(1); }
  const files = tracked().map((p) => {
    if (lstatSync(join(root, p)).isSymbolicLink()) { fails.push(`${p}: a tracked symbolic link; the snapshot hashes files only — resolve it before migrating`); return { path: p, sha256: '', bytes: 0 }; }
    const buf = readFileSync(join(root, p));
    if (/\.(md|json|toml|mjs|txt)$/.test(p)) { try { utf8.decode(buf); } catch { fails.push(`${p}: not UTF-8 text; a text file of the installation must be, since the record is compared as text — fix its encoding before migrating`); } }
    return { path: p, sha256: sha(buf), bytes: buf.length };
  });
  const local = git('ls-files', '-z', '--others', '--exclude-standard', '--ignored').split('\0').filter((p) => p && SETTINGS.test(p)).sort()
    .map((p) => ({ path: p, sha256: sha(readFileSync(join(root, p))) })); // ignored settings are outside the commit: hashed here, kept by hand, their loss a failure
  const localEdits = files.filter((f) => REPLACED.test(f.path)).map((f) => {
    if (!args.base) return { path: f.path, status: 'unverified' }; // no pristine copy named: every replaced file needs a disposition
    const base = join(resolve(args.base), f.path);
    return { path: f.path, status: !existsSync(base) ? 'added' : sha(readFileSync(base)) === f.sha256 ? 'identical' : 'edited' };
  });
  if (fails.length) { for (const m of fails) console.log(`FAIL  ${m}`); console.log(`migrate: ${fails.length} failure(s); nothing written`); process.exit(1); } // before the record is read: a symbolic link or a bad encoding stops here
  const rulesHome = (args.rules || '').split(',').map((s) => s.trim()).filter(Boolean);
  const sources = ['AGENTS.md', 'project/profile.md', 'project/brief.md', ...rulesHome], rows = censusRows(sources);
  const rec = record(files.map((f) => f.path));
  if (fails.length) { for (const m of fails) console.log(`FAIL  ${m}`); console.log(`migrate: ${fails.length} failure(s); nothing written`); process.exit(1); }
  mkdirSync(join(root, 'project/migration'), { recursive: true });
  if (existsSync(join(root, CENSUS))) notes.push(`${CENSUS} exists and was kept; delete it to regenerate`); else writeFileSync(join(root, CENSUS), censusTable(rows, sources));
  const inventory = { schemaVersion: 3, tool: 'pm-next-v3 tools/migrate.mjs', runner: self, from: 'v2', date: new Date().toISOString().slice(0, 10), sourceCommit: git('rev-parse', 'HEAD'), prefix, files, local, localEdits, rulesHome, census: { file: CENSUS, sources, rows }, record: rec };
  writeFileSync(join(root, INVENTORY), JSON.stringify(inventory, null, 2) + '\n');
  const dispose = localEdits.filter((e) => e.status !== 'identical');
  notes.push(`snapshot at ${inventory.sourceCommit.slice(0, 7)}: ${files.length} tracked files${local.length ? `, ${local.length} ignored settings files hashed (outside the commit: keep them by hand)` : ''}; ${rec.open.length} open and ${rec.shipped.length} shipped lines, ${rec.decisions.length} decision entries, ${rec.wishes.length} wish lines, ${Object.keys(rec.items).length} item files, ${Object.keys(rec.digests).length} digests, ${Object.keys(rec.archive).length} archive files, ${rec.project.length} files under project/`);
  notes.push(`${dispose.length} replaced files to dispose by a decision (${dispose.map((e) => `${e.path} ${e.status}`).join('; ') || 'none'}); census ${rows.length} rows from ${sources.length} sources in ${CENSUS}`);
  notes.push('next: migrate by the note, fill the census, commit alone as "MIGRATE: ...", then node tools/migrate.mjs --verify');
}

// ---- the migration commit: the first after the snapshot, within the installation, titled MIGRATE: — or --commit
const migrationCommit = (since) => args.commit ? git('rev-parse', '--verify', `${args.commit}^{commit}`)
  : git('log', '--reverse', '--format=%H%x09%s', `${since}..HEAD`, '--', '.').split('\n').map((l) => l.split('\t')).find(([, s]) => /^MIGRATE: /.test(s || ''))?.[0] || '';
function loadInventory() {
  const onDisk = read(INVENTORY);
  if (onDisk) return JSON.parse(onDisk);
  for (const rev of git('log', '--format=%H', '--', '.').split('\n').filter(Boolean)) { // the revert removed it: read it from history
    const buf = show(rev, INVENTORY); if (buf) { notes.push(`inventory read from commit ${rev.slice(0, 7)}`); return JSON.parse(buf.toString('utf8')); }
  }
  console.error(`migrate: no ${INVENTORY} on disk or in history; run --snapshot before migrating`); process.exit(1);
}

if (args.verify && !args['rolled-back']) {
  const inv = loadInventory(), now = record(tracked()), m = migrationCommit(inv.sourceCommit);
  const decisions = active(read('project/decisions.md'));
  const migrate = decisions.split(/^(?=## )/m).find((b) => new RegExp(`^## ${DATE} — MIGRATE — `).test(b)) || '';
  const since = migrate.match(new RegExp(DATE))?.[0] || '';
  if (!migrate) fails.push('project/decisions.md: no MIGRATE decision entry; the record of the migration needs one (3.10) — the inherited-entry boundary is the inventory, not this entry (3.3)');
  else if (!migrate.includes(CENSUS)) fails.push(`the MIGRATE decision must name ${CENSUS} and say that its sources were closed and every row reviewed in context (8)`);
  const openNow = new Map(now.open.map((o) => [o.id, o]));
  for (const o of inv.record.open) {
    const n = openNow.get(o.id);
    if (!n) { fails.push(now.shipped.some((l) => l.startsWith(`- ${o.id} — `)) ? `${o.id} closed into the trajectory in the migration; a migration commit carries no product work — close an item in its own commit (3.10)` : `open ID lost: ${o.id}`); continue; }
    if (n.mark !== o.mark || n.since !== o.since || n.from !== o.from || (o.blocked && !n.blocked)) fails.push(`backlog ${o.id}: mark, since date, provenance or blocker changed; the title may be trimmed, these stay`);
    else if (o.blocked && n.blocked !== o.blocked) warns.push(`backlog ${o.id}: the blocker reads "${n.blocked}" where it read "${o.blocked}"; a trim keeps its owner and condition`);
  }
  for (const l of inv.record.shipped) if (!now.shipped.includes(l)) fails.push(`trajectory line lost or changed: ${l.slice(0, 70)}`);
  const hashes = new Set(now.decisions.map((d) => d.sha256));
  for (const d of inv.record.decisions) if (!hashes.has(d.sha256)) fails.push(`decision entry lost or edited (archive verbatim, never edit): ${d.head}`);
  const backlog = active(read('project/backlog.md'));
  for (const w of inv.record.wishes) {
    const idea = w.replace(/\s+— \(from: [^)]*\)\s*$/, '');
    if (!now.wishes.includes(w) && !new RegExp(`^- \\[( |~|!)\\] ${ID} — ${esc(idea)} — since `, 'm').test(backlog)) fails.push(`wish line lost or changed (trim at the first close, not here): ${w.slice(0, 60)}${w.length > 60 ? '…' : ''}`);
  }
  for (const f of inv.record.project) if (!existsSync(join(root, f))) fails.push(`${f}: a populated project file is missing; the migration keeps every one (3.10)`);
  for (const [f, h] of Object.entries(inv.record.items)) if (existsSync(join(root, f)) && sha(section(read(f), 'Acceptance criteria')) !== h) fails.push(`item criteria changed: ${f}`);
  for (const [f, h] of Object.entries(inv.record.kept || {})) if (existsSync(join(root, f)) && sha(readFileSync(join(root, f))) !== h) fails.push(`${f}: a project file the migration does not rewrite changed; it is kept byte for byte (3.10)`);
  for (const [label, set] of [['a digest', inv.record.digests], ['an archive file', inv.record.archive]]) for (const [f, h] of Object.entries(set)) if (existsSync(join(root, f)) && sha(readFileSync(join(root, f))) !== h) fails.push(`${f}: ${label} is kept byte for byte`);
  for (const [f, line] of Object.entries(inv.record.signatures)) {
    const signed = section(read(f), 'Signed');
    if (!/^- Owner.*$/m.test(signed)) fails.push(`${f}: no owner signature line remains; a migrated file is re-signed by the owner, or delegated with its authority (3.8)`);
    else if (line && !signed.includes(line)) warns.push(`${f}: the signature line "${line}" was replaced; the owner re-signs a migrated file, or the replacement is delegated and cites its authority (3.8)`);
  }
  for (const f of [...inv.files.filter((x) => SETTINGS.test(x.path)), ...inv.local]) {
    if (!existsSync(join(root, f.path))) fails.push(`${f.path}: a locally verified harness setting is missing; the migration keeps it (3.10)`);
    else if (sha(readFileSync(join(root, f.path))) !== f.sha256) warns.push(`${f.path}: a locally verified harness setting changed; the note says never over local configuration — the owner's word, recorded`);
  }
  const blocks = decisions.split(/^(?=## )/m).filter((b) => (b.match(new RegExp(DATE))?.[0] || '') >= since);
  for (const e of inv.localEdits.filter((x) => x.status !== 'identical')) { // each re-applied or retired by a decision from the migration on, in one grammar, its why mandatory
    const line = blocks.map((b) => b.match(EDIT(e.path))?.[0]).find(Boolean);
    if (!line) fails.push(`${e.path} (${e.status}): no decision from the migration carries "- Migration edit: ${e.path} — re-applied | retired — <where or why>" (3.10)`);
    else if (/— re-applied —/.test(line) && !existsSync(join(root, e.path))) fails.push(`${e.path}: declared re-applied but absent; re-applied means the implementation is in the tree, retired means its removal is the decision (3.10)`);
  }
  const census = read(CENSUS);
  if (!census) fails.push(`${CENSUS} missing; the census is the migration's threshold (8)`);
  else {
    const byRow = new Map(censusParse(census).map((r) => [r.row, r]));
    for (const [i, r] of (inv.census.rows || []).entries()) {
      const n = byRow.get(`C${i + 1}`);
      if (!n || n.source !== r.source || n.text !== r.text) fails.push(`${CENSUS}: C${i + 1} (${r.source}) deleted or altered; rows keep their identity`);
      else if (!n.destination || !n.applicability) fails.push(`${CENSUS}: C${i + 1} has no destination or applicability; zero omitted is the threshold (8)`);
    }
  }
  if (!m) warns.push('no "MIGRATE: ..." commit found after the snapshot; the migration is a commit of its own with no product work (3.10)');
  else if (git('diff', '--name-only', `${m}^`, m).split('\n').some((p) => p && !p.startsWith(prefix) && p !== self)) warns.push(`${m.slice(0, 7)} touches files outside the installation; a migration commit carries no product work (3.10)`);
  else if (!prefix) notes.push('the installation is the repository, so nothing is outside it for the no-product-work check to see');
  const r = inv.record;
  notes.push(`verified against the snapshot at ${inv.sourceCommit.slice(0, 7)}${m ? `, migration commit ${m.slice(0, 7)}` : ''}: ${r.open.length} open and ${r.shipped.length} shipped lines, ${r.decisions.length} decision entries, ${r.wishes.length} wish lines, ${Object.keys(r.items).length} item files, ${Object.keys(r.digests).length} digests, ${Object.keys(r.archive).length} archive files, ${r.project.length} project files, ${inv.localEdits.filter((x) => x.status !== 'identical').length} replaced files disposed, ${(inv.census.rows || []).length} census rows`);
  notes.push('this checks that the record was kept, not that an obligation kept its force; then run node tools/check.mjs (v3); rollback steps: node tools/migrate.mjs --rollback');
}

if (args.verify && args['rolled-back']) {
  const inv = loadInventory(), m = migrationCommit(inv.sourceCommit);
  const revert = m ? git('log', '--format=%H', `${m}..HEAD`, '--grep', `This reverts commit ${m}`).split('\n')[0] : '';
  if (!revert) fails.push(m ? `no commit reverting ${m.slice(0, 7)} found; the rollback is git revert, never a reset (3.10)` : 'no "MIGRATE: ..." commit found after the snapshot');
  const L = revert ? `${revert}^` : '', later = new Map(); // every path later work touched, with git's status letter
  if (L) for (const l of git('diff', '--name-status', '--no-renames', m, L).split('\n').filter(Boolean)) { const [st, p] = l.split('\t'); if (p.startsWith(prefix)) later.set(p.slice(prefix.length), st[0]); } // no rename pairing: a deleted file and a new one with the same bytes are two events
  let same = 0;
  for (const f of inv.files) {
    const p = join(root, f.path);
    if (!existsSync(p)) { if (later.get(f.path) === 'D') warns.push(`${f.path}: later work deleted it and the revert keeps the deletion; confirm`); else fails.push(`${f.path}: missing after the rollback`); continue; }
    const restored = sha(readFileSync(p)) === f.sha256;
    if (restored) same++;
    if (!later.has(f.path)) { if (!restored) fails.push(`${f.path}: differs from the snapshot and no later commit touched it`); continue; }
    // later work touched a snapshot file: every original line it kept and every line it added must still be present (reconciled, never
    // discarded); the migration's own rewrites, present at M and absent at S, are what the revert removes; a line later work removed that is back is reported
    const count = (ls) => { const c = new Map(); for (const l of ls) if (l.trim()) c.set(l, (c.get(l) || 0) + 1); return c; }; // multiplicity counts; order is not compared
    const S = count(lines(show(inv.sourceCommit, f.path)?.toString('utf8') || '')), Mt = count(lines(show(m, f.path)?.toString('utf8') || '')), Lt = count(lines(show(L, f.path)?.toString('utf8') || '')), H = count(lines(readFileSync(p, 'utf8')));
    const short = (l) => `"${l.slice(0, 50)}${l.length > 50 ? '…' : ''}"`;
    // the revert of M on top of L leaves, for each line, L − (M − S) + (S − M) copies: fewer than L minus the migration's own additions is later work lost;
    // fewer than that expectation otherwise is a migration-rewritten line not restored; more, where later work had removed copies, is its deletion undone
    const keys = new Set([...S.keys(), ...Mt.keys(), ...Lt.keys(), ...H.keys()]), g = (c, l) => c.get(l) || 0;
    const lost = [], notBack = [], back = [];
    for (const l of keys) {
      const expected = Math.max(0, g(Lt, l) - g(Mt, l) + g(S, l)), floor = g(Lt, l) - Math.max(0, g(Mt, l) - g(S, l));
      if (g(H, l) < floor) lost.push(l); else if (g(H, l) < expected) notBack.push(l); else if (g(H, l) > expected && g(Lt, l) < g(Mt, l)) back.push(l);
    }
    const added = [...Lt].filter(([l, n]) => n > g(Mt, l)).length;
    if (notBack.length) fails.push(`${f.path}: ${notBack.length} original lines the migration changed are not back after the revert (${short(notBack[0])}); restore them, then reconcile later work`);
    if (lost.length) fails.push(`${f.path}: later work lost — ${lost.length} of its lines are gone or fewer (${short(lost[0])}); reconcile them, never discard`);
    if (back.length) fails.push(`${f.path}: ${back.length} lines later work had removed are back (${short(back[0])}); its deletions are later work too — remove them again or record why not`);
    if (!lost.length && !back.length && !notBack.length) warns.push(`${f.path}: ${restored ? 'equals the snapshot' : 'differs from the snapshot'} and carries later work (${added} lines it added present); review the reconciliation`);
  }
  for (const [p, st] of later) if (!inv.files.some((f) => f.path === p) && st !== 'D') { // files later work created
    if (!existsSync(join(root, p))) fails.push(`${p}: a file later work added is gone after the rollback`);
    else if (sha(readFileSync(join(root, p))) !== sha(show(L, p) || Buffer.alloc(0))) fails.push(`${p}: a file later work added differs from its later state; the revert does not touch it, so restore it`);
  }
  for (const f of inv.local) if (!existsSync(join(root, f.path)) || sha(readFileSync(join(root, f.path))) !== f.sha256) warns.push(`${f.path}: an ignored settings file changed or is missing; outside the commit, restored by hand`);
  if (existsSync(join(root, 'project/rules.md')) || existsSync(join(root, INVENTORY))) warns.push('v3 files remain in the tree; the revert is incomplete or later work re-added them');
  notes.push(`rollback verified: ${same} of ${inv.files.length} snapshot files byte for byte; ${later.size} paths touched by later work`);
}

if (args.rollback) {
  const inv = loadInventory(), m = migrationCommit(inv.sourceCommit);
  if (!m) { console.error('migrate: no "MIGRATE: ..." commit found after the snapshot; nothing to roll back'); process.exit(1); }
  const laterCommits = git('log', '--format=%h %s', `${m}..HEAD`, '--', '.').split('\n').filter(Boolean);
  const touched = git('diff', '--name-only', `${m}^`, m).split('\n').filter(Boolean);
  const overlap = laterCommits.length ? git('diff', '--name-only', m, 'HEAD').split('\n').filter((p) => p && touched.includes(p)) : [];
  const runner = inv.runner || `${prefix}tools/migrate.mjs`, copy = '/tmp/pm-next-v3-migrate.mjs';
  console.log(`Rollback of the migration commit ${m.slice(0, 7)} (${git('show', '-s', '--format=%s', m)}). The steps; this tool performs none of them:
1. Stop every other writer; \`git status\` must be clean. Later work since the migration: ${laterCommits.length ? laterCommits.join('; ') : 'none'} — it is reconciled, never discarded.
2. Keep the tool for the verification, since the revert removes v3's tools: git show ${m}:${runner} > ${copy}
3. git revert --no-edit ${m}   — never git reset --hard. ${overlap.length ? `Later work also changed ${overlap.join(', ')}: where the revert conflicts, keep the later work's lines inside the pre-migration structure, then git add them and git revert --continue.` : 'No later commit touched a file the migration changed, so no conflict is expected.'}
4. node ${copy} --verify --rolled-back --root ${root}   — every snapshot file byte for byte; files later work touched reported apart, every line it kept or added present, files it created present.
5. Reconcile later work written in v3's grammar — the rules file, Direction, Session-end lines, decisions in the slice form — into the v2 record, and run v2's node tools/check.mjs.
6. Commit as "MIGRATE: rolled back — <reason>", record the decision, push by the profile's route. The snapshot and the inventory stay in history at ${m.slice(0, 7)}.`);
}

for (const [list, tag] of [[notes, 'INFO'], [warns, 'WARN'], [fails, 'FAIL']]) for (const msg of list) console.log(`${tag}  ${msg}`);
if (!args.rollback) console.log(`migrate: ${fails.length} failure(s), ${warns.length} warning(s)`);
process.exitCode = fails.length ? 1 : 0;
