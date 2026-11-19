// V31-A11Y stage 3: each declared state under the adaptations — reflow at 320 CSS px wide (256 px high for vertical
// writing), the root font at 200 % (an indicator, never proof of 1.4.4), the four text-spacing overrides together,
// forced colours and both orientations, each keeping the content, cues and functions the state declares, forced colours
// also telling each stateful control's two states apart; and reduced motion, sampled through each declared interaction.
import { AAA, SPACING, clipping, details, focusStep, keepRow, kept, motionRows, open, project, settle, stateCues, tab, test, verdict } from './helpers';

for (const state of project.states) {
  const at = { state: state.name };
  test(`reflow: ${state.name}`, details('reflow', ['1.4.10'], at), async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page, state);
    const vertical = await page.evaluate(() => getComputedStyle(document.documentElement).writingMode.startsWith('vertical'));
    if (vertical) { await page.setViewportSize({ width: 640, height: 256 }); await open(page, state); }
    const where = vertical ? '256 CSS px high' : '320 CSS px wide';
    const scrolls = await clipping(page);
    const lost = await kept(page, state, () => open(page, state), `at ${where}`, !vertical);
    await settle(testInfo, { '1.4.10': keepRow(scrolls, lost, `no loss and no two-dimensional scrolling at ${where}`, state) });
  });
  test(`root font at 200 %: ${state.name}`, details('text-200', AAA ? ['1.4.4', '1.4.8'] : ['1.4.4'], at), async ({ page }, testInfo) => {
    await open(page, state);
    await page.evaluate(() => { const r = document.documentElement; r.style.fontSize = `${parseFloat(getComputedStyle(r).fontSize) * 2}px`; });
    const lost = await clipping(page); // an indicator: a problem is a candidate for review, never a failure or a pass of 1.4.4
    const v = lost.length ? { state: 'candidate' as const, reason: `at a 200 % root font: ${lost.slice(0, 5).join('; ')}` } : { state: 'pass' as const, reason: 'nothing clipped at a 200 % root font; real browser zoom not tested' };
    await settle(testInfo, AAA ? { '1.4.4': v, '1.4.8': v } : { '1.4.4': v });
  });
  test(`text spacing: ${state.name}`, details('text-spacing', AAA ? ['1.4.8', '1.4.12'] : ['1.4.12'], at), async ({ page }, testInfo) => {
    const fresh = async () => { await open(page, state); await page.addStyleTag({ content: SPACING }); };
    const lost = await kept(page, state, fresh, 'under the spacing overrides');
    await fresh();
    const v = keepRow(await clipping(page), lost, 'no loss under the four overrides together', state);
    await settle(testInfo, AAA ? { '1.4.12': v, '1.4.8': v } : { '1.4.12': v });
  });
  test(`forced colours: ${state.name}`, details('forced-colours', AAA ? ['1.4.1', '1.4.8'] : ['1.4.1'], at), async ({ page }, testInfo) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const lost = await kept(page, state, () => open(page, state), 'with colours forced');
    const cues = await stateCues(page, state); // each stateful control's two states, told apart with colours forced
    await open(page, state);
    const focus: string[] = [];
    for (let i = 0; i < 40; i++) {
      await tab(page);
      const e = await focusStep(page);
      if (!e) break;
      if (!e.visible) focus.push(`${e.el}: no focus indicator with colours forced`);
    }
    const k = keepRow([...focus, ...cues.fails.map((c) => `with colours forced, ${c}`)], lost, `content, cues, functions, focus and ${cues.measured} control state(s) kept with colours forced`, state);
    const v = k.state === 'pass' && cues.unresolved.length ? { state: 'not_run' as const, reason: `unresolved with colours forced: ${cues.unresolved.slice(0, 3).join('; ')}` } : k;
    await settle(testInfo, AAA ? { '1.4.1': v, '1.4.8': v } : { '1.4.1': v });
  });
  test(`orientation: ${state.name}`, details('orientation', ['1.3.4'], at), async ({ page }, testInfo) => {
    const problems: string[] = [], lost: string[] = [];
    let declared = true;
    for (const [where, size] of [['portrait', { width: 800, height: 1280 }], ['landscape', { width: 1280, height: 800 }]] as const) {
      await page.setViewportSize(size);
      await open(page, state);
      if (!(await page.evaluate(() => document.body.innerText.trim().length))) problems.push(`${where}: no content shown`);
      const found = await kept(page, state, () => open(page, state), where, true);
      if (found === null) declared = false; else lost.push(...found);
    }
    await settle(testInfo, { '1.3.4': keepRow(problems, declared ? lost : null, 'content, cues and functions kept in portrait and landscape', state) });
  });
  test(`reduced motion: ${state.name}`, details('reduced-motion', AAA ? ['2.3.3', 'SUP02'] : ['SUP02'], at), async ({ page }, testInfo) => {
    await settle(testInfo, await motionRows(page, state, AAA));
  });
}
