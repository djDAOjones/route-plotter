/**
 * DEF-21 — Help and the File menu described keys that do not exist.
 *
 * The help panel renders `src/config/keybindings.js`, but that table does not
 * drive anything: `InteractionHandler` does, and the two had drifted. `,` and
 * `.` were listed as "Step" but skip to the start and the end, K was listed as
 * "Pause" but plays and pauses, and the File menu advertised ⌘O with nothing
 * behind it. Each entry is checked here against what the key really does on a
 * booted app; making one table drive both is CON-15.
 */

import { describe, test, expect, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { getKeybindings } from '../src/config/keybindings.js';

/**
 * The bus events one key press produces on a booted app.
 *
 * Handed straight to the app's own handler: every app booted in this file
 * leaves its listener on `document`, and an earlier one would claim the key
 * (`preventDefault`) before this app's handler saw it. The events are recorded,
 * not delivered: what a key asks for is the question, and ⌘S would otherwise
 * open the real save dialog.
 */
function eventsFrom(app, init) {
  const emit = vi.spyOn(app.eventBus, 'emit').mockImplementation(() => {});
  try {
    app.interactionHandler.handleKeyDown(new KeyboardEvent('keydown', { cancelable: true, ...init }));
    return emit.mock.calls.map(call => call[0]);
  } finally {
    emit.mockRestore();
  }
}

async function bootedApp() {
  const app = await bootApp();
  await app.ready;
  return app;
}

describe('Help describes what the keys do (DEF-21)', () => {

  test('comma and full stop skip to the start and the end, and Help says so', async () => {
    const app = await bootedApp();
    const { keyboard } = getKeybindings();

    expect(eventsFrom(app, { key: ',' })).toContain('ui:animation:skip-start');
    expect(eventsFrom(app, { key: '.' })).toContain('ui:animation:skip-end');
    // Were "Step backward" and "Step forward".
    expect(keyboard.stepBackward).toMatchObject({ key: ',', description: 'Skip to start' });
    expect(keyboard.stepForward).toMatchObject({ key: '.', description: 'Skip to end' });
  });

  test('K plays and pauses, and Help says so', async () => {
    const app = await bootedApp();

    expect(eventsFrom(app, { key: 'k' })).toContain('ui:animation:toggle');
    // Was "Pause".
    expect(getKeybindings().keyboard.playPauseK).toMatchObject({ key: 'k', description: 'Play/pause' });
  });

  test('the File menu offers no shortcut that nothing handles', async () => {
    const app = await bootedApp();

    // ⌘O was shown on Open Project, but no handler exists for it.
    expect(eventsFrom(app, { key: 'o', metaKey: true })).not.toContain('file:open');
    expect(document.querySelector('#load-project-btn kbd')).toBeNull();
    // The shortcut the menu does show is real.
    expect(document.querySelector('#save-project-btn kbd')?.textContent).toBe('⌘S');
    expect(eventsFrom(app, { key: 's', metaKey: true })).toContain('file:save');
  });

});
