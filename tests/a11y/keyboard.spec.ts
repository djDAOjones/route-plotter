// V31-A11Y stage 3: keyboard and dialog journeys with real key events — a Tab walk of each declared state (every
// focusable reached, no trap, no context change on focus, focus visible and not hidden), each declared dialog (an exit,
// focus returned), each declared keyboard function at no delay and slowly; and a failing test for each keyboard row
// that only an authored journey can check while none claims it.
import { AAA, applicable, details, dialogRows, expect, keyboardFunction, open, project, settle, tabWalk, test, verdict } from './helpers';

const claimed = (id: string) => (project.journeys ?? []).some((j: { method: string; rows: string | string[] }) => j.method === 'keyboard' && (j.rows === '*' || [j.rows].flat().join(' ').split(/\s+/).includes(id)));

for (const state of project.states) {
  const at = { state: state.name };
  test(`keyboard walk: ${state.name}`, details('keyboard', ['2.1.1', '2.1.2', '3.2.1', 'CONF05'], at), async ({ page }, testInfo) => {
    await open(page, state);
    const w = await tabWalk(page);
    const trap = verdict(w.trapped ? [`focus held at ${w.steps.at(-1)!.el} through repeated Tab`] : [], 'Tab moves on from every control');
    await settle(testInfo, {
      '2.1.1': verdict(w.reached < w.reachable ? [`${w.reached} of ${w.reachable} focusable control(s) reached by Tab`] : [], `${w.reached} control(s) reached by Tab`),
      '2.1.2': trap, CONF05: trap,
      '3.2.1': verdict(w.steps.filter((s) => s.changedContext).map((s) => `focus on ${s.el || 'a control'} changed the page or opened one`), 'no context change on focus'),
    });
  });
  test(`focus: ${state.name}`, details('focus', AAA ? ['2.4.7', '2.4.11', '2.4.12', '2.4.13'] : ['2.4.7', '2.4.11'], at), async ({ page }, testInfo) => {
    await open(page, state);
    const { evidence } = await tabWalk(page);
    expect(evidence.length, 'no control took focus').toBeGreaterThan(0);
    const rows = {
      '2.4.7': verdict(evidence.filter((e) => !e.visible).map((e) => `${e.el}: no visible change on focus`), `${evidence.length} focus step(s) visible`),
      '2.4.11': verdict(evidence.filter((e) => e.hidden).map((e) => `${e.el}: entirely hidden by author content`), 'no focused control entirely hidden'),
    };
    if (AAA) Object.assign(rows, {
      '2.4.12': verdict(evidence.filter((e) => e.partly).map((e) => `${e.el}: partly hidden by author content`), 'no focused control partly hidden'),
      '2.4.13': verdict(evidence.filter((e) => e.strong < e.perimeter).map((e) => `${e.el}: ${e.strong} px changed by 3:1, under the ${e.perimeter} px of a 2 px perimeter`), 'each indicator at least a 2 px perimeter at 3:1'),
    });
    await settle(testInfo, rows);
  });
  for (const d of state.dialogs ?? []) {
    test(`dialog: ${state.name} ${d.name}`, details('keyboard', ['2.1.2', '2.4.3'], at), async ({ page }, testInfo) => {
      await open(page, state);
      await settle(testInfo, await dialogRows(page, d));
    });
  }
}

for (const fn of project.keyboardFunctions ?? []) {
  test(`keyboard function: ${fn.name}`, details('keyboard', AAA ? ['2.1.1', '2.1.3'] : ['2.1.1'], { journey: fn.name }), async ({ page }, testInfo) => {
    const { fast, slow } = await keyboardFunction(page, { ...fn, state: project.states.find((s: { name: string }) => s.name === fn.state) });
    const rows = { '2.1.1': verdict(!fast && !slow ? [`${fn.name} fails by keyboard at every pace`] : [], `${fn.name} works by keyboard`) };
    if (AAA) Object.assign(rows, { '2.1.3': verdict(fast && slow ? [] : [`${fn.name} ${fast ? 'fails with a long gap between keys' : 'fails at no delay between keys'}: it needs a timing`], `${fn.name} works at no delay and with ${1000} ms gaps`) });
    await settle(testInfo, rows);
  });
}

// Keyboard rows a walk cannot check: each applicable one needs an authored journey that claims it.
const authored = ['2.1.4', '2.4.1', '3.2.2', 'P06', 'CONF03', ...(AAA ? ['3.2.5'] : []), ...(AAA && !(project.keyboardFunctions ?? []).length ? ['2.1.3'] : [])];
const unwritten = authored.filter((id) => applicable(id) && !claimed(id));
if (unwritten.length) test('keyboard journeys not written', details('keyboard', unwritten), async () => {
  expect(unwritten, 'applicable keyboard rows with no authored journey in tests/a11y/project.mjs').toEqual([]);
});
