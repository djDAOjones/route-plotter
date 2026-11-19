// V31-APP-PACK starter, every kind: a framework-free core. No DOM types (tsconfig.core.json), no React, no clock:
// time, model and seed arrive as inputs. One owner for each piece of data; a change is a command that returns the new
// model, so undo, autosave and export can snapshot it.
export interface Item {
  readonly id: string;
  readonly label: string;
}

export interface Model {
  readonly items: readonly Item[];
}

export type Command = { readonly kind: 'add'; readonly item: Item } | { readonly kind: 'remove'; readonly id: string };

export const empty: Model = { items: [] };

export function apply(model: Model, command: Command): Model {
  switch (command.kind) {
    case 'add':
      return model.items.some((i) => i.id === command.item.id) ? model : { items: [...model.items, command.item] };
    case 'remove':
      return { items: model.items.filter((i) => i.id !== command.id) };
  }
}
