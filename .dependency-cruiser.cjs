// V31-APP-PACK: the boundaries (lab/next-v31/app/README.md). Each area names what it may reach, an allowlist, so a folder
// or module nobody listed is a violation by default. Line 3, signed 2026-10-28 with "core plus adapters": players and
// exported code import only the core — the evaluation in src/core/ plus the adapters in src/adapters/, which import
// neither the editor nor a UI framework — never the editor or a UI framework. "Exported" is the exported artefact's
// code in src/exported/, not the editor's export orchestration. Every rule is transitive, and each area also reaches
// the folder it lives in. The core rule decides the test runner too: src/core/ is Vitest's, the rest the browser's (the
// test split, signed 2026-11-11). The rules prove imports only: no callback isolation, purity, offline operation, size or rendering
// parity. A package's own imports are not followed (doNotFollow), so a package in PACKAGES vouches for itself.

// Signed 2026-11-11 (P-boundaries): the packages the four areas may import, none until a project names one here; a package
// added is a recorded decision, since a wrapper around a UI framework is invisible past its own front door. Tests
// in src/core/ import their runners and are outside the core rule.
const PACKAGES = [];

const literal = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ok = (...folders) => [`^src/(${folders.join('|')})/`, ...(PACKAGES.length > 0 ? [`(^|/)node_modules/(${PACKAGES.map(literal).join('|')})/`] : [])];
const TESTS = '\\.test\\.tsx?$';

module.exports = {
  forbidden: [
    { name: 'core-reaches-only-core', severity: 'error', comment: 'src/core reaches only itself and the packages listed above: no adapter, interface, editor, player, exported code, other folder or UI framework', from: { path: '^src/core/', pathNot: TESTS }, to: { pathNot: ok('core'), reachable: true } },
    { name: 'adapters-reach-only-core-and-adapters', severity: 'error', comment: 'an adapter reaches only the core and adapters, so it is part of "core plus adapters"', from: { path: '^src/adapters/', pathNot: TESTS }, to: { pathNot: ok('core', 'adapters'), reachable: true } },
    { name: 'player-reaches-only-core-and-adapters', severity: 'error', comment: 'line 3: the player reaches only the core and adapters', from: { path: '^src/player/', pathNot: TESTS }, to: { pathNot: ok('core', 'adapters', 'player'), reachable: true } },
    { name: 'exported-reaches-only-core-and-adapters', severity: 'error', comment: 'line 3: exported code reaches only the core and adapters', from: { path: '^src/exported/', pathNot: TESTS }, to: { pathNot: ok('core', 'adapters', 'exported'), reachable: true } },
    { name: 'no-unresolvable', severity: 'error', comment: 'an import the cruiser cannot resolve could hide a crossing', from: {}, to: { couldNotResolve: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.mjs'], exportsFields: ['exports'], conditionNames: ['import', 'browser', 'default'] },
  },
};
