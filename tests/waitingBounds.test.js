import { expect, test, vi } from 'vitest';
import { Scene } from '../src/models/Scene.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';

test('validated 20k waiting dots retain bounded packed routes and one shared arc, with no legacy route set', () => {
  const data = { flowLayers: [{ id: 'max', guideType: 'graph', graph: {
    nodes: [{ id: 'a', type: 'entry', x: 0.5, y: 0.5,
      area: { shape: 'ellipse', width: 0.2, height: 0.2, turn: 0 } }],
    edges: [{ id: 'loop', sourceId: 'a', targetId: 'a', controlPoints: [{ x: 0.6, y: 0.6 }] }],
  }, emitters: Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, seed: i, dotCount: 5000,
    waitAtStart: true, lifecycleMode: 'collect', releaseStart: 0.1, releaseDuration: 0.8 })) }] };
  expect(() => Scene.assertValidJSON(data)).not.toThrow();
  const layer = Scene.fromJSON(data).getFlowLayers()[0], engine = new SwarmEngine(), ctx = { durationMs: 10000 };
  const rows = engine.scheduleDots(layer, ctx);
  expect(rows).toHaveLength(20000);
  expect(rows.every(row => row.ends === false && row.finishes === false)).toBe(true);
  expect(engine.crowdFinishMs(layer, ctx)).toBe(0);
  const geometry = engine._groupGeometryCache.get(layer);
  let codes = 0, checkpoints = 0, units = 0, members = 0;
  for (const [emitter, list] of geometry.byEmitter) {
    expect(list).toHaveLength(5000);
    expect(new Set(list.map(row => row.distanceRank)).size).toBe(5000);
    list.forEach((row, i) => {
      expect(row.waiting).toBe(true); expect(row.index).toBe(i);
      expect(row.group.k).toBe(i); expect(row.group.count).toBe(emitter.dotCount);
      expect(row.journey.hops).toBe(2048);
      expect(row.journey.codes).toBeInstanceOf(Uint16Array);
      expect(row.journey.checkpoints).toHaveLength(65);
      expect(row.journey).not.toHaveProperty('points');
      codes += row.journey.codes.byteLength; checkpoints += row.journey.checkpoints.byteLength;
      units++; members++;
    });
  }
  expect(units).toBe(20000); expect(members).toBe(20000);
  expect(codes).toBe(81920000); expect(checkpoints).toBe(10400000);
  expect(codes + checkpoints).toBe(92320000); // Typed payload, not a claim about total JS heap.
  expect(geometry.routing.arcs.filter(Boolean)).toHaveLength(1);
  expect(geometry.routing.traceScratch.byteLength + geometry.routing.checkpointScratch.byteLength).toBe(8712);
  expect(engine._journeyCache.get(layer)).toBeUndefined();
  const pick = vi.spyOn(engine, '_pickEntry');
  const allocation = engine._groupAllocationCache.get(layer);
  for (const t of [0, 9000, 1, 5000, 0]) expect(engine.evaluate(t, layer, ctx)).toHaveLength(20000);
  expect(pick).not.toHaveBeenCalled();
  expect(engine._groupGeometryCache.get(layer)).toBe(geometry);
  expect(engine._groupAllocationCache.get(layer)).toBe(allocation);
  // A release edit replaces only allocation; ranks/routes are independent of release controls.
  layer.emitters[0].update({ onsetVariance: 0.9 });
  engine.scheduleDots(layer, ctx);
  expect(engine._groupGeometryCache.get(layer)).toBe(geometry);
  expect(engine._groupAllocationCache.get(layer)).not.toBe(allocation);
  pick.mockRestore();
}, 120000);
