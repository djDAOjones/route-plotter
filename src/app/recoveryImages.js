/**
 * Browser recovery's images (DEF-98): which the record keeps, how they reach
 * the image store before the record names them, how a restore reads them
 * back, what is said when one is not kept, the prompt for a background that
 * did not come back, and Clear All's part.
 *
 * The record (`routePlotter_autosave`) stays the route model it was, and
 * gains one field, `recoveryImages`, its manifest (format 2): the background
 * kept (its key in the image store, file name, type and size) or null; each
 * kept custom image (its asset id, key and file name); and each image not
 * kept (its role, file name and why). The model keeps its custom marker and
 * path-head references for images kept; an image not kept gets the built-in
 * fallback it always had (a dot, an arrow). A record without the field is
 * from before this release: one with inline image bytes (older still)
 * restores them, one without kept no images and says so.
 *
 * The order of writes. Each write is one revision: the model, the images it
 * references and their names, captured at once. Its images are put into the
 * store (`src/services/RecoveryImageStore.js`) before a record naming them
 * is written: the record names an image only while the store holds it, as a
 * hold of the store's lock has seen it (`verified`), or as the record now in
 * `localStorage` names it (no deletion can take an entry that record names,
 * and Clear All removes the record before the images). So a record written
 * at any moment, the `pagehide` flush's included, names only images stored;
 * one written before an image's put has landed lists it as not kept, the
 * page having closed first.
 *
 * Images reachable only through undo history are not kept, as exports drop
 * them (DEF-23): the revision collects references from the live model only,
 * and recovery never prunes the image asset service.
 *
 * @module app/recoveryImages
 */

import { ImageAsset } from '../models/ImageAsset.js';
import { collectImageAssetReferences } from '../utils/assetReferences.js';
import { RECOVERY_REASONS, RECOVERY_IMAGE_LIMITS } from '../services/RecoveryImageStore.js';
import { STORAGE } from '../config/constants.js';
import { returnFocus } from '../components/ModeBanner.js';

/** The record's manifest format: 2, the first with images (DEF-98). */
export const RECOVERY_MANIFEST_VERSION = 2;

const R = RECOVERY_REASONS;

// What browser recovery did or could not do must be heard (DEF-45): never
// displaced by routine messages.
const RECOVERY_NOTICE = Object.freeze({ essential: true });

const KEY_PATTERN = /^sha256-[0-9a-f]{64}$/;

/** Why an image was not kept, in the author's words. */
const REASON_WORDS = Object.freeze({
  [R.TOO_LARGE]: 'it is over the size browser recovery keeps for one image',
  [R.OVER_TOTAL]: 'the custom images together are over what browser recovery keeps',
  [R.REFUSED]: "the browser's storage refused it",
  [R.PENDING]: 'the page closed before it was stored',
  [R.MISSING]: "it is no longer in the browser's storage",
  [R.UNREADABLE]: 'it could not be read',
  [R.UNAVAILABLE]: 'this browser cannot store images for recovery',
  [R.LEGACY]: 'recovery before this release kept no images',
});

/** The app's store, or null where it cannot keep images. */
function storeOf(app) {
  const store = app?.recoveryImageStore;
  return store?.available ? store : null;
}

function validName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 255 ? name : null;
}

function waypointLabel(waypoint, index) {
  const name = typeof waypoint?.name === 'string' ? waypoint.name.trim() : '';
  return name || `waypoint ${index + 1}`;
}

function describeImage(image) {
  if (typeof image.dataURL === 'string') {
    try {
      const { mimeType, byteLength } = ImageAsset.inspectDataURL(image.dataURL);
      return { ...image, mimeType, byteLength };
    } catch {
      return { ...image, dataURL: null, mimeType: null, byteLength: 0 };
    }
  }
  return { ...image, dataURL: null, mimeType: null, byteLength: 0 };
}

/**
 * The images a model references, in the order recovery keeps them when not
 * all fit (the lead's proposal, for the owner to confirm): the background,
 * then the path head's image, then each waypoint's marker image in waypoint
 * order, then any other reference. One entry per image, in the first role it
 * plays; an image several waypoints share lists them all.
 * @param {Object} app
 * @param {{waypoints: Array<Object>, styles: Object}} model - Serialised, or the live objects
 * @param {Object} [snapshot] - The serialised model, for references held elsewhere
 * @returns {Array<Object>}
 */
function liveImages(app, model, snapshot = null) {
  const images = [];
  const background = app.background?.image;
  if (background) {
    const cache = app._autosaveBackgroundCache;
    images.push(describeImage({
      role: 'background',
      name: validName(app._backgroundName),
      dataURL: cache?.image === background && typeof cache.dataURL === 'string' ? cache.dataURL : null,
      width: Number(background.naturalWidth || background.width) || 0,
      height: Number(background.naturalHeight || background.height) || 0,
    }));
  }
  const byAsset = new Map();
  const claim = (assetId, role, waypoint = null, index = 0) => {
    if (typeof assetId !== 'string' || assetId.length === 0) return;
    let image = byAsset.get(assetId);
    if (!image) {
      const asset = app.imageAssetService?.getAsset?.(assetId) ?? null;
      image = describeImage({
        role,
        assetId,
        name: validName(asset?.name),
        dataURL: asset?.base64 || null,
        width: Number(asset?.width) || 0,
        height: Number(asset?.height) || 0,
        waypoints: [],
        fallback: null,
      });
      byAsset.set(assetId, image);
      images.push(image);
    }
    if (role === 'path-head' && model.styles?.pathHead?.style === 'custom') image.fallback ??= 'arrow';
    if (waypoint) {
      image.waypoints.push({ id: waypoint.id, label: waypointLabel(waypoint, index) });
      if (waypoint.markerStyle === 'custom') image.fallback ??= 'dot';
    }
  };
  claim(model.styles?.pathHead?.imageAssetId, 'path-head');
  (model.waypoints || []).forEach((waypoint, index) => claim(waypoint.customImageAssetId, 'marker', waypoint, index));
  if (snapshot) {
    for (const assetId of collectImageAssetReferences({ ...snapshot, imageAssets: [] })) claim(assetId, 'image');
  }
  return images;
}

/** An image not kept, as the manifest and the warnings carry it. */
function omissionOf(image, reason) {
  const entry = { role: image.role, name: validName(image.name), reason };
  if (image.assetId) entry.assetId = image.assetId;
  if (image.waypoints?.length) entry.waypoints = image.waypoints.map(({ id, label }) => ({ id, label }));
  if (image.fallback) entry.fallback = image.fallback;
  return entry;
}

/**
 * Which images fit what recovery keeps, in keeping order: each is kept if it
 * is within the per-image limits and, for a custom image, still within the
 * totals after those before it. So no image is ever left out for one after
 * it, and a smaller one later may still fit.
 * @param {Array<Object>} images
 * @param {Object} limits
 * @returns {{kept: Array<Object>, omitted: Array<Object>}}
 */
export function selectWithinLimits(images, limits = RECOVERY_IMAGE_LIMITS) {
  const kept = [];
  const omitted = [];
  let count = 0;
  let bytes = 0;
  let pixels = 0;
  for (const image of images) {
    if (!image.dataURL || !image.mimeType) {
      omitted.push(omissionOf(image, R.UNREADABLE));
      continue;
    }
    const maxBytes = image.role === 'background'
      ? Math.min(limits.MAX_BYTES, limits.MAX_BACKGROUND_BYTES)
      : limits.MAX_BYTES;
    const imagePixels = image.width * image.height;
    if (image.byteLength > maxBytes || image.width > limits.MAX_DIMENSION ||
        image.height > limits.MAX_DIMENSION || imagePixels > limits.MAX_PIXELS) {
      omitted.push(omissionOf(image, R.TOO_LARGE));
      continue;
    }
    if (image.role !== 'background') {
      if (count + 1 > limits.MAX_ASSETS || bytes + image.byteLength > limits.MAX_ASSET_BYTES_TOTAL ||
          pixels + imagePixels > limits.MAX_IMAGE_PIXELS_TOTAL) {
        omitted.push(omissionOf(image, R.OVER_TOTAL));
        continue;
      }
      count += 1;
      bytes += image.byteLength;
      pixels += imagePixels;
    }
    kept.push(image);
  }
  return { kept, omitted };
}

/**
 * The model with today's built-in fallbacks for the custom images not kept
 * (`omittedAssetIds`), or for every custom image (null): a marker becomes a
 * dot and a custom path head the arrow, so the record always restores. Those
 * kept keep their references. Moved here from persistence.js and made
 * selective (DEF-98).
 * @param {Object} modelSnapshot
 * @param {Set<string>|null} [omittedAssetIds]
 * @returns {Object}
 */
export function stripAssetReferences(modelSnapshot, omittedAssetIds = null) {
  const drops = assetId => omittedAssetIds === null || (Boolean(assetId) && omittedAssetIds.has(assetId));
  const pathHead = modelSnapshot.styles?.pathHead;
  return {
    ...modelSnapshot,
    waypoints: (modelSnapshot.waypoints || []).map(waypoint => (drops(waypoint.customImageAssetId)
      ? {
          ...waypoint,
          customImage: null,
          customImageAssetId: null,
          markerStyle: waypoint.markerStyle === 'custom' ? 'dot' : waypoint.markerStyle,
        }
      : { ...waypoint, customImage: null })),
    styles: {
      ...modelSnapshot.styles,
      pathHead: pathHead
        ? (drops(pathHead.imageAssetId)
            ? {
                ...pathHead,
                style: pathHead.style === 'custom' ? 'arrow' : pathHead.style,
                image: null,
                imageAssetId: null,
              }
            : { ...pathHead, image: null })
        : pathHead,
    },
  };
}

/** The image-store keys a record names (its manifest's), or null if it cannot be understood. */
function manifestKeys(data) {
  const keys = new Set();
  const manifest = data?.recoveryImages;
  if (manifest == null) return keys;
  if (typeof manifest !== 'object') return null;
  if (typeof manifest.background?.key === 'string') keys.add(manifest.background.key);
  if (Array.isArray(manifest.assets)) {
    for (const asset of manifest.assets) {
      if (typeof asset?.key === 'string') keys.add(asset.key);
    }
  } else if (manifest.assets != null) {
    return null;
  }
  return keys;
}

/** The keys a record's text names, or null if it cannot be read as one. */
function recordTextKeys(text) {
  if (text == null) return new Set();
  try {
    return manifestKeys(JSON.parse(text));
  } catch {
    return null;
  }
}

/** The last record text read for its keys, and those keys: a record is read on every write. */
let lastRecord = { text: null, keys: new Set() };

/** The keys the recovery record in `localStorage` names now (an unreadable one names none). */
function durableRecordKeys(app) {
  const read = app.storageService?.readKept?.(STORAGE.AUTOSAVE_KEY);
  const text = read ? (read.ok ? read.text : null) : app.storageService?.loadAutoSaveText?.() ?? null;
  if (text !== lastRecord.text) lastRecord = { text, keys: recordTextKeys(text) ?? new Set() };
  return lastRecord.keys;
}

/**
 * Whether an entry may be deleted: false only when no record names it, the
 * recovery record, a kept record or a held one (DEF-28), and no revision of
 * this tab's does; null when a record that may name it cannot be read or
 * understood, and then nothing is deleted. Read afresh for each key.
 * @param {Object} app
 * @param {string} key
 * @returns {boolean|null}
 */
function isProtected(app, key) {
  const storage = app.storageService;
  if (!storage?.readKept || !storage.listKept || !storage.holdState) return null;
  const current = storage.readKept(STORAGE.AUTOSAVE_KEY);
  if (!current.ok) return null;
  const named = recordTextKeys(current.text);
  if (!named) return null;
  if (named.has(key)) return true;
  const kept = storage.listKept();
  if (!kept.ok) return null;
  for (const record of kept.records) {
    const keys = recordTextKeys(record.text);
    if (record.text === null || !keys) return null;
    if (keys.has(key)) return true;
  }
  const hold = storage.holdState();
  if (hold.state === 'unknown') return null;
  if (hold.state === 'held') {
    const keys = recordTextKeys(hold.text);
    if (!keys) return null;
    if (keys.has(key)) return true;
  }
  const revision = app._recoveryRevision;
  if (revision && !revision.done && revision.entries.some(entry => entry.key === key)) return true;
  return false;
}

/**
 * The omissions a restore left, still unresolved: carried into every record
 * written after it, so a later reload still explains the loss (Codex, brief
 * round 1, 8). The background's goes once a background is set or its prompt
 * is dismissed; a marker's once none of its waypoints is left without a
 * custom image; the path head's once it has one again.
 */
function carriedOmissions(app, model) {
  const waypoints = new Map((model.waypoints || []).map(waypoint => [waypoint.id, waypoint]));
  const carried = (app._recoveryCarried || []).filter(entry => {
    if (entry.role === 'background') return !app.background?.image;
    if (entry.role === 'path-head') return !model.styles?.pathHead?.imageAssetId;
    if (entry.role === 'marker') {
      return (entry.waypoints || []).some(({ id }) => waypoints.has(id) && !waypoints.get(id).customImageAssetId);
    }
    return true;
  });
  app._recoveryCarried = carried;
  return carried;
}

let revisionSerial = 0;

/**
 * Capture one revision of the project for browser recovery: the model, the
 * images it references and their names, at once, so the record written from
 * it never pairs the route with images from another state. Its images'
 * puts start now. Throws as building the model throws.
 * @param {Object} app
 * @returns {Object} The revision
 */
export function captureRecoveryRevision(app) {
  const model = app._buildProjectSnapshot({ includeAssets: false });
  const store = storeOf(app);
  const images = liveImages(app, model, model);
  const carried = carriedOmissions(app, model);
  const revision = {
    id: (revisionSerial += 1),
    store,
    model,
    entries: [],
    omitted: [],
    carried,
    lease: null,
    done: false,
    lastSnapshot: null,
  };
  if (!store) {
    revision.omitted = images.map(image => omissionOf(image, R.UNAVAILABLE));
    return revision;
  }
  const { kept, omitted } = selectWithinLimits(images, store.limits);
  revision.omitted = omitted;
  revision.entries = kept.map(image => ({ image, key: store.cachedKey(image.dataURL), work: null, failed: null }));
  store.forgetKeysExcept(images.map(image => image.dataURL).filter(Boolean));
  if (revision.entries.length > 0) {
    // A lease joins the hold an earlier publication or restore still has, so
    // what that hold has seen stored is stored for this one too; one this
    // revision does not rely on goes at once.
    revision.lease = store.lease();
    const named = durableRecordKeys(app);
    let relies = false;
    for (const entry of revision.entries) {
      if (entry.key && named.has(entry.key)) continue;
      relies = true;
      if (!isStoredNow(revision, entry, named)) startStoring(revision, entry);
    }
    if (!relies) {
      revision.lease.release();
      revision.lease = null;
    }
  }
  return revision;
}

function isStoredNow(revision, entry, named) {
  if (entry.failed || !entry.key) return false;
  return named.has(entry.key) || revision.store.verified(revision.lease, entry.key);
}

function startStoring(revision, entry) {
  if (entry.work || entry.failed || revision.done) return;
  // Stored, and then not stored when written (another tab's record no longer
  // names it, and no hold vouches for it): stored again, a bounded number of
  // times.
  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts > 3) {
    entry.failed = R.REFUSED;
    return;
  }
  revision.lease ??= revision.store.lease();
  entry.work = revision.store.ensureStored(revision.lease, entry.image).then(result => {
    entry.work = null;
    if (result.key) entry.key = result.key;
    if (!result.ok) entry.failed = result.reason === R.CANCELLED ? R.PENDING : result.reason;
  });
}

/** Whether every image of the revision has its outcome: stored now, or failed. */
export function settleRecoveryRevision(app, revision) {
  if (revision.done || revision.entries.length === 0) return null;
  const named = durableRecordKeys(app);
  const waiting = [];
  for (const entry of revision.entries) {
    if (entry.failed) continue;
    if (!entry.work && !isStoredNow(revision, entry, named)) startStoring(revision, entry);
    if (entry.work) waiting.push(entry.work);
  }
  return waiting.length > 0 ? Promise.allSettled(waiting) : null;
}

/**
 * The record a revision gives now: its images stored now are named; any
 * other is not kept, for its failure, or because it is still being stored
 * (the page closing first).
 * @param {Object} revision
 * @returns {Object} The record
 */
export function recoveryRevisionSnapshot(app, revision) {
  const named = revision.store ? durableRecordKeys(app) : new Set();
  const kept = [];
  const omitted = [...revision.omitted];
  for (const entry of revision.entries) {
    if (isStoredNow(revision, entry, named)) kept.push(entry);
    else omitted.push(omissionOf(entry.image, entry.failed || R.PENDING));
  }
  omitted.push(...revision.carried);
  const strippedIds = new Set(omitted.filter(entry => entry.assetId).map(entry => entry.assetId));
  const stripped = revision.store
    ? stripAssetReferences(revision.model, strippedIds)
    : stripAssetReferences(revision.model);
  const background = kept.find(entry => entry.image.role === 'background');
  const snapshot = {
    ...stripped,
    imageAssets: [],
    recoveryImages: {
      version: RECOVERY_MANIFEST_VERSION,
      background: background
        ? {
            key: background.key,
            name: background.image.name,
            mimeType: background.image.mimeType,
            byteLength: background.image.byteLength,
          }
        : null,
      assets: kept.filter(entry => entry.image.assetId)
        .map(entry => ({ id: entry.image.assetId, key: entry.key, name: entry.image.name })),
      omitted,
    },
  };
  revision.lastSnapshot = snapshot;
  return snapshot;
}

/** The revision is written or dropped: its lease goes. */
export function finishRecoveryRevision(app, revision) {
  if (!revision || revision.done) return;
  revision.done = true;
  revision.lease?.release();
  revision.lease = null;
  if (app._recoveryRevision === revision) app._recoveryRevision = null;
}

/**
 * Whether the revision needs the deferred write: it names images, so what it
 * may name is decided at the moment it is written.
 */
export function revisionIsDeferred(revision) {
  return revision.entries.length > 0;
}

/**
 * The source StorageService writes a deferred revision from: what it gives
 * now, whether it is final, and the lease to let go once it is written or
 * dropped.
 */
export function recoveryRevisionSource(app, revision) {
  return {
    snapshot: () => recoveryRevisionSnapshot(app, revision),
    settle: () => settleRecoveryRevision(app, revision),
    release: () => finishRecoveryRevision(app, revision),
  };
}

/** The omissions the revision's last record listed. */
export function revisionOmissions(revision) {
  return revision.lastSnapshot?.recoveryImages?.omitted ?? [];
}

// ---------------------------------------------------------------------------
// What is said

function signatureOf(omitted) {
  return JSON.stringify(omitted
    .map(entry => [entry.role, entry.name ?? '', entry.reason, entry.assetId ?? ''])
    .sort((a, b) => a.join('\u0000').localeCompare(b.join('\u0000'))));
}

const EMPTY_SIGNATURE = signatureOf([]);

/** "the marker image for Main gate and 2 other waypoints" */
function waypointsPhrase(entry) {
  const labels = (entry.waypoints || []).map(each => each.label).filter(Boolean);
  if (labels.length === 0) return '';
  if (labels.length === 1) return ` for ${labels[0]}`;
  const others = labels.length - 1;
  return ` for ${labels[0]} and ${others} other ${others === 1 ? 'waypoint' : 'waypoints'}`;
}

/**
 * What an omission is called, with its file name and the fallback shown in
 * its place: "the background, campus-map.png"; "the marker image for Main
 * gate, flag.png, shown as a dot"; a name never recorded or lost is said so.
 */
function subjectOf(entry) {
  const name = entry.name ? entry.name : 'its file name not kept';
  if (entry.role === 'background') return `the background, ${name}`;
  if (entry.role === 'path-head') {
    return `the path head image, ${name}${entry.fallback === 'arrow' ? ', shown as an arrow' : ''}`;
  }
  if (entry.role === 'marker') {
    return `the marker image${waypointsPhrase(entry)}, ${name}${entry.fallback === 'dot' ? ', shown as a dot' : ''}`;
  }
  return `a custom image, ${name}`;
}

function reasonOf(entry) {
  return REASON_WORDS[entry.reason] ?? REASON_WORDS[R.UNREADABLE];
}

const capitalise = text => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The warning, naming each file and why: `lead` (one image) or `leadMany`
 * (several, with their count), then the next step.
 */
function warningText(omitted, { lead, leadMany, nextOne, nextMany }) {
  if (omitted.length === 1) {
    return `${lead} ${subjectOf(omitted[0])}: ${reasonOf(omitted[0])}. ${nextOne}`;
  }
  const items = omitted.map(entry => `${capitalise(subjectOf(entry))}: ${reasonOf(entry)}.`).join(' ');
  return `${leadMany(omitted.length)} ${items} ${nextMany}`;
}

/** The warning when recovery is written without an image. */
export function writeWarningText(omitted) {
  return warningText(omitted, {
    lead: 'Browser recovery could not keep',
    leadMany: count => `Browser recovery could not keep ${count} images.`,
    nextOne: 'Save a project file to keep it.',
    nextMany: 'Save a project file to keep them.',
  });
}

/** The warning when a restore brings an image back no longer. */
export function restoreWarningText(omitted) {
  return warningText(omitted, {
    lead: 'Browser recovery could not bring back',
    leadMany: count => `Browser recovery could not bring back ${count} images.`,
    nextOne: 'Choose it again, or open your project file.',
    nextMany: 'Choose them again, or open your project file.',
  });
}

/**
 * Say a recovery warning: a toast on screen, which stays until dismissed,
 * announced once through the queue as a message the author must hear
 * (`showToast` forwards `essential`; Codex, brief round 1, 8). A host with no
 * toast hears the announcement alone.
 */
function sayRecoveryWarning(app, message) {
  if (typeof app.showToast !== 'function') {
    app.announce?.(message, 'polite', RECOVERY_NOTICE);
    return;
  }
  // One recovery warning on screen at a time: the newest says all that is
  // not kept now, so the one it follows goes.
  app._recoveryWarningToast?.();
  const remove = app.showToast(message, 0, null, { essential: true });
  if (typeof remove === 'function') app._recoveryWarningToast = () => remove();
}

/**
 * When recovery is written: warn of the images it did not keep, only when
 * that set has changed since it was last said (the same warning is not
 * repeated on every autosave), once per project opened, restored or cleared.
 * @param {Object} app
 * @param {Array<Object>} omitted
 */
export function reportRecoveryWrite(app, omitted) {
  const signature = signatureOf(omitted);
  const said = app._recoveryOmissionSignature ?? EMPTY_SIGNATURE;
  // The older flags, kept true to what was last said.
  app._autosaveAssetWarningShown = omitted.some(entry => entry.role !== 'background');
  app._autosaveBackgroundWarningShown = omitted.some(entry => entry.role === 'background');
  if (signature === said) return;
  app._recoveryOmissionSignature = signature;
  if (omitted.length > 0) sayRecoveryWarning(app, writeWarningText(omitted));
}

/** A new project (opened, restored or cleared): what it leaves out is said afresh. */
export function resetRecoveryWarnings(app) {
  app._recoveryOmissionSignature = EMPTY_SIGNATURE;
  app._autosaveAssetWarningShown = false;
  app._autosaveBackgroundWarningShown = false;
}

// ---------------------------------------------------------------------------
// Restore

function sanitiseOmitted(list) {
  if (!Array.isArray(list)) return [];
  const roles = new Set(['background', 'path-head', 'marker', 'image']);
  const reasons = new Set(Object.keys(REASON_WORDS));
  return list.filter(entry => entry && typeof entry === 'object' && roles.has(entry.role)).map(entry => {
    const clean = {
      role: entry.role,
      name: validName(entry.name),
      reason: reasons.has(entry.reason) ? entry.reason : R.UNREADABLE,
    };
    if (typeof entry.assetId === 'string') clean.assetId = entry.assetId;
    if (Array.isArray(entry.waypoints)) {
      clean.waypoints = entry.waypoints
        .filter(each => each && typeof each.id === 'string')
        .map(each => ({ id: each.id, label: typeof each.label === 'string' ? each.label.slice(0, 200) : '' }));
    }
    if (entry.fallback === 'dot' || entry.fallback === 'arrow') clean.fallback = entry.fallback;
    return clean;
  });
}

/**
 * Read one stored image and check it as an import does, strictly: its key
 * and digest (the store's), its actual byte length, its signature and MIME
 * type, a decode with its actual dimensions matching those stored.
 * @returns {Promise<{ok: boolean, reason?: string, dataURL?: string, image?: Object,
 *   width?: number, height?: number, mimeType?: string, byteLength?: number}>}
 */
async function readImage(store, lease, key, { name, maxBytes }) {
  if (!store) return { ok: false, reason: R.MISSING };
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) return { ok: false, reason: R.UNREADABLE };
  const read = await store.read(lease, key);
  if (!read.ok) return { ok: false, reason: read.reason === R.CANCELLED ? R.MISSING : read.reason };
  const record = read.record;
  try {
    ImageAsset.assertValidSerialized({
      id: 'recovery-image',
      name: name ?? '',
      base64: record.dataURL,
      width: record.width,
      height: record.height,
      mimeType: record.mimeType,
      size: record.byteLength,
    }, { maxBytes });
    const image = await ImageAsset.decodeDataURL(record.dataURL, name ?? 'image');
    const width = Number(image.naturalWidth || image.width);
    const height = Number(image.naturalHeight || image.height);
    if (width !== record.width || height !== record.height) return { ok: false, reason: R.UNREADABLE };
    return {
      ok: true,
      dataURL: record.dataURL,
      image,
      width,
      height,
      mimeType: record.mimeType,
      byteLength: record.byteLength,
    };
  } catch (error) {
    console.warn('A recovery image could not be read:', error);
    return { ok: false, reason: R.UNREADABLE };
  }
}

/** Every waypoint and path head referencing `assetId`, as an omission describes them. */
function describeReferences(data, assetId) {
  const image = { role: 'image', assetId, name: null, waypoints: [], fallback: null };
  if (data.styles?.pathHead?.imageAssetId === assetId) {
    image.role = 'path-head';
    if (data.styles.pathHead.style === 'custom') image.fallback = 'arrow';
  }
  (data.waypoints || []).forEach((waypoint, index) => {
    if (waypoint?.customImageAssetId !== assetId) return;
    if (image.role === 'image') image.role = 'marker';
    image.waypoints.push({ id: waypoint.id, label: waypointLabel(waypoint, index) });
    if (waypoint.markerStyle === 'custom') image.fallback ??= 'dot';
  });
  return image;
}

/**
 * What a restore brings back from a record's manifest: the background and
 * custom images it names, each read and checked, the record's model with the
 * fallback for any that cannot come back, and every image not kept, from the
 * manifest's own list and from this read. An invalid entry is isolated: its
 * references alone take the fallback, and the rest still restores.
 *
 * A record with no manifest is from before this release: one with inline
 * image bytes restores them as before (`kind: 'inline'`); one without kept no
 * images, and says so (`kind: 'legacy'`), naming none.
 *
 * Never rejects. The lease it took is the caller's to release, once the
 * record that replaces this one has been captured.
 * @param {Object} app
 * @param {Object} data - The parsed record
 * @returns {Promise<{kind: string, data: Object, backgroundBase64: string|null,
 *   backgroundName: string|null, imageAssets: Array<ImageAsset>|null,
 *   omitted: Array<Object>, lease: Object|null}>}
 */
export async function readRecoveryImages(app, data) {
  const manifest = data?.recoveryImages;
  if (manifest == null) {
    const inline = typeof data?.backgroundImage === 'string' ||
      (Array.isArray(data?.imageAssets) && data.imageAssets.some(asset => typeof asset?.base64 === 'string'));
    if (inline) {
      return {
        kind: 'inline', data, backgroundBase64: null, backgroundName: null, imageAssets: null, omitted: [], lease: null,
      };
    }
    return {
      kind: 'legacy',
      data,
      backgroundBase64: null,
      backgroundName: null,
      imageAssets: [],
      omitted: [{ role: 'background', name: null, reason: R.LEGACY }],
      lease: null,
    };
  }

  const store = storeOf(app);
  const limits = store?.limits ?? RECOVERY_IMAGE_LIMITS;
  const lease = store?.lease() ?? null;
  const understood = typeof manifest === 'object' && manifest.version === RECOVERY_MANIFEST_VERSION;
  const omitted = understood ? sanitiseOmitted(manifest.omitted) : [];

  let backgroundBase64 = null;
  let backgroundName = null;
  const background = understood ? manifest.background : null;
  if (background && typeof background === 'object') {
    const name = validName(background.name);
    const read = await readImage(store, lease, background.key, {
      name,
      maxBytes: Math.min(limits.MAX_BYTES, limits.MAX_BACKGROUND_BYTES),
    });
    if (read.ok) {
      backgroundBase64 = read.dataURL;
      backgroundName = name;
    } else {
      omitted.unshift({ role: 'background', name, reason: read.reason });
    }
  } else if (!understood && manifest.background) {
    omitted.unshift({ role: 'background', name: null, reason: R.UNREADABLE });
  }

  const listed = understood && Array.isArray(manifest.assets) ? manifest.assets : [];
  const idCounts = new Map();
  for (const asset of listed) {
    if (typeof asset?.id === 'string') idCounts.set(asset.id, (idCounts.get(asset.id) || 0) + 1);
  }
  const imageAssets = [];
  const available = new Set();
  const lost = new Map();
  let count = 0;
  let bytes = 0;
  let pixels = 0;
  for (const asset of listed) {
    const assetId = typeof asset?.id === 'string' ? asset.id : null;
    if (!assetId) continue;
    const name = validName(asset.name);
    // Ids must be unique: an id listed twice cannot say which bytes it means.
    if (idCounts.get(assetId) > 1) {
      if (!lost.has(assetId)) lost.set(assetId, { name, reason: R.UNREADABLE });
      continue;
    }
    const read = await readImage(store, lease, asset.key, { name, maxBytes: limits.MAX_BYTES });
    if (!read.ok) {
      lost.set(assetId, { name, reason: read.reason });
      continue;
    }
    const imagePixels = read.width * read.height;
    if (count + 1 > limits.MAX_ASSETS || bytes + read.byteLength > limits.MAX_ASSET_BYTES_TOTAL ||
        pixels + imagePixels > limits.MAX_IMAGE_PIXELS_TOTAL) {
      lost.set(assetId, { name, reason: R.OVER_TOTAL });
      continue;
    }
    try {
      const restored = new ImageAsset({
        id: assetId,
        base64: read.dataURL,
        name: name ?? '',
        width: read.width,
        height: read.height,
        mimeType: read.mimeType,
        size: read.byteLength,
      });
      ImageAsset.assertValidSerialized(restored);
      restored._imageElement = read.image;
      imageAssets.push(restored);
      available.add(assetId);
      count += 1;
      bytes += read.byteLength;
      pixels += imagePixels;
    } catch (error) {
      console.warn('A recovery image could not be read:', error);
      lost.set(assetId, { name, reason: R.UNREADABLE });
    }
  }

  // Every reference the model makes to an image that is not here takes the
  // fallback, and is named in the warning: one the manifest lists and could
  // not be read, or one it never listed.
  const referenced = collectImageAssetReferences({ ...data, imageAssets: [] });
  const dropped = new Set();
  for (const assetId of referenced) {
    if (available.has(assetId)) continue;
    dropped.add(assetId);
    const reason = lost.get(assetId) ?? { name: null, reason: R.UNREADABLE };
    omitted.push(omissionOf({ ...describeReferences(data, assetId), name: reason.name }, reason.reason));
  }
  const restoredData = { ...stripAssetReferences(data, dropped), imageAssets: [] };
  delete restoredData.recoveryImages;
  return { kind: 'manifest', data: restoredData, backgroundBase64, backgroundName, imageAssets, omitted, lease };
}

/**
 * After a restore has committed: warn of each image that did not come back,
 * and offer a background that did not. The background's prompt, shown in the
 * banner slot, is its warning: on screen, announced once, its name and why;
 * the toast names the rest, or the background too where the prompt cannot
 * show now. What is said is then what the first record written says, so it
 * is not said again.
 * @param {Object} app
 * @param {{kind: string, omitted: Array<Object>}} restored
 */
export function reportRecoveryRestore(app, restored) {
  const omitted = restored.omitted || [];
  app._recoveryOmissionSignature = signatureOf(omitted);
  if (omitted.length === 0) return;
  const background = omitted.find(entry => entry.role === 'background');
  const prompted = background ? offerBackgroundPrompt(app, background) : false;
  const others = omitted.filter(entry => entry !== background);
  if (background?.reason === R.LEGACY && !prompted) {
    sayRecoveryWarning(app,
      'Browser recovery before this release kept no images, so the background did not come back. '
      + 'Choose it again, or open your project file.');
  }
  const listed = prompted || background?.reason === R.LEGACY ? others : omitted;
  if (listed.length > 0) sayRecoveryWarning(app, restoreWarningText(listed));
}

// ---------------------------------------------------------------------------
// The background prompt

function promptWords(omission) {
  if (omission.reason === R.LEGACY) {
    return {
      title: 'Background not restored:',
      text: ' recovery before this release kept no images. Choose the image this route was made on.',
    };
  }
  const what = omission.name ? omission.name : 'its file name was not kept';
  return {
    title: 'Background not restored:',
    text: ` ${what} — ${reasonOf(omission)}. Choose the image this route was made on.`,
  };
}

/**
 * Offer the background that did not come back, in the banner slot below the
 * header: its file name where it survives, why, and two real buttons,
 * "Choose image" (the background chooser) and "Dismiss". An owner of the
 * slot (`ModeBanner`), with no mode of its own:
 * - it never takes the slot from another owner: with the slot held (a mode,
 *   the first-start tip), it waits until the slot is free;
 * - a claim the slot refuses (made inside another owner's exit) neither
 *   shows it, nor uses its one announcement, nor moves focus; it waits for
 *   the slot to be free, and tries again then, outside that exit;
 * - a mode that replaces it leaves it waiting: it comes back once the slot
 *   is free again, unannounced, its one announcement made already; focus
 *   held in it goes where it was before;
 * - it is announced once, when it first shows;
 * - Escape with focus in it dismisses it, as Dismiss does, and focus goes
 *   back to where it was before it entered the prompt, else the Route
 *   button; Escape elsewhere is the modes' own, never the prompt's;
 * - it ends when a background is set (by its Choose image or any other way),
 *   when it is dismissed, or when another project is opened or the project
 *   cleared. Dismissed, the record stops carrying the background's loss.
 * @param {Object} app
 * @param {Object} omission - The background's
 * @returns {boolean} Whether it shows now
 */
export function offerBackgroundPrompt(app, omission) {
  endBackgroundPrompt(app);
  if (!app.modeBanner) return false;
  const prompt = { omission, owner: null, stopWaiting: null, shown: false, announced: false, over: false };
  prompt.owner = { onReplaced: () => displacePrompt(app, prompt) };
  app._backgroundPrompt = prompt;
  return showPrompt(app, prompt);
}

function waitForSlot(app, prompt) {
  prompt.stopWaiting?.();
  prompt.stopWaiting = app.modeBanner.whenFree(() => {
    prompt.stopWaiting = null;
    showPrompt(app, prompt);
  });
}

function showPrompt(app, prompt) {
  const banner = app.modeBanner;
  if (!banner || prompt.over || app._backgroundPrompt !== prompt) return false;
  prompt.stopWaiting?.();
  prompt.stopWaiting = null;
  // Never displace another owner: a mode, or the tip.
  if (banner.isShowing() && !banner.isShowing(prompt.owner)) {
    waitForSlot(app, prompt);
    return false;
  }
  const { title, text } = promptWords(prompt.omission);
  const shown = banner.show(prompt.owner, {
    id: 'background-recovery-banner',
    title,
    text,
    actions: [
      { label: 'Choose image', className: 'banner-choose-image', onClick: () => app.elements?.bgUpload?.click() },
      { label: 'Dismiss', className: 'banner-dismiss', onClick: () => dismissBackgroundPrompt(app) },
    ],
  });
  if (!shown) {
    // Refused: not shown, not announced, focus untouched (Codex, brief round 2, 14).
    prompt.shown = false;
    waitForSlot(app, prompt);
    return false;
  }
  prompt.shown = true;
  shown.root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    dismissBackgroundPrompt(app);
  });
  if (!prompt.announced) {
    prompt.announced = true;
    app.announce?.(`${title}${text}`, 'polite', RECOVERY_NOTICE);
  }
  return true;
}

function displacePrompt(app, prompt) {
  if (prompt.over || app._backgroundPrompt !== prompt) return;
  prompt.shown = false;
  const banner = app.modeBanner;
  if (banner?.holdsFocus(prompt.owner)) returnFocus(banner.focusBefore);
  // Back once the slot is free, never inside this replacement.
  waitForSlot(app, prompt);
}

function closePrompt(app, { focusFallback = null } = {}) {
  const prompt = app._backgroundPrompt;
  if (!prompt) return null;
  prompt.over = true;
  prompt.stopWaiting?.();
  prompt.stopWaiting = null;
  app._backgroundPrompt = null;
  const banner = app.modeBanner;
  const heldFocus = banner?.holdsFocus(prompt.owner) ?? false;
  const before = banner?.focusBefore ?? null;
  banner?.hide(prompt.owner);
  if (heldFocus) returnFocus(before, focusFallback);
  return prompt;
}

/**
 * Dismiss: the prompt goes, and the record stops carrying the background's
 * loss, rewritten without it (the project unchanged, so not marked changed).
 */
export function dismissBackgroundPrompt(app) {
  const prompt = closePrompt(app);
  if (!prompt) return;
  app._recoveryCarried = (app._recoveryCarried || []).filter(entry => entry.role !== 'background');
  app.saveRecovery?.();
}

/** A background has been set: the prompt has done its work. */
export function resolveBackgroundPrompt(app) {
  closePrompt(app, { focusFallback: app.elements?.bgUploadBtn ?? null });
}

/** Another project, or the app stopping: the prompt goes, its wait too. */
export function endBackgroundPrompt(app) {
  closePrompt(app);
}

// ---------------------------------------------------------------------------
// Early puts, garbage collection, Clear All

/**
 * Start storing the live project's images now, so a record written soon
 * after rarely finds one still in flight: a background loaded or opened, an
 * image admitted, a project opened or restored, or an image Undo makes live
 * again. Its work holds a lease until it settles.
 * @param {Object} app
 * @returns {Promise|null}
 */
export function primeRecoveryImages(app) {
  const store = storeOf(app);
  if (!store) return null;
  const view = { waypoints: app.waypoints || [], styles: app.styles || {} };
  const { kept } = selectWithinLimits(liveImages(app, view), store.limits);
  const named = durableRecordKeys(app);
  const pending = kept.filter(image => {
    const key = store.cachedKey(image.dataURL);
    return !(key && named.has(key));
  });
  if (pending.length === 0) return null;
  const lease = store.lease();
  const work = Promise.allSettled(pending.map(image => store.ensureStored(lease, image)))
    .finally(() => lease.release());
  app._recoveryPriming = work;
  work.finally(() => {
    if (app._recoveryPriming === work) app._recoveryPriming = null;
  });
  return work;
}

/**
 * After a record is written: delete the entries no record names, when no
 * tab is storing or relying on one (`RecoveryImageStore.collectGarbage`).
 * Coalesced; a run the lock does not allow now is tried a few times, then
 * waits for the next write.
 * @param {Object} app
 * @returns {Promise|null}
 */
export function scheduleRecoveryGarbage(app) {
  const store = storeOf(app);
  if (!store?.crossWriter) return null;
  if (app._recoveryGarbage) {
    app._recoveryGarbage.again = true;
    return app._recoveryGarbage.promise;
  }
  const run = { again: false, promise: null };
  app._recoveryGarbage = run;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  run.promise = (async () => {
    let result = { ok: false, deleted: [] };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await wait(attempt === 0 ? 0 : 50);
      if (app._recoveryGarbage !== run) return result;
      result = await store.collectGarbage(key => isProtected(app, key));
      if (result.skipped !== 'busy') break;
    }
    return result;
  })().finally(() => {
    if (app._recoveryGarbage !== run) return;
    app._recoveryGarbage = null;
    if (run.again) scheduleRecoveryGarbage(app);
  });
  return run.promise;
}

/**
 * Clear All's part: the prompt, the carried losses and the background's
 * name go, and the store is emptied, after its writes already issued and
 * before any new project's (`RecoveryImageStore.clear`).
 * @param {Object} app
 * @returns {Promise<{ok: boolean}>|null} null where nothing can be stored
 */
export function clearRecoveryImages(app) {
  endBackgroundPrompt(app);
  app._recoveryCarried = [];
  app._backgroundName = null;
  resetRecoveryWarnings(app);
  finishRecoveryRevision(app, app._recoveryRevision);
  app._recoveryGarbage = null;
  const store = app.recoveryImageStore;
  if (!store?.backend) return null;
  return store.clear();
}

/**
 * Settles once no work of recovery's images is under way in this app: the
 * current revision's puts, early puts, a collection, a clear. For tests,
 * and for anything that must not race them.
 * @param {Object} app
 * @returns {Promise<void>}
 */
export async function recoveryImagesIdle(app) {
  for (let round = 0; round < 20; round += 1) {
    const waits = [];
    const revision = app._recoveryRevision;
    if (revision && !revision.done) {
      for (const entry of revision.entries) if (entry.work) waits.push(entry.work);
    }
    if (app._recoveryPriming) waits.push(app._recoveryPriming);
    if (app._recoveryGarbage?.promise) waits.push(app._recoveryGarbage.promise);
    if (app.recoveryImageStore?._clearing) waits.push(app.recoveryImageStore._clearing);
    if (waits.length === 0) return;
    await Promise.allSettled(waits);
  }
}
