# Gallery reproduction report

**Session set:** `011-gallery-reproduction-suite`
**Started:** session 1 (2026-07-07)
**Inputs:** the feasibility matrix's feed-forward lists
(`feasibility-matrix.md` §6), the characterization catalog (`catalog.md`),
and — for per-system correction at UAT — the operator's authoritative
per-pitch-class reference (`docs/research/gallery-config.xlsx`, codes in
`gallery-config-notes.txt`). Where the reference and the catalog disagree,
the fixtures follow the reference (it is the task owner's UAT ground truth);
the differences are called out in the fidelity notes.
**Fixtures:** `cnb/assets/examples/gallery/*.json`
**Mechanical gate:** `cnb/tests/check-gallery-examples.js` (each fixture
validates, resolves noteheads for all 12 pitch classes across its defined
durations, and exports a `.ly` without error).

---

## IP framing (binding rule 1, per `docs/planning/project-plan.md` §5)

Every fixture here is a **reproduction study** of a published system,
authored from that system's public gallery description and image only. No
code is ported from any system's own implementation. Each fixture's `meta`
records the system name, creator, year, and source URL, and is framed
"reproduction study — inspired by …"; none claims the platform generates,
or is endorsed by, the original system. Gallery images are compared
against, never copied into this repo.

Fidelity is **recorded, not overclaimed** (binding rule 3): each note
states what matches the published system, what approximates it and how,
and what is omitted. A recorded deviation is acceptable; an unrecorded one
found at UAT is a defect.

---

## Session 1 roster — Tier 1, firm (8 systems)

Coverage is checkable against the feasibility matrix's session-1
feed-forward list (`feasibility-matrix.md` §6). All eight entries have a
fixture below.

| # (catalog) | System (creator, year) | Fixture slug | Source URL |
|---|---|---|---|
| 11 | Ambros System (August Ambros, 1883) | `ambros-system` | https://musicnotation.org/system/ambros-system-by-august-ambros/ |
| 13 | Notagraph (Constance Virtue, 1933) | `notagraph` | https://musicnotation.org/system/notagraph-by-constance-virtue/ |
| 18 | Numbered Notes, Notes-Only (Jason MacCoy, 2009) | `numbered-notes-notes-only` | https://musicnotation.org/system/numbered-notes-notes-only-by-jason-maccoy/ |
| 21 | Hass Notation, 3-Line Version (Peter Hass, 2014) | `hass-notation-3-line` | https://musicnotation.org/system/hass-notation-3-line-version/ |
| 25 | Untitled (Arnold Schoenberg, 1924) | `schoenberg-untitled` | https://musicnotation.org/system/untitled-by-arnold-schoenberg/ |
| 31 | AxLoMaFi (Jai Park, 2014) | `axlomafi` | https://musicnotation.org/system/axlomafi-jai-park/ |
| 53 | Avique Notation (Anne and Bill Collins, 1974) | `avique-notation` | https://musicnotation.org/system/avique-notation-by-anne-and-bill-collins/ |
| 54 | 0-5-7 Notation (Richard Parncutt, 1984) | `0-5-7-notation` | https://musicnotation.org/system/0-5-7-notation-by-richard-parncutt/ |

**Rendering-model note (applies to every fixture below).** The platform's
preview renders each pitch class as an **octave-chord card** (the same
pitch class in two adjacent octaves), laid out as a chromatic row — not as
a linear ascending scale the way the gallery images present these systems.
This is the platform's native view (Architecture Plan Module 9/10), not a
per-system choice; the staff geometry, line styling, ledger placement, and
notehead assignment are what each fidelity note claims a match on. Where a
gallery image shows single stemless scale noteheads and the preview shows
stemmed octave-chord crotchets, that is this inherent model difference,
recorded once here.

**Duration note.** All eight catalog records give
`duration.representation = traditional` or leave it `unknown` on a
standardized single-duration scale image; every fixture keeps the
platform's default four traditional durations (crotchet/minim/semibreve/
breve) and the previews are captured at crotchet. No system in this roster
encodes duration in a way the platform cannot express.

**Notehead-height note (operator UAT correction).** The operator's
reference records that notehead height "in most cases is equal to two
semitones"; every fixture's notehead shape is set to `semitoneHeight: 2.0`
(overriding the default shape's 2.724) so the previews render at the
reference height.

**Line-style note.** The reference distinguishes smaller dashes (`SD1`),
larger ledger-length dashes (`SD2`), and dotted lines (`SD0`). The
platform's staff-line `style` vocabulary is `solid | dashed | dotted`, so
both `SD1` and `SD2` reproduce as `dashed` (dash length is not a config
dimension) and `SD0` would be `dotted`. This is a recorded approximation
wherever a fixture uses a dashed line.

---

## Per-system fidelity notes

### 11 — Ambros System (`ambros-system`)

- **Matches.** Whole-step 6-line staff, per-octave pattern `[0,2,4,6,8,10]`
  (lines C, D, E, F#, G#, A#). Per the operator reference, the lower three
  lines C/D/E are **solid** and the upper three F#/G#/A# are **dashed**
  (`lineOverrides` set `style: "dashed"` on within-octave positions 6, 8,
  10). Uniform solid oval noteheads at 2-semitone height; traditional
  duration ("Traditional rhythmic notation is used"). Monochrome.
- **Correction from catalog.** The catalog described the dashed/solid
  lines as *alternating* (dashed D/F#/A#). The operator reference has them
  grouped — solid C/D/E, dashed F#/G#/A# — and the fixture follows the
  reference.
- **Approximations.** The reference's larger ledger-length dash (`SD2`)
  reproduces as the platform's standard `dashed` style (see the line-style
  note).
- **Omissions.** Ledger behavior is `unknown` in the catalog (the scale
  stays inside the two-octave staff), so no ledger templates are defined;
  every chromatic pitch lands on a line or in a whole-step space, so none
  are needed for the previewed range.

### 13 — Notagraph (`notagraph`)

- **Matches.** Whole-step 6-line staff `[0,2,4,6,8,10]` with the middle F#
  line dashed (`lineOverrides` `style: "dashed"` on position 6), matching
  "dashed middle line F#". C lines are drawn like the other solid lines
  (octave-markers `none-observed`) — no bold/override on C. Uniform solid
  oval noteheads; traditional duration; monochrome.
- **Approximations.** None beyond the rendering-model note.
- **Omissions.** Ledger behavior `unknown`; no templates defined (the
  whole-step pattern covers every chromatic pitch on a line or space).

### 18 — Numbered Notes, Notes-Only (`numbered-notes-notes-only`)

- **Matches.** Minor-third staff with three lines at E/G/A# (`[4,7,10]`)
  and C# on a ledger (override template at within-octave position 1) — the
  same staff as the Numbers-Only sibling (19) and Hass Notation (21).
  Uniform solid oval noteheads at 2-semitone height (the Notes-Only version
  omits the numeral glyphs of its Numbers-Only sibling); traditional
  duration; monochrome.
- **Correction from catalog / resolved anchor.** The catalog left the
  staff-pattern anchor `unknown` and described a 4-line staff; the operator
  reference resolves it to the 3-line E/G/A# + C# ledger staff (identical
  to the reference's Numbers-Only and Hass rows), and the fixture follows
  the reference. The earlier `[1,4,7,10]` 4-line assumption is withdrawn.
- **Omissions.** None beyond the rendering-model note.

### 21 — Hass Notation, 3-Line Version (`hass-notation-3-line`)

- **Matches.** Minor-third 3-line staff `[4,7,10]` (E, G, A#) with C# on a
  ledger (override template at within-octave position 1, so C# renders on a
  ledger in both octave groups across the 6-semitone grouping gap).
  Notehead shapes assigned **by pitch-class set** to the three
  diminished-7th chords, mirroring the catalog: ovals on the on-line set
  `{1,4,7,10}`, and the two space-position sets get up-triangles
  (`{2,5,8,11}`) and down-triangles (`{0,3,6,9}`). Traditional duration
  (solid heads). Monochrome. Stems are horizontally **centred** on the
  head (custom anchors with x = 0), per "stems are horizontally centred on
  noteheads rather than left/right".
- **Approximations.** The triangle glyphs are simple geometric triangles
  authored here, not traced from Hass's published shapes; the up/down
  assignment between the two non-oval dim-7th sets is a choice (the catalog
  does not fix which space set is which triangle). New pitch names O/S/V/I
  are nomenclature only and are not rendered (correctly — they are not
  notation glyphs).
- **Omissions.** None beyond the above.

### 25 — Untitled (Arnold Schoenberg) (`schoenberg-untitled`)

- **Matches.** Major-third 3-line staff `[0,4,8]` (C, E, G#) with the C
  lines **bold** (`lineOverrides` `thicknessPct: 40`, doubling the default
  20%), matching "when the staff extends beyond one octave the C line is
  made bold" and the octave-cue line-marking. On-line notes C/E/G# are
  plain ovals; the three inter-line elevations carry, per the operator
  reference's shape set (`o, /o, phi, o/`), a slash on the **left** (`/o`,
  `{1,5,9}`), **through the centre** (`phi`, `{2,6,10}`), and on the
  **right** (`o/`, `{3,7,11}`), baked into per-pitch-class oval variants.
  Traditional duration; monochrome.
- **Correction from catalog.** The catalog read the elevation marks as
  below/through/above (vertical); the operator reference specifies
  left/through/right, and the fixture follows the reference.
- **Approximations.** The slash geometry is an approximation of the
  published marks: each variant is the oval plus a short slash that
  protrudes beyond the head (so it reads on a solid crotchet) on the left,
  through the centre, or on the right. The mapping of the three positions
  to the three chromatic in-gap elevations (ascending) is the fixture's
  reading of the reference's ordered shape set.
- **Omissions.** Ledgers are not shown or discussed in the sources; none
  defined.

### 31 — AxLoMaFi (`axlomafi`)

- **Matches.** Major-third 2-line staff `[4,8]` (E, G#) with middle C on a
  ledger (override template at within-octave position 0, giving the
  mid-gap C ledger of the Beyreuther/Clairnote family). Binary 6-6 scheme
  by notehead **orientation**: one whole-tone set `{0,2,4,6,8,10}` slants
  up-right, the other `{1,3,5,7,9,11}` slants up-left ("one whole-tone
  scale's noteheads slant upward to the right, the other's upward to the
  left"). Traditional duration; all-solid heads; stems centred (x = 0
  anchors, per "stems attach to the horizontal center of the notehead").
  Monochrome baseline.
- **Approximations.** The slanted heads are the default oval sheared ±0.5,
  an approximation of Park's slanted glyphs. Which whole-tone set slants
  which way is a choice (the catalog does not fix the assignment). The
  optional per-pitch-class coloring is an optional feature and is not
  applied (monochrome baseline).
- **Omissions.** None beyond the above.

### 53 — Avique Notation (`avique-notation`)

- **Matches.** 7-5 line pattern `[0,4,5,7,9,11]` — lines on the white-key
  notes C, E, F, G, A, B, with the narrower E–F and B–C line gaps (1
  semitone) exactly half the others, reproduced by the pitch-proportional
  grid; D on a mid-staff ledger (override template at position 2); black
  keys sit in spaces. Uniform oval noteheads; traditional duration;
  monochrome.
- **Approximations.** `semitonesPerStaffSpace` is set to 1 (fully
  pitch-proportional) since the 7-5 line spacing has no single nominal
  staff-space; this affects only the LilyPond geometry export, not the
  preview.
- **Omissions.** None.

### 54 — 0-5-7 Notation (`0-5-7-notation`)

- **Matches.** 7-5 line pattern with the three fully-drawn staff lines on
  C, F, G (`[0,5,7]` — the "0-5-7" name) and D, E, A, B on ledger lines
  (override templates at positions 2, 4, 9, 11); black keys sit in spaces;
  pitch-proportional spacing (C–F and G–C gaps of 5 semitones, F–G of 2).
  Uniform oval noteheads; traditional duration; monochrome.
- **Approximations.** `semitonesPerStaffSpace = 1` as for Avique
  (proportional, export-geometry only).
- **Omissions.** None.

---

## Known stylistic deviations (session 1)

These were raised by the operator at UAT on the corrected package. The
fixtures reproduce each system's **structure** (staff geometry, line
styling category, ledger placement, notehead assignment); the items below
are stylistic-polish deviations, recorded per binding rule 3.

- **Dashed staff-line dash length (platform gap).** The reference
  distinguishes smaller dashes (`SD1`) from larger ledger-length dashes
  (`SD2`); the operator noted the rendered dashes are "not long enough" in
  some cases (Ambros `SD2`). The preview staff-line renderer
  (`cnb-staff-line.js`) hard-codes `stroke-dasharray "8,4"` for `dashed`
  (and `"2,4"` for `dotted`) — there is no per-line dash-length or
  dash-pattern config field. Reproducing the dash-length distinction, or
  longer dashes, needs a **configurable staff-line dash pattern**, a
  platform enhancement. Per this set's non-goals (a target needing a new
  feature is recorded as a gap, not implemented here), this is logged as a
  candidate enhancement for the feasibility/enhancement track rather than
  built in this set.
- **Shaped-notehead glyph fidelity (asset task).** The systems with
  non-oval noteheads — Hass (up/down triangles), AxLoMaFi (slanted ovals),
  Schoenberg (slash-marked ovals) — use geometric SVG paths authored inline
  in the fixtures, not glyphs traced from the published systems. The
  platform already supports importing arbitrary notehead SVGs (Module 16),
  so this is an **asset-authoring quality** matter, not a platform gap:
  polished glyph SVGs can replace the inline approximations without any
  code change. Deferred as a follow-on asset task.

## UAT outcomes (session 1)

Recorded after the human side-by-side comparison against the operator's
per-pitch-class reference (`s1-uat.md` has the package description and the
operator's verbatim round-1 and round-2 attestations). The operator
reviewed a corrected package (after the round-1 mistakes were fixed) and
attested **acceptable-with-noted-deviations** for all eight, electing to
close session 1 with the two stylistic items (dash length, glyph assets)
deferred per the "Known stylistic deviations" section above.

| # | System | UAT outcome |
|---|---|---|
| 11 | Ambros System | acceptable-with-noted-deviations (dash length deferred) |
| 13 | Notagraph | acceptable-with-noted-deviations |
| 18 | Numbered Notes, Notes-Only | acceptable-with-noted-deviations (staff corrected at UAT) |
| 21 | Hass Notation, 3-Line | acceptable-with-noted-deviations (glyph assets deferred) |
| 25 | Untitled (Schoenberg) | acceptable-with-noted-deviations (glyph assets deferred) |
| 31 | AxLoMaFi | acceptable-with-noted-deviations (glyph assets deferred) |
| 53 | Avique Notation | acceptable-with-noted-deviations |
| 54 | 0-5-7 Notation | acceptable-with-noted-deviations |

_(Session 2 extends this report with the Tier-2 fixtures, documented
Tier-3 partials, and the full per-system summary table.)_
