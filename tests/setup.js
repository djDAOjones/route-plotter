/**
 * Test setup file for Vitest
 * Sets up the test environment and global mocks
 */

import { vi } from 'vitest';

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

// Mock localStorage (getter-only in jsdom)
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
defineGlobal('localStorage', localStorageMock);

// Mock canvas context
const canvasContextMock = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
  drawImage: vi.fn(),
  createImageData: vi.fn(() => ({ data: [] })),
  getImageData: vi.fn(() => ({ data: [] })),
  putImageData: vi.fn(),
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  strokeStyle: '#000',
  fillStyle: '#000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  imageSmoothingEnabled: true
};

// Mock canvas element
HTMLCanvasElement.prototype.getContext = vi.fn(() => canvasContextMock);
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,');
HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => {
  cb(new Blob([''], { type: 'image/png' }));
});

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
  canvasContextMock
};
