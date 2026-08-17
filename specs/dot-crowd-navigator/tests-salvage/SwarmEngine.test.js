import { describe, test, expect } from 'vitest';
import { GraphModel } from '../src/models/GraphModel.js';
import { SimulationState } from '../src/models/SimulationState.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';

/**
 * Build a minimal graph: entry → normal → exit
 * Returns the model for testing.
 */
function buildTestGraph() {
  const model = new GraphModel();
  const entry = model.addNode({ x: 0.1, y: 0.5, type: 'entry' });
  const mid = model.addNode({ x: 0.5, y: 0.5, type: 'normal' });
  const exit = model.addNode({ x: 0.9, y: 0.5, type: 'exit' });
  model.addEdge({ sourceId: entry.id, targetId: mid.id, weight: 1 });
  model.addEdge({ sourceId: mid.id, targetId: exit.id, weight: 1 });
  return model;
}

describe('SwarmEngine', () => {

  test('should start with no dots', () => {
    const model = buildTestGraph();
    const simState = new SimulationState({ dotCount: 10, releasePeriod: 1000 });
    const engine = new SwarmEngine(model, simState);
    expect(engine.dots).toHaveLength(0);
    expect(engine.getDotPositions()).toHaveLength(0);
  });

  test('should spawn dots when playing', () => {
    const model = buildTestGraph();
    const simState = new SimulationState({
      dotCount: 10,
      releasePeriod: 100,
      speed: 0.5,
    });
    const engine = new SwarmEngine(model, simState);

    // Not playing — no dots after tick
    engine.tick(50);
    expect(engine.dots).toHaveLength(0);

    // Start playing
    simState.isPlaying = true;
    engine.tick(50);
    expect(engine.dots.length).toBeGreaterThan(0);
  });

  test('should move dots forward along edges', () => {
    const model = buildTestGraph();
    const simState = new SimulationState({
      dotCount: 1,
      releasePeriod: 1, // instant release
      speed: 0.1,
      speedVariance: 0,
    });
    const engine = new SwarmEngine(model, simState);

    simState.isPlaying = true;
    engine.tick(10); // spawn
    expect(engine.dots.length).toBe(1);

    const initialProgress = engine.dots[0].progress;

    // Advance time — dot should move
    engine.tick(500);
    expect(engine.dots[0].progress).toBeGreaterThan(initialProgress);
  });

  test('getDotPositions should return normalised coordinates', () => {
    const model = buildTestGraph();
    const simState = new SimulationState({
      dotCount: 5,
      releasePeriod: 1,
      speed: 0.1,
    });
    const engine = new SwarmEngine(model, simState);

    simState.isPlaying = true;
    engine.tick(100);

    const positions = engine.getDotPositions();
    expect(positions.length).toBeGreaterThan(0);

    for (const pos of positions) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(1);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeLessThanOrEqual(1);
      expect(pos.size).toBeDefined();
      expect(pos.color).toBeDefined();
    }
  });

  test('reset should clear all dots', () => {
    const model = buildTestGraph();
    const simState = new SimulationState({
      dotCount: 10,
      releasePeriod: 1,
    });
    const engine = new SwarmEngine(model, simState);

    simState.isPlaying = true;
    engine.tick(100);
    expect(engine.dots.length).toBeGreaterThan(0);

    engine.reset();
    expect(engine.dots).toHaveLength(0);
    expect(engine.getDotPositions()).toHaveLength(0);
  });

  test('respawn mode should keep dots alive after reaching exit', () => {
    const model = buildTestGraph();
    const simState = new SimulationState({
      dotCount: 1,
      releasePeriod: 1,
      speed: 10, // very fast — will reach exit quickly
      speedVariance: 0,
      lifecycleMode: 'respawn',
    });
    const engine = new SwarmEngine(model, simState);

    simState.isPlaying = true;

    // Tick many times to ensure dot reaches exit and respawns
    for (let i = 0; i < 100; i++) {
      engine.tick(100);
    }

    // In respawn mode, the dot should still be alive
    expect(engine.dots.length).toBe(1);
    expect(engine.dots[0].alive).toBe(true);
  });

  test('disappear mode should remove dots at exit', () => {
    const model = buildTestGraph();
    const simState = new SimulationState({
      dotCount: 1,
      releasePeriod: 1,
      speed: 10,
      speedVariance: 0,
      lifecycleMode: 'disappear',
    });
    const engine = new SwarmEngine(model, simState);

    simState.isPlaying = true;

    // Tick enough for dot to reach exit
    for (let i = 0; i < 100; i++) {
      engine.tick(100);
    }

    // Dot should be gone
    expect(engine.dots.length).toBe(0);
  });
});
