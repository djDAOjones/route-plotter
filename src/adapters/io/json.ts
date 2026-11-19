// CORE-03: project.json's bytes to plain data, before any field is checked (the plan's §15). The bytes must be UTF-8
// exactly: a broken sequence is refused, never replaced, so a damaged emoji is never opened silently (DEF-101). Then
// v3's `assertSafeProjectTree` (v3/src/app/persistence.js:80, :132–172): one walk with its own stack, never recursion,
// bounding how many values, how deep, how long each text and how many text bytes in all, refusing a number JSON.parse
// made infinite (`1e400`) and the keys that reach an object's prototype (`__proto__`, `prototype`, `constructor`)
// wherever they stand.
import { TREE_LIMITS } from './limits';
import { WORDS } from './words';
import type { Refusal } from './words';

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'prototype', 'constructor']);

export type Parsed = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly refusal: Refusal };

const unsafe = (why: string): Parsed => ({ ok: false, refusal: { reason: 'unsafe', message: WORDS.openedUnsafe(why) } });
const tooLarge = (what: string): Parsed => ({ ok: false, refusal: { reason: 'too-large', message: WORDS.openedTooLarge(what) } });

/** Why a parsed tree is refused: too large or unsafe, and why, in words that follow "because" or a colon. */
export interface TreeProblem {
  readonly reason: 'too-large' | 'unsafe';
  readonly why: string;
}

const large = (why: string): TreeProblem => ({ reason: 'too-large', why });
const risky = (why: string): TreeProblem => ({ reason: 'unsafe', why });

/**
 * Why the parsed tree is refused, or null. JSON.parse gives plain data only, with no cycles, getters or symbols. Save
 * applies it to what it writes as well, so it never writes a file Open would refuse.
 */
export function treeProblem(root: unknown): TreeProblem | null {
  const stack: { value: unknown; depth: number }[] = [{ value: root, depth: 0 }];
  const encoder = new TextEncoder();
  let values = 0;
  let textBytes = 0;
  const text = (value: string): TreeProblem | null => {
    if (value.length > TREE_LIMITS.textLength) {
      return large(`one of its texts is longer than ${TREE_LIMITS.textLength.toLocaleString('en-GB')} characters`);
    }
    textBytes += encoder.encode(value).byteLength;
    return textBytes > TREE_LIMITS.textBytes ? large('its texts come to more than 2 MB') : null;
  };
  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    const { value, depth } = item;
    values += 1;
    if (values > TREE_LIMITS.values) return large(`it holds more than ${TREE_LIMITS.values.toLocaleString('en-GB')} values`);
    if (depth > TREE_LIMITS.depth) return risky(`its settings are nested more than ${TREE_LIMITS.depth} deep`);
    if (typeof value === 'number' && !Number.isFinite(value)) return risky('it holds a number too large to use');
    if (typeof value === 'string') {
      const refused = text(value);
      if (refused !== null) return refused;
      continue;
    }
    if (typeof value !== 'object' || value === null) continue;
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) return risky(`it holds the setting name "${key}", which Route Plotter never writes`);
      const refused = text(key);
      if (refused !== null) return refused;
      stack.push({ value: child, depth: depth + 1 });
    }
  }
  return null;
}

/** project.json's bytes as plain data, or why they are refused. Never throws. */
export function parseProjectJson(bytes: Uint8Array): Parsed {
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return unsafe('its project.json is not readable text');
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return { ok: false, refusal: { reason: 'not-a-project', message: WORDS.openedNotAProject } };
  }
  const problem = treeProblem(value);
  if (problem === null) return { ok: true, value };
  return problem.reason === 'too-large' ? tooLarge(problem.why) : unsafe(problem.why);
}
