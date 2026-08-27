/**
 * UI-02: one hierarchical numbering shared by the sidebar list and the
 * semantic scene outline.
 *
 * The regression this locks down is a naming collision, not a layout choice:
 * before UI-02 the outline numbered minors by route position, so its
 * "Minor waypoint 7" and the list's "Waypoint 7" named different waypoints.
 */

import { describe, test, expect } from 'vitest';
import { buildRouteNumbering, waypointDisplayName } from '../src/utils/waypointNaming.js';
import { buildSceneOutlineSnapshot } from '../src/utils/sceneSemantics.js';
import { Waypoint } from '../src/models/Waypoint.js';

const major = () => Waypoint.createMajor(0.5, 0.5);
const minor = () => Waypoint.createMinor(0.5, 0.5);

describe('buildRouteNumbering', () => {
  test('numbers majors 1..N and minors by the leg they shape', () => {
    const route = [major(), minor(), minor(), major(), minor(), major()];

    expect(buildRouteNumbering(route).map(entry => entry.displayNumber))
      .toEqual(['1', '1.1', '1.2', '2', '2.1', '3']);
  });

  test('minor counters restart at each major', () => {
    const route = [major(), minor(), major(), minor()];
    const numbering = buildRouteNumbering(route);

    expect(numbering[1].minorNumber).toBe(1);
    expect(numbering[3].minorNumber).toBe(1);
    expect(numbering[1].legNumber).toBe(1);
    expect(numbering[3].legNumber).toBe(2);
  });

  test('minors left in front of every major by a delete read as leg 0', () => {
    // Deleting waypoint 1 strands its trailing minors at the head of the
    // route. They must not borrow the number of the major that now follows.
    const route = [minor(), minor(), major()];
    const numbering = buildRouteNumbering(route);

    expect(numbering.map(entry => entry.displayNumber)).toEqual(['0.1', '0.2', '1']);
    expect(numbering[0].legNumber).toBe(0);
    expect(numbering[2].majorNumber).toBe(1);
  });

  test('majors carry no minor number and minors carry no major number', () => {
    const [majorEntry, minorEntry] = buildRouteNumbering([major(), minor()]);

    expect(majorEntry).toMatchObject({ isMajor: true, majorNumber: 1, minorNumber: null });
    expect(minorEntry).toMatchObject({ isMajor: false, majorNumber: null, minorNumber: 1 });
  });

  test('an empty route numbers to an empty list', () => {
    expect(buildRouteNumbering([])).toEqual([]);
    expect(buildRouteNumbering()).toEqual([]);
  });

  test('waypointDisplayName is the list row default title', () => {
    const [majorEntry, minorEntry] = buildRouteNumbering([major(), minor()]);

    expect(waypointDisplayName(majorEntry)).toBe('Waypoint 1');
    expect(waypointDisplayName(minorEntry)).toBe('Waypoint 1.1');
  });
});

describe('the scene outline uses the same numbering', () => {
  test('outline names and list default titles agree on every waypoint', () => {
    const route = [major(), minor(), minor(), major(), minor()];
    const snapshot = buildSceneOutlineSnapshot({ waypoints: route, scene: null });
    const numbering = buildRouteNumbering(route);

    expect(snapshot.route.map(item => item.name)).toEqual([
      'Major waypoint 1',
      'Minor waypoint 1.1',
      'Minor waypoint 1.2',
      'Major waypoint 2',
      'Minor waypoint 2.1',
    ]);

    // Every outline node's number is the list row's number for that waypoint.
    snapshot.route.forEach((item, index) => {
      expect(item.displayNumber).toBe(numbering[index].displayNumber);
      expect(waypointDisplayName(numbering[index]))
        .toBe(`Waypoint ${item.displayNumber}`);
    });
  });

  test('an authored name still appends to the numbered base', () => {
    const named = minor();
    named.name = 'Curve point';
    const snapshot = buildSceneOutlineSnapshot({ waypoints: [major(), named], scene: null });

    expect(snapshot.route[1].name).toBe('Minor waypoint 1.1 — Curve point');
  });

  test('the snapshot exposes leg and minor numbers for downstream views', () => {
    const snapshot = buildSceneOutlineSnapshot({
      waypoints: [major(), minor(), major()],
      scene: null,
    });

    expect(snapshot.route[0]).toMatchObject({ majorNumber: 1, minorNumber: null, legNumber: 1 });
    expect(snapshot.route[1]).toMatchObject({ majorNumber: null, minorNumber: 1, legNumber: 1 });
    expect(snapshot.route[2]).toMatchObject({ majorNumber: 2, minorNumber: null, legNumber: 2 });
  });
});
