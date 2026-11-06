---
status: validated
---

# Batches — Dark "Studio" restyle of the client

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [studio-dark-restyle](batches/batch-studio-dark-restyle.md) | Dark "Studio" restyle: all features of the plan | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45, REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52, REQ-53 | — | implemented | The user sees the client in the dark Studio look with a light-blue accent |

## Assumptions and decisions

- **One batch, human decision.** The human asked for the whole work in one batch, and the spec records it in "Constraints". The batch holds all seven features of `requirements.md`. This breaks the planner rule "one batch = one feature" on purpose. It does not depart from the spec.
- **The mock reaches the developer.** The batch file cites `.sdd/mockups/studio-dark/mock.html` in "Visual reference", in "What this batch builds" and in every intervention, with the mock element to copy. It also gives the human's instruction word for word.
- **Look only.** No intervention adds a behaviour, except REQ-15 (INT-16) and REQ-45 (INT-50). The mock's extra features are listed under "Do not copy" in the batch file.
- **No new tools.** Plain CSS, React and xterm options, as in `.sdd/.archi`. Tailwind is not installed. The batch file resolves the mock's Tailwind classes into a table of values. The fonts stay the bundled Roboto Flex and Roboto Mono, so nothing is downloaded.
- **Technical decisions.** These are in the batch file, section "Decisions for this batch", because the developer reads only that file. They cover the accent values, the dark text on accent fills, the dots in place of the state icons, the dropped tool and dialog icons, the subbar line, the message avatars, the "[Esc]" name, the area states and the mono weights.
- **No blur behind dialogs, human decision 2026-11-06.** The blur on the dialog backdrop made the "Riprendi sessione" list scroll slowly. REQ-43 now asks for no blur, and INT-48 drops it. The glass toast of REQ-41 keeps its blur. The analysis is corrected the same way, so this is not a departure.
- **Indexes and specs.** The developer updates the indexes and component specs of the touched components, and adds the two new components. The specs say "light and dark" and "board" today, so they will change.

## Departures

None. No human decision contradicts the spec.

## Coverage check

Every REQ is served by at least one INT. All INTs are in `batch-studio-dark-restyle`, and every REQ closes there.

| REQ | INT |
|-----|-----|
| REQ-1 | INT-1, INT-6 |
| REQ-2 | INT-6, INT-7 |
| REQ-3 | INT-7 |
| REQ-4 | INT-1, INT-5, INT-8, INT-31 |
| REQ-5 | INT-2 |
| REQ-6 | INT-2, INT-15, INT-19 |
| REQ-7 | INT-7, INT-36 |
| REQ-8 | INT-3, INT-23, INT-42, INT-56 |
| REQ-9 | INT-8, INT-23 |
| REQ-10 | INT-7 |
| REQ-11 | INT-7, INT-23, INT-24, INT-32, INT-36, INT-40, INT-42 |
| REQ-12 | INT-10, INT-17, INT-28, INT-55, INT-56 |
| REQ-13 | INT-16 |
| REQ-14 | INT-14, INT-16, INT-17, INT-19 |
| REQ-15 | INT-16 |
| REQ-16 | INT-15 |
| REQ-17 | INT-19 |
| REQ-18 | INT-20 |
| REQ-19 | INT-20 |
| REQ-20 | INT-21 |
| REQ-21 | INT-17, INT-30 |
| REQ-22 | INT-18, INT-38 |
| REQ-23 | INT-24 |
| REQ-24 | INT-25 |
| REQ-25 | INT-24 |
| REQ-26 | INT-29 |
| REQ-27 | INT-25, INT-27 |
| REQ-28 | INT-26, INT-27 |
| REQ-29 | INT-25 |
| REQ-30 | INT-32 |
| REQ-31 | INT-23 |
| REQ-32 | INT-9, INT-33, INT-34 |
| REQ-33 | INT-39, INT-47 |
| REQ-34 | INT-35, INT-36 |
| REQ-35 | INT-37 |
| REQ-36 | INT-40, INT-41 |
| REQ-37 | INT-40 |
| REQ-38 | INT-41 |
| REQ-39 | INT-42, INT-43 |
| REQ-40 | INT-44 |
| REQ-41 | INT-22, INT-45 |
| REQ-42 | INT-18, INT-37 |
| REQ-43 | INT-48, INT-52 |
| REQ-44 | INT-49 |
| REQ-45 | INT-50 |
| REQ-46 | INT-11, INT-54 |
| REQ-47 | INT-9, INT-51 |
| REQ-48 | INT-53 |
| REQ-49 | INT-53 |
| REQ-50 | INT-12, INT-13, INT-28, INT-46, INT-56 |
| REQ-51 | INT-4 |
| REQ-52 | INT-2, INT-9, INT-47, INT-51 |
| REQ-53 | INT-14, INT-17, INT-19, INT-32 |

Every INT from INT-1 to INT-56 serves at least one REQ. There is no enabling-only intervention. The theme and global-style INTs (INT-1 to INT-11) serve the colour, type and contrast REQs directly.
