/**
 * UI-06 — targets, focus and semantics (the review's B-02, B-19, B-20, B-21,
 * B-26, W-05 and J-08/W-01; the ranges of B-01 are pinned beside Hold at
 * end, the readouts of B-06 beside every range's readout, the focus returns
 * of B-28 and B-29 beside the busyness and network suites).
 *
 * The card headers are native buttons inside their headings, so Enter and
 * Space are the browser's and the 17 headings keep their rank; their focus
 * ring is drawn inside the header's own box, since the card clips what its
 * children draw outside it and a collapsed card is nothing but its header.
 * The splash's "Don't show this again" row and the toast's dismiss are 44 px
 * targets; the playbar's slider has a visible name; the hint popover's text
 * is 14 px; the scope chip's Route is the current scope in Route scope, and
 * the way back to it from every other.
 *
 * The stylesheet is read through the test helper's cascade: a rule's effect
 * on the mounted element, not its text, so a later rule that undid one of
 * these would show.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import {
  FORCED_COLOURS, cascade, colourIn, contrast, resolveValue, splitTopLevel, textPair, tokensFor,
} from './helpers/cssTokens.js';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const shell = () => new DOMParser().parseFromString(indexHtml, 'text/html');

/** A fragment of the shell, mounted for the cascade to read. */
function mount(html, target) {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const element = host.querySelector(target);
  if (!element) throw new Error(`${target} is not in the mounted markup`);
  return element;
}

/** The outer markup of one element of the shell. */
function fragment(selector) {
  const element = shell().querySelector(selector);
  if (!element) throw new Error(`${selector} is not in the shell`);
  return element.outerHTML;
}

/** A property's winning value, tokens resolved. */
function winning(element, properties, options = {}) {
  const hit = cascade(element, properties, options);
  return hit ? resolveValue(hit.value, tokensFor(options.media)) : undefined;
}

/**
 * How far outside its box a box-shadow list paints: an inset shadow paints
 * nothing outside, an outer one its offset, blur and spread.
 */
function reach(boxShadow) {
  if (!boxShadow || boxShadow === 'none') return 0;
  return Math.max(...splitTopLevel(boxShadow).map((shadow) => {
    const words = shadow.trim().split(/\s+/);
    if (words.includes('inset')) return 0;
    const [x = 0, y = 0, blur = 0, spread = 0] = words.filter(word => /^-?[\d.]+(px)?$/.test(word)).map(parseFloat);
    return Math.max(Math.abs(x), Math.abs(y)) + blur + spread;
  }));
}

/** The booted editor, its splash closed, as a user meets it. */
async function editor() {
  const app = await bootApp();
  await app.ready;
  document.getElementById('splash-close').click();
  return app;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('card headers are native buttons inside their headings (UI-06 B-21)', () => {
  test('each of the 17 cards: an h2 holding one button that names the card, expands it and controls its content', () => {
    const page = shell();
    const sections = [...page.querySelectorAll('#settings-sections .settings-section')];
    expect(sections.length).toBe(17);
    for (const section of sections) {
      const name = section.dataset.section;
      const heading = section.firstElementChild;
      expect(heading.matches('h2.section-title'), name).toBe(true);
      expect(heading.children.length, name).toBe(1);
      const header = heading.firstElementChild;
      expect(header.matches('button.section-header[type="button"]'), name).toBe(true);
      expect(header.getAttribute('aria-expanded'), name).toBe('false');
      expect(header.hasAttribute('role'), name).toBe(false);
      expect(header.hasAttribute('tabindex'), name).toBe(false);
      const content = page.getElementById(header.getAttribute('aria-controls'));
      expect(content?.classList.contains('section-content'), name).toBe(true);
      expect(content.parentElement, name).toBe(section);
      // The name is the card's word, read from the heading; the chevron is drawn, not read.
      const chevron = header.querySelector('.section-chevron');
      expect(chevron?.getAttribute('aria-hidden'), name).toBe('true');
      const words = header.textContent.replace(/\s+/g, ' ').trim();
      expect(words, name).toMatch(/^[A-Z][a-z]+( [a-z]+)*$/);
      expect(words, name).toBe(heading.textContent.replace(/\s+/g, ' ').trim());
    }
    // Nothing in the cards plays a button any more: what is a button, is one.
    expect(page.querySelectorAll('#settings-sections [role="button"]').length).toBe(0);
    expect(page.querySelectorAll('.section-header:not(button)').length).toBe(0);
    expect(page.querySelectorAll('.section-header').length).toBe(17);
    // The Leg card's heading is renamed by the selection, through the span the button holds.
    expect(page.getElementById('leg-section-title').closest('button.section-header')).not.toBeNull();
  });

  test('a click opens and closes a card; Enter and Space are the button\'s own, taken by no listener', async () => {
    const app = await editor();
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:selected', app.waypoints[0]);
    const headers = [...document.querySelectorAll('#settings-sections .section-header')];
    expect(headers.length).toBe(17);
    for (const header of headers) {
      const section = header.closest('.settings-section');
      const content = document.getElementById(header.getAttribute('aria-controls'));
      const was = header.getAttribute('aria-expanded') === 'true';
      header.click();
      expect(header.getAttribute('aria-expanded'), section.dataset.section).toBe(String(!was));
      expect(section.classList.contains('expanded'), section.dataset.section).toBe(!was);
      expect(content.parentElement, section.dataset.section).toBe(section);
      header.click();
      expect(header.getAttribute('aria-expanded'), section.dataset.section).toBe(String(was));
    }
    // A key's default is the browser's activation of the button: no listener
    // takes it, so nothing is prevented and, short of that activation, nothing moves.
    const header = document.querySelector('[data-section="marker"] .section-header');
    header.focus();
    for (const key of ['Enter', ' ']) {
      const before = header.getAttribute('aria-expanded');
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      header.dispatchEvent(event);
      expect(event.defaultPrevented, key).toBe(false);
      expect(header.getAttribute('aria-expanded'), key).toBe(before);
    }
    expect(document.activeElement).toBe(header);
  });

  test('focus alone marks a card last used, and a click marks and toggles it (SectionController, as the old header row pinned)', async () => {
    await editor();
    const lastUsed = () => document.querySelector('#settings-sections .settings-section[data-last="true"]')?.dataset.section ?? 'none';
    const pacing = document.querySelector('[data-section="pacing"] .section-header');
    const background = document.querySelector('[data-section="background"] .section-header');
    const open = header => header.getAttribute('aria-expanded') === 'true';
    expect(lastUsed()).not.toBe('pacing');
    // Tab onto a header: nothing opens, but the card is where the user is.
    pacing.focus();
    expect(lastUsed()).toBe('pacing');
    const wasOpen = open(pacing);
    // Activating it (Enter and Space arrive as the button's click) toggles it and keeps it last used.
    pacing.click();
    expect(open(pacing)).toBe(!wasOpen);
    expect(lastUsed()).toBe('pacing');
    pacing.click();
    expect(open(pacing)).toBe(wasOpen);
    // Another header: last used follows the click, and only one card carries it.
    background.focus();
    background.click();
    expect(lastUsed()).toBe('background');
    expect(document.querySelectorAll('#settings-sections [data-last="true"]').length).toBe(1);
    // Tab away: the mark stays with the card last used.
    document.getElementById('scope-route-btn').focus();
    expect(lastUsed()).toBe('background');
  });
});

describe('Done gives focus back to a control that is on screen (UI-06 B-29, Codex round 1)', () => {
  /** A crowd on its own network, in the shell; the Guide card as it starts, collapsed. */
  async function drawing() {
    const app = await editor();
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.5, isMajor: true });
    app.addCrowd();
    app.selectedCrowd.setGuideType('graph');
    app.syncCrowdEditor();
    const guide = document.querySelector('.settings-section[data-section="guide"]');
    const header = guide.querySelector('.section-header');
    const button = document.getElementById('network-edit-btn');
    expect(button.hidden).toBe(false);
    return { app, guide, header, button };
  }
  const done = () => document.querySelector('#network-edit-banner .banner-done');

  test('with the Guide card collapsed, Done focuses the card\'s header, the visible control that reveals the button, and opens nothing', async () => {
    const { app, guide, header, button } = await drawing();
    expect(header.getAttribute('aria-expanded')).toBe('false');
    app.enterNetworkEditMode();
    expect(button.disabled).toBe(true);
    done().focus();
    done().click();
    expect(app.networkEditService.active).toBe(false);
    expect(button.disabled).toBe(false);
    // The button sits in display:none content: a browser cannot focus it.
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(guide.classList.contains('expanded')).toBe(false);
    expect(document.activeElement).toBe(header);
    expect(document.activeElement.closest('.settings-section')).toBe(guide);
  });

  test('with the Guide card expanded, Done focuses the Edit network button itself', async () => {
    const { app, header, button } = await drawing();
    header.click();
    expect(header.getAttribute('aria-expanded')).toBe('true');
    app.enterNetworkEditMode();
    done().focus();
    done().click();
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
  });
});

describe('a card header\'s focus ring is visible, collapsed or expanded (UI-06 B-02)', () => {
  const CARD = fragment('.settings-section[data-section="marker"]');
  const SIDEBAR = `<div id="settings-sections" class="settings-sections">${CARD}</div>`;

  test('the ring is drawn inside the header, so no ancestor\'s clip can take it', () => {
    const header = mount(SIDEBAR, '.section-header');
    const section = header.closest('.settings-section');
    const focused = { states: ['focus-visible'] };
    for (const expanded of [false, true]) {
      section.classList.toggle('expanded', expanded);
      const ring = cascade(header, 'box-shadow', focused)?.value;
      expect(ring, `${expanded ? 'expanded' : 'collapsed'} ring`).toMatch(/var\(--focus-inner\)/);
      expect(ring).toMatch(/var\(--focus-outer\)/);
      // Every ancestor up to the sidebar's scroller: where the ring reaches outside the header, nothing clips.
      for (let node = header.parentElement; node; node = node.parentElement) {
        for (const property of ['overflow', 'overflow-x', 'overflow-y']) {
          const clip = cascade(node, property)?.value;
          if (clip && clip !== 'visible') {
            expect(reach(ring), `${expanded ? 'expanded' : 'collapsed'}: the ring reaches a clipping ${node.className}`)
              .toBe(0);
          }
        }
        if (node.matches('.settings-sections')) break;
      }
      if (expanded) expect(ring).toMatch(/inset 4px 0 0 0 var\(--interactive-01\)/);
    }
    // The card does clip its children to its rounded corners, which is why the ring is inside.
    expect(cascade(section, 'overflow')?.value).toBe('hidden');
    expect(cascade(header, 'outline', focused)?.value).toBe('none');
  });

  test('the sidebar\'s scroller leaves room for the last-used card\'s ring, which its own clip would take', () => {
    const sections = mount(SIDEBAR, '.settings-sections');
    const section = sections.querySelector('.settings-section');
    section.setAttribute('data-last', 'true');
    expect(cascade(sections, 'overflow-x')?.value).toBe('hidden');
    const ring = reach(cascade(section, 'box-shadow')?.value);
    expect(ring).toBeGreaterThan(0);
    const padding = parseFloat(winning(sections, ['padding-inline', 'padding-left', 'padding'])) * 16;
    expect(padding).toBeGreaterThanOrEqual(ring);
  });

  test('in forced colours the outline, the one ring that survives, sits inside the header too', () => {
    const header = mount(SIDEBAR, '.section-header');
    const forced = { states: ['focus-visible'], media: [FORCED_COLOURS] };
    const outline = cascade(header, 'outline', forced);
    expect(outline?.value).toMatch(/solid Highlight/);
    expect(outline.important).toBe(true);
    const offset = cascade(header, 'outline-offset', forced);
    expect(offset?.important).toBe(true);
    const width = parseFloat(resolveValue(outline.value, tokensFor([FORCED_COLOURS]))) * 16;
    expect(parseFloat(offset.value) + width).toBeLessThanOrEqual(0);
  });
});

describe('a readout never overlaps its slider (UI-06 B-06, Codex round 1)', () => {
  test('the row wraps, the label keeps its content width, and the readout right-aligns under the slider', () => {
    // A 288px sidebar at 1,200px leaves ~252px for a row; the label's text
    // column, help slot and 3rem slider need ~208px, and "8 reference px"
    // ~118px more. With the label free to shrink below its content, its
    // children ran under the readout. By rule now: the row wraps, the label
    // is never narrower than its content, and a readout that does not fit
    // beside the slider goes under it, at the right.
    const row = mount(fragment('.settings-section[data-section="marker"]'), '.range-row');
    const label = row.querySelector('label');
    const readout = row.querySelector('.range-readout');
    expect(readout.id).toBe('dot-size-value');
    expect(cascade(row, 'display')?.value).toBe('flex');
    expect(cascade(row, 'flex-wrap')?.value).toBe('wrap');
    expect(cascade(label, 'min-width')?.value).toBe('min-content');
    expect(cascade(label, 'flex')?.value).toBe('1 1 auto');
    expect(cascade(readout, ['margin-inline-start', 'margin-left', 'margin'])?.value).toBe('auto');
    expect(cascade(readout, 'flex')?.value).toBe('0 0 auto');
    // The slider keeps its minimum, which the label's content width includes, and its 44px band.
    const slider = row.querySelector('input[type="range"]');
    expect(cascade(slider, 'min-width')?.value).toBe('3rem');
    expect(winning(slider, 'height')).toBe('2.75rem');
    // The same at the narrow breakpoints: nothing there lets the label shrink again.
    for (const media of ['@media (max-width: 80rem)', '@media (max-width: 64rem)', '@media (max-width: 30rem)']) {
      expect(cascade(label, 'min-width', { media: [media] })?.value, media).toBe('min-content');
      expect(cascade(row, 'flex-wrap', { media: [media] })?.value, media).toBe('wrap');
    }
  });
});

describe('small targets grow to 44 px (UI-06 B-19, B-20)', () => {
  test('the splash\'s "Don\'t show this again" row', () => {
    const label = mount(fragment('#splash'), '.splash-content > .checkbox-label');
    expect(label.querySelector('#splash-dont-show')).not.toBeNull();
    expect(winning(label, 'min-height')).toBe('2.75rem');
  });

  test('a toast\'s dismiss is a 44 × 44 ghost icon button', async () => {
    const app = await editor();
    app.showToast('Saved', 0);
    const dismiss = document.querySelector('#toast-container .toast-dismiss');
    expect(dismiss.getAttribute('aria-label')).toBe('Dismiss');
    expect(winning(dismiss, 'width')).toBe('2.75rem');
    expect(winning(dismiss, 'height')).toBe('2.75rem');
    expect(winning(dismiss, ['background', 'background-color'])).toBe('transparent');
    expect(cascade(dismiss, ['border', 'border-width'])?.value).toBe('none');
  });
});

describe('the playbar\'s slider has a visible name (UI-06 B-26)', () => {
  const TRANSPORT = fragment('.controls');

  test('a "Timeline" label before it, in place of the aria-label, with the readouts still its description', () => {
    const page = shell();
    const slider = page.getElementById('timeline-slider');
    const label = page.querySelector('label[for="timeline-slider"]');
    expect(label.textContent.trim()).toBe('Timeline');
    expect(label.classList.contains('sr-only')).toBe(false);
    expect(label.hidden).toBe(false);
    expect(label.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(label.parentElement).toBe(slider.parentElement);
    expect(slider.hasAttribute('aria-label')).toBe(false);
    expect(slider.hasAttribute('aria-labelledby')).toBe(false);
    expect(slider.getAttribute('aria-describedby')).toBe('current-time total-time');
    // The exported player names its slider the same way.
  });

  test('the booted shell resolves the label as the slider\'s, and it reads at 7:1 on the controls bar', async () => {
    await editor();
    const slider = document.getElementById('timeline-slider');
    expect([...slider.labels].map(label => label.textContent.trim())).toEqual(['Timeline']);
    const label = mount(`<div class="controls">${TRANSPORT}</div>`, '.timeline-label');
    const { fg, bg } = textPair(label);
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(7);
  });
});

describe('the hint popover\'s text is 14 px (UI-06 W-05)', () => {
  test('Carbon\'s tooltip body, from the type token', () => {
    const popover = mount('<div class="param-tooltip" role="tooltip">A hint</div>', '.param-tooltip');
    expect(cascade(popover, 'font-size')?.value).toBe('var(--type-body)');
    expect(winning(popover, 'font-size')).toBe('0.875rem');
  });
});

describe('the scope chip\'s Route is the current scope, or the way back to it (UI-06 J-08, W-01)', () => {
  const route = () => document.getElementById('scope-route-btn');
  const chip = () => document.getElementById('scope-chip');

  test('never disabled: current in Route scope, and from a waypoint, a crowd or a node it returns to Route', async () => {
    const app = await editor();
    expect(route().disabled).toBe(false);
    expect(route().getAttribute('aria-current')).toBe('true');
    expect(chip().dataset.scope).toBe('route');

    // A waypoint: the button is enabled and not current; a click deselects.
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:selected', app.waypoints[1]);
    expect(chip().dataset.scope).toBe('waypoint');
    expect(route().disabled).toBe(false);
    expect(route().hasAttribute('aria-current')).toBe(false);
    route().click();
    expect(chip().dataset.scope).toBe('route');
    expect(route().getAttribute('aria-current')).toBe('true');
    expect(app.selectedWaypoint).toBeNull();

    // A crowd: the same, and the click leaves Crowd scope (the Layers strip's Route row was the only way).
    app.addCrowd();
    const layer = app.selectedCrowd;
    expect(chip().dataset.scope).toBe('crowd');
    expect(document.getElementById('crowd-scope').hidden).toBe(false);
    expect(route().disabled).toBe(false);
    expect(route().hasAttribute('aria-current')).toBe(false);
    const deselected = [];
    app.eventBus.on('crowd:deselected', () => deselected.push(true));
    route().click();
    expect(deselected).toHaveLength(1);
    expect(app.selectedCrowd).toBeNull();
    expect(chip().dataset.scope).toBe('route');
    expect(route().getAttribute('aria-current')).toBe('true');
    expect(document.getElementById('crowd-scope').hidden).toBe(true);
    expect(document.getElementById('route-scope').hidden).toBe(false);

    // A node of the crowd's network, inspected: the click unbinds it and returns to Route.
    app.eventBus.emit('crowd:selected', layer);
    layer.setGuideType('graph');
    const a = layer.graph.addNode({ x: 0.2, y: 0.2 });
    layer.graph.addNode({ x: 0.8, y: 0.2 });
    const service = app.networkEditService;
    service.bindForInspection(layer);
    service.selectNode(a);
    expect(document.getElementById('scope-chip-text').textContent).toMatch(/^Editing · Node/);
    expect(route().disabled).toBe(false);
    expect(route().hasAttribute('aria-current')).toBe(false);
    route().click();
    expect(service.layer).toBeNull();
    expect(app.selectedCrowd).toBeNull();
    expect(chip().dataset.scope).toBe('route');
    expect(route().getAttribute('aria-current')).toBe('true');
    expect(document.getElementById('node-scope').hidden).toBe(true);
  });

  test('the current scope is filled in the chip\'s own pair, at 7:1, hovered or not; a rest button is not', () => {
    const CHIP = fragment('#scope-chip');
    const button = mount(CHIP, '#scope-route-btn');
    expect(button.getAttribute('aria-current')).toBe('true');
    const tokens = tokensFor();
    const fill = ['background', 'background-color'];
    expect(cascade(button, fill)?.value).toBe('var(--scope-route-fg)');
    expect(cascade(button, 'color')?.value).toBe('var(--scope-route-bg)');
    expect(cascade(button, fill, { states: ['hover'] })?.value).toBe('var(--scope-route-fg)');
    expect(contrast(colourIn('var(--scope-route-bg)', tokens), colourIn('var(--scope-route-fg)', tokens)))
      .toBeGreaterThanOrEqual(7);
    // Not current: an outlined button in the chip's text colour, as before.
    button.removeAttribute('aria-current');
    expect(winning(button, fill)).toBe('transparent');
    expect(cascade(button, 'color')?.value).toBe('inherit');
    expect(cascade(button, fill, { states: ['hover'] })?.value).toBe('rgba(0,0,0,0.06)');
    // No rule greys it: nothing is written for a disabled Route any more.
    expect(cascade(button, 'opacity')).toBeUndefined();
    // Forced colours keep the fill through the system's highlight pair.
    button.setAttribute('aria-current', 'true');
    expect(cascade(button, fill, { media: [FORCED_COLOURS] })?.value).toBe('Highlight');
    expect(cascade(button, 'color', { media: [FORCED_COLOURS] })?.value).toBe('HighlightText');
  });
});
