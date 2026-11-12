#!/usr/bin/env node
// Read-only structural and budget check. Warnings do not fail; semantics remain human.
// `--commit <rev>` adds the commit's shape: title, Verify, an optional Checked line, an optional Session-end line, and the
// removed-line trace against the parent; where the project keeps a model policy, a commit that ships an item without a
// Checked line is warned (V31-MODEL-POLICY). Without it, the trace compares the working tree and the staged tree with HEAD.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inspect, options, appCommitWarning, ID, removedLineFlags, SESSION_END, sessionEndLines, wishChanges, reusedWishIds, wishIds } from './ledger.mjs';
const MODEL_POLICY = 'project/model-policy.md';
const LEDGER = { backlog: 'project/backlog.md', wish: 'project/wish-list.md', trajectory: 'project/trajectory.md', decisions: 'project/decisions.md' };
try {
  const args = options(['audit-prose', 'commit', 'date']);
  const result = inspect(args.root, { auditProse: args['audit-prose'], checkDate: args.date || '' });
  // V31-C4-MERMAID (3.26): a broken architecture envelope fails here, so a close cannot pass over it; the view still shows it.
  // V31-C4-FIX: only the record, the file carrying its mark, has an envelope; a project's own file at the path has none.
  for (const m of result.architecture?.problems || []) result.fails.push(`project/architecture.md: ${m} (3.26)`);
  const git = (...a) => execFileSync('git', a, { cwd: args.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  // V31-APP-SWITCH (3.28): the App opinion line's commit counts, Git's, read only when the line is there.
  if (result.app) {
    let n = NaN; try { n = Number(git('rev-list', '--count', `--since=${result.app.date}T00:00:00`, 'HEAD').trim()); } catch { /* not a repository: the date reads stand */ }
    const m = appCommitWarning(result.app, n);
    if (m && !result.warns.includes(m)) result.warns.push(m);
  }
  let prefix = ''; try { prefix = git('rev-parse', '--show-prefix').trim(); } catch { /* not a repository */ } // the installation may sit below the repository root
  const tree = (rev) => { // the four trace files at a revision ('' = the index); a missing file reads as empty
    const out = {};
    for (const [k, p] of Object.entries(LEDGER)) { try { out[k] = git('show', `${rev}:${prefix}${p}`); } catch { out[k] = ''; } }
    return out;
  };
  const working = Object.fromEntries(Object.entries(LEDGER).map(([k, p]) => { try { return [k, readFileSync(join(args.root, p), 'utf8')]; } catch { return [k, '']; } }));
  // V31-WISH-IDS: for the reuse check, every line the wish list ever held and every commit message up to a revision, and
  // the archived decisions and item files on disk
  const history = (rev, before, after) => {
    if (!wishIds(after.wish).some((id) => !wishIds(before.wish).includes(id))) return '';
    let out = '';
    try { out += git('log', '--format=%B', rev) + git('log', '-p', '--format=', rev, '--', LEDGER.wish); } catch { /* no history */ }
    for (const dir of ['project', 'project/items']) { try { for (const f of readdirSync(join(args.root, dir)).filter((n) => /^decisions-.*\.md$|^[^_].*\.md$/.test(n) && (dir !== 'project' || n.startsWith('decisions-')))) out += '\n' + readFileSync(join(args.root, dir, f), 'utf8'); } catch { /* none */ } }
    return out;
  };
  const wishNotes = (label, before, after, message, rev) => {
    for (const m of wishChanges(before, after, message)) result.info.push(`${label}${m}`);
    for (const m of reusedWishIds(before, after, history(rev, before, after))) result.warns.push(`${label}${m}`);
  };
  let inGit = false; try { git('rev-parse', '--verify', 'HEAD'); inGit = true; } catch { /* not a repository, or no commit yet: no trace to compare */ }
  if (args.commit) {
    const message = git('show', '-s', '--format=%B', '--end-of-options', args.commit);
    const match = message.split('\n')[0].match(new RegExp(`^(${ID}): \\S.+$`));
    if (!match || (!result.open.has(match[1]) && !result.shipped.has(match[1]) && !result.retired.has(match[1]) && !result.decisions.some((e) => e.id === match[1]) && !result.archives.some((a) => a.entries.some((e) => e.id === match[1])))) result.fails.push('commit: title must be ID: summary with an ID present in the ledger');
    if (!/^Verify: \S.+$/m.test(message)) result.fails.push('commit: missing substantive Verify declaration');
    const checked = message.split('\n').filter((l) => /^Checked:/.test(l));
    for (const line of checked) {
      if (!/^Checked: \S[^—\n]* — \S[^—\n]* — \S.*$/.test(line)) result.fails.push(`commit: Checked line must read "Checked: <model> — <verdict> — <scope>": ${line}`);
    }
    const ends = sessionEndLines(message);
    if (ends.length > 1) result.fails.push(`commit: ${ends.length} Session-end lines; exactly one marks a session end or a whole-phase stop — continue, done or owner, then next <ID | none>, then the reason (3.15)`);
    for (const line of ends) {
      const m = line.match(SESSION_END);
      if (!m) result.fails.push(`commit: Session-end line must read "Session-end: <continue | done | owner> — next <ID | none> — <reason>" — continue for an end with authorised work left, done for a closed phase, owner when the next step needs the owner; the ID is the next item's, in the ledger's grammar, or none; the reason is one non-empty line naming the next item or unfinished step, where it is recorded and any blocker (3.15): ${line}`);
      else if (m[2] !== 'none' && !result.open.has(m[2])) result.warns.push(`commit: Session-end names ${m[2]} as next, which is not an open backlog item`);
    }
    let parent = null; try { parent = tree(`${args.commit}^`); } catch { /* a root commit: nothing before it */ }
    if (parent) {
      const after = tree(args.commit); for (const f of removedLineFlags(parent, after, message)) result.warns.push(`commit: ${f}`); wishNotes('commit: ', parent, after, message, `${args.commit}^`);
      // V31-MODEL-POLICY: the policy names the steps a second model checks; a close is one, so a commit that adds a
      // trajectory item line carries a Checked line, a skip's included. Shape only: no line proves a check ran.
      let policy = false; try { git('cat-file', '-e', `${args.commit}:${prefix}${MODEL_POLICY}`); policy = true; } catch { /* no policy kept */ }
      const ids = (t) => t.split('\n').map((l) => l.match(new RegExp(`^- (${ID}) — `))?.[1]).filter(Boolean); // an edited line ships nothing new
      const before = new Set(ids(parent.trajectory)), shipped = [...new Set(ids(after.trajectory))].filter((id) => !before.has(id));
      if (policy && shipped.length && !checked.length) result.warns.push(`commit: ships ${shipped.join(', ')} with no Checked line; ${MODEL_POLICY} asks for one, or "Checked: none — skipped — <step>: <reason>" (rule 9)`);
    }
    result.info.push(`commit shape checked${ends.length ? ', Session-end line present' : ''}; a Verify or Checked declaration is not proof of execution`);
  } else if (inGit) {
    const head = tree('HEAD'), seen = new Set();
    for (const [label, after] of [['staged', tree('')], ['working tree', working]]) {
      for (const f of removedLineFlags(head, after)) if (!seen.has(f)) { seen.add(f); result.warns.push(`${label}: ${f}`); }
    }
    wishNotes('working tree: ', head, working, '', 'HEAD');
  }
  for (const [key, prefix] of [['info', 'INFO'], ['warns', 'WARN'], ['fails', 'FAIL']]) {
    for (const message of result[key]) console.log(`${prefix}  ${message}`);
  }
  console.log(`check: ${result.fails.length} structural or budget failure(s), ${result.warns.length} warning(s)`);
  process.exitCode = result.fails.length ? 1 : 0;
} catch (e) { console.error(`check: ${e.message}`); process.exitCode = 1; }
