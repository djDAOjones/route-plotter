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

const ORIGIN = 'http://127.0.0.1:4173';
// The reviewed sequences: the text blocks a reader meets, in order (1.3.2); the controls Tab reaches, in order
// (2.4.3); each route and its title (2.4.2); the one place the shell links to. A change to the shell is reviewed here.
const READING = ['Route Plotter', 'Version 4 is being built here.'];
const FOCUS = ['link "GitHub"', 'button "Help"'];
const ROUTES = [{ path: '/', title: 'Route Plotter' }];
const PROGRESS = 'https://github.com/djDAOjones/route-plotter';
// The shell's one status region, and the words the editor's keys say in it (the editor's transport's own, WORDS).
const STATUS = '[role=status]';
const said = async (page) => (await page.locator(STATUS).textContent()) ?? '';
const SKIPPED_TO_START = 'Skipped to start';
const SKIPPED_TO_END = 'Skipped to end';
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
// read Cmd on a Mac and Ctrl elsewhere. Carbon's "Close" tooltip, shown while Close has focus, is not listed.
const helpOpen = (checked) => [
  '- dialog "Help":',
  '  - button "Close"',
  '  - heading "Help" [level=2]',
  '  - table "Playback":',
  '    - caption: Playback',
  '    - rowgroup:',
  '      - row "Play/pause Space K"',
  '      - row "Play reverse J"',
  '      - row "Play forward L"',
  '      - row "Skip to start Home , <"',
  '      - row "Skip to end End . >"',
  '  - table "General":',
  '    - caption: General',
  '    - rowgroup:',
  '      - row /Undo (Cmd|Ctrl)\\+Z/',
  '      - row /Redo (Cmd|Ctrl)\\+Shift\\+Z/',
  '      - row "Open help ?"',
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
// The shell as a reader meets it once it has settled. React draws it after the page's load event, and its bundled IBM
// Plex fonts load only then: on CI's Linux runner, whose fallback font is wider, the link moved 63 px when they arrived,
// after the focus test had measured it (wish STACK-03.6). Each state opens offline and settled: drawn, laid out, and its
// fonts loaded.
async function settled({ page }) {
  await offline({ page });
  await page.locator('main h1').waitFor();
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
        '- main:',
        '  - heading "Route Plotter" [level=1]',
        '  - paragraph:',
        '    - text: Version 4 is being built here. It cannot make anything yet. Its progress is on',
        '    - link "GitHub":',
        `      - /url: ${PROGRESS}`,
        '    - text: .',
        '  - button "Help"',
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
      ],
      keeps: {
        content: ['h1', 'main p'],
        functions: [
          { name: 'follow the progress link', run: async ({ page }) => { await progressLink(page).click(); return arrives(page, PROGRESS); } },
          // Help is closed again after, so the page is left as found (the forced-colours test counts stateful controls next).
          { name: 'open help', run: async ({ page }) => { await helpButton(page).click(); const shown = await helpDialog(page).isVisible(); await page.keyboard.press('Escape'); return shown && backOnHelp(page); } },
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
      // closes Help (D186). A further control that opens content needs its own check.
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
      // 2.5.2: each control does nothing on the down-event, a press moved off it before release does nothing, and a
      // whole press acts, on the up-event: the progress link (followed), "Help" (its dialog opens) and, inside Help, the
      // switch (it turns). A press on the switch is moved off to a point inside the dialog, as a press outside Help
      // closes it. Any other control needs its own journey.
      name: 'pointer-cancellation',
      method: 'j-pointer',
      rows: ['2.5.2'],
      run: async ({ page, open, record, pointer }) => {
        await open('shell');
        const count = await page.locator(CONTROLS).filter({ visible: true }).count();
        const problems = [], done = [];
        for (let i = 0; i < count; i++) {
          await open('shell');
          const control = page.locator(CONTROLS).filter({ visible: true }).nth(i);
          const name = await named(control);
          const href = await control.getAttribute('href');
          const isHelp = await control.evaluate((e, s) => e.matches(s), HELP);
          if (!href && !isHelp) { problems.push(`${name} is neither a link nor "Help": write its pointer journey (what its up-event does, and how a press is abandoned)`); continue; }
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
          const acted = async () => page.url() !== start || (await helpDialog(page).isVisible());
          await pointer.down(x, y);
          await page.waitForTimeout(250);
          if (await acted()) { problems.push(`${name} acted on the down-event`); continue; }
          await pointer.move(off.x, off.y);
          await pointer.up();
          await page.waitForTimeout(400);
          if (await acted()) { problems.push(`${name}: a press moved off it before release still acted`); continue; }
          await pointer.down(x, y);
          await pointer.up();
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
        record('2.5.2', !problems.length && done.length > 0, problems.length ? problems.join('; ') : done.length ? `${done.length} control(s) do nothing on the down-event or on a press moved off before release, and act on a whole press: ${done.join(', ')}` : 'no control to press');
      },
    },
    {
      // 3.3.5: the shell's one setting, the switch for single-key shortcuts in Help (drawn only while Help is open),
      // has its help: the sentence under it, visible once Help is open and tied to it by aria-describedby, so it is
      // read with the switch. A further field needs its own check here. 4.1.3: the shell's one status region, role status, is empty
      // and nothing changes in the 2 s after the shell loads; a real key (Home, with the progress link focused) raises
      // the editor's message in it, and focus stays on the link. A further status region needs its own check here.
      name: 'fields-and-status',
      method: 'j-forms',
      rows: ['3.3.5', '4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const restFields = await page.locator(FIELDS).count();
        await helpButton(page).click();
        await helpDialog(page).waitFor();
        const fields = restFields + await page.locator(FIELDS).count();
        const onlySwitch = fields === 1 && (await page.locator(FIELDS).first().evaluate((e, s) => e.matches(s), SWITCH));
        const helpText = await singleKeys(page).evaluate((e) => {
          const id = e.getAttribute('aria-describedby'), el = id ? document.getElementById(id) : null;
          return el && el.getBoundingClientRect().height > 0 ? (el.textContent ?? '').trim() : '';
        });
        const fieldProblems = [!onlySwitch && `${fields} field(s); the shell has one, the switch in Help: write the check that reaches each other one's help`, !helpText && 'the switch has no visible help tied to it by aria-describedby'].filter(Boolean);
        record('3.3.5', !fieldProblems.length, fieldProblems.length ? fieldProblems.join('; ') : `the shell's one setting, the switch "Single-key shortcuts" in Help, has its help under it, tied to it and read with it: ${JSON.stringify(helpText)}`);
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
        const problems = [
          (live !== 1 || statuses !== 1) && `${live} live region(s), ${statuses} with role status: the shell has one, role status; write the check for any other`,
          atRest && `the status region shows ${JSON.stringify(atRest)} at rest`,
          changes && `the shell changed ${changes} time(s) in the 2 s after it loaded`,
          words !== SKIPPED_TO_START && `Home said ${JSON.stringify(words)} in the status region, not ${JSON.stringify(SKIPPED_TO_START)}`,
          !focusStays && 'focus left the progress link when Home raised the message',
        ].filter(Boolean);
        record('4.1.3', !problems.length, problems.length ? problems.join('; ') : `one status region, role status, empty at rest; nothing changes in the 2 s after the shell loads; Home, pressed on the focused progress link, says "${SKIPPED_TO_START}" in it and focus stays on the link`);
      },
    },
    {
      // 2.1.4, both ways: as the page opens, single-key shortcuts are on and comma says "Skipped to start". Their switch
      // in Help, turned off by the keyboard, turns them off: J, K, L, comma, full stop, <, > and ? pressed on the page
      // and on the focused progress link then say nothing, open nothing and follow nothing, while Home still speaks
      // (the listener was live throughout). Turned on again, full stop says "Skipped to end".
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
        for (const where of ['the page', 'the focused progress link']) {
          if (where === 'the page') await page.locator('main h1').click();
          else await progressLink(page).focus();
          for (const key of SINGLE_KEYS) {
            await page.keyboard.press(key);
            const words = await said(page);
            if (words) problems.push(`with the switch off, ${key} on ${where} said ${JSON.stringify(words)}`);
            if (await helpDialog(page).isVisible()) { problems.push(`with the switch off, ${key} on ${where} opened Help`); await page.keyboard.press('Escape'); }
            if (page.url() !== start) { problems.push(`${key} on ${where} left the shell for ${page.url()}`); break; }
          }
        }
        await page.keyboard.press('Home');
        if ((await said(page)) !== SKIPPED_TO_START) problems.push('Home said nothing with the switch off: the editor\'s keys were not listened for, so the check proves nothing');
        const on = await flipByKeyboard(page);
        if (on.before !== 'false' || on.after !== 'true') problems.push(`the switch read ${String(on.before)} when Help opened again and ${String(on.after)} after Space, not false then true`);
        if (!on.back) problems.push('focus did not come back to "Help" after turning the switch on');
        if (!(await quiet(page))) problems.push('the status region did not empty');
        await page.keyboard.press('.');
        if ((await said(page)) !== SKIPPED_TO_END) problems.push(`with the switch on again, full stop said ${JSON.stringify(await said(page))}, not ${JSON.stringify(SKIPPED_TO_END)}`);
        record('2.1.4', !problems.length, problems.length ? problems.join('; ') : `single-key shortcuts can be turned off (D183): on as the page opens, comma says "${SKIPPED_TO_START}"; with their switch in Help turned off by the keyboard, ${SINGLE_KEYS.join(' ')} pressed on the page and on the focused progress link say, open and follow nothing while Home still says "${SKIPPED_TO_START}"; turned on again, full stop says "${SKIPPED_TO_END}"`);
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
        const atRest = await page.locator(FIELDS).count();
        await helpButton(page).focus();
        await page.keyboard.press('Enter');
        await helpDialog(page).waitFor();
        const settings = atRest + await page.locator(FIELDS).count();
        if (settings !== 1) context.push(`${settings} setting(s); the shell has one, the switch in Help: write the check for any other`);
        await singleKeys(page).focus();
        for (const want of ['false', 'true']) {
          await page.keyboard.press('Space');
          if ((await singleKeys(page).getAttribute('aria-checked')) !== want) context.push(`Space did not turn the switch to ${want}`);
          if (page.url() !== start || page.context().pages().length !== pages) context.push('turning the switch changed the page or opened a window');
          if (!(await helpDialog(page).isVisible()) || !(await focusIs(page, SWITCH))) context.push('turning the switch closed Help or moved focus');
        }
        record('3.2.2', !context.length, context.length ? context.join('; ') : 'the shell\'s one setting, the switch "Single-key shortcuts" in Help, turned off and on by Space changes no context: same page, no new window, Help still open, focus still on the switch');
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
    date: '2026-11-21',
    rows: {
      P09: { state: 'pass', note: 'STACK-03 made the first run, against the shell, its baseline; no shared component or environment had changed until 2026-11-21. That day CORE-05 began to change the shell, a shared component: one status region and the editor\'s keys, with their journeys broadened in the same change (fields-and-status, character-key-shortcuts, the keyboard functions skip-to-start-by-home and skip-to-end-by-end). Later the same day CORE-05 added Help, the first dialog and the first setting on the shell (the switch for single-key shortcuts, on to begin with), with the journeys that open it broadened in the same change (reading-and-focus-order, pointer-cancellation, fields-and-status, character-key-shortcuts both ways, keyboard-task) and the keyboard functions open-help-by-button, open-help-by-question-mark, close-help-by-escape, single-keys-off and single-keys-on. A wider run (the sampling, npm run a11y:sample) is flagged for when the frame\'s controls are on the page' },
      P10: { state: 'pass', note: 'no open finding: the first run\'s one product failure, a shell with no control for the focus test, was fixed by its progress link and retested in the same run (STACK-03, pull request #178, which shows both runs); a failure stays a failure until fixed' },
    },
  },
};
