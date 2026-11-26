---
request_slug: terminal_clip
date: 2026-11-26
type: fix
size: narrow
reference: .sdd/analysis/terminal_overflow.md
---

# Analysis — Terminal last column still cut at the right edge

## Request

> c'è ancora il problema del testo che non si vede in quanto tagliato a destra! so che non c'entra ma puoi fixarmelo? (screenshot: /home/christian.mariani/Pictures/Screenshots/Screenshot from 2026-11-26 17-22-02.png — un ritaglio del terminale in cui l'ultimo carattere della riga, "e 15", è tagliato a metà dal bordo destro)

## Reference

[terminal_overflow.md](terminal_overflow.md) → the terminal of a hosted session must never be wider than its panel, in any situation. No character may go past the right edge or be hidden by it. The last column must stay fully visible. Its fix is merged on `main` (PR #41, before v1.5.0).

Facts checked by the orchestrator:
- The human ran a build with that fix when taking the screenshot. The backend started at 15:06 from `main`, and the screenshot was taken at 17:22. So the defect survives the fix.
- The human uses the desktop app on Ubuntu, on a 1920×1200 screen, with GNOME mutter `auto-maximize` on. At start the desktop can maximize the window, and then the app restores it to 1280×800. So the window passes through several sizes in its first seconds.
- `.sdd/tech-debt.md` has no open item for this defect.

Changes:
- A character hidden in part counts as hidden.
- The width must also be right after several size changes in a short time.

## Summary

After the `terminal_overflow` fix, the right edge of the panel still hides part of the terminal's last column. In the screenshot it cuts the last character, the "5" of "e 15", in half. Every column must be fully visible.

## Requirements

- Every requirement of [terminal_overflow.md](terminal_overflow.md) must hold again, in every situation it lists.
- No character may be hidden by the right edge of the panel, not even in part.
- Claude Code must receive only the columns that the panel shows in full, and a column that is only partly visible does not count.
- After several size changes in a short time, the terminal width must match the final size of the panel.
- The case above includes the start of the desktop app, when the desktop maximizes the window and the app then restores it to 1280×800.

## Assumptions

- This is a fix in its own file, with `terminal_overflow.md` as reference. It is the same defect, against requirements that the reference already states. The reference cycle is merged, so a new cycle gets its own slug. The gatekeeper decided this.
- The trigger is still unknown, so the requirements cover again every situation of the reference. The gatekeeper decided this.
- The defect was seen in the desktop app on Ubuntu. The browser client keeps the same requirements, as in the reference.
- The assumptions of the reference stay true.

## Risks

- The first fix passed its tests, but the defect survived. A check that does not show the cut column on the current `main` build proves nothing.
- The hidden part is about half a character wide. A check that accepts an error of that size passes on the broken app.

## Scope

In scope:
- The width of the terminal of hosted sessions, in the desktop app and in the browser client.

Out of scope:
- How the window is sized at start (maximize by the desktop, restore to 1280×800).
- Rows cut at the bottom edge of the panel.
- The conversation view of external sessions.
- Any change to the panel margins, the text size or its limits.
- New terminal features.
