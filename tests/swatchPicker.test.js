import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  attachSwatchPickers,
  refreshSwatchPicker,
  setSwatchPickerEnabled,
  setSwatchPickerMixed,
} from '../src/components/SwatchPicker.js';

function mountPicker(value = '#1a1a1a') {
  document.documentElement.style.setProperty('--map-ink', '#111111');
  document.documentElement.style.setProperty('--map-ink-soft', '#595959');
  document.documentElement.style.setProperty('--map-mid', '#6f6f6f');
  document.documentElement.style.setProperty('--map-paper', '#ffffff');
  document.body.innerHTML = `
    <input type="hidden" id="colour" value="${value}">
    <div class="swatch-picker"
         data-target-input="#colour"
         data-mode="neutral-ink"
         data-label="Text colour"
         data-allow-custom="true"></div>
  `;
  attachSwatchPickers();
  return {
    target: document.getElementById('colour'),
    picker: document.querySelector('.swatch-picker'),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('SwatchPicker exact custom-value state', () => {
  test('does not falsely select a preset for an imported custom colour', () => {
    const { target, picker } = mountPicker();

    expect(picker.querySelectorAll('.swatch-radio:checked')).toHaveLength(0);
    expect(picker.querySelector('.swatch-current-text').textContent).toBe('Current #1A1A1A');
    expect(picker.querySelector('.swatch-disclosure input[type="color"]').value).toBe('#1a1a1a');

    target.value = '#111111';
    refreshSwatchPicker('#colour');
    expect(picker.querySelector('.swatch-radio:checked').value).toBe('#111111');

    target.value = '#abcdef';
    refreshSwatchPicker('#colour');
    expect(picker.querySelectorAll('.swatch-radio:checked')).toHaveLength(0);
    expect(picker.querySelector('.swatch-current-text').textContent).toBe('Current #ABCDEF');
    expect(picker.querySelector('.swatch-disclosure input[type="color"]').value).toBe('#abcdef');
  });

  test('custom input updates the exact target value and visible current state', () => {
    const { target, picker } = mountPicker('#111111');
    const inputListener = vi.fn();
    target.addEventListener('input', inputListener);
    const custom = picker.querySelector('.swatch-disclosure input[type="color"]');

    custom.value = '#123456';
    custom.dispatchEvent(new Event('input', { bubbles: true }));

    expect(target.value).toBe('#123456');
    expect(inputListener).toHaveBeenCalledOnce();
    expect(picker.querySelectorAll('.swatch-radio:checked')).toHaveLength(0);
    expect(picker.querySelector('.swatch-current-text').textContent).toBe('Current #123456');
  });

  test('major-only editor state disables the complete custom picker', () => {
    const { picker } = mountPicker();

    setSwatchPickerEnabled('#colour', false);
    expect(picker.querySelector('fieldset').disabled).toBe(true);

    setSwatchPickerEnabled('#colour', true);
    expect(picker.querySelector('fieldset').disabled).toBe(false);
  });

  test('mixed state clears every preset and never claims the source colour', () => {
    const { target, picker } = mountPicker('#111111');

    setSwatchPickerMixed('#colour', true);
    expect(target.value).toBe('#111111');
    expect(target.dataset.mixed).toBe('true');
    expect(picker.querySelectorAll('.swatch-radio:checked')).toHaveLength(0);
    expect(picker.querySelector('.swatch-mixed-state').hidden).toBe(false);
    expect(picker.querySelector('.swatch-current').hidden).toBe(true);

    // A refresh is presentation-only and must retain the mixed contract.
    refreshSwatchPicker('#colour');
    expect(picker.querySelectorAll('.swatch-radio:checked')).toHaveLength(0);

    const ink = [...picker.querySelectorAll('.swatch-radio')]
      .find(radio => radio.value === '#111111');
    ink.checked = true;
    ink.dispatchEvent(new Event('change', { bubbles: true }));
    expect(target.dataset.mixed).toBeUndefined();
    expect(picker.querySelector('.swatch-mixed-state').hidden).toBe(true);
    expect(picker.querySelector('.swatch-current').hidden).toBe(false);
  });
});
