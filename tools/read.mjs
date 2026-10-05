#!/usr/bin/env node
// Prints exactly rule 1's read, as the checker counts it (the maintainer's instruction of 2026-10-01): the profile, the rules
// file, the Direction section of the brief, the whole backlog, the decisions slice — the latest ten entries' heading, Decision
// and Deferred lines, inherited entries as heading and Deferred — and the trajectory's latest item lines within their budget,
// never fewer than the last four shipped. Read-only; the contract is loaded by the harness. It saves no prescribed words: it
// stops a session reading whole entries by habit. usage: node tools/read.mjs [--root <dir>]
import { inspect, options, active, sections } from './ledger.mjs';
try {
  const { root } = options();
  const state = inspect(root);
  if (state.fails.length) { console.error(state.fails.map((m) => `FAIL  ${m}`).join('\n')); console.error('read: the ledger is invalid; repair it first'); process.exitCode = 1; }
  else {
    const part = (title, text) => `<!-- ${title} -->\n${text.trim()}\n`;
    const out = [
      part('project/profile.md', active(state.files.profile)),
      part('project/rules.md', active(state.files.rules)),
      part('project/brief.md — Direction', sections(state.files.brief).get('Direction') || ''),
      part('project/backlog.md', active(state.files.backlog)),
      part(`project/decisions.md — the latest ${state.slice.entries.length} as heading, Decision and Deferred${state.slice.entries.some((e) => e.inherited) ? '; inherited entries as heading and Deferred' : ''}`, state.slice.text),
      part(`project/trajectory.md — the latest ${state.trajectoryRead.lines.length} item lines`, state.trajectoryRead.text),
    ];
    process.stdout.write(out.join('\n'));
    console.error(`read: ${state.hotWords - state.counts.contract} words printed, plus the contract's ${state.counts.contract} the harness loads; the estimate is ${state.hotWords} of ${state.budgets.total}`);
  }
} catch (e) { console.error(`read: ${e.message}`); process.exitCode = 1; }
