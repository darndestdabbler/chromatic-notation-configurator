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

## Round 2 (2026-07-05) — remediation review

**ISSUES FOUND**

- **Issue** → Claimed “full remediation diff” is not actually complete.  
  **Location** → The response’s “Files changed in this remediation” list includes `docs/session-sets/005-rule-editors/session-events.jsonl`, but that file is absent from the supplied `git diff b465341..50846b4`.  
  **Fix** → Include the missing diff hunk, or correct the changed-files list / “full remediation diff” claim.

- **Issue** → Issue 1 is only partially resolved in the visible UI: the explicit `offKeyMark: false` state is hidden, despite the write-up claiming the resolved strip shows `"no mark"` or `"mark: <identifier>"`.  
  **Location** → `cnb/test-pages/test-notehead-rule-editor.html`:  
  `.cnb-nre-resolved-mark[data-mark="false"] { visibility: hidden; }`  
  **Fix** → Remove that hiding rule if the intent is to visibly surface the effective false state, or revise the claim/UAT to state that only non-false marks are visibly shown.
