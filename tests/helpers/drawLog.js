/**
 * Draw transcripts for the render goldens (TST-02).
 *
 * `tests/setup.js` gives every canvas a recording context, so a frame can be
 * read back as the ordered list of calls and style changes that produced it.
 * This turns that into a stable, diffable text form.
 *
 * It reads the *cross-canvas* transcript rather than each canvas's own,
 * because the interleaving is part of the picture: a renderer that composites
 * its offscreen layer before drawing it, or after clearing it, leaves both
 * canvases' individual transcripts untouched and the screen blank. A call on
 * a surface this module does not know is labelled `other#<id>` rather than
 * dropped.
 */

import { contextIdFor, recordCallOrder, takeOrderedCalls } from '../setup.js';

// Only this file's tests pay for the shared transcript.
recordCallOrder(true);

/**
 * Coordinates are floating-point all the way down, and the last few bits of a
 * path point are not behaviour. Three decimals is a thousandth of a pixel:
 * finer than anything a renderer decides, coarse enough to be identical on
 * every machine this suite has run on.
 */
function round(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(3)) : value;
  return value;
}

function describeCall(call, gradientNames) {
  return call.map(round)
    .map(value => (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)))
    .map(value => renameGradient(value, gradientNames))
    .map(shortenImage)
    .join(' ');
}

/**
 * An image argument is recorded as `[image <src>]`, and a bundled background
 * arrives as a base64 data URL — two megabytes of it, on every `drawImage`,
 * in every frame. The payload is replaced by its type and length, which still
 * changes if the image does and keeps the goldens readable.
 */
function shortenImage(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\[image (data:([^;]*);base64,)([A-Za-z0-9+/=]*)\]/g,
    (whole, prefix, mime, payload) => `[image ${mime} base64 ${payload.length} bytes ${payload.slice(0, 12)}…]`);
}

/**
 * Gradients are numbered per context for its whole life, so the same drawing
 * carries different labels depending on how many frames ran before it — and a
 * frame reached by playing would never match the same frame reached by
 * seeking. They are renumbered per frame, in first-appearance order, which
 * keeps each `addColorStop` tied to its own gradient and nothing else.
 */
function renameGradient(value, names) {
  if (typeof value !== 'string') return value;
  return value.replace(/\[gradient (\d+)\]/g, (whole, id) => {
    if (!names.has(id)) names.set(id, names.size + 1);
    return `[gradient ${names.get(id)}]`;
  });
}

/**
 * The canvases one renderer host draws on.
 *
 * `main` is the visible canvas; `vector` is the offscreen layer the renderer
 * creates for the route, markers and crowds; `mask` is the reveal mask the
 * visibility service builds for the spotlight and angle-of-view modes, whose
 * pixels reach `main` only as an opaque `[canvas]` argument, so without it a
 * mask that stopped painting would be invisible here.
 */
function surfaceNames(host) {
  const names = new Map();
  const add = (name, canvas) => {
    const id = canvas ? contextIdFor(canvas) : null;
    if (id !== null) names.set(id, name);
  };
  add('main', host.canvas);
  add('vector', host.renderingService?.vectorCanvas);
  add('mask', host.motionVisibilityService?.revealMaskCanvas);
  return names;
}

/** Throw away whatever is buffered, so the next frame starts clean. */
export function discardFrame() {
  takeOrderedCalls();
}

/**
 * Drain one frame as transcript lines, each prefixed by its surface.
 *
 * @param {Object} host - A booted RoutePlotter or a loaded PlayerApp
 * @returns {string[]}
 */
export function takeFrame(host) {
  const names = surfaceNames(host);
  const gradients = new Map();
  return takeOrderedCalls()
    .map(([id, ...call]) => `${names.get(id) ?? `other#${id}`} ${describeCall(call, gradients)}`);
}

/**
 * Seek to an instant and return the frame it draws.
 *
 * The seek is what the renderer is asked to reproduce; nothing about the frame
 * may depend on how the instant was reached (`goldenFrames.test.js` pins that
 * at the state level, and `play == seek` pins it at the draw level).
 */
export function frameAt(host, progress) {
  host.animationEngine.seekToProgress(progress);
  discardFrame();
  host.render();
  return takeFrame(host);
}

/**
 * The frame that sizes a mode's offscreen canvases.
 *
 * It is not thrown away. Resizing a canvas resets its context, and the vector
 * layer's scale transform is written once and then persists into every later
 * frame — so discarding this frame would hide a renderer that started drawing
 * at the wrong scale. It is kept as its own golden section instead.
 */
export function setUpFrame(host, progress = 0) {
  return frameAt(host, progress);
}

/** The indices at which two transcripts disagree. */
export function differingLines(left, right) {
  const length = Math.max(left.length, right.length);
  const differences = [];
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) differences.push(index);
  }
  return differences;
}
