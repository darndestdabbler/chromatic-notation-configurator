# Session 1 verification — round 1

## ISSUES FOUND

### Issue → Missing committed Playwright UAT script
**Location** → Diff contains `docs/session-sets/005-rule-editors/s1-uat.md`, but no executable Playwright test file under `cnb/` or elsewhere. The response explicitly says the actual driver was a scratchpad `uat-s1.mjs`, which is not in the diff.

**Fix** → Add the real checked-in Playwright UAT script to the repo and make it runnable/reviewable. A markdown checklist alone does not satisfy “write a Playwright UAT script”.

---

### Issue → Stale `staff.lineOverrides` survive pattern changes
**Location** → `cnb/ui/staff-rule-editor.js`, `buildStaff()` and pattern-change flow:
- `buildStaff()` returns `pruneOverrides(state.lineOverrides)`
- it does **not** filter overrides to the active `semitonePattern`
- `drawOverrides()` only shows rows for the current pattern

Concrete failure: enable an override for line `4` in pattern `4-8`, then switch to `3-6-9`. The emitted config can still contain `staff.lineOverrides["4"]`, even though semitone `4` is no longer a staff line and the UI no longer exposes that override.

**Fix** → When building/emitting `staff.lineOverrides`, intersect keys with the active pattern. Alternatively, prune obsolete overrides immediately when the pattern changes.

---

### Issue → Task scope violation: files outside `cnb/` were modified
**Location** →  
- `docs/session-sets/005-rule-editors/activity-log.json`  
- `docs/session-sets/005-rule-editors/s1-uat.md`  
- `docs/session-sets/005-rule-editors/session-events.jsonl`  
- `docs/session-sets/005-rule-editors/session-state.json`

The original task explicitly said: **“Touches: none outside cnb/”**.

**Fix** → Remove/revert the non-`cnb/` changes from this task submission, or split them into a separate orchestration-only change.

---

### False positives not flagged
- Using Module 3/5 in the preview is consistent with step 3.
- Using the architecture-plan LY position formula instead of the legacy fixed symmetric list is a reasonable implementation choice.
- Property-based event wiring for Node-stub testability is not a defect.


---

# Session 1 verification — round 2 (remediation)

**ISSUES FOUND**

- **Issue** → The session-level **VERIFIED** verdict is too strong because Issue 1’s resolution overstates what the new UAT driver actually guarantees.  
  **Location** → `cnb/uat/uat-staff-rule-editor.mjs`  
  **Fix** → Wrap the `CNB_UAT_PLAYWRIGHT` fallback load in its own `try/catch` and exit `2` with an explicit message if resolution fails there too. Also, the claimed “ms-playwright cache default” is actually a hardcoded user-specific Windows path (`C:/Users/denmi/...`), not a generic cache lookup. Either implement portable discovery or require `CNB_UAT_CHROMIUM` and update the claim accordingly.

- **Issue** → Issue 3’s not-a-defect adjudication is incomplete as written. The explanation covers four `docs/session-sets/005-rule-editors/` files, but this remediation diff also adds another outside-`cnb/` file.  
  **Location** → `docs/session-sets/005-rule-editors/s1-issues.json` and the Issue 3 explanation  
  **Fix** → Explicitly justify `s1-issues.json` under the same orchestration-artifact exception, or narrow the adjudication so it does not imply only the four listed files are exempt.

- **Issue** → Issue 2 appears properly resolved.  
  **Location** → `cnb/ui/staff-rule-editor.js`, `cnb/tests/cnb-staff-rule-editor-tests.js`  
  **Fix** → None.
