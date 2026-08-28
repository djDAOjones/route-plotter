/**
 * ICE-03 — repeatable performance harness for Route Plotter.
 *
 * PERF-01 measured the cost curve by hand in a browser console; the numbers
 * went into the decision log but nothing could re-run them, so the next
 * optimisation decision would have been anecdotal again. This is that
 * measurement, written down once.
 *
 * **It has no pass/fail threshold, and it is deliberately not part of the
 * quality gate.** Frame timings depend on the machine, the browser and the
 * render surface, so a committed threshold would pass on one laptop and fail
 * on another while the code was identical — a red that means nothing is worse
 * than no check at all. Run it before and after an optimisation and compare
 * the two tables yourself.
 *
 * ## Running it
 *
 * 1. Start the dev server (`npm run dev`) and open http://localhost:3000.
 * 2. Paste this whole file into the browser console.
 * 3. Call `await routePlotterBenchmark()`.
 *
 * It backs up the working project, measures on synthetic projects, restores
 * the backup, and **disables autosave for the rest of the page's life** —
 * then tells you to reload. That last part is not belt-and-braces: the first
 * version of this harness restored the autosave and the still-running app
 * immediately saved the synthetic project over it, destroying the very
 * project it had just put back. Nothing is written to disk.
 *
 * ## Reading the result
 *
 * `medianMs` is the typical cost of one `render()`; `p95Ms` is the slow tail,
 * which is what actually breaks the feel of dragging a waypoint. A frame
 * budget of 16.7 ms is 60fps. The baseline these numbers were first taken
 * against is in DEV-INFRASTRUCTURE.md → Performance harness.
 */

/* eslint-disable no-console */
globalThis.routePlotterBenchmark = async function routePlotterBenchmark(options = {}) {
  const {
    // A fixed surface, so results are comparable across runs and independent
    // of whether the preview pane happens to be laid out.
    width = 1280,
    height = 720,
    samples = 25,
    warmup = 5,
  } = options;

  const app = globalThis.app;
  if (!app) throw new Error('Route Plotter is not loaded on this page.');

  const backup = localStorage.getItem('routePlotter_autosave');

  // Silence autosave for the whole run AND leave it silenced afterwards. The
  // synthetic projects below must never reach storage: an autosave landing
  // after the restore would overwrite the real project with a 2,000-waypoint
  // sine wave. It stays silenced until the page is reloaded, which is why the
  // closing warning insists on that.
  const realAutoSave = app.autoSave;
  app.autoSave = function benchmarkAutoSaveSuppressed() {};

  const restore = () => {
    if (backup !== null) localStorage.setItem('routePlotter_autosave', backup);
  };

  // ---- fixed render surface -------------------------------------------------
  app.canvas.width = width;
  app.canvas.height = height;
  app.displayWidth = width;
  app.displayHeight = height;
  app.coordinateTransform.setCanvasDimensions(width, height);

  const Waypoint = app.waypoints[0]?.constructor;
  if (!Waypoint) { restore(); throw new Error('Open a project with at least one waypoint first.'); }

  /** A sine-shaped route, so the path has real curvature rather than a straight line. */
  function buildRoute(n) {
    const wps = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const wp = Waypoint.createMajor(0.05 + t * 0.9, 0.5 + Math.sin(t * Math.PI * 4) * 0.35);
      wp.label = i % 5 === 0 ? `Point ${i}` : '';
      wps.push(wp);
    }
    app.waypoints = wps;
    app.waypointsById = new Map(wps.map(w => [w.id, w]));
    app.selectedWaypoint = null;
    app.calculatePath();
    clearTimeout(app._durationUpdateTimeout);
    app.updateAnimationDuration();
  }

  /** Flat-coloured image of a given resolution; content does not affect the cost. */
  function syntheticImage(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#345';
    ctx.fillRect(0, 0, w, h);
    return c;
  }

  /**
   * Median and p95 of render() across evenly spaced timeline instants. The
   * timeline is a pure function of time, so the same instants are measured
   * every run — differences are the code's, not the sampler's.
   */
  function measure() {
    const engine = app.animationEngine;
    const total = engine.getTotalTimelineDuration() || 1000;
    const seek = (f) => (engine.seekToProgress ? engine.seekToProgress(f) : engine.setTime(f * total));
    for (let i = 0; i < warmup; i++) { seek(i / warmup); app.render(); }
    const times = [];
    for (let i = 0; i < samples; i++) {
      seek(i / samples);
      const t0 = performance.now();
      app.render();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return {
      medianMs: +times[Math.floor(times.length / 2)].toFixed(2),
      p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2),
    };
  }

  const crowd = () => app.scene?.flowLayers?.[app.scene.flowLayers.length - 1] ?? null;

  const results = { surface: `${width}x${height}`, samples, waypoints: [], dots: [], image: [], profiles: [] };

  try {
    // ---- one dimension at a time, from a typical baseline -------------------
    for (const n of [5, 12, 25, 50, 100, 200, 500, 1000, 2000]) {
      buildRoute(n);
      results.waypoints.push({ waypoints: n, pathPoints: app.pathPoints.length, ...measure() });
    }

    buildRoute(12);
    app.addCrowd({ enterNetworkEditor: false });
    const layer = crowd();
    for (const n of [0, 50, 200, 500, 1000, 2500, 5000]) {
      if (n === 0) layer.visible = false;
      else { layer.visible = true; layer.emitters[0].dotCount = n; }
      results.dots.push({ dots: n, ...measure() });
    }
    layer.visible = true;
    layer.emitters[0].dotCount = 300;

    for (const [w, h] of [[0, 0], [1200, 850], [2400, 1700], [4240, 2830], [6000, 4000], [8000, 6000]]) {
      app.background.image = w ? syntheticImage(w, h) : null;
      results.image.push({
        megapixels: w ? +((w * h) / 1e6).toFixed(1) : 0,
        decodedMiB: w ? +((w * h * 4) / 1048576).toFixed(0) : 0,
        ...measure(),
      });
    }

    // ---- whole projects, the three dimensions together ----------------------
    for (const [profile, wp, dots, iw, ih] of [
      ['Small', 8, 100, 1200, 850],
      ['Typical', 25, 500, 2400, 1700],
      ['Large', 100, 2000, 4240, 2830],
      ['Extreme', 500, 5000, 6000, 4000],
      ['At every limit', 2000, 5000, 8000, 6000],
    ]) {
      buildRoute(wp);
      layer.emitters[0].dotCount = dots;
      app.background.image = syntheticImage(iw, ih);
      const m = measure();
      results.profiles.push({
        profile, waypoints: wp, dots,
        imageMP: +((iw * ih) / 1e6).toFixed(1),
        ...m,
        holds60fps: m.p95Ms < 16.7,
      });
    }
    app.background.image = null;
  } finally {
    restore();
  }

  console.table(results.waypoints);
  console.table(results.dots);
  console.table(results.image);
  console.table(results.profiles);
  console.warn(
    'Benchmark finished. Your project was restored and autosave is disabled ' +
    'until you reload — reload the page now, before authoring anything.'
  );
  // Named so a reader of a live session can see why saving stopped working.
  void realAutoSave;

  return results;
};
