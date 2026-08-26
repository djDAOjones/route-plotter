import { describe, expect, test, vi } from 'vitest';

import { MAX_HISTORY, UndoService } from '../src/services/UndoService.js';

function stateValue(serialized) {
  return JSON.parse(serialized).value;
}

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
