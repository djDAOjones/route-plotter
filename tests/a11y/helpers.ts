// V31-A11Y stage 3: the standard pack's shared helpers. Every test declares its method, rows and state or journey in
// its details, before any fixture runs, so a failure in setup is still attributed; multi-row checks attach each row's
// own result as `a11y-rows`; axe attaches its full results as `axe`. The numbers are the adopted level's, from the
// coverage file: AAA reads 7:1, 44 px and the 2 px focus perimeter at 3:1; AA 4.5:1 and 24 px.
// cspell:ignore spinbutton
import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as projectModule from './project.mjs';
import { judgeGraphic } from './graphics.mjs';
import { textRow } from './contrast.mjs';
import { contained, labelFrom } from './names.mjs';

export const ROOT = process.env.A11Y_ROOT || process.cwd();
const json = (rel: string) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
export const catalogue = json('project/a11y/catalogue.json');
export const coverage = json('project/a11y/coverage.json');
export const LEVEL: 'AA' | 'AAA' = coverage.level;
export const AAA = LEVEL === 'AAA';
// The tags the report requires at each level (a11y-report.mjs LEVEL_TAGS); experimental rules stay off.
export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', ...(AAA ? ['wcag2aaa'] : [])];
// A static import, so no top-level await: Playwright loads this file as CommonJS where the project's package file does
// not say "module", and Node's require of an ES module then hands back its namespace, wrapped once more by the transform.
const declared: any = projectModule;
export const project = declared.default?.default ?? declared.default ?? declared;
export const HOUSE_TARGET: number = project.houseTarget ?? 44;
export const SLOW_GAP = 1000; // ms between keys when a function is run slowly: no timing may be required

// A row is applicable and required in this project, as its coverage file records it.
export const applicable = (id: string) => coverage.rows[id]?.applicability?.state === 'applicable' && coverage.rows[id]?.adoption === 'required';
export const present = (feature: string) => coverage.features[feature]?.state === 'present';

export type Rows = Record<string, { state: 'pass' | 'fail' | 'not_run' | 'candidate'; reason: string }>;
export function details(method: string, rows: string[] | '*', where: { state?: string; journey?: string } = {}) {
  const annotation = [{ type: 'a11y-method', description: method }, { type: 'a11y-rows', description: rows === '*' ? '*' : rows.join(' ') }];
  if (where.state) annotation.push({ type: 'a11y-state', description: where.state });
  if (where.journey) annotation.push({ type: 'a11y-journey', description: where.journey });
  return { annotation };
}
// Attach each row's result, then fail the test if any row failed, naming the rows and their reasons.
export async function settle(testInfo: TestInfo, rows: Rows) {
  await testInfo.attach('a11y-rows', { body: JSON.stringify(rows), contentType: 'application/json' });
  const failed = Object.entries(rows).filter(([, r]) => r.state === 'fail');
  expect(failed.map(([id, r]) => `${id}: ${r.reason}`), 'rows failing').toEqual([]);
}
export const verdict = (problems: string[], ok: string) => problems.length ? { state: 'fail' as const, reason: problems.slice(0, 5).join('; ') + (problems.length > 5 ? `; and ${problems.length - 5} more` : '') } : { state: 'pass' as const, reason: ok };

// The browser must be present before anything launches: the command names its absence, and every test then skips
// as blocked, never failed or passed. A browser or page that closed under a test is annotated as a crash, which the
// report reads as an error, never a failure or a pass.
export const test = base.extend<{ a11yBrowser: void }>({
  a11yBrowser: [async ({}, use, testInfo) => {
    const missing = process.env.A11Y_BROWSER_MISSING;
    if (missing) { testInfo.annotations.push({ type: 'a11y-blocked', description: missing }); testInfo.skip(true, missing); }
    await use();
    const message = String(testInfo.errors.map((e) => e.message).find(Boolean) ?? '').replace(/\x1b\[[0-9;]*m/g, '');
    if (!['passed', 'skipped'].includes(testInfo.status ?? '') && /has been closed|crashed|browser closed/i.test(message)) testInfo.annotations.push({ type: 'a11y-crash', description: `the browser or page closed under the test: ${message.split('\n')[0].slice(0, 160)}` });
  }, { auto: true }],
});
export { expect };

export type State = { name?: string; path: string; setup?: (a: { page: Page }) => Promise<void>; snapshot?: string; snapshotRoot?: string; interactions?: { name: string; run: (a: { page: Page }) => Promise<void>; snapshot?: string }[]; keeps?: { content?: string[]; cues?: string[]; functions?: { name: string; run: (a: { page: Page }) => Promise<boolean> }[] } };
export async function open(page: Page, state: State) {
  await page.goto(state.path);
  if (state.setup) await state.setup({ page });
}

// A screenshot of a box in CSS pixels, decoded through the browser's own canvas, so no image library is needed.
type Box = { x: number; y: number; width: number; height: number };
async function pixels(page: Page, clip: Box) {
  const png = await page.screenshot({ clip, animations: 'disabled', caret: 'hide', scale: 'css' });
  return page.evaluate(async (s) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d')!; x.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, data: [...x.getImageData(0, 0, img.width, img.height).data] };
  }, png.toString('base64'));
}
const lum3 = (d: number[], i: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]); };
const ratio3 = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const around = (page: Page, r: Box, pad: number): Box | null => {
  const vp = page.viewportSize()!, x = Math.max(0, Math.floor(r.x - pad)), y = Math.max(0, Math.floor(r.y - pad));
  const width = Math.min(vp.width, Math.ceil(r.x + r.width + pad)) - x, height = Math.min(vp.height, Math.ceil(r.y + r.height + pad)) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
};
// Ink: the pixels inside an element's box at 3:1 or more against the commonest colour of a 4 px ring around it. A
// cue or graphic with no ink has vanished, whatever its styles say.
export async function ink(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const r = await target.boundingBox();
  const clip = r && around(page, r, 4);
  if (!r || !clip) return 0;
  const { w, h, data } = await pixels(page, clip);
  const [ix, iy, ax, ay] = [r.x - clip.x, r.y - clip.y, r.x - clip.x + r.width, r.y - clip.y + r.height];
  const ring = new Map<string, number>(); const inner: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (x >= ix && x < ax && y >= iy && y < ay) inner.push(i); else { const k = `${data[i]},${data[i + 1]},${data[i + 2]}`; ring.set(k, (ring.get(k) ?? 0) + 1); }
  }
  if (!ring.size) return 0;
  const mode = [...ring.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number), base = lum3(mode, 0);
  return inner.filter((i) => ratio3(lum3(data, i), base) >= 3).length;
}

export async function axeScan(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  await testInfo.attach('axe', { body: JSON.stringify(results), contentType: 'application/json' });
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s), ${v.help}`), 'axe violations').toEqual([]);
}

// Colour pairs from rendered styles: text against its composited background; for 1.4.11, control boundaries, the
// meaningful graphics and the state cues. A pair over an image or gradient, a raster graphic, or a graphic whose
// shapes split around 3:1 cannot be settled here and is reported unresolved, never passed. Text is each element's
// visible text nodes in the flat tree, open shadow trees and slotted text included, with what contrast.mjs needs to
// judge it (V31-A11Y-VERDICTS): the element's opacity, its text shadow, whether its control is renamed by aria-label
// or aria-labelledby, and why the page sets it aside — in a disabled widget or group, in the label of a disabled
// widget, or invisible, clipped to nothing or off the page.
export async function contrastPairs(page: Page) {
  const raw = await page.evaluate(() => {
    // The flat tree's parent: the slot an element is assigned to, else its parent, else a shadow root's host.
    const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.parentNode as ShadowRoot | null)?.host ?? null);
    const parse = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
    const over = (top: number[], under: number[]) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1); };
    const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const opacity = (el: Element | null) => { let o = 1; for (let e = el; e; e = up(e)) o *= Number(getComputedStyle(e).opacity); return o; };
    const background = (el: Element | null): number[] | null => {
      const layers: number[][] = [];
      for (let e = el; e; e = up(e)) {
        const s = getComputedStyle(e);
        if (s.backgroundImage && s.backgroundImage !== 'none') return null;
        const c = parse(s.backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      }
      return layers.reverse().reduce((under, top) => over(top, under), [255, 255, 255, 1]);
    };
    const name = (e: Element) => e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`;
    const visible = (e: Element) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; };
    // Widgets and groups that can be disabled, by explicit role or the element's own; a disabled one exempts its text
    // and its label's (ACT afw4f7's applicability, WCAG's inactive components).
    const WIDGET = /^(button|checkbox|combobox|gridcell|link|menuitem|menuitemcheckbox|menuitemradio|option|radio|scrollbar|searchbox|separator|slider|spinbutton|switch|tab|textbox|treeitem|listbox|menu|menubar|radiogroup|tablist|tree|treegrid|grid|row|group|toolbar)$/;
    const IMPLICIT: Record<string, string> = { BUTTON: 'button', INPUT: 'textbox', SELECT: 'combobox', TEXTAREA: 'textbox', OPTION: 'option', FIELDSET: 'group', OPTGROUP: 'group', DETAILS: 'group' };
    const roleOf = (e: Element) => (e.getAttribute('role') || '').trim().split(/\s+/)[0] || IMPLICIT[e.tagName] || (e.tagName === 'A' && e.hasAttribute('href') ? 'link' : '');
    const off = (e: Element) => e.matches(':disabled') || (e.getAttribute('aria-disabled') === 'true' && WIDGET.test(roleOf(e)));
    const labels = (e: Element) => { const root = e.getRootNode() as Document | ShadowRoot; return e.id ? [...root.querySelectorAll('[aria-labelledby]')].filter((x) => x.getAttribute('aria-labelledby')!.split(/\s+/).includes(e.id)) : []; };
    const disabled = (el: Element) => {
      for (let a: Element | null = el; a; a = up(a)) {
        if (off(a)) return 'in a disabled widget or group';
        const control = a.tagName === 'LABEL' ? (a as HTMLLabelElement).control : null;
        if ((control && off(control)) || labels(a).some(off)) return 'the label of a disabled widget';
      }
      return '';
    };
    // Invisible though rendered: clipped to nothing (clip-path inset of half or more, a zero clip rectangle, or a box
    // of a pixel or less that hides its overflow), here or above, or wholly above or left of the page.
    const clipped = (e: Element) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      // An inset of half or more from both sides on one axis leaves nothing: inset(50%), never inset(50% 0 0 0).
      const inset = /inset\(([^)]*)\)/.exec(s.clipPath), pc = inset ? inset[1].split(/\s+round\s/)[0].trim().split(/\s+/).map((x) => (/%$/.test(x) ? parseFloat(x) : NaN)) : [];
      if (pc.length) { const [t, r2 = t, b = t, l = r2] = pc; if (t + b >= 100 || l + r2 >= 100) return true; }
      const m = /rect\(([^)]*)\)/.exec(s.clip); const v = m ? m[1].split(/[\s,]+/).map(parseFloat) : [];
      if (v.length === 4 && /^(absolute|fixed)$/.test(s.position) && (v[2] - v[0] <= 0 || v[1] - v[3] <= 0)) return true;
      return s.overflowX !== 'visible' && s.overflowY !== 'visible' && r.width <= 1 && r.height <= 1;
    };
    // The text's own boxes, from a range over its nodes: a slot, display: contents, draws none of its own.
    const boxes = (nodes: Node[]) => nodes.flatMap((n) => { const r = document.createRange(); r.selectNodeContents(n); return [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0); });
    const invisible = (el: Element, rects: DOMRect[]) => {
      for (let a: Element | null = el; a; a = up(a)) if (clipped(a)) return 'invisible: clipped to nothing';
      return rects.every((r) => r.right + scrollX <= 0 || r.bottom + scrollY <= 0) ? 'invisible: off the page' : '';
    };
    // Renamed: the element itself or the nearest control that takes its name from its content (a button, link, tab,
    // option…; never a group or composite) is named by aria-label or aria-labelledby, and its whole text is one letter.
    const OWN_NAME = /^(button|link|checkbox|radio|switch|tab|menuitem|menuitemcheckbox|menuitemradio|option|treeitem|gridcell)$/;
    const named = (el: Element) => {
      for (let a: Element | null = el; a; a = up(a)) if (a === el || OWN_NAME.test(roleOf(a))) {
        if ((a.hasAttribute('aria-label') || a.hasAttribute('aria-labelledby')) && /^\p{L}$/u.test((a.textContent || '').trim())) return true;
        if (a !== el) return false;
      }
      return false;
    };
    // Every visible text node in the flat tree, by the element whose style it takes: a shadow root's text by its host,
    // a slotted text by its slot; a shadow host's own text that no slot takes is not rendered.
    const roots: (Document | ShadowRoot)[] = [document];
    for (let i = 0; i < roots.length; i++) for (const e of roots[i].querySelectorAll('*')) if (e.shadowRoot) roots.push(e.shadowRoot);
    const owners = new Map<Element, Node[]>();
    for (const root of roots) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent!.trim()) continue;
        const p = n.parentNode;
        const owner = p instanceof ShadowRoot ? p.host : p instanceof Element ? (p.shadowRoot ? (n as Text).assignedSlot : p) : null;
        if (!owner || owner.namespaceURI !== 'http://www.w3.org/1999/xhtml' || /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|TITLE)$/.test(owner.tagName)) continue;
        let top: Element = owner; while (top.getRootNode() instanceof ShadowRoot) top = (top.getRootNode() as ShadowRoot).host;
        if (top !== document.body && !document.body.contains(top)) continue;
        owners.set(owner, [...(owners.get(owner) ?? []), n]);
      }
    }
    const text: { el: string; fg: number[]; opacity: number; bg: number[]; large: boolean; text: string; named: boolean; shadow: string; skip: string | null }[] = [];
    const unresolved: string[] = [];
    for (const [e, nodes] of owners) {
      const s = getComputedStyle(e), rects = boxes(nodes), words = nodes.map((n) => n.textContent).join('');
      if (!rects.length || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
      const fg = parse(s.color), bg = background(e), skip = disabled(e) || invisible(e, rects) || null;
      if ((!fg || !bg) && !skip) { unresolved.push(name(e)); continue; }
      const size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700;
      text.push({ el: name(e), fg: fg ?? [0, 0, 0, 1], opacity: opacity(e), bg: bg ?? [255, 255, 255, 1], large: size >= 24 || (bold && size >= 18.66), text: words, named: named(e), shadow: s.textShadow, skip });
    }
    // Boundaries of controls a user must find. A natively drawn checkbox or radio is measured by its pixels instead.
    const boundaries: { el: string; ratio: number }[] = [], native: string[] = [], graphicsUnresolved: string[] = [];
    let n = 0;
    for (const e of document.querySelectorAll('input:not([type=hidden]), select, textarea, [role=checkbox], [role=radio], [role=switch], [role=combobox], [role=textbox]')) {
      if (!visible(e)) continue;
      const s = getComputedStyle(e), around = background(e.parentElement);
      if (/^(checkbox|radio)$/.test((e as HTMLInputElement).type) && s.appearance !== 'none') { e.setAttribute('data-a11y-ink', String(n)); native.push(`${n++} ${name(e)}`); continue; }
      const own = parse(s.backgroundColor), border = parse(s.borderBottomColor), width = parseFloat(s.borderBottomWidth);
      if (!around) { graphicsUnresolved.push(`${name(e)} boundary over an image`); continue; }
      const edges = [width > 0 && border ? ratio(over(border, around), around) : 0, own && own[3] > 0 ? ratio(over(own, around), around) : 0];
      boundaries.push({ el: name(e), ratio: Math.max(...edges) });
    }
    // Meaningful graphics: any not hidden from assistive technology, and an icon that alone identifies its control. The
    // page reports each SVG's painted shapes in paint order with the page colour behind it; graphics.mjs judges them.
    const graphicsRaw: { el: string; bg: number[]; shapes: { tag: string; exact: boolean; round: boolean; box: { left: number; top: number; right: number; bottom: number }; fill: number[] | null; stroke: number[] | null }[]; open: string }[] = [];
    const controlOf = (e: Element) => e.closest('button, a[href], summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [role=option]');
    for (const g of document.querySelectorAll('svg, img, canvas, [role=img], input[type=image]')) {
      if (!visible(g) || (g.tagName.toLowerCase() !== 'svg' && g.closest('svg'))) continue;
      const ctl = controlOf(g);
      const needed = ctl ? !((ctl as HTMLElement).innerText || '').replace(/[^\p{L}\p{N}]/gu, '') : !g.closest('[aria-hidden="true"], [role=presentation], [role=none]') && !(g.tagName === 'IMG' && g.getAttribute('alt') === '');
      if (!needed) continue;
      if (g.tagName.toLowerCase() !== 'svg') { graphicsUnresolved.push(`${name(g)}: a raster or canvas graphic, not measured`); continue; }
      const bg = background(g.parentElement);
      if (!bg) { graphicsUnresolved.push(`${name(g)} over an image`); continue; }
      let open = '';
      const shapes: { tag: string; exact: boolean; round: boolean; box: { left: number; top: number; right: number; bottom: number }; fill: number[] | null; stroke: number[] | null }[] = [];
      for (const sh of g.querySelectorAll('path, circle, rect, ellipse, line, polyline, polygon, text, use')) {
        if (sh.closest('defs, mask, clipPath, symbol, pattern, marker')) continue;
        const s = getComputedStyle(sh), op = opacity(sh);
        const paint = (p: string, a: number) => { if (p === 'none') return null; const c = parse(p); if (!c) { open = 'a gradient or pattern paint'; return null; } return c[3] * a * op > 0 ? [c[0], c[1], c[2], c[3] * a * op] : null; };
        const fill = paint(s.fill, Number(s.fillOpacity)), stroke = parseFloat(s.strokeWidth) > 0 ? paint(s.stroke, Number(s.strokeOpacity)) : null;
        if (!fill && !stroke) continue;
        const r = sh.getBoundingClientRect();
        // Exact when the box is the shape's whole area: a rectangle with square corners and no transform up to the graphic.
        const zero = (v: string | null) => v === null || /^\s*\+?(0+\.?0*|\.0+)\s*(px)?\s*$/.test(v);
        let exact = sh.tagName.toLowerCase() === 'rect' && zero(sh.getAttribute('rx')) && zero(sh.getAttribute('ry'));
        // Round when a circle or ellipse: its area is the ellipse in its box, which graphics.mjs measures in place of the box.
        let round = sh.tagName.toLowerCase() === 'circle' || sh.tagName.toLowerCase() === 'ellipse';
        // Nor a clipped, masked or filtered one, whose painted area is less than its box.
        for (let e: Element | null = sh; e && e !== g.parentElement; e = e.parentElement) {
          const c = getComputedStyle(e);
          if (c.transform !== 'none' || (c.clipPath && c.clipPath !== 'none') || ((c as any).maskImage && (c as any).maskImage !== 'none') || (c.filter && c.filter !== 'none')) { exact = false; round = false; }
        }
        for (const k of ['rx', 'ry']) { const v = (s as any)[k]; if (v && !/^(auto|0(px)?)$/.test(v)) exact = false; }
        shapes.push({ tag: sh.tagName.toLowerCase(), exact, round, box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, fill, stroke });
      }
      graphicsRaw.push({ el: name(g), bg, shapes, open });
    }
    return { text, boundaries, native, graphicsRaw, unresolved, graphicsUnresolved };
  });
  // The shapes are judged here, in plain Node, by the module the confined suite holds to known answers.
  const graphics: { el: string; state: 'pass' | 'fail'; low: number; shapes: number; reason: string }[] = [], graphicsUnresolved = [...raw.graphicsUnresolved];
  for (const g of raw.graphicsRaw) {
    const v = judgeGraphic(g.bg, g.shapes, g.open);
    if (v.state === 'unresolved') graphicsUnresolved.push(`${g.el}: ${v.reason}`);
    else graphics.push({ el: g.el, state: v.state, low: v.low, shapes: v.shapes, reason: v.reason });
  }
  return { text: raw.text, boundaries: raw.boundaries, native: raw.native, graphics, unresolved: raw.unresolved, graphicsUnresolved };
}

// State cues: each toggle, unchecked radio, unselected tab or option is activated — by Space, else Enter, else a pointer
// click where neither key changes its state — and its own box, unfocused and unhovered, compared before and after.
// The cue is the pixels that changed; in either state, the changed pixels that border unchanged ones must contrast
// 3:1 with them — the cue against its adjacent colours — over at least 6 px. An activation that leaves the page or
// changes no state, a control that cannot be found again, and with colours forced a control that only a click
// changes (Chromium then repaints its border, which is no cue) leave the cue unresolved.
const STATEFUL = 'input[type=checkbox]:not(:disabled), input[type=radio]:not(:checked):not(:disabled), [role=checkbox]:not([aria-disabled=true]), [role=switch]:not([aria-disabled=true]), [role=radio][aria-checked=false], [aria-pressed]:not([aria-disabled=true]), [role=tab][aria-selected=false], [role=option][aria-selected=false]';
export async function stateCues(page: Page, state: State, limit = 20) {
  const fails: string[] = [], unresolved: string[] = [];
  let measured = 0;
  const count = await page.locator(STATEFUL).count();
  for (let i = 0; i < Math.min(count, limit); i++) {
    await open(page, state);
    const url = page.url(), el = page.locator(STATEFUL).nth(i);
    if (await page.locator(STATEFUL).count() !== count || !(await el.isVisible())) { unresolved.push(`stateful control ${i + 1} not found again`); continue; }
    const label = await el.evaluate((e) => e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}[${e.getAttribute('role') || (e as HTMLInputElement).type || ''}]`);
    await el.scrollIntoViewIfNeeded();
    const r = await el.boundingBox(), clip = r && around(page, r, 2);
    if (!clip) { unresolved.push(`${label}: no box`); continue; }
    const still = async () => { await page.mouse.move(0, 0); await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.()); return pixels(page, clip); };
    const before = await still();
    const stateOf = () => el.evaluate((e) => [...['aria-pressed', 'aria-checked', 'aria-selected', 'aria-expanded'].map((a) => e.getAttribute(a)), String((e as HTMLInputElement).checked)].join('|'));
    const s0 = await stateOf();
    let by = 'none';
    for (const key of ['Space', 'Enter']) { if (by !== 'none') break; await el.focus(); await page.keyboard.press(key); if (await stateOf() !== s0) by = 'keyboard'; }
    if (by === 'none') { await el.click(); if (await stateOf() !== s0) by = 'pointer'; }
    if (page.url() !== url) { unresolved.push(`${label}: the activation left the page`); continue; }
    if (by === 'none') { unresolved.push(`${label}: neither Space, Enter nor a click changed its state`); continue; }
    if (by === 'pointer' && await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) { unresolved.push(`${label}: changes state by pointer only, not measured with colours forced`); continue; }
    const after = await still();
    const changed = new Uint8Array(before.w * before.h);
    for (let p = 0, i = 0; i < before.data.length; i += 4, p++) if (before.data[i] !== after.data[i] || before.data[i + 1] !== after.data[i + 1] || before.data[i + 2] !== after.data[i + 2]) changed[p] = 1;
    const edge = (img: { w: number; h: number; data: number[] }) => {
      let n = 0;
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
        const p = y * img.w + x;
        if (!changed[p]) continue;
        const l = lum3(img.data, p * 4);
        if ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => nx >= 0 && ny >= 0 && nx < img.w && ny < img.h && !changed[ny * img.w + nx] && ratio3(l, lum3(img.data, (ny * img.w + nx) * 4)) >= 3)) n++;
      }
      return n;
    };
    const strong = Math.max(edge(before), edge(after));
    measured++;
    if (strong < 6) fails.push(`${label}: ${strong} px of cue at 3:1 against its adjacent colours between its states`);
  }
  if (count > limit) unresolved.push(`${count - limit} stateful control(s) past the first ${limit} not measured`);
  return { fails, unresolved, measured };
}

export async function contrastRows(page: Page, state: State): Promise<Rows> {
  const { text, boundaries, native, graphics, unresolved, graphicsUnresolved } = await contrastPairs(page);
  const short = (r: number) => r.toFixed(2);
  const nativeLow: string[] = [];
  for (const n of native) { const [i, el] = n.split(' '); if (!(await ink(page, page.locator(`[data-a11y-ink="${i}"]`)))) nativeLow.push(`${el}: no pixel at 3:1 against its surround`); }
  await page.evaluate(() => document.querySelectorAll('[data-a11y-ink]').forEach((e) => e.removeAttribute('data-a11y-ink')));
  const cues = await stateCues(page, state);
  const fail1411 = [...boundaries.filter((b) => b.ratio < 3).map((b) => `${b.el} boundary ${short(b.ratio)}:1`), ...nativeLow, ...graphics.filter((g) => g.state === 'fail').map((g) => `${g.el}: ${g.reason}`), ...cues.fails];
  const open1411 = [...graphicsUnresolved, ...cues.unresolved];
  const rows: Rows = {
    // contrast.mjs judges the text: what WCAG exempts set aside, a text shadow measured or a review, no pair not run.
    '1.4.3': textRow(text, 4.5, 3, unresolved),
    '1.4.11': fail1411.length ? verdict(fail1411, '') : open1411.length ? { state: 'not_run', reason: `unresolved: ${open1411.slice(0, 5).join('; ')}` } : { state: 'pass', reason: `${boundaries.length + native.length} boundary(ies), ${graphics.length} graphic(s) and ${cues.measured} state cue(s) at 3:1` },
  };
  if (AAA) rows['1.4.6'] = textRow(text, 7, 4.5, unresolved);
  return rows;
}

// 2.5.3: each control with a visible text label, its accessible name read from Playwright's own ARIA snapshot of it,
// must contain that label by the label in name algorithm (names.mjs): round brackets and what they hold removed, case
// and everything but letters and digits aside, the label's words a contiguous run of the name's. A button's or link's
// label is its visible inner text, walked in the flat tree as ACT defines it — an element that is rendered but not
// visible, such as one clipped to nothing, gives a space, not its text — with its non-text content left out: a lone
// letter where aria-label or aria-labelledby names the control, and a word an icon font draws (V31-A11Y-VERDICTS). A
// field's is its label elements' visible inner text, else its placeholder while the field is empty. A field named by
// aria-labelledby takes its name from visible text by construction. A field named by aria-label alone has a visible
// label this cannot read, and is unresolved; a control with no visible text label has none to keep.
const LABELLED = 'button, a[href], summary, [role=button], [role=link], [role=menuitem], [role=tab], [role=option], [role=checkbox], [role=radio], [role=switch], input:not([type=hidden]), select, textarea';
type Part = { t: string; font: string } | { sep: string };
export async function labelInNameRows(page: Page): Promise<Rows> {
  const found = await page.evaluate((sel) => {
    const kids = (n: Node): Node[] => (n as Element).shadowRoot ? [...(n as Element).shadowRoot!.childNodes] : (n as Element).tagName === 'SLOT' && (n as HTMLSlotElement).assignedNodes().length ? (n as HTMLSlotElement).assignedNodes() : [...n.childNodes];
    const rendered = (e: Element) => getComputedStyle(e).display !== 'none' && (e.getClientRects().length > 0 || getComputedStyle(e).display === 'contents');
    const clipped = (e: Element) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      // An inset of half or more from both sides on one axis leaves nothing: inset(50%), never inset(50% 0 0 0).
      const inset = /inset\(([^)]*)\)/.exec(s.clipPath), pc = inset ? inset[1].split(/\s+round\s/)[0].trim().split(/\s+/).map((x) => (/%$/.test(x) ? parseFloat(x) : NaN)) : [];
      if (pc.length) { const [t, r2 = t, b = t, l = r2] = pc; if (t + b >= 100 || l + r2 >= 100) return true; }
      const m = /rect\(([^)]*)\)/.exec(s.clip); const v = m ? m[1].split(/[\s,]+/).map(parseFloat) : [];
      if (v.length === 4 && /^(absolute|fixed)$/.test(s.position) && (v[2] - v[0] <= 0 || v[1] - v[3] <= 0)) return true;
      return s.overflowX !== 'visible' && s.overflowY !== 'visible' && r.width <= 1 && r.height <= 1;
    };
    const shown = (e: Element) => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && Number(s.opacity) > 0 && !clipped(e); };
    // ACT's visible inner text, as parts: a visible text node with its font, or the space or line break an element gives.
    const walk = (n: Node, out: ({ t: string; font: string } | { sep: string })[]) => {
      if (n.nodeType === 3) {
        const p = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentElement;
        if (p && rendered(p)) { if (shown(p)) out.push({ t: (n as Text).data.replace(/\s+/g, ' '), font: getComputedStyle(p).fontFamily }); else if (!(n as Text).data.trim()) out.push({ sep: ' ' }); }
        return;
      }
      if (n.nodeType !== 1) { for (const k of kids(n)) walk(k, out); return; }
      const e = n as Element, d = getComputedStyle(e).display;
      if (!rendered(e)) return;
      if (!shown(e)) { if (e.getBoundingClientRect().width > 0) out.push({ sep: ' ' }); return; }
      if (e.tagName === 'BR') { out.push({ sep: '\n' }); return; }
      const sep = /^(block|flex|grid|table|list-item|flow-root)(\s|$)/.test(d) || d === 'table-caption' ? '\n' : /^table-(cell|row)$/.test(d) ? ' ' : '';
      if (sep) out.push({ sep });
      for (const k of kids(e)) walk(k, out);
      if (sep) out.push({ sep });
    };
    const parts = (e: Element) => { const out: ({ t: string; font: string } | { sep: string })[] = []; walk(e, out); return out; };
    const text = (ps: ({ t: string } | { sep: string })[]) => ps.map((p) => ('sep' in p ? p.sep : p.t)).join('');
    return [...document.querySelectorAll(sel)].map((e, i) => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      if (!(r.width > 0 && r.height > 0 && s.visibility !== 'hidden')) return null;
      const f = e as HTMLInputElement, field = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName);
      const named = e.hasAttribute('aria-label') || e.hasAttribute('aria-labelledby');
      const own = e.tagName === 'INPUT' && /^(submit|button|reset)$/.test(f.type) ? [{ t: f.value, font: '' }] : [];
      const fromLabels = f.labels?.length ? [...f.labels].flatMap((l) => [...parts(l), { sep: ' ' }]) : [];
      const placeholder = field && !own.length && !/[\p{L}\p{N}]/u.test(text(fromLabels)) && !f.value ? [{ t: e.getAttribute('placeholder') || '', font: '' }] : [];
      const label: ({ t: string; font: string } | { sep: string })[] = own.length ? own : /[\p{L}\p{N}]/u.test(text(fromLabels)) ? fromLabels : placeholder.length ? placeholder : field ? [] : parts(e);
      const el = e.id ? `#${e.id}` : e.tagName.toLowerCase();
      e.setAttribute('data-a11y-lin', String(i));
      return { i, el, parts: label, named, field, aria: !!e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') };
    }).filter(Boolean);
  }, LABELLED) as { i: number; el: string; parts: Part[]; named: boolean; field: boolean; aria: boolean }[];
  // The non-text content is left out here, in plain Node, by the module the confined suite holds to known answers.
  const read = found.map((c) => ({ ...c, label: labelFrom(c.parts, c.named) }));
  const unresolved = read.filter((c) => !/[\p{L}\p{N}]/u.test(c.label) && c.field && c.aria).map((c) => `${c.el}: named by aria-label; its visible label, if any, cannot be read from a label element or placeholder`);
  const labels = read.filter((c) => /[\p{L}\p{N}]/u.test(c.label));
  const problems: string[] = [];
  for (const l of labels) {
    const first = (await page.locator(`[data-a11y-lin="${l.i}"]`).ariaSnapshot()).split('\n')[0];
    const m = first.match(/^- '?[a-z]+ ("(?:[^"\\]|\\.)*")/);
    const name = m ? JSON.parse(m[1]) : '';
    if (!contained(l.label, name)) problems.push(`${l.el}: visible label "${l.label.slice(0, 40)}" not in its name "${name.slice(0, 40)}"`);
  }
  await page.evaluate(() => document.querySelectorAll('[data-a11y-lin]').forEach((e) => e.removeAttribute('data-a11y-lin')));
  const v = verdict(problems, labels.length ? `${labels.length} control(s) named with their visible label` : 'no control with a visible text label');
  return { '2.5.3': v.state === 'pass' && unresolved.length ? { state: 'not_run', reason: `unresolved: ${unresolved.slice(0, 3).join('; ')}` } : v };
}

// The reviewed ARIA snapshot's rows: a row is credited only when the reviewed template lists, with its name and
// states, every node of the roles that row speaks to, so a match shows that row; a row whose nodes the template
// leaves out is not run. A page that no longer matches its reviewed snapshot fails every row the test claims. 4.1.2
// speaks to state changes too: where the page has stateful controls, each declared interaction's reviewed snapshot,
// taken after it runs from a fresh open, must match and list every state its nodes then show; with none declared,
// 4.1.2 is not run.
export const SNAPSHOT_ROLES: Record<string, string[]> = {
  '1.1.1': ['img'],
  '1.3.1': ['heading', 'list', 'table', 'grid', 'group', 'radiogroup', 'banner', 'main', 'navigation', 'contentinfo', 'complementary', 'region', 'form', 'search'],
  '1.3.6': ['banner', 'main', 'navigation', 'contentinfo', 'complementary', 'region', 'form', 'search', 'img'],
  '2.4.6': ['heading', 'textbox', 'searchbox', 'combobox', 'listbox', 'spinbutton', 'slider', 'checkbox', 'radio', 'switch'],
  '4.1.2': ['button', 'link', 'textbox', 'searchbox', 'combobox', 'listbox', 'option', 'spinbutton', 'slider', 'checkbox', 'radio', 'switch', 'tab', 'tabpanel', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'treeitem', 'dialog', 'alertdialog'],
};
const STATEFUL_DOM = '[aria-pressed], [aria-checked], [aria-expanded], [aria-selected], input[type=checkbox], input[type=radio], details, [role=checkbox], [role=radio], [role=switch], [role=tab], [role=option], [role=menuitemcheckbox], [role=menuitemradio], [role=treeitem]';
export type SnapshotNode = { role: string; name: string | RegExp | null; states: string[] };
export function snapshotNodes(yaml: string): SnapshotNode[] {
  const out: SnapshotNode[] = [];
  for (const line of yaml.split('\n')) {
    const m = line.match(/^\s*- '?([a-z]+)(?: ("(?:[^"\\]|\\.)*"|\/(?:[^/\\]|\\.)+\/))?((?:\s*\[[a-z]+(?:=[^\]]+)?\])*)(?=[\s:'\[]|$)/);
    if (!m || m[1] === 'text') continue;
    out.push({ role: m[1], name: !m[2] ? null : m[2][0] === '"' ? JSON.parse(m[2]) : new RegExp(m[2].slice(1, -1)), states: [...m[3].matchAll(/\[([a-z]+(?:=[^\]]+)?)\]/g)].map((x) => x[1]).sort() });
  }
  return out;
}
const sameStates = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i]);
const matches = (w: SnapshotNode, a: SnapshotNode) => w.role === a.role && sameStates(w.states, a.states) && (w.name === null ? !a.name : typeof w.name === 'string' ? w.name === a.name : !!a.name && w.name.test(a.name as string));
// The nodes of the given roles in the actual snapshot that the template does not list as they are; with `statedOnly`
// a node with no state token needs no listing, as a template after an interaction may be partial.
export function snapshotCover(template: string, actual: string, roles: string[], statedOnly = false) {
  const want = snapshotNodes(template), used = new Set<number>();
  return snapshotNodes(actual).filter((a) => roles.includes(a.role) && (!statedOnly || a.states.length)).filter((a) => {
    const k = want.findIndex((w, j) => !used.has(j) && matches(w, a));
    if (k >= 0) used.add(k);
    return k < 0;
  }).map((a) => `${a.role}${a.name ? ` "${String(a.name).slice(0, 30)}"` : ''}${a.states.map((s) => ` [${s}]`).join('')}`);
}
const mismatch = async (root: Locator, template: string) => { try { await expect(root).toMatchAriaSnapshot(template, { timeout: 2000 }); return ''; } catch (e) { return String((e as Error).message).replace(/\x1b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' ').slice(0, 200); } };
export async function snapshotRows(page: Page, state: State): Promise<Rows> {
  const root = () => page.locator(state.snapshotRoot ?? 'body');
  const differs = await mismatch(root(), state.snapshot!);
  const actual = await root().ariaSnapshot();
  const rows: Rows = {};
  for (const [id, roles] of Object.entries(SNAPSHOT_ROLES)) {
    const left = snapshotCover(state.snapshot!, actual, roles);
    rows[id] = differs ? { state: 'fail', reason: `the page differs from its reviewed ARIA snapshot: ${differs}` }
      : left.length ? { state: 'not_run', reason: `the reviewed snapshot does not list ${left.length} node(s): ${left.slice(0, 5).join(', ')}` }
      : { state: 'pass', reason: `matches the reviewed snapshot, which lists every ${roles.slice(0, 3).join(', ')}… node` };
  }
  const stateful = await page.locator(STATEFUL_DOM).count();
  const reviewed = (state.interactions ?? []).filter((i) => i.snapshot);
  if (rows['4.1.2'].state === 'pass' && stateful && !reviewed.length) rows['4.1.2'] = { state: 'not_run', reason: `state changes not reviewed: ${stateful} stateful control(s), and no interaction in tests/a11y/project.mjs declares a snapshot after it` };
  for (const i of reviewed) {
    if (rows['4.1.2'].state === 'fail') break;
    await open(page, state);
    await i.run({ page });
    const d = await mismatch(root(), i.snapshot!);
    const left = snapshotCover(i.snapshot!, await root().ariaSnapshot(), SNAPSHOT_ROLES['4.1.2'], true);
    if (d) rows['4.1.2'] = { state: 'fail', reason: `after ${i.name}, the page differs from its reviewed snapshot: ${d}` };
    else if (left.length && rows['4.1.2'].state === 'pass') rows['4.1.2'] = { state: 'not_run', reason: `after ${i.name}, the reviewed snapshot does not list ${left.length} stated node(s): ${left.slice(0, 5).join(', ')}` };
    else if (rows['4.1.2'].state === 'pass') rows['4.1.2'] = { state: 'pass', reason: `${rows['4.1.2'].reason}; after ${i.name}, states as reviewed` };
  }
  return rows;
}

// Pointer targets' boxes; an undersized target passes 2.5.8 when a 24 px circle on its centre meets no other target.
export async function targetRows(page: Page): Promise<Rows> {
  const targets = await page.evaluate(() => {
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], [role=option], [role=slider], [role=spinbutton], [role=combobox], [tabindex]:not([tabindex="-1"])';
    return [...document.querySelectorAll(sel)].map((e) => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      const inline = e.tagName === 'A' && s.display === 'inline' && !!e.parentElement && [...e.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      return { el: e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}${e.getAttribute('name') ? `[name=${e.getAttribute('name')}]` : ''}`, x: r.x, y: r.y, w: r.width, h: r.height, inline, shown: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' };
    }).filter((t) => t.shown);
  });
  type T = typeof targets[number];
  const centre = (t: T) => [t.x + t.w / 2, t.y + t.h / 2];
  const small = (min: number) => targets.filter((t) => !t.inline && (t.w < min || t.h < min));
  const under24 = new Set(small(24));
  // 2.5.8's spacing exception: a 24 px circle on an undersized target's centre meets no other target and no other
  // undersized target's circle.
  const meetsRect = (c: number[], o: T) => Math.hypot(c[0] - Math.max(o.x, Math.min(c[0], o.x + o.w)), c[1] - Math.max(o.y, Math.min(c[1], o.y + o.h))) < 12;
  const spaced = (t: T) => targets.every((o) => o === t || (!meetsRect(centre(t), o) && !(under24.has(o) && Math.hypot(centre(o)[0] - centre(t)[0], centre(o)[1] - centre(t)[1]) < 24)));
  const size = (t: T) => `${t.el} ${Math.round(t.w)}x${Math.round(t.h)} px`;
  const least = targets.length ? `, the smallest ${size(targets.reduce((a, b) => (Math.min(b.w, b.h) < Math.min(a.w, a.h) ? b : a)))}` : '';
  const rows: Rows = {
    '2.5.8': verdict(small(24).filter((t) => !spaced(t)).map(size), `${targets.length} target(s) at 24 px or spaced${least}`),
    SUP03: verdict(small(HOUSE_TARGET).map(size), `${targets.length} target(s) at the house size, ${HOUSE_TARGET} px${least}`),
  };
  if (AAA) rows['2.5.5'] = verdict(small(44).map(size), `${targets.length} target(s) at 44 px or more${least}`);
  return rows;
}

// Changed pixels between the unfocused and focused element, decoded through the browser's own canvas.
async function changedPixels(page: Page, clip: { x: number; y: number; width: number; height: number }, before: Buffer, after: Buffer) {
  return page.evaluate(async ({ a, b }) => {
    const decode = async (s: string) => { const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob()); const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext('2d')!; x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };
    const [p, q] = [await decode(a), await decode(b)];
    const lum = (d: Uint8ClampedArray, i: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]); };
    let changed = 0, strong = 0;
    for (let i = 0; i < p.data.length; i += 4) {
      if (p.data[i] === q.data[i] && p.data[i + 1] === q.data[i + 1] && p.data[i + 2] === q.data[i + 2]) continue;
      changed++;
      const [x, y] = [lum(p.data, i), lum(q.data, i)].sort((m, n) => n - m);
      if ((x + 0.05) / (y + 0.05) >= 3) strong++;
    }
    return { changed, strong };
  }, { a: before.toString('base64'), b: after.toString('base64') });
}

// One keyboard step's focus evidence: an indicator visible, the element not hidden under author content, and at AAA
// the changed area at least a 2 px perimeter of the unfocused component, changing by 3:1.
export async function focusStep(page: Page) {
  const box = await page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    if (!e || e === document.body) return null;
    const r = e.getBoundingClientRect();
    // Hit tests on a grid across the element, its far edges included, at most about 1,600 points.
    const step = Math.max(2, Math.sqrt((r.width * r.height) / 1600));
    const points: number[][] = [];
    for (let x = r.x + 0.5; x < r.x + r.width; x += step) for (let y = r.y + 0.5; y < r.y + r.height; y += step) points.push([x, y]);
    for (const [x, y] of [[r.x + r.width - 0.5, r.y + 0.5], [r.x + 0.5, r.y + r.height - 0.5], [r.x + r.width - 0.5, r.y + r.height - 0.5]]) points.push([x, y]);
    const hits = points.map(([x, y]) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h) || h.contains(e)); });
    return { el: e.id ? `#${e.id}` : e.tagName.toLowerCase(), x: r.x, y: r.y, w: r.width, h: r.height, hits };
  });
  if (!box) return null;
  const pad = 6, vp = page.viewportSize()!;
  const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(vp.width, box.w + 2 * pad), height: Math.min(vp.height, box.h + 2 * pad) };
  const focused = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  await page.evaluate(() => { const e = document.activeElement as HTMLElement; (window as any).__a11yRefocus = e; e.blur(); });
  const plain = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  await page.evaluate(() => { (window as any).__a11yRefocus.focus({ preventScroll: true }); });
  const { changed, strong } = await changedPixels(page, clip, plain, focused);
  return { el: box.el, visible: changed > 0, hidden: box.hits.every((h) => !h), partly: box.hits.some((h) => !h), strong, perimeter: Math.max(0, 4 * box.w + 4 * box.h - 16) };
}

// The engine-aware Tab (stage 4's second session). WebKit on macOS moves Tab among text fields alone, as Safari does by
// default, and reaches every control on Option+Tab, so that is the key it is sent; Chromium and Firefox take Tab.
export const engineOf = (page: Page) => page.context().browser()?.browserType().name() ?? 'chromium';
export const tabKey = (page: Page, back = false) => `${engineOf(page) === 'webkit' && process.platform === 'darwin' ? 'Alt+' : ''}${back ? 'Shift+' : ''}Tab`;
export async function tab(page: Page, back = false) { await page.keyboard.press(tabKey(page, back)); }
// A key a declaration names: Tab and Shift+Tab go through the engine-aware Tab, any other key as named.
export const keyFor = (page: Page, key: string) => (key === 'Tab' ? tabKey(page) : key === 'Shift+Tab' ? tabKey(page, true) : key);
// Whether a Tab in Firefox that left focus where it was reached the end of the page. Playwright's Firefox has no browser
// controls to move on to, so focus stays on the last control there, never leaving it, where Chromium and WebKit move it
// off the page. Only there, and only when the control is the last in sequential order, no script prevented the key and
// focus never left the control during it: a script that prevents the Tab, or refocuses the control as it blurs, is
// still a trap, as is a held focus anywhere else or in another engine.
const END_PROBE = `(() => { window.__a11yTab = null; window.__a11yLeft = false; addEventListener('focusout', () => { window.__a11yLeft = true; }, { capture: true, once: true }); addEventListener('keydown', (e) => { if (e.key === 'Tab') setTimeout(() => { window.__a11yTab = e.defaultPrevented; }); }, { capture: true, once: true }); })()`;
async function endOfPage(page: Page) {
  if (engineOf(page) !== 'firefox') return false;
  return page.evaluate(async () => {
    await new Promise((r) => setTimeout(r));
    const w = window as unknown as { __a11yTab: boolean | null; __a11yLeft: boolean };
    if (w.__a11yTab !== false || w.__a11yLeft) return false;
    const order = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]')]
      .filter((e) => e.tabIndex >= 0 && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
      .map((e, i) => ({ e, k: e.tabIndex > 0 ? e.tabIndex : Infinity, i })).sort((a, b) => (a.k - b.k) || (a.i - b.i));
    return order.length > 0 && order.at(-1)!.e === document.activeElement;
  });
}

// Tab through a state with real key events: every step's focus evidence, the order, traps and context changes.
export async function tabWalk(page: Page, limit = 60) {
  const startUrl = page.url();
  const steps: { el: string; key: string; changedContext: boolean }[] = [];
  const evidence: NonNullable<Awaited<ReturnType<typeof focusStep>>>[] = [];
  let stuck = 0, last = '', looped = false;
  const pages = page.context().pages().length;
  const key = tabKey(page);
  for (let i = 0; i < limit; i++) {
    await page.evaluate(END_PROBE);
    await page.keyboard.press(key);
    const id = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return ''; return e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}:${[...document.querySelectorAll(e.tagName)].indexOf(e)}`; });
    const changedContext = page.url() !== startUrl || page.context().pages().length !== pages;
    if (id && id === last && !changedContext && await endOfPage(page)) break; // the end of the page, not a trap
    steps.push({ el: id, key, changedContext });
    if (changedContext) break;
    if (id && id === last) stuck++; else stuck = 0;
    if (stuck >= 2) break;
    if (!id || (steps.length > 1 && id === steps[0].el)) break; // focus left the page or came round to the start
    if (steps.slice(0, -1).some((s) => s.el === id)) { looped = true; break; } // round again without the start: a trap
    last = id;
    const e = await focusStep(page); if (e) evidence.push(e);
  }
  const reachable = await page.evaluate(() => [...document.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).length);
  return { steps, evidence, trapped: stuck >= 2 || looped, reached: new Set(steps.map((s) => s.el).filter(Boolean)).size, reachable };
}

// Run one declared keyboard function: its steps at no delay, then with a long gap between keys. Either failing means
// the function needs a timing (2.1.3); both failing means it does not work by keyboard (2.1.1).
export async function keyboardFunction(page: Page, fn: { state: { path: string; setup?: (a: { page: Page }) => Promise<void> }; steps: ({ focus: string } | { press: string } | { type: string })[]; check: (a: { page: Page }) => Promise<boolean> }) {
  const run = async (gap: number) => {
    await open(page, fn.state);
    for (const s of fn.steps) {
      if ('focus' in s) await page.locator(s.focus).focus();
      else if ('press' in s) { await page.keyboard.press(keyFor(page, s.press)); if (gap) await page.waitForTimeout(gap); }
      else for (const ch of s.type) { await page.keyboard.press(ch); if (gap) await page.waitForTimeout(gap); }
    }
    return fn.check({ page });
  };
  return { fast: await run(0), slow: await run(SLOW_GAP) };
}

// A declared dialog from the keyboard: it opens on Enter with focus inside; Escape, or a named close control, leaves it
// (2.1.2's standard exit); focus returns to the opener on Escape (2.4.3).
export async function dialogRows(page: Page, d: { opener: string; dialog?: string }): Promise<Rows> {
  await page.locator(d.opener).focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator(d.dialog ?? '[role=dialog], [role=alertdialog], dialog[open]').first();
  await expect(dialog, 'the dialog opens from the keyboard').toBeVisible();
  const inside = await dialog.evaluate((e) => e.contains(document.activeElement));
  await page.keyboard.press('Escape');
  const closed = !(await dialog.isVisible());
  const back = closed && await page.locator(d.opener).evaluate((e) => e === document.activeElement);
  let leftByControl = false;
  if (!closed) { // the advised exit: a named close control, reached by Tab and pressed, must close the dialog
    const close = dialog.getByRole('button', { name: /close|cancel|dismiss/i }).first();
    if (await close.count()) {
      for (let i = 0; i < 20 && !(await close.evaluate((e) => e === document.activeElement)); i++) await tab(page);
      if (await close.evaluate((e) => e === document.activeElement)) { await page.keyboard.press('Enter'); leftByControl = !(await dialog.isVisible()); }
    }
  }
  return {
    '2.1.2': verdict(closed || leftByControl ? [] : ['neither Escape nor a close control reached by Tab leaves the dialog'], closed ? 'Escape closes the dialog' : 'a close control reached by Tab leaves the dialog'),
    '2.4.3': verdict([...(inside ? [] : ['focus did not move into the dialog']), ...(closed && !back ? ['focus did not return to the opener on Escape'] : [])], 'focus moves in and returns to the opener'),
  };
}

// Clipped or overflowing content under an adaptation: text that no longer fits its box when the box hides overflow,
// and a document wider than the viewport.
export async function clipping(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 1) out.push(`page scrolls horizontally: ${doc.scrollWidth} px in ${window.innerWidth} px`);
    for (const e of document.querySelectorAll('body *')) {
      const s = getComputedStyle(e);
      if (!/(hidden|clip)/.test(s.overflowX + s.overflowY) || !(e.textContent || '').trim()) continue;
      if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) out.push(`${e.id ? `#${e.id}` : e.tagName.toLowerCase()} clips its content`);
    }
    return out;
  });
}
export const SPACING = '*, *::before, *::after { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';

// What a state declares it must keep under each adaptation (tests/a11y/project.mjs `keeps`): each content selector
// still shown, unclipped by its containers and, where the width is narrow, inside the viewport's width; each cue
// still inked at 3:1 against its surround; each function still working from a fresh open under the adaptation. A
// state that declares nothing to keep leaves the row not run: no loss can be shown absent without a declaration.
export async function kept(page: Page, state: State, fresh: () => Promise<void>, where: string, narrow = false): Promise<string[] | null> {
  const k = state.keeps;
  if (!k || !(k.content?.length || k.cues?.length || k.functions?.length)) return null;
  const lost: string[] = [];
  await fresh();
  for (const sel of k.content ?? []) {
    const el = page.locator(sel).first();
    if (!(await el.count()) || !(await el.isVisible())) { lost.push(`${where}: content ${sel} is gone`); continue; }
    await el.scrollIntoViewIfNeeded();
    const why = await el.evaluate((e, narrow) => {
      const r = e.getBoundingClientRect();
      if (narrow && (r.left < -1 || r.right > window.innerWidth + 1)) return `lies outside the ${window.innerWidth} px viewport`;
      for (let p = e.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (!/(hidden|clip)/.test(s.overflowX + s.overflowY)) continue; const q = p.getBoundingClientRect(); if (r.left < q.left - 1 || r.right > q.right + 1 || r.top < q.top - 1 || r.bottom > q.bottom + 1) return `is clipped by ${p.id ? `#${p.id}` : p.tagName.toLowerCase()}`; }
      return '';
    }, narrow);
    if (why) lost.push(`${where}: content ${sel} ${why}`);
  }
  for (const sel of k.cues ?? []) {
    const el = page.locator(sel).first();
    if (!(await el.count()) || !(await el.isVisible())) { lost.push(`${where}: cue ${sel} is gone`); continue; }
    if (!(await ink(page, el))) lost.push(`${where}: cue ${sel} shows no pixel at 3:1 against its surround`);
  }
  for (const f of k.functions ?? []) {
    await fresh();
    let ok = false, why = 'returned false';
    try { ok = await f.run({ page }); } catch (e) { why = String((e as Error).message).split('\n')[0]; }
    if (!ok) lost.push(`${where}: function ${f.name} fails (${why.slice(0, 80)})`);
  }
  return lost;
}
// A measured loss fails whether or not the state declares what it keeps; with no loss measured and nothing declared, the
// row is not run.
export const keepRow = (problems: string[], lost: string[] | null, ok: string, state: State) => problems.length || lost?.length ? verdict([...problems, ...(lost ?? [])], ok) : lost === null ? { state: "not_run" as const, reason: `state ${state.name} declares no content, cue or function to keep in tests/a11y/project.mjs` } : verdict([], ok);

// Animations by kind: motion moves, scales or re-lays out an element; the rest fade or recolour it.
const MOTION = /^(transform|translate|rotate|scale|top|left|right|bottom|inset|margin|padding|width|height|offset|backgroundPosition|backgroundSize|scroll)/i;
type Anim = { on: string; kind: string; props: string[] };
// A recorder installed before an interaction: every CSS transition or animation that starts after it, however short,
// is logged as it starts; animations made by script are caught by the samples that follow.
async function recordMotion(page: Page) {
  await page.evaluate(() => {
    const log: { on: string; kind: string; props: string[] }[] = [];
    (window as any).__a11yMotion = log; (window as any).__a11yAnimations = new Set(document.getAnimations());
    const name = (t: EventTarget | null) => { const e = t as Element | null; return e && e.nodeType === 1 ? (e.id ? `#${e.id}` : e.tagName.toLowerCase()) : 'unknown'; };
    const keys = (a: Animation) => ((a.effect as KeyframeEffect | null)?.getKeyframes() ?? []).flatMap((k) => Object.keys(k)).filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p));
    document.addEventListener('transitionstart', (e) => log.push({ on: name(e.target), kind: 'CSSTransition', props: [(e as TransitionEvent).propertyName] }), true);
    document.addEventListener('animationstart', (e) => { const t = e.target as Element; const props = document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.target === t).flatMap(keys); log.push({ on: name(t), kind: 'CSSAnimation', props: props.length ? props : [(e as AnimationEvent).animationName] }); }, true);
  });
}
async function motionSeen(page: Page): Promise<Anim[]> {
  return page.evaluate(() => {
    const base: Set<Animation> = (window as any).__a11yAnimations ?? new Set();
    const keys = (a: Animation) => ((a.effect as KeyframeEffect | null)?.getKeyframes() ?? []).flatMap((k) => Object.keys(k)).filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p));
    const running = document.getAnimations().filter((a) => !base.has(a) && a.playState === 'running').map((a) => { const t = (a.effect as KeyframeEffect | null)?.target as Element | null; return { on: t ? (t.id ? `#${t.id}` : t.tagName.toLowerCase()) : 'unknown', kind: a.constructor.name, props: keys(a) }; });
    return [...((window as any).__a11yMotion ?? []), ...running];
  });
}
// Reduced motion, per declared interaction: from a fresh open, the recorder is installed, the interaction runs, and
// what started or runs is sampled at once, at 100 ms and at 500 ms — without the preference for the record, under it
// for the rows. Motion under the preference fails 2.3.3; any animation, SUP02. Animations at load are reported, not
// judged: the rows speak to interaction. A state with no interactions list is not run; an empty list declares that
// no interaction triggers motion.
export async function motionRows(page: Page, state: State, aaa: boolean): Promise<Rows> {
  const both = (r: Rows[string]): Rows => aaa ? { '2.3.3': r, SUP02: r } : { SUP02: r };
  if (state.interactions === undefined) return both({ state: 'not_run', reason: `state ${state.name} declares no interactions list in tests/a11y/project.mjs; an empty list declares that no interaction triggers motion` });
  const seen = { reduce: [] as string[], motion: [] as string[], plain: 0, load: [0, 0] };
  const key = (a: Anim) => `${a.kind} on ${a.on} (${[...new Set(a.props)].join(' ')})`;
  const isMotion = (a: Anim) => a.props.some((p) => MOTION.test(p.replace(/-([a-z])/g, (_, c) => c.toUpperCase())));
  const sample = async (reduce: boolean, act?: { name: string; run: (a: { page: Page }) => Promise<void> }) => {
    await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
    await open(page, state);
    if (act) { await recordMotion(page); await act.run({ page }); }
    const found = new Map<string, Anim>();
    for (const wait of [0, 100, 400]) { if (wait) await page.waitForTimeout(wait); for (const a of await motionSeen(page)) found.set(key(a), a); }
    if (!act) { seen.load[reduce ? 1 : 0] += found.size; return; }
    if (!reduce) { seen.plain += found.size; return; }
    for (const [k, a] of found) { seen.reduce.push(`${act.name}: ${k}`); if (isMotion(a)) seen.motion.push(`${act.name}: ${k}`); }
  };
  for (const reduce of [false, true]) {
    await sample(reduce);
    for (const step of state.interactions) await sample(reduce, step);
  }
  const ok = `${state.interactions.length} interaction(s): ${seen.plain} animation(s) without the preference, none under it; at load ${seen.load[0]} and ${seen.load[1]}, reported, not judged`;
  const rows: Rows = { SUP02: verdict(seen.reduce.map((s) => `under reduced motion, ${s}`), ok) };
  if (aaa) rows['2.3.3'] = verdict(seen.motion.map((s) => `motion under reduced motion, ${s}`), ok);
  return rows;
}

// 1.4.8's measurable parts: no justified block, at most 80 characters a line (40 for CJK), paragraph spacing at least
// 1.5 times the line spacing. The mechanism for colours and width stays with forced colours and reflow.
export async function textBlocks(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const e of document.querySelectorAll('p, li, dd, blockquote, td')) {
      const s = getComputedStyle(e), text = (e.textContent || '').trim();
      if (!text) continue;
      const name = e.id ? `#${e.id}` : e.tagName.toLowerCase();
      if (s.textAlign === 'justify') out.push(`${name} is justified`);
      const range = document.createRange(); range.selectNodeContents(e);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      const cjk = /[぀-ヿ㐀-鿿가-힯]/.test(text);
      // The longest line: its width over the block's mean character width.
      const lines = new Map<number, number>();
      for (const r of rects) lines.set(Math.round(r.top), (lines.get(Math.round(r.top)) ?? 0) + r.width);
      const total = [...lines.values()].reduce((a, b) => a + b, 0);
      const longest = total ? Math.max(...lines.values()) / (total / text.length) : text.length;
      if (longest > (cjk ? 40 : 80)) out.push(`${name} has a line of about ${Math.round(longest)} characters`);
      if (e.tagName === 'P') { const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2; const gap = parseFloat(s.marginBottom); if (e.nextElementSibling?.tagName === 'P' && gap < 1.5 * lh) out.push(`${name} paragraph spacing ${gap} px under 1.5 times ${lh} px`); }
    }
    return out;
  });
}
