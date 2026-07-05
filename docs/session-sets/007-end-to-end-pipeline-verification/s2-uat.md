# Session 2 — UAT pass: discrepancy-free round-trip (per-set UAT)

**Session set:** 007-end-to-end-pipeline-verification — Session 2 of 2
**Date:** 2026-07-05
**Scope:** spec step 3 — "Re-diff the final `.ly` export's rendered output
against the golden baseline — this is the UAT pass for this set (per
`uatScope: per-set`): confirm visual and structural equivalence."

Every transcript below is the complete, unedited output of the stated
command, followed by its exit code captured immediately after the command
(`exit: N`). Working directories are stated per command. The golden
baseline is the engine repo's top-level `joy-to-the-world.ly`
(procedure-model score) at `d:/Projects/lilypond-chromatic-notation-base`.
No hand edits are applied to any generated artifact at any step.

The exhaustive-diff and visual-diff scripts used below are the session's
scratchpad tooling (same method as session 1): `exhaustive_diff.py`
compares EVERY harvested element in both directions on presence, type,
color, bbox, staff-relative vertical, and path hash; `visual_diff.mjs`
rasters both SVGs in Chromium on white at the given scale and counts
pixels whose max RGB channel delta exceeds 0. Both scripts' full source is
reproduced at the end of this record.

---

## 1. Unit tests — cnb suite (all modules incl. the fixed exporter)

Working directory: `/d/Projects/chromatic-notation-configurator`

```
$ node cnb/tests/run-tests.js

cnb-music-tests (46 tests)
  ✓ pitchClass(0) = 0
  ✓ pitchClass(11) = 11
  ✓ pitchClass(12) = 0
  ✓ pitchClass(13) = 1
  ✓ pitchClass(23) = 11
  ✓ pitchClass(24) = 0
  ✓ pitchClass(-1) = 11
  ✓ pitchClass(-12) = 0
  ✓ pitchClass(-13) = 11
  ✓ octave(0) = 0
  ✓ octave(11) = 0
  ✓ octave(12) = 1
  ✓ octave(23) = 1
  ✓ octave(24) = 2
  ✓ octave(-1) = -1
  ✓ octave(-12) = -1
  ✓ octave(-13) = -2
  ✓ absoluteSemi(0, 0) = 0
  ✓ absoluteSemi(0, 1) = 12
  ✓ absoluteSemi(11, 0) = 11
  ✓ absoluteSemi(0, 2) = 24
  ✓ absoluteSemi(5, 1) = 17
  ✓ pcLabel(0)  = C natural
  ✓ pcLabel(1)  = C sharp
  ✓ pcLabel(2)  = D natural
  ✓ pcLabel(3)  = D sharp
  ✓ pcLabel(4)  = E natural
  ✓ pcLabel(5)  = F natural
  ✓ pcLabel(6)  = F sharp
  ✓ pcLabel(7)  = G natural
  ✓ pcLabel(8)  = G sharp
  ✓ pcLabel(9)  = A natural
  ✓ pcLabel(10) = A sharp
  ✓ pcLabel(11) = B natural
  ✓ pcLabel returns a copy (no aliasing)
  ✓ chromaticLabels() has 13 entries
  ✓ chromaticLabels()[0] = C natural
  ✓ chromaticLabels()[1] = C sharp
  ✓ chromaticLabels()[12] = C natural (upper C)
  ✓ chromaticLabels()[11] = B natural
  ✓ ledgerOctaveRegion(0) = 0
  ✓ ledgerOctaveRegion(11) = 0
  ✓ ledgerOctaveRegion(12) = 1
  ✓ ledgerOctaveRegion(23) = 1
  ✓ ledgerOctaveRegion(24) = 2
  ✓ ledgerOctaveRegion(-1) = -1

cnb-config-tests (44 tests)
  ✓ VERSION is '1.0'
  ✓ createDefault() returns an object
  ✓ createDefault() has version '1.0'
  ✓ createDefault() has crotchet-minim shape
  ✓ createDefault() has staff pattern [4, 8]
  ✓ createDefault() has 2 noteheadRules
  ✓ createDefault() returns a fresh copy each call
  ✓ createDefault() passes validate()
  ✓ validate: missing shape reference → error
  ✓ validate: staff pattern < 2 → error
  ✓ validate: fileSuffix without hyphen → error
  ✓ validate: fileSuffix empty string → no error
  ✓ validate: bad hex in rule color → error
  ✓ validate: PC not covered by any rule → error
  ✓ validate: bad hex in palette → error
  ✓ validate: empty notationLabel → warning
  ✓ validate: shape with lilypondPath:null → warning
  ✓ validate: CB-safe palette shorter than primary → warning
  ✓ merge: empty partial over default = structurally equal to default
  ✓ merge: changes pxPerSemi without affecting other display fields
  ✓ merge: merging new noteheadRules replaces the array entirely
  ✓ merge: nested staff.lineDefaults preserves unmodified sibling fields
  ✓ merge: does not mutate base
  ✓ merge: does not mutate partial
  ✓ clone: mutating clone does not affect original
  ✓ clone: deeply nested objects are independent
  ✓ clone: arrays are independent
  ✓ resolveNotehead: PC 0 → solid crotchet-minim (default 4-8 config)
  ✓ resolveNotehead: PC 1 (C♯) → hollow crotchet-minim
  ✓ resolveNotehead: PC 3, 6, 8, 10 are hollow (default 4-8)
  ✓ resolveNotehead: PC 0, 2, 4, 5, 7, 9, 11 are solid (default 4-8)
  ✓ resolveNotehead: higher priority wins over lower
  ✓ resolveNotehead: partial apply inherits other fields
  ✓ resolveNotehead: duration matching (rule for crotchet only)
  ✓ resolveNotehead: 'all' match.pitchClasses matches every PC
  ✓ resolveColor: no palette → null
  ✓ resolveColor: with primary palette returns correct hex
  ✓ resolveColor: useCBSafe returns CB-safe hex
  ✓ resolveColor: PC not in palette → null
  ✓ pctToPx(20, 16) = 3.2
  ✓ pctToPx(100, 16) = 16
  ✓ pctToPx(0, 16) = 0
  ✓ pctToPx(40, 20) = 8
  ✓ pctToPx(26, 16) = 4.16

cnb-grid-tests (17 tests)
  ✓ create() returns a gridContext object
  ✓ pxPerSemi matches config.display.pxPerSemi
  ✓ minSemi and maxSemi are stored correctly
  ✓ totalSemiRange = maxSemi - minSemi
  ✓ svgHeight = totalSemiRange × pxPerSemi
  ✓ totalHeight = topLabelHeight + svgHeight + bottomLabelHeight
  ✓ semiToY(maxSemi) = 0 (top of SVG)
  ✓ semiToY(minSemi) = svgHeight (bottom of SVG)
  ✓ semiToY increases as semitone decreases (higher pitch = lower Y)
  ✓ semiToY: one semitone step = pxPerSemi pixels
  ✓ semiToY(midpoint) = svgHeight / 2 for symmetric range
  ✓ yToSemi(0) = maxSemi
  ✓ yToSemi(svgHeight) = minSemi
  ✓ semiToY and yToSemi are exact inverses for integer semitones
  ✓ yToSemi(semiToY(s)) = s for non-integer semitone
  ✓ topLabelHeight and bottomLabelHeight are positive numbers
  ✓ changing pxPerSemi scales svgHeight proportionally

cnb-staff-tests (9 tests)
  ✓ getPositions 0-24 with 4-8 pattern returns 4,8,16,20
  ✓ getPositions 0-24 with 3-6-9 pattern
  ✓ getPositions 0-12 with 4-8 returns [4,8]
  ✓ getPositions single semitone range returns that line
  ✓ getPositions results are sorted ascending
  ✓ getMidpoint returns config.staff.midpoint
  ✓ default line thickness 20% of 16px semitone converts to 3.2px
  ✓ override thickness 50% of 16px semitone converts to 8px
  ✓ line override merges thickness only

cnb-notehead-tests (5 tests)
  ✓ measure formula with crotchet-minim shape and pxPerSemi=16
  ✓ measure pixelHeight equals semitoneHeight × pxPerSemi
  ✓ measure preserves the shape's natural aspect ratio
  ✓ measure scales linearly with pxPerSemi
  ✓ measure works for a synthetic 1-semitone shape

cnb-stem-tests (14 tests)
  ✓ direction up when average below midpoint
  ✓ direction down when average at or above midpoint
  ✓ direction up with 11,12 vs midpoint 12
  ✓ geometry returns null for null anchors
  ✓ geometry returns null for non-stem duration
  ✓ stemX sign reflects anchor.x and direction
  ✓ crotchet vs minim anchor selection (up)
  ✓ crotchet vs minim anchor selection (down)
  ✓ stem up extends above highest notehead by stemExtension notehead-heights
  ✓ stem down extends below lowest notehead by stemExtension notehead-heights
  ✓ anchor y offset shifts attachment point from notehead center
  ✓ geometry returns null for a stemless shape with no anchors property
  ✓ geometry returns null for missing anchor key
  ✓ thickness equals pctToPx default 26,16

cnb-ledger-set-tests (34 tests)
  ✓ buildDefs expands default templates across octaves 0–2
  ✓ buildDefs drops positions outside the range
  ✓ buildDefs handles negative range start
  ✓ buildDefs copies triggerPCs and triggerMode from the template
  ✓ buildDefs attaches lineOverrides by semiWithinOctave to every octave instance
  ✓ buildDefs drops proximity templates when proximityRule is false
  ✓ isBetween: note at ledger, not on a staff line → true
  ✓ isBetween: note at ledger, on a staff line → false
  ✓ isBetween: ledger above note needs a staff line above the ledger
  ✓ isBetween: ledger below note needs a staff line below the ledger
  ✓ C (semi 0): C-ledger shown at semi 0
  ✓ D (semi 2): C-ledger (0) and D-ledger (2) both shown
  ✓ E (semi 4, on staff line): no ledgers
  ✓ F (semi 5, inside staff): no ledgers
  ✓ C' (semi 12) in 4-8 with default C template: ledger at 12 shown
  ✓ C' (semi 12) in 4-8 with no matching template: no ledgers
  ✓ C' (semi 12) in 3-6-9: ledger triggered in the 9–15 gap (no outside-staff gate)
  ✓ C'' (semi 24): upper C-ledger shown
  ✓ A♯ (semi 22): A♯-ledger shown above staff line 20
  ✓ octave awareness: lower C ledger (0) NOT triggered by note at 24
  ✓ octave chord C+C' (0, 12): each octave's C ledger shown
  ✓ proximity: note strictly closer to ledger than to staff → shown
  ✓ proximity: tie with nearest staff line → not shown
  ✓ proximity: note on the ledger itself → shown
  ✓ proximity is octave-aware too
  ✓ resolve de-duplicates a ledger triggered by multiple notes
  ✓ resolve returns sorted positions regardless of note order
  ✓ resolve with empty notes returns empty
  ✓ render: appends a group with one rect per resolved ledger
  ✓ render: rects centered on semiToY with pct-derived thickness and centerX
  ✓ render: lineOverrides restyle every octave instance of a template
  ✓ render: note on a staff line renders an empty group
  ✓ render: default opts produce a positive width and column-padding centerX
  ✓ render: grid range cropping does not change decisions (D near range floor)

cnb-double-notehead-tests (10 tests)
  ✓ layout: y positions come from semiToY of each semitone
  ✓ layout: offsetPercent 0 (and default) puts both noteheads at centerX
  ✓ layout: offsetPercent 100 separates noteheads by one notehead width, centered
  ✓ layout: offset scales with the wider of the two shapes
  ✓ layout: scale factors match CNBNotehead.measure per shape
  ✓ layout: works for a non-octave pair (any two semitones)
  ✓ render: appends two groups and returns {lowerG, upperG, lowerY, upperY}
  ✓ render: groups positioned by layout() and paths carry note colors
  ✓ render: hollow note gets a white overlay path, solid note does not
  ✓ render: default color is black when note.color is absent

cnb-card-tests (20 tests)
  ✓ resolveNotehead: delegates rule walking (sharps hollow, naturals solid)
  ✓ resolveNotehead: color falls back to black with no palette and no rule color
  ✓ resolveNotehead: palette color used when rule color is null
  ✓ resolveNotehead: explicit rule color overrides the palette
  ✓ resolveNotehead: pc 12 (upper C) normalizes to pitch class 0
  ✓ columnWidth = notehead width × widthMultiplier + 2 × paddingH
  ✓ render: pc-col with label-top, note-slice svg, label-bottom; appended to container
  ✓ render: svg sized to column width × grid svgHeight; labels sized to grid label heights
  ✓ render: draw order is ledgers, stem, then two noteheads on top
  ✓ render: both labels carry the pitch-class text (natural: no sharp span)
  ✓ render: sharp pitch class gets a styled ♯ span
  ✓ render: pc 12 (upper C) labeled C
  ✓ render: C chord (semis 0+12) shows ledgers at 0 and 12
  ✓ render: E chord (on staff lines) shows no ledgers
  ✓ render: stem line matches CNBStem.geometry (pc 0, direction up, right of center)
  ✓ render: chord at/above midpoint stems down (pc 12 → left side)
  ✓ render: stemless duration (semibreve, hasStem false) draws no stem
  ✓ render: noteheads sit at semiToY(pc) and semiToY(pc+12), centered on the column
  ✓ render: hollow pc renders white overlay paths on both noteheads
  ✓ render: resolved color reaches both notehead fills

cnb-collection-tests (9 tests)
  ✓ gridRange: 4 semitones of headroom below the lowest and above the highest chord
  ✓ render: cnb-preview root appended to container, one row, 13 default cards
  ✓ render: preview-container holds staff bg SVG (first) then pc-columns flex row
  ✓ render: staff bg sized to the summed column widths and grid svgHeight
  ✓ render: staff bg offset down by topLabelHeight so lines align with note-slices
  ✓ render: staff bg contains continuous lines at every staff position in range
  ✓ render: pitchClasses subset renders only those cards, in order
  ✓ render: one row per duration, each captioned with the duration displayName
  ✓ render: display.debugGrid adds the debug overlay behind the staff lines

cnb-lilypond-tests (54 tests)
  ✓ svgPathToLilypond converts M/L/C/Z
  ✓ svgPathToLilypond folds H/V into lineto with tracked position
  ✓ svgPathToLilypond rounds to 4 decimals by default
  ✓ svgPathToLilypond honors explicit precision
  ✓ svgPathToLilypond normalizes -0 to 0
  ✓ svgPathToLilypond returns '() for empty/invalid input
  ✓ toSchemeSymbol combines name and hex
  ✓ toSchemeSymbol without hex slugs the name
  ✓ toSchemeSymbol collapses repeats and trims hyphens
  ✓ staff-line-positions: 4-8 system, midpoint 12, sps 4 → (-4 -2 2 4) half-staff-spaces
  ✓ staff-line-positions: 3-6-9 system, midpoint 12, sps 3 → (-6 -4 -2 2 4 6) half-staff-spaces (engine reference)
  ✓ header emits version, include, and generated-by block
  ✓ header version comes from engine.lilypondVersion
  ✓ sectionA falls back to SVG path conversion when lilypondPath is null
  ✓ sectionA prefers pre-baked lilypondPath verbatim
  ✓ sectionA registers paths and hollow cutouts
  ✓ sectionA omits hollow registration when shape has no hollow path
  ✓ sectionA converts SVG anchors to staff-space units (÷ scale, Y-invert, ÷ sps)
  ✓ sectionA prefers lilypondAnchors (semitone units), converting ÷ sps at export
  ✓ sectionA marks stemless shapes and skips attachment registration
  ✓ sectionA default config registers only black (no palette)
  ✓ sectionA emits CB-safe conditional block with identical symbols in both branches
  ✓ sectionA falls back to color-<hex> symbols when schemeSymbols is empty
  ✓ sectionA registers explicit rule colors with identity CB fallback
  ✓ sectionB always emits staff geometry (positions in half-staff-spaces, D2)
  ✓ sectionB always emits cnb:use-procedure-model #t (D1 — engine defaults to the vector model)
  ✓ sectionB omits all engine settings at their defaults
  ✓ sectionB emits changed engine settings
  ✓ sectionB converts changed staff-line thickness: 40% at sps 4 → 0.1
  ✓ sectionB emits changed staff-line color
  ✓ sectionB always emits file-suffix and notation-label
  ✓ sectionB emits footnote only when non-empty, with Scheme escaping
  ✓ usedShapes resolves rule-referenced shapes from the default config
  ✓ usedShapes ignores shapes not present in config.shapes
  ✓ usedColors pairs primary and CB-safe hexes by pitch class
  ✓ sectionC emits the procedure scaffolding (set!/lambda/let/cond)
  ✓ sectionC groups identical configs into memv clauses (default: naturals vs sharps)
  ✓ sectionC uses (= pc N) for single-pc groups
  ✓ sectionC resolves palette colors to their scheme symbols
  ✓ sectionC emits hollow #f when the shape has no hollow path
  ✓ sectionC emits attachment #f for stemless shapes
  ✓ sectionC repeat field follows representationMode
  ✓ sectionC emits a fallback else clause closing the procedure
  ✓ sectionC warns and emits no procedure when no rules are defined
  ✓ sectionC default config has no duration conditions (uniform across durations)
  ✓ sectionC emits compound (and pc duration) clauses for duration-varying pcs
  ✓ generate concatenates header, A, B, C in mandatory order
  ✓ generate output contains the complete Section C procedure
  ✓ generate throws on blocking validation errors
  ✓ generate throws when a used shape has no path data
  ✓ sectionC throws when a duration-varying duration lacks lilypondDuration
  ✓ parity: sectionC is semantically equivalent to the legacy exporter for the default 4-8 config
  ✓ parity: pc-condition helper matches legacy buildPitchClassCondition
  ✓ parity: generate() vs legacy generateLy(), section by section, for the default 4-8 config

cnb-svg-importer-tests (35 tests)
  ✓ shapeNameFromFilename strips path and extension
  ✓ displayNameFromShapeName title-cases kebab names
  ✓ parseViewBox handles space and comma separators
  ✓ parseViewBox rejects missing or malformed values
  ✓ parseRectAttrs converts strings, defaults invalid to 0
  ✓ anchorsFromStemRects: up = bottom-center of stem-up rect, down = top-center of stem-down rect
  ✓ anchorsFromStemRects reproduces the default config's crotchet-minim anchors
  ✓ anchorsFromStemRects: 4-point model duplicates the toolkit's single up/down pair
  ✓ anchorsFromStemRects: no rects → null (stemless), one rect → other defaults to origin
  ✓ toLilypondAnchors divides by SVG-units-per-semitone and inverts Y
  ✓ toLilypondAnchors inverts a nonzero Y (SVG Y-down → LilyPond Y-up)
  ✓ toLilypondAnchors returns null for stemless or unmeasurable shapes
  ✓ import-time lilypondAnchors match the exporter's fallback conversion (Section A parity)
  ✓ extract reads all fields from a toolkit-shaped document
  ✓ extract errors on missing notehead element or empty path
  ✓ extract tolerates absent hollow, stems, viewBox, and data attributes
  ✓ extract flags non-rect stem elements instead of misreading them
  ✓ extract accepts legacy false-hollow id and flags it
  ✓ buildShape produces a complete Module A shape entry from toolkit data
  ✓ buildShape derives semitoneHeight from viewBox when data attribute missing (with warning)
  ✓ buildShape errors when size is undeterminable (no data attribute, no viewBox)
  ✓ buildShape imports stemless shapes with null anchors and null lilypondAnchors
  ✓ buildShape warns when pre-baked LilyPond data is absent (exporter fallback path)
  ✓ buildShape warns on non-rect stems and single stem rect
  ✓ imported shape works with CNBNotehead.measure (renders at semitoneHeight × pxPerSemi)
  ✓ imported shape passes Module A validation inside a default config
  ✓ parseSvgText names the shape from the filename and builds the entry
  ✓ buildShape reads natural dims from root width/height when viewBox is missing
  ✓ buildShape errors instead of inventing a square width (no viewBox, no width attr)
  ✓ anchorsFromStemPoints builds the 4-point model from explicit points
  ✓ extract + buildShape fall back to LY spec §7.1 data-stem-* attributes (no rects)
  ✓ stem placemarker rects take precedence over data-stem-* attributes
  ✓ extract ignores partial or non-numeric data-stem-* attributes
  ✓ renderImportControl builds the drop zone + hidden file input and parses picked files
  ✓ parseSvgText surfaces XML parse errors

cnb-palette-editor-tests (39 tests)
  ✓ deltaE: identical colors have distance 0
  ✓ deltaE: black vs white is the maximum (100)
  ✓ deltaE: symmetric
  ✓ hexToRgb/rgbToHex round-trip, 3-digit hex expansion
  ✓ hexToLab: white is L=100, a=b=0
  ✓ distanceFromWhite: white is 0, black is 100
  ✓ nearestColorName: exact dictionary color matches itself
  ✓ colorSchemeSymbol: spec example #1b9e77 → shamrock-1b9e77 (LY spec §4.5)
  ✓ toSchemeSymbol: lowercases, collapses non-alphanumerics, trims hyphens
  ✓ colorSchemeSymbol: non-string falls back to black-000000
  ✓ baseColorName strips the hex suffix, keeps hyphenated names intact
  ✓ matchToCBSafe: CB-safe source colors map to themselves at distance 0
  ✓ matchToCBSafe: result aligned with input, one-to-one, distances rounded
  ✓ matchToCBSafe: more than 12 inputs throws
  ✓ presetColors: every registered preset resolves with the declared size
  ✓ preset labels reference no external notation system (naming check)
  ✓ buildPalette: standard preset cycles the pool across all 12 PCs
  ✓ buildPalette: cbSafeColors pair with primaries index-for-index (matchToCBSafe)
  ✓ buildPalette: schemeSymbols map every unique primary hex
  ✓ buildPalette: CB-safe preset uses the identity mapping (LY spec §4.5)
  ✓ buildPalette: custom palette uses nearest names and Custom · N label
  ✓ buildPalette: custom under the CB-safe tab is CB-safe-as-primary (identity)
  ✓ buildPalette: useCBSafe passes through; empty custom yields empty palette
  ✓ buildPalette: duplicate custom hexes share one CB-safe mapping per hex
  ✓ selectionFromPalette: preset palettes round-trip (key, family, useCBSafe)
  ✓ selectionFromPalette: custom palettes recover the cycled pool
  ✓ selectionFromPalette: CB-safe custom palettes keep the identity branch
  ✓ selectionFromPalette: empty/missing palette falls back to the default
  ✓ randomDistinctColor: deterministic with injected rng, valid hex, distinct
  ✓ integration: built palette validates against Module A
  ✓ integration: CNBConfig.resolveColor honors the built useCBSafe toggle
  ✓ integration: exporter emits the palette's scheme symbols and both A5 branches
  ✓ render: builds tabs, presets, custom, CB match, toggle, 12-cell preview
  ✓ render: clicking a preset fires onChange with the built config.palette
  ✓ render: family tab switch lists CB presets and remaps to the same size
  ✓ render: selecting custom seeds the legacy default colors
  ✓ render: custom color edit, add (max 12), and remove (min 1)
  ✓ render: CB-safe toggle flips useCBSafe and the preview swatches
  ✓ render: initializes from a saved config.palette (selectionFromPalette path)

cnb-staff-rule-editor-tests (42 tests)
  ✓ derivedGeometry: 4-8 → sps 4, midpoint 12, LY positions (-4 -2 2 4)
  ✓ derivedGeometry: 3-6-9 → sps 3, LY positions (-6 -4 -2 2 4 6)
  ✓ derivedGeometry: dedupes and sorts the input pattern
  ✓ derivedGeometry: throws on out-of-range or non-integer entries
  ✓ derivedGeometry: degenerate patterns (<2 lines) get sps 1, no throw
  ✓ derivedGeometry: LY positions match Module 11's computeStaffLinePositions
  ✓ buildStaff: produces a schema-shaped staff slice with derived geometry
  ✓ buildStaff: copies lineDefaults (no shared reference with state)
  ✓ buildStaff: prunes empty override entries, keeps populated ones
  ✓ buildStaff: overrides for lines outside the active pattern are not emitted
  ✓ buildStaff: out-of-pattern overrides survive in state — switching back restores them
  ✓ buildStaff: unknown patternKey throws (no silent fallback)
  ✓ buildLedgers: dedupes and sorts triggerPCs, keeps template order
  ✓ buildLedgers: proximityRule is a boolean, defaults preserved
  ✓ buildLedgers: throws on invalid position or trigger mode
  ✓ applyToConfig: does not mutate the input config
  ✓ applyToConfig: default state produces a config that validates clean
  ✓ validation pass-through: 1-line custom pattern surfaces the Module A error
  ✓ stateFromConfig: default config → 4-8 preset, 3 templates, proximity on
  ✓ stateFromConfig: recognizes 3-6-9 preset; unknown patterns open as custom
  ✓ round-trip: preset branch (apply → recover → apply is stable)
  ✓ round-trip: custom pattern branch
  ✓ round-trip: overrides, edited templates, and flags survive
  ✓ integration: 3-6-9 state yields CNBStaff positions [3,6,9,15,18,21] over 0–24
  ✓ integration: removing the C template stops CNBLedgerSet showing a ledger for C
  ✓ render: builds pattern options, derived panel, override rows, template rows, validation
  ✓ render: clicking the 3-6-9 preset updates state, onChange slice, and derived panel
  ✓ render: custom pattern seeds from current preset; PC toggles edit it
  ✓ render: staff defaults inputs update lineDefaults through onChange
  ✓ render: non-numeric thickness input is ignored (no NaN in state)
  ✓ render: enabling an override seeds it from defaults; editing and disabling work
  ✓ render: add / edit / remove ledger templates through the UI
  ✓ render: trigger pills toggle PCs without duplicates; mode select switches to proximity
  ✓ render: proximity checkbox and ledger defaults (width multiplier, rounded ends)
  ✓ render: invalid transient state (custom, 1 line) shows the validation error inline
  ✓ render: seeds from a passed config (3-6-9 preset recognized)
  ✓ renderPreview: default config over 0–24 → 4 staff lines, 25 note columns
  ✓ renderPreview: 3-6-9 applied config → 6 staff lines
  ✓ renderPreview: ledger columns match Module 5 resolution (C has a ledger, F none)
  ✓ renderPreview: octave awareness — C'' column carries the upper C ledger only
  ✓ renderPreview: marker dots sit at each note's grid Y; edge notes padded, not clipped
  ✓ renderPreview: honors exampleNotes and pxPerSemi options

cnb-notehead-rule-editor-tests (44 tests)
  ✓ buildRules: priority equals list index; sparse apply preserved
  ✓ buildRules: default state round-trips the default config byte-identically
  ✓ buildRules: dedupes and sorts explicit pitch classes and durations
  ✓ buildRules: empty apply block is legal and emitted as-is; blank name defaulted
  ✓ buildRules: throws on out-of-range PCs, bad shape, bad color (no silent repair)
  ✓ buildRules: color must be null or #RRGGBB — Module A's hex rule, enforced at build
  ✓ buildRules: offKeyMark must be false or a non-empty identifier
  ✓ applyToConfig: does not mutate the input config; replaces only noteheadRules
  ✓ applyToConfig: default state produces a config that validates clean
  ✓ validation pass-through: unknown shape and uncovered PCs surface Module A errors
  ✓ stateFromConfig: orders rules by ascending priority (stable), keeps sparse apply
  ✓ round-trip: arbitrary priorities normalize to 0..n-1 with identical resolution
  ✓ round-trip: explicit full-12 PC list is NOT collapsed to "all"
  ✓ round-trip: offKeyMark and explicit keys lists pass through untouched
  ✓ round-trip: explicit color hex and color:null (palette) both survive
  ✓ resolveAll: default config — sharps hollow, naturals solid, all 12 PCs
  ✓ resolveAll: effective color precedence — explicit hex > palette > black
  ✓ resolveAll: duration-specific rule only affects its duration
  ✓ reordering: swapping list order flips which rule wins (later overrides earlier)
  ✓ partial-apply inheritance: later hollow-only rule keeps earlier shape and color
  ✓ render: default config → 2 rule cards, resolved strip with 12 cells, valid banner
  ✓ render: add rule appends an all/all/all no-op rule and reports it through onChange
  ✓ render: remove rule updates slice; removing every rule surfaces coverage errors
  ✓ render: move down/up swaps rules and the resolved strip follows
  ✓ render: first card's up and last card's down buttons are disabled
  ✓ render: PC pills — clicking a pill while "all" narrows to all-except-clicked
  ✓ render: PC pills — explicit list toggles add/remove without duplicates
  ✓ render: duration pills narrow a rule to specific durations
  ✓ render: shape toggle enables apply.shape seeded with the first shape; select edits it
  ✓ render: hollow select flips between hollow cutout and solid fill
  ✓ render: color toggle defaults to palette mode (null); custom mode edits a hex
  ✓ render: keys row — pills from config.keys.definitions, narrowing and All restore
  ✓ render: keys row without definitions shows the nothing-to-narrow note, no pills
  ✓ render: key names on a loaded rule stay editable even without definitions (union)
  ✓ render: resolved strip key selector changes which key-matched rules apply
  ✓ render: off-key mark toggle — enable emits false, mark mode edits an identifier
  ✓ render: emptying the mark identifier holds the onChange (invalid transient state)
  ✓ render: rule name edits reach the slice without a redraw (focus preserved)
  ✓ render: hollow rule on a shape without a hollow path surfaces the Module A warning
  ✓ renderResolvedPreview: 12 cells, hollow PCs draw two paths, solid PCs one
  ✓ renderResolvedPreview: duration option changes which rules apply
  ✓ renderResolvedPreview: missing shape renders a labelled placeholder, svg null
  ✓ renderResolvedPreview: key option and off-key mark badge follow the resolution
  ✓ renderResolvedPreview: notehead color and labels come from the resolution

cnb-common-props-editor-tests (43 tests)
  ✓ ENGINE_DEFAULTS matches plan §4.10 / LY spec §5.2
  ✓ stateFromConfig: default config → shape mode, default counts + engine
  ✓ stateFromConfig: repeat mode recognized; anything else normalizes to shape
  ✓ stateFromConfig: missing engine fields fall back to §4.10 defaults
  ✓ stateFromConfig: state is independent of the config (deep clone)
  ✓ buildDurations: default state emits the plan §4.8 slice unchanged
  ✓ buildDurations: emitted slice shares no references with state
  ✓ buildDurations: throws on representationMode outside {shape, repeat}
  ✓ buildDurations: throws on non-array definitions
  ✓ buildDurations: throws on repeat counts that are not integers ≥ 1
  ✓ buildDurations: prunes stray repeatCounts keys at emit, retains them in state
  ✓ buildEngine: default state emits the plan §4.10 slice unchanged
  ✓ buildEngine: throws on empty or non-string lilypondVersion
  ✓ buildEngine: defaultMagnify accepts integer, decimal, and N/M fraction strings
  ✓ buildEngine: throws on malformed defaultMagnify (empty, non-numeric, zero denominator, number type)
  ✓ buildEngine: throws on non-finite multinotePadding / indent / collisionThreshold
  ✓ buildEngine: stemThickness accepts null (auto) and finite positives; rejects the rest
  ✓ buildEngine: falseHollow / useAccessibleColors coerce to booleans
  ✓ applyToConfig: replaces only durations and engine; other sections untouched
  ✓ applyToConfig: result passes CNBConfig.validate for the default config
  ✓ round-trip: default state survives applyToConfig → stateFromConfig
  ✓ round-trip: repeat mode with edited counts
  ✓ round-trip: fully edited engine including a set stemThickness
  ✓ round-trip: stemThickness null (engine auto) branch
  ✓ exporter: representationMode drives Section C's repeat field (LY spec §6.1)
  ✓ exporter: default engine state emits no engine settings in Section B (emit-if-changed)
  ✓ exporter: changed engine values reach Section B
  ✓ render: structure — definitions (read-only), mode, repeats, engine, validation
  ✓ render: mode toggle — click repeat → slice, selected class, repeats section active
  ✓ render: mode help text names the exporter's repeat field for both modes
  ✓ render: repeat count edit commits integers ≥ 1 and ignores invalid input
  ✓ render: engine checkbox edits propagate and flip the emit-if-changed badge
  ✓ render: defaultMagnify commits valid forms and ignores malformed input
  ✓ render: lilypondVersion commits non-empty strings and ignores empty input
  ✓ render: stem auto toggle — input only exists while auto is off; last value restored
  ✓ render: stem thickness input ignores values ≤ 0
  ✓ render: onChange slices and getState are clones — mutating them cannot corrupt state
  ✓ render: setState + applyTo produce a config that validates
  ✓ render: seeded from a non-default config
  ✓ renderPreview: shape mode — one collection row per duration, no legend
  ✓ renderPreview: repeat mode — single base row plus repeat legend with counts
  ✓ renderPreview: base duration is the first definition without a repeat count
  ✓ renderPreview: throws on empty definitions and on invalid representationMode

cnb-config-io-tests (34 tests)
  ✓ deriveFilename: default config name → default-4-8-system.cnb.json
  ✓ deriveFilename: punctuation/space runs collapse to one hyphen; case lowered; edges trimmed
  ✓ deriveFilename: throws on non-string, empty, whitespace, and no-alphanumeric names
  ✓ stampMeta: first save sets created AND modified (plan §4.11)
  ✓ stampMeta: later saves preserve created and update only modified
  ✓ stampMeta: does not mutate the input config
  ✓ stampMeta: empty-string created counts as unset; missing meta object is created
  ✓ stampMeta: throws on a timestamp that is not a parseable ISO string
  ✓ buildSaveFile: returns stamped config, pretty JSON of it, and derived filename
  ✓ buildSaveFile: does not mutate input; throws on non-object config and missing configName
  ✓ parseConfigFile: valid JSON object parses; root must be a plain object
  ✓ parseConfigFile: descriptive throws on non-string input and malformed JSON
  ✓ mergeLoaded: partial config gains defaults for everything it omits
  ✓ mergeLoaded: provided open-keyed maps REPLACE defaults (no resurrected entries)
  ✓ mergeLoaded: map sections the file omits stay at defaults
  ✓ mergeLoaded: a null/wrong-typed map section falls back to merge behavior (defaults kept)
  ✓ mergeLoaded: version notes — missing version and drifted version are advisories
  ✓ mergeLoaded: validation is returned but does not block the load
  ✓ mergeLoaded: throws on a non-object argument (caller bug)
  ✓ round-trip: default config save → load is deep-equal (stamped config)
  ✓ round-trip: custom-shape config is deep-equal (map replacement, no default bleed-through)
  ✓ round-trip: second save of a loaded config preserves created, updates modified
  ✓ loadFromText: malformed text throws (the render() load path catches this)
  ✓ render: throws without getConfig; builds save row, load row, status/error/validation areas
  ✓ render: filename preview shows the derived name, or the derive error for a bad name
  ✓ render save: button click delivers the file via download() and reports through onSave
  ✓ render save: underivable filename → error shown, no download, no onSave
  ✓ render save: download() failure is surfaced and onSave is not called
  ✓ render load: valid text → onLoad(config, {validation, notes}), status + validation shown
  ✓ render load: validation errors and warnings render in the validation area (load not blocked)
  ✓ render load: version-drift note renders in the validation area
  ✓ render load: malformed file → error shown, onLoad NOT called, app state untouched
  ✓ render load: filename preview reflects the LOADED config once the host adopts it
  ✓ render: a failed load keeps the previous successful load's validation display

cnb-config-export-tests (26 tests)
  ✓ deriveFilename: fileSuffix takes precedence — default config → default48.ly
  ✓ deriveFilename: fileSuffix slugged with the Module 17 rule (case, punctuation runs, edge trim)
  ✓ deriveFilename: falls back to configName when fileSuffix is empty, missing, non-string, or slugs empty
  ✓ deriveFilename: throws when meta is not an object or neither field derives a slug
  ✓ validateForExport: default config is exportable — valid, no errors, warnings present
  ✓ validateForExport: throws on a non-object config (caller bug)
  ✓ validateForExport: Module A blocking errors pass through (single staff line)
  ✓ validateForExport: exporter-side path-data check mirrors CNBLilypond.generate()'s throw
  ✓ validateForExport: a shape without path data that no rule uses does NOT block
  ✓ key-scoped rules: validateForExport and generate() agree (both resolve with key=null)
  ✓ validateForExport: an underivable filename is a blocking error
  ✓ validateForExport: missing meta section reports the filename block instead of crashing
  ✓ buildExport: success carries ok, filename, validation, and a complete .ly text
  ✓ buildExport: ly is EXACTLY CNBLilypond.generate(config) — default config (spec step 3)
  ✓ buildExport: ly parity holds on a customized config (3-6-9 pattern, repeat mode)
  ✓ buildExport: blocked on errors — ok false, ly and filename null, no throw
  ✓ buildExport: proceeds with warnings (default config warns but exports)
  ✓ buildExport: throws on a non-object config; does not mutate the input
  ✓ render: throws without getConfig; builds export row, status/error/validation areas
  ✓ render: filename preview shows the derived name, or the derive error for a bad meta
  ✓ render export: button click delivers the .ly via download() and reports through onExport
  ✓ render export: download() failure is surfaced and onExport is not called
  ✓ render export: exportLy() returns the built result on success
  ✓ render blocked: validation errors → no download, no onExport, reasons in .cnb-cex-verror
  ✓ render blocked: underivable filename blocks through the same validation path
  ✓ render blocked-then-fixed: host fixes the config and the next export succeeds

cnb-preview-display-tests (31 tests)
  ✓ pcOptionLabel: naturals, sharps, and the upper C prime (0→C, 1→C♯, 11→B, 12→C′)
  ✓ durationNames: definition order from the config (default → crotchet/minim/semibreve/breve)
  ✓ durationNames: falls back to ["crotchet"] when the config defines none (Modules 11/18 fallback)
  ✓ keyNames: [] when keys are disabled (default config) even if definitions exist
  ✓ keyNames: definition names when keys.enabled; [] when enabled without definitions
  ✓ buildPitchClasses: inclusive contiguous ranges (0–12 full row, 3–7 subrange, single PC)
  ✓ buildPitchClasses: throws on an inverted range
  ✓ buildPitchClasses: throws on non-integer and out-of-range endpoints
  ✓ defaultState: full chromatic row, first config duration, no key
  ✓ defaultState: fallback duration when the config defines none
  ✓ buildOptions: default state → full row, single crotchet row, keys null
  ✓ buildOptions: durations pruned against the CURRENT config vocabulary (retain in state, prune at build)
  ✓ buildOptions: durations come out in config vocabulary order regardless of selection order
  ✓ buildOptions: key passes through only when keys.enabled AND currently defined
  ✓ buildOptions: throws on malformed state (non-object, non-array durations, non-string key, inverted range)
  ✓ render: throws without the getConfig accessor (the host owns config state)
  ✓ render: root appended; controls hold two 13-option range selects and one pill per config duration; no key section when keys are disabled
  ✓ render: default preview drives the REAL Module 10 collection — 13 cards, one caption-less row
  ✓ render: onRender reports the exact collection options and the preview element
  ✓ render: toggling a second pill on renders two captioned duration rows; toggling it off returns to one
  ✓ render: deselecting every pill shows the explicit empty message, renders no collection, and reports onRender(options, null)
  ✓ render: narrowing the range re-renders with fewer cards
  ✓ render: endpoint-drag rule — moving one endpoint past the other drags the other along (both directions)
  ✓ render: key section appears when keys.enabled — (none) + definitions, deferral note, selection passes through options.keys
  ✓ render: keys enabled with EMPTY definitions — section stays visible with a disabled (none) select and an explicit empty-definitions note; options.keys null
  ✓ render: a selected key survives the config disabling keys (section hidden, keys null) and returns when re-enabled
  ✓ render: setState merges a partial, validates BEFORE adopting (invalid partial throws, state and DOM untouched)
  ✓ render: getState returns a copy — mutating it does not affect the display
  ✓ render: redraw() follows host config changes — a new duration definition appears as a pill
  ✓ render: redraw() follows host config changes — a staff pattern change re-renders the preview's background staff (line count matches CNBStaff.getPositions on the same config)
  ✓ render: collection injection seam — the recorder receives (container, config, options) and replaces Module 10

──────────────────────────────────────────────────
Results: 556 passed, 0 failed
All tests passed.
exit: 0
```

## 2. Unit tests — legacy regression suite (unmodified)

Working directory: `/d/Projects/chromatic-notation-configurator`

```
$ node legacy/run-tests.js
✓ Utilities: 12/12
✓ SVG Path Parsing: 5/5
✓ SVG to LilyPond Path Conversion: 6/6
✓ Anchor / Stem Attachment Math: 8/8
✓ Staff Derivation: 9/9
✓ Validation: 10/10
✓ Data Model: 15/15
✓ JSON Serialization: 4/4
✓ .ly Export — Section A: 11/11
✓ .ly Export — Section B: 9/9
✓ .ly Export — Section C: 14/14
✓ .ly Export — Full File: 5/5
✓ Color Presets: 3/3
✓ Baker Path Parser: 9/9
✓ Arc-to-Cubic Conversion: 6/6
✓ Normalize Commands: 10/10
✓ Apply Matrix: 6/6
✓ Path BBox: 4/4
✓ Translate & Stringify Path: 3/3
✓ Center Path: 3/3
✓ Bake Path (full pipeline): 5/5
✓ Shape Element Converters: 7/7
✓ Canonicalize ID: 10/10
✓ Bézier Extrema: 7/7
✓ Default Stem Anchors: 4/4
✓ Round-trip: parse → normalize → stringify → parse: 2/2
✓ computeStemAnchorsFromRects: 6/6
✓ buildShapeDef: 6/6
✓ End-to-end: SVG import → .ly export anchor conversion: 3/3
✓ parseRectAttrs: 2/2
✓ shapeNameFromFilename: 6/6
✓ Migration: type field backfill: 2/2
✓ Cumulative Rule Resolution: 8/8
✓ Group Resolved Configs: 3/3
✓ Color Name Pipeline: 4/4
✓ Palette Helpers: 6/6
✓ Migration Helpers: 7/7

240/240 passed ✓
exit: 0
```

## 3. Headless export from the fixed exporter (zero hand patches)

Working directory: `/d/Projects/chromatic-notation-configurator`

```
$ node cnb/fixtures/export-kite-4-369.mjs C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/kite-4-369-from-configurator.ly
wrote C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/kite-4-369-from-configurator.ly (7665 bytes)
exit: 0
```

## 4. The three fixed emissions, as generated (D1 flag, D2 positions, D5 staff-space anchors)

Working directory: `/d/Projects/chromatic-notation-configurator`

```
$ grep -n use-procedure-model\|staff-line-positions\|semitones-per-staff-space\|(cons 'crotchet-up\|(cons 'crotchet-down\|(cons 'minim-up\|(cons 'minim-down C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/kite-4-369-from-configurator.ly
65:     (cons 'crotchet-up   '(0 . 0.9))
66:     (cons 'crotchet-down '(0 . -0.9))
67:     (cons 'minim-up      '(-0.365 . 0.9))
68:     (cons 'minim-down    '(0.365 . -0.9))))
72:     (cons 'crotchet-up   '(0 . 0.9))
73:     (cons 'crotchet-down '(0 . -0.9))
74:     (cons 'minim-up      '(-0.365 . 0.9))
75:     (cons 'minim-down    '(0.365 . -0.9))))
103:#(set! cnb:use-procedure-model #t)
106:#(set! cnb:semitones-per-staff-space 3)
107:#(set! cnb:staff-line-positions '(-6 -4 -2 2 4 6))
exit: 0
```

## 5. Stage the round-trip score next to the export

Working directory: `/d/Projects/chromatic-notation-configurator`

```
$ cp -v cnb/fixtures/joy-to-the-world-configurator.ly C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/
'cnb/fixtures/joy-to-the-world-configurator.ly' -> 'C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/joy-to-the-world-configurator.ly'
exit: 0
```

## 6. Render the round-trip score (LilyPond 2.24.2, engine repo root)

Working directory: `/d/Projects/lilypond-chromatic-notation-base`

```
$ lilypond -dbackend=svg -I C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip -o C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/out C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/joy-to-the-world-configurator.ly
GNU LilyPond 2.24.2 (running Guile 2.2)
Changing working directory to: `C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip'
Processing `C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/joy-to-the-world-configurator.ly'
Parsing...
Interpreting music...[8][16]
Preprocessing graphical objects...
Finding the ideal number of pages...
Fitting music on 1 page...
Drawing systems...
warning: ignoring unsupported formats (pdf)
Success: compilation successfully completed
exit: 0
```

## 7. Render the golden baseline

Working directory: `/d/Projects/lilypond-chromatic-notation-base`

```
$ lilypond -dbackend=svg -o C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/golden joy-to-the-world.ly
GNU LilyPond 2.24.2 (running Guile 2.2)
Changing working directory to: `C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip'
Processing `joy-to-the-world.ly'
Parsing...
Interpreting music...[8][16]
Preprocessing graphical objects...
Finding the ideal number of pages...
Fitting music on 1 page...
Drawing systems...
warning: ignoring unsupported formats (pdf)
Success: compilation successfully completed
exit: 0
```

## 8. Golden assertion suite (101 assertions) against the GOLDEN render

Working directory: `/d/Projects/lilypond-chromatic-notation-base`

```
$ python tools/run_tests.py C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/spec-golden.json
╔══════════════════════════════════════════╗
║  CNB Integration Test Runner             ║
║  1 test spec(s) found                    ║
╚══════════════════════════════════════════╝

● Joy to the World, Kite 4-369 notation (D major, 2/4, 4 systems)
  Input: D:\Projects\lilypond-chromatic-notation-base\joy-to-the-world.ly
  SVG: C:\Users\denmi\AppData\Local\Temp\claude\d--Projects-chromatic-notation-configurator\66bf030f-2796-49c6-b9c5-3e89aec12a31\scratchpad\roundtrip\joy-to-the-world.svg
  Harvested: 195 elements, 19 measures
    ✓ Element counts: 57 noteheads, 17 beams, 7 flags, 11 dots
    ✓ Kite 4-369 staff has 6 lines
    ✓ System 0: measure 1 (D5 opening note)
    ✓ System 1: measure 8 (D5 descending run)
    ✓ System 2: measure 12 (F#4 repeated notes)
    ✓ System 3: measure 16 (D4 octave leap)
    ✓ m1 beat 1: D5 quarter note
    ✓ m1 beat 2: C#5 dotted eighth
    ✓ m1 beat 2+: B4 sixteenth
    ✓ m2 beat 1: A4 dotted quarter
    ✓ m2 beat 2: G4 eighth
    ✓ m3 beat 1: F#4 quarter
    ✓ m3 beat 2: E4 quarter
    ✓ m4 beat 1: D4 dotted quarter (lowest D)
    ✓ m4 beat 2: A4 eighth (upward fifth leap)
    ✓ m5: B4 dotted quarter, same pitch as beat 2
    ✓ m6: C#5 repeated, same pitch both beats
    ✓ m7: D5 at top of ascending sequence B4-C#5-D5
    ✓ m8 note 1: D5 eighth
    ✓ m8 note 2: C#5 eighth
    ✓ m8 note 3: B4 eighth
    ✓ m8 note 4: A4 eighth (lowest in run)
    ✓ m9 beat 1: A4 dotted eighth
    ✓ m9: G4 sixteenth (ornamental)
    ✓ m9: F#4 eighth
    ✓ m9: D5 eighth (octave leap up from F#4)
    ✓ m12 note 1: F#4 repeated (4 of same pitch)
    ✓ m12 last note: G4 sixteenth (turn figure, above F#)
    ✓ m14 note 1: E4 repeated (parallel to m12 F#4)
    ✓ m14 last note: F#4 sixteenth (turn figure)
    ✓ m16: D4 eighth (low D, start of octave leap)
    ✓ m16: D5 quarter (high D, octave above D4)
    ✓ m16: B4 eighth
    ✓ m17: F#4 eighth
    ✓ m18: F#4 quarter (penultimate bar, tonic approach)
    ✓ m18: E4 quarter (leading tone resolution to D)
    ✓ m19: D4 half note (final tonic)
    ✓ All pitch classes in D major: {1,2,4,6,7,9,11}
    ✓ m1 descending: D5 > C#5 > B4
    ✓ m2: A4 > G4 (descending)
    ✓ m3: F#4 > E4 (descending)
    ✓ m10 descending run: D5 > C#5 > B4 > A4
    ✓ 1-semitone step D5â†’C#5 â‰ˆ 0.0556 vertical
    ✓ 2-semitone step C#5â†’B4 â‰ˆ 0.111 vertical
    ✓ 2-semitone step B4â†’A4 â‰ˆ 0.111 vertical
    ✓ Octave leap D4â†’D5 â‰ˆ 0.667 vertical (12 Ã— 0.0556)
    ✓ D5 and D4 same pitch class â†’ same color
    ✓ All C#5 noteheads share the same color
    ✓ All A4 noteheads share the same color
    ✓ Three distinct color groups (Dâ‰ C#, Dâ‰ A, via pitch class mod 3)
    ✓ m1 horizontal order: beat 0.000 < 0.250 < 0.438
    ✓ m8 horizontal: 4 even eighths in order
    ✓ m12 horizontal: 5 notes in order (system 2)
    ✓ m16 horizontal: D4 < D5 < B4 (system 3)
    ✓ m1 beam: cis8. b16
    ✓ m8 beat-1 beam: d8 cis8
    ✓ m8 beat-2 beam: b8 a8
    ✓ m12 beat-1 beam: fis8 fis8
    ✓ m17 beat-1 beam: a8. g16
    ✓ m2: g8 gets flag (isolated eighth after dotted quarter)
    ✓ m4: a8 gets flag (isolated eighth after dotted quarter)
    ✓ m16: d8 gets flag (isolated eighth before quarter)
    ✓ m1: C#5 dotted eighth has dot element
    ✓ m2: A4 dotted quarter has dot element
    ✓ m7: D5 dotted quarter has dot element (system 1)
    ✓ m13: A4 dotted quarter has dot element (system 2)
    ✓ D5 on system 1 â‰ˆ same vertical as D5 on system 0
    ✓ F#4 on system 2 â‰ˆ same vertical as F#4 on system 0
    ✓ D4 on system 3 â‰ˆ same vertical as D4 on system 0
    ✓ m9 first note horizontal in [0, 0.5] of measure
    ✓ m13 last note horizontal in [0.5, 1.0] of measure
    ✓ m15 first note horizontal in [0, 0.5] (system 3)
    ✓ All D5 noteheads share the same path shape
    ✓ F#4 noteheads share the same path shape across systems
  Saved harvest: C:\Users\denmi\AppData\Local\Temp\claude\d--Projects-chromatic-notation-configurator\66bf030f-2796-49c6-b9c5-3e89aec12a31\scratchpad\roundtrip\joy-to-the-world.harvested.json

==================================================
  RESULTS: 74 passed, 0 failed (101 assertions)
  Time: 0.7s
==================================================
exit: 0
```

## 9. Golden assertion suite (101 assertions) against the ROUND-TRIP render

Working directory: `/d/Projects/lilypond-chromatic-notation-base`

```
$ python tools/run_tests.py C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/spec-roundtrip.json
╔══════════════════════════════════════════╗
║  CNB Integration Test Runner             ║
║  1 test spec(s) found                    ║
╚══════════════════════════════════════════╝

● Joy to the World, Kite 4-369 notation (D major, 2/4, 4 systems)
  Input: C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/joy-to-the-world-configurator.ly
  SVG: C:\Users\denmi\AppData\Local\Temp\claude\d--Projects-chromatic-notation-configurator\66bf030f-2796-49c6-b9c5-3e89aec12a31\scratchpad\roundtrip\joy-to-the-world-configurator.svg
  Harvested: 195 elements, 19 measures
    ✓ Element counts: 57 noteheads, 17 beams, 7 flags, 11 dots
    ✓ Kite 4-369 staff has 6 lines
    ✓ System 0: measure 1 (D5 opening note)
    ✓ System 1: measure 8 (D5 descending run)
    ✓ System 2: measure 12 (F#4 repeated notes)
    ✓ System 3: measure 16 (D4 octave leap)
    ✓ m1 beat 1: D5 quarter note
    ✓ m1 beat 2: C#5 dotted eighth
    ✓ m1 beat 2+: B4 sixteenth
    ✓ m2 beat 1: A4 dotted quarter
    ✓ m2 beat 2: G4 eighth
    ✓ m3 beat 1: F#4 quarter
    ✓ m3 beat 2: E4 quarter
    ✓ m4 beat 1: D4 dotted quarter (lowest D)
    ✓ m4 beat 2: A4 eighth (upward fifth leap)
    ✓ m5: B4 dotted quarter, same pitch as beat 2
    ✓ m6: C#5 repeated, same pitch both beats
    ✓ m7: D5 at top of ascending sequence B4-C#5-D5
    ✓ m8 note 1: D5 eighth
    ✓ m8 note 2: C#5 eighth
    ✓ m8 note 3: B4 eighth
    ✓ m8 note 4: A4 eighth (lowest in run)
    ✓ m9 beat 1: A4 dotted eighth
    ✓ m9: G4 sixteenth (ornamental)
    ✓ m9: F#4 eighth
    ✓ m9: D5 eighth (octave leap up from F#4)
    ✓ m12 note 1: F#4 repeated (4 of same pitch)
    ✓ m12 last note: G4 sixteenth (turn figure, above F#)
    ✓ m14 note 1: E4 repeated (parallel to m12 F#4)
    ✓ m14 last note: F#4 sixteenth (turn figure)
    ✓ m16: D4 eighth (low D, start of octave leap)
    ✓ m16: D5 quarter (high D, octave above D4)
    ✓ m16: B4 eighth
    ✓ m17: F#4 eighth
    ✓ m18: F#4 quarter (penultimate bar, tonic approach)
    ✓ m18: E4 quarter (leading tone resolution to D)
    ✓ m19: D4 half note (final tonic)
    ✓ All pitch classes in D major: {1,2,4,6,7,9,11}
    ✓ m1 descending: D5 > C#5 > B4
    ✓ m2: A4 > G4 (descending)
    ✓ m3: F#4 > E4 (descending)
    ✓ m10 descending run: D5 > C#5 > B4 > A4
    ✓ 1-semitone step D5â†’C#5 â‰ˆ 0.0556 vertical
    ✓ 2-semitone step C#5â†’B4 â‰ˆ 0.111 vertical
    ✓ 2-semitone step B4â†’A4 â‰ˆ 0.111 vertical
    ✓ Octave leap D4â†’D5 â‰ˆ 0.667 vertical (12 Ã— 0.0556)
    ✓ D5 and D4 same pitch class â†’ same color
    ✓ All C#5 noteheads share the same color
    ✓ All A4 noteheads share the same color
    ✓ Three distinct color groups (Dâ‰ C#, Dâ‰ A, via pitch class mod 3)
    ✓ m1 horizontal order: beat 0.000 < 0.250 < 0.438
    ✓ m8 horizontal: 4 even eighths in order
    ✓ m12 horizontal: 5 notes in order (system 2)
    ✓ m16 horizontal: D4 < D5 < B4 (system 3)
    ✓ m1 beam: cis8. b16
    ✓ m8 beat-1 beam: d8 cis8
    ✓ m8 beat-2 beam: b8 a8
    ✓ m12 beat-1 beam: fis8 fis8
    ✓ m17 beat-1 beam: a8. g16
    ✓ m2: g8 gets flag (isolated eighth after dotted quarter)
    ✓ m4: a8 gets flag (isolated eighth after dotted quarter)
    ✓ m16: d8 gets flag (isolated eighth before quarter)
    ✓ m1: C#5 dotted eighth has dot element
    ✓ m2: A4 dotted quarter has dot element
    ✓ m7: D5 dotted quarter has dot element (system 1)
    ✓ m13: A4 dotted quarter has dot element (system 2)
    ✓ D5 on system 1 â‰ˆ same vertical as D5 on system 0
    ✓ F#4 on system 2 â‰ˆ same vertical as F#4 on system 0
    ✓ D4 on system 3 â‰ˆ same vertical as D4 on system 0
    ✓ m9 first note horizontal in [0, 0.5] of measure
    ✓ m13 last note horizontal in [0.5, 1.0] of measure
    ✓ m15 first note horizontal in [0, 0.5] (system 3)
    ✓ All D5 noteheads share the same path shape
    ✓ F#4 noteheads share the same path shape across systems
  Saved harvest: C:\Users\denmi\AppData\Local\Temp\claude\d--Projects-chromatic-notation-configurator\66bf030f-2796-49c6-b9c5-3e89aec12a31\scratchpad\roundtrip\joy-to-the-world-configurator.harvested.json

==================================================
  RESULTS: 74 passed, 0 failed (101 assertions)
  Time: 0.7s
==================================================
exit: 0
```

## 10. Harvest both SVGs

Working directory: `/d/Projects/lilypond-chromatic-notation-base`

```
$ bash -c python tools/harvest_svg.py 'C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/golden.svg' -o 'C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/golden-harvest.json' --pretty && python tools/harvest_svg.py 'C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/out.svg' -o 'C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/roundtrip-harvest.json' --pretty
Wrote 195 elements to C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/golden-harvest.json
Wrote 195 elements to C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/roundtrip-harvest.json
exit: 0
```

## 11. Exhaustive structural diff — every element, both directions

Working directory: `C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip`

```
$ python exhaustive_diff.py golden-harvest.json roundtrip-harvest.json
golden elements: 191   roundtrip elements: 191
only in golden: 0 []
only in roundtrip: 0 []

per-type diff totals (differing / total):
  barline          0/19
  beam             0/17
  clef             0/4
  dots             0/11
  flag             0/7
  key-signature    0/4
  ledger-line      0/1
  notehead         21/57
  slur             0/12
  staff-symbol     0/1
  stem             0/57
  time-signature   0/1

differing elements: 21 of 191 common
  nh-1-0.438-71-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-10-0.250-71-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-11-0.188-67-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-12-0.438-67-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-13-0.375-67-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-14-0.000-64-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-14-0.125-64-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-14-0.250-64-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-14-0.375-64-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-15-0.000-67-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-15-0.438-64-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-16-0.375-71-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-17-0.188-67-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-17-0.375-67-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-18-0.250-64-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-2-0.375-67-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-3-0.250-64-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-5-0.000-71-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-5-0.375-71-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-8-0.250-71-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'
  nh-9-0.188-67-0 [notehead] visual.path_hash: golden='4021f079ab51' ours='b8a59fb7c758'

RESULT: 21 differing elements
exit: 0
```

## 12. Visual pixel diff at 4x raster scale

Working directory: `C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip`

```
$ node visual_diff.mjs golden.svg out.svg visual-diff.png
raster: 478x676 = 323128 pixels at 4x on white
differing pixels: 0 of 323128 (0.0000 %)
max RGB channel delta: 0
RESULT: PIXEL-IDENTICAL
exit: 0
```

## 13. Visual pixel diff at 16x raster scale

Working directory: `C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip`

```
$ node visual_diff.mjs golden.svg out.svg visual-diff-16x.png 16
raster: 1912x2704 = 5170048 pixels at 16x on white
differing pixels: 0 of 5170048 (0.0000 %)
max RGB channel delta: 0
RESULT: PIXEL-IDENTICAL
exit: 0
```

---

The browser drivers below need `playwright-core` resolvable via the
`CNB_UAT_PLAYWRIGHT` env var (set to a directory with `node_modules/
playwright-core` for these runs) and a cached ms-playwright Chromium.


## 14. UI golden path for this set — two-phase kite pipeline driver (authoring + fixture load, export byte-parity)

Working directory: `/d/Projects/chromatic-notation-configurator`

```
$ node cnb/uat/uat-kite-pipeline.mjs
PASS  AUTHOR/import: both kite shapes reach the shared config with pre-baked LilyPond paths (whitespace-normalized-identical to the fixture's) and semitoneHeight 4
PASS  AUTHOR/import: stem placemarker rects produce native crotchet anchors (0, -270)/(0, 270) — bottom-center of stem-up, top-center of stem-down
PASS  AUTHOR/import PIN(D6): imported minim anchors equal crotchet anchors (one-pair toolkit contract), while the fixture carries the reference's distinct minim x-offsets -1.095/1.095 semitones
PASS  AUTHOR/import (D5 fixed): imported lilypondAnchors agree with the fixture — crotchetUp y = 2.7 semitone units on both
PASS  AUTHOR/staff+mode: 3-6-9 (pattern [3,6,9], sps 3, midpoint 12) and repeat mode reach the shared config
PASS  AUTHOR/palette: custom CB-safe pool cycles per-PC exactly like the fixture — all 12 primary hexes match, and cbSafeColors is the identity mapping
PASS  AUTHOR/rules: 3 rules in the shared config with the Kite match sets (hollow [1,3,5,7,9,11]; kite-up [1,2,5,6,9,10])
PASS  AUTHOR/rules: CNBConfig.resolveNotehead on the authored config matches the fixture for all 12 PCs (shape + hollow)
PASS  AUTHOR: engine.falseHollow remains at its default (false) — no engine-settings editor exists in the as-built UI (set-005 verified CPE scope: durations + representation mode); the fixture supplies it for the release-gate artifact
PASS  AUTHOR/export: staff geometry identical to the fixture export — sps 3 and the engine-reference half-staff-space positions '(-6 -4 -2 2 4 6) (D2 fixed), plus cnb:use-procedure-model #t (D1 fixed) in both
PASS  AUTHOR/export: all four Section A path definitions are whitespace-normalized-identical to the fixture export's
PASS  AUTHOR/export: Section C mapping (shape, hollow, attachment, color hex) identical to the fixture export for all 12 PCs
PASS  AUTHOR/export: authored colors registered with the exact Kite hexes (symbol prefix from nearestColorName may differ from the fixture's stored names; the hex suffix and registered value are what the engine consumes)
PASS  AUTHOR/export PIN(D6, D5 fixed): authored attachments now emit the engine-reference staff-space units ('(0 . 0.9) at sps 3) but remain one-pair (minim x = 0, D6), while the fixture export carries the reference's distinct minim x-offsets ('(-0.365 . 0.9))
PASS  AUTHOR/export PIN(no engine/meta editors): authored export omits cnb:false-hollow (engine default #f) and keeps the default config's meta (no meta editor exists to change it); the fixture export sets the Kite values for all three
PASS  LOAD: config-io reports the fixture loaded and valid
PASS  LOAD: shared config adopted the Kite 4-369 system (pattern [3,6,9], sps 3, midpoint 12, repeat mode, falseHollow, both kite shapes, 3 rules)
PASS  LOAD: editors re-seeded — 3-6-9 staff pattern and repeat mode show selected, 3 rule cards
PASS  PREVIEW: full chromatic row (13 cards) with 8 staff lines (Node-side CNBStaff.getPositions on the same config)
PASS  PREVIEW: kite noteheads drawn with the baked palette — skyblue #50b4e9 and rose #cc79a7 fills present
PASS  EXPORT: download produced with a .ly suggested filename
PASS  EXPORT: status shows the export succeeded with the valid badge, no error rows
PASS  PARITY: downloaded .ly is byte-identical to CNBLilypond.generate() on the page's live config (Node-side)
PASS  PARITY: downloaded .ly is byte-identical to generate() on the fixture file itself (same artifact the headless driver renders through the engine)
PASS  EXPORT CONTENT: Kite system reached the .ly — procedure model on (D1), both kite paths, 3-6-9 geometry, false-hollow, repeat #t clauses, baked skyblue/rose colors
PASS  NO console or page errors across the pipeline

26/26 checks passed
UI-exported .ly + screenshots: C:\Users\denmi\AppData\Local\Temp\cnb-uat
exit: 0
```

## 15. UI download is byte-identical to the artifact rendered in steps 6–13

Working directory: `/d/Projects/chromatic-notation-configurator`

```
$ cmp C:/Users/denmi/AppData/Local/Temp/cnb-uat/kite-4-369-ui-export.ly C:/Users/denmi/AppData/Local/Temp/claude/d--Projects-chromatic-notation-configurator/66bf030f-2796-49c6-b9c5-3e89aec12a31/scratchpad/roundtrip/kite-4-369-from-configurator.ly
exit: 0
```

## 16. Remaining UAT drivers (staff-rule editor shows the corrected D2 geometry; all others regression-checked)

Working directory: `/d/Projects/chromatic-notation-configurator`

```
$ bash -c for d in uat-staff-rule-editor uat-golden-path uat-config-export uat-common-props-editor uat-config-io uat-notehead-rule-editor; do echo "=== node cnb/uat/$d.mjs ==="; node cnb/uat/$d.mjs; echo "driver exit: $?"; done
=== node cnb/uat/uat-staff-rule-editor.mjs ===
PASS  PAGE title contains "Staff/Ledger Rule Editor"
PASS  PATTERN LIST has 3 options, 4–8 selected
PASS  DERIVED PANEL sps 4, midpoint 12, LY positions (-4 -2 2 4)
PASS  PREVIEW staff lines: 4 (semis 4, 8, 16, 20)
PASS  PREVIEW note columns: 25 markers (chromatic 0–24)
PASS  PREVIEW column C (semi 0) shows 1 ledger
PASS  PREVIEW column D (semi 2) shows 2 ledgers (C + D)
PASS  PREVIEW column F (semi 5) shows 0 ledgers (inside staff)
PASS  PREVIEW column C'' (semi 24) shows 1 ledger (octave-aware upper C)
PASS  JSON PANEL staff.semitonePattern [4,8], sps 4
PASS  JSON PANEL ledgers: 3 templates, proximityRule true
PASS  VALIDATION shows Config valid
PASS  CLICK 3-6-9: derived sps 3, LY positions (-6 -4 -2 2 4 6)
PASS  CLICK 3-6-9: preview staff lines now 6
PASS  CLICK 3-6-9: JSON semitonePattern [3,6,9]
PASS  CLICK 3-6-9: override rows follow pattern (3 rows)
PASS  ENABLE OVERRIDE semi 3: seeded from defaults (thicknessPct 20)
PASS  SET OVERRIDE COLOR: JSON lineOverrides["3"].color = #cc0000
PASS  PREVIEW: semi-3 lines (abs 3 and 15) stroke #cc0000, others still black
PASS  BEFORE TEMPLATE: column F (semi 5) has 0 ledgers
PASS  ADD TEMPLATE: 4 template rows, new one at position 0 triggered by C
PASS  EDIT TEMPLATE: position 5 (F), triggerPCs [5]
PASS  PREVIEW: column F (semi 5) now shows 1 ledger
PASS  PREVIEW: column F' (semi 17) shows the same per-octave ledger
PASS  CLICK CUSTOM: PC toggles shown, seeded from 3-6-9
PASS  REMOVE LINES DOWN TO 1: validation error 'at least 2' shown, no valid banner
PASS  DEGENERATE PATTERN: derived panel shows the shortfall
PASS  RESTORE 2ND LINE: config valid again
PASS  NO console or page errors across the whole flow

29/29 checks passed
Screenshots: C:\Users\denmi\AppData\Local\Temp\cnb-uat
driver exit: 0
=== node cnb/uat/uat-golden-path.mjs ===
PASS  PAGE title is "Chromatic Notation Configurator"
PASS  ASSEMBLY: all eight module roots mounted (Modules 12–19 on one page)
PASS  PREVIEW: full chromatic row on load — 13 cards, one caption-less duration row, 4 duration pills (crotchet on), no key control (keys disabled)
PASS  STATE PANEL: full default config exposed (4-8 pattern, one shape, shape mode)
PASS  IMPORT: status confirms 'Imported shape "uat-ellipse"' with no warnings (pre-baked data-lilypond-* present)
PASS  IMPORT: shape entry reaches the shared config — semitoneHeight 2, pre-baked LilyPond paths, stem-rect anchors (bottom-center of stem-up rect)
PASS  IMPORT: the notehead rule editor re-seeded — its shape selects now offer the imported shape
PASS  PALETTE: Dark2 3-color preset reaches the shared config (12 per-PC colors, first #1b9e77, scheme symbols)
PASS  PALETTE: the preview re-rendered live — noteheads now carry the palette fill #1b9e77
PASS  STAFF RULES: 3-6-9 system reaches the shared config (pattern [3,6,9], sps 3)
PASS  STAFF RULES: preview background staff re-rendered — 8 lines (Node-side CNBStaff.getPositions on the same config)
PASS  NOTEHEAD RULE: added rule 3 (match all, apply shape uat-ellipse) reaches the shared config
PASS  NOTEHEAD RULE: the preview re-rendered live — noteheads now draw the imported ellipse path
PASS  COMMON PROPS: repeat representation mode reaches the shared config and shows selected
PASS  PREVIEW CONTROLS: narrowing the pitch range to 4–8 renders 5 cards
PASS  PREVIEW CONTROLS: toggling minim on renders two captioned duration rows (10 cards)
PASS  PREVIEW CONTROLS: deselecting every duration shows the explicit empty message, no collection
PASS  PREVIEW CONTROLS: restoring range 0–12 + crotchet renders the full chromatic row again
PASS  SAVE: download suggested filename is "default-4-8-system.cnb.json" (derived from meta.configName)
PASS  SAVE: timestamps stamped per plan §4.11 — meta.created and meta.modified are ISO strings in the file
PASS  SAVE: the shell ADOPTED the stamped config — the live state panel is deep-equal to the downloaded file
PASS  SAVE: everything configured this session is in the file (uat-ellipse shape, 12 palette colors, [3,6,9], repeat mode, 3 rules)
PASS  LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file
PASS  LOAD: loaded config reported valid in the IO panel
PASS  LOAD: every editor re-seeded from the loaded config (3-6-9 selected, Dark2-3 selected, repeat selected, 3 rule cards) and the preview still shows 13 cards
PASS  EXPORT: download suggested filename is "default48.ly" (from meta.fileSuffix)
PASS  EXPORT PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)
PASS  EXPORT: the whole session's configuration reached the .ly — imported shape registered, 3-6-9 geometry, repeat clauses, palette colors
PASS  EXPORT: status "Exported as default48.ly" with the valid badge, no error rows
PASS  NO console or page errors across the whole golden path

30/30 checks passed
Screenshots + saved/exported files: C:\Users\denmi\AppData\Local\Temp\cnb-uat
driver exit: 0
=== node cnb/uat/uat-config-export.mjs ===
PASS  PAGE title contains "Config Export"
PASS  EXPORT PANEL: button present, filename preview "default48.ly" (from meta.fileSuffix)
PASS  STATE PANEL: full default config exposed (4-8 pattern, shape mode, fileSuffix -Default48)
PASS  EDITORS (Modules 12 + 13 + 15) mounted on the shared config
PASS  EDIT: Dark2 3-color palette reaches the shared config (12 per-PC colors, scheme symbols)
PASS  EDIT: 3-6-9 staff system + repeat mode reach the shared config
PASS  EXPORT: download suggested filename is "default48.ly"
PASS  EXPORT: file is a complete .ly (version declaration, Sections A/B/C)
PASS  EXPORT: 3-6-9 staff geometry reached Section B (sps 3, positions from the editor)
PASS  EXPORT: repeat representation mode reached Section C ((repeat . #t) clauses)
PASS  EXPORT: the set-004 palette reached Section A (cnb:register-color! shamrock-1b9e77)
PASS  EXPORT: status line reads "Exported as default48.ly"; error area empty
PASS  EXPORT: validation area shows the valid badge + Module A warnings, no errors
PASS  PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)
PASS  BREAK: custom single-line pattern [9] reaches the shared config
PASS  BLOCKED: no download fired
PASS  BLOCKED: status reads "Export blocked — fix 1 error below" (with the blocked styling class); error area empty (a validation block is not an unexpected failure)
PASS  BLOCKED: the WHY is listed — staff pattern needs at least 2 positions (spec step 2)
PASS  BLOCKED: no valid badge; warnings still listed
PASS  FIXED: after restoring 3-6-9, export succeeds again and matches the first export
PASS  FIXED: validation area back to valid badge, no error rows
PASS  NO console or page errors across the whole flow

22/22 checks passed
Screenshots + exported files: C:\Users\denmi\AppData\Local\Temp\cnb-uat
driver exit: 0
=== node cnb/uat/uat-common-props-editor.mjs ===
PASS  PAGE title contains "Common Properties Editor"
PASS  DEFINITIONS list has 4 read-only rows in definition order
PASS  MODE "shape" selected; help text names (repeat . #f)
PASS  REPEATS section marked inactive in shape mode, but rows stay visible and editable
PASS  ENGINE block has 8 rows; false-hollow badge reads default-omitted; stem is engine auto with no number input
PASS  PREVIEW shows 4 captioned duration rows (Module 10, shape mode)
PASS  JSON PANEL: shape mode, default counts, default engine
PASS  SECTION B omits all emit-if-changed engine settings at defaults
PASS  REPEAT FIELD line shows "(repeat . #f)"
PASS  VALIDATION shows Config valid
PASS  TOGGLE REPEAT: option selected; help text names (repeat . #t)
PASS  TOGGLE REPEAT: preview collapses to the single base row, captions gone
PASS  TOGGLE REPEAT: legend lists minim ×2, semibreve ×4, breve ×8 of the crotchet notehead
PASS  TOGGLE REPEAT: JSON representationMode "repeat"; Section C repeat field flips to #t
PASS  TOGGLE REPEAT: repeats section no longer marked inactive
PASS  EDIT MINIM COUNT to 3: JSON and legend both follow
PASS  FALSE HOLLOW on: JSON true; badge flips; Section B emits #(set! cnb:false-hollow #t)
PASS  MAGNIFY "3/2": JSON follows; Section B emits #(set! cnb:default-magnify 3/2)
PASS  STEM AUTO off: number input appears seeded with 2; Section B emits cnb:stem-thickness 2
PASS  STEM 1.5: JSON and Section B follow
PASS  STEM AUTO back on: input removed from DOM; JSON null; Section B omits cnb:stem-thickness
PASS  BACK TO SHAPE: 4 preview rows restored, legend gone, repeat field #f, edited minim count kept
PASS  BACK TO SHAPE: validation still Config valid
PASS  NO console or page errors across the whole flow

24/24 checks passed
Screenshots: C:\Users\denmi\AppData\Local\Temp\cnb-uat
driver exit: 0
=== node cnb/uat/uat-config-io.mjs ===
PASS  PAGE title contains "Config Save/Load"
PASS  IO PANEL: save button, filename preview, and .json file input present
PASS  STATE PANEL: default config — timestamps null, shape mode, engine defaults
PASS  EDITOR (Module 15) mounted on the shared config
PASS  EDIT: repeat mode + minim count 3 + falseHollow true reach the shared config
PASS  SAVE 1: download suggested filename is "default-4-8-system.cnb.json"
PASS  SAVE 1: file carries the edited state (repeat mode, minim 3, falseHollow)
PASS  SAVE 1: meta.created and meta.modified stamped as ISO timestamps (first save)
PASS  SAVE 1: host adopted the stamped config (state panel shows created/modified)
PASS  SAVE 1: status line reads "Saved as default-4-8-system.cnb.json"
PASS  SAVE 2: meta.created preserved from the first save; meta.modified re-stamped later
PASS  RELOAD: app back at defaults (shape mode, no falseHollow, timestamps null)
PASS  LOAD: status names the file and the config ("Loaded … Default 4-8 System")
PASS  LOAD: validation area shows the loaded config valid (with Module A warnings)
PASS  LOAD: shared config restored (repeat mode, minim 3, falseHollow, timestamps)
PASS  LOAD: the set-005 EDITOR reflects the reloaded state (repeat selected, minim 3, falseHollow checked)
PASS  MALFORMED LOAD: error area names the JSON parse failure
PASS  MALFORMED LOAD: shared config and editor untouched (still the loaded state)
PASS  NO console or page errors across the whole flow

19/19 checks passed
Screenshots + saved files: C:\Users\denmi\AppData\Local\Temp\cnb-uat
driver exit: 0
=== node cnb/uat/uat-notehead-rule-editor.mjs ===
PASS  PAGE title contains "Notehead Rule Editor"
PASS  RULE LIST has 2 cards, numbered in application order
PASS  RULE NAMES are "Default" and "Sharps are hollow"
PASS  RESOLVED STRIP has 12 cells, duration select at crotchet
PASS  RESOLVED STRIP C solid, C♯ hollow (cumulative sharps rule)
PASS  RESOLVED STRIP explicit no-mark state is visibly rendered ("no mark")
PASS  PREVIEW ROW has 12 notehead cells (Module 6 rendering)
PASS  PREVIEW C is 1 path (solid), C♯ is 2 paths (hollow cutout)
PASS  PREVIEW palette colors: C #1b9e77, D #7570b3 (color:null → palette)
PASS  JSON PANEL 2 rules, priorities [0,1], second rule apply is hollow-only
PASS  VALIDATION shows Config valid
PASS  MOVE "Sharps are hollow" UP: JSON order swapped, priorities renumbered [0,1]
PASS  MOVE UP: C♯ resolves solid — Default's hollow:false now applies later and wins
PASS  MOVE UP: preview C♯ redrawn with 1 path (solid)
PASS  MOVE BACK DOWN: original order restored, C♯ hollow again
PASS  ADD RULE: 3 cards; new rule matches all/all/all with empty apply at priority 2
PASS  ADD RULE: resolution unchanged by the no-op rule (C♯ still hollow)
PASS  ENABLE SHAPE: seeded with the first shape (crotchet-minim)
PASS  SELECT DIAMOND: JSON apply.shape = "diamond"; strip shows Diamond for C
PASS  SELECT DIAMOND: preview C path is the diamond geometry
PASS  ENABLE COLOR: palette mode emits color null
PASS  CUSTOM COLOR #cc0000: JSON apply.color set; strip swatch and preview fill follow
PASS  NARROW DURATIONS: clicking crotchet while "all" leaves [minim, semibreve, breve]
PASS  NARROW DURATIONS: crotchet strip reverts to Crotchet–Minim + palette color
PASS  SWITCH STRIP TO MINIM: diamond + #cc0000 apply again (rule matches minim)
PASS  ENABLE OFF-KEY MARK: emits the explicit false (no mark); strip cell agrees
PASS  MARK MODE: seeds identifier "cross"; strip shows "mark: cross"; preview badges on all 12 PCs
PASS  EDIT MARK IDENTIFIER to "flat-9": JSON apply.offKeyMark follows
PASS  NARROW KEYS: clicking "C" while "All" leaves ["G"]
PASS  NARROW KEYS: with (no key) context the rule stops matching — minim strip reverts
PASS  SWITCH STRIP KEY TO G: diamond + #cc0000 + mark flat-9 apply again
PASS  REMOVE RULE: back to 2 rules; minim resolution reverts to the defaults
PASS  REMOVE RULE: validation still Config valid
PASS  NO console or page errors across the whole flow

34/34 checks passed
Screenshots: C:\Users\denmi\AppData\Local\Temp\cnb-uat
driver exit: 0
exit: 0
```

---

## Interpretation

| Check | Session 1 (as-generated) | Session 2 (fixes applied, zero hand patches) |
|---|---|---|
| Engine golden assertion suite (101 assertions) | compiles but config silently ignored | **74 passed / 0 failed** — identical to the golden baseline's own run (step 8 vs step 9) |
| Exhaustive structural diff (191 elements, 12 types, both directions) | 191/191 differ | **21/191 differ — all noteheads, all `visual.path_hash` only** (step 11) |
| Visual pixel diff | 7.68 % of pixels differ | **0 differing pixels** at 4× (323,128 px) and 16× (5,170,048 px), max RGB channel delta 0 (steps 12–13) |
| Hand patches needed | 2 lines (D1 + D2) | **none** |

**The 21 path-hash-only differences are the cataloged D3 cosmetic
non-defect** (s1-discrepancy-catalog.md): the golden config computes
kite-down shapes at render time via `(cnb:rotate-path … 180)`, which turns
x=0 into IEEE negative zero, printed as `-0.0000`; the Configurator ships
clean pre-baked coordinates. Raw path text for the same notehead in the two
step-6/7 SVGs of this session:

```
golden:    M-0.0000 0.6667L-0.6667 0.3333L0.0000 -0.6667L0.6667 0.3333L-0.0000 0.6667z
roundtrip: M0 0.6667L-0.6667 0.3333L0 -0.6667L0.6667 0.3333L0 0.6667z
```

Identical geometry — which is why the pixel diff is exactly 0 while the
text hash differs. The affected 21 elements are exactly the kite-down
pitch classes present in the D-major music (MIDI 64/67/71 → PCs 4, 7, 11).
Disposition per the catalog: not a defect; a `-0` normalization suggestion
for the engine's harvest tooling is handed off in
`s2-cross-repo-coordination.md`.

**UAT verdict: PASS.** The Configurator's `.ly` export (UI download ==
headless export, step 15) renders through the engine visually identical
(0 pixels) and structurally equivalent (74/74; element diff empty apart
from the documented D3 text artifact) to the golden baseline, with no
manual intervention at any step.

---

## Appendix: diff script sources

### exhaustive_diff.py

```python
#!/usr/bin/env python3
"""Exhaustive structural diff of two harvest_svg.py harvests (007-s2 UAT).

Compares EVERY harvested element in BOTH directions on: presence, type,
color, bbox (x/y/w/h, tol 1e-3), staff-relative vertical (tol 1e-3), and
visual.path_hash. Reports per-type totals and every differing element.
"""
import json, sys

TOL = 1e-3

def load(p):
    data = json.load(open(p))
    els = data["elements"] if isinstance(data, dict) and "elements" in data else data
    if isinstance(els, dict):
        return els
    return {e["id"]: e for e in els}

def get(el, path):
    cur = el
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur

def close(a, b):
    if a is None or b is None:
        return a == b
    try:
        return abs(float(a) - float(b)) <= TOL
    except (TypeError, ValueError):
        return a == b

golden = load(sys.argv[1])
ours = load(sys.argv[2])

NUM_PROPS = ["visual.bbox.x", "visual.bbox.y", "visual.bbox.w", "visual.bbox.h",
             "staff_relative.vertical"]
EXACT_PROPS = ["type", "visual.color", "visual.path_hash"]

only_golden = sorted(set(golden) - set(ours))
only_ours = sorted(set(ours) - set(golden))
common = sorted(set(golden) & set(ours))

per_type_total, per_type_diff = {}, {}
diffs = []
for eid in common:
    g, o = golden[eid], ours[eid]
    t = g.get("type", "?")
    per_type_total[t] = per_type_total.get(t, 0) + 1
    fields = []
    for p in EXACT_PROPS:
        if get(g, p) != get(o, p):
            fields.append((p, get(g, p), get(o, p)))
    for p in NUM_PROPS:
        if not close(get(g, p), get(o, p)):
            fields.append((p, get(g, p), get(o, p)))
    if fields:
        per_type_diff[t] = per_type_diff.get(t, 0) + 1
        diffs.append((eid, t, fields))

print(f"golden elements: {len(golden)}   roundtrip elements: {len(ours)}")
print(f"only in golden: {len(only_golden)} {only_golden}")
print(f"only in roundtrip: {len(only_ours)} {only_ours}")
print(f"\nper-type diff totals (differing / total):")
for t in sorted(per_type_total):
    print(f"  {t:16s} {per_type_diff.get(t, 0)}/{per_type_total[t]}")
print(f"\ndiffering elements: {len(diffs)} of {len(common)} common")
for eid, t, fields in diffs:
    for p, gv, ov in fields:
        print(f"  {eid} [{t}] {p}: golden={gv!r} ours={ov!r}")
print("\nRESULT: " + ("IDENTICAL (all compared properties)" if not diffs and not only_golden and not only_ours
      else f"{len(diffs)} differing elements"))
```

### visual_diff.mjs

```javascript
/**
 * visual_diff.mjs — pixel-level comparison of two LilyPond SVG renders
 * (007-s2 UAT, same method as session 1): raster both SVGs in Chromium at
 * 4x scale on a white background, compare pixel-by-pixel (max RGB channel
 * delta), write a red-overlay diff PNG when pixels differ.
 *
 * Usage: node visual_diff.mjs <a.svg> <b.svg> <diff-out.png>
 */
import { readFile, writeFile, readdir } from "fs/promises";
import path from "path";
import os from "os";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const [aPath, bPath, diffOut] = process.argv.slice(2);
const SCALE = Number(process.argv[5]) || 4;

// Discover Chromium from the ms-playwright cache (env override authoritative).
async function chromiumExe() {
  if (process.env.CNB_CHROMIUM && process.env.CNB_CHROMIUM.length > 0) return process.env.CNB_CHROMIUM;
  const cache = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  const dirs = (await readdir(cache)).filter(d => /^chromium-\d+$/.test(d)).sort(
    (x, y) => Number(x.split("-")[1]) - Number(y.split("-")[1]));
  if (dirs.length === 0) { console.error("no cached chromium"); process.exit(2); }
  return path.join(cache, dirs[dirs.length - 1], "chrome-win64", "chrome.exe");
}

const browser = await chromium.launch({ executablePath: await chromiumExe() });
const page = await browser.newPage();
await page.setContent("<!doctype html><body></body>");

const svgA = await readFile(aPath, "utf8");
const svgB = await readFile(bPath, "utf8");

const result = await page.evaluate(async ({ svgA, svgB, scale }) => {
  async function raster(svg) {
    const vb = svg.match(/viewBox="([\d. -]+)"/)[1].split(/\s+/).map(Number);
    const w = Math.round(vb[2] * scale), h = Math.round(vb[3] * scale);
    const img = new Image();
    img.src = "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svg)));
    await img.decode();
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { ctx, w, h, canvas: c };
  }
  const A = await raster(svgA);
  const B = await raster(svgB);
  if (A.w !== B.w || A.h !== B.h) return { error: `size mismatch ${A.w}x${A.h} vs ${B.w}x${B.h}` };

  const da = A.ctx.getImageData(0, 0, A.w, A.h);
  const db = B.ctx.getImageData(0, 0, B.w, B.h);
  const total = A.w * A.h;
  let differing = 0, maxDelta = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const d = Math.max(
      Math.abs(da.data[o] - db.data[o]),
      Math.abs(da.data[o + 1] - db.data[o + 1]),
      Math.abs(da.data[o + 2] - db.data[o + 2]));
    if (d > 0) {
      differing++;
      da.data[o] = 255; da.data[o + 1] = 0; da.data[o + 2] = 0; da.data[o + 3] = 255;
    }
    if (d > maxDelta) maxDelta = d;
  }
  let png = null;
  if (differing > 0) {
    A.ctx.putImageData(da, 0, 0);
    png = A.canvas.toDataURL("image/png").split(",")[1];
  }
  return { w: A.w, h: A.h, total, differing, maxDelta, png };
}, { svgA, svgB, scale: SCALE });

await browser.close();

if (result.error) { console.error(result.error); process.exit(1); }
if (result.png && diffOut) await writeFile(diffOut, Buffer.from(result.png, "base64"));

console.log(`raster: ${result.w}x${result.h} = ${result.total} pixels at ${SCALE}x on white`);
console.log(`differing pixels: ${result.differing} of ${result.total} (${(100 * result.differing / result.total).toFixed(4)} %)`);
console.log(`max RGB channel delta: ${result.maxDelta}`);
console.log("RESULT: " + (result.differing === 0 ? "PIXEL-IDENTICAL" : "DIFFERS (red overlay written)"));
```
