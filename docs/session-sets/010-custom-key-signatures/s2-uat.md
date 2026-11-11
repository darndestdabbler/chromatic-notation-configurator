# Set 010 Session 2 — UAT: custom key signature end-to-end

**Date:** 2026-07-07
**Config:** `uatScope: per-set`, `requiresUAT: true`, `uatStyle: dsl`
**Scope (spec session 2 step 5):** one UAT pass covering the whole set —
enable → key selection → mark styling → preview → save/load → export —
through the assembled UI (`cnb/index.html`), followed by the human
operator's visual attestation of the rendered key signature.
**Executable form:** `cnb/uat/uat-key-signature.mjs` (Playwright driver,
set-004/005/006/009 pattern — the dabbler-uat-dsl compiler is still in
bootstrap, so the checklist below is authored in DSL step style and the
driver is its executable counterpart).

---

## 1. Checklist (DSL step style)

```
SCENARIO custom-key-signature-end-to-end
  GIVEN the assembled application cnb/index.html served from the repo root
  AND   the Google Fonts CDN stubbed (preview-only cosmetics)

  # Step 0 — initial assembly / default-off compatibility
  CHECK the key-signature editor (.cnb-key-signature-editor) is mounted
        alongside the set-006/009 modules (preview, config-io,
        config-export, clef editor)
  CHECK the keys master toggle is unchecked, the explicit disabled note is
        shown, and the controls below are DISABLED (shown, not hidden —
        the set-006 s3 rule, gated exactly on keys.enabled)
  CHECK the state panel's keys section equals the schema default
        (enabled:false, no definitions, keySignature default-off)
  CHECK the preview reserves NO keysig gutter (no .keysig-col), shows the
        13-card chromatic row, and shows no Key control (keys disabled)

  # Step 1 — enable keys (the master gate; UAT flow "enable")
  WHEN  the operator checks "Enable keys"
  CHECK keys.enabled is true in the shared config; the disabled note is
        gone and the controls are live
  CHECK the editor's validation pass-through shows "Config valid ✓" and
        the definitions section shows its explicit empty-state note
  CHECK the preview's Key control appears in its explicit
        empty-definitions state (disabled select + note)

  # Step 2 — define keys (definition controls; tonic resolution)
  WHEN  the operator adds a key definition
  CHECK the visible C-major template lands in the shared config
        (name "C", pitch classes 0 2 4 5 7 9 11)
  CHECK the tonic hint reads "tonic C (from name)" (the s1 D3 chain:
        explicit → name letter → first pitch class)
  WHEN  the operator adds a second definition (also the "C" template)
  CHECK the duplicate-name editor check appears in the validation panel
  WHEN  the operator renames the second definition to "D Dorian"
  CHECK the duplicate warning clears; both definitions are in the config
  CHECK "D Dorian" resolves tonic D from the name (the SAME pitch-class
        set as C major — the tonic is what distinguishes them)
  CHECK the preview's Key select offers both definitions

  # Step 3 — enable the key signature
  WHEN  the operator checks "Enable key signature"
  CHECK keys.keySignature.enabled is true, validation still valid
  CHECK with NO key selected the preview still reserves no keysig gutter
        (the displayed key is example data — s1 decision D5)

  # Step 4 — key selection → preview (Node-side geometry parity)
  WHEN  the operator selects key C in the preview's Key control
  CHECK one .keysig-col appears, width = CNBKeySignature.gutterWidth()
        computed Node-side on the same config (±0.001 CSSOM rounding)
  CHECK 8 notehead marks (7 degrees + octave tonic) render at the
        Node-side expected two-column positions — even indices left, odd
        right (keysig.ly's stacked-7th-chords layout), y = semiToY of
        signatureSemis on the preview grid
  CHECK ledger lines render beneath the marks
  CHECK the separator stem is the engine gold #ffd42a, runs through the
        horizontal MIDDLE of the two columns (x parity with the engine
        centering rule), spans staff midpoint ± extentSemis (y1/y2 parity
        with CNBGrid.semiToY), at the engine's 0.4-staff-space thickness
  CHECK the stem is drawn BENEATH the marks (first child of the keysig
        group — engine layering)
        [amended in UAT round 2 — see the run history: round 1 rendered
        the bar at the right edge per session 1's misreading of a
        keysig.ly comment; the operator corrected it and the engine
        geometry was measured from real engine renders]
  WHEN  the operator switches the key to D Dorian
  CHECK the signature re-anchors on tonic D (scale-from-tonic placement;
        first signature semitone = 2)

  # Step 5 — mark style + placement/separator/gutter controls
  #   [amended in UAT round 3: the mark-style vocabulary is a single value,
  #    "notehead-chords" — the task owner evaluated simple-mark styles
  #    (dot, interval blocks, staggered ledgers) and chose the note stack
  #    as the sole style, deferring custom-symbol signatures to a future
  #    set. See the run history + s2-design-consult.md.]
  CHECK the mark-style panel offers exactly one style, "notehead-chords",
        selected, with the engine (keysig.ly) attribution
  WHEN  the operator unchecks auto tonic octave and sets octave 0
  CHECK placement.tonicOctave is 0 and the marks shift an octave down
        (Node-side signatureSemis parity)
  WHEN  the operator re-checks auto
  CHECK tonicOctave is null again (centered on the staff midpoint —
        engine middle-C parity for the default config)
  WHEN  the operator sets separator extent 6 and gutter padding 16
  CHECK both reach the config; the bar shortens and the column resizes
  CHECK the 8 two-column notehead marks remain after the control edits

  # Step 6 — clef composition (set-009 gutter reuse)
  WHEN  the operator imports uat-clef.svg through the clef editor and
        enables the clef
  CHECK the preview row is clef-col, then keysig-col, then the 13 cards
        (clef first, key signature second, left to right)
  CHECK the keysig marks are unchanged inside their own column

  # Step 7 — save (Module 17, real download)
  WHEN  the operator saves the config
  CHECK the shell adopted the stamped config (live state panel deep-equal
        to the downloaded file)
  CHECK the file's keys section carries enabled:true, both definitions,
        signature enabled, separator extent 6, gutter 16

  # Step 8 — load (round trip)
  WHEN  the operator loads the saved file back
  CHECK round-trip fidelity: the shared config is deep-equal to the file
        (fixed-shape keySignature merge, array definitions replace — no
        default bleed-through; s1 decision D6, no REPLACE_PATHS entry)
  CHECK the IO panel reports the loaded config valid
  CHECK the key-signature editor re-seeded (both toggles checked, 2
        definition rows, gutter input 16)
  CHECK the preview still renders the key-C signature

  # Step 9 — export (Module 18, real download; s1 coordination outcome)
  WHEN  the operator exports the .ly file
  CHECK the download is byte-identical to a direct CNBLilypond.generate()
        call on the same config (Node-side, independent of the browser)
  CHECK the download is byte-identical to generate() of the same config
        with the key signature DISABLED, and contains no
        keysig/keySignature token anywhere — the set-010 no-emission pin,
        end-to-end (the engine renders key signatures from the score's
        \key; s1-engine-coordination.md)
  CHECK the export panel shows the valid badge with no error rows

  # Step 10 — hygiene
  CHECK no console or page errors occurred across the whole flow
```

---

## 2. Run history (honest, in execution order)

### Run 1 — 37/38, exit 1 (driver-check bug, not an app bug)

First execution failed ONE check:

```
FAIL  KEY SELECTION: selecting C grew a keysig gutter column of 138.35264px (Node-side CNBKeySignature.gutterWidth on the same config)  [dom width=138.353px]
```

Cause: the check compared `el.style.width` as an exact string, but CSSOM
serializes fractional pixel values to 3 decimals (`138.35264px` is read
back as `"138.353px"`). The rendered width was correct — the parallel
mark-position check (which parses `translate(x,y)` numerically) passed on
the same geometry. The set-009 clef driver never hit this because its
gutter widths were integers (56/72px); the keysig gutter inherits the
fractional notehead width (2 × 55.17632 + 4 + 2 × 12 = 138.35264).

Fix (driver only, `cnb/uat/uat-key-signature.mjs`): both gutter-width
checks now compare numerically, `|parseFloat(width) − expected| < 0.001`,
with the CSSOM rounding documented in the check label. No product code
changed between the runs.

### Run 2 — 38/38, exit 0 (complete unedited transcript)

Command (bash; `CNB_UAT_PLAYWRIGHT` points at a prior session's
scratchpad `node_modules` containing playwright-core, per the driver's
documented resolution order):

```
$ export CNB_UAT_PLAYWRIGHT="C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/36a76f7f-227f-4348-b798-ad0b23a6e22f/scratchpad"
$ export CNB_UAT_SHOTS="C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/e6163f69-bead-47f0-a456-afa921010489/scratchpad/uat-shots"
$ node cnb/uat/uat-key-signature.mjs
PASS  ASSEMBLY: the key-signature editor is mounted alongside the set-006/009 modules
PASS  DEFAULT-OFF: master toggle unchecked, the explicit disabled note is shown, controls below are disabled (shown, not hidden)
PASS  DEFAULT-OFF: state panel shows the schema default keys section
PASS  DEFAULT-OFF: the preview reserves NO keysig gutter (no .keysig-col), shows 13 cards, and no Key control (keys disabled)
PASS  ENABLE KEYS: keys.enabled true in the shared config; the disabled note is gone and controls are live
PASS  ENABLE KEYS: editor validation shows Config valid ✓ and the definitions section shows its explicit empty note
PASS  ENABLE KEYS: the preview's Key control appears with the explicit empty-definitions state (disabled select + note — set-006 s3 pattern)
PASS  DEFINE: adding a definition appends the visible C-major template to the shared config
PASS  DEFINE: the tonic hint resolves the tonic from the name — 'tonic C (from name)' (s1 D3 chain)
PASS  DEFINE: a second 'C' template triggers the duplicate-name editor check in the validation panel
PASS  DEFINE: renaming the second definition to 'D Dorian' clears the duplicate warning; both definitions are in the config
PASS  DEFINE: 'D Dorian' resolves tonic D from the name (same pitch-class set as C major — the tonic is what distinguishes them)
PASS  DEFINE: the preview's Key select now offers both definitions
PASS  ENABLE SIGNATURE: keys.keySignature.enabled true in the shared config, validation still valid
PASS  ENABLE SIGNATURE: with NO key selected the preview still reserves no keysig gutter (the displayed key is example data — s1 D5)
PASS  KEY SELECTION: selecting C grew a keysig gutter column of 138.35264px (Node-side CNBKeySignature.gutterWidth on the same config, ±0.001 CSSOM rounding)
PASS  KEY SELECTION: 8 notehead marks (7 degrees + octave tonic) at the Node-side expected two-column grid positions (even left, odd right — keysig.ly's stacked-7th-chords layout)
PASS  KEY SELECTION: ledger lines render beneath the marks (at least one ledger element inside the keysig group)
PASS  SEPARATOR: the engine-gold bar (#ffd42a) spans midpoint ± 12 semitones (y1/y2 parity with CNBGrid.semiToY)
PASS  KEY SELECTION: switching to D Dorian re-anchors the signature on tonic D (same pitch-class set, different tonic — scale-from-tonic placement)
PASS  STYLING: dot style — keySignature.style 'dot' in the config; the option row carries the preview-only engine note
PASS  STYLING: dot style renders 8 circles (r=4.8px = radiusPct of a semitone) at the single-column grid positions, no notehead paths
PASS  STYLING: explicit tonic octave 0 reaches placement.tonicOctave and shifts the marks an octave down (Node-side signatureSemis parity)
PASS  STYLING: re-checking auto restores tonicOctave null (centered on the staff midpoint — engine parity for the default config)
PASS  STYLING: separator extent 6 and gutter padding 16 reach the config and the preview (bar shortened, column resized)
PASS  STYLING: switching back to notehead chords restores the 8 two-column notehead marks (engine-default style for the attestation frames)
PASS  COMPOSITION: clef enabled — the preview row is clef-col, then keysig-col, then the 13 cards (clef first, key signature second, left to right)
PASS  COMPOSITION: the keysig marks are unchanged inside their own column (gutters compose, no re-anchoring)
PASS  SAVE: the shell adopted the stamped config — the live state panel is deep-equal to the downloaded file
PASS  SAVE: the keys section is in the file — enabled, 2 definitions, signature enabled, extent 6, gutter 16
PASS  LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file (fixed-shape keySignature merge, array definitions replace — no default bleed-through)
PASS  LOAD: loaded config reported valid in the IO panel
PASS  LOAD: the key-signature editor re-seeded from the loaded config (master + signature checked, 2 definition rows, gutter input 16)
PASS  LOAD: the preview still renders the key-C signature in its gutter (preview key selection survives the load)
PASS  EXPORT PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)
PASS  EXPORT NO-EMISSION: the keysig-enabled download is byte-identical to generate() of the same config with the signature disabled, and contains no keysig/keySignature token
PASS  EXPORT: valid badge shown, no error rows
PASS  NO console or page errors across the whole key-signature flow

38/38 checks passed
Screenshots + saved/exported files: C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/e6163f69-bead-47f0-a456-afa921010489/scratchpad/uat-shots
$ echo "exit: $?"
exit: 0
```

### UAT round 1 — operator review of the run-2 package: ISSUES (verbatim)

The run-2 screenshot package was delivered in `C:\temp\cnb-010-s2-uat\`
and the operator was asked (AskUserQuestion) whether the key signature
renders correctly per the keysig.ly design. The operator's complete
response, verbatim:

> "For #4 and #5, the gold bar is supposed to be in the horizontal middle
> of the two stacks of seventh chords, and it should be a thicker line to
> make it stand out.  Look at what I have now.
>
> Note: I am not an expert in the Dorian key signature, so, please verify
> its position in another way.
>
> For #6, the dots are really small.  Is the dot style supposed to be
> like Clairnote?
>
> I wonder how difficult it would be to allow for custom key signatures
> like Clairnote, but more generally: (a) define a set of SVG symbols for
> clefs, (b) define the rules for when (based upon key and mode) and
> where (vertical and relative horizontal positions) those symbols are
> represented in the key signature.  That might be too difficult or not
> worth it.  Perhaps we should do a consult with GPT and Gemini on this."

### Remediation (engine renders as ground truth — "look at what I have now")

Per the operator's pointer to the engine's own output, real engine
renders were produced with LilyPond 2.24.2 from the engine repo
(`d:/Projects/lilypond-chromatic-notation-base`): minimal scores through
the set-007 Kite 4-369 fixture config (pre-baked paths; sps 3) and the
default 4-8 export (sps 4), in `\key c \major` and `\key d \dorian`,
rendered to SVG and PNG (scratchpad `engine-probe/`).

**Separator bar — the operator is right; session 1 misread the engine.**
`keysig.ly`'s comment says "gold vertical bar … at the right edge", but
its own computation is `(set! x-offset (- max-notehead-x-offset
(/ max-notehead-width 2)))` — exactly midway between the two column
centers — and the bar stencil is `ly:stencil-add`-ed UNDER the
notehead/ledger stencil. Measured from the engine SVGs:

- Kite render: keysig columns at x 6.3545 / 7.6880, gold bar at
  x 7.0212 = the exact midpoint; stroke-width 0.4 staff-space.
- Default-4-8 render: columns at 6.354 / 351.207 (natural units), bar at
  178.78 = again the exact midpoint; stroke-width 0.4 staff-space.
- Both renders: bar spans ±1 octave around the staff center; bar drawn
  beneath the noteheads.

Fixes applied (renderer + schema defaults + tests + editor copy): the
separator now renders through the horizontal middle of the mark columns,
FIRST (bottom layer, engine layering), contributes no gutter width, and
defaults to `thicknessPct: 160` — 0.4 staff-space at the default staff's
4 semitones per space, the engine's measured constant.

**D Dorian verified "in another way" — against the engine itself.** The
engine's `\key d \dorian` render stacks its 8 keysig noteheads with
vertical gaps of 2,1,2,2,2,1,2 semitones bottom→top (measured translate
ys: 9.7306 → 5.7306 in staff-space steps of 0.6667/0.3334 at sps 3), and
its bottom note sits exactly 2 semitones above the `\key c \major`
render's bottom note. That is the D dorian scale D E F G A B C D
ascending from a tonic one whole step above C — precisely the preview's
`signatureSemis` output ([2,4,5,7,9,11,12,14]: same 2,1,2,2,2,1,2 gaps,
tonic 2). The interval stack and tonic anchoring match the engine
exactly; the absolute octave differs only by the documented D4
auto-centering vs middle-C divergence.

**Dot size and the Clairnote question.** The dot default was raised from
`radiusPct: 30` (diameter 0.6 semitone — the "really small" round-1
dots) to `radiusPct: 60` (diameter 1.2 semitones), adjustable in the
editor. On "is the dot style supposed to be like Clairnote?": no — the
honest answer is that the set-008 survey (this set's scope authority)
recorded Clairnote SN/DN key signatures only as "a system of alternative
… key signatures" with **no visual detail captured** ("none visible in
the scale image", catalog records 27/29), so the dot style implements
the spec's own "simple built-in mark such as a dot" arm (binding rule 2)
at the same scale-from-tonic positions — it was not designed as a
Clairnote reproduction. Clairnote-fidelity signatures are exactly what
the operator's generalized-symbols idea would cover; see below.

**GPT + Gemini consult (operator request).** Run and recorded verbatim in
`s2-design-consult.md`. Both models converge: worth doing kept narrow —
a declarative `{symbolId, semitone, column}` placement table under a new
`placement.rule` value, explicit mode metadata on key definitions (never
inferred from pitch-class sets), engine work limited to a disable flag +
explicit mark-list renderer, GUI rule editor deferred.

### Run 3 — 39/39, exit 0 (after remediation; complete unedited transcript)

Same command as run 2 (the driver gained one new check for the stem
layering, and the separator check now asserts the center x, the
0.4-staff-space thickness, and the bottom-layer position):

```
$ node cnb/uat/uat-key-signature.mjs
PASS  ASSEMBLY: the key-signature editor is mounted alongside the set-006/009 modules
PASS  DEFAULT-OFF: master toggle unchecked, the explicit disabled note is shown, controls below are disabled (shown, not hidden)
PASS  DEFAULT-OFF: state panel shows the schema default keys section
PASS  DEFAULT-OFF: the preview reserves NO keysig gutter (no .keysig-col), shows 13 cards, and no Key control (keys disabled)
PASS  ENABLE KEYS: keys.enabled true in the shared config; the disabled note is gone and controls are live
PASS  ENABLE KEYS: editor validation shows Config valid ✓ and the definitions section shows its explicit empty note
PASS  ENABLE KEYS: the preview's Key control appears with the explicit empty-definitions state (disabled select + note — set-006 s3 pattern)
PASS  DEFINE: adding a definition appends the visible C-major template to the shared config
PASS  DEFINE: the tonic hint resolves the tonic from the name — 'tonic C (from name)' (s1 D3 chain)
PASS  DEFINE: a second 'C' template triggers the duplicate-name editor check in the validation panel
PASS  DEFINE: renaming the second definition to 'D Dorian' clears the duplicate warning; both definitions are in the config
PASS  DEFINE: 'D Dorian' resolves tonic D from the name (same pitch-class set as C major — the tonic is what distinguishes them)
PASS  DEFINE: the preview's Key select now offers both definitions
PASS  ENABLE SIGNATURE: keys.keySignature.enabled true in the shared config, validation still valid
PASS  ENABLE SIGNATURE: with NO key selected the preview still reserves no keysig gutter (the displayed key is example data — s1 D5)
PASS  KEY SELECTION: selecting C grew a keysig gutter column of 134.35264px (Node-side CNBKeySignature.gutterWidth on the same config, ±0.001 CSSOM rounding)
PASS  KEY SELECTION: 8 notehead marks (7 degrees + octave tonic) at the Node-side expected two-column grid positions (even left, odd right — keysig.ly's stacked-7th-chords layout)
PASS  KEY SELECTION: ledger lines render beneath the marks (at least one ledger element inside the keysig group)
PASS  SEPARATOR: the engine-gold stem (#ffd42a) runs through the middle of the columns (x=67.17632) and spans midpoint ± 12 semitones (x/y parity with the engine centering rule + CNBGrid.semiToY)
PASS  SEPARATOR: the stem is drawn beneath the marks (first child of the keysig group — engine layering)
PASS  KEY SELECTION: switching to D Dorian re-anchors the signature on tonic D (same pitch-class set, different tonic — scale-from-tonic placement)
PASS  STYLING: dot style — keySignature.style 'dot' in the config; the option row carries the preview-only engine note
PASS  STYLING: dot style renders 8 circles (r=9.6px = radiusPct of a semitone) at the single-column grid positions, no notehead paths
PASS  STYLING: explicit tonic octave 0 reaches placement.tonicOctave and shifts the marks an octave down (Node-side signatureSemis parity)
PASS  STYLING: re-checking auto restores tonicOctave null (centered on the staff midpoint — engine parity for the default config)
PASS  STYLING: separator extent 6 and gutter padding 16 reach the config and the preview (bar shortened, column resized)
PASS  STYLING: switching back to notehead chords restores the 8 two-column notehead marks (engine-default style for the attestation frames)
PASS  COMPOSITION: clef enabled — the preview row is clef-col, then keysig-col, then the 13 cards (clef first, key signature second, left to right)
PASS  COMPOSITION: the keysig marks are unchanged inside their own column (gutters compose, no re-anchoring)
PASS  SAVE: the shell adopted the stamped config — the live state panel is deep-equal to the downloaded file
PASS  SAVE: the keys section is in the file — enabled, 2 definitions, signature enabled, extent 6, gutter 16
PASS  LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file (fixed-shape keySignature merge, array definitions replace — no default bleed-through)
PASS  LOAD: loaded config reported valid in the IO panel
PASS  LOAD: the key-signature editor re-seeded from the loaded config (master + signature checked, 2 definition rows, gutter input 16)
PASS  LOAD: the preview still renders the key-C signature in its gutter (preview key selection survives the load)
PASS  EXPORT PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)
PASS  EXPORT NO-EMISSION: the keysig-enabled download is byte-identical to generate() of the same config with the signature disabled, and contains no keysig/keySignature token
PASS  EXPORT: valid badge shown, no error rows
PASS  NO console or page errors across the whole key-signature flow

39/39 checks passed
Screenshots + saved/exported files: C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/e6163f69-bead-47f0-a456-afa921010489/scratchpad/uat-shots
$ echo "exit: $?"
exit: 0
```

Full test suites after remediation: `node cnb/tests/run-tests.js` →
692 passed, 0 failed; `node legacy/run-tests.js` → 240/240 passed.

---

### UAT round 2 — operator review of the run-3 package: further ISSUES (verbatim)

The run-3 package (with the two engine render crops for comparison) was
delivered and the operator asked whether the corrected rendering matched
keysig.ly. The operator accepted the notehead-chords/separator/Dorian
fixes but raised a NEW issue about the dot style, verbatim:

> "I think that the dots are going to be too small.  Often staves are
> rendered at a small scale.  The dots are going to be hard to read,
> except at a larger-than-normal scale.  I would do away with them.
> Consider some other substitutes: c:\temp\alt-key-sigs.svg"

### Remediation round 2 — remove the dot style, add two legible mark styles

`c:\temp\alt-key-sigs.svg` (an Inkscape concept sketch by the operator)
carries two alternative mark styles, both staggered left/right of the same
gold stem and both legible at small scale. Measured from the SVG:

- **Left design → "interval-blocks".** Filled black blocks staggered L/R,
  each block's HEIGHT equal to the interval to the next degree (whole
  step = tall block 6.56 units ≈ 2 semitones, half step = short block
  3.17 ≈ 1 semitone; the stack sums to one octave). The operator's words:
  "really a set of intervals between successive pitches." The 7 blocks
  read W W H W W W H bottom-to-top = a major scale. So the interval
  structure is read directly from the block heights.
- **Right design → "staggered-ledgers".** Short horizontal ledger ticks
  staggered L/R, one per scale degree at its grid position.

Both are far more legible at small staff scale than the small filled dots.
The `dot` style was **removed** (never released — added in session 1, this
same set) and replaced by these two:

- Schema: `keySignature.style` vocabulary is now
  `"notehead-chords" | "interval-blocks" | "staggered-ledgers"`; the
  `dot: { radiusPct }` subsection is replaced by
  `intervalBlocks: { widthPct: 150 }` and
  `staggeredLedgers: { lengthPct: 150, thicknessPct: 40 }`. Validation,
  the editor controls, all tests, this driver, and the architecture-plan
  §4.9 doc updated to match.
- Renderer: `interval-blocks` draws one filled `<rect>` per successive
  interval (height = the interval in semitones, filled with the lower
  degree's resolved color); `staggered-ledgers` draws one `<line>` tick
  per degree. Both stagger even/odd about the same gold stem, which stays
  the bottom layer.
- On the Clairnote question: the honest answer stands — the dot style was
  never a Clairnote reproduction, and neither are these; they are the
  spec's "simple built-in mark" arm made legible. True Clairnote-fidelity
  signatures are what the generalized-symbols consult (`s2-design-consult.md`)
  scopes for a future set.

### Run 4 — 41/41, exit 0 (after remediation round 2; complete unedited transcript)

The driver's STEP 5 now exercises BOTH new styles (interval-blocks: 7
rects with interval-matched heights; staggered-ledgers: 8 horizontal
ticks) instead of the dot style.

```
$ node cnb/uat/uat-key-signature.mjs
PASS  ASSEMBLY: the key-signature editor is mounted alongside the set-006/009 modules
PASS  DEFAULT-OFF: master toggle unchecked, the explicit disabled note is shown, controls below are disabled (shown, not hidden)
PASS  DEFAULT-OFF: state panel shows the schema default keys section
PASS  DEFAULT-OFF: the preview reserves NO keysig gutter (no .keysig-col), shows 13 cards, and no Key control (keys disabled)
PASS  ENABLE KEYS: keys.enabled true in the shared config; the disabled note is gone and controls are live
PASS  ENABLE KEYS: editor validation shows Config valid ✓ and the definitions section shows its explicit empty note
PASS  ENABLE KEYS: the preview's Key control appears with the explicit empty-definitions state (disabled select + note — set-006 s3 pattern)
PASS  DEFINE: adding a definition appends the visible C-major template to the shared config
PASS  DEFINE: the tonic hint resolves the tonic from the name — 'tonic C (from name)' (s1 D3 chain)
PASS  DEFINE: a second 'C' template triggers the duplicate-name editor check in the validation panel
PASS  DEFINE: renaming the second definition to 'D Dorian' clears the duplicate warning; both definitions are in the config
PASS  DEFINE: 'D Dorian' resolves tonic D from the name (same pitch-class set as C major — the tonic is what distinguishes them)
PASS  DEFINE: the preview's Key select now offers both definitions
PASS  ENABLE SIGNATURE: keys.keySignature.enabled true in the shared config, validation still valid
PASS  ENABLE SIGNATURE: with NO key selected the preview still reserves no keysig gutter (the displayed key is example data — s1 D5)
PASS  KEY SELECTION: selecting C grew a keysig gutter column of 134.35264px (Node-side CNBKeySignature.gutterWidth on the same config, ±0.001 CSSOM rounding)
PASS  KEY SELECTION: 8 notehead marks (7 degrees + octave tonic) at the Node-side expected two-column grid positions (even left, odd right — keysig.ly's stacked-7th-chords layout)
PASS  KEY SELECTION: ledger lines render beneath the marks (at least one ledger element inside the keysig group)
PASS  SEPARATOR: the engine-gold stem (#ffd42a) runs through the middle of the columns (x=67.17632) and spans midpoint ± 12 semitones (x/y parity with the engine centering rule + CNBGrid.semiToY)
PASS  SEPARATOR: the stem is drawn beneath the marks (first child of the keysig group — engine layering)
PASS  KEY SELECTION: switching to D Dorian re-anchors the signature on tonic D (same pitch-class set, different tonic — scale-from-tonic placement)
PASS  STYLING: interval-blocks — keySignature.style 'interval-blocks'; the option row carries the preview-only engine note
PASS  STYLING: interval-blocks renders 7 filled rects, heights = successive intervals (W W H W W W H for C major), no circles/paths
PASS  STYLING: staggered-ledgers — keySignature.style 'staggered-ledgers'; the option row carries the preview-only engine note
PASS  STYLING: staggered-ledgers renders 8 horizontal ticks at the degree grid positions (plus the separator line), no circles/rects
PASS  STYLING: explicit tonic octave 0 reaches placement.tonicOctave and shifts the marks an octave down (Node-side signatureSemis parity)
PASS  STYLING: re-checking auto restores tonicOctave null (centered on the staff midpoint — engine parity for the default config)
PASS  STYLING: separator extent 6 and gutter padding 16 reach the config and the preview (bar shortened, column resized)
PASS  STYLING: switching back to notehead chords restores the 8 two-column notehead marks (engine-default style for the attestation frames)
PASS  COMPOSITION: clef enabled — the preview row is clef-col, then keysig-col, then the 13 cards (clef first, key signature second, left to right)
PASS  COMPOSITION: the keysig marks are unchanged inside their own column (gutters compose, no re-anchoring)
PASS  SAVE: the shell adopted the stamped config — the live state panel is deep-equal to the downloaded file
PASS  SAVE: the keys section is in the file — enabled, 2 definitions, signature enabled, extent 6, gutter 16
PASS  LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file (fixed-shape keySignature merge, array definitions replace — no default bleed-through)
PASS  LOAD: loaded config reported valid in the IO panel
PASS  LOAD: the key-signature editor re-seeded from the loaded config (master + signature checked, 2 definition rows, gutter input 16)
PASS  LOAD: the preview still renders the key-C signature in its gutter (preview key selection survives the load)
PASS  EXPORT PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)
PASS  EXPORT NO-EMISSION: the keysig-enabled download is byte-identical to generate() of the same config with the signature disabled, and contains no keysig/keySignature token
PASS  EXPORT: valid badge shown, no error rows
PASS  NO console or page errors across the whole key-signature flow

41/41 checks passed
$ echo "exit: $?"
exit: 0
```

Full test suites after remediation round 2: `node cnb/tests/run-tests.js`
→ 695 passed, 0 failed; `node legacy/run-tests.js` → 240/240 passed.

---

### UAT round 3 — operator review of the run-4 package: prefers the note stack, defer customization (verbatim)

The run-4 package (the two new styles + gutter closeups + the operator's
own alt-key-sigs.svg render) was delivered and the operator was asked
whether the two new styles rendered as intended. The operator's complete
response, verbatim:

> "Actually, I am not a big fan of either alternative.  The default
> note-stack key signature is far better.  My only thought is whether we
> need to support anything more customized like what Clairnote does.
> Before we do that, let's discuss."

This both **attests the notehead-chords (note-stack) rendering** ("the
default note-stack key signature is far better") and rejects the two
simple-mark alternatives I had built. The Clairnote-customization idea was
raised as a "let's discuss," not a build request.

### Discussion + decision (AskUserQuestion, two questions)

The generalized custom-symbol key-signature discussion was presented to
the operator (basis: the `s2-design-consult.md` GPT+Gemini synthesis, plus
two facts — set 008 captured NO visual detail of Clairnote's key
signatures, so "like Clairnote" needs a research pass first; and the
engine has no key-signature config surface, so anything custom is
preview-only until engine work lands). The operator was asked to decide
the styles-to-ship and the customization handling. Selections:

- **Mark styles:** "Note-stack only" — remove interval-blocks and
  staggered-ledgers; ship notehead-chords as the sole style.
- **Clairnote-style customization:** "Defer to a future set."

### Remediation round 3 — note-stack as the sole style

- **Removed** the `interval-blocks` and `staggered-ledgers` styles (and
  their `intervalBlocks` / `staggeredLedgers` config subsections, editor
  controls, validation branches, and tests). The dot style was already
  gone. `keySignature.style` is now a single-value vocabulary
  (`"notehead-chords"`), matching the `placement.rule` pattern — the
  designed extension point for future styles; validation rejects unknown
  values, the renderer treats an unknown style as inactive.
- The notehead-chords rendering (the round-2 engine-verified separator
  geometry and all placement) is **unchanged** from what the operator
  approved.
- The generalized custom-symbol feature is deferred to a future set;
  `s2-design-consult.md` records the consult that scopes it.

### Run 5 — 38/38, exit 0 (after remediation round 3; complete unedited transcript)

STEP 5 now checks the single style vocabulary (one selectable style,
notehead-chords) and the placement/separator/gutter controls, instead of
switching among alternatives.

```
$ node cnb/uat/uat-key-signature.mjs
PASS  ASSEMBLY: the key-signature editor is mounted alongside the set-006/009 modules
PASS  DEFAULT-OFF: master toggle unchecked, the explicit disabled note is shown, controls below are disabled (shown, not hidden)
PASS  DEFAULT-OFF: state panel shows the schema default keys section
PASS  DEFAULT-OFF: the preview reserves NO keysig gutter (no .keysig-col), shows 13 cards, and no Key control (keys disabled)
PASS  ENABLE KEYS: keys.enabled true in the shared config; the disabled note is gone and controls are live
PASS  ENABLE KEYS: editor validation shows Config valid ✓ and the definitions section shows its explicit empty note
PASS  ENABLE KEYS: the preview's Key control appears with the explicit empty-definitions state (disabled select + note — set-006 s3 pattern)
PASS  DEFINE: adding a definition appends the visible C-major template to the shared config
PASS  DEFINE: the tonic hint resolves the tonic from the name — 'tonic C (from name)' (s1 D3 chain)
PASS  DEFINE: a second 'C' template triggers the duplicate-name editor check in the validation panel
PASS  DEFINE: renaming the second definition to 'D Dorian' clears the duplicate warning; both definitions are in the config
PASS  DEFINE: 'D Dorian' resolves tonic D from the name (same pitch-class set as C major — the tonic is what distinguishes them)
PASS  DEFINE: the preview's Key select now offers both definitions
PASS  ENABLE SIGNATURE: keys.keySignature.enabled true in the shared config, validation still valid
PASS  ENABLE SIGNATURE: with NO key selected the preview still reserves no keysig gutter (the displayed key is example data — s1 D5)
PASS  KEY SELECTION: selecting C grew a keysig gutter column of 134.35264px (Node-side CNBKeySignature.gutterWidth on the same config, ±0.001 CSSOM rounding)
PASS  KEY SELECTION: 8 notehead marks (7 degrees + octave tonic) at the Node-side expected two-column grid positions (even left, odd right — keysig.ly's stacked-7th-chords layout)
PASS  KEY SELECTION: ledger lines render beneath the marks (at least one ledger element inside the keysig group)
PASS  SEPARATOR: the engine-gold stem (#ffd42a) runs through the middle of the columns (x=67.17632) and spans midpoint ± 12 semitones (x/y parity with the engine centering rule + CNBGrid.semiToY)
PASS  SEPARATOR: the stem is drawn beneath the marks (first child of the keysig group — engine layering)
PASS  KEY SELECTION: switching to D Dorian re-anchors the signature on tonic D (same pitch-class set, different tonic — scale-from-tonic placement)
PASS  STYLING: the mark-style panel offers exactly one style (notehead-chords), selected, with engine attribution
PASS  STYLING: explicit tonic octave 0 reaches placement.tonicOctave and shifts the marks an octave down (Node-side signatureSemis parity)
PASS  STYLING: re-checking auto restores tonicOctave null (centered on the staff midpoint — engine parity for the default config)
PASS  STYLING: separator extent 6 and gutter padding 16 reach the config and the preview (bar shortened, column resized)
PASS  STYLING: the notehead-chords marks remain the 8 two-column stack after the control edits
PASS  COMPOSITION: clef enabled — the preview row is clef-col, then keysig-col, then the 13 cards (clef first, key signature second, left to right)
PASS  COMPOSITION: the keysig marks are unchanged inside their own column (gutters compose, no re-anchoring)
PASS  SAVE: the shell adopted the stamped config — the live state panel is deep-equal to the downloaded file
PASS  SAVE: the keys section is in the file — enabled, 2 definitions, signature enabled, extent 6, gutter 16
PASS  LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file (fixed-shape keySignature merge, array definitions replace — no default bleed-through)
PASS  LOAD: loaded config reported valid in the IO panel
PASS  LOAD: the key-signature editor re-seeded from the loaded config (master + signature checked, 2 definition rows, gutter input 16)
PASS  LOAD: the preview still renders the key-C signature in its gutter (preview key selection survives the load)
PASS  EXPORT PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)
PASS  EXPORT NO-EMISSION: the keysig-enabled download is byte-identical to generate() of the same config with the signature disabled, and contains no keysig/keySignature token
PASS  EXPORT: valid badge shown, no error rows
PASS  NO console or page errors across the whole key-signature flow

38/38 checks passed
$ echo "exit: $?"
exit: 0
```

Full test suites after remediation round 3: `node cnb/tests/run-tests.js`
→ 691 passed, 0 failed; `node legacy/run-tests.js` → 240/240 passed.

---

## 3. Human visual attestation

The round-1 and round-2 reviews are **superseded**. The FINAL shipped
deliverable is the notehead-chords (note-stack) key signature as the sole
mark style — which the operator explicitly attested in the round-3 review
above: **"The default note-stack key signature is far better."** That
rendering is unchanged from the run-3/run-4 packages the operator saw and
approved (the engine-verified separator geometry, the two-column stacked-
7th-chords layout, D-Dorian anchoring, clef composition, save/load, and
export no-emission). Removing the two rejected alternatives changed
nothing about the note-stack the operator approved.

The refreshed final package (run-5 screenshots) was delivered to
`C:\temp\cnb-010-s2-uat\` for the record. No further visual attestation
was solicited: the operator's round-3 statement is a direct approval of
the shipped rendering, and the only change since was the removal of
UI/styles they had rejected.
