#!/usr/bin/env node
// Read-only structural and budget check. Warnings do not fail; semantics remain human.
// `--commit <rev>` adds the commit's shape: title, Verify, an optional Checked line, an optional Session-end line, and the
// removed-line trace against the parent. Without it, the trace compares the working tree and the staged tree with HEAD.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspect, options, ID, removedLineFlags } from './ledger.mjs';
const LEDGER = { backlog: 'project/backlog.md', wish: 'project/wish-list.md', trajectory: 'project/trajectory.md', decisions: 'project/decisions.md' };
try {
  const args = options(['audit-prose', 'commit']);
  const result = inspect(args.root, { auditProse: args['audit-prose'] });
  const git = (...a) => execFileSync('git', a, { cwd: args.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  let prefix = ''; try { prefix = git('rev-parse', '--show-prefix').trim(); } catch { /* not a repository */ } // the installation may sit below the repository root
  const tree = (rev) => { // the four trace files at a revision ('' = the index); a missing file reads as empty
    const out = {};
    for (const [k, p] of Object.entries(LEDGER)) { try { out[k] = git('show', `${rev}:${prefix}${p}`); } catch { out[k] = ''; } }
    return out;
  };
  const working = Object.fromEntries(Object.entries(LEDGER).map(([k, p]) => { try { return [k, readFileSync(join(args.root, p), 'utf8')]; } catch { return [k, '']; } }));
  let inGit = false; try { git('rev-parse', '--verify', 'HEAD'); inGit = true; } catch { /* not a repository, or no commit yet: no trace to compare */ }
  if (args.commit) {
    const message = git('show', '-s', '--format=%B', '--end-of-options', args.commit);
    const match = message.split('\n')[0].match(new RegExp(`^(${ID}): \\S.+$`));
    if (!match || (!result.open.has(match[1]) && !result.shipped.has(match[1]) && !result.decisions.some((e) => e.id === match[1]) && !result.archives.some((a) => a.entries.some((e) => e.id === match[1])))) result.fails.push('commit: title must be ID: summary with an ID present in the ledger');
    if (!/^Verify: \S.+$/m.test(message)) result.fails.push('commit: missing substantive Verify declaration');
    for (const line of message.split('\n').filter((l) => /^Checked:/.test(l))) {
      if (!/^Checked: \S[^—\n]* — \S[^—\n]* — \S.*$/.test(line)) result.fails.push(`commit: Checked line must read "Checked: <model> — <verdict> — <scope>": ${line}`);
    }
    const ends = message.split('\n').filter((l) => /^Session-end:/.test(l));
    if (ends.length > 1) result.fails.push(`commit: ${ends.length} Session-end lines; exactly one marks a session end or a whole-phase stop — continue, done or owner, then next <ID | none>, then the reason (3.15)`);
    for (const line of ends) {
      const m = line.match(new RegExp(`^Session-end: (continue|done|owner) — next (${ID}|none) — (\\S.*)$`));
      if (!m) result.fails.push(`commit: Session-end line must read "Session-end: <continue | done | owner> — next <ID | none> — <reason>" — continue for an end with authorised work left, done for a closed phase, owner when the next step needs the owner; the ID is the next item's, in the ledger's grammar, or none; the reason is one non-empty line naming the next item or unfinished step, where it is recorded and any blocker (3.15): ${line}`);
      else if (m[2] !== 'none' && !result.open.has(m[2])) result.warns.push(`commit: Session-end names ${m[2]} as next, which is not an open backlog item`);
    }
    let parent = null; try { parent = tree(`${args.commit}^`); } catch { /* a root commit: nothing before it */ }
    if (parent) for (const f of removedLineFlags(parent, tree(args.commit), message)) result.warns.push(`commit: ${f}`);
    result.info.push(`commit shape checked${ends.length ? ', Session-end line present' : ''}; a Verify or Checked declaration is not proof of execution`);
  } else if (inGit) {
    const head = tree('HEAD'), seen = new Set();
    for (const [label, after] of [['staged', tree('')], ['working tree', working]]) {
      for (const f of removedLineFlags(head, after)) if (!seen.has(f)) { seen.add(f); result.warns.push(`${label}: ${f}`); }
    }
  }
  for (const [key, prefix] of [['info', 'INFO'], ['warns', 'WARN'], ['fails', 'FAIL']]) {
    for (const message of result[key]) console.log(`${prefix}  ${message}`);
  }
  console.log(`check: ${result.fails.length} structural or budget failure(s), ${result.warns.length} warning(s)`);
  process.exitCode = result.fails.length ? 1 : 0;
} catch (e) { console.error(`check: ${e.message}`); process.exitCode = 1; }
