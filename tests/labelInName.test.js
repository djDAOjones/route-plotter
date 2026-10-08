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
