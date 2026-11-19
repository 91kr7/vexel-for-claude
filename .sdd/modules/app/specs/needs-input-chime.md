---
module: app
component: NeedsInputChime
type: asset
---

# NeedsInputChime

**Purpose** → the short sound that tells the user a session needs input.

## Contract

- A WAV file (PCM, 16 bit, mono, 24000 Hz) of 0.7 s: two soft sine notes, A5 (880 Hz) then E6 (1318.5 Hz) 0.12 s later, each with a fast attack and a decay.
- Peak level 35 % of full scale, so the level is moderate.
- The web build serves it as a page asset.

## Rules and invariants

- It lasts at most 2 s.
- Made for this app: no third-party file, so no entry in ThirdPartyNotices.

## Requirements served

- `plan-input_sound/REQ-9`
