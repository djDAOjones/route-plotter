// The project's own declarations for the accessibility gate (V31-A11Y): its UI states, dialogs, keyboard functions
// and authored journeys, its server and the source the lint step reads. The pack writes this starter once and never
// overwrites it. Features live in project/a11y/coverage.json, not here. A state with no reviewed ARIA snapshot fails
// its snapshot test; an applicable row no journey claims fails its "not written" test.
//
// Route Plotter v4 (STACK-03): one state, the shell STACK-02 left, with the one link that gives its focus test a
// control. Each journey below checks what the shell has now, against the reviewed sequences under it, and fails as
// soon as the shell gains what it cannot yet check (a field, a setting, a status region, content a control opens, a
// control other than a link): the item that adds one writes its journey here, in the same pull request.
// CORE-05, stage 5's first piece (2026-11-21): the shell gains its one status region, which the editor's keys write
// to, and the keys themselves (Home and End; Space and the command chords Undo and Redo; the keys of one printable
// character held off, D183). Its journeys are `fields-and-status` (4.1.3) and `character-key-shortcuts` (2.1.4).
// CORE-05, stage 5's second piece (2026-11-21): Help, a button after the paragraph and the dialog it opens (also by
// `?`), listing the shortcuts, with the switch for single-key shortcuts, on to begin with (D183). The shell's journeys
// now open it: focus in, kept in, back to "Help" (2.4.3); the button and the switch by pointer (2.5.2); the switch's
// help (3.3.5) and its change of no context (3.2.2); the single-key shortcuts both ways (2.1.4).
// CORE-05, stage 5's third piece (2026-11-21): the play bar after "Help", a group "Playback" of three buttons, "Skip to
// start", "Play" and "Skip to end", each calling what its key calls; with nothing to play (always, on this page, until
// stage 6 brings Open) Play is disabled and described by the reason line under the group. The journeys: Tab meets
// the two skips, not the disabled Play (2.4.3); the reason line is read after the group (1.3.2); each button by
// pointer, Play doing nothing (2.5.2); Play's reason tied to it (3.3.5); the skips speak with focus kept (4.1.3); K
// says the reason with the switch on, and nothing off, on a button too (2.1.4).
// CORE-05, stage 5's sixth piece (2026-11-21): the timeline in the group "Playback" after the buttons, a slider over the
// position (thousandths of the length) reading "0:00 of 0:02" on the empty scene (2 s, Hold at end's), the time now and
// the whole time at its ends. The journeys: Tab meets it after "Skip to end" (2.4.3); its label read before the reason
// line (1.3.2); a press on its track and a drag move it, Escape before the release gives either up (2.5.2), and a press
// on the track is the single-pointer alternative to dragging (2.5.7); its label and two times (3.3.5); a key on it and
// a skip elsewhere change no context and keep focus (3.2.2); single keys on it say nothing with the switch off (2.1.4).
// CORE-05, stage 5's seventh piece (2026-11-21): the timeline takes Home, End, Page Up and Page Down itself (the kit's
// slider, D193), proved by keyboard functions in place of the one that found them doing nothing. Codex's findings on
// the sixth: a completed drag compared with a press on the track at the same point (2.5.7); 2.5.2's words for the
// slider; the thumb drawn where its value says; 3.3.5's report naming the timeline; every press of the pointer journey
// through the pointer adapter, so the touch run can credit it.
// CORE-05, stage 5's eighth piece (2026-11-22): the frame (src/editor/shell/Frame.tsx). A banner above main, Carbon's
// header in the page's flow (not fixed), holding the page's one h1, "Route Plotter", and Help; main holds the paragraph
// and the play bar, and the named slots that later items fill, which draw nothing yet. Help is now met before the
// progress link: FOCUS, the shell's snapshot and the waits for the h1 (now in the header) follow. The theme's colours
// come from the University's tokens (buttons, links, the focused knob); the contrast and focus rows measure them.
// CORE-05, stage 6 (2026-11-22, brief 76): "Open project" in the banner before Help (FOCUS and the shell's snapshot
// follow; the page reads the same blocks at rest), over a file input that is `hidden`, so in neither the tree nor the
// tab order. The journeys open the journeys' project (the golden src/editor/shell/goldens/two-stops.project.json,
// io's Save's own project.json, zipped here with jszip; 6 s long) through the browser's chooser: "Project opened" said
// once (4.1.3), a project opened over a playing says no pause and stands at 0 (DEF-67), a file that is no project
// refused by one alert in io's words with the status region silent (4.1.3), its Close putting focus back on the
// button (2.4.3), and the timeline neither echoing an older position during a playing nor pulling back a press held
// still (2.5.2); pointer-cancellation meets "Open project" too (no chooser on the down-event or on a press moved off).
// The `user-input` feature stays unknown: turned present, the report failed 1.3.5, 3.3.2, 3.3.3, 3.3.4 and 3.3.6 for
// want of a j-forms journey crediting them (brief 77, ruling 3: owed at the close). Brief 78 tried holding 1.3.5,
// 3.3.4 and 3.3.6 not applicable: the coverage tool refuses it (a row is not applicable only when its own trigger
// feature, here `user-input` itself, is declared absent), so the feature stays unknown and the six rows owed.
// CORE-06, chat E1 (2026-11-25, brief 109): the paragraph above the preview, "Version 4 is being built here", and its
// link to GitHub are gone (D209), and the preview takes the height left. The preview's box is now operable: an
// application named "Route animation preview" (D245; brief 114: it was a toolbar) with one tab stop, met by Tab
// after "Help" where the link was. READING, FOCUS and both snapshots follow; the journeys that stood on the link stand
// on the page's controls: the reduced-motion focus and the kept function focus the preview, the 320 px walk meets it
// in the link's place, Home on the focused preview speaks with focus kept (4.1.3), the single keys say nothing on it
// with the switch off (2.1.4), and the shell's keyboard task (P06) is turning single-key shortcuts off and on in Help
// by Tab, Enter, Space and Escape. The preview stays set aside from the contrast check, its count now what the probe
// finds once the box is no image: the canvas alone.
// CORE-06, chat E1c (2026-11-25, brief 112): the canvas takes the pointer; the pen's tap places a point on the up and
// joins it from the selected one, and Escape clears the selection. pointer-cancellation reads the preview while a press
// is held, after a press moved off and after a whole press (2.5.2).

const ORIGIN = 'http://127.0.0.1:4173';
// The reviewed sequences: the text blocks a reader meets, in order (1.3.2); the controls Tab reaches, in order
// (2.4.3); each route and its title (2.4.2). A change to the shell is reviewed here.
const READING = ['Route Plotter', 'Preview', 'Timeline', 'Add at least two points to a route to play.'];
const FOCUS = ['button "Open project"', 'button "Help"', 'application "Route animation preview"', 'button "Skip to start"', 'button "Skip to end"', 'slider "Timeline"'];
const ROUTES = [{ path: '/', title: 'Route Plotter' }];
// The shell's one status region, and the words the editor's keys say in it (the editor's transport's own, WORDS).
const STATUS = '[role=status]';
const said = async (page) => (await page.locator(STATUS).textContent()) ?? '';
const SKIPPED_TO_START = 'Skipped to start';
const SKIPPED_TO_END = 'Skipped to end';
// What the status region says after an edit (CORE-06, brief 134, ruling CV; D263's answer, "Yes, every edit", in D268's
// words, src/editor/canvas/words.ts): the pen's tap that places a point, and a point's drag released; a cancelled drag
// says nothing.
const POINT_ADDED = 'Point added';
const POINT_MOVED = 'Point moved';
// Said when a start is refused, and shown under the play bar while there is nothing to play (WORDS.nothingToPlay).
const NOTHING_TO_PLAY = 'Add at least two points to a route to play.';
// The play bar's buttons and the line that says why Play is off.
const SKIP_START = '#skip-to-start';
const PLAY = '#play-pause';
const SKIP_END = '#skip-to-end';
const REASON = '#play-reason';
// The timeline: its thumb (Carbon's role=slider) and track, what it holds and reads out, and where a press on its track
// at `f` of its width lands. Each move of it is a scrub: no undo step, nothing said.
const TIMELINE = '#timeline';
const TRACK = '.cds--slider';
const atNow = (page) => page.locator(TIMELINE).evaluate((e) => ({ now: Number(e.getAttribute('aria-valuenow')), text: e.getAttribute('aria-valuetext') }));
// Carbon throttles a drag's moves and draws the thumb after React's effects: wait (up to 2 s) until it holds `ok(now)`.
const comesTo = (page, ok) => page.waitForFunction(([s, f]) => new Function('n', `return ${f}`)(Number(document.querySelector(s)?.getAttribute('aria-valuenow'))), [TIMELINE, ok], { timeout: 2000 }).then(() => true, () => false);
const onTrack = async (page, f) => { const b = await page.locator(TRACK).boundingBox(); return { x: b.x + b.width * f, y: b.y + b.height / 2 }; };
// Whether the thumb is drawn at `f` of the track (wait up to 2 s): the centre of its box within two pixels of that
// point, a pixel for rounding either side; Carbon keeps the value it reports and the place it draws apart.
const thumbAt = (page, f) => page.waitForFunction(([t, s, at]) => {
  const track = document.querySelector(s)?.getBoundingClientRect(), thumb = document.querySelector(t)?.getBoundingClientRect();
  return !!track && !!thumb && Math.abs(thumb.left + thumb.width / 2 - (track.left + track.width * at)) <= 2;
}, [TIMELINE, TRACK, f], { timeout: 2000 }).then(() => true, () => false);
// A drag through the pointer adapter: down at `from`, then `steps` moves to `to` (the adapter moves in one step).
const dragBy = async (pointer, from, to, steps = 4) => {
  await pointer.down(from.x, from.y);
  for (let i = 1; i <= steps; i++) await pointer.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
};
// The fields a person meets: those drawn (Carbon keeps a hidden number input beside its slider, never shown, D181).
const shownFields = (page) => page.locator(FIELDS).filter({ visible: true });
const UNDO = process.platform === 'darwin' ? 'Meta+z' : 'Control+z';
// Redo's chord (CORE-06, brief 121): Cmd+Shift+Z on a Mac, Ctrl+Shift+Z elsewhere, as the editor's key list says.
const REDO = process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z';
// The platform's command key alone (CORE-06, brief 122): held round a click for the toggle, Cmd on a Mac, Ctrl elsewhere.
const COMMAND = process.platform === 'darwin' ? 'Meta' : 'Control';
// Open project's chord (D207), as UNDO is built: Cmd+O on a Mac, Ctrl+O elsewhere.
const OPEN_KEY = process.platform === 'darwin' ? 'Meta+o' : 'Control+o';
// Presses Open project's chord where focus is and gives whether the page's own file chooser opened within `ms` and
// whether the key came out cancelled (a listener on the window, after the editor's on `document`, reads it). A
// scripted press does not pass through Chrome's own shortcuts, so this cannot show that Chrome hands a real Cmd or
// Ctrl+O to the page: only a real key press in Chrome shows that (D207).
const pressOpenKey = async (page, ms = 3000) => {
  await page.evaluate(() => { window.__oTaken = null; addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'o') window.__oTaken = e.defaultPrevented; }); });
  const chooser = page.waitForEvent('filechooser', { timeout: ms }).then(() => true, () => false);
  await page.keyboard.press(OPEN_KEY);
  return { opened: await chooser, taken: (await page.evaluate(() => window.__oTaken)) === true };
};
const focusOn = (page, sel) => page.evaluate((s) => !!document.activeElement?.matches(s), sel);
// True if the status region does not say `words` within `ms`: a second action a key must not also run (a message
// waiting behind another shows when the first's hold ends, about 2 s).
const neverSays = (page, words, ms = 3000) => page.waitForFunction(([s, w]) => document.querySelector(s)?.textContent === w, [STATUS, words], { timeout: ms }).then(() => false, () => true);
// Nothing at all is said for `ms`: the status region stays empty, whatever words might come (a step from a pause).
const saysNothing = (page, ms = 1000) => page.waitForFunction((s) => (document.querySelector(s)?.textContent ?? '') !== '', STATUS, { timeout: ms }).then(() => false, () => true);
// The keys of one printable character the editor's key table names: live while their switch is on, as the page opens,
// and doing nothing while it is off (D183).
const SINGLE_KEYS = ['j', 'k', 'l', ',', '.', '<', '>', '?'];
// Help: its button, its dialog, and the switch in it for single-key shortcuts, with the sentence under it.
const HELP = '#help';
const SWITCH = '#single-keys';
const helpButton = (page) => page.locator(HELP);
const helpDialog = (page) => page.getByRole('dialog', { name: 'Help' });
const singleKeys = (page) => page.locator(SWITCH);
const focusIs = (page, sel) => page.evaluate((s) => !!document.activeElement?.matches(s), sel);
// Help's content as a scrollable region (brief 123): once its three tables no longer fit the window, the kit's dialog
// (Carbon) makes the content a region named Help, in the Tab order, so the keyboard can scroll it. Shift+Tab from where
// focus lands (the content's start, inside it) meets that region first, and Close one press later.
const HELP_REGION = '[role=dialog] [role=region]';
const shiftTabToClose = async (page) => {
  await page.keyboard.press('Shift+Tab');
  const region = await focusIs(page, HELP_REGION);
  if (region) await page.keyboard.press('Shift+Tab');
  return region;
};
// Focus goes back to "Help" when Help closes (the kit's own call, kit/Dialog.tsx; Carbon's timer does not run on unmount): wait for it all the same.
const backOnHelp = (page) => page.waitForFunction((s) => !!document.activeElement?.matches(s), HELP, { timeout: 2000 }).then(() => true, () => false);
// The status region holds a message about 2 s: wait for it to empty before a check that it says nothing.
const quiet = (page) => page.waitForFunction((s) => !document.querySelector(s)?.textContent, STATUS, { timeout: 5000 }).then(() => true, () => false);
// Open (stage 6): its button; the journeys' project, the golden io's Save writes (openGolden.test.ts proves it), 6 s
// long, zipped here as a saved file is; a text file io refuses, in its words.
const OPEN = '#open-project';
const OPENED = 'Project opened';
const PAUSED = 'Animation paused';
const LENGTH_MS = 6000;
const NOT_A_PROJECT = 'This file is not a Route Plotter project, or it is damaged. Choose a project saved by Route Plotter v4 (a .zip file). Nothing was opened.';
// Its two parts, checked apart (STACK-08): what is wrong (3.3.1) and what to choose instead (3.3.3).
const NOT_A_PROJECT_CAUSE = 'This file is not a Route Plotter project, or it is damaged.';
const NOT_A_PROJECT_CHOICE = 'Choose a project saved by Route Plotter v4 (a .zip file).';
// (No import statement: the run's loader would make this file CommonJS. Node's own modules are reached by
// `process.getBuiltinModule`, jszip through a require made at the repository's root (the run's A11Y_ROOT, else the
// working folder); both only when a journey asks for the file.)
// With `png` (bytes), the golden gains one image as io names it (format.ts): the record { id, type } in project.json's
// `images`, and its bytes at `images/1.png` in the ZIP; nothing else changes.
// With `upright`, the golden's second stop moves from (0.75, 0.5) to (0.25, 1), so its line runs down the picture and
// a picture's shape changes how long it measures (a distance is in image widths: widthsBetween, units.ts).
// With `long`, the golden's clock is made a fixed twenty minutes (one replacement in its text, which throws if the
// golden's words have moved; the route unchanged).
// With `video` ({ width, height }), the golden's export size, 1920 by 1080, is made that one (one replacement in its
// text, which throws if the golden's words have moved): the video's shape, which the preview takes (D202).
// With `trail`, the golden's line drawn "grows" is drawn as a trail (one replacement, which throws if the golden's words
// have moved): the trail runs on after the lead stops, so the play length is longer than the golden's.
const LONG_MS = 1200000;
const projectFile = async (png, upright, long = false, video = null, trail = false) => {
  const root = process.env.A11Y_ROOT || process.cwd();
  const zip = new (process.getBuiltinModule('node:module').createRequire(`${root}/package.json`)('jszip'))();
  const read = process.getBuiltinModule('node:fs').readFileSync(`${root}/src/editor/shell/goldens/two-stops.project.json`, 'utf8');
  if (upright && !read.includes('"x":0.75,"y":0.5')) throw new Error('the golden\'s second stop is no longer at (0.75, 0.5)');
  let golden = upright ? read.replace('"x":0.75,"y":0.5', '"x":0.25,"y":1') : read;
  if (long) {
    const from = '"clock":{"length":"from content","fixedLengthMs":10000,';
    if (golden.split(from).length !== 2) throw new Error('the golden\'s clock no longer reads "from content" with fixedLengthMs 10000, once');
    golden = golden.replace(from, `"clock":{"length":"fixed","fixedLengthMs":${LONG_MS},`);
  }
  if (trail) {
    const from = '"appearance":"grows"';
    if (golden.split(from).length !== 2) throw new Error('the golden\'s line no longer reads "grows", once');
    golden = golden.replace(from, '"appearance":"trail"');
  }
  if (video) {
    const from = '"export":{"width":1920,"height":1080,';
    if (golden.split(from).length !== 2) throw new Error('the golden\'s export no longer reads 1920 by 1080, once');
    golden = golden.replace(from, `"export":{"width":${video.width},"height":${video.height},`);
  }
  if (!png) zip.file('project.json', golden);
  else {
    if (!golden.endsWith('"images":[]}')) throw new Error('the golden no longer ends with its empty images list');
    zip.file('project.json', golden.replace(/"images":\[\]}$/, '"images":[{"id":"golden-5","type":"image/png"}]}'));
    zip.file('images/1.png', png, { createFolders: false }); // as io's Save: no `images/` folder entry, which io refuses
  }
  return { name: png ? 'with-image.zip' : long ? 'long.zip' : trail ? 'trail.zip' : 'two-stops.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) };
};
// A real PNG, 4 by 4, made by the page's own canvas (`toBlob`) in the run.
const canvasPng = async (page) => Buffer.from(await page.evaluate(() => new Promise((resolve) => {
  const c = Object.assign(document.createElement('canvas'), { width: 4, height: 4 });
  const g = c.getContext('2d'); g.fillStyle = '#003a65'; g.fillRect(0, 0, 4, 4);
  c.toBlob(async (b) => resolve([...new Uint8Array(await b.arrayBuffer())]), 'image/png');
})));
// The preview (brief 84): its box, an image named "Route animation preview", and its canvas, read back through the
// page's own context, never a screenshot. `pixels`: its size, a hash of every pixel and how many are drawn at all;
// `pixelAt`: the pixel at fractions of its size. The golden's line and markers are #d55e00.
const PREVIEW = '.preview';
const CANVAS = '.preview__canvas';
const ORANGE = [213, 94, 0];
const BLUE = [51, 102, 204]; // #3366cc, the plain picture's
// 1.4.11 (finding 85, ruled; D200): the preview is set aside from the contrast check on every state that shows it. Its
// pixels are the user's own picture and routes in their own colours, as the export draws them (1.4.11's essential
// presentation). CORE-06 (brief 109) draws the editor's own marks on the same canvas (its points, its lines and the
// selection's rings), never in an SVG or the DOM over it. They are left out of the probe only because they share the
// canvas with the user's picture, and sharing it establishes nothing of their contrast: that is still to be measured,
// by the next chat's (E2) pixel journey, not built yet. The count is reviewed: the graphics standing in the preview on every state
// that declares it, now the canvas alone (the box is an application, no longer an image). A different number found fails
// 1.4.11, so a change to what stands there changes it.
const PREVIEW_ASIDE = [{ selector: PREVIEW, count: 1, reason: "the preview shows the user's own picture and routes in their own colours, as the export will draw them (1.4.11, essential); the editor's own marks (points, lines, the selection's rings) are left out only because they are drawn on the same canvas; their contrast is not measured yet, and is still to be measured by a pixel journey (E2)" }];
// 1.4.11 (CORE-06, brief 117, ruling N; D252): pen-drawn's set-aside carries a measure, which contrastRows runs after
// every other reading of the state's contrast check (helpers.ts). pen-drawn alone draws a route; the two states above
// keep PREVIEW_ASIDE. In pen-drawn (the plain background, no picture, the default settings: two points and their line,
// the second point selected) the route is drawn whole only once the animation reaches its end, so the measure presses
// Skip to end and waits two frames. Where nothing is drawn the canvas is transparent and the box's own background
// shows: the nearest box under the canvas with an opaque background of its own. Each pixel read is composited over that
// background and its ratio taken against it. The line: its most opaque pixel of the seven in the column at the middle
// of the two taps. Each point: its marker, on the two rays from its tap square to the line; out from the tap the pixels
// are fully opaque up to the marker's outer edge (its white rim's antialiased fringe), and the pixel halfway to that
// edge is the marker's fill alone, clear of the line (half its width), of the rim and of the lead's head, which at the
// route's end is drawn over the second point and reaches a third of its size to each side; the lower of the two sides.
// The selected point's ring: the best of the pixels drawn (alpha over 60) and not the route's hue on the ray from the
// second point away from the first, from beyond the marker's outer edge on that ray out to 30 CSS px. Probed (brief
// 117, PROBE-117/probe): at 1280 by 800 the canvas is 704 px wide, the marker's edge 3 px out, the arrow covers the
// second point's centre and 1 px round it, and the ring's dash on that ray is black.
// The guide's line (CORE-06, brief 132, CP; D266, the owner's "Full colour, dashed"): read first, at Skip to start, where
// nothing of the line is drawn yet and the guide drawn while paused (D265) stands alone between the taps. 25 places 1
// canvas px apart along the line, centred between the taps, each the most opaque of the 7 pixels across the line there:
// some are the route's hue (the dashes) and some bare (alpha 0, the gaps, where the box's background shows), or no ratio
// is given (the line drawn there, or nothing); the most opaque of the route's hue is the guide's pixel, its ratio by the
// formula below. A page journey (the-guide) cannot record 1.4.11: the catalogue lists only the contrast method for it,
// and the report refuses a row whose methods a test's does not name (tools/a11y-report.mjs).
// One reader of the canvas for pen-drawn's measure, run in the page (Codex's list line 15: the box's background, the
// compositing, the luminance and the contrast written once for the five marks): at 'start' the guide's line, at 'end'
// the line, both points and the ring, each as described above; null when no box under the canvas has an opaque
// background of its own.
const penMarksRead = (c, [first, second, when]) => {
  let bg = null;
  for (let e = c.parentElement; e && !bg; e = e.parentElement) {
    const v = (getComputedStyle(e).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
    if (v.length === 3 || (v.length === 4 && v[3] === 1)) bg = v.slice(0, 3);
  }
  if (!bg) return null;
  const ctx = c.getContext('2d');
  const at = (fx, fy) => [...ctx.getImageData(Math.floor(fx), Math.floor(fy), 1, 1).data];
  const over = ([r, g, b, a]) => [r, g, b].map((v, i) => (v * a + bg[i] * (255 - a)) / 255);
  const lum = (rgb) => rgb.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (p) => { const [x, y] = [lum(over(p)), lum(bg)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const routeHue = ([r, g, b, a]) => a > 60 && r > 120 && r > g && g >= b;
  const [px, py, qx, qy] = [second[0] * c.width, second[1] * c.height, first[0] * c.width, first[1] * c.height];
  const len = Math.hypot(px - qx, py - qy), [ux, uy] = [(px - qx) / len, (py - qy) / len];
  if (when === 'start') {
    const [mx, my] = [(px + qx) / 2, (py + qy) / 2];
    const places = Array.from({ length: 25 }, (_, k) => {
      let best = [0, 0, 0, 0];
      for (let d = -3; d <= 3; d += 1) { const p = at(mx + ux * (k - 12) - uy * d, my + uy * (k - 12) + ux * d); if (p[3] > best[3]) best = p; }
      return best;
    });
    const hued = places.filter(routeHue), bare = places.filter((p) => p[3] === 0).length;
    const pixel = hued.reduce((best, p) => (p[3] > best[3] ? p : best), [0, 0, 0, 0]);
    // The way arrow (D275; brief 151), two thirds along from the first tap, pointing to the second: 9 places along by
    // 2 to 4 px each side of the line, where the 2-wide guide never reaches; of those the route's hue at alpha 200 or
    // more, red over blue by more than 100 (routeHue alone lets the white edge's rgb(255, 254, 254) through: probed,
    // PROBE-151/probe-3.txt), is the arrow's fill inside its white edge, the most opaque its pixel.
    const [ax, ay] = [qx + ((px - qx) * 2) / 3, qy + ((py - qy) * 2) / 3];
    const fills = [];
    for (let s = -4; s <= 4; s += 1) for (const d of [-4, -3, -2, 2, 3, 4]) { const p = at(ax + ux * s - uy * d, ay + uy * s + ux * d); if (routeHue(p) && p[3] >= 200 && p[0] - p[2] > 100) fills.push(p); }
    const fill = fills.reduce((best, p) => (p[3] > best[3] ? p : best), [0, 0, 0, 0]);
    return { bg: `rgb(${bg.join(', ')})`, pixel, hued: hued.length, bare, ratio: hued.length && bare ? ratio(pixel) : NaN, arrow: { pixel: fill, hued: fills.length, ratio: fills.length ? ratio(fill) : NaN } };
  }
  let line = [0, 0, 0, 0];
  for (let dy = -3; dy <= 3; dy += 1) { const p = at(0.5 * c.width, 0.5 * c.height + dy); if (p[3] > line[3]) line = p; }
  const out = 30 * (c.width / c.getBoundingClientRect().width);
  // The first distance out from (x, y) along (dx, dy) whose pixel is not fully opaque; past `out`, none.
  const edge = (x, y, dx, dy) => { let e = 1; while (e <= out && at(x + dx * e, y + dy * e)[3] === 255) e += 1; return e > out ? NaN : e; };
  const point = (x, y) => Math.min(...[[-uy, ux], [uy, -ux]].map(([dx, dy]) => { const h = Math.round(edge(x, y, dx, dy) / 2); return Number.isFinite(h) ? ratio(at(x + dx * h, y + dy * h)) : NaN; }));
  let ring = 0;
  const rim = edge(px, py, ux, uy);
  for (let d = rim + 1; d <= out; d += 1) { const p = at(px + ux * d, py + uy * d); if (p[3] > 60 && !routeHue(p)) ring = Math.max(ring, ratio(p)); }
  return { bg: `rgb(${bg.join(', ')})`, line: ratio(line), first: point(qx, qy), second: point(px, py), ring: Number.isFinite(rim) ? ring : NaN };
};
const PEN_DRAWN_ASIDE = [{
  selector: PREVIEW,
  count: 1,
  reason: "the user's own picture and routes in their own colours, as the export will draw them, are still set aside (1.4.11, essential); measured are only the editor's own marks at the default settings (the guide's line where only it draws, its way arrow, the line, both points, the selected point's ring) on the plain background with no picture, each against the box's own background",
  measure: async ({ page }) => {
    await page.getByRole('button', { name: 'Skip to start' }).click();
    await twoFrames(page);
    const guide = await page.locator(CANVAS).evaluate(penMarksRead, [...TAPS, 'start']);
    if (!guide) throw new Error('no box with an opaque background stands under the canvas');
    await page.getByRole('button', { name: 'Skip to end' }).click();
    await twoFrames(page);
    const read = await page.locator(CANVAS).evaluate(penMarksRead, [...TAPS, 'end']);
    if (!read) throw new Error('no box with an opaque background stands under the canvas');
    const against = `against the box's background ${read.bg}, in pen-drawn`;
    const guideMark = `the guide's line at the start, where only it draws (its most opaque pixel of the route's hue, rgba(${guide.pixel.join(', ')}); of 25 places along it ${guide.hued} the route's hue, ${guide.bare} bare) against the box's background ${guide.bg}, in pen-drawn`;
    const arrowMark = `the way arrow on the one-way line at the start, two thirds along (its most opaque pixel of the route's hue off the line, rgba(${guide.arrow.pixel.join(', ')}); ${guide.arrow.hued} such of 54 places) against the box's background ${guide.bg}, in pen-drawn`;
    return [{ mark: guideMark, ratio: guide.ratio }, { mark: arrowMark, ratio: guide.arrow.ratio }, ...[['the line', read.line], ['the first point', read.first], ['the second point', read.second], ["the selected point's ring", read.ring]].map(([mark, ratio]) => ({ mark: `${mark} ${against}`, ratio }))];
  },
}];
const pixels = (page) => page.locator(CANVAS).evaluate((c) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let hash = 0, drawn = 0;
  for (let i = 0; i < d.length; i += 4) { hash = (hash * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13 + d[i + 3] * 17) | 0; if (d[i + 3]) drawn += 1; }
  return { width: c.width, height: c.height, hash, drawn };
});
const pixelAt = (page, fx, fy) => page.locator(CANVAS).evaluate((c, [x, y]) => [...c.getContext('2d').getImageData(Math.floor(x * c.width), Math.floor(y * c.height), 1, 1).data], [fx, fy]);
// The most opaque pixel of the seven in a column round that place: a line 3 px thick falls between rows, so the one
// row at its centre may be its anti-aliased edge.
const strokeAt = (page, fx, fy) => page.locator(CANVAS).evaluate((c, [x, y]) => {
  const d = c.getContext('2d').getImageData(Math.floor(x * c.width), Math.floor(y * c.height) - 3, 1, 7).data;
  let best = [0, 0, 0, 0];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > best[3]) best = [d[i], d[i + 1], d[i + 2], d[i + 3]];
  return best;
}, [fx, fy]);
// CORE-06 (brief 128, BN): the most opaque pixel of each column (7 rows, as strokeAt) along 25 columns centred on a
// place: the editor's guide while paused (D265) is dashed 6 on and 4 off in canvas pixels (unitAt(1) whatever the
// pixel ratio), so in any 25 columns it leaves some bare, and only the frame's own line fills every one.
const rowAt = (page, fx, fy) => page.locator(CANVAS).evaluate((c, [x, y]) => {
  const d = c.getContext('2d').getImageData(Math.floor(x * c.width) - 12, Math.floor(y * c.height) - 3, 25, 7).data;
  return Array.from({ length: 25 }, (_, col) => {
    let best = [0, 0, 0, 0];
    for (let row = 0; row < 7; row += 1) { const i = (row * 25 + col) * 4; if (d[i + 3] > best[3]) best = [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
    return best;
  });
}, [fx, fy]);
// CORE-06 (brief 151; D275): the way arrow on a one-way line, read where the guide never reaches. Of the 25 columns
// centred on a place on a level line, the pixels in rows 2 to 4 canvas px above and below the line's row, nearly opaque
// (alpha over 200): `hue` those of the route's colour (near()), `white` those white (each channel over 200). The guide
// is 2 wide (unitAt(1) whatever the pixel ratio) and lights none of them; the arrow (v3's 7 ahead and 4.2 behind and to
// each side, canvas px, edged white 1.5 wide as the marks) lights both. Probed at 1280 by 800 (PROBE-151/probe-guide-2.txt):
// paused, hue 3 and white about 20 at the arrow; none at 0.4 or 0.55 of the way; playing, none.
const arrowAt = (page, fx, fy) => page.locator(CANVAS).evaluate((c, [x, y, rgb]) => {
  const d = c.getContext('2d').getImageData(Math.floor(x * c.width) - 12, Math.floor(y * c.height) - 4, 25, 9).data;
  let hue = 0, white = 0;
  for (const row of [0, 1, 2, 6, 7, 8]) for (let col = 0; col < 25; col += 1) {
    const i = (row * 25 + col) * 4;
    if (d[i + 3] <= 200) continue;
    if (rgb.every((v, k) => Math.abs(d[i + k] - v) <= 24)) hue += 1;
    else if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) white += 1;
  }
  return { hue, white };
}, [fx, fy, ORANGE]);
const near = (p, rgb) => p[3] > 200 && rgb.every((v, i) => Math.abs(p[i] - v) <= 24);
// CORE-06 (brief 114, Codex line 24): the pen's marks in the pen-drawn state, each read where only it draws. At 0:00 the
// animation has drawn the first point alone (its line and the second point appear as the animation reaches them), so it
// skips to the end first. Orange is told by hue (red over green over blue; the selection's ring is white and black) and
// a least opacity, since at 320 CSS px wide the canvas is 256 px and its line's pixels are faint (alpha under 90). The
// line: the most opaque pixel of the column at the middle of the two taps, at alpha over 40. Each point: its marker on
// the far side from the other point, where the line does not reach (its round cap stands out half its width, under a
// pixel), 1 to a marker's radius away along that ray, at alpha over 60. Each is false when its mark is cleared, at 1280
// and at 320 CSS px wide (probed, brief 114).
const TAPS = [[0.45, 0.4], [0.55, 0.6]];
// CORE-06 (brief 116): where the drag journeys take the second point, inside the picture and well clear of the line.
const DRAG_TO = [0.6, 0.42];
const markBeyond = (page, [fx, fy], [ox, oy]) => page.locator(CANVAS).evaluate((c, [x, y, ax, ay]) => {
  const ctx = c.getContext('2d');
  const [px, py, qx, qy] = [x * c.width, y * c.height, ax * c.width, ay * c.height];
  const len = Math.hypot(px - qx, py - qy);
  const reach = Math.max(2, Math.ceil(c.width * 0.006));
  for (let d = 1; d <= reach; d += 1) {
    const [r, g, b, a] = ctx.getImageData(Math.floor(px + ((px - qx) / len) * d), Math.floor(py + ((py - qy) / len) * d), 1, 1).data;
    if (a > 60 && r > 120 && r > g && g >= b) return true;
  }
  return false;
}, [fx, fy, ox, oy]);
// CORE-06 (brief 122; shared by brief 124): the selection's ring round each place, read where only it draws: the pixels
// drawn (alpha over 60) and not the route's hue (orange, as markBeyond tells it) 5 to 9 units from the place. Probed
// (PROBE-122/probe-ring): a selected point's ring gives about 140 such pixels at 1280 by 800, an unselected point none.
const ringsAt = (page, places) => page.locator(CANVAS).evaluate((c, taps) => {
  const unit = c.width / c.getBoundingClientRect().width;
  const ctx = c.getContext('2d');
  return taps.map(([fx, fy]) => {
    const [cx, cy, reach] = [fx * c.width, fy * c.height, Math.ceil(9 * unit) + 1];
    const d = ctx.getImageData(Math.floor(cx) - reach, Math.floor(cy) - reach, 2 * reach + 1, 2 * reach + 1).data;
    let n = 0;
    for (let y = 0; y <= 2 * reach; y += 1) for (let x = 0; x <= 2 * reach; x += 1) {
      const dist = Math.round(Math.hypot(x - reach, y - reach) / unit);
      const i = (y * (2 * reach + 1) + x) * 4;
      const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
      if (dist >= 5 && dist <= 9 && a > 60 && !(r > 120 && r > g && g >= b)) n += 1;
    }
    return n;
  });
}, places);
const orange = ([r, g, b, a], least) => a > least && r > 120 && r > g && g >= b;
// The line is read a third of the way from the first tap, not at its middle (CORE-06, brief 151): the way arrow on a
// one-way line while paused (D275) sits two thirds along, and at 320 CSS px wide (reflow, canvas 256 by 144, the line
// about 38 px) its white edge reaches the middle's column (probed: PROBE-151/probe-reflow.txt); a third along is clear
// of it at every size and still clear of the first point's marker.
const marksDrawn = async (page) => {
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await twoFrames(page);
  const [first, second] = TAPS;
  const third = [0, 1].map((i) => first[i] + (second[i] - first[i]) / 3);
  return { first: await markBeyond(page, first, second), second: await markBeyond(page, second, first), line: orange(await strokeAt(page, ...third), 40) };
};
// True once the canvas is its box times the ratio (to a pixel), within 3 s. CORE-06 (brief 111): Open's busy notice
// takes room from the box while a project opens and gives it back when it goes, so a frame drawn just after an open
// may be at the smaller size; two captures compared by their pixels are taken at the box's settled size.
const sizeSettled = (page) => page.waitForFunction((sel) => {
  const c = document.querySelector(sel), box = c.parentElement.getBoundingClientRect(), s = Math.min(devicePixelRatio, 3);
  return Math.abs(c.width - box.width * s) <= 1 && Math.abs(c.height - box.height * s) <= 1;
}, CANVAS, { timeout: 3000 }).then(() => true, () => false);
const boxOf = (page) => page.locator(PREVIEW).evaluate((e) => { const r = e.getBoundingClientRect(); return { width: r.width, height: r.height, ratio: devicePixelRatio }; });
// Two frames on, so a frame booked by what just happened has been drawn.
const twoFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// The x of a point at `x` across a project with no picture: the scene measures as a square, fitted to the frame's
// height and centred in it (compose.ts), so (width - height) / 2 + x * height, over the width.
const squareX = ({ width, height }, x) => ((width - height) / 2 + x * height) / width;
// A PNG of `w` by `h` of one colour, made by the page's own canvas.
const plainPng = async (page, w, h, colour) => Buffer.from(await page.evaluate(([w, h, colour]) => new Promise((resolve) => {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d'); g.fillStyle = colour; g.fillRect(0, 0, w, h);
  c.toBlob(async (b) => resolve([...new Uint8Array(await b.arrayBuffer())]), 'image/png');
}), [w, h, colour]));
// Counts the frames the composer draws on the page's canvases from now on: it clears the whole frame first, once a
// frame (compose.ts), so each clearRect is one frame.
const countFrames = (page) => page.evaluate(() => {
  window.__frames = 0;
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function (...a) { window.__frames += 1; return clear.apply(this, a); };
});
// A PNG header and nothing more: the signature and a whole IHDR chunk (4 by 4, its check value right), so io reads its
// size and only the browser's decoder can find it damaged.
const headerOnlyPng = () => {
  const ihdr = Buffer.from([0x49, 0x48, 0x44, 0x52, 0, 0, 0, 4, 0, 0, 0, 4, 8, 6, 0, 0, 0]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(process.getBuiltinModule('node:zlib').crc32(ihdr));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), ihdr, crc]);
};
// io's words for an image that does not decode (words.ts, openedInvalid, with images.ts's problem).
const NOT_SHOWN = 'This project could not be opened, because some of it is outside what Route Plotter allows (images[0]: expected a PNG image that can be shown, found a damaged image). Choose a project saved by Route Plotter v4 and not changed since. Nothing was opened.';
const TEXT_FILE = { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Not a project.\n') };
// The same text under a name of 60 characters with no spaces: the refusal's title carries it (brief 80, step 2).
const LONG_NAME = `${'a'.repeat(56)}.txt`;
const LONG_TEXT_FILE = { ...TEXT_FILE, name: LONG_NAME };
// Presses "Open project" (a real click, or `key` with focus on it) and chooses `file` in the chooser it opens; false
// when no chooser opened.
const choose = async (page, file, key) => {
  const chooser = page.waitForEvent('filechooser', { timeout: 3000 }).then((c) => c, () => null);
  if (key) { await page.locator(OPEN).focus(); await page.keyboard.press(key); } else await page.locator(OPEN).click();
  const c = await chooser;
  if (c && file) await c.setFiles(file);
  return c !== null;
};
// Records every text the status region shows from now on, in order; the getter gives the non-empty ones.
const hear = async (page) => {
  await page.evaluate((s) => { const r = document.querySelector(s); window.__heard = []; new MutationObserver(() => window.__heard.push(r.textContent ?? '')).observe(r, { childList: true, characterData: true, subtree: true }); }, STATUS);
  return async () => (await page.evaluate(() => window.__heard)).filter(Boolean);
};
const saysOpened = (page) => page.waitForFunction(([s, w]) => document.querySelector(s)?.textContent === w, [STATUS, OPENED], { timeout: 6000 }).then(() => true, () => false);
// The timeline's position at each of `n` frames: [the frame's time, aria-valuenow].
const sample = (page, n) => page.evaluate(([sel, count]) => new Promise((resolve) => {
  const s = [], el = document.querySelector(sel);
  const tick = (t) => { s.push([t, Number(el.getAttribute('aria-valuenow'))]); if (s.length < count) requestAnimationFrame(tick); else resolve(s); };
  requestAnimationFrame(tick);
}), [TIMELINE, n]);
const backwards = (s) => s.slice(1).flatMap(([, v], i) => (v < s[i][1] ? [`${s[i][1]} to ${v}`] : []));
const playLabel = (page) => page.locator(PLAY).textContent();
// Whether the one button named `name` (its accessible name, exactly) is the element `handle`, still connected: the
// play bar's claim, one element whose words change, so focus stays on it.
const isNamed = (page, name, handle) => page.getByRole('button', { name, exact: true }).evaluate((e, h) => e === h && e.isConnected, handle, { timeout: 3000 }).catch(() => false);
// The journeys' project opened and the status region quiet again, then Tab from "Skip to start" onto Play: true when
// focus is on Play. `key` then presses it; `twice`, the same key again once "Playing animation" is said.
async function playKeyOnScene(page, key, twice) {
  if (!(await choose(page, await projectFile())) || !(await saysOpened(page)) || !(await quiet(page))) return false;
  await page.locator(SKIP_START).focus();
  await page.keyboard.press('Tab');
  if (!(await focusOn(page, PLAY))) return false;
  const button = await page.locator(PLAY).elementHandle();
  await page.keyboard.press(key);
  if (!(await comesToWords(page, PLAYING)) || !(await isNamed(page, 'Pause', button)) || !(await focusOn(page, PLAY))) return false;
  if (!twice) return true;
  await page.keyboard.press(key);
  return (await comesToWords(page, PAUSED)) && (await isNamed(page, 'Play', button)) && focusOn(page, PLAY);
}
const alerts = (page) => page.locator('[role=alert]');
// J or L on "Open project" (brief 76's ruling 4: they do what they do on any button). The journeys' project opened by
// a press of the button (for J, a press on the timeline's track then puts the position at its middle), focus put back
// on the button and, before the key, a reader started in the page that writes down at every frame the position
// (aria-valuenow) and the status region's words, until "Animation complete" is said for J ("Playing animation" said
// and the position past where it started, for L), or 10 s. Nothing is judged at the moment a message shows (brief 97):
// "Playing animation" waits behind "Project opened" for whatever is left of its two seconds while the reverse from the
// middle takes about three, so a reading taken when the words show can come after the position has reached 0
// (FINDING-97). Checked from the frames: J starts at or under 510, never goes up, stands at some frame strictly between
// 0 and where it started, and ends at 0, with "Playing animation" and then "Animation complete" said. L starts at 1000,
// where an open leaves the position (its end: D251, brief 127), and so restarts from 0, as Play does at the end
// (DEF-62): it goes down once, to 50 or under, never goes down again, and ends past its lowest, with "Playing
// animation" said; its reader stops once the position has risen past its lowest. Then focus is still on the button and the key opened
// no file chooser. (FINDING-78's crash of J after a press, Carbon's late echo, is mended: brief 79.)
const PLAYING = 'Playing animation';
const COMPLETE = 'Animation complete';
const comesToWords = (page, w) => page.waitForFunction(([s, words]) => document.querySelector(s)?.textContent === words, [STATUS, w], { timeout: 6000 }).then(() => true, () => false);
async function playsFromOpen(page, key) {
  if (!(await choose(page, await projectFile())) || !(await saysOpened(page))) return false;
  if (key === 'j') {
    const middle = await onTrack(page, 0.5);
    await page.mouse.click(middle.x, middle.y);
    if (!(await comesTo(page, 'Math.abs(n - 500) <= 10'))) return false;
  }
  let choosers = 0;
  page.on('filechooser', () => { choosers++; });
  await page.locator(OPEN).focus();
  // The reader's first frame is read now, before the key; the rest at each frame after it.
  await page.evaluate(([t, s, playing, complete, back]) => {
    const frames = [], until = performance.now() + 10000;
    window.__fromOpen = new Promise((resolve) => {
      const tick = () => {
        const n = Number(document.querySelector(t)?.getAttribute('aria-valuenow'));
        const said = document.querySelector(s)?.textContent ?? '';
        frames.push([n, said]);
        const done = back ? said === complete : frames.some((f) => f[1] === playing) && n > Math.min(...frames.map((f) => f[0]));
        if (done || performance.now() > until) resolve(frames); else requestAnimationFrame(tick);
      };
      tick();
    });
  }, [TIMELINE, STATUS, PLAYING, COMPLETE, key === 'j']);
  await page.keyboard.press(key);
  const frames = await page.evaluate(() => window.__fromOpen);
  const at = frames.map(([n]) => n), start = at[0], end = at.at(-1);
  const steps = at.slice(1).map((n, i) => n - at[i]);
  const words = frames.map(([, w]) => w).filter((w, i, all) => w && w !== all[i - 1]);
  const playedAt = words.indexOf(PLAYING);
  const moved = key === 'j'
    ? start <= 510 && steps.every((d) => d <= 0) && at.some((n) => n > 0 && n < start) && end === 0 && playedAt !== -1 && words.indexOf(COMPLETE, playedAt) > playedAt
    : start === 1000 && steps.filter((d) => d < 0).length === 1 && Math.min(...at) <= 50 && end > Math.min(...at) && playedAt !== -1;
  return moved && (await focusOn(page, OPEN)) && choosers === 0;
}
// Open Help by its button from the keyboard, Tab to its switch, press Space, close it by Escape. The switch is drawn
// only while Help is open: what it said before and after the press, and whether focus came back to "Help".
async function flipByKeyboard(page) {
  await helpButton(page).focus();
  await page.keyboard.press('Enter');
  await helpDialog(page).waitFor();
  for (let i = 0; i < 6 && !(await focusIs(page, SWITCH)); i++) await page.keyboard.press('Tab');
  const before = await singleKeys(page).getAttribute('aria-checked');
  await page.keyboard.press('Space');
  const after = await singleKeys(page).getAttribute('aria-checked');
  await page.keyboard.press('Escape');
  return { before, after, back: await backOnHelp(page) };
}
// What Help shows, as reviewed: its close button, heading, the three groups of the key table (Editing added by brief
// 123, its two nudge rows by brief 125) and the switch. With the third table its content no longer fits a 1280 by 800 window, so the kit's dialog
// (Carbon) makes it a scrollable region named Help, which holds the tables and the switch. The chords
// read Cmd on a Mac and Ctrl elsewhere; a punctuation key is read by its name (comma, full stop, less than, greater
// than, question mark). Carbon's "Close" tooltip, shown while Close has focus, is not listed. Behind
// it, the play bar's Play stays disabled (a stated node, so listed).
// Reviewed (brief 141, FF; Codex list line 18): the point's menu open on pen-drawn's first point, read from the page
// (PROBE-141/run-snap): "Point actions" in document.body, its items in order with their states. "Set lead start" is
// off, its reason beside it, as the lead already starts at the first point (D267 (a)); a separator stands before
// Delete. The rest of the page is as pen-drawn's snapshot has it, behind the menu.
const POINT_MENU_OPEN = [
  '- menu "Point actions":',
  '  - menuitem "Mark as start"',
  '  - menuitem "Mark as end"',
  '  - menuitem "Set lead start" [disabled]',
  '  - menuitem "Make bend"',
  '  - menuitem "Move"',
  '  - separator',
  '  - menuitem "Delete"',
].join('\n');
const helpOpen = (checked) => [
  '- group "Playback":',
  '  - button "Play" [disabled]',
  '- dialog "Help":',
  '  - button "Close"',
  '  - heading "Help" [level=2]',
  '  - region "Help":',
  '    - table "Playback":',
  '      - caption: Playback',
  '      - rowgroup:',
  '        - row "Play/pause Space K"',
  '        - row "Play reverse J"',
  '        - row "Play forward L"',
  '        - row "Skip to start Home less than"',
  '        - row "Skip to end End greater than"',
  '        - row "Step back one frame comma"',
  '        - row "Step forward one frame full stop"',
  '    - table "General":',
  '      - caption: General',
  '      - rowgroup:',
  '        - row /Open project (Cmd|Ctrl)\\+O/',
  '        - row /Undo (Cmd|Ctrl)\\+Z/',
  '        - row /Redo (Cmd|Ctrl)\\+Shift\\+Z/',
  '        - row "Open help question mark"',
  '    - table "Editing":',
  '      - caption: Editing',
  '      - rowgroup:',
  '        - row "Delete the selected points Delete Backspace"',
  '        - row /Duplicate the selected points (Cmd|Ctrl)\\+D/',
  '        - row /Select all points (Cmd|Ctrl)\\+A/',
  '        - row "Nudge the selected points Left arrow Right arrow Up arrow Down arrow"',
  '        - row "Nudge them further Shift+Left arrow Shift+Right arrow Shift+Up arrow Shift+Down arrow"',
  `    - switch "Single-key shortcuts"${checked ? ' [checked]' : ''}`,
  '    - paragraph: Turned off, K, J, L, <, >, comma, full stop and ? do nothing. Space, Home, End, Delete, Backspace, Open project, Undo, Redo, Duplicate and Select all keep working.',
].join('\n');
// The processes the shell presents (CONF03): none. A process is a series of steps toward a goal inside the app; the
// shell has no form and no link at all (its one link, to a page it did not own, went with D209). The item that adds a
// process names it here and writes the journey that runs every step.
const PROCESSES = [];

// What the journeys look for: every control a pointer or Tab reaches (the pack's target selector); fields and
// settings; content a control opens; status regions.
const CONTROLS = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], [role=option], [role=slider], [role=spinbutton], [role=combobox], [tabindex]:not([tabindex="-1"])';
const FIELDS = 'input:not([type=hidden]), select, textarea, [contenteditable=""], [contenteditable=true], [role=textbox], [role=searchbox], [role=combobox], [role=spinbutton], [role=slider], [role=checkbox], [role=radio], [role=switch], [role=listbox]';
const OPENS = '[aria-expanded], [aria-haspopup], [aria-controls], details, dialog, [role=dialog], [role=alertdialog]';
const LIVE = '[role=status], [role=alert], [role=log], [role=marquee], [role=timer], [role=progressbar], [aria-live], output';

// No test reaches the network: a page outside the app is answered by this local stand-in, any other request refused.
const STAND_IN = '<!doctype html><html lang="en-GB"><title>Outside Route Plotter</title><main><p>A local stand-in for a page outside Route Plotter.</p></main></html>';
async function offline({ page }) {
  await page.route((url) => url.origin !== ORIGIN, (route) => (route.request().isNavigationRequest()
    ? route.fulfill({ status: 200, contentType: 'text/html', body: STAND_IN })
    : route.abort()));
}
// The shell as a reader meets it once it has settled (its h1 is the header's, outside main, since the frame). React draws it after the page's load event, and its bundled IBM
// Plex fonts load only then: on CI's Linux runner, whose fallback font is wider, the link moved 63 px when they arrived,
// after the focus test had measured it (wish STACK-03.6). Each state opens offline and settled: drawn, laid out, and its
// fonts loaded.
async function settled({ page }) {
  await offline({ page });
  await page.locator('header h1').waitFor();
  await page.evaluate(async () => { void document.body.getBoundingClientRect(); await document.fonts.ready; });
}
const arrives = (page, url) => page.waitForURL(url, { timeout: 5000 }).then(() => true, () => false);
const named = async (locator) => (await locator.ariaSnapshot()).split('\n')[0].replace(/^- /, '').replace(/:$/, '');
// Tab from a fresh open until focus leaves the page or comes round: each control met, by role and name, and where it
// sits; the problems against the reviewed order (2.4.3).
async function tabOrder(page, tab) {
  const order = [], tops = [];
  for (let i = 0; i < 40; i++) {
    await tab();
    const focused = page.locator(':focus');
    if (!(await focused.count())) break;
    const name = await named(focused);
    if (order.includes(name)) break;
    order.push(name);
    tops.push((await focused.boundingBox())?.y ?? 0);
  }
  const problems = [];
  if (JSON.stringify(order) !== JSON.stringify(FOCUS)) problems.push(`Tab meets ${JSON.stringify(order)}, reviewed ${JSON.stringify(FOCUS)}`);
  tops.forEach((t, i) => { if (i && t < tops[i - 1] - 1) problems.push(`${order[i]} sits above ${order[i - 1]}, which Tab meets first`); });
  return { order, problems };
}

export default {
  // How the gate reaches the app: a base URL, and the command that serves it on that URL (or null if already served).
  baseURL: ORIGIN,
  server: { command: 'npm run preview -- --port 4173 --strictPort --configLoader native', url: ORIGIN },
  // Source the lint step reads with the project's ESLint configuration, which imports eslint.a11y.mjs.
  lint: ['src'],
  // The house target size for SUP03, in CSS px.
  houseTarget: 44,
  // Each UI state: a name, a path, optional setup with real input, a reviewed ARIA snapshot (a row is credited only
  // when the snapshot lists, with names and states, every node of the roles it speaks to), dialogs, the interactions
  // whose motion the reduced-motion check samples (an empty list declares that none triggers motion), each with the
  // reviewed snapshot taken after it where a control's state changes (4.1.2), and what reflow, text spacing, forced colours and both orientations must keep:
  // content and cue selectors, and functions that return true when they still work.
  states: [
    {
      name: 'shell',
      path: '/',
      setAside: PREVIEW_ASIDE,
      setup: settled,
      snapshot: [
        '- banner "Route Plotter":',
        '  - heading "Route Plotter" [level=1]',
        '  - button "Open project"',
        '  - button "Help"',
        '- main:',
        '  - region "Preview":',
        '    - heading "Preview" [level=2]',
        '    - application "Route animation preview"',
        '  - group "Playback":',
        '    - button "Skip to start"',
        '    - button "Play" [disabled]',
        '    - button "Skip to end"',
        '    - text: Timeline 0:00',
        '    - slider "Timeline"',
        '    - text: 0:02',
        `  - paragraph: ${NOTHING_TO_PLAY}`,
        '  - status',
      ].join('\n'),
      dialogs: [{ name: 'help', opener: HELP }],
      interactions: [
        { name: 'focus the preview', run: async ({ page }) => { await page.locator(PREVIEW).focus(); } },
        { name: 'open help', run: async ({ page }) => { await helpButton(page).click(); await helpDialog(page).waitFor(); }, snapshot: helpOpen(true) },
        {
          name: 'turn single-key shortcuts off',
          run: async ({ page }) => { await helpButton(page).click(); await singleKeys(page).click(); },
          snapshot: helpOpen(false),
        },
        // The skips change no control's state: Play stays disabled, so no snapshot after them.
        { name: 'skip to start by its button', run: async ({ page }) => { await page.locator(SKIP_START).click(); } },
        { name: 'skip to end by its button', run: async ({ page }) => { await page.locator(SKIP_END).click(); } },
        // A key on the timeline moves its thumb: Carbon's slider draws no motion of its own for a key beyond the knob's.
        { name: 'move the timeline by a key', run: async ({ page }) => { await page.locator(TIMELINE).focus(); await page.keyboard.press('Shift+ArrowRight'); } },
      ],
      keeps: {
        content: ['h1', 'main p', PREVIEW, REASON],
        functions: [
          { name: 'focus the preview', run: async ({ page }) => { await page.locator(PREVIEW).focus(); return focusOn(page, PREVIEW); } },
          // Help is closed again after, so the page is left as found (the forced-colours test counts stateful controls next).
          { name: 'open help', run: async ({ page }) => { await helpButton(page).click(); const shown = await helpDialog(page).isVisible(); await page.keyboard.press('Escape'); return shown && backOnHelp(page); } },
          { name: 'skip to start by its button', run: async ({ page }) => { await page.locator(SKIP_START).click(); return (await said(page)) === SKIPPED_TO_START; } },
          { name: 'skip to end by its button', run: async ({ page }) => { await page.locator(SKIP_END).click(); return (await said(page)) === SKIPPED_TO_END; } },
          { name: 'move the timeline by a key', run: async ({ page }) => { await page.locator(SKIP_START).click(); await page.locator(TIMELINE).focus(); await page.keyboard.press('Shift+ArrowRight'); return (await atNow(page)).now === 4; } },
        ],
      },
    },
    {
      // Open's refusal showing, for a text file whose name is 60 characters with no spaces (stage 6, brief 80): its
      // title and io's sentence wrap inside the page at 320 px, nothing cut and no sideways scroll (1.4.10, reflow),
      // and, at the pack's 1280 by 800 (its focus walk's size, keyboard.spec.ts), no control that takes focus is covered
      // by it (2.4.12, focus). The name breaks anywhere (frameLook.css). The focus walk at 320 px (Codex on brief 81) is
      // a keep below (brief 96): no journey may credit 2.4.12 (it lists only the pack's focus method, and a journey's
      // method must be j- or keyboard, tools/a11y-run.mjs), so it is kept under each adaptation where the state's keeps are.
      name: 'refused-long-name',
      path: '/',
      setAside: PREVIEW_ASIDE,
      // The choice leaves focus on "Open project" (the claim: refused-close-returns-focus); the pack's walk Tabs on from
      // wherever focus stands and stops when it leaves the page, so from there it never comes back to Open (6 of 7,
      // brief 81). A press on the banner's blank corner puts the Tab starting point at the document's start, where the
      // other state's walk starts; a blur would not (Chromium keeps the starting point on Open). Nothing is hidden by it:
      // every control is still reached by Tab alone, Open first.
      setup: async ({ page }) => { await settled({ page }); await choose(page, LONG_TEXT_FILE); await alerts(page).waitFor(); await page.mouse.click(1, 1); },
      snapshot: [
        '- banner "Route Plotter":',
        '  - heading "Route Plotter" [level=1]',
        '  - button "Open project"',
        '  - button "Help"',
        '- main:',
        '  - alert:',
        '    - img "Error"',
        `    - text: Could not open ${LONG_NAME} ${NOT_A_PROJECT}`,
        '    - button "Close"',
        '  - region "Preview":',
        '    - heading "Preview" [level=2]',
        '    - application "Route animation preview"',
        '  - group "Playback":',
        '    - button "Skip to start"',
        '    - button "Play" [disabled]',
        '    - button "Skip to end"',
        '    - text: Timeline 0:00',
        '    - slider "Timeline"',
        '    - text: 0:02',
        `  - paragraph: ${NOTHING_TO_PLAY}`,
        '  - status',
      ].join('\n'),
      dialogs: [],
      // Nothing here draws motion: the notice stands until it is closed.
      interactions: [],
      keeps: {
        content: ['[role=alert] .cds--inline-notification__title', '[role=alert] .cds--inline-notification__subtitle'],
        functions: [
          { name: 'close the notice', run: async ({ page }) => { await alerts(page).getByRole('button', { name: 'Close' }).click(); return (await alerts(page).count()) === 0 && focusOn(page, OPEN); } },
          // With the notice showing, the window 320 px wide (put back after): Tab from the document's start through every
          // control, seven by name and in order, and at each the pack's grid of hit tests across the focused control
          // (focusStep in helpers.ts, its 2.4.12 evidence), each finding the control, a part of it or an ancestor. Three
          // differences from the pack's measure, ruled by orchestrator 28 (CONTINUE-83, B) for this keep only, since at
          // 320 px a control flush with the window's edge, or a pixel or two under the fold, finds nothing there:
          // (i) after each Tab the control's box is read against the window first, and more than 1 px of it outside the
          // window is its own failure, "outside the window after Tab" (nothing here scrolls it in); (ii) only grid points
          // at least 1 px inside the window on every side are sampled, and the record counts those at the edge, not
          // sampled; (iii) a sampled point that finds nothing, or anything but the control, a part of it or an ancestor,
          // fails, naming what covered it. The notice must still be showing at the end. Throws what it saw.
          {
            name: 'walk the seven controls at 320 px with the notice showing, none outside the window or covered in any part',
            run: async ({ page }) => {
              const size = page.viewportSize();
              try {
                await page.setViewportSize({ width: 320, height: size.height });
                const key = page.context().browser()?.browserType().name() === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'; // the pack's tabKey
                const seven = ['Open project', 'Help', 'Close', 'Route animation preview', 'Skip to start', 'Skip to end', 'Timeline'];
                const walked = [], problems = [], edges = [];
                for (let i = 0; i < 20; i++) {
                  await page.keyboard.press(key);
                  const at = await page.evaluate(() => {
                    const e = document.activeElement;
                    if (!e || e === document.body) return null;
                    const r = e.getBoundingClientRect(), W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
                    const out = Math.max(0, -r.left, r.right - W, -r.top, r.bottom - H);
                    const step = Math.max(2, Math.sqrt((r.width * r.height) / 1600));
                    const points = [];
                    for (let x = r.x + 0.5; x < r.x + r.width; x += step) for (let y = r.y + 0.5; y < r.y + r.height; y += step) points.push([x, y]);
                    for (const [x, y] of [[r.x + r.width - 0.5, r.y + 0.5], [r.x + 0.5, r.y + r.height - 0.5], [r.x + r.width - 0.5, r.y + r.height - 0.5]]) points.push([x, y]);
                    const inside = points.filter(([x, y]) => x >= 1 && x <= W - 1 && y >= 1 && y <= H - 1);
                    const misses = inside.filter(([x, y]) => { const h = document.elementFromPoint(x, y); return !(h && (h === e || e.contains(h) || h.contains(e))); });
                    const by = misses.map(([x, y]) => document.elementFromPoint(x, y)).map((h) => (!h ? 'nothing' : h.closest('[role=alert]') ? 'the alert' : h.tagName.toLowerCase()));
                    return { out: Math.round(out * 100) / 100, misses: misses.length, of: inside.length, edge: points.length - inside.length, by: [...new Set(by)] };
                  });
                  if (!at) break;
                  const name = /"([^"]*)"/.exec(await page.locator(':focus').ariaSnapshot())?.[1] ?? '?';
                  if (walked.length && name === walked[0]) break;
                  walked.push(name);
                  if (at.out > 1) problems.push(`${name} ${at.out} px outside the window after Tab`);
                  if (at.misses) problems.push(`${name} covered at ${at.misses}/${at.of} sampled points by ${at.by.join(', ')}`);
                  if (at.edge) edges.push(`${name} ${at.edge}`);
                }
                if (JSON.stringify(walked) !== JSON.stringify(seven)) throw new Error(`walked ${walked.join(', ')}`);
                if (problems.length) throw new Error(`${problems.join('; ')} (at the edge, not sampled: ${edges.join(', ') || 'none'})`);
                if (!(await alerts(page).isVisible())) throw new Error('the notice was gone');
                console.log(`focus walk at 320 px: ${walked.length} walked, none outside the window or covered; at the edge, not sampled: ${edges.join(', ') || 'none'}`);
                return true;
              } finally {
                await page.setViewportSize(size);
              }
            },
          },
        ],
      },
    },
    {
      // CORE-06 (brief 109, ruling 11; built by brief 113): the pen has drawn. On the plain background (no picture), two
      // taps on nothing: two points and one line, the second point selected. The setup waits for the frame itself, never
      // on the page having settled alone: the canvas at its box's size, two frames drawn after each tap, and the canvas
      // then holding what it did not hold before the taps (it throws if not). A press on the banner's blank corner then
      // puts the Tab starting point at the document's start, as refused-long-name's does; it is not on the canvas. Last,
      // it waits until no transition runs on the page, for the final state only. Brief 114 (Codex line 23) measured
      // Play during its enabling transition: Carbon faded its background over 70 ms under text already white, 1.71:1 at
      // worst (the 6.10:1 brief 113 met was one frame of it); the theme no longer fades Play's background, and the
      // setup throws if Play's transition names its background again, so the frames before the wait are held to 7:1.
      name: 'pen-drawn',
      path: '/',
      setAside: PEN_DRAWN_ASIDE,
      setup: async ({ page }) => {
        await settled({ page });
        if (!(await sizeSettled(page))) throw new Error('the canvas was not its box times the ratio');
        await twoFrames(page);
        const empty = await pixels(page);
        const box = await page.locator(PREVIEW).boundingBox();
        for (const [fx, fy] of TAPS) {
          await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
          await twoFrames(page);
        }
        if ((await pixels(page)).hash === empty.hash) throw new Error('two taps on the preview drew nothing');
        const fades = await page.locator('#play-pause').evaluate((el) => getComputedStyle(el).transitionProperty);
        if (/\b(all|background(-color)?)\b/.test(fades)) throw new Error(`Play's background fades as it is enabled (${fades})`);
        await page.mouse.click(1, 1);
        // Play has just been enabled: the final state is measured once the page's transitions have ended.
        await page.waitForFunction(() => document.getAnimations().length === 0, undefined, { timeout: 3000 });
        // The taps' "Point added" (brief 134, ruling CV; D263, D268) holds the status region for its two seconds: the
        // state is the editor at rest, its status empty, as the snapshot below has it. Measured (brief 134): without this
        // wait the status still read "Point added" as the set-up ended, and the snapshot (a partial match) passed anyway.
        if (!(await page.waitForFunction((s) => (document.querySelector(s)?.textContent ?? '') === '', STATUS, { timeout: 6000 }).then(() => true, () => false))) throw new Error('the status region did not come back to empty after the taps');
      },
      // Reviewed (brief 113): as the shell's, but two points joined by a line make a route that plays, so Play is
      // enabled, the reason it was not is gone, and the timeline runs to the route's length (0:04).
      snapshot: [
        '- banner "Route Plotter":',
        '  - heading "Route Plotter" [level=1]',
        '  - button "Open project"',
        '  - button "Help"',
        '- main:',
        '  - region "Preview":',
        '    - heading "Preview" [level=2]',
        '    - application "Route animation preview"',
        '  - group "Playback":',
        '    - button "Skip to start"',
        '    - button "Play"',
        '    - button "Skip to end"',
        '    - text: Timeline 0:00',
        '    - slider "Timeline"',
        '    - text: 0:04',
        '  - status',
      ].join('\n'),
      dialogs: [],
      // Nothing here draws motion: the points stand until they are edited. "open point menu" (brief 141, FF; Codex list
      // line 18): a right-click on the first point opens "Point actions"; its reviewed snapshot is the catalogue's
      // evidence for 4.1.2 for the menu (each item's role, name and state). No axe runs on the open menu (a menu-open
      // state would add 14 tests a run, and the menu closes on Tab and blur inside three of them); the reduced-motion
      // test now samples this interaction too.
      interactions: [
        {
          name: 'open point menu',
          run: async ({ page }) => {
            const box = await page.locator(PREVIEW).boundingBox();
            const [fx, fy] = TAPS[0];
            await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy, { button: 'right' });
            await page.locator('[role=menu]').waitFor();
          },
          snapshot: POINT_MENU_OPEN,
        },
      ],
      keeps: {
        content: [PREVIEW],
        functions: [
          // Brief 114 (Codex line 24): each mark read where only it draws, at the route's end (marksDrawn).
          { name: 'at the route\'s end, both points and their line are drawn where tapped', run: async ({ page }) => { const m = await marksDrawn(page); return m.first && m.second && m.line; } },
        ],
      },
    },
    // { name: 'home', path: '/', snapshot: '- main:\n  - heading "Home" [level=1]', dialogs: [{ name: 'help', opener: '#help' }],
    //   interactions: [{ name: 'open menu', run: async ({ page }) => page.getByRole('button', { name: 'Menu' }).click(), snapshot: '- button "Menu" [expanded]' }],
    //   keeps: { content: ['h1', '#total'], cues: ['#saved-icon'], functions: [{ name: 'save', run: async ({ page }) => { await page.getByRole('button', { name: 'Save' }).click(); return page.getByRole('status').isVisible(); } }] } },
  ],
  // Keyboard functions run at no delay and with long gaps between keys: steps of { focus }, { press } or { type }.
  keyboardFunctions: [
    // The editor's keys act with the preview focused (CORE-06), and focus stays on it.
    { name: 'skip-to-end-by-end-on-preview', state: 'shell', steps: [{ focus: PREVIEW }, { press: 'End' }], check: async ({ page }) => (await said(page)) === SKIPPED_TO_END && focusOn(page, PREVIEW) },
    // The editor's keys, each checked by the words it says in the status region.
    { name: 'skip-to-start-by-home', state: 'shell', steps: [{ press: 'Home' }], check: async ({ page }) => (await said(page)) === SKIPPED_TO_START },
    { name: 'skip-to-end-by-end', state: 'shell', steps: [{ press: 'End' }], check: async ({ page }) => (await said(page)) === SKIPPED_TO_END },
    // Comma and full stop step one frame (D205): the empty shell's scene is 2 s long and its export frame rate 25, so a
    // frame is 40 ms, 20 thousandths on the timeline. From a pause a step says nothing (the status region stays empty a
    // second after it, so neither a skip's words nor any other are said); the timeline's value carries it.
    { name: 'step-forward-by-full-stop', state: 'shell', steps: [{ press: '.' }], check: async ({ page }) => (await comesTo(page, 'n === 20')) && saysNothing(page) },
    { name: 'step-back-by-comma', state: 'shell', steps: [{ press: '.' }, { press: '.' }, { press: '.' }, { press: ',' }], check: async ({ page }) => (await comesTo(page, 'n === 40')) && saysNothing(page) },
    // Help: opened by its button and by `?` (focus moves in), closed by Escape with focus back on "Help"; its switch
    // turned off and on again by Space.
    { name: 'open-help-by-button', state: 'shell', steps: [{ focus: HELP }, { press: 'Enter' }], check: async ({ page }) => (await helpDialog(page).isVisible()) && helpDialog(page).evaluate((e) => e.contains(document.activeElement)) },
    { name: 'open-help-by-question-mark', state: 'shell', steps: [{ press: '?' }], check: async ({ page }) => (await helpDialog(page).isVisible()) && helpDialog(page).evaluate((e) => e.contains(document.activeElement)) },
    { name: 'close-help-by-escape', state: 'shell', steps: [{ focus: HELP }, { press: 'Enter' }, { press: 'Escape' }], check: async ({ page }) => !(await helpDialog(page).isVisible()) && backOnHelp(page) },
    { name: 'single-keys-off', state: 'shell', steps: [{ focus: HELP }, { press: 'Enter' }, { focus: SWITCH }, { press: 'Space' }], check: async ({ page }) => (await singleKeys(page).getAttribute('aria-checked')) === 'false' },
    { name: 'single-keys-on', state: 'shell', steps: [{ focus: HELP }, { press: 'Enter' }, { focus: SWITCH }, { press: 'Space' }, { press: 'Space' }], check: async ({ page }) => (await singleKeys(page).getAttribute('aria-checked')) === 'true' },
    // The play bar's skips by their buttons, focus staying on the button. A focused button keeps Space and Enter
    // (dispatch.ts's point 2): Space on "Skip to end" presses it alone, and Play/pause, Space's own action, never runs.
    { name: 'skip-to-start-by-button', state: 'shell', steps: [{ focus: SKIP_START }, { press: 'Enter' }], check: async ({ page }) => (await said(page)) === SKIPPED_TO_START && focusOn(page, SKIP_START) },
    { name: 'skip-to-end-by-button-space-kept', state: 'shell', steps: [{ focus: SKIP_END }, { press: 'Space' }], check: async ({ page }) => (await said(page)) === SKIPPED_TO_END && (await focusOn(page, SKIP_END)) && neverSays(page, NOTHING_TO_PLAY) },
    // Nothing to play on this page: Space off any button, and K, J and L on a button and off it, say why and start nothing.
    { name: 'play-refused-by-space', state: 'shell', steps: [{ press: 'Space' }], check: async ({ page }) => (await said(page)) === NOTHING_TO_PLAY },
    { name: 'play-refused-by-k', state: 'shell', steps: [{ press: 'k' }], check: async ({ page }) => (await said(page)) === NOTHING_TO_PLAY },
    { name: 'play-refused-by-k-on-button', state: 'shell', steps: [{ focus: SKIP_START }, { press: 'k' }], check: async ({ page }) => (await said(page)) === NOTHING_TO_PLAY && focusOn(page, SKIP_START) },
    { name: 'play-refused-by-j-on-button', state: 'shell', steps: [{ focus: SKIP_START }, { press: 'j' }], check: async ({ page }) => (await said(page)) === NOTHING_TO_PLAY && focusOn(page, SKIP_START) },
    // "Open project" (stage 6): Enter and Space on it open the browser's file chooser, and a project chosen through it
    // opens; Space starts no playing (Space is Play's key elsewhere; on the empty scene a leak would say why Play is
    // off); K on it is K anywhere (on the empty scene, the refusal), focus kept. No key opens a file elsewhere.
    { name: 'open-by-enter-on-button', state: 'shell', steps: [{ focus: OPEN }], check: async ({ page }) => (await choose(page, await projectFile(), 'Enter')) && (await saysOpened(page)) && focusOn(page, OPEN) },
    { name: 'open-by-space-plays-nothing', state: 'shell', steps: [{ focus: OPEN }], check: async ({ page }) => (await choose(page, null, 'Space')) && (await neverSays(page, NOTHING_TO_PLAY)) && !(await said(page)) && focusOn(page, OPEN) },
    // Cmd or Ctrl+O (D207) opens the page's own file chooser from wherever focus is, the key cancelled so the browser's
    // own "Open File" does not open; with Help open it opens nothing and is still cancelled. A scripted press does not
    // pass through Chrome's own shortcuts: that Chrome hands a real Cmd or Ctrl+O to the page is not shown here.
    { name: 'open-by-command-o', state: 'shell', steps: [{ focus: TIMELINE }], check: async ({ page }) => { const { opened, taken } = await pressOpenKey(page); return opened && taken && focusOn(page, TIMELINE); } },
    { name: 'command-o-in-help-opens-nothing', state: 'shell', steps: [{ focus: HELP }, { press: 'Enter' }], check: async ({ page }) => { const { opened, taken } = await pressOpenKey(page, 1500); return !opened && taken && helpDialog(page).isVisible(); } },
    { name: 'play-refused-by-k-on-open', state: 'shell', steps: [{ focus: OPEN }, { press: 'k' }], check: async ({ page }) => (await said(page)) === NOTHING_TO_PLAY && focusOn(page, OPEN) },
    // With the project opened, L on it plays forward and J plays back (from the start, into it), as on any button; no
    // chooser, focus kept.
    { name: 'play-forward-by-l-on-open', state: 'shell', steps: [{ focus: OPEN }], check: async ({ page }) => playsFromOpen(page, 'l') },
    { name: 'play-reverse-by-j-on-open', state: 'shell', steps: [{ focus: OPEN }], check: async ({ page }) => playsFromOpen(page, 'j') },
    // The play bar on a scene (stage 6): Tab onto Play, Space plays ("Playing animation", the same button now named
    // "Pause", focus on it); Enter on it then pauses ("Animation paused", named "Play" again, focus kept).
    { name: 'play-by-space-on-a-scene', state: 'shell', steps: [{ focus: OPEN }], check: async ({ page }) => playKeyOnScene(page, 'Space') },
    { name: 'pause-by-enter-on-a-scene', state: 'shell', steps: [{ focus: OPEN }], check: async ({ page }) => playKeyOnScene(page, 'Enter', true) },
    { name: 'play-refused-by-l-on-button', state: 'shell', steps: [{ focus: SKIP_END }, { press: 'l' }], check: async ({ page }) => (await said(page)) === NOTHING_TO_PLAY && focusOn(page, SKIP_END) },
    // The timeline: an arrow moves it one thousandth and Shift with it four (Carbon's), and the words hold until a whole
    // second is passed; End off it skips and its thumb follows, drawn at the track's end, and Home brings it back to the
    // start; on it, K says the refusal and Escape with no drag keeps focus and the position. Home, End, Page Up and Page
    // Down on it are the slider's (the kit's, D193): from an interior value Page Up moves a tenth up and Page Down back,
    // End to the end and Home to the start, nothing said and focus kept, and Undo after changes nothing; a held Page Up
    // repeats, even three presses in one frame.
    { name: 'timeline-by-arrow', state: 'shell', steps: [{ focus: TIMELINE }, { press: 'ArrowRight' }], check: async ({ page }) => (await atNow(page)).now === 1 && focusOn(page, TIMELINE) },
    { name: 'timeline-by-shift-arrow', state: 'shell', steps: [{ focus: TIMELINE }, { press: 'Shift+ArrowRight' }, { press: 'Shift+ArrowRight' }], check: async ({ page }) => (await atNow(page)).now === 8 && (await said(page)) === '' },
    { name: 'timeline-words-follow-a-second', state: 'shell', steps: [{ focus: TIMELINE }, { press: 'Shift+ArrowRight' }], check: async ({ page }) => {
      const seen = [];
      for (let i = 0; i < 130 && (await atNow(page)).now < 500; i++) { seen.push((await atNow(page)).text); await page.keyboard.press('Shift+ArrowRight'); }
      const t = await atNow(page);
      return seen.at(-1) === '0:00 of 0:02' && t.now === 500 && t.text === '0:01 of 0:02' && focusOn(page, TIMELINE);
    } },
    // End off the slider writes the store at once, but Carbon copies the value it is handed into its own state in an
    // effect, a setState React runs as a later task (React 19, Carbon 1.118): wait for the value (it must come within
    // 2 s), then read the words, as the Home half does. Read at once, it failed once on CI at no delay (brief 78).
    { name: 'timeline-follows-skip-to-end', state: 'shell', steps: [{ press: 'End' }], check: async ({ page }) => {
      if (!(await comesTo(page, 'n === 1000'))) return false;
      const t = await atNow(page);
      if (t.now !== 1000 || t.text !== '0:02 of 0:02' || (await said(page)) !== SKIPPED_TO_END || !(await thumbAt(page, 1))) return false;
      await page.keyboard.press('Home');
      return (await comesTo(page, 'n === 0')) && thumbAt(page, 0);
    } },
    // End then Home as two steps, so the fast run sends them with no gap: Carbon's echo of 1000 comes after 0 is held,
    // which the kit's slider once took for a key's nudge (Home lost, or React's error 185 and the timeline gone,
    // FINDING-78; brief 79). The position comes to 0, the thumb is drawn at the start, "Skipped to start" is said (it
    // waits behind "Skipped to end", about 2 s) and the timeline is still there; then, heard this time, the pair again:
    // no page error.
    { name: 'timeline-end-then-home', state: 'shell', steps: [{ press: 'End' }, { press: 'Home' }], check: async ({ page }) => {
      const settled = async () => (await comesTo(page, 'n === 0')) && (await thumbAt(page, 0)) && (await comesToWords(page, SKIPPED_TO_START)) && (await atNow(page)).now === 0;
      if (!(await settled())) return false;
      const errors = [];
      const onError = (e) => errors.push(String(e));
      page.on('pageerror', onError);
      try {
        await page.keyboard.press('End');
        await page.keyboard.press('Home');
        await page.waitForTimeout(800);
        return (await page.locator(TIMELINE).count()) === 1 && (await settled()) && errors.length === 0;
      } finally {
        page.off('pageerror', onError);
      }
    } },
    { name: 'timeline-page-home-end-on-slider', state: 'shell', steps: [{ focus: TIMELINE }, { press: 'Shift+ArrowRight' }], check: async ({ page }) => {
      const after = async (key, want) => { await page.keyboard.press(key); return (await comesTo(page, `n === ${want}`)) && (await focusOn(page, TIMELINE)); };
      if ((await atNow(page)).now !== 4) return false;
      if (!(await after('PageUp', 104)) || !(await after('PageDown', 4)) || !(await after('End', 1000))) return false;
      if ((await atNow(page)).text !== '0:02 of 0:02' || !(await neverSays(page, SKIPPED_TO_END, 1000)) || (await said(page)) !== '') return false;
      if (!(await after('Home', 0)) || !(await neverSays(page, SKIPPED_TO_START, 1000))) return false;
      await page.keyboard.press(UNDO);
      await page.waitForTimeout(400);
      return (await atNow(page)).now === 0 && (await said(page)) === '' && focusOn(page, TIMELINE);
    } },
    // A held Page Up: three downs as fast as Playwright sends them, then the up. It checks the repeat; it also failed 10
    // of 10 with the redraw taken out, but that rests on timing, which timeline-two-keys-one-task does not.
    { name: 'timeline-page-up-held', state: 'shell', steps: [{ focus: TIMELINE }], check: async ({ page }) => {
      for (let i = 0; i < 3; i++) await page.keyboard.down('PageUp');
      await page.keyboard.up('PageUp');
      return (await comesTo(page, 'n === 300')) && (await said(page)) === '' && focusOn(page, TIMELINE);
    } },
    // The crash two of these keys once caused (brief 67), reproduced in a fixed order rather than left to timing: two
    // Page Up downs on the thumb in one task, the second after React has drawn the first's position and before Carbon
    // has reported it, then the up. They must reach 200 with focus kept and no page error. With the redraw after a key
    // taken out of the kit's slider (bringIntoStep in its place), this failed 10 runs of 10, each with React's error 185
    // and the timeline gone (sub-chat 68); with the redraw, it passed 10 of 10. Sending both downs before React draws
    // the first did not crash without the redraw, so that order is not the one tested.
    { name: 'timeline-two-keys-one-task', state: 'shell', steps: [{ focus: TIMELINE }], check: async ({ page }) => {
      const errors = [];
      const onError = (e) => errors.push(String(e));
      page.on('pageerror', onError);
      try {
        await page.evaluate(async (s) => {
          // Each key goes where a browser sends it, the focused element, which must be the thumb (the redraw puts a new
          // thumb in the old one's place, focused).
          const send = (type) => {
            const at = document.activeElement;
            if (at?.matches(s)) at.dispatchEvent(new KeyboardEvent(type, { key: 'PageUp', code: 'PageUp', bubbles: true, cancelable: true, composed: true }));
          };
          send('keydown');
          // React draws the first key's position in a microtask queued during it; this one comes after, still before
          // any frame or timer, so Carbon has been given the first position and has not yet reported it.
          await new Promise((r) => queueMicrotask(r));
          send('keydown');
          send('keyup');
        }, TIMELINE);
        const reached = await comesTo(page, 'n === 200');
        await page.waitForTimeout(500);
        return reached && errors.length === 0 && (await atNow(page)).now === 200 && (await said(page)) === '' && focusOn(page, TIMELINE);
      } finally {
        page.off('pageerror', onError);
      }
    } },
    { name: 'play-refused-by-k-on-timeline', state: 'shell', steps: [{ focus: TIMELINE }, { press: 'k' }], check: async ({ page }) => (await said(page)) === NOTHING_TO_PLAY && (await atNow(page)).now === 0 && focusOn(page, TIMELINE) },
    { name: 'timeline-escape-no-drag', state: 'shell', steps: [{ focus: TIMELINE }, { press: 'ArrowRight' }, { press: 'Escape' }], check: async ({ page }) => (await atNow(page)).now === 1 && focusOn(page, TIMELINE) },
    // { name: 'set-hold', state: 'home', steps: [{ focus: '#hold' }, { press: 'Meta+A' }, { type: '11' }, { press: 'Enter' }], check: async ({ page }) => (await page.locator('#hold').inputValue()) === '11' },
  ],
  // Authored journeys: a name, a catalogue method (j-* or keyboard), the rows it claims, and run({ page, expect, open, record }).
  journeys: [
    {
      // 1.3.2: the text blocks, in reading order, match the reviewed sequence and run top to bottom on screen (closed,
      // Help's content is hidden and read by no one). 2.4.3: Tab meets the reviewed controls in order, top to bottom;
      // the one control that opens content, "Help", opens its dialog with focus inside, Tab and Shift+Tab keep focus
      // in it, and focus returns to "Help" when it closes by one Escape wherever focus is: from where focus lands, from
      // the switch, and from "Close", whose Carbon tooltip shows while it has focus and which the kit's dialog takes
      // Escape first on (D206, superseding D186's two Escapes there). A further control that opens content needs its own check. The play bar's reason line is read
      // after the group; its disabled Play is not met by Tab (as v3), and the two skips are.
      name: 'reading-and-focus-order',
      method: 'j-order',
      rows: ['1.3.2', '2.4.3'],
      run: async ({ page, open, record, tab }) => {
        await open('shell');
        const blocks = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, dt, dd, th, td, caption, figcaption, blockquote, pre, label, legend')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; })
          .map((e) => { const r = e.getBoundingClientRect(); return { text: e.innerText.replace(/\s+/g, ' ').trim(), top: r.top, left: r.left }; }));
        const reading = [];
        if (blocks.length !== READING.length) reading.push(`${blocks.length} text block(s), reviewed ${READING.length}: ${blocks.map((b) => JSON.stringify(b.text.slice(0, 30))).join(', ')}`);
        blocks.forEach((b, i) => { if (READING[i] !== undefined && !b.text.startsWith(READING[i])) reading.push(`block ${i + 1} reads ${JSON.stringify(b.text.slice(0, 40))}, reviewed ${JSON.stringify(READING[i])}`); });
        blocks.forEach((b, i) => { const a = blocks[i - 1]; if (a && (b.top < a.top - 1 || (Math.abs(b.top - a.top) <= 1 && b.left < a.left))) reading.push(`block ${i + 1} sits above or before block ${i} on screen`); });
        record('1.3.2', !reading.length, reading.length ? reading.join('; ') : `${blocks.length} text blocks in the reviewed order, top to bottom on screen`);

        const { order, problems: focus } = await tabOrder(page, tab);
        const opens = await page.locator(OPENS).count();
        if (opens) focus.push(`${opens} element(s) open or are opened content at rest; Help's dialog, drawn only while open, is checked below: write the check for any other`);
        await open('shell');
        await helpButton(page).focus();
        await page.keyboard.press('Enter');
        const dialog = helpDialog(page);
        const shown = await dialog.isVisible();
        const inside = async () => dialog.evaluate((e) => e.contains(document.activeElement));
        if (!shown) focus.push('Enter on "Help" did not open its dialog');
        else {
          if (!(await inside())) focus.push('focus did not move into Help when it opened');
          for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
            await page.keyboard.press(key);
            if (!(await inside())) { focus.push(`${key} took focus out of the open dialog`); break; }
          }
          if (!(await focusIs(page, SWITCH))) focus.push('Tab and Shift+Tab did not end on the switch');
          await page.keyboard.press('Escape');
          if (!(await backOnHelp(page))) focus.push('focus did not return to "Help" when its dialog closed by one Escape from the switch');
          await helpButton(page).focus();
          await page.keyboard.press('Enter');
          await helpDialog(page).waitFor();
          await page.keyboard.press('Escape');
          if (!(await backOnHelp(page))) focus.push('focus did not return to "Help" when one Escape closed it from where focus landed');
          await helpButton(page).focus();
          await page.keyboard.press('Enter');
          await helpDialog(page).waitFor();
          const viaRegion = await shiftTabToClose(page);
          const onClose = await focusIs(page, '.cds--modal-close');
          await page.keyboard.press('Escape');
          if (!onClose) focus.push(`Shift+Tab from where focus landed${viaRegion ? ', then from Help\'s scrollable region,' : ''} did not reach "Close"`);
          else if (await helpDialog(page).isVisible()) focus.push('on "Close", one Escape left Help open (D206: one Escape closes it wherever focus is)');
          if (!(await backOnHelp(page))) focus.push('focus did not return to "Help" when one Escape on "Close" closed it');
        }
        record('2.4.3', !focus.length, focus.length ? focus.join('; ') : `Tab meets the ${order.length} reviewed control(s) in order, top to bottom (${order.join(', ')}); "Help" opens its dialog with focus inside, Tab and Shift+Tab keep it there, and it returns to "Help" on one Escape, from where focus lands, from the switch and from "Close" (D206)`);
      },
    },
    {
      // 2.4.2: each route carries its reviewed title.
      name: 'route-titles',
      method: 'j-routes',
      rows: ['2.4.2'],
      run: async ({ page, record }) => {
        const wrong = [];
        for (const r of ROUTES) {
          await page.goto(r.path);
          const title = await page.title();
          if (title !== r.title) wrong.push(`${r.path} is titled ${JSON.stringify(title)}, reviewed ${JSON.stringify(r.title)}`);
        }
        record('2.4.2', !wrong.length, wrong.length ? wrong.join('; ') : `${ROUTES.length} route(s), each with its reviewed title: ${ROUTES.map((r) => `${r.path} "${r.title}"`).join(', ')}`);
      },
    },
    {
      // 2.5.2: each button, link and switch does nothing on the down-event, a press moved off it before release does
      // nothing, and a whole press acts, on the up-event: "Help" (its dialog opens) and,
      // inside Help, the switch (it turns). A press on the switch is moved off to a point inside the dialog, as a press
      // outside Help closes it. The play bar: each skip says its words on a whole press and nothing before; Play,
      // disabled with nothing to play, does nothing on any press. The timeline, a slider, does move on the down-event, as
      // a provisional scrub: Escape before the release aborts it (the position back where the press found it, focus
      // kept, and the moves and release after it change nothing), and the release completes it with no undo step.
      // 2.5.7: the page's dragging movements are the timeline's and the preview's two (a point's, a group's; CORE-06,
      // briefs 115 and 122). The timeline's, the thumb along the track, has a single-pointer alternative with the same
      // result: a drag of the thumb completed at 70 % of the track, then, on a fresh page, a whole press on the track at
      // the same point, the two positions compared. This row checks the timeline's drag only; the preview's two have the
      // point's menu "Move" then one click (D270), checked by point-move (brief 139); no keyboard way is credited to 2.5.7. Every press goes through the pointer adapter, so a touch run can credit it. "Open project"
      // (stage 6) opens the browser's file chooser on a whole press only, none on the down-event or on a press moved
      // off. The preview (CORE-06, brief 112): the pen's tap, read while held, after a press moved off and after a whole
      // press: a point on the up only, in one undo step. Any other control needs its
      // own journey.
      name: 'pointer-cancellation',
      method: 'j-pointer',
      rows: ['2.5.2', '2.5.7'],
      run: async ({ page, open, record, pointer }) => {
        await open('shell');
        const count = await page.locator(CONTROLS).filter({ visible: true }).count();
        const problems = [], done = [], slider = [];
        let compared = '';
        // "Open project" acts by opening the browser's file chooser: each one opened is counted (stage 6).
        let choosers = 0;
        page.on('filechooser', () => { choosers += 1; });
        for (let i = 0; i < count; i++) {
          await open('shell');
          choosers = 0;
          const control = page.locator(CONTROLS).filter({ visible: true }).nth(i);
          const name = await named(control);
          const href = await control.getAttribute('href');
          const isHelp = await control.evaluate((e, s) => e.matches(s), HELP);
          const skip = await control.evaluate((e, [a, b]) => (e.matches(a) ? 'start' : e.matches(b) ? 'end' : ''), [SKIP_START, SKIP_END]);
          const offPlay = await control.evaluate((e, s) => e.matches(s) && e.disabled, PLAY);
          const isOpen = await control.evaluate((e, s) => e.matches(s), OPEN);
          const isPreview = await control.evaluate((e, s) => e.matches(s), PREVIEW);
          if (await control.evaluate((e, s) => e.matches(s), TIMELINE)) {
            const bad = [];
            // 2.5.2: a press on the track and a drag, aborted by Escape before the release.
            const half = await onTrack(page, 0.5), far = await onTrack(page, 0.9);
            await pointer.down(half.x, half.y);
            const pressedOk = await comesTo(page, 'n > 400 && n < 600');
            const pressed = (await atNow(page)).now;
            for (const f of [0.6, 0.7, 0.8, 0.9]) { const at = await onTrack(page, f); await pointer.move(at.x, at.y); }
            // As below: Carbon can drop a drag's last quick move, so the pointer rests at 90 % and moves there once more.
            await page.waitForTimeout(100);
            await pointer.move(far.x, far.y);
            const draggedOk = await comesTo(page, 'n > 850');
            const moved = (await atNow(page)).now;
            await page.keyboard.press('Escape');
            await comesTo(page, 'n === 0');
            const back = await atNow(page);
            if (!pressedOk || !draggedOk) bad.push(`a press and drag on it read ${pressed} then ${moved}, not about 500 then 900`);
            if (back.now !== 0 || back.text !== '0:00 of 0:02') bad.push(`Escape mid-drag left it at ${back.now} (${back.text}), not where the press found it`);
            if (!(await focusOn(page, TIMELINE))) bad.push('Escape mid-drag took focus off it');
            await pointer.move(half.x, half.y);
            await pointer.up();
            await page.waitForTimeout(300);
            if ((await atNow(page)).now !== 0) bad.push('the moves and release after Escape moved it');
            // 2.5.7: a drag of the thumb completed at 70 %, kept on the release with no undo step.
            const thumb = await page.locator(TIMELINE).boundingBox(), seventy = await onTrack(page, 0.7);
            const width = (await page.locator(TRACK).boundingBox()).width;
            await dragBy(pointer, { x: thumb.x + thumb.width / 2, y: thumb.y + thumb.height / 2 }, seventy, 6);
            // Carbon throttles a drag's moves and its release takes no point, so a quick last move can be dropped: the
            // pointer rests at 70 % and moves there once more before the release, as a person's would.
            await page.waitForTimeout(100);
            await pointer.move(seventy.x, seventy.y);
            const reached = await comesTo(page, 'n > 650 && n < 750');
            const beforeUp = (await atNow(page)).now;
            await pointer.up();
            await page.waitForTimeout(300);
            const dragged = await atNow(page);
            if (!reached || dragged.now !== beforeUp) bad.push(`a drag of the thumb to 70 % read ${beforeUp} before the release and ${dragged.now} after it`);
            await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
            await page.keyboard.press(UNDO);
            await page.waitForTimeout(300);
            if ((await atNow(page)).now !== dragged.now || (await said(page)) !== '') bad.push('Undo after the drag changed the position or said something: the drag made an undo step');
            // The same point by a whole press on the track, from the start on a fresh page. A pixel of the track is
            // 1000 / its width thousandths; the two may differ by two pixels' worth (rounding of each point), at least 2.
            await open('shell');
            await pointer.down(seventy.x, seventy.y);
            await pointer.up();
            await comesTo(page, 'n > 650');
            const kept = await atNow(page);
            const tolerance = Math.max(2, Math.ceil(2000 / width));
            if (Math.abs(kept.now - dragged.now) > tolerance || kept.text !== dragged.text) bad.push(`a whole press on the track at 70 % left it at ${kept.now} (${kept.text}), the drag at ${dragged.now} (${dragged.text}), more than ${tolerance} apart`);
            await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
            await page.keyboard.press(UNDO);
            await page.waitForTimeout(300);
            if ((await atNow(page)).now !== kept.now || (await said(page)) !== '') bad.push('Undo after the press changed the position or said something: a move of it made an undo step');
            if (bad.length) problems.push(`${name}: ${bad.join('; ')}`);
            else { slider.push(`${name}`); compared = `a drag of the thumb completed at 70 % of the track held ${dragged.now} (${dragged.text}), and a whole press on the track at the same point ${kept.now} (${kept.text}), within ${tolerance} (two pixels); neither made an undo step`; }
            continue;
          }
          if (isPreview) {
            // The preview (CORE-06, brief 112): the pen's tap acts on the up only (2.5.2). On the shell's empty route a
            // press on an empty place is read while held, after it is moved off the box and released (abandoned), and
            // after a whole press: nothing drawn changes on the down or by the abandoned press; the whole press places
            // one point (what is drawn changes) in one undo step (one Undo draws the frame found again). Brief 134 (ruling
            // CV; D263, D268): the status region is empty after the held press, the abandoned press and the whole press's
            // down, and says "Point added" after the whole press.
            const box = await control.boundingBox();
            const x = box.x + box.width * 0.3, y = box.y + box.height * 0.5;
            const bad = [];
            const now = async () => { await page.waitForTimeout(250); await twoFrames(page); return (await pixels(page)).hash; };
            const before = await now();
            const quiet = async (when) => { const words = await said(page); if (words !== '') bad.push(`${when} said ${JSON.stringify(words)}`); };
            await pointer.down(x, y);
            if ((await now()) !== before) bad.push('a press held on an empty place changed what it draws');
            await quiet('a press held on an empty place');
            await pointer.move(x + box.width + 40, y);
            await pointer.up();
            if ((await now()) !== before) bad.push('a press moved off it and released changed what it draws');
            await quiet('a press moved off it and released');
            await pointer.down(x, y);
            if ((await now()) !== before) bad.push('the down of a whole press changed what it draws');
            await quiet('the down of a whole press');
            await pointer.up();
            if ((await now()) === before) bad.push('a whole press drew no point');
            if ((await said(page)) !== POINT_ADDED) bad.push(`a whole press said ${JSON.stringify(await said(page))}, not ${JSON.stringify(POINT_ADDED)}`);
            await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
            await page.keyboard.press(UNDO);
            if ((await now()) !== before) bad.push('one Undo did not take the point away: the press was not one step');
            if (bad.length) problems.push(`${name}: ${bad.join('; ')}`);
            else done.push(`${name} (the pen's tap: nothing drawn or said on the down, nothing left or said by a press moved off, one point and one undo step on the up, saying "${POINT_ADDED}")`);
            continue;
          }
          if (!href && !isHelp && !skip && !offPlay && !isOpen) { problems.push(`${name} is neither a link nor "Help": write its pointer journey (what its up-event does, and how a press is abandoned)`); continue; }
          const box = await control.boundingBox();
          const x = box.x + box.width / 2, y = box.y + box.height / 2;
          // A point well clear of every control, to move the press off to before release.
          const off = await page.evaluate((sel) => {
            const all = [...document.querySelectorAll(sel)];
            for (let py = 10; py < innerHeight; py += 20) for (let px = 10; px < innerWidth; px += 20) {
              const hit = document.elementFromPoint(px, py);
              if (hit && !all.some((c) => c.contains(hit) || hit.contains(c)) && all.every((c) => { const r = c.getBoundingClientRect(); return px < r.left - 30 || px > r.right + 30 || py < r.top - 30 || py > r.bottom + 30; })) return { x: px, y: py };
            }
            return null;
          }, CONTROLS);
          if (!off) { problems.push(`${name}: no clear point beside it to move a press off to`); continue; }
          const start = page.url();
          const acted = async () => page.url() !== start || (await helpDialog(page).isVisible()) || (await said(page)) !== '' || choosers > 0;
          await pointer.down(x, y);
          await page.waitForTimeout(250);
          if (await acted()) { problems.push(`${name} acted on the down-event`); continue; }
          await pointer.move(off.x, off.y);
          await pointer.up();
          await page.waitForTimeout(400);
          if (await acted()) { problems.push(`${name}: a press moved off it before release still acted`); continue; }
          await pointer.down(x, y);
          await pointer.up();
          if (isOpen) {
            await page.waitForTimeout(400);
            if (choosers !== 1) problems.push(`${name}: a whole press opened ${choosers} file chooser(s), not one`);
            else done.push(`${name} (the file chooser on the release)`);
            continue;
          }
          if (offPlay) {
            await page.waitForTimeout(400);
            if (await acted()) problems.push(`${name}, disabled, acted on a whole press`);
            else done.push(`${name} (disabled: nothing)`);
            continue;
          }
          if (skip) {
            const want = skip === 'start' ? SKIPPED_TO_START : SKIPPED_TO_END;
            if ((await said(page)) !== want) problems.push(`${name}: a whole press said ${JSON.stringify(await said(page))}, not ${JSON.stringify(want)}`);
            else done.push(name);
            continue;
          }
          if (isHelp) {
            await page.waitForTimeout(400);
            if (!(await helpDialog(page).isVisible())) { problems.push(`${name}: a whole press did not open Help`); continue; }
            done.push(name);
            // Inside Help, the switch: a point in the dialog clear of its controls to move the press off to.
            const sw = singleKeys(page), was = await sw.getAttribute('aria-checked');
            // Help scrolls at 1280 by 800 (FINDING-123, D264): with the nudge's two rows (brief 125) the switch sits below
            // the region's visible part, and a press at its unscrolled place lands outside Help and closes it.
            await sw.scrollIntoViewIfNeeded();
            const sbox = await sw.boundingBox();
            const sx = sbox.x + sbox.width / 2, sy = sbox.y + sbox.height / 2;
            const inner = await page.evaluate(({ sel, ctl }) => {
              const box = document.querySelector(sel)?.getBoundingClientRect();
              const all = [...document.querySelectorAll(ctl)].filter((c) => c.getBoundingClientRect().width > 0);
              if (!box) return null;
              for (let py = box.top + 10; py < box.bottom; py += 10) for (let px = box.left + 10; px < box.right; px += 10) {
                if (all.every((c) => { const r = c.getBoundingClientRect(); return px < r.left - 30 || px > r.right + 30 || py < r.top - 30 || py > r.bottom + 30; })) return { x: px, y: py };
              }
              return null;
            }, { sel: '[role=dialog]', ctl: CONTROLS });
            const swName = await named(sw);
            if (!inner) { problems.push(`${swName}: no clear point inside Help to move a press off to`); continue; }
            await pointer.down(sx, sy);
            await page.waitForTimeout(250);
            if ((await sw.getAttribute('aria-checked')) !== was) { problems.push(`${swName} turned on the down-event`); continue; }
            await pointer.move(inner.x, inner.y);
            await pointer.up();
            await page.waitForTimeout(250);
            if ((await sw.getAttribute('aria-checked')) !== was || !(await helpDialog(page).isVisible())) { problems.push(`${swName}: a press moved off it before release still acted`); continue; }
            await pointer.down(sx, sy);
            await pointer.up();
            await page.waitForTimeout(250);
            if ((await sw.getAttribute('aria-checked')) === was) problems.push(`${swName}: a whole press did not turn it`);
            else done.push(swName);
            continue;
          }
          const target = new URL(href, start).href;
          if (!(await arrives(page, target))) problems.push(`${name}: a whole press did not follow it to ${target} (at ${page.url()})`);
          else done.push(name);
        }
        const slid = slider.length > 0;
        record('2.5.7', slid && !problems.some((p) => p.startsWith('slider')), slid ? `of the page's dragging movements, this row checks the timeline's only: its thumb along the track has a single-pointer alternative with the same result: ${compared}; the preview's two (a point's, a group's) have the point's menu "Move" then one click, checked by point-move` : problems.find((p) => p.startsWith('slider')) ?? 'the timeline was not met');
        record('2.5.2', !problems.length && done.length > 0 && slid, problems.length ? problems.join('; ') : done.length && slid ? `${done.length} button(s), link(s) and switch(es) do nothing on the down-event or on a press moved off before release, and, where enabled, act on a whole press, on the up-event: ${done.join(', ')}; the slider, ${slider.join(', ')}, moves on the down-event as a provisional scrub, which Escape aborts before the release (abort before completion) and the release completes, with no undo step` : 'no control to press, or the timeline not met');
      },
    },
    {
      // 1.4.13: the page's two pieces of content shown on hover or focus, both Carbon's tooltips: Help's "Close" (its
      // close button's) and the timeline's thumb (the value words, "0:00 of 0:02"). Each is shown both ways, by focus
      // and by the pointer resting on it. Shown is measured on the tooltip's content as drawn (a box, shown, its exact
      // words); hidden on the content's box alone (not drawn, whatever its words); the opposite state measured first.
      // Dismissible: one Escape hides it with the pointer unmoved, focus where it was and nothing else changed (the
      // timeline where it was); one case apart, Close, where one Escape closes Help, label and all: shown by hover with
      // focus elsewhere in Help, Carbon's Modal and Tooltip both hear Escape on the document (ruled with D195), and shown
      // by focus the kit's dialog takes Escape first (D206, superseding D186's first Escape hiding the label alone).
      // That tooltip is held to 1.4.13's exception, content that obscures nothing, measured shown by hover and shown by
      // focus (the pointer away), each at the run's width and at 320 px: its box and caret meet no words outside it and
      // no control or image but Close, and do not overlap Close itself (its icon, its box: clearOfTrigger), where they show, judged
      // by what is painted (two pictures of each overlap with the tooltip unpainted, with and without the words' parent
      // or the control; equal pictures, nothing of it shows there; obscures() below says how it checks itself). What
      // Escape does there is pinned (Help closed, focus on "Help"), so that a change in Carbon's listeners fails here and
      // the case is ruled again. Hoverable: shown by hover, the pointer moves in steps from the trigger onto the
      // content; shown by focus, the pointer, away, comes onto the content in steps from the side away from the trigger;
      // either way it rests there 1 s, past Carbon's leave delay (300 ms), the pointer's own last position on the
      // content, the content still shown (and, by focus, focus unmoved). Not claimed: the pointer leaving the content
      // again while focus stays. Persistent: held by focus or hover and nothing pressed, it is still shown after a rest
      // past every Carbon delay, and it goes when the focus or the pointer goes. The thumb's tooltip covers part of the
      // label "Timeline" while the thumb has focus: 1.4.13 allows that because one Escape hides it, which this journey
      // proves. Nothing is pressed; hovering has no touch form. A further piece of content shown on hover or focus
      // needs its own check here.
      name: 'content-on-hover-or-focus',
      method: 'j-hover',
      rows: ['1.4.13'],
      run: async ({ page, open, record }) => {
        const OFF = { x: 5, y: 5 };
        const rest = (ms) => page.waitForTimeout(ms);
        // The tooltip's content as drawn: Carbon puts role=tooltip on a wrapper the size of the trigger, and draws the
        // words in its .cds--popover-content, display none while closed.
        const tip = (sel) => page.evaluate((s) => {
          const c = document.querySelector(s)?.closest('.cds--popover-container')?.querySelector('[role=tooltip] .cds--popover-content');
          if (!c) return { shown: false, text: '', at: null };
          const r = c.getBoundingClientRect(), cs = getComputedStyle(c);
          return { shown: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0, text: c.textContent ?? '', at: { x: r.x + r.width / 2, y: r.y + r.height / 2 } };
        }, sel);
        // Shown: the content drawn with these exact words. Hidden: the content not drawn at all, whatever its words, so
        // a tooltip left drawn with other words is not taken for hidden.
        const showing = async (sel, words) => { const t = await tip(sel); return t.shown && t.text === words; };
        const hidden = async (sel) => !(await tip(sel)).shown;
        // What the shown tooltip covers: its content's box (required to have a size, or the check fails) and its caret's,
        // against the client rectangles of every text node outside the tooltip (a Range over each) and the box of every
        // control and image but its own trigger and the elements holding it: for each, the rectangles where it overlaps
        // a box (geometry alone; blank space of an element is not content). Where it shows there is judged by what is
        // painted, as 1.4.13's "obscure" asks, not by hit-testing: each overlap's rectangle (grown outward to whole pixels,
        // kept inside the viewport) is pictured with the tooltip's content and caret unpainted but still hit (opacity 0,
        // no transition; never visibility or display, which would end the hover under test), the base, and again with the
        // candidate unpainted too (words: their parent element; a control or image: itself). Equal pictures: nothing of
        // it is painted there, so the tooltip hides nothing of it (words under Help's opaque container at 320 px). Unequal:
        // it shows there, and it is reported. Unpainting the words' parent unpaints its children too, so the measure can
        // report more than the words (the safe side); a candidate holding the tooltip or its trigger, which cannot be
        // unpainted alone, counts as showing. It checks itself: the bases are taken again after the candidates, and if
        // they differ the page under the tooltip is not still and nothing is established. It leaves the state as it
        // found it: every style it set is taken off (the element's own style attribute put back), and the journey then
        // checks the tooltip is still shown with its words and the pointer's last position unmoved.
        const obscures = async (sel) => {
          const found = await page.evaluate(([s, controls]) => {
            const trigger = document.querySelector(s), wrap = trigger?.closest('.cds--popover-container')?.querySelector('[role=tooltip]');
            const sized = (r) => !!r && r.width > 0 && r.height > 0;
            const contentEl = wrap?.querySelector('.cds--popover-content'), content = contentEl?.getBoundingClientRect();
            if (!sized(content)) return null;
            const caretEl = wrap.querySelector('.cds--popover-caret');
            const boxes = [content, caretEl?.getBoundingClientRect()].filter(sized);
            const W = innerWidth, H = innerHeight;
            const overlaps = (r) => (sized(r) ? boxes : []).flatMap((b) => {
              const left = Math.max(r.left, b.left), right = Math.min(r.right, b.right), top = Math.max(r.top, b.top), bottom = Math.min(r.bottom, b.bottom);
              if (!(left < right && top < bottom)) return [];
              const x = Math.max(0, Math.floor(left)), y = Math.max(0, Math.floor(top)), x2 = Math.min(W, Math.ceil(right)), y2 = Math.min(H, Math.ceil(bottom));
              return x2 > x && y2 > y ? [{ x, y, width: x2 - x, height: y2 - y }] : [];
            });
            const cands = [];
            const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let n = walk.nextNode(); n; n = walk.nextNode()) {
              if (!n.textContent.trim() || wrap.contains(n) || getComputedStyle(n.parentElement).visibility === 'hidden') continue;
              const range = document.createRange(); range.selectNodeContents(n);
              const rects = [...range.getClientRects()].flatMap(overlaps);
              if (rects.length) cands.push({ label: `the words "${n.textContent.trim().slice(0, 30)}"`, el: n.parentElement, rects });
            }
            for (const e of document.querySelectorAll(`${controls}, img, svg, canvas, video, [role=img]`)) {
              if (e === trigger || trigger.contains(e) || e.contains(trigger) || wrap.contains(e)) continue;
              const rects = overlaps(e.getBoundingClientRect());
              if (rects.length) cands.push({ label: `the ${e.tagName.toLowerCase()} ${e.id || e.getAttribute('aria-label') || ''}`.trim(), el: e, rects });
            }
            // Unpainting and painting again: inline opacity 0 with no transition, each element's own style attribute
            // kept and put back (opacity taken off while the transition is still none, so nothing fades back in).
            const kept = new Map();
            const off = (els) => { for (const e of els) { if (!kept.has(e)) kept.set(e, e.getAttribute('style')); e.style.setProperty('transition', 'none', 'important'); e.style.setProperty('opacity', '0', 'important'); } };
            const on = (els) => { for (const e of els) { if (!kept.has(e)) continue; e.style.setProperty('transition', 'none', 'important'); e.style.removeProperty('opacity'); void getComputedStyle(e).opacity; const was = kept.get(e); kept.delete(e); if (was === null) e.removeAttribute('style'); else e.setAttribute('style', was); } };
            window.__paint = { tip: [contentEl, caretEl].filter(Boolean), cands: cands.map((c) => c.el), off, on };
            return cands.map((c) => ({ label: c.label, rects: c.rects, holds: c.el.contains(trigger) || c.el.contains(wrap) }));
          }, [sel, CONTROLS]);
          if (!found) return { hits: ['(no tooltip box to measure)'], still: true, candidates: 0, pictures: 0 };
          const key = (r) => `${r.x},${r.y},${r.width},${r.height}`;
          const shot = (r) => page.screenshot({ clip: r });
          const rects = [...new Map(found.flatMap((c) => c.rects).map((r) => [key(r), r])).values()];
          const hits = [], base = new Map();
          let pictures = 0;
          await page.evaluate(() => window.__paint.off(window.__paint.tip));
          for (const r of rects) { base.set(key(r), await shot(r)); pictures++; }
          for (const [i, c] of found.entries()) {
            if (c.holds) { hits.push(c.label); continue; }
            await page.evaluate((k) => window.__paint.off([window.__paint.cands[k]]), i);
            let shows = false;
            for (const r of c.rects) { if (!(await shot(r)).equals(base.get(key(r)))) shows = true; pictures++; }
            await page.evaluate((k) => window.__paint.on([window.__paint.cands[k]]), i);
            if (shows) hits.push(c.label);
          }
          let still = true;
          for (const r of rects) { if (!(await shot(r)).equals(base.get(key(r)))) still = false; pictures++; }
          await page.evaluate(() => window.__paint.on(window.__paint.tip));
          return { hits, still, candidates: found.length, pictures };
        };
        // What the shown tooltip covers of its own trigger (Codex's list, line 9): obscures() leaves the trigger and all
        // inside it out, so it would pass a label drawn over the trigger itself. Here, by geometry alone (no overlap at
        // all, so nothing painted there can be hidden): the content's box and the caret's against the trigger's icon (the
        // svg inside it, its painted content) and against the trigger's own box. Each overlap is its area in CSS pixels.
        const clearOfTrigger = (sel) => page.evaluate((s) => {
          const trigger = document.querySelector(s), wrap = trigger?.closest('.cds--popover-container')?.querySelector('[role=tooltip]');
          const box = (e) => { const r = e?.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; };
          const content = box(wrap?.querySelector('.cds--popover-content')), caret = box(wrap?.querySelector('.cds--popover-caret'));
          const icon = box(trigger?.querySelector('svg')), button = box(trigger);
          const area = (a, b) => (a && b ? Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)) : 0);
          // Close's focus outline (Codex's list, line 10): the border box grown by the computed outline-offset plus
          // outline-width, read from the page; null while no outline is drawn. Where the label's or the caret's box
          // overlaps it, the overlap's rectangle, settled below by what is painted there.
          const cs = trigger ? getComputedStyle(trigger) : null;
          const ow = cs ? parseFloat(cs.outlineWidth) || 0 : 0, oo = cs ? parseFloat(cs.outlineOffset) || 0 : 0;
          const grow = cs && cs.outlineStyle !== 'none' && ow > 0 ? oo + ow : null;
          const outline = button && grow !== null ? { x: button.x - grow, y: button.y - grow, width: button.width + 2 * grow, height: button.height + 2 * grow } : null;
          const overlap = (a, b) => { if (!a || !b) return null; const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), w = Math.min(a.x + a.width, b.x + b.width) - x, h = Math.min(a.y + a.height, b.y + b.height) - y; return w > 0 && h > 0 ? { x, y, width: w, height: h } : null; };
          const overOutline = [overlap(content, outline), overlap(caret, outline)].filter(Boolean);
          return { content, caret, icon, button, outline, grow, overOutline, overIcon: area(content, icon) + area(caret, icon), overButton: area(content, button) + area(caret, button) };
        }, sel);
        // Whether the shown label paints anything inside `r`: two pictures of it, the label and its caret shown and then
        // unpainted (inline opacity 0, no transition, each style attribute put back), equal when it paints nothing there.
        const tipPaints = async (r) => {
          const clip = { x: Math.floor(r.x), y: Math.floor(r.y) };
          clip.width = Math.ceil(r.x + r.width) - clip.x; clip.height = Math.ceil(r.y + r.height) - clip.y;
          const shown = await page.screenshot({ clip });
          await page.evaluate(() => {
            window.__tipKept = [...document.querySelectorAll('[role=dialog] .cds--popover-container [role=tooltip] .cds--popover-content, [role=dialog] .cds--popover-container [role=tooltip] .cds--popover-caret')].map((e) => [e, e.getAttribute('style')]);
            for (const [e] of window.__tipKept) { e.style.setProperty('transition', 'none', 'important'); e.style.setProperty('opacity', '0', 'important'); }
          });
          const hidden = await page.screenshot({ clip });
          await page.evaluate(() => { for (const [e, was] of window.__tipKept) { e.style.removeProperty('opacity'); void getComputedStyle(e).opacity; if (was === null) e.removeAttribute('style'); else e.setAttribute('style', was); } window.__tipKept = null; });
          return { clip, paints: !shown.equals(hidden) };
        };
        const triggerClear = [];
        const clearOf = async (how, at, bad) => {
          const c = await clearOfTrigger('[role=dialog] .cds--modal-close');
          const where = `${how} ${at ? at.trim() : 'at the run\'s width'}`;
          if (!c.content || !c.icon || !c.button) { bad(`${where}: no box to measure against "Close" itself (label ${!!c.content}, icon ${!!c.icon}, button ${!!c.button})`); return; }
          if (c.overIcon > 0) bad(`${where}: the label or its caret covers ${c.overIcon.toFixed(1)} px² of Close's own icon`);
          if (c.overButton > 0) bad(`${where}: the label or its caret covers ${c.overButton.toFixed(1)} px² of the Close button's own box`);
          const r = (b) => `${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.width.toFixed(0)}x${b.height.toFixed(0)}`;
          let ring = '';
          if (how === 'shown by focus') {
            if (!c.outline) { bad(`${where}: no focus outline drawn on "Close" to measure against`); return; }
            const settled = [];
            for (const o of c.overOutline) {
              const { clip, paints } = await tipPaints(o);
              if (paints) bad(`${where}: the label or its caret paints over Close's focus outline (overlap ${r(o)}, ${(o.width * o.height).toFixed(1)} px², pixels ${r(clip)} differ with it unpainted)`);
              settled.push(`${r(o)} overlaps it, ${(o.width * o.height).toFixed(1)} px², painted nothing there`);
            }
            ring = `, focus outline ${r(c.outline)} (box grown ${c.grow.toFixed(0)} px: offset plus width, read from the page)${settled.length ? `: ${settled.join(', ')}` : ', no box over it'}`;
          }
          triggerClear.push(`${where}: label ${r(c.content)}${c.caret ? `, caret ${r(c.caret)}` : ''}, icon ${r(c.icon)}, button ${r(c.button)}, 0 px² over either${ring}`);
        };
        const focused = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName || '');
        // Where the pointer really is (its last mousemove), and whether the tooltip's drawn content is what lies under it.
        const track = () => page.evaluate(() => { window.__at = null; addEventListener('mousemove', (e) => { window.__at = { x: e.clientX, y: e.clientY }; }, true); });
        const onContent = () => page.evaluate(() => { const p = window.__at; return !!p && !!document.elementFromPoint(p.x, p.y)?.closest('[role=tooltip] .cds--popover-content'); });
        const centre = async (sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
        const TIPS = [
          {
            name: 'Close', trigger: '[role=dialog] .cds--modal-close', words: 'Close', byException: true,
            // Help opened from the keyboard, the pointer away; focus lands at the content's start, not on Close.
            setup: async () => { await open('shell'); await page.mouse.move(OFF.x, OFF.y); await helpButton(page).focus(); await page.keyboard.press('Enter'); await helpDialog(page).waitFor(); },
            // Shift+Tab from the content's start reaches Close (the kit's Dialog), past Help's scrollable region when its
            // content scrolls (brief 123).
            focus: async () => { await shiftTabToClose(page); },
            kept: async () => String(await helpDialog(page).isVisible()),
          },
          {
            name: 'the timeline', trigger: TIMELINE, words: '',
            setup: async () => { await open('shell'); await page.mouse.move(OFF.x, OFF.y); },
            focus: async () => { await page.locator(TIMELINE).focus(); },
            kept: async () => String((await atNow(page)).now),
          },
        ];
        const problems = [], done = [], byFocusMeasured = [];
        for (const t of TIPS) {
          await t.setup();
          const words = t.words || (await atNow(page)).text;
          const bad = (what) => problems.push(`${t.name}: ${what}`);
          // By focus.
          if (!(await hidden(t.trigger))) bad('shown before focus');
          await t.focus();
          if (!(await page.locator(t.trigger).evaluate((e) => e === document.activeElement))) bad('focus did not reach the trigger');
          if (!(await showing(t.trigger, words))) bad('not shown on focus');
          await rest(1500);
          if (!(await showing(t.trigger, words))) bad('focus held 1.5 s: no longer shown (persistent)');
          let who = await focused(), kept = await t.kept();
          if (t.byException) {
            // Close shown by focus (D206): one Escape closes Help, label and all, so the label is not dismissed alone;
            // 1.4.13 then rests on its exception, content that obscures nothing, measured here shown by focus with the
            // pointer away, at the run's width and at 320 px, each measure leaving the state as found (the label shown
            // with its words, focus unmoved); then one Escape closes Help with focus back on "Help".
            const byFocus = async (at) => {
              const before = await showing(t.trigger, words), was = await focused();
              const { hits, still, candidates, pictures } = await obscures(t.trigger);
              if (!before) bad(`shown by focus${at}: not shown when measured`);
              if (!still) bad(`shown by focus${at}: the page under the label is not still (its base pictures differ), so what it obscures is not established`);
              if (hits.length) bad(`shown by focus${at}: it obscures ${hits.join(', ')}`);
              await clearOf('shown by focus', at, bad);
              if (before && !(await showing(t.trigger, words))) bad(`shown by focus${at}: after the measure no longer shown with its words (the measure changed the state)`);
              if ((await focused()) !== was) bad(`shown by focus${at}: the measure moved focus from ${was} to ${await focused()}`);
              byFocusMeasured.push(`${at ? at.trim() : 'the run\'s width'}: ${candidates} overlap(s), ${pictures} picture(s)`);
            };
            await byFocus('');
            const width = page.viewportSize();
            await page.setViewportSize({ width: 320, height: width.height });
            await t.setup(); await t.focus();
            await byFocus(' at 320 px');
            await page.setViewportSize(width);
            await t.setup(); await t.focus();
            await page.keyboard.press('Escape');
            await rest(400);
            if (await helpDialog(page).isVisible()) bad('shown by focus: one Escape on "Close" left Help open (D206)');
            if (!(await focusIs(page, HELP))) bad(`shown by focus: after one Escape focus is on ${await focused()}, not "Help" (D206)`);
          } else {
            await page.keyboard.press('Escape');
            await rest(400);
            if (!(await hidden(t.trigger))) bad('shown by focus: still shown after one Escape (dismissible)');
            if ((await focused()) !== who) bad(`shown by focus: Escape moved focus from ${who} to ${await focused()}`);
            if ((await t.kept()) !== kept) bad(`shown by focus: Escape changed what it must not (${kept} to ${await t.kept()})`);
          }
          // Hoverable when shown by focus: the pointer, away, comes onto the content from the side away from the trigger
          // (so it never passes over the trigger, which would show it by hover) in steps, and rests there 1 s.
          await t.setup(); await t.focus();
          if (!(await showing(t.trigger, words))) bad('not shown on focus before the pointer came');
          else {
            who = await focused();
            const from = await centre(t.trigger), box = await page.evaluate((s) => {
              const r = document.querySelector(s)?.closest('.cds--popover-container')?.querySelector('[role=tooltip] .cds--popover-content')?.getBoundingClientRect();
              return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height } : null;
            }, t.trigger);
            const dx = box.x - from.x, dy = box.y - from.y, len = Math.hypot(dx, dy) || 1;
            const reach = Math.abs(dx / len) * box.w / 2 + Math.abs(dy / len) * box.h / 2 + 20;
            const near = { x: box.x + (dx / len) * reach, y: box.y + (dy / len) * reach };
            await track();
            await page.mouse.move(near.x, near.y, { steps: 5 });
            for (let i = 1; i <= 5; i++) { await page.mouse.move(near.x + ((box.x - near.x) * i) / 5, near.y + ((box.y - near.y) * i) / 5); await rest(50); }
            const under = await onContent();
            await rest(1000);
            if (!under) bad('shown by focus: the pointer did not come to rest on the content');
            if (!(await showing(t.trigger, words))) bad('shown by focus: the pointer rested 1 s on the content: no longer shown (hoverable)');
            if ((await focused()) !== who) bad(`shown by focus: the pointer on the content moved focus from ${who} to ${await focused()}`);
          }
          await t.setup(); await t.focus();
          if (!(await showing(t.trigger, words))) bad('not shown on focus again');
          await page.keyboard.press('Tab');
          await rest(400);
          if (!(await hidden(t.trigger))) bad('still shown after focus went (persistent: it goes with the focus)');
          // By the pointer.
          await t.setup();
          if (!(await hidden(t.trigger))) bad('shown before hover');
          const on = await centre(t.trigger);
          await page.mouse.move(on.x, on.y, { steps: 5 });
          await rest(500);
          if (!(await showing(t.trigger, words))) bad('not shown on hover');
          await rest(1500);
          if (!(await showing(t.trigger, words))) bad('hover held 1.5 s: no longer shown (persistent)');
          const to = (await tip(t.trigger)).at;
          if (!to) bad('no content to move onto');
          else {
            await track();
            for (let i = 1; i <= 10; i++) { await page.mouse.move(on.x + ((to.x - on.x) * i) / 10, on.y + ((to.y - on.y) * i) / 10); await rest(50); }
            const under = await onContent();
            await rest(1000);
            if (!under) bad('the pointer did not come to rest on the content');
            if (!(await showing(t.trigger, words))) bad('the pointer rested 1 s on the content: no longer shown (hoverable)');
          }
          await page.mouse.move(OFF.x, OFF.y, { steps: 3 });
          await rest(700);
          if (!(await hidden(t.trigger))) bad('still shown 700 ms after the pointer went (persistent: it goes with the pointer)');
          await t.setup(); await track();
          await page.mouse.move(on.x, on.y, { steps: 5 });
          await rest(500);
          if (!(await showing(t.trigger, words))) bad('not shown on hover again');
          if (t.byException) {
            // Close shown by hover: dismissal is not required of content that obscures nothing (1.4.13's exception),
            // measured here at the run's width and, below, at 320 px; after each measure, the state it found: the
            // tooltip still shown with its words, the pointer's last position unmoved.
            const measured = async (at) => {
              const was = await page.evaluate(() => window.__at), before = await showing(t.trigger, words);
              const { hits, still } = await obscures(t.trigger);
              if (!still) bad(`shown by hover${at}: the page under the tooltip is not still (its base pictures differ), so what it obscures is not established`);
              if (hits.length) bad(`shown by hover${at}: it obscures ${hits.join(', ')}`);
              await clearOf('shown by hover', at, bad);
              if (before && !(await showing(t.trigger, words))) bad(`shown by hover${at}: after the measure no longer shown with its words (the measure changed the state)`);
              const now = await page.evaluate(() => window.__at);
              if (!was || !now || was.x !== now.x || was.y !== now.y) bad(`shown by hover${at}: the pointer's last position is not the one before the measure`);
            };
            await measured('');
            const width = page.viewportSize();
            await page.setViewportSize({ width: 320, height: width.height });
            await t.setup(); await track();
            const narrow = await centre(t.trigger);
            await page.mouse.move(narrow.x, narrow.y, { steps: 5 });
            await rest(500);
            if (!(await showing(t.trigger, words))) bad('not shown on hover at 320 px');
            await measured(' at 320 px');
            await page.setViewportSize(width);
            await t.setup();
            await page.mouse.move(on.x, on.y, { steps: 5 });
            await rest(500);
            if (!(await showing(t.trigger, words))) bad('not shown on hover before Escape');
            // Pinned as Carbon has it: one Escape closes Help, and focus goes back to "Help".
            await page.keyboard.press('Escape');
            await rest(400);
            if (await helpDialog(page).isVisible()) bad('shown by hover: one Escape left Help open (the pinned behaviour changed: rule again)');
            if (!(await focusIs(page, HELP))) bad(`shown by hover: after one Escape focus is on ${await focused()}, not "Help" (the pinned behaviour changed: rule again)`);
          } else {
            who = await focused(); kept = await t.kept();
            await page.keyboard.press('Escape');
            await rest(400);
            if (!(await hidden(t.trigger))) bad('shown by hover: still shown after one Escape (dismissible)');
            if ((await focused()) !== who) bad(`shown by hover: Escape moved focus from ${who} to ${await focused()}`);
            if ((await t.kept()) !== kept) bad(`shown by hover: Escape changed what it must not (${kept} to ${await t.kept()})`);
          }
          done.push(t.name);
        }
        record('1.4.13', !problems.length, problems.length ? problems.join('; ') : `${done.join(' and ')}: each shown by focus and by hover, and kept, shown either way, while the pointer moves onto it and rests; held past every delay; its content no longer drawn once the focus or the pointer goes; each hidden by one Escape with the pointer unmoved, focus kept and nothing else changed, except Close, shown by focus or by hover, which obscures no words and no other control where they are painted (two pictures of each overlap, the tooltip unpainted, with and without the words' parent or the control, equal; the page still under it; the state left as found), at the run's width and at 320 px (the exception; by focus: ${byFocusMeasured.join('; ')}), and covers nothing of "Close" itself, its icon or its box (by geometry), nor paints over its focus outline where the label's or caret's box overlaps it (by pixels, label shown and unpainted) (${triggerClear.join('; ')}), one Escape there closing Help with focus back on "Help" (D206)`);
      },
    },
    {
      // 3.3.5: the shell's two fields. The timeline asks for no text: its help is its visible label, tied to it, and the
      // two times at its ends. The switch for single-key shortcuts in Help (drawn only while Help is open)
      // has its help: the sentence under it, visible once Help is open and tied to it by aria-describedby, so it is
      // read with the switch. A further field needs its own check here. The play bar's Play, disabled with nothing to
      // play, has its reason: the line under the group, visible, tied to it by aria-describedby and not in its name
      // (UI-06 J-21). 4.1.3: the shell's one status region, role status, is empty
      // and nothing changes in the 2 s after the shell loads; a real key (Home, with the preview focused) raises
      // the editor's message in it, and focus stays on the preview. A further status region needs its own check here.
      name: 'fields-and-status',
      method: 'j-forms',
      rows: ['3.3.5', '4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const rest = await shownFields(page).evaluateAll((all, s) => all.map((e) => e.matches(s)), TIMELINE);
        await helpButton(page).click();
        await helpDialog(page).waitFor();
        const inHelp = await helpDialog(page).locator(FIELDS).filter({ visible: true }).evaluateAll((all, s) => all.map((e) => e.matches(s)), SWITCH);
        const fields = rest.length + inHelp.length;
        const onlySwitch = rest.length === 1 && rest[0] && inHelp.length === 1 && inHelp[0];
        const helpText = await singleKeys(page).evaluate((e) => {
          const id = e.getAttribute('aria-describedby'), el = id ? document.getElementById(id) : null;
          return el && el.getBoundingClientRect().height > 0 ? (el.textContent ?? '').trim() : '';
        });
        await open('shell');
        const play = page.locator(PLAY);
        const reason = await play.evaluate((e) => {
          const id = e.getAttribute('aria-describedby'), el = id ? document.getElementById(id) : null;
          return el && el.getBoundingClientRect().height > 0 ? (el.textContent ?? '').trim() : '';
        });
        const playName = await named(play);
        // The timeline asks for no text: its help is its visible label, tied to it, and the two times at its ends.
        const timeline = await page.locator(TIMELINE).evaluate((e) => {
          const id = e.getAttribute('aria-labelledby'), label = id ? document.getElementById(id) : null;
          const ends = [...document.querySelectorAll('.cds--slider__range-label')].map((x) => x.getBoundingClientRect().height > 0 ? (x.textContent ?? '').trim() : '');
          return { label: label && label.getBoundingClientRect().height > 0 ? (label.textContent ?? '').trim() : '', ends };
        });
        const fieldProblems = [
          !onlySwitch && `${fields} field(s); the shell has two, the timeline and the switch in Help: write the check that reaches each other one's help`,
          !helpText && 'the switch has no visible help tied to it by aria-describedby',
          !(await play.isDisabled()) && 'Play is not disabled with nothing to play',
          reason !== NOTHING_TO_PLAY && `Play's description reads ${JSON.stringify(reason)}, not ${JSON.stringify(NOTHING_TO_PLAY)}, visible`,
          playName !== 'button "Play" [disabled]' && `Play is named ${playName}: the reason belongs in its description, not its name`,
          (timeline.label !== 'Timeline' || timeline.ends.join(' ') !== '0:00 0:02') && `the timeline's visible label and times read ${JSON.stringify(timeline)}, not "Timeline" with 0:00 and 0:02`,
        ].filter(Boolean);
        record('3.3.5', !fieldProblems.length, fieldProblems.length ? fieldProblems.join('; ') : `the shell's two fields have their help: the switch "Single-key shortcuts" in Help, its help under it, tied to it and read with it: ${JSON.stringify(helpText)}; the timeline, asking for no text, has its visible label "Timeline" tied to it and the two times at its ends, ${timeline.ends.join(' and ')}; Play, disabled with nothing to play, keeps its name and is described by the visible line under the play bar: ${JSON.stringify(reason)}`);
        await open('shell');
        const live = await page.locator(LIVE).count();
        const statuses = await page.locator(STATUS).count();
        const atRest = await said(page);
        const changes = await page.evaluate(() => new Promise((done) => {
          let n = 0;
          const watch = new MutationObserver((list) => { n += list.length; });
          watch.observe(document.body, { subtree: true, childList: true, characterData: true });
          setTimeout(() => { watch.disconnect(); done(n); }, 2000);
        }));
        await page.locator(PREVIEW).focus();
        await page.keyboard.press('Home');
        const words = await said(page);
        const focusStays = await focusOn(page, PREVIEW);
        const byButton = [];
        for (const [sel, want] of [[SKIP_START, SKIPPED_TO_START], [SKIP_END, SKIPPED_TO_END]]) {
          await open('shell');
          await page.locator(sel).click();
          const got = await said(page);
          if (got !== want) byButton.push(`${sel} said ${JSON.stringify(got)}, not ${JSON.stringify(want)}`);
          if (!(await focusOn(page, sel))) byButton.push(`focus left ${sel} when it raised its message`);
        }
        const problems = [
          ...byButton,
          (live !== 1 || statuses !== 1) && `${live} live region(s), ${statuses} with role status: the shell has one, role status; write the check for any other`,
          atRest && `the status region shows ${JSON.stringify(atRest)} at rest`,
          changes && `the shell changed ${changes} time(s) in the 2 s after it loaded`,
          words !== SKIPPED_TO_START && `Home said ${JSON.stringify(words)} in the status region, not ${JSON.stringify(SKIPPED_TO_START)}`,
          !focusStays && 'focus left the preview when Home raised the message',
        ].filter(Boolean);
        record('4.1.3', !problems.length, problems.length ? problems.join('; ') : `one status region, role status, empty at rest; nothing changes in the 2 s after the shell loads; Home, pressed on the focused preview, says "${SKIPPED_TO_START}" in it and focus stays on the preview; "Skip to start" and "Skip to end", pressed, say "${SKIPPED_TO_START}" and "${SKIPPED_TO_END}" in it with focus kept on each`);
      },
    },
    {
      // 2.1.4, both ways: as the page opens, single-key shortcuts are on and < says "Skipped to start". Their switch
      // in Help, turned off by the keyboard, turns them off: J, K, L, comma, full stop, <, > and ? pressed on the page
      // and on the focused preview and "Skip to start" then say nothing, open nothing, follow nothing and move
      // the timeline not at all (a frame step says nothing even when on, D205), while Home still speaks (the listener
      // was live throughout), on the focused "Skip to start" too. Turned on again, full stop steps one frame, > says
      // "Skipped to end" and K the reason there is nothing to play.
      name: 'character-key-shortcuts',
      method: 'keyboard',
      rows: ['2.1.4'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const start = page.url();
        const problems = [];
        await page.keyboard.press('<');
        if ((await said(page)) !== SKIPPED_TO_START) problems.push(`with the switch on, < said ${JSON.stringify(await said(page))}, not ${JSON.stringify(SKIPPED_TO_START)}`);
        const off = await flipByKeyboard(page);
        if (off.before !== 'true') problems.push('the switch was not on as the page opened');
        if (off.after !== 'false') problems.push('Space on the switch did not turn it off');
        if (!off.back) problems.push('focus did not come back to "Help" after turning the switch off');
        if (!(await quiet(page))) problems.push('the status region did not empty');
        for (const where of ['the page', 'the focused preview', 'the focused "Skip to start"', 'the focused timeline']) {
          if (where === 'the page') await page.locator('header h1').click();
          else if (where === 'the focused preview') await page.locator(PREVIEW).focus();
          else if (where === 'the focused timeline') await page.locator(TIMELINE).focus();
          else await page.locator(SKIP_START).focus();
          for (const key of SINGLE_KEYS) {
            await page.keyboard.press(key);
            const words = await said(page);
            if (words) problems.push(`with the switch off, ${key} on ${where} said ${JSON.stringify(words)}`);
            if ((await atNow(page)).now !== 0) { problems.push(`with the switch off, ${key} on ${where} moved the timeline to ${String((await atNow(page)).now)}`); await page.keyboard.press('Home'); }
            if (await helpDialog(page).isVisible()) { problems.push(`with the switch off, ${key} on ${where} opened Help`); await page.keyboard.press('Escape'); }
            if (page.url() !== start) { problems.push(`${key} on ${where} left the shell for ${page.url()}`); break; }
          }
        }
        await page.locator('header h1').click();
        await page.keyboard.press('Home');
        if ((await said(page)) !== SKIPPED_TO_START) problems.push('Home said nothing with the switch off: the editor\'s keys were not listened for, so the check proves nothing');
        const on = await flipByKeyboard(page);
        if (on.before !== 'false' || on.after !== 'true') problems.push(`the switch read ${String(on.before)} when Help opened again and ${String(on.after)} after Space, not false then true`);
        if (!on.back) problems.push('focus did not come back to "Help" after turning the switch on');
        if (!(await quiet(page))) problems.push('the status region did not empty');
        await page.locator('header h1').click();
        await page.keyboard.press('.');
        if (!(await comesTo(page, 'n === 20'))) problems.push(`with the switch on again, full stop moved the timeline to ${String((await atNow(page)).now)}, not one frame (20)`);
        await page.keyboard.press('>');
        if ((await said(page)) !== SKIPPED_TO_END) problems.push(`with the switch on again, > said ${JSON.stringify(await said(page))}, not ${JSON.stringify(SKIPPED_TO_END)}`);
        if (!(await quiet(page))) problems.push('the status region did not empty');
        await page.keyboard.press('k');
        if ((await said(page)) !== NOTHING_TO_PLAY) problems.push(`with the switch on again, K said ${JSON.stringify(await said(page))}, not ${JSON.stringify(NOTHING_TO_PLAY)}`);
        record('2.1.4', !problems.length, problems.length ? problems.join('; ') : `single-key shortcuts can be turned off (D183): on as the page opens, < says "${SKIPPED_TO_START}"; with their switch in Help turned off by the keyboard, ${SINGLE_KEYS.join(' ')} pressed on the page, on the focused preview, on the focused "Skip to start" and on the focused timeline say, open, follow and move nothing while Home still says "${SKIPPED_TO_START}"; turned on again, full stop steps one frame (20 thousandths) and > says "${SKIPPED_TO_END}"`);
      },
    },
    {
      // With real key events: 2.4.3, Tab meets the reviewed controls in order; 3.2.2, the shell's one setting, the switch
      // in Help, turned off and on by Space changes no context (same page, no new window, Help still open, focus still on
      // the switch); 3.2.5, left
      // alone for 3 s nothing changes context, nothing refreshes the page and no link opens another window; P06, the
      // shell's one task by keyboard (since D209 took its link), turning single-key shortcuts off in Help, runs by Tab,
      // Enter, Space and Escape from a fresh open, and the same keys turn them on again, recovering the shell as it
      // opened; CONF03, the shell presents no process (PROCESSES).
      name: 'keyboard-task',
      method: 'keyboard',
      rows: ['2.4.3', '3.2.2', '3.2.5', 'P06', 'CONF03'],
      run: async ({ page, open, record, tab }) => {
        await open('shell');
        const { order, problems } = await tabOrder(page, tab);
        record('2.4.3', !problems.length, problems.length ? problems.join('; ') : `Tab meets the ${order.length} reviewed control(s) in order, top to bottom: ${order.join(', ')}`);
        await open('shell');
        const start = page.url(), pages = page.context().pages().length;
        const context = [];
        const atRest = await shownFields(page).count();
        await page.locator(TIMELINE).focus();
        for (const key of ['Shift+ArrowRight', 'ArrowLeft']) {
          await page.keyboard.press(key);
          if (page.url() !== start || page.context().pages().length !== pages || !(await focusOn(page, TIMELINE))) context.push(`${key} on the timeline changed the page, opened a window or moved focus`);
        }
        if ((await atNow(page)).now !== 3) context.push('Shift+Right then Left on the timeline did not move it to 3');
        await helpButton(page).focus();
        await page.keyboard.press('Enter');
        await helpDialog(page).waitFor();
        const settings = atRest + await helpDialog(page).locator(FIELDS).filter({ visible: true }).count();
        if (settings !== 2) context.push(`${settings} setting(s); the shell has two, the timeline and the switch in Help: write the check for any other`);
        await singleKeys(page).focus();
        for (const want of ['false', 'true']) {
          await page.keyboard.press('Space');
          if ((await singleKeys(page).getAttribute('aria-checked')) !== want) context.push(`Space did not turn the switch to ${want}`);
          if (page.url() !== start || page.context().pages().length !== pages) context.push('turning the switch changed the page or opened a window');
          if (!(await helpDialog(page).isVisible()) || !(await focusIs(page, SWITCH))) context.push('turning the switch closed Help or moved focus');
        }
        record('3.2.2', !context.length, context.length ? context.join('; ') : 'the shell\'s two settings change no context: the timeline moved by Shift+Right and Left (same page, no new window, focus kept on it), and the switch "Single-key shortcuts" in Help turned off and on by Space (same page, no new window, Help still open, focus still on the switch)');
        await open('shell');
        await page.waitForTimeout(3000);
        const idle = page.url() === start && page.context().pages().length === pages;
        const refresh = await page.locator('meta[http-equiv="refresh" i]').count();
        const windows = await page.locator('a[target]:not([target="_self"]), form[target]:not([target="_self"])').count();
        const change = [!idle && 'the context changed while the shell was left alone', refresh && 'a meta refresh', windows && `${windows} link(s) or form(s) open another window`].filter(Boolean);
        record('3.2.5', !change.length, change.length ? change.join('; ') : 'left alone for 3 s nothing changed context; no refresh and no link opening another window');
        // P06: from a fresh open, Tab to "Help", Enter, Tab to the switch, Space, Escape; then the same to undo it.
        await open('shell');
        let reached = false;
        for (let i = 0; i < 20 && !reached; i++) { await tab(); reached = await focusIs(page, HELP); }
        const task = [];
        if (!reached) task.push('Tab did not reach "Help"');
        else {
          await page.keyboard.press('Enter');
          if (!(await helpDialog(page).waitFor({ timeout: 2000 }).then(() => true, () => false))) task.push('Enter on "Help" did not open it');
          else {
            for (let i = 0; i < 6 && !(await focusIs(page, SWITCH)); i++) await page.keyboard.press('Tab');
            const was = await singleKeys(page).getAttribute('aria-checked');
            await page.keyboard.press('Space');
            const now = await singleKeys(page).getAttribute('aria-checked');
            await page.keyboard.press('Escape');
            if (was !== 'true' || now !== 'false') task.push(`the switch read ${String(was)} then ${String(now)}, not on then off`);
            if (!(await backOnHelp(page))) task.push('focus did not come back to "Help" after the task');
            const again = await flipByKeyboard(page);
            if (again.before !== 'false' || again.after !== 'true' || !again.back) task.push(`turned on again it read ${String(again.before)} then ${String(again.after)}${again.back ? '' : ', focus not back on "Help"'}`);
          }
        }
        if (page.url() !== start) task.push(`the task left the shell for ${page.url()}`);
        record('P06', !task.length, task.length ? task.join('; ') : 'the shell\'s one task by keyboard, turning single-key shortcuts off in Help, runs from a fresh open by Tab to "Help", Enter, Tab to the switch, Space and Escape, with focus back on "Help"; the same keys turn them on again, recovering the shell as it opened');
        // CONF03: the shell's process boundary, observed. A form, or a link to another of the app's pages, means a process
        // may be presented: it is declared in PROCESSES and its journey runs every step.
        await open('shell');
        const forms = await page.locator('form').count();
        const inApp = await page.evaluate((origin) => [...document.querySelectorAll('a[href]')].filter((a) => a.origin === origin && a.pathname !== location.pathname).length, ORIGIN);
        record('CONF03', !PROCESSES.length && !forms && !inApp, PROCESSES.length ? `${PROCESSES.length} declared process(es): write the journey that runs every step of each` : forms || inApp ? `${forms} form(s) and ${inApp} link(s) to other pages of the app: declare the process they present in PROCESSES and run every step` : 'the shell presents no process: no form and no link to another of the app\'s pages; its one link leaves Route Plotter, so its destination is no step of a Route Plotter process');
      },
    },
    {
      // 4.1.3 (stage 6): "Open project" pressed and the journeys' project chosen: the status region says "Project
      // opened", once, and nothing else, with no alert and focus kept on the button; the line saying why Play is off is
      // gone; the position waits at the end (1000: D251, brief 127); Play pressed plays from 0, the position rising.
      // Criterion 3's open half on the page.
      name: 'open-a-project',
      method: 'j-forms',
      rows: ['4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const heard = await hear(page);
        const wrong = [];
        if (!(await choose(page, await projectFile()))) wrong.push('a press on "Open project" opened no file chooser');
        if (!(await saysOpened(page))) wrong.push(`the status region never said "${OPENED}"`);
        await quiet(page);
        const texts = await heard();
        if (JSON.stringify(texts) !== JSON.stringify([OPENED])) wrong.push(`the status region said ${JSON.stringify(texts)}, not "${OPENED}" once and nothing else`);
        if (await alerts(page).count()) wrong.push('an alert showed');
        if (!(await focusOn(page, OPEN))) wrong.push('focus left "Open project"');
        if (await page.getByText(NOTHING_TO_PLAY).count()) wrong.push('the line saying why Play is off still shows');
        const from = (await atNow(page)).now;
        await page.locator(PLAY).click();
        const played = await sample(page, 30);
        const last = played.at(-1)[1];
        if (from !== 1000) wrong.push(`the position before Play was ${from}, not 1000 (the end)`);
        if (!(last > 0) || backwards(played).length) wrong.push(`after Play the position went ${played.map(([, v]) => v).join(', ')}, not rising from 0`);
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `"${OPENED}" said once and nothing else, no alert, focus kept on "Open project", the reason line gone, the position at 1000 (the end); Play played from 0 to ${last} thousandths in 30 frames`);
      },
    },
    {
      // D276 (a), kept as built: the parent chat's reading of the owner's answer of 2026-11-27, which stands unless he
      // objects (brief 145, ruling JC 4; widened by brief 147, ruling KA 3): Open over a route drawn since
      // the page opened asks first. In pen-drawn (two taps: the route has changed), the journeys' project chosen
      // through "Open project" shows one dialog, "Replace your route?", naming the file, with focus on "Keep my route".
      // It is then kept four ways, each from a fresh Open: one Escape, "Keep my route" by its button, the dialog's
      // Close, and a press outside it; each time the dialog is gone, the canvas reads as before (the same pixels),
      // "Open cancelled" is heard once more and nothing else, and focus is back on "Open project". Then a second ask
      // while one is shown (Codex on 3491f00): with the dialog up and focus moved by Tab to "Replace", the page's own
      // Open key (Cmd/Ctrl+O) opens nothing (the open dialog takes it, keydown.ts), and the button is behind the
      // dialog, so from the page a second ask comes only from a second picker opened before the first question
      // appeared, its file chosen after the question showed (were the second file chosen before the first question
      // appeared, the first open would be superseded and never ask). The journey holds that order itself: it presses
      // "Open project" twice, so both pickers are open before any file is chosen, then chooses the same file in the
      // first, moves focus to "Replace" once the question shows, then chooses in the second;
      // the first open is set aside unsaid (openLogic.ts point 14), one dialog stays, and focus goes back to "Keep my
      // route". Escape then keeps the route as before. Open again and "Replace": "Project opened" heard, the opened
      // project drawn (the canvas changed), focus back on "Open project". Open once more, nothing drawn since: no
      // dialog, "Project opened". It claims 3.3.4 (the one action that throws work away is confirmed); the runner
      // refuses 2.4.3 for a j-forms journey, so focus is read here as part of 3.3.4's result only. 3.3.6 (STACK-08,
      // brief 161): Open over changes is the page's one submission that throws work away, and it is confirmed; the
      // canvas edits are reversed by one Undo (a-delete-is-undone); the switch is turned back by itself; the timeline
      // is a position, not a submission.
      name: 'open-over-changes',
      method: 'j-forms',
      rows: ['3.3.4', '3.3.6'],
      run: async ({ page, open, record }) => {
        await open('pen-drawn');
        const wrong = [];
        const question = page.getByRole('dialog', { name: 'Replace your route?' });
        const asked = () => question.waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false);
        const focused = () => page.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.tagName || 'nothing');
        const focusComesTo = (words) => page.waitForFunction((w) => document.activeElement?.textContent?.trim() === w, words, { timeout: 3000 }).then(() => true, () => false);
        const says = (w) => page.waitForFunction(([sel, words]) => document.querySelector(sel)?.textContent === words, [STATUS, w], { timeout: 6000 }).then(() => true, () => false);
        const drawn = await pixels(page);
        const heard = await hear(page);
        let cancels = 0;
        // After a way of keeping: the dialog gone, "Open cancelled" heard once more, the canvas as before, focus back.
        const keptBy = async (how) => {
          if (await question.count()) wrong.push(`${how} left the dialog open`);
          if (!(await says('Open cancelled'))) wrong.push(`"Open cancelled" was not said after ${how}`);
          await quiet(page);
          await twoFrames(page);
          cancels += 1;
          if ((await pixels(page)).hash !== drawn.hash) wrong.push(`after ${how} the canvas did not read as before the Open: the route was replaced`);
          if (!(await focusOn(page, OPEN))) wrong.push(`after ${how} focus was on "${await focused()}", not "Open project"`);
          const texts = await heard();
          if (JSON.stringify(texts) !== JSON.stringify(Array(cancels).fill('Open cancelled'))) wrong.push(`after ${how} the status region had said ${JSON.stringify(texts)}, not "Open cancelled" ${cancels} time(s) and nothing else`);
        };
        // (1) Asked, kept by Escape.
        if (!(await choose(page, await projectFile()))) wrong.push('a press on "Open project" opened no file chooser');
        if (!(await asked())) wrong.push('no "Replace your route?" dialog showed over a drawn route');
        else {
          if ((await page.getByRole('dialog').count()) !== 1) wrong.push(`${await page.getByRole('dialog').count()} dialogs showed, not one`);
          const text = await question.innerText();
          if (!/Replace your route with \S+\? What you have drawn is not saved and will be lost\./.test(text)) wrong.push(`the dialog read "${text}", not naming the file and saying the route will be lost`);
          const first = await focused();
          if (first !== 'Keep my route') wrong.push(`as the dialog opened focus was on "${first}", not "Keep my route"`);
          await page.keyboard.press('Escape');
          await keptBy('Escape');
        }
        // (1b) Kept by "Keep my route", by Close and by a press outside, each from a fresh Open.
        for (const [how, act] of [
          ['"Keep my route" by its button', () => question.getByRole('button', { name: 'Keep my route', exact: true }).click()],
          ['the dialog\'s Close', () => question.getByRole('button', { name: 'Close', exact: true }).click()],
          ['a press outside the dialog', () => page.mouse.click(4, 4)],
        ]) {
          if (!(await choose(page, await projectFile()))) wrong.push(`before ${how} a press on "Open project" opened no file chooser`);
          if (!(await asked())) wrong.push(`before ${how} no dialog showed over the drawn route`);
          else {
            await act();
            await keptBy(how);
          }
        }
        // (1c) A second ask while one is shown: one dialog, focus back on "Keep my route".
        {
          const chooser = () => page.waitForEvent('filechooser', { timeout: 3000 }).then((c) => c, () => null);
          const one = chooser();
          await page.locator(OPEN).click();
          const c1 = await one;
          const two = chooser();
          await page.locator(OPEN).click();
          const c2 = await two;
          if (!c1 || !c2) wrong.push(`two presses on "Open project" opened ${[c1, c2].filter(Boolean).length} file chooser(s), not two`);
          else {
            await c1.setFiles(await projectFile());
            if (!(await asked())) wrong.push('no dialog showed for the first of two files chosen');
            else {
              await page.keyboard.press('Tab');
              const moved = await focused();
              if (moved !== 'Replace') wrong.push(`Tab from "Keep my route" put focus on "${moved}", not "Replace"`);
              const { opened } = await pressOpenKey(page, 1500);
              if (opened) wrong.push('the Open key, pressed in the dialog, opened a file chooser');
              await c2.setFiles(await projectFile());
              if (!(await focusComesTo('Keep my route'))) wrong.push(`a second ask for the same file while the question showed left focus on "${await focused()}", not "Keep my route"`);
              if ((await page.getByRole('dialog').count()) !== 1) wrong.push(`after a second ask ${await page.getByRole('dialog').count()} dialogs showed, not one`);
              await page.keyboard.press('Escape');
              await keptBy('Escape on the second ask');
            }
          }
        }
        const kept = await heard();
        // (2) Asked, replaced.
        if (!(await choose(page, await projectFile()))) wrong.push('the press before "Replace" opened no file chooser');
        if (!(await asked())) wrong.push('no dialog showed on the Open before "Replace" over the drawn route');
        else {
          await question.getByRole('button', { name: 'Replace', exact: true }).click();
          if (!(await saysOpened(page))) wrong.push(`after "Replace" the status region never said "${OPENED}"`);
          if (await question.count()) wrong.push('"Replace" left the dialog open');
          await quiet(page);
          await twoFrames(page);
          if ((await pixels(page)).hash === drawn.hash) wrong.push('after "Replace" the canvas read as the drawn route: the project was not shown');
          if (!(await focusOn(page, OPEN))) wrong.push(`after "Replace" focus was on "${await focused()}", not "Open project"`);
        }
        const replaced = (await heard()).slice(kept.length);
        if (JSON.stringify(replaced) !== JSON.stringify([OPENED])) wrong.push(`after "Replace" the status region said ${JSON.stringify(replaced)}, not "${OPENED}" once`);
        // (3) Nothing drawn since the Open: no question.
        if (!(await choose(page, await projectFile()))) wrong.push('the third press on "Open project" opened no file chooser');
        if (!(await saysOpened(page))) wrong.push(`with nothing drawn since, the status region never said "${OPENED}"`);
        if (await page.getByRole('dialog').count()) wrong.push('with nothing drawn since the last Open a dialog showed');
        await quiet(page);
        record('3.3.6', !wrong.length, wrong.length ? wrong.join('; ') : 'Open over a drawn route is confirmed: "Replace your route?" asked, each way of keeping kept the route as before, only "Replace" opened the project');
        record('3.3.4', !wrong.length, wrong.length ? wrong.join('; ') : `over a drawn route Open asked "Replace your route?" in one dialog with focus on "Keep my route"; one Escape, "Keep my route" by its button, the dialog's Close and a press outside each kept the route (the canvas as before), said "Open cancelled" once more and put focus back on "Open project"; with focus moved to "Replace", the Open key opened nothing, and a second ask for the same file left one dialog with focus back on "Keep my route", and Escape kept the route; "Replace" opened the project, said "${OPENED}" once and put focus back on "Open project"; with nothing drawn since, Open asked nothing`);
      },
    },
    {
      // D251's first half (Joe, 26 Nov: "End, plus a guide"; brief 127): a project whose route ends in a trail opened, the
      // timeline waits at its end, its words "x of x" (the trail's run-on and Hold at end counted: longer than the empty
      // page's 0:02), and stays there with nothing pressed; the status region says "Project opened" and nothing else
      // (not "Skipped to end", not "Animation complete"); Play then plays from 0, the position rising.
      name: 'opens-at-the-end',
      method: 'j-forms',
      rows: ['4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const empty = await atNow(page);
        const heard = await hear(page);
        const wrong = [];
        if (!(await choose(page, await projectFile(null, false, false, null, true)))) wrong.push('a press on "Open project" opened no file chooser');
        if (!(await saysOpened(page))) wrong.push(`the status region never said "${OPENED}"`);
        const at = await atNow(page);
        const halves = /^(\d+:\d\d) of (\d+:\d\d)$/.exec(at.text ?? '');
        if (at.now !== 1000) wrong.push(`after the open the position was ${at.now}, not 1000 (the end)`);
        if (!halves || halves[1] !== halves[2]) wrong.push(`after the open the time read "${at.text}", not "x of x"`);
        if (at.text === empty.text) wrong.push(`the time read "${at.text}", as the empty page did: the opened length was not taken`);
        const still = await sample(page, 20);
        await page.waitForTimeout(500);
        const later = await atNow(page);
        if (still.some(([, v]) => v !== 1000) || later.now !== 1000 || later.text !== at.text) wrong.push(`left alone the position went ${still.map(([, v]) => v).join(', ')}, then ${later.now} ("${later.text}"), not held at the end`);
        if ((await playLabel(page)) !== 'Play') wrong.push(`the play button reads "${await playLabel(page)}", not "Play"`);
        await quiet(page);
        const texts = await heard();
        if (JSON.stringify(texts) !== JSON.stringify([OPENED])) wrong.push(`the status region said ${JSON.stringify(texts)}, not "${OPENED}" once and nothing else`);
        await page.locator(PLAY).click();
        const played = await sample(page, 30);
        const last = played.at(-1)[1];
        if (!(played[0][1] <= 50) || !(last > played[0][1]) || backwards(played).length) wrong.push(`after Play the position went ${played.map(([, v]) => v).join(', ')}, not rising from 0`);
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `a trail's project opened: the time "${at.text}" (the empty page's "${empty.text}"), the position 1000 and held 20 frames and half a second with Play offered; "${OPENED}" said once and nothing else; Play played from ${played[0][1]} to ${last} thousandths in 30 frames`);
      },
    },
    {
      // D251's second half (Joe, 26 Nov: "End, plus a guide (d)"; D265; brief 128, BT): while the preview is not playing,
      // the editor's guide traces every line of every route and marks every point, whatever the line's look; while
      // playing it is gone. (1) A trail's project opened (opens-at-the-end's), paused at the end, where a trail draws
      // nothing: along 25 columns at 0.55 of the way from the first stop's x (0.25 of the square) to the second's
      // (0.75; 0.65 until brief 151, moved off the way arrow two thirds along, D275, whose white edge filled 6 of those
      // columns: PROBE-151/probe-guide.txt, 7 lit where the dashes light 13), the guide's dashes, some columns the line's colour (alpha 64 or more) and some bare (rowAt: dashed 6 on
      // and 4 off); at each stop, the line's colour opaque (strokeAt, near(); the stops' own markers read so with the
      // guide off too, probed: the guide's dot is proved at the copies, (4)). (2) Play: the position rises, and at that
      // place every column is bare (the trail's comet starts behind the head at the first stop and is nowhere near). (3)
      // Pause: "Animation paused", and the dashes are back; played through to "Animation complete", back again. (4) CARRY-F6: pen-drawn,
      // End, Escape, Cmd+A, Cmd+D, Escape: at each copy (2% right and down of its tap, joined to no line, so the
      // animation draws nothing for it: FINDING-124), 2 canvas px further from the line (the line passes 2.5 px from
      // it), a pixel bare before Cmd+D reads the line's colour opaque after Escape: its guide dot; the canvas is not as
      // before Cmd+D. Faults that fail it (PROBE-128/mut): (u) the guide drawn while playing fails (2); (w) the guide for
      // the selected route only fails (1), (3) and (4). (v) `playing` out of the drawer's Key does not fail it: in the page
      // a Pause, or the end, always brings a position not yet drawn (point 4g's frame late), so a frame is drawn anyway;
      // the Node test of point 4b holds it (previewLogic.test.ts, a Pause at the same position books). (5) D275 (brief 151): at
      // each of (1), (3) and (3b), round two thirds of the way (the trail's line runs one way, first stop to second), rows
      // 2 to 4 px off the line hold the route's colour and white (arrowAt): the way arrow, which the 2-wide guide never
      // reaches; in (2), playing, none. It claims nothing for an export (the import rules keep the guide out of one:
      // catalogue.editor.ts) and nothing spoken.
      name: 'the-guide',
      method: 'j-timing',
      rows: ['2.2.2'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const wrong = [];
        if (!(await choose(page, await projectFile(null, false, false, null, true))) || !(await saysOpened(page)) || !(await quiet(page))) wrong.push('the trail\'s project did not open');
        if (!(await sizeSettled(page))) wrong.push('after the open the canvas was not its box times the ratio');
        await twoFrames(page);
        const opened = await pixels(page);
        const [x0, x1] = [squareX(opened, 0.25), squareX(opened, 0.75)];
        const along = x0 + 0.55 * (x1 - x0);
        const way = x0 + (2 / 3) * (x1 - x0);
        const arrowed = (a) => a.hue >= 1 && a.white >= 8;
        const lit = (p) => p[3] >= 64 && ORANGE.every((v, i) => Math.abs(p[i] - v) <= 24);
        const dashes = async () => { const row = await rowAt(page, along, 0.5); return { lit: row.filter(lit).length, alphas: row.map((p) => p[3]).join(', ') }; };
        const atEnd = await dashes();
        const arrowEnd = await arrowAt(page, way, 0.5);
        if (!arrowed(arrowEnd)) wrong.push(`paused at the end, round ${way.toFixed(4)} (two thirds along the one-way line) rows 2 to 4 px off it read ${arrowEnd.hue} of the line's colour and ${arrowEnd.white} white, not the way arrow (D275)`);
        if (!(atEnd.lit >= 5 && atEnd.lit <= 20)) wrong.push(`paused at the end, ${atEnd.lit} of 25 columns at ${along.toFixed(4)} are the line's colour (alphas ${atEnd.alphas}), not the guide's dashes`);
        const stops = [await strokeAt(page, x0, 0.5), await strokeAt(page, x1, 0.5)];
        if (!stops.every((p) => near(p, ORANGE))) wrong.push(`paused at the end the stops read ${stops.map((p) => p.join(', ')).join(' and ')}, not the line's colour`);
        await page.locator(PLAY).click();
        await page.waitForTimeout(250);
        const playing = await dashes();
        const arrowPlaying = await arrowAt(page, way, 0.5);
        const moving = await sample(page, 3);
        if (!(moving.at(-1)[1] > 0)) wrong.push(`after Play the position read ${moving.map(([, v]) => v).join(', ')}, not rising`);
        if (arrowPlaying.hue !== 0 || arrowPlaying.white !== 0) wrong.push(`playing, round ${way.toFixed(4)} rows 2 to 4 px off the line read ${arrowPlaying.hue} of the line's colour and ${arrowPlaying.white} white: the way arrow is drawn while playing`);
        if (playing.lit !== 0) wrong.push(`playing, ${playing.lit} of 25 columns at ${along.toFixed(4)} are the line's colour (alphas ${playing.alphas}): the guide is drawn while playing`);
        await page.locator(PLAY).click();
        if (!(await comesToWords(page, PAUSED))) wrong.push(`Pause: "${PAUSED}" was not said`);
        await twoFrames(page);
        const paused = await dashes();
        const arrowPaused = await arrowAt(page, way, 0.5);
        if (!arrowed(arrowPaused)) wrong.push(`paused again, round ${way.toFixed(4)} rows 2 to 4 px off the line read ${arrowPaused.hue} of the line's colour and ${arrowPaused.white} white, not the way arrow`);
        if (!(paused.lit >= 5 && paused.lit <= 20)) wrong.push(`paused again, ${paused.lit} of 25 columns at ${along.toFixed(4)} are the line's colour (alphas ${paused.alphas}), not the guide's dashes`);
        // (3b) Played through: at "Animation complete" the playing stops at the end, and the guide is back.
        await page.locator(PLAY).click();
        const done = await page.waitForFunction(([st, w]) => document.querySelector(st)?.textContent === w, [STATUS, COMPLETE], { timeout: 15000 }).then(() => true, () => false);
        if (!done) wrong.push(`"${COMPLETE}" was not said`);
        await twoFrames(page);
        const ended = await dashes();
        const arrowEnded = await arrowAt(page, way, 0.5);
        if (!arrowed(arrowEnded)) wrong.push(`at "${COMPLETE}" round ${way.toFixed(4)} rows 2 to 4 px off the line read ${arrowEnded.hue} of the line's colour and ${arrowEnded.white} white, not the way arrow`);
        if (!(ended.lit >= 5 && ended.lit <= 20)) wrong.push(`at "${COMPLETE}" ${ended.lit} of 25 columns at ${along.toFixed(4)} are the line's colour (alphas ${ended.alphas}), not the guide's dashes`);
        // (4) Duplicate's copies.
        await open('pen-drawn');
        const [first, second] = TAPS;
        const settle = async () => { await page.waitForTimeout(250); await twoFrames(page); };
        const press = async (key) => { await page.keyboard.press(key); await settle(); };
        const box = await boxOf(page);
        const across = (0.02 * box.height) / box.width;
        const copies = [first, second].map(([fx, fy]) => [fx + across, fy + 0.02]);
        const dotsAt = () => page.locator(CANVAS).evaluate((c, [places, [a, b]]) => {
          const [dx, dy] = [(b[0] - a[0]) * c.width, (b[1] - a[1]) * c.height];
          const len = Math.hypot(dx, dy);
          const [nx, ny] = [dy / len, -dx / len];
          return places.map(([fx, fy]) => {
            const [x, y] = [fx * c.width, fy * c.height];
            const side = Math.sign((x - a[0] * c.width) * nx + (y - a[1] * c.height) * ny) || 1;
            return [...c.getContext('2d').getImageData(Math.floor(x + 2 * side * nx), Math.floor(y + 2 * side * ny), 1, 1).data];
          });
        }, [copies, [first, second]]);
        let tabs = 0;
        while (!(await focusOn(page, PREVIEW)) && tabs < 8) { await page.keyboard.press('Tab'); tabs += 1; }
        if (!(await focusOn(page, PREVIEW))) wrong.push('eight presses of Tab did not reach the preview box');
        await press('End');
        await press('Escape');
        const before = await dotsAt();
        const beforeCopy = (await pixels(page)).hash;
        await press(`${COMMAND}+a`);
        await press(`${COMMAND}+d`);
        await press('Escape');
        const after = await dotsAt();
        if (before.some((p) => near(p, ORANGE))) wrong.push(`before Cmd+D the copies' places already read ${before.map((p) => p.join(', ')).join(' and ')}`);
        if (!after.every((p) => near(p, ORANGE))) wrong.push(`after Cmd+D and Escape the copies' places read ${after.map((p) => p.join(', ')).join(' and ')}, not their guide dots in the line's colour`);
        if ((await pixels(page)).hash === beforeCopy) wrong.push('after Cmd+D and Escape the canvas is as before Cmd+D: the copies show nothing');
        record('2.2.2', !wrong.length, wrong.length ? wrong.join('; ') : `a trail's project paused at its end: at ${along.toFixed(4)} ${atEnd.lit} of 25 columns the guide's dashes (alphas ${atEnd.alphas}), both stops the line's colour; playing, none (alphas ${playing.alphas}); paused again, ${paused.lit} (the guide back); pen-drawn, after Cmd+A, Cmd+D and Escape, each copy's guide dot (${after.map((p) => p.join(', ')).join(' and ')}) where before Cmd+D there was ${before.map((p) => p.join(', ')).join(' and ')}`);
      },
    },
    {
      // The preview (brief 84, a; brief 128, BN): before any open the canvas is sized to its box times the pixel ratio
      // (a paint ran) and holds an empty scene's frame, nothing drawn; the golden opened, its pixels differ and the
      // position waits at the end (1000, as opens-at-the-end reads it: D251), the line's colour stands at the start's
      // place by arithmetic (a square fitted to the frame's height, centred: squareX) and at the middle the end's faded
      // line, read as the-preview-plays reads it (the line's colour at alpha 64 or more: near()'s 200 would pass with the
      // line gone) in every one of 25 columns there (rowAt: the guide drawn while paused, dashed, leaves some bare, so
      // only the frame's line passes; probed, PROBE-128/s3probe-run.txt); left alone a second, nothing changes (no
      // motion until Play: 2.2.2).
      name: 'the-preview-draws',
      method: 'j-timing',
      rows: ['2.2.2'],
      run: async ({ page, open, record }) => {
        await open('shell');
        await twoFrames(page);
        const wrong = [];
        const box = await boxOf(page);
        const empty = await pixels(page);
        const sized = [Math.round(box.width * box.ratio), Math.round(box.height * box.ratio)];
        if (empty.width !== sized[0] || empty.height !== sized[1]) wrong.push(`the canvas is ${empty.width} by ${empty.height}, not its box times the ratio, ${sized.join(' by ')}`);
        if (empty.drawn) wrong.push(`before any open ${empty.drawn} pixels are drawn, not an empty scene's none`);
        if (!(await choose(page, await projectFile())) || !(await saysOpened(page))) wrong.push('the project did not open');
        await twoFrames(page);
        const at = await atNow(page);
        const opened = await pixels(page);
        const x = squareX(opened, 0.25);
        const start = await strokeAt(page, x, 0.5);
        const row = await rowAt(page, 0.5, 0.5);
        const middle = row[12];
        if (at.now !== 1000) wrong.push(`after the open the position was ${at.now}, not 1000 (the end)`);
        if (opened.hash === empty.hash) wrong.push('the canvas did not change when the project opened');
        if (!near(start, ORANGE)) wrong.push(`at the start's place (${x.toFixed(4)}, 0.5) the canvas holds ${start.join(', ')}, not the line's #d55e00`);
        const bare = row.filter((p) => !(p[3] >= 64 && ORANGE.every((v, i) => Math.abs(p[i] - v) <= 24)));
        if (bare.length) wrong.push(`at the end ${bare.length} of 25 columns at the middle are not the line's colour (alphas ${row.map((p) => p[3]).join(', ')})`);
        await page.waitForTimeout(1000);
        if ((await pixels(page)).hash !== opened.hash) wrong.push('left alone a second, the canvas changed');
        record('2.2.2', !wrong.length, wrong.length ? wrong.join('; ') : `the canvas ${sized.join(' by ')}, its box times the ratio, empty before an open; the golden opened: changed, the position 1000 (the end), #d55e00 at (${x.toFixed(4)}, 0.5), the start's place ((${opened.width} - ${opened.height}) / 2 + 0.25 x ${opened.height}, over ${opened.width}), the line's colour in all 25 columns at the middle (${middle.join(', ')} at its centre); still over a second with nothing playing`);
      },
    },
    {
      // The preview (brief 84, b): Play moves the picture (two moments differ); Pause holds it (the same pixels half a
      // second on: a playing can be stopped, 2.2.2); played to the end, "Animation complete", the canvas holds what a
      // press of End draws from a fresh open, the whole line, the middle in the line's colour: the end is drawn.
      name: 'the-preview-plays',
      method: 'j-timing',
      rows: ['2.2.2'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const wrong = [];
        if (!(await choose(page, await projectFile())) || !(await saysOpened(page)) || !(await quiet(page))) wrong.push('the project did not open');
        await page.locator(PLAY).click();
        await page.waitForTimeout(300);
        const one = await pixels(page);
        await page.waitForTimeout(300);
        const two = await pixels(page);
        if (one.hash === two.hash) wrong.push('playing, the canvas did not change between two moments 300 ms apart');
        await page.locator(PLAY).click();
        if (!(await comesToWords(page, PAUSED))) wrong.push(`Pause: "${PAUSED}" was not said`);
        await twoFrames(page);
        const paused = await pixels(page);
        await page.waitForTimeout(500);
        if ((await pixels(page)).hash !== paused.hash) wrong.push('paused, the canvas still changed');
        await page.locator(PLAY).click();
        const done = await page.waitForFunction(([st, w]) => document.querySelector(st)?.textContent === w, [STATUS, COMPLETE], { timeout: 12000 }).then(() => true, () => false);
        if (!done) wrong.push(`"${COMPLETE}" was not said`);
        if (!(await sizeSettled(page))) wrong.push('at "Animation complete" the canvas was not its box times the ratio');
        await twoFrames(page);
        const ended = await pixels(page);
        const middle = await strokeAt(page, 0.5, 0.5);
        await open('shell');
        if (!(await choose(page, await projectFile())) || !(await saysOpened(page)) || !(await quiet(page))) wrong.push('the second open failed');
        await page.keyboard.press('End');
        if (!(await sizeSettled(page))) wrong.push('after End the canvas was not its box times the ratio');
        await twoFrames(page);
        const byEnd = await pixels(page);
        if (ended.hash !== byEnd.hash) wrong.push('at "Animation complete" the canvas is not what End draws from a fresh open');
        // At the end the line's trail stands faded behind the head (101 of 255 measured at the middle): its colour, seen.
        if (!(middle[3] >= 64 && ORANGE.every((v, i) => Math.abs(middle[i] - v) <= 24))) wrong.push(`at the end the middle holds ${middle.join(', ')}, not the line's colour`);
        record('2.2.2', !wrong.length, wrong.length ? wrong.join('; ') : `playing, the canvas changed between two moments; Pause held it half a second; at "${COMPLETE}" it equals End from a fresh open, the middle #d55e00: the end drawn`);
      },
    },
    {
      // The preview (brief 84, c; D202, the owner's choice): a project whose picture is 200 by 100 of #3366cc, its second
      // stop at (0.25, 1) so the line runs down x = 0.25 of it. The box takes the video's shape, not the picture's, and
      // the composer fits the picture inside (imageBounds, "fit", centred). (a) The golden's video, 1920 by 1080: the
      // picture (2 to 1) is wider than the frame (16 to 9), so it fills the width and its height is the width / 2, that
      // is 16/9 / 2 = 8/9 of the frame's; the bands are the top and bottom 1/18 each (0.0556). Picture (0.75, 0.25) and
      // (0.75, 0.75) fall at frame (0.75, 0.0556 + 0.25 x 8/9 = 0.2778) and (0.75, 0.7222): blue; (0.75, 0.02) and
      // (0.75, 0.98) are in the bands, where the background draws its white margin over the whole frame before the
      // picture, as the export does (background.ts, v3's): opaque white, not the picture. (b) The same with a video of
      // 1080 by 1920: the box is 9 to 16 and the picture's height is 9/16 / 2 = 9/32 of the frame's (0.2813), from 0.3594
      // to 0.6406: blue at (0.75, 0.40) and (0.75, 0.60), the white margin at (0.75, 0.2) and (0.75, 0.8). (c) The golden
      // opened again brings the box
      // back to 16 to 9: the shape follows the scene held. Each time the canvas is its box times the pixel ratio. (d)
      // The length is the picture's measure: 0.5 heights down a 2:1 picture is 0.25 widths, 1.25 s at the golden's speed
      // (0.2 widths a second), with a stop's 1.5 s and the 2 s hold 4.75 s, "0:04"; the same project with no picture
      // measures as a square, 0.5 widths, 2.5 s, 6 s, "0:06".
      name: 'the-preview-shows-the-picture',
      method: 'j-timing',
      rows: ['2.2.2'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const wrong = [];
        // Waits until the canvas has the shape asked (within 0.02), its box's size times the ratio (to a pixel) and the
        // blue at (fx, fy): the frame drawn at the box's settled size. CORE-06 (brief 111): Open's busy notice takes
        // room from the box while a project opens, and gives it back when it goes, so a frame of the right shape can
        // be drawn at the smaller size before the box grows again; `frameAs` still checks the size by itself. Brief 129:
        // so each open is waited out to `quiet` (the status emptied, about 2 s on) before `drawnAs`: the busy line goes
        // with "Project opened", the room is measured again a task later and the canvas follows a frame after that, so
        // a frame drawn at the smaller size in that gap met `drawnAs` and `frameAs` then read the grown box against it
        // (2 of 40 runs on f9e285b: 684 by 385 against 704 by 396; the canvas was its box at the next reading,
        // PROBE-129). Steps (b) and (c) waited `quiet` before their open, for the last "Project opened"; now each
        // open is followed by it, the first included, so the next one starts quiet as before.
        const drawnAs = (shape, fx, fy) => page.waitForFunction(([sel, rgb, shape, x, y]) => {
          const c = document.querySelector(sel);
          if (Math.abs(c.width / c.height - shape) > 0.02) return false;
          const box = c.parentElement.getBoundingClientRect(), s = Math.min(devicePixelRatio, 3);
          if (Math.abs(c.width - box.width * s) > 1 || Math.abs(c.height - box.height * s) > 1) return false;
          const [r, g, b, a] = c.getContext('2d').getImageData(Math.floor(x * c.width), Math.floor(y * c.height), 1, 1).data;
          return a > 200 && Math.abs(r - rgb[0]) <= 24 && Math.abs(g - rgb[1]) <= 24 && Math.abs(b - rgb[2]) <= 24;
        }, [CANVAS, BLUE, shape, fx, fy], { timeout: 3000 }).then(() => true, () => false);
        // The box's shape, the canvas as its box times the ratio (to a pixel), blue at `inside`, the white margin at `bands`.
        const frameAs = async (label, shape, inside, bands) => {
          const box = await boxOf(page);
          const { width, height } = await pixels(page);
          if (Math.abs(box.width / box.height - shape) > 0.02) wrong.push(`${label}: the box is ${box.width} by ${box.height}, not ${shape.toFixed(4)} wide to 1 high`);
          const scale = Math.min(box.ratio, 3);
          if (Math.abs(width - box.width * scale) > 1 || Math.abs(height - box.height * scale) > 1) wrong.push(`${label}: the canvas is ${width} by ${height}, not its box ${box.width} by ${box.height} times ${scale}`);
          for (const [x, y] of inside) { const p = await pixelAt(page, x, y); if (!near(p, BLUE)) wrong.push(`${label}: not the picture's #3366cc at (${x}, ${y}) (${p.join(', ')})`); }
          for (const [x, y] of bands) { const p = await pixelAt(page, x, y); if (!near(p, [255, 255, 255])) wrong.push(`${label}: not the white margin in a band at (${x}, ${y}) (${p.join(', ')})`); }
          return `${box.width} by ${box.height}`;
        };
        if (!(await choose(page, await projectFile(null, true))) || !(await saysOpened(page)) || !(await quiet(page))) wrong.push('the project with no picture did not open');
        const square = (await atNow(page)).text?.split(' of ')[1];
        const png = await plainPng(page, 200, 100, '#3366cc');
        // (a) the golden's video, 1920 by 1080.
        if (!(await choose(page, await projectFile(png, true))) || !(await saysOpened(page)) || !(await quiet(page))) wrong.push('the project with the picture did not open');
        if (!(await drawnAs(16 / 9, 0.75, 0.2778))) wrong.push('with the picture and a 1920 by 1080 video, no 16 to 9 frame with the blue at (0.75, 0.2778) came');
        const wide = await frameAs('1920 by 1080', 16 / 9, [[0.75, 0.2778], [0.75, 0.7222]], [[0.75, 0.02], [0.75, 0.98]]);
        const pictured = (await atNow(page)).text?.split(' of ')[1];
        // A picture that arrives late draws once, and then nothing moves: the same pixels half a second on (2.2.2).
        await twoFrames(page);
        const drawn = await pixels(page);
        await page.waitForTimeout(500);
        if ((await pixels(page)).hash !== drawn.hash) wrong.push('with the picture drawn and nothing playing, the canvas changed over half a second');
        // (b) the same project with a video of 1080 by 1920.
        if (!(await choose(page, await projectFile(png, true, false, { width: 1080, height: 1920 }))) || !(await saysOpened(page)) || !(await quiet(page))) wrong.push('the project with an upright video did not open');
        if (!(await drawnAs(9 / 16, 0.75, 0.4))) wrong.push('with the picture and a 1080 by 1920 video, no 9 to 16 frame with the blue at (0.75, 0.4) came');
        const upright = await frameAs('1080 by 1920', 9 / 16, [[0.75, 0.4], [0.75, 0.6]], [[0.75, 0.2], [0.75, 0.8]]);
        // (c) the golden again.
        if (!(await choose(page, await projectFile(png, true))) || !(await saysOpened(page)) || !(await quiet(page))) wrong.push('the project with the picture did not open again');
        if (!(await drawnAs(16 / 9, 0.75, 0.2778))) wrong.push('the golden opened again did not bring back a 16 to 9 frame with the blue at (0.75, 0.2778)');
        const again = await frameAs('1920 by 1080 again', 16 / 9, [[0.75, 0.2778], [0.75, 0.7222]], [[0.75, 0.02], [0.75, 0.98]]);
        // (d) the length's two readings.
        if (pictured !== '0:04') wrong.push(`with the picture the length reads "${pictured}", not the picture's measure, "0:04"`);
        if (square !== '0:06') wrong.push(`with no picture the length reads "${square}", not the square's "0:06"`);
        record('2.2.2', !wrong.length, wrong.length ? wrong.join('; ') : `the box takes the video's shape, not the picture's: ${wide} (16 to 9) with a 1920 by 1080 video, the 2:1 picture's #3366cc at (0.75, 0.2778) and (0.75, 0.7222) and the white margin in the bands at (0.75, 0.02) and (0.75, 0.98); ${upright} (9 to 16) with 1080 by 1920, blue at (0.75, 0.4) and (0.75, 0.6), the white margin at (0.75, 0.2) and (0.75, 0.8); ${again} again with the golden; the canvas its box times the ratio each time; the length "${pictured}" (0.25 widths, 4.75 s), not the square's "${square}" (6 s); still half a second on with nothing playing`);
      },
    },
    {
      // The preview (brief 84, e): the frames the composer draws, counted through the page (one clearRect a frame):
      // over a still second after an open, none; over sixty frames of a playing, some, and never more than one in a
      // frame (2.2.2: nothing moves unless played).
      name: 'the-preview-is-still',
      method: 'j-timing',
      rows: ['2.2.2'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const wrong = [];
        await countFrames(page);
        if (!(await choose(page, await projectFile())) || !(await saysOpened(page)) || !(await quiet(page))) wrong.push('the project did not open');
        await twoFrames(page);
        await page.evaluate(() => { window.__frames = 0; });
        await page.waitForTimeout(1000);
        const still = await page.evaluate(() => window.__frames);
        if (still) wrong.push(`over a still second the composer drew ${still} frames`);
        const counted = page.evaluate(() => new Promise((resolve) => {
          const each = []; let last = window.__frames;
          const tick = () => { each.push(window.__frames - last); last = window.__frames; if (each.length < 60) requestAnimationFrame(tick); else resolve(each); };
          requestAnimationFrame(tick);
        }));
        await page.locator(PLAY).click();
        const each = await counted;
        const most = Math.max(...each), total = each.reduce((a, b) => a + b, 0);
        if (most > 1) wrong.push(`playing, the composer drew ${most} frames in one`);
        if (total < 30) wrong.push(`playing, the composer drew ${total} frames in 60`);
        record('2.2.2', !wrong.length, wrong.length ? wrong.join('; ') : `no frame over a still second; playing, ${total} frames in 60, never more than one in one`);
      },
    },
    {
      // 4.1.3 (stage 6): Play and Pause pressed on a scene, by the pointer, as the play bar's claim says (PlayBar.tsx;
      // the words are the editor's transport's, transport.ts). Play: "Playing animation", the one button now named
      // "Pause", the position rising. Pause: "Animation paused", named "Play" again, the position then standing (thirty
      // frames, one value, neither the start nor the end). Play again goes on from there. Left to run out: "Animation
      // complete", once, named "Play", at the end; the status region said those four and nothing else. Play pressed at
      // the end plays from the start (the player's `play`, DEF-62) and says "Playing animation". The same element
      // throughout.
      name: 'play-and-pause',
      method: 'j-forms',
      rows: ['4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const wrong = [];
        if (!(await choose(page, await projectFile())) || !(await saysOpened(page))) wrong.push('the journeys\' project was not opened');
        await quiet(page);
        const heard = await hear(page);
        const button = await page.locator(PLAY).elementHandle();
        const values = (s) => s.map(([, v]) => v);
        // How far a playing can have gone (Codex on brief 81, twice): bounded by what the playing did, never by the click,
        // since a page slow after the press holds time in which nothing plays (the player's first frame moves one frame's
        // worth however long it waited). A recorder starts a frame before the press and runs through it (`pressed`); of
        // the frames after the press, the first that has moved off `from` (for a restart, off 1000 and 0) is at most
        // from + 10, and each later one at most that value + ceil((t − t0) / 6) + 10, t0 the time of the frame before
        // that first move was seen: the timeline shows a frame's move at the next frame, and the first frame after a
        // long task can carry an early time (seen: blocked 300 ms, +3 then +16 in 17 ms). The journeys' scene is 6 s for
        // 1000 thousandths, one for each 6 ms of the frames' own clock, and 10 (60 ms) for a slow frame and rounding. A
        // resume from 30 that lands on 700, a restart that begins at 300 ms (50), fail. Beside those, from the first move
        // on, no sample is more than 20 past the one before it (Codex on brief 82): the player moves at most
        // `MAX_GAP_MS`, 100 ms, a frame (src/player/transport/transport.ts), which is 17 thousandths of the 6 s scene,
        // and 3 for rounding and a draw a frame late; one long interval no longer pays for a jump, so Codex's own
        // example, 30, 30, 33 at 300 ms, then 83 at 317 ms, is refused by these words (83 is 50 past 33).
        await page.locator(PLAY).evaluate((b) => b.addEventListener('click', () => { window.__pressedAt = performance.now(); }));
        // Presses Play with the recorder running; gives back [the frame's time, aria-valuenow] for `n` frames after it.
        const pressed = async (n) => {
          await page.evaluate(([sel, count]) => {
            window.__pressedAt = undefined;
            window.__rec = new Promise((resolve) => {
              const s = [], el = document.querySelector(sel);
              const tick = (t) => { s.push([t, Number(el.getAttribute('aria-valuenow'))]); if (s.filter(([u]) => u > (window.__pressedAt ?? Infinity)).length < count) requestAnimationFrame(tick); else resolve(s); };
              requestAnimationFrame(tick);
            });
            return new Promise((r) => requestAnimationFrame(() => r()));
          }, [TIMELINE, n]);
          await page.locator(PLAY).click();
          return page.evaluate(async () => { const s = await window.__rec; return s.slice(Math.max(0, s.findIndex(([t]) => t > window.__pressedAt) - 1)); });
        };
        // `s` from the last frame before the press: the frames after it, and the one before for t0.
        const past = (s, from, skip = () => false) => {
          const i = s.findIndex(([, v], k) => k > 0 && v !== from && !skip(v));
          if (i < 0) return [`it never moved off ${from}`];
          const [t1] = s[i - 1], [, v1] = s[i];
          // From the first move on every sample is kept (`skip` names only the leading ones, before it): a later 1000,
          // or any fall, on the restart or the resume is a playing gone back, and fails (Codex on brief 83).
          const moved = s.slice(i);
          const steps = moved.slice(1).flatMap(([t, v], k) => (v > moved[k][1] + 20 ? [`${v} straight after ${moved[k][1]}, a step of more than 20, at ${Math.round(t - t1)} ms after ${v1}`] : v < moved[k][1] ? [`${v} straight after ${moved[k][1]}, a fall, at ${Math.round(t - t1)} ms after ${v1}`] : []));
          return [...(v1 > from + 10 ? [`its first move was to ${v1}`] : []), ...s.slice(i + 1).filter(([t, v]) => v > v1 + Math.ceil((t - t1) / 6) + 10).map(([t, v]) => `${v} at ${Math.round(t - t1)} ms after ${v1}`), ...steps];
        };
        await page.locator(PLAY).click();
        if (!(await comesToWords(page, PLAYING))) wrong.push(`Play: "${PLAYING}" was not said`);
        if (!(await isNamed(page, 'Pause', button))) wrong.push('Play: the same button is not now named "Pause"');
        const rising = await sample(page, 10);
        if (!(rising.at(-1)[1] > rising[0][1]) || backwards(rising).length) wrong.push(`Play: the position went ${values(rising).join(', ')}`);
        await page.locator(PLAY).click();
        if (!(await comesToWords(page, PAUSED))) wrong.push(`Pause: "${PAUSED}" was not said`);
        if (!(await isNamed(page, 'Play', button))) wrong.push('Pause: the same button is not named "Play" again');
        const still = values(await sample(page, 30));
        const stood = still[0];
        if (new Set(still).size !== 1 || stood <= 0 || stood >= 1000) wrong.push(`Pause: over thirty frames the position was ${[...new Set(still)].join(', ')}`);
        const resumedAt = await pressed(10);
        const resumed = values(resumedAt.slice(1));
        if (resumed.some((v) => v < stood) || !(resumed.at(-1) > stood)) wrong.push(`Play again: from ${stood} the position went ${resumed.join(', ')}`);
        const jumped = past(resumedAt, stood);
        if (jumped.length) wrong.push(`Play again: from ${stood}, further than the playing allows: ${jumped.join(', ')}`);
        if (!(await isNamed(page, 'Pause', button))) wrong.push('Play again: the same button is not named "Pause"');
        const done = await page.waitForFunction(([st, w]) => document.querySelector(st)?.textContent === w, [STATUS, COMPLETE], { timeout: 12000 }).then(() => true, () => false);
        if (!done) wrong.push(`left to run: "${COMPLETE}" was not said`);
        if (!(await isNamed(page, 'Play', button))) wrong.push('at the end: the same button is not named "Play"');
        if ((await atNow(page)).now !== 1000) wrong.push(`at the end: the position is ${(await atNow(page)).now}`);
        await quiet(page);
        const once = await neverSays(page, COMPLETE, 2500);
        const texts = await heard();
        const expected = [PLAYING, PAUSED, PLAYING, COMPLETE];
        if (!once || JSON.stringify(texts) !== JSON.stringify(expected)) wrong.push(`the status region said ${JSON.stringify(await heard())}, not ${JSON.stringify(expected)}`);
        const againAt = await pressed(10);
        // The frame before the press, and any frame still showing the end (the move is shown a frame late), left out.
        const again = values(againAt.slice(1)).filter((v, k, a) => !(v === 1000 && a.slice(0, k + 1).every((u) => u === 1000)));
        if (!(await comesToWords(page, PLAYING))) wrong.push(`Play at the end: "${PLAYING}" was not said`);
        if (!(again.at(-1) < 500) || !(again.at(-1) > again[0]) || again[0] > 100) wrong.push(`Play at the end: the position went ${again.join(', ')}, not from the start`);
        const partWay = past(againAt, 0, (v) => v === 1000);
        if (partWay.length) wrong.push(`Play at the end: further from the start than the playing allows: ${partWay.join(', ')}`);
        if (!(await isNamed(page, 'Pause', button))) wrong.push('Play at the end: the same button is not named "Pause"');
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `by the pointer on the one button: Play, "${PLAYING}", named "Pause", rising; Pause, "${PAUSED}", named "Play", standing at ${stood} over thirty frames; Play again from ${stood}, no further than the playing allows and no step of more than 20 a sample; left to run, "${COMPLETE}" once at 1000; said ${JSON.stringify(expected)} and nothing else; Play at the end played from the start, no further than the playing allows and no step of more than 20 a sample`);
      },
    },
    {
      // 4.1.3 (stage 6, brief 81's step 4): while an open is under way Open draws one line, "Opening <name>…", in
      // Carbon's live region made polite (Open.tsx, point 4), gone by the time "Project opened" is said (the two
      // may come in one batch, so not "before"). A MutationObserver set on the page before the choice records
      // every text holding "Opening", with its nearest aria-live, and whether it was still there at a callback
      // where the status region said "Project opened"; no timed wait in the page and no slowed read (io's read is
      // async, so the line is drawn before it ends, the golden as it is). Carbon's nested assertive region (its
      // spinner's "loading", A11Y-03) is recorded, not failed. The line is one and can be seen (Codex on brief
      // 81, asked for by brief 83): at each of the observer's callbacks it also records how many lines there
      // were, and for each whether it has a box (getClientRects) and is not hidden (checkVisibility, with
      // visibility and opacity); a hidden line, or a callback that finds more than one, fails; between two
      // callbacks nothing is seen. Paint is not claimed: a quick open may end inside one frame.
      name: 'the-opening-line',
      method: 'j-forms',
      rows: ['4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        await page.evaluate((st) => {
          window.__opening = [];
          new MutationObserver(() => {
            const lines = [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && /Opening/.test(e.textContent ?? ''));
            const said = document.querySelector(st)?.textContent ?? '';
            for (const e of lines) window.__opening.push({ text: e.textContent, live: e.closest('[aria-live]')?.getAttribute('aria-live') ?? null, inner: [...(e.closest('[aria-live]')?.querySelectorAll('[aria-live]') ?? [])].map((n) => n.getAttribute('aria-live')), said, count: lines.length, shown: e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) });
          }).observe(document.body, { childList: true, subtree: true, characterData: true });
        }, STATUS);
        const file = await projectFile();
        const wrong = [];
        if (!(await choose(page, file)) || !(await saysOpened(page))) wrong.push(`"${OPENED}" was not said`);
        const seen = await page.evaluate(() => window.__opening);
        const words = `Opening ${file.name}\u2026`;
        const line = seen.filter((s) => s.text === words);
        if (!line.length) wrong.push(`"${words}" was never seen; seen ${JSON.stringify(seen.map((s) => s.text))}`);
        if (line.some((s) => s.live !== 'polite')) wrong.push(`the line's region was ${JSON.stringify([...new Set(line.map((s) => s.live))])}, not polite`);
        if (seen.some((s) => s.said === OPENED)) wrong.push(`the line was still there when "${OPENED}" was said`);
        if (line.some((s) => !s.shown)) wrong.push('the line was there but had no box or was hidden');
        const most = Math.max(0, ...seen.map((s) => s.count));
        if (most > 1) wrong.push(`${most} lines holding "Opening" at one of the observer's callbacks`);
        if (await page.locator('main').getByText('Opening', { exact: false }).count()) wrong.push('the line is still there after the open');
        const inner = [...new Set(line.flatMap((s) => s.inner))];
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `"${words}" seen, one line with a box and not hidden, in a polite region while the open was under way (Carbon's nested regions: ${JSON.stringify(inner)}, recorded), gone by the time "${OPENED}" was said`);
      },
    },
    {
      // 4.1.3 and DEF-67 (stage 6): a project opened while another plays: the status region never says "Animation
      // paused", says "Project opened", and the position waits at the opened project's end (1000: D251, brief 127) with
      // nothing playing.
      name: 'open-over-a-playing',
      method: 'j-forms',
      rows: ['4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        await choose(page, await projectFile());
        await saysOpened(page);
        await page.locator(PLAY).click();
        const playing = await comesTo(page, 'n >= 50');
        const heard = await hear(page);
        const wrong = [];
        if (!playing) wrong.push('the first project did not play');
        await choose(page, await projectFile());
        if (!(await neverSays(page, PAUSED))) wrong.push(`the status region said "${PAUSED}"`);
        if (!(await saysOpened(page))) wrong.push(`the status region never said "${OPENED}"`);
        const texts = await heard();
        if (texts.includes(PAUSED)) wrong.push(`"${PAUSED}" was among what the region said: ${JSON.stringify(texts)}`);
        const still = await sample(page, 20);
        if (still.some(([, v]) => v !== 1000)) wrong.push(`the position went ${still.map(([, v]) => v).join(', ')}, not held at 1000 (the end)`);
        if ((await playLabel(page)) !== 'Play') wrong.push(`the play button reads "${await playLabel(page)}", not "Play"`);
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `opened over a playing: "${OPENED}" said, "${PAUSED}" never (the region said ${JSON.stringify(texts)}), the position at 1000 (the end) for 20 frames, Play offered`);
      },
    },
    {
      // 4.1.3 (stage 6): a file that is no project is refused by one alert (role alert, said by itself), titled with the
      // file's name and holding io's sentence whole, the status region saying nothing; focus stays on "Open project"
      // and the play bar is as it was. After Close the same file chosen again is a new choice, refused again.
      // 3.3.1 (STACK-08, brief 161): the error is identified and described in text: the alert's title names the item
      // (the file, "Could not open notes.txt") and its first sentence says what is wrong with it. 3.3.3: the
      // suggestion, "Choose a project saved by Route Plotter v4 (a .zip file).", is checked on its own, so a refusal
      // that lost it fails 3.3.3 and not 3.3.1 (4.1.3 holds the sentence whole, so fails too). Every other refusal to
      // open has its suggestion held by the unit test (src/adapters/io/words.test.ts), not by a journey.
      name: 'refused-not-a-project',
      method: 'j-forms',
      rows: ['4.1.3', '3.3.1', '3.3.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const heard = await hear(page);
        const bar = async () => JSON.stringify([await playLabel(page), await page.locator(PLAY).isDisabled(), (await atNow(page)).now, await page.getByText(NOTHING_TO_PLAY).count()]);
        const before = await bar();
        const wrong = [];
        await choose(page, TEXT_FILE);
        await alerts(page).first().waitFor({ timeout: 5000 }).catch(() => undefined);
        const count = await alerts(page).count();
        const words = ((await alerts(page).first().textContent({ timeout: 2000 }).catch(() => '')) ?? '').replace(/\s+/g, ' ');
        const title = ((await alerts(page).first().locator('.cds--inline-notification__title').textContent({ timeout: 2000 }).catch(() => '')) ?? '').trim();
        if (count !== 1) wrong.push(`${count} alert(s), not one`);
        if (title !== `Could not open ${TEXT_FILE.name}`) wrong.push(`the alert's title is ${JSON.stringify(title)}, not "Could not open ${TEXT_FILE.name}"`);
        if (!words.includes(NOT_A_PROJECT)) wrong.push(`the alert does not hold io's sentence whole: ${JSON.stringify(words)}`);
        const identified = [
          title !== `Could not open ${TEXT_FILE.name}` && `the alert's title is ${JSON.stringify(title)}: it does not name the file`,
          !words.includes(NOT_A_PROJECT_CAUSE) && `the alert does not say what is wrong in text ("${NOT_A_PROJECT_CAUSE}"): ${JSON.stringify(words)}`,
        ].filter(Boolean);
        record('3.3.1', !identified.length, identified.length ? identified.join('; ') : `the error identified and described in text: the alert's title names the item, "Could not open ${TEXT_FILE.name}", and it says "${NOT_A_PROJECT_CAUSE}"`);
        const suggested = words.includes(NOT_A_PROJECT_CHOICE);
        record('3.3.3', suggested, suggested ? `the alert suggests the correction: "${NOT_A_PROJECT_CHOICE}"` : `the alert suggests no correction ("${NOT_A_PROJECT_CHOICE}" not in ${JSON.stringify(words)})`);
        if (await neverSays(page, OPENED, 2500) === false || (await heard()).length) wrong.push(`the status region said ${JSON.stringify(await heard())}`);
        if (!(await focusOn(page, OPEN))) wrong.push('focus left "Open project"');
        if ((await bar()) !== before) wrong.push(`the play bar was ${before} and is ${await bar()}`);
        await page.getByRole('button', { name: 'Close' }).click();
        const gone = !(await alerts(page).count());
        if (!gone) wrong.push('Close left the alert');
        await choose(page, TEXT_FILE);
        const again = await alerts(page).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
        if (!again) wrong.push('the same file chosen again showed no alert');
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `one alert, "Could not open ${TEXT_FILE.name}" and io's sentence whole; the status region silent; focus kept; the play bar as it was; Close removed it, and the same file chosen again was refused again`);
      },
    },
    {
      // 1.3.5 and 3.3.2 (STACK-08, brief 161): every field on the page, hidden ones included (FIELDS, not only those
      // shown), read in the shell, with Help open, and with the "Replace your route?" dialog open over a drawn route.
      // The page has three: the file input under "Open project" (hidden: out of the layout, the tab order and the
      // accessibility tree; the button, named by its visible word, opens its chooser, kit/FileButton.tsx), the switch
      // "Single-key shortcuts" in Help, and the slider "Timeline"; the dialog holds none. 1.3.5: no field carries an
      // `autocomplete` purpose and none takes typed text, so none collects the user's own details (a field that does
      // must carry its purpose). 3.3.2: each has a visible label or instructions: the file input the visible "Open
      // project" beside it, the switch its visible label as its name, the slider its visible label "Timeline" tied to
      // it; the canvas, an application, sits in the region under the visible heading "Preview" (its keys in Help's
      // tables). A further field fails both until its check is written here.
      name: 'inputs-purpose-and-labels',
      method: 'j-forms',
      rows: ['1.3.5', '3.3.2'],
      run: async ({ page, open, record }) => {
        const read = () => page.locator(FIELDS).evaluateAll((all) => all.map((e) => {
          const by = e.getAttribute('aria-labelledby'), label = by ? document.getElementById(by) : null;
          const before = e.previousElementSibling;
          return {
            what: e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}[type=${e.getAttribute('type') ?? ''}]`,
            tag: e.tagName.toLowerCase(), type: e.getAttribute('type') ?? '', role: e.getAttribute('role') ?? '',
            autocomplete: e.getAttribute('autocomplete'), hidden: e.hidden, tabIndex: e.tabIndex,
            typed: e.isContentEditable || e.tagName === 'TEXTAREA' || ['textbox', 'searchbox', 'combobox'].includes(e.getAttribute('role') ?? '')
              || (e.tagName === 'INPUT' && !['file', 'checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'image', 'color'].includes(e.getAttribute('type') ?? 'text')),
            opener: before && before.id === 'open-project' && before.getBoundingClientRect().height > 0 ? (before.textContent ?? '').trim() : '',
            labelledBy: label && label.getBoundingClientRect().height > 0 ? (label.textContent ?? '').trim() : '',
          };
        }));
        const seen = [];
        await open('shell');
        seen.push(['the shell', await read()]);
        await helpButton(page).click();
        await helpDialog(page).waitFor();
        seen.push(['Help open', await read()]);
        const switchName = await named(page.getByRole('switch', { name: 'Single-key shortcuts', exact: true }));
        const switchShown = await helpDialog(page).getByText('Single-key shortcuts', { exact: true }).filter({ visible: true }).count();
        await open('pen-drawn');
        const question = page.getByRole('dialog', { name: 'Replace your route?' });
        const asked = (await choose(page, await projectFile())) && await question.waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false);
        const inQuestion = asked ? await question.locator(FIELDS).count() : -1;
        if (asked) seen.push(['"Replace your route?" open', await read()]);
        if (asked) await page.keyboard.press('Escape');
        await open('shell');
        const heading = await page.getByRole('region', { name: 'Preview' }).getByRole('heading', { name: 'Preview', level: 2 }).filter({ visible: true }).count();
        const app = await page.getByRole('region', { name: 'Preview' }).getByRole('application').count();
        const known = {
          'input[type=file]': (f) => f.hidden && f.tabIndex === -1 && f.opener === 'Open project',
          '#single-keys': (f) => f.role === 'switch' && switchName.startsWith('switch "Single-key shortcuts"') && switchShown === 1,
          '#timeline': (f) => f.role === 'slider' && f.labelledBy === 'Timeline',
        };
        const purpose = [], labels = [], found = new Set();
        if (!asked) purpose.push('no "Replace your route?" dialog showed over the drawn route'), labels.push('no "Replace your route?" dialog showed over the drawn route');
        if (inQuestion > 0) labels.push(`the "Replace your route?" dialog holds ${inQuestion} field(s): write their check here`);
        for (const [where, fields] of seen) {
          for (const f of fields) {
            found.add(f.what);
            if (f.autocomplete !== null) purpose.push(`${where}: ${f.what} carries autocomplete="${f.autocomplete}"`);
            if (f.typed) purpose.push(`${where}: ${f.what} takes typed text: check whether it collects the user's own details and carries their purpose`);
            if (!known[f.what]) labels.push(`${where}: ${f.what} (${f.tag} ${f.type} ${f.role}) is a field this journey does not know: write its label's check`);
            else if (!known[f.what](f)) labels.push(`${where}: ${f.what} has no visible label or instructions as written here (${JSON.stringify(f)}${f.what === '#single-keys' ? `, named ${switchName}, its words shown ${switchShown} time(s)` : ''})`);
          }
        }
        for (const what of Object.keys(known)) if (!found.has(what)) labels.push(`${what} was not found: the page changed; read it again`);
        if (heading !== 1 || app !== 1) labels.push(`the region "Preview" holds ${heading} visible heading(s) "Preview" and ${app} application(s), not one of each`);
        const list = [...found].join(', ');
        record('1.3.5', !purpose.length, purpose.length ? purpose.join('; ') : `every field, hidden ones included, in the shell, with Help open and with "Replace your route?" open (${list}): none carries an autocomplete purpose and none takes typed text, so none collects the user's own details`);
        record('3.3.2', !labels.length, labels.length ? labels.join('; ') : `each input has a visible label or instructions: the hidden file input, out of the tab order, opened by the visible button "Open project" beside it; the switch named by its visible label "Single-key shortcuts" in Help; the slider "Timeline" by its visible label tied to it; "Replace your route?" holds no field; the canvas application sits in the region under the visible heading "Preview"`);
      },
    },
    {
      // 3.3.6 (STACK-08, brief 161): a canvas edit is reversible. In pen-drawn, as edit-keys begins (Tab to the preview
      // box, End, Escape), Cmd/Ctrl+A then Delete takes both points away (neither marker drawn, nor the line between
      // them); one Undo draws the whole canvas as before the Delete (pixels' hash) and both markers again. Tap, move,
      // duplicate and the point menu's "Delete" are undone the same way (one Undo, the keyboard and pointer journeys);
      // Open over changes is confirmed (open-over-changes).
      name: 'a-delete-is-undone',
      method: 'j-forms',
      rows: ['3.3.6'],
      run: async ({ page, open, record }) => {
        await open('pen-drawn');
        const [first, second] = TAPS;
        const press = async (key) => { await page.keyboard.press(key); await page.waitForTimeout(250); await twoFrames(page); };
        const marks = async () => ({ first: await markBeyond(page, first, second), second: await markBeyond(page, second, first) });
        const wrong = [];
        let tabs = 0;
        while (!(await focusOn(page, PREVIEW)) && tabs < 8) { await page.keyboard.press('Tab'); tabs += 1; }
        if (!(await focusOn(page, PREVIEW))) wrong.push('eight presses of Tab did not reach the preview box');
        await press('End');
        await press('Escape');
        await press(`${COMMAND}+a`);
        const before = (await pixels(page)).hash;
        const drawn = await marks();
        if (!drawn.first || !drawn.second) wrong.push(`before the Delete the markers read ${JSON.stringify(drawn)}, not both drawn`);
        await press('Delete');
        const gone = { ...(await marks()), line: orange(await strokeAt(page, 0.5, 0.5), 40) };
        if (gone.first || gone.second || gone.line) wrong.push(`after Delete the drawing read ${JSON.stringify(gone)}: the points were not taken away`);
        await press(UNDO);
        const back = await marks();
        if ((await pixels(page)).hash !== before || !back.first || !back.second) wrong.push(`after one Undo the canvas was ${(await pixels(page)).hash === before ? '' : 'not '}as before the Delete and the markers read ${JSON.stringify(back)}`);
        record('3.3.6', !wrong.length, wrong.length ? wrong.join('; ') : 'in pen-drawn, Cmd/Ctrl+A then Delete took both points away (neither marker nor the line drawn); one Undo drew the whole canvas as before the Delete, both markers again');
      },
    },
    {
      // 2.4.3 (stage 6): Close on a refusal's alert removes it and puts focus on "Open project", not on the page's
      // body, and Tab from there goes on to "Help" as the reviewed order has it.
      name: 'refused-close-returns-focus',
      method: 'j-order',
      rows: ['2.4.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        await choose(page, TEXT_FILE);
        await alerts(page).first().waitFor({ timeout: 5000 }).catch(() => undefined);
        const wrong = [];
        if (!(await alerts(page).count())) wrong.push('no alert showed');
        await page.getByRole('button', { name: 'Close' }).click();
        if (await alerts(page).count()) wrong.push('Close left the alert');
        if (!(await focusOn(page, OPEN))) wrong.push(`focus went to ${await page.evaluate(() => document.activeElement?.tagName ?? 'nothing')}, not "Open project"`);
        await page.keyboard.press('Tab');
        if (!(await focusOn(page, HELP))) wrong.push('Tab from "Open project" did not go on to "Help"');
        record('2.4.3', !wrong.length, wrong.length ? wrong.join('; ') : 'Close removed the alert and put focus on "Open project"; Tab went on to "Help"');
      },
    },
    {
      // 2.5.2 (stage 6, the echo, HANDOVER-65's test): Carbon's slider reports every change of its thumb, the echo of a
      // new position included; an echo of an older one would read as a nudge and scrub back. During a playing with no
      // input for 60 frames the position never goes backwards and gains what the frame clock gained (a scrub would lose
      // time); then a press held still on the track at 50 % moves the position there on the down-event, as a
      // provisional scrub, and nothing pulls it back after: it never goes backwards and the playing goes on from there.
      name: 'the-echo',
      method: 'j-pointer',
      rows: ['2.5.2'],
      run: async ({ page, open, record, pointer }) => {
        await open('shell');
        await choose(page, await projectFile());
        await saysOpened(page);
        await page.locator(PLAY).click();
        const free = await sample(page, 60);
        const moving = free.filter(([, v]) => v > 0);
        const wrong = [];
        if (moving.length < 30) wrong.push(`the playing moved in only ${moving.length} of 60 frames`);
        const [[t0, v0], [t1, v1]] = [moving[0] ?? [0, 0], moving.at(-1) ?? [0, 0]];
        const gained = ((v1 - v0) * LENGTH_MS) / 1000, clock = t1 - t0;
        if (backwards(free).length) wrong.push(`with no input the position went back: ${backwards(free).join(', ')}`);
        if (Math.abs(gained - clock) > 50) wrong.push(`with no input the position gained ${gained} ms over ${Math.round(clock)} ms of frames`);
        const at = await onTrack(page, 0.5);
        await pointer.down(at.x, at.y);
        const held = await sample(page, 45);
        await pointer.up();
        const first = held[0][1], end = held.at(-1)[1];
        if (Math.abs(first - 500) > 10) wrong.push(`the press at 50 % put the position at ${first}`);
        if (backwards(held).length) wrong.push(`with the press held still the position went back: ${backwards(held).join(', ')}`);
        if (!(end > first)) wrong.push(`with the press held still the playing did not go on (${first} to ${end})`);
        record('2.5.2', !wrong.length, wrong.length ? wrong.join('; ') : `no input: never back, ${gained} ms gained over ${Math.round(clock)} ms of frames; a press held still at 50 %: at ${first}, never pulled back, playing on to ${end}`);
      },
    },
    {
      // 2.5.2 (stage 6, brief 66's owed test, recorded under the-echo's row by orchestrator 27; brief 86): on a long scene
      // one thousandth of the timeline is more than a second, so its words (aria-valuetext, "m:ss of m:ss", the claim in
      // timelineLogic.ts) must move on while aria-valuenow does not; and as the value steps, Carbon draws one frame with
      // its old thumb, whose words must still be the time now (the kit's readout, controls.ts point 6), never a second
      // back. The golden made twenty minutes long (1.2 s a thousandth), opened, played by the pointer for about five
      // seconds, each frame's value and words recorded, then paused: the seconds in the words went forward at least twice
      // while the value stood (against the frame before, the value the same in that frame and the next), and, over every
      // pair of frames, the time in them never went backwards.
      name: 'the-long-scene-words',
      method: 'j-pointer',
      rows: ['2.5.2'],
      run: async ({ page, open, record, pointer }) => {
        await open('shell');
        const wrong = [];
        if (!(await choose(page, await projectFile(undefined, false, true))) || !(await saysOpened(page))) wrong.push('the long scene was not opened');
        const box = await page.locator(PLAY).boundingBox();
        await pointer.tap(box.x + box.width / 2, box.y + box.height / 2);
        const frames = await page.evaluate((sel) => new Promise((resolve) => {
          const s = [], el = document.querySelector(sel), end = performance.now() + 5000;
          const tick = (t) => { s.push([Number(el.getAttribute('aria-valuenow')), el.getAttribute('aria-valuetext') ?? '']); if (t < end) requestAnimationFrame(tick); else resolve(s); };
          requestAnimationFrame(tick);
        }), TIMELINE);
        await pointer.tap(box.x + box.width / 2, box.y + box.height / 2);
        const seconds = (w) => { const m = /^(\d+):(\d\d) of /.exec(w); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
        const bad = frames.filter(([, w]) => Number.isNaN(seconds(w)));
        if (bad.length) wrong.push(`words not "m:ss of m:ss": ${JSON.stringify(bad[0][1])}`);
        // An advance counts only where the value stands in the frame before it, at it and in the frame after: at a step
        // of the value, aria-valuenow may follow the words a frame late, which is not the words moving within one.
        const stood = frames.slice(1, -1).filter(([v, w], k) => v === frames[k][0] && v === frames[k + 2][0] && seconds(w) > seconds(frames[k][1])).map(([v, w]) => `${w} at ${v}`);
        if (stood.length < 2) wrong.push(`the seconds in the words went forward at an unchanged value ${stood.length} time(s) in ${frames.length} frames (${[...new Set(frames.map(([v, w]) => `${v} ${w}`))].join(', ')})`);
        const back = frames.slice(1).map((f, k) => [frames[k], f]).filter(([a, b]) => seconds(b[1]) < seconds(a[1])).map(([a, b]) => `${a[1]} then ${b[1]} at ${b[0]}`);
        if (back.length) wrong.push(`the time in the words went backwards: ${back.join(', ')}`);
        record('2.5.2', !wrong.length, wrong.length ? wrong.join('; ') : `a twenty-minute scene played by the pointer for 5 s (${frames.length} frames, values ${frames[0][0]} to ${frames.at(-1)[0]}): the seconds in the words went forward at an unchanged value ${stood.length} times (${stood.join(', ')}), the time in them never backwards`);
      },
    },
    {
      // 2.1.1 (brief 79, FINDING-78): Carbon's slider echoes a new position two passes after it is handed, and on a slow
      // page that is after the value held has moved on; the kit's slider once took that late echo for a key's nudge.
      // React's scheduler is slowed here (each MessageChannel delivery, its tasks, held 60 ms: a slow machine), set before
      // the page loads. End then Home with no gap: the position comes to 0, the thumb at the start, "Skipped to start"
      // said last. Then the journeys' project, a press on the track's middle and J on "Open project": the position goes
      // down to 0, never up, and "Animation complete" is said. Through both, the timeline stays and no page error is
      // heard. Before the fix both crashed the page with React's error 185 (5 of 5 each, sub-chat 79).
      name: 'the-late-echo',
      method: 'keyboard',
      rows: ['2.1.1'],
      run: async ({ page, open, record }) => {
        await page.addInitScript(() => {
          const Real = window.MessageChannel;
          window.MessageChannel = function () {
            const ch = new Real();
            const send = ch.port2.postMessage.bind(ch.port2);
            ch.port2.postMessage = (m) => setTimeout(() => send(m), 60);
            return ch;
          };
        });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
        const wrong = [];
        const there = async () => (await page.locator(TIMELINE).count()) === 1;
        await open('shell');
        const heard = await hear(page);
        await page.keyboard.press('End');
        await page.keyboard.press('Home');
        await page.waitForTimeout(1500);
        if (!(await there())) wrong.push('End then Home: the timeline is gone');
        else {
          const { now } = await atNow(page);
          if (now !== 0) wrong.push(`End then Home: the position is ${now}`);
          if (!(await thumbAt(page, 0))) wrong.push('End then Home: the thumb is not drawn at the start');
          // "Skipped to start" waits behind "Skipped to end" (about 2 s): wait for it, then it must be the last said.
          await comesToWords(page, SKIPPED_TO_START);
          const words = await heard();
          if (words.at(-1) !== SKIPPED_TO_START) wrong.push(`End then Home: said last "${words.at(-1)}"`);
          if ((await atNow(page)).now !== 0) wrong.push('End then Home: the position left 0 later');
        }
        await open('shell');
        await choose(page, await projectFile());
        if (!(await saysOpened(page))) wrong.push('the journeys\' project was not opened');
        const middle = await onTrack(page, 0.5);
        await page.mouse.click(middle.x, middle.y);
        if (!(await comesTo(page, 'Math.abs(n - 500) <= 10'))) wrong.push('the press on the track did not put the position at its middle');
        await page.locator(OPEN).focus();
        // The thumb's element before J: a late echo on this slow page must not draw Carbon's slider anew (brief 80).
        const thumbBefore = await page.locator(TIMELINE).elementHandle();
        await page.keyboard.press('j');
        // Each frame's position until "Animation complete" is said (or 10 s): null once the timeline is gone.
        const run = await page.evaluate(([t, s, w]) => new Promise((resolve) => {
          const seen = [], until = performance.now() + 10000;
          const tick = () => {
            const v = document.querySelector(t)?.getAttribute('aria-valuenow');
            seen.push(v == null ? null : Number(v));
            const done = document.querySelector(s)?.textContent === w;
            if (done || v == null || performance.now() > until) resolve({ seen, done }); else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }), [TIMELINE, STATUS, COMPLETE]);
        const ups = run.seen.slice(1).flatMap((v, i) => (v !== null && run.seen[i] !== null && v > run.seen[i] ? [`${run.seen[i]} to ${v}`] : []));
        if (run.seen.includes(null) || !(await there())) wrong.push('J after a press: the timeline is gone');
        if (ups.length) wrong.push(`J after a press: the position went up: ${ups.slice(0, 5).join(', ')}`);
        if (!run.done) wrong.push('J after a press: "Animation complete" was not said');
        if (!(await thumbBefore.evaluate((el, t) => el.isConnected && document.querySelector(t) === el, TIMELINE))) wrong.push('J after a press: the thumb was drawn anew during the playing');
        if ((await there()) && (await atNow(page)).now !== 0) wrong.push(`J after a press: ended at ${(await atNow(page)).now}`);
        if (errors.length) wrong.push(`page error: ${errors[0]}`);
        record('2.1.1', !wrong.length, wrong.length ? wrong.join('; ') : `with React's scheduler slowed 60 ms a task: End then Home at no gap stands at 0, "Skipped to start" said last; J after a press at 50 % plays down to 0 over ${run.seen.length} frames, never up, "Animation complete" said; the thumb's element the same throughout, the timeline stays, no page error`);
      },
    },
    {
      // 2.5.2 (brief 88, finding 86): a quick drag on a slow page. React's scheduler slowed as in the-late-echo, the
      // twenty-minute scene opened and still, the pointer down on the timeline's thumb, moved in five quick steps of a
      // twentieth of the track each, then rests a moment where it is and is let go: the timeline stays, no page error is
      // heard, and the position held is where the thumb was let go (a quarter of the track on from where it was pressed,
      // within a hundredth of the range), and still there a second later. An open leaves the thumb at the end (D251,
      // brief 127), so the steps go left, towards the start; before, from 0, they went right. Before the mend the kit took Carbon's
      // late follow of a position it had handed before for a move of the drag; the two answered each other until React
      // gave up (error 185) and the timeline was gone (claim point 3, the trail).
      name: 'the-quick-drag',
      method: 'j-pointer',
      rows: ['2.5.2'],
      run: async ({ page, open, record }) => {
        await page.addInitScript(() => {
          const Real = window.MessageChannel;
          window.MessageChannel = function () {
            const ch = new Real();
            const send = ch.port2.postMessage.bind(ch.port2);
            ch.port2.postMessage = (m) => setTimeout(() => send(m), 60);
            return ch;
          };
        });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
        const wrong = [];
        await open('shell');
        if (!(await choose(page, await projectFile(undefined, false, true))) || !(await saysOpened(page))) wrong.push('the long scene was not opened');
        const thumb = await page.locator(TIMELINE).boundingBox();
        const track = await page.locator(TRACK).boundingBox();
        const max = Number(await page.locator(TIMELINE).getAttribute('aria-valuemax'));
        const from = { x: thumb.x + thumb.width / 2, y: thumb.y + thumb.height / 2 };
        const to = from.x - track.width / 4;
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        for (let s = 1; s <= 5; s++) await page.mouse.move(from.x - (s * track.width) / 20, from.y, { steps: 2 });
        // Then the pointer rests before it is let go, as a hand does (brief 95, FINDING-94-quick-drag-ci). Carbon's slider
        // takes at most one move of a drag in each 16 ms, the first and not the last (node_modules/@carbon/react/lib/
        // components/Slider/Slider.js, line 70, EVENT_THROTTLE = 16, and lines 325 to 333, throttle leading only), and
        // at the release it takes no place from the pointer (lines 278 to 287). So on a slow page the tenth quick move,
        // within 16 ms of the ninth, was dropped, and the thumb rested where the ninth put it (225, not 250): CI's pull
        // request runner, and this Mac with the page's CPU slowed fourfold (PROBE-95). The rest is timed on the page's
        // own clock, after the quick moves are handled, so a busy page cannot run it short; then one more move to the
        // same place, which Carbon takes, and the release.
        await page.evaluate(() => new Promise((rest) => setTimeout(rest, 50)));
        await page.mouse.move(to, from.y);
        await page.mouse.up();
        await page.waitForTimeout(1500);
        const expected = Math.round(((to - track.x) / track.width) * max);
        let held = null;
        if ((await page.locator(TIMELINE).count()) !== 1) wrong.push('the timeline is gone');
        else {
          held = (await atNow(page)).now;
          if (Math.abs(held - expected) > max / 100) wrong.push(`let go at ${expected} of ${max}, the position held is ${held}`);
          await page.waitForTimeout(1000);
          const later = (await page.locator(TIMELINE).count()) === 1 ? (await atNow(page)).now : null;
          if (later !== held) wrong.push(`a second later the position is ${later}, not ${held}`);
        }
        if (errors.length) wrong.push(`page error: ${errors[0]}`);
        record('2.5.2', !wrong.length, wrong.length ? wrong.join('; ') : `with React's scheduler slowed 60 ms a task, the twenty-minute scene still: the thumb pressed at the end and moved left in five quick steps, let go at ${expected} of ${max}: the position held is ${held}, a second later too; the timeline stays, no page error`);
      },
    },
    {
      // 2.5.2 (CORE-06, brief 116, ruling Y (1)): a point dragged to a new place, then undone. In pen-drawn's set-up (two
      // taps, the second point selected), the route skipped to its end, the second point's marker is read where only it
      // draws (markBeyond: on the ray from it away from the first point) at its tap and at DRAG_TO, a place inside the
      // picture well clear of the line. The pointer then presses on the second point, moves to DRAG_TO in four steps and
      // is let go. Skipped to the end again (the route's length changed), the marker is read at DRAG_TO and not at the
      // tap; then one Undo (focus off the Skip button) and the marker is back at the tap and not at DRAG_TO. It reads the
      // second point's marker only: no other mark is claimed. It fails with the drag's commit dropped (brief 116, (f)).
      name: 'point-drag-moves',
      method: 'j-pointer',
      rows: ['2.5.2'],
      run: async ({ page, open, record, pointer }) => {
        await open('pen-drawn');
        const [first, second] = TAPS;
        const atEnd = async () => { await page.getByRole('button', { name: 'Skip to end' }).click(); await page.waitForTimeout(250); await twoFrames(page); };
        const read = async () => ({ tap: await markBeyond(page, second, first), moved: await markBeyond(page, DRAG_TO, first) });
        const wrong = [];
        await atEnd();
        const before = await read();
        if (!before.tap || before.moved) wrong.push(`before the drag the marker read ${before.tap ? '' : 'not '}at the tap and ${before.moved ? '' : 'not '}at the new place`);
        const box = await page.locator(PREVIEW).boundingBox();
        const from = { x: box.x + box.width * second[0], y: box.y + box.height * second[1] };
        await dragBy(pointer, from, { x: box.x + box.width * DRAG_TO[0], y: box.y + box.height * DRAG_TO[1] });
        await pointer.up();
        await atEnd();
        const after = await read();
        if (!after.moved || after.tap) wrong.push(`after the drag the marker read ${after.moved ? '' : 'not '}at the new place and ${after.tap ? '' : 'not '}at the tap`);
        await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
        await page.keyboard.press(UNDO);
        await atEnd();
        const undone = await read();
        if (!undone.tap || undone.moved) wrong.push(`after one Undo the marker read ${undone.tap ? '' : 'not '}at the tap and ${undone.moved ? '' : 'not '}at the new place`);
        record('2.5.2', !wrong.length, wrong.length ? wrong.join('; ') : 'in pen-drawn, the second point pressed and dragged to a new place in the picture: after the release its marker is drawn there and not at its tap; one Undo draws it at its tap again and not at the new place');
      },
    },
    {
      // 2.5.2 (CORE-06, brief 116, ruling Y (2)): Escape aborts a point's drag before the release. In pen-drawn's set-up,
      // skipped to the route's end, the whole canvas is read (pixels' hash). The pointer presses on the second point and
      // moves to DRAG_TO in four steps: read while held, the canvas has changed and the marker is drawn at DRAG_TO (the
      // drag is live). Escape: the canvas is as before the press. The pointer then moves on and is let go: the canvas is
      // still as before the press, so the later release places nothing. It fails with cancelDrag doing nothing (brief
      // 116, (g)). Brief 134 (ruling CV; D268, a cancelled drag says nothing): in the three seconds after the release the
      // status region never says "Point moved" (Skip to end's words may still show).
      name: 'point-drag-escape',
      method: 'j-pointer',
      rows: ['2.5.2'],
      run: async ({ page, open, record, pointer }) => {
        await open('pen-drawn');
        const [first, second] = TAPS;
        const now = async () => { await page.waitForTimeout(250); await twoFrames(page); return (await pixels(page)).hash; };
        const wrong = [];
        await page.getByRole('button', { name: 'Skip to end' }).click();
        const before = await now();
        const box = await page.locator(PREVIEW).boundingBox();
        const from = { x: box.x + box.width * second[0], y: box.y + box.height * second[1] };
        const to = { x: box.x + box.width * DRAG_TO[0], y: box.y + box.height * DRAG_TO[1] };
        await dragBy(pointer, from, to);
        const held = await now();
        const live = held !== before && (await markBeyond(page, DRAG_TO, first));
        if (!live) wrong.push('the press and moves on the second point did not draw it at the new place while held');
        await page.keyboard.press('Escape');
        if ((await now()) !== before) wrong.push('Escape mid-drag did not draw the canvas as before the press');
        await pointer.move(to.x + 20, to.y + 20);
        await pointer.up();
        if ((await now()) !== before) wrong.push('the release after Escape changed what is drawn');
        if (!(await neverSays(page, POINT_MOVED))) wrong.push(`the drag cancelled by Escape said "${POINT_MOVED}"`);
        record('2.5.2', !wrong.length, wrong.length ? wrong.join('; ') : `in pen-drawn, the second point pressed and dragged to a new place, drawn there while held; Escape before the release drew the whole canvas as before the press, and the release after it changed nothing drawn; in the 3 s after the release the status region never said "${POINT_MOVED}"`);
      },
    },
    {
      // 2.5.2 (CORE-06, brief 122, ruling AJ): a group's drag, reached on the page by Cmd+click (Ctrl+click elsewhere,
      // ruling AH's toggle), is done on the up, aborted by Escape before it, and undone in one step. In pen-drawn's set-up,
      // skipped to the route's end, Escape clears the selection (a plain tap on a point with the pen on another would
      // join them, so the points are picked with the command key only). The mouse is off the preview at every reading
      // where it can be (a resting mouse draws the hover, HANDOVER-121).
      // (1) The selection's ring, read where only it draws: round each tap, the pixels drawn (alpha over 60) and not the
      // route's hue (orange, as markBeyond tells it) 5 to 9 units from the tap. Probed (brief 122, PROBE-122/probe-ring):
      // at 1280 by 800 the canvas is 704 px at 704 CSS px; a selected point's ring gives 140 such pixels there, an
      // unselected point none (the lead's arrow at the second point draws within 2 px of it, inside the ring). Ringed is
      // over 50; not ringed is under 10. After Escape neither is ringed; a command-click on the first rings it alone; one
      // on the second rings both. (1b) A second command-click on the first takes it out (the second alone ringed) and a
      // third puts it back (both ringed): the toggle's "taken out" branch, brief 122's (w).
      // (2) The abort: the whole canvas read (pixels' hash) as the baseline; a press on the second point moved in four
      // steps to DRAG_TO and, while held, Escape: the canvas reads as the baseline, both markers at their taps; the mouse
      // then leaves the preview and is let go: still the baseline.
      // (3) The drag: a press on the second point moved in four steps to DRAG_TO and let go; skipped to the end again,
      // both markers read at their new places (markBeyond, as point-drag-moves reads one): the second at DRAG_TO, the
      // first moved by the same offset; neither at its tap.
      // (4) One Undo (focus off the Skip button): the whole canvas reads as the hash before (3), the baseline.
      // The 2.5.2 credit rests on (2) to (4) alone. Faults that fail it (brief 122): (u) the toggle's call removed from
      // bindCanvas fails (1); (v) groupOf giving the grabbed point alone fails (3); (w) the "taken out" branch made "add
      // again" fails (1b). Nothing is claimed for 2.5.7 here: a group's drag has its single-pointer way in the point's menu
      // "Move" then one click (D250, D270), checked by point-move (brief 139). Nothing for 2.5.8,
      // 1.4.11 (the rings stay under the preview's set-aside) or 1.4.13.
      name: 'group-drag',
      method: 'j-pointer',
      rows: ['2.5.2'],
      run: async ({ page, open, record, pointer }) => {
        await open('pen-drawn');
        const [first, second] = TAPS;
        const shift = [DRAG_TO[0] - second[0], DRAG_TO[1] - second[1]];
        const firstTo = [first[0] + shift[0], first[1] + shift[1]];
        const settle = async () => { await page.waitForTimeout(250); await twoFrames(page); };
        const atEnd = async () => { await page.getByRole('button', { name: 'Skip to end' }).click(); await settle(); };
        const hash = async () => (await pixels(page)).hash;
        const box = await page.locator(PREVIEW).boundingBox();
        const on = ([fx, fy]) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
        const off = async () => { await page.mouse.move(1, 1); await settle(); };
        const commandClick = async (place) => {
          const { x, y } = on(place);
          await page.keyboard.down(COMMAND);
          await page.mouse.click(x, y);
          await page.keyboard.up(COMMAND);
          await off();
        };
        const rings = () => ringsAt(page, [first, second]);
        const ringed = async (want, when) => {
          const counts = await rings();
          const read = counts.map((n) => (n > 50 ? true : n < 10 ? false : null));
          if (read.some((each, i) => each !== want[i])) wrong.push(`${when} the rings read ${JSON.stringify(counts)} pixels at the first and second taps, where the first should read ${want[0] ? 'ringed' : 'not ringed'} and the second ${want[1] ? 'ringed' : 'not ringed'}`);
        };
        const marks = async (at) => ({ first: await markBeyond(page, at[0], at[1]), second: await markBeyond(page, at[1], at[0]) });
        const wrong = [];
        await atEnd();
        await page.keyboard.press('Escape');
        await settle();
        // (1) and (1b): no credit; the page's way to a multi-selection.
        await ringed([false, false], 'after Escape');
        await commandClick(first);
        await ringed([true, false], 'after a command-click on the first point');
        await commandClick(second);
        await ringed([true, true], 'after a command-click on the second point');
        await commandClick(first);
        await ringed([false, true], 'after a second command-click on the first point');
        await commandClick(first);
        await ringed([true, true], 'after a third command-click on the first point');
        // (2) The abort.
        const baseline = await hash();
        await dragBy(pointer, on(second), on(DRAG_TO));
        await page.keyboard.press('Escape');
        await settle();
        const aborted = { hash: await hash(), ...(await marks([first, second])) };
        if (aborted.hash !== baseline || !aborted.first || !aborted.second) wrong.push(`Escape mid-drag left the canvas ${aborted.hash === baseline ? 'as' : 'not as'} before the press, the first marker ${aborted.first ? '' : 'not '}at its tap and the second ${aborted.second ? '' : 'not '}at its tap`);
        await page.mouse.move(1, 1);
        await pointer.up();
        await settle();
        if ((await hash()) !== baseline) wrong.push('the release after Escape changed what is drawn');
        // (3) The drag.
        const beforeDrag = await hash();
        await dragBy(pointer, on(second), on(DRAG_TO));
        await pointer.up();
        await atEnd();
        const moved = await marks([firstTo, DRAG_TO]);
        const left = await marks([first, second]);
        if (!moved.first || !moved.second || left.first || left.second) wrong.push(`after the drag the first marker read ${moved.first ? '' : 'not '}at its new place and ${left.first ? '' : 'not '}at its tap, the second ${moved.second ? '' : 'not '}at DRAG_TO and ${left.second ? '' : 'not '}at its tap`);
        // (4) One Undo.
        await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
        await page.keyboard.press(UNDO);
        await atEnd();
        if ((await hash()) !== beforeDrag) wrong.push('after one Undo the canvas was not as before the drag');
        record('2.5.2', !wrong.length, wrong.length ? wrong.join('; ') : 'in pen-drawn, both points picked by command-clicks (each ringed, one taken out and put back): a press on the second moved past the threshold and aborted by Escape left the whole canvas as before the press, and the release after changed nothing; pressed, dragged and released, both markers are drawn at their new places and neither at its tap; one Undo draws the whole canvas as before the drag');
      },
    },
    {
      // 2.1.1 (CORE-06, brief 123 ruling AR, built by brief 124): the three Editing keys (Delete, Cmd+D and Cmd+A; Ctrl
      // elsewhere) do their edits from the keyboard alone. In pen-drawn (two points joined by a line; the mouse rests at
      // the banner's corner, off the preview, since the setup's last press), Tab reaches the preview box (at most eight
      // presses), End skips the route to its end there and Escape clears the selection: no ring at either tap. Every key
      // after that is pressed with focus on the box, and it is still there at the end.
      // (1) Cmd+A: both taps ringed (ringsAt, group-drag's reading: over 50 ringed, under 10 not; probed, PROBE-124: 147
      // and 146 after, 0 before).
      // (2) Cmd+D: each copy stands 2% of the picture right and down of its point (no picture: the scene is a square
      // fitted to the box's height, so 2% of it across is 0.02 times height over width of the box, squareX's ratio, and
      // 2% down is 0.02 of the box). The copies are not reached by the lead's walk (D238: no lead's start is copied), so
      // the animation draws no marker or line for them, at the end or anywhere (probed: after Escape the canvas is as
      // before Cmd+D; FINDING-124). What does draw is their ring, as the copies are the selection: each copy's place
      // reads ringed (probed 145 and 144; 39 and 40 there before, from the originals' rings 11 px away), the originals'
      // places fall under 50 (probed 38: only the copies' rings reach their band) and both original markers are still
      // drawn (markBeyond, each on its far side from the other).
      // (3) Undo: the whole canvas (pixels' hash) as before (2).
      // (4) Cmd+A, then Delete: no marker at either tap (markBeyond) and no line at their middle (strokeAt, as
      // marksDrawn reads it).
      // (5) Undo: the whole canvas as before (4).
      // Faults that fail it (brief 124, PROBE-124/mut): (x) Delete's call removed from editKey fails (4); (y) Duplicate's
      // call removed fails (2); (z) Select all picking the first point only fails (1) and (4). It claims nothing for
      // drawing points (still a pointer's: the pen's tap), nothing for 2.5.7, and nothing spoken (D263).
      name: 'edit-keys',
      method: 'keyboard',
      rows: ['2.1.1'],
      run: async ({ page, open, record }) => {
        await open('pen-drawn');
        const [first, second] = TAPS;
        const settle = async () => { await page.waitForTimeout(250); await twoFrames(page); };
        const hash = async () => (await pixels(page)).hash;
        const press = async (key) => { await page.keyboard.press(key); await settle(); };
        const box = await boxOf(page);
        const across = (0.02 * box.height) / box.width;
        const copies = [first, second].map(([fx, fy]) => [fx + across, fy + 0.02]);
        const wrong = [];
        let tabs = 0;
        while (!(await focusOn(page, PREVIEW)) && tabs < 8) { await page.keyboard.press('Tab'); tabs += 1; }
        if (!(await focusOn(page, PREVIEW))) wrong.push('eight presses of Tab did not reach the preview box');
        await press('End');
        await press('Escape');
        const none = await ringsAt(page, TAPS);
        if (none.some((n) => n >= 10)) wrong.push(`after Escape the taps' rings read ${JSON.stringify(none)} pixels, not under 10`);
        // (1) Select all.
        await press(`${COMMAND}+a`);
        const all = await ringsAt(page, TAPS);
        if (all.some((n) => n <= 50)) wrong.push(`after Cmd+A the taps' rings read ${JSON.stringify(all)} pixels, not both over 50`);
        // (2) Duplicate.
        const beforeCopy = await hash();
        await press(`${COMMAND}+d`);
        const [atCopies, atOriginals] = [await ringsAt(page, copies), await ringsAt(page, TAPS)];
        const kept = { first: await markBeyond(page, first, second), second: await markBeyond(page, second, first) };
        if (atCopies.some((n) => n <= 50) || atOriginals.some((n) => n >= 50) || !kept.first || !kept.second) wrong.push(`after Cmd+D the rings read ${JSON.stringify(atCopies)} pixels 2% right and down of the taps (both should be over 50) and ${JSON.stringify(atOriginals)} at the taps (both under 50), and the markers ${kept.first ? '' : 'not '}at the first tap and ${kept.second ? '' : 'not '}at the second`);
        // (3) Undo.
        await press(UNDO);
        if ((await hash()) !== beforeCopy) wrong.push('after one Undo the canvas was not as before Cmd+D');
        // (4) Select all, then Delete.
        await press(`${COMMAND}+a`);
        const beforeDelete = await hash();
        await press('Delete');
        const gone = { first: await markBeyond(page, first, second), second: await markBeyond(page, second, first), line: orange(await strokeAt(page, 0.5, 0.5), 40) };
        if (gone.first || gone.second || gone.line) wrong.push(`after Cmd+A and Delete a marker read ${gone.first ? '' : 'not '}at the first tap and ${gone.second ? '' : 'not '}at the second, and the line ${gone.line ? '' : 'not '}at their middle`);
        // (5) Undo.
        await press(UNDO);
        if ((await hash()) !== beforeDelete) wrong.push('after one Undo the canvas was not as before Delete');
        if (!(await focusOn(page, PREVIEW))) wrong.push('focus was not on the preview box at the end');
        record('2.1.1', !wrong.length, wrong.length ? wrong.join('; ') : `in pen-drawn, with focus moved to the preview box by Tab (${tabs} presses), the route skipped to its end by End and the selection cleared by Escape, keys alone: Cmd+A rings both points; Cmd+D rings a copy 2% of the picture right and down of each (the copies the selection; the copies draw no marker of their own), the originals still drawn; one Undo draws the whole canvas as before it; Cmd+A then Delete leaves neither marker nor the line; one Undo draws the whole canvas as before it; focus stays on the box`);
      },
    },
    {
      // 2.1.1 (CORE-06, brief 126, rulings BB and BC; brief 125's BA): the arrow keys nudge the selected points, from
      // the keyboard alone. In pen-drawn, as edit-keys begins (Tab to the preview box, End, Escape), then Cmd/Ctrl+A,
      // with the rings both read by ringsAt (over 120 pixels each at the taps). The step is 0.5% of the picture over the
      // zoom (dom.ts NUDGE, NUDGE_FURTHER 2%), in image fractions; the zoom in pen-drawn was read by a probe, not assumed
      // (PROBE-126/mut/probe-1.txt: three presses moved the rings' peak 6 px on a 396 px picture, 3 × 0.005 × 396: zoom
      // 1), and image fractions across are converted by the ratio the copies' reading uses (edit-keys: height over width).
      // (1) ArrowRight three times at once: each tap's ring reads 1.5% of the picture right (over 120 pixels) and the old
      // place under half that. (2) One Undo (by keyboard: the dispatch closes the burst before Undo runs, so no wait):
      // the whole canvas (pixels' hash) reads as before (1): three presses, one step. (3) Shift+ArrowDown: each ring
      // reads 2% lower, the old place under half. (4) A wait past NUDGE_QUIET_MS (400 ms), ArrowLeft once, one Undo: the
      // canvas reads as after (3): a press after the quiet is a step of its own. (5) The page's listener (keydown.ts's
      // `onElse`, registered for pointerdown and focusout): first a reference, ArrowRight once, a wait past 400 ms, the
      // canvas read (one step from (3)), Undo. Then ArrowRight once; a pointer press on the page where nothing else
      // is (no control, off the preview: the first such place on a 40 by 20 px grid, the page's header; probed, a press
      // there moves focus to the body, so both of onElse's events fire, and it reaches neither the dispatch nor the
      // canvas's binding); ArrowRight once, all three inside 400 ms (timed: the run fails if not); one Undo: the canvas
      // reads as the reference (where the first press left the points: the press closed the burst, so the second press
      // was its own step), and a second Undo as after (3). The hash, not the rings, judges (5): a 2 px step is under the
      // rings' reach (probe-1: 147, 147 and 131 pixels at 0, 1 and 2 px from a ring). Faults that fail it (brief 126,
      // PROBE-126/mut): (x) Shift's size equal to the plain one fails (3); (y) every press its own step fails (2); (z)
      // the nudge's call removed fails (1); (w) onElse's endNudge removed fails (5). It claims nothing for 2.5.7 (D250:
      // the point's menu "Move", G), nothing for drawing points, nothing spoken (D263).
      name: 'nudge-keys',
      method: 'keyboard',
      rows: ['2.1.1'],
      run: async ({ page, open, record }) => {
        await open('pen-drawn');
        const settle = async () => { await page.waitForTimeout(250); await twoFrames(page); };
        const hash = async () => (await pixels(page)).hash;
        const press = async (key) => { await page.keyboard.press(key); await settle(); };
        const box = await boxOf(page);
        const across = box.height / box.width;
        const moved = (dx, dy) => TAPS.map(([fx, fy]) => [fx + dx * across, fy + dy]);
        const ringsMoved = async (to, what) => {
          const [there, before] = [await ringsAt(page, to), await ringsAt(page, TAPS)];
          return there.some((n) => n <= 120) || before.some((n, i) => n >= (there[i] ?? 0) / 2) ? [`${what}: the rings read ${JSON.stringify(there)} pixels at the new places (both should be over 120) and ${JSON.stringify(before)} at the taps (each under half)`] : [];
        };
        const wrong = [];
        let tabs = 0;
        while (!(await focusOn(page, PREVIEW)) && tabs < 8) { await page.keyboard.press('Tab'); tabs += 1; }
        if (!(await focusOn(page, PREVIEW))) wrong.push('eight presses of Tab did not reach the preview box');
        await press('End');
        await press('Escape');
        await press(`${COMMAND}+a`);
        const all = await ringsAt(page, TAPS);
        if (all.some((n) => n <= 120)) wrong.push(`after Cmd+A the taps' rings read ${JSON.stringify(all)} pixels, not both over 120`);
        const start = await hash();
        // (1) Three quick presses.
        for (let n = 0; n < 3; n += 1) await page.keyboard.press('ArrowRight');
        await settle();
        wrong.push(...(await ringsMoved(moved(0.015, 0), 'after ArrowRight three times')));
        // (2) One Undo.
        await press(UNDO);
        if ((await hash()) !== start) wrong.push('after one Undo the canvas was not as before the three presses');
        // (3) Shift+ArrowDown.
        await press('Shift+ArrowDown');
        wrong.push(...(await ringsMoved(moved(0, 0.02), 'after Shift+ArrowDown')));
        const lower = await hash();
        // (4) After the quiet, a press of its own.
        await page.waitForTimeout(450);
        await press('ArrowLeft');
        await press(UNDO);
        if ((await hash()) !== lower) wrong.push('after a wait past 400 ms, ArrowLeft and one Undo, the canvas was not as after Shift+ArrowDown');
        if (!(await focusOn(page, PREVIEW))) wrong.push('focus was not on the preview box after (4)');
        // (5) The page's listener: a reference step, then a press between two arrows.
        await press('ArrowRight');
        await page.waitForTimeout(450);
        const oneStep = await hash();
        await press(UNDO);
        if ((await hash()) !== lower) wrong.push('the reference ArrowRight was not undone by one Undo');
        const spot = await page.evaluate((sel) => {
          for (let y = 5; y < innerHeight; y += 20) for (let x = 5; x < innerWidth; x += 40) {
            const el = document.elementFromPoint(x, y);
            if (el && !el.closest(sel) && !el.closest('button,a,input,select,textarea,[tabindex],[role],summary,label,dialog,canvas,[contenteditable]')) return { x, y, tag: el.tagName.toLowerCase() };
          }
          return null;
        }, PREVIEW);
        if (spot === null) wrong.push('no place on the page off the preview and every control was found');
        else {
          const t0 = Date.now();
          await page.keyboard.press('ArrowRight');
          await page.mouse.click(spot.x, spot.y);
          await page.keyboard.press('ArrowRight');
          const took = Date.now() - t0;
          await settle();
          if (took >= 400) wrong.push(`ArrowRight, the press and ArrowRight took ${took} ms, not under 400`);
          await press(UNDO);
          if ((await hash()) !== oneStep) wrong.push(`after ArrowRight, a press on the page's ${spot.tag} at (${spot.x}, ${spot.y}), ArrowRight and one Undo, the canvas was not as after one ArrowRight`);
          await press(UNDO);
          if ((await hash()) !== lower) wrong.push('a second Undo did not draw the canvas as after Shift+ArrowDown');
        }
        record('2.1.1', !wrong.length, wrong.length ? wrong.join('; ') : `in pen-drawn, with focus moved to the preview box by Tab (${tabs} presses), End, Escape and Cmd+A, keys alone: ArrowRight three times moves both points' rings 1.5% of the picture right; one Undo draws the whole canvas as before them; Shift+ArrowDown moves the rings 2% lower; after a wait past 400 ms, ArrowLeft and one Undo draw the canvas as after Shift+ArrowDown; ArrowRight, a pointer press on the page's ${spot?.tag} at (${spot?.x}, ${spot?.y}) and ArrowRight, inside 400 ms, then one Undo draws the canvas as after one ArrowRight, and a second Undo as before it`);
      },
    },
    {
      // 2.1.1, 2.4.3 (CORE-06, brief 135; brief 130's CF; D267 (a), answered by the owner, 2026-11-27): the point's
      // menu. Its name and roles are
      // read too and fail 2.1.1 (the items the keys operate), but claim nothing for 4.1.2: the catalogue lists only axe,
      // lint and a snapshot for 4.1.2, and tools/a11y-run.mjs refuses a journey that claims it (brief 136). In pen-drawn,
      // as edit-keys begins (Tab to the preview box, End, Escape). The status region's every text is kept from here.
      // (1) A right-click on the first tap (the lead's start): a menu named "Point actions" shows, in document.body and
      // not inside .preview, its top left at the click (within 2 px), focus on its first item; its items read, in order,
      // "Mark as start", "Mark as end", "Set lead start" (aria-disabled, described by "This point is already where the
      // lead starts."), "Make bend", "Delete", a separator before Delete; the point is selected (its ring over 50).
      // (2) ArrowDown moves to the second item, ArrowUp twice wraps to the last, Home to the first, End to the last,
      // ArrowDown wraps to the first; Escape closes it, focus is back on the box and the point still ringed (an Escape
      // that reached the editor would have cleared it). (3) Shift+F10 on the box: the menu opens just right of the point
      // (its left 0 to 30 px right of the tap, its top within 2 px), focus on its first item; ArrowDown three times and
      // Enter on "Make bend": the menu closes, focus is on the box, and the point reads as a bend as the 2.5.2 journey
      // reads one: its grey dot (3 or more dark pixels within 2 px, where the stop read under 3) and the canvas changed.
      // The stop's orange marker beyond the point is not read: the line's round cap draws orange 1 to 3 px beyond it
      // too, as far as the stop's marker reached, so it does not tell a stop from a bend at 1280 wide (brief 136,
      // PROBE-136/probe-ray.jsonl). One Undo draws the whole canvas as before. (4)
      // Shift+F10, Enter on "Mark as start": the menu closes; opened again, its first item reads "Remove start mark" (no
      // drawing reads a route's marks yet, so nothing on the canvas is claimed for it); Escape, one Undo, opened again it
      // reads "Mark as start" again. (5) Shift+F10, ArrowDown twice to "Set lead start": focus is on it; Enter, Space and
      // a click on it leave the menu open, focus on it and the canvas as before; Escape. (6) After the status comes back
      // to empty, Shift+F10, End, Enter on "Delete": the point's marker and the line no longer read, the status comes to
      // "Point deleted"; one Undo draws the canvas as before. Each item's words (D269) and each "Undo" are waited for as
      // they come (comesToWords), never by a fixed wait. (7) A window 200 px high at the usual width (set before the
      // menu opens: a resize closes it), the page scrolled to put the first point mid-window, a right-click on it: End
      // reaches "Delete", whose box and the menu's lie inside the window, the item the element at its own centre; a wheel
      // scroll up over the menu scrolls its items and leaves it open; a scroll of the page outside it closes it (Codex
      // finding 1 on brief 136's range; red on a1e37df: Delete from 200 to 244 px, PROBE-137/red-run-a1e37df.txt); the
      // window is put back. Over the whole run the status said, in turn and each once, "Point made a bend", "Undo", "Start
      // marked", "Undo", "Point deleted", "Undo" (brief 137, D269 and Codex list line 17: every change of the status is
      // kept, not a set, so a repeat fails; read once the status has come back to empty, the queue drained); the
      // disabled item said nothing. Before brief 137 it read only "Undo" and
      // "Point deleted", as a set (the other items were silent then). Faults that fail it (brief 136, PROBE-136/mut-*.txt): (y) the
      // menu mounted inside .preview fails (1); (z) focus not returned on Escape fails (2); (aa) an item that is off
      // still run (and the menu closed) fails (5); (af) "Make bend" not dispatched fails (3); (brief 137,
      // PROBE-137/mut-*.txt) (ag) the menu's maximum height removed fails (7) at End (Delete from 200 to 244 px); (ah) the
      // scroll listener closing on a scroll inside the menu fails (7): End's own scroll into view closes it. (ai) "Make bend"'s
      // words left out of editWords fails (3) and the run's words; (aj) a second "Point deleted" announced 2.5 s after the
      // first fails the run's words (one announced in the same task is merged by the queue, announce.ts, so never shown). It claims nothing for 2.5.7
      // ("Move", which stands before Delete here, is checked by point-move, brief 139) nor for the marks' drawing.
      name: 'point-menu',
      method: 'keyboard',
      rows: ['2.1.1', '2.4.3'],
      run: async ({ page, open, record }) => {
        await open('pen-drawn');
        const [first, second] = TAPS;
        const settle = async () => { await page.waitForTimeout(250); await twoFrames(page); };
        const hash = async () => (await pixels(page)).hash;
        const press = async (key) => { await page.keyboard.press(key); await settle(); };
        const MENU = '[role=menu]';
        const shown = () => page.locator(MENU).count().then((n) => n === 1);
        const focusedItem = () => page.evaluate(() => { const e = document.activeElement; return e?.getAttribute('role') === 'menuitem' ? e.getAttribute('aria-label') : null; });
        // D274's marks (brief 142, GD): how many pixels round a point, beyond the guide dot's radius 3 and up to 8 canvas
        // pixels from its centre (a mark reaches 7 at the default zoom), read the route's hue (penMarksRead's test). A mark
        // adds such pixels where only it draws; the line through the point, the selection's ring and anything else drawn
        // there count the same marked or not.
        const markRead = ([fx, fy]) => page.locator(CANVAS).evaluate((c, [fx, fy]) => {
          const ctx = c.getContext('2d'); const [cx, cy] = [fx * c.width, fy * c.height]; const [x0, y0] = [Math.floor(cx) - 8, Math.floor(cy) - 8];
          const d = ctx.getImageData(x0, y0, 17, 17).data; let n = 0;
          for (let i = 0; i < d.length; i += 4) {
            const far = Math.hypot(x0 + ((i / 4) % 17) + 0.5 - cx, y0 + Math.floor(i / 68) + 0.5 - cy);
            const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
            if (far > 3 && far <= 8 && a > 60 && r > 120 && r > g && g >= b) n += 1;
          }
          return n;
        }, [fx, fy]);
        const dark = () => page.locator(CANVAS).evaluate((c, [fx, fy]) => {
          const ctx = c.getContext('2d'); const [cx, cy] = [Math.floor(fx * c.width), Math.floor(fy * c.height)];
          const reach = Math.max(2, Math.round(2 * (c.width / c.getBoundingClientRect().width))); let n = 0;
          for (let dy = -reach; dy <= reach; dy += 1) for (let dx = -reach; dx <= reach; dx += 1) { const [r, g, b, a] = ctx.getImageData(cx + dx, cy + dy, 1, 1).data; if (a > 100 && r < 140 && g < 140 && b < 140) n += 1; }
          return n;
        }, first);
        const keys = { wrong: [] }, names = { wrong: [] }, order = { wrong: [] };
        const heard = async (words, after) => { if (!(await comesToWords(page, words))) names.wrong.push(`after ${after} the status did not come to ${JSON.stringify(words)}`); };
        let tabs = 0;
        while (!(await focusOn(page, PREVIEW)) && tabs < 8) { await page.keyboard.press('Tab'); tabs += 1; }
        if (!(await focusOn(page, PREVIEW))) keys.wrong.push('eight presses of Tab did not reach the preview box');
        await press('End');
        await press('Escape');
        await page.locator(STATUS).evaluate((s) => { window.__said = []; new MutationObserver(() => { window.__said.push(s.textContent ?? ''); }).observe(s, { childList: true, characterData: true, subtree: true }); });
        const box = await page.locator(CANVAS).boundingBox();
        const tap = { x: box.x + box.width * first[0], y: box.y + box.height * first[1] };
        // (1) A right-click on the first point.
        await page.mouse.click(tap.x, tap.y, { button: 'right' });
        await settle();
        const menu = (await shown()) ? await page.locator(MENU).evaluate((m) => {
          const r = m.getBoundingClientRect();
          const items = [...m.querySelectorAll('[role=menuitem]')].map((e) => ({ name: e.getAttribute('aria-label'), off: e.getAttribute('aria-disabled') === 'true', reason: document.getElementById(e.getAttribute('aria-describedby') ?? '')?.textContent ?? null, wrapper: e.parentElement?.getAttribute('role') }));
          const apart = m.querySelector('[role=separator]')?.nextElementSibling?.querySelector('[role=menuitem]')?.getAttribute('aria-label') ?? null;
          return { name: m.getAttribute('aria-label'), inBody: m.parentElement === document.body, inPreview: m.closest('.preview') !== null, left: r.left, top: r.top, items, apart };
        }) : null;
        // Brief 138 (DA; D270): "Move" stands before Delete; the walk by the arrows, Home and End is unchanged by it.
        const ITEMS = ['Mark as start', 'Mark as end', 'Set lead start', 'Make bend', 'Move', 'Delete'];
        const LEAD = 'This point is already where the lead starts.';
        if (menu === null) names.wrong.push('a right-click on the first point showed no menu');
        else {
          if (menu.name !== 'Point actions') names.wrong.push(`the menu was named ${JSON.stringify(menu.name)}`);
          if (!menu.inBody || menu.inPreview) order.wrong.push(`the menu stood ${menu.inPreview ? 'inside .preview' : 'outside document.body'}`);
          if (Math.abs(menu.left - tap.x) > 2 || Math.abs(menu.top - tap.y) > 2) order.wrong.push(`the menu's top left was (${menu.left}, ${menu.top}), not at the click (${tap.x}, ${tap.y})`);
          const read = menu.items.map((i) => i.name);
          if (JSON.stringify(read) !== JSON.stringify(ITEMS)) names.wrong.push(`its items read ${JSON.stringify(read)}`);
          const offs = menu.items.filter((i) => i.off).map((i) => `${i.name}: ${i.reason}`);
          if (JSON.stringify(offs) !== JSON.stringify([`Set lead start: ${LEAD}`])) names.wrong.push(`its items that are off read ${JSON.stringify(offs)}`);
          if (menu.items.some((i) => i.wrapper !== 'none') || menu.apart !== 'Delete') names.wrong.push(`its wrappers or separator were not as built (${JSON.stringify(menu.items.map((i) => i.wrapper))}, apart ${menu.apart})`);
        }
        if ((await focusedItem()) !== 'Mark as start') order.wrong.push(`on opening, focus was on ${JSON.stringify(await focusedItem())}, not "Mark as start"`);
        if ((await ringsAt(page, [first]))[0] <= 50) names.wrong.push('the right-clicked point was not ringed');
        // (2) The arrows, Home, End, then Escape.
        const walk = [];
        for (const key of ['ArrowDown', 'ArrowUp', 'ArrowUp', 'Home', 'End', 'ArrowDown']) { await page.keyboard.press(key); walk.push(await focusedItem()); }
        const WALK = ['Mark as end', 'Mark as start', 'Delete', 'Mark as start', 'Delete', 'Mark as start'];
        if (JSON.stringify(walk) !== JSON.stringify(WALK)) keys.wrong.push(`ArrowDown, ArrowUp twice, Home, End and ArrowDown went to ${JSON.stringify(walk)}`);
        await press('Escape');
        if (await shown()) keys.wrong.push('Escape left the menu open');
        if (!(await focusOn(page, PREVIEW))) order.wrong.push('after Escape focus was not back on the preview box');
        if ((await ringsAt(page, [first]))[0] <= 50) keys.wrong.push('after Escape the point was no longer ringed');
        // (3) Shift+F10, then "Make bend".
        const before = await hash();
        const stopDark = await dark();
        await press('Shift+F10');
        const at = (await shown()) ? await page.locator(MENU).evaluate((m) => { const r = m.getBoundingClientRect(); return { left: r.left, top: r.top }; }) : null;
        if (at === null) keys.wrong.push('Shift+F10 on the box showed no menu');
        else if (at.left - tap.x < 0 || at.left - tap.x > 30 || Math.abs(at.top - tap.y) > 2) order.wrong.push(`by Shift+F10 the menu's top left was (${at.left}, ${at.top}), not just right of the point (${tap.x}, ${tap.y})`);
        if ((await focusedItem()) !== 'Mark as start') order.wrong.push('by Shift+F10 focus was not on its first item');
        for (let n = 0; n < 3; n += 1) await page.keyboard.press('ArrowDown');
        if ((await focusedItem()) !== 'Make bend') keys.wrong.push(`three ArrowDowns reached ${JSON.stringify(await focusedItem())}, not "Make bend"`);
        await press('Enter');
        await heard('Point made a bend', '"Make bend"');
        const bend = { open: await shown(), box: await focusOn(page, PREVIEW), dark: await dark(), hash: await hash() };
        if (bend.open || stopDark >= 3 || bend.dark < 3 || bend.hash === before) keys.wrong.push(`after "Make bend" the menu was ${bend.open ? '' : 'not '}open and ${bend.dark} pixel(s) within 2 px of the point read dark (a bend's grey dot reads at least 3; ${stopDark} read so as a stop, before)${bend.hash === before ? ', and the canvas was as before' : ''}`);
        if (!bend.box) order.wrong.push('after "Make bend" focus was not on the box');
        await press(UNDO);
        await heard('Undo', 'the Undo of "Make bend"');
        if ((await hash()) !== before) keys.wrong.push('after one Undo the canvas was not as before "Make bend"');
        // (4) "Mark as start", read by the menu's words.
        const firstItem = async () => { await press('Shift+F10'); const w = await focusedItem(); await press('Escape'); return w; };
        await press('Shift+F10');
        await press('Enter');
        await heard('Start marked', '"Mark as start"');
        // D274 part 1: the start's triangle drawn while paused round the point, beyond the guide dot, and gone after the Undo.
        const apex = await markRead(first);
        const marked = await firstItem();
        await press(UNDO);
        await heard('Undo', 'the Undo of "Mark as start"');
        const apexAfter = await markRead(first);
        if (apex - apexAfter < 3) keys.wrong.push(`after "Mark as start" ${apex} pixel(s) 3 to 8 canvas pixels round the point read the route's hue, and ${apexAfter} after the Undo (D274's triangle adds at least 3)`);
        const unmarked = await firstItem();
        if (marked !== 'Remove start mark' || unmarked !== 'Mark as start') keys.wrong.push(`after "Mark as start" the menu's first item read ${JSON.stringify(marked)}, and after one Undo ${JSON.stringify(unmarked)}`);
        // (5) The item that is off.
        const still = await hash();
        await press('Shift+F10');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        const off = [await focusedItem()];
        await press('Enter'); off.push((await shown()) && (await focusedItem()));
        await press('Space'); off.push((await shown()) && (await focusedItem()));
        { const b = await page.getByRole('menuitem', { name: 'Set lead start' }).boundingBox({ timeout: 2000 }).catch(() => null); if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); } await settle(); off.push((await shown()) && (await focusedItem()));
        if (off.some((w) => w !== 'Set lead start') || (await hash()) !== still) keys.wrong.push(`"Set lead start" on the lead's start: focus read ${JSON.stringify(off)} after reaching it, Enter, Space and a click (the menu open throughout), and the canvas ${(await hash()) === still ? 'as before' : 'changed'}`);
        await press('Escape');
        // (6) Delete from the menu.
        if (!(await page.waitForFunction((s) => (document.querySelector(s)?.textContent ?? '') === '', STATUS, { timeout: 12000 }).then(() => true, () => false))) keys.wrong.push('the status did not come back to empty before Delete');
        const kept = await hash();
        await press('Shift+F10');
        await page.keyboard.press('End');
        await press('Enter');
        const gone = { mark: await markBeyond(page, first, second), line: orange(await strokeAt(page, 0.5, 0.5), 40), said: await comesToWords(page, 'Point deleted') };
        if (gone.mark || gone.line || !gone.said) keys.wrong.push(`after "Delete" the marker read ${gone.mark ? '' : 'not '}beyond the point, the line ${gone.line ? '' : 'not '}at the middle, and "Point deleted" was ${gone.said ? '' : 'not '}said`);
        await press(UNDO);
        await heard('Undo', 'the Undo of "Delete"');
        if ((await hash()) !== kept) keys.wrong.push('after one Undo the canvas was not as before "Delete"');
        // (6b) "Mark as end" on the second point from its menu (a right-click), D274 part 1: the end's square drawn while
        // paused round the point, beyond the guide dot, and gone after the Undo.
        if (!(await page.waitForFunction((s) => (document.querySelector(s)?.textContent ?? '') === '', STATUS, { timeout: 12000 }).then(() => true, () => false))) keys.wrong.push('the status did not come back to empty before "Mark as end"');
        { const b = await page.locator(CANVAS).boundingBox(); await page.mouse.click(b.x + b.width * second[0], b.y + b.height * second[1], { button: 'right' }); }
        await settle();
        const endAsked = (await shown()) && (await focusedItem());
        if (endAsked === 'Mark as start') await page.keyboard.press('ArrowDown');
        const endItem = await focusedItem();
        await press('Enter');
        await heard('End marked', '"Mark as end"');
        const corner = await markRead(second);
        await press(UNDO);
        await heard('Undo', 'the Undo of "Mark as end"');
        const cornerAfter = await markRead(second);
        if (endItem !== 'Mark as end' || corner - cornerAfter < 3) keys.wrong.push(`"Mark as end" on the second point (focus read ${JSON.stringify(endItem)}): ${corner} pixel(s) 3 to 8 canvas pixels round the point read the route's hue, and ${cornerAfter} after the Undo (D274's square adds at least 3)`);
        // (7) A short window (Codex finding 1 on brief 136's range): 200 px high at the usual width, set before the menu
        // opens (a resize closes it), the page scrolled to put the first point mid-window, then a right-click on it.
        const view = page.viewportSize();
        await page.setViewportSize({ width: view.width, height: 200 });
        await settle();
        await page.locator(CANVAS).evaluate((c, [, fy]) => {
          for (let n = 0; n < 2; n += 1) {
            const r = c.getBoundingClientRect(); const dy = r.top + r.height * fy - window.innerHeight / 2;
            let e = c.parentElement;
            while (e && e !== document.body && !(e.scrollHeight > e.clientHeight && /(auto|scroll)/.test(getComputedStyle(e).overflowY))) e = e.parentElement;
            (e && e !== document.body ? e : document.scrollingElement).scrollBy(0, dy);
          }
        }, first);
        await settle();
        const low = await page.locator(CANVAS).boundingBox();
        await page.mouse.click(low.x + low.width * first[0], low.y + low.height * first[1], { button: 'right' });
        await settle();
        const short = { open: await shown() };
        if (short.open) {
          await press('End');
          short.end = await focusedItem();
          short.fit = await page.evaluate(() => {
            const m = document.querySelector('[role=menu]'); const e = document.activeElement; if (m === null || !m.contains(e)) return null;
            const r = e.getBoundingClientRect(); const b = m.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[role=menuitem]') === e;
            return { item: [r.top, r.bottom], menu: [b.top, b.bottom], height: window.innerHeight, inside: r.top >= 0 && r.bottom <= window.innerHeight && b.top >= 0 && b.bottom <= window.innerHeight, hit, scrolled: m.scrollTop };
          });
        }
        if (short.open && short.fit !== null) {
          const mid = await page.locator(MENU).boundingBox();
          await page.mouse.move(mid.x + mid.width / 2, mid.y + mid.height / 2);
          await page.mouse.wheel(0, -120);
          await settle();
          short.wheel = { open: await shown(), scrolled: (await shown()) ? await page.locator(MENU).evaluate((m) => m.scrollTop) : null };
          await page.locator(CANVAS).evaluate((c) => {
            let e = c.parentElement;
            while (e && e !== document.body && !(e.scrollHeight > e.clientHeight && /(auto|scroll)/.test(getComputedStyle(e).overflowY))) e = e.parentElement;
            (e && e !== document.body ? e : document.scrollingElement).scrollBy(0, -10);
          });
          await settle();
          short.outside = await shown();
        }
        if (!short.open) keys.wrong.push('in a window 200 px high a right-click on the point showed no menu');
        else if (short.fit === null) keys.wrong.push(`in a window 200 px high End closed the menu (focus on ${JSON.stringify(short.end)})`);
        else {
          const f = short.fit;
          if (short.end !== 'Delete' || !f.inside || !f.hit) keys.wrong.push(`in a window ${f.height} px high, End reached ${JSON.stringify(short.end)}, its box from ${f.item[0]} to ${f.item[1]} px and the menu's from ${f.menu[0]} to ${f.menu[1]} px${f.hit ? '' : ', the item not the element at its own centre'}`);
          if (!short.wheel.open || !(short.wheel.scrolled < f.scrolled)) keys.wrong.push(`in the short window a wheel scroll up over the menu left it ${short.wheel.open ? `open, its scroll ${f.scrolled} then ${short.wheel.scrolled}` : 'closed'}`);
          else if (short.outside) keys.wrong.push('in the short window a scroll of the page outside the menu left it open');
        }
        await page.setViewportSize(view);
        await settle();
        if (!(await focusOn(page, PREVIEW))) order.wrong.push('focus was not on the preview box at the end');
        if (!(await page.waitForFunction((st) => (document.querySelector(st)?.textContent ?? '') === '', STATUS, { timeout: 12000 }).then(() => true, () => false))) names.wrong.push('the status did not come back to empty at the end');
        const said = (await page.evaluate(() => window.__said)).filter(Boolean);
        const SAID = ['Point made a bend', 'Undo', 'Start marked', 'Undo', 'Point deleted', 'Undo', 'End marked', 'Undo'];
        if (JSON.stringify(said) !== JSON.stringify(SAID)) names.wrong.push(`the status said ${JSON.stringify(said)} in turn; ${JSON.stringify(SAID)} were expected, each once (D269; the disabled item says nothing)`);
        const how = `in pen-drawn, focus moved to the preview box by Tab (${tabs} presses), End, Escape`;
        const wrong = [...names.wrong, ...keys.wrong];
        record('2.1.1', !wrong.length, wrong.length ? wrong.join('; ') : `${how}: a right-click on the point shows a menu named "Point actions" with menuitems ${JSON.stringify(ITEMS)} (wrappers of role none, a separator before Delete), "Set lead start" aria-disabled and described by "${LEAD}"; the point is selected; over the run the status said, in turn and each once, ${JSON.stringify(said)} (D269's words after "Make bend" and "Mark as start", "Point deleted" once after "Delete", nothing for the disabled item); Shift+F10 opens it; ArrowDown, ArrowUp, Home and End move and wrap; Escape closes it with the point still selected; "Make bend" by Enter draws the point's grey dot (${bend.dark} dark pixels within 2 px, ${stopDark} as a stop) and changes the canvas, and one Undo draws the canvas as before; "Mark as start" makes the menu read "Remove start mark", undone by one Undo; "Set lead start" on the lead's start stays open on Enter, Space and a click and changes nothing; "Delete" removes the point and its line, says "Point deleted", and one Undo draws the canvas as before; in a window 200 px high End reaches "Delete" inside the window (its box from ${short.fit?.item.join(' to ')} px), a wheel over the menu scrolls it and leaves it open, and a scroll of the page outside closes it`);
        record('2.4.3', !order.wrong.length, order.wrong.length ? order.wrong.join('; ') : `${how}: the menu stands in document.body, outside .preview, at the click (or just right of the point by Shift+F10), focus on its first item on opening; after Escape, an item chosen, and at the end focus is on the preview box`);
      },
    },
    {
      // 2.5.7 and 2.5.1 (CORE-06, brief 139 for brief 138's DE; D242, D250 (a), D270, provisional until the owner
      // objects): the preview's two dragging movements, a point's and a group's, each have a single-pointer way, the
      // point's menu "Move" then one click, by the pointer alone (no key between the right-click and the place, except
      // where Escape is the step). In pen-drawn's set-up (two taps, the second point selected), skipped to the route's
      // end; the mouse is off the preview at every whole-canvas reading (a resting mouse draws the hover).
      // (1) One point: a right-click on the second point, "Move" clicked in its menu: the status comes to D270's prompt
      // and the canvas's cursor reads "crosshair" (it read otherwise before); a click on empty picture at DRAG_TO; skipped
      // to the end again, its marker reads at DRAG_TO and not at its tap (markBeyond, as point-drag-moves reads), the
      // cursor no longer "crosshair", and in the status's every change since the click "Point moved" once and "Point
      // added" never (the click placed no point); one Undo (focus off the Skip button) draws it at its tap again.
      // (2) Escape: the whole canvas read (pixels' hash), "Move" chosen again, the mouse off, Escape: the status comes to
      // "Move cancelled", the canvas reads as before, the cursor not "crosshair"; a click on empty picture then adds a
      // point as the pen always does ("Point added"), undone at once. (2b) A right-click on empty picture while it waits:
      // "Move cancelled" said, no menu opened, the canvas as before. (2c) Focus leaving the preview: "Move" chosen, then
      // a click on the "Skip to end" button: "Move cancelled" among the status's changes, the cursor not "crosshair",
      // the canvas as before. After each of the three cancels, the history is read as unchanged (gpt-6-astra, Codex list
      // line 20: the canvas alone cannot see an empty step): before (2), one Undo and one Redo, the canvas read after
      // each; after each cancel the same Undo and Redo must read the same two canvases, so one Undo takes back the step
      // before "Move" (a step the cancel left would be undone first, and the Undo would draw the canvas unchanged).
      // (3) The group: Escape clears the selection, a command-click on each point selects both (as group-drag does,
      // before the right-click); a right-click on the second, "Move" clicked: the group's prompt; a click at DRAG_TO:
      // both markers read at their places moved by the same offset (the second at DRAG_TO), neither at its tap, and "2
      // points moved" among the status's changes.
      // 2.5.7 rests on (1) to (3); the timeline's drag is checked by pointer-cancellation (a press on the track); no
      // keyboard way is credited. 2.5.1: the page's path gestures are its three drags and each has a single-pointer
      // way: the preview's two shown here, the timeline's by pointer-cancellation. Faults that fail it (brief 139,
      // PROBE-139/mut-*.txt): (ak) the pen's tap not held off while it waits; (al) Escape not cancelling the wait; (am)
      // only the menu's point moved in the group case.
      name: 'point-move',
      method: 'j-pointer',
      rows: ['2.5.1', '2.5.7'],
      run: async ({ page, open, record, pointer }) => {
        await open('pen-drawn');
        const [first, second] = TAPS;
        const shift = [DRAG_TO[0] - second[0], DRAG_TO[1] - second[1]];
        const firstTo = [first[0] + shift[0], first[1] + shift[1]];
        const EMPTY = [0.3, 0.7];
        const MOVE_ONE = 'Move: click where the point should go, or press Escape to cancel';
        const MOVE_GROUP = 'Move: click where the point should go; the other selected points come with it. Escape cancels';
        const CANCELLED = 'Move cancelled';
        const settle = async () => { await page.waitForTimeout(250); await twoFrames(page); };
        const atEnd = async () => { await page.getByRole('button', { name: 'Skip to end' }).click(); await settle(); };
        const hash = async () => (await pixels(page)).hash;
        const box = await page.locator(PREVIEW).boundingBox();
        const on = ([fx, fy]) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
        const off = async () => { await page.mouse.move(1, 1); await settle(); };
        const tapAt = async (place) => { const { x, y } = on(place); await pointer.tap(x, y); await settle(); };
        const cursor = () => page.locator(CANVAS).evaluate((c) => getComputedStyle(c).cursor);
        const said = () => page.evaluate(() => [...window.__said]);
        // The queue shows each message in turn, each held a while (announce.ts): wait for words among the changes since
        // `from`, and for the region to come back to empty (the queue drained) before counting.
        const heardSince = (from, words) => page.waitForFunction(([f, w]) => window.__said.slice(f).includes(w), [from, words], { timeout: 6000 }).then(() => true, () => false);
        const drained = () => page.waitForFunction((s) => document.querySelector(s)?.textContent === '', STATUS, { timeout: 10000 }).then(() => true, () => false);
        const menuShown = () => page.locator('[role=menu]').count().then((n) => n === 1);
        const unfocus = () => page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
        const wrong = [];
        // A right-click on a place, then "Move" clicked in the menu; false when there was no "Move" to click.
        const chooseMove = async (place, prompt, when) => {
          const { x, y } = on(place);
          await page.mouse.click(x, y, { button: 'right' });
          await settle();
          const item = page.getByRole('menuitem', { name: 'Move' });
          if ((await item.count()) !== 1) { wrong.push(`${when}: the right-click showed no "Move"`); return false; }
          await item.click();
          await settle();
          if (!(await comesToWords(page, prompt))) wrong.push(`${when}: the status did not come to ${JSON.stringify(prompt)}`);
          if ((await cursor()) !== 'crosshair') wrong.push(`${when}: while it waited the cursor read ${JSON.stringify(await cursor())}, not "crosshair"`);
          return true;
        };
        const notWaiting = async (when) => { const c = await cursor(); if (c === 'crosshair') wrong.push(`${when}: the cursor still read "crosshair"`); };
        const read = async () => ({ tap: await markBeyond(page, second, first), moved: await markBeyond(page, DRAG_TO, first) });
        await atEnd();
        await page.locator(STATUS).evaluate((s) => { window.__said = []; new MutationObserver(() => { window.__said.push(s.textContent ?? ''); }).observe(s, { childList: true, characterData: true, subtree: true }); });
        // (1) One point.
        await off();
        const before = await read();
        if (!before.tap || before.moved) wrong.push(`(1) before "Move" the marker read ${before.tap ? '' : 'not '}at the tap and ${before.moved ? '' : 'not '}at the new place`);
        await notWaiting('(1) before "Move"');
        if (await chooseMove(second, MOVE_ONE, '(1)')) {
          const from = (await said()).length;
          await tapAt(DRAG_TO);
          await off();
          await notWaiting('(1) after the click');
          await atEnd();
          const after = await read();
          if (!after.moved || after.tap) wrong.push(`(1) after the click the marker read ${after.moved ? '' : 'not '}at the new place and ${after.tap ? '' : 'not '}at the tap`);
          await heardSince(from, POINT_MOVED);
          await drained();
          const since = (await said()).slice(from);
          const moved = since.filter((w) => w === POINT_MOVED).length;
          if (moved !== 1 || since.includes(POINT_ADDED)) wrong.push(`(1) after the click the status said "${POINT_MOVED}" ${moved} time(s)${since.includes(POINT_ADDED) ? ` and "${POINT_ADDED}"` : ''}`);
          await unfocus();
          await page.keyboard.press(UNDO);
          await atEnd();
          const undone = await read();
          if (!undone.tap || undone.moved) wrong.push(`(1) after one Undo the marker read ${undone.tap ? '' : 'not '}at the tap and ${undone.moved ? '' : 'not '}at the new place`);
        }
        // (2) Escape.
        await off();
        const baseline = await hash();
        // One Undo and one Redo, the canvas read after each (the history check of each cancel, Codex list line 20).
        const undoRedo = async () => {
          await unfocus();
          await page.keyboard.press(UNDO);
          await off();
          const undone = await hash();
          await page.keyboard.press(REDO);
          await off();
          return { undone, redone: await hash() };
        };
        const history = await undoRedo();
        if (history.undone === history.redone) wrong.push('(2) before "Move" one Undo drew the canvas as one Redo did, so the history check could see nothing');
        const historyKept = async (when) => {
          const now = await undoRedo();
          if (now.undone !== history.undone || now.redone !== history.redone) wrong.push(`${when}: one Undo then one Redo did not draw the canvases they drew before "Move" (${now.undone === history.redone ? 'the Undo changed nothing: the cancel left a step' : 'the history changed'})`);
        };
        if (await chooseMove(second, MOVE_ONE, '(2)')) {
          await off();
          await page.keyboard.press('Escape');
          await settle();
          if (!(await comesToWords(page, CANCELLED))) wrong.push(`(2) after Escape the status did not come to "${CANCELLED}"`);
          if ((await hash()) !== baseline) wrong.push('(2) after Escape the canvas was not as before "Move"');
          await notWaiting('(2) after Escape');
          await historyKept('(2) after Escape');
          await tapAt(EMPTY);
          if (!(await comesToWords(page, POINT_ADDED))) wrong.push(`(2) the click after Escape did not add a point ("${POINT_ADDED}" not heard)`);
          await unfocus();
          await page.keyboard.press(UNDO);
          await off();
          if ((await hash()) !== baseline) wrong.push('(2) the Undo of the pen\'s point did not draw the canvas as before');
        }
        // (2b) A right-click while it waits.
        if (await chooseMove(second, MOVE_ONE, '(2b)')) {
          const { x, y } = on(EMPTY);
          await page.mouse.click(x, y, { button: 'right' });
          await settle();
          if (!(await comesToWords(page, CANCELLED))) wrong.push(`(2b) after a right-click the status did not come to "${CANCELLED}"`);
          if (await menuShown()) wrong.push('(2b) the right-click that cancelled opened a menu');
          await off();
          if ((await hash()) !== baseline) wrong.push('(2b) after the right-click the canvas was not as before "Move"');
          await notWaiting('(2b) after the right-click');
          await historyKept('(2b) after the right-click');
        }
        // (2c) Focus leaving the preview.
        if (await chooseMove(second, MOVE_ONE, '(2c)')) {
          const from = (await said()).length;
          await atEnd();
          await off();
          if (!(await heardSince(from, CANCELLED))) wrong.push(`(2c) a click on "Skip to end" while it waited did not say "${CANCELLED}"`);
          await notWaiting('(2c) after the click on "Skip to end"');
          if ((await hash()) !== baseline) wrong.push('(2c) after the click on "Skip to end" the canvas was not as before "Move"');
          await historyKept('(2c) after the click on "Skip to end"');
        }
        // (3) The group.
        await page.keyboard.press('Escape');
        await settle();
        for (const place of [first, second]) {
          const { x, y } = on(place);
          await page.keyboard.down(COMMAND);
          await page.mouse.click(x, y);
          await page.keyboard.up(COMMAND);
          await off();
        }
        const rings = await ringsAt(page, [first, second]);
        if (rings.some((n) => n <= 50)) wrong.push(`(3) the command-clicks left the rings at ${JSON.stringify(rings)} pixels, not both ringed`);
        if (await chooseMove(second, MOVE_GROUP, '(3)')) {
          const from = (await said()).length;
          await tapAt(DRAG_TO);
          await off();
          await atEnd();
          const marks = { second: await markBeyond(page, DRAG_TO, firstTo), first: await markBeyond(page, firstTo, DRAG_TO), secondTap: await markBeyond(page, second, first), firstTap: await markBeyond(page, first, second) };
          if (!marks.second || !marks.first || marks.secondTap || marks.firstTap) wrong.push(`(3) after the click the second marker read ${marks.second ? '' : 'not '}at DRAG_TO and the first ${marks.first ? '' : 'not '}moved by the same offset; ${marks.secondTap ? 'the second still at its tap' : 'the second not at its tap'}, ${marks.firstTap ? 'the first still at its tap' : 'the first not at its tap'}`);
          if (!(await heardSince(from, '2 points moved'))) wrong.push('(3) the status never said "2 points moved"');
        }
        const ok = !wrong.length;
        record('2.5.7', ok, ok ? `in pen-drawn, by the pointer alone: the second point right-clicked and its menu's "Move" clicked, the status said "${MOVE_ONE}" and the cursor read crosshair; one click on empty picture drew its marker there and not at its tap, "${POINT_MOVED}" said once and "${POINT_ADDED}" never, and one Undo put it back; Escape, a right-click and a click on "Skip to end" each cancelled the wait with "${CANCELLED}" and the canvas as before, and after each one Undo then one Redo drew the canvases they drew before "Move" (the history unchanged); with both points selected, "Move" on the second and one click drew both markers moved by the same offset, "2 points moved" said. The preview's two drags (a point's, a group's) have this single-pointer way; the timeline's drag is checked by pointer-cancellation; no keyboard way is credited` : wrong.join('; '));
        record('2.5.1', ok, ok ? 'the page\'s path gestures are its three drags, each with a single-pointer way: a point\'s and a group\'s on the preview by the point\'s menu "Move" and one click (shown in this run: one point, Escape, a right-click, focus leaving, the group); the timeline\'s by a press on the track (pointer-cancellation\'s 2.5.7)' : wrong.join('; '));
      },
    },
    {
      // 2.4.3 (CORE-06, brief 140, ruling EF; D271 (a), answered by the owner, 2026-11-27): a line's menu, by pointer.
      // In pen-drawn's set-up (two taps, the second point selected), skipped to the route's end. A listener on the
      // document (after the canvas's own) notes whether each right-click's menu event was cancelled.
      // (1) A right-click three tenths along the line (line-insert-plus's place, clear of the points and the "+"): a
      // menu named "Line actions" stands in document.body, outside .preview, its menuitems "Make line two-way" then
      // "Reverse line" (the line runs one way), focus on the first; the browser's menu cancelled. Escape closes it,
      // focus on the box, and the rings at the two taps read as before the right-click (the selection unchanged).
      // (2) Again; "Make line two-way" clicked: the menu closes, focus on the box, "Line made two-way" heard. (3) Again:
      // the first item now reads "Make line one way" (the direction read back); "Reverse line" clicked: "Line reversed"
      // heard, focus on the box. (4) One Undo: "Undo" heard, and a right-click still shows "Make line one way" (the Undo
      // took back the Reverse alone, which the editor does not draw); Escape. (5) A second Undo: a right-click shows
      // "Make line two-way"; Escape. (6) The mouse rests on the line's middle, as line-insert-plus hovers the "+", then a
      // right-click there opens the same menu; Escape closes it with focus on the box. (7) A right-click on empty picture
      // opens no menu and leaves the browser's menu alone. (8) It shows D273 part 1's look and words (brief 143; nothing
      // new is claimed, so no new row): the line's middle stretch read whole (the line drawn at the end, the guide over
      // it); "Reverse line", from the menu opened as in (5), leaves the one-way line pointing back at the lead start:
      // "Line reversed. 1 line the lead does not walk" heard, and the middle stretch reads dotted (the guide's round dots
      // alone: "grows" draws a line the lead never reaches nowhere); one Undo: "Undo. The lead walks every line" heard,
      // and the stretch reads whole again. Over the run the status said, in turn and each once, "Line made two-way",
      // "Line reversed", "Undo", "Undo" and (8)'s two (words read as point-move reads them). The menu opens by pointer
      // only: nothing is claimed for 2.1.1 (no key picks out a line yet, D271 part (1)), nor for 1.4.11 or 2.5.x. The
      // row is 2.4.3 under the j-order method (the catalogue takes 2.4.3 from keyboard or j-order journeys; this one has
      // no keyboard way). Faults that fail it (brief 140, PROBE-140/mut-*.txt): (ao) the opener ignoring line hits;
      // (ap) the direction item always "Make line one way"; (aq) the line's words dropped. Step (8) was red on brief 143's
      // stage 2 build with the guide's dotted branch removed: "(8) after "Reverse line" the line's middle read 72% of 43
      // samples in the route's hue, longest run 7, not dotted" (the lane's PROBE-143/red-line-menu.txt). Faults that
      // fail (8), run by sub-chat 143 (PROBE-143/mut-ba.txt, mut-bb.txt, mut-bd.txt): (ba) a left-out line drawn in the
      // guide's dashes: the same words as the red run; (bb) the sentence never added: ""Line reversed. 1 line the lead
      // does not walk" was not heard after "Reverse line"" and ""Undo. The lead walks every line" was not heard"; (bd)
      // "The lead walks every line" never said: the second of those.
      name: 'line-menu',
      method: 'j-order',
      rows: ['2.4.3'],
      run: async ({ page, open, record }) => {
        await open('pen-drawn');
        const [first, second] = TAPS;
        const ALONG = 0.3;
        const LINE = [first[0] + (second[0] - first[0]) * ALONG, first[1] + (second[1] - first[1]) * ALONG];
        const MIDDLE = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
        const EMPTY = [0.3, 0.7];
        const NAME = 'Line actions';
        const [TWO, ONE, REVERSE] = ['Make line two-way', 'Make line one way', 'Reverse line'];
        const settle = async () => { await page.waitForTimeout(250); await twoFrames(page); };
        const box = await page.locator(PREVIEW).boundingBox();
        const on = ([fx, fy]) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
        const off = async () => { await page.mouse.move(1, 1); await settle(); };
        const said = () => page.evaluate(() => [...window.__said]);
        const heardSince = (from, words) => page.waitForFunction(([f, w]) => window.__said.slice(f).includes(w), [from, words], { timeout: 6000 }).then(() => true, () => false);
        const drained = () => page.waitForFunction((s) => document.querySelector(s)?.textContent === '', STATUS, { timeout: 12000 }).then(() => true, () => false);
        const readMenu = () => page.evaluate(() => {
          const m = document.querySelector('[role=menu]');
          if (!m) return null;
          const e = document.activeElement;
          return { name: m.getAttribute('aria-label'), inBody: m.parentElement === document.body, inPreview: m.closest('.preview') !== null, items: [...m.querySelectorAll('[role=menuitem]')].map((each) => each.getAttribute('aria-label')), focused: e?.getAttribute('role') === 'menuitem' ? e.getAttribute('aria-label') : null };
        });
        const rightClick = async (place) => { const { x, y } = on(place); await page.mouse.click(x, y, { button: 'right' }); await settle(); };
        const prevented = () => page.evaluate(() => window.__menuPrevented);
        const ringed = async () => (await ringsAt(page, [first, second])).map((n) => n > 50);
        const wrong = [];
        // A right-click at `place` opens "Line actions" with `head` first, then "Reverse line", focus on the first.
        const opens = async (place, head, when) => {
          await rightClick(place);
          const m = await readMenu();
          if (m === null) { wrong.push(`${when}: the right-click opened no menu`); return false; }
          if (m.name !== NAME) wrong.push(`${when}: the menu was named ${JSON.stringify(m.name)}`);
          if (!m.inBody || m.inPreview) wrong.push(`${when}: the menu stood ${m.inPreview ? 'inside .preview' : 'outside document.body'}`);
          if (JSON.stringify(m.items) !== JSON.stringify([head, REVERSE])) wrong.push(`${when}: its items read ${JSON.stringify(m.items)}, not ${JSON.stringify([head, REVERSE])}`);
          if (m.focused !== head) wrong.push(`${when}: focus was on ${JSON.stringify(m.focused)} on opening, not ${JSON.stringify(head)}`);
          if ((await prevented()) !== true) wrong.push(`${when}: the browser's own menu was not cancelled`);
          return true;
        };
        const closes = async (when) => {
          await page.keyboard.press('Escape');
          await settle();
          if ((await readMenu()) !== null) wrong.push(`${when}: Escape left the menu open`);
          if (!(await focusOn(page, PREVIEW))) wrong.push(`${when}: after Escape focus was not on the preview box`);
        };
        const choose = async (label, words, when) => {
          const from = (await said()).length;
          await page.getByRole('menuitem', { name: label }).click();
          await settle();
          if ((await readMenu()) !== null) wrong.push(`${when}: the menu stayed open after "${label}"`);
          if (!(await focusOn(page, PREVIEW))) wrong.push(`${when}: after "${label}" focus was not on the preview box`);
          if (!(await heardSince(from, words))) wrong.push(`${when}: "${words}" was not heard after "${label}"`);
        };
        // The queue merges the same words written while the region still shows them (announce.ts): each Undo waits for
        // the region to come back to empty, so the second "Undo" is written again.
        const undo = async (when, words = 'Undo') => {
          await drained();
          const from = (await said()).length;
          await page.keyboard.press(UNDO);
          await settle();
          if (!(await heardSince(from, words))) wrong.push(`${when}: "${words}" was not heard`);
        };
        // The line's middle stretch (three tenths to seven tenths along), read every canvas pixel: at each, the strongest
        // pixel within 2 across the line. `share` is the part of them in the route's hue (penMarksRead's test), `run` the
        // longest stretch of them in a row.
        const stretchRead = () => page.locator(CANVAS).evaluate((c, [a, b]) => {
          const ctx = c.getContext('2d');
          const at = (x, y) => [...ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data];
          const routeHue = ([r, g, bl, al]) => al > 60 && r > 120 && r > g && g >= bl;
          const [qx, qy, px, py] = [a[0] * c.width, a[1] * c.height, b[0] * c.width, b[1] * c.height];
          const len = Math.hypot(px - qx, py - qy), [ux, uy] = [(px - qx) / len, (py - qy) / len];
          const hued = [];
          for (let d = 0.3 * len; d <= 0.7 * len; d += 1) {
            let best = [0, 0, 0, 0];
            for (let e = -2; e <= 2; e += 1) { const p = at(qx + ux * d - uy * e, qy + uy * d + ux * e); if (p[3] > best[3]) best = p; }
            hued.push(routeHue(best));
          }
          let run = 0, longest = 0;
          for (const h of hued) { run = h ? run + 1 : 0; longest = Math.max(longest, run); }
          return { n: hued.length, share: hued.filter(Boolean).length / hued.length, run: longest };
        }, [first, second]);
        await page.getByRole('button', { name: 'Skip to end' }).click();
        await settle();
        await page.evaluate(() => { window.__menuPrevented = null; document.addEventListener('contextmenu', (e) => { window.__menuPrevented = e.defaultPrevented; }); });
        await page.locator(STATUS).evaluate((s) => { window.__said = []; new MutationObserver(() => { window.__said.push(s.textContent ?? ''); }).observe(s, { childList: true, characterData: true, subtree: true }); });
        await off();
        const rings = await ringed();
        // (1) Opened, read, closed; the selection unchanged.
        if (await opens(LINE, TWO, '(1)')) {
          await closes('(1)');
          await off();
          const now = await ringed();
          if (JSON.stringify(now) !== JSON.stringify(rings)) wrong.push(`(1) the rings at the taps read ${JSON.stringify(now)} after the menu, ${JSON.stringify(rings)} before (the selection changed)`);
        }
        // (2) "Make line two-way".
        if (await opens(LINE, TWO, '(2)')) await choose(TWO, 'Line made two-way', '(2)');
        // (3) The direction read back; "Reverse line".
        if (await opens(LINE, ONE, '(3)')) await choose(REVERSE, 'Line reversed', '(3)');
        // (4) One Undo: the Reverse alone taken back.
        await undo('(4)');
        if (await opens(LINE, ONE, '(4)')) await closes('(4)');
        // (5) A second Undo: the line one way again.
        await undo('(5)');
        if (await opens(LINE, TWO, '(5)')) await closes('(5)');
        // (6) The "+": the mouse rests on the line's middle first.
        const middle = on(MIDDLE);
        await page.mouse.move(middle.x, middle.y);
        await settle();
        if (await opens(MIDDLE, TWO, '(6) on the "+"')) await closes('(6)');
        // (7) Empty picture.
        await rightClick(EMPTY);
        if ((await readMenu()) !== null) wrong.push('(7) a right-click on empty picture opened a menu');
        if ((await prevented()) !== false) wrong.push('(7) a right-click on empty picture cancelled the browser\'s menu');
        await off();
        // (8) D273 part 1: the line one way again, "Reverse line" leaves it pointing back at the lead start, so the lead
        // cannot walk it: the words say so, and paused the line shows dotted (the guide's round dots alone, as the line's
        // own "grows" layer draws a line the lead never reaches nowhere) where it showed whole under the guide's dashes;
        // the Undo says the lead walks every line again, and the line reads as before.
        await drained();
        const walkedRead = await stretchRead();
        if (await opens(LINE, TWO, '(8)')) await choose(REVERSE, 'Line reversed. 1 line the lead does not walk', '(8)');
        await off();
        const leftRead = await stretchRead();
        await undo('(8) the Undo of "Reverse line"', 'Undo. The lead walks every line');
        await off();
        const backRead = await stretchRead();
        // Probed (the lane's PROBE-143/probe-figures.md, 43 samples): walked 1.00 (longest run 43), dotted 0.42 (4), and
        // the guide's dashes alone, fault (ba), 0.72 (7): dotted is a share from 0.20 to 0.57, walked 0.90 or more.
        const reads = (r) => `${Math.round(r.share * 100)}% of ${String(r.n)} samples in the route's hue, longest run ${String(r.run)}`;
        const whole = (r) => r.share >= 0.9;
        const dotted = (r) => r.share >= 0.2 && r.share <= 0.57;
        if (!whole(walkedRead)) wrong.push(`(8) before "Reverse line" the line's middle read ${reads(walkedRead)}, not whole`);
        if (!dotted(leftRead)) wrong.push(`(8) after "Reverse line" the line's middle read ${reads(leftRead)}, not dotted`);
        if (!whole(backRead)) wrong.push(`(8) after its Undo the line's middle read ${reads(backRead)}, not whole`);
        await drained();
        const all = (await said()).filter(Boolean);
        const SAID = ['Line made two-way', 'Line reversed', 'Undo', 'Undo', 'Line reversed. 1 line the lead does not walk', 'Undo. The lead walks every line'];
        if (JSON.stringify(all) !== JSON.stringify(SAID)) wrong.push(`the status said ${JSON.stringify(all)} in turn; ${JSON.stringify(SAID)} were expected, each once (D271)`);
        const ok = !wrong.length;
        record('2.4.3', ok, ok ? `in pen-drawn, by the pointer: a right-click three tenths along the line, and one on its "+" with the mouse resting there, each opened a menu named "${NAME}" in document.body, outside .preview, focus on its first item, the browser's menu cancelled; its items read "${TWO}" then "${REVERSE}" while the line ran one way and "${ONE}" first after "${TWO}" was chosen; after Escape and after each item chosen the menu closed and focus was on the preview box; the rings at the taps read as before the menu (the selection unchanged); over the run the status said, in turn and each once, ${JSON.stringify(all)} (D271's words, then one Undo that left "${ONE}" first and a second that brought back "${TWO}"); a right-click on empty picture opened no menu and left the browser's own. The menu opens by pointer only (no 2.1.1 claim)` : wrong.join('; '));
      },
    },
    {
      // 2.2.2 (CORE-06, brief 141, FE; D272 (c), answered by the owner, 2026-11-27): a press on the picture while
      // the route plays pauses the play and does nothing else (dom.ts point 11; the page hands the binding Play or
      // pause's own toggle, which the binding calls only while playing). In pen-drawn's set-up (two taps, one line), at
      // the route's end with the mouse off the preview, the whole canvas is read (pixels' hash) as the baseline. Then
      // Skip to start and Play: (1) while the button reads "Pause", a tap on empty picture: "Animation paused" is heard,
      // the button reads "Play", and no "Point added" is heard; skipped to the end with the mouse off, the canvas reads
      // the baseline (no point was added, the selection is as it was). (2) Paused, a tap at the same place: "Point
      // added" is heard (the pen works again), and at the end the canvas is no longer the baseline. (3) One Undo with
      // focus on the box: "Undo" heard, the canvas the baseline again. (4) Skip to start, Play again, and while the
      // button reads "Pause" a right-click on the first point: "Animation paused" heard again, the button reads "Play",
      // no menu opens (no [role=menu], nothing named "Point actions"), the browser's own menu is cancelled, and at the
      // end the canvas reads the baseline (nothing selected or changed). The status queue merges the same words written
      // while the region still shows them (announce.ts): each step waits for it to come back to empty, as line-menu and
      // point-move do. The row is 2.2.2 under the j-timing method: a pointer way to pause the moving preview, beside the
      // Pause button and Space (no new row; nothing is claimed for 3.2.x). Faults that fail it, run by sub-chat 142
      // (the lane's PROBE-142/mut-as.txt, mut-at.txt): (as) the binding's playing branch removed: 2.2.2 failed with
      // "the button read "Pause" just after the press, not "Play" (the play went on)" and ""Point added" was heard
      // after the tap while playing"; (at) the press swallowed but `pause` not called: 2.2.2 failed with "the button
      // read "Pause" just after the press" and ""Animation paused" was not heard" at steps (1) and (4). It was red on
      // stage 2's build, where the page handed no `pause` (PROBE-141/red-press-while-playing.txt).
      name: 'press-while-playing',
      method: 'j-timing',
      rows: ['2.2.2'],
      run: async ({ page, open, record }) => {
        await open('pen-drawn');
        const [first] = TAPS;
        const EMPTY = [0.3, 0.7];
        const settle = async () => { await page.waitForTimeout(250); await twoFrames(page); };
        const box = await page.locator(PREVIEW).boundingBox();
        const on = ([fx, fy]) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
        const off = async () => { await page.mouse.move(1, 1); await settle(); };
        const said = () => page.evaluate(() => [...window.__said]);
        const heardSince = (from, words) => page.waitForFunction(([f, w]) => window.__said.slice(f).includes(w), [from, words], { timeout: 6000 }).then(() => true, () => false);
        const drained = () => page.waitForFunction((s) => document.querySelector(s)?.textContent === '', STATUS, { timeout: 12000 }).then(() => true, () => false);
        const button = () => page.locator('#play-pause').textContent().then((t) => (t ?? '').trim());
        const prevented = () => page.evaluate(() => window.__menuPrevented);
        const atEnd = async () => { await page.getByRole('button', { name: 'Skip to end' }).click(); await off(); return (await pixels(page)).hash; };
        const wrong = [];
        // Skip to start and Play; true once the button reads "Pause" (the play under way).
        const play = async (when) => {
          await drained();
          await page.getByRole('button', { name: 'Skip to start' }).click();
          await drained();
          await page.getByRole('button', { name: 'Play' }).click();
          const going = await page.waitForFunction(() => document.querySelector('#play-pause')?.textContent?.trim() === 'Pause', undefined, { timeout: 3000 }).then(() => true, () => false);
          if (!going) wrong.push(`${when}: after Play the button read ${JSON.stringify(await button())}, not "Pause"`);
          await drained();
          return going;
        };
        // After a press while playing: the button reads "Play" at once (read first: the route is 4 s long and would end by
        // itself while the words are waited for), and "Animation paused" is heard.
        const paused = async (from, when) => {
          const now = await button();
          if (now !== 'Play') wrong.push(`${when}: the button read ${JSON.stringify(now)} just after the press, not "Play" (the play went on)`);
          if (!(await heardSince(from, 'Animation paused'))) wrong.push(`${when}: "Animation paused" was not heard`);
        };
        await page.evaluate(() => { window.__menuPrevented = null; document.addEventListener('contextmenu', (e) => { window.__menuPrevented = e.defaultPrevented; }); });
        await page.locator(STATUS).evaluate((s) => { window.__said = []; new MutationObserver(() => { window.__said.push(s.textContent ?? ''); }).observe(s, { childList: true, characterData: true, subtree: true }); });
        const baseline = await atEnd();
        // (1) A tap on empty picture while playing.
        if (await play('(1)')) {
          const from = (await said()).length;
          const { x, y } = on(EMPTY);
          await page.mouse.click(x, y);
          await settle();
          await paused(from, '(1)');
          await drained();
          if ((await said()).slice(from).includes('Point added')) wrong.push('(1) "Point added" was heard after the tap while playing');
          if ((await atEnd()) !== baseline) wrong.push('(1) at the end the canvas did not read as before the tap (a point was added or the selection changed)');
        }
        // (2) The same tap, paused: the pen's again.
        await drained();
        let from = (await said()).length;
        const { x, y } = on(EMPTY);
        await page.mouse.click(x, y);
        await settle();
        if (!(await heardSince(from, 'Point added'))) wrong.push('(2) "Point added" was not heard after the tap, paused');
        if ((await atEnd()) === baseline) wrong.push('(2) at the end the canvas read as before the tap, paused (nothing was added)');
        // (3) One Undo with focus on the box.
        await drained();
        await page.locator(PREVIEW).focus();
        from = (await said()).length;
        await page.keyboard.press(UNDO);
        await settle();
        if (!(await heardSince(from, 'Undo'))) wrong.push('(3) "Undo" was not heard');
        if ((await atEnd()) !== baseline) wrong.push('(3) after one Undo the canvas did not read the baseline');
        // (4) A right-click on the first point while playing.
        if (await play('(4)')) {
          from = (await said()).length;
          const point = on(first);
          await page.mouse.click(point.x, point.y, { button: 'right' });
          await settle();
          await paused(from, '(4)');
          const menu = await page.evaluate(() => document.querySelector('[role=menu]')?.getAttribute('aria-label') ?? null);
          if (menu !== null) wrong.push(`(4) a menu opened (${JSON.stringify(menu)}) on a right-click while playing`);
          if ((await page.getByRole('menu', { name: 'Point actions' }).count()) !== 0) wrong.push('(4) "Point actions" opened');
          if ((await prevented()) !== true) wrong.push('(4) the browser\'s own menu was not cancelled');
          if ((await atEnd()) !== baseline) wrong.push('(4) at the end the canvas did not read the baseline (the right-click changed something)');
        }
        await drained();
        const ok = !wrong.length;
        record('2.2.2', ok, ok ? 'in pen-drawn, by the pointer: while the route played (the button read "Pause"), a tap on empty picture paused it ("Animation paused" heard, the button read "Play"), no "Point added" was heard, and at the end the canvas read as before; the same tap, paused, added a point ("Point added" heard, the canvas changed), and one Undo ("Undo" heard) brought the canvas back; played again, a right-click on the first point paused it ("Animation paused" heard, the button read "Play"), opened no menu, cancelled the browser\'s own, and changed nothing on the canvas (D272 (c))' : wrong.join('; '));
      },
    },
    {
      // 2.5.2 (CORE-06, brief 121, ruling AD; brief 120's "+", D208's hover): a bend inserted by the "+" at a line's
      // middle, completed on the up, undone in one step, and aborted by moving off before the up. It takes the place of
      // brief 119's line-hover-halo, whose three hover readings it carries in as regression checks: the 2.5.2 credit
      // rests on readings (5) to (8) alone (the press, the up, Undo and the abort; gpt-6-astra's condition on brief 120's
      // range, its "added question"); (1) to (4) are hovers with no press and earn nothing by themselves.
      // In pen-drawn's set-up (two taps, the second point selected, so the route is selected), skipped to the route's
      // end, with the mouse off the preview, the whole canvas is read (pixels' hash) as the baseline.
      // (1) to (3), as line-hover-halo read them: two pixels where only one mark draws, three tenths of the way along the
      // line from the first tap (about 32 px from it and 21 px from the middle, clear of both points and of the "+"):
      // the line's centre pixel (the most opaque within 1 px of the place, the route's hue, alpha over 200), and a pixel
      // beside it on the ray square to the line, the first fully transparent one out from the centre, used only within
      // 3 px (the halo's two strokes are the line's width + 9 and + 4 units, overlays.ts GLOW, so it reaches at least
      // 4.5 units out; probed, brief 119). The mouse moves there with no press: (1) the centre pixel reads in the line's
      // own colour, as before (within 24 a channel), not the halo blended over it; (2) the pixel beside reads the halo
      // (alpha over 200, blue at least green at least red, blue over 200). The mouse leaves the preview in one move: (3)
      // both read as before (within 8 a channel). Each fails with its fault put back (brief 119's (k), (l), (m)).
      // (4) The mouse moves back onto the line's middle, the "+"'s place (the middle of the two taps: the line is
      // straight, and the overlay draws the "+" at its middle sample, brief 120). plusHandle draws it active, the mouse on
      // it, as a disc of radius 11 units filled in the accent #0f62fe with a white cross 2 units wide, arms 5.5 long; idle,
      // radius 9, filled white with an accent cross. Probed (brief 121, PROBE-121/probe-plus.txt): at 1280 by 800 the
      // canvas is 704 by 396 at 704 CSS px (ratio 1, unit 1). The "+" reads active when its centre pixel is the cross's
      // white (alpha over 200, every channel over 230) and the four pixels 4 px out on its diagonals (5.7 px from the
      // centre: inside the disc, off the cross) read the accent fill (alpha over 200, blue over 200, red under 60);
      // idle, both would read the other way round. Offsets scale by the canvas's ratio.
      // (5) A press on the "+" (through the pointer adapter) adds nothing before the up: while it is held the whole
      // canvas reads as the baseline, so no mark is added anywhere, and no pixel within 2 px of the middle reads dark (a
      // bend's mark is v3's grey dot, black at half alpha edged white: alpha over 100, every channel under 140; the line's
      // own pixels there read red over 200). A down clears the hover, as every down does (dom.ts, point 6), so the "+"
      // is not drawn while held: "as before the press" is read as the canvas before the mouse came onto the preview.
      // (6) The up adds the point there: skipped to the end again (the mouse leaves for the button), at least three
      // pixels within 2 px of the middle read dark, the new bend's grey dot (the reading point-drag-moves makes of a
      // marker, where only that mark draws, by a bend's own mark), and the canvas is no longer the baseline.
      // (7) One Undo (focus off the Skip button) and the whole canvas reads as the baseline again.
      // (8) The abort: the mouse back on the "+" (it reads active again: the route is still selected, so the "+" is
      // live), a press there moved in four steps to 32 px right and 32 px up (45 px from the "+", well beyond
      // DRAG_THRESHOLD's 3 px and the "+"'s 12 px, and square to the line, beyond its 8 px), and released there: the
      // whole canvas reads as the baseline (no point added), and one Redo then draws the grey dot at the middle again
      // (the insert undone at (7) is still the step to redo, so the abort made no step).
      // Faults that fail it (brief 121): (r) penTap's insert branch removed fails (6); (s) the insert done on the down
      // fails (5); (t) a moved press giving a tap fails (8). Nothing is claimed for 2.5.8 (the "+"'s target size, D255),
      // 1.4.11 (the "+" and the halo stay under the preview's set-aside), 1.4.13, or 2.5.7 (the preview's drags' single-pointer way is checked by point-move, brief 139).
      name: 'line-insert-plus',
      method: 'j-pointer',
      rows: ['2.5.2'],
      run: async ({ page, open, record, pointer }) => {
        await open('pen-drawn');
        const now = async () => { await page.waitForTimeout(250); await twoFrames(page); };
        const atEnd = async () => { await page.getByRole('button', { name: 'Skip to end' }).click(); await now(); };
        const blur = () => page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
        await atEnd();
        // Where the two pixels are, in canvas pixels, from the taps and the canvas before the hover.
        // Three tenths along from the first tap: off the "+" at the middle (its hit 12 px, its disc 9 to 11) and the points.
        const ALONG = 0.3;
        const spot = await page.locator(CANVAS).evaluate((c, [[ax, ay], [bx, by], ALONG]) => {
          const ctx = c.getContext('2d');
          const [px, py, qx, qy] = [ax * c.width, ay * c.height, bx * c.width, by * c.height];
          const len = Math.hypot(qx - px, qy - py), [ux, uy] = [(qx - px) / len, (qy - py) / len];
          // The line is about 1 px wide here: of the pixels within 1 px of the place, the most opaque is its centre pixel.
          const [fx, fy] = [Math.floor(px + (qx - px) * ALONG), Math.floor(py + (qy - py) * ALONG)];
          let [mx, my, top] = [fx, fy, -1];
          for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
            const alpha = ctx.getImageData(fx + dx, fy + dy, 1, 1).data[3];
            if (alpha > top) [mx, my, top] = [fx + dx, fy + dy, alpha];
          }
          let d = 1;
          while (d <= 3 && ctx.getImageData(Math.floor(mx - uy * d), Math.floor(my + ux * d), 1, 1).data[3] !== 0) d += 1;
          return { line: [mx, my], beside: [Math.floor(mx - uy * d), Math.floor(my + ux * d)], d };
        }, [...TAPS, ALONG]);
        const read = () => page.locator(CANVAS).evaluate((c, at) => at.map(([x, y]) => [...c.getContext('2d').getImageData(x, y, 1, 1).data]), [spot.line, spot.beside]);
        const same = (p, q, by) => p.every((v, i) => Math.abs(v - q[i]) <= by);
        const halo = ([r, g, b, a]) => a > 200 && b > 200 && b >= g && g >= r;
        // The middle: the "+"'s centre pixel, its four diagonal pixels, and the dark pixels within 2 px (a bend's grey dot).
        const MIDDLE = [(TAPS[0][0] + TAPS[1][0]) / 2, (TAPS[0][1] + TAPS[1][1]) / 2];
        const middle = async () => ({ hash: (await pixels(page)).hash, ...(await page.locator(CANVAS).evaluate((c, [fx, fy]) => {
          const ctx = c.getContext('2d');
          const ratio = c.width / c.getBoundingClientRect().width;
          const [cx, cy] = [Math.floor(fx * c.width), Math.floor(fy * c.height)];
          const at = (dx, dy) => [...ctx.getImageData(cx + Math.round(dx * ratio), cy + Math.round(dy * ratio), 1, 1).data];
          const reach = Math.max(2, Math.round(2 * ratio));
          let dark = 0;
          for (let dy = -reach; dy <= reach; dy += 1) for (let dx = -reach; dx <= reach; dx += 1) {
            const [r, g, b, a] = ctx.getImageData(cx + dx, cy + dy, 1, 1).data;
            if (a > 100 && r < 140 && g < 140 && b < 140) dark += 1;
          }
          return { centre: at(0, 0), diagonals: [at(4, 4), at(-4, 4), at(4, -4), at(-4, -4)], dark };
        }, MIDDLE)) });
        const active = ({ centre: [r, g, b, a], diagonals }) => a > 200 && r > 230 && g > 230 && b > 230 && diagonals.every(([dr, , db, da]) => da > 200 && db > 200 && dr < 60);
        const wrong = [];
        const base = await middle();
        if (base.dark !== 0) wrong.push(`before the hover ${base.dark} pixel(s) within 2 px of the middle read dark, with no point there`);
        const [line, beside] = await read();
        if (spot.d > 3) wrong.push('no pixel within 3 px of the line\'s centre, square to it, was clear of the line before the hover');
        if (!orange(line, 200)) wrong.push(`before the hover the line's centre pixel read rgba(${line}), not the line`);
        const box = await page.locator(CANVAS).boundingBox();
        const [[ax, ay], [bx, by]] = TAPS;
        await page.mouse.move(box.x + box.width * (ax + (bx - ax) * ALONG), box.y + box.height * (ay + (by - ay) * ALONG), { steps: 4 });
        await now();
        const [lineOn, besideOn] = await read();
        if (!same(lineOn, line, 24) || !orange(lineOn, 200)) wrong.push(`(1) with the mouse on the line its centre pixel read rgba(${lineOn}), not the line's own rgba(${line})`);
        if (!halo(besideOn)) wrong.push(`(2) with the mouse on the line the pixel ${spot.d} px beside it read rgba(${besideOn}), not the halo`);
        // Off the preview in one move: the canvas hears pointer moves only over itself, so its pointerleave alone can
        // clear the hover (a move in steps would cross empty canvas first, and a move over nothing clears it too).
        await page.mouse.move(1, 1);
        await now();
        const [lineOff, besideOff] = await read();
        if (!same(lineOff, line, 8) || !same(besideOff, beside, 8)) wrong.push(`(3) after the mouse left the preview the two pixels read rgba(${lineOff}) and rgba(${besideOff}), not as before the hover, rgba(${line}) and rgba(${beside})`);
        const plus = { x: box.x + box.width * MIDDLE[0], y: box.y + box.height * MIDDLE[1] };
        await page.mouse.move(plus.x, plus.y, { steps: 4 });
        await now();
        const on = await middle();
        if (!active(on)) wrong.push(`(4) with the mouse on the line's middle the "+" did not read active: its centre rgba(${on.centre}), its diagonals ${on.diagonals.map((p) => `rgba(${p})`).join(', ')}`);
        await pointer.down(plus.x, plus.y);
        await now();
        const held = await middle();
        if (held.hash !== base.hash || held.dark !== 0) wrong.push(`(5) while the press on the "+" was held the canvas was ${held.hash === base.hash ? '' : 'not '}as before, and ${held.dark} pixel(s) at the middle read dark`);
        await pointer.up();
        await atEnd();
        const added = await middle();
        if (added.dark < 3 || added.hash === base.hash) wrong.push(`(6) after the up ${added.dark} pixel(s) within 2 px of the middle read dark (a bend's grey dot reads at least 3)${added.hash === base.hash ? ', and the canvas was as before' : ''}`);
        await blur();
        await page.keyboard.press(UNDO);
        await atEnd();
        const undone = await middle();
        if (undone.hash !== base.hash) wrong.push(`(7) after one Undo the canvas was not as before the insert (${undone.dark} pixel(s) at the middle read dark)`);
        await page.mouse.move(plus.x, plus.y, { steps: 4 });
        await now();
        const again = await middle();
        if (!active(again)) wrong.push(`(8) back on the line's middle after the Undo the "+" did not read active: its centre rgba(${again.centre})`);
        await pointer.down(plus.x, plus.y);
        for (let i = 1; i <= 4; i += 1) await pointer.move(plus.x + 8 * i, plus.y - 8 * i);
        await pointer.up();
        await page.mouse.move(1, 1);
        await atEnd();
        const aborted = await middle();
        if (aborted.hash !== base.hash) wrong.push(`(8) after a press on the "+" moved 45 px off it and released there the canvas was not as before (${aborted.dark} pixel(s) at the middle read dark)`);
        await blur();
        await page.keyboard.press(REDO);
        await atEnd();
        const redone = await middle();
        if (redone.dark < 3) wrong.push(`(8) after the abort one Redo did not draw the undone bend again (${redone.dark} pixel(s) at the middle read dark): the abort made a step`);
        record('2.5.2', !wrong.length, wrong.length ? wrong.join('; ') : `in pen-drawn, skipped to the end: (1) to (3), with no press, the mouse on the line three tenths along read its centre pixel in the line's own colour (rgba(${lineOn}), before rgba(${line})) and a pixel ${spot.d} px beside it in the halo (rgba(${besideOn})), both as before once the mouse left; (4) on the line's middle the "+" read active (centre rgba(${on.centre}), diagonals rgba(${on.diagonals[0]})); for 2.5.2: (5) a press on the "+", held, left the whole canvas as before the hover, nothing dark at the middle; (6) the up drew a bend's grey dot there (${added.dark} dark pixels within 2 px); (7) one Undo drew the whole canvas as before; (8) a press on the "+" moved 45 px off and released there left the canvas as before, and one Redo then drew the undone bend again (${redone.dark} dark pixels), so the abort made no step`);
      },
    },
    {
      // 4.1.3 (stage 6, the browser's decoder): the golden with one image, a real PNG the page's canvas made, opens:
      // "Project opened" said, no alert, Play offered.
      name: 'an-image-that-decodes',
      method: 'j-forms',
      rows: ['4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const png = await canvasPng(page);
        const wrong = [];
        await choose(page, await projectFile(png));
        if (!(await saysOpened(page))) wrong.push(`the status region never said "${OPENED}"`);
        if (await alerts(page).count()) wrong.push(`an alert showed: ${JSON.stringify(await alerts(page).first().textContent({ timeout: 2000 }).catch(() => ''))}`);
        if (await page.locator(PLAY).isDisabled()) wrong.push('Play is still disabled');
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `the golden with a ${png.length}-byte PNG from the page's canvas opened: "${OPENED}" said, no alert, Play offered`);
      },
    },
    {
      // 4.1.3 (stage 6, the browser's decoder): the same project whose image is a PNG header and nothing more is refused
      // by one alert in io's own words, the status region silent, nothing opened (Play still off).
      name: 'an-image-that-does-not-decode',
      method: 'j-forms',
      rows: ['4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const heard = await hear(page);
        const wrong = [];
        await choose(page, await projectFile(headerOnlyPng()));
        await alerts(page).first().waitFor({ timeout: 5000 }).catch(() => undefined);
        const count = await alerts(page).count();
        const words = ((await alerts(page).first().textContent({ timeout: 2000 }).catch(() => '')) ?? '').replace(/\s+/g, ' ');
        if (count !== 1) wrong.push(`${count} alert(s), not one`);
        if (!words.includes('Could not open with-image.zip') || !words.includes(NOT_SHOWN)) wrong.push(`the alert is not io's refusal of the image: ${JSON.stringify(words)}`);
        if (!(await neverSays(page, OPENED, 2500)) || (await heard()).length) wrong.push(`the status region said ${JSON.stringify(await heard())}`);
        if (!(await page.locator(PLAY).isDisabled())) wrong.push('Play is enabled: something was opened');
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `a PNG header alone, its size readable, refused by the browser's decoder: one alert, "${NOT_SHOWN}"; the status region silent; nothing opened`);
      },
    },
    {
      // 4.1.3 (stage 6): after a refusal, a second choice, the golden: the alert is gone before "Project opened" is said,
      // and stays gone.
      name: 'a-second-choice-clears-it',
      method: 'j-forms',
      rows: ['4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const wrong = [];
        await choose(page, TEXT_FILE);
        if (!(await alerts(page).first().waitFor({ timeout: 5000 }).then(() => true, () => false))) wrong.push('the text file showed no alert');
        await page.evaluate(([s, w]) => {
          const r = document.querySelector(s);
          window.__alertsAtOpened = null;
          new MutationObserver(() => { if (r.textContent === w && window.__alertsAtOpened === null) window.__alertsAtOpened = document.querySelectorAll('[role=alert]').length; }).observe(r, { childList: true, characterData: true, subtree: true });
        }, [STATUS, OPENED]);
        await choose(page, await projectFile());
        if (!(await saysOpened(page))) wrong.push(`the status region never said "${OPENED}"`);
        const atOpened = await page.evaluate(() => window.__alertsAtOpened);
        if (atOpened !== 0) wrong.push(`${atOpened} alert(s) showed when "${OPENED}" was said`);
        if (await alerts(page).count()) wrong.push('an alert shows after the open');
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `after a refusal, the golden chosen: no alert when "${OPENED}" was said, nor after`);
      },
    },
  ],
  // Extended depth (stage 4), read by `npm run a11y:extended`: VoiceOver journeys through Guidepup (each a state, the rows
  // it claims among those listing vo, steps of { next }, { previous }, { act }, { interact }, { stopInteracting },
  // { press: key }, { type: text }, { perform: command }, { wait: ms }, and the phrases expected in order); media items
  // (a file for ffprobe, caption files with their language, description files, a transcript route, the state and the
  // player's selector); flashing items (a state, a selector, a start control, seconds and fps) with the design constraint.
  // extended: {
  //   voJourneys: [{ name: 'settings-vo', state: 'home', engines: ['webkit', 'chromium'], rows: ['1.3.1', '2.4.1', '4.1.2'], steps: [{ next }, { next }], expected: ['Home, heading level 1', 'Menu, button'] }],
  //   media: [{ name: 'intro', file: 'public/intro.mp4', captions: [{ file: 'public/intro.en.vtt', lang: 'en' }], descriptions: [{ file: 'public/intro-ad.mp4' }], transcript: '/intro-transcript', state: 'home', player: '#intro' }],
  //   flashing: [{ name: 'alert', state: 'home', selector: '#alert', start: '#trigger', seconds: 3, fps: 20 }], flashingConstraint: 'no content flashes more than three times a second by design; alerts fade once',
  // },
  // The sampling, run by hand through `npm run a11y:sample` (the README's "Sampling the states"): the app's own route
  // list where it keeps one, else a walk from the entry points; never against live data. The cap bounds the renders,
  // states × 7 × engines; a sample over it is refused. Defaults apply when this is absent.
  // sample: { entries: ['/'], depth: 2, maxStates: 40, maxActions: 25, topUp: 0.1, cap: 150, engines: ['chromium'], skip: 'delete|remove|sign out|log out|pay|buy|send|submit|purchase|cancel subscription' },
  // The records the session keeps current, each with the note that grounds it; the report computes the rest.
  // records: { rows: { P09: { state: 'pass', note: 'no shared component or environment changed since the baseline' }, P10: { state: 'pass', note: 'no open finding' } } },
  // Route Plotter's, written by STACK-03 with the first run. The item that changes a shared component or the environment
  // the run uses, or finds a failure, updates them, with the date.
  records: {
    date: '2026-11-22',
    rows: {
      P09: { state: 'pass', note: 'STACK-03 made the first run, against the shell, its baseline; no shared component or environment had changed until 2026-11-21. That day CORE-05 began to change the shell, a shared component: one status region and the editor\'s keys, with their journeys broadened in the same change (fields-and-status, character-key-shortcuts, the keyboard functions skip-to-start-by-home and skip-to-end-by-end). Later the same day CORE-05 added Help, the first dialog and the first setting on the shell (the switch for single-key shortcuts, on to begin with), with the journeys that open it broadened in the same change (reading-and-focus-order, pointer-cancellation, fields-and-status, character-key-shortcuts both ways, keyboard-task) and the keyboard functions open-help-by-button, open-help-by-question-mark, close-help-by-escape, single-keys-off and single-keys-on. Later again that day CORE-05 added the play bar, a group of three buttons after Help with Play disabled and described by the reason line while there is nothing to play, with reading-and-focus-order, pointer-cancellation, fields-and-status and character-key-shortcuts broadened in the same change and the keyboard functions skip-to-start-by-button, skip-to-end-by-button-space-kept, play-refused-by-space, play-refused-by-k and play-refused-by-k-, -j- and -l-on-button. A wider run (the sampling, npm run a11y:sample) is flagged for when the frame\'s controls are on the page On 2026-11-21 too, CORE-05 put the timeline in the play bar, the shell\'s first slider, with its own look over Carbon\'s (a 44 px target round Carbon\'s knob, a track that narrows), and caught Escape before Carbon\'s tooltip in the kit\'s slider, with the journeys broadened in the same change (flag a wider run). On 2026-11-22 CORE-05 drew the shell through its frame: a banner above main (Carbon\'s header, in the page\'s flow, not fixed) holding the page\'s one h1 and Help, which Tab now meets before the progress link, and named slots that draw nothing until later items fill them; and the theme\'s colours from the University\'s tokens (the primary button, links and the focused knob), with the shell\'s snapshot, FOCUS and the waits for the h1 changed in the same change and the contrast and focus rows measuring the new colours (flag a wider run: the frame is the shared component every later screen stands in).' },
      P10: { state: 'pass', note: 'no open finding: the first run\'s one product failure, a shell with no control for the focus test, was fixed by its progress link and retested in the same run (STACK-03, pull request #178, which shows both runs); a failure stays a failure until fixed' },
    },
  },
};
