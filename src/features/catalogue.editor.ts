// CORE-04 stage 6: the editor's catalogue (the plan's §8): what only the editor uses, never the player or an export.
// It starts with the editor's overlays' makers; the items that build the editor's panels add their lists here. The
// player-safe catalogue (src/features/catalogue.ts) never imports this file, and the boundaries' rules 6 and 7 keep
// a feature's draw/overlays.ts out of the player's and exported code's closure (DEF-99.1; D156).
import { lineOverlay } from './line/draw/overlays';
import { pointOverlay } from './markers/draw/overlays';

/**
 * The editor's overlays' makers (stage 6): each is handed plain ids and returns an Overlay for the request's list,
 * which only the editor passes; the composer draws that list last, in screen space.
 */
export const OVERLAY_MAKERS = { points: pointOverlay, lines: lineOverlay } as const;
