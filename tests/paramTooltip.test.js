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
 * A hint's own "?" button (UI-04): the trigger described by the hint's
 * description, as its control is.
 */
function triggerOf(tip) {
  return document.querySelector(`.param-hint-trigger[aria-describedby="${tip.getAttribute('data-tip-desc')}"]`);
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
  let tip;
  let trigger;
  let control;

  beforeEach(() => {
    mountShell();
    initParamTooltips();
    control = document.getElementById('dot-size');
    tip = control.closest('label').querySelector('[data-tip]');
    // UI-04: the hint opens from its own "?", no longer from the label text.
    trigger = triggerOf(tip);
  });

  /** The shared element is created lazily on first show. */
  const tooltip = () => document.getElementById('param-tooltip');

  /** Arrive the way a keyboard user does, so `:focus-visible` is genuine. */
  function tabTo(el) {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    el.focus();
  }

  test('clicking the hint’s trigger shows it, and clicking again closes it', () => {
    trigger.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('block');
    expect(tooltip().textContent).toBe(tip.getAttribute('data-tip'));

    trigger.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('none');
  });

  test('it never competes with the description it duplicates', () => {
    trigger.dispatchEvent(clickEvent());

    // Announcing both the tooltip and the description would say it twice.
    expect(tooltip().getAttribute('aria-hidden')).toBe('true');
    expect(tip.hasAttribute('aria-describedby')).toBe(false);
    // The trigger is described by the description node, never by the tooltip.
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.getAttribute('data-tip-desc'));
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
    expect(tooltip().textContent).toBe(tip.getAttribute('data-tip'));
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
  let tip;
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
    tip = control.closest('label').querySelector('[data-tip]');
    // UI-04: the pointer rests on the hint's own "?", not on the label text.
    trigger = triggerOf(tip);
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
    expect(tooltip().textContent).toBe(tip.getAttribute('data-tip'));
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
    tip.closest('label').replaceWith(tip.closest('label').cloneNode(true));
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
    tip.getBoundingClientRect = () => box(100, 116);
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
      tip.getBoundingClientRect = () => box(500, 516);
      control.getBoundingClientRect = () => box(520, 700);
      hoverOpen();
      expect(parseFloat(tooltip().style.top)).toBe(500 - 100 - 6);
      tooltip().dispatchEvent(clickEvent());

      // A control far below its text leaves room on neither side: it stays
      // on screen rather than above the top of the window.
      pointTo(document.body);
      trigger.getBoundingClientRect = () => box(40, 56);
      tip.getBoundingClientRect = () => box(40, 56);
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

  test('resting on an outline field’s “?” opens its hint', async () => {
    const { container } = await drawWholeOutline();
    vi.useFakeTimers();
    try {
      const tip = container.querySelector('form[data-outline-action="update-emitter"] [data-tip]');
      const trigger = triggerOf(tip);
      trigger.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      vi.advanceTimersByTime(INTERACTION.HINT_HOVER_OPEN_DELAY_MS);
      const tooltip = document.getElementById('param-tooltip');
      expect(tooltip.style.display).toBe('block');
      expect(tooltip.textContent).toBe(tip.getAttribute('data-tip'));
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
      const trigger = triggerOf([...form.querySelectorAll('[data-tip]')]
        .find(tip => tip.getAttribute('data-tip') === hintOf(weight)));
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

/**
 * UI-04 — each hint has a "?" trigger of its own, and the label's text is a
 * label again (DEF-14). Before, a click on the text opened the hint and was
 * cancelled, so a checkbox's label did not toggle it and no label passed its
 * click on to its control.
 */

/** Every wired hint in `root`: its text, control, label or legend and trigger. */
function wiredHints(root = document) {
  return [...root.querySelectorAll('[data-tip][data-tip-desc]')].map((tip) => {
    const namer = tip.closest('label, legend');
    const host = namer.tagName === 'LEGEND' ? namer.parentElement : namer;
    const triggers = [...document.querySelectorAll('.param-hint-trigger')]
      .filter(button => button.getAttribute('aria-describedby') === tip.getAttribute('data-tip-desc'));
    return { tip, namer, host, triggers };
  });
}

/**
 * What is wrong with each hint's trigger, if anything: there must be exactly
 * one, a real button beside its label (never in it), named in the label's
 * words, described by the hint, saying whether it is expanded, and tied to the
 * label's text for anchor positioning.
 */
function triggerFaults(root = document) {
  const faults = [];
  for (const { tip, namer, host, triggers } of wiredHints(root)) {
    const words = tip.textContent.replace(/\s+/g, ' ').trim();
    if (triggers.length !== 1) {
      faults.push(`${words}: ${triggers.length} triggers`);
      continue;
    }
    const [trigger] = triggers;
    if (trigger.tagName !== 'BUTTON' || trigger.type !== 'button') faults.push(`${words}: not a button`);
    if (namer.contains(trigger) || trigger.closest('label, legend')) faults.push(`${words}: inside its label`);
    if (trigger.previousElementSibling !== host && trigger.nextElementSibling !== host) {
      faults.push(`${words}: not beside its label`);
    }
    if (trigger.getAttribute('aria-label') !== `Help: ${words}`) {
      faults.push(`${words}: named "${trigger.getAttribute('aria-label')}"`);
    }
    const description = document.getElementById(trigger.getAttribute('aria-describedby'));
    if (description?.textContent !== tip.getAttribute('data-tip')) faults.push(`${words}: not described by its hint`);
    if (trigger.getAttribute('aria-expanded') !== 'false') faults.push(`${words}: expanded at rest`);
    const anchor = tip.style.getPropertyValue('anchor-name');
    if (!anchor || trigger.style.getPropertyValue('position-anchor') !== anchor) {
      faults.push(`${words}: not anchored to its label text`);
    }
  }
  // None without a hint on the page: a hint taken away takes its trigger.
  const owned = new Set(wiredHints(root).flatMap(({ triggers }) => triggers));
  for (const trigger of root.querySelectorAll('.param-hint-trigger')) {
    if (!owned.has(trigger)) faults.push(`${trigger.getAttribute('aria-label')}: no hint on the page`);
  }
  return faults;
}

describe('UI-04: every hint has a “?” trigger of its own', () => {
  test('the settings panel: one trigger per hint, colour pickers included, and none astray', () => {
    mountShell();
    attachSwatchPickers();
    initParamTooltips();

    // Vacuous unless the panel's hints were there to check.
    expect(wiredHints().length).toBeGreaterThan(80);
    expect(document.querySelectorAll('.param-hint-trigger').length).toBe(wiredHints().length);
    expect(triggerFaults()).toEqual([]);
  });

  test('re-initialising adds no second trigger', () => {
    mountShell();
    initParamTooltips();
    const count = document.querySelectorAll('.param-hint-trigger').length;
    initParamTooltips();
    initParamTooltips();

    expect(document.querySelectorAll('.param-hint-trigger').length).toBe(count);
    expect(triggerFaults()).toEqual([]);
  });

  test('Tab meets the trigger where the eye does: before a control its text leads, after a checkbox', () => {
    mountShell();
    initParamTooltips();
    const triggerFor = control => triggerOf(control.closest('label').querySelector('[data-tip]'));

    // Text, then its control: the "?" is reached before the control.
    const size = document.getElementById('dot-size');
    expect(triggerFor(size).nextElementSibling).toBe(size.closest('label'));
    // A checkbox, then its text: the "?" is reached after the checkbox.
    const casing = document.getElementById('path-casing-toggle');
    expect(triggerFor(casing).previousElementSibling).toBe(casing.closest('label'));
  });

  test('rows the panel builds as it is used get theirs as they arrive, and lose them as they go', async () => {
    const app = await bootApp();
    try {
      await app.ready;
      document.getElementById('splash-close').click();
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
      await Promise.resolve();

      const busyness = document.getElementById('crowd-busyness-handles');
      const weights = document.getElementById('network-path-weight-rows');
      // Three handles' fields and two path weights, each with its own "?".
      expect(wiredHints(busyness).length).toBe(8);
      expect(wiredHints(weights).length).toBe(2);
      expect(triggerFaults()).toEqual([]);

      // The middle handle goes: its rows are drawn again, one trigger each.
      busyness.querySelector('.crowd-busyness-remove').click();
      await Promise.resolve();
      expect(wiredHints(busyness).length).toBe(5);
      expect(triggerFaults()).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });

  test('the scene outline’s fields get theirs as each form is drawn, and redrawing keeps one each', async () => {
    mountShell();
    initParamTooltips();
    const { container, eventBus } = await drawWholeOutline();

    expect(wiredHints(container).length).toBeGreaterThanOrEqual(46);
    expect(triggerFaults()).toEqual([]);

    // A redraw replaces every form; the old triggers go with them.
    eventBus.emit('scene-outline:update', outlineFixture());
    await Promise.resolve();
    expect(triggerFaults()).toEqual([]);
  });

  test('a row hidden by hiding its label hides its trigger, and closes its hint', () => {
    mountShell();
    initParamTooltips();
    const label = document.getElementById('pause-time-control');
    const trigger = triggerOf(label.querySelector('[data-tip]'));
    const tooltip = () => document.getElementById('param-tooltip');

    trigger.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('block');

    // The app hides Wait Time for a minor waypoint by its label's style.
    label.style.display = 'none';
    return Promise.resolve().then(() => {
      expect(trigger.hidden).toBe(true);
      expect(tooltip().style.display).toBe('none');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      label.style.display = 'flex';
      return Promise.resolve();
    }).then(() => {
      expect(trigger.hidden).toBe(false);
      // And by its `hidden` attribute (the reveal trail).
      label.hidden = true;
      return Promise.resolve();
    }).then(() => {
      expect(trigger.hidden).toBe(true);
    });
  });
});

describe('UI-04: the trigger opens its hint on hover, focus and tap; the label text is a label', () => {
  const OPEN = INTERACTION.HINT_HOVER_OPEN_DELAY_MS;
  const tooltip = () => document.getElementById('param-tooltip');
  const showing = () => tooltip()?.style.display === 'block';
  let tip;
  let trigger;
  let control;

  function tabTo(el) {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    el.focus();
  }

  beforeEach(() => {
    mountShell();
    initParamTooltips();
    control = document.getElementById('waypoint-pause-time');
    tip = control.closest('label').querySelector('[data-tip]');
    trigger = triggerOf(tip);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('a mouse resting on the “?” opens it after the delay; resting on the label text opens nothing', () => {
    vi.useFakeTimers();
    tip.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    vi.advanceTimersByTime(OPEN * 4);
    expect(showing()).toBe(false);

    trigger.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    vi.advanceTimersByTime(OPEN - 1);
    expect(showing()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(showing()).toBe(true);
    expect(tooltip().textContent).toBe(tip.getAttribute('data-tip'));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  test('keyboard focus on the “?” opens it; Escape closes it while focus stays; leaving closes it', () => {
    tabTo(trigger);
    expect(showing()).toBe(true);
    expect(tooltip().textContent).toBe(tip.getAttribute('data-tip'));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(showing()).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
    expect(showing()).toBe(false);

    // A new visit opens it again; Tab on to the control keeps it, then away closes it.
    trigger.blur();
    tabTo(trigger);
    expect(showing()).toBe(true);
    tabTo(control);
    expect(showing()).toBe(true);
    control.blur();
    expect(showing()).toBe(false);
  });

  test('a click or tap on the “?” toggles it, and a mouse’s focus does not open it first', () => {
    // A mouse press focuses the button before its click: that focus is not
    // a keyboard's, so the click opens the hint rather than closing it.
    trigger.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    trigger.focus();
    expect(showing()).toBe(false);
    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  test('one hint at a time: opening another closes the first, and its trigger says so', () => {
    const other = triggerOf(document.getElementById('dot-size').closest('label').querySelector('[data-tip]'));
    trigger.dispatchEvent(clickEvent());
    other.dispatchEvent(clickEvent());

    expect(showing()).toBe(true);
    expect(other.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  test('a click on the label text opens no hint, and closes one that shows', () => {
    tip.dispatchEvent(clickEvent());
    expect(showing()).toBe(false);

    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(true);
    tip.dispatchEvent(clickEvent());
    expect(showing()).toBe(false);
  });
});

describe('DEF-14: a click on a hinted label acts as a label', () => {
  beforeEach(() => {
    mountShell();
    attachSwatchPickers();
    initParamTooltips();
  });

  test('every hinted checkbox toggles when its label text is clicked', () => {
    const boxes = [...document.querySelectorAll('input[type="checkbox"]')]
      .filter(box => [...box.labels].some(label => label.querySelector('[data-tip]')));
    // The five DEF-14 counted, and Wait during ripple.
    expect(boxes.map(box => box.id)).toEqual([
      'ripple-wait', 'path-casing-toggle', 'path-glow-toggle',
      'export-include-image', 'export-include-camera', 'export-include-text',
    ]);

    const stuck = boxes.filter((box) => {
      const before = box.checked;
      box.labels[0].querySelector('[data-tip]').dispatchEvent(clickEvent());
      return box.checked === before;
    }).map(box => box.id);
    expect(stuck).toEqual([]);
  });

  test('every hinted label passes a click on its text on to its control, as a browser focuses or toggles it', () => {
    // A disabled control takes no click from its label, in a browser or here.
    const labels = wiredHints()
      .filter(({ namer, tip }) => namer.tagName === 'LABEL' && !describedControl(tip).disabled);
    // Vacuous unless the labels DEF-14 counted (about 70) were there.
    expect(labels.length).toBeGreaterThan(70);

    const unforwarded = labels.filter(({ tip }) => {
      const control = describedControl(tip);
      let reached = 0;
      const count = () => { reached += 1; };
      control.addEventListener('click', count);
      tip.dispatchEvent(clickEvent());
      control.removeEventListener('click', count);
      return reached !== 1;
    }).map(({ tip }) => tip.textContent.trim());
    expect(unforwarded).toEqual([]);
  });
});

/** A label's control, as a browser resolves it: its `for` target, or the control it wraps. */
function describedControl(tip) {
  const label = tip.closest('label');
  return label.control;
}

/**
 * Codex's UI-04 review: a "?" is a button beside a label, inside the label's
 * row, so a row's rule written for its own children (`.control-row-inline
 * span:first-child`) also reached the glyph inside the button, stretching it
 * to the label column's 96px and greying it below 7:1. The app's stylesheets
 * are parsed here (jsdom cascades their declarations, though it resolves no
 * `var()`), and every rule that reaches inside a trigger must be the
 * trigger's own or one of the few page-wide ones named below.
 */
const STYLESHEETS = [...indexHtml.matchAll(/<link rel="stylesheet" href="(styles\/[^"?]+)/g)].map(([, href]) => href);

/** Page-wide rules that reach every element, the glyph included, and why each is harmless there. */
const PAGE_WIDE = new Map([
  ['.sidebar *', 'max-width and box-sizing only: the glyph is 20px in a 44px button'],
  ['.sidebar-right *', 'max-width and box-sizing only: the glyph is 20px in a 44px button'],
]);

function loadStylesheets() {
  for (const href of STYLESHEETS) {
    const style = document.createElement('style');
    style.dataset.from = href;
    style.textContent = readFileSync(resolve(process.cwd(), href), 'utf8');
    document.head.appendChild(style);
  }
}

/** Every selector in the loaded sheets, @media blocks included, one per comma. */
function loadedSelectors() {
  const selectors = [];
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules) walk(rule.cssRules);
      if (rule.selectorText) selectors.push(...rule.selectorText.split(/,(?![^(]*\))/).map(part => part.trim()));
    }
  };
  for (const style of document.querySelectorAll('style[data-from]')) walk(style.sheet.cssRules);
  return selectors;
}

/**
 * Whether `selector` can apply to `el` in some state: a rule for a hover,
 * focus or press, or for a pseudo-element, counts if its element matches.
 */
function reaches(selector, el) {
  const element = selector
    .replace(/::?(?:before|after|placeholder|marker|selection|-webkit-[\w-]+|-moz-[\w-]+)\b/g, '')
    .replace(/:(?:hover|active|focus-visible|focus-within|focus)\b/g, '');
  try {
    return el.matches(element || '*');
  } catch {
    return false;
  }
}

/** Selectors that reach inside a trigger (its glyph) or onto it without being its own. */
function strayRules() {
  const selectors = loadedSelectors();
  const insides = [...document.querySelectorAll('.param-hint-trigger, .param-hint-trigger *')];
  const stray = new Set();
  for (const selector of selectors) {
    if (/param-hint/.test(selector) || PAGE_WIDE.has(selector)) continue;
    // A type or state rule on the element itself (`button`, the focus ring)
    // is every button's; one reached through an ancestor is a row's.
    if (!/[\s>+~]/.test(selector.replace(/\([^)]*\)/g, ''))) continue;
    if (insides.some(el => reaches(selector, el))) stray.add(selector);
  }
  return { stray: [...stray], examined: selectors.length };
}

describe('UI-04 review: no row’s rule reaches inside a hint’s trigger', () => {
  test('the settings panel, colour pickers included', () => {
    mountShell();
    attachSwatchPickers();
    initParamTooltips();
    loadStylesheets();
    const { stray, examined } = strayRules();

    // Vacuous unless the sheets were parsed, the leaking rule's row among them.
    expect(examined).toBeGreaterThan(500);
    expect(loadedSelectors()).toContain('.control-row-inline > span:first-child');
    expect(stray).toEqual([]);
  });

  test('the scene outline’s forms', async () => {
    mountShell();
    initParamTooltips();
    await drawWholeOutline();
    loadStylesheets();
    expect(document.querySelectorAll('.param-hint-trigger').length).toBeGreaterThanOrEqual(46);
    expect(strayRules().stray).toEqual([]);
  });

  test('rows the panel builds as it is used: busyness handles and path weights', async () => {
    const app = await bootApp();
    try {
      await app.ready;
      document.getElementById('splash-close').click();
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
      await Promise.resolve();
      loadStylesheets();
      expect(document.querySelectorAll('#crowd-busyness-handles .param-hint-trigger').length).toBe(8);
      expect(strayRules().stray).toEqual([]);
    } finally {
      app.interactionHandler.destroy();
    }
  });

  test.each(['camera-zoom', 'camera-selected-zoom'])('the %s row’s glyph keeps its own size and colour', (id) => {
    mountShell();
    initParamTooltips();
    loadStylesheets();
    const glyph = triggerOf(document.querySelector(`label[for="${id}"]`)).querySelector('.param-hint-glyph');
    const style = window.getComputedStyle(glyph);

    // Its own 1.25rem circle, not stretched to the label column's 6rem.
    expect(style.width).toBe('1.25rem');
    expect(style.minWidth).toBe('auto');
    // Its button's --text-01 (#0F0F0F, 7:1 and more on every row and hover
    // background), not the readout grey --text-03 (5.77:1 on hover).
    expect(style.color).toBe('var(--text-01)');
    expect(style.fontSize).toBe('var(--type-caption)');
  });
});

/**
 * Codex's UI-04 review: a row taken off the page took its "?" but left its
 * hint showing, the module still holding the detached hint as the open one.
 */
describe('UI-04 review: a hint’s row taken away takes its showing or pending hint', () => {
  const tooltip = () => document.getElementById('param-tooltip');
  const showing = () => tooltip()?.style.display === 'block';

  afterEach(() => {
    vi.useRealTimers();
  });

  /** An outline field's hint text and trigger, and the form that holds them. */
  async function outlineHint() {
    mountShell();
    initParamTooltips();
    const { container } = await drawWholeOutline();
    const form = container.querySelector('form[data-outline-action="update-emitter"]');
    const tip = form.querySelector('[data-tip]');
    return { container, form, tip, trigger: triggerOf(tip) };
  }

  test('a showing hint closes when its row goes, and the next hint opens as usual', async () => {
    const { container, form, trigger } = await outlineHint();
    trigger.dispatchEvent(clickEvent());
    expect(showing()).toBe(true);

    form.remove();
    await Promise.resolve();
    expect(trigger.isConnected).toBe(false);
    expect(showing()).toBe(false);

    // Nothing of the old hint lingers: another opens, and the first click closes it.
    const other = triggerOf(container.querySelector('form[data-outline-action="update-edge"] [data-tip]'));
    other.dispatchEvent(clickEvent());
    expect(showing()).toBe(true);
    expect(other.getAttribute('aria-expanded')).toBe('true');
    other.dispatchEvent(clickEvent());
    expect(showing()).toBe(false);
  });

  test('a hover open still pending when its row goes never opens', async () => {
    const { form, trigger } = await outlineHint();
    vi.useFakeTimers();
    trigger.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    vi.advanceTimersByTime(INTERACTION.HINT_HOVER_OPEN_DELAY_MS - 1);

    form.remove();
    await Promise.resolve();
    vi.advanceTimersByTime(INTERACTION.HINT_HOVER_OPEN_DELAY_MS * 4);
    expect(showing()).toBe(false);
  });

  test('nor when its row leaves and comes back: the pointer’s rest was on what left', async () => {
    const { container, form, trigger } = await outlineHint();
    vi.useFakeTimers();
    trigger.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    vi.advanceTimersByTime(INTERACTION.HINT_HOVER_OPEN_DELAY_MS - 1);

    // A moved row keeps its hint and its trigger, back beside its label.
    const parent = form.parentElement;
    form.remove();
    await Promise.resolve();
    parent.appendChild(form);
    await Promise.resolve();
    expect(trigger.isConnected).toBe(true);

    vi.advanceTimersByTime(INTERACTION.HINT_HOVER_OPEN_DELAY_MS * 4);
    expect(showing()).toBe(false);
    expect(container.contains(trigger)).toBe(true);
  });
});
