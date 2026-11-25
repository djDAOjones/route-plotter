// CORE-05, stage 6: a button that asks for one file (brief 75, ruling 3's fallback). Carbon's `FileUploaderButton`
// (1.118) draws its button and, beside it, a file input it hides only to the eye (`cds--visually-hidden`, tabindex -1)
// with a label of its own: a second control of the same name in the accessibility tree, which a screen reader's list of
// controls and the accessibility run's control selector both meet. So here a Carbon `Button` (the house's button, its
// word showing) stands over an `<input type="file" hidden>`: `hidden` takes the input out of the layout, the tab order
// and the accessibility tree, so the page has one control, a button, named by its word. Pressing the button clicks the
// input, which opens the browser's file chooser (the page proves it; Node cannot).
// What a choice does (`takeChoice`, proved here by a stand-in input): the first file chosen is handed to `onChoose`, then
// the input's value is cleared, so the same file chosen again is a new choice (v3 cleared it too); with no file chosen
// (the chooser cancelled), nothing is handed on. It holds nothing of its own and imports nothing of the shell, the store
// or io: the kit's rule.
import { Button } from '@carbon/react';
import { useRef, type ReactNode } from 'react';

export interface FileButtonProps {
  /** The button's id. */
  readonly id: string;
  /** The button's word, its name. */
  readonly children: ReactNode;
  /** The file types the chooser offers first (`.zip`); a file of another kind can still be chosen through its "All
   *  files", so whoever is handed it judges it by what it holds. */
  readonly accept: readonly string[];
  /** Handed the one file chosen. */
  readonly onChoose: (file: File) => void;
}

/** What a choice in a file input does: the first file to `onChoose`, then the input's value cleared. */
export function takeChoice<T>(input: { readonly files: ArrayLike<T> | null; value: string }, onChoose: (file: T) => void): void {
  const file = input.files !== null && input.files.length > 0 ? input.files[0] : undefined;
  if (file !== undefined) onChoose(file);
  input.value = '';
}

/** One button that opens the browser's file chooser for one file. */
export function FileButton({ id, children, accept, onChoose }: FileButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        id={id}
        onClick={() => {
          input.current?.click();
        }}
      >
        {children}
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        accept={accept.join(',')}
        onChange={(event) => {
          takeChoice(event.currentTarget, onChoose);
        }}
      />
    </>
  );
}
