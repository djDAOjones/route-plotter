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
import { afterEach, describe, test, expect, vi } from 'vitest';
import { HTMLExportService } from '../src/services/HTMLExportService.js';
import { bootApp, tipSeen } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { lex, lexedFiles, lineAt } from './helpers/sourceScan.js';
import { TOOLTIPS } from '../src/config/tooltips.js';

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
  // UI-06 low items: a drawn area and its corners, the Area card's words.
  /\bpolygons?\b/i, /\bvertex\b/i, /\bvertices\b/i,
  // The glossary's spelling is "centre" (PR 7 made Help's so; the lead's addendum to PR 8 the rest).
  /\bcenter\b/i,
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
 * Key names, as `src/config/keybindings.js` writes them (MODIFIER_DISPLAY,
 * formatKey): the Mac's modifier symbols and elsewhere words, Esc, Del, Home,
 * End, Space, the arrows; with Enter and Tab. A letter, a digit or a symbol is
 * a key by itself. Not ALLOWED_WORDS, which holds names a chord never joins
 * (Codex r1: "Earlier+Later" passed for one).
 */
const KEY_NAMES = new Set([
  '⌘', '⇧', '⌥', '⌃', 'Ctrl', 'Alt', 'Shift', 'Esc', 'Del', 'Home', 'End', 'Space', 'Enter', 'Tab',
  '↑', '↓', '←', '→',
]);

/** A shortcut written as keys joined by "+" ("Ctrl+Shift+Z"): each part a key's name or a single key. */
const isChord = word => word.includes('+') && word.split('+').every(part => KEY_NAMES.has(part) || part.length === 1);

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
    // A shortcut ("(Ctrl+Shift+Z)", UI-06 G-10) is keys, each a key's name.
    if (/^\([A-Z]/.test(token) && !ALLOWED_WORDS.has(bare(token)) && !isChord(bare(token))) {
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
  // Help's rows: each action is the `dd` its key's `dt` pairs with (UI-06 J-01 round 4: it was a span).
  for (const row of root.querySelectorAll('.control-item > dd, .inline-shortcut > span')) {
    add('help row', visibleText(row));
  }
  for (const tip of root.querySelectorAll('[data-tip]')) add('hint', tip.getAttribute('data-tip'), true);
  for (const tip of root.querySelectorAll('[data-label-tip]')) add('hint', tip.getAttribute('data-label-tip'), true);
  // Prose the app shows: banners, helper lines, reasons, errors, dialogs, toasts.
  // UI-06 PR 6: every banner the slot below the header shows (it read the network's alone).
  const PROSE = ['#mode-banner .banner-text', '#mode-banner .banner-count', '.section-hint',
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

  app.addCrowd();
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
    dotCount: '15', releaseStart: '10', releaseDuration: '70', onsetVariance: '20',
    // Release bias as the outline sends it since CROWD-07 F15 (reason: a direction and an amount, not −25).
    intensityRampDirection: 'earlier', intensityRampAmount: '25',
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

  test('every banner the slot below the header shows, in turn: its words are sentence case, its glossary words the glossary\'s (UI-06 PR 6)', async () => {
    const { app, announced } = await populatedApp();
    try {
      const shows = [
        ['network-edit-banner', () => {}],
        ['area-draw-banner', () => app.areaDrawingService.startDrawing(app.waypoints[0])],
        ['branch-banner', () => app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] })],
        // Shown as its timer shows it, on a first start once the welcome has gone.
        ['preview-tip-banner', () => {
          app.eventBus.emit('route:branch-cancel');
          app._previewTip = { timer: null, stopWaiting: null, expiry: null, owner: null, over: false };
          app._offerPreviewTip();
        }],
      ];
      for (const [id, show] of shows) {
        show();
        await Promise.resolve();
        expect(document.getElementById(id), id).not.toBeNull();
        const strings = stringsIn(document.getElementById('mode-banner'));
        // Vacuous unless its words and its button were read.
        expect(strings.filter(string => string.hint === 'prose').length, id).toBeGreaterThan(0);
        expect(strings.filter(string => string.what === 'button').length, id).toBe(1);
        expect(faultsIn(strings), id).toEqual([]);
      }
      const said = announced.map(text => ({ what: 'announcement', text, hint: 'prose' }));
      expect(announced).toContain('Drawing an area — Click to place corners. Click near the first point to close. Escape to cancel.');
      expect(faultsIn(said)).toEqual([]);
      app._stopPreviewTip();
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
    // The badge is a real element now, its word its text (UI-06 J-12): it was the `::after` rule's `content`.
    const shell = new DOMParser().parseFromString(readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'), 'text/html');
    expect(shell.getElementById('preview-badge')?.textContent).toBe('Preview');
    expect(rules.some(([text]) => text.includes('.preview-badge'))).toBe(true);
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
    // Stricter (UI-06 B-15): "Major" mid-label is Title Case now; running text says "major waypoint".
    expect(labelFault('After Major waypoint 1 — Alpha')).toMatch(/"Major" is capitalised/);
    expect(labelFault('After major waypoint 1 — Alpha')).toBeNull();
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
    // A shortcut in parentheses is keys, not Title Case (UI-06 G-10); a word that is not a key still is.
    expect(hintFault('Redo what you undid (Ctrl+Shift+Z)')).toBeNull();
    expect(hintFault('Redo what you undid (Control+Shift+Z)')).toMatch(/capital after an opening parenthesis/);
    // Keys, not words that may keep a capital elsewhere (Codex r1): a name or a readout word joined by "+" is no chord.
    expect(isChord('Ctrl+Shift+Z')).toBe(true);
    expect(isChord('⌘+⇧+Z')).toBe(true);
    expect(isChord('Earlier+Later')).toBe(false);
    expect(isChord('Nervous+System')).toBe(false);
    expect(hintFault('Compare (Earlier+Later)')).toMatch(/capital after an opening parenthesis "\(Earlier\+Later\)"/);
    expect(hintFault('Use (Nervous+System)')).toMatch(/capital after an opening parenthesis "\(Nervous\+System\)"/);
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
 * UI-06 J-01: Help is a dialog of its own. Its words are held to the rule as
 * the shell's are, and its five crowd lines are the owner's (2026-10-09,
 * "These five lines (Recommended)"), shipped as written, one paragraph each.
 * They quote option names in parentheses ("(Follow route)"), which the
 * parenthesis check exists to catch in a label, so they are held word for
 * word instead; and each bold label is the live control's own text, so a
 * later rename of the control fails here.
 */
const CROWD_LINES = [
  'Under Layers, click + Add crowd. Its Guide starts as Follow route, so the dots walk your route.',
  "A crowd's Guide is what its dots walk along: your route (Follow route) or a network of its own (Custom network).",
  'To draw a network, set the Guide to Custom network and click Edit network: nodes joined by paths.',
  "Trace route into network copies your route into the crowd's network, so it splits and rejoins where the route does.",
  'At journey end decides what a dot does when it finishes: Respawn at the start, Repeat journey, Disappear or ' +
    "Collect at the end. It is in the crowd's Motion card.",
];

/** Each line's bold label, and the live control whose own text it must be. */
const CROWD_LABELS = [
  ['+ Add crowd', '#add-crowd-btn'],
  ['Guide', 'label[for="crowd-guide-type"] > span'],
  ['Edit network', '#network-edit-btn'],
  ['Trace route into network', '#crowd-trace-route-btn'],
  ['At journey end', 'label[for="crowd-lifecycle"] > span'],
];

describe("Help's words (UI-06 J-01)", () => {
  test('Help, open: its headings, rows, buttons and lines are sentence case; its crowd lines are the owner\'s, each bold label the control\'s own text', async () => {
    const app = await bootApp();
    await app.ready;
    // The first start's welcome holds focus until it is put away.
    document.getElementById('splash-close').click();
    document.getElementById('help-btn').click();
    const modal = document.getElementById('help-modal');
    try {
      expect(modal.style.display).toBe('flex');
      const strings = stringsIn(modal);
      const count = what => strings.filter(string => string.what === what).length;
      // Vacuous unless the dialog was there to read.
      expect(count('h2')).toBe(1);
      expect(count('h3')).toBe(4);
      expect(count('h4')).toBe(4);
      expect(count('help row')).toBeGreaterThan(30);
      // Every action in the grid is read: each `dd`, none left out by the selector (UI-06 J-01 round 4).
      expect(count('help row')).toBe(modal.querySelectorAll('.controls-grid dd').length);
      expect(count('prose')).toBeGreaterThan(5);
      expect(strings.filter(string => string.what === 'button').map(string => string.text))
        .toEqual(['×', 'Report a bug', 'Show the welcome again']);
      expect(faultsIn(strings)).toEqual([]);

      const lines = [...modal.querySelectorAll('#help-crowds p')];
      expect(lines.map(line => line.textContent.replace(/\s+/g, ' ').trim())).toEqual(CROWD_LINES);
      expect(lines.map(line => [...line.querySelectorAll('strong')].map(bold => bold.textContent)))
        .toEqual(CROWD_LABELS.map(([label]) => [label]));
      for (const [label, control] of CROWD_LABELS) {
        expect(visibleText(document.querySelector(control)), control).toBe(label);
      }
    } finally {
      document.getElementById('help-close-x').click();
      app.interactionHandler.destroy();
    }
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
    app.addCrowd();
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

      expect(card).toMatch(/^Disappear removes a dot at its journey's end; .* Repeat journey follows the same paths again at the same pace$/);
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
      // The readout is the number field and its unit since DEF-86 (reason: read with the field's value).
      const readout = document.getElementById('crowd-dot-size-value');
      const size = `${readout.querySelector('input').value}${readout.textContent}`.replace(/\s+/g, ' ').trim();
      strings.push({ what: 'Size readout', text: size, hint: 'prose' });
      const texts = strings.map(string => string.text);
      expect(size).toBe('8 reference px');
      expect(texts.some(text => /^Disappear removes a dot at its journey's end;/.test(text))).toBe(true);
      expect(texts.some(text => /Journeys start at entry nodes and end at exit nodes/.test(text))).toBe(true);
      expect(texts.some(text => /exports scale it from the project's reference short edge$/.test(text))).toBe(true);
      expect(faultsIn(strings)).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });
});

describe('the glossary spells it centre (UI-06, the lead\'s addendum to PR 8)', () => {
  /**
   * Every string or template text in src/ that says "center" as a word: a
   * user-facing one, unless it is a CSS keyword, an event's name or an
   * internal key. Read as code (`lex`), so a comment is never one.
   */
  /**
   * What lets a lower-case "center" through, and nothing else does (Codex r1:
   * a colon or a string of its own let prose through): a CSS declaration in a
   * string or template ("text-align: center", "background-position: left
   * center"); a string of its own assigned to a style property in code
   * (`ctx.textAlign = 'center'`, `{ alignItems: 'center' }`); part of a name
   * ("waypoint:add-at-center"); or the area handle's key, a string of its own
   * given or compared as a `type` or `dragTarget` (AreaEditService).
   */
  const CSS_DECLARED = new RegExp(String.raw`\b(?:text-align|align-items|justify-content|transform-origin|`
    + String.raw`background-position|object-position|place-[a-z]+)\s*:\s*(?:[\w%.-]+\s+)*$`);
  const CSS_ASSIGNED = new RegExp(String.raw`\b(?:textAlign|alignItems|justifyContent|transformOrigin|`
    + String.raw`backgroundPosition|objectPosition|place[A-Z]\w*)\s*[:=]\s*$`);
  const HANDLE_KEY = /\b(?:type|dragTarget)\s*(?::|={1,3}|!==?)\s*$/;

  function centerStringsInLexed(file, lexed) {
    const found = [];
    const { source, code, kind } = lexed;
    for (let start = 0; start < source.length;) {
      if (kind[start] !== 's' && kind[start] !== 't') { start += 1; continue; }
      let end = start;
      while (end < source.length && kind[end] === kind[start]) end += 1;
      const words = source.slice(start, end).replace(/^['"`]|['"`]$/g, '');
      const codeBefore = code.slice(Math.max(0, start - 80), start);
      const alone = words.trim() === 'center';
      for (const match of words.matchAll(/\bcenter\b/gi)) {
        const before = words.slice(0, match.index);
        const after = words.slice(match.index + match[0].length);
        const internal = match[0] === 'center' && (
          CSS_DECLARED.test(before)
          || (alone && (CSS_ASSIGNED.test(codeBefore) || HANDLE_KEY.test(codeBefore)))
          || /[\w-]$/.test(before) || /^[\w-]/.test(after)
        );
        if (!internal) found.push(`${file}:${lineAt(source, start + 1 + match.index)}: ${words.trim().slice(0, 80)}`);
      }
      start = end;
    }
    return found;
  }

  function centerStringsIn(root) {
    return lexedFiles(root, 'src').flatMap(({ file, lexed }) => centerStringsInLexed(file, lexed));
  }

  /** The census on a fixture: what it would report for a file holding `source`. */
  const centerFixture = source => centerStringsInLexed('fixture.js', lex(source));

  test('no string src/ shows or says spells "center"', () => {
    expect(centerStringsIn(resolve(process.cwd()))).toEqual([]);
    expect(TOOLTIPS.waypoint_add).toBe('Add a new waypoint at the centre of the map');
  });

  test('the census reads prose as prose, and lets only CSS and names through (Codex r1)', () => {
    // Prose, however it is punctuated: a word alone, or after a colon.
    expect(centerFixture("label.textContent = 'Center';")).toHaveLength(1);
    expect(centerFixture("hint.textContent = 'Position: center';")).toHaveLength(1);
    expect(centerFixture("announce(`Centred? No: center ${x}`);")).toHaveLength(1);
    expect(centerFixture("button.textContent = 'center';")).toHaveLength(1);
    // CSS: a declaration in a string or a template, or a style property assigned in code.
    expect(centerFixture("const css = `.a { text-align: center; align-items: center; justify-content: center; }`;"))
      .toEqual([]);
    expect(centerFixture("const css = '.a { background-position: left center; place-items: center; }';")).toEqual([]);
    expect(centerFixture("ctx.textAlign = 'center'; el.style.alignItems = 'center';")).toEqual([]);
    expect(centerFixture("Object.assign(el.style, { justifyContent: 'center', transformOrigin: 'center' });"))
      .toEqual([]);
    // Names: an event or a key, and the area handle's.
    expect(centerFixture("bus.emit('waypoint:add-at-center');")).toEqual([]);
    expect(centerFixture("if (this.dragTarget === 'center') return { type: 'center' };")).toEqual([]);
  });

  test('a waypoint added at the centre says so', async () => {
    const app = await bootApp();
    try {
      await app.ready;
      document.getElementById('splash-close').click();
      const said = [];
      vi.spyOn(app, 'announce').mockImplementation(message => said.push(message));
      app.eventBus.emit('waypoint:add-at-center');
      expect(said).toContain('Waypoint added at centre');
      expect(said.map(retiredWord).filter(Boolean)).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });
});

/**
 * CROWD-07 PR 5b's words, each held to the rules the shell's are: the
 * no-route announcement and the empty-network helper (X-02), a slider's
 * reason and each number field's error (DEF-86), the seed's error and what
 * a seed typed says (F16), the outline's Release bias (F15) and its Even
 * reason [Q9], and the Node card's title (X-05).
 */
describe('the words PR 5b adds keep the rules (CROWD-07)', () => {
  // The storage reader the test installs goes with it: the next test reads as it did before (Codex r1 #6).
  let reader = null;
  afterEach(() => {
    if (reader) localStorage.getItem.mockImplementation(reader);
    reader = null;
  });

  test('announcements, helper lines, reasons, errors, labels and titles: sentence case, no retired word', async () => {
    // The test hears what is announced: the start's tip, on the real clock, must not land in it.
    reader = localStorage.getItem.getMockImplementation() ?? (() => null);
    localStorage.getItem.mockImplementation(tipSeen(reader));
    const app = await bootApp();
    try {
      await app.ready;
      const announced = [];
      vi.spyOn(app, 'announce').mockImplementation((message) => { announced.push(message); });
      document.getElementById('splash-close').click();
      const strings = [];
      const prose = (what, text) => strings.push({ what, text, hint: 'prose' });

      // No route: + Add crowd says how to draw the crowd's network, and the helper names Edit network.
      document.getElementById('add-crowd-btn').click();
      prose('Guide helper', document.getElementById('crowd-guide-hint').textContent);
      expect(announced.some(text => /^Crowd 1 added — press Edit network/.test(text))).toBe(true);

      expect(await loadSnapshot(app, {
        coordVersion: 9,
        waypoints: [{ id: 'a', imgX: 0.2, imgY: 0.3, isMajor: true, name: 'Main entrance' },
          { id: 'b', imgX: 0.7, imgY: 0.6, isMajor: true }],
        scene: { flowLayers: [
          { id: 'big', name: 'Crowd 1', guideType: 'graph', emitters: [{ id: 'e', dotCount: 1000, speed: 0.4 }],
            graph: { nodes: [{ id: 'n1', x: 0.2, y: 0.3, label: 'Main entrance' }, { id: 'n2', x: 0.7, y: 0.6 }],
              edges: [{ id: 'p', sourceId: 'n1', targetId: 'n2', weight: 24 }] } },
          { id: 'other', name: 'Crowd 2', guideType: 'route', emitters: [{ id: 'f', dotCount: 5000 }] },
          { id: 'third', name: 'Crowd 3', guideType: 'route', emitters: [{ id: 'g', dotCount: 5000 }] },
          { id: 'fourth', name: 'Crowd 4', guideType: 'route', emitters: [{ id: 'h', dotCount: 5000 }] },
          { id: 'fifth', name: 'Crowd 5', guideType: 'route', emitters: [{ id: 'i', dotCount: 3000 }] },
        ] },
      })).toBe(true);
      const layer = app.scene.getFlowLayer('big');
      app.eventBus.emit('crowd:selected', layer);
      prose('slider reason', document.getElementById('crowd-count-reason').textContent);
      // Each field's error, and the budget's.
      const type = (id, value) => {
        const field = document.getElementById(id);
        field.value = value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return document.getElementById(id === 'crowd-seed-value' ? 'crowd-seed-error' : `${id}-error`).textContent;
      };
      for (const id of ['crowd-dot-size', 'crowd-wobble', 'crowd-count', 'crowd-release-start', 'crowd-release-duration',
        'crowd-onset-variance', 'crowd-intensity-ramp', 'crowd-speed', 'crowd-speed-variance']) {
        prose(`${id} error`, type(`${id}-field`, ''));
      }
      prose('budget error', type('crowd-count-field', '5000'));
      prose('seed error', type('crowd-seed-value', '-1'));
      type('crowd-seed-value', '42');
      expect(announced).toContain('Crowd 1 pattern seed set to 42. Undo is available.');
      // The Node card's title, named and not; the Path card's weight, its reason and its error.
      // The rule judges the app's words: the author's name for the node, its middle part, is theirs.
      const titles = [];
      for (const nodeId of ['n1', 'n2']) {
        app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'node', layerId: layer.id, nodeId });
        titles.push(document.getElementById('node-section-title').textContent);
      }
      for (const title of titles) {
        strings.push({ what: 'Node title', text: title.replace('Main entrance', 'name') });
      }
      expect(titles).toEqual(['Node · Main entrance · pass-through', 'Node 2 · pass-through']);
      app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'edge', layerId: layer.id, edgeId: 'p' });
      prose('Share reason', document.getElementById('network-edge-weight-reason').textContent);
      prose('weight error', type('network-edge-weight-field', '0'));
      strings.push(...stringsIn(document.getElementById('edge-scope')));
      // The outline's Release bias, Even chosen.
      app._refreshSceneOutline();
      await Promise.resolve();
      await openWholeOutline(document.getElementById('scene-outline'));
      const form = document.querySelector('#scene-outline form[data-outline-action="update-emitter"]');
      form.elements.intensityRampDirection.value = 'even';
      form.elements.intensityRampDirection.dispatchEvent(new Event('change', { bubbles: true }));
      strings.push(...stringsIn(form));
      for (const message of announced) prose('announcement', message);

      const texts = strings.map(string => string.text);
      // Full stops, as the card's other reason lines end; the Even reason in the bias's own words, "share" being
      // the Path card's (the lead's settlements, round 2).
      expect(texts).toContain('Beyond the slider\'s reach — use the number field.');
      expect(texts).toContain('Even favours neither end.');
      expect(texts).toContain('Seed is a whole number from 0 to 4294967295.');
      expect(texts).toContain('The whole scene supports at most 20000 configured dots.');
      // Nine crowd fields' errors and the weight's, each in its line and said once.
      expect(new Set(texts.filter(text => /^Enter .+ until you do\.$/.test(text))).size).toBe(10);
      expect(texts).toContain('Release bias amount (%)');
      expect(faultsIn(strings)).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });
});
