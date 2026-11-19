# LilyPond exporter — port legacy Sections A/B/C to the modular codebase

> **Purpose:** The release-blocking deliverable. Port `legacy/configurator-core.js`'s
> proven `.ly` export logic (Sections A/B/C) into the new `cnb/` module
> shape, reaching feature parity with the legacy monolith's exporter.
> **Session Set:** `docs/session-sets/003-lilypond-exporter/`
> **Created:** 2026-07-04
> **Workflow:** full
> **Prerequisite:** `002-composites` complete

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # a human should review generated .ly output against the legacy exporter's output
requiresE2E: false                     # pure export logic, no browser UI surface — covered by unit/parity tests instead
uatScope: per-set                      # single UAT pass at the end, comparing exporter output to legacy + the LY spec
uatStyle: ad-hoc                       # reviewing generated Scheme/.ly text, not a browser DSL flow
verificationMode: out-of-band-or-none  # Lightweight only: out-of-band-or-none (default) | dedicated-sessions; inert on Full
totalSessions: 2
prerequisites:
  - slug: 002-composites
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: per `docs/planning/project-plan.md`, this is flagged as the
> highest-risk session set in the whole three-repo ecosystem — nothing else
> can reach its own release gate until this repo's exporter is real.
> Automatic cross-provider verification is worth paying for here
> specifically.

---

## Project Overview

Per `docs/CNB-ARCHITECTURE-PLAN-v2.md` §6 "Phase 4: LilyPond Exporter
(Session 14)" and `docs/planning/project-plan.md` §3 "Phase 3", build
`cnb/src/cnb-lilypond.js` (Module 11) — **a port, not a re-implementation
from scratch**, of the already-proven logic in `legacy/configurator-core.js`.

Cross-check every section against `docs/CNB-LY-EXPORT-SPEC-v1_2.md` for the
exact export contract the `lilypond-chromatic-notation-base` engine expects:
cumulative notehead rules (shape/hollow/color as separate layered rule
types, resolved via `CNBConfig.resolveNotehead`), palette-based color
registration including the `cnb:use-accessible-colors` conditional block
(§4.5 of the LY spec), staff/ledger inline thickness-as-percentage styling
(§5.3), and the `memv`/`cond`-grouped Section C configuration procedure
(§6.1).

The architecture plan flags this as 1 session's worth of work, but also
flags it as the highest-risk set in the ecosystem — this spec budgets 2
sessions accordingly: one for Sections A and B (named definitions + engine
settings), one for Section C (the configuration procedure) plus
parity/validation testing against the legacy exporter's output.

**Non-goals:** no UI (sets 004–006) — the exporter is exercised via unit
tests and a config fixture in this set, not through a save/export button.
Full pipeline round-trip through the actual LilyPond engine is Phase 5
(set 007), not this set.

---

## Sessions

### Session 1 of 2: Section A (named definitions) and Section B (engine settings)

**Goal:** Port the path/hollow/attachment/color registration logic (Section
A) and the engine-settings + metadata emission logic (Section B) from
`legacy/configurator-core.js` into `cnb/src/cnb-lilypond.js`.

**Steps:**
1. Read `legacy/configurator-core.js`'s existing `.ly` export functions for
   Sections A and B before writing anything new — this is a port, not a
   redesign.
2. Build `CNBLilypond.header(config)` and `CNBLilypond.sectionA(config)`
   per architecture plan §5 "Module 11: LilyPond Exporter" and LY spec §3–4:
   path definitions (preferring `shapes[name].lilypondPath`, falling back to
   `svgPathToLilypond(svgPath)` conversion), path registrations, hollow
   cutout registrations, stem attachment registrations (4-point model), and
   the color-registration conditional block (`cnb:use-accessible-colors`)
   per LY spec §4.5.
3. Build `CNBLilypond.svgPathToLilypond(svgPath)` and
   `CNBLilypond.toSchemeSymbol(name, hex)` helpers per architecture plan's
   API list.
4. Build `CNBLilypond.sectionB(config)` per LY spec §5: staff geometry
   (`cnb:semitones-per-staff-space`, `cnb:staff-line-positions` computed
   from `staff.semitonePattern` + `staff.midpoint` per architecture plan
   §4.3's conversion formula), emit-if-changed engine settings (LY spec
   §5.2 table), staff/ledger line thickness conversion (LY spec §5.3), and
   metadata (`cnb:file-suffix`, `cnb:notation-label`, `cnb:notation-footnote`).
5. Write `cnb/tests/cnb-lilypond-tests.js` covering Sections A and B: path
   conversion correctness, CB-safe conditional block structure, staff-line-
   positions conversion (4-8 system, midpoint=12, sps=4 → `(-2 -1 1 2)` per
   architecture plan §4.3 worked example), emit-if-changed omission of
   default engine values.
6. Run `node cnb/tests/run-tests.js` and `node legacy/run-tests.js` —
   confirm both suites pass (legacy untouched).

**Creates:** `cnb/src/cnb-lilypond.js` (Sections A/B + header + helpers),
`cnb/tests/cnb-lilypond-tests.js` (Section A/B test cases)

**Touches:** none outside `cnb/`

**Ends with:** `CNBLilypond.header()`, `CNBLilypond.sectionA()`, and
`CNBLilypond.sectionB()` produce output matching the LY spec's structure
for the default 4-8 config; all Section A/B unit tests pass.

**Progress keys:** `session-001/lilypond-section-a`, `session-001/lilypond-section-b`

---

### Session 2 of 2: Section C (configuration procedure) and parity validation

**Goal:** Port the cumulative-rule-resolution → `cond`/`memv`-grouped
Section C procedure, wire `CNBLilypond.generate(config)` end to end, and
validate output parity against the legacy exporter.

**Steps:**
1. Build `CNBLilypond.sectionC(config)` per LY spec §6: resolve all 12
   pitch classes (× durations if duration-aware) via
   `CNBConfig.resolveNotehead()`, group PCs with identical resolved configs,
   emit `cond` clauses using `memv` grouping (LY spec §6.1 worked example),
   and set the `repeat` field per `config.durations.representationMode`.
2. Wire `CNBLilypond.generate(config)` to concatenate header + Section A +
   Section B + Section C in the mandatory order (LY spec §2).
3. Run the export-validation checks from architecture plan §4.1 /
   LY spec §8 (shape/hollow/color/PC-coverage/staff-line-count/file-suffix/
   hex-format checks) — either as part of `CNBConfig.validate()` if not
   already covering all of these, or as exporter-side checks before
   `generate()` proceeds.
4. Write parity test cases in `cnb/tests/cnb-lilypond-tests.js`: PC
   grouping (identical configs merge into one `memv` clause), duration-aware
   compound conditions, and a direct comparison — export the default 4-8
   config through both `legacy/configurator-core.js` and the new
   `cnb/src/cnb-lilypond.js`, and diff the resulting `.ly` text for
   semantic equivalence (Section by Section, not necessarily byte-identical
   formatting).
5. Run `node cnb/tests/run-tests.js` and `node legacy/run-tests.js` —
   confirm both pass.
6. Manually review one full generated `.ly` file against
   `docs/CNB-LY-EXPORT-SPEC-v1_2.md`'s worked examples as the UAT pass for
   this set (per `uatScope: per-set` above).

**Creates:** Section C additions to `cnb/src/cnb-lilypond.js`, Section
C/parity test cases in `cnb/tests/cnb-lilypond-tests.js`

**Touches:** `cnb/src/cnb-lilypond.js` (adding `generate()`), `cnb/tests/cnb-lilypond-tests.js`

**Ends with:** `CNBLilypond.generate(config)` produces a complete, valid
`.ly` file from the default 4-8 config; its Section C output is
semantically equivalent to what `legacy/configurator-core.js` produces for
the same config; all tests pass; the manual UAT review against the LY spec
is complete.

**Progress keys:** `session-002/lilypond-section-c`, `session-002/lilypond-parity-validation`

---

## End-of-set deliverables

- `cnb/src/cnb-lilypond.js` (Module 11) — a working `.ly` exporter for the
  modular codebase, at feature parity with `legacy/configurator-core.js`'s
  Sections A/B/C.
- `cnb/tests/cnb-lilypond-tests.js` covering path conversion, color
  registration, staff geometry, engine settings, and Section C rule
  resolution/grouping.
- This is the milestone that unblocks
  `lilypond-chromatic-notation-base`'s Phase D (end-to-end verification) —
  flag completion back to that repo, or proceed directly to
  `docs/session-sets/007-end-to-end-pipeline-verification/`.
