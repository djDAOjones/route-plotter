// CORE-06, D276 (a), provisional (brief 145): the page's question before a chosen project replaces a changed route
// (ReplaceQuestion.tsx). Node holds the asker and the markup; focus, Escape and the return are the journey
// `open-over-changes`'s (tests/a11y/project.mjs).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OPEN_WORDS } from './openLogic';
import { createReplaceAsker, ReplaceQuestion } from './ReplaceQuestion';

const draw = (asker: ReturnType<typeof createReplaceAsker>) =>
  renderToStaticMarkup(createElement(ReplaceQuestion, { asker, opener: { current: null } }));

describe('the replace asker (point 1 and 2)', () => {
  it('shows nothing at rest, and an answer with nothing shown does nothing', () => {
    const asker = createReplaceAsker();
    let told = 0;
    asker.subscribe(() => {
      told += 1;
    });
    expect(asker.read()).toBeNull();
    asker.answer(true);
    expect(told).toBe(0);
  });

  it('"Replace" settles true and "Keep my route" false, each clearing the question once', async () => {
    const asker = createReplaceAsker();
    let told = 0;
    const stop = asker.subscribe(() => {
      told += 1;
    });
    const yes = asker.ask('walk.zip');
    expect(asker.read()?.name).toBe('walk.zip');
    asker.answer(true);
    expect(asker.read()).toBeNull();
    expect(await yes).toBe(true);
    const no = asker.ask('trail.zip');
    asker.answer(false);
    asker.answer(true);
    expect(await no).toBe(false);
    expect(told).toBe(4);
    stop();
    void asker.ask('more.zip');
    expect(told).toBe(4);
  });

  it('a new ask while one is shown settles the older as kept and shows only the new one (ruling JC 2)', async () => {
    const asker = createReplaceAsker();
    const older = asker.ask('one.zip');
    const newer = asker.ask('two.zip');
    expect(await older).toBe(false);
    expect(asker.read()?.name).toBe('two.zip');
    asker.answer(true);
    expect(await newer).toBe(true);
    expect(asker.read()).toBeNull();
  });

  it('each ask is its own question: a second ask for the same file gives a new snapshot, steady between asks (Codex, brief 147)', () => {
    // The focus effect runs again only when the snapshot changes (ReplaceQuestion.tsx point 4). With the file's name
    // alone as the snapshot (3491f00), a second ask for the same file read the same string, the effect did not run and
    // focus stayed where it was ("Replace", say). Node cannot run the effect (this file draws static markup); the
    // journey `open-over-changes` reads focus on the page.
    const asker = createReplaceAsker();
    void asker.ask('walk.zip');
    const first = asker.read();
    expect(asker.read()).toBe(first);
    void asker.ask('walk.zip');
    const second = asker.read();
    expect(second).not.toBe(first);
    expect(asker.read()).toBe(second);
    expect([first?.name, second?.name]).toEqual(['walk.zip', 'walk.zip']);
  });
});

describe('ReplaceQuestion, as it draws (point 3)', () => {
  it('draws nothing while nothing is asked', () => {
    expect(draw(createReplaceAsker())).toBe('');
  });

  it('is the kit dialog headed "Replace your route?", naming the file as text, "Keep my route" before "Replace"', () => {
    const asker = createReplaceAsker();
    void asker.ask('<b>walk</b>.zip');
    const html = draw(asker);
    expect(html).toMatch(/<h2[^>]*>Replace your route\?<\/h2>/);
    expect(html).toContain('Replace your route with &lt;b&gt;walk&lt;/b&gt;.zip? What you have drawn is not saved and will be lost.');
    expect(html).not.toContain('<b>');
    const buttons = [...html.matchAll(/<button type="button" class="cds--btn cds--btn--(\w+)"[^>]*>([^<]*)<\/button>/g)].map((m) => [m[1], m[2]]);
    expect(buttons).toEqual([
      ['secondary', OPEN_WORDS.keep],
      ['primary', OPEN_WORDS.replace],
    ]);
  });
});
