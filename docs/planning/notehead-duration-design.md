# How noteheads show duration: design

**Session 74, 2026-11-17.** Status: approved by the operator, 2026-11-17
(§10, §12). Mock-ups: [`notehead-duration-mockups/`](notehead-duration-mockups/).
The engine's brief for B.i's breve:
[`shape-mode-breve-brief.md`](shape-mode-breve-brief.md).

## 0. The problem

The operator's try-out of session 73 ([`docs/uat-status.md`](../uat-status.md),
rough edges 1 and 2):

1. **The notehead panel changes every duration.** With only minims shown,
   the operator made noteheads hollow and the crotchets changed too. The
   panel edits one look a pitch class for every duration (the look table,
   `cnb/ui/notehead-inference.js`), and the duration buttons above the canvas
   only choose which rows are drawn. Nothing on the page says so.
2. **The Hollow minims rule went missing.** The tick re-seeds the Advanced
   rule editor but not the pitch-axis editor, which can write the rules back
   without it.

The operator's answer is a simpler model with very few options
(2026-11-16). In it no notehead has a look of its own for one duration, so
the panel can never surprise the designer. The duration is shown by the
design, not by rules the designer edits.

## 1. The three designs

| | A. Conventional noteheads | B.i. Hollows | B.ii. Repeated heads |
|---|---|---|---|
| Varies by pitch | colour | shape, colour, size | shape, colour, fill, size |
| Crotchet | conventional, solid, stem | the head, solid, stem | the head, stem |
| Minim | conventional, hollow, stem | the head, hollow, stem | 2 heads, stem |
| Semibreve | conventional | the head, hollow | 4 heads |
| Breve | conventional | 2 hollow heads, the designer's choice: a double notehead or two tied semibreves | two tied groups of 4 |
| Height | the designer's, one for all | per pitch, as today | per pitch, as today |
| Engine | as it is | the new breve (§6.3) | as it is (engine 1.9.0) |

- **A** is the notation every musician reads, with only the colour varying
  by pitch: the crotchet, minim, semibreve and breve as LilyPond draws
  them (§5), at the height the designer sets.
- **B.i** suits a notation whose crotchets are always solid: fill shows
  duration, so the designer gives a pitch its shape and colour but not its
  fill.
- **B.ii** suits a notation whose fill shows pitch (the Kite 4-369 and
  45deg-369 fixtures): the pitch alone gives the notehead, the same for every
  duration, and the number of heads shows duration. It is today's repeat
  mode.

**B.i's breve.** A *double notehead* is two copies of the hollow head side
by side, overlapping as a repeated minim's two heads do. *Two tied
semibreves* are two hollow heads 1 staff space apart, tied from the middle
of the first to the middle of the second, below them, as today's
repeat-mode breve ties its two groups. Both are drawn in the mock-ups
(`shots/breves.png`).

## 2. The Noteheads step

Step 5 opens with the choice of design, as step 6 opens with its starting
points:

```
 How should the noteheads show duration?

 ┌ Conventional noteheads ┐ ┌ Your own notehead ─────────────────────────┐
 │ ♩ 𝅗𝅥 𝅝 𝅜              │ │ Duration shows by:                        │
 │ Only the colour varies │ │ ( Hollows )  ( Repeated heads )           │
 │ by pitch               │ │  Breve: (Double notehead) (Two tied semibreves) │
 └────────────────────────┘ └───────────────────────────────────────────┘
```

- **Two cards**, Conventional noteheads and Your own notehead, each with a
  small drawing of its crotchet, minim, semibreve and breve in the
  notation's own heads. The card the notation is is highlighted.
- **Under Your own notehead**, the way duration shows: Hollows or Repeated
  heads. Under Hollows, the breve: Double notehead or Two tied semibreves
  (two tied semibreves first, §9). Under Repeated heads, the Overlap field,
  moved here from above the canvas.
- **Picking a design changes the notation** (`withDesign`, §6.2), once
  confirmed when it would replace something: "Conventional noteheads keep
  each notehead's colour and replace its shape and fill. Change?"
- **A notation that fits none** (§7) has neither card highlighted, and the
  step says, as step 6 says "Your own symbols":

  > **Your own noteheads.** These noteheads show duration in their own way.
  > Each notehead's look below is the same for every duration; rules for
  > particular durations are in Advanced › Notehead rules. Pick a design to
  > use one instead.

The notehead panel and the canvas follow beneath, as today.

## 3. The notehead panel under each

The panel keeps its columns (the close-up head, the look, the nudge) and
offers only what the design lets vary by pitch:

| Row | A | B.i | B.ii | Your own |
|---|---|---|---|---|
| Colour | yes | yes | yes | yes |
| Fill | — | — | yes | yes |
| Shape (with Import from SVG and the point on the pitch) | — | yes | yes | yes |
| Size | one height, for every notehead | yes | yes | yes |

- **Under A** the panel has the colour and one Height field, which is step
  1's notehead height: it sets every notehead's height, the four
  conventional heads keeping their proportions to each other (§5). The
  close-up head is the conventional crotchet.
- **The close-up head** is drawn at the duration the canvas shows, or the
  crotchet when it shows all four, so a designer who shows minims sees a
  minim.
- **The marker for rules for particular durations** (§5.5 of the
  notehead-first design) can only appear under Your own; in the three
  designs no such rule is the designer's.

## 4. Above the canvas

- **The duration buttons become one choice, Show**: Crotchets, Minims,
  Semibreves, Breves or All four. One button is on at a time (the
  operator's first ask, session 73); All four draws a row a duration. The
  crotchets are shown first, as today. Showing is all it does, and in the
  three designs that is the whole truth: no edit is for one duration.
- **The Shape or Repeat choice goes**: it is the design's (§2).
- **The Hollow minims tick goes**: B.i writes its hollows (§6.1), and A's
  minims are the conventional minim. A notation that has a Hollow minims
  rule keeps it, and opens as Your own unless it fits a design.
- **The Overlap field moves** into the step, under Repeated heads, and
  under Hollows when the breve is a double notehead (it is the same
  overlap, §6.3).
- The pitch range, the key picker and the size stay as they are.

## 5. The conventional noteheads

**The app needs them, and they are the operator's SVGs** (drawn
2026-11-17 with the toolkit from LilyPond's Emmentaler glyphs, SIL OFL 1.1,
whose licence is already in `cnb/assets/fonts/OFL-Emmentaler.txt`; the OFL
allows the outlines to be copied and modified with the licence kept and
the name "Emmentaler" not given to them):

| File (on the operator's `D:\`) | Built-in shape | Used for |
|---|---|---|
| `crotchet-and-minim.svg` | the conventional head, with its hollow and stems | the crotchet (solid) and the minim (hollow) |
| `semibreve.svg` | the conventional semibreve, with its hollow | the semibreve |
| `breve-with-bars-01.svg` | the semibreve's head with the paths `breve-bar-left` and `breve-bar-right` | the breve: **single bars**, Emmentaler's `noteheads.sM1` |

Session 75 checks them in under `cnb/assets/shapes/conventional/` and makes
each a built-in shape in `cnb/ui/builtin-shapes.js`: its notehead the
shape's path (the breve's with its two bar paths joined to it), its hole
the hollow cutout, its stem rects the stem anchors. So the notehead model
needs nothing new, and the export registers them as any shape.

**The breve's height is its head's.** The toolkit sizes a glyph by its
whole height, so a breve drawn with its bars came out with its head about
1.54 semitones tall against the semibreve's 2 (`breve.svg`). The workaround
is the operator's: the semibreve sized by the toolkit, the bars added
afterwards as labelled paths reaching past the page (`breve-with-bars-01.svg`,
its viewBox the head's; `-02`, whose page was enlarged to the bars, moves
the origin and is not used). The head is then 2 semitones and the bars
about 2.61, LilyPond's proportion (360 to 272 font units). The file also
holds `double-breve-bar-left` and `-right`, the double-barred breve, not
used now. Labelled bars in the toolkit itself are a follow-up (§11).

The height the designer sets is the crotchet's; the semibreve and breve
keep their proportions to it (the semibreve wider, the breve's bars
taller).

The mock-ups draw Emmentaler's outlines read from the font, which these
files were drawn from; the built-ins are the operator's drawings.

## 6. How the choice is stored and exported

### 6.1 No design field: the rules and the mode say it

The design is read from the notation, as step 6's starting point is
(`CNBStepNav.startingPoint`). A new pure function, `designOf(config)` in
`cnb/ui/notehead-inference.js`, returns `"conventional"`, `"hollows"`,
`"repeated"` or `null` (your own):

- **Conventional**: shape mode; the notehead rules that match every key are
  a Default giving the conventional head, solid, at one height; one rule
  each for minims (hollow), semibreves and breves (the conventional
  semibreve and breve, hollow); and colour rules by pitch. No rule sets a
  shape, fill or size by pitch.
- **Hollows**: shape mode; every rule matching every duration sets no fill
  but the Default's solid; one rule, *Hollow minims and longer*, matches
  minims, semibreves and breves and sets `hollow: true` and nothing else;
  and `durations.breveStyle` is `"double"` or `"tied"`.
- **Repeated heads**: repeat mode, and every rule matches every duration.
- Anything else is your own. Rules that name keys (§6.4 of the LY spec) are
  set aside before the test and kept by every change.

`withDesign(config, design, breveStyle?)` writes a design, keeping what it
can of the look table: A keeps the colours and the height; B.i keeps each
pitch's shape, colour and size and drops its fill; B.ii keeps the whole
look table. Each replaces the rules for particular durations with its own.

### 6.2 The config

- `durations.representationMode`: `"shape"` under A and B.i, `"repeat"`
  under B.ii, as today.
- `durations.repeatOverlap`: B.ii's overlap, and the double breve's, as
  today.
- **`durations.breveStyle`**, new: `"double"` or `"tied"`, B.i's breve; left
  out, a breve in shape mode is one head, as today. It is read in shape mode
  only: repeat mode's breve stays two tied groups of four. Validation:
  absent, `"single"`, `"double"` or `"tied"`.
- The rules are ordinary rules, so the Advanced rule editor shows and edits
  them, and an edit there that breaks a design leaves the notation as your
  own.

### 6.3 The export

- A and B.ii export as today: A's noteheads are registered shapes chosen by
  ordinary rules for particular durations, B.ii is repeat mode.
- B.i's hollows are an ordinary rule. Its breve needs the engine: in shape
  mode the engine draws a breve as one head. The brief
  ([`shape-mode-breve-brief.md`](shape-mode-breve-brief.md)) asks for
  `cnb:breve-style`, `'single` by default, `'double` or `'tied`, an engine
  minor release. Section B writes `#(set! cnb:breve-style 'tied)` (or
  `'double`) when `breveStyle` is set and the mode is shape, and with
  `'double` also `cnb:multinote-overlap`. Nothing else changes, so every
  export without the setting is byte-identical.

## 7. A saved notation that fits none

It opens as **your own noteheads** (§2): its rules kept as they are, the
panel offering everything it offers today, the canvas drawing it as today.
Nothing is converted on load. Picking a design converts it, once confirmed.

- **The default config** (`CNBConfig.createDefault`, sharps hollow, shape
  mode, minims solid like crotchets) fits none. So that a new notation opens
  on a design, **New and the page's first open start from A**: the default
  config with `withDesign(…, "conventional")`. `createDefault` itself, the
  fixtures and the baselines built from it stay as they are.
- **Every gallery file** fits none: all eighteen are in shape mode with no
  rule for particular durations, so their minims look like their crotchets.
  Those that vary fill by pitch: `axlomafi`, `chromatic-lyre-notation`,
  `clairnote-dn`, `express-stave-jazz-6-6`, `express-stave-original`,
  `express-stave-pianoforte`, `hass-notation-3-line`, `schoenberg-untitled`,
  `trilinear-notation`, `twinline-compact`. The others (`0-5-7-notation`,
  `6-6-trigram-notation`, `ambros-system`, `avique-notation`, `clairnote-sn`,
  `lautus-notation`, `notagraph`, `numbered-notes-notes-only`) are solid
  everywhere. They are kept as they are: each is a published notation's
  noteheads, not a design of ours.
- **The Kite 4-369 and 45deg-369 fixtures** are repeated heads (B.ii).
- **The tutorial's notation** (`docs/playbook/tutorial/downloads/tutorial.json`)
  has Hollow minims but solid semibreves, so it fits none; session 75 makes
  it B.i, and its step 5 says so.
- **The operator's `tutorial-3-5-7-9.cnb.json`** (session 73) has no Hollow
  minims rule: it opens as your own, and picking Hollows makes it B.i.

## 8. The sessions that build it

**Session 75: the notehead design, built.**

1. `designOf` and `withDesign` in `cnb/ui/notehead-inference.js`, and the
   three conventional shapes from the operator's SVGs (§5) in
   `cnb/ui/builtin-shapes.js`, the SVGs under
   `cnb/assets/shapes/conventional/`, with their tests
   (`cnb-notehead-inference-tests.js`, `cnb-builtin-shapes-tests.js`:
   every design written by `withDesign` is the one `designOf` reads; each
   gallery file and the default config read as your own; the fixtures as
   repeated heads; each head 2 semitones tall at its own size, the breve's
   bars taller, and the conventional head's stem anchors its stem rects').
2. `durations.breveStyle` validated (`cnb-config-tests.js`), and not yet
   drawn or exported: a B.i notation previews and exports its breve as one
   hollow head until session 76, and the step says so.
3. The Noteheads step's cards, the panel's rows by design, the Show choice;
   the Shape or Repeat choice and the Hollow minims tick removed
   (`cnb-notehead-panel-tests.js`, `cnb-preview-display-tests.js`, the
   page). New and the first open start from A.
4. Every editor that keeps a copy of the notehead rules is re-seeded after
   any change to them (rough edge 2), with a test that a pitch-axis preset
   applied after a design keeps its rules.
5. The UAT (`uat-notehead-panel.mjs`, `uat-golden-path.mjs`,
   `uat-tutorial.mjs`), the tutorial's step 5, its downloads and shots, the
   architecture plan and the README follow. Checks: `node
   cnb/tests/run-tests.js`; the changed UAT drivers.

**The engine session** (after session 74, before 76), from the brief: the
engine's `cnb:breve-style`, released as an engine minor version.

**Session 76: B.i's breve reaches LilyPond.**

1. The preview draws a shape-mode breve as `breveStyle` says
   (`CNBCard.repeatLayout`, `CNBCard.tiedGroups`), and the export writes
   `cnb:breve-style` (`cnb-card-tests.js`, `cnb-lilypond-tests.js`).
2. An engine round trip holds every card's breve, double and tied, its
   width, height and tie, to the preview within 0.001 staff spaces on the
   default notehead and the tutorial's diamond. LY spec 1.3.24 (§4.1d).
   Checks: `node cnb/tests/run-tests.js` with the engine.

## 9. The mock-ups

[`notehead-duration-mockups/`](notehead-duration-mockups/), drawn with the
real `cnb/src` modules: `shots/step.png` (the step opening, the cards and
the choices under Your own notehead), `shots/designs.png` (the panel and
the controls above the canvas under A, B.i and B.ii, each with its four
durations), `shots/breves.png` (B.i's two breves on the default notehead
and the tutorial's diamond) and `shots/own-noteheads.png` (Clairnote DN
opening as your own noteheads). The conventional noteheads in them are
Emmentaler's, read from LilyPond 2.24's `emmentaler-20.otf`.

## 10. The operator's decisions (2026-11-17)

1. **The conventional noteheads** are the operator's SVGs, drawn from
   Emmentaler (the OFL allows it), built in (§5): `crotchet-and-minim.svg`,
   `semibreve.svg` and `breve-with-bars-01.svg`.
2. **The conventional breve** has single bars (Emmentaler's `sM1`), not
   double.
3. **B.i's breve** is as drawn: the double notehead two hollow heads
   overlapping as a repeated minim's; two tied semibreves listed first and
   picked when Hollows is.
4. **The Show choice** is one of Crotchets, Minims, Semibreves, Breves or
   All four, crotchets on when the page opens.
5. **New and the page's first open** start from conventional noteheads;
   `createDefault` and its baselines stay; **the gallery files** stay as
   they are, opening as their own noteheads.

## 11. Follow-up: labelled bars in the toolkit

The music-glyph-toolkit sizes a glyph by its whole height, so a breve's
bars, not its head, take the semitone height. The operator's workaround
(§5) serves the built-in breve. The toolkit and the importer
(`cnb/ui/svg-importer.js`) labelling the bars, the height read from the
head, are a follow-up outside sessions 75 and 76, since none of the three
designs imports a breve glyph.

## 12. Approval

**Approved by the operator, 2026-11-17**, with the decisions of §10, after
looking at the mock-ups (`notehead-duration-mockups/shots/`) and the brief
([`shape-mode-breve-brief.md`](shape-mode-breve-brief.md)).
