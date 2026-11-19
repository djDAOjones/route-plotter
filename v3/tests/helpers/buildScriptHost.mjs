/**
 * The process that imports build.js for its tests (SPL-06). Started by
 * buildScriptHarness.js, which says why no test worker imports it, in a copy
 * of the repository: that copy is its working directory, and it has the
 * worker's environment, arguments and Node flags, pointed at the copy.
 *
 * Its watch is installed before build.js loads. It observes the APIs and the
 * state of this process named below, not every effect a module can have: it
 * is not a sandbox, and what build.js did by another route would go unseen.
 * It observes each call into fs, fs/promises and child_process (their
 * functions, and the functions those carry, such as fs.realpathSync.native),
 * and each timer or other piece of pending work started, while build.js's own
 * code is on the stack (Node loading the module and its imports is not
 * counted); everything printed; and this process's working directory,
 * environment, exit code, listeners and file-creation mask, compared before
 * and after. It then imports build.js and reports what that did: natively,
 * twice (a second evaluation in one process), or through vm with an
 * import.meta that has no `main`, as Node 24.0 and 24.1 give. After a native
 * import it serves calls to the exports, each answered with what the call
 * touched, started and printed, whether its arguments changed, and what of
 * that process state it changed.
 *
 * In mode `script` it is `node build.js` on Node 24.0 or 24.1: build.js is
 * evaluated through vm, unwatched, with its path as process.argv[1].
 */

import { createHook } from 'node:async_hooks';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import { createRequire, isBuiltin, syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';
import { serialize } from 'node:v8';
import vm from 'node:vm';

// Long enough for work build.js deferred while it was imported to show.
const SETTLE_MS = 100;

let buildFrame = null; // matches a stack frame in build.js's code
let strays = activity(); // what build.js did outside any import or call
let current = strays; // where what it does is recorded now

function activity() {
  return { calls: [], pending: [], output: [] };
}

/** Whether build.js's own code is running: one of its frames is on the stack. */
function fromBuild() {
  if (!buildFrame) return false;
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;
  const { stack } = new Error();
  Error.stackTraceLimit = limit;
  return buildFrame.test(stack);
}

function shown(value) {
  if (typeof value === 'string') return value;
  if (value instanceof URL) return value.href;
  if (Buffer.isBuffer(value)) return value.toString();
  return typeof value;
}

/** A function to watch: classes, named with a capital, are left alone. */
function watchable(key, value) {
  return typeof value === 'function' && !(typeof key === 'string' && /^[A-Z]/.test(key));
}

const wrappers = new WeakMap(); // each function watched, and what replaced it

/**
 * The function, recording each call build.js makes to it. What it carries
 * stays reachable, and a function it carries (realpathSync.native,
 * promisify's custom forms) is watched in turn: calling it directly is a call
 * like any other.
 */
function watched(label, original) {
  if (wrappers.has(original)) return wrappers.get(original);
  const wrapper = function (...args) {
    if (fromBuild()) current.calls.push(`${label}(${shown(args[0])})`);
    return Reflect.apply(original, this, args);
  };
  wrappers.set(original, wrapper);
  for (const key of Reflect.ownKeys(original)) {
    if (['length', 'name', 'prototype', 'arguments', 'caller'].includes(key)) continue;
    const property = Object.getOwnPropertyDescriptor(original, key);
    if ('value' in property && watchable(key, property.value)) {
      const name = typeof key === 'symbol' ? `${label}[${key.description}]` : `${label}.${key}`;
      property.value = watched(name, property.value);
    }
    Object.defineProperty(wrapper, key, property);
  }
  return wrapper;
}

/** Record each call build.js makes to an API's functions. */
function watchCalls(label, api) {
  for (const name of Object.keys(api)) {
    const original = api[name];
    if (watchable(name, original)) api[name] = watched(`${label}.${name}`, original);
  }
}

/** A value the IPC channel can carry: itself when it can, else its description. */
function sendable(value) {
  try {
    serialize(value);
    return value;
  } catch {
    return inspect(value);
  }
}

/** Keep everything printed, by any route, instead of printing it. */
function watchOutput() {
  for (const level of ['debug', 'info', 'log', 'warn', 'error']) {
    console[level] = (...args) => current.output.push({ level, args: args.map(sendable) });
  }
  for (const name of ['stdout', 'stderr']) {
    process[name].write = (chunk, encoding, callback) => {
      current.output.push({ stream: name, text: String(chunk) });
      const done = typeof encoding === 'function' ? encoding : callback;
      if (typeof done === 'function') process.nextTick(done);
      return true;
    };
  }
}

function watch() {
  watchCalls('fs', fs);
  watchCalls('fs.promises', fs.promises);
  watchCalls('child_process', childProcess);
  // `import { readFileSync } from 'node:fs'` reads these bindings, not the object.
  syncBuiltinESMExports();
  createHook({
    init(_asyncId, type) {
      // Promises are not counted: evaluating build.js itself makes one. A
      // callback of build.js's own is watched when it runs.
      if (type !== 'PROMISE' && fromBuild()) current.pending.push(type);
    },
  }).enable();
  watchOutput();
}

/**
 * The state of this process the watch compares: what an import, and each call
 * to an export, must leave as it was.
 */
function processState() {
  return {
    cwd: process.cwd(),
    environment: JSON.stringify(Object.entries(process.env).sort(([a], [b]) => (a < b ? -1 : 1))),
    exitCode: String(process.exitCode),
    listeners: process.eventNames().map(event => `${String(event)}:${process.listenerCount(event)}`).sort().join(),
    // Node can read the mask only by setting it and setting it back
    // (DEP0139); only a file created on another thread in between would see.
    umask: process.umask().toString(8),
  };
}

/** The names of what differs between two readings of processState(). */
function stateChanges(before, after) {
  return Object.keys(before).filter(key => before[key] !== after[key]);
}

async function watchedEvaluation(evaluate) {
  const seen = activity();
  current = seen;
  const before = processState();
  let namespace = null;
  let error = null;
  try {
    namespace = await evaluate();
  } catch (thrown) {
    error = thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
  }
  await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
  await new Promise(resolve => setImmediate(resolve));
  current = strays;
  const after = processState();
  return {
    namespace,
    report: {
      exports: namespace ? Object.keys(namespace).sort() : null,
      error,
      ...seen,
      changed: stateChanges(before, after),
    },
  };
}

/**
 * Evaluate build.js as Node 24.0 and 24.1 would: the same source and imports,
 * an import.meta without `main`.
 */
async function evaluateWithoutImportMetaMain(modulePath) {
  const url = pathToFileURL(modulePath).href;
  const require = createRequire(modulePath);
  const resolve = specifier => (isBuiltin(specifier) ? specifier : pathToFileURL(require.resolve(specifier)).href);
  const module = new vm.SourceTextModule(fs.readFileSync(modulePath, 'utf8'), {
    identifier: url,
    initializeImportMeta(meta) {
      meta.dirname = path.dirname(modulePath);
      meta.filename = modulePath;
      meta.resolve = resolve;
      meta.url = url;
    },
    importModuleDynamically: specifier => import(new URL(specifier, url).href),
  });
  await module.link(async specifier => {
    const namespace = await import(resolve(specifier));
    const names = Object.keys(namespace);
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, namespace[name]);
    }, { identifier: `${specifier}, as build.js imports it` });
  });
  await module.evaluate();
  return module.namespace;
}

/**
 * Call an export, and answer with its outcome, what it did (as `activity`),
 * whether it changed its arguments, and what of processState() it changed:
 * compared for each call, since the import's comparison is long past.
 */
function serve(build, { name, args }) {
  const argumentsBefore = serialize(args);
  const stateBefore = processState();
  const seen = activity();
  current = seen;
  let outcome;
  try {
    const value = build[name](...args);
    // The same object back cannot cross the channel; its position can.
    const sameAs = typeof value === 'object' && value !== null ? args.indexOf(value) : -1;
    if (sameAs !== -1) {
      outcome = { sameAs };
    } else {
      serialize(value);
      outcome = { value };
    }
  } catch (error) {
    outcome = { error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) } };
  } finally {
    current = strays;
  }
  return {
    ...outcome,
    ...seen,
    argumentsChanged: !serialize(args).equals(argumentsBefore),
    changed: stateChanges(stateBefore, processState()),
  };
}

export async function start({ mode, buildPath }) {
  if (mode === 'script') {
    // Node runs a script from its real path; argv[1] keeps the path as typed.
    await evaluateWithoutImportMetaMain(fs.realpathSync(process.argv[1]));
    return;
  }

  // Whatever build.js left running, this process ends with the test run.
  process.once('disconnect', () => process.exit(0));
  const modulePath = fs.realpathSync(buildPath);
  const url = pathToFileURL(modulePath).href;
  watch();
  buildFrame = new RegExp(`${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[?:]`);

  let build;
  let report;
  if (mode === 'import-without-main') {
    const only = await watchedEvaluation(() => evaluateWithoutImportMetaMain(modulePath));
    build = only.namespace;
    report = { first: only.report };
  } else {
    const first = await watchedEvaluation(() => import(url));
    const second = await watchedEvaluation(() => import(`${url}?again`));
    build = first.namespace;
    report = { importMetaMain: 'main' in import.meta, first: first.report, second: second.report };
  }

  // Listening also keeps this process alive until the harness stops it.
  process.on('message', ({ id, type, name, args }) => {
    if (type === 'strays') {
      const taken = strays;
      strays = activity();
      current = strays;
      process.send({ id, ...taken });
    } else {
      process.send({ id, ...serve(build, { name, args }) });
    }
  });
  process.send({ id: 0, report });
}
