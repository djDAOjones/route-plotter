#!/usr/bin/env node
// pm-next-v3 migrate tool (specification 3.10, 8): the snapshot, the preservation inventory, the census skeleton, the
// checks after the migration and after a rollback, and the printed rollback. It never performs the migration's edits (but the v3.1 wish stamp, below) and
// never performs the rollback: a session does both, following the migration note in CHANGELOG.md. Self-contained on
// purpose — after `git revert <migration>` the tree is v2's again, so a copy of this file taken from the migration commit
// with `git show` must run alone. The snapshot is the commit: Git holds the bytes, the inventory holds their hashes and
// the record's substance. What it checks is that the record was kept, in the forms a tool can compare; whether an
// obligation kept its force, or a re-applied edit its behaviour, is the session's reading. Zero dependencies.
// One route per case (3.10): the v2 route below, and the upgrade route of an installed v3 (V31-DEPLOY, 3.10 amended): the
// same snapshot, verify, rollback print and rolled-back check, written beside the kept v2 inventory, with no census, since
// the crossing replaces tools and verbs as a set and no contract moves; it refuses the route where the contract differs.
// The upgrade route names its item at the snapshot (--item): the decision entry, the upgrade commit's title and the rollback
// commit carry that ID. The upgrade commit is named with --commit and checked to be one commit over the snapshot, the working
// tree at it; the file list, the bytes and the record are recomputed from Git at the snapshot commit and compared whole, the
// target re-hashed, never trusted from the inventory; after a rollback the inventory is read from the upgrade commit, never
// from disk, and the rollback commit is found by its exact body line.
// usage: node tools/migrate.mjs [--root <dir>] --snapshot [--base <pristine v2 dir>] [--rules <path,...>]
//        node tools/migrate.mjs [--root <dir>] --verify [--commit <rev>]          after the migration commit
//        node tools/migrate.mjs [--root <dir>] --verify --rolled-back [--commit <rev>]   after the revert
//        node tools/migrate.mjs [--root <dir>] --rollback [--commit <rev>]        prints the steps; performs nothing
//        node tools/migrate.mjs [--root <dir>] --stamp-wishes                     v3.1: writes each wish line's ID (V31-WISH-IDS)
//        node tools/migrate.mjs [--root <dir>] --verify-stamp [--rolled-back] [--commit <rev>]   the stamp commit, or its revert
// It never edits but for the stamp, its one edit by decision (V31-WISH-IDS, 2026-10-21): it inserts `ORIGIN.N — ` after each wish
// line's `- `, numbered per origin in file order, and changes no other byte; the commit and any revert are the session's.
// upgrade route (an installed v3 to v3.1; <to> is the version label, v3.1; --inventory defaults to project/migration/upgrade-<to>.json):
//        node tools/migrate.mjs [--root <dir>] --snapshot --upgrade <to> --item <ID> --base <pristine installed-version dir> --target <pristine <to> dir> [--from v3] [--inventory <path>]
//        node tools/migrate.mjs [--root <dir>] --verify --upgrade <to> [--commit <rev>] [--decision <ID>] [--target <pristine <to> dir>] [--inventory <path>]   before the commit, at the snapshot's HEAD, or with the commit named and the tree at it
//        node tools/migrate.mjs [--root <dir>] --verify --rolled-back --upgrade <to> --commit <rev> [--inventory <path>]
//        node tools/migrate.mjs [--root <dir>] --rollback --upgrade <to> --commit <rev> [--decision <ID>] [--inventory <path>]
import { readFileSync, writeFileSync, existsSync, mkdirSync, lstatSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ID = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*', DATE = '\\d{4}-\\d{2}-\\d{2}', WISH_ID = `${ID}\\.[1-9][0-9]*`;
const WISHES = 'project/wish-list.md';
const V2_INVENTORY = 'project/migration/inventory.json', CENSUS = 'project/migration/census.md';
const REPLACED = /^(AGENTS\.md|CLAUDE\.md|tools\/.+|verbs\/.+)$/; // replaced as a reviewed set; a local edit lives here, at any depth
const SETTINGS = /^(\.claude|\.codex|harness)\//; // locally verified harness settings, tracked or ignored: kept, never written over
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EDIT = (p) => new RegExp(`^- Migration edit: ${esc(p)} — (re-applied|retired) — \\S.+$`, 'm'); // the disposition line, its why mandatory
const STAMP = new RegExp(`^(${WISH_ID}) — `); // a wish line's permanent ID, ORIGIN.N (V31-WISH-IDS, 3.17), stripped where lines are compared across the stamping; strip below is the one parser
const blank = (m) => m.replace(/[^\n]/g, '');
const active = (s) => s.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, blank)
  .replace(/^([ \t]*)(`{3,})[^\n]*\n[\s\S]*?^\1\2`*[ \t]*$/gm, blank).replace(/^([ \t]*)(~{3,})[^\n]*\n[\s\S]*?^\1\2~*[ \t]*$/gm, blank);
const section = (s, name) => { // boundaries found on the active text (a heading inside a fence is not one); the raw lines between them returned, fences and comments included
  const raw = s.replace(/\r\n/g, '\n').split('\n'), act = active(s).split('\n'), start = act.findIndex((l) => l === `## ${name}`);
  if (start < 0) return '';
  let end = act.findIndex((l, i) => i > start && /^## /.test(l)); if (end < 0) end = act.length;
  return raw.slice(start + 1, end).join('\n').trim();
};
const withoutNow = (s) => { // an item file with its ## Now sections removed (V31-NOW): the heading and its lines to the next ## heading or the end, found on the active text as section() finds them; the one part of an item file an upgrade or later work rewrites
  const raw = s.replace(/\r\n/g, '\n').split('\n'), act = active(s).split('\n'), kept = [];
  for (let i = 0; i < raw.length; i++) { if (act[i] === '## Now') { while (i + 1 < act.length && !/^## /.test(act[i + 1])) i++; continue; } kept.push(raw[i]); }
  return kept.join('\n');
};
const text8 = (buf) => buf ? buf.toString('utf8') : ''; // a Buffer Git handed over, as text; null where the path is absent at that commit
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const utf8 = new TextDecoder('utf-8', { fatal: true });
const fails = [], warns = [], notes = [];

// ---- options: flags, and the values the upgrade route takes
const args = { root: process.cwd() };
for (let i = 2; i < process.argv.length; i++) {
  const name = process.argv[i].replace(/^--/, '');
  if (!process.argv[i].startsWith('--') || !['root', 'snapshot', 'verify', 'rolled-back', 'rollback', 'base', 'rules', 'commit', 'stamp-wishes', 'verify-stamp', 'upgrade', 'from', 'target', 'inventory', 'decision', 'item'].includes(name)) { console.error(`migrate: unknown option ${process.argv[i]}`); process.exit(2); }
  if (['snapshot', 'verify', 'rolled-back', 'rollback', 'stamp-wishes', 'verify-stamp'].includes(name)) args[name] = true;
  else { const v = process.argv[++i]; if (!v || v.startsWith('--')) { console.error(`migrate: --${name} requires a value`); process.exit(2); } args[name] = v; }
}
const root = resolve(args.root);
if ([args.snapshot, args.verify, args.rollback, args['stamp-wishes'], args['verify-stamp']].filter(Boolean).length !== 1) { console.error('migrate: one of --snapshot, --verify, --rollback, --stamp-wishes or --verify-stamp'); process.exit(2); }
const UP = args.upgrade || ''; // the upgrade route, its target's label (v3.1)
if (!UP && (args.from || args.target || args.inventory || args.decision || args.item)) { console.error('migrate: --from, --target, --inventory, --decision and --item belong to the upgrade route; name it with --upgrade <to>'); process.exit(2); }
if (UP && !/^v?\d+(\.\d+)*$/.test(UP)) { console.error(`migrate: --upgrade takes the version label being installed, such as v3.1; got ${UP}`); process.exit(2); }
if (UP && args.item && !new RegExp(`^${ID}$`).test(args.item)) { console.error(`migrate: --item takes the item's ID, such as V31-DEPLOY; got ${args.item}`); process.exit(2); }
const INVENTORY = UP ? (args.inventory || `project/migration/upgrade-${UP}.json`) : V2_INVENTORY;
if (UP && (relative(root, resolve(root, INVENTORY)).startsWith('..') || resolve(root, INVENTORY) === resolve(root, V2_INVENTORY))) { console.error(`migrate: --inventory names a path inside the installation other than ${V2_INVENTORY}, which is the kept v2 inventory`); process.exit(2); }
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).trim();
const read = (p) => { try { return utf8.decode(readFileSync(join(root, p))); } catch (e) { if (e.code === 'ENOENT') return ''; fails.push(`${p}: not readable as UTF-8 text`); return ''; } };
const prefix = git('rev-parse', '--show-prefix'); // the installation may sit below the repository root
const top = git('rev-parse', '--show-toplevel');
const self = relative(top, fileURLToPath(import.meta.url)).split('\\').join('/'); // the executing file, not an adapter that imported it
const show = (rev, p) => { try { return execFileSync('git', ['show', `${rev}:${prefix}${p}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch { return null; } };
const tracked = () => git('ls-files', '-z').split('\0').filter(Boolean).sort(); // relative to the installation
const lines = (t) => t.replace(/\r\n/g, '\n').split('\n');
const strip = (w) => w.replace(STAMP, ''); // a wish line without its permanent ID: the idea and its provenance, what the stamping leaves unchanged; the one parser
const walk = (dir, rel = '') => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name), `${rel}${e.name}/`) : e.isFile() ? [`${rel}${e.name}`] : []).sort();
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`; // a printed path, quoted for the shell: a repository root with spaces pastes whole
const head = () => git('rev-parse', 'HEAD');
const commitOf = (dir) => { try { return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } }; // a pristine copy's commit, where the copy is a checkout
const trackedAtTop = (p) => { try { execFileSync('git', ['cat-file', '-e', `HEAD:${p}`], { cwd: root, stdio: 'ignore' }); return true; } catch { return false; } }; // a repository-root path, tracked at HEAD
const SESSION_HOOKS = [['SessionStart', 'compact', 'session'], ['SessionStart', 'startup', 'session'], ['SessionStart', 'resume', 'session'], ['SessionStart', 'startup', 'handover'], ['PostToolUse', null, 'session']]; // what the runner demands of a settings file (3.15)
const settingsFiles = () => ['.claude/settings.json', '.codex/hooks.json'].map((p) => [p, join(top, p)]).filter(([, f]) => existsSync(f)); // the repository root's, where the generated hooks live for a root and for a nested installation alike
const lacksHook = (text, prefixHere) => { // the session hooks a settings file lacks, read as the runner reads them
  let s; try { s = JSON.parse(text); } catch { return ['readable JSON']; }
  const covers = (matcher, source) => source === null || matcher === undefined || matcher === '' || String(matcher).split('|').map((x) => x.trim()).includes(source);
  const runs = (h, tool) => typeof h?.command === 'string' && h.command.includes(`${prefixHere}tools/${tool}.mjs`);
  return SESSION_HOOKS.filter(([event, source, tool]) => !(Array.isArray(s?.hooks?.[event]) && s.hooks[event].some((g) => covers(g?.matcher, source) && Array.isArray(g?.hooks) && g.hooks.some((h) => runs(h, tool))))).map(([e, s2, t]) => `${e}${s2 ? `(${s2})` : ''} running tools/${t}.mjs`);
};
const hookPaths = (text) => { // every tools/<name>.mjs word a settings file's strings name, as the shell hands it over: a quoted word whole, spaces included
  let s; try { s = JSON.parse(text); } catch { return []; }
  const strings = (v) => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];
  return [...new Set(strings(s).flatMap((v) => [...v.matchAll(/'([^']*)'|"((?:[^"\\]|\\.)*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]).filter((w) => /tools\/[A-Za-z0-9_.-]+\.mjs$/.test(w))))];
};

// ---- the record's substance (3.10, 8): what the migration keeps, in the forms a tool can compare
function record(files, at = null) { // at: reads one file of the installation at the source commit, a Buffer or null; without it the working tree is read
  const text = at ? (p) => { const b = at(p); if (!b) return ''; try { return utf8.decode(b); } catch { return ''; } } : read;
  const bytes = at ? (p) => at(p) || Buffer.alloc(0) : (p) => readFileSync(join(root, p));
  const all = (t, re) => [...active(t).matchAll(re)];
  const open = all(text('project/backlog.md'), new RegExp(`^- \\[( |~|!)\\] (${ID}) — .+? — since (${DATE})(?: — \\(from: (${ID}, ${DATE})\\))?(?: — blocked: (.+))?$`, 'gm'))
    .map((m) => ({ id: m[2], mark: m[1], since: m[3], from: m[4] || '', blocked: m[5] || '', ...(UP ? { line: m[0] } : {}) })); // the title may be trimmed; mark, date, provenance and the blocker stay; the upgrade keeps the whole line
  const shipped = all(text('project/trajectory.md'), new RegExp(`^- (?:${ID}|RECALL) — .+$`, 'gm')).map((m) => m[0]); // shipped and RECALL lines, verbatim
  const entries = (t) => t.replace(/\r\n/g, '\n').split(/^(?=## )/m).filter((b) => new RegExp(`^## ${DATE} — ${ID} — `).test(b)).map((b) => b.trim());
  const archived = at ? files.filter((f) => /^project\/decisions-[^/]*\.md$/.test(f)) // at the source commit, its tracked files
    : existsSync(join(root, 'project')) ? readdirSync(join(root, 'project')).filter((n) => /^decisions-.*\.md$/.test(n)).sort().map((n) => `project/${n}`) : []; // beside decisions.md, on disk: a verbatim move may be uncommitted at verify time
  const decisions = [...entries(text('project/decisions.md')), ...archived.flatMap((f) => entries(text(f)))]
    .map((b) => ({ head: b.split('\n')[0].slice(3), sha256: sha(b) })); // a past entry is never edited: its raw text is hashed, fences included
  const wishes = all(text('project/wish-list.md'), /^- (\S.*)$/gm).map((m) => m[1]); // verbatim, provenance included
  const hashed = (re) => Object.fromEntries(files.filter((f) => typeof re === 'function' ? re(f) : re.test(f)).map((f) => [f, sha(bytes(f))]));
  const items = Object.fromEntries(files.filter((f) => /^project\/items\/[^_][^/]*\.md$/.test(f)).map((f) => [f, sha(section(text(f), 'Acceptance criteria'))]));
  const signedFiles = ['project/profile.md', 'project/brief.md', ...(UP && files.includes('project/rules.md') ? ['project/rules.md'] : [])]; // v3 signs the rules file too (3.1): the upgrade route compares it by its signature; the v2 route, which writes the file, keeps a pre-existing one byte for byte as before
  const signatures = Object.fromEntries(signedFiles.map((f) => [f, (section(text(f), 'Signed').match(/^- Owner.*$/m) || [''])[0]]));
  const REWRITTEN = UP ? /^project\/(profile|brief|rules|backlog|decisions|trajectory|wish-list|structure)\.md$|^project\/items\// : /^project\/(profile|brief|backlog|decisions|trajectory|wish-list|structure)\.md$|^project\/items\//; // compared by substance above, the signed files by their signature; every other project file byte for byte (the v2 set unchanged)
  return { open, shipped, decisions, wishes, items, digests: hashed(/^project\/digests\/[^_][^/]*\.md$/), archive: hashed(/^project\/(archive\/|archive-index\.md$|decisions-[^/]*\.md$)/), project: files.filter((f) => f.startsWith('project/')), kept: hashed((f) => f.startsWith('project/') && !REWRITTEN.test(f)), signatures };
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
  if (UP) {
    if (!existsSync(join(root, 'project/rules.md'))) { console.error('migrate: the upgrade route is for an installed v3, and project/rules.md is missing; a v2 installation migrates by the v2 route (--snapshot without --upgrade)'); process.exit(1); }
    if (existsSync(join(root, INVENTORY))) { console.error(`migrate: ${INVENTORY} exists; a second snapshot would hide the first — before upgrading, move that one file aside and run the snapshot again; after upgrading, there is no second snapshot`); process.exit(1); }
    if (!args.base || !args.target) { console.error('migrate: the upgrade snapshot needs --base <a pristine copy of the installed version> and --target <a pristine copy of the version being installed>, so every replaced file has a status and the contract check has both sides'); process.exit(1); }
    for (const [flag, dir] of [['base', args.base], ['target', args.target]]) if (!existsSync(join(resolve(dir), 'AGENTS.md'))) { console.error(`migrate: --${flag} ${dir} has no AGENTS.md; name a pristine pm-next source directory`); process.exit(1); }
    if (sha(readFileSync(join(resolve(args.base), 'AGENTS.md'))) !== sha(readFileSync(join(resolve(args.target), 'AGENTS.md')))) { console.error(`migrate: AGENTS.md differs between --base and --target, so ${UP} changes the contract: that is a migration with a census (3.10, 8), not an upgrade; this route refuses it`); process.exit(1); }
    if (!args.item) { console.error('migrate: the upgrade snapshot needs --item <ID>, the item whose commit carries the upgrade: its decision entry, the upgrade commit\'s title and the rollback commit are checked against that ID'); process.exit(1); }
    if (prefix) { // a nested installation's hook merge rides the upgrade commit, so the repository root's settings files are clean at the snapshot too
      const dirty = settingsFiles().filter(([p]) => git('status', '--porcelain', '--', `:/${p}`)).map(([p]) => p);
      if (dirty.length) { console.error(`migrate: the repository root's ${dirty.join(' and ')} ${dirty.length > 1 ? 'have' : 'has'} uncommitted changes; the upgrade commit carries the hook merge, so commit or discard them before the snapshot`); process.exit(1); }
    }
  } else {
    if (existsSync(join(root, 'project/rules.md'))) warns.push('project/rules.md already exists; is this a v2 installation?');
    if (existsSync(join(root, INVENTORY))) { console.error(`migrate: ${INVENTORY} exists; a second snapshot would hide the first — before migrating, move aside only that file and ${CENSUS}, never the rest of project/migration/, and run the snapshot again; after migrating, there is no second snapshot`); process.exit(1); }
  }
  if (self.startsWith('..')) { console.error(`migrate: this copy of the tool (${self}) lies outside the repository, so the rollback could not recover it with git show; copy v3's tools/migrate.mjs into the installation's tools/ and commit it alone first, or run v3's copy from inside the repository`); process.exit(1); }
  const files = tracked().map((p) => {
    if (lstatSync(join(root, p)).isSymbolicLink()) { fails.push(`${p}: a tracked symbolic link; the snapshot hashes files only — resolve it before migrating`); return { path: p, sha256: '', bytes: 0 }; }
    if (/^project\/archive\/decisions-[^/]*\.md$/.test(p)) fails.push(`${p}: archived decisions in the old archive folder; v3 keeps them beside project/decisions.md and this tool does not move them, so its record would miss them — stop and ask before migrating`);
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
  const sources = UP ? [] : ['AGENTS.md', 'project/profile.md', 'project/brief.md', ...rulesHome], rows = UP ? [] : censusRows(sources);
  const rec = record(files.map((f) => f.path));
  if (fails.length) { for (const m of fails) console.log(`FAIL  ${m}`); console.log(`migrate: ${fails.length} failure(s); nothing written`); process.exit(1); }
  mkdirSync(join(root, INVENTORY, '..'), { recursive: true });
  let inventory;
  if (UP) {
    const baseDir = resolve(args.base), targetDir = resolve(args.target); // the version being installed: what every replaced file is compared with after the upgrade; each named with its commit where the copy is a checkout
    const target = { path: targetDir, commit: commitOf(targetDir), contract: sha(readFileSync(join(targetDir, 'AGENTS.md'))), files: Object.fromEntries(walk(targetDir).filter((p) => REPLACED.test(p)).map((p) => [p, sha(readFileSync(join(targetDir, p)))])) };
    const base = { path: baseDir, commit: commitOf(baseDir) };
    const inherited = Object.fromEntries([V2_INVENTORY, CENSUS].filter((p) => existsSync(join(root, p))).map((p) => [p, sha(readFileSync(join(root, p)))])); // the earlier migration's record, kept byte for byte, never regenerated (3.3)
    const rootSettings = prefix ? Object.fromEntries(settingsFiles().map(([p, f]) => [p, { sha256: sha(readFileSync(f)), tracked: trackedAtTop(p) }])) : null; // a nested installation's: the hook merge rides the upgrade commit and is checked restored after a rollback
    inventory = { schemaVersion: 3, tool: `pm-next-${UP} tools/migrate.mjs`, runner: self, route: 'upgrade', item: args.item, from: args.from || 'v3', to: UP, date: new Date().toISOString().slice(0, 10), sourceCommit: git('rev-parse', 'HEAD'), prefix, files, local, ...(rootSettings ? { rootSettings } : {}), localEdits, base, target, inherited, record: rec };
    notes.push(`no census: AGENTS.md is the same in ${args.base} and ${args.target}, so ${UP} replaces tools and verbs as a set and no contract moves (3.10)`);
    if (Object.keys(inherited).length) notes.push(`inherited record kept beside this snapshot, byte for byte: ${Object.keys(inherited).join(', ')}`);
    if (rootSettings && Object.keys(rootSettings).length) notes.push(`repository-root settings hashed for the rollback check: ${Object.entries(rootSettings).map(([p, s]) => `${p} (${s.tracked ? 'tracked' : 'ignored'})`).join(', ')}`);
  } else {
    if (existsSync(join(root, CENSUS))) notes.push(`${CENSUS} exists and was kept; delete it to regenerate`); else writeFileSync(join(root, CENSUS), censusTable(rows, sources));
    inventory = { schemaVersion: 3, tool: 'pm-next-v3 tools/migrate.mjs', runner: self, from: 'v2', date: new Date().toISOString().slice(0, 10), sourceCommit: git('rev-parse', 'HEAD'), prefix, files, local, localEdits, rulesHome, census: { file: CENSUS, sources, rows }, record: rec };
  }
  writeFileSync(join(root, INVENTORY), JSON.stringify(inventory, null, 2) + '\n');
  const dispose = localEdits.filter((e) => e.status !== 'identical');
  notes.push(`snapshot at ${inventory.sourceCommit.slice(0, 7)}: ${files.length} tracked files${local.length ? `, ${local.length} ignored settings files hashed (outside the commit: keep them by hand)` : ''}; ${rec.open.length} open and ${rec.shipped.length} shipped lines, ${rec.decisions.length} decision entries, ${rec.wishes.length} wish lines, ${Object.keys(rec.items).length} item files, ${Object.keys(rec.digests).length} digests, ${Object.keys(rec.archive).length} archive files, ${rec.project.length} files under project/`);
  notes.push(`${dispose.length} replaced files to dispose by a decision (${dispose.map((e) => `${e.path} ${e.status}`).join('; ') || 'none'})${UP ? `; after the upgrade every file on a replaced path either equals ${UP}'s or carries a disposition line, and every ${UP} file is installed or retired by one` : `; census ${rows.length} rows from ${sources.length} sources in ${CENSUS}`}`);
  notes.push(UP ? `next: upgrade by the note, commit alone as "${args.item}: ...", then node tools/migrate.mjs --verify --upgrade ${UP} --commit HEAD` : 'next: migrate by the note, fill the census, commit alone as "MIGRATE: ...", then node tools/migrate.mjs --verify');
}

// ---- the migration commit: the first after the snapshot, within the installation, titled MIGRATE: — or --commit; the
// upgrade route names it with --commit (the rollback print and the rolled-back check require it; verify runs at the
// snapshot's HEAD without it) and checks it: one parent, the snapshot; titled by the item named at the snapshot
const migrationCommit = (since) => args.commit ? git('rev-parse', '--verify', `${args.commit}^{commit}`)
  : UP ? '' : git('log', '--reverse', '--format=%H%x09%s', `${since}..HEAD`, '--', '.').split('\n').map((l) => l.split('\t')).find(([, s]) => /^MIGRATE: /.test(s || ''))?.[0] || '';
const decisionId = (inv) => UP ? (args.decision || inv.item || '') : 'MIGRATE'; // the upgrade's item names its decision, its commit and the rollback commit; --decision names another entry
function checkCommit(m, inv) { // the named commit is the upgrade's: one commit over the snapshot, titled by the item
  const n = fails.length, parents = git('rev-list', '--parents', '-n', '1', m).split(' ').slice(1);
  if (parents.length !== 1) fails.push(`${m.slice(0, 7)} has ${parents.length} parents; the upgrade commit is one commit over the snapshot ${inv.sourceCommit.slice(0, 7)}, never a merge (3.10)`);
  else if (parents[0] !== inv.sourceCommit) fails.push(`${m.slice(0, 7)}'s parent is ${parents[0].slice(0, 7)}, not the snapshot ${inv.sourceCommit.slice(0, 7)}; the upgrade commit is the first after the snapshot — name it with --commit`);
  const title = git('show', '-s', '--format=%s', m);
  if (inv.item && !title.startsWith(`${inv.item}: `)) fails.push(`${m.slice(0, 7)} is titled "${title.slice(0, 60)}${title.length > 60 ? '…' : ''}", not "${inv.item}: <summary>", the item named at the snapshot`);
  return fails.length === n;
}
function loadInventory() {
  const onDisk = read(INVENTORY);
  if (onDisk) return JSON.parse(onDisk);
  for (const rev of git('log', '--format=%H', '--', '.').split('\n').filter(Boolean)) { // the revert removed it: read it from history
    const buf = show(rev, INVENTORY); if (buf) { notes.push(`inventory read from commit ${rev.slice(0, 7)}`); return JSON.parse(buf.toString('utf8')); }
  }
  console.error(`migrate: no ${INVENTORY} on disk or in history; run --snapshot${UP ? ` --upgrade ${UP}` : ''} before ${UP ? 'upgrading' : 'migrating'}`); process.exit(1);
}
if (UP && (args.rollback || (args.verify && args['rolled-back'])) && !args.commit) { console.error(`migrate: the upgrade route names its commit: --commit <rev> (never found by its title)`); process.exit(2); }

if (args.verify && !args['rolled-back']) {
  const inv = loadInventory(), now = record(tracked()), m = migrationCommit(inv.sourceCommit), DEC = decisionId(inv);
  let rec = inv.record, targetFiles = inv.target?.files || {}, filesAtS = null; // what the checks compare against: under the upgrade route Git's record at the snapshot, its file list and the target re-hashed, never the inventory's copy
  if (UP && !inv.to) fails.push(`${INVENTORY} is a v2 inventory, not an upgrade's; name the upgrade's with --inventory`);
  if (UP && !DEC) fails.push(`${INVENTORY} names no item (--item at the snapshot) and no --decision was given, so the upgrade's decision entry has no ID to look for`);
  if (UP && m) checkCommit(m, inv);
  if (UP && !m) { const h = head(); if (h !== inv.sourceCommit) fails.push(`HEAD (${h.slice(0, 7)}) is not the snapshot ${inv.sourceCommit.slice(0, 7)}: without --commit the check reads the working tree over the snapshot; after the upgrade commit, name it with --commit <rev>`); }
  if (UP && m) { // verify certifies the commit it names: the working tree equals its tree on the installation's paths and, for a nested installation, the repository root's settings files; an untracked file there is a difference too
    const rootSpecs = prefix ? ['.claude/settings.json', '.codex/hooks.json'].filter((p) => trackedAtTop(p) || existsSync(join(top, p))).map((p) => `:/${p}`) : [];
    const differ = [...git('diff', '--name-only', m, '--', '.', ...rootSpecs).split('\n'), ...git('ls-files', '--others', '--exclude-standard', '--', '.').split('\n').filter(Boolean).map((p) => `${prefix}${p} (untracked)`)].filter(Boolean);
    if (differ.length) fails.push(`the working tree differs from ${m.slice(0, 7)} (${differ.join(', ')}); verify certifies the commit it names: run it when the commit is made, before any edit after it`);
  }
  if (UP) { // the file list, the bytes and the record recomputed from Git at the snapshot commit and compared whole: the inventory is a copy of what Git holds, never the authority
    const S = inv.sourceCommit, listed = new Set((inv.files || []).map((f) => f.path));
    filesAtS = git('ls-tree', '-r', '-z', '--name-only', S).split('\0').filter(Boolean).sort(); // the installation's files at S, relative to it: ls-tree lists the working directory's subtree
    const inGit = new Set(filesAtS), absent = filesAtS.filter((p) => !listed.has(p)), extra = [...listed].filter((p) => !inGit.has(p));
    if (absent.length || extra.length) fails.push(`the inventory's file list disagrees with Git at ${S.slice(0, 7)} (${[absent.length ? `absent from the inventory: ${absent.join(', ')}` : '', extra.length ? `not at the snapshot: ${extra.join(', ')}` : ''].filter(Boolean).join('; ')}); the inventory was edited after the snapshot, and the check holds Git's list, not the file's`);
    const statused = new Set((inv.localEdits || []).map((e) => e.path)), replacedOff = [...filesAtS.filter((p) => REPLACED.test(p) && !statused.has(p)).map((p) => `${p} absent`), ...[...statused].filter((p) => !inGit.has(p)).map((p) => `${p} not at the snapshot`)];
    if (replacedOff.length) fails.push(`the inventory's replaced-file list disagrees with Git at ${S.slice(0, 7)} (${replacedOff.join(', ')}); every replaced path at the snapshot carries its status against the base there`);
    for (const f of inv.files || []) if (inGit.has(f.path)) { const buf = show(S, f.path); if (!buf || sha(buf) !== f.sha256) fails.push(`${f.path}: the inventory's hash is not the source commit's (${S.slice(0, 7)}); the inventory was edited after the snapshot`); } // the bytes recomputed from Git, not trusted
    rec = record(filesAtS, (p) => show(S, p));
    const differ = [...new Set([...Object.keys(inv.record || {}), ...Object.keys(rec)])].filter((k) => JSON.stringify(inv.record?.[k]) !== JSON.stringify(rec[k]));
    if (differ.length) fails.push(`the inventory's record disagrees with Git at ${S.slice(0, 7)} (${differ.join(', ')}); the inventory was edited after the snapshot, and the check holds Git's bytes, not the file's`);
    if (inv.target) { // the target re-hashed: --target names the pristine copy; without it the snapshot's path, where that is still on disk
      const dir = args.target ? resolve(args.target) : inv.target.path && existsSync(join(inv.target.path, 'AGENTS.md')) ? inv.target.path : '';
      if (!dir) warns.push(`the target was not re-hashed: ${inv.target.path ? `${inv.target.path} is not on disk` : 'the inventory names no target path'} and no --target was given, so the inventory's hashes of ${UP}'s replaced set stand unchecked`);
      else {
        const fresh = Object.fromEntries(walk(dir).filter((p) => REPLACED.test(p)).map((p) => [p, sha(readFileSync(join(dir, p)))]));
        const off = [...new Set([...Object.keys(inv.target.files || {}), ...Object.keys(fresh)])].filter((p) => inv.target.files?.[p] !== fresh[p]).sort();
        if (off.length) fails.push(`the inventory's target hashes disagree with ${dir} (${off.join(', ')}); the inventory was edited after the snapshot, or this is not the copy it hashed — name the pristine ${UP} copy with --target`);
        else notes.push(`target re-hashed from ${args.target ? `--target ${dir}` : `the snapshot's target path ${dir}`}: ${Object.keys(fresh).length} replaced files agree with the inventory`);
        targetFiles = fresh;
      }
    }
  }
  const decisions = active(read('project/decisions.md'));
  const migrate = decisions.split(/^(?=## )/m).find((b) => new RegExp(`^## ${DATE} — ${esc(DEC)} — `).test(b) && (!UP || (b.match(new RegExp(DATE))?.[0] || '') >= inv.date)) || '';
  const since = migrate.match(new RegExp(DATE))?.[0] || '';
  if (!migrate) fails.push(UP ? `project/decisions.md: no ${DEC || '<item>'} decision entry dated from the snapshot (${inv.date}) on; the record of the upgrade needs one (3.10) — name another ID with --decision` : 'project/decisions.md: no MIGRATE decision entry; the record of the migration needs one (3.10) — the inherited-entry boundary is the inventory, not this entry (3.3)');
  else if (!UP && !migrate.includes(CENSUS)) fails.push(`the MIGRATE decision must name ${CENSUS} and say that its sources were closed and every row reviewed in context (8)`);
  const openNow = new Map(now.open.map((o) => [o.id, o]));
  for (const o of rec.open) {
    const n = openNow.get(o.id);
    if (!n) { fails.push(now.shipped.some((l) => l.startsWith(`- ${o.id} — `)) ? `${o.id} closed into the trajectory in the migration; a migration commit carries no product work — close an item in its own commit (3.10)` : `open ID lost: ${o.id}`); continue; }
    if (UP) { if (n.line !== o.line) fails.push(`backlog ${o.id}: the open line changed; the upgrade keeps every open line verbatim, title and blocker included — a trim is a close's, not the upgrade's`); } // verbatim: no trim allowance across an upgrade
    else if (n.mark !== o.mark || n.since !== o.since || n.from !== o.from || (o.blocked && !n.blocked)) fails.push(`backlog ${o.id}: mark, since date, provenance or blocker changed; the title may be trimmed, these stay`);
    else if (o.blocked && n.blocked !== o.blocked) warns.push(`backlog ${o.id}: the blocker reads "${n.blocked}" where it read "${o.blocked}"; a trim keeps its owner and condition`);
  }
  if (UP) { // with multiplicity: one of two identical lines lost is a loss; across the upgrade a wish line gains its permanent ID (V31-WISH-IDS) and nothing else — no close, no promotion, no trim
    const counted = (ls) => { const c = new Map(); for (const l of ls) c.set(l, (c.get(l) || 0) + 1); return c; };
    const take = (c, k) => { const n = c.get(k) || 0; if (n > 0) c.set(k, n - 1); return n > 0; };
    const ship = counted(now.shipped); for (const l of rec.shipped) if (!take(ship, l)) fails.push(`trajectory line lost or changed: ${l.slice(0, 70)}`);
    const dec = counted(now.decisions.map((d) => d.sha256)); for (const d of rec.decisions) if (!take(dec, d.sha256)) fails.push(`decision entry lost or edited (archive verbatim, never edit): ${d.head}`);
    const wish = counted(now.wishes.map(strip)); for (const w of rec.wishes) if (!take(wish, strip(w))) fails.push(`wish line lost or changed (the upgrade stamps an ID and changes nothing else; a close or promotion is its own commit): ${w.slice(0, 60)}${w.length > 60 ? '…' : ''}`);
    for (const [id, n] of counted(now.wishes.map((w) => (w.match(STAMP) || [])[1]).filter(Boolean))) if (n > 1) fails.push(`wish ID ${id} is stamped on ${n} lines; a permanent ID names one wish line (V31-WISH-IDS)`);
  } else {
    for (const l of rec.shipped) if (!now.shipped.includes(l)) fails.push(`trajectory line lost or changed: ${l.slice(0, 70)}`);
    const hashes = new Set(now.decisions.map((d) => d.sha256));
    for (const d of rec.decisions) if (!hashes.has(d.sha256)) fails.push(`decision entry lost or edited (archive verbatim, never edit): ${d.head}`);
    const backlog = active(read('project/backlog.md'));
    for (const w of rec.wishes) {
      const idea = w.replace(/\s+— \(from: [^)]*\)\s*$/, '');
      const origin = w.match(new RegExp(`— \\(from: (${ID}), ${DATE}\\)$`))?.[1], stamped = origin && now.wishes.some((n) => new RegExp(`^${esc(origin)}\\.[1-9][0-9]* — ${esc(w)}$`).test(n)); // a v3.1 migration stamps the line (V31-WISH-IDS)
      if (!now.wishes.includes(w) && !stamped && !new RegExp(`^- \\[( |~|!)\\] ${ID} — ${esc(idea)} — since `, 'm').test(backlog)) fails.push(`wish line lost or changed (trim at the first close, not here): ${w.slice(0, 60)}${w.length > 60 ? '…' : ''}`);
    }
  }
  for (const f of rec.project) if (!existsSync(join(root, f))) fails.push(`${f}: a populated project file is missing; the migration keeps every one (3.10)`);
  for (const [f, h] of Object.entries(rec.items)) if (existsSync(join(root, f)) && sha(section(read(f), 'Acceptance criteria')) !== h) fails.push(`item criteria changed: ${f}`);
  if (UP) for (const f of Object.keys(rec.items)) { // an item file takes a new ## Now and appended notes only (V31-NOW): outside its Now the text at the snapshot stands, or is extended; the criteria hash above besides
    if (!existsSync(join(root, f))) continue; // reported above as a missing project file
    const was = withoutNow(text8(show(inv.sourceCommit, f))).trimEnd(), is = withoutNow(read(f)).trimEnd();
    if (is !== was && !is.startsWith(was)) fails.push(`${f}: text outside ## Now changed; an item file takes a new Now and appended notes only`);
  }
  for (const [f, h] of Object.entries(rec.kept || {})) if (existsSync(join(root, f)) && sha(readFileSync(join(root, f))) !== h) fails.push(`${f}: a project file the migration does not rewrite changed; it is kept byte for byte (3.10)`);
  for (const [label, set] of [['a digest', rec.digests], ['an archive file', rec.archive]]) for (const [f, h] of Object.entries(set)) if (existsSync(join(root, f)) && sha(readFileSync(join(root, f))) !== h) fails.push(`${f}: ${label} is kept byte for byte`);
  for (const [f, h] of Object.entries(inv.inherited || {})) { // the earlier migration's inventory and census: the inherited-entry boundary, never regenerated (3.3)
    if (!existsSync(join(root, f))) fails.push(`${f}: the inherited migration record is missing; it marks the inherited-entry boundary and is never regenerated (3.3, 3.10)`);
    else if (sha(readFileSync(join(root, f))) !== h) fails.push(`${f}: the inherited migration record changed; it is kept byte for byte, never regenerated (3.3, 3.10)`);
  }
  for (const [f, line] of Object.entries(rec.signatures)) {
    const signed = section(read(f), 'Signed');
    if (!/^- Owner.*$/m.test(signed)) fails.push(`${f}: no owner signature line remains; a migrated file is re-signed by the owner, or delegated with its authority (3.8)`);
    else if (line && !signed.includes(line)) { // a delegated line citing this upgrade's decision is the form 3.8 names: reported, listed by the view as needing the owner
      const d = signed.match(/^- Owner \(delegated, not reviewed\): .+, \d{4}-\d{2}-\d{2} — see (\S+)$/m);
      if (UP && d && d[1] === DEC) notes.push(`${f}: the signature line "${line}" replaced by a delegated line citing ${DEC}; the view lists the file as needing the owner until a reviewed line replaces it, within two weeks (3.8)`);
      else warns.push(`${f}: the signature line "${line}" was replaced; the owner re-signs a migrated file, or the replacement is delegated and cites its authority (3.8)`);
    }
  }
  for (const f of [...inv.files.filter((x) => SETTINGS.test(x.path)), ...inv.local]) {
    if (!existsSync(join(root, f.path))) fails.push(`${f.path}: a locally verified harness setting is missing; the migration keeps it (3.10)`);
    else if (sha(readFileSync(join(root, f.path))) !== f.sha256) warns.push(`${f.path}: a locally verified harness setting changed; the note says never over local configuration — the owner's word, recorded`);
  }
  if (UP) for (const [p, s] of Object.entries(inv.rootSettings || {})) { // a nested installation's root settings: the hook merge edits them in the upgrade commit and removes none
    const wasTracked = typeof s === 'string' || s.tracked !== false;
    if (!existsSync(join(top, p))) (wasTracked ? fails : warns).push(`${p}: the repository root's settings file is missing after the upgrade; the hook merge edits it, never removes it${wasTracked ? '' : ' (ignored, outside the commit: kept by hand)'} (3.15)`);
  }
  const blocks = UP ? [migrate] : decisions.split(/^(?=## )/m).filter((b) => (b.match(new RegExp(DATE))?.[0] || '') >= since); // the upgrade's dispositions live in its own entry, the item's or --decision's; the v2 route reads every entry from the MIGRATE one on, as before
  const disposed = (p) => blocks.map((b) => b.match(EDIT(p))?.[0]).find(Boolean);
  const reapplied = new Set();
  for (const e of inv.localEdits.filter((x) => x.status !== 'identical')) { // each re-applied or retired by a decision from the migration on, in one grammar, its why mandatory
    const line = disposed(e.path);
    if (!line) fails.push(`${e.path} (${e.status}): no decision from the ${UP ? 'upgrade' : 'migration'} carries "- Migration edit: ${e.path} — re-applied | retired — <where or why>" (3.10)`);
    else if (/— re-applied —/.test(line) && !existsSync(join(root, e.path))) fails.push(`${e.path}: declared re-applied but absent; re-applied means the implementation is in the tree, retired means its removal is the decision (3.10)`);
    else if (/— re-applied —/.test(line)) reapplied.add(e.path);
  }
  if (UP && inv.target) { // replaced as a set: after the upgrade every file on a replaced path equals the target's or carries a disposition line (an adapter never equals it), and every target file is installed or retired by one
    const snapshotPaths = new Set(filesAtS || inv.files.map((f) => f.path)), retired = [];
    const imports = (p) => [...read(p).matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.\.?\/[^'"]*?tools\/([A-Za-z0-9_.-]+\.mjs))['"]/g)].map((x) => [x[1], `tools/${x[2]}`]); // an adapter's relative import of a tool
    for (const p of tracked().filter((p) => REPLACED.test(p))) {
      if (targetFiles[p] === sha(readFileSync(join(root, p)))) continue;
      const line = disposed(p);
      if (!line) { fails.push(`${p} (${snapshotPaths.has(p) ? 'kept' : 'added'} by the upgrade, not ${UP}'s copy): no decision from the upgrade carries "- Migration edit: ${p} — re-applied | retired — <where or why>"; tools and verbs are replaced as a set (3.10)`); continue; }
      if (/— retired —/.test(line)) { fails.push(`${p}: retired by a decision yet still in the tree and not ${UP}'s copy; a retired modification means ${UP}'s copy stands, a retired file is absent (3.10)`); continue; }
      reapplied.add(p);
      if (/^tools\/.+\.mjs$/.test(p)) for (const [spec, name] of imports(p)) { // an adapter left pointing at another version's tool is the hazard: its import target is hashed against the target's
        if (!(name in targetFiles)) continue;
        const f = resolve(root, dirname(p), spec);
        if (!existsSync(f)) fails.push(`${p}: imports ${spec}, which is not in the tree`);
        else if (sha(readFileSync(f)) !== targetFiles[name]) fails.push(`${p}: imports ${spec}, which is not ${UP}'s ${name}; the adapter still points at another version's tool`);
      }
    }
    for (const p of Object.keys(targetFiles)) if (!existsSync(join(root, p))) {
      const line = disposed(p);
      if (line && /— retired —/.test(line)) retired.push(p);
      else fails.push(`${p}: ${UP}'s file is not installed and no decision from the upgrade retires it; install ${UP}'s copy or an adapter, or carry "- Migration edit: ${p} — retired — <why>" — tools and verbs are replaced as a set (3.10)`);
    }
    if (retired.length) notes.push(`retired by decision, not installed from ${UP}: ${retired.join(', ')}`);
    if (reapplied.size) notes.push(`re-applied, for the session's review — the tool compares bytes, not behaviour: ${[...reapplied].sort().join(', ')}`);
    if (existsSync(join(root, 'tools/handover.mjs'))) { // the start notice is installed: the settings must run it, or the runner refuses them (3.15)
      const files = settingsFiles();
      if (!files.length) warns.push('no .claude/settings.json or .codex/hooks.json at the repository root; the session hooks are proposed by node tools/harness.mjs --hooks-only and installed on the owner\'s word (3.15)');
      for (const [rel, f] of files) { const lacks = lacksHook(readFileSync(f, 'utf8'), prefix); if (lacks.length) warns.push(`${rel}: lacks ${lacks.join('; ')}, which the runner demands of a settings file once tools/handover.mjs is installed (3.15); node tools/harness.mjs --hooks-only merges them`); else notes.push(`${rel}: carries the session hooks of 3.15, the start notice included`); }
    }
  }
  if (!UP) {
    const census = read(CENSUS);
    if (!census) fails.push(`${CENSUS} missing; the census is the migration's threshold (8)`);
    else {
      const byRow = new Map(censusParse(census).map((r) => [r.row, r]));
      for (const [i, r] of (inv.census?.rows || []).entries()) {
        const n = byRow.get(`C${i + 1}`);
        if (!n || n.source !== r.source || n.text !== r.text) fails.push(`${CENSUS}: C${i + 1} (${r.source}) deleted or altered; rows keep their identity`);
        else if (!n.destination || !n.applicability) fails.push(`${CENSUS}: C${i + 1} has no destination or applicability; zero omitted is the threshold (8)`);
      }
    }
  }
  if (!m) warns.push(UP ? `no upgrade commit named; pass --commit <rev> so its shape is checked — one commit, no product work (3.10)` : 'no "MIGRATE: ..." commit found after the snapshot; the migration is a commit of its own with no product work (3.10)');
  else {
    const rootSettingsPaths = UP && prefix ? ['.claude/settings.json', '.codex/hooks.json'] : []; // a nested installation's hook merge rides the upgrade commit (3.15): the root settings are its, not product work
    const outside = git('diff', '--name-only', `${m}^`, m).split('\n').filter((p) => p && !p.startsWith(prefix) && p !== self && !rootSettingsPaths.includes(p));
    if (outside.length) warns.push(`${m.slice(0, 7)} touches files outside the installation (${outside.join(', ')}); a migration commit carries no product work (3.10)`);
    else if (!prefix) notes.push('the installation is the repository, so nothing is outside it for the no-product-work check to see');
  }
  const r = inv.record;
  if (UP && inv.base && inv.target) notes.push(`base ${inv.base.path}${inv.base.commit ? ` at ${inv.base.commit.slice(0, 7)}` : ''}; target ${inv.target.path}${inv.target.commit ? ` at ${inv.target.commit.slice(0, 7)}` : ''}; item ${inv.item || 'unnamed'}`);
  notes.push(`verified against the snapshot at ${inv.sourceCommit.slice(0, 7)}${m ? `, ${UP ? 'upgrade' : 'migration'} commit ${m.slice(0, 7)}` : ''}: ${r.open.length} open and ${r.shipped.length} shipped lines, ${r.decisions.length} decision entries, ${r.wishes.length} wish lines, ${Object.keys(r.items).length} item files, ${Object.keys(r.digests).length} digests, ${Object.keys(r.archive).length} archive files, ${r.project.length} project files, ${inv.localEdits.filter((x) => x.status !== 'identical').length} replaced files disposed, ${UP ? 'no census' : `${(inv.census?.rows || []).length} census rows`}`);
  notes.push(`this checks that the record was kept, not that an obligation kept its force; then run node tools/check.mjs (${UP || 'v3'}); rollback steps: node tools/migrate.mjs --rollback${UP ? ` --upgrade ${UP} --commit <rev>` : ''}`);
}

if (args.verify && args['rolled-back']) {
  let inv, m;
  if (UP) { // the inventory read from the upgrade commit, never from a disk copy a resolution may have kept
    m = migrationCommit('');
    const buf = show(m, INVENTORY);
    if (!buf) { console.error(`migrate: ${m.slice(0, 7)} does not carry ${INVENTORY}; the upgrade commit holds the inventory the snapshot wrote and the check reads it from there, never from disk — name the upgrade commit with --commit`); process.exit(1); }
    inv = JSON.parse(buf.toString('utf8')); notes.push(`inventory read from the upgrade commit ${m.slice(0, 7)}, not from disk`); checkCommit(m, inv);
  } else { inv = loadInventory(); m = migrationCommit(inv.sourceCommit); }
  // the rollback commit: under the upgrade route the first after M whose body carries the exact line "This reverts commit <sha>." — the line git revert writes and
  // the print's second -m; a commit merely quoting the phrase is not it. Before that commit, as the print's check runs, the working tree is the rolled-back state
  // over L = HEAD, M in its history; M absent from HEAD's history is a reset, which the rollback never is
  const revertOf = (c) => { const line = `This reverts commit ${c}.`; return git('log', '--reverse', '--format=%H', '--extended-regexp', '--grep', `^${esc(line)}$`, `${c}..HEAD`).split('\n').filter(Boolean).find((r) => lines(git('show', '-s', '--format=%B', r)).includes(line)) || ''; };
  const ancestor = (c) => { try { execFileSync('git', ['merge-base', '--is-ancestor', c, 'HEAD'], { cwd: root, stdio: 'ignore' }); return true; } catch { return false; } };
  const revert = !m ? '' : UP ? revertOf(m) : git('log', '--format=%H', `${m}..HEAD`, '--grep', `This reverts commit ${m}`).split('\n')[0];
  let L = revert ? `${revert}^` : '';
  if (!revert && UP && m && ancestor(m)) { L = head(); notes.push(`no commit after ${m.slice(0, 7)} carries the line "This reverts commit ${m}." yet: the working tree is read as the rolled-back state over L = HEAD (${L.slice(0, 7)}), the print's check before the commit; after the commit the check finds it by that line (a rollback committed without it: amend its message)`); }
  if (!revert && !L) fails.push(m ? `no commit reverting ${m.slice(0, 7)} found${UP ? `, and ${m.slice(0, 7)} is not in HEAD's history` : ''}; the rollback is git revert, never a reset (3.10)` : 'no "MIGRATE: ..." commit found after the snapshot');
  const Lsha = L ? git('rev-parse', L) : '', later = new Map(); // every path later work touched, with git's status letter
  if (L) for (const l of git('diff', '--name-status', '--no-renames', m, L).split('\n').filter(Boolean)) { const [st, p] = l.split('\t'); if (p.startsWith(prefix)) later.set(p.slice(prefix.length), st[0]); } // no rename pairing: a deleted file and a new one with the same bytes are two events
  const addedByM = new Set(m ? git('diff', '--name-status', '--no-renames', `${m}^`, m).split('\n').filter((l) => /^A\t/.test(l)).map((l) => l.split('\t')[1]).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length)) : []); // files the migration created: the revert removes them
  let same = 0;
  for (const f of inv.files) {
    const p = join(root, f.path);
    if (!existsSync(p)) { if (later.get(f.path) === 'D') warns.push(`${f.path}: later work deleted it and the revert keeps the deletion; confirm`); else fails.push(`${f.path}: missing after the rollback`); continue; }
    const isItem = UP && /^project\/items\/[^/]+\.md$/.test(f.path), view = isItem ? withoutNow : (t) => t; // an item file's ## Now sections leave the comparison and the line arithmetic (V31-NOW): a kept later Now is correct
    const buf = readFileSync(p), restored = sha(buf) === f.sha256, outsideNow = !restored && isItem && view(text8(buf)) === view(text8(show(inv.sourceCommit, f.path)));
    if (restored) same++;
    if (!later.has(f.path)) { if (!restored && !outsideNow) fails.push(`${f.path}: differs from the snapshot and no later commit touched it`); else if (outsideNow) notes.push(`${f.path}: equals the snapshot outside its ## Now section; the Now it carries is the current one`); continue; }
    // later work touched a snapshot file: every original line it kept and every line it added must still be present (reconciled, never
    // discarded); the migration's own rewrites, present at M and absent at S, are what the revert removes; a line later work removed that is back is reported
    const norm = UP && f.path === 'project/wish-list.md' ? (l) => l.replace(/^- (.*)$/, (_, w) => `- ${strip(w)}`) : (l) => l; // a stamped wish line counts as its unstamped self
    const count = (ls) => { const c = new Map(); for (const l of ls.map(norm)) if (l.trim()) c.set(l, (c.get(l) || 0) + 1); return c; }; // multiplicity counts; order is not compared
    const S = count(lines(view(text8(show(inv.sourceCommit, f.path))))), Mt = count(lines(view(text8(show(m, f.path))))), Lt = count(lines(view(text8(show(L, f.path))))), H = count(lines(view(text8(buf))));
    const short = (l) => `"${l.slice(0, 50)}${l.length > 50 ? '…' : ''}"`;
    // the revert of M on top of L leaves, for each line, L − (M − S) + (S − M) copies: fewer than L minus the migration's own additions is later work lost;
    // fewer than that expectation otherwise is a migration-rewritten line not restored; more, where later work had removed copies, is its deletion undone.
    // Leniency: a line in none of S, M and L (a resurrected wish reworded, a new line) is not flagged by itself; a reworded line fails through the original's count
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
    if (!lost.length && !back.length && !notBack.length) warns.push(`${f.path}: ${restored ? 'equals the snapshot' : outsideNow ? 'equals the snapshot outside its ## Now section' : 'differs from the snapshot'} and carries later work (${added} lines it added present${isItem ? ', its ## Now section apart' : ''}); review the reconciliation`);
  }
  for (const [p, st] of later) if (!inv.files.some((f) => f.path === p) && st !== 'D') { // files later work created, and files the migration created that later work edited
    if (addedByM.has(p)) { // the revert removes it; later work's lines in it are reconciled into a home the restored version has, by hand
      const added = Number(git('diff', '--numstat', m, L, '--', p).split('\t')[0]) || 0; // lines later work added since M, by diff: a replaced line counts; net growth does not
      if (existsSync(join(root, p))) warns.push(`${p}: created by the ${UP ? 'upgrade' : 'migration'} and edited later; the revert removes it, so move later work's lines (${added} added since ${m.slice(0, 7)}) into a home the restored version has and remove this copy, or record why it stays`);
      else warns.push(`${p}: created by the ${UP ? 'upgrade' : 'migration'}, edited later and removed by the revert; later work's lines there (${added} added since ${m.slice(0, 7)}) are reconciled by hand — confirm where they went`);
      continue;
    }
    if (!existsSync(join(root, p))) fails.push(`${p}: a file later work added is gone after the rollback`);
    else if (sha(readFileSync(join(root, p))) !== sha(show(L, p) || Buffer.alloc(0))) fails.push(`${p}: a file later work added differs from its later state; the revert does not touch it, so restore it`);
  }
  for (const f of inv.local) if (!existsSync(join(root, f.path)) || sha(readFileSync(join(root, f.path))) !== f.sha256) warns.push(`${f.path}: an ignored settings file changed or is missing; outside the commit, restored by hand`);
  if (UP) {
    const left = [...addedByM].filter((p) => REPLACED.test(p) && existsSync(join(root, p)));
    if (existsSync(join(root, INVENTORY)) || left.length) warns.push(`${UP} files remain in the tree (${[...(existsSync(join(root, INVENTORY)) ? [INVENTORY] : []), ...left].join(', ')}); the revert is incomplete or later work re-added them`);
    const laterAll = new Set(L ? git('diff', '--name-only', '--no-renames', m, L).split('\n').filter(Boolean) : []); // repository-wide: a nested installation's root settings are outside the prefix
    for (const [p, s] of Object.entries(inv.rootSettings || {})) { // a nested installation's root settings: the hook merge reverted with the upgrade commit, an ignored file restored by hand; a later change to one is later work, reconciled, never discarded
      const f = join(top, p), h = typeof s === 'string' ? s : s.sha256, wasTracked = typeof s === 'string' || s.tracked !== false;
      if (!existsSync(f)) (wasTracked ? fails : warns).push(`${p}: the repository root's settings file is missing after the rollback${wasTracked ? '' : ' (ignored, outside the commit: restored by hand)'}`);
      else if (sha(readFileSync(f)) === h) { if (wasTracked && laterAll.has(p)) warns.push(`${p}: equals the snapshot's bytes, yet a later commit touched it: a later change was discarded; reconcile it, never discard`); else notes.push(`${p}: restored to the snapshot's bytes`); }
      else if (!wasTracked) warns.push(`${p}: an ignored settings file at the repository root changed since the snapshot; outside the commit, restored by hand`);
      else if (laterAll.has(p)) warns.push(`${p}: differs from the snapshot and a later commit touched it; review the reconciliation`);
      else fails.push(`${p}: the repository root's settings file differs from the snapshot and no later commit touched it; the revert restores the hook merge with the upgrade commit`);
    }
    for (const [rel, f] of settingsFiles()) for (const w of hookPaths(readFileSync(f, 'utf8'))) { // a hook naming a tool the revert removed fails at every start
      const p = w.replace(/^\$\{?CLAUDE_PROJECT_DIR\}?\//, '').replace(/^~(?=\/)/, process.env.HOME || '~');
      if (!existsSync(isAbsolute(p) ? p : join(top, p)) && !existsSync(join(root, p))) fails.push(`${rel}: names ${w}, which is not in the tree after the rollback; a dangling hook fails at every start — remove the hook or restore the tool`);
    }
  } else if (existsSync(join(root, 'project/rules.md')) || existsSync(join(root, INVENTORY))) warns.push('v3 files remain in the tree; the revert is incomplete or later work re-added them');
  notes.push(`rollback verified: ${same} of ${inv.files.length} snapshot files byte for byte; ${later.size} paths touched by later work${UP && L ? `; ${revert ? `reverted by ${revert.slice(0, 7)}` : 'the revert uncommitted'}, L = ${Lsha.slice(0, 7)}` : ''}`);
}

if (args.rollback) {
  const inv = loadInventory(), m = migrationCommit(inv.sourceCommit), DEC = decisionId(inv);
  if (!m) { console.error('migrate: no "MIGRATE: ..." commit found after the snapshot; nothing to roll back'); process.exit(1); }
  if (UP && !checkCommit(m, inv)) { for (const f of fails) console.log(`FAIL  ${f}`); console.log(`migrate: ${fails.length} failure(s); the named commit is not the upgrade's, so no steps are printed`); process.exit(1); }
  const laterCommits = git('log', '--format=%h %s', `${m}..HEAD`, ...(UP ? [] : ['--', '.'])).split('\n').filter(Boolean); // the upgrade route counts every later commit, repository-wide: one touching only the root settings conflicts with the revert too
  const touched = git('diff', '--name-only', `${m}^`, m).split('\n').filter(Boolean);
  const overlap = laterCommits.length ? git('diff', '--name-only', m, 'HEAD').split('\n').filter((p) => p && touched.includes(p)) : [];
  const runner = inv.runner || `${prefix}tools/migrate.mjs`, copy = `/tmp/pm-next-${UP || 'v3'}-migrate.mjs`;
  if (!UP) {
    console.log(`Rollback of the migration commit ${m.slice(0, 7)} (${git('show', '-s', '--format=%s', m)}). The steps; this tool performs none of them:
1. Stop every other writer; \`git status\` must be clean. Later work since the migration: ${laterCommits.length ? laterCommits.join('; ') : 'none'} — it is reconciled, never discarded.
2. Keep the tool for the verification, since the revert removes v3's tools: git show ${m}:${runner} > ${copy}
3. git revert --no-edit ${m}   — never git reset --hard. ${overlap.length ? `Later work also changed ${overlap.join(', ')}: where the revert conflicts, keep the later work's lines inside the pre-migration structure, then git add them and git revert --continue.` : 'No later commit touched a file the migration changed, so no conflict is expected.'}
4. node ${copy} --verify --rolled-back --root ${root}   — every snapshot file byte for byte; files later work touched reported apart, every line it kept or added present, files it created present.
5. Reconcile later work written in v3's grammar — the rules file, Direction, Session-end lines, decisions in the slice form — into the v2 record, and run v2's node tools/check.mjs.
6. Commit as "MIGRATE: rolled back — <reason>", record the decision, push by the profile's route. The snapshot and the inventory stay in history at ${m.slice(0, 7)}.`);
  } else {
    const status = (a, b) => git('diff', '--name-status', '--no-renames', a, b).split('\n').filter(Boolean).map((l) => l.split('\t'));
    const addedByM = status(`${m}^`, m).filter(([s]) => s === 'A').map(([, p]) => p), modifyDelete = overlap.filter((p) => addedByM.includes(p)), content = overlap.filter((p) => !addedByM.includes(p));
    const touching = laterCommits.length && touched.length ? git('log', '--format=%h %s', `${m}..HEAD`, '--', ...touched.map((p) => `:/${p}`)).split('\n').filter(Boolean) : []; // the fact, repository-wide; whether the revert conflicts is Git's to say
    const laterCreated = laterCommits.length ? status(m, 'HEAD').filter(([s, p]) => s === 'A' && p.startsWith(prefix)).map(([, p]) => p) : [];
    const laterDiff = laterCommits.length ? git('diff', m, 'HEAD', '--', '.') : '';
    const stamped = laterDiff.split('\n').filter((l) => /^\+- /.test(l) && STAMP.test(l.slice(3))).length, nowSections = laterDiff.split('\n').filter((l) => /^\+## Now\s*$/.test(l)).length;
    const removedTools = addedByM.filter((p) => p.startsWith(prefix) && REPLACED.test(p.slice(prefix.length))).map((p) => p.slice(prefix.length));
    const naming = settingsFiles().map(([rel, f]) => [rel, removedTools.filter((t) => readFileSync(f, 'utf8').includes(`${prefix}${t}`)), trackedAtTop(rel)]).filter(([, ts]) => ts.length); // the repository root's settings files, tracked or ignored, that name a removed tool
    const localNaming = inv.local.map((f) => [f.path, existsSync(join(root, f.path)) ? removedTools.filter((t) => readFileSync(join(root, f.path), 'utf8').includes(t)) : null]); // ignored settings, hashed at the snapshot: outside the commit, the session's to edit
    const grepHits = removedTools.map((t) => [t, (() => { try { return execFileSync('git', ['grep', '-l', '--full-name', '--fixed-strings', '-e', `${prefix}${t}`, 'HEAD', '--', ':/'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).trim().split('\n').map((l) => l.replace(/^HEAD:/, '')).filter((p) => p && !touched.includes(p)); } catch { return []; } })()]).filter(([, ps]) => ps.length); // what else names a removed tool at HEAD, the upgrade commit's own files apart
    const from = inv.from || 'v3', wish = `${prefix}project/wish-list.md`;
    console.log(`Rollback of the upgrade commit ${m.slice(0, 7)} (${git('show', '-s', '--format=%s', m)}), ${from} restored; L = HEAD (${head()}). The steps; this tool performs none of them:
1. Stop every other writer; \`git status\` must be clean, and anything uncommitted or ignored that matters is kept aside first. Later commits since ${m.slice(0, 7)}: ${laterCommits.length}${laterCommits.length ? ` (${laterCommits.join('; ')})` : ''}; those touching ${m.slice(0, 7)}'s files: ${touching.length ? touching.join('; ') : 'none'}. Later work is reconciled, never discarded.
2. Keep the tool for the verification, since the revert removes the upgrade's files: git show ${m}:${q(runner)} > ${q(copy)}   (the inventory, ${q(INVENTORY)}, is read from ${m.slice(0, 7)} by the check, never from disk)
3. git revert --no-commit ${m}   — never git reset --hard. Changed by the upgrade and by later work, where the revert conflicts on content: ${content.length ? content.map(q).join(', ') : 'none'} — keep later work's lines inside the restored ${from} structure, then git add each${content.includes(wish) ? `; ${q(wish)}: take the later side with the stamps kept — ${from}'s ledger reads a stamped line as a wish and traces a removed wish line by its idea, so de-stamping would flag every line` : ''}. Created by the upgrade and edited by later work, where it conflicts as modify/delete: ${modifyDelete.length ? modifyDelete.map(q).join(', ') : 'none'} — move later work's lines into a home the restored version has, then git rm each. The revert removes ${q(INVENTORY)}; keep no copy on disk.
4. Reconcile later work in ${UP}'s grammar, which stays valid ${from}: ${stamped} stamped wish line(s) (a leading permanent ID; ${from}'s checker reads the line as a wish) and ${nowSections} "## Now" section(s) in item files (${from}'s checker reads no such section) — keep them, each item's latest Now; Session-end lines are ${from}'s too. Files later work created, which the revert leaves in place: ${laterCreated.length ? laterCreated.map(q).join(', ') : 'none'}.
5. Settings naming a tool the revert removes (${removedTools.length ? removedTools.join(', ') : 'none'}): at the repository root — ${naming.length ? naming.map(([rel, ts, isTracked]) => `${rel} (${isTracked ? 'tracked' : 'ignored'}) names ${ts.join(', ')}${touched.includes(rel) ? ' and the upgrade commit changed that file too, so the revert restores it with the hook removed' : '; the upgrade commit did not change that file, so edit it by hand before the check, or the client reports a failing hook at every start'}`).join('; ') : 'none'}; ignored settings files hashed at the snapshot, outside the commit and edited by hand — ${localNaming.length ? localNaming.map(([p, ts]) => `${q(p)}${ts === null ? ' (missing)' : ts.length ? ` names ${ts.join(', ')}` : ' names none'}`).join('; ') : 'none'}; other files naming them at HEAD (git grep -l, the upgrade commit's own files apart) — ${grepHits.length ? grepHits.map(([t, ps]) => `${t}: ${ps.map(q).join(', ')}`).join('; ') : 'none'}. Edit each before the check: a hook left naming a removed tool fails it.
6. node ${q(copy)} --verify --rolled-back --upgrade ${UP} --commit ${m} --root ${q(root)}${args.inventory ? ` --inventory ${q(args.inventory)}` : ''}   — before the commit, on the resolved tree (L = HEAD until the commit; after it, the check finds the commit by its body line): every snapshot file byte for byte, an item file outside its ## Now; files later work touched reported apart, every line it kept or added present, a stamped wish line counted as its unstamped self; files it created present; files the upgrade created and later work edited reported for the hand reconciliation, with the lines added since ${m.slice(0, 7)}; the root settings restored, a later change to them discarded reported, and no hook left naming a removed tool.
7. One commit: git commit -m ${q(`${DEC}: rolled back — <reason>`)} -m ${q(`This reverts commit ${m}.`)}   — the second -m is the exact body line the check finds the commit by.
8. Record the decision (${DEC}); run ${from}'s node tools/check.mjs through the restored tools, then the gate; push by the profile's route. The snapshot and the inventory stay in history at ${m.slice(0, 7)}.`);
  }
}

// ---- V31-WISH-IDS: the wish IDs stamped at the v3.1 upgrade, and their check
// The stamp of a wish-list text: each active unstamped line `- idea — (from: ORIGIN, date)` gains `ORIGIN.N — `, N one
// above the highest number the origin has in the file or in `floors` (every number its wish list ever held, and the commit
// messages, up to the parent), in file order; returns the text, the pairs of lines and any line it refuses.
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const MAX_N = 999999999; // a checked bound: numbers stay exact
function stampText(text, floors = new Map()) {
  const raw = text.split('\n'), act = active(text).split('\n'), max = new Map(floors), refused = [], pairs = [], seen = new Set();
  const FROM = new RegExp(`^- (.+) — \\(from: (${ID}), (${DATE})\\)\\r?$`), STAMPED = new RegExp(`^(${ID})\\.([1-9][0-9]*) — `);
  act.forEach((l, i) => {
    if (!/^\s*[-*+] /.test(l)) return;
    const m = l.match(FROM);
    if (!m || raw[i].replace(/^\uFEFF/, '').replace(/\r$/, '') !== l.replace(/\r$/, '') || !validDate(m[3])) { refused.push(`line ${i + 1}: not "- idea — (from: ID, YYYY-MM-DD)" with a valid date and no comment inside; repair it in a reviewed commit first, never guessed: ${l.slice(0, 60)}`); return; }
    const st = m[1].match(STAMPED);
    if (!st) return;
    const n = Number(st[2]), id = `${st[1]}.${st[2]}`;
    if (st[1] !== m[2]) refused.push(`line ${i + 1}: wish ${id} does not carry its origin's ID, ${m[2]}`);
    else if (n > MAX_N) refused.push(`line ${i + 1}: wish number ${st[2]} is beyond ${MAX_N}`);
    else if (seen.has(id)) refused.push(`line ${i + 1}: duplicate wish ID ${id}`);
    else { seen.add(id); max.set(st[1], Math.max(max.get(st[1]) || 0, n)); }
  });
  if (refused.length) return { text, pairs, refused };
  act.forEach((l, i) => {
    const m = /^\s*[-*+] /.test(l) && l.match(FROM);
    if (!m || STAMPED.test(m[1])) return;
    const n = (max.get(m[2]) || 0) + 1; max.set(m[2], n);
    if (n > MAX_N) { refused.push(`line ${i + 1}: origin ${m[2]} has no wish number left below ${MAX_N}`); return; }
    const from = raw[i]; raw[i] = raw[i].replace(/^(\uFEFF?)- /, `$1- ${m[2]}.${n} — `); pairs.push({ id: `${m[2]}.${n}`, line: i + 1, from, to: raw[i] });
  });
  return refused.length ? { text, pairs: [], refused } : { text: raw.join('\n'), pairs, refused };
}
// Every wish number an origin has used, up to a revision: the lines its wish list ever held and the commit messages.
function floorsAt(rev) {
  const floors = new Map();
  let log = ''; try { log = git('log', '--format=%B', rev) + git('log', '-p', '--format=', rev, '--', WISHES); } catch { /* no history */ }
  for (const m of log.matchAll(new RegExp(`(?<![\\p{L}\\p{N}_.-])(${ID})\\.([1-9][0-9]{0,8})(?![\\p{L}\\p{N}_-]|\\.[\\p{L}\\p{N}])`, 'gu'))) floors.set(m[1], Math.max(floors.get(m[1]) || 0, Number(m[2])));
  return floors;
}
const rawText = (buf) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf); // a byte-order mark kept
if (args['stamp-wishes']) {
  if (git('status', '--porcelain', '--', WISHES)) { console.error(`migrate: ${WISHES} has uncommitted changes; the stamp is checked against the last commit, so commit or discard them first`); process.exit(1); }
  const { text, pairs, refused } = stampText(rawText(readFileSync(join(root, WISHES))), floorsAt('HEAD'));
  for (const r of refused) fails.push(`${WISHES} ${r}`);
  if (!fails.length && pairs.length) writeFileSync(join(root, WISHES), text);
  if (!fails.length) notes.push(pairs.length ? `${pairs.length} wish lines stamped, no other byte changed: ${pairs.map((p) => `${p.id} ← line ${p.line}`).join('; ')}. Next: commit the stamp in a commit of its own, then node tools/migrate.mjs --verify-stamp; the rollback is git revert of that commit, then --verify-stamp --rolled-back` : 'nothing to stamp: every wish line carries its ID');
  else notes.push('nothing written');
}
if (args['verify-stamp']) {
  const rev = git('rev-parse', '--verify', `${args.commit || 'HEAD'}^{commit}`), at = (r) => { const b = show(r, WISHES); return b ? rawText(b) : ''; };
  if (!args['rolled-back']) { // the stamp commit: its wish list is exactly the stamp of its parent's
    const { text, pairs, refused } = stampText(at(`${rev}^`), floorsAt(`${rev}^`)), after = at(rev);
    for (const r of refused) fails.push(`${WISHES} at the parent ${r}`);
    if (!refused.length && after !== text) { const a = after.split('\n'), e = text.split('\n'), i = e.findIndex((l, k) => l !== a[k]); fails.push(`${WISHES}: commit ${rev.slice(0, 7)} is not exactly the stamp of its parent; first difference at line ${(i < 0 ? e.length : i) + 1}: expected "${(e[i] ?? '').slice(0, 60)}", found "${(a[i] ?? '').slice(0, 60)}"`); }
    if (!fails.length) notes.push(`stamp verified at ${rev.slice(0, 7)}: ${pairs.length} lines stamped, every other byte of ${WISHES} unchanged`);
  } else { // the revert: each stamped line later work kept is back in its pre-stamp form; later work, retirements and rewordings included, kept
    const msg = git('show', '-s', '--format=%B', rev), stampRev = msg.match(/This reverts commit ([0-9a-f]{7,40})/)?.[1];
    if (!stampRev) fails.push(`commit ${rev.slice(0, 7)} reverts no commit; the rollback is git revert of the stamp commit, never a reset (3.10)`);
    else {
      const count = (t) => { const c = new Map(); for (const l of t.split('\n')) if (l.trim()) c.set(l, (c.get(l) || 0) + 1); return c; }, g = (c, l) => c.get(l) || 0;
      const { pairs } = stampText(at(`${stampRev}^`), floorsAt(`${stampRev}^`)), E = count(at(`${rev}^`)), H = count(at(rev));
      for (const p of pairs) if (g(E, p.to) > 0) { E.set(p.to, g(E, p.to) - 1); E.set(p.from, g(E, p.from) + 1); } // a stamped line later work removed or reworded stays as later work left it
      for (const l of new Set([...E.keys(), ...H.keys()])) {
        if (g(H, l) < g(E, l)) fails.push(`${WISHES}: after the revert "${l.slice(0, 60)}" is missing ${g(E, l) - g(H, l)} time(s); restore it — a pre-stamp line or later work, never discarded`);
        else if (g(H, l) > g(E, l)) fails.push(`${WISHES}: after the revert "${l.slice(0, 60)}" is there ${g(H, l) - g(E, l)} time(s) too many — a line later work removed or reworded is not brought back`);
      }
      if (!fails.length) notes.push(`stamp rollback verified at ${rev.slice(0, 7)}: each stamped line later work kept is back in its pre-stamp form, and later work is kept; later lines that carry IDs stay valid under v3's grammar`);
    }
  }
}
for (const [list, tag] of [[notes, 'INFO'], [warns, 'WARN'], [fails, 'FAIL']]) for (const msg of list) console.log(`${tag}  ${msg}`);
if (!args.rollback) console.log(`migrate: ${fails.length} failure(s), ${warns.length} warning(s)`);
process.exitCode = fails.length ? 1 : 0;
