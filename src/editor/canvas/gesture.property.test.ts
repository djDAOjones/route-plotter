// CORE-06: the pointer's binding as a property over random event sequences from several pointers, on a real store with
// a small route. After every event: the store's gesture is open exactly while the machine drags; every down the machine
// took ends in exactly one `finish` or one `cancel`, and every store gesture it opened in exactly one commit or one
// cancel, never both and never two; a cancel, a lost capture or a blur of the owning pointer leaves the project and the
// selection as they were before its down; and the undo history grows by at most one step a gesture.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import { createStore, type Store } from '../store/store';
import { addPoint } from './commands';
import { bindPointer } from './gesture';
import type { PointerInput, Under } from './pointer';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

const NONE = { alt: false, shift: false, meta: false };
const BOUNDS = { x: 0, y: 0, width: 1000, height: 800, scale: 1 };

function world() {
  const nextId = counter('seed');
  const points = [0.01, 0.02, 0.03].map((x) => newPoint(nextId, { x, y: 0.01, kind: 'stop' }));
  const [a, b, c] = points.map((point) => point.id);
  if (a === undefined || b === undefined || c === undefined) throw new Error('three points');
  const route: Route = { ...newRoute(nextId), points, lines: [newLine(nextId, a, b), newLine(nextId, b, c)], leadStart: a };
  const project: Project = { scene: { ...newScene(nextId), routes: [route] }, images: [] };
  return { store: createStore({ project, nextId: counter('new') }), route: route.id, ids: [a, b, c] };
}

/** `store` with every gesture it opens counted: how many opened, and how each ended. */
function counted(store: Store) {
  const tally = { opened: 0, ends: [] as number[] };
  const wrapped: Store = {
    ...store,
    begin: (label) => {
      const begun = store.begin(label);
      if (!begun.ok) return begun;
      const index = tally.opened;
      tally.opened += 1;
      tally.ends[index] = 0;
      const { gesture } = begun;
      const ended = () => {
        tally.ends[index] = (tally.ends[index] ?? 0) + 1;
      };
      return {
        ok: true,
        gesture: {
          apply: (command) => gesture.apply(command),
          commit: () => (ended(), gesture.commit()),
          cancel: () => (ended(), gesture.cancel()),
        },
      };
    },
  };
  return { wrapped, tally };
}

/** One random event, from pointer 1 or 2, of any kind; a down names a point, a line or nothing under it. */
const anInput = (route: string, ids: readonly string[]) => {
  const under = fc.oneof(
    fc.constant<Under>(null),
    fc.constantFrom(...ids).map((id): Under => ({ kind: 'point', route, id })),
    fc.constantFrom(...ids).map((id): Under => ({ kind: 'point', route, id })),
    fc.constant<Under>({ kind: 'line', route, id: 'line' }),
  );
  const contact = fc.record({
    pointerId: fc.constantFrom(1, 1, 1, 2),
    primary: fc.constantFrom(true, true, true, false),
    button: fc.constantFrom(0, 0, 0, 2),
    at: fc.record({ x: fc.integer({ min: 0, max: 12 }), y: fc.integer({ min: 0, max: 12 }) }),
    modifiers: fc.constantFrom(NONE, NONE, NONE, { ...NONE, alt: true }, { ...NONE, shift: true }, { ...NONE, meta: true }),
  });
  const selection = fc.subarray([...ids]).map((points) => ({ route, points }));
  // fast-check biases toward small values and first choices, which would keep every move within the threshold.
  return fc.noBias(fc.oneof(
    { arbitrary: fc.tuple(contact, under, selection).map(([c, u, s]): PointerInput => ({ kind: 'down', ...c, under: u, selection: s })), weight: 3 },
    { arbitrary: fc.tuple(contact, fc.constantFrom<'move' | 'up' | 'cancel' | 'lost-capture'>('move', 'move', 'move', 'up', 'up', 'cancel', 'lost-capture')).map(
      ([c, kind]): PointerInput => ({ kind, ...c }),
    ),
    weight: 8 },
    { arbitrary: fc.constant<PointerInput>({ kind: 'blur' }), weight: 1 },
  ));
};

describe('the pointer’s binding over random event sequences', () => {
  it('one gesture at a time, each ended once, a cancel restoring what its down found, at most one step a gesture', () => {
    const { route, ids } = world();
    // What the runs reached, so that the property is not passed by sequences that never drag.
    const reach = { committed: 0, cancelled: 0, taps: 0 };
    fc.assert(
      fc.property(fc.array(anInput(route, ids), { minLength: 10, maxLength: 60 }), (inputs) => {
        const { store } = world();
        const { wrapped, tally } = counted(store);
        const binding = bindPointer({
          store: wrapped,
          bounds: () => BOUNDS,
          onTap: (tap) => (tap.under === null ? addPoint(route, { ...tap.place, kind: 'stop' }) : null),
        });
        let taken = 0;
        let terminal = 0;
        let before: { project: unknown; selection: unknown } | null = null;
        for (const input of [...inputs, { kind: 'blur' } as const]) {
          const owner = binding.state();
          const effects = binding.send(input);
          for (const effect of effects) {
            if (effect.kind === 'capture') {
              taken += 1;
              const { project, selection } = store.getState();
              before = { project, selection };
            }
            if (effect.kind === 'finish' || effect.kind === 'cancel') terminal += 1;
            if (effect.kind === 'tap') reach.taps += 1;
            if (store.getState().gesture === null && owner.phase === 'dragging') {
              if (effect.kind === 'finish') reach.committed += 1;
              if (effect.kind === 'cancel') reach.cancelled += 1;
            }
          }
          const ownerEnded = owner.phase !== 'idle' && (input.kind === 'blur' || ('pointerId' in input && input.pointerId === owner.pointerId));
          if (ownerEnded && (input.kind === 'blur' || input.kind === 'cancel' || input.kind === 'lost-capture')) {
            expect(effects.filter((each) => each.kind === 'cancel')).toHaveLength(1);
            const { project, selection } = store.getState();
            expect({ project, selection }).toEqual(before);
          }
          expect(store.getState().gesture !== null).toBe(binding.state().phase === 'dragging');
          expect(terminal).toBe(binding.state().phase === 'idle' ? taken : taken - 1);
        }
        expect(tally.ends.every((count) => count === 1)).toBe(true);
        let steps = 0;
        while (store.undo().ok) steps += 1;
        expect(steps).toBeLessThanOrEqual(taken);
      }),
      { numRuns: 300 },
    );
    expect(reach.committed).toBeGreaterThan(0);
    expect(reach.cancelled).toBeGreaterThan(0);
    expect(reach.taps).toBeGreaterThan(0);
  });
});
