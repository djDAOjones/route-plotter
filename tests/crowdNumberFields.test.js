/**
 * DEF-86 — the crowd sliders and the Path card's Share never rewrite a value
 * the author did not set on them, and every value the model takes can be
 * typed (the owner's pick of 2026-10-08: "Number field beside each crowd
 * slider + full-width Traffic (Recommended)").
 *
 * The sliders' ranges are narrower than the model's (Count 1–500 against
 * 1–5,000; Speed 0.01–1 against 0.001–1,000; Size 0.05–2× against 0.01–100×;
 * Share's weight 0.1–5 against 0.01 and up). A value set in the outline or
 * opened from a file sat beyond a slider's end, the thumb sat at the end, and
 * the first nudge wrote the end: a weight of 24 became 5. Now each slider
 * has a number field beside it that holds the stored value, as it is, in
 * the readout's unit; a slider whose value lies past its ends is put at its
 * nearer end and turned off, with a line saying why, until the field brings
 * the value within its reach. What the model cannot take is refused in the
 * field's error line, as a path weight's is (UI-06 B-30), and the model
 * keeps its value.
 *
 * jsdom does not move a range on ArrowLeft, so a keyboard step is a value set
 * and `input` and `change` sent, as the browser would send them; the lead
 * checks ArrowLeft itself in Chromium.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp, tipSeen } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { SLIDER_REACH_REASON } from '../src/utils/uiReadouts.js';
import { EMITTER_LIMITS } from '../src/models/Emitter.js';
import { SCENE_LIMITS } from '../src/models/Scene.js';

const byId = id => document.getElementById(id);

/** The words an element shows, a field's value among them (an embedded field is read by its value). */
function shownText(element) {
  const copy = element.cloneNode(true);
  const originals = [...element.querySelectorAll('input')];
  [...copy.querySelectorAll('input')].forEach((input, index) => input.replaceWith(originals[index].value));
  return copy.textContent.replace(/\s+/g, ' ').trim();
}

/** The text each `aria-describedby` token resolves to, a readout's field read by its value. */
const described = control => (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
  .map(token => (byId(token) ? shownText(byId(token)) : `<missing ${token}>`));

/** A slider moved as a keyboard step moves it: its value, then `input` and `change`. */
function step(slider, value) {
  slider.value = String(value);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  slider.dispatchEvent(new Event('change', { bubbles: true }));
}

/** A value typed into a field and committed (Enter, or leaving it). */
function type(field, value) {
  field.value = String(value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

afterEach(() => localStorage.getItem.mockImplementation(() => null));

/** The editor with `flowLayers` opened, its route of two, the first crowd selected. */
async function editorWith(flowLayers) {
  // Errors are announced and asserted: the start's tip must not land among them.
  localStorage.getItem.mockImplementation(tipSeen());
  const app = await bootApp();
  await app.ready;
  byId('splash-close').click();
  expect(await loadSnapshot(app, {
    coordVersion: 9,
    waypoints: [{ id: 'a', imgX: 0.2, imgY: 0.3, isMajor: true }, { id: 'b', imgX: 0.7, imgY: 0.6, isMajor: true }],
    scene: { flowLayers },
  })).toBe(true);
  app.eventBus.emit('crowd:selected', app.scene.getFlowLayers()[0]);
  return app;
}

const crowd = (id, emitter = {}, extra = {}) => ({
  id, name: id, guideType: 'route', emitters: [{ id: `${id}-e`, seed: 7, ...emitter }], ...extra,
});

/** Each crowd field: its slider, its emitter key, a value inside the slider's reach and one past it. */
const FIELDS = [
  { slider: 'crowd-dot-size', key: 'dotSize', unit: ' reference px', min: 0.2, max: 2000, toModel: n => n / 20 },
  { slider: 'crowd-wobble', key: 'wobble', unit: '%', min: 0, max: 100, toModel: n => n / 100 },
  { slider: 'crowd-count', key: 'dotCount', unit: '', min: 1, max: 5000, toModel: n => n },
  { slider: 'crowd-release-start', key: 'releaseStart', unit: '%', min: 0, max: 100, toModel: n => n / 100 },
  { slider: 'crowd-release-duration', key: 'releaseDuration', unit: '%', min: 0, max: 100, toModel: n => n / 100 },
  { slider: 'crowd-onset-variance', key: 'onsetVariance', unit: '%', min: 0, max: 100, toModel: n => n / 100 },
  { slider: 'crowd-intensity-ramp', key: 'intensityRamp', unit: '%', min: -100, max: 100, toModel: n => n / 100 },
  { slider: 'crowd-speed', key: 'speed', unit: ' image lengths/s', min: 0.001, max: 1000, toModel: n => n },
  { slider: 'crowd-speed-variance', key: 'speedVariance', unit: '%', min: 0, max: 100, toModel: n => n / 100 },
];

describe('a stored value past a slider\'s reach is kept, not rewritten (DEF-86)', () => {
  test('Count 1000: the field holds 1000, the slider is off at its end and says why; a step writes nothing; 400 typed brings it back', async () => {
    const app = await editorWith([crowd('big', { dotCount: 1000 })]);
    const emitter = app.selectedCrowd.emitters[0];
    const slider = byId('crowd-count');
    const field = byId('crowd-count-field');
    const reason = byId('crowd-count-reason');
    expect(field.value).toBe('1000');
    expect([slider.value, slider.disabled]).toEqual(['500', true]);
    expect([reason.hidden, reason.textContent]).toEqual([false, SLIDER_REACH_REASON]);
    // Its readout (the field) first, its hint, and the reason, read with it.
    expect(described(slider)).toEqual(['1000', 'Total dots released across the window', SLIDER_REACH_REASON]);
    expect(slider.getAttribute('aria-valuetext')).toBe('1000');
    expect(shownText(byId('crowd-count-value'))).toBe('1000');

    // A keyboard step, as the browser would send it, is refused by the handler while the slider is off.
    step(slider, 499);
    expect(emitter.dotCount).toBe(1000);
    expect([slider.value, slider.disabled, field.value]).toEqual(['500', true, '1000']);

    type(field, 400);
    expect(emitter.dotCount).toBe(400);
    expect([slider.value, slider.disabled]).toEqual(['400', false]);
    expect([reason.hidden, reason.textContent]).toEqual([true, '']);
    expect(described(slider)).toEqual(['400', 'Total dots released across the window']);
    step(slider, 399);
    expect(emitter.dotCount).toBe(399);
    expect(field.value).toBe('399');
  });

  test('weight 24: the Share field holds 24, the slider is off at its end; a step never writes 23.9 or 5; 3 typed brings it back', async () => {
    const app = await editorWith([crowd('net', {}, {
      guideType: 'graph',
      graph: {
        nodes: [{ id: 'n1', x: 0.2, y: 0.5, type: 'entry' }, { id: 'n2', x: 0.8, y: 0.5, type: 'exit' }],
        edges: [{ id: 'e1', sourceId: 'n1', targetId: 'n2', direction: 'one-way', weight: 24 }],
      },
    })]);
    const layer = app.selectedCrowd;
    app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'edge', layerId: layer.id, edgeId: 'e1' });
    const edge = layer.graph.getEdge('e1');
    const slider = byId('network-edge-weight');
    const field = byId('network-edge-weight-field');
    const reason = byId('network-edge-weight-reason');
    expect(byId('edge-scope').hidden).toBe(false);
    expect(field.value).toBe('24');
    expect([slider.value, slider.disabled]).toEqual(['50', true]);
    expect([reason.hidden, reason.textContent]).toEqual([false, SLIDER_REACH_REASON]);
    expect(described(slider).at(-1)).toBe(SLIDER_REACH_REASON);
    expect(described(slider)[0]).toBe('100% of departures');

    step(slider, 49);
    expect(edge.weight).toBe(24);
    expect([slider.value, field.value]).toEqual(['50', '24']);

    type(field, 3);
    expect(edge.weight).toBe(3);
    expect([slider.value, slider.disabled, reason.hidden]).toEqual(['30', false, true]);
    step(slider, 29);
    expect(edge.weight).toBe(2.9);
    expect(field.value).toBe('2.9');

    // No top to the weight (GraphEdge): 1000 is kept, and the slider goes off again.
    type(field, 1000);
    expect(edge.weight).toBe(1000);
    expect(slider.disabled).toBe(true);
    // What a weight cannot be is refused, as a path-weight row refuses it.
    for (const bad of ['0', '0.001', '', 'abc', '-1']) {
      type(field, bad);
      expect(edge.weight, bad).toBe(1000);
      expect(byId('network-edge-weight-field-error').textContent, bad)
        .toBe('Enter a weight of 0.01 or more; the path keeps 1000 until you do.');
      expect(field.getAttribute('aria-invalid'), bad).toBe('true');
    }
    type(field, 0.01);
    expect(edge.weight).toBe(0.01);
    expect(byId('network-edge-weight-field-error').hidden).toBe(true);
  });

  test('every crowd field takes its range and refuses the rest: min, max, past max, empty, not a number', async () => {
    const app = await editorWith([crowd('all')]);
    const emitter = app.selectedCrowd.emitters[0];
    const said = vi.spyOn(app, 'announce');
    for (const { slider, key, unit, min, max, toModel } of FIELDS) {
      const field = byId(`${slider}-field`);
      const error = byId(`${slider}-field-error`);
      for (const good of [min, max]) {
        type(field, good);
        expect(emitter[key], `${slider} ${good}`).toBeCloseTo(toModel(good), 12);
        expect([error.hidden, field.getAttribute('aria-invalid')], `${slider} ${good}`).toEqual([true, null]);
      }
      const kept = emitter[key];
      const pastMax = slider === 'crowd-speed' ? max + 0.001 : max + 1;
      for (const bad of [pastMax, min - 1, '', 'abc']) {
        said.mockClear();
        type(field, bad);
        expect(emitter[key], `${slider} ${bad}`).toBe(kept);
        expect(error.hidden, `${slider} ${bad}`).toBe(false);
        expect(error.textContent, `${slider} ${bad}`).toMatch(/^Enter .+ from .+ to .+; the crowd keeps .+ until you do\.$/);
        expect(error.textContent, `${slider} ${bad}`)
          .toContain(`the crowd keeps ${byId(slider).getAttribute('aria-valuetext')} until you do.`);
        expect(described(field)[0], `${slider} ${bad}`).toBe(error.textContent);
        expect(field.getAttribute('aria-invalid')).toBe('true');
      }
      // Said once as it first showed, not for each value refused while it stood.
      expect(said.mock.calls.length, slider).toBeLessThanOrEqual(1);
      expect(unit === '%' ? error.textContent.includes(`to ${max}%;`) : true, slider).toBe(true);
    }
    expect(byId('crowd-count-field-error').textContent)
      .toBe('Enter a whole number of dots from 1 to 5000; the crowd keeps 5000 until you do.');
    expect(byId('crowd-intensity-ramp-field-error').textContent)
      .toBe('Enter a release bias from −100 to 100%; the crowd keeps Later 100% until you do.');
    expect(byId('crowd-dot-size-field-error').textContent)
      .toBe('Enter a size from 0.2 to 2000 reference px; the crowd keeps 2000 reference px until you do.');
    // A part of a dot is not a count.
    type(byId('crowd-count-field'), 2.5);
    expect(emitter.dotCount).toBe(5000);
    expect(byId('crowd-count-field-error').hidden).toBe(false);
  });

  test('Size reads and writes reference px: 8 is 0.40×, 8.6 is 0.43×, the least 0.2 is 0.01×, and back', async () => {
    const app = await editorWith([crowd('size', { dotSize: 0.43 })]);
    const emitter = app.selectedCrowd.emitters[0];
    const field = byId('crowd-dot-size-field');
    expect(field.value).toBe('8.6');
    expect(byId('crowd-dot-size').getAttribute('aria-valuetext')).toBe('8.6 reference px');
    type(field, 8);
    expect(emitter.dotSize).toBe(0.4);
    type(field, 8.6);
    expect(emitter.dotSize).toBe(0.43);
    type(field, 0.2);
    expect(emitter.dotSize).toBe(0.01);
    expect(field.value).toBe('0.2');
    expect(byId('crowd-dot-size').disabled).toBe(true); // 0.01× is below the slider's 0.05×
    type(field, 1.4);
    expect(emitter.dotSize).toBe(0.07);
    expect(field.value).toBe('1.4');
  });

  test('Speed shows its stored value as it is: 0.001 never reads 0.00, 0.4 reads 0.4', async () => {
    const app = await editorWith([crowd('slow', { speed: 0.001 })]);
    const field = byId('crowd-speed-field');
    const slider = byId('crowd-speed');
    expect(field.value).toBe('0.001');
    expect(slider.getAttribute('aria-valuetext')).toBe('0.001 image lengths/s');
    expect([slider.value, slider.disabled]).toEqual(['1', true]);
    type(field, 0.4);
    expect(app.selectedCrowd.emitters[0].speed).toBe(0.4);
    expect([field.value, slider.value, slider.disabled]).toEqual(['0.4', '40', false]);
    expect(slider.getAttribute('aria-valuetext')).toBe('0.4 image lengths/s');
  });

  test('the fields take what the model takes, natively too: Size 8 and 8.5, Speed 0.40 and 0.001, a bias of −37.5', async () => {
    await editorWith([crowd('native')]);
    const valid = (id, value) => {
      const field = byId(id);
      field.value = value;
      return field.validity.valid;
    };
    expect(['8', '8.5', '0.2', '2000'].map(value => valid('crowd-dot-size-field', value))).toEqual([true, true, true, true]);
    expect(['0.40', '0.001', '0.4', '1000'].map(value => valid('crowd-speed-field', value))).toEqual([true, true, true, true]);
    expect(['-37.5', '100', '-100'].map(value => valid('crowd-intensity-ramp-field', value))).toEqual([true, true, true]);
    expect(['12.25'].map(value => valid('crowd-wobble-field', value))).toEqual([true]);
    expect(['0.01', '24', '123456'].map(value => valid('network-edge-weight-field', value))).toEqual([true, true, true]);
    expect(byId('network-edge-weight-field').hasAttribute('max')).toBe(false);
  });

  test('Release bias keeps its direction beside its field: −40 typed reads Earlier 40%', async () => {
    const app = await editorWith([crowd('bias')]);
    const field = byId('crowd-intensity-ramp-field');
    type(field, -40);
    expect(app.selectedCrowd.emitters[0].intensityRamp).toBe(-0.4);
    expect(byId('crowd-intensity-ramp-value').textContent).toBe('Earlier 40%');
    expect(byId('crowd-intensity-ramp').getAttribute('aria-valuetext')).toBe('Earlier 40%');
    expect(described(field)).toEqual(['Earlier 40%',
      "Left (Earlier) sets more dots off near the window's start; right (Later) near its end; Even favours neither"]);
  });

  test('Count is refused past the room the scene\'s dot budget leaves, in the outline\'s words', async () => {
    const app = await editorWith([
      crowd('small', { dotCount: 1000 }), crowd('b1', { dotCount: 5000 }), crowd('b2', { dotCount: 5000 }),
      crowd('b3', { dotCount: 5000 }), crowd('b4', { dotCount: 3000 }),
    ]);
    const emitter = app.selectedCrowd.emitters[0];
    expect(app.selectedCrowd.id).toBe('small');
    const field = byId('crowd-count-field');
    // 19,000 dots configured: 18,000 elsewhere leave this crowd room for 2,000.
    expect(field.max).toBe('2000');
    type(field, 2001);
    expect(emitter.dotCount).toBe(1000);
    expect(byId('crowd-count-field-error').textContent)
      .toBe(`The whole scene supports at most ${SCENE_LIMITS.MAX_DOTS_TOTAL} configured dots.`);
    type(field, 2000);
    expect(emitter.dotCount).toBe(2000);
    expect(byId('crowd-count-field-error').hidden).toBe(true);
    expect(EMITTER_LIMITS.MAX_DOT_COUNT).toBe(5000);
  });

  test('the outline and the card agree after a round trip, either way', async () => {
    const app = await editorWith([crowd('trip', { dotSize: 0.4, speed: 0.4 })]);
    const layer = app.selectedCrowd;
    const emitter = layer.emitters[0];
    type(byId('crowd-dot-size-field'), 8.6);
    type(byId('crowd-speed-field'), 0.0015);
    const snapshot = app._buildProjectSnapshot();
    const saved = snapshot.scene.flowLayers[0].emitters[0];
    expect([saved.dotSize, saved.speed]).toEqual([0.43, 0.0015]);

    // The outline's own update, as its untouched fields send their stored values: the card shows them.
    app.eventBus.emit('scene-outline:command', {
      action: 'update-emitter', layerId: layer.id, emitterId: emitter.id,
      dotCount: String(emitter.dotCount), speed: '0.0025', dotSize: '1.25', dotColor: emitter.dotColor,
      lifecycleMode: emitter.lifecycleMode, intensityRampDirection: 'later', intensityRampAmount: '37.5',
      releaseStart: '12.5', releaseDuration: '50', onsetVariance: '20', speedVariance: '20', wobble: '0',
    });
    expect([emitter.speed, emitter.dotSize, emitter.intensityRamp, emitter.releaseStart]).toEqual([0.0025, 1.25, 0.375, 0.125]);
    expect(byId('crowd-speed-field').value).toBe('0.0025');
    expect(byId('crowd-dot-size-field').value).toBe('25');
    expect(byId('crowd-intensity-ramp-field').value).toBe('37.5');
    expect(byId('crowd-release-start-field').value).toBe('12.5');
    expect(byId('crowd-release-start').value).toBe('13'); // within reach: the nearest step, and on
    expect(byId('crowd-release-start').disabled).toBe(false);
  });
});

describe('the reasons belong to the crowd shown, and a crowd with no emitter shows none (DEF-86, UI-06 B-31)', () => {
  test('a crowd with no emitter, after one storing Count 1000, keeps every control off and shows no reason', async () => {
    const app = await editorWith([
      crowd('big', { dotCount: 1000 }),
      { id: 'empty', name: 'Empty crowd', guideType: 'graph', graph: { nodes: [], edges: [] }, emitters: [] },
    ]);
    expect(byId('crowd-count-reason').hidden).toBe(false);
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('empty'));
    expect(byId('crowd-no-emitter').hidden).toBe(false);
    for (const { slider } of FIELDS) {
      expect(byId(slider).disabled, slider).toBe(true);
      expect(byId(`${slider}-field`).disabled, slider).toBe(true);
      expect([byId(`${slider}-reason`).hidden, byId(`${slider}-reason`).textContent], slider).toEqual([true, '']);
      expect(described(byId(slider)), slider).not.toContain(SLIDER_REACH_REASON);
    }
    expect(byId('crowd-seed-value').disabled).toBe(true);
  });

  test('a reason and an error go with the crowd they were about; the readout and hint tokens stay, once each', async () => {
    const app = await editorWith([crowd('big', { dotCount: 1000 }), crowd('small', { dotCount: 50 })]);
    const slider = byId('crowd-count');
    const field = byId('crowd-count-field');
    type(byId('crowd-speed-field'), '');
    expect(byId('crowd-speed-field-error').hidden).toBe(false);

    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('small'));
    expect([slider.disabled, byId('crowd-count-reason').hidden]).toEqual([false, true]);
    expect(described(slider)).toEqual(['50', 'Total dots released across the window']);
    expect([byId('crowd-speed-field-error').hidden, byId('crowd-speed-field').getAttribute('aria-invalid')])
      .toEqual([true, null]);
    expect(described(byId('crowd-speed-field'))).toEqual([
      "Dot travel speed in image lengths per second: 1 is the image's width across or its height down",
    ]);

    // Back and forth: the reason's token is added once, and the others keep their places.
    for (let index = 0; index < 3; index += 1) {
      app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('big'));
      app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('big'));
    }
    expect(described(slider)).toEqual(['1000', 'Total dots released across the window', SLIDER_REACH_REASON]);
    expect(described(field)).toEqual(['Total dots released across the window']);
  });
});
