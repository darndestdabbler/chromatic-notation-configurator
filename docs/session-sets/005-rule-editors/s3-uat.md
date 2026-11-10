# Session 3 UAT — Common Properties Editor (Module 15)

**Date:** 2026-07-05
**Scope:** per-session (spec `uatScope: per-session`, `uatStyle: dsl`)
**Surface:** `cnb/test-pages/test-common-props-editor.html`
**Execution:** headless Chromium (Playwright / chromium-1223) driving the
page over a local static server; screenshots reviewed. As in set 004 and
sessions 1–2, the dabbler-uat-dsl compiler pipeline (W0) is still in
bootstrap, so the checklist below is authored in the DSL's label-based step
style and is executed by the checked-in Playwright driver
`cnb/uat/uat-common-props-editor.mjs`
(`node cnb/uat/uat-common-props-editor.mjs`; see its header for the
playwright-core / Chromium environment knobs); it can be recompiled through
the DSL pipeline once W1/W2 land.

## Checklist (DSL style) and results

```
NAVIGATE TO "/cnb/test-pages/test-common-props-editor.html"
EXPECT PAGE with title containing "Common Properties Editor"                → PASS

EXPECT DEFINITIONS list with 4 read-only rows in definition order           → PASS
EXPECT MODE "shape" selected; help text names (repeat . #f)                 → PASS
EXPECT REPEATS section inactive in shape mode, rows visible and editable    → PASS
EXPECT ENGINE block 8 rows; false-hollow badge default-omitted;
       stem "engine auto" checked with no number input in the DOM           → PASS
EXPECT PREVIEW with 4 captioned duration rows (Module 10, shape mode)       → PASS
EXPECT JSON PANEL shape mode, default counts, default engine                → PASS
EXPECT SECTION B omitting all emit-if-changed engine settings at defaults   → PASS
EXPECT REPEAT FIELD line "(repeat . #f)"                                    → PASS
EXPECT VALIDATION line "Config valid ✓" (Module A pass-through)             → PASS

CLICK MODE OPTION "repeat"
EXPECT option selected; help text names (repeat . #t)                       → PASS
EXPECT PREVIEW collapsed to the single base row, captions gone              → PASS
EXPECT LEGEND minim ×2, semibreve ×4, breve ×8 of the crotchet notehead     → PASS
EXPECT JSON representationMode "repeat"; Section C repeat field #t          → PASS
EXPECT REPEATS section no longer marked inactive                            → PASS

SET REPEAT COUNT "Minim (Half)" to "3"
EXPECT JSON repeatCounts.minim 3 and legend "3 × Crotchet (Quarter)"        → PASS

CHECK ENGINE "False hollow"
EXPECT JSON true; badge "non-default — will be emitted";
       Section B "#(set! cnb:false-hollow #t)"                              → PASS
SET ENGINE "Default magnify" to "3/2"
EXPECT JSON "3/2"; Section B "#(set! cnb:default-magnify 3/2)"              → PASS
UNCHECK ENGINE "Stem thickness" auto
EXPECT number input appears seeded with 2; Section B cnb:stem-thickness 2   → PASS
SET STEM THICKNESS to "1.5"
EXPECT JSON 1.5; Section B "#(set! cnb:stem-thickness 1.5)"                 → PASS
CHECK ENGINE "Stem thickness" auto again
EXPECT input removed from DOM; JSON null; Section B omits stem-thickness    → PASS

CLICK MODE OPTION "shape"
EXPECT 4 preview rows restored, legend gone, repeat field #f,
       edited minim count (3) retained in state                             → PASS
EXPECT VALIDATION still "Config valid ✓"                                    → PASS

EXPECT NO console or page errors across the whole flow                      → PASS
```

**Result: 24/24 checks passed.**

## Visual review

Full-page screenshots (initial shape mode, repeat mode, engine edits, back
to shape mode) reviewed:

- The representation-mode toggle visibly drives the Module 10 (Card
  Collection) preview: "shape" renders four captioned duration rows;
  "repeat" collapses to the single crotchet (base-duration) row with the
  repeat legend above it. With the *default* config the visible per-row
  differences in shape mode are the captions and the stems (semibreve and
  breve rows render stemless via `durations[].hasStem`); per-duration
  notehead shapes/hollowness come from duration-matched notehead rules
  (Module 14) which the default config does not define — that is the plan
  §4.5 resolution model, not the mode toggle's job. The quad-notehead card
  layout for repeat mode is deferred (plan §11 open question 3), which is
  why repeat mode shows the base row plus the textual legend carrying the
  counts the exporter will emit.
- The exporter wiring is visible end-to-end on the page: the Section C
  repeat-field line flips between `(repeat . #f)` and `(repeat . #t)` with
  the toggle (LY spec §6.1), and the live Section B panel gains/loses
  `#(set! cnb:false-hollow #t)`, `#(set! cnb:default-magnify 3/2)` and
  `#(set! cnb:stem-thickness …)` lines exactly as the emit-if-changed
  badges next to each engine field predict (LY spec §5.2).
- Repeat counts are retained in state across mode switches (the edited
  minim ×3 survives shape → repeat → shape), matching the editor's
  retain-in-state / prune-at-emit contract.
- The stem-thickness number input exists in the DOM only while "engine
  auto" is off — nothing is hidden with CSS — and toggling auto off again
  restores the last edited value (1.5).
- Validation pass-through stays green throughout, with the expected
  non-blocking warnings (no pre-baked LilyPond path on the default shape,
  CB-safe palette smaller than primary — the test page adds a demo palette
  for colored noteheads).
