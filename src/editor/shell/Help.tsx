// CORE-05, stage 5: Help, the page's first dialog. It lists the keyboard shortcuts from the key table (`helpRows`),
// one table for each of the table's groups, a row for each action with its words and its keys; then the switch that
// turns single-key shortcuts on and off (D183), with the sentence that says what it stops and what keeps working. No
// other text but its heading. A punctuation key in the tables is read out by its name (comma, full stop, less than,
// greater than, question mark), what is seen unchanged. Opened by its button or `?`, through the kit's one dialog.
import { useSyncExternalStore, type RefObject } from 'react';
import { Dialog } from '../kit/Dialog';
import { Switch } from '../kit/Switch';
import type { Held } from './held';
import { helpRows } from './keys';

export interface HelpProps {
  /** The Help button: focus goes back to it when Help closes. */
  readonly opener: RefObject<HTMLElement | null>;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly mac: boolean;
  /** Whether single-key shortcuts are on: held for the visit, read by the listener at each key. */
  readonly singleKeys: Held<boolean>;
}

/** How the sentence under the switch names a key of one character that a reader could miss. */
const SPOKEN: Readonly<Record<string, string>> = { ',': 'comma', '.': 'full stop' };

/**
 * What a screen reader says for a punctuation key in the tables, which it might otherwise pass over: the key is drawn as
 * it is seen but hidden from it, and this name beside it is hidden from sight.
 */
export const KEY_NAMES: Readonly<Record<string, string>> = { ...SPOKEN, '<': 'less than', '>': 'greater than', '?': 'question mark' };

/** The keys of one printable character the table names, as help shows them: what the switch turns off. */
export function singleKeysShown(mac: boolean): readonly string[] {
  return helpRows(mac).flatMap(({ keys }) => keys.filter((key) => key.length === 1));
}

/** The sentence under the switch, read from the table. */
export function switchHelp(mac: boolean): string {
  const named = singleKeysShown(mac).map((key) => SPOKEN[key] ?? key);
  const list = `${named.slice(0, -1).join(', ')} and ${named[named.length - 1] ?? ''}`;
  return `Turned off, ${list} do nothing. Space, Home, End, Open project, Undo and Redo keep working.`;
}

/** Help: the shortcuts, grouped as the key table groups them, and the switch for single-key shortcuts. */
export function Help({ opener, open, onClose, mac, singleKeys }: HelpProps) {
  const on = useSyncExternalStore(singleKeys.subscribe, singleKeys.read, singleKeys.read);
  const rows = helpRows(mac);
  const groups = [...new Set(rows.map(({ group }) => group))];
  return (
    <Dialog opener={opener} heading="Help" open={open} onClose={onClose}>
      {groups.map((group) => (
        <table key={group} className="cds--data-table cds--data-table--sm">
          <caption>{group}</caption>
          <tbody>
            {rows.filter((row) => row.group === group).map(({ action, keys, words }) => (
              <tr key={action}>
                <th scope="row">{words}</th>
                <td>
                  {keys.map((key, i) => (
                    <span key={key}>
                      {i > 0 ? ' ' : ''}
                      {KEY_NAMES[key] === undefined ? (
                        <kbd>{key}</kbd>
                      ) : (
                        <>
                          <kbd aria-hidden="true">{key}</kbd>
                          <span className="cds--visually-hidden">{KEY_NAMES[key]}</span>
                        </>
                      )}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <Switch id="single-keys" labelText="Single-key shortcuts" help={switchHelp(mac)} on={on} onChange={singleKeys.set} />
    </Dialog>
  );
}
