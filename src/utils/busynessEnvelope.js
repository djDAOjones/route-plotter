/**
 * Pure helpers for authored crowd busyness envelopes.
 *
 * The envelope describes relative release density across an emitter's
 * normalised release window. It never contains transient dot state: the
 * evaluator converts a dot's deterministic quantile into a release time.
 */

export const MAX_BUSYNESS_HANDLES = 8;
export const BUSYNESS_TRANSITIONS = Object.freeze(['gradual', 'step']);

const DEFAULT_ENVELOPE = Object.freeze([
  Object.freeze({ time: 0, value: 1, transition: 'gradual' }),
  Object.freeze({ time: 1, value: 1, transition: 'gradual' }),
]);

export function defaultBusynessEnvelope() {
  return DEFAULT_ENVELOPE.map(handle => ({ ...handle }));
}

/**
 * Coerce authoring input into a safe, ordered envelope. Persisted project
 * input is validated separately so corrupt data is rejected, not repaired.
 * @param {*} input
 * @returns {Array<{time:number, value:number, transition:'gradual'|'step'}>}
 */
export function normalizeBusynessEnvelope(input) {
  if (!Array.isArray(input)) return defaultBusynessEnvelope();

  const handles = input
    .slice(0, MAX_BUSYNESS_HANDLES)
    .map(handle => ({
      time: clamp01(Number(handle?.time)),
      value: clamp01(Number(handle?.value)),
      transition: BUSYNESS_TRANSITIONS.includes(handle?.transition)
        ? handle.transition
        : 'gradual',
    }))
    .filter(handle => Number.isFinite(handle.time) && Number.isFinite(handle.value))
    .sort((a, b) => a.time - b.time)
    .filter((handle, index, ordered) => index === 0 || handle.time > ordered[index - 1].time);

  if (handles.length === 0 || handles[0].time !== 0) {
    handles.unshift({ time: 0, value: handles[0]?.value ?? 1, transition: 'gradual' });
  }
  if (handles.at(-1)?.time !== 1) {
    handles.push({ time: 1, value: handles.at(-1)?.value ?? 1, transition: 'gradual' });
  }

  const bounded = handles.slice(0, MAX_BUSYNESS_HANDLES);
  if (bounded.at(-1)?.time !== 1) bounded[bounded.length - 1].time = 1;
  return compileBusynessEnvelope(bounded).totalArea > 0
    ? bounded
    : defaultBusynessEnvelope();
}

/**
 * Strictly validate the authored persistence shape.
 * @param {*} input
 * @throws {Error} If the envelope is malformed or has no releasable area.
 */
export function assertValidBusynessEnvelope(input) {
  if (!Array.isArray(input) || input.length < 2 || input.length > MAX_BUSYNESS_HANDLES) {
    throw new Error(`Invalid emitter busynessEnvelope: expected 2 to ${MAX_BUSYNESS_HANDLES} handles`);
  }

  input.forEach((handle, index) => {
    if (!handle || typeof handle !== 'object' || Array.isArray(handle)) {
      throw new Error('Invalid emitter busynessEnvelope handle: expected an object');
    }
    if (!Number.isFinite(handle.time) || handle.time < 0 || handle.time > 1 ||
        !Number.isFinite(handle.value) || handle.value < 0 || handle.value > 1) {
      throw new Error('Invalid emitter busynessEnvelope handle: expected time and value from 0 to 1');
    }
    if (!BUSYNESS_TRANSITIONS.includes(handle.transition)) {
      throw new Error('Invalid emitter busynessEnvelope transition');
    }
    if (index > 0 && handle.time <= input[index - 1].time) {
      throw new Error('Invalid emitter busynessEnvelope: handle times must increase');
    }
  });

  if (input[0].time !== 0 || input.at(-1).time !== 1) {
    throw new Error('Invalid emitter busynessEnvelope: endpoints must be at 0 and 1');
  }
  if (compileBusynessEnvelope(input).totalArea <= 0) {
    throw new Error('Invalid emitter busynessEnvelope: at least one span must be busy');
  }
}

/**
 * Pre-calculate segment areas once per emitter evaluation so every dot can
 * invert the same density distribution cheaply and deterministically.
 * @param {Array<Object>} handles
 * @returns {{segments:Array<Object>, totalArea:number}}
 */
export function compileBusynessEnvelope(handles) {
  const segments = [];
  let totalArea = 0;
  for (let index = 0; index < handles.length - 1; index++) {
    const current = handles[index];
    const next = handles[index + 1];
    const duration = next.time - current.time;
    const gradual = current.transition === 'gradual';
    const area = duration * (gradual ? (current.value + next.value) / 2 : current.value);
    segments.push({
      start: current.time,
      end: next.time,
      startValue: current.value,
      endValue: next.value,
      gradual,
      area,
      cumulativeStart: totalArea,
    });
    totalArea += area;
  }
  return { segments, totalArea };
}

/**
 * Map a normalised deterministic dot quantile through an authored release
 * density. The inverse CDF preserves exact dot count by the window end.
 * @param {{segments:Array<Object>, totalArea:number}} compiled
 * @param {number} quantile
 * @returns {number} Normalised time in the release window.
 */
export function sampleBusynessEnvelope(compiled, quantile) {
  if (!compiled || compiled.totalArea <= 0) return clamp01(quantile);
  const target = clamp01(quantile) * compiled.totalArea;
  let lastPositive = null;

  for (const segment of compiled.segments) {
    if (segment.area <= 0) continue;
    lastPositive = segment;
    const endArea = segment.cumulativeStart + segment.area;
    if (target > endArea) continue;

    const localArea = Math.max(0, target - segment.cumulativeStart);
    const duration = segment.end - segment.start;
    let fraction;
    if (!segment.gradual || Math.abs(segment.endValue - segment.startValue) < 1e-12) {
      fraction = localArea / segment.area;
    } else {
      const delta = segment.endValue - segment.startValue;
      const densityArea = localArea / duration;
      const discriminant = Math.max(0, segment.startValue ** 2 + 2 * delta * densityArea);
      fraction = (-segment.startValue + Math.sqrt(discriminant)) / delta;
    }
    return segment.start + clamp01(fraction) * duration;
  }

  return lastPositive?.end ?? 1;
}

/** @param {Array<Object>} handles @param {number} time */
export function busynessAt(handles, time) {
  const t = clamp01(time);
  for (let index = 0; index < handles.length - 1; index++) {
    const current = handles[index];
    const next = handles[index + 1];
    if (t > next.time) continue;
    if (current.transition === 'step') return current.value;
    const span = next.time - current.time;
    const local = span > 0 ? (t - current.time) / span : 0;
    return current.value + (next.value - current.value) * local;
  }
  return handles.at(-1)?.value ?? 1;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return NaN;
  return Math.max(0, Math.min(1, value));
}
