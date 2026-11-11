# Contributing to Vexel for Claude

Thanks for your interest! This is a small project run by one person, so a little structure keeps things fast for everybody.

## Before you start

- **Bugs and small fixes** – open a PR directly, or an issue first if you are not sure.
- **Features and larger changes** – open an issue (or a Discussion) first so we can agree on the idea before you spend time on it.
- Look for issues labelled `good first issue` if you want somewhere to begin.

## Setup

You need Linux, Node.js 22+, and build tools for `node-pty` (`build-essential`, `python3`).

```bash
git clone https://github.com/91kr7/vexel-for-claude.git
cd vexel-for-claude
npm install --include=dev   # --include=dev matters if NODE_ENV=production is set in your shell
npm run build
npm test
```

`npm run dev` starts the backend and the Vite dev server with hot reload.

## Checks a PR must pass

```bash
npx tsc -b          # types
npm run build
npm test            # unit tests; run `npm run build` first, one test reads dist/web
npm run test:e2e    # browser tests; they use a fake Claude CLI, never the real one
```

CI runs the type-check, the build and the unit tests. The browser end-to-end tests and the ones that open Electron windows (`npm run test:e2e:desktop`) are not part of CI yet, so please run them locally when you touch the UI.

## Code guidelines

- TypeScript, `strict`. No `any` without a reason in a comment.
- Every behaviour change comes with a test. Prefer unit tests; add an e2e test for user-visible flows.
- Keep the UI text in **English**. A test (`src/web/no-italian-text.test.ts`) checks it.
- Keep the change small and focused. One PR, one idea.
- Comments explain *why*, not *what*.

## The `.sdd/` folder

The project was built with a spec-driven workflow. `.sdd/modules/` holds a spec for each component and an index of them. If you change a component's behaviour, update its spec in the same PR. You do not need to use the `.claude/` workflow to contribute.

## Commits and PRs

- Write clear commit messages in the imperative ("Fix reconnect after sleep").
- Fill in the PR template and link the issue it closes.
- Be kind. See the [Code of Conduct](CODE_OF_CONDUCT.md).

By contributing you agree that your work is released under the project's [MIT license](LICENSE).
