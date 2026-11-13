---
id: wsl-keeps-ubuntu-working
kind: guideline
scope: any
date: 2026-11-13
source: /sdd-auto, test phase of batch windows-look (wsl_support)
---

# WSL support must not break Ubuntu

**Rule** → A change made for WSL never breaks the app on Ubuntu: every Ubuntu behaviour keeps working as before.

**Why** → The human: "deve aggiungere la compatibilità con wsl ma non mi deve spaccare ubuntu eh!!!"

**How to apply** →
- analysis, planning: a WSL change states what stays the same on Ubuntu, and keeps the current Ubuntu behaviour as the default.
- development: no WSL-only path replaces an Ubuntu path; Ubuntu keeps its current code path.
- test: the non-regression run covers the Ubuntu desktop behaviours the change touches (notifications, window, tray), not only WSL.
