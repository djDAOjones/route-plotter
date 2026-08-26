import { describe, expect, test, vi } from 'vitest';
import {
  MIXED_OPTION_VALUE,
  bindMixedControlReset,
  hasMixedValues,
  setCheckboxMixed,
  setRangeMixed,
  setSelectMixed,
} from '../src/utils/mixedControlState.js';

describe('mixed inspector control state', () => {
  test('compares the values a control actually reads', () => {
    const targets = [{ value: 1, ignored: 'a' }, { value: 1, ignored: 'b' }];
    expect(hasMixedValues(targets, target => target.value)).toBe(false);
    expect(hasMixedValues(targets, target => target.ignored)).toBe(true);
    expect(hasMixedValues(targets.slice(0, 1), target => target.value)).toBe(false);
  });

  test('select uses a transient disabled Mixed option', () => {
    document.body.innerHTML = `
      <select id="choice">
        <option value="one">One</option>
        <option value="two">Two</option>
      </select>`;
    const select = document.getElementById('choice');

    setSelectMixed(select, true);
    expect(select.value).toBe(MIXED_OPTION_VALUE);
    expect(select.selectedOptions[0].textContent).toBe('Mixed');
    expect(select.selectedOptions[0].disabled).toBe(true);

    setSelectMixed(select, false);
    expect(select.querySelector('[data-mixed-option]')).toBeNull();
  });

  test('range and checkbox expose visible and native accessible mixed states', () => {
    document.body.innerHTML = `
      <div id="scope">
        <input id="amount" type="range" value="40">
        <span id="amount-value">40%</span>
        <input id="wait" type="checkbox" checked>
      </div>`;
    const scope = document.getElementById('scope');
    const range = document.getElementById('amount');
    const readout = document.getElementById('amount-value');
    const checkbox = document.getElementById('wait');

    setRangeMixed(range, readout, true);
    setCheckboxMixed(checkbox, true);
    expect(readout.textContent).toBe('Mixed');
    expect(range.getAttribute('aria-valuetext')).toBe('Mixed');
    expect(checkbox.indeterminate).toBe(true);
    expect(checkbox.getAttribute('aria-checked')).toBe('mixed');

    bindMixedControlReset(scope);
    const inputListener = vi.fn();
    range.addEventListener('input', inputListener);
    range.dispatchEvent(new Event('input', { bubbles: true }));
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(inputListener).toHaveBeenCalledOnce();
    expect(range.dataset.mixed).toBeUndefined();
    expect(range.getAttribute('aria-valuetext')).toBeNull();
    expect(checkbox.indeterminate).toBe(false);
  });
});
