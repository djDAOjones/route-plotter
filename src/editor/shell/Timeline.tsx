// CORE-05, stage 5: the play bar's timeline (brief 65's ruling 5), v3's row (v3/index.html 1481 to 1486): a slider
// labelled "Timeline", 0 to 1000 step 1 (thousandths of the length), the time now before it and the whole time after
// it, its thumb reading out both ("0:01 of 0:02"). It is the kit's `SettingSlider` on the timeline's `Setting`
// (timelineLogic.ts), so a drag, a key and Escape follow the kit's rules; the two times are Carbon's own labels at the
// range's ends, handed the timeline's words. It is never switched off: v3's is not, and an empty scene has a length.
//
// It draws again whenever the words change, not only the thousandth held: within one thousandth of a long scene the
// time now can pass a whole second. Its look over Carbon's (timelineLook.css): a 44 px target round Carbon's knob
// (2.5.5), and a track that narrows to fit a 320 px page (1.4.10).
import { useCallback, useSyncExternalStore } from 'react';
import { SettingSlider } from '../kit/SettingSlider';
import { THOUSANDTHS, type Timeline as TimelineLogic } from './timelineLogic';
import './timelineLook.css';

export interface TimelineProps {
  /** The page's one timeline, made by the session. */
  readonly timeline: TimelineLogic;
}

/** The timeline's slider's id; its label is tied to it. */
const TIMELINE_ID = 'timeline';

export function Timeline({ timeline }: TimelineProps) {
  const { setting, readout, words } = timeline;
  const subscribe = useCallback((listener: () => void) => setting.subscribe(listener), [setting]);
  useSyncExternalStore(subscribe, words, words);
  return (
    <div className="timeline-look">
      <SettingSlider
        id={TIMELINE_ID}
        labelText="Timeline"
        setting={setting}
        min={0}
        max={THOUSANDTHS}
        step={1}
        readout={readout}
      />
    </div>
  );
}
