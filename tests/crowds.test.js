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
import { formatCrowdDotSize } from '../src/utils/uiReadouts.js';
import { DotRenderer } from '../src/services/DotRenderer.js';
import { Scene } from '../src/models/Scene.js';
import { EventBus } from '../src/core/EventBus.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { dotsReachingJourneyEnd } from '../src/utils/crowdArrival.js';
import { ANIMATION } from '../src/config/constants.js';
import { MAX_BUSYNESS_HANDLES } from '../src/utils/busynessEnvelope.js';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';

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
    <button id="crowd-busyness-add" type="button" aria-describedby="crowd-busyness-add-reason"
            data-tip="Add a handle in the widest span">Add handle</button>
    <p id="crowd-busyness-add-reason" hidden></p>
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

  test('a hidden crowd row says so in text and keeps its title legible (UI-06 B-11)', () => {
    const app = makeApp();
    app.addCrowd();
    const style = document.createElement('style');
    style.textContent = readFileSync(resolve(process.cwd(), 'styles/main.css'), 'utf8');
    document.head.append(style);
    try {
      const row = () => document.querySelectorAll('#layers-strip .layer-item')[1];
      expect(row().querySelector('.layer-hidden-tag')).toBeNull();

      document.querySelector('#layers-strip .layer-visibility').click();
      // The state is readable without colour: a "hidden" tag beside the
      // title, inside the row button so its name carries the state too.
      const tag = row().querySelector('.layer-row .layer-hidden-tag');
      expect(tag.textContent).toBe('hidden');
      expect(row().querySelector('.layer-row').textContent).toContain('hidden');
      // The row is live (selectable, renamable), so the title is not faded
      // under 7:1; jsdom applies the sheet's `opacity`, so it is read here.
      const title = row().querySelector('.layer-title');
      expect(Number(getComputedStyle(title).opacity || 1)).toBeGreaterThanOrEqual(0.8);

      document.querySelector('#layers-strip .layer-visibility').click();
      expect(row().querySelector('.layer-hidden-tag')).toBeNull();
    } finally {
      style.remove();
    }
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
    expect(button.getAttribute('data-tip')).toMatch(/draw the network/);

    app.waypoints = [{}, {}];
    app.eventBus.emit('waypoint:list-updated', app.waypoints);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('data-tip')).toMatch(/follows the route/);
  });
});

describe('Add handle at the limit (UI-06 B-07)', () => {
  test('disabled, it says why in a line it is described by, with no title; enabled, the line is empty', () => {
    const app = makeApp({ hasRoute: false });
    app.addCrowd({ enterNetworkEditor: false });
    const add = document.getElementById('crowd-busyness-add');
    const reason = document.getElementById('crowd-busyness-add-reason');
    expect(add.disabled).toBe(false);
    expect(reason.hidden).toBe(true);
    expect(reason.textContent).toBe('');

    for (let guard = 0; guard < 20 && !add.disabled; guard += 1) add.click();
    expect(app.selectedCrowd.emitters[0].busynessEnvelope).toHaveLength(MAX_BUSYNESS_HANDLES);
    expect(add.disabled).toBe(true);
    expect(reason.hidden).toBe(false);
    expect(reason.textContent).toBe(`Maximum ${MAX_BUSYNESS_HANDLES} handles.`);
    expect(add.getAttribute('aria-describedby').split(/\s+/)).toContain('crowd-busyness-add-reason');
    expect(add.hasAttribute('title')).toBe(false);
    expect(add.getAttribute('data-tip')).toBe('Add a handle in the widest span');
  });
});

describe('crowd copy', () => {
  test('lifecycle controls are neutral to route and network guides', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('At journey end');
    expect(html).toContain('Respawn at the start');
    expect(html).toContain('Repeat journey');
    expect(html).toContain('Collect at the end');
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
      .toMatch(/Path shares set the route proportions.*which dots take each path/);
  });
});

describe('renaming a crowd from its row', () => {
  const rowOf = layer => [...document.querySelectorAll('#layers-strip .layer-row')]
    .find(row => row.textContent.includes(layer.name));
  const renaming = () => document.querySelector('#layers-strip .layer-rename-input');
  const key = name => new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });

  test('F2 on a row selects its crowd and opens its name for editing, as a waypoint row does (UI-06 J-13)', () => {
    const app = makeApp();
    app.addCrowd();
    app.addCrowd();
    const [first, second] = app.scene.getFlowLayers();
    expect(app.selectedCrowd).toBe(second);
    expect(rowOf(first).getAttribute('data-tip')).toBe('Double-click or press F2 to rename');

    // On a row that is not selected: selected, then its rebuilt row renaming.
    const event = key('F2');
    rowOf(first).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(app.selectedCrowd).toBe(first);
    expect(renaming()).not.toBeNull();
    expect(renaming().value).toBe(first.name);
    expect(renaming().closest('li')).toBe(document.querySelector('#layers-strip li:nth-child(2)'));
    expect(document.activeElement).toBe(renaming());

    // Enter keeps the name typed; the row shows it, and has the focus back (Codex round 1).
    renaming().value = 'Visitors';
    renaming().dispatchEvent(key('Enter'));
    expect(first.name).toBe('Visitors');
    expect(renaming()).toBeNull();
    expect(rowOf(first).textContent).toContain('Visitors');
    expect(document.activeElement).toBe(rowOf(first));

    // On the selected crowd's row: renaming at once, and Escape keeps the old name, focus back on the row.
    rowOf(first).dispatchEvent(key('F2'));
    expect(renaming().value).toBe('Visitors');
    renaming().value = 'Others';
    renaming().dispatchEvent(key('Escape'));
    expect(first.name).toBe('Visitors');
    expect(renaming()).toBeNull();
    expect(document.activeElement).toBe(rowOf(first));

    // A second F2 while renaming keeps the field and what was typed.
    rowOf(first).dispatchEvent(key('F2'));
    const field = renaming();
    field.value = 'Typed';
    field.dispatchEvent(key('F2'));
    expect(renaming()).toBe(field);
    expect(field.value).toBe('Typed');
    field.dispatchEvent(key('Escape'));

    // Committed by leaving the field (the user clicked elsewhere): the name is kept, focus is not moved.
    rowOf(first).dispatchEvent(key('F2'));
    renaming().value = 'Guests';
    renaming().dispatchEvent(new Event('blur'));
    expect(first.name).toBe('Guests');
    expect(renaming()).toBeNull();
    expect(document.activeElement).toBe(document.body);
    // The name typed is visible in the row that replaced the field.
    expect(rowOf(first).textContent).toContain('Guests');

    // Any other key on the row is left to the page.
    const other = key('Enter');
    rowOf(second).dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    expect(renaming()).toBeNull();
    expect(app.selectedCrowd).toBe(first);
  });

  test('renaming a crowd that is no longer in the scene opens nothing and focuses nothing (Codex round 2)', () => {
    const app = makeApp();
    app.addCrowd();
    app.addCrowd();
    const [first, second] = app.scene.getFlowLayers();
    // The row of a layer the scene no longer holds would otherwise be
    // looked up as the Route row (index −1 + 1), and its name edited.
    app.scene.removeFlowLayer(first.id);
    app.updateLayersStrip();
    expect(app._crowdRowOf(first)).toBeNull();
    expect(app._crowdRowOf(second)).not.toBeNull();
    document.activeElement?.blur?.();
    app.renameCrowd(first);
    expect(renaming()).toBeNull();
    expect(document.activeElement).toBe(document.body);
    expect(document.querySelector('#layers-strip li:first-child .layer-title').textContent).toBe('Route');
  });

  test('the Route row takes no F2: it cannot be renamed', () => {
    const app = makeApp();
    app.addCrowd();
    const route = document.querySelector('#layers-strip li:first-child .layer-row');
    const event = key('F2');
    route.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(renaming()).toBeNull();
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

  test('an edit from a handle field keeps focus on that field once the rows are rebuilt (UI-06 B-28)', () => {
    const app = makeApp();
    app.addCrowd();
    const emitter = app.selectedCrowd.emitters[0];
    document.getElementById('crowd-busyness-add').click();
    document.getElementById('crowd-busyness-add').click();
    expect(emitter.busynessEnvelope).toHaveLength(4);
    const field = (index, name) => document.querySelector(`[data-busyness-index="${index}"][data-busyness-field="${name}"]`);
    const enter = () => new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const change = () => new Event('change', { bubbles: true });

    // Enter in a Busy field: the rows are rebuilt, and focus is on the new field for the same handle.
    const busy = field(1, 'value');
    busy.focus();
    busy.value = '20';
    busy.dispatchEvent(enter());
    expect(emitter.busynessEnvelope[1].value).toBe(0.2);
    expect(busy.isConnected).toBe(false);
    expect(document.activeElement).toBe(field(1, 'value'));

    // A change committed by leaving a Time field: the same.
    const time = field(2, 'time');
    time.focus();
    time.value = '60';
    time.dispatchEvent(change());
    expect(emitter.busynessEnvelope[2].time).toBe(0.6);
    expect(document.activeElement).toBe(field(2, 'time'));

    // A transition chosen: the same select, rebuilt.
    const transition = field(0, 'transition');
    transition.focus();
    transition.value = 'step';
    transition.dispatchEvent(change());
    expect(emitter.busynessEnvelope[0].transition).toBe('step');
    expect(document.activeElement).toBe(field(0, 'transition'));

    // Remove: the handle now at that index takes the focus — its Remove, or, last, its Busy field.
    const remove = field(1, 'remove');
    remove.focus();
    remove.click();
    expect(emitter.busynessEnvelope).toHaveLength(3);
    expect(document.activeElement).toBe(field(1, 'remove'));
    field(1, 'remove').focus();
    field(1, 'remove').click();
    expect(emitter.busynessEnvelope).toHaveLength(2);
    expect(field(1, 'remove')).toBeNull();
    expect(document.activeElement).toBe(field(1, 'value'));

    // An edit refused (an all-quiet envelope: the first span is a step, so
    // the first handle alone sets it) also rebuilds the rows: focus stays on the field.
    const last = field(1, 'value');
    last.value = '0';
    last.dispatchEvent(change());
    expect(emitter.busynessEnvelope.map(handle => handle.value)).toEqual([1, 0]);
    const first = field(0, 'value');
    first.focus();
    first.value = '0';
    first.dispatchEvent(enter());
    expect(app.announced.at(-1)).toMatch(/at least one busyness span/);
    expect(emitter.busynessEnvelope[0].value).toBe(1);
    expect(first.isConnected).toBe(false);
    expect(document.activeElement).toBe(field(0, 'value'));

    // A change that arrives from elsewhere, the field unfocused, moves focus nowhere.
    document.activeElement.blur();
    expect(document.activeElement).toBe(document.body);
    const unfocused = field(0, 'value');
    unfocused.value = '50';
    unfocused.dispatchEvent(change());
    expect(emitter.busynessEnvelope[0].value).toBe(0.5);
    expect(document.activeElement).toBe(document.body);
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

describe('a new crowd reaches its journey end (DEF-77)', () => {
  // The canvas the finding was probed on: a 16:9 image filling a 16:9
  // canvas, the route head at the default 200 px a second and the default
  // 1.5 s wait at each major after the first, so the timeline, and with it
  // whether a dot finishes, depends on the canvas width.
  const calc = new PathCalculator();
  const ROUTES = {
    'two clicks': [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }],
    'four majors': [{ x: 0.1, y: 0.5 }, { x: 0.35, y: 0.4 }, { x: 0.65, y: 0.6 }, { x: 0.9, y: 0.5 }],
  };
  const timelineMs = (route, pathPoints, width) => {
    const height = width * 9 / 16;
    const onScreen = pathPoints.map(point => ({ x: point.x * width, y: point.y * height }));
    return (calc.calculatePathLength(onScreen) / ANIMATION.DEFAULT_SPEED) * 1000
      + ANIMATION.DEFAULT_WAIT_TIME * (route.length - 1);
  };

  // A new crowd's seed is random; these stand in for it, so the run is repeatable.
  const SEEDS = Array.from({ length: 40 }, (_, index) => (index * 2654435761) >>> 0);

  test.each([
    [720, 45], [960, 50], [1280, 50], [1920, 50],
  ])('a default route crowd on a %i px canvas: at least %i of its 50 dots finish', (width, atLeast) => {
    const app = makeApp();
    app.addCrowd();
    const layer = app.selectedCrowd;
    expect(layer.guideType).toBe('route');
    for (const seed of SEEDS) {
      layer.emitters[0].update({ seed });
      for (const [name, route] of Object.entries(ROUTES)) {
        const pathPoints = calc.calculatePath(route);
        const durationMs = timelineMs(route, pathPoints, width);
        const schedules = new SwarmEngine().scheduleDots(layer, { durationMs, routePathPoints: pathPoints });
        expect(schedules, name).toHaveLength(50);
        expect(dotsReachingJourneyEnd(schedules, durationMs), `${name}, seed ${seed}`).toBeGreaterThanOrEqual(atLeast);
      }
    }
  });

  test('only a new crowd takes the new pace: a saved crowd opens with its own', () => {
    const app = makeApp();
    app.addCrowd();
    const [fresh] = app.selectedCrowd.emitters;
    expect({ speed: fresh.speed, releaseDuration: fresh.releaseDuration })
      .toEqual({ speed: 0.4, releaseDuration: 0.5 });

    const saved = new Scene();
    const layer = saved.addFlowLayer({ name: 'Crowd 1', guideType: 'route' });
    layer.addEmitter({ seed: 9, speed: 0.15, releaseDuration: 1 });
    // A crowd saved without them keeps the model's historical values too.
    const bare = saved.addFlowLayer({ name: 'Crowd 2', guideType: 'route' }).toJSON();
    bare.emitters = [{ seed: 10 }];
    const json = saved.toJSON();
    json.flowLayers[1] = bare;

    const [opened, openedBare] = Scene.fromJSON(JSON.parse(JSON.stringify(json))).getFlowLayers();
    expect(opened.emitters[0].speed).toBe(0.15);
    expect(opened.emitters[0].releaseDuration).toBe(1);
    expect(openedBare.emitters[0].speed).toBe(0.15);
    expect(openedBare.emitters[0].releaseDuration).toBe(1);
  });
});

describe('the "At journey end" hint (DEF-77)', () => {
  /** The shipped editor, a two-click route and a new crowd on it. */
  async function editorWithCrowd() {
    const app = await bootApp();
    await app.ready;
    await new Promise(resolve => setTimeout(resolve, 80));
    app.eventBus.emit('waypoint:add', { imgX: 0.1, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.5, isMajor: true });
    app.addCrowd();
    return app;
  }
  const slide = (id, value) => {
    const control = document.getElementById(id);
    control.value = String(value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
  };
  /**
   * Turn the selected crowd onto a network nothing can end, drawn with the
   * pen: three pass-through nodes closed into a loop of two-way paths. Since
   * the end waits for every journey that ends (CROWD-05), this is the case
   * the hint is left for.
   */
  const closedLoop = (app) => {
    const guide = document.getElementById('crowd-guide-type');
    guide.value = 'graph';
    guide.dispatchEvent(new Event('change', { bubbles: true }));
    const pen = app.networkEditService;
    const first = pen.placeNode({ x: 0.2, y: 0.3 });
    pen.placeNode({ x: 0.8, y: 0.3 });
    pen.placeNode({ x: 0.5, y: 0.8 });
    pen.clickNode(first);
    return first;
  };

  test('describes the select, and says nothing while dots reach their journey end', async () => {
    const app = await editorWithCrowd();
    const select = document.getElementById('crowd-lifecycle');
    const hint = document.getElementById('crowd-lifecycle-hint');
    expect(app.selectedCrowd).toBeTruthy();
    expect(select.getAttribute('aria-describedby').split(' ')).toContain('crowd-lifecycle-hint');
    expect(hint.closest('label')).toBeNull(); // outside the label: not part of the select's name
    expect(hint.classList.contains('section-hint')).toBe(true);
    expect(hint.hidden).toBe(true);
    expect(hint.textContent).toBe('');
  });

  test('says nothing when no dot finishes before the route ends: the end now waits for them (CROWD-05)', async () => {
    const app = await editorWithCrowd();
    const hint = document.getElementById('crowd-lifecycle-hint');

    slide('crowd-speed', 1); // 0.01 img/s: the route takes 80 s, the route's own timeline a few
    const durationMs = app.animationEngine.state.baseDuration;
    const schedules = app.swarmEngine.scheduleDots(app.selectedCrowd, {
      durationMs, routePathPoints: app.pathPoints,
    });
    expect(dotsReachingJourneyEnd(schedules, durationMs)).toBe(0);
    // Every one of those journeys ends, so "At journey end" acts on each dot.
    expect(hint.hidden).toBe(true);
    expect(hint.textContent).toBe('');

    slide('crowd-speed', 40);
    expect(hint.hidden).toBe(true);
    expect(hint.textContent).toBe('');
  });

  test('follows the network, not the frame or the timeline: computing it asks for no animation frame', async () => {
    const app = await editorWithCrowd();
    const hint = document.getElementById('crowd-lifecycle-hint');
    const first = closedLoop(app);
    expect(hint.hidden).toBe(false);

    // Given an Exit the journeys end again, read straight from the model
    // without a frame.
    const frames = vi.mocked(globalThis.requestAnimationFrame);
    frames.mockClear();
    first.type = 'exit';
    app._syncCrowdLifecycleHint();
    expect(frames).not.toHaveBeenCalled();
    expect(hint.hidden).toBe(true);

    // A timeline change leaves it as the network has it: the end waits for
    // every journey that ends, however slow (CROWD-05).
    first.type = 'normal';
    app._syncCrowdLifecycleHint();
    expect(hint.hidden).toBe(false);
    app.waypoints[1].pauseMode = 'timed';
    app.waypoints[1].pauseTime = 60000;
    app.invalidateAnimationTiming();
    expect(hint.hidden).toBe(false);
  });

  test('on a closed loop with no Exit, names the node Type instead of Speed; an Exit clears it', async () => {
    const app = await editorWithCrowd();
    const hint = document.getElementById('crowd-lifecycle-hint');
    const guide = document.getElementById('crowd-guide-type');
    guide.value = 'graph';
    guide.dispatchEvent(new Event('change', { bubbles: true }));

    // Drawn with the pen and closed on its first node: three pass-through
    // nodes, three two-way paths, every node on two of them.
    const pen = app.networkEditService;
    expect(pen.active).toBe(true);
    const first = pen.placeNode({ x: 0.2, y: 0.3 });
    pen.placeNode({ x: 0.8, y: 0.3 });
    pen.placeNode({ x: 0.5, y: 0.8 });
    pen.clickNode(first);
    const { graph } = app.selectedCrowd;
    expect(graph.getEdges()).toHaveLength(3);
    expect(graph.getNodes().every(node => node.type === 'normal')).toBe(true);

    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe(
      'No dot’s journey ends on this network. Set a node’s Type to Exit to see this setting act.'
    );
    expect(hint.textContent).not.toMatch(/Speed|Window length/);

    pen.selectNode(first);
    const type = document.getElementById('network-node-type');
    type.value = 'exit';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    expect(first.type).toBe('exit');
    expect(hint.hidden).toBe(true);
    expect(hint.textContent).toBe('');
  });

  describe('what it costs, and what refreshes it', () => {
    const pick = (id, value, type = 'input') => {
      const control = document.getElementById(id);
      control.value = value;
      control.dispatchEvent(new Event(type, { bubbles: true }));
    };

    test('no edit schedules a dot for it, Speed included: it reads the network alone (CROWD-05)', async () => {
      const app = await editorWithCrowd();
      const hint = document.getElementById('crowd-lifecycle-hint');
      const schedule = vi.spyOn(app.swarmEngine, 'scheduleDots');

      // Size, Walking variation, colour and the mode itself change where a dot
      // is drawn or what it does at the end, never whether it gets there.
      slide('crowd-dot-size', 80);
      slide('crowd-wobble', 50);
      pick('crowd-dot-color', '#E69F00');
      pick('crowd-lifecycle', 'disappear', 'change');
      const [emitter] = app.selectedCrowd.emitters;
      expect(emitter).toMatchObject({ dotSize: 0.8, wobble: 0.5, lifecycleMode: 'disappear' });
      expect(emitter.dotColor.toUpperCase()).toBe('#E69F00');
      expect(schedule).not.toHaveBeenCalled();
      expect(hint.hidden).toBe(true);

      // Since the end waits for every journey that ends, Speed cannot show it.
      slide('crowd-speed', 1);
      expect(schedule).not.toHaveBeenCalled();
      expect(hint.hidden).toBe(true);

      // Showing, on a network nothing can end, it stays put through another such edit.
      closedLoop(app);
      expect(hint.hidden).toBe(false);
      slide('crowd-dot-size', 40);
      slide('crowd-speed', 40);
      expect(schedule).not.toHaveBeenCalled();
      expect(hint.hidden).toBe(false);
    });

    test('a network nothing can end shows its hint without scheduling a dot', async () => {
      const app = await editorWithCrowd();
      const hint = document.getElementById('crowd-lifecycle-hint');
      pick('crowd-guide-type', 'graph', 'change');
      const pen = app.networkEditService;
      const first = pen.placeNode({ x: 0.2, y: 0.3 });
      pen.placeNode({ x: 0.8, y: 0.3 });
      pen.placeNode({ x: 0.5, y: 0.8 });

      const schedule = vi.spyOn(app.swarmEngine, 'scheduleDots');
      pen.clickNode(first); // closes the loop: a committed network edit
      expect(hint.hidden).toBe(false);
      expect(hint.textContent).toMatch(/^No dot’s journey ends on this network\./);
      expect(schedule).not.toHaveBeenCalled();

      // Given an Exit, the next committed edit clears it, still without a
      // dot scheduled (CROWD-05: only the network decides it now).
      pen.selectNode(first);
      pick('network-node-type', 'exit', 'change');
      expect(schedule).not.toHaveBeenCalled();
      expect(hint.hidden).toBe(true);
    });

    test('undo and redo refresh it with the network they restore', async () => {
      const app = await editorWithCrowd();
      const hint = document.getElementById('crowd-lifecycle-hint');
      const first = closedLoop(app);
      expect(hint.hidden).toBe(false);
      app.networkEditService.selectNode(first);
      pick('network-node-type', 'exit', 'change'); // a committed edit, with its undo snapshot
      expect(hint.hidden).toBe(true);

      app.undo();
      expect(app.selectedCrowd.graph.getNode(first.id).type).toBe('normal');
      expect(hint.hidden).toBe(false);
      app.redo();
      expect(app.selectedCrowd.graph.getNode(first.id).type).toBe('exit');
      expect(hint.hidden).toBe(true);
    });

    test('selecting another crowd, or opening a project, refreshes it', async () => {
      const app = await editorWithCrowd();
      const hint = document.getElementById('crowd-lifecycle-hint');
      const slow = app.selectedCrowd;
      closedLoop(app);
      expect(hint.hidden).toBe(false);

      app.addCrowd(); // selected, on the route, which always ends
      expect(app.selectedCrowd).not.toBe(slow);
      expect(hint.hidden).toBe(true);
      app.eventBus.emit('crowd:selected', slow);
      expect(hint.hidden).toBe(false);

      // An opened project starts with no crowd selected, so no hint; selecting
      // its endless crowd shows it again.
      const project = app._buildProjectSnapshot();
      expect(await loadSnapshot(app, project)).toBe(true);
      expect(app.selectedCrowd).toBeNull();
      expect(hint.hidden).toBe(true);
      expect(hint.textContent).toBe('');
      app.eventBus.emit('crowd:selected', app.scene.getFlowLayer(slow.id));
      expect(hint.hidden).toBe(false);
    });
  });
});

/**
 * CROWD-07 F1 — the Size readout says what is drawn. It read "0.40×", a
 * factor of nothing the author can see, while the Marker card's Size (and the
 * head and the path) read reference px (UI-STANDARDS: "Map-bound size
 * controls use reference px readouts"). DotRenderer draws a dot's radius as
 * 10 reference px per 1×, so the readout is the diameter, 20 per 1×: the
 * default 0.40× reads "8 reference px", as the marker's default does.
 * `dotSize` is stored as before. Three writers say it: the shell's markup
 * (what a crowd with no emitter shows, since `syncCrowdEditor` stops before
 * the controls), the slider's own input, and the model's refresh of the panel.
 */
describe('the Size readout reads reference px (CROWD-07 F1)', () => {
  const readout = () => document.getElementById('crowd-dot-size-value');
  const slider = () => document.getElementById('crowd-dot-size');
  /** What the readout shows and what the slider says, which must be one string. */
  const said = () => [readout().textContent, slider().getAttribute('aria-valuetext')];
  const twice = text => [text, text];

  test('is the diameter DotRenderer draws: 20 reference px per 1×, so 0.40× reads 8', () => {
    const radii = [];
    const ctx = {
      save() {}, restore() {}, beginPath() {}, moveTo() {}, fill() {}, fillStyle: '',
      arc(x, y, radius) { radii.push(radius); },
    };
    const atReferenceScale = { scaleSizeClamped: value => value };
    for (const size of [0.05, 0.4, 1, 2]) {
      radii.length = 0;
      DotRenderer.render(ctx, [{ x: 0.5, y: 0.5, size, color: '#56B4E9' }], () => ({ x: 0, y: 0 }), atReferenceScale);
      expect(radii).toHaveLength(1);
      expect(formatCrowdDotSize(size), `${size}×`).toBe(`${2 * radii[0]} reference px`);
    }
    expect(formatCrowdDotSize(0.4)).toBe('8 reference px');
    // Whole at the slider's 0.05 steps, with no binary tail; to a tenth for a
    // value the outline set between them, down to the model's least.
    expect(formatCrowdDotSize(0.35)).toBe('7 reference px');
    expect(formatCrowdDotSize(0.43)).toBe('8.6 reference px');
    expect(formatCrowdDotSize(0.01)).toBe('0.2 reference px');
  });

  test('the shell says it before any crowd is drawn into it, and its hint says how exports scale it', () => {
    const shell = new DOMParser()
      .parseFromString(readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'), 'text/html');
    const input = shell.getElementById('crowd-dot-size');
    expect([shell.getElementById('crowd-dot-size-value').textContent, input.getAttribute('aria-valuetext')])
      .toEqual(twice('8 reference px'));
    expect(input.closest('label').querySelector('[data-tip]').getAttribute('data-tip'))
      .toBe("Dot diameter in project reference pixels; exports scale it from the project's reference short edge");
  });

  test('the slider and the model write it alike; an emitterless crowd keeps the unit, first and between populated ones', async () => {
    const app = await bootApp();
    await app.ready;
    document.getElementById('splash-close').click();
    expect(await loadSnapshot(app, {
      coordVersion: 9,
      waypoints: [{ id: 'a', imgX: 0.2, imgY: 0.3, isMajor: true }, { id: 'b', imgX: 0.7, imgY: 0.6, isMajor: true }],
      scene: { flowLayers: [{ id: 'empty', name: 'Empty crowd', guideType: 'graph', graph: { nodes: [], edges: [] }, emitters: [] }] },
    })).toBe(true);
    const empty = app.scene.getFlowLayer('empty');

    // An emitterless crowd selected before any populated one: the shell's own words.
    app.eventBus.emit('crowd:selected', empty);
    expect(document.getElementById('crowd-no-emitter').hidden).toBe(false);
    expect(said()).toEqual(twice('8 reference px'));

    // Populated: the model's refresh of the panel.
    app.addCrowd({ enterNetworkEditor: false });
    const full = app.selectedCrowd;
    const [emitter] = full.emitters;
    emitter.update({ dotSize: 0.6 });
    app.syncCrowdEditor();
    expect(said()).toEqual(twice('12 reference px'));

    // The slider's own input: 70 is 0.70×, 14 reference px, stored as before.
    slider().value = '70';
    slider().dispatchEvent(new Event('input', { bubbles: true }));
    expect(emitter.dotSize).toBe(0.7);
    expect(said()).toEqual(twice('14 reference px'));

    // Empty again: its controls are off and keep the unit, readout and voice as one.
    app.eventBus.emit('crowd:selected', empty);
    expect(slider().disabled).toBe(true);
    expect(said()[0]).toMatch(/^\d+(\.\d)? reference px$/);
    expect(said()[1]).toBe(said()[0]);

    // Populated again, after a change the panel did not make: the model's refresh says it.
    emitter.update({ dotSize: 1.5 });
    app.eventBus.emit('crowd:selected', full);
    expect(slider().disabled).toBe(false);
    expect(slider().value).toBe('150');
    expect(said()).toEqual(twice('30 reference px'));
  });
});

/**
 * CROWD-07 F6, F14, F20 — the hints the owner accepted on 2026-10-08.
 * F6: Respawn at the start and Repeat journey look alike on a route; the
 * label hint of "At journey end" says how the four differ (SwarmEngine: a
 * loop replays the first journey exactly; a respawn draws its own pace and
 * sway). F14: what "At journey end" acts on, on a custom network, is a
 * node's Type, said nowhere in Crowd scope; the Guide hint says it, both
 * fallbacks as the engine has them (`_buildGraphGuide`, `_endsJourney`).
 * F20's text is DEF-93's to change: unchanged here.
 */
describe('the crowd hints (CROWD-07 F6, F14, F20)', () => {
  const F6 = "Disappear removes a dot at its journey's end; Collect at the end parks it there; Respawn at the start "
    + 'sends a new dot from the start with its own pace and sway; Repeat journey replays the same walk exactly';
  const F14 = "Journeys start at Entry nodes and end at Exit nodes (a node's Type). With no Exit, they end at nodes "
    + 'with one path; with no Entry, dots set off from any node they can leave.';
  const guideHint = () => document.getElementById('crowd-guide-hint').textContent;
  const tooltip = () => document.getElementById('param-tooltip');
  const shown = () => (tooltip()?.style.display === 'block' ? tooltip().textContent : null);
  /** The text each `aria-describedby` token resolves to. */
  const described = control => (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
    .map(token => document.getElementById(token)?.textContent ?? `<missing ${token}>`);

  async function editor() {
    const app = await bootApp();
    await app.ready;
    document.getElementById('splash-close').click();
    return app;
  }

  async function withEmptyCrowd() {
    const app = await editor();
    expect(await loadSnapshot(app, {
      coordVersion: 9,
      waypoints: [{ id: 'a', imgX: 0.2, imgY: 0.3, isMajor: true }, { id: 'b', imgX: 0.7, imgY: 0.6, isMajor: true }],
      scene: { flowLayers: [{ id: 'empty', name: 'Empty crowd', guideType: 'graph', graph: { nodes: [], edges: [] }, emitters: [] }] },
    })).toBe(true);
    return app;
  }

  test('F6: "At journey end" tells its four apart, as its label hint and the select’s description, on any crowd', async () => {
    const app = await withEmptyCrowd();
    const select = document.getElementById('crowd-lifecycle');
    const tip = select.closest('label').querySelector('[data-tip]');
    expect(tip.getAttribute('data-tip')).toBe(F6);
    // The DEF-77 helper keeps its first place in the description; the hint follows.
    expect(select.getAttribute('aria-describedby').split(' ')[0]).toBe('crowd-lifecycle-hint');
    expect(described(select)).toContain(F6);

    // Kept on a crowd with no emitter (UI-06 B-31): the select is off, its help is not.
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('empty'));
    expect(select.disabled).toBe(true);
    expect(document.getElementById('crowd-lifecycle-hint').textContent).toBe(''); // F20's helper: no dots, nothing to say
    const trigger = document.querySelector(`.param-hint-trigger[aria-describedby="${tip.getAttribute('data-tip-desc')}"]`);
    expect([trigger.disabled, trigger.hidden]).toEqual([false, false]);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.focus();
    expect(shown()).toBe(F6);
    trigger.blur();

    app.addCrowd({ enterNetworkEditor: false });
    expect(select.disabled).toBe(false);
    expect(described(select)).toContain(F6);
  });

  test('F14: the Guide hint says where journeys start and end on a custom network, empty or drawn, and never on Follow route', async () => {
    const app = await withEmptyCrowd();
    app.addCrowd({ enterNetworkEditor: false });
    const layer = app.selectedCrowd;
    expect(layer.guideType).toBe('route');
    expect(guideHint()).toBe('Dots follow your route. Custom network lets you draw paths of their own.');

    layer.setGuideType('graph');
    app.syncCrowdEditor();
    expect(guideHint()).toBe(`No network yet — Edit network hands you the pen. ${F14}`);

    const entry = layer.graph.addNode({ x: 0.2, y: 0.5 });
    const exit = layer.graph.addNode({ x: 0.8, y: 0.5 });
    layer.graph.addEdge({ sourceId: entry.id, targetId: exit.id, direction: 'two-way' });
    app.updateGuideCard();
    expect(guideHint()).toBe(`Dots walk this crowd's own network (2 nodes, 1 path). ${F14}`);

    // After the network sentence, before the timing one (a route of fewer than two).
    const route = app.waypoints;
    app.waypoints = route.slice(0, 1);
    app.updateGuideCard();
    expect(guideHint()).toBe(`Dots walk this crowd's own network (2 nodes, 1 path). ${F14} `
      + 'Add at least two route waypoints to set the master timing before previewing or exporting.');

    // On an emitterless crowd too: the Guide card is the crowd's, emitter or not.
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('empty'));
    expect(guideHint()).toBe(`No network yet — Edit network hands you the pen. ${F14} `
      + 'Add at least two route waypoints to set the master timing before previewing or exporting.');

    // Back on Follow route, it goes.
    app.waypoints = route;
    app.eventBus.emit('crowd:selected', layer);
    layer.setGuideType('route');
    app.syncCrowdEditor();
    expect(guideHint()).not.toContain('Journeys start');
  });

  test('F20 is DEF-93’s: the endless-network helper reads as it did, and the Node Type hint keeps both fallbacks', async () => {
    const app = await editor();
    app.eventBus.emit('waypoint:add', { imgX: 0.1, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.5, isMajor: true });
    app.addCrowd({ enterNetworkEditor: false });
    const layer = app.selectedCrowd;
    layer.setGuideType('graph');
    // A closed loop of pass-through nodes: no Exit, and no node with one path.
    const nodes = [[0.2, 0.3], [0.8, 0.3], [0.5, 0.8]].map(([x, y]) => layer.graph.addNode({ x, y }));
    nodes.forEach((node, index) => layer.graph.addEdge({
      sourceId: node.id, targetId: nodes[(index + 1) % nodes.length].id, direction: 'two-way',
    }));
    app.syncCrowdEditor();
    const hint = document.getElementById('crowd-lifecycle-hint');
    expect(hint.hidden).toBe(false);
    expect(hint.textContent)
      .toBe('No dot’s journey ends on this network. Set a node’s Type to Exit to see this setting act.');

    expect(document.querySelector('label[for="network-node-type"] [data-tip]').getAttribute('data-tip'))
      .toBe('Entry nodes release dots and exit nodes end their journeys; pass-through nodes pass them on, or end '
        + 'them where no path leads out. With no exit, journeys end at nodes with one path; with no entry, dots set '
        + 'off from any node they can leave');
  });
});
