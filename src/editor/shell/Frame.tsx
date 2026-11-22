// CORE-05, stage 5: the frame every control of the page stands in (brief 69). It owns the layout and nothing else: no
// store, no transport, no key. Its props are the slots. The header is Carbon's `Header` (a `<header>`, the page's one
// banner) holding the product's name as the page's one `h1`, not a link (Carbon's `HeaderName` is one, and a link that
// goes nowhere is a control that does nothing), and Help's button at its end, its word showing (D191: words, not
// icons). Carbon fixes its header over the page; the theme (src/ui/theme.scss) undoes that, so nothing of the author's
// covers a focused control (2.4.12). Then the page's `main`: the named slots, each a node or nothing. A slot not filled
// draws nothing at all: no empty landmark, heading or column. A filled one stands in a region named by its visible
// heading. Where each stands (brief 69's ruling 6, to be confirmed by the owner when the first is filled): a left
// column, the outline over the points list; the centre, today's paragraph and the preview over the play bar; a right
// column, the panels over the export panel. Reading and focus order: header, outline, points list, preview, play bar,
// panels, export panel; at a narrow width one column in that same order (frameLook.css). With only the centre filled,
// the centre takes the page.
import { Content, Header } from '@carbon/react';
import type { ReactNode } from 'react';
import './frameLook.css';

export interface FrameProps {
  /** The header's button: Help. */
  readonly help: ReactNode;
  /** Today's paragraph, in the centre above the preview (stage 6 replaces it). */
  readonly intro?: ReactNode;
  readonly outline?: ReactNode;
  readonly pointsList?: ReactNode;
  readonly preview?: ReactNode;
  /** The play bar. */
  readonly transport?: ReactNode;
  readonly panels?: ReactNode;
  readonly exportPanel?: ReactNode;
  /** What stands in `main` after the columns and is not seen at rest: the status region, Help's dialog. */
  readonly children?: ReactNode;
}

/** The page's name: its one `h1`, which also names the banner. */
export const PAGE_NAME = 'Route Plotter';
const NAME_ID = 'page-name';

/** Each slot's region: its id and the name its heading shows (the glossary's words). The play bar has none: it is
 *  already a group named "Playback", and stands in the centre as it is. */
export const SLOTS = {
  outline: { id: 'outline', name: 'Outline' },
  pointsList: { id: 'points', name: 'Points' },
  preview: { id: 'preview', name: 'Preview' },
  panels: { id: 'settings', name: 'Settings' },
  exportPanel: { id: 'export', name: 'Export' },
} as const;
type Slot = keyof typeof SLOTS;

const filled = (node: ReactNode): boolean => node !== undefined && node !== null && node !== false;

/** A filled slot in a region named by its heading; an empty one, nothing. */
function region(slot: Slot, node: ReactNode): ReactNode {
  if (!filled(node)) return null;
  const { id, name } = SLOTS[slot];
  return (
    <section key={id} className="frame__region" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="frame__heading">
        {name}
      </h2>
      {node}
    </section>
  );
}

/** A column holding its filled regions in order; with none, nothing. */
function column(place: string, regions: readonly ReactNode[]): ReactNode {
  const shown = regions.filter((r) => r !== null);
  return shown.length ? <div className={`frame__column frame__column--${place}`}>{shown}</div> : null;
}

export function Frame({ help, intro, outline, pointsList, preview, transport, panels, exportPanel, children }: FrameProps) {
  const left = column('left', [region('outline', outline), region('pointsList', pointsList)]);
  const right = column('right', [region('panels', panels), region('exportPanel', exportPanel)]);
  const sides = [left !== null && 'frame--left', right !== null && 'frame--right'].filter(Boolean).join(' ');
  return (
    <>
      <Header aria-labelledby={NAME_ID} className="frame__header">
        <h1 id={NAME_ID} className="frame__name">
          {PAGE_NAME}
        </h1>
        <div className="frame__actions">{help}</div>
      </Header>
      <Content className={sides ? `frame ${sides}` : 'frame'}>
        {left}
        <div className="frame__column frame__column--centre">
          {intro}
          {region('preview', preview)}
          {filled(transport) && transport}
        </div>
        {right}
        {children}
      </Content>
    </>
  );
}
