#!/usr/bin/env node
// Accessibility catalogue and coverage validation (V31-A11Y). Zero dependencies; reads, never writes.
// A project with an Accessibility testing line carries project/a11y/catalogue.json, replaced on upgrade and never
// edited, and project/a11y/coverage.json, its own: features, adoption, applicability, evidence links and the last
// extended run. Criterion status, completeness and the release decision are never stored there (section D).
// Usage: node tools/a11y-coverage.mjs [--root <dir>] [--blank AA|AAA]
//   exit 0 valid; 1 invalid; 2 missing or unreadable input. --blank prints a starting coverage file.
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REC = 'https://www.w3.org/TR/2024/REC-WCAG22-20241212/';
// The 86 success criteria of the W3C Recommendation of 12 December 2024, by level; 4.1.1 is obsolete and removed.
export const WCAG = {
  A: '1.1.1 1.2.1 1.2.2 1.2.3 1.3.1 1.3.2 1.3.3 1.4.1 1.4.2 2.1.1 2.1.2 2.1.4 2.2.1 2.2.2 2.3.1 2.4.1 2.4.2 2.4.3 2.4.4 2.5.1 2.5.2 2.5.3 2.5.4 3.1.1 3.2.1 3.2.2 3.2.6 3.3.1 3.3.2 3.3.7 4.1.2'.split(' '),
  AA: '1.2.4 1.2.5 1.3.4 1.3.5 1.4.3 1.4.4 1.4.5 1.4.10 1.4.11 1.4.12 1.4.13 2.4.5 2.4.6 2.4.7 2.4.11 2.5.7 2.5.8 3.1.2 3.2.3 3.2.4 3.3.3 3.3.4 3.3.8 4.1.3'.split(' '),
  AAA: '1.2.6 1.2.7 1.2.8 1.2.9 1.3.6 1.4.6 1.4.7 1.4.8 1.4.9 2.1.3 2.2.3 2.2.4 2.2.5 2.2.6 2.3.2 2.3.3 2.4.8 2.4.9 2.4.10 2.4.12 2.4.13 2.5.5 2.5.6 3.1.3 3.1.4 3.1.5 3.1.6 3.2.5 3.3.5 3.3.6 3.3.9'.split(' '),
};
const seq = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);
// The owner's register rows, by kind, with the authority each carries in the register.
export const REGISTER = {
  process: { ids: seq('P', 11), authority: 'proposed_project_process_policy' },
  supplementary: { ids: seq('SUP', 5), authority: 'recommended_house_requirement' },
  conformance: { ids: seq('CONF', 5), authority: 'normative_web_conformance_condition' },
  native: { ids: seq('N', 8), authority: 'informative_native_interpretation' },
};
export const IDS = [...WCAG.A, ...WCAG.AA, ...WCAG.AAA, ...Object.values(REGISTER).flatMap((k) => k.ids)];
const RANK = { A: 1, AA: 2, AAA: 3 };
export const FEATURE_STATES = ['present', 'absent', 'unknown'];
export const APPLICABILITY = ['applicable', 'not_applicable', 'unresolved'];
export const ADOPTION = ['required', 'advisory', 'not_adopted'];
// A method's kind fixes the result states it can record: a heuristic never passes, an indicator's failure is only a
// candidate, a capture is material no tool here analyses, and a human method left unsought reads unverified.
export const METHOD_KINDS = {
  check: ['pass', 'fail', 'blocked', 'error', 'not_run'],
  indicator: ['pass', 'candidate', 'blocked', 'error', 'not_run'],
  heuristic: ['candidate', 'reviewed', 'blocked', 'error', 'not_run'],
  capture: ['unverified', 'blocked', 'error', 'not_run'],
  record: ['pass', 'fail', 'blocked', 'error', 'not_run'],
  human: ['pass', 'fail', 'unverified', 'not_run'],
};
export const METHOD_RESULTS = ['pass', 'fail', 'blocked', 'error', 'not_run', 'candidate', 'reviewed', 'unverified'];
// The four outcomes of section D, kept apart: each has its own vocabulary and its own home.
// 1. A run's suite result: coverage.json holds the last extended run's; the report holds every run's.
export const SUITE_RESULTS = ['passed', 'failed', 'error', 'empty', 'blocked'];
// 2. Each criterion's status, derived by the report, never stored in coverage.json, never "conforms".
export const CRITERION_STATUSES = ['failed', 'checked', 'unverified', 'blocked', 'not_applicable'];
// 3. Assessment completeness: counts of 2 over applicable rows, derived by the report.
// 4. The release decision: the owner's, in the project's decisions, in neither file.
const DERIVED = ['status', 'criterion_status', 'completeness', 'release', 'release_decision', 'decision', 'conforms', 'conformance', 'claim'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const validDate = (s) => { const d = typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s) : null; return !!d && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const relPath = (s) => text(s) && !/^(\/|~|[A-Za-z]:|[a-z][a-z0-9+.-]*:)/i.test(s) && !s.split(/[\\/]/).includes('..');
const keysOnly = (o, allowed, where, fails) => {
  for (const k of Object.keys(o)) {
    if (DERIVED.includes(k)) fails.push(`${where}: "${k}" is derived by the report or decided by the owner, never stored here (section D)`);
    else if (!allowed.includes(k)) fails.push(`${where}: unknown field "${k}"`);
  }
};
const kindOf = (id) => (/^\d/.test(id) ? 'wcag' : Object.entries(REGISTER).find(([, k]) => k.ids.includes(id))?.[0]);
const levelOf = (id) => Object.keys(WCAG).find((l) => WCAG[l].includes(id)) || null;
const triggerFeatures = (t) => (t?.all || t?.any || []);

export function validateCatalogue(cat) {
  const fails = [];
  if (!isObj(cat)) return ['catalogue: not a JSON object'];
  if (!Number.isInteger(cat.version) || cat.version < 1) fails.push('catalogue: version must be a positive whole number');
  if (cat.sources?.S01?.url !== REC || cat.sources?.S01?.version !== '2024-12-12') fails.push(`catalogue: sources.S01 must pin WCAG 2.2 at ${REC}`);
  if (!isObj(cat.sources?.register) || !text(cat.sources.register.version)) fails.push('catalogue: sources.register must name the register\'s version');
  const features = isObj(cat.features) ? cat.features : (fails.push('catalogue: features must be an object'), {});
  for (const [f, d] of Object.entries(features)) if (!/^[a-z][a-z0-9-]*$/.test(f) || !text(d)) fails.push(`catalogue: feature ${f} needs a kebab-case name and a description`);
  const methods = isObj(cat.methods) ? cat.methods : (fails.push('catalogue: methods must be an object'), {});
  for (const [m, d] of Object.entries(methods)) {
    if (!['standard', 'extended'].includes(d?.depth) || !METHOD_KINDS[d?.kind] || !text(d?.tool) || !text(d?.evidence)) fails.push(`catalogue: method ${m} needs a depth (standard or extended), a kind (${Object.keys(METHOD_KINDS).join(', ')}), a tool and the evidence it needs`);
    // A feature-bound method runs only when its feature is present.
    if (d?.when !== undefined && !(isObj(d.when) && Object.keys(d.when).length === 1 && Array.isArray(d.when.all || d.when.any) && triggerFeatures(d.when).length && triggerFeatures(d.when).every((f) => f in features))) fails.push(`catalogue: method ${m}'s when must be {all: [features]} or {any: [features]} from the catalogue's features`);
  }
  if (!Array.isArray(cat.rows)) return [...fails, 'catalogue: rows must be an array'];
  const seen = new Set();
  for (const row of cat.rows) {
    const id = row?.id, at = `catalogue row ${id}`;
    if (!IDS.includes(id)) { fails.push(`catalogue: unknown row ${JSON.stringify(id)}`); continue; }
    if (seen.has(id)) { fails.push(`${at}: duplicated`); continue; }
    seen.add(id);
    const kind = kindOf(id), level = levelOf(id);
    if (row.kind !== kind) fails.push(`${at}: kind must be ${kind}`);
    if (row.level !== level) fails.push(`${at}: level must be ${level ?? 'null'}`);
    if (!text(row.title)) fails.push(`${at}: needs a title`);
    const authority = kind === 'wcag' ? 'normative_web_criterion' : REGISTER[kind].authority;
    if (row.authority !== authority) fails.push(`${at}: authority must be ${authority}`);
    const src = row.source;
    if (!isObj(src) || !Array.isArray(src.ids) || !src.ids.length || !text(src.anchor)) fails.push(`${at}: source needs ids and an anchor`);
    else if (kind === 'wcag' && !src.anchor.startsWith(REC + '#')) fails.push(`${at}: source anchor must be in ${REC}`);
    else if (['process', 'supplementary'].includes(kind) && src.anchor !== `register#${id}`) fails.push(`${at}: source anchor must be register#${id}`);
    else if (['conformance', 'native'].includes(kind) && !/^https:\/\/www\.w3\.org\/TR\//.test(src.anchor)) fails.push(`${at}: source anchor must be a W3C TR link`);
    // The register's 84 rows keep its record verbatim; the 31 AAA rows, absent from it, carry a lab summary of S01.
    if (level === 'AAA') {
      if (row.register !== undefined || !text(row.summary)) fails.push(`${at}: an AAA row carries a summary of S01 and no register record`);
    } else {
      const r = row.register, rid = kind === 'native' ? r?.interpretation_id : r?.requirement_id;
      if (!isObj(r) || rid !== (kind === 'wcag' ? `WCAG22-${id}` : id)) fails.push(`${at}: needs the register's record for ${id}, verbatim`);
      else if (kind === 'wcag' && (r.wcag_id !== id || r.title !== row.title || r.level !== level)) fails.push(`${at}: register record disagrees on ID, title or level`);
      if (row.summary !== undefined) fails.push(`${at}: a register row keeps the register's wording, not a summary`);
    }
    const t = row.trigger;
    const shapes = isObj(t) ? Object.keys(t) : [];
    if (!(shapes.length === 1 && ((t.always === true) || (Array.isArray(t.all) && t.all.length >= 1) || (Array.isArray(t.any) && t.any.length >= 2)))) fails.push(`${at}: trigger must be {always: true}, {all: [features]} or {any: [two or more features]}`);
    for (const f of triggerFeatures(t)) if (!(f in features)) fails.push(`${at}: trigger names unknown feature ${f}`);
    const classes = row.classes;
    if (!Array.isArray(classes) || classes.some((c) => ![1, 2, 3].includes(c)) || new Set(classes).size !== classes.length || classes.join() !== [...classes].sort().join()) fails.push(`${at}: classes must be an ascending list drawn from 1, 2 and 3`);
    else {
      if (classes.includes(1) && t?.always) fails.push(`${at}: class 1 is not applicable by design only while a feature is absent, so it needs a feature trigger`);
      for (const m of [...(row.methods?.standard || []), ...(row.methods?.extended || [])]) {
        if (classes.includes(2) && ['check', 'indicator'].includes(methods[m?.method]?.kind)) fails.push(`${at}: class 2 is human judgement only, so ${m.method} cannot check it`);
      }
    }
    if (!isObj(row.methods) || !Array.isArray(row.methods.standard) || !Array.isArray(row.methods.extended)) { fails.push(`${at}: methods needs standard and extended lists`); continue; }
    for (const depth of ['standard', 'extended']) {
      const used = new Set();
      for (const m of row.methods[depth]) {
        const def = methods[m?.method];
        if (!def) { fails.push(`${at}: unknown method ${m?.method}`); continue; }
        if (def.depth !== depth) fails.push(`${at}: ${m.method} is ${def.depth === 'extended' ? 'an' : 'a'} ${def.depth} method, listed under ${depth}`);
        if (used.has(m.method)) fails.push(`${at}: ${m.method} listed twice under ${depth}`);
        used.add(m.method);
        if (!text(m.checks)) fails.push(`${at}: ${m.method} needs what it checks for this row`);
        if (m.method === 'axe' ? !(Array.isArray(m.rules) && m.rules.length && m.rules.every(text)) : m.rules !== undefined) fails.push(`${at}: ${m.method === 'axe' ? 'axe needs the rules credited to this row' : `only axe lists rules, not ${m.method}`}`);
      }
    }
    if (!text(row.human)) fails.push(`${at}: needs what stays human`);
    if (row.note !== undefined && !text(row.note)) fails.push(`${at}: an empty note`);
  }
  for (const id of IDS) if (!seen.has(id)) fails.push(`catalogue: row ${id} missing`);
  return fails;
}

// A row's applicability as its features decide it: an unknown feature never reads as absent.
export function applicability(row, features) {
  const t = row.trigger || {};
  if (t.always) return { state: 'applicable', absent: [] };
  const state = (f) => features?.[f]?.state ?? 'unknown';
  const list = triggerFeatures(t), absent = list.filter((f) => state(f) === 'absent');
  if (t.all) return absent.length ? { state: 'not_applicable', absent } : { state: list.some((f) => state(f) === 'unknown') ? 'unresolved' : 'applicable', absent: [] };
  if (list.some((f) => state(f) === 'present')) return { state: 'applicable', absent: [] };
  return absent.length === list.length ? { state: 'not_applicable', absent } : { state: 'unresolved', absent: [] };
}

// The adoption a row may take at the project's level: criteria at or below it are required; P08 is recommended,
// dated and never gated (ruling 9); house requirements are the project's choice.
export function adoptions(row, level) {
  if (row.kind === 'wcag') return RANK[row.level] <= RANK[level] ? ['required'] : ['not_adopted', 'advisory'];
  if (row.id === 'P08') return ['advisory'];
  return { process: ['required'], conformance: ['required'], supplementary: ['advisory', 'required'], native: ['required', 'advisory'] }[row.kind];
}

export function validateCoverage(cov, cat) {
  const fails = [];
  if (!isObj(cov)) return ['coverage: not a JSON object'];
  keysOnly(cov, ['catalogue', 'level', 'features', 'rows', 'runs'], 'coverage', fails);
  if (cov.catalogue !== cat.version) fails.push(`coverage: catalogue must be ${cat.version}, the catalogue's version`);
  if (!['AA', 'AAA'].includes(cov.level)) fails.push('coverage: level must be AA or AAA, the adopted digest\'s');
  const vocabulary = Object.keys(cat.features || {});
  const features = isObj(cov.features) ? cov.features : (fails.push('coverage: features must be an object'), {});
  for (const f of vocabulary) {
    const d = features[f];
    if (!isObj(d)) { fails.push(`coverage: feature ${f} undeclared; declare it unknown until it is known`); continue; }
    keysOnly(d, ['state', 'evidence'], `coverage feature ${f}`, fails);
    if (!FEATURE_STATES.includes(d.state)) fails.push(`coverage feature ${f}: state must be present, absent or unknown`);
    else if (d.state !== 'unknown' && !text(d.evidence)) fails.push(`coverage feature ${f}: ${d.state} needs its evidence`);
  }
  for (const f of Object.keys(features)) if (!vocabulary.includes(f)) fails.push(`coverage: feature ${f} is not in the catalogue`);
  // A feature with no valid state reads as unknown, never absent.
  const decided = Object.fromEntries(vocabulary.map((f) => [f, { state: FEATURE_STATES.includes(features[f]?.state) ? features[f].state : 'unknown' }]));
  const runs = isObj(cov.runs) ? cov.runs : (fails.push('coverage: runs must be an object'), {});
  keysOnly(runs, ['extended'], 'coverage runs', fails);
  const run = runs.extended ?? null;
  if (run !== null) {
    if (!isObj(run)) fails.push('coverage runs.extended: must be null or a run');
    else {
      keysOnly(run, ['date', 'tree', 'suite', 'bundle'], 'coverage runs.extended', fails);
      if (!validDate(run.date)) fails.push('coverage runs.extended: date must be YYYY-MM-DD');
      if (!/^[0-9a-f]{40}$/.test(run.tree ?? '')) fails.push('coverage runs.extended: tree must be the tested tree\'s 40-character hash');
      if (!SUITE_RESULTS.includes(run.suite)) fails.push(`coverage runs.extended: suite must be one of ${SUITE_RESULTS.join(', ')}`);
      if (!relPath(run.bundle)) fails.push('coverage runs.extended: bundle must be a relative path');
    }
  }
  const rows = isObj(cov.rows) ? cov.rows : (fails.push('coverage: rows must be an object keyed by ID'), {});
  const byId = new Map((cat.rows || []).map((r) => [r.id, r]));
  for (const id of byId.keys()) if (!(id in rows)) fails.push(`coverage: row ${id} missing`);
  for (const [id, row] of Object.entries(rows)) {
    const def = byId.get(id), at = `coverage row ${id}`;
    if (!def) { fails.push(`coverage: row ${id} is not in the catalogue`); continue; }
    if (!isObj(row)) { fails.push(`${at}: must be an object`); continue; }
    keysOnly(row, ['adoption', 'applicability', 'evidence', 'results'], at, fails);
    const allowed = ['AA', 'AAA'].includes(cov.level) ? adoptions(def, cov.level) : ADOPTION;
    if (!allowed.includes(row.adoption)) fails.push(`${at}: adoption must be ${allowed.join(' or ')} at level ${cov.level}`);
    const a = row.applicability, computed = applicability(def, decided), trigger = triggerFeatures(def.trigger);
    if (!isObj(a) || !APPLICABILITY.includes(a.state)) fails.push(`${at}: applicability must be applicable, not_applicable or unresolved`);
    else {
      for (const k of Object.keys(a)) if (!['state', 'absent'].includes(k)) fails.push(`${at}: applicability takes no "${k}"; the only reason a row is not applicable is its own trigger feature declared absent, never difficulty, tooling or effort`);
      if (a.state !== 'not_applicable' && a.absent !== undefined) fails.push(`${at}: only a not-applicable row names absent features`);
      if (a.state === 'not_applicable') {
        const named = Array.isArray(a.absent) ? a.absent : [];
        if (def.trigger?.always) fails.push(`${at}: applies to every product; no declared feature can make it not applicable`);
        else if (!named.length) fails.push(`${at}: not applicable needs the absent trigger feature as its reason`);
        for (const f of named) {
          if (!trigger.includes(f)) fails.push(`${at}: names ${f}, which is not this row's trigger (${trigger.join(', ')})`);
          else if (decided[f].state === 'unknown') fails.push(`${at}: ${f} is unknown, and an unknown feature is never read as absent`);
          else if (decided[f].state === 'present') fails.push(`${at}: ${f} is declared present`);
        }
        if (def.trigger?.any && trigger.some((f) => !named.includes(f))) fails.push(`${at}: applies if any of ${trigger.join(', ')} is present, so all must be named absent`);
      }
      // The features decide: present applies, absent may only be not applicable, unknown leaves it unresolved.
      if (a.state !== computed.state) fails.push(`${at}: ${a.state}, but its features make it ${computed.state}`);
    }
    const named = new Set([...def.methods.standard, ...def.methods.extended].map((m) => m.method));
    const extended = new Set(def.methods.extended.map((m) => m.method));
    const evidence = row.evidence ?? [];
    if (!Array.isArray(evidence)) fails.push(`${at}: evidence must be a list`);
    else for (const e of evidence) {
      if (!isObj(e)) { fails.push(`${at}: an evidence link must be an object`); continue; }
      keysOnly(e, ['method', 'ref'], `${at} evidence`, fails);
      if (!named.has(e.method)) fails.push(`${at}: evidence for ${e.method}, which the catalogue does not list for this row`);
      if (!relPath(e.ref)) fails.push(`${at}: evidence for ${e.method} must link a relative path`);
    }
    const results = row.results ?? [];
    if (!Array.isArray(results)) { fails.push(`${at}: results must be a list`); continue; }
    if (results.length && a?.state === 'not_applicable') fails.push(`${at}: a not-applicable row records no results`);
    for (const r of results) {
      if (!isObj(r)) { fails.push(`${at}: a result must be an object`); continue; }
      keysOnly(r, ['method', 'state', 'date', 'ref', 'note'], `${at} result`, fails);
      const kind = cat.methods?.[r.method]?.kind;
      if (!named.has(r.method)) fails.push(`${at}: result for ${r.method}, which the catalogue does not list for this row`);
      else if (!extended.has(r.method)) fails.push(`${at}: ${r.method} is a standard method; its results stay in the run's temporary folder, since the gate writes nothing in the checkout`);
      else if (!METHOD_KINDS[kind].includes(r.state)) fails.push(`${at}: ${r.method} is a ${kind} method and records ${METHOD_KINDS[kind].join(', ')}, not ${JSON.stringify(r.state)}`);
      if (!validDate(r.date)) fails.push(`${at}: result for ${r.method} needs a YYYY-MM-DD date`);
      else if (!isObj(run)) fails.push(`${at}: result for ${r.method} recorded with no extended run`);
      else if (validDate(run.date) && r.date > run.date) fails.push(`${at}: result for ${r.method} is dated after the last extended run`);
      if (!relPath(r.ref)) fails.push(`${at}: result for ${r.method} must link its evidence by relative path`);
      if (r.note !== undefined && !text(r.note)) fails.push(`${at}: an empty note`);
    }
  }
  // A run reads passed only when a check method passed on its date and nothing on its date failed, errored, was
  // blocked or was not run; candidates, captures and records alone never make a run pass.
  if (isObj(run) && run.suite === 'passed') {
    const today = Object.values(rows).flatMap((r) => (Array.isArray(r?.results) ? r.results : [])).filter((r) => r?.date === run.date);
    if (!today.some((r) => r.state === 'pass' && cat.methods?.[r.method]?.kind === 'check')) fails.push('coverage runs.extended: passed with no check passing on its date; an empty run, or one of candidates alone, is never a pass');
    if (today.some((r) => ['fail', 'error', 'blocked', 'not_run'].includes(r.state))) fails.push('coverage runs.extended: passed, but a result on its date failed, errored, was blocked or was not run');
  }
  return fails;
}

// A starting coverage file: every feature unknown, every row's applicability as unknown features leave it.
export function blankCoverage(cat, level = 'AAA') {
  const features = Object.fromEntries(Object.keys(cat.features).map((f) => [f, { state: 'unknown', evidence: '' }]));
  const rows = Object.fromEntries(cat.rows.map((r) => {
    const { state } = applicability(r, features);
    return [r.id, { adoption: adoptions(r, level)[0], applicability: { state }, evidence: [], results: [] }];
  }));
  return { catalogue: cat.version, level, features, rows, runs: { extended: null } };
}

// Run as a script: by real paths, so a symlinked folder, as /tmp and /var are on macOS, still runs it (as suite-once.mjs does).
if (process.argv[1] && (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })()) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const root = resolve(opt('--root') ?? '.');
  const load = (file) => {
    try { return JSON.parse(readFileSync(join(root, file), 'utf8')); } catch (error) { console.error(`a11y-coverage: cannot read ${file}: ${error.message}`); process.exit(2); }
  };
  const cat = load('project/a11y/catalogue.json');
  const catFails = validateCatalogue(cat);
  if (args.includes('--blank')) {
    const level = opt('--blank');
    if (!['AA', 'AAA'].includes(level) || catFails.length) { console.error(catFails.length ? `a11y-coverage: the catalogue is invalid (${catFails.length} failure(s))` : 'a11y-coverage: --blank takes AA or AAA'); process.exit(2); }
    process.stdout.write(JSON.stringify(blankCoverage(cat, level), null, 2) + '\n');
  } else {
    const fails = catFails.length ? catFails : validateCoverage(load('project/a11y/coverage.json'), cat);
    for (const f of fails) console.log(`FAIL  ${f}`);
    console.log(`a11y-coverage: ${cat.rows?.length ?? 0} rows; ${fails.length} failure(s)`);
    process.exitCode = fails.length ? 1 : 0;
  }
}
