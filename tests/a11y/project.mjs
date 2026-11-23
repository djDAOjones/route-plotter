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

const ORIGIN = 'http://127.0.0.1:4173';
// The reviewed sequences: the text blocks a reader meets, in order (1.3.2); the controls Tab reaches, in order
// (2.4.3); each route and its title (2.4.2); the one place the shell links to. A change to the shell is reviewed here.
const READING = ['Route Plotter', 'Version 4 is being built here.', 'Timeline', 'Add at least two points to a route to play.'];
const FOCUS = ['button "Open project"', 'button "Help"', 'link "GitHub"', 'button "Skip to start"', 'button "Skip to end"', 'slider "Timeline"'];
const ROUTES = [{ path: '/', title: 'Route Plotter' }];
const PROGRESS = 'https://github.com/djDAOjones/route-plotter';
// The shell's one status region, and the words the editor's keys say in it (the editor's transport's own, WORDS).
const STATUS = '[role=status]';
const said = async (page) => (await page.locator(STATUS).textContent()) ?? '';
const SKIPPED_TO_START = 'Skipped to start';
const SKIPPED_TO_END = 'Skipped to end';
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
const focusOn = (page, sel) => page.evaluate((s) => !!document.activeElement?.matches(s), sel);
// True if the status region does not say `words` within `ms`: a second action a key must not also run (a message
// waiting behind another shows when the first's hold ends, about 2 s).
const neverSays = (page, words, ms = 3000) => page.waitForFunction(([s, w]) => document.querySelector(s)?.textContent === w, [STATUS, words], { timeout: ms }).then(() => false, () => true);
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
const NOT_A_PROJECT = 'This file is not a Route Plotter project, or it is damaged. Nothing was opened.';
// (No import statement: the run's loader would make this file CommonJS. Node's own modules are reached by
// `process.getBuiltinModule`, jszip through a require made at the repository's root (the run's A11Y_ROOT, else the
// working folder); both only when a journey asks for the file.)
// With `png` (bytes), the golden gains one image as io names it (format.ts): the record { id, type } in project.json's
// `images`, and its bytes at `images/1.png` in the ZIP; nothing else changes.
const projectFile = async (png) => {
  const root = process.env.A11Y_ROOT || process.cwd();
  const zip = new (process.getBuiltinModule('node:module').createRequire(`${root}/package.json`)('jszip'))();
  const golden = process.getBuiltinModule('node:fs').readFileSync(`${root}/src/editor/shell/goldens/two-stops.project.json`, 'utf8');
  if (!png) zip.file('project.json', golden);
  else {
    if (!golden.endsWith('"images":[]}')) throw new Error('the golden no longer ends with its empty images list');
    zip.file('project.json', golden.replace(/"images":\[\]}$/, '"images":[{"id":"golden-5","type":"image/png"}]}'));
    zip.file('images/1.png', png, { createFolders: false }); // as io's Save: no `images/` folder entry, which io refuses
  }
  return { name: png ? 'with-image.zip' : 'two-stops.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) };
};
// A real PNG, 4 by 4, made by the page's own canvas (`toBlob`) in the run.
const canvasPng = async (page) => Buffer.from(await page.evaluate(() => new Promise((resolve) => {
  const c = Object.assign(document.createElement('canvas'), { width: 4, height: 4 });
  const g = c.getContext('2d'); g.fillStyle = '#003a65'; g.fillRect(0, 0, 4, 4);
  c.toBlob(async (b) => resolve([...new Uint8Array(await b.arrayBuffer())]), 'image/png');
})));
// A PNG header and nothing more: the signature and a whole IHDR chunk (4 by 4, its check value right), so io reads its
// size and only the browser's decoder can find it damaged.
const headerOnlyPng = () => {
  const ihdr = Buffer.from([0x49, 0x48, 0x44, 0x52, 0, 0, 0, 4, 0, 0, 0, 4, 8, 6, 0, 0, 0]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(process.getBuiltinModule('node:zlib').crc32(ihdr));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), ihdr, crc]);
};
// io's words for an image that does not decode (words.ts, openedInvalid, with images.ts's problem).
const NOT_SHOWN = 'This project could not be opened, because some of it is outside what Route Plotter allows (images[0]: expected a PNG image that can be shown, found a damaged image). Nothing was opened.';
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
// a press of the button, focus put back on it and the key pressed: "Playing animation" said (it waits behind "Project
// opened"), focus still on the button and no file chooser opened by the key; L then moves the position on, and J, from
// the middle (a press on the timeline's track first), plays back into the start and stops there: "Animation
// complete", the position 0. (FINDING-78's crash of J after a press, Carbon's late echo, is mended: brief 79.)
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
  await page.keyboard.press(key);
  if (!(await comesToWords(page, PLAYING))) return false;
  // L moves on; J, from the middle, stands short of it and above 0 when "Playing animation" is said, and ends at 0.
  const moved = key === 'l' ? await comesTo(page, 'n > 0') : (await atNow(page)).now > 0 && (await atNow(page)).now <= 510 && (await comesToWords(page, COMPLETE)) && (await atNow(page)).now === 0;
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
// What Help shows, as reviewed: its close button, heading, the two groups of the key table and the switch. The chords
// read Cmd on a Mac and Ctrl elsewhere; a punctuation key is read by its name (comma, full stop, less than, greater
// than, question mark). Carbon's "Close" tooltip, shown while Close has focus, is not listed. Behind
// it, the play bar's Play stays disabled (a stated node, so listed).
const helpOpen = (checked) => [
  '- group "Playback":',
  '  - button "Play" [disabled]',
  '- dialog "Help":',
  '  - button "Close"',
  '  - heading "Help" [level=2]',
  '  - table "Playback":',
  '    - caption: Playback',
  '    - rowgroup:',
  '      - row "Play/pause Space K"',
  '      - row "Play reverse J"',
  '      - row "Play forward L"',
  '      - row "Skip to start Home comma less than"',
  '      - row "Skip to end End full stop greater than"',
  '  - table "General":',
  '    - caption: General',
  '    - rowgroup:',
  '      - row /Undo (Cmd|Ctrl)\\+Z/',
  '      - row /Redo (Cmd|Ctrl)\\+Shift\\+Z/',
  '      - row "Open help question mark"',
  `  - switch "Single-key shortcuts"${checked ? ' [checked]' : ''}`,
  '  - paragraph: Turned off, K, J, L, comma, <, full stop, > and ? do nothing. Space, Home, End, Undo and Redo keep working.',
].join('\n');
// The processes the shell presents (CONF03): none. A process is a series of steps toward a goal inside the app; the
// shell has no form and no link to another of the app's pages, and its one link leaves Route Plotter for a page it does
// not own, which is no step of a Route Plotter process and is not tested here. The item that adds a process names it
// here and writes the journey that runs every step.
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
const progressLink = (page) => page.getByRole('link', { name: 'GitHub' });
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
      setup: settled,
      snapshot: [
        '- banner "Route Plotter":',
        '  - heading "Route Plotter" [level=1]',
        '  - button "Open project"',
        '  - button "Help"',
        '- main:',
        '  - paragraph:',
        '    - text: Version 4 is being built here. It cannot make anything yet. Its progress is on',
        '    - link "GitHub":',
        `      - /url: ${PROGRESS}`,
        '    - text: .',
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
        { name: 'focus the progress link', run: async ({ page }) => { await progressLink(page).focus(); } },
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
        content: ['h1', 'main p', REASON],
        functions: [
          { name: 'follow the progress link', run: async ({ page }) => { await progressLink(page).click(); return arrives(page, PROGRESS); } },
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
      // by it (2.4.12, focus). A focus walk at 320 px is owed (Codex on brief 81, to a later tests chat). The name breaks
      // anywhere (frameLook.css).
      name: 'refused-long-name',
      path: '/',
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
        '  - paragraph:',
        '    - text: Version 4 is being built here. It cannot make anything yet. Its progress is on',
        '    - link "GitHub":',
        `      - /url: ${PROGRESS}`,
        '    - text: .',
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
        ],
      },
    },
    // { name: 'home', path: '/', snapshot: '- main:\n  - heading "Home" [level=1]', dialogs: [{ name: 'help', opener: '#help' }],
    //   interactions: [{ name: 'open menu', run: async ({ page }) => page.getByRole('button', { name: 'Menu' }).click(), snapshot: '- button "Menu" [expanded]' }],
    //   keeps: { content: ['h1', '#total'], cues: ['#saved-icon'], functions: [{ name: 'save', run: async ({ page }) => { await page.getByRole('button', { name: 'Save' }).click(); return page.getByRole('status').isVisible(); } }] } },
  ],
  // Keyboard functions run at no delay and with long gaps between keys: steps of { focus }, { press } or { type }.
  keyboardFunctions: [
    // Enter on the focused link follows it: the editor's keys never take a link's own activation.
    { name: 'follow-progress-link', state: 'shell', steps: [{ focus: 'main a[href]' }, { press: 'Enter' }], check: async ({ page }) => arrives(page, PROGRESS) },
    // The editor's keys, each checked by the words it says in the status region.
    { name: 'skip-to-start-by-home', state: 'shell', steps: [{ press: 'Home' }], check: async ({ page }) => (await said(page)) === SKIPPED_TO_START },
    { name: 'skip-to-end-by-end', state: 'shell', steps: [{ press: 'End' }], check: async ({ page }) => (await said(page)) === SKIPPED_TO_END },
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
      // in it, and focus returns to "Help" when it closes: from where focus lands, one Escape; from "Close", whose
      // Carbon tooltip shows while it has focus, the first Escape hides the tooltip (1.4.13's dismissal) and the second
      // closes Help (D186). A further control that opens content needs its own check. The play bar's reason line is read
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
          await page.keyboard.press('Shift+Tab');
          const onClose = await focusIs(page, '.cds--modal-close');
          await page.keyboard.press('Escape');
          const tipFirst = onClose && (await helpDialog(page).isVisible()) && !(await page.getByRole('tooltip', { name: 'Close' }).isVisible());
          await page.keyboard.press('Escape');
          if (!onClose) focus.push('Shift+Tab from where focus landed did not reach "Close"');
          else if (!tipFirst) focus.push('on "Close", the first Escape did not hide its tooltip alone');
          if (!(await backOnHelp(page))) focus.push('focus did not return to "Help" when a second Escape on "Close" closed it');
        }
        record('2.4.3', !focus.length, focus.length ? focus.join('; ') : `Tab meets the ${order.length} reviewed control(s) in order, top to bottom (${order.join(', ')}); "Help" opens its dialog with focus inside, Tab and Shift+Tab keep it there, and it returns to "Help" on Escape: one from where focus lands or from the switch; on "Close", the first hides its tooltip and the second closes (D186)`);
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
      // nothing, and a whole press acts, on the up-event: the progress link (followed), "Help" (its dialog opens) and,
      // inside Help, the switch (it turns). A press on the switch is moved off to a point inside the dialog, as a press
      // outside Help closes it. The play bar: each skip says its words on a whole press and nothing before; Play,
      // disabled with nothing to play, does nothing on any press. The timeline, a slider, does move on the down-event, as
      // a provisional scrub: Escape before the release aborts it (the position back where the press found it, focus
      // kept, and the moves and release after it change nothing), and the release completes it with no undo step.
      // 2.5.7: its one drag, the thumb along the track, has a single-pointer alternative with the same result: a drag of
      // the thumb completed at 70 % of the track, then, on a fresh page, a whole press on the track at the same point,
      // the two positions compared. Every press goes through the pointer adapter, so a touch run can credit it. "Open project"
      // (stage 6) opens the browser's file chooser on a whole press only, none on the down-event or on a press moved
      // off. Any other control needs its own journey.
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
        record('2.5.7', slid && !problems.some((p) => p.startsWith('slider')), slid ? `the one drag, the timeline's thumb along its track, has a single-pointer alternative with the same result: ${compared}` : problems.find((p) => p.startsWith('slider')) ?? 'the timeline was not met');
        record('2.5.2', !problems.length && done.length > 0 && slid, problems.length ? problems.join('; ') : done.length && slid ? `${done.length} button(s), link(s) and switch(es) do nothing on the down-event or on a press moved off before release, and, where enabled, act on a whole press, on the up-event: ${done.join(', ')}; the slider, ${slider.join(', ')}, moves on the down-event as a provisional scrub, which Escape aborts before the release (abort before completion) and the release completes, with no undo step` : 'no control to press, or the timeline not met');
      },
    },
    {
      // 1.4.13: the page's two pieces of content shown on hover or focus, both Carbon's tooltips: Help's "Close" (its
      // close button's) and the timeline's thumb (the value words, "0:00 of 0:02"). Each is shown both ways, by focus
      // and by the pointer resting on it. Shown is measured on the tooltip's content as drawn (a box, shown, its exact
      // words); hidden on the content's box alone (not drawn, whatever its words); the opposite state measured first.
      // Dismissible: one Escape hides it with the pointer unmoved, focus where it was and nothing else changed (Help
      // still open, D186; the timeline where it was); one case apart, Close shown by hover with focus elsewhere in Help,
      // where Carbon's Modal and Tooltip both hear Escape on the document and one Escape closes Help (ruled with D195):
      // that tooltip is held to 1.4.13's exception, content that obscures nothing, measured at the run's width and at
      // 320 px: its box and caret meet no words outside it and no control or image but Close, where they show, judged
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
            // Shift+Tab from the content's start reaches Close (the kit's Dialog).
            focus: async () => { await page.keyboard.press('Shift+Tab'); },
            kept: async () => String(await helpDialog(page).isVisible()),
          },
          {
            name: 'the timeline', trigger: TIMELINE, words: '',
            setup: async () => { await open('shell'); await page.mouse.move(OFF.x, OFF.y); },
            focus: async () => { await page.locator(TIMELINE).focus(); },
            kept: async () => String((await atNow(page)).now),
          },
        ];
        const problems = [], done = [];
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
          await page.keyboard.press('Escape');
          await rest(400);
          if (!(await hidden(t.trigger))) bad('shown by focus: still shown after one Escape (dismissible)');
          if ((await focused()) !== who) bad(`shown by focus: Escape moved focus from ${who} to ${await focused()}`);
          if ((await t.kept()) !== kept) bad(`shown by focus: Escape changed what it must not (${kept} to ${await t.kept()})`);
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
        record('1.4.13', !problems.length, problems.length ? problems.join('; ') : `${done.join(' and ')}: each shown by focus and by hover, and kept, shown either way, while the pointer moves onto it and rests; held past every delay; its content no longer drawn once the focus or the pointer goes; each hidden by one Escape with the pointer unmoved, focus kept and nothing else changed, except Close shown by hover, which obscures no words and no other control where they are painted (two pictures of each overlap, the tooltip unpainted, with and without the words' parent or the control, equal; the page still under it; the state left as found), at the run's width and at 320 px (the exception), one Escape there closing Help with focus back on "Help"`);
      },
    },
    {
      // 3.3.5: the shell's two fields. The timeline asks for no text: its help is its visible label, tied to it, and the
      // two times at its ends. The switch for single-key shortcuts in Help (drawn only while Help is open)
      // has its help: the sentence under it, visible once Help is open and tied to it by aria-describedby, so it is
      // read with the switch. A further field needs its own check here. The play bar's Play, disabled with nothing to
      // play, has its reason: the line under the group, visible, tied to it by aria-describedby and not in its name
      // (UI-06 J-21). 4.1.3: the shell's one status region, role status, is empty
      // and nothing changes in the 2 s after the shell loads; a real key (Home, with the progress link focused) raises
      // the editor's message in it, and focus stays on the link. A further status region needs its own check here.
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
        await progressLink(page).focus();
        await page.keyboard.press('Home');
        const words = await said(page);
        const focusStays = await page.evaluate((href) => document.activeElement?.getAttribute('href') === href, PROGRESS);
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
          !focusStays && 'focus left the progress link when Home raised the message',
        ].filter(Boolean);
        record('4.1.3', !problems.length, problems.length ? problems.join('; ') : `one status region, role status, empty at rest; nothing changes in the 2 s after the shell loads; Home, pressed on the focused progress link, says "${SKIPPED_TO_START}" in it and focus stays on the link; "Skip to start" and "Skip to end", pressed, say "${SKIPPED_TO_START}" and "${SKIPPED_TO_END}" in it with focus kept on each`);
      },
    },
    {
      // 2.1.4, both ways: as the page opens, single-key shortcuts are on and comma says "Skipped to start". Their switch
      // in Help, turned off by the keyboard, turns them off: J, K, L, comma, full stop, <, > and ? pressed on the page
      // and on the focused progress link and "Skip to start" then say nothing, open nothing and follow nothing, while Home still speaks
      // (the listener was live throughout), on the focused "Skip to start" too. Turned on again, full stop says "Skipped
      // to end" and K the reason there is nothing to play.
      name: 'character-key-shortcuts',
      method: 'keyboard',
      rows: ['2.1.4'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const start = page.url();
        const problems = [];
        await page.keyboard.press(',');
        if ((await said(page)) !== SKIPPED_TO_START) problems.push(`with the switch on, comma said ${JSON.stringify(await said(page))}, not ${JSON.stringify(SKIPPED_TO_START)}`);
        const off = await flipByKeyboard(page);
        if (off.before !== 'true') problems.push('the switch was not on as the page opened');
        if (off.after !== 'false') problems.push('Space on the switch did not turn it off');
        if (!off.back) problems.push('focus did not come back to "Help" after turning the switch off');
        if (!(await quiet(page))) problems.push('the status region did not empty');
        for (const where of ['the page', 'the focused progress link', 'the focused "Skip to start"', 'the focused timeline']) {
          if (where === 'the page') await page.locator('header h1').click();
          else if (where === 'the focused progress link') await progressLink(page).focus();
          else if (where === 'the focused timeline') await page.locator(TIMELINE).focus();
          else await page.locator(SKIP_START).focus();
          for (const key of SINGLE_KEYS) {
            await page.keyboard.press(key);
            const words = await said(page);
            if (words) problems.push(`with the switch off, ${key} on ${where} said ${JSON.stringify(words)}`);
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
        await page.keyboard.press('.');
        if ((await said(page)) !== SKIPPED_TO_END) problems.push(`with the switch on again, full stop said ${JSON.stringify(await said(page))}, not ${JSON.stringify(SKIPPED_TO_END)}`);
        if (!(await quiet(page))) problems.push('the status region did not empty');
        await page.keyboard.press('k');
        if ((await said(page)) !== NOTHING_TO_PLAY) problems.push(`with the switch on again, K said ${JSON.stringify(await said(page))}, not ${JSON.stringify(NOTHING_TO_PLAY)}`);
        record('2.1.4', !problems.length, problems.length ? problems.join('; ') : `single-key shortcuts can be turned off (D183): on as the page opens, comma says "${SKIPPED_TO_START}"; with their switch in Help turned off by the keyboard, ${SINGLE_KEYS.join(' ')} pressed on the page, on the focused progress link and on the focused "Skip to start" say, open and follow nothing while Home still says "${SKIPPED_TO_START}"; turned on again, full stop says "${SKIPPED_TO_END}"`);
      },
    },
    {
      // With real key events: 2.4.3, Tab meets the reviewed controls in order; 3.2.2, the shell's one setting, the switch
      // in Help, turned off and on by Space changes no context (same page, no new window, Help still open, focus still on
      // the switch); 3.2.5, left
      // alone for 3 s nothing changes context, nothing refreshes the page and no link opens another window, so the one
      // change comes on request; P06, the shell's one task, following the progress link, runs by Tab and Enter and Back
      // recovers the shell (the destination stood in, not tested); CONF03, the shell presents no process (PROCESSES).
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
        let reached = false;
        for (let i = 0; i < 20 && !reached; i++) { await tab(); reached = await page.evaluate((href) => document.activeElement?.getAttribute('href') === href, PROGRESS); }
        if (reached) await page.keyboard.press('Enter');
        const arrived = reached && await arrives(page, PROGRESS);
        let restored = false;
        if (arrived) { await page.goBack(); restored = page.url() === start && await page.getByRole('heading', { level: 1, name: 'Route Plotter' }).isVisible(); }
        const change = [!idle && 'the context changed while the shell was left alone', refresh && 'a meta refresh', windows && `${windows} link(s) or form(s) open another window`, !arrived && 'Enter on the progress link did not follow it'].filter(Boolean);
        record('3.2.5', !change.length, change.length ? change.join('; ') : 'left alone for 3 s nothing changed context; no refresh and no link opening another window; the one change came on Enter');
        record('P06', arrived && restored, !reached ? 'Tab did not reach the progress link' : !arrived ? 'Enter on the progress link did not follow it' : !restored ? 'Back did not bring the shell back' : 'the shell\'s one task, following the progress link, runs by Tab and Enter, and Back recovers the shell (the destination, GitHub\'s page, stood in locally and not tested)');
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
      // gone; Play pressed plays from 0, the position rising. Criterion 3's open half on the page.
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
        if (from !== 0) wrong.push(`the position before Play was ${from}, not 0`);
        if (!(last > 0) || backwards(played).length) wrong.push(`after Play the position went ${played.map(([, v]) => v).join(', ')}, not rising from 0`);
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `"${OPENED}" said once and nothing else, no alert, focus kept on "Open project", the reason line gone; Play played from 0 to ${last} thousandths in 30 frames`);
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
        // resume from 30 that lands on 700, a restart that begins at 300 ms (50), fail.
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
          return [...(v1 > from + 10 ? [`its first move was to ${v1}`] : []), ...s.slice(i + 1).filter(([t, v]) => v > v1 + Math.ceil((t - t1) / 6) + 10).map(([t, v]) => `${v} at ${Math.round(t - t1)} ms after ${v1}`)];
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
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `by the pointer on the one button: Play, "${PLAYING}", named "Pause", rising; Pause, "${PAUSED}", named "Play", standing at ${stood} over thirty frames; Play again from ${stood}, no further than the playing allows; left to run, "${COMPLETE}" once at 1000; said ${JSON.stringify(expected)} and nothing else; Play at the end played from the start, no further than the playing allows`);
      },
    },
    {
      // 4.1.3 (stage 6, brief 81's step 4): while an open is under way Open draws one line, "Opening <name>…", in
      // Carbon's live region made polite (Open.tsx, point 4), gone by the time "Project opened" is said (the two may
      // come in one batch, so not "before"). A MutationObserver
      // set on the page before the choice records every text holding "Opening", with its nearest aria-live, and whether
      // it was still there at a moment the status region said "Project opened"; no timed wait in the page and no slowed
      // read (io's read is async, so the line is drawn before it ends, the golden as it is). Carbon's nested assertive
      // region (its spinner's "loading", A11Y-03) is recorded, not failed.
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
            for (const e of lines) window.__opening.push({ text: e.textContent, live: e.closest('[aria-live]')?.getAttribute('aria-live') ?? null, inner: [...(e.closest('[aria-live]')?.querySelectorAll('[aria-live]') ?? [])].map((n) => n.getAttribute('aria-live')), said });
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
        if (await page.locator('main').getByText('Opening', { exact: false }).count()) wrong.push('the line is still there after the open');
        const inner = [...new Set(line.flatMap((s) => s.inner))];
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `"${words}" seen in a polite region while the open was under way (Carbon's nested regions: ${JSON.stringify(inner)}, recorded), gone by the time "${OPENED}" was said`);
      },
    },
    {
      // 4.1.3 and DEF-67 (stage 6): a project opened while another plays: the status region never says "Animation
      // paused", says "Project opened", and the position is back at 0 with nothing playing.
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
        if (still.some(([, v]) => v !== 0)) wrong.push(`the position went ${still.map(([, v]) => v).join(', ')}, not held at 0`);
        if ((await playLabel(page)) !== 'Play') wrong.push(`the play button reads "${await playLabel(page)}", not "Play"`);
        record('4.1.3', !wrong.length, wrong.length ? wrong.join('; ') : `opened over a playing: "${OPENED}" said, "${PAUSED}" never (the region said ${JSON.stringify(texts)}), the position at 0 for 20 frames, Play offered`);
      },
    },
    {
      // 4.1.3 (stage 6): a file that is no project is refused by one alert (role alert, said by itself), titled with the
      // file's name and holding io's sentence whole, the status region saying nothing; focus stays on "Open project"
      // and the play bar is as it was. After Close the same file chosen again is a new choice, refused again.
      name: 'refused-not-a-project',
      method: 'j-forms',
      rows: ['4.1.3'],
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
