/** CROWD-08 D: independent choice oracles, complete legacy output and warm/cold cache checks. */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import * as routing from '../src/utils/graphRouting.js';
import { createFinishPackingContext } from '../src/utils/finishArea.js';

const context = { durationMs: 10000, imageAspect: 1 };
const area = { shape: 'rectangle', width: 0.2, height: 0.2, turn: 0 };
function crowd(weights, extra = {}) {
  return new FlowLayer({ id: 'crowd', guideType: 'graph', graph: {
    nodes: weights.flatMap((weight, i) => [
      { id: `in${i}`, type: 'entry', x: 0.2, y: (i + 1) / (weights.length + 1),
        ...(weight === undefined ? {} : { entryWeight: weight }) },
      { id: `out${i}`, type: 'exit', x: 0.5 + i / weights.length * 0.4, y: (i + 1) / (weights.length + 1) },
    ]),
    edges: weights.map((_, i) => ({ id: `edge${i}`, sourceId: `in${i}`, targetId: `out${i}`, direction: 'one-way' })),
  }, emitters: [{ id: 'people', seed: 7, dotCount: 32, speed: 0.2, speedVariance: 0,
    wobble: 0, releaseStart: 0, releaseDuration: 0, onsetVariance: 0, lifecycleMode: 'collect', ...extra }] });
}
class LegacyEntryEngine extends SwarmEngine {
  _pickEntry(entries, seed, dot, hop) {
    const r = SwarmEngine.hash(seed, dot, hop);
    return entries[Math.min(entries.length - 1, Math.floor(r * entries.length))];
  }
}
// Independent max-scaled oracle; never reads the implementation's distribution.
function chosen(weights, r) {
  const scale = weights.reduce((a, b) => a > b ? a : b);
  const scaled = weights.map(weight => weight / scale);
  const sum = scaled.reduce((a, b) => a + b);
  let bound = 0;
  for (let i = 0; i < weights.length; i++) {
    bound += scaled[i] / sum;
    if (r < bound) return i;
  }
  return weights.length - 1;
}
const pick = (engine, guide, seed, dot, hop = 0) =>
  engine._pickEntry(guide.entries, seed, dot, hop, guide.entryCumulative);
afterEach(() => vi.restoreAllMocks());

describe('Entry choices and displayed nominal shares', () => {
  test.each([1, 2, 3, 7, 100])('%i equal Entries retain every old position, schedule and finish', count => {
    for (const value of [undefined, 0.01, 13, Number.MAX_VALUE]) {
      for (const seed of [0, 7, 3612955045, 2166136261, 4294967295]) {
        const layer = crowd(new Array(count).fill(value), { seed, dotCount: 16 });
        const engine = new SwarmEngine(), legacy = new LegacyEntryEngine();
        const guide = engine._buildGraphGuide(layer.graph);
        for (let i = 0; i < 100; i++) {
          expect(pick(engine, guide, seed, i).id)
            .toBe(`in${Math.floor(SwarmEngine.hash(seed, i, 0) * count)}`);
        }
        for (const lifecycleMode of ['collect', 'disappear', 'respawn', 'loop']) {
          layer.emitters[0].lifecycleMode = lifecycleMode;
          expect(engine.scheduleDots(layer, context)).toEqual(legacy.scheduleDots(layer, context));
          expect(engine.crowdFinishMs(layer, context)).toBe(legacy.crowdFinishMs(layer, context));
          for (const t of [0, 500, 5000, 17000, 100]) {
            expect(engine.evaluate(t, layer, context)).toEqual(legacy.evaluate(t, layer, context));
          }
        }
      }
    }
  });

  test('the exact equal-bin witness keeps index50, not49', () => {
    const engine = new SwarmEngine(), layer = crowd(new Array(100).fill(17));
    expect(SwarmEngine.hash(3612955045, 0, 0)).toBe(0.5);
    expect(pick(engine, engine._buildGraphGuide(layer.graph), 3612955045, 0).id).toBe('in50');
  });

  test.each([
    [1, 3], [2, 3, 5], [Number.MAX_VALUE, Number.MAX_VALUE / 2, 0.01],
    [0.01, Number.MAX_VALUE], [Number.MAX_VALUE, 0.01],
  ])('weighted choices use one unchanged hash: %j', (...weights) => {
    const layer = crowd(weights), engine = new SwarmEngine(), guide = engine._buildGraphGuide(layer.graph);
    for (const r of [0, 0.1, 0.24999999999999997, 0.25, 0.25000000000000006, 0.5, 0.9999999997671694]) {
      const hash = vi.spyOn(SwarmEngine, 'hash').mockReturnValue(r);
      expect(pick(engine, guide, 73, 29, 41).id).toBe(`in${chosen(weights, r)}`);
      expect(hash.mock.calls).toEqual([[73, 29, 41]]);
      hash.mockRestore();
    }
  });

  test('real zero hash and overflow pairs keep the documented extreme-order behavior', () => {
    expect(SwarmEngine.hash(2166136261, 0, 0)).toBe(0);
    for (const weights of [[0.01, Number.MAX_VALUE], [Number.MAX_VALUE, 0.01]]) {
      const layer = crowd(weights), engine = new SwarmEngine(), guide = engine._buildGraphGuide(layer.graph);
      expect(pick(engine, guide, 2166136261, 0).id).toBe('in0');
      expect(pick(engine, guide, 7, 0).id).toBe(weights[0] === 0.01 ? 'in1' : 'in0');
    }
  });

  test('shares keep authored order, count stranded Entries and round to100', () => {
    const layer = crowd([1, 2, 3, 4]);
    layer.graph.removeEdge('edge2');
    const shares = routing.getGraphEntryShares(layer.graph);
    expect(shares.map(row => [row.node.id, row.share, row.percent])).toEqual([
      ['in0', 0.1, 10], ['in1', 0.2, 20], ['in2', 0.3, 30], ['in3', 0.4, 40],
    ]);
    const thirds = routing.getGraphEntryShares(crowd([2, 2, 2]).graph);
    expect(thirds.map(row => row.percent)).toEqual([34, 33, 33]);
    expect(routing.getGraphEntryShares(crowd([Number.MAX_VALUE, Number.MAX_VALUE]).graph)
      .map(row => row.percent)).toEqual([50, 50]);
  });

  test('implicit starts ignore retained weights, and Follow route ignores all network weights', () => {
    const layer = crowd([0.01, Number.MAX_VALUE]);
    layer.graph.getNodesByType('entry').forEach(node => { node.type = 'normal'; });
    const engine = new SwarmEngine(), old = new LegacyEntryEngine();
    for (const mode of ['collect', 'disappear', 'respawn', 'loop']) {
      layer.emitters[0].lifecycleMode = mode;
      for (const t of [0, 100, 5000, 15000]) {
        expect(engine.evaluate(t, layer, context)).toEqual(old.evaluate(t, layer, context));
      }
    }
    layer.guideType = 'route';
    const route = { ...context, routePathPoints: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.8 }] };
    expect(engine.evaluate(5000, layer, route)).toEqual(old.evaluate(5000, layer, route));
  });
});

describe('weighted choices feed all walks and cache owners', () => {
  test('a maximum-size Entry pool prepares weights once and bounds per-dot lookup work', () => {
    const layer = crowd(new Array(1000).fill(1).map((_, i) => i + 1)); //2000 total nodes: the layer limit
    const reads = vi.fn();
    for (const [i, node] of layer.graph.getNodesByType('entry').entries()) {
      Object.defineProperty(node, 'entryWeight', { get() { reads(); return i + 1; } });
    }
    const engine = new SwarmEngine(), guide = engine._buildGraphGuide(layer.graph);
    expect(reads).toHaveBeenCalledTimes(1000);
    let comparisons = 0;
    const bounds = new Proxy(guide.entryCumulative, { get(target, key) {
      if (/^\d+$/.test(String(key))) comparisons++;
      return target[key];
    } });
    for (let i = 0; i < 20000; i++) {
      engine._pickEntry(guide.entries, 7, i, 0, bounds);
    }
    expect(reads).toHaveBeenCalledTimes(1000);
    expect(comparisons).toBeLessThanOrEqual(20000 * 11);
  });

  test('changing the selected stranded Entry updates cached Disappear admission', () => {
    const layer = crowd([1, 1], { seed: 3612955045, dotCount: 1, lifecycleMode: 'disappear' });
    layer.graph.removeEdge('edge0');
    const engine = new SwarmEngine();
    expect(engine.canRelease(layer, context)).toBe(true);
    layer.graph.getNode('in0').entryWeight = Number.MAX_VALUE;
    expect(engine.canRelease(layer, context)).toBe(false);
    expect(engine.evaluate(0, layer, context)).toEqual([]);
    layer.graph.getNode('in0').entryWeight = 0.01;
    expect(engine.canRelease(layer, context)).toBe(true);
  });

  test.each(['collect', 'disappear', 'respawn', 'loop'])('%s keeps weighted starts and downstream hops', mode => {
    const weights = [1, 9], layer = crowd(weights, { lifecycleMode: mode });
    const engine = new SwarmEngine();
    const initial = engine.evaluate(0, layer, context);
    initial.forEach(dot => expect(dot.y).toBe((chosen(weights, SwarmEngine.hash(7, dot.dotIndex, 0)) + 1) / 3));
    // One edge per journey consumes hop1; the next respawn Entry must use hop2.
    if (mode === 'respawn') {
      const emitter = layer.emitters[0], guide = engine._buildGraphGuide(layer.graph);
      for (let i = 0; i < 32; i++) {
        const first = chosen(weights, SwarmEngine.hash(7, i, 0));
        const length = engine.edgeGeometry(layer.graph, layer.graph.getEdge(`edge${first}`)).length;
        const second = chosen(weights, SwarmEngine.hash(7, i, 2));
        expect(engine._walkGraph(length + 0.01, emitter, i, 1, guide).point.y).toBe((second + 1) / 3);
      }
    }
    if (mode === 'loop') {
      for (const dot of engine.evaluate(22000, layer, context)) {
        expect(dot.y).toBe((chosen(weights, SwarmEngine.hash(7, dot.dotIndex, 0)) + 1) / 3);
      }
    }
  });

  test.each([false, true])('warm weight/Type/replacement edits equal cold with finish areas=%s', finish => {
    let layer = crowd([1, 1], { releaseStart: 0.4, dotCount: 40 });
    layer.graph.getNode('in0').area = { ...area };
    if (finish) layer.graph.getNode('out0').area = { ...area };
    layer.addEmitter({ ...layer.emitters[0].toJSON(), id: 'other', seed: 19, speed: 0.15 });
    const ctx = { ...context, durationMs: 30000, finishPackingContext: createFinishPackingContext({
      renderReference: { width: 1000, height: 1000 } }), finishReleaseContext: { durationMs: 10000 } };
    const engine = new SwarmEngine();
    const check = () => {
      const cold = new SwarmEngine();
      expect(engine.scheduleDots(layer, ctx)).toEqual(cold.scheduleDots(layer, ctx));
      expect(engine.crowdFinishMs(layer, ctx)).toBe(cold.crowdFinishMs(layer, ctx));
      expect(engine.canRelease(layer, ctx)).toBe(cold.canRelease(layer, ctx));
      for (const time of [0, 4000, 8000, 30000, 4500]) {
        expect(engine.evaluate(time, layer, ctx)).toEqual(cold.evaluate(time, layer, ctx));
      }
      return engine.scheduleDots(layer, ctx);
    };
    const initial = check();
    layer.graph.getNode('in0').entryWeight = 19;
    expect(check()).not.toEqual(initial);
    layer.graph.getNode('in0').entryWeight = 1; expect(check()).toEqual(initial);
    layer.graph.getNode('in1').entryWeight = 0.01; check();
    layer.graph.getNode('in1').type = 'normal'; check();
    layer.graph.getNode('in1').type = 'entry'; check();
    const saved = layer.toJSON();
    layer.graph.fromJSON(saved.graph); check();
    layer = FlowLayer.fromJSON(saved); check();
  });
});
