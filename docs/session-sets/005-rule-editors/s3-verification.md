# Session 3 verification — Common Properties Editor (Module 15)

## Round 1 (2026-07-05)

# ISSUES FOUND

- **Issue** → Explicit scope violation: the task said **“Touches: none outside `cnb/`”**, but the commit modifies multiple files under `docs/` that were not part of the requested deliverables.  
  **Location** → `docs/session-sets/005-rule-editors/activity-log.json`, `docs/session-sets/005-rule-editors/s3-uat.md`, `docs/session-sets/005-rule-editors/session-events.jsonl`, `docs/session-sets/005-rule-editors/session-state.json`  
  **Fix** → Keep the task commit confined to `cnb/`. If the close-out process truly requires a `change-log.md` exception, limit the out-of-scope write to that file only, or split orchestration/doc updates into a separate commit with explicit approval.

- **Issue** → Incorrect reasoning in the write-up: it preemptively argues that out-of-`cnb/` changes “should not be flagged,” but that conflicts with the task’s stated scope.  
  **Location** → “DOCUMENTED DESIGN DECISIONS”, item 6  
  **Fix** → Remove that justification and either comply with the path constraint or document an explicit exception from the task owner.

Read-only duration definitions and the repeat-mode preview using **base row + textual legend** are acceptable and should **not** be flagged as defects; both are consistent with the original task/spec wording.
