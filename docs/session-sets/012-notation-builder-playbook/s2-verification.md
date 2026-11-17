# Session 2 — routed cross-provider verification

Verifier: gpt-5-4 (OpenAI), cross-provider from anthropic. task_type=session-verification, complexity 66, max_tier 3. Round 1 cost $0.1017, 44s.

## Round 1

Prompt (31,241 chars): full line-numbered deliverable text + complete citation/reference audit (every cnb/ path, doc link, README anchor, public API), pre-adjudicated design decisions D1-D4, scope provenance (spec note predates session via git log; split commits), operator UAT verbatim, claimed narrow verdict VERIFIED.

**Verdict: ISSUES_FOUND** (2 issues; both internal-consistency, no citation defects — the two pre-adjudicated items the review touched, citation-by-reference and the bare test-stem.html mention, were explicitly listed as false positives / not-defects).

**ISSUES_FOUND**

- **Issue → Missing prompt templates for mapped high-value steps**
  - **Location →** Pipeline map marks step **7** as **High (config) / Human (glyph)** and step **8** as **High (interpret)** at **lines 82–83**, but Part 3 only provides templates for characterization, steps **1–4**, and step **12** at **lines 106–260**.
  - **Fix →** Add:
    - a **step 7** prompt template for drafting `clef` / `keys.keySignature` config from a description, with the relevant schema/doc pointer, expected output, and verification via the Clef/Key-signature editors + `CNBConfig.validate()`;
    - a **step 8** prompt template for interpreting `CNBConfig.validate()` errors into concrete fixes, with verification explicitly requiring a subsequent clean validation run.

- **Issue → Characterization template has an internal contradiction between “emit null” and “must validate cleanly”**
  - **Location →** **Lines 129–136**: the template instructs the model to **emit `null`** for underivable values and also says the returned JSON **“must validate with no errors.”**
  - **Fix →** Make one of these true, not both:
    - **Preferred:** tell the model to **omit** underivable fields from the partial JSON and list them under `"_unknowns"`; or
    - state that `_unknowns` are resolved by the human **before** running `CNBConfig.validate()`.
    - Do not require immediate clean validation of a skeleton that may contain `null` sentinels for non-nullable fields.

**False positives not counted as defects**

- **Citation-by-reference to the human playbook** for invariant/exemplar grounding is acceptable for this companion guide; the guide explicitly frames itself as annotating the playbook and points readers to Part 2 / Part 3 for the invariant and evidence base.
- The bare `test-stem.html` mention is **not** a path defect; the supplied audit resolves it under `cnb/test-pages/test-stem.html`.
### Remediation (commit 4942b9c)

- **Issue 1 (missing templates for steps 7 & 8, tagged High in the pipeline map):** added Part 3 template **3.6** (clef / keys.keySignature config from a description, citing cnb-clef.js / cnb-key-signature.js / arch plan §4.9,§4.12, with the enabled-only validate() checks as verification and the byte-identical-export constraint stated) and **3.7** (interpret a CNBConfig.validate() error into a minimal fix, verification instruction requires a subsequent clean validate() re-run, not the model's explanation). Renumbered the export->render->diff loop to 3.8.
- **Issue 2 (characterization template 3.1 contradiction: emit null vs must-validate-cleanly):** changed to omit underivable fields and list them under an _unknowns note (no null sentinel for non-nullable fields); verification now resolves _unknowns by hand FIRST, then validates the completed config.

All new references re-audited to resolve (cnb-clef.js, cnb-key-signature.js exist; textHeightSemis/anchorSemi/notehead-chords/scale-from-tonic present in source). Test count unchanged (709, docs-only).

## Round 2 (remediation)

Prompt (8,010 chars): the two round-1 issues with their resolutions, the new template text (3.6, 3.7) and revised 3.1 excerpt inline, unchanged-context recap, and "Claimed session-level verdict: VERIFIED". gpt-5-4, 5.8s, $0.0134.

**Verdict: VERIFIED**

Session-level result: **VERIFIED** (2 rounds, ~$0.115 total: r1 $0.1017, r2 $0.0134).
