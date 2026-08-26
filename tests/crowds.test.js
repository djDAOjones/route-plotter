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
import { describe, test, expect, beforeEach } from 'vitest';
import { crowdsMixin } from '../src/app/crowds.js';
import { Scene } from '../src/models/Scene.js';
import { EventBus } from '../src/core/EventBus.js';

function makeApp({ hasRoute = true } = {}) {
  document.body.innerHTML = `
    <ul id="layers-strip"></ul>
    <button id="add-crowd-btn" type="button"></button>
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
