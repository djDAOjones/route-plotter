/**
 * Centralized help content for Route Plotter
 * 
 * This module provides a single source of truth for all help text displayed
 * in the application. Both the splash screen and the inline waypoint instructions
 * use this content, ensuring consistency and easy maintenance.
 * 
 * Content is derived from keybindings.js where possible for DRY compliance.
 * 
 * ## Carbon Pattern: Progressive Disclosure
 * - Splash: Brief sections + expandable full controls (accordion)
 * - Inline: Compact version + link to open splash
 * 
 * ## Usage
 * 
 * Import and call the appropriate function:
 * ```javascript
 * import { getInlineHelpHTML, getSplashHelpHTML } from './config/helpContent.js';
 * 
 * // For waypoint list placeholder (compact)
 * element.innerHTML = getInlineHelpHTML();
 * 
 * // For splash screen (full)
 * element.innerHTML = getSplashHelpHTML();
 * ```
 */

import { MODIFIER_DISPLAY, getBindingsByCategory } from './keybindings.js';

/**
 * Help sections with concise instructions
 * Each section has: id, title, items (array of strings)
 */
const HELP_SECTIONS = [
  {
    id: 'create',
    title: 'Create Your Route',
    items: [
      '<strong>Drag an image</strong> onto the canvas to get started',
      '<strong>Click</strong> the map to add waypoints',
      '<strong>Drag</strong> waypoints to reposition them'
    ]
  },
  {
    id: 'edit',
    title: 'Edit Points',
    items: [
      `<strong>${MODIFIER_DISPLAY.shift}+Click</strong> a waypoint to delete it`,
      `<strong>${MODIFIER_DISPLAY.meta}+Click</strong> to add a minor waypoint`,
      `<strong>${MODIFIER_DISPLAY.alt}+Click</strong> to force-add a major waypoint`,
      `<strong>${MODIFIER_DISPLAY.alt}+${MODIFIER_DISPLAY.meta}+Click</strong> to force-add a minor waypoint`,
      'Use the <strong>sidebar</strong> to adjust styles and timing'
    ]
  },
  {
    id: 'export',
    title: 'Preview & Export',
    items: [
      'Press <kbd>Space</kbd> to play/pause the animation',
      'Use <strong>Preview</strong> mode to hide controls',
      '<strong>Export Video</strong> when ready to share'
    ]
  }
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
 * Generate comprehensive controls accordion from keybindings config
 * Uses native <details>/<summary> for accessibility and efficiency
 * 
 * @returns {string} HTML string for accordion
 */
function renderControlsAccordion() {
  const categories = getBindingsByCategory({ includeHidden: false, includeMouse: true });
  
  const sectionsHTML = Object.entries(categories)
    .map(([catId, category]) => {
      if (category.bindings.length === 0) return '';
      
      const bindingsHTML = category.bindings
        .map(b => `<div class="control-item"><kbd>${b.formatted}</kbd><span>${b.description}</span></div>`)
        .join('\n');
      
      return `
        <div class="controls-category">
          <h4>${category.title}</h4>
          ${bindingsHTML}
        </div>`;
    })
    .filter(Boolean)
    .join('\n');
  
  return `
    <details class="controls-accordion">
      <summary>
        <span class="accordion-title">All Keyboard Shortcuts & Controls</span>
        <span class="accordion-hint">Click to expand</span>
      </summary>
      <div class="controls-content">
        ${sectionsHTML}
      </div>
    </details>`;
}

/**
 * Get HTML for inline help (waypoint list placeholder)
 * 
 * Compact version with link to open full help modal.
 * 
 * @returns {string} HTML string for inline help
 */
export function getInlineHelpHTML() {
  const essentials = [
    { key: 'Click', desc: 'Add waypoint' },
    { key: 'Drag', desc: 'Move waypoint' },
    { key: `${MODIFIER_DISPLAY.shift}+Click`, desc: 'Delete' },
    { key: 'Space', desc: 'Play/Pause' }
  ];
  
  const items = essentials
    .map(e => `<div class="inline-shortcut"><kbd>${e.key}</kbd><span>${e.desc}</span></div>`)
    .join('\n');
  
  return `
    <div class="waypoint-instructions">
      <h2>Quick Start</h2>
      <div class="inline-shortcuts">${items}</div>
      <button type="button" class="shortcuts-hint-btn" data-action="show-help">
        <kbd>?</kbd> View all controls
      </button>
    </div>
  `;
}

/**
 * Get HTML for splash screen help modal
 * 
 * Includes title, intro, sections, and expandable controls accordion.
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
      
      ${renderControlsAccordion()}
    </div>
  `;
}

/**
 * Get raw help sections data for custom rendering
 * 
 * @returns {Array} Array of section objects
 */
export function getHelpSections() {
  return HELP_SECTIONS;
}
