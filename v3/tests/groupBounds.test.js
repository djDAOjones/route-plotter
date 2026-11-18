import { expect, test } from 'vitest';
import { Scene } from '../src/models/Scene.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';

// All odd counts attain sum ceil(count/2), rather than the tempting dots/2.
test('the validated 10128-group worst case retains packed full routes plus shared geometry, not member polylines', () => {
  const counts = [4937, 4937, 4937, 4937, ...Array(252).fill(1)];
  const data = { flowLayers: Array.from({ length: 4 }, (_, layer) => ({ id: `crowd${layer}`, guideType: 'graph',
    graph: { nodes: [{ id: `node${layer}`, type: 'entry', x: 0.5, y: 0.5 }],
      edges: [{ id: `loop${layer}`, sourceId: `node${layer}`, targetId: `node${layer}`,
        controlPoints: [{ x: 0.6, y: 0.6 }] }] },
    emitters: counts.slice(layer * 64, (layer + 1) * 64).map((dotCount, i) => ({ id: `e${layer}-${i}`,
      seed: i, dotCount, groups: true, groupSize: 2, groupWidth: 0, lifecycleMode: 'collect' })),
  })) };
  expect(counts.reduce((sum, count) => sum + count, 0)).toBe(20000);
  expect(() => Scene.assertValidJSON(data)).not.toThrow();
  const scene = Scene.fromJSON(data), engine = new SwarmEngine();
  const groups = new Set(); let traversal = 0, checkpoints = 0, temporary = 0, treeBytes = 0, sharedArcs = 0, memberRows = 0;
  for (const layer of scene.getFlowLayers()) {
    const rows = engine.scheduleDots(layer, { durationMs: 10000 });
    expect(rows.every(row => !row.ends && !row.finishes)).toBe(true);
    const geometry = engine._groupGeometryCache.get(layer);
    for (const [emitter, members] of geometry.byEmitter) {
      expect(members).toHaveLength(emitter.dotCount); memberRows += members.length;
      for (const row of members) {
      expect(row.journey).toBe(row.group.journey);
      if (groups.has(row.group)) continue;
      groups.add(row.group); traversal += row.journey.codes.byteLength;
      checkpoints += row.journey.checkpoints.byteLength;
      expect(row.journey.hops).toBe(2048);
      expect(row.journey).not.toHaveProperty('points');
    }
    }
    const routing = geometry.routing;
    temporary += routing.traceScratch.byteLength + routing.checkpointScratch.byteLength;
    treeBytes += [...routing.byNode.values()].reduce((sum, pool) => sum + pool.tree.byteLength + pool.scratch.byteLength, 0);
    sharedArcs += routing.arcs.filter(Boolean).length;
    expect(routing.arcs.filter(Boolean)).toHaveLength(1);
    expect(engine._journeyCache.get(layer)).toBeUndefined();
  }
  expect(groups.size).toBe(10128); expect(memberRows).toBe(20000);
  expect(traversal).toBe(41484288); expect(checkpoints).toBe(5266560);
  expect(traversal + checkpoints).toBe(46750848);
  expect(temporary).toBe(4 * (2048 * 4 + 65 * 8));
  expect(treeBytes).toBe(4 * (2 * 8 + 8)); expect(sharedArcs).toBe(4);
}, 120000);
