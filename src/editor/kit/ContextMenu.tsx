// CORE-06, chat G1b (brief 135; brief 130's CD, built as HANDOVER-130's plan; D267 (a), provisional until the owner
// answers): the kit's context menu, a list of items shown at a place on the page, after v3's
// v3/src/components/ContextMenu.js (Carbon's `Menu` is ruled out: PROBE-130/carbon-menu-probe.md). Its claim:
// 1. It is drawn in a portal into `document.body`, outside the preview's set-aside box (tests/a11y/helpers.ts 326 to
//    328: a control's graphic inside `.preview` fails that row), fixed at the place handed (client pixels) and clamped
//    to the window, 8 px in from each edge (`clampMenu`), before it is painted.
// 2. Roles: a `menu` named by its `label`; each item a `menuitem` button in a wrapper of role `none` (divs: the lint's strict set refuses `menu` on a list), named by its words
//    (`aria-label`); an item set apart has a `separator` before it. An item with a reason is off: `aria-disabled`, still
//    focusable, its reason a visible line inside it that describes it (`aria-describedby`), as v3's.
// 3. Focus moves to the first item when it opens. The keys (`menuStep`): ArrowDown and ArrowUp move and wrap, Home and
//    End go to the first and last, Enter and Space choose the focused item, Escape and Tab close it. Choosing an item
//    that is on hands it to `onChoose` and closes; one that is off does nothing and the menu stays open (v3 lines 69 to
//    72). Every keydown inside is stopped there, by a listener on the menu itself, so none reaches the editor's
//    listener on `document` (keydown.ts: else its Delete or arrows would act on the selection under the menu).
// 4. A pointer press outside it, the window's blur, a scroll anywhere and a resize close it (v3 lines 105 to 110). On
//    every close with focus inside the menu, focus goes back to `opener` (the preview box), so Escape and Tab leave
//    focus where the menu was opened from; a press outside then moves focus as that press would.
// 5. While it is open, the browser's own menu is refused on it and on its opener (a keyboard ContextMenu key may fire
//    one there after the key opened this one).
import { Fragment, useEffect, useId, useLayoutEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import './menuLook.css';

/** What the menu shows of an item. */
export interface ContextMenuItem {
  /** The item's words, its name. */
  readonly label: string;
  /** Why it is off; null when it is on. */
  readonly reason: string | null;
  /** Whether a separator stands before it. */
  readonly apart: boolean;
}

/** What a key does in the menu (point 3). */
export type MenuStep =
  | { readonly kind: 'focus'; readonly index: number }
  | { readonly kind: 'choose' }
  | { readonly kind: 'close' }
  | { readonly kind: 'keep' };

/** What `key` does with focus on item `index` (-1: on none) of `count` (point 3). */
export function menuStep(key: string, index: number, count: number): MenuStep {
  if (key === 'Escape' || key === 'Tab') return { kind: 'close' };
  if (count === 0) return { kind: 'keep' };
  if (key === 'ArrowDown') return { kind: 'focus', index: index < 0 ? 0 : (index + 1) % count };
  if (key === 'ArrowUp') return { kind: 'focus', index: index < 0 ? count - 1 : (index - 1 + count) % count };
  if (key === 'Home') return { kind: 'focus', index: 0 };
  if (key === 'End') return { kind: 'focus', index: count - 1 };
  if ((key === 'Enter' || key === ' ') && index >= 0) return { kind: 'choose' };
  return { kind: 'keep' };
}

/** How far in from the window's edges the menu stays (point 1). */
export const MENU_PAD = 8;

/** Where a menu of `size` asked for at `at` stands in a window of `view` (point 1), as v3 placed it. */
export function clampMenu(
  at: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number },
  view: { readonly width: number; readonly height: number },
): { readonly left: number; readonly top: number } {
  return {
    left: Math.max(MENU_PAD, Math.min(at.x, view.width - size.width - MENU_PAD)),
    top: Math.max(MENU_PAD, Math.min(at.y, view.height - size.height - MENU_PAD)),
  };
}

export interface ContextMenuProps<I extends ContextMenuItem> {
  /** The menu's name. */
  readonly label: string;
  readonly items: readonly I[];
  /** Where it opens, in client pixels. */
  readonly at: { readonly x: number; readonly y: number };
  /** Where focus goes back to when it closes (point 4). */
  readonly opener: RefObject<HTMLElement | null>;
  /** An item that is on, chosen; the menu then asks to close. */
  readonly onChoose: (item: I) => void;
  /** The menu asks to close. */
  readonly onClose: () => void;
}

/** The menu's list itself, drawn where it is put (the portal is `ContextMenu`'s). */
export function MenuList<I extends ContextMenuItem>({ label, items, at, opener, onChoose, onClose }: ContextMenuProps<I>) {
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  // Placed inside the window and focused on its first item before it is painted (points 1, 3).
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const { left, top } = clampMenu(at, rect, { width: window.innerWidth, height: window.innerHeight });
    element.style.left = `${String(left)}px`;
    element.style.top = `${String(top)}px`;
    element.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [at]);

  useEffect(() => {
    const element = list.current;
    if (!element) return undefined;
    const buttons = () => [...element.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const close = () => {
      const inside = element.contains(document.activeElement);
      onClose();
      if (inside) opener.current?.focus();
    };
    const choose = (index: number) => {
      const item = items[index];
      if (item === undefined || item.reason !== null) return;
      opener.current?.focus();
      onChoose(item);
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation();
      const all = buttons();
      const index = all.findIndex((each) => each === document.activeElement);
      const step = menuStep(event.key, index, all.length);
      if (step.kind === 'keep') return;
      event.preventDefault();
      if (step.kind === 'focus') all[step.index]?.focus();
      else if (step.kind === 'choose') choose(index);
      else close();
    };
    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[role="menuitem"]') : null;
      if (button) choose(buttons().indexOf(button));
    };
    const onOutside = (event: Event) => {
      if (!(event.target instanceof Node) || !element.contains(event.target)) close();
    };
    const onOwnMenu = (event: Event) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target !== null && (element.contains(target) || opener.current?.contains(target) === true)) event.preventDefault();
    };
    element.addEventListener('keydown', onKey);
    element.addEventListener('click', onClick);
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('contextmenu', onOwnMenu, true);
    window.addEventListener('blur', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      element.removeEventListener('keydown', onKey);
      element.removeEventListener('click', onClick);
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('contextmenu', onOwnMenu, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [items, opener, onChoose, onClose]);

  return (
    <div ref={list} role="menu" aria-label={label} className="kit-menu" style={{ left: at.x, top: at.y }}>
      {items.map((item, i) => {
        const reason = item.reason === null ? undefined : `${id}-reason-${String(i)}`;
        return (
          <Fragment key={`${String(i)} ${item.label}`}>
            {item.apart && <div role="separator" className="kit-menu__apart" />}
            <div role="none">
              <button type="button" role="menuitem" tabIndex={-1} className="kit-menu__item" aria-label={item.label} aria-disabled={reason === undefined ? undefined : true} aria-describedby={reason}>
                <span className="kit-menu__label">{item.label}</span>
                {reason !== undefined && <span id={reason} className="kit-menu__reason">{item.reason}</span>}
              </button>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/** The menu, drawn in a portal into `document.body` (point 1). */
export function ContextMenu<I extends ContextMenuItem>(props: ContextMenuProps<I>) {
  return createPortal(<MenuList {...props} />, document.body);
}
