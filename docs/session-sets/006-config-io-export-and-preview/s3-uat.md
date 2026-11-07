# Session 3 UAT — Preview Display + assembled application (Module 19, golden path)

**Date:** 2026-07-05
**Scope:** per-session (spec `uatScope: per-session`, `uatStyle: dsl`)
**Surface:** `cnb/index.html` (the application entry point — Modules 12–19
on one page, wired to a single shared config object: the SVG importer,
palette editor, staff/ledger rule editor, notehead rule editor, and common
properties editor write slices through change callbacks; the preview
display, config save/load, and LilyPond export read the same object
through `getConfig` accessors)
**Execution:** headless Chromium (Playwright / ms-playwright cache chromium)
driving the page over a local static server, with real browser downloads
captured (`acceptDownloads`) for both the JSON save and the `.ly` export;
screenshots reviewed. As in sets 004–006 s1/s2, the dabbler-uat-dsl
compiler pipeline (W0) is still in bootstrap, so the checklist below is
authored in the DSL's label-based step style and is executed by the
checked-in Playwright driver `cnb/uat/uat-golden-path.mjs`
(`node cnb/uat/uat-golden-path.mjs`; see its header for the
playwright-core / Chromium environment knobs); it can be recompiled through
the DSL pipeline once W1/W2 land. The Google Fonts CDN requests (Oswald,
preview-only cosmetics) are stubbed with empty responses so the run asserts
app behavior, not CDN availability.

Two parity checks run in the **driver's Node process** on the full config
read from the page's live state panel — an independent second execution
environment, not a browser-side self-comparison: the staff-line count in
the preview background is compared to a direct `CNBStaff.getPositions()`
call, and the exported `.ly` is byte-compared to a direct
`CNBLilypond.generate()` call.

## Checklist (DSL style) and results — the spec step 3 golden path

```
NAVIGATE TO "/cnb/index.html"
EXPECT PAGE title "Chromatic Notation Configurator"                         → PASS
EXPECT ASSEMBLY: all eight module roots mounted (Modules 12–19)             → PASS
EXPECT PREVIEW: full chromatic row on load — 13 cards, one caption-less
       duration row, 4 duration pills (crotchet on), no key control
       (keys disabled in the default config)                                → PASS
EXPECT STATE PANEL: full default config (4-8 pattern, one shape,
       shape mode)                                                          → PASS

SET FILE INPUT (Module 16 importer) = toolkit-style "uat-ellipse.svg"
       (100 units/semitone, stem placemarker rects, data-semitone-height,
       pre-baked data-lilypond-notehead/-hollow)
EXPECT status 'Imported shape "uat-ellipse"', no warnings                   → PASS
EXPECT shared config: shapes["uat-ellipse"] with semitoneHeight 2,
       pre-baked LilyPond paths, stem-rect anchors (bottom-center of
       the stem-up rect = {x:108.8889, y:0})                                → PASS
EXPECT notehead rule editor re-seeded — shape selects offer "uat-ellipse"   → PASS

CLICK PALETTE PRESET "Dark2 - 3 colors"    (set-004 editor, Module 12)
EXPECT shared config: 12 per-PC colors (first #1b9e77) + scheme symbols     → PASS
EXPECT preview re-rendered live — notehead paths carry fill #1b9e77         → PASS

CLICK STAFF PATTERN "3-6-9"                (set-005 editor, Module 13)
EXPECT shared config: pattern [3,6,9], semitonesPerStaffSpace 3             → PASS
EXPECT preview background staff re-rendered — line count equals a direct
       Node-side CNBStaff.getPositions() on the same config (8 lines)       → PASS

CLICK "+ Add rule"; CHECK Shape apply; SELECT shape "uat-ellipse"
                                           (set-005 editor, Module 14)
EXPECT shared config: 3 rules, rule 3 = match all / apply shape
       uat-ellipse                                                          → PASS
EXPECT preview re-rendered live — noteheads draw the imported ellipse path  → PASS

CLICK MODE OPTION "repeat"                 (set-005 editor, Module 15)
EXPECT shared config: representationMode repeat; option shows selected      → PASS

SELECT PITCH RANGE 4 to 8                  (Module 19 controls)
EXPECT 5 cards                                                              → PASS
CLICK DURATION PILL "minim" on
EXPECT two captioned duration rows, 10 cards                                → PASS
CLICK DURATION PILLS "crotchet" and "minim" off
EXPECT explicit empty message, no collection rendered                       → PASS
CLICK DURATION PILL "crotchet" on; SELECT PITCH RANGE 0 to 12
EXPECT full chromatic row again (13 cards)                                  → PASS

CLICK SAVE (Module 17; real download captured)
EXPECT download suggested filename "default-4-8-system.cnb.json"            → PASS
EXPECT meta.created / meta.modified stamped as ISO strings (plan §4.11)     → PASS
EXPECT the shell ADOPTED the stamped config — live state panel deep-equal
       to the downloaded file                                               → PASS
EXPECT the whole session's configuration in the file (uat-ellipse shape,
       12 colors, [3,6,9], repeat mode, 3 rules)                            → PASS

SET FILE INPUT (Module 17 load) = the file just saved
EXPECT round-trip fidelity — shared config after load deep-equal to the
       saved file                                                           → PASS
EXPECT loaded config reported valid in the IO panel                         → PASS
EXPECT every editor re-seeded from the loaded config (3-6-9, Dark2-3,
       repeat all selected; 3 rule cards) and preview still 13 cards        → PASS

CLICK EXPORT (Module 18; real download captured)
EXPECT download suggested filename "default48.ly"                           → PASS
COMPARE downloaded .ly to a direct CNBLilypond.generate() call on the
same config, run in Node (independent of the browser)
EXPECT byte-identical contents                                              → PASS
EXPECT the whole session's configuration in the .ly — register-path!
       'uat-ellipse, semitones-per-staff-space 3, (repeat . #t) clauses,
       shamrock-1b9e77                                                      → PASS
EXPECT status "Exported as default48.ly", valid badge, no error rows        → PASS

EXPECT NO console or page errors across the whole golden path               → PASS
```

**Result: 30/30 checks passed** (driver exit code 0). Screenshots and the
saved/exported files were written to the driver's `CNB_UAT_SHOTS` directory
(`uat-006-s3-initial.png`, `uat-006-s3-imported.png`,
`uat-006-s3-palette.png`, `uat-006-s3-staff.png`, `uat-006-s3-rule.png`,
`uat-006-s3-preview-controls.png`, `uat-006-s3-loaded.png`,
`uat-006-s3-exported.png`, plus `uat-006-s3-saved.cnb.json` /
`uat-006-s3-exported.ly`) and reviewed: the rule screenshot shows the full
assembled page with the preview drawing the imported ellipse noteheads in
the Dark2 palette over the 3-6-9 staff (hollow sharps visible as colored
outlines), all four editors reflecting the configured state, and the live
state panel carrying the full config; the loaded screenshot shows the IO
panel's "Loaded uat-006-s3-saved.cnb.json — Default 4-8 System" status with
the valid badge and every editor re-seeded from the loaded config,
including the repeat-mode repeat counts now active in Module 15 and rule 3
("Uat Ellipse") in the resolved-per-pitch-class strip.
