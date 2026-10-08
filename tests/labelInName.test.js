/**
 * UI-06 (B-04, J-21) — a control's visible words are the start of its name.
 *
 * UI-STANDARDS: "Visible label text must match the accessible name" (WCAG
 * 2.5.3 Label in Name). Speech-input users say what they see: "click Upload
 * image". A button whose `aria-label` was "Upload custom marker image" did
 * not answer, and nothing in the suite pinned the rule, so an aria-label
 * written for a screen reader could break it again.
 *
 * The rule, as a test can read it: for every control that shows words and
 * also carries an `aria-label`, the visible words (whitespace collapsed,
 * case ignored) are a prefix of that label. Context belongs in
 * `aria-describedby`, never in the name. A control that shows only a glyph
 * ("×", "⏮", "▲") has no text label, so WCAG 2.5.3 does not reach it.
 *
 * Read on the booted app in the states that build named controls: a route
 * selected (the cards' Reset and Apply onward), a crowd (the layer rows),
 * the network banner (its Done). The card actions' disabled reasons are
 * read as descriptions, not names (J-21): the name stays "Reset".
 */

import { describe, test, expect } from 'vitest';
import { bootApp } from './helpers/bootApp.js';

const CONTROLS = 'button, [role="button"], [role="menuitem"], [role="switch"], a[href], input[type="button"], input[type="submit"]';
const FIELDS = 'input:not([type="hidden"]):not([type="file"]):not([type="button"]):not([type="submit"]), select, textarea';

/** The words an element's `aria-labelledby` resolves to, or null without one. */
function labelledByText(element) {
  const ids = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
  if (ids.length === 0) return null;
  return ids.map(id => document.getElementById(id)?.textContent.replace(/\s+/g, ' ').trim() ?? `[no #${id}]`).join(' ');
}

/**
 * A field's visible label: the words of its first `<label>` — the hint span
 * that carries them, or the label's own text; never the readout or the unit
 * that follows the field, which a browser does not read as its name either.
 */
function fieldLabelText(field) {
  const label = field.labels?.[0];
  if (!label) return '';
  const direct = [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.data)
    .join(' ').replace(/\s+/g, ' ').trim();
  if (direct) return direct;
  const span = label.querySelector(':scope > span[data-tip], :scope > span:not([id])');
  return span ? visibleWords(span) : '';
}

/**
 * Fields and labelled-by controls: a field named by `aria-label` or
 * `aria-labelledby` must still start with the words its `<label>` shows; a
 * control named by `aria-labelledby` must start with the words it shows.
 */
function nameFaults(root) {
  const faults = [];
  let checked = 0;
  for (const field of root.querySelectorAll(FIELDS)) {
    const shown = fieldLabelText(field);
    if (!/[a-zA-Z]/.test(shown)) continue;
    const name = field.getAttribute('aria-label') ?? labelledByText(field);
    if (name === null) continue;
    checked += 1;
    if (!name.toLowerCase().startsWith(shown.toLowerCase())) {
      faults.push(`${field.id ? `#${field.id}` : field.name}: labelled "${shown}", named "${name}"`);
    }
  }
  for (const control of root.querySelectorAll(CONTROLS)) {
    const name = labelledByText(control);
    if (name === null) continue;
    const words = visibleWords(control);
    if (!/[a-zA-Z]/.test(words)) continue;
    checked += 1;
    if (!name.toLowerCase().startsWith(words.toLowerCase())) {
      faults.push(`${control.id ? `#${control.id}` : control.className}: shows "${words}", labelled by "${name}"`);
    }
  }
  return { faults, checked };
}

/** The words a control shows: its text without hidden and screen-reader-only parts. */
function visibleWords(control) {
  const copy = control.cloneNode(true);
  copy.querySelectorAll('[aria-hidden="true"], .sr-only').forEach(node => node.remove());
  return copy.textContent.replace(/\s+/g, ' ').trim();
}

/** Controls that show words and carry an aria-label, with what is wrong, if anything. */
function labelFaults(root) {
  const faults = [];
  let checked = 0;
  for (const control of root.querySelectorAll(CONTROLS)) {
    const name = control.getAttribute('aria-label');
    if (name === null) continue;
    const words = visibleWords(control);
    if (!/[a-zA-Z]/.test(words)) continue;
    checked += 1;
    if (!name.toLowerCase().replace(/\s+/g, ' ').startsWith(words.toLowerCase())) {
      faults.push(`${control.id ? `#${control.id}` : control.className}: shows "${words}", named "${name}"`);
    }
  }
  return { faults, checked };
}

/** What `aria-describedby` resolves to, in order. */
function describedText(control) {
  return (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
    .map(id => document.getElementById(id)?.textContent.replace(/\s+/g, ' ').trim() ?? `[no #${id}]`);
}

describe('a control’s visible words start its accessible name (UI-06 B-04)', () => {
  test('the shell, with a route selected, a crowd and the network banner', async () => {
    const app = await bootApp();
    try {
      await app.ready;
      document.getElementById('splash-close').click();
      app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
      app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
      app.eventBus.emit('waypoint:selected', app.waypoints[0]);
      app.addCrowd({ enterNetworkEditor: false });
      const layer = app.selectedCrowd;
      layer.setGuideType('graph');
      app.syncCrowdEditor();
      app.updateGuideCard();
      app.networkEditService.enter(layer);
      await Promise.resolve();

      // Vacuous unless the named controls were there to check.
      expect(document.getElementById('network-edit-banner')).not.toBeNull();
      expect(document.querySelectorAll('#layers-strip .layer-row').length).toBe(2);
      expect(document.querySelectorAll('#waypoint-list .waypoint-row').length).toBeGreaterThan(2);

      const { faults, checked } = labelFaults(document.body);
      expect(checked).toBeGreaterThan(0);
      expect(faults).toEqual([]);

      // Fields named by aria-label or aria-labelledby, and controls labelled
      // by another element (the path-weight rows of a node with two paths
      // leaving it), start with their words too.
      const junction = layer.graph.addNode({ x: 0.5, y: 0.5 });
      for (const y of [0.2, 0.8]) {
        const exit = layer.graph.addNode({ x: 0.9, y, type: 'exit' });
        layer.graph.addEdge({ sourceId: junction.id, targetId: exit.id, direction: 'one-way' });
      }
      app.networkEditService.selectNode(junction);
      app.syncNetworkCards();
      await Promise.resolve();
      expect(document.querySelectorAll('.network-path-weight-row input').length).toBe(2);
      const names = nameFaults(document.body);
      expect(names.checked).toBeGreaterThan(2);
      expect(names.faults).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });

  test('a disabled Draw area says why in a line it is described by, with no title (UI-06 B-07)', async () => {
    const app = await bootApp();
    try {
      await app.ready;
      document.getElementById('splash-close').click();
      app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
      app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
      const [first, second] = app.waypoints;
      app.eventBus.emit('waypoint:multi-selected', { waypoints: [first, second], primary: first });

      const draw = document.getElementById('area-draw-btn');
      const reason = document.getElementById('area-draw-reason');
      expect(draw.disabled).toBe(true);
      expect(draw.hasAttribute('title')).toBe(false);
      expect(reason.hidden).toBe(false);
      expect(reason.textContent).toBe('Draw an area with one waypoint selected.');
      expect(describedText(draw)).toEqual(['Draw an area with one waypoint selected.']);

      app.eventBus.emit('waypoint:selected', first);
      expect(draw.disabled).toBe(false);
      expect(reason.hidden).toBe(true);
      expect(reason.textContent).toBe('');
    } finally {
      app.interactionHandler.destroy();
    }
  });

  test('the words the review found renamed are the names now, with their context described', async () => {
    const app = await bootApp();
    try {
      await app.ready;
      document.getElementById('splash-close').click();
      app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
      app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
      app.eventBus.emit('waypoint:selected', app.waypoints[0]);

      const nameOf = id => document.getElementById(id).getAttribute('aria-label');
      for (const id of ['marker-upload-btn', 'head-upload-btn', 'bg-upload-btn', 'area-draw-btn']) {
        expect(nameOf(id), `#${id} is named by its words`).toBeNull();
      }
      expect(describedText(document.getElementById('marker-upload-btn'))).toEqual(['a custom marker image']);
      expect(describedText(document.getElementById('head-upload-btn'))).toEqual(['a custom head image']);
      expect(describedText(document.getElementById('bg-upload-btn'))).toEqual(['the background image']);

      const addWaypoint = document.querySelector('#waypoint-list .waypoint-add-btn');
      expect(visibleWords(addWaypoint)).toBe('Add waypoint');
      expect(addWaypoint.getAttribute('aria-label')).toBeNull();
      expect(describedText(addWaypoint)).toEqual(['at the centre of the map']);

      // The four Apply onward buttons: one name, the card word as the description.
      const applies = [...document.querySelectorAll('[data-card-action="apply-onward"]')];
      expect(applies.length).toBe(4);
      for (const apply of applies) {
        expect(visibleWords(apply)).toBe('Apply onward');
        expect(apply.getAttribute('aria-label')).toBeNull();
      }
      expect(applies.map(apply => describedText(apply)[0])).toEqual(['Marker', 'On arrival', 'Label style', 'Leg']);
    } finally {
      app.interactionHandler.destroy();
    }
  });

  test('a disabled Reset keeps its name; its reason is a visible line it is described by (J-21)', async () => {
    const app = await bootApp();
    try {
      await app.ready;
      document.getElementById('splash-close').click();
      app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
      app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
      app.eventBus.emit('waypoint:selected', app.waypoints[0]);

      // A fresh waypoint already uses the route style: Reset has nothing to do.
      const reset = document.querySelector('[data-card="marker"][data-card-action="reset"]');
      expect(reset.disabled).toBe(true);
      expect(visibleWords(reset)).toBe('Reset');
      expect(reset.getAttribute('aria-label')).toBeNull();
      expect(reset.hasAttribute('title')).toBe(false);
      const reason = document.querySelector('[data-card="marker"][data-card-reason="reset"]');
      expect(reason.textContent).toBe('Reset: already uses route style.');
      expect(reason.closest('p').hidden).toBe(false);
      expect(describedText(reset)).toEqual(['Marker', 'Reset: already uses route style.']);

      // Nothing later to apply to from the last waypoint: Apply onward says so too.
      app.eventBus.emit('waypoint:selected', app.waypoints[1]);
      const apply = document.querySelector('[data-card="marker"][data-card-action="apply-onward"]');
      expect(apply.disabled).toBe(true);
      expect(describedText(apply)).toEqual(['Marker', 'Apply onward: no later applicable waypoint.']);
    } finally {
      app.interactionHandler.destroy();
    }
  });
});
