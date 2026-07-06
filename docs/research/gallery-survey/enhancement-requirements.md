# Gallery survey — enhancement-requirements catalog

**Session set:** `008-gallery-survey-and-feasibility` (session 2)
**Date:** 2026-07-06
**Inputs:** `catalog.md` (record numbers below), `feasibility-matrix.md`
(tier verdicts; method rules M1–M6).
**Role:** this document is the **scope authority for sets 009 (custom
clefs) and 010 (custom key signatures)** and the evidence base for any
further auxiliary-device work. Every Tier-2 verdict in the feasibility
matrix depends only on entries in this catalog.

## Binding default rule (applies to every entry)

> **Each enhancement, when unconfigured/disabled, must reproduce current
> platform output exactly** — byte-identical LilyPond export and
> unchanged preview DOM for any config that does not use the new
> section. New config sections are optional; their absence (or an
> explicit disabled state) is the default; `CNBConfig.createDefault()`
> gains no active instance of any new device.

This is the design constraint the set spec fixes for all enhancements;
sets 009/010 inherit it as an acceptance criterion.

## Prevalence conventions

- **Drivers** = Tier-2/Tier-3 records whose verdict depends on the entry
  (these justify scope).
- **Additional evidence** = Tier-4 records that also exhibit the device
  (they cannot be reproduced regardless, so they count toward prevalence
  of the device in the wild but not toward scope justification).

---

## E1 — Custom clefs / register devices (scope authority for set 009)

**Prevalence — drivers (10):**

| Record | System | Device (from catalog notes) |
|---|---|---|
| 2 | Untitled (Grace Frix) | Δ (delta) symbol at D above middle C, ledger line through it |
| 20 | Lautus Notation | large Arabic numeral in place of a clef (octave number) |
| 27 | Clairnote SN | "system of alternative … clefs" (form not shown in sources) |
| 29 | Clairnote DN | "system of alternative … clefs" |
| 30 | Chromatic Lyre Notation | traditional alto clef with 8va/8vb/15va/15vb incorporated |
| 42 | Thumline Notation | arcs at staff start pointing to the Do line |
| 43 | Express Stave: Pianoforte Notation | custom F, B, D clef symbols + piano-symbol line identifier |
| 44 | Express Stave, 6-6 Jazz Font | custom F, B, D clef symbols |
| 45 | Express Stave, Original Version | traditional bass/treble/alto clefs as register indicators |
| 46 | Express Stave, Tricolor Version | Keller's clef symbols (per main Express Stave page) |

**Additional evidence (Tier 4):** 37 Bilinear Notation ("new register
symbols", form unknown), 40 Chromatic Nydana (Roman numerals identify the
octave in place of clefs).

**Scope note:** register-identification devices in the clef slot —
octave numerals/letters (`aux.clef = octave-number-or-label`) and
octave-marker glyph variants embedded in a clef (record 30) — are part of
this entry: the survey shows the clef slot and the octave-marker role are
the same device in every driver. Octave cues of kind `line-marking`
(bold/dashed recurring lines) are **excluded** — they are expressible
today via `staff.lineOverrides` (matrix rule M1).

**Requirements sketch:**

- **Config schema:** new optional `clefs` section: named clef definitions
  (same dual-format pattern as `shapes`: SVG path + pre-baked LilyPond
  path), each with an anchor (semitone position the glyph is registered
  to), horizontal placement/padding, and an optional text/numeral mode
  (render a register label instead of, or in addition to, a glyph).
  A staff-level reference selects the active clef (or none — default).
- **Preview:** render in a left gutter ahead of the first pitch column
  (Module 10 / `cnb-collection.js` layout + Module 1 grid: gutter width
  reserved only when a clef is configured), positioned via
  `semiToY(anchor)`.
- **Exporter:** Section A registration of the clef glyph path; Section B
  emit-if-set engine variables for clef selection/position (names to be
  agreed with the engine).
- **Engine coordination:** the CNB LilyPond engine currently has no
  custom-clef hook — set 009 must define the engine-side contract with
  the chromatic-notation-base repo (glyph stencil + placement) before the
  exporter emissions are fixed.
- **Default rule:** no `clefs` section / no active clef → no gutter, no
  emissions — current output exactly.

---

## E2 — Custom key signatures (scope authority for set 010)

**Prevalence — drivers (4):**

| Record | System | Device (from catalog notes) |
|---|---|---|
| 4 | Notation Godjevatz | optional traditional key signatures |
| 27 | Clairnote SN | "system of alternative … key signatures" |
| 29 | Clairnote DN | "system of alternative … key signatures" |
| 42 | Thumline Notation | tonic named in the signature + symbols for key changes and modulation distance |

**Additional evidence (Tier 4):** 40 Chromatic Nydana (single sharp/flat
with a count numeral; natural sign = C major).

**Requirements sketch:**

- **Config schema:** extend the existing stubbed `keys` section
  (`keys.enabled`, `keys.definitions`) with a signature device: per-key
  signature content (glyph refs + counts, or a tonic-label mode),
  placement after the clef gutter. Builds on the schema's anticipated
  key-awareness (`noteheadRules.match.keys`, exporter §6.2 compound
  conditions).
- **Preview:** render after the clef gutter at row start; only when
  `keys.enabled` and a signature device is configured.
- **Exporter:** Section A registration of signature glyphs; Section B/C:
  the procedure model already receives a `key` argument — signature
  *rendering* is new engine surface.
- **Engine coordination:** as E1 — engine-side stencil/placement contract
  must be agreed in set 010.
- **Default rule:** `keys.enabled: false` (current default) → current
  output exactly.

---

## E3 — Custom stem/duration marks (cataloged; recommended for a future set, not 009/010)

**Prevalence — drivers (4):**

| Record | System | Device (from catalog notes) |
|---|---|---|
| 19 | Numbered Notes, Numbers-Only | novel half/quarter distinction, device unspecified (provisional driver) |
| 20 | Lautus Notation | half = stem + half-height neighbor stem; whole = double stem; breve = triple stem; nontraditional stem-like rest marks |
| 22 | Trilinear Notation | half-note tick on the side opposite the conventional stem (direction-dependent) |
| 29 | Clairnote DN | double stem indicates half notes |

**Additional evidence (Tier 4):** 34 Twinline Notation (novel half-note
flag), 36 Black-Oval Twinline (double stem), 38 TwinNote (double stem),
40 Chromatic Nydana (hooked/novel stems + parallel rest system), 51
ChromaTonnetz (double-stemmed half notes as one rhythm option).

**Boundary (matrix rule M4):** direction-*independent* marks baked into a
per-duration notehead path (symmetric side strokes — records 30, 43–45;
line-through heads — record 46) are expressible **today** and are outside
this entry. This entry covers devices living in the *stem system*:
stem count, auxiliary/partial stems, novel flags, hooked stems,
direction-dependent marks, custom rest glyphs.

**Requirements sketch (for whichever set adopts it):**

- **Config schema:** per-duration stem device on
  `durations.definitions[]` (e.g. `stemCount`, auxiliary-stem geometry
  relative to the 4-point anchors, optional flag/rest glyph refs).
- **Preview:** Module 8 (`cnb-stem.js`) renders N stems / auxiliary
  stems from the same anchor model.
- **Exporter/engine:** per-duration stem stencil overrides — the largest
  engine-coordination item of the three; LilyPond's Stem grob must be
  overridden per duration.
- **Default rule:** device absent → single-stem current behavior exactly.

**Recommendation:** meaningful prevalence (4 drivers + 5 Tier-4
occurrences) justifies cataloging, but it is not in the 009/010 critical
path: only 3 firm Tier-2 systems (20, 22, 29) depend on it, and each can
be reproduced in set 011 with the duration deviation documented. Schedule
as its own set after 010 if set 011 elevates the priority.

---

## E4 — Custom accidental marks (cataloged; recommended to ride with set 010)

**Prevalence — drivers (3):**

| Record | System | Device (from catalog notes) |
|---|---|---|
| 4 | Notation Godjevatz | optional traditional accidentals ("both in key signatures and for accidental notes") |
| 27 | Clairnote SN | "system of alternative accidental signs" |
| 29 | Clairnote DN | "system of alternative accidental signs" |

**Additional evidence:** 36 Black-Oval Twinline (Tier 4; notehead-dot
accidental system mentioned as a possibility only).

**Requirements sketch:** accidental glyph definitions (dual-format, as
shapes) + attachment rule relative to the notehead; preview in Module
6/7; exporter Section A registration. The schema's existing
`offKeyMark` slot (notehead rules / A6 off-key mark registration) is the
natural anchor point — an accidental mark is an off-key-style attachment
with its own glyph.

**Recommendation:** below stand-alone prevalence (3 drivers, every one of
which also needs E2). Bundle into set 010's scope decision — signatures
and accidentals share glyph machinery and all three driver systems need
both. **Not** a separate set.

**Default rule:** no accidental marks configured → current output exactly.

---

## Observed gaps NOT cataloged (single-system; named in tier verdicts instead)

- **Grouped far-side ledger display** (record 7, 6-6 Trigram Notation):
  ledger stacks rendered on the far side of the note exceed the
  between-note-and-staff display rule. One system; handled as a
  documented Tier-3 partial in set 011.
- **Bounded staff extent** (record 14, Note for Note; surfaced in the
  session-2 UAT round): the platform expands `staff.semitonePattern`
  across every rendered octave, so a fixed staff span whose pattern
  positions continue as ledger lines beyond it (down to a
  differently-styled boundary line) has no representation. One driver
  system (Lautus Notation's *recommended* single-octave variant would
  also hit it, but its depicted form does not); handled as a documented
  Tier-3 partial in set 011.
- **Movable-Do (relative) pitch anchoring** (record 42, Thumline
  Notation): the config anchors `staff.semitonePattern` to absolute
  pitch classes. One system; per-key configs approximate it.

## Summary for downstream sets

| Set | Scope granted by this catalog |
|---|---|
| 009 | E1 as sketched (incl. register-label mode; excl. line-marking cues) |
| 010 | E2 as sketched; decide E4 bundling at set-010 authoring time |
| 011 | reproduction lists per `feasibility-matrix.md` §6; E3-dependent systems reproduced with documented deviation if E3 unimplemented |
| 012 | constraints evidence per `feasibility-matrix.md` §7; E3 prevalence table above |
