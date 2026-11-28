import { describe, expect, it } from 'vitest';
import { createHover, hoverOf } from './hover';

describe('the hover holder (brief 118, ruling S)', () => {
  it('begins at nothing, holds what is set, tells only on a change by value, and stops telling when unsubscribed', () => {
    const hover = createHover();
    expect(hover.held()).toBeNull();
    let told = 0;
    const stop = hover.subscribe(() => (told += 1));
    hover.set({ routeId: 'r', lineId: 'l', onPlus: false });
    hover.set({ lineId: 'l', onPlus: false, routeId: 'r' });
    expect(told).toBe(1);
    hover.set({ routeId: 'r', pointId: 'l' });
    hover.set(null);
    hover.set(null);
    expect(told).toBe(3);
    stop();
    hover.set({ routeId: 'r', pointId: 'p' });
    expect(told).toBe(3);
    expect(hover.held()).toEqual({ routeId: 'r', pointId: 'p' });
  });

  it('reads a hit test\'s answer: a point, a line, or nothing', () => {
    expect(hoverOf({ kind: 'point', route: 'r', id: 'p' })).toEqual({ routeId: 'r', pointId: 'p' });
    expect(hoverOf({ kind: 'line', route: 'r', id: 'l' })).toEqual({ routeId: 'r', lineId: 'l', onPlus: false });
    expect(hoverOf(null)).toBeNull();
  });

  it('a line\'s hover says whether the pointer is on its "+" (brief 120, ruling AA); moving onto the "+" tells once', () => {
    expect(hoverOf({ kind: 'line', route: 'r', id: 'l', plus: { x: 0.4, y: 0.4 } })).toEqual({ routeId: 'r', lineId: 'l', onPlus: true });
    const hover = createHover();
    let told = 0;
    hover.subscribe(() => (told += 1));
    hover.set(hoverOf({ kind: 'line', route: 'r', id: 'l' }));
    expect(told).toBe(1);
    hover.set(hoverOf({ kind: 'line', route: 'r', id: 'l', plus: { x: 0.4, y: 0.4 } }));
    hover.set(hoverOf({ kind: 'line', route: 'r', id: 'l', plus: { x: 0.4, y: 0.4 } }));
    expect(told).toBe(2);
    expect(hover.held()).toEqual({ routeId: 'r', lineId: 'l', onPlus: true });
    hover.set(hoverOf({ kind: 'line', route: 'r', id: 'l' }));
    expect(told).toBe(3);
  });
});
