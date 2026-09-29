/**
 * TST-13 — the key table: what Help says each shortcut does, against what
 * pressing it does in the booted app.
 *
 * Help renders `DEFAULT_BINDINGS` (`src/config/keybindings.js`), but that
 * table drives nothing. `InteractionHandler.handleKeyDown` and its pointer
 * transaction do, and the two had drifted: DEF-21 corrected the worst of the
 * text, and CON-15 will make one table drive both. Until then this file pins
 * both sides, so drift on either fails here:
 *
 * - every Help entry, pressed or clicked as a user would, and what it changed;
 * - the event each entry names against the event its key sends: 18 of the 36
 *   name an event nothing listens to, and K names one it does not send;
 * - every key the page's shortcuts react to, and the modifiers they accept,
 *   each either in Help or listed here with the reason it is not;
 * - every modifier click and drag on the canvas, and the cursor each modifier
 *   shows while it is held;
 * - where a key must be pressed for a shortcut to run (DEF-13).
 *
 * Keys go to `document.body`: the canvas takes no focus, so once a user has
 * clicked it, that is where their keys land. What changed is read back as the
 * user meets it: the route, the selection, the transport, the zoom, an open
 * dialog, a toast and what the live region said. Rows that pin behaviour a
 * proposed defect would change say so; fixing one means updating its row.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { formatBinding, getDefaultBindings, isMac, MODIFIER_DISPLAY } from '../src/config/keybindings.js';
import { bootApp } from './helpers/bootApp.js';

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
  // earlier app's handler would claim the next app's keys first.
  for (const app of running.splice(0)) app.interactionHandler.destroy();
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
 * Help entries whose `action` is not the event their key or click sends.
 *
 * Eighteen name an event nothing in the app listens to: the plan's "18 of 36
 * fictional actions" (SEG-023). A dispatcher driven by Help (CON-15) could not
 * use them as they stand. K's names a real event, but it is the engine's own
 * notice that playback paused; K sends the play/pause toggle Space sends.
 */
const NOT_THE_EVENT_SENT = {
  addMinorWaypoint: { sends: 'waypoint:add', listened: false,
    why: 'a Cmd/Ctrl-click on empty canvas sends waypoint:add with isMajor false' },
  forceAddWaypoint: { sends: 'waypoint:add', listened: false,
    why: 'an Alt-click on empty canvas sends waypoint:add; on a waypoint it arms a branch instead' },
  forceAddMinorWaypoint: { sends: 'waypoint:add', listened: false,
    why: 'an Alt+Cmd/Ctrl-click sends waypoint:add with isMajor false, even on a waypoint' },
  selectWaypoint: { sends: 'waypoint:selected', listened: false,
    why: 'a click on a waypoint sends waypoint:selected' },
  moveWaypoint: { sends: 'waypoint:position-changed', listened: false,
    why: 'a drag sends waypoint:position-changed as it moves and waypoint:drag-ended on release' },
  nudgeUp: { sends: 'waypoint:nudge', listened: false,
    why: 'every arrow sends waypoint:nudge with a signed step; there is no event per direction' },
  nudgeDown: { sends: 'waypoint:nudge', listened: false, why: 'as nudgeUp' },
  nudgeLeft: { sends: 'waypoint:nudge', listened: false, why: 'as nudgeUp' },
  nudgeRight: { sends: 'waypoint:nudge', listened: false, why: 'as nudgeUp' },
  nudgeUpLarge: { sends: 'waypoint:nudge', listened: false,
    why: 'Shift makes the same waypoint:nudge step 2% of the canvas instead of 0.5%' },
  nudgeDownLarge: { sends: 'waypoint:nudge', listened: false, why: 'as nudgeUpLarge' },
  nudgeLeftLarge: { sends: 'waypoint:nudge', listened: false, why: 'as nudgeUpLarge' },
  nudgeRightLarge: { sends: 'waypoint:nudge', listened: false, why: 'as nudgeUpLarge' },
  playPause: { sends: 'ui:animation:toggle', listened: false,
    why: 'Space sends the transport toggle, ui:animation:toggle' },
  playReverse: { sends: 'animation:jkl-reverse', listened: false,
    why: 'J sends animation:jkl-reverse, which doubles the reverse speed on each press' },
  playForward: { sends: 'animation:jkl-forward', listened: false,
    why: 'L sends animation:jkl-forward, which doubles the speed on each press' },
  stepBackward: { sends: 'ui:animation:skip-start', listened: false,
    why: 'comma skips to the start, as Home does (the entry was "Step" until DEF-21)' },
  stepForward: { sends: 'ui:animation:skip-end', listened: false,
    why: 'full stop skips to the end, as End does (the entry was "Step" until DEF-21)' },
  playPauseK: { sends: 'ui:animation:toggle', listened: true,
    why: "animation:pause is the engine's notice that playback paused; K toggles as Space does" }
};

/** The pinned name check for one Help entry, from the events its press sent. */
function expectNamedEvent(app, id, binding, sent) {
  const pinned = NOT_THE_EVENT_SENT[id];
  const listened = app.eventBus.listenerCount(binding.action) > 0;
  if (pinned) {
    expect(sent, `${id} sends ${pinned.sends}`).toContain(pinned.sends);
    expect(sent, `${id} now sends ${binding.action}: take it out of NOT_THE_EVENT_SENT`)
      .not.toContain(binding.action);
    expect(listened, `whether the app listens for ${binding.action} (${id})`).toBe(pinned.listened);
  } else {
    expect(sent, `${id} no longer sends ${binding.action}, the event Help names`).toContain(binding.action);
    expect(listened, `nothing listens for ${binding.action} (${id}) any more`).toBe(true);
  }
}

describe("Help's key table (TST-13)", () => {

  test('Help lists 36 entries, and 18 of them name an event nothing listens to', async () => {
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

  /** One row per key Help lists: the entry's key, then each of its `altKeys`. */
  const KEY_PRESSES = Object.entries(KEYBOARD).flatMap(([id, binding]) =>
    [binding.key, ...(binding.altKeys ?? [])].map(key => [id, formatBinding({ ...binding, key }), key]));

  test.each(KEY_PRESSES)('%s (%s) does what the table pins', async (id, shown, key) => {
    const app = await editor();
    BEFORE_PRESS[id]?.(app);
    const binding = KEYBOARD[id];
    const [asTyped, flags] = typed(key, binding.modifiers);

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
        expectNamedEvent(app, label.help, binding, sent);
      } else {
        expect(label.undocumented).toMatch(/\w/);
      }
    });

  test('every mouse entry in Help has its cell', () => {
    const cells = new Set(CLICKS.map(([, , label]) => label.help).filter(Boolean));
    cells.add('moveWaypoint'); // pinned by the drag test below
    expect([...cells].sort()).toEqual(Object.keys(MOUSE).sort());
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

/** Every printable US character, and the named keys a keyboard sends. */
const CANDIDATE_KEYS = [
  ...'abcdefghijklmnopqrstuvwxyz0123456789',
  ...'`~!@#$%^&*()-_=+[{]}\\|;:\'",<.>/? ',
  'Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F5', 'F12', 'ContextMenu',
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'
];

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

  test('L after the Pause button or Home resumes at double speed (proposed defect)', async () => {
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
