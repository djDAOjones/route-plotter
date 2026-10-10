/**
 * Centralized help content for Route Plotter
 * 
 * This module provides a single source of truth for all help text displayed
 * in the application. The first-run welcome (the splash), the Help dialog and
 * the inline waypoint instructions use this content, ensuring consistency and
 * easy maintenance.
 * 
 * Content is derived from keybindings.js where possible for DRY compliance.
 * 
 * ## Carbon Pattern: Progressive Disclosure
 * - Welcome: brief sections, shown on the first start only
 * - Help: a dialog of its own, every shortcut open in a grid (UI-06 J-01)
 * - Inline: Compact version + link to open Help
 * 
 * ## Usage
 * 
 * Import and call the appropriate function:
 * ```javascript
 * import { getInlineHelpHTML, getSplashHelpHTML, getHelpDialogHTML } from './config/helpContent.js';
 * 
 * // For waypoint list placeholder (compact)
 * element.innerHTML = getInlineHelpHTML();
 * 
 * // For the welcome (brief)
 * element.innerHTML = getSplashHelpHTML();
 *
 * // For the Help dialog (the shortcuts grid, mouse and pen, crowds and networks)
 * element.innerHTML = getHelpDialogHTML();
 * ```
 */

import { MODIFIER_DISPLAY, getBindingsByCategory } from './keybindings.js';

/**
 * The lines the welcome and Help both say about the mouse: one string each,
 * so the two never drift apart.
 */
const MOUSE_LINES = {
  click: '<strong>Click</strong> the map to add waypoints',
  drag: '<strong>Drag</strong> waypoints to reposition them',
  shiftClick: `<strong>${MODIFIER_DISPLAY.shift}+Click</strong> a waypoint to delete it`,
  metaClick: `<strong>${MODIFIER_DISPLAY.meta}+Click</strong> to add a minor waypoint`,
  altClick: `<strong>${MODIFIER_DISPLAY.alt}+Click</strong> a major waypoint to start a branch; ` +
    `<strong>${MODIFIER_DISPLAY.alt}+Click</strong> empty map to add a major waypoint without selecting`,
  altMetaClick: `<strong>${MODIFIER_DISPLAY.alt}+${MODIFIER_DISPLAY.meta}+Click</strong> ` +
    'to add a minor waypoint without selecting'
};

/**
 * Help sections with concise instructions
 * Each section has: id, title, items (array of strings)
 */
const HELP_SECTIONS = [
  {
    id: 'create',
    title: 'Create your route',
    items: [
      '<strong>Drag an image</strong> onto the canvas to get started',
      MOUSE_LINES.click,
      MOUSE_LINES.drag
    ]
  },
  {
    id: 'edit',
    title: 'Edit points',
    items: [
      MOUSE_LINES.shiftClick,
      MOUSE_LINES.metaClick,
      MOUSE_LINES.altClick,
      MOUSE_LINES.altMetaClick,
      'Use the <strong>sidebar</strong> to adjust styles and timing'
    ]
  },
  {
    id: 'export',
    title: 'Preview and export',
    items: [
      'Press <kbd>Space</kbd> to play/pause the animation',
      'Use <strong>Preview</strong> mode to see the animation as it will export',
      '<strong>Export video</strong> when ready to share'
    ]
  }
];

/**
 * Help's "Mouse and pen": the canvas gestures, the context menu, and the
 * network pen's own keys and Shift-click (NetworkEditService, "Pen gestures").
 */
const MOUSE_AND_PEN = [
  MOUSE_LINES.click,
  MOUSE_LINES.drag,
  MOUSE_LINES.shiftClick,
  MOUSE_LINES.metaClick,
  MOUSE_LINES.altClick,
  '<strong>Right-click</strong> a waypoint or the map for a menu of actions',
  `While editing the network: <strong>${MODIFIER_DISPLAY.shift}+Click</strong> a node, path or bend to ` +
    'delete it; <kbd>T</kbd> changes the selected node\'s type; <kbd>Esc</kbd> lifts the pen'
];

/**
 * Help's "Crowds and networks": the owner's five lines (2026-10-09, "These
 * five lines (Recommended)"), shipped as written, one paragraph each; a bold
 * label is the control's own text (tests/uiStrings.test.js holds them to it).
 */
const CROWD_LINES = [
  'Under Layers, click <strong>+ Add crowd</strong>. Its Guide starts as Follow route, so the dots walk your route.',
  'A crowd\'s <strong>Guide</strong> is what its dots walk along: your route (Follow route) or a network of its ' +
    'own (Custom network).',
  'To draw a network, set the Guide to Custom network and click <strong>Edit network</strong>: nodes joined by ' +
    'paths.',
  '<strong>Trace route into network</strong> copies your route into the crowd\'s network, so it splits and ' +
    'rejoins where the route does.',
  '<strong>At journey end</strong> decides what a dot does when it finishes: Respawn at the start, Repeat journey, ' +
    'Disappear or Collect at the end. It is in the crowd\'s Motion card.'
];

/**
 * Render a help section as HTML
 * 
 * @param {Object} section - Section with title and items
 * @param {string} tag - Heading tag (h3)
 * @returns {string} HTML string
 */
function renderSection(section, tag = 'h3') {
  const items = section.items.map(item => `<li>${item}</li>`).join('\n');
  return `
    <section class="help-section">
      <${tag}>${section.title}</${tag}>
      <ul>${items}</ul>
    </section>`;
}

/**
 * Help's shortcuts grid, from the keybindings config, every category open
 * (UI-06 J-01: it was a <details> accordion under the welcome). Each row
 * carries its binding's id, so what is listed can be checked by identity;
 * hidden bindings are left out, as getBindingsByCategory leaves them.
 * 
 * @returns {string} HTML string for the grid
 */
function renderControlsGrid() {
  const categories = getBindingsByCategory({ includeHidden: false, includeMouse: true });
  
  const sectionsHTML = Object.entries(categories)
    .map(([catId, category]) => {
      if (category.bindings.length === 0) return '';
      
      const bindingsHTML = category.bindings
        .map(b => `<div class="control-item" data-binding-id="${b.id}"><kbd>${b.formatted}</kbd>` +
          `<span>${b.description}</span></div>`)
        .join('\n');
      
      return `
        <div class="controls-category">
          <h4>${category.title}</h4>
          ${bindingsHTML}
        </div>`;
    })
    .filter(Boolean)
    .join('\n');
  
  return `<div class="controls-grid">${sectionsHTML}</div>`;
}

/**
 * Get HTML for inline help (waypoint list placeholder)
 * 
 * Compact version with link to open Help.
 * 
 * @returns {string} HTML string for inline help
 */
export function getInlineHelpHTML() {
  const essentials = [
    { key: 'Click', desc: 'Add waypoint' },
    { key: 'Drag', desc: 'Move waypoint' },
    { key: `${MODIFIER_DISPLAY.shift}+Click`, desc: 'Delete' },
    { key: 'Space', desc: 'Play/pause' }
  ];
  
  const items = essentials
    .map(e => `<div class="inline-shortcut"><kbd>${e.key}</kbd><span>${e.desc}</span></div>`)
    .join('\n');
  
  return `
    <div class="waypoint-instructions">
      <h2>Quick start</h2>
      <div class="inline-shortcuts">${items}</div>
      <button type="button" class="shortcuts-hint-btn" data-action="show-help">
        <kbd>?</kbd> View all controls
      </button>
    </div>
  `;
}

/**
 * Get HTML for the first-run welcome (the splash)
 * 
 * Includes the intro and the three short sections; every shortcut is in
 * Help (UI-06 J-01).
 * 
 * @returns {string} HTML string for splash help
 */
export function getSplashHelpHTML() {
  const sectionsHTML = HELP_SECTIONS.map(s => renderSection(s, 'h3')).join('\n');
  
  return `
    <div class="splash-help">
      <p class="splash-intro">Create animated routes on maps or any image.</p>
      
      <div class="splash-sections">
        ${sectionsHTML}
      </div>
    </div>
  `;
}

/**
 * Get HTML for the Help dialog's sections before About: the shortcuts grid,
 * open; mouse and pen; crowds and networks. About and the dialog's buttons
 * are in index.html, as the welcome's licence line is.
 * 
 * @returns {string} HTML string for the Help dialog
 */
export function getHelpDialogHTML() {
  const mouse = MOUSE_AND_PEN.map(item => `<li>${item}</li>`).join('\n');
  const crowds = CROWD_LINES.map(line => `<p>${line}</p>`).join('\n');
  return `
    <section class="help-section" id="help-shortcuts">
      <h3>Keyboard shortcuts and controls</h3>
      ${renderControlsGrid()}
    </section>
    <section class="help-section" id="help-mouse">
      <h3>Mouse and pen</h3>
      <ul>${mouse}</ul>
    </section>
    <section class="help-section" id="help-crowds">
      <h3>Crowds and networks</h3>
      ${crowds}
    </section>`;
}

/**
 * Get raw help sections data for custom rendering
 * 
 * @returns {Array} Array of section objects
 */
export function getHelpSections() {
  return HELP_SECTIONS;
}
