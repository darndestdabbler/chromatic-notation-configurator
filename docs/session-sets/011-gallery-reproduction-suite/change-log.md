# Change log — `011-gallery-reproduction-suite`

Final-session change log for the set (written at session-2 close per the shared
close gate; `docs/dabbler/start-here.md` Step 5).

## What the set delivered

An expanded, mechanically-gated **gallery reproduction fixture corpus** and the
**worked fidelity evidence base** for the set-012 notation-builder playbook.
Each fixture is a reproduction *study* of a published musicnotation.org system
(IP framing per project-plan §5), authored as partial-over-default JSON config
and loaded through the real UI pipeline.

### Session 1 — Tier-1 reproductions (8 systems)
- Fixtures for the 8 firm Tier-1 targets: Ambros, Notagraph, Numbered Notes
  (Notes-Only), Hass 3-Line, Schoenberg, AxLoMaFi, Avique, 0-5-7.
- `cnb/tests/check-gallery-examples.js` — the mechanical gate (every fixture
  validates, resolves noteheads for 12 PCs across its durations, and exports a
  `.ly`), registered with the main runner.
- `docs/research/gallery-survey/reproduction-report.md` — per-system fidelity
  notes; reconciled against the operator's `gallery-config.xlsx` reference.
- Human UAT: acceptable-with-noted-deviations for all 8 (`s1-uat.md`).

### Session 2 — Tier-2 reproductions + Tier-3 partial + full report (9 systems)
- Tier-2 fixtures (8): Lautus, Trilinear, Clairnote SN, Clairnote DN,
  Chromatic Lyre, Express Stave (Pianoforte / 6-6 Jazz / Original), exercising
  the set-009 **custom clef** (register-label mode) and set-010 **custom key
  signature** (notehead-chords, on the Clairnote fixtures) capabilities.
- Tier-3 partial fixture (1): 6-6 Trigram, with its grouped-ledger behavior.
- Reproduction report extended with session-2 fidelity notes, the operator's
  `Effective Ledger Rules` reconciliation, a **platform-feature gap list
  (A–D)**, and the completed per-system summary table.
- `cnb/uat/uat-gallery-previews.mjs` extended to render key signatures for
  keysig-enabled fixtures.
- Human UAT: a four-round product collaboration (`s2-uat.md`);
  acceptable-with-noted-deviations for all 9, closed with the gaps documented.

## Corrections and findings recorded (not code changes to the platform)

Per the set's non-goals, no new platform features were built. Targets found to
need one were documented, and the feasibility matrix flagged:

- **Feasibility-matrix correction (`feasibility-matrix.md` §8):** Express Stave
  (records 43–45) additionally break invariant **I4** (bounded staff) — the
  matrix had tiered them "Tier 2 (E1 only)".
- **Platform-feature gaps (reproduction-report gaps A–D):** (A) ledger
  octave-region rule (suppress a ledger when a staff line intervenes),
  (B) bounded staff extent / I4, (C) notehead vertical-offset / top-alignment,
  (D) polished glyph SVG assets.
- **Operator-directed corrections to three session-1 fixtures** (Hass,
  Numbered-Notes, AxLoMaFi ledgers + AxLoMaFi slant glyph) under the owner's new
  `Effective Ledger Rules` reference — recorded as a Touches amendment in
  `spec.md`.

## Strategic direction recorded

The task owner's standing goal — **eventually support the full gallery** (incl.
the Tier-4 families) for community buy-in — is recorded as a strategic note in
the reproduction report; the tier/gap inventory is the ordered feature roadmap
toward full coverage. Feeds set 012.

## End-of-set deliverables (all present)

- `cnb/assets/examples/gallery/` — 17-fixture corpus with attribution.
- `cnb/tests/check-gallery-examples.js` — repeatable corpus gate (passes).
- `docs/research/gallery-survey/reproduction-report.md` — per-system fidelity
  evidence with human-attested UAT outcomes, gap list, and summary table.

## Tests at close
- `node cnb/tests/run-tests.js` — 709 passed (700 base + 9 gallery fixtures).
- `node legacy/run-tests.js` — 240 passed.
- `node cnb/tests/check-gallery-examples.js` — 17/17 fixtures pass.
