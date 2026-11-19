#!/usr/bin/env node
// STACK-04: v4's measures, M1 to M11, from the architecture plan's §10 (A9), provisional under the owner's overnight
// grant G3. `npm run measures` prints the table; in CI, v4's lane appends it to the run's summary, so the owner can read
// it on GitHub without running anything. v3's column is its baselines, counted once and kept below in V3: this script
// never reads v3/ or runs v3, so v3's figures cannot drift and cost nothing per run. It writes nothing in the checkout:
// the dependency graph, the player's build, ESLint and knip all run in memory or print to it.
//
// `--gate-seconds N` gives M9 the time v4's lane took, which CI measures around the lane; without it M9 says so.
// The tests in tests/architecture/ prove each count against planted fixtures, and the player's closure on its build.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * v3's baselines, counted once. Each figure names where it comes from: the abstraction plan's §18
 * (`reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`, measured at 2e4d78e), the v4 plan's §10
 * (`reviews/v4-architecture-plan-2026-11-18.md`), or STACK-04's own count, once, at the tag v3.3.726 (commit c1690c6):
 * M4's mixins from its main.js; M5 in headless Chromium on the tag's built site, after Get started and Preview mode off,
 * two clicks on the canvas, counting the buttons, sliders, check boxes, switches, combo boxes, spin buttons, text boxes,
 * radios, links, menu items, tabs, search boxes and list boxes in its two side panels' accessibility tree; M8's files
 * by their line count; M10 the tag's docs/player.js.
 */
export const V3 = Object.freeze({
  M1: 'n/a: one option touched four modules (abstraction plan §18)',
  M2: 'n/a',
  M3: '0 cycles in 247 edges; 3 upward edges (abstraction plan §18)',
  M4: '18 mixins in one prototype at v3.3.726 (the v4 plan\'s §10 said 16); 115 caller-to-owner mixin pairs (abstraction plan §18)',
  M5: '43 in its two side panels (22 and 21) on a new route of two waypoints, the second selected, at v3.3.726',
  M6: 'two vocabularies (v4 plan §10)',
  M7: 'about 46 dead functions, 3 barrels (abstraction plan §18)',
  M8: '117 functions over 60 lines (abstraction plan §18); 44 of 120 source files over 400 lines at v3.3.726',
  M9: 'about 34 minutes (v4 plan §10: the whole suite on every change)',
  M10: '414.68 KB (abstraction plan §18); 457.51 KB at v3.3.726',
  M11: 'n/a',
});

const posix = (path) => path.split(sep).join('/');
const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
}) : []);
const sourceFiles = (root, pattern = /\.tsx?$/) => walk(join(root, 'src')).filter((path) => pattern.test(path)).map((path) => posix(relative(root, path)));

/**
 * The dependency graph of `src/` under `baseDir`, checked against the gate's own rules (`.dependency-cruiser.cjs`),
 * loaded and run as the `npm run boundaries` command loads and runs them.
 * @param {string} [baseDir]
 */
export async function cruiseWithTheGatesRules(baseDir = ROOT) {
  const { cruise } = await import('dependency-cruiser');
  const { default: extractDepcruiseConfig } = await import('dependency-cruiser/config-utl/extract-depcruise-config');
  const { default: extractTSConfig } = await import('dependency-cruiser/config-utl/extract-ts-config');
  const ruleSet = await extractDepcruiseConfig(join(ROOT, '.dependency-cruiser.cjs'));
  const tsConfig = extractTSConfig(join(ROOT, ruleSet.options.tsConfig.fileName));
  const { output } = await cruise(['src'], { validate: true, ruleSet, baseDir }, {}, { tsConfig });
  return output;
}

/** One line for each rule broken, as the gate reports it, with the target and the files it goes through. */
export const violationLines = (output) => output.summary.violations.map((v) => {
  const steps = (list) => (list ?? []).map((step) => step.name ?? step);
  const route = v.cycle ? ` (cycle ${[v.from, ...steps(v.cycle)].join(' → ')})` : steps(v.via).length > 1 ? ` (via ${steps(v.via).join(' → ')})` : '';
  return `error ${v.rule.name}: ${v.from} → ${v.to}${route}`;
});

// The plan's §8 rule 6 on the built bundle: what the exported player may hold, and what it never holds.
const CLOSURE = [/^src\/(core|player|exported)\//, /^src\/adapters\/render(\/|\.tsx?$)/, /^src\/features\/catalogue\.ts$/, /^src\/features\/[^/]+\/(model|draw)\//];
const NEVER = { react: 'React', 'react-dom': 'React DOM', '@carbon': 'Carbon', jszip: 'jszip', mediabunny: 'mediabunny' };
const PACKAGE = /(?:^|\/)node_modules\/((@[^/]+)\/[^/]+|[^/]+)\//;
const EDITOR_PART = /^src\/(editor|ui)\/|^src\/features\/[^/]+\/editor\//;

/**
 * Why a player bundle's modules leave its closure; empty when they do not.
 * @param {string[]} moduleIds the bundle's module IDs, as its build reports them
 * @param {string} root the folder the build ran in
 */
export function closureFindings(moduleIds, root) {
  // The bundler's own helper, which it adds when it bundles CommonJS: its code, not the project's or a package's.
  const helpers = new Set(['\0rolldown/runtime.js']);
  return moduleIds.filter((id) => !helpers.has(id)).map((id) => (id.startsWith('\0') ? id.slice(1) : posix(relative(root, id)))).flatMap((path) => {
    const pkg = PACKAGE.exec(path);
    if (pkg) return [`holds ${NEVER[pkg[2] ?? pkg[1]] ?? `the package ${pkg[1]}`} (${path})`];
    if (EDITOR_PART.test(path)) return [`reaches an editor part (${path})`];
    return CLOSURE.some((allowed) => allowed.test(path)) ? [] : [`holds a module outside its closure (${path})`];
  });
}

/**
 * The exported player's build, in memory, as `vite build --mode player` makes it.
 * @param {{ root?: string, entry?: string, check?: boolean }} [what] check: false leaves out the build's own check, so
 *   a planted bundle can be read
 */
export async function buildPlayer({ root = ROOT, entry, check = true } = {}) {
  const { build } = await import('vite');
  const { playerConfig } = await import(pathToFileURL(join(ROOT, 'vite.config.mjs')).href);
  const config = playerConfig(entry ? { entry } : {});
  const result = await build({ ...config, plugins: check ? config.plugins : [], root, configFile: false, logLevel: 'silent',
    build: { ...config.build, write: false, emptyOutDir: false } });
  const chunks = (Array.isArray(result) ? result : [result]).flatMap((output) => output.output);
  if (chunks.length !== 1 || chunks[0].type !== 'chunk') throw new Error(`the player's build made ${chunks.length} files, not one script`);
  return { code: chunks[0].code, moduleIds: chunks[0].moduleIds };
}

/** M1: for each feature folder, the files outside it that import it or name it, beside the two catalogues. */
export function featureReach(output, root = ROOT) {
  const dir = join(root, 'src/features');
  const ids = existsSync(dir) ? readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory()) : [];
  const files = sourceFiles(root, /\.(tsx?|mjs|js|scss)$/);
  return ids.map((id) => {
    const inside = `src/features/${id}/`;
    const named = new RegExp(`features/${id}(/|['"])`);
    const reach = new Set();
    for (const module of output.modules) {
      if (module.source.startsWith(inside) || module.coreModule) continue;
      if (module.dependencies.some((dep) => dep.resolved.startsWith(inside))) reach.add(module.source);
    }
    for (const file of files) if (!file.startsWith(inside) && named.test(readFileSync(join(root, file), 'utf8'))) reach.add(file);
    const beyond = [...reach].filter((file) => !/^src\/features\/catalogue(\.editor)?\.ts$/.test(file)).sort();
    return { id, beyond };
  });
}

/** M2: imports from one feature's folder into another's. */
export const featureToFeature = (output) => output.modules.flatMap((module) => {
  const from = /^src\/features\/([^/]+)\//.exec(module.source)?.[1];
  return from ? module.dependencies.filter((dep) => {
    const to = /^src\/features\/([^/]+)\//.exec(dep.resolved)?.[1];
    return to && to !== from;
  }).map((dep) => `${module.source} → ${dep.resolved}`) : [];
});

/** M3: import cycles, and imports the layer rules forbid (an upward or sideways edge). */
export function cyclesAndCrossings(output) {
  const cycles = new Set(), crossings = new Set();
  for (const v of output.summary.violations) {
    if (v.rule.name === 'no-cycles') cycles.add([v.from, ...(v.cycle ?? []).map((step) => step.name ?? step)].sort().join(' '));
    else if (v.rule.name !== 'no-unresolvable') crossings.add(`${v.rule.name}: ${v.from} → ${v.to}`);
  }
  return { cycles: [...cycles], crossings: [...crossings] };
}

/** M4: modules sharing one `this`: a mixin assigned into a prototype, or a prototype member written from outside. */
export const sharedThis = (root = ROOT) => sourceFiles(root).flatMap((file) =>
  [...readFileSync(join(root, file), 'utf8').matchAll(/Object\.assign\(\s*[\w$.]+\.prototype\b|\.prototype\s*(\.[\w$]+|\[[^\]]+\])\s*=(?!=)/g)]
    .map(() => file));

// M6: the glossary's retired words (the plan's §10), as the interface would show them.
const RETIRED = /\b(nodes?|edges?|paths?|guides?|emitters?|flow layers?|waypoints?)\b/gi;
// JSX attributes that are never words a person reads.
const NOT_WORDS = new Set(['className', 'id', 'href', 'src', 'type', 'role', 'key', 'kind', 'size', 'as', 'rel', 'target', 'name',
  'htmlFor', 'lang', 'value', 'align', 'direction', 'orientation', 'tabIndex', 'autoComplete', 'inputMode', 'method', 'action']);

/**
 * M6: every string the interface shows and the retired words in it: JSX text; readable attributes, written as a string
 * or as an expression; and the strings in a child expression, a conditional's branches included. A string inside a
 * nested element is read with that element, so a class name in it stays out.
 */
export async function interfaceWords(root = ROOT) {
  const { default: ts } = await import('typescript');
  const strings = [];
  for (const file of sourceFiles(root, /\.tsx$/)) {
    const source = ts.createSourceFile(file, readFileSync(join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const add = (text) => { if (text.trim()) strings.push({ file, text: text.trim() }); };
    const literals = (node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
      else if (ts.isTemplateExpression(node)) [node.head, ...node.templateSpans.map((span) => span.literal)].forEach((part) => add(part.text));
      ts.forEachChild(node, literals);
    };
    const readable = (attribute) => !NOT_WORDS.has(attribute.name.getText(source)) && !attribute.name.getText(source).startsWith('data-');
    const visit = (node) => {
      if (ts.isJsxText(node)) add(node.text);
      else if (ts.isJsxAttribute(node) && node.initializer && readable(node)) {
        if (ts.isStringLiteral(node.initializer)) add(node.initializer.text);
        else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) literals(node.initializer.expression);
      } else if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) literals(node.expression);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const retired = strings.flatMap(({ file, text }) => [...text.matchAll(RETIRED)].map((m) => `${file}: "${m[0]}" in "${text}"`));
  return { strings: strings.length, retired };
}

/** M7: knip's findings, every kind counted. */
export function deadCode(root = ROOT) {
  const run = spawnSync(process.execPath, [join(ROOT, 'node_modules/knip/bin/knip.js'), '--reporter', 'json', '--no-progress'], { cwd: root, encoding: 'utf8' });
  if (run.error || ![0, 1].includes(run.status)) throw new Error(`knip did not run: ${run.error?.message ?? run.stderr}`);
  const { issues } = JSON.parse(run.stdout);
  return issues.flatMap((issue) => Object.entries(issue).filter(([, list]) => Array.isArray(list))
    .flatMap(([kind, list]) => list.map((item) => `${issue.file}: ${kind} ${item.name ?? ''}`.trim())));
}

/** M8: functions over 60 lines and files over 400, by ESLint's own two rules, blank lines and comments counted. */
export async function longCode(root = ROOT) {
  const { ESLint } = await import('eslint');
  const { default: tseslint } = await import('typescript-eslint');
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: [{ files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { 'max-lines-per-function': ['error', { max: 60 }], 'max-lines': ['error', { max: 400 }] } }] });
  const results = existsSync(join(root, 'src')) ? await eslint.lintFiles(['src']) : [];
  const found = (rule) => results.flatMap((r) => r.messages.filter((m) => m.ruleId === rule).map((m) => `${posix(relative(root, r.filePath))}:${m.line}`));
  return { functions: found('max-lines-per-function'), files: found('max-lines') };
}

const list = (items) => (items.length ? `: ${items.join('; ')}` : '');

/**
 * Every measure, M1 to M11: v3's baseline, v4's figure now, and v4's aim. A measure that cannot be taken says so in
 * its own cell, marked failed, and the rest of the table stands.
 * @param {{ root?: string, gateSeconds?: number }} [where]
 */
export async function measures({ root = ROOT, gateSeconds } = {}) {
  const failed = new Set();
  let graph;
  const cruised = async () => (graph ??= await cruiseWithTheGatesRules(root));
  const take = async (id, work) => {
    try { return await work(); } catch (error) {
      failed.add(id);
      return `not measured: ${String(error?.message ?? error).split('\n')[0]}`;
    }
  };
  const v4 = {
    M1: await take('M1', async () => {
      const reach = featureReach(await cruised(), root);
      const beyond = reach.flatMap(({ id, beyond: files }) => files.map((file) => `${id}: ${file}`));
      return reach.length ? `${beyond.length} files beyond the catalogues, over ${reach.length} features${list(beyond)}` : '0 features yet, so 0 files beyond the catalogues';
    }),
    M2: await take('M2', async () => { const edges = featureToFeature(await cruised()); return `${edges.length}${list(edges)}`; }),
    M3: await take('M3', async () => {
      const { cycles, crossings } = cyclesAndCrossings(await cruised());
      return `${cycles.length} cycles; ${crossings.length} edges the layer rules forbid${list([...cycles, ...crossings])}`;
    }),
    M4: await take('M4', () => { const found = sharedThis(root); return `${found.length}${list(found)}`; }),
    M5: 'not yet: v4 has no route until CORE-06 and CORE-12, which add the count to the Playwright suite',
    M6: await take('M6', async () => {
      const words = await interfaceWords(root);
      return `${words.retired.length} retired words in ${words.strings} interface strings${list(words.retired)}`;
    }),
    // knip and the player's build read the whole project, so they run only on it.
    M7: root === ROOT ? await take('M7', () => { const dead = deadCode(root); return `${dead.length}${list(dead)}`; }) : 'not run here',
    M8: await take('M8', async () => {
      const long = await longCode(root);
      return `${long.functions.length} functions over 60 lines; ${long.files.length} files over 400 lines${list([...long.functions, ...long.files])}`;
    }),
    M9: gateSeconds === undefined ? "timed in CI, around v4's lane" : `${gateSeconds} s (v4's lane in this CI run)`,
    M10: root === ROOT ? await take('M10', async () => {
      const player = await buildPlayer();
      const findings = closureFindings(player.moduleIds, ROOT);
      return `${(Buffer.byteLength(player.code) / 1024).toFixed(2)} KB; ${findings.length ? `outside its closure${list(findings)}` : 'no React, React DOM, Carbon, jszip, mediabunny or editor part inside'}`;
    }) : 'not built here',
    M11: 'not yet: the EX-01 scripted runs, with PRESET-01',
  };
  return [
    ['M1', 'Adding a feature touches only its own folder and one line in each catalogue', '0 files beyond the two catalogue lines'],
    ['M2', 'Feature-to-feature imports', '0'],
    ['M3', 'Import cycles and upward edges', '0 and 0'],
    ['M4', 'Modules sharing one `this`', '0'],
    ['M5', 'Controls shown on a new route before any feature is added', 'at most 15'],
    ['M6', 'Interface words: one per concept', '0 retired words'],
    ['M7', 'Dead code (knip)', '0'],
    ['M8', 'Functions over 60 lines; files over 400 lines', 'down, each exception named'],
    ['M9', 'Gate time for a v4 change', 'under 10 minutes'],
    ['M10', 'The exported player: size, and no React or Carbon inside', 'no React or Carbon; size reported'],
    ['M11', "Steps to make each preset's scene from blank", 'reported per preset'],
  ].map(([id, name, aim]) => ({ id, name, v3: V3[id], v4: v4[id], aim, failed: failed.has(id) }));
}

const cell = (text) => String(text).replaceAll('|', '\\|');
/** The table, as Markdown: printed by `npm run measures` and appended to CI's summary. */
export const table = (rows) => ['| # | Measure | v3 (baseline) | v4 now | v4 aim |', '| --- | --- | --- | --- | --- |',
  ...rows.map((row) => `| ${[row.id, row.name, row.v3, row.v4, row.aim].map(cell).join(' | ')} |`)].join('\n');

/** @param {string[]} args */
export function parseArgs(args) {
  if (args.length === 0) return {};
  if (args.length === 2 && args[0] === '--gate-seconds' && /^\d+$/.test(args[1])) return { gateSeconds: Number(args[1]) };
  throw new Error(`unknown arguments: ${args.join(' ')}; the one option is --gate-seconds N`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { console.error(`measures: ${error.message}`); process.exit(2); }
  const rows = await measures(options);
  const text = table(rows);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n## v4's measures (STACK-04)\n\n${text}\n`);
  const failed = rows.filter((row) => row.failed).map((row) => row.id);
  if (failed.length) {
    console.error(`measures: ${failed.join(', ')} could not be measured; the table says why`);
    process.exitCode = 1;
  }
}
