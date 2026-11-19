// CORE-01: the core is pure: no clock, no randomness, no browser or host. dependency-cruiser proves imports only
// (.dependency-cruiser.cjs says so), and a global needs no import, so this test compiles every source file under
// src/core but its tests, in any script language, with TypeScript's own checker on every run, against the core's lib
// (ES2022, no browser or host types), and fails on any global that is not on an allowlist of pure ES globals: what is
// not listed (Date, Intl, Atomics, SharedArrayBuffer, WeakRef, Proxy, Reflect, Function, eval, globalThis, Promise),
// not declared at all (window, alert, BroadcastChannel), or declared only ambiently (`declare const`) fails by
// default. `Math` may be used only as `Math.<name>` with a pure name, so an alias or a destructuring fails;
// `constructor` and `__proto__` may not be named, the usual way round to `Function`. Comments, strings and property
// names do not count; planted files below prove that it bites. It is a static guard: text a program builds at run
// time (`'constr' + 'uctor'`) is beyond it, and review covers that.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['../**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', '!../**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The ES globals the core may use: none reads a clock, randomness or the host, runs text as code or waits. */
const PURE_GLOBALS = new Set([
  'Array', 'ArrayBuffer', 'BigInt', 'BigInt64Array', 'BigUint64Array', 'Boolean', 'DataView', 'Error', 'Float32Array',
  'Float64Array', 'Infinity', 'Int16Array', 'Int32Array', 'Int8Array', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object',
  'RangeError', 'RegExp', 'Set', 'String', 'Symbol', 'TypeError', 'Uint16Array', 'Uint32Array', 'Uint8Array',
  'Uint8ClampedArray', 'WeakMap', 'WeakSet', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'undefined',
]);

/** What `Math` may give: every member but `random`. */
const PURE_MATH = new Set([
  'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh', 'cbrt', 'ceil', 'clz32', 'cos', 'cosh', 'exp',
  'expm1', 'floor', 'fround', 'hypot', 'imul', 'log', 'log10', 'log1p', 'log2', 'max', 'min', 'pow', 'round', 'sign',
  'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'trunc', 'E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2',
]);

/** Names that lead from any value to `Function`, and so to code from text. */
const ESCAPES = new Set(['constructor', '__proto__']);

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts'],
  types: [],
  allowJs: true,
  noEmit: true,
};

/** One program holding `files` (by absolute path) and the core's lib, read once for every test here. */
function programOf(files: Readonly<Record<string, string>>): ts.Program {
  const host = ts.createCompilerHost(OPTIONS);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.getSourceFile = (name, language, ...rest) => {
    const text = files[name];
    if (text === undefined) return getSourceFile(name, language, ...rest);
    return ts.createSourceFile(name, text, language, true);
  };
  host.fileExists = (name) => Object.hasOwn(files, name) || fileExists(name);
  host.readFile = (name) => files[name] ?? readFile(name);
  return ts.createProgram(Object.keys(files), OPTIONS, host);
}

function isName(node: ts.Identifier): boolean {
  const { parent } = node;
  return (
    ((ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node) ||
    (ts.isQualifiedName(parent) && parent.right === node)
  );
}

/** For `Math` used anywhere, what it is used for: `Math.<name>`, or `Math` alone when not read member by member. */
function mathUse(node: ts.Identifier): string {
  const { parent } = node;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) return `Math.${parent.name.text}`;
  const literal = ts.isElementAccessExpression(parent) && parent.expression === node ? parent.argumentExpression : null;
  return literal && ts.isStringLiteralLike(literal) ? `Math.${literal.text}` : 'Math';
}

/** A declaration that emits nothing, and so names a global: the lib's, a `.d.ts` file's, or one under `declare`. */
function isAmbient(node: ts.Node): boolean {
  if (node.getSourceFile().isDeclarationFile) return true;
  for (let at: ts.Node | undefined = node; at !== undefined; at = at.parent) {
    const modifiers = ts.canHaveModifiers(at) ? ts.getModifiers(at) : undefined;
    if (modifiers?.some((one) => one.kind === ts.SyntaxKind.DeclareKeyword)) return true;
  }
  return false;
}

/** What a global use is, or null where it is pure. */
function impureGlobal(node: ts.Identifier, program: ts.Program): string | null {
  const symbol = program.getTypeChecker().getSymbolAtLocation(node);
  const declarations = symbol?.declarations ?? [];
  const global = declarations.every(isAmbient);
  if (!global || (symbol === undefined && node.text === 'undefined')) return null;
  if (symbol === undefined) return `${node.text} (no such global in the core)`;
  if (!PURE_GLOBALS.has(node.text)) return node.text;
  const use = node.text === 'Math' ? mathUse(node) : null;
  return use !== null && !PURE_MATH.has(use.slice('Math.'.length)) ? use : null;
}

/** Each impure use in one source file of `program`, as `line: name`. */
function impurities(program: ts.Program, fileName: string): string[] {
  const file = program.getSourceFile(fileName);
  if (file === undefined) throw new Error(`${fileName} is not in the program`);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    const line = () => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    const named = ts.isIdentifier(node) || ts.isPrivateIdentifier(node) || ts.isStringLiteralLike(node);
    if (named && ESCAPES.has(node.text)) found.push(`${line()}: ${node.text}`);
    else if (ts.isIdentifier(node) && !isName(node)) {
      const impure = impureGlobal(node, program);
      if (impure !== null) found.push(`${line()}: ${impure}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** The glob's names, relative to this folder, as absolute names under `/core`. */
const CORE = Object.fromEntries(
  Object.entries(SOURCES).map(([name, text]) => [
    name.startsWith('../') ? `/core/${name.slice(3)}` : `/core/model/${name.replace(/^\.\//, '')}`,
    text,
  ]),
);

const PLANTED = [
  ['export const now = () => Date.now();', ['1: Date']],
  ['export const made = () => new Date();', ['1: Date']],
  ['export const pick = () => Math.random();', ['1: Math.random']],
  ["export const pick = () => Math['random']();", ['1: Math.random']],
  ['const m = Math; export const pick = () => m.random();', ['1: Math']],
  ['const { random } = Math; export const pick = () => random();', ['1: Math']],
  ['export const tick = () => performance.now();', ['1: performance (no such global in the core)']],
  ['export const wide = () => window.innerWidth;', ['1: window (no such global in the core)']],
  ["export const ask = () => alert('?');", ['1: alert (no such global in the core)']],
  ["export const tell = () => new BroadcastChannel('x');", ['1: BroadcastChannel (no such global in the core)']],
  ['export const host = () => globalThis.location;', ['1: globalThis']],
  ["export const local = () => new Intl.DateTimeFormat().format(0);", ['1: Intl']],
  ["export const run = () => new Function('return 1')();", ['1: Function']],
  ["export const run = () => ({}).constructor.constructor('return 1')();", ['1: constructor', '1: constructor']],
  ["export const run = (o: object) => Reflect.get(o, 'constructor');", ['1: Reflect', '1: constructor']],
  ['export const wait = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);',
    ['1: Atomics', '1: SharedArrayBuffer']],
  ['export const keep = (o: object) => new WeakRef(o);', ['1: WeakRef']],
  [
    "declare const BroadcastChannel: new (to: string) => unknown;\nexport const tell = () => new BroadcastChannel('');",
    ['1: BroadcastChannel', '2: BroadcastChannel'],
  ],
  [
    'declare global { var clock: () => number }\nexport const now = () => clock();',
    ['1: global', '1: clock', '2: clock'],
  ],
] as const;

const INNOCENT = [
  '// Date.now() and Math.random() in a comment',
  "const o = { window: 1, Date: 'Math.random' };",
  'const Date = 1;',
  'export const k = o.window + o.Date + Date + Math.max(Math.PI, Math.floor(2.5)) + Number.parseInt("2", 10);',
].join('\n');

const PLANTS: Record<string, string> = Object.fromEntries(PLANTED.map(([source], i) => [`/plants/${i}.ts`, source]));
PLANTS['/plants/script.mjs'] = 'export const now = () => Date.now();';
PLANTS['/plants/innocent.ts'] = INNOCENT;
const PROGRAM = programOf({ ...CORE, ...PLANTS });

describe('the core is pure', () => {
  it('no source file under src/core, the model, schema and settings included, uses a clock, randomness or host', () => {
    const read = ['/core/model/scene.ts', '/core/scaffold.ts', '/core/schema/check.ts', '/core/schema/field.ts'];
    read.push('/core/config/settings.ts', '/core/config/limits.ts');
    expect(Object.keys(CORE)).toEqual(expect.arrayContaining(read));
    const found = Object.keys(CORE).flatMap((name) => impurities(PROGRAM, name).map((at) => `${name}:${at}`));
    expect(found).toEqual([]);
  });

  it.each(PLANTED.map(([source, expected], i) => [source, expected, `/plants/${i}.ts`] as const))(
    'a planted impurity fails it: %s',
    (_source, expected, name) => {
      expect(impurities(PROGRAM, name)).toEqual(expected);
    },
  );

  it('a planted script in another language fails it too', () => {
    expect(impurities(PROGRAM, '/plants/script.mjs')).toEqual(['1: Date']);
  });

  it('a comment, a string, a property or a local of that name, or a pure global, is not an impurity', () => {
    expect(impurities(PROGRAM, '/plants/innocent.ts')).toEqual([]);
  });
});
