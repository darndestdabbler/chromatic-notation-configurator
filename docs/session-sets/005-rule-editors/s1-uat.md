# Session 1 UAT — Staff/Ledger Rule Editor (Module 13)

**Date:** 2026-07-05
**Scope:** per-session (spec `uatScope: per-session`, `uatStyle: dsl`)
**Surface:** `cnb/test-pages/test-staff-rule-editor.html`
**Execution:** headless Chromium (Playwright / chromium-1223) driving the
page over a local static server; screenshots reviewed. As in set 004, the
dabbler-uat-dsl compiler pipeline (W0) is still in bootstrap, so the checklist
below is authored in the DSL's label-based step style and is executed by the
checked-in Playwright driver `cnb/uat/uat-staff-rule-editor.mjs`
(`node cnb/uat/uat-staff-rule-editor.mjs`; see its header for the
playwright-core / Chromium environment knobs); it can be recompiled through
the DSL pipeline once W1/W2 land.

## Checklist (DSL style) and results

```
NAVIGATE TO "/cnb/test-pages/test-staff-rule-editor.html"
EXPECT PAGE with title containing "Staff/Ledger Rule Editor"                → PASS

EXPECT PATTERN LIST with 3 options, "4–8 (E, G♯)" selected by default       → PASS
EXPECT DERIVED PANEL sps 4 · midpoint 12 · LY positions (-2 -1 1 2)         → PASS
EXPECT PREVIEW with 4 staff lines (semis 4, 8, 16, 20 via Module 3)         → PASS
EXPECT PREVIEW with 25 note columns (chromatic 0–24 example run)            → PASS
EXPECT PREVIEW column C (semi 0) with 1 ledger (Module 5 override rule)     → PASS
EXPECT PREVIEW column D (semi 2) with 2 ledgers (C + D templates)           → PASS
EXPECT PREVIEW column F (semi 5) with 0 ledgers (inside staff)              → PASS
EXPECT PREVIEW column C'' (semi 24) with 1 ledger (octave-aware upper C)    → PASS
EXPECT JSON PANEL staff.semitonePattern [4,8], semitonesPerStaffSpace 4     → PASS
EXPECT JSON PANEL ledgers with 3 templates, proximityRule true              → PASS
EXPECT VALIDATION line "Config valid ✓" (Module A pass-through)             → PASS

CLICK OPTION with caption "3–6–9 (D♯, F♯, A)"
EXPECT DERIVED PANEL sps 3 · LY positions (-3 -2 -1 1 2 3)                  → PASS
EXPECT PREVIEW with 6 staff lines (semis 3, 6, 9, 15, 18, 21)               → PASS
EXPECT JSON PANEL staff.semitonePattern [3,6,9]                             → PASS
EXPECT OVERRIDE ROWS following the pattern (3 rows)                         → PASS

CHECK OVERRIDE for line "D♯ (semi 3)"
EXPECT JSON PANEL lineOverrides["3"] seeded from defaults (thicknessPct 20) → PASS
SET OVERRIDE COLOR INPUT to "#cc0000"
EXPECT JSON PANEL lineOverrides["3"].color = "#cc0000"                      → PASS
EXPECT PREVIEW semi-3 lines (abs 3 AND 15) stroked #cc0000, others black    → PASS

EXPECT PREVIEW column F (semi 5) with 0 ledgers (before template)           → PASS
CLICK BUTTON "+ Add ledger template"
EXPECT JSON PANEL 4 templates; new one at position 0 triggered by C         → PASS
SELECT TEMPLATE 4 POSITION "5 · F"; TOGGLE TRIGGERS to [F]
EXPECT JSON PANEL templates[3] = {semiWithinOctave 5, triggerPCs [5]}       → PASS
EXPECT PREVIEW column F (semi 5) with 1 ledger                              → PASS
EXPECT PREVIEW column F' (semi 17) with 1 ledger (per-octave template)      → PASS

CLICK OPTION with caption "Custom pattern"
EXPECT PC TOGGLES shown, seeded from current pattern (D♯, F♯, A on)         → PASS
TOGGLE OFF "F♯" and "A" (1 line left)
EXPECT VALIDATION error "at least 2" and no valid banner                    → PASS
EXPECT DERIVED PANEL shortfall message                                      → PASS
TOGGLE ON "F♯"
EXPECT VALIDATION "Config valid ✓" again                                    → PASS

EXPECT NO console or page errors across the whole flow                      → PASS
```

**Result: 29/29 checks passed.**

## Visual review

Full-page screenshots (default 4-8 state, 3-6-9 with the semi-3 override,
after the F ledger template, degenerate custom pattern) reviewed:

- The editor, the live `config.staff` / `config.ledgers` JSON panel, and the
  Module 3 + Module 5 preview stay in agreement through every interaction —
  the slices the editor emits are exactly what the rendering modules consume.
- Switching 4-8 → 3-6-9 redraws the staff from 4 to 6 continuous lines and
  the derived panel flips to sps 3 / positions (-3 -2 -1 1 2 3), matching
  Module 11's `computeStaffLinePositions` formula (parity is unit-tested).
- The per-line override paints *both* per-octave instances of the semi-3
  line red (abs 3 and 15) while the defaults stay black — overrides are
  keyed by semitone-within-octave, as the schema specifies.
- The added F template produces ledger dashes in the F and F′ columns only
  (octave-aware), and D's column shows the C+D ledger pair from the default
  override templates.
- Validation pass-through reacts live: dropping to one staff line surfaces
  the Module A "at least 2" error inline and removes the valid banner;
  restoring a second line restores it.
