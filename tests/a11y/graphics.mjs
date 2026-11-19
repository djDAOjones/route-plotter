// V31-A11Y-POLISH: the 1.4.11 graphics verdict, as plain data in and a verdict out, so its geometry cases have known
// answers a test can hold. helpers.ts measures an SVG's painted shapes in the page (box, fill, stroke, the page colour
// behind) and calls judgeGraphic here. Colours are [r, g, b, a], channels 0 to 255. Bounded cases only; what lies
// outside them reads unresolved, never passed:
//  - a shape lies on the nearest earlier filled shape that contains its box (a shape with no fill contains nothing,
//    V31-A11Y-VERDICTS), else on every earlier shape it overlaps and on
//    the page unless exact rectangles (no rounding, no transform, an opaque fill) among them cover its box, a box
//    standing in for a circle's or a path's area proving nothing; it reaches 3:1 when it does so against all of them,
//    is low when it does so against none, and reads partial (unresolved) when it splits. The exception
//    (V31-A11Y-FIXES): a circle or ellipse the page marked round (axis-aligned, filling its box, no transform) stands
//    for its area, not its box, in both tests: a box lies inside it only when it is painted and the box's four corners
//    are inside, and a box meets it only when the ellipse reaches the box;
//  - a shape lying on a partial shape, a gradient or pattern paint, or no painted shape at all is unresolved;
//  - shapes that all reach 3:1 pass and shapes that are all low fail, as before; when they split the verdict stays
//    unresolved, since whether a low part is needed to understand the graphic is a judgement geometry cannot make, but
//    the reason names each low shape, its ratio and whether a shape at 3:1 touches it, so the judgement is quick.
export const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1); };
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const containsBox = (o, b) => o.left <= b.left + 0.5 && o.top <= b.top + 0.5 && o.right >= b.right - 0.5 && o.bottom >= b.bottom - 0.5;
const meetsBox = (o, b) => o.left < b.right && o.right > b.left && o.top < b.bottom && o.bottom > b.top;
// A round shape's area is the ellipse inscribed in its box; a box of no width or height stays a box. Containing needs
// the shape painted (an outline's interior is what lies under it) and the box's four corners inside the exact ellipse,
// no slack: a corner on the edge to rounding falls out and the shape then reads partial, never passed wrongly.
const ellipse = (o) => ({ cx: (o.left + o.right) / 2, cy: (o.top + o.bottom) / 2, rx: (o.right - o.left) / 2, ry: (o.bottom - o.top) / 2 });
const round = (p) => p.round && p.box.right > p.box.left && p.box.bottom > p.box.top;
// Touching, for the reason's wording only, keeps a little slack: a twentieth of the smaller radius, a half pixel at most.
const slack = ({ rx, ry }) => Math.min(0.5, 0.05 * Math.min(rx, ry));
// A shape with no fill contains nothing (V31-A11Y-VERDICTS): an outline's interior is what lies under it, whatever
// its shape, so a mark inside a stroke-only rectangle or path lies on what is under the outline, not on the outline.
const contains = (p, b) => {
  if (!p.filled) return false;
  if (!round(p)) return containsBox(p.box, b);
  const e = ellipse(p.box);
  return !!p.filled && containsBox(p.box, b) && [b.left, b.right].every((x) => [b.top, b.bottom].every((y) => ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 <= 1));
};
const meets = (p, b) => {
  if (!round(p)) return meetsBox(p.box, b);
  if (!meetsBox(p.box, b)) return false;
  const { cx, cy, rx, ry } = ellipse(p.box);
  const dx = Math.max(b.left - cx, 0, cx - b.right), dy = Math.max(b.top - cy, 0, cy - b.bottom);
  return (dx / rx) ** 2 + (dy / ry) ** 2 < 1;
};
const touchesBox = (o, b) => o.left <= b.right + 0.5 && o.right >= b.left - 0.5 && o.top <= b.bottom + 0.5 && o.bottom >= b.top - 0.5;
// Touching, for the reason's wording: a round shape touches a box its area comes within the half pixel of.
const touches = (p, b) => {
  if (!round(p) || !touchesBox(p.box, b)) return touchesBox(p.box, b);
  const e = ellipse(p.box), k = slack(e);
  const dx = Math.max(b.left - e.cx, 0, e.cx - b.right), dy = Math.max(b.top - e.cy, 0, e.cy - b.bottom);
  return (dx / (e.rx + k)) ** 2 + (dy / (e.ry + k)) ** 2 <= 1;
};
// Whether the boxes together cover the whole of b: every cell of the grid their edges cut b into lies inside one.
function covers(boxes, b) {
  const xs = [...new Set([b.left, b.right, ...boxes.flatMap((o) => [o.left, o.right]).filter((x) => x > b.left && x < b.right)])].sort((p, q) => p - q);
  const ys = [...new Set([b.top, b.bottom, ...boxes.flatMap((o) => [o.top, o.bottom]).filter((y) => y > b.top && y < b.bottom)])].sort((p, q) => p - q);
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    if (!boxes.some((o) => o.left <= cx && o.right >= cx && o.top <= cy && o.bottom >= cy)) return false;
  }
  return true;
}

// shapes: { tag, box: { left, top, right, bottom }, exact, round?, fill, stroke } in paint order, round when the shape is an
// axis-aligned circle or ellipse that fills its box, exact when the box is the whole
// of an axis-aligned square-cornered rectangle, fill and stroke already carrying
// their opacity or null; bg the page colour behind the graphic; open a reason the page found the paint unreadable.
export function judgeGraphic(bg, shapes, open = '') {
  const note = (r) => ({ state: 'unresolved', low: 0, shapes: shapes.length, reason: r });
  if (open) return note(open);
  const painted = [], kind = [];
  shapes.forEach((sh, n) => {
    const name = `${sh.tag} ${n + 1}`;
    const inside = [...painted].reverse().find((p) => contains(p, sh.box));
    const touched = inside ? [] : painted.filter((p) => meets(p, sh.box));
    const refs = inside ? [inside] : [...touched, ...(touched.length && covers(touched.filter((p) => p.exact).map((p) => p.box), sh.box) ? [] : [{ colour: bg, box: null }])];
    const paints = [sh.fill, sh.stroke].filter(Boolean);
    const each = refs.map((r) => Math.max(...paints.map((c) => ratio(over(c, r.colour), r.colour))));
    const lowest = Math.min(...each), highest = Math.max(...each);
    const k = refs.some((r) => r.partial) ? 'stacked' : lowest >= 3 ? 'reach' : highest < 3 ? 'low' : 'partial';
    kind.push({ name, k, box: sh.box, round: !!sh.round, ratio: highest });
    painted.push({ box: sh.box, round: !!sh.round, filled: !!sh.fill, exact: !!sh.exact && !!sh.fill && sh.fill[3] >= 0.999, colour: over(sh.fill ?? sh.stroke, refs[0].colour), partial: refs.length > 1 });
  });
  if (!kind.length) return note('no painted shape');
  const low = kind.filter((s) => s.k === 'low').length;
  const of = { low, shapes: kind.length };
  const stacked = kind.find((s) => s.k === 'stacked'), partial = kind.find((s) => s.k === 'partial');
  if (stacked) return { state: 'unresolved', ...of, reason: `${stacked.name} lies on a shape that lies over part of another, so its contrast is not bounded` };
  if (partial) return { state: 'unresolved', ...of, reason: `${partial.name} reaches 3:1 against some of what it lies on and not against the rest` };
  if (!low) return { state: 'pass', ...of, reason: `${kind.length} shape(s), each at 3:1 against what lies under it` };
  if (low === kind.length) return { state: 'fail', ...of, reason: 'no shape at 3:1 against what lies under it' };
  // Split around 3:1: unresolved, each low shape named with its ratio and whether a shape at 3:1 touches its box.
  const lows = kind.filter((s) => s.k === 'low').map((s) => `${s.name} at ${s.ratio.toFixed(1)}:1 ${kind.some((o) => o.k === 'reach' && touches(o, s.box)) ? 'touching' : 'standing apart from'} the shapes at 3:1`);
  return { state: 'unresolved', ...of, reason: `${low} of ${kind.length} shapes under 3:1 against what lies under them (${lows.join('; ')}), whether needed a judgement` };
}
