import { CROWD_GROUPS } from '../config/constants.js';

const unit = (dx, dy) => {
  const length = Math.hypot(dx, dy);
  return length > 0 ? { x: dx / length, y: dy / length, perpX: -dy / length, perpY: dx / length } : null;
};
const reverse = tangent => tangent ? { x: -tangent.x, y: -tangent.y,
  perpX: -tangent.perpX, perpY: -tangent.perpY } : null;
const upperBound = (values, value) => {
  let lo = 0, hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};
const lowerBound = (values, value) => {
  let lo = 0, hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** Active-only true arc distance. Pin spline endpoints without changing old samplers. */
export function createGroupArc(path, from, to) {
  const points = path.length >= 2 ? path.map(p => ({ x: p.x, y: p.y })) : [{ ...from }, { ...to }];
  points[0] = { ...from }; points[points.length - 1] = { ...to };
  const prefix = new Float64Array(points.length);
  let firstTangent = null, lastTangent = null;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x, dy = points[i].y - points[i - 1].y;
    prefix[i] = prefix[i - 1] + Math.hypot(dx, dy);
    const tangent = unit(dx, dy);
    if (tangent) { firstTangent ??= tangent; lastTangent = tangent; }
  }
  const length = prefix[prefix.length - 1];
  return { points, prefix, length, firstTangent, lastTangent,
    sample(distance, reversed = false) {
      if (distance <= 0) return { point: points[0], tangent: firstTangent };
      if (distance >= length) return { point: points[points.length - 1], tangent: lastTangent };
      const index = upperBound(prefix, distance) - 1;
      const a = points[index], b = points[index + 1];
      const fraction = (distance - prefix[index]) / (prefix[index + 1] - prefix[index]);
      // At a vertex, reverse travel departs on the previous nonzero segment.
      // Keep the point calculation unchanged, including rounded prefix plateaus.
      const tangentIndex = reversed && prefix[index] === distance ? lowerBound(prefix, distance) - 1 : index;
      const ta = points[tangentIndex], tb = points[tangentIndex + 1];
      return { point: { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction },
        tangent: unit(tb.x - ta.x, tb.y - ta.y) };
    },
  };
}

/** Compact route: one typed ordinal/reversal sequence, sharing every edge arc. */
export function traceGroupJourney(routing, entry, choose, geometryFor) {
  const { MAX_HOPS, CHECKPOINT_HOPS } = CROWD_GROUPS;
  routing.traceScratch ??= new Uint32Array(MAX_HOPS);
  routing.checkpointScratch ??= new Float64Array(Math.ceil(MAX_HOPS / CHECKPOINT_HOPS) + 1);
  routing.arcs ??= [];
  const scratch = routing.traceScratch, prefix = routing.checkpointScratch;
  prefix[0] = 0;
  let node = entry, from = null, hops = 0, length = 0, checkpointCount = 1;
  let firstTangent = null, lastTangent = null, ends = false;
  for (let step = 0; step < MAX_HOPS; step++) {
    if ((node.type === 'exit' && step > 0)
        || (step > 0 && routing.fallbackExits?.has(node.id))) { ends = true; break; }
    const walk = choose(routing.byNode.get(node.id), from, step + 1);
    if (!walk) { ends = true; break; }
    const { ordinal, reversed, edge } = walk;
    const arc = routing.arcs[ordinal] ??= geometryFor(ordinal);
    scratch[hops++] = ordinal * 2 + (reversed ? 1 : 0);
    length += arc.length;
    if (hops % CHECKPOINT_HOPS === 0) prefix[checkpointCount++] = length;
    const first = reversed ? reverse(arc.lastTangent) : arc.firstTangent;
    const last = reversed ? reverse(arc.firstTangent) : arc.lastTangent;
    if (first) { firstTangent ??= first; lastTangent = last; }
    from = edge.id;
    node = routing.graph.getNode(reversed ? edge.sourceId : edge.targetId);
    if (!node) break;
  }
  if (hops % CHECKPOINT_HOPS !== 0) prefix[checkpointCount++] = length;
  const CodeArray = routing.edges.length <= 32768 ? Uint16Array : Uint32Array;
  return { routing, codes: new CodeArray(scratch.subarray(0, hops)),
    checkpoints: prefix.slice(0, checkpointCount), hops, length, ends,
    entry, terminal: node, start: { ...entry.position() }, end: { ...(node || entry).position() },
    firstTangent, lastTangent };
}

/** Bounded checkpoint lookup; extension also defines smoothing at parked endpoints. */
export function sampleGroupJourney(journey, distance) {
  const { length, start, end, firstTangent, lastTangent } = journey;
  if (distance < 0 || distance >= length) {
    const atStart = distance < 0, origin = atStart ? start : end;
    const tangent = atStart ? firstTangent : lastTangent;
    const direction = tangent || { x: 1, y: 0 }, extra = atStart ? distance : distance - length;
    return { point: { x: origin.x + direction.x * extra, y: origin.y + direction.y * extra }, tangent };
  }
  const block = Math.min(upperBound(journey.checkpoints, distance) - 1,
    Math.floor((journey.hops - 1) / CROWD_GROUPS.CHECKPOINT_HOPS));
  let walked = journey.checkpoints[block];
  const first = block * CROWD_GROUPS.CHECKPOINT_HOPS;
  const limit = Math.min(journey.hops, first + CROWD_GROUPS.CHECKPOINT_HOPS);
  for (let i = first; i < limit; i++) {
    const code = journey.codes[i], arc = journey.routing.arcs[Math.floor(code / 2)];
    const next = walked + arc.length;
    if (distance < next) {
      const reversed = code % 2 === 1;
      const result = arc.sample(reversed ? arc.length - (distance - walked) : distance - walked, reversed);
      return reversed ? { point: result.point, tangent: reverse(result.tangent) } : result;
    }
    walked = next;
  }
  return { point: end, tangent: lastTangent };
}

/** Chord magnitude narrows U-turns; never normalise every nonzero chord to one. */
export function groupNormal(journey, distance, width) {
  const radius = width / 2;
  if (!(radius > 0)) return { x: 0, y: 0 };
  const before = sampleGroupJourney(journey, distance - radius).point;
  const after = sampleGroupJourney(journey, distance + radius).point;
  const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy);
  if (!(length > 0)) return { x: 0, y: 0 };
  const magnitude = Math.min(1, length / width);
  return { x: -dy / length * magnitude, y: dx / length * magnitude };
}

export function groupOffsets(count, width) {
  const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns), column = index % columns;
    const inRow = Math.min(columns, count - row * columns);
    return { across: width === 0 || inRow === 1 ? 0 : (column / (inRow - 1) - 0.5) * width,
      behind: rows === 1 ? 0 : row / (rows - 1) * width };
  });
}
