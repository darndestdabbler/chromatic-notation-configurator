# The key-signature designer — design

**Session:** 47 (2026-11-11). A design only: no code changes with it.
**Source:** the operator's outline in [`docs/uat-status.md`](../uat-status.md),
"Trying sessions 36–41" item 7 (session 42), and the session plan's
session 47.
**Status:** revised from two consult rounds
([`key-signature-designer-consult.md`](key-signature-designer-consult.md))
and the operator's review of the mock-ups
([`key-signature-mockups/`](key-signature-mockups/index.html)), §12 below;
**approved by the operator on 2026-11-11** (Approval, at the end).
**Amended in session 53** (2026-11-11): the key-signature editor, one model
for every signature in place of the two styles (§13, after the Approval).

## 1. What a designer wants

A designer should design a signature the way they design noteheads: by
choosing how it looks once, not by defining every key in every mode
(operator, session 42). One design should reach a traditional signature,
the scale stack the engine draws today, and Clairnote's signatures
(operator, 2026-11-08).

So a signature is **one rule over every key.** The designer picks a kind and
a handful of options. The canvas draws the result for whatever key and mode
the staff's picker shows, and the engraving draws it for whatever `\key` the
score sets. Key definitions (`keys.definitions`) stay what they are today:
names for notehead rules that apply in particular keys. A signature never
needs one.

## 2. What is built today

- **`keys.keySignature`** (architecture plan §4.9): `enabled`, `style`
  (one value, `"notehead-chords"`), `placement` (`rule:
  "scale-from-tonic"`, `tonicOctave`, `null` for automatic) and `separator`
  (the gold stem: `enabled`, `color`, `thicknessPct`, `extentSemis`).
- **The scale stack** (`cnb/src/cnb-key-signature.js`): the key's seven
  notes from the tonic, and the tonic an octave up, as real noteheads
  resolved through the notehead rules at crotchet duration. They alternate
  between two columns (even-numbered notes left, odd right), with each
  column's ledgers, and the gold stem runs between the columns beneath
  them. Automatic placement centres the octave on `staff.midpoint`.
- **The key** is example data: the staff's key and mode picker (session 36)
  offers the twelve tonics (`C`, `C♯`, `D`, `E♭`, `E`, `F`, `F♯`, `G`, `A♭`,
  `A`, `B♭`, `B`) and LilyPond's seven modes (`CNBMusic.MODES`).
- **The engine** (`cnb/keysig.ly` in the engine repository) draws the same
  stack from the score's `\key`, through the exported notehead procedure.
  Its settings are `cnb:keysig-style` (`'chord` or `'none`), the bar's
  colour, thickness and extent, and the tonic octave (LY spec §5.6).
- **Not built:** any other style. Set 010 rejected simple built-in marks
  (dots, interval blocks, staggered ledgers) and deferred custom-symbol
  signatures (`docs/session-sets/010-custom-key-signatures/s2-design-consult.md`).
  The engine backlog §2.3 says such signatures need a **mark-list hook**:
  the engine drawing an explicit list of marks for each key.

## 3. Two kinds of signature

| Kind | What it draws | For |
|---|---|---|
| **Scale notes** | the key's notes as noteheads | the scale stack, Clairnote, and most chromatic notations |
| **Accidentals** | the traditional sharps or flats | readers who know traditional notation, such as pianists |

**Spelling.** Both kinds need to know whether each note of the key is a
natural, a flat or a sharp: scale notes to give each its look, accidentals
to choose a sign. A key's spelling is the traditional one: its seven notes
on the seven letters, starting from the tonic's spelling (LilyPond's
`keyAlterations` for its `\key`). The tonic's spelling matters (F♯ major has
six sharps, G♭ major six flats).

**The keys.** The supported keys are those whose signature has at most
seven sharps or flats: for each of the seven modes, the 15 tonic spellings
of LilyPond's circle of fifths, 105 keys. For the mode chosen, the staff's
picker offers exactly those 15: in major, C G D A E B F♯ C♯ and F B♭ E♭ A♭
D♭ G♭ C♭; in minor, A E B F♯ C♯ G♯ D♯ A♯ and D G C F B♭ E♭ A♭. Three pitch
classes therefore have two spellings in each mode, and no key needs a
double sharp or double flat. The picker keeps its seven modes.

## 4. Scale notes

Each point of the operator's outline, B1 to B5, is one setting.

### 4.1 The look of naturals, flats and sharps (B1)

By default each mark looks like its notehead: the shape, fill, colour and
size the notehead rules give that pitch at crotchet duration, as today.
The designer may give **all marks** a look (Argon's simplification: one
place to make every mark smaller), and **flats** and **sharps** their own
over it, for every pitch of that kind; naturals take the look of all marks.
Each field left unset keeps the one beneath. The order is: the notehead's
own, then all marks, then flats or sharps, then every second stack (§4.4).

**Noteheads or custom symbols** (operator, 2026-11-11). A look's shape may
be any imported shape, so the marks can be the noteheads themselves or
symbols imported for the signature alone (through the same SVG importer).
A shape only the signature uses is exported like any other (Section A).

Clairnote is an example. Its signature is small dots, filled or hollow as
its noteheads are, with a tail rising to a sharp and falling to a flat. A
designer imports a dot, a dot with a rising tail and a dot with a falling
tail as shapes, gives all marks the dot and its size, and sharps and flats
the tailed dots. The fill then follows the noteheads (mock-ups section 6).
A symbol is placed by its origin, as a notehead is, so a tailed dot's
origin must be the dot's centre, not the middle of dot and tail. The
operator finds such tails hard to see at a concert staff's size, as the
mock-ups bear out; that is the designer's choice to make, and the gallery's
own symbols are checked at concert size on an engraved page.

*(Session 50, at the operator's choice after that check.)* The gallery's
own symbols are a dot with a slash through it, rising (/) for a sharp and
falling (\) for a flat, rather than a one-sided tail. The engine places a
mark by centring its box on the stack (and its height by its origin), so a
one-sided tail moves the dot off its stack unless hidden geometry balances
the box, and LilyPond prints any such geometry as a speck. A tail steep
enough to read also ran into the next dot a whole step away. The slash is
symmetric about the dot and clears its neighbours. A designer's own
symbol should likewise be symmetric about its origin from left to right
(`docs/sessions/session-050/notes.md`).

### 4.2 The upper tonic (B2)

**Show the tonic an octave up** is on by default, as today. Off, the
signature has the key's seven notes only.

### 4.3 Only the tonic and the half steps (B3)

**Notes: all of the scale** (the default), or **the tonic and the half
steps**: the tonic, and both notes of each half step in the scale. In C
major that is C, E and F, B and C′ (the upper tonic only when shown). In A
minor it is A, B and C, E and F.

### 4.4 Stacking (B4)

*(Revised from the operator's four rules, 2026-11-11; mock-ups section 3.)*
Which stack (column) a note joins is one of four rules:

| Rule | Stacks |
|---|---|
| **Stacked sevenths** (the default) | scale degrees 1, 3, 5, 7 left; 2, 4, 6 and the octave right; today's two stacked seventh chords |
| **Odd semitones left, even right** | by the note's semitone; a pitch is always on the same side |
| **A new stack at each change of parity** | the tonic's stack first; a note whose semitone's parity differs from the note below it starts a new stack to the right (Clairnote's). C major is C D E \| F G A B \| C′ and A minor A B \| C D E \| F G A′; without the upper tonic they are Clairnote's 3–4 and 2–3–2 |
| **Zigzag at each change of parity** | the tonic left; a change of parity moves to the other stack, right then back left |

A whole step keeps the semitone's parity and a half step changes it, so in
the seven modes the parity changes exactly at the half steps. Stacks are
assigned from the whole scale, the upper tonic included, before any note is
left out, so with only the tonic and the half steps (§4.3) or without the
upper tonic the stacks are the same and some notes are not drawn. Odd-left
and the zigzag agree, mirrored, for a tonic on an even semitone and differ
for one on an odd semitone, so their tests take both.

**Marks that run together.** The parity rules' stacks hold notes a whole
step, two semitones, apart, and where a signature repeats (§4.5) the seam
can put two notes a half step apart in one stack (B and C in C major). A
mark taller than its neighbour's distance runs into it, as the default
2.7-semitone notehead does in the mock-ups; Clairnote's dots are small for
this reason. The design does not shrink or move marks: the panel warns when
two marks in one stack overlap, from their resolved heights and their
semitones, and the size of §4.1 is the remedy. No collision avoidance is
built.

**The gold stem** stands between each pair of neighbouring stacks, beneath
the marks, under any rule ("in between the stacks", operator 2026-11-11).
Whether it shows, its colour and its thickness are the designer's: the
existing separator settings, on and gold by default, as today. Under a rule
with three or four stacks that is two or three bars, which Argon found
heavy beside small dots, so **several stems share the thickness** (operator,
2026-11-11): with it on, the default, each of n stems is the thickness ÷ n,
one stem 100%, two 50%, three 33%; off, each is the full thickness. One
stem, today's signature, is unchanged either way. The Clairnote gallery
files turn the stem off. Each bar
runs over the staff's middle ± its extent in the middle, as today, and over
its own copy's marks on a line set.

Two more options apply under every rule:

- **Every second column** may take a look of its own, so the columns tell
  apart: a fill, a colour or a shape, each set or left as it is. It is the
  same kind of look as the naturals', flats' and sharps' (§4.1), laid over
  them. Clairnote's own noteheads already alternate, so its gallery files
  leave it unset.
- **Columns go to the right** (the default), or **to the left in sharp
  keys**, as Clairnote's do: its stacks rise to the right in flat keys and
  to the left in sharp keys, so a tail never meets the next dot. A key with
  no sharps or flats goes right. Under odd-left-even-right, which fixes
  each side, it does not apply.

### 4.5 Where the signature sits, and repeats (B5)

*(Revised after the operator's first review, 2026-11-11: the places are
the staff's line sets, and the mock-ups show them;
[`key-signature-mockups/`](key-signature-mockups/index.html).)*

A **line set** is a run of staff lines one staff space apart, on the
engraved staff: the 24 semitones centred on its middle, `staff.midpoint −
12` to `staff.midpoint + 12` (LY spec §5.1a), which the canvas draws too.
The default 4-8 staff has two sets, either side of middle C: the bottom set
(E and G♯, semitones 4 and 8) and the top set (16 and 20). Kite's 3-6-9
staff has two of three lines each. A line on its own is a set of one. A
staff with one set (a five-line staff) has the same set at the bottom and
the top, and repeating it draws one copy. Four choices:

| Choice | The signature sits… |
|---|---|
| **In the middle of the staff** (the default) | its octave centred on the staff's middle, today's automatic rule |
| **On the bottom line set** | on the lowest line set (as Clairnote's do) |
| **On the top line set** | on the highest line set |
| **On every line set** | one copy on each line set: both, on the staves above |

An explicit tonic octave (`placement.tonicOctave`) still overrides the
middle, as it does today. The line sets ignore it, so a stored value never
makes the place controls seem not to work.

**Which octave, on a set: centred.** A signature spans an octave, which on
the 4-8 staff is three staff spaces taller than a set of two lines, so it
reaches past its set, and a tonic midway up the set (G, A) has no octave
that sits neatly in it. On a set the signature takes the octave, tonic to
tonic, whose middle is nearest the set's middle, the higher one on a tie;
leaving out the upper tonic or some notes does not move it. G major on the
bottom set runs from the G below the set to the G inside it. The mock-ups
(section 2) compare two other rules, rising (the signature starts in the
set and extends up, so G runs into the top set) and falling (it ends in the
set and extends down below the staff); both consult rounds found centred
the most predictable, and the operator went with the recommendation
(question Q4). There is no setting for it.

**The root as a double notehead.** *(Revised from the operator's note that
stacked sevenths repeated up the staff "would have to reverse".)* Each copy
is placed on its set on its own, and its marks are drawn as they fall; two
marks at one semitone in one stack are drawn once. Where two copies are an
octave apart, the lower copy's upper tonic is the upper copy's tonic, at
one semitone, and each draws it in its own stack. Under stacked sevenths
the octave is on the right and the tonic on the left, so the root is two
marks side by side, a **double notehead**: each copy restarts its stacks
there. Under a rule that puts both in one stack (odd left, even right; the
zigzag in these modes) it is one mark. Without the upper tonic it is the
upper copy's tonic alone (mock-ups section 4).

**Repeating is busy.** On two sets the whole scale twice is a lot of
marks; the tonic and the half steps alone (§4.3) carry the key in fewer,
which may help a new reader without the clutter (operator, 2026-11-11;
mock-ups section 7). Both are offered, as independent settings: choosing
every line set does not change the notes, and the panel's help suggests
the tonic and the half steps for a repeated signature.

## 5. Accidentals

The traditional signature: a sharp for each sharp of the key, in the order
F C G D A E B, or a flat for each flat, in the order B E A D G C F, each in
its own column, left to right, and nothing for a key with neither. The
signs are LilyPond's own (Emmentaler `accidentals.sharp` and
`accidentals.flat`, SIL OFL 1.1, as the treble, bass and alto clefs are),
black, at LilyPond's size in staff spaces.

**Height.** Each sign sits at the semitone of the note it alters: F♯'s sign
at F♯, where an F♯ is drawn on this staff. Its octave is the one the
signature's place (§4.5) gives that note in the scale; **on every line
set** draws a sign in each copy, each copy's columns starting again from
the first. Signs have no ledger lines. *(The consult split here, and the operator chose
the note it makes over the letter it alters; question Q2.)* At LilyPond's
size a sign is about 2.5 staff spaces tall, ten semitones on the 4-8 staff,
so neighbouring signs overlap in height; each has its own column (mock-ups
section 6).

The scale-note settings (§4.1–§4.4) do not apply. The place (§4.5) does.

## 6. The config

`keys.keySignature` gains the settings below. Each default is today's
behaviour, so a config saved today loads, previews and exports exactly as
before. `style` keeps its stored value `"notehead-chords"` for scale notes,
so nothing is moved on load.

```javascript
keySignature: {
  enabled: false,
  style: "notehead-chords",        // scale notes | "accidentals"
  notes: "all",                    // | "tonic-and-half-steps"
  upperTonic: true,
  looks: {                         // each field unset = the look beneath
    all: {},                       // { shape, hollow, color, heightSemis, widthSemis }
    flat: {},
    sharp: {}
  },
  stacking: "degrees",             // | "parity" | "parity-stacks" | "parity-zigzag"
  alternate: {},                   // every second column: { shape, hollow, color }
  columns: "right",                // | "left-in-sharp-keys"
  placement: {
    rule: "scale-from-tonic",      // kept as it is; no control
    tonicOctave: null,             // kept as it is; no control; the middle only
    position: "middle"             // | "bottom-set" | "top-set" | "every-set"
  },
  separator: { enabled: true, color: "#ffd42a", thicknessPct: 160, extentSemis: 12,
               shareThickness: true }
                                   // the gold stem, between neighbouring stacks;
                                   // shareThickness: n stems are thicknessPct ÷ n each
}
```

**Validation** checks each vocabulary, that a named shape exists, that a
colour is `#RRGGBB`, and sizes as it checks a notehead rule's (§4.5 of the
architecture plan). The settings that do not apply to the chosen kind or
stacking are kept and ignored, so switching back restores them.

## 7. The panel

The Key signature section, in a designer's words. The key definitions
stay below it, under "Keys for notehead rules".

```
Key signature   [x] Show the key signature

  Draw          (o) The key's notes   ( ) Sharps or flats

  Notes         (o) The whole scale   ( ) The tonic and the half steps
                [x] The tonic an octave up
  Stacks        (o) Stacked sevenths: 1 3 5 7 left, 2 4 6 8 right
                ( ) Odd semitones left, even right
                ( ) A new stack at each change of odd and even
                ( ) Zigzag at each change of odd and even
                Stacks go  (o) to the right  ( ) to the left in sharp keys
                [x] Gold stem between the stacks   colour [■]  thickness [0.4] staff spaces
                    [x] Several stems share the thickness (2 stems: half each)
  Looks         All marks          [as the noteheads ▾]
                Flats              [as all marks ▾]
                Sharps             [as all marks ▾]
                Every second stack [as the others ▾]

  Place         (o) In the middle of the staff  ( ) On the bottom line set
                ( ) On the top line set         ( ) On every line set
```

- The defaults are today's scale stack, so a new signature starts there.
  There are no presets: a Clairnote-style signature needs its own dot
  shapes, so it is shown by the Clairnote SN and DN gallery files rather
  than by a button that could only set half of it.
- A look's menu opens the notehead panel's own controls (shape, fill,
  colour, height and width) for that kind, with "as the noteheads" (or "as
  the others") to clear a field.
- The panel has no control for the placement rule or the tonic octave,
  which stay in the config as they are. The gold stem's extent keeps its
  stored value.
- Settings that do not apply are hidden: the scale-note rows for
  accidentals, and the direction under odd-left-even-right.
- When two marks in one stack overlap for the picked key, a note beside the
  stacks says they run together and points to the looks' size (§4.4).
- The canvas draws the signature for the picked key as each setting
  changes, as it does today.

## 8. The preview

One pure function computes what is drawn:

```
CNBKeySignature.marks(config, key) → { marks: [{ semi, column, mark }], columns: [x], bars: [{ x, top, bottom, color, thickness }] }
```

`key` is the picker's tonic (with its spelling) and mode. `mark` is a
resolved notehead look (shape, hollow, colour, size) or an accidental
(`"sharp"` or `"flat"`); two marks at one semitone in one column are one.
`columns` are the columns' x offsets in staff spaces, from the marks'
widths, and `bars` the gold stems. `render` draws them, each head column's
ledgers beneath. A double notehead is two marks at one semitone in
neighbouring columns, so it needs nothing of its own. The gutter widens to
the columns. The exporter writes the same result (§9), so the preview and
the engraving cannot disagree about a key's marks or where they go.

## 9. LilyPond, and the engine's work

**The export stays the same for a default signature.** A scale stack with
every new setting at its default exports as today (`'chord`, or `'none`
when off), byte for byte. Any other signature exports a **mark table**:

```lilypond
#(set! cnb:keysig-style 'marks)
#(define cnb:keysig-marks
   '((((0 . 0) . (0 2 4 5 7 9 11))       ; C major: tonic C natural, its pitch classes
      . ((12 0 head crotchet-minim #f black-000000)
         (14 0 head crotchet-minim #t black-000000)
         …))
     …))
```

- **One entry per supported key** (§3): 15 spellings of the tonic × 7
  modes, 105 entries, the keys the picker offers. The key is the tonic's
  note name and alteration (as `\key` gives them) and the key's sorted
  pitch classes, so C major and A minor are told apart by their tonic, and
  F♯ major and G♭ major by their spelling.
- **The marks are absolute**, on the staff's range (§4.5), which the export
  already fixes, so "on every line set" needs nothing from the engine but
  the marks.
- **Each mark** is its engine semitone (the §5.7 numbering), its column,
  and either `head` with the shape, fill and colour names Section A
  registers (a sized variant where it has a size, §4.1c) or `sharp` or
  `flat`. A double notehead is two marks at one semitone. Signs have no
  ledgers.
- **The geometry is explicit** (both round-2 models): each entry gives its
  columns' x offsets in staff spaces and its bars, each with its x, its two
  ends, colour and thickness, all computed by `CNBKeySignature.marks` from
  the marks' widths. Three or four stacks of small dots and seven wide
  signs cannot share the engine's fixed two-column step, and the engine
  then computes no layout of its own.
- **Which path** is decided from the effective settings, those that apply
  to the chosen kind and rule, not from every stored field: a stored but
  unused setting does not move an export off `'chord`.
- **A key not in the table** (a score's `\key dis \major`, say) draws no
  signature, and the engine warns naming it. It does not fall back to the
  scale stack, which would be the wrong signature.

**Engine work** (the engine repository's sessions, planned by Configurator
session 48 into its plan, as session 46 planned engine session 28):

1. **First, the key's identity**: confirm, from the `\key` event, that the
   engine recovers the tonic's note name and alteration and the key's pitch
   classes, as the table's keys need.
2. **The mark-list hook** (engine backlog §2.3): `cnb:keysig-style 'marks`
   and `cnb:keysig-marks`, drawn by the key-signature engraver from the
   score's `\key`: heads through the registered stencils, accidentals from
   Emmentaler, each head column's ledgers, and the entry's bars, at the
   entry's column offsets. A key change draws the new key's marks and no
   cancelling naturals. Its tests include a key change, enharmonic
   spellings, a transposed score and the signature repeated at each
   system's start.
3. **The space around it**: the space before the signature and after its
   last column, measured and given in the handoff, so the preview places
   the first note as the engine does (today's 0.75, 3.5 and 4.8636 staff
   spaces are measured for two columns).
4. Goldens and integration specs on LilyPond 2.24 and 2.26, the handoff
   (`configurator-handoff.md`), and a minor release, **engine 1.4.0**, since
   it adds a setting and changes no existing output.

The LY spec gains §5.6a (1.3.15) for the table.

## 10. Questions for the operator

- **Q1. The root as a double notehead.** *Settled with the operator*
  (2026-11-11): on every line set, each copy draws the shared root in its own
  stack, which under stacked sevenths is two heads side by side (§4.5).
- **Q2. Accidentals' height.** *Settled by the operator* (2026-11-11),
  where the consult split: at the note they make (F♯'s sign at F♯), not at
  the letter they alter (§5).
- **Q3. "Near the notes on the staff".** *Settled by the consult*: the
  middle of the staff stands for it. Following the music's register would
  need the engine to read ahead, and the canvas has no music (§4.5).
- **Q4. Which octave on a set.** *Settled*: centred, with no setting. The
  operator went with the recommendation (2026-11-11), and both round-2
  models chose it from the mock-ups (§4.5).

## 11. The program

Each UI session ends with the browser UAT and screenshots at 1440 and
1280 px, as sessions 25 onward do. The engine's contract is settled first
(session 48) and the scale notes reach LilyPond (49) before the panel and
the accidentals are built on them.

### Session 48: Scale notes on the canvas, and the engine's hook planned

1. Register.
2. First, a LilyPond probe (`cnb/tests/engine-probe.js`) confirms, from
   real `\key` events, that the engine can read the tonic's spelling and
   the key's pitch classes, the table's keys (§9), for a sharp, a flat and
   an enharmonic pair of keys. If it cannot, the session stops and the
   design is revisited.
3. The config fields of §6 with their defaults, validation, and the
   architecture plan's §4.9.
4. `CNBKeySignature.marks` for every scale-note choice (§4), `render`
   drawing from it, and the picker's 15 spellings per mode (§3), with tests
   in `cnb/tests/cnb-key-signature-tests.js` and
   `cnb/tests/cnb-preview-display-tests.js`: each of the operator's points,
   C major, A minor, odd and even tonics under each stacking rule, a sharp
   key and a flat key, the overlap warning's test, and every fixture and
   gallery file drawing exactly as before.
5. *Engine work:* insert the engine's session 30, the mark-list hook (§9,
   with the format `marks` produces, its column offsets and bars, and a
   real Emmentaler sharp and flat), and session 31, its release 1.4.0, into
   the engine's plan.

### Session 49: Scale notes reach LilyPond

1. Register.
2. Once engine session 30 has landed (else the step is blocked): the
   exporter writes the mark table for any signature not at its defaults
   (§9); LY spec 1.3.15 §5.6a, the architecture plan, the README.
3. An engine round trip on a representative set, the default and Clairnote
   DN fixtures, each stacking, upper tonic on and off, the half steps
   alone, and the bottom, top and every line set, holds each engraved
   mark's height, column and look, and the signature's width, to the
   preview's within
   0.001 staff spaces; the combinations are covered by the pure tests. A
   key the table lacks engraves no signature and warns. The five export
   baselines stay byte-identical.

### Session 50: The Key signature panel

1. Register.
2. The panel of §7, in a designer's words.
3. The Clairnote SN and DN gallery files take Clairnote-style signatures:
   dot and tailed-dot symbols (each placed by the dot's centre, tails
   thick and steep enough to read), a new stack at each change of parity
   going left in sharp keys, no upper tonic, no gold stem. They are checked
   at concert size on an engraved page. *(Done with slashed dots at the
   operator's choice; §4.1.)*
4. A UAT driver for each choice on the canvas; screenshots at 1440 and
   1280 px. *Engine work:* none.

### Session 51: Accidentals

1. Register.
2. `CNBKeySignature.marks` for accidentals (§5, at the pitch they make),
   with Emmentaler's sharp and flat (SIL OFL 1.1; its licence is already in
   `cnb/assets/fonts/`); the panel's "Sharps or flats".
3. The export writes them through the table; an engine round trip for C,
   a sharp key and a flat key, on the bottom line set and on every line
   set; tests and the UAT.
   *Engine work:* none beyond session 30, which draws sharps and flats.

### Session 52: The UI is stable

The operator tries sessions 43–51 and declares the UI stable, or plans what
is left before the release.

### Session 53: Release 1.1.0 (release: 1.1.0)

As the session plan has it: the withdrawn 1.0.2 entry renamed, the
notehead-first editor, the clef and key-signature export and sessions 36
onward added, and the site's first deploy confirmed.

## 12. What the consults changed

**Round 1.** GPT (`gpt-5.6-terra`) and Gemini (`gemini-3.1-pro-preview`)
reviewed the draft on 2026-11-11 ([the record](key-signature-designer-consult.md)).
From their synthesis:

- **The keys** are the 105 with at most seven sharps or flats, and the
  picker offers each mode's 15 spellings, so no key needs a double sharp or
  flat (§3). The draft offered 17 spellings in every mode, some needing
  double accidentals it could not draw, and the export covered 15.
- **The places** are defined on the staff's range rather than on line
  groups, without counting marks (§4.5). *(Revised again at the operator's review: the places are the line sets, bottom, top or both.)*
- **The root on both sets** is two heads side by side (Q1; refined in the
  operator's review: each copy draws it in its own stack). "Near the notes"
  is the middle of the staff (Q3).
- **Every second column** takes one look, like the others, instead of
  three separate switches (§4.4).
- **No Start from presets**: Clairnote's signature is shown by its gallery
  files, since a button could not supply its dot shapes (§7).
- **A key the table lacks** engraves no signature and warns, rather than
  the scale stack (§9); the engine session first confirms that it can read
  the key's identity from `\key`.
- **The program** settles the engine's hook in session 48 and exports the
  scale notes in 49, before the panel and accidentals; the engine round
  trip covers a representative set (§11).

**The operator's review** (2026-11-11) then asked for mock-ups, the places
as line sets (bottom, top or both), four stacking rules, custom symbols,
and a gold stem with its own colour and thickness, and chose accidentals at
the pitch they make (Q2).

**Round 2.** Sol (`gpt-6.1-sol`) and Argon (`gemini-4-argon`), whom the
operator named, reviewed the revised design with the mock-ups' images:

- **Centred on a line set, with no setting** (Q4), both agreeing; the
  `placement.octave` setting is cut.
- **"On every line set"**, not "both sets", since a staff may have more
  than two; one set draws one copy. A stored tonic octave overrides the
  middle only, so it never makes the place controls seem broken (Sol).
- **One look for all marks**, flats and sharps over it, instead of a
  naturals look: one place to shrink every mark (Argon).
- **The overlap warning** is computed from the marks' heights and
  semitones, seams included, not from the rule alone (Sol).
- **Repeating stays a separate choice** from the notes, the tonic and the
  half steps suggested in its help rather than switched on (both); marks at
  one semitone in one stack are drawn once (Argon).
- **The geometry is explicit in the export**: column offsets and bars, from
  the marks' widths (both), and the export path is chosen from the
  effective settings (Sol).
- **The key's identity is proved first**, in session 48, by a LilyPond
  probe, before the canvas is built on it (Sol).
- **Corrections** (Sol): A minor with the upper tonic is A B | C D E | F
  G A′, and G on the bottom set runs from G to G.

Kept against one model: the gold stem between every pair of neighbouring
stacks (Argon would have one bar at most), because the operator asked for
it between the stacks; the Clairnote files turn it off.

Round 1 also kept, against one model's advice, the stored `style` value
`"notehead-chords"` (no migration is needed to keep it) and the
alternating look (the operator asked for it), and left Q2 to the operator,
who settled it.

## Approval

**Approved by the operator on 2026-11-11**, after reviewing the mock-ups
and both consult rounds: "I approve everything", with one clarification,
made above (§4.4, §6, §7): the gold stem's colour and thickness are the
designer's, and several stems share the thickness (one stem 100%, two 50%,
three 33%), as a setting.

The operator's decisions in this session:

- Placement on the line sets, bottom, top or every one (Clairnote's on the
  bottom), with a tonic midway up a set centred on it (Q4, the
  recommendation).
- Traditional accidentals at the pitch they make (Q2).
- Four stacking rules: stacked sevenths, odd semitones left and even
  right, a new stack at each change of parity, and a zigzag at each change
  of parity (§4.4).
- Noteheads or custom symbols for the marks (§4.1).
- Repetition offered, with the tonic and the half steps as the less
  cluttered way to repeat (§4.5).
- A second consult with Sol and Argon before approving (§12).

The program of §11 is numbered in the session plan: sessions 48 to 51
build the designer, session 52 is the UI-stable session and session 53 the
1.1.0 release.

---

## 13. Amendment: the key-signature editor (session 53)

**Session:** 53 (2026-11-11). A design only: no code changes with it.
**Source:** the session plan's session 53, from the operator's request
(2026-11-11): an editor that shows the signature magnified, its marks
noteheads, sharps and flats or imported symbols, each of which can be
resized and moved, with rules for stacking and offsets.
**Mock-ups:** [`key-signature-editor-mockups/`](key-signature-editor-mockups/index.html).
**Consult:** Sol and Argon,
[`key-signature-editor-consult.md`](key-signature-editor-consult.md); what
it changed is §13.12.

### 13.1 Why

Sessions 48–52 built two styles. "The key's notes" draws one shape per
mark with its box centred on its stack. "Sharps or flats" draws Emmentaler's
signs and nothing else. Clairnote shows what neither can do (operator,
2026-11-11). A mark on a line or a ledger is solid and one in a space is
hollow, and a flat has a diagonal tail up and a sharp a diagonal tail down.
A mark is therefore one to three shapes: a dot, solid or hollow, and a tail.
Session 50 tried one-sided tails and dropped them for two reasons
(`docs/sessions/session-050/notes.md`):

1. **Hidden geometry.** The engine centres a mark's box on its stack. A
   one-sided symbol therefore needed an invisible sliver opposite its tail
   to keep its dot on the stack, and LilyPond printed the sliver as a speck.
2. **The next dot.** A steep tail ran into the next dot of a whole-step
   stack.

This amendment answers both (§13.6, §13.7). It replaces the two styles with
one model and gives the model an editor.

### 13.2 One model for every signature

A signature is four choices:

| Choice | Values |
|---|---|
| **Which notes get a mark** | the whole scale (the default), the tonic and the half steps (§4.3), or **the sharps or flats only**; and the upper tonic, as today (§4.2) |
| **What each mark is drawn with** | a look for naturals, flats and sharps, laid over the notehead's own look (§13.3, §13.4) |
| **How the marks are arranged** | today's four stacking rules (§4.4), or **the cycle of fifths, one mark to a column** (§13.5); and the place (§4.5) |
| **Their sizes and offsets** | each symbol's size and its offset from the mark's pitch, in semitones (§13.3, §13.6) |

**The notehead signature is the default**: the whole scale, every mark the
notehead's own look, stacked sevenths, in the middle, with the gold stem.
It is today's default signature, unchanged.

**The traditional signature is a starting point**, not a separate style.
It sets the sharps or flats only; Emmentaler's sharp for sharps and flat for
flats, each with no colour (`color: null`, black), so that a notehead's
colour never reaches a sign; the cycle of fifths, with the heights the
window gives (§13.5); and the place in the middle. Under the cycle of fifths
there is no gold stem (§13.5). The designer can change any of it
afterwards: give the signs a colour, move them, or draw dots for them.

**Configs saved today load and draw as they do now.** `style` is retired,
and a config that carries it is converted when it loads, as a palette is
(`CNBConfig.paletteToRules`). A new pure function,
`CNBConfig.signatureStyleToModel`, is called by `CNBConfigIO.mergeLoaded`:

- `"notehead-chords"` needs nothing: the model's defaults are that style.
  The field is dropped.
- `"accidentals"` becomes the sharps or flats only, `looks.flat` `{ sign:
  "flat", color: null }`, `looks.sharp` `{ sign: "sharp", color: null }`,
  and the cycle of fifths with the heights `"scale"` (§13.5). Those are
  session 51's signs, black, each at its note in the scale's octave from
  the tonic. `looks.all`, `looks.flat`, `looks.sharp` and `alternate` are
  cleared first: the accidentals style ignored them, and left in place they
  would colour or reshape the signs. `signs.heightSemis` and `placement`
  stay as they are.

The conversion runs on the loaded data before the defaults are merged, and
running it twice changes nothing. Every fixture and gallery file therefore
draws, and exports, byte for byte as before, which the first building
session pins (§13.11). What a saved accidentals config loses is only the
notehead settings it was not using; Sol suggested keeping a copy of them,
which is not taken, since nothing reads them.

### 13.3 Symbols

A mark's **base** is one of three kinds of symbol:

- **A notehead**: the notehead's own look (nothing set), or a chosen
  shape from `config.shapes`, which is today's look `shape`.
- **Emmentaler's sharp or flat**: the look's new field `sign`, `"sharp"`
  or `"flat"`. These are the signs session 51 draws, sized by session 52's
  `signs.heightSemis`. One size serves both signs, and a look's height and
  width do not apply to them (the session plan: "resizing a sharp sets
  session 52's size"). A sign takes a look's colour; it takes no colour
  from the notehead (§13.2).
- **An imported SVG**, which is a shape like any other. It is imported
  through the notehead panel's Import from SVG into `config.shapes`, and
  chosen as `shape`. A look's `shape` and `sign` are one slot: a layer that
  sets either replaces both beneath it.

Each kind is chosen separately for naturals, flats and sharps (§13.4), and
flats and sharps each have their own Import from SVG, so a designer imports
the flat's symbol while editing flats.

**Added symbols.** A look may add up to two symbols to the base, `added:
[{ shape, heightSemis, widthSemis, offset }]`, each a shape from
`config.shapes`. An added symbol is drawn over the base, solid, in the
mark's colour, and has no ledgers of its own. So one tail serves a solid dot
and a hollow one: the flats' look adds a tail, and the dot beneath is solid
or hollow as its line or space gives it (§13.4). Two added symbols are
enough for a dot with a tail and a second stroke, and the limit keeps the
look's controls small.

**A symbol's reference point and its ledgers.** Two new optional shape
fields:

- **`reference: { x, y }`**, in the shape's native SVG units: the point
  that sits on the mark's pitch, such as a dot's centre or a flat's bowl
  line. A shape without one is placed as today, its box centred on its
  stack and its origin at its pitch. Every shape saved today is therefore
  placed as it is now.
- **`ledgers: false`**: the symbol takes no ledger lines, as a sign does
  not. A shape without the field takes them, as a notehead does.

Only the key signature reads the two fields. A notehead rule that uses the
same shape draws and engraves it as it does today, with its ledgers.

For Emmentaler's signs both are fixed: the reference is the sign's box's
centre across and its origin up and down, a sharp's centre line and a flat's
bowl line, which is where session 51 puts them, and a sign takes no ledgers.

**On import** the panel shows the symbol enlarged, with its reference point
marked. The point starts at the SVG's origin, which is the toolkit's
notehead centre. A click on the symbol moves the point. Beneath it is a
checkbox, "Takes ledger lines", which starts on when importing for naturals
and off when importing for flats or sharps. The toolkit's `data-*`
attributes are read as for a notehead (Module 16), and stem anchors are not
needed.

### 13.4 When a look applies

Looks are laid over one another, each field left unset keeping the one
beneath, in this order, the last winning:

1. the notehead's own look (at crotchet, in the key), as today;
2. **all marks** (`looks.all`), as today;
3. **naturals** (`looks.natural`, new), **flats** (`looks.flat`) or
   **sharps** (`looks.sharp`), by the key's spelling;
4. **on a line or a ledger** (`looks.line`, new) or **in a space**
   (`looks.space`, new);
5. **every second stack** (`alternate`), as today.

A mark is **on a line** when its pitch is a staff line's, or when the
notation's ledgers for a note at its pitch (`CNBLedgerSet.ledgersFor`)
include its own semitone. Otherwise it is in a space. This holds whether or
not the mark draws ledgers, so a sign can take the line look too. It is
decided from the mark's pitch, before any offset. Under a pitch axis the
comparison is by axis position, to within 10⁻⁶.

A look's fields are today's `shape`, `hollow`, `color`, `heightSemis` and
`widthSemis`, plus `sign`, `offset` and `added`. **`offset` and `added`
are each one field**: a layer that sets one replaces it whole, so an offset
`{ x: 0, y: 0 }` resets it and `added: []` removes the added symbols
beneath. Added symbols from two layers are not combined.

Clairnote SN is then:

- all marks are a small dot;
- a line or ledger is solid, and a space hollow;
- flats add a tail up;
- sharps add a tail down.

Clairnote DN sets no line or space look, since its noteheads already
alternate solid and hollow, and the dot takes their fill (mock-ups,
section 2).

### 13.5 Arrangement

`stacking` gains a fifth value, **`"fifths"`: the cycle of fifths, one mark
to a column.** In a sharp key the marks are in the order F C G D A E B, and
in a flat key, or a key with neither, B E A D G C F. The order is by letter,
so it applies to every mark drawn, naturals included, when the notes are
the whole scale. Under `"fifths"` the gold stem, the stack direction
(`columns`) and every second stack apply as follows:

- there is no gold stem;
- the direction does not apply, and the columns go left to right;
- every second stack is every second column;
- the upper tonic does not apply, since each letter has one mark.

**Heights** (`heights`, under `"fifths"` only):

- **`"scale"`**: each mark at its note in the scale's octave from the
  tonic, which is session 51's rule. The signs climb as the key's notes do.
- **`"window"`**: each mark at the octave of its note that falls in a
  **one-octave window around its line set**: the semitones from the set's
  middle − 6 up to, but not including, its middle + 6. In the middle
  place, the window is around `staff.midpoint`.

The window gives the traditional zigzag on any staff. A fifth up is 7
semitones and a fourth down 5, so in a window of 12 each next sign is
either a fifth up or a fourth down, and the signs zigzag instead of
climbing, as a treble signature's do (G5, D5, A4: down twice).
On the default staff's bottom set (lines 4 and 8, middle 6, window 0–11):

- the sharps fall on 6 1 8 3 10 5 0 (F♯ C♯ G♯ D♯ A♯ E♯ B♯);
- the flats fall on 10 3 8 1 6 11 4 (B♭ E♭ A♭ D♭ G♭ C♭ F♭).

The traditional treble clef does the same with its own windows: its sharps
fall in A4–G5 and its flats in F4–E5. The window is the fifths' order
wrapped into an octave, not every clef's exact placement, and its signs
stand at the pitches they make (§5). One setting moves the window:
**`window: { sharp: 0, flat: 0 }`**, the semitones by which the window is
raised in sharp keys and in flat keys (negative lowers). It is needed
because a traditional signature's sharps sit a third above its flats, and
some designers will want that. Both are 0 by default. All the marks of one
copy share its key's window, naturals included; a key with neither sharps
nor flats raises it by 0.

Every line set's copy has its own window, as each copy has its own octave
today (§4.5). The marks keep their order by letter, so the window changes
only their heights.

### 13.6 Placing a mark, and its sizes and offsets

**A mark is placed by its reference point plus an offset.** For a symbol
with a reference point (§13.3), the reference point goes to the mark's pitch
on its stack, moved by the symbol's **`offset: { x, y }`**, in semitones
(axis units under a pitch axis, as a notehead's size). Its box is not
centred. A one-sided symbol therefore needs no hidden geometry: a dot with
a tail has its reference at the dot's centre, and the dot sits on the stack
whatever the tail does. That is session 50's first failure answered.

- An added symbol is placed the same way, at the base's point (the base's
  offset included) plus its own offset. Moving the base moves its tail
  with it, and a tail can also be moved by itself.
- A symbol with no reference point is placed as today, its box centred,
  and an offset moves it from there. Every config saved today keeps that
  placement.
- A head's ledgers move with it, and are as long as the base is wide: an
  added symbol never lengthens them.
- **Sizes** are each symbol's `heightSemis` and `widthSemis`, as a
  notehead's are (null = the shape's own). The signs' size is
  `signs.heightSemis` (§13.3).

**Columns.** The step between columns is the farthest any mark reaches to
the right of its stack's line plus the farthest any mark reaches to the
left, the offsets and added symbols included. No mark's ink then overlaps
the next column's. A mark centred on its stack, as every mark today is,
gives its width, today's step, so nothing saved today moves. A mark that
reaches out to one side widens the step for the whole signature, which
keeps the rule to one number. *(Revised after the mock-ups: the first draft
took twice the farthest reach, which spaced a tailed dot's stacks half as
wide again as they need.)*

### 13.7 Tails

How a tail clears the next dot of its stack, session 50's second failure:

- **Shallow and short.** A stack holds notes a whole step, 2 semitones,
  apart. With a dot 1.6 semitones high and its reference at the centre, the
  next dot's edge is 1.2 semitones above the centre. A tail leaving the dot
  at 30° from the horizontal and reaching 0.8 semitones past its side
  rises about 0.5 semitones, and clears the next dot by more than its own
  thickness. Session 50's 55° tail rose about 1.1 semitones and met the
  dot. The editor's drag sets the tail's offset and size (§13.8), so the
  designer can make it shallower and shorter until it clears.
- **The next stack.** The column step reaches the farthest ink (§13.6), so
  a tail never reaches into the next stack. "Stacks go to the left in sharp
  keys" (§4.4) remains for Clairnote's own arrangement.
- **Measured, not avoided.** The editor checks every mark's ink against the
  other marks in its stack and in the neighbouring stacks, for all 105 keys,
  every line set's copy and the seams between copies included. This
  replaces §4.4's height-only overlap note. No mark is moved automatically.

**The touch check**, made precise from the consult:

- It compares whole marks, a base with its added symbols, so a tail joined
  to its own dot is not a touch. Staff lines and ledgers do not count.
- It tests the boxes first, and where two boxes meet, the ink itself: the
  two marks drawn into a small offscreen mask at a fixed resolution, a
  hollow mark's cut-out excluded. A diagonal tail whose box grazes a
  neighbour's is not reported unless its ink does.
- It runs after a drag ends, not while it moves.
- It is advice: it never blocks the export. The checks list shows it as a
  warning, "Marks touch in 3 keys", so the status does not say "No
  problems" beside it.

### 13.8 The editor

The Key signature section's panel holds the editor
(mock-ups, at 1440 and 1280 px):

```
Key signature   [x] Show the key signature     Start from: [The noteheads] [Traditional sharps and flats]

  ┌ Key: [D ▾] [major ▾] ───────────────────────────────────┐  ┌ Sharps ──────────────────────┐
  │                                                          │  │ Symbol  [notehead thumbnails] │
  │     the signature, magnified, on the staff's lines      │  │         [♯] [♭]  Import from SVG│
  │     and ledgers; a mark selected shows its reference     │  │ Fill    (as beneath) Solid Hollow│
  │     point, its box and a resize handle                   │  │ Colour  ■   Size  h [ ] w [ ]   │
  │                                                          │  │ Offset  x [0.0] y [0.0] semis   │
  └──────────────────────────────────────────────────────────┘  │ Added   [tail ▾] [+ Add a symbol]│
  Other keys:  C  G  D  A  E  B  F♯ C♯ | F  B♭ E♭ A♭ D♭ G♭ C♭   └──────────────────────────────┘
               (each a small signature; a key whose marks touch is outlined, "2 marks touch")
  Edit: (o) Sharps  ( ) Flats  ( ) Naturals  ( ) All marks  ( ) On a line  ( ) In a space  ( ) Every second stack

  Notes   (o) The whole scale  ( ) The tonic and the half steps  ( ) The sharps or flats only   [x] The tonic an octave up
  Stacks  ( ) Stacked sevenths … ( ) Cycle of fifths, one to a column: heights (o) in a window ( ) climbing
          window raised: sharps [0] flats [0] semitones
  Place   (o) In the middle of the staff ( ) bottom line set ( ) top line set ( ) every line set
```

- **The canvas** draws the signature for the picked key magnified, at 24
  px a semitone (about twice the staff's Medium size), with the staff's
  lines near the marks and the marks' ledgers, through the same `render`
  the staff uses. The magnification is a grid context with a larger
  `pxPerSemi`, and nothing else changes. *(The first draft said four times
  the staff's scale; the mock-ups showed that an octave's signature would
  then be taller than the panel.)*
- **The edit applies to its category, never to one mark in one key.** A
  line beside the controls says so: "Edits all flats in every key".
  - **What a click selects.** A click on a mark selects its spelling,
    naturals, flats or sharps, unless the designer has picked another layer
    in "Edit" (all marks, a line or ledger, a space, every second stack),
    which then stays picked. Every mark is on a line or in a space, so
    membership alone cannot say which layer is meant (both consult models).
  - **Which symbol.** A click on the base selects the base; a click on an
    added symbol selects that symbol. The look card names the selection,
    Base, Added 1 or Added 2, each with a way to remove an added symbol.
  - **Dragging** a symbol sets the layer's `offset`, or an added symbol's
    own offset, so dragging one flat moves every flat in every key. The
    corner handle sets the selected symbol's size, or `signs.heightSemis`
    for a sign, so resizing a sharp resizes both signs, as session 52's
    size does. Values snap to tenths of a semitone (a value loaded from a
    file is never snapped) and show beside the handle while dragging. One
    drag is one step of undo. The fields on the right show and set the same
    numbers.
- **The look card** is the notehead panel's controls, its thumbnails
  shared as `CNBNoteheadPanel.thumbnail`, with Emmentaler's sharp and flat
  as two more thumbnails, Import from SVG (§13.3), the offset fields, and
  the added symbols. Each field's "as …" clears it, as today.
- **The key picker** is the staff's own key and mode, shown above the
  canvas. Changing it here changes the staff's picker too.
- **Other keys.** Beneath the canvas, the picked mode's 15 spellings as
  small signatures at the staff's scale, sharp keys then flat keys,
  wrapping onto a second row where the panel is narrow. A click picks one.
  A key whose marks touch (§13.7) is outlined, with the number of places
  where marks touch. A line beneath says how many of the 105 keys have
  marks that touch. It opens a list of those keys, and a click on one picks
  its tonic and mode. An offset that fits B♭ major may collide in G♭
  major, and this is where the designer sees it.
- **The canvas's height is capped** at 360 px, the signature scrolling
  inside it if it is taller, so Notes, Stacks and Place stay near (Sol, from
  the mock-ups).
- **Start from** sets the notehead signature (the defaults) or the
  traditional one (§13.2) after asking to confirm, since it replaces the
  signature's settings. Show the key signature and the picked key are
  kept. Undo restores them (session 41's history).

**Panel rows the editor replaces:**

| Today's row | Becomes |
|---|---|
| Draw (the key's notes / sharps or flats) | **Start from**, and the third Notes choice |
| Looks (four menus) | **Edit** and the look card |
| Size (sharps and flats) | the sign's resize handle, and the size field in the look card ("Automatic (2.72)" kept) |
| The overlap note | the touch check over all keys (§13.7) |

Show the key signature, Notes, Stacks with the gold stem, and Place stay as
they are, each with the additions above. Controls that do not apply are
hidden, as today. The key definitions stay below, under "Keys for notehead
rules".

### 13.9 The config

```javascript
keySignature: {
  enabled: false,
  // style: retired; converted on load (§13.2)
  notes: "all",                    // | "tonic-and-half-steps" | "altered"
  upperTonic: true,
  looks: {                         // each field unset = the look beneath (§13.4)
    all: {}, natural: {}, flat: {}, sharp: {}, line: {}, space: {}
  },                               // { shape | sign, hollow, color, heightSemis, widthSemis,
                                   //   offset: { x, y }, added: [{ shape, heightSemis, widthSemis, offset }] }
  alternate: {},                   // every second stack, as today, with the same fields
  stacking: "degrees",             // | "parity" | "parity-stacks" | "parity-zigzag" | "fifths"
  heights: "window",               // under "fifths": | "scale"
  window: { sharp: 0, flat: 0 },   // under "fifths" and "window": semitones up
  columns: "right",                // as today
  placement: { … },                // as today
  separator: { … },                // as today
  signs: { heightSemis: null }     // as today: the size of both signs
}
shapes[name].reference             // optional { x, y }, native SVG units (§13.3)
shapes[name].ledgers               // optional; false = no ledger lines
```

**Validation** extends today's checks:

- each new vocabulary is checked;
- `sign` is `"sharp"` or `"flat"`;
- an offset is two finite numbers;
- `added` has at most two entries, each naming a shape that exists, its
  sizes checked as a notehead rule's are;
- a reference point is two finite numbers, and `ledgers` a boolean;
- a look that sets both `shape` and `sign` is an error.

Settings that do not apply are kept and ignored, as today, so switching
back restores them.

### 13.10 The preview, the mark table and the engine's work

**The preview.** `CNBKeySignature.marks` stays the one function that says
what is drawn, and the exporter writes its result (§8). Each mark gains the
symbols it draws, in order: the base, then the added ones, each with its
kind and its placement, either the box centred as today or a point (the
reference point plus the offset, in staff spaces from the column and the
pitch). `render` and the editor's canvas draw from it.

**The mark table** (LY spec §5.6a) keeps its format. Each mark gains one
optional last element, the placement **`(at dx . dy)`**, in staff spaces.
With it, the stencil's origin goes to the column plus `dx` and the
semitone's height plus `dy`, and its box is not centred:

```lilypond
(marks (6 0 head clairnote-dot #f black-000000)                 ; as today
       (6 0 symbol clairnote-tail-down #f black-000000 (at -0.05 . 0))
       (13 1 sharp 0.6473 red-cc0000 (at 0.1 . 0.25)))           ; a sign coloured and moved
```

- **`dx` and `dy`** are the offset less the reference point, scaled to the
  symbol's size and converted as its path is (§4.1b, Y negated), so the
  engine places only origins and never needs a symbol's reference.
- **A mark without `at`** is placed as today. Every table exported today is
  therefore engraved as before.
- **A sign's colour.** A sign may carry a colour, which Section A
  registers, after its scale. A black sign writes none, so an unchanged
  sign is written as today.
- **A sign with a colour or `at`** writes its scale even when it is 1, so
  the element positions stay fixed.
- **A new kind, `symbol`**: `(semi column symbol <shape> <cutout> <color>
  [at])`, as `head` is, but with no ledgers. It serves added symbols, which
  are solid, and any base whose shape has `ledgers: false`, which may be
  hollow.
- **Layered marks** are several marks at one semitone and column. The
  preview removes repeated marks (§4.5) before it splits a mark into its
  symbols, so a dot and its tail are never merged. The engine draws every
  ledger first, then the marks in the table's order. A mark's ledgers come
  from its `head`, so a tail adds none.
- **The spacing** reads the placed stencils' extents, which LilyPond's
  translation carries, so a moved mark widens the signature in both.

**The engine's work** is one engine session and its release. Its sessions
are numbered when the first building session inserts them into the
engine's plan, after its session 36, the 1.5.0 release:

1. `(at dx . dy)` on `head`, `symbol`, `sharp` and `flat` marks, as above.
2. The `symbol` kind, solid or hollow.
3. A colour on `sharp` and `flat` marks.
4. Drawing order: bars, every ledger, then the marks in table order.
5. Goldens and integration specs on LilyPond 2.24 and 2.26, the handoff,
   and **engine 1.6.0**, a minor release, since it adds to the format and
   changes no existing output. The key-change, transposition and
   system-start tests stay.

The space around the signature needs nothing new: the preview already
spaces a mark-table signature by its ink, and the engine's ink is its
stencil, whatever the placement.

### 13.11 The program

Each session ends with the browser UAT and screenshots at 1440 and
1280 px, as sessions 25 onward do.

**Session A: The model on the canvas, and the engine planned.**

1. Register.
2. The config of §13.9 with its validation, and
   `CNBConfig.signatureStyleToModel` called on load.
3. The looks for naturals, lines and spaces, the signs as a look, added
   symbols, reference points, offsets and columns (§13.3–§13.6), and the
   sharps or flats only with the cycle of fifths and both heights (§13.5).
   All of it goes in `CNBKeySignature.marks` and `render`, with tests in
   `cnb/tests/cnb-key-signature-tests.js` and
   `cnb/tests/cnb-config-tests.js`. The tests cover:
   - the window's zigzag on the default and Kite staffs, in sharp and flat
     keys, with the window raised;
   - a one-sided symbol placed by its reference point;
   - every fixture and gallery file, and both of today's styles after
     conversion, drawing exactly as before.
4. Today's panel keeps working on the model: its Draw row sets the
   traditional starting point or the defaults, until session C replaces it.
5. *Engine work:* insert the engine session of §13.10 and its 1.6.0
   release into the engine's plan.

*(Reordered from the consult: Sol advised proving the engine's contract
before the editor is built on it, as session 48 did for the mark table.)*

**Session B: The model reaches LilyPond.**

1. Register.
2. Once the engine session has landed (otherwise the step is blocked):
   the mark table's `at` placement, signs' colours, the `symbol` kind and
   layered marks (§13.10). LY spec 1.3.19 §5.6a, the architecture plan and
   the README are updated. The five export baselines stay byte-identical.
3. The Clairnote SN and DN gallery files take Clairnote's own signatures,
   their tails imported as filled shapes: dots solid on a line or ledger and
   hollow in a space, a tail up for flats and down for sharps, each tail an
   added symbol shallow enough to clear (§13.7). They are checked at
   concert size on an engraved page, as session 50 checked them, since the
   mock-ups' stroked tails are not the proof.
4. An engine round trip holds every symbol's placement, size and colour,
   every stack's ledgers and the ink to the preview's within 0.001 staff
   spaces. It covers the default, Kite 4-369 and both Clairnote files; the
   traditional starting point on the bottom and every line set; C, D and
   B♭ major; an asymmetric head with a reference point; offsets in x and
   y; added symbols of other sizes; a hollow base without ledgers; a
   coloured and moved sign; a pitch axis (the Twinline file); and the seam
   between two line sets' copies. *Engine work:* the engine session of
   §13.10.

**Session C: The editor.**

1. Register.
2. The panel of §13.8:
   - the magnified canvas, with selection, the drags, their snapping and
     the fields;
   - Edit and the look card, with the signs' thumbnails and the selected
     symbol;
   - Import from SVG with its reference point and ledgers;
   - the key picker, the other keys' previews and the list of keys whose
     marks touch;
   - the touch check over the 105 keys (§13.7);
   - Start from.
3. The rows the editor replaces are removed (§13.8). A UAT driver covers
   each drag and choice. *Engine work:* none.

The operator decides where these sessions go: before the UI-stable session
and the 1.1.0 release, which are then renumbered after them, or after
1.1.0. The consult split (§13.12). The decision is recorded in §13.13.

### 13.12 What the consult changed

Sol (`gpt-6.1-sol`) and Argon (`gemini-4-argon`) reviewed the amendment and
its mock-ups on 2026-11-11
([the record](key-signature-editor-consult.md)). Both approved the one
model, keeping symbols in `config.shapes`, the layer order, the window, the
two placements, the column step and an advisory touch check with no
automatic avoidance. From their synthesis:

- **Signs are black unless a look colours them** (§13.2, §13.3), and the
  mark table carries a sign's colour (§13.10). Both found that the editor
  offered coloured signs that the table could not carry.
- **A hollow symbol without ledgers** keeps its cut-out: `symbol` takes a
  cutout as `head` does (§13.10). Both found this.
- **`offset` and `added` are each one field**, replaced whole by a layer
  that sets it (§13.4). Both found this.
- **A click selects the mark's spelling**, or the layer the designer
  picked; the base and each added symbol are selected apart (§13.8). Both
  found "the most specific layer" undefined.
- **The touch check** compares whole marks by their ink, seams included,
  and is a warning that never blocks the export (§13.7).
- **The window** is shared by a copy's marks by its key's family, and the
  upper tonic does not apply under the cycle of fifths (§13.5); an offset
  on a shape with no reference point moves today's placement, and a head's
  ledgers move with it (§13.6).
- **The editor** caps its canvas's height, lists the keys whose marks touch
  with a click to pick each, says that an edit applies to every key, keeps
  one drag as one step of undo, and Start from keeps the picked key
  (§13.8).
- **The program** exports the model before the editor is built (§13.11),
  and its round trip covers the cases Sol listed.

Not taken:

- **One added symbol instead of two** (Argon). The session plan asks for up
  to two.
- **A look's size for signs, with flats and sharps sized apart** (Sol). The
  session plan has resizing a sharp set session 52's size, one size for
  both signs.
- **A copy of the settings an accidentals config was not using** (Sol).
  Nothing reads them.
- **Removing "None" from a sign's colour** (Argon). None is black (§4.6),
  not invisible.

**Before or after 1.1.0** is the operator's, and the two split. Argon would
build it before, so that 1.1.0 does not ship the two styles that the next
release retires, nor the gallery's slashed dots. Sol would release 1.1.0
first, since this changes the model, the importer and the engine's
contract, and is not a finishing touch to a release whose UI is to be
declared stable.

### 13.13 Approval

**Approved by the operator on 2026-11-11**, after reviewing the mock-ups,
the revised amendment and the consult's synthesis: "Design is approved."

The operator's decisions:

- **Sessions A–C come before the 1.1.0 release** (the consult split,
  §13.12): "No one is using this yet; so, no need to worry about
  release-related stuff." The UI-stable session and the 1.1.0 release
  follow them.
- The points kept against one model stand: up to two added symbols, and one
  size for both signs.

The program of §13.11 is numbered in the session plan: session 54 is
session A (the model on the canvas, and the engine's session planned), 55
is session B (the model reaches LilyPond), 56 is session C (the editor), 57
is the UI-stable session and 58 the 1.1.0 release.
