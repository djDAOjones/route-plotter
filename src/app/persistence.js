/**
 * Project save/load, autosave/restore, and dirty-state title indicator.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, persistenceMixin).
 */
import {
  ANIMATION,
  BACKGROUND_VISIBILITY,
  MOTION,
  PATH_VISIBILITY,
  RENDERING,
  TEXT_VISIBILITY,
  VIDEO_EXPORT,
  WAYPOINT_VISIBILITY,
} from '../config/constants.js';
import { MotionVisibilityService } from '../services/MotionVisibilityService.js';
import { Waypoint } from '../models/Waypoint.js';
import { Scene } from '../models/Scene.js';
import { ImageAsset, IMAGE_LIMITS } from '../models/ImageAsset.js';
import { PROJECT_ARCHIVE_LIMITS } from '../services/ImageAssetService.js';
import { STORAGE_LIMITS } from '../services/StorageService.js';
import {
  advanceEditRevision,
  beginAsyncProjectOperation,
  isAsyncProjectOperationCurrent,
} from './operationGeneration.js';
import { assertSafeStoredColor } from '../utils/safeColor.js';
import { assertPersistedEntityId, ENTITY_ID_LIMITS } from '../utils/entityId.js';
import { formatBackgroundOverlay, setRangeReadout } from '../utils/uiReadouts.js';
import { resolveRenderReference } from '../utils/renderReference.js';
import { resolvePathHeadImage } from '../utils/pathHeadPresets.js';
import { buildExampleProjects } from '../examples/index.js';

export const PROJECT_MODEL_LIMITS = Object.freeze({
  MAX_ENTITY_ID_LENGTH: ENTITY_ID_LIMITS.MAX_LENGTH,
  MAX_WAYPOINTS: 2000,
  MAX_AREA_POINTS_PER_WAYPOINT: 256,
  MAX_AREA_POINTS_TOTAL: 10000,
  MAX_TREE_DEPTH: 64,
  MAX_TREE_NODES: 100000,
  MAX_STRING_LENGTH: 100000,
  MAX_STRING_BYTES_TOTAL: 2 * 1024 * 1024,
  MAX_EXPORT_DIMENSION: 16384,
  MAX_FRAME_RATE: 120,
  MAX_ANIMATION_DURATION_MS: 24 * 60 * 60 * 1000,
  MAX_ANIMATION_SPEED: 10000,
  MAX_WAYPOINT_PAUSE_MS: 10 * 60 * 1000,
  MAX_TOTAL_PAUSE_MS: 24 * 60 * 60 * 1000,
});

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const CANONICAL_PROJECT_DEFAULTS = Object.freeze({
  styles: Object.freeze({
    pathColor: RENDERING.DEFAULT_PATH_COLOR,
    pathThickness: RENDERING.DEFAULT_PATH_THICKNESS,
    pathStyle: 'solid',
    pathShape: 'line',
    markerStyle: 'dot',
    dotColor: RENDERING.DEFAULT_PATH_COLOR,
    dotSize: RENDERING.DEFAULT_DOT_SIZE,
    beaconStyle: 'none',
    labelMode: TEXT_VISIBILITY.FADE_UP,
    graphicsScale: 1,
    showPathCasing: true,
  }),
  pathHead: Object.freeze({
    style: 'arrow',
    color: '#111111',
    size: RENDERING.PATH_HEAD_SIZE,
    image: null,
    imageAssetId: null,
    rotationMode: 'auto',
    rotationOffset: 0,
  }),
  pathGlow: Object.freeze({ enabled: false, intensity: RENDERING.PATH_GLOW_DEFAULT_INTENSITY }),
  exportSettings: Object.freeze({
    frameRate: VIDEO_EXPORT.DEFAULT_FRAME_RATE,
    format: 'mp4',
    pathOnly: false,
    resolutionX: 1920,
    resolutionY: 1080,
    backgroundZoom: 100,
    includeCamera: true,
    includeText: true,
  }),
  motionSettings: Object.freeze({
    pathVisibility: PATH_VISIBILITY.SHOW_ON_PROGRESSION,
    pathTrail: MOTION.PATH_TRAIL_DEFAULT,
    waypointVisibility: WAYPOINT_VISIBILITY.HIDE_BEFORE,
    backgroundVisibility: BACKGROUND_VISIBILITY.ALWAYS_SHOW,
    revealSize: MOTION.SPOTLIGHT_SIZE_DEFAULT,
    revealFeather: MOTION.SPOTLIGHT_FEATHER_DEFAULT,
    aovAngle: MOTION.AOV_ANGLE_DEFAULT,
    aovDistance: MOTION.AOV_DISTANCE_DEFAULT,
    aovDropoff: MOTION.AOV_DROPOFF_DEFAULT,
  }),
});

function assertSafeProjectTree(root) {
  const stack = [{ value: root, depth: 0 }];
  const visited = new WeakSet();
  let nodeCount = 0;
  let stringBytes = 0;

  while (stack.length > 0) {
    const { value, depth } = stack.pop();
    nodeCount += 1;
    if (nodeCount > PROJECT_MODEL_LIMITS.MAX_TREE_NODES || depth > PROJECT_MODEL_LIMITS.MAX_TREE_DEPTH) {
      throw new Error('Project metadata is too deeply nested or complex');
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('Project contains a non-finite numeric value');
    }
    if (typeof value === 'string') {
      if (value.length > PROJECT_MODEL_LIMITS.MAX_STRING_LENGTH) {
        throw new Error('Project contains an oversized text value');
      }
      stringBytes += new TextEncoder().encode(value).length;
      if (stringBytes > PROJECT_MODEL_LIMITS.MAX_STRING_BYTES_TOTAL) {
        throw new Error('Project text exceeds the 2 MB limit');
      }
      continue;
    }
    if (value == null || typeof value === 'boolean' || typeof value === 'number') continue;
    if (typeof value !== 'object') {
      throw new Error('Project contains an unsupported value type');
    }
    if (visited.has(value)) throw new Error('Project metadata contains a cycle');
    visited.add(value);

    const keys = Object.keys(value);
    for (const key of keys) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        throw new Error(`Project contains a forbidden object key: ${key}`);
      }
      stack.push({ value: value[key], depth: depth + 1 });
    }
  }
}

/**
 * Validate project metadata without charging separately bounded bitmap payloads
 * against the text-field budget. Older recovery records stored original image
 * data URLs inline; those bytes are still validated by ImageAsset's MIME,
 * signature, byte and pixel limits before they can enter live state.
 *
 * @param {Object} projectData
 */
function assertSafeProjectEnvelope(projectData) {
  const metadata = { ...projectData };
  if (typeof metadata.backgroundImage === 'string') {
    metadata.backgroundImage = null;
  }
  if (Array.isArray(metadata.imageAssets)) {
    metadata.imageAssets = metadata.imageAssets.map(asset => {
      if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return asset;
      return typeof asset.base64 === 'string' ? { ...asset, base64: null } : asset;
    });
  }
  assertSafeProjectTree(metadata);
}

function safeClone(value) {
  if (value == null) return value;
  assertSafeProjectTree(value);
  return JSON.parse(JSON.stringify(value));
}

function stageWaypoints(data) {
  const waypointData = data ?? [];
  if (!Array.isArray(waypointData)) throw new Error('Invalid project waypoints');
  if (waypointData.length > PROJECT_MODEL_LIMITS.MAX_WAYPOINTS) {
    throw new Error(`Project waypoint limit is ${PROJECT_MODEL_LIMITS.MAX_WAYPOINTS}`);
  }

  const ids = new Set();
  let areaPointCount = 0;
  let totalPauseMs = 0;
  return waypointData.map((serialized, index) => {
    if (!Waypoint.validate(serialized)) {
      throw new Error(`Invalid waypoint at index ${index}`);
    }
    if (serialized.id != null) {
      assertPersistedEntityId(serialized.id, `waypoint id at index ${index}`);
      if (ids.has(serialized.id)) throw new Error(`Duplicate waypoint id at index ${index}`);
      ids.add(serialized.id);
    }
    for (const field of ['segmentColor', 'dotColor']) {
      assertSafeStoredColor(serialized[field], `waypoint ${field} at index ${index}`, {
        allowTransparent: true,
      });
    }
    for (const field of ['labelColor', 'labelBgColor']) {
      assertSafeStoredColor(serialized[field], `waypoint ${field} at index ${index}`);
    }
    assertSafeStoredColor(
      serialized.areaHighlight?.fillColor,
      `waypoint area fillColor at index ${index}`,
      { allowTransparent: true }
    );
    assertSafeStoredColor(
      serialized.areaHighlight?.borderColor,
      `waypoint area borderColor at index ${index}`,
      { allowTransparent: true }
    );
    const numericFields = [
      'segmentWidth', 'segmentSpeed', 'shapeAmplitude', 'shapeFrequency',
      'dotSize', 'rippleThickness', 'rippleMaxScale', 'pulseAmplitude',
      'pulseCycleSpeed', 'labelOffsetX', 'labelOffsetY', 'labelWidth',
      'labelSize', 'labelBgOpacity', 'pauseTime', 'customImageRotationOffset',
      'created', 'modified',
    ];
    for (const field of numericFields) {
      if (field in serialized && !Number.isFinite(Number(serialized[field]))) {
        throw new Error(`Invalid waypoint ${field} at index ${index}`);
      }
    }
    const boundedFields = {
      segmentWidth: [0, 100], segmentSpeed: [0.1, 10],
      shapeAmplitude: [0, 100], shapeFrequency: [1, 20], dotSize: [0, 100],
      rippleThickness: [0, 100], rippleMaxScale: [0, 10000],
      pulseAmplitude: [0, 100], pulseCycleSpeed: [0.01, 600],
      labelOffsetX: [-1000, 1000], labelOffsetY: [-1000, 1000],
      labelWidth: [0, 100], labelSize: [1, 500], labelBgOpacity: [0, 1],
      pauseTime: [0, PROJECT_MODEL_LIMITS.MAX_WAYPOINT_PAUSE_MS],
      customImageRotationOffset: [-1000000, 1000000],
    };
    for (const [field, [minimum, maximum]] of Object.entries(boundedFields)) {
      if (field in serialized && (Number(serialized[field]) < minimum || Number(serialized[field]) > maximum)) {
        throw new Error(`Waypoint ${field} is outside the supported range at index ${index}`);
      }
    }
    totalPauseMs += Number(serialized.pauseTime ?? 0);
    if (totalPauseMs > PROJECT_MODEL_LIMITS.MAX_TOTAL_PAUSE_MS) {
      throw new Error(`Project pause-time budget is ${PROJECT_MODEL_LIMITS.MAX_TOTAL_PAUSE_MS} ms`);
    }
    if (serialized.camera) {
      if ('zoom' in serialized.camera && !Number.isFinite(Number(serialized.camera.zoom))) {
        throw new Error(`Invalid waypoint camera zoom at index ${index}`);
      }
      if ('zoom' in serialized.camera &&
          (Number(serialized.camera.zoom) < 1 || Number(serialized.camera.zoom) > 64)) {
        throw new Error(`Waypoint camera zoom is outside the supported range at index ${index}`);
      }
    }
    if (serialized.areaHighlight) {
      for (const field of ['centerX', 'centerY', 'radius', 'width', 'height', 'fillOpacity',
        'borderWidth', 'fadeInMs', 'fadeOutMs']) {
        if (field in serialized.areaHighlight && !Number.isFinite(Number(serialized.areaHighlight[field]))) {
          throw new Error(`Invalid waypoint area ${field} at index ${index}`);
        }
      }
      for (const field of ['centerX', 'centerY', 'fillOpacity']) {
        if (field in serialized.areaHighlight &&
            (Number(serialized.areaHighlight[field]) < 0 || Number(serialized.areaHighlight[field]) > 1)) {
          throw new Error(`Waypoint area ${field} is outside the supported range at index ${index}`);
        }
      }
      for (const field of ['radius', 'width', 'height']) {
        if (field in serialized.areaHighlight &&
            (Number(serialized.areaHighlight[field]) < 0 || Number(serialized.areaHighlight[field]) > 2)) {
          throw new Error(`Waypoint area ${field} is outside the supported range at index ${index}`);
        }
      }
      for (const field of ['fadeInMs', 'fadeOutMs']) {
        if (field in serialized.areaHighlight &&
            (Number(serialized.areaHighlight[field]) < 0 || Number(serialized.areaHighlight[field]) > 600000)) {
          throw new Error(`Waypoint area ${field} is outside the supported range at index ${index}`);
        }
      }
    }
    const points = serialized.areaHighlight?.points ?? [];
    if (!Array.isArray(points) || points.length > PROJECT_MODEL_LIMITS.MAX_AREA_POINTS_PER_WAYPOINT) {
      throw new Error(`Waypoint polygon-point limit is ${PROJECT_MODEL_LIMITS.MAX_AREA_POINTS_PER_WAYPOINT}`);
    }
    areaPointCount += points.length;
    if (areaPointCount > PROJECT_MODEL_LIMITS.MAX_AREA_POINTS_TOTAL) {
      throw new Error(`Project polygon-point limit is ${PROJECT_MODEL_LIMITS.MAX_AREA_POINTS_TOTAL}`);
    }
    for (const point of points) {
      if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y)) ||
          Number(point.x) < 0 || Number(point.x) > 1 || Number(point.y) < 0 || Number(point.y) > 1) {
        throw new Error(`Invalid waypoint polygon point at index ${index}`);
      }
    }
    const normalized = { ...serialized, customImage: null };
    for (const field of numericFields) {
      if (field in normalized) normalized[field] = Number(normalized[field]);
    }
    if (serialized.camera) {
      normalized.camera = { ...serialized.camera };
      if ('zoom' in normalized.camera) normalized.camera.zoom = Number(normalized.camera.zoom);
    }
    if (serialized.areaHighlight) {
      normalized.areaHighlight = { ...serialized.areaHighlight };
      for (const field of ['centerX', 'centerY', 'radius', 'width', 'height', 'fillOpacity',
        'borderWidth', 'fadeInMs', 'fadeOutMs']) {
        if (field in normalized.areaHighlight) normalized.areaHighlight[field] = Number(normalized.areaHighlight[field]);
      }
      normalized.areaHighlight.points = points.map(point => ({ x: Number(point.x), y: Number(point.y) }));
    }
    // Serialized projects may carry the historical `customImage: null` field,
    // but live image objects are hydrated exclusively from validated assets.
    return Waypoint.fromJSON(normalized);
  });
}

function assertProjectSettings(data) {
  const assertFiniteFields = (object, fields, label) => {
    if (object == null) return;
    if (typeof object !== 'object' || Array.isArray(object)) throw new Error(`Invalid ${label}`);
    for (const field of fields) {
      if (field in object && !Number.isFinite(Number(object[field]))) {
        throw new Error(`Invalid ${label} ${field}`);
      }
    }
  };
  const exportSettings = data.exportSettings ?? {};
  for (const field of ['resolutionX', 'resolutionY']) {
    if (field in exportSettings && (!Number.isFinite(Number(exportSettings[field])) ||
        Number(exportSettings[field]) < 1 || Number(exportSettings[field]) > PROJECT_MODEL_LIMITS.MAX_EXPORT_DIMENSION)) {
      throw new Error(`Invalid export ${field}`);
    }
  }
  if ('frameRate' in exportSettings && (!Number.isFinite(Number(exportSettings.frameRate)) ||
      Number(exportSettings.frameRate) < 1 || Number(exportSettings.frameRate) > PROJECT_MODEL_LIMITS.MAX_FRAME_RATE)) {
    throw new Error('Invalid export frame rate');
  }
  if ('backgroundZoom' in exportSettings && (!Number.isFinite(Number(exportSettings.backgroundZoom)) ||
      Number(exportSettings.backgroundZoom) <= 0 || Number(exportSettings.backgroundZoom) > 1000)) {
    throw new Error('Invalid background zoom');
  }
  const animation = data.animationState ?? {};
  if ('mode' in animation && !['constant-speed', 'constant-time'].includes(animation.mode)) {
    throw new Error('Invalid animation mode');
  }
  if ('speed' in animation && (!Number.isFinite(Number(animation.speed)) || Number(animation.speed) <= 0 ||
      Number(animation.speed) > PROJECT_MODEL_LIMITS.MAX_ANIMATION_SPEED)) {
    throw new Error('Invalid animation speed');
  }
  if ('duration' in animation && (!Number.isFinite(Number(animation.duration)) || Number(animation.duration) < 0 ||
      Number(animation.duration) > PROJECT_MODEL_LIMITS.MAX_ANIMATION_DURATION_MS)) {
    throw new Error('Invalid animation duration');
  }
  assertFiniteFields(data.background, ['overlay'], 'background');
  if (data.background && (Number(data.background.overlay ?? 0) < -100 ||
      Number(data.background.overlay ?? 0) > 100)) {
    throw new Error('Invalid background overlay');
  }
  assertFiniteFields(data.styles, ['pathThickness', 'dotSize', 'graphicsScale'], 'style');
  assertFiniteFields(data.styles?.pathHead, ['size', 'rotationOffset'], 'path-head style');
  assertFiniteFields(data.styles?.pathGlow, ['intensity'], 'path-glow style');
  assertSafeStoredColor(data.styles?.pathColor, 'style pathColor');
  assertSafeStoredColor(data.styles?.dotColor, 'style dotColor');
  assertSafeStoredColor(data.styles?.pathHead?.color, 'path-head colour');
  if (data.styles?.graphicsScale != null &&
      (Number(data.styles.graphicsScale) <= 0 || Number(data.styles.graphicsScale) > 16)) {
    throw new Error('Invalid graphics scale');
  }
  assertFiniteFields(data.motionSettings, [
    'pathTrail', 'revealSize', 'revealFeather', 'aovAngle', 'aovDistance', 'aovDropoff'
  ], 'motion setting');

  for (const [value, label] of [
    [data.renderReference, 'render reference'],
    [data.timingReference, 'timing reference'],
  ]) {
    if (value == null) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Invalid ${label}`);
    }
    const width = Number(value.width);
    const height = Number(value.height);
    if (!Number.isFinite(width) || width <= 0 || width > PROJECT_MODEL_LIMITS.MAX_EXPORT_DIMENSION ||
        !Number.isFinite(height) || height <= 0 || height > PROJECT_MODEL_LIMITS.MAX_EXPORT_DIMENSION) {
      throw new Error(`Invalid ${label}`);
    }
  }
}

async function stageProject(app, projectData, { backgroundBase64 = null, imageAssets = null } = {}) {
  if (!projectData || typeof projectData !== 'object' || Array.isArray(projectData)) {
    throw new Error('Invalid project data');
  }
  assertSafeProjectEnvelope(projectData);
  assertProjectSettings(projectData);

  const waypoints = stageWaypoints(projectData.waypoints);
  const scene = Scene.fromJSON(projectData.scene || {});
  let stagedAssets = imageAssets;
  if (stagedAssets == null) {
    const serializedAssets = projectData.imageAssets ?? [];
    if (!Array.isArray(serializedAssets)) throw new Error('Invalid image asset collection');
    if (serializedAssets.length > 0 && typeof app.imageAssetService.stageFromJSON !== 'function') {
      throw new Error('Image asset staging is unavailable');
    }
    stagedAssets = serializedAssets.length > 0
      ? await app.imageAssetService.stageFromJSON(serializedAssets)
      : [];
  }
  if (!Array.isArray(stagedAssets)) throw new Error('Invalid staged image assets');
  if (stagedAssets.length > PROJECT_ARCHIVE_LIMITS.MAX_ASSETS) {
    throw new Error(`Project image-asset limit is ${PROJECT_ARCHIVE_LIMITS.MAX_ASSETS}`);
  }
  let stagedAssetBytes = 0;
  let stagedAssetPixels = 0;
  for (const asset of stagedAssets) {
    if (!(asset instanceof ImageAsset)) throw new Error('Invalid staged image asset');
    stagedAssetBytes += ImageAsset.assertValidSerialized(asset).byteLength;
    stagedAssetPixels += asset.width * asset.height;
  }
  if (stagedAssetBytes > PROJECT_ARCHIVE_LIMITS.MAX_ASSET_BYTES_TOTAL) {
    throw new Error('Project image assets exceed the 40 MB total limit');
  }
  if (stagedAssetPixels > PROJECT_ARCHIVE_LIMITS.MAX_IMAGE_PIXELS_TOTAL) {
    throw new Error('Project image assets exceed the decoded pixel budget');
  }
  const assetsById = new Map(stagedAssets.map(asset => [asset.id, asset]));
  if (assetsById.size !== stagedAssets.length) throw new Error('Duplicate image asset id');

  for (const waypoint of waypoints) {
    if (!waypoint.customImageAssetId) continue;
    const asset = assetsById.get(waypoint.customImageAssetId);
    if (!asset) throw new Error(`Missing custom image for waypoint ${waypoint.id}`);
    waypoint.customImage = await asset.getImageElement();
  }

  const stylesData = safeClone(projectData.styles || {});
  const styles = {
    ...CANONICAL_PROJECT_DEFAULTS.styles,
    ...stylesData,
    pathHead: {
      ...CANONICAL_PROJECT_DEFAULTS.pathHead,
      ...(stylesData?.pathHead || {}),
      image: null,
    },
    pathGlow: {
      ...CANONICAL_PROJECT_DEFAULTS.pathGlow,
      ...(stylesData?.pathGlow || {}),
    },
  };
  for (const field of ['pathThickness', 'dotSize', 'graphicsScale']) {
    if (field in stylesData) styles[field] = Number(stylesData[field]);
  }
  for (const field of ['size', 'rotationOffset']) {
    if (field in (stylesData.pathHead || {})) styles.pathHead[field] = Number(stylesData.pathHead[field]);
  }
  if (stylesData.pathGlow && 'intensity' in stylesData.pathGlow) {
    styles.pathGlow = { ...styles.pathGlow, intensity: Number(stylesData.pathGlow.intensity) };
  }
  const headAssetId = styles.pathHead.imageAssetId;
  if (headAssetId && !assetsById.has(headAssetId)) {
    throw new Error('Missing custom path-head image');
  }
  styles.pathHead.image = await resolvePathHeadImage(styles.pathHead, assetId => {
    const asset = assetsById.get(assetId);
    if (!asset) throw new Error('Missing custom path-head image');
    return asset.getImageElement();
  });

  let backgroundImage = null;
  const backgroundDataURL = backgroundBase64 || projectData.backgroundImage || null;
  if (backgroundDataURL) {
    backgroundImage = await ImageAsset.decodeDataURL(backgroundDataURL, 'project background');
  }

  const exportSettingsData = safeClone(projectData.exportSettings || {});
  for (const field of ['frameRate', 'resolutionX', 'resolutionY', 'backgroundZoom']) {
    if (field in exportSettingsData) exportSettingsData[field] = Number(exportSettingsData[field]);
  }
  const motionSettingsData = safeClone(projectData.motionSettings || {});
  for (const field of ['pathTrail', 'revealSize', 'revealFeather', 'aovAngle', 'aovDistance', 'aovDropoff']) {
    if (field in motionSettingsData) motionSettingsData[field] = Number(motionSettingsData[field]);
  }

  const exportSettings = { ...CANONICAL_PROJECT_DEFAULTS.exportSettings, ...exportSettingsData };
  const renderReference = resolveRenderReference(
    projectData.renderReference,
    projectData.timingReference,
    { width: app.displayWidth, height: app.displayHeight },
    { width: exportSettings.resolutionX, height: exportSettings.resolutionY }
  );

  return {
    waypoints,
    scene,
    assets: stagedAssets,
    styles,
    background: {
      image: backgroundImage,
      overlay: Number(projectData.background?.overlay ?? 0),
      fit: projectData.background?.fit === 'fill' ? 'fill' : 'fit',
    },
    exportSettings,
    renderReference,
    motionSettings: { ...CANONICAL_PROJECT_DEFAULTS.motionSettings, ...motionSettingsData },
    animationState: {
      mode: projectData.animationState?.mode || 'constant-speed',
      speed: Number(projectData.animationState?.speed ?? ANIMATION.DEFAULT_SPEED),
      duration: Number(projectData.animationState?.duration ?? 0),
    },
  };
}

function getUndoBaseline(staged) {
  return {
    waypoints: staged.waypoints.map(waypoint => waypoint.toJSON()),
    selectedWaypointId: null,
    selectedWaypointIds: [],
    styles: {
      ...staged.styles,
      pathHead: staged.styles.pathHead ? { ...staged.styles.pathHead, image: null } : undefined,
    },
    scene: staged.scene.toJSON(),
  };
}

/**
 * Return the exact validated bytes that produced the live background image.
 *
 * The historical `_autosaveBackgroundCache` field is actually a short-lived
 * source-byte cache. It must never be populated by drawing the image to a
 * canvas: ZIP and HTML exports preserve the user's PNG/JPEG/WebP bytes, while
 * browser recovery deliberately excludes them.
 *
 * @param {Object} app
 * @param {string} [action]
 * @returns {string|null}
 */
export function getRetainedBackgroundDataURL(app, action = 'exporting') {
  const image = app.background?.image;
  if (!image) return null;

  const retained = app._autosaveBackgroundCache;
  const unavailableMessage =
    `Original background bytes are unavailable. Reload the PNG, JPEG, or WebP background before ${action}.`;
  if (retained?.image !== image || typeof retained.dataURL !== 'string') {
    throw new Error(unavailableMessage);
  }

  try {
    const metadata = ImageAsset.inspectDataURL(retained.dataURL);
    ImageAsset.assertValidSerialized({
      id: 'background',
      name: 'background',
      base64: retained.dataURL,
      width: Number(image.naturalWidth || image.width),
      height: Number(image.naturalHeight || image.height),
      mimeType: metadata.mimeType,
      size: metadata.byteLength,
    }, { maxBytes: PROJECT_ARCHIVE_LIMITS.MAX_BACKGROUND_BYTES });
  } catch (error) {
    console.error('Retained background source bytes are invalid:', error);
    throw new Error(unavailableMessage);
  }
  return retained.dataURL;
}

function getSerializedByteLength(value) {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') throw new Error('Autosave snapshot is not serializable');
  return new TextEncoder().encode(serialized).length;
}

function stripAssetReferences(modelSnapshot) {
  return {
    ...modelSnapshot,
    waypoints: modelSnapshot.waypoints.map(waypoint => ({
      ...waypoint,
      customImage: null,
      customImageAssetId: null,
      markerStyle: waypoint.markerStyle === 'custom' ? 'dot' : waypoint.markerStyle,
    })),
    styles: {
      ...modelSnapshot.styles,
      pathHead: modelSnapshot.styles?.pathHead
        ? {
            ...modelSnapshot.styles.pathHead,
            style: modelSnapshot.styles.pathHead.style === 'custom' ? 'arrow' : modelSnapshot.styles.pathHead.style,
            image: null,
            imageAssetId: null,
          }
        : modelSnapshot.styles?.pathHead,
    },
  };
}

/**
 * Build a privacy-bounded browser recovery snapshot. Recovery keeps the route
 * model but never original bitmap bytes, original image filenames, or custom
 * image references that cannot be hydrated without those bytes.
 */
function prepareAutosaveSnapshot(app) {
  const hasAssets = app.imageAssetService?.getAssetCount?.() > 0;
  const hasBackground = Boolean(app.background?.image);
  try {
    const modelSnapshot = app._buildProjectSnapshot({ includeAssets: false });
    const snapshot = {
      ...stripAssetReferences(modelSnapshot),
      imageAssets: [],
    };
    if (getSerializedByteLength(snapshot) > STORAGE_LIMITS.AUTOSAVE_SERIALIZED_MAX) {
      throw new Error('Project model exceeds the autosave storage limit');
    }
    return {
      snapshot,
      error: null,
      omittedAssets: hasAssets,
      omittedBackground: hasBackground,
    };
  } catch (error) {
    return {
      snapshot: null,
      error,
      omittedAssets: hasAssets,
      omittedBackground: hasBackground,
    };
  }
}

function reportAutosaveOmissions(app, { omittedAssets, omittedBackground }) {
  const newlyOmittedAssets = omittedAssets && !app._autosaveAssetWarningShown;
  const newlyOmittedBackground = omittedBackground && !app._autosaveBackgroundWarningShown;
  app._autosaveAssetWarningShown = omittedAssets;
  app._autosaveBackgroundWarningShown = omittedBackground;

  if (newlyOmittedAssets && newlyOmittedBackground) {
    app.announce('Browser recovery excludes the background and custom images. Save a project file to preserve them.');
  } else if (newlyOmittedAssets) {
    app.announce('Browser recovery excludes custom images. Save a project file to preserve them.');
  } else if (newlyOmittedBackground) {
    app.announce('Browser recovery excludes the background. Save a project file to preserve it.');
  }
}

function replaceImmediateRecovery(app) {
  if (!app.storageService.saveAutoSave) return { attempted: false, saved: false };

  const prepared = prepareAutosaveSnapshot(app);
  reportAutosaveOmissions(app, prepared);
  if (prepared.error) console.warn('Browser recovery snapshot could not be prepared:', prepared.error);

  let saved = false;
  if (prepared.snapshot) {
    try {
      saved = app.storageService.saveAutoSave(prepared.snapshot);
    } catch (error) {
      console.error('Failed to write browser recovery:', error);
    }
  }
  if (!saved) app.storageService.clearAutoSave?.();
  return { attempted: true, saved };
}

function reportAutosaveFailure(app) {
  if (app._autosaveFailureWarningShown) return;
  app._autosaveFailureWarningShown = true;
  app.announce('Auto-save failed. Save a project file to keep your work.');
}

function captureLiveState(app) {
  const animationState = app.animationEngine.state;
  return {
    waypoints: app.waypoints,
    waypointMap: new Map(app.waypointsById || []),
    sceneLayers: app.scene.flowLayers,
    assets: app.imageAssetService.getAssets?.() || null,
    styles: app.styles,
    background: { ...app.background },
    exportSettings: { ...app.exportSettings },
    motionSettings: { ...app.motionSettings },
    renderReference: app.renderReference ? { ...app.renderReference } : null,
    selectedWaypoint: app.selectedWaypoint,
    selectedWaypoints: app.selectedWaypoints,
    selectedCrowd: app.selectedCrowd,
    pathPoints: app.pathPoints,
    animation: { ...animationState },
    animationTransport: animationState.captureTransportState?.() || {
      timelineProgress: animationState.progress ?? 0,
      isPlaying: animationState.isPlaying ?? false,
      isPaused: animationState.isPaused ?? false,
      playbackSpeed: animationState.playbackSpeed ?? 1,
    },
    animationPauseState: app.animationEngine._currentPauseState
      ? { ...app.animationEngine._currentPauseState }
      : null,
    nextPauseIndex: app.animationEngine.nextPauseIndex,
    jklDirection: app._jklDirection,
    jklSpeedMultiplier: app._jklSpeedMultiplier,
    controllerJklDirection: app.jklDirection,
    controllerJklSpeed: app.jklSpeed,
    undo: app.undoService?.createSnapshot?.() || null,
    isDirty: app._isDirty,
    backgroundCache: app._autosaveBackgroundCache,
    majorWaypointsCache: app._majorWaypointsCache,
    waypointProgressCache: app._waypointProgressCache,
  };
}

function replaceObjectContents(target, snapshot) {
  for (const key of Object.keys(target)) {
    if (!(key in snapshot)) delete target[key];
  }
  Object.assign(target, snapshot);
}

function runRollbackStep(label, action) {
  try {
    action();
  } catch (error) {
    console.error(`Project rollback could not restore ${label}:`, error);
  }
}

function restoreLiveState(app, previous) {
  app.waypoints = previous.waypoints;
  if (app.waypointsById) {
    app.waypointsById.clear();
    previous.waypointMap.forEach((value, key) => app.waypointsById.set(key, value));
  }
  app.scene.flowLayers = previous.sceneLayers;
  if (previous.assets && app.imageAssetService.replaceAssets) {
    app.imageAssetService.replaceAssets(previous.assets);
  }
  app.styles = previous.styles;
  replaceObjectContents(app.background, previous.background);
  replaceObjectContents(app.exportSettings, previous.exportSettings);
  replaceObjectContents(app.motionSettings, previous.motionSettings);
  app.selectedWaypoint = previous.selectedWaypoint;
  app.selectedWaypoints = previous.selectedWaypoints;
  app.selectedCrowd = previous.selectedCrowd;
  app.pathPoints = previous.pathPoints;
  app.renderReference = previous.renderReference;
  app._isDirty = previous.isDirty;
  app._autosaveBackgroundCache = previous.backgroundCache;
  app._majorWaypointsCache = previous.majorWaypointsCache;
  app._waypointProgressCache = previous.waypointProgressCache;
  if (previous.undo && app.undoService?.restoreSnapshot) {
    app.undoService.restoreSnapshot(previous.undo);
  }
  if (app.animationEngine?.state) Object.assign(app.animationEngine.state, previous.animation);
  app._jklDirection = previous.jklDirection;
  app._jklSpeedMultiplier = previous.jklSpeedMultiplier;
  app.jklDirection = previous.controllerJklDirection;
  app.jklSpeed = previous.controllerJklSpeed;

  // A late commit failure may happen after transform, path, and controls have
  // already switched to the staged project. Restore each derived/UI surface
  // independently so one secondary rollback error never hides the load error
  // or prevents the remaining surfaces from being repaired.
  const restoredProject = {
    styles: previous.styles,
    background: previous.background,
    exportSettings: previous.exportSettings,
    motionSettings: previous.motionSettings,
    animationState: previous.animation,
  };
  runRollbackStep('the background transform', () => {
    app.updateImageTransform?.(previous.background.image ?? null);
  });
  runRollbackStep('the animation transport', () => {
    if (app.animationEngine.restoreTransportState) {
      app.animationEngine.restoreTransportState(previous.animationTransport);
    }
    if (previous.animationPauseState && app.animationEngine._currentPauseState) {
      replaceObjectContents(app.animationEngine._currentPauseState, previous.animationPauseState);
    }
    app.animationEngine.nextPauseIndex = previous.nextPauseIndex;
  });
  runRollbackStep('the layer controls', () => app.updateLayersStrip?.());
  runRollbackStep('the global style controls', () => app._syncGlobalStyleUI?.());
  runRollbackStep('the project controls', () => syncLoadedProjectControls(app, restoredProject));
  runRollbackStep('the transport controls', () => {
    app.uiController?.setPlaybackSpeed?.(previous.animation.playbackSpeed ?? 1);
    app._updatePlayPauseUI?.();
    app.updateTimeDisplay?.(previous.animation.currentTime, previous.animation.duration);
  });
  runRollbackStep('the selection controls', () => {
    app.uiController?.setSelection?.(previous.selectedWaypoints || [], previous.selectedWaypoint);
    if (app.interactionHandler?.setSelection) {
      app.interactionHandler.setSelection(
        previous.selectedWaypoints || [],
        previous.selectedWaypoint
      );
    } else {
      app.interactionHandler?.setSelectedWaypoint?.(previous.selectedWaypoint);
    }
  });
  runRollbackStep('the waypoint list', () => app.updateWaypointList?.());
  runRollbackStep('the waypoint editor', () => app.updateWaypointEditor?.());
  runRollbackStep('the title', () => app.updateTitleIndicator?.());
  runRollbackStep('the canvas', () => app.render?.());
}

function syncLoadedProjectControls(app, staged) {
  if (app.elements?.headPreview) {
    const assetId = staged.styles.pathHead?.imageAssetId;
    const asset = assetId ? app.imageAssetService.getAsset(assetId) : null;
    app.elements.headPreview.style.display = asset ? 'block' : 'none';
    if (app.elements.headFilename) app.elements.headFilename.textContent = asset?.name || '';
    if (app.elements.headPreviewImg) app.elements.headPreviewImg.src = asset?.base64 || '';
  }

  const exportSettings = staged.exportSettings;
  if (app.elements?.exportIncludeImage) app.elements.exportIncludeImage.checked = exportSettings.pathOnly !== true;
  if (app.elements?.exportIncludeCamera) app.elements.exportIncludeCamera.checked = exportSettings.includeCamera !== false;
  if (app.elements?.exportIncludeText) app.elements.exportIncludeText.checked = exportSettings.includeText !== false;
  if (app.elements?.exportFrameRate) app.elements.exportFrameRate.value = exportSettings.frameRate;
  if (app.elements?.exportResX) app.elements.exportResX.value = exportSettings.resolutionX;
  if (app.elements?.exportResY) app.elements.exportResY.value = exportSettings.resolutionY;
  if (app.elements?.backgroundZoom) app.elements.backgroundZoom.value = exportSettings.backgroundZoom;
  if (app.elements?.backgroundZoomValue) app.elements.backgroundZoomValue.textContent = `${exportSettings.backgroundZoom}%`;
  app.coordinateTransform?.setBackgroundZoom?.(exportSettings.backgroundZoom / 100);

  if (app.elements?.bgFitToggle) {
    app.elements.bgFitToggle.textContent = staged.background.fit === 'fit' ? 'Fit' : 'Fill';
    app.elements.bgFitToggle.dataset.mode = staged.background.fit;
  }
  if (app.elements?.bgOverlay) {
    const sliderValue = MotionVisibilityService.bipolarLog2ValueToSlider(
      staged.background.overlay, MOTION.TINT_MIN, MOTION.TINT_MAX
    );
    app.elements.bgOverlay.value = String(sliderValue);
    setRangeReadout(
      app.elements.bgOverlay,
      app.elements.bgOverlayValue,
      formatBackgroundOverlay(staged.background.overlay)
    );
  }

  if (app.elements?.pathVisibility) app.elements.pathVisibility.value = staged.motionSettings.pathVisibility;
  if (app.elements?.pathTrail && app.uiController?.trailFractionToSlider) {
    app.elements.pathTrail.value = app.uiController.trailFractionToSlider(staged.motionSettings.pathTrail);
  }
  app.uiController?.setTrailValue?.(staged.motionSettings.pathTrail);
  app.uiController?.updateTrailControlVisibility?.(staged.motionSettings.pathVisibility);
  if (app.elements?.waypointVisibility) app.elements.waypointVisibility.value = staged.motionSettings.waypointVisibility;
  if (app.elements?.backgroundVisibility) app.elements.backgroundVisibility.value = staged.motionSettings.backgroundVisibility;
  if (app.elements?.animationSpeed) {
    app.eventBus?.emit('ui:slider:update-speed', staged.animationState.speed);
  }
}

function syncLoadedProjectUI(app, staged) {
  app.updateLayersStrip?.();
  app._syncGlobalStyleUI?.();
  syncLoadedProjectControls(app, staged);
}

function commitStagedProject(app, staged, { markClean = false } = {}) {
  const previous = captureLiveState(app);
  try {
    if (app.imageAssetService.replaceAssets) {
      app.imageAssetService.replaceAssets(staged.assets);
    } else if (staged.assets.length > 0) {
      throw new Error('Image asset commit is unavailable');
    }

    app.waypoints = staged.waypoints;
    if (app.waypointsById) {
      app.waypointsById.clear();
      staged.waypoints.forEach(waypoint => app.waypointsById.set(waypoint.id, waypoint));
    }
    app.scene.flowLayers = staged.scene.flowLayers;
    app.styles = staged.styles;
    Object.assign(app.background, staged.background);
    Object.assign(app.exportSettings, staged.exportSettings);
    Object.assign(app.motionSettings, staged.motionSettings);
    app.selectedWaypoint = null;
    app.selectedWaypoints = [];
    app.selectedCrowd = null;
    app.pathPoints = [];
    app.renderReference = staged.renderReference;
    app._majorWaypointsCache = null;
    app._autosaveBackgroundCache = staged.background.image && staged.backgroundSourceDataURL
      ? { image: staged.background.image, dataURL: staged.backgroundSourceDataURL }
      : null;

    app.updateImageTransform?.(staged.background.image ?? null);
    app.animationEngine.setMode?.(staged.animationState.mode);
    app.animationEngine.setSpeed?.(staged.animationState.speed);
    app.animationEngine.setDuration?.(staged.animationState.duration);
    app.animationEngine.setPlaybackSpeed?.(1);
    app.animationEngine.pause?.();
    app.animationEngine.seekToProgress?.(0);
    app.uiController?.setPlaybackSpeed?.(1);
    app.uiController?.setSelection?.([], null);
    if (app.interactionHandler?.setSelection) app.interactionHandler.setSelection([], null);
    else app.interactionHandler?.setSelectedWaypoint?.(null);

    if (staged.waypoints.length >= 2) app.calculatePath?.();
    syncLoadedProjectUI(app, staged);
    app.updateWaypointList?.();
    app.render?.();

    app.undoService?.reset?.(getUndoBaseline(staged));
    app.pruneImageAssets?.();
    app._isDirty = markClean ? false : app._isDirty;
    app.updateTitleIndicator?.();
  } catch (error) {
    try {
      restoreLiveState(app, previous);
    } catch (rollbackError) {
      console.error('Project rollback failed:', rollbackError);
    }
    throw error;
  }

  // Warnings are once-per-project, not once per browser session. A freshly
  // opened/recovered baseline must be able to warn about its own omissions.
  app._autosaveAssetWarningShown = false;
  app._autosaveBackgroundWarningShown = false;
  app._autosaveFailureWarningShown = false;

  // These cancellations happen only after every operation that can reject the
  // commit. A failed load therefore retains pending autosave and undo work.
  app.storageService.cancelAutoSave?.();
  if (app._undoDebounceTimer) {
    clearTimeout(app._undoDebounceTimer);
    app._undoDebounceTimer = null;
  }
  app.eventBus?.emit('project:replaced');
}

export const persistenceMixin = {
  
  /**
   * Save project as ZIP file (includes all images and settings)
   */
  async saveProject() {
    const saveRevision = this._editRevision || 0;
    const saveGeneration = this._projectGeneration || 0;
    try {
      this.announce('Saving project...');
      
      // ZIP assets are archived separately; the canonical model builder owns
      // every other field so explicit save, recovery and HTML export cannot
      // drift on additive project metadata such as the render reference.
      const projectData = this._buildProjectSnapshot({ includeAssets: false });
      
      // Preserve the original validated PNG/JPEG/WebP bytes exactly. Export
      // must fail rather than silently substituting a canvas re-encoding.
      const backgroundBase64 = getRetainedBackgroundDataURL(this, 'saving the project');
      
      // Export as ZIP
      const zipBlob = await this.imageAssetService.exportZip(projectData, backgroundBase64, 'route-project');
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `route-project-${timestamp}.zip`;
      
      // Download
      this.imageAssetService.downloadZip(zipBlob, filename);
      
      // ZIP generation is asynchronous. Only mark clean when the live project
      // is still the exact revision captured above; later edits or a new
      // project baseline are not present in the downloaded file.
      const sameProject = (this._projectGeneration || 0) === saveGeneration;
      const unchanged = sameProject && (this._editRevision || 0) === saveRevision;
      if (unchanged) {
        this._isDirty = false;
        this.updateTitleIndicator?.();
        this.announce('Project saved');
      } else if (sameProject) {
        this.announce('Project file saved; newer changes remain unsaved.');
      }
      console.log(`📦 Project saved: ${filename}`);
    } catch (err) {
      console.error('Failed to save project:', err);
      this.announce(`Failed to save project: ${err.message}`);
    }
  },
  
  /**
   * Open one of the bundled example projects (DEMO-01).
   *
   * Fetched as the very archive a user downloads and opened through the same
   * `loadProject` path their own save takes — no special case anywhere, which
   * is what makes the examples worth having as fixtures.
   *
   * @param {string} exampleId
   * @returns {Promise<boolean>} True when the project loaded
   */
  async loadExampleProject(exampleId) {
    const example = buildExampleProjects().find(each => each.id === exampleId);
    if (!example) {
      this.announce('That example is not available.');
      return false;
    }
    try {
      this.announce(`Opening ${example.name}…`);
      const response = await fetch(`examples/${example.id}.zip`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      // Named so the load log and any error name the example, not "undefined".
      const file = typeof File === 'function'
        ? new File([blob], `${example.id}.zip`, { type: 'application/zip' })
        : Object.assign(blob, { name: `${example.id}.zip` });
      return await this.loadProject(file);
    } catch (err) {
      console.error('Failed to open example project:', err);
      this.announce(`Could not open ${example.name}: ${err.message}`);
      this.eventBus.emit('ui:toast', { message: `Could not open ${example.name}` });
      return false;
    }
  },

  /**
   * Load project from ZIP file
   * @param {File} file - ZIP file to load
   */
  async loadProject(file) {
    const operation = beginAsyncProjectOperation(this, 'project-load', { replaceProject: true });
    try {
      this.announce('Loading project...');
      
      // ZIP and bitmap work returns detached objects. Only the synchronous
      // commit below can replace live project state.
      const imported = await this.imageAssetService.importZip(file);
      if (!isAsyncProjectOperationCurrent(this, operation)) return false;
      const staged = await stageProject(this, imported.projectData, {
        backgroundBase64: imported.backgroundBase64,
        imageAssets: imported.imageAssets,
      });
      if (!isAsyncProjectOperationCurrent(this, operation)) return false;
      staged.backgroundSourceDataURL = imported.backgroundBase64 || null;
      commitStagedProject(this, staged, { markClean: true });

      // Replace the previous session's recovery point with the newly loaded
      // project. If the browser quota rejects it, remove the stale recovery
      // point so a reload cannot resurrect the old project.
      const recovery = replaceImmediateRecovery(this);
      const recoveryUnavailable = recovery.attempted && !recovery.saved;
      
      this.announce(recoveryUnavailable
        ? 'Project loaded, but browser recovery is unavailable. Save the project file to keep it safe.'
        : 'Project loaded');
      console.log(`📦 Project loaded: ${file.name} (${this.waypoints.length} waypoints, ${this.imageAssetService.getAssetCount()} assets)`);
      return true;
    } catch (err) {
      if (!isAsyncProjectOperationCurrent(this, operation)) return false;
      console.error('Failed to load project:', err);
      this.announce('Failed to load project: ' + err.message);
      return false;
    }
  },

  /**
   * Mark the project as having unsaved changes and update title indicator
   * Per UI spec §2.1: Append ● dot to title when dirty
   */
  markDirty() {
    advanceEditRevision(this);
    if (!this._isDirty) {
      this._isDirty = true;
      this.updateTitleIndicator();
    }
  },
  
  /**
   * Mark the project as saved (no unsaved changes)
   */
  markClean() {
    if (this._isDirty) {
      this._isDirty = false;
      this.updateTitleIndicator();
    }
  },
  
  /**
   * Update the title to show/hide unsaved changes indicator
   * Per UI spec §2.1: "Route Plotter v3.1.9 ●" when dirty
   */
  updateTitleIndicator() {
    const titleEl = document.getElementById('app-title');
    if (!titleEl) return;
    
    const baseTitle = 'Route Plotter';
    titleEl.textContent = this._isDirty ? `${baseTitle} ●` : baseTitle;
    titleEl.title = this._isDirty ? `Version ${APP_VERSION} · Unsaved changes` : `Version ${APP_VERSION}`;
  },

  /**
   * Build the canonical coordVersion-9 project snapshot.
   *
   * Single source of the project model shape. Explicit exports can include
   * custom image assets; browser recovery calls this with includeAssets=false
   * and then strips unusable custom-image references.
   *
   * @param {Object} [options]
   * @param {boolean} [options.includeAssets=true] - Include custom image assets.
   * @returns {Object} Serialisable project data (coordVersion 9)
   */
  _buildProjectSnapshot({ includeAssets = true } = {}) {
    // Create a clean copy of styles without the pathHead image object (but keep imageAssetId)
    const stylesCopy = { ...this.styles };
    if (stylesCopy.pathHead) {
      stylesCopy.pathHead = { ...stylesCopy.pathHead, image: null };
    }

    const timingReference = resolveRenderReference(
      { width: this.displayWidth, height: this.displayHeight },
      { width: this.exportSettings.resolutionX, height: this.exportSettings.resolutionY }
    );
    const renderReference = resolveRenderReference(
      this.renderReference,
      timingReference,
      { width: this.exportSettings.resolutionX, height: this.exportSettings.resolutionY }
    );

    const snapshot = {
      // v9: layered scene (v7 + additive `scene` block; 8 skipped — the
      // fork's local builds used it for graph-only saves)
      coordVersion: 9,
      waypoints: this.waypoints.map(wp => wp.toJSON()), // Serialize Waypoint instances
      scene: this.scene.toJSON(), // Flow-layer params + seeds only — runtime dot state never persists
      styles: stylesCopy,
      animationState: {
        mode: this.animationEngine.state.mode,
        speed: this.animationEngine.state.speed,
        duration: this.animationEngine.state.duration
        // Note: playbackSpeed intentionally NOT saved - resets to 1x on each session
      },
      background: {
        overlay: this.background.overlay,
        fit: this.background.fit
      },
      exportSettings: {
        frameRate: this.exportSettings.frameRate,
        pathOnly: this.exportSettings.pathOnly,
        resolutionX: this.exportSettings.resolutionX,
        resolutionY: this.exportSettings.resolutionY,
        backgroundZoom: this.exportSettings.backgroundZoom,
        includeCamera: this.exportSettings.includeCamera,
        includeText: this.exportSettings.includeText
      },
      motionSettings: {
        pathVisibility: this.motionSettings.pathVisibility,
        pathTrail: this.motionSettings.pathTrail,
        waypointVisibility: this.motionSettings.waypointVisibility,
        backgroundVisibility: this.motionSettings.backgroundVisibility,
        revealSize: this.motionSettings.revealSize,
        revealFeather: this.motionSettings.revealFeather,
        aovAngle: this.motionSettings.aovAngle,
        aovDistance: this.motionSettings.aovDistance,
        aovDropoff: this.motionSettings.aovDropoff
      },
      // Include image assets if under size limit
      imageAssets: includeAssets ? this.imageAssetService.toJSON() : [],
      // Stable visual sizing space. Map-bound reference pixels scale from its
      // short edge; loading/rendering never mutates the authored values.
      renderReference,
      // Canvas dimensions the current timeline was derived from. Speed is
      // px/s against the on-screen path, so duration/markers depend on the
      // display size; the exported player recomputes timing in THIS space to
      // reproduce the authored timeline exactly, then renders at the export
      // resolution — the same rule as video export (_enterExportMode never
      // recalculates timing at the export canvas). Additive v9 field.
      timingReference
      // Note: Camera settings are per-waypoint, saved in waypoint.camera
    };
    return snapshot;
  },

  autoSave() {
    // Mark as dirty when changes are made
    this.markDirty();

    try {
      const prepared = prepareAutosaveSnapshot(this);
      reportAutosaveOmissions(this, prepared);
      if (prepared.error) console.warn('Auto-save recovery was reduced:', prepared.error);
      if (!prepared.snapshot) {
        this.storageService.cancelAutoSave?.();
        reportAutosaveFailure(this);
        return { ok: false, error: prepared.error };
      }

      // StorageService reports the outcome of the actual delayed write. A
      // quota/security failure must never be presented or cached as success.
      const result = this.storageService.autoSave(prepared.snapshot, outcome => {
        if (outcome?.ok) this._autosaveFailureWarningShown = false;
        else reportAutosaveFailure(this);
      });
      if (result?.ok === false) reportAutosaveFailure(this);
      return result;
    } catch (e) {
      console.error('Error saving state:', e);
      this.storageService.cancelAutoSave?.();
      reportAutosaveFailure(this);
      return { ok: false, error: e };
    }
  },
  
  async loadAutosave() {
    console.debug('📥 [loadAutosave] Loading saved state...');
    try {
      const data = this.storageService.loadAutoSave();
      if (!data) return false;

      const MIN_COORD_VERSION = 6;
      if (!data.coordVersion || data.coordVersion < MIN_COORD_VERSION) {
        console.log('Old data version detected (v' + (data.coordVersion || 1) + '), clearing saved data for v' + MIN_COORD_VERSION);
        this.storageService.clearAutoSave();
        return false;
      }

      const staged = await stageProject(this, data);
      staged.backgroundSourceDataURL = data.backgroundImage || null;
      commitStagedProject(this, staged);
      // Legacy recovery points may contain image bytes and original filenames.
      // Restore them once, then immediately replace or clear the local record
      // so browser storage conforms to the model-only policy going forward.
      const recovery = replaceImmediateRecovery(this);
      console.debug(`📷 Loaded ${staged.assets.length} image assets`);
      console.debug('Loaded waypoints:', staged.waypoints.length);
      console.debug('Loaded flow layers:', staged.scene.getFlowLayers().length);
      this.announce(recovery.attempted && !recovery.saved
        ? 'Previous session restored, but browser recovery is now unavailable. Save a project file to keep it safe.'
        : 'Previous session restored');
      return true;
    } catch (error) {
      console.warn('Autosave was not restored; current state was left unchanged:', error);
      return false;
    }
  },
};
