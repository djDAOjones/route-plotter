/**
 * Segment hit-testing geometry (Phase 4 canvas affordances).
 *
 * Pure functions: polyline nearest-point projection, waypoint→point-index
 * mapping, leg ownership (waypoint i owns the leg i → i+1, matching the
 * inspector's Leg card), and leg midpoint for the "+" insert handle.
 */

import { describe, it, expect } from 'vitest';
import {
  waypointPointIndices,
  nearestOnPolyline,
  legIndexForPointIndex,
  legMidpointIndex
} from '../src/utils/segmentHitTest.js';

describe('waypointPointIndices', () => {
  it('maps progress values onto polyline indices', () => {
    expect(waypointPointIndices([0, 0.5, 1], 101)).toEqual([0, 50, 100]);
  });

  it('rounds to the nearest index', () => {
    expect(waypointPointIndices([0, 1 / 3, 1], 10)).toEqual([0, 3, 9]);
  });
});

describe('nearestOnPolyline', () => {
  const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];

  it('projects perpendicular onto a segment interior', () => {
    const hit = nearestOnPolyline(line, 5, 3);
    expect(hit.dist).toBeCloseTo(3);
    expect(hit.index).toBeCloseTo(0.5);
    expect(hit.px).toBeCloseTo(5);
    expect(hit.py).toBeCloseTo(0);
  });

  it('finds the second segment when the point projects there', () => {
    const hit = nearestOnPolyline(line, 15, -4);
    expect(hit.dist).toBeCloseTo(4);
    expect(hit.index).toBeCloseTo(1.5);
  });

  it('clamps to the polyline end for points beyond it', () => {
    const hit = nearestOnPolyline(line, 25, 0);
    expect(hit.dist).toBeCloseTo(5);
    expect(hit.index).toBeCloseTo(2);
    expect(hit.px).toBeCloseTo(20);
  });

  it('clamps to the polyline start for points before it', () => {
    const hit = nearestOnPolyline(line, -3, 4);
    expect(hit.dist).toBeCloseTo(5);
    expect(hit.index).toBeCloseTo(0);
  });

  it('survives zero-length segments (duplicate points)', () => {
    const degenerate = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }];
    const hit = nearestOnPolyline(degenerate, 5, 2);
    expect(hit.dist).toBeCloseTo(2);
    expect(Number.isNaN(hit.index)).toBe(false);
  });

  it('returns null for fewer than two points', () => {
    expect(nearestOnPolyline([], 0, 0)).toBeNull();
    expect(nearestOnPolyline([{ x: 1, y: 1 }], 0, 0)).toBeNull();
  });
});

describe('legIndexForPointIndex', () => {
  it('assigns the span between waypoints to the earlier waypoint', () => {
    const wpIndices = [0, 50, 100];
    expect(legIndexForPointIndex(25, wpIndices)).toBe(0);
    expect(legIndexForPointIndex(50, wpIndices)).toBe(1);
    expect(legIndexForPointIndex(75, wpIndices)).toBe(1);
  });

  it('never assigns the final waypoint (no outgoing leg)', () => {
    const wpIndices = [0, 50, 100];
    expect(legIndexForPointIndex(100, wpIndices)).toBe(1);
    expect(legIndexForPointIndex(999, wpIndices)).toBe(1);
  });

  it('handles minors as ordinary span owners', () => {
    // 4 waypoints (e.g. major, minor, minor, major) → 3 legs
    const wpIndices = [0, 30, 60, 100];
    expect(legIndexForPointIndex(10, wpIndices)).toBe(0);
    expect(legIndexForPointIndex(45, wpIndices)).toBe(1);
    expect(legIndexForPointIndex(95, wpIndices)).toBe(2);
  });

  it('two-waypoint route: everything is leg 0', () => {
    const wpIndices = [0, 100];
    expect(legIndexForPointIndex(0, wpIndices)).toBe(0);
    expect(legIndexForPointIndex(100, wpIndices)).toBe(0);
  });
});

describe('legMidpointIndex', () => {
  it('returns the index midpoint of the leg span', () => {
    const wpIndices = [0, 50, 100];
    expect(legMidpointIndex(wpIndices, 0)).toBe(25);
    expect(legMidpointIndex(wpIndices, 1)).toBe(75);
  });

  it('rounds odd spans to an integer index', () => {
    expect(legMidpointIndex([0, 31], 0)).toBe(16);
  });
});
