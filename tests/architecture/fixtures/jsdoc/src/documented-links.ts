// STACK-07's legal case for inline links: a {@link}, {@linkcode} or {@linkplain} reference on a tag is a reference, not
// a type, so it is accepted. On @param and @returns a link goes in the text: jsdoc/no-types reads one put where their
// type would go as a type.

/** The probe the links below point to. */
export class Probe {}

/**
 * A documented function whose tags carry inline links, which are accepted.
 * @param value The value to check; see {@link Probe}.
 * @returns A new {@link Probe} for a finite value.
 * @throws {@link RangeError} when the value is not finite.
 * @throws {@linkcode Error} when the probe cannot be made.
 * @deprecated {@linkplain Probe} instead.
 */
export function linked(value: number): Probe {
  if (!Number.isFinite(value)) throw new RangeError('not finite');
  return new Probe();
}
