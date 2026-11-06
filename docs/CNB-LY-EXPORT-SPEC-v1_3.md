# CNB LilyPond Export Format Specification — v1.3 (Pitch Axis)

**Version:** 1.3.4 (Pitch axis / I2 relaxation; engine-handoff reconciliation; path units; preview-only settings; sized shape variants)
**Date:** November 6, 2026 (1.3.4); November 3, 2026 (1.3.2, 1.3.3); October 31, 2026 (1.3.1); July 12, 2026 (1.3 adopted; drafted July 10, 2026)
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
size is unaffected.)*

Summary of additions:

| Area | v1.2.1 | v1.3 (only when `pitchAxis.enabled`) |
|---|---|---|
| Section B staff geometry | linear `cnb:staff-line-positions` formula | axis formula (§5.4a) + the compiled pitch-axis procedure (§5.4b) |
| Section A4 attachments | ÷ `staff.semitonesPerStaffSpace` | ÷ `pitchAxis.axisUnitsPerStaffSpace` (§4.4a) |
| Section B staff-line thickness | `(pct/100) × (1/sps)` | `(pct/100) × (1/axisUnitsPerStaffSpace)` (§5.3a) |
| Section C alist | — | optional `(x-offset . N)` field (§6.3) |
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

the variant's path, its hollow cutout and its four attachment points are
the shape's, with every x multiplied by `scale.x` and every y by `scale.y`.
Everything else stays the same: the §4.1b path conversion (pre-baked or
fallback, ÷ `semitonesPerStaffSpace` or ÷ `axisUnitsPerStaffSpace`) and the
§4.4 / §4.4a attachment conversion. In Section A a comment line names each
variant's size, and its definitions follow the shape's in A1–A4.

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

---

## 5. SECTION B — ADDITIONS

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

These config fields, along with ledger rules, `durations.repeatCounts` and
`palette.useCBSafe`, are **preview-only**. Key-scoped notehead rules are
also preview-only: Section C resolves with no key, and validation warns and
names each such rule. The header lists all of them in a comment.

The header's color-palette line names the palette only when Section A
registers colors taken from it. Otherwise it reads
`none (no palette colors are exported)`. Neither the header nor the A5
comment states a cb-safe mode. The score selects the accessible branch with
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
and measured (s1 record §2.1, §3.1). The stem-direction flip the engine
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
the register. (The linear path differs: there the treble clef puts
Configurator semitone 12 on middle C, which is where the set-006 −1 octave
offset of `cnb:keysig-tonic-octave` comes from. That offset does not apply
under an axis; see §5.4d.)

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

---

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

## 8. EXPORT VALIDATION — ADDITIONS

New blocking checks when `pitchAxis` is enabled (mirroring design §1.4;
numbering continues v1.2.1 §8):

8. `pitchAxis.kind` is `"pitch-class-map-v1"`.
9. `pitchAxis.pitchClasses` covers pitch classes 0–11 exactly once with
   finite numeric positions; `octaveStride` and `axisUnitsPerStaffSpace`
   are finite and > 0.
10. No two ledger templates (or staff pattern entries) that collapse onto
    one axis position carry conflicting style overrides (design PA-5/PA-6).
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
| `cnb:keysig-tonic-octave` | `#f` or integer | `#f` | Only when `pitchAxis.enabled` (§5.4d) — **new 1.3.1** |
| `cnb:semitones-per-staff-space` | Integer | `2` | Always; `pitchAxis.axisUnitsPerStaffSpace` under an axis (§5.4a) — **clarified 1.3.1** |

### Procedure Return Alist

| Field | Type | Resolves Via |
|-------|------|-------------|
| `x-offset` | Number (staff spaces), field optional | consumed directly by the notehead engraver — **new v1.3 (E13-2)** |

---

## CHANGE LOG

| Version | Date | Changes |
|---------|------|---------|
| **1.3.4** | **Nov 6, 2026** | **Sized shape variants (session 22): new §4.1c. A notehead rule's `apply.heightSemis` / `apply.widthSemis` (semitones) export as a scaled variant of the shape, `<shape>-h<H>-w<W>`, with its path, cutout and attachments scaled by width ÷ natural width and height ÷ semitoneHeight. Section C names the variant, so the size joins the grouping key. Output is unchanged for configs that set no size.** |
| 1.3.3 | Nov 3, 2026 | Preview-only settings (session 12, audit 2026-11-02 M1–M3, L2, L3): new §5.2a. `cnb:stem-thickness`, `cnb:default-staff-line-thickness` and `cnb:default-staff-line-color` are no longer emitted. The header lists the preview-only settings, names a palette only when its colors are exported, and drops the `(standard)` / `(cb-safe)` mode, as does the A5 comment. Linear output CHANGES in the header and wherever those settings were set. |
| 1.3.2 | Nov 3, 2026 | Path units (session 11, audit 2026-11-02 H2/H3): new §4.1b amends v1.2.1 §4.1 for linear and axis configs alike. Pre-baked `data-lilypond-*` paths are semitone units, Y up, emitted ÷ sps (÷ `axisUnitsPerStaffSpace` under an axis) and re-emitted from their numbers. The `svgPathToLilypond` fallback divides by `naturalHeight / semitoneHeight`, negates Y, then applies the same division. Linear output CHANGES for path data, the one exception to the v1.2.1 byte-identity rule. 1.0.0 exports with toolkit or fallback paths were mis-scaled. |
| 1.3.1 | Oct 31, 2026 | Engine-handoff reconciliation (set 014 session 3, against engine set 008's `configurator-handoff.md`): the §8a gate is lifted (E13-1/E13-2 shipped; engine round-trip in `sessions/session-003/roundtrip/`); §5.4a — `cnb:semitones-per-staff-space` is emitted as `axisUnitsPerStaffSpace` under an axis (handoff §4.1); §5.4c — semitone numbering under the hook (Configurator semitone = engine semitone); new §5.4d — explicit `cnb:keysig-tonic-octave` under an axis, Configurator octave numbering, no −1 offset (handoff §4.2); §6.3 — the landed x-offset mechanism and the corrected cause of the 013 §3.4 absorption (handoff §3). Linear output unchanged. |
| 1.3 | Jul 12, 2026 | Adopted as canonical by set 014 (pitch-axis implementation) session 1: the 1.3-draft renamed from `docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md` into `docs/`, content unchanged except this status/adoption header. The §8a fail-loud gate is in effect until set 014 session 3 verifies E13-1/E13-2 from the engine repo's handoff record. |
| 1.3-draft | Jul 10, 2026 | Pitch-axis export surface (set 013 design, DRAFT): compiled `cnb:get-pitch-staff-position` procedure (half-staff-spaces, midpoint anchored at staff position 0) and axis-formula `cnb:staff-line-positions` with collapse dedup (§5.4); `axisUnitsPerStaffSpace` substitution in attachment (§4.4a) and thickness (§5.3a) conversions; optional Section C `(x-offset . N)` field, axis-gated, nonzero-only, in the grouping key (§6.3); pitch-axis validation and the fail-loud interim gate (§8/§8a). All emissions gated on `pitchAxis.enabled`; disabled output byte-identical to v1.2.1. |
| 1.2.1 | Jul 5, 2026 | (canonical for the base format — see `CNB-LY-EXPORT-SPEC-v1_2.md`) |
