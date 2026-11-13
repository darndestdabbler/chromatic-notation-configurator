# Session-set 003-lilypond-exporter — change log

**Set completed:** 2026-07-05 (2 sessions, both cross-provider VERIFIED)

## What this set delivered

Module 11 — `cnb/src/cnb-lilypond.js` — a complete `.ly` exporter for the
modular codebase at feature parity with `legacy/configurator-core.js`'s
Sections A/B/C, per CNB-LY-EXPORT-SPEC-v1.2 and architecture plan §5.

### Session 1 (2026-07-04) — Sections A/B + helpers

- `CNBLilypond.header()` — version/include + generated-by comment block (LY spec §3).
- `CNBLilypond.sectionA()` — path definitions (pre-baked `lilypondPath`
  preferred, `svgPathToLilypond()` fallback), path/hollow registrations,
  4-point stem attachment registrations (with SVG→LilyPond unit conversion
  fallback), and the `cnb:use-accessible-colors` conditional color block
  (LY spec §4.5) with unconditional black registration.
- `CNBLilypond.sectionB()` — always-emitted staff geometry
  (`cnb:semitones-per-staff-space`, `cnb:staff-line-positions` via the plan
  §4.3 midpoint formula), emit-if-changed engine settings (LY spec §5.2),
  thickness-as-percentage conversion (§5.3), and metadata (§5.4).
- Helpers: `svgPathToLilypond()`, `toSchemeSymbol()`, `computeStaffLinePositions()`.
- 34 unit tests. Verification round 1: VERIFIED.

### Session 2 (2026-07-05) — Section C + generate() + parity validation

- `CNBLilypond.sectionC()` — resolves all 12 pitch classes (× durations) via
  `CNBConfig.resolveNotehead()`, groups identical resolved configs into
  `memv`/`cond` clauses inside the `(let ((pc (modulo semitone 12))))`
  procedure (LY spec §6.1), emits duration-aware compound
  `(and <pc-cond> (= duration N))` clauses for pitch classes whose config
  varies by duration (§6.2), sets `(repeat . #t/#f)` from
  `durations.representationMode`, and ports the legacy fallback clause.
  Throws rather than emitting a wildcard when a needed duration lacks a
  numeric `lilypondDuration` (verification round 1 fix).
- `CNBLilypond.generate()` — header + A + B + C in the mandatory order
  (LY spec §2) behind the §8 export-validation checks (`CNBConfig.validate()`
  plus an exporter-side used-shape path-data check); throws on blocking errors.
- Parity validation: end-to-end test generates the default 4-8 config through
  both `CNBLilypond.generate()` and legacy `generateLy()` and compares section
  by section — Section A semantically identical line-for-line; Section B
  settings identical except `cnb:staff-line-positions`, where legacy's V1
  fixed symmetric placement (`'(-6 -4 -2 2 4 6)`) is superseded by the plan
  §4.3 formula (`'(-2 -1 1 2)`), both values pinned in the test; Section C
  fully semantically equivalent per pitch class.
- 19 more tests (lilypond suite: 53). Verification: round 1 ISSUES_FOUND
  (2 issues, both fixed — see `s2-issues.json`), round 2 VERIFIED.
- Manual UAT (per-set, `uatScope: per-set`): full generated `.ly` reviewed
  against the LY spec's worked examples — structure/order, comment
  conventions (§3.1), CB-safe conditional block (§4.5), staff geometry,
  `memv` grouping (§6.1); Scheme paren balance checked mechanically.

## Final state

- `node cnb/tests/run-tests.js`: 261 passed, 0 failed.
- `node legacy/run-tests.js`: 240/240 (legacy untouched).
- This milestone unblocks `lilypond-chromatic-notation-base` Phase D and
  `docs/session-sets/007-end-to-end-pipeline-verification/`.
