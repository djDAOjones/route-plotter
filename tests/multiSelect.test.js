/**
 * Multi-select everywhere (Phase 4): selection is a set with a primary,
 * every card writes to the whole selection, and the old hidden
 * "Select All Waypoints" bulk mode is gone.
 *
 * Coverage mirrors the crowds.test.js harness style:
 * - selectionTargets() (editorPanel mixin) as the single write-target rule
 * - the selection event pipeline in wiringControllers on a stub app
 *   (select-all incl. minors, canvas toggle-select, bulk delete as one
 *   gesture, group nudge)
 * - undo snapshot/restore round-trip of the multi-selection by id
 * - the real UIController headless: list gestures, scope chip counts,
 *   and the absence of the old "Select All Waypoints" row
 *
 * Card control DOM wiring itself is live-verified (same rule as the
 * crowd cards — the handlers no-op headless without their elements).
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { UndoService } from '../src/services/UndoService.js';
import { editorPanelMixin } from '../src/app/editorPanel.js';
import { wiringControllersMixin } from '../src/app/wiringControllers.js';
import { undoRedoMixin } from '../src/app/undoRedo.js';
import { UIController } from '../src/controllers/UIController.js';
import { attachSwatchPickers } from '../src/components/SwatchPicker.js';

// ── Stub waypoints ──────────────────────────────────────────────────

function makeWaypoint(overrides = {}) {
  const wp = Waypoint.createMajor(0.5, 0.5);
  return Object.assign(wp, overrides);
}

// ── Harness: stub app carrying the selection pipeline ───────────────

function makeApp({ waypoints = [] } = {}) {
  document.body.innerHTML = '';
  const app = {
    eventBus: new EventBus(),
    waypoints,
    waypointsById: new Map(waypoints.map(wp => [wp.id, wp])),
    selectedWaypoint: null,
    selectedWaypoints: [],
    elements: {},
    exportSettings: { backgroundZoom: 100 },
    displayWidth: 1000,
    displayHeight: 800,
    background: { image: null },
    backgroundImage: null,
    counts: { undo: 0, undoDebounced: 0, calc: 0, renders: 0, autosaves: 0 },
    announced: [],
    events: [],
    // Identity-ish transforms: image coords 0-1 map to a 1000x800 canvas
    imageToCanvas(x, y) { return { x: x * 1000, y: y * 800 }; },
    canvasToImage(x, y) { return { x: x / 1000, y: y / 800 }; },
    saveUndoState() { this.counts.undo++; },
    saveUndoStateDebounced() { this.counts.undoDebounced++; },
    calculatePath() { this.counts.calc++; },
    generatePathData() {},
    render() { this.counts.renders++; },
    queueRender() { this.counts.renders++; },
    autoSave() { this.counts.autosaves++; },
    announce(msg) { this.announced.push(msg); },
    updateWaypointList() {},
    updateWaypointEditor() {},
    updateAnimationDuration() {},
    updateLayersStrip() {},
    syncCrowdEditor() {},
    _updateCameraControlsVisibility() {},
    _removeWaypointFromMap(wp) { this.waypointsById.delete(wp.id); },
    _addWaypointToMap(wp) { this.waypointsById.set(wp.id, wp); },
    deleteWaypoint(wp) {
      const index = this.waypoints.indexOf(wp);
      if (index > -1) {
        this.waypoints.splice(index, 1);
        this._removeWaypointFromMap(wp);
        this.selectedWaypoints = this.selectedWaypoints.filter(w => w !== wp);
        if (this.selectedWaypoint === wp) this.selectedWaypoint = null;
        this.eventBus.emit('waypoint:deleted', index);
      }
    },
    uiController: {
      selections: [],
      setSelection(waypoints, primary) { this.selections.push({ waypoints: [...waypoints], primary }); },
      updateWaypointEditor() {},
      updateWaypointList() {},
      announce() {}
    },
    interactionHandler: {
      selected: [],
      setSelectedWaypoint(wp) { this.selected.push(wp); }
    }
  };
  // Mixin methods first, stubs (above) win where names collide —
  // selectionTargets comes from the real editorPanel mixin
  app.selectionTargets = editorPanelMixin.selectionTargets;
  Object.assign(app, wiringControllersMixin);
  app.setupControllerEventConnections();
  app.eventBus.on('waypoint:selected', wp => app.events.push(['selected', wp]));
  app.eventBus.on('waypoint:multi-selected', d => app.events.push(['multi', d]));
  app.eventBus.on('waypoint:deselected', () => app.events.push(['deselected']));
  app.eventBus.on('waypoint:deleted', i => app.events.push(['deleted', i]));
  return app;
}

// ── selectionTargets ────────────────────────────────────────────────

describe('selectionTargets', () => {
  test('empty selection yields no targets', () => {
    const app = { selectedWaypoint: null, selectedWaypoints: [], selectionTargets: editorPanelMixin.selectionTargets };
    expect(app.selectionTargets()).toEqual([]);
  });

  test('single selection falls back to the primary waypoint', () => {
    const wp = makeWaypoint();
    const app = { selectedWaypoint: wp, selectedWaypoints: [], selectionTargets: editorPanelMixin.selectionTargets };
    expect(app.selectionTargets()).toEqual([wp]);
  });

  test('multi-selection targets every selected waypoint', () => {
    const a = makeWaypoint(); const b = makeWaypoint();
    const app = { selectedWaypoint: b, selectedWaypoints: [a, b], selectionTargets: editorPanelMixin.selectionTargets };
    expect(app.selectionTargets()).toEqual([a, b]);
  });

  test('majorsOnly filters minors out (leg props keep them in)', () => {
    const major = makeWaypoint();
    const minor = Object.assign(Waypoint.createMinor(0.4, 0.4), {});
    const app = { selectedWaypoint: major, selectedWaypoints: [major, minor], selectionTargets: editorPanelMixin.selectionTargets };
    expect(app.selectionTargets(true)).toEqual([major]);
    expect(app.selectionTargets()).toEqual([major, minor]);
  });
});

describe('waypoint inspector mixed presentation', () => {
  function mountMixedHarness() {
    document.body.innerHTML = `
      <div id="waypoint-scope">
        <input id="segment-color" type="hidden" value="#d55e00">
        <div class="swatch-picker" data-target-input="#segment-color"></div>
        <select id="path-shape"><option value="line">Line</option><option value="squiggle">Squiggle</option></select>
        <input id="segment-width" type="range"><span id="segment-width-value"></span>
        <input id="dot-color" type="hidden" value="#d55e00">
        <div class="swatch-picker" data-target-input="#dot-color"></div>
        <select id="marker-style"><option value="dot">Dot</option><option value="flag">Flag</option></select>
        <input id="dot-size" type="range"><span id="dot-size-value"></span>
        <select id="editor-beacon-style"><option value="none">None</option><option value="ripple">Ripple</option></select>
        <input id="ripple-wait" type="checkbox">
        <input id="label-color" type="hidden" value="#1a1a1a">
        <div class="swatch-picker" data-target-input="#label-color" data-mode="neutral-ink" data-allow-custom="true"></div>
        <input id="label-bg-color" type="hidden" value="#ffffff">
        <div class="swatch-picker" data-target-input="#label-bg-color" data-mode="neutral-ink" data-allow-custom="true"></div>
        <input id="label-size" type="range"><span id="label-size-value"></span>
      </div>`;
    attachSwatchPickers();
    const byId = id => document.getElementById(id);
    return {
      elements: {
        segmentColor: byId('segment-color'),
        pathShape: byId('path-shape'),
        segmentWidth: byId('segment-width'),
        segmentWidthValue: byId('segment-width-value'),
        dotColor: byId('dot-color'),
        markerStyle: byId('marker-style'),
        dotSize: byId('dot-size'),
        dotSizeValue: byId('dot-size-value'),
        editorBeaconStyle: byId('editor-beacon-style'),
        rippleWait: byId('ripple-wait'),
        labelColor: byId('label-color'),
        labelBgColor: byId('label-bg-color'),
        labelSize: byId('label-size'),
        labelSizeValue: byId('label-size-value'),
      },
      styles: { dotColor: '#d55e00', dotSize: 8 },
      imageAssetService: { getAsset: vi.fn() },
      uiController: { _updateAreaSubControls: vi.fn() },
      _updateBeaconControlsVisibility: vi.fn(),
      _updateShapeParamsVisibility: vi.fn(),
    };
  }

  test('compares leg values across all targets but major-only values across majors', () => {
    const major = makeWaypoint({
      markerStyle: 'flag',
      pathShape: 'line',
      segmentWidth: 3,
      labelSize: 20,
    });
    const minor = Waypoint.createMinor(0.4, 0.4);
    minor.pathShape = 'squiggle';
    minor.segmentWidth = 9;
    const app = mountMixedHarness();
    Object.assign(app, {
      _syncMajorWaypointControls: editorPanelMixin._syncMajorWaypointControls,
      _applyWaypointMixedStates: editorPanelMixin._applyWaypointMixedStates,
    });

    app._syncMajorWaypointControls(major, [major]);
    app._applyWaypointMixedStates([major, minor], [major]);

    expect(app.elements.pathShape.value).toBe('__mixed__');
    expect(app.elements.segmentWidthValue.textContent).toBe('Mixed');
    expect(app.elements.markerStyle.value).toBe('flag');
    expect(app.elements.markerStyle.dataset.mixed).toBeUndefined();
    expect(app.elements.labelSizeValue.textContent).toBe('20 px');
  });

  test('presents select, range, checkbox and swatch disagreement without changing models', () => {
    const a = makeWaypoint({
      markerStyle: 'dot', dotColor: '#d55e00', rippleWait: true, labelSize: 18,
    });
    const b = makeWaypoint({
      markerStyle: 'flag', dotColor: '#0072b2', rippleWait: false, labelSize: 30,
    });
    const before = [a.toJSON(), b.toJSON()];
    const app = mountMixedHarness();
    Object.assign(app, {
      _syncMajorWaypointControls: editorPanelMixin._syncMajorWaypointControls,
      _applyWaypointMixedStates: editorPanelMixin._applyWaypointMixedStates,
    });

    app._syncMajorWaypointControls(a, [a, b]);
    app._applyWaypointMixedStates([a, b], [a, b]);

    expect(app.elements.markerStyle.value).toBe('__mixed__');
    expect(app.elements.labelSizeValue.textContent).toBe('Mixed');
    expect(app.elements.labelSize.getAttribute('aria-valuetext')).toBe('Mixed');
    expect(app.elements.rippleWait.indeterminate).toBe(true);
    expect(document.querySelector('[data-target-input="#dot-color"] .swatch-mixed-state').hidden).toBe(false);
    expect([a.toJSON(), b.toJSON()]).toEqual(before);
  });
});

// ── Cmd/Ctrl+A: select-all includes minors ──────────────────────────

describe('waypoint:select-all', () => {
  test('selects the whole route as an ordinary multi-select, minors included', () => {
    const a = makeWaypoint({ name: 'A' });
    const m = Waypoint.createMinor(0.3, 0.3);
    const b = makeWaypoint({ name: 'B' });
    const app = makeApp({ waypoints: [a, m, b] });

    app.eventBus.emit('waypoint:select-all');

    expect(app.selectedWaypoints).toEqual([a, m, b]);
    expect(app.selectedWaypoint).toBe(a); // No prior primary → first waypoint
    expect(app.announced).toContain('All waypoints selected');
  });

  test('keeps the current primary when it is part of the route', () => {
    const a = makeWaypoint(); const b = makeWaypoint();
    const app = makeApp({ waypoints: [a, b] });
    app.eventBus.emit('waypoint:selected', b);

    app.eventBus.emit('waypoint:select-all');

    expect(app.selectedWaypoints).toEqual([a, b]);
    expect(app.selectedWaypoint).toBe(b);
  });

  test('single-waypoint route selects it singly; empty route is a no-op', () => {
    const only = makeWaypoint();
    const app = makeApp({ waypoints: [only] });
    app.eventBus.emit('waypoint:select-all');
    expect(app.selectedWaypoint).toBe(only);
    expect(app.selectedWaypoints).toEqual([only]);

    const empty = makeApp({ waypoints: [] });
    empty.eventBus.emit('waypoint:select-all');
    expect(empty.selectedWaypoint).toBe(null);
    expect(empty.events).toEqual([]);
  });
});

// ── Canvas Cmd/Ctrl+click: toggle-select ────────────────────────────

describe('waypoint:toggle-select', () => {
  let a, b, c, app;
  beforeEach(() => {
    a = makeWaypoint({ name: 'A' });
    b = makeWaypoint({ name: 'B' });
    c = makeWaypoint({ name: 'C' });
    app = makeApp({ waypoints: [a, b, c] });
  });

  test('grows a single selection into a multi-selection', () => {
    app.eventBus.emit('waypoint:selected', a);
    app.eventBus.emit('waypoint:toggle-select', c);

    expect(app.selectedWaypoints).toEqual([a, c]);
    expect(app.selectedWaypoint).toBe(c); // Toggled-in waypoint becomes primary
  });

  test('selection is normalised to route order regardless of click order', () => {
    app.eventBus.emit('waypoint:selected', c);
    app.eventBus.emit('waypoint:toggle-select', a);

    expect(app.selectedWaypoints).toEqual([a, c]); // Route order, not click order
    expect(app.selectedWaypoint).toBe(a);
  });

  test('toggling a selected member out collapses back through single to none', () => {
    app.eventBus.emit('waypoint:selected', a);
    app.eventBus.emit('waypoint:toggle-select', b);
    app.eventBus.emit('waypoint:toggle-select', a);

    expect(app.selectedWaypoints).toEqual([b]);
    expect(app.selectedWaypoint).toBe(b);

    app.eventBus.emit('waypoint:toggle-select', b);
    expect(app.selectedWaypoints).toEqual([]);
    expect(app.selectedWaypoint).toBe(null);
  });

  test('removing the primary promotes another member', () => {
    app.eventBus.emit('waypoint:selected', a);
    app.eventBus.emit('waypoint:toggle-select', b);
    app.eventBus.emit('waypoint:toggle-select', c); // Selection [a,b,c], primary c
    app.eventBus.emit('waypoint:toggle-select', c); // Remove the primary

    expect(app.selectedWaypoints).toEqual([a, b]);
    expect(app.selectedWaypoint).toBe(b);
  });

  test('starting from nothing selects singly', () => {
    app.eventBus.emit('waypoint:toggle-select', b);
    expect(app.selectedWaypoint).toBe(b);
    expect(app.selectedWaypoints).toEqual([b]);
  });
});

// ── Delete key: the whole selection goes as one gesture ─────────────

describe('waypoint:delete-selected with a multi-selection', () => {
  test('removes every selected waypoint with one deleted emit (one undo entry)', () => {
    const a = makeWaypoint(); const b = makeWaypoint(); const c = makeWaypoint();
    const app = makeApp({ waypoints: [a, b, c] });
    app.eventBus.emit('waypoint:selected', a);
    app.eventBus.emit('waypoint:toggle-select', b);

    app.eventBus.emit('waypoint:delete-selected');

    expect(app.waypoints).toEqual([c]);
    expect(app.waypointsById.has(a.id)).toBe(false);
    expect(app.waypointsById.has(b.id)).toBe(false);
    expect(app.selectedWaypoint).toBe(null);
    expect(app.selectedWaypoints).toEqual([]);
    // One deleted emit = one saveUndoState in the real pipeline
    expect(app.events.filter(e => e[0] === 'deleted')).toHaveLength(1);
    expect(app.announced).toContain('2 waypoints deleted');
  });

  test('single selection still deletes through the per-waypoint path', () => {
    const a = makeWaypoint(); const b = makeWaypoint();
    const app = makeApp({ waypoints: [a, b] });
    app.eventBus.emit('waypoint:selected', a);

    app.eventBus.emit('waypoint:delete-selected');

    expect(app.waypoints).toEqual([b]);
    expect(app.events.filter(e => e[0] === 'deleted')).toHaveLength(1);
  });
});

// ── Arrow-key nudge moves the whole selection ───────────────────────

describe('waypoint:nudge with a multi-selection', () => {
  test('moves every selected waypoint by the same delta, one recalc', () => {
    const a = makeWaypoint({ imgX: 0.2, imgY: 0.2 });
    const b = makeWaypoint({ imgX: 0.6, imgY: 0.6 });
    const c = makeWaypoint({ imgX: 0.9, imgY: 0.9 });
    const app = makeApp({ waypoints: [a, b, c] });
    app.eventBus.emit('waypoint:selected', a);
    app.eventBus.emit('waypoint:toggle-select', b);
    app.counts.calc = 0;

    app.eventBus.emit('waypoint:nudge', { waypoint: a, dxFraction: 0.01, dyFraction: 0 });

    expect(a.imgX).toBeCloseTo(0.21, 10);
    expect(b.imgX).toBeCloseTo(0.61, 10);
    expect(c.imgX).toBeCloseTo(0.9, 10); // Unselected waypoint stays put
    expect(a.imgY).toBeCloseTo(0.2, 10);
    expect(app.counts.calc).toBe(1);
    expect(app.counts.undoDebounced).toBe(1);
  });

  test('nudging an unselected waypoint moves only that waypoint', () => {
    const a = makeWaypoint({ imgX: 0.2 }); const b = makeWaypoint({ imgX: 0.6 });
    const app = makeApp({ waypoints: [a, b] });
    app.eventBus.emit('waypoint:selected', a);

    app.eventBus.emit('waypoint:nudge', { waypoint: b, dxFraction: 0.01, dyFraction: 0 });

    expect(b.imgX).toBeCloseTo(0.61, 10);
    expect(a.imgX).toBeCloseTo(0.2, 10);
  });

  test('a burst of nudges becomes one undo step for the whole selection', () => {
    vi.useFakeTimers();
    try {
      const a = makeWaypoint({ imgX: 0.2, imgY: 0.2 });
      const b = makeWaypoint({ imgX: 0.6, imgY: 0.6 });
      const app = makeApp({ waypoints: [a, b] });
      app.scene = { toJSON: () => ({}) };
      app.styles = {};
      app.undoService = new UndoService(app.eventBus);
      app._undoDebounceTimer = null;
      app._getUndoableState = undoRedoMixin._getUndoableState;
      app.saveUndoState = undoRedoMixin.saveUndoState;
      app.saveUndoStateDebounced = undoRedoMixin.saveUndoStateDebounced;

      app.eventBus.emit('waypoint:selected', a);
      app.eventBus.emit('waypoint:toggle-select', b);
      app.saveUndoState();

      for (let i = 0; i < 3; i++) {
        app.eventBus.emit('waypoint:nudge', {
          waypoint: a,
          dxFraction: 0.01,
          dyFraction: 0,
        });
      }

      expect(app.undoService.canUndo()).toBe(false);
      vi.advanceTimersByTime(399);
      expect(app.undoService.canUndo()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(app.undoService.canUndo()).toBe(true);

      const beforeBurst = app.undoService.undo();
      expect(beforeBurst.waypoints[0].imgX).toBeCloseTo(0.2, 10);
      expect(beforeBurst.waypoints[1].imgX).toBeCloseTo(0.6, 10);
      expect(app.undoService.canUndo()).toBe(false);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

// ── Undo: the multi-selection survives snapshot → restore ───────────

describe('undo snapshot and restore of the multi-selection', () => {
  function makeUndoApp(waypoints) {
    const app = {
      eventBus: new EventBus(),
      waypoints,
      waypointsById: new Map(waypoints.map(wp => [wp.id, wp])),
      selectedWaypoint: null,
      selectedWaypoints: [],
      styles: {},
      scene: { toJSON: () => ({}), fromJSON: () => {} },
      pathPoints: [],
      _majorWaypointsCache: null,
      calculatePath() {},
      updateWaypointList() {},
      updateWaypointEditor() {},
      render() {},
      autoSave() {},
      resolveCrowdSelectionAfterRestore() {},
      resolveNetworkAfterRestore() {},
      _syncSceneOutlineSelectionAfterRestore: vi.fn(),
      _syncGlobalStyleUI() {},
      _addWaypointToMap(wp) { this.waypointsById.set(wp.id, wp); },
      uiController: {
        selections: [],
        editors: [],
        setSelection(wps, primary) { this.selections.push({ wps: [...wps], primary }); },
        updateWaypointEditor(primary, multi) { this.editors.push({ primary, multi }); }
      },
      interactionHandler: { setSelectedWaypoint() {} }
    };
    Object.assign(app, undoRedoMixin);
    // The mixin carries the real _syncGlobalStyleUI — re-stub it (no
    // global-style elements in this harness)
    app._syncGlobalStyleUI = () => {};
    return app;
  }

  test('selectedWaypointIds round-trip to the rebuilt objects by id', () => {
    const a = makeWaypoint(); const b = makeWaypoint(); const c = makeWaypoint();
    const app = makeUndoApp([a, b, c]);
    app.selectedWaypoint = b;
    app.selectedWaypoints = [a, b];
    app.selectedCrowd = { id: 'crowd-stale' };

    const state = app._getUndoableState();
    expect(state.selectedWaypointIds).toEqual([a.id, b.id]);
    expect(state.selectedWaypointId).toBe(b.id);

    // Restore rebuilds fresh Waypoint objects from JSON
    app._restoreState(state);

    expect(app.selectedWaypoints).toHaveLength(2);
    expect(app.selectedWaypoints.map(wp => wp.id)).toEqual([a.id, b.id]);
    expect(app.selectedWaypoints[0]).not.toBe(a); // New object, same identity
    expect(app.selectedWaypoint?.id).toBe(b.id);
    expect(app.selectedWaypoints).toContain(app.selectedWaypoint);
    expect(app.selectedCrowd).toBeNull();
    expect(app._syncSceneOutlineSelectionAfterRestore).toHaveBeenCalledOnce();
    // The UI layers were handed the re-resolved selection
    const last = app.uiController.selections.at(-1);
    expect(last.wps.map(wp => wp.id)).toEqual([a.id, b.id]);
    expect(last.primary?.id).toBe(b.id);
    const editor = app.uiController.editors.at(-1);
    expect(editor.primary).toBe(app.selectedWaypoint);
    expect(editor.multi).toEqual(app.selectedWaypoints);
  });

  test('single selection restores as a one-waypoint selection array', () => {
    const a = makeWaypoint();
    const app = makeUndoApp([a]);
    app.selectedWaypoint = a;
    app.selectedWaypoints = [a];

    const state = app._getUndoableState();
    app._restoreState(state);

    expect(app.selectedWaypoints).toHaveLength(1);
    expect(app.selectedWaypoints[0].id).toBe(a.id);
  });
});

// ── UIController headless: list gestures, chip, no bulk row ─────────

describe('UIController multi-select', () => {
  let bus, ui, listEl, a, b, c;

  function chipText() { return document.getElementById('scope-chip-text').textContent; }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="scope-chip" data-scope="route">
        <button id="scope-prev-btn"></button>
        <span id="scope-chip-text">Editing · Route</span>
        <button id="scope-route-btn" disabled>Route</button>
        <button id="scope-next-btn"></button>
      </div>
      <h2 id="leg-section-title">Leg</h2>
      <ul id="waypoint-list"></ul>
    `;
    listEl = document.getElementById('waypoint-list');
    bus = new EventBus();
    a = makeWaypoint({ name: 'Alpha', _displayIndex: 1 });
    b = makeWaypoint({ name: 'Beta', _displayIndex: 2 });
    c = makeWaypoint({ name: 'Gamma', _displayIndex: 3 });
    ui = new UIController({ waypointList: listEl }, bus);
  });

  function rowButtons() {
    // Rows for actual waypoints (the Add Waypoint row is filtered out)
    return [...listEl.querySelectorAll('.waypoint-row')]
      .filter(btn => !btn.classList.contains('waypoint-add-btn'));
  }

  test('the old "Select All Waypoints" bulk row is gone', () => {
    ui.updateWaypointList([a, b, c]);
    expect(listEl.textContent).not.toContain('Select All');
    expect(rowButtons()).toHaveLength(3);
  });

  test('plain click emits a single selection', () => {
    ui.updateWaypointList([a, b, c]);
    const selected = [];
    bus.on('waypoint:selected', wp => selected.push(wp));

    rowButtons()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selected).toEqual([a]);
  });

  test('cmd-click toggles a second waypoint into a multi-selection', () => {
    ui.updateWaypointList([a, b, c]);
    const multi = [];
    bus.on('waypoint:multi-selected', d => multi.push(d));

    rowButtons()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    rowButtons()[2].dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }));

    expect(multi).toHaveLength(1);
    expect(multi[0].waypoints).toEqual(expect.arrayContaining([a, c]));
    expect(multi[0].primary).toBe(c);
  });

  test('shift-click extends a range from the anchor', () => {
    ui.updateWaypointList([a, b, c]);
    const multi = [];
    bus.on('waypoint:multi-selected', d => multi.push(d));

    rowButtons()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    rowButtons()[2].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));

    expect(multi).toHaveLength(1);
    expect(multi[0].waypoints).toEqual(expect.arrayContaining([a, b, c]));
  });

  test('scope chip counts the selection and names invisible minors', () => {
    const minor = Waypoint.createMinor(0.3, 0.3);
    ui.setSelection([a, b], b);
    ui.updateWaypointList([a, b, c]);
    expect(chipText()).toBe('Editing · 2 waypoints');
    expect(document.getElementById('scope-chip').dataset.scope).toBe('multi');
    // Stepping is disabled in multi-select
    expect(document.getElementById('scope-prev-btn').disabled).toBe(true);
    expect(document.getElementById('scope-next-btn').disabled).toBe(true);
    expect(document.getElementById('leg-section-title').textContent).toBe('Leg');

    ui.setSelection([a, minor, b], b);
    ui.updateWaypointList([a, minor, b, c]);
    expect(chipText()).toBe('Editing · 3 waypoints (1 minor)');
  });

  test('Route button exits single and multi waypoint scope but not route or crowd scope', () => {
    ui.updateWaypointList([a, b, c]);
    const routeButton = document.getElementById('scope-route-btn');
    const deselected = [];
    bus.on('waypoint:deselected', () => deselected.push(true));

    ui.setSelection([a], a);
    ui.updateWaypointEditor(a);
    expect(routeButton.disabled).toBe(false);
    routeButton.click();

    ui.setSelection([a, b], b);
    ui.updateWaypointEditor(b, [a, b]);
    expect(routeButton.disabled).toBe(false);
    routeButton.click();
    expect(deselected).toHaveLength(2);

    ui.setSelection([], null);
    ui.updateWaypointEditor(null);
    expect(routeButton.disabled).toBe(true);
    routeButton.click();

    bus.emit('crowd:selected', { name: 'Visitors' });
    ui.updateWaypointEditor(null);
    expect(routeButton.disabled).toBe(true);
    routeButton.click();
    expect(deselected).toHaveLength(2);
  });

  test('setSelection keeps the list rows in sync with an app-decided selection', () => {
    ui.setSelection([a, c], c);
    ui.updateWaypointList([a, b, c]);

    const rows = [...listEl.querySelectorAll('.waypoint-item')]
      .filter(item => !item.querySelector('.waypoint-add-btn'));
    expect(rows[0].classList.contains('is-selected')).toBe(true);
    expect(rows[1].classList.contains('is-selected')).toBe(false);
    expect(rows[2].classList.contains('is-selected')).toBe(true);
    expect(rows[0].querySelector('.waypoint-row').getAttribute('aria-pressed')).toBe('true');
    expect(listEl.getAttribute('role')).toBeNull();
  });

  test('updateWaypointEditor in multi mode announces the count, not a waypoint', () => {
    ui.updateWaypointList([a, b, c]);
    ui.updateWaypointEditor(b, [a, b]);
    expect(chipText()).toBe('Editing · 2 waypoints');
  });
});
