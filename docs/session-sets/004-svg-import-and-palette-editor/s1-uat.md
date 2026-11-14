# Session 1 UAT — SVG Shape Importer (Module 16)

**Date:** 2026-07-05
**Scope:** per-session (spec `uatScope: per-session`, `uatStyle: dsl`)
**Surface:** `cnb/test-pages/test-svg-importer.html`
**Execution:** headless Chromium (Playwright 1.61 / chromium-1223) driving the
page over a local static server; screenshots reviewed. The dabbler-uat-dsl
compiler pipeline (W0) is still in bootstrap and not yet consumable as a test
generator, so the checklist below is authored in the DSL's label-based step
style and was executed by an equivalent Playwright driver script
(scratchpad `uat-s1.mjs`); it can be recompiled through the DSL pipeline once
W1/W2 land.

## Checklist (DSL style) and results

```
NAVIGATE TO "/cnb/test-pages/test-svg-importer.html"
EXPECT PAGE with title containing "SVG Importer Test"                      → PASS

CLICK BUTTON with caption "Load built-in sample (2-semitone ellipse)"
EXPECT STATUS with text containing "Imported shape \"sample-ellipse\""     → PASS
EXPECT JSON PANEL field "semitoneHeight" = 2                               → PASS
EXPECT JSON PANEL fields "naturalWidth"/"naturalHeight" = 240/200          → PASS
EXPECT JSON PANEL anchor "crotchetUp" = (108.8889, 0)                      → PASS
EXPECT JSON PANEL minim anchors equal crotchet anchors                     → PASS
EXPECT JSON PANEL "lilypondPath" populated verbatim                        → PASS
EXPECT JSON PANEL "lilypondHollowPath" populated verbatim                  → PASS
EXPECT JSON PANEL "lilypondAnchors.crotchetUp" = (1.0889, 0)               → PASS
EXPECT WARNINGS LIST empty                                                 → PASS
EXPECT PREVIEW with 7 rendered notehead paths (5 heads + 2 hollow)         → PASS
EXPECT PREVIEW with 20 anchor-marker lines (5 × 2 anchors × 2 strokes)     → PASS

UPLOAD FILE "notehead_for_export.svg" (toolkit repo input fixture) via file picker
EXPECT STATUS with text containing "Imported shape \"notehead_for_export\"" → PASS
EXPECT WARNING containing "not <rect>" (path stems ignored)                → PASS
EXPECT WARNING containing "data-lilypond-notehead" (export fallback)       → PASS
EXPECT JSON PANEL "anchors" = null (stemless after ignoring path stems)    → PASS
EXPECT JSON PANEL "semitoneHeight" = 2 (from data attribute)               → PASS

UPLOAD FILE with malformed XML
EXPECT ERROR STATUS containing "Invalid SVG"                               → PASS

UPLOAD FILE without an id="notehead" element
EXPECT ERROR STATUS containing "notehead"                                  → PASS

EXPECT NO console or page errors across the whole flow                     → PASS
```

**Result: 20/20 checks passed.**

Re-run after verification round-1 remediation (the page now hosts the
module's reusable `CNBSvgImporter.renderImportControl` instead of page-local
file-picker wiring): **20/20 checks passed** — the file-picker steps above
exercise the module's control end-to-end.

## Visual review

Full-page screenshots (sample import and fixture import) reviewed:
- Extracted `config.shapes[name]` JSON shows the complete Module A entry
  (paths, natural dims, semitoneHeight, 4-point anchors, verbatim
  `lilypondPath`/`lilypondHollowPath`, import-time `lilypondAnchors`).
- Module 6 preview renders the imported ellipse solid at semitones 0/8,
  hollow at 12/20, and colored at 24, each centered on its semitone line at
  the correct 2-semitone size against the debug grid.
- Red (up) and blue (down) anchor crosshairs sit exactly at the shape's
  left/right extremes at mid-height, matching the stem placemarker geometry.
