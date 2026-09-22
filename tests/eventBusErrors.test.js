import { afterEach, describe, expect, test, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';

/**
 * ISO-02 — a swallowed listener error should be observable.
 *
 * The bus deliberately swallows listener errors so one broken handler cannot
 * stop the rest. That is a real contract, kept here; what changes is that the
 * failures can now be seen — counted, and routed to a caller's handler — which
 * is what lets tests fail on an error the app would only have logged.
 */
describe('EventBus listener errors (ISO-02)', () => {
  // Restore spies even when an assertion fails, or a console spy outlives its
  // test: clearing mock history does not restore an implementation.
  afterEach(() => vi.restoreAllMocks());

  test('by default a throwing listener is logged and the others still run', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new EventBus();
    const failure = new Error('boom');
    const after = vi.fn();

    bus.on('waypoint:add', () => { throw failure; });
    bus.on('waypoint:add', after);
    bus.emit('waypoint:add', { imgX: 0.5 });

    expect(after).toHaveBeenCalledWith({ imgX: 0.5 });
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]).toEqual(['Error in event listener for waypoint:add:', failure]);
    expect(bus.listenerErrorCount).toBe(1);
  });

  test('a handler receives the error, its event and its arguments instead', () => {
    const onListenerError = vi.fn();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new EventBus({ onListenerError });
    const failure = new Error('boom');
    const after = vi.fn();

    bus.on('area:changed', () => { throw failure; });
    bus.on('area:changed', after);
    bus.emit('area:changed', { waypoint: 'wp_1' }, 'extra');

    expect(onListenerError).toHaveBeenCalledWith(failure, {
      eventName: 'area:changed',
      args: [{ waypoint: 'wp_1' }, 'extra']
    });
    // A handler that returns leaves the rest of the emit as it was.
    expect(after).toHaveBeenCalledWith({ waypoint: 'wp_1' }, 'extra');
    expect(logged).not.toHaveBeenCalled();
    expect(bus.listenerErrorCount).toBe(1);
  });

  test('the handler cannot change what the later listeners receive', () => {
    const bus = new EventBus({ onListenerError: (_error, context) => { context.args.length = 0; } });
    const after = vi.fn();

    bus.on('ui:toast', () => { throw new Error('boom'); });
    bus.on('ui:toast', after);
    bus.emit('ui:toast', 'hello');

    expect(after).toHaveBeenCalledWith('hello');
  });

  test('a handler that throws stops the emit, so a test can fail loudly', () => {
    const bus = new EventBus({ onListenerError: (error) => { throw error; } });
    const after = vi.fn();

    bus.on('ui:toast', () => { throw new Error('boom'); });
    bus.on('ui:toast', after);

    expect(() => bus.emit('ui:toast', 'hello')).toThrow('boom');
    expect(after).not.toHaveBeenCalled();
    expect(bus.listenerErrorCount).toBe(1);
  });

  test('the count accumulates across events and starts at zero', () => {
    const bus = new EventBus({ onListenerError: () => {} });

    expect(bus.listenerErrorCount).toBe(0);
    bus.on('a:one', () => { throw new Error('1'); });
    bus.on('b:two', () => { throw new Error('2'); });
    bus.emit('a:one');
    bus.emit('b:two');
    bus.emit('b:two');

    expect(bus.listenerErrorCount).toBe(3);
  });
});
