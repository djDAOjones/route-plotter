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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect, vi } from 'vitest';
import { HTMLExportService } from '../src/services/HTMLExportService.js';
import { bootApp } from './helpers/bootApp.js';

/**
 * Words the glossary retired (UI-06 §A, §C): none may come back, in a label,
 * a hint, a banner, an announcement, a toast or a validation message. Each
 * is a word for a concept the app now names otherwise.
 */
const RETIRED_WORDS = [
  /\bDrawing network\b/, /\bNetwork editing\b/, /\bEditing network\b/, /\bPrimary emitter\b/i,
  /\bRelease (start|length)\b/, /\bDeterministic seed\b/, /\bconfigured shares?\b/, /\bU-turn\b/i,
  /\bjunctions?\b/i, /\bimg\/s\b/, /\bimage units\b/, /\bTraffic\b/, /\bInstantaneous\b/, /\bforce-add/,
  /\bReset to start\b/, /\bedges\b/i, /\b(an|the|this|that|one-way|two-way|connected|each) edges?\b/i,
  /\bEdge (updated|deleted)\b/, /\bDeleted edge\b/, /\bStored custom network\b/, /\bpersisted\b/i,
  /\bretained\b/i, /\btiming keyframes?\b/, /\bgeometry points\b/, /\bSegment speed\b/, /\bOutgoing leg speed\b/,
  /\bbend points?\b/i, /\bClear all waypoints\b/, /\bhide controls\b/, /\bCollect at exit\b/, /\bRespawn at entry\b/,
  /\bLifecycle\b/, /\bvalid lifecycle\b/, /\bMulti-emitter\b/, /\bone connection\b/, /\bstart node\b/,
  /\bSpotlight Feather\b/, /\bView Dropoff\b/, /\bAngle of View\b/, /\bMarker Mode\b/, /\bWait Time\b/,
];

/** Proper nouns, products, formats and keys that keep their capital. */
const ALLOWED_WORDS = new Set([
  'Route', 'Plotter', 'Okabe-Ito', 'UoN', 'PARM', 'MP4', 'WebM', 'HTML', 'GitHub', 'Issues', 'Carbon',
  'Nielsen', 'WCAG', 'Esc', 'H.264', 'Nervous', 'System', 'Aerial', 'Map', 'Courts', 'Garlic', 'Rocketry',
  'Home', 'End', 'Space', 'Del', 'Shift', 'Cmd', 'Ctrl', 'Alt', 'Tab', 'Enter',
  // Readout words a hint quotes as the readout writes them ("Left (Earlier)…", "right (Later)").
  'Earlier', 'Later',
]);

/** Runs of capitalised words that are names, not Title Case. */
const ALLOWED_PHRASES = new Set(['Route Plotter', 'Nervous System', 'PARM Aerial', 'UoN Map', 'Okabe-Ito', 'GitHub Issues']);

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
    // "(Square)": a capital after an opening parenthesis is Title Case too.
    if (/^\([A-Z]/.test(token) && !ALLOWED_WORDS.has(bare(token))) {
      return `capital after an opening parenthesis "${token}" in "${text.slice(0, 60)}"`;
    }
    const neutral = index === 0 || endsSegment(tokens[index - 1]) || ALLOWED_WORDS.has(bare(token));
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

/** What is wrong with a sentence of prose (a banner, an announcement, a toast, a message), or null. */
function proseFault(text) {
  return hintFault(text);
}

/** The retired word `text` carries, or null. */
function retiredWord(text) {
  const hit = RETIRED_WORDS.find(pattern => pattern.test(text));
  return hit ? `retired word ${hit.source.replace(/\\b/g, '')} in "${text.slice(0, 70)}"` : null;
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
  // Prose the app shows: banners, helper lines, reasons, errors, dialogs, toasts.
  const PROSE = ['#network-edit-banner .banner-text', '#network-edit-banner .banner-count', '.section-hint',
    '.scene-outline-hint', '.scene-outline-empty', '[role="alert"]', '.modal-content > p', '.waypoint-card-actions-reason',
    '.network-path-weight-error', '.context-menu-item-reason', '.toast', '.splash-intro', '.help-section li',
    // UI-06 PR 4: the header's status line, the export menu's reason line, the crowd's empty-state line.
    '.header-status', '.dropdown-item-reason', '.crowd-no-emitter'];
  for (const node of root.querySelectorAll(PROSE.join(', '))) {
    // Its own sentences: a button, link or address nested in it is read on its own.
    const copy = node.cloneNode(true);
    copy.querySelectorAll('button, a, code').forEach(nested => nested.remove());
    add('prose', visibleText(copy), 'prose');
  }
  return found;
}

/** The faults among `strings`, each with what it is. */
function faultsIn(strings) {
  return strings
    .map(({ what, text, hint }) => {
      const fault = (hint === 'prose' ? proseFault(text) : hint ? hintFault(text) : labelFault(text)) ?? retiredWord(text);
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
  // What the app says, as it says it: announcements and toasts.
  const announced = [];
  const toasts = [];
  vi.spyOn(app, 'announce').mockImplementation((message) => { announced.push(message); });
  app.eventBus.on('ui:toast', ({ message }) => toasts.push(message));
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
  for (const y of [0.2, 0.5, 0.8]) {
    const exit = layer.graph.addNode({ x: 0.9, y, type: 'exit' });
    layer.graph.addEdge({ sourceId: junction.id, targetId: exit.id, direction: 'one-way' });
  }
  // Entered as an author does, from its button, so it is announced.
  app.enterNetworkEditMode();
  // A path deleted from its card (its toast), then the junction with its two
  // remaining paths inspected, so the path-weight rows are drawn.
  app.networkEditService.selectEdge(layer.graph.getEdges()[2]);
  app._deleteNetworkSelection('edge');
  app.networkEditService.selectNode(junction);
  app.syncNetworkCards();
  app._refreshSceneOutline();
  await Promise.resolve();
  await openWholeOutline(document.getElementById('scene-outline'));

  // Messages: a weight that is not one, an outline field that is not one, an
  // outline apply, a skip to the start.
  const weight = document.querySelector('.network-path-weight-row input');
  weight.value = 'abc';
  weight.dispatchEvent(new Event('input', { bubbles: true }));
  const emitter = layer.emitters[0];
  const emitterForm = document.querySelector('#scene-outline form[data-outline-action="update-emitter"]');
  const command = {
    action: 'update-emitter', layerId: layer.id, emitterId: emitter.id, outlineFormKey: emitterForm?.dataset.outlineFormKey,
    dotCount: '15', releaseStart: '10', releaseDuration: '70', onsetVariance: '20', intensityRamp: '-25',
    speed: '0.2', speedVariance: '30', dotSize: '1.5', wobble: '40', dotColor: '#0072B2', lifecycleMode: 'loop',
  };
  // The apply first (its announcement), then the error, which stays in view.
  app._handleSceneOutlineCommand({ ...command, outlineFormKey: undefined });
  await Promise.resolve();
  app._handleSceneOutlineCommand({ ...command, dotCount: 'x' });
  app.skipToStart();
  await Promise.resolve();
  return { app, announced, toasts };
}

describe('every word the app shows is sentence case (UI-06 B-15)', () => {
  test('the shell, with the strings the app builds as it is used, and what it says meanwhile', async () => {
    const { app, announced, toasts } = await populatedApp();
    try {
      const strings = stringsIn(document.body);
      for (const message of announced) strings.push({ what: 'announcement', text: message, hint: 'prose' });
      for (const message of toasts) strings.push({ what: 'toast', text: message, hint: 'prose' });
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
      // The prose was there to read: the banner's words, the weight error, the
      // outline's error, and what was said.
      const prose = strings.filter(string => string.hint === 'prose').map(string => string.text);
      expect(prose.some(text => /click places a linked node/.test(text))).toBe(true);
      expect(prose.some(text => /^Enter a weight of 0\.01 or more/.test(text))).toBe(true);
      expect(prose.some(text => /^Count\b/.test(text))).toBe(true);
      expect(announced).toContain('Crowd updated.');
      expect(announced.some(text => /^Editing the network/.test(text))).toBe(true);
      expect(announced).toContain('Skipped to start');
      expect(toasts.some(text => /^Deleted path/.test(text))).toBe(true);
      expect(strings.filter(string => string.what === 'prose').length).toBeGreaterThan(40);

      expect(faultsIn(strings)).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });

  test('no stylesheet rule the words PR cleared sets text-transform: uppercase, and the badge says Preview', () => {
    const css = ['styles/main.css', 'styles/dropdown.css']
      .map(file => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim(), body]);
    const cleared = ['.section-title', '.controls-category h4', '.dropdown-submenu-label', '.control-group h3'];
    // The rules are there to check, and none of them transforms its case.
    for (const selector of cleared) {
      const found = rules.filter(([text]) => text.split(',').map(each => each.trim()).includes(selector));
      expect(found.length, `${selector} is styled`).toBeGreaterThan(0);
      expect(found.filter(([, body]) => /text-transform\s*:\s*uppercase/.test(body)).map(([text]) => text)).toEqual([]);
    }
    const badge = rules.find(([text]) => text === 'body[data-mode="preview"]::after');
    expect(badge?.[1]).toMatch(/content:\s*'Preview'/);
    expect(css).not.toMatch(/content:\s*'PREVIEW'/);
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
    // A capital after an opening parenthesis is Title Case too, unless a name.
    expect(hintFault('1080×1080 (Square)')).toMatch(/capital after an opening parenthesis "\(Square\)"/);
    expect(hintFault('1080×1080 (square)')).toBeNull();
    expect(hintFault('Export the route (MP4 or WebM)')).toBeNull();
    expect(hintFault('Made with Route Plotter (UoN)')).toBeNull();
    expect(hintFault('Create animated routes with Route Plotter')).toBeNull();
    // Prose: sentence case, and none of the words the glossary retired.
    expect(proseFault('Network editing — click the map to place linked nodes.')).toBeNull();
    expect(retiredWord('Network editing — click the map to place linked nodes.')).toMatch(/retired word Network editing/);
    expect(retiredWord('Deleted edge — press Ctrl+Z to undo')).toMatch(/retired word/);
    expect(retiredWord('Primary emitter updated.')).toMatch(/retired word/);
    expect(retiredWord('Release start must be a number')).toMatch(/retired word/);
    expect(retiredWord('0% is the image’s left edge, 100% its right edge')).toBeNull();
    expect(retiredWord('Deleted path — press Ctrl+Z to undo')).toBeNull();
    expect(retiredWord('Editing the network — click the map to place linked nodes.')).toBeNull();
  });
});

/**
 * CROWD-07 F8 — the crowd's words, one per concept, wherever the author reads
 * them. PR 1 applied the glossary; what is pinned here is what it left as
 * prose or as two lists that could drift: the outline's "At journey end"
 * options against the card's (one select definition each), the Guide
 * helper's count of paths, and the strings this PR adds to Crowd scope (the
 * Size readout, the "At journey end" hint, the Guide's journey line), held to
 * the sentence-case rule and the retired words.
 */
describe('the crowd’s words agree (CROWD-07 F8)', () => {
  async function crowdApp() {
    const app = await bootApp();
    await app.ready;
    document.getElementById('splash-close').click();
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    app.addCrowd({ enterNetworkEditor: false });
    return app;
  }

  test('the outline’s "At journey end" options are the card’s, value for value', async () => {
    const app = await crowdApp();
    try {
      const card = [...document.querySelectorAll('#crowd-lifecycle option')]
        .map(option => [option.value, visibleText(option)]);
      app._refreshSceneOutline();
      await Promise.resolve();
      await openWholeOutline(document.getElementById('scene-outline'));
      const selects = [...document.querySelectorAll('#scene-outline select[name="lifecycleMode"]')];
      expect(selects).toHaveLength(1);
      const outline = [...selects[0].options].map(option => [option.value, visibleText(option)]);

      expect(card.map(([value]) => value).sort()).toEqual(['collect', 'disappear', 'loop', 'respawn']);
      expect(outline.map(([value]) => value).sort()).toEqual(card.map(([value]) => value).sort());
      expect(Object.fromEntries(outline)).toEqual(Object.fromEntries(card));
    } finally {
      app.interactionHandler.destroy();
    }
  });

  // One description for one control wherever it appears (the owner, 2026-10-09):
  // the outline's field says what the Motion card's F6 hint says, word for word.
  test('the outline’s "At journey end" hint is the card’s, word for word', async () => {
    const app = await crowdApp();
    try {
      const card = document.querySelector('label[for="crowd-lifecycle"] [data-tip]').getAttribute('data-tip');
      app._refreshSceneOutline();
      await Promise.resolve();
      await openWholeOutline(document.getElementById('scene-outline'));
      const selects = [...document.querySelectorAll('#scene-outline select[name="lifecycleMode"]')];
      expect(selects).toHaveLength(1);
      const outline = selects[0].closest('label').querySelector('[data-tip]').getAttribute('data-tip');

      expect(card).toMatch(/^Disappear removes a dot at its journey's end; .* Repeat journey replays the same walk exactly$/);
      expect(outline).toBe(card);
    } finally {
      app.interactionHandler.destroy();
    }
  });

  test('the Guide helper counts paths, never edges, and the crowd strings this PR adds keep the rule', async () => {
    const app = await crowdApp();
    try {
      const layer = app.selectedCrowd;
      const helper = () => document.getElementById('crowd-guide-hint').textContent;
      const said = [helper()];
      layer.setGuideType('graph');
      app.syncCrowdEditor();
      said.push(helper());
      const [a, b] = [[0.2, 0.2], [0.8, 0.2]].map(([x, y]) => layer.graph.addNode({ x, y }));
      layer.graph.addEdge({ sourceId: a.id, targetId: b.id, direction: 'two-way' });
      app.updateGuideCard();
      said.push(helper());
      expect(helper()).toMatch(/\(2 nodes, 1 path\)/);
      const c = layer.graph.addNode({ x: 0.5, y: 0.8 });
      layer.graph.addEdge({ sourceId: b.id, targetId: c.id, direction: 'one-way' });
      app.updateGuideCard();
      said.push(helper());
      expect(helper()).toMatch(/\(3 nodes, 2 paths\)/);
      expect(said.filter(text => /\b(edge|edges|link|links)\b/i.test(text))).toEqual([]);

      // The crowd's own strings, read as the rule reads the shell, with the readout as it is shown.
      const scope = document.getElementById('crowd-scope');
      const strings = [...stringsIn(scope), ...said.map(text => ({ what: 'Guide helper', text, hint: 'prose' }))];
      const size = document.getElementById('crowd-dot-size-value').textContent;
      strings.push({ what: 'Size readout', text: size, hint: 'prose' });
      const texts = strings.map(string => string.text);
      expect(size).toBe('8 reference px');
      expect(texts.some(text => /^Disappear removes a dot at its journey's end;/.test(text))).toBe(true);
      expect(texts.some(text => /Journeys start at Entry nodes and end at Exit nodes/.test(text))).toBe(true);
      expect(texts.some(text => /exports scale it from the project's reference short edge$/.test(text))).toBe(true);
      expect(faultsIn(strings)).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });
});
