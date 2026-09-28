/**
 * What the app shows and holds, as comparable data (TST-04).
 *
 * The sidebar's wiring had no test: a refactor could change what a control
 * emits, what it writes, or what its readout says, and every gate stayed
 * green (the pilot found nothing checks the readouts, §14.5). These helpers
 * reduce a booted app to three plain maps — the shell as a user sees it, the
 * project as it saves, and the few app flags that live in neither — so a
 * golden can pin how one state becomes the next.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { comparableSnapshot } from './projectSnapshot.js';

const tokensPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles', 'tokens.css');

/**
 * Give the document the map palette its stylesheet would. The swatch pickers
 * read their colours from `--map-*` custom properties when they are built, and
 * jsdom loads no stylesheet, so without this every palette swatch carries an
 * empty colour. The values are read from `styles/tokens.css` itself.
 *
 * @returns {() => void} Removes them again
 */
export function applyMapPalette() {
  const root = document.documentElement;
  const tokens = [...readFileSync(tokensPath, 'utf8').matchAll(/^\s*(--map-[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/gm)];
  for (const [, name, value] of tokens) root.style.setProperty(name, value);
  return () => {
    for (const [, name] of tokens) root.style.removeProperty(name);
  };
}

/**
 * Never described: the canvas is pinned by the draw logs, and `<template>`,
 * `<script>` and `<style>` show nothing. SVG is DOM, so the busyness graph
 * is described like any other element.
 */
const NOT_DESCRIBED = new Set(['canvas', 'template', 'script', 'style']);

/**
 * Offsets that code measures from the layout to place a tooltip or a menu.
 * jsdom lays nothing out, so they measure nothing; where a popup sits belongs
 * to a browser check, and whether it shows stays in the line.
 */
const MEASURED_OFFSETS = ['top', 'right', 'bottom', 'left'];

function styleOf(element) {
  const style = element.style;
  const kept = [];
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (!MEASURED_OFFSETS.includes(property)) kept.push(`${property}: ${style.getPropertyValue(property)};`);
  }
  return kept.join(' ');
}

/**
 * Not shown at all: hidden, or not displayed. Nothing of such an element — its
 * attributes, text or contents — reaches a user (a panel keeps whatever it was
 * last filled with while hidden, and nobody can see that). Visibility set by a
 * stylesheet is not modelled: jsdom applies none.
 */
function isUnshown(element) {
  return element.hidden || element.style.display === 'none';
}

/**
 * One line per element: every attribute but `id`, its form state, and its own
 * text (a container's text is its children's). Attributes carry the rest of
 * what a user perceives — inline `display`, `disabled`, the `aria-*` state and
 * the classes that style a pressed or active control.
 */
function describe(element, tag) {
  const attributes = [];
  for (const attribute of element.attributes) {
    if (attribute.name === 'id') continue;
    // `display:none` in the shell and `display: none` set from code look the
    // same; the parsed declaration is what the browser applies.
    const value = attribute.name === 'style' ? styleOf(element) : attribute.value;
    attributes.push(`${attribute.name}=${quote(value)}`);
  }
  attributes.sort();
  let line = attributes.length ? `${tag} ${attributes.join(' ')}` : tag;
  // Form state lives in properties, which attributes do not show.
  if (tag === 'input') {
    if (element.type === 'checkbox' || element.type === 'radio') {
      line += element.checked ? ' :checked' : ' :unchecked';
      if (element.indeterminate) line += ' :indeterminate';
    } else if (element.type !== 'file') {
      line += ` :value=${quote(element.value)}`;
    }
  } else if (tag === 'select' || tag === 'textarea') {
    line += ` :value=${quote(element.value)}`;
  }
  // A browser shows a control's validation message when it is checked; the
  // handlers that set one expect the author to see it.
  if (FORM_TAGS.has(tag) && element.validity.customError) line += ` :invalid=${quote(element.validationMessage)}`;
  let text = '';
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === Node.TEXT_NODE) text += node.data;
  }
  text = text.replace(/\s+/g, ' ').trim();
  return text ? `${line} :text=${quote(text)}` : line;
}

/**
 * The shell as a user perceives it: every element outside the drawn surfaces,
 * keyed by its id or by its path from the nearest ancestor with one; an
 * element not shown is only said to be so, and what it holds is left out.
 * Rows built at run time (the waypoint list, the layer strip) carry no ids,
 * and their positions are what a user sees. `complete` describes hidden
 * elements and their contents too: what a hidden panel still holds can show
 * again later, so a test that must start from the same state compares that.
 *
 * @param {Element} [root]
 * @param {{ opaque?: string, cached?: Function, complete?: boolean }} [options] -
 *   `opaque` names elements described only by their own line, for a region
 *   another suite pins
 * @returns {Map<string, string>}
 */
export function uiState(root = document.body, { opaque = null, cached = null, complete = false } = {}) {
  const state = new Map();
  // Each key's parent key, so a diff can fold a subtree that appeared whole.
  state.parents = new Map();
  const walk = (parent, parentKey) => {
    const children = parent.children;
    for (let index = 0; index < children.length; index += 1) {
      const element = children[index];
      const tag = element.localName;
      if (NOT_DESCRIBED.has(tag)) continue;
      const key = element.id ? `#${element.id}` : `${parentKey}>${tag}[${index}]`;
      const unshown = !complete && isUnshown(element);
      state.set(key, unshown ? `${tag} (not shown)` : cached ? cached(element, tag) : describe(element, tag));
      state.parents.set(key, parentKey);
      if (!element.firstElementChild || unshown) continue;
      if (opaque && element.matches(opaque)) continue;
      walk(element, key);
    }
  };
  walk(root, root === document.body ? 'body' : `#${root.id}`);
  return state;
}

/** Past this many elements, a subtree that appears or vanishes whole is counted, not listed. */
const FOLD_OVER = 12;

/**
 * `changedLines` for two `uiState` maps, except that a subtree that appears
 * or vanishes whole — a panel revealed, a list rebuilt longer — is one line
 * with its size and a checksum of every line in it, once it is bigger than
 * `FOLD_OVER`. The checksum still changes if anything inside does.
 *
 * @returns {string[]}
 */
export function uiChanges(before, after, label = 'ui') {
  const fold = (state, other) => {
    // Keys this state has and the other lacks, grouped under the topmost one.
    const groups = new Map();
    for (const key of state.keys()) {
      if (other.has(key)) continue;
      let top = key;
      for (let parent = state.parents.get(key); parent && state.has(parent) && !other.has(parent); parent = state.parents.get(parent)) {
        top = parent;
      }
      if (!groups.has(top)) groups.set(top, []);
      groups.get(top).push(key);
    }
    return groups;
  };
  const describeGroup = (sign, state, top, keys) => {
    if (keys.length <= FOLD_OVER) return keys.map(key => `${label} ${sign} ${key}: ${state.get(key)}`);
    const text = keys.map(key => `${key}: ${state.get(key)}`).join('\n');
    return [`${label} ${sign} ${top}: ${state.get(top)} (and ${keys.length - 1} inside, ${checksum(text)})`];
  };
  const lines = [];
  const added = fold(after, before);
  for (const [key, value] of after) {
    if (added.has(key)) lines.push(...describeGroup('+', after, key, added.get(key)));
    else if (before.has(key) && before.get(key) !== value) lines.push(`${label} ~ ${key}: ${before.get(key)} → ${value}`);
  }
  for (const [top, keys] of fold(before, after)) lines.push(...describeGroup('-', before, top, keys));
  return lines;
}

const FORM_TAGS = new Set(['input', 'select', 'textarea']);

/**
 * `uiState` for a golden that reads the shell hundreds of times: each element
 * is described once and again only after a mutation touches it. Form controls
 * are always described afresh, because their value and checkedness are
 * properties that change without a mutation.
 *
 * @param {Element} [root]
 * @param {{ opaque?: string }} [options] - As `uiState`
 * @returns {{ capture: () => Map<string, string>, disconnect: () => void }}
 */
export function watchUi(root = document.body, { opaque = null } = {}) {
  const lines = new WeakMap();
  const forget = (records) => {
    for (const record of records) {
      // A changed attribute, or a text or element child added or removed,
      // changes only the element it happened to: its descendants keep their
      // own lines, and new ones have none yet.
      const target = record.type === 'characterData' ? record.target.parentElement : record.target;
      if (target) lines.delete(target);
    }
  };
  // Records reach the callback at the next microtask, and `takeRecords` only
  // returns those not yet delivered, so both must forget.
  const observer = new MutationObserver(forget);
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  const cached = (element, tag) => {
    if (FORM_TAGS.has(tag)) return describe(element, tag);
    let line = lines.get(element);
    if (line === undefined) {
      line = describe(element, tag);
      lines.set(element, line);
    }
    return line;
  };
  return {
    capture({ complete = false } = {}) {
      forget(observer.takeRecords());
      return uiState(root, { opaque, cached, complete });
    },
    disconnect() {
      observer.disconnect();
    },
  };
}

/** A key for one element, as `uiState` would key it. */
export function keyFor(element) {
  if (element.id) return `#${element.id}`;
  const parent = element.parentElement;
  if (!parent || element === document.body) return 'body';
  const index = Array.prototype.indexOf.call(parent.children, element);
  return `${keyFor(parent)}>${element.localName}[${index}]`;
}

/** Flatten a JSON value to `path → value` leaves. */
function flatten(value, path, out) {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(path, '[]');
    value.forEach((each, index) => flatten(each, `${path}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) out.set(path, '{}');
    for (const key of keys) flatten(value[key], path ? `${path}.${key}` : key, out);
  } else {
    out.set(path, typeof value === 'string' ? quote(value) : JSON.stringify(value));
  }
  return out;
}

/**
 * The project as it saves: the one save shape (`_buildProjectSnapshot`,
 * shared by autosave and both exports), in comparable form.
 *
 * @returns {Map<string, string>}
 */
export function modelState(app) {
  return flatten(comparableSnapshot(app._buildProjectSnapshot()), '', new Map());
}

/** A waypoint named the way a golden can read it: its route index. */
function waypointRef(app, waypoint) {
  const index = app.waypoints.indexOf(waypoint);
  return index >= 0 ? `waypoint[${index}]` : 'waypoint[detached]';
}

function layerRef(app, layer) {
  const index = app.scene?.flowLayers?.indexOf(layer) ?? -1;
  return index >= 0 ? `layer[${index}]` : 'layer[detached]';
}

const round = value => (typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(6)) : value);

const NATURALLY_FOCUSABLE = 'a[href], button, input, select, textarea, summary, [contenteditable]';

/**
 * Where focus is, as a browser would report it. jsdom keeps focus on an
 * element that has since been hidden or lost the tabindex that made it
 * focusable; a browser's focus fixup moves it to the body, so this does too.
 */
function focusedKey() {
  const element = document.activeElement;
  if (!element || element === document.body) return 'body';
  const focusable = element.hasAttribute('tabindex') || (element.matches(NATURALLY_FOCUSABLE) && !element.disabled);
  let shown = element.isConnected;
  for (let node = element; shown && node && node !== document.body; node = node.parentElement) {
    if (isUnshown(node)) shown = false;
  }
  return focusable && shown ? keyFor(element) : 'body';
}

/**
 * What the app holds outside the save shape that a control can change:
 * selection, mode, transport and view.
 *
 * @returns {Map<string, string>}
 */
export function appState(app) {
  const state = app.animationEngine?.state ?? {};
  const flags = {
    selected: app.selectedWaypoint ? waypointRef(app, app.selectedWaypoint) : null,
    selection: (app.selectedWaypoints ?? []).map(waypoint => waypointRef(app, waypoint)).join(' '),
    crowd: app.selectedCrowd ? layerRef(app, app.selectedCrowd) : null,
    previewMode: Boolean(app.previewMode),
    playing: Boolean(state.isPlaying),
    progress: round(state.progress),
    playbackSpeed: round(state.playbackSpeed),
    exportMode: Boolean(app._isExportMode),
    viewport: [app.viewport?.zoom, app.viewport?.panX, app.viewport?.panY].map(round).join(' '),
    focus: focusedKey(),
  };
  return new Map(Object.entries(flags).map(([key, value]) => [key, JSON.stringify(value)]));
}

/**
 * Lines for every key whose value changed between two maps, in the order the
 * later map holds them, with removals last.
 *
 * @returns {string[]}
 */
export function changedLines(before, after, label) {
  const lines = [];
  for (const [key, value] of after) {
    if (!before.has(key)) lines.push(`${label} + ${key}: ${value}`);
    else if (before.get(key) !== value) lines.push(`${label} ~ ${key}: ${before.get(key)} → ${value}`);
  }
  for (const [key, value] of before) {
    if (!after.has(key)) lines.push(`${label} - ${key}: ${value}`);
  }
  return lines;
}

/** A short checksum, so a long value can be elided and still tell any change. */
function checksum(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** A string as JSON, its middle elided past 240 characters. */
export function quote(text) {
  const json = JSON.stringify(text);
  return json.length <= 240 ? json : `${json.slice(0, 160)}…[${text.length} chars, ${checksum(text)}]`;
}

/** The record a flattened path belongs to: its first array element, if any. */
function recordOf(path) {
  const match = path.match(/^[^[]*\[\d+\]/);
  return match ? match[0] : null;
}

/**
 * `changedLines` for two `modelState` maps, except that a record that appears
 * or vanishes whole — a waypoint Clear All removes, a crowd a button adds — is
 * one line with how many values it holds and a checksum of them, once it holds
 * more than `FOLD_OVER`.
 *
 * @returns {string[]}
 */
export function modelChanges(before, after, label = 'model') {
  const whole = (state, other) => {
    const records = new Map();
    for (const path of state.keys()) {
      const record = recordOf(path);
      if (!record || other.has(path)) continue;
      if (!records.has(record)) records.set(record, []);
      records.get(record).push(path);
    }
    for (const record of [...records.keys()]) {
      const prefix = [`${record}.`, `${record}[`];
      const survives = [...other.keys()].some(path => path === record || prefix.some(each => path.startsWith(each)));
      if (survives || records.get(record).length <= FOLD_OVER) records.delete(record);
    }
    return records;
  };
  const fold = (sign, state, record, paths) => {
    const text = paths.map(path => `${path}: ${state.get(path)}`).join('\n');
    return `${label} ${sign} ${record}: ${paths.length} values (${checksum(text)})`;
  };
  const added = whole(after, before);
  const removed = whole(before, after);
  const folded = new Set([...added.values(), ...removed.values()].flat());
  const lines = [];
  const emitted = new Set();
  for (const [path, value] of after) {
    const record = recordOf(path);
    if (added.has(record)) {
      if (!emitted.has(record)) lines.push(fold('+', after, record, added.get(record)));
      emitted.add(record);
    } else if (!before.has(path)) lines.push(`${label} + ${path}: ${value}`);
    else if (before.get(path) !== value) lines.push(`${label} ~ ${path}: ${before.get(path)} → ${value}`);
  }
  for (const [path, value] of before) {
    if (after.has(path) || folded.has(path)) continue;
    lines.push(`${label} - ${path}: ${value}`);
  }
  for (const [record, paths] of removed) lines.push(fold('-', before, record, paths));
  return lines;
}

/**
 * A payload as a golden can hold it. Waypoints and layers become their index,
 * files their name and type, and numbers are rounded as the snapshot goldens
 * round them. Past two levels an object or array is only counted: a payload
 * that carries the whole scene is the outline's to pin, not a control's.
 */
export function summarise(app, value, depth = 0) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number') return String(round(value));
  if (typeof value === 'function') return '[function]';
  if (typeof File !== 'undefined' && value instanceof File) return `[file ${value.name} ${value.type}]`;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return `[blob ${value.type}]`;
  if (typeof Element !== 'undefined' && value instanceof Element) return `[element ${keyFor(value)}]`;
  // An error's message is not an own enumerable property, so it would read `{}`.
  if (value instanceof Error) return `${value.name}(${quote(value.message)})`;
  if (app.waypoints.includes(value)) return waypointRef(app, value);
  if (app.scene?.flowLayers?.includes?.(value)) return layerRef(app, value);
  if (Array.isArray(value)) {
    if (depth >= 2) return `[${value.length} items]`;
    return `[${value.map(each => summarise(app, each, depth + 1)).join(', ')}]`;
  }
  const entries = Object.entries(value);
  if (depth >= 2) return `{${entries.length} keys}`;
  return `{${entries.map(([key, each]) => `${key}: ${summarise(app, each, depth + 1)}`).join(', ')}}`;
}

/**
 * Record what a control asks of the app: the events emitted while it is
 * handled, outside any listener. What the app's listeners emit in turn is the
 * event transcript's business (TST-05), not the control's.
 *
 * @returns {{ take: () => string[], restore: () => void }}
 */
export function recordEmits(app) {
  const bus = app.eventBus;
  const emit = bus.emit;
  let depth = 0;
  let lines = [];
  bus.emit = function recordedEmit(eventName, ...args) {
    if (depth === 0) {
      const payload = args.map(arg => summarise(app, arg)).join(', ');
      lines.push(payload ? `emit ${eventName} ${payload}` : `emit ${eventName}`);
    }
    depth += 1;
    try {
      return emit.call(bus, eventName, ...args);
    } finally {
      depth -= 1;
    }
  };
  return {
    take() {
      const taken = lines;
      lines = [];
      return taken;
    },
    restore() {
      bus.emit = emit;
    },
  };
}
