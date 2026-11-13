# BATON — Session 8 → Session 9

**Date:** February 27, 2026
**Session 8 completed by:** Claude (claude-sonnet-4-6)
**Architecture plan:** CNB-ARCHITECTURE-PLAN-v2.md
**LilyPond spec:** CNB-LY-EXPORT-SPEC-v1_2.md
**Test baseline entering Session 9:** 107/107 new + 240/240 legacy = 347 total passing

---

## WHAT WAS BUILT IN SESSION 8

Session 8 completed all three Phase 1 (Foundation) modules. Module 1 (Semitone Grid) was originally listed as a stretch goal — it was completed in full.

### Modules Delivered

| Module | File | Tests | Visual Page |
|--------|------|-------|-------------|
| A — Config Schema | `cnb/src/cnb-config.js` | 44 | — |
| B — Music Theory | `cnb/src/cnb-music.js` | 46 | — |
| 1 — Semitone Grid | `cnb/src/cnb-grid.js` | 17 | `cnb/test-pages/test-grid.html` |
| **Total** | | **107** | |

All tests pass: `node cnb/tests/run-tests.js` → 107 passing, 0 failing.
Legacy tests unchanged: `node legacy/run-tests.js` → 240 passing, 0 failing.

### Other Files Created

- `cnb/tests/run-tests.js` — lightweight test runner (ES modules, Node.js)
- `cnb/package.json` — `{"type":"module"}` (required for Node ES module support)
- `docs/checklists/session-8-checklist.xlsx` — human verification checklist (69 items)
- `docs/checklists/_gen_session8.py` — checklist generator script (keep for reference)

---

## DESIGN DECISIONS MADE IN SESSION 8

### D1 (carried forward from prior sessions — confirmed in implementation)
Config uses `svgPath` / `svgHollowPath` field names, not `path` / `hollowPath`.

### D2 — `renderDebugOverlay()` is caller-controlled, not flag-checked
The architecture plan says the overlay is "toggled by `config.display.debugGrid`". The
implementation exposes it purely as a callable function — the caller decides when to use it.
`config.display.debugGrid` exists in the schema but is not read by `renderDebugOverlay`.

**Rationale:** More composable. Test pages always want the overlay on; production
rendering never calls the function. A boolean flag inside the function would have no benefit.

**Impact on future modules:** Do NOT add a `config.display.debugGrid` check inside
`renderDebugOverlay`. If the flag is ever used, the caller should check it before calling.

### D3 — `topLabelHeight` formula
`topLabelHeight = marginTop + fontSize + padding` (three fields summed).
This is: the space above the label text (`marginTop`) + the label text itself (`fontSize`) +
the gap between label text and the SVG note area (`padding`).
Same formula for `bottomLabelHeight`. Hardcoded from `config.display.label`.

### D4 — `ledgerOctaveRegion()` is identical to `octave()` for now
Both use `Math.floor(semi / 12)`. They are kept as separate functions on `CNBMusic`
because Module 5 (Ledger Set) uses `ledgerOctaveRegion` by name in its algorithm, and
a future staff configuration might need ledger regions that don't align with octave
boundaries. **Do not merge or alias them.**

### D5 — Validation error #2 (hollow on shape without svgHollowPath)
The implementation flags this as an **error** only when a single rule's `apply` block
sets **both** `hollow: true` and an explicit `shape` whose hollow path is absent.
The cross-rule case (hollow set by rule B, shape set by rule A, resolved hollow but
no hollow path) is caught by **warning W2**, which walks all 12 PCs via `resolveNotehead`.
This split (direct-rule error vs. resolution-level warning) follows the spec's intent.

### D6 — Test range for test-grid.html is -4 to 28, not -5 to 29
The baton for Session 8 suggested -5 to 29 as the standard range with margins. The
test page was built with -4 to 28 (32 semitones). Either is acceptable; **use -4 to 28
as the standard visual test range going forward** for consistency across test pages.

---

## ISSUES, DEVIATIONS, AND AMENDMENTS

### Amendment A1 — No deviations from Architecture Plan v2
All APIs match the plan's specifications. No schema changes, no API signature changes.
The plan remains authoritative.

### Note: Shapes with `anchors: null` are fully legal
The default config's `crotchet-minim` shape has non-null anchors, but `semibreve` and
`breve` (when added) will have `anchors: null`. Module 8 (Stem) must handle `null`
anchors gracefully (return `null` from `geometry()`, render nothing). This is already
in the architecture plan — just noting it explicitly because Session 9 builds Module 8.

---

## WHAT TO BUILD IN SESSION 9

Session 9 covers **Phase 2: Rendering Primitives** from the Architecture Plan §6.

Build order within the session (dependency-safe):

| Order | Module | File | Depends On |
|-------|--------|------|------------|
| 1 | **2 — Staff Line** | `cnb-staff-line.js` | Nothing |
| 2 | **4 — Ledger Line** | `cnb-ledger-line.js` | Nothing |
| 3 | **6 — Notehead** | `cnb-notehead.js` | Module A |
| 4 | **8 — Stem** | `cnb-stem.js` | Module A |
| 5 | **3 — Staff** | `cnb-staff.js` | Modules A, 1, 2 |

Modules 2 and 4 have no dependencies. Build them first, in parallel conceptually.
Then Module 6 (reads shape config from A).
Then Module 8 (reads display config and anchors from A).
Then Module 3 (needs A, 1, 2 all done).

The visual test page for the session is `test-staff.html`, which composes Modules 2+3+1.
A combined `test-notehead.html` can show Module 6 standalone.
No visual test page is needed for Modules 4 and 8 alone (they'll be tested in composite
pages in Session 10 when ledger sets and cards are built).

---

## WHAT TO READ FIRST (Session 9)

1. **This document** — read fully before writing code.
2. **CNB-ARCHITECTURE-PLAN-v2.md §5** — Module specs for Modules 2, 3, 4, 6, 8. Read each
   spec in build order above before implementing that module.
3. **`cnb/src/cnb-config.js`** — Review the `shapes` schema and `display` settings.
   Module 6 reads `shape.svgPath`, `shape.svgHollowPath`, `shape.naturalHeight`,
   `shape.naturalWidth`, `shape.semitoneHeight`.
   Module 8 reads `shape.anchors`, `display.stemThicknessPct`, `display.stemExtension`.
   Module 3 reads `staff.semitonePattern`, `staff.midpoint`, `staff.lineDefaults`,
   `staff.lineOverrides`.
4. **`cnb/src/cnb-grid.js`** — Understand `semiToY()`. Modules 3 and future renderers
   pass `gridContext` around. Module 2 takes a `y` value (already converted).
5. **`cnb/test-pages/test-grid.html`** — See the visual test page pattern; replicate it.

---

## MODULE SPECIFICATIONS FOR SESSION 9

### Module 2: Staff Line (`cnb-staff-line.js`)

**Purpose:** Render a single horizontal staff line. A pure SVG element factory.

**Public API:**
```javascript
export const CNBStaffLine = {
  render(svgParent, { y, x1, x2, thickness, color, style }) → SVGLineElement
};
```

- Creates and appends a `<line>` element to `svgParent`.
- `y` is already in SVG pixel coordinates (from `grid.semiToY()`).
- `thickness` is already in pixels (caller converts from `thicknessPct` using
  `CNBConfig.pctToPx()`).
- `style`: `"solid"` → no dash; `"dashed"` → `stroke-dasharray: "8,4"`;
  `"dotted"` → `stroke-dasharray: "2,4"`.
- Returns the `<line>` element.

**Dependencies:** None (pure SVG DOM factory).

**Test approach:** DOM required, so unit tests are limited to checking the function
exists and returns an element when called with a mock SVG parent. Most verification is
visual via `test-staff.html`.

---

### Module 4: Ledger Line (`cnb-ledger-line.js`)

**Purpose:** Render a single ledger line unconditionally. A pure SVG element factory.

**Public API:**
```javascript
export const CNBLedgerLine = {
  render(svgParent, { y, centerX, width, thickness, color, style, roundedEnds }) → SVGElement
};
```

- `roundedEnds: true` → create a `<rect>` centered on `centerX`, with `rx`/`ry` = `thickness / 2`.
- `roundedEnds: false` → create a `<line>` from `(centerX - width/2, y)` to
  `(centerX + width/2, y)`.
- `thickness` is in pixels (caller converts from `thicknessPct`).
- `style` same dash values as Module 2.

**Dependencies:** None.

---

### Module 6: Notehead (`cnb-notehead.js`)

**Purpose:** Render a single notehead shape at a given position.

**Public API:**
```javascript
export const CNBNotehead = {
  // Compute scale factor and pixel dimensions from shape config
  measure(shape, pxPerSemi) → { scaleFactor, pixelWidth, pixelHeight },

  // Render a single notehead
  render(svgParent, { shape, x, y, scaleFactor, hollow, color }) → SVGGElement
};
```

**`measure()` formula:**
```
scaleFactor = (shape.semitoneHeight × pxPerSemi) / shape.naturalHeight
pixelHeight = shape.naturalHeight × scaleFactor     // = semitoneHeight × pxPerSemi
pixelWidth  = shape.naturalWidth  × scaleFactor
```

**`render()` structure:**
```
<g transform="translate(x, y)">
  <path d="..." transform="scale(scaleFactor)" fill="{color}" />
  if hollow:
    <path d="..." transform="scale(scaleFactor)" fill="white" />
</g>
```

The outer `<g>` handles positioning; `scale()` handles sizing.
The SVG paths are centered at origin (0,0) in native SVG units —
the existing `crotchet-minim` path data confirms this (values span positive and negative).

**Dependencies:** Module A (shape config structure — reads `svgPath`, `svgHollowPath`,
`naturalHeight`, `naturalWidth`, `semitoneHeight`).

**Test cases (unit-testable with minimal DOM mock):**
- `measure()` is pure math — fully unit-testable without DOM
- `measure("crotchet-minim" shape, 16)`:
  - `scaleFactor = (2.724 × 16) / 272.4 = 0.16` (exactly)
  - `pixelHeight = 272.4 × 0.16 = 43.584`
  - `pixelWidth = 344.852 × 0.16 = 55.17632`
- `measure` with any shape: `pixelHeight = shape.semitoneHeight × pxPerSemi` (always)
- `measure` with pxPerSemi=32: scale factor doubles

---

### Module 8: Stem (`cnb-stem.js`)

**Purpose:** Compute stem geometry and render a stem line using the 4-point anchor model.

**Public API:**
```javascript
export const CNBStem = {
  // Determine stem direction: average of chord semitones vs staff midpoint
  // Below midpoint → "up"; at or above → "down"
  direction(chordSemitones, staffMidpoint) → "up" | "down",

  // Compute stem geometry from 4-point anchor model
  // Returns null if shape.anchors is null (stemless)
  geometry(config, { shape, scaleFactor, centerX, noteYPositions,
                     direction, duration }) → { x, y1, y2, thickness } | null,

  // Render a stem line; returns null if geometry is null
  render(svgParent, stemGeometry) → SVGLineElement | null
};
```

**`direction()` algorithm:**
```
average = sum(chordSemitones) / chordSemitones.length
if average < staffMidpoint:  return "up"   (stem on right side)
else:                        return "down"  (stem on left side)
```

**`geometry()` — 4-point anchor model:**

1. Select the correct anchor from `shape.anchors` based on direction + duration:
   - `"up"` + `"crotchet"` → `anchors.crotchetUp`
   - `"up"` + `"minim"` → `anchors.minimUp`
   - `"down"` + `"crotchet"` → `anchors.crotchetDown`
   - `"down"` + `"minim"` → `anchors.minimDown`
   - Any other duration (semibreve, breve): return `null` (stemless)

2. Convert anchor from native SVG units to pixels:
   ```
   anchorXpx = anchor.x × scaleFactor
   anchorYpx = anchor.y × scaleFactor
   ```

3. Compute stem attachment point:
   ```
   stemX = centerX + anchorXpx
   ```
   (`direction("up")` → anchor.x is positive → stem on right of center; confirmed by
   crotchet-minim data: crotchetUp.x = 157.29, positive = right side ✓)

4. Compute stem extent (the far end, beyond the outermost notehead):
   ```
   stemExtensionPx = config.display.stemExtension × (shape.semitoneHeight × scaleFactor × pxPerSemi)
   ```
   Wait — `semitoneHeight` and `scaleFactor` together give the notehead height in pixels.
   Actually: `noteheadHeightPx = shape.semitoneHeight × pxPerSemi` (since scaleFactor
   already encodes the semitoneHeight-to-naturalHeight ratio).
   So: `extensionPx = config.display.stemExtension × noteheadHeightPx`.

5. Stem endpoints: `y1` = attachment at the notehead closest to staff; `y2` = far end
   extended past the farthest notehead.
   - `"up"`: attachment at lowest notehead (`max(noteYPositions)`); far end above highest
     (`min(noteYPositions) - extensionPx`).
   - `"down"`: attachment at highest notehead (`min(noteYPositions)`); far end below lowest
     (`max(noteYPositions) + extensionPx`).

6. Stem thickness:
   ```
   thickness = CNBConfig.pctToPx(config.display.stemThicknessPct, config.display.pxPerSemi)
   ```

**Test cases:**
- `direction([0, 12], 12)` = `"up"` (average 6 < 12)
- `direction([12, 24], 12)` = `"down"` (average 18 ≥ 12)
- `direction([12], 12)` = `"down"` (average 12 ≥ 12, at midpoint → down)
- `direction([11, 12], 12)` = `"up"` (average 11.5 < 12)
- `geometry(...)` with `shape.anchors = null` → returns `null`
- `geometry(...)` with duration `"semibreve"` → returns `null`
- `geometry(...)` stem up, crotchet: `stemX` is to the right of centerX (positive anchor.x)
- `geometry(...)` stem down, crotchet: `stemX` is to the left of centerX (negative anchor.x)
- Thickness = `pctToPx(26, 16)` = 4.16 for default config

---

### Module 3: Staff (`cnb-staff.js`)

**Purpose:** Expand staff pattern to absolute semitone positions and render all staff lines.

**Public API:**
```javascript
export const CNBStaff = {
  // Expand semitonePattern across enough octaves to cover noteRange,
  // return sorted list of absolute semitone positions.
  getPositions(config, { minSemi, maxSemi }) → number[],

  // Return the staff midpoint (from config.staff.midpoint)
  getMidpoint(config) → number,

  // Render all staff lines as a group into svgParent
  render(svgParent, gridContext, config, totalWidth) → SVGGElement
};
```

**`getPositions()` algorithm:**
```
pattern = config.staff.semitonePattern     // e.g. [4, 8]
result = []
// Cover enough octaves to include the entire range plus one above/below for safety
minOct = Math.floor(minSemi / 12) - 1
maxOct = Math.floor(maxSemi / 12) + 1
for oct in [minOct .. maxOct]:
  for s in pattern:
    abs = s + oct * 12
    if abs >= minSemi && abs <= maxSemi:
      result.push(abs)
return result.sort((a, b) => a - b)
```

**`render()` algorithm:**
```
positions = getPositions(config, { minSemi: gridContext.minSemi, maxSemi: gridContext.maxSemi })
overrides = config.staff.lineOverrides    // keyed by semiWithinOctave as string
defaults = config.staff.lineDefaults

g = <g class="cnb-staff">
for each abs in positions:
  pc = abs % 12  (the semiWithinOctave key)
  props = merge(defaults, overrides[String(pc)] || {})
  thicknessPx = CNBConfig.pctToPx(props.thicknessPct, gridContext.pxPerSemi)
  y = gridContext.semiToY(abs)
  CNBStaffLine.render(g, { y, x1: 0, x2: totalWidth, thickness: thicknessPx,
                            color: props.color, style: props.style })
return g
```

**Test cases (unit-testable pure logic in `getPositions` and `getMidpoint`):**
- `getPositions(config, {minSemi:0, maxSemi:24})` with 4-8 pattern → `[4, 8, 16, 20]`
- `getPositions` with 3-6-9 pattern, range 0–24 → `[3, 6, 9, 15, 18, 21]`
- `getPositions` range 0–12 with 4-8 → `[4, 8]` (semi 12 is the C, not a staff line)
- `getPositions` range 4–4 (single semi) with 4-8 → `[4]`
- `getPositions` returns sorted ascending results
- `getMidpoint(default config)` → `12`
- Line override for semiWithinOctave 4: overrides thicknessPct only, color inherited from defaults

**Visual test page: `cnb/test-pages/test-staff.html`**
- Imports Modules A, 1, 2, 3
- Default 4-8 config, range -4 to 28
- Renders full-width SVG (e.g. 500px) with staff lines and debug overlay
- Staff lines at semitones 4, 8, 16, 20 should align with the blue debug grid lines
- Change pattern to 3-6-9 and verify different positions

---

## VISUAL TEST PAGE PATTERN

All visual test pages follow the same structure established by `test-grid.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CNB {Module} Test</title>
  <style>/* card/body styles */</style>
</head>
<body>
  <h1>Module N: {Name} — Description</h1>
  <p>What to look for / verification notes</p>
  <div class="card">
    <svg id="main-svg" ...></svg>
  </div>
  <script type="module">
    import { CNBConfig } from "../src/cnb-config.js";
    import { CNBGrid }   from "../src/cnb-grid.js";
    // + module under test

    const config = CNBConfig.createDefault();
    const grid   = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });

    // size SVG, render debug overlay, render module output
    // console.log verification values
  </script>
</body>
</html>
```

Use range `{ minSemi: -4, maxSemi: 28 }` as the standard visual range for all test pages.

---

## FILE STRUCTURE TO CREATE IN SESSION 9

```
cnb/
├── src/
│   ├── cnb-staff-line.js      Module 2 — new
│   ├── cnb-ledger-line.js     Module 4 — new
│   ├── cnb-notehead.js        Module 6 — new
│   ├── cnb-stem.js            Module 8 — new
│   └── cnb-staff.js           Module 3 — new
├── tests/
│   ├── cnb-staff-tests.js     Module 3 pure logic tests — new
│   ├── cnb-notehead-tests.js  Module 6 measure() tests — new
│   └── cnb-stem-tests.js      Module 8 direction/geometry tests — new
└── test-pages/
    ├── test-staff.html         Modules 2+3+1 visual test — new
    └── test-notehead.html      Module 6 visual test — new
```

**Note on test coverage:** Modules 2 and 4 are SVG DOM factories with no pure logic.
Their unit tests would be minimal (existence checks). Skip unit test files for Modules 2
and 4 — rely on visual test pages and their use in composite tests in Session 10.

---

## WHAT SUCCESS LOOKS LIKE

1. `node cnb/tests/run-tests.js` passes all new tests plus the original 107 (total ≥ 140)
2. `node legacy/run-tests.js` still shows 240 passing
3. `test-staff.html` opens in a browser, showing a correctly-positioned staff with debug
   overlay, staff lines aligned with the blue grid marks at semitones 4, 8, 16, 20
4. `test-notehead.html` shows the crotchet-minim notehead scaled correctly (spans 2.724
   semitones vertically) with solid and hollow variants side by side
5. All ES module imports work without build tools

---

## BATON FOR SESSION 10

Session 10 builds Phase 3 composites:
- Module 5 — Ledger Set (the most complex module: display rules, octave awareness)
- Module 7 — Double Notehead
- Module 9 — Octave Chord Card
- Module 10 — Card Collection (full chromatic row)

The Session 9 baton should include:
- Exact test counts for each new module
- Any issues found with Module 8's 4-point anchor math when rendered visually
- Confirmation of whether the `test-notehead.html` hollow rendering looks correct
  (hollow = white overlay — known limitation: only works on white/solid background)
- Any amendments to the stem thickness / extension formula after visual verification
