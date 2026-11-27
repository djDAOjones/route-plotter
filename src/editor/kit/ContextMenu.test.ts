// CORE-06, chat G1b (brief 135; brief 130's CD): the kit's context menu in Node. Its keys (`menuStep`), where it stands
// in the window (`clampMenu`), and what its list draws through react-dom/server (roles, names, an item that is off and
// its reason, the separator). Focus, the closes and the stopped keys are the accessibility run's (point-menu).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { clampMenu, MENU_PAD, MenuList, menuStep } from './ContextMenu';

describe('the kit menu’s keys', () => {
  it('arrows move and wrap; Home and End go to the ends', () => {
    expect(menuStep('ArrowDown', 0, 5)).toEqual({ kind: 'focus', index: 1 });
    expect(menuStep('ArrowDown', 4, 5)).toEqual({ kind: 'focus', index: 0 });
    expect(menuStep('ArrowUp', 0, 5)).toEqual({ kind: 'focus', index: 4 });
    expect(menuStep('ArrowUp', 3, 5)).toEqual({ kind: 'focus', index: 2 });
    expect(menuStep('Home', 3, 5)).toEqual({ kind: 'focus', index: 0 });
    expect(menuStep('End', 1, 5)).toEqual({ kind: 'focus', index: 4 });
  });

  it('with focus on no item, ArrowDown goes to the first and ArrowUp to the last; Enter and Space choose nothing', () => {
    expect(menuStep('ArrowDown', -1, 5)).toEqual({ kind: 'focus', index: 0 });
    expect(menuStep('ArrowUp', -1, 5)).toEqual({ kind: 'focus', index: 4 });
    expect(menuStep('Enter', -1, 5)).toEqual({ kind: 'keep' });
    expect(menuStep(' ', -1, 5)).toEqual({ kind: 'keep' });
  });

  it('Enter and Space choose; Escape and Tab close; any other key is kept in the menu', () => {
    expect(menuStep('Enter', 2, 5)).toEqual({ kind: 'choose' });
    expect(menuStep(' ', 2, 5)).toEqual({ kind: 'choose' });
    expect(menuStep('Escape', 2, 5)).toEqual({ kind: 'close' });
    expect(menuStep('Tab', 2, 5)).toEqual({ kind: 'close' });
    for (const key of ['Delete', 'Backspace', 'ArrowLeft', 'a', 'F10']) expect(menuStep(key, 2, 5)).toEqual({ kind: 'keep' });
  });
});

describe('where the kit menu stands', () => {
  const view = { width: 1280, height: 800 };
  const size = { width: 200, height: 260 };
  it('at the place asked when it fits', () => {
    expect(clampMenu({ x: 300, y: 200 }, size, view)).toEqual({ left: 300, top: 200 });
  });
  it('moved in from the right and bottom edges, 8 px clear', () => {
    expect(clampMenu({ x: 1200, y: 700 }, size, view)).toEqual({ left: 1280 - 200 - MENU_PAD, top: 800 - 260 - MENU_PAD });
  });
  it('8 px in from the left and top, even when it is larger than the window', () => {
    expect(clampMenu({ x: -20, y: -5 }, size, view)).toEqual({ left: MENU_PAD, top: MENU_PAD });
    expect(clampMenu({ x: 100, y: 100 }, { width: 2000, height: 1000 }, view)).toEqual({ left: MENU_PAD, top: MENU_PAD });
  });
});

describe('what the kit menu draws', () => {
  const nothing = (): void => undefined;
  const items = [
    { label: 'Mark as start', reason: null, apart: false },
    { label: 'Set lead start', reason: 'This point is already where the lead starts.', apart: false },
    { label: 'Delete', reason: null, apart: true },
  ];
  const html = renderToStaticMarkup(createElement(MenuList, { label: 'Point actions', items, at: { x: 10, y: 20 }, opener: { current: null }, onChoose: nothing, onClose: nothing }));

  it('a menu named by its label, each item a menuitem named by its words in a wrapper of role none', () => {
    expect(html).toMatch(/<div[^>]*role="menu"[^>]*aria-label="Point actions"/);
    expect(html.match(/<div role="none"><button[^>]*role="menuitem"/g)).toHaveLength(3);
    for (const { label } of items) expect(html).toMatch(new RegExp(`role="menuitem"[^>]*aria-label="${label}"`));
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('an item that is off is aria-disabled, focusable, and described by its reason drawn inside it; one that is on is neither', () => {
    const off = /<button[^>]*aria-label="Set lead start"[^>]*aria-disabled="true"[^>]*aria-describedby="([^"]+)"[^>]*>(.*?)<\/button>/.exec(html);
    expect(off).not.toBeNull();
    expect(off?.[2]).toContain(`id="${off?.[1] ?? ''}"`);
    expect(off?.[2]).toContain('This point is already where the lead starts.');
    expect(html).toMatch(/<button[^>]*tabindex="-1"[^>]*aria-label="Set lead start"/);
    expect(html).not.toMatch(/aria-label="Mark as start"[^>]*aria-disabled/);
  });

  it('a separator before an item set apart, and only there', () => {
    expect(html.match(/role="separator"/g)).toHaveLength(1);
    expect(html).toMatch(/role="separator"[^>]*><\/div><div role="none"><button[^>]*aria-label="Delete"/);
  });
});
