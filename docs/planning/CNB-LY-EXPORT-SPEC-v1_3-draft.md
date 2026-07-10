# CNB LilyPond Export Format Specification — v1.3 DRAFT (Pitch Axis)

**Version:** 1.3-draft (Pitch axis / I2 relaxation)
**Date:** July 10, 2026
**Status:** **DRAFT — not adopted.** Produced by
`docs/session-sets/013-pitch-axis-engine-discovery/` session 2 as a design
deliverable. The canonical spec remains
[`../CNB-LY-EXPORT-SPEC-v1_2.md`](../CNB-LY-EXPORT-SPEC-v1_2.md) (v1.2.1);
this draft is adopted (renamed into `docs/` as the canonical v1.3) only by
the pitch-axis **implementation set**, and only under session 1's GO and the
operator's authorization. Nothing in the exporter changes in set 013.
**Delta spec:** this document specifies **only the v1.3 additions and
substitutions**. Everything in v1.2.1 not mentioned here is unchanged.
**Companion design:** [`pitch-axis-design.md`](pitch-axis-design.md)
(schema, unit contract, consumer changes, program plan).
**Engine dependency:** engine-repo work items **E13-1** (the
`cnb:get-pitch-staff-position` hook) and **E13-2** (the `x-offset` notehead
field), per
[`../session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md`](../session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md)
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
pins enforce this.

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

### 5.3a Staff/Ledger Line Thickness under a pitch axis

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

`cnb:semitones-per-staff-space` is still emitted per v1.2.1 (Always). With
the hook set, the engine's linear placement formula no longer consumes it;
remaining engine consumers (key-signature and clef stencil placement)
migrate to the hook under engine work items E13-3/E13-4.

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
  attachment, **and x-offset** all match.
- Value formatting: the exporter's standard number formatting.
- Engine semantics (E13-2): "offset this notehead by N staff spaces
  horizontally." The mechanism (mapped `staff-position` vs post-layout
  `X-offset`) is the engine's decision; session 1 measured stencil
  translation exact for single notes and unison-treated chord pairs, and
  absorbed for diatonic-neighbor chord pairs — E13-2's acceptance evidence
  must include a diatonic-second shared-position chord (s1 record §3.4).

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

### 8a The fail-loud interim gate

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

### Procedure Return Alist

| Field | Type | Resolves Via |
|-------|------|-------------|
| `x-offset` | Number (staff spaces), field optional | consumed directly by the notehead engraver — **new v1.3 (E13-2)** |

---

## CHANGE LOG

| Version | Date | Changes |
|---------|------|---------|
| **1.3-draft** | **Jul 10, 2026** | **Pitch-axis export surface (set 013 design, DRAFT): compiled `cnb:get-pitch-staff-position` procedure (half-staff-spaces, midpoint anchored at staff position 0) and axis-formula `cnb:staff-line-positions` with collapse dedup (§5.4); `axisUnitsPerStaffSpace` substitution in attachment (§4.4a) and thickness (§5.3a) conversions; optional Section C `(x-offset . N)` field, axis-gated, nonzero-only, in the grouping key (§6.3); pitch-axis validation and the fail-loud interim gate (§8/§8a). All emissions gated on `pitchAxis.enabled`; disabled output byte-identical to v1.2.1.** |
| 1.2.1 | Jul 5, 2026 | (canonical — see `CNB-LY-EXPORT-SPEC-v1_2.md`) |
