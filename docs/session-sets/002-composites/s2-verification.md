# Session 2 verification — round 1

**ISSUES FOUND**

- **Issue** → Render APIs are not pure, which violates the stated architecture constraint. Both modules mutate a passed container instead of just returning a DOM node. The tests also lock in that non-pure API.  
  **Location** → `cnb/src/cnb-card.js` (`render(container, ...)` + `container.appendChild(col)`), `cnb/src/cnb-collection.js` (`render(container, ...)` + `container.appendChild(root)`), and corresponding assertions in `cnb/tests/cnb-card-tests.js` / `cnb/tests/cnb-collection-tests.js`.  
  **Fix** → Change `render()` to build and return the node only. Have callers append the returned node. Update tests and test pages to append externally.

- **Issue** → The fallback sharp-offset logic is sign-wrong. If `display.label.sharpStyle.raise` is missing, the fallback moves the sharp **down**, not up, which contradicts the comment and intended behavior.  
  **Location** → `cnb/src/cnb-card.js`, `buildLabel()`: `s.style.top = -(sharpStyle.raise ?? -0.15) + "em";`  
  **Fix** → Use a positive fallback raise value before negation, e.g. `s.style.top = -(sharpStyle.raise ?? 0.15) + "em";`.

- **Issue** → The response summary miscounts the added tests. The diff shows **20** card tests and **9** collection tests, for **29 total**, not **27** / **18 + 9**.  
  **Location** → Response summary vs. `cnb/tests/cnb-card-tests.js` and `cnb/tests/cnb-collection-tests.js`.  
  **Fix** → Correct the summary/test-count reporting to match the actual diff.
