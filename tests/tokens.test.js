/**
 * UI-06 B-14 / DEF-94 — every token the stylesheets use exists.
 *
 * A `var(--name)` with no definition is invalid at computed-value time, and
 * the declaration silently resets to its initial value: the outline's
 * validation error lost its accent bar and red field border that way, and
 * the help screen its sizes. Nothing in the browser reports it, so this
 * suite reads the stylesheets and does — and checks the resolver it leans
 * on, and the one forced-colours rule the round-1 review asked for.
 */

import { afterEach, describe, test, expect } from 'vitest';
import {
  FORCED_COLOURS, allRules, borderColourOf, cascade, colourIn, declaration, hex, readStyle, resolveValue, rules,
  styleNames, stripComments, tokens,
} from './helpers/cssTokens.js';

const styles = Object.fromEntries(styleNames().map(name => [name, readStyle(name)]));
const mainCss = styles['main.css'];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('design tokens', () => {
  test('every var() a stylesheet uses is defined where it is in scope: tokens.css\'s :root, or its own sheet', () => {
    // A definition inside an at-rule block is in force only under that
    // condition, so only unconditional definitions count.
    const rootTokens = new Set(tokens().keys());
    const ownTokens = new Map();
    for (const [name, css] of Object.entries(styles)) {
      const own = new Set();
      for (const rule of rules(css)) {
        if (rule.media) continue;
        for (const property of rule.declarations.keys()) if (property.startsWith('--')) own.add(property);
      }
      ownTokens.set(name, own);
    }

    const undefinedUses = new Set();
    for (const [name, css] of Object.entries(styles)) {
      for (const match of stripComments(css).matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!rootTokens.has(match[1]) && !ownTokens.get(name).has(match[1])) undefinedUses.add(`${name}: ${match[1]}`);
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

  test('the outline error marks resolve to the error token on the elements that carry them (DEF-94)', () => {
    const map = tokens();
    const error = hex(colourIn(map.get('--support-error'), map));
    expect(error).toBe('#B91C2E');

    // `--support-01` is Carbon v10's name for the error token; the outline
    // rules use it, so it must resolve to the same red as `--support-error`.
    expect(hex(colourIn('var(--support-01)', map))).toBe(error);
    expect(hex(colourIn(declaration(mainCss, '.scene-outline-error', 'border-left'), map))).toBe(error);
    expect(hex(colourIn(declaration(mainCss, '.scene-outline-field [aria-invalid="true"]', 'box-shadow'), map)))
      .toBe(error);

    // Through the cascade, on the markup the controller builds: the Delete
    // action is also `.btn.btn-secondary`, whose later border rules outranked
    // a lone `.scene-outline-danger` until it was written as
    // `.btn.scene-outline-danger`.
    const host = document.createElement('form');
    host.className = 'scene-outline-form';
    host.innerHTML = `
      <div class="scene-outline-field"><input type="text" aria-invalid="true"></div>
      <div class="scene-outline-actions">
        <button class="btn btn-secondary scene-outline-action scene-outline-danger" type="button">Delete</button>
      </div>
      <p class="scene-outline-error" role="alert">Those nodes are already connected.</p>`;
    document.body.append(host);
    expect(hex(borderColourOf(host.querySelector('.scene-outline-error'), 'left'))).toBe(error);
    expect(hex(borderColourOf(host.querySelector('[aria-invalid="true"]')))).toBe(error);
    const danger = host.querySelector('.scene-outline-danger');
    expect(hex(borderColourOf(danger))).toBe(error);
    expect(cascade(danger, ['border', 'border-color']).selector).toBe('.btn.scene-outline-danger');
  });

  test('the help screen tokens exist, as compatibility definitions at the Carbon sizes their names mean', () => {
    // `.shortcuts-modal` and `.splash-instructions`, which use the two
    // heading tokens, appear in no markup; the tokens exist so no rule is
    // invalid, not to restore a heading anyone sees.
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
    // A selector a suite names must be one the reader can find, or a renamed
    // rule would pass as "no declaration" instead of failing.
    const selectors = new Set(allRules().flatMap(rule => rule.selectors));
    for (const selector of [
      '.control-row-inline > span:last-child', '.slider-value-readonly', '.waypoint-list-empty .hint',
      '.btn-danger:hover', 'kbd', '.layer-item.layer-hidden .layer-title', '.layer-hidden-tag',
      '.swatch-chip', '.swatch-radio:checked ~ .swatch-chip', '.waypoint-color-dot', '.scene-outline-error',
      '.btn.scene-outline-danger', '.btn-primary.btn-icon:hover', '.btn-primary.btn-icon:active',
      '.timeline-slider::-webkit-slider-thumb', '.timeline-slider::-moz-range-thumb',
    ]) {
      expect(selectors, selector).toContain(selector);
    }
    expect(selectors.size).toBeGreaterThan(100);
  });
});

describe('forced colours', () => {
  test('the swatch picker hands its checked ring to the system highlight, and keeps its fills', () => {
    const forced = rules(styles['swatch-picker.css']).filter(rule => rule.media === FORCED_COLOURS);
    const ring = forced.find(rule => rule.selectors.includes('.swatch-radio:checked ~ .swatch-chip'));
    expect(ring, 'a forced-colours rule for the checked chip').toBeDefined();
    expect(ring.declarations.get('outline-color') ?? ring.declarations.get('outline')).toMatch(/\bHighlight\b/);
    // Only system colours belong in a forced-colours block (UI-STANDARDS).
    for (const rule of forced) {
      for (const [property, value] of rule.declarations) {
        expect(value, `${rule.selectors.join(', ')} ${property}`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|var\(/i);
      }
    }
    expect(declaration(styles['swatch-picker.css'], '.swatch-chip', 'forced-color-adjust')).toBe('none');
  });
});

describe('the token resolver', () => {
  const map = tokens();

  test('takes a fallback only when the token is missing, and resolves the branch it takes', () => {
    expect(resolveValue('var(--missing, rgba(0, 0, 0, 0.5))', map)).toBe('rgba(0, 0, 0, 0.5)');
    expect(resolveValue('var(--text-02, var(--missing))', map)).toBe('#3A3A3A');
    expect(resolveValue('var(--missing, var(--text-02))', map)).toBe('#3A3A3A');
    expect(resolveValue('rgba(var(--rgb, 1, 2, 3), 0.5)', new Map())).toBe('rgba(1, 2, 3, 0.5)');
    expect(hex(colourIn('var(--missing, #ABCDEF)', map))).toBe('#ABCDEF');
    expect(hex(colourIn('1px solid var(--border-strong)', map))).toBe('#767676');
  });

  test('rejects an unresolved value with the token named', () => {
    expect(() => resolveValue('var(--missing)', map)).toThrow(/undefined token --missing/);
    expect(() => resolveValue('var(--missing, var(--also-missing))', map)).toThrow(/undefined token --also-missing/);
    expect(() => resolveValue('var(--text-02', map)).toThrow(/unbalanced/);
    expect(() => resolveValue('var(text-02)', map)).toThrow(/malformed/);
  });

  test('rejects a cycle instead of looping', () => {
    const cyclic = new Map([['--a', 'var(--b)'], ['--b', 'var(--c, var(--a))']]);
    expect(() => resolveValue('var(--a)', cyclic)).toThrow(/cyclic token --a → --b → --a/);
    expect(() => resolveValue('var(--self)', new Map([['--self', 'var(--self)']]))).toThrow(/cyclic/);
  });
});
