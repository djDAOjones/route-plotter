// V31-APP-PACK: Vite for a flagged app (lab/next-v31/app/README.md). No React plugin: Vite's transform reads the
// tsconfig's `jsx`. Relative base, loopback servers on fixed ports, ES2022 output with source maps. Fonts and assets are
// bundled from local packages, none fetched (the house digest, both kinds); the alias lets Carbon's Sass reach IBM Plex's
// font files in node_modules.
//
// STACK-02 (Route Plotter v4) adds three things to the pack's template, each provisional under the owner's overnight
// grant G3:
// - Vitest's settings, the pack's vitest.config.mjs as written there, live here as the `test` block, since the item
//   names vite.config.mjs alone; frozen v3's tests in v3/ are excluded.
// - A second output (the architecture plan's A20): `vite build --mode player` builds src/exported/player.ts into
//   dist/player/player.js, one self-contained script that the HTML export inlines (CORE-10). `npm run build` runs the
//   editor's build, then the player's; both land in dist/, which git ignores.
// - The player's closure check: the player's build fails unless it is one script with no import of its own and no
//   package inside, React and Carbon above all (the plan's §8, rule 6). tests/bundle checks the built file again and
//   plants a React and a Carbon import to show the check fails on them.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/** The packages the exported player may hold: none until a decision lists one (§8, rule 6). */
export const PLAYER_PACKAGES = [];

const PACKAGE = /[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/;

// What a self-contained script never does once built: load code at run time, by `import()` (one the bundler cannot
// resolve, such as `import(/* @vite-ignore */ url)`, stays in the output) or by `require()`, or keep a module statement.
const LOADS = [
  [/\bimport\s*\(/, 'calls import()'],
  [/\brequire\s*\(/, 'calls require()'],
  [/(^|[;}\s])(import|export)\s*[{*\w]/m, 'keeps an import or export statement'],
];

/**
 * Why a player bundle is not one self-contained script free of React and Carbon; empty when it is.
 * @param {Record<string, { type: string, fileName: string, code?: string, imports?: string[], dynamicImports?: string[], moduleIds?: string[] }>} bundle
 * @returns {string[]}
 */
export function playerFindings(bundle) {
  const files = Object.values(bundle);
  const findings = [];
  if (files.length !== 1) findings.push(`${files.length} files (${files.map((file) => file.fileName).join(', ')}), not one`);
  for (const file of files) {
    if (file.type !== 'chunk') {
      findings.push(`${file.fileName} is an asset beside the script`);
      continue;
    }
    for (const id of [...(file.imports ?? []), ...(file.dynamicImports ?? [])]) findings.push(`${file.fileName} imports ${id}`);
    for (const [pattern, words] of LOADS) if (pattern.test(file.code ?? '')) findings.push(`${file.fileName} ${words}`);
    for (const id of file.moduleIds ?? []) {
      const name = PACKAGE.exec(id)?.[1]?.replaceAll('\\', '/');
      if (name !== undefined && !PLAYER_PACKAGES.includes(name)) findings.push(`${file.fileName} holds the package ${name} (${id})`);
    }
  }
  return findings;
}

const playerClosure = () => ({
  name: 'route-plotter:player-closure',
  generateBundle(_options, bundle) {
    const findings = playerFindings(bundle);
    if (findings.length > 0) this.error(`the exported player must be one self-contained script without React or Carbon: ${findings.join('; ')}`);
  },
});

/**
 * The exported player's build: an IIFE library, one file, no source map, nothing copied beside it.
 * @param {{ entry?: string, outDir?: string }} [where]
 */
export function playerConfig({ entry = 'src/exported/player.ts', outDir = 'dist/player' } = {}) {
  return {
    base: './',
    publicDir: false,
    plugins: [playerClosure()],
    build: {
      target: 'es2022',
      outDir,
      emptyOutDir: true,
      sourcemap: false,
      copyPublicDir: false,
      lib: { entry, formats: ['iife'], name: 'RoutePlotterPlayer', fileName: () => 'player.js' },
    },
  };
}

const editor = {
  base: './',
  resolve: { alias: { '~@ibm/plex': fileURLToPath(new URL('./node_modules/@ibm/plex', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
  // The pack's vitest.config.mjs (V31-TEST-FIRST's settings, the test split signed 2026-11-11): the core in Node, no
  // jsdom, forked workers capped at three (repeated as `--maxWorkers=3` in `npm test`), a stray `only` failing the run,
  // no test found failing it, no watch. Advice: spawn Vitest detached and stop it by its process group.
  test: {
    // CORE-03, provisional under grant G3 (its decision entry): the ZIP adapter's tests run here too, in Node, since it
    // touches no page (DOM-free bytes in, bytes out); without them its tests would never run and knip would call it unused.
    // CORE-04, provisional under grant G3 (D127): the renderer's kit, the composer and the features' drawing run here too,
    // in Node, since they touch no page (the draw recorder stands in for a canvas); without them knip calls them unused.
    // CORE-05, provisional under grant G3 (D169): the editor's store and its other page-free logic run here too, in Node,
    // with no jsdom; what needs a page is proved by the accessibility run. Without them its tests would never run.
    include: [
      'src/core/**/*.test.ts',
      'src/adapters/io/**/*.test.ts',
      'src/adapters/render/**/*.test.ts',
      'src/player/**/*.test.ts',
      'src/features/**/*.test.ts',
      'src/editor/**/*.test.ts',
    ],
    exclude: ['v3/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
    pool: 'forks',
    maxWorkers: 3,
    allowOnly: false,
    passWithNoTests: false,
    watch: false,
  },
};

export default defineConfig(({ mode }) => (mode === 'player' ? playerConfig() : editor));
