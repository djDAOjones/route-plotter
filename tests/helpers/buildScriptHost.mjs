/**
 * The process that imports build.js for its tests (SPL-06). Started by
 * buildScriptHarness.js, which says why no test worker imports it, in a copy
 * of the repository: that copy is its working directory, and it has the
 * worker's environment, arguments and Node flags, pointed at the copy.
 *
 * Its watch is installed before build.js loads, so that everything build.js
 * does is seen: each call into fs, fs/promises and child_process, and each
 * timer or other piece of pending work started, while build.js's own code is
 * on the stack (Node loading the module and its imports is not counted); and
 * everything printed. It then imports build.js and reports what that did:
 * natively, twice (a second evaluation in one process), or through vm with
 * an import.meta that has no `main`, as Node 24.0 and 24.1 give. After a
 * native import it serves calls to the exports, each answered with what the
 * call touched, started and printed, and whether its arguments changed.
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

/** Record each call build.js makes to an API's functions (classes are left alone). */
function watchCalls(label, api) {
  for (const name of Object.keys(api)) {
    const original = api[name];
    if (typeof original !== 'function' || /^[A-Z]/.test(name)) continue;
    const watched = function (...args) {
      if (fromBuild()) current.calls.push(`${label}.${name}(${shown(args[0])})`);
      return Reflect.apply(original, this, args);
    };
    // realpathSync.native, promisify's custom forms and the like stay reachable.
    for (const key of Reflect.ownKeys(original)) {
      if (!['length', 'name', 'prototype', 'arguments', 'caller'].includes(key)) {
        Object.defineProperty(watched, key, Object.getOwnPropertyDescriptor(original, key));
      }
    }
    api[name] = watched;
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

/** What an import must leave as it was in this process. */
function processState() {
  return {
    cwd: process.cwd(),
    environment: JSON.stringify(Object.entries(process.env).sort(([a], [b]) => (a < b ? -1 : 1))),
    exitCode: String(process.exitCode),
    listeners: process.eventNames().map(event => `${String(event)}:${process.listenerCount(event)}`).sort().join(),
  };
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
      changed: Object.keys(before).filter(key => before[key] !== after[key]),
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

function serve(build, { name, args }) {
  const before = serialize(args);
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
  return { ...outcome, ...seen, argumentsChanged: !serialize(args).equals(before) };
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
