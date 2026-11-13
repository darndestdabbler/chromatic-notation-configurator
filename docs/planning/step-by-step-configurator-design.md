# The step-by-step Configurator: design

**Date:** 2026-11-13
**Status:** Approved by the operator on 2026-11-13 (session 61; §14). No
code changes. The sessions that build it, 62–69, are planned in §10 and
numbered in the session plan.
**Why:** The operator's try-out in session 57 (`docs/uat-status.md`,
"Trying sessions 43–56", item 5): the key-signature designer is too
complicated, and the Configurator should read as a sequence of steps. The
operator's outline, in their words, is the basis of §1–§3. They also asked
for one notation to be built from start to finish, as a tutorial, a
walk-through that builds it as the stepped UI's golden-path UAT, and a way
for an AI to design one step at a time (session plan, session 61).
**Mock-ups:** [`step-by-step-mockups/`](step-by-step-mockups/), drawn with
the real `cnb/src` modules (§11).

---

## 0. Principles

1. **Each editing step has one primary component** (§1.2), the part of
   the config it writes, which is also the unit a schema describes, a
   partial import replaces and an AI prompt asks for (§9). Several steps
   share a component, and step 9 edits nothing.
2. **The order is suggested, not enforced.** The steps are numbered and
   each has Next and Back, but every available step can be opened at any
   time, since a designer who opens a finished file wants to go straight
   to the step they mean to change (§2).
3. **The config grows as little as it can.** Two fields are added, both
   in the key signature (§3.5); everything else the steps write exists
   today. A config saved before this design loads, previews and exports
   exactly as before.
4. **No engine change.** The mark table (LY spec §5.6a) already carries
   any head or symbol at any column, so the key-signature steps export
   through it.

---

## 1. The steps

### 1.1 The sequence

The operator's sequence, numbered, in groups (§2). The name in bold is the
step's title everywhere: the navigation, the panel's heading, the
walk-through's stage and the tutorial's section (§4).

| # | Step | Group | Edits | The canvas shows |
|---|---|---|---|---|
| 1 | **Notehead height** | The staff | every notehead's height (the rules, as today) | the whole staff |
| 2 | **Staff** | The staff | `staff` | the whole staff |
| 3 | **Pitch** | The staff | `staff.midpoint`, `pitchAxis` (nudges) | the whole staff, its labels draggable |
| 4 | **Ledger lines** | The staff | `ledgers` | the whole staff, the ledger spots marked |
| 5 | **Noteheads** | Noteheads | `shapes`, `noteheadRules`, `durations` | the whole staff; a click opens the notehead panel |
| 6 | **Key signature symbol type** | Key signature | `keys.enabled`, `keys.keySignature` (the starting point) | the 21 spelled notes (§3.2) |
| 7 | **Custom key signature symbols** | Key signature | `keys.keySignature.looks.spelled`, `shapes` | the 21 spelled notes, selectable |
| 8 | **Key signature designer** | Key signature | `keys.keySignature` (stacking, columns, gold stem, place) | the picked key's signature, magnified |
| 9 | **Key signature preview** | Key signature | nothing (a view) | every key and mode (§3.4) |
| 10 | **Clef symbol import and sizing** | Clef | `clef.glyphs`, `clef.active`, `clef.enabled` | the clef, enlarged, with its anchor point |
| 11 | **Clef semitone/staff assignment** | Clef | the active glyph's `anchorSemi` | the whole staff with the clef |
| 12 | **Export** | Finish | `meta` | the whole staff |

**Advanced** stays below the numbered steps, unnumbered, as today: the
rules for particular durations or keys, durations and engine, the pitch
axis map, the pitch range shown, and the file as JSON. The key definitions
("Keys for notehead rules") move there from the key-signature panel,
since they serve notehead rules, not the signature.

Step 7 is available only when the signature uses custom marks (operator:
"only enabled when needed"; the rule is §3.1's). Otherwise it is shown
greyed, with the reason: "Choose Custom marks in step 6 to design your own
symbols." The other availability rules are §2.1's.

### 1.2 The components

The steps fall into five components, the units of §9:

| Component | Config sections | Steps |
|---|---|---|
| `staff` | `staff`, `ledgers`, `pitchAxis` | 2, 3, 4 |
| `noteheads` | `shapes`, `noteheadRules`, `durations` | 1, 5 |
| `keySignature` | `keys` (and the shapes its looks name) | 6, 7, 8 |
| `clef` | `clef` | 10, 11 |
| `meta` | `meta` | 12 |

One step reaches across a boundary, as its result requires: an imported
key-signature symbol is a shape, so step 7 adds it to `shapes`, as the
key-signature editor does today. (Step 3's renaming rewrites the staff
pattern, but `staff` and `pitchAxis` are one component.) Shapes are
therefore always **added by name, never replaced as a section** when they
come with the key signature (§9.2): a name already present with the same
data is left alone, and one present with other data is refused, named, so
an import can never remove a notehead's shape. `display` and `engine`
belong to no step; Advanced edits them.

### 1.3 Where today's panels go

| Today | The stepped UI |
|---|---|
| The seven sections and Advanced, Export | steps 1–5, 12 and Advanced, unchanged inside |
| Key signature: Show and Start from | step 6, Start from gaining Custom marks |
| Key signature: Edit (the layers) and the look card | step 7: the layers become a Select row over the 21 spelled notes (§3.3); the look card stays, applied to the selection |
| Key signature: the canvas, its key picker and the mode's 15 keys | step 8's canvas and key picker; the 15 keys move to step 9, for all 7 modes |
| Key signature: Notes, Stacks, Place, the gold stem | step 8 |
| Key signature: Keys for notehead rules | Advanced |
| Clef: the four buttons, Import, the anchor picker, the height | step 10 |
| Clef: Sits on semitone and the canvas drag | step 11 |

The editors' code stays where it is (`cnb/ui/key-signature-editor.js`,
`cnb/ui/clef-editor.js`); each gains an option naming the part it draws,
so one editor serves two or three steps rather than being split.

---

## 2. The navigation panel

### 2.1 What it looks like

The sidebar lists the steps under their group headings, as the UAT
checklist editor (`darndestdabbler/uat-checklist-editor`) lists areas and
subareas, its steps beneath each heading. The headings do not fold (the
consult): twelve steps fit the sidebar at every supported width, so
folding would hide steps and gain no room. Each step shows its number, its
label and, on the open step, a highlight.

```
THE STAFF
  1  Notehead height
  2  Staff
  3  Pitch
  4  Ledger lines
NOTEHEADS
  5  Noteheads
KEY SIGNATURE
  6  Symbol type
  7  Custom symbols        (greyed unless custom marks)
  8  Designer
  9  Preview
CLEF
 10  Symbol and size
 11  Placement
FINISH
 12  Export
──────────────
     Advanced
```

The sidebar uses short labels inside a group (the group heading supplies
"Key signature" and "Clef"); the step's own heading uses the full title of
§1.1. Both come from the registry (§4).

**Availability**, defined once, in the registry (§4), and nowhere else:

- steps 7, 8 and 9 are unavailable while no key signature is shown (step
  6 turns it on);
- step 7 is also unavailable unless the signature uses custom marks
  (§3.1);
- step 11 is unavailable while no clef is shown (step 10 picks one).

An unavailable step is greyed with its reason and cannot be opened.
These conditions describe what a step can edit; they do not enforce an
order. Every other step is always available.

### 2.2 Numbered, or enabled in order

The operator asked whether the steps should be numbered, or enabled in
turn, to suggest or enforce their order. **Recommendation: number them,
add Next and Back, and enforce nothing** beyond the availability of
§2.1:

- Numbers and Next/Back suggest the order to a first-time designer as
  strongly as a wizard would.
- Every step's result can be changed later, and a designer who opens a
  finished notation, the gallery's included, needs to go straight to step
  8 without passing 1–7. Enforcing the order would stand in their way and
  gain nothing, since no step's controls are invalid before another's.
- Next on the last step of a group opens the next group's first step.
  Next and Back skip an unavailable step (Next on step 6 opens step 8
  when step 7 is greyed, Back on step 8 opens step 6).

Each step's panel has a bar: "← 5. Noteheads" on the left, "7. Custom key
signature symbols →" on the right, the names from the registry. It stays
at the bottom of the window while the panel scrolls (`position: sticky`),
since a long canvas, step 5's at two rows for example, would otherwise
push it far below the controls (the consult).

---

## 3. The key-signature steps

The whole-staff canvas is hidden in steps 6–9 (operator: "The whole-staff
canvas at the top of the page is not needed in these steps"): each step
has its own canvas in its place.

### 3.1 Step 6: Key signature symbol type

"Show a key signature" (today's Show, which sets `keys.enabled` and
`keySignature.enabled`), then three choices, each a card with its picture:

- **Noteheads** — the scale as the notation's noteheads (today's default,
  Start from the noteheads). "Noteheads show in a designer like the
  notehead designer, with entries for flats too": the canvas below draws
  the 21 spelled notes as their noteheads.
- **Accidentals** — LilyPond's sharps and flats (today's Start from
  traditional sharps and flats). "Accidentals appear where sharp and flat
  noteheads would have been, naturals perhaps shown partly dimmed
  elsewhere": the canvas draws a sharp at each sharp, a flat at each flat,
  and the naturals' noteheads at 30% opacity.
- **Custom marks** — "Custom marks start as parallelograms 2 semitones
  high and 4 wide": choosing it writes a parallelogram for each of the 21
  spelled notes (§3.5) and enables step 7.

**The cards are starting points, not a state** (the consult). Each is
today's Start from, given a third starting point: it asks first, and Undo
puts back what it changed.

- **Noteheads** and **Accidentals** do what Start from does today
  (Accidentals sets the altered notes, LilyPond's signs, the cycle of
  fifths and no gold stem, which is what makes the signature traditional).
- **Custom marks** changes only the looks: it writes the 21 parallelograms
  to `looks.spelled` and removes a sign from the flats' and sharps' looks.
  Stacking, columns, the gold stem and the place are kept.

A card is highlighted only when the signature is exactly that starting
point: no look set (Noteheads), or today's traditional settings
(Accidentals). Any other signature, a gallery file's or one built in step
7, highlights none and the step says "Your own symbols". **Step 7 is
available exactly then**: when the signature is shown and is neither
starting point. So a file saved before this design with looks of its own
(sharps, a line or a space) opens with step 7 available, and its edits
there lay spelled looks over the layers it has; nothing it has is lost or
misread. No field records the choice.

### 3.2 The 21 spelled notes

Steps 6 and 7 draw one canvas: the 7 letters across, each in three rows,
flat, natural and sharp (C♭ to B♯, E♯, B♯, C♭ and F♭ included), each mark
drawn with its look at the key signature's size, on its pitch's line or
space of a two-line strip of the staff, so a dot that is solid on a line
and hollow in a space shows that way. A mark's label (C♯, D♭) is beneath
it. The operator noted their spacing "may need tightening, which the
magnified designer allows": the canvas is magnified, 24 px a semitone as
the key-signature editor's is today.

### 3.3 Step 7: Custom key signature symbols

"On a canvas like the notehead canvas, select one or more spelled notes
(multi-select, as for noteheads, but with sharps and flats both) and
replace their parallelograms with imported symbols, tails included."

- **Selecting.** A click selects a spelled note, Shift+click or Ctrl+click
  adds one, as on the notehead canvas. A Select row above the canvas
  selects in one click what today's layers name: All, Naturals, Flats,
  Sharps, On a line or ledger, In a space.
- **The look card** is today's (`cnb/ui/key-signature-editor.js`): the
  symbol (the notation's shapes, the built-in shapes, the parallelogram,
  LilyPond's sharp and flat, or Import from SVG with its reference point
  and Takes ledger lines), fill, colour, size, offset and the added
  symbols, applied to every selected spelled note. A field the selection
  disagrees on shows "mixed".
- **Clairnote** "takes six symbols (a solid and a hollow dot, each plain,
  with a tail up and with a tail down), which keeps the variables to
  support fewer than separate tails would": each spelled note is given one
  of the six as its symbol, the dot solid where its pitch is on a line and
  hollow where it is in a space, the tail up on a flat and down on a sharp.
  The Clairnote SN and DN gallery files are redrawn so (§10, session 64),
  and draw and export as they do now.

### 3.4 Step 8: Key signature designer, and step 9: Key signature preview

**Step 8** is "the stacking, the spacing between columns, and whether the
gold stem between the stacks is drawn, and its style", on today's magnified
canvas with its key picker:

- **Notes** and the upper tonic, as today.
- **Stacks**: the stacking rule, the columns' direction, every second
  stack's look (today's alternate, the one layer that is about stacks),
  and the spacing between columns, `columnGap` (§3.5): a number of
  semitones added between neighbouring columns, negative to tighten them,
  also set by dragging the second column on the canvas.
- **Gold stem**: drawn or not, its colour and thickness, and shared or not,
  as today.
- **Place**: middle, bottom, top or every line set, as today.

**Step 9** draws every key, tonic and mode: the 7 modes as rows, each with
its 15 spellings, sharp keys then flat keys, as small signatures. A key
whose marks touch is outlined with its count, as today, and a click on a
key opens it in step 8. A line above says in how many of the 105 keys the
marks touch.

### 3.5 What the config gains

Two fields, in `keys.keySignature`:

- **`looks.spelled`**: a map from a spelled note (`"C"`, `"C♯"`, `"D♭"` …,
  the 7 letters each natural, sharp and flat, written as
  `CNBMusic.spellings` writes a tonic) to a look of today's form
  (shape or sign, hollow, colour, size, offset, added). It is laid over
  the line and space looks and under `alternate`, so the laying order is:
  the notehead's own, all, natural/flat/sharp, line/space, **spelled**,
  alternate. Missing or empty, nothing changes. `alternate` stays last,
  since it styles every second stack whatever its marks are, and like
  every look it replaces only the fields it sets: an alternate that sets a
  colour keeps each spelled note's symbol, and one that sets a symbol
  replaces it in its stacks, as the designer step shows (no gallery file
  sets one today).
- **`columnGap`**: semitones (axis units under a pitch axis) added between
  neighbouring columns, 0 by default; validation takes a finite number and
  warns when columns would cross.

A built-in shape is added, **`parallelogram`**: 2 semitones high, 4 wide,
leaning right, solid, taking no ledger lines, in `cnb/ui/builtin-shapes.js`
beside the others.

`CNBKeySignature.marks` resolves the new layer and the gap, the mark table
writes what it gives, and the five export baselines are unchanged. No LY
spec section changes: the table's format stays §5.6a's. The architecture
plan's §4.9 gains the two fields.

---

## 4. The step registry

One module, `cnb/ui/steps.js`, lists the steps, and the navigation, the
step panels' Next and Back, the walk-through (§6) and the tutorial (§7)
read it:

```javascript
export const CNBSteps = [
  { id: "notehead-height", number: 1, group: "The staff", label: "Notehead height",
    title: "Notehead height", component: "noteheads", canvas: "staff" },
  { id: "staff", number: 2, group: "The staff", label: "Staff",
    title: "Staff", component: "staff", canvas: "staff" },
  // … one entry per row of §1.1
  { id: "ks-custom-symbols", number: 7, group: "Key signature", label: "Custom symbols",
    title: "Custom key signature symbols", component: "keySignature", canvas: "spelled",
    available: (config) => signatureShown(config) && !isStartingPoint(config),
    unavailable: "Choose Custom marks in step 6 to design your own symbols." },
  // …
];
```

`id` is the panel's `data-panel` and the walk-through's stage name;
`label` is the sidebar's; `title` is the panel heading and the tutorial's
section heading; `component` names §1.2's unit (none for step 9);
`canvas` says what the canvas area shows ("staff", "spelled", "designer",
"keys", "clef"). `available` and its reason are given only where a step
can be greyed (§2.1). The registry is data: its two conditions are small
functions in the same file that read the config, so it imports no editor.
It also gives `next(id, config)` and `back(id, config)`, which the step
bar uses.

**The test that fails on a renamed or reordered step**,
`cnb/tests/cnb-steps-tests.js`:

- the registry's ids are unique and its numbers run 1 to 12 in order;
- `next` and `back` give the expected step for every step, with keys and
  the clef on and off and with each starting point of step 6;
- the navigation built from the registry (in Node, against the stub
  document) lists the steps in its order with its labels and numbers;
- the walk-through's stages (it writes them out, `STAGES`, one handler
  each, and the test reads the list without starting a browser) are the
  registry's ids in its order;
- the tutorial's step sections (its `<h2>` headings, read from the file)
  are "N. title" for every step, in the registry's order.

A step renamed in the registry and not in the tutorial or the walk-through,
or reordered in one of them only, fails it. `STAGES` is written by hand,
not taken from the registry, so it can disagree with it.

---

## 5. The tutorial notation

One notation of the project's own, built from the default config to an
exported `.ly`. Each item is the step that sets it.

1. **Notehead height**: 2 semitones, one staff space of the staff below.
2. **Staff**: lines at 3, 5, 7 and 9 in each octave (E♭, F, G, A), so 2
   semitones a staff space and a gap of 6 semitones from A to the next
   E♭; the middle stays C (12).
3. **Pitch**: no change; the step is shown and its middle confirmed as C.
4. **Ledger lines**: two ledgers in the gap, at B (11) and C♯ (13). B
   takes the B ledger; C♯ takes the C♯ ledger, and C hangs below it. A♯
   and D sit in the spaces beside the staff and take none. Both consult
   replies expect a learner to ask why C does not sit on B's ledger: the
   tutorial's step 4 section shows B, C and C♯ together and says why, in
   this notation's terms (a ledger answers only to notes in its own octave,
   C to B; C begins the next octave, so it takes the C♯ ledger). It is a
   rule of the Configurator's ledgers, not of conventional notation.
5. **Noteheads**: a diamond about 1.5 times as wide as tall (2 semitones
   tall, 3 wide), drawn by the reader in Inkscape and run through the
   Music Glyph Toolkit's Notehead mode with its hollow and stem rects
   (§7.2), imported. C♯, D♯, F♯, G♯ and A♯ red (`#cc0000`), the rest black.
   **Minims as repeated heads first** (the canvas's "Repeat the notehead",
   at the default overlap of a third), **then switched to hollows**: the
   choice set back to each duration's own look, and "Hollow minims" ticked
   beside it (§5.1). The tutorial presents the two as trying one way and
   keeping the other.
6. **Key signature symbol type**: Noteheads.
7. **Custom key signature symbols**: skipped (greyed), except in the
   optional section below.
8. **Key signature designer**: Clairnote's stacks (stacking
   "parity-stacks", a new stack at each change of parity), the gold stem
   drawn. The tutorial credits the design: "Stacked signatures after
   Clairnote, by Paul Morris (clairnote.org), CC BY-SA 4.0; the idea only,
   no code."
9. **Key signature preview**: every key looked at, G major and E♭ major
   picked as examples.
10. **Clef symbol import and sizing**: the operator's own C clef,
    imported from `c-clef.svg` (the operator's `D:\sample-c-clef.svg`,
    checked in with its leftover font style removed, §8), its anchor point
    picked at its left middle (the left edge of its box, half way up), at
    the automatic size.
11. **Clef semitone/staff assignment**: the anchor on middle C, the staff's
    C at semitone 12.
12. **Export**: named "Tutorial 3-5-7-9", file suffix `-Tutorial3579`, the
    `.ly` downloaded.

**Optional section: a custom key-signature symbol.** The reader draws a
second diamond, twice as wide as tall (2 semitones tall, 4 wide, the
parallelogram's size), runs it through the toolkit the same way, chooses
Custom marks in step 6, selects All in step 7 and imports it as the
symbol of every spelled note, then tightens the columns in step 8 with
the column spacing. The walk-through runs this section after the main one
(§6) and exports it as a second file.

### 5.1 Hollow minims on the canvas

Today a hollow minim needs a rule for particular durations, in Advanced.
The tutorial's switch should not send a first-time reader there, so the
canvas gains one control beside the longer-durations choice, shown while
each duration has its own look: **Hollow minims**. It is about the
notation, not a selection (both consult replies warned that a control in
the notehead panel would leave its scope unclear with five noteheads
selected). Ticked, it adds one ordinary rule, the one Advanced would
write (named "Hollow minims", every pitch class, `match.durations:
["minim"]`, `apply.hollow: true`); unticked, it removes that rule. It is
ticked when that rule is present, so it never adds a second; Advanced
shows and edits the rule like any other. Session 63 builds it (§10).

---

## 6. The walk-through

`cnb/uat/uat-tutorial.mjs`, a Playwright driver like the others
(`cnb/uat/app-page.mjs` serves and opens the app), builds §5's notation
from the default config, one stage per registry step, in the registry's
order, and saves a screenshot at the end of each:

- **Stages.** `export const STAGES = ["notehead-height", "staff", …]`, the
  registry's ids (§4's test holds them equal). Each stage opens its step
  from the sidebar, does what §5 says for it through the controls a reader
  uses (typing, clicking, file choosers, the canvas drags), checks the
  result on the page and in the live config, and screenshots the main
  area as `NN-<id>.png`. Step 7's stage checks the step is greyed, with
  its reason. Where a stage does two things, it checks both: step 5's
  repeated heads (two heads a minim) before the switch, and the hollow
  minims after it, each with a screenshot. The last stage's screenshot,
  the finished notation, includes the clef.
- **The optional section** runs as a second pass of stages 6–8 and 12,
  `07-ks-custom-symbols-optional.png` among its shots.
- **Fixtures.** It imports the finished SVGs, `diamond.svg`,
  `diamond-wide.svg` and `c-clef.svg`, checked in as the tutorial's
  downloads (§7.1) and made by following the tutorial (§7.2). It compares
  each exported `.ly` with the checked-in `tutorial.ly` and
  `tutorial-custom.ly`, byte for byte, and the saved config with
  `tutorial.json`, with `meta.created` and `meta.modified` (the only
  fields that change from run to run) left out, so a change that alters
  the tutorial's result fails until the downloads are regenerated on
  purpose. The main notation is saved and compared before the optional
  section starts.
- **Screenshots.** Into a temporary directory by default, so the UAT suite
  leaves the tree as it was; into the tutorial's `shots/` when run with
  `CNB_UAT_TUTORIAL_SHOTS=docs/playbook/tutorial/shots`, which is how the
  tutorial's pictures are refreshed.
- **Its place in the suite.** It is the stepped UI's golden-path UAT and
  runs in `npm run uat` with the others. `uat-golden-path.mjs` stays, for
  the save, load and export parity checks it makes.

---

## 7. The tutorial

### 7.1 Where it lives

One HTML page, `docs/playbook/tutorial/index.html`, with its pictures in
`shots/` and its downloads in `downloads/` beside it. On the site it is
`/tutorial/`: `cnb/site/assemble-site.mjs` copies the folder as it is, so
the links work in both places, and the app's header links to it. The
README and the notation-builder playbook link to it.

It is HTML rather than Markdown because the site has no build step and
nothing on it converts Markdown; one file read in both places needs no
copy kept in step. In the repository it reads as a page opened locally.
Its links are relative, and `uat-site.mjs` checks them on the assembled
site and with the page opened from the repository.

### 7.2 Its sections

- **Before you start**: what the tutorial builds (§5, with the finished
  notation's picture), Inkscape and the Music Glyph Toolkit installed, the
  downloads. A reader who would rather not draw can take the finished
  `diamond.svg` from the downloads and go on at step 1.
- **Drawing the notehead** (the notehead-drawing chapter): start from flat
  ovals for the head and the hollow (a rounded rectangle also serves for
  the hollow); group them, rotate the group, and ungroup it, so the hollow
  keeps its place inside the head; for the diamond, a square and a smaller
  rounded square rotated 45° and stretched to 1.5 times as wide; draw the
  stem rects; run the toolkit's Notehead mode with a semitone height of 2.
  Where the reference point goes: on the head's visual centre, which for a
  symmetric shape like the diamond is its middle, the default, and for a
  lopsided one its centre of mass; it is picked in step 5 after the
  import, and the staff lines stay where they are.
- **One section per step**, headed "N. title" in the registry's order and
  words (§4), each with what the step is for, what to do in it for this
  notation, and the walk-through's screenshot.
- **Optional: a custom key-signature symbol** (§5), with its two
  screenshots.
- **Engraving it**: the exported `.ly` with a short score, through the
  engine, as the README describes.

The tutorial is written in session 68 (§10), after the walk-through has
produced the screenshots and fixtures it shows.

---

## 8. Importing a hand-drawn SVG

A file saved straight from Inkscape does not import where it was drawn.
The operator's clef shows both reasons:

- **Ancestor transforms.** Its paths sit in a layer with
  `transform="translate(-162.76,-166.10)"`. The importer reads a stem
  rect's own transform but no group's or layer's (`cnb/ui/svg-importer.js`
  says so in its header), so the glyph lands far from its viewBox.
- **Path commands.** Its paths use relative commands (`m`, `l`, `h`, `c`)
  and arcs (`a`), which the path conversion skips
  (`CNBNotehead.svgCommands` reads absolute M, L, H, V, C and Z only), so
  the export would draw a fragment of it. The preview, which draws the
  `d` attribute as SVG, would look right, and the engraving would not.

The fix, in the importer and nowhere else: each imported path's `d` is
normalised once, at import, to absolute M, L, C and Z, with the composed
transform of the path and all its ancestors up to the root applied to
every point. What the config stores is then plain absolute geometry, so
the preview, the export, the box and the key signature read it as they
read toolkit output, and nothing downstream changes. A path that is
already absolute M, L, C and Z with no transform on it or its ancestors,
which toolkit output always is, is stored as it is, so every import that
works today imports byte for byte as before.

**What is read** (the consult asked for the subset to be stated):

- **Path commands**: every command of SVG 1.1, relative ones made
  absolute, H and V as lines, S, Q and T as cubics, and each arc as the
  cubics that approximate it within 0.01 units of the **stored**
  coordinates (the tolerance applied after the transforms, so a large
  layer scale cannot magnify it); `z` returns the current point to its
  subpath's start, so a relative `m` after it starts there.
- **Transforms**: `matrix`, `translate`, `scale`, `rotate` (with or
  without a centre), `skewX` and `skewY`, in a list, on the element and on
  every `<g>` (Inkscape's layers among them) up to the root `<svg>`. The
  root's `viewBox` sets the units, as today.
- **Basic shapes**: `rect` (with rounded corners), `circle`, `ellipse`,
  `polygon` and `polyline` are converted to paths, so a reader need not
  run Object to Path first. The toolkit's stem rects stay rects, read as
  today, their transform now composed with their ancestors'; a rotated one
  still anchors at its mapped end.
- **Everything a notehead or clef needs alongside**: the hollow, the stem
  rects and a reference point go through the same transforms as the head.

**What is refused**, with a message naming the element and what to do in
Inkscape: `<text>` (Object to Path), a path drawn only by its stroke
(Stroke to Path), `<use>`, `<image>`, a nested `<svg>`, and `clip-path`,
`mask` or `filter` on a drawn element. Script and external references are
never followed. Fill rules are kept as the path's own (the toolkit's
convention), and a compound path's holes come through unchanged.

This is session 62 (§10), which also checks the operator's clef in as
`docs/playbook/tutorial/downloads/c-clef.svg`, its leftover style
properties removed.

---

## 9. AI-assisted designing

Built at 1.2.0, in the session the plan calls "Published schemas and
partial configs", unless the operator moves it (§12). It rests on the
components of §1.2.

### 9.1 The schemas

One JSON Schema for each component (`staff`, `noteheads`,
`keySignature`, `clef`, `meta`) and one for the whole config, draft
2020-12, versioned with the config (`version` 1.0 → `v1`):
`cnb/schemas/v1/<component>.schema.json` and `config.schema.json`, copied
to the site at `/schemas/v1/…` by `assemble-site.mjs`, so each has a stable
address. A component schema describes an object whose properties are its
config sections (`{ "staff": …, "ledgers": …, "pitchAxis": … }`). Each
schema states the checks a schema can state (types, ranges, enumerations,
required fields); the checks that need the whole config (a rule naming a
shape that does not exist) stay `CNBConfig.validate`'s.
`cnb/tests/cnb-schemas-tests.js` holds the schemas and
`CNBConfig.validate` to the same answer for every fixture, every gallery
config and a set of bad samples, for what both can judge. The schemas are
for the AI and for that test: the browser does not read them, and
`CNBConfig.validate` stays the one judge of a config.

### 9.2 Partial import at a step

Each editing step's panel gains **Import this part…**, beside Next (step
9 has none): a JSON file holding sections of the step's component. A file
may hold some of the component's sections, so the component's schema
requires none of them; the file's shape is checked against it, and then
the whole config after the merge is validated as any opened file is,
which catches what only the whole can (a rule naming a missing shape).
Before anything changes the dialog names the component and says what will
change, section by section ("Staff: staff lines 4, 8 → 3, 5, 7, 9 ·
ledger lines 3 → 2 templates; the pitch axis unchanged"), then on Replace
replaces each named section whole, except `shapes`, which are added by
name (§1.2), and records it all as one step of undo. A file holding
sections of another component is refused, naming them. Open… in the top
bar stays for whole configs (the consult: one place for parts is enough).

### 9.3 A prompt per step

The AI-assisted workflow guide (`docs/playbook/ai-assisted-workflow.md`)
reorganises its Part 3 into one prompt per step, in the registry's order
and words: what to describe, the schema's address to give the AI, and how
to bring the answer back (Import this part… at that step). Today's
templates 3.2–3.6 become steps 2, 4, 5 and 6–11; 3.1, 3.7 and 3.8 stay as
they are. Each step's panel links to its prompt.

### 9.4 The command line

For an agent working in the repository, `node cnb/cli/cnb.mjs`:

- `validate <config.json> [--component <name>]` — `CNBConfig.validate`,
  or the component's schema for a partial file; errors and warnings
  printed, exit 1 on an error.
- `export <config.json> [-o out.ly]` — `CNBLilypond.generate`.
- `render <config.json> -o out.png [--durations crotchet,minim] [--key G]`
  — the card collection drawn in headless Chromium through
  `playwright-core`, so an agent sees what the canvas shows. It reuses the
  UAT's server and Chromium discovery (`cnb/uat/app-page.mjs`) and the
  app's own drawing code: no second renderer. The consult split on it
  (Sol: worth it if it reuses the existing path; Argon: cut it); it stays
  because the session plan asks for render-to-image, and costs one small
  command on what the UAT already has.

Engraving the `.ly` stays the engine's, through the export → render →
diff loop the guide already describes (3.8).

---

## 10. The build sessions

Each session ends with the unit tests (`node cnb/tests/run-tests.js`) and
the whole UAT (`npm run uat`) passing, as every session does.

The consult found the first draft's sessions too big (an importer rewrite
beside an unrelated control; four key-signature steps in one session; the
walk-through and the tutorial together), so each is split along its own
seam, and each session's checks name its acceptance points.

**Session 62: Importing a hand-drawn SVG.** §8 in
`cnb/ui/svg-importer.js`, for noteheads, clefs and key-signature symbols;
the operator's clef checked in as the tutorial's `c-clef.svg`. *Checks:*
`cnb-svg-importer-tests.js` (a translated layer, nested groups with each
transform kind, each command kind, an arc against its sampled points
within the tolerance after a scaling layer, each basic shape, a hollow,
stem rects and a reference point under a group transform, each refused
element named, toolkit output stored byte for byte as before);
`c-clef.svg` imported, its box matching the drawn extent of the file's
transformed paths; the five export baselines unchanged;
`uat-clef-editor.mjs` importing `c-clef.svg` and engraving it where the
canvas draws it.

**Session 63: The steps and the navigation.** `cnb/ui/steps.js` (§4); the
grouped, numbered sidebar built from it; the sticky Next/Back bar; the
availability of §2.1 (step 7 on a condition the session can already
compute from today's looks); the key-signature and clef panels shown as
their steps (§1.3), the canvas area showing what the registry says, and
the whole-staff canvas hidden in steps 6–9; the key definitions moved to
Advanced; "Hollow minims" on the canvas (§5.1). *Checks:*
`cnb-steps-tests.js` (ids, numbers, `next` and `back` under every
availability, the navigation); `cnb-preview-display-tests.js` for Hollow
minims (one rule added, removed, never doubled, undo);
`uat-app-layout.mjs` and the drivers whose sections moved
(`uat-key-signature.mjs`, `uat-clef-editor.mjs`) updated to the steps,
with the steps opened by keyboard and at 1280 px.

**Session 64: The key signature's spelled looks.** §3.5's `looks.spelled`,
`columnGap` and the parallelogram, through `CNBConfig` (defaults,
validation, merge), `CNBKeySignature.marks` and the mark table; the
Clairnote SN and DN gallery files redrawn with the six symbols. *Checks:*
`cnb-key-signature-tests.js` and `cnb-lilypond-tests.js` (the layer's
place in the order, a partial spelled map, enharmonic notes kept apart,
`alternate` over a spelled symbol, the gap, both Clairnote files' mark
tables byte for byte as before, the five baselines unchanged); an engine
round trip of a spelled look and a negative gap, within 0.001 staff
spaces.

**Session 65: Key-signature steps 6 and 7.** The symbol type's three
starting points (§3.1) and the 21 spelled notes (§3.2); step 7's
selection, Select row and look card on a selection, with "mixed" fields
(§3.3). *Checks:* `cnb-key-signature-editor-tests.js` (each starting
point and what it keeps, the highlighted card and step 7's availability
for each gallery file and a file with looks of its own, a selection's
mixed fields, an imported symbol added to `shapes` by name); undo after
each starting point and each import; `uat-key-signature.mjs` rewritten to
the steps, building Clairnote SN's signature in step 7 from its six
symbols, the canvas selected by keyboard as well as by pointer.

**Session 66: Key-signature steps 8 and 9.** The designer's controls,
the column gap with its drag (§3.4), and the preview of every key and mode
with the touch check. *Checks:* `cnb-key-signature-editor-tests.js`;
`uat-key-signature.mjs` (the gap by field and by drag, one step of undo; a
key picked in step 9 opening in step 8).

**Session 67: The walk-through.** The diamonds drawn by the operator in
Inkscape with the toolkit, following a draft of the drawing chapter
(§7.2) written for them at the start of the session, which also tests the
chapter; then checked in as the tutorial's downloads with
`tutorial.json`, `tutorial.ly` and `tutorial-custom.ly`; `uat-tutorial.mjs` (§6) passing, its screenshots
taken into `docs/playbook/tutorial/shots/`. *Checks:*
`cnb-steps-tests.js` (the walk-through's part); `uat-tutorial.mjs`; an
engine render of `tutorial.ly`.

**Session 68: The tutorial.** The page (§7), `assemble-site.mjs` copying
it, the header's link, and the README and playbook pointing to it.
*Checks:* `cnb-steps-tests.js` (the tutorial's part); `uat-site.mjs`
finding `/tutorial/`, its pictures and its downloads, on the site and
opened from the repository.

**Session 69: The UI is stable.** The operator tries sessions 58–68 in
the app and the tutorial, as session 57 did; what they find is fixed or
planned, and they declare the UI stable. Then **the 1.1.0 release**,
numbered after it.

**At 1.2.0: Published schemas and partial configs** — §9, as the session
plan already describes it, with the command line of §9.4 added.

---

## 11. The mock-ups

[`step-by-step-mockups/`](step-by-step-mockups/) draws, with the real
`cnb/src` modules:

- the stepped Configurator at 1440 and 1280 px: the grouped, numbered
  sidebar with step 5 open, Hollow minims beside the longer-durations
  choice, and the Next/Back bar (`shots/steps-1440.png`,
  `shots/steps-1280.png`);
- the key-signature steps: step 6's three choices over the 21 spelled
  notes, step 7 with a selection and the look card, step 8's designer
  with the column gap, step 9's every key and mode
  (`shots/key-signature-steps.png`);
- the tutorial notation: the 3-5-7-9 staff with the diamonds, the red
  black-key pitch classes, a hollow minim row, and the key signature in
  Clairnote's stacks (`shots/tutorial-notation.png`).

---

## 12. Questions for the operator

1. The sidebar's short labels inside a group (§2.1), or the full titles
   throughout? *Short labels (§14).*
2. Numbering with Next and Back and no enforced order (§2.2)? *Yes (§14).*
3. The diamonds: drawn by the operator following the tutorial's chapter,
   or by the orchestrator, writing the SVG and running the toolkit's
   script from the command line? *The operator (§14).*
4. The tutorial as one HTML page in `docs/playbook/tutorial/` (§7.1)?
   *Yes, approved with the design (§14).*
5. AI-assisted designing at 1.2.0, or before the 1.1.0 release? *At 1.2.0
   (§14).*

---

## 13. What the consult changed

One identical brief went to Sol (`gpt-6.1-sol`) and Argon
(`gemini-4-argon`), recorded with both replies and a synthesis in
[`step-by-step-configurator-consult.md`](step-by-step-configurator-consult.md).
Both approved the direction. The design changed as follows:

- **Static group headings** (both): no folding (§2.1).
- **Availability defined once**, in the registry, for steps 7–9 and 11,
  and Next and Back skip an unavailable step (Sol; §2.1, §2.2, §4).
- **A sticky Next/Back bar** (Sol; §2.2).
- **Components as primary ownership**, not one per step; the pitch case is
  not a crossing; **shapes are added by name**, never replaced, so a
  key-signature import cannot remove a notehead's shape (both; §0, §1.2,
  §9.2).
- **Step 6's cards are starting points**, highlighted only when the
  signature is exactly one, and Custom marks changes only the looks; step 7
  is available for any other signature, so a file with looks of its own is
  never misread (Sol; Argon found the inference workable but named the same
  legacy case; §3.1).
- **`alternate` over a spelled symbol** stated and tested (Sol; §3.5).
- **The registry is data**, imports no editor, and its test checks ids,
  numbers and `next`/`back`; the walk-through's stages are written by hand
  (Sol; §4).
- **"Hollow minims" moved to the canvas**, for the whole notation, adding
  and removing one ordinary rule (both; §5.1).
- **C hanging from the C♯ ledger is explained** in the tutorial (both;
  §5); the finished `diamond.svg` lets a reader skip drawing (Sol; §7.2).
- **The walk-through compares the config without its dates**, checks both
  halves of step 5, and saves the main notation before the optional
  section; the tutorial's links are checked on the site and opened locally
  (Sol; §6, §7.1).
- **The SVG subset is stated**: every path command, all transform kinds
  including skew, basic shapes converted, the arc tolerance in stored
  units, hollow, stem rects and reference point transformed together, and
  the elements refused by name; untransformed absolute paths stored as they
  are (both; §8).
- **AI-assisted designing**: no top-bar picker for parts (Argon); a
  partial file's shape checked, then the whole config validated (Sol); the
  schemas kept out of the browser (Sol); render-to-image kept, reusing the
  UAT's server (Sol; Argon would cut it, §9.4 says why it stays).
- **The build sessions split** into 62–69, with acceptance checks for
  legacy files, availability, undo, keyboard use and 1280 px, and the
  operator's try-out before the UI is declared stable (Sol; §10).

---

## 14. Approval

**Approved by the operator on 2026-11-13** (session 61), as revised from
the consult, after reviewing the mock-ups, the design and the consult's
synthesis. Their decisions:

- **The navigation:** short labels in the sidebar under static group
  headings, the full titles as the panels' headings, numbered steps with
  Next and Back, and no enforced order; a step is greyed only by the
  availability of §2.1.
- **The importer's transforms** (and path commands, §8) are session 62,
  the first build session.
- **The tutorial** is written in session 68, as one HTML page in
  `docs/playbook/tutorial/`, after the walk-through of session 67.
- **The diamonds** are drawn by the operator in session 67, following a
  draft of the drawing chapter.
- **AI-assisted designing stays at 1.2.0**, in "Published schemas and
  partial configs", after the 1.1.0 release.
- **The build sessions 62–69 come before the 1.1.0 release**, which is
  numbered after session 69, the operator's try-out in which they declare
  the UI stable.
