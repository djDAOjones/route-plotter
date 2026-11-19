// V31-A11Y stage 3: the known-bad fixtures. Each page runs the pack's own check — the same helper the standard specs
// use — and must fail its named row; the command runs one page at a time (`npm run a11y -- --known-bad <page>`) and
// the gate must exit 1 with that row failed. Never part of an ordinary run, and never marked as an expected failure:
// the proof is the gate's own failure.
// cspell:ignore labelledby
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { axeScan, contrastRows, details, dialogRows, keyboardFunction, motionRows, open, settle, SPACING, clipping, tabWalk, targetRows, test, verdict, type State } from '../helpers';

const here = join(process.env.A11Y_ROOT || process.cwd(), 'tests/a11y/known-bad');
const { pages } = JSON.parse(readFileSync(join(here, 'known-bad.json'), 'utf8'));
const only = process.env.A11Y_KNOWN_BAD;
const url = (page: string) => pathToFileURL(join(here, `${page}.html`)).href;

for (const k of pages.filter((p: { page: string }) => p.page === only)) {
  const state: State = { name: `known-bad-${k.page}`, path: url(k.page), ...(k.start ? { interactions: [{ name: `press ${k.start}`, run: async ({ page }) => { await page.locator(k.start).click(); } }] } : {}) };
  const at = { state: state.name };
  test(`known-bad ${k.page}: ${k.reason}`, details(k.method, k.method === 'axe' ? '*' : k.claims, at), async ({ page }, testInfo) => {
    await open(page, state);
    if (k.method === 'axe') return axeScan(page, testInfo);
    if (k.method === 'contrast') return settle(testInfo, await contrastRows(page, state));
    if (k.method === 'target-size') return settle(testInfo, await targetRows(page));
    if (k.page.startsWith('dialog-')) return settle(testInfo, await dialogRows(page, { opener: '#open' }));
    if (k.page === 'timed-keys') {
      const { fast, slow } = await keyboardFunction(page, { state, steps: [{ focus: '#count' }, { press: 'ArrowUp' }, { press: 'ArrowUp' }], check: async ({ page: p }) => (await p.locator('#n').textContent()) === '1' });
      return settle(testInfo, { '2.1.1': verdict(!fast && !slow ? ['fails at every pace'] : [], 'works by keyboard'), '2.1.3': verdict(fast && slow ? [] : [`fails ${fast ? 'with a long gap between keys' : 'at no delay'}: it needs a timing`], 'no timing needed') });
    }
    if (k.method === 'reflow') { await page.setViewportSize({ width: 320, height: 640 }); await open(page, state); return settle(testInfo, { '1.4.10': verdict(await clipping(page), 'no loss at 320 CSS px') }); }
    if (k.method === 'text-spacing') { await page.addStyleTag({ content: SPACING }); return settle(testInfo, { '1.4.12': verdict(await clipping(page), 'no loss under the overrides') }); }
    if (k.method === 'focus') {
      const { evidence } = await tabWalk(page);
      return settle(testInfo, { '2.4.11': verdict(evidence.filter((e) => e.hidden).map((e) => `${e.el} entirely hidden`), 'none hidden'), '2.4.12': verdict(evidence.filter((e) => e.partly).map((e) => `${e.el} partly hidden`), 'none partly hidden') });
    }
    if (k.method === 'reduced-motion') return settle(testInfo, await motionRows(page, state, true));
    throw new Error(`no check for known-bad page ${k.page}`);
  });
  for (const a of k.also ?? []) {
    test(`known-bad ${k.page}: ${a.method} ${a.fails.join(' ')}`, details(a.method, a.fails, at), async ({ page }, testInfo) => {
      await open(page, state);
      // The authored assertion: every text field has a programmatic name from a label (1.3.1) and a visible label (3.3.2).
      const fields = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].map((e) => ({ id: e.id || e.tagName.toLowerCase(), labelled: !!(e as HTMLInputElement).labels?.length || !!e.getAttribute('aria-labelledby'), visible: [...((e as HTMLInputElement).labels ?? [])].some((l) => l.getBoundingClientRect().width > 0) })));
      const id = a.fails[0];
      await settle(testInfo, { [id]: verdict(fields.filter((f) => id === '1.3.1' ? !f.labelled : !f.visible).map((f) => `${f.id} has no ${id === '1.3.1' ? 'programmatic' : 'visible'} label`), 'every field labelled') });
    });
  }
}
