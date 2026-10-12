/**
 * UI-06 J-12 (PR 6), CROWD-07 X-02's banner half and wish-list 22 — one
 * banner slot below the header (ModeBanner), toasts bottom-centre, the
 * Preview badge on the canvas.
 *
 * Every mode banner, tip and toast sat on top of the header's controls: the
 * area draw and the network edit each inline-styled a banner fixed over the
 * page, the branch gesture was a toast, and the first-start tip painted over
 * the welcome's backdrop. Now one slot, `#mode-banner`, is a row of its own
 * between the header and the main area (the owner's pick, 2026-10-08), and
 * these pin what the brief settles: one banner at a time, a replacement that
 * ends the outgoing mode before the incoming one is active (Codex on
 * 9466a3f, blocking 1), the branch gesture's Cancel and its focus fallback
 * (proposal (c); blocking 2), the tip that waits for the welcome and for a
 * mode (proposal (a); blocking 3), one announcer, the canvas refitted to the
 * room the slot leaves, and nothing left running after teardown.
 *
 * jsdom lays nothing out: the stylesheet is read through the test helper's
 * cascade, and what only a browser shows (the shrink, the wrapping, what a
 * screen reader speaks) is the lead's Chromium list.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ModeBanner } from '../src/components/ModeBanner.js';
import { bootApp, retireApp, tipSeen } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { cascade, contrast, hex, resolveValue, textPair, tokensFor } from './helpers/cssTokens.js';

const byId = id => document.getElementById(id);
const slot = () => byId('mode-banner');
/** The banners the slot shows, by id. */
const shown = () => [...slot().children].map(child => child.id);

const NETWORK_ENTRY = 'Editing the network — click the map to place linked nodes. Escape lifts the pen.';
const AREA_ENTRY = 'Drawing an area — Click to place corners. Click near the first point to close. Escape to cancel.';
const BRANCH_ARM = 'Branch from this waypoint — click where it should go. Escape to cancel.';
const TIP = 'Tip: Check your sequence in Preview mode before exporting';
const REDUCED = '@media(prefers-reduced-motion:reduce)';
const NARROW = '@media(max-width:64rem)';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const shellBody = indexHtml.slice(indexHtml.indexOf('>', indexHtml.indexOf('<body')) + 1, indexHtml.lastIndexOf('</body>'))
  .replace(/<script\b[\s\S]*?<\/script>/g, '');

/** The shipped shell, mounted unbooted, for the cascade to read. */
function mountShell() {
  document.body.innerHTML = shellBody;
}

/** Let this turn's microtasks and a macrotask run (an `unlessSaid` message is decided at the turn's end). */
const turn = () => new Promise(resolveTurn => setTimeout(resolveTurn, 0));
/** Past the frames a list rebuild queued (the setup's frames are timers). */
const frames = () => new Promise(resolveFrames => setTimeout(resolveFrames, 30));

/** The apps this file booted: a mode one leaves on is ended, so its capture-phase Escape leaves with it. */
const booted = [];
async function boot() {
  const app = await bootApp();
  booted.push(app);
  return app;
}

afterEach(() => {
  for (const app of booted.splice(0)) {
    app.areaDrawingService?.cancelDrawing?.();
    app.networkEditService?.exit?.();
  }
  vi.useRealTimers();
  localStorage.getItem.mockImplementation(() => null);
  localStorage.setItem.mockImplementation(() => {});
});

/** The editor, its start's tip seen and its welcome closed. */
async function editor() {
  localStorage.getItem.mockImplementation(tipSeen());
  const app = await boot();
  await app.ready;
  byId('splash-close').click();
  return app;
}

async function routeOfTwo() {
  const app = await editor();
  app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
  expect(app.waypoints).toHaveLength(2);
  return app;
}

/** A route of two and a crowd on a custom network, selected: Edit network is there to press. */
async function withCrowdNetwork() {
  const app = await routeOfTwo();
  app.addCrowd();
  app.selectedCrowd.setGuideType('graph');
  app.syncCrowdEditor();
  return app;
}

/** Every message announced through the app, in turn. */
function listen(app) {
  const announce = vi.spyOn(app, 'announce');
  const toasts = [];
  app.eventBus.on('ui:toast', toast => toasts.push(toast.message));
  return { said: () => announce.mock.calls.map(([message]) => message), toasts };
}

/** A tap on the canvas at an image position, through the interaction handler, whose press keeps focus where it is. */
function tapCanvas(app, [imgX, imgY]) {
  const { x, y } = app.imageToCanvas(imgX, imgY);
  for (const kind of ['pointerdown', 'pointerup']) {
    app.canvas.dispatchEvent(new PointerEvent(kind, {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      button: kind === 'pointerdown' ? 0 : -1, buttons: kind === 'pointerdown' ? 1 : 0, clientX: x, clientY: y,
    }));
  }
}

/**
 * The canvas area's height as a browser lays it out while the slot takes `by`
 * px of it (bootApp's layout is 720 px tall; jsdom lays nothing out).
 */
function slotTakes(by) {
  Object.defineProperty(byId('canvas-area'), 'clientHeight', { configurable: true, get: () => 720 - by });
}

const escape = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

describe('the component (ModeBanner)', () => {
  function bare() {
    document.body.innerHTML = '<button id="before">Before</button><div id="mode-banner"></div>';
    return new ModeBanner(slot());
  }
  const owner = (log = []) => ({ onReplaced: vi.fn(() => log.push('replaced')) });

  test('one slot: its title, words, key, count and actions drawn; actions are buttons named by their words; update rewrites the count; hide empties it', () => {
    const banner = bare();
    const area = owner();
    const clicked = vi.fn();
    const { root, actions, count } = banner.show(area, {
      id: 'area-draw-banner', title: 'Drawing an area', text: [' — Click to place corners. ', { kbd: 'Esc' }, ' to cancel.'],
      count: '0 corners', actions: [{ label: 'Cancel', className: 'banner-cancel', onClick: clicked }],
    });
    expect(shown()).toEqual(['area-draw-banner']);
    expect(slot().classList.contains('is-showing')).toBe(true);
    expect(root.querySelector('strong').textContent).toBe('Drawing an area');
    expect(root.querySelector('kbd').textContent).toBe('Esc');
    expect(count.textContent).toBe('0 corners');
    expect(actions).toHaveLength(1);
    expect([actions[0].type, actions[0].textContent, actions[0].hasAttribute('aria-label')]).toEqual(['button', 'Cancel', false]);
    expect(actions[0].classList.contains('mode-banner-action')).toBe(true);
    actions[0].click();
    expect(clicked).toHaveBeenCalledTimes(1);
    // Nothing in it is live: the owner says what it shows (UI-06 J-05).
    expect(slot().querySelector('[aria-live], [role]')).toBeNull();

    expect(banner.update(area, { count: '1 corner (2 more needed to close)' })).toBe(true);
    expect(count.textContent).toBe('1 corner (2 more needed to close)');
    expect(banner.isShowing(area)).toBe(true);
    expect(banner.hide(area)).toBe(true);
    expect(shown()).toEqual([]);
    expect(slot().classList.contains('is-showing')).toBe(false);
    expect(banner.isShowing()).toBe(false);
  });

  test('a second owner\'s show runs the first owner\'s onReplaced to its end before its own banner is drawn; the same owner\'s replaces nothing', () => {
    const banner = bare();
    const log = [];
    const first = { onReplaced: vi.fn(() => { log.push(`replaced while showing ${shown()}`); banner.hide(first); }) };
    const second = owner(log);
    banner.show(first, { id: 'first' });
    banner.show(first, { id: 'first' });
    expect(first.onReplaced).not.toHaveBeenCalled();
    banner.show(second, { id: 'second' });
    expect(first.onReplaced).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['replaced while showing first']);
    expect(shown()).toEqual(['second']);
    expect(banner.holder).toBe(second);
  });

  test('an owner that leaves its banner up when replaced loses it all the same', () => {
    const banner = bare();
    const stubborn = owner();
    banner.show(stubborn, { id: 'stubborn' });
    banner.show(owner(), { id: 'next' });
    expect(shown()).toEqual(['next']);
  });

  test('hide and update by an owner no longer holding the slot change nothing (m22)', () => {
    const banner = bare();
    const tip = { onReplaced: () => banner.hide(tip) };
    const mode = owner();
    banner.show(tip, { id: 'tip' });
    banner.show(mode, { id: 'mode', count: '2 nodes · 1 path' });
    expect(banner.hide(tip)).toBe(false);
    expect(banner.update(tip, { count: 'stale' })).toBe(false);
    expect(shown()).toEqual(['mode']);
    expect(slot().querySelector('.banner-count').textContent).toBe('2 nodes · 1 path');
  });

  test('a waiter for a free slot runs when a banner goes and none replaces it, not on a replacement', () => {
    const banner = bare();
    const waited = vi.fn();
    const first = { onReplaced: () => banner.hide(first) };
    banner.show(first, { id: 'first' });
    banner.whenFree(waited);
    const second = owner();
    banner.show(second, { id: 'second' });
    expect(waited).not.toHaveBeenCalled();
    banner.hide(second);
    expect(waited).toHaveBeenCalledTimes(1);
  });

  test('the height is told at once where the slot does not animate: on a show from empty and on a hide to empty, once each', () => {
    const banner = bare();
    banner.onHeightChange = vi.fn();
    const first = { onReplaced: () => banner.hide(first) };
    banner.show(first, { id: 'first' });
    expect(banner.onHeightChange).toHaveBeenCalledTimes(1);
    // A replacement keeps the slot shown: jsdom measures no change, so nothing is told.
    const second = owner();
    banner.show(second, { id: 'second' });
    expect(banner.onHeightChange).toHaveBeenCalledTimes(1);
    banner.hide(second);
    expect(banner.onHeightChange).toHaveBeenCalledTimes(2);
  });

  test('where it animates, the height is told at the transition\'s end, or by the fallback timer, once; reduced motion tells at once', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const banner = bare();
    banner.onHeightChange = vi.fn();
    Object.assign(slot().style, { transitionProperty: 'min-height, max-height', transitionDuration: '150ms' });
    const mode = owner();
    banner.show(mode, { id: 'mode' });
    expect(banner.onHeightChange).not.toHaveBeenCalled();
    slot().dispatchEvent(new Event('transitionend'));
    slot().dispatchEvent(new Event('transitionend'));
    expect(banner.onHeightChange).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(banner.onHeightChange).toHaveBeenCalledTimes(1);

    banner.hide(mode);
    vi.advanceTimersByTime(249);
    expect(banner.onHeightChange).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(banner.onHeightChange).toHaveBeenCalledTimes(2);

    // Reduced motion: `transition: none`, whatever duration the page's 0.01 ms rule leaves.
    Object.assign(slot().style, { transitionProperty: 'none', transitionDuration: '0.01ms' });
    banner.show(mode, { id: 'mode' });
    expect(banner.onHeightChange).toHaveBeenCalledTimes(3);
  });

  test('destroyed, a settle waiting for its transition never reports', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const banner = bare();
    banner.onHeightChange = vi.fn();
    slot().style.transitionDuration = '150ms';
    banner.show(owner(), { id: 'mode' });
    banner.destroy();
    slot().dispatchEvent(new Event('transitionend'));
    vi.advanceTimersByTime(1000);
    expect(banner.onHeightChange).not.toHaveBeenCalled();
  });

  test('it remembers the control focused before focus entered the slot', () => {
    const banner = bare();
    const { actions } = banner.show(owner(), { id: 'tip', actions: [{ label: 'Dismiss' }] });
    byId('before').focus();
    actions[0].focus();
    expect(banner.focusBefore).toBe(byId('before'));
  });
});

describe('the slot is a row of its own below the header (item 1)', () => {
  test('in the shell between the header and the main area, not live, empty', () => {
    mountShell();
    const header = document.querySelector('header.header');
    expect(header.nextElementSibling).toBe(slot());
    expect(slot().nextElementSibling).toBe(byId('main-content'));
    expect(slot().closest('header')).toBeNull();
    expect(slot().getAttribute('aria-live')).toBe('off');
    expect(slot().children).toHaveLength(0);
  });

  test('the grid gives it row 2 and the main area row 3; empty it takes no room; showing, one line of 3 rem; never positioned or stacked; still under reduced motion (m02, m12)', () => {
    mountShell();
    const app = document.getElementById('app');
    expect(cascade(app, 'grid-template-rows').value).toBe('auto auto 1fr auto');
    expect(cascade(slot(), 'grid-row').value).toBe('2');
    expect(cascade(slot(), 'grid-column').value).toBe('1 / -1');
    expect(cascade(byId('main-content'), 'grid-row').value).toBe('3');
    expect(cascade(document.querySelector('.header'), 'grid-row').value).toBe('1');
    // Empty: nothing of its own takes room.
    expect(cascade(slot(), 'min-height').value).toBe('0');
    expect(cascade(slot(), 'max-height').value).toBe('0');
    expect(cascade(slot(), ['padding', 'padding-top']).value).toBe('0');
    expect(cascade(slot(), ['border', 'border-top']).value).toBe('0');
    for (const media of [[], [NARROW]]) {
      expect(cascade(slot(), 'position', { media })).toBeUndefined();
      expect(cascade(slot(), 'z-index', { media })).toBeUndefined();
    }
    expect(['fixed', 'absolute', 'sticky']).not.toContain(cascade(document.querySelector('.header'), 'position')?.value);
    // Showing: one line, its actions 44 px.
    slot().classList.add('is-showing');
    expect(cascade(slot(), 'min-height').value).toBe('3rem');
    const banner = new ModeBanner(slot());
    const { actions } = banner.show({}, { id: 'network-edit-banner', title: 'Editing the network', actions: [{ label: 'Done' }] });
    const tokens = tokensFor();
    expect(resolveValue(cascade(actions[0], 'min-height').value, tokens)).toBe('2.75rem');
    expect(resolveValue(cascade(actions[0], 'min-width').value, tokens)).toBe('2.75rem');
    expect(cascade(slot().firstElementChild, 'min-height').value).toBe('3rem');
    // A 150 ms ease, and none under reduced motion.
    expect(cascade(slot(), 'transition').value).toMatch(/max-height 150ms/);
    expect(cascade(slot(), 'transition', { media: [REDUCED] }).value).toBe('none');
  });

  test('at 64 rem and below, where #app is a flex column, the slot comes after the header in document order', () => {
    mountShell();
    expect(cascade(byId('app'), 'display', { media: [NARROW] }).value).toBe('flex');
    expect(cascade(byId('app'), 'flex-direction', { media: [NARROW] }).value).toBe('column');
    const children = [...byId('app').children];
    expect(children.indexOf(slot())).toBe(children.indexOf(document.querySelector('header.header')) + 1);
  });

  test('every banner\'s words and actions read at 7:1 on its surface, at rest and hovered', () => {
    mountShell();
    const banner = new ModeBanner(slot());
    slot().classList.add('is-showing');
    for (const id of ['network-edit-banner', 'area-draw-banner', 'branch-banner', 'preview-tip-banner']) {
      const { root, actions } = banner.show({ id }, {
        id, title: 'Title', text: [' words ', { kbd: 'Esc' }, ' more.'], count: '2 nodes', actions: [{ label: 'Done' }],
      });
      const elements = [root.querySelector('.banner-text'), root.querySelector('strong'), root.querySelector('kbd'),
        root.querySelector('.banner-count'), actions[0]];
      for (const element of elements) {
        for (const states of [[], ['hover']]) {
          const { fg, bg } = textPair(element, { states });
          const ratio = contrast(fg, bg);
          expect(ratio, `${id} ${element.className || element.localName} ${states}: ${hex(fg)} on ${hex(bg)}`)
            .toBeGreaterThanOrEqual(7);
        }
      }
    }
  });
});

describe('toasts bottom-centre of the canvas area, the Preview badge top-right (items 3, 4, 7)', () => {
  test('the toast container stands on the transport, never over the header, under a dialog (m05)', () => {
    mountShell();
    const container = byId('toast-container');
    expect(container.parentElement).toBe(document.querySelector('#canvas-area > .controls'));
    expect(container.closest('header')).toBeNull();
    expect(cascade(container, 'position').value).toBe('absolute');
    expect(cascade(container, 'top')).toBeUndefined();
    expect(cascade(container, 'bottom').value).toBe('calc(100% + var(--space-2))');
    expect([cascade(container, 'left').value, cascade(container, 'right').value]).toEqual(['var(--space-3)', 'var(--space-3)']);
    // Its containing block is the transport, sticky at full width and in flow below 64 rem.
    const controls = container.parentElement;
    expect(cascade(controls, 'position').value).toBe('sticky');
    expect(cascade(controls, 'position', { media: [NARROW] }).value).toBe('relative');
    // Below the welcome's and every dialog's 999 (proposal (b), the owner's).
    const modal = document.querySelector('.modal');
    expect(Number(cascade(container, 'z-index').value)).toBeLessThan(Number(cascade(modal, 'z-index').value));
    expect(Number(cascade(container, 'z-index').value)).toBeLessThan(Number(cascade(byId('splash'), 'z-index').value));
  });

  test('the badge is a real element in the canvas area, drawn not read, shown only in Preview, top-right, at 7:1 (m06)', () => {
    mountShell();
    const badge = byId('preview-badge');
    expect(badge.closest('#canvas-area')).toBe(byId('canvas-area'));
    expect([badge.getAttribute('aria-hidden'), badge.textContent]).toEqual(['true', 'Preview']);
    expect(cascade(badge, 'display').value).toBe('none');
    document.body.dataset.mode = 'preview';
    try {
      expect(cascade(badge, 'display').value).toBe('block');
      expect(cascade(badge, 'position').value).toBe('absolute');
      expect([cascade(badge, 'top').value, cascade(badge, 'right').value]).toEqual(['var(--space-3)', 'var(--space-3)']);
      expect(cascade(badge, 'left')).toBeUndefined();
      expect(cascade(badge, 'bottom')).toBeUndefined();
      const { fg, bg } = textPair(badge);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(7);
      // The canvas area is the badge's containing block at both widths.
      for (const media of [[], [NARROW]]) expect(cascade(byId('canvas-area'), 'position', { media }).value).toBe('relative');
    } finally {
      delete document.body.dataset.mode;
    }
    // No pseudo-element badge is left over the header.
    const css = readFileSync(resolve(process.cwd(), 'styles/main.css'), 'utf8');
    expect(css).not.toMatch(/data-mode="preview"\]::after/);
  });
});

describe('a mode replaces the one whose banner is up, and is active once it has ended (item 1; blocking 1)', () => {
  test.each([
    ['area → network, the area entered from Edit', 'area', false],
    ['area → network, the area entered from Preview', 'area', true],
    ['network → area, the network entered from Edit', 'network', false],
    ['network → area, the network entered while Preview showed', 'network', true],
  ])('%s: the incoming mode is active and its banner alone shows; the outgoing ended; Preview off; one announcement (m13)', async (_, outgoing, fromPreview) => {
    const app = await withCrowdNetwork();
    const area = app.areaDrawingService;
    const network = app.networkEditService;
    app._setPreviewMode(fromPreview);
    if (outgoing === 'area') area.startDrawing(app.waypoints[0]);
    else app.enterNetworkEditMode();
    expect(outgoing === 'area' ? area.isDrawing : network.active).toBe(true);
    expect(app.previewMode).toBe(false);
    await turn();
    const { said } = listen(app);

    if (outgoing === 'area') app.enterNetworkEditMode();
    else area.startDrawing(app.waypoints[0]);
    await turn();

    if (outgoing === 'area') {
      expect([network.active, area.isDrawing]).toEqual([true, false]);
      expect(shown()).toEqual(['network-edit-banner']);
      expect(said()).toEqual([NETWORK_ENTRY]);
    } else {
      expect([area.isDrawing, network.active]).toEqual([true, false]);
      expect(shown()).toEqual(['area-draw-banner']);
      expect(said()).toEqual([AREA_ENTRY]);
    }
    expect(app.previewMode).toBe(false);
  });

  test('a weight typed in network editing and not committed goes to its path when an area draw takes the slot (m20)', async () => {
    const app = await editor();
    expect(await loadSnapshot(app, {
      coordVersion: 9,
      waypoints: [{ id: 'a', imgX: 0.2, imgY: 0.3, isMajor: true }, { id: 'b', imgX: 0.7, imgY: 0.6, isMajor: true }],
      scene: {
        flowLayers: [{
          id: 'net', name: 'net', guideType: 'graph', emitters: [{ id: 'net-e', seed: 7 }],
          graph: {
            nodes: [{ id: 'n1', x: 0.2, y: 0.5, type: 'entry' }, { id: 'n2', x: 0.8, y: 0.5, type: 'exit' }],
            edges: [{ id: 'e1', sourceId: 'n1', targetId: 'n2', weight: 1 }],
          },
        }],
      },
    })).toBe(true);
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayers()[0]);
    byId('network-edit-btn').click();
    const network = app.networkEditService;
    expect(network.active).toBe(true);
    const graph = app.selectedCrowd.graph;
    network.selectEdge(graph.getEdge('e1'));
    const field = byId('network-edge-weight-field');
    field.focus();
    field.value = '7';
    field.dispatchEvent(new Event('input', { bubbles: true }));

    // Called directly, so the replacement, not a deselection, is what ends the network's session.
    app.areaDrawingService.startDrawing(app.waypoints[0]);

    expect([network.active, app.areaDrawingService.isDrawing]).toEqual([false, true]);
    expect(graph.getEdge('e1').weight).toBe(7);
    expect(shown()).toEqual(['area-draw-banner']);
  });

  test('Edit network\'s banner replaces a branch gesture by its cancel path, and the gesture ends', async () => {
    const app = await withCrowdNetwork();
    const { toasts } = listen(app);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(shown()).toEqual(['branch-banner']);
    app.enterNetworkEditMode();
    expect(app.interactionHandler.branchArmed).toBeNull();
    expect(toasts).toEqual(['Branch cancelled']);
    expect(shown()).toEqual(['network-edit-banner']);
  });
});

describe('the canvas is refitted to the room the slot leaves (item 1; the lead\'s settlement and Codex\'s recheck)', () => {
  test('a banner shown and hidden refits the canvas once each, and the canvas fits the area again (m17)', async () => {
    const app = await routeOfTwo();
    const before = app.displayHeight;
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    slotTakes(48);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(refit).toHaveBeenCalledTimes(1);
    expect(app.displayHeight).toBe(before - 48);
    expect(app.canvas.height).toBe(Math.round(app.displayHeight * app.canvasScale));
    slotTakes(0);
    app.eventBus.emit('route:branch-cancel');
    expect(refit).toHaveBeenCalledTimes(2);
    expect(app.displayHeight).toBe(before);
    expect(app.canvas.width).toBe(Math.round(app.displayWidth * app.canvasScale));
  });

  test('a banner that leaves the canvas area\'s room as it was refits nothing', async () => {
    const app = await routeOfTwo();
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    app.eventBus.emit('route:branch-cancel');
    expect(refit).not.toHaveBeenCalled();
  });

  test.each([
    ['a pause', app => app.animationEngine.pause()],
    ['the end of playback', app => { app.animationEngine.state.isPaused = true; app.animationEngine.emit('complete'); }],
    ['a reset', app => app.animationEngine.reset()],
  ])('while playing, nothing refits until the playback stops; %s runs the refit held back, once (Codex\'s recheck)', async (_, stop) => {
    const app = await routeOfTwo();
    const state = app.animationEngine.state;
    state.isPlaying = true;
    state.isPaused = false;
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    slotTakes(48);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(refit).not.toHaveBeenCalled();
    stop(app);
    expect(refit).toHaveBeenCalledTimes(1);
    app.animationEngine.pause();
    expect(refit).toHaveBeenCalledTimes(1);
  });

  test('a banner shown during a video export leaves the export\'s canvas as it is; its exit refits once, and nothing is held for later', async () => {
    const app = await routeOfTwo();
    app._enterExportMode(640, 360);
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    slotTakes(48);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect([app.canvas.width, app.canvas.height]).toEqual([640, 360]);
    app._exitExportMode();
    expect(refit).toHaveBeenCalledTimes(1);
    app.animationEngine.pause();
    app.animationEngine.reset();
    expect(refit).toHaveBeenCalledTimes(1);
  });
});

describe('the branch gesture: a banner with a Cancel (item 2)', () => {
  test('arming shows its banner and raises no toast; it is said once; Cancel and Escape each end it once (m08)', async () => {
    const app = await routeOfTwo();
    const { said, toasts } = listen(app);
    const cancels = vi.fn();
    app.eventBus.on('route:branch-cancel', cancels);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    await turn();
    expect(app.interactionHandler.branchArmed).toBe(app.waypoints[0]);
    expect(shown()).toEqual(['branch-banner']);
    const banner = byId('branch-banner');
    expect(banner.querySelector('strong').textContent).toBe('Branch from this waypoint');
    expect(banner.querySelector('kbd').textContent).toBe('Esc');
    expect(banner.textContent).toMatch(/click where it should go\. Esc to cancel\./);
    expect(toasts).toEqual([]);
    expect(said()).toEqual([BRANCH_ARM]);

    const cancel = banner.querySelector('.banner-cancel');
    expect([cancel.textContent, cancel.hasAttribute('aria-label')]).toEqual(['Cancel', false]);
    cancel.click();
    expect(app.interactionHandler.branchArmed).toBeNull();
    expect(shown()).toEqual([]);
    expect(cancels).toHaveBeenCalledTimes(1);
    expect(toasts).toEqual(['Branch cancelled']);

    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    escape();
    expect(app.interactionHandler.branchArmed).toBeNull();
    expect(shown()).toEqual([]);
    expect(cancels).toHaveBeenCalledTimes(2);
  });

  test('arming moves no focus: the gesture is on the canvas', async () => {
    const app = await routeOfTwo();
    byId('help-btn').focus();
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(document.activeElement).toBe(byId('help-btn'));
  });

  test('Cancel pressed from the keyboard gives focus back to the element focused at arm', async () => {
    const app = await routeOfTwo();
    byId('help-btn').focus();
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    const cancel = byId('branch-banner').querySelector('.banner-cancel');
    cancel.focus();
    cancel.click();
    expect(document.activeElement).toBe(byId('help-btn'));
  });

  test('that element removed, focus goes to the fork\'s row (m15)', async () => {
    const app = await routeOfTwo();
    const [fork] = app.waypoints;
    const helper = document.createElement('button');
    helper.textContent = 'Somewhere';
    document.body.append(helper);
    helper.focus();
    app.eventBus.emit('route:branch-arm', { waypoint: fork });
    helper.remove();
    const cancel = byId('branch-banner').querySelector('.banner-cancel');
    cancel.focus();
    cancel.click();
    expect(document.activeElement).toBe(app.uiController.rowButtonFor(fork));
    expect(document.activeElement.isConnected).toBe(true);
  });

  test.each([
    ['deleted', (app, fork) => app.eventBus.emit('waypoint:delete', fork)],
    ['undone away', app => app.eventBus.emit('history:undo')],
    ['replaced by an Open', app => loadSnapshot(app, {
      coordVersion: 9, waypoints: [{ id: 'z1', imgX: 0.3, imgY: 0.3, isMajor: true }, { id: 'z2', imgX: 0.6, imgY: 0.6, isMajor: true }],
    })],
  ])('its fork %s, with focus on Cancel: the gesture ends at once, said once, and focus goes to the Route button (m14, m15)', async (_, remove) => {
    const app = await routeOfTwo();
    const fork = app.waypoints[1];
    app.uiController.rowButtonFor(fork).focus();
    app.eventBus.emit('route:branch-arm', { waypoint: fork });
    const cancel = byId('branch-banner').querySelector('.banner-cancel');
    cancel.focus();
    const cancels = vi.fn();
    app.eventBus.on('route:branch-cancel', cancels);
    const { toasts } = listen(app);

    await remove(app, fork);

    expect(app.interactionHandler.branchArmed).toBeNull();
    expect(shown()).toEqual([]);
    expect(cancels).toHaveBeenCalledTimes(1);
    expect(toasts.filter(message => message === 'Branch cancelled')).toHaveLength(1);
    await frames();
    expect(document.activeElement).toBe(byId('scope-route-btn'));
  });

  test('any Undo cancels it: a fork that survives the Undo, another waypoint selected by the restore, focus on the fork\'s current row', async () => {
    const app = await routeOfTwo();
    const [fork] = app.waypoints;
    app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.8, isMajor: true });
    expect(app.waypoints).toHaveLength(3);
    const rowAtArm = app.uiController.rowButtonFor(fork);
    rowAtArm.focus();
    app.eventBus.emit('route:branch-arm', { waypoint: fork });
    const cancel = byId('branch-banner').querySelector('.banner-cancel');
    cancel.focus();

    app.eventBus.emit('history:undo');

    expect(app.interactionHandler.branchArmed).toBeNull();
    expect(shown()).toEqual([]);
    const restoredFork = app.waypointsById.get(fork.id);
    expect(restoredFork).toBeTruthy();
    expect(restoredFork).not.toBe(fork);
    expect(app.selectedWaypoint?.id).not.toBe(fork.id);
    await frames();
    const row = app.uiController.rowButtonFor(restoredFork);
    expect(document.activeElement).toBe(row);
    expect(row).not.toBe(rowAtArm);
    expect(document.activeElement.isConnected).toBe(true);
  });

  test('another waypoint\'s deletion leaves the gesture armed on its fork', async () => {
    const app = await routeOfTwo();
    app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.8, isMajor: true });
    const [fork, , other] = app.waypoints;
    app.eventBus.emit('route:branch-arm', { waypoint: fork });
    app.eventBus.emit('waypoint:delete', other);
    expect(app.interactionHandler.branchArmed).toBe(fork);
    expect(shown()).toEqual(['branch-banner']);
  });
});

describe('focus when a banner takes its own control away (item 5)', () => {
  /** Draw area shown and its card open, the first waypoint selected. */
  async function drawAreaReady() {
    const app = await routeOfTwo();
    app.eventBus.emit('waypoint:selected', app.waypoints[0]);
    const shape = byId('area-shape');
    shape.value = 'polygon';
    shape.dispatchEvent(new Event('change', { bubbles: true }));
    const header = byId('area-draw-btn').closest('.settings-section').querySelector('.section-header');
    if (header.getAttribute('aria-expanded') !== 'true') header.click();
    return app;
  }

  test('entering area draw keeps focus on Draw area; its Cancel pressed from the keyboard gives it back there (m19)', async () => {
    const app = await drawAreaReady();
    const draw = byId('area-draw-btn');
    draw.focus();
    draw.click();
    expect(app.areaDrawingService.isDrawing).toBe(true);
    expect(document.activeElement).toBe(draw);
    const cancel = byId('area-draw-banner').querySelector('.banner-cancel');
    expect([cancel.textContent, cancel.hasAttribute('aria-label')]).toEqual(['Cancel', false]);
    cancel.focus();
    cancel.click();
    expect(app.areaDrawingService.isDrawing).toBe(false);
    expect(document.activeElement).toBe(draw);
  });

  test('Escape with focus on the area\'s Cancel does the same', async () => {
    const app = await drawAreaReady();
    const draw = byId('area-draw-btn');
    draw.click();
    byId('area-draw-banner').querySelector('.banner-cancel').focus();
    escape();
    expect(app.areaDrawingService.isDrawing).toBe(false);
    expect(document.activeElement).toBe(draw);
  });

  test('Draw area hidden by then, focus goes to the Route button', async () => {
    const app = await drawAreaReady();
    byId('area-draw-btn').click();
    byId('area-draw-controls').style.display = 'none';
    const cancel = byId('area-draw-banner').querySelector('.banner-cancel');
    cancel.focus();
    cancel.click();
    expect(app.areaDrawingService.isDrawing).toBe(false);
    expect(document.activeElement).toBe(byId('scope-route-btn'));
  });
});

describe('one announcer (item 6)', () => {
  test('each mode\'s entry is said once, by its owner, and nothing in the slot is live (m07)', async () => {
    const app = await withCrowdNetwork();
    const { said } = listen(app);
    app.enterNetworkEditMode();
    await turn();
    expect(said()).toEqual([NETWORK_ENTRY]);
    expect(slot().querySelector('[aria-live], [role]')).toBeNull();
    byId('network-edit-banner').querySelector('.banner-done').click();
    await turn();

    const areaFrom = said().length;
    app.areaDrawingService.startDrawing(app.waypoints[0]);
    await turn();
    expect(said().slice(areaFrom)).toEqual([AREA_ENTRY]);
    expect(slot().querySelector('[aria-live], [role]')).toBeNull();
    app.areaDrawingService.cancelDrawing();
    await turn();

    const branchFrom = said().length;
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    await turn();
    expect(said().slice(branchFrom)).toEqual([BRANCH_ARM]);
    expect(slot().querySelector('[aria-live], [role]')).toBeNull();
  });

  test('three corners placed: three announcements, the last the line the banner shows (m18)', async () => {
    const app = await routeOfTwo();
    app.areaDrawingService.startDrawing(app.waypoints[0]);
    await turn();
    const { said } = listen(app);
    for (const [imgX, imgY] of [[0.2, 0.2], [0.6, 0.2], [0.4, 0.6]]) {
      app.eventBus.emit('area:draw-click', { imgX, imgY });
    }
    await turn();
    expect(said()).toEqual([
      '1 corner (2 more needed to close)',
      '2 corners (1 more needed to close)',
      '3 corners (click near first to close)',
    ]);
    expect(slot().querySelector('.banner-count').textContent).toBe('3 corners (click near first to close)');
  });

  test('the network\'s count is said where nothing else says its change: a node placed is "Node placed", a link drawn between nodes is the count', async () => {
    const app = await withCrowdNetwork();
    app.enterNetworkEditMode();
    const network = app.networkEditService;
    await turn();
    const { said } = listen(app);
    app._handleNetworkClick(...Object.values(app.imageToCanvas(0.2, 0.2)), false);
    await turn();
    expect(said()).toEqual(['Node placed']);
    network.penNodeId = null;
    const first = network.layer.graph.getNodes()[0];
    const second = network.placeNode({ x: 0.8, y: 0.8 });
    await turn();
    said();
    const before = said().length;
    network.penNodeId = second.id;
    network.clickNode(first);
    await turn();
    expect(said().slice(before)).toEqual(['2 nodes · 1 path']);
    expect(slot().querySelector('.banner-count').textContent).toBe('2 nodes · 1 path');
  });

  test('the last waypoint deleted is heard once, by its deletion\'s message; the empty list is not live', async () => {
    const app = await editor();
    app.eventBus.emit('waypoint:add', { imgX: 0.4, imgY: 0.4, isMajor: true });
    await turn();
    const { said } = listen(app);
    app.eventBus.emit('waypoint:delete', app.waypoints[0]);
    await turn();
    expect(app.waypoints).toHaveLength(0);
    const empty = document.querySelector('#waypoint-list .waypoint-list-empty');
    expect(empty.getAttribute('aria-live')).toBe('off');
    // "Deleted waypoint — press … to undo" says the change: not the empty row, nor the chip's Route, again.
    expect(said()).toHaveLength(1);
    expect(said()[0]).toMatch(/^Deleted waypoint — press (Cmd|Ctrl)\+Z to undo$/);
  });

  test('the chip moved from Route to a waypoint by a pointer selection is heard once, in its words', async () => {
    const app = await routeOfTwo();
    await vi.waitFor(() => expect(app.background.image).toBeTruthy());
    app.eventBus.emit('waypoint:deselected');
    await turn();
    expect(byId('scope-chip-text').textContent).toBe('Editing · Route');
    expect(byId('scope-chip-text').getAttribute('aria-live')).toBe('off');
    const { said } = listen(app);
    tapCanvas(app, [app.waypoints[0].imgX, app.waypoints[0].imgY]);
    await turn();
    expect(app.selectedWaypoint).toBe(app.waypoints[0]);
    expect(said()).toEqual(['Editing · Waypoint 1 · major']);
  });

  test('a message said earlier in the same turn says the change: the chip is not said after it; two such lines of one turn are both said', async () => {
    const app = await routeOfTwo();
    app.eventBus.emit('waypoint:deselected');
    await turn();
    const { said } = listen(app);
    app.announce('Undo');
    app.eventBus.emit('waypoint:selected', app.waypoints[0]);
    await turn();
    expect(said()).toEqual(['Undo']);

    app.announceUnlessSaid('first line');
    app.announceUnlessSaid('second line');
    await turn();
    expect(said()).toEqual(['Undo', 'first line', 'second line']);
  });

  test('a row of the list selected names its waypoint itself: the chip is not said again', async () => {
    const app = await routeOfTwo();
    app.eventBus.emit('waypoint:deselected');
    await turn();
    const { said } = listen(app);
    const row = app.uiController.rowButtonFor(app.waypoints[0]);
    row.focus();
    row.click();
    await turn();
    expect(app.selectedWaypoint).toBe(app.waypoints[0]);
    expect(said()).not.toContain('Editing · Waypoint 1 · major');
  });
});

describe('the first-start tip shows in the slot (item 7; proposals (a), (b); blocking 3)', () => {
  /** A first start on the fake clock: nothing stored, so the welcome shows and the tip is due. */
  async function firstStart() {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const app = await boot();
    await vi.advanceTimersByTimeAsync(50);
    await app.ready;
    return app;
  }
  const tipBanner = () => byId('preview-tip-banner');
  const tipSaid = said => said().filter(message => message === TIP);

  test('the welcome open past 1.5 s: no tip and no toast; the welcome closed: the tip is in the slot, heard once (m11)', async () => {
    const app = await firstStart();
    const { said } = listen(app);
    expect(byId('splash').style.display).toBe('flex');
    await vi.advanceTimersByTimeAsync(2000);
    expect(tipBanner()).toBeNull();
    expect(byId('toast-container').querySelector('.toast')).toBeNull();

    byId('splash-close').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['preview-tip-banner']);
    expect(tipBanner().textContent).toContain('Check your sequence in Preview mode before exporting');
    expect(tipBanner().querySelector('button').textContent).toBe('Dismiss');
    expect(byId('toast-container').querySelector('.toast')).toBeNull();
    expect(tipSaid(said)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(8000);
    expect(tipBanner()).toBeNull();
  });

  test('a draw started before the tip is due keeps the slot; the draw cancelled, the tip shows; Edit network replaces it, and its 8 s leave the network\'s banner up (m16, m22)', async () => {
    const app = await firstStart();
    byId('splash-close').click();
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    app.addCrowd();
    app.selectedCrowd.setGuideType('graph');
    app.syncCrowdEditor();
    const { said } = listen(app);
    app.areaDrawingService.startDrawing(app.waypoints[0]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(tipBanner()).toBeNull();
    expect(app.areaDrawingService.isDrawing).toBe(true);
    expect(shown()).toEqual(['area-draw-banner']);

    app.areaDrawingService.cancelDrawing();
    await vi.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['preview-tip-banner']);
    expect(tipSaid(said)).toHaveLength(1);

    app.enterNetworkEditMode();
    expect(shown()).toEqual(['network-edit-banner']);
    await vi.advanceTimersByTimeAsync(9000);
    expect(shown()).toEqual(['network-edit-banner']);
    expect(app.networkEditService.active).toBe(true);

    // A tip a mode replaced does not come back.
    byId('network-edit-banner').querySelector('.banner-done').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual([]);
    expect(tipSaid(said)).toHaveLength(1);
  });

  test.each([
    ['its Dismiss', () => tipBanner().querySelector('button').click()],
    ['its 8 s, with focus in it', () => vi.advanceTimersByTimeAsync(8000)],
  ])('taken away by %s, it gives focus back to the control focused before; that control removed, to the Route button (m19)', async (_, end) => {
    const app = await firstStart();
    byId('splash-close').click();
    await vi.advanceTimersByTimeAsync(1500);
    expect(shown()).toEqual(['preview-tip-banner']);
    byId('help-btn').focus();
    tipBanner().querySelector('button').focus();
    await end();
    expect(shown()).toEqual([]);
    expect(document.activeElement).toBe(byId('help-btn'));

    // Again, from a control gone by the time the tip goes.
    retireApp(app);
    const next = await firstStart();
    byId('splash-close').click();
    await vi.advanceTimersByTimeAsync(1500);
    const helper = document.createElement('button');
    document.body.append(helper);
    helper.focus();
    tipBanner().querySelector('button').focus();
    helper.remove();
    await end();
    expect(document.activeElement).toBe(byId('scope-route-btn'));
    expect(next.modeBanner.isShowing()).toBe(false);
  });

  test('its 8 s with focus elsewhere move no focus', async () => {
    const app = await firstStart();
    byId('splash-close').click();
    await vi.advanceTimersByTimeAsync(1500);
    byId('help-btn').focus();
    await vi.advanceTimersByTimeAsync(8000);
    expect(app.modeBanner.isShowing()).toBe(false);
    expect(document.activeElement).toBe(byId('help-btn'));
  });
});

describe('nothing waits on the slot after teardown (m21; Codex\'s recheck)', () => {
  const teardowns = [
    ['stopApp', app => retireApp(app)],
    ['destroy()', app => app.destroy()],
  ];

  test.each(teardowns)('a first start stopped by %s before the tip shows: the timers run, no tip, nothing thrown', async (_, stop) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const app = await boot();
    await vi.advanceTimersByTimeAsync(50);
    await app.ready;
    const shownBanner = vi.spyOn(app.modeBanner, 'show');
    stop(app);
    await vi.advanceTimersByTimeAsync(10000);
    expect(shownBanner).not.toHaveBeenCalled();
    expect(byId('preview-tip-banner')).toBeNull();
  });

  test('a first start stopped while the tip waits for the welcome: the welcome closed after, no tip', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const app = await boot();
    await vi.advanceTimersByTimeAsync(50);
    await app.ready;
    await vi.advanceTimersByTimeAsync(2000);
    const shownBanner = vi.spyOn(app.modeBanner, 'show');
    retireApp(app);
    // The welcome goes as its own close would take it: hidden, its trap let go.
    byId('splash').style.display = 'none';
    app._splashFocusTrap.deactivate();
    await vi.advanceTimersByTimeAsync(10000);
    expect(shownBanner).not.toHaveBeenCalled();
    expect(byId('preview-tip-banner')).toBeNull();
  });

  test.each(teardowns)('the tip showing, its 8 s running, stopped by %s: nothing takes it away after', async (_, stop) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const app = await boot();
    await vi.advanceTimersByTimeAsync(50);
    await app.ready;
    byId('splash-close').click();
    await vi.advanceTimersByTimeAsync(1500);
    expect(byId('preview-tip-banner')).not.toBeNull();
    const hidden = vi.spyOn(app.modeBanner, 'hide');
    stop(app);
    await vi.advanceTimersByTimeAsync(10000);
    expect(hidden).not.toHaveBeenCalled();
  });

  test.each(teardowns)('a banner mid-transition stopped by %s: its settle never refits', async (_, stop) => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    Object.assign(slot().style, { transitionProperty: 'min-height, max-height', transitionDuration: '150ms' });
    const refit = vi.spyOn(app, '_refitAfterModeBanner');
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(refit).not.toHaveBeenCalled();
    stop(app);
    slot().dispatchEvent(new Event('transitionend'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(refit).not.toHaveBeenCalled();
  });

  test.each(teardowns)('a refit held back while playing, and the resize\'s path recalculation waiting, stopped by %s: neither runs', async (_, stop) => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    slotTakes(48);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    const state = app.animationEngine.state;
    state.isPlaying = true;
    state.isPaused = false;
    slotTakes(0);
    app.eventBus.emit('route:branch-cancel');
    expect(app._modeBannerRefitPending).toBe(true);
    const path = vi.spyOn(app, 'calculatePath');
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    stop(app);
    expect(app._modeBannerRefitPending).toBe(false);
    state.isPaused = true;
    app.animationEngine.emit?.('pause');
    await vi.advanceTimersByTimeAsync(1000);
    expect(refit).not.toHaveBeenCalled();
    expect(path).not.toHaveBeenCalled();
  });
});
