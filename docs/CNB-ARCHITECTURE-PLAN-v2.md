# Chromatic Notation Builder — Modular Architecture Plan

**Version:** 2.0
**Created:** February 26, 2026
**Status:** Draft for review
**Predecessor:** BATON-SESSION-7-COMPLETE-20260226.md
**Reconciled with:** CNB-LY-EXPORT-SPEC-v1.2

---

## 1. Vision

The Chromatic Notation Builder (CNB) is a browser-based tool that lets users design custom chromatic staff notation systems and export them as LilyPond files. Users configure staff lines, ledger lines, notehead shapes, colors, and rules — then see a live preview rendered as a row of **octave-chord cards**, one per pitch class.

The system is being rebuilt from a 3,057-line monolithic HTML file into a modular architecture where each module has a clear API, its own test suite, and minimal coupling to other modules.

---

## 2. Architecture Principles

1. **Two inputs.** Every rendering module takes two kinds of input:
   - **Config:** The notation system definition (staff pattern, shapes, rules, colors, etc.)
   - **Example data:** What to render with that config (a specific pitch, chord, set of notes, duration, key, etc.)

   The config defines the *system*. The example data defines *what to show* using that system. The same config can render different examples.

2. **JSON config as single source of truth.** One config schema drives the preview renderer and the LilyPond exporter. The config defines the notation system; it does not contain example data.

3. **Bottom-up construction with minimal dependencies.** Each module is built and tested before any module that depends on it. Dependencies are minimized — a module should depend on as few other modules as possible.

4. **Testable by default.** Pure logic is unit-tested. Visual rendering has standalone test/demo pages for manual verification.

5. **No framework dependency.** All modules are vanilla JavaScript (ES modules). The UI layer may adopt a framework later, but all rendering and logic modules must work without one.

6. **Loose coupling via config and public APIs.** Modules communicate through the config schema. Each module exposes a public API — its own slice of the config schema plus its rendering/computation functions. Other modules may use these public APIs, but never reach into internals.

---

## 3. Module Inventory

### Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI LAYER (Modules 12–19)                 │
│  Notehead Panel │ Staff/Ledger Editor │ Notehead Editor │ ...   │
└────────────────────────────┬────────────────────────────────────┘
                             │ reads/writes config
                             ▼
                   ┌─────────────────┐
                   │   Config Schema  │  (Module A)
                   │   + Validation   │
                   └────────┬────────┘
                            │ config JSON
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
     │  Card        │ │ LilyPond │ │  Card        │
     │  Collection  │ │ Exporter │ │  Collection  │
     │  Renderer    │ │          │ │  (alt views) │
     │  (Module 10) │ │(Module 9)│ │              │
     └──────┬───────┘ └──────────┘ └──────────────┘
            │ composes
            ▼
     ┌──────────────┐
     │  Octave Chord│
     │  Card        │
     │  (Module 8)  │
     └──────┬───────┘
            │ composes
    ┌───────┼────────────────┐
    ▼       ▼                ▼
┌────────┐ ┌──────────────┐ ┌──────────────┐
│ Staff  │ │  Noteheads   │ │  Ledger      │
│(Mod 3) │ │  + Stems     │ │  Lines       │
│        │ │ (Mod 5,6,7)  │ │  (Mod 4)     │
└───┬────┘ └──────┬───────┘ └──────┬───────┘
    │             │                │
    ▼             ▼                ▼
┌────────────────────────────────────────────┐
│         Semitone Grid  (Module 1)          │
│         Coordinate System + Debug Overlay  │
└────────────────────────┬───────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼                     ▼
     ┌──────────────┐     ┌──────────────┐
     │ Config Schema│     │ Music Theory │
     │  (Module A)  │     │  Utilities   │
     │              │     │  (Module B)  │
     └──────────────┘     └──────────────┘
```

### Module List

| ID | Module Name | Type | Description |
|----|------------|------|-------------|
| **A** | Config Schema | Foundation | JSON schema definition, validation, defaults, versioning |
| **B** | Music Theory Utilities | Foundation | Pitch class math, note names, enharmonic spelling, octave arithmetic |
| **1** | Semitone Grid | Rendering | Coordinate system (`semiToY`, viewport sizing) + optional debug grid overlay |
| **2** | Staff Line | Rendering | Renders a single horizontal staff line at a semitone position |
| **3** | Staff | Rendering | Renders the complete staff (all staff lines) from config |
| **4** | Ledger Line | Rendering | Renders a single ledger line at a semitone position (unconditional) |
| **5** | Ledger Set | Rendering | Evaluates display rules and renders the correct ledger lines for a set of pitches |
| **6** | Notehead | Rendering | Renders a single notehead shape at a pitch position |
| **7** | Double Notehead | Rendering | Renders an octave pair (or quad) of noteheads with horizontal offset |
| **8** | Stem | Rendering | Renders a stem connecting noteheads, using shape anchor points |
| **9** | Octave Chord Card | Rendering | Composes staff + ledgers + noteheads + stem + labels into one card |
| **10** | Card Collection | Rendering | Lays out multiple cards in a row/grid for a range of pitches, durations, or keys |
| **11** | LilyPond Exporter | Export | Generates `.ly` file content from a config JSON |
| **12** | Palette Editor | UI | *Retired in session 37:* a notehead's colour lives on its rules (§4.6); the curated sets are the notehead panel's Suggested colours (`ui/colour-sets.js`) |
| **13** | Staff/Ledger Rule Editor | UI | Rule editor for staff and ledger line properties |
| **14** | Notehead Rule Editor | UI | Rule editor for notehead shape, hollowness, color by pitch/duration/key |
| **15** | Common Properties Editor | UI | Global config settings (duration representation, etc.) |
| **16** | SVG Shape Importer | UI | Reads SVG files to extract notehead paths and anchor points |
| **17** | Config Save/Load (JSON) | UI | Save and load config as JSON files |
| **18** | Config Export (LilyPond) | UI | Save config as LilyPond file (wraps Module 11) |
| **19** | Preview Display | UI | Full preview with controls for pitch range, duration range, key selection |
| **20** | Clef Renderer | Rendering | Renders the active clef glyph into a left gutter, positioned via the semitone grid *(added set 009)* |
| **21** | Clef Editor | UI | Enable toggle, clef glyph import/selection, anchor-semitone and gutter controls *(added set 009)* |
| **22** | Key Signature Renderer | Rendering | Renders the selected key's signature marks on the semitone grid in a staff-start gutter, after the clef *(added set 010)* |
| **23** | Key Signature Editor | UI | keys master gate, key definitions (name/pitch classes/tonic), signature enable, mark style, placement, separator/gutter controls *(added set 010)* |
| **24** | Pitch Axis | Foundation | `CNBPitchAxis` — the axis gatekeeper: sole owner of the pitch→grid-position mapping (many-to-one pitch-class map, I2 relaxation); linear degeneracy when disabled *(added set 014)* |

---

## 4. Config Schema (Module A)

The config is a single JSON object that defines a notation system. It does NOT contain example data (which pitches to display, etc.) — that is supplied separately when rendering.

### 4.1 Top-Level Structure

```javascript
{
  version: "1.0",
  shapes: { ... },           // Notehead geometries
  staff: { ... },            // Staff line configuration
  pitchAxis: { ... },        // OPTIONAL pitch→axis-position map (set 014 — see §4.13)
  ledgers: { ... },          // Ledger line configuration
  noteheadRules: [ ... ],    // Rules for shape, hollow, color assignment (colour: §4.6)
  display: { ... },          // Preview rendering settings (NOT exported to LilyPond)
  durations: { ... },        // Duration definitions and representation mode
  keys: { ... },             // Key definitions + key signature (set 010 — see §4.9)
  clef: { ... },             // Custom clef (set 009 — see §4.12)
  engine: { ... },           // LilyPond engine settings
  meta: { ... }              // Metadata
}
```

### 4.2 Shapes

Shapes are named notehead geometries imported from SVG files. Each shape stores BOTH SVG data (for preview rendering) and LilyPond data (for export).

```javascript
shapes: {
  "crotchet-minim": {
    displayName: "Crotchet–Minim",

    // ── SVG data (for preview rendering) ──
    svgPath: "M 163.578 -81.573 C ...",          // SVG path d attribute
    svgHollowPath: "M 136.312 -67.977 C ...",    // SVG hollow cutout (null if none)
    naturalHeight: 272.4,                         // native SVG units
    naturalWidth: 344.852,                        // native SVG units
    semitoneHeight: 2.724,                        // from data-semitone-height

    // ── Stem attachment points (4-point model) ──
    // In native SVG units. Each is where the STEM'S CENTRE goes (session
    // 40): the importer reads it at the end-centre of the SVG's stem rect,
    // so a rect drawn centred on the notehead centres the stem. Crotchet and
    // minim may differ because hollow noteheads have different visual
    // weight at the attachment point.
    anchors: {
      crotchetUp:   { x: 146.43, y: -43.00 },
      crotchetDown: { x: -146.43, y: 43.00 },
      minimUp:      { x: 146.43, y: -43.00 },    // may differ from crotchet
      minimDown:    { x: -146.43, y: 43.00 }      // may differ from crotchet
    },

    // ── LilyPond data (for export) ──
    // Pre-baked LilyPond path from data-lilypond-notehead attribute (preferred),
    // in SEMITONE units, Y up (toolkit: SVG units ÷ 100, Y negated); the
    // exporter divides it by semitonesPerStaffSpace at export time
    // (LY spec v1.3 §4.1b). If null, the exporter converts
    // svgPath via svgPathToLilypond(): ÷ (naturalHeight / semitoneHeight),
    // Y negated, ÷ semitonesPerStaffSpace.
    lilypondPath: null,
    lilypondHollowPath: null,

    // LilyPond stem attachment, in SEMITONE units (canonical).
    // Converted from SVG units at import time (÷ SVG-units-per-semitone,
    // Y-inverted). At EXPORT time the exporter writes each point relative
    // to the registered path's extent (−1 … 1 across it), the units
    // LilyPond's NoteHead.stem-attachment reads (LY spec 1.3.8 §4.4b,
    // session 33; staff spaces before that, which engraved stems too near
    // the notehead's centre). LilyPond puts the stem's EDGE on that point,
    // so each x is the anchor moved half the engine's 0.13-staff-space stem
    // outward, which the staff space and a sized variant's scale enter
    // (LY spec 1.3.11 §4.4c, session 40).
    lilypondAnchors: {
      crotchetUp:   { x: 0.6889, y: 0 },
      crotchetDown: { x: -0.6889, y: 0 },
      minimUp:      { x: 1.0222, y: 0 },
      minimDown:    { x: -0.6889, y: 0 }
    },

    // ── The reference point (session 54, key-signature design §13.3) ──
    // OPTIONAL. reference: the point, in native SVG units, that a key
    // signature mark places on its pitch (a dot's centre, a flat's bowl);
    // without it the shape's box is centred there, as before. Since session
    // 60 a notehead puts the point's HEIGHT on its pitch too (its x is not
    // applied to noteheads; §4.5 "Notehead placement"). ledgers: false = the
    // symbol takes no ledger lines in a signature; a notehead rule using the
    // shape ignores it.
    // reference: { x: -40, y: 0 },
    // ledgers: false
  },

  "semibreve": {
    displayName: "Semibreve",
    svgPath: "M ...",
    svgHollowPath: "M ...",
    naturalHeight: ...,
    naturalWidth: ...,
    semitoneHeight: ...,
    anchors: null,              // stemless
    lilypondPath: null,
    lilypondHollowPath: null,
    lilypondAnchors: null       // stemless
  }
}
```

**Design notes:**
- `semitoneHeight` determines the rendered size. Scale factor = `(semitoneHeight × pxPerSemi) / naturalHeight`.
- `anchors` is `null` for stemless shapes. The stem module handles this (no stem drawn).
- The 4-point anchor model (crotchet-up/down, minim-up/down) accounts for the fact that stem width (~1/5 semitone) affects where the stem visually attaches to filled vs. hollow noteheads. Inkscape extension output provides these.
- **An anchor is the stem's centre (session 40).** The preview draws the stem centred on it and the export writes the attachment half a stem outward of it, where LilyPond puts the stem's edge (LY spec §4.4c), so a stem goes where the SVG's stem rect puts it: the Kite 4-369 and 45deg-369 stems are centred. The default notehead's anchors (±146.426) put the up stem's right edge and the down stem's left edge on its sides on its staff of 4 semitones per staff space; each gallery file sets them for its own staff, so its stems sit on the sides too. A config saved earlier keeps its stored anchors, which now place the stem's centre.
- `hollowPath` overlay uses white fill. Known limitation: only works on white/solid backgrounds.
- `lilypondPath` and `lilypondHollowPath` are the pre-baked LilyPond-format paths from `data-lilypond-notehead` / `data-lilypond-hollow` SVG attributes. They are stored in semitone units, Y up. When they are available, the exporter re-emits them from their parsed numbers, divided by the staff's semitones per staff space (or `axisUnitsPerStaffSpace` under a pitch axis). When null, it falls back to converting `svgPath` with the toolkit's normalisation: ÷ SVG units per semitone, Y negated, then the same division (LY spec v1.3 §4.1b; corrected in session 11 for audit 2026-11-02 H2/H3, because earlier exports used them verbatim and were mis-scaled).

**↔ LY Spec mapping:**
| Config field | LY Section | LY construct |
|---|---|---|
| `shapes[name].lilypondPath` or `svgPath` (converted) | A1 | `#(define cnb:{name}-path ...)` |
| `shapes[name].lilypondHollowPath` or `svgHollowPath` (converted) | A3 | `#(define cnb:{name}-cutout-path ...)` |
| `shapes[name].lilypondAnchors` (or `anchors`), half a stem outward, relative to the registered path's extent (LY spec §4.4b, §4.4c) | A4 | `#(cnb:register-attachment! ...)` |
| (shape name) | A2 | `#(cnb:register-path! '{name} ...)` |

### 4.3 Staff Lines

```javascript
staff: {
  // Semitone positions within an octave where staff lines appear (0–11).
  // These are expanded to absolute positions across the visible octave range.
  semitonePattern: [4, 8],

  // Absolute semitone where stem direction flips.
  // For 4-8 with notes at semi 0–24, staff lines at 4,8,16,20 → midpoint = 12.
  midpoint: 12,

  // Informational. Derived from the pattern.
  semitonesPerStaffSpace: 4
}
```

**Design notes:**
- **The lines have no style settings (session 34).** The preview draws
  every staff line as the engine engraves it: black, solid, 0.1 staff
  spaces thick (`CNBStaff.staffSpacePx`: one staff space is
  `semitonesPerStaffSpace` semitones, or `axisUnitsPerStaffSpace` axis
  units under a pitch axis). `lineDefaults` and `lineOverrides` are
  retired: a config that carries them still loads, and neither is read.
- `semitonesPerStaffSpace` is informational in this schema but becomes the critical `cnb:semitones-per-staff-space` LilyPond setting.

**↔ LY Spec mapping:**
| Config field | LY Section | LY construct |
|---|---|---|
| `staff.semitonesPerStaffSpace` | B1 | `#(set! cnb:semitones-per-staff-space N)` |
| `staff.semitonePattern` → positions | B1 | `#(set! cnb:staff-line-positions '(...))` |

**LilyPond staff-line-positions conversion:**
The LY engine uses positions relative to center, in HALF-staff-space units
(LilyPond staff positions; engine `cnb/config.ly`, LY spec §5.1). The
exporter converts:
```
For each absolute semitone S in the expanded staff pattern:
  lyPosition = 2 × (S - midpoint) / semitonesPerStaffSpace
```
Example: 4-8 system, midpoint=12, sps=4. Staff at semi [4,8,16,20]:
  → `[2×(4-12)/4, 2×(8-12)/4, 2×(16-12)/4, 2×(20-12)/4]` = `[-4, -2, 2, 4]`
  → `cnb:staff-line-positions '(-4 -2 2 4)`

> **Correction (007-s2):** this section originally omitted the ×2 factor
> (emitting whole staff-spaces), which rendered the staff at half height —
> cataloged as discrepancy D2 in session-set 007 session 1. The LY spec
> §5.1 example (3-6-9 → `'(-6 -4 -2 2 4 6)`) was always consistent with
> the engine and is the authoritative reference.

### 4.4 Ledger Lines

```javascript
ledgers: {
  // Templates define where ledger lines CAN appear.
  // They are expanded to absolute positions per octave at render time.
  templates: [
    {
      semiWithinOctave: 0,            // position within octave
      triggerPCs: [0, 1, 2],          // pitch classes that trigger this ledger
      triggerMode: "override"         // "override" | "proximity"
    },
    {
      semiWithinOctave: 2,
      triggerPCs: [2],
      triggerMode: "override"
    },
    {
      semiWithinOctave: 10,
      triggerPCs: [10],
      triggerMode: "override"
    }
  ],

  // Default display rule when triggerMode is "proximity":
  // Show ledger at semitone L for notehead at semitone N when
  // |N - L| < |N - nearestStaffLine| AND L is in the same octave region as N.
  proximityRule: true
}
```

**Design notes:**
- **No "outside staff" hard gate.** Some staff configurations have gaps (e.g., 3-6-9 has a gap between 9 and 15). Ledger lines within those gaps may be needed. The display rules (proximity and override) handle this correctly without filtering.
- **Octave awareness is critical.** A ledger template at `semiWithinOctave: 0` in octave 0 (absolute semi 0) only responds to noteheads in or near octave 0. It does NOT respond to a notehead at semi 24 (octave 2's C). Each octave gets its own instance of each template.
- **The ledgers are drawn as the engine engraves them (session 34):** black,
  0.2 staff spaces thick, with fully rounded ends, 1.5 times as long as the
  notehead (in repeat mode, the group of heads) is wide
  (`CNBLedgerSet.width`). `lineDefaults` (thickness, colour, style,
  `widthMultiplier`, `roundedEnds`) and `lineOverrides` are retired: a
  config that carries them still loads, and neither is read.
- **The rules are exported (session 34, LY spec 1.3.9 §5.7).** For every
  pitch the preview draws (semitones 0–24), the export writes the ledgers
  the preview draws there (`CNBLedgerSet.ledgersFor`), and each notehead
  engraves its pitch's entry, in-gap ledgers included. So does each
  key-signature mark of the mark table beyond them, and since engine 1.4.1
  every signature head takes its entry (session 50, LY spec 1.3.16). Other
  pitches keep the engine's own rule, which reaches the engraved staff.

### 4.5 Notehead Rules

Rules are evaluated in priority order (ascending). Later rules override earlier ones. Each rule can set any combination of properties.

```javascript
noteheadRules: [
  {
    name: "Default",
    priority: 0,
    match: {
      pitchClasses: "all",              // "all" | [0, 1, 2, ...]
      durations: "all",                 // "all" | ["crotchet", "minim", ...]
      keys: "all"                       // "all" | ["C", "G", ...] (future)
    },
    apply: {
      shape: "crotchet-minim",          // shape name from config.shapes
      hollow: false,
      color: null,                      // "#RRGGBB", or null = none (black); §4.6
      offKeyMark: false                 // false | mark identifier (future)
      // heightSemis: 2.724,            // OPTIONAL notehead size in semitones (session 22)
      // widthSemis: 3.4485             // OPTIONAL — see "Notehead size" below
    }
  },
  {
    name: "Sharps are hollow",
    priority: 1,
    match: {
      pitchClasses: [1, 3, 6, 8, 10],
      durations: "all",
      keys: "all"
    },
    apply: {
      hollow: true
      // shape, color, offKeyMark not specified → inherited from lower-priority match
    }
  }
]
```

**Resolution algorithm:**
For a given (pitchClass, duration, key), walk rules in priority order. Start with built-in defaults:
```
{ shape: first shape, hollow: false, color: null, offKeyMark: false,
  xOffsetStaffSpaces: 0, heightSemis: null, widthSemis: null }
```
For each matching rule, merge its `apply` block over the current state (only specified fields overwrite). The final state is the resolved notehead config.

**Notehead size (added session 22).** `apply.heightSemis` and
`apply.widthSemis` are optional absolute sizes in semitones. They resolve
through the same cumulative merge as `hollow`, each on its own. A size that
no matching rule sets resolves to `null`, which means the shape's own
`semitoneHeight` for the height and its natural width
(`naturalWidth × semitoneHeight / naturalHeight`) for the width. Every
config written before session 22 therefore resolves, previews and exports
exactly as before.

- **Validation:** a present value that is not a finite number greater than
  0 is an error naming the rule. A value outside 0.25–4 semitones is a
  warning: it is allowed, but it is unlikely to look right.
- **Preview:** `CNBNotehead.measure(shape, pxPerSemi, size)` returns
  separate `scaleX` (from the width) and `scaleY` (from the height), with
  `scaleFactor = scaleY`. The notehead is drawn with `scale(sx,sy)` only
  when the two differ. The stem anchor's x offset uses `scaleX`, and the
  octave pair, the ledger width (1.5 notehead widths, §4.4), the
  card column, repeat-mode groups and key-signature marks all follow the
  resolved measurement. Stem length and thickness do not change.
- **Export:** sizes are exported. Each distinct resolved size other than
  the shape's own is registered as a scaled variant of the shape, and
  Section C names that variant (LY spec 1.3.4 §4.1c).
- **Editor:** a rule's apply block has a Size row with height and width
  fields and a "Keep aspect ratio" lock, which is on by default and is
  editor state only. While it is on, the width follows the height at the
  shape's natural ratio.

**Notehead placement (added session 60).** A notehead is drawn with its
shape's reference point (§4.2, `shapes[name].reference`) on its pitch,
vertically: `CNBNotehead.referenceShift(shape, scaleY)`, −reference.y ×
scaleY px, moves the drawn head, and 0 without a reference keeps every
config as it was. The head stays centred on its column across, so its x is
not applied. The stem's attached end and a breve's tie move with the head;
the staff lines, the ledgers, the stem's far end and the dots stay at the
pitch. The setting is the shape's, so it fixes the shape everywhere, with no
rule-level offset (the consult, `docs/planning/nudge-staff-lines-consult.md`).
The notehead panel's Shape row picks the height on the enlarged shape (Pick
the point that sits on the pitch, Centre, Done), keeping the reference's x,
which only the key signature reads; the picker opens after an import.
Exported as a `-ref` variant of the shape, its path moved up the reference's
height, which the key signature's marks do not use (LY spec 1.3.22 §4.1e).

**↔ LY Spec mapping:**
The exporter resolves all 12 pitch classes (× durations if duration-aware), groups PCs with identical resolved configs, and emits `cond` clauses:

| Resolved field | LY procedure return field |
|---|---|
| `shape` → shape name | `(shape . {name})` |
| `hollow` → true → shape's hollow name | `(hollow . {name}-cutout)` or `(hollow . #f)` |
| `color` → its symbol, named from the hex (§4.6) | `(color . {symbol})` |
| `shape` → shape's attachment name | `(attachment . {name}-attach)` |
| `offKeyMark` | `(off-key-mark . #f)` or `(off-key-mark . {symbol})` |
| `heightSemis` / `widthSemis` other than the shape's own | `{name}` above becomes the sized variant `{shape}-h{H}-w{W}` (LY spec §4.1c) |
| the shape's `reference.y` ≠ 0 | `{name}` above gains `-ref`, the registration moved so the point is on the pitch (LY spec §4.1e) |

**The `repeat` field** in LilyPond output is derived from `config.durations`:
- If `representationMode == "repeat"` → emit `(repeat . #t)` (or omit, since #t is default)
- If `representationMode == "shape"` and duration-specific shapes are assigned → emit `(repeat . #f)`

### 4.6 Colour (on the noteheads, session 37)

A config has no palette. A notehead's colour is chosen on the notehead (in
the notehead panel) or on its rule, and carried as the rule's `apply.color`
(§4.5): a `#RRGGBB` hex, or `null` for none, drawn and exported black. Many
notations stay black, and a colour-blind version is simply a second config,
the same one saved under another name with other colours.

```javascript
noteheadRules: [
  { name: "Default (kite-down, solid)", priority: 0,
    match: { pitchClasses: "all", durations: "all", keys: "all" },
    apply: { shape: "kite-down", hollow: false, color: "#50b4e9" } },
  { name: "Puce, every 3 semitones from C♯", priority: 1,
    match: { pitchClasses: [1, 4, 7, 10], durations: "all", keys: "all" },
    apply: { color: "#cc79a7" } },
  { name: "No colour, every 3 semitones from D", priority: 2,
    match: { pitchClasses: [2, 5, 8, 11], durations: "all", keys: "all" },
    apply: { color: null } }
]
```

**Design notes:**
- **The look table writes colour as rules** (`ui/notehead-inference.js`),
  as it writes shape and fill: the Default carries the most common colour
  unless it is none, and each other colour gets a rule.
- **Suggestions, not a palette.** The curated sets the palette editor
  offered (Dark2 and the colour-blind-safe sets) are listed in the notehead
  panel's Suggested colours help (`ui/colour-sets.js`). Applying one colours
  the twelve noteheads by cycling the set; nothing about the set is stored.
- **A palette in a saved config** is moved onto the noteheads when the
  config loads: `CNBConfig.paletteToRules` (called by
  `CNBConfigIO.mergeLoaded`) turns each distinct non-black colour of
  `palette.colors` into a rule for its pitch classes, below every existing
  rule, and drops rules' explicit `color: null` ("use the palette"), so the
  config previews and exports as before. `cbSafeColors`, `useCBSafe` and
  `schemeSymbols` are dropped.
- **Colour names** come from `cnb/src/cnb-color.js` (`nearestColorName`,
  `baseColorName`, `schemeSymbol`), for the panel's words and the export's
  symbols alike.

**↔ LY Spec mapping (LY spec 1.3.10 §4.5a):**
| Config field | LY Section | LY construct |
|---|---|---|
| each distinct resolved `apply.color` | A5 | `#(cnb:register-color! '{schemeSymbol(hex)} "{hex}")`, once each, no accessible branch |
| a resolved `null` (none) | A5, C | `black-000000` |

### 4.7 Display Settings

**These settings are for preview rendering ONLY.** They are NOT exported to LilyPond. The LY engine has its own rendering pipeline.

```javascript
display: {
  pxPerSemi: 16,                // pixels per semitone in preview

  // Staff lines, ledgers and stems have no settings here: the preview
  // draws them as the engine engraves them, in staff spaces (session 34;
  // §4.3, §4.4, Module 8). stemThicknessPct and stemExtension are retired.

  label: {
    fontFamily: "Oswald",
    fontSize: 22,               // px
    fontWeight: 400,
    color: "#555555",
    marginTop: 14,              // px above top label
    marginBottom: 14,           // px below bottom label
    padding: 6,                 // px between label text and staff area
    sharpStyle: {
      fontSize: 0.75,           // em, relative to label font
      raise: -0.15              // em, vertical offset
    }
  },

  column: {
    paddingH: 16                // px horizontal padding added to ledger width
  },

  card: {
    background: "#FFFFFF",
    borderRadius: 6,            // px
    shadow: "0 2px 12px rgba(0,0,0,0.12)"
  },

  debugGrid: false              // show semitone grid lines for development
}
```

**Design note on stems (session 34):** the preview draws LilyPond's stem, which the engine leaves at its defaults: 0.13 staff spaces thick and LilyPond's length past the far notehead (Module 8). Its centre sits on the anchor (session 40), and the export writes the attachment half a stem outward, where LilyPond puts the stem's edge, so the stem meets the notehead where the engraving's does.

### 4.8 Duration Settings

```javascript
durations: {
  definitions: [
    {
      name: "crotchet",
      displayName: "Crotchet (Quarter)",
      lilypondDuration: 3,            // LilyPond duration number
      defaultShape: "crotchet-minim",
      defaultHollow: false,
      hasStem: true
    },
    {
      name: "minim",
      displayName: "Minim (Half)",
      lilypondDuration: 2,
      defaultShape: "crotchet-minim",
      defaultHollow: true,
      hasStem: true
    },
    {
      name: "semibreve",
      displayName: "Semibreve (Whole)",
      lilypondDuration: 1,
      defaultShape: "semibreve",
      defaultHollow: false,
      hasStem: false
    },
    {
      name: "breve",
      displayName: "Breve (Double Whole)",
      lilypondDuration: 0,
      defaultShape: "breve",
      defaultHollow: false,
      hasStem: false
    }
  ],

  // "shape" = different notehead shapes per duration
  // "repeat" = repeat the same notehead: the engine's fixed counts,
  //   minim ×2, semibreve ×4 (session 18), and a breve as two semibreves
  //   1 staff space apart, joined by a tie from the middle of the first to
  //   the middle of the second (sessions 44 and 58). repeatCounts, which
  //   neither the preview nor the export read, is retired (session 34).
  representationMode: "shape",

  // In repeat mode, the share of a head's own width each copy overlaps the
  // last (session 58): 0 or more and below 1, one fraction for every shape.
  // It replaces engine.multinotePadding (staff spaces), which is retired.
  repeatOverlap: 1 / 3
}
```

**↔ LY Spec mapping:**
| Config field | LY procedure return |
|---|---|
| `representationMode == "shape"` with distinct shapes per duration | `(repeat . #f)` on duration-specific clauses |
| `representationMode == "repeat"` | `(repeat . #t)` (or omit, since default) |
| `durations[].lilypondDuration` | Used in compound `cond` conditions: `(= duration 3)` |
| `repeatOverlap`, in repeat mode | Section B `#(set! cnb:multinote-overlap 0.3333)`, engine 1.7.0 (LY spec 1.3.20 §4.1d) |

**Design note on the overlap (session 58).** The operator picked it from
mock-ups (`docs/planning/repeat-overlap-mockups/`): the old −0.5 staff
spaces overlapped 58% of the default notehead but 37–38% of the Kite and
45deg-369 heads, since those staffs have 3 semitones per staff space. A
share of the head's own width reads the same on every staff. The canvas
sets it beside the repeat choice, as a percentage, and the preview
(`CNBCard.repeatLayout`) and the engraving space the copies alike.

### 4.9 Key Settings (activated set 010)

> **Addendum (set 010, July 2026).** The `keys` section, stubbed here as
> "future", was activated by session-set `010-custom-key-signatures` per
> the E2 entry of the gallery-survey enhancement requirements
> (`docs/research/gallery-survey/enhancement-requirements.md`): key
> definitions gained an optional explicit tonic, and a `keySignature`
> subsection renders per-key marks on the semitone grid in a staff-start
> gutter (Clairnote DN's stacked signatures are the motivating reference;
> design CC BY-SA 4.0 — inspiration only, no code from `clairnote.ly`).
> Off-key marking (`offKeyMark`) remains deferred (§11).

```javascript
keys: {
  enabled: false,              // master gate for everything key-related
  definitions: [
    // Optional tonicPc (0–11) pins the tonic explicitly. Without it the
    // tonic resolves from the name's leading note letter ("F# minor" → 6),
    // else the first listed pitch class (validation warns on the fallback).
    { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
    { name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11], tonicPc: 7 },
  ],
  offKeyMark: {
    // Visual treatment for off-key notes. Deferred.
  },

  // Key signature (set 010). With enabled:false the preview draws no
  // signature, and since session 30 the export writes
  // cnb:keysig-style 'none, so the engraving draws none either.
  keySignature: {
    enabled: false,

    // One model draws every signature (session 54, key-signature design
    // §13). Its defaults mirror the engine's keysig.ly: the key's scale as
    // REAL noteheads — 7 degrees ascending from the tonic plus the octave
    // tonic, interleaved into two columns (even indices left, odd right),
    // which reads as two stacked 7th chords — resolved through the normal
    // notehead rule pipeline at crotchet duration with the selected key as
    // rule-match context. The traditional signature is the sharps or flats
    // only (notes "altered"), LilyPond's own sharp and flat (Emmentaler, in
    // the optical size LilyPond draws the staff with,
    // cnb/src/cnb-accidental-glyphs.js) as the sharps' and flats' looks,
    // and the cycle of fifths. `style` ("notehead-chords" | "accidentals",
    // sessions 10–53) is retired: CNBConfig.signatureStyleToModel converts
    // a saved one on load ("accidentals" → the traditional signature with
    // heights "scale", black signs; the looks and alternate cleared), and
    // nothing reads it.

    // The sharps' and flats' size (session 52), for every sign drawn:
    // the sharp's height from the top left of its upper bar to the top left
    // of its lower bar, in semitones (axis units under a pitch axis); the
    // flat is scaled with it. null is automatic: the least of the
    // noteheads' mean height (the twelve crotchet noteheads, no key), one
    // staff space and 3 (CNBKeySignature.signHeight): 2.724 on the default
    // staff, 3 on Kite 4-369. A number set by hand stays when the
    // noteheads or the staff change. Validation: null or a finite number
    // above 0, a warning outside 1–12. Exported as each sign's scale
    // (LY spec 1.3.18 §5.6a), which needs engine 1.5.0.
    signs: { heightSemis: null },

    // The designer's settings (session 48, design
    // docs/planning/key-signature-designer-design.md §4, §6). Each default
    // is the signature above, so a config saved before them draws as it did;
    // a setting that does not apply to the kind or stacking is kept and
    // ignored. Exported as the mark table when any applies (session 49,
    // LY spec 1.3.15 §5.6a).
    notes: "all",               // | "tonic-and-half-steps": the tonic and both
                                //   notes of each half step in the scale;
                                //   | "altered": the key's sharps or flats only
    upperTonic: true,           // the tonic an octave up (not under "fifths")
    looks: {                    // each field unset = the look beneath, laid
      all: {},                  //   in this order: the notehead's own (at
      natural: {},              //   crotchet, in the key), all marks,
      flat: {},                 //   naturals, flats or sharps by the key's
      sharp: {},                //   spelling, a line or ledger or a space by
      line: {},                 //   the mark's pitch (session 54), then
      space: {}                 //   alternate. { shape | sign ("sharp" |
    },                          //   "flat"), hollow, color, heightSemis,
                                //   widthSemis, offset: { x, y } in semitones,
                                //   added: [≤ 2 × { shape, heightSemis,
                                //   widthSemis, offset }] }; shape and sign
                                //   are one slot, offset and added each
                                //   replaced whole. A sign is black unless a
                                //   look colours it; an added symbol is
                                //   solid, in the mark's colour, no ledgers.
    stacking: "degrees",        // which stack a note joins: "degrees" (1 3 5 7
                                //   left, 2 4 6 8 right), "parity" (odd
                                //   semitones left, even right),
                                //   "parity-stacks" (a new stack to the right
                                //   at each change of parity, Clairnote's),
                                //   "parity-zigzag" (the other stack at each),
                                //   "fifths" (session 54: one mark to a
                                //   column, by letter, F C G D A E B in a
                                //   sharp key, B E A D G C F otherwise; no
                                //   gold stem, direction or upper tonic)
    heights: "window",          // under "fifths": "window", each mark at its
                                //   note in the octave [middle − 6, middle + 6)
                                //   of its line set (the staff's midpoint in
                                //   the middle), so the signs zigzag; |
                                //   "scale", at its note in the scale from the
                                //   tonic (session 51's climbing signs)
    window: { sharp: 0, flat: 0 },  // the window raised, semitones, in sharp
                                //   keys and in flat keys
    alternate: {},              // every second stack's (column's, under
                                //   "fifths") look, over the others:
                                //   { shape | sign, hollow, color, offset, added }
    columns: "right",           // | "left-in-sharp-keys" (not under "parity"
                                //   or "fifths")

    // Placement rule: how the key's pitch classes map to grid positions.
    // "scale-from-tonic" (the keysig.ly rule) is the only implemented
    // value; validation rejects others and the renderer treats an unknown
    // rule as inactive. tonicOctave null = auto (center the octave span
    // [tonic, tonic+12] on staff.midpoint, ties resolving upward — matches
    // the engine's middle-C anchor for the default config); an explicit
    // integer overrides, and is exported as cnb:keysig-tonic-octave with
    // no offset (LY spec 1.3.7 §5.6). position (session 48): where the
    // signature sits, "middle" (the rule above), or "bottom-set", "top-set"
    // or "every-set", on the engraved staff's line sets (runs of lines one
    // staff space apart, staff.midpoint ± 12), each copy's octave centred on
    // its set; tonicOctave overrides the middle only.
    placement: { rule: "scale-from-tonic", tonicOctave: null, position: "middle" },

    // The gold STEM running through the horizontal middle of the mark
    // columns, beneath the marks (the engine's keysig bar, cnb:gold
    // #ffd42a: keysig.ly draws it at max-notehead-x-offset − width/2 =
    // midway between the column centers, 0.4 staff-space thick — set-010
    // s2 UAT engine-render measurement; 160% of a semitone at the default
    // staff's 4 semitones per space). Exported as cnb:keysig-bar-color,
    // -thickness (thicknessPct / (10 × sps), 0 when disabled) and
    // -extent-semis, each when it differs from the engine's default.
    // Since session 48 a stem stands between each pair of neighbouring
    // stacks; with shareThickness on, n stems are thicknessPct ÷ n each.
    separator: { enabled: true, color: "#ffd42a", thicknessPct: 160, extentSemis: 12,
                 shareThickness: true }

    // No gutter setting (session 34): the preview spaces the signature as
    // the engine does — 0.75 staff spaces after the staff's start, or 3.5
    // after a clef's left edge, and the first notehead centred 4.8636 after
    // it. gutter.paddingH is retired. Every signature is spaced by its ink,
    // the ledgers of its first and last stacks included (a mark-table
    // signature since session 49, LY spec §5.6a; the scale stack since
    // session 50, when engine 1.4.1 gave signature heads the notation's
    // ledgers): its ink 0.75 after the staff's start, or its marks 3.5 (a
    // mark table's first stack 2.9286) after a clef's left edge, and the
    // first notehead 4.8636 after the ink.
  }
}
```

**Design notes:**
- **The displayed key is example data, not config** (principle 1): the
  collection's `options.keys[0]` selects which key's signature renders;
  rendering is gated on `keys.enabled && keySignature.enabled && (the
  selected key name resolves to a definition)`. No key selected → no
  gutter reserved.
- **Composes with the set-009 clef gutter** — clef first, then key
  signature, left to right, both positioned via the semitone grid
  (Module 1). No second placement mechanism.
- **LilyPond export (session 30, LY spec 1.3.7 §5.6).** The engine
  renders notehead-chord key signatures from the score's `\key` through
  the exported notehead config, and since its set 006 it takes a
  configuration. The exporter writes `cnb:keysig-style 'none` unless keys
  and the signature are both on, so the default config, whose signature
  is off, engraves none. With the signature on, it writes the bar's
  colour, thickness (0 when the separator is off) and extent, and on a
  linear staff an explicit tonic octave, each only when it differs from
  the engine's default. The spacing is the engine's in the preview too
  (session 34). Set 010 wrote nothing for this section (its
  `s1-engine-coordination.md` records why).
- **The mark table (session 49, LY spec 1.3.15 §5.6a).** `'chord` draws
  only the default scale stack. A signature whose applicable settings are
  not its defaults exports `cnb:keysig-style 'marks` and
  `cnb:keysig-marks` (engine 1.4.0): 105 keys, the 15 spellings of each of
  the 7 modes, each keyed by the tonic's note name and alteration and its
  pitch classes, with the columns, gold bars and marks
  `CNBKeySignature.marks` gives for the key the canvas's picker would
  show. A key the table lacks engraves no signature. Sharps and flats
  (session 51, LY spec 1.3.17 §5.6a) are marks of the same table,
  `(semi column sharp)` or `(semi column flat)`, which the engine draws from
  its music font; they register nothing and add no ledger entries. Since
  session 52 (LY spec 1.3.18) each carries its scale,
  `(semi column sharp 0.6473)`, left out at 1, which engine 1.5.0 reads,
  and since session 55 (LY spec 1.3.19) its colour and placement, which
  engine 1.6.0 reads.
- **One model (session 54, key-signature design §13).** The two styles
  became one model, drawn on the canvas first. A config saved with a style
  loads converted (`CNBConfig.signatureStyleToModel`, called by
  `CNBConfigIO.mergeLoaded` before the defaults are merged) and draws and
  exports exactly as before.
- **The model reaches the mark table (session 55, LY spec 1.3.19 §5.6a).**
  What the model adds beyond the two old signatures exports through the
  table, as engine 1.6.0 (engine sessions 37 and 38) reads it: each mark is
  written as its symbols, base then added ones, at one semitone and column,
  the table's order the layer order; a base whose shape takes no ledgers and
  every added symbol is the `symbol` kind, with no ledgers; a symbol the
  canvas does not centre on its stack (a reference point, an offset) ends
  with `(at dx . dy)`, its origin in staff spaces; and a coloured sign writes
  its colour after its scale. A table that uses none of these is written as
  before. The canvas measures a placed symbol by its path's box
  (`CNBNotehead.box`), as the engine's stencil is measured. The Clairnote SN
  and DN gallery files draw Clairnote's own signatures, dots with imported
  tails.
- **No new open-keyed maps**: `keySignature` is fixed-shape and
  `definitions` is an array (replaced wholesale by Module A's merge), so
  config-IO needs no `REPLACE_PATHS` entry.

### 4.10 LilyPond Engine Settings

Settings that map to LilyPond engine variables but aren't part of the visual preview.

```javascript
engine: {
  lilypondVersion: "2.24.2",
  falseHollow: false,                // cnb:false-hollow
  defaultMagnify: "7/4",             // cnb:default-magnify (string to preserve fraction)
  indent: 0,                         // cnb:indent
  collisionThreshold: 2              // cnb:collision-threshold
}
```

`useAccessibleColors` is retired (session 37): the export has no
colour-blind branch (§4.6), so `cnb:use-accessible-colors` is never set. A
config that carries the field still loads, and it is not read.
`multinotePadding` is retired too (session 58): the repeated heads' overlap
is `durations.repeatOverlap` (§4.8), so `cnb:multinote-padding` is never
set, and a config that carries the field still loads without it being read.

**↔ LY Spec mapping:**
Each field maps directly to its `cnb:` variable. Fields at default values are omitted from the export (emit-if-changed pattern per LY spec §5.2).

### 4.11 Metadata

```javascript
meta: {
  configName: "My Chromatic System",
  fileSuffix: "-MyNotation",        // cnb:file-suffix (must begin with hyphen)
  notationLabel: "",                // cnb:notation-label
  notationFootnote: "",             // cnb:notation-footnote
  author: "",
  description: "",
  created: null,                    // ISO date, set on first save
  modified: null                    // ISO date, updated on each save
}
```

**↔ LY Spec mapping:**
| Config field | LY Section | LY construct |
|---|---|---|
| `meta.fileSuffix` | B3 | `#(set! cnb:file-suffix "...")` |
| `meta.notationLabel` | B3 | `#(set! cnb:notation-label "...")` |
| `meta.notationFootnote` | B3 | `#(set! cnb:notation-footnote "...")` |
| `meta.configName` | Header | Comment block |

### 4.12 Custom Clef (added set 009)

> **Addendum (set 009, July 2026).** Added by session-set `009-custom-clefs`
> per the E1 entry of the gallery-survey enhancement requirements
> (`docs/research/gallery-survey/enhancement-requirements.md`). In the
> config OBJECT the section sits between `keys` and `engine` (see §4.1);
> it is numbered 4.12 here to keep the existing section anchors stable.

```javascript
clef: {
  // With enabled:false the preview draws no clef, and since session 30 the
  // export writes cnb:clef-style 'none, so the engraving draws none either
  // (not the engine's default dozenal clef).
  enabled: false,

  // Name of the active definition in `glyphs`, or null.
  active: null,

  // Open-keyed map of named clef definitions (config-IO REPLACE_PATHS
  // member, like `shapes`). Three kinds:
  //   kind "glyph" — imported SVG (toolkit contract: svgPath, natural
  //                  dimensions, semitoneHeight, viewBox min offsets,
  //                  optional pre-baked lilypondPath), or a treble, bass
  //                  or alto clef chosen in the panel (session 45)
  //   kind "text"  — register label (octave numeral/letter) rendered as
  //                  an SVG <text> sized by textHeightSemis
  //   kind "dozenal" — the engine's dozenal clef (session 45): no path
  //                  or anchor; the engine draws and places it on the
  //                  middle line, at semitoneHeight (session 59: null =
  //                  automatic, 3 symbol spaces)
  glyphs: {
    // "express-b": {
    //   displayName: "Express B Clef",
    //   kind: "glyph",
    //   svgPath: "M ...",
    //   naturalHeight: 300, naturalWidth: 100,
    //   semitoneHeight: 6,          // or null = automatic (session 59),
    //   staffSpaceUnits: 100,       //   needing this: native units a staff space
    //   viewBoxMinX: 0, viewBoxMinY: 0,
    //   reference: { x: 50, y: 150 }, // OPTIONAL anchor point, native units (session 59)
    //   lilypondPath: null,
    //   anchorSemi: 20              // the anchor's semitone; the TOP edge's
    //                               //   without a reference (see below)
    // }
  },

  // Horizontal padding (px) each side of the glyph in the preview's left
  // gutter. Gutter width = glyph width + 2 × paddingH; no gutter is
  // reserved while disabled.
  gutter: { paddingH: 12 }
}
```

**Design notes:**
- **Per-definition float anchor.** `anchorSemi` lives on EACH definition,
  stored as a float. Surveyed designs (Bravura/SMuFL gClef, Clairnote 2017
  clefs, Express Stave F/B/D) register clefs by interior musical features.
  Since session 59 a glyph definition may name that feature: `reference
  { x, y }`, its anchor point in native SVG units, and `anchorSemi` is then
  the semitone the anchor sits on. The glyph's top is drawn and exported
  `depth = (reference.y − viewBoxMinY) ÷ naturalHeight × height` above it
  (`CNBClef.shown`), on a pitch axis by the axis position. A definition
  without a reference, every clef saved before session 59 and every text
  clef among them, keeps `anchorSemi` as its TOP edge (the fractional
  `markedPitchSemi + k` of set 009), and draws and exports as before.
  Validation accepts any finite number and warns outside −24…72; a
  reference must be a point of finite numbers.
- **The size (session 59).** A glyph clef's `semitoneHeight` may be
  `null`, automatic, when it gives `staffSpaceUnits`, the native units in
  one of LilyPond's staff spaces (250 for Emmentaler's clefs): its height
  is `naturalHeight ÷ staffSpaceUnits × CNBStaff.symbolSpace(config)`, its
  LilyPond size in the staff's symbol spaces (Module 3: the least of the
  noteheads' mean crotchet height, one staff space and 3 semitones). The
  dozenal clef's automatic size is 3 symbol spaces: 8.172 semitones on the
  default staff, 9 on Kite 4-369. A number set by hand stays when the
  noteheads or the staff change. The operator picked the rule from
  mock-ups (`docs/planning/clef-size-mockups/`).
- **Grid-positioned rendering (Module 20, `cnb-clef.js`).** The clef
  renders into a left gutter column of the card collection; the glyph top
  is placed at `semiToY(top)`, the top `CNBClef.shown` gives (`anchorSemi`
  itself without a reference) — the grid module is the positioning
  system, as §5 Module 1 anticipated for clefs.
- **Import rides the shape pipeline.** Clef glyphs are imported through
  Module 16 (`extractClef` / `buildClefGlyph` / `parseClefSvgText`),
  reusing the toolkit `data-*` contract; stem/anchor attributes are not
  required for clefs. Since session 59 an imported glyph takes its box's
  centre as its anchor point, on `staff.midpoint`, and the panel opens a
  picker on the enlarged glyph where a click moves it.
- **Clefs to choose from (session 45).** The Clef panel's buttons add a
  clef without an import (`ui/builtin-clefs.js`): the dozenal clef, drawn
  as the engine engraves it under the score's default treble clef (the
  numeral 50, its digits TeX Gyre Schola Bold, GUST Font License, centred
  on the middle line), and LilyPond's own treble, bass and alto glyphs
  (Emmentaler `clefs.G`, `clefs.F`, `clefs.C`, SIL OFL 1.1), each with its
  line on the pitch it marks (G, F, C) in the octave nearest
  `staff.midpoint`. Since session 59 each has its anchor point on that line
  (the treble clef's curl, the point between the bass clef's dots, the alto
  clef's middle; the operator confirmed them from the mock-ups) and the
  automatic size, 250 units a staff space, so it is LilyPond's size in
  symbol spaces. The licences are in `cnb/assets/fonts/`.
- **Moving and resizing a clef (session 45, session 59).** A glyph clef
  is shown from its top to `height` below it. The panel edits where it
  sits ("Sits on semitone", or "Top at semitone" for a clef without an
  anchor point) and its height (automatic, or a number of semitones), and
  with the Clef section open the canvas moves the clef by a drag on it and
  resizes it by a drag on its bottom edge, about its anchor. Both write
  through `CNBClefEditor.withAnchor` and `withHeight` (session 45's
  `withRange`, which set the top and bottom, is gone). The dozenal clef
  takes the height and resizes about the middle line. A card row's grid
  widens to hold a clef that reaches past its noteheads
  (`CNBCollection.gridRange(pcs, config)`, from `CNBClef.extent`). Text
  clefs keep their top field.
- **LilyPond export (session 30, LY spec 1.3.7 §5.5).** Set 009 wrote
  nothing for clefs, because the engine then had no clef hook
  (`docs/session-sets/009-custom-clefs/s1-engine-coordination.md`). Its
  set 005 added one, and the exporter now always writes `cnb:clef-style`:
  `'none` when no clef is shown (the default config included), `'custom`
  for a glyph, registered with `cnb:register-clef!` (path, top-edge
  anchor on the engine's axis, height, colour), or `'text` for a text
  clef, as a markup of its font, colour and weight at its height. A shown
  clef also gets its gutter, `paddingH ÷ pxPerSemi` semitones, on the right
  only. The engine places a text clef at a fixed height of its own rather
  than at `anchorSemi`, a known divergence. Since session 59 (LY spec
  1.3.21 §5.5, §5.5a) `cnb:register-clef!` carries the top and height the
  preview draws, from the anchor, and the dozenal clef writes
  `cnb:clef-size-semitones`, which engine 1.8.0 scales about the middle
  line.

### 4.13 Pitch Axis (added set 014)

> **Addendum (set 014, July 2026).** Added by session-set
> `014-pitch-axis-implementation`, implementing the operator-approved
> design [`docs/planning/pitch-axis-design.md`](planning/pitch-axis-design.md)
> (the I2 relaxation from the set-013 engine discovery — feasibility-matrix
> records 32–40, the Twinline family). The design doc is the authoritative
> specification for this section; this addendum summarizes it. In the
> config OBJECT the section sits between `staff` and `ledgers` (see §4.1);
> it is numbered 4.13 here to keep the existing section anchors stable.

```javascript
pitchAxis: {
  // Master gate. false (or the whole section absent) = today's linear
  // behavior, byte-identical (design §1.3).
  enabled: true,

  // Version tag for the map model. Single-value vocabulary, the extension
  // point for future axis kinds; validation rejects unknown values and
  // consumers treat an unknown kind as inactive (the set-010 style/rule
  // vocabulary pattern).
  kind: "pitch-class-map-v1",

  // Axis positions advance by this much per octave. 12 pitch classes on 7
  // positions (Twinline-like) → 7. Linear behavior would be 12.
  octaveStride: 7,

  // The unit contract (design §1.2): how many axis units make one LilyPond
  // staff space. When enabled, this REPLACES staff.semitonesPerStaffSpace
  // in every semitone→staff-space unit conversion, and positionOfSemi
  // replaces identity in every semitone→grid-position read. Lengths
  // expressed in semitone units are unchanged.
  axisUnitsPerStaffSpace: 2,

  // The explicit pitch-class → position map. Exactly one entry per pc
  // 0–11. position is a finite number in axis units within the octave;
  // fractional values are allowed (non-uniform 1:1 axes use them).
  // positionOfSemi(s) = pitchClasses[pc(s)].position + octave(s) × octaveStride
  // (fractional semitone input interpolates linearly between the two
  // adjacent integer semitones' positions).
  pitchClasses: [
    { pc: 0,  position: 0 }, { pc: 1,  position: 0 },
    { pc: 2,  position: 1 },
    { pc: 3,  position: 2 }, { pc: 4,  position: 2 },
    { pc: 5,  position: 3 }, { pc: 6,  position: 3 },
    { pc: 7,  position: 4 },
    { pc: 8,  position: 5 }, { pc: 9,  position: 5 },
    { pc: 10, position: 6 }, { pc: 11, position: 6 }
  ]
}
```

**Design notes:**
- **Semitones remain pitch identity everywhere; axis positions are
  geometry only.** `CNBPitchAxis` (Module 24, `cnb-pitch-axis.js`) is the
  sole owner of the mapping; consumers reach it through the grid context
  (`gridContext.axis`).
- **Default-off byte-identity by construction (design §1.3, deviation
  D3):** disabled/absent `pitchAxis` runs the LITERAL pre-existing code
  paths (the current `semiToY` body, the current exporter functions), not
  an equivalent re-derivation. **`createDefault()` does not gain a
  `pitchAxis` section** — a named deviation from the sets-009/010
  default-off-stub pattern, because an absent section is already a fully
  defined state and byte-identity is the governing constraint. Module A's
  `merge` needs no change (`pitchClasses` is an array — replaced
  wholesale) and config-IO needs no `REPLACE_PATHS` entry (fixed-shape
  section).
- **Validation (design §1.4):** blocking errors PA-1…PA-8 (kind
  vocabulary; exact 12-pc map; positive finite stride/units; no
  conflicting overrides on collapsing ledger/staff lines; finite
  `xOffsetStaffSpaces`; globally non-decreasing map — non-monotonic maps
  are REJECTED in `pitch-class-map-v1`) and warnings PA-W1/W3/W4
  (positions outside `[0, octaveStride)`; indistinguishable
  shared-position pairs; `xOffsetStaffSpaces` on a linear config). All
  checks except PA-W4 are gated on `pitchAxis.enabled` — configs
  predating the feature validate exactly as before.
- **Disambiguation field:** notehead rules' `apply` blocks gain optional
  `xOffsetStaffSpaces` (staff-space units; negative = left; missing/0 =
  centered), resolved through the normal cumulative-rule pipeline
  (`resolveNotehead` default 0). Its whole lifecycle is axis-gated
  (design §3.2, deviation D2): preview applies it only in axis mode and
  export emits it only when enabled ∧ nonzero.
- **Export surface:** per the canonical
  [`CNB-LY-EXPORT-SPEC-v1_3.md`](CNB-LY-EXPORT-SPEC-v1_3.md) (adopted by
  set 014 session 1): compiled `cnb:get-pitch-staff-position` procedure,
  axis-formula staff-line positions with collapse dedup,
  `axisUnitsPerStaffSpace` substitutions (including the emitted
  `cnb:semitones-per-staff-space`), an explicit `cnb:keysig-tonic-octave`,
  Section C `(x-offset . N)`. The spec §8a fail-loud gate was lifted by set
  014 session 3 (spec 1.3.1), once the engine's set-008 handoff recorded
  E13-1/E13-2 as shipped and an engine round-trip confirmed preview parity.

---

## 5. Module Specifications

### Module A: Config Schema

**Purpose:** Define the canonical config structure, provide defaults, validate configs, handle versioning.

**File:** `cnb-config.js`

**API:**

```javascript
// Create a config with all defaults filled in
CNBConfig.createDefault() → config

// Validate a config, return errors and warnings
// (Mirrors LY Spec §8: Export Validation checks)
CNBConfig.validate(config) → { valid: boolean, errors: string[], warnings: string[] }

// Merge a partial config over defaults (deep merge)
CNBConfig.merge(partial) → config

// Deep-clone a config
CNBConfig.clone(config) → config

// Get the schema version
CNBConfig.VERSION → string

// Resolve a notehead config for a given pitch class, duration, and key
// (Walks noteheadRules in priority order, merges apply blocks)
CNBConfig.resolveNotehead(config, pc, duration, key) → { shape, hollow, color, offKeyMark, xOffsetStaffSpaces, heightSemis, widthSemis }

// A config saved with a palette, its colours moved onto the noteheads
// (session 37, §4.6): called when a config loads
CNBConfig.paletteToRules(config) → config

// A config saved with a key-signature style, converted to the one model
// (session 54, §4.9): called by CNBConfigIO.mergeLoaded before the
// defaults are merged; idempotent
CNBConfig.signatureStyleToModel(config) → config

// Compute preview thickness in px from a percentage
CNBConfig.pctToPx(pct, pxPerSemi) → number
```

**Validation checks (from LY Spec §8):**
Errors (blocking):
1. Every shape referenced by rules has been imported and has path data
2. Every hollow reference has corresponding hollow path data
3. All 12 pitch classes are covered by at least one shape rule
4. At least 2 staff lines defined
5. `meta.fileSuffix` begins with hyphen (if non-empty)
6. Rule colour hex values match `#RRGGBB` format

Warnings (non-blocking):
1. Notation label is empty
2. A PC is assigned hollow but its shape has no hollow path
3. Shape imported without `data-lilypond-*` (will use fallback conversion)

(Session 37 removed the palette checks, and the warning that some pitch
classes have no colour: many notations stay black.)

**Dependencies:** None

---

### Module B: Music Theory Utilities

**Purpose:** Pitch class arithmetic, note naming, octave math.

**File:** `cnb-music.js`

**API:**

```javascript
// Pitch class from absolute semitone (always 0–11)
CNBMusic.pitchClass(semi) → number

// Octave number from absolute semitone
CNBMusic.octave(semi) → number

// Absolute semitone from pitch class + octave
CNBMusic.absoluteSemi(pc, octave) → number

// Pitch class label object (for rendering)
CNBMusic.pcLabel(pc) → { text: string, sharp: boolean }

// All 13 labels for a chromatic row (C through C')
CNBMusic.chromaticLabels() → [ { text, sharp }, ... ]

// Which octave region "owns" a given absolute semitone for ledger purposes
// (Used by Module 5 for octave-aware ledger logic)
CNBMusic.ledgerOctaveRegion(semi) → number

// The seven modes LilyPond's \key names, and a key's pitch classes (session 36)
CNBMusic.MODES → { major: [0, 2, 4, 5, 7, 9, 11], minor: …, … }
CNBMusic.scale(tonicPc, mode) → number[]

// Key spelling (session 48, key-signature design §3): a seven-note key
// spelled on the seven letters from its tonic's name, each note from the
// tonic up with its alteration (−1 flat, 0 natural, 1 sharp), null without
// a spelling free of double sharps and flats; each mode's 15 tonic names
// with at most seven sharps or flats, in pitch-class order; and the tonic's
// name with the fewest sharps and flats, a tie to the sharp
CNBMusic.spell(tonicName, pitchClasses) → [{ pc, alteration }] | null
CNBMusic.spellings(mode) → string[]           // "C", "C♯", "D♭", … (15)
CNBMusic.defaultSpelling(tonicPc, pitchClasses) → string
```

**Test cases:**
- `pitchClass(0)` = 0, `pitchClass(12)` = 0, `pitchClass(-1)` = 11
- `octave(0)` = 0, `octave(12)` = 1, `octave(23)` = 1, `octave(24)` = 2
- `absoluteSemi(0, 1)` = 12
- `pcLabel(0)` = `{ text: "C", sharp: false }`
- `pcLabel(1)` = `{ text: "C", sharp: true }`
- Negative semitone values handled correctly

**Dependencies:** None

---

### Module 1: Semitone Grid

**Purpose:** Coordinate system for all rendering. Converts between semitone positions and pixel coordinates. Renders a visible debug grid for visual confirmation. Will also serve as the positioning system for future elements like clefs.

**File:** `cnb-grid.js`

**API:**

```javascript
// Create a grid context from config and note range
CNBGrid.create(config, {
  minSemi: number,            // lowest semitone to accommodate
  maxSemi: number             // highest semitone to accommodate
}) → gridContext

// gridContext:
{
  pxPerSemi: number,
  minSemi: number,
  maxSemi: number,
  totalSemiRange: number,
  svgHeight: number,          // totalSemiRange × pxPerSemi

  semiToY(semi) → number,    // semitone → Y pixel (higher pitch = lower Y)
  yToSemi(y) → number,       // Y pixel → semitone (inverse, for debugging)

  topLabelHeight: number,     // px reserved for top label area
  bottomLabelHeight: number,  // px reserved for bottom label area
  totalHeight: number         // topLabelHeight + svgHeight + bottomLabelHeight
}

// Render a debug grid overlay into an SVG element
CNBGrid.renderDebugOverlay(svgParent, gridContext) → SVGGElement
// Draws faint horizontal lines at every semitone, numbered.
// Staff line positions highlighted in a distinct color.
// Useful during development and for visual verification.
```

**Visual test page:** Standalone HTML that creates a grid and renders the debug overlay. Semitone positions labeled, staff positions highlighted. This is the first visual confirmation that the coordinate system works.

**Test cases:**
- `semiToY(maxSemi)` = 0 (top of SVG, highest pitch)
- `semiToY(minSemi)` = svgHeight (bottom of SVG, lowest pitch)
- `semiToY` and `yToSemi` are exact inverses
- `svgHeight` = `totalSemiRange × pxPerSemi`
- `totalHeight` = `topLabelHeight + svgHeight + bottomLabelHeight`

**Dependencies:** Module A (reads `display` config for pxPerSemi and label settings)

---

### Module 2: Staff Line

**Purpose:** Render a single horizontal staff line.

**File:** `cnb-staff-line.js`

**API:**

```javascript
// Render a single staff line
CNBStaffLine.render(svgParent, {
  y: number,                  // Y position (from grid.semiToY)
  x1: number,                // start X
  x2: number,                // end X
  thickness: number,          // px (already converted from pct)
  color: string,              // CSS color
  style: string               // "solid" | "dashed" | "dotted"
}) → SVGLineElement
```

**Dependencies:** None (pure SVG element factory)

---

### Module 3: Staff

**Purpose:** Render the complete staff from config. Computes absolute staff line positions from the semitone pattern.

**File:** `cnb-staff.js`

**API:**

```javascript
// Compute all absolute staff line positions for a given note range
CNBStaff.getPositions(config, noteRange) → number[]
// Expands semitonePattern across octaves, filters to those relevant for noteRange.

// Render all staff lines into an SVG group
CNBStaff.render(svgParent, gridContext, config, totalWidth) → SVGGElement

// Get the staff midpoint
CNBStaff.getMidpoint(config) → number

// LilyPond staff positions, half staff spaces from the middle (session 34):
// the exported staff lines, and one semitone's position
CNBStaff.lilypondPositions(config) → number[]
CNBStaff.lilypondPosition(config, semi) → number

// Pixels per staff space on a grid (axis units under a pitch axis)
CNBStaff.staffSpacePx(config, gridContext) → number

// The staff's symbol space (session 59), in semitones (axis units under a
// pitch axis): the least of the noteheads' mean crotchet height (the twelve
// pitch classes, no key), one staff space and 3. 2.724 on the default
// staff, 3 on Kite 4-369, 2 on Twinline. The key signature's automatic
// signs (CNBKeySignature.signHeight) and the clefs' automatic size
// (Module 20: a glyph's naturalHeight ÷ staffSpaceUnits of them, the
// dozenal clef 3) follow it.
CNBStaff.symbolSpace(config) → number
```

**Visual test page:** Full-width SVG with staff lines at correct positions, debug grid visible. Default 4-8 (lines at 4, 8, 16, 20).

**Test cases:**
- 4-8 pattern → positions [4, 8, 16, 20]
- 3-6-9 pattern → positions [3, 6, 9, 15, 18, 21]
- Line overrides applied correctly
- Thickness converted from pct

**Dependencies:** Module 1, Module 2, Module A

---

### Module 4: Ledger Line

**Purpose:** Render a single ledger line (unconditionally). Does not evaluate display rules.

**File:** `cnb-ledger-line.js`

**API:**

```javascript
// Render a single ledger line
CNBLedgerLine.render(svgParent, {
  y: number,                  // Y position
  centerX: number,            // horizontal center of column
  width: number,              // total width
  thickness: number,          // px (already converted from pct)
  color: string,
  style: string,
  roundedEnds: boolean        // if true, <rect> with rx/ry; else <line>
}) → SVGElement
```

**Dependencies:** None (pure SVG element factory)

---

### Module 5: Ledger Set

**Purpose:** Evaluate ledger display rules for a set of noteheads and render the correct ledger lines. This module contains the most complex logic.

**File:** `cnb-ledger-set.js`

**API:**

```javascript
// Expand templates into absolute positions for all relevant octaves
CNBLedgerSet.buildDefs(config, noteRange) → ledgerDef[]
// Each: { semi, triggerPCs, triggerMode, overrides }

// Determine which ledgers to show for a set of note semitones
CNBLedgerSet.resolve(noteSemitones, ledgerDefs, staffPositions) → number[]
// Returns absolute semitone positions of ledgers to display.

// Render resolved ledger lines
CNBLedgerSet.render(svgParent, gridContext, config, noteSemitones) → SVGGElement

// The ledgers render draws for a set of notes on a grid spanning range
// (session 34; the export writes them per pitch, LY spec 1.3.9 §5.7)
CNBLedgerSet.ledgersFor(config, noteSemitones, range, axis) → number[]

// LilyPond's ledger length for a notehead (or repeated group) width: × 1.5
CNBLedgerSet.width(headWidth) → number
```

**Ledger display algorithm:**

```
resolve(noteSemitones, ledgerDefs, staffPositions):
  result = empty set

  for each noteSemi in noteSemitones:
    pc = pitchClass(noteSemi)
    noteOctaveRegion = ledgerOctaveRegion(noteSemi)

    for each ld in ledgerDefs:
      ldOctaveRegion = ledgerOctaveRegion(ld.semi)

      // Octave awareness: only consider ledgers in same octave region as note
      if ldOctaveRegion ≠ noteOctaveRegion: continue

      if ld.triggerMode == "override":
        if pc in ld.triggerPCs:
          // Show this ledger if it's between the note and the nearest staff line
          if isBetweenNoteAndStaff(noteSemi, ld.semi, staffPositions):
            result.add(ld.semi)

      else if ld.triggerMode == "proximity":
        nearestStaff = closest(staffPositions, noteSemi)
        if |noteSemi - ld.semi| < |noteSemi - nearestStaff|:
          if isBetweenNoteAndStaff(noteSemi, ld.semi, staffPositions):
            result.add(ld.semi)

  return result
```

**Key: No "outside staff" hard filter.** The algorithm does not skip ledgers that fall between staff lines. If a staff configuration has a gap (e.g., 3-6-9 system has a gap between semi 9 and semi 15), a ledger template at semi 12 within that gap CAN be shown if a notehead triggers it. The `isBetweenNoteAndStaff` check ensures ledgers only appear where they help connect a note to the staff — it doesn't require the ledger to be outside the staff's outer boundaries.

**`isBetweenNoteAndStaff(noteSemi, ledgerSemi, staffPositions)`:**
True when the ledger is on the path from the note to the nearest staff line. Specifically:
- If noteSemi < ledgerSemi: the ledger is above the note. There must be a staff line above the ledger (ledgerSemi < some staffPosition).
- If noteSemi > ledgerSemi: the ledger is below the note. There must be a staff line below the ledger.
- If noteSemi == ledgerSemi: the ledger is at the note position — show it if the note isn't on a staff line.

**Visual test page:** Column with noteheads at various positions (on staff, in gaps, far outside), showing ledger resolution.

**Test cases:**
- C (semi 0): C-ledger shown at semi 0, connects note to staff at 4
- D (semi 2): C-ledger (semi 0) and D-ledger (semi 2) both shown
- E (semi 4, on staff line): no ledgers needed
- F (semi 5): no ledgers (inside staff between 4 and 8)
- C' (semi 12): depends on staff config — in 4-8, it's between staff lines 8 and 16 (inside staff, no ledgers). In 3-6-9, it's in the gap between 9 and 15, so ledger at 12 could be triggered.
- C'' (semi 24): upper C-ledger shown
- A♯ (semi 22): A♯-ledger shown above staff line 20
- Octave awareness: lower C ledger (semi 0) NOT triggered by note at semi 24

**Dependencies:** Module 4, Module 1, Module B, Module A

---

### Module 6: Notehead

**Purpose:** Render a single notehead shape at a pitch position.

**File:** `cnb-notehead.js`

**API:**

```javascript
// Compute rendering parameters
CNBNotehead.measure(shape, pxPerSemi) → {
  scaleFactor: number,
  pixelWidth: number,
  pixelHeight: number
}

// Render a single notehead
CNBNotehead.render(svgParent, {
  shape: shapeConfig,         // from config.shapes[name]
  x: number,                 // center X
  y: number,                 // center Y (from grid.semiToY)
  scaleFactor: number,
  hollow: boolean,
  color: string               // fill color
}) → SVGGElement

// A shape's box: its svgPath's exact extent about its origin, native SVG
// units, Y down (session 55). The key signature measures a symbol placed by
// its origin with it; the exporter's attachments use the same extent.
CNBNotehead.box(shape) → { x: [min, max], y: [min, max] }

// How far a notehead is drawn below its pitch, in px, so that its shape's
// reference point is on the pitch vertically (session 60, §4.5 "Notehead
// placement"): −reference.y × scaleY, 0 without a reference. The double
// notehead, the stem's start and the breve's tie use it.
CNBNotehead.referenceShift(shape, scaleY) → number

// The SVG path parser, its LilyPond commands and their exact extent
// (moved here from Module 11 in session 55, which shares them)
CNBNotehead.parseSvgPath(d), CNBNotehead.svgCommands(d), CNBNotehead.pathExtent(commands)
```

**Dependencies:** Module A (shape config structure)

---

### Module 7: Double Notehead

**Purpose:** Render an octave pair of noteheads within a column.

**File:** `cnb-double-notehead.js`

**API:**

```javascript
// Render a pair (or quad) of noteheads
CNBDoubleNotehead.render(svgParent, gridContext, {
  lowerSemi: number,
  upperSemi: number,
  lowerNote: { shape, hollow, color },
  upperNote: { shape, hollow, color },
  centerX: number,
  offsetPercent: number       // horizontal offset for collision avoidance (0 = none)
}) → { lowerG: SVGGElement, upperG: SVGGElement, lowerY: number, upperY: number }
```

**Dependencies:** Module 6, Module 1

---

### Module 8: Stem

**Purpose:** Render a stem connecting noteheads, using the 4-point anchor model.

**File:** `cnb-stem.js`

**API:**

```javascript
// Determine stem direction
CNBStem.direction(chordSemitones, staffMidpoint) → "up" | "down"

// Compute stem geometry using 4-point anchor model
CNBStem.geometry(config, {
  gridContext,                // the grid: its staff space and middle line (session 34)
  shape: shapeConfig,
  scaleFactor: number,
  centerX: number,
  noteYPositions: number[],
  direction: "up" | "down",
  duration: string            // needed to select crotchet vs. minim anchor
}) → { x: number, y1: number, y2: number, thickness: number } | null

// Render a stem line
CNBStem.render(svgParent, stemGeometry) → SVGLineElement | null

// LilyPond's stem length past the far notehead, in half staff spaces
// (session 34), from the far notehead's position and the staff's lines
CNBStem.length(far, staffPositions) → number
```

**4-point anchor model:**
The stem attachment point depends on BOTH direction (up/down) AND duration (filled/hollow):
- Stem up, crotchet (filled): use `anchors.crotchetUp`
- Stem up, minim (hollow): use `anchors.minimUp`
- Stem down, crotchet: use `anchors.crotchetDown`
- Stem down, minim: use `anchors.minimDown`

**The engine's stem (session 34).** The preview draws LilyPond's stem, measured against the engine, in staff spaces (`semitonesPerStaffSpace` semitones, or `axisUnitsPerStaffSpace` axis units under a pitch axis):
```
thickness = 0.13 staff spaces                    (1.3 staff-line thicknesses)
length    = 3.5 staff spaces past the far notehead's centre, crotchet and minim,
            less a third of a half space for each half space it would reach past
            one staff space beyond the staff's radius, once the far notehead is on
            the middle line or beyond it in the stem's direction, by at most
            1 staff space (LilyPond's stem-shorten; CNBStem.length)
```
The engine sets `no-stem-extend`, so no stem is carried to the middle line. `display.stemThicknessPct`, `display.stemExtension` and `engine.stemThickness` are retired. An engine round trip in `cnb/tests/cnb-card-tests.js` pins the direction, thickness and both ends of every card's stem, crotchet and minim, for the default and Kite fixtures, within 0.001 staff spaces.

**The stem starts at the drawn head (session 60).** A head drawn with its
shape's reference point on its pitch (§4.5) carries its anchors with it:
the stem starts at the anchor's height less the reference's
(`CNBNotehead.referenceShift`), and its far end stays LilyPond's length from
the far notehead's pitch, as LilyPond engraves it (LY spec §4.1e).

**The stem's centre sits on the anchor (session 40).** The anchor is where
the SVG's stem rect puts the stem, so the preview draws a one-head stem
centred on it. LilyPond puts an up stem's right edge and a down stem's left
edge on the attachment point, so the export writes that point half the
stem's 0.13 staff spaces outward of the anchor (LY spec §4.4c). Across a
repeated group LilyPond scales the point with the group, and the preview
places the anchored edge at the same scaled point, its centre half a stem
inward. The engraved and previewed stems then sit at the same place (an
engine round trip in `cnb/tests/cnb-card-tests.js` measures the centre
within 0.001 staff spaces for the default, Kite and 45deg-369 fixtures).
From session 33 to 39 the anchor was the stem's edge, so a stem drawn
centred in its SVG previewed and engraved half a stem off centre.

**Test cases:**
- Stem up: X on right side, extends above upper notehead
- Stem down: X on left side, extends below lower notehead
- Stemless shape (anchors = null) → returns null
- Crotchet vs. minim anchor selection
- Thickness computed correctly from pct

**Dependencies:** Module A

---

### Module 9: Octave Chord Card

**Purpose:** Compose all rendering modules into a single octave-chord card.

**File:** `cnb-card.js`

**API:**

```javascript
// Render a single octave chord card
// Config = notation system. Example data = what to render.
CNBCard.render(container, gridContext, config, {
  pc: number,                 // pitch class (0–11, or 12 for upper C)
  duration: string,           // "crotchet", "minim", etc.
  key: string | null          // key context (future)
}) → HTMLDivElement

// Resolve the full notehead config for a note in this card
CNBCard.resolveNotehead(config, pc, duration, key) → { shape, hollow, color, offKeyMark }
```

**Visual structure:**
```
div.pc-col
├── div.label-top        (Oswald font, material card overlay)
├── svg.note-slice       (ledger lines, stem, noteheads)
└── div.label-bottom     (Oswald font, material card overlay)
```

**Design notes:**
- The card creates its own `<svg>` for the note-slice. Staff lines are NOT drawn here — they're in the background (Module 10).
- The card renders: ledger lines (Module 5), stem (Module 8), noteheads (Module 7).
- Labels use material card styling that masks staff lines extending into label area.

**Dependencies:** Module 1, 5, 7, 8, B, A

---

### Module 10: Card Collection

**Purpose:** Lay out multiple cards in a row or grid, with continuous background staff lines.

**File:** `cnb-collection.js`

**API:**

```javascript
// Render a collection of cards.
// Config = notation system. Options = what to display.
CNBCollection.render(container, config, {
  pitchClasses: number[],       // e.g., [0,1,2,...,12] for full chromatic
  durations: string[],          // which duration rows to show
  keys: string[] | null,        // which key rows to show (future)
}) → HTMLDivElement
```

**Layout options:**
- Single row: one duration, all pitch classes → row of cards
- Duration rows: multiple durations → one row per duration, all sharing a label
- Key rows (future): multiple keys → one row per key

**Visual structure:**
```
div.preview-container
├── svg.staff-lines-bg      (continuous staff lines across all columns)
└── div.pc-columns          (flex row of cards)
    ├── CNBCard for PC 0
    ├── CNBCard for PC 1
    └── ...
```

**Dependencies:** Module 3, Module 9, Module 1, Module A

---

### Module 11: LilyPond Exporter

**Purpose:** Generate `.ly` file content from config JSON, following the LY Export Spec v1.2.

**File:** `cnb-lilypond.js`

**API:**

```javascript
// Generate complete .ly file
CNBLilypond.generate(config) → string

// Generate individual sections (for testing / inspection)
CNBLilypond.header(config) → string          // File header with comments
CNBLilypond.sectionA(config) → string        // Named definitions (paths, colors, attachments)
CNBLilypond.sectionB(config) → string        // Engine settings
CNBLilypond.sectionC(config) → string        // Configuration procedure

// Helpers
CNBLilypond.svgPathToLilypond(svgPath) → string   // Fallback SVG→LY path conversion
CNBLilypond.toSchemeSymbol(name, hex) → string     // "Shamrock" + "#1B9E77" → "shamrock-1b9e77"
```

**Section generation details:**

**Section A:**
For each shape in `config.shapes`:
- A1: Emit path definition (prefer `lilypondPath`, fall back to `svgPathToLilypond(svgPath)`)
- A2: Register path
- A3: Emit hollow cutout (if exists) and register
- A4: Emit attachment points from `lilypondAnchors`

For the colours the noteheads use (§4.6):
- A5: Register each once, named from its hex, with no accessible branch (LY spec 1.3.10 §4.5a)

**Section B:**
- B1: Staff geometry from `config.staff`
- The clef and the key signature (LY spec §5.5, §5.6); a signature that is
  not the engine's scale stack as the mark table, from
  `CNBKeySignature.marks`, whose looks Section A also registers (§5.6a);
  a traditional signature's sharps and flats as the table's signs (1.3.17);
  each mark as its symbols, placed with `(at dx . dy)`, the `symbol` kind
  and a sign's colour (1.3.19, engine 1.6.0)
- B2: Emit-if-changed engine settings from `config.engine`
- B3: Metadata from `config.meta`

**Section C:**
- Resolve all 12 PCs (× durations if duration-aware) via `CNBConfig.resolveNotehead()`
- Group PCs with identical resolved configs
- Emit `cond` clauses using `memv` grouping
- Include `repeat` field based on `config.durations.representationMode`

**Test cases:**
- Default config produces valid LY output
- Path conversion produces correct LilyPond path syntax
- Each colour the noteheads use is registered once, with no accessible branch
- Emit-if-changed: default engine values are omitted
- PC grouping: identical configs are merged into single `memv` clause
- Duration-aware rules produce compound conditions

**Dependencies:** Module A, Module B

---

### Modules 12–19: UI Components (Phase 5)

Detailed specifications deferred. Summary:

| Module | Scope | Existing Code to Migrate |
|--------|-------|--------------------------|
| 12 — Palette Editor | *Retired in session 37* (§4.6): the curated sets are suggestions in the notehead panel | `music-color-palettes.js`, palette popup |
| 13 — Staff/Ledger Rule Editor | Pattern selection, line overrides, ledger templates | Staff rules panel |
| 14 — Notehead Rule Editor | Create/edit rules by pitch/duration/key | Notehead cards |
| 15 — Common Properties | Durations, representation mode, engine settings | Partial |
| 16 — SVG Shape Importer | Parse SVG for paths, anchors, LY data attributes | SVG importer |
| 17 — Config Save/Load | JSON export/import | New |
| 18 — Config Export (LY) | LilyPond file download (wraps Module 11) | LY export button |
| 19 — Preview Display | Full preview with range/duration/key controls | New (replaces monolith preview) |

---

### Modules 20–21: Custom Clef (added set 009)

**Module 20 — Clef Renderer** (`cnb-clef.js`, Rendering): pure
config-in/DOM-out renderer for the `clef` config section (§4.12). API:
`activeGlyph(config)` (resolves the active definition or null),
`shown(config)` (session 59: the shown clef, `{ name, def, height, top }`,
its height set or automatic and its top from its anchor point, `top` null
for the dozenal clef; null when no clef is shown — measure, extent,
gutterWidth, render, the key signature's spacing after a clef and the
export all read it), `measure(def, pxPerSemi, staffSpacePx, height)` (at
the height `shown` gives; the dozenal kind 3 staff spaces without one),
`gutterWidth(config, pxPerSemi)` (0 when no clef renders — the collection
reserves no gutter), `staffSpacePx(config, pxPerSemi)`, `extent(config)`
(the shown clef's top and bottom in semitones, session 45; the dozenal
numeral scaled about the middle line, session 59), and
`render(svgParent, gridContext, config)` (glyph TOP edge at
`semiToY(shown.top)`, left edge at `gutter.paddingH`, with a hidden
`rect.cnb-clef-resize` on a glyph's bottom edge that the editor's canvas
shows; the dozenal numeral on the middle line, at its height). Integrated into
Module 10 as a `div.clef-col` prepended inside `.pc-columns` behind
`clef.enabled`; the background staff SVG spans the gutter.
Dependencies: Module 1, Module 3 (the symbol space), Module A. Visual test
page: `test-clef.html`. Since session 30 Module 11 exports the clef this
module draws (`CNBClef.activeGlyph` decides both; LY spec 1.3.7 §5.5), and
since session 59 at the top and height `CNBClef.shown` gives (LY spec
1.3.21).

**Module 21 — Clef Editor** (`ui/clef-editor.js`, UI): edits the `clef`
section — enable toggle, the Dozenal, Treble, Bass and Alto buttons
(session 45, `ui/builtin-clefs.js`), clef glyph import (wraps Module 16's
`parseClefSvgText`), glyph selection, where the clef sits ("Sits on
semitone", the anchor's; "Top at semitone" for a text clef or a glyph
without an anchor point; float, step "any"), through the pure
`withAnchor(clef, semi)`, its height (the drawn height, and "Automatic:
follows the staff and its noteheads" where the clef can be automatic),
through the pure `withHeight(clef, height | null)`, both of which the
canvas drag also uses (session 59; they replace `withRange`), the anchor
picker ("Pick the anchor point", opened after an import: a click on the
enlarged glyph moves `reference`, through the key-signature editor's
`referenceGeometry` / `referenceAt`), the dozenal clef's height, and gutter
sizing. Same editor contract as Modules
12–17: property-based event wiring (Node-testable `render()`), pure
`buildClef` / `applyToConfig` / `stateFromConfig` builders, Module A
validation pass-through, `onChange({ clef }, state)`. Dependencies:
Module A, Module 16, Module 20, the key-signature editor's reference
picker, the built-in clefs.

---

### Modules 22–23: Custom Key Signature (added set 010)

**Module 22 — Key Signature Renderer** (`cnb-key-signature.js`,
Rendering): pure config-in/DOM-out renderer for the `keys.keySignature`
config section (§4.9). The displayed key is EXAMPLE DATA — it arrives as
the `keyName` argument (the collection passes `options.keys[0]`), never
from the config. API: `parseTonicPc(name)`, `activeKey(config, keyName)`,
`tonicPc(def)`, `tonicSemi(config, def)`, `marks(config, key)` (session
48, key-signature design §8: for a key definition, with its tonic and
optional `spelling`, the marks as `{ semi, column, mark }`, the columns'
centres and the gold stems in staff spaces, for every setting of §4.9
(the marks that overlapped in a stack until session 56, which replaced
them with `touches`); since session 54 the one model of
design §13, each mark `{ semi, column, mark, symbols }`, `mark` its
resolved look (a sign mark `{ sign, scale, color, … }`) and `symbols` its
base then its added symbols, each `{ kind: "head" | "sign" | "symbol",
shape | sign, hollow, color, heightSemis, widthSemis, scale, reference,
x, y }`, x and y where its origin goes from its stack's line and the
mark's pitch in staff spaces, y up; the columns the farthest reach right
of a line plus the farthest reach left apart; under `"fifths"` one mark to
a column in the cycle of fifths, its height in the scale or in its line
set's window; null for an unknown rule), `isScaleStack(config)` (the
signature the engine's `'chord` draws), `signHeight(config)` (session 52:
the signs' size in semitones, `{ semis, automatic }`, §4.9),
`signScale(config)` (the factor the signs are drawn and exported at: the
size ÷ the sharp's bar spacing in the optical size drawn ÷ the semitones
per staff space), `signatureSemis(config, keyName)`
(the marks' semitones), `keys(config)` (session 56: the 105 keys, the 7
modes' 15 spellings, each as the canvas's picker gives it, which the mark
table and the touch check share), `touches(config, key)` (session 56,
design §13.7: the pairs of whole marks, a base with its added symbols, in
one stack or neighbouring stacks, every line set's copy and the seams
included, whose ink meets, found by their boxes and then by their paths
filled into a mask of 40 cells a staff space, a hollow head's cut-out left
out), `touchingKeys(config)` (the keys of the 105 whose marks touch, with
their counts, empty while the signature is off; the checks list warns
"Marks touch in N keys", never blocking the export),
`measure(config,
pxPerSemi, keyName)`, `padding(config, pxPerSemi, keyName,
firstHeadCenter)` (the engine's spacing either side of the marks, session
34; the collection passes the first card's `CNBCard.headCenterX`),
`gutterWidth(config, pxPerSemi, keyName, firstHeadCenter)` (0 when
nothing renders — no gutter reserved), and `render(svgParent,
gridContext, config, keyName)`. Marks resolve through
`CNBConfig.resolveNotehead(config, pc, "crotchet", keyName)` (the
engine's quarter-note keysig resolution), with ledger lines beneath the
marks (keysig.ly's two-pass layering: every ledger before any mark); since
session 48 the looks of §4.9 are laid over them. The separator runs
between each pair of neighbouring columns beneath the marks (the engine's
gold bar geometry, one bar for the default two). `measure` and `render`
draw from `marks`, and at the defaults draw exactly as before
(`cnb/fixtures/key-signature-baseline.json`). A sign (session 51) is
Emmentaler's outline from `cnb-accidental-glyphs.js`, in the optical size
LilyPond picks for `engine.defaultMagnify` (the design size nearest 20 pt
× the magnification), black unless a look colours it (session 54), its
box centred on its point and its origin at its semitone, with no ledgers,
scaled about its origin by `signScale` (session 52). Since session 54 a
symbol is placed by its shape's `reference` plus the look's `offset`, or
its box centred there without one; a head's ledgers follow its base and
are 4/3 of its base's width; a symbol whose shape has `ledgers: false`,
a sign and an added symbol take none (design §13.3–§13.6). Every
signature is spaced by its ink. The spacing after a clef and to the first
note follows `engine.defaultMagnify` as the engine engraves it (session
52, LY spec §5.6a). An unknown placement rule renders nothing.
Integrated into Module 10 as a `div.keysig-col`
after the clef column. Dependencies: Modules A, B, 1 (grid context passed
in), 5, 6, the accidental glyphs. Visual test page: `test-key-signature.html`. Since session 30
Module 11 exports the signature's on/off state, bar styling and explicit
tonic octave, so the engine engraves what this module draws (LY spec
1.3.7 §5.6).

**Module 23 — Key Signature Editor** (`ui/key-signature-editor.js`, UI):
edits the whole `keys` section — the `keys.enabled` master gate, the key
definitions (name, pitch-class pills, optional explicit tonic; the
definition controls live here because sets 005–006 shipped only key
CONSUMERS — the rule editor's `match.keys` pills and the preview's key
selector), and the `keySignature` subsection. Since session 56 the
signature is the editor of the key-signature design §13.8
(`docs/planning/key-signature-designer-design.md`), in a designer's words:
Show the key signature, and **Start from**, the noteheads (the defaults) or
traditional sharps and flats (`startFrom`), which replaces the signature's
settings once confirmed, keeping Show and the picked key. The **key
picker** is the staff's key and mode (`opts.key`), and a change picks the
staff's key through `opts.onKey`. **Edit** picks the layer edited: all
marks, naturals, flats, sharps, a line or ledger, a space, or every second
stack (design §13.4). The **canvas** draws the picked key's signature at
24 px a semitone through `CNBKeySignature.render` (its symbols marked with
`{ marked: true }`), its height capped at 360 px: a click on a mark selects
its spelling's layer, or the layer picked in Edit, which stays picked
(`layerFor`), and the base or the added symbol clicked; dragging a symbol
sets its layer's `offset` or an added symbol's own (`dragOffset`), and the
corner handle its size, or `signs.heightSemis` for a sign (`dragSize`),
snapped to tenths of a semitone (`snap`) and shown beside the handle; the
canvas alone redraws while the pointer moves, and the change is reported
once, when it is released, so one drag is one step of undo. The **look
card** edits the layer's look in every key: Base, Added 1 or Added 2 (up to
two, each removable, the layer's `added` replaced whole, `addedWith`), the
symbol (as beneath, the notation's and the built-in shapes as
`CNBNoteheadPanel.thumbnail` draws them, Emmentaler's sharp and flat for a
base, one slot with the shape, `lookWith`), Import from SVG (the host's
control, `opts.importControl`; the panel adds the shape with its
`reference` at the SVG's origin and, for flats or sharps, `ledgers: false`,
and opens a picker where a click on the enlarged symbol moves its reference
point, `referenceGeometry` / `referenceAt`, and "Takes ledger lines" sets
its ledgers), fill and colour, the size (a shape's height and width, or
the signs' one size, automatic or a number) and the offset, each field's
"as …" clearing it; a shape the config lacks is added, reported as
`onChange({ keys, shapes })`. Beneath the canvas, the picked mode's 15 keys
as small signatures, sharp keys then flat keys (`keyOrder`), a click
picking one, a key whose marks touch outlined with its count, and a line
saying how many of the 105 keys have marks that touch
(`CNBKeySignature.touchingKeys`), which opens their list. Then Notes
(`notes`, the sharps or flats only among them, and `upperTonic`, not under
the cycle of fifths), Stacks (`stacking`, the cycle of fifths among them
with its `heights` and `window`; else `columns`, hidden under `"parity"`,
and the gold stem: `separator.enabled`, `color`, its thickness shown in
staff spaces and written as `thicknessPct`, and `shareThickness`, saying
what each stem gets in the picked key) and Place (`placement.position`).
The layer and symbol picked are editor state (`opts.view`, which the host
keeps across re-mounts). Session 56 removed the Draw, Looks and Size rows
and the overlap note. `placement.rule`, `placement.tonicOctave` and
`separator.extentSemis` have no controls and keep their stored values. The
key definitions follow, under "Keys for notehead rules". While
`keys.enabled` is false the panel renders an explicit DISABLED state
(controls shown but inert, with a note) rather than hiding. Same editor
contract as Modules 12–17: property-based event wiring (Node-testable
`render()`), pure `buildKeys` / `applyToConfig` / `stateFromConfig`
builders, Module A validation pass-through plus editor-level duplicate-name
checks, `onChange({ keys }, state)`. Dependencies: Module A, Module B,
Modules 1, 3 and 22 (the canvas, the picked key's marks, the touch check),
the notehead panel, the built-in shapes, the accidental glyphs.

---

### Module 24: Pitch Axis (added set 014)

**Module 24 — Pitch Axis** (`cnb-pitch-axis.js`, Foundation): the axis
gatekeeper for the `pitchAxis` config section (§4.13) — the **sole owner**
of pitch→grid-position mapping (design
[`docs/planning/pitch-axis-design.md`](planning/pitch-axis-design.md)
§2.1). API: `create(config) → axis` with `axis.enabled`,
`axis.octaveStride`, `axis.unitsPerStaffSpace`, `axis.positionOfSemi(semi)`
(integer semantics per §4.13; fractional input interpolates linearly),
`axis.regionOfSemi(semi)` (`Math.floor(positionOfSemi(semi) /
octaveStride)` — the axis analogue of `CNBMusic.ledgerOctaveRegion`),
`axis.distance(aSemi, bSemi)`, and the many-to-one inverses
`axis.semisAtPosition(position, {minSemi, maxSemi})` /
`axis.nearestSemisForY(y, gridContext)`, which return CANDIDATE arrays,
never a fake scalar. Linear degeneracy when the section is
absent/disabled/inactive: identity map, stride 12, `unitsPerStaffSpace =
staff.semitonesPerStaffSpace` — `positionOfSemi(s) === s` exactly.

**Grid integration (Module 1, set 014):** axis-enabled grid contexts use
the axis formula (`semiToY(semi) = (maxAxisPos − positionOfSemi(semi)) ×
pxPerAxisUnit` with `pxPerAxisUnit = display.pxPerSemi`), expose
`yToAxis(y)` and `axis`, and provide **no scalar `yToSemi`** (callers must
choose from candidate inverses — a fake single semitone would hide the
many-to-one fact). Disabled contexts keep the LITERAL pre-set-014 body and
construct no axis at all (design deviation D3; pinned byte-for-byte
against a pre-change baseline fixture). The debug overlay in axis contexts
draws one line per declared axis position labeled with all semitones
mapping there. Dependencies: Module A, Module B. Unit tests:
`cnb-pitch-axis-tests.js`.

---

## 6. Build Order

### Phase 1: Foundation (Sessions 8–9)

| Order | Module | Deliverable | Depends On |
|-------|--------|-------------|------------|
| 1 | **A — Config Schema** | `cnb-config.js` + unit tests + default 4-8 config | — |
| 2 | **B — Music Theory** | `cnb-music.js` + unit tests | — |
| 3 | **1 — Semitone Grid** | `cnb-grid.js` + unit tests + debug overlay test page | A |

### Phase 2: Rendering Primitives (Sessions 10–11)

| Order | Module | Deliverable | Depends On |
|-------|--------|-------------|------------|
| 4 | **2 — Staff Line** | `cnb-staff-line.js` + unit tests | — |
| 5 | **3 — Staff** | `cnb-staff.js` + unit tests + visual test page | A, 1, 2 |
| 6 | **4 — Ledger Line** | `cnb-ledger-line.js` + unit tests | — |
| 7 | **6 — Notehead** | `cnb-notehead.js` + unit tests + visual test page | A |
| 8 | **8 — Stem** | `cnb-stem.js` + unit tests | A |

### Phase 3: Composites (Sessions 12–13)

| Order | Module | Deliverable | Depends On |
|-------|--------|-------------|------------|
| 9 | **5 — Ledger Set** | `cnb-ledger-set.js` + unit tests + visual test page | A, B, 1, 4 |
| 10 | **7 — Double Notehead** | `cnb-double-notehead.js` + unit tests | 1, 6 |
| 11 | **9 — Octave Chord Card** | `cnb-card.js` + visual test page | 1, 5, 7, 8, B, A |
| 12 | **10 — Card Collection** | `cnb-collection.js` + visual test page (full chromatic) | 1, 3, 9, A |

### Phase 4: Export (Session 14)

| Order | Module | Deliverable | Depends On |
|-------|--------|-------------|------------|
| 13 | **11 — LilyPond Exporter** | `cnb-lilypond.js` + unit tests | A, B |

### Phase 5: UI Components (Sessions 15–20+)

| Order | Module | Depends On |
|-------|--------|------------|
| 14 | **16 — SVG Shape Importer** | A |
| 15 | **12 — Palette Editor** | A |
| 16 | **13 — Staff/Ledger Rule Editor** | A |
| 17 | **14 — Notehead Rule Editor** | A |
| 18 | **15 — Common Properties Editor** | A |
| 19 | **17 — Config Save/Load** | A |
| 20 | **18 — Config Export (LilyPond)** | 11 |
| 21 | **19 — Preview Display** | 10, all UI modules |

### Phase 6: Integration & Polish

Final integration into single application. Planned in detail once components are built.

---

## 7. Testing Strategy

### Unit Tests

Every module with pure logic gets `cnb-{module}-tests.js`. Tests run via the same lightweight runner pattern as the existing 240-test suite.

**Test coverage priorities (by complexity):**
1. Ledger display rules (Module 5) — most complex logic, exhaustive
2. Config validation (Module A) — exhaustive (mirrors LY spec §8)
3. Notehead rule resolution (Module A / Module 9) — exhaustive (priority/merge)
4. LilyPond export (Module 11) — section-by-section verification
5. Music theory (Module B) — exhaustive (used everywhere)
6. Stem geometry (Module 8) — key cases including 4-point anchor model
7. Grid coordinate math (Module 1) — key cases

### Visual Test Pages

Each rendering module gets `test-{module}.html`:
- Imports only the module under test + dependencies
- Renders with various configurations
- Includes debug grid overlay
- Used for manual visual verification

### Regression

Existing 240 unit tests for `configurator-core.js` remain untouched until new modules have equivalent coverage.

---

## 8. File Structure

```
cnb/
├── src/
│   ├── cnb-config.js           Module A
│   ├── cnb-music.js            Module B
│   ├── cnb-color.js            colour math and names (session 37)
│   ├── cnb-grid.js             Module 1
│   ├── cnb-staff-line.js       Module 2
│   ├── cnb-staff.js            Module 3
│   ├── cnb-ledger-line.js      Module 4
│   ├── cnb-ledger-set.js       Module 5
│   ├── cnb-notehead.js         Module 6
│   ├── cnb-double-notehead.js  Module 7
│   ├── cnb-stem.js             Module 8
│   ├── cnb-card.js             Module 9
│   ├── cnb-collection.js       Module 10
│   ├── cnb-clef.js             Module 20 (set 009)
│   ├── cnb-key-signature.js    Module 22 (set 010)
│   ├── cnb-accidental-glyphs.js the signature's sharp and flat (session 51)
│   ├── cnb-pitch-axis.js       Module 24 (set 014)
│   └── cnb-lilypond.js         Module 11
│
├── tests/
│   ├── run-tests.js
│   ├── cnb-config-tests.js
│   ├── cnb-music-tests.js
│   ├── cnb-color-tests.js      (session 37)
│   ├── cnb-grid-tests.js
│   ├── cnb-staff-tests.js
│   ├── cnb-ledger-set-tests.js
│   ├── cnb-notehead-tests.js
│   ├── cnb-stem-tests.js
│   ├── cnb-card-tests.js
│   ├── cnb-clef-tests.js       (set 009)
│   ├── cnb-clef-editor-tests.js (set 009)
│   ├── cnb-key-signature-tests.js (set 010)
│   ├── cnb-key-signature-editor-tests.js (set 010)
│   ├── cnb-pitch-axis-tests.js (set 014)
│   └── cnb-lilypond-tests.js
│
├── test-pages/
│   ├── test-grid.html
│   ├── test-staff.html
│   ├── test-ledger.html
│   ├── test-notehead.html
│   ├── test-stem.html
│   ├── test-card.html
│   ├── test-clef.html          (set 009)
│   ├── test-key-signature.html (set 010)
│   └── test-collection.html
│
├── ui/                          (Phase 5)
│   ├── colour-sets.js           (session 37; the palette editor retired)
│   ├── builtin-clefs.js         (session 45; the clefs the Clef panel offers)
│   ├── staff-rule-editor.js
│   ├── notehead-rule-editor.js
│   ├── common-props-editor.js
│   ├── clef-editor.js          Module 21 (set 009)
│   ├── key-signature-editor.js Module 23 (set 010)
│   ├── svg-importer.js
│   ├── config-io.js
│   ├── preview-display.js
│   └── app.js
│
├── assets/
│   ├── shapes/                  Built-in SVG shape files
│   └── fonts/                   The Oswald label font; the clef glyphs' licences
│
└── index.html                   Application entry point (Phase 6)
```

The monolithic predecessor (`chromatic-configurator.html`,
`configurator-core.js`, `music-color-palettes.js` and its test runner) was
removed from the tree in 1.0.0; it is preserved at git tag
`legacy-monolith-final`.

---

## 9. LilyPond Export Reconciliation Summary

This table maps every LilyPond export element (from CNB-LY-EXPORT-SPEC-v1.2) to its source in the config schema.

### Section A — Named Definitions

| LY Element | LY Construct | Config Source |
|---|---|---|
| A1. Path def | `#(define cnb:{name}-path ...)` | `shapes[name].lilypondPath` (preferred) or `svgPathToLilypond(shapes[name].svgPath)` |
| A2. Path reg | `#(cnb:register-path! ...)` | Shape name from `shapes` keys |
| A3. Hollow def + reg | `#(define cnb:{name}-cutout-path ...)` | `shapes[name].lilypondHollowPath` or converted |
| A4. Attachment reg | `#(cnb:register-attachment! ...)` | `shapes[name].lilypondAnchors` (or `anchors`), each x moved half a stem outward (the anchor is the stem's centre, LY spec 1.3.11 §4.4c), written relative to the registered path's extent, LilyPond's stem-attachment units (LY spec 1.3.8 §4.4b) |
| A5. Color reg | `#(cnb:register-color! ...)` | each distinct resolved `apply.color`, named from its hex (LY spec 1.3.10 §4.5a); no accessible branch |
| A6. Off-key mark | `#(cnb:register-off-key-mark! ...)` | `keys.offKeyMark` (future) |

### Section B — Engine Settings

| LY Variable | Default | Config Source | Emit Rule |
|---|---|---|---|
| `cnb:use-procedure-model` | `#f` | — (always `#t`: Configurator exports are procedure-model by construction; 007-s1 D1) | Always |
| `cnb:semitones-per-staff-space` | 2 | `staff.semitonesPerStaffSpace` | Always |
| `cnb:staff-line-positions` | `'(-4 -2 0 2 4)` | Computed from `staff.semitonePattern` + `staff.midpoint` | Always |
| `cnb:false-hollow` | `#f` | `engine.falseHollow` | If changed |
| `cnb:multinote-overlap` | `#f` (the engine's `cnb:multinote-padding`, never written) | `durations.repeatOverlap` (session 58) | In repeat mode (LY spec 1.3.20 §4.1d), engine 1.7.0 |
| `cnb:default-magnify` | `7/4` | `engine.defaultMagnify` | If changed |
| `cnb:indent` | `0` | `engine.indent` | If changed |
| `cnb:collision-threshold` | `2` | `engine.collisionThreshold` | If changed |
| `cnb:default-staff-line-thickness`, `-color`, `cnb:stem-thickness` | — | none: the preview draws the engine's lines and stems (session 34) | Never (LY spec §5.2a) |
| `cnb:ledgers-by-semitone` + `NoteHead.ledger-positions` / `no-ledgers` | — (the engine's own ledger rule) | `ledgers` resolved for semitones 0–24 and the mark table's marks (`CNBLedgerSet.ledgersFor`) | Always (LY spec 1.3.9 §5.7, 1.3.16) |
| `cnb:file-suffix` | `""` | `meta.fileSuffix` | Always |
| `cnb:notation-label` | `""` | `meta.notationLabel` | Always |
| `cnb:notation-footnote` | `""` | `meta.notationFootnote` | If non-empty |
| `cnb:clef-style` (+ name, text, size, gutter; A6 `cnb:register-clef!`) | `'dozenal` | `clef` (§4.12) | Always: `'none` when no clef is shown (LY spec 1.3.7 §5.5) |
| `cnb:keysig-style` | `'chord` | `keys.enabled`, `keys.keySignature.enabled` | `'none` unless both are on (LY spec 1.3.7 §5.6); `'marks` for a signature not the scale stack (1.3.15 §5.6a) |
| `cnb:keysig-marks` | `'()` | `keys.keySignature`, through `CNBKeySignature.marks` for 105 keys | With `'marks` (LY spec 1.3.15 §5.6a); each mark's symbols, `at` and signs' colours since 1.3.19 (engine 1.6.0) |
| `cnb:keysig-bar-color` / `-thickness` / `-extent-semis`, `cnb:keysig-tonic-octave` | `"#ffd42a"` / `4` / `12`, `#f` | `keys.keySignature.separator`, `.placement.tonicOctave` | If changed, signature on (LY spec 1.3.7 §5.6) |

### Section C — Configuration Procedure

| LY Procedure Field | Config Source |
|---|---|
| `(shape . {name})` | Resolved from `noteheadRules` → shape name |
| `(color . {symbol})` | Resolved `apply.color` → `schemeSymbol(hex)`, or `black-000000` |
| `(hollow . {name}-cutout)` or `#f` | Resolved hollow → shape's hollow name or false |
| `(attachment . {name}-attach)` | Shape name → attachment name |
| `(off-key-mark . ...)` | Resolved from `noteheadRules` → offKeyMark |
| `(repeat . #t/#f)` | `durations.representationMode` |
| key dispatch `(equal? key-pcs '(…))` | with keys on, each key definition a rule's `match.keys` names (LY spec 1.3.9 §6.4) |

---

## 10. Session Planning Template

```markdown
# Session N: [Module Name]

## Goal
Build Module X: [one-line description]

## Prerequisites
- Module Y built and tested (Session N-1)
- Config schema includes [relevant sections]

## Inputs
- **Config:** [which config sections this module reads]
- **Example data:** [what example data this module takes]

## Deliverables
1. `cnb-{module}.js` — source file with public API
2. `cnb-{module}-tests.js` — unit tests (target: all pass)
3. `test-{module}.html` — visual test page (if rendering module)

## API Contract
[From this plan, refined]

## Test Cases
[From this plan, plus edge cases]

## Visual Verification
[Expected visual output]

## Decisions Made
[Design decisions affecting other modules]

## Baton for Next Session
[What's next, what to watch out for]
```

---

## 11. Open Questions

1. **UI framework:** *Settled: vanilla JS.* Every UI module (`cnb/ui/`)
   and the app (`cnb/index.html`) are plain ES modules with no framework,
   wired by properties so they test under Node (sets 004–006 onward;
   `CLAUDE.md` "Language & Environment").
2. **Module bundling:** *Settled: no bundler, no build step.* The browser
   loads the ES modules as they are, in development and in production. The
   published site is a copy, not a build (`cnb/site/assemble-site.mjs`,
   session 15).
3. **Quad noteheads:** *Resolved in session 18.* In repeat mode the card
   follows the engine's `cnb:build-duration-stencil`: minim ×2 and
   semibreve ×4 (fixed; `durations.repeatCounts` is not read), each copy
   starting (1 − `durations.repeatOverlap`) head widths after the last
   (session 58; before it, `engine.multinotePadding` staff spaces apart),
   the group centred on the head position. The stem attaches at the
   anchor's relative position across the group, as LilyPond's
   stem-attachment does, and the ledgers widen with the group
   (`CNBCard.repeatCount` / `CNBCard.repeatLayout`). Since session 44 (engine
   session 25, engine 1.3.0) a breve is two semibreve groups 1 staff space
   apart, tied on each notehead with LilyPond's `make-tie-stencil`, drawn
   black whatever the notehead's colour (`CNBCard.tiedGroups` /
   `CNBCard.tiePath`; LY spec §4.1d). Since session 46 (engine session 28,
   engine 1.3.1) the tie runs below the heads, curving down, and a breve
   row's grid reaches low enough to hold it (`CNBCard.tieBottom`,
   `CNBCollection.gridRange`); since session 58 (engine session 39, engine
   1.7.0) it runs from the middle of the first group to the middle of the
   second, where it ran from the first head's centre to the last's. The
   ledgers and the column follow the whole width.
4. **Off-key marking:** Visual treatment. Deferred.
5. **Accidentals and clefs:** *Clefs settled in set 009:* custom clefs
   render in a left gutter placed on the semitone grid (Modules 20 and 21,
   §4.12). Accidentals remain open (enhancement E4, listed under "After
   1.1.0" in `docs/sessions/session-plan.md`).
6. **Responsive scaling:** *Settled in session 20: neither scale nor
   scroll the page.* The canvas is drawn at a fixed size (the Size choice,
   kept in the browser) and reflows to one or two rows of equal columns;
   only below the two-row minimum does it scroll sideways inside its card
   (`docs/planning/notehead-first-editor-design.md` §6.1).
7. **Staff-line-positions conversion edge cases:** *Settled.* The staff
   editor derives `semitonesPerStaffSpace` as the greatest common divisor
   of the pattern's intervals, the wrap-around one included
   (`CNBStaffRuleEditor.derivedGeometry`), so the lines of a pattern chosen
   in the editor are always whole staff spaces apart. Any position that
   still comes out fractional (a spacing set by hand that does not divide,
   or a midpoint off the lines' grid) is written as a decimal of up to 4
   places, which the engine accepts as a staff-line position;
   under a pitch axis the axis formula and its deduplication apply (LY spec
   §5.4a). The range expanded is the 24 semitones centred on the middle of
   the staff (LY spec §5.1a).
8. **Stem attachment validation:** *Settled in sessions 33 and 34.* The
   preview draws the engine's stem (0.13 staff spaces, LilyPond's length)
   with its edge on the anchor, as LilyPond does, and engine round trips in
   `cnb/tests/cnb-card-tests.js` pin the stem's edge, thickness and both ends
   against the engraving.

---

## Appendix A: Default 4-8 Configuration

Complete default config for development and testing.

```javascript
{
  version: "1.0",

  shapes: {
    "crotchet-minim": {
      displayName: "Crotchet–Minim",
      svgPath: "M 163.578 -81.573 C 193.612 -21.336 144.71 64.016 54.355 109.065 C -35.998 154.113 -133.593 141.801 -163.627 81.565 C -178.047 52.639 -174.644 16.303 -154.159 -19.448 C -133.677 -55.199 -97.792 -87.438 -54.403 -109.072 C -11.013 -130.706 36.328 -139.962 77.208 -134.804 C 118.089 -129.647 149.155 -110.499 163.578 -81.573 Z",
      svgHollowPath: "M 136.312 -67.977 C 155.421 -32.322 90.412 17.577 24.737 50.184 C -40.937 82.792 -116.568 105.433 -136.359 67.971 C -156.151 30.509 -95.666 -15.128 -24.935 -50.371 C 45.798 -85.615 117.202 -103.633 136.312 -67.977 Z",
      naturalHeight: 272.4,
      naturalWidth: 344.852,
      semitoneHeight: 2.724,
      anchors: {                      // the stems' centres (session 40)
        crotchetUp:   { x: 146.426, y: -42.9985 },
        crotchetDown: { x: -146.4267, y: 43.0027 },
        minimUp:      { x: 146.426, y: -42.9985 },
        minimDown:    { x: -146.4267, y: 43.0027 }
      },
      lilypondPath: null,
      lilypondHollowPath: null,
      lilypondAnchors: null
    }
  },

  staff: {
    semitonePattern: [4, 8],
    midpoint: 12,
    semitonesPerStaffSpace: 4
  },

  ledgers: {
    templates: [
      { semiWithinOctave: 0,  triggerPCs: [0, 1, 2], triggerMode: "override" },
      { semiWithinOctave: 2,  triggerPCs: [2],        triggerMode: "override" },
      { semiWithinOctave: 10, triggerPCs: [10],       triggerMode: "override" }
    ],
    proximityRule: true
  },

  noteheadRules: [
    {
      name: "Default",
      priority: 0,
      match: { pitchClasses: "all", durations: "all", keys: "all" },
      apply: { shape: "crotchet-minim", hollow: false, color: null, offKeyMark: false }
    },
    {
      name: "Sharps are hollow",
      priority: 1,
      match: { pitchClasses: [1, 3, 6, 8, 10], durations: "all", keys: "all" },
      apply: { hollow: true }
    }
  ],

  display: {
    pxPerSemi: 16,
    label: {
      fontFamily: "Oswald",
      fontSize: 22,
      fontWeight: 400,
      color: "#555555",
      marginTop: 14,
      marginBottom: 14,
      padding: 6,
      sharpStyle: { fontSize: 0.75, raise: -0.15 }
    },
    column: { paddingH: 16 },
    card: { background: "#FFFFFF", borderRadius: 6, shadow: "0 2px 12px rgba(0,0,0,0.12)" },
    debugGrid: false
  },

  durations: {
    definitions: [
      { name: "crotchet",  displayName: "Crotchet (Quarter)",       lilypondDuration: 3, defaultShape: "crotchet-minim", defaultHollow: false, hasStem: true },
      { name: "minim",     displayName: "Minim (Half)",             lilypondDuration: 2, defaultShape: "crotchet-minim", defaultHollow: true,  hasStem: true },
      { name: "semibreve", displayName: "Semibreve (Whole)",        lilypondDuration: 1, defaultShape: "semibreve",      defaultHollow: false, hasStem: false },
      { name: "breve",     displayName: "Breve (Double Whole)",     lilypondDuration: 0, defaultShape: "breve",          defaultHollow: false, hasStem: false }
    ],
    representationMode: "shape",
    repeatOverlap: 1 / 3
  },

  keys: {
    enabled: false,
    definitions: [],
    offKeyMark: {},
    keySignature: {
      enabled: false,
      notes: "all",
      upperTonic: true,
      looks: { all: {}, natural: {}, flat: {}, sharp: {}, line: {}, space: {} },
      stacking: "degrees",
      heights: "window",
      window: { sharp: 0, flat: 0 },
      alternate: {},
      columns: "right",
      placement: { rule: "scale-from-tonic", tonicOctave: null, position: "middle" },
      separator: { enabled: true, color: "#ffd42a", thicknessPct: 160, extentSemis: 12,
                   shareThickness: true },
      signs: { heightSemis: null },
    },
  },

  clef: { enabled: false, active: null, glyphs: {}, gutter: { paddingH: 12 } },

  engine: {
    lilypondVersion: "2.24.2",
    falseHollow: false,
    defaultMagnify: "7/4",
    indent: 0,
    collisionThreshold: 2
  },

  meta: {
    configName: "Default 4-8 System",
    fileSuffix: "-Default48",
    notationLabel: "Default 4-8 System",
    notationFootnote: "",
    author: "",
    description: "Two staff lines per octave at semitones 4 (E) and 8 (G♯)",
    created: null,
    modified: null
  }
}
```

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Pitch class (PC)** | Note identity regardless of octave: 0=C, 1=C♯, ..., 11=B |
| **Absolute semitone** | Pitch in a specific octave: C₀=0, C₁=12, C₂=24 |
| **Octave chord** | Two-note chord: same PC in two adjacent octaves |
| **Staff pattern** | Semitone positions within one octave where staff lines are drawn |
| **4-8 system** | Staff pattern [4, 8] → lines at E and G♯ |
| **Ledger template** | Rule declaring where a ledger CAN appear and what triggers it |
| **Proximity rule** | Default: show ledger when notehead closer to it than to any staff line |
| **Override rule** | Forced: show ledger when specific PC present, regardless of proximity |
| **4-point anchor model** | Stem attachment: separate (x,y) for crotchet-up, crotchet-down, minim-up, minim-down |
| **Semitone grid** | Coordinate system: 1 semitone = N pixels vertically |
| **Note-slice** | Per-column SVG containing noteheads, stems, ledger lines |
| **Material card** | Label overlay: white background, subtle border + shadow |
| **thicknessPct** | Line thickness as % of one semitone height (canonical unit) |
| **`repeat` field** | LilyPond flag: `#t` = multi-notehead for longer durations; `#f` = single notehead |
