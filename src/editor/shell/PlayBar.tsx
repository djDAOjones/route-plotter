// CORE-05, stage 5: the play bar's three buttons (brief 63's rulings 5 and 6), v3's order (v3/index.html 1474 to
// 1491): "Skip to start"; one button reading "Play" while nothing plays and "Pause" while it plays (one element, so
// focus stays on it when its words change; no `aria-pressed`); "Skip to end". Carbon buttons with their words visible,
// no icon-only button (Carbon's icon button brings a tooltip: content on hover and focus, and it takes the first
// Escape, D186). Each calls the same function of the page's one editor's transport that its key calls (DEF-62,
// INTAKE.26): the key table's Play/pause, Skip to start and Skip to end; no second path. After them, in the same group
// and on a line of its own, what the page hands it: the timeline (brief 66's ruling 1), so Tab meets it after "Skip to
// end", and the reason line stays last, after the group.
//
// Play with nothing to play, as v3 (playback.js 50 to 61, UIController.js 1399 to 1411): the button is disabled and
// described (`aria-describedby`) by the line under the group, drawn only then, which shows the editor's transport's
// own words for the refusal (`WORDS.nothingToPlay`, D190), never typed a second time. Its name stays "Play": the
// reason is a description, not part of the name (UI-06 J-21), and it stands outside the button, in full-contrast text,
// never in the disabled control's own text (B-12, C-6). Whether Play is on is asked of the session's `canPlay`, the
// one the keys ask, when the bar draws and again whenever the store tells of a change: no second rule. A pause is
// never refused, so "Pause" is never disabled.
import { Button } from '@carbon/react';
import { useSyncExternalStore, type ReactNode } from 'react';
import { WORDS, type EditorTransport } from '../transport/transport';

export interface PlayBarProps {
  /** The page's one editor's transport: the same functions its keys call. */
  readonly transport: Pick<EditorTransport, 'playPause' | 'skipToStart' | 'skipToEnd'>;
  /** The store's `subscribe`: told of every change, after which the two below are read again. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Whether the playback plays now (the store's). */
  readonly playing: () => boolean;
  /** Whether the scene has anything to play now: the session's, the one the editor's transport asks. */
  readonly canPlay: () => boolean;
  /** What stands in the group after the three buttons, on a line of its own: the timeline (v3's order). */
  readonly children?: ReactNode;
}

/** The id of the line that says why Play is off, which describes Play while it is. */
export const PLAY_REASON = 'play-reason';

/** Space between the buttons and above the group (Carbon's spacing-05): touching at a fractional pixel, each button's
 *  edge was hit by its neighbour, so focus was partly hidden by author content (2.4.12, seen in the accessibility run). */
const APART = { display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' } as const;
/** The timeline's line: the whole width, under the buttons. */
const LINE = { flexBasis: '100%' } as const;

/** The play bar: a group named "Playback" of three buttons, and the reason line while Play is off. */
export function PlayBar({ transport, subscribe, playing, canPlay, children }: PlayBarProps) {
  const plays = useSyncExternalStore(subscribe, playing, playing);
  const can = useSyncExternalStore(subscribe, canPlay, canPlay);
  const off = !plays && !can;
  return (
    <>
      <div role="group" aria-label="Playback" style={APART}>
        <Button
          id="skip-to-start"
          kind="secondary"
          onClick={() => {
            transport.skipToStart();
          }}
        >
          Skip to start
        </Button>
        <Button
          id="play-pause"
          kind="secondary"
          disabled={off}
          aria-describedby={off ? PLAY_REASON : undefined}
          onClick={() => {
            transport.playPause();
          }}
        >
          {plays ? 'Pause' : 'Play'}
        </Button>
        <Button
          id="skip-to-end"
          kind="secondary"
          onClick={() => {
            transport.skipToEnd();
          }}
        >
          Skip to end
        </Button>
        {children !== undefined && <div style={LINE}>{children}</div>}
      </div>
      {off && <p id={PLAY_REASON}>{WORDS.nothingToPlay}</p>}
    </>
  );
}
