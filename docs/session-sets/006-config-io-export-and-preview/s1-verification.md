# Session 1 verification — round 1

# ISSUES FOUND

- **Issue** → Out-of-scope changes outside `cnb/`, contrary to the task’s explicit `Touches: none outside cnb/`.
  - **Location** → `docs/session-sets/006-config-io-export-and-preview/*`
  - **Fix** → Remove the docs/lifecycle changes from this task deliverable, or split them into a separate non-task commit.

- **Issue** → The filename preview can be wrong immediately after loading a config whose `meta.configName` differs from the current one.
  - **Location** → `cnb/ui/config-io.js`, `loadText()` calls `redraw()` before `onLoad(...)`; `drawSaveRow()` derives the preview from `getConfig()`, which still returns the old host state during that redraw.
  - **Fix** → Invoke `onLoad(result.config, ...)` before `redraw()`, or call `redraw()` again after `onLoad(...)` so the preview reflects the loaded config.

- **Issue** → Reporting is internally inconsistent about test counts.
  - **Location** → Response summary says **33** new tests / **497** total, while `docs/session-sets/006-config-io-export-and-preview/activity-log.json` says **31** new tests / **496** total.
  - **Fix** → Correct the recorded counts to match the actual added test file and runner output.


---

# Session 1 verification — round 2 (remediation)

VERIFIED
