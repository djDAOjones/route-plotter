/**
 * Stylesheet reading for the token and contrast tests (UI-06).
 *
 * jsdom applies a loaded stylesheet's declarations but leaves `var()` where
 * it found it, and it cannot hover or press anything, so a computed colour
 * for a state cannot be read back from the DOM. These helpers read the
 * stylesheets instead: the tokens `styles/tokens.css` defines, the rules
 * each sheet carries, and a small cascade — for a mounted element, the
 * winning declaration across every sheet `index.html` loads, by importance,
 * specificity and source order, in the states and media asked for — then
 * the WCAG 2.x contrast of two colours once any alpha or group `opacity`
 * is composited over the surface beneath.
 *
 * Limits, stated: states (`hover`, `active`, `focus-visible`, …) are taken
 * to hold for the element and its ancestors, as a pointer's hover does;
 * an ancestor's own `opacity` multiplies the text's but its background is
 * composited opaque; `inherit`, `currentColor` and the inherited text
 * properties are followed, other keywords are not; a gradient or image
 * background paints no surface.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STYLES_DIR = resolve(process.cwd(), 'styles');

/** Conditional at-rule preludes, whitespace removed (see `normaliseMedia`). */
export const MORE_CONTRAST = '@media(prefers-contrast:more)';
export const FORCED_COLOURS = '@media(forced-colors:active)';

/** An at-rule prelude with its whitespace removed, so two spellings compare equal. */
export function normaliseMedia(prelude) {
  return prelude.replace(/\s+/g, '');
}

/** The stylesheet file names under `styles/`. */
export function styleNames() {
  return readdirSync(STYLES_DIR).filter(name => name.endsWith('.css')).sort();
}

/** @param {string} name A file under `styles/`. */
export function readStyle(name) {
  return readFileSync(resolve(STYLES_DIR, name), 'utf8');
}

/** The stylesheets in the order `index.html` loads them. */
export function loadOrder() {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  return [...html.matchAll(/<link\s+rel="stylesheet"\s+href="styles\/([\w-]+\.css)/g)].map(match => match[1]);
}

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Every style rule in a stylesheet, in source order, as
 * `{ selectors, declarations, important, media }`. A rule inside a
 * conditional at-rule carries that at-rule's normalised prelude as `media`
 * (`''` at the top level); other at-rules (`@keyframes`, `@font-face`) are
 * skipped. `important` names the declarations marked `!important`.
 * @param {string} css
 * @returns {{ selectors: string[], declarations: Map<string, string>, important: Set<string>, media: string }[]}
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
      if (/^@(media|supports|container|layer)\b/.test(prelude)) out.push(...rules(body, normaliseMedia(prelude)));
    } else {
      const { declarations: map, important } = declarations(body);
      out.push({
        selectors: prelude.split(',').map(selector => selector.trim()).filter(Boolean),
        declarations: map,
        important,
        media,
      });
    }
    index = close;
  }
  return out;
}

function declarations(body) {
  const map = new Map();
  const important = new Set();
  for (const part of body.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const property = part.slice(0, colon).trim();
    if (!property) continue;
    const raw = part.slice(colon + 1).trim();
    const flagged = /!important$/.test(raw);
    map.set(property, raw.replace(/\s*!important$/, '').trim());
    if (flagged) important.add(property);
    else important.delete(property);
  }
  return { declarations: map, important };
}

/**
 * The value a selector's rules give a property, last declaration winning as
 * the cascade does for equal specificity, or `undefined` when none sets it.
 * `selector` must match one of a rule's selectors exactly (whitespace
 * normalised); `media` picks rules inside that at-rule prelude. This reads
 * one rule in isolation — for a mounted element's winning value see
 * `cascade`.
 */
export function declaration(css, selector, property, media = '') {
  const wanted = normaliseMedia(media);
  let found;
  for (const rule of rules(css)) {
    if (rule.media !== wanted || !rule.selectors.includes(selector)) continue;
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
  const wanted = normaliseMedia(media);
  const map = new Map();
  for (const rule of rules(css)) {
    if (rule.media !== wanted || !rule.selectors.includes(':root')) continue;
    for (const [name, value] of rule.declarations) if (name.startsWith('--')) map.set(name, value);
  }
  return map;
}

const tokensCache = new Map();

/**
 * The `:root` tokens in force: tokens.css's base definitions, overlaid with
 * every `:root` block inside an active `media` prelude, sheet by sheet in
 * load order.
 * @param {string[]} media Active at-rule preludes, e.g. `[MORE_CONTRAST]`.
 */
export function tokensFor(media = []) {
  const active = media.map(normaliseMedia);
  const key = active.join('|');
  if (tokensCache.has(key)) return tokensCache.get(key);
  const map = tokens();
  for (const rule of allRules()) {
    if (!rule.media || !active.includes(rule.media) || !rule.selectors.includes(':root')) continue;
    for (const [name, value] of rule.declarations) if (name.startsWith('--')) map.set(name, value);
  }
  tokensCache.set(key, map);
  return map;
}

/**
 * `value` with every `var()` substituted from `map`, as the browser would:
 * balanced parentheses, the fallback evaluated only when the token is
 * missing, and the result resolved again. An undefined token with no
 * fallback, or a cycle, throws: those are the defects this helper exists to
 * catch.
 */
export function resolveValue(value, map, trail = []) {
  let out = '';
  let index = 0;
  while (index < value.length) {
    const at = value.indexOf('var(', index);
    if (at < 0) {
      out += value.slice(index);
      break;
    }
    out += value.slice(index, at);
    let depth = 1;
    let cursor = at + 4;
    while (cursor < value.length && depth > 0) {
      if (value[cursor] === '(') depth += 1;
      else if (value[cursor] === ')') depth -= 1;
      cursor += 1;
    }
    if (depth !== 0) throw new Error(`unbalanced var() in "${value}"`);
    const inner = value.slice(at + 4, cursor - 1);
    let nested = 0;
    let comma = -1;
    for (let i = 0; i < inner.length && comma < 0; i += 1) {
      if (inner[i] === '(') nested += 1;
      else if (inner[i] === ')') nested -= 1;
      else if (inner[i] === ',' && nested === 0) comma = i;
    }
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim();
    if (!/^--[\w-]+$/.test(name)) throw new Error(`malformed var(${inner}) in "${value}"`);
    const via = trail.length ? ` (via ${trail.join(' → ')})` : '';
    if (map.has(name)) {
      if (trail.includes(name)) throw new Error(`cyclic token ${[...trail, name].join(' → ')}`);
      out += resolveValue(map.get(name), map, [...trail, name]);
    } else if (fallback !== undefined) {
      out += resolveValue(fallback, map, trail);
    } else {
      throw new Error(`undefined token ${name} in "${value}"${via}`);
    }
    index = cursor;
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

/**
 * The colour inside a value such as a `border` shorthand, tokens resolved.
 * A gradient or image paints no single colour and throws.
 */
export function colourIn(value, map) {
  const resolved = resolveValue(value, map);
  if (/gradient\(|url\(/i.test(resolved)) throw new Error(`no flat colour in "${value}" (→ "${resolved}")`);
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

/* ------------------------------------------------------------------------
   The cascade
   ------------------------------------------------------------------------ */

let rulesCache;

/** Every rule of every sheet `index.html` loads, in load and source order, numbered. */
export function allRules() {
  if (!rulesCache) {
    rulesCache = [];
    for (const sheet of loadOrder()) {
      for (const rule of rules(readStyle(sheet))) rulesCache.push({ ...rule, sheet, order: rulesCache.length });
    }
  }
  return rulesCache;
}

/**
 * A selector's specificity as `[ids, classes, types]`: attributes and
 * pseudo-classes count as classes, pseudo-elements as types, `:not()` and
 * `:is()` as their most specific argument, `:where()` as nothing.
 */
export function specificity(selector) {
  let ids = 0;
  let classes = 0;
  let types = 0;
  let rest = selector.replace(/:(not|is|where)\(([^()]*)\)/g, (_, fn, inner) => {
    if (fn === 'where') return '';
    const [a, b, c] = inner.split(',').map(arg => specificity(arg.trim()))
      .sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]).pop();
    ids += a;
    classes += b;
    types += c;
    return '';
  });
  ids += (rest.match(/#[\w-]+/g) ?? []).length;
  rest = rest.replace(/#[\w-]+/g, '');
  classes += (rest.match(/\[[^\]]*\]/g) ?? []).length;
  rest = rest.replace(/\[[^\]]*\]/g, '');
  types += (rest.match(/::[\w-]+/g) ?? []).length;
  rest = rest.replace(/::[\w-]+/g, '');
  classes += (rest.match(/\.[\w-]+/g) ?? []).length;
  rest = rest.replace(/\.[\w-]+/g, '');
  classes += (rest.match(/:[\w-]+/g) ?? []).length;
  rest = rest.replace(/:[\w-]+/g, '');
  types += (rest.match(/[a-zA-Z][\w-]*/g) ?? []).length;
  return [ids, classes, types];
}

const STATES = ['hover', 'active', 'focus-visible', 'focus-within', 'focus'];

/**
 * The selector to match once the given states hold, or `null` when it
 * cannot match: a pseudo-element, or a state not in force. A state pseudo-
 * class is stripped wherever it appears, so `.row:hover .title` matches
 * the title of a hovered row.
 */
function selectorInState(selector, states) {
  if (selector.includes('::')) return null;
  let probe = selector;
  for (const state of STATES) {
    const pattern = new RegExp(`:${state}(?![\\w-])`, 'g');
    if (!pattern.test(probe)) continue;
    if (!states.has(state)) return null;
    probe = probe.replace(pattern, '');
  }
  return probe.trim() || '*';
}

function wins(a, b) {
  if (a.important !== b.important) return a.important;
  for (let i = 0; i < 3; i += 1) {
    if (a.specificity[i] !== b.specificity[i]) return a.specificity[i] > b.specificity[i];
  }
  return a.order >= b.order;
}

/**
 * The winning declaration for `properties` (one, or several that paint the
 * same thing, such as `background` and `background-color`) on `element`
 * itself: `{ value, property, selector, sheet }`, or `undefined` when no
 * rule in force sets any of them. Rules inside an at-rule count only when
 * its prelude is listed in `media`; `states` are the pseudo-classes in force.
 */
export function cascade(element, properties, { states = [], media = [] } = {}) {
  const wanted = [].concat(properties);
  const active = new Set(media.map(normaliseMedia));
  const inForce = new Set(states);
  let best;
  for (const rule of allRules()) {
    if (rule.media && !active.has(rule.media)) continue;
    for (const property of wanted) {
      if (!rule.declarations.has(property)) continue;
      for (const selector of rule.selectors) {
        const probe = selectorInState(selector, inForce);
        if (!probe) continue;
        let hit;
        try { hit = element.matches(probe); } catch { hit = false; }
        if (!hit) continue;
        const candidate = {
          value: rule.declarations.get(property),
          property,
          selector,
          sheet: rule.sheet,
          important: rule.important.has(property),
          specificity: specificity(selector),
          order: rule.order,
        };
        if (!best || wins(candidate, best)) best = candidate;
      }
    }
  }
  return best;
}

const INHERITED = new Set([
  'color', 'font-size', 'font-weight', 'font-style', 'font-family', 'line-height', 'letter-spacing',
  'text-transform',
]);

/**
 * `cascade`, following inheritance: an inherited property, or a value of
 * `inherit`, is looked up on the ancestors in turn.
 */
export function computed(element, properties, options = {}) {
  const wanted = [].concat(properties);
  const inherits = wanted.every(property => INHERITED.has(property));
  for (let node = element; node; node = node.parentElement) {
    const hit = cascade(node, wanted, options);
    if (hit && hit.value !== 'inherit') return hit;
    if (!hit && !inherits) return undefined;
  }
  return undefined;
}

/** `tag.class.class` for a message. */
export function describe(element) {
  return `${element.tagName.toLowerCase()}${[...element.classList].map(name => `.${name}`).join('')}`;
}

/**
 * The colour `properties` resolve to on `element` (tokens in force
 * substituted; `currentColor` followed). Throws when no rule sets them.
 */
export function paintOf(element, properties, options = {}) {
  const hit = computed(element, properties, options);
  if (!hit) throw new Error(`${describe(element)} has no ${[].concat(properties).join('/')}`);
  const map = tokensFor(options.media);
  if (/currentcolor/i.test(hit.value)) return paintOf(element, 'color', options);
  return colourIn(hit.value, map);
}

/** The colour of `element`'s border on `side`, from the shorthands and longhands that can set it. */
export function borderColourOf(element, side = 'top', options = {}) {
  return paintOf(element, ['border', 'border-color', `border-${side}`, `border-${side}-color`], options);
}

/** The product of `opacity` on `element` and its ancestors. */
export function opacityOf(element, options = {}) {
  let alpha = 1;
  for (let node = element; node; node = node.parentElement) {
    const hit = cascade(node, 'opacity', options);
    if (hit) alpha *= Number(resolveValue(hit.value, tokensFor(options.media)));
  }
  return alpha;
}

function flatBackground(element, options) {
  const hit = cascade(element, ['background', 'background-color'], options);
  if (!hit) return undefined;
  let colour;
  try { colour = colourIn(hit.value, tokensFor(options.media)); } catch { return undefined; }
  return colour.alpha === 0 ? undefined : colour;
}

/**
 * The opaque surface `element` presents: its own background, or the nearest
 * painted ancestor's, translucent layers composited over the opaque one
 * beneath (the page's `--ui-00` when nothing paints).
 */
export function surfaceOf(element, options = {}) {
  const layers = [];
  for (let node = element; node; node = node.parentElement) {
    const colour = flatBackground(node, options);
    if (!colour) continue;
    layers.unshift(colour);
    if (colour.alpha === 1) break;
  }
  let surface = colourIn('var(--ui-00)', tokensFor(options.media));
  for (const layer of layers) surface = over(layer, surface);
  return surface;
}

/**
 * The pair the eye sees for `element`'s text: its colour and the surface
 * under it, both through the group `opacity` in force, composited over the
 * surface beneath the element — a faded chip fades its text and its own
 * background alike, against what lies below them both.
 */
export function textPair(element, options = {}) {
  const colour = paintOf(element, 'color', options);
  const alpha = opacityOf(element, options);
  const map = tokensFor(options.media);
  const below = element.parentElement ? surfaceOf(element.parentElement, options) : colourIn('var(--ui-00)', map);
  const own = flatBackground(element, options);
  return {
    fg: over(withOpacity(colour, alpha), below),
    bg: own ? over(withOpacity(own, alpha), below) : below,
  };
}
