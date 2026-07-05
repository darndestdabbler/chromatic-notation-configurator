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


---

# Session 1 verification — round 3 (round-2 residuals)

**ISSUES FOUND**

- **Issue** → The **VERIFIED** verdict overstates Residual 1: the implementation and the explanation do not fully match.  
  **Location** → `cnb/uat/uat-staff-rule-editor.mjs` header comment; `const EXE = process.env.CNB_UAT_CHROMIUM || findCachedChromium();`; Residual 1 narrative in the response.  
  **Fix** → Either:
  - update the claim/comment to the exact implemented behavior, or
  - change the code to match the claim.
  
  Specific mismatches:
  - The header says `~/Library/Caches or ~/.cache on macOS/Linux`, but the code actually uses `~/Library/Caches/ms-playwright` and `~/.cache/ms-playwright`. That is not “exactly this behavior.”
  - The response says the driver exits 2 “when neither yields an existing binary,” but the code does **not** check both when `CNB_UAT_CHROMIUM` is set. An invalid `CNB_UAT_CHROMIUM` causes immediate failure without attempting cache discovery.

- **Issue** → The rerun/test-pass claims are unsupported by the material shown, so they should not be used to justify a session-level **VERIFIED** verdict on their own.  
  **Location** → Residual 1 narrative: “all 29/29 checks passed; full unit suite still 377 passed, 0 failed.”  
  **Fix** → Provide command/output evidence, or present those as unverified claims rather than proof.

- **Issue** → Residual 2 appears adequately addressed; no error found there.  
  **Location** → `docs/session-sets/005-rule-editors/s1-issues.json`  
  **Fix** → None.


---

# Session 1 verification — round 4 (round-3 residuals, with evidence)

## ISSUES FOUND

- **Issue** → The **VERIFIED** verdict is overstated because Residual **(b)** is not fully resolved. The response still does not provide standalone command evidence for the unit-suite rerun. It shows one shell command for the UAT run, then later admits the `cnb-staff-rule-editor-tests...` / `Results: 377 passed, 0 failed` lines came from a different command. That makes the transcript stitched rather than literal, and it also makes the shown `uat exit: 0` attribution unreliable as written.  
  **Location** → `Residual (b) — evidence for rerun claims → PROVIDED`, first transcript block and the parenthetical note below it.  
  **Fix** → Show separate command/output blocks, e.g. one for `node cnb/uat/uat-staff-rule-editor.mjs; echo ...` and a separate one for `node cnb/tests/run-tests.js; echo ...`, each with its own output and exit code.

- **Issue** → Residual **(a)** is materially improved, but the claim of **exact** precedence semantics is still not literally exact. The code uses `if (process.env.CNB_UAT_CHROMIUM)`, which treats the variable as authoritative only when it is non-empty/truthy. A present-but-empty `CNB_UAT_CHROMIUM` falls through to cache discovery, which does not match the wording “when set, is authoritative.”  
  **Location** → `cnb/uat/uat-staff-rule-editor.mjs`, `if (process.env.CNB_UAT_CHROMIUM) { ... }`, and the updated narrative/header wording “when set”.  
  **Fix** → Either change the wording to “when non-empty” or change the code to test for variable presence rather than truthiness.

- **Issue** → Aside from the point above, the fail-fast change for an invalid explicit Chromium path does address the main round-3 mismatch; the problem is that the response over-claims full closure.  
  **Location** → Session-level verdict `VERIFIED`.  
  **Fix** → Downgrade the verdict until the command evidence is corrected, and tighten the wording/code match for the env-var precedence claim.
