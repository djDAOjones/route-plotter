import { describe, expect, test, vi } from 'vitest';
import { Waypoint } from '../src/models/Waypoint.js';
import { editorPanelMixin } from '../src/app/editorPanel.js';
import {
  WAYPOINT_CARD,
  applyWaypointCardOnward,
  getWaypointCardActionState,
  resetWaypointCard,
} from '../src/utils/waypointCardActions.js';

const routeStyles = {
  pathColor: '#0072B2',
  pathThickness: 6,
  pathStyle: 'dashed',
  pathShape: 'squiggle',
  markerStyle: 'square',
  dotColor: '#009E73',
  dotSize: 12,
  beaconStyle: 'glow',
  labelMode: 'on',
};

describe('waypoint card actions', () => {
  test('Marker reset uses route style on selected majors and leaves minors untouched', () => {
    const major = Waypoint.createMajor(0.1, 0.1);
    const minor = Waypoint.createMinor(0.2, 0.2);
    for (const waypoint of [major, minor]) {
      waypoint.markerStyle = 'custom';
      waypoint.dotColor = '#000000';
      waypoint.dotSize = 5;
      waypoint.customImage = { decoded: true };
      waypoint.customImageAssetId = 'marker-a';
    }

    const result = resetWaypointCard(WAYPOINT_CARD.MARKER, [major, minor], routeStyles);

    expect(result.changedWaypoints).toEqual([major]);
    expect(major).toMatchObject({
      markerStyle: 'square',
      dotColor: '#009E73',
      dotSize: 12,
      customImage: null,
      customImageAssetId: null,
      customImageRotation: 'fixed',
      customImageRotationOffset: 0,
    });
    expect(minor.markerStyle).toBe('custom');
    expect(result.effects).toEqual({ list: true });
  });

  test('Label reset preserves authored text, names and auto-name state', () => {
    const waypoint = Waypoint.createMajor(0.1, 0.1);
    waypoint.label = 'Library';
    waypoint.name = 'Stop A';
    waypoint._autoNamed = true;
    waypoint.labelColor = '#ff00ff';
    waypoint.labelOffsetY = 18;

    resetWaypointCard(WAYPOINT_CARD.LABEL, [waypoint], routeStyles);

    expect(waypoint.label).toBe('Library');
    expect(waypoint.name).toBe('Stop A');
    expect(waypoint._autoNamed).toBe(true);
    expect(waypoint).toMatchObject({
      labelMode: 'on',
      labelColor: '#1a1a1a',
      labelBgColor: '#FFFFFF',
      labelBgOpacity: 0.85,
      labelOffsetX: 0,
      labelOffsetY: 0,
      labelWidth: 15,
      labelSize: 16,
    });
  });

  test('Leg reset applies appearance to minors but speed only to majors', () => {
    const major = Waypoint.createMajor(0.1, 0.1);
    const minor = Waypoint.createMinor(0.2, 0.2);
    for (const waypoint of [major, minor]) {
      waypoint.segmentColor = '#000000';
      waypoint.segmentWidth = 2;
      waypoint.segmentStyle = 'dotted';
      waypoint.pathShape = 'randomised';
      waypoint.shapeAmplitude = 30;
      waypoint.shapeFrequency = 12;
      waypoint.segmentSpeed = 3;
    }

    resetWaypointCard(WAYPOINT_CARD.LEG, [major, minor], routeStyles);

    for (const waypoint of [major, minor]) {
      expect(waypoint).toMatchObject({
        segmentColor: '#0072B2',
        segmentWidth: 6,
        segmentStyle: 'dashed',
        pathShape: 'squiggle',
        shapeAmplitude: 10,
        shapeFrequency: 5,
      });
    }
    expect(major.segmentSpeed).toBe(1);
    expect(minor.segmentSpeed).toBe(3);
  });

  test('Marker Apply onward skips minors and reuses the admitted custom image reference', () => {
    const source = Waypoint.createMajor(0.1, 0.1);
    const minor = Waypoint.createMinor(0.2, 0.2);
    const target = Waypoint.createMajor(0.3, 0.3);
    const decoded = { decoded: true };
    source.markerStyle = 'custom';
    source.customImage = decoded;
    source.customImageAssetId = 'marker-a';
    target.markerStyle = 'dot';

    const result = applyWaypointCardOnward(
      WAYPOINT_CARD.MARKER,
      [source, minor, target],
      source
    );

    expect(result.changedWaypoints).toEqual([target]);
    expect(target.markerStyle).toBe('custom');
    expect(target.customImage).toBe(decoded);
    expect(target.customImageAssetId).toBe('marker-a');
    expect(minor.markerStyle).toBe('dot');
  });

  test('ordinary Marker actions preserve dormant custom assets and ignore their hidden differences', () => {
    const source = Waypoint.createMajor(0.1, 0.1);
    const target = Waypoint.createMajor(0.2, 0.2);
    source.markerStyle = 'dot';
    target.markerStyle = 'dot';
    source.customImageAssetId = 'dormant-a';
    target.customImageAssetId = 'dormant-b';
    target.customImageRotation = 'auto';

    const state = getWaypointCardActionState({
      card: WAYPOINT_CARD.MARKER,
      waypoints: [source, target],
      selection: [source],
      source,
      styles: {
        markerStyle: 'dot',
        dotColor: source.dotColor,
        dotSize: source.dotSize,
      },
    });
    expect(state.canReset).toBe(false);
    expect(state.canApplyOnward).toBe(false);

    applyWaypointCardOnward(WAYPOINT_CARD.MARKER, [source, target], source);
    expect(target.customImageAssetId).toBe('dormant-b');
    expect(target.customImageRotation).toBe('auto');
  });

  test('colour case differences do not create a visually empty action', () => {
    const source = Waypoint.createMajor(0.1, 0.1);
    const target = Waypoint.createMajor(0.2, 0.2);
    source.dotColor = '#D55E00';
    target.dotColor = '#d55e00';

    const state = getWaypointCardActionState({
      card: WAYPOINT_CARD.MARKER,
      waypoints: [source, target],
      selection: [source],
      source,
      styles: {
        markerStyle: 'dot',
        dotColor: source.dotColor,
        dotSize: source.dotSize,
      },
    });

    expect(state.canApplyOnward).toBe(false);
    expect(state.applyReason).toBe('Later waypoints already match');
  });

  test('Leg Apply onward from a minor copies appearance without inventing a speed source', () => {
    const previousMajor = Waypoint.createMajor(0.1, 0.1);
    const sourceMinor = Waypoint.createMinor(0.2, 0.2);
    const targetMinor = Waypoint.createMinor(0.3, 0.3);
    const targetMajor = Waypoint.createMajor(0.4, 0.4);
    sourceMinor.segmentColor = '#CC79A7';
    sourceMinor.segmentSpeed = 4;
    targetMajor.segmentSpeed = 2;

    const result = applyWaypointCardOnward(
      WAYPOINT_CARD.LEG,
      [previousMajor, sourceMinor, targetMinor, targetMajor],
      sourceMinor
    );

    expect(result.changedWaypoints).toEqual([targetMinor, targetMajor]);
    expect(targetMinor.segmentColor).toBe('#CC79A7');
    expect(targetMajor.segmentColor).toBe('#CC79A7');
    expect(targetMajor.segmentSpeed).toBe(2);
  });

  test('On arrival copies camera by value and reports timing/beacon effects', () => {
    const source = Waypoint.createMajor(0.1, 0.1);
    const target = Waypoint.createMajor(0.2, 0.2);
    source.beaconStyle = 'ripple';
    source.pauseTime = 5000;
    source.camera = { zoom: 4, zoomMode: 'immediate' };

    const result = applyWaypointCardOnward(
      WAYPOINT_CARD.ON_ARRIVAL,
      [source, target],
      source
    );

    expect(target).toMatchObject({ beaconStyle: 'ripple', pauseTime: 5000 });
    expect(target.camera).toEqual({ zoom: 4, zoomMode: 'immediate' });
    expect(target.camera).not.toBe(source.camera);
    expect(result.effects).toEqual({ timing: true, beacons: true });
  });

  test('action state disables ambiguous, unavailable and no-op actions with reasons', () => {
    const first = Waypoint.createMajor(0.1, 0.1);
    const second = Waypoint.createMajor(0.2, 0.2);
    const multi = getWaypointCardActionState({
      card: WAYPOINT_CARD.MARKER,
      waypoints: [first, second],
      selection: [first, second],
      source: null,
      styles: routeStyles,
    });
    expect(multi.canApplyOnward).toBe(false);
    expect(multi.applyReason).toMatch(/Select one/);

    applyWaypointCardOnward(WAYPOINT_CARD.MARKER, [first, second], first);
    const matched = getWaypointCardActionState({
      card: WAYPOINT_CARD.MARKER,
      waypoints: [first, second],
      selection: [first],
      source: first,
      styles: routeStyles,
    });
    expect(matched.canApplyOnward).toBe(false);
    expect(matched.applyReason).toBe('Later waypoints already match');

    resetWaypointCard(WAYPOINT_CARD.MARKER, [first], routeStyles);
    const reset = getWaypointCardActionState({
      card: WAYPOINT_CARD.MARKER,
      waypoints: [first],
      selection: [first],
      source: first,
      styles: routeStyles,
    });
    expect(reset.canReset).toBe(false);
    expect(reset.resetReason).toBe('Already uses route style');
  });
});

describe('waypoint card action integration', () => {
  function makeApp(waypoints, selectedWaypoint, selectedWaypoints = [selectedWaypoint]) {
    return {
      ...editorPanelMixin,
      waypoints,
      selectedWaypoint,
      selectedWaypoints,
      styles: routeStyles,
      _flushPendingUndo: vi.fn(),
      renderingService: { beaconRenderer: { resetBeacon: vi.fn() } },
      calculatePath: vi.fn(),
      updateAnimationDuration: vi.fn(),
      validateZoomTransitions: vi.fn(),
      uiController: { updateWaypointList: vi.fn() },
      updateWaypointEditor: vi.fn(),
      queueRender: vi.fn(),
      saveUndoState: vi.fn(),
      autoSave: vi.fn(),
      announce: vi.fn(),
    };
  }

  test('Apply onward commits once and preserves later label content', () => {
    const source = Waypoint.createMajor(0.1, 0.1);
    const target = Waypoint.createMajor(0.2, 0.2);
    source.labelColor = '#CC79A7';
    source.labelSize = 32;
    source.label = 'Source';
    target.label = 'Destination';
    target.name = 'Stop B';
    const app = makeApp([source, target], source);

    app._handleWaypointCardAction(WAYPOINT_CARD.LABEL, 'apply-onward');

    expect(target.labelColor).toBe('#CC79A7');
    expect(target.labelSize).toBe(32);
    expect(target.label).toBe('Destination');
    expect(target.name).toBe('Stop B');
    expect(app._flushPendingUndo).toHaveBeenCalledOnce();
    expect(app.saveUndoState).toHaveBeenCalledOnce();
    expect(app.autoSave).toHaveBeenCalledOnce();
    expect(app.queueRender).toHaveBeenCalledOnce();
    expect(app.uiController.updateWaypointList).toHaveBeenCalledOnce();
    expect(app.calculatePath).not.toHaveBeenCalled();
    expect(app.updateAnimationDuration).not.toHaveBeenCalled();
    expect(app.announce).toHaveBeenCalledWith(
      'Label style applied to 1 later waypoint. Undo is available.'
    );
  });

  test('Leg Reset is one path/timing transaction across a mixed selection', () => {
    const major = Waypoint.createMajor(0.1, 0.1);
    const minor = Waypoint.createMinor(0.2, 0.2);
    major.pathShape = 'randomised';
    minor.pathShape = 'randomised';
    const app = makeApp([major, minor], minor, [major, minor]);

    app._handleWaypointCardAction(WAYPOINT_CARD.LEG, 'reset');

    expect(major.pathShape).toBe('squiggle');
    expect(minor.pathShape).toBe('squiggle');
    expect(app.calculatePath).toHaveBeenCalledOnce();
    expect(app.updateAnimationDuration).not.toHaveBeenCalled();
    expect(app.saveUndoState).toHaveBeenCalledOnce();
    expect(app.autoSave).toHaveBeenCalledOnce();
  });

  test('an unavailable or no-op action creates no transaction', () => {
    const waypoint = Waypoint.createMajor(0.1, 0.1);
    resetWaypointCard(WAYPOINT_CARD.MARKER, [waypoint], routeStyles);
    const app = makeApp([waypoint], waypoint);

    app._handleWaypointCardAction(WAYPOINT_CARD.MARKER, 'reset');
    app._handleWaypointCardAction(WAYPOINT_CARD.MARKER, 'apply-onward');

    expect(app._flushPendingUndo).not.toHaveBeenCalled();
    expect(app.saveUndoState).not.toHaveBeenCalled();
    expect(app.autoSave).not.toHaveBeenCalled();
  });

  test('button state names disabled reasons and rejects multi-source Apply onward', () => {
    document.body.innerHTML = `
      <div id="waypoint-scope">
        ${Object.values(WAYPOINT_CARD).map(card => `
          <button data-card="${card}" data-card-action="reset"></button>
          <button data-card="${card}" data-card-action="apply-onward"></button>
        `).join('')}
      </div>`;
    const first = Waypoint.createMajor(0.1, 0.1);
    const second = Waypoint.createMajor(0.2, 0.2);
    const app = makeApp([first, second], first, [first, second]);

    app._syncWaypointCardActions();

    const apply = document.querySelector('[data-card="marker"][data-card-action="apply-onward"]');
    expect(apply.disabled).toBe(true);
    expect(apply.title).toBe('Select one waypoint to apply onward');
    expect(apply.getAttribute('aria-label')).toContain('Select one waypoint');
  });
});
