# Session 2 verification — Notehead Rule Editor (Module 14)

## Round 1 (2026-07-05)

## ISSUES FOUND

- **Issue:** The editor does not let users create/edit the full requested notehead-rule schema. `match.keys` is read-only and `apply.offKeyMark` has no UI, so step 2 is only partially implemented. The live resolved surface also cannot show effective `offKeyMark`.
  **Location:** `cnb/ui/notehead-rule-editor.js` — `drawRuleCard()` renders a static keys note (`"All keys (key rules are future work)"`), and the apply section only includes Shape / Hollow / Color rows.
  **Fix:** Add editable controls for `match.keys` and `apply.offKeyMark`, include them in emitted slices, and extend unit/UAT coverage to verify create/edit/reorder behavior and resolved preview output for those fields.

- **Issue:** The response claims `buildRules()` rejects “bad color”, but the implementation only rejects non-string values. Malformed hex strings will pass through until later validation.
  **Location:** `cnb/ui/notehead-rule-editor.js` — `buildRules()` `apply.color` branch; `cnb/tests/cnb-notehead-rule-editor-tests.js` — test `"buildRules: throws on out-of-range PCs, bad shape, bad color"` only exercises `color: 42`, not invalid hex strings.
  **Fix:** Either validate color strings in `buildRules()` with the same hex rules used by Module A, or correct the claims/tests to state that malformed strings are only caught by `CNBConfig.validate()`.

- **Issue:** The change set is not confined to `cnb/`, which conflicts with the original task scope.
  **Location:** `docs/session-sets/005-rule-editors/activity-log.json`, `docs/session-sets/005-rule-editors/session-events.jsonl`, `docs/session-sets/005-rule-editors/session-state.json`, `docs/session-sets/005-rule-editors/s2-uat.md`.
  **Fix:** Remove non-`cnb/` changes from this deliverable or get an explicit scope exception before counting the task as complete.
