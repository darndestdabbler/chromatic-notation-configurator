# Pitch Axis (I2 relaxation) — Design Specification

**Date:** 2026-07-10
**Status:** Design specification — **no code**. Produced by session 2 of
`docs/session-sets/013-pitch-axis-engine-discovery/` for operator review;
implementation is deferred to a subsequent set contingent on the operator's
authorization (spec step 6).
**Inputs (authoritative):**
- The cross-provider design consult
  [`pitch-axis-design-consult.md`](pitch-axis-design-consult.md) and GPT's
  verbatim recommendation
  [`pitch-axis-design-recommendation.md`](pitch-axis-design-recommendation.md)
  — per the set's binding rule 4, this design follows the consult synthesis;
  every departure is named in §6.
- Session 1's engine-capability discovery record
  [`../session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md`](../session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md)
  — **GO** for vertical-placement feasibility, hook unit contract, chord
  x-offset evidence (E13-2), in-gap ledger parity note, fail-loud rule.
- The invariant being relaxed:
  [`../research/gallery-survey/feasibility-matrix.md`](../research/gallery-survey/feasibility-matrix.md)
  §1 **I2** ("One pitch per vertical grid position"), broken by records
  32–40 (the Twinline family, 9 systems).
**Companion:** [`CNB-LY-EXPORT-SPEC-v1_3-draft.md`](CNB-LY-EXPORT-SPEC-v1_3-draft.md)
(the export-format draft, produced alongside — the canonical
`CNB-LY-EXPORT-SPEC-v1_2.md` is **not** amended by this set).

---

## 0. Design constraints (from the set spec, restated)

1. **Engine-first:** session 1 returned **GO**, scoped to vertical-placement
   feasibility; chord-internal horizontal arrangement is engine work item
   E13-2 (a design input here, not a blocker).
2. **No product code in this set.** This document specifies; it changes
   nothing.
3. **Default-off is byte-identical.** A config without an enabled
   `pitchAxis` must produce byte-identical preview DOM and `.ly` output to
   today, enforced by *keeping the literal old code path*, not by
   re-deriving equivalent numbers (§1.3, §2.2).
4. **The design follows the consult**; deviations are named with reasons
   (§6).

---

## 1. The `pitchAxis` config section

### 1.1 Schema

A new **optional** top-level section, sitting between `staff` and `ledgers`
in the config object (geometry-adjacent; the architecture plan is amended by
the implementation set only, per the set's non-goals):

```javascript
pitchAxis: {
  // Master gate. false (or the whole section absent) = today's linear
  // behavior, byte-identical (§1.3).
  enabled: true,

  // Version tag for the map model. Single-value vocabulary, the extension
  // point for future axis kinds; validation rejects unknown values and
  // consumers treat an unknown kind as inactive (the set-010 style/rule
  // vocabulary pattern).
  kind: "pitch-class-map-v1",

  // Axis positions advance by this much per octave. 12 pitch classes on 7
  // positions (Twinline-like) → 7. Linear behavior would be 12.
  octaveStride: 7,

  // The unit contract (§1.2): how many axis units make one LilyPond
  // staff space. Ties the abstract axis unit to both the preview's pixel
  // scale and the exporter's staff-space conversions.
  axisUnitsPerStaffSpace: 2,

  // The explicit pitch-class → position map. Exactly one entry per pc
  // 0–11. position is a finite number in axis units within the octave;
  // fractional values are allowed (non-uniform 1:1 axes use them).
  // The example below is the design consult's Twinline-like map: five
  // shared-position pairs (C,C♯) (D♯,E) (F,F♯) (G♯,A) (A♯,B); D and G
  // unshared — the map session 1's spike rendered and measured.
  pitchClasses: [
    { pc: 0,  position: 0 },
    { pc: 1,  position: 0 },
    { pc: 2,  position: 1 },
    { pc: 3,  position: 2 },
    { pc: 4,  position: 2 },
    { pc: 5,  position: 3 },
    { pc: 6,  position: 3 },
    { pc: 7,  position: 4 },
    { pc: 8,  position: 5 },
    { pc: 9,  position: 5 },
    { pc: 10, position: 6 },
    { pc: 11, position: 6 }
  ]
}
```

Named modes ("Twinline-ish 7-position") are **UI presets that compile into
this explicit map** (implementation-plan phase E); the core schema carries
no mode taxonomy, per the consult ("it will become a taxonomy argument").

**Position semantics.** For an integer absolute semitone `s` with
`pc = ((s % 12) + 12) % 12` and `oct = Math.floor(s / 12)` (the existing
`CNBMusic.pitchClass` / `CNBMusic.octave` arithmetic, `cnb/src/cnb-music.js`):

```
positionOfSemi(s) = pitchClasses[pc].position + oct × octaveStride
```

Session 1's spike verified this exact arithmetic on the engine side,
including negative octaves (`b` at semi −1 → position −1×7+6 = −1 → measured
at its mapped place; s1 record §3.1).

For **fractional** semitone input (the set-009 clef `anchorSemi` is a float;
the debug overlay may interpolate), `positionOfSemi` linearly interpolates
between the two adjacent integer semitones' positions. Shared positions make
the interpolation flat across the pair — well-defined everywhere.

### 1.2 The unit contract (`axisUnitsPerStaffSpace`)

This is the consult's "must be crisp" risk, pinned as **one substitution
rule**:

> **When `pitchAxis` is enabled, `axisUnitsPerStaffSpace` replaces
> `staff.semitonesPerStaffSpace` in every semitone→staff-space unit
> conversion, and `positionOfSemi` replaces identity in every semitone→grid-
> position read. Lengths expressed in semitone units are unchanged.**

Concretely:

| Quantity | Linear (today) | Axis mode |
|---|---|---|
| Grid position of semi `s` | `s` | `positionOfSemi(s)` |
| Preview px per grid unit | `display.pxPerSemi` | `display.pxPerSemi` (one **axis unit** renders at the px height one semitone renders today) |
| LilyPond staff position of `s` | `2 × (s − midpoint) / sps` | `2 × (positionOfSemi(s) − positionOfSemi(midpoint)) / axisUnitsPerStaffSpace` |
| Stem-anchor export conversion (`cnb-lilypond.js` `attachmentPoints`, ÷ sps) | ÷ `semitonesPerStaffSpace` | ÷ `axisUnitsPerStaffSpace` |
| Staff-line thickness export `(pct/100) × (1/sps)` | ÷ sps | ÷ `axisUnitsPerStaffSpace` |
| Shape preview size | `semitoneHeight × pxPerSemi` px | unchanged (a length) |
| thicknessPct-derived px (staff/ledger/stem/separator) | `(pct/100) × pxPerSemi` | unchanged (lengths) |

Why this is coherent: the preview's staff space becomes
`axisUnitsPerStaffSpace × pxPerSemi` px, so a shape of `semitoneHeight` h is
`h / axisUnitsPerStaffSpace` staff spaces tall in the preview — exactly what
the export-side ÷ `axisUnitsPerStaffSpace` anchor conversion assumes. Preview
and engraving stay on the same staff-space contract, which is the platform's
central promise.

**Degeneracy check:** with the identity map (`position(pc) = pc`,
`octaveStride = 12`) and `axisUnitsPerStaffSpace = staff.semitonesPerStaffSpace`,
every row of the table reduces to today's formula, symbol for symbol.

**Spike reproduction check:** the session-1 spike's geometry is this schema
with the §1.1 map, `octaveStride 7`, `axisUnitsPerStaffSpace 2`,
`staff.midpoint = 7` (the G of octave 0): staff lines at within-octave axis
positions {1, 3, 5} over two octaves give LilyPond positions
`2 × (p − 4) / 2 = p − 4` → `(-3 -1 1 4 6 8)` — byte-for-byte the spike's
`cnb:staff-line-positions '(-3 -1 1 4 6 8)`; middle C lands at −4 (the
spike's ANCHOR); the stem flip at LilyPond position 0 falls on G, matching
the measured f′/f♯′-up g′-down flip (s1 record §3.3). The arithmetic is
machine-checked in
[`../session-sets/013-pitch-axis-engine-discovery/s2-evidence/`](../session-sets/013-pitch-axis-engine-discovery/s2-evidence/).

**The octave anchor rule** (s1 record §3.3/§4 design input): the exported
procedure bakes `positionOfSemi(staff.midpoint)` in as the zero point, so
`staff.midpoint` always lands at LilyPond staff position 0. This is exactly
today's `staff-line-positions` convention (`2 × (S − midpoint) / sps`)
generalized — a consistency requirement, not a new mechanism — and it makes
placement clef-independent (the linear path's `middleCPosition` coupling does
not survive into the hook; the engine precedent for explicit-anchor-over-
middleCPosition is `cnb:keysig-tonic-octave`).

### 1.3 Default-off degeneracy — how byte-identity holds

- **Absent or `enabled: false` ⇒ exactly today.** Every consumer gates on
  `config.pitchAxis?.enabled === true` (and `kind` being a known value).
  On the disabled path, the **literal existing code** runs — the current
  `semiToY` body in `cnb/src/cnb-grid.js` (`(maxSemi - semi) * pxPerSemi`),
  the current `computeStaffLinePositions` in `cnb/src/cnb-lilypond.js`, the
  current ledger/stem/card arithmetic — not a new code path that computes
  equivalent numbers. This is the consult's stricter (GPT) reading, adopted
  because it protects the Kite round-trip and export-baseline pins **by
  construction**.
- **`createDefault()` does not gain a `pitchAxis` section.** The default
  config remains byte-identical to today's; the section appears in a saved
  config only when a user (or preset) creates it. This follows the consult
  verbatim ("Do not write this default into saved configs") and — deviation
  from platform precedent named — differs from sets 009/010, which added
  default-off `clef` / `keys.keySignature` sections to `createDefault()`.
  Reason: binding rule 3 makes byte-identity the governing constraint, the
  consult is this set's authoritative design input, and an absent section is
  already a fully defined state (`pitchAxis?.enabled` is falsy). Module A's
  `merge` needs no change (the section arrives whole from the partial;
  `pitchClasses` is an array, and arrays replace wholesale), and config-IO
  needs no `REPLACE_PATHS` entry (fixed-shape section, no open-keyed maps).
  The implementation set may revisit with operator approval if editor-UI
  ergonomics demand a default-off stub.
- **No new export branches for default configs**: the exporter consults
  `pitchAxis` only inside an `enabled` guard (see the v1.3 draft §5.4/§6.3).

### 1.4 Module A validation rules

All checks gated on `pitchAxis.enabled` being truthy, with the type-safe
`isPlainObject` posture of the existing clef/key-signature checks
(`cnb/src/cnb-config.js` checks 8–9): malformed sections produce errors,
never throws; a disabled or absent section adds **zero** checks (configs
predating the feature validate exactly as before).

**Errors (blocking):**

| # | Rule |
|---|---|
| PA-1 | `pitchAxis.kind` must be `"pitch-class-map-v1"` (vocabulary extends when new kinds are implemented; consumers treat unknown kinds as inactive) |
| PA-2 | `pitchAxis.pitchClasses` must be an array with exactly one entry per pitch class 0–11 (12 entries, no duplicates, no gaps); each entry a plain object with integer `pc` 0–11 and finite numeric `position` |
| PA-3 | `pitchAxis.octaveStride` must be a finite number > 0 |
| PA-4 | `pitchAxis.axisUnitsPerStaffSpace` must be a finite number > 0 |
| PA-5 | Two ledger templates whose `semiWithinOctave` values collapse onto the same axis position must not carry **conflicting** `ledgers.lineOverrides` entries (same property, different values). Identical or absent overrides are fine — the collapsed pair draws one line (§2.4). *(Spec step 1 names this rule explicitly.)* |
| PA-6 | Two `staff.semitonePattern` entries whose axis positions collapse must not carry conflicting `staff.lineOverrides` entries (same rationale; the drawn/emitted line set is deduplicated by axis position, §2.3) |
| PA-7 | `apply.xOffsetStaffSpaces` in any notehead rule must be a finite number when present (§3) |
| PA-8 | The map must be **globally non-decreasing**: `position` values non-decreasing in pc order, **and** `positions[11] ≤ positions[0] + octaveStride` (so monotonicity holds across octave boundaries too). Non-monotonic maps are **rejected** in `pitch-class-map-v1` — the grid's extent math (`maxAxisPos`, `svgHeight`, §2.2) and label layout assume monotonicity; a future `kind` may lift this. *(Promoted from warning to blocking error during session-2 verification round 1, at the verifier's suggestion.)* |

**Warnings (non-blocking):**

| # | Rule |
|---|---|
| PA-W1 | Any `position` outside `[0, octaveStride)` — octave bands overlap or interleave (still legal when PA-8 holds, e.g. a uniformly shifted map) |
| PA-W2 | *(moved to blocking error PA-8 — see above)* |
| PA-W3 | A shared-position pc pair whose resolved noteheads (at crotchet, key null) are indistinguishable — same shape, hollow, color, **and** equal `xOffsetStaffSpaces` — the notation cannot disambiguate them |
| PA-W4 | `xOffsetStaffSpaces` present in rules while `pitchAxis` is disabled/absent — the field is axis-gated (§3.2) and will be ignored |

---

## 2. The grid / coordinate contract

### 2.1 `CNBPitchAxis` — the axis gatekeeper

A new small module (implementation file `cnb/src/cnb-pitch-axis.js`,
Module A + B dependencies only), the **sole owner** of pitch→position
mapping. Semitones remain pitch **identity** everywhere; axis positions are
**geometry** only.

```javascript
CNBPitchAxis.create(config) → axis
// axis (linear degeneracy when pitchAxis is absent/disabled — but note
// §2.2: disabled grid contexts keep the literal old path and do not
// construct an axis at all):

axis.enabled                    // boolean
axis.octaveStride               // number
axis.unitsPerStaffSpace         // number

axis.positionOfSemi(semi)       // §1.1 semantics; floats interpolate
axis.regionOfSemi(semi)         // Math.floor(positionOfSemi(semi) / octaveStride)
axis.distance(aSemi, bSemi)     // Math.abs(positionOfSemi(aSemi) − positionOfSemi(bSemi))

// The many-to-one inverse — returns CANDIDATES, never a fake scalar:
axis.semisAtPosition(position, {minSemi, maxSemi})
// → number[] — every integer semitone in the range whose mapped position
//   equals `position` exactly (matching the map's declared values, no
//   float tolerance): 0 or 1 entries on a 1:1 axis, 2 on a shared position.

axis.nearestSemisForY(y, gridContext)
// → number[] — candidates at the declared axis position nearest to
//   gridContext's y. UI hit-testing that needs one answer must choose
//   from the candidates itself.
```

Linear degeneracy: identity map, stride 12, `unitsPerStaffSpace = sps` —
`positionOfSemi(s) === s`, `regionOfSemi === Math.floor(s/12)`
(= `CNBMusic.ledgerOctaveRegion` today), `distance === |a−b|`,
`semisAtPosition(p)` → `[p]` for integer p in range.

### 2.2 `CNBGrid` changes

`CNBGrid.create(config, {minSemi, maxSemi})` builds the axis context and
exposes:

- `semiToY(semi)`:
  - **disabled path (literal, untouched):** `(maxSemi - semi) * pxPerSemi`
    — the exact current body of `cnb/src/cnb-grid.js` `semiToY`;
  - **axis path:** `(maxAxisPos − axis.positionOfSemi(semi)) × pxPerAxisUnit`
    with `pxPerAxisUnit = display.pxPerSemi` (§1.2) and
    `maxAxisPos = axis.positionOfSemi(maxSemi)` — sound because PA-8
    guarantees the map is globally non-decreasing, so the range endpoint's
    position is the extreme.
- `svgHeight`: disabled — unchanged formula; axis —
  `(positionOfSemi(maxSemi) − positionOfSemi(minSemi)) × pxPerAxisUnit`.
- `yToSemi(y)`: **linear contexts only** (kept literal). In axis-enabled
  contexts the scalar inverse is *not provided* (`undefined`) — callers must
  use `yToAxis(y)` + `axis.semisAtPosition` / `axis.nearestSemisForY`. A
  fake single semitone would hide the central many-to-one fact (consult §3).
- `yToAxis(y)` (axis contexts): `maxAxisPos − y / pxPerAxisUnit`.
- `axis`: the `CNBPitchAxis` context, so composites reach the gatekeeper
  through the grid rather than importing it separately.
- `renderDebugOverlay`: axis contexts draw one line per **declared axis
  position** and label it with *all* semitones mapping there (e.g. "0,1"),
  staff positions highlighted as today.

### 2.3 Consumer inventory — the precise change each module needs

| Module | File | Change |
|---|---|---|
| 3 Staff | `cnb/src/cnb-staff.js` | `getPositions` unchanged (returns semitones — identity). `render`: y already flows through `gridContext.semiToY` so placement is automatic; add **dedup by axis position** before drawing (two pattern semitones collapsing onto one position draw one line; overrides validated compatible by PA-6, merged. On the linear path nothing collapses, so dedup is a no-op — the literal current loop must be preserved for byte-identical DOM). |
| 5 Ledger set | `cnb/src/cnb-ledger-set.js` | The largest change; §2.4. |
| 7 Double notehead | `cnb/src/cnb-double-notehead.js` | `layout()` accepts optional **per-note X offsets** (`lowerOffsetPx`, `upperOffsetPx`, default 0, additive to the existing symmetric `offsetPercent` mechanism, which is kept untouched for compatibility). Y placement is already `gridContext.semiToY` — automatic. |
| 8 Stem | `cnb/src/cnb-stem.js` | `direction()`: today averages **semitones** vs `staffMidpoint` (`avg < staffMidpoint ? "up" : "down"`). Becomes axis-position average vs `axis.positionOfSemi(staff.midpoint)`, same comparison form (tie → down, as today). Disabled path: literal current body. `geometry()` needs **no formula change** — it already takes `centerX` and `noteYPositions` from the caller; the caller passes the *offset* notehead's center (§3.3). |
| 9 Card | `cnb/src/cnb-card.js` | `resolveNotehead` result gains `xOffsetStaffSpaces` (from Module A, §3.1). `render`: computes `offsetPx = xOffsetStaffSpaces × staffSpacePx` (§1.2 table) — the octave pair shares one pc, hence one offset — passes it as both per-note offsets to Module 7 **and** adds it to the `centerX` given to `CNBStem.geometry` (stem attachment moves with the offset notehead; today's hardcoded `offsetPercent: 0` call site is where the plumbing lands). `columnWidth` widens by `|offsetPx|` so offset heads don't clip. Stem direction call passes through the grid's axis. |
| 10 Collection | `cnb/src/cnb-collection.js` | `gridRange` stays in semitones (identity — the grid maps internally). Staff background, clef gutter, key-signature gutter all flow through the grid context and follow automatically; the clef's float `anchorSemi` and any fractional placement use `positionOfSemi`'s interpolation (§1.1). |
| 22 Key signature | `cnb/src/cnb-key-signature.js` | Mark placement flows through `semiToY` (automatic). `separator.extentSemis` is a **length** → unchanged px conversion (§1.2 rule). Shared-position keys render two marks at one height — disambiguated by the same resolved `xOffsetStaffSpaces` the notehead pipeline supplies. |
| B Music | `cnb/src/cnb-music.js` | **No change.** `ledgerOctaveRegion` keeps its linear definition (its doc comment anticipated a config-dependent variant; the variant lives in `CNBPitchAxis.regionOfSemi`, not here — Module B stays config-free). |
| 11 Exporter | `cnb/src/cnb-lilypond.js` | Per the v1.3 draft: axis-gated hook emission, staff-line positions through the axis formula, ÷ `axisUnitsPerStaffSpace` substitutions, `(x-offset . N)` Section C field, fail-loud gate. Disabled path: literal current functions. |

Everything else (labels, palette, durations, config-IO, editors) consumes
semitone identity or lengths and needs nothing.

### 2.4 Ledger logic — re-metricate, keep the algorithm

`cnb/src/cnb-ledger-set.js` keeps its algorithm shape and converts inputs at
the top (the consult's plan, confirmed viable by the engine spike — the
engine's own ledger machinery consumed the compact geometry unchanged, s1
record §3.2):

- `buildDefs` — **unchanged** (defs stay semitone-identified; `triggerPCs`
  match on pitch class — identity).
- `resolve` — convert once at the top: `notePos = axis.positionOfSemi(noteSemi)`,
  `ledgerPos = axis.positionOfSemi(ld.semi)`, staff positions mapped to a
  deduplicated axis-position array. Then, keeping each predicate's exact
  form:
  - *region gate:* `axis.regionOfSemi(ld.semi) === axis.regionOfSemi(noteSemi)`
    (today: `CNBMusic.ledgerOctaveRegion` equality);
  - *override:* pc ∈ `triggerPCs` (identity — unchanged) ∧ betweenness;
  - *proximity:* `axis.distance(noteSemi, ld.semi) < min over staff of
    axis distance` — the **strict `<` tie rule is load-bearing** and kept:
    on a compact axis, shared positions and staff-line coincidences produce
    distance 0 or exact ties, and `<` is what stops them inventing extra
    ledgers (consult §5);
  - *betweenness* (`isBetweenNoteAndStaff`, axis coordinates):
    `notePos === ledgerPos` → show only if no staff line at that axis
    position; `notePos < ledgerPos` → some staff position > `ledgerPos`;
    `notePos > ledgerPos` → some staff position < `ledgerPos`.
- `resolve` returns and `render` draws **keyed by axis position**: two defs
  collapsing onto one position produce one line (style overrides guaranteed
  compatible by PA-5, merged deterministically: identical values, or the
  single defined value).
- Disabled path: the literal current semitone arithmetic (region via
  `CNBMusic.ledgerOctaveRegion`, distances via `Math.abs` of semitones) —
  no axis context is consulted at all.

**Known parity limit, carried forward (not new):** the preview's
override/proximity templates can draw ledgers inside staff gaps; the
engine's proximity rule is outside-staff-only. Session 1 measured this
divergence pre-existing on the linear axis (s1 record §3.2); the axis
reframing neither fixes nor worsens it. It stays a documented
preview↔engine ledger-richness divergence, in scope for E13-5 follow-on
observation, not for this design.

### 2.5 Stem direction

`CNBStem.direction` compares the chord's **axis-position average** against
`axis.positionOfSemi(staff.midpoint)`; `<` → up, `≥` → down (identical
comparison form to today). Combined with the §1.2 anchor rule
(midpoint ⇒ LilyPond position 0), this makes preview stem direction agree
with the engine's measured geometric flip at position 0 (s1 record §3.3) by
construction.

---

## 3. The disambiguation field: `xOffsetStaffSpaces`

### 3.1 Schema and resolution

One optional resolved property on the existing cumulative notehead rules —
no new rule system:

```javascript
{
  name: "shared-position sharps sit right",
  priority: 10,
  match: { pitchClasses: [1, 4, 6, 9, 11], durations: "all", keys: "all" },
  apply: { xOffsetStaffSpaces: 0.85 }
}
```

- **Units: staff spaces** (not notehead-width %), because LilyPond consumes
  staff-space offsets directly and a shape swap must not silently change
  the notation system (consult §4). Negative = left, positive = right,
  missing/0 = centered.
- `CNBConfig.resolveNotehead` built-in defaults gain
  `xOffsetStaffSpaces: 0`; a rule's `apply.xOffsetStaffSpaces` merges in
  priority order like every other apply field. The added default field
  changes no existing resolution outcome (nothing reads it on the disabled
  path) and no export byte (emission is axis-gated, §3.2).

The spike's value for the Twinline map was `+0.85` staff spaces on the
sharper member of each shared pair — measured to move head **and** stem
together, with spacing accounting for the moved extent (s1 record §3.4).

### 3.2 Axis-gated lifecycle (named deviation — see §6, D2)

The field is **meaningful only while `pitchAxis.enabled`**:

- Preview applies it only in axis mode.
- Export emits `(x-offset . N)` only when `pitchAxis.enabled` **and** the
  resolved value is nonzero (v1.3 draft §6.3); zero/missing emits nothing
  (missing = current engine behavior).
- PA-W4 warns when the field is set on a linear config.

Rationale: a nonzero offset emitted to a pre-E13-2 engine would be silently
ignored (`assq` lookups skip unknown alist fields) — preview-with-offset,
engrave-without — precisely the preview≠engraving drift this platform
refuses. Gating the whole lifecycle on the axis keeps the pair honest and
keeps every linear config's Section C byte-identical even after rules gain
the field.

### 3.3 Preview consequences (the code the consult flagged as missing)

- `CNBDoubleNotehead.layout()` accepts per-note X offsets (§2.3) — today it
  supports only the symmetric octave-pair `offsetPercent`.
- `CNBCard.render` currently hardcodes `offsetPercent: 0` and one `centerX`
  for stem geometry; it becomes the place that computes
  `offsetPx = xOffsetStaffSpaces × axisUnitsPerStaffSpace × pxPerSemi` and
  hands it to both the notehead pair and the stem's `centerX`, so **the stem
  attachment moves with the offset notehead** — matching the engine
  measurement (Δx_stem = Δx_head for all 26 single-note columns, s1 §3.4).
- The octave-chord card's two noteheads share one pc → one offset → one
  stem X. Mixed-offset multi-pc chords are outside the preview's current
  example surface (octave pairs only) and are exactly the engine-side E13-2
  question; the preview does not pretend to answer it.

### 3.4 The chord caveat (engine work item E13-2, restated as design input)

Session 1 measured that LilyPond's chord-internal arrangement is
diatonic-`staff-position`-derived: stencil-translation offsets are honored
for unison-treated pairs (`<c' cis'>`: +0.85 exact) but **absorbed** for
diatonic-neighbor pairs (`<gis' a'>`: separation unchanged). The engine must
therefore choose E13-2's mechanism (write mapped values into
`staff-position`, or post-layout `X-offset`), with a diatonic-second
shared-position chord as acceptance evidence. This design's export surface
(`(x-offset . N)`) is mechanism-agnostic — the field's meaning is "offset
this head by N staff spaces", and the engine owns how.

---

## 4. Export format

Specified separately in
[`CNB-LY-EXPORT-SPEC-v1_3-draft.md`](CNB-LY-EXPORT-SPEC-v1_3-draft.md)
(draft — adopted into the canonical spec only by the implementation set on
GO). Summary of the deltas, all emitted **only when `pitchAxis.enabled`**:

- **Section B** gains the compiled pitch-axis procedure
  (`cnb:get-pitch-staff-position`, half-staff-spaces, midpoint anchored at
  position 0) and computes `cnb:staff-line-positions` through the axis
  formula (deduplicated on collapse).
- **Section A4** attachment conversion divides by `axisUnitsPerStaffSpace`
  instead of `semitonesPerStaffSpace`; **B2** staff-line thickness likewise.
- **Section C** gains the optional `(x-offset . N)` field (nonzero only).
- **Fail-loud interim rule:** until the engine ships E13-1/E13-2,
  `generate()` throws on `pitchAxis.enabled` — no silent linear `.ly` is
  ever emitted for a compact config (consult §6; s1 record §5).
- Disabled/absent `pitchAxis` ⇒ output byte-identical to v1.2.1,
  field by field.

---

## 5. Implementation-program plan

### 5.1 Phases

Gated on session 1's **GO** and the operator's authorization (this set's
UAT). Phases follow the consult's merged sequencing; each phase lands with
the byte-identity pins green before the next starts.

| Phase | Scope | Owner repo | Gate to proceed |
|---|---|---|---|
| **P0 — engine hook** | E13-1 (`cnb:get-pitch-staff-position`, literal old formula on `#f` path, Kite golden baseline byte-identical) + E13-2 (`x-offset` field, chord mechanism decided with a diatonic-second acceptance render). E13-3/-4/-5 may follow. | `lilypond-chromatic-notation-base` | s1 coordination record §6 (already written). Can run **in parallel** with P1–P2. |
| **P1 — export spec adoption** | v1.3 draft reviewed → adopted as `CNB-LY-EXPORT-SPEC-v1_3.md`; architecture plan amended (`pitchAxis` section, Module inventory + CNBPitchAxis). | this repo | Operator GO (this set's UAT). |
| **P2 — CNBPitchAxis + grid** | New module + `CNBGrid` axis path. Tests: disabled output byte-identical (literal old path proven by pinning against a pre-change baseline), non-uniform 1:1 map places correctly, many-to-one inverse returns candidate arrays, fractional-semi interpolation. | this repo | P1. |
| **P3 — consumer rethread** | Staff dedup, ledger-set re-metrication (strict `<` preserved; axis-keyed rendering), stem direction, double-notehead per-note offsets, card offset+stem plumbing, collection pass-through, Module A validation (PA-1…PA-7, PA-W1…W4), `resolveNotehead` field. **All existing tests and export baselines stay byte-identical before any fixture enables the feature.** | this repo | P2. |
| **P4 — exporter + fixtures** | v1.3 emission (axis-gated), fail-loud gate until P0 lands, then: Twinline-family compact fixture(s), engine round-trip test (export → `lilypond -dbackend=svg` → harvest → measure mapped positions, the s1/007 instrument), preview↔engine parity checks. | both | P0 **and** P3. |
| **P5 — UI presets** | Preset(s) ("Twinline-like 7-position") compiling into the explicit map + offset rules; pitch-axis editor panel (enable, stride, per-pc positions, unit contract) on the Modules 12–17 editor contract. | this repo | P3 (P4 for export button behavior). |
| **P6 — re-tier** | Feasibility-matrix records 32–40 re-tiered as a dated amendment (the 008-s2 framework-change rule) once a Twinline fixture reproduces through preview **and** engine. | this repo | P4 (+P5 for authoring-path claims). |

Suggested packaging: one implementation set (`014-pitch-axis-implementation`,
tier full) of ~4 sessions — s1: P2 (+P1 adoption), s2: P3, s3: P4, s4:
P5+P6 + per-set UAT — with P0 tracked as engine-repo work items E13-1…E13-5
per the s1 coordination record, and P4 explicitly blocked on their landing.

### 5.2 Highest risks (consolidated from the consult + session 1 evidence)

1. **Chord x-offset mechanism (E13-2)** — the one measured break: diatonic-
   neighbor shared-position chords absorb stencil offsets. Bounded, engine-
   owned, acceptance-tested by a diatonic-second render. Until it lands, the
   compact feature is honest only for single-note/octave-pair surfaces
   (which is the entire preview card model).
2. **Unit-contract drift** — mitigated by the single substitution rule
   (§1.2) and its two machine-checked anchors (linear degeneracy; spike
   reproduction).
3. **Ledger parity** — preview ledger rules are richer than the engine's
   (in-gap divergence, pre-existing). The axis work must not be blamed for
   it nor silently extend it; P4's parity checks compare against the
   documented divergence list, and E13-5 owns the engine-side follow-up.
4. **Multi-voice collisions unexplored** — s1 exercised single-voice chords
   only. `NoteCollision` shifts across voices and `cnb:collision-threshold`
   semantics in axis space (shared positions make geometric distance 0
   common) are P0/E13-5 observation work before P4 claims engine parity
   beyond single voice.
5. **Monotonicity assumptions** — `maxAxisPos` derivation and label layout
   assume the map is non-decreasing, so PA-8 **rejects** non-monotonic maps
   outright in `pitch-class-map-v1` (promoted from a warning during
   session-2 verification round 1). The residual risk is future scope, not
   current correctness: if a real system ever needs an inverted axis, a new
   `kind` must specify extent/anchor/layout behavior before validation
   admits it.

### 5.3 Recommendation

**Authorize the implementation set.** Session 1's GO is render-evidenced;
the design above is consult-grounded with three named deviations (§6), all
in the strict direction; the byte-identity constraint has a construction-
level enforcement story at every layer (literal old paths, absent default
section, axis-gated emission); and the engine dependency is decomposed into
bounded, named work items with the highest-risk one (E13-2) already
measured and mechanism-scoped. The compact-staff family (9 systems, the
largest structurally-out-of-scope lineage in the gallery) becomes reachable
with no engraver rewrite.

---

## 6. Deviations from the consult (binding rule 4)

| # | Consult says | This design says | Why |
|---|---|---|---|
| D1 | GPT example carries `axisUnitsPerStaffSpace: 1` for the Twinline map | The worked example uses `2` | `2` is the geometry session 1 actually rendered and measured (staff lines 2 axis units apart = 1 staff space → `'(-3 -1 1 4 6 8)`); the field is per-config, so this is an example choice, not a schema change. A fixture wanting a more compact staff sets 1. |
| D2 | GPT: emit `(x-offset . N)` "only when nonzero **or** when pitch-axis mode is enabled" (ambiguous disjunction) | Emit only when **enabled ∧ nonzero**; preview application and the field's whole lifecycle are axis-gated (§3.2) | A nonzero offset on a linear config would preview an offset the pre-E13-2 engine silently drops — preview≠engraving drift, the exact failure the consult's own fail-loud rule exists to prevent. The stricter reading also keeps every linear config's Section C byte-identical unconditionally. |
| D3 | Consult §3: `semiToY` survives as a thin wrapper `= (maxAxis − positionOfSemi(semi)) · pxPerAxisUnit` (one formula for both modes) | Axis contexts use that formula; **disabled contexts keep the literal current body**, not the wrapper | The consult's own point 2 (GPT, adopted in the synthesis) demands the literal old path when disabled; a wrapper that computes equivalent numbers through the axis would satisfy the arithmetic but not the by-construction byte-identity guarantee. The two consult points conflict on the disabled path; the stricter one governs. |

Everything else — explicit versioned map, octave stride, unit contract,
axis-gatekeeper API with candidate-returning inverse, notehead-rule offset
field in staff-space units, ledger re-metrication with strict `<` and
axis-keyed rendering with collapse validation, axis-average stem direction,
two-repo engine decision with fail-loud interim, sequencing, and risk list —
follows the consult synthesis directly.
