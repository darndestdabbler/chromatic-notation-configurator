# Set 010 Session 1 — Engine capability discovery: key signatures

**Date:** 2026-07-07
**Engine repo inspected:** `d:/Projects/lilypond-chromatic-notation-base`
(local clone of `lilypond-chromatic-notation-base`), files
`cnb/keysig.ly`, `cnb/stencils.ly`, `cnb/layout.ly`, `cnb/config.ly`,
`cnb/colors.ly`.
**Purpose (spec step 6):** determine what key-signature support the engine
exposes today, pin what session 2's export will emit, and record any
engine-repo work. Per the set spec's binding rule 4, implementing engine
features is out of this set's scope.

---

## 1. What exists in the engine today — a full notehead-chord key-signature renderer

Unlike the set-009 clef finding (feature absent), the engine **already
implements** custom key signatures, and its design is the one the operator
directed as this set's default:

- **`cnb/keysig.ly` — notehead key-signature engraver.** Replaces
  LilyPond's standard sharps/flats key signature with **actual noteheads**:
  8 pitches computed from the score's key — the 7 scale degrees ascending
  stepwise from the tonic plus the octave tonic
  (`cnb:keysig-pitches`, keysig.ly:67) — interleaved into two columns,
  even indices left, odd indices right (`cnb:keysig-markup-list`,
  keysig.ly:169, x-offset `base + (even? i) ? 0 : width`). Read
  column-wise this is **two stacked 7th chords** (degrees 1-3-5-7 on the
  root, 2-4-6-8 on the second degree), with the chord qualities falling
  out of the mode (the file's header enumerates them: Ionian → maj7 +
  min7, Aeolian → min7 + half-dim7, etc.).
- **Real noteheads through the config pipeline.** Each mark is the
  notation's own notehead for that pitch class at **quarter-note duration**:
  `cnb:get-keysig-note-stencil` (stencils.ly:393) calls
  `cnb:lookup-config pitch-class 3` under the procedure model — i.e. the
  same `cnb:get-notehead-config` procedure the Configurator exports, with
  the key signature "rendered in the context of the key it represents"
  (stencils.ly:388).
- **Ledger lines and layering.** Ledgers are drawn per notehead by the
  shared proximity rule / custom ledger tables
  (`cnb:notehead-ledgers`, keysig.ly:107), ledger layer first, noteheads
  re-drawn on top (two-pass, keysig.ly:181/206). Ledger length is 4/3 of
  the notehead width (keysig.ly:131).
- **Gold separator bar.** A vertical bar in `cnb:gold` (`#ffd42a`,
  colors.ly:47 — "default color for key signature stem") at the right
  edge, spanning ±1 octave of staff spaces around the staff center
  (keysig.ly:224).
- **Unconditionally installed.** `cnb/layout.ly` registers
  `\consists \cnb-key-signature-engraver` in the `Staff` context
  (layout.ly:48). Every score with a `\key` gets this display; there is no
  flag to disable it.
- **No configuration surface.** `cnb/config.ly` contains **zero**
  key-signature settings (its only "Key signature" mention, config.ly:54,
  notes that `cnb:semitones-per-staff-space` affects keysig layout). There
  is no `cnb:register-keysig!`, no style/placement/color knobs; `cnb:gold`
  is a plain define in colors.ly, not a documented setting.

## 2. Conclusion: the engine renders key signatures FROM THE SCORE'S `\key` — export emits nothing

Per spec binding rule 4 ("Engine capability governs export"):

- **The key signature is driven by score data, not config.** The engraver
  reads the score's `\key` (`keySignature`/`tonic` context properties,
  keysig.ly:255) and the already-exported notehead configuration. Every
  input it consumes is either score-side or already in the Configurator's
  existing export (Sections A–C). There is **nothing for the exporter to
  emit**: a Configurator export already produces engine-rendered
  notehead-chord key signatures for any score that declares a key.
- **Session 2's exporter therefore emits NOTHING for the
  `keys.keySignature` section.** A keysig-enabled config must generate a
  `.ly` byte-identical to the same config with it disabled — session 1
  added the pinning test (`cnb/tests/cnb-key-signature-tests.js`,
  "keysig-enabled config exports identically to keysig-disabled"), so
  session 2 inherits it.
- **Preview/engine agreement for the default style is by construction.**
  The preview's `"notehead-chords"` style reproduces the keysig.ly layout
  (same 8-pitch scale stack, two-column interleave, quarter-note notehead
  resolution keyed to the selected key, shared ledger rules, gold bar), so
  what the preview shows for the selected key is what the engine engraves
  when the score is in that key. Documented preview-side deviation:
  vertical auto-anchoring centers the stack on `staff.midpoint` (the
  engine anchors at middle C, which coincides with the staff center for
  the default config) — see `s1-notes.md` D4.
- **The `"dot"` style is preview-only.** The engine has no simple-mark
  key-signature mode; a config using `style: "dot"` previews dots but
  engraves the engine's notehead chords. This is recorded as a documented
  divergence (UI copy in session 2 should note it) and as engine-repo
  work below.
- `docs/CNB-LY-EXPORT-SPEC-v1_2.md` needs **no** version-note addendum
  (spec session 2 step 4's condition "only if export emission was added"
  is not met).

## 3. Alignment with E2

The requirements catalog's E2 entry assumed "signature *rendering* is new
engine surface" — superseded by this discovery (recorded as scope
adjustment A2 in `s1-notes.md`). E2's Clairnote SN/DN drivers ("system of
alternative key signatures") are satisfied by the notehead-chord device;
the catalog's glyph-count and tonic-label sketches remain future options
(Tier-4 evidence only) and are not built.

## 4. Engine-repo work (owned by lilypond-chromatic-notation-base)

Recorded for the engine repo's backlog; NOT this set's scope:

1. **Configurability of the existing engraver** — a disable flag and/or
   style selection (the engraver currently replaces every key signature
   unconditionally; a Configurator `keys.keySignature.enabled: false`
   cannot suppress it engine-side).
2. **Separator-bar styling settings** — e.g. `cnb:keysig-bar-color` /
   thickness / extent (today `cnb:gold` and `thickness . 4` are
   hard-coded, keysig.ly:231), so the Configurator's
   `keySignature.separator` fields could be emitted as Section B
   variables.
3. **A simple-mark (dot) mode** — an engine counterpart to the preview's
   `"dot"` style, if wanted.
4. **Anchor-octave control** — the tonic octave is derived from
   `middleCPosition` (keysig.ly:74); a setting would let the Configurator
   emit its explicit `tonicOctave`.

When (2)/(3)/(4) exist, the corresponding `keySignature` fields become
emittable and the LY export spec gains a version-note addendum; until
then, export stays silent and this file records the ownership.
