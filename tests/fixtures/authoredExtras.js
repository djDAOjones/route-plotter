/**
 * A project that leaves nothing at its default (TST-06).
 *
 * The three bundled examples are realistic, which is exactly why they are not
 * enough for a save-shape golden: a realistic project leaves most fields at
 * their defaults, so a serialiser that silently dropped one — a custom marker
 * image, an authored camera zoom — would still produce a matching golden.
 * This fixture moves every field of the shape off its default, and
 * `projectSnapshotShape.test.js` enforces that it keeps doing so.
 *
 * It is built on the branched Open day example, so its `scene` block keeps a
 * real traced network with anchored nodes rather than a handmade one.
 */

import { buildExampleProjects } from '../../src/examples/index.js';

/** A 1×1 PNG — the smallest thing that is genuinely an image asset. */
export const PIXEL_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

export const MARKER_ASSET_ID = 'asset-extras-marker';
export const HEAD_ASSET_ID = 'asset-extras-head';

function imageAsset(id) {
  return {
    id,
    base64: PIXEL_DATA_URL,
    name: `${id}.png`,
    width: 1,
    height: 1,
    mimeType: 'image/png',
    size: 68,
  };
}

/**
 * @returns {Object} A coordVersion-9 project with no field left at its default
 */
export function authoredExtrasProject() {
  const base = buildExampleProjects().find(example => example.id === 'uon-open-day');
  const project = JSON.parse(JSON.stringify(base.project));

  project.waypoints = project.waypoints.map((waypoint, index) => ({
    ...waypoint,
    isMajor: index !== 1,
    segmentColor: '#0072B2',
    segmentWidth: 7,
    segmentStyle: 'dashed',
    segmentSpeed: 2.5,
    pathShape: 'wave',
    shapeAmplitude: 22,
    shapeFrequency: 9,
    markerStyle: index === 0 ? 'custom-image' : 'square',
    dotColor: '#CC79A7',
    dotSize: 14,
    beaconStyle: ['ripple', 'pulse', 'glow', 'grow'][index % 4],
    rippleThickness: 5,
    rippleMaxScale: 2400,
    rippleWait: false,
    pulseAmplitude: 2.5,
    pulseCycleSpeed: 7,
    name: `Extras ${index + 1}`,
    label: `Label ${index + 1}`,
    labelMode: 'on',
    labelOffsetX: 12 + index,
    labelOffsetY: -9 - index,
    labelPlacedByHand: true,
    labelWidth: 33,
    labelSize: 27,
    labelColor: '#009E73',
    labelBgColor: '#F0E442',
    labelBgOpacity: 0.42,
    pauseMode: index % 2 === 0 ? 'none' : 'timed',
    pauseTime: 2750,
    customImageAssetId: index === 0 ? MARKER_ASSET_ID : null,
    customImageRotation: 'auto',
    customImageRotationOffset: 37,
    camera: { zoom: 1.75 + index * 0.1, zoomMode: 'stepped' },
    areaHighlight: {
      enabled: true,
      shape: index === 0 ? 'polygon' : 'rectangle',
      centerX: 0.31,
      centerY: 0.64,
      radius: 0.11,
      width: 0.27,
      height: 0.19,
      points: index === 0
        ? [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.25 }, { x: 0.45, y: 0.7 }]
        : [],
      fillColor: '#E69F00',
      fillOpacity: 0.55,
      borderColor: '#D55E00',
      borderWidth: 6,
      borderStyle: 'dashed',
      visibility: 'always-show',
      fadeInMs: 1250,
      fadeOutMs: 1750,
    },
  }));

  project.styles = {
    pathColor: '#0072B2',
    pathThickness: 9,
    pathStyle: 'dotted',
    pathShape: 'wave',
    markerStyle: 'square',
    dotColor: '#CC79A7',
    dotSize: 13,
    beaconStyle: 'ripple',
    labelMode: 'on',
    graphicsScale: 1.6,
    showPathCasing: false,
    pathWidth: 9,
    pathHead: {
      style: 'custom-image',
      color: '#009E73',
      size: 21,
      rotationOffset: 45,
      image: null,
      imageAssetId: HEAD_ASSET_ID,
    },
    pathGlow: { intensity: 0.65, color: '#F0E442' },
  };

  project.animationState = { mode: 'constant-time', speed: 275, duration: 31500 };
  project.background = { overlay: 0.45, fit: 'fill' };
  project.exportSettings = {
    frameRate: 60,
    pathOnly: true,
    resolutionX: 1280,
    resolutionY: 720,
    backgroundZoom: 175,
    includeCamera: true,
    includeText: false,
  };
  project.motionSettings = {
    pathVisibility: 'instantaneous',
    pathTrail: 640,
    waypointVisibility: 'hide-before',
    backgroundVisibility: 'spotlight-reveal',
    revealSize: 62,
    revealFeather: 71,
    revealTrail: 38,
    aovAngle: 95,
    aovDistance: 66,
    aovDropoff: 23,
  };
  project.imageAssets = [imageAsset(MARKER_ASSET_ID), imageAsset(HEAD_ASSET_ID)];

  return project;
}
