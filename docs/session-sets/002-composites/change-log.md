# Session set 002-composites — change log

Completes Phase 3 (Composites) of `CNB-ARCHITECTURE-PLAN-v2.md`: the four
composite rendering modules between the set-001 primitives and the set-003
LilyPond exporter.

## Session 1 — Ledger Set (Module 5), Double Notehead (Module 7)

- `cnb/src/cnb-ledger-set.js`: octave-aware proximity/override ledger
  display-rule engine (`buildDefs`, `isBetweenNoteAndStaff`, `resolve`,
  `render`); no outside-staff hard gate (3-6-9 gap case covered); staff
  pattern treated as periodic so viewport cropping cannot change ledger
  decisions.
- `cnb/src/cnb-double-notehead.js`: octave-pair notehead renderer with
  `offsetPercent` collision-avoidance layout (pure `layout()` + `render()`).
- `cnb/tests/cnb-ledger-set-tests.js` (34), `cnb-double-notehead-tests.js`
  (10), `cnb/tests/svg-stub.js` DOM stub for direct `render()` coverage.
- `cnb/test-pages/test-ledger.html` rebuilt around display rules (4-8,
  3-6-9, and proximity-mode cards).
- Verification: round 1 ISSUES_FOUND (render() coverage gaps) remediated
  with 10 registered render() tests; round 2 VERIFIED.

## Session 2 — Octave Chord Card (Module 9), Card Collection (Module 10)

- `cnb/src/cnb-card.js`: `resolveNotehead` (rule walk + concrete color:
  rule > palette > black), `columnWidth`, and `render` producing the
  `div.pc-col` / `div.label-top` / `svg.note-slice` / `div.label-bottom`
  structure; draws ledgers, stem (4-point anchors, direction from chord
  average vs staff midpoint, skipped for `hasStem: false` durations), and
  the octave pair; material-card Oswald labels with sharp-glyph styling.
- `cnb/src/cnb-collection.js`: `gridRange` + `render` producing
  `div.cnb-preview` with one captioned row per duration; each row is a
  `div.preview-container` holding a continuous `svg.staff-lines-bg`
  (offset down by the grid's `topLabelHeight`) behind a `div.pc-columns`
  flex row of cards; optional debug-grid overlay; `keys` accepted but
  deferred per the plan.
- 29 new tests (`cnb-card-tests.js` 20, `cnb-collection-tests.js` 9),
  including full render() DOM-structure coverage via `withDomStub`.
- `cnb/test-pages/test-card.html` (single cards with reference staff,
  durations, palette colors) and `cnb/test-pages/test-collection.html`
  (full chromatic row PCs 0–12, palette + duration rows, 3-6-9 pattern,
  debug grid) — the working full-chromatic-row preview deliverable.
- Verification: round 1 ISSUES_FOUND (container-API purity — adjudicated
  not-a-defect per the plan's own Module 9/10 contracts; sharp-offset
  comment fixed, fallback correctly mirrors the schema default −0.15;
  test-count prose corrected to 29); round 2 VERIFIED.

## End state

- Test suites: 208/208 CNB tests pass, 240/240 legacy tests pass.
- `docs/session-sets/003-lilypond-exporter/` is unblocked.
