// V31-A11Y stage 3: the authored journeys, keyboard ones included. Each runs with real input and records every row it claims;
// each journey method with an applicable required row that no journey claims gets a failing test, so a feature
// declared present never passes for want of a journey. Rows not applicable by the coverage file need none.
import type { Page } from '@playwright/test';
import { applicable, catalogue, details, expect, open, project, settle, tab, test, type Rows } from './helpers';

const JOURNEY_METHODS = Object.keys(catalogue.methods).filter((m) => m.startsWith('j-'));
const rowsOf = (j: { rows: string | string[] }) => j.rows === '*' ? '*' : [j.rows].flat().join(' ').split(/\s+/).filter(Boolean);
const listsTouch = (id: string) => catalogue.rows.some((r: { id: string; methods: { extended: { method: string }[] } }) => r.id === id && r.methods.extended.some((m) => m.method === 'touch'));

// The pointer adapter (stage 4's second session): a journey presses through it, so the same journey drives the mouse in
// a desktop project and the touchscreen, through Chromium's own touch events, under touch emulation.
async function pointerFor(page: Page, touch: boolean) {
  if (!touch) return { down: async (x: number, y: number) => { await page.mouse.move(x, y); await page.mouse.down(); }, move: (x: number, y: number) => page.mouse.move(x, y), up: () => page.mouse.up(), tap: (x: number, y: number) => page.mouse.click(x, y) };
  const cdp = await page.context().newCDPSession(page);
  const touches = (type: string, points: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: points });
  return { down: (x: number, y: number) => touches('touchStart', [{ x, y }]), move: (x: number, y: number) => touches('touchMove', [{ x, y }]), up: () => touches('touchEnd', []), tap: (x: number, y: number) => page.touchscreen.tap(x, y) };
}

// Every declared journey runs, keyboard journeys included, and must record a result for every row it claims: a row it
// claims and never observes fails, so a journey that does nothing passes nothing.
for (const j of project.journeys ?? []) {
  const claimed: string[] = rowsOf(j) === '*' ? catalogue.rows.filter((r: { methods: { standard: { method: string }[] } }) => r.methods.standard.some((m) => m.method === j.method)).map((r: { id: string }) => r.id) : rowsOf(j) as string[];
  test(`journey: ${j.name}`, details(j.method, claimed, { journey: j.name }), async ({ page }, testInfo) => {
    const rows: Rows = {};
    const touch = testInfo.project.name === 'touch';
    // Under the touch project only a journey claiming a row that lists touch runs; the rest have nothing to earn there.
    if (touch && !claimed.some(listsTouch)) { for (const id of claimed) rows[id] = { state: 'not_run', reason: 'no row this journey claims lists touch' }; await settle(testInfo, rows); return; }
    // The page counts its pointer-downs by type: under touch a journey earns credit only on touch input, never the mouse.
    const pointers: Record<string, number> = {};
    if (touch) {
      await page.exposeBinding('__a11yPointer', (_source, type: string) => { pointers[type] = (pointers[type] ?? 0) + 1; });
      await page.addInitScript(() => { addEventListener('pointerdown', (e) => { (window as unknown as { __a11yPointer: (t: string) => void }).__a11yPointer(e.pointerType); }, true); });
    }
    const record = (id: string, ok: boolean, reason: string) => { if (!claimed.includes(id)) throw new Error(`journey ${j.name} records ${id}, which it does not claim`); rows[id] = { state: ok ? 'pass' : 'fail', reason }; };
    await j.run({ page, expect, open: (name: string) => open(page, project.states.find((s: { name: string }) => s.name === name)), record, tab: (back = false) => tab(page, back), pointer: await pointerFor(page, touch) });
    for (const id of claimed) rows[id] ??= { state: 'fail', reason: `journey ${j.name} claims ${id} and recorded no result for it` };
    const noTouch = touch && (pointers.mouse ? `under touch emulation journey ${j.name} pressed with the mouse ${pointers.mouse} time(s): press through the pointer adapter` : !pointers.touch ? `under touch emulation journey ${j.name} made no touch input` : '');
    if (noTouch) for (const id of claimed) rows[id] = { state: 'not_run', reason: noTouch };
    await settle(testInfo, rows);
  });
}

for (const method of JOURNEY_METHODS) {
  const ids = catalogue.rows.filter((r: { id: string; methods: { standard: { method: string }[] } }) => r.methods.standard.some((m) => m.method === method)).map((r: { id: string }) => r.id);
  const claimed = new Set((project.journeys ?? []).filter((j: { method: string }) => j.method === method).flatMap((j: { rows: string | string[] }) => { const r = rowsOf(j); return r === '*' ? ids : r; }));
  const missing = ids.filter((id: string) => applicable(id) && !claimed.has(id));
  if (missing.length) test(`journey not written: ${method}`, details(method, missing), async () => {
    expect(missing, `applicable rows with no ${method} journey in tests/a11y/project.mjs`).toEqual([]);
  });
}
