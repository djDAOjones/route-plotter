// STACK-02: the exported player's entry (the architecture plan's A20), Vite's second output. `vite build --mode player`
// builds it into dist/player/player.js as one self-contained script with no React, no Carbon and no network, which the
// HTML export inlines (CORE-10); vite.config.mjs refuses a bundle that is not, and tests/bundle checks the built file.
// Until CORE-10 it offers only the core's scaffold, so the build and its check hold real core code.
export { clamp } from '../core/scaffold';
