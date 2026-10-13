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
 * kept (its roles, file name and why). The model keeps its custom marker and
 * path-head references for images kept; an image not kept gets the built-in
 * fallback it always had (a dot, an arrow). A record without the field is
 * from before this release: one with inline image bytes (older still)
 * restores them, one without kept no images and says so.
 *
 * The order of writes. Each write is one revision: the model, detached from
 * the live one, the images it references and their names, captured at once.
 * Every image of the live project is pinned (`src/services/RecoveryImageStore.js`):
 * while it is, no tab can delete it, and it is put into the store if it is
 * not there. A record names an image only while it is pinned and seen stored
 * (`isStoredNow`), so a record written at any moment, the `pagehide` flush's
 * included, names only images stored, and they stay stored while the tab
 * shows them; one written before an image's put has landed lists it as not
 * kept, the page having closed first. An image leaves its pin when it leaves
 * the live project, and when the page goes.
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

/** The roles an image plays, in keeping order. */
const ROLES = Object.freeze(['background', 'path-head', 'marker', 'image']);

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

/** Add a role an image plays, and the fallback shown in its place there, in keeping order. */
function addRole(image, role, fallback = null) {
  if (!image.roles.includes(role)) {
    image.roles.push(role);
    image.roles.sort((a, b) => ROLES.indexOf(a) - ROLES.indexOf(b));
    image.role = image.roles[0];
  }
  if (fallback && !image.fallbacks.includes(fallback)) {
    image.fallbacks.push(fallback);
    image.fallbacks.sort((a, b) => ['arrow', 'dot'].indexOf(a) - ['arrow', 'dot'].indexOf(b));
  }
}

/**
 * The images a model references, in the order recovery keeps them when not
 * all fit (the lead's proposal, for the owner to confirm): the background,
 * then the path head's image, then each waypoint's marker image in waypoint
 * order, then any other reference. One entry per image, with every role it
 * plays (an image both the path head and a marker show is both), every
 * waypoint that shows it, and the fallback each role would show.
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
      roles: ['background'],
      fallbacks: [],
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
        roles: [],
        fallbacks: [],
        assetId,
        name: validName(asset?.name),
        dataURL: asset?.base64 || null,
        width: Number(asset?.width) || 0,
        height: Number(asset?.height) || 0,
        waypoints: [],
      });
      byAsset.set(assetId, image);
      images.push(image);
    }
    if (role === 'path-head') {
      addRole(image, role, model.styles?.pathHead?.style === 'custom' ? 'arrow' : null);
    } else if (role === 'marker') {
      addRole(image, role, waypoint.markerStyle === 'custom' ? 'dot' : null);
      image.waypoints.push({ id: waypoint.id, label: waypointLabel(waypoint, index) });
    } else if (image.roles.length === 0) {
      addRole(image, role);
    }
  };
  claim(model.styles?.pathHead?.imageAssetId, 'path-head');
  (model.waypoints || []).forEach((waypoint, index) => claim(waypoint.customImageAssetId, 'marker', waypoint, index));
  if (snapshot) {
    for (const assetId of collectImageAssetReferences({ ...snapshot, imageAssets: [] })) claim(assetId, 'image');
  }
  return images;
}

/**
 * An image not kept, as the manifest and the warnings carry it: its first
 * role, every role where it plays more than one, its waypoints, and the
 * fallback, or fallbacks, shown in its place.
 */
function omissionOf(image, reason) {
  const entry = { role: image.role, name: validName(image.name), reason };
  if (image.roles?.length > 1) entry.roles = [...image.roles];
  if (image.assetId) entry.assetId = image.assetId;
  if (image.waypoints?.length) entry.waypoints = image.waypoints.map(({ id, label }) => ({ id, label }));
  if (image.fallbacks?.length === 1) [entry.fallback] = image.fallbacks;
  else if (image.fallbacks?.length > 1) entry.fallbacks = [...image.fallbacks];
  return entry;
}

/** Every role an omission speaks for. */
const rolesOf = entry => (Array.isArray(entry.roles) && entry.roles.length ? entry.roles : [entry.role]);

/** Every fallback an omission names. */
function fallbacksOf(entry) {
  if (Array.isArray(entry.fallbacks)) return entry.fallbacks;
  return entry.fallback ? [entry.fallback] : [];
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

/** A manifest entry's key, if it is one this release writes. */
const validKey = key => typeof key === 'string' && KEY_PATTERN.test(key);

/**
 * The image-store keys a record names, or null where the record's manifest
 * is not one this release understands: another version, or a shape it does
 * not write (Codex, code review round 1, 4). A record with no manifest, from
 * before this release, names none. Null stops every deletion.
 */
function manifestKeys(data) {
  const keys = new Set();
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (!('recoveryImages' in data) || data.recoveryImages === undefined) return keys;
  const manifest = data.recoveryImages;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null;
  if (manifest.version !== RECOVERY_MANIFEST_VERSION) return null;
  if (manifest.background !== null) {
    if (!manifest.background || typeof manifest.background !== 'object' || !validKey(manifest.background.key)) {
      return null;
    }
    keys.add(manifest.background.key);
  }
  if (!Array.isArray(manifest.assets)) return null;
  for (const asset of manifest.assets) {
    if (!asset || typeof asset !== 'object' || typeof asset.id !== 'string' || !validKey(asset.key)) return null;
    keys.add(asset.key);
  }
  if (manifest.omitted !== undefined && !Array.isArray(manifest.omitted)) return null;
  return keys;
}

/** The keys a record's text names, or null if it cannot be read as one this release understands. */
function recordTextKeys(text) {
  if (text == null) return new Set();
  try {
    return manifestKeys(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * The records that remain, and every key they name: the recovery record, the
 * records kept because they could not be restored and a held one (DEF-28).
 * Null when any of them cannot be read or understood.
 * @param {Object} app
 * @returns {Set<string>|null}
 */
function remainingRecordKeys(app) {
  const storage = app.storageService;
  if (!storage?.readKept || !storage.listKept || !storage.holdState) return null;
  const keys = new Set();
  const add = text => {
    const named = recordTextKeys(text);
    if (!named) return false;
    for (const key of named) keys.add(key);
    return true;
  };
  const current = storage.readKept(STORAGE.AUTOSAVE_KEY);
  if (!current.ok || !add(current.text)) return null;
  const kept = storage.listKept();
  if (!kept.ok) return null;
  for (const record of kept.records) {
    if (record.text === null || !add(record.text)) return null;
  }
  const hold = storage.holdState();
  if (hold.state === 'unknown') return null;
  if (hold.state === 'held' && !add(hold.text)) return null;
  return keys;
}

/**
 * Whether an entry may be deleted: false only when no record names it, the
 * recovery record, a kept record or a held one (DEF-28); null when a record
 * that may name it cannot be read or understood, and then nothing is
 * deleted. Read afresh for each key. What a tab shows, its pins protect.
 * @param {Object} app
 * @param {string} key
 * @returns {boolean|null}
 */
function isProtected(app, key) {
  const keys = remainingRecordKeys(app);
  return keys ? keys.has(key) : null;
}

/**
 * The omissions a restore left, still unresolved: carried into every record
 * written after it, so a later reload still explains the loss (Codex, brief
 * round 1, 8). The background's goes once a background is set or its prompt
 * is dismissed; a marker's once none of its waypoints is left without a
 * custom image; the path head's once it has one again; one that plays both
 * once both are.
 */
function carriedOmissions(app, model) {
  const waypoints = new Map((model.waypoints || []).map(waypoint => [waypoint.id, waypoint]));
  const unresolved = (entry, role) => {
    if (role === 'background') return !app.background?.image;
    if (role === 'path-head') return !model.styles?.pathHead?.imageAssetId;
    if (role === 'marker') {
      return (entry.waypoints || []).some(({ id }) => waypoints.has(id) && !waypoints.get(id).customImageAssetId);
    }
    return true;
  };
  const carried = (app._recoveryCarried || []).filter(entry => rolesOf(entry).some(role => unresolved(entry, role)));
  app._recoveryCarried = carried;
  return carried;
}

// ---------------------------------------------------------------------------
// The live project's images

/**
 * Pin every image of the live project, within the limits, and let go of
 * those that left it (Codex, code review round 1, 9: while an image is in a
 * tab's live project, no tab's sweep may delete it). An image is put into the
 * store, if it is not there, under its pin; one whose put failed is tried
 * again at the next write.
 * @param {Object} app
 * @param {Array<Object>} images - Within the limits, each with its data URL
 * @returns {Map<string, Object>} The live entries, by data URL
 */
function syncLiveImages(app, images) {
  const store = storeOf(app);
  const previous = app._recoveryLive ?? new Map();
  const next = new Map();
  if (store) {
    for (const image of images) {
      if (!image.dataURL) continue;
      const entry = previous.get(image.dataURL) ?? { image, key: store.cachedKey(image.dataURL), pin: null,
        work: null, failed: null, dropped: false };
      entry.image = image;
      next.set(image.dataURL, entry);
      if (entry.failed) entry.failed = null;
      if (!entry.pin && !entry.work) startLive(store, entry);
    }
    store.forgetKeysExcept([...next.keys()]);
  }
  for (const [dataURL, entry] of previous) {
    if (next.has(dataURL)) continue;
    entry.dropped = true;
    entry.pin?.release();
    entry.pin = null;
  }
  app._recoveryLive = next;
  return next;
}

function startLive(store, entry) {
  entry.work = store.ensureStored(entry.image).then(result => {
    entry.work = null;
    if (result.key) entry.key = result.key;
    if (!result.ok) {
      result.pin?.release();
      entry.failed = result.reason;
      return;
    }
    if (entry.dropped) result.pin.release();
    else entry.pin = result.pin;
  });
}

/** Let go of every image the live project holds: a Clear All, or the app stopping. */
function releaseLiveImages(app) {
  syncLiveImages(app, []);
}

let revisionSerial = 0;

/**
 * Capture one revision of the project for browser recovery: the model,
 * detached from the live one, the images it references and their names, at
 * once, so the record written from it never pairs the route with images from
 * another state, nor changes when the live project does (Codex, code review
 * round 1, 3). Its images are pinned and stored now. Throws as building the
 * model throws.
 * @param {Object} app
 * @returns {Object} The revision
 */
export function captureRecoveryRevision(app) {
  const model = JSON.parse(JSON.stringify(app._buildProjectSnapshot({ includeAssets: false })));
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
    pins: [],
    done: false,
    lastSnapshot: null,
  };
  if (!store) {
    revision.omitted = images.map(image => omissionOf(image, R.UNAVAILABLE));
    return revision;
  }
  const { kept, omitted } = selectWithinLimits(images, store.limits);
  revision.omitted = omitted;
  const live = syncLiveImages(app, kept);
  revision.entries = kept.map(image => ({ image, live: live.get(image.dataURL), attempts: 0 }));
  return revision;
}

/** The key an entry's image has: its live entry's, else the store's for its data URL. */
function keyOf(revision, entry) {
  return entry.live?.key ?? revision.store.cachedKey(entry.image.dataURL);
}

function isStoredNow(revision, entry) {
  const key = keyOf(revision, entry);
  return Boolean(key) && revision.store.isStoredNow(key);
}

function failureOf(entry) {
  return entry.failed ?? entry.live?.failed ?? null;
}

/**
 * Store an entry's image again where its live entry has let it go or never
 * held it: an image dropped from the live project since is still the
 * revision's to name until the revision is replaced. Bounded.
 */
function startStoring(revision, entry) {
  if (revision.done || entry.work) return;
  entry.attempts += 1;
  if (entry.attempts > 3) {
    entry.failed = R.REFUSED;
    return;
  }
  entry.work = revision.store.ensureStored(entry.image).then(result => {
    entry.work = null;
    if (result.ok && !revision.done) revision.pins.push(result.pin);
    else result.pin?.release();
    if (!result.ok) entry.failed = result.reason;
  });
}

/** Whether every image of the revision has its outcome: stored now, or failed. */
export function settleRecoveryRevision(app, revision) {
  if (revision.done || revision.entries.length === 0) return null;
  const waiting = [];
  for (const entry of revision.entries) {
    if (isStoredNow(revision, entry)) continue;
    if (entry.failed) continue;
    const liveWork = entry.live && !entry.live.dropped ? entry.live.work : null;
    if (liveWork) {
      waiting.push(liveWork);
      continue;
    }
    if (entry.live?.failed && !entry.live.dropped) continue;
    startStoring(revision, entry);
    if (entry.work) waiting.push(entry.work);
  }
  return waiting.length > 0 ? Promise.allSettled(waiting) : null;
}

/**
 * The record a revision gives now: its images stored now are named; any
 * other is not kept, for its failure, or because it is still being stored
 * (the page closing first).
 * @param {Object} app
 * @param {Object} revision
 * @returns {Object} The record
 */
export function recoveryRevisionSnapshot(app, revision) {
  const kept = [];
  const omitted = [...revision.omitted];
  for (const entry of revision.entries) {
    if (isStoredNow(revision, entry)) kept.push(entry);
    else omitted.push(omissionOf(entry.image, failureOf(entry) || R.PENDING));
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
            key: keyOf(revision, background),
            name: background.image.name,
            mimeType: background.image.mimeType,
            byteLength: background.image.byteLength,
          }
        : null,
      assets: kept.filter(entry => entry.image.assetId)
        .map(entry => ({ id: entry.image.assetId, key: keyOf(revision, entry), name: entry.image.name })),
      omitted,
    },
  };
  revision.lastSnapshot = snapshot;
  return snapshot;
}

/** The revision is written or dropped: what it pinned of its own goes. */
export function finishRecoveryRevision(app, revision) {
  if (!revision || revision.done) return;
  revision.done = true;
  for (const pin of revision.pins.splice(0)) pin.release();
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
 * now, whether it is final, and what to let go once it is written or
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
    .map(entry => [rolesOf(entry).join('+'), entry.name ?? '', entry.reason, entry.assetId ?? ''])
    .sort((a, b) => a.join('\u0000').localeCompare(b.join('\u0000'))));
}

const EMPTY_SIGNATURE = signatureOf([]);

/** " for Main gate and 2 other waypoints" */
function waypointsPhrase(entry) {
  const labels = (entry.waypoints || []).map(each => each.label).filter(Boolean);
  if (labels.length === 0) return '';
  if (labels.length === 1) return ` for ${labels[0]}`;
  const others = labels.length - 1;
  return ` for ${labels[0]} and ${others} other ${others === 1 ? 'waypoint' : 'waypoints'}`;
}

/** ", shown as an arrow and a dot" */
function fallbackPhrase(entry) {
  const shapes = fallbacksOf(entry).map(fallback => (fallback === 'arrow' ? 'an arrow' : 'a dot'));
  return shapes.length ? `, shown as ${shapes.join(' and ')}` : '';
}

/**
 * What an omission is called, with its file name and the fallback shown in
 * its place: "the background, campus-map.png"; "the marker image for Main
 * gate, flag.png, shown as a dot"; "the path head image and the marker image
 * for Main gate, flag.png, shown as an arrow and a dot"; a name never
 * recorded or lost is said so.
 */
function subjectOf(entry) {
  const name = entry.name ? entry.name : 'its file name not kept';
  const roles = rolesOf(entry);
  if (roles.includes('background')) return `the background, ${name}`;
  const parts = [];
  if (roles.includes('path-head')) parts.push('the path head image');
  if (roles.includes('marker')) parts.push(`the marker image${waypointsPhrase(entry)}`);
  if (parts.length === 0) parts.push('a custom image');
  return `${parts.join(' and ')}, ${name}${fallbackPhrase(entry)}`;
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
 * Say a recovery warning: a toast on screen, which stays until dismissed or
 * no longer true, announced once through the queue as a message the author
 * must hear (`showToast` forwards `essential`; Codex, brief round 1, 8). A
 * host with no toast hears the announcement alone.
 */
function sayRecoveryWarning(app, message) {
  if (typeof app.showToast !== 'function') {
    app.announce?.(message, 'polite', RECOVERY_NOTICE);
    return;
  }
  // One recovery warning on screen at a time: the newest says all that is
  // not kept now, so the one it follows goes.
  withdrawRecoveryWarning(app);
  const remove = app.showToast(message, 0, null, { essential: true });
  if (typeof remove === 'function') app._recoveryWarningToast = () => remove();
}

/**
 * Take the recovery warning off the screen, once what it said is no longer
 * so (Codex, code review round 1, 6): every image is kept now, another
 * project is open, or the project is cleared.
 */
function withdrawRecoveryWarning(app) {
  const remove = app._recoveryWarningToast;
  app._recoveryWarningToast = () => {};
  remove?.();
}

/**
 * When recovery is written: warn of the images it did not keep, only when
 * that set has changed since it was last said (the same warning is not
 * repeated on every autosave), once per project opened, restored or cleared;
 * with every image kept again, the warning goes.
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
  else withdrawRecoveryWarning(app);
}

/**
 * A new project (opened, restored or cleared): what it leaves out is said
 * afresh, and the last project's warning goes.
 */
export function resetRecoveryWarnings(app) {
  app._recoveryOmissionSignature = EMPTY_SIGNATURE;
  app._autosaveAssetWarningShown = false;
  app._autosaveBackgroundWarningShown = false;
  withdrawRecoveryWarning(app);
}

// ---------------------------------------------------------------------------
// Restore

function sanitiseOmitted(list) {
  if (!Array.isArray(list)) return [];
  const reasons = new Set(Object.keys(REASON_WORDS));
  return list.filter(entry => entry && typeof entry === 'object' && ROLES.includes(entry.role)).map(entry => {
    const clean = {
      role: entry.role,
      name: validName(entry.name),
      reason: reasons.has(entry.reason) ? entry.reason : R.UNREADABLE,
    };
    if (Array.isArray(entry.roles)) {
      const roles = ROLES.filter(role => entry.roles.includes(role));
      if (roles.length > 1) clean.roles = roles;
    }
    if (typeof entry.assetId === 'string') clean.assetId = entry.assetId;
    if (Array.isArray(entry.waypoints)) {
      clean.waypoints = entry.waypoints
        .filter(each => each && typeof each.id === 'string')
        .map(each => ({ id: each.id, label: typeof each.label === 'string' ? each.label.slice(0, 200) : '' }));
    }
    if (entry.fallback === 'dot' || entry.fallback === 'arrow') clean.fallback = entry.fallback;
    if (Array.isArray(entry.fallbacks)) {
      const fallbacks = ['arrow', 'dot'].filter(fallback => entry.fallbacks.includes(fallback));
      if (fallbacks.length > 1) clean.fallbacks = fallbacks;
      else if (fallbacks.length === 1) [clean.fallback] = fallbacks;
    }
    return clean;
  });
}

/**
 * Read one stored image and check it as an import does, strictly: its key
 * and digest (the store's), its actual byte length, its signature and MIME
 * type, a decode with its actual dimensions matching those stored. The
 * restore pinned it before its first read; the read's own pin goes here.
 * @returns {Promise<{ok: boolean, reason?: string, dataURL?: string, image?: Object,
 *   width?: number, height?: number, mimeType?: string, byteLength?: number}>}
 */
async function readImage(store, key, { name, maxBytes }) {
  if (!store) return { ok: false, reason: R.MISSING };
  if (!validKey(key)) return { ok: false, reason: R.UNREADABLE };
  const read = await store.read(key);
  if (!read.ok) return { ok: false, reason: read.reason === R.CANCELLED ? R.MISSING : read.reason };
  const { record, pin } = read;
  pin.release();
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
  const image = { role: 'image', roles: [], fallbacks: [], assetId, name: null, waypoints: [] };
  if (data.styles?.pathHead?.imageAssetId === assetId) {
    addRole(image, 'path-head', data.styles.pathHead.style === 'custom' ? 'arrow' : null);
  }
  (data.waypoints || []).forEach((waypoint, index) => {
    if (waypoint?.customImageAssetId !== assetId) return;
    addRole(image, 'marker', waypoint.markerStyle === 'custom' ? 'dot' : null);
    image.waypoints.push({ id: waypoint.id, label: waypointLabel(waypoint, index) });
  });
  if (image.roles.length === 0) addRole(image, 'image');
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
 * Never rejects. Every image the manifest names is pinned before the first
 * read (`pins`), and the whole restore is an operation of the store's
 * (`life`): the caller lets go of both with `releaseRestoredImages`, once
 * the project that replaces this one has pinned its own, or as it abandons
 * the restore.
 * @param {Object} app
 * @param {Object} data - The parsed record
 * @returns {Promise<{kind: string, data: Object, backgroundBase64: string|null,
 *   backgroundName: string|null, imageAssets: Array<ImageAsset>|null,
 *   omitted: Array<Object>, pins: Array<Object>, life: Object|null}>}
 */
export async function readRecoveryImages(app, data) {
  const manifest = data?.recoveryImages;
  if (manifest == null) {
    const inline = typeof data?.backgroundImage === 'string' ||
      (Array.isArray(data?.imageAssets) && data.imageAssets.some(asset => typeof asset?.base64 === 'string'));
    if (inline) {
      return {
        kind: 'inline', data, backgroundBase64: null, backgroundName: null, imageAssets: null, omitted: [], pins: [],
      };
    }
    return {
      kind: 'legacy',
      data,
      backgroundBase64: null,
      backgroundName: null,
      imageAssets: [],
      omitted: [{ role: 'background', name: null, reason: R.LEGACY }],
      pins: [],
    };
  }

  const store = storeOf(app);
  const limits = store?.limits ?? RECOVERY_IMAGE_LIMITS;
  const understood = typeof manifest === 'object' && manifest.version === RECOVERY_MANIFEST_VERSION;
  const omitted = understood ? sanitiseOmitted(manifest.omitted) : [];
  // Every image the record names is pinned before the first read, so no
  // tab's sweep can take one while another is read (Codex, code review round
  // 2, 1), and the restore is an operation a clear waits for until it has
  // let go of them (round 2, 3): at its commit, or as it is abandoned.
  const pins = [];
  const life = store?.beginOperation() ?? null;
  if (store && understood) {
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    const named = [manifest.background?.key, ...assets.map(each => each?.key)];
    for (const key of new Set(named.filter(validKey))) {
      const pin = store.pin(key);
      if (pin) pins.push(pin);
    }
  }

  let backgroundBase64 = null;
  let backgroundName = null;
  const background = understood ? manifest.background : null;
  if (background && typeof background === 'object') {
    const name = validName(background.name);
    const read = await readImage(store, background.key, {
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
    const read = await readImage(store, asset.key, { name, maxBytes: limits.MAX_BYTES });
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
  return { kind: 'manifest', data: restoredData, backgroundBase64, backgroundName, imageAssets, omitted, pins, life };
}

/**
 * Let go of what a restore pinned, once the project's own images are pinned
 * (its commit) or it is abandoned; then a clear waiting on it may sweep.
 * Safe to call more than once.
 */
export function releaseRestoredImages(restored) {
  for (const pin of restored?.pins?.splice(0) ?? []) pin.release();
  restored?.life?.end();
}

/**
 * After a restore has committed: warn of each image that did not come back,
 * and offer a background that did not. The background's prompt, shown in the
 * banner slot, is its warning: on screen, announced once, its name and why;
 * the toast names the rest, or the background too where the prompt cannot
 * show now, and then the prompt, when it shows, is not announced again
 * (Codex, code review round 1, 7). What is said is then what the first
 * record written says, so it is not said again.
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
  // The prompt waits for the slot: the toast has said the loss already.
  if (background && !prompted && app._backgroundPrompt) app._backgroundPrompt.announced = true;
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
 * - the loss is announced once: when the prompt first shows, unless a toast
 *   said it while the prompt waited;
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
// Early puts, garbage collection, Clear All, stopping

/**
 * Pin and store the live project's images now, so a record written soon
 * after rarely finds one still in flight: a background loaded or opened, an
 * image admitted, a project opened or restored, or an image Undo makes live
 * again; and let go of those that left it.
 * @param {Object} app
 * @returns {Promise|null}
 */
export function primeRecoveryImages(app) {
  const store = storeOf(app);
  if (!store) return null;
  const view = { waypoints: app.waypoints || [], styles: app.styles || {} };
  const { kept } = selectWithinLimits(liveImages(app, view), store.limits);
  const live = syncLiveImages(app, kept);
  const works = [...live.values()].map(entry => entry.work).filter(Boolean);
  return works.length > 0 ? Promise.allSettled(works) : null;
}

/**
 * After a record is written: delete the entries no record names and no tab
 * pins (`RecoveryImageStore.sweep`). Coalesced.
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
  run.promise = (async () => {
    // After this turn: what the write let go of is let go first.
    await new Promise(resolve => setTimeout(resolve, 0));
    if (app._recoveryGarbage !== run) return { ok: false, deleted: [] };
    return store.collectGarbage(key => isProtected(app, key));
  })().finally(() => {
    if (app._recoveryGarbage !== run) return;
    app._recoveryGarbage = null;
    if (run.again) scheduleRecoveryGarbage(app);
  });
  return run.promise;
}

/**
 * Clear All's part: the prompt, the warning, the carried losses and the
 * background's name go; the cleared project lets go of its images; then,
 * once its puts and reads still under way have settled, every entry no
 * record that remains names and no tab pins is deleted: what a record whose
 * removal failed, a kept or a held record names stays, and where any record
 * that remains cannot be read, nothing is deleted (Codex, code review round
 * 1, 2). An image another tab still shows stays: its pin protects it.
 * @param {Object} app
 * @returns {Promise<{ok: boolean}>|null} null where nothing can be stored;
 *   `ok` false where the images could not all be removed
 */
export function clearRecoveryImages(app) {
  endBackgroundPrompt(app);
  app._recoveryCarried = [];
  app._backgroundName = null;
  resetRecoveryWarnings(app);
  finishRecoveryRevision(app, app._recoveryRevision);
  releaseLiveImages(app);
  app._recoveryGarbage = null;
  const store = app.recoveryImageStore;
  if (!store?.backend) return null;
  const clearing = store.clear(key => isProtected(app, key)).then(result => ({ ok: result.ok }));
  app._recoveryClearing = clearing;
  clearing.finally(() => {
    if (app._recoveryClearing === clearing) app._recoveryClearing = null;
  });
  return clearing;
}

/**
 * The app stops (a reload in the tests; the page itself lets its locks go
 * when it unloads): the prompt's wait and every pin it holds go.
 * @param {Object} app
 */
export function stopRecoveryImages(app) {
  endBackgroundPrompt(app);
  finishRecoveryRevision(app, app._recoveryRevision);
  releaseLiveImages(app);
  app._recoveryGarbage = null;
}

/**
 * Settles once no work of recovery's images is under way in this app: the
 * live images' puts, the current revision's, a sweep. For tests, and for
 * anything that must not race them.
 * @param {Object} app
 * @returns {Promise<void>}
 */
export async function recoveryImagesIdle(app) {
  for (let round = 0; round < 20; round += 1) {
    const waits = [];
    for (const entry of app._recoveryLive?.values() ?? []) if (entry.work) waits.push(entry.work);
    const revision = app._recoveryRevision;
    if (revision && !revision.done) {
      for (const entry of revision.entries) if (entry.work) waits.push(entry.work);
    }
    if (app._recoveryGarbage?.promise) waits.push(app._recoveryGarbage.promise);
    if (app._recoveryClearing) waits.push(app._recoveryClearing);
    const store = app.recoveryImageStore;
    if (store?.available && (store._operations?.size || store.sweeping)) waits.push(store.idle());
    if (waits.length === 0) return;
    await Promise.allSettled(waits);
  }
}
