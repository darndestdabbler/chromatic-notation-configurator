# Session 2 UAT — Config Export / LilyPond (Module 18)

**Date:** 2026-07-05
**Scope:** per-session (spec `uatScope: per-session`, `uatStyle: dsl`)
**Surface:** `cnb/test-pages/test-config-export.html` (hosts Module 18 wired
to the set-004 Palette Editor (Module 12) and the set-005 Staff/Ledger Rule
Editor (Module 13) and Common Properties Editor (Module 15) through a
single shared config object — the session-set 006 UI-shell integration
pattern; the "configure … through the sets 004–005 editors" step drives one
editor from each set)
**Execution:** headless Chromium (Playwright / ms-playwright cache chromium)
driving the page over a local static server, with real browser downloads
captured (`acceptDownloads`); screenshots reviewed. As in sets 004–006 s1,
the dabbler-uat-dsl compiler pipeline (W0) is still in bootstrap, so the
checklist below is authored in the DSL's label-based step style and is
executed by the checked-in Playwright driver `cnb/uat/uat-config-export.mjs`
(`node cnb/uat/uat-config-export.mjs`; see its header for the
playwright-core / Chromium environment knobs); it can be recompiled through
the DSL pipeline once W1/W2 land.

The parity check (spec step 3: downloaded contents "match a direct
`CNBLilypond.generate()` call on the same config") runs the direct call in
the **driver's Node process** on the full config read from the page's live
state panel — an independent second execution environment, not a
browser-side self-comparison.

## Checklist (DSL style) and results

```
NAVIGATE TO "/cnb/test-pages/test-config-export.html"
EXPECT PAGE with title containing "Config Export"                           → PASS
EXPECT EXPORT PANEL button, filename preview "default48.ly"
       (derived from meta.fileSuffix "-Default48")                          → PASS
EXPECT STATE PANEL full default config — 4-8 pattern, shape mode,
       fileSuffix "-Default48"                                              → PASS
EXPECT EDITORS (Modules 12 + 13 + 15) mounted on the shared config          → PASS

CLICK PALETTE PRESET "Dark2 - 3 colors"  (set-004 editor, Module 12)
CLICK STAFF PATTERN "3-6-9"              (set-005 editor, Module 13)
CLICK MODE OPTION "repeat"               (set-005 editor, Module 15)
EXPECT shared config: 12 per-PC palette colors (first #1b9e77) with
       scheme symbols                                                       → PASS
EXPECT shared config: pattern [3,6,9], semitonesPerStaffSpace 3,
       representationMode repeat                                            → PASS

CLICK EXPORT                        (real download captured)
EXPECT download suggested filename "default48.ly"                           → PASS
EXPECT file is a complete .ly — \version declaration, Sections A/B/C        → PASS
EXPECT 3-6-9 staff geometry in Section B (semitones-per-staff-space 3,
       staff-line-positions)                                                → PASS
EXPECT repeat mode in Section C ((repeat . #t) clauses)                     → PASS
EXPECT the set-004 palette in Section A (cnb:register-color!
       shamrock-1b9e77)                                                     → PASS
EXPECT status "Exported as default48.ly"; error area empty                  → PASS
EXPECT validation area: "Config valid ✓" + Module A warnings, no errors     → PASS

COMPARE downloaded .ly to a direct CNBLilypond.generate() call on the
same config, run in Node (independent of the browser)
EXPECT byte-identical contents                                              → PASS

CLICK STAFF PATTERN "Custom pattern" (break the config via the editor)
CLICK PC TOGGLE 3 off; CLICK PC TOGGLE 6 off   (leaves single line [9])
EXPECT shared config: pattern [9]                                           → PASS

CLICK EXPORT
EXPECT no download fired                                                    → PASS
EXPECT status "Export blocked — fix 1 error below" with the
       .cnb-cex-status-blocked styling class; error area empty              → PASS
EXPECT the WHY listed in the validation area — "Staff pattern must have
       at least 2 semitone positions" (spec step 2)                         → PASS
EXPECT no valid badge; warnings still listed                                → PASS

CLICK STAFF PATTERN "3-6-9"          (fix)
CLICK EXPORT
EXPECT download succeeds again; contents identical to the first export      → PASS
EXPECT validation area back to valid badge, no error rows                   → PASS

EXPECT NO console or page errors across the whole flow                      → PASS
```

**Result: 22/22 checks passed** (driver exit code 0). Screenshots and the
exported `.ly` files were written to the driver's `CNB_UAT_SHOTS` directory
(`uat-006-s2-initial.png`, `uat-006-s2-configured.png`,
`uat-006-s2-exported.png`, `uat-006-s2-blocked.png`, `uat-006-s2-fixed.png`,
plus `uat-006-s2-exported.ly` / `uat-006-s2-fixed.ly`) and reviewed: the
configured screenshot shows the Dark2 3-color preset selected in the
palette editor, the 3-6-9 system selected in the staff editor and repeat
mode in the properties editor; the exported screenshot shows "Exported as
default48.ly" with the valid badge and warnings; the blocked screenshot
shows the single-line custom pattern, the amber "Export blocked — fix 1
error below" status, and the staff-pattern error listed in both the export
panel and the staff editor's own validation area.
