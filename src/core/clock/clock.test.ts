// CORE-02: the scene's one clock: Hold at start (CROWD-05.1's candidate), Hold at end, a fixed length that trims.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { defaultsOf } from '../schema/field';
import { CLOCK_SETTINGS } from '../config/settings';
import { contentTime, playLength, sceneTime, type ClockSettings } from './clock';

const clockOf = (over: Partial<ClockSettings> = {}): ClockSettings => ({ ...defaultsOf(CLOCK_SETTINGS), ...over });

describe('the scene’s clock', () => {
  it('runs from the content: Hold at start, the content, then Hold at end', () => {
    expect(playLength(clockOf({ holdAtStartMs: 500, holdAtEndMs: 2_000 }), 8_000)).toBe(10_500);
    expect(playLength(clockOf({ holdAtStartMs: 0, holdAtEndMs: 0 }), 0)).toBe(0);
  });

  it('a fixed length is the whole scene, Hold at start included: it trims the content, never stretches it', () => {
    const fixed = clockOf({ length: 'fixed', fixedLengthMs: 4_000, holdAtStartMs: 1_000 });
    expect(playLength(fixed, 60_000)).toBe(4_000);
    expect(contentTime(fixed, 60_000, 4_000)).toBe(3_000);
    expect(contentTime(fixed, 60_000, 9_999)).toBe(3_000);
    expect(contentTime(fixed, 2_000, 3_500)).toBe(2_000);
  });

  it('Hold at start holds the first frame, so Preview shows what an export shows', () => {
    const clock = clockOf({ holdAtStartMs: 1_000 });
    expect(contentTime(clock, 10_000, 0)).toBe(0);
    expect(contentTime(clock, 10_000, 999)).toBe(0);
    expect(contentTime(clock, 10_000, 1_500)).toBe(500);
  });

  it('Hold at end holds the content’s last moment; past the scene, before it or no number read as its ends', () => {
    const clock = clockOf({ holdAtStartMs: 500, holdAtEndMs: 2_000 });
    expect(contentTime(clock, 8_000, 8_500)).toBe(8_000);
    expect(contentTime(clock, 8_000, 9_700)).toBe(8_000);
    expect(contentTime(clock, 8_000, 10_500)).toBe(8_000);
    expect(contentTime(clock, 10_000, 12_000)).toBe(10_000);
    expect(contentTime(clock, 10_000, -5)).toBe(0);
    expect(contentTime(clock, 10_000, Number.NaN)).toBe(0);
  });

  it('as a property: scene time and content time are inverse within the scene, and content time never falls', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 200_000 }),
        fc.integer({ min: 0, max: 200_000 }),
        (hold, content, a, b) => {
          const clock = clockOf({ holdAtStartMs: hold, holdAtEndMs: 2_000 });
          const at = contentTime(clock, content, a);
          expect(at).toBeLessThanOrEqual(content);
          expect(contentTime(clock, content, sceneTime(clock, content, at))).toBe(at);
          if (a <= b) expect(contentTime(clock, content, a)).toBeLessThanOrEqual(contentTime(clock, content, b));
        },
      ),
    );
  });
});
