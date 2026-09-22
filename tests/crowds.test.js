/**
 * Crowd layers (Phase 4): the layers strip and Crowd scope selection
 * glue in src/app/crowds.js, run against the real Scene/FlowLayer/
 * Emitter models and EventBus on a stub RoutePlotter.
 *
 * DOM-side coverage uses jsdom: the strip renders into a real <ul>,
 * row buttons dispatch real clicks. The inspector card controls are
 * live-verified instead — their wiring is guarded to no-op headless.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  crowdsMixin,
  formatCrowdReleaseBias,
  formatCrowdReleaseTiming,
} from '../src/app/crowds.js';
import { Scene } from '../src/models/Scene.js';
import { EventBus } from '../src/core/EventBus.js';

function makeApp({ hasRoute = true } = {}) {
  document.body.innerHTML = `
    <ul id="layers-strip"></ul>
    <button id="add-crowd-btn" type="button"></button>
    <input id="crowd-onset-variance" type="range" min="0" max="100">
    <span id="crowd-onset-variance-value"></span>
    <input id="crowd-intensity-ramp" type="range" min="-100" max="100">
    <span id="crowd-intensity-ramp-value"></span>
    <output id="crowd-seed-value"></output>
    <p id="crowd-pattern-hint"></p>
    <button id="crowd-reroll-btn" type="button">Re-roll pattern</button>
    <output id="crowd-busyness-summary"></output>
    <svg id="crowd-busyness-graph" viewBox="0 0 300 140"></svg>
    <div id="crowd-busyness-handles"></div>
    <button id="crowd-busyness-add" type="button">Add handle</button>
    <button id="crowd-busyness-reset" type="button">Reset to even</button>
  `;
  const app = {
    eventBus: new EventBus(),
    scene: new Scene(),
    waypoints: hasRoute ? [{}, {}] : [],
    styles: { pathColor: '#D55E00' },
    selectedWaypoint: null,
    selectedCrowd: null,
    undoSaves: 0,
    autoSaves: 0,
    renders: 0,
    announced: [],
    events: [],
    saveUndoState() { this.undoSaves++; },
    saveUndoStateDebounced() { this.undoSaves++; },
    autoSave() { this.autoSaves++; },
    queueRender() { this.renders++; },
    announce(msg) { this.announced.push(msg); },
  };
  Object.assign(app, crowdsMixin);
  app.eventBus.on('crowd:selected', l => app.events.push(['selected', l.id]));
  app.eventBus.on('crowd:deselected', () => app.events.push(['deselected']));
  app.eventBus.on('network:guide-changed', l => app.events.push(['network-guide', l.id]));
  app.eventBus.on('ui:toast', t => app.events.push(['toast', t.message]));
  app.setupCrowdControls();
  app.updateLayersStrip();
  return app;
}

describe('addCrowd', () => {
  test('creates a route-guided layer with one dot stream and selects it', () => {
    const app = makeApp();
    const semantic = [];
    app.eventBus.on('scene:semantic-changed', event => semantic.push(event));
    app.addCrowd();

    const layers = app.scene.getFlowLayers();
    expect(layers).toHaveLength(1);
    expect(layers[0].guideType).toBe('route');
    expect(layers[0].emitters).toHaveLength(1);
    expect(layers[0].emitters[0].dotColor).toBe('#56B4E9');
    expect(app.selectedCrowd).toBe(layers[0]);
    expect(app.events).toContainEqual(['selected', layers[0].id]);
    expect(app.undoSaves).toBe(1);
    expect(app.autoSaves).toBe(1);
    expect(semantic).toEqual([{ kind: 'crowd-added', layerId: layers[0].id }]);
  });

  test('names crowds Crowd 1, Crowd 2, … skipping taken names', () => {
    const app = makeApp();
    app.addCrowd();
    app.addCrowd();
    expect(app.scene.getFlowLayers().map(l => l.name)).toEqual(['Crowd 1', 'Crowd 2']);

    // Deleting Crowd 1 frees its name for the next add
    app.deleteCrowd(app.scene.getFlowLayers()[0]);
    app.addCrowd();
    expect(app.scene.getFlowLayers().map(l => l.name)).toEqual(['Crowd 2', 'Crowd 1']);
  });

  test('without a route creates a graph crowd, then hands it to network editing', () => {
    const app = makeApp({ hasRoute: false });
    app.addCrowd();

    const layer = app.scene.getFlowLayers()[0];
    expect(layer.guideType).toBe('graph');
    expect(layer.emitters).toHaveLength(1);
    expect(app.selectedCrowd).toBe(layer);
    expect(app.events).toEqual([
      ['selected', layer.id],
      ['network-guide', layer.id],
    ]);
    expect(app.undoSaves).toBe(1);
    expect(app.autoSaves).toBe(1);
    expect(app.announced[0]).toMatch(/draw the network/);
  });
});

describe('layers strip', () => {
  test('renders the Route row plus one row per crowd', () => {
    const app = makeApp();
    app.addCrowd();
    app.addCrowd();

    const rows = document.querySelectorAll('#layers-strip .layer-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Route');
    expect(rows[1].textContent).toContain('Crowd 1');
    expect(rows[2].textContent).toContain('Crowd 2');
    expect(document.getElementById('layers-strip').getAttribute('role')).toBeNull();
    expect(rows[0].getAttribute('aria-pressed')).toBe('false');
    expect(rows[2].getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.layer-swatch').style.backgroundImage).toBe('');
  });

  test('imported colour strings cannot become CSS image requests', () => {
    const app = makeApp();
    app.styles.pathColor = 'url(https://example.invalid/route)';
    app.addCrowd();
    app.scene.getFlowLayers()[0].emitters[0].dotColor =
      'url(https://example.invalid/crowd)';
    app.updateLayersStrip();

    for (const swatch of document.querySelectorAll('.layer-swatch')) {
      expect(swatch.style.backgroundImage).toBe('');
    }
  });

  test('selection: crowd row selects the crowd, Route row backs out', () => {
    const app = makeApp();
    app.addCrowd();
    const layer = app.scene.getFlowLayers()[0];

    // Route row is unselected while the crowd is selected
    let items = document.querySelectorAll('#layers-strip .layer-item');
    expect(items[0].classList.contains('selected')).toBe(false);
    expect(items[1].classList.contains('selected')).toBe(true);

    // Clicking Route deselects the crowd
    document.querySelectorAll('#layers-strip .layer-row')[0].click();
    expect(app.selectedCrowd).toBeNull();
    expect(app.events).toContainEqual(['deselected']);
    items = document.querySelectorAll('#layers-strip .layer-item');
    expect(items[0].classList.contains('selected')).toBe(true);

    // Clicking the crowd row selects it again
    document.querySelectorAll('#layers-strip .layer-row')[1].click();
    expect(app.selectedCrowd).toBe(layer);
  });

  test('visibility eye toggles layer.visible with an undo snapshot', () => {
    const app = makeApp();
    app.addCrowd();
    const layer = app.scene.getFlowLayers()[0];
    const savesBefore = app.undoSaves;
    const semantic = [];
    app.eventBus.on('scene:semantic-changed', event => semantic.push(event));

    document.querySelector('#layers-strip .layer-visibility').click();
    expect(layer.visible).toBe(false);
    expect(app.undoSaves).toBe(savesBefore + 1);
    expect(
      document.querySelectorAll('#layers-strip .layer-item')[1].classList.contains('layer-hidden')
    ).toBe(true);
    expect(semantic).toEqual([{ kind: 'crowd-visibility', layerId: layer.id }]);

    document.querySelector('#layers-strip .layer-visibility').click();
    expect(layer.visible).toBe(true);
    expect(semantic).toHaveLength(2);
  });

  test('renaming an unselected crowd publishes a semantic refresh event', () => {
    const app = makeApp();
    app.addCrowd();
    app.addCrowd();
    const layer = app.scene.getFlowLayers()[0];
    const semantic = [];
    app.eventBus.on('scene:semantic-changed', event => semantic.push(event));
    const title = [...document.querySelectorAll('.layer-title')]
      .find(element => element.textContent === layer.name);

    app._startCrowdRename(layer, title);
    const input = document.querySelector('.layer-rename-input');
    input.value = 'Arrivals';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(layer.name).toBe('Arrivals');
    expect(app.selectedCrowd).not.toBe(layer);
    expect(semantic).toEqual([{ kind: 'crowd-name', layerId: layer.id }]);
  });

  test('the Add crowd button remains available and describes the guide it will create', () => {
    const app = makeApp({ hasRoute: false });
    const button = document.getElementById('add-crowd-btn');
    expect(button.disabled).toBe(false);
    expect(button.title).toMatch(/draw the network/);

    app.waypoints = [{}, {}];
    app.eventBus.emit('waypoint:list-updated', app.waypoints);
    expect(button.disabled).toBe(false);
    expect(button.title).toMatch(/follows the route/);
  });
});

describe('crowd copy', () => {
  test('lifecycle controls are neutral to route and network guides', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('At journey end');
    expect(html).toContain('Respawn at entry');
    expect(html).toContain('Repeat journey');
    expect(html).toContain('Collect at exit');
    expect(html).not.toContain('At route end');
  });
});

describe('seeded variation controls', () => {
  test('formats release variation in plain directional language', () => {
    expect(formatCrowdReleaseTiming(0)).toBe('Even');
    expect(formatCrowdReleaseTiming(100)).toBe('100% uneven');
    expect(formatCrowdReleaseBias(-65)).toBe('Earlier 65%');
    expect(formatCrowdReleaseBias(0)).toBe('Even');
    expect(formatCrowdReleaseBias(40)).toBe('Later 40%');
  });

  test('writes zero/max release controls through the established crowd transaction', () => {
    const app = makeApp();
    app.addCrowd();
    const emitter = app.selectedCrowd.emitters[0];
    const onset = document.getElementById('crowd-onset-variance');
    const ramp = document.getElementById('crowd-intensity-ramp');

    onset.value = '100';
    onset.dispatchEvent(new Event('input', { bubbles: true }));
    ramp.value = '-100';
    ramp.dispatchEvent(new Event('input', { bubbles: true }));

    expect(emitter.onsetVariance).toBe(1);
    expect(emitter.intensityRamp).toBe(-1);
    expect(onset.getAttribute('aria-valuetext')).toBe('100% uneven');
    expect(ramp.getAttribute('aria-valuetext')).toBe('Earlier 100%');

    onset.value = '0';
    onset.dispatchEvent(new Event('input', { bubbles: true }));
    ramp.value = '100';
    ramp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(emitter.onsetVariance).toBe(0);
    expect(emitter.intensityRamp).toBe(1);
    expect(ramp.getAttribute('aria-valuetext')).toBe('Later 100%');
  });

  test('Re-roll changes only the seed through one immediate undoable transaction', () => {
    const app = makeApp();
    app.addCrowd();
    const layer = app.selectedCrowd;
    const emitter = layer.emitters[0];
    emitter.update({ seed: 123, speedVariance: 0.7, onsetVariance: 0.8, wobble: 0.6 });
    app.syncCrowdEditor();
    const before = emitter.toJSON();
    const savesBefore = app.undoSaves;
    const semantic = [];
    app.eventBus.on('scene:semantic-changed', event => semantic.push(event));
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      document.getElementById('crowd-reroll-btn').click();
    } finally {
      random.mockRestore();
    }

    expect(emitter.seed).toBe(2147483647);
    expect({ ...emitter.toJSON(), seed: before.seed }).toEqual(before);
    expect(document.getElementById('crowd-seed-value').textContent).toBe('2147483647');
    expect(app.undoSaves).toBe(savesBefore + 1);
    expect(app.announced.at(-1)).toMatch(/pattern re-rolled.*Undo is available/);
    expect(semantic).toEqual([{
      kind: 'crowd-pattern-seed', layerId: layer.id, emitterId: emitter.id,
    }]);
  });

  test('custom-network guidance separates junction shares from seeded assignments', () => {
    const app = makeApp({ hasRoute: false });
    app.addCrowd({ enterNetworkEditor: false });
    expect(document.getElementById('crowd-pattern-hint').textContent)
      .toMatch(/Junction shares set route proportions.*which dots take them/);
  });
});

describe('busyness envelope controls', () => {
  test('adds, edits and removes handles through one transaction per action', () => {
    const app = makeApp();
    app.addCrowd();
    const emitter = app.selectedCrowd.emitters[0];
    const savesBefore = app.undoSaves;

    document.getElementById('crowd-busyness-add').click();
    expect(emitter.busynessEnvelope).toHaveLength(3);
    expect(emitter.busynessEnvelope[1].time).toBe(0.5);
    expect(app.undoSaves).toBe(savesBefore + 1);
    expect(document.querySelectorAll('.crowd-busyness-handle-row')).toHaveLength(3);

    const middleBusy = document.querySelector('[data-busyness-index="1"][data-busyness-field="value"]');
    middleBusy.value = '20';
    middleBusy.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    }));
    expect(emitter.busynessEnvelope[1].value).toBe(0.2);
    expect(app.undoSaves).toBe(savesBefore + 2);

    const firstTransition = document.querySelector('[data-busyness-index="0"][data-busyness-field="transition"]');
    firstTransition.value = 'step';
    firstTransition.dispatchEvent(new Event('change', { bubbles: true }));
    expect(emitter.busynessEnvelope[0].transition).toBe('step');

    document.querySelector('[data-busyness-field="remove"]').click();
    expect(emitter.busynessEnvelope).toHaveLength(2);
    expect(app.announced.at(-1)).toMatch(/Undo is available/);
  });

  test('exact controls have endpoint locking and prevent an all-quiet envelope', () => {
    const app = makeApp();
    app.addCrowd();
    const emitter = app.selectedCrowd.emitters[0];
    const times = document.querySelectorAll('[data-busyness-field="time"]');
    expect(times[0].readOnly).toBe(true);
    expect(times[1].readOnly).toBe(true);

    const values = document.querySelectorAll('[data-busyness-field="value"]');
    values[0].value = '0';
    values[0].dispatchEvent(new Event('change', { bubbles: true }));
    const refreshedLast = document.querySelectorAll('[data-busyness-field="value"]')[1];
    refreshedLast.value = '0';
    refreshedLast.dispatchEvent(new Event('change', { bubbles: true }));

    expect(emitter.busynessEnvelope[1].value).toBe(1);
    expect(app.announced.at(-1)).toMatch(/at least one busyness span/);
  });

  test('reset restores the neutral profile and graph summary', () => {
    const app = makeApp();
    app.addCrowd();
    document.getElementById('crowd-busyness-add').click();
    document.getElementById('crowd-busyness-reset').click();
    expect(app.selectedCrowd.emitters[0].busynessEnvelope).toEqual([
      { time: 0, value: 1, transition: 'gradual' },
      { time: 1, value: 1, transition: 'gradual' },
    ]);
    expect(document.getElementById('crowd-busyness-summary').textContent).toBe('Even');
    expect(document.getElementById('crowd-busyness-reset').disabled).toBe(true);
  });

  test('pointer dragging moves a handle and commits one undo state on release', () => {
    const app = makeApp();
    app.addCrowd();
    const emitter = app.selectedCrowd.emitters[0];
    const graph = document.getElementById('crowd-busyness-graph');
    graph.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 140 });
    const target = graph.querySelector('[data-busyness-handle="0"]');
    const savesBefore = app.undoSaves;
    const base = { pointerId: 7, currentTarget: graph, preventDefault() {} };

    app._startCrowdBusynessDrag({ ...base, target });
    app._moveCrowdBusynessDrag({ ...base, clientX: 18, clientY: 70 });
    expect(emitter.busynessEnvelope[0].value).toBeCloseTo(0.5, 2);
    expect(app.undoSaves).toBe(savesBefore);
    app._finishCrowdBusynessDrag(base, true);

    expect(app.undoSaves).toBe(savesBefore + 1);
    expect(app.autoSaves).toBeGreaterThan(1);
    expect(app.announced.at(-1)).toMatch(/handle moved.*Undo is available/);
  });
});

describe('deleteCrowd', () => {
  test('removes the layer, deselects it, and offers undo via toast', () => {
    const app = makeApp();
    app.addCrowd();
    const layer = app.scene.getFlowLayers()[0];
    const semantic = [];
    app.eventBus.on('scene:semantic-changed', event => semantic.push(event));

    app.deleteCrowd(layer);
    expect(app.scene.isEmpty()).toBe(true);
    expect(app.selectedCrowd).toBeNull();
    expect(app.events).toContainEqual(['deselected']);
    expect(semantic).toEqual([{ kind: 'crowd-deleted', layerId: layer.id }]);
    const toast = app.events.find(e => e[0] === 'toast');
    expect(toast[1]).toMatch(/Deleted Crowd 1 — press (Cmd|Ctrl)\+Z to undo/);
  });
});

describe('scope exclusivity', () => {
  test('selecting a waypoint leaves Crowd scope', () => {
    const app = makeApp();
    app.addCrowd();
    expect(app.selectedCrowd).not.toBeNull();

    app.eventBus.emit('waypoint:selected', app.waypoints[0]);
    expect(app.selectedCrowd).toBeNull();
    expect(app.events).toContainEqual(['deselected']);
  });

  test('selecting a crowd deselects the waypoint through the ordinary event', () => {
    const app = makeApp();
    app.selectedWaypoint = app.waypoints[0];
    let deselected = false;
    app.eventBus.on('waypoint:deselected', () => { deselected = true; });

    app.addCrowd();
    expect(deselected).toBe(true);
  });

  test('Escape (waypoint:deselect) backs out of Crowd scope', () => {
    const app = makeApp();
    app.addCrowd();
    app.eventBus.emit('waypoint:deselect');
    expect(app.selectedCrowd).toBeNull();
  });
});

describe('resolveCrowdSelectionAfterRestore', () => {
  test('re-resolves the selected crowd by id across a scene rebuild', () => {
    const app = makeApp();
    app.addCrowd();
    const before = app.scene.getFlowLayers()[0];

    // Simulate an undo restore: same data, new object identities
    app.scene.fromJSON(JSON.parse(JSON.stringify(app.scene.toJSON())));
    expect(app.scene.getFlowLayers()[0]).not.toBe(before);

    app.resolveCrowdSelectionAfterRestore();
    expect(app.selectedCrowd).toBe(app.scene.getFlowLayers()[0]);
    expect(app.selectedCrowd.id).toBe(before.id);
  });

  test('deselects when the restored scene no longer has the layer', () => {
    const app = makeApp();
    app.addCrowd();
    app.scene.fromJSON({ flowLayers: [] });

    app.resolveCrowdSelectionAfterRestore();
    expect(app.selectedCrowd).toBeNull();
    expect(app.events).toContainEqual(['deselected']);
  });
});

describe('rename', () => {
  test('inline rename commits on Enter and is undoable', () => {
    const app = makeApp();
    app.addCrowd();
    const layer = app.scene.getFlowLayers()[0];
    const savesBefore = app.undoSaves;

    const title = document.querySelectorAll('#layers-strip .layer-title')[1];
    title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    const input = document.querySelector('.layer-rename-input');
    expect(input).not.toBeNull();
    input.value = 'Students';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(layer.name).toBe('Students');
    expect(app.undoSaves).toBe(savesBefore + 1);
    const titles = [...document.querySelectorAll('#layers-strip .layer-title')].map(t => t.textContent);
    expect(titles).toContain('Students');

    // The selection is re-announced so the scope chip shows the new name
    const selections = app.events.filter(e => e[0] === 'selected' && e[1] === layer.id);
    expect(selections.length).toBeGreaterThanOrEqual(2);
  });

  test('Escape cancels the rename', () => {
    const app = makeApp();
    app.addCrowd();
    const layer = app.scene.getFlowLayers()[0];

    const title = document.querySelectorAll('#layers-strip .layer-title')[1];
    title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = document.querySelector('.layer-rename-input');
    input.value = 'Nope';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(layer.name).toBe('Crowd 1');
  });
});
