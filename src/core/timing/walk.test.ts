// CORE-02: the lead's walk, with the plan's three worked examples (§3) as tests by name.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Route } from '../model/scene';
import { leadWalk } from './walk';

type Direction = Route['lines'][number]['direction'];

/** Lines from a spec: `A>B` runs one way, `A-B` both ways; each line's id is its spec. */
function linesOf(specs: readonly string[]) {
  return specs.map((spec) => {
    const [from = '', to = ''] = spec.split(/[>-]/);
    const direction: Direction = spec.includes('>') ? 'one way' : 'both ways';
    return { id: spec, from, to, direction, speedFactor: 1 };
  });
}

const walkOf = (specs: readonly string[], leadStart: string | null) => leadWalk({ lines: linesOf(specs), leadStart });
const steps = (specs: readonly string[], leadStart: string) =>
  walkOf(specs, leadStart).walked.map((line) => `${line.from}>${line.to}`);

describe('the lead’s walk (§3)', () => {
  it('a fork that rejoins: goes both ways at B, joins once at E, then walks E→F once', () => {
    const walk = walkOf(['A>B', 'B>C', 'B>D', 'C>E', 'D>E', 'E>F'], 'A');
    expect(walk.walked.map((line) => line.lineId)).toEqual(['A>B', 'B>C', 'C>E', 'E>F', 'B>D', 'D>E']);
    expect([...walk.joins]).toEqual(['E']);
    expect(walk.leftOut).toEqual([]);
  });

  it('a loop: D→B closes the loop and is left out, so the lead’s branch ends at D', () => {
    const walk = walkOf(['A>B', 'B>C', 'C>D', 'D>B'], 'A');
    expect(walk.walked.map((line) => line.lineId)).toEqual(['A>B', 'B>C', 'C>D']);
    expect(walk.leftOut).toEqual(['D>B']);
    expect(walk.joins.size).toBe(0);
  });

  it('two starts: from S1 the lead walks S1→J→E; S2→J is unreachable, and J is not a join', () => {
    const walk = walkOf(['S1>J', 'S2>J', 'J>E'], 'S1');
    expect(walk.walked.map((line) => line.lineId)).toEqual(['S1>J', 'J>E']);
    expect(walk.leftOut).toEqual(['S2>J']);
    expect(walk.joins.has('J')).toBe(false);
  });

  it('takes a two-way line in the direction the search first meets it, and never back', () => {
    expect(steps(['A-B', 'B-C'], 'B')).toEqual(['B>A', 'B>C']);
    expect(steps(['A-B', 'C-B'], 'A')).toEqual(['A>B', 'B>C']);
    expect(walkOf(['A-B'], 'A').leftOut).toEqual([]);
  });

  it('never walks a one-way line against its direction', () => {
    expect(walkOf(['B>A'], 'A').walked).toEqual([]);
    expect(walkOf(['B>A'], 'A').leftOut).toEqual(['B>A']);
  });

  it('walks nothing without a start, and leaves every line out', () => {
    expect(walkOf(['A>B'], null)).toEqual({ walked: [], leftOut: ['A>B'], joins: new Set() });
  });

  it('walks a chain of the most points the model allows without overflowing the stack', () => {
    const specs = Array.from({ length: 9_999 }, (_, i) => `p${i}>p${i + 1}`);
    const walk = walkOf(specs, 'p0');
    expect(walk.walked).toHaveLength(9_999);
    expect(walk.walked[9_998]).toEqual({ lineId: 'p9998>p9999', from: 'p9998', to: 'p9999' });
  });

  it('as a property: no line is walked twice, the walk has no cycle, walked and left out share the lines', () => {
    const name = fc.integer({ min: 0, max: 7 }).map((n) => `P${n}`);
    const spec = fc.tuple(name, name, fc.boolean()).filter(([a, b]) => a !== b);
    fc.assert(
      fc.property(fc.uniqueArray(spec, { maxLength: 20, selector: ([a, b]) => `${a}${b}` }), (raw) => {
        const specs = raw.map(([a, b, both]) => `${a}${both ? '-' : '>'}${b}`);
        const walk = walkOf(specs, 'P0');
        const ids = walk.walked.map((line) => line.lineId);
        expect(new Set(ids).size).toBe(ids.length);
        expect([...ids, ...walk.leftOut].sort()).toEqual([...specs].sort());
        expect(hasCycle(walk.walked)).toBe(false);
      }),
    );
  });
});

function hasCycle(lines: readonly { from: string; to: string }[]): boolean {
  const inDegree = new Map<string, number>();
  for (const { from, to } of lines) {
    inDegree.set(from, inDegree.get(from) ?? 0);
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }
  const ready = [...inDegree].filter(([, d]) => d === 0).map(([p]) => p);
  let seen = 0;
  while (ready.length > 0) {
    const at = ready.pop();
    seen += 1;
    for (const line of lines.filter((l) => l.from === at)) {
      const d = (inDegree.get(line.to) ?? 0) - 1;
      inDegree.set(line.to, d);
      if (d === 0) ready.push(line.to);
    }
  }
  return seen < inDegree.size;
}
