/**
 * Privacy-first technical diagnostics.
 *
 * This service is deliberately pure: it reads no browser globals, storage,
 * project models, console buffer or network state. Callers supply the small
 * technical context explicitly and receive one immutable serialized bundle
 * to use unchanged for preview, copy and download.
 */

export const DIAGNOSTICS_SCHEMA_VERSION = 1;

const UNAVAILABLE = 'unavailable';
const REDACTED = '[redacted]';
const MAX_APP_VERSION_LENGTH = 64;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_PLATFORM_LENGTH = 128;

// Browser-supplied user-agent/platform strings are allowlisted, but a custom
// browser value can still contain a URL, local path or filename. Reject those
// shapes rather than allowing an approved field to become a smuggling route.
const SENSITIVE_TECHNICAL_STRING_PATTERNS = [
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/i,
  /(?:^|\s)(?:\/(?:Users|home|private|tmp|var|Volumes)\/|[a-z]:[\\/])\S+/i,
  /(?:^|\s)[^/\\\s]+\.[a-z][a-z0-9]{0,9}(?:$|\s)/i
];

function normalizeAppVersion(value) {
  if (typeof value !== 'string') return UNAVAILABLE;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_APP_VERSION_LENGTH) return UNAVAILABLE;
  return /^[0-9a-z][0-9a-z.+_-]*$/i.test(trimmed) ? trimmed : UNAVAILABLE;
}

function normalizeTechnicalString(value, maxLength) {
  if (typeof value !== 'string') return UNAVAILABLE;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return UNAVAILABLE;
  if (SENSITIVE_TECHNICAL_STRING_PATTERNS.some(pattern => pattern.test(normalized))) {
    return REDACTED;
  }
  return normalized.slice(0, maxLength);
}

function normalizeDimension(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function normalizeDevicePixelRatio(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 1000) / 1000;
}

function normalizeGeneratedAt(value) {
  const date = value instanceof Date
    ? new Date(value.getTime())
    : typeof value === 'number'
      ? new Date(value)
      : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new TypeError('Diagnostics time must be a valid Date or epoch millisecond value');
  }
  return date.toISOString();
}

function freezeReport(report) {
  Object.freeze(report.environment.viewport);
  Object.freeze(report.environment);
  Object.freeze(report.capabilities);
  return Object.freeze(report);
}

export class DiagnosticsService {
  /**
   * @param {Object} options
   * @param {string} options.appVersion - Public application version
   * @param {Function} options.now - Returns a Date or epoch milliseconds
   * @param {Object} options.environment - Explicit browser technical fields
   * @param {Object} options.capabilities - Explicit boolean capability fields
   */
  constructor({
    appVersion = UNAVAILABLE,
    now = () => new Date(),
    environment = {},
    capabilities = {}
  } = {}) {
    if (typeof now !== 'function') {
      throw new TypeError('Diagnostics now option must be a function');
    }

    const viewport = environment?.viewport;
    this._now = now;
    this._technicalContext = Object.freeze({
      appVersion: normalizeAppVersion(appVersion),
      userAgent: normalizeTechnicalString(environment?.userAgent, MAX_USER_AGENT_LENGTH),
      platform: normalizeTechnicalString(environment?.platform, MAX_PLATFORM_LENGTH),
      viewportWidth: normalizeDimension(viewport?.width),
      viewportHeight: normalizeDimension(viewport?.height),
      devicePixelRatio: normalizeDevicePixelRatio(environment?.devicePixelRatio),
      webCodecs: capabilities?.webCodecs === true,
      mediaRecorder: capabilities?.mediaRecorder === true,
      canvasCaptureStream: capabilities?.canvasCaptureStream === true
    });
  }

  /**
   * Create the fixed-schema, allowlist-only diagnostics report.
   * @returns {Readonly<Object>}
   */
  createReport() {
    const context = this._technicalContext;
    return freezeReport({
      schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
      appVersion: context.appVersion,
      generatedAt: normalizeGeneratedAt(this._now()),
      environment: {
        userAgent: context.userAgent,
        platform: context.platform,
        viewport: {
          width: context.viewportWidth,
          height: context.viewportHeight
        },
        devicePixelRatio: context.devicePixelRatio
      },
      capabilities: {
        webCodecs: context.webCodecs,
        mediaRecorder: context.mediaRecorder,
        canvasCaptureStream: context.canvasCaptureStream
      }
    });
  }

  /**
   * Produce one byte-identical text value for every future UI destination.
   * No copy, download, telemetry or network side effect occurs here.
   * @returns {Readonly<Object>}
   */
  createBundle() {
    const report = this.createReport();
    const text = `${JSON.stringify(report, null, 2)}\n`;
    return Object.freeze({
      report,
      previewText: text,
      copyText: text,
      downloadText: text,
      mimeType: 'application/json;charset=utf-8'
    });
  }
}
