#!/usr/bin/env node
// pm-next-v3.1 start notice (specification 3.15, the start notice). Zero dependencies.
// The generated hooks run it as `node <checkout>/tools/handover.mjs --harness claude|codex` with the hook's JSON on stdin,
// on SessionStart with the source startup or clear. It reads only this repository's Git: the nearest first-parent commit
// carrying a Session-end line, within 256 commits and 1 MiB, and whether that end is still current — no commit in
// end..HEAD, merged ones included, is titled with the next ID and a colon; an end naming none is current only while its
// commit is HEAD; in a shallow repository an end below HEAD cannot be shown current. A malformed or repeated line stops the
// search with one plain sentence, never an older end. A current end is claimed before it is shown: one file per end
// commit under pm-next/handover in Git's common directory, never committed, made whole by linking a complete temporary
// file, or by an exclusive create where links are refused; the holder is a hash of harness and session, so a redelivery
// to it is idempotent, and any other chat sees the end as held and asks the owner, whose word is the recovery. Claim state
// that cannot be read or written, or is not a regular file, shows the end as unconfirmed. Separate clones cannot see each
// other's claims. Exit 0 always: never a denial or a stop. Uses no network; prints no path of its own, no session
// identifier and no transcript text, and withholds a reason holding a local path or an identifier-shaped string. The main
// thread owns a deadline: Git runs in its own process group and the claim in a worker, and both are ended with the process.
// A chat that claims an end naming an item gets a title (V31-CHAT-TITLES): the ID, `#` and one more than the first-parent
// commits titled with it that carry a Session-end line, over the whole history, then `·` and the claim's local HH:MM — the
// number left out where it cannot be told. Claude Code takes it as the hook's sessionTitle at startup; the notice asks the
// chat to give itself the title, with a few words of its task, where its client lets a chat rename itself.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, linkSync, unlinkSync, openSync, readSync, fstatSync, closeSync, constants } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { sessionEnd, sessionEndLines } from './ledger.mjs';

const SELF = fileURLToPath(import.meta.url);
const DEADLINE_MS = 1900, MAX_COMMITS = 256, MAX_BYTES = 1 << 20, MAX_INPUT = 1 << 20, MAX_REASON = 2000, MAX_CLAIM = 4096;
// A reason is withheld when it holds a local path — a rooted path other than a harness command such as /compact, a home
// path, a file URL, a drive or a share — or an identifier-shaped string: a UUID, a runner's agent identifier, or any named
// session, thread, conversation, agent or chat identifier. Withholding is conservative: a UUID of any kind is withheld.
const COMMANDS = 'compact|clear|resume|hooks|help|model|config|status|memory|init|review';
const UNSAFE = [
  // a command token ends at the text's end, at a space, or at punctuation not followed by a name: /config.json is a path
  new RegExp(`(?:^|[\\s"'\`(<[{=,;:])(?:~\\/|\\/(?!(?:${COMMANDS})(?=$|\\s|["'\`)>\\]},;:.!?](?![\\w/~-])))[^\\s/"'\`<>()])`),
  /\bfile:\/\//i, /\b[A-Za-z]:[\\/]/, /\\\\[A-Za-z0-9._$-]+\\/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, /\ba[0-9a-f]{16}\b/i,
  /\b(?:session|thread|conversation|agent|chat)[\s_-]?ids?\b/i,
];

if (!isMainThread) parentPort.postMessage(take(workerData)); // the claim, in a worker the deadline can end
else {
  const children = new Set();
  let out = null;
  const finish = () => {
    for (const c of children) stop(c);
    if (out) process.stdout.write(JSON.stringify(out) + '\n');
    process.exit(0);
  };
  setTimeout(finish, DEADLINE_MS);
  const parts = []; let size = 0;
  process.stdin.on('data', (d) => { size += d.length; if (size > MAX_INPUT) finish(); else parts.push(d); });
  process.stdin.on('error', finish);
  process.stdin.on('end', () => { main(Buffer.concat(parts).toString('utf8'), children, (o) => { out = o; }).catch(() => {}).finally(finish); });
}

async function main(raw, children, emit) {
  const argv = process.argv.slice(2), harness = argv[argv.indexOf('--harness') + 1];
  if (!['claude', 'codex'].includes(harness)) return;
  const at = argv.indexOf('--root'), value = at < 0 ? '' : argv[at + 1];
  const root = value && !value.startsWith('--') ? resolve(value) : resolve(dirname(SELF), '..'); // never the hook's cwd
  const input = JSON.parse(raw || '{}');
  if (input.hook_event_name !== 'SessionStart' || !['startup', 'clear'].includes(input.source) || 'agent_id' in input) return;
  const sid = typeof input.session_id === 'string' ? input.session_id : '';
  const say = (text, title = '') => emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `pm-next start notice: ${text}`, ...(title ? { sessionTitle: title } : {}) } });
  const git = (args) => spawnGit(root, args, children);
  // One snapshot of HEAD; the walk and the currency check read from it, and HEAD is read again before claiming.
  const snap = (await capture(git(['rev-parse', '--path-format=absolute', '--git-common-dir', '--is-shallow-repository', 'HEAD'])))?.split('\n');
  if (!snap || snap.length < 3 || !/^[0-9a-f]{40,64}$/.test(snap[2])) return; // no repository, or no commit yet
  const [common, shallow, head] = snap;
  let found = null, rec = [];
  await fields(git(['log', '--first-parent', `-n${MAX_COMMITS}`, '-z', '--format=%H%x00%cI%x00%B', head, '--']), (f) => {
    rec.push(f); if (rec.length < 3) return false;
    const [hash, date, body] = rec; rec = [];
    if (!sessionEndLines(body).length) return false;
    found = { hash, short: hash.slice(0, 7), date: date.slice(0, 10), ...sessionEnd(body) }; return true;
  });
  if (!found) return; // no end within the bounds: nothing to show
  if (!found.end) return say(`the last Session-end line in this checkout's history, at commit ${found.short}, cannot be read (malformed or repeated), so no handover is shown and no older end stands in for it; start from the rule-1 set (AGENTS.md rule 1) and the backlog.`);
  const { status, next, reason } = found.end;
  const unknown = () => say(`whether the last session end in this checkout's history (commit ${found.short}) is still current cannot be told here — the history is shallow or past this hook's bounds — so it is not shown or claimed; start from the rule-1 set (AGENTS.md rule 1) and ask the owner.`);
  if (next === 'none') { if (found.hash !== head) return; } else if (found.hash !== head) {
    if (shallow !== 'false') return unknown(); // commits that would retire the end may be missing
    let stale = false;
    const walked = await fields(git(['log', '-z', '--format=%s', `${found.hash}..${head}`, '--']), (s) => (stale = s.startsWith(`${next}:`)));
    if (stale) return; // retired by the first commit titled with its next item
    if (walked !== 'done') return unknown();
  }
  if ((await capture(git(['rev-parse', '-q', '--verify', 'HEAD'])))?.trim() !== head) return say(`this checkout's history moved while the start notice was read, so the last session end is not shown or claimed: another session may be committing. Read the rule-1 set (AGENTS.md rule 1) and ask the owner.`);
  const shown = reason.length > MAX_REASON || UNSAFE.some((re) => re.test(reason)) ? `(the reason is not shown: it is too long, or holds a local path or an identifier; read it with git show ${found.short})` : reason;
  const opening = `the last session in this checkout ended at commit ${found.short} (${found.date}) with "Session-end: ${status} — next ${next} — ${shown}".`;
  const unconfirmed = `${opening} This handover could not be claimed for this chat, so another chat may hold it: read the rule-1 set (AGENTS.md rule 1) and ask the owner before acting on it.`;
  const counting = next !== 'none' && shallow === 'false' ? count(git, head, next) : Promise.resolve(null); // beside the claim
  say(unconfirmed); // stands if the claim does not answer before the deadline
  const claim = sid ? await claimed({ common, end: found.hash, holder: h(`${harness}|${sid}`) }) : { state: 'unconfirmed' };
  if (claim.state === 'held') return say(`${opening} Another chat in this checkout claimed this handover${claim.at ? ` at ${claim.at} UTC` : ''}: do not act on it unless the owner says that chat has finished, for the owner's word is the recovery. Read the rule-1 set (AGENTS.md rule 1) and ask the owner.`);
  if (claim.state !== 'mine') return say(unconfirmed);
  const step = {
    continue: `Read the rule-1 set first (AGENTS.md rule 1), then ${next === 'none' ? 'take the next step the record names' : `resume ${next} from its backlog line and item file`}; the record, not this notice, is the authority.`,
    owner: 'The next step needs the owner: read the rule-1 set (AGENTS.md rule 1) and ask the owner before acting; this end gives no leave to continue.',
    done: 'That session closed a phase: read the rule-1 set (AGENTS.md rule 1); the next step waits on the owner\'s word, and this end gives no leave to continue.',
  }[status];
  const text = `${opening} This handover is claimed for this chat; another chat opened in this checkout is told it is held. ${step}`;
  if (next === 'none' || UNSAFE.some((re) => re.test(next))) return say(text); // an identifier-shaped ID titles nothing
  const titled = (n) => {
    const title = `${next}${n ? ` #${n}` : ''} · ${clock(claim.at)}`;
    const how = harness === 'claude' ? ', as the Claude desktop app does with its set_session_title tool on "self"' : '';
    say(`${text} If your client lets a chat rename itself${how}, title this chat "${title} — " followed by a few words of its task, with no path, identifier or reason text; otherwise leave its title as it is.`, harness === 'claude' && input.source === 'startup' ? title : '');
  };
  titled(null); // stands if the count does not answer before the deadline
  const n = await counting;
  if (n) titled(n);
}

// One more than the commits on the first-parent line, over the whole history, titled with the item and carrying a
// Session-end line; null where that cannot be told — a shallow repository, past 1 MiB of matching messages, or Git failing.
async function count(git, head, next) {
  let n = 0, rec = [];
  const walked = await fields(git(['log', '--first-parent', '-z', '--format=%s%x00%B', '-E', '--all-match', `--grep=^${next}:`, '--grep=^Session-end:', head, '--']), (f) => {
    rec.push(f); if (rec.length < 2) return false;
    const [subject, body] = rec; rec = [];
    if (subject.startsWith(`${next}:`) && sessionEndLines(body).length) n += 1;
    return false;
  });
  return walked === 'done' ? n + 1 : null;
}
// The chat's start as local HH:MM: the claim's time, so a redelivery keeps its title; the hook's own clock where it has none.
function clock(at) {
  const claimed = new Date(typeof at === 'string' ? at : NaN), t = Number.isNaN(claimed.getTime()) ? new Date() : claimed;
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

function h(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }
// Git without the caller's routing — no inherited GIT_* variable, optional locks, prompt or replacement objects — in a
// process group of its own, so that ending it ends anything it started.
function spawnGit(root, args, children) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const child = spawn('git', ['--no-pager', '-c', 'log.showSignature=false', ...args], {
    cwd: root, stdio: ['ignore', 'pipe', 'ignore'], detached: process.platform !== 'win32',
    env: { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1' },
  });
  children.add(child); child.on('close', () => children.delete(child)); child.on('error', () => children.delete(child));
  return child;
}
function stop(child) {
  try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* gone */ } }
}
// A short Git answer, or null on any failure.
function capture(child) {
  return new Promise((res) => {
    let text = '';
    child.stdout.on('data', (d) => { if (text === null) return; text += d; if (text.length > 65536) { text = null; stop(child); } });
    child.on('error', () => res(null));
    child.on('close', (code) => res(code === 0 && text !== null ? text.replace(/\n$/, '') : null));
  });
}
// Each NUL-terminated field of Git's output to `take`, which returns true to stop. Resolves 'done' when Git finished and
// every field was read, 'stopped' when `take` stopped it, 'over' past MAX_BYTES and 'failed' otherwise.
function fields(child, take) {
  return new Promise((res) => {
    let carry = Buffer.alloc(0), bytes = 0, settled = false;
    const settle = (v) => { if (settled) return; settled = true; if (v === 'stopped' || v === 'over') stop(child); res(v); };
    child.stdout.on('data', (d) => {
      if (settled) return;
      const room = MAX_BYTES - bytes, chunk = d.length > room ? d.subarray(0, room) : d;
      bytes += chunk.length;
      let buf = Buffer.concat([carry, chunk]), cut;
      while ((cut = buf.indexOf(0)) >= 0) {
        const field = buf.subarray(0, cut).toString('utf8'); buf = buf.subarray(cut + 1);
        if (take(field)) return settle('stopped');
      }
      carry = buf;
      if (chunk.length < d.length) settle('over');
    });
    child.on('error', () => settle('failed'));
    child.on('close', (code) => settle(code === 0 && carry.length === 0 ? 'done' : 'failed'));
  });
}
// The claim, in a worker: whatever it waits on, the main thread's deadline still ends the process.
function claimed(data) {
  return new Promise((res) => {
    let w; try { w = new Worker(SELF, { workerData: data }); } catch { return res({ state: 'unconfirmed' }); }
    w.on('message', res); w.on('error', () => res({ state: 'unconfirmed' })); w.on('exit', () => res({ state: 'unconfirmed' }));
  });
}
// Taken once per end commit. A complete temporary file is linked into place, so a reader never sees a partial claim; where
// links are refused (or PM_NEXT_LINKLESS is set, for tests) an exclusive create stands in, and a partial file read back is
// unconfirmed, never mine. Only a regular file, opened without blocking and read within MAX_CLAIM bytes, is a claim.
function take({ common, end, holder }) {
  const dir = join(common, 'pm-next', 'handover'), file = join(dir, `${end}.json`);
  const at = new Date().toISOString(), body = JSON.stringify({ v: 1, end, holder, at }) + '\n';
  const tmp = join(dir, `.${end}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
  let made = false;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, body, { flag: 'wx' });
    try { if (process.env.PM_NEXT_LINKLESS) throw Object.assign(Error('links refused'), { code: 'EPERM' }); linkSync(tmp, file); made = true; } catch (e) {
      if (e.code !== 'EEXIST') { try { writeFileSync(file, body, { flag: 'wx' }); made = true; } catch (e2) { if (e2.code !== 'EEXIST') return { state: 'unconfirmed' }; } }
    }
  } catch { return { state: 'unconfirmed' }; } finally { try { unlinkSync(tmp); } catch { /* never made */ } }
  if (made) return { state: 'mine', at };
  try {
    const fd = openSync(file, constants.O_RDONLY | (constants.O_NONBLOCK || 0) | (constants.O_NOFOLLOW || 0));
    let text = '';
    try {
      const st = fstatSync(fd);
      if (!st.isFile() || st.size > MAX_CLAIM) return { state: 'unconfirmed' };
      const buf = Buffer.alloc(MAX_CLAIM), n = readSync(fd, buf, 0, MAX_CLAIM, 0); text = buf.subarray(0, n).toString('utf8');
    } finally { closeSync(fd); }
    const c = JSON.parse(text);
    if (c && c.v === 1 && c.end === end && typeof c.holder === 'string' && c.holder) {
      const time = typeof c.at === 'string' ? (c.at.match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/) || [])[1] : '';
      return c.holder === holder ? { state: 'mine', at: typeof c.at === 'string' ? c.at : '' } : { state: 'held', at: time || '' };
    }
  } catch { /* unreadable or partial: unconfirmed */ }
  return { state: 'unconfirmed' };
}
