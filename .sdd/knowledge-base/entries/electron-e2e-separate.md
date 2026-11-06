---
id: electron-e2e-separate
kind: guideline
scope: planning, development, test
date: 2026-11-06
source: /sdd-auto, test phase of batch window-tray (desktop_app)
---

# Electron e2e tests run in their own group

**Rule** → e2e tests that launch Electron are kept in a separate group with its own command. The normal e2e run (`npm run test:e2e`, browser only) never launches Electron.

**Why** → The human: "i test e2e non devono girare tutti su electron!!! altrimenti mi continua ad aprire finestre e mi blocchi le attività in corso! io farei un lotto di test per electron il resto gira su npm". Electron windows open on the user's display and interrupt their work.

**How to apply** →
- planning: a batch that needs Electron e2e tests plans them in the Electron group, not in the default suite.
- development: the Playwright config and `package.json` keep a separate project/command for Electron specs; the default e2e command excludes them.
- test: Electron specs go only in the Electron group. The default e2e run and the plan's closing full e2e run do not launch Electron; the Electron group runs on its own, only when the batch touches the desktop app.
