import { describe, expect, test, vi } from 'vitest';

import { MAX_HISTORY, UndoService } from '../src/services/UndoService.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';

function stateValue(serialized) {
  return JSON.parse(serialized).value;
}

/** The serialised form history keeps, for exact comparisons. */
const saved = value => JSON.stringify({ value });

describe('UndoService prospective saves', () => {
  test('preview and save apply the same automatic MAX_HISTORY rollover', () => {
    const eventBus = { emit: vi.fn() };
    const service = new UndoService(eventBus);
    for (let value = 0; value < MAX_HISTORY; value++) {
      service.saveState({ value });
    }
    const before = service.createSnapshot();

    const preview = service.previewSaveState({ value: MAX_HISTORY });

    expect(preview).toMatchObject({
      saved: true,
      automaticDiscardCount: 1,
      redoStack: [],
    });
    expect(preview.undoStack).toHaveLength(MAX_HISTORY);
    expect(stateValue(preview.undoStack[0])).toBe(1);
    expect(stateValue(preview.undoStack.at(-1))).toBe(MAX_HISTORY);
    expect(service.createSnapshot()).toEqual(before);

    const result = service.saveState({ value: MAX_HISTORY });

    expect(result).toEqual({
      saved: true,
      automaticDiscardCount: 1,
      additionalDiscardCount: 0,
    });
    expect(service.getRetainedSerializedStates()).toEqual(preview.undoStack);
  });

  test('a successful save can discard an additional oldest prefix after rollover', () => {
    const service = new UndoService({ emit: vi.fn() });
    for (let value = 0; value < MAX_HISTORY; value++) {
      service.saveState({ value });
    }

    const result = service.saveState(
      { value: MAX_HISTORY },
      { discardOldest: 2 },
    );
    const retained = service.getRetainedSerializedStates();

    expect(result).toEqual({
      saved: true,
      automaticDiscardCount: 1,
      additionalDiscardCount: 2,
    });
    expect(retained).toHaveLength(MAX_HISTORY - 2);
    expect(stateValue(retained[0])).toBe(3);
    expect(stateValue(retained.at(-1))).toBe(MAX_HISTORY);
  });

  test('a successful new branch clears redo only when the save commits', () => {
    const service = new UndoService({ emit: vi.fn() });
    service.saveState({ value: 0 });
    service.saveState({ value: 1 });
    service.saveState({ value: 2 });
    expect(service.undo()).toEqual({ value: 1 });
    expect(service.canRedo()).toBe(true);

    const preview = service.previewSaveState({ value: 3 });
    expect(preview.redoStack).toEqual([]);
    expect(service.canRedo()).toBe(true);

    service.saveState({ value: 3 });
    expect(service.canRedo()).toBe(false);
    expect(service.getRetainedSerializedStates().map(stateValue)).toEqual([0, 1, 3]);
  });

  test('a duplicate save preserves redo and does not emit another state change', () => {
    const eventBus = { emit: vi.fn() };
    const service = new UndoService(eventBus);
    service.saveState({ value: 0 });
    service.saveState({ value: 1 });
    service.undo();
    const before = service.createSnapshot();
    const emissionsBefore = eventBus.emit.mock.calls.length;

    const preview = service.previewSaveState({ value: 0 });
    const result = service.saveState({ value: 0 });

    expect(preview).toMatchObject({ saved: false, automaticDiscardCount: 0 });
    expect(result).toEqual({
      saved: false,
      automaticDiscardCount: 0,
      additionalDiscardCount: 0,
    });
    expect(service.createSnapshot()).toEqual(before);
    expect(service.canRedo()).toBe(true);
    expect(eventBus.emit).toHaveBeenCalledTimes(emissionsBefore);
  });

  test('a rejected additional discard preserves both undo and redo stacks', () => {
    const service = new UndoService({ emit: vi.fn() });
    service.saveState({ value: 0 });
    service.saveState({ value: 1 });
    service.undo();
    const before = service.createSnapshot();

    expect(() => service.saveState({ value: 2 }, { discardOldest: 2 }))
      .toThrow(/current undo state/);

    expect(service.createSnapshot()).toEqual(before);
    expect(service.canRedo()).toBe(true);
  });

  test.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '1', null])(
    'rejects invalid additional discard count %p without changing history',
    (discardOldest) => {
      const service = new UndoService({ emit: vi.fn() });
      service.saveState({ value: 0 });
      const before = service.createSnapshot();

      expect(() => service.saveState({ value: 1 }, { discardOldest }))
        .toThrow(/non-negative integer/);
      expect(service.createSnapshot()).toEqual(before);
    },
  );

  test('does not permit history loss when the proposed state is a duplicate', () => {
    const service = new UndoService({ emit: vi.fn() });
    service.saveState({ value: 0 });
    const before = service.createSnapshot();

    expect(() => service.saveState({ value: 0 }, { discardOldest: 1 }))
      .toThrow(/without saving a new state/);
    expect(service.createSnapshot()).toEqual(before);
  });
});

// Until TST-16 nothing here exercised undo, redo, reset, clear,
// restoreSnapshot or what the service announces; the tests above cover saving
// and its preview only.
describe('UndoService undo and redo', () => {
  test('undo needs a state before the current one', () => {
    const service = new UndoService({ emit: vi.fn() });
    expect(service.undo()).toBeNull();

    service.saveState({ value: 0 });
    expect(service.undo()).toBeNull();
    expect(service.canUndo()).toBe(false);
    expect(service.createSnapshot()).toEqual({ undoStack: [saved(0)], redoStack: [], lastState: saved(0) });
  });

  test('undo returns the previous state, fresh, and moves the current one to redo', () => {
    const service = new UndoService({ emit: vi.fn() });
    service.saveState({ value: 0 });
    service.saveState({ value: 1 });

    const restored = service.undo();

    expect(restored).toEqual({ value: 0 });
    expect(service.createSnapshot()).toEqual({ undoStack: [saved(0)], redoStack: [saved(1)], lastState: saved(0) });
    expect([service.canUndo(), service.canRedo()]).toEqual([false, true]);
    // A fresh parse each time, so changing what undo returned changes no
    // history, and the next undo to that state returns it as it was saved.
    restored.value = 99;
    expect(service.getRetainedSerializedStates()).toEqual([saved(0), saved(1)]);
    service.redo();
    expect(service.undo()).toEqual({ value: 0 });
  });

  test('redo returns the undone state and makes it current again', () => {
    const service = new UndoService({ emit: vi.fn() });
    [0, 1, 2].forEach(value => service.saveState({ value }));
    service.undo();
    service.undo();

    expect(service.redo()).toEqual({ value: 1 });
    expect(service.createSnapshot()).toEqual({
      undoStack: [saved(0), saved(1)], redoStack: [saved(2)], lastState: saved(1),
    });
    // Current again, so saving it once more is a duplicate that keeps redo.
    expect(service.saveState({ value: 1 }))
      .toEqual({ saved: false, automaticDiscardCount: 0, additionalDiscardCount: 0 });
    expect(service.canRedo()).toBe(true);
  });

  test('redo with nothing undone returns null and changes nothing', () => {
    const service = new UndoService({ emit: vi.fn() });
    service.saveState({ value: 0 });
    const before = service.createSnapshot();

    expect(service.redo()).toBeNull();
    expect(service.createSnapshot()).toEqual(before);
  });
});

describe('UndoService reset, clear and snapshots', () => {
  test('reset leaves one baseline, current, and nothing to redo', () => {
    const service = new UndoService({ emit: vi.fn() });
    service.saveState({ value: 0 });
    service.saveState({ value: 1 });
    service.undo();

    service.reset({ value: 'base' });

    expect(service.createSnapshot()).toEqual({ undoStack: [saved('base')], redoStack: [], lastState: saved('base') });
    expect([service.canUndo(), service.canRedo()]).toEqual([false, false]);
    expect(service.saveState({ value: 'base' }).saved).toBe(false);
  });

  test('clear empties history and forgets the current state', () => {
    const service = new UndoService({ emit: vi.fn() });
    service.saveState({ value: 0 });
    service.saveState({ value: 1 });
    service.undo();

    service.clear();

    expect(service.createSnapshot()).toEqual({ undoStack: [], redoStack: [], lastState: null });
    expect([service.canUndo(), service.canRedo()]).toEqual([false, false]);
    // With no current state, what was current before the clear saves again.
    expect(service.saveState({ value: 0 }))
      .toEqual({ saved: true, automaticDiscardCount: 0, additionalDiscardCount: 0 });
  });

  test('restoreSnapshot puts a snapshot back by copy', () => {
    const service = new UndoService({ emit: vi.fn() });
    service.saveState({ value: 0 });
    service.saveState({ value: 1 });
    service.undo();
    const snapshot = service.createSnapshot();
    service.saveState({ value: 2 });

    service.restoreSnapshot(snapshot);

    expect(service.createSnapshot()).toEqual(snapshot);
    expect(service.canRedo()).toBe(true);
    // Copied, not adopted: redo moves a state between the two arrays in
    // place, and the snapshot keeps what it held; so does a later save.
    expect(service.redo()).toEqual({ value: 1 });
    expect(snapshot).toEqual({ undoStack: [saved(0)], redoStack: [saved(1)], lastState: saved(0) });
    service.saveState({ value: 3 });
    expect(snapshot).toEqual({ undoStack: [saved(0)], redoStack: [saved(1)], lastState: saved(0) });
  });

  test('restoreSnapshot reads a missing current state as none', () => {
    const service = new UndoService({ emit: vi.fn() });
    service.saveState({ value: 0 });

    service.restoreSnapshot({ undoStack: [saved(0)], redoStack: [] });

    expect(service.createSnapshot().lastState).toBeNull();
    expect(service.saveState({ value: 0 }).saved).toBe(true);
  });

  test.each([
    null,
    {},
    { undoStack: [saved(0)] },
    { undoStack: saved(0), redoStack: [] },
    { undoStack: [], redoStack: saved(0) },
  ])('restoreSnapshot refuses %j and changes nothing', (snapshot) => {
    const eventBus = { emit: vi.fn() };
    const service = new UndoService(eventBus);
    service.saveState({ value: 0 });
    const before = service.createSnapshot();
    const emissions = eventBus.emit.mock.calls.length;

    expect(() => service.restoreSnapshot(snapshot)).toThrow('Invalid undo history snapshot');
    expect(service.createSnapshot()).toEqual(before);
    expect(eventBus.emit).toHaveBeenCalledTimes(emissions);
  });
});

describe('UndoService announces each change', () => {
  test('every change emits one undo:state-change saying what can be undone and redone', () => {
    const eventBus = { emit: vi.fn() };
    const service = new UndoService(eventBus);
    const change = (canUndo, canRedo, undoCount, redoCount) =>
      ['undo:state-change', { canUndo, canRedo, undoCount, redoCount }];

    service.saveState({ value: 0 });
    service.saveState({ value: 1 });
    service.saveState({ value: 2 });
    // Two steps each way, so neither count can stop at one.
    service.undo();
    service.undo();
    service.redo();
    service.redo();
    service.reset({ value: 'base' });
    service.restoreSnapshot({ undoStack: [saved(0), saved(1)], redoStack: [saved(2)], lastState: saved(1) });
    service.clear();

    expect(eventBus.emit.mock.calls).toEqual([
      change(false, false, 0, 0),
      change(true, false, 1, 0),
      change(true, false, 2, 0),
      change(true, true, 1, 1),
      change(false, true, 0, 2),
      change(true, true, 1, 1),
      change(true, false, 2, 0),
      change(false, false, 0, 0),
      change(true, true, 1, 1),
      // After a clear there is no current state, so undoCount reads -1. Only
      // canUndo and canRedo are read (wiringControllers.js), so this is a
      // quirk pinned as it is, not a defect.
      change(false, false, -1, 0),
    ]);
  });

  test('an undo or redo with nothing to do emits nothing', () => {
    const eventBus = { emit: vi.fn() };
    const service = new UndoService(eventBus);
    service.saveState({ value: 0 });
    const emissions = eventBus.emit.mock.calls.length;

    expect(service.undo()).toBeNull();
    expect(service.redo()).toBeNull();
    expect(eventBus.emit).toHaveBeenCalledTimes(emissions);
  });
});

/**
 * CON-04 — the undo envelope is built twice and must stay byte-equal.
 *
 * A load stores `getUndoBaseline(staged)` (`persistence.js`) as history's
 * only state; every later save sends `_getUndoableState()` (`undoRedo.js`).
 * `UndoService` tells a new state from the current one by comparing the two
 * as strings, so if they ever differed, the first save after a load would
 * record a state identical to the baseline and the first Undo would seem to
 * do nothing. Today they agree for every example and for the fixture that
 * leaves no field at its default; CON-04 merges the two builders, and must
 * keep this.
 */
describe('CON-04: the baseline a load stores is the state the app saves next', () => {
  const projects = [
    ...buildExampleProjects().map(example => ({ id: example.id, project: example.project })),
    { id: 'authored-extras', project: authoredExtrasProject() },
  ];

  for (const { id, project } of projects) {
    test(`CON-04: after loading ${id}, the first undoable state is byte-equal to the baseline`, async () => {
      const app = await bootApp();
      await app.ready;
      expect(await loadSnapshot(app, project)).toBe(true);

      expect(app.undoService.getRetainedSerializedStates()).toEqual([JSON.stringify(app._getUndoableState())]);
      // So saving straight after the load records nothing, and there is still
      // nothing to undo.
      app.saveUndoState();
      expect(app.undoService.getRetainedSerializedStates()).toHaveLength(1);
      expect(app.undoService.canUndo()).toBe(false);
    });
  }
});
