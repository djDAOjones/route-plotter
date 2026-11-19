// STACK-02: the exported player is one self-contained script with no React or Carbon inside (the architecture plan's
// A20 and §8, rule 6). `npm run build` first; then Node's own runner, as `npm run test:bundle` in v4's gate. It reads the
// BUILT output, never source text (TST-11): the editor's bundle must hold React's and Carbon's markers and the player's
// must not, so each marker is shown to find what it looks for. Planted React and Carbon imports show the build's own
// check fails on them.
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { PLAYER_PACKAGES, playerConfig, playerFindings } from '../../vite.config.mjs';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const DIST = join(ROOT, 'dist');
const PLAYER = join(DIST, 'player');

// Text that React, React DOM and Carbon React leave in a production bundle; Carbon's is its class prefix, `cds`, as a
// string of its own.
const MARKERS = {
  React: [/react\.transitional\.element/, /react\.fragment/],
  'React DOM': [/react-dom/, /__reactContainer\$/],
  Carbon: [/[`"']cds[`"']/],
};

const built = () => {
  assert.ok(existsSync(PLAYER), 'dist/player/ is missing: run `npm run build` first');
  return readdirSync(PLAYER);
};

describe('the built exported player', () => {
  test('is one file, player.js, and nothing beside it', () => {
    assert.deepEqual(built(), ['player.js']);
    assert.ok(readFileSync(join(PLAYER, 'player.js'), 'utf8').length > 0);
  });

  test('is self-contained: an IIFE that imports nothing, statically, dynamically or by require', () => {
    built();
    const code = readFileSync(join(PLAYER, 'player.js'), 'utf8');
    assert.match(code, /^var RoutePlotterPlayer=\(?function/);
    assert.doesNotMatch(code, /(^|[;}\s])(import|export)\s*[{*\w]/m);
    assert.doesNotMatch(code, /\bimport\s*\(/);
    assert.doesNotMatch(code, /\brequire\s*\(/);
  });

  test("holds none of React's, React DOM's or Carbon's markers", () => {
    built();
    const code = readFileSync(join(PLAYER, 'player.js'), 'utf8');
    for (const [name, markers] of Object.entries(MARKERS)) {
      for (const marker of markers) assert.doesNotMatch(code, marker, `the player holds ${name}'s marker ${marker}`);
    }
  });

  test("the editor's bundle does hold each marker, so the markers find what they look for", () => {
    built();
    const assets = join(DIST, 'assets');
    const code = readdirSync(assets).filter((name) => name.endsWith('.js')).map((name) => readFileSync(join(assets, name), 'utf8')).join('\n');
    for (const [name, markers] of Object.entries(MARKERS)) {
      for (const marker of markers) assert.match(code, marker, `the editor's bundle lacks ${name}'s marker ${marker}`);
    }
  });
});

describe("the player's build check", () => {
  const chunk = (moduleIds, more = {}) => ({ type: 'chunk', fileName: 'player.js', imports: [], dynamicImports: [], moduleIds, ...more });

  test('lists no package the player may hold', () => {
    assert.deepEqual(PLAYER_PACKAGES, []);
  });

  test('passes one chunk of the core alone', () => {
    assert.deepEqual(playerFindings({ 'player.js': chunk(['/r/src/exported/player.ts', '/r/src/core/model.ts']) }), []);
  });

  test('names React, React DOM and a Carbon package found in the bundle, on either path separator', () => {
    const findings = playerFindings({ 'player.js': chunk([
      '/r/node_modules/react/index.js',
      '/r/node_modules/react-dom/client.js',
      'C:\\r\\node_modules\\@carbon\\react\\es\\index.js',
    ]) });
    assert.equal(findings.length, 3);
    assert.match(findings[0], /holds the package react /);
    assert.match(findings[1], /holds the package react-dom /);
    assert.match(findings[2], /holds the package @carbon\/react /);
  });

  test('refuses a second file, an asset and an import of its own', () => {
    assert.match(playerFindings({ a: chunk([]), b: chunk([], { fileName: 'b.js' }) })[0], /2 files/);
    assert.ok(playerFindings({ a: chunk([]), 'x.css': { type: 'asset', fileName: 'x.css' } }).some((f) => /asset/.test(f)));
    assert.match(playerFindings({ a: chunk([], { dynamicImports: ['lazy.js'] }) })[0], /imports lazy\.js/);
  });

  test('refuses emitted code that loads more at run time, or keeps a module statement', () => {
    const findings = (code) => playerFindings({ a: chunk([], { code }) });
    assert.deepEqual(findings('var P=(function(e){return e.clamp=function(a){return a},e})({});'), []);
    assert.match(findings('var P=(function(e){return e.load=e=>import(e),e})({});')[0], /calls import\(\)/);
    assert.match(findings('var P=require("x");')[0], /calls require\(\)/);
    assert.match(findings('import{a}from"./a.js";var P=a;')[0], /keeps an import or export statement/);
    assert.match(findings('var P=1;export{P};')[0], /keeps an import or export statement/);
  });

  const scratch = mkdtempSync(join(tmpdir(), 'route-plotter-player-'));
  after(() => rmSync(scratch, { recursive: true, force: true }));

  for (const [name, fixture, pattern] of [
    ['React', 'planted-react.mjs', /holds the package react /],
    ['Carbon', 'planted-carbon.mjs', /holds the package @carbon\/react /],
    ['an unresolvable import()', 'planted-dynamic-import.mjs', /calls import\(\)/],
  ]) {
    test(`fails a real player build that imports ${name}`, async () => {
      const outDir = join(scratch, name);
      const config = playerConfig({ entry: join(ROOT, 'tests/bundle/fixtures', fixture), outDir });
      await assert.rejects(build({ ...config, root: ROOT, configFile: false, logLevel: 'silent' }), (error) => {
        assert.match(String(error?.message), pattern);
        return true;
      });
      assert.ok(!existsSync(join(outDir, 'player.js')), `a refused build wrote ${name}'s player`);
    });
  }
});
