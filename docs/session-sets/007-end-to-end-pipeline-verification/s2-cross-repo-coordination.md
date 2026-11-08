# Session 2 — Cross-repo coordination items

**Session set:** 007-end-to-end-pipeline-verification — Session 2 of 2
**Date:** 2026-07-05

This repo's fixes (D1, D2, D5) and documentation are complete as of this
session. The items below are owned by the other two ecosystem repos and are
handed off here per the project plan's "coordinate with that repo rather
than duplicating this verification work" rule and the session-1 catalog's
ownership attributions. Each item cites the catalog entry in
`s1-discrepancy-catalog.md`.

---

## For `lilypond-chromatic-notation-base` (engine repo)

1. **README render-side walkthrough half.** This repo's `README.md` now
   carries the design-side end-to-end walkthrough ("End-to-End
   Walkthrough: From Shape to Rendered Score") and links to the engine
   README for the render half (engine installation, including an exported
   config from a score, `lilypond -dbackend=svg`, the
   `cnb:use-accessible-colors` flag, and the harvest/assertion test
   tooling). The engine README should add that half and link back to the
   Configurator README's design half rather than duplicating it.

2. **E1 — stale `tests/joy-to-the-world.ly`.** The golden spec's
   `input_file` resolution reached the old vector-model score in session
   1, which no longer compiles (`Unbound variable: cnb:rose` after the
   `cnb/colors.ly` rename to `cnb:1-rose` etc.). Both 007 sessions worked
   around it by running `tools/run_tests.py` against spec copies whose
   `input_file` is an absolute path to the top-level procedure-model
   `joy-to-the-world.ly` (74/74 there both times). The checked-in golden
   suite should compile as checked in.

3. **D3 — `-0` normalization in path hashing.** Runtime-rotated paths
   (`cnb:rotate-path … 180`) print IEEE negative zero as `-0.0000`;
   pre-baked Configurator paths print `0`. Identical geometry, different
   `visual.path_hash`. Suggested: normalize `-0` before hashing in
   `tools/harvest_svg.py` so cross-config comparisons don't flag it. (Both
   007 sessions verified the 21 affected noteheads are geometry-identical;
   the 007-s2 round-trip is pixel-identical at 4× and 16× raster.)

4. **LY spec 1.2.1 sync.** This repo's `docs/CNB-LY-EXPORT-SPEC-v1_2.md`
   is amended to 1.2.1: `cnb:use-procedure-model #t` added to §5.1 Always
   Emitted and Appendix A (D1 — the engine defaults to the vector model
   and silently ignores Sections A/C without the flag), and §5.1 now
   documents the half-staff-space conversion
   `2 × (S − midpoint) / semitonesPerStaffSpace` (D2). The engine repo's
   copy of the spec should pick up the same amendment.

5. **FYI — vector-model removal.** The engine README's planned "vector
   model removal once the Configurator generates procedure-model configs
   end-to-end" is now unblocked: the 007 round-trip renders a
   Configurator-generated config pixel-identical to the golden baseline
   with zero hand edits. When the vector model is removed, the always-
   emitted `#(set! cnb:use-procedure-model #t)` line stays harmless
   (guarded assignment to an existing variable) — coordinate before
   removing the variable itself.

## For `inkscape-music-glyph-toolkit` (toolkit repo)

6. **D6 — minim-specific anchors are not authorable.** The toolkit SVG
   contract provides one stem up/down placemarker pair, so crotchet and
   minim anchors are identical at import time. The golden Kite config's
   minim attachments carry distinct x-offsets (±0.365 staff-spaces =
   ±1.095 semitones) for double-notehead (repeat-mode) layout —
   reproducible via a JSON fixture but not via the import pipeline. The
   toolkit should define minim-specific anchor output (e.g. an optional
   second placemarker pair or `data-stem-minim-*` attributes); this repo's
   importer (`cnb/ui/svg-importer.js`) will read them once defined. Anchor
   unit convention for the handoff: the importer stores anchors in
   semitone units (canonical); the exporter converts to staff-space units
   at export time (007-s2 D5 fix).
