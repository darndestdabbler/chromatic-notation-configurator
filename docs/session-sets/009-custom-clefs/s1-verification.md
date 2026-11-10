# Set 009 Session 1 — Verification round 1 (2026-07-06)

Verifier: routed task_type=session-verification (cross-provider).

---

# ISSUES FOUND

- **Missing requested config-test additions** → `cnb/tests/cnb-config-tests.js` is untouched; the new schema/merge/validate coverage was added only in `cnb/tests/cnb-clef-tests.js` → Add the clef-related default/merge/validate cases to `cnb-config-tests.js` as the spec explicitly requested, or move the existing config-focused cases there.

- **Clef validation is not type-safe and can throw on malformed configs** → `cnb/src/cnb-config.js`, clef validation block:
  - `const glyphs = clef.glyphs || {};`
  - `clef.active in glyphs`
  - `const kind = def.kind || "glyph"`
  
  If `clef.glyphs` is a truthy non-object (e.g. number/string) or the selected entry is `null`/primitive, `validate()` can throw instead of returning validation errors, which violates the “keep existing validation behavior unchanged” intent → Guard `clef.glyphs` as a plain object before using `in`, guard the selected definition before reading fields, and report validation errors instead of throwing. Add tests for wrong-typed `clef.glyphs`, null glyph defs, and malformed `clef` objects.

- **New gutter config is unvalidated** → `cnb/src/cnb-config.js` adds `clef.gutter.paddingH`, but the new validation block never checks it; `cnb/src/cnb-clef.js` and `cnb/src/cnb-collection.js` use it directly for layout math → Validate `clef.gutter.paddingH` as a finite non-negative number (or whatever range the schema intends) and add tests for negative/NaN/string values.

- **False positive to avoid: the per-definition float top-edge anchor is not an error** → `cnb/src/cnb-config.js`, `cnb/src/cnb-clef.js`, `docs/session-sets/009-custom-clefs/s1-notes.md` → No fix needed. This departs from the original step-2 wording, but it is explicitly documented as a scope adjustment driven by E1 plus the operator’s “investigate floating point vertical offset” instruction.

- **False positive to avoid: using a dedicated `clef.glyphs` map is not an error** → `cnb/src/cnb-config.js`, `docs/session-sets/009-custom-clefs/s1-notes.md` → No fix needed. The task explicitly allowed choosing between reusing `shapes` storage and a dedicated clef map, provided the choice was documented.

- **False positive to avoid: Date-line normalization in the export baseline test is not an error** → `cnb/tests/cnb-clef-tests.js`, `cnb/fixtures/default-export-baseline.ly` → No fix needed. The exporter embeds the current date, so normalizing only that line is a reasonable way to test schema-change invariance.

---

# Round 2 (remediation) — 2026-07-06

> **Verifier-model note:** round 2 was routed to **gemini-pro (Google)** instead of the
> configured gpt-5-4: the OpenAI endpoint returned persistent 429s for ~90+ minutes
> (7 route() invocations x 3 internal attempts, round-1 succeeded earlier the same day,
> i.e. quota exhaustion, not a transient spike). The router config's own comment on
> `task_type_overrides.session-verification` sanctions swapping to a different-provider
> Tier-3 verifier; gemini-pro is `is_enabled_as_verifier: true`, carries dedicated
> session-verification generation params, and Google is cross-provider from the
> orchestrating provider (anthropic), so the Full-tier cross-provider guarantee holds.
> Override applied via the supported `AI_ROUTER_CONFIG` env var pointing at a scratch
> copy of the config; the installed config was not modified.

**VERIFIED**

The AI's remediation is correct, complete, and of high quality. It has successfully resolved all three issues from the previous round.

1.  **Issue 1 ("Missing requested config-test additions"):** The resolution is correct. The clef configuration tests have been moved from `cnb-clef-tests.js` to `cnb-config-tests.js`, which is the correct location for Module A behavior tests. The commit diff confirms this move.
2.  **Issue 2 ("Clef validation is not type-safe"):** The resolution is correct and robust. The validation logic in `cnb-config.js` now uses an `isPlainObject` helper to guard against malformed inputs at every level of the `clef` configuration object (`clef` itself, `clef.glyphs`, and the specific glyph definition). The new tests comprehensively cover various non-object types, confirming that the validator now reports errors instead of throwing them.
3.  **Issue 3 ("New gutter config is unvalidated"):** The resolution is correct. The diff shows new validation logic in `cnb-config.js` that ensures `clef.gutter` is an object and `clef.gutter.paddingH` is a finite, non-negative number. The corresponding new test case is thorough, checking multiple invalid types, edge cases (like `0`), and valid states (like an absent `gutter` object).

The provided test transcripts show all 592 modern tests and 240 legacy tests passing, indicating no regressions were introduced. The code changes are precise and limited to the required scope.

---

# Round 2 re-run on gpt-5-4 — 2026-07-06 (operator-requested after OpenAI credits restored; same remediation submission as the gemini-pro round)

**VERIFIED**

- **Issue 1 — Resolved**
  - **Location:** `cnb/tests/cnb-config-tests.js`, `cnb/tests/cnb-clef-tests.js`
  - **Verification:** The 12 clef section tests were moved into `cnb-config-tests.js`, and removed from `cnb-clef-tests.js`. The new grouping matches Module A/config behavior. Test counts in the transcript are consistent with the move and the +5 new tests.

- **Issue 2 — Resolved**
  - **Location:** `cnb/src/cnb-config.js`
  - **Verification:** The clef validation path now guards `config.clef`, `clef.glyphs`, the selected glyph definition, and `clef.active` type before dereferencing. The previously risky cases are covered by added tests:
    - malformed `config.clef`
    - wrong-typed `clef.glyphs`
    - non-string `clef.active`
    - null/primitive selected glyph definition  
    The shown logic eliminates the round-1 throw paths in the clef block and returns a validation result instead.

- **Issue 3 — Resolved**
  - **Location:** `cnb/src/cnb-config.js`
  - **Verification:** `clef.gutter` is now type-checked, and `clef.gutter.paddingH` is validated as a finite non-negative number when clef rendering is enabled. Added tests cover invalid values (`-4`, `NaN`, `"12"`, `Infinity`), valid `0`, absent gutter, and wrong-typed gutter objects.

- **Completeness**
  - All 3 round-1 actionable issues were addressed.
  - No evidence of the listed false positives being reintroduced:
    - float top-edge anchor behavior remains accepted
    - dedicated `clef.glyphs` map remains intact
    - export baseline invariance test remains in place without inappropriate date-line objections

- **Conclusion**
  - The claimed session-level verdict of **VERIFIED** is supported by the diff and the test evidence.
