/**
 * UI-06 B-08, B-09, B-10, B-11, B-13, B-27 and the review's round-1 rows —
 * the colour pairs the review measured, computed through the cascade from
 * the stylesheets' own values.
 *
 * UI-STANDARDS: text 7:1 (WCAG 1.4.6, AAA), non-text boundaries 3:1 (WCAG
 * 1.4.11). Each pair is measured on a mounted copy of the real markup: the
 * winning declaration for that element across every sheet index.html loads
 * (importance, specificity, source order; the states and media asked for),
 * its colour resolved through tokens.css, and the surface beneath it found
 * the same way — so a competing selector, an inherited colour or a group
 * `opacity` is measured, not assumed (tests/helpers/cssTokens.js). The map
 * data palette (Okabe-Ito) is guarded in tokens.test.js.
 */

import { afterEach, describe, test, expect } from 'vitest';
import {
  FORCED_COLOURS, MORE_CONTRAST, allRules, borderColourOf, cascade, colourIn, computed, contrast, declaration,
  hex, loadOrder, opacityOf, paintOf, parseColour, readStyle, surfaceOf, textPair, tokensFor,
} from './helpers/cssTokens.js';

const mainCss = readStyle('main.css');

const TEXT = 7;
const NON_TEXT = 3;
const REST = {};
const HOVER = { states: ['hover'] };
const PRESSED = { states: ['hover', 'active'] };
const FOCUSED = { states: ['focus-visible'] };
const MORE = { media: [MORE_CONTRAST] };

const token = (name, options = REST) => colourIn(`var(${name})`, tokensFor(options.media));

/**
 * Mounts markup copied from index.html or the component that builds it, and
 * returns one element of it. An `#id` target is matched as `[id="…"]`: jsdom
 * resolves `#id` through getElementById, which returns the first of two
 * mounts of the same markup — outside this host — and so nothing.
 */
function mount(html, target) {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  if (!target) return host.firstElementChild;
  const element = host.querySelector(target.replace(/^#([\w-]+)$/, '[id="$1"]'));
  if (!element) throw new Error(`${target} is not in the mounted markup`);
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

function expectContrast(fg, bg, floor, where) {
  const ratio = contrast(fg, bg);
  expect(ratio, `${where}: ${hex(fg)} on ${hex(bg)} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(floor);
  return ratio;
}

/** The element's text, as the eye sees it in that state, at 7:1. */
function expectText(element, options, where) {
  const { fg, bg } = textPair(element, options);
  return expectContrast(fg, bg, TEXT, where);
}

// Markup, as index.html and the components build it.
const CAMERA_CARD = `
  <div class="settings-section expanded" data-section="on-arrival"><div class="section-content">
    <div class="control-row control-row-inline">
      <span class="control-label control-label-short">Prev Zoom</span>
      <span id="camera-prev-zoom-value" class="slider-value slider-value-readonly">—</span>
    </div>
    <div class="control-row control-row-inline">
      <label class="control-label control-label-short" for="camera-zoom">This Zoom</label>
      <input type="range" id="camera-zoom">
      <span id="camera-zoom-value" class="slider-value">1.0x</span>
    </div>
  </div></div>`;
const EMPTY_LIST = `
  <ul class="waypoint-list"><li class="waypoint-list-empty" role="status">
    <p>No waypoints yet</p><p class="hint">Click on the map to add waypoints</p>
  </li></ul>`;
const FILE_MENU = `
  <div class="dropdown"><div class="dropdown-menu dropdown-menu-file is-open" role="menu">
    <button id="save-project-btn" class="dropdown-item" role="menuitem" type="button">
      <span class="dropdown-item-label">Save Project</span><kbd>⌘S</kbd>
    </button>
    <button id="clear-btn" class="dropdown-item dropdown-item-danger" role="menuitem" type="button">Clear All</button>
  </div></div>`;
const CONTEXT_MENU = `
  <ul class="context-menu" role="menu"><li>
    <button class="context-menu-item is-danger" role="menuitem" type="button">Delete</button>
  </li></ul>`;
const CLEAR_MODAL = `
  <div class="modal-content"><div class="modal-buttons">
    <button id="clear-cancel" class="btn btn-secondary" type="button">Cancel</button>
    <button id="clear-confirm" class="btn btn-danger" type="button">Clear</button>
  </div></div>`;
const LAYERS = ({ hidden = false, selected = false } = {}) => `
  <aside class="sidebar"><ul id="layers-strip" class="layers-strip">
    <li class="layer-item"><button class="layer-row" type="button">
      <span class="layer-swatch"></span><span class="layer-title">Route</span>
    </button></li>
    <li class="layer-item${hidden ? ' layer-hidden' : ''}${selected ? ' selected' : ''}">
      <button class="layer-row" type="button">
        <span class="layer-swatch"></span><span class="layer-title">Visitors</span>
        ${hidden ? '<span class="layer-hidden-tag">hidden</span>' : ''}
      </button>
      <button class="layer-visibility" type="button"></button>
    </li>
  </ul></aside>`;
const MINOR_ROW = `
  <ul class="waypoint-list"><li class="waypoint-item waypoint-item-minor"><button class="waypoint-row" type="button">
    <span class="waypoint-title">Curve</span><span class="waypoint-minor-tag">minor</span>
  </button></li></ul>`;
const SWATCHES = ({ checked = false } = {}) => `
  <div class="settings-section expanded" data-section="marker"><div class="section-content">
    <div class="swatch-picker"><fieldset class="swatch-fieldset"><div class="swatch-grid">
      <label class="swatch-option">
        <input type="radio" class="swatch-radio"${checked ? ' checked' : ''}><span class="swatch-chip"></span>
      </label>
    </div></fieldset></div>
  </div></div>`;
const WAYPOINT_ROW = ({ selected = false } = {}) => `
  <ul class="waypoint-list"><li class="waypoint-item${selected ? ' selected' : ''}">
    <button class="waypoint-row" type="button">
      <span class="waypoint-color-dot"></span><span class="waypoint-title">Start</span>
    </button>
  </li></ul>`;
const TRANSPORT = `
  <div class="controls">
    <div class="transport-controls">
      <button id="skip-start-btn" class="btn btn-icon" type="button">⏮</button>
      <button id="play-btn" class="btn btn-icon btn-primary" type="button">▶</button>
    </div>
    <div class="timeline"><input type="range" class="timeline-slider"></div>
  </div>`;
const OUTLINE = `
  <form class="scene-outline-form">
    <div class="scene-outline-field"><input type="text" aria-invalid="true"></div>
    <div class="scene-outline-actions">
      <button class="btn btn-secondary scene-outline-action scene-outline-danger" type="button">Delete</button>
    </div>
    <p class="scene-outline-error" role="alert">Those nodes are already connected.</p>
  </form>`;

describe('text on the section tint (B-08)', () => {
  test('the camera zoom readout reaches 7:1 on its card', () => {
    expectText(mount(CAMERA_CARD, '#camera-zoom-value'), REST, 'This zoom');
  });

  test('the read-only prev/next zoom readouts reach 7:1 on their card', () => {
    expectText(mount(CAMERA_CARD, '#camera-prev-zoom-value'), REST, 'Prev/Next zoom');
  });

  test('the empty waypoint list hint reaches 7:1 on the list surface', () => {
    expectText(mount(EMPTY_LIST, '.hint'), REST, 'empty hint');
  });
});

describe('danger text (B-09)', () => {
  test('the error text token reaches 7:1 on every surface danger text sits on', () => {
    const text = token('--text-error');
    const surfaces = ['--ui-00', '--ui-01', '--ui-02', '--hover-ui', '--support-error-bg', '--uon-jubilee-red-05'];
    for (const surface of surfaces) {
      expectContrast(text, token(surface), TEXT, `--text-error on ${surface}`);
    }
  });

  test('the File menu\'s Clear All item reaches 7:1 at rest, hovered and focused', () => {
    const item = mount(FILE_MENU, '#clear-btn');
    expectText(item, REST, 'Clear All at rest');
    expectText(item, HOVER, 'Clear All hovered');
    expectText(item, FOCUSED, 'Clear All focused');
    // The menu's own `[role="menuitem"]` colour is outranked by the item's
    // `!important`; the cascade, not a lone rule, says which wins.
    expect(computed(item, 'color').selector).toBe('.dropdown-item-danger');
  });

  test('the context menu\'s Delete item reaches 7:1 at rest and hovered', () => {
    const item = mount(CONTEXT_MENU, '.is-danger');
    expectText(item, REST, 'Delete at rest');
    expectText(item, HOVER, 'Delete hovered');
  });

  test('the Clear confirm button reaches 7:1 while hovered and pressed', () => {
    const button = mount(CLEAR_MODAL, '#clear-confirm');
    expectText(button, HOVER, 'Clear hovered');
    expectText(button, PRESSED, 'Clear pressed');
  });

  test('the error border and bar keep the Jubilee Red support token', () => {
    const support = hex(token('--support-error'));
    expect(hex(borderColourOf(mount(CLEAR_MODAL, '#clear-confirm'), 'top', HOVER))).toBe(support);
    expect(hex(borderColourOf(mount(OUTLINE, '.scene-outline-error'), 'left'))).toBe(support);
  });
});

describe('the shortcut chip in the File menu (B-10)', () => {
  test('⌘S is drawn at full opacity, 12 px, 7:1 on its chip', () => {
    const chip = mount(FILE_MENU, 'kbd');
    expect(opacityOf(chip)).toBe(1);
    expect(computed(chip, 'font-size').value).toBe('0.75rem');
    expectText(chip, REST, '⌘S');
  });

  test('a faded chip is measured as the eye sees it: text and chip each through the fade, over the menu', () => {
    // The old `.dropdown-item kbd{opacity:.7}`: the chip's text and its own
    // background both fade over the white menu — about 4.3:1 (4.30 with
    // channels rounded to the 8-bit values the screen shows; 4.31 unrounded),
    // under the review's 4.43, which faded the text over the already-faded
    // chip.
    // The fade is put back on the markup itself and measured by textPair,
    // the way every other pair is.
    const chip = mount(FILE_MENU.replace('<kbd>', '<kbd style="opacity: 0.7">'), 'kbd');
    expect(opacityOf(chip)).toBe(0.7);
    const { fg, bg } = textPair(chip);
    expect(contrast(fg, bg).toFixed(1)).toBe('4.3');
    expect(contrast(fg, bg)).toBeLessThan(TEXT);
  });
});

describe('a hidden crowd row in Layers (B-11)', () => {
  test('the title is not faded below legibility: it is a live, selectable row', () => {
    const title = mount(LAYERS({ hidden: true }), '.layer-hidden .layer-title');
    expect(opacityOf(title)).toBeGreaterThanOrEqual(0.8);
  });

  test('the title reaches 7:1 at rest, selected and hovered', () => {
    expectText(mount(LAYERS({ hidden: true }), '.layer-hidden .layer-title'), REST, 'hidden title at rest');
    expectText(mount(LAYERS({ hidden: true, selected: true }), '.layer-hidden .layer-title'), REST,
      'hidden title selected');
    expectText(mount(LAYERS({ hidden: true }), '.layer-hidden .layer-title'), HOVER, 'hidden title hovered');
  });

  test('the "hidden" tag reaches 7:1 on its own chip, like the minor tag it mirrors', () => {
    expectText(mount(LAYERS({ hidden: true }), '.layer-hidden-tag'), REST, 'hidden tag');
    expectText(mount(LAYERS({ hidden: true, selected: true }), '.layer-hidden-tag'), HOVER, 'hidden tag, selected row');
    expectText(mount(MINOR_ROW, '.waypoint-minor-tag'), REST, 'minor tag');
  });
});

describe('swatch chip and colour dot boundaries (B-13)', () => {
  const fills = Array.from({ length: 9 }, (_, i) => `--map-series-${i}`);

  test('the swatch chip border bounds the white and yellow chips at 3:1 on the grid, at rest and hovered', () => {
    const chip = mount(SWATCHES(), '.swatch-chip');
    const border = borderColourOf(chip);
    expect(border.alpha).toBe(1);
    expectContrast(border, token('--map-series-0'), NON_TEXT, 'chip border on the white chip');
    expectContrast(border, token('--map-series-7'), NON_TEXT, 'chip border on the yellow chip');
    expectContrast(border, surfaceOf(chip.parentElement), NON_TEXT, 'chip border on the card');
    expectContrast(border, surfaceOf(chip.parentElement, HOVER), NON_TEXT, 'chip border hovered');
  });

  test('every Okabe-Ito chip shows its extent against the grid, at rest, hovered, and in increased contrast', () => {
    // WCAG 1.4.11 asks that the boundary marking the control's extent reach
    // 3:1 against the adjacent surface. That boundary is whichever of the
    // chip's edges the eye finds — its fill where the fill is strong, its
    // border where the fill is light. A fill's ratio against its own border
    // (blue 1.1:1, green 1.3:1) is interior to the control and no failure.
    for (const options of [REST, MORE]) {
      const chip = mount(SWATCHES(), '.swatch-chip');
      const border = borderColourOf(chip, 'top', options);
      for (const [name, surface] of [
        ['card', surfaceOf(chip.parentElement, options)],
        ['hovered option', surfaceOf(chip.parentElement, { ...options, ...HOVER })],
      ]) {
        for (const fill of fills) {
          const edge = Math.max(contrast(token(fill, options), surface), contrast(border, surface));
          expect(edge, `${fill} on the ${name}${options.media ? ' (increased contrast)' : ''}: ${edge.toFixed(2)}:1`)
            .toBeGreaterThanOrEqual(NON_TEXT);
        }
      }
    }
  });

  test('the checked ring marks the chosen chip at 3:1 against the grid', () => {
    const chip = mount(SWATCHES({ checked: true }), '.swatch-chip');
    const ring = paintOf(chip, ['outline', 'outline-color']);
    expectContrast(ring, surfaceOf(chip.parentElement), NON_TEXT, 'checked ring on the card');
    expectContrast(ring, surfaceOf(chip.parentElement, HOVER), NON_TEXT, 'checked ring hovered');
  });

  test('the waypoint colour dot border bounds a white or yellow marker at 3:1 on the list', () => {
    const dot = mount(WAYPOINT_ROW(), '.waypoint-color-dot');
    const border = borderColourOf(dot);
    expect(border.alpha).toBe(1);
    expectContrast(border, token('--map-series-0'), NON_TEXT, 'dot border on a white dot');
    expectContrast(border, token('--map-series-7'), NON_TEXT, 'dot border on a yellow dot');
    expectContrast(border, surfaceOf(dot.parentElement), NON_TEXT, 'dot border on the list');
    expectContrast(border, surfaceOf(dot.parentElement, HOVER), NON_TEXT, 'dot border on a hovered row');
    const selected = mount(WAYPOINT_ROW({ selected: true }), '.waypoint-color-dot');
    expectContrast(borderColourOf(selected), surfaceOf(selected.parentElement), NON_TEXT, 'dot border, selected row');
  });
});

describe('primary icon buttons (review round 1)', () => {
  test('Play keeps the primary fill through hover and press, so the white glyph stays at 7:1', () => {
    // `.btn-icon:hover/:active` follow `.btn-primary` in the sheet and used
    // to repaint Play/Pause --hover-ui / --active-ui: white on them is 1.2:1
    // and 1.5:1. The primary icon states now outrank them.
    const play = mount(TRANSPORT, '#play-btn');
    expectText(play, REST, 'Play at rest');
    expectText(play, HOVER, 'Play hovered');
    expectText(play, PRESSED, 'Play pressed');
    expect(computed(play, ['background', 'background-color'], HOVER).selector).toBe('.btn-primary.btn-icon:hover');
    expect(computed(play, ['background', 'background-color'], PRESSED).selector).toBe('.btn-primary.btn-icon:active');
  });

  test('a plain icon button (Skip) keeps dark glyphs on its grey states', () => {
    const skip = mount(TRANSPORT, '#skip-start-btn');
    expectText(skip, HOVER, 'Skip hovered');
    expectText(skip, PRESSED, 'Skip pressed');
  });
});

describe('increased contrast preference (B-27)', () => {
  const block = allRules().filter(rule => rule.media === MORE_CONTRAST && rule.sheet === 'main.css');

  test('the primary button stays on UoN blue, which already clears 7:1', () => {
    expect(block.some(rule => rule.selectors.includes('.btn-primary'))).toBe(false);
    const play = mount(TRANSPORT, '#play-btn');
    expectText(play, MORE, 'primary button');
    expectText(play, { ...MORE, ...HOVER }, 'primary button hovered');
    // The jubilee red fill it used to switch to would have fallen short.
    expect(contrast(token('--text-04'), token('--uon-jubilee-red'))).toBeLessThan(TEXT);
  });

  test('no rule recolours a header border the header does not have', () => {
    expect(block.some(rule => rule.selectors.includes('.header'))).toBe(false);
    expect(declaration(mainCss, '.header', 'border-bottom')).toBeUndefined();
  });

  test('strokes strengthen instead: the interactive border darkens and buttons thicken', () => {
    const cancel = mount(CLEAR_MODAL, '#clear-cancel');
    const base = contrast(borderColourOf(cancel), surfaceOf(cancel));
    const more = contrast(borderColourOf(cancel, 'top', MORE), surfaceOf(cancel, MORE));
    expect(more).toBeGreaterThan(base);
    expectContrast(borderColourOf(cancel, 'top', MORE), surfaceOf(cancel, MORE), TEXT,
      'secondary button border, increased contrast');
    expect(cascade(cancel, 'border-width', MORE).value).toBe('2px');
    expect(parseFloat(cascade(cancel, ['border', 'border-width']).value)).toBe(1);
  });

  test('the timeline thumb reads at 3:1 on its rail, at rest and in increased contrast', () => {
    // The block used to darken the rail to --ui-04 (#707D89): 2.78:1 against
    // the #003A65 thumb. The rail keeps --ui-03; its 7.8:1 border carries the
    // mode's extra strength.
    // The input is a transparent 44px band (UI-06 B-01); the rail, with
    // its border, is drawn on the runnable track, whose rule is read here.
    const rail = mount(TRANSPORT, '.timeline-slider');
    for (const options of [REST, MORE]) {
      const where = options.media ? ' (increased contrast)' : '';
      const tokens = tokensFor(options.media);
      // A pseudo-element's rules cannot be matched on a mounted element, so
      // its winning declaration under the mode is read by hand: the mode's
      // own rule where the block carries one, else the rule at rest (Codex
      // round 1: read at rest only, a darkened track under the mode passed).
      const winningOf = (selector, property) => (options.media ?? [])
        .map(media => declaration(mainCss, selector, property, media)).find(Boolean)
        ?? declaration(mainCss, selector, property);
      const track = property => winningOf('.timeline-slider::-webkit-slider-runnable-track', property);
      const surface = colourIn(track('background'), tokens);
      const border = colourIn(track('border'), tokens);
      // The band itself paints nothing: the controls bar shows through it.
      expect(paintOf(rail, ['background', 'background-color'], options).alpha).toBe(0);
      for (const thumb of ['::-webkit-slider-thumb', '::-moz-range-thumb']) {
        const fill = colourIn(winningOf(`.timeline-slider${thumb}`, 'background'), tokens);
        expectContrast(fill, surface, NON_TEXT, `thumb ${thumb} on the rail${where}`);
      }
      expectContrast(border, surface, NON_TEXT, `rail border on the rail${where}`);
      expectContrast(border, surfaceOf(rail.parentElement, options), NON_TEXT, `rail border on the controls bar${where}`);
      expect(winningOf('.timeline-slider::-moz-range-track', 'background')).toBe(track('background'));
    }
  });
});

describe('the helper itself', () => {
  test('composites alpha before measuring, as the review did', () => {
    // rgba(0,0,0,.18) over #F4F4F4 is #C8C8C8, 1.52:1 — the old chip border.
    const old = contrast(parseColour('rgba(0, 0, 0, 0.18)'), parseColour('#F4F4F4'));
    expect(old.toFixed(2)).toBe('1.52');
    expect(contrast(parseColour('#595959'), parseColour('#F4F4F4')).toFixed(2)).toBe('6.37');
    expect(contrast(parseColour('#FFFFFF'), parseColour('#000000'))).toBe(21);
  });

  test('its cascade agrees with jsdom\'s on the at-rest colours jsdom can compute', () => {
    // jsdom honours specificity and order but leaves var() in place, so the
    // raw winning values are compared, state-free. One known gap: jsdom
    // drops `!important` from a declaration whose value is a var() (its
    // parsed `.dropdown-item-danger` carries no priority), so for Clear All
    // it hands the menu's `[role="menuitem"]` colour back; the browser, and
    // this helper, keep the item's. That pair is pinned apart, not skipped.
    const style = document.createElement('style');
    style.textContent = loadOrder().map(readStyle).join('\n');
    document.head.append(style);
    try {
      for (const [html, selector] of [
        [FILE_MENU, 'kbd'], [CONTEXT_MENU, '.is-danger'], [CLEAR_MODAL, '#clear-cancel'],
        [CAMERA_CARD, '#camera-prev-zoom-value'], [OUTLINE, '.scene-outline-error'], [TRANSPORT, '#play-btn'],
      ]) {
        const element = mount(html, selector);
        const hit = computed(element, 'color');
        expect(hit, `${selector} has a colour`).toBeDefined();
        expect(hit.value, selector).toBe(getComputedStyle(element).color);
      }
      const clear = mount(FILE_MENU, '#clear-btn');
      expect(computed(clear, 'color').value).toBe('var(--text-error)');
      expect(getComputedStyle(clear).color).toBe('var(--text-01)');
    } finally {
      style.remove();
    }
  });

  test('a swatch chip\'s checked ring falls back to the system highlight under forced colours', () => {
    // The chip opts out of forced colours (the chip is the value), which
    // keeps its literal #161616 ring — 1.16:1 on a black Canvas — unless a
    // forced-colours rule hands the ring to Highlight.
    const chip = mount(SWATCHES({ checked: true }), '.swatch-chip');
    expect(hex(paintOf(chip, ['outline', 'outline-color']))).toBe('#161616');
    expect(cascade(chip, ['outline-color', 'outline'], { media: [FORCED_COLOURS] }).value).toBe('Highlight');
    expect(cascade(chip, 'forced-color-adjust').value).toBe('none');
  });
});
