import { createFinishPackingContext, FINISH_REFERENCE } from '../utils/finishArea.js';
import { FinishReleaseClock } from '../utils/finishReleaseClock.js';
import { resolveRenderReference } from '../utils/renderReference.js';
import { areaImageAspect } from '../utils/crowdArea.js';
import { crowdAreaDescription } from '../utils/crowdAreaDescription.js';
import { groupsActive } from '../utils/groupSettings.js';

const EMPTY = Object.freeze({});

export function hasFinishAreas(scene) {
  return !!scene?.getFlowLayers?.().some(layer => layer.guideType === 'graph'
    && layer.graph.getNodes().some(node => node.type === 'exit' && node.area));
}

/** Active groups use C's reference clock even without a Finish area. */
export function hasReferenceMotion(scene) {
  return hasFinishAreas(scene) || !!scene?.getFlowLayers?.().some(layer =>
    layer.graph.getNodes().length > 0 && layer.graph.getEdges().length > 0
      && layer.emitters.some(emitter => groupsActive(layer, emitter)));
}

/** C/F migration uses authored references first; inactive projects keep the old fallback. */
export function finishRenderReference(scene, reference, timing, legacyFallback = null) {
  return resolveRenderReference(reference, timing, hasReferenceMotion(scene) ? FINISH_REFERENCE : legacyFallback);
}

/**
 * One authored context shared by timing, admission, hints, rendering and both
 * hosts. Bitmap dimensions come from the installed image, not a stale fitted
 * transform. During video export the app freezes this before suppressing the
 * background, and clears it after restoring the real authored image.
 */
export function getFinishContexts(app) {
  if (app._finishExportContexts) return app._finishExportContexts;
  if (app._installingFinishContext || !hasReferenceMotion(app.scene)) return EMPTY;
  let host = app._finishContextState;
  if (!host) host = app._finishContextState = { clock: new FinishReleaseClock() };
  const image = app.background?.image;
  const input = { renderReference: app.renderReference,
    imageWidth: image?.naturalWidth || image?.width || 0,
    imageHeight: image?.naturalHeight || image?.height || 0,
    backgroundZoom: (app.exportSettings?.backgroundZoom ?? 100) / 100 };
  const packingKey = JSON.stringify(input);
  if (host.packingKey !== packingKey) {
    host.packingKey = packingKey;
    host.packing = createFinishPackingContext(input);
  }
  const release = host.clock.resolve({ ...input, waypoints: app.waypoints,
    speed: app.animationEngine?.state.speed, baseDuration: app.animationEngine?.state.baseDuration,
    motionSettings: app.motionSettings });
  if (host.result?.finishPackingContext !== host.packing || host.result?.finishReleaseContext !== release) {
    host.result = { finishPackingContext: host.packing, finishReleaseContext: release };
  }
  return host.result;
}

export function getNodeAreaDescription(app, layer, node) {
  const context = getFinishContexts(app);
  return crowdAreaDescription({ type: node?.type,
    hasImage: app.coordinateTransform?.imageWidth > 0 && app.coordinateTransform?.imageHeight > 0,
    summary: node?.type === 'exit' && node.area && !app._installingFinishContext
      ? app.swarmEngine.finishAreaSummary(layer, node.id,
        { ...context, imageAspect: areaImageAspect(app.coordinateTransform) }) : null,
    hasRoute: (app.waypoints?.length || 0) >= 2,
    constantTime: app.animationEngine?.state.mode === 'constant-time' });
}
