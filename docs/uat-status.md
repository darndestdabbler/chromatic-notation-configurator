# Browser UAT status

The Playwright drivers under `cnb/uat/` drive the real app (or a module's
test page) in Chromium; `uat-hostile-input.mjs` (session 6) runs its
checklist in Chromium, Firefox and Edge. `npm run uat` runs every
`cnb/uat/uat-*.mjs` in name order through `cnb/uat/run-uat.mjs` and stops
at the first driver that exits non-zero. Setup is in the README ("Running
the Browser UAT").

## A declared suite

The UAT is declared as the second suite, `cnb-uat`, in `dabbler.yaml`
(`command: npm run uat`, expensive, run whole at close, covering `cnb/`).
Drivers have needed repairs since it was declared in session 5, most of all
when the app moved to the new page in session 25, and each session that
changes the app keeps them passing. The suite runs at close because the
whole run takes about a minute and gives the same result every time, so
nothing argues for leaving it to the operator. The
suite does not install its prerequisites (`npm install`,
`npx playwright-core install chromium firefox`, the locked package's own
installer, Node.js 20+, an installed Microsoft Edge). On
a machine without them a driver exits 2 and names what is missing.

## One model for the key signature — 2026-11-12 (session 54)

The approved key-signature editor design (session 53,
`docs/planning/key-signature-designer-design.md` §13) replaces the two
styles with one model. This session builds it on the canvas; the export
of what is new waits for engine 1.6.0 (session 55).

- **The config.** `keys.keySignature.style` is retired. The model adds the
  sharps or flats only (`notes: "altered"`), looks for naturals, a line or
  ledger and a space, a look's `sign`, `offset` and up to two `added`
  symbols, the cycle of fifths (`stacking: "fifths"`) with its `heights`
  ("window" or "scale") and `window`, and a shape's `reference` and
  `ledgers`, all validated. A config saved with a style is converted when
  it loads (`CNBConfig.signatureStyleToModel`): "accidentals" becomes the
  sharps or flats only, black Emmentaler signs and the cycle of fifths
  climbing, as session 51 drew them.
- **The canvas.** `CNBKeySignature.marks` and `render` draw the model:
  each mark's base and added symbols, placed by a reference point plus an
  offset; a sign black unless a look colours it; a head's ledgers following
  its base; the step between stacks the farthest reach right plus the
  farthest reach left; and the window's zigzag, C♯ major's sharps on 6 13 8
  15 10 17 12 in the middle of the default staff.
- **Nothing that was drawn moved.** Every fixture and gallery file draws
  its signature exactly as before (the signature baseline,
  `cnb/fixtures/key-signature-baseline.json`). Saved with each of session
  53's styles (notehead-chords in the middle; accidentals in the middle and
  on every line set) and loaded through the conversion, the default, the
  three fixtures and all 18 gallery files render in four keys and export
  byte-identically to session 53's code: 330 hashes in
  `cnb/fixtures/key-signature-styles-baseline.json`, captured with that
  code and checked by `cnb/tests/cnb-key-signature-tests.js`, which also
  pins eight renders and three exports with a sized, coloured and
  tonic-octave accidentals signature. The five export baselines are
  unchanged.
- **The panel** keeps working on the model until session 56's editor: Draw's
  "Sharps or flats" sets the traditional starting point (the sharps or flats
  only, the signs, the cycle of fifths in a window, the middle of the
  staff), and "The key's notes" sets the defaults, each keeping Show the key
  signature.
- **The engine's work** is planned: engine session 37 (placed, coloured and
  layered marks: `(at dx . dy)`, a sign's colour, the `symbol` kind, every
  ledger before the marks) and session 38, the 1.6.0 release.

**What the UAT checks.** `uat-key-signature.mjs` now checks that Sharps or
flats writes the traditional starting point, with no style; that the
signs in C, D and B♭ major, in the middle and on the bottom and every line
set, are drawn exactly as the Node-side renderer draws them, and the export
carries D major's window on every line set, `(6 0 …) (1 1 …) (18 0 …)
(13 1 …)`; that C♯ major's sharps zigzag on 6 13 8 15 10 17 12; that The
key's notes sets the defaults; that a config saved with the style
"accidentals" loads as the model, its C♯ major sharps climbing on 6 1 8 3
10 5 12 as session 51 drew them; and that one saved with
"notehead-chords" loads with every setting as saved: **pass, 88/88
checks**. `uat-app-layout.mjs`: **pass, 79/79 checks**. The whole UAT
(`cnb/uat/run-uat.mjs`) passes.

**The screenshots, judged.** `uat-054-window-1440.png` and
`uat-054-window-1280.png` (in the UAT's screenshot folder) show C♯ major's
seven sharps on the staff and in the Key signature section's canvas,
falling a fourth and rising a fifth in turn as a treble signature's do,
each its own column, black, in proportion to the noteheads, with no gold
stem; the panel shows Draw on Sharps or flats, Size and Place. At both
widths nothing scrolls sideways and nothing overlaps. As before, the
full-page capture at 1440 px of the session-50 panel shows the sticky
header partway down the page, an artifact of the capture.

## Sharps and flats sized to the noteheads — 2026-11-11 (session 52)

Session 51 drew the signs at LilyPond's size, a sharp 3 staff spaces tall:
12 semitones on the default staff, an octave, far too big beside its
noteheads.

- **The size.** `keys.keySignature.signs.heightSemis`, the sharp's height
  from the top left of its upper bar to the top left of its lower bar, in
  semitones. `null`, the default, is automatic: the least of the noteheads'
  mean height, one staff space and 3 semitones, which gives 2.72 on the
  default staff, 3 on Kite 4-369, 1 on 0-5-7 and Avique, and 2 on the rest
  of the gallery (`CNBKeySignature.signHeight`). The sharp and flat are
  scaled by the size ÷ the sharp's bar spacing (1.048 or 1.052 staff
  spaces, measured from its outline in each optical size) ÷ the semitones
  per staff space (`signScale`, 0.6473 on the default staff), so the sharp
  is 7.77 semitones tall instead of 12, and the columns are the scaled
  signs' widths apart.
- **The panel.** Under Sharps or flats, a Size row: "Automatic (2.72)" or
  "Set by hand" with a number of semitones; Automatic writes `null` again.
  The Place hint no longer mentions the tonic and the half steps there.
- **The export** writes each sign's scale, `(6 0 sharp 0.6473)`, left out
  at 1 (LY export spec 1.3.18), which engine 1.5.0 reads. The five export
  baselines are byte-identical. Engine round trips hold every sign's kind,
  origin, scaled box and the ink to 0.001 staff spaces, for the default and
  Kite 4-369, middle, bottom and every line set, C, D and B♭ major, at the
  automatic size and 4 semitones set by hand, at magnifications 1, 7/4, 4/5
  and 5/2, and the spacing with and without a clef to 0.005.
- **The magnification a config sets.** Since engine 1.5.0 a plain score
  engraves at the config's `cnb:default-magnify`, so the round trips no
  longer magnify their staff with `\magnifyStaff #cnb:default-magnify`.
  The spacing round trips at magnifications 1 and 5/2, which had been
  engraved at 7/4 all along, then showed two real differences, fixed in the
  preview: the engine draws every clef 1 unmagnified staff space (1/m of
  the staff's) right of its box, so the signature starts 3.5 − 1/m staff
  spaces after the clef's ink; and the first note follows a 4/4 time
  signature whose width depends on the optical size (1.7 in emmentaler-20,
  1.7135 in -26). Below magnification 0.8 LilyPond also keeps the staff
  lines and the note spacing at their unmagnified sizes, which the preview
  does not follow (LY spec §5.6a).

**What the UAT checks.** `uat-key-signature.mjs` now also checks that the
Size row shows under Sharps or flats, automatic with "Automatic (2.72)" on
the default staff; that 5 semitones typed by hand is written and the canvas
redraws D major's sharps at 5 ÷ 2.724 of the automatic scale, exactly as the
Node-side renderer draws them; that the export writes `(6 0 sharp 1.1882)`;
that Automatic again writes `null` and restores the canvas; and that the
Place hint no longer names the half steps: **pass, 84/84 checks**.
`uat-app-layout.mjs`: **pass, 79/79 checks**.

**The screenshots, judged.** `uat-052-signs-auto-1440.png`,
`uat-052-signs-auto-1280.png`, `uat-052-signs-5-1440.png` and
`uat-052-signs-5-1280.png` (in the UAT's screenshot folder) show D major's
sharps in the middle of the default staff and the panel's Draw, Size and
Place rows, at both widths with no sideways scroll. At the automatic size
each sharp's bars are a notehead's height apart, so F♯ and C♯ sit in
proportion to the noteheads beside them, where session 51's spanned an
octave. At 5 semitones they are visibly larger, as set. The full-page
captures at 1280 px show the app's sticky header partway down the page, an
artifact of the capture, not of the layout.

## Sharps or flats — 2026-11-11 (session 51)

The key signature's second kind, the traditional accidentals (design
`docs/planning/key-signature-designer-design.md` §5).

- **Draw: The key's notes, or Sharps or flats.** A row under Show the key
  signature writes `keys.keySignature.style` (`"notehead-chords"` or
  `"accidentals"`). Under sharps or flats the Notes, Stacks and Looks rows
  hide, their values kept, and Place stays.
- **The signs.** The key's sharps in the order F C G D A E B, or its flats
  in the order B E A D G C F, each in its own column at the pitch it makes
  (F♯'s sign at F♯), in the octave the place gives that note in the scale;
  on every line set each copy starts again from the first column. They are
  LilyPond's own, Emmentaler's sharp and flat, black, with no ledgers and
  no gold stems. C major draws nothing.
- **The optical size, found by the round trip.** LilyPond draws the staff
  with the Emmentaler size whose design size is nearest 20 pt × the staff's
  magnification, emmentaler-26 at the engine's default 7/4. The flat
  differs between sizes (0.92 staff spaces wide in emmentaler-20, 0.9037 in
  emmentaler-26), so the preview draws each sign from the size LilyPond
  uses for `engine.defaultMagnify` (`cnb/src/cnb-accidental-glyphs.js`,
  the eight sizes' outlines and LilyPond's own boxes).
- **The export** writes each sign through the mark table as
  `(semi column sharp)` or `(semi column flat)` (LY export spec 1.3.17); the
  five export baselines are byte-identical. Engine round trips
  (`cnb/tests/cnb-lilypond-tests.js`, `cnb/tests/cnb-key-signature-tests.js`)
  hold every sign's kind, height, box and the signature's ink to 0.001 staff
  spaces, for the default config and Kite 4-369, in the middle, on the bottom
  line set and on every line set, in C, D and B♭ major, at magnifications 1,
  4/5 and 5/2, and the spacing with and without a clef to 0.005.

**Found along the way.** The engine magnifies every staff by
`cnb:default-magnify` as it stands when the engine is included
(`cnb/score-defaults.ly`), before the export sets it, so a plain score
engraves every config at 7/4 whatever its `engine.defaultMagnify`; only a
staff that magnifies itself with `\magnifyStaff #cnb:default-magnify` takes
the config's. This predates the session and holds for every glyph; it is
recorded in LY spec §5.6a and needs a session of its own. The magnification
round trips of session 49 compared in staff spaces, so they passed
regardless; session 51's magnify their staff. And the Place hint ("the tonic
and the half steps alone keep it less busy") still shows under sharps or
flats, where that setting is hidden: wording for session 52.

**What the UAT checks.** `uat-key-signature.mjs` keeps its flow and now
chooses Sharps or flats, checks the rows hide and Place stays, and for C, D
and B♭ major, in the middle, on the bottom line set and on every line set,
that the canvas draws exactly the signs the Node-side renderer gives for the
live config (outline, transform and black fill; none for C, two or four for
D and B♭), with no noteheads, ledgers or gold stems; that the export carries
D major's `(6 0 sharp) (13 1 sharp)` and B♭ major's flats; and that choosing
the key's notes again brings back the rows and the settings as they were:
**pass, 80/80 checks**. `uat-app-layout.mjs`: **pass, 79/79 checks**.

**The screenshots, judged.** `uat-051-accidentals-1440.png` and
`uat-051-accidentals-1280.png` (in the UAT's screenshot folder) show D
major's sharps on every line set and the panel's Draw and Place rows, at
both widths with no sideways scroll. They match the mock-ups' section 9
(`docs/planning/key-signature-mockups/`, "D major · both sets"): F♯ then C♯,
each in its own column, the two columns repeated on each line set, the signs
taller than a staff space and overlapping in height but apart in their
columns.

## The Key signature panel — 2026-11-11 (session 50)

The key-signature designer's panel (design
`docs/planning/key-signature-designer-design.md` §7).

- **The panel speaks a designer's words.** Show the key signature; Notes
  (the whole scale, or the tonic and the half steps; the tonic an octave
  up); Stacks (stacked sevenths, odd semitones left and even right, a new
  stack at each change of odd and even, a zigzag; which way they go, hidden
  where it does not apply; the gold stem, its colour, its thickness in staff
  spaces and whether several stems share it, saying what each gets in the
  picked key); Looks (all marks, flats, sharps and every second stack, each
  a menu with the notehead panel's own shape, fill, colour and size
  controls, and an "as …" that clears a field); Place (the middle of the
  staff, the bottom, top or every line set). A note says when marks in a
  stack run together, and points to the looks' size. The old Marks,
  placement-rule, tonic-octave and bar-extent controls are gone; their
  stored values are kept. The keys a notehead rule can be for sit below,
  under "Keys for notehead rules".
- **Clairnote's signatures.** The Clairnote SN and DN gallery files draw
  dots, slashed through for sharps (/) and flats (\\), a new stack at each
  change of parity going left in sharp keys, no upper tonic, no gold stem,
  on the bottom line set. Engraved at concert size they read; the first
  one-sided tails ran into the next dot and their balancing points printed
  as specks, so the slash replaced them (`docs/sessions/session-050/notes.md`).
- **The preview follows engine 1.4.1**, which landed before the session:
  the signature's heads take the notation's ledgers, so the scale stack is
  spaced by its ink as the mark table is, and each head's ledgers are its own
  width (the sized fixture and the Hass and Trilinear files' signature
  ledgers were drawn too long). A signature on a line set below or above the
  cards is no longer cut off by the row.

**What the UAT checks.** `uat-key-signature.mjs` keeps its enable, define,
key-picking, clef, save, load and export flow, and now drives each choice in
the panel: both notes choices and the upper tonic, the four stacking rules
and the direction (D major mirrored to the left), the overlap note, the gold
stem shared and unshared, at 0.5 staff spaces and in another colour, and off;
all marks' size and a built-in shape, sharps' fill and every second stack's
colour, each set and cleared; and the four places. After each it checks the
canvas draws exactly the marks the Node-side renderer gives for the live
config and the picked key. It loads the Clairnote SN file and checks D
major's dots and slashed sharps, and the export carries the mark table:
**pass, 68/68 checks**. `uat-app-layout.mjs`: **pass, 79/79 checks**.

**The screenshots, judged.** `uat-050-panel-1440.png`,
`uat-050-panel-1280.png`, `uat-050-clairnote-1440.png` and
`uat-050-clairnote-1280.png` (in the UAT's screenshot folder) show the
panel and the canvas at both widths, a look's menu open, with no sideways
scroll. The panel follows the layout of design §7 row for row. The canvas
draws the signatures of the mock-ups
(`docs/planning/key-signature-mockups/`, sections 3, 5 and 6): the new
stack at each change of parity, the stacks going left in a sharp key, the
bottom line set; the Clairnote file's dots, with slashes where section 6 had
one-sided tails.

## Clefs — 2026-11-10 (session 45)

Rough edge 6 of the session-42 try-out (below), as planned.

- **Clefs to choose from.** The Clef panel has four buttons, Dozenal,
  Treble, Bass and Alto. Each adds its clef when the config has none of
  that name, shows it and turns the clef on; one already there keeps its
  placement.
- **The dozenal clef is drawn.** The canvas draws the engine's numeral as
  the engine engraves it under the score's default treble clef, 50: two
  bold digits centred on the middle line, the 5 three staff spaces tall at
  half width, the 0 two thirds as tall. The export writes
  `cnb:clef-style 'dozenal`, so the engine draws its own, from the score's
  clef. The panel says so; the dozenal clef has no size or place to set.
- **Treble, bass and alto** are LilyPond's own glyphs (Emmentaler, SIL
  OFL), each with its line on the pitch it marks, G, F or C, in the octave
  nearest the middle of the staff, at LilyPond's size. On the default 4-8
  staff the alto clef spans the staff exactly, the treble clef's curl sits
  on G just below the G♯ line, and the bass clef's dots straddle F above
  the middle.
- **A clef is shown over a range of semitones.** A glyph clef, imported or
  chosen, has "Shown from semitone … to …" fields. With the Clef section
  open, dragging the clef on the canvas moves it, and dragging the bar on
  its bottom edge makes it taller or shorter. A row grows to hold a clef
  that reaches past its noteheads instead of cutting it off.
- **The engraving matches.** Engine round trips measure the dozenal clef,
  each standard clef as placed, and a treble clef moved and resized,
  engraving over exactly the semitones the preview draws them over
  (`cnb/tests/cnb-lilypond-tests.js`, LY export spec 1.3.13 §5.5a).

**What the UAT checks.** `uat-clef-editor.mjs` keeps its import, enable,
save, load and export flow, now placing the imported clef through its range
fields, then chooses each of the four clefs and checks the canvas draws it
where the Node-side renderer puts it and the downloaded export carries it,
and drags the treble clef 3 semitones up and its bottom edge 2 semitones
down on the canvas, checking the range written, the fields and the export:
**pass, 46/46 checks**. `uat-app-layout.mjs`: **pass, 79/79 checks**. The
full suite runs at the close as the run of record.

**The operator's try-out** (2026-11-11): the clefs look fine as they are.
The breve's tie (session 44) is not right: it should be below the
noteheads, ideally one tie from the centre of the first notehead of the
first group to the centre of the last notehead of the last group. That is
session 46, with engine work.

## Nudges you can see and drag — 2026-11-10 (session 43)

Rough edge 5 of the session-42 try-out (below), as planned.

- **Any notehead can be nudged.** A nudge is now each pitch class's own
  offset, `position − pc` on the stride-12 map the editor writes, so C, the
  middle of the default staff, is nudged like the rest. Nudges are no
  longer measured from a fixed C. A map at another stride (Twinline's 7) is
  still read from C, which is only how it is brought into nudge form.
- **The sliders are gone.** Each pitch class keeps its name, its "shares"
  mark and its number field, in a light grey frame, so each field reads as
  its own notehead's. The notehead panel's nudge is the same control.
- **Drag on the canvas.** With the Pitch section open, a notehead dragged
  up or down follows the pointer, and the release nudges it by the distance
  dragged, stopped at its neighbours (`CNBPitchModel.dragNudge`). A press
  that does not move still selects; a drag does not.

`uat-pitch.mjs` checks that C's field is enabled and there are no sliders,
that nudging C alone by +0.5 moves C's notehead half a semitone against D,
and that dragging G's notehead half a semitone up writes +0.5, moves it,
and leaves the Pitch section open: **pass, 30/30 checks**.
`uat-app-layout.mjs`: **pass, 79/79 checks**. The full suite runs at the
close as the run of record.

## Trying sessions 36–41 — 2026-11-10 (session 42)

The operator tried what sessions 36–41 added, in the app served locally
(`python -m http.server 8000`). They did not test the rest of the
Configurator this time.

**Works as intended.** Repeat mode beside the duration buttons (session 36),
colours chosen on the noteheads and the suggested colour sets (37),
selecting several noteheads (38), and the start on Notehead height (39).

**Rough edges**, each marked *fix here* or *planned*. The operator asked
that all the planned ones come before the 1.1.0 release.

1. **Two more suggested colour sets** (*fix here*): a three-colour set,
   black `#000000`, rose `#CC79A7`, sky blue `#56B3E9`; and a four-colour
   set, black `#000000`, deep pink `#E23084`, shamrock `#2B9E7B`, sky blue
   `#56B3E9`.
2. **Give this look to goes** (*fix here*): with several noteheads
   selected on the canvas, its toggles and buttons seem to contradict the
   selection. The operator chose to remove it, so a look is given to many
   noteheads by selecting them.
3. **Kite's default width** (*fix here*): a Kite notehead 4 semitones tall
   showed a width of 5.0639 instead of 4.00, which is 4 at the default
   notehead's proportions (344.852 ÷ 272.4). A width is kept from the shape
   the notehead had before, instead of following the new shape's.
4. **The breve as tied semibreves** (*planned*, session 44): in repeat mode the semibreve
   and the breve both show 4 heads, the engine's fixed counts. Doubling to
   8 for the breve strings too many heads together. The operator prefers a
   breve written as one or more tied semibreves, which needs engine work.
   No other plan for the breve existed.
5. **Nudges** (*planned*, session 43): the notehead in the middle of the staff cannot
   be nudged (C is the fixed reference). The sliders take so much room that
   each number field sits nearer the next pitch class than its own;
   dragging the notehead up and down could replace them, and a light grey
   border or background would show which field belongs to which pitch
   class.
6. **The clef** (*planned*, session 45): the engine's dozenal clef should be a choice,
   drawn in the preview, and an imported clef symbol should be resizable
   and placed vertically, with the semitone range over which it is shown.
7. **Key signatures** (*planned*, the designer: its design in session 47, then the sessions it plans): fewer
   options, so a designer does not have to define every key in every mode.
   The operator's outline:
   - **A. Accidentals**: traditional accidentals, which may help pianists.
   - **B. Scale notes**, with:
     1. the shape, colour and size of the signature's noteheads, for
        naturals, flats and sharps across all pitches;
     2. the upper tonic (the octave) shown or hidden;
     3. only the tonic and the notes a half step apart;
     4. the vertical stacking: two stacks of odd and even notes, optionally
        with the gold stem between them; or two or three stacks, a new one
        to the right at each half step, optionally alternating fill, colour
        or shape (enough for [Clairnote's signatures](https://clairnote.org/key-signatures/));
     5. how the signature repeats across the staff's line groups: not
        repeated, placed so most noteheads fall on the bottom group, on the
        top group, or near the notes on the staff; or repeated across every
        visible group, the root as a double notehead.

**Found while updating the README** (*fixed here*): a Shift+click on the
canvas also selected the column labels' text, which showed as blue
highlights; the columns now take no text selection. And `npx serve .`, one
of the two ways the README and the page's `file://` notice give to serve
the app, rewrites `/cnb/index.html` to `/cnb`, where the page cannot find
its modules; both now say to open `/cnb/`, with the trailing slash, which
loads under either server.

**What the UAT checks.** `uat-notehead-panel.mjs` builds the Kite 4-369
looks by selecting noteheads together (Shift+click) instead of through Give
this look to, checks that Give this look to is gone, and still exports the
Kite baseline byte for byte (19 of 19 checks). `uat-site.mjs` checks that
the `file://` notice says to open `/cnb/` (10 of 10). `npm run uat` passes
18 of 18 drivers (2026-11-10).

**The declaration moves.** The operator did not declare the UI stable in
this session. Having listed the rough edges above, they wrote: "I think
that there is enough work above to occupy a few sessions -- possibly
requiring some work in the engine, as well", and chose that all of it come
before the release (2026-11-10). So the operator will declare the UI stable
in the session before the 1.1.0 release, once sessions 43 (nudges),
44 (the breve), 45 (clefs), 46 (the breve's tie) and 47 and on (the key-signature designer) are
done; that session and the release are numbered when session 47 has planned
the designer.

## Undo and redo — 2026-11-09 (session 41)

A wrong change could only be put right by hand. Session 41 adds **Undo**
and **Redo** to the top bar, with Ctrl+Z and Ctrl+Shift+Z (Ctrl+Y redoes
too; Cmd on a Mac), back through the last 100 changes to the config. Every
change is a step: an edit in any section, the notehead panel, the canvas, an
imported shape, and opening a config. A value typed a key at a time, or a
colour dragged, is one step. Save adds none. What is not the config (the
section shown, the selection, the canvas Size, duration and key) is not
undone, and the history does not survive a reload.

**What the UAT checks.** The new driver, `uat-undo.mjs`, on the default
config: the buttons start disabled; a staff pattern, a dragged colour and a
typed name are three steps, which Ctrl+Z undoes one at a time back to the
starting config and Ctrl+Shift+Z, Redo and Ctrl+Y redo, each state compared
through View file (JSON); a change after an undo leaves nothing to redo;
opening Twinline is one step that Undo reverts and Redo repeats; and after a
change and a Save, one undo is back at the start. 22 of 22 checks pass, and
`npm run uat` passes 18 of 18 drivers.

## The workflow in the order a notation is designed — 2026-11-09 (session 39)

In the session-38 rebuild the operator judged a notehead's height against
the staff before setting either, and asked for the sections in the order a
designer settles them. Session 39:

- The page still starts from the conventional notehead on the 4-8 staff,
  and now opens on a new first section, **Notehead height**: one field
  sets every notehead's height in semitones, each keeping its shape's
  proportions, and **The shape's own height** puts them back. The height
  is written through the look table, so the Default rule carries it (the
  inference now puts a size every notehead shares on the Default, as it
  does the most common colour).
- The section list reads Notehead height, Staff, Pitch, Ledger lines,
  Noteheads, Key signature, Clef, then Advanced and Export. Every section
  stays reachable at any time.

**What the UAT checks.** `uat-app-layout.mjs`, at 1440 and 1280 px: the
page opens on the Notehead height panel alone; the section list is in that
order; a height of 4 semitones is on the Default rule with the width at the
shape's ratio and no other size rule; every one of the 26 canvas noteheads
is drawn 4 semitones tall (its box 44 px at Medium); The shape's own height
writes no size; and each section still shows its own panel. `npm run uat`
passes 17 of 17 drivers.

## Selecting several noteheads — 2026-11-09 (session 38)

Session 35 found that the operator gave each notehead its look in turn,
not knowing the canvas selects several. Session 38 made it say so:

- The canvas toolbar reads "Click a notehead to give it a look; Shift+click
  or Ctrl+click to select several" (outside pitch mode), and the Noteheads
  section's subtitle says the same. Ctrl+click (Cmd+click on a Mac) selects
  as Shift+click does.
- Under the notehead panel's head, a hint says how to add noteheads, and
  with several selected how to drop one, and that Esc or Close clears the
  selection. The Close button's tooltip says it clears the selection.
- Give this look to says it copies the ticked parts of the selected
  notehead's look to the noteheads chosen below, and each of its buttons
  names in its tooltip the noteheads it would change ("C, E and G♯").

**The operator's trial.** The operator rebuilt Kite 4-369 from a fresh page
with the multi-selection and Give this look to, and **found both from the
new hints, unaided** (operator, 2026-11-09: "Yes, found unaided"). The
notehead configuration "seems OK".

### Found along the way

| Found | What happens | Planned |
|---|---|---|
| The page loads unstyled under `npx serve` | The README suggests `npx serve .` and `/cnb/index.html`. `serve` redirects that address to `/cnb` with no trailing slash, so every script and stylesheet is looked for one folder too high and fails to load: the operator saw a page of plain buttons. `http://localhost:3000/cnb/` (trailing slash) works. | 42 (README) |
| The notehead's height is judged before the staff is set | The operator read the Kite notehead as 3 semitones tall on the default 4-8 staff. It is drawn at its 4 semitones (the staff's lines, 4 semitones apart, are as tall), but the kite's wide edge is 3 semitones from its long point. The operator's remedy is the workflow below, which starts from the notehead height. | 39 |
| The workflow's order | The operator asked for the sections in the order a notation is designed: a conventional notehead on the 4-8 staff, the general notehead height, the staff, the ledger lines, the selected noteheads' shape, colour, fill and size, the key signature, and the clef. | 39 |
| Stems sit half a stem off centre | Since session 33 a stem's edge sits on its anchor, as LilyPond's does, so the Kite stems, drawn centred in the SVG, preview and engrave off centre. The operator's choice, the one session 33 left open: a stem goes where the SVG's stem rect puts it (centred for Kite and 45deg), and the default notehead's stems take the conventional positions, up on the right and down on the left. | 40 |

The operator chose to plan both before the release (operator, 2026-11-09:
"Both before 1.1.0"): sessions 39 and 40 are inserted, undo moves to 41,
"The UI is stable" to 42 and the release to 43.

### Drivers changed

- `uat-notehead-panel.mjs` checks the toolbar's hint, the panel's hints for
  one and for several noteheads, Ctrl-click adding and dropping a notehead,
  Give this look to's line and the Every 4th tooltip, and Esc clearing the
  selection. Run by hand: 19 of 19 checks passed, and `uat-app-layout.mjs`
  71 of 71 with the longer toolbar hint. The suite runs whole at close.

## Rough edges from the rebuilds — 2026-11-08 (session 36)

Five of the rough edges session 35 found (below), the ones planned for
session 36, are fixed:

| Rough edge | Fixed |
|---|---|
| Save and Export have no save location | Both open the browser's save dialog where it has one (`showSaveFilePicker`, Chrome and Edge), suggesting the file names they used before, and download where it has none (Firefox). The top bar names the file as saved, or says the save was cancelled (`cnb/ui/save-file.js`). |
| Repeat mode is hard to find | The choice sits beside the duration buttons on the canvas: "Its own shape for each duration" or "Repeat the notehead", with the counts (minim ×2, semibreve and breve ×4). It left Advanced → Durations and engine, with its developer help. |
| Dragging in a colour field lags and stores every value | Every colour field (notehead panel, its colour-blind twin, palette, rules, key-signature bar) applies its colour once, when the picker closes. While dragging, only the field changes, and in the notehead panel the close-up notehead. Save keeps a Scheme name only for colours the config uses (`CNBPaletteEditor.usedSchemeSymbols`), so the files saved from now on lose names like `#500000`. |
| The unused default shape warns | The "no LilyPond path" warning names only shapes some notehead uses, for any pitch class, duration and (keys on) key. |
| The canvas shows no key signature by default | The canvas toolbar has a key and mode picker (C major first). The picked key's signature draws whether or not a key with those notes is defined; when one is, it lends its name, so rules for it draw as engraved (LY spec §6.4). "Show the key signature" turns keys and the scale stack on. With keys on and none defined, the toolbar says "No keys are defined yet, so no notehead rule can be for a particular key." The warning that a signature has no defined key went with it. |

Save does not cut the names of unused colours as each colour is applied,
only when the file is saved: a config opened with names of its own would
otherwise lose the name of a colour about to be given again, and its export
would change (the notehead-panel driver's Kite rebuild caught this).

### Drivers changed

- `app-page.mjs` gains `useDownloads(page)`, which removes the save dialog
  before the page loads. Chromium has the dialog and a headless run cannot
  answer it, so the drivers that capture Save and Export downloads call it
  (clef editor, golden path, key signature, Kite pipeline, notehead panel,
  pitch). The golden path then installs a stand-in dialog and checks that
  Save and Export ask it for the usual names and file types, write the
  same bytes, report the chosen names, and write nothing when cancelled;
  and that Save drops an unused colour name from a config opened with one.
- The golden path and Kite pipeline choose repeat mode on the canvas. The
  durations-and-engine, config-export and config-io test pages gain their
  own mode toggle, which their drivers use.
- The notehead panel driver checks that a drag only tints the close-up; the
  imported-notehead, Kite pipeline and rule editor drivers close the picker
  (`change`) to apply a colour.
- The key signature, app layout and golden path drivers use the key and
  mode picker. The app layout turns the signature on with the canvas
  button; the key signature driver also draws F♯ major, which no key
  defines.

### Full UAT

- playwright-core 1.64.1; Chromium `chromium-1248`, Firefox, Edge
- Windows 11, Node 25.8.1
- Run by hand this session, after each step's changes: the drivers each
  step touched, and `node cnb/uat/run-uat.mjs` after steps 4 and 5:
  **17 of 17 drivers passed**. The suite runs whole again at close.
- Judged by eye from the app-layout screenshots: the repeat choice sits
  after the duration buttons on the toolbar's first line at 1280 and 1440;
  the key picker starts the second line, beside Size; with the signature
  turned on from the canvas, Kite 4-369 draws C major's scale stack on the
  canvas and in the Key signature panel.

## Two rebuilds by hand — 2026-11-08 (session 35)

The operator rebuilt Kite 4-369 and 45deg-369 from scratch in the app, from
the default page, with the checked-in notehead SVGs
(`cnb/fixtures/kite-down.svg`, `kite-up.svg`, `45deg.svg`). The two
rebuilt configs were exported headlessly
(`node cnb/fixtures/export-config.mjs`) and diffed against the exports of
`cnb/fixtures/kite-4-369-config.json` and `45deg-369-config.json`. The
shapes, the 3-6-9 staff, the hollows and the colours of every pitch class
engrave the same. The other differences are the operator's choices: the
name, label and footnote (left at the default's), Kite with no ledger
lines (C is the only notehead that floats with 4-semitone heads on 3-6-9,
so none are needed), 45deg's own sky blue and no key signature, Kite's
false-hollow engine flag off, and both in shape mode rather than repeat
mode.

The colour pickers were checked by hand, the check session 21 left owed.
Typing a full hex value works; dragging in the field lags (below). The
key-signature bar's picker was not tried.

### Rough edges found

None is fixed in this session: the operator chose to plan them as sessions
36–39, before the release (now session 41). The one fix made here is the
Staff and Ledger lines subtitles, which still promised "how they look"
after session 34 removed the look settings.

| Found | What happens | Planned |
|---|---|---|
| Save and Export .ly have no save location | Both are plain browser downloads, named from the config's name, into the downloads folder. The operator renamed the files by hand. | 36 |
| Repeat mode is hard to find | The operator expected the minim, semibreve and breve to show repeated heads, as the fixtures do. A new config is in "Distinct shapes per duration", and the choice is only under Advanced → Durations and engine, with help written for developers ("Section C emits (repeat . #f)"). | 36 |
| Dragging in a colour field lags and stores every value | Each value of a drag is applied, so the canvas redraws throughout and the marker lags well behind the cursor. Each value also adds a colour name to `palette.schemeSymbols`: the two rebuilt files carry about 17 unused ones (`#500000`, `#50b402`, `#cc7901`, …). None is exported. | 36 |
| The unused default shape warns | The built-in Crotchet–Minim shape stays in the config after the designer's own shapes replace it, and validation warns that it has no LilyPond path, though nothing uses it and it is not exported. | 36 |
| The canvas shows no key signature by default | A signature is drawn only for a key selected on the staff. The operator wants it drawn as the key and mode are chosen, and the default (the scale stack) a click away. | 36 |
| Palettes are more than a designer needs | Colours picked on noteheads leave the palette named "None", so the export header reads `Color palette: None` above the colours it registers, and the empty colour-blind palette raises a warning. The operator's decision: a designer chooses colours directly, palettes become suggestions, and a colour-blind variant is a second config made with Save As. | 37 |
| One notehead at a time | The operator gave each notehead its look in turn. The app can already change several at once, but does not say so (below). | 38 |
| No undo | A wrong change can only be put right by hand. | 39 |

Larger ideas from the same review go to the 1.2.0 program after the
release (session plan): a key-signature designer that works like the
notehead designer, designed first with a cross-provider consult; published
schemas for each component of a config, so a designer can have an AI write
part of one and import it; and clefs to pick from, the dozenal clef drawn
in the preview among them.

Two more, found while capturing the README picture
([`images/configurator.png`](images/configurator.png), Kite 4-369 with D
selected):

- **Several noteheads can already be changed at once, but nothing says
  so.** Shift+click on the staff adds a notehead to the selection, and the
  notehead panel then changes them together; its "Give this look to"
  buttons (All, Every other, Every 3rd, 4th and 6th, The accidentals, The
  naturals) copy a look to many. The operator did not find either. Session
  38 is therefore about making them discoverable, not building them.
- **The canvas toolbar speaks to a developer** when keys are on with none
  defined (the 45deg-369 fixture): "Keys are enabled but
  config.keys.definitions is empty — nothing to select yet." Planned for
  session 36, with the key and mode picker.

### Full UAT

- playwright-core 1.64.1; Chromium `chromium-1248`, Firefox, Edge
- Windows 11, Node 25.8.1
- `node cnb/uat/run-uat.mjs`: **17 of 17 drivers passed**, 446 checks and
  no failures, and the gallery driver captured 18 of 18 previews.

### Not declared stable

The operator did not declare the UI stable in this session: they chose to
plan the rough edges above as sessions 36–39 before the release (operator,
2026-11-08: "I think that we should create additional sessions to cover
these things"; "split it that way; clefs can wait for 1.2.0"). The
operator is to declare the UI stable in session 40, "The UI is stable",
and the release moves to session 41.

## Two more staves to start from — 2026-11-07 (session 32)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- Run by hand this session: app layout **71/71** (three new checks, below).
  The whole suite runs at close.

At 1440, `uat-app-layout.mjs` now opens the default config through Open
and switches Ledger lines to Automatic. It then chooses the new 2–4–6–8–10
and 3–5–7–9 presets in turn. For each one it checks that the config gets
the preset's pattern, midpoint 12, spacing 2 and the Automatic ledger
positions (C for 2–4–6–8–10; C♯ and B for 3–5–7–9), and saves the page.
Finally it chooses 4–8 again and checks that the default staff comes back.

### Judged against mock-up 1 (design §10)

| Screenshot | Judgement |
|---|---|
| [Staff, 2–4–6–8–10](uat-shots/session-032/panel-staff-2-4-6-8-10.png) | As mock-up 1's panel, with five pattern cards in place of three. The cards keep the mock-up's three-column grid and wrap onto a second row, with 3–5–7–9 and Custom on it. The chosen card is drawn in the accent colour, and its title and line read as the plan gives them. The D, E, F♯, G♯ and A♯ pills are on, and the panel reads "Staff spacing: 2 semitones per staff space" and "Middle of the staff: C, semitone 12". On the canvas, five lines an octave leave one gap, at C. Both C noteheads, and the upper C′, sit on a ledger line in that gap, and no other column has a ledger. |
| [Staff, 3–5–7–9](uat-shots/session-032/panel-staff-3-5-7-9.png) | The same panel, with 3–5–7–9 chosen, the D♯, F, G and A pills on, and the same spacing and middle. Four lines an octave leave a wider gap with C in a space. C♯ and B each sit on their own ledger. **For the operator's judgment: C has a ledger above it and none below.** Both C noteheads (semitones 0 and 12) hang under the C♯ ledger, and C′ (24) has the C♯ ledger above it too. The B ledger below C is never drawn for C, because ledger resolution is octave-aware and B (11) belongs to the octave below C (12). `cnb-ledger-set-tests.js` pins this. If it is judged wrong, the fix is planned for a later session, not made in this one. |

The export side of the same staves is pinned in `cnb-lilypond-tests.js`.
2–4–6–8–10 exports `'(-10 -8 -6 -4 -2 2 4 6 8 10)` and 3–5–7–9 exports
`'(-9 -7 -5 -3 3 5 7 9)`. An engine engraving of 3–5–7–9, the first
fixture with lines on odd staff positions, puts its lines at exactly those
positions, which are the ones the preview draws.

## The checks speak to a designer — 2026-11-07 (session 31)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- Run by hand this session: app layout **68/68** (three new checks, below).
  The whole suite runs at close.

`uat-app-layout.mjs` now opens, at 1440, a copy of Kite 4-369 with keys on,
a G definition and the rule "In G, F♯ is hollow" scoped to G. It checks that
the indicator reads "1 warning", that the checks list says it in the
designer wording of design §8.5 with a **Show the rule** link
(`cnb/ui/checks-wording.js`), and, after the shot, that following the link
closes the list and shows Advanced with its rules disclosure open and that
rule's name focused.

### Judged against mock-up 4 (design §10)

| Screenshot | Judgement |
|---|---|
| [Checks list, one warning](uat-shots/session-031/checks-list-1440.png) | Matches mock-up 4's popover: the "Checks" title, the amber "!" mark, the designer sentence, the **Show the rule** link in the accent colour under it, and the muted "Export is not blocked: warnings never stop it." footer, under the amber "1 warning" pill. Two differences. The sentence ends "so the exported F♯ keeps its look without it" where the mock-up says "stays solid": the wording names the rule's noteheads but does not work out what the rule changes, which keeps it true for every rule. The page behind is the Staff section at Medium (two rows), where the mock-up shows Advanced at Small; that is the driver's state, not the list's. |

## The Clef and Key signature previews at work — 2026-11-07 (session 30)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- Run by hand this session: app layout **65/65** (two new checks, below),
  clef 28/28 and key signature 39/39 (their export checks now look for the
  clef and key-signature settings the download carries, LY export spec
  1.3.7). The whole suite runs at close.

Session 26's panel shots used Kite 4-369, which has neither a clef nor a
key signature, so its Clef and Key signature panels drew three bare
columns. `uat-app-layout.mjs` now opens Kite again at 1440, imports a glyph
clef and turns it on, then turns keys on, adds C major, turns the
signature on and chooses C in the canvas's Key menu. Before each shot it
checks that the panel's partial staff draws its gutter: the clef glyph in
a `.clef-col`, the signature and its bar in a `.keysig-col`. Design §10 has
no mock-up for these two sections, so these shots stand in for one.

| Screenshot | Judgement |
|---|---|
| [Clef, glyph on](uat-shots/session-030/panel-clef-glyph.png) | The imported double-arrow glyph draws in a gutter before C, in the panel's partial staff and on both canvas rows, its top at semitone 15 and 6 semitones tall, as the "Top of the clef" field says. The enable row has no Preview only badge now that the clef exports. The first shot showed the importer's note that a glyph without pre-baked data "will need a fallback conversion if the engine gains clef support", which this session made false. It now says the LilyPond export converts the glyph's SVG path instead (`cnb/ui/svg-importer.js`). |
| [Key signature, C chosen](uat-shots/session-030/panel-key-signature-key.png) | With C chosen on the canvas, the signature draws after the clef on both canvas rows, and on its own in the panel's partial staff: the two-column note stack with the gold bar beneath it. Only "Space either side" keeps a Preview only badge; Placement and Separator bar export. **A defect remains:** the automatic octave puts C's marks on semitones 12–24, but a row's grid only reaches 4 semitones above its highest column (`CNBCollection.gridRange`). The top marks are therefore cut off in the partial staff (C to D, up to semitone 18) and on the first canvas row (C to F♯, up to 22). The second row (G to C′) shows them whole. This is preview layout, not export, so it is left for a later session. |

The full-page captures also show the sticky top bar part way down the page,
as earlier shots do. The canvas's key menu note ("Key rows are deferred in
the card collection (plan §5 Module 10)…") is developer wording.

## Oswald from the site — 2026-11-07 (session 29)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- `npm run uat`: **17 of 17 drivers pass**, among them app layout 63/63
  (two new checks: with every duration deselected the Clef and Key
  signature panels show no partial staff, and reselecting draws them
  again) and site 10/10 (two new checks, below).

The page used to fetch Oswald from Google Fonts at run time, and every
driver stubbed that request with an empty response, so the labels were
drawn in a fallback face and the request was never checked (session 15
review). Oswald is now served from the site: `cnb/assets/fonts/` holds the
variable font from google/fonts (`ofl/oswald`), its SIL Open Font Licence
(`OFL.txt`) and `oswald.css`, which `cnb/index.html` and the test pages
link. The Google links and every driver's font stub are gone.
`uat-site.mjs` records every request the assembled site makes and fails on
any outside its own origin, and checks that Oswald loads from the site and
that the column labels use it.

The screenshots in [`uat-shots/session-029/`](uat-shots/session-029/)
(`app-default-1440.png`, `app-default-1280.png`) draw the column labels in
Oswald's condensed face, as the mock-ups do; the session 28 shots show the
fallback face.

## Pitch — 2026-11-07 (session 28)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- `npm run uat`: **17 of 17 drivers pass**: app layout 59/59, clef 28/28,
  common properties 24/24, config export 22/22, config IO 19/19, gallery
  previews, golden path 30/30, hostile input 57/57 (Chromium, Firefox and
  Edge), imported notehead 13/13, key signature 39/39, Kite pipeline 26/26,
  notehead panel 13/13, notehead rule editor 34/34, pitch axis, pitch 26/26
  (new), site 8/8, staff rule editor 29/29.
- `cnb/uat/uat-app-layout.mjs` writes the screenshots below; at each width
  it opens Twinline (`twinline-compact.json`) in the Pitch section, as
  mock-up 3 does.

Session 28 added the label strip in each row's first column, the Pitch
section (middle of the staff, staff spacing, nudges), renaming and the
nudge in the notehead panel, and the custom-map fallback (design §3, §4).
The new driver, `uat-pitch.mjs`, rebuilds Twinline from the default config
through the UI. In Staff it sets lines on C♯, D, G, A♯ and B. In Ledger
lines it chooses Automatic. In Pitch it sets the middle of the staff to G,
which renames the lines D, F, F♯, G♯ and A, then the staff spacing
3.4286 and the §3.3 nudges. Every semitone from 0 to 23 then engraves at
the fixture's staff position, and the exported staff-line positions match
the fixture's, within 0.01 half-space. The five shared pairs sit level on
the canvas. The Automatic ledger spots follow the nudged lines to C and
A♯, and the columns that draw ledger lines are the fixture's (C, C♯, A♯,
B and C′). The driver also checks four more things. Dragging the label
strip one semitone down makes the middle G♯, and dragging it back makes it
G. Renaming C to F♯ from the notehead panel on the default config keeps the
exported staff `'(-4 -2 2 4)` (design §11). The fixture opens with its
nudges shown and is not rewritten. A map that needs more than ±1 shows the
custom-map note, whose button opens Advanced › Pitch axis map.

The layout driver gained, at both widths: Twinline in the Pitch section is
in pitch mode with a label strip and a middle line on every row, nothing
scrolls sideways, and leaving the section turns pitch mode off.
`uat-key-signature.mjs` now expects the label strip first in the canvas
row, before the clef and key signature.

### Judged against mock-up 3 (design §10)

| Screenshot | Judgement |
|---|---|
| [Pitch, 1440](uat-shots/session-028/app-pitch-1440.png), [1280](uat-shots/session-028/app-pitch-1280.png) | As mock-up 3: Twinline with the label strip in drag mode on each row (one row at 1440, two at 1280), even pitch classes on the left and odd on the right, shared spots side by side, and the blue middle line at G. The Pitch panel sits under the canvas: Middle of the staff (G) and Staff spacing (3.4286, "An octave takes 3.5 staff spaces") side by side, then the twelve nudges in two rows of six, each with its value, "shares" on the ten shared notes, and its reach shaded on the bar. C is fixed at 0. The toolbar carries the drag hint. Nothing scrolls sideways. |
| [Default, 1440](uat-shots/session-028/app-default-1440.png), [1280](uat-shots/session-028/app-default-1280.png) | As session 27, with the quiet label strip (grey labels on the inset surface, a hairline on its right) before the staff: one row at 1440, two at 1280. |

Found and fixed in the judgement. The first and last labels of a strip were
cut in half at the strip's edges: the strip now lets them show in its
label-height margins. The browser's own slider track hid the shaded reach:
the nudge bars now draw their own grey track with the reach on it.

Left as it is: the fixture opens at stride 7, where a pitch class's spot
is one axis unit (11 px at Medium), so the strip's labels sit closer than
in the mock-up, which drew the nudge form (stride 12, 18.9 px per spot).
They stay legible, and Large spaces them out. Changing any nudge or the
spacing rewrites the map in the nudge form (§3.5).

## The notehead panel — 2026-11-07 (session 27)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- `npm run uat`: **16 of 16 drivers pass**: app layout 53/53, clef 28/28,
  common properties 24/24, config export 22/22, config IO 19/19, gallery
  previews, golden path 30/30, hostile input 57/57 (Chromium, Firefox and
  Edge), imported notehead 13/13, key signature 39/39, Kite pipeline 26/26,
  notehead panel 13/13 (new), notehead rule editor 34/34, pitch axis, site
  8/8, staff rule editor 29/29.
- `cnb/uat/uat-app-layout.mjs` writes the screenshots below; at each width
  it opens Kite 4-369, selects C♯ in the Noteheads section and hovers the
  Shape rule, as mock-up 2 does.

Session 27 added the notehead panel (design §2), the rule list (§5.4) and
click selection on the canvas. The new driver, `uat-notehead-panel.mjs`,
opens Kite 4-369 with its looks taken away (the rules reduced to the
Default and the palette colours cleared) and gives them back by clicking:
kite up to C♯ and Every 4th, then D, F♯ and A♯ by Shift-click; Hollow to
C♯ and Every other; and sky-blue, rose and black to C, C♯ and D through
the colour input, each given to Every 3rd. The `.ly` it exports equals
`cnb/fixtures/kite-4-369-export-baseline.ly` byte for byte (date line
aside). It also checks the selection outline, that the colour input's
element survives an `input` event, and the rule list's words and hover
tint. The layout driver gained, at both widths: the panel docks under the
canvas at its width with the rule list under it, C♯ is outlined and the
hovered rule tints its six columns, no sideways scroll, and Esc closes the
panel.

The drivers that imported shapes or used the rule and palette editors in
the Noteheads section now import through the panel's Import from SVG and
find the two editors in Advanced (`selectNotehead` in `app-page.mjs`).
`uat-site.mjs` no longer counts the notehead panel's host, which is empty
until a notehead is selected, as an editor that failed to mount.

### Judged against mock-up 2 (design §10)

| Screenshot | Judgement |
|---|---|
| [Notehead selected, 1440](uat-shots/session-027/app-notehead-1440.png), [1280](uat-shots/session-027/app-notehead-1280.png) | As mock-up 2: Kite at Medium in two rows at both widths, C♯ outlined full height, the hovered Shape rule tinting C♯, D, F, F♯, A and A♯ across both rows. The panel sits under the canvas at its width, in three columns: C♯ alone at Large; colour, fill, shape and size; Give this look to. The rule list is under the panel. Nothing scrolls sideways. |
| [Default, 1440](uat-shots/session-027/app-default-1440.png), [1280](uat-shots/session-027/app-default-1280.png) | Unchanged from session 26: one row at 1440, two at 1280. |

The first screenshots had three faults, fixed in this session:

- the rule list was hidden while the panel was open; design §2 lists the
  rules under the panel, and mock-up 2 shows them there. The panel now
  takes the section panel's place and the Noteheads section's rules stay
  under it;
- the panel's head had only the pitch class. It now says the look in
  words, as the mock-up does ("C♯ kite up · hollow · rose"), with a
  "Close ✕" button;
- the import area left an empty status line and warning list under the
  drop zone, and the rule lines' words did not line up when a line had no
  swatch or thumbnail.

Different from the mock-up, on purpose or for later:

- **No pitch-class control and no nudge.** Renaming a notehead and the
  nudge slider are session 28's. The panel's right column holds the side
  step, shown only on a notehead that shares a spot, and Give this look
  to.
- **Give this look to has checkboxes** for the parts to copy, where the
  mock-up names them in a sentence. A checkbox says which parts are copied
  before the click.
- **Import from SVG is a drop zone** under the shape thumbnails, not a
  tile beside them, because the importer accepts a dropped file.
- **The rule list's lines are words with marks**, not the mock-up's
  three-column table with counts.
- **The palette editor is kept** in Advanced › Colour palette for now
  (design §9).
- **The colour picker by hand** (drag in the field, type a full hex) is
  owed to session 32, as for the other editors.

## The panels speak to a designer — 2026-11-07 (session 26)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- `npm run uat`: **15 of 15 drivers pass**: app layout 45/45, clef 28/28,
  common properties 24/24, config export 22/22, config IO 19/19, gallery
  previews, golden path 30/30, hostile input 57/57 (Chromium, Firefox and
  Edge), imported notehead 13/13, key signature 39/39, Kite pipeline 26/26,
  notehead rule editor 34/34, pitch axis, site 8/8, staff rule editor 29/29.
- `cnb/uat/uat-app-layout.mjs`, run with
  `CNB_UAT_SHOTS=docs/uat-shots/session-026`, writes the four app
  screenshots and, at 1440 × 900 with Kite 4-369 opened, one screenshot
  of each panel this session reworded.

Session 26 reworded and restyled the Staff, Clef, Key signature and Export
panels, and added the Ledger lines section with its Automatic or My own
rules choice (design §1, §6, §8.4, §8.6). The drivers follow the new
wording: the clef import status ("Imported the clef …"), the Notehead
chords style, and the staff panel's read-only staff spacing and middle of
the staff, which replace the LilyPond staff-line positions. The layout
driver gained these checks, at both widths:

- the Ledger lines section marks the canvas, draws every candidate ledger
  spot faintly, and marks the columns that draw ledger lines (C on, F off);
  leaving the section removes the marks;
- the Clef and Key signature panels each show a partial staff of C, C♯
  and D;
- the staff editor's three mounts stay in step: choosing Automatic writes
  the automatic spot at C, a staff edit in Staff keeps Automatic and the
  spots follow the new pattern, and Advanced › Staff line overrides shows
  one row per line of the new pattern;
- Export › Name and File suffix write `meta`, and the top bar and the
  exported file name follow;
- the Export section names the preview-only settings once.

### Judged against design §8

| Screenshot | Judgement |
|---|---|
| [Staff](uat-shots/session-026/panel-staff.png) | As mock-up 1's panel: three pattern cards with a title and a line each, the Staff lines on pills, the staff spacing and middle of the staff read-only, and the line look with unit suffixes and a Preview only badge beside thickness, style and colour. |
| [Ledger lines](uat-shots/session-026/panel-ledger-lines.png) | The canvas tints C, C♯, D and C′, the columns Kite draws ledger lines for, and the candidate spots at C are faint dashed lines across both rows. Kite opens in My own rules: "At C show a ledger line when one of these is played", with C, C♯ and D on. |
| [Clef](uat-shots/session-026/panel-clef.png) | The partial staff of C, C♯ and D sits above the controls (Kite has no clef, so no gutter). The toggle carries the Preview only badge. |
| [Key signature](uat-shots/session-026/panel-key-signature.png) | Partial staff, then the keys-off note and the controls, greyed until keys are on. The Placement, Separator bar and Space either side titles carry the badges, and the paragraphs are gone. |
| [Export](uat-shots/session-026/panel-export.png) | Name, File suffix, Notation label and Footnote with a line each, then the one preview-only sentence, then Export for LilyPond and the file name. |
| [Default, 1440](uat-shots/session-026/app-default-1440.png), [1280](uat-shots/session-026/app-default-1280.png), [Kite, 1440](uat-shots/session-026/app-kite-1440.png), [1280](uat-shots/session-026/app-kite-1280.png) | Unchanged from session 25 apart from the Staff panel; the rows are as before. |

The first screenshots had three faults, fixed in this session:

- the Clef panel's file input was the browser's own "Choose File" button,
  which §8.3 rules out. It is now styled like the other buttons;
- the Ledger lines panel repeated its card title as a group title. The
  group is now "Which ones show";
- the "when a note is near" checkbox showed under Kite's rules, none of
  which use that mode. It now shows only when a rule does, or while it is
  off, so it can be turned back on.

Still open:

- **The checks list shows today's messages.** Session 25's record gave the
  designer-terms rewording of §8.5 to session 26, but session 26's section
  of the plan does not name it, and its work plan excluded it. No later
  session names it yet.
- **The pitch labels draw in a serif face in these screenshots**, because
  the drivers stub the Google Fonts request, as in session 25.

## The new page: screenshot check — 2026-11-07 (session 25)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- `cnb/uat/uat-app-layout.mjs`, the new screenshot driver: 27 of 27 checks
  pass. Run with `CNB_UAT_SHOTS=docs/uat-shots/session-025` to write the
  four full-page screenshots below.
- The six drivers of `cnb/index.html` that session 25 moved to the new
  page pass: golden path 30/30, clef 28/28, key signature 38/38, Kite
  pipeline 26/26, imported notehead 13/13, hostile input 57/57 (Chromium,
  Firefox and Edge). `uat-site.mjs` passes 8/8 unchanged.

Session 25 replaced the column of eleven panels with the one-screen page of
design §7: a top bar, a section list, the staff canvas and one panel at a
time. The canvas now reflows (§6.1) and draws at the toolbar's Size, which
is kept in the browser's `localStorage`. The driver opens the app at
1440 × 900 and 1280 × 800 in a fresh browser, with the default config and
then with Kite 4-369 opened from the top bar. It checks that:

- the canvas starts at Medium (11 px per semitone);
- the default config is one row at 1440 and two rows, C to F♯ and G to C′,
  at 1280. Kite 4-369 is two rows at both widths. These are the rows the
  design gives for Medium (§6.1, §10);
- the page never scrolls sideways, in any section;
- each section shows its own panel and no other, and marks itself current;
- choosing Small leaves the config unchanged, and Small is still chosen
  after a reload. At Small the default config is one row;
- there are no console or page errors.

The drivers draw the canvas at Small, where the full row is one row, and
compute their expected geometry from the same display copy of the config
that the canvas draws (`cnb/uat/app-page.mjs`).

### Judged against the mock-ups (design §10)

| Screenshot | Rows | Judgement |
|---|---|---|
| [Default, 1440](uat-shots/session-025/app-default-1440.png) | one | Matches mock-up 1's layout: top bar, section list, canvas card with its toolbar, then the Staff panel. The 13 columns share the spare width equally. |
| [Default, 1280](uat-shots/session-025/app-default-1280.png) | two | Matches mock-up 1 at 1280: C to F♯ over G to C′, same column grid, and the second staff ends after C′. The noteheads are the same size as at 1440. |
| [Kite 4-369, 1440](uat-shots/session-025/app-kite-1440.png) | two | As mock-up 2's canvas at Medium. The top bar names the opened file, and the checks show No problems. |
| [Kite 4-369, 1280](uat-shots/session-025/app-kite-1280.png) | two | As above. Nothing is wider than the window. |

The first screenshots had one fault, which was fixed in this session. The
canvas drew the pitch labels at the config's 22 px, with the 14 px margins
of the test pages' label chips, so at 1280 × 800 the two rows filled the
window and pushed the panel below it. The mock-ups use the editor's
compact label style (15 px, `--ink-2`, 6 px margins), which design §6.1 and
§6.2 give to the canvas's display copy. `CNBPreviewDisplay.displayConfig`
now applies it, and the screenshots are full-page to compare with the
full-page mock-ups.

Differences that later sessions own, as planned:

- **No label strip** in a 14th column, and no Pitch or Ledger lines
  sections in the list (sessions 28 and 26).
- **The panels keep their developer wording and layout**, restyled only by
  the shared tokens and controls: "Staff pattern", "LilyPond
  staff-line-positions", and the repeated "Preview-only" paragraphs. The
  wording, the badges and the Staff panel's pattern cards are session 26.
- **The checks list shows today's messages.** For the default config they
  are two warnings ("Shape "crotchet-minim" has no lilypondPath…" and
  "Some pitch classes have no color rule…"). Saying them in designer terms,
  with links to the controls that fix them, is session 26.
- **The pitch labels draw in a serif face in these screenshots**, because
  the drivers stub the Google Fonts request. In the browser, they draw in
  Oswald, as in the mock-ups.

## Notehead size check — 2026-11-06 (session 22)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- A one-off scratch script outside the tree, not a driver: 14 of 14 checks
  pass.
- `cnb/test-pages/test-notehead.html`, the new "Resolved sizes" section,
  checked by eye from a screenshot. All seven noteheads fill their dashed
  boxes: four at the natural aspect ratio (0.25, 1, 2.724 and 4 semitones
  high) and three stretched (1 × 4, 4 × 1.5, 2 × 6).

Session 22 gave each notehead a height and a width (`apply.heightSemis`,
`apply.widthSemis`). The script opens `cnb/index.html`, uses the size row
on the default config's second rule ("Sharps are hollow"), and checks that:

- turning the row on sets the shape's own height (2.724) and natural width
  (3.4485). The "Keep aspect ratio" lock starts on, which disables the width
  field. The hint reads "natural width 3.4485 at height 2.724".
- with the lock on, a height of 1.5 sets the width to 1.899 (1.5 × the
  natural ratio). In the preview the C♯ head shrinks to 24 px tall and keeps
  its aspect ratio, its ledger shrinks in proportion, and C (unsized) does
  not change.
- with the lock off, a width of 3 leaves the height at 1.5. The C♯ head is
  drawn with `scale(sx,sy)` at 48 × 24 px, its ledger is 96 px (2 × the
  width), and its column is 128 px (96 + 2 × 16 padding). In the
  screenshot, stems attach at the edge of the narrower heads.
- the real export download registers `crotchet-minim-h1p5-w3` (path, hollow
  cutout, attachment), and Section C points C♯, D♯, F♯, G♯ and A♯ at it.

The first screenshot showed the size row unstyled in the app: default font
size and no spacing between the fields. `cnb/index.html` now styles the
`.cnb-nre-size*` hooks like the neighbouring controls. The rerun passes 14
of 14 checks and looks right.

What the script does not cover: it does not render the engraving. That
check is the engine-backed test in `cnb/tests/cnb-lilypond-tests.js`, which
finds every pitch class of the sized fixture engraved at its resolved
height and width, within 5%.

## Colour picker check — 2026-11-06 (session 21)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- A one-off scratch script outside the tree, not a driver: 43 of 43 checks
  pass against the fixed code. The same script fails 12 checks against the
  pre-fix code (HEAD before session 21).
- `npm run uat`: 14 of 14 drivers pass. `uat-notehead-rule-editor.mjs` now
  sends `change` after `input` when it sets a rule's custom colour, as a
  closing picker does, because the editor's resolved strip redraws on
  `change`.

On 2026-11-05 the operator found that the colour picker closed on every
change, so a hex value had to be typed one digit at a time. Each colour
input redrew its whole panel on `input`, which destroyed the element that
owned the open picker. Session 21 made `input` update the config and the
preview without a redraw, and `change` (fired when the picker closes) do the
full redraw.

The script opens `cnb/index.html` and covers all five colour inputs in the
four editors: the palette's custom cell, a notehead rule's custom colour,
the key-signature separator, and the staff and ledger line defaults. For
each input it runs two sequences of `input` events. One is a drag (4
values). The other is a typed hex value, one digit at a time (`#100000` to
`#123456`, 6 values). It checks that:

- the same element stays in the DOM through every `input` event. This is
  the check that fails before the fix, on the first event, for all five
  inputs.
- the shared config (`#state-json`) follows every `input` event, and so
  does the preview for the four colours the default config draws: the
  palette cell, the rule colour, the staff lines and the ledger lines. The
  separator is not checked in the preview, because the default preview has
  no key selected and so draws no key signature.
- the palette's nearest-colour names stay unchanged until `change`, and
  catch up on it.
- `change` redraws the panel, and the new element holds the final value.
- the page logs no errors.

What it cannot cover: Playwright dispatches the events directly, so it
never opens the browser's native picker window. That the picker stays open
while you drag or type is inferred from the element surviving. A person
has to watch it happen, so the operator's hands-on check of the four
editors is still owed.

## Last run — 2026-11-06 (session 17)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- `npm run uat`: 14 of 14 drivers pass. The thirteen earlier drivers are
  unchanged.

`uat-imported-notehead.mjs` (new) checks the operator's 2026-11-05 report:
a freshly imported 4-semitone notehead was drawn at about 3 semitones until
an unrelated edit redrew the preview. It imports `cnb/fixtures/45deg.svg`
into `cnb/index.html` on three routes: the Kite config with the file
picker and the Default rule, the default config with the file picker and
the Default rule, and the default config with drag-and-drop and a new rule.
On each route it measures every notehead the preview draws as soon as the
shape is selected, which must be 4 × pxPerSemi (64 px). It then sets the
Default rule's colour to a custom hex and checks that no height changed. It
also checks that no console or page error is logged.

| Driver | Page under test | Result |
|---|---|---|
| `uat-imported-notehead.mjs` | `cnb/index.html` | pass, 13/13 checks |

**Not reproduced, so nothing fixed.** The stale height did not show up on
the driver's three routes. It also did not show up on a same-name re-import
of a 3-semitone version, or on the operator's own sequence replayed in six
orders (import, 3-6-9 staff, keys and key signature, repeat mode, ledger
removal, rule shape). Every case drew the head at 64 px at once, in
Chromium, Edge and Firefox. The operator could not recall anything else
about the session. What the operator saw matches the default config's
crotchet-minim, which is 2.724 semitones tall and stays on screen until a
rule selects the new shape. No source file changed. The driver pins the
behaviour in the browser. A unit test in `cnb/tests/cnb-svg-importer-tests.js`
pins that the imported shape measures 4 semitones through
`CNBNotehead.measure`, which the preview uses to size every head.

## Earlier run — 2026-11-05 (session 15)

- playwright-core 1.64.1; Chromium `chromium-1248`, Firefox and Edge as in
  session 6
- Windows 11, Node 25.8.1
- `npm run uat`: 13 of 13 drivers pass. The twelve earlier drivers are
  unchanged and pass as in session 6.

`uat-site.mjs` (new) checks the site GitHub Pages publishes, in Chromium.
It assembles the site with `cnb/site/assemble-site.mjs` into a temp
directory, serves it over HTTP and loads `/`. The preview renders staff
lines and noteheads, every editor mounts, there is no `file://` notice, and
no page error, console error or failed request is logged. It then opens the
working tree's `cnb/index.html` over `file://` and checks that the notice is
visible, links to `https://configurator.darndestdabbler.org/` and gives the
two local commands.

| Driver | Page under test | Result |
|---|---|---|
| `uat-site.mjs` | the assembled site at `/`, and `cnb/index.html` over `file://` | pass, 8/8 checks |

**Fixed:** a served page logged one console error, a 404 for
`/favicon.ico`, which the browser requests on its own. `cnb/index.html` now
declares an empty inline icon (`<link rel="icon" href="data:,">`), so the
request is never made.

## Earlier run — 2026-11-01 (session 6)

- playwright-core 1.64.1; Chromium `chromium-1248` (156.0.8078.4); Firefox
  `firefox-1555` (157.0), installed by `npx playwright install firefox`;
  Microsoft Edge 155.0.4283.62 (system install, channel `msedge`)
- Windows 11, Node 25.8.1
- `npm run uat`: 12 of 12 drivers pass. The eleven drivers below are
  unchanged and pass as in session 5.

`uat-hostile-input.mjs` feeds `cnb/index.html` a toolkit SVG, a non-toolkit
SVG, an SVG without `data-lilypond-*`, a file that is not XML, an
older-version JSON save, a truncated JSON file, a legacy-monolith save, a
JSON file the app cannot display, and an export of an invalid config. It
checks for a visible message each time, that the previous state survives
every refusal, and that no console or page error is logged.

| Browser | Version | Result |
|---|---|---|
| Chromium | 156.0.8078.4 | pass, 18/18 checks |
| Firefox | 157.0 | pass, 18/18 checks |
| Edge | 155.0.4283.62 | pass, 18/18 checks |

**Fixed:** Firefox logs an "XML Parsing Error" to the console as an error
whenever `DOMParser` is handed text that is not XML (Chromium and Edge do
not). The importer now refuses text with no `<svg` element before parsing
it, so a non-SVG file gets its message without a console error. Nothing
else broke in Firefox or Edge.

## Earlier run — 2026-10-31 (session 5)

- playwright-core 1.64.1 (from the repository's `node_modules`, via
  `npm install`)
- Chromium: ms-playwright cache revision `chromium-1248`, installed by
  `npx playwright install chromium`
- Windows 11, Node 25.8.1

There are eleven drivers, not the ten session 5's plan counts:
`uat-gallery-previews.mjs` is a capture tool (it screenshots each gallery
fixture's preview for side-by-side human review) and runs with the others.

| Driver | Page under test | Result | Fixed |
|---|---|---|---|
| `uat-clef-editor.mjs` | `cnb/index.html` | pass, 28/28 checks | — |
| `uat-common-props-editor.mjs` | `cnb/test-pages/test-common-props-editor.html` | pass, 24/24 checks | — |
| `uat-config-export.mjs` | `cnb/test-pages/test-config-export.html` | pass, 22/22 checks | — |
| `uat-config-io.mjs` | `cnb/test-pages/test-config-io.html` | pass, 19/19 checks | — |
| `uat-gallery-previews.mjs` | gallery fixtures rendered by `CNBCollection` | pass, 18/18 previews captured | — |
| `uat-golden-path.mjs` | `cnb/index.html` | pass, 30/30 checks | — |
| `uat-key-signature.mjs` | `cnb/index.html` | pass, 38/38 checks | — |
| `uat-kite-pipeline.mjs` | `cnb/index.html` | pass, 26/26 checks | — |
| `uat-notehead-rule-editor.mjs` | `cnb/test-pages/test-notehead-rule-editor.html` | pass, 34/34 checks | — |
| `uat-pitch-axis.mjs` | `cnb/test-pages/test-pitch-axis.html` | pass, 27/27 checks | — |
| `uat-staff-rule-editor.mjs` | `cnb/test-pages/test-staff-rule-editor.html` | pass, 29/29 checks | — |

**Drift since July: none.** Once playwright-core and a Chromium were
installable from the repository, every driver passed unchanged against the
current app. What had kept them from running was only the missing install:
nothing in the repository declared playwright-core, and the drivers' error
messages pointed at a scratch directory. Session 5 changed only those
messages, which now point at `npm install` at the repository root.
