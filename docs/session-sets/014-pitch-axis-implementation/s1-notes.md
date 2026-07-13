# Set 014, Session 1 — working notes

**Session:** 1 of 4 — Export-spec adoption + `CNBPitchAxis` + grid (P1, P2)
**Orchestrator:** claude-code / anthropic (Fable 5)
**Started:** 2026-07-12T19:37:52-04:00 (see `session-state.json`)
**Base commit:** `2cf7d6475dc15b61c9d137789547e71cbb6798f3` (clean tree at start;
the only working-tree entries at start were this set's lifecycle records
written by `start_session`).

---

## What was done, step by step

### Step 1 — Spec adoption + architecture-plan amendment (progress key `session-001/spec-adoption`)

1. **`docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md` → `docs/CNB-LY-EXPORT-SPEC-v1_3.md`**
   via `git mv` (a true rename, so `git log --follow` preserves the draft's
   history). Content unchanged except the status/adoption header: Version
   1.3, Status CANONICAL with the adoption chain (013 s2 draft → 014 s1
   adoption under the 013 s2 UAT authorization), an explicit "**the §8a
   fail-loud gate is IN EFFECT**" line (E13-1/E13-2 not yet verified —
   session 3's gate), relative links rebased from `docs/planning/` to
   `docs/`, and a 1.3 adoption row in the change log. v1.2
   (`docs/CNB-LY-EXPORT-SPEC-v1_2.md`) stays in place for history, per the
   spec step.
2. **Pointer stub left at the old draft path** (see "Decisions" D-s1-1).
3. **`docs/CNB-ARCHITECTURE-PLAN-v2.md` amended** (the sets-009/010
   addendum pattern): Module inventory row **24 — Pitch Axis**; `pitchAxis`
   line in the §4.1 top-level structure (between `staff` and `ledgers`, the
   design §1.1 placement); new **§4.13 Pitch Axis (added set 014)**
   addendum (schema, unit contract, default-off construction, validation
   summary, export surface + fail-loud pointer); new **Module 24** spec
   block after Modules 22–23 (API + grid integration); §8 file-structure
   entries for `cnb-pitch-axis.js` / `cnb-pitch-axis-tests.js`.

### Step 2 — `cnb/src/cnb-pitch-axis.js` (progress key `session-001/axis-and-grid`)

Module 24 per design §2.1: `create(config)` returning
`{ enabled, octaveStride, unitsPerStaffSpace, positionOfSemi, regionOfSemi,
distance, semisAtPosition, nearestSemisForY }`.
- `positionOfSemi`: `map[pc] + octave × stride` (CNBMusic arithmetic);
  fractional input interpolates linearly between adjacent integer
  semitones (flat across shared pairs).
- Inactive axis (absent / `enabled:false` / unknown kind / structurally
  unsound section): **literal identity** `positionOfSemi = s => s`
  (degeneracy exact by construction, per the spec step's "linear
  degeneracy exact"), stride 12, `unitsPerStaffSpace =
  staff.semitonesPerStaffSpace`.
- `semisAtPosition` and `nearestSemisForY` return CANDIDATE arrays of any
  length, never a fake scalar (consult §3 / design §2.1). On the typical
  Twinline-like map that is 0/1/2 entries, but legal maps whose octave
  bands touch (the PA-8 boundary equality `positions[11] === positions[0]
  + octaveStride`) or overlap (PA-W1) produce 3+ candidates — pinned by a
  test *(wording corrected in verification round 1 remediation; the
  original note capped the count at 2)*.

### Step 3 — Grid axis path (`cnb/src/cnb-grid.js`)

Design §2.2: axis-enabled contexts get
`semiToY = (maxAxisPos − positionOfSemi(semi)) × pxPerAxisUnit`
(`pxPerAxisUnit = display.pxPerSemi`, the §1.2 unit contract), axis-span
`svgHeight`, `yToAxis`, the `axis` object, and **no scalar `yToSemi`**.
The disabled branch keeps the **literal** pre-change body (`(maxSemi -
semi) * pxPerSemi`, unchanged statement for statement) and constructs no
axis at all (design deviation D3). `renderDebugOverlay` in axis contexts
draws one line per declared axis position labeled with all semitones
mapping there ("0,1"); the linear overlay branch is the literal old loop.

### Step 4 — Module A (`cnb/src/cnb-config.js`)

- Validation check 10: PA-1…PA-8 blocking errors and PA-W1/PA-W3 warnings
  gated on `pitchAxis.enabled`; **PA-W4 on the disabled/absent branch by
  definition** (it warns that `xOffsetStaffSpaces` is set on a linear
  config — design §1.4 table + §3.2). Type-safe `isPlainObject` posture of
  checks 8–9: malformed sections report errors, never throw; disabled or
  absent sections add zero output for configs predating the feature.
- `resolveNotehead` gains `xOffsetStaffSpaces` (built-in default 0,
  merged in priority order like every other apply field).

### Step 5 — Tests

New `cnb/tests/cnb-pitch-axis-tests.js` (18) + additions to
`cnb-grid-tests.js` (+9) and `cnb-config-tests.js` (+16); registered in
`run-tests.js`. Coverage per the spec step: disabled output byte-identical
against the pre-change baseline; the two machine-checked anchors (linear
degeneracy — an ENABLED identity axis reproduces the linear grid number
for number; the 013 spike geometry `'(-3 -1 1 4 6 8)` + middle C → −4 +
midpoint → 0); non-uniform 1:1 maps (fractional positions place and invert
exactly); many-to-one candidate inverses (2/1/0 candidates, range
clipping); PA-8 rejection cases (validation errors AND render-time
activation-gate refusal, in-octave and cross-octave).

---

## Byte-identity pins (spec binding rule 2) — all green

| Pin | Method | Result |
|---|---|---|
| Full suite | `node cnb/tests/run-tests.js` | **752 passed, 0 failed** (`s1-evidence/full-suite-transcript.txt`) |
| Test arithmetic | suite at base `2cf7d647` in a temp `git worktree` | base **709** → 752 = **+43** exactly: config 74→90 (+16), grid 17→26 (+9), pitch-axis new (+18) |
| Grid disabled path | pre-change probe fixture `cnb/fixtures/grid-baseline.json` captured at `2cf7d647` BEFORE the grid edit (`s1-evidence/make-grid-baseline.mjs` + transcript), pinned by the suite | byte-identical (JSON-serialized context + semiToY/yToSemi samples + debug-overlay DOM, 4 probes) |
| Default export | existing `default-export-baseline.ly` pins (clef/keysig suites) + new "disabled pitchAxis section exports byte-identically" test | pass |
| Kite 4-369 export | `export-kite-4-369.mjs` at base worktree vs working tree, `cmp` | **BYTE-IDENTICAL** (`s1-evidence/kite-byte-identity-transcript.txt`) |

No fixture enables the feature yet (fixtures land in session 3), so the
full engine render half of the Kite round-trip is unchanged by
construction; the export byte-comparison above is the operative pin.

---

## Decisions made this session (with authority)

- **D-s1-1 — draft moved, stub left behind.** The spec step says "Adopt
  `docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md` as
  `docs/CNB-LY-EXPORT-SPEC-v1_3.md`", and the draft's own status text
  specifies the mechanism verbatim: *"this draft is adopted (renamed into
  `docs/` as the canonical v1.3) only by the pitch-axis implementation
  set"*. Executed as `git mv` (rename). A 15-line pointer stub was left at
  the old path solely so the links in the set-013 records and in
  `docs/planning/pitch-axis-design.md` (which cites the draft as its
  companion) still resolve; the stub names the adoption and points
  forward. The stub is the mechanical consequence of the spec-directed
  rename — no content lives there.
- **D-s1-2 — `cnb/fixtures/grid-baseline.json` (not in Creates/Touches).**
  Spec step 5's own words require "disabled output byte-identical
  **against a pre-change baseline**" — the baseline artifact must exist
  and be committed for the pin to be reproducible. `cnb/fixtures/` is the
  repo's established home for exactly this (set-009's
  `default-export-baseline.ly` precedent). Captured at `2cf7d647` before
  any grid edit; generator + transcript in `s1-evidence/`.
- **D-s1-3 — activation gate for structurally unsound sections.**
  `CNBPitchAxis.create` treats an enabled-but-unsound section (unknown
  kind, malformed map, non-positive stride/units, PA-8 violation) as
  INACTIVE (identity fallback) rather than throwing or half-activating.
  Authority: design §1.1 *"validation rejects unknown values and consumers
  treat an unknown kind as inactive (the set-010 style/rule vocabulary
  pattern)"*, extended to the structurally unsound cases because the
  grid's extent math is sound only under PA-8 (*"the grid's extent math
  (`maxAxisPos`, `svgHeight`, §2.2) and label layout assume
  monotonicity"*) — a map validation rejects must not drive geometry.
  Module A remains the error-message owner; the gate is its render-time
  mirror (documented in both files).
- **D-s1-4 — `nearestSemisForY` tie rule.** Design §2.1 defines the
  method's contract ("candidates at the declared axis position nearest to
  gridContext's y") but not the equidistant case; ties resolve UPWARD
  (higher position), matching the platform's existing tie-upward
  precedent (keys.keySignature tonicOctave auto-centering, §4.9 "ties
  resolving upward"). Pinned by a test.
- **D-s1-5 — PA-7 rejects `null`.** `apply.xOffsetStaffSpaces: null`
  is an error when present on an enabled config (design PA-7: "must be a
  finite number when present"); unlike `color`, the field has no
  null-sentinel semantics (design §3.1: "missing/0 = centered").
- **D-s1-6 — PA-W3 compares EFFECTIVE color.** The indistinguishability
  check resolves `color ?? resolveColor(config, pc)` (palette fallback),
  since two rule-null colors with different palette entries ARE
  distinguishable. Design §1.4 W3 names "resolved noteheads"; the
  effective color is what renders.

## Deviations from the design

None. The implementation follows the design doc section for section;
D-s1-3…D-s1-6 fill gaps the design leaves to implementation, in the
design's own stated postures.

## Disclosures

- A stale temp worktree from set-010 s2 (`cnb-base-010s2`, detached at
  `a6d6213`) exists in the local temp directory; it predates this session,
  touches nothing in the repository, and was left as found. This session's
  own base worktree (`cnb-base-2cf7d64`) was removed after use.
- The `start_session` run printed the recurring `router-config.yaml
  pricing last reviewed 41 days ago` advisory (threshold 30) — surfaced to
  the operator in the session summary; no pricing action taken here.

## Verification round-1 remediation (2026-07-12)

Round 1 (gpt-5-4, cross-provider) returned ISSUES_FOUND with two findings;
both accepted and fixed:

1. **§8a fail-loud gate implemented now, not in session 3.** The verifier
   read binding rule 3 ("`generate()` throws on `pitchAxis.enabled` …
   No silent linear `.ly` for a compact config, ever") as effective the
   moment the schema exists — correct: between s1 and s3 an enabled
   config could otherwise export silently through the linear exporter.
   Fix: `CNBLilypond.generate()` now throws `PITCH_AXIS_GATE_MESSAGE`
   (exported constant naming E13-1/E13-2, the hook, and §8a) on the
   enabled flag alone, before any other validation;
   `CNBConfigExport.validateForExport()` surfaces the IDENTICAL text as a
   blocking error (the validateForExport ↔ generate() parity contract),
   so the UI blocks with an explanation instead of crashing. Tests: 3 in
   `cnb-lilypond-tests.js` (throws with the exact message on a VALID
   compact config; fires on the enabled flag even for a malformed
   section; disabled section exports byte-identically to the default) and
   1 parity test in `cnb-config-export-tests.js` (validateForExport error
   verbatim, generate() throw parity, `buildExport` blocked contract,
   gate lifted on disable). Session 3 step 1 still owns the §8 checks
   8–12 validation additions and the gate's verified REMOVAL. Scope note:
   `cnb/src/cnb-lilypond.js`, `cnb/ui/config-export.js` and their test
   files are outside session 1's Touches — changed at the verifier's
   explicit direction ("Add the interim `generate()` throw now … and make
   the export helpers surface/block it, with tests"), the round-1
   remediation precedent of sets 007-s2/013-s2.
2. **Candidate-count claim corrected to "arrays of any length".** The
   0/1/2 wording (module doc + notes + submission) undercounted legal
   maps: the PA-8 boundary equality (`positions[11] === positions[0] +
   octaveStride`) puts pc 11 ON the next octave's shared pair → 3
   candidates; PA-W1 overlapping bands can produce more. Fixed the
   `semisAtPosition` doc comment and this file's API note, and added a
   boundary-equality test (map `[0,0,1,2,2,3,3,4,5,5,6,7]`, stride 7:
   `semisAtPosition(7) → [11,12,13]`, `nearestSemisForY` returns the
   trio, range-end clipping `[23,24]`).

Post-remediation: full suite **757 passed, 0 failed** — 752 + 5 exactly:
cnb-lilypond-tests 56→59 (+3), cnb-config-export-tests 26→27 (+1),
cnb-pitch-axis-tests 18→19 (+1). Complete transcript:
`s1-evidence/full-suite-transcript-r2.txt`. Kite export re-verified
byte-identical against the base-commit worktree post-remediation
(`s1-evidence/kite-byte-identity-transcript-r2.txt`) — the gate touches
only the enabled path, and no committed fixture enables the axis.

## What session 2 needs

Consumer rethread (P3) per design §2.3–§2.5, all gated through
`gridContext.axis`. Everything session 2 consumes is in place:
`gridContext.axis` (enabled contexts only), `axis.regionOfSemi` /
`axis.distance` for the ledger re-metrication, `resolveNotehead().xOffsetStaffSpaces`
for the card plumbing, and `test-pitch-axis.html` remains to be created
(session 2 Creates). The grid baseline fixture also pins session 2's
"entire existing surface byte-identical" requirement for the grid layer.
