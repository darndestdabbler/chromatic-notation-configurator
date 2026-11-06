# UAT — session 4 (v1 set 014, pitch axis), per-set review

**Date:** 2026-10-31
**Scope:** per-set (`uatScope: per-set`): one review covering sessions 1–4
of the pitch-axis implementation. Recorded before verification round 1.
**Style:** ad hoc operator review of rendered output (`uatStyle: ad-hoc`).

## What was reviewed

1. **Compact-staff preview.** `cnb/index.html` with
   `cnb/assets/examples/gallery/twinline-compact.json` loaded through the
   Save / load panel. It shows the 7-position Twinline-like axis: C/C♯, D♯/E,
   F/F♯, G♯/A and A♯/B share heights, and the staff pattern collapses to its
   deduplicated lines. The orchestrator's headless Chromium capture of the
   same view was shown alongside.
2. **Engine render.** `docs/sessions/session-003/roundtrip/twinline-roundtrip.svg`
   with its measurements (`README.md`, `transcript.txt`). The result was
   PARITY PASS: 37/37 noteheads at their mapped positions, 6/6 shared pairs
   coincident, x-offset effect +0.850 against the control render, and stems,
   staff lines and key signature matching the preview.
3. **Preset flow.** Starting from the default config, the new **Pitch axis
   (set 014)** panel's "Twinline-like 7-position" preset enables the design
   §1.1 map. It appends a notehead rule offsetting C♯, E, F♯, A and B by +0.85
   staff spaces, editable in the notehead-rule cards' new "Horizontal offset
   (staff spaces)" row.

Points the operator was told before deciding:

- The preset changes only the map and the offset rule (design §1.1), so the
  default 4-8 ledger templates are not adapted to the compact axis.
- The octave-card preview shows one pitch class per card, so the offset is
  seen side by side only in the engine's chord render.

## Decision (verbatim)

Question put to the operator:

> Session 4 UAT (pitch axis, set 014): you've reviewed the Twinline compact
> preview (twinline-compact.json in cnb/index.html), the session-3 engine
> render (parity pass), and the preset flow (Pitch axis panel →
> 'Twinline-like 7-position' → map + offset rule, editable in the notehead
> rules). What is your decision?

Operator's answer, verbatim:

> Approve (Recommended)

No changes were requested, so nothing needs re-attesting.
