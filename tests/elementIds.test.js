/**
 * TST-13 — every element the app looks up by id is in the page it looks in.
 *
 * `main.js` gathers about 190 controls into `this.elements` when the app is
 * built, and other modules call `getElementById` as they go. A missing id is
 * not an error: the lookup returns null, most readers guard it with `?.`, and
 * the feature it served quietly stops. This pins every lookup against the page
 * it runs in — the editor's `index.html`, read from disk, or the exported
 * player's page, as the HTML export writes it — so a renamed or deleted id
 * fails here. The ids missing today are listed with where they are read and
 * what the code does without them (SEG-025: "8 are missing today").
 *
 * Three views, because each misses something the others catch: the booted
 * app's `elements` bag, every id the running app asks for, and every literal
 * id in `src/` (which reaches code no test flow runs).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { HTMLExportService } from '../src/services/HTMLExportService.js';
import { bootApp } from './helpers/bootApp.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const running = [];
afterEach(() => {
  // bootApp stops each app, but its key listener stays on `document`.
  for (const app of running.splice(0)) app.interactionHandler.destroy();
});

/** The ids a page declares, parsed as a browser parses it. */
function idsIn(html) {
  const page = new DOMParser().parseFromString(html, 'text/html');
  return new Set([...page.querySelectorAll('[id]')].map(element => element.id));
}

const EDITOR_IDS = idsIn(readFileSync(join(repoRoot, 'index.html'), 'utf8'));

/**
 * The exported player's page, as the HTML export writes it. Built without the
 * constructor, which would start fetching the player bundle.
 */
const PLAYER_IDS = idsIn(Object.create(HTMLExportService.prototype)._generateHTML('Route', null, {}, ''));

/**
 * `elements` keys whose ids are not in index.html. Each says where the key is
 * read and what the app does without the element; none of them breaks start-up.
 */
const MISSING_ELEMENTS = {
  editingSubheading: { id: 'editing-subheading',
    without: 'nothing reads the key: it is set in main.js and never used' },
  editingName: { id: 'editing-name',
    without: 'nothing reads the key: it is set in main.js and never used' },
  bgFitToggle: { id: 'bg-fit-toggle',
    without: 'UIController wires its click with ?., so the Fit/Fill toggle is never wired, and project load ' +
      'skips its label (persistence.js). A project saved as Fill still opens as Fill, but nothing in the ' +
      'shell can switch it: background:mode-change has no other sender' },
  animationSpeed: { id: 'animation-speed',
    without: "the left Duration slider was removed: UIController's listener and sync skip it with ?., and " +
      'project load guards its speed-slider sync on this element, so it never emits ui:slider:update-speed ' +
      'and the right Duration thumb keeps its old place after Open (DEF-20)' },
  animationSpeedValue: { id: 'animation-speed-value',
    without: 'every write is guarded (main.js init, pathTiming.js); the right readout, ' +
      '#animation-speed-value-right, is the one on screen' },
  speedControl: { id: 'speed-control',
    without: 'nothing reads the key; the Duration row in the shell is #speed-control-right' },
  labelSizeWarning: { id: 'label-size-warning',
    without: 'nothing reads the key: it is set in main.js and never used' },
  exportSummary: { id: 'export-summary',
    without: 'updateExportSummary (exporting.js) returns early, so the "1920 × 1080 · 25 fps · 8.5 s" line ' +
      'beside Export never shows' }
};

const MISSING_IDS = Object.values(MISSING_ELEMENTS).map(({ id }) => id);

/**
 * Ids the running app asks for that no page declares, by design. The crowd
 * card's readout helper also looks up the control a readout belongs to
 * (`crowd-seed-value` → `crowd-seed`) to update its `aria-valuetext`; the seed
 * is shown as text with no control, so the lookup finds nothing and the
 * update is skipped, as intended.
 */
const DERIVED_LOOKUPS = {
  'crowd-seed': 'the seed readout has no control; syncCrowdEditor skips its aria-valuetext (crowds.js)'
};

/**
 * Ids the editor builds the first time it needs them, so the shell rightly
 * lacks them.
 */
const CREATED_ON_DEMAND = {
  'camera-zoom-warning': 'camera.js adds it under the camera zoom control when a zoom cannot be reached in time',
  'zoom-prompt': 'viewport.js adds the "Select a waypoint to zoom" prompt',
  'tooltip-container': 'Tooltip.js adds its container, though no element carries data-tooltip (DEL-05)'
};

describe('element ids (TST-13)', () => {

  test("the app's elements bag finds every control in index.html, except the eight pinned here", async () => {
    const app = await bootApp();
    running.push(app);
    await app.ready;

    const missing = Object.entries(app.elements)
      .filter(([, element]) => element === null)
      .map(([key]) => key);
    expect(missing.sort(), 'elements the bag could not find (a new one needs its id in index.html)')
      .toEqual(Object.keys(MISSING_ELEMENTS).sort());
    expect(Object.keys(app.elements).length).toBeGreaterThan(180);
    for (const [key, { id, without }] of Object.entries(MISSING_ELEMENTS)) {
      expect(EDITOR_IDS.has(id), `#${id} (${key}) is in index.html now: take it out of MISSING_ELEMENTS`).toBe(false);
      expect(without).toMatch(/\w/);
    }
  });

  test('every id the app asks for, starting and with a waypoint and a crowd selected, is there', async () => {
    const lookups = vi.spyOn(document, 'getElementById');
    let asked;
    try {
      const app = await bootApp();
      running.push(app);
      await app.ready;
      document.getElementById('splash-close').click();
      await vi.waitFor(() => expect(app.background.image).toBeTruthy());
      app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
      app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
      app.eventBus.emit('waypoint:selected', app.waypoints[0]);
      document.getElementById('add-crowd-btn').click();
      asked = new Set(lookups.mock.calls.map(([id]) => id));
    } finally {
      lookups.mockRestore();
    }

    // Asked for, and still absent once the app has built what it builds.
    const absent = [...asked].filter(id => !document.getElementById(id));
    expect(asked.size).toBeGreaterThan(300);
    expect(absent.sort(), 'ids the app asked for that the page does not have')
      .toEqual([...MISSING_IDS, ...Object.keys(DERIVED_LOOKUPS)].sort());
  });

  /**
   * Every `getElementById('literal')` in `src/`, with comments removed. Ids
   * built at run time are left to the test above: the crowd sliders
   * (`_wireCrowdSlider`, `syncCrowdEditor`), the visibility registry, the
   * share dialog's return focus and ParamTooltip's hint ids all run in its
   * flows. One never runs: wiringDom.js's sidebar-tab handler looks up
   * `${tabName}-tab`, but the shell has no `.tab-btn` to click.
   */
  function literalLookups() {
    const files = [];
    const walk = dir => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.js')) files.push(path);
      }
    };
    walk(join(repoRoot, 'src'));

    const found = [];
    for (const path of files) {
      const file = relative(repoRoot, path);
      // Blank out block comments (keeping line numbers) and whole-line // comments.
      const code = readFileSync(path, 'utf8')
        .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, block => block.replace(/[^\n]/g, ''))
        .split('\n')
        .map(line => (line.trim().startsWith('//') ? '' : line));
      code.forEach((line, index) => {
        for (const [, , id] of line.matchAll(/getElementById\(\s*(['"`])([^'"`$\\]+)\1\s*\)/g)) {
          found.push({ id, file, line: index + 1 });
        }
      });
    }
    return found;
  }

  test('every literal id in src/ is declared by the page it is looked up in', () => {
    const lookups = literalLookups();
    expect(lookups.length, 'the scan found the lookups (not a silent empty pass)').toBeGreaterThan(250);

    const player = lookups.filter(({ file }) => file.startsWith('src/player/'));
    const editor = lookups.filter(({ file }) => !file.startsWith('src/player/'));
    expect(player.length).toBeGreaterThan(5);
    const where = ({ id, file, line }) => `#${id} (${file}:${line})`;

    // The exported player looks in its own page, not the editor's.
    expect(player.filter(({ id }) => !PLAYER_IDS.has(id)).map(where), 'player lookups its page lacks')
      .toEqual([]);
    expect(editor.filter(({ id }) => !EDITOR_IDS.has(id) && !(id in CREATED_ON_DEMAND) && !MISSING_IDS.includes(id))
      .map(where), 'editor lookups index.html lacks').toEqual([]);

    // The lists above are exact: each entry is still looked up, and still absent.
    const editorIdsLookedUp = new Set(editor.map(({ id }) => id));
    for (const id of [...MISSING_IDS, ...Object.keys(CREATED_ON_DEMAND)]) {
      expect(editorIdsLookedUp.has(id), `#${id} is no longer looked up: take it off its list`).toBe(true);
      expect(EDITOR_IDS.has(id), `#${id} is in index.html now: take it off its list`).toBe(false);
    }
    // The missing bag entries are the ones main.js builds the bag from.
    const bagIds = new Set(editor.filter(({ file }) => file === 'src/main.js').map(({ id }) => id));
    for (const id of MISSING_IDS) expect(bagIds.has(id), `#${id} is looked up in main.js`).toBe(true);
  });
});
