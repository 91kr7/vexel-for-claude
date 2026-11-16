# Third-party notices

The client ships these files from other projects. They are copied into the repository and served by the client itself.

## Roboto Flex (font)

- Files → `src/web/fonts/roboto-flex-latin.woff2` (variable weight 400–800 and width 25–151, latin subset).
- Source → Roboto Flex by The Roboto Flex Project Authors, https://github.com/googlefonts/roboto-flex. Taken from the latin subset that Google Fonts serves, as embedded in the mock `.sdd/mockups/vexel-material3/`. The mock does not record the version.
- Licence → SIL Open Font License 1.1. Full text in `src/web/fonts/OFL.txt`.

## Roboto Mono (font)

- Files → `src/web/fonts/roboto-mono-latin.woff2` (weights 400 and 500, latin subset).
- Source → Roboto Mono by The Roboto Mono Project Authors, https://github.com/googlefonts/robotomono. Taken from the latin subset that Google Fonts serves, as embedded in the mock `.sdd/mockups/vexel-material3/`. The mock does not record the version.
- Licence → SIL Open Font License 1.1. Full text in `src/web/fonts/OFL.txt`.

## Lucide (icons)

- Files → the SVG path data in `src/web/icons/Icons.tsx` and `src/desktop/startup-page.ts`.
- Source → Lucide, https://lucide.dev. Taken from the npm package `lucide-static` 1.69.0. Icons drawn in the mock boards `.sdd/mockups/vexel-material3/` take their path data from the board.
- Licence → ISC. Icons derived from Feather are also under the MIT licence. Full text of both in `src/web/icons/LICENSE`.

## react-diff-view (diff view)

- Use → draws the diffs of the git explorer. npm dependency, bundled into the web build.
- Source → react-diff-view 3.3.3 by Gray Zhang, https://github.com/otakustay/react-diff-view.
- Licence → MIT. Full text in `src/web/git/licenses/react-diff-view.LICENSE`.

## React Aria Components (list)

- Use → draws the changed files of the git explorer. npm dependency, bundled into the web build.
- Source → react-aria-components 1.22.1 by Adobe, https://github.com/adobe/react-spectrum.
- Licence → Apache-2.0. Full text in `src/web/git/licenses/react-aria-components.LICENSE`.

## commit-graph (commit graph)

- Use → draws the commit graph of the git explorer history. npm dependency, bundled into the web build.
- Source → commit-graph 2.4.0 by Liu Liu, https://github.com/liuliu-dev/CommitGraph.
- Licence → MIT, as its `package.json` declares; the `LICENSE` file of the package holds the Apache-2.0 text. Both are permissive. That file, as shipped, is in `src/web/git/licenses/commit-graph.LICENSE`.

The packages that react-diff-view, React Aria Components and commit-graph copy into their own bundles (for example lodash, classnames, diff-match-patch, gitdiff-parser, `@internationalized/*`, react-tooltip and react-infinite-scroller) are listed in [docs/dependency-licenses.md](docs/dependency-licenses.md).

The web build writes `third-party-licenses.md` next to its page, with the licence of every npm package it bundles as a separate module. The browser page and the desktop window load the same build.

## npm dependencies

This repository contains only Vexel's own source and the files listed above. The npm dependencies are not copied into it: `npm install` downloads them, each under its own license.

- The production dependencies, direct and transitive (149 packages), and their licenses are listed in [docs/dependency-licenses.md](docs/dependency-licenses.md). All of them are permissive: MIT, Apache-2.0, ISC, BlueOak-1.0.0, BSD-3-Clause and 0BSD.

## Electron and Chromium

Electron is an npm dependency (MIT). It is not part of this repository.

If you build and redistribute a packaged application (for example an AppImage or a `.deb`), the package will contain Electron, Chromium and Node.js, and their license notices must travel with it. Keep the `LICENSE` and `LICENSES.chromium.html` files that Electron ships in its distribution, and include the dependency licenses above.
