/**
 * REV-05 — the structural half of the accessibility audit, kept as a
 * regression guard.
 *
 * These are the checks a static analysis can actually settle: every control
 * has an accessible name, ids are unique, the heading order is sound, the
 * landmarks and language are declared, and the two AAA rules that the live
 * pass caught being broken stay fixed. Contrast measurement, reflow and
 * screen-reader behaviour need a real browser or a real person; those are
 * recorded as evidence on the ticket rather than faked here, because a jsdom
 * "pass" on any of them would be worth less than nothing.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect, beforeEach } from 'vitest';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const mainCss = readFileSync(resolve(process.cwd(), 'styles/main.css'), 'utf8');

/**
 * Every `@media (forced-colors: active)` block's body, brace-matched rather
 * than regex-matched — nested rule braces defeat a pattern.
 * @param {string} css
 * @returns {string[]}
 */
function forcedColourBlocks(css) {
  const blocks = [];
  const opener = /@media\s*\(forced-colors:\s*active\)\s*\{/g;
  let match;
  while ((match = opener.exec(css)) !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') depth -= 1;
      index += 1;
    }
    blocks.push(css.slice(start, index - 1));
  }
  return blocks;
}

/** Only elements that are not inside a hidden container. */
function isPresented(element) {
  let node = element;
  while (node && node !== document.body) {
    if (node.hasAttribute?.('hidden')) return false;
    if (node.getAttribute?.('aria-hidden') === 'true') return false;
    node = node.parentElement;
  }
  return true;
}

describe('the app shell’s accessibility structure', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = indexHtml
      .replace(/<!DOCTYPE[^>]*>/i, '')
      .replace(/<\/?html[^>]*>/gi, '');
  });

  test('every id is unique', () => {
    const seen = new Set();
    const duplicates = [];
    for (const element of document.querySelectorAll('[id]')) {
      if (seen.has(element.id)) duplicates.push(element.id);
      seen.add(element.id);
    }

    expect(duplicates).toEqual([]);
  });

  test('every form control is labelled', () => {
    const unlabelled = [...document.querySelectorAll('input,select,textarea')]
      .filter(isPresented)
      .filter(control => control.type !== 'hidden')
      .filter(control => !(
        control.getAttribute('aria-label')
        || control.getAttribute('aria-labelledby')
        || control.getAttribute('title')
        || document.querySelector(`label[for="${control.id}"]`)
        || control.closest('label')
      ))
      .map(control => `${control.tagName}#${control.id || '(no id)'}`);

    expect(unlabelled).toEqual([]);
  });

  test('every button has an accessible name', () => {
    const nameless = [...document.querySelectorAll('button')]
      .filter(isPresented)
      .filter(button => !(
        button.textContent.trim()
        || button.getAttribute('aria-label')
        || button.getAttribute('aria-labelledby')
        || button.getAttribute('title')
      ))
      .map(button => `button#${button.id || '(no id)'}`);

    expect(nameless).toEqual([]);
  });

  test('the document declares its language and a single h1', () => {
    // The shell is re-parsed without <html>, so read lang off the source.
    expect(indexHtml).toMatch(/<html[^>]*\blang="en"/i);
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });

  test('heading levels never skip a rank', () => {
    const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(isPresented)
      .map(heading => Number(heading.tagName[1]));
    const skips = levels
      .map((level, index) => (index > 0 && level - levels[index - 1] > 1
        ? `${levels[index - 1]}→${level}` : null))
      .filter(Boolean);

    expect(skips).toEqual([]);
  });

  test('the page has a main landmark and skip links into it', () => {
    expect(document.querySelectorAll('main,[role="main"]').length).toBeGreaterThan(0);
    const skipLinks = [...document.querySelectorAll('.skip-link')];
    expect(skipLinks.length).toBeGreaterThan(0);
    for (const link of skipLinks) {
      expect(link.getAttribute('href')).toMatch(/^#./);
      expect(link.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  test('every image carries alt text', () => {
    const missing = [...document.querySelectorAll('img')]
      .filter(image => image.getAttribute('alt') === null)
      .map(image => image.getAttribute('src'));

    expect(missing).toEqual([]);
  });

  test('the live region for announcements exists and is polite', () => {
    const announcer = document.getElementById('announcer');

    expect(announcer).not.toBeNull();
    expect(announcer.getAttribute('aria-live')).toBe('polite');
  });
});

describe('the two AAA rules the live audit caught', () => {
  test('the skip link fills a 44px target', () => {
    // It was 37px tall, and it is the first thing a keyboard or switch user
    // reaches (WCAG 2.5.5, REV-05).
    const rule = mainCss.match(/\.skip-link\{[^}]*\}/s);

    expect(rule).not.toBeNull();
    expect(rule[0]).toContain('min-height:var(--control-lg)');
  });

  test('the Edit/Preview label does not use the white-only text token', () => {
    // --text-03 is exactly 7:1 on white; this label sits on --ui-02, where it
    // measured 6.37:1 — under AAA for text this size.
    const rule = mainCss.match(/\.mode-label\{[^}]*\}/s);

    expect(rule).not.toBeNull();
    expect(rule[0]).toContain('color:var(--text-02)');
    expect(rule[0]).not.toContain('color:var(--text-03)');
  });
});

describe('the motion and forced-colours contracts are declared', () => {
  test('reduced motion is honoured', () => {
    expect(mainCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  test('the affordances that declare forced-colours fallbacks keep them', () => {
    // Only the row affordances added under UI-02 and ROUTE-01c declare these.
    // The rest of the UI has none — recorded as A11Y-02, not asserted here,
    // because a count that implied wider coverage would be a false green.
    const blocks = forcedColourBlocks(mainCss).join('\n');

    for (const selector of [
      '.waypoint-item-minor::after',
      '.waypoint-minor-dot',
      '.waypoint-minor-tag',
      '.waypoint-item-branch',
      '.waypoint-fork-mark',
    ]) {
      expect(blocks).toContain(selector);
    }
  });
});
