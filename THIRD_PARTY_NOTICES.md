# Third-party notices

Route Plotter's first-party source is licensed under the MIT License in
[`LICENSE`](LICENSE). The components below retain their own licences and
copyright notices. Versions are the exact direct dependencies resolved by
`package-lock.json` for this release.

## Runtime dependencies

| Package | Version | Licence | Source |
| --- | --- | --- | --- |
| `jszip` | 3.10.1 | `(MIT OR GPL-3.0-or-later)` | [Stuk/jszip](https://github.com/Stuk/jszip) |
| `mediabunny` | 1.55.1 | `MPL-2.0` | [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny) |

### JSZip

Route Plotter uses JSZip under its MIT option.

Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger,
António Afonso

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

The upstream dual-licence text is available in the
[JSZip repository](https://github.com/Stuk/jszip/blob/main/LICENSE.markdown).

### Mediabunny

Mediabunny is licensed under the Mozilla Public License 2.0. Its source is
available from the [upstream repository](https://github.com/Vanilagy/mediabunny),
and the full licence is available from
[mozilla.org/MPL/2.0](https://www.mozilla.org/MPL/2.0/). Licence comments from
Mediabunny are preserved in the generated application bundle.

## Development dependencies

These tools are used to build and test Route Plotter; they are not loaded as
runtime dependencies by the published application.

| Package | Version | Licence | Source |
| --- | --- | --- | --- |
| `axe-core` | 4.13.0 | `MPL-2.0` | [dequelabs/axe-core](https://github.com/dequelabs/axe-core) |
| `esbuild` | 0.28.2 | `MIT` | [evanw/esbuild](https://github.com/evanw/esbuild) |
| `jsdom` | 27.4.0 | `MIT` | [jsdom/jsdom](https://github.com/jsdom/jsdom) |
| `vitest` | 4.1.10 | `MIT` | [vitest-dev/vitest](https://github.com/vitest-dev/vitest/tree/main/packages/vitest) |

### axe-core

axe-core is licensed under the Mozilla Public License 2.0. Its source is
available from the [upstream repository](https://github.com/dequelabs/axe-core),
and the full licence is available from
[mozilla.org/MPL/2.0](https://www.mozilla.org/MPL/2.0/). It is a test-time
accessibility engine only: it is never imported by application code and no part
of it reaches the published bundle or the generated `docs/` output.

## Dependency inventory

`package-lock.json` is the authoritative reproducible dependency inventory.
This project does not publish a per-release software bill of materials (SBOM).
