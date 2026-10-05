/**
 * TST-13 — every element the app looks up by id is in the page it looks in,
 * and which ids each file looks up is a reviewed list.
 *
 * `main.js` gathers about 190 controls into `this.elements` when the app is
 * built, and other modules call `getElementById` as they go. A missing id is
 * not an error: the lookup returns null, most readers guard it with `?.`, and
 * the feature it served quietly stops. This holds every lookup to the page it
 * runs in — the editor's `index.html`, read from disk, or the exported
 * player's page, as the HTML export writes it — so a renamed or deleted id
 * fails here. The ids missing today are listed with where they are read and
 * what the code does without them (SEG-025: "8 are missing today").
 *
 * Three views, because each misses something the others catch: the booted
 * app's `elements` bag, every id the running app asks for, and every
 * `getElementById` call in `src/`, read as code (which reaches code no test
 * flow runs). That last scan reads each file whole, so a call written across
 * lines, or with a comment inside it, is still a call, and one inside a
 * comment or a string is not; nor does a computed name, `doc['getElementById']`,
 * hide a call, and any other mention of the method (an alias, a string naming
 * it) fails as one the scan cannot read. The method's name is matched as
 * JavaScript reads it, so one spelled with escapes, in a string or in code,
 * is the call it spells. Its fixtures below pin that. Every
 * call is accounted for: a literal id, checked against its page, or one of
 * the eleven ids built at run time, each listed with what it looks up and
 * whether the running-app flow reaches it.
 *
 * Membership in the page does not say which element a caller wants: a lookup
 * changed to another id its page has would pass it. So the ids each file looks
 * up, and how often, are a reviewed list too (LOOKED_UP), and a lookup added,
 * removed or pointed at another id changes it. Two lookups in one file
 * trading ids would not; for the exported player's error panel, the one the
 * round-2 review found, `playerEntryAccessibility.test.js` checks what the
 * panel says.
 *
 * The ids the editor builds on demand are built here, twice, to show each is
 * then found under the id it was looked up by and reused — or, for one of
 * them, that it is built and never attached (DEF-69, pinned as it stands).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { attachTooltip, detachTooltip } from '../src/components/Tooltip.js';
import { HTMLExportService } from '../src/services/HTMLExportService.js';
import { bootApp } from './helpers/bootApp.js';
import { callsOf, lex, lexedFiles, literalValue } from './helpers/sourceScan.js';

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
 * Every `getElementById` in `src/` whose id is built at run time, by file and
 * argument as written, with how many calls share it, whether the running-app
 * flow below reaches each (`runs`), and what it looks up. The ids the flow's
 * calls ask for are held against the page there, with every other id it asks
 * for; a call it does not reach is checked as the reason says, or not at all.
 */
const DYNAMIC_LOOKUPS = {
  'src/app/crowds.js id': { calls: 3, runs: true,
    what: "each crowd slider wiring itself (_wireCrowdSlider), and syncCrowdEditor's writes to the sliders " +
      'and readouts' },
  'src/app/crowds.js `${id}-value`': { calls: 1, runs: true, what: "a crowd slider's readout" },
  "src/app/crowds.js id.slice(0, -'-value'.length)": { calls: 1, runs: true,
    what: "the control a crowd readout belongs to, for its aria-valuetext (DERIVED_LOOKUPS)" },
  'src/app/privacy.js disclosure.returnFocusId': { calls: 1, runs: true,
    what: 'where focus returns when a share dialog closes: the File or the Export menu button' },
  'src/app/wiringDom.js `${tabName}-tab`': { calls: 1, runs: false,
    what: 'a sidebar tab: the handler is wired to .tab-btn, which the shell does not have, so it never runs' },
  'src/components/ParamTooltip.js id': { calls: 2, runs: true,
    what: "a hint's control (its label's `for`), and a free id for the hint's description" },
  'src/components/ParamTooltip.js existingId': { calls: 1, runs: false,
    what: 'a hint wired by an earlier init: the app inits its hints once (main.js), so it never runs' },
  'src/controllers/UIController.js elementId': { calls: 1, runs: true,
    what: 'each control the visibility registry shows and hides' }
};

/**
 * Ids the editor builds the first time it needs them, so the shell rightly
 * lacks them. `twice` is what building one twice does: how many elements
 * carried the id, whether the id then finds one in the page, and whether the
 * second build reused the first's.
 */
const CREATED_ON_DEMAND = {
  'camera-zoom-warning': {
    why: 'camera.js builds it when a waypoint asks the camera for a zoom it cannot reach in time',
    twice: { built: 2, inPage: false, reused: false },
    // DEF-69: the warning never shows. Its anchor, `.camera-controls`
    // or the zoom slider's `.control-group`, left the shell when the camera
    // zoom moved into the waypoint card, so the element is built detached, the
    // lookup that should reuse it finds nothing, and every warning builds
    // another. Fixing it changes this row.
    defect: 'built detached: no .camera-controls or .control-group holds the zoom slider any more'
  },
  'zoom-prompt': {
    why: 'viewport.js adds the "Select a waypoint to zoom" prompt',
    twice: { built: 1, inPage: true, reused: true }
  },
  'tooltip-container': {
    why: 'Tooltip.js adds its container, though no element carries data-tooltip (DEL-05)',
    twice: { built: 1, inPage: true, reused: true }
  }
};

/** A list of ids written as words. */
const words = text => text.trim().split(/\s+/);

/**
 * Which ids each file of `src/` looks up by a literal, and how often, sorted:
 * the reviewed caller-to-page contract. A lookup added or removed, or pointed
 * at another id, changes this list.
 */
const LOOKED_UP = {
  'src/app/camera.js': words('camera-zoom-warning camera-zoom-warning'),
  'src/app/crowds.js': words(`
    add-crowd-btn crowd-busyness-add crowd-busyness-add crowd-busyness-graph crowd-busyness-graph
    crowd-busyness-handles crowd-busyness-handles crowd-busyness-reset crowd-busyness-reset
    crowd-busyness-summary crowd-dot-color crowd-guide-type crowd-lifecycle crowd-lifecycle-hint
    crowd-pattern-hint crowd-reroll-btn layers-strip
  `),
  'src/app/editorPanel.js': words('waypoint-scope'),
  'src/app/exporting.js': words('export-dropdown-btn'),
  'src/app/network.js': words(`
    crowd-fit-wait-btn crowd-guide-hint crowd-trace-route-btn network-edge-delete network-edge-direction
    network-edge-direction network-edge-hint network-edge-swap network-edge-swap network-edge-weight
    network-edge-weight network-edge-weight-value network-edit-btn network-node-delete network-node-hint
    network-node-type network-node-type network-path-weight-rows network-path-weight-rows
    network-path-weights
  `),
  'src/app/persistence.js': words('app-title'),
  'src/app/privacy.js': words(`
    copy-debug-btn diagnostics-cancel diagnostics-copy diagnostics-copy-issues-address
    diagnostics-description diagnostics-download diagnostics-issues-address diagnostics-issues-note
    diagnostics-modal diagnostics-open-issues diagnostics-open-security diagnostics-preview
    diagnostics-public-warning diagnostics-status diagnostics-title download-debug-btn export-dropdown-btn
    export-dropdown-btn report-bug-btn share-disclosure-cancel share-disclosure-confirm
    share-disclosure-description share-disclosure-modal share-disclosure-title
  `),
  'src/app/sceneOutline.js': words('scene-outline'),
  'src/app/viewport.js': words('zoom-prompt'),
  'src/app/wiringDom.js': words('example-projects-menu waypoint-scope'),
  'src/components/Tooltip.js': words('tooltip-container'),
  'src/controllers/SectionController.js': words(`
    crowd-scope edge-scope node-scope route-scope settings-help-placeholder settings-sections waypoint-scope
  `),
  'src/controllers/UIController.js': words(`
    aov-controls aov-controls clear-cancel clear-confirm clear-confirm-modal codec-cancel
    codec-modal-message codec-mp4-reduced codec-unsupported-modal codec-webm file-dropdown-btn
    leg-section-title modal-title-codec pacing-comet-hint path-trail-control reveal-trail-control scope-chip
    scope-chip-text scope-next-btn scope-prev-btn scope-route-btn splash-help spotlight-controls
    spotlight-controls
  `),
  'src/main.js': words(`
    animation-speed animation-speed-right animation-speed-value animation-speed-value-right announcer
    announcer aov-angle aov-angle-value aov-distance aov-distance-value aov-dropoff aov-dropoff-value app
    app app-title area-border-color area-border-controls area-border-style area-border-width
    area-border-width-value area-circle-controls area-circle-radius area-circle-radius-value area-delete-btn
    area-delete-controls area-draw-btn area-draw-controls area-fade-in area-fade-in-value area-fade-out
    area-fade-out-value area-fill-color area-fill-controls area-fill-opacity area-fill-opacity-value
    area-rect-controls area-rect-height area-rect-height-value area-rect-width area-rect-width-value
    area-shape area-visibility area-visibility-controls background-visibility background-zoom
    background-zoom-value bg-fit-toggle bg-overlay bg-overlay-value bg-upload bg-upload-btn
    camera-multi-controls camera-next-zoom-value camera-prev-zoom-value camera-selected-zoom
    camera-selected-zoom-value camera-single-controls camera-zoom camera-zoom-mode camera-zoom-value canvas
    canvas clear-btn current-time custom-head-controls custom-head-upload-controls custom-marker-controls
    dot-color dot-size dot-size-value editing-name editing-subheading editor-beacon-style
    example-backgrounds-menu export-frame-rate export-html-btn export-include-camera export-include-image
    export-include-text export-mp4-btn export-res-x export-res-y export-summary export-webm-btn
    graphics-scale graphics-scale-label graphics-scale-value head-filename head-preview head-preview-img
    head-rotation-mode head-rotation-offset head-rotation-offset-control head-rotation-offset-value
    head-upload head-upload-btn help-btn label-auto-position label-bg-color label-bg-opacity
    label-bg-opacity-value label-color label-mode label-offset-x label-offset-x-value label-offset-y
    label-offset-y-value label-size label-size-value label-size-warning label-width label-width-value
    load-project-btn load-project-input marker-filename marker-preview marker-preview-img marker-style
    marker-upload marker-upload-btn mode-toggle-btn
    pacing-duration-breakdown path-casing-toggle path-glow-intensity path-glow-toggle
    path-glow-value path-head-color path-head-size path-head-size-value path-head-style path-shape
    path-trail path-trail-value path-visibility pause-btn pause-time-control play-btn preset-1-1 preset-16-9
    preset-9-16 preset-native pulse-amplitude pulse-amplitude-value pulse-controls pulse-cycle-speed
    pulse-cycle-speed-value redo-btn reveal-feather reveal-feather-value reveal-size reveal-size-value
    reveal-trail reveal-trail-value ripple-controls ripple-max-scale ripple-max-scale-value ripple-thickness
    ripple-thickness-value ripple-wait save-project-btn segment-color segment-speed-control segment-style
    segment-width segment-width-value settings-help-placeholder settings-sections shape-amplitude
    shape-amplitude-value shape-frequency shape-frequency-value shape-params-controls skip-end-btn
    skip-start-btn speed-control splash splash-close splash-close-x splash-dont-show splash-help
    timeline-slider toast-container total-time undo-btn waypoint-label waypoint-list waypoint-pause-time
    waypoint-pause-time-value waypoint-segment-speed waypoint-segment-speed-value waypoint-visibility
  `),
  'src/player/playerEntry.js': words(`
    canvas current-time play-btn player-announcer player-error player-error-detail reset-btn
    scene-summary-content scene-summary-content speed-select timeline total-time
  `)
};

/**
 * Every `getElementById` call in some lexed files, with its file and line:
 * its id where the argument is a literal, and `args: null` for a mention that
 * is not a call, which no list here accepts.
 */
function lookupCallsIn(files) {
  const calls = [];
  for (const { file, lexed } of files) {
    const { calls: found, others } = callsOf(lexed, 'getElementById');
    for (const { line, args } of found) {
      calls.push({ file, line, args, id: args.length === 1 ? literalValue(args[0]) : null });
    }
    for (const index of others) {
      calls.push({ file, line: lexed.source.slice(0, index).split('\n').length, args: null, id: null });
    }
  }
  return calls;
}

/** Every `getElementById` call in `src/`. */
const lookupCalls = () => lookupCallsIn(lexedFiles(repoRoot, 'src'));

/** The literal-id lookups, as `{ id, file, line }`. */
function literalLookups() {
  return lookupCalls().filter(({ id }) => id !== null).map(({ id, file, line }) => ({ id, file, line }));
}

/** The calls whose id is built at run time, keyed as DYNAMIC_LOOKUPS is, with their lines. */
function dynamicLookups() {
  const found = {};
  for (const { file, line, args, id } of lookupCalls()) {
    if (id !== null) continue;
    const key = `${file} ${args === null ? '(not a call)' : args.join(', ')}`;
    (found[key] ??= []).push(line);
  }
  return found;
}

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

  test('every id the app asks for, starting, with a waypoint and a crowd selected and both share dialogs, is there', async () => {
    const native = Document.prototype.getElementById;
    const callers = new Set();
    const lookups = vi.spyOn(document, 'getElementById').mockImplementation(function lookup(id) {
      // The `src/` line that asked, to show which built-at-run-time calls ran.
      const frame = new Error().stack.match(/\/(src\/[\w/.-]+\.js):(\d+):\d+/);
      if (frame) callers.add(`${frame[1]}:${frame[2]}`);
      return native.call(this, id);
    });
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
      // Each share dialog looks up the button focus returns to; cancel each.
      for (const share of [() => app.requestProjectSave(), () => app.requestHTMLExport()]) {
        const choice = share();
        await vi.waitFor(() => expect(document.getElementById('share-disclosure-modal').style.display).toBe('flex'));
        await Promise.resolve();
        document.getElementById('share-disclosure-cancel').click();
        await choice;
      }
      asked = new Set(lookups.mock.calls.map(([id]) => id));
    } finally {
      lookups.mockRestore();
    }

    // Asked for, and still absent once the app has built what it builds.
    const absent = [...asked].filter(id => !document.getElementById(id));
    expect(asked.size).toBeGreaterThan(300);
    expect(asked.has('file-dropdown-btn') && asked.has('export-dropdown-btn'), 'both return-focus buttons asked for')
      .toBe(true);
    expect(absent.sort(), 'ids the app asked for that the page does not have')
      .toEqual([...MISSING_IDS, ...Object.keys(DERIVED_LOOKUPS)].sort());

    // Which built-at-run-time calls this flow reached.
    const reached = Object.fromEntries(Object.entries(dynamicLookups())
      .map(([key, lines]) => [key, lines.some(line => callers.has(`${key.split(' ')[0]}:${line}`))]));
    expect(reached, 'the built-at-run-time lookups this flow reaches (DYNAMIC_LOOKUPS.runs)')
      .toEqual(Object.fromEntries(Object.entries(DYNAMIC_LOOKUPS).map(([key, { runs }]) => [key, runs])));
    // The tab handler that never runs has nothing to click.
    expect(document.querySelectorAll('.tab-btn')).toHaveLength(0);
  });

  test('the scan reads calls as code: across lines, with spacing and comments, and not in comments or strings', () => {
    const scan = source => callsOf(lex(source), 'getElementById').calls
      .map(({ line, args }) => [line, args.length === 1 ? literalValue(args[0]) ?? args[0] : args]);
    expect(scan("document.getElementById('one')")).toEqual([[1, 'one']]);
    expect(scan("const detail = document.getElementById(\n  'split'\n);")).toEqual([[1, 'split']]);
    expect(scan('\n\nx = document.getElementById (  "spaced"  )')).toEqual([[3, 'spaced']]);
    expect(scan("document.getElementById(/* why */ 'commented' // and why\n)")).toEqual([[1, 'commented']]);
    expect(scan("// document.getElementById('line-comment')\n/* document.getElementById('block-comment') */"))
      .toEqual([]);
    expect(scan("s = \"getElementById('in-a-string')\"; t = `getElementById('in-a-template')`;")).toEqual([]);
    expect(scan("t = `${document.getElementById('in-a-template-expression')}`;"))
      .toEqual([[1, 'in-a-template-expression']]);
    // A regular expression with slashes in it is not a comment, and division is not a regular expression.
    expect(scan("re = /\\/\\//; document.getElementById('after-a-regex')")).toEqual([[1, 'after-a-regex']]);
    expect(scan("a = b / c; document.getElementById('after-a-division') // x / y"))
      .toEqual([[1, 'after-a-division']]);
    expect(scan('document.getElementById(`plain-template`)')).toEqual([[1, 'plain-template']]);
    expect(scan('document.getElementById(`${name}-built`)')).toEqual([[1, '`${name}-built`']]);
    // An alias is not a call, but the scan still sees it.
    const alias = 'const byId = document.getElementById; byId("aliased")';
    expect(callsOf(lex(alias), 'getElementById')).toEqual({ calls: [], others: [alias.indexOf('getElementById')] });
    // Round 2's review: a computed name is still a call, read like one.
    expect(scan("document['getElementById']('player-error-detail-typo')")).toEqual([[1, 'player-error-detail-typo']]);
    expect(scan('document?.["getElementById"]?.(`optional`)')).toEqual([[1, 'optional']]);
    // And a string naming the method anywhere else is a mention the scan reports.
    const named = "const method = 'getElementById'; document[method]('hidden')";
    expect(callsOf(lex(named), 'getElementById')).toEqual({ calls: [], others: [named.indexOf("'getElementById'")] });
    // What the checks below consume: a mention that is not a call stays in, as one no list accepts.
    expect(lookupCallsIn([{ file: 'fixture.js', lexed: lex(`document['getElementById']('bracketed');\n${named}`) }]))
      .toEqual([
        { file: 'fixture.js', line: 1, args: ["'bracketed'"], id: 'bracketed' },
        { file: 'fixture.js', line: 2, args: null, id: null }
      ]);
  });

  test("a method name spelled with escapes is the call it spells (round 4's review)", () => {
    const scan = source => callsOf(lex(source), 'getElementById').calls
      .map(({ line, args }) => [line, args.length === 1 ? literalValue(args[0]) ?? args[0] : args]);
    // `document['getElement\u{42}yId']('missing')` was neither a call nor a mention.
    expect(scan("document['getElement\\u0042yId']('missing')")).toEqual([[1, 'missing']]);
    expect(scan("document[`getElement\\x42yId`]('hex');\ndocument.getElement\\u{42}yId('in-code')"))
      .toEqual([[1, 'hex'], [2, 'in-code']]);
    // Named with escapes anywhere else, it is a mention, which no list accepts.
    const named = "const method = 'getElement\\u0042yId'; document[method]('hidden')";
    expect(callsOf(lex(named), 'getElementById')).toEqual({ calls: [], others: [named.indexOf("'getElement")] });
    // An id spelled with an escape is not a literal the checks read: it counts as one built at run time.
    expect(lookupCallsIn([{ file: 'fixture.js', lexed: lex("document.getElementById('play\\u002dbtn')") }]))
      .toEqual([{ file: 'fixture.js', line: 1, args: ["'play\\u002dbtn'"], id: null }]);
  });

  test('which ids each file of src/ looks up, and how often, is the reviewed list', () => {
    const found = {};
    for (const { id, file } of literalLookups()) (found[file] ??= []).push(id);
    for (const ids of Object.values(found)) ids.sort();
    expect(found, 'the ids each file looks up (a lookup added, removed or pointed at another id changes LOOKED_UP)')
      .toEqual(LOOKED_UP);
  });

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

  test('every getElementById in src/ is a literal id or one of the lookups built at run time listed here', () => {
    const dynamic = Object.fromEntries(Object.entries(dynamicLookups()).map(([key, lines]) => [key, lines.length]));
    expect(dynamic, 'calls whose id is not a literal (a new one needs a DYNAMIC_LOOKUPS row; an alias is not a call)')
      .toEqual(Object.fromEntries(Object.entries(DYNAMIC_LOOKUPS).map(([key, { calls }]) => [key, calls])));
    expect(Object.values(DYNAMIC_LOOKUPS).filter(({ what }) => !/\w/.test(what))).toEqual([]);
  });

  /**
   * Build one created-on-demand id twice, as the app does, and say what
   * happened: the elements that carried the id, whether the page then has one,
   * and whether the second build found the first's.
   */
  async function buildTwice(id, build) {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'id');
    const carried = [];
    Object.defineProperty(Element.prototype, 'id', {
      ...descriptor,
      set(value) {
        if (value === id) carried.push(this);
        descriptor.set.call(this, value);
      }
    });
    const found = [];
    try {
      for (let time = 0; time < 2; time += 1) {
        await build();
        found.push(document.getElementById(id));
      }
    } finally {
      Object.defineProperty(Element.prototype, 'id', descriptor);
    }
    return {
      built: carried.length,
      inPage: found.every(element => element !== null && element.isConnected),
      reused: found[0] !== null && found[0] === found[1] && carried.length === 1
    };
  }

  test('the camera zoom warning is built when a zoom cannot be reached in time, but never attached (DEF-69)', async () => {
    const app = await bootApp();
    running.push(app);
    await app.ready;
    document.getElementById('splash-close').click();
    await vi.waitFor(() => expect(app.background.image).toBeTruthy());
    // Two majors a few pixels apart: the leg between them is too short for 16×.
    app.eventBus.emit('waypoint:add', { imgX: 0.48, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.52, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:selected', app.waypoints[1]);
    const shown = vi.spyOn(app, '_showZoomWarning');
    const zoom = document.getElementById('camera-zoom');
    const twice = await buildTwice('camera-zoom-warning', () => {
      zoom.value = String(zoom.value === '1' ? 0.99 : 1);
      zoom.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(shown, 'the warning was asked for each time').toHaveBeenCalledTimes(2);
    expect(shown.mock.calls[0][0][0]).toMatchObject({ fromWpIndex: 0, toWpIndex: 1 });
    expect(document.querySelector('.camera-controls')).toBeNull();
    expect(zoom.closest('.control-group')).toBeNull();
    expect(twice, CREATED_ON_DEMAND['camera-zoom-warning'].defect)
      .toEqual(CREATED_ON_DEMAND['camera-zoom-warning'].twice);
  });

  test('the zoom prompt is built once, under its id, and reused', async () => {
    const app = await bootApp();
    running.push(app);
    await app.ready;
    document.getElementById('splash-close').click();
    // With nothing selected, a zoom asks for a waypoint.
    app.eventBus.emit('waypoint:deselected');
    const twice = await buildTwice('zoom-prompt', () => app.eventBus.emit('canvas:zoom-in'));
    expect(document.getElementById('zoom-prompt').textContent).toBe('Select a waypoint to zoom');
    expect(twice, CREATED_ON_DEMAND['zoom-prompt'].why).toEqual(CREATED_ON_DEMAND['zoom-prompt'].twice);
  });

  test("the tooltip container is built once, under its id, and reused (Tooltip.js's own path)", async () => {
    document.body.innerHTML = '<button type="button" id="has-a-tooltip">Help</button>';
    const button = document.getElementById('has-a-tooltip');
    attachTooltip(button, 'A hint');
    try {
      const twice = await buildTwice('tooltip-container', async () => {
        button.dispatchEvent(new Event('focus'));
        // The tooltip shows after its 300 ms delay.
        await vi.waitFor(() => expect(button.getAttribute('aria-describedby')).toBe('tooltip-container'));
        button.dispatchEvent(new Event('blur'));
        await vi.waitFor(() => expect(button.hasAttribute('aria-describedby')).toBe(false));
      });
      expect(twice, CREATED_ON_DEMAND['tooltip-container'].why).toEqual(CREATED_ON_DEMAND['tooltip-container'].twice);
      expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
    } finally {
      detachTooltip(button);
    }
  });
});
