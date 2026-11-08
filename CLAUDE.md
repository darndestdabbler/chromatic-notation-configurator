# Chromatic Notation Configurator

## Project Overview

Browser-based tool for designing chromatic music notation systems. Users configure staff lines, ledger lines, notehead shapes, and color rules, then preview their notation and export LilyPond config files.

This repo is one of three in the ChromaticNotationBase ecosystem:
- **chromatic-notation-base:** LilyPond engine (Scheme) — renders music from config
- **This repo:** JavaScript configurator — designs notation systems, exports .ly configs
- **music-glyph-toolkit:** Inkscape extension (Python) — authors notehead SVGs

## Architecture & Key Documents

- Full architecture plan: @docs/CNB-ARCHITECTURE-PLAN-v2.md
- LilyPond export spec: @docs/CNB-LY-EXPORT-SPEC-v1_3.md

## Language & Environment

- **Vanilla JavaScript** — ES modules (`export` / `import`), no frameworks
- **No build step** — runs directly in the browser
- **Node.js 18+** for running the unit tests via CLI; **20+** for the browser UAT (`playwright-core` 1.64 requires it)
- **No external runtime dependencies** — the page fetches nothing from elsewhere; the Oswald label font is served from `cnb/assets/fonts/` (SIL OFL)

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
- `cnb-color.js` — Colour math and colour names (nearest name, Scheme symbol from a hex)
- `cnb-pitch-axis.js` — Module 24: sole owner of the pitch → staff-position map (`pitchAxis`); identity when absent or disabled

### Rendering (bottom → top)
- `cnb-grid.js` — Coordinate system (semiToY, viewport sizing, debug overlay)
- `cnb-staff-line.js` → `cnb-staff.js` — Staff line rendering
- `cnb-ledger-line.js` → `cnb-ledger-set.js` — Ledger lines with display rules
- `cnb-notehead.js` → `cnb-double-notehead.js` — Notehead rendering
- `cnb-stem.js` — Stem with 4-point anchor model
- `cnb-card.js` — Octave chord card (composes all above)
- `cnb-collection.js` — Row/grid of cards
- `cnb-clef.js`, `cnb-key-signature.js` — Clef and key-signature gutters, placed on the grid

### Export
- `cnb-lilypond.js` — Generates .ly files per CNB-LY-EXPORT-SPEC-v1.3 (`docs/CNB-LY-EXPORT-SPEC-v1_3.md`)

## Testing

Run all tests: `node cnb/tests/run-tests.js`
Browser UAT: `npm run uat` (prerequisites in the README)

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
- **Colour lives on the notehead rules** (`apply.color`, `null` = black). There is no palette; a saved one is moved onto the rules on load (`CNBConfig.paletteToRules`), and a colour-blind version is a second config.
- **Ledger display** has no "outside staff" hard gate. Proximity and override rules handle gaps within the staff (e.g., 3-6-9 system).
- **Ledger rules are octave-aware** — a ledger in octave 0 only responds to noteheads in octave 0

## Preview Rendering Notes

- Column layout: CSS flexbox with per-column SVGs for noteheads/stems/ledgers
- Staff lines: single background SVG spanning all columns (continuous lines)
- Labels: Material-style card overlays (white background, border, shadow) that mask staff lines
- Hollow noteheads: white overlay path on filled path (only works on white backgrounds)
- Stem direction: average chord semitone vs. staff midpoint. Below → up (right side), at/above → down (left side)

## LilyPond Export Key Points

- Section A: named definitions (paths, hollows, attachments, and each colour the noteheads use, registered once with no colour-blind branch)
- Section B: engine settings (emit-if-changed pattern — skip values at defaults)
- Section C: `cnb:get-notehead-config` procedure with `memv`/`cond` grouping
- Staff-line-positions conversion (half-staff-spaces): `2 × (semi - midpoint) / semitonesPerStaffSpace`
- Color symbols: named from the hex via `nearestColorName()` → `toSchemeSymbol()` in `cnb/src/cnb-color.js` (e.g., `shamrock-1b9e77`)
- `repeat` field: `#t` when representationMode is "repeat", `#f` when using distinct shapes per duration

## Session Workflow

Work runs as numbered Dabbler 3.x sessions under `docs/sessions/`; the
plan is `docs/sessions/session-plan.md` and the procedure is the managed
section of `AGENTS.md`, imported below.

**Historical records — read-only, do not delete:**
- `docs/session-sets/` holds the v1 session sets 001–014. Set 014 was
  migrated into `docs/sessions/` on 2026-10-30; the others are history.
  Other documents link into these directories, so leave them in place.
- `docs/batons/` and `docs/checklists/` are records of pre-Dabbler
  sessions (sessions 1–9). Do not generate new batons or checklists.

<!-- dabbler:managed:start -->
@AGENTS.md

---

## Engine tail (Claude Code)

You are **Claude Code**. The managed body above arrived through the
`@AGENTS.md` import, which Claude Code expands at load time — `AGENTS.md`
is the one copy, so nothing here can drift from what the other engines
read.

<!-- dabbler:managed:end -->
