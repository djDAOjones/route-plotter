/**
 * The test helper's cascade (tests/helpers/cssTokens.js) — the parts a
 * review found misreading the sheets (UI-06, Codex round 2).
 *
 * The contrast and token suites trust this cascade to say which declaration
 * wins for a mounted element, so its reading of selector lists, nested
 * pseudo-class functions, declaration order inside a rule, negated states
 * and nested at-rules is pinned here against small synthetic sheets and
 * against the real universal focus rule.
 */

import { afterEach, describe, test, expect } from 'vitest';
import {
  FORCED_COLOURS, MORE_CONTRAST, cascade, matchable, opacityOf, rules, specificity, splitTopLevel, textPair,
} from './helpers/cssTokens.js';

function mount(html, target) {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const element = target ? host.querySelector(target.replace(/^#([\w-]+)$/, '[id="$1"]')) : host.firstElementChild;
  if (!element) throw new Error(`${target} is not in the mounted markup`);
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

const UNIVERSAL_FOCUS =
  ':where(a,button,[role="button"],input,select,textarea,[tabindex]:not([tabindex="-1"])):focus-visible';

describe('selector lists', () => {
  test('are split only at top-level commas, outside parentheses, brackets and quotes', () => {
    expect(splitTopLevel(`${UNIVERSAL_FOCUS}, .x, [data-a="b,c"]`)).toEqual([UNIVERSAL_FOCUS, '.x', '[data-a="b,c"]']);
    const [rule] = rules(`${UNIVERSAL_FOCUS},\n.x{color:red}`);
    expect(rule.selectors).toEqual([UNIVERSAL_FOCUS, '.x']);
  });

  test('the real universal focus rule matches a focused button and not an unfocused one', () => {
    // Split at every comma it fragmented into a bare `button`, and a resting
    // Play button was handed the focus ring's box-shadow.
    const play = mount(`
      <div class="controls"><div class="transport-controls">
        <button id="play-btn" class="btn btn-icon btn-primary" type="button">▶</button>
      </div></div>`, '#play-btn');
    expect(cascade(play, 'box-shadow')?.selector).not.toBe(UNIVERSAL_FOCUS);
    expect(cascade(play, 'box-shadow', { states: ['focus-visible'] }).selector).toBe(UNIVERSAL_FOCUS);
    expect(cascade(play, 'box-shadow', { states: ['hover'] })?.selector).not.toBe(UNIVERSAL_FOCUS);
  });

  test('specificity reads nested pseudo-class functions', () => {
    expect(specificity(UNIVERSAL_FOCUS)).toEqual([0, 1, 0]);
    expect(specificity(':is(#a, .b) .c')).toEqual([1, 1, 0]);
    expect(specificity(':not(.a, #b)')).toEqual([1, 0, 0]);
    expect(specificity('.a:not(:hover)')).toEqual([0, 2, 0]);
    expect(specificity('.btn-primary.btn-icon:hover')).toEqual([0, 3, 0]);
    expect(specificity('.dropdown-menu [role="menuitem"]:focus-visible')).toEqual([0, 3, 0]);
    expect(specificity('.timeline-slider::-webkit-slider-thumb')).toEqual([0, 1, 1]);
    expect(specificity('li:nth-child(2n+1) > a')).toEqual([0, 1, 2]);
  });
});

describe('declaration order inside a rule', () => {
  const both = ['background', 'background-color'];

  test('a later shorthand resets an earlier longhand, and a later longhand overrides an earlier shorthand', () => {
    const p = mount('<p class="p">x</p>');
    const shorthandLast = cascade(p, both, { rules: rules('.p{background-color:#fff; background:#000}') });
    expect([shorthandLast.property, shorthandLast.value]).toEqual(['background', '#000']);
    const longhandLast = cascade(p, both, { rules: rules('.p{background:#000; background-color:#fff}') });
    expect([longhandLast.property, longhandLast.value]).toEqual(['background-color', '#fff']);
  });

  test('!important inside a rule outranks a later plain declaration', () => {
    const p = mount('<p class="p">x</p>');
    const hit = cascade(p, both, { rules: rules('.p{background-color:#fff !important; background:#000}') });
    expect([hit.property, hit.value]).toEqual(['background-color', '#fff']);
  });

  test('the same property twice: the later wins', () => {
    const p = mount('<p class="p">x</p>');
    expect(cascade(p, 'color', { rules: rules('.p{color:red; color:blue}') }).value).toBe('blue');
  });

  test('a semicolon inside a quoted value does not end the declaration', () => {
    const [rule] = rules('.p{background-image:url("data:image/svg+xml;base64,AA==");color:red}');
    expect(rule.declarations.get('background-image')).toBe('url("data:image/svg+xml;base64,AA==")');
    expect(rule.declarations.get('color')).toBe('red');
  });
});

describe('states', () => {
  test(':not(:hover) matches at rest and not when hovered', () => {
    const p = mount('<p class="p">x</p>');
    const sheet = rules('.p:not(:hover){color:red} .p:hover{color:blue}');
    expect(cascade(p, 'color', { rules: sheet }).value).toBe('red');
    expect(cascade(p, 'color', { rules: sheet, states: ['hover'] }).value).toBe('blue');
  });

  test(':not(.a:hover) holds for everything at rest, and when hovered for all but .a', () => {
    const sheet = rules('.p:not(.a:hover){color:red}');
    const marked = mount('<p class="p a">x</p>');
    const plain = mount('<p class="p">x</p>');
    expect(cascade(marked, 'color', { rules: sheet }).value).toBe('red');
    expect(cascade(marked, 'color', { rules: sheet, states: ['hover'] })).toBeUndefined();
    expect(cascade(plain, 'color', { rules: sheet, states: ['hover'] }).value).toBe('red');
  });

  test(':is() keeps only the alternatives in force', () => {
    const sheet = rules(':is(.a:hover, .b){color:red}');
    const a = mount('<p class="a">x</p>');
    const b = mount('<p class="b">x</p>');
    expect(cascade(b, 'color', { rules: sheet }).value).toBe('red');
    expect(cascade(a, 'color', { rules: sheet })).toBeUndefined();
    expect(cascade(a, 'color', { rules: sheet, states: ['hover'] }).value).toBe('red');
  });

  test('matchable rewrites a selector for the states in force, or says it cannot match', () => {
    expect(matchable('.p:not(:hover)', new Set())).toBe('.p');
    expect(matchable('.p:not(:hover)', new Set(['hover']))).toBeNull();
    expect(matchable('.row:hover .title', new Set(['hover']))).toBe('.row .title');
    expect(matchable('.row:hover .title', new Set())).toBeNull();
    expect(matchable(':hover', new Set(['hover']))).toBe('*');
    expect(matchable('.x::before', new Set())).toBeNull();
    expect(matchable('.x:focus', new Set(['focus-visible']))).toBeNull();
  });

  test('a compound emptied by the states keeps its place as *, so its combinators still bind', () => {
    expect(matchable('.parent > :not(:hover) .p', new Set())).toBe('.parent > * .p');
    expect(matchable(':not(:hover) > .p', new Set())).toBe('* > .p');
    expect(matchable('.parent > :not(:hover) .p', new Set(['hover']))).toBeNull();
    const sheet = rules('.parent > :not(:hover) .p{color:red}');
    const nested = mount('<div class="parent"><div><span class="p">x</span></div></div>', '.p');
    const direct = mount('<div class="parent"><span class="p">x</span></div>', '.p');
    expect(cascade(nested, 'color', { rules: sheet }).value).toBe('red');
    expect(cascade(direct, 'color', { rules: sheet })).toBeUndefined();
  });
});

describe('nested at-rules', () => {
  test('a rule inside two conditions needs both in force', () => {
    const sheet = rules('@media (prefers-contrast: more){ @media (forced-colors: active){ .p{color:red} } }');
    expect(sheet[0].conditions).toEqual([MORE_CONTRAST, FORCED_COLOURS]);
    const p = mount('<p class="p">x</p>');
    expect(cascade(p, 'color', { rules: sheet, media: [FORCED_COLOURS] })).toBeUndefined();
    expect(cascade(p, 'color', { rules: sheet, media: [MORE_CONTRAST] })).toBeUndefined();
    expect(cascade(p, 'color', { rules: sheet, media: [MORE_CONTRAST, FORCED_COLOURS] }).value).toBe('red');
  });

  test('a single condition reads as before, and @layer adds none', () => {
    const [more] = rules('@media (prefers-contrast:more){ .p{color:red} }');
    expect(more.media).toBe(MORE_CONTRAST);
    expect(more.conditions).toEqual([MORE_CONTRAST]);
    const [layered] = rules('@layer base { .p{color:red} }');
    expect(layered.conditions).toEqual([]);
  });
});

describe('inline style', () => {
  test('an inline declaration outranks the sheets, and a sheet\'s !important outranks it', () => {
    const p = mount('<p class="p" style="color: blue">x</p>');
    expect(cascade(p, 'color', { rules: rules('.p{color:red}') }).value).toBe('blue');
    expect(cascade(p, 'color', { rules: rules('.p{color:red !important}') }).value).toBe('red');
  });

  test('a faded element reads its opacity from the markup, and textPair fades text and chip alike', () => {
    const chip = mount('<div style="background:#fff"><kbd style="opacity: 0.7">⌘S</kbd></div>', 'kbd');
    const sheet = rules('kbd{color:#3A3A3A; background:#F4F4F4}');
    expect(opacityOf(chip, { rules: sheet })).toBe(0.7);
    // 0.7 × #3A3A3A + 0.3 × white = #757575; 0.7 × #F4F4F4 + 0.3 × white = #F7F7F7.
    const { fg, bg } = textPair(chip, { rules: sheet });
    expect([fg.rgb, bg.rgb]).toEqual([[117, 117, 117], [247, 247, 247]]);
  });
});
