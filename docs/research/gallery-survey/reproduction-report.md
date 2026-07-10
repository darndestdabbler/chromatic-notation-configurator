# Gallery reproduction report

**Session set:** `011-gallery-reproduction-suite`
**Started:** session 1 (2026-07-07)
**Inputs:** the feasibility matrix's feed-forward lists
(`feasibility-matrix.md` §6), the characterization catalog (`catalog.md`),
and — for per-system correction at UAT — the operator's authoritative
per-pitch-class reference (`docs/research/gallery-config.xlsx`, codes in
`gallery-config-notes.txt`), which at session-2 UAT gained an
**`Effective Ledger Rules`** column (per-system `{"at":[…],"for":[…]}` JSON for
ledger placement/triggering) and a **`My General Ledger Rule Sufficient?`**
column. Where the reference and the catalog disagree, the fixtures follow the
reference (it is the task owner's UAT ground truth); the differences are called
out in the fidelity notes.
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

---

## Session 2 roster — Tier 2 firm (8) + documented Tier-3 partial (1)

Coverage is checkable against the feasibility matrix's session-2
feed-forward list (`feasibility-matrix.md` §6). All nine entries have a
fixture below. Session-2 fixtures follow the same operator per-pitch-class
reference (`gallery-config.xlsx`) as session 1 — reconciled per-PC before
authoring — plus the two auxiliary-device capabilities that landed since
session 1: **custom clefs (set 009)** and **custom key signatures (set
010)**, exercised where the system uses them.

| # (catalog) | System (creator, year) | Tier | Fixture slug | Source URL |
|---|---|---|---|---|
| 20 | Lautus Notation (Bruce Allen Dickey, 2011) | 2 | `lautus-notation` | https://musicnotation.org/system/lautus-notation-by-bruce-allen-dickey/ |
| 22 | Trilinear Notation (José A. Sotorrio, 2017) | 2 | `trilinear-notation` | https://musicnotation.org/system/trilinear-notation-jose-sotorrio/ |
| 27 | Clairnote SN (Paul Morris, 2018) | 2 | `clairnote-sn` | https://musicnotation.org/system/clairnote-sn-paul-morris/ |
| 29 | Clairnote DN (Paul Morris, 2006) | 2 | `clairnote-dn` | https://musicnotation.org/system/clairnote-dn-by-paul-morris/ |
| 30 | Chromatic Lyre Notation (Jan Braunstein, 2009) | 2 | `chromatic-lyre-notation` | https://musicnotation.org/system/chromatic-lyre-notation-by-jan-braunstein/ |
| 43 | Express Stave: Pianoforte Notation (John Keller, 2010) | 2 | `express-stave-pianoforte` | https://musicnotation.org/system/express-stave-by-john-keller/ |
| 44 | Express Stave, 6-6 Jazz Font (John Keller, 2009) | 2 | `express-stave-jazz-6-6` | https://musicnotation.org/system/express-stave-6-6-jazz-font-by-john-keller/ |
| 45 | Express Stave, Original Version (John Keller, 2005) | 2 | `express-stave-original` | https://musicnotation.org/system/express-stave-original-version-by-john-keller/ |
| 7 | 6-6 Trigram Notation (Richard Parncutt, 1990) | 3 (partial) | `6-6-trigram-notation` | https://musicnotation.org/system/6-6-trigram-notation-by-richard-parncutt/ |

The **rendering-model**, **duration**, **notehead-height (2-semitone)**,
and **line-style** notes from session 1 (above) apply to every session-2
fixture as well. Two capabilities are exercised for the first time here:

- **Clef (set 009).** Where a system uses a clef/register device, the
  fixture enables the clef in the platform's **register-label (text)
  mode** — a numeral (Lautus's octave number) or the marked line's letter
  (Keller's "D clef", the alto/"C" clef). This reserves the clef gutter
  and positions the label on the semitone grid. Reproducing each system's
  published clef **glyph shape** is deferred as an asset (the set-009
  glyph-import pipeline supports it), the same asset-quality deferral
  session 1 recorded for shaped noteheads. Systems whose clef form the
  sources do not show (Clairnote SN/DN's "alternative clefs") get **no
  clef** — an unseen glyph cannot be reproduced — recorded as an omission.
- **Key signature (set 010).** Clairnote SN and DN are the only session-2
  systems with custom key signatures (E2). Each enables the platform's
  **notehead-chords signature** — the set-010 device, itself *inspired by*
  Clairnote DN's stacked signatures (design CC BY-SA 4.0; no code ported
  from `clairnote.ly`). The fixture's marks resolve through the same
  notehead rules as the staff notes, so DN's binary-6-6 fill carries into
  its signature. This **follows Clairnote's stacked-signature layout
  design; it is not identical** to Clairnote's specific accidental-sign
  signatures (the platform renders the key's full scale as a stacked-chord
  mark). The UAT preview shows each fixture's first key definition (G
  major).

### Enhancement-dependency deviations (session 2)

Three of the eight Tier-2 systems name a device the platform still lacks
(E3 stem-system durations, E4 accidental marks — neither implemented at
reproduction time). Per the set's non-goal (a target needing a new
feature is recorded as a gap, not built), each is reproduced with the
device documented as a deviation:

- **E3 — stem-system duration devices** (Lautus, Trilinear, Clairnote DN):
  Lautus's half/whole/breve multi-stem marks, Trilinear's
  direction-dependent half-note tick, and Clairnote DN's double-stem half
  notes all live in the stem system, which has no per-duration
  configuration. The previews render at crotchet (single duration), so the
  device is out of frame; it is named in each fidelity note.
- **E4 — accidental marks** (Clairnote SN, DN): the "alternative
  accidental signs" have no config surface. Fully-chromatic placement
  makes them redundant for the previewed scale; named as an omission.

### Ledger rules — the operator's `Effective Ledger Rules` reference

At session-2 UAT the operator added two authoritative columns to
`gallery-config.xlsx`: **`Effective Ledger Rules`** — a per-system
`[{"at":[…],"for":[…]}]` JSON where `at` is the pitch class(es) the ledger
line is drawn on and `for` is the pitch classes that trigger it — and **`My
General Ledger Rule Sufficient?`** (whether the general proximity rule
"a ledger shows at every semitone closer to a displayed notehead's vertical
middle than the nearest staff line" alone determines the ledgers). Every
fixture's ledgers were re-derived from the `at`/`for` JSON as override
templates (`at` → `semiWithinOctave`, `for` → `triggerPCs`); override mode
reproduces the operator's explicit `for` set deterministically, independent
of the platform's strict-`<` proximity tie-breaking. This reference **is
ground truth** where it and the catalog/earlier assumptions disagree.

Three **session-1** fixtures were corrected by the same rule, an
operator-directed scope expansion recorded in the spec's scope note:
**Hass** (`[{"at":["C#"],"for":["C","C#"]}]`) and **Numbered-Notes, Notes-Only**
(`[{"at":["C#"],"for":["C","C#","D"]}]`) — the ledger sits on the **C#**
position, shown for the surrounding notes; and **AxLoMaFi**
(`[{"at":["C"],"for":["C","C#"]}]`, B trimmed — see gap A below). The session-1
fidelity notes above were amended accordingly.

### Platform-feature gaps discovered at session-2 UAT

The session-2 reproductions surfaced four platform limitations. Per the set's
non-goals (a target needing a new feature is documented as a gap and the
feasibility matrix flagged, not implemented here), each is recorded below and,
where it re-tiers a target, cross-referenced to a `feasibility-matrix.md`
correction note. The operator reviewed all four and **elected to close the set
with them documented** (`s2-uat.md` round 4).

- **Gap A — ledger octave-region rule.** The platform's ledger display
  (`cnb-ledger-set.js` `resolve` + `cnb-music.js` `ledgerOctaveRegion`) keys
  octave regions to **C boundaries** (`floor(semi/12)`), and its
  `isBetweenNoteAndStaff` test checks only for a staff line *beyond* the
  ledger, never one *between* the note and the ledger. So a note just below a
  C-boundary (A#, B) can only trigger the **lower** C ledger — across an
  intervening staff line — and cannot reach the upper C ledger it visually
  approaches. The operator's proposed remedy ("suppress a ledger when a staff
  line intervenes between it and the closest note") is the missing enhancement.
  **In-scope handling:** the A#/B triggers were trimmed from the C ledger of
  **Clairnote SN** (→ `{C,C#,D}`), **Clairnote DN** and **Chromatic Lyre**
  (→ `{C,C#}`), and **AxLoMaFi** (→ `{C,C#}`), so no *wrong* ledger renders;
  the ledgers the operator's rule places at those notes are simply not shown.
- **Gap B — bounded staff extent (invariant I4).** The three **Express Stave**
  systems have a **bounded** three-line staff (exactly G#, D, G# over one
  octave) with the register-repeated D drawn as a ledger a tritone beyond it
  (and a ledger just above the upper C), plus a partial vertical compression
  (C touching the D line from below, E from above, etc.). The platform's
  `staff.semitonePattern` is per-octave-periodic (invariant I4) and full-height,
  so it renders the continuous repeating `[2,8]` grid instead. The operator
  confirmed the true geometry and that the spreadsheet may be insufficient to
  encode it. **Feasibility-matrix correction:** records 43–45 were tiered
  "Tier 2 (E1 only)"; they additionally break **I4** — see the matrix
  correction note.
- **Gap C — notehead vertical offset / top-alignment.** In **Hass**, pairs of
  chromatically adjacent noteheads (D&D#, F&F#, G#&A, B&C) are drawn
  top-aligned; the platform positions every semitone at its own full-height
  grid row, with no per-notehead vertical-offset config. The operator
  suggested a "vertical offset vector" config — a new feature.
- **Gap D — polished glyph SVG assets.** The geometric approximations authored
  inline (Trilinear X/◁, the Jazz flat oval, AxLoMaFi/Jazz slants, the session-1
  triangles/slashes) are asset-quality, not platform, matters — the Module 16
  importer already accepts arbitrary notehead SVGs. Deferred as a follow-on
  asset task (carried from session 1).

---

## Per-system fidelity notes (session 2)

### 20 — Lautus Notation (`lautus-notation`)

- **Matches.** Minor-third 4-line staff at G#/B/D/F (`[2,5,8,11]`) with the
  **F line bold** (`lineOverrides` `thicknessPct: 40` on within-octave
  position 5), per the operator reference; uniform **all-solid** oval
  noteheads at 2-semitone height; monochrome. The staff is the continuous
  cross-octave form (no octave gap), which is exactly the platform's
  per-octave expansion.
- **Clef (E1).** "In place of a clef, a large Arabic numeral indicates the
  octave number" — exercised via the register-label clef showing "4". The
  numeral-clef **glyph shape** is deferred as an asset.
- **Deviations.** Dickey's stem-system duration devices (half = stem +
  half-height neighbour stem, whole = double stem, breve = triple stem,
  stem-like rests) need the unimplemented **E3** enhancement; the
  crotchet preview does not show them (documented). The reference marks no
  ledgers (Dickey's single-octave-plus-ledgers layout is a recommended
  variant, not the depicted continuous staff), so no ledger templates.

### 22 — Trilinear Notation (`trilinear-notation`)

- **Matches.** Minor-third 3-line staff at E/G/A# (`[4,7,10]`) with a **C#
  ledger** shown for `{C, C#}` (operator effective-ledger rule) — the same
  staff as Hass/Numbered-Notes. Three notehead glyphs cycle by diminished-7th
  set in the operator's **x/circle/triangle** sequence: **X** on the
  below-line set `{0,3,6,9}`, an **always-hollow real circle** (O — a ring,
  not a conventional oval, corrected at UAT) on the on-line set `{1,4,7,10}`,
  and **left-pointing ◁ triangles** on the above-line set `{2,5,8,11}`.
  Monochrome; fill is glyph-intrinsic (`other`).
- **Approximations.** The X and ◁ glyphs are geometric approximations
  authored here (not traced from Sotorrio's published font); the circle and
  the sequence follow the operator reference (gap D — polished glyph assets
  deferred).
- **Deviations.** Duration is stem-flag-only with a **direction-dependent
  half-note tick** (on the side opposite the conventional stem) — an
  **E3** device with no config surface; the crotchet preview does not show
  it (documented). The Tri-Chromatic colored variant is not reproduced
  (the base version is the target).

### 27 — Clairnote SN (`clairnote-sn`)

- **Matches.** Major-third 2-line staff at E/G# (`[4,8]`); the **internal
  floating ledgers** for D/F#/A# plus the C ledger are override templates at
  positions 0, 2, 6, 10. The C ledger is shown for `{C, C#, D}`; the operator's
  rule also lists A#/B, but those are trimmed (**gap A** — they would render at
  the wrong lower C). Uniform duration-carrying ovals; monochrome.
- **Key signature (E2).** Clairnote's alternative key signatures are
  exercised via the platform's notehead-chords signature (set 010). This
  **follows** Clairnote DN's stacked-signature layout design but is **not
  identical** to Clairnote's accidental-sign signatures — the platform
  renders the key's full scale (G major in the preview) as a stacked-chord
  mark. Inspired by, no code ported from, `clairnote.ly` (CC BY-SA 4.0).
- **Omissions / deviations.** Clairnote's alternative **clef** form is not
  shown in the sources, so no clef is authored (omission — an unseen glyph
  cannot be reproduced). The alternative **accidental signs** need the
  unimplemented **E4** enhancement (omission). The staff's vertical
  compression (≈1.3× vs the platform's proportional spacing) is a
  display/`semitonesPerStaffSpace` matter not tuned here.

### 29 — Clairnote DN (`clairnote-dn`)

- **Matches.** Major-third 2-line staff at E/G# (`[4,8]`) with a C ledger
  shown for `{C, C#}` (operator rule lists `{B,C,C#}`; B trimmed — **gap A**).
  **Binary-6-6 fill**: the line-side whole-tone set `{0,2,4,6,8,10}` solid, the
  other set hollow (per the reference's `S,H` and "solid notes on the lines").
  Monochrome. The signature's marks inherit this fill through the shared
  notehead rules.
- **Key signature (E2).** As Clairnote SN — the notehead-chords signature
  follows Clairnote's stacked-signature design, not identical (preview key
  G major).
- **Omissions / deviations.** Custom **clef** (form not shown → omitted),
  **double-stem half notes** (**E3**, unimplemented), alternative
  **accidental signs** (**E4**, unimplemented), and the ≈1.3× vertical
  compression are documented deviations.

### 30 — Chromatic Lyre Notation (`chromatic-lyre-notation`)

- **Matches.** Major-third 2-line staff at E/G# (`[4,8]`) with a C ledger
  shown for `{C, C#}` (operator rule lists `{B,C,C#}`; B trimmed — **gap A**).
  **Binary-6-6 fill INVERTED** relative to Clairnote/Beyreuther — the
  line-side whole-tone set `{0,2,4,6,8,10}` **hollow**, the other set solid
  (per the reference's `H,S`; designed so handwritten solid dots don't blend
  into the lines). This is the correct inverse of Clairnote DN's `S,H`; the
  operator flagged the direction at round 2 and confirmed it stays as-is at
  round 4 (flipping it would make DN and Lyre identical). Monochrome.
- **Clef (E1).** The traditional **alto clef** (with incorporated
  8va/8vb/15va/15vb register variants) is exercised via the register-label
  clef showing "C" (the alto clef marks middle C). The alto-clef **glyph
  shape** and the embedded register variants are deferred as assets.
- **Deviations.** The duration devices (stemless half notes; whole /
  double-whole notes carrying a vertical side line) are notehead-baked
  marks the platform *can* express (matrix M4c) but are not built into this
  single-duration crotchet preview (documented).

### 43 — Express Stave: Pianoforte Notation (`express-stave-pianoforte`)

- **Matches.** Tritone 2-line staff at D/G# (`[2,8]`); **inverse-7-5 fill**
  — the seven naturals `{0,2,4,5,7,9,11}` solid, the five black-key notes
  `{1,3,6,8,10}` hollow (per the reference's `S,H`). B and F sit midway
  touching neither line (spaces; the reference's `G` "gap" codes at F and B
  are informational, not config elements). Monochrome.
- **Clef (E1).** Keller's custom **D clef** is exercised via the
  register-label clef showing "D"; the published clef glyph and the
  piano-symbol line identifier are deferred as assets.
- **Deviation — bounded staff (gap B, feasibility-matrix correction).** The
  operator confirmed at UAT that Express Stave has a **bounded** three-line
  staff — exactly G#, D, G# over one octave — with the register-repeated D
  drawn as a **ledger a tritone beyond** the staff, a ledger just above the
  upper C, and a partial vertical compression (C touching the D line from
  below, F# the G# line from below, E the D line from above, A# the G# line
  from above). The platform's `staff.semitonePattern` is per-octave-periodic
  (invariant **I4**) and full-height, so it renders the **continuous `[2,8]`
  grid** (D and G# as staff lines every octave) instead — same line pitch
  classes, no bounded extent, no touching compression. The matrix tiered
  records 43–45 "Tier 2 (E1 only)"; the corrected verdict is **Tier 2 with an
  additional I4 break** — see the matrix correction note. Half/whole-note side
  strokes (duration `other`, notehead-baked) are also not in the crotchet
  preview.

### 44 — Express Stave, 6-6 Jazz Font (`express-stave-jazz-6-6`)

- **Matches.** Same tritone D/G# staff and inverse-7-5 solid/hollow fill as
  the Pianoforte version, with an added **6-6 pattern via notehead slant**:
  one whole-tone set slanted, the other flat/upright (reference shape set
  `Slant, Flat`). The two dimensions are independent cumulative rules —
  shape by whole-tone set, hollow by 7-5 set.
- **Approximation.** The slant glyph is the default oval sheared 0.5, and the
  **flat** set uses a distinct flat (horizontal) oval glyph (corrected at UAT —
  originally a conventional oval; resized to match the slant footprint). Both
  are geometric approximations; a polished flat-oval SVG is deferred (**gap D**).
- **Clef (E1).** Keller's custom **D clef** via the register-label clef
  ("D"); glyph shape deferred.
- **Deviations.** Same **bounded-staff / I4** deviation as the Pianoforte
  fixture (**gap B**); half/whole side strokes not in the crotchet preview.

### 45 — Express Stave, Original Version (`express-stave-original`)

- **Matches.** Same tritone D/G# staff, with **DIRECT 7-5 fill** (the
  reverse of the Pianoforte version) — the seven naturals **hollow/white**,
  the five black-key notes **solid**, resembling piano tablature (per the
  reference's `H,S`). Monochrome.
- **Clef (E1).** This version used the three traditional clefs as register
  indicators; the middle (alto/C) register is exercised via the
  register-label clef showing "C"; the traditional clef glyphs are deferred
  as assets.
- **Omissions / deviations.** The optional **B/F centre dash/spot**
  (internal glyph) is an optional identification device and is not rendered
  (omission). Same **bounded-staff / I4** deviation (**gap B**) and uncaptured
  half/whole side strokes as the other Express Stave fixtures.

### 7 — 6-6 Trigram Notation (`6-6-trigram-notation`) — Tier-3 partial

- **Matches (reproducible core).** Three staff lines per octave on the
  black-key group F#/G#/A# (`[6,8,10]`); C, D, E render on ledger lines. Per
  the operator effective-ledger rule (`{"at":["C","D","E"],
  "for":["C","C#","D","D#","E"]}`, `sufficient=0`) the three templates at
  positions 0, 2, 4 are each triggered by the full `{0,1,2,3,4}` span, so any
  note in the C–E band shows the **grouped stack of three** ledgers — which is
  the system's signature look, and it **does render** for notes within the
  staff span (a staff line lies on each side). Uniform ovals; monochrome.
- **Named gap (Tier-3), refined.** The `sufficient=0` flag is correct: the
  general proximity rule would show only the ledgers nearest each note, not the
  full group — the override `for` list restores the grouping. The residual
  gap is narrow: the platform's display rule shows a ledger only *between a
  note and the nearest staff line* (M3), so at the **extreme edge of the
  rendered range**, where a C/D/E ledger has **no staff line beyond it**, the
  far-side member is dropped. Every configured element is representable and the
  rendered pitches are identical (a display-fidelity partial — Tier 3, not an
  invariant break; `feasibility-matrix.md` §3, M3;
  `enhancement-requirements.md` "Observed gaps NOT cataloged"). Reproducing the
  group at the very range boundary would need the same display-rule change as
  gap A, outside this set's non-goals.

---

## Full per-system summary table (both sessions)

The direct evidence base for set 012's capability claims: every
reproduction target across both sessions, its tier, fixture status, UAT
outcome, and the noted deviations/gaps. All outcomes are
**acceptable-with-noted-deviations** (session-1 per `s1-uat.md`, session-2 per
`s2-uat.md` round 4 — the operator elected to close with the platform-feature
gaps A–D documented). Gap keys: **A** ledger octave-region rule, **B** bounded
staff (I4), **C** notehead vertical offset, **D** polished glyph SVG assets.

| # | System | Tier | Fixture | UAT outcome | Noted deviations / gaps |
|---|---|---|---|---|---|
| 11 | Ambros System | 1 | `ambros-system` | acceptable-w/-noted-deviations | dashed-line dash length (platform gap); octave-chord model |
| 13 | Notagraph | 1 | `notagraph` | acceptable-w/-noted-deviations | octave-chord model |
| 18 | Numbered Notes, Notes-Only | 1 | `numbered-notes-notes-only` | acceptable-w/-noted-deviations | staff anchor pinned from reference; ledger corrected to C# for {C,C#,D} at s2 UAT |
| 21 | Hass Notation, 3-Line | 1 | `hass-notation-3-line` | acceptable-w/-noted-deviations | geometric triangle glyphs (D); ledger corrected to C# for {C,C#} at s2 UAT; notehead top-alignment (C) |
| 25 | Untitled (Schoenberg) | 1 | `schoenberg-untitled` | acceptable-w/-noted-deviations | approximate slash geometry (D) |
| 31 | AxLoMaFi | 1 | `axlomafi` | acceptable-w/-noted-deviations | slant glyphs mirrored + fixed at s2 UAT (D); C ledger {C,C#}, B trimmed (A) |
| 53 | Avique Notation | 1 | `avique-notation` | acceptable-w/-noted-deviations | proportional `sps=1` (export geometry) |
| 54 | 0-5-7 Notation | 1 | `0-5-7-notation` | acceptable-w/-noted-deviations | proportional `sps=1` (export geometry) |
| 20 | Lautus Notation | 2 | `lautus-notation` | acceptable-w/-noted-deviations | E3 multi-stem durations; numeral-clef glyph (D) |
| 22 | Trilinear Notation | 2 | `trilinear-notation` | acceptable-w/-noted-deviations | E3 direction-dependent half tick; X/◁ glyphs (D); ledger at C# for {C,C#} |
| 27 | Clairnote SN | 2 | `clairnote-sn` | acceptable-w/-noted-deviations | keysig follows-not-identical; clef unseen (omitted); E4; C ledger A#/B trimmed (A) |
| 29 | Clairnote DN | 2 | `clairnote-dn` | acceptable-w/-noted-deviations | keysig follows-not-identical; clef omitted; E3; E4; C ledger B trimmed (A) |
| 30 | Chromatic Lyre Notation | 2 | `chromatic-lyre-notation` | acceptable-w/-noted-deviations | alto-clef glyph (D); notehead-baked durations not in preview; C ledger B trimmed (A) |
| 43 | Express Stave: Pianoforte | 2 | `express-stave-pianoforte` | acceptable-w/-noted-deviations | **bounded staff / I4 (B, matrix correction)**; D-clef glyph (D) |
| 44 | Express Stave, 6-6 Jazz Font | 2 | `express-stave-jazz-6-6` | acceptable-w/-noted-deviations | **I4 (B)**; flat-oval + slant glyphs (D) |
| 45 | Express Stave, Original Version | 2 | `express-stave-original` | acceptable-w/-noted-deviations | **I4 (B)**; optional B/F dot omitted; traditional-clef glyphs (D) |
| 7 | 6-6 Trigram Notation | 3 | `6-6-trigram-notation` | acceptable-w/-noted-deviations | grouped ledgers render within span; far-side member dropped only at range edge (A) |

**Coverage check.** Both feasibility-matrix feed-forward lists are fully
covered: session-1 Tier-1 firm (8/8), session-2 Tier-2 firm (8/8), and the one
documented Tier-3 partial (7). Every target's expressible core was reproduced;
each named dependency was recorded as a deviation rather than forcing a
fixture. **One matrix correction resulted:** records 43–45 (Express Stave) were
tiered "Tier 2 (E1 only)" but additionally break invariant I4 (bounded staff) —
flagged in `feasibility-matrix.md` per the set's non-goal that a target proving
to need a feature is corrected, not force-fit. Four platform-feature gaps
(A–D) were surfaced and documented for the enhancement track / set 012.

## UAT outcomes (session 2)

Recorded after the human side-by-side comparison against the operator's
per-pitch-class reference and the new `Effective Ledger Rules` column
(`s2-uat.md` has the package description and the operator's verbatim four-round
attestation). The session ran as a four-round product collaboration; two rounds
included authoritative spreadsheet updates (treated as operative product
direction) and one added the `Effective Ledger Rules` / `My General Ledger Rule
Sufficient?` columns. The operator reviewed the round-4 corrected package and
attested **acceptable-with-noted-deviations for all nine** systems, electing to
**close the set** with the four platform-feature gaps (A ledger octave-region
rule, B bounded staff / I4, C notehead vertical offset, D polished glyph
assets) documented above and the Express Stave (43–45) I4 break flagged as a
feasibility-matrix correction — per the set's non-goal that a target needing a
new feature is documented, not implemented. No unrecorded deviation remains.

| # | System | UAT outcome |
|---|---|---|
| 20 | Lautus Notation | acceptable-with-noted-deviations |
| 22 | Trilinear Notation | acceptable-with-noted-deviations |
| 27 | Clairnote SN | acceptable-with-noted-deviations |
| 29 | Clairnote DN | acceptable-with-noted-deviations |
| 30 | Chromatic Lyre Notation | acceptable-with-noted-deviations |
| 43 | Express Stave: Pianoforte | acceptable-with-noted-deviations (I4 matrix correction) |
| 44 | Express Stave, 6-6 Jazz Font | acceptable-with-noted-deviations (I4 matrix correction) |
| 45 | Express Stave, Original Version | acceptable-with-noted-deviations (I4 matrix correction) |
| 7 | 6-6 Trigram Notation | acceptable-with-noted-deviations |

_(The session-1 fixtures Hass, Numbered-Notes, and AxLoMaFi were also
corrected at this UAT under the operator's new ledger rule — an
operator-directed scope expansion recorded in the spec scope note.)_

## Strategic note — full-gallery support (operator direction, 2026-07-09)

The task owner's standing goal, recorded at session-2 close: **the platform
should eventually support the entire gallery, not only the reproducible
subset.** Full support is a community-adoption lever — being able to render
every catalogued system (including the Tier-4 families) makes it far easier to
get buy-in from the notation-reform community that owns these designs. This
reframes the platform-feature gaps surfaced here (gaps A–D) and the standing
invariants (I1 vertical orientation, I2 compact staff, I3 duration geometry,
I4 bounded staff, I5 movable-Do) as a **prioritized capability roadmap toward
100% gallery coverage**, not a fixed boundary. The feasibility matrix's Tier-4
verdicts (`feasibility-matrix.md` §5–7) reflect *current* invariants, not
merit; each names the specific invariant a future set would relax. Set 012's
playbook should carry this full-coverage ambition and use the tier/gap
inventory here as the ordered feature backlog.
