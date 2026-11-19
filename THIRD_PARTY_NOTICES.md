# Third-party notices

Route Plotter's first-party source is licensed under the MIT License in
[`LICENSE`](LICENSE). The components below retain their own licences and
copyright notices. This file is v4's, at the repository's root (STACK-02).
Frozen v3 keeps its own notices, unchanged, in
[`v3/THIRD_PARTY_NOTICES.md`](v3/THIRD_PARTY_NOTICES.md).

Versions are exact: each direct dependency is pinned in `package.json`, and
`package-lock.json` fixes every package below it. How these notices ship with
the published site is decided by PUB-01, the publishing step.

## Shipped in v4's editor build

What `npm run build` writes to `dist/`, read from the build's own source map
and the Sass it compiles (STACK-02's empty shell; the list grows as the
editor does).

| Package | Version | Licence | Shipped as | Source |
| --- | --- | --- | --- | --- |
| `react` | 19.1.10 | `MIT` | bundled script | [facebook/react](https://github.com/facebook/react) |
| `react-dom` | 19.1.10 | `MIT` | bundled script | [facebook/react](https://github.com/facebook/react) |
| `scheduler` | 0.26.0 | `MIT` | bundled script (React DOM's) | [facebook/react](https://github.com/facebook/react) |
| `@carbon/react` | 1.118.0 | `Apache-2.0` | bundled script and compiled styles | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) |
| `@carbon/feature-flags` | 1.12.0 | `Apache-2.0` | bundled script and compiled styles | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) |
| `@carbon/styles` | 1.120.0 | `Apache-2.0` | compiled styles | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) |
| `@carbon/colors` | 11.62.0 | `Apache-2.0` | compiled styles | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) |
| `@carbon/grid` | 11.66.0 | `Apache-2.0` | compiled styles | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) |
| `@carbon/layout` | 11.63.0 | `Apache-2.0` | compiled styles | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) |
| `@carbon/motion` | 11.57.0 | `Apache-2.0` | compiled styles | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) |
| `@carbon/themes` | 11.86.0 | `Apache-2.0` | compiled styles | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) |
| `@carbon/type` | 11.71.0 | `Apache-2.0` | compiled styles | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) |
| `classnames` | 2.5.1 | `MIT` | bundled script (Carbon's) | [JedWatson/classnames](https://github.com/JedWatson/classnames) |
| `prop-types` | 15.8.1 | `MIT` | bundled script (Carbon's) | [facebook/prop-types](https://github.com/facebook/prop-types) |
| `@ibm/plex` | 6.4.1 | `OFL-1.1` | IBM Plex Sans font files, unmodified | [IBM/plex](https://github.com/IBM/plex) |

### React, React DOM, scheduler and prop-types

Copyright (c) Meta Platforms, Inc. and affiliates (prop-types: Copyright (c)
2013-present, Facebook, Inc.). classnames: Copyright (c) 2018 Jed Watson. Each
is licensed under the MIT License:

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Carbon

Copyright 2015 IBM Corp. Licensed under the Apache License, Version 2.0 (the
"License"); you may not use these files except in compliance with the License.
You may obtain a copy of the License at
[apache.org/licenses/LICENSE-2.0](https://www.apache.org/licenses/LICENSE-2.0);
each Carbon package also carries it as its own `LICENSE` file. Unless required
by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
ANY KIND, either express or implied. Route Plotter's theme overrides some of
Carbon's colour tokens in its own Sass (`src/ui/theme.scss`); Carbon's files
are not modified. The packages carry no NOTICE file.

### IBM Plex

Copyright © 2017 IBM Corp. with Reserved Font Name "Plex". The fonts are
licensed under the SIL Open Font License, Version 1.1, carried in the package
as `LICENSE.txt` and available from
[openfontlicense.org](https://openfontlicense.org/open-font-license-official-text/).
Route Plotter ships IBM Plex Sans's split `.woff2` files unmodified.

## Shipped in v4's exported player

None. `dist/player/player.js` holds no third-party code: its build refuses any
package (`vite.config.mjs`), and `tests/bundle/player.test.mjs` checks the
built file.

## Installed for later items, not yet shipped

Installed by STACK-02 with the stack so that later items need not change
`package.json` (the architecture plan's A26), at the versions frozen v3 uses.
No v4 code imports them yet. Their notices, as v3 ships them, are in
[`v3/THIRD_PARTY_NOTICES.md`](v3/THIRD_PARTY_NOTICES.md), and come here when
v4 ships them.

| Package | Version | Licence | For | Source |
| --- | --- | --- | --- | --- |
| `jszip` | 3.10.1 | `(MIT OR GPL-3.0-or-later)`, used under MIT | the save file (CORE-03) | [Stuk/jszip at v3.10.1](https://github.com/Stuk/jszip/tree/v3.10.1) |
| `mediabunny` | 1.55.3 | `MPL-2.0` | the video export (CORE-08) | [Vanilagy/mediabunny at v1.55.3](https://github.com/Vanilagy/mediabunny/tree/v1.55.3) |

## Development dependencies

Used to build, check and test v4; none is loaded by the published application.
IBM Plex is listed above, as its font files ship.

| Package | Version | Licence | Source |
| --- | --- | --- | --- |
| `typescript` | 6.0.3 | `Apache-2.0` | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |
| `vite` | 8.2.2 | `MIT` | [vitejs/vite](https://github.com/vitejs/vite) |
| `vitest` | 5.1.0 | `MIT` | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) |
| `sass` | 1.105.1 | `MIT` | [sass/dart-sass](https://github.com/sass/dart-sass) |
| `eslint` | 9.39.5 | `MIT` | [eslint/eslint](https://github.com/eslint/eslint) |
| `@eslint/js` | 9.39.5 | `MIT` | [eslint/eslint](https://github.com/eslint/eslint) |
| `typescript-eslint` | 8.71.2 | `MIT` | [typescript-eslint/typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) |
| `eslint-plugin-react-hooks` | 7.1.1 | `MIT` | [facebook/react](https://github.com/facebook/react) |
| `eslint-plugin-jsx-a11y` | 6.10.2 | `MIT` | [jsx-eslint/eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) |
| `knip` | 6.41.0 | `ISC` | [webpro-nl/knip](https://github.com/webpro-nl/knip) |
| `dependency-cruiser` | 18.6.0 | `MIT` | [sverweij/dependency-cruiser](https://github.com/sverweij/dependency-cruiser) |
| `fast-check` | 4.10.2 | `MIT` | [dubzzz/fast-check](https://github.com/dubzzz/fast-check) |
| `@types/react` | 19.1.17 | `MIT` | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| `@types/react-dom` | 19.1.11 | `MIT` | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| `@types/prop-types` | 15.7.15 | `MIT` | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| `@playwright/test` | 1.56.1 | `Apache-2.0` | [microsoft/playwright](https://github.com/microsoft/playwright) |
| `@axe-core/playwright` | 4.13.0 | `MPL-2.0` | [dequelabs/axe-core-npm](https://github.com/dequelabs/axe-core-npm) |
| `axe-core` | 4.13.0 | `MPL-2.0` | [dequelabs/axe-core](https://github.com/dequelabs/axe-core) |

The accessibility run (STACK-03) also uses Chromium's headless shell, which
Playwright's own installer fetches at the revision `@playwright/test` names
(1194, Chromium 141.0.7390.37). It is not an npm package, is not in the
lockfile, and never ships.

## Dependency inventory

`package-lock.json` is the authoritative, reproducible dependency inventory.
This project does not publish a software bill of materials (SBOM).
