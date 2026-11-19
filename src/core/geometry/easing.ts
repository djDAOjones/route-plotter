// CORE-02: v3's easing curves, ported (v3/src/utils/Easing.js). Each maps 0 to 0 and 1 to 1.

/** Slow at first (Easing.js:17). */
export const quadIn = (t: number): number => t * t;

/** Fast at first, settling at the end (Easing.js:30). */
export const cubicOut = (t: number): number => (t - 1) ** 3 + 1;

/** Slow at both ends (Easing.js:44). */
export const cubicInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 + 4 * (t - 1) ** 3);
