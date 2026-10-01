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
import { join } from 'node:path';
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
 * A small tokeniser drops comments, keeps strings, template text and regular
 * expressions whole, and reads the code inside a template's `${…}`. A call on
 * the app is `this.name(` or `this.name?.(` in main.js and src/app/, or
 * `app.name(` in src/app/, whose helpers take the app as `app`;
 * `this.service.method(` calls a service the app holds, not the app. Every
 * `this` is read as the app. None of these files rebinds it today (no nested
 * `function` or object method uses `this`), and a call through one that did
 * would be checked as a call on the app: the worst it can do is fail here,
 * with its line. The readers never guess: a shape they do not know (a second
 * mention of RoutePlotter.prototype, a composed argument that is not a plain
 * imported name, an `extends` clause, a computed class member, a reach for the
 * app other than by a plain name, as `this[…]` or `Object.assign(this, …)`,
 * source they cannot tokenise) fails with its file and line, so these tests
 * fail rather than pass on a shorter list. The last describe pins that on
 * fixtures.
 */

const repoRoot = join(import.meta.dirname, '..');
const MAIN = 'src/main.js';

/**
 * Calls on the app that reach nothing it has, as they stand. Each is counted
 * per file, so the same call made again still fails, and an entry that no
 * longer occurs fails too: the list cannot outlive what it excuses.
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
const mainTokens = once(() => tokenise(readSource(MAIN), MAIN));
const classBody = once(() => classMembers(mainTokens(), 'RoutePlotter', MAIN));

/** What main.js composes, each mixin with the object its module exports under that name. */
const composition = once(async () => Promise.all(composedMixins(mainTokens(), MAIN).map(async mixin => {
  const module = await import(join(repoRoot, 'src', mixin.specifier));
  return { ...mixin, object: module[mixin.exported] };
})));

/**
 * main.js, every module under src/app/ and any composed mixin kept elsewhere,
 * each with the calls and writes it makes on the app.
 */
const scans = once(() => {
  const appFiles = readdirSync(join(repoRoot, 'src', 'app'), { recursive: true })
    .filter(name => name.endsWith('.js'))
    .map(name => join('src', 'app', name));
  const mixinFiles = composedMixins(mainTokens(), MAIN).map(mixin => join('src', mixin.specifier));
  return [...new Set([MAIN, ...appFiles.sort(), ...mixinFiles])].map(file => ({
    file,
    ...appReferences(
      file === MAIN ? mainTokens() : tokenise(readSource(file), file),
      file.startsWith('src/app/') ? ['this', 'app'] : ['this'],
    ),
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
    const members = new Map(classBody().prototype.map(member => [member.name, member]));
    // The reader found the class's core, so an empty list below means something.
    expect([...members.keys()]).toEqual(expect.arrayContaining(['constructor', 'init', 'render']));
    const shared = [];
    for (const mixin of await composition()) {
      for (const key of Object.keys(mixin.object ?? {})) {
        const member = members.get(key);
        if (!member) continue;
        const effect = member.kind === 'method'
          ? `Object.assign runs after the class body, so ${mixin.exported}'s copy silently replaces the class's`
          : `Object.assign writes through the class's ${member.kind}ter, so the method never lands ` +
            '(and a getter alone makes main.js throw on load)';
        shared.push(`${key}: ${MAIN}:${member.line} defines it in the class and ${mixin.exported} defines it too. ${effect}`);
      }
    }
    expect(shared).toEqual([]);
  });

  test('no instance property takes the name of a method on the prototype', async () => {
    const methods = new Map();
    const setters = new Set();
    for (const member of classBody().prototype) {
      methods.set(member.name, `the class's ${member.name} (${MAIN}:${member.line})`);
      if (member.kind === 'set') setters.add(member.name);
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
      for (const { receiver, name, line } of writes) {
        receivers.add(receiver);
        // A write to a setter runs the setter; it gives the instance no property of its own.
        if (methods.has(name) && !setters.has(name)) {
          hiding.push(`${file}:${line}: ${receiver}.${name} = … gives the app its own ${name}, ` +
            `which hides ${methods.get(name)} from every later call`);
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
    // Object.prototype's methods are on the chain too. The constructor is not
    // callable without `new`, so a call to it is not counted as reaching one.
    const callable = new Set(Object.getOwnPropertyNames(Object.prototype)
      .filter(name => name !== 'constructor' && typeof Object.prototype[name] === 'function'));
    for (const member of classBody().prototype) {
      if (member.kind === 'method' && member.name !== 'constructor') callable.add(member.name);
    }
    for (const mixin of await composition()) {
      for (const [key, value] of Object.entries(mixin.object ?? {})) {
        if (typeof value === 'function') callable.add(key);
      }
    }
    // A function the app stores on itself is called on the instance. None does today.
    for (const { writes } of scans()) {
      for (const write of writes) if (write.storesFunction) callable.add(write.name);
    }

    const receivers = new Set();
    const unresolved = new Map();
    for (const { file, calls } of scans()) {
      for (const { receiver, name, line, optional } of calls) {
        receivers.add(receiver);
        if (callable.has(name)) continue;
        const call = `${receiver}.${name}${optional ? '?.' : ''}(`;
        if (!unresolved.has(`${file} ${call}`)) unresolved.set(`${file} ${call}`, { file, call, optional, lines: [] });
        unresolved.get(`${file} ${call}`).lines.push(line);
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
    for (const { file, call, optional, lines } of unresolved.values()) {
      const listed = UNRESOLVED_CALLS.find(entry => entry.file === file && entry.call === call);
      if (!listed) {
        drift.push(`${file}:${lines.join(', ')}: ${call} reaches nothing the composed app has ` +
          '(no class method, mixin method or function the app stores on itself)' +
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
    expect(drift).toEqual([]);
  });
});

describe('the TST-08 source reader', () => {
  test('calls and writes on the app are read from code, never from comments, strings, template text or regular expressions, and a computed reach is caught', () => {
    const source = [
      '// this.inLineComment();',
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
      'Object.assign(this, extra);',
    ].join('\n');
    const { calls, writes, dynamic } = appReferences(tokenise(source, 'fixture.js'), ['this', 'app']);
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
    const read = body => composedMixins(tokenise(imports + body, 'main.js'), 'main.js');
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
  });

  test('the class body is read member by member, and refused where a member could slip past', () => {
    const read = body => classMembers(tokenise(body, 'main.js'), 'RoutePlotter', 'main.js');
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
    expect(() => read('class RoutePlotter extends Base {}')).toThrow(/without an extends clause/);
    expect(() => read("class RoutePlotter { ['render']() {} }")).toThrow(/a computed member name/);
    expect(() => read('class RoutePlotter {\n  ready = load()\n  render() {}\n}'))
      .toThrow(/main\.js:2: the field ready .* semicolon/);
    expect(() => read('class Other {}')).toThrow(/no class RoutePlotter/);
  });

  test('source the tokeniser cannot read is refused with its file and line', () => {
    const read = source => () => tokenise(source, 'fixture.js');
    expect(read("const a = 1;\nconst b = 'never closed;")).toThrow(/fixture\.js:2: a string that never closes/);
    expect(read('const a = `never ${closed}')).toThrow(/fixture\.js:1: a template literal that never closes/);
    expect(read('/* never closed')).toThrow(/a block comment that never closes/);
    expect(read('const a = /never closed;')).toThrow(/a regular expression that never closes/);
    expect(read('call(a]')).toThrow(/a \] that closes the \( opened on line 1/);
    expect(read('function f() {\n')).toThrow(/fixture\.js:1: a \{ that never closes/);
    expect(read('const a = 1 \u00a7 2;')).toThrow(/a character no token starts with/);
  });
});

// ----- The TST-08 reader -----

/** Words after which a `/` begins a regular expression, not a division. */
const WORDS_BEFORE_AN_EXPRESSION = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else',
  'yield', 'await',
]);

/** Punctuators, longest first, so `===` is never read as `==` and `=`. */
const PUNCTUATORS = [
  '>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=',
  '&=', '|=', '^=', '**', '<<', '>>',
  ';', ',', '<', '>', '+', '-', '*', '/', '%', '&', '|', '^', '!', '~', '?', ':', '=', '.', '@',
];

const ASSIGNMENTS = new Set([
  '=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=',
]);
const OPENERS = new Set(['(', '[', '{']);
const CLOSERS = new Map([[')', '('], [']', '['], ['}', '{']]);
const IDENTIFIER = /[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*/uy;
const NUMBER = /(?:0[xXoObB][\da-fA-F_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?/y;

const isName = (token, value) => token?.type === 'name' && (value === undefined || token.value === value);
const isPunct = (token, value) => token?.type === 'punct' && token.value === value;

/** Whether a token can end a value: after one, a `/` divides, and a line break may end the statement. */
const endsValue = token => (token.type === 'name'
  ? !WORDS_BEFORE_AN_EXPRESSION.has(token.value)
  : token.type !== 'punct' || [')', ']', '}', '++', '--'].includes(token.value));

/** A reader's refusal: where, what it met, and what to do instead of loosening the guard. */
function unreadable(file, line, what) {
  return new Error(`${file}${line ? `:${line}` : ''}: ${what}. The TST-08 reader in tests/mixins.test.js ` +
    'does not know this shape: teach it the shape, rather than loosen the guard');
}

/**
 * Split JavaScript into tokens `{ type, value, line }`. The types are `name`
 * (keywords included), `private` (`#name`), `number`, `string` (the text
 * between its quotes), `template` (each end of a template literal), `regex`
 * and `punct`. Comments are dropped. The code inside a template's `${…}` is
 * tokenised as code, after a `${` token; the `}` that ends it is not a token.
 * A `/` begins a regular expression unless the token before it ends a value,
 * the usual rule, which holds for this code. Anything it cannot read throws:
 * an unclosed comment, string, template or regular expression, a bracket that
 * closes the wrong one or never closes, or a stray character.
 */
function tokenise(source, file) {
  const tokens = [];
  const open = []; // { bracket, line } for each bracket, or template `${`, not yet closed
  let line = 1;
  let at = 0;

  const push = (type, value, where = line) => tokens.push({ type, value, line: where });
  const refuse = (what, where = line) => {
    throw unreadable(file, where, what);
  };
  const regexAllowed = () => tokens.length === 0 || !endsValue(tokens.at(-1));
  // Template text runs to its closing backtick, or to a `${` whose code follows.
  const templateText = from => {
    while (at < source.length) {
      const char = source[at];
      if (char === '\\') {
        if (source[at + 1] === '\n') line += 1;
        at += 2;
      } else if (char === '`') {
        at += 1;
        push('template', '`');
        return;
      } else if (char === '$' && source[at + 1] === '{') {
        open.push({ bracket: '${', line });
        push('punct', '${');
        at += 2;
        return;
      } else {
        if (char === '\n') line += 1;
        at += 1;
      }
    }
    refuse('a template literal that never closes', from);
  };

  while (at < source.length) {
    const char = source[at];
    const next = source[at + 1];
    if (char === '\n') {
      line += 1;
      at += 1;
    } else if (/\s/.test(char)) {
      at += 1;
    } else if (char === '/' && next === '/') {
      while (at < source.length && source[at] !== '\n') at += 1;
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', at + 2);
      if (end === -1) refuse('a block comment that never closes');
      for (let index = at; index < end; index += 1) if (source[index] === '\n') line += 1;
      at = end + 2;
    } else if (char === '\'' || char === '"') {
      const from = line;
      let end = at + 1;
      while (source[end] !== char) {
        if (end >= source.length || source[end] === '\n') refuse('a string that never closes', from);
        if (source[end] === '\\' && source[end + 1] === '\n') line += 1;
        end += source[end] === '\\' ? 2 : 1;
      }
      push('string', source.slice(at + 1, end), from);
      at = end + 1;
    } else if (char === '`') {
      push('template', '`');
      at += 1;
      templateText(line);
    } else if (char === '}' && open.at(-1)?.bracket === '${') {
      at += 1;
      templateText(open.pop().line);
    } else if (char === '/' && regexAllowed()) {
      let end = at + 1;
      let inClass = false;
      while (inClass || source[end] !== '/') {
        if (end >= source.length || source[end] === '\n') refuse('a regular expression that never closes');
        if (source[end] === '\\') end += 1;
        else if (source[end] === '[') inClass = true;
        else if (source[end] === ']') inClass = false;
        end += 1;
      }
      end += 1;
      while (/[a-z]/i.test(source[end] ?? '')) end += 1;
      push('regex', source.slice(at, end));
      at = end;
    } else if (OPENERS.has(char)) {
      open.push({ bracket: char, line });
      push('punct', char);
      at += 1;
    } else if (CLOSERS.has(char)) {
      const opened = open.pop();
      if (opened?.bracket !== CLOSERS.get(char)) {
        refuse(opened ? `a ${char} that closes the ${opened.bracket} opened on line ${opened.line}` : `a ${char} that closes nothing`);
      }
      push('punct', char);
      at += 1;
    } else if (char === '#') {
      IDENTIFIER.lastIndex = at + 1;
      const word = IDENTIFIER.exec(source);
      if (!word) refuse('a # that names nothing');
      push('private', `#${word[0]}`);
      at += 1 + word[0].length;
    } else {
      IDENTIFIER.lastIndex = at;
      NUMBER.lastIndex = at;
      const word = IDENTIFIER.exec(source);
      const number = word ? null : NUMBER.exec(source);
      if (word || number) {
        push(word ? 'name' : 'number', (word ?? number)[0]);
        at += (word ?? number)[0].length;
      } else {
        const punct = PUNCTUATORS.find(candidate => source.startsWith(candidate, at));
        if (!punct) refuse(`a character no token starts with, ${JSON.stringify(char)}`);
        // `a ?.5 : b` is a condition and a number, not an optional chain.
        const value = punct === '?.' && /\d/.test(source[at + 2] ?? '') ? '?' : punct;
        push('punct', value);
        at += value.length;
      }
    }
  }
  if (open.length > 0) refuse(`a ${open.at(-1).bracket} that never closes`, open.at(-1).line);
  return tokens;
}

/** The index of the token that closes the bracket at `start`; the tokeniser has matched every pair. */
function closingIndex(tokens, start) {
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'punct') continue;
    if (OPENERS.has(token.value)) depth += 1;
    else if (CLOSERS.has(token.value) && --depth === 0) return index;
  }
  throw new Error(`Nothing closes the ${tokens[start].value} on line ${tokens[start].line}`);
}

/** A module's static imports: each local name, with the name it is exported under and its specifier. */
function importsOf(tokens, file) {
  const imports = new Map();
  let depth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'punct' && OPENERS.has(token.value)) depth += 1;
    else if (token.type === 'punct' && CLOSERS.has(token.value)) depth -= 1;
    const statement = depth === 0 && isName(token, 'import')
      && !isPunct(tokens[index - 1], '.') && !isPunct(tokens[index - 1], '?.');
    // `import(…)` and `import.meta` bind nothing; nor does `import './side-effect.js'`.
    if (!statement || isPunct(tokens[index + 1], '(') || isPunct(tokens[index + 1], '.')
      || tokens[index + 1]?.type === 'string') continue;
    const bindings = [];
    let at = index + 1;
    if (isName(tokens[at])) {
      bindings.push({ local: tokens[at].value, exported: 'default' });
      at += isPunct(tokens[at + 1], ',') ? 2 : 1;
    }
    if (isPunct(tokens[at], '*') && isName(tokens[at + 1], 'as') && isName(tokens[at + 2])) {
      bindings.push({ local: tokens[at + 2].value, exported: '*' });
      at += 3;
    } else if (isPunct(tokens[at], '{')) {
      const close = closingIndex(tokens, at);
      for (at += 1; at < close;) {
        const exported = tokens[at];
        const renamed = isName(tokens[at + 1], 'as');
        const local = renamed ? tokens[at + 2] : exported;
        if (!isName(local)) throw unreadable(file, exported.line, `an import binding, ${exported.value}`);
        bindings.push({ local: local.value, exported: exported.value });
        at += renamed ? 3 : 1;
        if (isPunct(tokens[at], ',')) at += 1;
      }
      at = close + 1;
    }
    if (!isName(tokens[at], 'from') || tokens[at + 1]?.type !== 'string') {
      throw unreadable(file, token.line, 'an import statement');
    }
    for (const binding of bindings) imports.set(binding.local, { ...binding, specifier: tokens[at + 1].value });
  }
  return imports;
}

/**
 * The mixins a file composes: the arguments of its one module-level
 * `Object.assign(RoutePlotter.prototype, …)`, each with the import it comes
 * from. Throws, rather than return a shorter list, when the file names
 * RoutePlotter.prototype anywhere else, when that call has another shape, or
 * when an argument is not a plain imported name.
 */
function composedMixins(tokens, file) {
  const mentions = [];
  tokens.forEach((token, index) => {
    if (isName(token, 'RoutePlotter') && isPunct(tokens[index + 1], '.') && isName(tokens[index + 2], 'prototype')) {
      mentions.push(index);
    }
  });
  if (mentions.length !== 1) {
    const lines = mentions.map(index => tokens[index].line).join(', ');
    throw unreadable(file, lines, `RoutePlotter.prototype is named ${mentions.length} times, ` +
      'where the reader expects it once, in Object.assign(RoutePlotter.prototype, …)');
  }
  const at = mentions[0];
  const call = at - 4;
  const shaped = isName(tokens[call], 'Object') && isPunct(tokens[call + 1], '.')
    && isName(tokens[call + 2], 'assign') && isPunct(tokens[call + 3], '(')
    && !isPunct(tokens[call - 1], '.') && !isPunct(tokens[call - 1], '?.');
  if (!shaped) {
    throw unreadable(file, tokens[at].line, 'RoutePlotter.prototype is not the first argument of a plain Object.assign(…)');
  }
  let depth = 0;
  for (const token of tokens.slice(0, call)) {
    if (token.type === 'punct' && OPENERS.has(token.value)) depth += 1;
    else if (token.type === 'punct' && CLOSERS.has(token.value)) depth -= 1;
  }
  if (depth !== 0) {
    throw unreadable(file, tokens[at].line,
      'Object.assign(RoutePlotter.prototype, …) is not at module level, so it may not run when the file loads');
  }
  const imports = importsOf(tokens, file);
  const close = closingIndex(tokens, call + 3);
  const mixins = [];
  // After the prototype, each argument is `, name`; a trailing comma is allowed.
  for (let index = at + 3; index < close; index += 2) {
    const [comma, argument, after] = [tokens[index], tokens[index + 1], tokens[index + 2]];
    if (!isPunct(comma, ',')) throw unreadable(file, comma.line, `${comma.value} in the composition, where a comma belongs`);
    if (index + 1 === close) break;
    if (!isName(argument) || !(index + 2 === close || isPunct(after, ','))) {
      throw unreadable(file, argument.line, `the composed argument starting ${argument.value} is not a plain imported name`);
    }
    const binding = imports.get(argument.value);
    if (!binding) {
      throw unreadable(file, argument.line, `${argument.value} is composed but not imported, ` +
        'and the reader finds a mixin only through its import');
    }
    mixins.push({ local: argument.value, exported: binding.exported, specifier: binding.specifier, line: argument.line });
  }
  return mixins;
}

/**
 * The members a class body defines: `prototype` (methods and accessors),
 * `fields` (on each instance), `statics` (on the class) and `privates`
 * (`#name`, on neither). Throws on an `extends` clause, whose inherited
 * members it cannot see, on a computed name, and on a field it cannot find the
 * end of, so no member can slip past the checks above.
 */
function classMembers(tokens, className, file) {
  const start = tokens.findIndex((token, index) => isName(token, 'class') && isName(tokens[index + 1], className));
  if (start === -1) throw unreadable(file, null, `no class ${className} to read`);
  if (!isPunct(tokens[start + 2], '{')) {
    throw unreadable(file, tokens[start].line, `class ${className} ${tokens[start + 2]?.value} …: the reader reads a ` +
      'class without an extends clause, whose inherited members it could not see');
  }
  const end = closingIndex(tokens, start + 2);
  const members = { prototype: [], fields: [], statics: [], privates: [] };
  let index = start + 3;
  // A word is a modifier only when a member's name follows it: `get() {}` is a method called get.
  const modifier = word => isName(tokens[index], word)
    && !['(', '=', ';', '}'].some(value => isPunct(tokens[index + 1], value));
  while (index < end) {
    if (isPunct(tokens[index], ';')) {
      index += 1;
      continue;
    }
    let isStatic = false;
    let kind = 'method';
    if (modifier('static')) {
      if (isPunct(tokens[index + 1], '{')) {
        index = closingIndex(tokens, index + 1) + 1; // a static block defines no member
        continue;
      }
      isStatic = true;
      index += 1;
    }
    if (modifier('async')) index += 1;
    if (isPunct(tokens[index], '*')) index += 1;
    if (modifier('get') || modifier('set')) {
      kind = tokens[index].value;
      index += 1;
    }
    const key = tokens[index];
    if (isPunct(key, '[')) throw unreadable(file, key.line, `a computed member name in class ${className}`);
    if (!['name', 'string', 'number', 'private'].includes(key?.type)) {
      throw unreadable(file, key?.line, `a member of class ${className} starting ${key?.value}`);
    }
    index += 1;
    if (isPunct(tokens[index], '(')) {
      const body = closingIndex(tokens, index) + 1;
      if (!isPunct(tokens[body], '{')) throw unreadable(file, key.line, `${key.value}(…) in class ${className}, with no body`);
      index = closingIndex(tokens, body) + 1;
    } else {
      if (kind !== 'method') throw unreadable(file, key.line, `the ${kind}ter ${key.value} in class ${className}, with no body`);
      // A field runs to the semicolon that ends it. A line break could end it
      // too, but then the next member would read as part of its value, so the
      // reader stops there and refuses it.
      let depth = 0;
      let previous = key;
      while (index < end && !(depth === 0 && isPunct(tokens[index], ';'))) {
        const token = tokens[index];
        const newMember = ['name', 'string', 'number', 'private'].includes(token.type);
        if (depth === 0 && token.line > previous.line && endsValue(previous) && newMember) break;
        if (token.type === 'punct' && OPENERS.has(token.value)) depth += 1;
        else if (token.type === 'punct' && CLOSERS.has(token.value)) depth -= 1;
        previous = token;
        index += 1;
      }
      if (!isPunct(tokens[index], ';')) {
        throw unreadable(file, key.line, `the field ${key.value} in class ${className} does not end with a ` +
          'semicolon, so the reader cannot tell where the next member starts');
      }
      index += 1;
      kind = 'field';
    }
    const member = { name: key.value, kind, line: key.line };
    if (key.type === 'private') members.privates.push(member);
    else if (isStatic) members.statics.push(member);
    else if (kind === 'field') members.fields.push(member);
    else members.prototype.push(member);
  }
  return members;
}

/**
 * The calls and writes a file makes on the app by name, through the given
 * receivers: `this.name(`, `this.name?.(` and `this.name = …` (with any
 * assignment operator). `this.service.method(` calls a service, not the app,
 * and `other.this` or `other.app` is not the app. What reaches the app other
 * than by a plain name, `this[…]` or `Object.assign(this, …)` and its kin, is
 * returned as `dynamic`, for the checks to refuse rather than skip.
 */
function appReferences(tokens, receivers) {
  const calls = [];
  const writes = [];
  const dynamic = [];
  tokens.forEach((token, index) => {
    if (!isName(token) || !receivers.includes(token.value)) return;
    if (isPunct(tokens[index - 1], '.') || isPunct(tokens[index - 1], '?.')) return;
    const [dot, name, after, next] = [tokens[index + 1], tokens[index + 2], tokens[index + 3], tokens[index + 4]];
    const copier = ['assign', 'defineProperty', 'defineProperties'].find(word => isName(tokens[index - 2], word));
    if (copier && isPunct(tokens[index - 1], '(') && isPunct(tokens[index - 3], '.') && isName(tokens[index - 4], 'Object')
      && (isPunct(dot, ',') || isPunct(dot, ')'))) {
      dynamic.push({ line: token.line, shape: `Object.${copier}(${token.value}, …)` });
    }
    if (isPunct(dot, '[') || (isPunct(dot, '?.') && isPunct(name, '['))) {
      dynamic.push({ line: token.line, shape: `${token.value}[…]` });
    }
    if (!(isPunct(dot, '.') || isPunct(dot, '?.')) || !isName(name)) return;
    if (isPunct(after, '(') || (isPunct(after, '?.') && isPunct(next, '('))) {
      calls.push({ receiver: token.value, name: name.value, line: token.line, optional: !isPunct(after, '(') });
    } else if (after?.type === 'punct' && ASSIGNMENTS.has(after.value)) {
      writes.push({ receiver: token.value, name: name.value, line: token.line, storesFunction: storesFunction(tokens, index + 4) });
    }
  });
  return { calls, writes, dynamic };
}

/** Whether the value written from `start` is a function: a function expression, an arrow, or a bound method. */
function storesFunction(tokens, start) {
  const first = tokens[start];
  if (isName(first, 'function') || isName(first, 'async')) return true;
  if (isName(first) && isPunct(tokens[start + 1], '=>')) return true;
  if (isPunct(first, '(') && isPunct(tokens[closingIndex(tokens, start) + 1], '=>')) return true;
  // A `.bind(…)` at the value's top level, which ends at its `;` or `,` or the bracket around it.
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'punct' && OPENERS.has(token.value)) depth += 1;
    else if (token.type === 'punct' && CLOSERS.has(token.value)) {
      if (depth === 0) return false;
      depth -= 1;
    } else if (depth === 0 && (isPunct(token, ';') || isPunct(token, ','))) {
      return false;
    } else if (depth === 0 && isPunct(token, '.') && isName(tokens[index + 1], 'bind') && isPunct(tokens[index + 2], '(')) {
      return true;
    }
  }
  return false;
}
