/**
 * Route Plotter v3 — Swatch Picker Component
 * 
 * Accessible colour picker using Okabe-Ito palette for map data.
 * Replaces native <input type="color"> controls with constrained swatches
 * that enforce colour-blind safe palettes.
 * 
 * Usage:
 *   import { attachSwatchPickers } from './components/SwatchPicker.js';
 *   attachSwatchPickers();
 * 
 * Markup:
 *   <input id="dot-color" type="color" class="sr-only" value="#0072B2">
 *   <div class="swatch-picker" 
 *        data-target-input="#dot-color" 
 *        data-mode="okabe-ito" 
 *        data-label="Marker colour" 
 *        data-allow-custom="false">
 *   </div>
 * 
 * @module SwatchPicker
 */

/**
 * Get computed CSS variable value from :root
 * @param {string} varName - CSS variable name (e.g., '--map-series-1')
 * @returns {string} The computed value or empty string
 */
function cssVarValue(varName) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || '';
}

/**
 * Normalize hex colour to lowercase with # prefix
 * @param {string} hex - Hex colour string
 * @returns {string} Normalized hex string
 */
function normalizeHex(hex) {
  if (!hex) return '';
  const h = hex.trim().toLowerCase();
  if (h === 'transparent') return 'transparent';
  return h.startsWith('#') ? h : `#${h}`;
}

/**
 * Find the index of the swatch that matches the given hex colour
 * @param {Array<{hex: string}>} swatches - Array of swatch objects
 * @param {string} hex - Hex colour to find
 * @returns {number} Index of matching swatch, or -1 if not found
 */
function nearestSwatchIndexByHex(swatches, hex) {
  const n = normalizeHex(hex);
  return swatches.findIndex(s => normalizeHex(s.hex) === n);
}

/**
 * Build swatch definitions based on mode
 * @param {string} mode - 'okabe-ito' or 'neutral-ink'
 * @returns {Array<{id: string, label: string, hex: string, isLight: boolean, isNone: boolean}>}
 */
function buildSwatches(mode) {
  if (mode === 'neutral-ink') {
    // Neutral ink palette for path heads
    const ink = cssVarValue('--map-ink') || '#111111';
    const paper = cssVarValue('--map-paper') || '#ffffff';
    const mid = cssVarValue('--map-mid') || '#6f6f6f';
    const soft = cssVarValue('--map-ink-soft') || '#595959';
    return [
      { id: 'ink', label: 'Ink', hex: ink, isLight: false },
      { id: 'soft', label: 'Ink soft', hex: soft, isLight: false },
      { id: 'mid', label: 'Mid grey', hex: mid, isLight: false },
      { id: 'paper', label: 'White', hex: paper, isLight: true },
    ];
  }

  // Default: Okabe-Ito colour-blind safe palette (10 swatches, 5×2 grid)
  // Row 1: warm (White → Reddish purple) | Row 2: Black, cool, None last
  const defs = [
    { id: 's0',   var: '--map-series-0',  label: 'White',          light: true,  none: false },
    { id: 's7',   var: '--map-series-7',  label: 'Yellow',         light: true,  none: false },
    { id: 's2',   var: '--map-series-2',  label: 'Orange',         light: false, none: false },
    { id: 's4',   var: '--map-series-4',  label: 'Vermillion',     light: false, none: false },
    { id: 's5',   var: '--map-series-5',  label: 'Reddish purple', light: false, none: false },
    { id: 's8',   var: '--map-series-8',  label: 'Black',          light: false, none: false },
    { id: 's6',   var: '--map-series-6',  label: 'Sky blue',       light: false, none: false },
    { id: 's1',   var: '--map-series-1',  label: 'Blue',           light: false, none: false },
    { id: 's3',   var: '--map-series-3',  label: 'Bluish green',   light: false, none: false },
    { id: 'none', var: null,              label: 'None',           light: true,  none: true },
  ];

  return defs.map(d => {
    const hex = d.var ? cssVarValue(d.var) : 'transparent';
    return { id: d.id, label: d.label, hex: hex, isLight: d.light, isNone: d.none };
  });
}

/**
 * Create a swatch picker for a container element
 * @param {HTMLElement} container - The .swatch-picker container
 */
function createPicker(container) {
  const targetSel = container.getAttribute('data-target-input');
  const mode = container.getAttribute('data-mode') || 'okabe-ito';
  const label = container.getAttribute('data-label') || 'Colour';
  const allowCustom = (container.getAttribute('data-allow-custom') || 'false') === 'true';

  if (!targetSel) return;
  const target = document.querySelector(targetSel);
  if (!target) return;

  const swatches = buildSwatches(mode);
  const groupName = `${target.id || 'swatch'}-group`;

  // Build fieldset
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'swatch-fieldset';

  const legend = document.createElement('legend');
  legend.className = 'swatch-legend';
  legend.textContent = label;

  const grid = document.createElement('div');
  grid.className = 'swatch-grid' + (mode === 'neutral-ink' ? ' swatch-grid-neutral' : '');

  // Determine initial selection
  const initialHex = target.value;
  let initialIndex = nearestSwatchIndexByHex(swatches, initialHex);

  // If no match, select first swatch
  if (initialIndex < 0) initialIndex = 0;

  swatches.forEach((s, i) => {
    const option = document.createElement('label');
    option.className = 'swatch-option';

    const radioId = `${groupName}-${i}`;
    const radio = document.createElement('input');
    radio.className = 'swatch-radio';
    radio.type = 'radio';
    radio.name = groupName;
    radio.id = radioId;
    radio.value = s.hex;
    option.setAttribute('for', radioId);
    if (i === initialIndex) radio.checked = true;

    const chip = document.createElement('span');
    chip.className = 'swatch-chip'
      + (s.isLight ? ' is-light' : '')
      + (s.isNone  ? ' is-none'  : '');
    chip.style.background = s.isNone ? '#fff' : (s.hex || 'transparent');

    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      // Write into target <input type="color">
      target.value = normalizeHex(radio.value);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Visually-hidden text gives the wrapping <label> text content (WAVE empty-label fix)
    const srText = document.createElement('span');
    srText.className = 'sr-only';
    srText.textContent = s.label;

    option.appendChild(radio);
    option.appendChild(srText);
    option.appendChild(chip);
    grid.appendChild(option);
  });

  fieldset.appendChild(legend);
  fieldset.appendChild(grid);

  // Optional: custom disclosure
  if (allowCustom) {
    const actions = document.createElement('div');
    actions.className = 'swatch-actions';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary btn-sm';
    btn.textContent = 'Custom…';
    btn.setAttribute('aria-expanded', 'false');

    const disclosure = document.createElement('div');
    disclosure.className = 'swatch-disclosure';
    disclosure.hidden = true;

    const custom = document.createElement('input');
    custom.type = 'color';
    custom.value = target.value || '#111111';

    custom.addEventListener('input', () => {
      target.value = normalizeHex(custom.value);
      target.dispatchEvent(new Event('input', { bubbles: true }));
    });
    custom.addEventListener('change', () => {
      target.value = normalizeHex(custom.value);
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });

    btn.addEventListener('click', () => {
      const open = !disclosure.hidden;
      disclosure.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
      if (!open) custom.focus();
    });

    actions.appendChild(btn);
    disclosure.appendChild(custom);

    fieldset.appendChild(actions);
    fieldset.appendChild(disclosure);
  }

  // Replace container contents
  container.innerHTML = '';
  container.appendChild(fieldset);

  // Keep chip selection in sync if external code changes the target value
  const sync = () => {
    const v = normalizeHex(target.value);
    const radios = container.querySelectorAll('input[type="radio"]');
    radios.forEach(r => {
      if (normalizeHex(r.value) === v) r.checked = true;
    });
  };
  target.addEventListener('input', sync);
  target.addEventListener('change', sync);
}

/**
 * Attach swatch pickers to all .swatch-picker elements in the document
 * @param {Document|HTMLElement} root - Root element to search within
 */
export function attachSwatchPickers(root = document) {
  const nodes = root.querySelectorAll('.swatch-picker[data-target-input]');
  nodes.forEach(createPicker);
}

/**
 * Refresh a specific swatch picker (e.g., after waypoint selection changes)
 * @param {string} targetInputSelector - Selector for the target input
 */
export function refreshSwatchPicker(targetInputSelector) {
  const target = document.querySelector(targetInputSelector);
  if (!target) return;
  
  const picker = document.querySelector(`.swatch-picker[data-target-input="${targetInputSelector}"]`);
  if (!picker) return;
  
  // Trigger sync by dispatching change event on target
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Enable or disable a swatch picker
 * @param {string} targetInputSelector - Selector for the target input
 * @param {boolean} enabled - Whether to enable or disable
 */
export function setSwatchPickerEnabled(targetInputSelector, enabled) {
  const picker = document.querySelector(`.swatch-picker[data-target-input="${targetInputSelector}"]`);
  if (!picker) return;
  
  const fieldset = picker.querySelector('.swatch-fieldset');
  if (fieldset) {
    fieldset.disabled = !enabled;
  }
}
