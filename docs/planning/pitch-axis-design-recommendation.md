# Pitch Axis Design Recommendation

Date: 2026-07-10

## Recommendation

Build this as a two-repo feature with an explicit pitch-class axis map. Do not ship it as preview-only. The feature's value is exactly "preview equals engraving," and a compact staff whose exported `.ly` engraves linearly is worse than no feature.

The core schema should be an explicit map, with presets only as UI sugar:

```js
pitchAxis: {
  enabled: true,
  kind: "pitch-class-map-v1",
  octaveStride: 7,
  axisUnitsPerStaffSpace: 1,
  pitchClasses: [
    { pc: 0, position: 0 },
    { pc: 1, position: 0 },
    { pc: 2, position: 1 },
    { pc: 3, position: 2 },
    { pc: 4, position: 2 },
    { pc: 5, position: 3 },
    { pc: 6, position: 3 },
    { pc: 7, position: 4 },
    { pc: 8, position: 5 },
    { pc: 9, position: 5 },
    { pc: 10, position: 6 },
    { pc: 11, position: 6 }
  ]
}
```

Unset means the current linear behavior, exactly: `position(pc) = pc`, `octaveStride = 12`, `axisUnitsPerStaffSpace = staff.semitonesPerStaffSpace`. Do not write this default into saved configs, and do not route default configs through new export branches. Keep the old path in `cnb/src/cnb-grid.js` and `cnb/src/cnb-lilypond.js` untouched when `pitchAxis?.enabled` is false.

I would reject a parameterized "compact/diatonic mode" in the core. It will become a taxonomy argument. Ship presets like "Twinline-ish 7-position" in the UI that compile into this explicit map.

## Grid

Add a small `CNBPitchAxis` helper, then let `CNBGrid.create()` build an axis context:

```js
axis.positionOfSemi(semi)
// octave * octaveStride + pitchClasses[pc].position

axis.regionOfSemi(semi)
// floor(positionOfSemi(semi) / octaveStride)

axis.distance(aSemi, bSemi)
// abs(positionOfSemi(aSemi) - positionOfSemi(bSemi))
```

Keep passing semitones as pitch identity. Introduce axis position only for vertical geometry. `semiToY(semi)` survives as a wrapper:

```js
semiToY(semi) = (maxAxis - axis.positionOfSemi(semi)) * pxPerAxisUnit
```

For default-off compatibility, the disabled branch should literally keep the old formula, not merely produce equivalent numbers.

`yToSemi` cannot remain a scalar inverse. In mapped mode expose `yToAxis(y)` and `semisAtAxis(axisPosition)` or `nearestSemisForY(y)`. If UI hit-testing needs one answer, the caller must choose from candidates. Returning a fake semitone would hide the central many-to-one fact.

## Disambiguation

Extend the existing cumulative notehead rules, because they already resolve by pitch class, duration, and key. Add one optional resolved field:

```js
{
  name: "shared-position offsets",
  priority: 10,
  match: { pitchClasses: [1, 3, 6, 8, 10], durations: "all", keys: "all" },
  apply: { xOffsetStaffSpaces: -0.28 }
}
```

Negative means left, positive means right, zero or missing means centered. Store this in staff-space units, not notehead-width percent, because LilyPond can consume staff-space offsets directly and shape changes should not silently change the notation system.

Preview changes:

- `CNBCard.resolveNotehead()` includes `xOffsetStaffSpaces`.
- `CNBDoubleNotehead.layout()` accepts per-note X offsets instead of only the current symmetric octave-pair `offsetPercent`.
- Stem geometry must receive the shifted notehead center. Today the card hardcodes `offsetPercent: 0`, and stem geometry assumes one `centerX`. Offset the notehead and its stem attachment together.

Export changes:

- Section C gets an optional `(x-offset . N)` field only when nonzero or when pitch-axis mode is enabled.
- Missing field means current engine behavior. This preserves current byte output from `cnb/src/cnb-lilypond.js`.

## Ledgers

Re-express ledger logic in axis coordinates, while preserving semitone identity for triggers.

Current predicates in `cnb/src/cnb-ledger-set.js` become:

```js
notePos = axis.positionOfSemi(noteSemi)
ledgerPos = axis.positionOfSemi(ledgerSemi)
staffPositions = unique staff axis positions

same region:
  axis.regionOfSemi(noteSemi) === axis.regionOfSemi(ledgerSemi)

between:
  if notePos === ledgerPos:
    show only if no staff line at ledgerPos
  if notePos < ledgerPos:
    some staff position > ledgerPos
  if notePos > ledgerPos:
    some staff position < ledgerPos

proximity:
  abs(notePos - ledgerPos) < min(abs(notePos - staffPos))
```

Keep the strict `<` tie rule. It is important for compact systems because shared positions and staff-line coincidences must not invent extra ledgers.

Rendering should key ledger output by axis position, not semitone, so two ledger templates mapping to the same vertical place draw one line. Validation should reject conflicting style overrides for templates that collapse onto the same rendered ledger axis position.

Stem direction should also switch from semitone average to axis-position average compared against `axis.positionOfSemi(staff.midpoint)`.

## Engine Decision

Pursue the engine change first. Specifically, add an engine hook that accepts a procedure returning LilyPond staff-position units for a semitone:

```scheme
#(set! cnb:get-pitch-staff-position
   (lambda (semitone)
     ...)) ; returns half-staff-spaces, same unit as cnb:staff-line-positions
```

Then export the JSON axis map as that procedure. Staff lines should use the same formula:

```js
2 * (axisPosition - midpointAxis) / axisUnitsPerStaffSpace
```

The existing `cnb:semitones-per-staff-space` and `cnb:staff-line-positions` export in `cnb/src/cnb-lilypond.js` is not enough. It can describe staff lines, but not pitch placement. For compact systems, the engine must use the pitch-axis hook for noteheads, stems, collisions, and any engine-side ledger decisions.

Until that engine capability exists, the Configurator should allow internal fixtures or hidden experimental previews, but production export should fail loudly for `pitchAxis.enabled`. Do not silently emit a linear `.ly`.

## Sequencing

1. Engine spike first: hand-author one compact axis and prove LilyPond can place noteheads, stems, collisions, and ledgers from `cnb:get-pitch-staff-position`.
2. Add export spec v1.3 for pitch-axis and `x-offset`; keep old exports byte-identical.
3. Add `CNBPitchAxis` plus grid tests: linear disabled output unchanged, nonuniform 1:1 works, many-to-one returns inverse candidates.
4. Rewrite staff, ledger, notehead, and stem consumers to use axis positions for geometry while preserving semitone identities.
5. Add compact fixtures and round-trip export tests gated on engine capability.
6. Build UI presets last. Presets generate explicit maps and notehead-rule offsets.

## Highest Risks

- LilyPond engine placement may not be cleanly overridable for all relevant engravers.
- Shape sizing and attachment units need a clear "axis units per staff-space" contract.
- Many-to-one offsets for real multi-note chords may expose layout complexity beyond the current octave-pair preview.
- Ledger parity is risky because preview ledger rules are richer than the currently visible export surface.

Stop and reconsider if the engine cannot consume an arbitrary semitone-to-staff-position procedure without a large engraver rewrite, or if the only viable product path becomes "preview compact, export linear." That would violate the central promise of this tool.