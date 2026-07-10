# Notation-builder playbook

**A guide for designing a chromatic notation system with the Chromatic
Notation Configurator.**

> **Audience.** A human operator who wants to design a custom chromatic
> staff-notation system — their own, or a reproduction study of a published
> one — and export it for engraving. This is the human playbook; a companion
> AI-assisted workflow guide (`ai-assisted-workflow.md`) covers where an AI
> assistant helps at specific steps.
>
> **How claims are grounded.** Every "the platform can do X" statement below
> cites the config schema, a source module, or a checked-in example fixture.
> Every "the platform cannot do X" statement cites a named *invariant* of the
> platform (Part 2) and an exemplar published system, drawn from the
> [feasibility matrix](../research/gallery-survey/feasibility-matrix.md) and
> the [reproduction report](../research/gallery-survey/reproduction-report.md)
> produced by the gallery survey (set 008) and the reproduction suite (set
> 011). The named systems are *exemplars of a limit*, not a banned list.
>
> **IP posture.** If you set out to reproduce a published system, it is a
> *reproduction study*: build from the system's public description/image,
> attribute the original in the config's `meta` fields
> (`systemName`/`systemCreator`/`systemYear`/`sourceUrl`), frame it "inspired
> by", and never port code from the system's own implementation or copy its
> gallery images into your project. This mirrors `docs/planning/project-plan.md`
> §5 and the framing every set-011 fixture uses.

---

## Part 1 — The platform model

Understanding six ideas is enough to design confidently. Everything the
editors do is a view onto one JSON config object.

### 1.1 Two inputs: the config *is the system*, example data is *what you show*

The single most important principle
([architecture plan](../CNB-ARCHITECTURE-PLAN-v2.md) §2, principle 1): every
rendering step takes **two** kinds of input.

- **Config** — the notation *system* definition: staff pattern, ledger
  templates, notehead shapes and rules, palette, durations, clef, key
  signatures. This is the JSON file you design and save. It is the single
  source of truth: the same config drives both the live preview and the
  LilyPond export.
- **Example data** — *what to render with that system*: which pitch classes,
  which duration, which key. The preview shows a chromatic row of
  octave-chord cards; the key you pick for the preview is example data, not
  part of the config (`cnb/src/cnb-collection.js` takes `options.keys[0]` as
  the shown key).

Consequence: your config does not contain "the notes of a song." It contains
the *rules* by which any note is drawn. When you later engrave real music,
the score supplies the notes and your exported config supplies the system.

### 1.2 The semitone grid

All vertical placement is by **semitone** (`cnb/src/cnb-grid.js`, Module 1).
One octave is 12 semitones (0 = C, 1 = C♯, … 11 = B; `cnb/src/cnb-music.js`).
The grid maps every semitone to its own vertical position — higher pitch,
higher on the page. Line thicknesses are expressed as a **percentage of one
semitone's height** (`thicknessPct`), so a design scales cleanly regardless of
the pixels-per-semitone zoom (`display.pxPerSemi`). This "one row per
semitone" rule is also a hard limit — see invariant **I2** in Part 2.

### 1.3 Staff pattern and stem direction

The staff is defined by `staff.semitonePattern`: the semitone offsets *within
one octave* (0–11) that carry a line. The platform's default is `[4, 8]` —
lines at E and G♯. The pattern **repeats across every octave** of the rendered
range (`cnb/src/cnb-staff.js`, `CNBStaff.getPositions`): `[4,8]` yields
absolute lines at 4, 8, 16, 20, … This per-octave periodicity is intrinsic —
and a hard limit for *bounded* staves (invariant **I4**).

- **Any number of lines at any positions.** `[0,2,4,6,8,10]` is a whole-step
  6-line staff (Ambros, `cnb/assets/examples/gallery/ambros-system.json`);
  `[6,8,10]` is a 3-line staff on the black-key group (6-6 Trigram);
  `[0,4,5,7,9,11]` even mixes adjacent-semitone line pairs (Avique).
- **`staff.midpoint`** is the absolute semitone where stem direction flips:
  chords averaging below it get up-stems (right side), at/above get down-stems
  (left side). For the default `[4,8]` with notes spanning two octaves, the
  midpoint is 12 (middle C).
- **Per-line overrides** (`staff.lineOverrides`, keyed by the
  within-octave position) set `thicknessPct`, `style`
  (`solid`/`dashed`/`dotted`), or `color` on specific lines — this is how you
  express a **bold octave-marking line** (Schoenberg's bold C) or a **dashed
  line** (Ambros's dashed F♯/G♯/A♯). Overrides apply to *every* octave's
  instance of that position (`cnb-staff.js`); a variation that must differ per
  octave is not expressible.

### 1.4 Ledger templates

Ledger lines are declared as **templates** and evaluated per set of displayed
noteheads (`cnb/src/cnb-ledger-set.js`, Module 5). Each template has a
`semiWithinOctave` (where the ledger line sits), `triggerPCs` (which pitch
classes bring it out), and a `triggerMode`:

- **`override`** — show the ledger whenever a note of a `triggerPCs` pitch
  class is displayed (subject to the display gate below).
- **`proximity`** — show the ledger when the note is strictly closer to it
  than to any staff line (with `ledgers.proximityRule` enabled).

Two properties matter:

- **The display gate** (`isBetweenNoteAndStaff`): a ledger only appears when it
  lies on the path from the note to the *nearest staff line* — above the note
  with a staff line further above, or below with a staff line further below, or
  exactly at a note that is not itself on a line. There is no "outside the
  staff" hard filter, so ledgers inside a staff *gap* are allowed.
- **Octave-awareness**: templates are octave-aware, and the octave regions are
  keyed to C (`cnb-music.js` `ledgerOctaveRegion = floor(semi/12)`). A ledger
  template in octave region 0 responds to notes in region 0, not to the same
  pitch class an octave up. This is why a note just below a C boundary (A♯, B)
  cannot be connected *upward* to the next C ledger — a documented
  display-refinement gap (Part 3, gap A).

Worked patterns you can copy: a single C ledger below a minor-third staff
(Hass, template at C♯ triggered by {C, C♯}); floating internal ledgers for
D/F♯/A♯ between staff lines (Clairnote SN); a mid-gap C ledger between octave
line-pairs (AxLoMaFi).

### 1.5 Cumulative notehead rules

Noteheads are assigned by a **priority-ordered, cumulative** rule list
(`config.noteheadRules`; resolution in `cnb/src/cnb-config.js`
`resolveNotehead`). Each rule has a `match` (`pitchClasses`, `durations`,
`keys` — each either `"all"` or an explicit list) and an `apply` block that can
set any of `shape`, `hollow`, `color`, `offKeyMark`.

Resolution walks the rules in priority order starting from defaults
`{ shape: first shape, hollow: false, color: null, offKeyMark: false }`, and
each matching rule's `apply` **merges over** the running state (only the fields
it names change). So you layer rules:

- a base rule that sets the default oval on all 12 pitch classes;
- a higher-priority rule `{ match: pitchClasses: [1,3,6,8,10], apply: hollow:
  true }` to make the black keys hollow *without* restating their shape.

This one mechanism expresses every notehead scheme in the gallery: **uniform**
(one shape everywhere), **binary 6-6** (two shapes/fills by whole-tone set —
Clairnote DN solid/hollow, AxLoMaFi slant-left/right), **by pitch-class set**
(three glyphs on the three diminished-7th sets — Hass ovals/triangles), and
**per-pitch-class-distinct** (a different baked glyph per PC — Schoenberg's
slash-marked ovals). Numeral or slash marks are just per-PC shape variants with
the mark baked into the SVG path.

### 1.6 Palette and colorblind-safe switching

`config.palette` holds up to 12 colors by pitch class, an optional CB-safe
alternative set, and Scheme symbol names for export (`cnb/ui/palette-editor.js`,
Module 12). A rule's `apply.color` of `null` means "use the palette color for
this PC"; an explicit `#RRGGBB` overrides it. On export, the platform emits a
**conditional color block** so the *same* `.ly` file renders either the primary
or the colorblind-safe palette depending on the engine flag
`cnb:use-accessible-colors` — you author both once. A monochrome design simply
leaves the palette empty (as every set-011 fixture does).

### 1.7 Duration representation

`config.durations` defines the duration set and a `representationMode`:

- **`shape`** — a distinct notehead shape (or hollow state) per duration, the
  traditional convention (solid crotchet, hollow minim). This is the default.
- **`repeat`** — repeat the same notehead N times for longer durations
  (`repeatCounts`).

Duration is carried by notehead *style*, not by glyph *geometry/spacing* — a
hard limit (invariant **I3**). Direction-*independent* marks (symmetric side
strokes, a line through the head) can be baked into a per-duration shape
variant; direction-*dependent* stem devices cannot (see Part 3).

### 1.8 Clefs (set 009) and key signatures (set 010) — optional

Both are **default-off** and, when unused, change neither the preview nor the
export.

- **Clef** (`config.clef`, `cnb/src/cnb-clef.js`, Module 20): an optional
  left-gutter glyph or **register label** (a numeral/letter rendered as text),
  positioned on the semitone grid by a per-definition `anchorSemi`. Use the
  **text** kind for octave-numeral or letter clefs (Lautus's octave numeral;
  the Express Stave register letters); the **glyph** kind imports an SVG clef
  through the same toolkit contract as noteheads.
- **Key signature** (`config.keys.keySignature`, `cnb/src/cnb-key-signature.js`,
  Module 22): renders the selected key's scale as a **notehead-chord stack**
  (the marks resolve through your notehead rules at crotchet duration, so a
  binary-6-6 fill carries into the signature), with a gold separator bar,
  after the clef gutter. It is gated on `keys.enabled &&
  keySignature.enabled` and a selected key. This device is *inspired by*
  Clairnote DN's stacked signatures; it follows that layout design but is not
  identical to any one system's signatures.

Neither clefs nor key signatures currently emit anything to the LilyPond
export — the engine renders its own dozenal clef and, for key signatures,
already engraves notehead-chord signatures from the score's `\key` through the
procedure-model config you export. So a clef- or keysig-enabled config exports
**byte-identically** to the same config with them disabled
([architecture plan](../CNB-ARCHITECTURE-PLAN-v2.md) §4.9, §4.12).

### 1.9 JSON config ↔ LilyPond export

The JSON config is the Configurator's native, round-trippable save format
(`cnb/ui/config-io.js`, Module 17). The `.ly` file is a **one-way** artifact:
the Configurator generates it (`cnb/src/cnb-lilypond.js`, Module 11), LilyPond
consumes it, and you regenerate rather than hand-edit it. The export follows
[CNB-LY-EXPORT-SPEC-v1_2.md](../CNB-LY-EXPORT-SPEC-v1_2.md): named definitions
(paths, hollows, stem attachments, the conditional color block), engine
settings (staff geometry, emit-if-changed display settings, metadata), and the
`cnb:get-notehead-config` procedure that groups pitch classes with identical
resolved configs. Two subtleties worth knowing when you read your own exports:

- Staff-line positions are emitted in **half-staff-space units**:
  `2 × (S − midpoint) / semitonesPerStaffSpace` for each absolute staff
  semitone S (LY spec §5.1).
- Stem attachment points are stored in the config in **semitone units** and
  converted to staff-space units *at export time* (÷ `semitonesPerStaffSpace`),
  because the target unit depends on the staff config, which can change after a
  shape is imported.

---

## Part 2 — What the platform can and cannot do

The Configurator reproduces a large fraction of the published chromatic-staff
gallery, but not all of it. The limits are **five architectural invariants**,
each an assumption of the config schema or rendering model whose violation
makes the output *structurally different* from the target — not merely missing
an optional mark. They were confirmed and amended against the 55-system survey
([feasibility matrix](../research/gallery-survey/feasibility-matrix.md) §1). If
your design idea hits one, the platform is the wrong tool for *that* aspect of
the design; the guidance below gives the redesign path where one exists.

Prevalence counts below are the survey's Tier-4 tallies (matrix §5).

### I1 — Horizontal staff orientation

The grid maps pitch to the **vertical** axis of a **horizontal** staff; there
is no vertical-staff mode in the schema, preview, or exporter.

- **Exemplars:** the Klavar family — Carcelle's Proportional Chromatic (record
  15), 6-6 Klavar (24), Klavar Dekker (50), ChromaTonnetz (51). *4 systems.*
- **What to do:** none within the platform — orientation is fundamental. Note
  that a vertically-read system's *notehead scheme* may still be expressible on
  a horizontal staff (ChromaTonnetz's 4-orientation × 3-fill glyphs are
  staff-agnostic); only the read direction is out of scope.

### I2 — One pitch per vertical grid position

`semiToY` gives every semitone its own row. **Compact** staves, where two
chromatic neighbors share a vertical position and are disambiguated by
notehead **shape or which side of a line** they sit on, have no config
representation.

- **Exemplars:** the Twinline family — Chromatic/Diatonic Twinline (32, 33),
  Reed Twinline (34), Black-Triangle (35), Black-Oval (36), Bilinear (37),
  TwinNote/TD (38, 39), Chromatic Nydana (40). *9 systems — the single largest
  Tier-4 lineage.*
- **What to do:** redesign to a **full-height** staff (one row per semitone).
  The shape-disambiguation idea itself (semicircle-vs-oval, triangle
  orientation) *is* expressible as a notehead scheme; you lose only the
  vertical compression.

### I3 — Duration is a notehead style, not a glyph geometry

Duration devices are hollow/solid, distinct-shape-per-duration, or
repeat-count. Duration encoded as the **horizontal extent or spacing** of the
glyph (piano-roll-like) has no representation.

- **Exemplars:** Dodeka (supplementary record S1, the reference case),
  plus Decher's beat-compartment system (9), Isomorph (16), Beyreuther 6-6
  (23) and Untitled (28), Klavar-Mirck (49). *6 systems.*
- **What to do:** adopt a **traditional-duration** version of the system — the
  staff and notehead core of every one of these is otherwise expressible.
  Present it as "traditional-duration adaptation of a proportional system,"
  with the deviation named (this is a recurring, honest reproduction pattern —
  matrix §7).

### I4 — Per-octave staff periodicity

`staff.semitonePattern` is per-octave *by construction* and expands across
every octave of the rendered range; the schema has no staff-*extent* concept. A
**bounded** staff — a fixed span (say, one octave) whose pattern positions
continue *beyond* it as ledger lines — renders structurally wrong: the platform
draws full staff lines through what should be the ledger zone.

- **Exemplars:** Thelwall's Note for Note (14), and — corrected during set 011
  — the **Express Stave** family (43, 44, 45), whose true staff is exactly
  three lines (G♯, D, G♯) over one octave with the register-repeated D drawn as
  a ledger (matrix §8; reproduction report gap B). *Note for Note + the three
  Express Stave systems.*
- **What to do:** reproduce the **continuous-grid** form (the pattern repeated
  across octaves) and document the bounded-extent deviation, as the set-011
  Express Stave fixtures do. If the bounded extent is essential to the design,
  the platform cannot express it today.

### I5 — Absolute pitch anchoring

The config anchors staff, ledgers, and rules to **absolute** pitch classes
(offset 0 = C). A system whose lines mean **scale degrees from a movable
tonic** — one notation whose pitches transpose with the key — has no single
representation: any one config is correct for exactly one key.

- **Exemplar:** Thumline (42), designed for an isomorphic instrument with a
  movable-Do axis. *1 system.*
- **What to do:** produce a **per-key config family** — one config per key —
  which approximates the movable system for any fixed key (matrix §7).

**In one line:** the platform is a *horizontal, full-height, absolute-pitch,
per-octave-periodic* chromatic staff whose duration lives in the notehead. Stay
inside those four adjectives and you can build almost anything; cross one and
you have found its edge.

---

## Part 3 — How much of the gallery this covers (the evidence)

The survey characterized 54 gallery systems plus Dodeka and gave each exactly
one tier ([feasibility matrix](../research/gallery-survey/feasibility-matrix.md)
§4–5); set 011 then built and human-reviewed a reproduction fixture for the
firm targets of Tiers 1–3
([reproduction report](../research/gallery-survey/reproduction-report.md)).

| Tier | Meaning | Count (of 55) |
|---|---|---|
| **1 — expressible today** | staff/ledger/notehead/palette/duration all covered by the current schema | 21 |
| **2 — expressible with the set-009/010 enhancements** | needs custom clefs (E1) and/or key signatures (E2), which now exist | 12 |
| **3 — partially expressible** | staff/notehead core reproducible, one auxiliary device or display detail not | 1 |
| **4 — structurally out of scope** | breaks an invariant I1–I5 | 21 |

Tier 4 by invariant: **I1** orientation 4 · **I2** compact 9 · **I3** duration
geometry 6 · **I4** bounded staff 1 (+3 Express Stave, corrected at set 011) ·
**I5** movable-Do 1.

**Reproduction outcomes (set 011).** All 17 built fixtures
(`cnb/assets/examples/gallery/`) validate, resolve noteheads for all 12 pitch
classes, and export a `.ly` without error (the repeatable gate is
`cnb/tests/check-gallery-examples.js`). Every one was human-reviewed against
the operator's authoritative per-pitch-class reference and attested
**acceptable with noted deviations** — the deviations being recorded
approximations (geometric glyph placeholders, register-label clefs, the
octave-chord preview layout), never unrecorded defects. See the reproduction
report's per-system fidelity notes for exactly what matches, what approximates,
and what is omitted for each system.

**Known display-refinement gaps (below invariant level).** Reproducing the
gallery surfaced four items that are *display refinements or asset quality*, not
structural limits — each is a candidate enhancement, none blocks a
reproduction:

- **Gap A — ledger octave-region rule.** Because ledger octave-regions align to
  C, a note just below a C boundary (A♯, B) cannot show a ledger connecting
  *upward* to the next C, and its trigger would place a ledger at the wrong
  (lower) C. Trim such triggers; the missing ledger is the gap.
- **Gap B — bounded staff extent.** The I4 case above, surfaced concretely by
  Express Stave.
- **Gap C — notehead vertical offset.** Some systems top-align chromatically
  adjacent noteheads (Hass D&D♯, F&F♯, …); there is no per-notehead
  vertical-offset config.
- **Gap D — polished glyph SVGs.** The set-011 shaped noteheads/clefs are
  geometric approximations; the Module 16 importer already accepts polished
  SVGs to replace them.

**The standing ambition.** The long-term goal is to support the *entire*
gallery, including the Tier-4 families — full coverage makes it far easier to
win community adoption. Read the tier/gap inventory above as a **prioritized
capability roadmap**, not a fixed boundary: the Tier-4 verdicts reflect
*current* invariants, not merit, and each names the specific invariant a future
enhancement would relax (reproduction report, "Strategic note — full-gallery
support").

---

## Part 4 — Build walkthrough

This section is **executable**: every step names the real editor and file as it
exists today, and the worked example is a checked-in fixture you can load and
follow. Serve the app over HTTP (`cnb/index.html`; see the
[README](../../README.md) "Getting Started") and open the editors alongside
this text.

**Worked example — Hass Notation, 3-Line (a set-011 reproduction study).**
Fixture: `cnb/assets/examples/gallery/hass-notation-3-line.json`. It is a
minor-third 3-line staff at E/G/A♯ with C♯ on a ledger, three notehead shapes
assigned by the three diminished-7th pitch-class sets, and centered stems —
enough to touch every core step below. You can load it at any point (**Config
Save/Load → Load**) to see the finished state, or build it from the default
config by following along.

Design a config in **config-composition order** — each step's output is the
next step's input.

**1. Staff pattern → stem direction.** In the **Staff/Ledger Rule Editor**
(`cnb/ui/staff-rule-editor.js`) set `semitonePattern` to `[4, 7, 10]` (lines E,
G, A♯) and `semitonesPerStaffSpace` to 3. Leave `midpoint` at 12 unless your
range or the desired stem-flip point differs. The derived panel shows the exact
LilyPond staff-line positions the export will emit. *(For a bold or dashed line,
add a `lineOverrides` entry now — e.g. Ambros sets `style: "dashed"` on
positions 6/8/10.)*

**2. Ledger templates.** Still in the Staff/Ledger editor, add one override
template: `semiWithinOctave: 1` (the C♯ position), `triggerPCs: [0, 1]`, so a C
or C♯ note brings out the ledger. Watch the preview: the ledger should appear
under C and C♯ and nowhere else. *(Beware the octave-region rule — gap A — if
you try to trigger a ledger from a note below a C boundary.)*

**3. Shape authoring / import.** Hass uses three shapes: an oval
(`crotchet-minim`, which carries a hollow cutout path) and two triangles. Real
glyphs come from the **Music Glyph Toolkit** and are brought in through the
**SVG Shape Importer** (`cnb/ui/svg-importer.js`, Module 16); the importer reads
the toolkit's `data-*` contract — `data-semitone-height`, stem-anchor
placemarkers, and pre-baked `data-lilypond-notehead`/`-hollow` path strings (see
the [README](../../README.md) end-to-end walkthrough, step 1–2). The set-011
triangles are simple geometric approximations authored inline; set
`semitoneHeight: 2` per the two-semitone notehead-height convention, and — for
center-attached stems like Hass's — anchor points with `x: 0`.

**4. Notehead rules.** In the **Notehead Rule Editor**
(`cnb/ui/notehead-rule-editor.js`, Module 14) build three cumulative rules by
pitch-class set: ovals on `{1,4,7,10}` (the on-line diminished-7th set),
up-triangles on `{2,5,8,11}`, down-triangles on `{0,3,6,9}`. Because rules are
cumulative, a later hollow- or color-only rule would layer over these without
restating the shape (§1.5).

**5. Palette.** Hass is monochrome, so leave the palette empty. For a colored
system, use the **Palette Editor** (`cnb/ui/palette-editor.js`) — every palette
you pick carries a colorblind-safe alternative that the exported file switches
to at render time (§1.6).

**6. Durations.** In **Common Properties** (`cnb/ui/common-props-editor.js`,
Module 15) confirm the duration set and `representationMode` (Hass uses the
default traditional `shape` mode).

**7. Clef / key signature (optional).** Hass has neither. If your system does,
enable the **Clef Editor** (`cnb/ui/clef-editor.js`) — e.g. a text register
label like Lautus's octave numeral — and/or the **Key Signature Editor**
(`cnb/ui/key-signature-editor.js`), whose notehead-chord signature you can see
in the Clairnote fixtures (§1.8). Both are default-off.

**8. Validate.** Run **Export**'s validation (or `CNBConfig.validate()`); it
must report no blocking errors. The checks and their meanings are in Part 5.

**9. Preview.** The **Preview Display** (`cnb/ui/preview-display.js`, Module 19)
re-renders live from the same JSON your export reads — controls choose the pitch
range, duration, and (example-data) key. Confirm the staff, ledgers, and shapes
look right across the whole chromatic row.

**10. Save JSON.** **Config Save/Load** (`cnb/ui/config-io.js`) writes the
editable design; load it back any time. Add attribution to `meta` now if this
is a reproduction study (`systemName`, `systemCreator`, `systemYear`,
`sourceUrl`, and a `reproductionStudy: true` / "inspired by" description).

**11. Export `.ly`.** **Config Export** (`cnb/ui/config-export.js`, Module 18)
validates and produces the LilyPond config file (blocking errors are listed in
the panel). This is the one-way artifact (§1.9).

**12. Render through the engine.** The render half is documented once, in the
[README end-to-end walkthrough](../../README.md#end-to-end-walkthrough-from-shape-to-rendered-score)
(steps 4–5) and the [engine
repository](https://github.com/darndestdabbler/lilypond-chromatic-notation-base) —
place the exported `.ly` next to a score that `\include`s it and run
`lilypond -dbackend=svg`. The checked-in Kite 4-369 fixtures
(`cnb/fixtures/`) are a complete worked round-trip if you want a reference that
renders pixel-identical to the engine's golden baseline.

---

## Part 5 — Troubleshooting

Common failure modes, drawn from what actually went wrong across the build and
reproduction sessions.

### Validation errors (blocking) — `CNBConfig.validate()`

The exporter refuses to run until these clear (`cnb/src/cnb-config.js`
`validate`, mirroring [LY spec](../CNB-LY-EXPORT-SPEC-v1_2.md) §8):

- **"Rule … references unknown shape X"** — a notehead rule's `apply.shape`
  names a shape that is not in `config.shapes`. Import or define the shape, or
  fix the name. (Because `shapes` is replaced wholesale on load, a fixture that
  keeps `durations.defaultShape: "crotchet-minim"` must *re-include* that shape
  even if it adds custom ones.)
- **"Rule … sets hollow:true on shape X which has no svgHollowPath"** — you
  asked for a hollow rendering of a shape with no cutout path. Add an
  `svgHollowPath`, or don't set `hollow: true` on that shape.
- **"… invalid color hex"** — every color (rule `apply.color`, palette entry,
  staff/ledger `lineDefaults.color`) must match `#RRGGBB`.
- **"Pitch class N is not covered by any notehead rule"** — all 12 pitch
  classes must be matched by at least one rule. Keep a base rule with
  `pitchClasses: "all"`.
- **"Staff pattern must have at least 2 semitone positions"** — a staff needs
  ≥2 lines. (A single-line-per-octave design still satisfies this over a
  multi-octave range, because the pattern repeats — e.g. Dolmatov's `[0]`.)
- **"meta.fileSuffix must begin with '-'"** — if you set a file suffix, start
  it with a hyphen (or leave it empty).
- **Clef/key-signature errors** appear only when those sections are *enabled*
  (an active clef must name a real glyph with a numeric `anchorSemi`; an enabled
  key signature needs `style: "notehead-chords"`, a valid placement rule, and at
  least one key definition). A default-off config never trips them.

### Rule-priority mistakes (the most common design bug)

Rules are **cumulative and last-match-wins per field**, not first-match. If a
notehead comes out with the wrong shape or fill, the usual cause is a
lower-priority rule (or the wrong `priority` value) overriding — or *failing* to
override — a higher one. Check: (a) your base rule matches `"all"` so every PC
has a shape; (b) the specific rule that should win has the higher `priority`;
(c) you only set the fields you mean to change (setting `shape` in a rule meant
only to flip `hollow` will clobber a more specific shape rule). The resolution
order is exactly `CNBConfig.resolveNotehead` walking priorities and merging
`apply` blocks (§1.5).

### Hollow noteheads only read on solid/white backgrounds

A hollow notehead is drawn as a **white overlay path on top of the filled
path** (`cnb/src/cnb-notehead.js`; noted in the project's `CLAUDE.md`). The
cutout is opaque white, so it only "reads as hollow" over a white or solid-color
background. On a patterned or dark background the white overlay shows as a white
blob, not a see-through hole. Design hollow-bearing systems for a white page,
and preview them on the white card background the app uses.

### Stem anchor / thickness consistency

Stem attachment uses a **4-point anchor model** (crotchet-up/down,
minim-up/down) whose points the glyph toolkit places assuming a stem width of
about **1/5 of a semitone (~20%)**
([architecture plan](../CNB-ARCHITECTURE-PLAN-v2.md) §4.7, Module 8). If the
preview renders stems noticeably thinner or thicker than that, the stem will
appear to attach off-center even though the anchors are correct. Keep
`display.stemThicknessPct` consistent with the toolkit's assumption. For
center-attached stems (Hass, AxLoMaFi) the anchors use `x: 0`; a stemless shape
sets `anchors: null` and draws no stem.

### Reproduction-specific pitfalls (set 011)

- **The preview is a chromatic row of octave-chord cards**, not the ascending
  scale the gallery images show. Compare *staff geometry, line styling, ledger
  placement, and notehead assignment* — not layout.
- **Ledger position vs trigger are different fields.** "The ledger sits at C♯
  and appears for C and C♯" is `semiWithinOctave: 1, triggerPCs: [0, 1]` — a
  frequent early mistake is putting the ledger at the note's own position.
- **When a design needs a device the platform lacks**, record it as a gap in
  your fidelity notes (and, if it re-tiers a system, flag the feasibility
  matrix) rather than forcing it — the discipline that produced the Part 3
  evidence base.

---

## Using an AI assistant

Much of the walkthrough above — characterizing a published system into a draft
config, translating a prose notehead scheme into `noteheadRules` JSON, drafting
SVG glyph geometry, running the export-render-diff loop — is work an AI
assistant can accelerate, provided its output is checked by the platform's own
validator and your eyes before you trust it. The companion
**[AI-assisted workflow guide](ai-assisted-workflow.md)** maps each step above
to its AI value, gives ready-to-fill prompt templates for the high-value steps,
and states the verification and human-sign-off points that keep AI output
honest.
