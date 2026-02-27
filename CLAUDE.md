# Chromatic Notation Configurator

## Project Overview

Browser-based tool for designing chromatic music notation systems. Users configure staff lines, ledger lines, notehead shapes, and color rules, then preview their notation and export LilyPond config files.

This repo is one of three in the ChromaticNotationBase ecosystem:
- **chromatic-notation-base:** LilyPond engine (Scheme) — renders music from config
- **This repo:** JavaScript configurator — designs notation systems, exports .ly configs
- **music-glyph-toolkit:** Inkscape extension (Python) — authors notehead SVGs

## Architecture & Key Documents

- Full architecture plan: @docs/CNB-ARCHITECTURE-PLAN-v2.md
- LilyPond export spec: @docs/CNB-LY-EXPORT-SPEC-v1_2.md

## Language & Environment

- **Vanilla JavaScript** — ES modules (`export` / `import`), no frameworks
- **No build step** — runs directly in the browser
- **Node.js 18+** for running tests via CLI
- **No external runtime dependencies** (Google Fonts loaded via CDN for preview only)

## Core Design Principles

1. **Two inputs to rendering:** Config (notation system definition) + Example data (what to render — specific pitches, durations, keys). These are always separate parameters.
2. **Config in, DOM nodes out.** Rendering modules are pure functions. No global state, no event listeners.
3. **JSON config is the single source of truth.** Same config drives both the preview and the LilyPond export.
4. **Bottom-up construction with minimal dependencies.** Each module depends on as few others as possible.
5. **Testable by default.** Pure logic gets unit tests. Visual rendering gets standalone test pages.

## Module Structure

Source files: `cnb/src/cnb-{module}.js`
Test files: `cnb/tests/cnb-{module}-tests.js`
Visual test pages: `cnb/test-pages/test-{module}.html`

### Foundation
- `cnb-config.js` — Config schema, validation, defaults, notehead rule resolution
- `cnb-music.js` — Pitch class math, note names, octave arithmetic

### Rendering (bottom → top)
- `cnb-grid.js` — Coordinate system (semiToY, viewport sizing, debug overlay)
- `cnb-staff-line.js` → `cnb-staff.js` — Staff line rendering
- `cnb-ledger-line.js` → `cnb-ledger-set.js` — Ledger lines with display rules
- `cnb-notehead.js` → `cnb-double-notehead.js` — Notehead rendering
- `cnb-stem.js` — Stem with 4-point anchor model
- `cnb-card.js` — Octave chord card (composes all above)
- `cnb-collection.js` — Row/grid of cards

### Export
- `cnb-lilypond.js` — Generates .ly files per CNB-LY-EXPORT-SPEC-v1.2

## Testing

Run all tests: `node cnb/tests/run-tests.js`
Legacy tests: `node legacy/run-tests.js` (240 tests — do not modify)

Test pattern:
```javascript
export const tests = [
  { name: "description", fn: () => { assert(condition, "message"); } },
];
```

## Config Schema Key Concepts

- **Shapes** store BOTH SVG data (for preview) and LilyPond data (for export)
- **Thickness** is expressed as % of semitone height (thicknessPct), converted to px for preview or absolute units for LilyPond
- **4-point stem anchors:** crotchetUp, crotchetDown, minimUp, minimDown — accounts for stem width (~1/5 semitone)
- **Notehead rules** are cumulative, priority-ordered. Higher priority overrides lower. Partial apply blocks inherit from previous match.
- **Ledger display** has no "outside staff" hard gate. Proximity and override rules handle gaps within the staff (e.g., 3-6-9 system).
- **Ledger rules are octave-aware** — a ledger in octave 0 only responds to noteheads in octave 0

## Preview Rendering Notes

- Column layout: CSS flexbox with per-column SVGs for noteheads/stems/ledgers
- Staff lines: single background SVG spanning all columns (continuous lines)
- Labels: Material-style card overlays (white background, border, shadow) that mask staff lines
- Hollow noteheads: white overlay path on filled path (only works on white backgrounds)
- Stem direction: average chord semitone vs. staff midpoint. Below → up (right side), at/above → down (left side)

## LilyPond Export Key Points

- Section A: named definitions (paths, hollows, attachments, colors with CB-safe conditional block)
- Section B: engine settings (emit-if-changed pattern — skip values at defaults)
- Section C: `cnb:get-notehead-config` procedure with `memv`/`cond` grouping
- Staff-line-positions conversion: `(semi - midpoint) / semitonesPerStaffSpace`
- Color symbols: generated via `nearestColorName()` → `toSchemeSymbol()` (e.g., `shamrock-1b9e77`)
- `repeat` field: `#t` when representationMode is "repeat", `#f` when using distinct shapes per duration

## Legacy Code

The `legacy/` directory contains the monolithic predecessor:
- `chromatic-configurator.html` — 3,057-line single-file app
- `configurator-core.js` — Core logic (240 unit tests passing)
- `music-color-palettes.js` — Color palette library
- `run-tests.js` — Legacy test runner

This code is reference only. New modules are in `cnb/src/`. Do not modify legacy code.

## Current Phase

See the baton document for the current session's goals and deliverables.


## Session Completion Checklist
After building all modules for a session

1. Generate a human verification 
checklist at docs/checklists/session-N-checklist.xlsx. Structure:
- Column A: Functional Area Id
- Column B: Functional Area  
- Column C: Subarea
- Column D: Passes (leave blank — human fills this)
- Column E: Expectation (specific, verifiable statement)
- Column F: Feedback (leave blank — human fills this)

Cover: visual rendering, file operations, export correctness, 
edge cases that automated tests don't cover.

2. Generate the baton for the next session at docs/batons/baton-sessions-{N}-to-{N+1}.md

The baton must include:
- What was built this session (modules, files, test counts)
- Any design decisions made during implementation
- Any issues, deviations, or amendments to the architecture plan
- What to build next (from CNB-ARCHITECTURE-PLAN-v2.md build order)
- Which files the next session should read
- Specific test cases for the next modules