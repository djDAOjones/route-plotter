/**
 * CROWD-08 part A — a booted editor with no route, and crowds drawn on it
 * through the editor's own events (the pen, the cards, Clear All).
 *
 * Shared by the part's suites (`noRoutePlay`, `noRouteTimeline`,
 * `noRouteExport`). The editor boots with the start's tip seen, since these
 * pin what is announced, and every helper waits past the 50 ms scene-end
 * debounce on the real clock unless a test says it presses at once.
 */

import { expect, vi } from 'vitest';
import { bootApp, tipSeen } from './bootApp.js';
import { clearProject } from '../../src/app/projectReset.js';

/** What Play's reason line says, the owner's words of 2026-10-13, written out here, not read from the code. */
export const PLAY_REASON = 'Add at least two route waypoints, or draw a crowd\'s network, to play.';
export const VIDEO_REASON = 'Export MP4 and WebM need at least two route waypoints, or a crowd\'s network.';
export const HTML_REASON = 'Export HTML needs at least two route waypoints, or a crowd\'s network.';
export const HTML_AND_BACKGROUND_REASON =
  'Export HTML needs at least two route waypoints, or a crowd\'s network, and a background image.';

export const byId = id => document.getElementById(id);

/** Past the 50 ms the app waits before it measures the scene's end again. */
export const settled = () => new Promise(resolve => setTimeout(resolve, 120));

/** The shipped editor, the start's tip seen, the welcome closed, its start-up settled. */
export async function editor() {
  localStorage.getItem.mockImplementation(tipSeen());
  const app = await bootApp();
  await app.ready;
  byId('splash-close').click();
  await settled();
  return app;
}

/** A blank project, as Clear All leaves one: no waypoint, no crowd, no timeline. */
export async function blankProject() {
  const app = await editor();
  clearProject(app);
  await settled();
  return app;
}

/**
 * Add a crowd with the Add crowd button and draw its network with the pen,
 * Entry → Exit along one two-way path, as an author would: Edit network,
 * two clicks on the map, each node's Type set.
 * @returns {{layer: Object, entry: Object, exit: Object, path: Object}}
 */
export function drawCrowd(app, { entry = { x: 0.2, y: 0.5 }, exit = { x: 0.8, y: 0.5 } } = {}) {
  byId('add-crowd-btn').click();
  const layer = app.selectedCrowd;
  expect(layer.guideType).toBe('graph');
  byId('network-edit-btn').click();
  const pen = app.networkEditService;
  const first = pen.placeNode(entry);
  pen.setSelectedNodeType('entry');
  const second = pen.placeNode(exit);
  pen.setSelectedNodeType('exit');
  pen.exit();
  return { layer, entry: first, exit: second, path: layer.graph.getEdges()[0] };
}

/** Play and its reason line, as a user and a screen reader meet them. */
export function playState() {
  const button = byId('play-btn');
  const line = byId('play-reason');
  return {
    disabled: button.disabled,
    describedBy: button.getAttribute('aria-describedby'),
    reason: line.textContent,
    hidden: line.hidden,
  };
}

/** Play with nothing to play: off, described by a visible line in the owner's words. */
export const PLAY_OFF = { disabled: true, describedBy: 'play-reason', reason: PLAY_REASON, hidden: false };
/** Play that can play: as it always was, the line empty as well as hidden. */
export const PLAY_ON = { disabled: false, describedBy: null, reason: '', hidden: true };

/**
 * A key pressed on the page, as the keyboard sends it. Inside an open dialog
 * it goes where focus is, as there; anywhere else focus is first let go, so
 * the key is the page's shortcut, not a focused button's own Space (DEF-13).
 */
export function press(key) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  const focused = document.activeElement;
  if (focused?.closest?.('[aria-modal="true"]')) {
    focused.dispatchEvent(event);
  } else {
    if (focused && focused !== document.body) focused.blur();
    document.body.dispatchEvent(event);
  }
  return event;
}

/** Count what the app announces, by text. */
export function announcements(app) {
  const spy = vi.spyOn(app, 'announce');
  return {
    spy,
    said: text => spy.mock.calls.filter(([message]) => message === text).length,
    all: () => spy.mock.calls.map(([message]) => message),
  };
}

/** The export items' states and reasons. */
export function exportState() {
  const off = id => byId(id).getAttribute('aria-disabled') === 'true';
  return {
    mp4: off('export-mp4-btn'),
    webm: off('export-webm-btn'),
    html: off('export-html-btn'),
    video: byId('export-video-reason').textContent,
    htmlReason: byId('export-html-reason').textContent,
    lineHidden: byId('export-menu-reason').hidden,
  };
}
