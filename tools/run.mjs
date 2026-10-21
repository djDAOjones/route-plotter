#!/usr/bin/env node
// pm-next-v3.1 runner (specification 3.15, the runner). Zero dependencies; an add-on outside the core that no rule reads.
// The owner starts it by hand, in a terminal, for one named backlog phase, with a budget of sessions and hours:
//   node <installation>/tools/run.mjs --phase "Phase 2" --sessions 4 --hours 3 --usd 5
//     [--harness claude|codex] [--bin <client>] [--settings <file>] [--profile <name>] [--out <dir>] [--pause <seconds>]
// It drives a v3.1 installation, or a v3 one such as the lab's unchanged, at the repository root or below it (--root).
// Each cycle starts one fresh headless session at the repository root, the session hooks of 3.15 on, in a terminal's
// environment that carries no login token: Claude Code `-p` in auto permission mode, the session settings passed by
// --settings and --max-budget-usd as the per-session cap; or Codex `exec` with the generated profile. Between sessions it
// reads only Git, the backlog, the checker and the profile's Gate, Push and Network lines, and stops, saying why, at the
// first of: the phase closed, or a done end the backlog disagrees with; the next item, or an earlier one of the phase,
// needing the owner; the checker or the gate red; a session ending without a new close that carries exactly one valid
// Session-end line (one retry, only once every other check has passed and never over an owner or done end the session
// wrote, then a stop); the same failure again with no clean cycle between, a client a signal ended among them; files no
// session committed; another writer; the budget spent; a login or usage-limit error that outlasts its pause, or any
// failure of the resumed session — the stop conditions that need no checker checked before any pause and again just before
// the resume, so a session the run must stop for is never resumed; a Git read that fails stops the run, never read as no
// commits, an unchanged tree or no remote; a process group still alive after its KILL and a grace stops it too. It chains
// only from a continue end, pushes the checked commit as the Push line says between sessions and only to origin, never
// bypasses permissions, and starts no other run. The run log and each session's stream go to --out, a new or empty folder,
// by default under pm-next/runs in Git's common directory, never committed. Every process the runner starts gets an
// allowlisted environment — a terminal's, never an inherited login or other variable; each deadline is set within the hours
// left, and a group that outlives its KILL and grace stops the run.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, constants, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import * as fsp from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, isAbsolute, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ID, field, networkChoice, pushRoute, sessionEnd, sessionEndLines } from './ledger.mjs';

const SELF = fileURLToPath(import.meta.url);
const KEEP = ['HOME', 'PATH', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'CODEX_HOME']; // a terminal's environment (V31-RESPAWN)
// The checker, the gate and Git get a terminal's environment too, by name, never one filtered by name, so a value such as a
// connection URL carrying a password reaches none of them; the push alone keeps the SSH agent's socket.
const AUX = (k) => ['HOME', 'PATH', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'TERM', 'LC_ALL', 'LC_COLLATE', 'LC_CTYPE', 'LC_MESSAGES', 'LC_MONETARY', 'LC_NUMERIC', 'LC_TIME'].includes(k);
const LIMIT = /usage limit|hit your (?:usage )?limit|limit reached|rate[ _-]?limit/i;
const LOGIN = /not logged in|please run \/login|invalid api key|oauth token (?:has )?expired|authentication[_ ]error|\b401\b/i;
const GIT_MS = 60e3, CHECK_MS = 600e3, STOP_MS = 10e3, GRACE_MS = 5000, MAX_CLAIM = 4096, MAX_ENDS = 256, SNAP_BYTES = 64 << 20;
const refuse = (text) => { console.error(`run: ${text}`); process.exit(2); };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

let o;
try {
  o = parseArgs({ strict: true, options: Object.fromEntries(['phase', 'sessions', 'hours', 'usd', 'harness', 'bin', 'settings', 'profile', 'out', 'pause', 'root'].map((k) => [k, { type: 'string' }])) }).values;
} catch (e) { refuse(e.message); }
if (process.env.PM_NEXT_RUN) refuse('this shell belongs to a runner session, and no run starts another: the owner starts each run by hand.');
const harness = o.harness || 'claude';
if (!['claude', 'codex'].includes(harness)) refuse('--harness is claude or codex');
const num = (k) => { const n = Number(o[k]); if (o[k] === undefined || !(n > 0) || !Number.isFinite(n)) refuse(`--${k} needs a positive number; no budget is defaulted`); return n; };
if (!o.phase?.trim()) refuse('name one backlog phase: --phase "<its heading, or the heading\'s start before an em dash>"');
const maxSessions = Math.floor(num('sessions')), hours = num('hours'), pauseDefault = o.pause === undefined ? 3600 : num('pause');
const deadline = Date.now() + hours * 3600e3, left = () => deadline - Date.now();
const usd = harness === 'claude' ? num('usd') : null;
if (harness === 'codex' && !o.profile) refuse('Codex runs with the generated profile: --profile <name>');
const holders = new Set(), streak = new Set(), sessions = [], pushes = [];
let current = null, stopped = '', interrupted = false, out = null;

const root = resolve(o.root || join(dirname(SELF), '..'));
const env0 = Object.fromEntries(Object.entries(process.env).filter(([k]) => AUX(k))); // never an inherited Git target, a login or another value
const gitEnv = { ...env0, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
const pushEnv = { ...gitEnv, ...(process.env.SSH_AUTH_SOCK ? { SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK } : {}) };
const spent = (during = '') => out ? finish(`the budget is spent: ${hours} h${during}`, 1) : refuse('the budget is spent before the run began');
const alive = (pid) => { try { process.kill(-pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }; // a process group
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
// Git, within the hours left — and STOP_MS a call once the run has stopped, for its report; a read the hours cut short stops
// the run. Each read runs in a process group of its own, killed when the read returns and awaited, so that a helper Git
// started for it — a configured file-system monitor, say — goes with it; a group still alive after its KILL and a grace
// stops the run, saying so. null when the read fails: a caller that needs the answer stops the run (must), never reading a
// failure as no commits, an unchanged tree or no remote.
function git(args) {
  const ms = stopped ? STOP_MS : Math.min(GIT_MS, left());
  if (ms <= 0) spent();
  const r = spawnSync('git', args, { cwd: root, env: gitEnv, encoding: 'utf8', maxBuffer: 64 << 20, timeout: ms, killSignal: 'SIGKILL', detached: true });
  if (r.pid) { // only ESRCH means the group is gone; a signal it refuses (EPERM) leaves it alive
    let live;
    try { process.kill(-r.pid, 'SIGKILL'); live = true; } catch (e) { live = e.code !== 'ESRCH'; }
    for (const t = Date.now() + GRACE_MS; live && (live = alive(r.pid)) && Date.now() < t;) nap(20);
    if (live && !stopped) finish(`a process group Git started for a read (git ${args[0]}, group ${r.pid}) is still alive after its KILL and a ${GRACE_MS / 1000} s grace: the run stops, for the owner`, 1);
  }
  if (r.error?.code === 'ETIMEDOUT' && !stopped && ms < GIT_MS) spent(', during a Git read');
  return r.status === 0 ? r.stdout.replace(/\n$/, '') : null;
}
const must = (args, what) => git(args) ?? finish(`Git could not read ${what}`, 1);
const top = git(['rev-parse', '--show-toplevel']);
if (!top || !existsSync(join(root, 'project/backlog.md'))) refuse('the installation (--root) must hold project/ inside a Git repository');
const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']), gitDir = git(['rev-parse', '--absolute-git-dir']);
const lock = git(['rev-parse', '--path-format=absolute', '--git-path', 'index.lock']);
const branch = git(['symbolic-ref', '-q', 'HEAD']);
if (!branch) refuse('HEAD is detached: start the run on a branch');
const HANDOVER = join(common, 'pm-next', 'handover');

// The client, and the settings or profile that carry the session hooks of 3.15 — never a hook-free one. Each hook must be
// a whole command of the generator's shape, run for the event and source it serves: the compaction re-read and the sensor
// (tools/session.mjs), and the start notice (tools/handover.mjs), which claims the end a fresh session resumes, where the
// installation has one — a v3 installation, such as the lab's, has none — each this installation's own tool, and a --root
// word, if any, this installation.
const WORD = `"(?:[^"\\\\$\`]|\\\\.|\\$\\{[A-Za-z_][A-Za-z0-9_]*\\})*"|'(?:[^']|'"'"')*'|(?:[A-Za-z0-9_./~+@%=,:-]|\\$\\{[A-Za-z_][A-Za-z0-9_]*\\})+`;
const COMMAND = new RegExp(`^node (${WORD}) --harness (claude|codex)(?: --root (${WORD}))?$`);
// A word as the shell hands it to node: quotes removed, a leading ~/ as HOME, and ${NAME} expanded where the runner knows
// what the hook will see — Claude Code's CLAUDE_PROJECT_DIR, the repository root the session opens at, and the terminal
// variables passed on. null for any other variable, and for an unquoted expansion the shell would split or glob, whose
// command would not run the word as one path. A relative path is the session's, from the repository root.
function unword(w) {
  const known = { ...Object.fromEntries(KEEP.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]])), ...(harness === 'claude' ? { CLAUDE_PROJECT_DIR: top } : {}) };
  let bad = false;
  const v = (k, quoted) => { const x = known[k]; if (x === undefined || (!quoted && /[\s*?[]/.test(x))) bad = true; return x ?? ''; };
  const text = w.startsWith("'") ? w.slice(1, -1).replaceAll(`'"'"'`, "'")
    : w.startsWith('"') ? w.slice(1, -1).replace(/\\(.)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, c, k) => c !== undefined ? ('$`"\\'.includes(c) ? c : m) : v(k, true))
    : w.replace(/^~(?=\/|$)/, () => known.HOME ?? ((bad = true), '')).replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, k) => v(k, false));
  return bad ? null : resolve(top, text);
}
// One file or folder by its real path, as a tool finds its root from its own location: a symlink resolves to it, a hard
// link elsewhere does not.
const same = (a, b) => { try { return realpathSync.native(a) === realpathSync.native(b); } catch { return false; } };
const startNotice = existsSync(join(root, 'tools/handover.mjs'));
const NEEDED = [['SessionStart', 'compact', 'session'], ['SessionStart', 'startup', 'session'], ['SessionStart', 'resume', 'session'], ...(startNotice ? [['SessionStart', 'startup', 'handover']] : []), ['PostToolUse', null, 'session']];
const covers = (matcher, source) => { // a missing, empty or star matcher covers every source; PostToolUse needs that, so no tool escapes the sensor
  if (matcher === undefined || matcher === '' || matcher === '*') return true;
  if (source === null || typeof matcher !== 'string') return false;
  try { return new RegExp(`^(?:${matcher})$`).test(source); } catch { return false; }
};
const runs = (h, tool) => {
  const m = h?.type === 'command' && typeof h.command === 'string' && h.command.match(COMMAND);
  if (!m || m[2] !== harness) return false;
  const path = unword(m[1]), at = m[3] === undefined ? root : unword(m[3]);
  return path !== null && at !== null && same(path, join(root, 'tools', `${tool}.mjs`)) && same(at, root);
};
const installed = relative(realpathSync(top), realpathSync(root)); // the installation, from the repository root
const missing = (hooks) => NEEDED.filter(([event, source, tool]) => !(Array.isArray(hooks?.[event]) && hooks[event].some((g) => covers(g?.matcher, source) && Array.isArray(g.hooks) && g.hooks.some((h) => runs(h, tool))))).map(([e, s, t]) => `${e}${s ? `(${s})` : ''} running ${join(installed, 'tools', `${t}.mjs`)}`);
// The subset of TOML the generated profile uses: tables, arrays of tables, comments, and plain or dotted keys holding
// strings, booleans or numbers; any other one-line value is kept as its text. A line that is none of these — among them a
// value that spans lines — makes the profile unreadable, and the run is refused.
function toml(text) {
  const doc = {}; let at = doc;
  const key = (k) => k.startsWith('"') ? JSON.parse(k) : k.startsWith("'") ? k.slice(1, -1) : k;
  const into = (t, k) => { const v = t[k] ?? (t[k] = {}); if (Array.isArray(v)) return v.at(-1); if (typeof v !== 'object') throw Error(`${k} is not a table`); return v; };
  const value = (v) => /^"/.test(v) ? JSON.parse(v) : /^'[^']*'$/.test(v) ? v.slice(1, -1) : v === 'true' ? true : v === 'false' ? false : /^[+-]?\d+(?:\.\d+)?$/.test(v) ? Number(v) : v;
  for (const raw of text.split('\n')) {
    let line = '', quote = '';
    for (let i = 0; i < raw.length; i++) { // a comment starts at a # outside a string
      const c = raw[i];
      if (quote) { line += c; if (c === '\\' && quote === '"') line += raw[++i] ?? ''; else if (c === quote) quote = ''; } else if (c === '#') break; else { if (c === '"' || c === "'") quote = c; line += c; }
    }
    line = line.trim();
    const path = (s) => s.match(/"[^"]*"|'[^']*'|[A-Za-z0-9_-]+/g).map(key);
    let m;
    if (!line) continue;
    if ((m = line.match(/^\[\[\s*(.+?)\s*\]\]$/))) { const p = path(m[1]); let t = doc; for (const k of p.slice(0, -1)) t = into(t, k); const last = p.at(-1); if (!Array.isArray(t[last] ??= [])) throw Error(`${last} is not an array`); t[last].push(at = {}); } else if ((m = line.match(/^\[\s*(.+?)\s*\]$/))) { at = doc; for (const k of path(m[1])) at = into(at, k); } else if ((m = line.match(/^((?:"[^"]*"|'[^']*'|[A-Za-z0-9_-]+)(?:\s*\.\s*(?:"[^"]*"|'[^']*'|[A-Za-z0-9_-]+))*)\s*=\s*(.+)$/))) { const p = path(m[1]); let t = at; for (const k of p.slice(0, -1)) t = into(t, k); t[p.at(-1)] = value(m[2]); }
    else throw Error(`an unreadable line: ${line.slice(0, 40)}`);
  }
  return doc;
}
const bin = o.bin ? resolve(o.bin) : harness;
let settings = null;
if (harness === 'claude') {
  settings = o.settings ? resolve(o.settings) : join(top, '.claude/settings.json');
  let s = null; try { s = JSON.parse(readFileSync(settings, 'utf8')); } catch { refuse(`no readable session settings at ${settings}: pass --settings <file>`); }
  const lacks = s?.disableAllHooks ? ['every hook (disableAllHooks)'] : missing(s?.hooks);
  if (lacks.length) refuse(`the session settings lack the session hooks of 3.15 a runner session runs with: ${lacks.join('; ')}`);
  if (/bypassPermissions/.test(JSON.stringify(s.permissions || {}))) refuse('the session settings bypass permissions, which a runner never does');
} else {
  const file = join(process.env.CODEX_HOME || join(process.env.HOME || '', '.codex'), `${o.profile}.config.toml`); // the home the session is given
  let p = null; try { p = toml(readFileSync(file, 'utf8')); } catch (e) { refuse(`no readable Codex profile ${o.profile} in the Codex home${e.code === 'ENOENT' ? '' : ` (${e.message})`}`); }
  const lacks = p.features?.hooks === true ? missing(p.hooks) : ['hooks = true under [features]'];
  if (lacks.length) refuse(`the Codex profile ${o.profile} lacks the session hooks of 3.15 a runner session runs with: ${lacks.join('; ')}`);
  if (/danger-full-access|dangerously/i.test(JSON.stringify(p))) refuse(`the Codex profile ${o.profile} bypasses the sandbox or approvals, which a runner never does`);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const real = (p) => existsSync(p) ? realpathSync(p) : join(real(dirname(p)), basename(p)); // through symlinks, as Git sees it
const under = (p, dir) => { const r = relative(dir, p); return r === '' || (r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r)); };
const dest = real(resolve(o.out || join(common, 'pm-next', 'runs', stamp)));
const inGit = [common, gitDir].some((d) => under(dest, real(d))); // Git's own directory is never the work tree
if (!inGit && under(dest, real(top)) && git(['check-ignore', '-q', '--no-index', dest]) === null) refuse('--out lies in the work tree and is not ignored: its files would read as files no session committed');
if (existsSync(dest) && (!statSync(dest).isDirectory() || readdirSync(dest).length)) refuse('--out must name a new or empty folder: an earlier run\'s streams there would be read as this run\'s');
mkdirSync(dest, { recursive: true }); out = dest;
const log = (line) => { const l = `${new Date().toISOString()} ${line}`; appendFileSync(join(out, 'run.log'), l + '\n'); console.log(l); };
const sid16 = (sid) => createHash('sha256').update(`${harness}|${sid}`).digest('hex').slice(0, 16); // the start notice's holder

// A command in its own process group. When it exits, at its deadline, or when the owner interrupts the run, the group is
// sent TERM, then KILL after a grace, and the call returns only once no process of the group is left; a group still alive
// after its KILL and a second grace, or one that refuses the signals, stops the run, saying so, for nothing the runner
// starts may go on unseen.
async function end(pid, what) {
  if (!pid) return;
  const gone = async (ms) => { for (const t = Date.now() + ms; Date.now() < t; await sleep(100)) if (!alive(pid)) return true; return !alive(pid); };
  try { process.kill(-pid, 'SIGTERM'); } catch (e) { if (e.code === 'ESRCH') return; } // only ESRCH means the group is gone
  if (await gone(GRACE_MS)) return;
  try { process.kill(-pid, 'SIGKILL'); } catch (e) { if (e.code === 'ESRCH') return; }
  if (!(await gone(GRACE_MS))) finish(`a process group the runner started (${what}, group ${pid}) is still alive after its KILL and a ${GRACE_MS / 1000} s grace: the run stops, for the owner`, 1);
}
function group(cmd, args, { cwd, env, file, ms }) {
  return new Promise((done) => {
    const fd = openSync(file, 'a'), child = spawn(cmd, args, { cwd, env, detached: true, stdio: ['ignore', fd, fd] }), what = basename(file).replace(/\.\w+$/, '');
    let timedOut = false, settled = false;
    const timer = setTimeout(() => { timedOut = true; end(child.pid, what); }, Math.max(0, ms));
    const settle = async (result) => {
      if (settled) return; settled = true; clearTimeout(timer);
      await end(child.pid, what); closeSync(fd); current = null; done({ ...result, timedOut });
    };
    current = () => end(child.pid, what);
    child.on('error', (e) => settle({ code: 127, error: e.message }));
    child.on('exit', (code, signal) => settle({ code, signal }));
  });
}
// After every wait the run goes on only if the owner has not interrupted it; the handler ends the running group, then stops.
const wait = async (p) => { const v = await p; if (interrupted) await new Promise(() => {}); return v; };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { if (interrupted) return; interrupted = true; Promise.resolve(current?.()).finally(() => finish(`stopped by the owner (${sig === 'SIGINT' ? 'interrupt' : sig})`, 130)); });
}

function phase() { // the named phase's heading and item lines, read from the working tree; an item's wrapped lines join it
  const lines = readFileSync(join(root, 'project/backlog.md'), 'utf8').split('\n'), name = o.phase.trim();
  const at = lines.flatMap((l, i) => { const m = l.match(/^#{2,4} (.+)$/); return m && (m[1] === name || m[1].startsWith(`${name} — `)) ? [i] : []; });
  if (at.length !== 1) return { missing: at.length ? 'more than one backlog heading matches' : 'no backlog heading matches' };
  const items = [];
  for (let i = at[0] + 1; i < lines.length && !/^#{1,4} /.test(lines[i]); i++) {
    const m = lines[i].match(new RegExp(`^- \\[(.)\\] (${ID}) — (.*)$`));
    if (m) items.push({ mark: m[1], id: m[2], text: m[3] }); else if (items.length && /^\s+\S/.test(lines[i])) items.at(-1).text += ` ${lines[i].trim()}`;
  }
  for (const item of items) item.owner = item.mark === '!' || /\bblocked:/i.test(item.text);
  return { closed: /— CLOSED\b/.test(lines[at[0]]), items };
}
function writer(head) { // '' or why another writer is present
  if (existsSync(lock)) return "Git's index lock is held";
  if (git(['symbolic-ref', '-q', 'HEAD']) !== branch) return `the checkout left ${branch.replace('refs/heads/', '')}`;
  if (head && git(['rev-parse', 'HEAD']) !== head) return 'HEAD moved while no runner session was working';
  return '';
}
const dirty = () => git(['status', '--porcelain', '--untracked-files=all']) !== '';
// A step of the pause's snapshot within the hours left: one the hours cut short stops the run as the budget spent, and the
// owner's interrupt is heard between steps.
const LATE = Symbol('late');
async function timely(step) {
  const ms = left(); if (ms <= 0) spent(", during the pause's snapshot");
  let timer, r;
  try { r = await Promise.race([step, new Promise((ok) => { timer = setTimeout(ok, ms, LATE); })]); } finally { clearTimeout(timer); }
  if (r === LATE) spent(", during the pause's snapshot");
  return r;
}
// The uncommitted state, files' contents included: a paused session's own unfinished edits are its own, but a change to them
// during the pause is another writer's. Each path counts by its kind, size, times and inode, which any write changes; a
// regular file's content is read as well, opened without blocking or following a link, only up to the size it had when
// opened and within SNAP_BYTES in all. A link counts by its target. Every step, each read and each close included, ends
// within the hours left; a status Git cannot read stops the run.
async function snapshot(when) {
  const st = must(['status', '--porcelain', '-z', '--untracked-files=all'], `the work tree's status ${when}`), h = createHash('sha256').update(st);
  const fields = st.split('\0'), paths = [], buf = Buffer.alloc(1 << 16);
  for (let i = 0; i < fields.length; i++) if (fields[i]) { paths.push(fields[i].slice(3)); if (/[RC]/.test(fields[i].slice(0, 2))) paths.push(fields[++i]); } // a rename's source follows it
  let budget = SNAP_BYTES;
  for (const p of paths) {
    const file = join(top, p); let fh = null;
    h.update(`\0${p}\0`);
    try {
      const l = await timely(fsp.lstat(file, { bigint: true }));
      h.update(`${l.mode} ${l.size} ${l.mtimeNs} ${l.ctimeNs} ${l.ino}`);
      if (l.isSymbolicLink()) h.update(` link ${await timely(fsp.readlink(file))}`);
      else if (l.isFile() && budget > 0) {
        fh = await timely(fsp.open(file, constants.O_RDONLY | (constants.O_NONBLOCK || 0) | (constants.O_NOFOLLOW || 0)));
        const f = await timely(fh.stat());
        if (!f.isFile()) h.update(' kind changed');
        else for (let want = Math.min(f.size, budget), k; want > 0 && (k = (await timely(fh.read(buf, 0, Math.min(buf.length, want), null))).bytesRead) > 0; want -= k) { h.update(buf.subarray(0, k)); budget -= k; }
      }
    } catch (e) { h.update(`\0${e.code || 'unreadable'}`); } finally { if (fh) await timely(fh.close().catch(() => {})); }
  }
  return h.digest('hex');
}
// First-parent commits, newest first: { hash, body }. A log Git cannot read stops the run, naming `what`; only the report,
// once the run has stopped, reads one without (null).
function commits(range, n = 0, what = '') {
  const raw = git(['log', '--first-parent', ...(n ? [`-n${n}`] : []), '-z', '--format=%H%x00%B', range, '--']);
  if (raw === null) return what ? finish(`Git could not read ${what}`, 1) : null;
  const parts = raw ? raw.split('\0') : [], list = [];
  for (let i = 0; i + 1 < parts.length; i += 2) list.push({ hash: parts[i].replace(/^\n/, ''), body: parts[i + 1] });
  return list;
}
// The end a fresh session's start notice would show and claim: the nearest first-parent commit within 256 carrying a
// Session-end line, while it is current — no commit since titled with its next item; an end naming none only at HEAD. In a
// shallow history an end below HEAD counts as current here, so a claim on it still stops the run.
function currentEnd() {
  const found = commits('HEAD', MAX_ENDS, 'the history below HEAD').find((c) => sessionEndLines(c.body).length), head = git(['rev-parse', 'HEAD']);
  const end = found && sessionEnd(found.body).end;
  if (!end || found.hash === head) return end ? { hash: found.hash, end } : null;
  if (end.next === 'none') return null;
  if (git(['rev-parse', '--is-shallow-repository']) === 'false') {
    const titles = git(['log', '-z', '--format=%s', `${found.hash}..HEAD`, '--']);
    if (titles !== null && titles.split('\0').some((s) => s.startsWith(`${end.next}:`))) return null;
  }
  return { hash: found.hash, end };
}
function readClaim(file) { // null when there is none; a claim is only a regular file of at most 4 KiB, opened without blocking or following a link
  let fd; try { fd = openSync(file, constants.O_RDONLY | (constants.O_NONBLOCK || 0) | (constants.O_NOFOLLOW || 0)); } catch (e) { return e.code === 'ENOENT' ? null : { unreadable: true }; }
  try {
    const st = fstatSync(fd); if (!st.isFile() || st.size > MAX_CLAIM) return { unreadable: true };
    const buf = Buffer.alloc(MAX_CLAIM), c = JSON.parse(buf.subarray(0, readSync(fd, buf, 0, MAX_CLAIM, 0)).toString('utf8'));
    return c && typeof c.holder === 'string' ? c : { unreadable: true };
  } catch { return { unreadable: true }; } finally { closeSync(fd); }
}
const claimedElsewhere = (hash) => { const c = readClaim(join(HANDOVER, `${hash}.json`)); return !!c && (c.unreadable || !holders.has(c.holder)); };
function release() { // before the retry, the run's ended sessions give up their claims, so the retry's start notice can claim
  for (const name of existsSync(HANDOVER) ? readdirSync(HANDOVER) : []) {
    const c = /^[0-9a-f]{40,64}\.json$/.test(name) && readClaim(join(HANDOVER, name));
    if (c && !c.unreadable && holders.has(c.holder)) { try { unlinkSync(join(HANDOVER, name)); log(`released the run's claim on ${name.slice(0, 7)} for the retry`); } catch { /* gone */ } }
  }
}
// The checker, in a process group of its own like the gate, within the hours left: { hours } when they ran out, else
// { ok, fails, first }, ok only for an exit of 0 within its own deadline. Its output is in check-<tag>.log. It runs from the
// installation's root with no --root, which v3.1's checker takes from its working directory and a v3 adapter, such as the
// lab's, refuses, fixing its own.
async function checker(tag, rev) {
  const file = join(out, `check-${tag}.log`), ms = Math.min(CHECK_MS, left());
  if (ms <= 0) return { hours: true };
  const r = await wait(group(process.execPath, [join(root, 'tools/check.mjs'), ...(rev ? ['--commit', rev] : [])], { cwd: root, env: env0, file, ms }));
  if (r.timedOut && ms < CHECK_MS) return { hours: true };
  const text = readFileSync(file, 'utf8'), fails = text.split('\n').filter((l) => l.startsWith('FAIL'));
  const ok = !r.timedOut && r.code === 0;
  const first = ok ? '' : r.timedOut ? `it ran past ${CHECK_MS / 1000} s` : fails[0] ? fails[0].replace(/^FAIL\s+/, '') : `${text.trim().split('\n').at(-1) || r.error || 'no output'} (exit ${r.code ?? r.signal}; check-${tag}.log)`;
  return { ok, fails, first };
}
const red = async (when, tag) => { const c = await checker(tag); return c.hours ? 'hours' : c.ok ? '' : `the checker is red ${when}: ${c.first}`; };
// Leave to launch: null, or [why not, exit code]. `next` is a continue end's item, or null for the phase's first open item.
// The next item and every earlier one of the phase must not need the owner — `[!]` or `blocked:` — and the end a fresh
// session would claim must not be claimed by a chat outside the run.
function leave(next) {
  const p = phase();
  if (p.missing) return [`the phase "${o.phase}" is not in the backlog: ${p.missing}`, 1];
  if (p.closed) return ['the phase is closed', 0];
  if (!p.items.length) return ['the phase has no open item, yet its heading is not marked CLOSED', 1];
  const at = next ? p.items.findIndex((i) => i.id === next) : 0;
  if (at < 0) return [`the next item, ${next}, is not an open item of the phase`, 1];
  const held = p.items.slice(0, at + 1).find((i) => i.owner);
  if (held) return [held === p.items[at] ? `the next item, ${held.id}, needs the owner` : `an earlier item of the phase, ${held.id}, needs the owner before ${p.items[at].id}`, 0];
  const e = currentEnd();
  if (e && claimedElsewhere(e.hash)) return [`another writer is present: a chat outside the run claimed the end at ${e.hash.slice(0, 7)}; if it has finished, the owner's word is the recovery — remove ${join(HANDOVER, `${e.hash}.json`)}`, 1];
  return null;
}
// The session's instruction; the installation's paths named from the repository root, where the session opens, and the start
// notice only where the installation has one.
function prompt(n, from, retry) {
  const at0 = (p) => join(installed, p), contract = at0('AGENTS.md');
  const at = from ? ` The last close, ${from.hash.slice(0, 7)}, ended continue, next ${from.next}: continue as ${startNotice ? `the start notice and ${contract} say` : `${contract} says`}.` : '';
  const again = retry ? ` This is the one retry: runner session ${n - 1} ended without a valid close (${retry}).` : '';
  return `The owner started ${relative(realpathSync(top), realpathSync(SELF))} for the backlog phase "${o.phase}"; this is runner session ${n} of at most ${maxSessions}, run ${stamp}.${at}${again} Read the rule-1 set (${contract} rule 1), then run the phase's items in order as ${at0('verbs/plan.md')} "Step 5 — Execute the phase" allows, closing each as ${at0('verbs/close.md')} says, to the phase close, the first line that needs the owner, or the session end 3.15 sets. End every commit's Verify line with "— runner session ${n}, run ${stamp}". Your last close carries exactly one Session-end line. Do not push: the runner pushes between sessions as the Push line says. Nobody is watching: where you would ask the owner, record the question in the record and end at that close with an owner Session-end line; if you cannot close, write no line and stop.`;
}
async function launch(n, text, { resume = '', cap = usd, tag = '' } = {}) {
  const env = { ...Object.fromEntries(KEEP.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]])), PM_NEXT_RUN: stamp };
  const args = harness === 'claude'
    ? ['-p', text, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'auto', '--max-budget-usd', String(cap), '--settings', settings, ...(resume ? ['--resume', resume] : [])]
    : ['exec', '--json', '-p', o.profile, '-C', top, ...(resume ? ['resume', resume] : []), text]; // Codex 0.160.1 parses this resume form
  const file = join(out, `s${n}${tag}.jsonl`), r = await group(bin, args, { cwd: top, env, file, ms: left() });
  let sid = resume || '', cost = null, error = r.error || '', budget = false, result = false;
  const said = (x) => typeof x === 'string' ? x : x?.message || JSON.stringify(x);
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    let e; try { e = JSON.parse(line); } catch { if ((r.code || r.signal) && line.trim()) error += ` ${line.trim()}`; continue; }
    if (e.type === 'system' && e.subtype === 'init') sid = e.session_id || sid;
    if (e.type === 'thread.started') sid = e.thread_id || sid;
    if (e.type === 'result') {
      result = true; cost = e.total_cost_usd ?? cost; budget ||= /budget/i.test(e.subtype || '');
      if (e.is_error || e.subtype !== 'success') error += ` ${e.subtype}: ${e.result || ''}`;
      if (Array.isArray(e.errors) && e.errors.length) error += ` ${e.errors.map(said).join(' ')}`;
    }
    if (e.type === 'turn.completed' || e.type === 'turn.failed') result = true;
    if (e.type === 'turn.failed' || e.type === 'error') error += ` ${said(e.error) || e.message || ''}`;
  }
  if (sid) holders.add(sid16(sid));
  // A client a signal ended, or one that ended without its result, is a client error, whatever it printed before.
  if (r.signal && !r.timedOut) error += ` killed by ${r.signal}`;
  if (!error && !r.timedOut && (r.code || !result)) error = r.code ? `exit ${r.code}` : 'it ended without its result';
  const kind = r.timedOut ? 'hours' : r.signal ? 'error' : budget ? 'cost' : LIMIT.test(error) ? 'limit' : LOGIN.test(error) ? 'login' : error ? 'error' : ''; // a signal outranks what the stream said
  return { sid, cost, kind, error: error.trim().slice(0, 400) };
}
// A well-formed owner or done end in any of these commits, valid close or not: no retry or resume passes over one.
const stopEnd = (list) => list.flatMap((c) => sessionEndLines(c.body)).map((l) => sessionEnd(l).end).find((e) => e && e.status !== 'continue') || null;
// The session's close: { end, head, count }; or { why, stop, held }, held being stopEnd's; or { hours }. Any unsuccessful
// commit check — a FAIL line of any kind, a crash, an error, a signal, its own deadline — fails the close.
async function validate(before, n) {
  if (git(['merge-base', '--is-ancestor', before, 'HEAD']) === null) return { why: 'history before the session was rewritten', stop: true };
  const list = commits(`${before}..HEAD`, 0, `session ${n}'s commits`);
  if (!list.length) return { why: `session ${n} made no new commit` };
  const held = stopEnd(list);
  const bad = (why) => ({ why, held });
  const [head, ...rest] = list, { end, lines } = sessionEnd(head.body);
  if (!end) return bad(lines.length ? "the last commit's Session-end line is malformed or repeated" : 'the last commit carries no Session-end line');
  if (rest.some((c) => sessionEndLines(c.body).length)) return bad('an earlier commit of the session carries a Session-end line: it went on past its end');
  const named = new RegExp(`^Verify: .*\\brunner session ${n}, run ${stamp}\\b`, 'm');
  if (list.some((c) => !named.test(c.body))) return bad(`a commit's Verify line does not name runner session ${n} of this run`);
  const c = await checker(`${n}-commit`, head.hash);
  if (c.hours) return { hours: true };
  const shape = c.fails.filter((l) => /^FAIL\s+commit:/.test(l));
  if (shape.length) return bad(`the close's commit shape: ${shape[0].replace(/^FAIL\s+/, '')}`);
  if (!c.ok) return bad(`the close's commit check failed: ${c.first}`);
  return { end, head: head.hash, count: list.length };
}
async function gate(n) {
  const cmd = (field(readFileSync(join(root, 'project/profile.md'), 'utf8'), 'Gate').match(/^`([^`]+)`/) || [])[1];
  if (!cmd) return 'the profile names no Gate command';
  const r = await group('/bin/sh', ['-c', cmd], { cwd: root, env: env0, file: join(out, `gate-${n}.log`), ms: left() });
  return r.timedOut ? 'hours' : r.code === 0 ? '' : `the gate is red (exit ${r.code ?? r.signal}); its output is in gate-${n}.log`;
}
// A push or upstream URL as Git reads it. A remote — scheme://host/path, or Git's [user@]host:path, a colon before any slash
// — as { host, path }, both in lower case: the path percent-decoded first, then its empty and . segments dropped and its ..
// segments resolved, its .git dropped last, and compared whatever the host, so that two spellings of one repository, or one
// path behind two names of its server, compare equal (a false match only stops a push). The runner compares spellings: a
// path it cannot see — home-relative, or a link or redirect on the server — is guarded only by origin's configuration and
// the Network line. A local path or a file URL with no host or localhost,
// percent-decoded, as the repository Git would open there — the first of <path>/.git, <path>, <path>.git/.git and
// <path>.git that is a Git directory, a .git file followed — known by its device and inode, so that a symlink, another
// spelling or letter case of one repository compares equal; a path that opens none compares by its spelling through its
// symlinks. { unread } for a form the runner does not read: a remote helper's transport::address, a file URL naming another
// host, an encoding that does not decode.
function where(url) {
  const raw = url.trim(), decode = (t) => { try { return decodeURIComponent(t); } catch { return null; } };
  if (/^[A-Za-z][A-Za-z0-9+.-]*::/.test(raw)) return { unread: true };
  const file = raw.match(/^file:\/\/([^/]*)(\/.*)?$/i);
  const remote = !file && (raw.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^@/]*@)?(\[[^\]]*\]|[^/:]*)(?::\d*)?(\/.*)?$/) || raw.match(/^(?:[^@/:]*@)?(\[[^\]]*\]|[^/:]+):(.*)$/));
  if (remote) {
    const host = remote[1].toLowerCase(), text = decode(remote[2] || '');
    if (!host || text === null) return { unread: true };
    const parts = [];
    for (const s of text.split('/')) if (s === '..') parts.pop(); else if (s && s !== '.') parts.push(s);
    return { host, path: `remote:${parts.join('/').replace(/(?:^|\/)\.git$/, '').replace(/\.git$/, '').toLowerCase()}` }; // a .git folder or suffix, dropped last
  }
  if (file && file[1] && file[1].toLowerCase() !== 'localhost') return { unread: true };
  const local = file ? decode(file[2] || '/') : raw;
  if (local === null) return { unread: true };
  const base = resolve(top, local);
  for (const suffix of ['/.git', '', '.git/.git', '.git']) {
    try {
      let dir = base + suffix;
      if (statSync(dir).isFile()) { const g = readFileSync(dir, 'utf8').match(/^gitdir: (.+)$/m); if (!g) continue; dir = resolve(dirname(dir), g[1].trim()); }
      if (statSync(join(dir, 'HEAD')).isFile() && statSync(join(dir, 'objects')).isDirectory()) { const st = statSync(dir); return { host: '', path: `${st.dev}:${st.ino}` }; }
    } catch { /* not a repository there */ }
  }
  return { host: '', path: real(base).replace(/\/+$/, '').replace(/\.git$/, '') };
}
async function push(n, hash) { // { why } when the push failed or would reach upstream: a stop; else pushed, none or pending
  const profile = readFileSync(join(root, 'project/profile.md'), 'utf8'), short = hash.slice(0, 7);
  if (pushRoute(field(profile, 'Push')) !== 'harness') return (pushes.push(`session ${n}: none, by the Push line`), {});
  // As Git resolves them now, rewrites applied; a remote that exists but whose URLs Git cannot read stops the push, pending.
  const names = must(['remote'], 'the remotes before the push').split('\n');
  const urls = (name, ...a) => { if (!names.includes(name)) return []; const raw = git(['remote', 'get-url', ...a, name]); return raw === null ? null : raw.split('\n').filter(Boolean).map(where); };
  const to = urls('origin', '--push', '--all'), ups = [urls('upstream', '--all'), urls('upstream', '--push', '--all')];
  if (to === null || ups.includes(null)) return { why: `Git could not read ${to === null ? "origin's push URLs" : "upstream's URLs"}: the push is pending, for the owner` };
  const upstream = new Set(ups.flat().map((u) => u.path));
  if (!to.length) return { why: 'no origin to push to' };
  if ([...to, ...ups.flat()].some((u) => u.unread)) return { why: "origin's push URL or upstream's URL is in a form the runner does not read — a remote helper's, a file URL naming another host, or one that does not decode: the push is pending, for the owner" };
  if (to.some((u) => upstream.has(u.path))) return { why: "origin's push URL reaches upstream, where the runner never pushes" };
  const net = networkChoice(field(profile, 'Network')), remote = to.filter((u) => u.host);
  const blocked = remote.length && (!net ? 'the Network line names no one choice' : net.kind === 'closed' ? 'the Network line is closed'
    : net.kind === 'listed' && remote.some((u) => !net.hosts.some((h) => h === u.host || (h.startsWith('*.') && u.host.endsWith(h.slice(1))))) ? "origin's host is not among the Network line's hosts" : '');
  if (blocked) { pushes.push(`session ${n}: pending at ${short} — ${blocked}`); log(`session ${n}: the push is pending: ${blocked}`); return {}; }
  const ms = Math.min(left(), 300e3), r = await group('git', ['push', '--porcelain', 'origin', `${hash}:${branch}`], { cwd: top, env: pushEnv, file: join(out, `push-${n}.log`), ms });
  if (r.timedOut && ms < 300e3) return { why: `the budget is spent: ${hours} h, during the push after session ${n} (pending; push-${n}.log)` };
  if (r.code !== 0) return { why: `the push to origin failed (pending; push-${n}.log)` };
  pushes.push(`session ${n}: origin ${branch.replace('refs/heads/', '')} at ${short}`); return {};
}
function finish(why, code) {
  if (stopped) return; stopped = why; log(`stop: ${why}`);
  const last = sessions.at(-1);
  if (last && !last.commits) last.commits = commits(`${last.before}..HEAD`)?.map((c) => c.hash.slice(0, 7)) ?? ['unreadable'];
  const unpushed = git(['rev-list', '--count', `origin/${branch.replace('refs/heads/', '')}..HEAD`]);
  const report = [`# Run ${stamp} — ${o.phase}`, '', `Stopped: ${why}`, `Harness: ${harness}; budget ${maxSessions} sessions, ${hours} h${usd ? `, $${usd} a session` : ''}; HEAD ${git(['rev-parse', '--short', 'HEAD'])}${unpushed && unpushed !== '0' ? `, ${unpushed} commit(s) not on origin` : ''}`, '',
    '| Session | Ended | Commits | Cost (USD) |', '| --- | --- | --- | --- |', ...sessions.map((s) => `| ${s.n}${s.resumed ? ' (resumed)' : ''} | ${s.ended || `stopped: ${why}`} | ${s.commits?.length ? s.commits.join(', ') : '—'} | ${s.cost ?? '—'} |`), '', 'Pushes:', ...(pushes.length ? pushes.map((p) => `- ${p}`) : ['- none'])];
  writeFileSync(join(out, 'report.md'), report.join('\n') + '\n'); console.log(`\n${report.join('\n')}\nrun: log and streams in ${out}`);
  process.exit(code);
}
// The same failure is the same kind again with no clean cycle — a valid close by a session that ended without error — between.
const repeat = (kind, what) => { if (streak.has(kind)) return `the same failure repeats: ${what}`; streak.add(kind); return ''; };

// ---- the run
log(`run ${stamp}: ${harness}, phase "${o.phase}", ${maxSessions} session(s), ${hours} h; ${harness === 'codex' ? 'Codex runs the hooks only once their trust is recorded' : `settings ${relative(top, settings) || settings}`}`);
const startWhy = writer('') || (dirty() ? 'files no session committed are in the work tree' : '') || await red('before the run', 'before');
if (startWhy === 'hours') spent(', during the checker before any session');
if (startWhy) finish(`${startWhy} (before any session)`, 1);
let from = null, n = 0, retry = '';
{ // the owner's start authorises the first session; a continue end at HEAD names where it resumes
  const { end } = sessionEnd(git(['show', '-s', '--format=%B', 'HEAD']) || '');
  if (end?.status === 'continue' && end.next !== 'none') from = { hash: git(['rev-parse', 'HEAD']), next: end.next };
  const no = leave(from?.next || null);
  if (no) finish(`${no[0]} (before any session)`, no[1]);
}
for (;;) {
  if (n >= maxSessions) finish(`the budget is spent: ${maxSessions} session(s)`, 1);
  if (left() <= 0) finish(`the budget is spent: ${hours} h`, 1);
  n += 1; const before = must(['rev-parse', 'HEAD'], 'HEAD before a session');
  log(`session ${n} starts at ${before.slice(0, 7)}${from ? ` from a continue end, next ${from.next}` : ''}${retry ? ' (the one retry)' : ''}`);
  let s = { n, before }; sessions.push(s);
  let r = await wait(launch(n, prompt(n, from, retry))); s.cost = r.cost;
  // A session that wrote an owner or done end has ended, whatever error followed: it is not resumed, and its close is checked.
  const limited = r.kind === 'limit' || r.kind === 'login', wrote = limited ? stopEnd(commits(`${before}..HEAD`, 0, `session ${n}'s commits after its ${r.kind} error`)) : null;
  if (wrote) log(`session ${n}: a ${r.kind} error after it wrote ${wrote.status === 'owner' ? 'an owner' : 'a done'} end: not resumed; its close is checked as it stands`);
  if (limited && !wrote) { // the clean-room rule (lab/CLEANROOM-AB.md, Amendment 2): pause, resume the same session
    const what = `a ${r.kind} error (${r.error})`, again = repeat(r.kind, what);
    if (again) { s.ended = r.kind; finish(again, 1); }
    if (!r.sid) { s.ended = r.kind; finish(`${what} left no session to resume`, 1); }
    // First the stop conditions that need no checker, so that a session the run must stop for is never resumed: its history
    // intact, no other writer, and the launch checks from the phase's first open item — the phase open, no item needing the
    // owner, no claim by a chat outside the run.
    const other = writer(''), held = git(['merge-base', '--is-ancestor', before, 'HEAD']) === null ? 'history before the session was rewritten, or Git could not read it'
      : other ? `another writer is present: ${other}` : leave(null)?.[0] || '';
    if (held) { s.ended = `${r.kind} error, not resumed`; finish(`${held}, after session ${n}'s ${r.kind} error: not resumed, for the owner`, 1); }
    // The snapshot, within the hours left, before the pause is weighed against them.
    const paused = must(['rev-parse', 'HEAD'], 'HEAD at the pause'), tree = await wait(snapshot('at the pause')), cap = usd === null ? null : Math.round((usd - (r.cost || 0)) * 100) / 100;
    const reset = Number((r.error.match(/\|(\d{10})\b/) || [])[1]) * 1000; // a stated reset, then a minute's margin, or the set pause if shorter
    const ms = reset > Date.now() ? reset - Date.now() + Math.min(60e3, pauseDefault * 1000) : pauseDefault * 1000;
    if (ms >= left()) { s.ended = r.kind; finish(`the budget is spent: a ${r.kind} error's pause outlasts the hours left`, 1); }
    s.ended = `${r.kind} error, paused`; log(`session ${n}: a ${r.kind} error; pausing ${Math.round(ms / 1000)} s, then resuming it once`);
    await wait(sleep(ms));
    const busy = writer(paused);
    if (busy) finish(`another writer is present: ${busy}, during the pause`, 1);
    if (await wait(snapshot('after the pause')) !== tree) finish(`files no session committed changed in the work tree during the pause after session ${n}: another writer`, 1);
    // Immediately before the resume, the claim on the end a start notice would find, then the writer checks again, the last
    // Git reads before the launch, so that a commit or a claim made during the snapshot, the pause or the claim's own reads
    // stops the run; then the hours.
    const e = currentEnd();
    if (e && claimedElsewhere(e.hash)) finish(`another writer is present: a chat outside the run claimed the end at ${e.hash.slice(0, 7)} during the pause after session ${n}: not resumed, for the owner`, 1);
    const late = writer(paused);
    if (late) finish(`another writer is present: ${late}, during the pause, its snapshot or the checks before the resume`, 1);
    if (cap !== null && cap <= 0) finish(`the budget is spent: session ${n} spent its $${usd} cap before the pause`, 1);
    if (left() <= 0) finish(`the budget is spent: ${hours} h, before session ${n}'s resume`, 1);
    const notice = `Harness notice: this session was paused by ${r.kind === 'limit' ? 'a usage limit' : 'a login error'} and has now been resumed. There are no new instructions.`;
    sessions.push(s = { n, before, resumed: true });
    r = await wait(launch(n, notice, { resume: r.sid, cap, tag: '-resumed' })); s.cost = r.cost;
    if (r.kind && r.kind !== 'hours' && r.kind !== 'cost') { const k = r.kind === 'error' ? 'client' : r.kind; s.ended = `a ${k} error after the resume`; finish(`the resumed session ${n} failed too: a ${k} error (${r.error})`, 1); }
  }
  if (r.kind === 'hours') { s.ended = 'ended at the deadline'; finish(`the budget is spent: ${hours} h, during session ${n}`, 1); }
  if (r.kind === 'cost') { s.ended = 'reached its cost cap'; finish(`the budget is spent: session ${n} reached its $${usd} cap`, 1); }
  if (r.kind) { log(`session ${n} ended with an error: ${r.error}`); s.ended = 'a client error'; }
  // What the session left, checked whether or not its close is valid: no other writer, a clean tree, its history intact.
  s.commits = commits(`${before}..HEAD`, 0, `session ${n}'s commits`).map((c) => c.hash.slice(0, 7));
  const busy = writer('');
  if (busy) { s.ended = 'another writer'; finish(`another writer is present: ${busy}`, 1); }
  if (dirty()) { s.ended = 'left files uncommitted'; finish(`files no session committed are in the work tree after session ${n}`, 1); }
  const v = await validate(before, n);
  if (v.hours) spent(`, during the commit check after session ${n}`);
  if (v.stop) { s.ended = `no valid close: ${v.why}`; finish(`${v.why} during session ${n}: another writer or a reset, for the owner`, 1); }
  if (v.why) s.ended = `no valid close: ${v.why}${r.kind ? ', after a client error' : ''}`;
  else s.ended = `${v.end.status} end at ${v.head.slice(0, 7)}${r.kind ? ', after a client error' : ''}`;
  // The checker, the gate, a clean tree and no other writer after them, before any retry, push or next session.
  const head = must(['rev-parse', 'HEAD'], 'HEAD after a session'), why = await red(`after session ${n}`, n);
  if (why === 'hours') spent(`, during the checker after session ${n}`);
  if (why) finish(why, 1);
  const g = await wait(gate(n));
  if (g === 'hours') finish(`the budget is spent: ${hours} h, during the gate after session ${n}`, 1);
  if (g) finish(`${g}, after session ${n}`, 1);
  const moved = writer(head);
  if (moved) finish(`another writer is present: ${moved}, during the gate after session ${n}`, 1);
  if (dirty()) finish(`files no session committed are in the work tree: the gate after session ${n} left them`, 1);
  if (r.kind) { const again = repeat('error', `a client error (${r.error})`); if (again) finish(again, 1); }
  if (v.why) { // one retry, from the end the retry's start notice would find, once the phase and its claims allow it
    if (v.held) finish(`session ${n} ended ${v.held.status}, but its close is invalid (${v.why}): never retried over, for the owner`, 1);
    const again = repeat('close', `${v.why} (session ${n})`);
    if (again) finish(again, 1);
    release();
    if (from && currentEnd()?.hash !== from.hash) from = null;
    const no = leave(from?.next || null);
    if (no) finish(`${no[0]}, after session ${n} ended without a valid close (${v.why})`, 1);
    log(`session ${n}: ${v.why}; one retry`); retry = v.why;
    continue;
  }
  retry = '';
  if (!r.kind) streak.clear();
  const p = await wait(push(n, v.head));
  if (p.why) finish(p.why, 1);
  const after = writer(v.head);
  if (after) finish(`another writer is present: ${after}, during the push after session ${n}`, 1);
  if (dirty()) finish(`files no session committed are in the work tree after the push after session ${n}`, 1);
  const closed = phase().closed;
  if (v.end.status === 'done') finish(closed ? `the phase is done: ${v.end.reason}` : `session ${n} ended done, but the backlog leaves the phase open: a disagreement for the owner`, closed ? 0 : 1);
  if (v.end.status === 'owner') finish(`the next step needs the owner: ${v.end.reason}`, 0);
  if (v.end.next === 'none') finish('a continue end names no next item', 1);
  if (closed) finish(`session ${n} ended continue, but the backlog marks the phase closed: a disagreement for the owner`, 1);
  from = { hash: v.head, next: v.end.next };
  const no = leave(v.end.next);
  if (no) finish(...no);
}
