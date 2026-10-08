/**
 * UI-06 B-14 / DEF-94 — every token the stylesheets use exists.
 *
 * A `var(--name)` with no definition is invalid at computed-value time, and
 * the declaration silently resets to its initial value: the outline's
 * validation error lost its accent bar and red field border that way, and
 * the help screen its sizes. Nothing in the browser reports it, so this
 * suite reads the stylesheets and does.
 */

import { describe, test, expect } from 'vitest';
import {
  colourIn, declaration, hex, readStyle, resolveValue, rules, styleNames, stripComments, tokens,
} from './helpers/cssTokens.js';

const styles = Object.fromEntries(styleNames().map(name => [name, readStyle(name)]));
const mainCss = styles['main.css'];

describe('design tokens', () => {
  test('every var() a stylesheet uses is defined in tokens.css or in that stylesheet', () => {
    const definedIn = new Map();
    for (const [name, css] of Object.entries(styles)) {
      for (const match of stripComments(css).matchAll(/(--[\w-]+)\s*:/g)) {
        if (!definedIn.has(match[1])) definedIn.set(match[1], new Set());
        definedIn.get(match[1]).add(name);
      }
    }

    const undefinedUses = new Set();
    for (const [name, css] of Object.entries(styles)) {
      for (const match of stripComments(css).matchAll(/var\(\s*(--[\w-]+)/g)) {
        const files = definedIn.get(match[1]);
        if (!files || !(files.has('tokens.css') || files.has(name))) undefinedUses.add(`${name}: ${match[1]}`);
      }
    }

    expect([...undefinedUses].sort()).toEqual([]);
  });

  test('every alias in tokens.css points at a token that exists', () => {
    const map = tokens();
    const dangling = [];
    for (const [name, value] of map) {
      for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!map.has(match[1])) dangling.push(`${name} → ${match[1]}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  test('the outline error mark resolves to the error token (DEF-94)', () => {
    const map = tokens();
    const error = hex(colourIn(map.get('--support-error'), map));
    expect(error).toBe('#B91C2E');

    // `--support-01` is Carbon v10's name for the error token; the outline
    // rules use it, so it must resolve to the same red as `--support-error`.
    expect(hex(colourIn('var(--support-01)', map))).toBe(error);
    expect(hex(colourIn(declaration(mainCss, '.scene-outline-error', 'border-left'), map))).toBe(error);
    expect(hex(colourIn(declaration(mainCss, '.scene-outline-field [aria-invalid="true"]', 'border-color'), map)))
      .toBe(error);
    expect(hex(colourIn(declaration(mainCss, '.scene-outline-field [aria-invalid="true"]', 'box-shadow'), map)))
      .toBe(error);
    expect(hex(colourIn(declaration(mainCss, '.scene-outline-danger', 'border-color'), map))).toBe(error);
  });

  test('the help screen tokens exist and name the Carbon sizes they meant', () => {
    const map = tokens();
    expect(resolveValue('var(--type-body-compact)', map)).toBe('0.875rem');
    expect(resolveValue('var(--type-heading-02)', map)).toBe('1rem');
    expect(resolveValue('var(--type-heading-03)', map)).toBe('1.25rem');
    expect(hex(colourIn('var(--text-helper)', map))).toBe(hex(colourIn('var(--text-02)', map)));
  });

  test('the error text token is distinct from the error border token', () => {
    const map = tokens();
    expect(map.has('--text-error')).toBe(true);
    expect(hex(colourIn('var(--text-error)', map))).not.toBe(hex(colourIn('var(--support-error)', map)));
  });

  test('the Okabe-Ito map series are untouched', () => {
    const map = tokens();
    const series = Array.from({ length: 9 }, (_, i) => hex(colourIn(`var(--map-series-${i})`, map)));
    expect(series).toEqual([
      '#FFFFFF', '#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#56B4E9', '#F0E442', '#000000',
    ]);
  });

  test('the stylesheet reader sees every rule it will be asked about', () => {
    // A selector the contrast suite names must be one the reader can find,
    // or a renamed rule would pass as "no declaration" instead of failing.
    const selectors = new Set(rules(mainCss).flatMap(rule => rule.selectors));
    for (const selector of [
      '.control-row-inline > span:last-child', '.slider-value-readonly', '.waypoint-list-empty .hint',
      '.btn-danger:hover', 'kbd', '.layer-item.layer-hidden .layer-title', '.layer-hidden-tag',
      '.swatch-chip', '.waypoint-color-dot', '.scene-outline-error',
    ]) {
      const css = selector === '.swatch-chip' ? styles['swatch-picker.css'] : mainCss;
      expect(rules(css).flatMap(rule => rule.selectors), selector).toContain(selector);
    }
    expect(selectors.size).toBeGreaterThan(100);
  });
});
