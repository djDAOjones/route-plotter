/**
 * Fail a test that logs an error or warning it did not declare (TST-10).
 *
 * The suite used to print hundreds of lines a run, so a real failure was
 * invisible in the noise — and because the EventBus reports a swallowed
 * listener error through `console.error`, a broken handler could pass
 * unnoticed forever. Anything a test *means* to provoke is declared with
 * `allowConsole`, and everything else fails the test that produced it.
 *
 * Capture is installed once, for the whole worker, rather than per test: a log
 * from module load, `beforeAll`, `afterAll` or a late callback belongs to
 * nobody, and those used to escape entirely. They are reported when the file
 * finishes instead.
 */

import { afterAll, afterEach, beforeEach, expect } from 'vitest';

const LEVELS = ['error', 'warn'];

const original = {};
const capture = {};
let allowed = [];
let recorded = [];
let unowned = [];
let inTest = false;

/** Declare console output this test means to provoke. */
export function allowConsole(...patterns) {
  allowed.push(...patterns);
}

/** What the current test has logged, for a test that asserts on its output. */
export function recordedConsole() {
  return recorded.map(describe);
}

/**
 * The entries a test did not declare. Exported so the rule can be tested
 * without a test that fails on purpose.
 */
export function unexpectedConsole(entries, allowedPatterns = []) {
  return entries.filter(({ message }) => !allowedPatterns.some(pattern => pattern.test(message)));
}

function describe({ level, message }) {
  return `${level}: ${message}`;
}

/** Errors keep their stack, objects their shape: a failure has to be readable. */
function format(args) {
  return args
    .map(arg => {
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ')
    .trim();
}

export function installConsoleGuard() {
  for (const level of LEVELS) {
    original[level] = console[level];
    capture[level] = (...args) => {
      const entry = { level, message: format(args), args };
      (inTest ? recorded : unowned).push(entry);
    };
    console[level] = capture[level];
  }

  beforeEach(() => {
    allowed = [];
    recorded = [];
    inTest = true;
    restoreCaptureIfReplaced();
  });

  afterEach(() => {
    inTest = false;
    const replaced = LEVELS.filter(level => console[level] !== capture[level]);
    const unexpected = unexpectedConsole(recorded, allowed);
    restoreCaptureIfReplaced();

    // A test that installs its own console spy takes the guard off for
    // everything after it, so that is a failure in itself: declare the output
    // with allowConsole and read it back with recordedConsole instead.
    expect(replaced, 'a test replaced the console guard').toEqual([]);
    expect(unexpected.map(describe), 'undeclared console output').toEqual([]);
  });

  afterAll(() => {
    const strays = unowned.splice(0, unowned.length);
    // Nobody owns these: they came from module load, a suite-level hook, or a
    // callback that ran after its test. They still must not pass unnoticed.
    expect(strays.map(describe), 'console output outside any test').toEqual([]);
  });
}

function restoreCaptureIfReplaced() {
  for (const level of LEVELS) {
    if (console[level] !== capture[level]) console[level] = capture[level];
  }
}
