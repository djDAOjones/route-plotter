// CORE-05, stage 4: a number field on Carbon's own `TextInput`, thin over the kit's logic (controls.ts). Its text and
// its error text are what the logic shows; an input event is `type()`; Enter and leaving the field are `commit()`;
// Escape is `escape()`, and goes no further when there was typed text to give up (one key, one effect: DEF-13.1).
// Carbon's `TextInput` and not its `NumberInput`, which keeps and corrects a value of its own (D181): `type="text"`
// with `inputMode="decimal"`, so the text stays exactly as typed (DEF-97).
import { TextInput } from '@carbon/react';
import { useCallback, useMemo, useReducer, useSyncExternalStore, type KeyboardEvent } from 'react';
import { createNumberField, type NumberField, type Setting } from './controls';

interface FieldProps {
  /** The field's id; its label is tied to it. */
  readonly id: string;
  /** The visible label. */
  readonly labelText: string;
}

export interface SettingFieldProps extends FieldProps {
  /** The setting it shows and edits, made by the shell (src/editor/shell/settings.ts). */
  readonly setting: Setting;
  /** How the value held is written in the field; `String` by default. */
  readonly format?: (value: number) => string;
}

/** A number field for one setting that holds a number. */
export function SettingField({ id, labelText, setting, format }: SettingFieldProps) {
  const field = useMemo(() => createNumberField(setting, format), [setting, format]);
  const subscribe = useCallback((listener: () => void) => setting.subscribe(listener), [setting]);
  const read = useCallback(() => setting.read(), [setting]);
  useSyncExternalStore(subscribe, read, read);
  return <NumberFieldView id={id} labelText={labelText} field={field} />;
}

/** Draws `field` on Carbon's `TextInput` and passes on what the user does; drawn again after each of those. */
export function NumberFieldView({ id, labelText, field }: FieldProps & { readonly field: NumberField }) {
  const [, drawAgain] = useReducer((n: number) => n + 1, 0);
  const shown = field.shown();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      field.commit();
      drawAgain();
    } else if (event.key === 'Escape' && field.shown().typing) {
      field.escape();
      drawAgain();
      event.stopPropagation();
      event.preventDefault();
    }
  };
  return (
    <TextInput
      id={id}
      labelText={labelText}
      type="text"
      inputMode="decimal"
      value={shown.text}
      invalid={shown.problem !== null}
      invalidText={shown.problem ?? undefined}
      onChange={(event) => {
        field.type(event.target.value);
        drawAgain();
      }}
      onBlur={() => {
        field.commit();
        drawAgain();
      }}
      onKeyDown={onKeyDown}
    />
  );
}
