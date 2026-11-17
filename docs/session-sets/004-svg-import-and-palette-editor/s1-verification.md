# Session 1 verification — round 1

## ISSUES FOUND

- **Issue → Incorrect fallback width when `viewBox` is missing**
  - **Location →** `cnb/ui/svg-importer.js`, `buildShape()`
    ```js
    const naturalHeight = extracted.viewBoxHeight || semitoneHeight * TOOLKIT_UNITS_PER_SEMITONE;
    const naturalWidth = extracted.viewBoxWidth || naturalHeight;
    ```
  - **Fix →** Do not invent `naturalWidth` from `naturalHeight`. If `viewBox` is missing, either:
    1. extract and use root `width`/`height` if they are usable numeric SVG units, or  
    2. fail import with an error instead of forcing a square shape.  
    Current behavior silently distorts any non-square notehead on that fallback path.

- **Issue → Legacy/spec-documented stem anchor attributes are not supported at all**
  - **Location →** `cnb/ui/svg-importer.js`, `extract()` / `buildShape()`
  - **Fix →** Add a fallback path for `data-stem-up-x`, `data-stem-up-y`, `data-stem-down-x`, `data-stem-down-y` when `stem-up` / `stem-down` rect placemarkers are absent. The drift was correctly identified, but the importer currently only works with the rect-based contract and will not import SVGs that follow `docs/CNB-LY-EXPORT-SPEC-v1_2.md` section 7.1 as written.

- **Issue → The “UI module” deliverable is only a standalone test page, not reusable UI code**
  - **Location →** `cnb/test-pages/test-svg-importer.html`
  - **Fix →** If the spec expected Module 16 to include actual UI logic under `cnb/ui/`, move the file-picker/preview controller into a reusable JS module and let the test page host it. As delivered, `cnb/ui/svg-importer.js` is a parser/builder module, while the UI exists only in a test page.

- **False Positives → None obvious in the flagged drift/design decisions**
  - The rect-based stem-anchor drift callout, duplicated minim anchors, and verbatim `data-lilypond-*` handling are all reasonable based on the task as described.

---

# Session 1 verification — round 2 (post-remediation)

**VERIFIED**

- **1:** `extract()` now reads root `<svg>` `width`/`height`, `buildShape()` prefers `viewBox` then root dimensions, warns on fallback, and errors on undeterminable width instead of inventing one. Added tests cover both fallback and width-error cases.
- **2:** `data-stem-up/down-x/y` fallback is implemented from `#notehead`, only complete numeric pairs are used, stem rects still take precedence, legacy-contract warning is emitted, and `lilypondAnchors` conversion is shared for attribute-sourced anchors. Added tests cover fallback, precedence, conversion, and rejection cases.
- **3:** Reusable UI module code now exists as `CNBSvgImporter.renderImportControl(...)`, the test page uses that control instead of page-local wiring, and unit coverage verifies control creation plus file-change parsing flow.
