/**
 * TST-13 — every slider and number field in `index.html` against the code
 * that gives its numbers a meaning.
 *
 * A range's `min`, `max` and `value` are written once in the shell and again,
 * in another unit, in the code: in `src/config/constants.js`, in a model's
 * defaults and limits, in the loader's limits, or in the scale that turns a
 * slider position into a model value. Nothing tied the two, so they drifted
 * (SEG-023: "the ranges appear in both HTML and JS"; CON-14 lists five). This
 * pins them together, reading the shipped `index.html` from disk and the real
 * modules, so drift on either side fails:
 *
 * - every range and number field is paired with its code, or says why not;
 * - each bound the code defines means the same as the field's `min`/`max`;
 * - each default the code defines is where the field's `value` puts the thumb;
 * - every value the app writes into a field, on a new project and on a project
 *   at the limits load accepts, fits the field's `min`, `max` and `step`.
 *
 * Disagreements that exist today are pinned with the reason, not failed, so a
 * fix — or a new drift — changes this file. CON-14 (owner decision
 * 2026-09-22, Q19) makes the UI ranges authoritative: load keeps accepting
 * the historical maxima, so several pins below are decided, not defects.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  ANIMATION, AREA_HIGHLIGHT, MOTION, RENDERING, TEXT_LABEL, VIDEO_EXPORT
} from '../src/config/constants.js';
import { CAMERA_DEFAULTS, CameraService } from '../src/services/CameraService.js';
import { PROJECT_MODEL_LIMITS } from '../src/app/persistence.js';
import { UIController } from '../src/controllers/UIController.js';
import { Emitter, EMITTER_LIMITS } from '../src/models/Emitter.js';
import { GraphEdge } from '../src/models/GraphEdge.js';
import { Waypoint } from '../src/models/Waypoint.js';
import {
  bipolarSliderToLog2Value, sliderToAngle, sliderToLog2Value
} from '../src/utils/sliderScales.js';
import { sliderToPathWidth } from '../src/utils/pathWidthScale.js';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const shell = new DOMParser().parseFromString(readFileSync(join(repoRoot, 'index.html'), 'utf8'), 'text/html');

/** Every range and number field in the shipped shell, by id. */
const FIELDS = new Map([...shell.querySelectorAll('input[type="range"], input[type="number"]')]
  .map(input => [input.id, input]));

const attribute = (id, name) => {
  const text = FIELDS.get(id)?.getAttribute(name);
  return text === null || text === undefined ? null : Number(text);
};

const running = [];
afterEach(() => {
  for (const app of running.splice(0)) app.interactionHandler.destroy();
});

// ---------------------------------------------------------------------------
// The pairings
// ---------------------------------------------------------------------------

/** The public scales on the controller that owns them (they do not read `this`). */
const scales = UIController.prototype;
/** Inline in UIController.js: an area size slider maps 0–1000 linearly onto its constants' range. */
const areaSize = (min, max) => s => min + (s / 1000) * (max - min);
const DEFAULT_WAYPOINT = new Waypoint({ imgX: 0.5, imgY: 0.5 });
const DEFAULT_EMITTER = new Emitter();
const percent = slider => slider / 100;

/**
 * Each field whose numbers the code also defines: `toModel` turns a position
 * into what the app stores (the real scale where one is exported; where the
 * mapping is written inline, the same arithmetic, named with its file), and
 * `min`, `max` and `value` are the code's own bound and default in the
 * model's unit, with where each comes from. A missing entry means the code
 * defines no such number.
 */
const PAIRINGS = {
  'dot-size': { toModel: s => s,
    value: [RENDERING.DEFAULT_DOT_SIZE, 'RENDERING.DEFAULT_DOT_SIZE'] },
  'waypoint-pause-time': { toModel: s => scales.sliderToPauseTime(s),
    min: [0, 'no pause'],
    value: [DEFAULT_WAYPOINT.pauseTime / 1000, 'a new Waypoint (ANIMATION.DEFAULT_WAIT_TIME, s)'] },
  'camera-zoom': { toModel: s => CameraService.sliderToZoom(s),
    min: [CAMERA_DEFAULTS.ZOOM_MIN, 'CAMERA_DEFAULTS.ZOOM_MIN'],
    max: [CAMERA_DEFAULTS.ZOOM_MAX, 'CAMERA_DEFAULTS.ZOOM_MAX'],
    value: [CAMERA_DEFAULTS.ZOOM, 'CAMERA_DEFAULTS.ZOOM'] },
  'camera-selected-zoom': { toModel: s => CameraService.sliderToZoom(s),
    min: [CAMERA_DEFAULTS.ZOOM_MIN, 'CAMERA_DEFAULTS.ZOOM_MIN'],
    max: [CAMERA_DEFAULTS.ZOOM_MAX, 'CAMERA_DEFAULTS.ZOOM_MAX'],
    value: [CAMERA_DEFAULTS.ZOOM, 'CAMERA_DEFAULTS.ZOOM'] },
  'ripple-thickness': { toModel: s => s, value: [DEFAULT_WAYPOINT.rippleThickness, 'a new Waypoint'] },
  'ripple-max-scale': { toModel: s => s, value: [DEFAULT_WAYPOINT.rippleMaxScale, 'a new Waypoint'] },
  'pulse-amplitude': { toModel: s => s, value: [DEFAULT_WAYPOINT.pulseAmplitude, 'a new Waypoint'] },
  'pulse-cycle-speed': { toModel: s => s, value: [DEFAULT_WAYPOINT.pulseCycleSpeed, 'a new Waypoint'] },
  'label-size': { toModel: s => s,
    min: [TEXT_LABEL.SIZE_PX_MIN, 'TEXT_LABEL.SIZE_PX_MIN'],
    max: [TEXT_LABEL.SIZE_PX_MAX, 'TEXT_LABEL.SIZE_PX_MAX'],
    value: [TEXT_LABEL.SIZE_DEFAULT, 'TEXT_LABEL.SIZE_DEFAULT'] },
  'label-bg-opacity': { toModel: percent,
    min: [TEXT_LABEL.BG_OPACITY_MIN, 'TEXT_LABEL.BG_OPACITY_MIN'],
    max: [TEXT_LABEL.BG_OPACITY_MAX, 'TEXT_LABEL.BG_OPACITY_MAX'],
    value: [TEXT_LABEL.BG_OPACITY_DEFAULT, 'TEXT_LABEL.BG_OPACITY_DEFAULT'] },
  'label-width': { toModel: s => s,
    min: [TEXT_LABEL.WIDTH_MIN, 'TEXT_LABEL.WIDTH_MIN'],
    max: [TEXT_LABEL.WIDTH_MAX, 'TEXT_LABEL.WIDTH_MAX'],
    value: [TEXT_LABEL.WIDTH_DEFAULT, 'TEXT_LABEL.WIDTH_DEFAULT'] },
  'label-offset-x': { toModel: s => s,
    min: [TEXT_LABEL.OFFSET_MIN, 'TEXT_LABEL.OFFSET_MIN'],
    max: [TEXT_LABEL.OFFSET_MAX, 'TEXT_LABEL.OFFSET_MAX'],
    value: [TEXT_LABEL.OFFSET_DEFAULT_X, 'TEXT_LABEL.OFFSET_DEFAULT_X'] },
  'label-offset-y': { toModel: s => s,
    min: [TEXT_LABEL.OFFSET_MIN, 'TEXT_LABEL.OFFSET_MIN'],
    max: [TEXT_LABEL.OFFSET_MAX, 'TEXT_LABEL.OFFSET_MAX'],
    value: [TEXT_LABEL.OFFSET_DEFAULT_Y, 'TEXT_LABEL.OFFSET_DEFAULT_Y'] },
  'segment-width': { toModel: sliderToPathWidth,
    value: [RENDERING.DEFAULT_PATH_THICKNESS, 'RENDERING.DEFAULT_PATH_THICKNESS'] },
  'waypoint-segment-speed': { toModel: s => scales.sliderToSegmentSpeed(s),
    value: [DEFAULT_WAYPOINT.segmentSpeed, 'a new Waypoint'] },
  'shape-amplitude': { toModel: s => s, value: [DEFAULT_WAYPOINT.shapeAmplitude, 'a new Waypoint'] },
  'shape-frequency': { toModel: s => s, value: [DEFAULT_WAYPOINT.shapeFrequency, 'a new Waypoint'] },
  'area-circle-radius': {
    toModel: areaSize(AREA_HIGHLIGHT.CIRCLE_RADIUS_MIN, AREA_HIGHLIGHT.CIRCLE_RADIUS_MAX),
    min: [AREA_HIGHLIGHT.CIRCLE_RADIUS_MIN, 'AREA_HIGHLIGHT.CIRCLE_RADIUS_MIN'],
    max: [AREA_HIGHLIGHT.CIRCLE_RADIUS_MAX, 'AREA_HIGHLIGHT.CIRCLE_RADIUS_MAX'],
    value: [AREA_HIGHLIGHT.CIRCLE_RADIUS_DEFAULT, 'AREA_HIGHLIGHT.CIRCLE_RADIUS_DEFAULT'] },
  'area-rect-width': {
    toModel: areaSize(AREA_HIGHLIGHT.RECT_SIZE_MIN, AREA_HIGHLIGHT.RECT_SIZE_MAX),
    min: [AREA_HIGHLIGHT.RECT_SIZE_MIN, 'AREA_HIGHLIGHT.RECT_SIZE_MIN'],
    max: [AREA_HIGHLIGHT.RECT_SIZE_MAX, 'AREA_HIGHLIGHT.RECT_SIZE_MAX'],
    value: [AREA_HIGHLIGHT.RECT_WIDTH_DEFAULT, 'AREA_HIGHLIGHT.RECT_WIDTH_DEFAULT'] },
  'area-rect-height': {
    toModel: areaSize(AREA_HIGHLIGHT.RECT_SIZE_MIN, AREA_HIGHLIGHT.RECT_SIZE_MAX),
    min: [AREA_HIGHLIGHT.RECT_SIZE_MIN, 'AREA_HIGHLIGHT.RECT_SIZE_MIN'],
    max: [AREA_HIGHLIGHT.RECT_SIZE_MAX, 'AREA_HIGHLIGHT.RECT_SIZE_MAX'],
    value: [AREA_HIGHLIGHT.RECT_HEIGHT_DEFAULT, 'AREA_HIGHLIGHT.RECT_HEIGHT_DEFAULT'] },
  'area-fill-opacity': { toModel: percent,
    min: [AREA_HIGHLIGHT.FILL_OPACITY_MIN, 'AREA_HIGHLIGHT.FILL_OPACITY_MIN'],
    max: [AREA_HIGHLIGHT.FILL_OPACITY_MAX, 'AREA_HIGHLIGHT.FILL_OPACITY_MAX'],
    value: [AREA_HIGHLIGHT.FILL_OPACITY_DEFAULT, 'AREA_HIGHLIGHT.FILL_OPACITY_DEFAULT'] },
  'area-border-width': { toModel: s => s,
    min: [AREA_HIGHLIGHT.BORDER_WIDTH_MIN, 'AREA_HIGHLIGHT.BORDER_WIDTH_MIN'],
    max: [AREA_HIGHLIGHT.BORDER_WIDTH_MAX, 'AREA_HIGHLIGHT.BORDER_WIDTH_MAX'],
    value: [AREA_HIGHLIGHT.BORDER_WIDTH_DEFAULT, 'AREA_HIGHLIGHT.BORDER_WIDTH_DEFAULT'] },
  'area-fade-in': { toModel: s => s,
    min: [AREA_HIGHLIGHT.FADE_MIN, 'AREA_HIGHLIGHT.FADE_MIN'],
    max: [AREA_HIGHLIGHT.FADE_MAX, 'AREA_HIGHLIGHT.FADE_MAX'],
    value: [AREA_HIGHLIGHT.FADE_IN_DEFAULT, 'AREA_HIGHLIGHT.FADE_IN_DEFAULT'] },
  'area-fade-out': { toModel: s => s,
    min: [AREA_HIGHLIGHT.FADE_MIN, 'AREA_HIGHLIGHT.FADE_MIN'],
    max: [AREA_HIGHLIGHT.FADE_MAX, 'AREA_HIGHLIGHT.FADE_MAX'],
    value: [AREA_HIGHLIGHT.FADE_OUT_DEFAULT, 'AREA_HIGHLIGHT.FADE_OUT_DEFAULT'] },
  'path-head-size': { toModel: s => s, value: [RENDERING.PATH_HEAD_SIZE, 'RENDERING.PATH_HEAD_SIZE'] },
  'path-trail': { toModel: s => scales.sliderToTrailFraction(s),
    min: [0, 'trail off'],
    max: [MOTION.PATH_TRAIL_MAX, 'MOTION.PATH_TRAIL_MAX'],
    value: [MOTION.PATH_TRAIL_DEFAULT, 'MOTION.PATH_TRAIL_DEFAULT'] },
  'reveal-size': { toModel: s => sliderToLog2Value(s, MOTION.SPOTLIGHT_SIZE_MIN, MOTION.SPOTLIGHT_SIZE_MAX),
    min: [MOTION.SPOTLIGHT_SIZE_MIN, 'MOTION.SPOTLIGHT_SIZE_MIN'],
    max: [MOTION.SPOTLIGHT_SIZE_MAX, 'MOTION.SPOTLIGHT_SIZE_MAX'],
    value: [MOTION.SPOTLIGHT_SIZE_DEFAULT, 'MOTION.SPOTLIGHT_SIZE_DEFAULT'] },
  'reveal-feather': { toModel: s => sliderToLog2Value(s, MOTION.SPOTLIGHT_FEATHER_MIN, MOTION.SPOTLIGHT_FEATHER_MAX),
    min: [MOTION.SPOTLIGHT_FEATHER_MIN, 'MOTION.SPOTLIGHT_FEATHER_MIN'],
    max: [MOTION.SPOTLIGHT_FEATHER_MAX, 'MOTION.SPOTLIGHT_FEATHER_MAX'],
    value: [MOTION.SPOTLIGHT_FEATHER_DEFAULT, 'MOTION.SPOTLIGHT_FEATHER_DEFAULT'] },
  'reveal-trail': { toModel: s => sliderToLog2Value(s, MOTION.SPOTLIGHT_TRAIL_MIN, MOTION.SPOTLIGHT_TRAIL_MAX),
    min: [MOTION.SPOTLIGHT_TRAIL_MIN, 'MOTION.SPOTLIGHT_TRAIL_MIN'],
    max: [MOTION.SPOTLIGHT_TRAIL_MAX, 'MOTION.SPOTLIGHT_TRAIL_MAX'],
    value: [MOTION.SPOTLIGHT_TRAIL_DEFAULT, 'MOTION.SPOTLIGHT_TRAIL_DEFAULT'] },
  'aov-angle': { toModel: s => sliderToAngle(s, MOTION.AOV_ANGLE_MIN, MOTION.AOV_ANGLE_MAX),
    min: [MOTION.AOV_ANGLE_MIN, 'MOTION.AOV_ANGLE_MIN'],
    max: [MOTION.AOV_ANGLE_MAX, 'MOTION.AOV_ANGLE_MAX'],
    value: [MOTION.AOV_ANGLE_DEFAULT, 'MOTION.AOV_ANGLE_DEFAULT'] },
  'aov-distance': { toModel: s => sliderToLog2Value(s, MOTION.AOV_DISTANCE_MIN, MOTION.AOV_DISTANCE_MAX),
    min: [MOTION.AOV_DISTANCE_MIN, 'MOTION.AOV_DISTANCE_MIN'],
    max: [MOTION.AOV_DISTANCE_MAX, 'MOTION.AOV_DISTANCE_MAX'],
    value: [MOTION.AOV_DISTANCE_DEFAULT, 'MOTION.AOV_DISTANCE_DEFAULT'] },
  // Inline in UIController.js: linear, 0–1000 onto 0–AOV_DROPOFF_MAX.
  'aov-dropoff': { toModel: s => (s / 1000) * MOTION.AOV_DROPOFF_MAX,
    min: [MOTION.AOV_DROPOFF_MIN, 'MOTION.AOV_DROPOFF_MIN'],
    max: [MOTION.AOV_DROPOFF_MAX, 'MOTION.AOV_DROPOFF_MAX'],
    value: [MOTION.AOV_DROPOFF_DEFAULT, 'MOTION.AOV_DROPOFF_DEFAULT'] },
  'path-glow-intensity': { toModel: percent,
    value: [RENDERING.PATH_GLOW_DEFAULT_INTENSITY, 'RENDERING.PATH_GLOW_DEFAULT_INTENSITY'] },
  'bg-overlay': { toModel: s => bipolarSliderToLog2Value(s, MOTION.TINT_MIN, MOTION.TINT_MAX),
    min: [-MOTION.TINT_MAX, '−MOTION.TINT_MAX'],
    max: [MOTION.TINT_MAX, 'MOTION.TINT_MAX'] },
  'export-frame-rate': { toModel: s => s,
    min: [VIDEO_EXPORT.MIN_FRAME_RATE, 'VIDEO_EXPORT.MIN_FRAME_RATE'],
    max: [VIDEO_EXPORT.MAX_FRAME_RATE, 'VIDEO_EXPORT.MAX_FRAME_RATE'],
    value: [VIDEO_EXPORT.DEFAULT_FRAME_RATE, 'VIDEO_EXPORT.DEFAULT_FRAME_RATE'] },
  // Inline in crowds.js: each crowd slider is the emitter field × 100.
  'crowd-dot-size': { toModel: percent,
    min: [new Emitter({ dotSize: 0 }).dotSize, "Emitter's smallest dot"],
    max: [EMITTER_LIMITS.MAX_DOT_SIZE, 'EMITTER_LIMITS.MAX_DOT_SIZE'],
    value: [DEFAULT_EMITTER.dotSize, 'a new Emitter'] },
  'crowd-wobble': { toModel: percent,
    min: [new Emitter({ wobble: -1 }).wobble, "Emitter's clamp"],
    max: [new Emitter({ wobble: 2 }).wobble, "Emitter's clamp"],
    value: [DEFAULT_EMITTER.wobble, 'a new Emitter'] },
  'crowd-count': { toModel: s => s,
    min: [new Emitter({ dotCount: 0 }).dotCount, "Emitter's clamp"],
    max: [EMITTER_LIMITS.MAX_DOT_COUNT, 'EMITTER_LIMITS.MAX_DOT_COUNT'],
    value: [DEFAULT_EMITTER.dotCount, 'a new Emitter'] },
  'crowd-release-start': { toModel: percent,
    min: [new Emitter({ releaseStart: -1 }).releaseStart, "Emitter's clamp"],
    max: [new Emitter({ releaseStart: 2 }).releaseStart, "Emitter's clamp"],
    value: [DEFAULT_EMITTER.releaseStart, 'a new Emitter'] },
  'crowd-release-duration': { toModel: percent,
    min: [new Emitter({ releaseDuration: -1 }).releaseDuration, "Emitter's clamp"],
    max: [new Emitter({ releaseDuration: 2 }).releaseDuration, "Emitter's clamp"],
    value: [DEFAULT_EMITTER.releaseDuration, 'a new Emitter'] },
  'crowd-onset-variance': { toModel: percent,
    min: [new Emitter({ onsetVariance: -1 }).onsetVariance, "Emitter's clamp"],
    max: [new Emitter({ onsetVariance: 2 }).onsetVariance, "Emitter's clamp"],
    value: [DEFAULT_EMITTER.onsetVariance, 'a new Emitter'] },
  'crowd-intensity-ramp': { toModel: percent,
    min: [new Emitter({ intensityRamp: -2 }).intensityRamp, "Emitter's clamp"],
    max: [new Emitter({ intensityRamp: 2 }).intensityRamp, "Emitter's clamp"],
    value: [DEFAULT_EMITTER.intensityRamp, 'a new Emitter'] },
  'crowd-speed': { toModel: percent,
    min: [new Emitter({ speed: 0 }).speed, "Emitter's slowest speed"],
    max: [EMITTER_LIMITS.MAX_SPEED, 'EMITTER_LIMITS.MAX_SPEED'],
    value: [DEFAULT_EMITTER.speed, 'a new Emitter'] },
  'crowd-speed-variance': { toModel: percent,
    min: [new Emitter({ speedVariance: -1 }).speedVariance, "Emitter's clamp"],
    max: [new Emitter({ speedVariance: 2 }).speedVariance, "Emitter's clamp"],
    value: [DEFAULT_EMITTER.speedVariance, 'a new Emitter'] },
  // Inline in network.js: the slider is the edge weight × 10.
  'network-edge-weight': { toModel: s => s / 10,
    min: [new GraphEdge({ sourceId: 'a', targetId: 'b', weight: 0 }).weight, "GraphEdge's smallest weight"],
    value: [new GraphEdge({ sourceId: 'a', targetId: 'b' }).weight, 'a new GraphEdge'] },
  'timeline-slider': { toModel: s => s / ANIMATION.TIMELINE_RESOLUTION,
    min: [0, 'the start of the timeline'],
    max: [1, 'the end of the timeline (ANIMATION.TIMELINE_RESOLUTION steps)'] }
};

/**
 * Fields whose defaults live on the running app rather than in a module,
 * read from a booted one. The field's `min` and `max` have no counterpart.
 */
const APP_DEFAULTS = {
  'head-rotation-offset': { toModel: s => s, value: app => app.styles.pathHead.rotationOffset },
  // Inline in wiringDom.js: the multiplier is 2 to the power of slider ÷ 100.
  'graphics-scale': { toModel: s => 2 ** (s / 100), value: app => app.styles.graphicsScale },
  'background-zoom': { toModel: s => s, value: app => app.exportSettings.backgroundZoom },
  'bg-overlay': {
    toModel: s => bipolarSliderToLog2Value(s, MOTION.TINT_MIN, MOTION.TINT_MAX),
    value: app => app.background.overlay
  }
};

/** Fields with no number of their own in the code, and why. */
const NO_COUNTERPART = {
  'animation-speed-right': 'its curve (SPEED_CURVE, UIController.js) is private; the booted tests below pin ' +
    'what the app writes into it',
  'export-res-x': "its 100–7680 clamp is written inline in the field's change handler (UIController.js), and " +
    "its default follows the background's size; LOAD_LIMITS pins what load accepts",
  'export-res-y': "its 100–4320 clamp is written inline in the field's change handler (UIController.js), and " +
    "its default follows the background's size; LOAD_LIMITS pins what load accepts"
};

/**
 * What the loader accepts, from its exported limits, against the field's
 * reach. CON-14 decided the UI ranges are authoritative and load keeps the
 * historical maxima, so these differ on purpose; each field shows at most
 * its own top, as the load test below pins.
 */
const LOAD_LIMITS = {
  'waypoint-pause-time': { toModel: s => scales.sliderToPauseTime(s),
    load: PROJECT_MODEL_LIMITS.MAX_WAYPOINT_PAUSE_MS / 1000, html: 1000, means: 30,
    why: 'the scene outline and load accept up to 600 s; the slider stays a 0–30 s fine control (Joe, 2026-09-28)' },
  'export-res-x': { toModel: s => s, load: PROJECT_MODEL_LIMITS.MAX_EXPORT_DIMENSION, html: 7680, means: 7680,
    why: 'load accepts up to 16,384 px; the field and its change handler stop at 7,680 (CON-14)' },
  'export-res-y': { toModel: s => s, load: PROJECT_MODEL_LIMITS.MAX_EXPORT_DIMENSION, html: 4320, means: 4320,
    why: 'load accepts up to 16,384 px; the field and its change handler stop at 4,320 (CON-14)' },
  'export-frame-rate': { toModel: s => s, load: PROJECT_MODEL_LIMITS.MAX_FRAME_RATE, html: 60, means: 60,
    why: "load accepts up to 120 fps; the field says 60, as VIDEO_EXPORT does (CON-14's frame rate ×4)" }
};

// ---------------------------------------------------------------------------
// The disagreements that exist today
// ---------------------------------------------------------------------------

/**
 * `field attribute` → what index.html says (`html`), what that means in the
 * model (`means`), what the code says (`code`, from `source`), for a default
 * the thumb position the code's value needs (`codePosition`), and why they
 * differ.
 */
const DISAGREEMENTS = {
  // The model and the scene outline accept more than the crowd sliders reach.
  'crowd-count max': { html: 500, means: 500, code: 5000, source: 'EMITTER_LIMITS.MAX_DOT_COUNT',
    why: 'a crowd of up to 5,000 dots loads and can be typed into the scene outline; the slider stops at 500' },
  'crowd-dot-size min': { html: 5, means: 0.05, code: 0.01, source: "Emitter's smallest dot",
    why: 'the emitter and the outline go down to 0.01×; the slider starts at 0.05×' },
  'crowd-dot-size max': { html: 200, means: 2, code: 100, source: 'EMITTER_LIMITS.MAX_DOT_SIZE',
    why: 'the emitter and the outline go up to 100×; the slider stops at 2×' },
  'crowd-speed min': { html: 1, means: 0.01, code: 0.001, source: "Emitter's slowest speed",
    why: 'the emitter and the outline go down to 0.001 img/s; the slider starts at 0.01' },
  'crowd-speed max': { html: 100, means: 1, code: 1000, source: 'EMITTER_LIMITS.MAX_SPEED',
    why: 'the emitter and the outline go up to 1000 img/s; the slider stops at 1' },
  'network-edge-weight min': { html: 1, means: 0.1, code: 0.01, source: "GraphEdge's smallest weight",
    why: 'an edge and the outline go down to 0.01; the slider starts at 0.1 (and stops at 5, where the model ' +
      'has no top)' },

  // Markup defaults the code has since moved away from.
  'waypoint-pause-time value': { html: 500, means: 5.3033, code: 1.5, codePosition: 302,
    source: 'a new Waypoint (ANIMATION.DEFAULT_WAIT_TIME, s)',
    why: "the markup's own readout says 1.5s; the app writes 302 when a waypoint is selected" },
  'label-offset-y value': { html: -5, means: -5, code: 0, codePosition: 0, source: 'TEXT_LABEL.OFFSET_DEFAULT_Y',
    why: 'predates the centred default; the app writes 0 when a waypoint is selected' },
  'segment-width value': { html: 333, means: 3.4157, code: 3, codePosition: 298,
    source: 'RENDERING.DEFAULT_PATH_THICKNESS',
    why: "the markup's own readout says 3.0 reference px; the app writes 298 when a waypoint is selected" },
  'area-circle-radius value': { html: 100, means: 0.059, code: 0.05, codePosition: 82,
    source: 'AREA_HIGHLIGHT.CIRCLE_RADIUS_DEFAULT',
    why: "the markup's own readout says 5%; the app writes 82 when a waypoint is selected" },
  'area-rect-width value': { html: 125, means: 0.1087, code: 0.1, codePosition: 114,
    source: 'AREA_HIGHLIGHT.RECT_WIDTH_DEFAULT',
    why: "the markup's own readout says 10%; the app writes 114 when a waypoint is selected" },
  'area-rect-height value': { html: 125, means: 0.1087, code: 0.1, codePosition: 114,
    source: 'AREA_HIGHLIGHT.RECT_HEIGHT_DEFAULT',
    why: 'as the width; the app writes 114 when a waypoint is selected' },
  'reveal-size value': { html: 500, means: 5, code: 10, codePosition: 715, source: 'MOTION.SPOTLIGHT_SIZE_DEFAULT',
    why: 'start-up writes 715 (syncRevealControls), so it never shows' },
  'reveal-feather value': { html: 500, means: 10, code: 0, codePosition: 0, source: 'MOTION.SPOTLIGHT_FEATHER_DEFAULT',
    why: 'start-up writes 0; the default 0 lies below SPOTLIGHT_FEATHER_MIN, so position 0 means 1%, not the ' +
      '0% the readout prints' },

  // Markup defaults a new project shows, because nothing writes these thumbs.
  'path-trail value': { html: 590, means: 0.3221, code: 0.2, codePosition: 527, source: 'MOTION.PATH_TRAIL_DEFAULT',
    why: 'nothing writes the thumb until a project loads; its readout markup says 15%, the model means 5.0% ' +
      'as the readout prints it' },
  'aov-angle value': { html: 500, means: 73.7188, code: 60, codePosition: 416, source: 'MOTION.AOV_ANGLE_DEFAULT',
    why: 'nothing writes the Angle of view sliders (DEF-20): the readout says 60°, the thumb means 74°' },
  'aov-distance value': { html: 500, means: 10, code: 25, codePosition: 699, source: 'MOTION.AOV_DISTANCE_DEFAULT',
    why: "nothing writes the Angle of view sliders (DEF-20): thumb and readout say 10%, the project's setting is 25%" }
};

// ---------------------------------------------------------------------------

/**
 * The position on a field's own grid whose meaning is nearest a model value,
 * and how near that is: a dead zone (the tint's) has many equally good ones.
 */
function positionFor(id, toModel, modelValue) {
  const min = attribute(id, 'min');
  const max = attribute(id, 'max');
  const step = attribute(id, 'step') ?? 1;
  let best = null;
  for (let index = 0; min + index * step <= max + 1e-9; index += 1) {
    const position = Number((min + index * step).toFixed(6));
    const distance = Math.abs(toModel(position) - modelValue);
    if (best === null || distance < best.distance - 1e-12) best = { position, distance };
  }
  return best;
}

const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const rounded = value => Number(value.toFixed(4));

/**
 * Record every value the app writes into one of the shell's range and number
 * fields, before the browser sanitises it: the value the code meant is the
 * one to hold against the field's bounds. Values a test types as a user are
 * left out.
 */
function recordWrites() {
  const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const writes = [];
  let typing = false;
  Object.defineProperty(HTMLInputElement.prototype, 'value', {
    configurable: true,
    enumerable: native.enumerable,
    get() { return native.get.call(this); },
    set(value) {
      if (!typing && FIELDS.has(this.id)) writes.push({ id: this.id, value: Number(value) });
      native.set.call(this, value);
    }
  });
  return {
    writes,
    asUser(act) {
      typing = true;
      try { act(); } finally { typing = false; }
    },
    restore() { Object.defineProperty(HTMLInputElement.prototype, 'value', native); }
  };
}

/** The writes that fall outside a field's min and max, or off its step, as `id value`. */
function misfits(writes) {
  const found = new Set();
  for (const { id, value } of writes) {
    const min = attribute(id, 'min');
    const max = attribute(id, 'max');
    const stepText = FIELDS.get(id).getAttribute('step');
    const step = stepText === 'any' ? null : Number(stepText ?? 1);
    const steps = step === null ? 0 : (value - (min ?? 0)) / step;
    const onStep = step === null || Math.abs(steps - Math.round(steps)) < 1e-6;
    if (!Number.isFinite(value) || value < min || value > max || !onStep) found.add(`${id} ${rounded(value)}`);
  }
  return [...found].sort();
}

/**
 * What a new project's own flows write that its fields cannot hold: start-up,
 * selecting a waypoint, adding a crowd, and typing past each number field.
 */
const NEW_PROJECT_MISFITS = {
  'animation-speed-right 1445': "speedToSlider(ANIMATION.DEFAULT_SPEED) is off the field's 5-step grid " +
    '(1, 6, …, 1446), ' +
    'so a browser moves the thumb; the handler comment says it rounds to the step, but nothing does',
  'waypoint-pause-time 1.5': 'editorPanel.js writes the pause in seconds rather than slider units; ' +
    'a later write in the ' +
    'same selection puts 302 back (the three-writer order dependence of CON-01)',
  'export-frame-rate 5': "the field's change handler clamps to 1–60, not the field's 10–60, so 5 fps is kept " +
    "(CON-14's frame rate ×4)"
};

/**
 * A project whose values sit at the limits load accepts, on the fixture that
 * leaves nothing at its default. Limits the loader does not export are the
 * literals it checks (persistence.js); if one shrinks, the load fails here.
 */
function limitsProject() {
  const project = authoredExtrasProject();
  const [first] = project.waypoints;
  Object.assign(first, {
    pauseMode: 'timed',
    pauseTime: PROJECT_MODEL_LIMITS.MAX_WAYPOINT_PAUSE_MS,
    dotSize: 100,
    rippleThickness: 100,
    rippleMaxScale: 10000,
    pulseAmplitude: 100,
    pulseCycleSpeed: 600,
    shapeAmplitude: 100,
    labelSize: 500,
    labelWidth: 100,
    labelOffsetX: 1000,
    labelOffsetY: -1000,
    camera: { ...first.camera, zoom: 64 },
    // Between the fade fields' 100 ms steps: load does not ask for a step.
    areaHighlight: { ...first.areaHighlight, fadeInMs: 1250, fadeOutMs: 1750 }
  });
  // Load asks only that the trail is finite; this is 640 path lengths.
  project.motionSettings.pathTrail = 640;
  Object.assign(project.exportSettings, {
    resolutionX: PROJECT_MODEL_LIMITS.MAX_EXPORT_DIMENSION,
    resolutionY: PROJECT_MODEL_LIMITS.MAX_EXPORT_DIMENSION,
    frameRate: PROJECT_MODEL_LIMITS.MAX_FRAME_RATE,
    backgroundZoom: 1000
  });
  project.styles.graphicsScale = 16;
  project.animationState.speed = PROJECT_MODEL_LIMITS.MAX_ANIMATION_SPEED;
  Object.assign(project.scene.flowLayers[0].emitters[0], {
    dotSize: EMITTER_LIMITS.MAX_DOT_SIZE,
    dotCount: EMITTER_LIMITS.MAX_DOT_COUNT,
    speed: EMITTER_LIMITS.MAX_SPEED
  });
  return project;
}

/**
 * What loading `limitsProject` and selecting its first waypoint, its crowd
 * and its next major waypoint writes that the fields cannot hold. Most are
 * values load accepts beyond the field's reach: a browser pins the thumb to
 * the field's end while the readout, written from the model, says otherwise,
 * and the first touch of the slider cuts the value to the field's range.
 * CON-14 decided the UI range is the authoritative one. The rest fall between
 * a field's steps, or are written in another unit, as each says.
 */
const LIMIT_MISFITS = {
  'animation-speed-right 1445': 'not written by the load: it never syncs this slider, because it guards ' +
    'on the missing ' +
    '#animation-speed (DEF-20), so a 10,000 px/s project keeps start-up\'s off-step 1445',
  'area-fade-in 1250': "between the field's 100 ms steps; a browser moves the thumb to 1,300",
  'area-fade-out 1750': "between the field's 100 ms steps; a browser moves the thumb to 1,800",
  'background-zoom 1000': 'load accepts up to 1,000%; the field stops at 400%',
  'camera-zoom 1.5': 'load accepts a camera zoom up to 64×, which is 1.5 on a slider that maps 0–1 to ' +
    "CAMERA_DEFAULTS' 1–16× (CON-14's zoom 16/64)",
  'camera-selected-zoom 1.5': 'as camera-zoom',
  'camera-zoom 0.2409': "the next major waypoint's 1.95× is 0.2409 on the slider, whose 0.01 steps give 1.945× " +
    'or 2×: a browser moves the thumb to 0.24 while the readout, from the model, says 1.95×',
  'camera-selected-zoom 0.2409': 'as camera-zoom 0.2409',
  'crowd-count 5000': 'EMITTER_LIMITS.MAX_DOT_COUNT; the slider stops at 500',
  'crowd-dot-size 10000': 'EMITTER_LIMITS.MAX_DOT_SIZE (100×) is 10,000 on a slider that stops at 200 (2×)',
  'crowd-speed 100000': 'EMITTER_LIMITS.MAX_SPEED (1,000 img/s) is 100,000 on a slider that stops at 100 (1 img/s)',
  'dot-size 100': 'load accepts markers up to 100 px; the slider stops at 16',
  'export-frame-rate 120': 'PROJECT_MODEL_LIMITS.MAX_FRAME_RATE; the field stops at 60',
  'export-res-x 16384': 'PROJECT_MODEL_LIMITS.MAX_EXPORT_DIMENSION; the field stops at 7,680',
  'export-res-y 16384': 'PROJECT_MODEL_LIMITS.MAX_EXPORT_DIMENSION; the field stops at 4,320',
  'graphics-scale 400': 'load accepts a Graphics scale up to 16×, which is 400; the slider stops at 200 (4×)',
  'label-offset-x 1000': 'load accepts ±1,000%; the slider stops at TEXT_LABEL.OFFSET_MAX (50)',
  'label-offset-y -1000': 'load accepts ±1,000%; the slider stops at TEXT_LABEL.OFFSET_MIN (−50)',
  'label-width 100': 'load accepts up to 100%; the slider stops at TEXT_LABEL.WIDTH_MAX (50)',
  'path-trail 2763': 'load accepts any finite trail; 640 path lengths is 2,763 on a slider that stops at ' +
    'MOTION.PATH_TRAIL_MAX (4 path lengths)',
  'pulse-amplitude 100': 'load accepts up to 100; the slider stops at 3',
  'pulse-cycle-speed 600': 'load accepts up to 600 s; the slider stops at 10',
  'ripple-max-scale 10000': 'load accepts up to 10,000%; the slider stops at 4,000',
  'ripple-thickness 100': 'load accepts up to 100 px; the slider stops at 10',
  'shape-amplitude 100': 'load accepts up to 100; the slider stops at 50',
  'waypoint-pause-time 2.75': "as on a new project: editorPanel.js writes the next major waypoint's 2,750 ms " +
    'pause in seconds rather than slider units, and a later write in the same selection puts 384 back (CON-01)',
  'waypoint-pause-time 3314': 'PROJECT_MODEL_LIMITS.MAX_WAYPOINT_PAUSE_MS (600 s) is 3,314 on the 0–30 s slider ' +
    '(Joe, 2026-09-28: the slider stays a fine control)'
};

describe('index.html ranges against the code (TST-13)', () => {

  test('every range and number field in index.html is paired with its code, or says why not', () => {
    const paired = new Set([...Object.keys(PAIRINGS), ...Object.keys(APP_DEFAULTS), ...Object.keys(NO_COUNTERPART)]);
    expect([...FIELDS.keys()].filter(id => !paired.has(id)), 'a new field needs a pairing').toEqual([]);
    expect([...paired].filter(id => !FIELDS.has(id)), 'a paired field has gone from index.html').toEqual([]);
    expect(FIELDS.size).toBe(52);
    const explained = [...Object.values(NO_COUNTERPART), ...Object.values(DISAGREEMENTS).map(({ why }) => why),
      ...Object.values(LOAD_LIMITS).map(({ why }) => why), ...Object.values(NEW_PROJECT_MISFITS),
      ...Object.values(LIMIT_MISFITS)];
    expect(explained.filter(why => !/\w/.test(why ?? '')), 'every pinned entry says why').toEqual([]);
  });

  test('each bound the code defines means what the field says, except the pinned disagreements', () => {
    const found = {};
    for (const [id, { toModel, min, max }] of Object.entries(PAIRINGS)) {
      for (const [name, pair] of [['min', min], ['max', max]]) {
        if (!pair) continue;
        const [code, source] = pair;
        const means = toModel(attribute(id, name));
        if (!close(means, code)) {
          found[`${id} ${name}`] = { html: attribute(id, name), means: rounded(means), code: rounded(code), source };
        }
      }
    }
    const pinned = Object.fromEntries(Object.entries(DISAGREEMENTS)
      .filter(([key]) => / (min|max)$/.test(key))
      .map(([key, { html, means, code, source }]) => [key, { html, means, code, source }]));
    expect(found, 'bounds where index.html and the code differ (a real one is pinned in DISAGREEMENTS, with why)')
      .toEqual(pinned);
  });

  test("each default the code defines is where the field's value puts the thumb, except the pinned ones", async () => {
    const app = await bootApp();
    running.push(app);
    await app.ready;

    const found = {};
    const check = (id, toModel, code, source) => {
      const html = attribute(id, 'value');
      const best = positionFor(id, toModel, code);
      if (Math.abs(toModel(html) - code) > best.distance + 1e-9) {
        found[`${id} value`] = {
          html, means: rounded(toModel(html)), code: rounded(code), source, codePosition: best.position
        };
      }
    };
    for (const [id, { toModel, value }] of Object.entries(PAIRINGS)) {
      if (value) check(id, toModel, value[0], value[1]);
    }
    for (const [id, { toModel, value }] of Object.entries(APP_DEFAULTS)) {
      check(id, toModel, value(app), 'the booted app');
    }
    const pinned = Object.fromEntries(Object.entries(DISAGREEMENTS)
      .filter(([key]) => / value$/.test(key))
      .map(([key, { html, means, code, source, codePosition }]) => [key, { html, means, code, source, codePosition }]));
    expect(found, 'defaults where index.html and the code differ (a real one is pinned in DISAGREEMENTS, with why)')
      .toEqual(pinned);
  });

  test('load accepts more than these fields reach, as CON-14 decided', () => {
    for (const [id, { toModel, load, html, means, why }] of Object.entries(LOAD_LIMITS)) {
      const max = attribute(id, 'max');
      expect({ html: max, means: rounded(toModel(max)) }, `${id}: ${why}`).toEqual({ html, means });
      expect(load, `${id}: load now stops where the field does`).toBeGreaterThan(means);
    }
  });

  test('on a new project, every value the app writes into a field fits it, except the pinned writes', async () => {
    const recorder = recordWrites();
    try {
      const app = await bootApp();
      running.push(app);
      await app.ready;
      document.getElementById('splash-close').click();
      await vi.waitFor(() => expect(app.background.image).toBeTruthy());
      app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
      app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
      // Selecting fills every waypoint card; adding a crowd fills the crowd card.
      app.eventBus.emit('waypoint:selected', app.waypoints[0]);
      document.getElementById('add-crowd-btn').click();
      // A user types past each number field's bounds; its change handler
      // writes back what it keeps.
      for (const [id, typedValue] of [
        ['export-frame-rate', 5], ['export-frame-rate', 200],
        ['export-res-x', 50], ['export-res-x', 20000], ['export-res-y', 50], ['export-res-y', 20000]
      ]) {
        const field = document.getElementById(id);
        recorder.asUser(() => { field.value = String(typedValue); });
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(recorder.writes.length, 'the fields were written (not a silent empty pass)').toBeGreaterThan(50);
      expect(misfits(recorder.writes), 'writes outside a field or off its step (NEW_PROJECT_MISFITS pins them)')
        .toEqual(Object.keys(NEW_PROJECT_MISFITS).sort());
    } finally {
      recorder.restore();
    }
  });

  test('a project at the limits load accepts, and a waypoint between them: the values its fields cannot hold (CON-14)', async () => {
    const project = limitsProject();
    const recorder = recordWrites();
    try {
      const app = await bootApp();
      running.push(app);
      await app.ready;
      document.getElementById('splash-close').click();
      expect(await loadSnapshot(app, project)).toBe(true);
      app.eventBus.emit('waypoint:selected', app.waypoints[0]);
      // The strip's first row is the route; the crowd's row carries its name.
      const crowd = project.scene.flowLayers[0].name;
      [...document.querySelectorAll('#layers-strip .layer-row')]
        .find(row => row.textContent.includes(crowd))
        .click();
      expect(app.selectedCrowd?.name).toBe(crowd);
      // The next major waypoint keeps the fixture's values, between the limits
      // and off any coarser grid (a 27 px label), so a step must hold them too.
      const between = app.waypoints.find((waypoint, index) => index > 0 && waypoint.isMajor);
      expect(between.labelSize).toBe(27);
      app.eventBus.emit('waypoint:selected', between);

      expect(misfits(recorder.writes), 'writes outside a field or off its step (LIMIT_MISFITS pins them)')
        .toEqual(Object.keys(LIMIT_MISFITS).sort());
    } finally {
      recorder.restore();
    }
  });
});
