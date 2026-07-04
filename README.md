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
- [chromatic-notation-base](https://github.com/YOUR_USERNAME/chromatic-notation-base) — LilyPond engine that renders music from exported config files
- [music-glyph-toolkit](https://github.com/YOUR_USERNAME/music-glyph-toolkit) — Inkscape extension for authoring notehead shapes

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- [Node.js](https://nodejs.org/) 18+ (for running tests only)

### Usage

Open `index.html` in a browser. No build step required.

### Running Tests

```bash
node cnb/tests/run-tests.js
```

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
├── index.html                       Application entry point
├── cnb/
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
│   ├── tests/
│   │   ├── run-tests.js             Test runner
│   │   └── cnb-*-tests.js           Per-module test files
│   └── test-pages/
│       └── test-*.html              Visual test pages per module
├── ui/                              UI components (Phase 5)
├── assets/
│   ├── shapes/                      Built-in SVG shape files
│   └── palettes/                    Palette definitions
├── legacy/                          Monolithic predecessor (reference)
│   ├── chromatic-configurator.html
│   ├── configurator-core.js
│   ├── music-color-palettes.js
│   └── run-tests.js
├── docs/
│   ├── CNB-ARCHITECTURE-PLAN-v2.md
│   └── CNB-LY-EXPORT-SPEC-v1_2.md
└── reference/
    └── Kite-4-369-Notation-Procedure.ly
```

## Current Status

The Configurator is being rebuilt with a modular architecture. The legacy monolithic version (`legacy/chromatic-configurator.html`) is functional with 240 core logic tests and 53/54 manual UI tests passing. The new modular build is in progress — see the architecture plan for the build order.

Development sessions are managed with Dabbler session sets (`docs/session-sets/`) — see `docs/dabbler/start-here.md` for the session workflow. The `docs/batons/` and `docs/checklists/` directories are historical records of the pre-Dabbler session workflow (sessions 1–9), kept for reference; they are not part of the active workflow.

## License

This work is dedicated to the public domain under the
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
license — see the [`LICENSE`](LICENSE) file for the full legal text. To the
extent possible under law, the author has waived all copyright and related
or neighboring rights to this work.
