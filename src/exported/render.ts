// V31-APP-PACK starter, editor: the exported artefact's code (line 3's "exports"), reaching only the core; the
// editor's export orchestration lives with the editor.
import { apply, empty, type Model } from '../core/model';

export function snapshot(labels: readonly string[]): Model {
  return labels.reduce((model, label, i) => apply(model, { kind: 'add', item: { id: String(i), label } }), empty);
}
