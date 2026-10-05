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
 * - every key the page's shortcuts react to, pressed once and held down, and
 *   the modifiers they accept (DEF-63), each either in Help or listed here
 *   with the reason it is not;
 * - every modifier click and drag on the canvas, and the cursor each modifier
 *   shows while it is held;
 * - where a key must be pressed for a shortcut to run (DEF-13);
 * - every keydown, keyup and keypress listener in `src/`, found by reading
 *   the source, with what its handler reads of the event: the keys it
 *   compares and every other property it reads, followed into the functions
 *   of its file the event is passed to, at whichever argument it is passed
 *   as, names compared as JavaScript reads them (a string's escapes
 *   decoded). What the scan cannot read fails rather than passes: a use of
 *   the event it cannot follow (the global `event` among them), a `case` or
 *   an array member that is not a literal, a literal or a key inside a
 *   larger expression, a function followed by a name its file also writes,
 *   binds again or uses other than by calling it or passing it on, a name
 *   spelled with an escape, `eval`, a listener added through an alias, a key
 *   event type named outside a listener call (a word of any string), a type
 *   or options it cannot read, an `onkey…` handler or accesskey named in code.
 *   Neither page has a key handler in its markup or its inline scripts, nor
 *   an accesskey. Each listener has one place that presses every
 *   key its handler compares, on its target, and records what each did, then
 *   presses every other key of the domain there and finds it does nothing
 *   that place observes; each keydown is pressed once, and again as a held
 *   key repeats it: a row here, or for the exported player's two, its own
 *   suite.
 *
 * The keys probed are a bounded domain (`tests/helpers/keyDomain.js`): the 95
 * printable ASCII characters, capitals included, and 297 named keys, the
 * listed named keys, F1–F24 and Soft1–Soft4: 392 keys. The dispatcher's
 * sweep presses each under all sixteen combinations of Shift, Ctrl, Alt and
 * Meta, once and held down; the other listeners' sweeps press each without
 * modifiers (the modifiers a handler reads are pinned from its source, and
 * Shift+Tab is pressed in the focus trap). Where a sweep presses keys on the
 * page itself, the dispatcher is suspended (its own `setEnabled`) for the
 * keys it takes, so those reach the listener under test alone. A handler
 * compares `event.key` with literals, so a key outside the domain can only
 * reach it through a literal, which the source checks hold to the domain.
 *
 * Each place observes what it lists, in the one state it sets up: the route,
 * the selection, the transport, a field, a menu, the focus, and whether a key
 * was taken. A handler edit that changes nothing it observes there passes;
 * so does a name the source builds at run time (`'key' + 'down'`), or a
 * method another file assigns or overrides where a handler calls it through
 * `this`, neither of which this scanner follows.
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
import { HTMLExportService } from '../src/services/HTMLExportService.js';
import { bootApp } from './helpers/bootApp.js';
import { CANDIDATE_KEYS, NAMED_KEYS, PRINTABLE_KEYS } from './helpers/keyDomain.js';
import { keyListenersIn, lex, lexedFiles } from './helpers/sourceScan.js';

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
      .map(([id, binding]) => [id, binding.altKeys])), 'alternative keys no row shows')
      .toEqual(KEYS_HELP_DOES_NOT_SHOW);
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
 * What the probe sets on a key event, and so all the dispatcher may read of
 * one. A held key repeats: the probe presses every key both ways.
 */
const PROBED_EVENT_PROPERTIES = [
  'key', 'shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'repeat', 'target', 'defaultPrevented', 'preventDefault'
];

/** Every key listener in `src/`, read as code (`keyListenersIn`), read once. */
let sourceListeners = null;
const sourceKeyListeners = () => (sourceListeners ??= keyListenersIn(lexedFiles(repoRoot, 'src')));
const listenerNamed = name => sourceKeyListeners().listeners.find(listener => listener.name === name);

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
 * browser's own, and the app takes them with their default prevented
 * (DEF-63): Ctrl or Cmd with L, J or K plays, Cmd with comma skips to the
 * start, and Ctrl or Cmd with = or − zooms the map rather than the page, while
 * Ctrl or Cmd with 0 is left to reset the page's zoom.
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

    // Each key once as a single press, and once as a key held down repeats it.
    const reactions = { single: new Map(), held: new Map() };
    const strays = [];
    try {
      for (const candidate of CANDIDATE_KEYS) {
        for (const flags of COMBOS) {
          // A letter arrives in capitals while Shift is held.
          const key = candidate.length === 1 && flags.shiftKey ? candidate.toUpperCase() : candidate;
          for (const repeat of [false, true]) {
            emit.mockClear();
            const event = press(key, { ...flags, repeat });
            const sent = emit.mock.calls.map(([name]) => name);
            const pressed = `${repeat ? 'held ' : ''}${comboName(flags)} ${key}`;
            if (sent.length === 0) {
              if (event.defaultPrevented) strays.push(`${pressed}: prevented, nothing sent`);
              continue;
            }
            if (sent.length > 1 || !event.defaultPrevented) {
              strays.push(`${pressed}: ${sent.join(', ')}, prevented ${event.defaultPrevented}`);
            }
            const table = repeat ? reactions.held : reactions.single;
            const row = `${key.toLowerCase()}\n${sent[0]}`;
            if (!table.has(row)) table.set(row, []);
            table.get(row).push(flags);
          }
        }
      }
    } finally {
      emit.mockRestore();
    }

    expect(strays, 'each reaction is one event, with the browser default prevented').toEqual([]);
    const tabled = table => [...table].map(([row, combos]) => [...row.split('\n'), nameModifierSet(combos)]);
    const found = tabled(reactions.single);
    expect(byText(found), 'what the dispatcher reacts to: a new key needs a DISPATCH row (in Help, or with its ' +
      'reason), and a key it no longer takes leaves the table')
      .toEqual(byText(DISPATCH.map(([key, sends, modifiers]) => [key, sends, modifiers])));
    // Holding a key down, as a user holds an arrow to keep nudging, does what one press does.
    expect(byText(tabled(reactions.held)), 'what a held, repeating key does').toEqual(byText(found));

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

  test('the key domain: the 95 printable ASCII characters, capitals included, and the 297 listed named keys, none twice', () => {
    // Round 3's review: the domain had no capitals, which arrive with no
    // modifier under Caps Lock, and the count claimed for it was not its own.
    const printable = Array.from({ length: 0x7f - 0x20 }, (_, index) => String.fromCharCode(0x20 + index));
    expect([...PRINTABLE_KEYS].sort(), 'every printable US character, U+0020 to U+007E').toEqual(printable.sort());
    expect(NAMED_KEYS.filter(key => key.length < 2), 'a named key is a name, not a character').toEqual([]);
    expect(NAMED_KEYS).toHaveLength(297);
    expect(CANDIDATE_KEYS).toEqual([...PRINTABLE_KEYS, ...NAMED_KEYS]);
    expect(new Set(CANDIDATE_KEYS).size, 'keys in the domain, none twice').toBe(392);
  });

  test('the probe presses every key the dispatcher tests for, and sets everything it reads of the event', () => {
    // The dispatcher's source, read as `keyListenersIn` reads every key
    // handler: a use of the event or its key it cannot account for fails.
    const { reads } = listenerNamed(KEY_LISTENER.dispatcher);
    expect(reads.unanalysed, 'uses of the event or its key the scan cannot vouch for').toEqual([]);
    expect([...reads.reads].filter(name => !PROBED_EVENT_PROPERTIES.includes(name)),
      'properties of the event the dispatcher reads and the probe does not set').toEqual([]);
    expect([...reads.keys], 'keys compared as written (the dispatcher lower-cases every key first)').toEqual([]);
    const literals = [...reads.anyCase];
    const probed = new Set(CANDIDATE_KEYS.map(key => key.toLowerCase()));
    expect(literals.filter(literal => !probed.has(literal)).sort(),
      'keys the dispatcher tests for that the probe never presses').toEqual([]);
    // Each key it tests for is one it reacts to, and the other way round.
    expect(literals.sort(), 'the keys the dispatcher tests for (DISPATCH)')
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

  test('at the end of the timeline, Space and K play one frame and stop; Play restarts (DEF-62)', async () => {
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
  // Once as each keydown first arrives, and again as a key held down repeats
  // it (`repeat` set): the cursor must not care which.
  const cursorTitle = 'the canvas cursor shows what a click would do while a modifier is held%s';
  test.each([['', false], [', its keydowns repeating', true]])(cursorTitle, async (_, held) => {
    const app = await editor();
    // Cmd on a Mac, Ctrl elsewhere: the key Help writes as ⌘ or Ctrl.
    const [minorKey, minorFlag, otherKey, otherFlag] = isMac
      ? ['Meta', 'metaKey', 'Control', 'ctrlKey']
      : ['Control', 'ctrlKey', 'Meta', 'metaKey'];
    // Each press is logged for the listener it is for, so the test can show it
    // pressed every key the cursor's handlers compare (KEY_LISTENERS).
    const log = keyLog({ held });
    const key = (type, name, flags = {}) => {
      const listener = type === 'keyup' ? KEY_LISTENER.cursorUp : KEY_LISTENER.cursorDown;
      log.press(listener, name, document.body, flags, type);
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

    // Every other key of the domain, pressed and let go, leaves the cursor as it is.
    const cursor = () => app.canvas.style.cursor;
    log.sweep(KEY_LISTENER.cursorDown, document.body, cursor, { page: app });
    log.sweep(KEY_LISTENER.cursorUp, document.body, cursor, { page: app, type: 'keyup' });
    expect(log.findings(), 'keys that moved the cursor, other than the modifiers').toEqual({});
    for (const listener of [KEY_LISTENER.cursorDown, KEY_LISTENER.cursorUp]) {
      expect(log.unpressed(listener), `keys ${listener} compares that this test never pressed`).toEqual([]);
    }
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
  if (element.id) return `#${element.id}`;
  const label = element.getAttribute('aria-label');
  if (label) return label;
  return element.name ? `the ${element.name} field` : element.textContent.trim();
};

/**
 * Every key listener in `src/`, by a short name: each is the inventory's own
 * name for it (`keyListenersIn`), as KEY_LISTENERS keys it.
 */
const KEY_LISTENER = {
  crowdRename: 'src/app/crowds.js: input keydown #1',
  busyness: 'src/app/crowds.js: input keydown #2',
  exportEscape: 'src/app/exporting.js: window keydown (capture)',
  contextMenu: 'src/components/ContextMenu.js: document keydown (capture)',
  menuButton: 'src/components/Dropdown.js: trigger keydown',
  menu: 'src/components/Dropdown.js: menu keydown',
  menuAnywhere: 'src/components/Dropdown.js: document keydown',
  hint: 'src/components/ParamTooltip.js: document keydown',
  outline: 'src/controllers/SceneOutlineController.js: this.container keydown',
  sectionHeader: 'src/controllers/SectionController.js: header keydown',
  more: 'src/controllers/SectionController.js: summary keydown',
  waypointRename: 'src/controllers/UIController.js: input keydown',
  waypointRow: 'src/controllers/UIController.js: rowBtn keydown',
  dispatcher: 'src/handlers/InteractionHandler.js: document keydown #1',
  cursorDown: 'src/handlers/InteractionHandler.js: document keydown #2',
  cursorUp: 'src/handlers/InteractionHandler.js: document keyup',
  playerTimeline: 'src/player/playerEntry.js: timeline keydown',
  playerPage: 'src/player/playerEntry.js: document keydown',
  areaDrawing: 'src/services/AreaDrawingService.js: document keydown (capture)',
  networkPen: 'src/services/NetworkEditService.js: document keydown (capture)',
  focusTrap: 'src/utils/focusTrap.js: window keydown (capture)'
};

/**
 * Every keydown, keyup and keypress listener in `src/`: what it does, and
 * what its handler reads of the event, as the source says (`keyListenersIn`
 * follows the event through the handler and the functions of its file it is
 * passed to): the keys it compares `event.key` with (`keys`, or `anyCase`
 * where it lower-cases first), and every other property it reads (`reads`).
 * A changed key, a new property, or a use of the event the scan cannot
 * follow, fails here.
 *
 * Where its keys are pressed: a row below that covers it (each key the
 * handler compares, on its target, and every other key of the domain swept
 * past it, each keydown once and again held down), this file's own tables
 * (`here`), or another suite (`suite`), which holds itself to the same.
 * `pinnedBy` names other suites that press some of its keys too, lightly
 * checked: the suite exists and names them.
 */
const KEY_LISTENERS = {
  [KEY_LISTENER.crowdRename]: {
    what: "a crowd's rename field (_startCrowdRename): Enter keeps the name typed, Escape the old one; " +
      'no key reaches the page',
    keys: ['Enter', 'Escape'], reads: ['preventDefault', 'stopPropagation'],
    pinnedBy: { 'tests/crowds.test.js': ['Enter', 'Escape'] } },
  [KEY_LISTENER.busyness]: {
    what: 'a busyness handle number field: Enter applies what was typed (TST-04 mutant C5 breaks it)',
    keys: ['Enter'], reads: ['preventDefault'],
    pinnedBy: { 'tests/crowds.test.js': ['Enter'] } },
  [KEY_LISTENER.exportEscape]: {
    what: 'Escape during a video export cancels it, ahead of every other listener',
    keys: ['Escape'], reads: ['preventDefault', 'stopImmediatePropagation'] },
  [KEY_LISTENER.contextMenu]: {
    what: 'an open context menu: arrows, Home and End move, Escape and Tab close it; it holds every other key back',
    keys: ['ArrowDown', 'ArrowUp', 'End', 'Escape', 'Home', 'Tab'], reads: ['preventDefault', 'stopPropagation'] },
  [KEY_LISTENER.menuButton]: {
    what: 'a menu button (File, Export): Enter, Space and ↓ open its menu',
    keys: [' ', 'ArrowDown', 'Enter'], reads: ['preventDefault'] },
  [KEY_LISTENER.menu]: {
    what: 'an open menu: arrows, Home and End move, Escape closes it to its button, Tab closes it',
    keys: ['ArrowDown', 'ArrowUp', 'End', 'Escape', 'Home', 'Tab'], reads: ['preventDefault'] },
  [KEY_LISTENER.menuAnywhere]: {
    what: 'Escape anywhere closes an open menu',
    keys: ['Escape'], reads: [] },
  [KEY_LISTENER.hint]: {
    what: 'Escape hides an open hint, and keeps it hidden while focus stays',
    keys: ['Escape'], reads: [],
    pinnedBy: { 'tests/paramTooltip.test.js': ['Escape'] } },
  [KEY_LISTENER.outline]: {
    what: 'Escape in a scene outline field drops the draft and resets its form',
    keys: ['Escape'], reads: ['preventDefault', 'stopPropagation', 'target'],
    pinnedBy: { 'tests/sceneOutline.test.js': ['Escape'] } },
  [KEY_LISTENER.sectionHeader]: {
    what: 'a settings section header: Enter and Space open and close it (TST-04 mutant C8 breaks it)',
    keys: [' ', 'Enter'], reads: ['preventDefault'] },
  [KEY_LISTENER.more]: {
    what: 'a More disclosure: Enter and Space open and close it',
    keys: [' ', 'Enter'], reads: ['preventDefault'],
    pinnedBy: { 'tests/reviewAccessibility.test.js': ['Enter', ' '] } },
  [KEY_LISTENER.waypointRename]: {
    what: "a waypoint's rename field: Enter keeps the name typed, Escape the old one; no key reaches the page",
    keys: ['Enter', 'Escape'], reads: ['preventDefault', 'stopPropagation'],
    pinnedBy: { 'tests/waypointList.test.js': ['Enter'] } },
  [KEY_LISTENER.waypointRow]: {
    what: 'F2 on a waypoint row selects it and starts its rename; the selection reads Shift and Ctrl/Cmd, ' +
      'as a click on the row does',
    keys: ['F2'], reads: ['ctrlKey', 'metaKey', 'preventDefault', 'shiftKey'] },
  [KEY_LISTENER.dispatcher]: {
    what: "the page's shortcut dispatcher, which lower-cases each key before it compares",
    anyCase: [...new Set(DISPATCH.map(([key]) => key))],
    reads: ['ctrlKey', 'defaultPrevented', 'metaKey', 'preventDefault', 'shiftKey', 'target'],
    here: 'what the page shortcuts react to (TST-13)' },
  [KEY_LISTENER.cursorDown]: {
    what: 'the canvas cursor while a modifier is held',
    keys: ['Alt', 'Control', 'Meta', 'Shift'], reads: ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'],
    here: 'modifier keys held on their own (TST-13)' },
  [KEY_LISTENER.cursorUp]: {
    what: 'the canvas cursor when a modifier is let go',
    keys: ['Alt', 'Control', 'Meta', 'Shift'], reads: ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'],
    here: 'modifier keys held on their own (TST-13)' },
  [KEY_LISTENER.playerTimeline]: {
    what: "the exported player's timeline: arrows step 5 s, Page Up and Down 10 s, Home and End go to the ends",
    keys: ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp'],
    reads: ['preventDefault'],
    suite: 'tests/playerEntryAccessibility.test.js' },
  [KEY_LISTENER.playerPage]: {
    what: "the exported player's page: Space and K play and pause, Home and End, and the arrows seek 1 s; " +
      'a focused control keeps its own keys',
    keys: [' ', 'ArrowLeft', 'ArrowRight', 'End', 'Home', 'k'], reads: ['preventDefault', 'target'],
    suite: 'tests/playerEntryAccessibility.test.js' },
  [KEY_LISTENER.areaDrawing]: {
    what: 'Escape while drawing an area cancels the drawing, ahead of the page',
    keys: ['Escape'], reads: ['preventDefault', 'stopPropagation'] },
  [KEY_LISTENER.networkPen]: {
    what: 'drawing a network: the Escape ladder, Delete and Backspace, and T in either case, ahead of the page',
    keys: ['Backspace', 'Delete', 'Escape'], anyCase: ['t'], reads: ['preventDefault', 'stopPropagation', 'target'],
    pinnedBy: { 'tests/networkEdit.test.js': ['Escape', 't', 'Delete'] } },
  [KEY_LISTENER.focusTrap]: {
    what: "an open dialog's focus trap: Tab and Shift+Tab wrap, Escape closes the dialog",
    keys: ['Escape', 'Tab'], reads: ['preventDefault', 'shiftKey', 'stopImmediatePropagation'],
    pinnedBy: { 'tests/reviewAccessibility.test.js': ['Tab', 'Escape'] } }
};

/** Mentions of a listener method that register nothing, and why. */
const NOT_REGISTRATIONS = {
  'src/services/StorageService.js: target.addEventListener, not called':
    'a feature test: attachLifecycle checks its target can take listeners before adding its own, ' +
    'each with a literal type the scan reads'
};

/**
 * A row's key presses, by the listener each is for, so a row can be held to
 * pressing every key its listeners compare, and to sweeping every other key
 * of the domain past them. `held` presses each keydown as a key held down
 * repeats it (`repeat` set; a keyup never repeats).
 */
function keyLog({ held = false } = {}) {
  const pressed = {};
  const swept = new Set();
  const findings = {};
  const dispatched = new Set(DISPATCH.map(([key]) => key));
  const log = {
    /** A key pressed for `listener`'s sake, on `target`. */
    press(listener, key, target = document.activeElement, flags = {}, type = 'keydown') {
      (pressed[listener] ??= new Set()).add(key);
      const repeat = held && type === 'keydown';
      const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true, repeat, ...flags });
      target.dispatchEvent(event);
      return event;
    },
    /**
     * Press every key of the domain that `listener` does not compare, on its
     * target (a function where the target is rebuilt): a key that changes
     * `state()` or is taken is a finding, and a row must have none. Where the
     * key lands on the page itself (`page`, the app), the page's dispatcher
     * takes its own keys too, so for those it is suspended through its own
     * `setEnabled`, as the app suspends it while it builds: they reach the
     * listener under test alone, and the rest meet the page as it is.
     */
    sweep(listener, target, state, { page = null, type = 'keydown' } = {}) {
      const { keys = [], anyCase = [] } = KEY_LISTENERS[listener];
      const compared = new Set([...keys, ...anyCase.flatMap(key => [key, key.toUpperCase()])]);
      const found = [];
      for (const key of CANDIDATE_KEYS) {
        if (compared.has(key)) continue;
        const dispatcher = page && dispatched.has(key.toLowerCase()) ? page.interactionHandler : null;
        const enabled = dispatcher?.enabled;
        dispatcher?.setEnabled(false);
        try {
          const was = state();
          const event = log.press(listener, key, typeof target === 'function' ? target() : target, {}, type);
          const now = state();
          if (event.defaultPrevented || now !== was) {
            found.push(`${key === ' ' ? 'Space' : key}: ${taken(event)}; ${now}`);
          }
        } finally {
          dispatcher?.setEnabled(enabled);
        }
      }
      swept.add(listener);
      if (found.length > 0) findings[listener] = found;
    },
    /** The keys `listener` compares that no press was for. */
    unpressed(listener) {
      const { keys = [], anyCase = [] } = KEY_LISTENERS[listener];
      return [...keys, ...anyCase].filter(key => !pressed[listener]?.has(key));
    },
    swept: listener => swept.has(listener),
    findings: () => findings
  };
  return log;
}

/**
 * The rows that press the local key listeners: each covers its listeners,
 * pressing every key their handlers compare on their targets and recording
 * what each did, then sweeping every other key of the domain past them.
 * Keys are pressed without modifiers, but for Shift+Tab in the focus trap:
 * the modifiers a handler reads are pinned from its source (KEY_LISTENERS).
 * Each row runs twice from a fresh editor, its keydowns pressed once and then
 * held down, and must record the same both times.
 */
const LISTENER_ROWS = [
  {
    title: 'Enter in a busyness handle field applies what was typed; every other key, and a read-only field, do not',
    covers: [KEY_LISTENER.busyness],
    async run(log) {
      const app = await editor();
      document.getElementById('add-crowd-btn').click();
      const envelope = () => app.selectedCrowd.emitters[0].busynessEnvelope
        .map(({ time, value }) => `${time}:${value}`).join(' ');
      const field = (index, name) =>
        document.querySelector(`[data-busyness-index="${index}"][data-busyness-field="${name}"]`);
      const said = () => document.getElementById('announcer').textContent || '—';
      const step = (name, target, key, typedValue) => {
        target.value = typedValue;
        document.getElementById('announcer').textContent = '';
        const event = log.press(KEY_LISTENER.busyness, key, target);
        return `${name}: ${key} ${taken(event)}; ${envelope()}; said ${said()}`;
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
      // A value typed and every other key pressed: nothing is applied.
      field(0, 'value').value = '55';
      document.getElementById('announcer').textContent = '';
      log.sweep(KEY_LISTENER.busyness, () => field(0, 'value'), () => `${envelope()}; said ${said()}`);
    }
  },

  {
    title: "a crowd's rename field: Enter keeps the name typed, Escape the old one; every other key stays in it",
    covers: [KEY_LISTENER.crowdRename],
    async run(log) {
      const app = await editor();
      document.getElementById('add-crowd-btn').click();
      const layer = app.selectedCrowd;
      const renaming = () => document.querySelector('#layers-strip .layer-rename-input');
      const rename = () => [...document.querySelectorAll('#layers-strip .layer-row')]
        .find(row => row.textContent.includes(layer.name))
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const state = () => `${renaming() ? `renaming "${renaming().value}"` : 'done'}, named ${layer.name}`;
      const page = keysReachingThePage();
      rename();
      const steps = [`double-click: ${state()}, focus ${focusName()}`];
      log.sweep(KEY_LISTENER.crowdRename, renaming, state);
      renaming().value = 'Visitors';
      steps.push(`Enter: ${taken(log.press(KEY_LISTENER.crowdRename, 'Enter', renaming()))}; ${state()}`);
      rename();
      renaming().value = 'Others';
      steps.push(`Escape: ${taken(log.press(KEY_LISTENER.crowdRename, 'Escape', renaming()))}; ${state()}`);
      page.stop();
      expect(page.keys, 'keys the rename field let through to the page').toEqual([]);
      expect(steps).toEqual([
        'double-click: renaming "Crowd 1", named Crowd 1, focus Crowd name',
        'Enter: taken; done, named Visitors',
        'Escape: taken; done, named Visitors'
      ]);
    }
  },

  {
    title: 'Enter and Space on a settings section header open and close it; every other key does not',
    covers: [KEY_LISTENER.sectionHeader],
    async run(log) {
      await editor();
      const section = document.querySelector('.settings-section[data-section="video"]');
      const header = section.querySelector('.section-header');
      header.focus();
      const state = () => `${header.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed'}` +
        `${section.classList.contains('expanded') ? '' : ' (no class)'}, last used ` +
        `${document.querySelector('.settings-section[data-last="true"]')?.dataset.section ?? 'none'}`;
      const before = state();
      const steps = ['a', 'Enter', ' ', 'Tab'].map(key =>
        `${key === ' ' ? 'Space' : key}: ${taken(log.press(KEY_LISTENER.sectionHeader, key, header))}; ${state()}`);
      // Focus alone marks the section last used (SectionController's focusin).
      expect([before, ...steps]).toEqual([
        'closed (no class), last used video',
        'a: left; closed (no class), last used video',
        'Enter: taken; open, last used video',
        'Space: taken; closed (no class), last used video',
        'Tab: left; closed (no class), last used video'
      ]);
      log.sweep(KEY_LISTENER.sectionHeader, header, state);
    }
  },

  {
    title: 'Enter and Space on a More disclosure open and close it; every other key does not',
    covers: [KEY_LISTENER.more],
    async run(log) {
      await editor();
      const disclosure = document.querySelector('.section-more');
      const summary = disclosure.querySelector('summary');
      summary.focus();
      const state = () => (disclosure.open ? 'open' : 'closed');
      expect(['Enter', ' ', 'a'].map(key =>
        `${key === ' ' ? 'Space' : key}: ${taken(log.press(KEY_LISTENER.more, key, summary))}; ${state()}`))
        .toEqual(['Enter: taken; open', 'Space: taken; closed', 'a: left; closed']);
      log.sweep(KEY_LISTENER.more, summary, state);
    }
  },

  {
    title: 'F2 on a waypoint row starts its rename; Enter keeps the new name, Escape the old one; other keys do not',
    covers: [KEY_LISTENER.waypointRow, KEY_LISTENER.waypointRename],
    async run(log) {
      const app = await editor();
      const row = index =>
        document.querySelector(`#waypoint-list .waypoint-item[data-route-index="${index}"] .waypoint-row`);
      const renaming = () => document.querySelector('#waypoint-list .waypoint-rename-input');
      const names = () => app.waypoints.map(wp => wp.name || '—').join(', ');
      const selected = () => `selected ${app.waypoints.indexOf(app.selectedWaypoint) + 1}`;
      // Every key but F2 on a row starts nothing and selects nothing.
      log.sweep(KEY_LISTENER.waypointRow, () => row(2),
        () => `${renaming() ? 'renaming' : 'not renaming'}, ${selected()}`);
      const steps = [];
      let event = log.press(KEY_LISTENER.waypointRow, 'F3', row(2));
      await frame();
      steps.push(`F3 on row 3: ${taken(event)}; ${renaming() ? 'renaming' : 'not renaming'}`);
      event = log.press(KEY_LISTENER.waypointRow, 'F2', row(2));
      await frame();
      steps.push(`F2 on row 3: ${taken(event)}; renaming "${renaming().value}", focus ${focusName()}`);
      // Every key but Enter and Escape in the rename field stays in it.
      renaming().value = 'Lab';
      log.sweep(KEY_LISTENER.waypointRename, renaming,
        () => `${renaming() ? `renaming "${renaming().value}"` : 'done'}; names ${names()}`);
      event = log.press(KEY_LISTENER.waypointRename, 'Enter', renaming());
      steps.push(`Enter: ${taken(event)}; ${renaming() ? 'renaming' : 'done'}; names ${names()}`);
      event = log.press(KEY_LISTENER.waypointRow, 'F2', row(2));
      await frame();
      renaming().value = 'Library';
      event = log.press(KEY_LISTENER.waypointRename, 'Escape', renaming());
      steps.push(`F2, then Escape: ${taken(event)}; ${renaming() ? 'renaming' : 'done'}; names ${names()}, ` +
        `selected ${app.selectedWaypoint === app.waypoints[2] ? 'row 3' : 'another'}`);
      expect(steps).toEqual([
        'F3 on row 3: left; not renaming',
        'F2 on row 3: taken; renaming "", focus Rename Waypoint 3',
        'Enter: taken; done; names —, —, Lab',
        'F2, then Escape: taken; done; names —, —, Lab, selected row 3'
      ]);
    }
  },

  {
    title: 'the Export menu: Enter, Space and ↓ open it; ↓ ↑ Home End move in it; Escape and Tab close it, ' +
      'and Escape on the page; other keys do nothing',
    covers: [KEY_LISTENER.menuButton, KEY_LISTENER.menu, KEY_LISTENER.menuAnywhere],
    async run(log) {
      const app = await editor();
      const trigger = document.getElementById('export-dropdown-btn');
      const menu = document.getElementById('export-menu');
      trigger.focus();
      const state = () => `${menu.classList.contains('is-open') ? 'open' : 'closed'} ` +
        `(${trigger.getAttribute('aria-expanded')}), focus ${focusName()}`;
      const step = (listener, key, target = document.activeElement) =>
        `${key === ' ' ? 'Space' : key}: ${taken(log.press(listener, key, target))}; ${state()}`;
      const { menuButton, menu: open, menuAnywhere } = KEY_LISTENER;
      // Every other key on the closed menu's button opens nothing.
      log.sweep(menuButton, trigger, state);
      expect([
        step(menuButton, 'Enter'), step(open, 'ArrowDown'), step(open, 'End'), step(open, 'ArrowDown'),
        step(open, 'ArrowUp'), step(open, 'Home'), step(open, 'Escape'), step(menuButton, ' '), step(open, 'Tab'),
        step(menuButton, 'ArrowDown', trigger), step(menuAnywhere, 'Escape', document.body)
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
      // Open again: every other key in the menu, and on the page, leaves it open where it is.
      log.press(menuButton, 'Enter', trigger);
      log.sweep(open, () => document.activeElement, state);
      log.sweep(menuAnywhere, document.body, state, { page: app });
    }
  },

  {
    title: "a waypoint's context menu: ↓ ↑ Home End move, Tab and Escape close it; it holds every other key back",
    covers: [KEY_LISTENER.contextMenu],
    async run(log) {
      const app = await editor();
      const { x, y } = app.imageToCanvas(0.75, 0.5);
      const open = () => {
        app.canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2,
          clientX: x, clientY: y }));
      };
      const menu = () => document.querySelector('.context-menu');
      const state = () => `${menu()?.style.display === 'block' ? 'open' : 'closed'}, focus ${focusName()}`;
      const step = (key, target = document.activeElement) =>
        `${key}: ${taken(log.press(KEY_LISTENER.contextMenu, key, target))}; ${state()}`;
      open();
      const steps = [`opened: ${state()}`, step('ArrowDown'), step('End'), step('ArrowDown'), step('ArrowUp'),
        step('Home')];
      // Sent to the page, T would convert the selected waypoint; under the
      // menu, the menu's capture-phase listener holds it back from the page.
      const route = app.waypoints.map(describeWaypoint).join(' ');
      const page = keysReachingThePage();
      steps.push(step('t', document.body));
      // Every other key in the menu is held back too, and moves nothing.
      log.sweep(KEY_LISTENER.contextMenu, () => document.activeElement, state);
      page.stop();
      steps.push(`route ${app.waypoints.map(describeWaypoint).join(' ') === route ? 'unchanged' : 'changed'}, ` +
        `${page.keys.length} keys reached the page`);
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
        'route unchanged, 0 keys reached the page',
        'Tab: left; closed, focus the page',
        'Escape: taken; closed, focus the page'
      ]);
    }
  },

  {
    title: 'Escape while drawing an area cancels the drawing, and leaves the selection; other keys do not',
    covers: [KEY_LISTENER.areaDrawing],
    async run(log) {
      const app = await editor();
      document.getElementById('area-draw-btn').click();
      const state = () => `${app.areaDrawingService.isDrawing ? 'drawing' : 'not drawing'}, ` +
        `selected ${app.selectedWaypoint ? describeWaypoint(app.selectedWaypoint) : 'none'}`;
      const before = state();
      log.sweep(KEY_LISTENER.areaDrawing, document.body, state, { page: app });
      const page = keysReachingThePage();
      const event = log.press(KEY_LISTENER.areaDrawing, 'Escape', document.body);
      page.stop();
      expect([before, `Escape: ${taken(event)}; ${state()}; reached the page: ${page.keys.join(' ') || 'nothing'}`])
        .toEqual([
          'drawing, selected major 0.5,0.5',
          'Escape: taken; not drawing, selected major 0.5,0.5; reached the page: nothing'
        ]);
    }
  },

  {
    title: 'Escape during a video export cancels it, and leaves the selection; other keys do not',
    covers: [KEY_LISTENER.exportEscape],
    async run(log) {
      const app = await editor();
      let started;
      const exportRunning = new Promise(resolve => { started = resolve; });
      let cancelled = 0;
      app.videoExporter = {
        cancel() { cancelled += 1; this.stop?.(new Error('Export cancelled')); },
        export() {
          started();
          return new Promise((resolve, reject) => { this.stop = reject; });
        }
      };
      const exporting = app.exportVideo();
      await exportRunning;
      log.sweep(KEY_LISTENER.exportEscape, document.body, () => `cancelled ${cancelled}`, { page: app });
      const page = keysReachingThePage();
      const event = log.press(KEY_LISTENER.exportEscape, 'Escape', document.body);
      page.stop();
      await exporting;
      expect({ escape: taken(event), cancelled, said: document.getElementById('announcer').textContent,
        selected: app.selectedWaypoint ? describeWaypoint(app.selectedWaypoint) : 'none', reached: page.keys })
        .toEqual({
          escape: 'taken', cancelled: 1, said: 'Video export cancelled', selected: 'major 0.5,0.5', reached: []
        });
    }
  },

  {
    title: 'drawing a network: T cycles the node, Escape lifts the pen then the selection then leaves; ' +
      'Delete and Backspace delete; other keys do not',
    covers: [KEY_LISTENER.networkPen],
    async run(log) {
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
      const state = () => `${service.active ? 'drawing' : 'not drawing'}, pen ${service.penNodeId ? 'down' : 'up'}, ` +
        `${service.selection ? `${service.selection.kind} selected` : 'nothing selected'}, ` +
        `${graph.getNodes().length} nodes ${graph.getEdges().length} edges, ` +
        `types ${graph.getNodes().map(node => node.type).join(' ')}`;
      log.sweep(KEY_LISTENER.networkPen, document.body, state, { page: app });
      const page = keysReachingThePage();
      const step = key => `${key}: ${taken(log.press(KEY_LISTENER.networkPen, key, document.body))}; ${state()}`;
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
  },

  {
    title: 'Escape hides an open hint; every other key leaves it open',
    covers: [KEY_LISTENER.hint],
    async run(log) {
      const app = await editor();
      document.querySelector('#pause-time-control [data-tip]').click();
      const hint = () => document.getElementById('param-tooltip');
      const state = () => (hint()?.style.display === 'block' ? `showing "${hint().textContent}"` : 'hidden');
      const shown = state();
      log.sweep(KEY_LISTENER.hint, document.body, state, { page: app });
      const event = log.press(KEY_LISTENER.hint, 'Escape', document.body);
      // The page's own Escape takes the key too: it clears the selection.
      expect([shown, `Escape: ${taken(event)}; ${state()}`])
        .toEqual(['showing "How long the animation pauses at this waypoint"', 'Escape: taken; hidden']);
    }
  },

  {
    title: 'Escape in a scene outline field resets its form; every other key leaves the draft',
    covers: [KEY_LISTENER.outline],
    async run(log) {
      await editor();
      const form = await vi.waitFor(() => {
        const found = document.querySelector('#scene-outline form[data-outline-form-key="route:add-submit"]');
        expect(found).toBeTruthy();
        return found;
      });
      const field = () => form.elements.x;
      field().focus();
      field().value = '42';
      const state = () => `x ${field().value}, focus ${focusName()}`;
      const typed = state();
      log.sweep(KEY_LISTENER.outline, field, state);
      const onAButton = log.press(KEY_LISTENER.outline, 'Escape', form.querySelector('[type="submit"]'));
      const afterButton = state();
      field().focus();
      const inTheField = log.press(KEY_LISTENER.outline, 'Escape', field());
      // Escape anywhere but a field is not the outline's: its button keeps it.
      expect([typed, `Escape on its button: ${taken(onAButton)}; ${afterButton}`,
        `Escape in the field: ${taken(inTheField)}; ${state()}`]).toEqual([
        'x 42, focus the x field',
        'Escape on its button: left; x 42, focus the x field',
        'Escape in the field: taken; x 50, focus Add waypoint'
      ]);
    }
  },

  {
    title: "an open dialog's focus trap: Tab and Shift+Tab wrap, Escape closes it; every other key stays in it",
    covers: [KEY_LISTENER.focusTrap],
    async run(log) {
      await editor();
      press('?');
      const dialog = document.getElementById('splash');
      // The trap starts when the dialog shows (a MutationObserver), with focus on its title.
      await vi.waitFor(() => expect(document.activeElement.id).toBe('splash-title'));
      const state = () => `${dialog.style.display === 'flex' ? 'open' : 'closed'}, focus ${focusName()}`;
      const step = (key, flags = {}) => `${flags.shiftKey ? 'Shift+' : ''}${key}: ` +
        `${taken(log.press(KEY_LISTENER.focusTrap, key, document.activeElement, flags))}; ${state()}`;
      const steps = [`opened: ${state()}`, step('Tab'), step('Tab', { shiftKey: true }), step('Tab')];
      log.sweep(KEY_LISTENER.focusTrap, () => document.activeElement, state);
      steps.push(step('Escape'));
      expect(steps).toEqual([
        'opened: open, focus #splash-title',
        'Tab: taken; open, focus #splash-close-x',
        'Shift+Tab: taken; open, focus licences and third-party notices (opens in a new tab)',
        'Tab: taken; open, focus #splash-close-x',
        'Escape: taken; closed, focus #splash-close-x'
      ]);
    }
  }
];

/** Each row run twice, from a fresh editor: its keydowns pressed once, then held down. */
const ROW_RUNS = LISTENER_ROWS.flatMap(row => [[row.title, row, false], [`held down: ${row.title}`, row, true]]);

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What the inventory compares of a handler: the keys, anyCase and reads, sorted, and every use it could not read. */
const readShape = ({ keys = [], anyCase = [], reads = [] }, unanalysed = []) =>
  ({ keys: [...keys].sort(), anyCase: [...anyCase].sort(), reads: [...reads].sort(), unanalysed });

/** A scan's listeners, by name, as the inventory compares them with KEY_LISTENERS. */
const scannedReads = listeners =>
  Object.fromEntries(listeners.map(({ name, reads }) => [name, readShape(reads, reads.unanalysed)]));

/** KEY_LISTENERS as the inventory holds the scan to it: with no use left unread. */
const REVIEWED_READS = Object.fromEntries(Object.entries(KEY_LISTENERS)
  .map(([name, entry]) => [name, readShape(entry)]));

/** A file of `src/` with a review's edits made in memory, read as the inventory reads `src/`. */
function scanEdited(file, edits) {
  let text = readFileSync(join(repoRoot, file), 'utf8');
  for (const [anchor, replacement] of edits) {
    expect(text.split(anchor), `the anchor in ${file}; if the source moved, move it`).toHaveLength(2);
    text = text.replace(anchor, () => replacement);
  }
  return keyListenersIn([{ file, lexed: lex(text) }]);
}

/**
 * The pages the app runs in: the editor's `index.html`, and the exported
 * player's page as the HTML export writes it, built without the constructor
 * (which would fetch the player bundle) and with an empty bundle: the bundle
 * is built from `src/player`, which the scan reads.
 */
const PAGES = {
  'index.html': readFileSync(join(repoRoot, 'index.html'), 'utf8'),
  'the exported player': Object.create(HTMLExportService.prototype)._generateHTML('Route', null, {}, '')
};

/** The scripts each page runs: the editor's bundle of `src/`, and the export's data and player bundle. */
const PAGE_SCRIPTS = { 'index.html': ['app.js'], 'the exported player': ['inline', 'inline'] };

/**
 * How a page could take keys outside `src/`, parsed as a browser parses it:
 * each element's inline key handler or accesskey attribute (in any spacing or
 * case), each script it runs (`inline`, or its `src`), and the key listeners
 * of its inline scripts, with what of their listening cannot be read, read as
 * `src/` is.
 */
function keysInPage(html) {
  const page = new DOMParser().parseFromString(html, 'text/html');
  const attributes = [...page.querySelectorAll('*')].flatMap(element => [...element.attributes]
    .filter(({ name }) => /^(?:onkey(?:down|up|press)|accesskey)$/i.test(name))
    .map(({ name }) => `<${element.localName} ${name}>`));
  const scripts = [...page.querySelectorAll('script')];
  const inline = keyListenersIn(scripts.filter(script => !script.hasAttribute('src'))
    .map((script, index) => ({ file: `inline script ${index + 1}`, lexed: lex(script.textContent) })));
  return {
    attributes,
    scripts: scripts.map(script => script.getAttribute('src') ?? 'inline'),
    listeners: inline.listeners.map(({ name }) => name),
    unread: inline.unread
  };
}

describe('every key listener the app adds (TST-13)', () => {

  test('each key listener in src/: what its handler reads, from the source, and where its keys are pressed', () => {
    const { listeners, unread } = sourceKeyListeners();
    expect(unread.sort(), 'ways of listening the scan cannot read (NOT_REGISTRATIONS says why one registers nothing)')
      .toEqual(Object.keys(NOT_REGISTRATIONS).sort());
    expect(listeners.map(({ name }) => name).sort(), 'key listeners in src/ (a new one needs a KEY_LISTENERS row)')
      .toEqual(Object.keys(KEY_LISTENERS).sort());
    expect(scannedReads(listeners), 'what each handler reads of its event, from its source (KEY_LISTENERS)')
      .toEqual(REVIEWED_READS);
    // Keys set as properties, or in the pages' markup, would escape the scan.
    for (const { file, lexed } of lexedFiles(repoRoot, 'src')) {
      expect(lexed.code.match(/(?<![\w$])onkey(down|up|press)(?![\w$])/g), `${file} names an onkey handler`).toBeNull();
      // In any case, as markup the code writes reads it; and an accesskey, a shortcut no listener sees.
      expect(lexed.code.match(/(?<![\w$])(?:onkey(?:down|up|press)|accesskey)(?![\w$])/gi),
        `${file} names an onkey handler or an accesskey, in any case`).toBeNull();
    }
    expect(readFileSync(join(repoRoot, 'index.html'), 'utf8')).not.toMatch(/onkey(down|up|press)=/i);
    // Round 3's review: `onkeydown = "…"`, spaced, slipped past the line above.
    // Each page is read as a browser parses it, and runs only what is built from src/.
    for (const [name, html] of Object.entries(PAGES)) {
      expect(keysInPage(html), `${name}: key handlers in its markup or inline scripts, and the scripts it runs`)
        .toEqual({ attributes: [], scripts: PAGE_SCRIPTS[name], listeners: [], unread: [] });
    }

    const ownSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    for (const [name, { what, keys = [], here, suite, pinnedBy = {} }] of Object.entries(KEY_LISTENERS)) {
      expect(what, name).toMatch(/\w/);
      const rows = LISTENER_ROWS.filter(({ covers }) => covers.includes(name));
      expect(rows.length + (here ? 1 : 0) + (suite ? 1 : 0), `${name} has one place that presses its keys`).toBe(1);
      if (here) expect(ownSource, `${name}'s tables here`).toContain(`describe('${here}'`);
      // A light check of the other suites named: each exists, and names the keys.
      const suites = suite ? { [suite]: keys, ...pinnedBy } : pinnedBy;
      for (const [file, named] of Object.entries(suites)) {
        expect(existsSync(join(repoRoot, file)), `${file} (${name})`).toBe(true);
        const source = readFileSync(join(repoRoot, file), 'utf8');
        expect(named.filter(key => !new RegExp(`(['"])${escapeRegExp(key)}\\1`).test(source)),
          `keys ${file} never names (${name})`).toEqual([]);
      }
    }
    expect(LISTENER_ROWS.flatMap(({ covers }) => covers).filter(name => !(name in KEY_LISTENERS)),
      'rows covering a listener the inventory does not have').toEqual([]);
  });

  test('the listener scan fails closed: an alias, a computed name, an unread type, a stray event name, an event it cannot follow', () => {
    const scan = source => keyListenersIn([{ file: 'fixture.js', lexed: lex(source) }]);
    const read = handler => {
      const { listeners: [listener], unread } = scan(`document.addEventListener('keydown', ${handler});`);
      expect(unread).toEqual([]);
      const { keys, anyCase, reads, unanalysed } = listener.reads;
      return { keys: [...keys].sort(), anyCase: [...anyCase].sort(), reads: [...reads].sort(), unanalysed };
    };
    const none = { keys: [], anyCase: [], reads: [] };
    // Round 2's review: an alias registers a listener no call shows, so the
    // scan reports the alias, and the event type named outside a call.
    expect(scan("const listen = document.addEventListener.bind(document);\nlisten('keydown', event => {\n" +
      "  if (event.key === 'F4') event.preventDefault();\n});")).toEqual({
      listeners: [],
      unread: ['fixture.js: document.addEventListener, not called',
        "fixture.js:2 names 'keydown' outside a listener call"]
    });
    // A computed name is still a call, and is read like one.
    expect(scan("document['addEventListener']('keydown', e => e.key === 'q');").listeners
      .map(({ name, reads }) => [name, [...reads.keys]])).toEqual([['fixture.js: document keydown', ['q']]]);
    expect(scan('target.addEventListener(type, handler);').unread)
      .toEqual(['fixture.js:1 addEventListener(type, …)']);
    // Round 2's review: a property read by a computed name is a property read.
    expect(read("e => { if (e['repeat']) return; if (e.key === 'a' || 'b' === e.key) e.preventDefault(); }"))
      .toEqual({ keys: ['a', 'b'], anyCase: [], reads: ['preventDefault', 'repeat'], unanalysed: [] });
    expect(read("e => { switch (e.key) { case 'c': break; } " +
      "return ['d'].includes(e.key) || e.key.toLowerCase() === 'e'; }"))
      .toEqual({ keys: ['c', 'd'], anyCase: ['e'], reads: [], unanalysed: [] });
    // Anything else done with the key or the event is reported, not ignored.
    expect(read('e => { const key = e.key; run(key); }'))
      .toEqual({ ...none, unanalysed: ['line 1: key, which holds the key, is used other than in a comparison'] });
    expect(read('e => { const copy = e; }'))
      .toEqual({ ...none, unanalysed: ['line 1: e is used other than by reading a property of it'] });
    expect(read('e => { elsewhere(e); }')).toEqual({ ...none, unanalysed: [
      'line 1: e is passed to elsewhere, which the scan cannot follow (no function elsewhere in this file)'] });
    expect(read('e => { menu.handle(e); }'))
      .toEqual({ ...none, unanalysed: ['line 1: e is used other than by reading a property of it'] });
    // An event passed to a function of the same file is followed there, as is
    // a method a constructor binds.
    const followed = scan("function follow(event, extra) { return event.key === 'f' && event.shiftKey; }\n" +
      "document.addEventListener('keydown', e => follow(e, 1));").listeners[0].reads;
    expect([[...followed.keys], [...followed.reads], followed.unanalysed]).toEqual([['f'], ['shiftKey'], []]);
    expect(scan("class Pane {\n  constructor() { this.onKey = this.onKey.bind(this);\n" +
      "    document.addEventListener('keyup', this.onKey); }\n  onKey(event) { return event.key === 'g'; }\n}")
      .listeners.map(({ name, reads }) => [name, [...reads.keys], reads.unanalysed]))
      .toEqual([['fixture.js: document keyup', ['g'], []]]);
  });

  test('the reader reports a case, a member or a comparison it cannot read; it reads a helper at each argument', () => {
    const scan = source => keyListenersIn([{ file: 'fixture.js', lexed: lex(source) }]);
    const read = (handler, before = '') => {
      const { listeners: [listener], unread } = scan(`${before}document.addEventListener('keydown', ${handler});`);
      expect(unread).toEqual([]);
      return readShape(listener.reads, listener.reads.unanalysed);
    };
    const on = 'line 1: the key is compared with ';
    // Round 3's review: a case, or a member of an array, that is not a literal
    // was dropped, and the rest read as all the handler compares. Every one is
    // read now, or reported; a switch nested in a case is not the key's.
    expect(read("e => { switch (e.key) { case 'a': case EXTRA: break; case 'b': { switch (x) { case 1: } } } }"))
      .toEqual({ keys: ['a', 'b'], anyCase: [], reads: [], unanalysed: [`${on}case EXTRA`] });
    expect(read("e => { if (['Enter', EXTRA, ...more].includes(e.key)) e.preventDefault(); }")).toEqual({
      keys: ['Enter'], anyCase: [], reads: ['preventDefault'],
      unanalysed: [`${on}[…] member EXTRA`, `${on}[…] member ...more`]
    });
    expect(read("e => { const key = e.key.toLowerCase(); switch (key) { case 'c': case `d`: case `${x}`: } }"))
      .toEqual({ keys: [], anyCase: ['c', 'd'], reads: [], unanalysed: [`${on}case \`\${x}\``] });
    // A literal or a key that is part of a larger expression is not what is compared.
    for (const [handler, part] of [
      ["e => e.key === 'F' + n", "e.key === 'F'"],
      ["e => x + 'q' === e.key", "'q' === e.key"],
      ["e => 'q'.toUpperCase() === e.key || e.key === 'Q'.toLowerCase()", "e.key === 'Q'"],
      ["e => typeof e.key === 'string'", "e.key === 'string'"],
      ['e => e.key === `F${n}`', 'e.key === `F${']
    ]) {
      expect(read(handler).unanalysed, handler).toContain(`${on}${part}, not a whole literal`);
    }
    expect(read("e => e.key === 'a' ? 1 : e.key !== 'b' && 'c' === e.key").keys, 'whole literals')
      .toEqual(['a', 'b', 'c']);
    // Round 3's review: a helper passed the event first in one call and second
    // in another was read only for the first.
    const helper = 'function repeatOf(first, second) { return second?.repeat; }\n';
    expect(read('e => { repeatOf(e); if (repeatOf(null, e)) return; }', helper))
      .toEqual({ keys: [], anyCase: [], reads: ['repeat'], unanalysed: [] });
    // The event under another name, and options the scan cannot read.
    expect(read("e => { if (window.event.key === 'q' || top['event'].repeat || event.repeat) e.preventDefault(); }")
      .unanalysed).toEqual(Array(3).fill('line 1: the global event, or a property named event, is read'));
    expect(read("function (e) { return arguments[0].key === 'q'; }").unanalysed).toEqual(['line 1: arguments is read']);
    expect(scan("document.addEventListener('keydown', e => e.key === 'a', options);").unread)
      .toEqual(["fixture.js:1 addEventListener('keydown', …, options)"]);
    expect(scan("document.addEventListener('keydown', e => e.key === 'a', { capture: true, once: true });")
      .listeners.map(({ name }) => name)).toEqual(['fixture.js: document keydown (capture, once)']);
  });

  test("round 3's review's mutants of the real source fail the inventory's own comparison", () => {
    // Each edit made in memory to the real file, read as the inventory reads it.
    const edited = (file, edits) => scannedReads(scanEdited(file, edits).listeners);
    // N2: a player shortcut added as a named case.
    const player = edited('src/player/playerEntry.js', [
      ['const TIMELINE_RESOLUTION = 10000;', "const EXTRA_PLAY_KEY = 'Q';\nconst TIMELINE_RESOLUTION = 10000;"],
      ["      case 'k':", "      case EXTRA_PLAY_KEY:\n      case 'k':"]
    ])[KEY_LISTENER.playerPage];
    expect(player).not.toEqual(REVIEWED_READS[KEY_LISTENER.playerPage]);
    expect(player).toEqual({ ...REVIEWED_READS[KEY_LISTENER.playerPage],
      unanalysed: [expect.stringMatching(/^line \d+: the key is compared with case EXTRA_PLAY_KEY$/)] });
    // N4: a held key ignored through a helper's second argument, the helper
    // having been passed the event first.
    const header = edited('src/controllers/SectionController.js', [
      ['export class SectionController',
        'function repeatOf(first, second) { return second?.repeat; }\n\nexport class SectionController'],
      ["      header.addEventListener('keydown', (e) => {",
        "      header.addEventListener('keydown', (e) => {\n        repeatOf(e);\n" +
        '        if (repeatOf(null, e)) return;']
    ])[KEY_LISTENER.sectionHeader];
    expect(header).not.toEqual(REVIEWED_READS[KEY_LISTENER.sectionHeader]);
    expect(header).toEqual({ ...REVIEWED_READS[KEY_LISTENER.sectionHeader], reads: ['preventDefault', 'repeat'] });
  });

  test("the reader follows a function only where its file does nothing else with the name (round 4's review, F1)", () => {
    const scan = source => keyListenersIn([{ file: 'fixture.js', lexed: lex(source) }]);
    // The helper the handler passes its event to on line 1, another use of its name on line 2, the listener on line 3.
    const helper = 'function ignoresKey(e) { return false; }';
    const unanalysed = line2 => {
      const { listeners: [listener], unread } = scan(`${helper}\n${line2}\n` +
        "document.addEventListener('keydown', e => { if (ignoresKey(e)) return; e.preventDefault(); });");
      expect(unread).toEqual([]);
      return listener.reads.unanalysed;
    };
    const beyond = ['line 3: e is passed to ignoresKey, which the scan cannot follow ' +
      '(line 2 uses ignoresKey other than by calling it or passing it on)'];
    // P1: the helper reassigned after its declaration was read as declared.
    for (const write of ['ignoresKey = e => e.altKey;', 'ignoresKey ||= e => e.altKey;', '(ignoresKey) = e => e.altKey;',
      '[ignoresKey] = [e => e.altKey];', '({ ignoresKey } = { ignoresKey: e => e.altKey });',
      'for (ignoresKey of [e => e.altKey]);']) {
      expect(unanalysed(write), write).toEqual(beyond);
    }
    // So is a parameter, a catch clause or a declaration that binds the name again.
    for (const binding of ['function wire(ignoresKey) {}', 'try {} catch (ignoresKey) {}',
      '{ const { ignoresKey } = helpers; }']) {
      expect(unanalysed(binding), binding).toEqual(beyond);
    }
    // Called, read as a member or passed on, it holds what was declared, and is read.
    expect(unanalysed('const late = ignoresKey.bind(null); setTimeout(ignoresKey, 0); ignoresKey(null);')).toEqual([]);
    // Written from a string by `eval`, it is not named in code: the file is reported.
    expect(scan(`${helper}\neval('ignoresKey = e => e.altKey');`).unread)
      .toEqual(['fixture.js:2 eval runs code the scan cannot read']);

    // A method followed through `this`: each `this.onKey =` is read, and the method with it.
    const pane = later => scan('class Pane {\n' +
      "  constructor() { this.onKey = this.onKey.bind(this); document.addEventListener('keyup', this.onKey); }\n" +
      `  onKey(event) { return event.key === 'g'; }\n  later() { ${later} }\n}`).listeners[0].reads;
    expect(pane('if (this.onKey) this.onKey(null);').unanalysed).toEqual([]);
    const assigned = pane('this.onKey = e => e.altKey;');
    expect([[...assigned.keys], [...assigned.reads], assigned.unanalysed]).toEqual([['g'], ['altKey'], []]);
    // Written another way, on another object, or named in a string, it is reported.
    for (const [write, use] of [
      ['this.onKey ||= e => e.altKey;', 'uses this.onKey other than by calling it or passing it on'],
      ['[this.onKey] = [e => e.altKey];', 'uses this.onKey other than by calling it or passing it on'],
      ['other.onKey = e => e.altKey;', 'uses this.onKey other than by calling it or passing it on'],
      ["Reflect.set(this, 'onKey', e => e.altKey);", 'names onKey in a string']
    ]) {
      expect(pane(write).unanalysed, write).toEqual([`its handler, this.onKey: line 4 ${use}`]);
    }
  });

  test("a name spelled with escapes is read as JavaScript reads it, or reported (round 4's review, F2)", () => {
    const scan = source => keyListenersIn([{ file: 'fixture.js', lexed: lex(source) }]);
    const listed = ({ listeners, unread }) => ({
      listeners: listeners.map(({ name, reads }) => [name, [...reads.keys], [...reads.reads].sort(), reads.unanalysed]),
      unread
    });
    // P3's listener: its method name and event type, static literals, escaped. The
    // method name is read as the call it spells; an escaped type is one the scan cannot read.
    expect(listed(scan("document['addEvent\\u004cistener']('key\\u0064own', e => { if (e.key === 'Ω') e.preventDefault(); });")))
      .toEqual({ listeners: [], unread: ["fixture.js:1 addEventListener('key\\u0064own', …)"] });
    expect(listed(scan("document['addEvent\\x4cistener']('keydown', e => e.key === 'q');")))
      .toEqual({ listeners: [['fixture.js: document keydown', ['q'], [], []]], unread: [] });
    // Escaped in code, the method name is still the call; and, as every name spelled so, reported.
    expect(listed(scan("document.addEvent\\u{4c}istener('keyup', e => e.key === 'r');"))).toEqual({
      listeners: [['fixture.js: document keyup', ['r'], [], []]],
      unread: ['fixture.js:1 addEvent\\u{4c}istener is a name spelled with an escape']
    });
    // An event type named outside a call: escaped, or a word of code in a string.
    expect(scan("const type = 'key\\u0064own';\nsetTimeout(\"document.addEventListener('keyup', f)\");").unread)
      .toEqual(["fixture.js:1 names 'keydown' outside a listener call", "fixture.js:2 names 'keyup' outside a listener call"]);
    // The event's own name, escaped, is reported in the handler and in its file.
    expect(listed(scan("document.addEventListener('keydown', e => { if (\\u0065.altKey) return; e.preventDefault(); });")))
      .toEqual({
        listeners: [['fixture.js: document keydown', [], ['preventDefault'],
          ['line 1: \\u0065 is a name spelled with an escape']]],
        unread: ['fixture.js:1 \\u0065 is a name spelled with an escape']
      });
    // The global event named in a string, escaped or not.
    expect(listed(scan("document.addEventListener('keydown', e => top['\\u0065vent'].altKey || Reflect.get(top, 'event'));"))
      .listeners[0][3]).toEqual(Array(2).fill('line 1: the global event, or a property named event, is read'));
    // A key handler set as a property or an attribute, in code or in a string, escaped or not.
    expect(scan("el.onkeydown = f;\nel['on\\u006beyup'] = f;\nel.setAttribute(`ACCESSKEY`, 'p');").unread).toEqual([
      'fixture.js:1 names onkeydown, a key handler no listener call shows',
      'fixture.js:2 names onkeyup, a key handler no listener call shows',
      'fixture.js:3 names ACCESSKEY, a key handler no listener call shows'
    ]);
  });

  test("round 4's review's mutants of the real source fail the inventory's own comparison", () => {
    // P1: the section header passes its event to a helper its file declares
    // and then reassigns to read Alt.
    const header = scannedReads(scanEdited('src/controllers/SectionController.js', [
      ['export class SectionController',
        'function ignoresKey(e) { return false; }\nignoresKey = e => e.altKey;\n\nexport class SectionController'],
      ["      header.addEventListener('keydown', (e) => {",
        "      header.addEventListener('keydown', (e) => {\n        if (ignoresKey(e)) return;"]
    ]).listeners)[KEY_LISTENER.sectionHeader];
    expect(header).not.toEqual(REVIEWED_READS[KEY_LISTENER.sectionHeader]);
    expect(header).toEqual({ ...REVIEWED_READS[KEY_LISTENER.sectionHeader], unanalysed: [expect.stringMatching(
      /^line \d+: e is passed to ignoresKey, which the scan cannot follow \(line \d+ uses ignoresKey other than by calling it or passing it on\)$/)] });
    // P3: a player listener added through escaped literals.
    const player = scanEdited('src/player/playerEntry.js', [['const TIMELINE_RESOLUTION = 10000;',
      "document['addEvent\\u004cistener']('key\\u0064own', e => {\n  if (e.key === 'Ω') e.preventDefault();\n});\n" +
      'const TIMELINE_RESOLUTION = 10000;']]);
    expect(player.unread, 'NOT_REGISTRATIONS has nothing in playerEntry.js')
      .toEqual([expect.stringMatching(/^src\/player\/playerEntry\.js:\d+ addEventListener\('key\\u0064own', …\)$/)]);
    expect(scannedReads(player.listeners)).toEqual({
      [KEY_LISTENER.playerPage]: REVIEWED_READS[KEY_LISTENER.playerPage],
      [KEY_LISTENER.playerTimeline]: REVIEWED_READS[KEY_LISTENER.playerTimeline]
    });
  });

  test('a key handler in a page, in any spacing or case, or in an inline script, is found', () => {
    // Round 3's review: N1, a spaced handler on index.html's body.
    expect(keysInPage('<body onkeydown = "if (event.key === \'F4\') event.preventDefault()"></body>').attributes)
      .toEqual(['<body onkeydown>']);
    expect(keysInPage('<div\n  ONKEYUP\n  =\n  "x"></div><svg><g onKeyPress="x"></g></svg><b accessKey="p"></b>')
      .attributes).toEqual(['<div onkeyup>', '<g onkeypress>', '<b accesskey>']);
    expect(keysInPage("<script src='extra.js'></script><script>document.addEventListener('keyup', e => {});" +
      "addEventListener(type, f);</script>")).toEqual({
      attributes: [], scripts: ['extra.js', 'inline'],
      listeners: ['inline script 1: document keyup'], unread: ['inline script 1:1 addEventListener(type, …)']
    });
  });

  test.each(ROW_RUNS)('%s', async (title, row, held) => {
    const log = keyLog({ held });
    await row.run(log);
    expect(log.findings(), 'keys a sweep found doing something their listener does not compare').toEqual({});
    for (const listener of row.covers) {
      expect(log.unpressed(listener), `keys ${listener} compares that the row never pressed on it`).toEqual([]);
      expect(log.swept(listener), `the row swept every other key past ${listener}`).toBe(true);
    }
  });
});
