#!/usr/bin/env node
// STACK-03: proof, on every run of v4's gate, that the accessibility run is not vacuous. The pack's known-bad pages for
// the two faults the item names, text at about 5:1 (under AAA's 7:1, 1.4.6) and a 30 px target (under AAA's 44 px,
// 2.5.5), and CORE-05's two set-aside faults (1.4.11), each go through the gate itself, one at a time (`npm run a11y -- --known-bad <page>`). Each run must exit 1,
// with every row known-bad.json says fails failed by its method, and every row it says passes passed. Anything else
// exits 1 here. The run folders stay in the system's temporary folder, as the gate leaves them; nothing is written in
// the checkout.
// Usage: node tests/a11y/non-vacuity.mjs (npm run a11y:known-bad). Exit 0 every page failed the gate as recorded; 1 not.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// CORE-05 (brief 96): a set-aside declaration answers for its reviewed count and never covers a control's own graphic;
// each of its two pages runs in about 7 s on the Mac Pro, under the 30 s a page may take here.
const PAGES = ['contrast-5', 'target-30', 'aside-miscount', 'aside-control'];
const { pages } = JSON.parse(readFileSync(join(ROOT, 'tests/a11y/known-bad/known-bad.json'), 'utf8'));

// One known-bad page through the gate: what it should have done, against what its report recorded.
function judge(k, status, report) {
  const problems = [];
  if (status !== 1) problems.push(`the gate exited ${status}, not 1`);
  if (!report) return [...problems, 'the run folder holds no report'];
  const row = (id) => report.rows.find((r) => r.id === id);
  const by = (id) => row(id)?.methods.find((m) => m.method === k.method);
  for (const id of k.fails) if (row(id)?.status !== 'failed' || by(id)?.state !== 'fail') problems.push(`${id} reads ${row(id)?.status ?? 'missing'}, ${k.method} ${by(id)?.state ?? 'absent'}: it should fail`);
  for (const id of k.passes ?? []) if (by(id)?.state !== 'pass') problems.push(`${id} reads ${k.method} ${by(id)?.state ?? 'absent'}: it should pass`);
  if (report.suite !== 'failed') problems.push(`the suite reads ${report.suite}, not failed`);
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let failed = 0;
  for (const name of PAGES) {
    const k = pages.find((p) => p.page === name);
    const r = spawnSync('npm', ['run', '--silent', 'a11y', '--', '--known-bad', name], { cwd: ROOT, encoding: 'utf8' });
    const folder = /a11y-run: run folder (.+)/.exec(r.stdout ?? '')?.[1]?.trim();
    let report = null;
    try { report = JSON.parse(readFileSync(join(folder, 'a11y-report.json'), 'utf8')); } catch { report = null; }
    const problems = k ? judge(k, r.status, report) : [`${name} is not in known-bad.json`];
    if (problems.length) {
      failed++;
      console.log(`FAIL  ${name}: ${problems.join('; ')}`);
      process.stdout.write(r.stdout ?? '');
      process.stderr.write(r.stderr ?? '');
    } else {
      const why = k.fails.map((id) => `${id} (${report.rows.find((x) => x.id === id).reasons.join('; ')})`).join(', ');
      console.log(`ok    ${name}: the gate exited 1, ${k.method} failed ${why} and passed ${(k.passes ?? []).join(', ') || 'nothing else'}; run folder ${folder}`);
    }
  }
  console.log(failed ? `a11y:known-bad: ${failed} of ${PAGES.length} page(s) did not fail the gate as recorded` : `a11y:known-bad: all ${PAGES.length} planted faults fail the gate`);
  process.exitCode = failed ? 1 : 0;
}
