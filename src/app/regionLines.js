/**
 * One operation's region lines (UI-06 PR 6; Codex r2 on 753f93f, 3).
 *
 * The scope chip, the network's count and the empty waypoint list were live
 * regions; their lines are said once now, unless the operation that changed
 * them says the change in its own message. An operation marks that by
 * running through the app's `regionOperation` (main.js) and calling the
 * `cover` it is handed beside its message. This runs `work` that way, or as
 * it is on an app with none (a test's stand-in), so each covering site reads
 * the same in every mixin.
 *
 * @param {Object} app
 * @param {function(Function): *} work - Handed `cover`
 * @returns {*} What `work` returns
 */
export function regionOperation(app, work) {
  return typeof app?.regionOperation === 'function' ? app.regionOperation(work) : work(() => {});
}
