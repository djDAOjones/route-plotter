import { ANIMATION, RENDERING, TEXT_LABEL, TEXT_VISIBILITY } from '../config/constants.js';
import { CAMERA_DEFAULTS } from '../services/CameraService.js';

export const WAYPOINT_CARD = Object.freeze({
  MARKER: 'marker',
  ON_ARRIVAL: 'on-arrival',
  LABEL: 'label',
  LEG: 'leg',
});

const DEFAULT_MARKER_ROTATION = 'fixed';
const COLOR_FIELDS = new Set([
  'dotColor', 'segmentColor', 'labelColor', 'labelBgColor',
]);

const cardGroups = Object.freeze({
  [WAYPOINT_CARD.MARKER]: [
    {
      majorsOnly: true,
      fields: [
        'customImage', 'customImageAssetId',
        'customImageRotation', 'customImageRotationOffset',
      ],
      whenTarget: waypoint => waypoint.markerStyle === 'custom',
      whenSource: waypoint => waypoint.markerStyle === 'custom',
      resetValues: () => ({
        customImage: null,
        customImageAssetId: null,
        customImageRotation: DEFAULT_MARKER_ROTATION,
        customImageRotationOffset: 0,
      }),
    },
    {
      majorsOnly: true,
      fields: ['markerStyle', 'dotColor', 'dotSize'],
      resetValues: styles => ({
        markerStyle: styles?.markerStyle || 'dot',
        dotColor: styles?.dotColor || RENDERING.DEFAULT_PATH_COLOR,
        dotSize: styles?.dotSize || RENDERING.DEFAULT_DOT_SIZE,
      }),
    },
  ],
  [WAYPOINT_CARD.ON_ARRIVAL]: [
    {
      majorsOnly: true,
      fields: [
        'beaconStyle', 'rippleThickness', 'rippleMaxScale', 'rippleWait',
        'pulseAmplitude', 'pulseCycleSpeed', 'pauseTime', 'pauseMode', 'camera',
      ],
      resetValues: styles => ({
        beaconStyle: styles?.beaconStyle || 'none',
        rippleThickness: 2,
        rippleMaxScale: 1000,
        rippleWait: true,
        pulseAmplitude: 1,
        pulseCycleSpeed: 4,
        pauseTime: ANIMATION.DEFAULT_WAIT_TIME,
        pauseMode: ANIMATION.DEFAULT_WAIT_TIME > 0 ? 'timed' : 'none',
        camera: {
          zoom: CAMERA_DEFAULTS.ZOOM,
          zoomMode: CAMERA_DEFAULTS.ZOOM_MODE,
        },
      }),
    },
  ],
  [WAYPOINT_CARD.LABEL]: [
    {
      majorsOnly: true,
      fields: [
        'labelMode', 'labelOffsetX', 'labelOffsetY', 'labelWidth', 'labelSize',
        'labelColor', 'labelBgColor', 'labelBgOpacity',
      ],
      resetValues: styles => ({
        labelMode: styles?.labelMode || TEXT_VISIBILITY.FADE_UP,
        labelOffsetX: TEXT_LABEL.OFFSET_DEFAULT_X,
        labelOffsetY: TEXT_LABEL.OFFSET_DEFAULT_Y,
        labelWidth: TEXT_LABEL.WIDTH_DEFAULT,
        labelSize: TEXT_LABEL.SIZE_DEFAULT,
        labelColor: TEXT_LABEL.COLOR_DEFAULT,
        labelBgColor: TEXT_LABEL.BG_COLOR_DEFAULT,
        labelBgOpacity: TEXT_LABEL.BG_OPACITY_DEFAULT,
      }),
    },
  ],
  [WAYPOINT_CARD.LEG]: [
    {
      majorsOnly: false,
      fields: [
        'segmentColor', 'segmentWidth', 'segmentStyle', 'pathShape',
        'shapeAmplitude', 'shapeFrequency',
      ],
      resetValues: styles => ({
        segmentColor: styles?.pathColor || RENDERING.DEFAULT_PATH_COLOR,
        segmentWidth: styles?.pathThickness || RENDERING.DEFAULT_PATH_THICKNESS,
        segmentStyle: styles?.pathStyle || 'solid',
        pathShape: styles?.pathShape || 'line',
        shapeAmplitude: 10,
        shapeFrequency: 5,
      }),
    },
    {
      majorsOnly: true,
      fields: ['segmentSpeed'],
      resetValues: () => ({ segmentSpeed: 1 }),
    },
  ],
});

export const WAYPOINT_CARD_EFFECTS = Object.freeze({
  [WAYPOINT_CARD.MARKER]: Object.freeze({ list: true }),
  [WAYPOINT_CARD.ON_ARRIVAL]: Object.freeze({ timing: true, beacons: true }),
  [WAYPOINT_CARD.LABEL]: Object.freeze({ list: true }),
  [WAYPOINT_CARD.LEG]: Object.freeze({ path: true, timing: true }),
});

function groupsFor(card) {
  const groups = cardGroups[card];
  if (!groups) throw new Error(`Unknown waypoint card: ${card}`);
  return groups;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function copyValue(value) {
  if (Array.isArray(value)) return value.map(copyValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyValue(child)]));
  }
  return value;
}

function valuesEqual(a, b, field = '') {
  if (Object.is(a, b)) return true;
  if (COLOR_FIELDS.has(field) && typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase();
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => valuesEqual(value, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length &&
      aKeys.every(key => Object.prototype.hasOwnProperty.call(b, key) && valuesEqual(a[key], b[key]));
  }
  return false;
}

function applyValues(target, values, fields, mutate) {
  let changed = false;
  for (const field of fields) {
    if (valuesEqual(target[field], values[field], field)) continue;
    changed = true;
    // Decoded image objects are shared runtime handles for one admitted asset;
    // serialisable card objects such as camera state must not alias.
    if (mutate) target[field] = field === 'customImage' ? values[field] : copyValue(values[field]);
  }
  return changed;
}

function uniqueWaypoints(waypoints) {
  return [...new Set((waypoints || []).filter(Boolean))];
}

function runReset(card, selection, styles, mutate) {
  const changed = new Set();
  const selected = uniqueWaypoints(selection);
  for (const group of groupsFor(card)) {
    const values = group.resetValues(styles);
    const applicable = group.majorsOnly ? selected.filter(wp => wp.isMajor !== false) : selected;
    const targets = group.whenTarget ? applicable.filter(group.whenTarget) : applicable;
    for (const target of targets) {
      if (applyValues(target, values, group.fields, mutate)) changed.add(target);
    }
  }
  return [...changed];
}

function runApplyOnward(card, waypoints, source, mutate) {
  if (!source) return [];
  const sourceIndex = waypoints.indexOf(source);
  if (sourceIndex < 0) return [];
  const later = waypoints.slice(sourceIndex + 1);
  const changed = new Set();
  for (const group of groupsFor(card)) {
    if (group.majorsOnly && source.isMajor === false) continue;
    if (group.whenSource && !group.whenSource(source)) continue;
    const values = Object.fromEntries(group.fields.map(field => [field, source[field]]));
    const targets = group.majorsOnly ? later.filter(wp => wp.isMajor !== false) : later;
    for (const target of targets) {
      if (applyValues(target, values, group.fields, mutate)) changed.add(target);
    }
  }
  return [...changed];
}

export function resetWaypointCard(card, selection, styles) {
  return {
    changedWaypoints: runReset(card, selection, styles, true),
    effects: WAYPOINT_CARD_EFFECTS[card],
  };
}

export function applyWaypointCardOnward(card, waypoints, source) {
  return {
    changedWaypoints: runApplyOnward(card, waypoints, source, true),
    effects: WAYPOINT_CARD_EFFECTS[card],
  };
}

export function getWaypointCardActionState({ card, waypoints, selection, source, styles }) {
  const selected = uniqueWaypoints(selection);
  const hasApplicableSelection = groupsFor(card).some(group => (
    group.majorsOnly ? selected.some(wp => wp.isMajor !== false) : selected.length > 0
  ));
  const resetChanges = hasApplicableSelection
    ? runReset(card, selected, styles, false)
    : [];

  let applyReason = '';
  let applyChanges = [];
  if (selected.length !== 1) {
    applyReason = selected.length > 1
      ? 'Select one waypoint to apply onward'
      : 'Select a waypoint to apply onward';
  } else if (!source || !waypoints.includes(source)) {
    applyReason = 'Select an applicable waypoint to apply onward';
  } else {
    applyChanges = runApplyOnward(card, waypoints, source, false);
    if (applyChanges.length === 0) {
      const later = waypoints.slice(waypoints.indexOf(source) + 1);
      const hasLaterApplicable = groupsFor(card).some(group => (
        (!group.majorsOnly || source.isMajor !== false) &&
        (group.majorsOnly ? later.some(wp => wp.isMajor !== false) : later.length > 0)
      ));
      applyReason = hasLaterApplicable
        ? 'Later waypoints already match'
        : 'No later applicable waypoint';
    }
  }

  return {
    canReset: resetChanges.length > 0,
    resetReason: hasApplicableSelection
      ? (resetChanges.length > 0 ? 'Reset this card to route style' : 'Already uses route style')
      : 'No applicable waypoint selected',
    canApplyOnward: applyChanges.length > 0,
    applyReason: applyChanges.length > 0 ? 'Apply this card to later waypoints' : applyReason,
  };
}
