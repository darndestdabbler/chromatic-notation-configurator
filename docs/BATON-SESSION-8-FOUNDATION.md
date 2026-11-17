# BATON — Session 8: Foundation Modules (Config Schema + Music Theory)

**Date:** February 26, 2026
**Predecessor:** BATON-SESSION-7-COMPLETE-20260226.md
**Architecture plan:** CNB-ARCHITECTURE-PLAN-v2.md (must read before starting)
**LilyPond spec:** CNB-LY-EXPORT-SPEC-v1_2.md (reference for validation rules)
**Test baseline:** 240/240 core tests, 53/54 manual (unchanged — no legacy code is modified)

---

## GOAL

Build the two foundation modules that every other CNB module depends on:

1. **Module A — Config Schema** (`cnb-config.js`): The canonical JSON config structure with defaults, validation, deep merge, clone, notehead rule resolution, and color resolution.
2. **Module B — Music Theory Utilities** (`cnb-music.js`): Pitch class arithmetic, note naming, octave math, ledger octave regions.

If time permits, begin **Module 1 — Semitone Grid** (`cnb-grid.js`). Otherwise, Module 1 becomes Session 9's goal.

---

## WHAT TO READ FIRST

1. **CNB-ARCHITECTURE-PLAN-v2.md** — Read in full. Pay special attention to:
   - Section 4 (Config Schema) — the complete schema definition
   - Section 5 (Module Specs) — APIs for Modules A and B
   - Appendix A — the default 4-8 configuration (this is your test fixture)
2. **CNB-LY-EXPORT-SPEC-v1_2.md** — Read Section 8 (Export Validation). Module A's `validate()` must implement these checks.
3. **preview-mockup-v2.html** — Reference for how config values are currently used in rendering. The mockup's `CONFIG`, `SHAPES`, `resolveNote()`, and `LEDGER_TEMPLATES` objects are the informal predecessors of what you're formalizing.

---

## MODULE A: CONFIG SCHEMA

### File: `cnb/src/cnb-config.js`

### Public API

```javascript
const CNBConfig = {
  VERSION: "1.0",

  // Create a complete config with all defaults (the 4-8 system from Appendix A)
  createDefault() → config,

  // Validate a config. Returns { valid, errors[], warnings[] }
  // Implements the checks from LY Spec §8 (see below)
  validate(config) → { valid: boolean, errors: string[], warnings: string[] },

  // Deep-merge a partial config over a full config (or over defaults)
  // Only specified fields in partial overwrite; everything else preserved
  merge(base, partial) → config,

  // Deep-clone a config (no shared references)
  clone(config) → config,

  // Resolve notehead properties for a given (pc, duration, key)
  // Walks noteheadRules in priority order, merges apply blocks
  // Returns: { shape, hollow, color, offKeyMark }
  resolveNotehead(config, pc, duration, key) → object,

  // Get the effective display color for a pitch class
  // Respects palette assignment + CB-safe toggle
  // Returns hex string (e.g., "#FF0000") or null if no palette
  resolveColor(config, pc) → string | null,

  // Convert a thickness percentage to pixels for preview rendering
  pctToPx(pct, pxPerSemi) → number,
};
```

### Validation Rules (from LY Spec §8)

**Errors (blocking — `valid` = false):**
1. Every shape name referenced in `noteheadRules[].apply.shape` must exist in `config.shapes`
2. Every shape referenced with `hollow: true` must have a non-null `svgHollowPath` in its shape definition
3. All palette color hex values referenced by explicit color rules must exist in `config.palette.colors`
4. All 12 pitch classes (0–11) must be covered by at least one notehead rule (i.e., `resolveNotehead` must produce a result for every PC)
5. At least 2 values in `config.staff.semitonePattern`
6. `config.meta.fileSuffix` must begin with `-` if non-empty
7. All color hex values must match `#RRGGBB` format (case-insensitive)

**Warnings (non-blocking):**
1. `config.meta.notationLabel` is empty
2. A PC resolves to `hollow: true` but its resolved shape has no `svgHollowPath`
3. A shape has `lilypondPath: null` (will need fallback conversion at export)
4. Some PCs have no color rule and no palette (will render black)
5. CB-safe palette has fewer entries than primary palette

### Notehead Resolution Algorithm

```
resolveNotehead(config, pc, duration, key):
  // Start with built-in defaults
  result = { shape: firstShapeName, hollow: false, color: null, offKeyMark: false }

  // Sort rules by priority ascending
  sortedRules = config.noteheadRules.sorted(by: priority)

  for each rule in sortedRules:
    if matches(rule.match, pc, duration, key):
      // Merge: only fields present in rule.apply overwrite result
      if rule.apply.shape !== undefined:     result.shape = rule.apply.shape
      if rule.apply.hollow !== undefined:    result.hollow = rule.apply.hollow
      if rule.apply.color !== undefined:     result.color = rule.apply.color
      if rule.apply.offKeyMark !== undefined: result.offKeyMark = rule.apply.offKeyMark

  return result

matches(match, pc, duration, key):
  pcMatch = (match.pitchClasses === "all") || match.pitchClasses.includes(pc)
  durMatch = (match.durations === "all") || match.durations.includes(duration)
  keyMatch = (match.keys === "all") || match.keys.includes(key)
  return pcMatch && durMatch && keyMatch
```

### Design Notes

- `createDefault()` returns the complete 4-8 config from Architecture Plan Appendix A. This is a function (not a constant) so each call returns a fresh copy.
- `merge(base, partial)` is a recursive deep merge. Arrays are replaced, not concatenated. Objects are merged field-by-field. Primitives are overwritten.
- The config uses `svgPath` / `svgHollowPath` (not `path` / `hollowPath`) to distinguish from LilyPond paths. This was a naming change in the v2 architecture plan.
- `resolveColor(config, pc)` checks `config.palette.useCBSafe` to decide which color array to use, then finds the entry for the given PC. Returns `null` if no palette is configured.

---

## MODULE B: MUSIC THEORY UTILITIES

### File: `cnb/src/cnb-music.js`

### Public API

```javascript
const CNBMusic = {
  // Pitch class from absolute semitone (always 0–11)
  // Handles negative semitones correctly: pitchClass(-1) = 11
  pitchClass(semi) → number,

  // Octave number from absolute semitone
  // octave(0) = 0, octave(11) = 0, octave(12) = 1, octave(24) = 2
  octave(semi) → number,

  // Absolute semitone from pitch class + octave
  // absoluteSemi(0, 1) = 12
  absoluteSemi(pc, octave) → number,

  // Label object for a pitch class (for rendering)
  // pcLabel(0) = { text: "C", sharp: false }
  // pcLabel(1) = { text: "C", sharp: true }
  pcLabel(pc) → { text: string, sharp: boolean },

  // All 13 labels for a full chromatic row (C through C')
  // Index 12 = upper C = { text: "C", sharp: false }
  chromaticLabels() → array,

  // Which octave region a semitone belongs to for ledger line purposes
  // Used by Module 5 to ensure ledger lines are octave-aware
  // ledgerOctaveRegion(0) = 0, ledgerOctaveRegion(11) = 0,
  // ledgerOctaveRegion(12) = 1, ledgerOctaveRegion(23) = 1
  ledgerOctaveRegion(semi) → number,
};
```

### Label Mapping

| PC | text | sharp |
|----|------|-------|
| 0 | C | false |
| 1 | C | true |
| 2 | D | false |
| 3 | D | true |
| 4 | E | false |
| 5 | F | false |
| 6 | F | true |
| 7 | G | false |
| 8 | G | true |
| 9 | A | false |
| 10 | A | true |
| 11 | B | false |

### Design Notes

- All functions are pure (no side effects, no state).
- `pitchClass` uses `((semi % 12) + 12) % 12` to handle negatives.
- `octave` uses `Math.floor(semi / 12)`.
- `ledgerOctaveRegion` is the same as `octave` for now, but is a separate function because the ledger algorithm may need a different definition later (e.g., if ledger regions don't align with octave boundaries in some staff configurations).

---

## MODULE 1: SEMITONE GRID (stretch goal)

### File: `cnb/src/cnb-grid.js`

Only attempt this if Modules A and B are complete with passing tests.

### Public API

```javascript
const CNBGrid = {
  // Create a grid context
  create(config, { minSemi, maxSemi }) → gridContext,

  // Render a visible debug overlay into an SVG element
  renderDebugOverlay(svgParent, gridContext, staffPositions) → SVGGElement,
};

// gridContext object:
{
  pxPerSemi,
  minSemi, maxSemi,
  totalSemiRange,
  svgHeight,                  // totalSemiRange × pxPerSemi
  semiToY(semi),              // higher pitch = lower Y value
  yToSemi(y),                 // inverse
  topLabelHeight,
  bottomLabelHeight,
  totalHeight,                // topLabelHeight + svgHeight + bottomLabelHeight
}
```

### Debug Overlay Rendering

The debug overlay draws into an SVG group:
- Faint gray horizontal line at every semitone position
- Semitone number labels on the left edge (small font, gray)
- Staff line positions highlighted with a distinct color (e.g., light blue)
- Octave boundaries (semi 0, 12, 24) marked with a slightly heavier line

This overlay is toggled by `config.display.debugGrid` and will be used by every subsequent visual test page.

### Visual Test Page: `cnb/test-pages/test-grid.html`

Standalone HTML that:
1. Imports `cnb-config.js` and `cnb-grid.js`
2. Creates a default config
3. Creates a grid context for semitones -5 to 29 (the standard range with margins)
4. Renders the debug overlay in a centered SVG
5. Labels should be readable; staff line positions at 4, 8, 16, 20 should be clearly highlighted

---

## TEST FILES

### `cnb/tests/cnb-config-tests.js`

Target: comprehensive coverage of all API methods.

**Key test cases:**

createDefault:
- Returns a valid config (passes validate)
- Returns a fresh copy each call (mutation of one doesn't affect another)

validate:
- Default config: valid = true, no errors, possible warnings
- Missing shape reference: error
- Hollow on shape with no hollow path: error
- Missing PC coverage: error (remove the "all" rule, add rules for only PCs 0–10)
- Less than 2 staff lines: error
- fileSuffix without leading hyphen: error
- Bad hex format: error
- Empty notation label: warning
- Shape without lilypondPath: warning

merge:
- Merging empty partial over default = default
- Merging { display: { pxPerSemi: 20 } } changes only pxPerSemi
- Merging new noteheadRules replaces the array (not concatenate)
- Nested merge: changing one staff.lineDefaults field preserves others

clone:
- Mutating clone doesn't affect original
- Deeply nested objects are independent

resolveNotehead:
- Default 4-8 config: PC 0 → { shape: "crotchet-minim", hollow: false, color: null, offKeyMark: false }
- Default 4-8 config: PC 1 → { shape: "crotchet-minim", hollow: true, color: null, offKeyMark: false }
- Custom rule overriding shape for specific PCs
- Priority ordering: higher priority wins
- Partial apply: rule sets only hollow, shape inherited from lower priority
- Duration matching: rule matches "crotchet" but not "minim"
- "all" matches everything

resolveColor:
- No palette (empty colors): returns null
- Palette with colors: returns correct hex for PC
- CB-safe toggle: returns CB-safe hex when useCBSafe = true

pctToPx:
- pctToPx(20, 16) = 3.2 (20% of 16px)
- pctToPx(100, 16) = 16
- pctToPx(0, 16) = 0

### `cnb/tests/cnb-music-tests.js`

**Key test cases:**

pitchClass:
- pitchClass(0) = 0
- pitchClass(11) = 11
- pitchClass(12) = 0
- pitchClass(23) = 11
- pitchClass(24) = 0
- pitchClass(-1) = 11
- pitchClass(-12) = 0
- pitchClass(-13) = 11

octave:
- octave(0) = 0
- octave(11) = 0
- octave(12) = 1
- octave(23) = 1
- octave(24) = 2
- octave(-1) = -1
- octave(-12) = -1

absoluteSemi:
- absoluteSemi(0, 0) = 0
- absoluteSemi(0, 1) = 12
- absoluteSemi(11, 0) = 11
- absoluteSemi(0, 2) = 24

pcLabel:
- All 12 PCs produce correct text and sharp flag (see table above)

chromaticLabels:
- Returns array of length 13
- Index 0 = { text: "C", sharp: false }
- Index 12 = { text: "C", sharp: false }
- Index 1 = { text: "C", sharp: true }

ledgerOctaveRegion:
- ledgerOctaveRegion(0) = 0
- ledgerOctaveRegion(11) = 0
- ledgerOctaveRegion(12) = 1
- ledgerOctaveRegion(23) = 1
- ledgerOctaveRegion(24) = 2
- ledgerOctaveRegion(-1) = -1

### `cnb/tests/cnb-grid-tests.js` (if Module 1 is attempted)

- semiToY(maxSemi) = 0
- semiToY(minSemi) = svgHeight
- semiToY and yToSemi are inverses for integer semitones
- svgHeight = totalSemiRange × pxPerSemi
- totalHeight = topLabelHeight + svgHeight + bottomLabelHeight
- Changing pxPerSemi in config changes all pixel values proportionally

### Test Runner: `cnb/tests/run-tests.js`

Use the same lightweight test runner pattern as the existing project. Should work in Node.js (for CI) and optionally in a browser test page.

```javascript
// Pattern:
export const tests = [
  { name: "test description", fn: () => { /* assertions */ } },
];
```

Provide an `assert(condition, message)` helper that throws on failure.

---

## FILE STRUCTURE TO CREATE

```
cnb/
├── src/
│   ├── cnb-config.js
│   └── cnb-music.js
├── tests/
│   ├── run-tests.js
│   ├── cnb-config-tests.js
│   └── cnb-music-tests.js
└── (if stretch goal reached)
    ├── src/cnb-grid.js
    ├── tests/cnb-grid-tests.js
    └── test-pages/test-grid.html
```

---

## DECISIONS ALREADY MADE (do not revisit)

- D1. Config uses `svgPath` / `svgHollowPath` naming (not `path` / `hollowPath`)
- D2. 4-point stem anchor model: `crotchetUp`, `crotchetDown`, `minimUp`, `minimDown`
- D3. Thickness expressed as percentage of semitone height (`thicknessPct`)
- D4. Notehead rules use priority-ordered cumulative merge (not first-match-wins)
- D5. `ledgers.templates` have no "outside staff" hard gate — proximity/override rules handle everything
- D6. LilyPond engine settings are in `config.engine` (separate from `config.display`)
- D7. Shapes store both SVG data and LilyPond data

---

## WHAT SUCCESS LOOKS LIKE

1. `cnb-config.js` exports all API methods, default config matches Appendix A
2. `cnb-music.js` exports all API methods
3. All unit tests pass in Node.js
4. Code uses ES module syntax (`export` / `import`)
5. No dependencies on any framework or external library
6. Clean, documented code with JSDoc comments on public API methods

---

## BATON FOR SESSION 9

If Module 1 was not completed: Session 9 builds Module 1 (Semitone Grid).
If Module 1 was completed: Session 9 builds Modules 2 + 3 (Staff Line + Staff).

Either way, Session 9's baton should include:
- Which modules were completed and their test results
- Any design decisions made during implementation
- Any issues discovered with the config schema that need amendment
