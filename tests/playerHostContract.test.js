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

async function loadedPlayer() {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 800;
  const player = new PlayerApp(canvas);
  const waypoints = [Waypoint.createMajor(0.2, 0.3), Waypoint.createMajor(0.8, 0.7)];
  await player.load({
    coordVersion: 9,
    waypoints: waypoints.map(waypoint => waypoint.toJSON()),
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

    // `waypointsById` is DEF-02: the player never builds it, so every anchored
    // crowd node draws at its authored position. W2 fixes it; until then it is
    // the one known gap, and this test states it rather than hiding it.
    expect(missing).toEqual(['waypointsById']);
  });

  test.todo('DEF-02: the player builds waypointsById, so anchored crowd nodes land on their waypoint');

});
