# Set 013 — pitch-axis engine discovery: change log

**Set:** `013-pitch-axis-engine-discovery` (tier full, 2 sessions).
**Outcome:** **GO**, render-evidenced, and an operator-approved design +
authorization for a subsequent implementation set. **No product code and no
engine commits** in this set, per binding rule 2 — every change is a
document or a session-lifecycle record.

## Session 1 (2026-07-10) — engine capability discovery (VERIFIED, 2 rounds)

- **`s1-engine-coordination.md`** — the discovery + coordination record:
  the CNB engine placed a hand-authored Twinline-like compact axis (12
  pitch classes on 7 positions/octave, five shared-position pairs) exactly
  — 35/35 noteheads, 7/7 ledgers, 30/30 stems at mapped staff positions —
  from a score-level coercion approximating the proposed
  `cnb:get-pitch-staff-position` hook, with zero engine-source changes.
  **GO**, scoped to vertical-placement feasibility. Engine-repo work items
  E13-1…E13-5 named (the hook; the chord `x-offset` mechanism — the one
  measured break: diatonic-neighbor chord pairs absorb stencil offsets;
  keysig/clef through the hook; collision-threshold semantics).
- **`s1-evidence/`** — the throwaway spike `.ly` (offset + control
  variants), measurement/extraction/diff scripts, and complete transcripts
  with exit codes.

## Session 2 (2026-07-10) — design + operator sign-off (this session)

- **`docs/planning/pitch-axis-design.md`** (new) — the consolidated design
  specification: the optional `pitchAxis` config section (explicit
  `pitch-class-map-v1` pitch-class→position map, `octaveStride`,
  `axisUnitsPerStaffSpace` unit contract pinned as a single substitution
  rule, validation PA-1…PA-7 / PA-W1…W4 including the ledger-collapse
  conflict rejection); the `CNBPitchAxis` axis-gatekeeper contract
  (`positionOfSemi` / `regionOfSemi` / `distance`, many-to-one
  inverse-returns-candidates, literal-old-code disabled branch); the
  consumer-module change inventory (staff, ledger-set, double-notehead,
  stem, card, collection, key-signature, exporter); the
  `xOffsetStaffSpaces` notehead-rule disambiguation field with an
  axis-gated lifecycle; the phased implementation-program plan (P0–P6,
  suggested ~4-session set 014, P4 blocked on engine E13-1/E13-2); three
  named deviations from the consult, all stricter (design §6).
- **`docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md`** (new) — the
  export-format **draft** (canonical v1.2 spec untouched, per the set's
  non-goals): compiled `cnb:get-pitch-staff-position` procedure
  (half-staff-spaces, `staff.midpoint` anchored at staff position 0), axis
  staff-line-positions formula with collapse dedup, ÷`axisUnitsPerStaffSpace`
  substitutions, optional Section C `(x-offset . N)` field (axis-gated,
  nonzero-only, in the grouping key), pitch-axis validation, and the
  fail-loud interim export gate. Disabled `pitchAxis` ⇒ output
  byte-identical to v1.2.1.
- **`s2-evidence/`** — `check-design-claims.mjs` + transcript: 53/53
  machine checks (linear degeneracy against the real exporter's
  `computeStaffLinePositions`; reproduction of session 1's measured spike
  geometry — staff lines `'(-3 -1 1 4 6 8)`, notehead positions, shared
  pairs, stem-flip anchor; euclidean octave arithmetic; every cited code
  quote and path). cnb test suite unchanged at 709/709.
- **`s2-uat.md`** — the operator's per-set UAT decision, verbatim:
  **"Approve — authorize implementation set"** (recorded before
  verification round 1). The end-of-set deliverable "operator decision on
  record" is satisfied in the affirmative.
- Session-lifecycle records: `session-state.json`, `session-events.jsonl`,
  `activity-log.json`, `disposition.json`, `s2-verification.md`, this
  `change-log.md` — per the spec's scope note (lifecycle records are exempt
  from the Touches restriction and committed as docs-only commits).

## Net effect on the platform

None yet — by design. The set produced: a proven engine capability with
named bounded work items, an implementable specification whose default-off
byte-identity is enforced by construction at every layer, and the
operator's authorization to proceed. The compact-staff family (feasibility
matrix I2, records 32–40, 9 systems — the largest structurally-out-of-scope
lineage in the gallery) has a fully scoped path to support.
