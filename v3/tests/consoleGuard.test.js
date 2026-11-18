import { describe, expect, test } from 'vitest';
import { allowConsole, recordedConsole, unexpectedConsole } from './helpers/consoleGuard.js';

/**
 * TST-10 — the rule that decides whether console output fails a test.
 *
 * The guard itself cannot be proved by a test that fails on purpose, so its
 * rule is a pure function and this pins it.
 */
describe('the console guard (TST-10)', () => {
  const entries = [
    { level: 'warn', message: '[Visibility] Element not found: ripple-controls' },
    { level: 'error', message: 'Failed to load project: Invalid render reference' },
    { level: 'error', message: 'Error in event listener for waypoint:add: boom' }
  ];

  test('nothing is allowed unless a test declares it', () => {
    expect(unexpectedConsole(entries).map(e => e.message)).toEqual(entries.map(e => e.message));
  });

  test('a test can declare the output it provokes, and only that', () => {
    expect(unexpectedConsole(entries, [/^Failed to load project:/]).map(e => e.message))
      .toEqual([
        '[Visibility] Element not found: ripple-controls',
        'Error in event listener for waypoint:add: boom'
      ]);
  });

  test('a swallowed bus error is not allowed unless a test asks for it', () => {
    const swallowed = [{ level: 'error', message: 'Error in event listener for area:changed: boom' }];

    expect(unexpectedConsole(swallowed)).toHaveLength(1);
  });

  test('declared output is recorded rather than printed', () => {
    allowConsole(/^deliberate:/);
    console.warn('deliberate: this is part of the test');

    expect(recordedConsole()).toContain('warn: deliberate: this is part of the test');
  });
});
