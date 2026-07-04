## ISSUES FOUND

- **Issue** → Missing direct unit coverage for the requested public `render()` APIs  
  **Location** → `cnb/tests/cnb-double-notehead-tests.js`, `cnb/tests/cnb-ledger-set-tests.js`  
  **Fix** → Add node-safe DOM-stub tests that call `CNBDoubleNotehead.render()` and `CNBLedgerSet.render()` directly and assert the returned groups, child counts, and key attributes/positions. As shown, `CNBDoubleNotehead` is only unit-tested through `layout()`, and `CNBLedgerSet` is only unit-tested through `buildDefs`/`resolve`/`isBetweenNoteAndStaff`.

- **Issue** → The summary claims extra render-path node tests that are not reflected in the listed suites/counts  
  **Location** → “Other changes” vs. the shown `34 new` tests (`28 + 6`)  
  **Fix** → Either register/show those DOM-stub render tests explicitly in the test suites, or correct the summary. As written, the claim “Render paths additionally exercised in Node with a DOM stub” is unsupported by the displayed test files and totals.

- **Issue** → `CNBDoubleNotehead` unit tests validate a helper API not requested by the task  
  **Location** → `cnb/tests/cnb-double-notehead-tests.js`  
  **Fix** → Keep `layout()` tests if useful, but add tests around the actual required API:  
  `render(svgParent, gridContext, {lowerSemi, upperSemi, lowerNote, upperNote, centerX, offsetPercent}) -> {lowerG, upperG, lowerY, upperY}`.

## Not an issue

- **Issue** → Showing a ledger at `12` for `C'` in default `4-8`  
  **Location** → `cnb/tests/cnb-ledger-set-tests.js` and the implementation logic  
  **Fix** → None. This is consistent with the task’s stated spec tension: the algorithm and default template set do imply a ledger at `12`, so the implementer’s choice here is valid.

Core `buildDefs` / `resolve` / `isBetweenNoteAndStaff` logic otherwise appears aligned with the stated spec from the provided snippets.