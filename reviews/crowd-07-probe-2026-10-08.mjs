// Read-only probe of the real engine for CROWD-07 (no file writes inside rp/).
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Emitter } from '../src/models/Emitter.js';
import { GraphNode } from '../src/models/GraphNode.js';
import { getGraphDepartureShares } from '../src/utils/graphRouting.js';
import { releaseStartFraction } from '../src/utils/routeAnchors.js';

const engine = new SwarmEngine();
const NEW = { dotColor: '#56B4E9', speed: 0.4, releaseDuration: 0.5, seed: 7 };

// (a) anchored node: moveTo changes authored x/y only; drawn position stays
const n = new GraphNode({ x: 0.2, y: 0.2, anchorWaypointId: 'wp1' });
n.applyAnchor(0.6, 0.6);
n.moveTo(0.9, 0.9);
console.log('(a) anchored node after moveTo(0.9,0.9): authored', n.x, n.y, 'drawn', n.position());

// (b) hasJourneyEnd on pen-drawn shapes (untyped nodes, two-way edges)
function chain(ids, close = false, type = 'normal') {
  const l = new FlowLayer({ guideType: 'graph', emitters: [NEW] });
  const nodes = ids.map((id, i) => l.graph.addNode({ id, x: 0.1 + 0.3 * i, y: 0.5, type }));
  for (let i = 1; i < nodes.length; i++) l.graph.addEdge({ sourceId: nodes[i - 1].id, targetId: nodes[i].id });
  if (close) l.graph.addEdge({ sourceId: nodes.at(-1).id, targetId: nodes[0].id });
  return l;
}
console.log('(b) open chain A-B-C untyped two-way: hasJourneyEnd =', engine.hasJourneyEnd(chain(['A','B','C'])));
console.log('(b) closed loop A-B-C-A untyped two-way: hasJourneyEnd =', engine.hasJourneyEnd(chain(['A','B','C'], true)));
const loopExit = chain(['A','B','C'], true); loopExit.graph.getNode('C').type = 'exit';
console.log('(b) closed loop with C=Exit: hasJourneyEnd =', engine.hasJourneyEnd(loopExit));
const single = chain(['A','B']);
console.log('(b) two nodes A-B untyped: entries =', engine._buildGraphGuide(single.graph).entries.map(x => x.id), 'fallbackExits =', [...engine._buildGraphGuide(single.graph).fallbackExits]);

// (c) Respawn vs Repeat journey on a route guide at Pace variation 0% vs 20%
const route = [{ x: 0.1, y: 0.5 }, { x: 0.7, y: 0.5 }];
function routeLayer(mode, speedVariance) {
  return new FlowLayer({ guideType: 'route', emitters: [{ ...NEW, lifecycleMode: mode, speedVariance, dotCount: 10 }] });
}
const ctx = { durationMs: 10000, routePathPoints: route };
for (const sv of [0, 0.2]) {
  const r = engine.evaluate(7000, routeLayer('respawn', sv), ctx);
  const l = engine.evaluate(7000, routeLayer('loop', sv), ctx);
  const diff = r.map((d, i) => Math.hypot(d.x - l[i].x, d.y - l[i].y)).reduce((a, b) => Math.max(a, b), 0);
  console.log(`(c) Pace variation ${sv * 100}%: max |respawn - loop| at t=7s =`, diff.toFixed(4));
}

// (d) default new crowd on a 0.6-wide straight route, B = 10 s: finish times
const sched = engine.scheduleDots(routeLayer('disappear', 0.2), ctx);
const finishes = sched.map(s => s.onsetFraction * 10000 + s.journeyMs);
console.log('(d) default crowd, route length 0.6, B=10s: last finish', (Math.max(...finishes) / 1000).toFixed(2), 's; crowdFinishMs =', (engine.crowdFinishMs(routeLayer('disappear', 0.2), ctx) / 1000).toFixed(2), 's');

// (e) Window length 0%: all onsets coincide, so Release timing / bias / busyness have nothing to spread
const zeroWin = new FlowLayer({ guideType: 'route', emitters: [{ ...NEW, releaseDuration: 0, dotCount: 10, onsetVariance: 1, intensityRamp: 1 }] });
const on = engine.scheduleDots(zeroWin, ctx).map(s => s.onsetFraction);
console.log('(e) Window length 0%, Release timing 100%, bias Later 100%: distinct onsets =', new Set(on).size);

// (f) Traffic on a chain node (one departure): share always 100%
const ch = chain(['A','B','C']);
console.log('(f) departures from A in chain:', getGraphDepartureShares(ch.graph, 'A').map(s => s.percent));

// (g) anchored release: slider value ignored while the anchor resolves
const anchored = new Emitter({ ...NEW, releaseStart: 0.8, releaseAnchor: { waypointId: 'w1', at: 'arrival' } });
console.log('(g) anchored emitter releaseStart 80%: effective start =', releaseStartFraction(anchored, { arrivalMsById: { w1: 1000 }, totalDurationMs: 10000 }));

// (h) Edge card slider range vs stored weight
for (const w of [0.01, 0.05, 24, 99999]) console.log(`(h) weight ${w}: slider value = ${Math.round(w * 10)} (slider range 1..50 => shows ${Math.max(1, Math.min(50, Math.round(w * 10)))} = weight ${Math.max(1, Math.min(50, Math.round(w * 10))) / 10})`);
