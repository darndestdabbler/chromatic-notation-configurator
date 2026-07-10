# Gallery survey — feasibility matrix

**Session set:** `008-gallery-survey-and-feasibility` (session 2)
**Date:** 2026-07-06
**Inputs:** `schema.md`, `index.md`, `catalog.md` (session 1, 54 gallery
records + supplementary record S1) — record numbers below are `catalog.md`
record numbers.
**Companion:** `enhancement-requirements.md` (the requirements catalog that
Tier-2 verdicts reference; entries cited as E1–E4).

Every catalog record receives exactly one tier verdict. Verdicts are keyed
to the catalog's **enum values only** (per `schema.md` rule 4); free-text
notes are quoted where they qualify an enum.

---

## 1. Platform invariants (confirmed against the survey)

The set spec named three candidate invariants and asked that they be
confirmed or amended against the survey evidence. All three are
confirmed, and the evidence forced **two amendments** (I4, I5 below).

**Invariant test (architectural, not prevalence-based):** a constraint is
an invariant when it is an architectural assumption of the config schema
or rendering model whose violation makes the platform's output
*structurally different* from the system — as opposed to a display rule
omitting an optional or redundant mark while the rendered notation stays
structurally identical. How many surveyed systems break a constraint is
irrelevant to invariant status; prevalence matters only for enhancement
prioritization.

- **I1 — Horizontal staff orientation.** The grid (`cnb-grid.js`) maps
  pitch to the vertical axis of a horizontal staff; there is no
  vertical-staff mode in the config schema, preview, or exporter.
  Witness field: `staff.orientation`. **Broken by 4 records** (15, 24, 50,
  51 — the Klavar family and other vertically read systems).
- **I2 — One pitch per vertical grid position.** `semiToY` assigns every
  semitone its own vertical position; compact staves where two pitches
  share a position and are disambiguated by notehead shape/side have no
  config representation. Witness fields: `staff.pitch-axis`,
  `staff.compactness`. **Broken by 9 records** (32–40 — the Twinline
  family).
- **I3 — Duration is expressed in notehead style, not glyph geometry.**
  The platform's duration devices are hollow/solid per duration
  (`durations.definitions[].defaultHollow`), distinct shape per duration
  (`representationMode: "shape"`), and repeat counts
  (`representationMode: "repeat"`). Duration encoded as the horizontal
  extent/spacing of the glyph itself (piano-roll-like) has no
  representation. Witness field: `duration.representation =
  proportional-spatial`. **Broken by 6 records** (9, 16, 23, 28, 49, S1 —
  Dodeka is the reference case, as anticipated).

**Amendments (per the spec's confirm-or-amend instruction):**

- **I4 — Per-octave staff periodicity.** `staff.semitonePattern` is
  per-octave *by construction* and expands across every octave of the
  rendered range; the config has no staff-extent concept. `schema.md`'s
  feasibility hooks already anticipated this as an invariant witness
  ("Staff expressible as a per-octave semitone pattern"). A **bounded**
  staff — a fixed span whose pattern positions continue *beyond* it as
  ledger lines (with boundary-specific styling) — renders structurally
  wrong: the platform draws full staff lines through the ledger zone,
  and a ledger template at a pattern-covered offset never fires because
  the display rule finds a staff line there first. Witness fields:
  `staff.semitone-pattern` + record notes on staff extent. **Broken by 1
  record** (14 — surfaced by the human UAT round).
- **I5 — Absolute pitch anchoring.** The config anchors
  `staff.semitonePattern`, ledger templates, and notehead rules to
  absolute pitch classes (offset 0 = pitch class C, per `schema.md`'s
  stated convention). A system whose lines denote *scale degrees from a
  movable tonic* has no representation: any single config is correct for
  exactly one key, and the system as such — one notation whose meaning
  transposes with the key — cannot be expressed. Witness: record notes
  on relative pitch axis (the `unknown` semitone pattern is
  key-dependence, not missing data). **Broken by 1 record** (42).

Both amendments pass the architectural test above: in each case the
platform's output would be structurally different from the system (extra
staff lines / wrong pitches under transposition), not merely missing an
optional mark. Every other horizontal, linear-chromatic record's
`staff.semitone-pattern` is either derivable or `unknown` only in its
anchoring pitch class (which does not affect expressibility; see method
rule M2). One narrow gap remains below invariant level and is handled as
a named Tier-3 gap (record 7, §3): it fails the architectural test
because every configured element is representable and the rendered
notation is pitch-identical — a display rule omits redundant far-side
ledger marks only.

## 2. Tier definitions

- **Tier 1 — expressible today:** the current config schema covers the
  system as characterized (staff pattern, line overrides, ledger
  templates, notehead shapes/rules, palette, duration devices).
- **Tier 2 — expressible with planned enhancements:** needs one or more
  entries from the enhancement-requirements catalog
  (`enhancement-requirements.md`, E1–E4), and nothing else.
- **Tier 3 — partially expressible:** staff/notehead core reproducible,
  one or more auxiliary devices not; the gap is named. *Documented
  amendment (added in verification round 1 of this session):* Tier 3
  also covers a named partial-**display** gap — every configured element
  representable, but a display rule renders a strict subset of the
  system's marks while the notation stays pitch-identical. Sole case:
  record 7.
- **Tier 4 — structurally out of scope:** the system breaks a platform
  invariant (I1–I5); the invariant is named. Secondary obstacles are
  noted but the invariant is decisive.

**Provisional flag (spec step 2):** a verdict is *provisional* when a
load-bearing attribute is `unknown` (or an unspecified `other`), where
*load-bearing* means: a plausible resolution of that attribute would
change the tier. Unknowns that cannot change the tier (e.g. an unknown
staff-pattern anchor — every anchoring is equally expressible) do not
trigger the flag; the verdict says so where it applies.

## 3. Classification method

Rules applied uniformly; each verdict cites the rule(s) it leans on.

- **M1 — Line variations.** `thickness`, `dashed-or-dotted`, and `colored`
  are expressible via `staff.lineOverrides` (per semitone-within-octave:
  `thicknessPct`, `style`, `color`); `grouping-gap` is inherent in the
  semitone pattern itself. Caveat: overrides key on the position *within*
  the octave, so a variation must apply to every octave's instance of that
  line — true of every bold/dashed line cataloged except record 14's
  dashed *lower* C, which differs from the same pattern position's
  in-staff instance (part of that record's I4 break).
- **M2 — Staff pattern.** Any `staff.semitone-pattern` list is
  expressible, including adjacent-semitone lines (record 53) and a single
  line per octave (record 48). An `unknown` pattern whose *structure* is
  fixed (uniform interval, known lines-per-octave) but whose anchoring
  pitch class is not, is expressible for every candidate anchor — not
  load-bearing for the tier, but flagged for set 011 (reproduction needs
  the anchor pinned). The pattern expands across **every** octave of the
  rendered range — a bounded staff span is invariant I4's subject
  (record 14), and a key-relative (movable) anchoring is invariant I5's
  (record 42).
- **M3 — Ledgers.** Ledger templates are octave-aware, carry
  per-position style overrides, and have no outside-staff gate — so
  `modified` usages with fixed in-staff/mid-gap ledger positions (records
  4, 26, 41, 48, 52, 54 …) are expressible via `override` triggers. The
  display rule shows a ledger only *between the note and the nearest
  staff line* (or at the note); a ledger stack on the far side of the
  note (record 7) is **not** expressible.
- **M4 — Duration devices.**
  - (a) `traditional` → expressible today (`defaultHollow` + engine
    stems/flags/dots).
  - (b) distinct notehead shape per duration → expressible today
    (`representationMode: "shape"`).
  - (c) direction-independent marks attached to the notehead (symmetric
    side strokes, line-through) → expressible today by baking the mark
    into a per-duration shape variant's path.
  - (d) stem-system devices — double/auxiliary/hooked stems, novel flags,
    custom rest glyphs — and direction-dependent marks → not expressible
    today; cataloged as enhancement E3.
  - (e) `proportional-spatial` → I3 break → Tier 4.
  - `unknown` (or unspecified `other`) → load-bearing (a resolution to
    (e) or (d) would re-tier) → provisional flag.
- **M5 — Noteheads.** Shapes are arbitrary imported paths, assigned by
  cumulative per-pitch-class rules with hollow and color — so uniform,
  binary-6-6, by-pc-set, and per-pc-distinct schemes (including numeral
  or slash-marked glyphs baked into per-PC shape variants) are
  expressible; multi-color-by-pc via the palette.
- **M6 — Auxiliary devices.** No clef, key-signature, accidental-glyph,
  or octave-numeral rendering exists today → cataloged enhancements
  E1 (clefs / register devices), E2 (key signatures), E4 (accidental
  marks). Octave cues of kind `line-marking` (bold/dashed recurring
  line) are expressible today via M1 and are *not* an enhancement need.

## 4. The matrix

| # | System (creator) | Tier | Provisional | Justification |
|---|---|---|---|---|
| 1 | Untitled (Heinrich Richter) | 1 | yes | Staff `[2,4,6,8,10]` with grouping-gap, conventional ledgers, uniform monochrome heads — all covered (M1–M3, M5). Provisional: `duration.representation = unknown` (a proportional resolution would re-tier to 4; M4). |
| 2 | Untitled (Grace Frix) | 2 | yes | Core as record 1 with pattern `[0,4,6,8,10]`; the Δ custom-symbol clef needs E1 (M6). Provisional: `duration.representation = unknown`. |
| 3 | C-Symmetrical Semitone Notation (Ronald Sadlier) | 1 | yes | As record 1 plus heavier 2nd/4th lines — `lineOverrides` thickness (M1). Provisional: `duration.representation = unknown`. |
| 4 | Notation Godjevatz (Velizar Godjevatz) | 2 | yes | Staff `[0,2,4,8,10]` with optional-bold C lines (M1) and the mid-staff F# ledger via an override template (M3) are covered; the documented (optional) traditional key signature and accidentals need E2 and E4 (M6). Provisional: `duration.representation = unknown`. |
| 5 | A-B Chromatic Notation (Albert Brennink) | 1 | yes | Staff `[0,6,8,10]`, conventional ledgers in the tritone gap, uniform heads — covered (M2, M3, M5). Provisional: `duration.representation = unknown`. |
| 6 | 6-6 Tetragram (Richard Parncutt) | 1 | yes | Staff `[5,7,9,11]` with C#/D# ledger templates — covered (M2, M3). Provisional: `duration.representation = unknown`. |
| 7 | 6-6 Trigram Notation (Richard Parncutt) | 3 | yes | Staff `[6,8,10]` and heads are covered, but the `modified` ledger behavior — C, D, E ledgers rendered as a group of three even on the far side of the note — exceeds the between-note-and-staff display rule (M3): a ledger below a note with no staff line below it will not render. Gap named: grouped far-side ledger display. Provisional: `duration.representation = unknown`. |
| 8 | Untitled (Klaus Lieber) | 1 | yes | Whole-step staff `[0,2,4,6,8,10]` with bold C lines via `lineOverrides` (M1; the bold line is octave-cyclic), no ledgers. Provisional: `duration.representation = unknown`. |
| 9 | Notation for the System of Equal Tones (Gustave Decher) | 4 | no | `duration.representation = proportional-spatial` (beat-compartment subdivision) breaks **I3** (M4e). The staff/notehead core (`[1,3,5,7,9,11]`, bold A lines) would otherwise be Tier 1. |
| 10 | Untitled (Franz Grassl) | 1 | yes | Staff `[1,3,5,7,9,11]` with dashed C#/D# lines via `lineOverrides` style (M1); 7-5 hollow/solid fill via per-PC hollow rules (M5). Provisional: `duration.representation = unknown`. |
| 11 | Ambros System (August Ambros) | 1 | no | Alternating solid/dashed lines `[0,2,4,6,8,10]` (M1), uniform heads, `duration.representation = traditional` (M4a). `ledgers.usage = unknown` is not load-bearing: every closed ledger value is expressible (M3). |
| 12 | Douzave System (John Leon Acheson) | 1 | yes | Bold C + dashed F# via `lineOverrides` (M1) on `[0,2,4,6,8,10]`. Provisional: `duration.representation = unknown` (and `fill-scheme = unknown`, same resolution). |
| 13 | Notagraph (Constance Virtue) | 1 | no | Whole-step staff `[0,2,4,6,8,10]` with dashed F# (M1); both C boundary lines fall out of the per-octave pattern over the rendered range. `duration.representation = traditional` (M4a). |
| 14 | Note for Note (Walter H. Thelwall) | 4 | no | The **bounded** ~1.5-octave 7-line staff, whose same whole-step pattern positions continue *below* it as ledger lines down to a dashed C, breaks **I4** (per-octave staff periodicity): the platform would draw full staff lines through the ledger zone and cannot style the boundary C apart from the in-staff C. First flagged by the operator at UAT ("there isn't a repeating sequence [of] lines and ledgers across octaves"); the continuous-grid core (whole-step pattern, bold middle C, traditional duration) would otherwise be Tier 1. |
| 15 | Proportional Chromatic Musical Notation (Henri Carcelle) | 4 | no | `staff.orientation = vertical` breaks **I1**. |
| 16 | Isomorph Notation (Tadeusz Wójcik) | 4 | no | `duration.representation = proportional-spatial` breaks **I3** (M4e). Core (`[2,6,8,10]`, heavy D line, binary-6-6 fill) would otherwise be expressible. |
| 17 | DA Notation (Rich Reed) | 1 | yes | Staff `[0,4,6,8]` with heavy C lines (M1), binary-6-6 fill via per-PC hollow rules (M5). Provisional: `duration.representation = unknown` — the record's notes state the traditional hollow-half convention cannot apply and the replacement device is unspecified (M4). |
| 18 | Numbered Notes, Notes-Only (Jason MacCoy) | 1 | no | Uniform minor-3rd 4-line staff, `duration.representation = traditional` (M4a). `staff.semitone-pattern = unknown` is only the anchoring pitch class — expressible for every candidate anchor, so not load-bearing (M2); set 011 must pin the anchor before reproduction. |
| 19 | Numbered Notes, Numbers-Only (Jason MacCoy) | 2 | yes | Numeral noteheads are per-PC-distinct shape paths (M5) on the `[4,7,10]` staff (M2, M3). Needs E3 provisionally: `duration.representation = other` with the novel half/quarter device unspecified in the sources — a notehead-baked resolution would make it Tier 1 (M4c), a stem device confirms E3 (M4d). |
| 20 | Lautus Notation (Bruce Allen Dickey) | 2 | no | Staff `[2,5,8,11]` with bold F line (M1), all-solid heads (M5) are covered — the staff as depicted is continuous across stacked octaves, which is exactly the platform's expansion model (M2). Needs E1 (octave-numeral in place of a clef; M6) and E3 (stem-count duration system: half-height neighbor stem, double/triple stems, nontraditional stem-like rests; M4d). Dickey's *recommended* single-octave-plus-ledgers variant would break I4; the verdict covers the depicted continuous form. |
| 21 | Hass Notation, 3-Line Version (Peter Hass) | 1 | no | Staff `[4,7,10]` with C# ledger template (M3); oval/triangle by-pc-set shapes with center-attached stems via shape anchors (M5). `duration.representation = traditional` (M4a). |
| 22 | Trilinear Notation (José A. Sotorrio) | 2 | no | X/O/< by-pc-set glyph shapes on `[4,7,10]` are covered (M5); whole = stemless bare glyph is covered (M4b). Needs E3: the half-note tick sits "on the opposite side from the conventional stem" — direction-dependent, so it cannot be baked into a fixed shape variant (M4d). |
| 23 | Chromatic 6-6 Notation (Johannes Beyreuther) | 4 | no | `duration.representation = proportional-spatial` breaks **I3** (M4e). Core (`[0,4,8]`, binary-6-6 fill) would otherwise be expressible. |
| 24 | 6-6 Klavar (Cornelis Pot) | 4 | no | `staff.orientation = vertical` breaks **I1**. (Duration is additionally `unknown`.) |
| 25 | Untitled (Arnold Schoenberg) | 1 | no | Staff `[0,4,8]` with bold C lines (M1); the elevation slash marks are fixed per pitch class and bake into per-PC shape variants (M5); `duration.representation = traditional` (M4a). |
| 26 | Panot Notation (George Skapski) | 1 | yes | Staff `[4,8]` — the platform's own default pattern — with the C ledger template, including its mid-gap occurrence (M3); all-solid uniform heads (M5). Provisional: `duration.representation = unknown` ("a novel rhythmic notation" — a proportional resolution would re-tier to 4; M4). |
| 27 | Clairnote SN (Paul Morris) | 2 | no | Staff `[4,8]`; the "internal" floating D/F#/A# ledgers are templates at those offsets (M3); vertical compression is a display/`semitones-per-staff-space` setting. `duration.representation = traditional` (M4a). Needs E1, E2, E4 (documented alternative clefs, key signatures, accidentals; M6) — the clef's unseen form is not load-bearing (E1 covers any glyph). |
| 28 | Untitled (Johannes Beyreuther) | 4 | no | `duration.representation = proportional-spatial` breaks **I3** (M4e). Core (`[4,8]` + mid-gap C ledger, binary-6-6 fill) would otherwise be expressible. |
| 29 | Clairnote DN (Paul Morris) | 2 | no | Staff `[4,8]` + mid-gap C ledger (M3), binary-6-6 fill (M5), compression as record 27. Needs E1, E2, E4 (documented alternative clefs/signatures/accidentals) and E3 (double-stem half notes; `duration.representation = stem-flag-only`, M4d). |
| 30 | Chromatic Lyre Notation (Jan Braunstein) | 2 | no | Staff `[4,8]` + mid-gap C ledger (M3), inverted binary-6-6 fill (M5). Duration devices are covered today: stemless half notes (`hasStem`), whole/double-whole side lines are symmetric notehead-baked marks (M4c). Needs E1 only: traditional alto clef with embedded 8va/8vb/15va/15vb register variants (M6). |
| 31 | AxLoMaFi (Jai Park) | 1 | no | Slant-orientation binary-6-6 = two shape variants by PC set, center-attached stems via anchors (M5); staff `[4,8]` + mid-gap C ledger (M3); `duration.representation = traditional` (M4a). `fill-scheme = unknown` is not load-bearing: hollow variants of the slanted shapes are expressible if they exist. Optional per-PC colors = palette (M5). |
| 32 | Chromatic Twinline (Leo de Vries) | 4 | no | `staff.pitch-axis = compact` breaks **I2** (semicircle-vs-oval disambiguation of co-located pitches). |
| 33 | Diatonic Twinline (Leo de Vries) | 4 | no | `staff.pitch-axis = compact` breaks **I2**. |
| 34 | Twinline Notation (Thomas Reed) | 4 | no | `staff.pitch-axis = compact` breaks **I2**. (Also a novel half-note flag — E3 evidence.) |
| 35 | Black Triangle Twinline (Doug Keislar) | 4 | no | `staff.pitch-axis = compact` breaks **I2**. |
| 36 | Black-Oval Twinline (Paul Morris) | 4 | no | `staff.pitch-axis = compact` breaks **I2**. (Also double-stem half notes — E3 evidence.) |
| 37 | Bilinear Notation (José A. Sotorrío) | 4 | no | `staff.pitch-axis = compact` breaks **I2**. (Also duration-varying notehead size/shape and "new register symbols" — E3/E1 evidence.) |
| 38 | TwinNote (Paul Morris) | 4 | no | `staff.pitch-axis = compact` breaks **I2**. (Also double-stem half notes — E3 evidence.) |
| 39 | TwinNote TD (Paul Morris) | 4 | no | `staff.pitch-axis = compact` breaks **I2**. |
| 40 | Chromatic Nydana (Dan Lindgren) | 4 | no | `staff.pitch-axis = compact` breaks **I2**. (Also Roman-numeral octave clef, custom key signature, hooked/novel stems — E1/E2/E3 evidence.) |
| 41 | MUTO Notation (MUTO Foundation) | 1 | yes | Staff `[0,6]` with bold C lines (M1); the fixed in-staff D/E and G#/A# ledger positions are override templates (M3). Provisional: `duration.representation = unknown`. |
| 42 | Thumline Notation (Jim Plamondon) | 4 | no | The pitch axis is **relative** — lines are scale degrees from a movable Do, so the `unknown` semitone pattern is key-dependence, not missing data — which breaks **I5** (absolute pitch anchoring): any one config is correct for exactly one key, and the system as such has no representation. The per-key geometry (whole-step grid, in-staff ledgers) would otherwise be expressible; the arc clef device and tonic/modulation signature are additional E1/E2 evidence. |
| 43 | Express Stave: Pianoforte Notation (John Keller) | 2 → **2 + I4** | no | Staff `[2,8]` with D ledger template (M3); inverse-7-5 fill via per-PC hollow rules (M5); half/whole side strokes are symmetric notehead-baked marks (M4c). Needs E1 only: custom F/B/D clef symbols (M6). **Correction (011-s2):** additionally breaks **I4** — see §8. |
| 44 | Express Stave, 6-6 Jazz Font (John Keller) | 2 → **2 + I4** | no | As record 43 plus slant alternation = two shape variants by PC set (M5). Needs E1 only (same custom clefs). **Correction (011-s2):** additionally breaks **I4** — see §8. |
| 45 | Express Stave, Original Version (John Keller) | 2 → **2 + I4** | no | As record 43; the optional B/F center dash/spot bakes into per-PC shape variants (M5). Needs E1 only — this version uses the three *traditional* clefs as register indicators, which the platform equally lacks (M6). **Correction (011-s2):** additionally breaks **I4** — see §8. |
| 46 | Express Stave, Tricolor Version (John Keller) | 2 | yes | Staff `[2,8]` (M2); the tricolor scheme is per-PC shape/fill variants — solid, hollow, and line-through heads baked per PC (M5, M4c). Needs E1 (Keller's clef symbols). Provisional: `duration.representation = unknown`. |
| 47 | Untitled (Robert Stuckey) | 1 | yes | Numeral glyphs are per-PC-distinct shape paths (M5) on staff `[0,6]` (M2). Provisional: `duration.representation = unknown` (stems documented, but flags/longer values undocumented; M4). |
| 48 | Untitled (Nicolai Dolmatov) | 1 | yes | Single C line per octave `[0]` (M2 — the multi-octave range yields the ≥2 absolute lines the validator requires); fixed E/G# ledger templates (M3); oval/x alternation = binary-6-6 shapes (M5). Provisional: `fill-scheme = unknown` with x-heads carrying no fill dimension — the half-note device is indeterminate and could require E3 (M4d). |
| 49 | Klavar, Mirck Version (Jean de Buur) | 4 | no | `duration.representation = proportional-spatial` (stem spacing = timing) breaks **I3** (M4e). The horizontal 7-5 core (`[1,3,6,8,10]`, heavier 3-line group, by-pc-set fill) would otherwise be expressible. |
| 50 | Klavar, Dekker Version (Antoon Dekker) | 4 | no | `staff.orientation = vertical` breaks **I1** (duration is additionally proportional-spatial — I3). |
| 51 | ChromaTonnetz (Joe Austin) | 4 | no | `staff.orientation = vertical` breaks **I1**. (The staff-agnostic 12-appearance triangle notehead system itself is expressible — see set-012 notes.) |
| 52 | Keyboard (7-5) Trigram Notation (Richard Parncutt) | 1 | yes | Staff `[6,8,10]` with routine mid-gap C#/D# ledger templates (M3). Provisional: `duration.representation = unknown` (and `fill-scheme = unknown`, same resolution). |
| 53 | Avique Notation (Anne and Bill Collins) | 1 | no | Pattern `[0,4,5,7,9,11]` including adjacent-semitone line pairs is directly expressible (M2); mid-staff D ledger template (M3); `duration.representation = traditional` (M4a). |
| 54 | 0-5-7 Notation (Richard Parncutt) | 1 | no | Pattern `[0,5,7]` with D/E/A/B override ledger templates at their own positions (M3); `duration.representation = traditional` (M4a). |
| S1 | Dodeka Music Notation (Jacques-Daniel Rochat) | 4 | no | `duration.representation = proportional-spatial` (horizontal size proportional to duration) breaks **I3** — the platform's known reference counterexample, confirmed. The staff core (`[0,4,8]`, uniform solid heads) is otherwise expressible. |

## 5. Tier summary

| Tier | Count | Firm | Provisional | Records |
|---|---|---|---|---|
| 1 | 21 | 8 | 13 | firm: 11, 13, 18, 21, 25, 31, 53, 54 · provisional: 1, 3, 5, 6, 8, 10, 12, 17, 26, 41, 47, 48, 52 |
| 2 | 12 | 8 | 4 | firm: 20, 22, 27, 29, 30, 43, 44, 45 · provisional: 2, 4, 19, 46 |
| 3 | 1 | 0 | 1 | provisional: 7 |
| 4 | 21 | 21 | 0 | 9, 14, 15, 16, 23, 24, 28, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 49, 50, 51, S1 |
| **Total** | **55** | 37 | 18 | 54 gallery records + S1 |

Tier 4 by invariant: **I1** (orientation): 15, 24, 50, 51 (4). **I2**
(compact): 32–40 (9). **I3** (duration geometry): 9, 16, 23, 28, 49, S1
(6). **I4** (staff periodicity): 14 (1). **I5** (absolute anchoring): 42
(1). Each record is counted under the invariant named first in its
verdict; secondary breaks are noted in the justifications (50 also breaks
I3).

Dominant provisional driver: `duration.representation = unknown` (16 of
the 18 provisional verdicts) — a direct consequence of the gallery's
standardized single-duration scale images, as the catalog preamble
records. (The other two: record 19's unspecified `other` duration device
and record 48's `fill-scheme = unknown`.)

**Operator UAT remark on these provisionals (recorded, no enum change):**
the operator reads the standardized hollow-oval scale renderings as
indicating conventional solid/hollow duration noteheads ("I believe that
the hollow noteheads indicate that conventional noteheads (solid and
hollow) are used, with hollows used for half notes"). The catalog retains
`unknown` per the spec's binding no-guessing method note (an inference
from a single-duration rendering is not a source-determined value), but
this reading makes `traditional` the *expected* resolution — which would
confirm the affected provisional Tier-1 verdicts as firm. Set 011's
per-system source work should resolve them.

## 6. Feed-forward lists for set 011 (gallery reproduction suite)

**Session 1 targets — Tier 1, firm (8):**

1. Ambros System (11)
2. Notagraph (13)
3. Numbered Notes, Notes-Only (18) — *precondition:* pin the staff-pattern
   anchor from additional sources, or document the chosen anchor as an
   assumption in the reproduction config
4. Hass Notation, 3-Line Version (21)
5. Untitled — Arnold Schoenberg (25)
6. AxLoMaFi (31)
7. Avique Notation (53)
8. 0-5-7 Notation (54)

**Session 2 targets — Tier 2 firm (8), plus documented Tier-3 partials (1):**

Tier 2 (contingent on the enhancements each verdict names; E1/E2 land in
sets 009/010, E3/E4 per `enhancement-requirements.md` recommendations —
systems whose only missing device is unimplemented at reproduction time
are reproduced with the deviation documented):

1. Lautus Notation (20) — E1, E3
2. Trilinear Notation (22) — E3
3. Clairnote SN (27) — E1, E2, E4
4. Clairnote DN (29) — E1, E2, E3, E4
5. Chromatic Lyre Notation (30) — E1
6. Express Stave: Pianoforte Notation (43) — E1
7. Express Stave, 6-6 Jazz Font (44) — E1
8. Express Stave, Original Version (45) — E1

Documented Tier-3 partials (reproduce the expressible core; document the
named gap as a known deviation):

9. 6-6 Trigram Notation (7) — gap: grouped far-side ledger display

Provisional records (tiers 1–3) join these lists only after their named
unknowns are resolved; resolving them is in scope for set 011's
per-system source work, not for this set.

## 7. Notes for set 012 (notation-builder playbook evidence)

- **The duration-geometry constraint (I3) is the most common structural
  disqualifier among horizontal linear systems** (6 records incl. Dodeka);
  in every one of those records the staff/notehead core *is* expressible
  — the playbook can present "traditional-duration adaptation of a
  proportional system" as a recurring pattern, with the deviation named.
- **The compact-staff family (I2, 9 records) is a single design lineage**
  (Twinline and descendants); supporting it would require a
  one-position/two-pitch grid concept plus side/shape disambiguation —
  out of scope by invariant, not by accident. Operator interest in
  eventually representing this family was recorded at UAT ("we should be
  able to represent this with the platform", on record 38); any such
  support means relaxing I2, a platform-level decision beyond this
  matrix's framework.
- **Decher's beat-compartment device (record 9) is the tractable end of
  I3** (operator UAT remark: "Decher's innovation (especially with
  respect to beat markings) shouldn't be discounted"). Unlike free
  piano-roll geometry (Dodeka), it is a *structured* encoding — marked
  beat compartments, N heads = N equal subdivisions — and would be the
  natural entry point if a future set ever relaxes I3. The Tier-4 verdict
  reflects current invariants, not merit.
- **ChromaTonnetz (51):** its notehead system (4 orientations × 3 fills =
  12 distinct appearances) is staff-agnostic per its own documentation
  and is expressible today on a horizontal staff — a candidate playbook
  example of porting a notehead system across staff geometries.
- **The two amended invariants each have adaptation paths** worth a
  playbook entry: Note for Note (14, I4) is directly reproducible in its
  *continuous-grid* form (the whole-step pattern with bold C is Tier-1
  material once the bounded-extent requirement is dropped), and Thumline
  (42, I5) is reproducible *per fixed key* — a per-key config family
  approximates the movable-Do system.
- **Line-marking octave cues are free:** every bold/dashed octave-cyclic
  line in the survey mapped onto `lineOverrides` with no enhancement.

## 8. Corrections from set 011 (reproduction findings)

> **Amendment (set 011, session 2, 2026-07-09).** Building the reproduction
> fixtures against the task owner's authoritative reference surfaced one tier
> correction and one method observation. Recorded here as dated amendments per
> the framework-change rule established in 008-s2 (any tier change is an
> explicit, dated, documented amendment). Full evidence:
> `docs/research/gallery-survey/reproduction-report.md` (gaps A–D and the
> per-system fidelity notes) and `docs/session-sets/011-gallery-reproduction-suite/s2-uat.md`.

- **Records 43, 44, 45 (Express Stave family) — additional I4 break.** These
  were tiered **Tier 2 (E1 only)** on the reading that the depicted staff is a
  continuous tritone `[2,8]` grid. The task owner confirmed at UAT that the
  Express Stave staff is **bounded** — exactly three lines (G#, D, G#) over one
  octave, with the register-repeated D drawn as a **ledger a tritone beyond**
  the staff (plus a ledger just above the upper C) and a partial vertical
  compression (line-adjacent notes touch their line). A bounded, register-fixed
  staff whose pattern positions continue beyond it as ledgers is exactly
  invariant **I4** (per-octave staff periodicity; the same structure as record
  14, Note for Note). The corrected verdict is **Tier 2 with an additional I4
  break**: the clef need (E1) is real, but the staff geometry is not fully
  expressible on the platform's per-octave-repeating full-height staff.
  Set 011 kept the fixtures (reproducing the fill scheme, clef, and the `[2,8]`
  line pitch classes) with the I4 deviation documented, rather than removing
  them — the expressible core is still evidence.

- **Method observation — ledger octave-region rule (not a tier change).**
  Several Tier-1/Tier-2 systems (Clairnote SN/DN, Chromatic Lyre, AxLoMaFi)
  have ledgers whose trigger notes sit just below a C-boundary (A#, B). The
  platform's ledger octave-regions align to C (`cnb-music.js`
  `ledgerOctaveRegion = floor(semi/12)`), and its between-note-and-staff test
  does not suppress a ledger when a staff line intervenes, so such a note
  renders a ledger at the wrong (lower) C. This is a **display-rule
  refinement**, below invariant level (every configured element is
  representable; the affected fixtures render cleanly once the cross-boundary
  triggers are trimmed) — it does **not** change any tier verdict. The task
  owner proposed a "suppress a ledger when a staff line intervenes between it
  and the closest note" rule; cataloged as reproduction-report gap A for the
  enhancement track.
