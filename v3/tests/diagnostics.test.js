import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  DIAGNOSTICS_SCHEMA_VERSION,
  DiagnosticsService
} from '../src/services/DiagnosticsService.js';

const FIXED_TIME = new Date('2026-08-26T12:34:56.000Z');

function makeService(overrides = {}) {
  return new DiagnosticsService({
    appVersion: '3.2.619',
    now: () => FIXED_TIME,
    environment: {
      userAgent: 'Mozilla/5.0 Diagnostic Test',
      platform: 'MacIntel',
      viewport: { width: 1440, height: 900 },
      devicePixelRatio: 2
    },
    capabilities: {
      webCodecs: true,
      mediaRecorder: false,
      canvasCaptureStream: true
    },
    ...overrides
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DiagnosticsService fixed privacy schema', () => {
  test('produces an exact deterministic report from supplied technical context', () => {
    const first = makeService().createBundle();
    const second = makeService().createBundle();
    const expected = `{
  "schemaVersion": 1,
  "appVersion": "3.2.619",
  "generatedAt": "2026-08-26T12:34:56.000Z",
  "environment": {
    "userAgent": "Mozilla/5.0 Diagnostic Test",
    "platform": "MacIntel",
    "viewport": {
      "width": 1440,
      "height": 900
    },
    "devicePixelRatio": 2
  },
  "capabilities": {
    "webCodecs": true,
    "mediaRecorder": false,
    "canvasCaptureStream": true
  }
}
`;

    expect(DIAGNOSTICS_SCHEMA_VERSION).toBe(1);
    expect(first.report).toEqual(second.report);
    expect(first.previewText).toBe(expected);
    expect(first.copyText).toBe(first.previewText);
    expect(first.downloadText).toBe(first.previewText);
    expect(second.previewText).toBe(first.previewText);
    expect(first.mimeType).toBe('application/json;charset=utf-8');
    expect(Object.isFrozen(first.report)).toBe(true);
    expect(Object.isFrozen(first.report.environment.viewport)).toBe(true);
  });

  test('ignores hostile project, storage, console and sharing fields', () => {
    const sentinels = [
      'PROJECT_MODEL_SENTINEL',
      'ROUTE_COORDINATES_SENTINEL',
      'IMAGE_BYTES_SENTINEL',
      'USER_LABEL_SENTINEL',
      'PRIVATE_FILENAME_SENTINEL',
      'LOCAL_PATH_SENTINEL',
      'PRIVATE_URL_SENTINEL',
      'ERROR_STACK_SENTINEL',
      'LOCAL_STORAGE_SENTINEL',
      'CONSOLE_OBJECT_SENTINEL'
    ];
    const forbiddenObject = {
      toJSON: vi.fn(() => sentinels.join('|')),
      toString: vi.fn(() => sentinels.join('|'))
    };
    const environment = {
      userAgent: 'Mozilla/5.0 Diagnostic Test',
      platform: 'MacIntel',
      viewport: { width: 1024, height: 768 },
      devicePixelRatio: 1,
      currentUrl: `https://private.invalid/${sentinels[6]}`,
      currentPath: `/Users/private/${sentinels[5]}`,
      localStorage: { recovery: sentinels[8] },
      consoleEntries: [{ arbitrary: sentinels[9] }],
      stack: `Error: ${sentinels[7]}`
    };
    Object.defineProperty(environment, 'projectState', {
      get() {
        throw new Error('Disallowed project state was read');
      }
    });

    const bundle = new DiagnosticsService({
      appVersion: '3.2.619',
      now: () => FIXED_TIME,
      environment,
      capabilities: {
        webCodecs: true,
        mediaRecorder: true,
        canvasCaptureStream: false,
        arbitraryDetails: forbiddenObject
      },
      project: { label: sentinels[3], route: sentinels[1] },
      imageBytes: `data:image/png;base64,${sentinels[2]}`,
      filename: `${sentinels[4]}.zip`,
      consoleObject: forbiddenObject
    }).createBundle();

    for (const sentinel of sentinels) {
      expect(bundle.previewText).not.toContain(sentinel);
    }
    expect(forbiddenObject.toJSON).not.toHaveBeenCalled();
    expect(forbiddenObject.toString).not.toHaveBeenCalled();
    expect(Object.keys(bundle.report)).toEqual([
      'schemaVersion',
      'appVersion',
      'generatedAt',
      'environment',
      'capabilities'
    ]);
    expect(Object.keys(bundle.report.capabilities)).toEqual([
      'webCodecs',
      'mediaRecorder',
      'canvasCaptureStream'
    ]);
  });

  test('redacts URLs, local paths and filenames even inside allowlisted strings', () => {
    const urlSentinel = 'PRIVATE_URL_SENTINEL';
    const pathSentinel = 'LOCAL_PATH_SENTINEL';
    const filenameSentinel = 'PRIVATE_FILENAME_SENTINEL';

    const urlReport = makeService({
      environment: {
        userAgent: `TestAgent https://private.invalid/${urlSentinel}`,
        platform: `/Users/private/${pathSentinel}`,
        viewport: { width: 800, height: 600 },
        devicePixelRatio: 1
      }
    }).createReport();
    const filenameReport = makeService({
      environment: {
        userAgent: `TestAgent ${filenameSentinel}.zip`,
        platform: 'MacIntel',
        viewport: { width: 800, height: 600 },
        devicePixelRatio: 1
      }
    }).createReport();

    expect(urlReport.environment.userAgent).toBe('[redacted]');
    expect(urlReport.environment.platform).toBe('[redacted]');
    expect(filenameReport.environment.userAgent).toBe('[redacted]');
    expect(JSON.stringify([urlReport, filenameReport])).not.toMatch(
      /PRIVATE_URL_SENTINEL|LOCAL_PATH_SENTINEL|PRIVATE_FILENAME_SENTINEL/
    );
  });

  test('does not coerce arbitrary values into approved fields', () => {
    const hostile = {
      toString: vi.fn(() => 'USER_LABEL_SENTINEL'),
      valueOf: vi.fn(() => 999)
    };
    const report = new DiagnosticsService({
      appVersion: hostile,
      now: () => 0,
      environment: {
        userAgent: hostile,
        platform: hostile,
        viewport: { width: hostile, height: Infinity },
        devicePixelRatio: hostile
      },
      capabilities: {
        webCodecs: hostile,
        mediaRecorder: 1,
        canvasCaptureStream: 'true'
      }
    }).createReport();

    expect(report).toMatchObject({
      appVersion: 'unavailable',
      generatedAt: '1970-01-01T00:00:00.000Z',
      environment: {
        userAgent: 'unavailable',
        platform: 'unavailable',
        viewport: { width: null, height: null },
        devicePixelRatio: null
      },
      capabilities: {
        webCodecs: false,
        mediaRecorder: false,
        canvasCaptureStream: false
      }
    });
    expect(hostile.toString).not.toHaveBeenCalled();
    expect(hostile.valueOf).not.toHaveBeenCalled();
  });

  test('has no telemetry or network side effects', () => {
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    const webSocketSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);

    const bundle = makeService().createBundle();

    expect(bundle.previewText).toContain('"schemaVersion": 1');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
  });

  test('rejects an invalid supplied clock instead of serializing it', () => {
    expect(() => makeService({ now: () => new Date('invalid') }).createReport())
      .toThrow('Diagnostics time must be a valid Date');
    expect(() => makeService({ now: '2026-08-26T12:34:56Z' }))
      .toThrow('Diagnostics now option must be a function');
  });
});
