# Session 1 verification — round 1

Date: 2026-07-05

**ISSUES FOUND**

- **Issue → Step 1 was not actually verified through UI authoring**
  - **Location →** “What was done” items 1–2; `cnb/fixtures/kite-4-369-config.json`; `cnb/uat/uat-kite-pipeline.mjs`
  - **Fix →** Add a UI-driven proof that the Kite 4-369 system can be *constructed* using the set-006 editors, not just loaded from a preauthored JSON fixture. As written, the UAT verifies **load → re-seed → export**, not **design in UI → export**. That leaves the “using the assembled UI from set 006” part under-verified.

- **Issue → The claim of a “complete, itemized list of every discrepancy” is stronger than the evidence shown**
  - **Location →** Findings: “D1 and D2 are the only functional discrepancies”; `s1-discrepancy-catalog.md` result summary; T11/T12
  - **Fix →** Either narrow the claim or expand the diff. The reported harvest diffs only show explicit equality checks for **staff** and **noteheads**. The 101-assertion suite checks selected musical/semantic properties, but it is not shown as a full element-by-element equivalence check for all 195 harvested elements. To support “every discrepancy,” include exhaustive comparison for remaining rendered elements/layout, or state the verified scope more narrowly.

- **Issue → No explicit visual-diff result is documented**
  - **Location →** Original task step 4 (“diff visually and structurally”) vs. submitted evidence
  - **Fix →** Add a documented visual comparison outcome: manual visual review notes, image diff, or side-by-side screenshots with findings. The submission shows structural diffing and assertion checks, but the “visual” part is only implied, not actually reported.

- **Issue → Lifecycle records are internally inconsistent with a finished Session 1 submission**
  - **Location →** `docs/session-sets/007-end-to-end-pipeline-verification/session-state.json`; `activity-log.json`
  - **Fix →** If these files are part of the deliverable, they should reflect completion. `session-state.json` still says `in-progress` with `completedAt: null`, and `activity-log.json` says `totalSessions: 0`. If lifecycle files are not authoritative, they should not be presented as compliance evidence.
