/**
 * TST-13 — the key table: what Help says each shortcut does, against what
 * pressing it does in the booted app, and every key listener the app adds.
 *
 * Help renders `DEFAULT_BINDINGS` (`src/config/keybindings.js`), but that
 * table drives nothing. `InteractionHandler.handleKeyDown` and its pointer
 * transaction do, and the two had drifted: DEF-21 corrected the worst of the
 * text, and CON-15 will make one table drive both. Until then this file pins
 * both sides:
 *
 * - Help as it renders: the 31 rows of its "All Keyboard Shortcuts" list, by
 *   category, with their chords and descriptions, and the lines of its prose
 *   that name a chord. 36 bindings are configured; the five Help leaves out
 *   are named here with why, as are the three alternative keys it never shows;
 * - the chord each Help entry gives, its key or gesture (click or drag) and
 *   its modifiers, as a reviewed table of its own, apart from what the
 *   dispatcher is found to accept, so a dispatcher that accepts more cannot
 *   hide a change to Help;
 * - every Help entry, pressed or clicked as Help says, and what it changed;
 * - the event each entry names against the event its key sends: 18 of the 36
 *   name an event nothing listens to, and K names one it does not send. The
 *   names are pinned exactly;
 * - every key the page's shortcuts react to, and the modifiers they accept,
 *   each either in Help or listed here with the reason it is not;
 * - every modifier click and drag on the canvas, and the cursor each modifier
 *   shows while it is held;
 * - where a key must be pressed for a shortcut to run (DEF-13);
 * - every keydown, keyup and keypress listener in `src/`, found by reading
 *   the source: each has a row here that presses its keys and records what
 *   they did, or names the suite that does.
 *
 * The keys probed are a bounded domain: every printable US character, and
 * every named key of the UI Events key list, F1 to F24 included, under all
 * sixteen combinations of Shift, Ctrl, Alt and Meta. The dispatcher compares
 * `event.key` with literals, so a key outside that domain can only reach it
 * through a literal; a source check holds every literal it tests for, and
 * every property of the event it reads, to what the probe sends.
 *
 * Keys go to `document.body`: the canvas takes no focus, so once a user has
 * clicked it, that is where their keys land. What changed is read back as the
 * user meets it: the route, the selection, the transport, the zoom, an open
 * dialog, a toast and what the live region said. Rows that pin behaviour a
 * proposed defect would change say so; fixing one means updating its row.
 * These are untrusted events in jsdom: they show what the page's handlers do
 * with a key that reaches them, not which keys an operating system or a
 * browser lets through to the page.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { formatBinding, getDefaultBindings, isMac, MODIFIER_DISPLAY } from '../src/config/keybindings.js';
import { bootApp } from './helpers/bootApp.js';
import { bodyOf, callsOf, closing, lex, lexedFiles, literalValue } from './helpers/sourceScan.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const { mouse: MOUSE, keyboard: KEYBOARD } = getDefaultBindings();

// ---------------------------------------------------------------------------
// The editor a user has in front of them
// ---------------------------------------------------------------------------

const running = [];
const flashedSections = [];

/** The dialogs a key can open, and the button that closes each. */
const DIALOGS = [['share-disclosure-modal', 'share-disclosure-cancel'], ['splash', 'splash-close']];

afterEach(async () => {
  // An open dialog keeps its focus trap on `window`, where it would take the
  // next test's Tab and Escape: close it as a user would.
  for (const [dialog, close] of DIALOGS) {
    if (document.getElementById(dialog)?.style.display === 'flex') document.getElementById(close).click();
  }
  await Promise.resolve();
  // bootApp stops each app, but its key listener stays on `document`, and an
  // earlier app's handler would claim the next app's keys first. So would a
  // modal tool left open, whose capture-phase listener takes Escape: close
  // each as a user would.
  for (const app of running.splice(0)) {
    app.networkEditService.exit();
    if (app.areaDrawingService.isDrawing) app.areaDrawingService.cancelDrawing();
    app._contextMenu?.hide();
    app.interactionHandler.destroy();
  }
  flashedSections.length = 0;
  delete Element.prototype.scrollIntoView;
});

/** Three majors across the middle of the image, the middle one selected. */
const ROUTE_X = [0.25, 0.5, 0.75];
const FIRST = 'major 0.25,0.5';
const MIDDLE = 'major 0.5,0.5';
const LAST = 'major 0.75,0.5';
const START = [FIRST, MIDDLE, LAST];

/**
 * A booted editor with a three-waypoint route, the middle waypoint selected
 * and the transport paused half-way.
 *
 * The route is authored through the bus, as the other booted tests do; only
 * the key or click under test goes through the DOM.
 */
async function editor({ selected = 1, progress = 0.5 } = {}) {
  const app = await bootApp();
  running.push(app);
  await app.ready;
  // A first run opens Help, whose focus trap holds the keyboard.
  document.getElementById('splash-close').click();
  await vi.waitFor(() => expect(app.background.image).toBeTruthy());
  for (const imgX of ROUTE_X) app.eventBus.emit('waypoint:add', { imgX, imgY: 0.5, isMajor: true });
  if (selected === null) app.eventBus.emit('waypoint:deselected');
  else app.eventBus.emit('waypoint:selected', app.waypoints[selected]);
  app.eventBus.emit('ui:animation:seek', progress);
  return app;
}

/** Switch the header toggle to Edit, as a user does before working on legs. */
function switchToEdit(app) {
  document.getElementById('mode-toggle-btn').click();
  expect(app.previewMode).toBe(false);
}

/**
 * The modifier flags a binding's `modifiers` stand for on this platform:
 * `meta` is Cmd on a Mac and Ctrl elsewhere, read through the real `isMac`.
 */
function chord(modifiers) {
  return {
    shiftKey: modifiers.includes('shift'),
    altKey: modifiers.includes('alt'),
    ctrlKey: modifiers.includes('ctrl') || (!isMac && modifiers.includes('meta')),
    metaKey: isMac && modifiers.includes('meta')
  };
}

/** Characters a US layout types with Shift held, so they arrive with shiftKey set. */
const SHIFTED = new Set('~!@#$%^&*()_+{}|:"<>?');

/** A binding's key as typed: Shift capitalises a letter, and a shifted symbol carries Shift. */
function typed(key, modifiers) {
  const flags = chord(modifiers);
  if (key.length === 1 && SHIFTED.has(key)) flags.shiftKey = true;
  return [key.length === 1 && flags.shiftKey ? key.toUpperCase() : key, flags];
}

function press(key, flags = {}, target = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...flags });
  target.dispatchEvent(event);
  return event;
}

function pointer(app, type, x, y, flags = {}) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: type === 'pointerdown' ? 0 : -1,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: x,
    clientY: y,
    ...flags
  });
  app.canvas.dispatchEvent(event);
  return event;
}

/** A click at an image position (jsdom's canvas sits at the page origin). */
function click(app, [imgX, imgY], flags = {}) {
  const { x, y } = app.imageToCanvas(imgX, imgY);
  pointer(app, 'pointerdown', x, y, flags);
  pointer(app, 'pointerup', x, y, flags);
}

/** A press, a move past the drag threshold and a release, in canvas pixels. */
function drag(app, [imgX, imgY], [dx, dy], atPress = {}, whileMoving = atPress) {
  const { x, y } = app.imageToCanvas(imgX, imgY);
  pointer(app, 'pointerdown', x, y, atPress);
  pointer(app, 'pointermove', x + dx, y + dy, whileMoving);
  pointer(app, 'pointerup', x + dx, y + dy, whileMoving);
}

const round = value => Number(value.toFixed(4));
const describeWaypoint = wp => `${wp.isMajor ? 'major' : 'minor'} ${round(wp.imgX)},${round(wp.imgY)}`;

/** What a user can see or hear of the editor. Selections are held as waypoints. */
function editorState(app) {
  const open = id => document.getElementById(id)?.style.display === 'flex';
  return {
    route: app.waypoints.map(describeWaypoint),
    selected: [...app.selectedWaypoints],
    primary: app.selectedWaypoint ?? null,
    branchFrom: app.interactionHandler.branchArmed ?? null,
    playing: app.animationEngine.isPlaying(),
    speed: app.animationEngine.state.playbackSpeed,
    progress: round(app.animationEngine.getProgress()),
    zoom: round(app.viewport.zoom),
    dialog: open('splash') ? 'Help'
      : open('share-disclosure-modal') ? document.getElementById('share-disclosure-title').textContent
        : null,
    prompt: document.querySelector('#zoom-prompt.visible')?.textContent ?? null,
    toasts: [...document.querySelectorAll('#toast-container .toast')].map(toast => toast.firstChild.textContent),
    said: document.getElementById('announcer').textContent
  };
}

/** Selections change when a different waypoint is chosen, not when the chosen one moves. */
const WAYPOINT_FIELDS = new Set(['selected', 'primary', 'branchFrom']);

function sameWaypoints(a, b) {
  return Array.isArray(a)
    ? a.length === b.length && a.every((wp, index) => wp === b[index])
    : a === b;
}

/**
 * Run one user action and return what it changed, the events it put on the
 * bus (recorded, and still delivered) and whether the browser's own handling
 * was cancelled.
 */
function observe(app, act) {
  document.getElementById('announcer').textContent = '';
  const before = editorState(app);
  const emit = vi.spyOn(app.eventBus, 'emit');
  let event;
  let sent;
  try {
    event = act();
    sent = emit.mock.calls.map(([name]) => name);
  } finally {
    emit.mockRestore();
  }
  const after = editorState(app);
  const named = wp => `#${app.waypoints.indexOf(wp)} ${describeWaypoint(wp)}`;
  const changed = {};
  for (const [name, value] of Object.entries(after)) {
    if (WAYPOINT_FIELDS.has(name)) {
      if (!sameWaypoints(value, before[name])) {
        changed[name] = Array.isArray(value) ? value.map(named) : value && named(value);
      }
    } else if (name === 'toasts') {
      const added = value.slice(before.toasts.length);
      if (added.length > 0) changed.toasts = added;
    } else if (JSON.stringify(value) !== JSON.stringify(before[name])) {
      changed[name] = value;
    }
  }
  return { changed, sent, prevented: event?.defaultPrevented };
}

// ---------------------------------------------------------------------------
// The events Help names
// ---------------------------------------------------------------------------

/**
 * Help entries whose `action` is not the event their key or click sends:
 * the event the entry names (`names`, exactly as configured), the one its
 * key or click sends, and whether anything listens for the named one.
 *
 * Eighteen name an event nothing in the app listens to: the plan's "18 of 36
 * fictional actions" (SEG-023). A dispatcher driven by Help (CON-15) could not
 * use them as they stand. K's names a real event, but it is the engine's own
 * notice that playback paused; K sends the play/pause toggle Space sends.
 */
const NOT_THE_EVENT_SENT = {
  addMinorWaypoint: { names: 'waypoint:add-minor', sends: 'waypoint:add', listened: false,
    why: 'a Cmd/Ctrl-click on empty canvas sends waypoint:add with isMajor false' },
  forceAddWaypoint: { names: 'waypoint:force-add', sends: 'waypoint:add', listened: false,
    why: 'an Alt-click on empty canvas sends waypoint:add; on a waypoint it arms a branch instead' },
  forceAddMinorWaypoint: { names: 'waypoint:force-add-minor', sends: 'waypoint:add', listened: false,
    why: 'an Alt+Cmd/Ctrl-click sends waypoint:add with isMajor false, even on a waypoint' },
  selectWaypoint: { names: 'waypoint:select', sends: 'waypoint:selected', listened: false,
    why: 'a click on a waypoint sends waypoint:selected' },
  moveWaypoint: { names: 'waypoint:move', sends: 'waypoint:position-changed', listened: false,
    why: 'a drag sends waypoint:position-changed as it moves and waypoint:drag-ended on release' },
  nudgeUp: { names: 'waypoint:nudge-up', sends: 'waypoint:nudge', listened: false,
    why: 'every arrow sends waypoint:nudge with a signed step; there is no event per direction' },
  nudgeDown: { names: 'waypoint:nudge-down', sends: 'waypoint:nudge', listened: false, why: 'as nudgeUp' },
  nudgeLeft: { names: 'waypoint:nudge-left', sends: 'waypoint:nudge', listened: false, why: 'as nudgeUp' },
  nudgeRight: { names: 'waypoint:nudge-right', sends: 'waypoint:nudge', listened: false, why: 'as nudgeUp' },
  nudgeUpLarge: { names: 'waypoint:nudge-up-large', sends: 'waypoint:nudge', listened: false,
    why: 'Shift makes the same waypoint:nudge step 2% of the canvas instead of 0.5%' },
  nudgeDownLarge: { names: 'waypoint:nudge-down-large', sends: 'waypoint:nudge', listened: false,
    why: 'as nudgeUpLarge' },
  nudgeLeftLarge: { names: 'waypoint:nudge-left-large', sends: 'waypoint:nudge', listened: false,
    why: 'as nudgeUpLarge' },
  nudgeRightLarge: { names: 'waypoint:nudge-right-large', sends: 'waypoint:nudge', listened: false,
    why: 'as nudgeUpLarge' },
  playPause: { names: 'animation:toggle', sends: 'ui:animation:toggle', listened: false,
    why: 'Space sends the transport toggle, ui:animation:toggle' },
  playReverse: { names: 'animation:reverse', sends: 'animation:jkl-reverse', listened: false,
    why: 'J sends animation:jkl-reverse, which doubles the reverse speed on each press' },
  playForward: { names: 'animation:forward', sends: 'animation:jkl-forward', listened: false,
    why: 'L sends animation:jkl-forward, which doubles the speed on each press' },
  stepBackward: { names: 'animation:step-backward', sends: 'ui:animation:skip-start', listened: false,
    why: 'comma skips to the start, as Home does (the entry was "Step" until DEF-21)' },
  stepForward: { names: 'animation:step-forward', sends: 'ui:animation:skip-end', listened: false,
    why: 'full stop skips to the end, as End does (the entry was "Step" until DEF-21)' },
  playPauseK: { names: 'animation:pause', sends: 'ui:animation:toggle', listened: true,
    why: "animation:pause is the engine's notice that playback paused; K toggles as Space does" }
};

/** The pinned name check for one Help entry, from the events its press sent. */
function expectNamedEvent(app, id, binding, sent) {
  const pinned = NOT_THE_EVENT_SENT[id];
  const listened = app.eventBus.listenerCount(binding.action) > 0;
  if (pinned) {
    expect(binding.action, `the event Help names for ${id}`).toBe(pinned.names);
    expect(sent, `${id} sends ${pinned.sends}`).toContain(pinned.sends);
    expect(sent, `${id} now sends ${binding.action}: take it out of NOT_THE_EVENT_SENT`)
      .not.toContain(binding.action);
    expect(listened, `whether the app listens for ${binding.action} (${id})`).toBe(pinned.listened);
  } else {
    expect(sent, `${id} no longer sends ${binding.action}, the event Help names`).toContain(binding.action);
    expect(listened, `nothing listens for ${binding.action} (${id}) any more`).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// The chords Help gives, and Help as it renders
// ---------------------------------------------------------------------------

/**
 * The chord each keyboard entry gives, reviewed: its key and alternative
 * keys, and its modifiers. The presses below use these, not the binding, so a
 * binding that drifts fails the comparison with this table even where the
 * dispatcher, which accepts more modifiers than Help shows, would still react.
 */
const HELP_CHORDS = {
  addAtCenter: [['a'], []],
  duplicateWaypoint: [['d'], ['meta']],
  deleteSelected: [['Delete', 'Backspace'], []],
  deselectWaypoint: [['Escape'], []],
  selectAllWaypoints: [['a'], ['meta']],
  toggleWaypointType: [['t'], []],
  nudgeUp: [['ArrowUp'], []],
  nudgeDown: [['ArrowDown'], []],
  nudgeLeft: [['ArrowLeft'], []],
  nudgeRight: [['ArrowRight'], []],
  nudgeUpLarge: [['ArrowUp'], ['shift']],
  nudgeDownLarge: [['ArrowDown'], ['shift']],
  nudgeLeftLarge: [['ArrowLeft'], ['shift']],
  nudgeRightLarge: [['ArrowRight'], ['shift']],
  zoomIn: [['=', '+'], []],
  zoomOut: [['-', '_'], []],
  zoomReset: [['0'], []],
  playPause: [[' '], []],
  skipToStart: [['Home'], []],
  skipToEnd: [['End'], []],
  playReverse: [['j'], []],
  playPauseK: [['k'], []],
  playForward: [['l'], []],
  stepBackward: [[','], []],
  stepForward: [['.'], []],
  undo: [['z'], ['meta']],
  redo: [['z'], ['meta', 'shift']],
  save: [['s'], ['meta']],
  showShortcuts: [['?'], []]
};

/** The gesture and modifiers each mouse entry gives, reviewed. */
const MOUSE_CHORDS = {
  addWaypoint: ['click', []],
  addMinorWaypoint: ['click', ['meta']],
  forceAddWaypoint: ['click', ['alt']],
  forceAddMinorWaypoint: ['click', ['alt', 'meta']],
  deleteWaypoint: ['click', ['shift']],
  selectWaypoint: ['click', []],
  moveWaypoint: ['drag', []]
};

/** How Help writes each modifier: Cmd's symbols on a Mac, words elsewhere. */
const MODIFIER_TEXT = isMac
  ? { meta: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧' }
  : { meta: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', shift: '⇧' };
const { meta: META_TEXT, alt: ALT_TEXT, shift: SHIFT_TEXT } = MODIFIER_TEXT;

/**
 * Help's "All Keyboard Shortcuts & Controls", as it renders: each category's
 * rows in order, as [the entry it renders, its chord, its description].
 */
const HELP_ROWS = {
  Waypoints: [
    ['addWaypoint', 'Click', 'Add waypoint'],
    ['addMinorWaypoint', `${META_TEXT}+Click`, 'Add minor waypoint'],
    ['forceAddWaypoint', `${ALT_TEXT}+Click`, 'Force add major (bypass selection)'],
    ['forceAddMinorWaypoint', `${META_TEXT}+${ALT_TEXT}+Click`, 'Force add minor (bypass selection)'],
    ['deleteWaypoint', `${SHIFT_TEXT}+Click`, 'Delete waypoint'],
    ['selectWaypoint', 'Click', 'Select waypoint'],
    ['moveWaypoint', 'Drag', 'Move waypoint'],
    ['addAtCenter', 'A', 'Add waypoint at center'],
    ['duplicateWaypoint', `${META_TEXT}+D`, 'Duplicate selected'],
    ['deleteSelected', 'Del', 'Delete selected'],
    ['deselectWaypoint', 'Esc', 'Deselect'],
    ['selectAllWaypoints', `${META_TEXT}+A`, 'Select all waypoints'],
    ['toggleWaypointType', 'T', 'Toggle major/minor']
  ],
  Navigation: [
    ['nudgeUp', '↑', 'Nudge up'],
    ['nudgeDown', '↓', 'Nudge down'],
    ['nudgeLeft', '←', 'Nudge left'],
    ['nudgeRight', '→', 'Nudge right'],
    ['zoomIn', '=', 'Zoom in'],
    ['zoomOut', '-', 'Zoom out'],
    ['zoomReset', '0', 'Reset zoom']
  ],
  Playback: [
    ['playPause', 'Space', 'Play / Pause'],
    ['skipToStart', 'HOME', 'Go to start'],
    ['skipToEnd', 'END', 'Go to end'],
    ['playReverse', 'J', 'Play reverse'],
    ['playForward', 'L', 'Play forward'],
    ['stepBackward', ',', 'Skip to start'],
    ['stepForward', '.', 'Skip to end']
  ],
  General: [
    ['undo', `${META_TEXT}+Z`, 'Undo'],
    ['redo', `${META_TEXT}+${SHIFT_TEXT}+Z`, 'Redo'],
    ['save', `${META_TEXT}+S`, 'Save'],
    ['showShortcuts', '?', 'Show keyboard shortcuts']
  ]
};

/**
 * Configured entries Help never shows, and why. The four larger nudges say
 * "shown in full" and K says "J/K/L shown as group", but the only Help the
 * app renders leaves every hidden entry out and draws no group, so Shift with
 * an arrow, and K, are shown nowhere (proposed defect: the flags' comments
 * promise a listing nothing draws).
 */
const HIDDEN_FROM_HELP = {
  nudgeUpLarge: "hidden: true, 'shown in full', but the full list leaves hidden entries out",
  nudgeDownLarge: 'as nudgeUpLarge',
  nudgeLeftLarge: 'as nudgeUpLarge',
  nudgeRightLarge: 'as nudgeUpLarge',
  playPauseK: "hidden: true, 'J/K/L shown as group', but no group is drawn: J and L have rows, K has none"
};

/** Alternative keys an entry takes that its Help row does not show: a row shows its main key only. */
const KEYS_HELP_DOES_NOT_SHOW = { deleteSelected: ['Backspace'], zoomIn: ['+'], zoomOut: ['_'] };

/**
 * Help's prose names chords too: the splash's sections and the waypoint
 * list's Quick Start. Each line, as rendered, and the entry whose chord it
 * restates (its gesture or key, and its modifiers).
 */
const HELP_PROSE = {
  // An image file dropped on the canvas becomes the background: no binding.
  'Create Your Route': [['Drag an image onto the canvas to get started', null],
    ['Click the map to add waypoints', 'addWaypoint'],
    ['Drag waypoints to reposition them', 'moveWaypoint']],
  'Edit Points': [[`${SHIFT_TEXT}+Click a waypoint to delete it`, 'deleteWaypoint'],
    [`${META_TEXT}+Click to add a minor waypoint`, 'addMinorWaypoint'],
    [`${ALT_TEXT}+Click to force-add a major waypoint`, 'forceAddWaypoint'],
    [`${ALT_TEXT}+${META_TEXT}+Click to force-add a minor waypoint`, 'forceAddMinorWaypoint']],
  'Preview & Export': [['Space to play/pause the animation', 'playPause']],
  'Quick Start': [['Click Add waypoint', 'addWaypoint'], ['Drag Move waypoint', 'moveWaypoint'],
    [`${SHIFT_TEXT}+Click Delete`, 'deleteWaypoint'], ['Space Play/Pause', 'playPause']]
};

/** A chord as Help writes it (`⌘+⇧+Z`, `Alt+Click`), as its gesture or key and its modifiers. */
function readChord(text) {
  const parts = text.split('+');
  const key = parts.pop();
  const byText = Object.fromEntries(Object.entries(MODIFIER_TEXT).filter(([name]) => name !== 'ctrl')
    .map(([name, written]) => [written, name]));
  return [key.toLowerCase(), parts.map(part => byText[part] ?? `unknown ${part}`).sort()];
}

/** The chord a line of Help's prose names: its leading `Mod+…+Key` word. */
const proseChord = line => readChord(line.split(' ')[0]);

/** An entry's chord, as [gesture or key, sorted modifiers], from the reviewed tables. */
function reviewedChord(id) {
  if (MOUSE_CHORDS[id]) return [MOUSE_CHORDS[id][0], [...MOUSE_CHORDS[id][1]].sort()];
  const [[key], modifiers] = HELP_CHORDS[id];
  return [key === ' ' ? 'space' : key.toLowerCase(), [...modifiers].sort()];
}

describe("Help's key table (TST-13)", () => {

  test('the chords Help gives are the reviewed ones, and modifiers read as Help writes them', () => {
    expect(Object.fromEntries(Object.entries(KEYBOARD).map(([id, binding]) =>
      [id, [[binding.key, ...(binding.altKeys ?? [])], binding.modifiers]])), 'keyboard entries (HELP_CHORDS)')
      .toEqual(HELP_CHORDS);
    expect(Object.fromEntries(Object.entries(MOUSE).map(([id, binding]) => [id, [binding.key, binding.modifiers]])),
      'mouse entries: a click or a drag, and its modifiers (MOUSE_CHORDS)').toEqual(MOUSE_CHORDS);
    expect(MODIFIER_DISPLAY).toEqual(MODIFIER_TEXT);
  });

  test('Help renders 31 of the 36 configured bindings, as these rows; the five it leaves out are named', async () => {
    const app = await editor();
    press('?');
    expect(editorState(app).dialog).toBe('Help');

    const rendered = {};
    for (const category of document.querySelectorAll('#splash-help .controls-category')) {
      rendered[category.querySelector('h4').textContent] = [...category.querySelectorAll('.control-item')]
        .map(row => [row.querySelector('kbd').textContent, row.querySelector('span').textContent]);
    }
    expect(rendered, "Help's full list, as rendered (HELP_ROWS)").toEqual(Object.fromEntries(
      Object.entries(HELP_ROWS).map(([category, rows]) => [category, rows.map(([, chord, text]) => [chord, text])])));

    // Each row is the entry it says: its chord and description are that binding's.
    const rows = Object.values(HELP_ROWS).flat();
    for (const [id, chord, text] of rows) {
      const binding = MOUSE[id] ?? KEYBOARD[id];
      expect([formatBinding(binding), binding.description], `${id}'s row`).toEqual([chord, text]);
    }
    const configured = [...Object.keys(MOUSE), ...Object.keys(KEYBOARD)];
    expect(configured).toHaveLength(36);
    expect(rows).toHaveLength(31);
    expect(configured.filter(id => !rows.some(([shown]) => shown === id)).sort(), 'entries Help leaves out')
      .toEqual(Object.keys(HIDDEN_FROM_HELP).sort());
    expect(configured.filter(id => (MOUSE[id] ?? KEYBOARD[id]).hidden).sort(), 'entries marked hidden')
      .toEqual(Object.keys(HIDDEN_FROM_HELP).sort());
    expect(Object.values(HIDDEN_FROM_HELP).filter(why => !/\w/.test(why)), 'each says why').toEqual([]);
    expect(Object.fromEntries(Object.entries(KEYBOARD).filter(([, binding]) => binding.altKeys)
      .map(([id, binding]) => [id, binding.altKeys])), 'alternative keys no row shows').toEqual(KEYS_HELP_DOES_NOT_SHOW);
  });

  test("the chords Help's prose names are its entries' chords", async () => {
    const app = await editor();
    press('?');
    expect(editorState(app).dialog).toBe('Help');
    const prose = {};
    for (const section of document.querySelectorAll('#splash-help .help-section')) {
      const lines = [...section.querySelectorAll('li')].map(item => item.textContent.replace(/^Press /, ''))
        .filter(line => /^(\S+\+)?(Click|Drag|Space)\b/.test(line));
      if (lines.length > 0) prose[section.querySelector('h3').textContent] = lines;
    }
    prose['Quick Start'] = [...document.querySelectorAll('#settings-help-placeholder .inline-shortcut')]
      .map(row => `${row.querySelector('kbd').textContent} ${row.querySelector('span').textContent}`);
    expect(prose, "Help's prose, as rendered (HELP_PROSE)").toEqual(Object.fromEntries(
      Object.entries(HELP_PROSE).map(([section, lines]) => [section, lines.map(([line]) => line)])));
    for (const [line, id] of Object.values(HELP_PROSE).flat()) {
      if (id) expect(proseChord(line), `"${line}" restates ${id}`).toEqual(reviewedChord(id));
    }
  });

  test('Help configures 36 bindings, and 18 of them name an event nothing listens to', async () => {
    const app = await editor();

    // A new entry, or a renamed one, needs its row in this file.
    expect(Object.keys(MOUSE)).toEqual([
      'addWaypoint', 'addMinorWaypoint', 'forceAddWaypoint', 'forceAddMinorWaypoint',
      'deleteWaypoint', 'selectWaypoint', 'moveWaypoint'
    ]);
    expect(Object.keys(KEYBOARD)).toEqual([
      'addAtCenter', 'duplicateWaypoint', 'deleteSelected', 'deselectWaypoint', 'selectAllWaypoints',
      'toggleWaypointType', 'nudgeUp', 'nudgeDown', 'nudgeLeft', 'nudgeRight', 'nudgeUpLarge',
      'nudgeDownLarge', 'nudgeLeftLarge', 'nudgeRightLarge', 'zoomIn', 'zoomOut', 'zoomReset',
      'playPause', 'skipToStart', 'skipToEnd', 'playReverse', 'playPauseK', 'playForward',
      'stepBackward', 'stepForward', 'undo', 'redo', 'save', 'showShortcuts'
    ]);

    const unheard = Object.entries({ ...MOUSE, ...KEYBOARD })
      .filter(([, binding]) => app.eventBus.listenerCount(binding.action) === 0)
      .map(([id]) => id);
    const pinnedUnheard = Object.entries(NOT_THE_EVENT_SENT)
      .filter(([, entry]) => !entry.listened)
      .map(([id]) => id);
    expect(unheard.sort(), 'Help entries whose action nothing listens for (NOT_THE_EVENT_SENT pins them)')
      .toEqual(pinnedUnheard.sort());
    expect(unheard).toHaveLength(18);
  });

  // -------------------------------------------------------------------------
  // Every keyboard entry
  // -------------------------------------------------------------------------

  /** How the editor differs from the fixture before a press, where it must. */
  const BEFORE_PRESS = {
    zoomOut: app => { app.eventBus.emit('canvas:zoom-in'); app.eventBus.emit('canvas:zoom-in'); },
    zoomReset: app => { app.eventBus.emit('canvas:zoom-in'); app.eventBus.emit('canvas:zoom-in'); },
    redo: app => app.eventBus.emit('history:undo')
  };

  /** What each keyboard entry changed, pressed on the fixture. */
  const KEY_EFFECTS = {
    addAtCenter: {
      route: [...START, 'major 0.5,0.5'],
      selected: ['#3 major 0.5,0.5'],
      primary: '#3 major 0.5,0.5',
      said: 'Waypoint added at center'
    },
    duplicateWaypoint: {
      route: [...START, 'major 0.52,0.52'],
      selected: ['#3 major 0.52,0.52'],
      primary: '#3 major 0.52,0.52',
      said: 'Waypoint duplicated'
    },
    deleteSelected: { route: [FIRST, LAST], selected: [], primary: null, said: 'Waypoint deleted' },
    deselectWaypoint: { selected: [], primary: null, said: 'Selection cleared' },
    selectAllWaypoints: {
      selected: ['#0 major 0.25,0.5', '#1 major 0.5,0.5', '#2 major 0.75,0.5'],
      said: 'All waypoints selected'
    },
    toggleWaypointType: { route: [FIRST, 'minor 0.5,0.5', LAST], said: 'Converted to minor waypoint' },
    // 0.5% of the canvas at 1× zoom, 2% with Shift; the image fills the canvas.
    nudgeUp: { route: [FIRST, 'major 0.5,0.495', LAST] },
    nudgeDown: { route: [FIRST, 'major 0.5,0.505', LAST] },
    nudgeLeft: { route: [FIRST, 'major 0.495,0.5', LAST] },
    nudgeRight: { route: [FIRST, 'major 0.505,0.5', LAST] },
    nudgeUpLarge: { route: [FIRST, 'major 0.5,0.48', LAST] },
    nudgeDownLarge: { route: [FIRST, 'major 0.5,0.52', LAST] },
    nudgeLeftLarge: { route: [FIRST, 'major 0.48,0.5', LAST] },
    nudgeRightLarge: { route: [FIRST, 'major 0.52,0.5', LAST] },
    // Zoom steps by 1.5×, centred on the selection; out and reset start at 2.25×.
    zoomIn: { zoom: 1.5 },
    zoomOut: { zoom: 1.5 },
    zoomReset: { zoom: 1 },
    playPause: { playing: true, said: 'Playing animation' },
    skipToStart: { progress: 0, said: 'Animation reset' },
    skipToEnd: { progress: 1 },
    playReverse: { playing: true, speed: -1, said: 'Playing animation' },
    playPauseK: { playing: true, said: 'Playing animation' },
    playForward: { playing: true, said: 'Playing animation' },
    stepBackward: { progress: 0, said: 'Animation reset' },
    stepForward: { progress: 1 },
    // The fixture's last add is the newest undo step. Undo rebuilds the
    // waypoints, so the selection moves to the rebuilt middle one.
    undo: { route: [FIRST, MIDDLE], selected: ['#1 major 0.5,0.5'], primary: '#1 major 0.5,0.5', said: 'Undo' },
    redo: { route: START, selected: ['#2 major 0.75,0.5'], primary: '#2 major 0.75,0.5', said: 'Redo' },
    save: { dialog: 'Save project file?' },
    showShortcuts: { dialog: 'Help' }
  };

  /**
   * One row per key an entry takes: its key, then each alternative key, with
   * the reviewed chord's modifiers (HELP_CHORDS), not the binding's own.
   */
  const KEY_PRESSES = Object.entries(HELP_CHORDS).flatMap(([id, [keys, modifiers]]) =>
    keys.map(key => [id, formatBinding({ ...KEYBOARD[id], key, modifiers }), key, modifiers]));

  test.each(KEY_PRESSES)('%s (%s) does what the table pins', async (id, shown, key, modifiers) => {
    const app = await editor();
    BEFORE_PRESS[id]?.(app);
    const binding = KEYBOARD[id];
    const [asTyped, flags] = typed(key, modifiers);

    const { changed, sent, prevented } = observe(app, () => press(asTyped, flags));

    expect(changed, `what ${shown} changed (KEY_EFFECTS.${id})`).toEqual(KEY_EFFECTS[id]);
    // Every Help key keeps the browser out: no page scroll, no Save dialog.
    expect(prevented, `${shown} cancels the browser's own handling`).toBe(true);
    expectNamedEvent(app, id, binding, sent);
  });

  // -------------------------------------------------------------------------
  // Every modifier click on the canvas
  // -------------------------------------------------------------------------

  /** Where a click lands. Legs are only clickable in Edit mode. */
  const PLACES = {
    'empty canvas': { at: [0.1, 0.2] },
    'a waypoint': { at: [0.25, 0.5] },
    'a leg': { at: [0.3, 0.5], edit: true },
    "a leg's + handle": { at: [0.375, 0.5], edit: true }
  };

  const help = id => ({ help: id });
  const undocumented = why => ({ undocumented: why });
  const DELETED_FIRST = {
    route: [MIDDLE, LAST],
    toasts: [`Deleted waypoint — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`],
    said: 'Waypoint deleted'
  };

  /**
   * Every combination of the three modifiers a click reads, on empty canvas
   * and on a waypoint, and the leg targets with and without Cmd/Ctrl. The
   * Windows key off a Mac, and Ctrl on one, are not read at all. Each cell
   * names its Help entry, or says why Help does not describe it.
   */
  const CLICKS = [
    ['empty canvas', [], help('addWaypoint'),
      { route: [...START, 'major 0.1,0.2'], selected: ['#3 major 0.1,0.2'], primary: '#3 major 0.1,0.2' }],
    ['empty canvas', ['shift'],
      undocumented('adds a major turned to the nearest 15° from the waypoint before it; ' +
        'Help lists Shift-click only as delete'),
      { route: [...START, 'major 0.13,0.1421'], selected: ['#3 major 0.13,0.1421'], primary: '#3 major 0.13,0.1421' }],
    ['empty canvas', ['alt'], help('forceAddWaypoint'),
      { route: [...START, 'major 0.1,0.2'], selected: ['#3 major 0.1,0.2'], primary: '#3 major 0.1,0.2' }],
    ['empty canvas', ['meta'], help('addMinorWaypoint'),
      { route: [FIRST, MIDDLE, 'minor 0.1,0.2', LAST] }],
    ['empty canvas', ['alt', 'meta'], help('forceAddMinorWaypoint'),
      { route: [FIRST, MIDDLE, 'minor 0.1,0.2', LAST] }],
    ['empty canvas', ['shift', 'meta'],
      undocumented('adds a minor after the selection, turned to 15° from it'),
      { route: [FIRST, MIDDLE, 'minor 0.067,0.25', LAST] }],
    ['empty canvas', ['shift', 'alt'],
      undocumented('Alt yields to Shift: a snapped major, as Shift-click adds'),
      { route: [...START, 'major 0.13,0.1421'], selected: ['#3 major 0.13,0.1421'], primary: '#3 major 0.13,0.1421' }],
    ['empty canvas', ['shift', 'alt', 'meta'],
      undocumented('force-adds a minor, turned to 15° from the selection'),
      { route: [FIRST, MIDDLE, 'minor 0.067,0.25', LAST] }],
    ['a waypoint', [], help('selectWaypoint'),
      { selected: ['#0 major 0.25,0.5'], primary: '#0 major 0.25,0.5' }],
    ['a waypoint', ['shift'], help('deleteWaypoint'), DELETED_FIRST],
    ['a waypoint', ['alt'],
      undocumented('arms a branch from the waypoint (ROUTE-01c) for the next click to place; ' +
        'Help still calls Alt-click "Force add major"'),
      {
        branchFrom: '#0 major 0.25,0.5',
        toasts: ['Branch from this waypoint — click where it should go (Esc to cancel)'],
        said: 'Branching from this waypoint. Click where the branch should go.'
      }],
    ['a waypoint', ['meta'],
      undocumented('adds the waypoint to the multi-selection, or takes it out; Help calls Cmd/Ctrl-click ' +
        '"Add minor waypoint", which it is only on empty canvas'),
      { selected: ['#0 major 0.25,0.5', '#1 major 0.5,0.5'], primary: '#0 major 0.25,0.5' }],
    ['a waypoint', ['alt', 'meta'], help('forceAddMinorWaypoint'),
      { route: [FIRST, MIDDLE, 'minor 0.25,0.5', LAST] }],
    ['a waypoint', ['shift', 'meta'], undocumented('Shift wins over Cmd/Ctrl: the waypoint is deleted'), DELETED_FIRST],
    ['a waypoint', ['shift', 'alt'],
      undocumented('Shift wins over Alt: the waypoint is deleted, not branched from'), DELETED_FIRST],
    ['a waypoint', ['shift', 'alt', 'meta'],
      undocumented('Alt+Cmd/Ctrl wins over Shift: a minor is force-added on the waypoint, ' +
        'turned to 15° from the selection'),
      { route: [FIRST, MIDDLE, 'minor 0.25,0.5', LAST] }],
    ['a leg', [],
      undocumented('selects the waypoint that owns the leg and flashes its Leg card (Edit mode only)'),
      { selected: ['#0 major 0.25,0.5'], primary: '#0 major 0.25,0.5', flashed: ['leg'] }],
    ['a leg', ['meta'],
      undocumented('a modifier click ignores the leg: a minor is added as on empty canvas'),
      { route: [FIRST, MIDDLE, 'minor 0.3,0.5', LAST] }],
    ["a leg's + handle", [],
      undocumented("inserts a minor at the leg's midpoint and selects it (Edit mode only)"), {
        route: [FIRST, 'minor 0.376,0.5', MIDDLE, LAST],
        selected: ['#1 minor 0.376,0.5'],
        primary: '#1 minor 0.376,0.5',
        said: 'Minor waypoint added to leg'
      }],
    ["a leg's + handle", ['meta'],
      undocumented('a modifier click ignores the handle: a minor is added as on empty canvas'),
      { route: [FIRST, MIDDLE, 'minor 0.375,0.5', LAST] }]
  ];

  const clickName = (place, modifiers) =>
    `${[...modifiers.map(name => MODIFIER_DISPLAY[name]), 'click'].join('+')} on ${place}`;

  test.each(CLICKS.map(([place, modifiers, label, effect]) =>
    [clickName(place, modifiers), place, modifiers, label, effect]))(
    '%s does what the table pins', async (name, place, modifiers, label, effect) => {
      const app = await editor();
      const { at, edit } = PLACES[place];
      if (edit) switchToEdit(app);
      // A leg click scrolls its card into view a frame later; jsdom cannot scroll.
      Element.prototype.scrollIntoView = function recordFlash() {
        if (this.dataset?.section) flashedSections.push(this.dataset.section);
      };

      const { changed, sent } = observe(app, () => click(app, at, chord(modifiers)));
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (flashedSections.length > 0) changed.flashed = [...flashedSections];

      expect(changed, `what a ${name} changed`).toEqual(effect);
      if (label.help) {
        const binding = MOUSE[label.help];
        expect([...binding.modifiers].sort(), `${label.help} is this chord`).toEqual([...modifiers].sort());
        expect(binding.key, `${label.help} is a click`).toBe('click');
        expectNamedEvent(app, label.help, binding, sent);
      } else {
        expect(label.undocumented).toMatch(/\w/);
      }
    });

  test('every mouse entry in Help has its cell', () => {
    const cells = new Set(CLICKS.map(([, , label]) => label.help).filter(Boolean));
    cells.add('moveWaypoint'); // pinned by the drag test below
    expect([...cells].sort()).toEqual(Object.keys(MOUSE).sort());
    // Each is the gesture its cell performs: a click, but for the drag.
    expect(Object.fromEntries(Object.entries(MOUSE).map(([id, { key }]) => [id, key])))
      .toEqual(Object.fromEntries([...cells].map(id => [id, id === 'moveWaypoint' ? 'drag' : 'click'])));
  });

  test('a drag moves a waypoint only when no modifier is held at the press; Shift during it snaps', async () => {
    const app = await editor();

    // moveWaypoint: 33 px on a 660 px canvas is 0.05 of the image.
    let result = observe(app, () => drag(app, [0.25, 0.5], [33, 0]));
    expect(result.changed).toEqual({
      route: ['major 0.3,0.5', MIDDLE, LAST],
      selected: ['#0 major 0.3,0.5'],
      primary: '#0 major 0.3,0.5'
    });
    expectNamedEvent(app, 'moveWaypoint', MOUSE.moveWaypoint, result.sent);
    // Help's move is the plain drag performed here: a modifier held from the press stops a drag (below).
    expect(MOUSE.moveWaypoint, "Help's chord for the move").toMatchObject({ key: 'drag', modifiers: [] });
    expect(result.sent).toContain('waypoint:drag-ended');

    // Undocumented: a modifier held at the press makes the gesture neither a
    // drag nor a click, so nothing happens.
    for (const modifiers of [['shift'], ['alt'], ['meta']]) {
      result = observe(app, () => drag(app, [0.5, 0.5], [33, 20], chord(modifiers)));
      expect(result.changed, `a drag with ${modifiers} held from the press`).toEqual({});
    }

    // Undocumented: Shift pressed once the drag is under way turns it to the
    // nearest 15° from the waypoint before (5.8° here, so level).
    result = observe(app, () => drag(app, [0.75, 0.5], [33, 20], {}, chord(['shift'])));
    expect(result.changed).toEqual({
      route: ['major 0.3,0.5', MIDDLE, 'major 0.8015,0.5'],
      selected: ['#2 major 0.8015,0.5'],
      primary: '#2 major 0.8015,0.5'
    });

    // A drag on empty canvas neither pans nor adds.
    result = observe(app, () => drag(app, [0.1, 0.2], [33, 20]));
    expect(result.changed).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Everything the page's shortcuts react to
// ---------------------------------------------------------------------------

/** Every combination of the four modifier flags a key event carries. */
const COMBOS = Array.from({ length: 16 }, (_, bits) => ({
  shiftKey: Boolean(bits & 1),
  ctrlKey: Boolean(bits & 2),
  altKey: Boolean(bits & 4),
  metaKey: Boolean(bits & 8)
}));

const comboName = flags => [
  flags.ctrlKey && 'Ctrl', flags.metaKey && 'Cmd', flags.altKey && 'Alt', flags.shiftKey && 'Shift'
].filter(Boolean).join('+') || 'none';

/** The modifier sets the dispatcher is found to accept, by name. */
const ANY = 'any modifiers';
const NO_CMD = 'without Ctrl or Cmd';
const CMD = 'with Ctrl or Cmd';
const CMD_NO_SHIFT = 'with Ctrl or Cmd, without Shift';
const CMD_SHIFT = 'with Ctrl or Cmd, and Shift';
const MODIFIER_SETS = {
  [ANY]: () => true,
  [NO_CMD]: flags => !flags.ctrlKey && !flags.metaKey,
  [CMD]: flags => flags.ctrlKey || flags.metaKey,
  [CMD_NO_SHIFT]: flags => (flags.ctrlKey || flags.metaKey) && !flags.shiftKey,
  [CMD_SHIFT]: flags => (flags.ctrlKey || flags.metaKey) && flags.shiftKey
};

/** Name the set of combinations a key reacted to, or list them when no name fits. */
function nameModifierSet(combos) {
  const found = new Set(combos.map(comboName));
  for (const [name, accepts] of Object.entries(MODIFIER_SETS)) {
    const named = COMBOS.filter(accepts).map(comboName);
    if (named.length === found.size && named.every(each => found.has(each))) return name;
  }
  return [...found].sort().join(' | ');
}

/**
 * The named keys of the UI Events `key` list (W3C, "UI Events KeyboardEvent
 * key Values"), by its sections, with the function keys from F1 to F24.
 */
const NAMED_KEYS = [
  'Unidentified',
  // Modifier keys
  'Alt', 'AltGraph', 'CapsLock', 'Control', 'Fn', 'FnLock', 'Hyper', 'Meta', 'NumLock', 'ScrollLock', 'Shift',
  'Super', 'Symbol', 'SymbolLock',
  // White space, navigation and editing
  'Enter', 'Tab', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp',
  'Backspace', 'Clear', 'Copy', 'CrSel', 'Cut', 'Delete', 'EraseEof', 'ExSel', 'Insert', 'Paste', 'Redo', 'Undo',
  // User interface and device
  'Accept', 'Again', 'Attn', 'Cancel', 'ContextMenu', 'Escape', 'Execute', 'Find', 'Finish', 'Help', 'Pause', 'Play',
  'Props', 'Select', 'ZoomIn', 'ZoomOut', 'BrightnessDown', 'BrightnessUp', 'Eject', 'LogOff', 'Power', 'PowerOff',
  'PrintScreen', 'Hibernate', 'Standby', 'WakeUp',
  // Input methods and composition
  'AllCandidates', 'Alphanumeric', 'CodeInput', 'Compose', 'Convert', 'Dead', 'FinalMode', 'GroupFirst',
  'GroupLast', 'GroupNext', 'GroupPrevious', 'ModeChange', 'NextCandidate', 'NonConvert', 'PreviousCandidate',
  'Process', 'SingleCandidate', 'HangulMode', 'HanjaMode', 'JunjaMode', 'Eisu', 'Hankaku', 'Hiragana',
  'HiraganaKatakana', 'KanaMode', 'KanjiMode', 'Katakana', 'Romaji', 'Zenkaku', 'ZenkakuHankaku',
  // General-purpose function keys
  ...Array.from({ length: 24 }, (_, index) => `F${index + 1}`), 'Soft1', 'Soft2', 'Soft3', 'Soft4',
  // Multimedia, audio and speech
  'ChannelDown', 'ChannelUp', 'Close', 'MailForward', 'MailReply', 'MailSend', 'MediaClose', 'MediaFastForward',
  'MediaPause', 'MediaPlay', 'MediaPlayPause', 'MediaRecord', 'MediaRewind', 'MediaStop', 'MediaTrackNext',
  'MediaTrackPrevious', 'New', 'Open', 'Print', 'Save', 'SpellCheck', 'Key11', 'Key12', 'AudioBalanceLeft',
  'AudioBalanceRight', 'AudioBassBoostDown', 'AudioBassBoostToggle', 'AudioBassBoostUp', 'AudioFaderFront',
  'AudioFaderRear', 'AudioSurroundModeNext', 'AudioTrebleDown', 'AudioTrebleUp', 'AudioVolumeDown',
  'AudioVolumeUp', 'AudioVolumeMute', 'MicrophoneToggle', 'MicrophoneVolumeDown', 'MicrophoneVolumeUp',
  'MicrophoneVolumeMute', 'SpeechCorrectionList', 'SpeechInputToggle',
  // Applications, browser and phone
  'LaunchApplication1', 'LaunchApplication2', 'LaunchCalendar', 'LaunchContacts', 'LaunchMail',
  'LaunchMediaPlayer', 'LaunchMusicPlayer', 'LaunchPhone', 'LaunchScreenSaver', 'LaunchSpreadsheet',
  'LaunchWebBrowser', 'LaunchWebCam', 'LaunchWordProcessor', 'BrowserBack', 'BrowserFavorites', 'BrowserForward',
  'BrowserHome', 'BrowserRefresh', 'BrowserSearch', 'BrowserStop', 'AppSwitch', 'Call', 'Camera', 'CameraFocus',
  'EndCall', 'GoBack', 'GoHome', 'HeadsetHook', 'LastNumberRedial', 'Notification', 'MannerMode', 'VoiceDial',
  // Television and media controllers
  'TV', 'TV3DMode', 'TVAntennaCable', 'TVAudioDescription', 'TVAudioDescriptionMixDown',
  'TVAudioDescriptionMixUp', 'TVContentsMenu', 'TVDataService', 'TVInput', 'TVInputComponent1',
  'TVInputComponent2', 'TVInputComposite1', 'TVInputComposite2', 'TVInputHDMI1', 'TVInputHDMI2', 'TVInputHDMI3',
  'TVInputHDMI4', 'TVInputVGA1', 'TVMediaContext', 'TVNetwork', 'TVNumberEntry', 'TVPower', 'TVRadioService',
  'TVSatellite', 'TVSatelliteBS', 'TVSatelliteCS', 'TVSatelliteToggle', 'TVTerrestrialAnalog',
  'TVTerrestrialDigital', 'TVTimer', 'AVRInput', 'AVRPower', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow',
  'ColorF3Blue', 'ColorF4Grey', 'ColorF5Brown', 'ClosedCaptionToggle', 'Dimmer', 'DisplaySwap', 'DVR', 'Exit',
  'FavoriteClear0', 'FavoriteClear1', 'FavoriteClear2', 'FavoriteClear3', 'FavoriteRecall0', 'FavoriteRecall1',
  'FavoriteRecall2', 'FavoriteRecall3', 'FavoriteStore0', 'FavoriteStore1', 'FavoriteStore2', 'FavoriteStore3',
  'Guide', 'GuideNextDay', 'GuidePreviousDay', 'Info', 'InstantReplay', 'Link', 'ListProgram', 'LiveContent',
  'Lock', 'MediaApps', 'MediaAudioTrack', 'MediaLast', 'MediaSkipBackward', 'MediaSkipForward',
  'MediaStepBackward', 'MediaStepForward', 'MediaTopMenu', 'NavigateIn', 'NavigateNext', 'NavigateOut',
  'NavigatePrevious', 'NextFavoriteChannel', 'NextUserProfile', 'OnDemand', 'Pairing', 'PinPDown', 'PinPMove',
  'PinPToggle', 'PinPUp', 'PlaySpeedDown', 'PlaySpeedReset', 'PlaySpeedUp', 'RandomToggle', 'RcLowBattery',
  'RecordSpeedNext', 'RfBypass', 'ScanChannelsToggle', 'ScreenModeNext', 'Settings', 'SplitScreenToggle',
  'STBInput', 'STBPower', 'Subtitle', 'Teletext', 'VideoModeNext', 'Wink', 'ZoomToggle'
];

/** Every printable US character, and every named key. */
const CANDIDATE_KEYS = [
  ...'abcdefghijklmnopqrstuvwxyz0123456789',
  ...'`~!@#$%^&*()-_=+[{]}\\|;:\'",<.>/? ',
  ...NAMED_KEYS
];

/** What the probe sets on a key event, and so all the dispatcher may read of one. */
const PROBED_EVENT_PROPERTIES = [
  'key', 'shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'target', 'defaultPrevented', 'preventDefault'
];

/**
 * Read `InteractionHandler.handleKeyDown` as code: every literal it compares
 * the key with, every use of the key it does not compare with a literal, and
 * every property of the event it reads. The forms read are `key === 'x'`,
 * `[ … ].includes(key)` and `switch (key) { case 'x': … }`.
 */
function dispatcherSource() {
  const lexed = lex(readFileSync(join(repoRoot, 'src/handlers/InteractionHandler.js'), 'utf8'));
  const body = bodyOf(lexed, /\n {2}handleKeyDown\(event\)\s*\{/);
  const { code } = body;
  const literals = new Set();
  const covered = [];
  const take = (pattern, collect) => {
    for (const match of code.matchAll(pattern)) {
      collect(match);
      covered.push([match.index, match.index + match[0].length]);
    }
  };
  take(/const key = event\.key\.toLowerCase\(\);/g, () => {});
  take(/(?<![\w$.])key\s*[!=]==\s*(['"])((?:(?!\1).)*)\1/g, match => literals.add(match[2]));
  take(/(['"])((?:(?!\1).)*)\1\s*[!=]==\s*key(?![\w$])/g, match => literals.add(match[2]));
  take(/\[([^\]]*)\]\.includes\(key\)/g, match => {
    for (const item of match[1].matchAll(/(['"])((?:(?!\1).)*)\1/g)) literals.add(item[2]);
  });
  for (const match of code.matchAll(/switch\s*\(\s*key\s*\)\s*\{/g)) {
    const open = body.start + match.index + match[0].length - 1;
    const block = lexed.code.slice(open, closing(lexed, open) + 1);
    for (const item of block.matchAll(/case (['"])((?:(?!\1).)*)\1:/g)) literals.add(item[2]);
    covered.push([match.index, match.index + match[0].length]);
  }
  const others = [...code.matchAll(/(?<![\w$.])key(?![\w$])/g)]
    .filter(({ index }) => !covered.some(([from, to]) => index >= from && index < to))
    .map(({ index }) => code.slice(Math.max(0, index - 30), index + 30).replace(/\s+/g, ' ').trim());
  const properties = new Set([...code.matchAll(/(?<![\w$])event\.(\w+)/g)].map(match => match[1]));
  return { literals, others, properties };
}

/**
 * Everything the page's shortcut dispatcher reacts to, with a waypoint
 * selected: [the key as the dispatcher lowercases it, the event it sends, the
 * modifiers it accepts, the Help entries that document it — or why none does].
 *
 * The modifiers column is where Help and the dispatcher differ most. The
 * dispatcher reads a modifier only to split a chord (Ctrl or Cmd for A, D, S,
 * Z and 0; Shift for Z and for the arrows' step), treats Ctrl and Cmd alike on
 * every platform, and ignores the rest, so every other key fires whatever else
 * is held, where Help shows one chord per entry. Some of those chords are the
 * browser's own, and the app takes them with their default prevented: Ctrl or
 * Cmd with L, J or K plays, Cmd with comma skips to the start, and Ctrl or Cmd
 * with = or − zooms the map rather than the page, while Ctrl or Cmd with 0 is
 * left to reset the page's zoom.
 */
const DISPATCH = [
  [' ', 'ui:animation:toggle', ANY, ['playPause']],
  ['k', 'ui:animation:toggle', ANY, ['playPauseK']],
  ['j', 'animation:jkl-reverse', ANY, ['playReverse']],
  ['l', 'animation:jkl-forward', ANY, ['playForward']],
  ['home', 'ui:animation:skip-start', ANY, ['skipToStart']],
  [',', 'ui:animation:skip-start', ANY, ['stepBackward']],
  ['<', 'ui:animation:skip-start', ANY,
    'Shift+comma on a US layout: the dispatcher takes the shifted character too, so Shift never stops the skip'],
  ['end', 'ui:animation:skip-end', ANY, ['skipToEnd']],
  ['.', 'ui:animation:skip-end', ANY, ['stepForward']],
  ['>', 'ui:animation:skip-end', ANY, 'Shift+full stop on a US layout, taken for the same reason as <'],
  ['arrowup', 'waypoint:nudge', ANY, ['nudgeUp', 'nudgeUpLarge']],
  ['arrowdown', 'waypoint:nudge', ANY, ['nudgeDown', 'nudgeDownLarge']],
  ['arrowleft', 'waypoint:nudge', ANY, ['nudgeLeft', 'nudgeLeftLarge']],
  ['arrowright', 'waypoint:nudge', ANY, ['nudgeRight', 'nudgeRightLarge']],
  ['delete', 'waypoint:delete-selected', ANY, ['deleteSelected']],
  ['backspace', 'waypoint:delete-selected', ANY, ['deleteSelected']],
  ['t', 'waypoint:toggle-type', ANY, ['toggleWaypointType']],
  ['escape', 'waypoint:deselect', ANY, ['deselectWaypoint']],
  ['a', 'waypoint:add-at-center', NO_CMD, ['addAtCenter']],
  ['a', 'waypoint:select-all', CMD, ['selectAllWaypoints']],
  ['d', 'waypoint:duplicate', CMD, ['duplicateWaypoint']],
  ['=', 'canvas:zoom-in', ANY, ['zoomIn']],
  ['+', 'canvas:zoom-in', ANY, ['zoomIn']],
  ['-', 'canvas:zoom-out', ANY, ['zoomOut']],
  ['_', 'canvas:zoom-out', ANY, ['zoomOut']],
  ['0', 'canvas:zoom-reset', NO_CMD, ['zoomReset']],
  ['z', 'history:undo', CMD_NO_SHIFT, ['undo']],
  ['z', 'history:redo', CMD_SHIFT, ['redo']],
  ['s', 'file:save', CMD, ['save']],
  ['?', 'help:show-shortcuts', ANY, ['showShortcuts']]
];

const byText = rows => [...rows].sort((a, b) => a.join(' ').localeCompare(b.join(' ')));

describe('what the page shortcuts react to (TST-13)', () => {

  test('every key the dispatcher reacts to is in Help, or listed here with the reason it is not', async () => {
    const app = await editor();
    // Recorded, not delivered, so every press meets the same editor.
    const emit = vi.spyOn(app.eventBus, 'emit').mockImplementation(() => {});

    const reactions = new Map();
    const strays = [];
    try {
      for (const candidate of CANDIDATE_KEYS) {
        for (const flags of COMBOS) {
          // A letter arrives in capitals while Shift is held.
          const key = candidate.length === 1 && flags.shiftKey ? candidate.toUpperCase() : candidate;
          emit.mockClear();
          const event = press(key, flags);
          const sent = emit.mock.calls.map(([name]) => name);
          if (sent.length === 0) {
            if (event.defaultPrevented) strays.push(`${comboName(flags)} ${key}: prevented, nothing sent`);
            continue;
          }
          if (sent.length > 1 || !event.defaultPrevented) {
            strays.push(`${comboName(flags)} ${key}: ${sent.join(', ')}, prevented ${event.defaultPrevented}`);
          }
          const row = `${key.toLowerCase()}\n${sent[0]}`;
          if (!reactions.has(row)) reactions.set(row, []);
          reactions.get(row).push(flags);
        }
      }
    } finally {
      emit.mockRestore();
    }

    expect(strays, 'each reaction is one event, with the browser default prevented').toEqual([]);
    const found = [...reactions].map(([row, combos]) => [...row.split('\n'), nameModifierSet(combos)]);
    expect(byText(found), 'what the dispatcher reacts to: a new key needs a DISPATCH row (in Help, or with its ' +
      'reason), and a key it no longer takes leaves the table')
      .toEqual(byText(DISPATCH.map(([key, sends, modifiers]) => [key, sends, modifiers])));

    for (const [key, , modifiers, documentedBy] of DISPATCH) {
      if (typeof documentedBy === 'string') {
        expect(documentedBy, `why Help leaves out ${key}`).toMatch(/\w/);
        continue;
      }
      for (const id of documentedBy) {
        const binding = KEYBOARD[id];
        expect(binding, `Help entry ${id}`).toBeDefined();
        const keys = [binding.key, ...(binding.altKeys ?? [])].map(each => each.toLowerCase());
        expect(keys, `${id} lists ${JSON.stringify(key)}`).toContain(key);
        expect(MODIFIER_SETS[modifiers](chord(binding.modifiers)), `${id}'s chord reaches ${JSON.stringify(key)}`)
          .toBe(true);
      }
    }
    const documented = new Set(DISPATCH.flatMap(([, , , by]) => (Array.isArray(by) ? by : [])));
    expect([...documented].sort(), 'every Help keyboard entry reaches the dispatcher')
      .toEqual(Object.keys(KEYBOARD).sort());
  });

  test('the probe presses every key the dispatcher tests for, and sets everything it reads of the event', () => {
    const { literals, others, properties } = dispatcherSource();
    expect(others, 'uses of the key other than a comparison with a literal (the probe cannot vouch for them)')
      .toEqual([]);
    expect([...properties].filter(name => !PROBED_EVENT_PROPERTIES.includes(name)),
      'properties of the event the dispatcher reads and the probe does not set').toEqual([]);
    const probed = new Set(CANDIDATE_KEYS.map(key => key.toLowerCase()));
    expect([...literals].filter(literal => !probed.has(literal)).sort(),
      'keys the dispatcher tests for that the probe never presses').toEqual([]);
    // Each key it tests for is one it reacts to, and the other way round.
    expect([...literals].sort(), 'the keys the dispatcher tests for (DISPATCH)')
      .toEqual([...new Set(DISPATCH.map(([key]) => key))].sort());
    expect(NAMED_KEYS.filter(key => /^F\d+$/.test(key))).toHaveLength(24);
  });

  test('keys that act on the selection wait for one, and zoom asks for one', async () => {
    const app = await editor({ selected: null });
    const pressing = (key, flags) => {
      const { changed, prevented } = observe(app, () => press(key, flags));
      return { changed, prevented };
    };

    // Undocumented: with nothing selected these do nothing, and leave the key
    // to the browser (Backspace, for one, is not taken).
    for (const key of ['ArrowUp', 'Delete', 'Backspace', 't']) {
      expect(pressing(key), `${key} with nothing selected`).toEqual({ changed: {}, prevented: false });
    }
    expect(pressing('Escape'), 'Escape with nothing selected').toEqual({ changed: {}, prevented: true });
    expect(pressing('=')).toEqual({ changed: { prompt: 'Select a waypoint to zoom' }, prevented: true });
    expect(pressing('d', chord(['meta']))).toEqual({ changed: { said: 'No waypoint selected' }, prevented: true });
  });

  test('Escape cancels an armed branch before it clears the selection', async () => {
    const app = await editor();
    click(app, [0.25, 0.5], chord(['alt']));
    expect(app.interactionHandler.branchArmed).toBe(app.waypoints[0]);

    // Undocumented in Help; the branch toast says "Esc to cancel".
    expect(observe(app, () => press('Escape')).changed)
      .toEqual({ branchFrom: null, toasts: ['Branch cancelled'], said: 'Branch cancelled.' });
    expect(observe(app, () => press('Escape')).changed)
      .toEqual({ selected: [], primary: null, said: 'Selection cleared' });
  });

  test('drawing a network, A and Ctrl/Cmd+D are left alone; the transport stays live', async () => {
    const app = await editor();
    document.getElementById('add-crowd-btn').click();
    const guide = document.getElementById('crowd-guide-type');
    guide.value = 'graph';
    guide.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.networkEditService.active).toBe(true);

    const pressing = (key, flags) => {
      const { changed, prevented } = observe(app, () => press(key, flags));
      return { changed, prevented };
    };
    expect(pressing('a')).toEqual({ changed: {}, prevented: false });
    expect(pressing('d', chord(['meta']))).toEqual({ changed: {}, prevented: false });
    expect(pressing(' ')).toEqual({ changed: { playing: true, said: 'Playing animation' }, prevented: true });
  });

  /** Where a key is pressed. The page runs shortcuts; a control keeps its own keys. */
  const FOCUS = [
    ['the page, after a click on the canvas', () => document.body],
    ['a text field', () => document.getElementById('waypoint-label')],
    ['a slider', () => document.getElementById('dot-size')],
    ['a select', () => document.getElementById('marker-style')],
    // DEF-13: after a click on any button, the shortcuts stop working
    ['a transport button', () => document.getElementById('skip-end-btn')],
    // Focused, not activated: where focus goes after a row is activated and
    // the list rebuilds (DEF-32) is not pinned here.
    ['a waypoint list row', () => document.querySelector('#waypoint-list .waypoint-row')],
    ['a sidebar disclosure', () => document.querySelector('.section-more > summary')]
  ];

  const FOCUS_KEYS = [
    ['Ctrl/Cmd+Z', 'z', ['meta']],
    ['Ctrl/Cmd+S', 's', ['meta']],
    ['Delete', 'Delete', []],
    ['→', 'ArrowRight', []],
    ['Space', ' ', []],
    ['?', '?', []]
  ];

  const NOTHING = Object.fromEntries(FOCUS_KEYS.map(([name]) => [name, '—']));
  const WHERE_KEYS_RUN = {
    'the page, after a click on the canvas': {
      'Ctrl/Cmd+Z': 'history:undo, prevented',
      'Ctrl/Cmd+S': 'file:save, prevented',
      Delete: 'waypoint:delete-selected, prevented',
      '→': 'waypoint:nudge, prevented',
      Space: 'ui:animation:toggle, prevented',
      '?': 'help:show-shortcuts, prevented'
    },
    'a text field': NOTHING,
    'a slider': NOTHING,
    'a select': NOTHING,
    // DEF-13: Undo, Save, Delete and the nudge are ignored, and Save is left
    // to the browser. Space is the button's own activation, rightly.
    'a transport button': NOTHING,
    'a waypoint list row': NOTHING,
    // The disclosure takes Space to open itself.
    'a sidebar disclosure': { ...NOTHING, Space: '—, prevented' }
  };

  test('a shortcut runs from the page, but not from a control — nor, today, from a button (DEF-13)', async () => {
    const app = await editor();
    const emit = vi.spyOn(app.eventBus, 'emit').mockImplementation(() => {});
    const found = {};
    try {
      for (const [where, target] of FOCUS) {
        const element = target();
        element.focus();
        if (element !== document.body) expect(document.activeElement, where).toBe(element);
        found[where] = {};
        for (const [name, key, modifiers] of FOCUS_KEYS) {
          const [asTyped, flags] = typed(key, modifiers);
          emit.mockClear();
          const event = press(asTyped, flags, element);
          const sent = emit.mock.calls.map(([event]) => event).join(', ') || '—';
          found[where][name] = event.defaultPrevented ? `${sent}, prevented` : sent;
        }
      }
    } finally {
      emit.mockRestore();
    }
    expect(found, "where a shortcut runs (DEF-13's fix changes the button and row cells, not Space's)")
      .toEqual(WHERE_KEYS_RUN);
  });
});

// ---------------------------------------------------------------------------
// The transport keys over time
// ---------------------------------------------------------------------------

describe('the transport keys over time (TST-13)', () => {
  const transport = app => (app.animationEngine.isPlaying()
    ? `playing at ${app.animationEngine.state.playbackSpeed}×`
    : `paused at ${round(app.animationEngine.getProgress())}`);

  const run = (app, steps) => steps.map(([name, act]) => {
    act();
    return `${name}: ${transport(app)}`;
  });

  test('Space and K toggle; J and L double up to 4×, and a change of direction starts again at 1×', async () => {
    const app = await editor();
    expect(run(app, [
      ['Space', () => press(' ')],
      ['Space', () => press(' ')],
      ['K', () => press('k')],
      ['K', () => press('k')],
      ['L', () => press('l')],
      ['L', () => press('l')],
      ['L', () => press('l')],
      ['L', () => press('l')],
      ['J', () => press('j')],
      ['J', () => press('j')],
      ['J', () => press('j')],
      ['J', () => press('j')],
      ['L', () => press('l')],
      ['K', () => press('k')]
    ])).toEqual([
      'Space: playing at 1×',
      'Space: paused at 0.5',
      'K: playing at 1×',
      'K: paused at 0.5',
      'L: playing at 1×',
      'L: playing at 2×',
      'L: playing at 4×',
      'L: playing at 4×',
      'J: playing at -1×',
      'J: playing at -2×',
      'J: playing at -4×',
      'J: playing at -4×',
      'L: playing at 1×',
      'K: paused at 0.5'
    ]);
  });

  test('L after the Pause button or Home resumes at double speed (DEF-15)', async () => {
    // The Pause button, Home and the end of playback reset the playback
    // mixin's `_jklSpeedMultiplier`/`_jklDirection`, but the J and L handlers
    // read `jklSpeed`/`jklDirection` (wiringControllers.js), so their doubling
    // carries on. After K or Space, which reset those, L starts at 1×.
    const app = await editor();
    expect(run(app, [
      ['L', () => press('l')],
      ['Pause button', () => app.elements.pauseBtn.click()],
      ['L', () => press('l')],
      ['Home', () => press('Home')],
      ['L', () => press('l')]
    ])).toEqual([
      'L: playing at 1×',
      'Pause button: paused at 0.5',
      'L: playing at 2×',
      'Home: paused at 0',
      'L: playing at 4×'
    ]);
  });

  test('at the end of the timeline, Space and K play one frame and stop; Play restarts (proposed defect)', async () => {
    // Every project opens paused at the end. The toggle plays from there, so
    // the next frame completes at once: the live region says "Playing
    // animation" then "Animation complete", and nothing moves. The Play
    // button restarts from the beginning first.
    const app = await editor({ progress: 1 });
    const said = () => document.getElementById('announcer').textContent;
    for (const key of [' ', 'k']) {
      press(key);
      expect(transport(app)).toBe('playing at 1×');
      await vi.waitFor(() => expect(app.animationEngine.isPlaying()).toBe(false));
      expect(`${transport(app)}; said ${said()}`).toBe('paused at 1; said Animation complete');
    }
    app.elements.playBtn.click();
    expect(`${transport(app)} from ${round(app.animationEngine.getProgress())}`).toBe('playing at 1× from 0');
  });
});

// ---------------------------------------------------------------------------
// Modifier keys held on their own
// ---------------------------------------------------------------------------

describe('modifier keys held on their own (TST-13)', () => {
  test('the canvas cursor shows what a click would do while a modifier is held', async () => {
    const app = await editor();
    // Cmd on a Mac, Ctrl elsewhere: the key Help writes as ⌘ or Ctrl.
    const [minorKey, minorFlag, otherKey, otherFlag] = isMac
      ? ['Meta', 'metaKey', 'Control', 'ctrlKey']
      : ['Control', 'ctrlKey', 'Meta', 'metaKey'];
    const key = (type, name, flags = {}) => {
      document.body.dispatchEvent(new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true, ...flags }));
      return `${type} ${name}: ${app.canvas.style.cursor}`;
    };
    const blur = () => {
      window.dispatchEvent(new Event('blur'));
      return `window blur: ${app.canvas.style.cursor}`;
    };

    expect([
      key('keydown', 'Alt', { altKey: true }),
      key('keyup', 'Alt'),
      key('keydown', 'Shift', { shiftKey: true }),
      key('keyup', 'Shift'),
      key('keydown', minorKey, { [minorFlag]: true }),
      key('keyup', minorKey),
      key('keydown', otherKey, { [otherFlag]: true }),
      key('keyup', otherKey),
      key('keydown', 'Alt', { altKey: true }),
      key('keydown', minorKey, { altKey: true, [minorFlag]: true }),
      key('keydown', 'Shift', { altKey: true, [minorFlag]: true, shiftKey: true }),
      key('keyup', 'Alt', { [minorFlag]: true, shiftKey: true }),
      key('keyup', minorKey, { shiftKey: true }),
      // A key that is not a modifier leaves the cursor as it is.
      key('keydown', 'A', { shiftKey: true }),
      // Leaving the window forgets whatever was held.
      blur()
    ]).toEqual([
      'keydown Alt: copy', // Alt-click force-adds a major
      'keyup Alt: crosshair',
      'keydown Shift: not-allowed', // Shift-click deletes
      'keyup Shift: crosshair',
      `keydown ${minorKey}: cell`, // Cmd/Ctrl-click adds a minor
      `keyup ${minorKey}: crosshair`,
      `keydown ${otherKey}: crosshair`, // the other key is not read
      `keyup ${otherKey}: crosshair`,
      'keydown Alt: copy',
      `keydown ${minorKey}: cell`, // Alt+Cmd/Ctrl force-adds a minor
      'keydown Shift: cell', // Alt+Cmd/Ctrl outranks Shift
      'keyup Alt: not-allowed', // Shift outranks Cmd/Ctrl
      `keyup ${minorKey}: not-allowed`,
      'keydown A: not-allowed',
      'window blur: crosshair'
    ]);
  });
});

// ---------------------------------------------------------------------------
// Every key listener the app adds
// ---------------------------------------------------------------------------

/** Whether a press was taken: something cancelled the browser's own handling of it. */
const taken = event => (event.defaultPrevented ? 'taken' : 'left');

/** Wait one animation frame, as a deferred rename or a scroll does. */
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));

/**
 * The keys that reach the page's own listeners, bubbling to `document`. A
 * modal tool takes its keys on the way down and stops them there, ahead of
 * every listener that does not check whether a key was already handled.
 */
function keysReachingThePage() {
  const keys = [];
  const listen = event => keys.push(event.key);
  document.addEventListener('keydown', listen);
  return { keys, stop: () => document.removeEventListener('keydown', listen) };
}

/** Each control's role in the rows below, read back as a user would name it. */
const focusName = () => {
  const element = document.activeElement;
  if (!element || element === document.body) return 'the page';
  return element.id ? `#${element.id}` : (element.getAttribute('aria-label') || element.textContent.trim());
};

/**
 * Rows for the key listeners no other suite presses, or presses only in
 * part. Each presses the keys its listener reads, and some it does not, and
 * records what each press did.
 */
const LISTENER_ROWS = {
  'Enter in a busyness handle field applies what was typed; other keys, and a read-only field, do not':
    async () => {
      const app = await editor();
      document.getElementById('add-crowd-btn').click();
      const envelope = () => app.selectedCrowd.emitters[0].busynessEnvelope
        .map(({ time, value }) => `${time}:${value}`).join(' ');
      const field = (index, name) =>
        document.querySelector(`[data-busyness-index="${index}"][data-busyness-field="${name}"]`);
      const step = (name, target, key, typedValue) => {
        target.value = typedValue;
        document.getElementById('announcer').textContent = '';
        const event = press(key, {}, target);
        return `${name}: ${key} ${taken(event)}; ${envelope()}; said ${document.getElementById('announcer').textContent || '—'}`;
      };
      expect([
        step('busy 1', field(0, 'value'), 'a', '40'),
        step('busy 1', field(0, 'value'), 'Enter', '40'),
        step('time 1, read-only', field(0, 'time'), 'Enter', '30'),
        step('busy 2', field(1, 'value'), 'Enter', '0')
      ]).toEqual([
        'busy 1: a left; 0:1 1:1; said —',
        'busy 1: Enter taken; 0:0.4 1:1; said Busyness pattern updated. Undo is available.',
        'time 1, read-only: Enter left; 0:0.4 1:1; said —',
        'busy 2: Enter taken; 0:0.4 1:0; said Busyness pattern updated. Undo is available.'
      ]);
    },

  'Enter and Space on a settings section header open and close it; other keys do not': async () => {
    await editor();
    const section = document.querySelector('.settings-section[data-section="video"]');
    const header = section.querySelector('.section-header');
    header.focus();
    const state = () => `${header.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed'}` +
      `${section.classList.contains('expanded') ? '' : ' (no class)'}, last used ` +
      `${document.querySelector('.settings-section[data-last="true"]')?.dataset.section ?? 'none'}`;
    const before = state();
    const steps = ['a', 'Enter', ' ', 'Tab'].map(key => `${key === ' ' ? 'Space' : key}: ${taken(press(key, {}, header))}; ${state()}`);
    // Focus alone marks the section last used (SectionController's focusin).
    expect([before, ...steps]).toEqual([
      'closed (no class), last used video',
      'a: left; closed (no class), last used video',
      'Enter: taken; open, last used video',
      'Space: taken; closed (no class), last used video',
      'Tab: left; closed (no class), last used video'
    ]);
  },

  'Enter and Space on a More disclosure open and close it': async () => {
    await editor();
    const disclosure = document.querySelector('.section-more');
    const summary = disclosure.querySelector('summary');
    summary.focus();
    expect(['Enter', ' ', 'a'].map(key => `${key === ' ' ? 'Space' : key}: ${taken(press(key, {}, summary))}; ` +
      `${disclosure.open ? 'open' : 'closed'}`)).toEqual(['Enter: taken; open', 'Space: taken; closed', 'a: left; closed']);
  },

  'F2 on a waypoint row starts its rename; Enter keeps the new name, Escape the old one': async () => {
    const app = await editor();
    const row = index => document.querySelector(`#waypoint-list .waypoint-item[data-route-index="${index}"] .waypoint-row`);
    const renaming = () => document.querySelector('#waypoint-list .waypoint-rename-input');
    const names = () => app.waypoints.map(wp => wp.name || '—').join(', ');
    const steps = [];
    let event = press('F3', {}, row(2));
    await frame();
    steps.push(`F3 on row 3: ${taken(event)}; ${renaming() ? 'renaming' : 'not renaming'}`);
    event = press('F2', {}, row(2));
    await frame();
    steps.push(`F2 on row 3: ${taken(event)}; renaming "${renaming().value}", focus ${focusName()}`);
    renaming().value = 'Lab';
    event = press('Enter', {}, renaming());
    steps.push(`Enter: ${taken(event)}; ${renaming() ? 'renaming' : 'done'}; names ${names()}`);
    event = press('F2', {}, row(2));
    await frame();
    renaming().value = 'Library';
    event = press('Escape', {}, renaming());
    steps.push(`F2, then Escape: ${taken(event)}; ${renaming() ? 'renaming' : 'done'}; names ${names()}, ` +
      `selected ${app.selectedWaypoint === app.waypoints[2] ? 'row 3' : 'another'}`);
    expect(steps).toEqual([
      'F3 on row 3: left; not renaming',
      'F2 on row 3: taken; renaming "", focus Rename Waypoint 3',
      'Enter: taken; done; names —, —, Lab',
      'F2, then Escape: taken; done; names —, —, Lab, selected row 3'
    ]);
  },

  "the Export menu: Enter, Space and ↓ open it; ↓ ↑ Home End move in it; Escape and Tab close it, and Escape on the page": async () => {
    const app = await editor();
    const trigger = document.getElementById('export-dropdown-btn');
    const menu = document.getElementById('export-menu');
    trigger.focus();
    const state = () => `${menu.classList.contains('is-open') ? 'open' : 'closed'} ` +
      `(${trigger.getAttribute('aria-expanded')}), focus ${focusName()}`;
    const step = (key, target = document.activeElement, flags = {}) =>
      `${key === ' ' ? 'Space' : key}: ${taken(press(key, flags, target))}; ${state()}`;
    expect([
      step('Enter'), step('ArrowDown'), step('End'), step('ArrowDown'), step('ArrowUp'), step('Home'),
      step('Escape'), step(' '), step('Tab'), step('ArrowDown', trigger), step('Escape', document.body)
    ]).toEqual([
      'Enter: taken; open (true), focus #export-mp4-btn',
      'ArrowDown: taken; open (true), focus #export-webm-btn',
      'End: taken; open (true), focus #copy-debug-btn',
      'ArrowDown: taken; open (true), focus #export-mp4-btn',
      'ArrowUp: taken; open (true), focus #copy-debug-btn',
      'Home: taken; open (true), focus #export-mp4-btn',
      'Escape: taken; closed (false), focus #export-dropdown-btn',
      'Space: taken; open (true), focus #export-mp4-btn',
      'Tab: left; closed (false), focus #export-mp4-btn',
      'ArrowDown: taken; open (true), focus #export-mp4-btn',
      // Escape on the page closes the menu, and runs the page's own Escape too.
      'Escape: taken; closed (false), focus #export-mp4-btn'
    ]);
    expect(app.selectedWaypoint, "the page's Escape cleared the selection").toBeNull();
  },

  "a waypoint's context menu: ↓ ↑ Home End move, other keys stay in it, Tab and Escape close it": async () => {
    const app = await editor();
    const { x, y } = app.imageToCanvas(0.75, 0.5);
    const open = () => {
      app.canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2,
        clientX: x, clientY: y }));
    };
    const menu = () => document.querySelector('.context-menu');
    const state = () => (menu()?.style.display === 'block' ? `open, focus ${focusName()}` : `closed, focus ${focusName()}`);
    const step = (key, target = document.activeElement) => `${key}: ${taken(press(key, {}, target))}; ${state()}`;
    open();
    const steps = [`opened: ${state()}`, step('ArrowDown'), step('End'), step('ArrowDown'), step('ArrowUp'),
      step('Home')];
    // Sent to the page, T would convert the selected waypoint; under the
    // menu, the menu's capture-phase listener holds it back from the page.
    const route = app.waypoints.map(describeWaypoint).join(' ');
    steps.push(step('t', document.body));
    steps.push(`route ${app.waypoints.map(describeWaypoint).join(' ') === route ? 'unchanged' : 'changed'}`);
    steps.push(step('Tab'));
    open();
    steps.push(step('Escape'));
    expect(steps).toEqual([
      'opened: open, focus Rename',
      'ArrowDown: taken; open, focus Convert to minor waypoint',
      'End: taken; open, focus Delete waypoint',
      'ArrowDown: taken; open, focus Rename',
      'ArrowUp: taken; open, focus Delete waypoint',
      'Home: taken; open, focus Rename',
      't: left; open, focus Rename',
      'route unchanged',
      'Tab: left; closed, focus the page',
      'Escape: taken; closed, focus the page'
    ]);
  },

  'Escape while drawing an area cancels the drawing, and leaves the selection': async () => {
    const app = await editor();
    document.getElementById('area-draw-btn').click();
    const state = () => `${app.areaDrawingService.isDrawing ? 'drawing' : 'not drawing'}, ` +
      `selected ${app.selectedWaypoint ? describeWaypoint(app.selectedWaypoint) : 'none'}`;
    const before = state();
    const page = keysReachingThePage();
    const event = press('Escape');
    page.stop();
    expect([before, `Escape: ${taken(event)}; ${state()}; reached the page: ${page.keys.join(' ') || 'nothing'}`])
      .toEqual([
        'drawing, selected major 0.5,0.5',
        'Escape: taken; not drawing, selected major 0.5,0.5; reached the page: nothing'
      ]);
  },

  'Escape during a video export cancels it, and leaves the selection': async () => {
    const app = await editor();
    let started;
    const running = new Promise(resolve => { started = resolve; });
    let cancelled = 0;
    app.videoExporter = {
      cancel() { cancelled += 1; this.stop?.(new Error('Export cancelled')); },
      export() {
        started();
        return new Promise((resolve, reject) => { this.stop = reject; });
      }
    };
    const exporting = app.exportVideo();
    await running;
    const page = keysReachingThePage();
    const event = press('Escape');
    page.stop();
    await exporting;
    expect({ escape: taken(event), cancelled, said: document.getElementById('announcer').textContent,
      selected: app.selectedWaypoint ? describeWaypoint(app.selectedWaypoint) : 'none', reached: page.keys })
      .toEqual({
        escape: 'taken', cancelled: 1, said: 'Video export cancelled', selected: 'major 0.5,0.5', reached: []
      });
  },

  'drawing a network: T cycles the node, Escape lifts the pen then the selection then leaves; Delete and Backspace delete': async () => {
    const app = await editor();
    document.getElementById('add-crowd-btn').click();
    const guide = document.getElementById('crowd-guide-type');
    guide.value = 'graph';
    guide.dispatchEvent(new Event('change', { bubbles: true }));
    const service = app.networkEditService;
    for (const at of [[0.3, 0.2], [0.6, 0.2], [0.6, 0.4]]) {
      const { x, y } = app.imageToCanvas(...at);
      for (const type of ['pointerdown', 'pointerup']) pointer(app, type, x, y);
    }
    const graph = service.layer.graph;
    const page = keysReachingThePage();
    const state = () => `${service.active ? 'drawing' : 'not drawing'}, pen ${service.penNodeId ? 'down' : 'up'}, ` +
      `${service.selection ? `${service.selection.kind} selected` : 'nothing selected'}, ` +
      `${graph.getNodes().length} nodes ${graph.getEdges().length} edges, ` +
      `types ${graph.getNodes().map(node => node.type).join(' ')}`;
    const step = key => `${key}: ${taken(press(key))}; ${state()}`;
    const steps = [`drawn: ${state()}`, step('t'), step('Escape'), step('Escape')];
    service.selectEdge(graph.getEdges()[0]);
    steps.push(step('Backspace'));
    service.selectNode(graph.getNodes()[0]);
    steps.push(step('Delete'));
    steps.push(step('Escape'));
    page.stop();
    expect(page.keys, 'keys the network pen let through to the page').toEqual([]);
    expect(steps).toEqual([
      'drawn: drawing, pen down, node selected, 3 nodes 2 edges, types normal normal normal',
      't: taken; drawing, pen down, node selected, 3 nodes 2 edges, types normal normal entry',
      'Escape: taken; drawing, pen up, node selected, 3 nodes 2 edges, types normal normal entry',
      'Escape: taken; drawing, pen up, nothing selected, 3 nodes 2 edges, types normal normal entry',
      'Backspace: taken; drawing, pen up, nothing selected, 3 nodes 1 edges, types normal normal entry',
      'Delete: taken; drawing, pen up, nothing selected, 2 nodes 1 edges, types normal entry',
      'Escape: taken; not drawing, pen up, nothing selected, 2 nodes 1 edges, types normal entry'
    ]);
  }
};

/**
 * Every keydown, keyup and keypress listener in `src/`, as the scan below
 * names it (file, what it is added to, type, capture, and its number when a
 * file adds more than one of a kind): what it does, and where its keys are
 * pressed — a row above (`rows`), this file's own tables (`here`), or another
 * suite and the keys it presses (`pinnedBy`).
 */
const KEY_LISTENERS = {
  'src/app/crowds.js: input keydown #1': {
    what: "a crowd's rename field (_startCrowdRename): Enter keeps the name, Escape drops it, no key reaches the page",
    pinnedBy: { 'tests/crowds.test.js': ['Enter', 'Escape'] } },
  'src/app/crowds.js: input keydown #2': {
    what: 'a busyness handle number field: Enter applies what was typed (TST-04 mutant C5 breaks it)',
    rows: ['Enter in a busyness handle field applies what was typed; other keys, and a read-only field, do not'],
    pinnedBy: { 'tests/crowds.test.js': ['Enter'] } },
  'src/app/exporting.js: window keydown (capture)': {
    what: 'Escape during a video export cancels it, ahead of every other listener',
    rows: ['Escape during a video export cancels it, and leaves the selection'] },
  'src/components/ContextMenu.js: document keydown (capture)': {
    what: 'an open context menu: arrows, Home and End move, Escape and Tab close, other keys stay in it',
    rows: ["a waypoint's context menu: ↓ ↑ Home End move, other keys stay in it, Tab and Escape close it"] },
  'src/components/Dropdown.js: trigger keydown': {
    what: 'a menu button (File, Export): Enter, Space and ↓ open its menu',
    rows: ["the Export menu: Enter, Space and ↓ open it; ↓ ↑ Home End move in it; Escape and Tab close it, and Escape on the page"] },
  'src/components/Dropdown.js: menu keydown': {
    what: 'an open menu: arrows, Home and End move, Escape closes to the button, Tab closes',
    rows: ["the Export menu: Enter, Space and ↓ open it; ↓ ↑ Home End move in it; Escape and Tab close it, and Escape on the page"] },
  'src/components/Dropdown.js: document keydown': {
    what: 'Escape anywhere closes an open menu',
    rows: ["the Export menu: Enter, Space and ↓ open it; ↓ ↑ Home End move in it; Escape and Tab close it, and Escape on the page"] },
  'src/components/ParamTooltip.js: document keydown': {
    what: 'Escape hides an open hint, and keeps it hidden while focus stays',
    pinnedBy: { 'tests/paramTooltip.test.js': ['Escape'] } },
  'src/controllers/SceneOutlineController.js: this.container keydown': {
    what: 'Escape in an outline form field drops the draft and resets the form',
    pinnedBy: { 'tests/sceneOutline.test.js': ['Escape'] } },
  'src/controllers/SectionController.js: header keydown': {
    what: 'a settings section header: Enter and Space open and close it (TST-04 mutant C8 breaks it)',
    rows: ['Enter and Space on a settings section header open and close it; other keys do not'] },
  'src/controllers/SectionController.js: summary keydown': {
    what: 'a More disclosure: Enter and Space open and close it',
    rows: ['Enter and Space on a More disclosure open and close it'],
    pinnedBy: { 'tests/reviewAccessibility.test.js': ['Enter', ' '] } },
  'src/controllers/UIController.js: input keydown': {
    what: "a waypoint's rename field: Enter keeps the name, Escape the old one, no key reaches the page",
    rows: ['F2 on a waypoint row starts its rename; Enter keeps the new name, Escape the old one'],
    pinnedBy: { 'tests/waypointList.test.js': ['Enter'] } },
  'src/controllers/UIController.js: rowBtn keydown': {
    what: 'F2 on a waypoint row starts its rename',
    rows: ['F2 on a waypoint row starts its rename; Enter keeps the new name, Escape the old one'] },
  'src/handlers/InteractionHandler.js: document keydown #1': {
    what: "the page's shortcut dispatcher", here: 'what the page shortcuts react to (TST-13)' },
  'src/handlers/InteractionHandler.js: document keydown #2': {
    what: 'the canvas cursor while a modifier is held', here: 'modifier keys held on their own (TST-13)' },
  'src/handlers/InteractionHandler.js: document keyup': {
    what: 'the canvas cursor when a modifier is let go', here: 'modifier keys held on their own (TST-13)' },
  'src/player/playerEntry.js: timeline keydown': {
    what: "the exported player's timeline: arrows step 5 s, Page Up and Down 10 s, Home and End the ends",
    pinnedBy: { 'tests/playerEntryAccessibility.test.js': ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown',
      'PageUp', 'PageDown', 'Home', 'End'] } },
  'src/player/playerEntry.js: document keydown': {
    what: "the exported player's page: Space and K play and pause, Home and End, arrows seek 1 s",
    pinnedBy: { 'tests/playerEntryAccessibility.test.js': [' ', 'k', 'Home', 'End', 'ArrowLeft', 'ArrowRight'] } },
  'src/services/AreaDrawingService.js: document keydown (capture)': {
    what: 'Escape while drawing an area cancels the drawing, ahead of the page',
    rows: ['Escape while drawing an area cancels the drawing, and leaves the selection'] },
  'src/services/NetworkEditService.js: document keydown (capture)': {
    what: 'drawing a network: the Escape ladder, Delete and Backspace, T, ahead of the page',
    rows: ['drawing a network: T cycles the node, Escape lifts the pen then the selection then leaves; Delete and Backspace delete'],
    pinnedBy: { 'tests/networkEdit.test.js': ['Escape', 't', 'Delete'] } },
  'src/utils/focusTrap.js: window keydown (capture)': {
    what: "an open dialog's focus trap: Tab and Shift+Tab wrap, Escape closes",
    pinnedBy: { 'tests/reviewAccessibility.test.js': ['Tab', 'Escape'] } }
};

/** Every key listener registration in `src/`, read as code, named as KEY_LISTENERS names it. */
function keyListeners() {
  const names = [];
  const untyped = [];
  for (const { file, lexed } of lexedFiles(repoRoot, 'src')) {
    for (const { args, receiver, line } of callsOf(lexed, 'addEventListener').calls) {
      const type = literalValue(args[0] ?? '');
      if (type === null) untyped.push(`${file}:${line} ${args[0]}`);
      if (!['keydown', 'keyup', 'keypress'].includes(type)) continue;
      const capture = /^true$|capture:\s*true/.test(args[2] ?? '');
      names.push(`${file}: ${receiver} ${type}${capture ? ' (capture)' : ''}`);
    }
  }
  const seen = {};
  const numbered = names.map(name => {
    seen[name] = (seen[name] ?? 0) + 1;
    return names.filter(each => each === name).length > 1 ? `${name} #${seen[name]}` : name;
  });
  return { listeners: numbered, untyped };
}

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('every key listener the app adds (TST-13)', () => {

  test('each key listener in src/ has a row here, or names the suite that presses its keys', () => {
    const { listeners, untyped } = keyListeners();
    expect(untyped, 'listeners added for a type the scan cannot read').toEqual([]);
    expect(listeners.sort(), 'key listeners in src/ (a new one needs a KEY_LISTENERS row)')
      .toEqual(Object.keys(KEY_LISTENERS).sort());
    // Keys set as properties, or in the pages' markup, would escape the scan.
    for (const { file, lexed } of lexedFiles(repoRoot, 'src')) {
      expect(lexed.code.match(/\.onkey(down|up|press)\s*=/g), `${file} sets an onkey handler`).toBeNull();
    }
    expect(readFileSync(join(repoRoot, 'index.html'), 'utf8')).not.toMatch(/onkey(down|up|press)=/i);

    const ownSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    for (const [name, { what, rows = [], here, pinnedBy = {} }] of Object.entries(KEY_LISTENERS)) {
      expect(what, name).toMatch(/\w/);
      expect(rows.length + (here ? 1 : 0) + Object.keys(pinnedBy).length, `${name} is pressed somewhere`)
        .toBeGreaterThan(0);
      for (const row of rows) expect(Object.keys(LISTENER_ROWS), `${name}'s row`).toContain(row);
      if (here) expect(ownSource, `${name}'s tables here`).toContain(`describe('${here}'`);
      // A light check that the suite named is the one that presses these keys:
      // it exists, and names each key as a string.
      for (const [suite, keys] of Object.entries(pinnedBy)) {
        expect(existsSync(join(repoRoot, suite)), `${suite} (${name})`).toBe(true);
        const source = readFileSync(join(repoRoot, suite), 'utf8');
        expect(keys.filter(key => !new RegExp(`(['"])${escapeRegExp(key)}\\1`).test(source)),
          `keys ${suite} never names (${name})`).toEqual([]);
      }
    }
  });

  test.each(Object.keys(LISTENER_ROWS))('%s', title => LISTENER_ROWS[title]());
});
