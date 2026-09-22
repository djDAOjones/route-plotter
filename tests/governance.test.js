import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));

const directDependencies = {
  // Dev-only accessibility engine, owner-approved 2026-08-27 (REV-05). Never
  // imported by application code; nothing of it reaches the published bundle.
  'axe-core': {
    version: '4.13.0',
    license: 'MPL-2.0',
    source: 'https://github.com/dequelabs/axe-core',
  },
  jszip: {
    version: '3.10.1',
    license: '(MIT OR GPL-3.0-or-later)',
    source: 'https://github.com/Stuk/jszip',
  },
  mediabunny: {
    version: '1.55.3',
    license: 'MPL-2.0',
    source: 'https://github.com/Vanilagy/mediabunny',
  },
  esbuild: {
    version: '0.28.2',
    license: 'MIT',
    source: 'https://github.com/evanw/esbuild',
  },
  jsdom: {
    version: '29.1.1',
    license: 'MIT',
    source: 'https://github.com/jsdom/jsdom',
  },
  vitest: {
    version: '4.1.11',
    license: 'MIT',
    source: 'https://github.com/vitest-dev/vitest',
  },
};

describe('repository governance contract', () => {
  test('first-party code ships the approved MIT terms and private package metadata', () => {
    const license = read('LICENSE');

    expect(packageJson.private).toBe(true);
    expect(packageJson.license).toBe('MIT');
    expect(packageLock.packages[''].license).toBe('MIT');
    expect(license).toMatch(/^MIT License/m);
    expect(license).toContain('Copyright (c) 2026 Joe Bell');
    expect(license).toContain('Permission is hereby granted, free of charge');
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });

  test('notices match every exact direct dependency in the lockfile', () => {
    const notices = read('THIRD_PARTY_NOTICES.md');
    const manifestNames = [
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
    ].sort();

    expect(manifestNames).toEqual(Object.keys(directDependencies).sort());
    for (const [name, expected] of Object.entries(directDependencies)) {
      const locked = packageLock.packages[`node_modules/${name}`];
      expect(locked?.version, `${name} locked version`).toBe(expected.version);
      expect(locked?.license, `${name} locked licence`).toBe(expected.license);
      expect(notices).toContain(`| \`${name}\` | ${expected.version} | \`${expected.license}\` |`);
      expect(notices).toContain(expected.source);
    }

    expect(notices).toMatch(/does not publish a per-release software bill of materials \(SBOM\)/i);
  });

  test('the bundled MPL component names the exact source of the locked version', () => {
    // LEGAL-01: MPL-2.0 code ships minified inside docs/app.js, so the notice
    // has to say where the corresponding source for *that* version lives. A
    // link to the repository homepage drifts the moment a dependency bump
    // lands; pinning it to the locked tag makes the next bump fail here until
    // the notice is updated with it.
    const notices = read('THIRD_PARTY_NOTICES.md');
    const locked = packageLock.packages['node_modules/mediabunny'].version;

    expect(notices).toContain(`https://github.com/Vanilagy/mediabunny/tree/v${locked}`);
    expect(notices).toMatch(/unmodified/i);
  });

  test('the notices and licence are published with the application and linked from it', () => {
    // A notice only the repository browser can see does not reach someone who
    // received the bundled code from the live site.
    const build = read('build.js');
    expect(build).toMatch(/from:\s*'THIRD_PARTY_NOTICES\.md',\s*to:\s*'THIRD_PARTY_NOTICES\.txt'/);
    expect(build).toMatch(/from:\s*'LICENSE',\s*to:\s*'LICENSE\.txt'/);

    const html = read('index.html');
    const link = html.match(/<a href="THIRD_PARTY_NOTICES\.txt"[^>]*>([^<]+)<\/a>/);
    expect(link, 'the Help screen links to the published notices').not.toBeNull();
    // It leaves the editor, so it says so in its visible text (WCAG G201).
    expect(link[0]).toContain('target="_blank"');
    expect(link[0]).toContain('rel="noopener"');
    expect(link[1]).toMatch(/opens in a new tab/i);
  });

  test('security reports use the private GitHub route', () => {
    const security = read('.github/SECURITY.md');

    expect(security).toContain('https://github.com/djDAOjones/route-plotter/security/advisories/new');
    expect(security).toMatch(/Do not disclose .* public issue/is);
    expect(security).toMatch(/No\s+response or remediation timeframe is guaranteed/i);
  });

  test('support uses public Issues on a best-effort basis without an SLA', () => {
    const support = read('.github/SUPPORT.md');

    expect(support).toContain('https://github.com/djDAOjones/route-plotter/issues');
    expect(support).toMatch(/best-effort basis/i);
    expect(support).toMatch(/no\s+guaranteed response time/i);
    expect(support).toContain('https://github.com/djDAOjones/route-plotter/security/advisories/new');
  });
});
