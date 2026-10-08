/**
 * UI-06 (B-15, B-25, J-03) — every word the app shows is sentence case.
 *
 * UI-STANDARDS: "Sentence case for all UI text." The review found about
 * fifty Title Case strings in the shell ("Wait Time", "Marker Mode", "Show
 * on Progression") and more in the strings the app builds (the help's
 * "Create Your Route", the list's "Add Waypoint"). Nothing pinned the rule,
 * so a new label could bring Title Case back unnoticed.
 *
 * What is read: the booted app's shell with the states that build strings
 * (a route, a crowd with a busyness handle, a network with a junction, the
 * network banner, the help, the scene outline with every entry open) and the
 * exported player's page. Each label, option, button, heading, summary,
 * legend, menu item, help row and hint is held to the rule.
 *
 * The rule, as a test can read it: the first word is capitalised (or starts
 * with a digit or a symbol), and no later word is capitalised unless it is a
 * proper noun or an acronym (ALLOWED_WORDS), a single letter (a key, a branch
 * letter), an entity name followed by its number ("Crowd 1", "Node 2"), a
 * major or minor waypoint's name, or the start of a new sentence or segment
 * (after ".", ":", ";", "—"). A hint is prose, so it may name controls in
 * their own case ("Use Type to change…"); what it may not do is carry a Title
 * Case run such as "Wait Time" (ALLOWED_PHRASES excepts the proper names).
 * Image titles and example-project names are titles, and are left out.
 */

import { describe, test, expect } from 'vitest';
import { HTMLExportService } from '../src/services/HTMLExportService.js';
import { bootApp } from './helpers/bootApp.js';

/** Proper nouns, products, formats and keys that keep their capital. */
const ALLOWED_WORDS = new Set([
  'Route', 'Plotter', 'Okabe-Ito', 'UoN', 'PARM', 'MP4', 'WebM', 'HTML', 'GitHub', 'Issues', 'Carbon',
  'Nielsen', 'WCAG', 'Esc', 'H.264', 'Nervous', 'System', 'Aerial', 'Map', 'Courts', 'Garlic', 'Rocketry',
  'Home', 'End', 'Space', 'Del', 'Shift', 'Cmd', 'Ctrl', 'Alt', 'Tab', 'Enter',
]);

/** Runs of capitalised words that are names, not Title Case. */
const ALLOWED_PHRASES = new Set(['Route Plotter', 'Nervous System', 'PARM Aerial', 'UoN Map', 'Okabe-Ito']);

/** Entity names the outline and the list number: "Crowd 1", "Node 2", "Waypoint 1·B1". */
const ENTITY_WORDS = new Set(['Crowd', 'Node', 'Waypoint', 'Emitter', 'Path', 'Bend', 'Handle', 'Vertex']);

/** A token's letters, without the punctuation around them. */
const bare = token => token.replace(/^[(["“'‘]+/, '').replace(/[)\]"”'’,.:;!?…]+$/, '');

/** Whether the token after this one starts a new sentence or segment. */
const endsSegment = token => /[.:;!?]$/.test(token) || token === '—' || token === '–';

const isCapitalisedWord = token => /^[A-Z][a-z]/.test(bare(token));

/**
 * What is wrong with a label, option, button, heading or menu item, or null.
 * @param {string} text
 * @returns {string|null}
 */
function labelFault(text) {
  if (!/[a-zA-Z]/.test(text)) return null;
  // A leading glyph or number ("+ Add crowd", "16:9") is not the first word.
  const tokens = text.split(/\s+/).filter(Boolean);
  const start = tokens.findIndex(token => /[a-zA-Z]/.test(token));
  const first = bare(tokens[start]);
  if (/^[a-z]/.test(first)) return `starts lower case: "${text}"`;
  for (let index = start + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    const word = bare(token);
    if (!/^[A-Z]/.test(word)) continue;
    if (endsSegment(tokens[index - 1])) continue;
    if (ALLOWED_WORDS.has(word)) continue;
    if (word.length === 1) continue;
    const next = tokens[index + 1];
    if (ENTITY_WORDS.has(word) && next && /^\d/.test(next)) continue;
    if ((word === 'Major' || word === 'Minor') && next === 'waypoint') continue;
    return `"${word}" is capitalised in "${text}"`;
  }
  return null;
}

/**
 * What is wrong with a hint, or null: it starts with a capital, a digit or a
 * symbol, and carries no Title Case run.
 * @param {string} text
 * @returns {string|null}
 */
function hintFault(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  if (/^[a-z]/.test(bare(tokens[0]))) return `starts lower case: "${text.slice(0, 40)}"`;
  let run = [];
  const check = () => {
    if (run.length >= 2 && !ALLOWED_PHRASES.has(run.join(' '))) {
      return `Title Case run "${run.join(' ')}" in "${text.slice(0, 60)}"`;
    }
    return null;
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const neutral = index === 0 || endsSegment(tokens[index - 1]);
    if (!neutral && isCapitalisedWord(token)) {
      run.push(bare(token));
      continue;
    }
    const fault = check();
    if (fault) return fault;
    run = [];
  }
  return check();
}

/**
 * An element's own words: its text without hidden and screen-reader-only
 * parts, and without a shortcut chip (`<kbd>`), which is a key, not a word.
 */
function visibleText(element) {
  const copy = element.cloneNode(true);
  copy.querySelectorAll('[aria-hidden="true"], .sr-only, kbd').forEach(node => node.remove());
  return copy.textContent.replace(/\s+/g, ' ').trim();
}

/** A label's own words: the hint span it carries, or its direct text. */
function labelText(label) {
  const direct = [...label.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.data)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (label.hasAttribute('data-tip') || direct) return direct;
  const span = label.querySelector(':scope > span[data-tip], :scope > span:not([id])');
  return span ? visibleText(span) : '';
}

/**
 * Every string in `root` the rule covers, with what each is.
 * @param {ParentNode} root
 * @returns {Array<{what: string, text: string, hint: boolean}>}
 */
function stringsIn(root) {
  const found = [];
  const add = (what, text, hint = false) => {
    if (text) found.push({ what, text, hint });
  };
  for (const label of root.querySelectorAll('label')) add('label', labelText(label));
  for (const legend of root.querySelectorAll('legend')) add('legend', visibleText(legend));
  for (const option of root.querySelectorAll('option')) add('option', visibleText(option));
  for (const button of root.querySelectorAll('button')) {
    if (button.matches('.param-hint-trigger, .dropdown-item-example')) continue;
    add('button', visibleText(button));
  }
  for (const heading of root.querySelectorAll('h1, h2, h3, h4')) add(heading.localName, visibleText(heading));
  for (const summary of root.querySelectorAll('summary')) {
    // The help's accordion summary carries its title and a "Click to expand" hint: two strings.
    const parts = [...summary.querySelectorAll(':scope > span')];
    if (parts.length > 1) parts.forEach(part => add('summary', visibleText(part)));
    else add('summary', visibleText(summary));
  }
  for (const item of root.querySelectorAll('[role="menuitem"]:not(button):not(.dropdown-item-example)')) {
    add('menu item', visibleText(item));
  }
  for (const row of root.querySelectorAll('.control-item > span, .inline-shortcut > span')) {
    add('help row', visibleText(row));
  }
  for (const tip of root.querySelectorAll('[data-tip]')) add('hint', tip.getAttribute('data-tip'), true);
  for (const tip of root.querySelectorAll('[data-label-tip]')) add('hint', tip.getAttribute('data-label-tip'), true);
  return found;
}

/** The faults among `strings`, each with what it is. */
function faultsIn(strings) {
  return strings
    .map(({ what, text, hint }) => {
      const fault = hint ? hintFault(text) : labelFault(text);
      return fault ? `${what}: ${fault}` : null;
    })
    .filter(Boolean);
}

/** Open every closed disclosure in the outline, so each entry's form is drawn. */
async function openWholeOutline(container) {
  for (let guard = 0; guard < 200; guard += 1) {
    const closed = container.querySelector('details[data-outline-disclosure]:not([open])');
    if (!closed) break;
    closed.querySelector(':scope > summary').click();
    await Promise.resolve();
  }
  expect(container.querySelector('details[data-outline-disclosure]:not([open])')).toBeNull();
}

/**
 * The app in the states that build strings: a route of two, so the list has
 * its Add waypoint row and the cards their actions; a crowd with a busyness
 * handle and a custom network whose junction is inspected, so the path
 * weight rows are drawn; the network banner; the outline open throughout.
 */
async function populatedApp() {
  const app = await bootApp();
  await app.ready;
  // The splash's focus trap outlives the boot and would take a later Escape.
  document.getElementById('splash-close').click();

  app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
  expect(app.waypoints.length).toBe(2);
  app.eventBus.emit('waypoint:selected', app.waypoints[0]);

  app.addCrowd({ enterNetworkEditor: false });
  const layer = app.selectedCrowd;
  layer.setGuideType('graph');
  app.syncCrowdEditor();
  app.updateGuideCard();
  document.getElementById('crowd-busyness-add').click();
  const junction = layer.graph.addNode({ x: 0.5, y: 0.5 });
  for (const y of [0.2, 0.8]) {
    const exit = layer.graph.addNode({ x: 0.9, y, type: 'exit' });
    layer.graph.addEdge({ sourceId: junction.id, targetId: exit.id, direction: 'one-way' });
  }
  app.networkEditService.enter(layer);
  app.networkEditService.selectNode(junction);
  app.syncNetworkCards();
  app._refreshSceneOutline();
  await Promise.resolve();
  await openWholeOutline(document.getElementById('scene-outline'));
  return app;
}

describe('every word the app shows is sentence case (UI-06 B-15)', () => {
  test('the shell, with the strings the app builds as it is used', async () => {
    const app = await populatedApp();
    try {
      const strings = stringsIn(document.body);
      // Vacuous unless the shell and the built rows were there to read.
      const whats = Object.fromEntries(['label', 'option', 'button', 'summary', 'hint', 'help row', 'h2']
        .map(what => [what, strings.filter(string => string.what === what).length]));
      expect(whats.label).toBeGreaterThan(120);
      expect(whats.option).toBeGreaterThan(80);
      expect(whats.button).toBeGreaterThan(80);
      expect(whats.hint).toBeGreaterThan(120);
      expect(whats['help row']).toBeGreaterThan(30);
      expect(whats.summary).toBeGreaterThan(20);
      expect(document.getElementById('network-edit-banner')).not.toBeNull();
      expect(document.querySelectorAll('.network-path-weight-row').length).toBe(2);
      expect(document.querySelectorAll('#waypoint-list .waypoint-add-btn').length).toBe(1);

      expect(faultsIn(strings)).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });

  test('the exported player’s page', () => {
    const html = Object.create(HTMLExportService.prototype)._generateHTML('Route', null, {}, '');
    const page = new DOMParser().parseFromString(html, 'text/html');
    const strings = stringsIn(page);

    expect(strings.map(string => string.text)).toContain('Skip to start');
    expect(faultsIn(strings)).toEqual([]);
  });

  test('the rule reads Title Case as a fault, and sentence case, names and keys as none', () => {
    expect(labelFault('Wait Time')).toMatch(/"Time" is capitalised/);
    expect(labelFault('Marker Mode')).toMatch(/"Mode" is capitalised/);
    expect(labelFault('Always Show')).toMatch(/"Show" is capitalised/);
    expect(labelFault('Follow Path')).toMatch(/"Path" is capitalised/);
    expect(labelFault('wait time')).toMatch(/starts lower case/);
    expect(labelFault('Wait time')).toBeNull();
    expect(labelFault('Export MP4…')).toBeNull();
    expect(labelFault('Welcome to Route Plotter v3')).toBeNull();
    expect(labelFault('Select Crowd 1')).toBeNull();
    expect(labelFault('After Major waypoint 1 — Alpha')).toBeNull();
    expect(labelFault('Waypoint 1·B1 (branch B)')).toBeNull();
    expect(labelFault('0.25x')).toBeNull();
    expect(labelFault('+ Add crowd')).toBeNull();
    expect(hintFault('Sets Wait Time to how long the ripple lasts')).toMatch(/Title Case run "Wait Time"/);
    expect(hintFault('Sets Wait time to how long the ripple lasts')).toBeNull();
    expect(hintFault('Use Type to change this node. Choose Edit network to move nodes.')).toBeNull();
    expect(hintFault('Left (Earlier) sets more dots off; Even favours neither')).toBeNull();
    expect(hintFault('1920×1080 (16:9 HD)')).toBeNull();
    expect(hintFault('Create animated routes with Route Plotter')).toBeNull();
  });
});
