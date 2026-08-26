/**
 * Transient DOM presentation for inspector controls whose selected model
 * targets do not share one value. Mixed state is never persisted.
 */

export const MIXED_OPTION_VALUE = '__mixed__';

/**
 * Whether two or more targets disagree after applying the control's reader.
 * @param {Array<unknown>} targets
 * @param {(target: unknown) => unknown} read
 * @returns {boolean}
 */
export function hasMixedValues(targets, read) {
  if (!Array.isArray(targets) || targets.length < 2) return false;
  const first = read(targets[0]);
  return targets.slice(1).some(target => !Object.is(read(target), first));
}

/** @param {HTMLSelectElement|null|undefined} select @param {boolean} mixed */
export function setSelectMixed(select, mixed) {
  if (!select) return;
  let option = select.querySelector(`option[data-mixed-option="true"]`);
  if (mixed) {
    if (!option) {
      option = document.createElement('option');
      option.value = MIXED_OPTION_VALUE;
      option.textContent = 'Mixed';
      option.disabled = true;
      option.dataset.mixedOption = 'true';
      select.prepend(option);
    }
    option.selected = true;
    select.dataset.mixed = 'true';
    return;
  }
  option?.remove();
  delete select.dataset.mixed;
}

/**
 * Keep the range thumb usable as an edit starting point while replacing every
 * value claim an author or assistive technology encounters.
 * @param {HTMLInputElement|null|undefined} range
 * @param {HTMLElement|null|undefined} readout
 * @param {boolean} mixed
 */
export function setRangeMixed(range, readout, mixed) {
  if (!range) return;
  if (mixed) {
    range.dataset.mixed = 'true';
    range.setAttribute('aria-valuetext', 'Mixed');
    if (readout) readout.textContent = 'Mixed';
    return;
  }
  delete range.dataset.mixed;
  if (range.getAttribute('aria-valuetext') === 'Mixed') {
    range.removeAttribute('aria-valuetext');
  }
}

/** @param {HTMLInputElement|null|undefined} checkbox @param {boolean} mixed */
export function setCheckboxMixed(checkbox, mixed) {
  if (!checkbox) return;
  checkbox.indeterminate = mixed;
  if (mixed) {
    checkbox.dataset.mixed = 'true';
    checkbox.setAttribute('aria-checked', 'mixed');
  } else {
    delete checkbox.dataset.mixed;
    if (checkbox.getAttribute('aria-checked') === 'mixed') {
      checkbox.removeAttribute('aria-checked');
    }
  }
}

/**
 * Clear transient state before a real user edit replaces it. The control's
 * ordinary input/change owner remains responsible for its new readout.
 * @param {EventTarget|null} control
 */
export function clearControlMixedState(control) {
  if (!(control instanceof HTMLElement) || control.dataset.mixed !== 'true') return;
  if (control instanceof HTMLSelectElement) setSelectMixed(control, false);
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    setCheckboxMixed(control, false);
  }
  if (control instanceof HTMLInputElement && control.type === 'range') {
    setRangeMixed(control, null, false);
  }
  delete control.dataset.mixed;
}

/**
 * One capture-phase listener clears mixed state before the existing target
 * handlers read and apply the replacement value.
 * @param {HTMLElement|null|undefined} root
 */
export function bindMixedControlReset(root) {
  if (!root || root.dataset.mixedResetBound === 'true') return;
  const clear = event => clearControlMixedState(event.target);
  root.addEventListener('input', clear, true);
  root.addEventListener('change', clear, true);
  root.dataset.mixedResetBound = 'true';
}
