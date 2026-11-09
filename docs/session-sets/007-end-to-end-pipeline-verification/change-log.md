# Change log — 007-end-to-end-pipeline-verification

**Session set:** `docs/session-sets/007-end-to-end-pipeline-verification/`
**Sessions:** 2 (s1 2026-07-05 diagnostic, s2 2026-07-05 fixes + documentation)
**Milestone:** this set closes the ecosystem's **shared release gate** — a
notation system designed in this repo's Configurator, exported as `.ly`,
renders through the `lilypond-chromatic-notation-base` engine with no
discrepancies against the engine repo's golden baseline.

## Session 1 — Full pipeline round-trip and baseline diff (diagnostic)

- Built the Kite 4-369 reproduction fixture
  (`cnb/fixtures/kite-4-369-config.json`), the headless export driver
  (`cnb/fixtures/export-kite-4-369.mjs`), the round-trip score
  (`cnb/fixtures/joy-to-the-world-configurator.ly`), and the two-phase UI
  driver (`cnb/uat/uat-kite-pipeline.mjs`: author-through-editors phase +
  fixture-load phase, export byte-parity).
- Rendered the export through the engine and diffed against the golden
  baseline three ways (exhaustive structural harvest diff, the engine's
  101-assertion golden spec, Chromium pixel diff).
- Cataloged every discrepancy with ownership
  (`s1-discrepancy-catalog.md`): D1 missing `cnb:use-procedure-model`
  emission (blocker), D2 staff-line positions in the wrong unit (major),
  D3 `-0.0000` path-text artifact (cosmetic non-defect), D5 anchor units
  (major, latent), D6 minim anchors not authorable (toolkit coordination),
  E1 stale engine test score (engine coordination).
- Verification: **VERIFIED** (7 rounds, `s1-verification.md`).

## Session 2 — Fix discrepancies and document the workflow

### Product code (`cnb/`)

- **D1 fixed** — `cnb/src/cnb-lilypond.js` `sectionB()` always emits
  `#(set! cnb:use-procedure-model #t)` (the engine defaults to the vector
  model and silently ignores Sections A/C without it).
- **D2 fixed** — `computeStaffLinePositions()` emits LilyPond
  half-staff-space units: `2 × (S − midpoint) / semitonesPerStaffSpace`
  (4-8 → `'(-4 -2 2 4)`; 3-6-9 → the engine reference's
  `'(-6 -4 -2 2 4 6)`). `cnb/ui/staff-rule-editor.js` `derivedGeometry()`
  carries the same fix (exporter parity is unit-tested).
- **D5 fixed** — shape `lilypondAnchors` are canonically **semitone**
  units; the exporter's `attachmentPoints()` converts to staff-space
  units (÷ sps) at export time, in both the stored-anchors and the
  SVG-fallback paths. `cnb/ui/svg-importer.js` documents the semitone
  contract; `cnb/fixtures/kite-4-369-config.json` anchors rescaled to
  semitone units (exports the engine reference's 0.9 / ±0.365).
- Tests updated/added: `cnb/tests/cnb-lilypond-tests.js` (new D1 test,
  corrected D2/D5 expectations, legacy-parity divergences pinned
  explicitly), `cnb/tests/cnb-staff-rule-editor-tests.js` (corrected
  geometry), UAT drivers `uat-kite-pipeline.mjs` (D5 pins → fixed
  assertions, D1/D2 assertions added) and `uat-staff-rule-editor.mjs`.
  Suites: **cnb 556/556, legacy 240/240**.

### Round-trip result (the set's UAT pass, `s2-uat.md`)

With **zero hand patches**: engine golden assertion suite **74/74** on
both the golden and the round-trip render; exhaustive structural diff
**21/191 elements differing — all the documented D3 path-text artifact**
(pixel-equivalent geometry); visual pixel diff **0 differing pixels** at
4× (323,128 px) and 16× (5,170,048 px); UI download byte-identical to the
rendered headless export; all 7 browser UAT drivers pass (184 checks).

### Documentation

- `README.md` — end-to-end usage walkthrough (install the Inkscape
  extension → author a shape → import → assign rules → export `.ly` →
  render with the engine), corrected repo links/entry point/structure,
  updated status for the closed release gate.
- `docs/CNB-LY-EXPORT-SPEC-v1_2.md` → **1.2.1**: `cnb:use-procedure-model`
  added to §5.1 Always Emitted and Appendix A; half-staff-space unit
  conversion documented; change-log entry added.
- `docs/CNB-ARCHITECTURE-PLAN-v2.md` — §4.3 conversion formula/example
  corrected (×2 factor, with a correction note); §4.2 anchor units and
  conversion timing corrected; §9 Section B table gained the
  `cnb:use-procedure-model` row.
- `s2-cross-repo-coordination.md` — handoff to the engine repo (README
  render-side walkthrough half, E1 stale test score, D3 `-0` hash
  normalization, LY spec 1.2.1 sync, vector-model-removal FYI) and the
  toolkit repo (D6 minim-anchor authoring, semitone-unit convention).

## Deliverable state at close

- Confirmed discrepancy-free round-trip: new `cnb/` codebase → `.ly`
  export → engine render → pixel-identical match against the golden
  baseline (the only structural residue is the cataloged D3 cosmetic
  text artifact, disposed as not-a-defect).
- `README.md` documents the full workflow end-to-end, linked with the
  engine repo's README (render-side half handed off).
- The shared cross-repo release gate is closed.
