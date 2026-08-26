/**
 * Explicit manual-sharing boundaries for project/HTML export and diagnostics.
 *
 * RoutePlotter prototype mixin: the two exported-file commands pause at a
 * disclosure dialog, while diagnostics are generated from a fixed technical
 * allowlist and shown byte-for-byte before copy or download.
 */
import { DiagnosticsService } from '../services/DiagnosticsService.js';
import { createFocusTrap } from '../utils/focusTrap.js';

export const GITHUB_ISSUES_URL = 'https://github.com/djDAOjones/route-plotter/issues';
export const GITHUB_SECURITY_URL =
  'https://github.com/djDAOjones/route-plotter/security/advisories/new';

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
    this._diagnosticsTitle = document.getElementById('diagnostics-title');
    this._diagnosticsDescription = document.getElementById('diagnostics-description');
    this._diagnosticsPreview = document.getElementById('diagnostics-preview');
    this._diagnosticsStatus = document.getElementById('diagnostics-status');
    this._diagnosticsCopy = document.getElementById('diagnostics-copy');
    this._diagnosticsDownload = document.getElementById('diagnostics-download');
    this._diagnosticsOpenIssues = document.getElementById('diagnostics-open-issues');
    this._diagnosticsReportWarning = document.getElementById('diagnostics-public-warning');
    this._diagnosticsIssuesNote = document.getElementById('diagnostics-issues-note');
    this._diagnosticsIssuesAddress = document.getElementById('diagnostics-issues-address');
    this._diagnosticsCopyIssuesAddress = document.getElementById('diagnostics-copy-issues-address');
    this._diagnosticsOpenSecurity = document.getElementById('diagnostics-open-security');
    this._diagnosticsCancel = document.getElementById('diagnostics-cancel');
    this._reportBugButton = document.getElementById('report-bug-btn');
    this._diagnosticsTrap = createFocusTrap(modal);

    if (this._diagnosticsOpenIssues) {
      this._diagnosticsOpenIssues.href = GITHUB_ISSUES_URL;
    }
    if (this._diagnosticsIssuesAddress) {
      this._diagnosticsIssuesAddress.textContent = GITHUB_ISSUES_URL;
    }
    if (this._diagnosticsOpenSecurity) {
      this._diagnosticsOpenSecurity.href = GITHUB_SECURITY_URL;
    }

    const close = () => this._closeDiagnosticsPreview();
    this._diagnosticsCancel?.addEventListener('click', close);
    modal.querySelector('[data-diagnostics-close]')?.addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    modal.addEventListener('focustrap:escape', close);

    this._diagnosticsCopy?.addEventListener('click', () => void this._copyDiagnostics());
    this._diagnosticsDownload?.addEventListener('click', () => this._downloadDiagnostics());
    this._diagnosticsOpenIssues?.addEventListener('click', () => {
      this._diagnosticsStatus.textContent =
        'GitHub Issues was requested in a new tab. Diagnostics were not sent.';
    });
    this._diagnosticsOpenSecurity?.addEventListener('click', () => {
      this._diagnosticsStatus.textContent =
        'Private vulnerability reporting was requested in a new tab. Diagnostics were not sent.';
    });
    this._diagnosticsCopyIssuesAddress?.addEventListener('click', () => {
      void this._copyGitHubIssuesAddress();
    });

    document.getElementById('copy-debug-btn')?.addEventListener('click', () => {
      this._openDiagnosticsPreview(
        this._diagnosticsCopy,
        document.getElementById('export-dropdown-btn'),
        'diagnostics'
      );
    });
    document.getElementById('download-debug-btn')?.addEventListener('click', () => {
      this._openDiagnosticsPreview(
        this._diagnosticsDownload,
        document.getElementById('export-dropdown-btn'),
        'diagnostics'
      );
    });
    this._reportBugButton?.addEventListener('click', () => {
      this._openDiagnosticsPreview(
        null,
        this._reportBugButton,
        'bug-report'
      );
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
  _openDiagnosticsPreview(initialFocus, returnFocus = null, purpose = 'diagnostics') {
    if (!this._diagnosticsModal || this._diagnosticsTrap.isActive) return;
    this._diagnosticsBundle = this.createDiagnosticsBundle();
    this._diagnosticsPreview.value = this._diagnosticsBundle.previewText;
    this._diagnosticsStatus.textContent = '';
    this._setDiagnosticsPurpose(purpose);
    this._diagnosticsModal.style.display = 'flex';
    queueMicrotask(() => {
      if (this._diagnosticsModal.style.display === 'none') return;
      this._diagnosticsTrap.activate(initialFocus, returnFocus);
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
    this._setDiagnosticsPurpose('diagnostics');
  },

  /** Keep report-only disclosure and hand-off controls out of utility mode. */
  _setDiagnosticsPurpose(purpose) {
    const isBugReport = purpose === 'bug-report';
    this._diagnosticsPurpose = purpose;
    this._diagnosticsModal?.setAttribute(
      'aria-describedby',
      isBugReport
        ? 'diagnostics-description diagnostics-public-warning'
        : 'diagnostics-description'
    );
    if (this._diagnosticsTitle) {
      this._diagnosticsTitle.textContent = isBugReport ? 'Report a bug' : 'Preview diagnostics';
    }
    if (this._diagnosticsDescription) {
      this._diagnosticsDescription.textContent = isBugReport
        ? 'Review the exact technical information below. Copy or download it only if you want to include it in your report. Nothing is copied, downloaded or sent automatically.'
        : 'Review the exact technical information below. It excludes project content, images, filenames, browser storage, console logs, URLs and paths. Nothing is sent automatically.';
    }
    if (this._diagnosticsReportWarning) {
      this._diagnosticsReportWarning.hidden = !isBugReport;
    }
    if (this._diagnosticsOpenIssues) {
      this._diagnosticsOpenIssues.hidden = !isBugReport;
    }
    if (this._diagnosticsIssuesNote) {
      this._diagnosticsIssuesNote.hidden = !isBugReport;
    }
    if (this._diagnosticsCopyIssuesAddress) {
      this._diagnosticsCopyIssuesAddress.hidden = !isBugReport;
    }
    if (this._diagnosticsOpenSecurity) {
      this._diagnosticsOpenSecurity.hidden = !isBugReport;
    }
  },

  /** Copy only the fixed support address after a separate explicit action. */
  async _copyGitHubIssuesAddress() {
    if (!this._diagnosticsBundle) return false;
    try {
      await navigator.clipboard.writeText(GITHUB_ISSUES_URL);
      this._diagnosticsStatus.textContent = 'GitHub Issues address copied. Diagnostics were not copied or sent.';
      return true;
    } catch {
      this._diagnosticsStatus.textContent =
        'Address copy failed. Select the GitHub Issues address shown above; diagnostics were not copied or sent.';
      return false;
    }
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
    if (this._diagnosticsPurpose === 'bug-report') {
      this._diagnosticsStatus.textContent = 'Diagnostics downloaded. Nothing was sent.';
    } else {
      this.announce('Diagnostics downloaded');
      this._closeDiagnosticsPreview();
    }
  },
};
