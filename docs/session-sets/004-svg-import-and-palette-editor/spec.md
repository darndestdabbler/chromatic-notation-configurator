# SVG shape import and palette editor UI

> **Purpose:** Start rebuilding the user-facing UI on the new `cnb/`
> modules: the SVG shape importer (re-validating the Inkscape toolkit's
> `data-*` contract) and the palette editor (porting
> `music-color-palettes.js`'s standard + colorblind-safe palette system).
> **Session Set:** `docs/session-sets/004-svg-import-and-palette-editor/`
> **Created:** 2026-07-04
> **Workflow:** full
> **Prerequisite:** `003-lilypond-exporter` complete

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # real browser UI whose whole point is visual output
requiresE2E: true                      # module surface has stabilized past Phase 2 — Playwright coverage is now cheap to justify
uatScope: per-session
uatStyle: dsl                          # web/browser UI — Playwright via dabbler-uat-dsl
verificationMode: out-of-band-or-none  # Lightweight only: out-of-band-or-none (default) | dedicated-sessions; inert on Full
totalSessions: 2
prerequisites:
  - slug: 003-lilypond-exporter
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: same as prior sets in this repo — this is the highest-risk
> repo in the ecosystem for a naming/attribution slip (see
> `docs/planning/project-plan.md` §5) as well as the most active codebase,
> so cross-provider verification stays on for all UI work too.

---

## Project Overview

Per `docs/CNB-ARCHITECTURE-PLAN-v2.md` §6 "Phase 5: UI Components
(Sessions 15–20+)" and `docs/planning/project-plan.md` §3 "Phase 4", this is
the first of several UI-focused session sets (the plan explicitly calls for
splitting Phase 4/5 by module rather than running it as one large set).
This set covers:

- **Module 16 — SVG Shape Importer** (`ui/svg-importer.js`): reads SVG files
  exported by the sibling `inkscape-music-glyph-toolkit` to extract notehead
  paths and anchor points. Re-validate against the toolkit's `data-*`
  contract (`docs/CNB-LY-EXPORT-SPEC-v1_2.md` §7 "SVG Data Attributes
  Reference") — that repo's Phase B is the authority on what attributes it
  actually emits; confirm this importer reads exactly those, including the
  planned-but-maybe-not-yet-present `data-lilypond-notehead` /
  `data-lilypond-hollow` attributes (§7.2).
- **Module 12 — Palette Editor** (`ui/palette-editor.js`): color palette
  selection with CB-safe variant toggle, porting the existing, working
  behavior from `legacy/music-color-palettes.js` (do not modify the legacy
  file — read it as reference behavior only).

**Naming/attribution caution:** per `docs/planning/project-plan.md` §5, this
is the one repo with user-facing strings (palette names, tab labels). Do not
let any palette name or preset label imply this tool "generates" a named
external system (Clairnote SN, Chromatic Lyre Notation) unless that's
actually true and cleared — "inspired by / compatible in spirit with" with
citation is the safe default. If "Kite" is used as a label anywhere, make
clear it's this project's own coinage, unrelated to the "Kite Giedraitis"
xenharmonic/microtonal work.

**Non-goals:** notehead rule editing, staff/ledger rule editing, common
properties, save/load, export button, and full preview display are the next
two session sets (005, 006).

---

## Sessions

### Session 1 of 2: SVG Shape Importer

**Goal:** Build the SVG shape import UI module (Module 16), re-validated
against the Inkscape toolkit's current SVG `data-*` contract.

**Steps:**
1. Read the SVG `data-*` contract from `docs/CNB-LY-EXPORT-SPEC-v1_2.md`
   §7 and confirm it against a sample SVG export from
   `inkscape-music-glyph-toolkit` (if a sample is available in this repo's
   fixtures or can be sourced from that sibling repo) — flag any drift
   between what's documented and what the toolkit actually emits.
2. Build `cnb/ui/svg-importer.js` (Module 16) per architecture plan §5
   "Modules 12–19: UI Components" migration table: parse an uploaded/loaded
   SVG file, extract `svgPath`, `svgHollowPath`, `naturalHeight`,
   `naturalWidth`, `semitoneHeight` (from `data-semitone-height`), and the
   4-point anchor model (`data-stem-up-x/y`, `data-stem-down-x/y`) into a
   `config.shapes[name]` entry matching the Module A schema (architecture
   plan §4.2).
3. Handle the `data-lilypond-notehead` / `data-lilypond-hollow` attributes
   when present (populate `lilypondPath` / `lilypondHollowPath` directly);
   fall back gracefully to `null` (triggering the exporter's
   `svgPathToLilypond()` conversion path) when absent, per LY spec §7.2.
4. Build a minimal import UI (file picker + preview of the extracted shape
   against the debug grid, reusing Module 6's notehead renderer) so the
   import result is visually verifiable.
5. Write unit tests for the parsing/extraction logic (pure functions,
   independent of file-picker DOM wiring) in a new
   `cnb/tests/cnb-svg-importer-tests.js` or equivalent, following the
   project's `cnb-{module}-tests.js` convention.
6. Run `node cnb/tests/run-tests.js` — confirm all tests pass.

**Creates:** `cnb/ui/svg-importer.js`, `cnb/tests/cnb-svg-importer-tests.js`
(or equivalent test file name matching project convention)

**Touches:** none outside `cnb/`

**Ends with:** loading a sample notehead SVG through the importer UI
produces a correctly populated `config.shapes[name]` entry, verified
visually by rendering the imported shape with Module 6; unit tests pass.

**Progress keys:** `session-001/svg-importer-module`, `session-001/data-attribute-contract-check`

---

### Session 2 of 2: Palette Editor

**Goal:** Port the working palette system from `legacy/music-color-palettes.js`
into a new `cnb/ui/palette-editor.js` module (Module 12).

**Steps:**
1. Read `legacy/music-color-palettes.js` and the legacy palette-popup UI
   code in `legacy/chromatic-configurator.html` as reference behavior —
   this is a port, do not modify the legacy files.
2. Build `cnb/ui/palette-editor.js` (Module 12): palette selection (list of
   named palettes), the standard vs. CB-safe toggle (`palette.useCBSafe`),
   and color preview per pitch class, writing into `config.palette` per the
   Module A schema (architecture plan §4.6).
3. Preserve the CIEDE2000-based nearest-color-name matching
   (`nearestColorName()`) and Scheme-symbol generation (`toSchemeSymbol()`)
   behavior from the legacy palette library — these feed directly into the
   exporter's `palette.schemeSymbols` map (architecture plan §4.6 LY
   mapping table).
4. Apply the naming/attribution caution from this spec's Project Overview
   section to every palette name and label surfaced in this editor.
5. Write unit tests for palette selection, CB-safe toggle behavior, and
   color/name/symbol resolution.
6. Run `node cnb/tests/run-tests.js` and `node legacy/run-tests.js` —
   confirm both pass (legacy untouched).

**Creates:** `cnb/ui/palette-editor.js`, corresponding test file per
project convention

**Touches:** none outside `cnb/`

**Ends with:** the palette editor UI lets a user pick a palette, toggle
CB-safe mode, and see the resulting per-pitch-class colors, with the
underlying `config.palette` object correctly populated for the exporter to
consume; all tests pass.

**Progress keys:** `session-002/palette-editor-module`, `session-002/naming-attribution-check`

---

## End-of-set deliverables

- `cnb/ui/svg-importer.js` (Module 16) — validated against the current
  Inkscape toolkit `data-*` contract.
- `cnb/ui/palette-editor.js` (Module 12) — at parity with
  `legacy/music-color-palettes.js`'s working behavior.
- `docs/session-sets/005-rule-editors/` unblocked (depends on this set).
