// A planted fault for tests/bundle/player.test.mjs: a player entry that loads code at run time by an import() the
// bundler cannot resolve, which stays in the output; the player's build refuses it (Codex's case, STACK-02 round 1).
export const load = (url) => import(/* @vite-ignore */ url);
