/**
 * Fail the run when suspiciously little of the suite actually ran (TST-10).
 *
 * This suite has been silently disabled before: a setup file threw, vitest
 * reported "no tests" and exited 0, which reads as green. A floor under the
 * files and the *executed* tests turns that into a red run — counting
 * collected tests instead would let a wholesale `skip` through.
 *
 * It applies to a plain, unfiltered run, which is what `npm run check` and CI
 * do. A filtered run, `--changed`, and watch reruns are exempt. Note that
 * passing `--reporter` on the command line replaces the configured reporters,
 * and with them this check.
 */

const MIN_FILES = 72;
const MIN_TESTS = 1000;
const EXECUTED = new Set(['passed', 'failed']);

export default class MinCountReporter {
  onInit(ctx) {
    this.ctx = ctx;
    this.runs = 0;
  }

  isExempt() {
    const config = this.ctx?.config ?? {};
    this.runs += 1;
    return Boolean(config.testNamePattern)
      || Boolean(config.changed)
      || Boolean(config.related?.length)
      || (this.ctx?.filenamePattern?.length ?? 0) > 0
      || (this.ctx?.args?.length ?? 0) > 0
      // In watch mode only the first, full run is the whole suite.
      || (config.watch && this.runs > 1);
  }

  onTestRunEnd(testModules = []) {
    if (this.isExempt()) return;

    let files = 0;
    let tests = 0;
    for (const module of testModules) {
      const executed = countExecuted(module);
      if (executed > 0) files += 1;
      tests += executed;
    }

    const problems = [];
    if (files < MIN_FILES) problems.push(`${files} test files ran, expected at least ${MIN_FILES}`);
    if (tests < MIN_TESTS) problems.push(`${tests} tests ran, expected at least ${MIN_TESTS}`);
    if (problems.length === 0) return;

    console.error(`\n❌ Suite too small — ${problems.join('; ')}.`);
    console.error('   Something stopped the suite from running, so a green result here would be false.');
    process.exitCode = 1;
  }
}

function countExecuted(testModule) {
  try {
    let executed = 0;
    for (const test of testModule.children.allTests()) {
      if (EXECUTED.has(test.result()?.state)) executed += 1;
    }
    return executed;
  } catch {
    return 0;
  }
}
