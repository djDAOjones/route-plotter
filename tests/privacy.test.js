import { afterEach, describe, expect, test, vi } from 'vitest';

import { privacyMixin } from '../src/app/privacy.js';

function installPrivacyDOM() {
  document.body.innerHTML = `
    <main id="app">
      <button id="file-dropdown-btn" type="button">File</button>
      <button id="export-dropdown-btn" type="button">Export</button>
      <button id="copy-debug-btn" type="button">Copy diagnostics</button>
      <button id="download-debug-btn" type="button">Download diagnostics</button>
    </main>
    <div id="share-disclosure-modal" role="dialog" aria-modal="true" style="display:none">
      <button type="button" data-share-disclosure-close>Close</button>
      <h3 id="share-disclosure-title"></h3>
      <p id="share-disclosure-description"></p>
      <button id="share-disclosure-cancel" type="button">Cancel</button>
      <button id="share-disclosure-confirm" type="button">Continue</button>
    </div>
    <div id="diagnostics-modal" role="dialog" aria-modal="true" style="display:none">
      <button type="button" data-diagnostics-close>Close</button>
      <h3 id="diagnostics-title">Preview diagnostics</h3>
      <textarea id="diagnostics-preview"></textarea>
      <p id="diagnostics-status"></p>
      <button id="diagnostics-cancel" type="button">Cancel</button>
      <button id="diagnostics-copy" type="button">Copy</button>
      <button id="diagnostics-download" type="button">Download</button>
    </div>
  `;
}

function makeApp(overrides = {}) {
  return Object.assign({}, privacyMixin, {
    appVersion: '3.2.619',
    announce: vi.fn(),
    saveProject: vi.fn().mockResolvedValue(undefined),
    exportHTML: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete navigator.clipboard;
});

describe('manual file disclosure', () => {
  test('project save does not begin until the user confirms its sharing boundary', async () => {
    installPrivacyDOM();
    const app = makeApp();
    app.setupPrivacyControls();

    const cancelled = app.requestProjectSave();
    await Promise.resolve();

    expect(app.saveProject).not.toHaveBeenCalled();
    expect(document.getElementById('share-disclosure-modal').style.display).toBe('flex');
    expect(document.getElementById('share-disclosure-description').textContent)
      .toContain('original image bytes');

    document.getElementById('share-disclosure-cancel').click();
    await expect(cancelled).resolves.toBe(false);
    expect(app.saveProject).not.toHaveBeenCalled();

    const confirmed = app.requestProjectSave();
    await Promise.resolve();
    document.getElementById('share-disclosure-confirm').click();
    await expect(confirmed).resolves.toBe(true);
    expect(app.saveProject).toHaveBeenCalledOnce();
  });

  test('standalone HTML uses its own disclosure and exact export action', async () => {
    installPrivacyDOM();
    const app = makeApp();
    app.setupPrivacyControls();

    const pending = app.requestHTMLExport();
    await Promise.resolve();
    expect(document.getElementById('share-disclosure-title').textContent)
      .toBe('Export standalone HTML?');
    expect(app.exportHTML).not.toHaveBeenCalled();

    document.getElementById('share-disclosure-confirm').click();
    await expect(pending).resolves.toBe(true);
    expect(app.exportHTML).toHaveBeenCalledOnce();
    expect(app.saveProject).not.toHaveBeenCalled();
  });
});

describe('diagnostics preview boundary', () => {
  test('copy uses the exact visible allowlisted bundle and never reads a console buffer', async () => {
    installPrivacyDOM();
    const copyText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copyText },
    });
    const exactText = '{\n  "schemaVersion": 1\n}\n';
    const app = makeApp({
      createDiagnosticsBundle: vi.fn(() => ({
        previewText: exactText,
        copyText: exactText,
        downloadText: exactText,
        mimeType: 'application/json;charset=utf-8',
      })),
    });
    app.setupPrivacyControls();

    document.getElementById('copy-debug-btn').click();
    await Promise.resolve();
    expect(document.getElementById('diagnostics-preview').value).toBe(exactText);
    expect(copyText).not.toHaveBeenCalled();

    document.getElementById('diagnostics-copy').click();
    await Promise.resolve();
    expect(copyText).toHaveBeenCalledWith(exactText);
    expect(document.getElementById('diagnostics-status').textContent).toBe('Diagnostics copied.');
  });

  test('download uses the same previewed bytes and only begins after the preview action', async () => {
    installPrivacyDOM();
    const exactText = '{"schemaVersion":1}\n';
    const blobs = [];
    class MockBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.type = options.type;
        blobs.push(this);
      }
    }
    vi.stubGlobal('Blob', MockBlob);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:diagnostics'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const app = makeApp({
      createDiagnosticsBundle: vi.fn(() => ({
        previewText: exactText,
        copyText: exactText,
        downloadText: exactText,
        mimeType: 'application/json;charset=utf-8',
      })),
    });
    app.setupPrivacyControls();

    document.getElementById('download-debug-btn').click();
    await Promise.resolve();
    expect(blobs).toHaveLength(0);
    expect(document.getElementById('diagnostics-preview').value).toBe(exactText);

    document.getElementById('diagnostics-download').click();
    expect(blobs).toHaveLength(1);
    expect(blobs[0].parts).toEqual([exactText]);
    expect(blobs[0].type).toBe('application/json;charset=utf-8');
    expect(document.getElementById('diagnostics-modal').style.display).toBe('none');
  });
});
