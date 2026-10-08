/**
 * DEF-20 — the controls tell the truth after Open and Clear All.
 *
 * A project load wrote the Duration thumb only when the left Duration slider
 * was there, and that slider had been removed, so after Open the thumb stayed
 * where the last project left it, under the new project's readout: one nudge
 * then set the speed the old thumb meant (the plan's live check: a 12.7 s
 * project's thumb at 3,901, and one +5 nudge made it 646 s). The reveal and
 * Angle of View sliders were not written on Open or on a failed Open's
 * rollback either, so their first touch jumped those settings too. The
 * Duration slider also dropped a user's input for 50 ms after any write to
 * it. And Clear All left Preview by an event nothing hears, so the header
 * switch still said Preview.
 *
 * These drive the booted app as a user does: Open through `loadProject`
 * (the archive's import replaced, as projectRollback.test.js does), each
 * slider moved by its value and `input`, and Clear All through its dialog.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { MOTION } from '../src/config/constants.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { formatUIValue, log2ValueToSlider, sliderToAngle } from '../src/utils/sliderScales.js';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Past the 50 ms the app waits before it measures timing again. */
const settled = () => new Promise(resolve => setTimeout(resolve, 120));

const byId = id => document.getElementById(id);
const durationSlider = () => byId('animation-speed-right');

/**
 * The Duration slider's position for a speed: SPEED_CURVE (UIController.js,
 * private) inverted, 1–4,000 px/s across positions 1–4,000, slow on the right.
 */
const thumbFor = speed => Math.round(1 + (1 - Math.log(speed) / Math.log(4000)) * 3999);

/**
 * The View Angle position whose angle, by the slider's own scale, is nearest
 * `angle`: worked out here from `sliderToAngle`, not from the inverse under test.
 */
function anglePosition(angle) {
  let best = 0;
  for (let position = 1; position <= 1000; position += 1) {
    const meaning = sliderToAngle(position, MOTION.AOV_ANGLE_MIN, MOTION.AOV_ANGLE_MAX);
    const bestMeaning = sliderToAngle(best, MOTION.AOV_ANGLE_MIN, MOTION.AOV_ANGLE_MAX);
    if (Math.abs(meaning - angle) < Math.abs(bestMeaning - angle)) best = position;
  }
  return best;
}

/** A slider moved as a browser moves it: its value, then `input`. */
function moveAsUser(id, value) {
  const slider = byId(id);
  slider.value = String(value);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}

/** A booted editor, Help closed and its image loaded. */
async function openEditor() {
  const app = await bootApp();
  await app.ready;
  byId('splash-close').click();
  await vi.waitFor(() => expect(app.background.image).toBeTruthy());
  return app;
}

/** The bundled Open day route (150 px/s, as in the live check), with motion settings of its own. */
function openDayProject(motionSettings = {}) {
  const { project } = buildExampleProjects().find(example => example.id === 'uon-open-day');
  return { ...project, motionSettings: { ...project.motionSettings, ...motionSettings } };
}

/** Open a project as File → Open does, its archive's import replaced. */
async function openProject(app, projectData) {
  vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValueOnce({
    projectData, imageAssets: [], backgroundBase64: null,
  });
  const loaded = await app.loadProject(new File([''], 'project.zip'));
  await settled();
  return loaded;
}

/** The events the bus sends, by name, from now on. */
function recordSent(app) {
  const emit = vi.spyOn(app.eventBus, 'emit');
  return name => emit.mock.calls.filter(([event]) => event === name).map(([, payload]) => payload);
}

/** What each reveal and Angle of View slider and its readout say. */
function revealAndAngleControls() {
  return Object.fromEntries(['reveal-size', 'reveal-feather', 'reveal-trail', 'aov-angle', 'aov-distance',
    'aov-dropoff'].map(id => [id, [byId(id).value, byId(`${id}-value`).textContent,
    byId(id).getAttribute('aria-valuetext')]]));
}

/** Where those controls should stand for a project's motion settings, by each slider's own scale. */
function revealAndAngleFor(settings) {
  const percent = value => formatUIValue(value, '%');
  const trailText = settings.revealTrail >= MOTION.SPOTLIGHT_TRAIL_MAX ? 'Whole path' : `${percent(settings.revealTrail)} of path`;
  return {
    'reveal-size': [String(log2ValueToSlider(settings.revealSize, MOTION.SPOTLIGHT_SIZE_MIN, MOTION.SPOTLIGHT_SIZE_MAX)),
      percent(settings.revealSize), percent(settings.revealSize)],
    'reveal-feather': [String(log2ValueToSlider(settings.revealFeather, MOTION.SPOTLIGHT_FEATHER_MIN,
      MOTION.SPOTLIGHT_FEATHER_MAX)), percent(settings.revealFeather), percent(settings.revealFeather)],
    'reveal-trail': [String(log2ValueToSlider(settings.revealTrail, MOTION.SPOTLIGHT_TRAIL_MIN,
      MOTION.SPOTLIGHT_TRAIL_MAX)), trailText, trailText],
    'aov-angle': [String(anglePosition(settings.aovAngle)),
      formatUIValue(settings.aovAngle, '°'), formatUIValue(settings.aovAngle, '°')],
    'aov-distance': [String(log2ValueToSlider(settings.aovDistance, MOTION.AOV_DISTANCE_MIN, MOTION.AOV_DISTANCE_MAX)),
      percent(settings.aovDistance), percent(settings.aovDistance)],
    'aov-dropoff': [String(Math.round(settings.aovDropoff / MOTION.AOV_DROPOFF_MAX * 1000)),
      percent(settings.aovDropoff), percent(settings.aovDropoff)],
  };
}

/** Motion settings away from start-up's and from the markup's, each slider's own. */
const OPEN_DAY_MOTION = {
  backgroundVisibility: 'angle-of-view', revealSize: 7, revealFeather: 71, revealTrail: 38,
  aovAngle: 95, aovDistance: 66, aovDropoff: 23,
};

/** Another project's, for the Open that fails. */
const OTHER_MOTION = {
  backgroundVisibility: 'spotlight', revealSize: 3, revealFeather: 8, revealTrail: 12,
  aovAngle: 20, aovDistance: 5, aovDropoff: 80,
};

describe('after Open, every pacing and reveal control stands where the project is (DEF-20)', () => {
  test('the Duration thumb is at the project\'s speed, so one nudge moves the duration one step, not 50×', async () => {
    const app = await openEditor();
    // The last project's Duration, dragged nearly to its slow end.
    moveAsUser('animation-speed-right', 3901);
    expect(await openProject(app, openDayProject())).toBe(true);

    const { speed, duration } = app.animationEngine.state;
    expect(speed).toBe(150);
    expect(durationSlider().value).toBe(String(thumbFor(150)));
    expect(byId('animation-speed-value-right').textContent).toBe(`${Math.round(duration / 100) / 10}s`);

    // One step slower: the speed the thumb now means, and the duration with it.
    const sent = recordSent(app);
    moveAsUser('animation-speed-right', thumbFor(150) + 5);
    await settled();
    const [nudged] = sent('animation:speed-change');
    expect(nudged).toBe(Math.round(4000 ** (1 - (thumbFor(150) + 4) / 3999)));
    expect(Math.abs(nudged - 150)).toBeLessThanOrEqual(2);
    const ratio = app.animationEngine.state.duration / duration;
    expect(ratio).toBeGreaterThan(0.97);
    expect(ratio).toBeLessThan(1.03);
  });

  test('the reveal and Angle of View sliders show the project\'s values, and touching one keeps its value', async () => {
    const app = await openEditor();
    expect(await openProject(app, openDayProject(OPEN_DAY_MOTION))).toBe(true);

    expect(revealAndAngleControls()).toEqual(revealAndAngleFor(OPEN_DAY_MOTION));
    // The project's mode shows its own controls.
    expect(byId('aov-controls').style.display).toBe('block');
    expect(byId('spotlight-controls').style.display).toBe('none');

    // A touch that leaves each thumb where it is leaves its setting within a slider unit.
    const read = {
      'reveal-size': 'revealSize', 'reveal-feather': 'revealFeather', 'reveal-trail': 'revealTrail',
      'aov-angle': 'aovAngle', 'aov-distance': 'aovDistance', 'aov-dropoff': 'aovDropoff',
    };
    const touched = {};
    for (const [id, setting] of Object.entries(read)) {
      moveAsUser(id, byId(id).value);
      touched[id] = Math.abs(app.motionSettings[setting] - OPEN_DAY_MOTION[setting]) / OPEN_DAY_MOTION[setting];
    }
    for (const [id, drift] of Object.entries(touched)) expect(drift, id).toBeLessThan(0.01);
  });

  test('a failed Open gives back the open project\'s Duration thumb and reveal and Angle of View sliders', async () => {
    allowConsole(/Failed to load project/);
    const app = await openEditor();
    expect(await openProject(app, openDayProject(OPEN_DAY_MOTION))).toBe(true);
    const open = { duration: String(thumbFor(150)), controls: revealAndAngleFor(OPEN_DAY_MOTION) };
    expect({ duration: durationSlider().value, controls: revealAndAngleControls() }).toEqual(open);

    // Late in the commit, once every control has switched to the incoming project.
    let switched = null;
    vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => {
      switched = { duration: durationSlider().value, controls: revealAndAngleControls() };
      throw new Error('the commit failed after the project switched');
    });
    const incoming = openDayProject(OTHER_MOTION);
    incoming.animationState = { ...incoming.animationState, speed: 600 };
    expect(await openProject(app, incoming)).toBe(false);

    // The incoming project's values were written, then the open one's put back.
    expect(switched).toEqual({ duration: String(thumbFor(600)), controls: revealAndAngleFor(OTHER_MOTION) });
    expect({ duration: durationSlider().value, controls: revealAndAngleControls() }).toEqual(open);
    expect(app.animationEngine.state.speed).toBe(150);
  });

  test('an Angle of View setting beyond its slider puts the thumb at the end, and a missing one is left alone', async () => {
    const app = await openEditor();
    const { set } = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const written = [];
    vi.spyOn(HTMLInputElement.prototype, 'value', 'set').mockImplementation(function write(value) {
      if (/^aov-/.test(this.id)) written.push([this.id, String(value)]);
      set.call(this, value);
    });
    // Load accepts any finite motion setting.
    expect(await openProject(app, openDayProject({ aovAngle: 400, aovDistance: 0.25, aovDropoff: 150 }))).toBe(true);
    expect(written).toEqual([['aov-angle', '1000'], ['aov-distance', '0'], ['aov-dropoff', '1000']]);
    expect(await openProject(app, openDayProject({ aovAngle: -3, aovDistance: 250, aovDropoff: -20 }))).toBe(true);
    expect(written.slice(3)).toEqual([['aov-angle', '0'], ['aov-distance', '1000'], ['aov-dropoff', '0']]);

    // Through its public method, a setting not given leaves its slider as it was.
    written.length = 0;
    const others = ['aov-distance', 'aov-dropoff'].map(id => [byId(id).value, byId(`${id}-value`).textContent]);
    app.uiController.syncAngleOfViewControls({ aovAngle: 95 });
    expect(written).toEqual([['aov-angle', String(anglePosition(95))]]);
    expect(['aov-distance', 'aov-dropoff'].map(id => [byId(id).value, byId(`${id}-value`).textContent]))
      .toEqual(others);
  });
});

describe('the Duration slider takes every move a user makes (DEF-20)', () => {
  test('a move straight after the app has moved the thumb is sent, not dropped for 50 ms', async () => {
    const app = await openEditor();
    app.eventBus.emit('ui:slider:update-speed', 150);
    expect(durationSlider().value).toBe(String(thumbFor(150)));

    const sent = recordSent(app);
    moveAsUser('animation-speed-right', 2001);
    expect(sent('animation:speed-change')).toEqual([Math.round(4000 ** (1 - 2000 / 3999))]);
  });
});

describe('Clear All in Preview goes back to Edit, and the switch says so (DEF-20)', () => {
  test('through the mode setter: the switch and its labels show Edit, and the mode\'s listeners hear it', async () => {
    const app = await openEditor();
    expect(await openProject(app, openDayProject())).toBe(true);
    // The editor starts in Preview.
    expect(app.previewMode).toBe(true);
    expect(byId('mode-toggle-btn').getAttribute('aria-checked')).toBe('true');

    const sent = recordSent(app);
    byId('clear-btn').click();
    byId('clear-confirm').click();

    expect(app.waypoints).toEqual([]);
    expect(app.previewMode).toBe(false);
    expect(byId('mode-toggle-btn').getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('.mode-label-edit').classList.contains('active')).toBe(true);
    expect(document.querySelector('.mode-label-preview').classList.contains('active')).toBe(false);
    expect(sent('motion:preview-mode-change')).toEqual([false]);
    expect(sent('mode:changed')).toEqual([]);

    // The switch's next click goes to Preview, as it says it will.
    byId('mode-toggle-btn').click();
    expect(app.previewMode).toBe(true);
    expect(byId('mode-toggle-btn').getAttribute('aria-checked')).toBe('true');
  });
});
