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
- [Node.js](https://nodejs.org/) 18+ (for running tests and serving the app locally)

### Usage

The application is `cnb/index.html`. It uses ES modules, so serve the
repository over HTTP rather than opening the file directly:

```bash
# from the repository root — either of:
npx serve .
python -m http.server 8000
```

then open `http://localhost:8000/cnb/index.html` (port per your server).
No build step required.

### Supported browsers

The app is checked in these desktop browsers by the browser UAT
(`cnb/uat/uat-hostile-input.mjs` runs the same checklist in all three; the
other drivers run in Chromium):

| Browser | Version checked | Status |
|---|---|---|
| Chromium / Chrome | 156 | Supported |
| Firefox | 157 | Supported |
| Microsoft Edge | 155 | Supported |

Safari and mobile browsers are untested; mobile layouts are not a goal.

### Running Tests

```bash
npm test            # same as: node cnb/tests/run-tests.js (no install needed)
```

### Running the Browser UAT

The Playwright drivers under `cnb/uat/` drive the real app in Chromium. The
root `package.json` declares only dev tooling (`playwright-core`); the app
itself stays dependency-free. Once per clone:

```bash
npm install                                # installs playwright-core into node_modules/
npx playwright install chromium firefox    # downloads the matching Chromium and Firefox builds
```

Edge is used from its normal installation (Playwright channel `msedge`).
Then:

```bash
npm run uat     # runs every cnb/uat/uat-*.mjs in turn; stops at the first failure
```

A single driver runs on its own with `node cnb/uat/uat-<name>.mjs`.
`CNB_UAT_CHROMIUM` points the drivers at a specific Chromium binary, and
`CNB_UAT_PLAYWRIGHT` at another directory whose `node_modules` holds
`playwright-core`. Results are recorded in
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
  [CNB-LY-EXPORT-SPEC](docs/CNB-LY-EXPORT-SPEC-v1_2.md).

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

then run `lilypond -dbackend=svg my-score.ly` (LilyPond 2.24+). See the
engine README for engine installation, options (e.g.
`cnb:use-accessible-colors`), and its test tooling.

### A worked example, checked in

The Kite 4-369 system reproduction used for release-gate verification is
in this repo:

- `cnb/fixtures/kite-4-369-config.json` — the complete design as a
  loadable config
- `cnb/fixtures/export-kite-4-369.mjs` — headless export driver
  (`node cnb/fixtures/export-kite-4-369.mjs out.ly`)
- `cnb/fixtures/joy-to-the-world-configurator.ly` — a score rendering the
  engine repo's golden music through the exported config
- `cnb/uat/uat-kite-pipeline.mjs` — browser driver that authors the same
  system through the editors and proves the UI download is byte-identical
  to the headless export

Rendered through the engine, this export passes the engine's golden
assertion suite (74/74) and is pixel-identical to the engine repo's
`joy-to-the-world` golden baseline.

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

## Architecture

The Configurator is being rebuilt from a monolithic HTML file into a modular architecture. The new design separates concerns into independent JavaScript modules:

### Rendering Stack (config in, DOM nodes out)

| Module | Purpose |
|--------|---------|
| Config Schema | JSON config definition, validation, defaults |
| Music Theory | Pitch class arithmetic, note naming, octave math |
| Semitone Grid | Coordinate system (semitone ↔ pixel conversion) |
| Staff Line / Staff | Individual and complete staff rendering |
| Ledger Line / Ledger Set | Individual ledger rendering and display rule evaluation |
| Notehead / Double Notehead | Single and octave-pair notehead rendering |
| Stem | Stem rendering with 4-point anchor model |
| Octave Chord Card | Composite card: labels + staff + ledgers + noteheads + stem |
| Card Collection | Row/grid of cards for pitch range, duration, and key |

### Export

| Module | Purpose |
|--------|---------|
| LilyPond Exporter | Generates `.ly` file from JSON config (follows CNB-LY-EXPORT-SPEC-v1.2) |

### UI Components

| Module | Purpose |
|--------|---------|
| Palette Editor | Color palette selection with CB-safe toggle |
| Staff/Ledger Rule Editor | Staff pattern and ledger template configuration |
| Notehead Rule Editor | Shape/hollow/color rules by pitch, duration, key |
| SVG Shape Importer | Reads Music Glyph Toolkit SVGs, extracts paths and anchors |
| Config Save/Load | JSON import/export |
| Preview Display | Full notation preview with range controls |

See [CNB-ARCHITECTURE-PLAN-v2.md](docs/CNB-ARCHITECTURE-PLAN-v2.md) for the complete modular architecture plan.

## Configuration Model

The Configurator's native format is a JSON configuration that defines a complete notation system:

- **Shapes** — Notehead geometries with SVG paths, LilyPond paths, and stem anchors
- **Staff** — Semitone pattern, line styling (thickness as % of semitone height)
- **Ledgers** — Templates with proximity and override trigger rules
- **Notehead Rules** — Cumulative rules assigning shape, hollow, color by pitch/duration/key
- **Palette** — Color palette with automatic colorblind-safe alternatives
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
│   │   └── cnb-lilypond.js          LilyPond exporter
│   ├── ui/                          UI components (editors, importer, config IO)
│   ├── tests/
│   │   ├── run-tests.js             Test runner
│   │   └── cnb-*-tests.js           Per-module test files
│   ├── test-pages/
│   │   └── test-*.html              Visual test pages per module
│   ├── fixtures/                    Kite 4-369 release-gate fixtures
│   └── uat/                         Browser UAT drivers (Playwright)
├── legacy/                          Monolithic predecessor (reference)
│   ├── chromatic-configurator.html
│   ├── configurator-core.js
│   ├── music-color-palettes.js
│   └── run-tests.js
└── docs/
    ├── CNB-ARCHITECTURE-PLAN-v2.md
    ├── CNB-LY-EXPORT-SPEC-v1_2.md
    └── session-sets/                Dabbler session records
```

## Current Status

The modular rebuild is complete through the ecosystem's shared release
gate: all rendering, export, and UI modules are built (556 unit tests
passing), and a Configurator-designed system (Kite 4-369) exported through
the UI renders through the engine pixel-identical to the engine repo's
golden baseline. The legacy monolithic version (`legacy/`) is kept as
reference with its 240 core logic tests still passing.

Development sessions are managed with Dabbler session sets (`docs/session-sets/`) — see `docs/dabbler/start-here.md` for the session workflow. The `docs/batons/` and `docs/checklists/` directories are historical records of the pre-Dabbler session workflow (sessions 1–9), kept for reference; they are not part of the active workflow.

## License

This work is dedicated to the public domain under the
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
license — see the [`LICENSE`](LICENSE) file for the full legal text. To the
extent possible under law, the author has waived all copyright and related
or neighboring rights to this work.
