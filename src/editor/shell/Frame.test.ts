// CORE-05, stage 5: what the frame draws (react-dom/server, no page; brief 69's ruling 8). The header is the one banner,
// holding the page's one `h1`, "Route Plotter", and Help. No slot filled, no region and no side column; each slot
// filled alone draws exactly its region, named by its heading; all filled, the regions stand in the reading order:
// outline, points list, preview, play bar, settings, export. What a person meets on the page (the order Tab takes, the
// landmarks, the layout at 320 px) is proved by the accessibility run (tests/a11y/project.mjs).
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Frame, PAGE_NAME, SLOTS, type FrameProps } from './Frame';

type Filling = Partial<Omit<FrameProps, 'help'>>;
const mark = (what: string): ReactNode => createElement('i', { 'data-slot': what });
const draw = (filling: Filling = {}) => renderToStaticMarkup(createElement(Frame, { help: createElement('button', { id: 'help' }, 'Help'), ...filling }));
const regions = (html: string) => [...html.matchAll(/<section[^>]*aria-labelledby="([^"]+)-heading"[^>]*><h2 id="\1-heading"[^>]*>([^<]*)<\/h2>/g)].map((m) => ({ id: m[1], name: m[2] }));
const slotsInOrder = (html: string) => [...html.matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1]);
const NAMED: readonly (keyof typeof SLOTS)[] = ['outline', 'pointsList', 'preview', 'panels', 'exportPanel'];

describe('the frame, as it draws', () => {
  it('Open, filled alone, stands in the header before Help; the notice, filled alone, first in main in a plain div', () => {
    const withOpen = draw({ open: mark('open') });
    const banner = /<header[^>]*>(.*)<\/header>/.exec(withOpen)?.[1] ?? '';
    expect(banner).toMatch(/<div class="frame__actions"><i data-slot="open"><\/i><button id="help">Help<\/button><\/div>$/);
    expect(withOpen).not.toContain('frame__notice');
    const withNotice = draw({ notice: mark('notice') });
    expect(withNotice).toMatch(/<main[^>]*><div class="frame__notice"><i data-slot="notice"><\/i><\/div><div class="frame__column frame__column--centre">/);
    expect(withNotice).toMatch(/<div class="frame__actions"><button id="help">Help<\/button><\/div>/);
    expect(withNotice).not.toMatch(/<section|<h2|role=/);
  });

  it('unfilled, Open and the notice draw nothing at all', () => {
    for (const html of [draw(), draw({ open: null, notice: undefined }), draw({ open: false, notice: null })]) {
      expect(html).not.toContain('frame__notice');
      expect(html).toMatch(/<div class="frame__actions"><button id="help">Help<\/button><\/div>/);
    }
  });

  it('draws one banner holding the page’s one h1, not a link, and Help', () => {
    const html = draw();
    const banner = /<header[^>]*>(.*)<\/header>/.exec(html)?.[1] ?? '';
    expect(html.match(/<header/g)).toHaveLength(1);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(banner).toMatch(new RegExp(`^<h1 id="page-name"[^>]*>${PAGE_NAME}</h1>`));
    expect(banner).toContain('<button id="help">Help</button>');
    expect(banner).not.toContain('<a');
    expect(html).toMatch(/<header[^>]*aria-labelledby="page-name"/);
    expect(html.match(/<main/g)).toHaveLength(1);
  });

  it('with no slot filled draws no region, no heading but the h1, and no side column', () => {
    for (const html of [draw(), draw({ outline: null, pointsList: undefined, preview: false, panels: null, exportPanel: undefined })]) {
      expect(html).not.toMatch(/<section|<aside|<h2|frame__column--left|frame__column--right|frame--left|frame--right/);
      expect(html).toContain('frame__column--centre');
    }
  });

  it('with each slot filled alone draws exactly its region, named by its heading', () => {
    for (const slot of NAMED) {
      const html = draw({ [slot]: mark(slot) });
      expect(regions(html)).toEqual([{ id: SLOTS[slot].id, name: SLOTS[slot].name }]);
      expect(html.match(/<section/g)).toHaveLength(1);
      expect(slotsInOrder(html)).toEqual([slot]);
    }
    expect(regions(draw({ transport: mark('transport') }))).toEqual([]);
    expect(slotsInOrder(draw({ transport: mark('transport') }))).toEqual(['transport']);
  });

  it('with every slot filled stands them in the reading order, the side columns only then', () => {
    const html = draw({
      exportPanel: mark('exportPanel'),
      panels: mark('panels'),
      transport: mark('transport'),
      preview: mark('preview'),
      pointsList: mark('pointsList'),
      outline: mark('outline'),
      children: mark('after'),
      notice: mark('notice'),
      open: mark('open'),
    });
    expect(slotsInOrder(html)).toEqual(['open', 'notice', 'outline', 'pointsList', 'preview', 'transport', 'panels', 'exportPanel', 'after']);
    const order = ['<header', '<h1', 'data-slot="open"', 'id="help"', '</header>', '<main', 'data-slot="notice"', 'frame__column--left'].map((at) => html.indexOf(at));
    expect(order.every((at, i) => at >= 0 && (i === 0 || at > (order[i - 1] ?? -1)))).toBe(true);
    expect(html).toMatch(/<main[^>]*><div class="frame__notice">/);
    expect(regions(html).map(({ name }) => name)).toEqual(['Outline', 'Points', 'Preview', 'Settings', 'Export']);
    expect(html).toMatch(/class="[^"]*frame--left frame--right/);
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
});
