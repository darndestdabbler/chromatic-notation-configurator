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
