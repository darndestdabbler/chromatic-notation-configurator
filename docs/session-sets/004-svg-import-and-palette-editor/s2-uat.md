# Session 2 UAT — Palette Editor (Module 12)

**Date:** 2026-07-05
**Scope:** per-session (spec `uatScope: per-session`, `uatStyle: dsl`)
**Surface:** `cnb/test-pages/test-palette-editor.html`
**Execution:** headless Chromium (Playwright 1.61 / chromium-1223) driving the
page over a local static server; screenshots reviewed. As in session 1, the
dabbler-uat-dsl compiler pipeline (W0) is still in bootstrap, so the checklist
below is authored in the DSL's label-based step style and was executed by an
equivalent Playwright driver script (scratchpad `uat-s2.mjs`); it can be
recompiled through the DSL pipeline once W1/W2 land.

## Checklist (DSL style) and results

```
NAVIGATE TO "/cnb/test-pages/test-palette-editor.html"
EXPECT PAGE with title containing "Palette Editor Test"                     → PASS

EXPECT TABS with two family buttons, "Standard" active                      → PASS
EXPECT PRESET LIST with six standard presets grouped by size                → PASS
EXPECT OPTION "Dark2 · 3 colors" selected by default                        → PASS
EXPECT JSON PANEL palette.name = "Dark2 · 3 colors"                         → PASS
EXPECT JSON PANEL 12 per-PC colors cycling the 3-color pool (pc3 = pc0)     → PASS
EXPECT JSON PANEL schemeSymbols["#1b9e77"] = "shamrock-1b9e77" (LY §4.5)    → PASS
EXPECT PREVIEW STRIP with 12 pitch-class cells, C = #1b9e77                 → PASS
EXPECT CB-MATCH PANEL with 3 rows showing name and ΔE per pool color        → PASS
EXPECT RESOLVE STRIP (CNBConfig.resolveColor round trip), C = #1b9e77       → PASS
EXPECT ATTRIBUTION note (ColorBrewer / Paul Tol), no notation-system names  → PASS

CLICK OPTION with caption "Dark2 · 7 colors"
EXPECT JSON PANEL palette.name = "Dark2 · 7 colors"                         → PASS
EXPECT JSON PANEL 7 unique primary hexes across the 12 PCs                  → PASS
EXPECT CB-MATCH PANEL with 7 rows                                           → PASS

CHECK TOGGLE "Use colorblind-safe alternative colors"
EXPECT JSON PANEL useCBSafe = true                                          → PASS
EXPECT PREVIEW STRIP C swatch shows the CB alternative (≠ primary)          → PASS
EXPECT RESOLVE STRIP C = cbSafeColors[0].hex (Module A honors the toggle)   → PASS
UNCHECK TOGGLE

CLICK TAB with caption "Colorblind-safe"
EXPECT SELECTED PRESET remapped to same size ("CB-Safe · 7 colors")         → PASS
EXPECT JSON PANEL identity mapping (cbSafeColors[i] = colors[i], LY §4.5)   → PASS
EXPECT CB-MATCH PANEL hidden (CB-safe-as-primary)                           → PASS
CLICK TAB with caption "Standard"

CLICK BUTTON with caption "Custom palette"
EXPECT JSON PANEL name "Custom · 3 colors", legacy seed colors              → PASS
EXPECT NEAREST-NAME LINE with three name-hex entries                        → PASS
SET COLOR INPUT 1 to "#123456"
EXPECT JSON PANEL colors[0].hex = "#123456"                                 → PASS
CLICK BUTTON "+" (add color)
EXPECT JSON PANEL name "Custom · 4 colors", 4 distinct hexes                → PASS
CLICK BUTTON "×" (remove first color)
EXPECT JSON PANEL name "Custom · 3 colors"                                  → PASS

CLICK TAB with caption "Colorblind-safe" (custom still selected)
EXPECT WARNING about untested custom CB-safe palettes                       → PASS
EXPECT JSON PANEL identity mapping (custom as CB-safe-as-primary)           → PASS

EXPECT NO console or page errors across the whole flow                      → PASS
```

**Result: 27/27 checks passed.**

## Visual review

Full-page screenshots (default preset, CB-safe toggle on Dark2 · 7, custom
palette) reviewed:

- The editor, the live `config.palette` JSON panel, and the independent
  `CNBConfig.resolveColor` round-trip strip stay in agreement through every
  interaction — the object the editor writes is exactly what Module A reads
  back.
- Toggling CB-safe flips all 12 per-PC swatches to the greedy-matched
  alternatives (Teal→Teal ΔE 2.9 … Brown→Crimson ΔE 35.4 on Dark2 · 7), and
  the resolve strip follows.
- Custom editing shows live CIEDE2000 nearest-name matching
  ("Steel Blue-#377eb8 · Kelly Green-#4daf4a · Vermilion-#db3b3d") and the
  CB-match panel re-pairs on every edit.
- Attribution footnote present; no palette label or name references any
  external notation system (spec naming/attribution caution).
