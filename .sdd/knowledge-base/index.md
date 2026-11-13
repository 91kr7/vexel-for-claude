# Knowledge base

| Entry | Kind | Scope | Rule | File |
|-------|------|-------|------|------|
| short-request-slugs | guideline | analysis, planning | Request slugs are short and specific; an evolution never chains the previous name | `entries/short-request-slugs.md` |
| electron-e2e-separate | guideline | planning, development, test | Electron e2e specs run in a separate group; the default e2e run never launches Electron | `entries/electron-e2e-separate.md` |
| run-all-requested-items | guideline | any | A list of requested points runs cycle after cycle, with no stop for an "ok" between cycles | `entries/run-all-requested-items.md` |
| narrow-batch-tests | guideline | test | An intermediate batch runs its new tests, the tests of the files it changed and of their direct dependencies; existing e2e only when they exercise them | `entries/narrow-batch-tests.md` |
| chat-in-italian | guideline | any | Every chat message to the human is in Italian; artifacts, code and commits keep their own rules | `entries/chat-in-italian.md` |
| release-bumps-package-version | guideline | any | A requested new version sets `version` in `package.json` before the release is published | `entries/release-bumps-package-version.md` |
| no-kill-by-pattern | guideline | development, test | Never stop processes by name or pattern; a process you started is stopped only by its PID | `entries/no-kill-by-pattern.md` |
| wsl-keeps-ubuntu-working | guideline | any | A change made for WSL never breaks the app on Ubuntu | `entries/wsl-keeps-ubuntu-working.md` |
