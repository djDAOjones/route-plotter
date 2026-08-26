import { afterEach, describe, expect, test, vi } from 'vitest';
import { InteractionHandler } from '../src/handlers/InteractionHandler.js';
import { isMac } from '../src/config/keybindings.js';

/**
 * The pointer controller relies on synchronous request/response EventBus calls
 * for hit-testing and coordinate conversion. Keeping that property explicit in
 * this harness makes the input contract testable without constructing the full
 * RoutePlotter application.
 */
class SyncBus {
  constructor() {
    this.listeners = new Map();
    this.emitted = [];
  }

  on(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
    return () => {
      const current = this.listeners.get(name) || [];
      this.listeners.set(name, current.filter(candidate => candidate !== listener));
    };
  }

  emit(name, ...args) {
    this.emitted.push({ name, args });
    for (const listener of [...(this.listeners.get(name) || [])]) {
      listener(...args);
    }
  }

  events(name) {
    return this.emitted.filter(event => event.name === name);
  }

  clear() {
    this.emitted.length = 0;
  }
}

const activeHandlers = new Set();

afterEach(() => {
  for (const handler of activeHandlers) handler.destroy();
  activeHandlers.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function makePointerEvent(type, options = {}) {
  const defaultButtons = type === 'pointerdown' || type === 'pointermove' ? 1 : 0;
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 7,
    pointerType: 'mouse',
    isPrimary: true,
    button: type === 'pointerdown' ? 0 : -1,
    buttons: defaultButtons,
    clientX: 200,
    clientY: 160,
    ...options,
  });
}

function installPointerCapture(canvas) {
  const captured = new Set();
  canvas.setPointerCapture = vi.fn(pointerId => captured.add(pointerId));
  canvas.hasPointerCapture = vi.fn(pointerId => captured.has(pointerId));
  canvas.releasePointerCapture = vi.fn(pointerId => captured.delete(pointerId));
  return captured;
}

function makeWaypoint(id, imgX, imgY) {
  return { id, imgX, imgY, isMajor: true, name: id };
}

function makeHarness({ waypointHit = null, areaHit = null } = {}) {
  document.body.innerHTML = '<canvas id="pointer-test-canvas"></canvas>';
  const canvas = document.getElementById('pointer-test-canvas');
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 1000,
    bottom: 800,
    width: 1000,
    height: 800,
    x: 0,
    y: 0,
    toJSON() {},
  });
  const captured = installPointerCapture(canvas);
  const bus = new SyncBus();
  const handler = new InteractionHandler(canvas, bus);
  activeHandlers.add(handler);

  bus.on('area:check-handle', (_position, callback) => callback?.(
    typeof areaHit === 'function' ? areaHit() : areaHit
  ));
  bus.on('waypoint:check-at-position', (position, callback) => callback?.(
    typeof waypointHit === 'function' ? waypointHit(position) : waypointHit
  ));
  bus.on('coordinate:image-to-canvas', ({ imgX, imgY }, callback) => {
    callback?.({ x: imgX * 1000, y: imgY * 800 });
  });
  bus.on('coordinate:canvas-to-image', ({ canvasX, canvasY }, callback) => {
    callback?.({ x: canvasX / 1000, y: canvasY / 800 });
  });
  bus.on('coordinate:check-bounds', (_position, callback) => callback?.(true));
  bus.on('segment:check-at-position', (_position, callback) => callback?.(null));

  return { bus, canvas, captured, handler };
}

function send(handler, method, type, options = {}) {
  const event = makePointerEvent(type, options);
  handler[method](event);
  return event;
}

function pointerTap(handler, options = {}) {
  send(handler, 'handlePointerDown', 'pointerdown', options);
  send(handler, 'handlePointerUp', 'pointerup', { ...options, button: -1, buttons: 0 });
}

describe('one Pointer Events path', () => {
  test.each(['mouse', 'touch', 'pen'])(
    '%s tap creates one waypoint even if a compatibility click follows',
    pointerType => {
      const { bus, canvas, handler } = makeHarness();

      pointerTap(handler, { pointerType, clientX: 320, clientY: 240 });
      canvas.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 320,
        clientY: 240,
      }));

      expect(bus.events('waypoint:add')).toHaveLength(1);
      expect(bus.events('waypoint:add')[0].args[0]).toMatchObject({
        imgX: 0.32,
        imgY: 0.3,
        isMajor: true,
      });
      expect(canvas.setPointerCapture).toHaveBeenCalledOnce();
      expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
      expect(canvas.releasePointerCapture).toHaveBeenCalledOnce();
      expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
    }
  );

  test.each([
    ['mouse', 3, false],
    ['touch', 3, false],
    ['pen', 3, false],
    ['mouse', 3.01, true],
    ['touch', 3.01, true],
    ['pen', 3.01, true],
  ])('%s movement of %spx resolves as %s', (pointerType, distance, isDrag) => {
    const waypoint = makeWaypoint('anchor', 0.2, 0.2);
    const { bus, handler } = makeHarness({ waypointHit: waypoint });
    const shared = { pointerType, clientX: 200, clientY: 160 };

    send(handler, 'handlePointerDown', 'pointerdown', shared);
    send(handler, 'handlePointerMove', 'pointermove', {
      ...shared,
      clientX: 200 + distance,
      buttons: 1,
    });
    send(handler, 'handlePointerUp', 'pointerup', {
      ...shared,
      clientX: 200 + distance,
      button: -1,
      buttons: 0,
    });

    expect(bus.events('waypoint:position-changed')).toHaveLength(isDrag ? 1 : 0);
    expect(bus.events('waypoint:drag-ended')).toHaveLength(isDrag ? 1 : 0);
    // A plain tap selects it, and dragging an otherwise unselected waypoint
    // establishes it as the single selection before moving it.
    expect(bus.events('waypoint:selected')).toHaveLength(1);
    expect(bus.events('waypoint:add')).toHaveLength(0);
  });

  test('capture keeps an outside drag alive through one pointerup', () => {
    const waypoint = makeWaypoint('anchor', 0.2, 0.2);
    const { bus, captured, canvas, handler } = makeHarness({ waypointHit: waypoint });

    send(handler, 'handlePointerDown', 'pointerdown');
    expect(captured.has(7)).toBe(true);
    send(handler, 'handlePointerMove', 'pointermove', {
      clientX: 1200,
      clientY: 900,
      buttons: 1,
    });
    send(handler, 'handlePointerUp', 'pointerup', {
      clientX: 1200,
      clientY: 900,
      button: -1,
      buttons: 0,
    });

    expect(bus.events('waypoint:position-changed')).toHaveLength(1);
    expect(bus.events('waypoint:drag-ended')).toHaveLength(1);
    expect(canvas.releasePointerCapture).toHaveBeenCalledOnce();
    expect(captured.has(7)).toBe(false);

    send(handler, 'handlePointerUp', 'pointerup', { button: -1, buttons: 0 });
    expect(bus.events('waypoint:drag-ended')).toHaveLength(1);
  });

  test('modifier taps retain one canonical action and never begin a drag', () => {
    const waypoint = makeWaypoint('anchor', 0.2, 0.2);
    const hitHarness = makeHarness({ waypointHit: waypoint });
    const meta = isMac ? { metaKey: true } : { ctrlKey: true };

    pointerTap(hitHarness.handler, { ...meta, clientX: 200, clientY: 160 });
    expect(hitHarness.bus.events('waypoint:toggle-select')).toHaveLength(1);
    expect(hitHarness.bus.events('waypoint:position-changed')).toHaveLength(0);

    hitHarness.bus.clear();
    pointerTap(hitHarness.handler, { shiftKey: true, clientX: 200, clientY: 160 });
    expect(hitHarness.bus.events('waypoint:delete')).toHaveLength(1);
    expect(hitHarness.bus.events('ui:toast')).toHaveLength(1);

    const emptyHarness = makeHarness();
    pointerTap(emptyHarness.handler, { altKey: true, clientX: 300, clientY: 240 });
    expect(emptyHarness.bus.events('waypoint:add')).toHaveLength(1);
    expect(emptyHarness.bus.events('waypoint:add')[0].args[0].isMajor).toBe(true);

    emptyHarness.bus.clear();
    pointerTap(emptyHarness.handler, { ...meta, clientX: 300, clientY: 240 });
    expect(emptyHarness.bus.events('waypoint:add')).toHaveLength(1);
    expect(emptyHarness.bus.events('waypoint:add')[0].args[0].isMajor).toBe(false);
  });
});

describe('pointer ownership and terminal events', () => {
  test('non-primary contacts and non-primary buttons are ignored', () => {
    const { bus, canvas, handler } = makeHarness();

    pointerTap(handler, { pointerId: 8, pointerType: 'touch', isPrimary: false });
    pointerTap(handler, { pointerId: 9, pointerType: 'pen', button: 2, buttons: 2 });
    pointerTap(handler, { pointerId: 10, pointerType: 'mouse', button: 1, buttons: 4 });

    expect(bus.events('waypoint:add')).toHaveLength(0);
    expect(canvas.setPointerCapture).not.toHaveBeenCalled();
  });

  test('only the owning pointer can move or finish a gesture', () => {
    const waypoint = makeWaypoint('anchor', 0.2, 0.2);
    const { bus, captured, canvas, handler } = makeHarness({ waypointHit: waypoint });

    send(handler, 'handlePointerDown', 'pointerdown', { pointerId: 11 });
    send(handler, 'handlePointerMove', 'pointermove', {
      pointerId: 12,
      clientX: 260,
      buttons: 1,
    });
    send(handler, 'handlePointerUp', 'pointerup', {
      pointerId: 12,
      clientX: 260,
      button: -1,
      buttons: 0,
    });

    expect(bus.events('waypoint:position-changed')).toHaveLength(0);
    expect(bus.events('waypoint:drag-ended')).toHaveLength(0);
    expect(captured.has(11)).toBe(true);
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled();

    send(handler, 'handlePointerMove', 'pointermove', {
      pointerId: 11,
      clientX: 260,
      buttons: 1,
    });
    send(handler, 'handlePointerUp', 'pointerup', {
      pointerId: 11,
      clientX: 260,
      button: -1,
      buttons: 0,
    });
    expect(bus.events('waypoint:drag-ended')).toHaveLength(1);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(11);
  });

  test('pointercancel followed by lost capture cancels once and never commits', () => {
    const waypoint = makeWaypoint('anchor', 0.2, 0.2);
    const { bus, handler } = makeHarness({ waypointHit: waypoint });

    send(handler, 'handlePointerDown', 'pointerdown');
    send(handler, 'handlePointerMove', 'pointermove', { clientX: 240, buttons: 1 });
    send(handler, 'handlePointerCancel', 'pointercancel', { button: -1, buttons: 0 });
    send(handler, 'handleLostPointerCapture', 'lostpointercapture', {
      button: -1,
      buttons: 0,
    });
    send(handler, 'handlePointerCancel', 'pointercancel', { button: -1, buttons: 0 });

    expect(bus.events('waypoint:drag-cancelled')).toHaveLength(1);
    expect(bus.events('waypoint:drag-ended')).toHaveLength(0);
    expect(bus.events('waypoint:add')).toHaveLength(0);
  });

  test('unexpected lost capture cancels once; normal release then lost capture does not', () => {
    const waypoint = makeWaypoint('anchor', 0.2, 0.2);
    const first = makeHarness({ waypointHit: waypoint });
    send(first.handler, 'handlePointerDown', 'pointerdown');
    send(first.handler, 'handlePointerMove', 'pointermove', { clientX: 240, buttons: 1 });
    send(first.handler, 'handleLostPointerCapture', 'lostpointercapture', {
      button: -1,
      buttons: 0,
    });
    send(first.handler, 'handleLostPointerCapture', 'lostpointercapture', {
      button: -1,
      buttons: 0,
    });
    expect(first.bus.events('waypoint:drag-cancelled')).toHaveLength(1);
    expect(first.bus.events('waypoint:drag-ended')).toHaveLength(0);

    const second = makeHarness({ waypointHit: waypoint });
    send(second.handler, 'handlePointerDown', 'pointerdown');
    send(second.handler, 'handlePointerMove', 'pointermove', { clientX: 240, buttons: 1 });
    send(second.handler, 'handlePointerUp', 'pointerup', { clientX: 240, button: -1, buttons: 0 });
    send(second.handler, 'handleLostPointerCapture', 'lostpointercapture', {
      button: -1,
      buttons: 0,
    });
    expect(second.bus.events('waypoint:drag-ended')).toHaveLength(1);
    expect(second.bus.events('waypoint:drag-cancelled')).toHaveLength(0);
  });
});

describe('area and network routing', () => {
  test.each(['mouse', 'touch', 'pen'])(
    '%s area-draw tap places exactly one vertex',
    pointerType => {
      const { bus, handler } = makeHarness();
      bus.emit('area:draw-mode-changed', { active: true });
      bus.clear();

      pointerTap(handler, { pointerType, clientX: 350, clientY: 400 });

      expect(bus.events('area:draw-click')).toHaveLength(1);
      expect(bus.events('area:draw-click')[0].args[0]).toEqual({ imgX: 0.35, imgY: 0.5 });
      expect(bus.events('waypoint:add')).toHaveLength(0);
    }
  );

  test.each(['mouse', 'touch', 'pen'])(
    '%s area-handle drag has one start, move, and end',
    pointerType => {
      const waypoint = makeWaypoint('area-waypoint', 0.2, 0.2);
      waypoint.areaHighlight = { shape: 'circle', centerX: 0.2, centerY: 0.2 };
      const hit = {
        type: 'center',
        waypoint,
        imageToScreen: (x, y) => ({ x: x * 1000, y: y * 800 }),
      };
      const { bus, handler } = makeHarness({ areaHit: hit });
      const shared = { pointerType, clientX: 200, clientY: 160 };

      send(handler, 'handlePointerDown', 'pointerdown', shared);
      send(handler, 'handlePointerMove', 'pointermove', {
        ...shared,
        clientX: 240,
        clientY: 200,
        buttons: 1,
      });
      send(handler, 'handlePointerUp', 'pointerup', {
        ...shared,
        clientX: 240,
        clientY: 200,
        button: -1,
        buttons: 0,
      });

      expect(bus.events('area:edit-start')).toHaveLength(1);
      expect(bus.events('area:edit-move')).toHaveLength(1);
      expect(bus.events('area:edit-end')).toHaveLength(1);
      expect(bus.events('waypoint:add')).toHaveLength(0);
    }
  );

  test('area cancellation is routed once across cancel and lost capture', () => {
    const waypoint = makeWaypoint('area-waypoint', 0.2, 0.2);
    waypoint.areaHighlight = { shape: 'circle', centerX: 0.2, centerY: 0.2 };
    const { bus, handler } = makeHarness({
      areaHit: {
        type: 'center',
        waypoint,
        imageToScreen: (x, y) => ({ x: x * 1000, y: y * 800 }),
      },
    });

    send(handler, 'handlePointerDown', 'pointerdown');
    send(handler, 'handlePointerMove', 'pointermove', { clientX: 240, buttons: 1 });
    send(handler, 'handlePointerCancel', 'pointercancel', { button: -1, buttons: 0 });
    send(handler, 'handleLostPointerCapture', 'lostpointercapture', { button: -1, buttons: 0 });

    expect(bus.events('area:edit-cancel')).toHaveLength(1);
    expect(bus.events('area:edit-end')).toHaveLength(0);
  });

  test.each(['mouse', 'touch', 'pen'])(
    '%s network tap and drag each have one terminal action',
    pointerType => {
      const tapHarness = makeHarness();
      tapHarness.bus.emit('network:edit-mode-changed', { active: true });
      tapHarness.bus.clear();
      pointerTap(tapHarness.handler, { pointerType, clientX: 300, clientY: 240 });
      expect(tapHarness.bus.events('network:click')).toHaveLength(1);
      expect(tapHarness.bus.events('network:drag-start')).toHaveLength(0);
      expect(tapHarness.bus.events('network:drag-end')).toHaveLength(0);

      const dragHarness = makeHarness();
      dragHarness.bus.emit('network:edit-mode-changed', { active: true });
      dragHarness.bus.clear();
      send(dragHarness.handler, 'handlePointerDown', 'pointerdown', {
        pointerType,
        clientX: 300,
        clientY: 240,
      });
      send(dragHarness.handler, 'handlePointerMove', 'pointermove', {
        pointerType,
        clientX: 340,
        clientY: 280,
        buttons: 1,
      });
      send(dragHarness.handler, 'handlePointerUp', 'pointerup', {
        pointerType,
        clientX: 340,
        clientY: 280,
        button: -1,
        buttons: 0,
      });

      expect(dragHarness.bus.events('network:drag-start')).toHaveLength(1);
      expect(dragHarness.bus.events('network:drag-move')).toHaveLength(1);
      expect(dragHarness.bus.events('network:drag-end')).toHaveLength(1);
      expect(dragHarness.bus.events('network:click')).toHaveLength(0);
    }
  );

  test('network cancellation is routed once across cancel and lost capture', () => {
    const { bus, handler } = makeHarness();
    bus.emit('network:edit-mode-changed', { active: true });
    bus.clear();

    send(handler, 'handlePointerDown', 'pointerdown', { clientX: 300, clientY: 240 });
    send(handler, 'handlePointerMove', 'pointermove', {
      clientX: 340,
      clientY: 280,
      buttons: 1,
    });
    send(handler, 'handlePointerCancel', 'pointercancel', { button: -1, buttons: 0 });
    send(handler, 'handleLostPointerCapture', 'lostpointercapture', { button: -1, buttons: 0 });

    expect(bus.events('network:drag-cancel')).toHaveLength(1);
    expect(bus.events('network:drag-end')).toHaveLength(0);
    expect(bus.events('network:click')).toHaveLength(0);
  });
});

describe('multi-selection group drag', () => {
  test('tap collapses a group while drag preserves it and promotes the grabbed member', () => {
    const a = makeWaypoint('a', 0.2, 0.2);
    const b = makeWaypoint('b', 0.6, 0.6);
    const tapHarness = makeHarness({ waypointHit: a });
    tapHarness.handler.setSelection([a, b], b);

    pointerTap(tapHarness.handler, { clientX: 200, clientY: 160 });
    expect(tapHarness.bus.events('waypoint:selected')).toHaveLength(1);
    expect(tapHarness.bus.events('waypoint:selected')[0].args[0]).toBe(a);
    expect(tapHarness.bus.events('waypoint:multi-selected')).toHaveLength(0);

    const dragHarness = makeHarness({ waypointHit: a });
    dragHarness.handler.setSelection([a, b], b);
    send(dragHarness.handler, 'handlePointerDown', 'pointerdown', { clientX: 200, clientY: 160 });
    send(dragHarness.handler, 'handlePointerMove', 'pointermove', {
      clientX: 240,
      clientY: 200,
      buttons: 1,
    });
    send(dragHarness.handler, 'handlePointerUp', 'pointerup', {
      clientX: 240,
      clientY: 200,
      button: -1,
      buttons: 0,
    });

    expect(dragHarness.bus.events('waypoint:selected')).toHaveLength(0);
    expect(dragHarness.bus.events('waypoint:multi-selected')).toHaveLength(1);
    expect(dragHarness.bus.events('waypoint:multi-selected')[0].args[0]).toEqual({
      waypoints: [a, b],
      primary: a,
    });
  });

  test('one move carries immutable group-start snapshots and one aggregate end', () => {
    const a = makeWaypoint('a', 0.2, 0.2);
    const b = makeWaypoint('b', 0.6, 0.6);
    const { bus, handler } = makeHarness({ waypointHit: a });
    handler.setSelection([a, b], b);

    send(handler, 'handlePointerDown', 'pointerdown', { clientX: 200, clientY: 160 });
    send(handler, 'handlePointerMove', 'pointermove', {
      clientX: 300,
      clientY: 240,
      buttons: 1,
    });
    send(handler, 'handlePointerUp', 'pointerup', {
      clientX: 300,
      clientY: 240,
      button: -1,
      buttons: 0,
    });
    send(handler, 'handlePointerUp', 'pointerup', {
      clientX: 300,
      clientY: 240,
      button: -1,
      buttons: 0,
    });
    send(handler, 'handleLostPointerCapture', 'lostpointercapture', {
      clientX: 300,
      clientY: 240,
      button: -1,
      buttons: 0,
    });

    const moves = bus.events('waypoint:position-changed');
    expect(moves).toHaveLength(1);
    expect(moves[0].args[0]).toMatchObject({
      waypoint: a,
      imgX: 0.3,
      imgY: 0.3,
      isDragging: true,
    });
    expect(moves[0].args[0].dragGroup).toEqual([
      { waypoint: a, imgX: 0.2, imgY: 0.2 },
      { waypoint: b, imgX: 0.6, imgY: 0.6 },
    ]);

    const ends = bus.events('waypoint:drag-ended');
    expect(ends).toHaveLength(1);
    expect(ends[0].args[0]).toMatchObject({ waypoint: a });
    expect(ends[0].args[0].dragGroup).toEqual([
      { waypoint: a, imgX: 0.2, imgY: 0.2 },
      { waypoint: b, imgX: 0.6, imgY: 0.6 },
    ]);
    expect(bus.events('waypoint:multi-selected')).toHaveLength(1);
    expect(bus.events('waypoint:multi-selected')[0].args[0]).toEqual({
      waypoints: [a, b],
      primary: a,
    });
    expect(bus.events('waypoint:selected')).toHaveLength(0);
    expect(bus.events('waypoint:drag-cancelled')).toHaveLength(0);
  });

  test('window pointerup completes a drag after capture is released outside the canvas', () => {
    const waypoint = makeWaypoint('anchor', 0.2, 0.2);
    const { bus, canvas, handler } = makeHarness({ waypointHit: waypoint });

    canvas.dispatchEvent(makePointerEvent('pointerdown', {
      clientX: 200,
      clientY: 160,
    }));
    canvas.dispatchEvent(makePointerEvent('pointermove', {
      clientX: 260,
      clientY: 200,
      buttons: 1,
    }));
    window.dispatchEvent(makePointerEvent('pointerup', {
      clientX: 280,
      clientY: 220,
      button: -1,
      buttons: 0,
    }));

    expect(bus.events('waypoint:drag-ended')).toHaveLength(1);
    expect(bus.events('waypoint:drag-cancelled')).toHaveLength(0);
    expect(handler.activePointer).toBeNull();
    expect(canvas.classList.contains('dragging')).toBe(false);
  });
});

describe('listener lifecycle', () => {
  test('destroy removes every Pointer Events listener with its original callback', () => {
    document.body.innerHTML = '<canvas id="pointer-test-canvas"></canvas>';
    const canvas = document.getElementById('pointer-test-canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
    installPointerCapture(canvas);
    const addSpy = vi.spyOn(canvas, 'addEventListener');
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    const windowAddSpy = vi.spyOn(window, 'addEventListener');
    const windowRemoveSpy = vi.spyOn(window, 'removeEventListener');
    const handler = new InteractionHandler(canvas, new SyncBus());
    activeHandlers.add(handler);

    const pointerTypes = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ];
    const added = new Map(pointerTypes.map(type => [
      type,
      addSpy.mock.calls.find(([eventType]) => eventType === type)?.[1],
    ]));
    for (const type of pointerTypes) expect(added.get(type)).toEqual(expect.any(Function));
    const windowAdded = new Map(['pointerup', 'pointercancel'].map(type => [
      type,
      windowAddSpy.mock.calls.find(([eventType]) => eventType === type)?.[1],
    ]));
    for (const type of windowAdded.keys()) {
      expect(windowAdded.get(type)).toEqual(expect.any(Function));
    }

    handler.destroy();
    activeHandlers.delete(handler);

    for (const [type, callback] of added) {
      expect(removeSpy.mock.calls.some(
        ([eventType, removedCallback]) => eventType === type && removedCallback === callback
      )).toBe(true);
    }
    for (const [type, callback] of windowAdded) {
      expect(windowRemoveSpy.mock.calls.some(
        ([eventType, removedCallback]) => eventType === type && removedCallback === callback
      )).toBe(true);
    }
  });
});
