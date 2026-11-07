# Changelog

## 1.0.2

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

### The preview shows repeat mode

- In repeat mode the preview now draws what the engine engraves: a minim as
  two heads, a semibreve and a breve as four, spaced by the multinote
  padding, with the stem and ledgers following. Changing the multinote
  padding changes the preview. A test engraves the Kite and 45deg-369
  fixtures and checks that the preview's spacing matches.
- The repeat-count inputs say they are not used: the engine's counts are
  fixed.
- With keys and the key signature enabled, the key-signature panel and the
  preview's key selector say when no key is defined or none is selected, so
  no signature draws.

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
