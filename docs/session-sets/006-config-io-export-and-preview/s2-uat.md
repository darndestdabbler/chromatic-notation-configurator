# Session 2 UAT — Config Export / LilyPond (Module 18)

**Date:** 2026-07-05
**Scope:** per-session (spec `uatScope: per-session`, `uatStyle: dsl`)
**Surface:** `cnb/test-pages/test-config-export.html` (hosts Module 18 wired
to the set-005 Staff/Ledger Rule Editor (Module 13) and Common Properties
Editor (Module 15) through a single shared config object — the session-set
006 UI-shell integration pattern)
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
EXPECT EDITORS (Modules 13 + 15) mounted on the shared config               → PASS

CLICK STAFF PATTERN "3-6-9"         (configure via the set-005 editors)
CLICK MODE OPTION "repeat"
EXPECT shared config: pattern [3,6,9], semitonesPerStaffSpace 3,
       representationMode repeat                                            → PASS

CLICK EXPORT                        (real download captured)
EXPECT download suggested filename "default48.ly"                           → PASS
EXPECT file is a complete .ly — \version declaration, Sections A/B/C        → PASS
EXPECT 3-6-9 staff geometry in Section B (semitones-per-staff-space 3,
       staff-line-positions)                                                → PASS
EXPECT repeat mode in Section C ((repeat . #t) clauses)                     → PASS
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

**Result: 20/20 checks passed** (driver exit code 0). Screenshots and the
exported `.ly` files were written to the driver's `CNB_UAT_SHOTS` directory
(`uat-006-s2-initial.png`, `uat-006-s2-configured.png`,
`uat-006-s2-exported.png`, `uat-006-s2-blocked.png`, `uat-006-s2-fixed.png`,
plus `uat-006-s2-exported.ly` / `uat-006-s2-fixed.ly`) and reviewed: the
exported screenshot shows the 3-6-9 system selected in the staff editor,
repeat mode selected in the properties editor, "Exported as default48.ly"
with the valid badge and warnings; the blocked screenshot shows the
single-line custom pattern, the amber "Export blocked — fix 1 error below"
status, and the staff-pattern error listed in both the export panel and the
staff editor's own validation area.
