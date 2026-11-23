// CORE-05, stage 4: a slider on Carbon's own `Slider`, thin over the kit's logic (controls.ts). It turns what Carbon
// sends into the logic's calls and draws the position the logic gives; every rule about values is the logic's.
//
// Carbon never says a drag has started, and reports every change of its thumb through `onChange`, whatever the cause:
// a drag's move, an arrow key, or the echo of a new `value` prop, which comes two passes after the prop and so may
// come after the value held has moved on (End then Home with no gap; the frames of a playing; brief 79). So the
// pointer going down on Carbon's own slider element is caught here, before Carbon sees it, as the logic's `press()`;
// each draw in which the `value` prop changes is told to the logic as `handed()`, and each new Carbon slider as
// `drawn()`, before Carbon's effects run; Carbon's `onChange` is the logic's `report()`, which tells the echo by the
// positions handed and not yet said back and by the position held, and a drag's move from a key's nudge by the press;
// and its `onRelease` is `release()`. Escape during a drag, and a touch cancelled, give the drag up (`giveUp()`); the moves, any
// further press (a second finger) and the release Carbon still sends until the pointer is let go then change nothing
// (a press while one is down is nothing until its release, even after a give-up). Escape is caught on its way down,
// before Carbon sees it: the thumb's tooltip, open while it has the pointer or focus, takes Escape and stops it
// (Tooltip.js 77), so a drag would not be given up (seen on the page, brief 66). With no drag, Escape goes on to the
// tooltip, which it hides. Carbon's own text input is hidden: the kit's number field is the one place a number is
// typed (D181).
//
// Carbon's slider takes only the arrows (and Shift with them); Home, End, Page Up and Page Down are the kit's (the
// claim's point 5, controls.ts; D193). Caught with Escape on the way down, on the thumb only and with no Control, Alt or
// Meta held, each is the rule's position (`sliderKeyMove`) given as a key's nudge, an edit of one; while the pointer is
// down (`pressed()`), given up or not, it moves nothing. Its default is cancelled either way, so the page does not
// scroll under the slider; it still travels on, and the page's listener runs nothing for a key whose default is
// cancelled (dispatch.ts, point 1). After a key that moved, Carbon's slider is drawn again from what is held, focus
// kept, rather than left to follow its `value` prop: Carbon follows a prop by setting its own state and then reporting
// it, so two keys in one frame left it reporting the first key's position after the second's was held, which read as a
// new nudge, and the two answered each other until React gave up (seen on the page, brief 67). A new Carbon slider
// starts at the position held and reports nothing.
//
// Carbon keeps a thumb position of its own, brought into step only when its `value` prop changes. Where a report is
// refused or changes nothing held (another change in progress; the model's check; a drag given up; an echo of an older
// position), its thumb would stay where it was left; so the slider is drawn again from what is held, and keeps the
// focus it had, but not during a press, and only when the logic says the thumb stands off the position last handed or
// drawn with nothing awaited (`standsOff()`), never by reading the value held: a late echo of a playing on a slow page
// comes after the value held has moved on and before the draw that hands it, and a draw on each such echo would take
// the focus and the thumb's tooltip away frame by frame (48 new Carbon sliders in one slowed playing, brief 80). The slider
// is drawn again whenever the value held changes, not only its position: on a scale, two values can stand at one
// position and read out differently.
import { Slider, usePrefix } from '@carbon/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';
import { createSlider, IDENTITY, sliderKeyMove, type Result, type Scale, type Setting } from './controls';
import { formatUIValue } from './sliderScales';

export interface SettingSliderProps {
  /** The slider's id; its label is tied to it. */
  readonly id: string;
  /** The visible label. */
  readonly labelText: string;
  /** The setting it shows and edits, made by the shell (src/editor/shell/settings.ts). */
  readonly setting: Setting;
  /** The thumb's range and step, as positions on `scale`. */
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Written after the readout's number, as in "%". */
  readonly unit?: string;
  /**
   * Words read out in place of a number and `unit`, when given: for a thumb at `value` (its `aria-valuetext` and
   * tooltip), and, with `end`, what the label at that end of the range shows, `value` then being the value held.
   * Without it, the readout is the number and the unit, and each end's label the value there.
   */
  readonly readout?: (value: number, end?: 'start' | 'end') => string;
  /** How a position stands for a value; the identity by default. Keep it a constant: a new one gives up a drag. */
  readonly scale?: Scale;
}

/** A slider for one setting that holds a number; nothing is drawn while the setting holds none. */
export function SettingSlider({
  id,
  labelText,
  setting,
  min,
  max,
  step,
  unit = '',
  scale = IDENTITY,
  readout,
}: SettingSliderProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  // A new logic (a new setting or scale) gets a new Carbon slider, so the two lifetimes agree: `drawn()` is true each
  // time it is said, and no report an old Carbon slider still owes can reach a new logic (brief 79, Codex's finding).
  // The logic's `life` is part of Carbon's key, made anew while rendering (React's pattern for state that follows a
  // prop). The focus is kept: `inside` follows focus events, and a new Carbon slider takes the focus back only when it
  // was inside and nothing else has it now (Chromium's focusout on a removed element has no related element, so a
  // move of focus to nowhere before the change also counts as inside; that is the cost).
  const [owned, own] = useState(() => ({ setting, scale, slider: createSlider(setting, scale), life: 0 }));
  let current = owned;
  if (owned.setting !== setting || owned.scale !== scale) {
    current = { setting, scale, slider: createSlider(setting, scale), life: owned.life + 1 };
    own(current);
  }
  const { slider, life } = current;
  const inside = useRef(false);
  const lifeSeen = useRef(life);
  useLayoutEffect(() => {
    if (lifeSeen.current === life) return;
    lifeSeen.current = life;
    const element = wrapper.current;
    const at = element?.ownerDocument.activeElement;
    if (inside.current && (at === null || at === undefined || at === element?.ownerDocument.body)) {
      element?.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true });
    }
  }, [life]);
  useEffect(
    () => () => {
      slider.giveUp();
      slider.release();
    },
    [slider],
  );
  const subscribe = useCallback((listener: () => void) => setting.subscribe(listener), [setting]);
  const read = useCallback(() => setting.read(), [setting]);
  const held = useSyncExternalStore(subscribe, read, read);
  const position = held === undefined ? undefined : scale.toPosition(held);

  const prefix = usePrefix();
  const [drawing, drawAgain] = useState(0);
  /** What the logic was last told: which slider, which Carbon slider (`drawing`), and the position handed. */
  const told = useRef<{ slider: typeof slider; drawing: number; position: number | undefined } | null>(null);
  // A layout effect, so the logic hears of a new position before Carbon's own effects follow it and report it. A new
  // Carbon slider (the first draw, a draw again, a new logic, one drawn after none) stands where it is drawn.
  useLayoutEffect(() => {
    const last = told.current;
    told.current = { slider, drawing, position };
    if (position === undefined) return;
    if (last === null || last.slider !== slider || last.drawing !== drawing || last.position === undefined) {
      slider.drawn(position);
    } else if (last.position !== position) slider.handed(position);
  }, [slider, drawing, position]);

  /**
   * Draws Carbon's slider again from what is held when its thumb stands elsewhere and nothing else will move it: after a
   * report that changed nothing held (one that did changes the `value` prop, which Carbon follows), and at a release.
   */
  const bringIntoStep = (result: Result | 'released') => {
    if (result !== 'released' && result.ok && result.changed) return;
    if (slider.pressed() || !slider.standsOff()) return;
    drawFromHeld();
  };
  /** Draws a new Carbon slider from what is held, the focus kept where it was. */
  const drawFromHeld = () => {
    const element = wrapper.current;
    refocus.current = element !== null && element.contains(element.ownerDocument.activeElement);
    drawAgain((n) => n + 1);
  };
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    wrapper.current?.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true });
  }, [drawing]);

  const onPress = (event: SyntheticEvent) => {
    if (event.target instanceof Element && event.target.closest(`.${prefix}--slider`) !== null) slider.press();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (!slider.dragging()) return;
      slider.giveUp();
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    const at = slider.position();
    if (at === undefined || !(event.target instanceof Element) || !event.target.matches('[role="slider"]')) return;
    const move = sliderKeyMove(event, at, { min, max, step }, slider.pressed());
    if (!move.taken) return;
    event.preventDefault();
    if (move.to === null) return;
    slider.nudge(scale.toValue(move.to));
    drawFromHeld();
  };

  if (held === undefined || position === undefined) return null;
  // Carbon draws `formatLabel(min, minLabel)` and `formatLabel(max, maxLabel)` at the range's ends and
  // `formatLabel(value, undefined)` on the thumb: given words, the ends are handed theirs as Carbon's own labels.
  const words =
    readout === undefined
      ? { formatLabel: (at: number) => formatUIValue(slider.readout(at), unit) }
      : {
          formatLabel: (at: number, label: string | undefined) => label ?? readout(slider.readout(at)),
          minLabel: readout(held, 'start'),
          maxLabel: readout(held, 'end'),
        };
  return (
    // Presentation only: it catches the events Carbon's own slider receives, and is no control of its own.
    <div
      ref={wrapper}
      role="presentation"
      onMouseDownCapture={onPress}
      onTouchStartCapture={onPress}
      onTouchCancel={() => slider.giveUp()}
      onKeyDownCapture={onKeyDown}
      onFocusCapture={() => {
        inside.current = true;
      }}
      onBlurCapture={(event) => {
        const to = event.relatedTarget;
        if (to instanceof Node) inside.current = wrapper.current?.contains(to) ?? false;
      }}
    >
      <Slider
        key={`${String(life)}.${String(drawing)}`}
        id={id}
        labelText={labelText}
        hideTextInput
        min={min}
        max={max}
        step={step}
        value={position}
        {...words}
        onChange={({ value }) => {
          bringIntoStep(slider.report(value));
        }}
        onRelease={() => {
          slider.release();
          bringIntoStep('released');
        }}
      />
    </div>
  );
}
