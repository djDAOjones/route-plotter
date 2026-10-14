import { ANIMATION, PATH_VISIBILITY } from '../config/constants.js';
import { PlayerCore } from '../core/PlayerCore.js';
import { CoordinateTransform } from '../services/CoordinateTransform.js';
import { PathCalculator } from '../services/PathCalculator.js';
import { MotionVisibilityService } from '../services/MotionVisibilityService.js';
import { composeRouteTimeline } from './branchTiming.js';
import { resolveRouteBranches, branchPathWaypoints, trunkWaypoints } from './routeBranches.js';
import { resolveRenderReference } from './renderReference.js';
import { FINISH_REFERENCE } from './finishArea.js';

// Every authored value read by splines, branch topology and PlayerCore timing.
// Presentation, current canvas, transport state and saved routed duration are
// deliberately absent: they cannot alter a finish journey's actual clock.
const WAYPOINT_INPUTS = ['id', 'imgX', 'imgY', 'isMajor', 'branchId', 'branchFrom', 'branchRejoin',
  'pathShape', 'shapeAmplitude', 'shapeFrequency', 'segmentSpeed', 'pauseMode', 'pauseTime',
  'beaconStyle', 'rippleMaxScale', 'beaconScale', 'pulseCycleSpeed'];
const splineInput = w => ({ x: w.imgX, y: w.imgY, isMajor: w.isMajor,
  pathShape: w.pathShape, shapeAmplitude: w.shapeAmplitude, shapeFrequency: w.shapeFrequency });

/** Derived, per-host C clock. No live AnimationEngine or legacy spline caches. */
export class FinishReleaseClock {
  constructor() {
    this._runs = new Map();
    this._key = null;
    this._result = null;
  }

  resolve(input) {
    const waypoints = (input.waypoints || []).map(w => Object.fromEntries(WAYPOINT_INPUTS.map(k => [k, w[k]])));
    const trunk = trunkWaypoints(waypoints), hasRoute = trunk.length >= 2;
    const reference = resolveRenderReference(input.renderReference, FINISH_REFERENCE);
    const speed = Math.max(1, Math.round((input.speed || ANIMATION.DEFAULT_SPEED) / 5) * 5);
    const settings = input.motionSettings || {};
    const base = input.baseDuration > 0 ? input.baseDuration : ANIMATION.DEFAULT_DURATION;
    const key = JSON.stringify([waypoints, reference, input.imageWidth, input.imageHeight, input.backgroundZoom,
      speed, settings.pathVisibility, settings.pathTrail, settings.backgroundVisibility, hasRoute ? null : base]);
    if (this._key === key) return this._result;
    if (!hasRoute) {
      this._runs.clear();
      this._key = key;
      return this._result = { durationMs: base, routeAnchors: null };
    }
    const transform = new CoordinateTransform();
    transform.setCanvasDimensions(reference.width, reference.height);
    if (input.imageWidth > 0 && input.imageHeight > 0) {
      transform.setImageDimensions(input.imageWidth, input.imageHeight);
      transform.setBackgroundZoom(input.backgroundZoom ?? 1);
    }
    const used = new Set();
    const makeRun = (id, points, extra = {}) => {
      used.add(id);
      const values = points.map(splineInput), geometryKey = JSON.stringify(values);
      let geometry = this._runs.get(id);
      if (geometry?.key !== geometryKey) {
        // Fresh per changed COMPLETE tuple, including edits later cancelled.
        const calculator = new PathCalculator(), path = calculator.calculatePath(values);
        geometry = { key: geometryKey, calculator, path,
          progress: calculator.calculateWaypointProgress(path, values) };
        this._runs.set(id, geometry);
      }
      const pathLengthPx = geometry.calculator.calculatePathLength(
        geometry.path.map(p => transform.imageToCanvas(p.x, p.y)));
      return { id, waypoints: points, progressValues: geometry.progress, pathLengthPx, ...extra };
    };
    const runs = [makeRun(null, trunk, { forkFromId: null, rejoinAtId: null })];
    const structure = resolveRouteBranches(waypoints);
    for (const branch of structure.branches) {
      const points = branchPathWaypoints(structure, branch.id, waypoints);
      if (points.length < 2) continue;
      runs.push(makeRun(branch.id, points, { forkFromId: branch.forkFromId, rejoinAtId: branch.rejoinAtId,
        anchorIds: [branch.forkFromId, branch.rejoinAtId].filter(Boolean) }));
    }
    for (const id of this._runs.keys()) if (!used.has(id)) this._runs.delete(id);
    const composed = composeRouteTimeline(runs, speed), run = runs[0];
    const majors = [], progress = [];
    trunk.forEach((w, i) => { if (w.isMajor !== false) { majors.push(w); progress.push(run.progressValues[i]); } });
    let pathDuration = (run.pathLengthPx / speed) * 1000, segments = [], hasVariableSpeed = false;
    if (majors.length >= 2 && majors.some(w => w.segmentSpeed !== undefined && w.segmentSpeed !== 1)) {
      const lengths = new PathCalculator().legTimingLengths(progress, run.pathLengthPx);
      ({ pathDuration, segments, hasVariableSpeed } = PlayerCore.buildSegments(lengths, progress, majors, speed));
    }
    // The trunk's uniform/insufficient-major fallback is not buildRunLeg's
    // zero-duration fallback. Its own exact formula must survive this split.
    const { totalPauseTime } = PlayerCore.buildPauses(trunk, pathDuration, run.progressValues,
      0, segments, hasVariableSpeed);
    const reveal = ['spotlight-reveal', 'angle-of-view-reveal'].includes(settings.backgroundVisibility);
    const intro = reveal ? MotionVisibilityService.INTRO_ANIMATION.DURATION_MS : 0;
    const trailMs = settings.pathTrail * pathDuration;
    const tail = settings.pathVisibility === PATH_VISIBILITY.INSTANTANEOUS && trailMs > 0 ? trailMs + 500 : 0;
    let durationMs = ((pathDuration + intro) + totalPauseTime) + tail;
    if (runs.length > 1 && composed.totalDurationMs > 0) {
      durationMs = Math.max(durationMs, (composed.totalDurationMs + intro) + tail);
    }
    const pauseMsById = {};
    for (const leg of Object.values(composed.legsById)) for (const pause of leg.timeline?.pauses || []) {
      const id = pause.waypoint?.id;
      if (id !== undefined) pauseMsById[id] = (pauseMsById[id] || 0) + pause.duration;
    }
    this._key = key;
    return this._result = { durationMs, routeAnchors: { arrivalMsById: composed.arrivalMsById,
      pauseMsById, totalDurationMs: composed.totalDurationMs } };
  }
}
