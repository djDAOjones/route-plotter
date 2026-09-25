/**
 * Test setup file for Vitest
 * Sets up the test environment and global mocks
 */

import { vi } from 'vitest';

import { installConsoleGuard } from './helpers/consoleGuard.js';

/**
 * jsdom 27 exposes several globals (performance, localStorage, Image, URL)
 * as getter-only properties. Plain assignment (`global.x = ...`) throws
 * "Cannot set property x which has only a getter", which crashed this setup
 * file and silently disabled the entire test suite (npm test reported
 * "no tests" yet exited 0). defineProperty overrides getter-only globals
 * safely.
 */
function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value
  });
}

// Mock DOM animation frame APIs
defineGlobal('requestAnimationFrame', vi.fn((cb) => setTimeout(() => cb(Date.now()), 0)));
defineGlobal('cancelAnimationFrame', vi.fn((id) => clearTimeout(id)));

// Mock performance API (getter-only in jsdom)
defineGlobal('performance', { now: vi.fn(() => Date.now()) });

// Mock localStorage (getter-only in jsdom). getItem returns null for a missing
// key, as the real API does: an undefined made `JSON.parse(getItem(...))` throw
// in tests where the browser returns null and the app takes its absent branch.
// vi.fn's implementation survives mockReset, so the default outlives a reset.
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
defineGlobal('localStorage', localStorageMock);

/**
 * Canvas context: one recording context per canvas.
 *
 * A single shared stub made every canvas look like the same surface, so draw
 * calls from the editor canvas, the offscreen vector layer and an export
 * canvas could not be told apart, and call counts leaked between them. Each
 * canvas now gets its own context that records, in order, the calls and style
 * changes made through it — the transcript the render goldens compare.
 *
 * The recorder keeps the state a real context keeps: `save`/`restore` push and
 * pop the style stack, and resizing a canvas resets it, because renderers read
 * values back (for example a beacon multiplies the inherited `globalAlpha`).
 * It keeps the transform the same way, and can report the state each call was
 * made in, because state can outlive its frame without changing a single
 * call: a frame that threw before its `restore` left the next one drawing
 * every identical call through the wrong matrix (DEF-36).
 */
const CONTEXT_METHOD_RESULTS = {
  measureText: (text) => ({ width: String(text).length * 6 }),
  createImageData: () => ({ data: [] }),
  getImageData: () => ({ data: [] }),
  createPattern: () => null,
  isPointInPath: () => false,
  isPointInStroke: () => false
};

const CONTEXT_METHODS = [
  'clearRect', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'measureText',
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
  'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'fill', 'stroke', 'clip',
  'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
  'drawImage', 'createImageData', 'getImageData', 'putImageData', 'createPattern',
  'isPointInPath', 'isPointInStroke'
];

const CONTEXT_STYLE_DEFAULTS = Object.freeze({
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  strokeStyle: '#000',
  fillStyle: '#000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  direction: 'inherit',
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'low',
  filter: 'none',
  lineDashOffset: 0
});

/** A transform in `DOMMatrix` order, `[a, b, c, d, e, f]`. Never mutated. */
const IDENTITY_TRANSFORM = Object.freeze([1, 0, 0, 1, 0, 0]);

/** `current × next`: what a context does to its transform on each call. */
function multiplyTransforms([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) {
  return Object.freeze([
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ]);
}

/**
 * Apply a transform method's first `count` arguments, converted to numbers as
 * a browser converts them. Too few throw, as in a browser; a non-finite one
 * makes the call a no-op, which is null here.
 */
function withArguments(name, args, count, apply) {
  if (args.length < count) {
    throw new TypeError(`Failed to execute '${name}' on 'CanvasRenderingContext2D': ` +
      `${count} arguments required, but only ${args.length} present.`);
  }
  const values = args.slice(0, count).map(Number);
  return values.every(Number.isFinite) ? apply(values) : null;
}

/** The transform each method leaves, given the one before it and the call's arguments. */
const TRANSFORM_METHODS = {
  translate: (current, args) => withArguments('translate', args, 2,
    ([x, y]) => multiplyTransforms(current, [1, 0, 0, 1, x, y])),
  scale: (current, args) => withArguments('scale', args, 2,
    ([x, y]) => multiplyTransforms(current, [x, 0, 0, y, 0, 0])),
  rotate: (current, args) => withArguments('rotate', args, 1, ([angle]) => {
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    return multiplyTransforms(current, [cos, sin, -sin, cos, 0, 0]);
  }),
  transform: (current, args) => withArguments('transform', args, 6, matrix => multiplyTransforms(current, matrix)),
  setTransform: (current, args) => {
    if (args.length === 0) return IDENTITY_TRANSFORM;
    if (args.length === 1) {
      const { a, b, c, d, e, f, m11, m12, m21, m22, m41, m42 } = args[0] ?? {};
      args = [a ?? m11 ?? 1, b ?? m12 ?? 0, c ?? m21 ?? 0, d ?? m22 ?? 1, e ?? m41 ?? 0, f ?? m42 ?? 0];
    }
    return withArguments('setTransform', args, 6, matrix => Object.freeze(matrix));
  },
  resetTransform: () => IDENTITY_TRANSFORM
};

/**
 * Values are copied and named, so a later mutation cannot rewrite history.
 * A canvas is named by its recording context's id, which `drawLog.js` turns
 * into the surface it is; a bare `[canvas]` let a render that composited the
 * wrong one pass every golden (TST-17). A canvas this recorder never gave a
 * context has no id.
 */
function describeValue(value) {
  if (Array.isArray(value)) return value.slice();
  if (value === null || typeof value !== 'object') return value;
  if (value.__recorderId) return value.__recorderId;
  if (value instanceof HTMLCanvasElement) {
    const id = contextIdFor(value);
    return id === null ? '[canvas]' : `[canvas #${id}]`;
  }
  if (typeof Image !== 'undefined' && value instanceof Image) return `[image ${value.src ?? ''}]`;
  return `[${value.constructor?.name ?? 'object'}]`;
}

/**
 * One transcript across every canvas, in the order the calls were made.
 *
 * Per-canvas transcripts cannot show *interleaving*, and interleaving is what
 * decides the picture: compositing an offscreen layer before it is drawn, or
 * after it is cleared, leaves each canvas's own transcript unchanged and the
 * screen blank. Each entry is `[contextId, name, ...args]` (TST-02). It also
 * carries the state the call was made in: `entry.transform`, `entry.depth`
 * (saved states still open) and `entry.state` (every style away from its
 * default, and the line dash). `drawLog.js` shows those only when asked, so
 * the goldens' text is unchanged.
 */
const orderedCalls = [];
let recordingContexts = 0;
// Off unless a test asks for it: every other test in the worker would
// otherwise pay for a transcript nobody drains.
let recordingOrder = false;

/** Start or stop keeping the cross-canvas transcript. */
function recordCallOrder(enabled) {
  recordingOrder = enabled;
  if (!enabled) orderedCalls.length = 0;
}

/** Drain the cross-canvas transcript. `contextIdFor` names the surfaces in it. */
function takeOrderedCalls() {
  return orderedCalls.splice(0, orderedCalls.length);
}

/** The recorder's id for a canvas, for reading `takeOrderedCalls` back. */
function contextIdFor(canvas) {
  return canvasContexts.get(canvas)?.recorderId ?? null;
}

function createRecordingContext(canvas) {
  const calls = [];
  const style = { ...CONTEXT_STYLE_DEFAULTS };
  const stack = [];
  let lineDash = [];
  let transform = IDENTITY_TRANSFORM;
  let gradients = 0;
  const recorderId = ++recordingContexts;

  // Rebuilt only after the drawing state changes, not once per call.
  let drawingState = null;
  const stateChanged = () => { drawingState = null; };
  const currentDrawingState = () => {
    if (!drawingState) {
      const changed = {};
      for (const [name, value] of Object.entries(style)) {
        if (value !== CONTEXT_STYLE_DEFAULTS[name]) changed[name] = describeValue(value);
      }
      if (lineDash.length > 0) changed.lineDash = lineDash.slice();
      drawingState = Object.freeze(changed);
    }
    return drawingState;
  };

  /**
   * Every call is written twice: to this canvas, and to the shared order.
   * Each is recorded before it takes effect, so it carries the state it was
   * made in.
   */
  const record = (call) => {
    calls.push(call);
    if (recordingOrder) {
      orderedCalls.push(Object.assign([recorderId, ...call],
        { transform, depth: stack.length, state: currentDrawingState() }));
    }
  };

  const context = {
    canvas,
    calls,
    recorderId,
    /** Return the transcript so far and start a new one (per-frame goldens). */
    takeCalls() {
      return calls.splice(0, calls.length);
    }
  };

  for (const name of CONTEXT_METHODS) {
    const result = CONTEXT_METHOD_RESULTS[name];
    const nextTransform = TRANSFORM_METHODS[name];
    context[name] = vi.fn((...args) => {
      // A browser rejects a malformed transform call before it does anything.
      const next = nextTransform ? nextTransform(transform, args) : null;
      record([name, ...args.map(describeValue)]);
      if (next) transform = next;
      return result ? result(...args) : undefined;
    });
  }

  for (const name of Object.keys(CONTEXT_STYLE_DEFAULTS)) {
    Object.defineProperty(context, name, {
      configurable: true,
      enumerable: true,
      get: () => style[name],
      set: (next) => {
        record([`set:${name}`, describeValue(next)]);
        style[name] = next;
        stateChanged();
      }
    });
  }

  context.save = vi.fn(() => {
    record(['save']);
    stack.push({ style: { ...style }, lineDash: lineDash.slice(), transform });
  });
  context.restore = vi.fn(() => {
    record(['restore']);
    const previous = stack.pop();
    if (previous) {
      Object.assign(style, previous.style);
      lineDash = previous.lineDash;
      transform = previous.transform;
      stateChanged();
    }
  });
  context.setLineDash = vi.fn((dash = []) => {
    const next = Array.from(dash);
    record(['setLineDash', next.slice()]);
    lineDash = next;
    stateChanged();
  });
  context.getLineDash = vi.fn(() => lineDash.slice());

  for (const name of ['createLinearGradient', 'createRadialGradient']) {
    context[name] = vi.fn((...args) => {
      const id = `[gradient ${++gradients}]`;
      record([name, ...args.map(describeValue)]);
      return {
        __recorderId: id,
        addColorStop: vi.fn((offset, color) => record([`${id}.addColorStop`, offset, color]))
      };
    });
  }

  context.record = record;

  /** A real canvas discards its context state when it is resized. */
  context.resetForResize = () => {
    Object.assign(style, CONTEXT_STYLE_DEFAULTS);
    stack.length = 0;
    lineDash = [];
    transform = IDENTITY_TRANSFORM;
    stateChanged();
  };

  return context;
}

const canvasContexts = new WeakMap();

/** Resizing a canvas resets its context, so the recorder must see the writes. */
function trackCanvasSize(canvas, context) {
  for (const name of ['width', 'height']) {
    let value = canvas[name];
    Object.defineProperty(canvas, name, {
      configurable: true,
      get: () => value,
      set: (next) => {
        value = next;
        context.record([`canvas.${name}`, next]);
        context.resetForResize();
      }
    });
  }
}

// A test file may run in the node environment (TST-07's bundle check), where
// there is no DOM to patch.
const hasDom = typeof HTMLCanvasElement !== 'undefined';

if (hasDom) HTMLCanvasElement.prototype.getContext = vi.fn(function getContext() {
  let context = canvasContexts.get(this);
  if (!context) {
    context = createRecordingContext(this);
    canvasContexts.set(this, context);
    trackCanvasSize(this, context);
  }
  return context;
});
if (hasDom) {
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,');
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => {
    cb(new Blob([''], { type: 'image/png' }));
  });
}

/** The recording context a canvas has been given, without creating one. */
function contextFor(canvas) {
  return canvasContexts.get(canvas) ?? null;
}

// Mock Image constructor (getter-only in jsdom)
defineGlobal('Image', class {
  constructor() {
    setTimeout(() => this.onload && this.onload(), 0);
  }
  set src(value) {
    this._src = value;
  }
  get src() {
    return this._src;
  }
  width = 100;
  height = 100;
  naturalWidth = 100;
  naturalHeight = 100;
});

// Mock URL object-URL helpers (define to override getter-only props)
if (hasDom) {
  Object.defineProperty(global.URL, 'createObjectURL', {
    configurable: true, writable: true, value: vi.fn(() => 'blob:mock-url')
  });
  Object.defineProperty(global.URL, 'revokeObjectURL', {
    configurable: true, writable: true, value: vi.fn()
  });
}

// Export mocks for use in tests
export {
  localStorageMock,
  createRecordingContext,
  contextFor,
  contextIdFor,
  recordCallOrder,
  takeOrderedCalls
};

// Unexpected console.error/warn fails the test that produced it (TST-10).
installConsoleGuard();
