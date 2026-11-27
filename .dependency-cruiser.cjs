// V31-APP-PACK: the boundaries (lab/next-v31/app/README.md). Each area names what it may reach, an allowlist, so a folder
// or module nobody listed is a violation by default. Line 3, signed 2026-10-28 with "core plus adapters": players and
// exported code import only the core — the evaluation in src/core/ plus the adapters in src/adapters/, which import
// neither the editor nor a UI framework — never the editor or a UI framework. "Exported" is the exported artefact's
// code in src/exported/, not the editor's export orchestration. Every rule is transitive, and each area also reaches
// the folder it lives in. The core rule decides the test runner too: src/core/ is Vitest's, the rest the browser's (the
// test split, signed 2026-11-11). The rules prove imports only: no callback isolation, purity, offline operation, size or rendering
// parity. A package's own imports are not followed (doNotFollow), so a package in PACKAGES vouches for itself.
//
// STACK-04 (Route Plotter v4), from the architecture plan's §8 (A7), made under the owner's overnight grant G3 and kept
// by his delegated decision of 27 Nov 2026 (decision 5 of the full-suite decisions, on his word "ideally you just decide
// what is best, but I want the full suite minus promptfoo"; STACK-06), the player's use of the features' model/ and
// draw/ parts recorded as an exception in project/digests/app-opinion.md (STACK-05):
// the pack's core and adapters rules, PACKAGES and the unresolvable rule are kept as written; its player and exported
// rules are replaced by the plan's narrower closure (rules 6 and 7); src/features/ gains the plan's rules 1 to 5, which
// the pack does not have, rule 4 as two entries; and a cycle rule holds the plan's measure M3 at zero. Every rule is proved by a planted
// violation in tests/architecture/fixtures/, which `npm run test:architecture` runs on every v4 change.

// Signed 2026-11-11 (P-boundaries): the packages the four areas may import, none until a project names one here; a package
// added is a recorded decision, since a wrapper around a UI framework is invisible past its own front door. Tests
// in src/core/ import their runners and are outside the core rule.
const PACKAGES = [];

// CORE-03, made under grant G3 (its decision entry) and kept by the owner's delegated decision of 27 Nov 2026 (as
// above): the ZIP library, for the ZIP adapter's save and open. It is
// listed for the adapters alone, never in PACKAGES, which would open it to the core and the features too; the player
// and exported code are still barred from it by NEVER_IN_PLAYER below, whatever any list says.
const ADAPTER_PACKAGES = ['jszip'];

// STACK-04, the plan's §8 rule 6: what the exported player never holds, directly or through another file, whatever
// PACKAGES lists: React, React DOM, Carbon, the ZIP library and the video encoder.
const NEVER_IN_PLAYER = /(^|\/)node_modules\/(react|react-dom|@carbon\/[^/]+|jszip|mediabunny)\//;

// STACK-04, the plan's §8 rule 3: a feature's editor part is React built from the shared kit, so it reaches React and
// Carbon React through the kit (a .tsx file's JSX alone reaches react/jsx-runtime). No other area gains a package.
const EDITOR_PACKAGES = ['react', '@carbon/react'];

const literal = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const packages = (names) => (names.length > 0 ? [`(^|/)node_modules/(${names.map(literal).join('|')})/`] : []);
const ok = (...folders) => [`^src/(${folders.join('|')})/`, ...packages(PACKAGES)];
const TESTS = '\\.test\\.tsx?$';

// The renderer's kit, a folder or a single module: the one adapter a drawing part and the player may reach.
const RENDER = '^src/adapters/render(/|\\.tsx?$)';
// Rule 6: the player's closure. The core, the renderer's kit, the player itself, the player-safe catalogue and the
// model/ and draw/ parts it lists; of the packages, only those PACKAGES lists that the player may ever hold.
// A feature's draw/overlays.ts is not in it: that file holds the editor's overlays' makers, which only the editor's
// catalogue lists, so neither the player nor exported code may reach one, directly or through another file (DEF-99.1;
// D156, CORE-04 stage 6).
const PLAYER = [
  '^src/(core|player)/',
  RENDER,
  '^src/features/catalogue\\.ts$',
  '^src/features/[^/]+/(model/|draw/(?!overlays\\.ts$))',
  ...packages(PACKAGES.filter((name) => !NEVER_IN_PLAYER.test(`node_modules/${name}/`))),
];

module.exports = {
  forbidden: [
    { name: 'core-reaches-only-core', severity: 'error', comment: 'src/core reaches only itself and the packages listed above: no adapter, interface, editor, player, exported code, other folder or UI framework', from: { path: '^src/core/', pathNot: TESTS }, to: { pathNot: ok('core'), reachable: true } },
    { name: 'adapters-reach-only-core-and-adapters', severity: 'error', comment: 'an adapter reaches only the core and adapters, so it is part of "core plus adapters"', from: { path: '^src/adapters/', pathNot: TESTS }, to: { pathNot: [...ok('core', 'adapters'), ...packages(ADAPTER_PACKAGES)], reachable: true } },
    { name: 'player-reaches-only-its-closure', severity: 'error', comment: "rule 6, replacing the pack's player rule: the player reaches the core, the renderer's kit, itself, the player-safe catalogue and the features' model/ and draw/ parts; never the other adapters (ZIP and assets, storage, video, HTML export), an editor/ part, jszip, mediabunny, React, React DOM or Carbon", from: { path: '^src/player/', pathNot: TESTS }, to: { pathNot: PLAYER, reachable: true } },
    { name: 'exported-reaches-only-the-players-closure', severity: 'error', comment: "rule 7, replacing the pack's exported rule: exported code reaches what rule 6 allows the player, and itself", from: { path: '^src/exported/', pathNot: TESTS }, to: { pathNot: [...PLAYER, '^src/exported/'], reachable: true } },
    { name: 'feature-model-reaches-only-core-and-its-own-model', severity: 'error', comment: "rule 1: a feature's model/ is pure: the core and its own model/, nothing else", from: { path: '^src/features/([^/]+)/model/', pathNot: TESTS }, to: { pathNot: ['^src/core/', '^src/features/$1/model/', ...packages(PACKAGES)], reachable: true } },
    { name: 'feature-draw-reaches-only-core-render-and-its-own-model', severity: 'error', comment: "rule 2: a feature's draw/ reaches the core, the renderer's kit, its own model/ and itself", from: { path: '^src/features/([^/]+)/draw/', pathNot: TESTS }, to: { pathNot: ['^src/core/', RENDER, '^src/features/$1/(model|draw)/', ...packages(PACKAGES)], reachable: true } },
    { name: 'feature-editor-reaches-only-kit-ui-and-its-own-model', severity: 'error', comment: "rule 3: a feature's editor/ reaches the shared control kit, src/ui, its own model/ and itself; never the editor's store or app, its own draw/ or another adapter", from: { path: '^src/features/([^/]+)/editor/', pathNot: TESTS }, to: { pathNot: ['^src/(core|ui|editor/kit)/', '^src/features/$1/(model|editor)/', ...packages([...PACKAGES, ...EDITOR_PACKAGES])], reachable: true } },
    { name: 'no-feature-reaches-another-or-a-catalogue', severity: 'error', comment: 'rule 4: no file in features/<x>, tests included, reaches features/<y> or a catalogue; only the two catalogues import several features', from: { path: '^src/features/([^/]+)/' }, to: { path: ['^src/features/[^/]+/', '^src/features/catalogue(\\.editor)?\\.ts$'], pathNot: '^src/features/$1/', reachable: true } },
    { name: 'only-the-catalogues-import-a-feature', severity: 'error', comment: "rule 4's second half: outside a feature's own folder only the two catalogues import a feature, so adding one touches its folder and a line in each catalogue and nothing else (M1)", from: { pathNot: ['^src/features/[^/]+/', '^src/features/catalogue(\\.editor)?\\.ts$'] }, to: { path: '^src/features/[^/]+/' } },
    { name: 'core-and-adapters-never-reach-features', severity: 'error', comment: 'rule 5: src/core and src/adapters, tests included, never reach src/features', from: { path: '^src/(core|adapters)/' }, to: { path: '^src/features/', reachable: true } },
    { name: 'no-cycles', severity: 'error', comment: "measure M3: v4 keeps v3's zero import cycles", from: {}, to: { circular: true } },
    { name: 'no-unresolvable', severity: 'error', comment: 'an import the cruiser cannot resolve could hide a crossing', from: {}, to: { couldNotResolve: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.mjs'], exportsFields: ['exports'], conditionNames: ['import', 'browser', 'default'] },
  },
};
