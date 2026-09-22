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

/** Values are copied and named, so a later mutation cannot rewrite history. */
function describeValue(value) {
  if (Array.isArray(value)) return value.slice();
  if (value === null || typeof value !== 'object') return value;
  if (value.__recorderId) return value.__recorderId;
  if (value instanceof HTMLCanvasElement) return '[canvas]';
  if (typeof Image !== 'undefined' && value instanceof Image) return `[image ${value.src ?? ''}]`;
  return `[${value.constructor?.name ?? 'object'}]`;
}

function createRecordingContext(canvas) {
  const calls = [];
  const style = { ...CONTEXT_STYLE_DEFAULTS };
  const stack = [];
  let lineDash = [];
  let gradients = 0;

  const context = {
    canvas,
    calls,
    /** Return the transcript so far and start a new one (per-frame goldens). */
    takeCalls() {
      return calls.splice(0, calls.length);
    }
  };

  for (const name of CONTEXT_METHODS) {
    const result = CONTEXT_METHOD_RESULTS[name];
    context[name] = vi.fn((...args) => {
      calls.push([name, ...args.map(describeValue)]);
      return result ? result(...args) : undefined;
    });
  }

  for (const name of Object.keys(CONTEXT_STYLE_DEFAULTS)) {
    Object.defineProperty(context, name, {
      configurable: true,
      enumerable: true,
      get: () => style[name],
      set: (next) => {
        style[name] = next;
        calls.push([`set:${name}`, describeValue(next)]);
      }
    });
  }

  context.save = vi.fn(() => {
    stack.push({ style: { ...style }, lineDash: lineDash.slice() });
    calls.push(['save']);
  });
  context.restore = vi.fn(() => {
    const previous = stack.pop();
    if (previous) {
      Object.assign(style, previous.style);
      lineDash = previous.lineDash;
    }
    calls.push(['restore']);
  });
  context.setLineDash = vi.fn((dash = []) => {
    lineDash = Array.from(dash);
    calls.push(['setLineDash', lineDash.slice()]);
  });
  context.getLineDash = vi.fn(() => lineDash.slice());

  for (const name of ['createLinearGradient', 'createRadialGradient']) {
    context[name] = vi.fn((...args) => {
      const id = `[gradient ${++gradients}]`;
      calls.push([name, ...args.map(describeValue)]);
      return {
        __recorderId: id,
        addColorStop: vi.fn((offset, color) => calls.push([`${id}.addColorStop`, offset, color]))
      };
    });
  }

  /** A real canvas discards its context state when it is resized. */
  context.resetForResize = () => {
    Object.assign(style, CONTEXT_STYLE_DEFAULTS);
    stack.length = 0;
    lineDash = [];
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
        context.resetForResize();
        context.calls.push([`canvas.${name}`, next]);
      }
    });
  }
}

HTMLCanvasElement.prototype.getContext = vi.fn(function getContext() {
  let context = canvasContexts.get(this);
  if (!context) {
    context = createRecordingContext(this);
    canvasContexts.set(this, context);
    trackCanvasSize(this, context);
  }
  return context;
});
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,');
HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => {
  cb(new Blob([''], { type: 'image/png' }));
});

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
Object.defineProperty(global.URL, 'createObjectURL', {
  configurable: true, writable: true, value: vi.fn(() => 'blob:mock-url')
});
Object.defineProperty(global.URL, 'revokeObjectURL', {
  configurable: true, writable: true, value: vi.fn()
});

// Export mocks for use in tests
export {
  localStorageMock,
  createRecordingContext,
  contextFor
};

// Unexpected console.error/warn fails the test that produced it (TST-10).
installConsoleGuard();
