#!/usr/bin/env node
// pm-skills 5 harness configuration generator. Zero dependencies.
// usage: node tools/harness.mjs [--root <dir>] [--harness claude,codex] [--print] [--force] [--hooks-only]
//
// Writes, for every harness the profile names, the settings the profile's Push and Network lines ask for (sessions) and a
// second set with the network open for the intake verb only, each carrying the three session hooks of specification 3.15:
// the compaction hook (SessionStart, source compact) and the sensor (PostToolUse and the other SessionStart sources), both
// `tools/session.mjs`, and the start notice (SessionStart, sources startup and clear), `tools/handover.mjs`. `--hooks-only`
// merges the hooks alone into the existing settings, unrelated settings preserved, for a project that keeps its own
// permissions. Two facts learned the hard way, still encoded:
//   * A Codex prefix rule in a rules file is NOT a network control — a compound command walks straight past it. Only
//     [permissions.<profile>.network] closes the network.
//   * Codex >=0.134 layers a named profile over user config; trusted project config can override it.
// Where a harness cannot enforce a value, the line is an instruction and the generated file says so. The owner reviews
// everything this writes; a generated file is not an enforcement test.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join, basename, posix } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { options, field, pushRoute, networkChoice } from './ledger.mjs';

const args = options(['harness', 'print', 'force', 'hooks-only']);
const root = args.root, print = args.print, force = args.force, hooksOnly = args['hooks-only'];
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const prefix = git('rev-parse', '--show-prefix'); // an adapter below the repository root owns its installation root
const hooksRoot = hooksOnly && prefix ? git('rev-parse', '--show-toplevel') || root : root;
const hookPath = (rel) => hooksRoot === root ? rel : join(hooksRoot, rel); // name the repository-level destination in notes
const profilePath = join(root, 'project', 'profile.md');
const profile = existsSync(profilePath) ? readFileSync(profilePath, 'utf8') : '';

// ---- which harnesses
let names = (args.harness || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!names.length) {
  const line = field(profile, 'Harness');
  if (/claude/i.test(line)) names.push('claude');
  if (/codex/i.test(line)) names.push('codex');
}
if (!names.length || names.some((n) => !['claude', 'codex'].includes(n))) {
  console.error('harness: name the harnesses — `--harness claude,codex`, or fill the profile\'s Harness line.');
  process.exit(2);
}
names = [...new Set(names)];

// ---- the profile's Push and Network lines (3.5): the same grammar as the checker; nothing defaulted
const pushLine = field(profile, 'Push'), networkLine = field(profile, 'Network');
const route = pushRoute(pushLine), choice = networkChoice(networkLine);
/** @param {string} name @param {string} line @param {unknown} ok @param {string} sentence */
const problem = (name, line, ok, sentence) => /\[his:/i.test(line) ? `harness: the profile's ${name} line still carries a [his: …] question, so the owner has not answered it; answer it and take the marker out before the settings are written.` : ok ? '' : `harness: the profile's ${name} line must ${sentence}; it is not defaulted.`; // each failing or unanswered line named, with the checker's own sentence (final-QC ease 4)
const problems = [problem('Push', pushLine, route, 'say that the harness pushes to the project\'s origin or to a named host, or that it is owner-operated (3.5)'), problem('Network', networkLine, choice, 'be closed, listed hosts with at least one host name, or open (3.5)')].filter(Boolean);
if (problems.length) { console.error(problems.join('\n')); process.exit(2); }
const harnessPush = route === 'harness', network = choice.kind, hosts = choice.hosts;
const sessionLine = field(profile, 'Session') || '350k tokens of context';
const pushNoteFor = (nw) => harnessPush
  ? `Push: ${pushLine} — git push is allowed and runs at every close${nw === 'closed' ? '; the Network line is closed, so the push host is unreachable here and each close reports a pending push until Network lists it' : nw === 'listed' ? '; the listed hosts must include the push host' : ''}.`
  : `Push: ${pushLine} — the owner pushes from outside; Claude Code denies git push in sessions, Codex has no push control, so there the line is an instruction only.`;
const networkNoteFor = (nw) => ({ closed: 'Network: closed — shell network denied where the client enforces it.', listed: `Network: listed hosts ${hosts.join(', ')} — allowed where the client enforces a host list; where it cannot, this is an instruction and the value degrades to open.`, open: 'Network: open.' }[nw]);
const pushNote = pushNoteFor(network), networkNote = networkNoteFor(network);
const hooksNote = `Session hooks (3.15): SessionStart(compact) adds the re-read notice; tools/session.mjs on PostToolUse and the other SessionStart sources reports this session's context against the profile's Session line (${sessionLine}); tools/handover.mjs on SessionStart(startup|clear) shows a fresh chat the last session end in this checkout's Git history while it is current, and claims it for that chat in Git's common directory. They force nothing and cannot show that a re-read happened; where the client does not run them, or denies them the transcript, nothing reports the context and a fresh chat starts from the record.`;

const H = homedir();
const slug = (basename(root) || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
// Directories no session should read or write, whichever harness is running. The sensor reads the transcript the hook names
// as the harness's own process, outside this sandbox; nothing here is weakened for it. Claude Code expands `~/` in sandbox
// paths and permission rules, so its committed settings name no home folder; the Codex profile keeps absolute paths.
const secretRel = ['.ssh', '.aws', '.gnupg', '.config/gcloud', '.claude', '.codex', '.npmrc'];
const secretDirs = secretRel.map((d) => `${H}/${d}`), claudeSecret = secretRel.map((d) => `~/${d}`);
// On macOS gh cannot verify TLS inside Claude Code's sandbox (the trust service is denied; Claude Code 2.1.267) and Codex
// cannot read its own store there (0.155.1). With github.com listed, gh runs outside the sandbox, and so does Codex when the
// profile's Harness line names it and the network is not closed; each call still goes through the permission flow.
const ghOutside = network === 'listed' && hosts.includes('github.com');
const excluded = [...(ghOutside ? ['gh *'] : []), ...(network !== 'closed' && /codex/i.test(field(profile, 'Harness')) ? ['codex *'] : [])];
const badPrefixes = ['curl', 'wget', ...(ghOutside ? [] : ['gh', 'git fetch', 'git pull']), 'git clone', ...(harnessPush ? [] : ['git push']), 'npx -y', 'npx --yes', 'pip install', 'brew'];
const excludedNote = excluded.length ? ` ${excluded.map((c) => c.split(' ')[0]).join(' and ')} run outside the sandbox (excludedCommands), so its filesystem denies and host list do not bind them; each call goes through the permission flow. On macOS gh cannot verify TLS inside it, and Codex cannot read its own store.` : '';
const out = {}, merged = {}, notes = [];
const SENSOR = 'tools/session.mjs', NOTICE = 'tools/handover.mjs';
// Ours is a whole command of the shape this generator writes, or wrote: node, one shell word naming tools/session.mjs or
// tools/handover.mjs, --harness and a harness, and at most a --root word. A word holds no shell operator and no substitution
// but a braced variable, so a compound command, a substitution or a mention is never ours.
const WORD = `"(?:[^"\\\\$\`]|\\\\.|\\$\\{[A-Za-z_][A-Za-z0-9_]*\\})*"|'(?:[^']|'"'"')*'|(?:[A-Za-z0-9_./~+@%=,:-]|\\$\\{[A-Za-z_][A-Za-z0-9_]*\\})+`;
const OURS = new RegExp(`^node (${WORD}) --harness (?:claude|codex)(?: --root (?:${WORD}))?$`);
const isOurs = (command) => {
  const m = typeof command === 'string' && command.match(OURS);
  return !!m && /(?:^|[\\/])tools[\\/](?:session|handover)\.mjs$/.test(m[1].replace(/^["']|["']$/g, ''));
};
const hook = (command) => ({ type: 'command', command, timeout: 5 });
const hookSet = (command, sources) => ({
  SessionStart: [{ matcher: 'compact', hooks: [hook(command(SENSOR))] }, { matcher: sources, hooks: [hook(command(SENSOR))] }, { matcher: 'startup|clear', hooks: [hook(command(NOTICE))] }],
  PostToolUse: [{ hooks: [hook(command(SENSOR))] }],
});
// Merge our hook entries into an existing hooks object, replacing only entries that run the sensor or the start notice; unrelated hooks stay.
const mergeHooks = (existing = {}, ours) => {
  const result = { ...existing };
  for (const [event, groups] of Object.entries(ours)) {
    const kept = (existing[event] || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h.command)) })).filter((g) => g.hooks.length);
    result[event] = [...kept, ...groups];
  }
  return result;
};
// The hook set as TOML arrays of tables, for the Codex profile.
const toml = (set) => Object.entries(set).map(([event, groups]) => groups.map((g) => `[[hooks.${event}]]\n${g.matcher ? `matcher = ${JSON.stringify(g.matcher)}\n` : ''}${g.hooks.map((k) => `[[hooks.${event}.hooks]]\ntype = "command"\ncommand = ${JSON.stringify(k.command)}\ntimeout = ${k.timeout}\n`).join('')}`).join('\n')).join('\n');
const readJson = (rel) => {
  if (!existsSync(join(hooksRoot, rel))) return null;
  try { return JSON.parse(readFileSync(join(hooksRoot, rel), 'utf8')); } catch { console.error(`harness: ${hookPath(rel)} exists but is not valid JSON; repair it first. Nothing written.`); process.exit(1); }
};

// ---- V31-GEN-KEEP: printing over a project's own settings keeps every restriction they hold. The existing files are the
// Claude pair the print writes and every reviewed Codex profile in harness/codex/, whose name it keeps (a name ending -intake is
// the intake profile, any other the sessions one). A key only the existing file holds is kept as written; a key both hold
// keeps the narrower value where the order is known; a difference with no known order refuses, naming it, and nothing is
// printed or written. The print never widens what an existing file narrows; to widen, the owner edits or removes the file.
const kept = [], refuse = [];
// A TOML subset, line by line: comments, [table], [[array]] and key = value on one line. Anything else refuses.
function parseToml(text) {
  const lines = text.split('\n'), root = { id: '[]', display: '', array: false, header: -1, last: -1, keys: new Map() }, sections = [root];
  const seen = new Set(['[]']);
  let cur = root;
  const unq = (k) => (k.startsWith('"') ? JSON.parse(k) : k.startsWith("'") ? k.slice(1, -1) : k);
  const SEG = /\s*("(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_-]+)\s*/y;
  const segments = (s) => { const out = []; SEG.lastIndex = 0; for (;;) { const m = SEG.exec(s); if (!m) return null; out.push(unq(m[1])); if (SEG.lastIndex === s.length) return out; if (s[SEG.lastIndex] !== '.') return null; SEG.lastIndex++; } };
  const value = (rest) => { // the value text before any comment outside quotes
    let q = '', i = 0;
    for (; i < rest.length; i++) { const c = rest[i]; if (q) { if (c === '\\' && q === '"') i++; else if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (c === '#') break; }
    const raw = rest.slice(0, i).trim();
    if (!raw || q || /^("""|''')/.test(raw) || (/^[[{]/.test(raw) && !/[\]}]$/.test(raw))) return null;
    if (/^"/.test(raw)) { try { return { raw, v: JSON.parse(raw) }; } catch { return null; } }
    if (/^'/.test(raw)) return { raw, v: raw.slice(1, -1) };
    if (raw === 'true' || raw === 'false') return { raw, v: raw === 'true' };
    if (/^[+-]?\d[\d_]*$/.test(raw)) return { raw, v: Number(raw.replace(/_/g, '')) };
    return { raw, v: { raw } };
  };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('#')) continue;
    const h = t.match(/^(\[\[?)\s*(.*?)\s*(\]\]?)\s*(?:#.*)?$/);
    if (h && h[1].length === h[3].length) {
      const segs = segments(h[2]); if (!segs) return { error: `line ${i + 1} is a table header this print cannot read` };
      const id = JSON.stringify(segs), array = h[1] === '[[';
      if (!array && seen.has(id)) return { error: `line ${i + 1} repeats the table [${h[2]}]` };
      seen.add(id); cur = { id, display: h[2], array, header: i, last: i, keys: new Map() }; sections.push(cur); continue;
    }
    const k = t.match(/^("(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    const v = k && value(k[2]);
    if (!v) return { error: `line ${i + 1} is not a one-line key = value this print can read` };
    if (v.raw.startsWith('{')) return { error: `line ${i + 1}: ${k[1]} is an inline table, which this print cannot merge with the tables it writes` };
    const key = unq(k[1]);
    if (cur.keys.has(key)) return { error: `line ${i + 1} repeats the key ${k[1]}` };
    cur.keys.set(key, { idx: i, rawKey: k[1], raw: v.raw, value: v.v }); cur.last = i;
  }
  return { lines, sections, table: (segs) => sections.find((s) => !s.array && s.id === JSON.stringify(segs)) };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Known orders, narrowest first; no other shared key has one. approval_policy and extends have none.
const tomlOrder = (id, key) => {
  const segs = JSON.parse(id);
  if (segs[0] === 'features' && segs.length === 1) return [false, true];
  if (key === 'enabled') return [false, true];
  if (segs[0] === 'permissions' && segs.at(-1) === 'filesystem') return ['deny', 'read', 'write'];
  if (segs[0] === 'permissions' && segs.at(-2) === 'network' && segs.at(-1) === 'domains') return ['deny', 'allow'];
  if (!segs.length && key === 'web_search') return ['disabled', 'cached', 'live'];
  if (!segs.length && key === 'sandbox_mode') return ['read-only', 'workspace-write', 'danger-full-access'];
  return null;
};
// The generated profile with the reviewed one's restrictions written in: untouched lines stay byte for byte.
function keepCodex(E, gText, file) {
  const G = parseToml(gText), out = { kept: [], refuse: [] };
  if (G.error) throw new Error(`harness: the generated ${file} does not parse: ${G.error}`);
  const replace = new Map(), drop = new Set(), after = new Map(), tail = [];
  const add = (i, line) => after.set(i, [...(after.get(i) || []), line]);
  for (const s of E.sections) {
    const where = s.display ? `[${s.display}] ` : '';
    const segs = JSON.parse(s.id);
    if (segs[0] === 'hooks') { // only the shape this generator writes, running its own commands, is replaced; anything else refuses
      const shape = s.array && segs.length === 2 ? ['matcher'] : s.array && segs.length === 3 && segs[2] === 'hooks' ? ['type', 'command', 'timeout'] : null;
      if (!shape) { out.refuse.push(`${file}: ${s.array ? `[[${s.display}]]` : `[${s.display}]`} is a hooks table this print cannot carry; merge it by hand`); continue; }
      for (const [k, e] of s.keys) {
        if (!shape.includes(k)) out.refuse.push(`${file}: [[${s.display}]] holds ${k}, which this print does not write; merge it by hand`);
        else if (k === 'command' && !isOurs(e.value)) out.refuse.push(`${file}: [[${s.display}]] runs ${e.raw}, a hook this print does not carry; merge it by hand`);
      }
      // a whole group: each [[hooks.E]] holds at least one hook, and each hook is a command of ours
      if (segs.length === 2) { const next = E.sections.slice(E.sections.indexOf(s) + 1).find((x) => JSON.parse(x.id)[0] === 'hooks' && JSON.parse(x.id)[1] === segs[1]); if (!next || JSON.parse(next.id).length !== 3) out.refuse.push(`${file}: [[${s.display}]] has no hook of its own; merge it by hand`); }
      else if (s.keys.get('type')?.value !== 'command' || !s.keys.has('command')) out.refuse.push(`${file}: [[${s.display}]] runs no command of the shape this print writes; merge it by hand`);
      continue; // our own hooks are written afresh, or left out with [features] hooks off
    }
    if (s.array) { out.refuse.push(`${file}: [[${s.display}]] is an array of tables this print cannot carry; merge it by hand`); continue; }
    const g = G.sections.find((x) => !x.array && x.id === s.id);
    if (!g) {
      if (!s.keys.size) continue;
      tail.push('', E.lines[s.header]);
      for (const [, e] of s.keys) { tail.push(E.lines[e.idx]); out.kept.push(`${file}: ${where}${e.rawKey} = ${e.raw}`); }
      continue;
    }
    for (const [k, e] of s.keys) {
      const ge = g.keys.get(k);
      if (!ge) { add(g.last, E.lines[e.idx]); out.kept.push(`${file}: ${where}${e.rawKey} = ${e.raw}`); continue; }
      if (same(e.value, ge.value)) continue;
      const order = tomlOrder(s.id, k), re = order ? order.indexOf(e.value) : -1, rg = order ? order.indexOf(ge.value) : -1;
      if (re < 0 || rg < 0) { out.refuse.push(`${file}: ${where}${k} is ${e.raw} there and ${ge.raw} in the print, with no known order; settle it by hand`); continue; }
      if (re < rg) { replace.set(ge.idx, E.lines[e.idx]); out.kept.push(`${file}: ${where}${e.rawKey} = ${e.raw} (the print had ${ge.raw})`); }
    }
    // A reviewed host list: a host the print would allow and the list lacks is left out.
    if (segs[0] === 'permissions' && segs.at(-2) === 'network' && segs.at(-1) === 'domains') {
      for (const [k, ge] of g.keys) if (!s.keys.has(k) && ge.value !== 'deny') { drop.add(ge.idx); out.kept.push(`${file}: ${where}${ge.rawKey} = ${ge.raw} left out: the reviewed host list lacks it`); }
    }
    // A generated grant under a folder the reviewed profile restricts more, with no entry of its own there, is left out.
    if (tomlOrder(s.id, '')?.[0] === 'deny' && JSON.parse(s.id).at(-1) === 'filesystem') {
      const order = ['deny', 'read', 'write'];
      for (const [k, ge] of g.keys) {
        if (s.keys.has(k)) continue;
        const norm = (x) => posix.normalize(x).replace(/(.)\/$/, '$1'); // the same folder however it is spelled
        const parent = [...s.keys.entries()].filter(([a]) => norm(k) === norm(a) || norm(k).startsWith(norm(a) + '/')).sort((x, y) => norm(y[0]).length - norm(x[0]).length)[0];
        if (parent && order.indexOf(parent[1].value) < order.indexOf(ge.value)) { drop.add(ge.idx); out.kept.push(`${file}: ${where}${parent[1].rawKey} = ${parent[1].raw} kept whole; the print's ${ge.rawKey} = ${ge.raw} left out`); }
      }
    }
  }
  if (out.refuse.length) return out;
  const lines = [];
  G.lines.forEach((line, i) => { if (!drop.has(i)) lines.push(replace.get(i) ?? line); lines.push(...(after.get(i) || [])); });
  if (tail.length) { const end = lines.pop(); lines.push('', '# Kept from the reviewed profile: tables this print does not write.', ...tail.slice(1), end); }
  out.text = lines.join('\n');
  return out;
}
// Claude Code's settings: deny lists join; allow lists and exemptions narrow to what both hold; switches keep the narrower.
const UNION = new Set(['permissions.deny', 'permissions.ask', 'sandbox.filesystem.denyRead', 'sandbox.filesystem.denyWrite']);
const NARROW = new Set(['permissions.allow', 'permissions.additionalDirectories', 'sandbox.excludedCommands', 'sandbox.network.allowedDomains', 'sandbox.filesystem.allowWrite', 'sandbox.filesystem.allowRead']);
const NARROW_BOOL = { autoMemoryEnabled: false, 'sandbox.enabled': true, 'sandbox.failIfUnavailable': true, 'sandbox.autoAllowBashIfSandboxed': false, 'sandbox.allowUnsandboxedCommands': false, 'sandbox.network.strictAllowlist': true };
const plain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
function keepClaude(e, g, file, path = '') {
  const out = {};
  for (const k of new Set([...Object.keys(g), ...Object.keys(e)])) {
    const p = path ? `${path}.${k}` : k, ev = e[k], gv = g[k];
    if (p === '_pm_next_v3') { out[k] = gv; continue; }
    if (!(k in e)) {
      // a reviewed sandbox with no exemptions has none: the print adds none
      if (p === 'sandbox.excludedCommands') { kept.push(`${file}: ${p} none (the print had ${JSON.stringify(gv)})`); continue; }
      out[k] = gv; continue;
    }
    if (!(k in g)) { out[k] = ev; kept.push(`${file}: ${p} ${JSON.stringify(ev)}`); continue; }
    if (p === 'hooks' && plain(ev) && plain(gv)) { out[k] = mergeHooks(ev, gv); continue; } // ours replaced, theirs kept, as --hooks-only
    if (same(ev, gv)) { out[k] = gv; continue; }
    if (UNION.has(p) && Array.isArray(ev) && Array.isArray(gv)) {
      const extra = ev.filter((x) => !gv.some((y) => same(x, y)));
      out[k] = [...gv, ...extra]; for (const x of extra) kept.push(`${file}: ${p} ${typeof x === 'string' ? x : JSON.stringify(x)}`); continue;
    }
    if (NARROW.has(p) && Array.isArray(ev) && Array.isArray(gv)) {
      const both = ev.includes('*') ? gv : gv.includes('*') ? ev : gv.filter((x) => ev.some((y) => same(x, y)));
      if (!same(both, gv)) kept.push(`${file}: ${p} ${JSON.stringify(both)} (the print had ${JSON.stringify(gv)})`);
      if (both.length || p !== 'sandbox.excludedCommands') out[k] = both;
      continue;
    }
    if (p === 'sandbox.credentials.envVars' && Array.isArray(ev) && Array.isArray(gv) && [...ev, ...gv].every((x) => plain(x) && typeof x.name === 'string')) {
      const merged = gv.map((x) => ({ ...x }));
      for (const x of ev) {
        const y = merged.find((m) => m.name === x.name);
        if (!y) { merged.push(x); kept.push(`${file}: ${p} ${x.name} ${x.mode}`); } else if (!same(x, y)) { if (x.mode === 'deny' || y.mode === 'deny') { if (y.mode !== 'deny') kept.push(`${file}: ${p} ${x.name} deny (the print had ${y.mode})`); y.mode = 'deny'; } else refuse.push(`${file}: ${p} ${x.name} is ${JSON.stringify(x)} there and ${JSON.stringify(y)} in the print, with no known order; settle it by hand`); }
      }
      out[k] = merged; continue;
    }
    if (p in NARROW_BOOL && typeof ev === 'boolean' && typeof gv === 'boolean') {
      out[k] = NARROW_BOOL[p]; if (ev === NARROW_BOOL[p]) kept.push(`${file}: ${p} ${ev} (the print had ${gv})`); continue;
    }
    if (plain(ev) && plain(gv)) { out[k] = keepClaude(ev, gv, file, p); continue; }
    refuse.push(`${file}: ${p} is ${JSON.stringify(ev)} there and ${JSON.stringify(gv)} in the print, with no known order; settle it by hand`);
    out[k] = gv;
  }
  return out;
}
// The reviewed Codex profiles, by role, read before anything is generated.
const reviewedCodex = {};
const codexDenies = []; // folder and file denials a reviewed Codex profile holds, carried into Claude Code's print too
if (!hooksOnly && existsSync(join(root, 'harness/codex'))) {
  for (const f of readdirSync(join(root, 'harness/codex')).filter((x) => x.endsWith('.config.toml')).sort((a, b) => a.endsWith('-intake.config.toml') - b.endsWith('-intake.config.toml') || (a < b ? -1 : a > b ? 1 : 0))) { // sessions first
    const name = f.slice(0, -'.config.toml'.length), role = name.endsWith('-intake') ? 'intake' : 'sessions', file = `harness/codex/${f}`;
    if (reviewedCodex[role]) { refuse.push(`harness/codex/: two profiles for the ${role} role, ${reviewedCodex[role].file} and ${file}; leave one, or merge by hand`); continue; }
    const parsed = parseToml(readFileSync(join(root, file), 'utf8'));
    if (parsed.error) { refuse.push(`${file}: ${parsed.error}; merge it by hand`); continue; }
    const dp = parsed.sections[0].keys.get('default_permissions')?.value;
    if (dp !== name) { refuse.push(`${file}: default_permissions is ${JSON.stringify(dp)}, not the file's name ${name}; settle it by hand`); continue; }
    reviewedCodex[role] = { file, name, parsed };
    for (const s of parsed.sections) {
      const segs = JSON.parse(s.id);
      if (s.array || segs[0] !== 'permissions' || segs.at(-1) !== 'filesystem') continue;
      for (const [path, e] of s.keys) {
        if (e.value !== 'deny' || codexDenies.some((d) => d.path === path)) continue;
        if (path.startsWith('/') || path.startsWith('~/')) codexDenies.push({ path: path.startsWith('~/') ? H + path.slice(1) : path, from: file });
        else if (names.includes('claude')) refuse.push(`${file}: [${s.display}] ${e.rawKey} = "deny" cannot be carried into the Claude Code print: not an absolute path; settle it by hand`);
      }
    }
  }
}
// The rules file's sentence forbidding an install outside the project, if any: the print then proposes none.
const rulesPath = join(root, 'project', 'rules.md');
const forbidInstall = (existsSync(rulesPath) ? readFileSync(rulesPath, 'utf8') : '').replace(/\s+/g, ' ').split(/(?<=[.;])\s+/)
  .find((s) => /CODEX_HOME|globally|global (?:install|client|user|config|profile)|outside (?:the|this|its) (?:project|repository|folder)|only (?:inside|within|in) (?:the|this|its) (?:project|repository|folder)/i.test(s)
    && /\b(?:install|copy|copied|profiles?|settings|config)/i.test(s) && /\b(?:never|not|no|nothing|only)\b|n't\b/i.test(s))
  ?.replace(/^[-*]\s+/, '').replace(/"/g, "'").slice(0, 200) || null;
// Carry a reviewed Codex profile's denials into a Claude Code print: the sandbox's read and write denies and both forms of Read
// and Edit rule, a folder's and a file's. Home paths as ~/; elsewhere the sandbox takes /abs and a rule //abs.
function carry(obj, file) {
  for (const { path, from } of codexDenies) {
    const form = path === H || path.startsWith(H + '/') ? '~' + path.slice(H.length) : path, rule = form.startsWith('~') ? form : '/' + form;
    if (claudeSecret.includes(form)) continue; // the secret folders are denied already
    const fs = ((obj.sandbox ||= {}).filesystem ||= {}), perms = (obj.permissions ||= {});
    // fresh arrays: the generated settings share the secret-folder list between both denies and both files
    const lists = { denyRead: [...(fs.denyRead || [])], denyWrite: [...(fs.denyWrite || [])], deny: [...(perms.deny || [])] };
    const adds = [['denyRead', form], ['denyWrite', form], ...['Read', 'Edit'].flatMap((t) => [['deny', `${t}(${rule})`], ['deny', `${t}(${rule}/**)`]])].filter(([list, x]) => !lists[list].includes(x));
    if (!adds.length) continue;
    for (const [list, x] of adds) lists[list].push(x);
    [fs.denyRead, fs.denyWrite, perms.deny] = [lists.denyRead, lists.denyWrite, lists.deny];
    kept.push(`${file}: sandbox.filesystem.denyRead ${form} (from ${from}), with denyWrite and its Read and Edit denies`);
  }
}

if (names.includes('claude')) {
  const claudeHooks = hookSet((tool) => `node "\${CLAUDE_PROJECT_DIR}/${prefix}${tool}" --harness claude`, 'startup|resume|clear|fork');
  const deny = [
    ...(network === 'open' ? [] : ['WebFetch', 'WebSearch']), 'RemoteTrigger', 'EnterWorktree', 'ExitWorktree',
    'CronCreate', 'CronDelete', 'CronList', 'ScheduleWakeup', 'SendMessage', 'Workflow', 'ReportFindings',
    ...badPrefixes.map((p) => `Bash(${p} *)`),
    ...claudeSecret.flatMap((d) => [`Read(${d}/**)`, `Edit(${d}/**)`]), // Edit rules cover writes; the client reports Write rules inert
  ];
  const sessions = {
    permissions: { deny },
    autoMemoryEnabled: false,
    sandbox: {
      enabled: true, failIfUnavailable: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false,
      ...(excluded.length ? { excludedCommands: excluded } : {}),
      filesystem: { denyRead: claudeSecret, denyWrite: claudeSecret },
      network: network === 'open' ? { allowedDomains: ['*'], strictAllowlist: false } : { allowedDomains: hosts, strictAllowlist: true },
      // the documented shape: entries with a name and a mode; v2 wrote an object keyed by deny, which Claude Code rejected along with the whole file
      credentials: { envVars: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'GH_TOKEN', 'NPM_TOKEN', 'AWS_SECRET_ACCESS_KEY'].map((name) => ({ name, mode: 'deny' })) },
    },
    hooks: claudeHooks,
    _pm_next_v3: `Sessions. ${pushNote} ${networkNote}${excludedNote} Cloud-session and scheduling tools denied; secret directories unreadable to sandboxed commands; the harness's own auto-memory off (this ledger is the record). ${hooksNote} Claude Code loads these hooks from .claude/settings.json; the desktop app applied no generated setting in the exposed week, so verify in the client. Generated by tools/harness.mjs — review, then commit. Claude Code reads CLAUDE.md, which imports AGENTS.md.`,
  };
  const intake = JSON.parse(JSON.stringify(sessions));
  intake.permissions.deny = deny.filter((d) => d !== 'WebFetch' && d !== 'WebSearch');
  intake.sandbox.network = { allowedDomains: ['*'], strictAllowlist: false };
  intake._pm_next_v3 = `INTAKE ONLY: the network is open so official sources can be read for digests, whatever the Network line says for sessions. Run \`claude --settings .claude/settings.intake.json\`, with the owner present. Ordinary sessions use settings.json. ${hooksNote} Claude Code merges hooks from every settings file it loads, so with the project settings present each hook runs twice in intake; the sensor's state makes the second threshold notice silent, and the compaction notice repeats.`;
  if (hooksOnly) {
    const existing = readJson('.claude/settings.json') || {};
    merged['.claude/settings.json'] = JSON.stringify({ ...existing, hooks: mergeHooks(existing.hooks, claudeHooks) }, null, 2) + '\n';
    notes.push(`claude   hooks merged into ${hookPath('.claude/settings.json')} (existing settings kept); Claude Code loads them from there in every session`);
  } else {
    for (const [rel, generated] of [['.claude/settings.json', sessions], ['.claude/settings.intake.json', intake]]) {
      const existing = readJson(rel);
      if (existing !== null && !plain(existing)) refuse.push(`${rel}: not a JSON object; settle it by hand`);
      const settings = plain(existing) ? keepClaude(existing, generated, rel) : generated;
      carry(settings, rel);
      out[rel] = JSON.stringify(settings, null, 2) + '\n';
    }
    notes.push(`claude   sessions: default (.claude/settings.json is picked up automatically)\n         intake:   claude --settings .claude/settings.intake.json`);
  }
}

if (names.includes('codex')) {
  const quoted = (tool) => `'${join(root, tool).replace(/'/g, `'"'"'`)}'`; // the hook's cwd may be a subdirectory: an absolute, shell-quoted path
  const codexHooks = hookSet((tool) => `node ${quoted(tool)} --harness codex`, 'startup|resume|clear');
  // Codex's standalone install keeps its binary under the Codex home's packages folder, and the sandbox helper that loads
  // AGENTS.md re-executes it: with the whole home denied no session starts (0.155.1 and 0.160.1, V31-RESPAWN), so that one
  // folder is readable and the rest of the home stays denied.
  const fsDeny = [...secretDirs.map((d) => `${JSON.stringify(d)} = "deny"`), `${JSON.stringify(`${H}/.codex/packages`)} = "read"`].join('\n');
  const domains = hosts.map((h) => `${JSON.stringify(h)} = "allow"`).join('\n');
  // o.closed: a reviewed profile keeps its network closed; o.hooksOff: it keeps [features] hooks off, so no hook table is
  // carried; o.forbid: the rules file's sentence forbidding an install outside the project (V31-GEN-KEEP).
  const body = (name, net, o = {}) => { const nw = o.closed ? 'closed' : network; return `# pm-skills 5 — Codex settings for ${slug}${net ? (o.closed ? ' (INTAKE: network kept closed)' : ' (INTAKE: network open)') : ''}.
${o.forbid ? `# Generated by tools/harness.mjs; review, then keep it in this project: the rules file forbids an install outside it
# ("${o.forbid}"). Run it by the project's own route, a command the owner names.` : `# Generated by tools/harness.mjs; review, then install:
#   cp harness/codex/${name}.config.toml "\${CODEX_HOME:-$HOME/.codex}/${name}.config.toml"
# and run with:  codex -p ${name}`}
# Codex >=0.134: -p layers this file over user config. Trusted project config may override it.
# ${net ? (o.closed ? 'Intake: the reviewed profile keeps the network closed.' : 'Intake: the network is open, whatever the Network line says for sessions.') : `${pushNoteFor(nw)} ${networkNoteFor(nw)}`}
# ${hooksNote}
# These hooks ride this profile; a project's own hooks file (written by --hooks-only) loads only when its .codex layer is
# trusted. Codex runs a hook only once it has recorded trust in that hook's hash (/hooks); review any other hook trusted there. --dangerously-bypass-hook-trust is for automation
# that already vets its hook sources. Hooks run as Codex's own process, outside the sandbox below.
# Review effective permissions on the installed client; a generated file is not an enforcement test.
approval_policy = "never"
default_permissions = "${name}"
web_search = ${net || network === 'open' ? '"live"' : '"disabled"'}

[features]
memories = false          # this ledger is the record, not the harness's memory
apps = false              # ChatGPT connector apps (GitHub write, site deploys) are ON by default
browser_use = false
browser_use_external = false
computer_use = false
in_app_browser = false
image_generation = false
hooks = true              # the three session hooks in .codex/hooks.json (3.15)

[permissions.${name}]
extends = ":workspace"

[permissions.${name}.filesystem]
${fsDeny}

[permissions.${name}.network]
enabled = ${!o.closed && (net || network !== 'closed') ? 'true' : 'false'}${o.closed ? '           # kept closed: the reviewed profile closes it' : net ? '            # intake only, owner present' : nw === 'closed' ? '           # sessions: closed. Installs happen in intake, or by the owner.' : nw === 'listed' ? '            # listed hosts below; a client without domain rules treats this as open' : '            # open'}
${!net && nw === 'listed' ? `\n[permissions.${name}.network.domains]\n${domains}\n` : ''}
# Prefix-rule syntax belongs in .rules files, never TOML. Network permissions are the control.
${o.hooksOff ? '' : `
# The three session hooks (3.15), carried by this profile so that no project layer need be trusted for them; a project
# that keeps its own permissions installs them with --hooks-only into the project's Codex hooks file instead. Headless: codex exec
# runs them only with recorded trust or --dangerously-bypass-hook-trust.
${toml(codexHooks)}`}`; };
  if (hooksOnly) {
    const existing = readJson('.codex/hooks.json') || {};
    merged['.codex/hooks.json'] = JSON.stringify({ ...existing, hooks: mergeHooks(existing.hooks, codexHooks) }, null, 2) + '\n';
    notes.push(`codex    hooks merged into ${hookPath('.codex/hooks.json')} (existing hooks kept); set \`hooks = true\` under [features] in the profile you run, trust this project's .codex layer, then trust each hook in /hooks`);
  } else {
    const chosen = {}; let hooksKeptOff = false;
    for (const [role, net] of [['sessions', false], ['intake', true]]) {
      const own = net ? `${slug}-intake` : slug, r = reviewedCodex[role], name = r ? r.name : own, file = `harness/codex/${name}.config.toml`;
      chosen[role] = name;
      if (!r) { out[file] = body(name, net, { forbid: forbidInstall }); continue; }
      const closed = r.parsed.table(['permissions', name, 'network'])?.keys.get('enabled')?.value === false && (net || network !== 'closed');
      const hooksOff = r.parsed.table(['features'])?.keys.get('hooks')?.value === false; hooksKeptOff ||= hooksOff;
      if (name !== own) kept.push(`${file}: profile name ${name} (the print's own name ${own} not used)`);
      if (closed) kept.push(`${file}: [permissions.${name}.network] enabled = false (the print would open it${!net && network === 'listed' ? ` to ${hosts.join(', ')}` : ''}${!net && harnessPush ? '; each close reports a pending push' : ''})`);
      if (hooksOff) kept.push(`${file}: the session hooks left out, [features] hooks being off; turning them on is the owner's word`);
      const k = keepCodex(r.parsed, body(name, net, { forbid: forbidInstall, closed, hooksOff }), file);
      refuse.push(...k.refuse); kept.push(...k.kept);
      if (k.text !== undefined) out[file] = k.text;
    }
    notes.push(forbidInstall
      ? `codex    sessions: profile ${chosen.sessions}\n         intake:   profile ${chosen.intake}   (both stay in harness/codex/: the rules file forbids an install outside the project, so they run by the project's own route, a command the owner names; trust any hooks they carry in /hooks)`
      : `codex    sessions: codex -p ${chosen.sessions}\n         intake:   codex -p ${chosen.intake}   (after copying both files into $CODEX_HOME; ${hooksKeptOff ? 'a reviewed profile with hooks off carries none of the three hooks' : 'the profiles carry the three hooks — trust them in /hooks'})`);
  }
}

// ---- the status site's post-commit hook (V3-STATUS-VIEW, V31-STATUS-SITE): a Git hook, not a session hook, so no harness runs it and no
// session sees more than one line of it. It clears inherited GIT_* routing, finds the checkout it runs in — a linked
// worktree included — and rebuilds the ignored site there; silent on success, one line on failure, never failing a commit.
if (!hooksOnly) {
  const at = prefix.replace(/[\\"$`]/g, '\\$&'); // inside the hook's double quotes
  out['harness/git/post-commit'] = `#!/bin/sh
# pm-skills 5 post-commit hook: rebuild the status site, project/view.html and project/view.site/, after every commit.
# Generated by tools/harness.mjs; review, then install where this checkout's Git looks for hooks:
#   cp harness/git/post-commit "$(git rev-parse --git-path hooks)/post-commit"
# It writes nothing but the ignored site, calls no model and no network, prints nothing on success and one line on
# failure, the checker's own messages, leaving the old site whole; the commit always stands.
for v in $(env | sed -n 's/^\\(GIT_[A-Za-z0-9_]*\\)=.*/\\1/p'); do unset "$v"; done
top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
node "$top/${at}tools/view.mjs" --root "$top/${at}." --quiet 2>&1 | head -n 1
exit 0
`;
  notes.push(`git      status site: review harness/git/post-commit, then cp it to "$(git rev-parse --git-path hooks)/post-commit" in each checkout that should rebuild project/view.html and project/view.site/ after a commit; ignore project/view.html, project/view.site/ and project/.view.html.* there`);
}

if (refuse.length) {
  console.error(`harness: the existing settings hold what this print cannot keep:\n${refuse.map((r) => `  ${r}`).join('\n')}\nNothing printed or written.`);
  process.exit(1);
}
// Preflight the whole output set. A conflict never leaves a mixed configuration; merged hook files replace by design.
const conflicts = Object.entries(out).filter(([rel, body]) => existsSync(join(root, rel)) && readFileSync(join(root, rel), 'utf8') !== body);
if (!print && !force && conflicts.length) {
  console.error(`harness: existing files differ: ${conflicts.map(([rel]) => rel).join(', ')}; review the diff, then use --force if intended. Nothing written.`);
  process.exit(1);
}
for (const [rel, body] of Object.entries({ ...out, ...merged })) {
  if (print) { console.log(`--- ${hookPath(rel)} ---\n${body}`); continue; }
  const p = join(hooksRoot, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  if (!existsSync(p) || readFileSync(p, 'utf8') !== body) writeFileSync(p, body);
  if (rel === 'harness/git/post-commit') chmodSync(p, 0o755);
  console.log(`harness: ready ${hookPath(rel)}${merged[rel] ? ' (merged)' : ''}`);
}
if (kept.length) console.log(`\nkept from the existing settings, line by line; to widen one, the owner edits or removes the file:\n${kept.map((k) => `kept     ${k}`).join('\n')}`);
console.log(`\nhow to run (${names.join(' + ')}):\n${notes.join('\n')}`);
if (names.length > 1) {
  console.log(`
both harnesses on one folder: the record is the handoff — one plans, the other executes from the backlog line and its
item file; one writer per checkout at a time, a second session in its own clone or worktree. State that split on the
profile's Handoff line.`);
}
console.log(`\nheadless forms (3.15): Claude Code loads a project's own settings only once the workspace is trusted, so a runner passes
the generated file by \`claude -p --settings ${forbidInstall ? '<the project\'s file>' : '<a copy outside the project>'}\`; Codex skips an untrusted project layer, so a
runner passes the profile's [hooks] table by \`-c\`${forbidInstall ? '' : ' or installs the profile'}, and runs hooks only with recorded trust or
--dangerously-bypass-hook-trust. The desktop app applied no generated setting in the exposed week; verify in each client.`);
console.log(`\nreview before use: these files are proposed settings, not evidence of effective isolation. Verify the client version,
merged config, sandbox availability, inherited tools, plugins and local network needs. ${pushNote} ${networkNote}
${hooksNote} Review the deny lists, the secret directories, and any sibling checkout in the parent folder
that this project's sessions must not read (add it to denyRead / filesystem deny).${kept.length ? ' The Push and Network notes here are the profile\'s; where a kept line above narrows a file, that file\'s narrower setting stands.' : ''}`);
