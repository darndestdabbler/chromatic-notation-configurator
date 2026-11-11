# Change log — session set 005: Rule editors

**Set:** `005-rule-editors` (tier: full, 3 sessions)
**Completed:** 2026-07-05
**Prerequisite:** `004-svg-import-and-palette-editor` (complete)

This set built the three rule-editing UI modules of Phase 5 (architecture
plan §6), letting a user configure a notation system without writing JSON
or Scheme by hand. All three read/write config slices per the Module A
schema, report through `onChange` with ready config objects, run their UI
against a stub DOM in Node unit tests, and were UAT-verified in headless
Chromium with checked-in Playwright drivers (`cnb/uat/`).

## Session 1 — Staff/Ledger Rule Editor (Module 13) — VERIFIED

- `cnb/ui/staff-rule-editor.js`: staff pattern selection (4-8, 3-6-9,
  custom per-PC toggles), derived geometry panel (GCD
  semitones-per-staff-space ported from legacy, exporter-formula LilyPond
  staff-line-positions with Module 11 parity), staff line defaults and
  per-line overrides (`staff.lineOverrides`, retained in state and pruned
  to the active pattern at emit), ledger template editing
  (`ledgers.templates`: position, trigger PCs, trigger mode), proximity
  rule and ledger defaults; live preview composing Modules 1/3/5.
- `cnb/tests/cnb-staff-rule-editor-tests.js` (+ runner registration),
  `cnb/test-pages/test-staff-rule-editor.html`,
  `cnb/uat/uat-staff-rule-editor.mjs`, `s1-uat.md`.

## Session 2 — Notehead Rule Editor (Module 14) — VERIFIED

- `cnb/ui/notehead-rule-editor.js`: create/edit/reorder/remove cumulative,
  priority-ordered notehead rules with full `match` (pitch classes,
  durations, keys) and `apply` (shape, hollow, color, offKeyMark) editing
  per plan §4.5 partial-apply semantics; a live resolved strip per pitch
  class (duration and key context selectable) surfacing
  `CNBConfig.resolveNotehead()` directly in the editor, plus a Module 6
  notehead preview row.
- `cnb/tests/cnb-notehead-rule-editor-tests.js` (+ runner registration),
  `cnb/test-pages/test-notehead-rule-editor.html`,
  `cnb/uat/uat-notehead-rule-editor.mjs`, `s2-uat.md`.

## Session 3 — Common Properties Editor (Module 15) — this session

- `cnb/ui/common-props-editor.js`: duration definitions as a read-only
  list (spec-sanctioned option), `representationMode` toggle
  (shape/repeat) with inline help naming the exporter's Section C
  `repeat` field (LY spec §6.1), `repeatCounts` editing (integers ≥ 1,
  retained in state / pruned to definition names at emit), and the full
  plan §4.10 engine block (lilypondVersion, falseHollow, multinotePadding,
  defaultMagnify as fraction-preserving string, indent,
  collisionThreshold, stemThickness with engine-auto toggle,
  useAccessibleColors) with emit-if-changed badges mirroring Module 11's
  Section B defaults; `renderPreview()` drives Module 10 (Card
  Collection) mode-dependently — one captioned row per duration in shape
  mode, single base row plus repeat legend in repeat mode (quad-notehead
  layout deferred per plan §11).
- `cnb/tests/cnb-common-props-editor-tests.js` (+ runner registration),
  `cnb/test-pages/test-common-props-editor.html`,
  `cnb/uat/uat-common-props-editor.mjs`, `s3-uat.md`.

## End-of-set state

- Deliverables per spec: Modules 13, 14, 15 in `cnb/ui/` at parity with
  the corresponding legacy UI behavior (legacy code untouched, reference
  only).
- Full unit suite green: `node cnb/tests/run-tests.js` — 464 tests, 0
  failures (43 added this session).
- `docs/session-sets/006-config-io-export-and-preview/` is unblocked
  (depends on this set and on set 004).
