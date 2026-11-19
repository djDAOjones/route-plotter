// CORE-03: what a parsed project.json is, and whether the declaration accepts it (the plan's §13). First the kind of
// file, before the ZIP's other files are weighed, since a v3 project holds files a v4 one never does: not an object is
// not a project; no format mark and v3's own keys is a v3 project (v3/src/app/persistence.js:1495–1553), refused by
// name (Q14: v3 files stay with v3); a v4 mark whose `version` the declaration does not accept is another preview's,
// older or newer alike (PLAN-7). Then `check(PROJECT_FILE, …)`, the only judge of every field: a key no declaration
// holds is listed as unknown, a feature (the plan's §9: saved under `features`, keyed by its id) by its id; any other
// problem refuses the file as it is. Nothing here reads a field to judge it.
import { check } from '../../core/schema/check';
import { ruleBrokenBy } from '../../core/schema/field';
import { FORMAT_VERSION, PROJECT_FILE } from './format';
import type { ProjectFile } from './format';
import { WORDS } from './words';
import type { Problem, Refusal } from './words';

/** Keys only a v3 project.json holds at its top (v3/src/app/persistence.js:1498–1502). */
const V3_KEYS: readonly string[] = ['coordVersion', 'waypoints', 'styles', 'animationState'];

const FEATURES = 'features';

const has = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/** An object or a list: what a key or an index can be read from. */
const holder = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null;

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => holder(value) && !Array.isArray(value);

/** The file's kind, when it is not a v4 project of this preview's format; null when the check should judge it. */
export function classify(value: unknown): Refusal | null {
  if (!isObject(value)) return { reason: 'not-a-project', message: WORDS.openedNotAProject };
  if (!has(value, 'app') && !has(value, 'format')) {
    return V3_KEYS.some((key) => has(value, key))
      ? { reason: 'v3', message: WORDS.openedV3 }
      : { reason: 'not-a-project', message: WORDS.openedNotAProject };
  }
  const { app, format, version } = PROJECT_FILE.of;
  const marked = ruleBrokenBy(app, value.app) === null && ruleBrokenBy(format, value.format) === null;
  if (marked && typeof value.version === 'number' && ruleBrokenBy(version, value.version) !== null) {
    const found = String(value.version);
    return { reason: 'other-preview', message: WORDS.openedOtherPreview(found, FORMAT_VERSION), version: found };
  }
  return null;
}

/** A problem's path, `scene.routes[0].features`, as its keys and indexes. */
function segments(path: string): string[] {
  return [...path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map((match) => match[1] ?? match[2] ?? '');
}

/** The parsed value at a problem's path, read from plain data that JSON.parse made, or undefined. */
function at(root: unknown, keys: readonly string[]): unknown {
  let value = root;
  for (const key of keys) {
    if (!holder(value) || !has(value, key)) return undefined;
    value = value[key];
  }
  return value;
}

/** The unknown problems, sorted into features (by id) and fields (by place). */
function unknowns(root: unknown, problems: readonly Problem[]): { features: string[]; fields: string[] } {
  const features = new Set<string>();
  const fields: string[] = [];
  for (const { path } of problems) {
    const keys = segments(path);
    const last = keys.at(-1);
    const held = last === FEATURES ? at(root, keys) : undefined;
    if (isObject(held) && Object.keys(held).length > 0) Object.keys(held).forEach((id) => features.add(id));
    else if (keys.at(-2) === FEATURES && last !== undefined) features.add(last);
    else fields.push(path);
  }
  return { features: [...features], fields };
}

export type Judged = { readonly ok: true; readonly file: ProjectFile } | { readonly ok: false; readonly refusal: Refusal };

/** project.json judged by its declaration alone: its checked copy (declared fields only), or why it is refused. */
export function judge(value: unknown): Judged {
  const checked = check(PROJECT_FILE, value);
  if (checked.ok) return { ok: true, file: checked.value };
  const unknown = checked.problems.filter((problem) => problem.rule === 'unknown');
  if (unknown.length > 0) {
    const found = { ...unknowns(value, unknown), files: [] };
    return { ok: false, refusal: { reason: 'unknown', message: WORDS.openedUnknown(found), ...found } };
  }
  return { ok: false, refusal: { reason: 'invalid', message: WORDS.openedInvalid(checked.problems), problems: checked.problems } };
}
