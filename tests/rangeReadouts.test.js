/**
 * DEF-14 (its second half) — every range's readout is connected to it.
 *
 * UI-STANDARDS § Recognition over recall: a slider's readout shows the value
 * the renderer or timeline uses, is connected to the slider by
 * `aria-describedby`, and `aria-valuetext` keeps with it, so a screen reader
 * says what the eye reads rather than an internal slider coordinate. 25 of the
 * shell's 49 ranges had no readout token, and many readouts were written
 * without their `aria-valuetext` (`setRangeReadout` everywhere, the plan's
 * remedy).
 *
 * The static half reads the shipped shell. The running half boots the app,
 * opens a route with every kind of waypoint card and a crowd, and holds every
 * range to its readout after the app has drawn it, after each range is moved
 * as a user moves it, after an undo, and after the project is opened again:
 * each is a different place in the code that writes readouts.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect } from 'vitest';
import { withRoute, major } from './helpers/traceProject.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

/** The readout a range's description starts with. */
function readoutOf(range) {
  const first = (range.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)[0];
  return first ? range.ownerDocument.getElementById(first) : null;
}

/**
 * The transport's readout is two times; it says "0:05 of 0:30", as the
 * exported player's does. Every other range says exactly what its readout says.
 */
function expectedValueText(range) {
  const readout = readoutOf(range);
  if (range.id === 'timeline-slider') {
    return `${readout.textContent.trim()} of ${range.ownerDocument.getElementById('total-time').textContent.trim()}`;
  }
  return readout.textContent.trim();
}

/** Each range whose readout is missing, not beside it, or not what `aria-valuetext` says. */
function readoutFaults(root) {
  return [...root.querySelectorAll('input[type="range"]')].flatMap((range) => {
    const readout = readoutOf(range);
    if (!readout) return [`${range.id}: no readout token`];
    // The readout is the one on screen with it: in its row — the one its
    // label shares with it (UI-06 B-06), the camera's, the playbar's — and
    // never in its label, where it would join the control's name.
    const row = range.closest('.range-row') ?? range.closest('.control-row, .timeline, .sidebar-control-row');
    if (!row?.contains(readout)) return [`${range.id}: its first token, #${readout.id}, is not its readout`];
    const label = range.closest('label');
    if (label?.contains(readout)) return [`${range.id}: its readout #${readout.id} is inside its label`];
    const said = range.getAttribute('aria-valuetext');
    const shown = expectedValueText(range);
    return said === shown ? [] : [`${range.id}: says ${JSON.stringify(said)}, shows ${JSON.stringify(shown)}`];
  });
}

describe('every range in the shell is connected to its readout', () => {
  test('as shipped: the readout announces first, and aria-valuetext says what it shows', () => {
    const page = new DOMParser().parseFromString(indexHtml, 'text/html');
    const ranges = page.querySelectorAll('input[type="range"]');

    // Vacuous unless the shell's 50 were there (CROWD-06 added Hold at end).
    expect(ranges.length).toBe(50);
    expect(readoutFaults(page)).toEqual([]);
  });

  test('a readout describes its range and never names it: the label\'s words are the whole name (UI-06 B-06)', () => {
    const page = new DOMParser().parseFromString(indexHtml, 'text/html');
    const inLabel = [...page.querySelectorAll('label input[type="range"]')];
    // The 47 card ranges in a label; the camera and playbar ranges sit beside theirs.
    expect(inLabel.length).toBe(47);
    for (const range of inLabel) {
      const label = range.closest('label');
      const readout = readoutOf(range);
      expect(label.contains(readout), `${range.id}'s readout is in its label`).toBe(false);
      expect(label.getAttribute('for'), range.id).toBe(range.id);
      // The readout is the row's, right after the label; the row is what the app shows or hides.
      expect(readout.closest('.range-row'), range.id).toBe(label.closest('.range-row'));
      expect(readout.classList.contains('range-readout'), range.id).toBe(true);
      // The name is the label's words alone: no readout text, no unit, no number.
      const name = label.textContent.replace(/\s+/g, ' ').trim();
      expect(name, range.id).toBe(label.querySelector('span[data-tip]').textContent.trim());
      expect(name, range.id).not.toContain(readout.textContent.trim());
    }
    // The app toggles these rows whole: their ids sit on the row, not the label.
    for (const id of ['pause-time-control', 'segment-speed-control', 'head-rotation-offset-control',
      'speed-control-right', 'path-trail-control', 'reveal-trail-control']) {
      expect(page.getElementById(id)?.classList.contains('range-row'), id).toBe(true);
    }
  });
});

/** A third of the way along, or two thirds if it is there already. */
function moved(range) {
  const min = Number(range.min || 0);
  const max = Number(range.max || 100);
  const step = range.step && range.step !== 'any' ? Number(range.step) : 1;
  const snap = value => Math.round((value - min) / step) * step + min;
  const third = snap(min + (max - min) / 3);
  return String(String(third) === range.value ? snap(min + (2 * (max - min)) / 3) : third);
}

const settle = () => new Promise(done => setTimeout(done, 0));

describe('every range keeps its readout as the app writes it', () => {
  test('drawn, moved, undone and opened again, aria-valuetext says what the readout shows', async () => {
    const route = [
      major('a', 'A', { imgX: 0.2, imgY: 0.3, beaconStyle: 'ripple', pauseTime: 3000, pauseMode: 'timed' }),
      major('b', 'B', {
        imgX: 0.5, imgY: 0.5, beaconStyle: 'pulse', pathShape: 'squiggle',
        areaHighlight: { enabled: true, shape: 'rectangle', width: 0.2, height: 0.1 },
      }),
      major('c', 'C', { imgX: 0.8, imgY: 0.4, areaHighlight: { enabled: true, shape: 'circle', radius: 0.1 } }),
    ];
    const app = await withRoute(route);
    document.getElementById('splash-close').click();
    app.eventBus.emit('waypoint:selected', app.waypoints[1]);
    await settle();

    expect(readoutFaults(document)).toEqual([]);

    // A selection whose values disagree says Mixed, in both; one waypoint
    // again says its own value, in both.
    app.eventBus.emit('waypoint:toggle-select', app.waypoints[0]);
    await settle();
    expect(document.getElementById('waypoint-pause-time').getAttribute('aria-valuetext')).toBe('Mixed');
    expect(readoutFaults(document)).toEqual([]);
    app.eventBus.emit('waypoint:selected', app.waypoints[1]);
    await settle();
    expect(readoutFaults(document)).toEqual([]);

    // Each range moved as a user moves it: its own readout and any it moves too.
    const after = [];
    for (const range of document.querySelectorAll('input[type="range"]')) {
      if (range.disabled) continue;
      range.value = moved(range);
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      after.push(...readoutFaults(document).map(fault => `after ${range.id}: ${fault}`));
    }
    expect(after).toEqual([]);

    // History puts values back through its own writes.
    app.undo();
    await settle();
    expect(readoutFaults(document)).toEqual([]);

    // And so does opening a project.
    const saved = app._buildProjectSnapshot();
    expect(await loadSnapshot(app, saved)).toBe(true);
    app.eventBus.emit('waypoint:selected', app.waypoints[2]);
    await settle();
    expect(readoutFaults(document)).toEqual([]);
  });
});
