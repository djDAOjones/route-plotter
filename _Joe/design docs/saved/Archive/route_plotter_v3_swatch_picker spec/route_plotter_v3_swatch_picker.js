/* Route Plotter v3 — Swatch Picker
   Vanilla JS, binds to existing <input type="color"> targets.

   Usage:
     import { attachSwatchPickers } from './route_plotter_v3_swatch_picker.js';
     attachSwatchPickers();

   Markup:
     <input id="dot-color" type="color" class="sr-only" value="#FF6B6B">
     <div class="swatch-picker" data-target-input="#dot-color" data-mode="okabe-ito" data-label="Marker colour" data-allow-custom="false"></div>
*/

function cssVarValue(varName) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || '';
}

function normalizeHex(hex) {
  if (!hex) return '';
  const h = hex.trim().toLowerCase();
  return h.startsWith('#') ? h : `#${h}`;
}

function nearestSwatchIndexByHex(swatches, hex) {
  // Simple match (exact) first. We avoid colour distance math to keep this tiny.
  const n = normalizeHex(hex);
  const idx = swatches.findIndex(s => normalizeHex(s.hex) === n);
  return idx;
}

function buildSwatches(mode) {
  if (mode === 'neutral-ink') {
    // These should be defined as tokens; fallback hard-coded if missing.
    const ink = cssVarValue('--map-ink') || '#111111';
    const paper = cssVarValue('--map-paper') || '#ffffff';
    const mid = cssVarValue('--map-mid') || '#6f6f6f';
    const soft = cssVarValue('--map-ink-soft') || '#525252';
    return [
      { id:'ink', label:'Ink', hex: ink, isYellow:false },
      { id:'soft', label:'Ink soft', hex: soft, isYellow:false },
      { id:'mid', label:'Mid grey', hex: mid, isYellow:false },
      { id:'paper', label:'White', hex: paper, isYellow:false },
    ];
  }

  // default okabe-ito
  const defs = [
    { id:'s1', var:'--map-series-1', label:'Blue' },
    { id:'s2', var:'--map-series-2', label:'Orange' },
    { id:'s3', var:'--map-series-3', label:'Bluish green' },
    { id:'s4', var:'--map-series-4', label:'Vermillion' },
    { id:'s5', var:'--map-series-5', label:'Reddish purple' },
    { id:'s6', var:'--map-series-6', label:'Sky blue' },
    { id:'s7', var:'--map-series-7', label:'Yellow' },
    { id:'s8', var:'--map-series-8', label:'Black' },
  ];

  return defs.map(d => {
    const hex = cssVarValue(d.var);
    return { id:d.id, label:d.label, hex: hex, isYellow: d.id === 's7' };
  });
}

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
  grid.className = 'swatch-grid';

  // Determine initial selection
  const initialHex = target.value;
  let initialIndex = nearestSwatchIndexByHex(swatches, initialHex);

  // If no match, we will leave none selected until user picks (or use first).
  if (initialIndex < 0) initialIndex = 0;

  swatches.forEach((s, i) => {
    const option = document.createElement('label');
    option.className = 'swatch-option';

    const radio = document.createElement('input');
    radio.className = 'swatch-radio';
    radio.type = 'radio';
    radio.name = groupName;
    radio.value = s.hex;
    radio.setAttribute('aria-label', s.label);

    if (i == initialIndex) radio.checked = true;

    const chip = document.createElement('span');
    chip.className = 'swatch-chip' + (s.isYellow ? ' is-yellow' : '');
    chip.style.background = s.hex || 'transparent';

    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      // Write into target <input type="color">
      // Ensure value is hex.
      target.value = normalizeHex(radio.value);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });

    option.appendChild(radio);
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

export function attachSwatchPickers(root = document) {
  const nodes = root.querySelectorAll('.swatch-picker[data-target-input]');
  nodes.forEach(createPicker);
}
