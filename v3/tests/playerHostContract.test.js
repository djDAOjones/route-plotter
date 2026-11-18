import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { pathTimingMixin } from '../src/app/pathTiming.js';
import { Waypoint } from '../src/models/Waypoint.js';

/**
 * TST-07 — the contract the exported player must satisfy.
 *
 * `PlayerApp` adopts the app's `pathTiming` mixin wholesale, so every member
 * that mixin reaches for through `this` is an interface between them that
 * nobody declared. It has broken silently twice. Here the contract is derived
 * from the mixin's own source and checked against a player that really loaded
 * a project, so a new `this.something` in `pathTiming` fails this test rather
 * than a user's export.
 *
 * The bundle's closure is pinned separately, in playerBundleClosure.test.js:
 * esbuild cannot run under jsdom.
 */

const repoRoot = resolve(import.meta.dirname, '..');

/**
 * Every `this.x` the mixin reads but does not bring itself: its own methods,
 * and the caches it assigns before use, are not the host's to provide.
 */
function hostContract() {
  const source = readFileSync(resolve(repoRoot, 'src/app/pathTiming.js'), 'utf8');
  const used = new Set([...source.matchAll(/this\.([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(match => match[1]));
  const assigned = new Set([...source.matchAll(/this\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=[^=]/g)].map(match => match[1]));
  for (const provided of [...Object.keys(pathTimingMixin), ...assigned]) used.delete(provided);
  return [...used].sort();
}

/**
 * A player loaded from a two-waypoint export.
 * @param {(waypoints: Waypoint[]) => Object|undefined} [sceneFor] - The
 *   export's `scene` block, built from its waypoints; none by default.
 */
async function loadedPlayer(sceneFor = () => undefined) {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 800;
  const player = new PlayerApp(canvas);
  const waypoints = [Waypoint.createMajor(0.2, 0.3), Waypoint.createMajor(0.8, 0.7)];
  await player.load({
    coordVersion: 9,
    waypoints: waypoints.map(waypoint => waypoint.toJSON()),
    scene: sceneFor(waypoints),
    // A real export carries these; without styles the load warns about the
    // path head, which is not what this test is about.
    styles: { pathHead: { type: 'arrow' } },
    motionSettings: {},
    exportSettings: {},
    timingReference: { width: 1000, height: 800 }
  }, null);
  return player;
}

describe('the exported player keeps its host contract (TST-07)', () => {
  test('the contract is derived from the mixin, not from a list that can rot', () => {
    const contract = hostContract();

    expect(contract).toContain('animationEngine');
    expect(contract).toContain('pathCalculator');
    expect(contract).toContain('waypoints');
    expect(contract.length).toBeGreaterThan(8);
  });

  test('a loaded player provides every member pathTiming reaches for', async () => {
    const player = await loadedPlayer();
    const missing = hostContract().filter(member => player[member] === undefined);

    // Until DEF-02 this was `['waypointsById']`, and every anchored crowd node
    // in an exported player drew at its authored position.
    expect(missing).toEqual([]);
  });

  test('DEF-02: the player builds waypointsById, so an anchored crowd node lands on its waypoint', async () => {
    // Nodes of every type, each authored away from the waypoint it is
    // anchored to: what moving a waypoint after "Trace route into crowd"
    // leaves behind. `calculatePath` resolves every anchor through
    // `this.waypointsById` (`resolveGraphAnchors`), so a player without the
    // lookup reported each anchor broken and fell back to the authored spot.
    const player = await loadedPlayer(waypoints => ({
      flowLayers: [{
        id: 'crowd',
        name: 'Crowd',
        graph: {
          nodes: [
            { id: 'entry', x: 0.5, y: 0.5, type: 'entry', anchorWaypointId: waypoints[1].id },
            { id: 'through', x: 0.5, y: 0.2, type: 'normal', anchorWaypointId: waypoints[0].id },
            { id: 'exit', x: 0.9, y: 0.1, type: 'exit', anchorWaypointId: waypoints[1].id },
            { id: 'free', x: 0.1, y: 0.9, type: 'normal' },
          ],
          edges: [
            { id: 'in', sourceId: 'entry', targetId: 'through' },
            { id: 'on', sourceId: 'through', targetId: 'exit' },
            { id: 'off', sourceId: 'through', targetId: 'free' },
          ],
        },
        emitters: [],
      }],
    }));

    expect(player.anchorReport).toEqual({ bound: 3, broken: [] });
    const nodes = player.scene.getFlowLayers()[0].graph.getNodes();
    expect(Object.fromEntries(nodes.map(node => [node.id, node.position()]))).toEqual({
      entry: { x: 0.8, y: 0.7 },
      through: { x: 0.2, y: 0.3 },
      exit: { x: 0.8, y: 0.7 },
      free: { x: 0.1, y: 0.9 },
    });
    // Binding never rewrites the authored position (COMPOSE-01).
    expect(nodes.map(node => [node.x, node.y])).toEqual([[0.5, 0.5], [0.5, 0.2], [0.9, 0.1], [0.1, 0.9]]);

    // The lookup holds the very waypoints the player draws, not copies.
    expect(player.waypointsById.size).toBe(player.waypoints.length);
    for (const waypoint of player.waypoints) {
      expect(player.waypointsById.get(waypoint.id)).toBe(waypoint);
    }
  });

});
