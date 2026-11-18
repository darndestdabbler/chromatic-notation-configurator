# Session 2 UAT — Notehead Rule Editor (Module 14)

**Date:** 2026-07-05
**Scope:** per-session (spec `uatScope: per-session`, `uatStyle: dsl`)
**Surface:** `cnb/test-pages/test-notehead-rule-editor.html`
**Execution:** headless Chromium (Playwright / chromium-1223) driving the
page over a local static server; screenshots reviewed. As in set 004 and
session 1, the dabbler-uat-dsl compiler pipeline (W0) is still in bootstrap,
so the checklist below is authored in the DSL's label-based step style and
is executed by the checked-in Playwright driver
`cnb/uat/uat-notehead-rule-editor.mjs`
(`node cnb/uat/uat-notehead-rule-editor.mjs`; see its header for the
playwright-core / Chromium environment knobs); it can be recompiled through
the DSL pipeline once W1/W2 land.

## Checklist (DSL style) and results

```
NAVIGATE TO "/cnb/test-pages/test-notehead-rule-editor.html"
EXPECT PAGE with title containing "Notehead Rule Editor"                    → PASS

EXPECT RULE LIST with 2 cards numbered in application order                 → PASS
EXPECT RULE NAMES "Default" and "Sharps are hollow"                         → PASS
EXPECT RESOLVED STRIP with 12 cells, duration select at "crotchet"          → PASS
EXPECT RESOLVED STRIP C solid, C♯ hollow (cumulative sharps rule)           → PASS
EXPECT RESOLVED STRIP explicit no-mark state visibly rendered ("no mark")   → PASS
EXPECT PREVIEW ROW with 12 notehead cells (Module 6 rendering)              → PASS
EXPECT PREVIEW C with 1 path (solid), C♯ with 2 paths (hollow cutout)       → PASS
EXPECT PREVIEW palette colors C #1b9e77, D #7570b3 (color null → palette)   → PASS
EXPECT JSON PANEL 2 rules, priorities [0,1], rule 2 apply hollow-only       → PASS
EXPECT VALIDATION line "Config valid ✓" (Module A pass-through)             → PASS

CLICK MOVE-UP on rule "Sharps are hollow"
EXPECT JSON PANEL order swapped, priorities renumbered [0,1]                → PASS
EXPECT RESOLVED STRIP C♯ solid (Default's hollow:false now applies last)    → PASS
EXPECT PREVIEW C♯ redrawn with 1 path (solid)                               → PASS
CLICK MOVE-DOWN on the same rule
EXPECT original order restored, C♯ hollow again                             → PASS

CLICK BUTTON "+ Add rule"
EXPECT 3 cards; new rule all/all/all, empty apply, priority 2               → PASS
EXPECT resolution unchanged by the no-op rule (C♯ still hollow)             → PASS
CHECK APPLY "Shape" on rule 3
EXPECT apply.shape seeded with first shape ("crotchet-minim")               → PASS
SELECT SHAPE "Diamond"
EXPECT JSON apply.shape "diamond"; strip shows Diamond for C                → PASS
EXPECT PREVIEW C path drawn with the diamond geometry                       → PASS
CHECK APPLY "Color" on rule 3
EXPECT palette mode emits color null                                        → PASS
SELECT COLOR MODE "Custom hex"; SET COLOR INPUT to "#cc0000"
EXPECT JSON apply.color "#cc0000"; strip swatch and preview fill follow     → PASS

CLICK DURATION PILL "crotchet" on rule 3 (while "All")
EXPECT match.durations narrows to [minim, semibreve, breve]                 → PASS
EXPECT crotchet strip reverts to Crotchet–Minim + palette color             → PASS
SELECT RESOLVED DURATION "minim"
EXPECT Diamond + #cc0000 apply again (rule matches minim)                   → PASS

CHECK APPLY "Off-key mark" on rule 3
EXPECT apply.offKeyMark false (explicit no-mark); strip cell agrees         → PASS
SELECT MARK MODE "Mark identifier"
EXPECT identifier seeded "cross"; strip "mark: cross"; 12 preview badges    → PASS
SET MARK INPUT to "flat-9"
EXPECT JSON apply.offKeyMark "flat-9"                                       → PASS

CLICK KEY PILL "C" on rule 3 (while "All")
EXPECT match.keys narrows to ["G"]                                          → PASS
EXPECT with "(no key)" context the rule stops matching — strip reverts      → PASS
SELECT RESOLVED KEY "G"
EXPECT Diamond + #cc0000 + mark flat-9 apply again                          → PASS

CLICK REMOVE on rule 3
EXPECT 2 rules; minim resolution reverts to the defaults                    → PASS
EXPECT VALIDATION still "Config valid ✓"                                    → PASS

EXPECT NO console or page errors across the whole flow                      → PASS
```

**Result: 34/34 checks passed.**

(The checklist was first executed as 27 checks; six key-match and
off-key-mark checks were added during verification round-1 remediation,
which made `match.keys` and `apply.offKeyMark` editable, and one
no-mark-visibility check was added during round-2 remediation, which
removed a host CSS rule that hid the explicit no-mark state. The full
34-check list was re-executed end to end after each change.)

## Visual review

Full-page screenshots (initial default rules, reordered rules, the new
diamond/red rule, the duration-narrowed state) reviewed:

- The rule cards, the textual resolved strip inside the editor, the Module 6
  notehead preview row, and the live `config.noteheadRules` JSON stay in
  agreement through every interaction — the slice the editor emits is
  exactly what `CNBConfig.resolveNotehead` consumes.
- Cumulative semantics are visible end-to-end: with the diamond/red rule 3
  active (shape + color only), the sharps' hollow cutout from rule 2 is
  *inherited* — the preview shows hollow red diamonds for C♯/D♯/F♯/G♯/A♯
  and solid red diamonds elsewhere, which is the §4.5 partial-apply model
  working (unset properties inherit from earlier matches).
- Reordering flips resolution correctly: moving "Sharps are hollow" above
  "Default" makes Default's `hollow: false` win (all solid); moving it back
  restores the hollow sharps. Priorities in the JSON always renumber to the
  displayed order.
- Duration matching is live in both directions: narrowing rule 3 away from
  crotchet reverts the crotchet-resolved strip to the base
  shape/palette-color, and switching the strip's duration selector to minim
  brings the diamond/red resolution back.
- Key matching and off-key marks are live end-to-end: narrowing rule 3 to
  key G stops it matching under the "(no key)" context and re-applies it
  (diamond, #cc0000, mark "flat-9") when the strip's key selector is
  switched to G; the mark identifier shows as text in the strip cells and
  as badges under the preview noteheads (the mark's visual treatment is
  deferred per the architecture plan §11.4).
- Validation pass-through stays green throughout, with the expected
  non-blocking warnings (no pre-baked LilyPond paths on the demo shapes,
  CB-safe palette smaller than primary).
