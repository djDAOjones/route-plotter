/**
 * A11Y-01 — parameter hints describe their control instead of pretending to
 * be buttons.
 *
 * The shell is mounted from the real `index.html` rather than a fixture: the
 * defect this guards was a property of the actual sidebar markup (74 hint
 * labels), and a fixture would have let it pass. What a jsdom run can settle
 * here is semantics — roles, tab stops, `aria-describedby` wiring and the
 * focus/Escape contract. It cannot settle how NVDA or VoiceOver read the
 * result; that stays owner-run evidence on REV-05.
 *
 * jsdom does model the pointer-versus-keyboard heuristic behind
 * `:focus-visible`, so both halves of the focus contract are testable here —
 * but only because the arrangement is honest about which one it is staging.
 * A stray synthetic click leaves the document in "last interaction was
 * pointer" state and silently suppresses the keyboard path, so the tests
 * below arrange focus explicitly rather than inheriting it from a hook.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { initParamTooltips } from '../src/components/ParamTooltip.js';
import { attachSwatchPickers } from '../src/components/SwatchPicker.js';
import { SceneOutlineController } from '../src/controllers/SceneOutlineController.js';
import { EventBus } from '../src/core/EventBus.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { buildSceneOutlineSnapshot } from '../src/utils/sceneSemantics.js';
import { dotOnsetFraction } from '../src/utils/crowdArrival.js';
import { formatCrowdReleaseBias } from '../src/app/crowds.js';
import { INTERACTION } from '../src/config/constants.js';
import { bootApp } from './helpers/bootApp.js';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function mountShell() {
  document.documentElement.innerHTML = indexHtml
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<\/?html[^>]*>/gi, '');
}

/** The control a hint describes: its enclosing label's `for` target. */
function controlFor(trigger) {
  const label = trigger.tagName === 'LABEL' ? trigger : trigger.closest('label');
  return document.getElementById(label.getAttribute('for'));
}

/** The text `aria-describedby` actually resolves to, in announcement order. */
function describedText(control) {
  return (control.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent?.trim() ?? null);
}

function triggers() {
  return [...document.querySelectorAll('[data-tip]')];
}

/**
 * A real pointer click is cancelable. A synthetic one that is not lets jsdom
 * run the label's default activation, which forwards a second click to the
 * control and dismisses the very tooltip under test.
 */
function clickEvent() {
  return new window.MouseEvent('click', { bubbles: true, cancelable: true });
}

describe('parameter hints as control descriptions', () => {
  beforeEach(() => {
    mountShell();
    initParamTooltips();
  });

  test('the shell really does carry the hints this guards', () => {
    // A selector that quietly matched nothing would pass every other test here.
    expect(triggers().length).toBeGreaterThan(50);
  });

  test('no hint trigger claims a role or a tab stop', () => {
    const offenders = triggers()
      .filter(el => el.hasAttribute('role') || el.hasAttribute('tabindex'))
      .map(el => `${el.tagName}[${el.getAttribute('role')}/${el.getAttribute('tabindex')}]`);

    expect(offenders).toEqual([]);
  });

  test('every hint is exposed as its control’s description', () => {
    const unwired = triggers()
      .filter(el => !describedText(controlFor(el)).includes(el.getAttribute('data-tip').trim()))
      .map(el => el.getAttribute('data-tip').slice(0, 40));

    expect(unwired).toEqual([]);
  });

  test('an existing readout keeps its token, and keeps announcing first', () => {
    // Slider readouts own the first token by UI-STANDARDS; the hint appends.
    const slider = document.getElementById('dot-size');
    const tokens = (slider.getAttribute('aria-describedby') || '').split(/\s+/);

    expect(tokens[0]).toBe('dot-size-value');
    expect(tokens).toContain('dot-size-tip');
    expect(describedText(slider)).toEqual([
      '8 reference px',
      slider.closest('label').querySelector('[data-tip]').getAttribute('data-tip'),
    ]);
  });

  test('description nodes sit outside the label, leaving the name intact', () => {
    const leaked = triggers()
      .map(el => (el.tagName === 'LABEL' ? el : el.closest('label')))
      .filter(label => label.querySelector('.sr-only[id$="-tip"]'))
      .map(label => label.getAttribute('for'));

    expect(leaked).toEqual([]);

    // The visible label text must still be the whole accessible name.
    const iconLabel = document.querySelector('label[for="marker-style"]');
    expect(iconLabel.textContent).not.toContain('Shape of the waypoint marker');
  });

  test('generated description ids stay unique across the document', () => {
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test('re-initialising does not duplicate a description token', () => {
    initParamTooltips();
    initParamTooltips();

    const slider = document.getElementById('dot-size');
    const tokens = (slider.getAttribute('aria-describedby') || '').split(/\s+/);

    expect(tokens).toEqual(['dot-size-value', 'dot-size-tip']);
    expect(document.querySelectorAll('#dot-size-tip').length).toBe(1);
  });
});

describe('the visible tooltip stays reachable without a tab stop', () => {
  let trigger;
  let control;

  beforeEach(() => {
    mountShell();
    initParamTooltips();
    control = document.getElementById('dot-size');
    trigger = control.closest('label').querySelector('[data-tip]');
  });

  /** The shared element is created lazily on first show. */
  const tooltip = () => document.getElementById('param-tooltip');

  /** Arrive the way a keyboard user does, so `:focus-visible` is genuine. */
  function tabTo(el) {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    el.focus();
  }

  test('clicking the hint shows it, and clicking again closes it', () => {
    trigger.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('block');
    expect(tooltip().textContent).toBe(trigger.getAttribute('data-tip'));

    trigger.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('none');
  });

  test('it never competes with the description it duplicates', () => {
    trigger.dispatchEvent(clickEvent());

    // Announcing both the tooltip and the description would say it twice.
    expect(tooltip().getAttribute('aria-hidden')).toBe('true');
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });

  test('clicking the control it describes dismisses the hint', () => {
    trigger.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('block');

    control.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('none');
  });

  test('keyboard focus on the control reveals the same hint', () => {
    tabTo(control);

    expect(tooltip().style.display).toBe('block');
    expect(tooltip().textContent).toBe(trigger.getAttribute('data-tip'));
  });

  test('a mouse click on the control does not reveal it', () => {
    // The whole point of gating on :focus-visible: a mouse user who never
    // asked for the hint does not get one thrown over the sidebar.
    control.dispatchEvent(clickEvent());
    control.focus();

    expect(tooltip()?.style.display ?? 'none').toBe('none');
  });

  test('leaving the control hides it again', () => {
    tabTo(control);
    expect(tooltip().style.display).toBe('block');

    control.blur();
    expect(tooltip().style.display).toBe('none');
  });

  test('Escape dismisses it for as long as focus stays put', () => {
    tabTo(control);
    expect(tooltip().style.display).toBe('block');

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tooltip().style.display).toBe('none');

    // Still focused: a dismissed hint must not reappear on its own.
    control.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
    expect(tooltip().style.display).toBe('none');

    // Leaving and coming back is a new visit, so the hint returns.
    control.blur();
    tabTo(control);
    expect(tooltip().style.display).toBe('block');
  });
});

describe('hints that cannot be resolved are skipped, not half-wired', () => {
  beforeEach(mountShell);

  test('a label pointing at nothing leaves no marker and breaks no sibling', () => {
    const orphan = document.createElement('label');
    orphan.setAttribute('for', 'no-such-control');
    orphan.innerHTML = '<span data-tip="Describes a control that is not here">Orphan</span>';
    document.body.appendChild(orphan);

    expect(() => initParamTooltips()).not.toThrow();

    expect(orphan.querySelector('[data-tip]').hasAttribute('data-tip-desc')).toBe(false);
    expect(orphan.nextElementSibling).toBeNull();
    // The rest of the sidebar is still wired.
    expect(document.getElementById('dot-size').getAttribute('aria-describedby'))
      .toContain('dot-size-tip');
  });

  test('an empty hint gets no description node', () => {
    const label = document.createElement('label');
    label.setAttribute('for', 'dot-size');
    label.innerHTML = '<span data-tip="">Empty</span>';
    document.body.appendChild(label);

    initParamTooltips();

    expect(label.querySelector('[data-tip]').hasAttribute('data-tip-desc')).toBe(false);
    expect(label.nextElementSibling).toBeNull();
  });
});

/**
 * UI-03 — a mouse resting on a hint's text opens it (WCAG 1.4.13 content on
 * hover or focus). Fake timers stage "resting" exactly: the hint must not be
 * there one millisecond before the delay, and must be there at it.
 */
describe('a mouse resting on a hint opens it', () => {
  const OPEN = INTERACTION.HINT_HOVER_OPEN_DELAY_MS;
  const CLOSE = INTERACTION.HINT_HOVER_CLOSE_DELAY_MS;
  let trigger;
  let control;

  /** The shared element is created lazily on first show. */
  const tooltip = () => document.getElementById('param-tooltip');
  const showing = () => tooltip()?.style.display === 'block';

  /** The pointer arriving over `el`, as a browser reports it. */
  function pointTo(el, pointerType = 'mouse') {
    el.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType }));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mountShell();
    initParamTooltips();
    control = document.getElementById('dot-size');
    trigger = control.closest('label').querySelector('[data-tip]');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Rest on the trigger until its hint opens. */
  function hoverOpen() {
    pointTo(trigger);
    vi.advanceTimersByTime(OPEN);
    expect(showing()).toBe(true);
  }

  test('only after the delay, not before', () => {
    pointTo(trigger);
    vi.advanceTimersByTime(OPEN - 1);
    expect(showing()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(showing()).toBe(true);
    expect(tooltip().textContent).toBe(trigger.getAttribute('data-tip'));
  });

  test('a pointer that leaves before the delay opens nothing', () => {
    pointTo(trigger);
    vi.advanceTimersByTime(OPEN - 1);
    pointTo(control);
    vi.advanceTimersByTime(OPEN * 4);

    expect(showing()).toBe(false);
  });

  test('it stays open while the pointer moves from its text onto the hint', () => {
    hoverOpen();
    // Crossing the gap between them: briefly over neither.
    pointTo(document.body);
    vi.advanceTimersByTime(CLOSE - 1);
    pointTo(tooltip());
    vi.advanceTimersByTime(CLOSE * 4);
    expect(showing()).toBe(true);

    // And back onto its text.
    pointTo(document.body);
    pointTo(trigger);
    vi.advanceTimersByTime(CLOSE * 4);
    expect(showing()).toBe(true);
  });

  test('it closes once the pointer has left both its text and the hint', () => {
    hoverOpen();
    pointTo(document.body);
    vi.advanceTimersByTime(CLOSE - 1);
    expect(showing()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(showing()).toBe(false);

    // Left from the hint itself, too.
    hoverOpen();
    pointTo(tooltip());
    pointTo(document.body);
    vi.advanceTimersByTime(CLOSE);
    expect(showing()).toBe(false);
  });

  test('it stays open while the pointer crosses the control it describes', () => {
    // The hint sits clear of the control, so the way from its text to the
    // hint can run across the control: however slowly, the hint waits.
    hoverOpen();
    pointTo(control);
    vi.advanceTimersByTime(CLOSE * 4);
    expect(showing()).toBe(true);

    pointTo(tooltip());
    vi.advanceTimersByTime(CLOSE * 4);
    expect(showing()).toBe(true);
  });

  test('a scroll before the delay opens nothing: what was under the pointer has moved', () => {
    pointTo(trigger);
    vi.advanceTimersByTime(OPEN - 1);
    document.querySelector('aside.sidebar').dispatchEvent(new window.Event('scroll'));
    vi.advanceTimersByTime(OPEN * 4);

    expect(showing()).toBe(false);
  });

  test('a hint whose text is redrawn before the delay does not open for the old copy', () => {
    // The scene outline redraws its forms while a pointer may rest on one.
    pointTo(trigger);
    trigger.closest('label').replaceWith(trigger.closest('label').cloneNode(true));
    vi.advanceTimersByTime(OPEN * 4);

    expect(showing()).toBe(false);
  });

  test('it closes when the pointer leaves the page', () => {
    hoverOpen();
    trigger.dispatchEvent(new window.PointerEvent('pointerout', {
      bubbles: true, pointerType: 'mouse', relatedTarget: null,
    }));
    vi.advanceTimersByTime(CLOSE);
    expect(showing()).toBe(false);
  });

  test('Escape dismisses it with the pointer still on its text, and it stays dismissed', () => {
    hoverOpen();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(showing()).toBe(false);

    // The pointer has not moved: nothing reopens it.
    vi.advanceTimersByTime(OPEN * 4);
    expect(showing()).toBe(false);

    // Leaving and coming back is a new rest, so it opens again.
    pointTo(control);
    hoverOpen();
  });

  test('only a hint opened by hover takes the pointer; others stay click-through', () => {
    const css = readFileSync(resolve(process.cwd(), 'styles/main.css'), 'utf8');
    expect(css).toMatch(/\.param-tooltip\.is-hover-open\s*\{\s*pointer-events:\s*auto;?\s*\}/);

    hoverOpen();
    expect(tooltip().classList.contains('is-hover-open')).toBe(true);

    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(true);
    expect(tooltip().classList.contains('is-hover-open')).toBe(false);
  });

  test('a click on a hint hovering opened keeps it, as a click-opened one is kept', () => {
    hoverOpen();
    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(true);

    // Now the pointer leaving does not close it…
    pointTo(control);
    vi.advanceTimersByTime(CLOSE * 4);
    expect(showing()).toBe(true);

    // …and a second click on its text does, as before.
    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(false);
  });

  test('a mouse click before the delay opens it at once, and the rest does not turn it into a hover', () => {
    pointTo(trigger);
    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(true);

    vi.advanceTimersByTime(OPEN * 2);
    pointTo(control);
    vi.advanceTimersByTime(CLOSE * 4);
    expect(showing()).toBe(true);
  });

  test('focus leaving its control does not close a hint the pointer opened', () => {
    // Focus on the control, its hint dismissed: the pointer then opens it.
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    control.focus();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(showing()).toBe(false);
    hoverOpen();

    // The pointer is still on its text: losing focus is not leaving it.
    control.blur();
    expect(showing()).toBe(true);
  });

  test.each(['touch', 'pen'])('a %s pointer never opens it by hovering; its tap still toggles it', (pointerType) => {
    pointTo(trigger, pointerType);
    vi.advanceTimersByTime(OPEN * 4);
    expect(showing()).toBe(false);

    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(true);
    // A tap's pointer leaving is not a mouse leaving: the hint stays.
    pointTo(control, pointerType);
    vi.advanceTimersByTime(CLOSE * 4);
    expect(showing()).toBe(true);

    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(false);
  });

  test('a click on a hover-opened hint closes it, so what it covers is a click away', () => {
    hoverOpen();
    tooltip().dispatchEvent(clickEvent());
    expect(showing()).toBe(false);

    // The pointer still resting on the hint opens nothing more.
    pointTo(tooltip());
    vi.advanceTimersByTime(OPEN * 4);
    expect(showing()).toBe(false);
  });

  test('it is placed clear of the control it describes, not over it', () => {
    // An outline label sits above its input: a hint below the label alone
    // would cover the field and, taking the pointer, block clicks on it.
    const box = (top, bottom) => ({
      top, bottom, left: 20, right: 220, width: 200, height: bottom - top, x: 20, y: top,
    });
    trigger.getBoundingClientRect = () => box(100, 116);
    control.getBoundingClientRect = () => box(120, 152);
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => {
      run(0);
      return 0;
    });
    try {
      hoverOpen();
    } finally {
      frame.mockRestore();
    }
    expect(parseFloat(tooltip().style.top)).toBeGreaterThanOrEqual(152);
  });

  test('with no room below it sits above its text, and never above the window', () => {
    const box = (top, bottom) => ({
      top, bottom, left: 20, right: 220, width: 200, height: bottom - top, x: 20, y: top,
    });
    const rect = vi.spyOn(window.HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function tipBox() {
        return this.id === 'param-tooltip' ? box(0, 100) : box(0, 0);
      });
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => {
      run(0);
      return 0;
    });
    try {
      // Room above: it flips to sit just above the text.
      trigger.getBoundingClientRect = () => box(500, 516);
      control.getBoundingClientRect = () => box(520, 700);
      hoverOpen();
      expect(parseFloat(tooltip().style.top)).toBe(500 - 100 - 6);
      tooltip().dispatchEvent(clickEvent());

      // A control far below its text leaves room on neither side: it stays
      // on screen rather than above the top of the window.
      pointTo(document.body);
      trigger.getBoundingClientRect = () => box(40, 56);
      control.getBoundingClientRect = () => box(60, window.innerHeight - 4);
      hoverOpen();
      expect(parseFloat(tooltip().style.top)).toBe(12);
    } finally {
      frame.mockRestore();
      rect.mockRestore();
    }
  });
});

/**
 * A swatch picker is one control of several radios, named by its legend, so
 * its hint answers keyboard focus anywhere in the group, as a single
 * control's hint answers focus on that control.
 */
describe('a colour picker’s hint follows keyboard focus through its swatches', () => {
  const tooltip = () => document.getElementById('param-tooltip');
  const showing = () => tooltip()?.style.display === 'block';

  /**
   * A keyboard arrival, as jsdom's `:focus-visible` heuristic recognises one.
   * A browser moves between swatches with the arrow keys; jsdom credits only
   * a preceding Tab, so every move here is staged as one.
   */
  function tabTo(el) {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    el.focus();
  }

  test('it shows on the group, stays across its swatches, and Escape keeps it shut until focus leaves', () => {
    mountShell();
    attachSwatchPickers();
    initParamTooltips();
    const picker = document.querySelector('.swatch-picker[data-target-input="#crowd-dot-color"]');
    const hint = picker.querySelector('legend [data-tip]').getAttribute('data-tip');
    const [first, second, third] = picker.querySelectorAll('.swatch-radio');

    tabTo(first);
    expect(showing()).toBe(true);
    expect(tooltip().textContent).toBe(hint);

    // Moving between the swatches of the one control.
    tabTo(second);
    expect(showing()).toBe(true);

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(showing()).toBe(false);
    tabTo(third);
    expect(showing()).toBe(false);

    // Leaving the group and coming back is a new visit.
    document.getElementById('crowd-dot-size').focus();
    tabTo(first);
    expect(showing()).toBe(true);
    expect(tooltip().textContent).toBe(hint);
  });
});

/**
 * The controls a hint is owed to, and how the test tells one has its hint.
 *
 * A parameter control is a form control that sets a value of the project or
 * its export, in a panel: a native input, select or textarea, or a swatch
 * picker's group (its radios are the group's options, not controls of their
 * own). Not one: a button or file input (an action), a hidden input (the
 * value store behind a swatch picker), and a radio of a swatch group.
 *
 * It has its hint when the label or legend that names it carries `data-tip`
 * text and that same text is part of its description.
 */
function isParameterControl(el) {
  if (el.matches('fieldset.swatch-fieldset')) return true;
  if (!el.matches('input, select, textarea')) return false;
  return !['hidden', 'file', 'button', 'submit', 'reset', 'image'].includes(el.type)
    && !el.matches('.swatch-radio');
}

function parameterControlsIn(root) {
  return [...root.querySelectorAll('input, select, textarea, fieldset.swatch-fieldset')]
    .filter(isParameterControl);
}

function hintOf(control) {
  const namers = control.matches('fieldset')
    ? [control.querySelector(':scope > legend')]
    : [...control.labels];
  const trigger = namers.filter(Boolean)
    .map(namer => (namer.matches('[data-tip]') ? namer : namer.querySelector('[data-tip]')))
    .find(Boolean);
  const text = trigger?.getAttribute('data-tip')?.trim();
  return text && describedText(control).includes(text) ? text : null;
}

function nameOf(control) {
  const namer = control.matches('fieldset') ? control.querySelector(':scope > legend') : control.labels[0];
  return control.id || `${control.name || control.tagName} "${namer?.textContent.trim().replace(/\s+/g, ' ')}"`;
}

const withoutHint = controls => controls.filter(control => !hintOf(control)).map(nameOf);

describe('every parameter control has a hint', () => {
  test('the settings panel: every inspector card, colour pickers included', () => {
    mountShell();
    attachSwatchPickers();
    initParamTooltips();
    const controls = parameterControlsIn(document.querySelector('aside.sidebar'));

    // Vacuous if the panel or its pickers were not there to check.
    expect(controls.length).toBeGreaterThan(80);
    expect(controls.filter(control => control.matches('fieldset')).length).toBe(7);
    expect(withoutHint(controls)).toEqual([]);
  });

  test('rows the panel builds as it is used: busyness handles and path weights', async () => {
    const app = await bootApp();
    try {
      await app.ready;
      // Close the splash, as an author would: its focus trap outlives the
      // boot and would take a later test's Escape.
      document.getElementById('splash-close').click();
      // No route: a new crowd walks a custom network of its own.
      app.addCrowd({ enterNetworkEditor: false });
      document.getElementById('crowd-busyness-add').click();

      const layer = app.selectedCrowd;
      const junction = layer.graph.addNode({ x: 0.5, y: 0.5 });
      for (const y of [0.2, 0.8]) {
        const exit = layer.graph.addNode({ x: 0.9, y, type: 'exit' });
        layer.graph.addEdge({ sourceId: junction.id, targetId: exit.id, direction: 'one-way' });
      }
      app.networkEditService.bindForInspection(layer);
      app.networkEditService.selectNode(junction);
      // Hints added after load are wired as they arrive.
      await Promise.resolve();

      const busyness = parameterControlsIn(document.getElementById('crowd-busyness-handles'));
      const weights = parameterControlsIn(document.getElementById('network-path-weight-rows'));
      // Three handles: a time and a busy field each, and a change for each span.
      expect(busyness.length).toBe(8);
      expect(weights.length).toBe(2);
      expect(withoutHint([...busyness, ...weights])).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });
});

/** A scene with one of every outline entry that has a form. */
function outlineFixture() {
  const major = new Waypoint({ id: 'wp-major', imgX: 0.2, imgY: 0.7, isMajor: true });
  const minor = new Waypoint({ id: 'wp-minor', imgX: 0.5, imgY: 0.4, isMajor: false });
  minor.areaHighlight.enabled = true;
  minor.areaHighlight.shape = 'polygon';
  minor.areaHighlight.points = [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }, { x: 0.5, y: 0.6 }];
  const scene = new Scene();
  const crowd = scene.addFlowLayer({ id: 'crowd', name: 'Arrivals', guideType: 'graph' });
  crowd.addEmitter({ id: 'emitter', dotCount: 20, seed: 11 });
  const entry = crowd.graph.addNode({ id: 'node-entry', x: 0.2, y: 0.3, type: 'entry' });
  const exit = crowd.graph.addNode({ id: 'node-exit', x: 0.8, y: 0.7, type: 'exit' });
  crowd.graph.addEdge({ id: 'edge', sourceId: entry.id, targetId: exit.id, direction: 'one-way' })
    .addControlPoint(0.4, 0.6);
  return buildSceneOutlineSnapshot({ waypoints: [major, minor], scene });
}

/** Draw the outline with every entry open, as an author opening each in turn would. */
async function drawWholeOutline() {
  document.body.innerHTML = '<div id="scene-outline"></div>';
  const container = document.getElementById('scene-outline');
  const eventBus = new EventBus();
  new SceneOutlineController(container, eventBus);
  eventBus.emit('scene-outline:update', outlineFixture());
  for (let guard = 0; guard < 100; guard += 1) {
    const closed = container.querySelector('details[data-outline-disclosure]:not([open])');
    if (!closed) break;
    closed.querySelector(':scope > summary').click();
    await Promise.resolve();
  }
  expect(container.querySelector('details[data-outline-disclosure]:not([open])')).toBeNull();
  // Hints drawn after load are wired as they arrive.
  await Promise.resolve();
  return { container, eventBus };
}

describe('the scene outline’s fields have hints, drawn as the outline is', () => {
  beforeEach(() => {
    mountShell();
    initParamTooltips();
  });

  test('every field of every outline form has its hint as its description', async () => {
    const { container } = await drawWholeOutline();
    const fields = parameterControlsIn(container);
    const kinds = new Set(fields.map(field => `${field.form.dataset.outlineAction}:${field.name}`));

    // Vacuous unless all 46 fields of the 13 forms were drawn.
    expect(kinds.size).toBe(46);
    expect(withoutHint(fields)).toEqual([]);
  });

  test('a field keeps its hint through a command error shown and cleared', async () => {
    const { container, eventBus } = await drawWholeOutline();
    const form = container.querySelector('form[data-outline-action="update-edge"]');
    const formKey = form.dataset.outlineFormKey;
    const weight = form.elements.weight;
    const hint = hintOf(weight);
    expect(hint).toBeTruthy();

    eventBus.emit('scene-outline:error', { formKey, message: 'Enter a weight.' });
    // The error first, then the hint.
    expect(describedText(weight)).toEqual(['Enter a weight.', hint]);

    eventBus.emit('scene-outline:accepted', { formKey });
    expect(describedText(weight)).toEqual([hint]);
  });

  test('resting on an outline field’s label opens its hint', async () => {
    const { container } = await drawWholeOutline();
    vi.useFakeTimers();
    try {
      const trigger = container.querySelector('form[data-outline-action="update-emitter"] [data-tip]');
      trigger.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      vi.advanceTimersByTime(INTERACTION.HINT_HOVER_OPEN_DELAY_MS);
      const tooltip = document.getElementById('param-tooltip');
      expect(tooltip.style.display).toBe('block');
      expect(tooltip.textContent).toBe(trigger.getAttribute('data-tip'));
    } finally {
      vi.useRealTimers();
    }
  });

  test('Escape in an outline field closes its hover-opened hint in place', async () => {
    // The outline takes Escape to reset the form and stops it there; the
    // hint must close all the same (WCAG 1.4.13 Dismissible).
    const { container } = await drawWholeOutline();
    vi.useFakeTimers();
    try {
      const form = container.querySelector('form[data-outline-action="update-edge"]');
      const weight = form.elements.weight;
      const trigger = [...form.querySelectorAll('[data-tip]')]
        .find(tip => tip.getAttribute('data-tip') === hintOf(weight));
      expect(trigger).toBeTruthy();
      trigger.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      vi.advanceTimersByTime(INTERACTION.HINT_HOVER_OPEN_DELAY_MS);
      const tooltip = document.getElementById('param-tooltip');
      expect(tooltip.style.display).toBe('block');

      weight.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(tooltip.style.display).toBe('none');
      // The outline still had the key: its form's Apply took focus.
      expect(document.activeElement).toBe(form.querySelector('[type="submit"]'));
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * UI-03 names Release bias first: its hint must say which way is earlier, and
 * say it as the code does it. A negative bias pulls set-offs towards the start
 * of the window (`dotOnsetFraction`), the slider's negative end is its left,
 * and the readout calls that side Earlier.
 */
describe('Release bias says which way is earlier', () => {
  /** The mean set-off of an evenly spread release, as a fraction of its window. */
  function meanOnset(intensityRamp) {
    const dotCount = 101;
    let sum = 0;
    for (let index = 0; index < dotCount; index += 1) {
      sum += dotOnsetFraction({
        index, dotCount, onsetHash: 0.5, onsetVariance: 0, intensityRamp,
        sampleEnvelope: value => value, windowStart: 0, windowSpan: 1,
      });
    }
    return sum / dotCount;
  }

  test('the slider’s left is earlier: so the code, the readout and the hint say', () => {
    mountShell();
    const slider = document.getElementById('crowd-intensity-ramp');
    const hint = slider.closest('label').querySelector('[data-tip]').getAttribute('data-tip');

    // The code: below 0 sets dots off earlier, above 0 later.
    expect(meanOnset(-1)).toBeLessThan(meanOnset(0));
    expect(meanOnset(1)).toBeGreaterThan(meanOnset(0));
    // The slider: its left end is below 0, and the readout calls that Earlier.
    expect(Number(slider.min)).toBeLessThan(0);
    expect(Number(slider.max)).toBeGreaterThan(0);
    expect(formatCrowdReleaseBias(Number(slider.min))).toMatch(/^Earlier/);
    expect(formatCrowdReleaseBias(Number(slider.max))).toMatch(/^Later/);
    // The hint: in the readout's own words, left is Earlier, right is Later.
    expect(hint).toMatch(/\bLeft \(Earlier\)/);
    expect(hint).toMatch(/\bright \(Later\)/);
    expect(hint).not.toMatch(/busyness graph/);
  });

  test('the outline’s Release bias field says below 0 is earlier', async () => {
    mountShell();
    initParamTooltips();
    const { container } = await drawWholeOutline();
    const field = container.querySelector('form[data-outline-action="update-emitter"]').elements.intensityRamp;

    expect(Number(field.min)).toBeLessThan(0);
    expect(hintOf(field)).toMatch(/^Below 0 is earlier\b/);
    expect(hintOf(field)).toMatch(/\babove 0 is later\b/);
  });
});
