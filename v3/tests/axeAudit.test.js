/**
 * REV-05 — axe-core over the app shell, as a standing gate.
 *
 * axe knows several hundred rules; the hand-rolled checks in
 * `accessibilityAudit.test.js` know a dozen. This file is the broad net, that
 * one is the targeted guard for the specific failures the live audit caught.
 *
 * **What this run can and cannot judge.** jsdom has no layout and no painting,
 * so `color-contrast` is disabled here — axe would either skip it or guess.
 * Contrast is measured for real in a browser instead, and the result is
 * recorded on the ticket. A colour-contrast "pass" from jsdom would be a false
 * green, which is worse than no check at all.
 *
 * Owner approved adding axe-core as a dev dependency on 2026-08-27. It is
 * dev-only: the runtime dependencies remain jszip and mediabunny.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect, beforeEach } from 'vitest';
import axe from 'axe-core';
import { initParamTooltips } from '../src/components/ParamTooltip.js';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

/** The rule sets the project commits to, plus axe's own best practices. */
const TAGS = [
  'wcag2a', 'wcag2aa', 'wcag2aaa',
  'wcag21a', 'wcag21aa',
  'wcag22aa',
  'best-practice',
];

function mountShell() {
  // The shell is injected without its <html> wrapper, so carry `lang` across
  // by hand — otherwise axe reports a missing language that the real page has.
  const lang = indexHtml.match(/<html[^>]*\blang="([^"]+)"/i);
  document.documentElement.setAttribute('lang', lang ? lang[1] : 'en');
  document.documentElement.innerHTML = indexHtml
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<\/?html[^>]*>/gi, '');
}

async function runAxe(options = {}) {
  return axe.run(document, {
    runOnly: { type: 'tag', values: TAGS },
    // No layout in jsdom: see the header. Measured live instead.
    rules: { 'color-contrast': { enabled: false } },
    ...options,
  });
}

describe('axe-core over the shell as JavaScript leaves it', () => {
  // A11Y-01 was invisible to the run above: `role="button"` was applied at
  // init, not authored in index.html, so the static shell was clean while the
  // running app was not. Anything that decorates the DOM on startup belongs
  // here as well as there.
  beforeEach(() => {
    mountShell();
    initParamTooltips();
  });

  test('reports no violations once the hints are wired', async () => {
    const results = await runAxe();
    const reported = results.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
      example: violation.nodes[0]?.html.slice(0, 120),
    }));

    expect(reported).toEqual([]);
  }, 60000);

  test('no element is given a role its element type forbids', async () => {
    const results = await runAxe();
    const roleResults = [...results.violations, ...results.incomplete]
      .filter(result => result.id === 'aria-allowed-role')
      .flatMap(result => result.nodes.map(node => node.html.slice(0, 120)));

    expect(roleResults).toEqual([]);

    // Vacuous if axe never ran the rule, so prove it did.
    const evaluated = new Set([
      ...results.passes, ...results.violations, ...results.incomplete,
    ].map(result => result.id));
    expect(evaluated).toContain('aria-allowed-role');
  }, 60000);
});

describe('axe-core over the app shell', () => {
  beforeEach(mountShell);

  test('reports no violations', async () => {
    const results = await runAxe();
    const reported = results.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
      example: violation.nodes[0]?.html.slice(0, 120),
    }));

    expect(reported).toEqual([]);
  }, 60000);

  test('actually exercised a meaningful number of rules', async () => {
    // A misconfigured run that checked nothing would also report no
    // violations, so assert the net was genuinely cast.
    const results = await runAxe();

    expect(results.passes.length).toBeGreaterThan(20);
  }, 60000);

  test('the language and one-main-landmark rules are among those run', async () => {
    const results = await runAxe();
    const evaluated = new Set([
      ...results.passes, ...results.violations, ...results.incomplete,
    ].map(result => result.id));

    expect(evaluated).toContain('html-has-lang');
    expect(evaluated).toContain('landmark-one-main');
  }, 60000);
});
