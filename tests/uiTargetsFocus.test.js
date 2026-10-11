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
 * Help's controls (where the splash's "Don't show this again" row was, until
 * UI-06 J-01 took it away) and the toast's dismiss are 44 px targets; the
 * playbar's slider has a visible name; the hint popover's text is 14 px;
 * the scope chip's Route is the current scope in Route scope, and the way
 * back to it from every other.
 *
 * The stylesheet is read through the test helper's cascade: a rule's effect
 * on the mounted element, not its text, so a later rule that undid one of
 * these would show.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { attachSwatchPickers } from '../src/components/SwatchPicker.js';
import { bootApp, tipSeen } from './helpers/bootApp.js';
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
  /**
   * A crowd on its own network, in the shell; the Guide card as it starts,
   * expanded since CROWD-07 X-09 (it started collapsed): a test that wants it
   * collapsed collapses it first.
   */
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
    // Collapsed first: it starts open now (CROWD-07 X-09).
    expect(header.getAttribute('aria-expanded')).toBe('true');
    header.click();
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

  test('when leaving the mode also leaves Crowd scope, focus goes to the Route button: the Guide card is in a hidden group', async () => {
    // The Layers strip's Route row, or the scope chip's Route, sends
    // crowd:deselected with Done focused; SectionController hides #crowd-scope
    // before the network mixin exits the mode, so neither the button nor its
    // header can take focus (Codex round 2). The Route button is always shown
    // and, since this PR, never disabled.
    const { app, guide, header, button } = await drawing();
    header.click(); // collapsed, as it started before CROWD-07 X-09 opened it
    expect(header.getAttribute('aria-expanded')).toBe('false');
    app.enterNetworkEditMode();
    done().focus();
    app.eventBus.emit('crowd:deselected');
    expect(app.networkEditService.active).toBe(false);
    expect(document.getElementById('network-edit-banner')).toBeNull();
    expect(document.getElementById('crowd-scope').hidden).toBe(true);
    expect(guide.contains(button)).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('scope-route-btn'));
    expect(document.activeElement.closest('[hidden]')).toBeNull();
    expect(document.activeElement.disabled).toBe(false);
    // The same with the Guide card expanded: the header would have been the target.
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayers()[0]);
    header.click();
    expect(header.getAttribute('aria-expanded')).toBe('true');
    app.enterNetworkEditMode();
    done().focus();
    app.eventBus.emit('crowd:deselected');
    expect(document.activeElement).toBe(document.getElementById('scope-route-btn'));
  });

  test('with the Guide card expanded, Done focuses the Edit network button itself', async () => {
    const { app, header, button } = await drawing();
    // Expanded as it starts (CROWD-07 X-09): no click needed to open it.
    expect(header.getAttribute('aria-expanded')).toBe('true');
    app.enterNetworkEditMode();
    done().focus();
    done().click();
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  // UI-06 B-34: entering the mode disables the Edit network button that had
  // focus, and nothing took it: focus fell to the page. It goes to the
  // banner's Done [Q2, the owner's call], which gives it back as above.
  test('entered from the Edit network button, focus goes to the banner\'s Done, and Done gives it back (UI-06 B-34)', async () => {
    const { app, header, button } = await drawing();
    // Expanded as it starts (CROWD-07 X-09), so the button can be focused.
    expect(header.getAttribute('aria-expanded')).toBe('true');
    button.focus();
    button.click();
    expect(app.networkEditService.active).toBe(true);
    expect(button.disabled).toBe(true);
    expect(document.activeElement).toBe(done());
    done().click();
    expect(app.networkEditService.active).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  test('entered with focus nowhere, it goes to Done; Custom network chosen for an empty network keeps the select (UI-06 B-34)', async () => {
    const { app } = await drawing();
    document.activeElement?.blur();
    expect(document.activeElement).toBe(document.body);
    app.enterNetworkEditMode();
    expect(document.activeElement).toBe(done());
    done().click();
    // A second crowd, on the route: choosing Custom network for it is a
    // setting, and the select the user is on keeps focus. (Reason for the
    // changed expectation, CROWD-07 X-02: the select no longer hands over the
    // pen, so the mode stays off; Edit network is the request.)
    app.addCrowd();
    const select = document.getElementById('crowd-guide-type');
    expect(select.value).toBe('route');
    select.focus();
    select.value = 'graph';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.networkEditService.active).toBe(false);
    expect(document.getElementById('network-edit-banner')).toBeNull();
    expect(document.activeElement).toBe(select);
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
      // The accent now follows the ring and starts past it (reason: UI-06 low item c, see below).
      if (expanded) expect(ring).toMatch(/inset 9px 0 0 0 var\(--interactive-01\)/);
    }
    // The card does clip its children to its rounded corners, which is why the ring is inside.
    expect(cascade(section, 'overflow')?.value).toBe('hidden');
    expect(cascade(header, 'outline', focused)?.value).toBe('none');
  });

  // UI-06 low item c: expanded, the header's 4 px accent was listed first, so
  // painted on top, and covered 4 of the ring's 5 px on its left. The ring's
  // two layers come first now, and the accent, under them, reaches 9 px in:
  // 4 px of it show past the ring's 5.
  test('expanded and focused, the ring is painted over the accent, and the accent shows past it', () => {
    const header = mount(SIDEBAR, '.section-header');
    header.closest('.settings-section').classList.add('expanded');
    const layers = splitTopLevel(cascade(header, 'box-shadow', { states: ['focus-visible'] })?.value ?? '');
    expect(layers).toHaveLength(3);
    expect(layers.slice(0, 2)).toEqual(['inset 0 0 0 2px var(--focus-inner)', 'inset 0 0 0 5px var(--focus-outer)']);
    const accent = /^inset (\d+(?:\.\d+)?)px 0 0 0 var\(--interactive-01\)$/.exec(layers[2]);
    expect(accent, layers[2]).not.toBeNull();
    const ringWidth = Math.max(...layers.slice(0, 2).map(layer => parseFloat(layer.split(/\s+/)[4])));
    expect(Number(accent[1])).toBeGreaterThan(ringWidth);
    expect(Number(accent[1]) - ringWidth).toBe(4);
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
    // Its min-content contribution to the label must be that 3rem, not its
    // intrinsic 129px: a range's `min-width` alone does not lower what it
    // contributes (the lead's pane at 1,200px: label 37px past the row,
    // every slider 129px, every readout wrapped), an explicit `width` does.
    // Then the label's content width on the Size row is 96 (text column) +
    // 44 (help slot) + 4 (gap) + 8 + 48 + 8 (slider and its margins) = 208px,
    // and in the 252px row a readout up to the 40px it is always given sits
    // inline ("2s", "None", "100%") while "8 reference px" wraps under.
    const slider = row.querySelector('input[type="range"]');
    expect(cascade(slider, 'width')?.value).toBe('3rem');
    expect(cascade(slider, 'min-width')?.value).toBe('3rem');
    expect(cascade(slider, 'flex')?.value).toBe('1');
    expect(winning(slider, 'height')).toBe('2.75rem');
    // The timeline is outside the cards: its own rule, no width of its own.
    const timeline = mount(fragment('.controls'), '.timeline-slider');
    expect(cascade(timeline, 'width')).toBeUndefined();
    expect(cascade(timeline, 'flex')?.value).toBe('1');
    // The same at the narrow breakpoints: nothing there lets the label shrink again.
    for (const media of ['@media (max-width: 80rem)', '@media (max-width: 64rem)', '@media (max-width: 30rem)']) {
      expect(cascade(label, 'min-width', { media: [media] })?.value, media).toBe('min-content');
      expect(cascade(row, 'flex-wrap', { media: [media] })?.value, media).toBe('wrap');
    }
  });
});

/**
 * CROWD-07's layout (the owner's audit, 2026-10-10, and [Q6]). At 1,200 and
 * 1,280 px the sidebar is 288 px (the 80rem breakpoint), so each rule is held
 * there and at the default. jsdom lays nothing out: these pin the rules that
 * win; the lead's pane pairs show truncation, overlap and the native arrows.
 */
describe('the crowd cards\' layout (CROWD-07 layout, DEF-86, X-06, [Q6])', () => {
  const WIDTHS = [[], ['@media (max-width: 80rem)'], ['@media (max-width: 64rem)'], ['@media (max-width: 30rem)']];

  test('a card\'s helper lines are set at 1.5, as WCAG 1.4.8 asks of a block (was 1.2)', () => {
    const scope = mount(fragment('#crowd-scope'), '#crowd-guide-hint');
    const lines = [scope, document.getElementById('crowd-count-reason'), document.getElementById('crowd-count-field-error'),
      document.getElementById('crowd-seed-error')];
    const outline = mount('<div class="control-group"><p class="scene-outline-hint">Help</p><p class="scene-outline-empty">None</p></div>',
      '.scene-outline-hint');
    const weightError = mount('<div class="section-content"><div class="network-path-weight-row"><span class="network-path-weight-error">No</span></div></div>',
      '.network-path-weight-error');
    for (const media of WIDTHS) {
      for (const line of [...lines, outline, outline.nextElementSibling, weightError]) {
        expect(winning(line, 'line-height', { media }), `${line.id || line.className} ${media}`).toBe('1.5');
      }
    }
  });

  test('the Guide and At journey end selects take the whole row on a line under their label', () => {
    for (const id of ['crowd-guide-type', 'crowd-lifecycle']) {
      const select = mount(fragment('#crowd-scope'), `#${id}`);
      const label = select.closest('label');
      expect(label.getAttribute('for')).toBe(id);
      for (const media of WIDTHS) {
        expect(cascade(label, 'flex-wrap', { media })?.value, `${id} ${media}`).toBe('wrap');
        expect(cascade(select, 'flex', { media })?.value, `${id} ${media}`).toBe('1 0 100%');
        expect(cascade(select, 'width', { media })?.value, `${id} ${media}`).toBe('100%');
        // Still a 44 px target.
        expect(winning(select, 'min-height', { media }), `${id} ${media}`).toBe('2.75rem');
      }
      document.body.innerHTML = '';
    }
    // Only these two: the Node card's Type keeps its place beside its label.
    const type = mount(fragment('#node-scope'), '#network-node-type');
    expect(cascade(type, 'flex')?.value).toBe('1');
    expect(cascade(type.closest('label'), 'flex-wrap')).toBeUndefined();
  });

  test('a number field wraps under its slider at the right, as a long readout does; the slider keeps its 3rem and 44 px band', () => {
    // At a 288px sidebar the row has ~252px; the label's content is 208px
    // (see the B-06 test above), and a field is 6rem (96px) with its unit
    // after it, so it goes under the slider, at the right.
    for (const id of ['crowd-count', 'crowd-dot-size', 'crowd-speed', 'crowd-intensity-ramp']) {
      const slider = mount(fragment('#crowd-scope'), `#${id}`);
      const row = slider.closest('.range-row');
      const field = document.getElementById(`${id}-field`);
      const holder = field.closest('.range-field');
      expect(holder.parentElement).toBe(row);
      for (const media of WIDTHS) {
        expect(cascade(row, 'flex-wrap', { media })?.value, `${id} ${media}`).toBe('wrap');
        expect(cascade(holder, 'flex', { media })?.value, `${id} ${media}`).toBe('0 0 auto');
        expect(cascade(holder, ['margin-inline-start', 'margin-left', 'margin'], { media })?.value, `${id} ${media}`)
          .toBe('auto');
        expect(cascade(field, 'width', { media })?.value, `${id} ${media}`).toBe('6rem');
        expect(winning(field, 'min-height', { media }), `${id} ${media}`).toBe('2.75rem');
        expect(cascade(slider, 'width', { media })?.value).toBe('3rem');
        expect(cascade(slider, 'min-width', { media })?.value).toBe('3rem');
        expect(winning(slider, 'height', { media })).toBe('2.75rem');
        // The reason and the error each take a line of the row's own.
        for (const line of [`${id}-reason`, `${id}-field-error`]) {
          expect(cascade(document.getElementById(line), 'flex', { media })?.value, line).toBe('1 0 100%');
        }
      }
      document.body.innerHTML = '';
    }
  });

  test('Share takes the Path card\'s whole width on a line under its label (X-06); only Share', () => {
    const slider = mount(fragment('#edge-scope'), '#network-edge-weight');
    const label = slider.closest('label');
    expect(label.closest('.range-row').classList.contains('range-row-wide')).toBe(true);
    for (const media of WIDTHS) {
      expect(cascade(label, 'flex-wrap', { media })?.value, media).toBe('wrap');
      expect(cascade(slider, 'flex', { media })?.value, media).toBe('1 0 100%');
      expect(cascade(slider, ['margin-inline', 'margin-left', 'margin'], { media })?.value, media).toBe('0');
      expect(winning(slider, 'height', { media }), media).toBe('2.75rem');
    }
    document.body.innerHTML = '';
    // The crowd sliders keep their place beside their labels.
    const count = mount(fragment('#crowd-scope'), '#crowd-count');
    expect(cascade(count, 'flex')?.value).toBe('1');
  });
});

describe('small targets grow to 44 px (UI-06 B-19, B-20)', () => {
  // The splash's "Don't show this again" row was the third; the welcome is now
  // for the first start only and the row is gone (UI-06 J-01), so Help's own
  // controls take its place here.
  test('Help\'s controls: its close a 44 × 44 button, Report a bug and Show the welcome again 44 px tall', () => {
    expect(shell().getElementById('splash-dont-show')).toBeNull();
    // Mounted once: a second copy's ids would repeat, and the selector engine finds the first copy's.
    const dialog = mount(fragment('#help-modal'), '#help-modal');
    const close = dialog.querySelector('#help-close-x');
    expect(winning(close, 'width')).toBe('2.75rem');
    expect(winning(close, 'height')).toBe('2.75rem');
    for (const id of ['#help-report-bug', '#help-show-welcome']) {
      expect(winning(dialog.querySelector(id), 'min-height'), id).toBe('2.75rem');
    }
  });

  // UI-06 J-01 round 4 (Codex's check of the brief): the source link stands on
  // a line of its own, about 21 px tall; a link inside a sentence keeps the
  // inline exception (WCAG 2.5.5).
  test("Help's GitHub link, on a line of its own, is a 44 px target, its text no larger; the notices link in its sentence stays inline", () => {
    const dialog = mount(fragment('#help-modal'), '#help-modal');
    const source = dialog.querySelector('#help-source');
    expect(source.parentElement.children).toHaveLength(1);
    expect(winning(source, 'display')).toBe('inline-flex');
    expect(winning(source, 'align-items')).toBe('center');
    expect(winning(source, 'min-height')).toBe('2.75rem');
    expect(cascade(source, ['font-size', 'font'])).toBeUndefined();
    const notices = dialog.querySelector('a[href="THIRD_PARTY_NOTICES.txt"]');
    expect(cascade(notices, 'min-height')).toBeUndefined();
    expect(cascade(notices, 'display')).toBeUndefined();
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

describe('a swatch picker\'s options are 44 px targets (UI-06 B-32)', () => {
  // The fieldset had two tracks, 6rem and the rest, for a legend beside the
  // grid; but a rendered <legend> takes no grid cell, so the grid landed in
  // the 6rem track: (96 − 4 × 4) / 5 = 16 px per option. Now one track, the
  // legend over the grid and the grid the picker's full width [Q1, the
  // owner's call: 44 px chips spanning both of the old columns].
  /** A picker with the custom colour row, built as the app builds it, in a card in the sidebar's scroller. */
  function picker() {
    const sections = mount(`<div id="settings-sections" class="settings-sections"><div class="settings-section expanded">
      <div class="section-content"><input type="hidden" id="b32-colour" value="#0072B2">
      <div class="swatch-picker" data-target-input="#b32-colour" data-mode="okabe-ito" data-label="Colour"
        data-allow-custom="true"></div></div></div></div>`, '.settings-sections');
    attachSwatchPickers(sections);
    return { sections, fieldset: sections.querySelector('.swatch-fieldset') };
  }
  const px = (value) => {
    const match = /^([\d.]+)(rem|px)$/.exec(String(value).trim());
    if (!match) throw new Error(`not a length: ${value}`);
    return parseFloat(match[1]) * (match[2] === 'rem' ? 16 : 1);
  };

  test('one track: the legend over the grid, and the grid, its actions, the custom colour and Mixed all in it', () => {
    const { fieldset } = picker();
    expect(cascade(fieldset, 'grid-template-columns')?.value).toBe('minmax(0, 1fr)');
    for (const selector of ['.swatch-grid', '.swatch-actions', '.swatch-disclosure', '.swatch-mixed-state']) {
      const child = fieldset.querySelector(selector);
      expect(child?.parentElement, selector).toBe(fieldset);
      expect(cascade(child, ['grid-column', 'grid-column-start']), selector).toBeUndefined();
    }
    expect(fieldset.firstElementChild.matches('legend.swatch-legend')).toBe(true);
  });

  test('every option is at least 2.75rem tall, and a neutral grid\'s columns no narrower', () => {
    const { fieldset } = picker();
    const option = fieldset.querySelector('.swatch-option');
    expect(px(winning(option, 'min-height'))).toBeGreaterThanOrEqual(44);
    const neutral = mount('<div class="swatch-grid swatch-grid-neutral"></div>', '.swatch-grid-neutral');
    const columns = winning(neutral, 'grid-template-columns');
    const floor = /minmax\(([\d.]+(?:rem|px)),/.exec(columns)?.[1];
    expect(px(floor), columns).toBeGreaterThanOrEqual(44);
  });

  test('in the narrowest left sidebar above 80rem (20rem) and at or below it (18rem), each of five columns is 44 px or wider', () => {
    // The sidebar's track less the scroller's inline padding and the card
    // content's, both sides: 53.6 px and 47.2 px per option before a
    // scrollbar takes its share (the lead checks those in Chromium).
    const { sections, fieldset } = picker();
    const content = sections.querySelector('.section-content');
    const grid = fieldset.querySelector('.swatch-grid');
    const main = mount('<main class="main"></main>', '.main');
    const wide = winning(main, 'grid-template-columns');
    const medium = winning(main, 'grid-template-columns', { media: ['@media (max-width: 80rem)'] });
    const tracks = {
      'above 80rem': /^clamp\(([\d.]+rem),/.exec(wide)?.[1],
      'at 80rem and below': /^minmax\([\d.]+rem,\s*([\d.]+rem)\)/.exec(medium)?.[1],
    };
    expect(tracks).toEqual({ 'above 80rem': '20rem', 'at 80rem and below': '18rem' });
    const scroller = px(winning(sections, ['padding-inline', 'padding']));
    const card = px(winning(content, ['padding', 'padding-inline']));
    // The grid sits in the fieldset's first track: all of it when there is one.
    const fieldsetTracks = splitTopLevel(winning(fieldset, 'grid-template-columns'), ' ');
    const columns = Number(/^repeat\((\d+),\s*1fr\)$/.exec(winning(grid, 'grid-template-columns'))?.[1]);
    const gap = px(winning(grid, ['column-gap', 'gap']));
    expect(columns).toBe(5);
    for (const [where, track] of Object.entries(tracks)) {
      const inner = px(track) - 2 * scroller - 2 * card;
      const first = fieldsetTracks.length === 1 ? inner : px(fieldsetTracks[0]);
      const option = (first - gap * (columns - 1)) / columns;
      expect(option, where).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('a toast that goes while it holds focus gives it back (UI-06 B-35)', () => {
  // Dismiss took the focus away with its toast: focus fell to the page. It
  // goes back to the control focused before, outside the toasts [Q2, the
  // owner's call], if a browser would let it land there (PR 7's checks);
  // else to the next toast still showing; else to the toasts' container.
  const toasts = () => [...document.querySelectorAll('#toast-container .toast')];
  const dismissOf = toast => toast.querySelector('.toast-dismiss');
  const container = () => document.getElementById('toast-container');

  /** The editor, its start tip seen: the tip's real-clock timer would add a toast mid-test. */
  async function quietEditor() {
    localStorage.getItem.mockImplementation(tipSeen());
    return editor();
  }

  /** The dropdown stylesheet, which hides a closed menu, applied to the page for jsdom to compute. */
  function applyDropdownStyles() {
    const style = document.createElement('style');
    style.textContent = readFileSync(resolve(process.cwd(), 'styles/dropdown.css'), 'utf8');
    document.body.append(style);
  }

  test('Dismiss, or the toast\'s action, gives focus back to the control that had it', async () => {
    const app = await quietEditor();
    const route = document.getElementById('scope-route-btn');
    route.focus();
    app.showToast('Saved', 0);
    dismissOf(toasts()[0]).focus();
    dismissOf(toasts()[0]).click();
    expect(document.activeElement).toBe(route);
    let acted = 0;
    app.showToast('Deleted Crowd 1', 0, { label: 'Undo', onClick: () => { acted += 1; } });
    const action = toasts().at(-1).querySelector('.toast-action');
    action.focus();
    action.click();
    expect(acted).toBe(1);
    expect(document.activeElement).toBe(route);
  });

  test('a control removed, in a closed menu or in a disabled fieldset cannot take it: the next toast does, then the container', async () => {
    const app = await quietEditor();
    applyDropdownStyles();
    const wouldTake = [
      ['removed', () => {
        const extra = document.createElement('button');
        document.body.append(extra);
        extra.focus();
        return () => extra.remove();
      }],
      ['in a closed menu', () => {
        const save = document.getElementById('save-project-btn');
        document.getElementById('file-dropdown-btn').click();
        expect(save.closest('.dropdown-menu').classList.contains('is-open')).toBe(true);
        save.focus();
        return () => document.body.click();
      }],
      ['in a disabled fieldset', () => {
        const fieldset = document.createElement('fieldset');
        fieldset.innerHTML = '<button type="button">Inside</button>';
        document.body.append(fieldset);
        fieldset.querySelector('button').focus();
        return () => { fieldset.disabled = true; };
      }],
    ];
    for (const [why, focusThen] of wouldTake) {
      const takeAway = focusThen();
      app.showToast(`First, ${why}`, 0);
      app.showToast(`Second, ${why}`, 0);
      const [first, second] = toasts().slice(-2);
      takeAway();
      dismissOf(first).focus();
      dismissOf(first).click();
      expect(document.activeElement, why).toBe(dismissOf(second));
      dismissOf(second).click();
      expect(document.activeElement, why).toBe(container());
      expect(container().getAttribute('tabindex'), why).toBe('-1');
      for (const toast of toasts()) toast.remove();
    }
  });

  test('with no toast after it, an earlier one takes focus; one already leaving never does', async () => {
    const app = await quietEditor();
    const extra = document.createElement('button');
    document.body.append(extra);
    extra.focus();
    app.showToast('Older', 0);
    app.showToast('Newer', 0);
    const [older, newer] = toasts();
    extra.remove();
    dismissOf(newer).focus();
    dismissOf(newer).click();
    expect(document.activeElement).toBe(dismissOf(older));
    // Two at once: the first is on its way out when the second goes, so the container takes focus.
    app.showToast('Third', 0);
    const third = toasts().at(-1);
    dismissOf(older).click();
    dismissOf(third).focus();
    dismissOf(third).click();
    expect(document.activeElement).toBe(container());
  });

  test('a toast\'s timer moves focus only when focus is in it', async () => {
    const app = await quietEditor();
    const route = document.getElementById('scope-route-btn');
    const chip = document.getElementById('scope-chip');
    route.focus();
    app.showToast('Here', 30);
    dismissOf(toasts()[0]).focus();
    await new Promise(done => setTimeout(done, 80));
    expect(document.activeElement).toBe(route);
    // Focus elsewhere when the timer runs: it stays there.
    chip.setAttribute('tabindex', '-1');
    chip.focus();
    app.showToast('Elsewhere', 30);
    await new Promise(done => setTimeout(done, 80));
    expect(document.activeElement).toBe(chip);
  });

  test('no focus is tracked once the app is destroyed', async () => {
    const app = await quietEditor();
    const route = document.getElementById('scope-route-btn');
    route.focus();
    expect(app._focusBeforeToast).toBe(route);
    app.destroy();
    document.getElementById('scope-chip').setAttribute('tabindex', '-1');
    document.getElementById('scope-chip').focus();
    expect(app._focusBeforeToast).toBeNull();
  });
});
