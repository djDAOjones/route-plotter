// V31-A11Y-VERDICTS: the text contrast verdict (1.4.3, and 1.4.6 at AAA), as plain data in and a verdict out, like
// graphics.mjs, so its cases have known answers a test can hold. helpers.ts reports each piece of visible text in the
// flat tree, shadow trees included: its colour and the element's opacity, the composited background, whether it is
// large, its text, whether its control is named by aria-label or aria-labelledby, its computed text-shadow, and the
// page's own reason to set it aside. Colours are [r, g, b, a], channels 0 to 255. What WCAG exempts is set aside,
// never failed; a pair that cannot be bounded is a review, never passed; and a row that measured no pair is not run.
//  - Set aside: text in a disabled widget or group, or in the label of a disabled widget, and text that is not visible
//    (the page says why: clipped to nothing, off the page), as the page reports them; text the colour of its
//    background; and text that expresses nothing in a human language — no letter or digit, or a lone letter in a
//    control its aria-label or aria-labelledby renames, such as an "X" in a button named "Close".
//  - A text shadow: one with no offset and no blur lies wholly under the glyphs and is no background; one that reaches
//    all round the glyphs (a blur, and an offset no larger than it) is what the text lies on, measured at the
//    shadow's colour over the background at full and at half strength, its blurred edge; any other shadow lies beside
//    the glyphs, measured at full strength, with the background too where no shadow reaches all round. Pairs that
//    agree give their verdict; pairs that split around the threshold are a review.
import { over, ratio } from './graphics.mjs';

const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
// Chromium's computed text-shadow: a comma-separated list, each the colour first, then x, y and blur in px.
export function parseShadows(css) {
  if (!css || css === 'none') return [];
  return css.split(/,(?![^(]*\))/).map((one) => {
    const colour = parse(one), px = (one.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
    return colour ? { colour, x: px[0] ?? 0, y: px[1] ?? 0, blur: px[2] ?? 0 } : null;
  }).filter(Boolean);
}
// Nothing in a human language: no letter or digit at all, or one letter alone that the control's name replaces.
export const nonLanguage = (text, named) => { const t = (text || '').trim(); return !/[\p{L}\p{N}]/u.test(t) || (named && /^\p{L}$/u.test(t)); };
const same = (a, b) => [0, 1, 2].every((i) => Math.round(a[i]) === Math.round(b[i]));
const r2 = (n) => n.toFixed(2);

// One piece of text against one threshold: { kind: 'exempt' | 'measured' | 'review', pass, ratio, reason }.
export function judgeText(t, min, minLarge) {
  const need = t.large ? minLarge : min, opacity = t.opacity ?? 1;
  if (t.skip) return { kind: 'exempt', reason: `${t.el} ${t.skip}` };
  const ink = over([t.fg[0], t.fg[1], t.fg[2], t.fg[3] * opacity], t.bg);
  if (same(ink, t.bg)) return { kind: 'exempt', reason: `${t.el} invisible: the colour of its background` };
  if (nonLanguage(t.text, t.named)) return { kind: 'exempt', reason: `${t.el} non-text: "${(t.text || '').trim().slice(0, 12)}" expresses nothing in a human language` };
  const shadows = parseShadows(t.shadow).filter((s) => s.colour[3] * opacity > 0 && (s.x || s.y || s.blur));
  if (!shadows.length) { const r = ratio(ink, t.bg); return { kind: 'measured', pass: r >= need, ratio: r, reason: `${t.el} ${r2(r)}:1` }; }
  const tint = (s, k) => over([s.colour[0], s.colour[1], s.colour[2], s.colour[3] * opacity * k], t.bg);
  const around = shadows.filter((s) => s.blur > 0 && Math.abs(s.x) <= s.blur && Math.abs(s.y) <= s.blur), beside = shadows.filter((s) => !around.includes(s));
  const under = [...(around.length ? around.flatMap((s) => [tint(s, 1), tint(s, 0.5)]) : [t.bg]), ...beside.map((s) => tint(s, 1))];
  const each = under.map((b) => ratio(ink, b)), lo = Math.min(...each), hi = Math.max(...each);
  if (lo >= need) return { kind: 'measured', pass: true, ratio: lo, reason: `${t.el} ${r2(lo)}:1 or more with its text shadow` };
  if (hi < need) return { kind: 'measured', pass: false, ratio: hi, reason: `${t.el} ${r2(hi)}:1 at most with its text shadow` };
  return { kind: 'review', ratio: lo, reason: `${t.el}: its text shadow puts it between ${r2(lo)}:1 and ${r2(hi)}:1, either side of ${need}:1` };
}

// The row: a failed pair fails it; otherwise a review or an unresolved background holds it back; no pair measured
// leaves it not run, saying what was set aside; else it passes, naming what was set aside.
export function textRow(items, min, minLarge, unresolved = []) {
  const v = items.map((t) => judgeText(t, min, minLarge));
  const measured = v.filter((x) => x.kind === 'measured'), fails = measured.filter((x) => !x.pass), reviews = v.filter((x) => x.kind === 'review'), exempt = v.filter((x) => x.kind === 'exempt');
  const list = (xs) => xs.slice(0, 5).map((x) => x.reason).join('; ') + (xs.length > 5 ? `; and ${xs.length - 5} more` : '');
  const aside = exempt.length ? `; ${exempt.length} set aside: ${list(exempt)}` : '';
  if (fails.length) return { state: 'fail', reason: list(fails) };
  if (unresolved.length) return { state: 'not_run', reason: `unresolved over an image or gradient: ${unresolved.slice(0, 5).join(', ')}` };
  if (reviews.length) return { state: 'not_run', reason: `a review: ${list(reviews)}` };
  if (!measured.length) return { state: 'not_run', reason: `no text pair measured${aside}` };
  return { state: 'pass', reason: `${measured.length} text pair(s) at ${min}:1 (large ${minLarge}:1) or more${aside}` };
}
