# CNB LilyPond Export Format Specification — v1.3 (Pitch Axis)

**Version:** 1.3.12 (Pitch axis / I2 relaxation; engine-handoff reconciliation; path units; preview-only settings; sized shape variants; the staff's range follows its middle; engine behaviours under an axis; the clef and the key signature; stem attachment units; ledger lines and key-scoped rules; colours on the noteheads; stems where the notehead's SVG puts them; the breve as tied semibreves)
**Date:** November 10, 2026 (1.3.12); November 9, 2026 (1.3.11); November 8, 2026 (1.3.10); November 7, 2026 (1.3.5, 1.3.6, 1.3.7, 1.3.8, 1.3.9); November 6, 2026 (1.3.4); November 3, 2026 (1.3.2, 1.3.3); October 31, 2026 (1.3.1); July 12, 2026 (1.3 adopted; drafted July 10, 2026)
**Status:** **CANONICAL.** Drafted by
`docs/session-sets/013-pitch-axis-engine-discovery/` session 2 as
`docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md`; adopted (renamed into
`docs/`) by session 1 of `docs/session-sets/014-pitch-axis-implementation/`
under set 013's session-1 GO and the operator's implementation
authorization (013 s2 UAT). The v1.2.1 spec
[`CNB-LY-EXPORT-SPEC-v1_2.md`](CNB-LY-EXPORT-SPEC-v1_2.md) stays in place
for history and remains the base this delta amends.
**The §8a fail-loud gate is LIFTED (1.3.1):** the engine repo's set
`008-pitch-axis-hook` closed on 2026-07-13, and its
`docs/session-sets/008-pitch-axis-hook/configurator-handoff.md` records
E13-1 and E13-2 as shipped with the golden baseline byte-identical. Set 014
session 3 removed the gate in the same change that first emitted §5.4/§6.3,
with an engine round-trip as evidence
([`sessions/session-003/roundtrip/`](sessions/session-003/roundtrip/)).
1.3.1 also reconciles the spec with what the engine actually landed (§5.4a,
§5.4d, §6.3).
**Delta spec:** this document specifies **only the v1.3 additions and
substitutions**. Everything in v1.2.1 not mentioned here is unchanged.
**Companion design:** [`planning/pitch-axis-design.md`](planning/pitch-axis-design.md)
(schema, unit contract, consumer changes, program plan).
**Engine dependency:** engine-repo work items **E13-1** (the
`cnb:get-pitch-staff-position` hook) and **E13-2** (the `x-offset` notehead
field), per
[`session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md`](session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md)
§6. **Until both ship, the exporter must refuse to export a pitch-axis
config (§8a) — no silent linear `.ly` for a compact system.**

---

## 1. PURPOSE AND CHANGES FROM v1.2.1

v1.3 adds the export surface for the optional `pitchAxis` config section
(an explicit, versioned pitch-class → axis-position map; design §1) and the
notehead-rule `xOffsetStaffSpaces` disambiguation field (design §3).

**The governing compatibility rule:** when `pitchAxis` is absent or
`enabled: false`, the generated `.ly` is **byte-identical to v1.2.1
output** — no new lines, no reordered lines, no changed values. Every v1.3
emission below is gated on `pitchAxis.enabled`, and the disabled code path
in `cnb/src/cnb-lilypond.js` is the literal v1.2.1 code, not an equivalent
re-derivation (design §1.3). The Kite 4-369 round-trip and export-baseline
pins enforce this. *(1.3.2 exception: path data, for linear and axis configs
alike — §4.1b. 1.3.4 addition, also for both: sized shape variants for
rules that set `heightSemis` / `widthSemis`, §4.1c. A config that sets no
size is unaffected. 1.3.5, for both: the staff's range follows its middle,
§5.1a. A config whose `staff.midpoint` is 12 is unaffected. 1.3.7, for
both: the clef and the key signature, §5.5 and §5.6. Every config's export
gains at least `cnb:clef-style`, and every config whose signature is off
gains `cnb:keysig-style 'none`. 1.3.8, for both: stem attachments in
LilyPond's relative units, §4.4b. Every config with stems exports new
attachment values. 1.3.9, for both: the ledger lines, §5.7, which every
config's export gains, and the key dispatch, §6.4, which only a config with
keys on and a key-scoped rule gains. 1.3.10, for both: colours on the
noteheads, §4.5a. Every config's header loses its palette lines, and a
config with colours registers them without the accessible branch. 1.3.11,
for both: an anchor is the stem's centre, §4.4c. Every config with stems
exports new attachment values. 1.3.12, for both: the breve as tied
semibreves, §4.1d. The export text is unchanged; engine 1.3.0 engraves a
repeat-mode breve differently.)*

Summary of additions:

| Area | v1.2.1 | v1.3 (only when `pitchAxis.enabled`) |
|---|---|---|
| Section B staff geometry | linear `cnb:staff-line-positions` formula | axis formula (§5.4a) + the compiled pitch-axis procedure (§5.4b) |
| Section A4 attachments | ÷ `staff.semitonesPerStaffSpace` | ÷ `pitchAxis.axisUnitsPerStaffSpace` (§4.4a); since 1.3.8 relative to the notehead's extent, linear and axis alike (§4.4b); since 1.3.11 half a stem outward of the anchor, the stem's centre (§4.4c) |
| Section B staff-line thickness | `(pct/100) × (1/sps)` | `(pct/100) × (1/axisUnitsPerStaffSpace)` (§5.3a) |
| Section C alist | — | optional `(x-offset . N)` field (§6.3) |
| Clef and key signature (1.3.7, linear and axis alike) | nothing written | `cnb:clef-*`, A6 `cnb:register-clef!`, `cnb:keysig-*` (§5.5, §5.6) |
| Ledger lines and key-scoped rules (1.3.9, linear and axis alike) | the engine's own ledgers; Section C resolved with no key | `cnb:ledgers-by-semitone` and NoteHead overrides (§5.7); Section C dispatch on the key (§6.4) |
| Section A5 colours (1.3.10, linear and axis alike) | palette colours, with a `cnb:use-accessible-colors` branch | each colour the noteheads use, once, named from its hex; no branch (§4.5a) |
| The breve in repeat mode (1.3.12, linear and axis alike) | 4 heads, as a semibreve | two semibreve groups, tied, as engine 1.3.0 engraves it; export text unchanged (§4.1d) |
| Validation | v1.2.1 §8 | pitch-axis checks + the fail-loud gate (§8a) |

---

## 4. SECTION A — ADDITIONS

### 4.1b Path data units (new in 1.3.2 — linear and axis configs alike)

Amends v1.2.1 §4.1, which said a pre-baked `data-lilypond-notehead` path is
"emitted verbatim" (audit 2026-11-02, H2 and H3). The engine draws
registered paths in **staff-space units** and does no division of its own
(`cnb/stencils.ly`). The exporter therefore converts every path, from
either source, through one conversion:

- **Pre-baked paths** (`lilypondPath` / `lilypondHollowPath`, read from the
  toolkit's `data-lilypond-*` attributes): the toolkit writes them in
  **semitone units, Y up**: SVG coordinates ÷ 100 (its 100 units per
  semitone), Y negated. The exporter parses them, divides every coordinate
  by `staff.semitonesPerStaffSpace` (`pitchAxis.axisUnitsPerStaffSpace`
  under an axis, the same divisor as the §4.4 / §4.4a attachments), and
  re-emits them from their numbers.
- **Fallback** (`svgPathToLilypond`, for a shape without pre-baked data): the
  SVG `d` path, in the shape's native units with Y down, is converted with
  the toolkit's normalisation. Every coordinate is divided by the shape's
  SVG units per semitone (`naturalHeight / semitoneHeight`, which is 100 for
  toolkit output), Y is negated, and then the same division as above is
  applied. The shape's coordinate origin is its centre, as in the toolkit's
  output, the preview and the stored stem anchors.

```
staff-space coordinate = semitone coordinate / sps            (pre-baked)
staff-space coordinate = (x, −y) / (naturalHeight / semitoneHeight) / sps   (fallback)
```

Worked check: the Kite (up) notehead, 4 semitones tall at sps 3. The toolkit
writes `(moveto 0 2)`, and the export emits `(moveto 0 0.6667)`, the size
the engine's golden Kite score draws.

Before 1.3.2 the pre-baked path was emitted sps× too large and the fallback
emitted raw SVG coordinates (about 100 × sps too large, and mirrored), so
**1.0.0 exports of shapes with toolkit or fallback paths were mis-scaled and
should be regenerated.** Configs whose stored pre-baked paths had been
hand-divided by sps to compensate (the old Kite and Twinline fixtures) must
store semitone-unit paths instead.

### 4.1c Sized shape variants (new in 1.3.4 — linear and axis configs alike)

A notehead rule's `apply` block may set `heightSemis` and `widthSemis`,
the notehead's absolute size in semitones (architecture plan §4.5). The
engine has no size field. It builds each stencil from the registered path's
numbers, so the exporter carries a size by registering a scaled copy of the
shape.

**When a variant is registered.** The exporter resolves every pitch class
× duration. A size that no matching rule sets takes the shape's own value:
`semitoneHeight` for the height, and the natural width
`naturalWidth × semitoneHeight / naturalHeight` for the width. Each
distinct resolved (shape, height, width) that differs from the shape's own
size gets one variant. Section A registers the shape itself only when some
notehead uses it at its own size.

**Naming.** `<shape>-h<height>-w<width>`. The sizes are in semitones,
formatted with the exporter's standard number formatting (integers bare,
otherwise up to 4 decimals), with the decimal point written `p`. Examples:
`crotchet-minim-h1p5-w3`, and `crotchet-minim-h2p724-w4` for a width-only
rule, where the height is the shape's own 2.724. The cutout and attachment
follow the usual pattern: `<variant>-cutout`, `<variant>-attach`.

**Scaling.** With

```
scale.x = width  / natural width
scale.y = height / semitoneHeight
```

the variant's path and its hollow cutout are the shape's, with every x
multiplied by `scale.x` and every y by `scale.y`. Everything else stays the
same: the §4.1b path conversion (pre-baked or fallback, ÷
`semitonesPerStaffSpace` or ÷ `axisUnitsPerStaffSpace`). *(1.3.8: the
variant's four attachment points are the shape's own. They are written
relative to the registered path's extent (§4.4b), and the scale moves the
anchor and the extent alike, so it cancels. In 1.3.4–1.3.7 they were scaled
with the path. 1.3.11: the half stem added to each point's x does not scale,
so a variant's points are computed at its scale, §4.4c.)* In Section A a comment line names each variant's size, and
its definitions follow the shape's in A1–A4.

**Section C.** A pitch class resolved to a sized variant names the variant
in `shape`, `hollow` and `attachment`. Grouping runs on those symbols, so
the size joins the grouping key beside shape, colour, hollow, attachment
and x-offset. Two pitch classes that differ only in size get separate
clauses.

**Compatibility.** Configs that set no size export byte-identically to
1.3.3. The default, Kite 4-369, 45deg-369 and Twinline compact baselines
are unchanged. `cnb/fixtures/sized-export-baseline.ly` pins a sized export.
An engine render of that fixture measures every pitch class at its resolved
height and width, within 5% (`cnb/tests/cnb-lilypond-tests.js`).

### 4.1d The breve as tied semibreves (new in 1.3.12 — linear and axis configs alike)

In repeat mode (a resolved `(repeat . #t)`, `durations.representationMode
"repeat"`) the engine engraves a minim as 2 heads and a semibreve as 4,
each overlapping the last by `cnb:multinote-padding` staff spaces. Before
engine 1.3.0 a breve was the semibreve's 4 heads. Since engine 1.3.0
(engine session 25, its `configurator-handoff.md` in
`docs/session-sets/025-breve-tied-semibreves/`) a breve is **two semibreve
groups, tied**, and the preview draws the same (session 44):

- **Groups.** Each is the semibreve's stencil, unchanged: 4 heads, each
  `cnb:multinote-padding` (−0.5 staff space by default) over the last.
- **Gap.** The second group starts 1 staff space after the first group's
  right edge (stencil extents). The breve is therefore
  `2 × semibreve width + 1` staff spaces wide.
- **Tie.** One in the gap, on the head's centre line: LilyPond's
  `(make-tie-stencil (cons x1 0) (cons x2 0) 0.12 DOWN)`, x1 the first
  group's right edge and x2 = x1 + 1, with LilyPond's default height limit
  1.0 and ratio 0.33. Its bow is (2/π)·atan(π·0.33·1/2) = 0.3046 staff
  spaces below the centre line, a bézier sandwich 0.12 staff spaces thick
  (angularity 0.5), filled and outlined with a 0.1 line
  (`CNBCard.tiePath`). It is on each notehead of the card's octave pair.
- **The tie is black**, whatever the notehead's colour: the engine adds it
  after colouring the head, so it takes LilyPond's default colour (or a
  score's own `NoteHead.color`). The preview draws it black.
- **The breve stays one note**: one NoteHead grob, no Tie grobs, so dots,
  spacing and the per-pitch `repeat` field behave as for any notehead.
  Section C still gets duration category 0 for a breve. With
  `(repeat . #f)` a breve is one head, as before. The ledgers are 1.5
  times the whole width, in the preview and the engraving alike.
- **Durations.** The Configurator's stop at the breve. The engine also
  engraves a longa as 4 tied groups and a maxima as 8; the Configurator
  has no such duration.

**The export text is unchanged.** Nothing new is written and no setting is
added: what changed is how engine 1.3.0 engraves what was always exported.
The five export baselines are byte-identical to 1.3.11. **An export
engraved with an engine before 1.3.0 draws a repeat-mode breve as 4
heads**, which the preview no longer draws.

**Verified** by an engine round trip (`cnb/tests/cnb-card-tests.js`,
measured through `cnb/tests/engine-probe.js`): for the Kite 4-369 and
45deg-369 fixtures, in repeat mode, every pitch class's engraved breve is
within 0.001 staff spaces of the preview's, in width and in height. The
width is compared with the preview's layout of the engraved head, since
each engraved head is about 0.0002 staff spaces wider than the preview's
(the export writes path coordinates to 4 places) and a breve has 8 heads:
Kite 8.6680 engraved against 8.6683, 45deg-369 8.6681 against 8.6682;
the preview's own heads give 8.6667 and 8.6674. Heights are 1.3335 and
1.3334 against 1.3333; on these fixtures the tie lies within the head's
height.

### 4.4a Stem Attachment Registrations under a pitch axis

v1.2.1 §4.4 emits attachment points in staff-space units, converted from the
shape's canonical semitone-unit `lilypondAnchors` by dividing by
`staff.semitonesPerStaffSpace` at export time (the 007-s1 D5 rule).

Under a pitch axis, the divisor is **`pitchAxis.axisUnitsPerStaffSpace`**
instead. This is one instance of the design's single substitution rule
(design §1.2): the axis unit takes over the semitone's role in every
semitone→staff-space conversion, so the shape's engraved size relative to
the staff space matches what the preview shows.

Format and 4-point model are unchanged.

*(1.3.8: superseded. Attachments are no longer in staff spaces, so neither
divisor enters; see §4.4b.)*

### 4.4b Stem attachment units (new in 1.3.8, linear and axis configs alike)

This amends v1.2.1 §4.4 and §4.4a (session 33). The engine passes each
`cnb:register-attachment!` point unchanged to LilyPond's
`NoteHead.stem-attachment` (`cnb/stems.ly`). LilyPond reads that point
**relative to the notehead stencil's extent**: −1 is the left (bottom)
edge, 1 the right (top) edge and 0 the extent's centre. The exporter wrote
staff spaces, so every exported stem engraved nearer the notehead's centre
than the preview drew it. The default crotchet's up stem, for example,
engraved 0.105 staff spaces right of centre instead of 0.393.

The exporter now writes each anchor in those units:

```
relative = (2a − (min + max)) / (max − min)        per axis
```

- `a` is the anchor in semitone units, Y up: `lilypondAnchors` as stored,
  or else `anchors` (native SVG units) ÷ SVG units per semitone, Y negated.
- `[min, max]` is the exact extent of the path Section A registers for the
  shape, in the same units. That is the pre-baked `lilypondPath`, or else
  `svgPath` through the §4.1b fallback normalisation. The extent counts
  every segment's end points and each curve's true extremes, not its
  control points, as LilyPond's `make-path-stencil` measures it.
- Values are rounded to 4 places.

The staff-space divisor (§4.4, §4.4a) and a sized variant's scale (§4.1c)
change the path and the anchor alike, so they cancel. A sized variant
registers its shape's points, and an axis config writes the same points as
a linear one. `lilypondAnchors` stay semitone units in the config. In repeat
mode the engine's stencil is the group of repeated heads, and LilyPond reads
the same relative point across the group, as the preview draws it.

LilyPond puts the stem's **edge** on the attachment point: an up stem's
right edge and a down stem's left edge. Since 1.3.8 the preview does the
same (`CNBStem.geometry`), so the two stems' anchored edges coincide even
though their widths differ (the preview's stem thickness is preview-only,
§5.2a). *(1.3.11: the anchor became the stem's centre and the point is
written half a stem outward of it, §4.4c. The two stems are the same
width since 1.3.9.)*

**Kite worked check.** The kite path spans ±2 semitones on each axis. Its
anchors, 1.8 semitones up and the minim's ∓0.73 across, export as the
engine golden file's `(0 . 0.9)` and `(-0.365 . 0.9)`. The fixture's stem
rects had been placed so that the old ÷ sps conversion produced those
numbers. Session 33 moved them to the true anchors, and the export is
byte-identical. *(1.3.11: the crotchet stems are centred, §4.4c, so the
export no longer matches the golden file's x.)*

**Verified** by an engine round trip (`cnb/tests/cnb-card-tests.js`): the
default shape in repeat mode, crotchet and minim, stem up and down. Each
engraved stem's anchored edge lands within 0.001 staff spaces of the
preview's.

**1.0.0 exports with stems engraved them too near the notehead's centre
and should be regenerated.**

### 4.4c The anchor is the stem's centre (new in 1.3.11, linear and axis configs alike)

This amends §4.4b (session 40). A shape's stem anchor is where the
**stem's centre** goes, as the SVG's stem rect draws it: the importer reads
each anchor at the rect's end-centre, unchanged, so a rect drawn centred on
the notehead centres the stem. In 1.3.8–1.3.10 the anchor was the stem's
edge, so a centred rect (Kite 4-369, 45deg-369) previewed and engraved half
a stem off centre.

LilyPond still puts the stem's edge on the attachment point, so the
exporter writes each point half the engine's stem outward of the anchor:

```
x = relative(a.x × scale.x + side × 0.065 × sps)       side +1 up, −1 down
y = relative(a.y)
```

- `relative` is §4.4b's, against the extent of the path Section A
  registers, a sized variant's included.
- 0.065 staff spaces is half the engine's 0.13-staff-space stem
  (`CNBStem.THICKNESS`), in semitones by `sps`: `staff.semitonesPerStaffSpace`,
  or `pitchAxis.axisUnitsPerStaffSpace` under a pitch axis. The staff space
  therefore no longer cancels from x.
- The half stem does not scale with a sized variant (§4.1c), so a variant's
  points are computed at its `scale.x` rather than copied from its shape.
  Y is the anchor's alone, as in §4.4b.

The preview draws a one-head stem centred on its anchor. Across a repeated
group, LilyPond reads the attachment across the group's extent, so the
preview places the anchored edge at the same scaled point and the centre
half a stem inward of it, and the two still coincide.

**The default notehead's stems sit on its sides.** Its anchors are
x ±146.426 SVG units (the path's extent is ±172.426): on its staff of 4
semitones per staff space, the up stem's right edge is on the notehead's
right edge and the down stem's left edge on its left, crotchet and minim.
The default export writes `(1 . 0.3157)` / `(-1 . -0.3157)`. The half stem
is measured in staff spaces, so a staff with other spacing needs other
anchors: each gallery file that carries the default notehead sets them for
its own staff (its semitones, or axis units, per staff space), so every one
exports `(±1 . …)` and draws the stems' outer edges on the notehead's sides
(Schoenberg's slashed ovals on the oval's sides). A config made from the
default that changes the staff's spacing keeps the default's anchors, and
its stems' edges sit a little outside (wider spaces) or inside (narrower)
the sides.

**Exports that change:** every config with stems. Kite 4-369 writes
`(0.0975 . 0.9)` and the minim's `(-0.2675 . 0.9)`, so its crotchet stems
are centred and its export no longer matches the engine golden file's x;
45deg-369 writes `(0.0975 . 0.8246)`. The five export baselines were
regenerated. **1.0.0 exports with stems, and exports made while 1.1.0 was in
development, should be regenerated.**

**Verified** by an engine round trip (`cnb/tests/cnb-card-tests.js`): for
every card's octave chord, crotchet and minim, on the default, Kite 4-369
and 45deg-369 fixtures, the engraved stem's centre lands within 0.001 staff
spaces of the preview's, as do its width and ends.

### 4.5a Colours on the noteheads (new in 1.3.10, linear and axis configs alike)

This amends v1.2.1 §4.5 (session 37). A config has no palette: a
notehead's colour is its rules' `apply.color`, and `null` (or no rule
setting one) is none, drawn and exported black. A colour-blind version of
a notation is a second config, the same one saved under another name with
other colours, so the export has no accessible branch.

**Section A5** registers each distinct colour the resolved noteheads use
(every pitch class × duration, and with keys on each key branch of §6.4),
once, in first-use order, compared without regard to case, and black when
some notehead is black:

```lilypond
%% --- Register colors ---
#(cnb:register-color! 'sky-blue-50b4e9 "#50b4e9")
#(cnb:register-color! 'puce-cc79a7 "#cc79a7")
#(cnb:register-color! 'black-000000 "#000000")
```

- **The symbol is named from the hex**, the nearest colour name and the
  hex (`nearestColorName` → `toSchemeSymbol`, `cnb/src/cnb-color.js`):
  `#1b9e77` → `shamrock-1b9e77`. `palette.schemeSymbols` is gone, so a
  colour has one name in every export. Section C's `(color . …)` names
  the same symbol.
- **No `#(if (and (defined? 'cnb:use-accessible-colors) …))` block.** The
  exporter never writes or reads `cnb:use-accessible-colors`, and nothing
  changes in the engine: the variable simply stays unset.
- **A palette in a saved config** is moved onto the noteheads when the
  config loads (`CNBConfig.paletteToRules`, called by
  `CNBConfigIO.mergeLoaded`). Each distinct non-black colour of
  `palette.colors` becomes a rule for its pitch classes, below every
  existing rule, so an explicit rule colour still wins, and rules' explicit
  `color: null` ("use the palette") is dropped. The primary colours are
  the ones carried, because they are what the export engraved by default.
  The colour-blind set, `useCBSafe` and `schemeSymbols` are dropped. The
  config previews and exports the same colours as before.
- **Retired settings:** `palette` and `engine.useAccessibleColors`. A
  config that carries them still loads, and neither is read or emitted.

**Baselines.** The five export baselines (default, Kite 4-369, 45deg-369,
sized, Twinline compact) were regenerated, and the three fixture configs
with palettes were converted. The colours are the same. What changes is the
header (§5.2a), the A5 block above, and Kite's symbol names (its palette
had named them `skyblue-50b4e9` and `rose-cc79a7`; they are now
`sky-blue-50b4e9` and `puce-cc79a7`).

---

## 5. SECTION B — ADDITIONS

### 5.1a The staff's range follows its middle (new in 1.3.5, linear and axis configs alike)

This amends v1.2.1 §5.1, which expanded `staff.semitonePattern` over the
two-octave card range, semitones 0–23, whatever the midpoint (session 28;
design `docs/planning/notehead-first-editor-design.md` §11). The exporter
now expands the pattern over the **24 semitones centred on the middle of
the staff**:

```
staff.midpoint − 12  ≤  S  <  staff.midpoint + 12
```

Each such `S` converts as before: `2 × (S − midpoint) / sps` on the linear
path, and the §5.4a axis formula, deduplicated, under a pitch axis.

Why: the editor moves the pitch by rewriting `staff.midpoint` and the
pattern together (design §3.1). With a fixed 0–23 range, a shift that
carried a line past one edge brought it back at the other, so renaming C to
F♯ on the default 4-8 staff exported `'(-2 2 4 8)` instead of
`'(-4 -2 2 4)`. With the range centred, the exported staff is the same set
of lines relative to its middle for every shift.

Compatibility: at midpoint 12 the range is 0–23, so the default, Kite
4-369, 45deg-369, the sized fixture and every gallery file except Twinline
export byte-identically. Twinline (midpoint 7) exports
`'(-6 -3 -1 1 4 6)` instead of `'(-3 -1 1 4 6 8)`, three lines either side
of G instead of two below and four above, and its baseline
(`cnb/fixtures/twinline-compact-export-baseline.ly`) was regenerated.

### 5.2a Settings not emitted (new in 1.3.3, linear and axis configs alike)

This amends the v1.2.1 §5.2/§5.3 emit-if-changed tables (audit 2026-11-02,
M1 and M2). The exporter emits only what the engine engraves. These settings
are never emitted:

- **`cnb:stem-thickness`** (from `engine.stemThickness`). The engine defines
  no such variable, so setting it is an "Unbound variable" error that stops
  LilyPond.
- **`cnb:default-staff-line-thickness` and `cnb:default-staff-line-color`**
  (from `staff.lineDefaults`). The engine reads them only in advanced mode
  (`cnb:staff-and-ledger-lines`), which the Configurator does not emit, so
  they were no-ops. §5.3a below therefore describes a conversion that is no
  longer emitted.

**Since 1.3.10 nothing is preview-only.** The last such setting,
`palette.useCBSafe` (the colour-blind preview toggle of 1.3.9), went with
the palette (§4.5a), and the header no longer lists preview-only settings.
The rest of the old list (session 34) is either exported or no longer a
setting:

- **Exported:** ledger rules (§5.7) and key-scoped notehead rules (§6.4).
- **Drawn by the preview as the engine engraves them, and retired as
  settings:** stems (0.13 staff spaces thick, LilyPond's length, the edge
  on the anchor, §4.4b), staff lines (0.1 staff spaces, black, solid),
  ledgers (0.2 staff spaces, rounded, 1.5 notehead widths long), the key
  signature's spacing (0.75 staff spaces after the staff's start or 3.5
  after a clef's left edge, the first notehead centred 4.8636 after it) and
  the repeat counts (fixed, minim ×2, semibreve ×4, and since 1.3.12 a
  breve as two tied semibreves, §4.1d).
  `display.stemThicknessPct`, `display.stemExtension`,
  `engine.stemThickness`, `staff.lineDefaults`, `staff.lineOverrides`,
  `ledgers.lineDefaults`, `ledgers.lineOverrides`,
  `keys.keySignature.gutter` and `durations.repeatCounts` are no longer
  defaults, validated or edited. A config that carries them still loads,
  and none is read or emitted. Validation check 10 (§8) went with the line
  overrides.

Since 1.3.10 the header has no color-palette line (1.3.3–1.3.9 named the
palette there when Section A registered its colours, and otherwise wrote
`none (no palette colors are exported)`), and no comment names
`cnb:use-accessible-colors`.

### 5.3a Staff/Ledger Line Thickness under a pitch axis

*(Not emitted since 1.3.3; see §5.2a.)*

The v1.2.1 §5.3 conversion

```
absolute_thickness = (percentage / 100) × (1 / semitonesPerStaffSpace)
```

becomes, when `pitchAxis.enabled`:

```
absolute_thickness = (percentage / 100) × (1 / axisUnitsPerStaffSpace)
```

(thicknessPct remains canonical, expressed against the grid unit — one axis
unit under a pitch axis, one semitone otherwise. Emit-if-changed is still
judged at the pct level.)

### 5.4 Pitch axis (new — emitted only when `pitchAxis.enabled`)

#### 5.4a `cnb:staff-line-positions` through the axis

LilyPond staff positions are half-staff-spaces from center (v1.2.1 §5.1).
Under a pitch axis, each expanded absolute staff semitone `S` converts as:

```
lyPosition = 2 × (positionOfSemi(S) − positionOfSemi(staff.midpoint))
               / axisUnitsPerStaffSpace
```

where `positionOfSemi(s) = pitchClasses[pc(s)].position
+ octave(s) × octaveStride` (design §1.1). The emitted list is
**deduplicated** (two pattern semitones may collapse onto one axis
position; conflicting style overrides for collapsing lines are a validation
error, design PA-6) and sorted.

Degeneracy: with the identity map (position(pc) = pc, stride 12) and
`axisUnitsPerStaffSpace = semitonesPerStaffSpace` this is exactly the
v1.2.1 formula `2 × (S − midpoint) / sps`.

`cnb:semitones-per-staff-space` is still emitted (Always), but **under a
pitch axis its value is `pitchAxis.axisUnitsPerStaffSpace`** (1.3.1,
engine handoff 008 §4.1). The engine's placement consumers moved to the
hook (E13-3/E13-4), but its LENGTH consumers — `cnb:clef-size-semitones`,
`cnb:clef-gutter-semitones`, custom-clef `height-semitones`,
`cnb:keysig-bar-extent-semis` — still divide by this setting, by design:
an absolute-pitch hook cannot map an interval on a non-uniform axis.
Emitting the axis unit makes those settings read "grid units", the same
substitution rule as §4.4a and §5.3a; emitting the linear
`staff.semitonesPerStaffSpace` would mis-size clefs, clef gutters and the
key-signature bar. Linear configs are unaffected.

*(1.3 said the remaining consumers "migrate to the hook"; that was true of
placement only.)*

#### 5.4b The compiled pitch-axis procedure

The exported JSON map compiles to the engine hook proposed by the design
consult and validated by session 1's spike — a procedure from absolute
semitone to LilyPond staff position (half-staff-spaces, the same unit as
`cnb:staff-line-positions`), with the octave anchor **baked in** so that
`staff.midpoint` lands at staff position 0 regardless of clef
(`middleCPosition` does not enter; design §1.2 anchor rule):

```lilypond
%% Pitch axis (pitch-class-map-v1) — 12 pitch classes on 7 positions/octave
%% map [0 0 1 2 2 3 3 4 5 5 6 6] · octave stride 7
%% axis units per staff space: 2 · midpoint semi 7 → axis position 4
#(set! cnb:get-pitch-staff-position
   (lambda (semitone)
     (let* ((pc (modulo semitone 12))
            (oct (/ (- semitone pc) 12))
            (pos (+ (vector-ref #(0 0 1 2 2 3 3 4 5 5 6 6) pc)
                    (* oct 7))))
       (/ (* 2 (- pos 4)) 2))))
```

Generation rules:

- The positions vector is `pitchClasses` sorted by `pc`, values formatted
  with the exporter's standard number formatting (integers bare, floats to
  4 decimals); fractional positions are legal.
- The octave-stride multiplier is `pitchAxis.octaveStride`.
- The subtracted anchor is `positionOfSemi(staff.midpoint)` computed at
  export time and inlined as a literal.
- The divisor is `pitchAxis.axisUnitsPerStaffSpace`, inlined.
- Scheme's `modulo` is floored for a positive modulus, so
  `(modulo -1 12)` = 11 and `oct` is an exact integer for every semitone —
  the same euclidean arithmetic as `CNBMusic.pitchClass` /
  `CNBMusic.octave`, verified into negative octaves by the session-1 render
  (s1 record §3.1).
- Emitted in Section B immediately after the staff-geometry block, before
  the emit-if-changed settings.

**Worked check (the session-1 spike geometry):** `staff.semitonePattern
[2, 5, 8]` (D, F, G♯ → axis positions 1, 3, 5), `midpoint 7` (G → axis 4),
stride 7, axis-units-per-staff-space 2, over the two-octave card range:
§5.4a yields `'(-3 -1 1 4 6 8)` and the procedure sends middle C (semitone
0) to −4 — byte-for-byte the staff and anchor the session-1 spike rendered
and measured (s1 record §2.1, §3.1). *(Since 1.3.5 the range is centred on
the midpoint, semitones −5…18 here (§5.1a), so the same geometry exports
`'(-6 -3 -1 1 4 6)`. The anchor and the procedure are unchanged.)* The stem-direction flip the engine
showed at staff position 0 (s1 §3.3) falls on the midpoint by construction.

#### 5.4c Engine defaults

`cnb:get-pitch-staff-position` defaults to `#f` in the engine (E13-1): the
engine keeps its literal v1.2.1 linear formula on the `#f` path, so an
engine with the hook renders all existing exports byte-identically. The
Configurator emits the setting **only** when a pitch axis is enabled —
emit-if-changed at the section level.

**Semitone numbering under the hook (1.3.1).** The compiled procedure reads
its argument — the engine's `ly:pitch-semitones`, middle C = 0 — directly
as a Configurator semitone: `staff.midpoint` and the map are applied to it
with no octave shift. Configurator semitone `s` and engine semitone `s` are
therefore the same pitch under an axis, and the axis — not the clef — sets
the register. (The linear path differs: there the clef sets the register,
and under the treble clef the engine puts semitone 12 on the middle line,
where the preview puts the default `staff.midpoint`. The set-006 −1 octave
offset of `cnb:keysig-tonic-octave` this note once cited applies on
neither path: §5.6 measures the linear numbering as is.)

#### 5.4d Key-signature octave under a pitch axis (new in 1.3.1)

With the hook set, key-signature marks are PLACED through it, but the
engine still SELECTS which octave of the key to display from
`middleCPosition` unless `cnb:keysig-tonic-octave` is an integer (engine
handoff 008 §4.2). Under an axis that would bring the clef back into what
is shown, so the exporter **always emits an explicit value when a pitch
axis is enabled**, in Section B right after the §5.4b procedure:

```lilypond
%% Key-signature octave — explicit under a pitch axis (engine handoff 008 §4.2)
#(set! cnb:keysig-tonic-octave 0)
```

- Value: `keys.keySignature.placement.tonicOctave` when it is an integer;
  otherwise the octave the preview's auto rule picks for a C tonic,
  `round((staff.midpoint − 6) / 12)` (the `CNBKeySignature.tonicSemi`
  rule at pc 0).
- Numbering: Configurator octaves, emitted **as is** — no −1 offset (see
  the numbering note in §5.4c). Verified by the set-014 session-3
  round-trip: `\key g \major` with the emitted `0` puts the eight marks on
  semitones 7…19, exactly the preview's signature positions.
- Known divergence, auto placement only: the engine takes one octave for
  every key, while the preview's auto rule centers each tonic on the
  midpoint, so the two can differ by an octave for some tonics (for the
  Twinline fixture, midpoint 7: tonics G♯, A, A♯ and B). An explicit
  `tonicOctave` removes the divergence.
- Not emitted for linear configs (byte-identity with v1.2.1).

#### 5.4e Engine behaviours under a pitch axis (new in 1.3.6)

Two things the engine does under a pitch axis that the export cannot
change (engine handoff 008 §5, flags 1 and 2). The exported output is the
same as in 1.3.5; this section only records them.

- **Collision analysis rounds axis positions to whole numbers.** The
  engine's collision machinery reads placed noteheads back as staff
  positions rounded to whole numbers, so `cnb:collision-threshold`
  compares axis distances on that rounded grid. On a map with fractional
  positions, two noteheads whose positions differ by less than a whole
  number can be treated as colliding, or as not colliding, differently
  from what their exact positions would give. Keep this in mind when
  fractional positions are combined with a tight collision threshold.
- **Dotted notes in two voices at one axis position lose a dot.** When two
  voices put notes of the same duration at one axis position, both
  noteheads are drawn (no head is merged away; the `x-offset` field, §6.3,
  separates them), but LilyPond's own merge logic removes the dots of the
  down-stem head. So a dotted pair of that kind shows the up voice's dot
  only. This is upstream LilyPond behaviour; the engine leaves it alone.

---

### 5.5 The clef (new in 1.3.7, linear and axis configs alike)

Before 1.3.7 the exporter wrote nothing for the `clef` section, so every
export engraved the engine's default dozenal clef, which the preview does
not draw. The engine has had a clef configuration since its set 005
(`docs/session-sets/005-clef-configurability/configurator-handoff.md` in
the engine repository), and the exporter now writes it. A clef is *shown*
when `clef.enabled` is on and `clef.active` names a definition
(`CNBClef.activeGlyph`).

**Decision: a config with no clef shown exports `'none`.** That is the
preview's answer, and it includes the default config, whose clef is off.
The Configurator has no kind for the engine's dozenal clef, so it never
asks for it; a score that wants it sets `cnb:clef-style 'dozenal` after
`\include`. So `cnb:clef-style` is always written, in Section B after the
staff geometry (and the pitch axis, when one is enabled):

| Config | Section B | Section A |
|---|---|---|
| no clef shown | `#(set! cnb:clef-style 'none)` | — |
| `kind: "glyph"` | `'custom`, `cnb:clef-name '<slug of the name>`, gutter | A6: `cnb:register-clef!` |
| `kind: "text"` | `'text`, `cnb:clef-text`, `cnb:clef-size-semitones`, gutter | — |

**Glyph registration (A6).** Section A ends with

```lilypond
%% --- Register clef ---
#(cnb:register-clef! 'express-b
   (list
     (cons 'path '(
         (moveto 0 0)
         …))
     (cons 'anchor-semitones 22.784)
     (cons 'height-semitones 6)))
```

- `path`: the definition's pre-baked `lilypondPath`, re-emitted from its
  numbers, or else `svgPath` converted as a notehead fallback is (§4.1b, Y
  negated) with a divisor of 1. The engine measures the path and scales it
  uniformly to `height-semitones`, so only the shape matters, not its units.
- `anchor-semitones`: the glyph's top edge (`anchorSemi`) on the engine's
  axis, middle C = 0 with `middleCPosition` (handoff flag A). On a linear
  staff the engine puts semitone 12 on the middle line under the treble
  clef, where the preview puts `staff.midpoint`, so the exporter writes
  `anchorSemi − staff.midpoint + 12`, the same distance from the middle.
  Under a pitch axis the hook reads Configurator semitones (§5.4c), so it
  writes `anchorSemi` as it is. The engine interpolates a fractional anchor
  through the hook, as the preview does.
- `height-semitones`: `semitoneHeight`. `cnb:clef-size-semitones` is not
  written for a glyph clef.
- `color`: the definition's `color`, when it has one (`#RRGGBB`).

**Text clef.** `cnb:clef-text` is a markup, so the label keeps the
preview's font, colour and bold weight (handoff flag D):

```lilypond
#(set! cnb:clef-text (markup #:with-color "#000000" #:override (cons 'font-name "Georgia, serif Bold") "4"))
#(set! cnb:clef-size-semitones 4)
```

The colour defaults to `#000000` and the font to `Georgia, serif`, as in the
preview. `cnb:clef-size-semitones` is `textHeightSemis`.

**Gutter.** A shown clef gets
`cnb:clef-gutter-semitones = clef.gutter.paddingH ÷ display.pxPerSemi`, the
preview's padding in semitones (handoff flag B). The preview pads both
sides; the engine adds the space on the right only, so the left padding has
no engine counterpart.

**Units under a pitch axis.** The engine divides the anchor-free lengths
(`height-semitones`, `cnb:clef-size-semitones`, the gutter) by
`cnb:semitones-per-staff-space`, which is `axisUnitsPerStaffSpace` under an
axis (§5.4a), so they read as grid units, as the preview draws them.

**Known divergence: a text clef's height on the staff.** The engine anchors
only a `'custom` clef. It places a `'text` clef at a fixed height of its
own, so a text clef engraves at its preview size but not at its
`anchorSemi`. Anchoring text clefs is engine work, recorded as a follow-up.

**Verified** by engine round trips (`cnb/tests/cnb-lilypond-tests.js`,
measured through `cnb/tests/engine-probe.js`): a glyph clef on the Twinline
axis with the fractional anchor 13.5 engraves its top and bottom edges at
the preview's positions; a text clef engraves at its preview height; the
default config engraves no clef.

### 5.6 The key signature (new in 1.3.7, linear and axis configs alike)

Before 1.3.7 the exporter wrote nothing for `keys.keySignature`, so a
config whose signature is off still engraved one from the score's `\key`.
The engine has had a key-signature configuration since its set 006
(`docs/session-sets/006-keysig-configurability/configurator-handoff.md`),
and the exporter now writes it in Section B, after the clef:

- **`cnb:keysig-style 'none`** unless `keys.enabled` and
  `keys.keySignature.enabled` are both on. The default config's signature
  is off, so it exports `'none`. With the signature on, the style is the
  engine's default `'chord` (`notehead-chords`, the one style) and is not
  written.

With the signature on, each bar setting is written only when it differs
from the engine's default:

| Setting | Conversion | Engine default |
|---|---|---|
| `cnb:keysig-bar-color` | `separator.color`, as is | `"#ffd42a"` |
| `cnb:keysig-bar-thickness` | `separator.thicknessPct / (10 × sps)`; **0 when `separator.enabled` is false** | `4` |
| `cnb:keysig-bar-extent-semis` | `separator.extentSemis`, as is | `12` |
| `cnb:keysig-tonic-octave` | linear staff: an integer `placement.tonicOctave`, **as is** | `#f` |

- `sps` is `staff.semitonesPerStaffSpace`, or `axisUnitsPerStaffSpace`
  under an axis. The thickness is in `#:draw-line` units, a tenth of a
  staff space each, so the default 160% at sps 4 is the engine's 4. At
  sps 3 the same 160% is written as 5.3333.
- **A separator that is off** is written as thickness 0. The engine has no
  switch for the bar alone (handoff §3.3), and a zero-width line draws
  nothing. A bar-only switch is recorded as an engine follow-up.
- **The tonic octave on a linear staff has no offset.** Handoff §3.2 gave
  `tonicOctave − 1`, but on a linear staff the engine places semitone `s`
  where the preview does at the default middle (12), so the two octave
  numberings agree. The round trip measures it: `tonicOctave 1` puts G's
  marks on semitones 19–31, exactly the preview's. Automatic placement
  (`null`) writes nothing; the engine's own octave matches the preview's
  automatic rule for the default staff. Under a pitch axis §5.4d writes the
  octave instead, so it is written once.
- `placement.rule` has no engine setting. Since 1.3.9 the signature's
  spacing is the engine's in the preview too (§5.2a), and
  `gutter.paddingH` is retired.

**Verified** by an engine round trip: a G major signature with a styled bar
(`#123abc`, 80%, extent 2) and `tonicOctave 1` engraves its marks' top at
the preview's position and the bar's end at ±extent, with the bar's colour
and a thickness of 0.2 staff space read from its stencil; the default
config engraves no signature.

### 5.7 Ledger lines (new in 1.3.9, linear and axis configs alike)

Before 1.3.9 the export wrote no ledger rules, and the engine drew its own
ledgers from the staff's spacing. So in-gap ledgers (the C ledger in the
middle of the 4-8 staff, for example) and any ledger set by a template's
pitch classes showed only in the preview. Since 1.3.9 every notehead the
preview draws engraves exactly the ledgers the preview draws for it.

**The table.** Section B writes, after the staff geometry (and the pitch
axis), one entry for each semitone 0–24, the pitches the preview's cards
draw. Each entry gives the ledgers `CNBLedgerSet.ledgersFor` resolves for a
note there, as LilyPond staff positions (`CNBStaff.lilypondPosition`, half
staff spaces from the middle line, fractional where they fall between
whole positions), and an empty list where the preview draws none:

```lilypond
%% Ledger lines — each notehead the preview draws gets the ledgers drawn
%% there: engine semitone (middle C = 0) → ledger staff positions. Any
%% other pitch keeps the engine's ledger rule.
#(define cnb:ledgers-by-semitone
   '((0 . (-6)) (1 . (-6)) (2 . (-6 -5)) (3 . ()) (4 . ()) (5 . ())
     …
     (24 . (6))
     ))
#(define (cnb:ledgers-of grob)
   (assv (ly:pitch-semitones (ly:event-property (event-cause grob) 'pitch))
         cnb:ledgers-by-semitone))
\layout {
  \context {
    \Voice
    \override NoteHead.ledger-positions =
      #(lambda (grob) (let ((e (cnb:ledgers-of grob))) (if e (cdr e) '())))
    \override NoteHead.no-ledgers =
      #(lambda (grob) (let ((e (cnb:ledgers-of grob))) (and e (null? (cdr e)))))
  }
}
```

- **Keys are engine semitones**, middle C = 0. Under a pitch axis the hook
  reads Configurator semitones as they are (§5.4c), so the key is the
  preview semitone. On a linear staff the engine puts semitone 12 on the
  middle line where the preview puts `staff.midpoint` (§5.5), so the key is
  the preview semitone − (`staff.midpoint` − 12).
- **Each notehead takes its pitch's entry.** LilyPond's
  `NoteHead.ledger-positions` overrides the staff's ledger rule for that
  head, and `no-ledgers` turns its ledgers off when the entry is empty. A
  `\layout` block at the top level of the export carries both: a score's own
  `\layout`, at the top level or in a `\score`, starts from it.
- **Any other pitch keeps the engine's rule.** The preview's staff repeats
  every octave, while the engraved staff has only the exported lines (§5.1a),
  so the preview's rule applied far from the staff would leave a ledger
  floating away from it. The engine's rule reaches the engraved staff.

**Why not `cnb:ledger-overrides`.** The engine's simple mode does take
explicit ledgers through `cnb:ledger-overrides`, keyed by notehead
position, but its rule is handed the position rounded to a whole number
(half to even), measured. On a staff of 4 semitones per staff space, B
(−0.5) and C (0) share the key 0, yet the preview draws C a ledger and B
none. The table is keyed by the pitch instead, so no two pitches can share
an entry. `cnb:ledger-overrides` and `cnb:ledger-positions` are not
written.

**Verified** by an engine round trip (`cnb/tests/cnb-lilypond-tests.js`,
measured through `cnb/tests/engine-probe.js`): for the default, Kite
4-369 and 45deg-369 fixtures and every gallery file (Twinline among them),
the octave chord of every card engraves exactly the ledgers the card draws.

## 6. SECTION C — ADDITIONS

### 6.3 The `(x-offset . N)` field

When `pitchAxis.enabled` **and** a clause's resolved
`xOffsetStaffSpaces` is nonzero, the clause's alist gains:

```scheme
(x-offset    . 0.85)
```

- **Units: staff spaces.** Negative = left, positive = right.
- **Missing field = current engine behavior** (no offset). Zero values are
  omitted, and the field is never emitted for a linear config — Section C
  for every `pitchAxis`-disabled config is byte-identical to v1.2.1 even
  when rules carry `xOffsetStaffSpaces` (the field's whole lifecycle is
  axis-gated; design §3.2, deviation D2).
- The resolved offset joins the Section C grouping key: pitch classes are
  grouped into one `memv` clause only when shape, color, hollow,
  attachment, **and x-offset** all match. (Since 1.3.4 a resolved size
  enters through the shape, hollow and attachment symbols, which name a
  sized variant: see §4.1c.)
- Value formatting: the exporter's standard number formatting.
- Engine semantics (E13-2): "offset this notehead by N staff spaces
  horizontally." **As landed (1.3.1, engine handoff 008 §3):** neither
  mechanism 1.3 named survived measurement. Writing mapped values into
  `staff-position` does not change chord arrangement, and the `X-offset`
  property is discarded for chord members. The engine instead translates
  the NoteColumn by the least-displaced head's offset and each head by its
  residual, so head, stem, flag and ledgers move together, including for
  the diatonic-second shared-position chord (`<gis' a'>`) that a stencil
  translation alone loses. That loss was caused by the stem's
  extent-based head arrangement (`Stem::calc_positioning_done`), not by a
  "diatonic-`staff-position`-derived arrangement" as the 013 record §3.4
  supposed. Any combination of per-member values is safe; no exporter
  action is needed.
- A shared-position pair is already separated a little by LilyPond's own
  arrangement, so the offset's effect is measured against a render
  without it: the set-014 session-3 round-trip measures +0.850 staff space
  for every shared pair of the Twinline fixture.

Example clause under the §5.4b axis (C and C♯ share axis position 0; C♯
carries the offset):

```scheme
         ;; C♯ → crotchet-minim, solid, black-000000, +0.85 staff-space right
         ((= pc 1)
          '((shape      . crotchet-minim)
            (color      . black-000000)
            (hollow     . #f)
            (attachment . crotchet-minim-attach)
            (off-key-mark . #f)
            (x-offset   . 0.85)
            (repeat     . #f)))
```

---

### 6.4 Key-scoped notehead rules (new in 1.3.9, linear and axis configs alike)

Before 1.3.9 Section C resolved every notehead with no key, so a rule whose
`match.keys` names a key showed only in the preview. The engine passes
`cnb:get-notehead-config` the key as its pitch classes, the seven it builds
from `keyAlterations` (C major's with no `\key`), not always in order.
Since 1.3.9 Section C dispatches on that list:

```scheme
#(set! cnb:get-notehead-config
   (lambda (semitone duration key)
     (let ((pc (modulo semitone 12))
           (key-pcs (sort (list-copy key) <)))
       (cond
         ;; Key G
         ((equal? key-pcs '(0 2 4 6 7 9 11))
          (cond …clauses resolved with the key G…))

         ;; Any other key
         (else
          (cond …the key-less clauses…))))))
```

- **A branch for each key a rule names**, with keys on (`keys.enabled`):
  the definition's pitch classes, sorted, and its clauses resolved with
  that key (`CNBConfig.resolveNotehead(config, pc, duration, key)`). With
  keys off the preview applies no key, and neither does the export.
- **Definitions sharing a pitch-class set make one branch**, the first of
  them in definition order that a rule names. The engine cannot tell them
  apart (C major and A minor, for example), so validation warns when the
  rules draw them differently and names the one engraved.
- **The key-less clauses are the fallback** for any other key.
- Section A registers the shapes, variants and colours the branches use.
- **Compatibility:** a config with keys off, or with no rule naming a
  defined key, exports byte-identically to 1.3.8.

**Verified** by an engine round trip: a rule colouring F♯ red in G engraves
F♯ red under `\key g \major` and black under `\key c \major`, as the
preview draws it in those keys.

## 8. EXPORT VALIDATION — ADDITIONS

New blocking checks when `pitchAxis` is enabled (mirroring design §1.4;
numbering continues v1.2.1 §8):

8. `pitchAxis.kind` is `"pitch-class-map-v1"`.
9. `pitchAxis.pitchClasses` covers pitch classes 0–11 exactly once with
   finite numeric positions; `octaveStride` and `axisUnitsPerStaffSpace`
   are finite and > 0.
10. *(Retired in 1.3.9.)* No two ledger templates (or staff pattern
    entries) that collapse onto one axis position carry conflicting style
    overrides (design PA-5/PA-6). The line overrides it guarded are no
    longer read (§5.2a).
11. Every `apply.xOffsetStaffSpaces` is a finite number.
12. The map is globally non-decreasing: positions non-decreasing in pc
    order and `positions[11] ≤ positions[0] + octaveStride` (design PA-8 —
    non-monotonic maps are rejected in `pitch-class-map-v1`; promoted from
    a warning during session-2 verification round 1).

New warnings: positions outside `[0, octaveStride)`; indistinguishable
shared-position pairs; `xOffsetStaffSpaces` present while `pitchAxis` is
disabled (design PA-W1, PA-W3, PA-W4).

### 8a The fail-loud interim gate — lifted in 1.3.1

*Historical:* the gate was removed by set 014 session 3 once the engine's
set-008 handoff recorded E13-1 and E13-2 as shipped; checks 8–12 above
remain blocking. As specified in 1.3:

Between v1.3 adoption and the engine shipping E13-1 + E13-2, `generate()`
**throws** on `pitchAxis.enabled` with an error naming the missing engine
capability. Internal fixtures and previews may use the axis; production
export may not. A compact config silently exported through the linear
engine engraves at wrong pitch positions — the failure mode both consult
architects rejected (consult §6; s1 record §5). The implementation set
removes the gate in the same change that first emits §5.4/§6.3, with the
engine round-trip test as evidence.

---

## APPENDIX A ADDITIONS

### Engine Settings

| Variable | Type | Default | Required |
|----------|------|---------|----------|
| `cnb:get-pitch-staff-position` | `#f` or procedure `(semitone) → half-staff-spaces` | `#f` | Only when `pitchAxis.enabled` — **new v1.3 (E13-1)** |
| `cnb:keysig-tonic-octave` | `#f` or integer | `#f` | When `pitchAxis.enabled` (§5.4d) — **new 1.3.1**; on a linear staff for an explicit `tonicOctave` with the signature on (§5.6) — **1.3.7** |
| `cnb:clef-style` | `'dozenal` \| `'none` \| `'custom` \| `'text` | `'dozenal` | Always (§5.5) — **new 1.3.7** |
| `cnb:clef-name` | symbol | `#f` | For a glyph clef (§5.5) — **new 1.3.7** |
| `cnb:clef-text` | markup | `""` | For a text clef (§5.5) — **new 1.3.7** |
| `cnb:clef-size-semitones` | number | `#f` | For a text clef (§5.5) — **new 1.3.7** |
| `cnb:clef-gutter-semitones` | number | `#f` | For a shown clef (§5.5) — **new 1.3.7** |
| `cnb:keysig-style` | `'chord` \| `'none` | `'chord` | `'none` unless keys and the signature are on (§5.6) — **new 1.3.7** |
| `cnb:keysig-bar-color` | `"#RRGGBB"` | `"#ffd42a"` | If changed, signature on (§5.6) — **new 1.3.7** |
| `cnb:keysig-bar-thickness` | number (`#:draw-line` units) | `4` | If changed, signature on (§5.6) — **new 1.3.7** |
| `cnb:keysig-bar-extent-semis` | number (semitones) | `12` | If changed, signature on (§5.6) — **new 1.3.7** |
| `cnb:semitones-per-staff-space` | Integer | `2` | Always; `pitchAxis.axisUnitsPerStaffSpace` under an axis (§5.4a) — **clarified 1.3.1** |

### Procedure Return Alist

| Field | Type | Resolves Via |
|-------|------|-------------|
| `x-offset` | Number (staff spaces), field optional | consumed directly by the notehead engraver — **new v1.3 (E13-2)** |

---

## CHANGE LOG

| Version | Date | Changes |
|---------|------|---------|
| **1.3.12** | **Nov 10, 2026** | **The breve as tied semibreves (session 44, engine session 25): new §4.1d. Since engine 1.3.0 a repeat-mode breve engraves as two semibreve groups 1 staff space apart, joined by LilyPond's `make-tie-stencil` in black, and the preview draws the same. The breve stays one note. §5.2a's repeat counts follow. Export output is UNCHANGED; the five export baselines are byte-identical. An engine round trip holds the breve to 0.001 staff spaces.** |
| 1.3.11 | Nov 9, 2026 | Stems where the notehead's SVG puts them (session 40): new §4.4c. A stem anchor is the stem's centre, as the SVG's stem rect draws it, so the Kite 4-369 and 45deg-369 stems are centred. Each `cnb:register-attachment!` point's x is the anchor moved half the engine's 0.13-staff-space stem outward, relative to the registered extent; a sized variant's points are computed at its scale. The default notehead's anchors move to ±146.426 SVG units, so on its staff the up stem's right edge and the down stem's left edge are on its sides (`(1 . 0.3157)`); each gallery file sets them for its own staff. Output CHANGES for every config with stems; the five export baselines were regenerated. |
| 1.3.10 | Nov 8, 2026 | Colours on the noteheads (session 37): new §4.5a. A config has no palette: a notehead's colour is its rules' `apply.color`. Section A5 registers each colour the resolved noteheads use, once, named from its hex (`nearestColorName` → `toSchemeSymbol`), with no `cnb:use-accessible-colors` branch; the engine is unchanged and the variable is never set. A saved palette is moved onto the noteheads on load (`CNBConfig.paletteToRules`). §5.2a: nothing is preview-only, and the header loses its palette and preview-only lines. `palette` and `engine.useAccessibleColors` are retired. Output CHANGES for every config (the header) and every config with colours (A5, and the symbol names where a palette had named them); the five export baselines were regenerated. |
| 1.3.9 | Nov 7, 2026 | Ledger lines and key-scoped rules (session 34): new §5.7 and §6.4. Section B writes `cnb:ledgers-by-semitone`, the preview's ledgers for every pitch it draws, and a `\layout` block gives each notehead its pitch's entry through `NoteHead.ledger-positions` / `no-ledgers`, so in-gap ledgers engrave; it is keyed by pitch because the engine rounds the position its ledger rule sees. Section C dispatches on the key's sorted pitch classes, one branch per key a rule names, with keys on. §5.2a: the only preview-only setting is the colour-blind toggle; the preview draws stems, staff lines, ledgers, the key signature's spacing and the repeat counts as the engine does, and their settings are retired. §8 check 10 is retired. Output CHANGES for every config (the ledger block and the header); the five export baselines were regenerated. |
| 1.3.8 | Nov 7, 2026 | Stem attachment units (session 33): new §4.4b. `cnb:register-attachment!` points are written relative to the registered path's exact extent, the units LilyPond's `NoteHead.stem-attachment` reads, instead of staff spaces, so the §4.4a divisor and the §4.1c attachment scaling no longer enter. The preview now puts a stem's edge on its anchor, as LilyPond does. Output CHANGES for every config with stems: the default, 45deg-369, sized and Twinline baselines were regenerated; the Kite fixture's anchors became true semitone anchors and its export is unchanged. 1.0.0 exports with stems engraved them too near the centre and should be regenerated. |
| 1.3.7 | Nov 7, 2026 | The clef and the key signature (session 30, engine handoffs 005 §5 and 006 §3): new §5.5 and §5.6. `cnb:clef-style` is always written: `'none` when no clef is shown (the default config included), `'custom` with a `cnb:register-clef!` glyph, or `'text` with a styled markup. A shown clef also gets its gutter in semitones. `cnb:keysig-style 'none` is written unless keys and the signature are on, and then the bar's colour, thickness (0 when off) and extent and a linear explicit tonic octave (no offset, measured) are written emit-if-changed. Output CHANGES for every config; the five export baselines were regenerated. |
| 1.3.6 | Nov 7, 2026 | Engine behaviours under a pitch axis (session 29): new §5.4e records two from engine handoff 008 §5. Collision analysis rounds axis positions to whole numbers, and LilyPond drops the down-stem head's dots for dotted notes in two voices at one axis position. Documentation only: export output is unchanged. |
| 1.3.5 | Nov 7, 2026 | The staff's range follows its middle (session 28): new §5.1a. `cnb:staff-line-positions` expands the pattern over `staff.midpoint − 12 ≤ S < staff.midpoint + 12` instead of semitones 0–23, so a moved pitch keeps the engraved staff. Output is unchanged for every config whose midpoint is 12. Twinline (midpoint 7) now exports `'(-6 -3 -1 1 4 6)`. |
| 1.3.4 | Nov 6, 2026 | Sized shape variants (session 22): new §4.1c. A notehead rule's `apply.heightSemis` / `apply.widthSemis` (semitones) export as a scaled variant of the shape, `<shape>-h<H>-w<W>`, with its path, cutout and attachments scaled by width ÷ natural width and height ÷ semitoneHeight. Section C names the variant, so the size joins the grouping key. Output is unchanged for configs that set no size. |
| 1.3.3 | Nov 3, 2026 | Preview-only settings (session 12, audit 2026-11-02 M1–M3, L2, L3): new §5.2a. `cnb:stem-thickness`, `cnb:default-staff-line-thickness` and `cnb:default-staff-line-color` are no longer emitted. The header lists the preview-only settings, names a palette only when its colors are exported, and drops the `(standard)` / `(cb-safe)` mode, as does the A5 comment. Linear output CHANGES in the header and wherever those settings were set. |
| 1.3.2 | Nov 3, 2026 | Path units (session 11, audit 2026-11-02 H2/H3): new §4.1b amends v1.2.1 §4.1 for linear and axis configs alike. Pre-baked `data-lilypond-*` paths are semitone units, Y up, emitted ÷ sps (÷ `axisUnitsPerStaffSpace` under an axis) and re-emitted from their numbers. The `svgPathToLilypond` fallback divides by `naturalHeight / semitoneHeight`, negates Y, then applies the same division. Linear output CHANGES for path data, the one exception to the v1.2.1 byte-identity rule. 1.0.0 exports with toolkit or fallback paths were mis-scaled. |
| 1.3.1 | Oct 31, 2026 | Engine-handoff reconciliation (set 014 session 3, against engine set 008's `configurator-handoff.md`): the §8a gate is lifted (E13-1/E13-2 shipped; engine round-trip in `sessions/session-003/roundtrip/`); §5.4a — `cnb:semitones-per-staff-space` is emitted as `axisUnitsPerStaffSpace` under an axis (handoff §4.1); §5.4c — semitone numbering under the hook (Configurator semitone = engine semitone); new §5.4d — explicit `cnb:keysig-tonic-octave` under an axis, Configurator octave numbering, no −1 offset (handoff §4.2); §6.3 — the landed x-offset mechanism and the corrected cause of the 013 §3.4 absorption (handoff §3). Linear output unchanged. |
| 1.3 | Jul 12, 2026 | Adopted as canonical by set 014 (pitch-axis implementation) session 1: the 1.3-draft renamed from `docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md` into `docs/`, content unchanged except this status/adoption header. The §8a fail-loud gate is in effect until set 014 session 3 verifies E13-1/E13-2 from the engine repo's handoff record. |
| 1.3-draft | Jul 10, 2026 | Pitch-axis export surface (set 013 design, DRAFT): compiled `cnb:get-pitch-staff-position` procedure (half-staff-spaces, midpoint anchored at staff position 0) and axis-formula `cnb:staff-line-positions` with collapse dedup (§5.4); `axisUnitsPerStaffSpace` substitution in attachment (§4.4a) and thickness (§5.3a) conversions; optional Section C `(x-offset . N)` field, axis-gated, nonzero-only, in the grouping key (§6.3); pitch-axis validation and the fail-loud interim gate (§8/§8a). All emissions gated on `pitchAxis.enabled`; disabled output byte-identical to v1.2.1. |
| 1.2.1 | Jul 5, 2026 | (canonical for the base format — see `CNB-LY-EXPORT-SPEC-v1_2.md`) |
