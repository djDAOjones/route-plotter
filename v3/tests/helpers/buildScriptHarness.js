/**
 * Run and import build.js only in a copy of the repository (SPL-06).
 *
 * Run, build.js builds where it runs: version.json bumped and docs/ replaced,
 * relative to its working directory. Imported, it must start nothing, which
 * its tests check; but if its entry guard broke, the import would start that
 * same build. Neither may ever happen in the repository, so every run and
 * every import of build.js made here happens in a fresh copy of it:
 *
 * - No test worker imports build.js. A Vitest worker thread cannot change its
 *   working directory (process.chdir is unsupported in workers), so an
 *   import there would resolve the build's paths against the repository,
 *   whichever copy of the file it loaded. A child process imports the copy's
 *   build.js instead, with the copy as its working directory, and the tests
 *   call the exports in that process (buildScriptHost.mjs, which also says
 *   what it observes: the APIs and process state it names, not every
 *   effect).
 * - That process has the worker's environment, arguments and Node flags,
 *   every path into the repository pointed at the copy, so a guard broken
 *   only for what a test import sees (Vitest's environment variables, a
 *   command line asking for no particular build, so a release) breaks there.
 * - A script run (`node build.js ...`) runs the copy's build.js, in the copy.
 *
 * The copy holds every file at the repository's top level except hidden ones
 * (so no .git) and the five directories the build reads or writes; its
 * node_modules is a link to the repository's. What a test finds changed in
 * it is the evidence; the repository is never reached.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const projectRoot = join(here, '..', '..');
const HOST = pathToFileURL(join(here, 'buildScriptHost.mjs')).href;
const BUILD_DIRECTORIES = new Set(['docs', 'images', 'scripts', 'src', 'styles']);
// Node 24 keeps vm modules behind a flag, and warns when they are used.
const VM_FLAGS = ['--experimental-vm-modules', '--disable-warning=ExperimentalWarning'];
const SPAWN_TIMEOUT = 120000;

/** A fresh copy of the repository, as the build sees it. */
export function copyRepository() {
  const root = mkdtempSync(join(tmpdir(), 'route-plotter-repository-'));
  for (const entry of readdirSync(projectRoot, { withFileTypes: true })) {
    const copied = !entry.name.startsWith('.') &&
      (entry.isFile() || (entry.isDirectory() && BUILD_DIRECTORIES.has(entry.name)));
    if (copied) {
      cpSync(join(projectRoot, entry.name), join(root, entry.name), { recursive: true, dereference: true });
    }
  }
  symlinkSync(realpathSync(join(projectRoot, 'node_modules')), join(root, 'node_modules'), 'dir');
  return root;
}

export function removeCopy(root) {
  // The link first, so that removing the copy cannot reach what it points to.
  unlinkSync(join(root, 'node_modules'));
  rmSync(root, { recursive: true, force: true });
}

/**
 * Every entry under a directory, as {relative path: SHA-256 of a file's bytes,
 * 'directory', or a link's target}. Links are not followed.
 */
export function snapshotTree(root, relativeDir = '', entries = {}) {
  for (const entry of readdirSync(join(root, relativeDir), { withFileTypes: true })) {
    const name = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const file = join(root, name);
    if (entry.isSymbolicLink()) {
      entries[name] = `link to ${readlinkSync(file)}`;
    } else if (entry.isDirectory()) {
      entries[name] = 'directory';
      snapshotTree(root, name, entries);
    } else {
      entries[name] = createHash('sha256').update(readFileSync(file)).digest('hex');
    }
  }
  return entries;
}

/** What differs between two snapshots, one line per entry. */
export function treeChanges(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .sort()
    .filter(name => before[name] !== after[name])
    .map(name => `${!(name in after) ? 'removed' : !(name in before) ? 'added' : 'changed'} ${name}`);
}

/** Text with every path into the repository pointed at the copy instead. */
function pointedAtCopy(text, copyRoot) {
  // The longer spelling first: one may contain the other (/tmp, /private/tmp).
  const roots = [...new Set([realpathSync(projectRoot), projectRoot])].sort((a, b) => b.length - a.length);
  return roots.reduce((result, root) => result.split(root).join(copyRoot), text);
}

/** This worker's environment, for a process working in the copy. */
export function childEnvironment(copyRoot) {
  const environment = Object.fromEntries(
    Object.entries(process.env).map(([name, value]) => [name, pointedAtCopy(value, copyRoot)])
  );
  environment.PWD = copyRoot;
  return environment;
}

/** This worker's arguments after Node's own path: what process.argv[1...] will hold. */
export function childArguments(copyRoot) {
  return process.argv.slice(1).map(argument => pointedAtCopy(argument, copyRoot));
}

/** This worker's Node flags, but not a debugger's (its port is taken). */
function childFlags(copyRoot) {
  return process.execArgv
    .filter(flag => !/^--(inspect|debug)/.test(flag))
    .map(flag => pointedAtCopy(flag, copyRoot));
}

/** Node's arguments to run the host with this configuration, then `argv`. */
function hostCommand(config, { flags, argv }) {
  const bootstrap = `const { start } = await import(${JSON.stringify(HOST)});\n` +
    `await start(${JSON.stringify(config)});\n`;
  return [...flags, '--input-type=module', '--eval', bootstrap, ...argv];
}

/**
 * Run a build.js as a script in the copy, as an npm script does (`node
 * build.js ...`). Without import.meta.main, as on Node 24.0 and 24.1, it is
 * evaluated through vm, with the script's path still in process.argv[1].
 */
export function runBuildScript(copyRoot, script, args, { importMetaMain = true } = {}) {
  const command = importMetaMain
    ? [script, ...args]
    : hostCommand({ mode: 'script' }, { flags: VM_FLAGS, argv: [script, ...args] });
  return spawnSync(process.execPath, command, {
    cwd: copyRoot,
    env: childEnvironment(copyRoot),
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT,
  });
}

/**
 * Import the copy's build.js in a child process working in the copy, and
 * resolve once that process has reported what the import did. Natively it is
 * imported twice; without import.meta.main (Node 24.0 and 24.1), once,
 * through vm. Rejects if the process ends before it reports.
 *
 * @returns {Promise<{report: Object, build: Object, call: Function,
 *   strays: Function, raw: {stdout: string, stderr: string}, stop: Function}>}
 *   `build` calls an export by name and resolves to what it returned (the
 *   very argument, when it returned one of its arguments), or rejects with
 *   what it threw, or because it changed an argument or the state of the
 *   process it ran in (the state the host compares; its answer's `changed`
 *   names what differs). Whatever the call printed is printed here, where
 *   the console guard judges it. `call` gives the whole answer, `strays` what
 *   build.js did outside the import and the calls, and `raw` what reached the
 *   process's own stdout and stderr (all of it once `stop` has resolved).
 */
export async function startBuildModule(copyRoot, { importMetaMain = true } = {}) {
  const config = { mode: importMetaMain ? 'import' : 'import-without-main', buildPath: join(copyRoot, 'build.js') };
  const flags = [...childFlags(copyRoot), ...(importMetaMain ? [] : VM_FLAGS)];
  const child = spawn(process.execPath, hostCommand(config, { flags, argv: childArguments(copyRoot) }), {
    cwd: copyRoot,
    env: childEnvironment(copyRoot),
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    serialization: 'advanced',
  });
  const raw = { stdout: '', stderr: '' };
  child.stdout.setEncoding('utf8').on('data', text => { raw.stdout += text; });
  child.stderr.setEncoding('utf8').on('data', text => { raw.stderr += text; });
  child.on('error', () => {});
  const ended = new Promise(resolve => child.once('exit', (code, signal) => resolve(signal ?? `exit ${code}`)));
  // Closed: ended, and everything it wrote to stdout and stderr read.
  const closed = new Promise(resolve => child.once('close', resolve));
  const failed = () => ended.then(how => {
    throw new Error(`the process that imported build.js ended (${how}) before it answered: ${raw.stderr}`);
  });
  const answers = new Map();
  child.on('message', ({ id, ...answer }) => {
    answers.get(id)?.(answer);
    answers.delete(id);
  });
  let lastId = 0;
  function ask(request) {
    const id = ++lastId;
    const answered = new Promise(resolve => answers.set(id, resolve));
    if (child.connected) child.send({ id, ...request });
    return Promise.race([answered, failed()]);
  }

  // A process that never reports is stopped, so that nothing outlives the test.
  const deadline = setTimeout(() => child.kill('SIGKILL'), SPAWN_TIMEOUT - 10000);
  const { report } = await Promise.race([new Promise(resolve => answers.set(0, resolve)), failed()])
    .finally(() => clearTimeout(deadline));

  async function call(name, args) {
    const answer = await ask({ type: 'call', name, args });
    for (const line of answer.output) {
      if (line.level) console[line.level](...line.args);
      else console[line.stream === 'stderr' ? 'error' : 'log'](line.text);
    }
    return answer;
  }

  const build = new Proxy({}, {
    get(_target, name) {
      if (typeof name !== 'string' || name === 'then') return undefined;
      return async (...args) => {
        const answer = await call(name, args);
        if (answer.argumentsChanged) throw new Error(`build.${name} changed the arguments it was given`);
        if (answer.changed.length > 0) {
          throw new Error(`build.${name} changed the process it ran in: ${answer.changed.join(', ')}`);
        }
        if (answer.error) throw Object.assign(new Error(answer.error.message), { name: answer.error.name });
        return 'sameAs' in answer ? args[answer.sameAs] : answer.value;
      };
    },
  });

  return {
    report,
    build,
    call,
    strays: () => ask({ type: 'strays' }),
    raw,
    async stop() {
      child.kill('SIGKILL');
      await closed;
    },
  };
}
