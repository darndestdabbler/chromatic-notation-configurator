# Changelog

## 1.1.0

The Configurator is rebuilt around the noteheads as twelve steps, and its
preview draws what the engine engraves. This is also the first release
published on the site.

### Before you upgrade

- **Engrave with engine 1.10.0 or later.** Exports now write engine
  settings that earlier engines do not define, and LilyPond stops on the
  unbound variable. In repeat mode they write `cnb:multinote-overlap`
  (engine 1.7.0) and `cnb:multinote-stem-on-head` (1.9.0). A breve drawn
  as a double notehead or as two tied heads writes `cnb:breve-style`
  (1.10.0). A key signature other than the engine's scale stack needs 1.4.0
  for its mark table, 1.5.0 for sized sharps and flats and 1.6.0 for placed
  or coloured symbols, and the dozenal clef's size needs 1.8.0. Since
  engine 1.5.0 a score engraves at the config's `cnb:default-magnify`.
  Before, a plain score engraved at 7/4 whatever the config said.
- **Regenerate your exports with stems.** 1.0.x wrote stem attachments in
  staff spaces, but LilyPond reads them relative to the notehead's extent,
  so stems engraved too near the notehead's centre (LY export spec 1.3.8).
  A stem's anchor is now the stem's centre, where the SVG's stem rect puts
  it, and the export writes the attachment half a stem outward of it
  (1.3.11). Open the config in 1.1.0 and export it again.
- **Every export changes.** Besides the clef and key-signature lines below,
  every export gains a ledger table, `cnb:ledgers-by-semitone`, with a
  `\layout` block that gives each notehead its pitch's ledgers (1.3.9). The
  header loses its palette and preview-only lines (1.3.10). The colours the
  noteheads use are each registered once, named from their hex, with no
  `cnb:use-accessible-colors` branch, so some colour symbols are renamed:
  Kite 4-369's `skyblue-50b4e9` is now `sky-blue-50b4e9`. The five pinned
  export baselines were regenerated.
- **Ledger lines follow one rule.** A ledger shows for a note only when no
  staff line lies between them. An Automatic ledger shows when the note is
  strictly nearer to it than to any staff line, so a note midway between
  two ledgers takes both. The octave gate is gone, so some notes take
  different ledgers. On the 4-8 and 3-6-9 staffs B now takes the C ledger,
  as C♯ does, and on 3-5-7-9 C takes both the B and the C♯ ledgers. The
  export writes the ledgers the preview draws.
- **Configs saved earlier still load.** A saved palette is moved onto the
  notehead rules (`CNBConfig.paletteToRules`), so the config previews and
  exports the same colours; its colour-blind set is dropped. A saved
  key-signature `style` is converted to the one model
  (`CNBConfig.signatureStyleToModel`): `"accidentals"` becomes the
  traditional sharps and flats. A clef saved before 1.1.0 keeps its top
  where it was. These settings are retired. A config that carries them
  still loads, and none of them is read: `palette`,
  `engine.useAccessibleColors`, `engine.stemThickness`,
  `engine.multinotePadding` (replaced by `durations.repeatOverlap`),
  `display.stemThicknessPct`, `display.stemExtension`, `staff.lineDefaults`,
  `staff.lineOverrides`, `ledgers.lineDefaults`, `ledgers.lineOverrides`,
  `keys.keySignature.gutter`, `keys.keySignature.style` and
  `durations.repeatCounts`.

### Twelve steps, starting from the noteheads

- The page is one screen. A top bar holds New, Open, Save, Undo, Redo, the
  checks, Export for LilyPond and a link to the tutorial. A sidebar lists
  twelve numbered steps: Notehead height, Staff, Pitch, Ledger lines,
  Noteheads, the key signature's Symbol type, Custom symbols, Designer and
  Preview, the clef's Symbol and size and Placement, and Export, with
  Advanced below them. Under them are the canvas and the open step's panel,
  with Back and Next. A step that does not apply yet is greyed, with the
  reason.
- The canvas draws C to C′ at a fixed size, Small, Medium or Large, which
  is kept in the browser and not in the file. It reflows to one or two rows
  of equal columns instead of scaling or scrolling sideways.
- **Noteheads are designed on the noteheads.** Step 1 sets every
  notehead's height at once. Click a notehead to give it a look, or
  Shift+click or Ctrl+click to select several. A look is a colour, solid
  or hollow, a shape (the notation's, a built-in one, or one imported from
  an SVG), a height and width from 0.25 to 4 semitones with the aspect
  ratio kept, and the point of the shape that sits on the pitch. The
  Configurator writes the notehead rules itself and names them in words,
  such as "Hollow on the accidentals". Rules for particular durations or
  keys are kept as they are and edited in Advanced.
- **How the noteheads show duration** is the Noteheads step's first choice:
  conventional noteheads (built in, drawn from Emmentaler), or your own
  notehead with minims and longer hollow, or with repeated heads. With
  hollow noteheads the breve is one head, a double notehead or two tied
  heads. With repeated heads the overlap is a share of the head's width.
  New and a first open start from conventional noteheads. Above the canvas,
  Show picks the duration drawn: crotchets, minims, semibreves, breves or
  all four.
- **Colours are chosen on the noteheads.** There is no palette. The curated
  sets, the colour-blind-safe ones among them, are offered as Suggested
  colours in the notehead panel. A colour-blind version of a notation is a
  second config, saved under another name. A colour field no longer closes
  its picker at each change, and a drag applies the colour once, when it
  ends.
- **Pitch.** The middle of the staff is chosen in the Pitch step or by
  dragging the label strip on the left of the canvas, and a notehead can be
  renamed ("This notehead is: C"). Each pitch class can be nudged up to a
  semitone either way, by its field or by dragging its notehead on the
  canvas, without reordering the notes. The staff spacing may be a decimal,
  so a compact system such as Twinline can be made from nudges.
- Two more staves to start from: 2–4–6–8–10 and 3–5–7–9. The Ledger lines
  step chooses Automatic or your own rules, and a new staff pattern switches
  the default notation's ledgers to Automatic.
- Undo and redo cover every change (Ctrl+Z, and Ctrl+Shift+Z or Ctrl+Y).
  Save and Export open the browser's save dialog where it has one. The
  browser's Back and Forward move between the steps opened, and an address
  with a step's name opens that step. The notation in progress is kept in
  the browser and restored when the page opens again. New starts afresh,
  and New or leaving the page asks first when the notation is not saved.
- An SVG saved from Inkscape imports where it was drawn: transforms,
  relative commands, arcs and basic shapes are read. Text, paths drawn only
  by their stroke, clones, images, nested SVGs, clip paths, masks and
  filters are refused by name, with the Inkscape command that fixes each.
- A tutorial, at `/tutorial/` on the site and linked from the page's top
  bar, builds a notation from start to finish: drawing a diamond notehead
  in Inkscape, each of the twelve steps, an optional custom key-signature
  symbol, and engraving the export.

### The preview draws what the engine engraves

- Stems, staff lines and ledgers are drawn as the engine engraves them,
  measured in staff spaces. Stems are 0.13 thick and LilyPond's length,
  staff lines 0.1, and ledgers 0.2 with round ends, 1.5 times the
  notehead's width. Their style settings are retired, and engine round
  trips hold each to the preview.
- A stem stands where the notehead's SVG puts it, its anchor the stem's
  centre. The default notehead's stems sit on its sides.
- A notehead is placed on its pitch by its shape's reference point,
  vertically. The notehead panel picks the point on the enlarged shape, and
  opens the picker after an import. The export registers a `-ref` variant
  of the shape (1.3.22).
- A notehead's height and width export, as a scaled variant of its shape
  (1.3.4).
- In repeat mode a minim is two heads and a semibreve four, each copy
  overlapping the last by `durations.repeatOverlap`, a share of the head's
  own width (1/3 by default). A breve is two semibreve groups 1 staff space
  apart, tied below from the middle of one group to the middle of the
  other. A minim's stem stands on one of its heads, the last when the stem
  is up and the first when it is down.
- Rules for particular keys export: a notehead's look in a key engraves
  under that `\key` (1.3.9).
- The key signature is spaced as the engine spaces it, with and without a
  clef, at the config's magnification.

### Clefs

- Choose the dozenal clef, LilyPond's treble, bass or alto clef
  (Emmentaler), or a clef imported from an SVG. The dozenal clef exports as
  `cnb:clef-style 'dozenal`, and the others as registered glyphs.
- A clef sits on its pitch by an anchor point: the treble clef's curl, the
  point between the bass clef's dots, the alto clef's middle, or a point
  picked on an imported clef. Its size follows the staff and its noteheads
  automatically, or is set by hand, and it resizes about its anchor
  (1.3.21).
- Steps 10 and 11 hold a Clef dropdown with Import beside it, the Anchor
  and the Height, then Sits on (a pitch of the canvas or a semitone of your
  own). Beside them a larger preview of the clef marks its anchor, and the
  clef is moved and resized there by dragging. The preview draws the clef
  0.75 staff spaces after the staff's start, where the engine engraves it.

### The key-signature designer

- Steps 6–9 design the key signature. Step 6 shows it and starts from
  noteheads (the key's scale as two stacked sevenths, as before),
  traditional sharps and flats, or custom marks. Step 7 gives each of the
  21 spelled notes, C♭ to B♯, its own symbol. Step 8 sets which notes are
  drawn and how they stack: by degree, by odd and even semitones, a new
  stack at each change, zigzag, or the cycle of fifths. It also sets the
  gold stems, the space between stacks, every second stack's look and the
  place (the middle, bottom, top or every line set), on a magnified canvas
  where a symbol is dragged and resized. Step 9 shows every key of the
  seven modes.
- A mark is a notehead, a shape or a sign, with up to two symbols added
  over it, each placed by a reference point and an offset. A symbol
  imported from an SVG takes ledger lines or not.
- Sharps and flats are LilyPond's own, sized to the noteheads
  (automatically, or a height in semitones) and coloured by a look.
- The checks warn when marks touch, saying in how many of the 105 keys,
  and when columns cross.
- Any signature other than the engine's scale stack exports as a mark
  table of 105 keys, the 15 spellings of each of the seven modes (LY export
  spec 1.3.15–1.3.19), and its ledgers are the notation's own. The
  Clairnote SN and DN gallery files draw Clairnote's own signatures.

### The checks speak to a designer

- Each item in the checks list says the problem in a notation designer's
  words and links to what fixes it: **Show the rule** opens Advanced at
  that rule, **Select the notehead** opens the notehead panel for the
  noteheads concerned, and the other links open the step at the control.
- The Export button's tooltip lists blocking errors in the same words.
- The messages the validation produces, and what blocks export, are
  unchanged. A message with no designer wording yet shows as before, with
  no link.

### The clef and the key signature reach LilyPond

- The export now carries the clef and the key signature (LY export spec
  1.3.7, §5.5 and §5.6), so the engraving draws what the preview draws.
- **Every export changes.** A config with no clef shown, the default
  included, writes `cnb:clef-style 'none`. Before, every export engraved
  the engine's dozenal clef, which the preview never drew; a score that
  wants it back sets `cnb:clef-style 'dozenal` after `\include`. A config
  whose key signature is off writes `cnb:keysig-style 'none`, so it no
  longer engraves one from the score's `\key`. The five pinned export
  baselines (default, Kite 4-369, 45deg-369, sized, Twinline) were
  regenerated for this, and nothing else in them changed.
- A glyph clef is registered with `cnb:register-clef!` and shown by name,
  with its top edge where the preview puts it, on a pitch axis too. A text
  clef is written as a label in its font, colour and bold weight, at its
  height. The engine places a text clef at a height of its own, not at its
  anchor. A shown clef's padding is exported as its gutter, on the right
  only.
- With the signature on, the bar's colour, thickness and extent are
  exported, and a bar that is off is written at zero thickness. On a linear
  staff an explicit tonic octave is exported as it is: an engine render
  measured no octave offset.

### The configurator online

- The app is published at <https://configurator.darndestdabbler.org/>,
  deployed by GitHub Pages from each release tag, so the live site is
  always a release. No install and no local server are needed.

### A page that says why it is blank

- Opened from disk (`file://`), the browser blocks the app's modules and the
  panels stay empty. The page now shows a notice at the top saying it must
  be served over HTTP. The notice links to the live site and gives the two
  local commands (`npx serve .` or `python -m http.server 8000`, then open
  `/cnb/index.html`).
- A served page no longer logs a 404 for `/favicon.ico`.

### A second reference notation, 45deg-369

- 45deg-369 is checked in beside Kite 4-369 as the gentler reference
  alternative. It uses the same 3-6-9 staff, with 4-semitone ellipses tilted
  45°, and stems that attach at the edge of the hole so they never cross it.
  The fixture is the notehead SVG, the config, its pinned export and a
  "Joy to the World" score that tests engrave through the engine (1.2.0 or
  later).
- `cnb/fixtures/export-config.mjs <config.json> [out.ly]` exports any
  config headlessly. `export-kite-4-369.mjs` still works and now calls it.

## 1.0.1

**Regenerate your 1.0.0 exports.** A `.ly` file exported by 1.0.0 from a
config with toolkit shapes (pre-baked `data-lilypond-*` paths) or with
fallback paths (shapes converted from their SVG `d` path) has mis-scaled
noteheads. The toolkit paths came out too large by a factor of the staff's
semitones per staff space. The fallback paths came out about 100 × that, and
mirrored. Open the config in 1.0.1 and export it again. Configs whose stored
paths had been divided by hand to compensate must store semitone-unit paths
instead (export spec 1.3.2, §4.1b).

### Security: no imported text can become Scheme

- Every value the exporter writes goes through an emitter for its kind:
  comment text, Scheme strings, symbols, numbers, versions and path data.
  A shared config or SVG can no longer put executable Scheme into the `.ly`.
- Validation rejects every value the emitters would reject, so an invalid
  config never reaches export.
- Shape names whose identifiers collide, or come out empty, are a
  validation error. They no longer overwrite each other silently.

### Path data in the units the engine reads

- Toolkit paths and the fallback conversion share one conversion into
  staff-space units (export spec 1.3.2).
- The Kite fixture's shapes are rebuilt by importing its SVGs, and the
  Twinline fixture's paths come from the corrected fallback. The export
  baselines were regenerated from them. Engine-backed tests check that
  every gallery export engraves its noteheads at the size the preview
  draws them.
- The importer reads the toolkit's `data-lilypond-glyph` for clefs, with
  every path. When an SVG carries both modes' attributes, it prefers the
  one matching the import target and warns. It applies a stem rect's
  `transform` before reading anchors.

### Export only what the engine engraves

- The export no longer emits `cnb:stem-thickness`, which the engine does
  not define and which stopped LilyPond. It also stops emitting the staff
  line colour and thickness, which the engine ignored (export spec 1.3.3).
- Staff line colour and thickness, ledger rules, stem thickness, repeat
  counts, the CB-safe toggle and key-scoped notehead rules are marked
  preview-only. The controls say so, the export header lists them, and so
  does README "Known limitations". Validation warns about each key-scoped
  rule by name.
- The header names a palette only when the export carries its colors.

### Fixes

- Editing the staff, even its colour, no longer resets `staff.midpoint`
  or the semitones per staff space of a loaded config. Before this fix it
  shifted a pitch-axis export.
- The staff editor's "derived LilyPond geometry" panel shows the axis
  geometry the export emits.
- The test runner fails a test file that exports no tests, and the
  numeric test helpers fail on NaN.

### Documentation and archive

- The `legacy-monolith-final` tag, which holds the monolithic predecessor,
  is now on the remote.
- The README describes `cnb/assets/` as the gallery example configs.
- The release archive leaves out editor settings, AI-engine instructions
  and the session records (`.gitattributes`).

## 1.0.0 — 2026-11-01

The first release of the modular Configurator, rebuilt from the monolithic
predecessor (kept at git tag `legacy-monolith-final`).

- Rendering modules (config in, DOM out): semitone grid, staff and ledger
  lines, noteheads, stems, octave-chord cards and the card collection,
  custom clefs, key signatures, and the optional pitch axis for compact
  staves.
- The LilyPond exporter, following export spec v1.3.
- Editors for shapes (SVG import), palettes, staff and ledger rules,
  notehead rules, common properties, clefs, key signatures and the pitch
  axis, plus JSON save and load and the preview display.
- The unit suite (`node cnb/tests/run-tests.js`) and the Playwright browser
  UAT (`npm run uat`) in Chromium, Firefox and Edge.
- The Kite 4-369 system, designed through the UI and exported, renders
  through the engine pixel-identical to the engine's golden baseline.
