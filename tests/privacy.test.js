import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  GITHUB_ISSUES_URL,
  GITHUB_SECURITY_URL,
  privacyMixin,
} from '../src/app/privacy.js';

function installPrivacyDOM() {
  document.body.innerHTML = `
    <main id="app">
      <button id="file-dropdown-btn" type="button">File</button>
      <button id="export-dropdown-btn" type="button">Export</button>
      <button id="copy-debug-btn" type="button">Copy diagnostics</button>
      <button id="download-debug-btn" type="button">Download diagnostics</button>
      <button id="report-bug-btn" type="button">Report a bug</button>
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
      <p id="diagnostics-description"></p>
      <p id="diagnostics-public-warning" hidden>
        GitHub Issues are public. Support is best effort.
        <a id="diagnostics-open-security" target="_blank" rel="noopener noreferrer" hidden>Private reporting</a>
      </p>
      <textarea id="diagnostics-preview"></textarea>
      <p id="diagnostics-status"></p>
      <p id="diagnostics-issues-note" hidden>
        <code id="diagnostics-issues-address"></code>
        <button id="diagnostics-copy-issues-address" type="button" hidden>Copy Issues address</button>
      </p>
      <button id="diagnostics-cancel" type="button">Cancel</button>
      <button id="diagnostics-copy" type="button">Copy</button>
      <button id="diagnostics-download" type="button">Download</button>
      <a id="diagnostics-open-issues" target="_blank" rel="noopener noreferrer" hidden>Open GitHub Issues</a>
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
  delete navigator.sendBeacon;
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
  test('Report a bug previews and warns without copying, downloading, navigating or networking', async () => {
    installPrivacyDOM();
    const copyText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copyText },
    });
    const sendBeacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeacon,
    });
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const exactText = 'DIAGNOSTIC_SENTINEL ?&#=%\n';
    const app = makeApp({
      createDiagnosticsBundle: vi.fn(() => ({
        previewText: exactText,
        copyText: exactText,
        downloadText: exactText,
        mimeType: 'application/json;charset=utf-8',
      })),
    });
    app.setupPrivacyControls();

    const reportButton = document.getElementById('report-bug-btn');
    reportButton.focus();
    reportButton.click();
    await Promise.resolve();

    expect(document.getElementById('diagnostics-modal').style.display).toBe('flex');
    expect(document.getElementById('diagnostics-title').textContent).toBe('Report a bug');
    expect(document.getElementById('diagnostics-preview').value).toBe(exactText);
    expect(document.getElementById('diagnostics-public-warning').hidden).toBe(false);
    expect(document.getElementById('diagnostics-public-warning').textContent).toContain('public');
    expect(document.getElementById('diagnostics-open-issues').hidden).toBe(false);
    expect(document.getElementById('diagnostics-issues-note').hidden).toBe(false);
    expect(document.getElementById('diagnostics-copy-issues-address').hidden).toBe(false);
    expect(document.getElementById('diagnostics-open-security').hidden).toBe(false);
    expect(document.getElementById('diagnostics-modal').getAttribute('aria-describedby'))
      .toBe('diagnostics-description diagnostics-public-warning');
    expect(document.activeElement).toBe(document.getElementById('diagnostics-title'));
    expect(app.createDiagnosticsBundle).toHaveBeenCalledOnce();
    expect(copyText).not.toHaveBeenCalled();
    expect(anchorClick).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();

    document.getElementById('diagnostics-cancel').click();
    expect(document.activeElement).toBe(reportButton);
  });

  test('GitHub hand-off is a separate exact navigation with no diagnostic URL data', async () => {
    installPrivacyDOM();
    const exactText = 'DIAGNOSTIC_SENTINEL ?&#=%\n';
    const copyText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copyText },
    });
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const sendBeacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeacon,
    });
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const app = makeApp({
      createDiagnosticsBundle: vi.fn(() => ({
        previewText: exactText,
        copyText: exactText,
        downloadText: exactText,
        mimeType: 'application/json;charset=utf-8',
      })),
    });
    app.setupPrivacyControls();

    document.getElementById('report-bug-btn').click();
    await Promise.resolve();
    const issuesLink = document.getElementById('diagnostics-open-issues');
    expect(issuesLink.href).toBe(GITHUB_ISSUES_URL);
    expect(issuesLink.target).toBe('_blank');
    expect(new Set(issuesLink.rel.split(/\s+/)))
      .toEqual(new Set(['noopener', 'noreferrer']));
    const openedURL = new URL(issuesLink.href);
    expect(openedURL.search).toBe('');
    expect(openedURL.hash).toBe('');
    expect(issuesLink.href).not.toContain(exactText);
    expect(issuesLink.href).not.toContain(encodeURIComponent(exactText));

    const issuesClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    issuesLink.addEventListener('click', event => event.preventDefault(), { once: true });
    issuesLink.dispatchEvent(issuesClick);
    expect(issuesClick.defaultPrevented).toBe(true);
    expect(copyText).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(document.getElementById('diagnostics-preview').value).toBe(exactText);
    expect(document.getElementById('diagnostics-status').textContent)
      .toContain('Diagnostics were not sent');

    expect(document.getElementById('diagnostics-issues-address').textContent)
      .toBe(GITHUB_ISSUES_URL);
    document.getElementById('diagnostics-copy-issues-address').click();
    await Promise.resolve();
    expect(copyText).toHaveBeenCalledWith(GITHUB_ISSUES_URL);

    const securityLink = document.getElementById('diagnostics-open-security');
    expect(securityLink.href).toBe(GITHUB_SECURITY_URL);
    expect(securityLink.target).toBe('_blank');
    expect(new Set(securityLink.rel.split(/\s+/)))
      .toEqual(new Set(['noopener', 'noreferrer']));
    expect(securityLink.href).not.toContain(exactText);
    const securityClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    securityLink.addEventListener('click', event => event.preventDefault(), { once: true });
    securityLink.dispatchEvent(securityClick);
    expect(securityClick.defaultPrevented).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  test('address-copy failure preserves the report and visible manual fallback', async () => {
    installPrivacyDOM();
    const exactText = '{"schemaVersion":1}\n';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard unavailable')) },
    });
    const app = makeApp({
      createDiagnosticsBundle: vi.fn(() => ({
        previewText: exactText,
        copyText: exactText,
        downloadText: exactText,
        mimeType: 'application/json;charset=utf-8',
      })),
    });
    app.setupPrivacyControls();
    document.getElementById('report-bug-btn').click();
    await Promise.resolve();

    document.getElementById('diagnostics-copy-issues-address').click();
    await Promise.resolve();
    expect(document.getElementById('diagnostics-modal').style.display).toBe('flex');
    expect(document.getElementById('diagnostics-preview').value).toBe(exactText);
    expect(document.getElementById('diagnostics-issues-note').hidden).toBe(false);
    expect(document.getElementById('diagnostics-issues-address').textContent)
      .toBe(GITHUB_ISSUES_URL);
    expect(document.getElementById('diagnostics-status').textContent)
      .toContain('Address copy failed');
  });

  test('report mode reuses one exact bundle for copy and download and stays open', async () => {
    installPrivacyDOM();
    const copyText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copyText },
    });
    const exactText = '{"schemaVersion":1,"source":"report"}\n';
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
    document.getElementById('report-bug-btn').click();
    await Promise.resolve();

    document.getElementById('diagnostics-copy').click();
    await Promise.resolve();
    document.getElementById('diagnostics-download').click();

    expect(app.createDiagnosticsBundle).toHaveBeenCalledOnce();
    expect(copyText).toHaveBeenCalledWith(exactText);
    expect(blobs).toHaveLength(1);
    expect(blobs[0].parts).toEqual([exactText]);
    expect(document.getElementById('diagnostics-preview').value).toBe(exactText);
    expect(document.getElementById('diagnostics-modal').style.display).toBe('flex');
    expect(document.getElementById('diagnostics-status').textContent)
      .toBe('Diagnostics downloaded. Nothing was sent.');
  });

  test('utility diagnostics hides report-only content and restores Export focus', async () => {
    installPrivacyDOM();
    const exactText = '{"schemaVersion":1}\n';
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
    expect(document.getElementById('diagnostics-title').textContent)
      .toBe('Preview diagnostics');
    expect(document.getElementById('diagnostics-public-warning').hidden).toBe(true);
    expect(document.getElementById('diagnostics-open-issues').hidden).toBe(true);
    expect(document.getElementById('diagnostics-issues-note').hidden).toBe(true);
    expect(document.getElementById('diagnostics-copy-issues-address').hidden).toBe(true);
    expect(document.getElementById('diagnostics-open-security').hidden).toBe(true);
    expect(document.getElementById('diagnostics-modal').getAttribute('aria-describedby'))
      .toBe('diagnostics-description');

    document.getElementById('diagnostics-cancel').click();
    expect(document.activeElement).toBe(document.getElementById('export-dropdown-btn'));
  });

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
