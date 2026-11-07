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

---

# Round 2 (post-remediation, commit de8b533)

**VERIFIED**

## Correctness

- **Finding 1 resolved:** both public `render()` APIs are now directly unit-tested.
  - `CNBLedgerSet.render(...)` is exercised by the new **6 render tests** in `cnb-ledger-set-tests.js`.
  - `CNBDoubleNotehead.render(...)` is exercised by the new **4 render tests** in `cnb-double-notehead-tests.js`.

- **Finding 3 resolved:** the double-notehead suite now tests the actual required render contract, not just `layout()`.
  - It calls `CNBDoubleNotehead.render(svg, grid, opts)`.
  - It asserts the returned object fields `{ lowerG, upperG, lowerY, upperY }`.
  - It also checks append order, transforms, fill colors, hollow overlay behavior, and default color handling.

## Completeness

- **Finding 2 resolved:** the DOM-stub render checks are now part of the real registered suites, not just described in prose.
  - The new render tests are included directly in the exported `tests` arrays of the existing suite files.
  - That means they are part of the runner path already used by `node cnb/tests/run-tests.js`; no separate unregistered ad hoc checks are being claimed here.

- The added `svg-stub.js` is sufficient for the stated purpose of exercising Node-side SVG render paths:
  - `createElementNS`
  - `setAttribute`
  - `getAttribute`
  - `appendChild`

- The remediation stays within scope:
  - It fixes only the three prior coverage/reporting issues.
  - It does **not** reopen the previously dismissed `buildDefs/resolve/isBetweenNoteAndStaff` or `C'(12)` design-decision topics.

## False Positives

- None. The remediation claims align with the shown changes.