// STACK-02: the core's scaffold, inert until CORE-01 and CORE-02 write the project model, geometry and timing here. It
// holds no model, timing or drawing: one pure helper, so the core's type check, its tests (Vitest and fast-check), its
// boundary and the exported player's build have real code to work on. No DOM types, no React, no clock.

/** `value` held within `[min, max]`; a value that is not a number stays NaN. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
