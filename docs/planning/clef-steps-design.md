# The Clef steps, and dropdowns — design

**Session 78, 2026-11-18.** Approved by the operator on 2026-11-18, after
looking at the mock-ups in
[`clef-steps-mockups/`](clef-steps-mockups/index.html); their decisions are
in §5. Session 79 builds it.

## 1. The problem

The operator's try-out (session 77, [`docs/uat-status.md`](../uat-status.md),
rough edges 4–6):

- **Two lists of clefs.** Step 10 offers the built-in clefs as buttons under
  "Choose a clef", then lists them again, with the imported ones, under
  "Clefs". A checkbox turns the clef on.
- **The preview is above the options**, small (the first three columns at
  the canvas's Size), and the main canvas is under both.
- **Nothing marks the anchor.** After an anchor is picked, the bar
  highlighted on the canvas is at the clef's bottom edge: it is the resize
  handle (session 45), and it reads as the anchor.
- **The options are in no order a designer follows**: the size and the
  anchor picker in step 10, where the clef sits in step 11, and "Space
  either side" in step 10. The engine adds that space on the right only
  (LY spec §5.5), and the preview pads both sides, so its clef is not where
  the engraving's is.
- **Rows of buttons and radio buttons** take room where a dropdown would
  do, the key-signature designer's most of all.

## 2. The Clef steps

### 2.1 The layout

Steps 10 and 11 each have **the options on the left and the preview on the
right**. The main canvas is hidden in both, as it is in steps 6–9 (the
`"clef"` canvas joins the hidden ones), so the preview has the room.

**The preview** is the start of the staff: the clef, its gutter and the
first three columns (C, C♯, D), always at the canvas's Large scale (16 px a
semitone), whatever the canvas's Size, which is Medium (11 px) by default,
and as wide as the panel leaves it. It has:

- **the pitch names to the left of the staff**, the canvas's label strip
  (`labelStrip`), one name a semitone, level with the spot it names;
- **the anchor marked**: a small ringed cross on the clef at its anchor
  point, a dashed guide from it to the label strip, and the name of the
  pitch it sits on highlighted there;
- **the resize handle as a corner**: a small square at the bottom right of
  the clef's box, as the key-signature designer's corner handle, in place
  of the bar along its bottom edge;
- **live changes**: every option redraws it at once; a drag on the clef
  moves it (option c) and a drag on the corner resizes it about its anchor,
  each drawn while the pointer moves and reported once, on release, so one
  drag is one step of undo (as in the key-signature designer).

The preview draws at the duration the canvas shows, with no key signature,
as today's partial staff does.

### 2.2 The options, in order

**a. The clef.** One dropdown, **Clef**, and an **Import from SVG…**
button beside it, in place of the checkbox, "Choose a clef", "Import a clef
from SVG" and "Clefs":

| Option | What it writes |
|---|---|
| No clef (the first) | `clef.enabled` false; the clefs stay in the notation |
| Dozenal, Treble, Bass, Alto | the built-in definition, added if missing (`CNBBuiltinClefs.definition`), `active` it, `enabled` true |
| Each imported clef, by its name, under *Imported* | `active` it, `enabled` true |

The clefs have names a designer knows and the preview shows the one chosen,
so a dropdown is enough: their pictures are not needed in the list. Import
adds the clef, chooses it, and opens the anchor picker (b), as today.

**b. Its anchor**, the point of the clef that sits on its pitch. One
dropdown, **Anchor**:

| Option | `reference` (native SVG units) |
|---|---|
| Top | `{ x: box centre, y: viewBoxMinY }` |
| Middle | `{ x: box centre, y: viewBoxMinY + naturalHeight / 2 }` |
| Bottom | `{ x: box centre, y: viewBoxMinY + naturalHeight }` |
| A point on the clef | the point picked: choosing it opens today's picker (the clef enlarged, a click moves the point, Done) |

The dropdown shows the choice the stored point is: Top, Middle or Bottom
when its height is exactly one of those, otherwise *A point on the clef*.
The built-in treble, bass and alto clefs open on *A point on the clef*, the
curl, the dots' middle or the clef's middle on its line, as session 59 set
them; an imported clef on Middle, its box's centre. A clef saved without a
reference reads as Top, which is what it draws.

Under b sits **Height**: semitones, or *Automatic: follows the staff and its
noteheads*, as today. A new height grows or shrinks the clef about its
anchor.

- **The dozenal clef** has no anchor to choose: b says it sits on the middle
  of the staff, and Height stays.
- **A text clef** (a config saved with one; the panel makes none) shows
  Top only, as it draws today.

**c. Where the anchor sits on the staff.** One dropdown, **Sits on**: every
pitch the canvas draws, top to bottom, named as the label strip names it
with its semitone ("G · semitone 19"), and last *A semitone of my own…*,
which shows a number field (decimals allowed). It writes `anchorSemi`
(`CNBClefEditor.withAnchor`). A drag on the clef in the preview does the
same, snapped to the semitone unless the field is open, where it snaps to
tenths. The dropdown shows the pitch when `anchorSemi` is a whole semitone
the canvas draws, otherwise *A semitone of my own*. The dozenal clef shows
"the middle of the staff", fixed.

**d. The space after the clef.** The operator asked for one setting here,
and none before the clef. An engine measurement made for the mock-ups
(engine 1.10.0; treble and dozenal clefs on the default staff, at
`defaultMagnify` 7/4 and 1, `paddingH` 0, 12 and 48 px) found:

- the clef's left edge is **0.75 staff spaces after the staff's start**,
  whatever the gutter;
- the gutter widens the clef's box to the right, and what follows it stays
  where it was: LilyPond spaces the next item from the clef's left edge
  (here the 4/4 time signature, and the first note 6.91 staff spaces after
  the clef's left edge every time), so a gutter shows only once the clef and
  its gutter are wider than that.

A field for the space after the clef would therefore move the preview and
almost never the engraving. **Proposed: no setting.** Step 11 says the space
after the clef is LilyPond's. The preview draws the clef 0.75 staff spaces
after the staff's start, where the engine engraves it, and keeps the stored
`paddingH` after it before the cards (the canvas draws no time signature, so
the cards' spacing is its own, as now). `clef.gutter.paddingH` keeps its
stored value and the export writes it as today, so exports are unchanged;
nothing edits it.

*Decided (§5):* no field. Keeping a **Space after the clef** field (in
semitones, the export's unit, stored in px as today), which LilyPond
absorbs, was the alternative.

The validation line stays under the options.

### 2.3 What the two steps become

The four options split as they do today, by what the designer decides:

- **Step 10, Clef symbol and size** (its id `clef-symbol` kept): a, b and
  Height.
- **Step 11, Clef placement** (`clef-placement` kept): c, and d's line
  saying the space after the clef is LilyPond's. It is available once a
  clef is shown, as today.

Both have the same preview, so the anchor and the clef's place show in each.
The step registry, the step history and the tutorial's numbering are
unchanged.

*Decided (§5):* two steps. The alternative was one step, Clef, with Export
becoming step 11: fewer steps, at the cost of renumbering the registry, the
tutorial and its shots.

### 2.4 What the export writes (LY spec §5.5, §5.5a)

Nothing changes: every choice writes a field the export already reads, as
it reads it.

| Choice | Section B | Section A6 |
|---|---|---|
| No clef | `cnb:clef-style 'none` | — |
| Dozenal | `'dozenal`, `cnb:clef-size-semitones` (Height), the gutter | — |
| Treble, Bass, Alto, an imported clef | `'custom`, `cnb:clef-name`, the gutter | `cnb:register-clef!` |
| Anchor (b), Sits on (c), Height | — | `anchor-semitones`, the top as drawn (`CNBClef.shown`), and `height-semitones`, as §5.5 says |
| The space after the clef (d) | `cnb:clef-gutter-semitones`, `paddingH ÷ pxPerSemi`, the stored value as today | — |

An anchor of Top writes the same top as a clef with no reference. The five
export baselines are byte-identical. What changes is the preview's space
before the clef, which follows the engraving's 0.75 staff spaces; the LY
spec's note that "the left padding has no engine counterpart" (§5.5,
*Gutter*) becomes that the preview, like the engine, puts the clef 0.75
staff spaces after the staff's start and the gutter on its right.

## 3. Dropdowns

A row becomes a dropdown (a `<select>` with the row's label, like the
key picker's) where its options are words and the designer chooses one and
moves on. It may **stay as buttons** where its options are pictures, where
several are picked at once, or where it is a short one-at-a-time choice the
designer flips while watching the canvas, since a dropdown hides the
options it is compared against.

### 3.1 The key-signature designer (step 8)

| Row | Today | Becomes |
|---|---|---|
| **Stacks** (operator) | 5 radios with long labels | **dropdown**: Stacked sevenths · Odd semitones left, even right · A new stack at each change of odd and even · Zigzag at each change of odd and even · Cycle of fifths, one to a column |
| Stacks go | 2 radios | **dropdown**, on the Stacks row: to the right · to the left in sharp keys |
| Heights (cycle of fifths) | 2 radios | **dropdown**, on the Stacks row: In a window around the line set · Climbing with the scale |
| Notes | 3 radios | **dropdown**: The whole scale · The tonic and the half steps · The sharps or flats only |
| Place | 4 radios | **dropdown**: In the middle of the staff · On the bottom line set · On the top line set · On every line set |
| Edit (the layer) | 7 buttons | **dropdown**: All marks · Naturals · Flats · Sharps · On a line or ledger · In a space · Every second stack. A click on a mark picks its layer, as today, and the dropdown follows. |
| Look card: Symbols | Base, Added 1, Added 2, ×, + Add | stays: each is an action or a symbol of the mark |
| Look card: Symbol | thumbnails | stays: pictures |
| Look card: Fill, Colour | 3 short buttons, swatch | stays: flipped while watching the canvas |
| Key and mode | dropdowns | unchanged |

The checkboxes (the upper tonic, the gold stem, sharing its thickness) and
the number fields stay as they are.

### 3.2 The other steps

| Step | Row | Becomes |
|---|---|---|
| 2 Staff | Pattern: 4 presets and Custom, as cards | stays: the patterns are tried against the staff on the canvas |
| 4 Ledger lines | Which ones show: Automatic · My own rules | stays: two, flipped while watching |
| 4 Ledger lines, Advanced | trigger pitch classes, the rules' pitch classes | stays: several picked at once |
| 5 Noteheads | the designs, Duration shows by, The breve | stays: cards with pictures, and two-way choices flipped while watching (session 77 made which is on clear) |
| 5 Noteheads | Shape, Fill, colour swatches | stays: pictures, or two flipped while watching |
| Canvas | Show (Crotchets … All four), Size | stays: flipped while watching |
| 6 Symbol type | the starting points | stays: pictures |
| 7 Custom symbols | Select: All · Naturals · Flats · Sharps · On a line or ledger · In a space | **dropdown**, as step 8's Edit: *Select…* then the six; choosing one selects those notes, and clicking the notes still selects them |
| 10 Clef | the clef buttons and the list | **dropdown** (§2.2 a) |
| 10, 11 Clef | Anchor, Sits on | **dropdowns** (§2.2 b, c) |
| 3 Pitch, Advanced rules | already dropdowns | unchanged |

## 4. What session 79 builds and checks

**The Clef steps.**

- `cnb/ui/clef-editor.js`: the Clef dropdown and Import (a), the Anchor
  dropdown with its picker and Height (b), the Sits on dropdown with its
  field (c) and d's line, drawn by the parts `"symbol"` (a, b, Height) and
  `"placement"` (c, d); "Space either side" goes. Two small pure helpers, tested in
  `cnb/tests/cnb-clef-editor-tests.js`: `anchorChoice(def)` (`"top"`,
  `"middle"`, `"bottom"` or `"point"`) and `withAnchorChoice(clef,
  choice)`, which writes the reference; the pitch list from the staff
  (`pitchOptions(config)`).
- `cnb/ui/preview-display.js` and `cnb/index.html`: the larger preview
  beside the options, with the label strip, the anchor mark and the corner
  handle, its drags; the main canvas hidden in steps 10 and 11; the clef
  drag and the bar handle gone from the main canvas.
- `cnb/src/cnb-clef.js` and `cnb/src/cnb-key-signature.js`: the clef drawn
  0.75 staff spaces after the staff's start, and `paddingH` after it only;
  the key signature's spacing after a clef follows the clef's new left edge.
  An engine round trip (`cnb/tests/cnb-clef-tests.js`, through
  `measureSpacing` in `cnb/tests/engine-probe.js`) holds the clef's left
  edge, and the key signature after it, to the preview within 0.005 staff
  spaces, at `defaultMagnify` 1, 7/4 and 5/2. The export is unchanged: the
  five export baselines stay byte-identical.
- The LY spec's §5.5 *Gutter* note, the architecture plan's Module 21, the
  clef UAT driver, and the tutorial's clef steps, shots and downloads follow.

**The dropdowns.** The rows of §3 marked dropdown, in
`cnb/ui/key-signature-editor.js` (its `radios` helper becoming a `choose`
helper drawing a `<select>`) and step 7's Select, with
`cnb/tests/cnb-key-signature-editor-tests.js` and the UAT drivers following
their selectors. The rows that stay are not touched.

The full UAT runs at the end of session 79.

## 5. Approval

**Approved by the operator on 2026-11-18** after looking at the mock-ups
([`clef-steps-mockups/`](clef-steps-mockups/index.html), its `shots/`):
"Approved. This is much better!" The design was approved as proposed, so
its proposals are the decisions:

- **One Clef dropdown** with Import beside it, the options on the left and
  the preview on the right, the anchor marked and the corner handle (§2.1,
  §2.2).
- **Two steps**, 10 (the clef, its anchor, its height) and 11 (where it
  sits), not one (§2.3).
- **No setting for the space after the clef**: the engraved clef is 0.75
  staff spaces after the staff's start and its gutter moves nothing after
  it, so the preview draws it there and the stored gutter is exported as
  today (§2.2 d).
- **The export unchanged** (§2.4).
- **The dropdowns of §3**, the rows marked to stay left as buttons.
