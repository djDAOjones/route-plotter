/**
 * Explicit manual-sharing boundaries for project/HTML export and diagnostics.
 *
 * RoutePlotter prototype mixin: the two exported-file commands pause at a
 * disclosure dialog, while diagnostics are generated from a fixed technical
 * allowlist and shown byte-for-byte before copy or download.
 */
import { DiagnosticsService } from '../services/DiagnosticsService.js';
import { createFocusTrap } from '../utils/focusTrap.js';

const SHARE_DISCLOSURES = Object.freeze({
  project: Object.freeze({
    title: 'Save project file?',
    description:
      'The project file contains your route, timings, crowd settings, original image bytes and stored image filenames. Nothing is uploaded automatically; this information leaves your browser only if you share the saved file.',
    action: 'Save project',
    returnFocusId: 'file-dropdown-btn',
  }),
  html: Object.freeze({
    title: 'Export standalone HTML?',
    description:
      'The HTML file contains your route, timings, crowd settings and original embedded image bytes. Stored image filenames or metadata may also travel with the file. Nothing is uploaded automatically; this information leaves your browser only if you share the export.',
    action: 'Export HTML',
    returnFocusId: 'export-dropdown-btn',
  }),
});

function downloadText(text, mimeType, filename) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const privacyMixin = {
  /** Wire both modal boundaries once the app DOM and dropdowns exist. */
  setupPrivacyControls() {
    this._setupShareDisclosure();
    this._setupDiagnosticsPreview();
  },

  /**
   * Gate the project download behind its explicit sharing disclosure.
   * @returns {Promise<boolean>} Whether a project file was requested
   */
  async requestProjectSave() {
    if (this._shareRequestInFlight) return false;
    this._shareRequestInFlight = true;
    try {
      if (!await this._confirmSharedFile('project')) return false;
      await this.saveProject();
      return true;
    } finally {
      this._shareRequestInFlight = false;
    }
  },

  /**
   * Gate the standalone player download behind its sharing disclosure.
   * @returns {Promise<boolean>} Whether an HTML export was requested
   */
  async requestHTMLExport() {
    if (this._shareRequestInFlight) return false;
    this._shareRequestInFlight = true;
    try {
      if (!await this._confirmSharedFile('html')) return false;
      await this.exportHTML();
      return true;
    } finally {
      this._shareRequestInFlight = false;
    }
  },

  /** @private */
  _setupShareDisclosure() {
    const modal = document.getElementById('share-disclosure-modal');
    if (!modal) return;

    this._shareDisclosureModal = modal;
    this._shareDisclosureTitle = document.getElementById('share-disclosure-title');
    this._shareDisclosureDescription = document.getElementById('share-disclosure-description');
    this._shareDisclosureConfirm = document.getElementById('share-disclosure-confirm');
    this._shareDisclosureCancel = document.getElementById('share-disclosure-cancel');
    this._shareDisclosureTrap = createFocusTrap(modal);

    const close = (confirmed = false) => this._closeShareDisclosure(confirmed);
    this._shareDisclosureConfirm?.addEventListener('click', () => close(true));
    this._shareDisclosureCancel?.addEventListener('click', () => close(false));
    modal.querySelector('[data-share-disclosure-close]')
      ?.addEventListener('click', () => close(false));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close(false);
    });
    modal.addEventListener('focustrap:escape', () => close(false));
  },

  /**
   * Show the disclosure and resolve only after an explicit choice.
   * @param {'project'|'html'} kind
   * @returns {Promise<boolean>}
   * @private
   */
  _confirmSharedFile(kind) {
    const disclosure = SHARE_DISCLOSURES[kind];
    if (!disclosure || !this._shareDisclosureModal) {
      throw new Error('The file-sharing disclosure is unavailable');
    }

    this._shareDisclosureTitle.textContent = disclosure.title;
    this._shareDisclosureDescription.textContent = disclosure.description;
    this._shareDisclosureConfirm.textContent = disclosure.action;
    this._shareDisclosureModal.style.display = 'flex';

    return new Promise(resolve => {
      this._shareDisclosureResolve = resolve;
      queueMicrotask(() => {
        if (this._shareDisclosureModal.style.display === 'none') return;
        const returnFocus = document.getElementById(disclosure.returnFocusId);
        this._shareDisclosureTrap.activate(this._shareDisclosureCancel, returnFocus);
      });
    });
  },

  /** @private */
  _closeShareDisclosure(confirmed) {
    if (!this._shareDisclosureResolve) return;
    const resolve = this._shareDisclosureResolve;
    this._shareDisclosureResolve = null;
    this._shareDisclosureModal.style.display = 'none';
    this._shareDisclosureTrap.deactivate();
    resolve(confirmed);
  },

  /** @private */
  _setupDiagnosticsPreview() {
    const modal = document.getElementById('diagnostics-modal');
    if (!modal) return;

    this._diagnosticsModal = modal;
    this._diagnosticsPreview = document.getElementById('diagnostics-preview');
    this._diagnosticsStatus = document.getElementById('diagnostics-status');
    this._diagnosticsCopy = document.getElementById('diagnostics-copy');
    this._diagnosticsDownload = document.getElementById('diagnostics-download');
    this._diagnosticsCancel = document.getElementById('diagnostics-cancel');
    this._diagnosticsTrap = createFocusTrap(modal);

    const close = () => this._closeDiagnosticsPreview();
    this._diagnosticsCancel?.addEventListener('click', close);
    modal.querySelector('[data-diagnostics-close]')?.addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    modal.addEventListener('focustrap:escape', close);

    this._diagnosticsCopy?.addEventListener('click', () => void this._copyDiagnostics());
    this._diagnosticsDownload?.addEventListener('click', () => this._downloadDiagnostics());

    document.getElementById('copy-debug-btn')?.addEventListener('click', () => {
      this._openDiagnosticsPreview(this._diagnosticsCopy);
    });
    document.getElementById('download-debug-btn')?.addEventListener('click', () => {
      this._openDiagnosticsPreview(this._diagnosticsDownload);
    });
  },

  /** Create a fresh, fixed-schema bundle for the visible technical context. */
  createDiagnosticsBundle() {
    return new DiagnosticsService({
      appVersion: this.appVersion,
      environment: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        devicePixelRatio: window.devicePixelRatio,
      },
      capabilities: {
        webCodecs: typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined',
        mediaRecorder: typeof MediaRecorder !== 'undefined',
        canvasCaptureStream: typeof HTMLCanvasElement.prototype.captureStream === 'function',
      },
    }).createBundle();
  },

  /** @private */
  _openDiagnosticsPreview(initialFocus) {
    if (!this._diagnosticsModal || this._diagnosticsTrap.isActive) return;
    this._diagnosticsBundle = this.createDiagnosticsBundle();
    this._diagnosticsPreview.value = this._diagnosticsBundle.previewText;
    this._diagnosticsStatus.textContent = '';
    this._diagnosticsModal.style.display = 'flex';
    queueMicrotask(() => {
      if (this._diagnosticsModal.style.display === 'none') return;
      this._diagnosticsTrap.activate(
        initialFocus,
        document.getElementById('export-dropdown-btn')
      );
    });
  },

  /** @private */
  _closeDiagnosticsPreview() {
    if (!this._diagnosticsModal || this._diagnosticsModal.style.display === 'none') return;
    this._diagnosticsModal.style.display = 'none';
    this._diagnosticsTrap.deactivate();
    this._diagnosticsBundle = null;
    this._diagnosticsPreview.value = '';
    this._diagnosticsStatus.textContent = '';
  },

  /** @private */
  async _copyDiagnostics() {
    if (!this._diagnosticsBundle) return;
    try {
      await navigator.clipboard.writeText(this._diagnosticsBundle.copyText);
      this._diagnosticsStatus.textContent = 'Diagnostics copied.';
      this.announce('Diagnostics copied');
    } catch {
      this._diagnosticsStatus.textContent = 'Copy failed. You can select the preview text manually.';
      this.announce('Diagnostics copy failed');
    }
  },

  /** @private */
  _downloadDiagnostics() {
    if (!this._diagnosticsBundle) return;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    downloadText(
      this._diagnosticsBundle.downloadText,
      this._diagnosticsBundle.mimeType,
      `route-plotter-diagnostics-${timestamp}.json`
    );
    this.announce('Diagnostics downloaded');
    this._closeDiagnosticsPreview();
  },
};
