#!/usr/bin/env node
// pm-next-v3 session sensor and compaction notice (specification 3.15). Zero dependencies.
// The generated hooks run it as `node <checkout>/tools/session.mjs --harness claude|codex` with the hook's JSON on stdin,
// on PostToolUse and on every SessionStart source. Exit 0 always: never a denial or a stop. Writes nothing to the ledger.
// Prints no path, identifier or transcript text. Reads only the transcript the hook names, every complete record since its
// last run, within a hard deadline the main thread enforces over a worker, so no blocked read can hold it; a truncated last
// line waits for the next run. State lives outside the repository ($PM_NEXT_STATE_DIR for tests, else
// $XDG_STATE_HOME/pm-next/session, else ~/.local/state/pm-next/session), keyed by harness, checkout and session, written
// atomically under a short lock; a resume keeps it, a clear or a new session starts afresh, a fork judges its inherited
// context on its own. It speaks once per session while state can be written, and would rather repeat a notice than miss
// one when it cannot; the compaction notice repeats a pending end, and a redelivered compaction event cannot be told from a
// second compaction, so it speaks on each. A Codex rollout that is not verified as this session's root changes no state;
// one verified as another session's, or a subagent's, is ignored. Detection can lag: transcripts are written asynchronously.
import { readFileSync, writeFileSync, renameSync, mkdirSync, openSync, readSync, closeSync, fstatSync, statSync, rmdirSync, constants } from 'node:fs';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const SELF = fileURLToPath(import.meta.url);
const BUDGET_MS = 1500, DEADLINE_MS = 1900, CHUNK = 1 << 16, MAX_LINE = 8 << 20, ANCHOR = 64, LOCK_STALE_MS = 10000, LOCK_WAIT_MS = 1200;
export const SESSION_LINE = /^([1-9]\d*)k tokens of context$/; // the one Session grammar, shared with the checker

if (isMainThread) {
  // The main thread owns the deadline: it reads stdin, runs the sensor in a worker, prints what the worker decided, and ends.
  let out = null;
  const end = () => { if (out) process.stdout.write(JSON.stringify(out) + '\n'); process.exit(0); };
  const timer = setTimeout(end, DEADLINE_MS);
  const parts = [];
  process.stdin.on('data', (d) => parts.push(d));
  process.stdin.on('error', end);
  process.stdin.on('end', () => {
    const argv = process.argv.slice(2), harness = argv[argv.indexOf('--harness') + 1];
    if (!['claude', 'codex'].includes(harness)) return end();
    const at = argv.indexOf('--root'), value = at < 0 ? '' : argv[at + 1];
    const root = value && !value.startsWith('--') ? resolve(value) : resolve(dirname(SELF), '..'); // adapters supply the installation; never infer it from the hook's cwd
    let worker; try { worker = new Worker(SELF, { workerData: { raw: Buffer.concat(parts).toString('utf8'), harness, root, start: Date.now() } }); } catch { return end(); }
    worker.on('message', (m) => { if (m?.notice) out = m.notice; if (m?.done) { clearTimeout(timer); end(); } });
    worker.on('error', end); worker.on('exit', end);
  });
} else {
  sense(workerData).catch(() => {}).finally(() => parentPort.postMessage({ done: true }));
}

async function sense({ raw, harness, root: ROOT, start }) {
  let unlock = () => {};
  try {
    const input = JSON.parse(raw || '{}');
    const event = input.hook_event_name || '', source = event === 'SessionStart' ? String(input.source || '') : '';
    const sid = String(input.session_id || '');
    const threshold = sessionThreshold(ROOT);
    // A subagent (Claude names it; Codex's PostToolUse does not run for one) or nothing to judge against: silent.
    if ('agent_id' in input || !sid || !threshold || !['SessionStart', 'PostToolUse'].includes(event) || input.success === false) return;
    const transcript = typeof input.transcript_path === 'string' && isAbsolute(input.transcript_path) ? input.transcript_path : null;
    const stateDir = process.env.PM_NEXT_STATE_DIR || join(process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'pm-next', 'session');
    const key = `${harness}-${h(ROOT)}-${h(sid)}`, file = join(stateDir, key + '.json'), lock = join(stateDir, key + '.lock');
    const fresh = () => ({ v: 1, epoch: '', offset: 0, ino: 0, anchor: '', peak: 0, last: 0, pending: false, spoke: false, saidUnknown: false, saidUsage: false, seen: 0, known: 0, badUsage: 0, verified: harness !== 'codex' });
    let canWrite = true;
    try { mkdirSync(stateDir, { recursive: true }); } catch { canWrite = false; }
    // One run at a time per session while state can be written, so a notice is given once; a stale lock is a crashed run;
    // a lock still held at the wait's end means state cannot be written by this run, which then repeats rather than misses.
    if (canWrite) {
      canWrite = false;
      while (Date.now() - start < LOCK_WAIT_MS) {
        try { mkdirSync(lock); unlock = () => rmdirSync(lock); canWrite = true; break; } catch (e) {
          if (e.code !== 'EEXIST') break;
          try { if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) { rmdirSync(lock); continue; } } catch { /* raced away */ }
          await new Promise((r) => setTimeout(r, 20));
        }
      }
    }
    let state = fresh();
    try { const s = JSON.parse(readFileSync(file, 'utf8')); if (s && s.v === 1) state = { ...fresh(), ...s }; } catch { /* no state yet, or unreadable: start afresh */ }
    // A Codex root is verified against the rollout named by this very call, never only against earlier state.
    const root = harness === 'codex' ? rootOf(transcript, sid) : 'root';
    if (root === 'foreign') return; // another session's rollout, or a subagent's: ignored
    if (harness === 'codex') state.verified = root === 'root';
    const save = () => {
      if (!canWrite || (harness === 'codex' && !state.verified)) return; // an unverified Codex root changes no state
      try { const tmp = `${file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(state)); renameSync(tmp, file); } catch { canWrite = false; }
    };
    const notice = (text) => parentPort.postMessage({ notice: { hookSpecificOutput: { hookEventName: event, additionalContext: text } } });
    const endText = () => `pm-next: this session's context was last observed at ${state.last} tokens, and an observation passed the profile's Session line (${threshold / 1000}k). End this session at its next close: record any owner instruction the record lacks first (verbs/close.md step 4), commit with the Session-end line, say so, and stop. A re-read or a lower reading does not cancel this.`;
    // A clear, a fork or a start begins an epoch; the same event delivered again does not begin another.
    if (source === 'startup' || source === 'clear' || source === 'fork') {
      const epoch = h(`${source}|${raw}`);
      if (state.epoch !== epoch) { const verified = state.verified; state = fresh(); state.epoch = epoch; state.verified = verified; if (source !== 'startup') Object.assign(state, baseline(transcript)); }
    }
    let status = 'ok';
    if (source !== 'compact') status = observe(transcript, state, harness, sid, start); // every SessionStart source and every tool call examines what was written since the last run
    if (status === 'unknown' && event === 'SessionStart') status = 'lag'; // at a session start the transcript may not exist yet: not unknown, just not written
    if (status === 'root-unverified') return;
    const inherited = input.context_tokens; // Claude Code's documented context on a resume or fork; anything but a count is ignored
    if ((source === 'resume' || source === 'fork') && count(inherited)) { state.last = inherited; state.peak = Math.max(state.peak, inherited); }
    if (state.peak > threshold) state.pending = true; // the Session line is read at run time: a lowered line counts earlier observations, a raised one cancels nothing
    const writable = canWrite && (harness !== 'codex' || state.verified);
    if (source === 'compact') {
      state.pending = true; state.spoke = true; save();
      notice(`pm-next: this session was compacted. Read the rule-1 set again before your next change (AGENTS.md rule 1): the record files survive only as the summary describes them. End this session at its next close (verbs/close.md step 4); a pending end is not cancelled by the re-read or by a lower reading.`);
    } else if (state.pending && (!state.spoke || !writable)) { state.spoke = true; save(); notice(endText()); }
    else if (status === 'unknown' && (!state.saidUnknown || !writable)) { state.saidUnknown = true; save(); notice(`pm-next: the session sensor cannot read this session's transcript, so the profile's Session line (${threshold / 1000}k tokens) is an instruction only: judge your own context, and once past it end this session at its next close (verbs/close.md step 4).`); }
    else if (state.badUsage > 0 && (!state.saidUsage || !writable)) { state.saidUsage = true; save(); notice(`pm-next: some of this session's usage records cannot be read, so the sensor's readings may lag; the profile's Session line (${threshold / 1000}k tokens) still applies — judge your own context too.`); }
    else save();
  } catch { /* the sensor never blocks work */ } finally { try { unlock(); } catch { /* nothing held */ } }
}

function h(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }
function count(v) { return Number.isInteger(v) && v >= 0; } // a usable token count: a non-negative whole number, never a coerced zero
function sessionThreshold(root) {
  let text; try { text = readFileSync(join(root, 'project', 'profile.md'), 'utf8'); } catch { return 0; }
  const activeText = fenceless(text.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, ''));
  const lines = [...activeText.matchAll(/^- Session:(.*)$/gm)];
  const m = lines.length === 1 && lines[0][1].trim().match(SESSION_LINE);
  return m ? Number(m[1]) * 1000 : 0;
}
function fenceless(s) { // the counting rule's fences: a closing fence of the opening's character, at least its length, nothing after it
  return s.replace(/^([ \t]*)(`{3,})[^\n]*\n[\s\S]*?^\1\2`*[ \t]*$/gm, '').replace(/^([ \t]*)(~{3,})[^\n]*\n[\s\S]*?^\1\2~*[ \t]*$/gm, '');
}
function open(path) { // never block on a FIFO or a device; only a regular file is a transcript
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NONBLOCK || 0));
  const st = fstatSync(fd);
  if (!st.isFile()) { closeSync(fd); throw Error('not a file'); }
  return { fd, size: st.size, ino: st.ino };
}
function anchorOf(fd, end) { // the bytes just before the cursor, so a rewritten transcript is noticed and read again
  const n = Math.min(ANCHOR, end), buf = Buffer.alloc(n);
  if (n > 0) readSync(fd, buf, 0, n, end - n);
  return h(buf.toString('latin1'));
}
function ownRoot(p, sid) { return !!p && typeof p === 'object' && (p.id === sid || p.session_id === sid) && !('parent_thread_id' in p) && !/subagent/i.test(JSON.stringify([p.source, p.thread_source])); }
// What the named rollout's first complete record says: 'root' (this session's), 'foreign' (another's, or a subagent's) or 'unknown'.
function rootOf(path, sid) {
  if (!path) return 'unknown';
  try {
    const f = open(path);
    try {
      const buf = Buffer.alloc(Math.min(CHUNK, f.size)); if (buf.length) readSync(f.fd, buf, 0, buf.length, 0);
      const nl = buf.indexOf(10); if (nl <= 0) return 'unknown';
      const r = JSON.parse(buf.subarray(0, nl).toString('utf8'));
      if (r.type !== 'session_meta' || !r.payload || typeof r.payload !== 'object') return 'unknown';
      return ownRoot(r.payload, sid) ? 'root' : 'foreign';
    } finally { closeSync(f.fd); }
  } catch { return 'unknown'; }
}
function baseline(path) { // the cursor at the end of what exists now, so earlier records are never this epoch's
  if (!path) return {};
  try { const f = open(path); try { return { offset: f.size, ino: f.ino, anchor: anchorOf(f.fd, f.size) }; } finally { closeSync(f.fd); } } catch { return {}; }
}
// Read every complete line written since state.offset, within the time budget. Returns 'ok', 'lag' (nothing new yet),
// 'unknown' (no transcript, or nothing of either format) or 'root-unverified' (Codex: this session's root is not
// established). Only strictly above the threshold passes it; cache components count within one call; cumulative totals are
// ignored; a malformed count is never zero, and is remembered so the sensor can say once that some records are unreadable.
function observe(path, state, harness, sid, start) {
  if (!path) return 'unknown';
  let f; try { f = open(path); } catch { return 'unknown'; }
  try {
    if (f.size < state.offset || (state.ino && f.ino !== state.ino) || (state.offset && anchorOf(f.fd, state.offset) !== state.anchor)) { // rewritten: start again
      Object.assign(state, { offset: 0, anchor: '', seen: 0, known: 0, badUsage: 0 });
    }
    state.ino = f.ino;
    if (f.size === state.offset) return state.verified ? 'lag' : 'root-unverified';
    let readPos = state.offset, pos = state.offset, carry = Buffer.alloc(0);
    const buf = Buffer.alloc(CHUNK);
    const take = (t) => { state.last = t; state.peak = Math.max(state.peak, t); };
    while (readPos < f.size && Date.now() - start < BUDGET_MS) {
      const n = readSync(f.fd, buf, 0, Math.min(CHUNK, f.size - readPos), readPos); if (n <= 0) break;
      readPos += n;
      const data = Buffer.concat([carry, buf.subarray(0, n)]), cut = data.lastIndexOf(10); // the last complete line in hand
      if (cut < 0) { carry = data.length > MAX_LINE ? Buffer.alloc(0) : data; if (data.length > MAX_LINE) { pos = readPos; state.seen++; } continue; } // a line longer than the chunk waits for its end; an absurd one is skipped
      carry = data.subarray(cut + 1); pos = readPos - carry.length;
      for (const line of data.subarray(0, cut).toString('utf8').split('\n')) {
        if (!line.trim()) continue;
        state.seen++;
        let r; try { r = JSON.parse(line); } catch { continue; }
        if (!r || typeof r !== 'object') continue;
        if (harness === 'codex') {
          const p = r.payload;
          if (r.type === 'session_meta') { state.known++; if (!ownRoot(p, sid)) { state.offset = pos; state.anchor = anchorOf(f.fd, pos); return 'root-unverified'; } }
          else if (r.type === 'event_msg' && p?.type === 'token_count') {
            state.known++; const t = p.info?.last_token_usage?.input_tokens;
            if (count(t)) { if (state.verified) take(t); } else state.badUsage++;
          } else if (['response_item', 'turn_context', 'compacted', 'token_usage_record'].includes(r.type)) state.known++;
        } else if (r.type === 'assistant' && !r.isSidechain && (!r.sessionId || r.sessionId === sid) && r.message && typeof r.message === 'object' && 'usage' in r.message) {
          state.known++; const u = r.message.usage || {};
          const parts = [u.input_tokens, u.cache_creation_input_tokens, u.cache_read_input_tokens]; // one call's context: cache components within it
          if (parts.every(count)) take(parts[0] + parts[1] + parts[2]); else state.badUsage++;
        } else if (['assistant', 'user', 'system', 'attachment', 'summary'].includes(r.type)) state.known++;
      }
    }
    state.offset = pos; state.anchor = anchorOf(f.fd, pos);
    if (state.seen >= 20 && state.known === 0) return 'unknown'; // nothing of either format: say so once
    if (harness === 'codex' && !state.verified) return 'root-unverified';
    return 'ok';
  } catch { return 'unknown'; } finally { closeSync(f.fd); }
}
