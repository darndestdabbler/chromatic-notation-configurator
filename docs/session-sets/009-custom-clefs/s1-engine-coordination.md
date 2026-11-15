# Set 009 Session 1 — Engine capability discovery: clefs

**Date:** 2026-07-06
**Engine repo inspected:** `d:/Projects/lilypond-chromatic-notation-base`
(local clone of `lilypond-chromatic-notation-base`), files
`cnb/clefs.ly`, `cnb/layout.ly`, `cnb/config.ly`.
**Purpose (spec step 7):** determine what clef support the engine exposes
today, pin what session 2's export will emit, and record any engine-repo
work. Per the set spec's binding rule 4, implementing engine features is
out of this set's scope.

---

## 1. What exists in the engine today

- **`cnb/clefs.ly` — dozenal clef engraver.** The engine ships a
  `cnb-clef-engraver` that intercepts every `Clef` grob and replaces its
  stencil with a **two-digit dozenal register number** computed from the
  context's `middleCPosition` + `ottava` (`cnb:dozenal-clef`, clefs.ly:65;
  stencil construction `cnb:get-clef-stencil`, clefs.ly:103). Standard
  mappings per its header: treble → 50, alto → 40, bass → 30.
- **Unconditionally installed.** `cnb/layout.ly` registers the engraver in
  the `Staff` context (`\consists \cnb-clef-engraver`, layout.ly:46)
  alongside the notehead/keysig/staff-symbol engravers. There is no flag
  to disable or select it.
- **No configuration surface.** `cnb/config.ly` contains **zero**
  clef-related settings (grep "clef" → no matches). There is no
  `cnb:register-clef!`, no clef entry in the registration-function table,
  and the `cnb:get-notehead-config` procedure model has no clef field.
- **No custom-glyph path hook.** The engraver renders text markup digits
  only; it cannot consume a registered path stencil (the
  `cnb:register-path!` table feeds noteheads, not clefs).

## 2. Conclusion: no custom-clef hook → export emits nothing

Per spec binding rule 4 ("Engine capability governs export"):

- **Session 2's exporter emits NOTHING for clefs.** No Section A
  registrations, no Section B variables. A clef-enabled config must
  generate a `.ly` byte-identical to the same config with the clef
  disabled — session 1 already added the pinning test
  (`cnb/tests/cnb-clef-tests.js`, "clef-enabled config exports identically
  to clef-disabled"), so session 2 inherits it.
- **The `clef` config section still round-trips through JSON save/load**
  (session 2 step 3 wires `clef.glyphs` into
  `CNBConfigIO.REPLACE_PATHS` — it is an open-keyed map).
- `docs/CNB-LY-EXPORT-SPEC-v1_2.md` needs **no** version-note addendum
  (spec session 2 step 4's condition "only if export emission was added"
  is not met).

## 3. Alignment note: the engine's numeral display is an E1 device

The requirements catalog's E1 entry includes register-identification
devices in the clef slot — octave numerals/labels (records 20 Lautus, 40
Chromatic Nydana) — as part of the custom-clef scope. The engine's dozenal
clef display **is** that device kind, hard-wired. The configurator's
`clef.glyphs` entries support `kind: "text"` (register label) as well as
`kind: "glyph"`, so when the engine grows a hook, both kinds have a
natural engine-side counterpart (text markup vs. path stencil).

## 4. Engine-repo work (owned by lilypond-chromatic-notation-base)

Recorded for the engine repo's backlog; NOT this set's scope:

1. **Configurability of the existing engraver** — a way to disable or
   select the dozenal display (it currently overrides every clef
   unconditionally).
2. **A custom-clef registration hook**, e.g.
   `cnb:register-clef! '(name path-data)` + settings for the anchor
   position (the configurator's `anchorSemi` top-edge float — see
   `s1-notes.md` §2 for the anchoring model and its evidence) and gutter
   padding, mirroring the notehead path/attachment registration pattern.
3. **Text-mode counterpart** — allowing a configured register label
   (glyph-free clef) to replace the computed dozenal number.

Until (2) exists, the engine-side contract for clef emission cannot be
fixed, which is exactly the condition spec rule 4 anticipates: export
stays silent, the coordination note (this file) records the ownership.
