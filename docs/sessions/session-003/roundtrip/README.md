# Pitch-axis engine round-trip — session 3 (set 014, P4)

**Result: PARITY PASS** (`transcript.txt`, 2026-10-31). The CNB engine
renders the Twinline compact fixture where the Configurator preview puts it.

## What runs

```
node docs/sessions/session-003/roundtrip/roundtrip.mjs <engine-repo-dir>
```

1. **Export.** `cnb/assets/examples/gallery/twinline-compact.json` is loaded
   through `CNBConfigIO.loadFromText` (the UI's load path) and exported with
   `CNBLilypond.generate()` → `twinline-compact-config.ly`, identical (after
   the date line) to the pinned `cnb/fixtures/twinline-compact-export-baseline.ly`.
   A **control** export of the same fixture with every `xOffsetStaffSpaces`
   removed → `twinline-compact-control-config.ly`.
2. **Engrave.** `lilypond -dbackend=svg` (LilyPond 2.24.2) runs from the
   engine repo root (`lilypond-chromatic-notation-base`, after its set
   `008-pitch-axis-hook`) on `twinline-roundtrip-score.ly` and
   `twinline-roundtrip-control-score.ly`: every chromatic pitch c′…c‴ as a
   single note, the five shared-position pairs plus `<c'' cis''>` as chords,
   under `\key g \major`, on one system.
3. **Harvest.** The engine's `tools/harvest_svg.py` → `*.harvested.json`.
4. **Measure.** `measure.mjs` checks the engine render against the
   preview's own model (CNBPitchAxis, CNBKeySignature, the exported staff),
   so no expectation is hand-typed. It is also this step's check, and
   re-runs on the committed evidence without LilyPond:
   `node docs/sessions/session-003/roundtrip/measure.mjs docs/sessions/session-003/roundtrip/twinline-roundtrip.harvested.json`.

## What was measured

| Check | Result |
|---|---|
| Staff lines | 6 harvested = the exported, deduplicated `'(-3 -1 1 4 6 8)` (pattern `[2,5,6,8,9]` collapses to axis 1, 3, 5) |
| Notehead placement | 37/37 at `2 × (pos(semi) − pos(midpoint)) / 2`, all +0.010 — the known line-edge harvest artifact |
| Shared pairs | 6/6 coincide vertically (dpos 0.000) |
| x-offset | 6/6 pairs: separation +1.340 vs control +0.490 → effect **+0.850** = the rule's 0.85 staff space |
| Stems | 30 harvested; every single-note stem flips at the midpoint (G, position 0) — the preview's rule |
| Key signature | 8/8 G-major marks at positions 0…7 = the preview's `signatureSemis` 7…19 (+0.009 artifact) |
| Ledgers | 1 ledger grob, reported only (below) |

## Reconciliation with the engine handoff

Against `lilypond-chromatic-notation-base/docs/session-sets/008-pitch-axis-hook/configurator-handoff.md`
(spec changes recorded as CNB-LY-EXPORT-SPEC 1.3.1):

- **§4.1 — `cnb:semitones-per-staff-space` under an axis:** emitted as
  `axisUnitsPerStaffSpace` (2 here), so the engine's remaining ÷sps length
  conversions read grid units. Spec §5.4a.
- **§4.2 — explicit `cnb:keysig-tonic-octave` under an axis:** always
  emitted when the axis is enabled. The handoff expected the set-006 −1
  octave offset to carry over; it does not. The compiled hook reads the
  engine semitone directly as a Configurator semitone (middle C = 0 on both
  sides), so Configurator octave numbering is the engine's. The emitted `0`
  placed the marks on semitones 7…19, exactly the preview. Spec §5.4c/§5.4d.
- **§3 — the x-offset mechanism:** confirmed as landed (column + residual
  translation). A shared pair is already separated by LilyPond's own
  arrangement (+0.490 here, with this fixture's 1.27-staff-space-wide
  heads), so the offset's effect is measured against the control render —
  the engine set-008 s2 test-vs-control method. Spec §6.3.
- **§2, §5.5 — fractional clef anchor on an axis:** not applicable. The
  exporter emits nothing for clefs (set 009), so there is no compiled clef
  registration to cross-check.
- **§5.1 — collision analysis quantizes to integer positions:** recorded
  only. The fixture's positions are integers; no validation warning was
  added (a session non-goal).
- **§5.2, §5.3 — dot-wipe at axis distance 0, barline-elastic spacing:** not
  exercised. The score has no dotted cross-voice pairs, and nothing is
  asserted across a barline.

## Documented divergences (not asserted)

- **Ledger lines.** The exporter emits no ledger rules; the engine draws its
  own. Their parity with the preview's template-driven ledgers is the
  documented in-gap ledger limit (pitch-axis design §2.4), so ledgers are
  reported, not checked.
- **Key-signature octave, auto placement only.** One engine octave serves
  every key; the preview's auto rule centers each tonic on the midpoint.
  For this fixture, tonics G♯…B differ by an octave unless
  `keySignature.placement.tonicOctave` is set (spec §5.4d). The measured key,
  G, is not affected.

## Fixture note

The fixture's `crotchet-minim` is the default geometry at `semitoneHeight` 2
(one staff space at 2 axis units per space) with engine-scale `lilypondPath`,
`lilypondHollowPath` and `lilypondAnchors` derived from its SVG data
(× semitoneHeight / naturalHeight / axisUnitsPerStaffSpace, Y inverted — the
Kite fixture's convention). Without them the exporter's `svgPathToLilypond`
fallback copies the default shape's raw SVG coordinates (±163 units), and
the engine engraves noteheads hundreds of staff spaces wide. That
limitation predates the pitch axis and affects every fixture without
LilyPond path data; it is recorded here, not changed.
