# Session 1 UAT — Config Save/Load (Module 17)

**Date:** 2026-07-05
**Scope:** per-session (spec `uatScope: per-session`, `uatStyle: dsl`)
**Surface:** `cnb/test-pages/test-config-io.html` (hosts Module 17 wired to
the set-005 Common Properties Editor through a single shared config object —
the session-set 006 UI-shell integration pattern)
**Execution:** headless Chromium (Playwright / ms-playwright cache chromium)
driving the page over a local static server, with real browser downloads
captured (`acceptDownloads`); screenshots reviewed. As in sets 004–005, the
dabbler-uat-dsl compiler pipeline (W0) is still in bootstrap, so the
checklist below is authored in the DSL's label-based step style and is
executed by the checked-in Playwright driver `cnb/uat/uat-config-io.mjs`
(`node cnb/uat/uat-config-io.mjs`; see its header for the playwright-core /
Chromium environment knobs); it can be recompiled through the DSL pipeline
once W1/W2 land.

## Checklist (DSL style) and results

```
NAVIGATE TO "/cnb/test-pages/test-config-io.html"
EXPECT PAGE with title containing "Config Save/Load"                        → PASS
EXPECT IO PANEL save button, filename preview
       "default-4-8-system.cnb.json", .json file input                      → PASS
EXPECT STATE PANEL default config — created/modified null, shape mode,
       engine defaults                                                      → PASS
EXPECT EDITOR (Module 15) mounted on the shared config                      → PASS

CLICK MODE OPTION "repeat"          (edit via the set-005 editor)
SET REPEAT COUNT "Minim (Half)" to "3"
CHECK ENGINE "False hollow"
EXPECT shared config: repeat mode, repeatCounts.minim 3, falseHollow true   → PASS

CLICK SAVE                          (real download captured)
EXPECT download suggested filename "default-4-8-system.cnb.json"            → PASS
EXPECT saved file carries the edited state                                  → PASS
EXPECT meta.created and meta.modified stamped as ISO timestamps
       (first save: modified === created)                                   → PASS
EXPECT host adopted the stamped config (state panel shows timestamps)       → PASS
EXPECT status line "Saved as default-4-8-system.cnb.json"                   → PASS

CLICK SAVE again (≥1s later)
EXPECT meta.created preserved from save 1; meta.modified re-stamped later   → PASS

RELOAD PAGE                         (app state gone)
EXPECT app back at defaults — shape mode, falseHollow off, timestamps null  → PASS

SET FILE INPUT to the save-1 file   (load the JSON back)
EXPECT status "Loaded uat-006-s1-saved.cnb.json — Default 4-8 System"       → PASS
EXPECT validation area: "Loaded config valid ✓" + Module A warnings,
       no errors                                                            → PASS
EXPECT shared config restored — repeat mode, minim 3, falseHollow true,
       meta.created identical to save 1                                     → PASS
EXPECT the set-005 EDITOR reflects the reloaded state (repeat option
       selected, minim input "3", falseHollow checked)                      → PASS

SET FILE INPUT to a malformed file ("{ this is not json")
EXPECT error area "Load failed … not valid JSON"                            → PASS
EXPECT shared config and editor untouched (still the loaded state)          → PASS

EXPECT NO console or page errors across the whole flow                      → PASS
```

**Result: 19/19 checks passed** (driver exit code 0). Screenshots and the
captured save files were written to the driver's `CNB_UAT_SHOTS` directory
(`uat-006-s1-initial.png`, `uat-006-s1-saved.png`, `uat-006-s1-loaded.png`,
`uat-006-s1-malformed.png`) and reviewed: the loaded screenshot shows the
editor remounted on the reloaded state with the repeat option highlighted,
minim count 3, false-hollow checked, and the stamped timestamps in the
state panel.
