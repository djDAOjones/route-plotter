// CORE-05, stage 4: a slider on Carbon's own `Slider`, thin over the kit's logic (controls.ts). It turns what Carbon
// sends into the logic's calls and draws the position the logic gives; every rule about values is the logic's.
//
// Carbon never says a drag has started, and reports every change of its thumb through `onChange`, whatever the cause:
// a drag's move, an arrow key, or the echo of a new `value` prop. So the pointer going down on Carbon's own slider
// element is caught here, before Carbon sees it, as the logic's `press()`; Carbon's `onChange` is the logic's
// `report()`, which tells a drag's move from a key's nudge by the press, and the echo by the position held; and its
// `onRelease` is `release()`. Escape during a drag, and a touch cancelled, give the drag up (`giveUp()`); the moves and
// the release Carbon still sends until the pointer is let go then change nothing. Carbon's own text input is hidden:
// the kit's number field is the one place a number is typed (D181).
//
// Carbon keeps a thumb position of its own, brought into step only when its `value` prop changes. Where a report is
// refused or changes nothing held (another change in progress; the model's check; a drag given up), its thumb would stay
// where the user left it; so the slider is drawn again from what is held, and keeps the focus it had.
import { Slider, usePrefix } from '@carbon/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';
import { createSlider, IDENTITY, type Result, type Scale, type Setting } from './controls';
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
  /** How a position stands for a value; the identity by default. */
  readonly scale?: Scale;
}

/** A slider for one setting that holds a number; nothing is drawn while the setting holds none. */
export function SettingSlider({ id, labelText, setting, min, max, step, unit = '', scale = IDENTITY }: SettingSliderProps) {
  const slider = useMemo(() => createSlider(setting, scale), [setting, scale]);
  useEffect(
    () => () => {
      slider.giveUp();
      slider.release();
    },
    [slider],
  );
  const subscribe = useCallback((listener: () => void) => setting.subscribe(listener), [setting]);
  const read = useCallback(() => slider.position(), [slider]);
  const position = useSyncExternalStore(subscribe, read, read);

  const prefix = usePrefix();
  const wrapper = useRef<HTMLDivElement>(null);
  /** Where Carbon's thumb stands, as it last said; undefined until it has said. */
  const thumb = useRef<number | undefined>(undefined);
  const refocus = useRef(false);
  const [drawing, drawAgain] = useState(0);

  /**
   * Draws Carbon's slider again from what is held when its thumb stands elsewhere and nothing else will move it: after a
   * report that changed nothing held (one that did changes the `value` prop, which Carbon follows), and at a release.
   */
  const bringIntoStep = (result: Result | 'released') => {
    if (result !== 'released' && result.ok && result.changed) return;
    if (slider.pressed() || thumb.current === undefined || thumb.current === slider.position()) return;
    const element = wrapper.current;
    refocus.current = element !== null && element.contains(element.ownerDocument.activeElement);
    thumb.current = undefined;
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
    if (event.key !== 'Escape' || !slider.dragging()) return;
    slider.giveUp();
    event.stopPropagation();
    event.preventDefault();
  };

  if (position === undefined) return null;
  return (
    // Presentation only: it catches the events Carbon's own slider receives, and is no control of its own.
    <div
      ref={wrapper}
      role="presentation"
      onMouseDownCapture={onPress}
      onTouchStartCapture={onPress}
      onTouchCancel={() => slider.giveUp()}
      onKeyDown={onKeyDown}
    >
      <Slider
        key={drawing}
        id={id}
        labelText={labelText}
        hideTextInput
        min={min}
        max={max}
        step={step}
        value={position}
        formatLabel={(at) => formatUIValue(slider.readout(at), unit)}
        onChange={({ value }) => {
          thumb.current = value;
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
