/**
 * Stylesheet reading for the token and contrast tests (UI-06).
 *
 * jsdom applies a loaded stylesheet's declarations but leaves `var()` where
 * it found it, drops `!important` from a `var()` value, and cannot hover or
 * press anything, so a computed colour for a state cannot be read back from
 * the DOM. These helpers read the stylesheets instead: the tokens
 * `styles/tokens.css` defines, the rules each sheet carries, and a small
 * cascade — for a mounted element, the winning declaration across every
 * sheet `index.html` loads and the element's own `style` attribute, by
 * importance, inline, specificity, source order and position in the rule,
 * in the states and at-rule conditions asked for — then the WCAG 2.x
 * contrast of two colours once any alpha or group `opacity` is composited
 * over the surface beneath.
 *
 * Limits, stated: states (`hover`, `active`, `focus-visible`, …) are taken
 * to hold for the element and its ancestors, as a pointer's hover does, and
 * a state inside `:not()`, `:is()` or `:where()` is honoured there; an
 * ancestor's own `opacity` multiplies the text's but its background is
 * composited opaque; `inherit`, `currentColor` and the inherited text
 * properties are followed, other keywords are not; a gradient or image
 * background paints no surface; `:has()` is handed to jsdom as written.
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
 * `text` split at each top-level `separator`: one outside parentheses,
 * brackets and quotes. Empty pieces are dropped and the rest trimmed.
 */
export function splitTopLevel(text, separator = ',') {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === '\'') quote = char;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map(part => part.trim()).filter(Boolean);
}

/** The index just past the `)` that closes the `(` at `open`, or -1. */
function closingParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Every style rule in a stylesheet, in source order, as
 * `{ selectors, declarations, important, list, conditions, media }`.
 * `conditions` are the normalised preludes of the conditional at-rules the
 * rule sits inside, outermost first (`@media`, `@supports`, `@container`;
 * `@layer` adds none), and `media` joins them with `&&` — a single
 * condition reads as its prelude, the top level as `''`. Other at-rules
 * (`@keyframes`, `@font-face`) are skipped. `declarations` holds the last
 * value per property, `important` the properties marked so, and `list` the
 * declarations in source order, which is what the cascade reads.
 * @param {string} css
 */
export function rules(css, conditions = []) {
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
      const kind = prelude.match(/^@([\w-]+)/)?.[1];
      if (kind === 'media' || kind === 'supports' || kind === 'container') {
        out.push(...rules(body, [...conditions, normaliseMedia(prelude)]));
      } else if (kind === 'layer') {
        out.push(...rules(body, conditions));
      }
    } else {
      const { declarations: map, important, list } = parseDeclarations(body);
      out.push({
        selectors: splitTopLevel(prelude),
        declarations: map,
        important,
        list,
        conditions,
        media: conditions.join('&&'),
      });
    }
    index = close;
  }
  return out;
}

function parseDeclarations(body) {
  const map = new Map();
  const important = new Set();
  const list = [];
  for (const part of splitTopLevel(body, ';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const property = part.slice(0, colon).trim();
    if (!property) continue;
    const raw = part.slice(colon + 1).trim();
    const flagged = /!important$/.test(raw);
    const value = raw.replace(/\s*!important$/, '').trim();
    list.push({ property, value, important: flagged });
    map.set(property, value);
    if (flagged) important.add(property);
    else important.delete(property);
  }
  return { declarations: map, important, list };
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
 * every `:root` block whose conditions are all among the active `media`
 * preludes, sheet by sheet in load order.
 * @param {string[]} media Active at-rule preludes, e.g. `[MORE_CONTRAST]`.
 */
export function tokensFor(media = []) {
  const active = new Set(media.map(normaliseMedia));
  const key = [...active].sort().join('|');
  if (tokensCache.has(key)) return tokensCache.get(key);
  const map = tokens();
  for (const rule of allRules()) {
    if (!rule.conditions.length || !inForce(rule, active) || !rule.selectors.includes(':root')) continue;
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
    const end = closingParen(value, at + 3);
    if (end < 0) throw new Error(`unbalanced var() in "${value}"`);
    const inner = value.slice(at + 4, end - 1);
    const comma = topLevelComma(inner);
    const token = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim();
    if (!/^--[\w-]+$/.test(token)) throw new Error(`malformed var(${inner}) in "${value}"`);
    const via = trail.length ? ` (via ${trail.join(' → ')})` : '';
    if (map.has(token)) {
      if (trail.includes(token)) throw new Error(`cyclic token ${[...trail, token].join(' → ')}`);
      out += resolveValue(map.get(token), map, [...trail, token]);
    } else if (fallback !== undefined) {
      out += resolveValue(fallback, map, trail);
    } else {
      throw new Error(`undefined token ${token} in "${value}"${via}`);
    }
    index = end;
  }
  return out;
}

/** The index of the first top-level comma in `text`, or -1. */
function topLevelComma(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') depth -= 1;
    else if (text[i] === ',' && depth === 0) return i;
  }
  return -1;
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

const FUNCTIONAL = /^:(not|is|where|has)\(/;

/**
 * A selector's specificity as `[ids, classes, types]`: attributes and
 * pseudo-classes count as classes, pseudo-elements as types; `:not()`,
 * `:is()` and `:has()` count their most specific argument, `:where()`
 * nothing, whatever the nesting.
 */
export function specificity(selector) {
  let ids = 0;
  let classes = 0;
  let types = 0;
  let rest = '';
  let i = 0;
  while (i < selector.length) {
    const fn = selector.slice(i).match(FUNCTIONAL);
    if (fn) {
      const end = closingParen(selector, i + fn[0].length - 1);
      const inner = selector.slice(i + fn[0].length, end - 1);
      if (fn[1] !== 'where') {
        const [a, b, c] = splitTopLevel(inner).map(specificity)
          .sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]).pop() ?? [0, 0, 0];
        ids += a;
        classes += b;
        types += c;
      }
      i = end;
      continue;
    }
    rest += selector[i];
    i += 1;
  }
  rest = rest.replace(/(:[\w-]+)\([^()]*\)/g, '$1');
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

const STATE = /^:(hover|active|focus-visible|focus-within|focus)(?![\w-])/;

/**
 * The selector to match once the given states hold, or `null` when it
 * cannot match: a pseudo-element, or a state not in force. A state pseudo-
 * class is stripped wherever it appears, so `.row:hover .title` matches the
 * title of a hovered row; inside `:not()` the sense inverts — `:not(:hover)`
 * holds at rest and never while hovered — and `:is()`/`:where()` keep only
 * the alternatives that can still match.
 */
export function matchable(selector, states) {
  if (selector.includes('::')) return null;
  let out = '';
  let i = 0;
  while (i < selector.length) {
    const fn = selector.slice(i).match(FUNCTIONAL);
    if (fn) {
      const end = closingParen(selector, i + fn[0].length - 1);
      const inner = selector.slice(i + fn[0].length, end - 1);
      const name = fn[1];
      if (name === 'has') {
        out += selector.slice(i, end);
      } else {
        const kept = splitTopLevel(inner).map(alternative => matchable(alternative, states)).filter(Boolean);
        if (name === 'not') {
          // An alternative that cannot match in these states negates to
          // "always", and drops out; one that always matches negates to
          // "never", and sinks the selector.
          if (kept.includes('*')) return null;
          if (kept.length) out += `:not(${kept.join(', ')})`;
        } else {
          if (!kept.length) return null;
          out += `:${name}(${kept.join(', ')})`;
        }
      }
      i = end;
      continue;
    }
    const state = selector.slice(i).match(STATE);
    if (state) {
      if (!states.has(state[1])) return null;
      i += state[0].length;
      continue;
    }
    out += selector[i];
    i += 1;
  }
  return out.trim() || '*';
}

function inForce(rule, active) {
  return rule.conditions.every(condition => active.has(condition));
}

function wins(a, b) {
  if (a.important !== b.important) return a.important;
  if (a.inline !== b.inline) return a.inline;
  for (let i = 0; i < 3; i += 1) {
    if (a.specificity[i] !== b.specificity[i]) return a.specificity[i] > b.specificity[i];
  }
  if (a.order !== b.order) return a.order > b.order;
  return a.index >= b.index;
}

/** The last word a declaration list has on `wanted`: by importance, then position. */
function lastWord(list, wanted) {
  let own;
  list.forEach((declaration, index) => {
    if (!wanted.has(declaration.property)) return;
    if (!own || declaration.important || !own.important) own = { ...declaration, index };
  });
  return own;
}

/**
 * The winning declaration for `properties` (one, or several that paint the
 * same thing, such as `background` and `background-color`) on `element`
 * itself: `{ value, property, selector, sheet }`, or `undefined` when no
 * rule in force sets any of them. A rule inside conditional at-rules counts
 * only when every condition's prelude is listed in `media`; `states` are
 * the pseudo-classes in force; `rules` replaces the loaded sheets with a
 * list from `rules()`, for a test of the cascade itself. The element's own
 * `style` attribute is read as inline declarations.
 */
export function cascade(element, properties, { states = [], media = [], rules: source } = {}) {
  const wanted = new Set([].concat(properties));
  const active = new Set(media.map(normaliseMedia));
  const states_ = new Set(states);
  const list = source ? source.map((rule, order) => ({ sheet: 'test', order, ...rule })) : allRules();
  let best;
  const consider = candidate => {
    if (!best || wins(candidate, best)) best = candidate;
  };
  for (const rule of list) {
    if (!inForce(rule, active)) continue;
    const own = lastWord(rule.list, wanted);
    if (!own) continue;
    for (const selector of rule.selectors) {
      const probe = matchable(selector, states_);
      if (!probe) continue;
      let hit;
      try { hit = element.matches(probe); } catch { hit = false; }
      if (!hit) continue;
      consider({
        ...own, selector, sheet: rule.sheet, inline: false, specificity: specificity(selector), order: rule.order,
      });
    }
  }
  const inline = element.getAttribute?.('style');
  if (inline) {
    const own = lastWord(parseDeclarations(inline).list, wanted);
    if (own) {
      consider({ ...own, selector: 'style=""', sheet: 'inline', inline: true, specificity: [0, 0, 0], order: -1 });
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
