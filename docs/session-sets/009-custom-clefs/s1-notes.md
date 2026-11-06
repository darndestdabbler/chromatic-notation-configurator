# Set 009 Session 1 — Working notes

**Date:** 2026-07-06
**Scope authority:** `docs/research/gallery-survey/enhancement-requirements.md`
entry E1 (per the set spec's purpose block).

---

## 1. Scope adjustments forced by the requirements catalog (spec step 1)

Reading E1 against the spec's session-1 sketch forced two adjustments and
one schema-shape decision:

1. **Text/numeral register-label mode added to the schema and preview.**
   E1's requirements sketch explicitly includes "an optional text/numeral
   mode (render a register label instead of, or in addition to, a
   glyph)", and its scope note makes octave numerals/labels part of this
   entry (records 20 Lautus, 40 Chromatic Nydana; 9 driver records
   total). The session-1 sketch in the spec mentions only glyph import.
   Adjustment: `clef.glyphs[name]` entries carry
   `kind: "glyph" | "text"`; text entries render an SVG label sized by
   `textHeightSemis`. Import (session-1) and the UI editor (session 2)
   treat glyph entries as primary; text entries are author-editable
   config. "In addition to a glyph" (combined label+glyph) is NOT
   implemented — one active entry renders at a time; a combined device
   can be expressed as two entries in future work if a driver system
   requires it (none of the 9 drivers strictly needs both
   simultaneously to render a recognizable register cue).
2. **Per-definition anchors, not a section-level anchor.** E1: "named
   clef definitions …, **each with an anchor** (semitone position the
   glyph is registered to)". The spec sketch reads as a single
   section-level anchor semitone. Adjustment: `anchorSemi` lives on each
   `clef.glyphs[name]` entry, so switching the active clef preserves each
   definition's registration (Express Stave's F/B/D clefs sit at
   different positions by design). The session-2 UI's "anchor-semitone
   control" edits the active definition's field.
3. **Dedicated `clef.glyphs` map (decision the spec left open).** The
   spec offered "reusing the shapes storage contract or a dedicated
   clefGlyphs map — decide against the requirements catalog and document
   the choice". Decision: dedicated `config.clef.glyphs` map that REUSES
   the shapes field contract (svgPath, naturalHeight/Width,
   semitoneHeight, lilypondPath) but is stored separately, because
   (a) `config.shapes` entries feed notehead-specific machinery — rule
   `apply.shape` references, stem-anchor validation, the W3
   per-shape lilypondPath warning, the notehead-rule editor's shape
   list — all of which must not see clefs; (b) E1 itself specifies
   "named clef definitions (same dual-format pattern as `shapes`)",
   i.e. same pattern, not same container; (c) clef entries need fields
   shapes don't have (`kind`, `anchorSemi`, `viewBoxMinX/Y`) and lack
   fields shapes require (anchors). Session-2 note: `clef.glyphs` is an
   open-keyed map → add to `CNBConfigIO.REPLACE_PATHS`.

## 2. Anchoring decision (operator-requested investigation)

**Question (operator, session start):** is "the top of the clef symbol
coincides with a semitone value" a sufficient positioning contract, or
should the anchor be a floating-point offset? Operator evidence both
ways: Clairnote's and the operator's own clef SVGs top-align to a
semitone; the traditional treble clef and Express Stave's B clef seem to
break the rule.

**Investigation result: top-at-INTEGER-semitone is not a safe general
rule; the anchor must be a float.** Evidence gathered (web research
session, 2026-07-06, primary sources):

- **Bravura/SMuFL metrics** (`steinbergmedia/bravura`
  `bravura_metadata.json`): SMuFL registers clefs with the glyph origin
  on the STAFF LINE THE CLEF MARKS, and the bounding box extends
  fractionally from there. gClef bBox top = **+4.392 staff-spaces**
  above the G line — i.e. **1.392 SP ≈ 2.784 semitones (at 2 semis/SP)
  above the top staff line**: wildly non-integer. Even fClef/cClef,
  whose design intent is outer-edge-on-outer-line, overshoot by
  0.024–0.048 SP for optical correctness.
- **Clairnote** (`PaulMorris/LilyPond-Clairnote`, `clairnote.ly`): the
  2017 custom clefs are path stencils whose y=0 is the musical reference
  point, pinned to integer `clefPosition` (−5/0/+5); the measured path
  TOPS sit at fractional extents above that origin (treble +4.768, bass
  +1.051, alto +2.939 units). The interior anchor is integer-pinned;
  the glyph top is not.
- **Express Stave** (musicnotation.org; Keller's design statements): the
  F/B/D clefs "show where these three notes go on the stave" — marked-
  note registration, no top-edge alignment contract; the B clef was
  redesigned (bbox changed) while its marked-note anchor stayed fixed.

**Decision:** `anchorSemi` is the semitone position of the glyph's **top
edge**, stored as a **float**, validated as any finite number (warning
outside −24…72, no integer restriction; pinned by unit test "FLOAT
anchorSemi is accepted"). Rationale: any interior-feature registration
reduces to a fractional top anchor — `anchorSemi = markedPitchSemi + k`
where `k` is the (possibly fractional) semitone distance from the glyph
top down to the marking feature. Glyphs authored to the operator's
top-on-semitone convention simply use integer values; Bravura-style
designs use fractional ones. The grid needs no change
(`semiToY` is linear over the reals).

**Deferred (recorded, not implemented):** an optional glyph-internal
anchor attribute (e.g. `data-anchor-y`, SMuFL-style origin-on-marked-
line) would let authors register by the marking feature directly instead
of computing the top offset. That is Music Glyph Toolkit contract
surface (toolkit repo), not configurator schema — noted for the toolkit
backlog; the float top anchor already expresses every surveyed design.

## 3. Session-1 deliverable summary

- `cnb/src/cnb-config.js`: `clef` section (default
  `{ enabled: false, active: null, glyphs: {}, gutter: { paddingH: 12 } }`)
  + validation (enabled-gated: active reference, per-kind field checks,
  numeric anchorSemi with range warning). Disabled configs validate
  exactly as before.
- `cnb/fixtures/default-export-baseline.ly`: pre-change capture of
  `CNBLilypond.generate(createDefault())` (Date header normalized),
  taken BEFORE the schema change; the invariance test compares against
  it byte-for-byte (spec step 3). A second test pins clef-enabled ≡
  clef-disabled export (exporter blind to the section; see
  `s1-engine-coordination.md`).
- `cnb/src/cnb-clef.js`: pure renderer — `activeGlyph`, `measure`,
  `gutterWidth` (0 when disabled), `render` (glyph top at
  `semiToY(anchorSemi)`, left at `gutter.paddingH`; text mode em-box).
- `cnb/src/cnb-collection.js`: `div.clef-col` (spacers + `svg.clef-slice`)
  prepended inside `.pc-columns` when a clef is active; background staff
  SVG spans the gutter (staff lines run behind the clef). Zero layout
  change when disabled.
- `cnb/ui/svg-importer.js`: `extractClef` / `buildClefGlyph` /
  `parseClefSvgText` — toolkit `data-*` contract, glyph element
  `id="clef"` → `id="notehead"` → first `<path>`; viewBox min offsets
  captured so non-origin-centered SVGs register their top-left exactly;
  stem/anchor attributes not required (E1: clefs are stemless devices).
- `cnb/tests/cnb-clef-tests.js` (31 tests) registered in the runner;
  `cnb/test-pages/test-clef.html` (6 panels: integer anchor on the top
  staff line, float 22.784 anchor, 3-6-9 pattern, text numeral, full
  production row, disabled default).
- Suites: `node cnb/tests/run-tests.js` → 587 passed / 0 failed;
  `node legacy/run-tests.js` → 240/240.
