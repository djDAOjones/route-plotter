/**
 * Stylesheet reading for the token and contrast tests (UI-06).
 *
 * jsdom applies a loaded stylesheet's declarations but leaves `var()` where
 * it found it, so a computed colour cannot be read back from the DOM. These
 * helpers read the rule text instead: the tokens `styles/tokens.css` defines,
 * the declarations a selector carries, and the WCAG 2.x contrast of two
 * colours once any alpha is composited over the surface beneath.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STYLES_DIR = resolve(process.cwd(), 'styles');

/** The stylesheet file names under `styles/`. */
export function styleNames() {
  return readdirSync(STYLES_DIR).filter(name => name.endsWith('.css')).sort();
}

/** @param {string} name A file under `styles/`. */
export function readStyle(name) {
  return readFileSync(resolve(STYLES_DIR, name), 'utf8');
}

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Every style rule in a stylesheet, in source order, as
 * `{ selectors, declarations, media }`. A rule inside a conditional at-rule
 * carries that at-rule's prelude as `media` (`''` at the top level); other
 * at-rules (`@keyframes`, `@font-face`) are skipped.
 * @param {string} css
 * @returns {{ selectors: string[], declarations: Map<string, string>, media: string }[]}
 */
export function rules(css, media = '') {
  const text = stripComments(css);
  const out = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('{', index);
    if (open < 0) break;
    const prelude = text.slice(index, open).replace(/\s+/g, ' ').trim();
    let depth = 1;
    let close = open + 1;
    while (close < text.length && depth > 0) {
      if (text[close] === '{') depth += 1;
      else if (text[close] === '}') depth -= 1;
      close += 1;
    }
    const body = text.slice(open + 1, close - 1);
    if (prelude.startsWith('@')) {
      if (/^@(media|supports|container|layer)\b/.test(prelude)) out.push(...rules(body, prelude));
    } else {
      out.push({
        selectors: prelude.split(',').map(selector => selector.trim()).filter(Boolean),
        declarations: declarations(body),
        media,
      });
    }
    index = close;
  }
  return out;
}

function declarations(body) {
  const map = new Map();
  for (const part of body.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const property = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).replace(/!important/g, '').trim();
    if (property) map.set(property, value);
  }
  return map;
}

/**
 * The value a selector's rules give a property, last declaration winning as
 * the cascade does for equal specificity, or `undefined` when none sets it.
 * `selector` must match one of a rule's selectors exactly (whitespace
 * normalised); `media` picks rules inside that at-rule prelude.
 */
export function declaration(css, selector, property, media = '') {
  let found;
  for (const rule of rules(css)) {
    if (rule.media !== media || !rule.selectors.includes(selector)) continue;
    if (rule.declarations.has(property)) found = rule.declarations.get(property);
  }
  return found;
}

/**
 * The custom properties `:root` defines in `styles/tokens.css` (or the
 * stylesheet given), at the top level or inside the at-rule `media`.
 * @returns {Map<string, string>}
 */
export function tokens(css = readStyle('tokens.css'), media = '') {
  const map = new Map();
  for (const rule of rules(css)) {
    if (rule.media !== media || !rule.selectors.includes(':root')) continue;
    for (const [name, value] of rule.declarations) if (name.startsWith('--')) map.set(name, value);
  }
  return map;
}

/**
 * `value` with every `var()` substituted from `map`, repeatedly, as the
 * browser would. An undefined token with no fallback throws: that is the
 * defect this helper exists to catch.
 */
export function resolveValue(value, map) {
  let out = value;
  for (let guard = 0; /var\(/.test(out) && guard < 32; guard += 1) {
    out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name, fallback) => {
      if (map.has(name)) return map.get(name);
      if (fallback !== undefined) return fallback.trim();
      throw new Error(`undefined token ${name} in "${value}"`);
    });
  }
  return out;
}

/**
 * A colour as `{ rgb: [r, g, b], alpha }` from `#rgb`, `#rrggbb`,
 * `#rrggbbaa`, `rgb()`, `rgba()` or `transparent`.
 */
export function parseColour(value) {
  const text = value.trim();
  let match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (match) {
    let hex = match[1];
    if (hex.length === 3) hex = [...hex].map(c => c + c).join('');
    const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { rgb, alpha };
  }
  match = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (match) {
    return { rgb: [+match[1], +match[2], +match[3]], alpha: match[4] === undefined ? 1 : +match[4] };
  }
  if (text === 'transparent') return { rgb: [0, 0, 0], alpha: 0 };
  throw new Error(`not a colour: "${value}"`);
}

/** The colour inside a value such as a `border` shorthand, tokens resolved. */
export function colourIn(value, map) {
  const resolved = resolveValue(value, map);
  const match = resolved.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\btransparent\b/i);
  if (!match) throw new Error(`no colour in "${value}" (→ "${resolved}")`);
  return parseColour(match[0]);
}

/** `fg` composited over an opaque `bg`, as the screen would show it. */
export function over(fg, bg) {
  return {
    rgb: fg.rgb.map((channel, i) => Math.round(channel * fg.alpha + bg.rgb[i] * (1 - fg.alpha))),
    alpha: 1,
  };
}

/** A colour drawn through an element's `opacity`. */
export function withOpacity(colour, opacity) {
  return { rgb: colour.rgb, alpha: colour.alpha * opacity };
}

export function hex({ rgb }) {
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function linear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of an opaque colour. */
export function luminance({ rgb: [r, g, b] }) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * WCAG 2.x contrast ratio of `fg` over `bg`; `bg` must be opaque, and a
 * translucent `fg` is composited over it first.
 */
export function contrast(fg, bg) {
  if (bg.alpha !== 1) throw new Error(`contrast needs an opaque surface, got alpha ${bg.alpha}`);
  const a = luminance(over(fg, bg));
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
