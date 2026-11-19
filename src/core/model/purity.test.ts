// CORE-01: the core is pure: no clock, no randomness, no browser or host. dependency-cruiser proves imports only
// (.dependency-cruiser.cjs says so), and Date, Math.random and the browser's globals need no import, so this test
// reads every non-test file under src/core with TypeScript's parser on every run and fails on any of them. Comments,
// strings and property names (`settings.window`) do not count; planted files below prove that it bites.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Globals that read a clock, randomness, the browser or the host. */
const FORBIDDEN = new Set([
  'Date', 'performance', 'crypto', 'Intl',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'queueMicrotask',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
  'window', 'self', 'globalThis', 'document', 'navigator', 'location', 'process',
  'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker',
]);

function isName(node: ts.Identifier): boolean {
  const { parent } = node;
  return (
    ((ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node) ||
    (ts.isQualifiedName(parent) && parent.right === node)
  );
}

function isMathRandom(node: ts.Node): boolean {
  const onMath = (expression: ts.Expression) => ts.isIdentifier(expression) && expression.text === 'Math';
  if (ts.isPropertyAccessExpression(node)) return onMath(node.expression) && node.name.text === 'random';
  return ts.isElementAccessExpression(node) && onMath(node.expression) && ts.isStringLiteral(node.argumentExpression) &&
    node.argumentExpression.text === 'random';
}

/** Each impure use in one source file, as `line: name`. */
function impurities(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const line = () => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    if (isMathRandom(node)) found.push(`${line()}: Math.random`);
    else if (ts.isIdentifier(node) && FORBIDDEN.has(node.text) && !isName(node)) found.push(`${line()}: ${node.text}`);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('the core is pure', () => {
  it('no file under src/core, the model, schema and settings included, uses a clock, randomness or a browser', () => {
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
    ['export const tick = () => performance.now();', ['1: performance']],
    ['export const id = () => crypto.randomUUID();', ['1: crypto']],
    ['export const wide = () => window.innerWidth;', ['1: window']],
    ['export const later = (f: () => void) => setTimeout(f, 1);', ['1: setTimeout']],
    ['export const host = () => globalThis.location;', ['1: globalThis']],
  ])('a planted impurity fails it: %s', (source, expected) => {
    expect(impurities('planted.ts', source)).toEqual(expected);
  });

  it('a comment, a string or a property of that name is not an impurity', () => {
    const source = [
      '// Date.now() and Math.random() in a comment',
      "const o = { window: 1, Date: 'Math.random' };",
      'export const k = o.window + o.Date;',
    ].join('\n');
    expect(impurities('innocent.ts', source)).toEqual([]);
  });
});
