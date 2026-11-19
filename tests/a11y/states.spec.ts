// V31-A11Y stage 3: each declared UI state scanned at the adopted level — axe with the level's tags, the reviewed ARIA
// snapshot crediting only the rows its template lists, label in name, colour pairs, graphics and state cues, target
// sizes and, at AAA, text blocks.
import { AAA, SNAPSHOT_ROLES, axeScan, contrastRows, details, expect, labelInNameRows, open, project, settle, snapshotRows, targetRows, test, textBlocks, verdict } from './helpers';

for (const state of project.states) {
  const at = { state: state.name };
  test(`axe: ${state.name}`, details('axe', '*', at), async ({ page }, testInfo) => {
    await open(page, state);
    await axeScan(page, testInfo);
  });
  test(`ARIA snapshot: ${state.name}`, details('snapshot', Object.keys(SNAPSHOT_ROLES), at), async ({ page }, testInfo) => {
    expect(state.snapshot, `state ${state.name} has no reviewed ARIA snapshot in tests/a11y/project.mjs`).toBeTruthy();
    await open(page, state);
    await settle(testInfo, await snapshotRows(page, state));
  });
  test(`label in name: ${state.name}`, details('snapshot', ['2.5.3'], at), async ({ page }, testInfo) => {
    await open(page, state);
    await settle(testInfo, await labelInNameRows(page));
  });
  test(`contrast: ${state.name}`, details('contrast', AAA ? ['1.4.3', '1.4.6', '1.4.11'] : ['1.4.3', '1.4.11'], at), async ({ page }, testInfo) => {
    await open(page, state);
    await settle(testInfo, await contrastRows(page, state));
  });
  test(`target size: ${state.name}`, details('target-size', AAA ? ['2.5.5', '2.5.8', 'SUP03'] : ['2.5.8', 'SUP03'], at), async ({ page }, testInfo) => {
    await open(page, state);
    await settle(testInfo, await targetRows(page));
  });
  if (AAA) test(`text blocks: ${state.name}`, details('text-blocks', ['1.4.8'], at), async ({ page }, testInfo) => {
    await open(page, state);
    await settle(testInfo, { '1.4.8': verdict(await textBlocks(page), 'blocks unjustified, at most 80 characters a line, paragraphs spaced') });
  });
}
