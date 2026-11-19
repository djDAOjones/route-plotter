// CORE-01: the core is pure: no clock, no randomness, no browser or host. dependency-cruiser proves imports only
// (.dependency-cruiser.cjs says so), and Date, Math.random and the host's globals need no import, so this test reads
// every source file under src/core but its tests, in any script language, with TypeScript's parser on every run, and
// fails on any of them. `Math` may be used only as `Math.<name>` with a pure name, so an alias (`const m = Math`) or a
// destructuring (`const { random } = Math`) fails too. Comments, strings and property names (`settings.window`) do not
// count; planted files below prove that it bites. Besides this test, `npm run typecheck` reads the core with
// tsconfig.core.json (`lib: ["ES2022"]`, `types: []`), where no browser or host global (window, alert, Image,
// setTimeout, process) exists, so any use of one fails to compile.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['../**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', '!../**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Globals that read a clock, randomness, the browser or the host, or run code from text. */
const FORBIDDEN = new Set([
  'Date', 'performance', 'crypto', 'Intl',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'queueMicrotask',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
  'window', 'self', 'globalThis', 'document', 'navigator', 'location', 'process', 'console',
  'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker',
  'alert', 'confirm', 'prompt', 'Image', 'Audio', 'WeakRef', 'FinalizationRegistry', 'eval', 'Function',
]);

/** What `Math` may give: every member but `random`. */
const PURE_MATH = new Set([
  'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh', 'cbrt', 'ceil', 'clz32', 'cos', 'cosh', 'exp',
  'expm1', 'floor', 'fround', 'hypot', 'imul', 'log', 'log10', 'log1p', 'log2', 'max', 'min', 'pow', 'round', 'sign',
  'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'trunc', 'E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2',
]);

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

/** Each impure use in one source file, as `line: name`. */
function impurities(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const line = () => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    if (ts.isIdentifier(node) && !isName(node)) {
      const use = node.text === 'Math' ? mathUse(node) : node.text;
      const pure = node.text === 'Math' ? PURE_MATH.has(use.slice('Math.'.length)) : !FORBIDDEN.has(use);
      if (!pure) found.push(`${line()}: ${use}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('the core is pure', () => {
  it('no source file under src/core, the model, schema and settings included, uses a clock, randomness or host', () => {
    const read = ['./scene.ts', './checkScene.ts', '../scaffold.ts', '../schema/check.ts', '../schema/field.ts'];
    read.push('../config/settings.ts', '../config/limits.ts');
    expect(Object.keys(SOURCES)).toEqual(expect.arrayContaining(read));
    const found = Object.entries(SOURCES).flatMap(([name, source]) =>
      impurities(name, source).map((at) => `${name}:${at}`),
    );
    expect(found).toEqual([]);
  });

  it.each([
    ['export const now = () => Date.now();', ['1: Date']],
    ['export const made = () => new Date();', ['1: Date']],
    ['export const pick = () => Math.random();', ['1: Math.random']],
    ["export const pick = () => Math['random']();", ['1: Math.random']],
    ['const m = Math; export const pick = () => m.random();', ['1: Math']],
    ['const { random } = Math; export const pick = () => random();', ['1: Math']],
    ['export const pick = (k: string) => Math[k]();', ['1: Math']],
    ['export const tick = () => performance.now();', ['1: performance']],
    ['export const id = () => crypto.randomUUID();', ['1: crypto']],
    ['export const wide = () => window.innerWidth;', ['1: window']],
    ['export const later = (f: () => void) => setTimeout(f, 1);', ['1: setTimeout']],
    ['export const host = () => globalThis.location;', ['1: globalThis']],
    ["export const ask = () => alert('?');", ['1: alert']],
    ['export const picture = () => new Image();', ['1: Image']],
    ["export const run = () => new Function('return Date.now()')();", ['1: Function']],
  ])('a planted impurity fails it: %s', (source, expected) => {
    expect(impurities('planted.ts', source)).toEqual(expected);
  });

  it('the guard reads a planted script in another language too', () => {
    expect(impurities('planted.mjs', 'export const now = () => Date.now();')).toEqual(['1: Date']);
  });

  it('a comment, a string, a property of that name or a pure Math member is not an impurity', () => {
    const source = [
      '// Date.now() and Math.random() in a comment',
      "const o = { window: 1, Date: 'Math.random' };",
      'export const k = o.window + o.Date + Math.max(Math.PI, Math.floor(2.5));',
    ].join('\n');
    expect(impurities('innocent.ts', source)).toEqual([]);
  });
});
