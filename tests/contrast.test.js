/**
 * UI-06 B-08, B-09, B-10, B-11, B-13, B-27 — the colour pairs the review
 * measured, computed from the stylesheets' own values.
 *
 * UI-STANDARDS: text 7:1 (WCAG 1.4.6, AAA), non-text boundaries 3:1 (WCAG
 * 1.4.11). Each pair is read from the rule that paints it and the surface it
 * sits on, resolved through tokens.css, with any alpha or `opacity`
 * composited first, so a token retuned later is measured, not assumed. The
 * map data palette (Okabe-Ito) is guarded in tokens.test.js.
 */

import { describe, test, expect } from 'vitest';
import {
  colourIn, contrast, declaration, hex, over, parseColour, readStyle, rules, tokens, withOpacity,
} from './helpers/cssTokens.js';

const map = tokens();
const mainCss = readStyle('main.css');
const dropdownCss = readStyle('dropdown.css');
const contextMenuCss = readStyle('context-menu.css');
const swatchCss = readStyle('swatch-picker.css');

const TEXT = 7;
const NON_TEXT = 3;

/** The colour a selector's `property` resolves to, tokens substituted. */
function paint(css, selector, property) {
  const value = declaration(css, selector, property);
  if (value === undefined) throw new Error(`${selector} sets no ${property}`);
  return colourIn(value, map);
}

const token = name => colourIn(`var(${name})`, map);

/** `expect(ratio).toBeGreaterThanOrEqual(floor)` with the pair in the message. */
function expectContrast(fg, bg, floor, where) {
  const ratio = contrast(fg, bg);
  expect(ratio, `${where}: ${hex(fg)} on ${hex(bg)} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(floor);
  return ratio;
}

describe('text on the section tint (B-08)', () => {
  const tint = token('--tint-camera');

  test('the camera zoom readout reaches 7:1 on its card', () => {
    expectContrast(paint(mainCss, '.control-row-inline > span:last-child', 'color'), tint, TEXT, 'This zoom');
  });

  test('the read-only prev/next zoom readouts reach 7:1 on their card', () => {
    expectContrast(paint(mainCss, '.slider-value-readonly', 'color'), tint, TEXT, 'Prev/Next zoom');
  });

  test('the empty waypoint list hint reaches 7:1 on the list surface', () => {
    const list = paint(mainCss, '.waypoint-list', 'background');
    expectContrast(paint(mainCss, '.waypoint-list-empty .hint', 'color'), list, TEXT, 'empty hint');
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
    const text = paint(dropdownCss, '.dropdown-item-danger', 'color');
    expectContrast(text, paint(dropdownCss, '.dropdown-menu', 'background'), TEXT, 'Clear All at rest');
    expectContrast(text, paint(dropdownCss, '.dropdown-item-danger:hover', 'background'), TEXT, 'Clear All hovered');
    expectContrast(text, paint(dropdownCss, '.dropdown-item:focus-visible', 'background'), TEXT, 'Clear All focused');
  });

  test('the context menu\'s Delete item reaches 7:1 at rest and hovered', () => {
    const text = paint(contextMenuCss, '.context-menu-item.is-danger', 'color');
    expectContrast(text, paint(contextMenuCss, '.context-menu', 'background'), TEXT, 'Delete at rest');
    expectContrast(text, paint(contextMenuCss, '.context-menu-item:hover', 'background'), TEXT, 'Delete hovered');
  });

  test('the Clear confirm button reaches 7:1 while hovered and pressed', () => {
    const text = paint(mainCss, '.btn-danger:hover', 'color');
    expectContrast(text, paint(mainCss, '.btn-danger:hover', 'background'), TEXT, 'Clear hovered');
    expectContrast(text, paint(mainCss, '.btn-danger:active', 'background'), TEXT, 'Clear pressed');
  });

  test('the error border and bar keep the Jubilee Red support token', () => {
    const support = hex(token('--support-error'));
    expect(hex(paint(mainCss, '.btn-danger:hover', 'border-color'))).toBe(support);
    expect(hex(paint(mainCss, '.scene-outline-error', 'border-left'))).toBe(support);
  });
});

describe('the shortcut chip in the File menu (B-10)', () => {
  test('⌘S is drawn at full opacity, 12 px, 7:1 on its chip', () => {
    const opacity = Number(declaration(dropdownCss, '.dropdown-item kbd', 'opacity') ?? 1);
    expect(opacity).toBe(1);
    const size = declaration(dropdownCss, '.dropdown-item kbd', 'font-size')
      ?? declaration(mainCss, 'kbd', 'font-size');
    expect(size).toBe('0.75rem');

    // Opacity fades the chip's background and its text together, over the
    // white menu: the text is measured on the faded chip, as the eye sees it.
    const menu = paint(dropdownCss, '.dropdown-menu', 'background');
    const chip = over(withOpacity(paint(mainCss, 'kbd', 'background'), opacity), menu);
    expectContrast(withOpacity(paint(mainCss, 'kbd', 'color'), opacity), chip, TEXT, '⌘S');
  });
});

describe('a hidden crowd row in Layers (B-11)', () => {
  const titleColour = () => {
    const own = declaration(mainCss, '.layer-item.layer-hidden .layer-title', 'color');
    return colourIn(own ?? declaration(mainCss, '.layer-row', 'color'), map);
  };
  const titleOpacity = () => Number(declaration(mainCss, '.layer-item.layer-hidden .layer-title', 'opacity') ?? 1);

  test('the title is not faded below legibility: it is a live, selectable row', () => {
    expect(titleOpacity()).toBeGreaterThanOrEqual(0.8);
  });

  test('the title reaches 7:1 at rest, selected and hovered', () => {
    const title = withOpacity(titleColour(), titleOpacity());
    expectContrast(title, token('--ui-01'), TEXT, 'hidden title at rest');
    expectContrast(title, paint(mainCss, '.layer-item.selected', 'background'), TEXT, 'hidden title selected');
    expectContrast(title, paint(mainCss, '.layer-row:hover', 'background'), TEXT, 'hidden title hovered');
  });

  test('the "hidden" tag reaches 7:1 on its own chip, like the minor tag it mirrors', () => {
    expectContrast(paint(mainCss, '.layer-hidden-tag', 'color'), paint(mainCss, '.layer-hidden-tag', 'background'),
      TEXT, 'hidden tag');
    expectContrast(paint(mainCss, '.waypoint-minor-tag', 'color'), paint(mainCss, '.waypoint-minor-tag', 'background'),
      TEXT, 'minor tag');
  });
});

describe('swatch chip and colour dot boundaries (B-13)', () => {
  const white = token('--map-series-0');
  const yellow = token('--map-series-7');

  test('the swatch chip border bounds the white and yellow chips at 3:1 on the grid, at rest and hovered', () => {
    const border = paint(swatchCss, '.swatch-chip', 'border');
    expect(border.alpha).toBe(1);
    expectContrast(border, white, NON_TEXT, 'chip border on the white chip');
    expectContrast(border, yellow, NON_TEXT, 'chip border on the yellow chip');
    expectContrast(border, token('--tint-marker'), NON_TEXT, 'chip border on the card');
    expectContrast(border, paint(swatchCss, '.swatch-option:hover', 'background'), NON_TEXT, 'chip border hovered');
  });

  test('the waypoint colour dot border bounds a white or yellow marker at 3:1 on the list', () => {
    const border = paint(mainCss, '.waypoint-color-dot', 'border');
    expect(border.alpha).toBe(1);
    expectContrast(border, white, NON_TEXT, 'dot border on a white dot');
    expectContrast(border, yellow, NON_TEXT, 'dot border on a yellow dot');
    expectContrast(border, paint(mainCss, '.waypoint-list', 'background'), NON_TEXT, 'dot border on the list');
    expectContrast(border, token('--waypoint-row-selected'), NON_TEXT, 'dot border on a selected row');
  });
});

describe('increased contrast preference (B-27)', () => {
  const block = rules(mainCss).filter(rule => /prefers-contrast\s*:\s*more/.test(rule.media));

  test('the primary button stays on UoN blue, which already clears 7:1', () => {
    expect(block.some(rule => rule.selectors.includes('.btn-primary'))).toBe(false);
    expectContrast(paint(mainCss, '.btn-primary', 'color'), paint(mainCss, '.btn-primary', 'background'), TEXT,
      'primary button');
    // The jubilee red fill it used to switch to would have fallen short.
    expect(contrast(token('--text-04'), token('--uon-jubilee-red'))).toBeLessThan(TEXT);
  });

  test('no rule recolours a header border the header does not have', () => {
    expect(block.some(rule => rule.selectors.includes('.header'))).toBe(false);
    expect(declaration(mainCss, '.header', 'border-bottom')).toBeUndefined();
  });

  test('strokes strengthen instead: the interactive border darkens and buttons thicken', () => {
    const more = tokens(readStyle('tokens.css'), '@media (prefers-contrast: more)');
    const border = colourIn(more.get('--border-interactive'), map);
    const base = contrast(token('--border-interactive'), token('--ui-00'));
    expect(contrast(border, token('--ui-00'))).toBeGreaterThan(base);
    expectContrast(border, token('--ui-00'), TEXT, 'interactive border, increased contrast');
    const button = block.find(rule => rule.selectors.includes('.btn'));
    const baseWidth = parseFloat(declaration(mainCss, '.btn', 'border'));
    expect(parseFloat(button?.declarations.get('border-width'))).toBeGreaterThan(baseWidth);
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
});
