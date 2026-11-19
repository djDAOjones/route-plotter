// The project's own declarations for the accessibility gate (V31-A11Y): its UI states, dialogs, keyboard functions
// and authored journeys, its server and the source the lint step reads. The pack writes this starter once and never
// overwrites it. Features live in project/a11y/coverage.json, not here. A state with no reviewed ARIA snapshot fails
// its snapshot test; an applicable row no journey claims fails its "not written" test.
//
// Route Plotter v4 (STACK-03): one state, the shell STACK-02 left, with the one link that gives its focus test a
// control. Each journey below checks what the shell has now, against the reviewed sequences under it, and fails as
// soon as the shell gains what it cannot yet check (a field, a setting, a status region, content a control opens, a
// control other than a link): the item that adds one writes its journey here, in the same pull request.

const ORIGIN = 'http://127.0.0.1:4173';
// The reviewed sequences: the text blocks a reader meets, in order (1.3.2); the controls Tab reaches, in order
// (2.4.3); each route and its title (2.4.2); the one place the shell links to. A change to the shell is reviewed here.
const READING = ['Route Plotter', 'Version 4 is being built here.'];
const FOCUS = ['link "GitHub"'];
const ROUTES = [{ path: '/', title: 'Route Plotter' }];
const PROGRESS = 'https://github.com/djDAOjones/route-plotter';
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
      ].join('\n'),
      interactions: [{ name: 'focus the progress link', run: async ({ page }) => { await progressLink(page).focus(); } }],
      keeps: {
        content: ['h1', 'main p'],
        functions: [{ name: 'follow the progress link', run: async ({ page }) => { await progressLink(page).click(); return arrives(page, PROGRESS); } }],
      },
    },
    // { name: 'home', path: '/', snapshot: '- main:\n  - heading "Home" [level=1]', dialogs: [{ name: 'help', opener: '#help' }],
    //   interactions: [{ name: 'open menu', run: async ({ page }) => page.getByRole('button', { name: 'Menu' }).click(), snapshot: '- button "Menu" [expanded]' }],
    //   keeps: { content: ['h1', '#total'], cues: ['#saved-icon'], functions: [{ name: 'save', run: async ({ page }) => { await page.getByRole('button', { name: 'Save' }).click(); return page.getByRole('status').isVisible(); } }] } },
  ],
  // Keyboard functions run at no delay and with long gaps between keys: steps of { focus }, { press } or { type }.
  keyboardFunctions: [
    { name: 'follow-progress-link', state: 'shell', steps: [{ focus: 'main a[href]' }, { press: 'Enter' }], check: async ({ page }) => arrives(page, PROGRESS) },
    // { name: 'set-hold', state: 'home', steps: [{ focus: '#hold' }, { press: 'Meta+A' }, { type: '11' }, { press: 'Enter' }], check: async ({ page }) => (await page.locator('#hold').inputValue()) === '11' },
  ],
  // Authored journeys: a name, a catalogue method (j-* or keyboard), the rows it claims, and run({ page, expect, open, record }).
  journeys: [
    {
      // 1.3.2: the text blocks, in reading order, match the reviewed sequence and run top to bottom on screen. 2.4.3:
      // Tab meets the reviewed controls in order, top to bottom, and no control opens content (that needs its own
      // journey: focus moves into what opens and returns when it closes).
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
        if (opens) focus.push(`${opens} control(s) open content: write the journey that opens each, checks focus moves in, and returns it on close`);
        record('2.4.3', !focus.length, focus.length ? focus.join('; ') : `Tab meets the ${order.length} reviewed control(s) in order, top to bottom (${order.join(', ')}); no control opens content`);
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
      // whole press acts, on the up-event. Only links are known here; any other control needs its own journey.
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
          if (!href) { problems.push(`${name} is not a link: write its pointer journey (what its up-event does, and how a press is abandoned)`); continue; }
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
          await pointer.down(x, y);
          await page.waitForTimeout(250);
          if (page.url() !== start) { problems.push(`${name} acted on the down-event`); continue; }
          await pointer.move(off.x, off.y);
          await pointer.up();
          await page.waitForTimeout(400);
          if (page.url() !== start) { problems.push(`${name}: a press moved off it before release still acted`); continue; }
          await pointer.down(x, y);
          await pointer.up();
          const target = new URL(href, start).href;
          if (!(await arrives(page, target))) problems.push(`${name}: a whole press did not follow it to ${target} (at ${page.url()})`);
          else done.push(name);
        }
        record('2.5.2', !problems.length && done.length > 0, problems.length ? problems.join('; ') : done.length ? `${done.length} control(s) do nothing on the down-event or on a press moved off before release, and act on a whole press: ${done.join(', ')}` : 'no control to press');
      },
    },
    {
      // 3.3.5: no field takes input, so none needs help. 4.1.3: the shell raises no status message: nothing changes
      // after it loads, and it holds no status region. A field or a status region needs its own journey.
      name: 'fields-and-status',
      method: 'j-forms',
      rows: ['3.3.5', '4.1.3'],
      run: async ({ page, open, record }) => {
        await open('shell');
        const fields = await page.locator(FIELDS).count();
        record('3.3.5', fields === 0, fields ? `${fields} field(s) take input: write the journey that reaches each one's help` : 'no field in the shell takes input, so none needs help');
        const live = await page.locator(LIVE).count();
        const changes = await page.evaluate(() => new Promise((done) => {
          let n = 0;
          const watch = new MutationObserver((list) => { n += list.length; });
          watch.observe(document.body, { subtree: true, childList: true, characterData: true });
          setTimeout(() => { watch.disconnect(); done(n); }, 2000);
        }));
        record('4.1.3', !live && !changes, live ? `${live} status region(s): write the journey that raises each message and checks its role and that focus stays` : changes ? `the shell changed ${changes} time(s) after it loaded, with no status region` : 'the shell raises no status message: nothing changes in the 2 s after it loads, and it holds no status region');
      },
    },
    {
      // With real key events: 2.4.3, Tab meets the reviewed controls in order; 3.2.2, no setting to change; 3.2.5, left
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
        const settings = await page.locator(FIELDS).count();
        record('3.2.2', settings === 0, settings ? `${settings} setting(s): write the journey that changes each and checks no context changes` : 'no setting in the shell to change, so none changes context');
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
    date: '2026-11-19',
    rows: {
      P09: { state: 'pass', note: 'STACK-03 made the first run, against the shell, its baseline; no shared component or environment has changed since. CORE-05, the editor shell, is a shared-component change and flags a wider run here' },
      P10: { state: 'pass', note: 'no open finding: the first run\'s one product failure, a shell with no control for the focus test, was fixed by its progress link and retested in the same run (STACK-03, pull request #178, which shows both runs); a failure stays a failure until fixed' },
    },
  },
};
