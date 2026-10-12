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
import { FORCED_COLOURS, cascade, contrast, hex, resolveValue, textPair, tokensFor } from './helpers/cssTokens.js';
import { VideoExporter } from '../src/services/VideoExporter.js';
import { createFocusTrap, whenNoModalOpen } from '../src/utils/focusTrap.js';

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
  // What the adds say, the chip's lines among it, is said at their turn's end (round 2, finding 4): before a test listens.
  await turn();
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
    // Each height-bearing transition's end, by name (round 2, advisory 8: the settle waits for them all).
    for (const propertyName of ['min-height', 'max-height']) {
      const ended = new Event('transitionend');
      Object.defineProperty(ended, 'propertyName', { value: propertyName });
      slot().dispatchEvent(ended);
    }
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
    // Shown as the mode switch shows it, by its own `hidden` (round 2, finding 2: no page writes `body[data-mode]`).
    badge.hidden = false;
    expect(cascade(badge, 'display').value).toBe('block');
    expect(cascade(badge, 'position').value).toBe('absolute');
    expect([cascade(badge, 'top').value, cascade(badge, 'right').value]).toEqual(['var(--space-3)', 'var(--space-3)']);
    expect(cascade(badge, 'left')).toBeUndefined();
    expect(cascade(badge, 'bottom')).toBeUndefined();
    const { fg, bg } = textPair(badge);
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(7);
    // Its containing block at both widths is the canvas's own frame (round 2, Q5), no longer the canvas area.
    for (const media of [[], [NARROW]]) expect(cascade(badge.parentElement, 'position', { media }).value).toBe('relative');
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
    // The change's own message, and the operation says it is (round 2, finding 4: a message covers by saying so, not by being said).
    app.announce('Undo');
    app.coverRegionLines?.();
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

// ---------------------------------------------------------------------------
// Round 2 (Codex r1 on 7a74755, its findings by number; the owner's answer and
// the lead's settlements, 2026-10-12).
// ---------------------------------------------------------------------------

/** A path recalculation's moment: inside a video export, or while playback runs. */
function recordPaths(app) {
  const runs = [];
  const original = app.calculatePath;
  app.calculatePath = function recordedCalculatePath(...args) {
    runs.push({ exporting: Boolean(app._isExportMode), playing: Boolean(app.animationEngine.state.isActivelyPlaying()) });
    return original.apply(this, args);
  };
  return runs;
}

/** A video export that draws one frame, then holds until the test lets it end. */
function holdingExport(app) {
  let release;
  const held = new Promise(resolveHeld => { release = resolveHeld; });
  let started;
  const running = new Promise(resolveStarted => { started = resolveStarted; });
  app.videoExporter = {
    cancel() {},
    async export({ renderFrame }) {
      await renderFrame(0.5);
      started();
      await held;
      return new Blob(['video'], { type: 'video/mp4' });
    },
  };
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  return { running, finish: () => release() };
}

/** Let an export the test released finish, its clean-up included, on the fake clock. */
async function exportEnds(exported) {
  let done = false;
  exported.then(() => { done = true; }, () => { done = true; });
  for (let step = 0; step < 50 && !done; step += 1) await vi.advanceTimersByTimeAsync(0);
  expect(done).toBe(true);
}

describe('round 2, finding 1: a refit\'s path recalculation never runs inside an export or while playing', () => {
  test('a banner shown, an export started before its recalculation is due: nothing recalculates while it exports; its exit\'s refit is the only recalculation after', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { running, finish } = holdingExport(app);
    slotTakes(48);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    const paths = recordPaths(app);
    const exited = vi.spyOn(app, '_exitExportMode');
    const exported = app.exportVideo();
    await running;
    await vi.advanceTimersByTimeAsync(500);
    expect(paths.filter(run => run.exporting)).toEqual([]);
    finish();
    await exportEnds(exported);
    expect(exited).toHaveBeenCalledTimes(1);
    const atExit = paths.length;
    expect(atExit).toBeGreaterThanOrEqual(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(paths.length).toBe(atExit);
  });

  test('an export that ends before the recalculation is due: none follows its exit\'s refit', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { running, finish } = holdingExport(app);
    slotTakes(48);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    const paths = recordPaths(app);
    const exported = app.exportVideo();
    await running;
    finish();
    await exportEnds(exported);
    const atExit = paths.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(paths.length).toBe(atExit);
    expect(paths.filter(run => run.exporting)).toEqual([]);
  });

  test('a pause draining a held refit as an export starts: nothing recalculates while it exports', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { running, finish } = holdingExport(app);
    const state = app.animationEngine.state;
    state.isPlaying = true;
    state.isPaused = false;
    slotTakes(48);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(app._modeBannerRefitPending).toBe(true);
    const paths = recordPaths(app);
    app.animationEngine.pause();
    const exported = app.exportVideo();
    await running;
    await vi.advanceTimersByTimeAsync(500);
    expect(paths.filter(run => run.exporting)).toEqual([]);
    finish();
    await exportEnds(exported);
    const atExit = paths.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(paths.length).toBe(atExit);
  });

  test('playback started before the recalculation is due: none while it plays; the pause runs it, once', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // The engine's frames held, so the playback stays where the test puts it while its clock runs.
    const frames = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    try {
      slotTakes(48);
      app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
      const paths = recordPaths(app);
      const state = app.animationEngine.state;
      state.isPlaying = true;
      state.isPaused = false;
      await vi.advanceTimersByTimeAsync(500);
      expect(paths).toEqual([]);
      app.animationEngine.pause();
      expect(paths).toEqual([{ exporting: false, playing: false }]);
      app.animationEngine.pause();
      app.animationEngine.reset();
      await vi.advanceTimersByTimeAsync(500);
      expect(paths).toHaveLength(1);
    } finally {
      frames.mockRestore();
    }
  });
});

describe('round 2, finding 2 and Q5: the Preview badge shows in Preview, on the canvas\'s own corner', () => {
  const badge = () => byId('preview-badge');
  /** Whether the stylesheet draws the badge, its own `hidden` included. */
  const badgeShown = () => cascade(badge(), 'display').value !== 'none';
  /** Space or Enter on the switch, as a browser activates a button: a click unless a key listener refused it. */
  function pressOn(control, key) {
    control.focus();
    const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    control.dispatchEvent(down);
    if (key === 'Enter' && !down.defaultPrevented) control.click();
    const up = new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true });
    control.dispatchEvent(up);
    if (key === ' ' && !down.defaultPrevented && !up.defaultPrevented) control.click();
  }

  test('as served the shell is in Edit and the badge is hidden; the app starts in Preview and shows it; the start\'s sync in Edit hides it', async () => {
    mountShell();
    expect(byId('mode-toggle-btn').getAttribute('aria-checked')).toBe('false');
    expect(badgeShown()).toBe(false);
    const app = await editor();
    expect(app.previewMode).toBe(true);
    expect(badgeShown()).toBe(true);
    // The app always starts in Preview (main.js); its start's sync, run in Edit, hides it.
    app.previewMode = false;
    app._syncInitialUIState();
    expect(badgeShown()).toBe(false);
    app.previewMode = true;
    app._syncInitialUIState();
    expect(badgeShown()).toBe(true);
  });

  test('the mode switch shows and hides it: its click, and Space and Enter on it', async () => {
    const app = await editor();
    const toggle = byId('mode-toggle-btn');
    toggle.click();
    expect([app.previewMode, badgeShown()]).toEqual([false, false]);
    toggle.click();
    expect([app.previewMode, badgeShown()]).toEqual([true, true]);
    for (const key of [' ', 'Enter']) {
      pressOn(toggle, key);
      expect([key, app.previewMode, badgeShown()]).toEqual([key, false, false]);
      pressOn(toggle, key);
      expect([key, app.previewMode, badgeShown()]).toEqual([key, true, true]);
    }
  });

  test('an export from Edit shows it while it draws in Preview, and hides it again with Edit after', async () => {
    const app = await routeOfTwo();
    byId('mode-toggle-btn').click();
    expect([app.previewMode, badgeShown()]).toEqual([false, false]);
    const { running, finish } = holdingExport(app);
    const exported = app.exportVideo();
    await running;
    expect([app.previewMode, badgeShown()]).toEqual([true, true]);
    finish();
    await exported;
    expect([app.previewMode, badgeShown()]).toEqual([false, false]);
  });

  test('it stands in the canvas\'s own box, top-right, at both widths, so a letterboxed canvas keeps it on the canvas; the room is still the canvas area\'s (Q5)', async () => {
    mountShell();
    const frame = badge().parentElement;
    expect(frame).toBe(byId('canvas').parentElement);
    expect(frame).not.toBe(byId('canvas-area'));
    expect(frame.parentElement).toBe(byId('canvas-area'));
    for (const media of [[], [NARROW]]) {
      expect(cascade(frame, 'position', { media }).value).toBe('relative');
      expect(cascade(frame, 'width', { media })).toBeUndefined();
      expect(cascade(frame, 'height', { media })).toBeUndefined();
    }
    badge().hidden = false;
    expect(cascade(badge(), 'position').value).toBe('absolute');
    expect([cascade(badge(), 'top').value, cascade(badge(), 'right').value]).toEqual(['var(--space-3)', 'var(--space-3)']);
    const app = await editor();
    // bootApp's canvas area: 1280 × 720, its transport 60 px.
    expect(app._canvasAreaRoom()).toEqual({ width: 1280, height: 660 });
    expect(app._fittedRoom).toEqual({ width: 1280, height: 660 });
  });
});

describe('round 2, finding 3: a replacement never overwrites a holder without its exit', () => {
  function bare() {
    document.body.innerHTML = '<div id="mode-banner"></div>';
    return new ModeBanner(slot());
  }

  test('a holder whose exit shows a third owner\'s banner: that owner exits too before the incoming one is drawn; one owner active at the end, and no height told for the passing claim', () => {
    const banner = bare();
    banner.onHeightChange = vi.fn();
    const active = new Set();
    const c = { onReplaced: vi.fn(() => { active.delete(c); banner.hide(c); }) };
    const a = { onReplaced: vi.fn(() => { active.delete(a); banner.hide(a); banner.show(c, { id: 'c' }); active.add(c); }) };
    const b = { onReplaced: vi.fn() };
    banner.show(a, { id: 'a' });
    active.add(a);
    banner.onHeightChange.mockClear();
    banner.show(b, { id: 'b' });
    active.add(b);
    expect([a.onReplaced.mock.calls.length, c.onReplaced.mock.calls.length, b.onReplaced.mock.calls.length]).toEqual([1, 1, 0]);
    expect([...active]).toEqual([b]);
    expect(shown()).toEqual(['b']);
    expect(banner.holder).toBe(b);
    expect(banner.onHeightChange).not.toHaveBeenCalled();
  });

  test('a holder whose exit claims the slot again before it hides: its exit runs once, and the claim it made exits in turn', () => {
    const banner = bare();
    const active = new Set();
    const c = { onReplaced: vi.fn(() => { active.delete(c); banner.hide(c); }) };
    const a = {
      onReplaced: vi.fn(() => {
        // On 7a74755 the claim below re-entered this exit; stop that recursion here so the count shows it.
        if (a.onReplaced.mock.calls.length > 1) return;
        active.delete(a);
        banner.show(c, { id: 'c' });
        active.add(c);
        banner.hide(a);
      }),
    };
    const b = { onReplaced: vi.fn() };
    banner.show(a, { id: 'a' });
    active.add(a);
    banner.show(b, { id: 'b' });
    active.add(b);
    expect([a.onReplaced.mock.calls.length, c.onReplaced.mock.calls.length]).toEqual([1, 1]);
    expect([...active]).toEqual([b]);
    expect(shown()).toEqual(['b']);
  });

  test('a waiter for a free slot waits through a nested claim and runs once the last banner goes (a pin: 7a74755 held it too)', () => {
    const banner = bare();
    const waited = vi.fn();
    const c = { onReplaced: () => banner.hide(c) };
    const a = { onReplaced: () => { banner.hide(a); banner.show(c, { id: 'c' }); } };
    const b = { onReplaced: () => banner.hide(b) };
    banner.show(a, { id: 'a' });
    banner.whenFree(waited);
    banner.show(b, { id: 'b' });
    expect(waited).not.toHaveBeenCalled();
    expect(shown()).toEqual(['b']);
    banner.hide(b);
    expect(waited).toHaveBeenCalledTimes(1);
  });

  test('in the app: a branch armed while an area draw ends by showing the tip\'s turn: the draw ends, the branch alone holds the slot', async () => {
    const app = await routeOfTwo();
    const area = app.areaDrawingService;
    area.startDrawing(app.waypoints[0]);
    // An exit that hands the slot on, as a waiting owner would.
    const tipLike = { onReplaced: vi.fn(() => app.modeBanner.hide(tipLike)) };
    const cancel = area.cancelDrawing.bind(area);
    area.cancelDrawing = () => { cancel(); app.modeBanner.show(tipLike, { id: 'passing-banner' }); };
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(area.isDrawing).toBe(false);
    expect(tipLike.onReplaced).toHaveBeenCalledTimes(1);
    expect(app.interactionHandler.branchArmed).toBe(app.waypoints[0]);
    expect(shown()).toEqual(['branch-banner']);
  });
});

describe('round 2, finding 4: a region\'s line is left unsaid only where its change\'s own message says it', () => {
  /** Two crowd nodes not yet linked, on a project just opened: a clean status episode. */
  const twoNodes = {
    coordVersion: 9,
    waypoints: [{ id: 'a', imgX: 0.2, imgY: 0.3, isMajor: true }, { id: 'b', imgX: 0.7, imgY: 0.6, isMajor: true }],
    scene: {
      flowLayers: [{
        id: 'net', name: 'net', guideType: 'graph', emitters: [{ id: 'net-e', seed: 7 }],
        graph: { nodes: [{ id: 'n1', x: 0.2, y: 0.5, type: 'entry' }, { id: 'n2', x: 0.8, y: 0.5, type: 'exit' }], edges: [] },
      }],
    },
  };

  test('a link drawn between two nodes of a project just opened says its count and "Unsaved changes", both new', async () => {
    const app = await editor();
    expect(await loadSnapshot(app, twoNodes)).toBe(true);
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayers()[0]);
    byId('network-edit-btn').click();
    const network = app.networkEditService;
    expect(network.active).toBe(true);
    await turn();
    const { said } = listen(app);
    const [first, second] = network.layer.graph.getNodes();
    network.penNodeId = second.id;
    network.clickNode(first);
    await turn();
    expect(said()).toContain('Unsaved changes');
    expect(said().filter(message => message === '2 nodes · 1 path')).toHaveLength(1);
  });

  test('a waypoint added on the canvas of a fresh start says its scope and "Unsaved changes", both new', async () => {
    const app = await editor();
    await vi.waitFor(() => expect(app.background.image).toBeTruthy());
    app._setPreviewMode(false);
    await turn();
    const { said } = listen(app);
    tapCanvas(app, [0.5, 0.5]);
    await turn();
    expect(app.waypoints).toHaveLength(1);
    expect(said()).toContain('Unsaved changes');
    expect(said().filter(message => message === 'Editing · Waypoint 1 · major')).toHaveLength(1);
  });

  test('an area\'s corner on a project just opened says its count line (a pin: its line was never a region\'s alone)', async () => {
    const app = await editor();
    expect(await loadSnapshot(app, { coordVersion: 9, waypoints: twoNodes.waypoints })).toBe(true);
    app.areaDrawingService.startDrawing(app.waypoints[0]);
    await turn();
    const { said } = listen(app);
    app.eventBus.emit('area:draw-click', { imgX: 0.2, imgY: 0.2 });
    await turn();
    expect(said()).toContain('1 corner (2 more needed to close)');
  });

  test('the change\'s own message covers its region\'s line in continuations it awaits, before or after the line', async () => {
    const app = await routeOfTwo();
    await turn();
    const { said } = listen(app);
    app.announceUnlessSaid('Editing · Route');
    await Promise.resolve();
    await Promise.resolve();
    app.announce('Undo');
    app.coverRegionLines?.();
    await turn();
    expect(said()).toEqual(['Undo']);

    app.announce('Redo');
    app.coverRegionLines?.();
    await Promise.resolve();
    await Promise.resolve();
    app.announceUnlessSaid('Editing · Waypoint 1 · major');
    await turn();
    expect(said()).toEqual(['Undo', 'Redo']);
  });

  test('a status line or a notice in the same task, before, after or in an awaited continuation, covers nothing: the line is said too', async () => {
    const app = await routeOfTwo();
    await turn();
    const { said } = listen(app);
    app.announce('Unsaved changes');
    app.announceUnlessSaid('2 nodes · 1 path');
    await turn();
    expect(said()).toEqual(['Unsaved changes', '2 nodes · 1 path']);

    app.announceUnlessSaid('3 nodes · 2 paths');
    await Promise.resolve();
    app.announce('Saved to browser recovery');
    await turn();
    expect(said()).toEqual(['Unsaved changes', '2 nodes · 1 path', 'Saved to browser recovery', '3 nodes · 2 paths']);
  });

  test('a region\'s line written twice in one turn is said once, as the region ends the turn; another region\'s is said beside it', async () => {
    const app = await routeOfTwo();
    await turn();
    const { said } = listen(app);
    app.announceUnlessSaid('Editing · Waypoint 2 · major', 'scope-chip');
    app.announceUnlessSaid('2 nodes · 1 path', 'network-count');
    app.announceUnlessSaid('Editing · Waypoint 1·B1', 'scope-chip');
    await turn();
    expect(said()).toEqual(['Editing · Waypoint 1·B1', '2 nodes · 1 path']);
  });

  test('a branch placed: the chip is said once, naming the branch\'s first waypoint, not the numbering it passed through', async () => {
    const app = await routeOfTwo();
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    await turn();
    const { said } = listen(app);
    app.eventBus.emit('route:branch-place', { imgX: 0.4, imgY: 0.8 });
    await turn();
    const chip = said().filter(message => message.startsWith('Editing ·'));
    expect(chip).toEqual([byId('scope-chip-text').textContent]);
  });

  test('the start\'s tip waiting in the queue covers nothing', async () => {
    const app = await routeOfTwo();
    await turn();
    const { said } = listen(app);
    app.announce(TIP, 'polite', { whenIdle: true });
    app.announceUnlessSaid('Editing · Route');
    await turn();
    expect(said()).toEqual([TIP, 'Editing · Route']);
  });

  test('a real Undo still covers the chip it moves (a pin of a covering message)', async () => {
    const app = await routeOfTwo();
    const chipBefore = byId('scope-chip-text').textContent;
    const { said } = listen(app);
    app.eventBus.emit('history:undo');
    await turn();
    expect(app.waypoints).toHaveLength(1);
    expect(byId('scope-chip-text').textContent).not.toBe(chipBefore);
    expect(said().filter(message => message.startsWith('Editing ·'))).toEqual([]);
    expect(said()).toContain('Undo');
  });
});

describe('round 2, finding 5: focus stops the chip\'s line only where the focused control names what is now selected', () => {
  async function routeOnCanvas() {
    const app = await routeOfTwo();
    await vi.waitFor(() => expect(app.background.image).toBeTruthy());
    app.eventBus.emit('waypoint:deselected');
    await turn();
    return app;
  }
  const selectOnCanvas = (app, waypoint) => tapCanvas(app, [waypoint.imgX, waypoint.imgY]);

  test('focus left on the Layers strip\'s Route row: a waypoint chosen on the canvas is said', async () => {
    const app = await routeOnCanvas();
    byId('layers-strip').querySelector('.layer-row').focus();
    const { said } = listen(app);
    selectOnCanvas(app, app.waypoints[0]);
    await turn();
    expect(app.selectedWaypoint).toBe(app.waypoints[0]);
    expect(said()).toEqual(['Editing · Waypoint 1 · major']);
  });

  test('focus on that waypoint\'s own list row: not said again (a pin)', async () => {
    const app = await routeOnCanvas();
    app.uiController.rowButtonFor(app.waypoints[0]).focus();
    const { said } = listen(app);
    selectOnCanvas(app, app.waypoints[0]);
    await turn();
    expect(app.selectedWaypoint).toBe(app.waypoints[0]);
    expect(said()).not.toContain('Editing · Waypoint 1 · major');
  });

  test('focus left in the scene outline on another waypoint\'s entry: a waypoint chosen on the canvas is said; on its own entry, not again', async () => {
    const app = await routeOnCanvas();
    const summaryOf = waypoint => [...byId('scene-outline').querySelectorAll('summary[data-outline-key]')]
      .find(summary => summary.dataset.outlineKey.startsWith(`waypoint:${waypoint.id}:`));
    summaryOf(app.waypoints[1]).focus();
    const { said } = listen(app);
    selectOnCanvas(app, app.waypoints[0]);
    await turn();
    expect(app.selectedWaypoint).toBe(app.waypoints[0]);
    expect(said()).toEqual(['Editing · Waypoint 1 · major']);

    app.eventBus.emit('waypoint:deselected');
    await turn();
    await frames();
    summaryOf(app.waypoints[0]).focus();
    const before = said().length;
    selectOnCanvas(app, app.waypoints[0]);
    await turn();
    expect(app.selectedWaypoint).toBe(app.waypoints[0]);
    expect(said().slice(before)).not.toContain('Editing · Waypoint 1 · major');
  });

  test('a crowd chosen from its own Layers row is not said again; chosen with focus on the Route row, it is', async () => {
    const app = await routeOnCanvas();
    app.addCrowd();
    app.eventBus.emit('crowd:deselected');
    await turn();
    const rows = () => [...byId('layers-strip').querySelectorAll('.layer-row')];
    const { said } = listen(app);
    rows()[1].focus();
    rows()[1].click();
    await turn();
    expect(app.selectedCrowd).toBe(app.scene.getFlowLayers()[0]);
    expect(said()).not.toContain('Editing · Crowd 1 · crowd');

    rows()[0].click();
    await turn();
    rows()[0].focus();
    const before = said().length;
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayers()[0]);
    await turn();
    expect(said().slice(before)).toEqual(['Editing · Crowd 1 · crowd']);
  });
});

describe('round 2, finding 6: a banner\'s action keeps its focus indicator under the pointer, inside the slot', () => {
  test('focused, and focused under the pointer: a 3 px ring inside the button, in its words\' colour, at 3:1 or more on every banner; never outside the slot\'s clip; forced colours an inset outline', () => {
    mountShell();
    const banner = new ModeBanner(slot());
    slot().classList.add('is-showing');
    for (const id of ['network-edit-banner', 'area-draw-banner', 'branch-banner', 'preview-tip-banner']) {
      const { actions: [action] } = banner.show({ id }, { id, title: 'Title', actions: [{ label: 'Done' }] });
      for (const states of [['focus-visible'], ['hover', 'focus-visible']]) {
        expect(cascade(action, 'box-shadow', { states }).value, `${id} ${states}`).toBe('inset 0 0 0 3px currentColor');
        expect(cascade(action, 'outline', { states }).value, `${id} ${states}`).toBe('none');
        const { fg, bg } = textPair(action, { states });
        expect(contrast(fg, bg), `${id} ${states}`).toBeGreaterThanOrEqual(3);
      }
      // Hovered alone, a thinner ring: the focused one is told apart.
      expect(cascade(action, 'box-shadow', { states: ['hover'] }).value).toBe('inset 0 0 0 1px currentColor');
      // Forced colours: the system outline drawn inside the button's edge.
      const tokens = tokensFor([FORCED_COLOURS]);
      const offset = resolveValue(cascade(action, 'outline-offset', { states: ['focus-visible'], media: [FORCED_COLOURS] }).value, tokens);
      const width = resolveValue(cascade(action, 'outline-width', { states: ['focus-visible'], media: [FORCED_COLOURS] })?.value
        ?? cascade(action, 'outline', { states: ['focus-visible'], media: [FORCED_COLOURS] }).value.split(' ')[0], tokens);
      const px = value => (value.endsWith('rem') ? parseFloat(value) * 16 : parseFloat(value));
      expect(px(offset) + px(width), `${id} forced colours: ${offset} + ${width}`).toBeLessThanOrEqual(0);
    }
  });
});

describe('round 2, finding 7: no line waiting for its turn\'s end is said after teardown', () => {
  test.each([
    ['destroy()', app => app.destroy()],
    ['stopApp', app => retireApp(app)],
  ])('a line queued, then %s, then the turn ends: nothing is said (stopApp\'s a pin: on 7a74755 its own pause message hid the line)', async (_, stop) => {
    const app = await routeOfTwo();
    await turn();
    const { said } = listen(app);
    app.announceUnlessSaid('pending count');
    stop(app);
    await Promise.resolve();
    await turn();
    // What the teardown says of itself (stopping the transport) is not this line.
    expect(said()).not.toContain('pending count');
  });
});

describe('round 2, the lead\'s settlement: the refit measures the canvas area once the slot has its final height', () => {
  /**
   * The slot eases as the stylesheet has it. Its height is the test's, and
   * changes with what it shows, as text that wraps does; the canvas area's
   * room is less what the test says the slot takes.
   */
  function easing() {
    Object.assign(slot().style, { transitionProperty: 'min-height, max-height', transitionDuration: '150ms, 150ms' });
    let height = 0;
    Object.defineProperty(slot(), 'offsetHeight', { configurable: true, get: () => height + slot().textContent.length });
    const setHeight = value => {
      height = value;
      slotTakes(value);
    };
    return { setHeight };
  }
  const end = property => {
    const event = new Event('transitionend');
    Object.defineProperty(event, 'propertyName', { value: property });
    slot().dispatchEvent(event);
  };

  test.each([
    ['nothing else (a pin)', () => {}],
    ['a corner placed during the entry, its count line rewritten', app => app.eventBus.emit('area:draw-click', { imgX: 0.2, imgY: 0.2 })],
    ['a branch armed during the entry, replacing it', app => app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[1] })],
  ])('an area draw\'s banner shown, with %s: one refit, once the fallback has run, to the final room', async (_, during) => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { setHeight } = easing();
    const before = app.displayHeight;
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    app.areaDrawingService.startDrawing(app.waypoints[0]);
    await vi.advanceTimersByTimeAsync(50);
    // Mid-way through the ease.
    setHeight(20);
    during(app);
    expect(refit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    setHeight(48);
    await vi.advanceTimersByTimeAsync(149);
    expect(refit).not.toHaveBeenCalled();
    // 250 ms: the 150 ms ease and the fallback's margin.
    await vi.advanceTimersByTimeAsync(1);
    expect(refit).toHaveBeenCalledTimes(1);
    expect(app.displayHeight).toBe(before - 48);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refit).toHaveBeenCalledTimes(1);
  });

  test('shown, then hidden: one refit each, after each fallback, to each final room (a pin)', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { setHeight } = easing();
    const before = app.displayHeight;
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    setHeight(48);
    await vi.advanceTimersByTimeAsync(250);
    expect(refit).toHaveBeenCalledTimes(1);
    app.eventBus.emit('route:branch-cancel');
    setHeight(0);
    await vi.advanceTimersByTimeAsync(249);
    expect(refit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refit).toHaveBeenCalledTimes(2);
    expect(app.displayHeight).toBe(before);
  });

  test('interrupted: a show hidden before its end refits nothing; a hide shown again before its end refits nothing (pins)', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { setHeight } = easing();
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    setHeight(20);
    await vi.advanceTimersByTimeAsync(60);
    app.eventBus.emit('route:branch-cancel');
    setHeight(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refit).not.toHaveBeenCalled();

    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    setHeight(48);
    await vi.advanceTimersByTimeAsync(250);
    expect(refit).toHaveBeenCalledTimes(1);
    app.eventBus.emit('route:branch-cancel');
    setHeight(30);
    await vi.advanceTimersByTimeAsync(60);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    setHeight(48);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refit).toHaveBeenCalledTimes(1);
  });

  test('the end waited for is the height-bearing transitions\', each by name: min-height\'s alone refits nothing; max-height\'s then refits once', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { setHeight } = easing();
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    setHeight(48);
    end('opacity');
    end('min-height');
    expect(refit).not.toHaveBeenCalled();
    end('max-height');
    expect(refit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refit).toHaveBeenCalledTimes(1);
  });

  test('a fallback that ran before the slot had eased: the late end refits to the room it then has', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { setHeight } = easing();
    const before = app.displayHeight;
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    setHeight(20);
    await vi.advanceTimersByTimeAsync(250);
    expect(refit).toHaveBeenCalledTimes(1);
    setHeight(48);
    end('min-height');
    end('max-height');
    expect(refit).toHaveBeenCalledTimes(2);
    expect(app.displayHeight).toBe(before - 48);
  });

  test('reduced motion: the refit runs at once, to the room the slot leaves (a pin)', async () => {
    const app = await routeOfTwo();
    Object.assign(slot().style, { transitionProperty: 'none', transitionDuration: '0.01ms' });
    const before = app.displayHeight;
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    slotTakes(48);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(refit).toHaveBeenCalledTimes(1);
    expect(app.displayHeight).toBe(before - 48);
  });

  test('the transition\'s lists repeat as CSS repeats them: one duration and two delays wait for the longer delay', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    document.body.innerHTML = '<div id="mode-banner"></div>';
    const banner = new ModeBanner(slot());
    banner.onHeightChange = vi.fn();
    Object.assign(slot().style, { transitionProperty: 'min-height, max-height', transitionDuration: '150ms', transitionDelay: '0ms, 300ms' });
    banner.show({}, { id: 'mode' });
    vi.advanceTimersByTime(549);
    expect(banner.onHeightChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(banner.onHeightChange).toHaveBeenCalledTimes(1);
  });

  test('a refit compares the room with the one the canvas was last fitted to: a fit meanwhile at the final room leaves nothing to do (a pin)', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { setHeight } = easing();
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    setHeight(48);
    app.updateCanvasAspectRatio();
    const refit = vi.spyOn(app, 'updateCanvasAspectRatio');
    await vi.advanceTimersByTimeAsync(1000);
    expect(refit).not.toHaveBeenCalled();
  });

  test('a banner\'s refit is a resize\'s: the same fit and the same path rebuild (Q3, settled: a pin)', async () => {
    const app = await routeOfTwo();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const viaResize = vi.spyOn(app, '_refitCanvasToArea');
    slotTakes(48);
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(viaResize).toHaveBeenCalledTimes(1);
    const bannerFit = { width: app.displayWidth, height: app.displayHeight };
    slotTakes(0);
    app.eventBus.emit('route:branch-cancel');
    expect(viaResize).toHaveBeenCalledTimes(2);
    // The window made 48 px shorter instead: the resize's own refit, to the same fit.
    slotTakes(48);
    window.dispatchEvent(new Event('resize'));
    expect(viaResize).toHaveBeenCalledTimes(3);
    expect({ width: app.displayWidth, height: app.displayHeight }).toEqual(bannerFit);
  });
});

describe('round 2, Q5: toasts stay in view at narrow widths, clear of the transport\'s controls', () => {
  const cleanups = [];
  afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });
  function narrowViewport(height) {
    const media = window.matchMedia;
    window.matchMedia = vi.fn(query => ({ ...media(query), matches: /max-width:\s*64rem/.test(query) }));
    const original = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
    cleanups.push(() => {
      window.matchMedia = media;
      if (original) Object.defineProperty(window, 'innerHeight', original);
      else delete window.innerHeight;
    });
  }
  const lift = () => byId('toast-container').style.getPropertyValue('--toast-lift');

  test('at 64 rem and below the container is fixed to the viewport\'s bottom centre, lifted by what the app measures; above, it stands on the sticky transport as built', () => {
    mountShell();
    const container = byId('toast-container');
    expect(cascade(container, 'position', { media: [NARROW] }).value).toBe('fixed');
    expect(cascade(container, 'bottom', { media: [NARROW] }).value).toBe('calc(var(--toast-lift) + var(--space-2))');
    expect(cascade(container, '--toast-lift').value).toBe('0px');
    expect([cascade(container, 'left', { media: [NARROW] }).value, cascade(container, 'right', { media: [NARROW] }).value])
      .toEqual(['var(--space-3)', 'var(--space-3)']);
    expect(cascade(container, 'position').value).toBe('absolute');
    // Nothing between it and the viewport makes a containing block of its own.
    for (let element = container.parentElement; element && element !== document.body; element = element.parentElement) {
      for (const property of ['transform', 'filter', 'contain', 'perspective', 'will-change']) {
        const value = cascade(element, property, { media: [NARROW] })?.value;
        expect(value === undefined || value === 'none', `${element.id || element.className} ${property}: ${value}`).toBe(true);
      }
    }
  });

  test('the transport\'s controls in view: the toasts sit above them; scrolled away, at the viewport\'s bottom (measured on scroll)', async () => {
    const app = await editor();
    narrowViewport(800);
    const controls = document.querySelector('#canvas-area > .controls');
    const container = byId('toast-container');
    Object.defineProperty(container, 'offsetHeight', { configurable: true, get: () => 56 });
    let top = 500;
    controls.getBoundingClientRect = () => ({ top, bottom: top + 100, left: 0, right: 400, width: 400, height: 100 });
    app.showToast('Deleted waypoint — press Ctrl+Z to undo', 0);
    expect(lift()).toBe('300px');
    top = -150;
    window.dispatchEvent(new Event('scroll'));
    expect(lift()).toBe('0px');
    top = 40;
    document.dispatchEvent(new Event('scroll'));
    expect(lift()).toBe('0px');
    top = 900;
    window.dispatchEvent(new Event('resize'));
    expect(lift()).toBe('0px');
    top = 640;
    window.dispatchEvent(new Event('scroll'));
    expect(lift()).toBe('160px');
  });

  test('torn down with a toast up, scrolling measures nothing more and throws nothing (its listeners released)', async () => {
    const app = await editor();
    narrowViewport(800);
    const controls = document.querySelector('#canvas-area > .controls');
    Object.defineProperty(byId('toast-container'), 'offsetHeight', { configurable: true, get: () => 56 });
    let top = 500;
    controls.getBoundingClientRect = () => ({ top, bottom: top + 100, left: 0, right: 400, width: 400, height: 100 });
    app.showToast('Deleted waypoint — press Ctrl+Z to undo', 0);
    expect(lift()).toBe('300px');
    app.destroy();
    // A listener left behind would run against a destroyed app (its elements gone) and throw.
    const thrown = [];
    const onError = event => { thrown.push(event.error ?? event.message); event.preventDefault(); };
    window.addEventListener('error', onError);
    try {
      top = -150;
      window.dispatchEvent(new Event('scroll'));
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(thrown).toEqual([]);
    expect(lift()).toBe('300px');
  });
});

describe('round 2: the owner\'s colours and the words, kept (pins)', () => {
  test('each banner takes its owner\'s scope colour, as the scope chip does: the route\'s modes and the tip UoN blue, network editing the crowd\'s green (the owner, 2026-10-12)', () => {
    mountShell();
    const banner = new ModeBanner(slot());
    const surfaces = {};
    for (const id of ['network-edit-banner', 'area-draw-banner', 'branch-banner', 'preview-tip-banner']) {
      const { root } = banner.show({ id }, { id, title: 'Title' });
      surfaces[id] = cascade(root, 'background').value;
    }
    expect(surfaces).toEqual({
      'network-edit-banner': 'var(--scope-crowd-fg)',
      'area-draw-banner': 'var(--interactive-01)',
      'branch-banner': 'var(--interactive-01)',
      'preview-tip-banner': 'var(--interactive-01)',
    });
    // The chip's crowd scope is drawn in the same green.
    const chip = document.querySelector('.scope-chip');
    chip.dataset.scope = 'crowd';
    expect(cascade(chip, 'color').value).toBe(surfaces['network-edit-banner']);
  });

  test('each banner\'s words, its key written "Esc" and said "Escape", as the network\'s entry says it (Q4, settled)', async () => {
    const app = await withCrowdNetwork();
    const { said } = listen(app);
    app.enterNetworkEditMode();
    app.networkEditService.exit();
    app.areaDrawingService.startDrawing(app.waypoints[0]);
    expect(byId('area-draw-banner').querySelector('kbd').textContent).toBe('Esc');
    app.areaDrawingService.cancelDrawing();
    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(byId('branch-banner').querySelector('kbd').textContent).toBe('Esc');
    await turn();
    expect(said()).toEqual(expect.arrayContaining([NETWORK_ENTRY, AREA_ENTRY, BRANCH_ARM]));
    for (const line of [NETWORK_ENTRY, AREA_ENTRY, BRANCH_ARM]) expect(line).not.toMatch(/\bEsc\b/);
  });
});

describe('round 2, advisory 8', () => {
  test('a branch placed from a fork the model has replaced by an object of the same id is refused, as the cancel\'s test refuses it', async () => {
    const app = await routeOfTwo();
    const fork = app.waypoints[0];
    app.eventBus.emit('route:branch-arm', { waypoint: fork });
    const { toasts } = listen(app);
    // The fork's id now names another object (a restore the gesture did not follow).
    const stand = Object.assign(Object.create(Object.getPrototypeOf(fork)), fork);
    app.waypointsById.set(fork.id, stand);
    app.eventBus.emit('route:branch-place', { imgX: 0.5, imgY: 0.5 });
    expect(app.waypoints).toHaveLength(2);
    expect(toasts).toEqual(['That waypoint is no longer on the route']);
  });

  test('the wait for no dialog open wakes as a trapped dialog closes; it waits only on trapped ones, every dialog of the app opening through a trap (a pin of its contract)', async () => {
    document.body.innerHTML = '<div id="trapped" role="dialog" aria-modal="true"><button>In</button></div>'
      + '<div id="untrapped" role="dialog" aria-modal="true" style="display:none"><button>In</button></div>';
    const trapped = byId('trapped');
    const trap = createFocusTrap(trapped);
    trap.activate();
    const woke = vi.fn();
    whenNoModalOpen(woke);
    trapped.style.display = 'none';
    trap.deactivate();
    await Promise.resolve();
    expect(woke).toHaveBeenCalledTimes(1);

    // A dialog opened and closed without a trap is not watched: the waiter wakes at the next trap's close.
    const untrapped = byId('untrapped');
    untrapped.style.display = 'block';
    const late = vi.fn();
    const stop = whenNoModalOpen(late);
    untrapped.style.display = 'none';
    await Promise.resolve();
    expect(late).not.toHaveBeenCalled();
    stop();

    // Every dialog in the shipped shell is one the app opens through a trap.
    const source = ['src/app/wiringDom.js', 'src/app/helpDialog.js', 'src/app/privacy.js', 'src/app/unrestoredAutosave.js',
      'src/controllers/UIController.js'].map(file => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');
    const dialogs = [...indexHtml.matchAll(/<div id="([\w-]+)"[^>]*aria-modal="true"/g)].map(([, id]) => id);
    expect(dialogs).toHaveLength(7);
    const trappedBy = {
      'splash': /createFocusTrap\(this\.elements\.splash\)/,
      'help-modal': /getElementById\('help-modal'\)[\s\S]{0,400}createFocusTrap\(modal\)/,
      'codec-unsupported-modal': /createFocusTrap\(this\._codecModal\)/,
      'clear-confirm-modal': /createFocusTrap\(clearModal\)/,
      'discard-confirm-modal': /createFocusTrap\(discardModal\)/,
      'share-disclosure-modal': /getElementById\('share-disclosure-modal'\)[\s\S]{0,1500}createFocusTrap\(modal\)/,
      'diagnostics-modal': /getElementById\('diagnostics-modal'\)[\s\S]{0,1500}createFocusTrap\(modal\)/,
    };
    for (const id of dialogs) expect(source, id).toMatch(trappedBy[id]);
  });
});
