# Chromatic Notation Configurator

A browser-based tool for designing custom chromatic music notation systems. The Configurator lets you define staff lines, ledger lines, notehead shapes, colors, and rules — then preview your notation and export it as a LilyPond configuration file.

## What It Does

The Configurator is the design environment where notation creators make creative decisions:

- **Import notehead shapes** from SVGs produced by the Music Glyph Toolkit
- **Assign shapes to pitch classes** with cumulative rules (shape, hollow, color)
- **Configure staff geometry** — any number of lines at any semitone positions
- **Configure ledger lines** — proximity-based and override rules, per-line styling
- **Select color palettes** with automatic colorblind-safe alternatives
- **Preview your notation** as a row of octave-chord cards
- **Export `.ly` config files** that the ChromaticNotationBase engine consumes
- **Save/load configurations** as JSON for iterative design

## Three-Tool Pipeline

The Configurator sits in the middle of a three-tool workflow:

```
Inkscape + Music Glyph Toolkit    (Shape authoring & normalization)
    ↓ produces clean SVG with data- attributes
Chromatic Notation Configurator   (Notation design & rule assignment)  ← YOU ARE HERE
    ↓ reads SVG metadata, user configures rules
.ly config file                   (Generated Scheme code)
    ↓
LilyPond + CNB engine             (Renders music)
    ↓
PDF / SVG / PNG output
```

**Related repositories:**
- [lilypond-chromatic-notation-base](https://github.com/darndestdabbler/lilypond-chromatic-notation-base) — LilyPond engine that renders music from exported config files
- [inkscape-music-glyph-toolkit](https://github.com/darndestdabbler/inkscape-music-glyph-toolkit) — Inkscape extension for authoring notehead shapes

## Getting Started

### Prerequisites

- A desktop web browser — see [Supported browsers](#supported-browsers)
- [Node.js](https://nodejs.org/) 18+ for the unit tests and serving the app locally; 20+ for the
  browser UAT (its `playwright-core` 1.64 needs it)

### Usage

Use the configurator online at
**<https://configurator.darndestdabbler.org/>**. Nothing to install. The
site is updated at each release.

To run it locally, for development: the application is `cnb/index.html`.
It uses ES modules, so serve the repository over HTTP rather than opening
the file directly:

```bash
# from the repository root — either of:
npx serve .
python -m http.server 8000
```

then open `http://localhost:8000/cnb/index.html` (port per your server).
No build step required. Opened from disk (`file://`), the browser blocks
the modules, and the page shows a notice saying so, with a link to the
live site and these commands.

The site is published by `.github/workflows/pages.yml` on each `v*` release
tag. It copies the app with `node cnb/site/assemble-site.mjs <outDir>`
(`index.html`, `src/`, `ui/`, `assets/`; no build).

### Supported browsers

The app is checked in these desktop browsers by the browser UAT
(`cnb/uat/uat-hostile-input.mjs` runs the same checklist in all three; the
other drivers run in Chromium). The Chromium is Playwright's own build
(Chrome for Testing, `chromium-1248`), not an installed Google Chrome:

| Browser | Version checked | Status |
|---|---|---|
| Chromium (Playwright's build) | 156 | Supported |
| Firefox | 157 | Supported |
| Microsoft Edge | 155 | Supported |

Safari and mobile browsers are untested; mobile layouts are not a goal.

## Running the tests and UAT

Two suites, the same two that [`dabbler.yaml`](dabbler.yaml) declares as the
run of record.

**Unit suite (`cnb-unit`)** — every `cnb/tests/*-tests.js` file plus the
gallery gate (`cnb/tests/check-gallery-examples.js`). It needs only Node.js
18+, takes no arguments, and runs whole in about a second:

```bash
node cnb/tests/run-tests.js     # or: npm test
```

**Browser UAT (`cnb-uat`)** — the Playwright drivers under `cnb/uat/` drive
the real app. The root `package.json` declares only dev tooling
(`playwright-core`); the app itself stays dependency-free. The prerequisites
are per machine and the suite does not install them. The drivers need Node.js 20+.
Once per clone:

```bash
npm install                                     # installs the locked playwright-core into node_modules/
npx playwright-core install chromium firefox    # its own installer: the Chromium and Firefox builds it was made for
```

Microsoft Edge is used from its normal installation (Playwright channel
`msedge`). Then:

```bash
npm run uat     # runs every cnb/uat/uat-*.mjs in turn; stops at the first failure
```

Most drivers run in Chromium; `uat-hostile-input.mjs` runs its checklist in
Chromium, Firefox and Edge. A driver whose prerequisites are missing exits 2
naming what is missing. A single driver runs on its own with
`node cnb/uat/uat-<name>.mjs`. `CNB_UAT_CHROMIUM` points the drivers at a
specific Chromium binary, and `CNB_UAT_PLAYWRIGHT` at another directory whose
`node_modules` holds `playwright-core`. Results are recorded in
[`docs/uat-status.md`](docs/uat-status.md).

## End-to-End Walkthrough: From Shape to Rendered Score

This is the full three-tool pipeline in practice — the same path used to
verify the ecosystem's shared release gate (a Configurator-designed system
rendered through the engine, pixel-identical to the engine repo's golden
baseline). This section covers the design half; the render half lives in
the [engine repository's README](https://github.com/darndestdabbler/lilypond-chromatic-notation-base)
— link, don't duplicate.

### 1. Install the Inkscape extension and author a shape

1. Install the [Music Glyph Toolkit](https://github.com/darndestdabbler/inkscape-music-glyph-toolkit):
   copy `music_glyph_toolkit.inx` and `music_glyph_toolkit.py` into your
   Inkscape user extensions folder (Windows:
   `%APPDATA%\inkscape\extensions\`; Mac/Linux:
   `~/.config/inkscape/extensions/`) and restart Inkscape. The tool
   appears under **Extensions → Music Typography → Music Glyph Toolkit…**
2. Draw your notehead (and an optional hollow cutout), convert everything
   to paths (`Ctrl+Shift+C`), and run the toolkit in Notehead mode. It
   normalizes the SVG onto the 100-units-per-semitone grid and bakes in
   the metadata the Configurator reads: `data-semitone-height`, stem
   placemarker rects (attachment anchors), and pre-baked
   `data-lilypond-notehead` / `data-lilypond-hollow` path strings.
   If minims attach their stems elsewhere, draw the optional second pair of
   rects, `stem-minim-up` / `stem-minim-down`; without it, minims use the
   crotchet anchors.

### 2. Import the shape into the Configurator

Open the app (see Usage above) and load your SVG in the **Shape
Importer** panel. The importer extracts the SVG paths, the LilyPond
paths, and the stem anchors, including the minim pair when present
(stored in semitone units; the exporter converts them to staff-space
units at export time). Warnings are shown for shapes missing
`data-lilypond-*` attributes — those fall back to automatic path
conversion at export. A file that is not toolkit output, or not an SVG at
all, is refused with a message saying so, and the configuration is left
unchanged; so is a JSON file that is not a configuration this version can
open.

### 3. Design the notation system

- **Staff/Ledger Rule Editor** — pick a staff pattern (which semitones
  within the octave carry lines, e.g. 4-8 or 3-6-9) and ledger templates.
  The derived panel shows the exact LilyPond geometry the export will
  emit.
- **Common Properties** — durations and representation mode (distinct
  shapes per duration, or repeat-count noteheads).
- **Palette Editor** — pick or author a palette; every palette carries a
  colorblind-safe alternative that the exported file can switch to at
  render time.
- **Notehead Rule Editor** — cumulative, priority-ordered rules assigning
  shape / hollow / color per pitch class.

The preview re-renders live from the same JSON config the export reads.

### 4. Save and export

- **Save JSON** to keep an editable design (load it back any time).
- **Export .ly** produces the LilyPond configuration file (validated
  first; blocking errors are listed in the panel). The export follows
  [CNB-LY-EXPORT-SPEC v1.3](docs/CNB-LY-EXPORT-SPEC-v1_3.md).

### 5. Render it with the engine

In a clone of
[lilypond-chromatic-notation-base](https://github.com/darndestdabbler/lilypond-chromatic-notation-base),
place the exported file next to a score that includes the engine and your
config:

```lilypond
\version "2.24.2"
\include "my-exported-config.ly"   % includes ChromaticNotationBase.ly itself

\score { ... your music ... }
```

then run `lilypond -dbackend=svg my-score.ly` with LilyPond 2.24.x or
2.26.x (the engine supports 2.26 from its 1.1.0; other versions are
untested). See the
engine README for engine installation, options (e.g.
`cnb:use-accessible-colors`), and its test tooling.

### A worked example, checked in

Two reference notations are checked in. Both use the 3-6-9 staff with 3
semitones per staff space, 4-semitone noteheads, a three-colour cycle and
solid and hollow heads in alternation. Any config exports headlessly with
`node cnb/fixtures/export-config.mjs <config.json> [out.ly]`.

**Kite 4-369, the golden one.** This is the system reproduction used for
release-gate verification:

- `cnb/fixtures/kite-4-369-config.json` — the complete design as a
  loadable config
- `cnb/fixtures/export-kite-4-369.mjs` — its export driver
  (`node cnb/fixtures/export-kite-4-369.mjs out.ly`)
- `cnb/fixtures/joy-to-the-world-configurator.ly` — a score rendering the
  engine repo's golden music through the exported config
- `cnb/uat/uat-kite-pipeline.mjs` — browser driver that authors the same
  system through the editors and proves the UI download is byte-identical
  to the headless export

Rendered through the engine, this export passes the engine's golden
assertion suite (74/74) and is pixel-identical to the engine repo's
`joy-to-the-world` golden baseline.

**45deg-369, the reference alternative.** It is gentler than Kite:
ellipses tilted 45°, with stems on the head's vertical centre line at the
edge of the hole, so a stem never crosses the hollow.

- `cnb/fixtures/45deg.svg` — the notehead, with its hollow and stem
  anchors, from the Music Glyph Toolkit
- `cnb/fixtures/45deg-369-config.json` — the complete design as a
  loadable config
- `cnb/fixtures/45deg-369-export-baseline.ly` — its export; tests keep it
  byte-identical
- `cnb/fixtures/joy-to-the-world-45deg.ly` — the same score through this
  export; a test engraves it with the engine (1.2.0 or later) when
  `lilypond` is on `PATH`

## Designing a Notation System

Two operator-facing guides under [`docs/playbook/`](docs/playbook/) cover the
design workflow end to end:

- **[Notation-builder playbook](docs/playbook/notation-builder-playbook.md)** —
  the platform model, what the platform can and cannot express (five
  architectural invariants, with exemplar systems and evidence), how much of the
  published-systems gallery it reproduces, and an executable 12-step build
  walkthrough with a checked-in fixture as the worked example.
- **[AI-assisted workflow guide](docs/playbook/ai-assisted-workflow.md)** —
  where an AI assistant is high-value across that same walkthrough, prompt
  templates for the high-value steps, and the verification/sign-off points that
  keep AI output honest.

## Known limitations

The Configurator reproduces most of the published chromatic-staff gallery, but
not all of it. Its limits are five architectural invariants, set out with
exemplar systems, evidence and redesign paths in
[Part 2 of the notation-builder playbook](docs/playbook/notation-builder-playbook.md#part-2--what-the-platform-can-and-cannot-do).
Four are hard limits:

- **I1 — Horizontal staff orientation.** Pitch runs up the page on a
  horizontal staff; vertically read systems (the Klavar family) are out of
  scope.
- **I3 — Duration lives in the notehead.** Duration is hollow/solid, a
  distinct shape per duration, or a repeat count; duration drawn as the
  horizontal extent of the glyph (Dodeka and other proportional systems) is
  not expressible. Reproduce such systems with traditional durations.
- **I4 — Per-octave staff periodicity.** The staff pattern repeats in every
  octave; a bounded staff whose pattern continues as ledger lines beyond a
  fixed span (Note for Note, the Express Stave family) renders as the
  continuous form.
- **I5 — Absolute pitch anchoring.** Lines and rules mean absolute pitch
  classes; a movable-tonic system (Thumline) needs one config per key.

The fifth, **I2 — one pitch per vertical grid position**, is relaxed: the
optional `pitchAxis` config section maps several pitch classes onto one staff
position, disambiguated by notehead shape or horizontal offset, which brings
the Twinline family within reach. With `pitchAxis` absent or disabled the
Configurator behaves exactly as a one-row-per-semitone staff. The re-tiering
is recorded in
[§9 of the feasibility matrix](docs/research/gallery-survey/feasibility-matrix.md#9-amendment-2026-10-31-set-014-twinline-family-re-tiered),
and the playbook's Part 2 follows it.

### Under a pitch axis

Two engine behaviours apply only when `pitchAxis` is enabled
([export spec §5.4e](docs/CNB-LY-EXPORT-SPEC-v1_3.md)):

- **Collision analysis rounds axis positions to whole numbers**, so on a map
  with fractional positions the collision threshold compares rounded
  positions, not exact ones.
- **Dotted notes in two voices at one axis position lose a dot**: both
  noteheads are drawn, but LilyPond removes the dots of the down-stem head.

### Preview-only settings

One setting changes the preview but not the export, and the export header
says so:

- **The CB-safe toggle.** The export carries both palettes. A score selects
  the colorblind-safe one by setting `cnb:use-accessible-colors` to `#t`
  before `\include`.

Everything else the preview shows is exported, or drawn as the engine
engraves it (session 34, LY export spec 1.3.9):

- **Ledger rules export.** Every notehead the preview draws engraves the
  ledgers the preview draws for it, in-gap ledgers included (§5.7).
- **Notehead rules scoped to a key export.** The engraving applies them in
  the key the score is in (§6.4). Two keys with the same notes, such as C
  major and A minor, cannot be told apart, and validation says so when the
  rules draw them differently.
- **Stems, staff lines and ledgers are the engine's.** The preview draws
  them at LilyPond's sizes: stems 0.13 staff spaces thick and LilyPond's
  length, staff lines 0.1, ledgers 0.2 with rounded ends and 1.5 notehead
  widths long, all black and solid. They have no settings.
- **The key signature's spacing is the engine's**, and has no setting.
- **Repeat counts are fixed.** In repeat mode the preview draws what the
  engine engraves: minim ×2, semibreve ×4 and breve ×4, each head edge to
  edge with the multinote padding (`engine.multinotePadding`, in staff
  spaces) between them.

Configs saved before session 34 still load. Their retired settings (line
thickness, colour and style, line overrides, ledger width and ends, stem
thickness and extension, the signature's gutter, repeat counts) are
ignored.

The clef and the rest of the key signature export (LY export spec 1.3.7
§5.5, §5.6). A config with no clef shown engraves none, rather than the
engine's dozenal clef. A glyph clef is
registered and engraves with its top edge where the preview draws it, and a
text clef engraves in its font, colour and size, but at the engine's own
height rather than at its anchor. A key signature that is off engraves
none. One that is on engraves with its bar's colour, thickness and extent,
and with an explicit tonic octave.

Notehead height and width are not on this list either: they do export. A rule's
size (`apply.heightSemis` / `apply.widthSemis`, in semitones; the rule
editor's Size row) is engraved as a scaled copy of the shape, registered
under a name such as `crotchet-minim-h1p5-w3` (LY export spec 1.3.4
§4.1c). The gallery configs set no size, so they draw every notehead at its
shape's own size.

## Architecture

The Configurator is a set of independent JavaScript modules (ES modules, no
framework, no build step). Rendering modules are pure functions — config and
example data in, DOM nodes out:

### Foundation

| Module | Purpose |
|--------|---------|
| Config Schema | JSON config definition, validation, defaults, notehead rule resolution |
| Music Theory | Pitch class arithmetic, note naming, octave math |
| Pitch Axis | Sole owner of the pitch → staff-position mapping; identity when `pitchAxis` is off |

### Rendering Stack (config in, DOM nodes out)

| Module | Purpose |
|--------|---------|
| Semitone Grid | Coordinate system (pitch ↔ pixel conversion) and debug overlay |
| Staff Line / Staff | Individual and complete staff rendering |
| Ledger Line / Ledger Set | Individual ledger rendering and display rule evaluation |
| Notehead / Double Notehead | Single and octave-pair notehead rendering |
| Stem | Stem rendering with 4-point anchor model |
| Octave Chord Card | Composite card: labels + staff + ledgers + noteheads + stem |
| Card Collection | Row/grid of cards for pitch range, duration, and key |
| Clef | Custom clef glyph in a left gutter, placed on the grid |
| Key Signature | The selected key's signature marks in a staff-start gutter |

### Export

| Module | Purpose |
|--------|---------|
| LilyPond Exporter | Generates the `.ly` file from the JSON config ([CNB-LY-EXPORT-SPEC v1.3](docs/CNB-LY-EXPORT-SPEC-v1_3.md)) |

### UI Components

| Module | Purpose |
|--------|---------|
| SVG Shape Importer | Reads Music Glyph Toolkit SVGs, extracts paths and anchors |
| Palette Editor | Color palette selection with CB-safe toggle |
| Staff/Ledger Rule Editor | Staff pattern and ledger template configuration |
| Notehead Rule Editor | Shape/hollow/color rules by pitch, duration, key |
| Common Properties Editor | Durations, representation mode, engine settings, metadata |
| Clef Editor | Clef enable, glyph import and selection, anchor |
| Key Signature Editor | Key definitions and key-signature settings |
| Pitch Axis Editor | Pitch-axis presets and the pitch-class → position map |
| Config Save/Load | JSON import/export |
| Config Export | Validated LilyPond download |
| Preview Display | Full notation preview with range, duration and key controls |

See [CNB-ARCHITECTURE-PLAN-v2.md](docs/CNB-ARCHITECTURE-PLAN-v2.md) for the complete modular architecture plan.

## Configuration Model

The Configurator's native format is a JSON configuration that defines a complete notation system:

- **Shapes** — Notehead geometries with SVG paths, LilyPond paths, and stem anchors
- **Staff** — Semitone pattern, line styling (thickness as % of semitone height)
- **Pitch Axis** (optional) — Maps pitch classes onto staff positions for compact staves
- **Ledgers** — Templates with proximity and override trigger rules
- **Notehead Rules** — Cumulative rules assigning shape, hollow, color by pitch/duration/key
- **Palette** — Color palette with automatic colorblind-safe alternatives
- **Durations** — Duration definitions and representation mode
- **Keys** — Key definitions and key-signature settings
- **Clef** — Custom clef glyphs
- **Display** — Preview rendering settings (pixels per semitone, label styling)
- **Engine** — LilyPond-specific settings (not used in preview)

The same JSON config drives both the live preview and the LilyPond export.

## Project Structure

```
├── cnb/
│   ├── index.html                   Application entry point
│   ├── src/                         Module source files
│   │   ├── cnb-config.js            Config schema + validation
│   │   ├── cnb-music.js             Music theory utilities
│   │   ├── cnb-pitch-axis.js        Pitch axis (pitch → staff position)
│   │   ├── cnb-grid.js              Semitone grid coordinate system
│   │   ├── cnb-staff-line.js        Staff line renderer
│   │   ├── cnb-staff.js             Complete staff renderer
│   │   ├── cnb-ledger-line.js       Ledger line renderer
│   │   ├── cnb-ledger-set.js        Ledger display rule engine
│   │   ├── cnb-notehead.js          Notehead renderer
│   │   ├── cnb-double-notehead.js   Octave-pair renderer
│   │   ├── cnb-stem.js              Stem renderer
│   │   ├── cnb-card.js              Octave chord card
│   │   ├── cnb-collection.js        Card collection layout
│   │   ├── cnb-clef.js              Clef renderer
│   │   ├── cnb-key-signature.js     Key signature renderer
│   │   └── cnb-lilypond.js          LilyPond exporter
│   ├── ui/                          UI components (editors, importer, config IO, preview)
│   ├── assets/                      Gallery example configs (examples/gallery/*.json)
│   ├── tests/
│   │   ├── run-tests.js             Test runner
│   │   └── cnb-*-tests.js           Per-module test files
│   ├── test-pages/
│   │   └── test-*.html              Visual test pages per module
│   ├── fixtures/                    Release-gate fixtures and export baselines
│   ├── site/assemble-site.mjs       Copies the app into the GitHub Pages site
│   └── uat/                         Browser UAT drivers (Playwright)
├── .github/workflows/pages.yml      Deploys the site on each release tag
├── dabbler.yaml                     Test suites of record
├── version.json                     Product version
└── docs/
    ├── CNB-ARCHITECTURE-PLAN-v2.md
    ├── CNB-LY-EXPORT-SPEC-v1_3.md   Current export spec (v1.2 kept for history)
    ├── playbook/                    Notation-builder and AI-workflow guides
    ├── research/                    Gallery survey and feasibility matrix
    ├── sessions/                    Dabbler session plan and records
    └── session-sets/                Earlier session-set records (history)
```

## Current Status

Version 1.0.1. All rendering, export and UI modules are built and
covered by the unit suite and the browser UAT, and a Configurator-designed
system (Kite 4-369) exported through the UI renders through the engine
pixel-identical to the engine repo's golden baseline. What changed in each
release is in [`CHANGELOG.md`](CHANGELOG.md). The monolithic predecessor the
modules replaced is no longer in the tree; it is preserved at git tag
`legacy-monolith-final`.

Development runs as numbered Dabbler sessions under `docs/sessions/` (the plan
is `docs/sessions/session-plan.md`). `docs/session-sets/`, `docs/batons/` and
`docs/checklists/` are historical records of earlier workflows, kept for
reference.

## License

This work is dedicated to the public domain under the
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
license — see the [`LICENSE`](LICENSE) file for the full legal text. To the
extent possible under law, the author has waived all copyright and related
or neighboring rights to this work.
