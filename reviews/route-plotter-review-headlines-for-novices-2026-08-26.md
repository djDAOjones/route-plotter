<!-- markdownlint-disable MD013 MD060 -->
# Route Plotter review headlines for novices

> Historical snapshot: this summarises the read-only review at `cec0191`,
> before the `review-remediation` work. Do not treat the health labels below as
> current. Use the finding crosswalk, Git history and PM-Skills records for the
> remediated state.

The short version was that the app had good foundations and its main workflow
worked, but several serious reliability and accessibility bugs needed repair
before it could be treated as dependable for general users.

| Area | Original headline | Original health |
| --- | --- | --- |
| Core functionality | Creating routes, adding crowds, playback and basic recovery worked in testing. All 331 automated tests passed. | Good |
| Data safety | Opening a damaged project could erase the project already open. Autosave could omit backgrounds/assets or silently fail. | Poor — top priority |
| Accessibility | Keyboard Tab navigation was effectively broken, some shortcuts fired twice, and important canvas tasks required a mouse. | Poor |
| Screen sizes | At 1280 px or below, a major control panel disappeared with no way to reopen it. | Poor |
| Animation/export accuracy | The same timeline moment could look different depending on whether it was played, scrubbed or exported. | Needed work |
| Build and deployment | A clean build could omit required images, and the documented dry run could perform real deployment steps. | Unsafe |
| Security | No critical vulnerability, secret leak, malware-like behaviour or unsafe HTML injection was found. A malicious project could freeze the browser. | Mostly sound, with one important gap |
| Performance | Normal small projects behaved well, but paused animations kept redrawing and large/imported projects were unbounded. | Good optimisation potential |
| Code quality | The architecture was thoughtful, but old and new control systems overlapped and caused double handling. | Reasonably healthy |
| Testing | Core animation tests were strong; real-browser UI, failure, accessibility, touch and deployment coverage were weak. | Strong base, incomplete edges |

The six biggest original bugs in ordinary language were:

1. **Potential lost work:** a bad project file could replace or clear current
   work before the app discovered that the file was invalid.
2. **Untrustworthy autosave:** it could restore a route over the wrong
   background, omit large custom images or record success after storage failed.
3. **Broken keyboard use:** Tab did not navigate normally, and Space/J/K/L
   commands could run twice.
4. **Missing controls:** common laptop widths or browser zoom could move the
   right-side editing panel offscreen.
5. **Preview/export disagreement:** trail timing, visibility modes and playhead
   restoration did not share one consistent source of truth.
6. **Risky deployment:** stale output could hide missing source files, and the
   documented dry-run command was not genuinely safe.

The review recommended protecting user work first, repairing keyboard and
reflow second, making animation/export deterministic third, then hardening
deployment and measuring performance. It did **not** recommend a rewrite.

See `route-plotter-review-finding-crosswalk-2026-08-26.md` for what happened to
each issue after this snapshot.
