#!/usr/bin/env node
// Accessibility report (V31-A11Y stage 2). Zero dependencies; reads a run folder and the project's catalogue and
// coverage file, and prints the per-criterion table with the four outcomes of section D kept apart: the suite result,
// each criterion's status, assessment completeness, and the release decision, which is the owner's and never stated
// here. The run folder holds run.json, Playwright's JSON report with its axe attachments, Guidepup speech logs, the
// doctor's output and per-method result files; the tool never runs a tool, calls a model, installs or reaches the
// network. The README's "The report tool" section is the contract this file implements.
// Usage: node tools/a11y-report.mjs --run <dir> [--root <dir>] [--gate] [--out <dir>] [--summary <file>] [--earl <file>]
//   --earl: also write the report's method results as EARL in JSON-LD, an export only (V31-A11Y-ACT); the table, the
//   summary and the exit are unchanged.
//   --gate: the run folder must lie outside the checkout; the table is written beside the run and nothing in the
//   checkout changes. Otherwise project/a11y/summary.json is written for the view and, for an extended run,
//   coverage-next.json beside the run: the results and run line a phase-close session may apply to coverage.json.
//   exit 0: the report is produced and the gate's policy holds; 1: a failure, an empty run, or a standard method
//   blocked or not run; 2: missing or invalid input, a run that errored, or a crash.
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalogue, validateCoverage, METHOD_KINDS } from './a11y-coverage.mjs';

export const RENDERER = 'pm-skills 5 a11y report 1';
export const DEPTHS = ['standard', 'extended'];
// A Playwright result's status as a method result; a flaky test, a blocked skip and a known-bad test are read apart.
// A spoken phrase holds an expected one when it carries it as whole words, case, spacing and punctuation aside, and not
// negated: "selected" is not heard in "not selected" or "unselected", nor "help" in "helpful" (stage 4's second session).
const words = (s) => ` ${String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
export function holds(heard, phrase) {
  const h = words(heard), p = words(phrase);
  if (p.trim() === '') return false;
  for (let i = h.indexOf(p); i >= 0; i = h.indexOf(p, i + 1)) if (!/ (not|no|non) $/.test(h.slice(0, i + 1))) return true;
  return false;
}
// The index of the first expected phrase not heard in order, each in a later spoken phrase than the one before, or -1.
// An expected entry is text, or { phrase, step } bound to the step that must produce it; a bound phrase is heard only in
// that step's spoken phrases (steps: [{ step, heard }]), so a phrase another step produced never stands in for it;
// with no steps given the phrases alone are judged, and the report fails a bound pass whose log records none.
export function unheard(expected, heard, steps = null) {
  const flat = steps ? steps.flatMap((s) => s.heard.map((p) => ({ p, step: s.step }))) : heard.map((p) => ({ p, step: null }));
  let i = 0;
  for (let k = 0; k < expected.length; k++) {
    const e = expected[k], phrase = typeof e === 'string' ? e : e.phrase;
    while (i < flat.length && !(holds(flat[i].p, phrase) && (typeof e === 'string' || !steps || flat[i].step === e.step))) i++;
    if (i >= flat.length) return k;
    i++;
  }
  return -1;
}
export const TEST_STATES = { passed: 'pass', failed: 'fail', timedOut: 'fail', interrupted: 'error', skipped: 'not_run' };
// A Playwright project stands for the test's own method, or for an extended method that re-runs it.
export const PROJECT_METHODS = ['standard', 'engines', 'touch'];
// The axe tags a run at each level must include for its credited rules to count as run.
export const LEVEL_TAGS = { AA: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'], AAA: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'wcag2aaa'] };
// Several results of one method on one row aggregate to the worst, in this order.
const WORST = ['fail', 'error', 'blocked', 'not_run', 'candidate', 'unverified', 'reviewed', 'pass'];
// Methods whose result is never required for a status: judgement is seldom sought, and a heuristic only flags.
const OPTIONAL_KINDS = ['human', 'heuristic'];
const RAN = ['pass', 'fail', 'error', 'candidate', 'reviewed', 'unverified'];
export class InputError extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const validDate = (s) => { const d = typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s) : null; return !!d && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const relPath = (s) => text(s) && !/^(\/|~|[A-Za-z]:|[a-z][a-z0-9+.-]*:)/i.test(s) && !s.split(/[\\/]/).includes('..');
const firstLine = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).find(Boolean) || '';
const triggerFeatures = (t) => (t?.all || t?.any || []);
const uniq = (list) => [...new Set(list)];
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const inside = (dir, p) => { const a = resolve(p), d = resolve(dir); return a === d || a.startsWith(d + sep); };
// The real path of a file, or of its nearest existing ancestor with the rest appended, so a link below a missing
// folder is still seen through.
const real = (p) => {
  let head = resolve(p); const tail = [];
  while (!existsSync(head)) { const parent = dirname(head); if (parent === head) break; tail.unshift(basename(head)); head = parent; }
  let base; try { base = realpathSync(head); } catch { base = head; }
  return join(base, ...tail);
};
// The report never writes through a symbolic link.
const writeSafe = (p, content) => { if (existsSync(p) && lstatSync(p).isSymbolicLink()) throw new InputError(`${p} is a symbolic link; the report never writes through a link`); writeFileSync(p, content); };

// ---- the run folder
export function loadRun(dir) {
  if (!existsSync(dir)) throw new InputError(`run folder missing: ${dir}`);
  const at = (p) => join(dir, p);
  const json = (p, required) => {
    if (!existsSync(at(p))) { if (required) throw new InputError(`missing ${p} in the run folder`); return null; }
    try { return JSON.parse(readFileSync(at(p), 'utf8')); } catch (e) { throw new InputError(`cannot read ${p}: ${e.message}`); }
  };
  const meta = json('run.json', true);
  if (!isObj(meta)) throw new InputError('run.json: not a JSON object');
  if (meta.schema !== 1) throw new InputError('run.json: schema must be 1');
  if (!DEPTHS.includes(meta.depth)) throw new InputError('run.json: depth must be standard or extended');
  if (!validDate(meta.date)) throw new InputError('run.json: date must be YYYY-MM-DD');
  if (!/^[0-9a-f]{40}$/.test(meta.tree ?? '')) throw new InputError('run.json: tree must be the tested tree\'s 40-character hash');
  if (!['AA', 'AAA'].includes(meta.level)) throw new InputError('run.json: level must be AA or AAA');
  if (!isObj(meta.tools) || !Object.values(meta.tools).every(text)) throw new InputError('run.json: tools must map each tool to its version');
  if (!(meta.baseline === null || text(meta.baseline))) throw new InputError('run.json: baseline must name the run relied on, or be null for a first run');
  if (!isObj(meta.projects) || !Object.values(meta.projects).every((v) => PROJECT_METHODS.includes(v))) throw new InputError(`run.json: projects must map each Playwright project name to ${PROJECT_METHODS.join(', ')}`);
  if (meta.declared !== undefined && !(isObj(meta.declared) && ['states', 'journeys'].every((k) => Array.isArray(meta.declared[k]) && meta.declared[k].every(text)))) throw new InputError('run.json: declared must list states and journeys');
  if (meta.bundle !== undefined && !relPath(meta.bundle)) throw new InputError('run.json: bundle must be the run folder\'s path relative to the checkout');
  const playwright = json('playwright.json', true);
  if (!isObj(playwright) || !Array.isArray(playwright.suites)) throw new InputError('playwright.json: not a Playwright JSON report (no suites)');
  const doctor = json('doctor.json', meta.depth === 'extended');
  const files = (sub) => (existsSync(at(sub)) ? readdirSync(at(sub)).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: `${sub}/${f}`, data: json(`${sub}/${f}`, true) })) : []);
  // An attachment is read only from inside the run folder, symbolic links resolved.
  const attachment = (p, source) => {
    const abs = isAbsolute(p) ? p : at(p);
    if (!inside(real(dir), real(abs))) throw new InputError(`${source}: attachment ${p} lies outside the run folder`);
    try { return JSON.parse(readFileSync(abs, 'utf8')); } catch (e) { throw new InputError(`${source}: cannot read attachment ${p}: ${e.message}`); }
  };
  return { dir, meta, playwright, doctor, speech: files('speech'), methods: files('methods'), attachment };
}

// ---- the report
export function report(cat, cov, run) {
  const { meta } = run, depth = meta.depth, extended = depth === 'extended';
  if (meta.level !== cov.level) throw new InputError(`run.json: level ${meta.level}, but the coverage file adopts ${cov.level}`);
  const byId = new Map(cat.rows.map((r) => [r.id, r]));
  const kindOf = (m) => cat.methods[m]?.kind;
  const featureState = (f) => cov.features[f]?.state ?? 'unknown';
  const listed = (row) => (extended ? [...row.methods.standard, ...row.methods.extended] : row.methods.standard).map((m) => m.method);
  const lists = (row, m) => listed(row).includes(m);
  // A feature-bound method is in scope only while its feature is present; absent switches it off, unknown leaves it unresolved.
  const bound = (m) => {
    const when = cat.methods[m].when; if (!when) return null;
    const fs = when.all || when.any, states = fs.map(featureState);
    if (when.all ? states.every((s) => s === 'present') : states.includes('present')) return null;
    const absent = fs.filter((f) => featureState(f) === 'absent');
    return (when.all ? absent.length : absent.length === fs.length) ? `feature absent: ${absent.join(', ')}` : `feature unknown: ${fs.filter((f) => featureState(f) === 'unknown').join(', ')}`;
  };
  const results = new Map(); // `${id}\0${method}` → [{ state, reason, source, date }]
  const add = (id, method, state, reason, source, date = meta.date) => { const k = `${id}\0${method}`; results.set(k, [...(results.get(k) || []), { state, reason, source, date }]); };
  const harness = [], review = [], knownBad = [], axeRuns = [], blockedTests = [];
  const statesRun = new Set(), journeysRun = new Set();
  let participation = null;

  // axe: a credited rule's violation fails its row, the test's own verdict regardless; an incomplete files a review; a rule
  // the run did not include gives its row no credit.
  const axeRows = new Map();
  for (const r of cat.rows) for (const m of r.methods.standard) if (m.method === 'axe') for (const rule of m.rules) axeRows.set(rule, [...(axeRows.get(rule) || []), r.id]);
  const readAxe = (axe, source, stateName, method, rows) => {
    if (!isObj(axe) || !Array.isArray(axe.violations) || !Array.isArray(axe.incomplete)) throw new InputError(`${source}: the axe attachment lacks violations and incomplete lists`);
    const only = axe.toolOptions?.runOnly;
    if (!isObj(only) || !['tag', 'rule'].includes(only.type) || !Array.isArray(only.values)) throw new InputError(`${source}: the axe attachment must record toolOptions.runOnly with type tag or rule and its values`);
    const where = stateName ? ` in state ${stateName}` : '';
    axeRuns.push({ version: axe.testEngine?.version || 'unknown', runOnly: only, state: stateName, violations: axe.violations.length, incomplete: axe.incomplete.length });
    const missingTags = only.type === 'tag' ? LEVEL_TAGS[meta.level].filter((t) => !only.values.includes(t)) : [];
    for (const id of rows) {
      const rules = byId.get(id).methods.standard.find((m) => m.method === 'axe')?.rules || [];
      const left = only.type === 'rule' ? rules.filter((r) => !only.values.includes(r)) : [];
      if (missingTags.length) add(id, method, 'not_run', `axe ran without the ${meta.level} tag(s) ${missingTags.join(', ')}${where}`, source);
      else if (left.length) add(id, method, 'not_run', `axe ran without the credited rule(s) ${left.join(', ')}${where}`, source);
    }
    for (const v of axe.violations) {
      const ids = axeRows.get(v.id) || [], n = v.nodes?.length ?? 0;
      if (!ids.length) { harness.push(`axe ${v.id} fails (${n} node(s)${where}), and no catalogue row credits that rule`); continue; }
      for (const id of ids) add(id, method, 'fail', `axe ${v.id}: ${n} node(s)${where}`, source);
    }
    for (const i of axe.incomplete) for (const id of axeRows.get(i.id) || []) review.push({ id, rule: i.id, nodes: i.nodes?.length ?? 0, state: stateName, source });
  };

  // Playwright: every test names its method and rows; its last result decides; the project may stand for an extended method.
  const tests = [];
  const walk = (s, file) => { for (const spec of s.specs || []) for (const t of spec.tests || []) tests.push({ file: s.file || file, spec, t }); for (const c of s.suites || []) walk(c, s.file || file); };
  for (const s of run.playwright.suites) walk(s, s.file || '');
  const crashes = (run.playwright.errors || []).map((e) => `the run reports an error: ${firstLine(e?.message ?? e?.value ?? JSON.stringify(e))}`);
  for (const { file, spec, t } of tests) {
    const name = `${file} › ${spec.title}${t.projectName ? ` [${t.projectName}]` : ''}`;
    const ann = {};
    for (const a of t.annotations || []) {
      if (!String(a?.type ?? '').startsWith('a11y-')) continue;
      if (ann[a.type] !== undefined) throw new InputError(`${name}: ${a.type} annotated twice`);
      ann[a.type] = String(a.description ?? '').trim();
    }
    if (!ann['a11y-method']) throw new InputError(`${name}: no a11y-method annotation; every test in the run names its method`);
    const own = ann['a11y-method'];
    if (!cat.methods[own]) throw new InputError(`${name}: unknown method ${own}`);
    const projectName = t.projectName || '', stands = meta.projects[projectName];
    if (stands === undefined) throw new InputError(`${name}: Playwright project "${projectName}" is not in run.json's projects`);
    const method = stands === 'standard' ? own : stands;
    if (cat.methods[method].depth === 'extended' && !extended) throw new InputError(`${name}: ${method} is an extended method in a standard run`);
    if (stands !== 'standard' && cat.methods[own].depth !== 'standard') throw new InputError(`${name}: ${stands} re-runs standard methods, not ${own}`);
    // A project standing for an extended method re-runs standard checks: an indicator re-run records nothing a check
    // could, and a row that does not list that method is not spoken to; neither is an error (stage 4).
    let skipped = stands !== 'standard' && kindOf(own) === 'indicator', dropped = [];
    const spec_ = ann['a11y-rows'] ?? '';
    let rows;
    if (spec_ === '*') { rows = cat.rows.filter((r) => r.methods.standard.some((m) => m.method === own) && lists(r, method)).map((r) => r.id); if (stands !== 'standard' && !rows.length) skipped = true; } // a re-run's * may leave no row, its harness error kept below
    else {
      rows = uniq(spec_.split(/\s+/).filter(Boolean));
      if (!rows.length) throw new InputError(`${name}: no a11y-rows annotation; name the rows, or * for every row that lists the method`);
      for (const id of rows) {
        const r = byId.get(id);
        if (!r) throw new InputError(`${name}: unknown row ${id}`);
        if (!r.methods.standard.some((m) => m.method === own) || (stands === 'standard' && !lists(r, method))) throw new InputError(`${name}: ${id} does not list ${own} at ${depth} depth`);
      }
      // A re-run credits only the claimed rows that list its method; the rest, validated above, are dropped here.
      if (stands !== 'standard') { dropped = rows.filter((id) => !lists(byId.get(id), method)); rows = rows.filter((id) => !dropped.includes(id)); if (!rows.length) skipped = true; }
    }
    const last = (t.results || []).at(-1);
    let state = last ? TEST_STATES[last.status] : (t.status === 'skipped' ? 'not_run' : undefined);
    if (!state) throw new InputError(`${name}: result status ${JSON.stringify(last?.status ?? t.status)} is not one Playwright reports`);
    let reason = last?.error ? firstLine(last.error.message) : '';
    if (t.status === 'flaky' && state === 'pass') { state = 'fail'; reason = 'flaky: failed before passing on retry'; }
    if (ann['a11y-crash'] !== undefined && state === 'fail') { state = 'error'; reason = ann['a11y-crash'] || `the browser or page closed under the test: ${reason}`; }
    // A test a re-run does not credit still reports its harness error: a crash or interruption is never dropped with its rows.
    if (skipped) { if (state === 'error') crashes.push(`${name}: ${reason || 'interrupted'}`); continue; }
    if (state === 'not_run') { if (ann['a11y-blocked'] !== undefined) { state = 'blocked'; reason = ann['a11y-blocked'] || 'blocked, no reason given'; blockedTests.push(reason); } else reason ||= 'skipped'; }
    // The method's kind fixes what a result can record: an indicator's failure is only a candidate.
    if (!METHOD_KINDS[kindOf(method)].includes(state)) {
      if (kindOf(method) === 'indicator' && state === 'fail') { state = 'candidate'; reason = `indicated, never proved: ${reason || 'the test failed'}`; }
      else throw new InputError(`${name}: ${method} is a ${kindOf(method)} method and cannot record ${state}`);
    }
    // An axe test credits its rows only through the axe results it attaches.
    const attached = (last?.attachments || []).filter((a) => a.name === 'axe');
    if (own === 'axe' && state === 'pass' && !attached.length) { state = 'not_run'; reason = 'passed without an axe attachment: no axe results to credit'; }
    if (RAN.includes(state)) { if (ann['a11y-state']) statesRun.add(ann['a11y-state']); if (ann['a11y-journey']) journeysRun.add(ann['a11y-journey']); }
    if (ann['a11y-expect'] !== undefined) { // a known-bad test proves the harness, never a criterion
      if (ann['a11y-expect'] !== 'fail') throw new InputError(`${name}: a11y-expect takes fail only`);
      if (state === 'pass') harness.push(`known-bad test passed: ${name}`);
      else if (state !== 'fail') harness.push(`known-bad test did not run (${state}): ${name}`);
      knownBad.push({ name, rows, state, reason });
      continue;
    }
    const source = `test ${name}`;
    // A multi-row test may attach per-row results; a row it does not name takes the test's own result.
    const perRow = {};
    for (const a of last?.attachments || []) {
      if (a.name !== 'a11y-rows') continue;
      const body = a.body !== undefined ? (() => { try { return JSON.parse(Buffer.from(a.body, 'base64').toString('utf8')); } catch (e) { throw new InputError(`${name}: the a11y-rows attachment's body is not JSON: ${e.message}`); } })() : run.attachment(a.path, name);
      if (!isObj(body)) throw new InputError(`${name}: the a11y-rows attachment must map rows to results`);
      for (const [id, e] of Object.entries(body)) {
        if (!rows.includes(id)) { if (dropped.includes(id)) continue; throw new InputError(`${name}: a11y-rows names ${id}, which the test does not claim`); } // a re-run ignores only the claimed rows it dropped
        if (!isObj(e) || !METHOD_KINDS[kindOf(method)].includes(e.state)) throw new InputError(`${name}: a11y-rows ${id}: ${method} is a ${kindOf(method)} method and records ${METHOD_KINDS[kindOf(method)].join(', ')}, not ${JSON.stringify(e?.state)}`);
        perRow[id] = { state: e.state, reason: text(e.reason) ? e.reason : e.state };
      }
    }
    // Per-row results narrow a failure to the rows that failed; they never erase it.
    if (['fail', 'error'].includes(state) && Object.keys(perRow).length && !Object.values(perRow).some((e) => ['fail', 'error'].includes(e.state))) throw new InputError(`${name}: the test ${state === 'fail' ? 'failed' : 'errored'}, but its a11y-rows attachment records no failure`);
    for (const id of rows) add(id, method, perRow[id]?.state ?? state, perRow[id]?.reason ?? reason, source);
    for (const a of attached) {
      const axe = a.body !== undefined ? (() => { try { return JSON.parse(Buffer.from(a.body, 'base64').toString('utf8')); } catch (e) { throw new InputError(`${name}: the axe attachment's body is not JSON: ${e.message}`); } })() : run.attachment(a.path, name);
      readAxe(axe, source, ann['a11y-state'] || '', method, rows);
    }
  }

  // Speech logs: the tool judges expected against heard, in order (unheard, below); a log's own claim never stands alone.
  const phrases = (list) => Array.isArray(list) && list.every(text);
  const expectedList = (list) => Array.isArray(list) && list.every((e) => text(e) || (isObj(e) && Object.keys(e).length === 2 && text(e.phrase) && Number.isInteger(e.step) && e.step >= 0));
  const stepList = (list) => list === undefined || (Array.isArray(list) && list.every((s) => isObj(s) && Number.isInteger(s.step) && s.step >= 0 && text(s.kind) && phrases(s.heard)));
  for (const { file, data: log } of run.speech) {
    if (!extended) throw new InputError(`${file}: speech logs belong to an extended run`);
    if (!isObj(log) || !text(log.journey) || !text(log.engine) || !Array.isArray(log.rows) || !log.rows.length || !expectedList(log.expected) || !phrases(log.heard) || !stepList(log.steps) || !['pass', 'fail', 'blocked', 'error'].includes(log.state)) throw new InputError(`${file}: a speech log needs journey, engine, rows, expected and heard as lists of phrases, and a state of pass, fail, blocked or error`);
    for (const id of log.rows) { const r = byId.get(id); if (!r || !lists(r, 'vo')) throw new InputError(`${file}: ${id} does not list vo`); }
    if (log.steps && JSON.stringify(log.steps.flatMap((x) => x.heard)) !== JSON.stringify(log.heard)) throw new InputError(`${file}: heard is not the phrases of its steps, in order: a log's whole and its parts must agree`);
    let state = log.state, reason = text(log.reason) ? log.reason : '';
    if (state === 'pass') {
      const bound = log.expected.filter((e) => typeof e !== 'string');
      const where = (e) => `"${e.phrase}" at step ${e.step}${log.steps?.find((x) => x.step === e.step) ? ` (${log.steps.find((x) => x.step === e.step).kind})` : ''}`;
      if (!log.expected.length) { state = 'fail'; reason = 'no expected phrase: a log with nothing expected proves nothing'; }
      else if (bound.length && !log.steps) { state = 'fail'; reason = `expected ${where(bound[0])}, but the log records no phrases per step (${log.engine})`; }
      else {
        const k = unheard(log.expected, log.heard, log.steps);
        if (k >= 0) {
          const e = log.expected[k];
          state = 'fail';
          reason = typeof e === 'string' ? `expected "${e}" was not heard in order (${log.engine})`
            : `expected ${where(e)} was not heard there in order${log.steps.find((x) => x.heard.some((p) => holds(p, e.phrase))) ? `, though step ${log.steps.find((x) => x.heard.some((p) => holds(p, e.phrase))).step} spoke it` : ''} (${log.engine})`;
        } else reason = `${log.expected.length} phrase(s) heard in order${bound.length ? `, ${bound.length} at the step that must produce it` : ''} (${log.engine})`;
      }
    }
    if (RAN.includes(state)) journeysRun.add(log.journey);
    for (const id of log.rows) add(id, 'vo', state, reason || `${state} (${log.engine})`, `speech ${file}`);
  }

  // Per-method result files, for the methods no test or speech log carries; ai-review's is the candidates file.
  const computedRecords = new Set(['P01', 'P02', 'P03', 'P04', 'P05', 'P07', 'P11', 'CONF01', 'CONF02']);
  for (const { file, data } of run.methods) {
    const m = file.slice('methods/'.length, -'.json'.length);
    if (!cat.methods[m]) throw new InputError(`${file}: unknown method ${m}`);
    if (!isObj(data) || data.method !== m || !validDate(data.date) || !isObj(data.rows)) throw new InputError(`${file}: needs method "${m}", a YYYY-MM-DD date and a rows object`);
    if (cat.methods[m].depth === 'extended' && !extended) throw new InputError(`${file}: ${m} is an extended method in a standard run`);
    if (m === 'vo') throw new InputError(`${file}: vo results come from speech logs, which the report judges`);
    const off = bound(m);
    if (off) throw new InputError(`${file}: results for ${m}, which is off in this run — ${off}`);
    // A tool's results carry the run's date; a human's or a record's may be earlier, and keep their own date.
    if (data.date > meta.date) throw new InputError(`${file}: dated ${data.date}, after the run of ${meta.date}`);
    if (data.date !== meta.date && !['human', 'record'].includes(kindOf(m))) throw new InputError(`${file}: ${m} is a ${kindOf(m)} method and is run on the run's date, ${meta.date}, not ${data.date}`);
    for (const [id, e] of Object.entries(data.rows)) {
      const r = byId.get(id);
      if (!r || !lists(r, m)) throw new InputError(`${file}: ${id} does not list ${m} at ${depth} depth`);
      if (!isObj(e) || !METHOD_KINDS[kindOf(m)].includes(e.state)) throw new InputError(`${file}: ${id}: ${m} is a ${kindOf(m)} method and records ${METHOD_KINDS[kindOf(m)].join(', ')}, not ${JSON.stringify(e?.state)}`);
      if (m === 'records' && computedRecords.has(id)) throw new InputError(`${file}: ${id} is computed by the report itself`);
      add(id, m, e.state, text(e.note) ? e.note : e.state, file, data.date);
    }
    // The footer claims participant testing only on a participation result that passed.
    if (m === 'participation' && Object.values(data.rows).some((e) => e.state === 'pass')) participation = { date: data.date, note: text(data.note) ? data.note : '' };
  }

  // The doctor: a blocked method's rows read blocked; results for it are a contradiction.
  if (run.doctor) {
    if (!isObj(run.doctor.methods)) throw new InputError('doctor.json: needs a methods object');
    for (const [m, d] of Object.entries(run.doctor.methods)) {
      if (!cat.methods[m]) throw new InputError(`doctor.json: unknown method ${m}`);
      if (!isObj(d) || !['ready', 'blocked'].includes(d.state) || (d.state === 'blocked' && !text(d.reason))) throw new InputError(`doctor.json: ${m} must be ready, or blocked with its reason`);
      if (d.state !== 'blocked') continue;
      if (!METHOD_KINDS[kindOf(m)].includes('blocked')) throw new InputError(`doctor.json: ${m} is a ${kindOf(m)} method; the doctor reports tools, not judgement`);
      for (const r of cat.rows) {
        if (!lists(r, m)) continue;
        if (results.has(`${r.id}\0${m}`)) throw new InputError(`results for ${m} on ${r.id}, which the doctor reports blocked: ${d.reason}`);
        add(r.id, m, 'blocked', d.reason, 'doctor');
      }
    }
  }

  // Records the report computes from what it validated; the bundle is the extended run's folder.
  const declared = meta.declared || null;
  const missingStates = declared ? declared.states.filter((s) => !statesRun.has(s)) : [];
  const missingJourneys = declared ? declared.journeys.filter((s) => !journeysRun.has(s)) : [];
  const presentFeatures = Object.keys(cov.features).filter((f) => featureState(f) === 'present');
  const sources = uniq([...results.values()].flat().filter((e) => RAN.includes(e.state)).map((e) => e.source)).length;
  const computed = {
    P01: ['pass', 'the coverage file declares the level, every feature and its evidence'],
    P02: ['pass', 'every row has its applicability state; not applicable only by an absent trigger feature'],
    P03: ['pass', meta.baseline ? `baseline run ${meta.baseline}` : 'no baseline: a first run'],
    P04: statesRun.size || journeysRun.size ? ['pass', `states run: ${[...statesRun].join(', ') || 'none'}; journeys run: ${[...journeysRun].join(', ') || 'none'}`] : blockedTests.length ? ['blocked', `no state or journey could run: ${uniq(blockedTests).join('; ')}`] : ['not_run', 'no state or journey ran'],
    P05: ['pass', 'method kinds kept apart: a heuristic never passes, a record never checks'],
    P07: ['pass', `${presentFeatures.length} present feature(s) switch their rows and methods on: ${presentFeatures.join(', ') || 'none'}`],
    P11: ['pass', `scope ${depth} at ${meta.level}, tree ${meta.tree}, ${meta.date}, ${sources} source(s) and ${Object.keys(meta.tools).length} tool version(s) recorded; no claim beyond`],
    CONF01: ['pass', 'applicable rows aggregated; a scanner alone never makes a claim'],
    CONF02: !declared ? ['not_run', 'run.json declares no states'] : !missingStates.length ? ['pass', `${declared.states.length} declared state(s) all run`] : statesRun.size ? ['fail', `declared but not run: ${missingStates.join(', ')}`] : blockedTests.length ? ['blocked', `no declared state could run: ${uniq(blockedTests).join('; ')}`] : ['not_run', 'no declared state ran'],
  };
  for (const r of cat.rows) {
    if (lists(r, 'records') && computed[r.id]) add(r.id, 'records', ...computed[r.id], 'report');
    if (extended && lists(r, 'bundle') && !results.has(`${r.id}\0bundle`)) add(r.id, 'bundle', 'pass', `the run folder is the dated bundle: ${meta.date}, tree ${meta.tree}`, 'report');
  }

  // Each row: its methods in scope, each one's aggregated result, then the status by the README's rules.
  const aggregate = (id, m) => {
    const entries = results.get(`${id}\0${m}`) || [];
    const state = entries.length ? WORST.find((s) => entries.some((e) => e.state === s)) : 'not_run';
    const reasons = entries.length ? uniq(entries.filter((e) => e.state === state).map((e) => e.reason).filter(Boolean)) : ['no result in the run'];
    const date = entries.length ? entries.filter((e) => e.state === state).map((e) => e.date).sort().at(-1) : meta.date;
    return { method: m, kind: kindOf(m), state, reasons, results: entries.length, date };
  };
  const rows = cat.rows.map((row) => {
    const c = cov.rows[row.id], app = c.applicability;
    const excluded = [], inScope = [];
    for (const m of listed(row)) { const why = bound(m); if (why) excluded.push({ method: m, why }); else inScope.push(m); }
    const methods = inScope.map((m) => aggregate(row.id, m));
    const rowReview = review.filter((v) => v.id === row.id);
    const required = methods.filter((m) => !OPTIONAL_KINDS.includes(m.kind));
    const named = (list) => list.map((m) => `${m.method}: ${m.reasons.join('; ')}`);
    const human = methods.filter((m) => m.kind === 'human' && m.state !== 'not_run'); // shown beside the status, never deciding it
    const pick = (state) => required.filter((m) => m.state === state);
    let status, reasons;
    if (methods.some((m) => m.state === 'fail')) { status = 'failed'; reasons = named(methods.filter((m) => m.state === 'fail')); }
    else if (app.state === 'not_applicable') { status = 'not_applicable'; reasons = [`${app.absent.join(', ')} absent`]; }
    else if (app.state === 'unresolved') { status = 'unverified'; reasons = [`feature unknown: ${triggerFeatures(row.trigger).filter((f) => featureState(f) === 'unknown').join(', ')}`]; }
    else if (pick('blocked').length) { status = 'blocked'; reasons = named(pick('blocked')); }
    else if (pick('error').length) { status = 'unverified'; reasons = named(pick('error')).map((s) => `errored — ${s}`); }
    else if (pick('not_run').length) { status = 'unverified'; reasons = [`not run: ${pick('not_run').map((m) => m.method).join(', ')}`]; }
    else if (methods.some((m) => m.state === 'candidate')) { status = 'unverified'; reasons = named(methods.filter((m) => m.state === 'candidate')).map((s) => `candidate — ${s}`); }
    else if (rowReview.length) { status = 'unverified'; reasons = [`axe could not decide: ${uniq(rowReview.map((v) => `${v.rule} (${v.nodes} node(s)${v.state ? ` in ${v.state}` : ''})`)).join(', ')}; review`]; }
    else if (row.classes.includes(2)) { status = 'unverified'; reasons = [human.length ? 'human judgement only' : 'judgement not sought: human judgement only']; }
    else if (row.classes.includes(3)) { status = 'unverified'; reasons = ['needs people or platforms the owner lacks']; }
    else if (methods.some((m) => m.kind === 'check' && m.state === 'pass')) { status = 'checked'; reasons = [`${methods.filter((m) => m.state === 'pass').map((m) => m.method).join(', ')} passed; human part unverified`]; }
    else { status = 'unverified'; reasons = [methods.length ? `${methods.filter((m) => m.state === 'pass').map((m) => m.method).join(', ') || 'nothing'} passed; a record, indicator, capture or heuristic never makes a row checked` : `no ${depth} method`]; }
    // A human result is shown beside the status; it decides it only when it fails.
    for (const m of human) if (m.state !== 'fail') reasons.push(`${m.method} ${m.state}: ${m.reasons.join('; ')} — shown, never counted as a check`);
    return { id: row.id, title: row.title, level: row.level, kind: row.kind, classes: row.classes, adoption: c.adoption, applicability: app, status, reasons, methods, excluded, review: rowReview, human: row.human };
  });

  // The four outcomes, kept apart. A failing check gates whatever the adoption; a method not run or blocked gates only on
  // required rows, and only a standard one.
  // Adopted rows are the applicable and the unresolved ones the project adopts; completeness counts over them, an
  // unresolved row reading unverified. Not run or blocked gates only on an applicable required row.
  const adopted = rows.filter((r) => ['applicable', 'unresolved'].includes(r.applicability.state) && r.adoption !== 'not_adopted');
  const failures = [], unrun = [], blockedStandard = [], blockedExtended = [];
  for (const r of rows) {
    if (r.status === 'failed') failures.push(`${r.id}${adopted.includes(r) ? (r.adoption === 'advisory' ? ' (advisory)' : r.applicability.state === 'unresolved' ? ' (unresolved)' : '') : ` (${r.applicability.state === 'not_applicable' ? 'declared not applicable' : 'not adopted'})`} failed — ${r.reasons[0]}`);
    if (r.applicability.state !== 'applicable' || r.adoption !== 'required') continue;
    for (const m of r.methods) {
      if (OPTIONAL_KINDS.includes(m.kind)) continue;
      const line = `${r.id}: ${m.method} ${{ blocked: 'blocked', not_run: 'not run', error: 'errored' }[m.state]} — ${m.reasons.join('; ')}`;
      if (['not_run', 'error'].includes(m.state)) unrun.push(line);
      else if (m.state === 'blocked') (cat.methods[m.method].depth === 'standard' ? blockedStandard : blockedExtended).push(line);
    }
  }
  failures.push(...harness);
  const all = [...results.values()].flat().filter((e) => e.source !== 'report');
  const errored = uniq(all.filter((e) => e.state === 'error').map((e) => `${e.source}: ${e.reason}`));
  let suite, suiteReasons;
  if (crashes.length || errored.length) { suite = 'error'; suiteReasons = [...crashes, ...errored]; }
  // Method files beside an empty suite — lint, records — are no run: the suite is empty when no test or speech log ran.
  else if (!all.some((e) => RAN.includes(e.state) && !String(e.source).startsWith('methods/')) && !all.some((e) => e.state === 'blocked')) { suite = 'empty'; suiteReasons = ['no test or speech log ran for any row']; }
  else if (failures.length || unrun.length) { suite = 'failed'; suiteReasons = [...failures, ...unrun]; }
  else if (blockedStandard.length || blockedExtended.length || adopted.some((r) => r.methods.some((m) => m.state === 'blocked'))) { suite = 'blocked'; suiteReasons = uniq([...blockedStandard, ...blockedExtended, ...adopted.flatMap((r) => r.methods.filter((m) => m.state === 'blocked').map((m) => `${r.id}: ${m.method} blocked — ${m.reasons.join('; ')}`))]); }
  else { suite = 'passed'; suiteReasons = [`${adopted.filter((r) => r.status === 'checked').length} of ${adopted.length} applicable row(s) checked; every required method ran and passed`]; }
  const counts = Object.fromEntries(['failed', 'checked', 'unverified', 'blocked'].map((s) => [s, adopted.filter((r) => r.status === s).length]));
  const completeness = { ...counts, applicable: adopted.length, unresolved: adopted.filter((r) => r.applicability.state === 'unresolved' && r.status === 'unverified').length, not_applicable: rows.filter((r) => r.status === 'not_applicable').length, not_adopted: rows.filter((r) => r.adoption === 'not_adopted').length, failed_outside: rows.filter((r) => r.status === 'failed' && !adopted.includes(r)).length };
  // The gate's policy: a judged run with no failure, nothing required left unrun, and no standard method blocked.
  const exit = suite === 'error' ? 2 : ['empty', 'failed'].includes(suite) || (suite === 'blocked' && blockedStandard.length) ? 1 : 0;
  const ids = (status) => adopted.filter((r) => r.status === status).map((r) => r.id);
  const unverified = ids('unverified'), blocked = ids('blocked');
  const recordedParticipation = Object.values(cov.rows).flatMap((r) => r.results || []).filter((r) => r.method === 'participation' && r.state === 'pass').map((r) => r.date).sort().at(-1);
  const footer = [
    suite === 'passed' ? `Configured checks passed for the stated scope: ${depth} depth at level ${meta.level}, ${statesRun.size} state(s) and ${journeysRun.size} journey(s), tree ${meta.tree}, ${meta.date}.`
      : `Configured checks did not pass for the stated scope — ${suite}: ${suiteReasons.slice(0, 8).join('; ')}${suiteReasons.length > 8 ? `; and ${suiteReasons.length - 8} more in section 1` : ''}.`,
    `These criteria remain unverified: ${unverified.join(', ') || 'none'}. Blocked: ${blocked.join(', ') || 'none'}.`,
    participation ? `Participant testing: ${participation.date}${participation.note ? ` — ${participation.note}` : ''}.` : recordedParticipation ? `Participant testing: recorded ${recordedParticipation}, the coverage file's latest participation result.` : 'Participant testing was not conducted.',
  ];
  const candidates = adopted.flatMap((r) => r.methods.filter((m) => m.state === 'candidate').map((m) => ({ id: r.id, method: m.method, reasons: m.reasons })));
  const reviewed = adopted.flatMap((r) => r.methods.filter((m) => m.state === 'reviewed').map((m) => ({ id: r.id, method: m.method, reasons: m.reasons })));
  const axeVersions = uniq(axeRuns.map((a) => a.version));
  const notes = [];
  if (axeVersions.length && (axeVersions.length > 1 || axeVersions[0] !== cat.sources?.axe?.version)) notes.push(`axe ${axeVersions.join(', ')} ran; the catalogue credits rules from ${cat.sources?.axe?.version}: regenerate the mapping before relying on it`);
  if (missingJourneys.length) notes.push(`declared journeys not run: ${missingJourneys.join(', ')}`);
  const recordedFailures = Object.entries(cov.rows).filter(([, r]) => (r.results || []).some((x) => x.state === 'fail')).map(([id]) => id);
  const out = { renderer: RENDERER, run: { depth, date: meta.date, tree: meta.tree, level: meta.level, catalogue: cat.version, baseline: meta.baseline, tools: meta.tools, statesRun: [...statesRun], journeysRun: [...journeysRun] }, suite, suiteReasons, rows, completeness, failures, harness, knownBad, review, candidates, reviewed, axe: axeRuns, notes, footer, recorded: { extended: cov.runs.extended, failures: recordedFailures }, exit };
  out.markdown = markdown(out);
  out.summary = summary(out);
  if (extended) {
    out.coverageNext = coverageNext(cat, cov, out, meta);
    const fails = out.coverageNext ? validateCoverage(out.coverageNext, cat) : [];
    if (fails.length) throw new InputError(`the proposal for coverage.json would be invalid (${fails.length} failure(s)): ${fails.slice(0, 3).join(' | ')}`);
  }
  return out;
}

function markdown(o) {
  const l = [`# Accessibility report — ${o.run.depth} depth, level ${o.run.level}`, '', `Run ${o.run.date}, tree ${o.run.tree}, catalogue ${o.run.catalogue}, baseline ${o.run.baseline ?? 'none'}. Tools: ${Object.entries(o.run.tools).map(([k, v]) => `${k} ${v}`).join(', ') || 'none recorded'}. States run: ${o.run.statesRun.join(', ') || 'none'}; journeys run: ${o.run.journeysRun.join(', ') || 'none'}.`, ''];
  l.push(`## 1. Suite result: ${o.suite}`, '', ...o.suiteReasons.map((r) => `- ${r}`), '');
  if (o.knownBad.length) l.push(`Known-bad tests: ${o.knownBad.map((k) => `${k.name} — ${k.state === 'fail' ? 'failed as it must' : k.state}`).join('; ')}.`, '');
  l.push('## 2. Criterion status', '', 'Never "conforms": checked means every automated method passed and any human part is unverified.', '', '| ID | Title | Level | Adoption | Applicability | Status | Methods | Reasons |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of o.rows) l.push(`| ${r.id} | ${cell(r.title)} | ${r.level ?? '—'} | ${r.adoption} | ${r.applicability.state}${r.applicability.absent?.length ? ` (${r.applicability.absent.join(', ')})` : ''} | ${r.status} | ${cell([...r.methods.map((m) => `${m.method} ${m.state}`), ...r.excluded.map((e) => `${e.method} off (${e.why})`)].join(', ') || '—')} | ${cell(r.reasons.join('; '))} |`);
  l.push('', '## 3. Assessment completeness', '', `Over ${o.completeness.applicable} adopted row(s), applicable or unresolved: ${o.completeness.checked} checked, ${o.completeness.failed} failed, ${o.completeness.unverified} unverified (${o.completeness.unresolved} of them by an unknown feature), ${o.completeness.blocked} blocked. Apart: ${o.completeness.not_applicable} not applicable, ${o.completeness.not_adopted} not adopted${o.completeness.failed_outside ? `, ${o.completeness.failed_outside} failed among them` : ''}.`, '');
  if (o.review.length) l.push(`axe could not decide ${o.review.length} result(s), for review: ${o.review.map((v) => `${v.id} ${v.rule} (${v.nodes} node(s)${v.state ? ` in ${v.state}` : ''})`).join('; ')}.`, '');
  if (o.candidates.length) l.push(`Candidates, never a pass: ${o.candidates.map((c) => `${c.id} by ${c.method} — ${c.reasons.join('; ')}`).join('; ')}.`, '');
  if (o.reviewed.length) l.push(`Reviewed by a heuristic and flagged nothing, never a pass: ${o.reviewed.map((c) => `${c.id} by ${c.method} — ${c.reasons.join('; ')}`).join('; ')}.`, '');
  if (o.recorded.failures.length) l.push(`Recorded extended failures still in the coverage file: ${o.recorded.failures.join(', ')}${o.recorded.extended ? ` (run of ${o.recorded.extended.date})` : ''}.`, '');
  if (o.notes.length) l.push(...o.notes.map((n) => `Note: ${n}.`), '');
  l.push('## 4. Release decision', '', 'The owner\'s, recorded in the project\'s decisions; this report makes none.', '', '## Footer', '', ...o.footer.map((f) => `- ${f}`), '');
  return l.join('\n');
}

// The view's summary: identifiers and counts, under 5 KB; the detail stays in the report beside the run.
export const SUMMARY_BYTES = 4800;
function summary(o) {
  const ids = (status) => o.rows.filter((r) => ['applicable', 'unresolved'].includes(r.applicability.state) && r.adoption !== 'not_adopted' && r.status === status).map((r) => r.id);
  const short = (s, n = 120) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);
  const s = { renderer: RENDERER, depth: o.run.depth, level: o.run.level, catalogue: o.run.catalogue, date: o.run.date, tree: o.run.tree, suite: o.suite, exit: o.exit, completeness: o.completeness, failures: o.rows.filter((r) => r.status === 'failed').map((r) => ({ id: r.id, reason: short(r.reasons[0]) })), blocked: ids('blocked'), unverified: ids('unverified'), unresolved: o.rows.filter((r) => r.applicability.state === 'unresolved').map((r) => r.id), candidates: o.candidates.map((c) => ({ id: c.id, method: c.method })), review: uniq(o.review.map((v) => `${v.id} ${v.rule}`)), harness: o.harness.map((h) => short(h)), recorded: o.recorded, footer: o.footer, release: 'the owner\'s, in the project\'s decisions' };
  // The byte budget holds whatever the run did: lists are cut to a head and a count, the detail staying in the report.
  const cap = (list, n) => (list.length > n ? [...list.slice(0, n), `and ${list.length - n} more`] : list);
  for (const n of [115, 60, 30, 15, 8, 4, 2]) {
    if (JSON.stringify(s, null, 2).length <= SUMMARY_BYTES) break;
    s.failures = cap(s.failures.map((f) => (typeof f === 'string' ? f : { id: f.id, reason: short(f.reason, 60) })), n);
    for (const k of ['blocked', 'unverified', 'unresolved', 'candidates', 'review', 'harness']) s[k] = cap(s[k].filter((x) => typeof x !== 'string' || !/^and \d+ more$/.test(x)), n);
    s.footer = s.footer.map((l) => short(l, 240));
  }
  return s;
}

// summary.json keeps the last report of each depth: this one replaces its own depth's block and the "last" block.
// EARL, an export only (V31-A11Y-ACT): each row's method results as earl:Assertion, read from the report as built, never
// deciding anything. pass → passed, fail → failed, not_run and blocked → untested, error, candidate and unverified →
// cantTell, a row not applicable → inapplicable. The pack's "reviewed" — a heuristic ran and flagged nothing, never a
// pass — has no EARL value: no assertion is written for it, and the export's note says so and lists each one.
export const EARL_OUTCOMES = { pass: 'earl:passed', fail: 'earl:failed', not_run: 'earl:untested', blocked: 'earl:untested', error: 'earl:cantTell', candidate: 'earl:cantTell', unverified: 'earl:cantTell' };
export const EARL_NOTE = 'An export only, from the accessibility report; the report, its table and its exit decide nothing from it. The pack\'s "reviewed" state (a heuristic ran and flagged nothing, never a pass) has no EARL value, so no assertion is written for it; each such result is listed under noEarlValue.';
export function toEarl(out, cat) {
  const mode = (kind) => (kind === 'check' ? 'earl:automatic' : kind === 'human' ? 'earl:manual' : 'earl:semiAuto');
  const subject = { '@id': '_:subject', '@type': 'earl:TestSubject', 'dct:date': out.run.date, 'pm:tree': out.run.tree, 'pm:level': out.run.level };
  const graph = [], noEarlValue = [];
  for (const r of out.rows) {
    const row = cat.rows.find((x) => x.id === r.id);
    const test = { '@id': row?.source?.anchor ?? `urn:pm-next:a11y:${r.id}`, 'dct:title': `${r.id} ${r.title}` };
    const assertion = (by, outcome, description, state) => ({ '@type': 'earl:Assertion', 'earl:assertedBy': { '@type': 'earl:Assertor', 'dct:title': `${RENDERER}, method ${by}` }, 'earl:subject': { '@id': '_:subject' }, 'earl:test': test, 'earl:mode': { '@id': by === 'applicability' ? 'earl:automatic' : mode(kindOfMethod(cat, by)) }, 'earl:result': { '@type': 'earl:TestResult', 'earl:outcome': { '@id': outcome }, 'dct:description': description, 'pm:state': state } });
    if (r.status === 'not_applicable') { graph.push(assertion('applicability', 'earl:inapplicable', r.reasons.join('; '), 'not_applicable')); continue; }
    for (const m of r.methods) {
      if (m.state === 'reviewed') { noEarlValue.push({ row: r.id, method: m.method, reasons: m.reasons }); continue; }
      graph.push(assertion(m.method, EARL_OUTCOMES[m.state] ?? 'earl:cantTell', m.reasons.join('; '), m.state));
    }
  }
  return { '@context': { earl: 'http://www.w3.org/ns/earl#', dct: 'http://purl.org/dc/terms/', pm: 'urn:pm-next:' }, 'pm:note': EARL_NOTE, 'pm:noEarlValue': noEarlValue, '@graph': [subject, ...graph] };
}
const kindOfMethod = (cat, m) => cat.methods?.[m]?.kind ?? 'check';

export function mergeSummary(existing, s) {
  const block = { date: s.date, tree: s.tree, suite: s.suite, exit: s.exit };
  const prior = isObj(existing) ? existing : {};
  return { ...s, standard: s.depth === 'standard' ? block : (isObj(prior.standard) ? prior.standard : null), extended: s.depth === 'extended' ? block : (isObj(prior.extended) ? prior.extended : null) };
}

// An extended run's proposal for coverage.json: this run's extended results, dated and linked into the bundle, and the
// run line. Nothing is applied here; the phase-close session applies it with the bundle retained.
function coverageNext(cat, cov, o, meta) {
  if (!meta.bundle) return null;
  const next = structuredClone(cov);
  for (const r of o.rows) {
    if (r.applicability.state === 'not_applicable') { next.rows[r.id].results = []; continue; }
    next.rows[r.id].results = r.methods.filter((m) => cat.methods[m.method].depth === 'extended' && m.results > 0 && m.state !== 'not_run').map((m) => ({ method: m.method, state: m.state, date: m.date, ref: `${meta.bundle}/a11y-report.json`, ...(m.reasons.length ? { note: m.reasons.join('; ').slice(0, 300) } : {}) }));
  }
  next.runs.extended = { date: meta.date, tree: meta.tree, suite: o.suite, bundle: meta.bundle };
  return next;
}

// Run as a script: by real paths, so a symlinked folder, as /tmp and /var are on macOS, still runs it (as suite-once.mjs does).
if (process.argv[1] && (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })()) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const gate = args.includes('--gate');
  const root = resolve(opt('--root') ?? '.');
  try {
    if (!opt('--run')) throw new InputError('--run <dir> is required');
    const load = (f) => { try { return JSON.parse(readFileSync(join(root, f), 'utf8')); } catch (e) { throw new InputError(`cannot read ${f}: ${e.message}`); } };
    const cat = load('project/a11y/catalogue.json');
    const catFails = validateCatalogue(cat);
    if (catFails.length) throw new InputError(`the catalogue is invalid (${catFails.length} failure(s)): ${catFails.slice(0, 3).join(' | ')}`);
    const cov = load('project/a11y/coverage.json');
    const covFails = validateCoverage(cov, cat);
    if (covFails.length) throw new InputError(`the coverage file is invalid (${covFails.length} failure(s)): ${covFails.slice(0, 3).join(' | ')}`);
    const runDir = resolve(opt('--run'));
    if (gate && inside(real(root), real(runDir))) throw new InputError(`gate mode: the run folder ${runDir} lies inside the checkout; the gate writes nothing there`);
    const run = loadRun(runDir);
    const out = report(cat, cov, run);
    const dir = resolve(opt('--out') ?? run.dir);
    if (gate && inside(real(root), real(dir))) throw new InputError(`gate mode: the output folder ${dir} lies inside the checkout`);
    mkdirSync(dir, { recursive: true });
    writeSafe(join(dir, 'a11y-report.md'), out.markdown);
    const { markdown: _m, summary: _s, coverageNext: next, ...json } = out;
    writeSafe(join(dir, 'a11y-report.json'), JSON.stringify(json, null, 2) + '\n');
    const written = [join(dir, 'a11y-report.md'), join(dir, 'a11y-report.json')];
    if (opt('--earl')) {
      const earlPath = resolve(opt('--earl'));
      if (gate && inside(real(root), real(dirname(earlPath)))) throw new InputError(`gate mode: the EARL file ${earlPath} lies inside the checkout`);
      writeSafe(earlPath, JSON.stringify(toEarl(out, cat), null, 2) + '\n'); written.push(earlPath);
    }
    if (!gate) {
      const summaryPath = resolve(opt('--summary') ?? join(root, 'project/a11y/summary.json'));
      let existing = null; try { existing = JSON.parse(readFileSync(summaryPath, 'utf8')); } catch { /* none yet, or unreadable: replaced */ }
      mkdirSync(dirname(summaryPath), { recursive: true });
      const tmp = join(dirname(summaryPath), `.${basename(summaryPath)}.${process.pid}.tmp`);
      try { writeFileSync(tmp, JSON.stringify(mergeSummary(existing, out.summary), null, 2) + '\n'); renameSync(tmp, summaryPath); } catch (e) { rmSync(tmp, { force: true }); throw e; }
      written.push(summaryPath);
      if (next) { writeSafe(join(dir, 'coverage-next.json'), JSON.stringify(next, null, 2) + '\n'); written.push(join(dir, 'coverage-next.json')); }
      else if (run.meta.depth === 'extended') console.log('a11y-report: run.json names no bundle, so no coverage-next.json is proposed');
    } else process.stdout.write(out.markdown);
    console.log(`a11y-report: wrote ${written.join(', ')}`);
    const c = out.completeness;
    console.log(`a11y-report: ${out.suite}; ${c.checked} checked, ${c.failed} failed, ${c.unverified} unverified, ${c.blocked} blocked of ${c.applicable} applicable; exit ${out.exit}`);
    process.exitCode = out.exit;
  } catch (e) {
    console.error(`a11y-report: ${e instanceof InputError ? e.message : `crash: ${e.stack || e.message}`}`);
    process.exitCode = 2;
  }
}
