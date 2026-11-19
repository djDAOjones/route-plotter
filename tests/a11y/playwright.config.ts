// V31-A11Y stage 3: the standard pack's Playwright configuration. Headless Chromium, one worker, no retry; every
// output — the JSON report, attachments and test output — goes to the run folder the command made outside the
// checkout, and snapshots are never updated, so the gate writes nothing in the checkout. Run it through
// `npm run a11y` (tools/a11y-run.mjs), which sets A11Y_RUN_DIR and the project's server. Stage 4's extended command
// adds projects through A11Y_PROJECTS: firefox and webkit re-run the specs for the engines method, and touch runs the
// adaptation and journey specs under Playwright's Pixel 7 descriptor on Chromium; the report maps each project to its
// method through run.json. Keyboard tests go through the helpers' engine-aware Tab: Option+Tab in WebKit on macOS, and
// Firefox launched with every control in its tab order, whatever the Mac's own keyboard setting says. `npm run
// a11y:sample` (tools/a11y-sample.mjs) sets A11Y_SAMPLE, which selects sample.spec.ts alone; no other run selects it.
import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';

const run = process.env.A11Y_RUN_DIR;
if (!run) throw new Error('A11Y_RUN_DIR is unset: run the accessibility gate through `npm run a11y`, which keeps its output outside the checkout');
const server = process.env.A11Y_SERVER ? JSON.parse(process.env.A11Y_SERVER) : null;
// The project's server runs from the project's root, as the project runs it; Playwright would otherwise use this folder.
const root = process.env.A11Y_ROOT || process.cwd();
const declared: { name: string; stands: string }[] = process.env.A11Y_PROJECTS ? JSON.parse(process.env.A11Y_PROJECTS) : [{ name: 'chromium', stands: 'standard' }];
const projects = declared.map((p) => (p.name === 'touch'
  ? { name: 'touch', testMatch: ['adaptation.spec.ts', 'journeys.spec.ts'], use: { ...devices['Pixel 7'], browserName: 'chromium' as const } }
  : p.name === 'firefox'
    ? { name: 'firefox', use: { browserName: 'firefox' as const, launchOptions: { firefoxUserPrefs: { 'accessibility.tabfocus': 7 } } } }
    : { name: p.name, use: { browserName: p.name as 'chromium' | 'webkit' } }));

export default defineConfig({
  testDir: '.',
  testMatch: process.env.A11Y_SAMPLE ? ['sample.spec.ts'] : process.env.A11Y_KNOWN_BAD ? ['known-bad/known-bad.spec.ts'] : ['states.spec.ts', 'keyboard.spec.ts', 'adaptation.spec.ts', 'journeys.spec.ts'],
  outputDir: join(run, 'output'),
  reporter: [['list'], ['json', { outputFile: join(run, 'playwright.json') }]],
  updateSnapshots: 'none',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  use: { baseURL: process.env.A11Y_BASE_URL || undefined, headless: true, viewport: { width: 1280, height: 800 }, trace: 'off', screenshot: 'off', video: 'off' },
  projects,
  webServer: server ? { command: server.command, url: server.url, cwd: root, reuseExistingServer: false, timeout: server.timeout ?? 60_000 } : undefined,
});
