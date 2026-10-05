/**
 * Guards for the src/app/ prototype-mixin split of main.js (Phase 1).
 *
 * All mixins are merged onto RoutePlotter.prototype with Object.assign,
 * so a method name appearing in two mixins would silently last-write-win.
 * This suite fails loudly instead. It also covers snapToAngle, which moved
 * from main.js to its own util during the split.
 *
 * TST-08 adds the guards that read the composition from main.js itself: the
 * list below is the one main.js composes, no mixin shares a name with the
 * class, no instance property hides a method, and every call made on the app
 * by name reaches a method it has. Their section, at the end of this file,
 * opens with why.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { parseAst } from 'vitest/node';
import { wiringDomMixin } from '../src/app/wiringDom.js';
import { wiringBusMixin } from '../src/app/wiringBus.js';
import {
  wiringControllersMixin,
  reorderWaypointBlocks,
  resolveWaypointInsertIndex,
} from '../src/app/wiringControllers.js';
import { undoRedoMixin } from '../src/app/undoRedo.js';
import { playbackMixin } from '../src/app/playback.js';
import { cameraMixin } from '../src/app/camera.js';
import { viewportMixin } from '../src/app/viewport.js';
import { pathTimingMixin } from '../src/app/pathTiming.js';
import { persistenceMixin } from '../src/app/persistence.js';
import { exportingMixin } from '../src/app/exporting.js';
import { editorPanelMixin } from '../src/app/editorPanel.js';
import { pointerMixin } from '../src/app/pointer.js';
import { crowdsMixin } from '../src/app/crowds.js';
import { networkMixin } from '../src/app/network.js';
import { sceneOutlineMixin } from '../src/app/sceneOutline.js';
import { privacyMixin } from '../src/app/privacy.js';
import { snapToAngle } from '../src/utils/snapToAngle.js';
import { sliderToPathWidth, pathWidthToSlider } from '../src/utils/pathWidthScale.js';

const MIXINS = {
  wiringDomMixin,
  wiringBusMixin,
  wiringControllersMixin,
  undoRedoMixin,
  playbackMixin,
  cameraMixin,
  viewportMixin,
  pathTimingMixin,
  persistenceMixin,
  exportingMixin,
  editorPanelMixin,
  pointerMixin,
  crowdsMixin,
  networkMixin,
  sceneOutlineMixin,
  privacyMixin,
};

describe('RoutePlotter prototype mixins', () => {
  test('every mixin exports a non-empty object of functions', () => {
    for (const [name, mixin] of Object.entries(MIXINS)) {
      const keys = Object.keys(mixin);
      expect(keys.length, `${name} should not be empty`).toBeGreaterThan(0);
      for (const key of keys) {
        expect(typeof mixin[key], `${name}.${key} should be a function`).toBe('function');
      }
    }
  });

  test('no method name is defined by two mixins (Object.assign would silently drop one)', () => {
    const owners = new Map();
    const collisions = [];
    for (const [name, mixin] of Object.entries(MIXINS)) {
      for (const key of Object.keys(mixin)) {
        if (owners.has(key)) collisions.push(`${key} (${owners.get(key)} + ${name})`);
        owners.set(key, name);
      }
    }
    expect(collisions).toEqual([]);
  });

  test('core method groups landed where expected', () => {
    // Spot-check one load-bearing method per cluster so an accidental
    // wholesale move (or an empty extraction) cannot pass unnoticed.
    expect(typeof wiringDomMixin.setupEventListeners).toBe('function');
    expect(typeof undoRedoMixin.undo).toBe('function');
    expect(typeof playbackMixin.play).toBe('function');
    expect(typeof cameraMixin._calculateCameraState).toBe('function');
    expect(typeof viewportMixin.setZoom).toBe('function');
    expect(typeof pathTimingMixin.calculatePath).toBe('function');
    expect(typeof persistenceMixin.autoSave).toBe('function');
    expect(typeof exportingMixin.exportVideo).toBe('function');
    expect(typeof editorPanelMixin.updateWaypointEditor).toBe('function');
    expect(typeof pointerMixin.findWaypointAt).toBe('function');
    expect(typeof crowdsMixin.addCrowd).toBe('function');
    expect(typeof networkMixin.findNetworkTargetAt).toBe('function');
    expect(typeof sceneOutlineMixin.setupSceneOutline).toBe('function');
    expect(typeof privacyMixin.requestProjectSave).toBe('function');
  });
});

describe('waypoint insertion boundaries', () => {
  const majorA = { id: 'major-a', isMajor: true };
  const minorA = { id: 'minor-a', isMajor: false };
  const majorB = { id: 'major-b', isMajor: true };
  const waypoints = [majorA, minorA, majorB];

  test('semantic insertion is exact for route start, selected major, and selected minor', () => {
    expect(resolveWaypointInsertIndex(waypoints, {
      isMajor: true, insertAfterId: null,
    }, null)).toBe(0);
    expect(resolveWaypointInsertIndex(waypoints, {
      isMajor: false, insertAfterId: majorA.id,
    }, majorA)).toBe(1);
    expect(resolveWaypointInsertIndex(waypoints, {
      isMajor: false, insertAfterId: minorA.id,
    }, minorA)).toBe(2);
  });

  test('pointer insertion retains minor-run and major-append behavior', () => {
    expect(resolveWaypointInsertIndex(waypoints, { isMajor: false }, majorA)).toBe(2);
    expect(resolveWaypointInsertIndex(waypoints, { isMajor: true }, majorA)).toBe(3);
    expect(resolveWaypointInsertIndex(waypoints, { isMajor: false }, null)).toBe(3);
  });
});

describe('snapToAngle', () => {
  test('snaps the angle to the nearest 15° increment and preserves distance', () => {
    // 20° from the reference should snap back to 15°.
    const rad20 = 20 * Math.PI / 180;
    const target = snapToAngle(0, 0, Math.cos(rad20), Math.sin(rad20));
    const rad15 = 15 * Math.PI / 180;
    expect(target.x).toBeCloseTo(Math.cos(rad15), 10);
    expect(target.y).toBeCloseTo(Math.sin(rad15), 10);
    expect(Math.hypot(target.x, target.y)).toBeCloseTo(1, 10);
  });

  test('an exact multiple of the increment is unchanged', () => {
    const rad45 = 45 * Math.PI / 180;
    const target = snapToAngle(0, 0, Math.cos(rad45) * 2, Math.sin(rad45) * 2);
    expect(target.x).toBeCloseTo(Math.cos(rad45) * 2, 10);
    expect(target.y).toBeCloseTo(Math.sin(rad45) * 2, 10);
  });

  test('coincident points are returned untouched', () => {
    expect(snapToAngle(0.5, 0.5, 0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });

  test('custom snap increment is honoured', () => {
    // 40° with a 90° increment snaps to 0°.
    const rad40 = 40 * Math.PI / 180;
    const target = snapToAngle(0, 0, Math.cos(rad40) * 3, Math.sin(rad40) * 3, 90);
    expect(target.x).toBeCloseTo(3, 10);
    expect(target.y).toBeCloseTo(0, 10);
  });
});

describe('pathWidthScale', () => {
  test('slider endpoints map to the width range', () => {
    expect(sliderToPathWidth(0)).toBeCloseTo(1, 10);
    expect(sliderToPathWidth(1000)).toBeCloseTo(40, 10);
  });

  test('round-trips width → slider → width', () => {
    for (const width of [1, 3, 7.5, 12, 40]) {
      expect(sliderToPathWidth(pathWidthToSlider(width))).toBeCloseTo(width, 1);
    }
  });

  test('out-of-range values clamp', () => {
    expect(sliderToPathWidth(-100)).toBe(1);
    expect(sliderToPathWidth(5000)).toBe(40);
    expect(pathWidthToSlider(400)).toBe(1000);
    expect(pathWidthToSlider(0)).toBe(0);
  });

  test('a raw slider integer is not a width (bulk-write regression pin)', () => {
    // Review 2026-08-18: bulk "apply to all" stored the raw slider value
    // (e.g. 333) as segmentWidth instead of converting to 1-40 px.
    expect(sliderToPathWidth(333)).toBeCloseTo(3.42, 2);
  });
});

describe('reorderWaypointBlocks', () => {
  // Only isMajor is read; names make failure output readable.
  const major = (name) => ({ name, isMajor: true });
  const minor = (name) => ({ name, isMajor: false });
  const names = (wps) => wps.map(wp => wp.name);

  test('a major carries its trailing minors to its new position', () => {
    const A = major('A'), m1 = minor('m1'), B = major('B'), C = major('C');
    const result = reorderWaypointBlocks([A, m1, B, C], [B, A, C]);
    // Regression pin (review 2026-08-18): the old rebuild kept minors at
    // their original array indices, producing [B, m1, A, C] — m1 silently
    // detached from A's leg and started shaping B's instead.
    expect(names(result)).toEqual(['B', 'A', 'm1', 'C']);
  });

  test('minors before the first major stay at the front', () => {
    const m0 = minor('m0'), A = major('A'), B = major('B');
    const result = reorderWaypointBlocks([m0, A, B], [B, A]);
    expect(names(result)).toEqual(['m0', 'B', 'A']);
  });

  test('a major omitted from the payload is appended, never dropped', () => {
    const A = major('A'), m1 = minor('m1'), B = major('B');
    const result = reorderWaypointBlocks([A, m1, B], [B]);
    expect(names(result)).toEqual(['B', 'A', 'm1']);
  });

  test('preserves object identity and count, and does not mutate the input', () => {
    const A = major('A'), m1 = minor('m1'), m2 = minor('m2'), B = major('B');
    const input = [A, m1, m2, B];
    const result = reorderWaypointBlocks(input, [B, A]);
    expect(result).toHaveLength(4);
    expect(new Set(result)).toEqual(new Set(input));
    expect(result).toEqual([B, A, m1, m2]);
    expect(input).toEqual([A, m1, m2, B]);
  });

  test('unchanged order round-trips to an identical array', () => {
    const A = major('A'), m1 = minor('m1'), B = major('B'), m2 = minor('m2');
    const input = [A, m1, B, m2];
    expect(reorderWaypointBlocks(input, [A, B])).toEqual(input);
  });
});

/*
 * TST-08 — the composition, read from main.js.
 *
 * main.js builds the app in two steps: the class body holds its core, then one
 * `Object.assign(RoutePlotter.prototype, …)` copies every mixin's methods onto
 * the prototype. Nothing checked that step:
 *
 * - MIXINS was kept by hand, so a mixin that main.js composed and this file
 *   did not list escaped the check that no two mixins share a name;
 * - Object.assign runs after the class body, so a mixin method named like a
 *   class member silently replaces it on the prototype: the mixin wins,
 *   whichever was written first. The other way round, an instance property (a
 *   class field, or any `this.name = …`) hides a prototype method of that name
 *   from every call after it is set;
 * - a call to a name the app does not have throws only when it runs, so one in
 *   dead code, like `this.generatePathData()`, never does.
 *
 * So the composed list, the class's members and every call made on the app by
 * name are read from the source, as code. MIXINS stays written out, so adding
 * a mixin is a deliberate edit here too, but the checks below run on the list
 * read from main.js, so none of them can miss a mixin MIXINS lacks.
 *
 * The source is parsed by `parseAst`, which vitest, already a devDependency,
 * exports from its public `vitest/node` entry: Vite's JavaScript parser, built
 * on Oxc. Comments, strings, parentheses, escapes and semicolon insertion are
 * the parser's, so a name is read as JavaScript reads it. Should an upgrade drop
 * that export, this file fails to load; it cannot pass. What the readers take
 * as the app:
 *
 * - the composition is the one `Object.assign(RoutePlotter.prototype, …)`
 *   statement at module level, after the class, each argument a plain imported
 *   name. RoutePlotter is reached nowhere else but `new RoutePlotter()`, and no
 *   module under src/ changes a composed mixin: one may be called, read by
 *   property or copied from, and nothing more, or the app would hold what these
 *   tests never see. Every module's code is read for that, whatever its text
 *   holds, so a dynamic import is found however it is spelt. A mixin exported
 *   under a second name or from another module, and Object.prototype's members
 *   that change or hand on their object (`__defineGetter__`, `valueOf`, …), are
 *   refused on it. No module may change the built-in Object either: it is
 *   reached only as `Object.<one of its own members>`, read or called and never
 *   written, Object.prototype only through a member that only reads it, and
 *   Object as a value not at all. A built-in reached any other way is taken as
 *   intact;
 * - `this` is the app in RoutePlotter's own methods and fields and in a
 *   composed mixin's methods, and an arrow keeps the `this` around it. In any
 *   other object's or class's method it is that object, and is passed over.
 *   Anywhere else it is refused: in a plain `function` or at the module's top
 *   level what it is depends on how the code runs, and in a static member of
 *   RoutePlotter it is the class. `super` in the app's methods is refused too;
 * - `app` is the app where it is a function's own parameter, as src/app/'s
 *   helpers take it; `app` declared or assigned any other way is refused, and
 *   so is `arguments` in a function that takes it;
 * - main.js publishes the app as `window.app`. In the files read for the app
 *   (main.js, src/app/ and any composed mixin's module) that alias is refused
 *   wherever it is reached but the statement that publishes it, however the
 *   global object is named (`window`, `globalThis`, `self`, …) or the key spelt,
 *   and so is the global object as a value, but handed to a service the app
 *   holds. Past those files, and past a service, nothing reads the app: there
 *   `window.app` is not checked;
 * - the app is reached by name: `this.name` or `app.name`, parenthesised or
 *   optional or not. A call is `.name(`, `.name?.(` or a tagged template; a
 *   write is an assignment to `.name` with any operator, `++`, `--`, `delete`,
 *   or a destructuring or for-in/of target. `this.service.method(` calls a
 *   service the app holds, not the app. Handed whole to a helper, the app is
 *   followed when the helper takes it as its own `app` parameter and the
 *   helper's name is never assigned again; bound as the receiver of its own
 *   method (`this.name.bind(this)`) it is that method. A computed reach
 *   (`this[…]`) or a bulk write (`Object.assign(this, …)`) is returned for the
 *   checks below to refuse; any other use of the app as a value (an alias, a
 *   destructuring read, a hand-off to anything else, `this.constructor`, and
 *   Object.prototype's members that change or hand it on) is refused by the
 *   reader;
 * - a call is certified by a function the app stores only when the write that
 *   stores it is on the app: through `this`, or through the `app` parameter of
 *   a helper some call read hands the app. A `.bind(…)` stores a function only
 *   when it binds one written there or a method the app has;
 * - a class member is read by the key JavaScript gives it (quoted, escaped,
 *   numeric, or a constant computed key), and of two members with one key the
 *   later is what the prototype holds. A computed key that is not a constant,
 *   an `extends` clause, and source the parser cannot read are refused.
 *
 * A refusal names its file and line, so these tests fail rather than pass on a
 * shorter list. The last describe pins the readers on fixtures, among them
 * each probe review round 2 found passing every guard (Q01–Q19), now refused.
 */

const repoRoot = join(import.meta.dirname, '..');
const MAIN = 'src/main.js';

/**
 * Calls on the app that reach nothing it has, as they stand. Each is counted
 * per file, so the same call made again still fails, and an entry that no
 * longer occurs fails too: the list cannot outlive what it excuses. An entry
 * that excuses a call as dead names, as `deadWithout`, the property whose
 * absence keeps it dead, and is held to it: each occurrence must stay behind an
 * `if (!this.<property>) return;` in its own function, and nothing may give the
 * app that property (a class member or field, a mixin's, or any write).
 */
const UNRESOLVED_CALLS = [
  {
    file: 'src/app/wiringControllers.js',
    call: 'this.generatePathData(',
    count: 1,
    where: "setupControllerEventConnections, the first of its two 'waypoint:add-at-center' listeners",
    why: 'No source defines generatePathData; the one definition anywhere is a stub in ' +
      'tests/multiSelect.test.js. The listener is dead. It returns at once on this.backgroundImage, which ' +
      'nothing assigns, and the second listener adds the waypoint. DEL-04 deletes it.',
    deadWithout: 'backgroundImage',
  },
];

/** Compute once. A computation that throws is tried again, so every test that needs it fails with its message. */
function once(compute) {
  let value;
  let done = false;
  return () => {
    if (!done) {
      value = compute();
      done = true;
    }
    return value;
  };
}

const readSource = file => readFileSync(join(repoRoot, file), 'utf8');
const mainModule = once(() => parseModule(readSource(MAIN), MAIN));
const classBody = once(() => classMembers(mainModule(), 'RoutePlotter'));

/** main.js, every module under src/app/ and any composed mixin kept elsewhere, each parsed once. */
const modules = once(() => {
  const appFiles = readdirSync(join(repoRoot, 'src', 'app'), { recursive: true })
    .filter(name => name.endsWith('.js'))
    .map(name => posix.join('src', 'app', name));
  const mixinFiles = composedMixins(mainModule()).map(mixin => moduleFile(MAIN, mixin.specifier));
  const files = [...new Set([MAIN, ...appFiles.sort(), ...mixinFiles])];
  return new Map(files.map(file => [file, file === MAIN ? mainModule() : parseModule(readSource(file), file)]));
});

/** Every module under src/, parsed once (those read for the app are shared with modules()). */
const sourceModules = once(() => {
  const read = modules();
  const files = readdirSync(join(repoRoot, 'src'), { recursive: true })
    .filter(name => name.endsWith('.js'))
    .map(name => posix.join('src', name))
    .sort();
  return new Map([...read, ...files.filter(file => !read.has(file)).map(file => [file, parseModule(readSource(file), file)])]);
});

/**
 * What main.js composes, each mixin with the object its module exports under
 * that name. These tests import each mixin's module on its own, so a module
 * that changed a composed mixin would change the app and not them: no module
 * under src/ may. Nor may one change the built-in Object, whose assign does
 * the composing.
 */
const composition = once(async () => {
  const mixins = composedMixins(mainModule());
  unchangedMixins(sourceModules(), MAIN, mixins);
  untouchedObject(sourceModules());
  return Promise.all(mixins.map(async mixin => {
    const module = await import(join(repoRoot, moduleFile(MAIN, mixin.specifier)));
    return { ...mixin, object: module[mixin.exported] };
  }));
});

/** Each module read, with the calls and writes it makes on the app, and the helpers it hands the app to. */
const scans = once(() => {
  const mixins = composedMixins(mainModule());
  return [...modules().values()].map(module => ({
    file: module.file,
    ...appReferences(module, appContext(module, {
      modules: modules(),
      className: module.file === MAIN ? 'RoutePlotter' : null,
      mixins: mixins.filter(mixin => moduleFile(MAIN, mixin.specifier) === module.file).map(mixin => mixin.exported),
    })),
  }));
});

describe('the composition main.js builds (TST-08)', () => {
  test('main.js composes exactly the mixins listed here, each the object imported here', async () => {
    const drift = [];
    const composed = new Set();
    for (const mixin of await composition()) {
      const where = `${MAIN}:${mixin.line}`;
      if (composed.has(mixin.exported)) drift.push(`${where} composes ${mixin.exported} a second time`);
      composed.add(mixin.exported);
      if (!Object.hasOwn(MIXINS, mixin.exported)) {
        drift.push(`${where} composes ${mixin.exported} from ${mixin.specifier}, which MIXINS does not list`);
      } else if (mixin.object !== MIXINS[mixin.exported]) {
        drift.push(`${where} composes the ${mixin.exported} that ${mixin.specifier} exports, not the object MIXINS lists`);
      }
    }
    for (const name of Object.keys(MIXINS)) {
      if (!composed.has(name)) drift.push(`MIXINS lists ${name}, which ${MAIN} does not compose`);
    }
    expect(drift).toEqual([]);
  });

  test('no mixin method has the name of a member the RoutePlotter class defines', async () => {
    // Each key's member is the later of two with one key: what the prototype holds.
    const members = classBody().effective;
    // The reader found the class's core, so an empty list below means something.
    expect([...members.keys()]).toEqual(expect.arrayContaining(['constructor', 'init', 'render']));
    const shared = [];
    for (const mixin of await composition()) {
      for (const key of Object.keys(mixin.object ?? {})) {
        const member = members.get(key);
        if (!member) continue;
        const effect = member.kind === 'method'
          ? `Object.assign runs after the class body, so ${mixin.exported}'s copy silently replaces the class's`
          : `Object.assign writes through the class's ${accessorWords(member)}, so the method never lands ` +
            '(and a getter alone makes main.js throw on load)';
        shared.push(`${key}: ${MAIN}:${member.line} defines it in the class and ${mixin.exported} defines it too. ${effect}`);
      }
    }
    expect(shared).toEqual([]);
  });

  test('no instance property takes the name of a method on the prototype', async () => {
    const methods = new Map();
    const setters = new Set();
    for (const [name, member] of classBody().effective) {
      methods.set(name, `the class's ${name} (${MAIN}:${member.line})`);
      if (member.set) setters.add(name);
    }
    for (const mixin of await composition()) {
      for (const key of Object.keys(mixin.object ?? {})) methods.set(key, `${mixin.exported}.${key}`);
    }
    const hiding = [];
    for (const field of classBody().fields) {
      if (methods.has(field.name)) {
        hiding.push(`${MAIN}:${field.line}: the class field ${field.name} hides ${methods.get(field.name)} on every instance`);
      }
    }
    const receivers = new Set();
    for (const { file, writes, dynamic } of scans()) {
      for (const write of writes) {
        receivers.add(write.receiver);
        // A write to a setter runs the setter, and a delete removes the instance's own property: neither
        // gives the instance a property of its own.
        if (methods.has(write.name) && !setters.has(write.name) && write.operator !== 'delete') {
          hiding.push(`${file}:${write.line}: ${writeShape(write)} gives the app its own ${write.name}, ` +
            `which hides ${methods.get(write.name)} from every later call`);
        }
      }
      for (const { shape, line } of dynamic.filter(({ shape }) => shape.startsWith('Object.'))) {
        hiding.push(`${file}:${line}: ${shape} gives the app properties whose names this check cannot read`);
      }
    }
    // Writes were read through both receivers, the class's `this` and a helper's `app`.
    expect([...receivers].sort()).toEqual(['app', 'this']);
    expect(hiding).toEqual([]);
  });

  test('every call made on the app by name reaches a method the composed app has', async () => {
    const reach = appCallables(classBody(), await composition(), scans());
    const receivers = new Set();
    const unresolved = new Map();
    for (const { file, calls } of scans()) {
      for (const { receiver, name, line, optional, guards } of calls) {
        receivers.add(receiver);
        if (reach.get(name)?.callable) continue;
        const call = `${receiver}.${name}${optional ? '?.' : ''}(`;
        if (!unresolved.has(`${file} ${call}`)) unresolved.set(`${file} ${call}`, { file, call, name, optional, occurrences: [] });
        unresolved.get(`${file} ${call}`).occurrences.push({ line, guards });
      }
    }
    // Calls were read through both receivers, the class's `this` and a helper's `app`.
    expect([...receivers].sort()).toEqual(['app', 'this']);

    const drift = [];
    for (const { file, dynamic } of scans()) {
      for (const { shape, line } of dynamic.filter(({ shape }) => !shape.startsWith('Object.'))) {
        drift.push(`${file}:${line}: ${shape} reaches the app by a computed name, which this check cannot follow`);
      }
    }
    for (const { file, call, name, optional, occurrences } of unresolved.values()) {
      const lines = occurrences.map(({ line }) => line);
      const listed = UNRESOLVED_CALLS.find(entry => entry.file === file && entry.call === call);
      if (!listed) {
        const reached = reach.get(name);
        drift.push(`${file}:${lines.join(', ')}: ${call} reaches ` + (reached
          ? `${reached.what}, which a call cannot run`
          : 'nothing the composed app has (no class method, mixin method or function the app stores on itself)') +
          (optional ? '; being optional, it silently does nothing' : ''));
      } else if (listed.count !== lines.length) {
        drift.push(`${file}: ${call} occurs ${lines.length} time(s), at line ${lines.join(', ')}; ` +
          `UNRESOLVED_CALLS expects ${listed.count}`);
      }
    }
    for (const listed of UNRESOLVED_CALLS) {
      if (!unresolved.has(`${listed.file} ${listed.call}`)) {
        drift.push(`UNRESOLVED_CALLS lists ${listed.call} in ${listed.file}, which no longer occurs there ` +
          'unresolved: remove the entry');
      }
    }
    // An entry that excuses a call as dead must still be right: each occurrence stays behind the early return
    // that keeps it dead, and nothing gives the app the property that return waits for.
    for (const { file, call, deadWithout: property } of UNRESOLVED_CALLS.filter(entry => entry.deadWithout)) {
      for (const { line, guards } of unresolved.get(`${file} ${call}`)?.occurrences ?? []) {
        if (!guards.includes(property)) {
          drift.push(`${file}:${line}: ${call} is not behind \`if (!this.${property}) return;\`, ` +
            'which UNRESOLVED_CALLS gives as the reason it never runs');
        }
      }
      const givers = [];
      const member = classBody().effective.get(property);
      if (member) givers.push(`${MAIN}:${member.line}: the class's member ${property}`);
      for (const field of classBody().fields.filter(({ name }) => name === property)) {
        givers.push(`${MAIN}:${field.line}: the class field ${property}`);
      }
      for (const mixin of await composition()) {
        if (Object.hasOwn(mixin.object ?? {}, property)) givers.push(`${mixin.exported}.${property}`);
      }
      for (const { file: at, writes } of scans()) {
        for (const write of writes.filter(({ name, operator }) => name === property && operator !== 'delete')) {
          givers.push(`${at}:${write.line}: ${writeShape(write)}`);
        }
      }
      for (const giver of givers) {
        drift.push(`${giver} gives the app ${property}, so the listener UNRESOLVED_CALLS calls dead can now reach ` +
          `${call} (${file})`);
      }
    }
    expect(drift).toEqual([]);
  });
});

describe('the TST-08 source reader', () => {
  test('calls and writes on the app are read from code, never from comments, strings, template text or regular expressions, and a computed reach is caught', () => {
    // The lines sit in a composed mixin's method that takes the app as `app`, since only there are `this` and
    // `app` the app. The wrapper shares the first and last lines, so every line keeps its number.
    const source = [
      'export const fixtureMixin = { method(app) { // this.inLineComment();',
      '/* this.inBlockComment(); */',
      "const quoted = 'this.inString()' + \"this.inDoubleString()\";",
      'const text = `this.inTemplateText() ${this.inTemplateCode()} ${`${this.nested()}`}`;',
      'const tested = /this.inRegex\\(/.test(quoted) ? half / 2 : this.afterDivision();',
      'this',
      '  .acrossLines();',
      'this.optional?.();',
      'this.service.method();',
      'app.viaHelper();',
      'other.app.notTheApp();',
      'this.handler = () => {};',
      'this.bound = this.method.bind(this);',
      'this.count += 1;',
      'this[name]();',
      'Object.assign(this, extra); } };',
    ].join('\n');
    const module = parseModule(source, 'fixture.js');
    const { calls, writes, dynamic } = appReferences(module, appContext(module, { mixins: ['fixtureMixin'] }));
    expect(calls.map(({ receiver, name, line, optional }) => `${line}:${receiver}.${name}${optional ? '?.' : ''}(`))
      .toEqual([
        '4:this.inTemplateCode(',
        '4:this.nested(',
        '5:this.afterDivision(',
        '6:this.acrossLines(',
        '8:this.optional?.(',
        '10:app.viaHelper(',
      ]);
    expect(writes.map(({ name, line, storesFunction }) => `${line}:${name}:${storesFunction}`))
      .toEqual(['12:handler:true', '13:bound:true', '14:count:false']);
    expect(dynamic.map(({ shape, line }) => `${line}:${shape}`)).toEqual(['15:this[…]', '16:Object.assign(this, …)']);
  });

  test('the composition is read through comments and line breaks, and refused in any shape it does not know', () => {
    const imports = "import { aMixin } from './app/a.js';\nimport { bMixin as renamed } from './app/b.js';\n";
    const read = body => composedMixins(parseModule(imports + body, 'main.js'));
    expect(read('Object.assign(\n  RoutePlotter.prototype, // the class\n  aMixin, /* first */\n  renamed,\n);'))
      .toEqual([
        { local: 'aMixin', exported: 'aMixin', specifier: './app/a.js', line: 5 },
        { local: 'renamed', exported: 'bMixin', specifier: './app/b.js', line: 6 },
      ]);
    expect(() => read('const mixins = [aMixin];')).toThrow(/RoutePlotter\.prototype is named 0 times/);
    expect(() => read('Object.assign(RoutePlotter.prototype, aMixin);\nRoutePlotter.prototype.extra = () => {};'))
      .toThrow(/main\.js:3, 4: RoutePlotter\.prototype is named 2 times/);
    expect(() => read('const proto = RoutePlotter.prototype;\nObject.assign(proto, aMixin);'))
      .toThrow(/not the first argument of a plain Object\.assign/);
    expect(() => read('function compose() { Object.assign(RoutePlotter.prototype, aMixin); }'))
      .toThrow(/not at module level/);
    expect(() => read('Object.assign(RoutePlotter.prototype, aMixin, ...more);'))
      .toThrow(/argument starting \.\.\. is not a plain imported name/);
    expect(() => read('Object.assign(RoutePlotter.prototype, aMixin.part);'))
      .toThrow(/argument starting aMixin is not a plain imported name/);
    expect(() => read('Object.assign(RoutePlotter.prototype, aMixin, cMixin);'))
      .toThrow(/cMixin is composed but not imported/);
    // Review round 1 (F1, F2): a composition that may not run as main.js loads, or the prototype reached
    // another way, is refused too.
    expect(() => read('const compose = () => Object.assign(\n  RoutePlotter.prototype,\n  aMixin,\n);'))
      .toThrow(/main\.js:4: Object\.assign\(RoutePlotter\.prototype, …\) is not at module level.*inside an arrow function/);
    expect(() => read('if (ready) Object.assign(RoutePlotter.prototype, aMixin);'))
      .toThrow(/main\.js:3: .*not at module level.*inside an if statement/);
    expect(() => read("Object.assign(RoutePlotter.prototype, aMixin);\nRoutePlotter['prototype'].play = null;"))
      .toThrow(/main\.js:3, 4: RoutePlotter\.prototype is named 2 times/);
    expect(() => read('Object.assign(RoutePlotter.prototype, aMixin);\nconst Plotter = RoutePlotter;'))
      .toThrow(/main\.js:4: RoutePlotter is used other than as new RoutePlotter\(\)/);
    expect(() => read('Object.assign(RoutePlotter.prototype, aMixin);\nclass RoutePlotter {}'))
      .toThrow(/main\.js:3: .*runs before class RoutePlotter is declared/);
    expect(() => read('const Object = globalThis.Object;\nObject.assign(RoutePlotter.prototype, aMixin);'))
      .toThrow(/main\.js:4: main\.js declares its own Object/);
    expect(read('class RoutePlotter {}\nObject.assign(RoutePlotter.prototype, aMixin);\nwindow.app = new RoutePlotter();'))
      .toEqual([{ local: 'aMixin', exported: 'aMixin', specifier: './app/a.js', line: 4 }]);
  });

  test('the class body is read member by member, and refused where a member could slip past', () => {
    const read = body => classMembers(parseModule(body, 'main.js'), 'RoutePlotter');
    const members = read([
      'class RoutePlotter {',
      '  constructor() { this.ready = true; }',
      '  static create() {}',
      '  async init() {}',
      '  *steps() {}',
      '  get size() { return 1; }',
      '  set size(value) {}',
      "  'quoted'() {}",
      '  get() {}',
      '  #secret() {}',
      '  count = { a: 1 };',
      '  static { this.registry = []; }',
      '}',
    ].join('\n'));
    const names = list => list.map(({ name, kind, line }) => `${line}:${kind}:${name}`);
    expect(names(members.prototype)).toEqual([
      '2:method:constructor', '4:method:init', '5:method:steps', '6:get:size', '7:set:size',
      '8:method:quoted', '9:method:get',
    ]);
    expect(names(members.statics)).toEqual(['3:method:create']);
    expect(names(members.privates)).toEqual(['10:method:#secret']);
    expect(names(members.fields)).toEqual(['11:field:count']);
    expect(members.effective.get('size')).toMatchObject({ kind: 'accessor', get: true, set: true, line: 7 });
    expect(() => read('class RoutePlotter extends Base {}')).toThrow(/without an extends clause/);
    // A computed name is read when it is a constant, as JavaScript reads it, and refused when it is not.
    expect(names(read("class RoutePlotter { ['render']() {} }").prototype)).toEqual(['1:method:render']);
    expect(() => read('class RoutePlotter { [name]() {} }')).toThrow(/main\.js:1: a computed member name/);
    // The parser inserts semicolons as JavaScript does, so a field with none cannot swallow the next member.
    const unterminated = read('class RoutePlotter {\n  ready = load()\n  render() {}\n}');
    expect([...names(unterminated.fields), ...names(unterminated.prototype)]).toEqual(['2:field:ready', '3:method:render']);
    expect(() => read('class Other {}')).toThrow(/no class RoutePlotter/);
    // Review round 1 (F5, F4): a member is read by the key JavaScript gives it, escaped or not, and of two
    // members with one key the later is what the prototype holds.
    const keyed = read([
      'class RoutePlotter {',
      "  'pl\\u0061y'() {}",
      '  [`queue`]() {}',
      '  0x10() {}',
      '  get size() { return 1; }',
      '  size() {}',
      '  load() {}',
      '  get load() { return null; }',
      "  'h\\u0069dden' = 1;",
      '  handler = () => {};',
      '}',
    ].join('\n'));
    expect(names(keyed.prototype)).toEqual([
      '2:method:play', '3:method:queue', '4:method:16', '5:get:size', '6:method:size', '7:method:load', '8:get:load',
    ]);
    expect(keyed.fields.map(({ name, line, storesFunction }) => `${line}:${name}:${storesFunction}`))
      .toEqual(['9:hidden:false', '10:handler:true']);
    expect([...keyed.effective].map(([name, { kind, get, set, line }]) => `${line}:${name}:${kind}${get ? ':get' : ''}${set ? ':set' : ''}`))
      .toEqual(['2:play:method', '3:queue:method', '4:16:method', '6:size:method', '8:load:accessor:get']);
  });

  test('source the parser cannot read is refused with its file and line', () => {
    const read = source => () => parseModule(source, 'fixture.js');
    expect(read("const a = 1;\nconst b = 'never closed;")).toThrow(/fixture\.js:2: the parser cannot read it: .*unterminated string/i);
    expect(read('const a = `never ${closed}')).toThrow(/fixture\.js:1: the parser cannot read it: .*unterminated/i);
    expect(read('/* never closed')).toThrow(/fixture\.js:1: the parser cannot read it: .*unterminated .*comment/i);
    expect(read('const a = /never closed;')).toThrow(/fixture\.js:1: the parser cannot read it: .*unterminated regular expression/i);
    expect(read('call(a]')).toThrow(/fixture\.js:1: the parser cannot read it: .*\]/);
    expect(read('function f() {\n')).toThrow(/fixture\.js:2: the parser cannot read it: .*EOF/);
    expect(read('const a = 1 \u00a7 2;')).toThrow(/fixture\.js:1: the parser cannot read it: .*character/i);
    // Its semantic checks are on: a name declared twice in one scope is refused, not read as one binding.
    expect(read('class RoutePlotter {}\nconst RoutePlotter = 1;')).toThrow(/fixture\.js:1: the parser cannot read it: .*already been declared/);
  });

  test('a composed mixin is refused wherever a module read changes it, and may still be called or read', () => {
    const main = "import { aMixin } from './app/a.js';\nclass RoutePlotter {}\nObject.assign(RoutePlotter.prototype, aMixin);\n";
    const check = ({ inMain = '', inMixin = '', elsewhere = '' }) => () => {
      const read = new Map([
        ['src/main.js', parseModule(main + inMain, 'src/main.js')],
        ['src/app/a.js', parseModule(`export const aMixin = { play() {} };\n${inMixin}`, 'src/app/a.js')],
        ['src/app/b.js', parseModule(elsewhere, 'src/app/b.js')],
      ]);
      unchangedMixins(read, 'src/main.js', composedMixins(read.get('src/main.js')));
    };
    expect(check({})).not.toThrow();
    expect(check({ inMain: 'aMixin.play();\nconst name = aMixin.play.name;' })).not.toThrow();
    expect(check({ inMain: 'aMixin.play = null;' }))
      .toThrow(/src\/main\.js:4: aMixin, a composed mixin, has a property written or deleted here/);
    expect(check({ inMixin: 'aMixin.extra = () => {};' }))
      .toThrow(/src\/app\/a\.js:2: aMixin, a composed mixin, has a property written or deleted here/);
    expect(check({ elsewhere: "import { aMixin } from './a.js';\ndelete aMixin.play;" }))
      .toThrow(/src\/app\/b\.js:2: aMixin, a composed mixin, has a property written or deleted here/);
    expect(check({ elsewhere: "import { aMixin as m } from './a.js';\nObject.assign(m, { play: null });" }))
      .toThrow(/src\/app\/b\.js:2: m, a composed mixin, is used as a value here/);
    expect(check({ elsewhere: "import * as a from './a.js';" })).toThrow(/src\/app\/b\.js:1: .*imported as a namespace/);
    expect(check({ elsewhere: "export { aMixin } from './a.js';" })).toThrow(/src\/app\/b\.js:1: .*re-exported/);
    expect(check({ elsewhere: "const later = import('./a.js');" })).toThrow(/src\/app\/b\.js:1: a module is imported dynamically here/);
    // Reading a mixin elsewhere, as src/player/PlayerApp.js does, changes nothing: it is copied from, and read by name.
    expect(check({
      elsewhere: "import { aMixin } from './a.js';\nclass Player {}\nObject.assign(Player.prototype, aMixin);\n" +
        'export const picked = { play: aMixin.play };',
    })).not.toThrow();
  });

  test('the app is read through parentheses, destructuring, ++, delete, for-of and tags, followed into a helper that takes it as app, and refused wherever else it goes', () => {
    const read = (body, before = '') => {
      const module = parseModule(`${before}export const fixtureMixin = {\n  method() {\n${body}\n  },\n};\n`, 'fixture.js');
      return appReferences(module, appContext(module, { mixins: ['fixtureMixin'] }));
    };
    const found = read([
      '(this).noSuchMethod();',
      '({ render: this.render } = {});',
      '[this.first, ...this.rest] = [];',
      '({ a: this.withDefault = 1 } = {});',
      'for (this.cursor of []) {}',
      'this.counter++;',
      'delete this.gone;',
      'this.tagged`text`;',
      'this.pl\\u0061y();',
      'Object.assign((this), {});',
      'const other = { init() { this.missingMethod = () => {}; this.notTheApp(); } };',
      'void [1].map(() => this.inArrow());',
      'this.handler = this.render.bind(this);',
    ].join('\n'));
    expect(found.calls.map(({ receiver, name, line }) => `${line}:${receiver}.${name}(`))
      .toEqual(['3:this.noSuchMethod(', '10:this.tagged(', '11:this.play(', '14:this.inArrow(']);
    expect(found.writes.map(({ name, line, operator }) => `${line}:${name}:${operator}`)).toEqual([
      '4:render:destructuring', '5:first:destructuring', '5:rest:destructuring', '6:withDefault:destructuring',
      '7:cursor:for-of', '8:counter:++', '9:gone:delete', '15:handler:=',
    ]);
    expect(found.dynamic.map(({ shape, line }) => `${line}:${shape}`)).toEqual(['12:Object.assign(this, …)']);

    // A helper that takes the app as its own `app` parameter is read as the app, parenthesised or not.
    const helped = read('resetFixture(this);', 'function resetFixture(app) {\n  (app).autoSave = false;\n  app.refresh?.();\n}\n');
    expect(helped.writes.map(({ receiver, name, line }) => `${line}:${receiver}.${name}`)).toEqual(['2:app.autoSave']);
    expect(helped.calls.map(({ receiver, name, line, optional }) => `${line}:${receiver}.${name}${optional ? '?.' : ''}(`))
      .toEqual(['3:app.refresh?.(']);
    expect(helped.handoffs.map(({ helper, line }) => `${line}:${helper}`)).toEqual(['7:resetFixture']);
    const mixin = parseModule("import { reset } from './helpers.js';\nexport const fixtureMixin = { method() { reset(this); } };", 'src/app/fixture.js');
    const helpers = parseModule('export function reset(app) {\n  app.render = null;\n}', 'src/app/helpers.js');
    const both = new Map([[mixin.file, mixin], [helpers.file, helpers]]);
    expect(appReferences(mixin, appContext(mixin, { modules: both, mixins: ['fixtureMixin'] })).handoffs)
      .toEqual([{ receiver: 'this', helper: 'reset', file: 'src/app/helpers.js', line: 2 }]);
    // The helper is looked up from the call: the name declared again in another method does not matter (as in
    // src/app/crowds.js, whose unstorable is also a local there), but a declaration around the call is not the helper.
    const scoped = lines => {
      const module = parseModule(['function reset(app) {}', 'export const fixtureMixin = {', ...lines, '};'].join('\n'), 'fixture.js');
      return () => appReferences(module, appContext(module, { mixins: ['fixtureMixin'] }));
    };
    expect(scoped(['  method() { reset(this); },', '  other() { const reset = null; return reset; },'])().handoffs
      .map(({ helper, line }) => `${line}:${helper}`)).toEqual(['3:reset']);
    expect(scoped(['  method() { function reset(host) {} reset(this); },']))
      .toThrow(/fixture\.js:3: the app is handed to reset, which is declared inside a function or block around the call/);

    // Where the reader cannot follow the app, it refuses, with the line.
    expect(() => read('const self = this;')).toThrow(/fixture\.js:3: this is used here as a value/);
    expect(() => read('const { render } = this;')).toThrow(/fixture\.js:3: this is used here as a value/);
    expect(() => read('Object.getPrototypeOf(this).render = null;'))
      .toThrow(/fixture\.js:3: this is used here as a value \(handed to Object\.getPrototypeOf\)/);
    expect(() => read('register(this);')).toThrow(/fixture\.js:3: the app is handed to register, which is not a function/);
    expect(() => read('loose(this);', 'function loose(host) {}\n'))
      .toThrow(/fixture\.js:4: the app is handed to loose, whose parameter there .* is not its own app/);
    expect(() => read('this.constructor.prototype.render = null;'))
      .toThrow(/fixture\.js:3: this\.constructor reaches the app's class or prototype/);
    expect(() => read('new this.Thing();')).toThrow(/fixture\.js:3: new this\.Thing/);
    expect(() => read('return function () { this.render(); };'))
      .toThrow(/fixture\.js:3: this in a function that is no object's or class's method/);
    expect(() => read('', 'const loose = () => this.render();\n')).toThrow(/fixture\.js:1: this at the top level of the module/);
    expect(() => read('', 'function helper(app) {\n  app = {};\n}\n')).toThrow(/fixture\.js:2: app is assigned here/);
    expect(() => read('', 'const app = window.app;\n'))
      .toThrow(/fixture\.js:1: app is declared here other than as a function's own parameter/);
    expect(() => read('', 'function helper({ app }) {}\n')).toThrow(/fixture\.js:1: app is declared here/);
    expect(() => read('', 'function helper() {\n  app.render();\n}\n'))
      .toThrow(/fixture\.js:2: app is used here, but no function around it takes app/);

    // In the app's class, `this` is the app in its own methods; in a static member it is the class itself,
    // and `super` reaches past the app: both refused. Another class's `this` is passed over.
    const inClass = source => () => {
      const module = parseModule(source, 'main.js');
      return appReferences(module, appContext(module, { className: 'RoutePlotter' }));
    };
    expect(inClass('class RoutePlotter {\n  render() { this.queueRender(); }\n  queueRender() {}\n}')().calls
      .map(({ name, line }) => `${line}:${name}`)).toEqual(['2:queueRender']);
    expect(inClass('class RoutePlotter {\n  static setup() { this.prototype.play = null; }\n}'))
      .toThrow(/main\.js:2: this in a static member of the app's class/);
    expect(inClass('class RoutePlotter {\n  render() { super.render = null; }\n}'))
      .toThrow(/main\.js:2: super in a method of the app/);
    expect(inClass('class Other {\n  static setup() { this.prototype.play = null; }\n}\nclass RoutePlotter {}')().writes)
      .toEqual([]);
  });

  test("a call is certified only by a function: a later getter, a later write that is not one, a value that only looks like one, or another object's write never certifies it", () => {
    const module = parseModule([
      'export const fixtureMixin = {',
      '  method() {',
      '    this.arrow = () => {};',
      '    this.expression = function () {};',
      '    this.bound = this.method.bind(this);',
      '    this.invoked = this.method.bind(this)();',
      '    const async = false;',
      '    this.notAsync = async;',
      '    this.realAsync = async () => {};',
      '    this.later = () => {};',
      '    this.later = null;',
      '    this.removed = () => {};',
      '    delete this.removed;',
      '    this.tally ||= () => {};',
      '    const other = { init() { this.elsewhere = () => {}; } };',
      '  },',
      '};',
    ].join('\n'), 'fixture.js');
    const { writes } = appReferences(module, appContext(module, { mixins: ['fixtureMixin'] }));
    expect(writes.map(({ name, line, storesFunction }) => `${line}:${name}:${storesFunction}`)).toEqual([
      '3:arrow:true', '4:expression:true', '5:bound:true', '6:invoked:false', '8:notAsync:false',
      '9:realAsync:true', '10:later:true', '11:later:false', '12:removed:true', '13:removed:false', '14:tally:false',
    ]);
    const body = classMembers(parseModule([
      'class RoutePlotter {',
      '  constructor() {}',
      '  queueRender() {}',
      '  get queueRender() { return null; }',
      '  render() {}',
      '  callback = () => {};',
      '  flag = true;',
      '}',
    ].join('\n'), 'main.js'), 'RoutePlotter');
    const mixins = [{ exported: 'fixtureMixin', object: { method() {}, notAFunction: 1 } }];
    const reach = appCallables(body, mixins, [{ file: 'fixture.js', writes }]);
    const runs = list => list.filter(name => reach.get(name)?.callable);
    const callable = ['render', 'method', 'arrow', 'expression', 'bound', 'realAsync', 'callback', 'toString'];
    expect(runs(callable)).toEqual(callable);
    expect(runs(['queueRender', 'invoked', 'notAsync', 'later', 'removed', 'tally', 'elsewhere', 'flag',
      'notAFunction', 'constructor', 'missing'])).toEqual([]);
  });

  test('a call records the early returns before it, so a call excused as dead is held to its reason', () => {
    const module = parseModule([
      'export const fixtureMixin = {',
      '  method() {',
      "    this.eventBus.on('ready', () => {",
      '      if (!this.backgroundImage) return;',
      '      this.guarded();',
      '    });',
      '    this.unguarded();',
      '    if (!this.ready) { return; }',
      '    if (this.other) return;',
      '    this.afterReady();',
      '  },',
      '};',
    ].join('\n'), 'fixture.js');
    const { calls } = appReferences(module, appContext(module, { mixins: ['fixtureMixin'] }));
    expect(calls.map(({ name, guards }) => `${name}:${guards.join(',')}`))
      .toEqual(['guarded:backgroundImage', 'unguarded:', 'afterReady:ready']);
  });

  /*
   * Review round 2 (of 8558e26) found thirteen probes on the real src/ that passed every guard. Each is kept
   * here as a fixture, numbered as the review numbers it (Q01–Q19; Q18 is its control, refused all along), in a
   * small src/ held in memory: main.js composes aMixin from src/app/a.js and publishes the app as window.app,
   * and each fixture adds its probe. readProbe() reads that src/ as the four composition tests read the real
   * one, and throws where they would refuse it; `unresolved` lists the calls on the app the call test would.
   */
  const readProbe = ({
    imports = '', inClass = '', beforeCompose = '', afterPublish = '', beforeMixin = '', inMethod = '', mixin, files = {},
  } = {}) => {
    const sources = {
      'src/main.js': [
        "import { aMixin } from './app/a.js';", imports,
        'class RoutePlotter {', inClass, '  render() {}', '}',
        beforeCompose,
        'Object.assign(RoutePlotter.prototype, aMixin);',
        "document.addEventListener('DOMContentLoaded', () => {", '  window.app = new RoutePlotter();', afterPublish, '});',
      ].join('\n'),
      'src/app/a.js': mixin ?? [beforeMixin, 'export const aMixin = {', '  play() {},', '  update() {', inMethod, '  },', '};'].join('\n'),
      ...files,
    };
    const read = new Map(Object.entries(sources).map(([file, source]) => [file, parseModule(source, file)]));
    const mixins = composedMixins(read.get('src/main.js'));
    unchangedMixins(read, 'src/main.js', mixins);
    untouchedObject(read);
    const appModules = new Map([...read].filter(([file]) => file === 'src/main.js' || file.startsWith('src/app/')));
    const scanned = [...appModules.values()].map(module => ({
      file: module.file,
      ...appReferences(module, appContext(module, {
        modules: appModules,
        className: module.file === 'src/main.js' ? 'RoutePlotter' : null,
        mixins: mixins.filter(each => moduleFile('src/main.js', each.specifier) === module.file).map(each => each.exported),
      })),
    }));
    // Each mixin as importing it would give it: a function under each key its object literal writes.
    const objects = mixins.map(each => {
      const [literal] = mixinLiterals(read.get(moduleFile('src/main.js', each.specifier)), [each.exported]);
      return { ...each, object: Object.fromEntries(literal.properties.map(property => [keyName(property.key, property.computed), () => {}])) };
    });
    const reach = appCallables(classMembers(read.get('src/main.js'), 'RoutePlotter'), objects, scanned);
    const unresolved = scanned.flatMap(({ calls }) => calls.filter(({ name }) => !reach.get(name)?.callable))
      .map(({ receiver, name }) => `${receiver}.${name}(`);
    return { reach, unresolved };
  };

  test('review round 2: the probe fixture reads clean as it stands, so each refusal below is its probe\'s', () => {
    expect(readProbe().unresolved).toEqual([]);
  });

  test('review round 2 (F1): a dynamic import is found in the parsed code however it is spelt, in a module that imports no mixin (Q17, Q18)', () => {
    const poisoning = load => readProbe({
      imports: "import { poisonMixin } from './utils/poison.js';",
      beforeCompose: 'await poisonMixin();',
      files: {
        'src/utils/poison.js': `export function poisonMixin() {\n  return ${load}\n    .then(({ aMixin: mix }) => { mix.play = null; });\n}\n`,
      },
    });
    for (const load of [
      "import /* gap */ ('../app/a.js')", // Q17: passed every guard
      "import('../app/a.js')", // Q18: its control
      "import\n  ('../app/a.js')",
      'import(`../app/a.js`)',
    ]) {
      expect(() => poisoning(load), load).toThrow(/src\/utils\/poison\.js:2: a module is imported dynamically here/);
    }
    // Only code is read as an import: the same words in a comment or a string are not one.
    expect(() => poisoning("/* import('../app/a.js') */ Promise.resolve({ aMixin: {} })")).not.toThrow();
    expect(() => poisoning("Promise.resolve({ aMixin: {}, text: \"import('../app/a.js')\" })")).not.toThrow();
  });

  test('review round 2 (F2): a composed mixin exported under a second name, or from a module that is not its own, is refused (Q07)', () => {
    // Q07: passed every guard.
    expect(() => readProbe({
      beforeMixin: 'export { aMixin as forwarded };',
      imports: "import { forwarded } from './app/a.js';",
      beforeCompose: 'forwarded.play = null;',
    })).toThrow(/src\/app\/a\.js:1: aMixin, a composed mixin, is exported here as forwarded, a second name/);
    expect(() => readProbe({ beforeMixin: 'export { aMixin as default };' }))
      .toThrow(/src\/app\/a\.js:1: aMixin, a composed mixin, is exported here as default/);
    expect(() => readProbe({ files: { 'src/app/b.js': "import { aMixin } from './a.js';\nexport { aMixin };" } }))
      .toThrow(/src\/app\/b\.js:2: aMixin, a composed mixin, is exported here as aMixin/);
    // Its own module exporting it under its own name is the export composed.
    expect(() => readProbe({ mixin: 'const aMixin = {\n  play() {},\n};\nexport { aMixin };' })).not.toThrow();
  });

  test('review round 2 (F3): a helper is read as the app\'s only where it is: not past arguments, a name assigned again, or an app parameter no call hands the app (Q02, Q03, Q09)', () => {
    // Q02: the app written through the arguments of a helper that takes it, directly or from an arrow inside.
    expect(() => readProbe({ beforeMixin: 'function poison(app) { arguments[0].render = null; }', inMethod: 'poison(this);' }))
      .toThrow(/src\/app\/a\.js:1: arguments in a function that takes the app as app holds the app past that name/);
    expect(() => readProbe({
      beforeMixin: 'function poison(app) { [0].forEach(() => { arguments[0].render = null; }); }',
      inMethod: 'poison(this);',
    })).toThrow(/src\/app\/a\.js:1: arguments in a function that takes the app/);
    // A function that does not take the app may count its arguments.
    expect(() => readProbe({ beforeMixin: 'function count() { return arguments.length; }' })).not.toThrow();

    // Q03: the helper's name assigned another function before the app is handed to it, where it is called or
    // where it is declared.
    expect(() => readProbe({ beforeMixin: 'function poison(app) {}\npoison = host => { host.render = null; };', inMethod: 'poison(this);' }))
      .toThrow(/src\/app\/a\.js:6: the app is handed to poison, whose name poison is assigned again at src\/app\/a\.js:2/);
    expect(() => readProbe({
      beforeMixin: "import { reset } from './helpers.js';",
      inMethod: 'reset(this);',
      files: { 'src/app/helpers.js': 'export function reset(app) {}\nreset = host => { host.render = null; };' },
    })).toThrow(/the app is handed to reset, whose name reset is assigned again at src\/app\/helpers\.js:2/);

    // Q09: a function stored through the app parameter of a helper handed something else certifies no call.
    const preparing = 'function prepareOther(app) { app.ghost = () => {}; }\nprepareOther({});';
    const other = readProbe({ beforeMixin: preparing, inMethod: 'this.ghost();' });
    expect(other.unresolved).toEqual(['this.ghost(']);
    expect(other.reach.get('ghost').what).toMatch(/src\/app\/a\.js:1 writes the app parameter of a function no call read hands the app/);
    // Handed the app too, it stores the function on the app.
    expect(readProbe({ beforeMixin: preparing, inMethod: 'prepareOther(this);\nthis.ghost();' }).unresolved).toEqual([]);
  });

  test('review round 2 (F4): a .bind(…) certifies a call only when it is Function.prototype.bind of a function (Q01)', () => {
    // Q01: an object's own method named bind returns anything.
    const custom = readProbe({
      inMethod: 'const source = { bind() { return null; } };\nthis.brokenCallback = source.bind();\nthis.brokenCallback();',
    });
    expect(custom.unresolved).toEqual(['this.brokenCallback(']);
    // The bound copy of a function written there, or of a method the app has, is a function; of a name the app
    // lacks it is not.
    expect(readProbe({
      inMethod: 'this.boundPlay = this.play.bind(this);\nthis.boundPlay();\nthis.boundArrow = (() => {}).bind(null);\nthis.boundArrow();',
    }).unresolved).toEqual([]);
    expect(readProbe({ inMethod: 'this.boundGhost = this.ghost.bind(this);\nthis.boundGhost();' }).unresolved)
      .toEqual(['this.boundGhost(']);
  });

  test('review round 2 (F5): Object.prototype\'s members that change or hand on their object are refused on the app and on a composed mixin (Q05, Q06, Q14, Q15)', () => {
    // Q05 and Q15: an own getter hides the class's render; valueOf() hands on the app, which the write then hides.
    expect(() => readProbe({ inMethod: "this.__defineGetter__('render', () => null);" }))
      .toThrow(/src\/app\/a\.js:5: this\.__defineGetter__ is Object\.prototype's __defineGetter__, which changes the app/);
    expect(() => readProbe({ inMethod: 'this.valueOf().render = null;' }))
      .toThrow(/src\/app\/a\.js:5: this\.valueOf is Object\.prototype's valueOf/);
    // Q14: a getter gives the app what keeps the excused dead listener dead.
    expect(() => readProbe({
      inMethod: [
        "this.eventBus.on('waypoint:add-at-center', () => {",
        "  this.__defineGetter__('backgroundImage', () => ({ width: 10, height: 10 }));",
        '  if (!this.backgroundImage) return;',
        '  this.generatePathData();',
        '});',
      ].join('\n'),
    })).toThrow(/src\/app\/a\.js:6: this\.__defineGetter__ is Object\.prototype's __defineGetter__/);
    expect(() => readProbe({ beforeMixin: "function poison(app) { app.__defineSetter__('render', () => {}); }", inMethod: 'poison(this);' }))
      .toThrow(/src\/app\/a\.js:1: app\.__defineSetter__ is Object\.prototype's __defineSetter__/);
    // Q06: a getter on the mixin is what Object.assign copies.
    expect(() => readProbe({ beforeCompose: "aMixin.__defineGetter__('play', () => null);" }))
      .toThrow(/src\/main\.js:7: aMixin, a composed mixin, is reached here through Object\.prototype's __defineGetter__/);
    // The members that only read their object stay open to both.
    expect(readProbe({ inMethod: "this.hasOwnProperty('play');\nthis.toString();" }).unresolved).toEqual([]);
    expect(() => readProbe({ beforeCompose: "aMixin.hasOwnProperty('play');" })).not.toThrow();
  });

  test('review round 2 (F6): the built-in Object, whose assign composes the app, is refused wherever src/ could change it (Q04)', () => {
    // Q04: passed every guard, and the composition then copied nothing.
    expect(() => readProbe({ beforeCompose: 'Object.assign = () => {};' }))
      .toThrow(/src\/main\.js:7: Object\.assign is written here, so Object\.assign\(RoutePlotter\.prototype, …\) may not be the built-in/);
    expect(() => readProbe({ files: { 'src/utils/patch.js': 'Object.assign = () => {};' } }))
      .toThrow(/src\/utils\/patch\.js:1: Object\.assign is written here/);
    expect(() => readProbe({ beforeCompose: 'delete Object.assign;' })).toThrow(/src\/main\.js:7: Object\.assign is written here/);
    expect(() => readProbe({ beforeCompose: "Object.defineProperty(Object, 'assign', { value() {} });" }))
      .toThrow(/src\/main\.js:7: the global Object is used here as a value \(handed to Object\.defineProperty\)/);
    expect(() => readProbe({ beforeCompose: 'const { assign } = Object;' }))
      .toThrow(/src\/main\.js:7: the global Object is used here as a value/);
    expect(() => readProbe({ beforeCompose: 'globalThis.Object.assign = () => {};' }))
      .toThrow(/src\/main\.js:7: the global Object is reached here through another object/);
    expect(() => readProbe({ beforeCompose: "Object.__defineGetter__('assign', () => () => {});" }))
      .toThrow(/src\/main\.js:7: Object\.__defineGetter__ is not one of the built-in Object's own members/);
    expect(() => readProbe({ beforeCompose: "Object.prototype.__defineSetter__('play', () => {});" }))
      .toThrow(/src\/main\.js:7: Object\.prototype is used here other than read through a member that only reads it/);
    // Its own members read or called, and Object.prototype read through one that only reads, or compared, change nothing.
    expect(() => readProbe({
      beforeCompose: "const own = [Object.keys({}), Object.freeze({}), Object.prototype.hasOwnProperty.call({}, 'a'), " +
        'Object.getPrototypeOf({}) === Object.prototype, {} instanceof Object];',
    })).not.toThrow();
  });

  test('review round 2 (F7): in the files read for the app, window.app is refused but where main.js publishes it; past them it is not read (Q16, Q19)', () => {
    // Q16 and Q19: passed every guard, in main.js's own DOM-ready callback.
    expect(() => readProbe({ afterPublish: '  window.app.constructor.prototype.play = null;' }))
      .toThrow(/src\/main\.js:11: window\.app is the app main\.js publishes, which the reader does not follow/);
    expect(() => readProbe({ afterPublish: '  window.app.render = null;' }))
      .toThrow(/src\/main\.js:11: window\.app is the app main\.js publishes/);
    // However the global object is named or the alias spelt, and in a mixin too.
    expect(() => readProbe({ afterPublish: "  globalThis['app'].render = null;" })).toThrow(/src\/main\.js:11: globalThis\.app is the app/);
    expect(() => readProbe({ inMethod: 'self.app.play();' })).toThrow(/src\/app\/a\.js:5: self\.app is the app/);
    expect(() => readProbe({ inMethod: 'window[name].render = null;' })).toThrow(/src\/app\/a\.js:5: window\[…\] may reach the app/);
    expect(() => readProbe({ afterPublish: '  const w = window;\n  w.app.render = null;' }))
      .toThrow(/src\/main\.js:11: window is used here as a value \(the value of a declaration\)/);
    // The publication itself, the global object's other members, and the global object handed to a service the
    // app holds (main.js hands window to its storage service), as any service call, are read and pass.
    expect(() => readProbe({
      inClass: '  constructor() { this.storageService.attachLifecycle(window); }',
      inMethod: "window.addEventListener('resize', () => this.play());\nconst ratio = window.devicePixelRatio;",
    })).not.toThrow();
    // Past main.js and src/app/, the reader reads no reach of the app: there window.app is not checked, the stated
    // exclusion. This pins where that exclusion begins.
    expect(() => readProbe({ files: { 'src/ui/panel.js': 'export const poke = () => { window.app.render = null; };' } }))
      .not.toThrow();
  });
});

// ----- The TST-08 reader -----

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const PATTERNS = new Set(['ObjectPattern', 'ArrayPattern', 'AssignmentPattern', 'RestElement']);

/** The members every object inherits from Object.prototype that only read it, and so change nothing and return it to no one. */
const READ_ONLY_INHERITED = new Set(['hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toString', 'toLocaleString']);

/**
 * The rest of Object.prototype's members: `constructor` and `__proto__` reach
 * past the object, `valueOf()` returns it, `__lookupGetter__` and
 * `__lookupSetter__` hand on its accessors, and `__defineGetter__` and
 * `__defineSetter__` change it with no write the reader would see. Review
 * round 2 (F5): on the app or a composed mixin, each is refused.
 */
const REFLECTIVE = new Set(Object.getOwnPropertyNames(Object.prototype).filter(name => !READ_ONLY_INHERITED.has(name)));

/** The names a browser module reaches its global object by, through which the app main.js publishes is `window.app`. */
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self', 'top', 'parent', 'frames']);

/** A reader's refusal: where, what it met, and what to do instead of loosening the guard. */
function unreadable(file, line, what) {
  return new Error(`${file}${line ? `:${line}` : ''}: ${what}. The TST-08 reader in tests/mixins.test.js ` +
    'does not know this shape: teach it the shape, rather than loosen the guard');
}

/**
 * A module parsed into an ESTree program: `{ file, source, program, lineOf }`,
 * where `lineOf(node)` is the line the node starts on. The parser's semantic
 * checks are on, so a name declared twice in one scope is refused rather than
 * read as one binding. Source it cannot read is refused with its file and line.
 */
function parseModule(source, file) {
  let program;
  try {
    program = parseAst(source, { sourceType: 'module', showSemanticErrors: true }, file);
  } catch (error) {
    // The message's first line counts the errors; the second is the first of them.
    const reason = error.message.split('\n')[1] ?? error.message;
    throw unreadable(file, error.loc?.line, `the parser cannot read it: ${reason}`);
  }
  const lineStarts = [0];
  for (let at = source.indexOf('\n'); at !== -1; at = source.indexOf('\n', at + 1)) lineStarts.push(at + 1);
  // Node offsets count UTF-16 code units, as string indices do.
  const lineOf = node => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (lineStarts[middle] <= node.start) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
  return { file, source, program, lineOf };
}

/**
 * Visit every node under `root`, itself included, with its path: `path` holds
 * the nodes from the root to it, `keys` the property each hangs from in the one
 * before. A shorthand `{ app }` is visited twice, as its key and as its value.
 */
function walk(root, visit) {
  const path = [];
  const keys = [];
  const step = (node, key) => {
    path.push(node);
    keys.push(key);
    visit(node, path, keys);
    for (const [childKey, value] of Object.entries(node)) {
      for (const child of Array.isArray(value) ? value : [value]) {
        if (typeof child?.type === 'string') step(child, childKey);
      }
    }
    path.pop();
    keys.pop();
  };
  step(root, null);
}

/** The repository path a relative import resolves to; null for a package. */
const moduleFile = (from, specifier) => (specifier.startsWith('.') ? posix.join(posix.dirname(from), specifier) : null);

/**
 * The name a key spells, as JavaScript reads it: an identifier's, a literal's
 * value (escapes decoded, a number in its canonical form), or a constant
 * computed key's. Undefined for a key computed from anything else.
 */
function keyName(key, computed = false) {
  if (key.type === 'PrivateIdentifier') return `#${key.name}`;
  if (key.type === 'Identifier') return computed ? undefined : key.name;
  if (key.type === 'Literal' && !key.regex) return key.bigint ?? String(key.value);
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) return key.quasis[0].value.cooked ?? undefined;
  return undefined;
}

/** Whether the node at `path[index]` is part of a destructuring pattern, not a default value or computed key in one. */
function inPattern(path, keys, index) {
  const parent = path[index - 1];
  if (parent.type === 'AssignmentPattern') return keys[index] === 'left';
  if (parent.type === 'Property') return keys[index] === 'value' && path[index - 2]?.type === 'ObjectPattern';
  return PATTERNS.has(parent.type);
}

/**
 * What the identifier at the end of `path` is: a `name` that is no variable (a
 * property, key, label or export name); a `binding` a declaration makes, with
 * the node that `owner`s it and whether it is `direct`, the whole parameter or
 * declarator rather than part of a pattern; an assignment `target`; or a
 * `reference`.
 */
function identifierRole(path, keys) {
  const last = path.length - 1;
  const parent = path[last - 1];
  const key = keys[last];
  if (!parent) return { role: 'reference' };
  const named = (parent.type === 'MemberExpression' && key === 'property' && !parent.computed)
    || (['Property', 'MethodDefinition', 'PropertyDefinition', 'ImportAttribute'].includes(parent.type) && key === 'key'
      && !parent.computed)
    || ['LabeledStatement', 'BreakStatement', 'ContinueStatement', 'MetaProperty', 'ExportAllDeclaration'].includes(parent.type)
    || (parent.type === 'ExportSpecifier' && key === 'exported')
    || (parent.type === 'ImportSpecifier' && key === 'imported');
  if (named) return { role: 'name' };
  if (parent.type.startsWith('Import') && key === 'local') return { role: 'binding', owner: parent, direct: true };
  let index = last;
  while (index > 0 && inPattern(path, keys, index)) index -= 1;
  const owner = path[index - 1];
  const via = keys[index];
  const direct = index === last;
  if (FUNCTIONS.has(owner.type) && via === 'params') return { role: 'binding', owner, direct };
  if ((FUNCTIONS.has(owner.type) || owner.type.startsWith('Class')) && via === 'id') return { role: 'binding', owner, direct: false };
  if ((owner.type === 'VariableDeclarator' && via === 'id') || (owner.type === 'CatchClause' && via === 'param')) {
    return { role: 'binding', owner, direct };
  }
  if ((owner.type === 'AssignmentExpression' && via === 'left') || owner.type === 'UpdateExpression'
    || (['ForInStatement', 'ForOfStatement'].includes(owner.type) && via === 'left')) return { role: 'target', owner };
  return { role: 'reference' };
}

/** The names a declaration pattern binds. */
function patternNames(pattern) {
  if (pattern?.type === 'Identifier') return [pattern.name];
  if (pattern?.type === 'ObjectPattern') {
    return pattern.properties.flatMap(property => patternNames(property.type === 'RestElement' ? property.argument : property.value));
  }
  if (pattern?.type === 'ArrayPattern') return pattern.elements.flatMap(patternNames);
  if (pattern?.type === 'AssignmentPattern') return patternNames(pattern.left);
  if (pattern?.type === 'RestElement') return patternNames(pattern.argument);
  return [];
}

/** The names `var` declares among some statements, which belong to the function or module around them. */
function varNames(statements) {
  const names = [];
  const visit = node => {
    if (FUNCTIONS.has(node.type) || node.type.startsWith('Class')) return;
    if (node.type === 'VariableDeclaration' && node.kind === 'var') {
      names.push(...node.declarations.flatMap(declarator => patternNames(declarator.id)));
    }
    for (const value of Object.values(node)) {
      for (const child of Array.isArray(value) ? value : [value]) if (typeof child?.type === 'string') visit(child);
    }
  };
  statements.forEach(visit);
  return names;
}

/** The names some statements declare for the block that holds them: `let`, `const`, classes, functions, imports. */
function lexicalNames(statements) {
  return statements.flatMap(statement => {
    const declaration = statement.type.startsWith('Export') ? statement.declaration : statement;
    if (declaration?.type === 'VariableDeclaration') {
      return declaration.kind === 'var' ? [] : declaration.declarations.flatMap(declarator => patternNames(declarator.id));
    }
    if (declaration?.type === 'FunctionDeclaration' || declaration?.type === 'ClassDeclaration') return [declaration.id.name];
    if (declaration?.type === 'ImportDeclaration') return declaration.specifiers.map(specifier => specifier.local.name);
    return [];
  });
}

const scopeNames = new WeakMap();

/** The names a node declares as a scope: none for a node that is not one. */
function declaredBy(node) {
  if (!scopeNames.has(node)) {
    const loop = node.type === 'ForStatement' ? node.init : node.left;
    const names = {
      Program: () => [...lexicalNames(node.body), ...varNames(node.body)],
      BlockStatement: () => lexicalNames(node.body),
      StaticBlock: () => lexicalNames(node.body),
      SwitchStatement: () => lexicalNames(node.cases.flatMap(each => each.consequent)),
      CatchClause: () => patternNames(node.param),
      ClassDeclaration: () => (node.id ? [node.id.name] : []),
      ClassExpression: () => (node.id ? [node.id.name] : []),
    }[node.type]?.() ?? (FUNCTIONS.has(node.type)
      ? [...node.params.flatMap(patternNames), ...(node.type === 'FunctionExpression' && node.id ? [node.id.name] : []),
        ...(node.body.type === 'BlockStatement' ? varNames(node.body.body) : [])]
      : (['ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type) && loop?.type === 'VariableDeclaration'
        && loop.kind !== 'var' ? loop.declarations.flatMap(declarator => patternNames(declarator.id)) : []));
    scopeNames.set(node, new Set(names));
  }
  return scopeNames.get(node);
}

/** The scope that binds `name` where `path` ends, nearest first: null when nothing in the module does. */
function scopeOf(path, name) {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    if (declaredBy(path[index]).has(name)) return path[index];
  }
  return null;
}

/** A module's static imports: each local name, with the name it is exported under and its specifier. */
function importsOf(module) {
  const imports = new Map();
  for (const statement of module.program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    for (const specifier of statement.specifiers) {
      const exported = { ImportDefaultSpecifier: 'default', ImportNamespaceSpecifier: '*' }[specifier.type]
        ?? keyName(specifier.imported);
      imports.set(specifier.local.name, { exported, specifier: statement.source.value });
    }
  }
  return imports;
}

/** The class a module declares at its top level under `name`, if it does. */
function topLevelClass(module, name) {
  for (const statement of module.program.body) {
    const declaration = statement.type.startsWith('Export') ? statement.declaration : statement;
    if (declaration?.type === 'ClassDeclaration' && declaration.id?.name === name) return declaration;
  }
  return null;
}

/** The declarator, function or class a declaration makes `name` with, if it does. */
const definitionIn = (declaration, name) => (declaration.type === 'VariableDeclaration'
  ? declaration.declarations.find(declarator => declarator.id.type === 'Identifier' && declarator.id.name === name)
  : (['FunctionDeclaration', 'ClassDeclaration'].includes(declaration.type) && declaration.id?.name === name
    ? declaration : undefined));

/**
 * The node a module defines its export `exported` with: a declarator, function
 * or class (`export const`, `export function`, or a top-level one named in
 * `export { … }`), or a default export's declaration. Null when it re-exports
 * the name from elsewhere, or does not export it.
 */
function exportDefinition(module, exported) {
  const topLevel = name => {
    for (const statement of module.program.body) {
      const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
      const found = declaration && definitionIn(declaration, name);
      if (found) return found;
    }
    return null;
  };
  for (const statement of module.program.body) {
    if (statement.type === 'ExportDefaultDeclaration' && exported === 'default') return statement.declaration;
    if (statement.type !== 'ExportNamedDeclaration') continue;
    const declared = statement.declaration && definitionIn(statement.declaration, exported);
    if (declared) return declared;
    const specifier = statement.specifiers.find(candidate => keyName(candidate.exported) === exported);
    if (specifier) return statement.source ? null : topLevel(keyName(specifier.local));
  }
  return null;
}

/**
 * The function `name` means in a module: a function it declares at its top
 * level, or one it imports, by name or as its default, from a module in
 * `modules`, following `export { … }` and re-exports there.
 */
function functionNamed(modules, module, name, seen = new Set()) {
  if (seen.has(`${module.file} ${name}`)) return null;
  seen.add(`${module.file} ${name}`);
  for (const statement of module.program.body) {
    const declaration = statement.type.startsWith('Export') ? statement.declaration : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name === name) return { module, node: declaration };
    if (statement.type !== 'ImportDeclaration') continue;
    const specifier = statement.specifiers.find(candidate => candidate.local.name === name);
    if (!specifier) continue;
    const from = modules.get(moduleFile(module.file, statement.source.value));
    if (!from || specifier.type === 'ImportNamespaceSpecifier') return null;
    return exportedFunction(modules, from, specifier.type === 'ImportDefaultSpecifier' ? 'default' : keyName(specifier.imported), seen);
  }
  return null;
}

/** The function a module exports as `exported`, following `export { … }` and re-exports within `modules`. */
function exportedFunction(modules, module, exported, seen) {
  for (const statement of module.program.body) {
    if (statement.type === 'ExportDefaultDeclaration' && exported === 'default') {
      return statement.declaration.type === 'FunctionDeclaration' ? { module, node: statement.declaration } : null;
    }
    if (statement.type !== 'ExportNamedDeclaration') continue;
    if (statement.declaration?.type === 'FunctionDeclaration' && statement.declaration.id.name === exported) {
      return { module, node: statement.declaration };
    }
    const specifier = statement.specifiers.find(candidate => keyName(candidate.exported) === exported);
    if (!specifier) continue;
    if (!statement.source) return functionNamed(modules, module, keyName(specifier.local), seen);
    const from = modules.get(moduleFile(module.file, statement.source.value));
    return from ? exportedFunction(modules, from, keyName(specifier.local), seen) : null;
  }
  return null;
}

/** Where a node sits, for a refusal: inside the nearest function, or else the nearest condition, loop or block. */
function placeOf(ancestors) {
  const nearestFirst = [...ancestors].reverse();
  const inFunction = nearestFirst.find(node => FUNCTIONS.has(node.type));
  if (inFunction) return inFunction.type === 'ArrowFunctionExpression' ? 'inside an arrow function' : 'inside a function';
  const node = nearestFirst.find(each => each.type !== 'ExpressionStatement');
  return {
    IfStatement: 'inside an if statement',
    ConditionalExpression: 'inside a condition',
    LogicalExpression: 'inside a condition',
    SwitchStatement: 'inside a switch',
    TryStatement: 'inside a try statement',
    BlockStatement: 'inside a block',
  }[node?.type] ?? `part of a ${node?.type ?? 'larger statement'}`;
}

/**
 * main.js's composition: the call `Object.assign(RoutePlotter.prototype, …)`
 * and the mixins it composes, each `{ local, exported, specifier, line }`
 * through its import. Throws, rather than return a shorter list, unless that
 * call is the one place RoutePlotter.prototype is reached (bracketed or not),
 * it runs as the file loads (a statement of its own at module level, after the
 * class, through the built-in Object), RoutePlotter is otherwise only
 * constructed, and each argument is a plain name imported from a file.
 */
function findComposition(module) {
  const { file, program, lineOf } = module;
  const mentions = [];
  const otherUses = [];
  walk(program, (node, path, keys) => {
    if (node.type !== 'Identifier' || node.name !== 'RoutePlotter') return;
    const { role } = identifierRole(path, keys);
    if (role === 'name' || role === 'binding') return;
    const parent = path.at(-2);
    const key = keys.at(-1);
    if (parent.type === 'MemberExpression' && key === 'object' && keyName(parent.property, parent.computed) === 'prototype') {
      mentions.push({ path: path.slice(0, -1), keys: keys.slice(0, -1) });
    } else if (!(parent.type === 'NewExpression' && key === 'callee')) {
      otherUses.push(node);
    }
  });
  if (mentions.length !== 1) {
    throw unreadable(file, mentions.map(({ path }) => lineOf(path.at(-1))).join(', '),
      `RoutePlotter.prototype is named ${mentions.length} times, where the reader expects it once, ` +
      'in Object.assign(RoutePlotter.prototype, …)');
  }
  if (otherUses.length > 0) {
    throw unreadable(file, lineOf(otherUses[0]), 'RoutePlotter is used other than as new RoutePlotter() or in ' +
      'Object.assign(RoutePlotter.prototype, …), so the reader cannot follow what reaches its prototype');
  }
  const [{ path, keys }] = mentions;
  const member = path.at(-1);
  const call = path.at(-2);
  const callee = call.callee;
  const shaped = call.type === 'CallExpression' && keys.at(-1) === 'arguments' && call.arguments[0] === member
    && !member.computed && !call.optional && callee.type === 'MemberExpression' && !callee.computed
    && !callee.optional && callee.object.type === 'Identifier' && callee.object.name === 'Object'
    && callee.property.name === 'assign';
  if (!shaped) {
    throw unreadable(file, lineOf(member), 'RoutePlotter.prototype is not the first argument of a plain Object.assign(…)');
  }
  const statement = path.at(-3);
  if (statement.type !== 'ExpressionStatement' || path.at(-4) !== program) {
    throw unreadable(file, lineOf(member), 'Object.assign(RoutePlotter.prototype, …) is not at module level, a ' +
      `statement of its own: it is ${placeOf(path.slice(1, -2))}, so it may not run when the file loads`);
  }
  // The statement is at module level, so only a module-level binding could stand in for either name.
  const declared = declaredBy(program);
  if (declared.has('Object')) {
    throw unreadable(file, lineOf(member), `${file} declares its own Object, so Object.assign(…) may not be the built-in`);
  }
  if (declared.has('RoutePlotter')) {
    const declaration = topLevelClass(module, 'RoutePlotter');
    const at = declaration ? program.body.findIndex(each => each === declaration || each.declaration === declaration) : -1;
    if (at === -1) {
      throw unreadable(file, lineOf(member), 'RoutePlotter is declared at the top level, but not as a class');
    }
    if (at > program.body.indexOf(statement)) {
      throw unreadable(file, lineOf(member), 'Object.assign(RoutePlotter.prototype, …) runs before class RoutePlotter ' +
        'is declared, so the file would throw as it loads');
    }
  }
  const imports = importsOf(module);
  const mixins = call.arguments.slice(1).map(argument => {
    if (argument.type !== 'Identifier') {
      const start = module.source.slice(argument.start).match(/^(?:\.\.\.|[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*|\S)/u)[0];
      throw unreadable(file, lineOf(argument), `the composed argument starting ${start} is not a plain imported name`);
    }
    const binding = imports.get(argument.name);
    if (!binding) {
      throw unreadable(file, lineOf(argument), `${argument.name} is composed but not imported, ` +
        'and the reader finds a mixin only through its import');
    }
    if (!moduleFile(file, binding.specifier)) {
      throw unreadable(file, lineOf(argument), `${argument.name} is imported from ${binding.specifier}, not a file the reader reads`);
    }
    return { local: argument.name, exported: binding.exported, specifier: binding.specifier, line: lineOf(argument) };
  });
  return { call, mixins };
}

/** The mixins main.js composes, read by findComposition. */
function composedMixins(module) {
  return findComposition(module).mixins;
}

/**
 * Refuse a composed mixin that a module in `modules` changes: a property of it
 * written or deleted, the binding assigned, a member Object.prototype gives it
 * that changes it or hands it on (`valueOf`, `__defineGetter__`, …; see
 * REFLECTIVE), or the mixin used as a value other than called, read by property
 * name, copied from by Object.assign, exported under its own name where it is
 * written, or composed; and refuse its module imported as a namespace,
 * dynamically or re-exported, and the mixin exported under another name or
 * from another module, through which the reader could not follow it. Every
 * module's code is walked, whatever it holds: a dynamic import is found in the
 * parsed code, however it is spelt. Object.assign copies what a mixin holds
 * when main.js loads; these tests import each mixin's module on its own, so a
 * change made in another module would reach the app and never them.
 */
function unchangedMixins(modules, mainFile, mixins) {
  const composed = new Set(mixins.map(mixin => `${moduleFile(mainFile, mixin.specifier)} ${mixin.exported}`));
  const homes = new Set(mixins.map(mixin => moduleFile(mainFile, mixin.specifier)));
  const { call } = findComposition(modules.get(mainFile));
  for (const module of modules.values()) {
    const refuse = (node, what) => {
      throw unreadable(module.file, module.lineOf(node), what);
    };
    const names = new Set();
    // `local exported` for each composed mixin this module writes: the one export of it the reader follows.
    const ownExports = new Set();
    for (const statement of module.program.body) {
      const from = statement.source ? moduleFile(module.file, statement.source.value) : null;
      if (statement.type === 'ImportDeclaration') {
        for (const specifier of statement.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier' && homes.has(from)) {
            refuse(specifier, `${statement.source.value}, a composed mixin's module, is imported as a namespace, ` +
              'through which the reader cannot follow a change to the mixin');
          }
          const imported = specifier.type === 'ImportDefaultSpecifier' ? 'default' : keyName(specifier.imported ?? specifier.local);
          if (composed.has(`${from} ${imported}`)) names.add(specifier.local.name);
        }
      } else if (homes.has(from) && (statement.type === 'ExportAllDeclaration'
        || statement.specifiers.some(specifier => composed.has(`${from} ${keyName(specifier.local)}`)))) {
        refuse(statement, `a composed mixin is re-exported from ${statement.source.value}, past the modules the reader reads`);
      }
    }
    for (const mixin of mixins) {
      if (moduleFile(mainFile, mixin.specifier) !== module.file) continue;
      const definition = exportDefinition(module, mixin.exported);
      if (definition?.id?.type === 'Identifier') {
        names.add(definition.id.name);
        ownExports.add(`${definition.id.name} ${mixin.exported}`);
      }
    }
    // Review round 2 (F1): no module is skipped on how its text is spelt. `import /* … */ (` is a dynamic
    // import as much as `import(` is, and only the parsed code tells them apart from a comment or a string.
    walk(module.program, (node, path, keys) => {
      if (node.type === 'ImportExpression') {
        const specifier = node.source.type === 'Literal' ? node.source.value : null;
        if (typeof specifier !== 'string' || homes.has(moduleFile(module.file, specifier))) {
          refuse(node, 'a module is imported dynamically here, which may be a composed mixin\'s, through which the ' +
            'reader cannot follow a change to the mixin');
        }
        return;
      }
      if (node.type !== 'Identifier' || !names.has(node.name)) return;
      const { role } = identifierRole(path, keys);
      if (role === 'name' || role === 'binding') return;
      const parent = path.at(-2);
      const key = keys.at(-1);
      const member = parent.type === 'MemberExpression' && key === 'object';
      const copiedFrom = parent.type === 'CallExpression' && key === 'arguments' && parent.arguments.indexOf(node) > 0
        && parent.callee.type === 'MemberExpression' && !parent.callee.computed
        && parent.callee.object.type === 'Identifier' && parent.callee.object.name === 'Object'
        && parent.callee.property.name === 'assign';
      // Review round 2: a mixin exported under another name (F2) is a second name for it that the reader does
      // not follow, and Object.prototype's reflective members (F5) change it, or hand it on, without a write.
      const exportedAs = parent.type === 'ExportSpecifier' ? keyName(parent.exported) : undefined;
      const reflective = member && !parent.computed && REFLECTIVE.has(parent.property.name);
      const unchanged = role === 'reference' && ((parent === call && key === 'arguments') || copiedFrom
        || (parent.type === 'CallExpression' && key === 'callee')
        || (exportedAs !== undefined && ownExports.has(`${node.name} ${exportedAs}`))
        || (member && !parent.computed && !reflective && !writeOf(path.slice(0, -1), keys.slice(0, -1))));
      if (unchanged) return;
      const how = role === 'target' ? 'is assigned here'
        : exportedAs !== undefined ? `is exported here as ${exportedAs}, a second name the reader does not follow`
          : !member ? 'is used as a value here'
            : parent.computed ? 'is reached by a computed name here'
              : reflective ? `is reached here through Object.prototype's ${parent.property.name}, which can change ` +
                'it, or hand it on, without a write' : 'has a property written or deleted here';
      refuse(node, `${node.name}, a composed mixin, ${how}. Object.assign copies what a mixin holds when ` +
        'main.js loads, so a mixin is changed only where it is written');
    });
  }
}

/**
 * Refuse a module in `modules` that could change the built-in Object, whose
 * assign composes the app (review round 2, F6: findComposition rules out a
 * module-level Object in main.js, which does not make `Object.assign` the
 * built-in). The global Object may be reached only as `Object.<name>` for one
 * of its own members, read or called and never written, nor anything under it
 * (`Object.assign = …`, `delete Object.assign`, `Object.prototype.x = …`);
 * Object.prototype only through a member that only reads it, or compared; and
 * Object itself only so, or compared, never as a value (an alias,
 * `Object.defineProperty(Object, …)`) or through another object
 * (`globalThis.Object`). A built-in reached any other way, as through a global
 * object a service is handed, is taken as intact.
 */
function untouchedObject(modules) {
  const own = new Set(Object.getOwnPropertyNames(Object));
  const compares = node => node?.type === 'BinaryExpression' && ['===', '!==', '==', '!=', 'instanceof'].includes(node.operator);
  for (const module of modules.values()) {
    const refuse = (node, what) => {
      throw unreadable(module.file, module.lineOf(node), `${what}, so Object.assign(RoutePlotter.prototype, …) may ` +
        'not be the built-in that copies each mixin');
    };
    walk(module.program, (node, path, keys) => {
      if (node.type === 'MemberExpression' && keyName(node.property, node.computed) === 'Object') {
        refuse(node, 'the global Object is reached here through another object');
      }
      if (node.type !== 'Identifier' || node.name !== 'Object') return;
      const { role } = identifierRole(path, keys);
      if (role === 'name' || role === 'binding' || scopeOf(path, 'Object')) return;
      if (role === 'target') refuse(node, 'the global Object is assigned here');
      const parent = path.at(-2);
      if (parent.type !== 'MemberExpression' || keys.at(-1) !== 'object') {
        if (compares(parent)) return;
        refuse(node, `the global Object is used here as a value (${valueUse(module, parent)})`);
      }
      const name = keyName(parent.property, parent.computed);
      if (name === undefined) refuse(node, 'the global Object is reached here by a computed name');
      if (!own.has(name)) refuse(node, `Object.${name} is not one of the built-in Object's own members`);
      let top = path.length - 2;
      while (path[top - 1].type === 'MemberExpression' && keys[top] === 'object') top -= 1;
      if (writeOf(path.slice(0, top + 1), keys.slice(0, top + 1))) {
        refuse(node, `Object.${name}${top < path.length - 2 ? '…' : ''} is written here`);
      }
      if (name !== 'prototype') return;
      const holder = path.at(-3);
      const readOnly = holder.type === 'MemberExpression' && keys.at(-2) === 'object' && !holder.computed
        && READ_ONLY_INHERITED.has(holder.property.name);
      if (!readOnly && !compares(holder)) {
        refuse(node, 'Object.prototype is used here other than read through a member that only reads it, or compared, ' +
          'so what every object inherits could change');
      }
    });
  }
}

/**
 * The members a class body defines: `prototype` (methods and accessors, in
 * order), `fields` (on each instance; `storesFunction` when its value is a
 * function), `statics` (on the class), `privates` (`#name`, on neither), and
 * `effective`, what the prototype holds under each key: of two members with
 * one key the later, but a getter and a setter pair up. A key is the name
 * JavaScript gives it. Throws on an `extends` clause, whose inherited members
 * it cannot see, and on a computed key that is not a constant.
 */
function classMembers(module, className) {
  const { file, lineOf } = module;
  const declaration = topLevelClass(module, className);
  if (!declaration) throw unreadable(file, null, `no class ${className} to read`);
  if (declaration.superClass) {
    throw unreadable(file, lineOf(declaration), `class ${className} extends …: the reader reads a ` +
      'class without an extends clause, whose inherited members it could not see');
  }
  const members = { prototype: [], fields: [], statics: [], privates: [], effective: new Map() };
  for (const member of declaration.body.body) {
    if (member.type === 'StaticBlock') continue; // a static block defines no member
    if (!['MethodDefinition', 'PropertyDefinition'].includes(member.type) || member.decorators?.length) {
      throw unreadable(file, lineOf(member), `a member of class ${className} the reader does not know (${member.type})`);
    }
    const name = keyName(member.key, member.computed);
    if (name === undefined) throw unreadable(file, lineOf(member.key), `a computed member name in class ${className} that is not a constant`);
    const kind = member.type === 'PropertyDefinition' ? 'field' : { constructor: 'method' }[member.kind] ?? member.kind;
    const entry = { name, kind, line: lineOf(member.key) };
    if (kind === 'field') Object.assign(entry, { storesFunction: isFunctionValue(member.value), ...bindsMember(member.value) });
    if (member.key.type === 'PrivateIdentifier') members.privates.push(entry);
    else if (member.static) members.statics.push(entry);
    else if (kind === 'field') members.fields.push(entry);
    else members.prototype.push(entry);
  }
  for (const { name, kind, line } of members.prototype) {
    const before = members.effective.get(name);
    if (kind === 'method') {
      members.effective.set(name, { kind, line });
    } else {
      const accessor = before?.kind === 'accessor' ? { ...before } : { kind: 'accessor', get: false, set: false };
      members.effective.set(name, { ...accessor, [kind]: true, line });
    }
  }
  return members;
}

/**
 * Whether an expression gives a function: a function or arrow written there,
 * or a `.bind(…)` that bindsOf() reads, of one of those or of the app's own
 * member, which appCallables() then holds to be a function itself.
 */
function isFunctionValue(node) {
  if (node?.type === 'FunctionExpression' || node?.type === 'ArrowFunctionExpression') return true;
  return bindsOf(node) !== undefined;
}

/**
 * What a plain `.bind(…)` call binds, when the reader can tell it is
 * Function.prototype.bind: `true` for a function or arrow written there, or the
 * name of the app's own member it is called on (`this.name.bind(…)`,
 * `app.name.bind(…)`), which must itself be a function the app has. Undefined
 * for any other call. Review round 2 (F4): any other object may have a method
 * named bind (`source.bind()`) that returns anything.
 */
function bindsOf(node) {
  if (node?.type !== 'CallExpression' || node.optional) return undefined;
  const { callee } = node;
  if (callee.type !== 'MemberExpression' || callee.computed || callee.optional || callee.property.name !== 'bind') return undefined;
  const target = callee.object;
  if (target.type === 'FunctionExpression' || target.type === 'ArrowFunctionExpression') return true;
  const onApp = target.type === 'MemberExpression' && !target.computed && !target.optional
    && target.property.type === 'Identifier'
    && (target.object.type === 'ThisExpression' || (target.object.type === 'Identifier' && target.object.name === 'app'));
  return onApp ? target.property.name : undefined;
}

/** A write's or field's `binds`, when what it stores is the bound copy of one of the app's own members. */
const bindsMember = node => (typeof bindsOf(node) === 'string' ? { binds: bindsOf(node) } : {});

/**
 * The object literals a module writes its composed mixins (`exportedNames`)
 * as: their methods run with the app as `this`. A composed function or class
 * gives Object.assign no own property to copy. A mixin written any other way,
 * or with a member that is not a function written there (a spread, a getter or
 * setter, a value from elsewhere), is refused: the reader could not tell which
 * functions become the app's methods.
 */
function mixinLiterals(module, exportedNames) {
  const literals = new Set();
  for (const exported of exportedNames) {
    const definition = exportDefinition(module, exported);
    if (definition?.type === 'FunctionDeclaration' || definition?.type === 'ClassDeclaration') continue;
    const object = definition?.type === 'VariableDeclarator' ? definition.init : definition;
    if (object?.type !== 'ObjectExpression') {
      throw unreadable(module.file, definition && module.lineOf(definition), `the composed ${exported} is not written ` +
        'here as an object literal, so the reader cannot tell which functions become the app\'s methods');
    }
    for (const property of object.properties) {
      if (property.type === 'Property' && property.kind === 'init' && FUNCTIONS.has(property.value.type)) continue;
      const what = property.type === 'SpreadElement' ? 'a spread' : property.kind === 'init' ? 'a value from elsewhere' : `a ${property.kind}ter`;
      throw unreadable(module.file, module.lineOf(property), `the composed ${exported} has a member that is not a ` +
        `function written there (${what}), so the reader cannot read the method it gives the app`);
    }
    literals.add(object);
  }
  return literals;
}

/**
 * Where `this` and `app` are the app in a module: the class it declares as
 * `className` (main.js's RoutePlotter), the composed mixins it exports
 * (`mixins`, their export names), and the `modules` a helper handed the app may
 * be found in.
 */
function appContext(module, { modules = new Map([[module.file, module]]), className = null, mixins = [] } = {}) {
  return {
    appClass: className ? topLevelClass(module, className) : null,
    mixinObjects: mixinLiterals(module, mixins),
    modules,
  };
}

/**
 * Whether the `this` (or `super`) at the end of `path` is the app: `'app'` in
 * the app class's own methods and fields and in a composed mixin's methods,
 * `'other'` in any other object's or class's method, field or static block.
 * Anywhere else it is a refusal, which this returns as words: at the module's
 * top level, in a plain function, or in the app class's static members, where
 * it is the class itself. An arrow keeps the `this` around it.
 */
function thisVerdict(path, keys, { appClass, mixinObjects }) {
  const asClass = 'in a static member of the app\'s class, where it is the class itself, through which its ' +
    'prototype could be reached';
  for (let index = path.length - 2; index >= 0; index -= 1) {
    const node = path[index];
    if (node.type === 'Program') return 'at the top level of the module, where it is undefined';
    if (node.type === 'StaticBlock') return path[index - 2] === appClass ? asClass : 'other';
    if (node.type === 'PropertyDefinition' && keys[index + 1] === 'value') {
      if (path[index - 2] !== appClass) return 'other';
      return node.static ? asClass : 'app';
    }
    if (node.type !== 'FunctionExpression' && node.type !== 'FunctionDeclaration') continue;
    const holder = path[index - 1];
    if (holder.type === 'MethodDefinition' && keys[index] === 'value') {
      if (path[index - 3] !== appClass) return 'other';
      return holder.static ? asClass : 'app';
    }
    if (holder.type === 'Property' && keys[index] === 'value' && path[index - 2].type === 'ObjectExpression') {
      return holder.kind === 'init' && mixinObjects.has(path[index - 2]) ? 'app' : 'other';
    }
    const what = node.id ? `function ${node.id.name}` : 'a function that is no object\'s or class\'s method';
    return `in ${what}, where what it is depends on how the function is called`;
  }
  return 'outside any module';
}

/**
 * How the member expression at the end of `path` is written, if it is: an
 * assignment (`operator` its own; `storesFunction` when it is `=` of a
 * function, and `binds` when that is the bound copy of the app's member of that
 * name), `++`/`--`, `delete`, or a destructuring or for-in/of target.
 */
function writeOf(path, keys) {
  const holder = path.at(-2);
  const key = keys.at(-1);
  if (holder.type === 'AssignmentExpression' && key === 'left') {
    const stores = holder.operator === '=' && isFunctionValue(holder.right);
    return { operator: holder.operator, storesFunction: stores, ...(stores ? bindsMember(holder.right) : {}) };
  }
  if (holder.type === 'UpdateExpression') return { operator: holder.operator, storesFunction: false };
  if (holder.type === 'UnaryExpression' && holder.operator === 'delete') return { operator: 'delete', storesFunction: false };
  let index = path.length - 1;
  while (index > 0 && inPattern(path, keys, index)) index -= 1;
  const owner = path[index - 1];
  if (keys[index] !== 'left') return null;
  if (owner.type === 'AssignmentExpression') return { operator: 'destructuring', storesFunction: false };
  if (owner.type === 'ForOfStatement' || owner.type === 'ForInStatement') {
    return { operator: owner.type === 'ForOfStatement' ? 'for-of' : 'for-in', storesFunction: false };
  }
  return null;
}

/** A write as a person would write it, for a message. */
const writeShape = ({ receiver, name, operator }) => ({
  '++': `${receiver}.${name}++`,
  '--': `${receiver}.${name}--`,
  delete: `delete ${receiver}.${name}`,
  destructuring: `a destructuring assignment to ${receiver}.${name}`,
  'for-of': `for (${receiver}.${name} of …)`,
  'for-in': `for (${receiver}.${name} in …)`,
}[operator] ?? `${receiver}.${name} ${operator} …`);

/** A class accessor as words: a getter, a setter, or both. */
const accessorWords = member => [member.get && 'getter', member.set && 'setter'].filter(Boolean).join(' and ');

/** The property `if (!this.name) return;` (or `app.name`, braced or not) returns early on, if the statement is one. */
function earlyReturnOn(statement) {
  if (statement.type !== 'IfStatement' || statement.alternate) return undefined;
  const { test, consequent } = statement;
  const body = consequent.type === 'BlockStatement' && consequent.body.length === 1 ? consequent.body[0] : consequent;
  const tested = test.type === 'UnaryExpression' && test.operator === '!' ? test.argument : null;
  const onApp = tested?.type === 'MemberExpression' && !tested.computed && tested.property.type === 'Identifier'
    && (tested.object.type === 'ThisExpression' || (tested.object.type === 'Identifier' && tested.object.name === 'app'));
  return body.type === 'ReturnStatement' && onApp ? tested.property.name : undefined;
}

/**
 * The properties the call at the end of `path` is guarded by: an early
 * `if (!this.name) return;` before it in a block of the function that makes it.
 * A guard outside that function does not stop the function running later.
 */
function guardsOf(path) {
  const guards = [];
  for (let index = path.length - 2; index > 0 && !FUNCTIONS.has(path[index].type); index -= 1) {
    if (path[index].type !== 'BlockStatement') continue;
    for (const statement of path[index].body) {
      if (statement === path[index + 1]) break;
      const property = earlyReturnOn(statement);
      if (property) guards.push(property);
    }
  }
  return guards;
}

/**
 * The helper a call hands the app to: a function declared at the top level of,
 * or imported from, a module the reader reads, which takes the app as its own
 * `app` parameter, so the reader reads what it does with it, and whose name is
 * never assigned again, so the call reaches that function. The name is looked
 * up from the call (`path` ends inside it), so a function or block that
 * declares the same name around the call is not mistaken for the helper.
 * Anything else is refused, with the line of the call.
 */
function helperTaking(modules, module, path, callee, index) {
  const refuse = what => {
    throw unreadable(module.file, module.lineOf(callee), `the app is handed to ${callee.name}, ${what}`);
  };
  const scope = scopeOf(path, callee.name);
  const found = scope === module.program ? functionNamed(modules, module, callee.name) : null;
  if (!found) {
    refuse(scope && scope !== module.program
      ? 'which is declared inside a function or block around the call, where the reader does not look for a helper'
      : 'which is not a function declared at the top level of, or imported from, a module the reader reads');
  }
  const parameter = found.node.params[index];
  if (parameter?.type !== 'Identifier' || parameter.name !== 'app') {
    refuse(`whose parameter there (${found.module.file}:${found.module.lineOf(found.node)}) is not its own app, ` +
      'so what it does with the app is not read');
  }
  // Review round 2 (F3): the declaration read is the helper only while its name, where it is called and where it
  // is declared, is never assigned another function.
  for (const [where, name] of [[module, callee.name], [found.module, found.node.id?.name]]) {
    const write = name && moduleLevelWrites(where).get(name);
    if (write) {
      refuse(`whose name ${name} is assigned again at ${where.file}:${where.lineOf(write)}, so the call may not ` +
        'reach the function read');
    }
  }
  return found;
}

const reassigned = new WeakMap();

/** The module-level names a module assigns (`=`, any operator, `++`, a destructuring or for-in/of target), each with the first place. */
function moduleLevelWrites(module) {
  if (!reassigned.has(module)) {
    const writes = new Map();
    walk(module.program, (node, path, keys) => {
      if (node.type !== 'Identifier' || writes.has(node.name) || identifierRole(path, keys).role !== 'target') return;
      if (scopeOf(path, node.name) === module.program) writes.set(node.name, node);
    });
    reassigned.set(module, writes);
  }
  return reassigned.get(module);
}

/** Whether a function takes the app as its own `app` parameter. */
const takesApp = fn => fn.params.some(parameter => parameter.type === 'Identifier' && parameter.name === 'app');

/** How an expression uses the app as a value, in a few words, for a refusal. */
function valueUse(module, parent) {
  if (parent.type === 'CallExpression' || parent.type === 'NewExpression') {
    return `handed to ${module.source.slice(parent.callee.start, parent.callee.end)}`;
  }
  return { VariableDeclarator: 'the value of a declaration', AssignmentExpression: 'assigned' }[parent.type] ?? `in a ${parent.type}`;
}

/**
 * The calls and writes a module makes on the app by name, read in the context
 * appContext() gives: `calls` ({ receiver, name, line, optional, guards }),
 * `writes` ({ receiver, name, line, operator, storesFunction, binds?, and for
 * `app` the function that takes it, `taker` }), `dynamic` reaches it cannot
 * name ({ line, shape }), for the checks to refuse, `handoffs` of the app to a
 * helper ({ receiver, helper, file, line }), and the `helpers` (their function
 * nodes) the app is handed to. Any other use of the app is refused here, with
 * its file and line: among them Object.prototype's reflective members on it,
 * `arguments` where a function takes it as `app`, and `window.app`.
 */
function appReferences(module, context) {
  const { file, program, lineOf } = module;
  const found = { calls: [], writes: [], dynamic: [], handoffs: [], helpers: [] };
  walk(program, (node, path, keys) => {
    const refuse = what => {
      throw unreadable(file, lineOf(node), what);
    };
    let receiver;
    let taker;
    if (node.type === 'Identifier' && node.name === 'arguments') {
      // Review round 2 (F3): a function that takes the app as `app` holds it in `arguments` too, past that name.
      // An arrow has no arguments of its own: it reaches those of the function around it.
      if (identifierRole(path, keys).role === 'name') return;
      const own = path.findLast(ancestor => FUNCTIONS.has(ancestor.type) && ancestor.type !== 'ArrowFunctionExpression');
      if (own && takesApp(own)) {
        refuse('arguments in a function that takes the app as app holds the app past that name, which the reader ' +
          'does not follow');
      }
      return;
    }
    if (node.type === 'Identifier' && GLOBAL_OBJECTS.has(node.name)) {
      // Review round 2 (F7): main.js publishes the app as window.app. In the files read for the app, that alias is
      // refused wherever it is reached but the one statement that publishes it, and so is the global object as a
      // value, but handed to a service the app holds, like any service call: past either, the app is not followed.
      const { role } = identifierRole(path, keys);
      if (role === 'name' || role === 'binding' || scopeOf(path, node.name)) return;
      const parent = path.at(-2);
      const key = keys.at(-1);
      if (role === 'reference' && parent.type === 'MemberExpression' && key === 'object') {
        const name = keyName(parent.property, parent.computed);
        if (name === undefined) {
          refuse(`${node.name}[…] may reach the app main.js publishes as window.app, which the reader does not follow`);
        }
        if (name !== 'app') return;
        const publish = path.at(-3);
        const published = context.appClass && publish.type === 'AssignmentExpression' && keys.at(-2) === 'left'
          && publish.operator === '=' && publish.right.type === 'NewExpression'
          && publish.right.callee.type === 'Identifier' && publish.right.callee.name === context.appClass.id.name;
        if (published) return;
        refuse(`${node.name}.app is the app main.js publishes, which the reader does not follow: reach the app as ` +
          'this, or as the app parameter of a helper it is handed to');
      }
      // A service call, `this.service.method(window)` or `app.service.method(window)`.
      const holder = parent.callee?.object;
      const service = role === 'reference' && parent.type === 'CallExpression' && key === 'arguments'
        && parent.callee.type === 'MemberExpression' && !parent.callee.computed
        && holder.type === 'MemberExpression' && !holder.computed
        && (holder.object.type === 'ThisExpression' || (holder.object.type === 'Identifier' && holder.object.name === 'app'));
      if (service) return;
      refuse(`${node.name} is ${role === 'target' ? 'assigned here' : `used here as a value (${valueUse(module, parent)})`}, ` +
        'through which the app main.js publishes as window.app could be reached unread');
    }
    if (node.type === 'ThisExpression' || node.type === 'Super') {
      const verdict = thisVerdict(path, keys, context);
      if (verdict === 'other') return;
      const word = node.type === 'Super' ? 'super' : 'this';
      if (verdict !== 'app') {
        refuse(`${word} ${verdict}: neither a RoutePlotter method's nor a composed mixin's, so the reader can ` +
          'neither read it as the app nor rule the app out');
      }
      // `super.name` reaches past the app's own prototype, and `super.name = …` writes the app itself.
      if (node.type === 'Super') refuse('super in a method of the app reaches the app in a way the reader does not follow');
      receiver = 'this';
    } else if (node.type === 'Identifier' && node.name === 'app') {
      const { role, owner, direct } = identifierRole(path, keys);
      if (role === 'name' || (role === 'binding' && FUNCTIONS.has(owner.type) && direct)) return;
      if (role === 'binding') refuse('app is declared here other than as a function\'s own parameter, the one way the reader reads app as the app');
      if (role === 'target') refuse('app is assigned here, so the reader cannot tell what it holds');
      taker = path.findLast(ancestor => FUNCTIONS.has(ancestor.type) && takesApp(ancestor));
      if (!taker) refuse('app is used here, but no function around it takes app as a parameter');
      receiver = 'app';
    } else {
      return;
    }

    const parent = path.at(-2);
    const key = keys.at(-1);
    const line = lineOf(node);
    if (parent.type === 'MemberExpression' && key === 'object') {
      if (parent.computed) {
        found.dynamic.push({ line, shape: `${receiver}[…]` });
        return;
      }
      // A private name (#x) is the class's own, never a name on the prototype.
      if (parent.property.type === 'PrivateIdentifier') return;
      const name = parent.property.name;
      if (name === 'constructor' || name === '__proto__') {
        refuse(`${receiver}.${name} reaches the app's class or prototype, which the reader cannot follow`);
      }
      if (REFLECTIVE.has(name)) {
        refuse(`${receiver}.${name} is Object.prototype's ${name}, which changes the app, or hands it on, with no ` +
          'call or write by name the reader could check');
      }
      const holder = path.at(-3);
      const holderKey = keys.at(-2);
      if ((holder.type === 'CallExpression' && holderKey === 'callee') || (holder.type === 'TaggedTemplateExpression' && holderKey === 'tag')) {
        found.calls.push({ receiver, name, line, optional: holder.optional === true, guards: guardsOf(path) });
      } else if (holder.type === 'NewExpression' && holderKey === 'callee') {
        refuse(`new ${receiver}.${name}(…) constructs through the app, which the reader does not check`);
      } else {
        const write = writeOf(path.slice(0, -1), keys.slice(0, -1));
        if (write) found.writes.push({ receiver, name, line, ...write, ...(taker ? { taker } : {}) });
      }
      return;
    }
    if (parent.type === 'CallExpression' && key === 'arguments') {
      const index = parent.arguments.indexOf(node);
      const { callee } = parent;
      if (callee.type === 'Identifier') {
        const helper = helperTaking(context.modules, module, path, callee, index);
        found.handoffs.push({ receiver, helper: callee.name, file: helper.module.file, line });
        found.helpers.push(helper.node);
        return;
      }
      const method = callee.type === 'MemberExpression' && !callee.computed ? callee.property.name : undefined;
      if (index === 0 && callee.object?.type === 'Identifier' && callee.object.name === 'Object'
        && ['assign', 'defineProperty', 'defineProperties'].includes(method)) {
        found.dynamic.push({ line, shape: `Object.${method}(${receiver}, …)` });
        return;
      }
      const own = callee.object;
      if (index === 0 && ['bind', 'call', 'apply'].includes(method) && own?.type === 'MemberExpression' && !own.computed
        && (own.object.type === 'ThisExpression' || (own.object.type === 'Identifier' && own.object.name === 'app'))) {
        return; // the app as the receiver of its own method, which is that method
      }
    }
    refuse(`${receiver} is used here as a value (${valueUse(module, parent)}), where the reader follows the app ` +
      'only by name, or into a helper that takes it as app');
  });
  return found;
}

/**
 * What each name a call on the app could use holds once main.js has loaded:
 * Object.prototype's functions that only read it (the rest are refused on the
 * app); the class's members, as `effective` gives them; each mixin's values
 * over them, in the order main.js composes them; and, under a name no member
 * has, what the app stores on itself, a function only when every write of that
 * name (and any class field of it) gives one. A bound copy gives one only when
 * what it binds is a function the app has; a write through `app` counts only in
 * a helper that `scans` record the app handed to, since a function that merely
 * names its parameter app may be handed anything. Each entry says whether a
 * call runs it (`callable`), and what it is.
 */
function appCallables({ effective, fields }, mixins, scans) {
  const reach = new Map();
  for (const name of READ_ONLY_INHERITED) reach.set(name, { callable: true, what: `Object.prototype.${name}` });
  for (const [name, member] of effective) {
    // The constructor is not callable without `new`, so a call to it is not counted as reaching one.
    reach.set(name, {
      callable: member.kind === 'method' && name !== 'constructor',
      what: `the class's ${member.kind === 'method' ? 'method' : accessorWords(member)} ${name} (${MAIN}:${member.line})`,
    });
  }
  for (const mixin of mixins) {
    for (const [key, value] of Object.entries(mixin.object ?? {})) {
      reach.set(key, { callable: typeof value === 'function', what: `${mixin.exported}.${key}` });
    }
  }
  const members = new Set([...effective.keys(), ...mixins.flatMap(mixin => Object.keys(mixin.object ?? {}))]);
  const stored = new Map();
  // Review round 2 (F3, F4): a write is evidence of a function only on the app, and a bound copy only of a function.
  const handed = new Set(scans.flatMap(scan => scan.helpers ?? []));
  const store = ({ name, storesFunction, binds, receiver, taker }, where) => {
    const entry = stored.get(name) ?? { always: true, not: [] };
    const why = receiver === 'app' && !handed.has(taker)
      ? `${where} writes the app parameter of a function no call read hands the app`
      : !storesFunction ? `${where} stores something other than a function`
        : binds !== undefined && reach.get(binds)?.callable !== true ? `${where} binds ${binds}, which is no method the app has`
          : null;
    if (why) {
      entry.always = false;
      entry.not.push(why);
    }
    stored.set(name, entry);
  };
  for (const field of fields) store(field, `${MAIN}:${field.line}`);
  for (const { file, writes } of scans) {
    for (const write of writes) store(write, `${file}:${write.line}`);
  }
  for (const [name, { always, not }] of stored) {
    // A write that hides a member is the instance-property check's to refuse.
    if (members.has(name)) continue;
    reach.set(name, always
      ? { callable: true, what: `the function the app stores as ${name}` }
      : { callable: false, what: `${name}, which the app is not shown to hold as a function (${not.join('; ')})` });
  }
  return reach;
}
