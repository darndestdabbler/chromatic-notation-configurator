# Gallery survey — characterization record schema

**Session set:** `008-gallery-survey-and-feasibility` (session 1)
**Date:** 2026-07-06
**Purpose:** Fixed record schema for characterizing every notation system in
the Music Notation Project gallery (<https://musicnotation.org/systems/gallery/>).
Every record in `catalog.md` conforms to this schema. Every **categorical**
attribute has a **closed value set** defined here, plus the universal value
`unknown`. The identity/citation fields (§1), the numeric field
`staff.lines-per-octave`, the derived-list field `staff.semitone-pattern`,
and the free-text `notes` field (§7) are typed but open-valued.

## Rules

1. **`unknown` over guessing.** Where the gallery image and detail-page text
   do not support a confident value, the record states `unknown` for that
   attribute — never a guess presented as fact (spec method note).
2. **Sources.** Characterization draws only on the system's gallery detail
   page (text) and its gallery image(s). External sources, when consulted for
   a supplementary record (e.g. Dodeka), are cited explicitly in that record.
3. **IP posture** (project plan §5): records describe and cite; they do not
   reproduce gallery images into this repo and make no claim of endorsement.
4. **Free-text `notes` fields** may qualify any enum value but never replace
   it — downstream tooling (the set-008 session-2 feasibility matrix) keys on
   the enum values.

## Record format

Each record is a `###`-headed markdown section in `catalog.md` containing a
single definition-list-style table with the fields below, in this order.

### 1. Identity and citation

| Field | Type / closed value set |
|---|---|
| `name` | string — system name as given on the gallery page |
| `creator` | string — creator name(s) as given; `unknown` |
| `year` | integer year as given; `unknown` |
| `gallery-category` | one of the 10 gallery section headings, verbatim (see `index.md`); `out-of-gallery` for supplementary records |
| `detail-url` | absolute URL of the detail page (or primary external source for supplementary records) |
| `sources` | list of URLs actually consulted (detail page, image file(s), external pages for supplements) |

### 2. Staff

| Field | Closed value set |
|---|---|
| `staff.orientation` | `horizontal` \| `vertical` \| `unknown` |
| `staff.pitch-axis` | `linear-chromatic` (equal vertical distance per semitone) \| `linear-diatonic` \| `compact` (two or more pitch classes share one vertical position) \| `nonlinear-other` \| `unknown` |
| `staff.interval-structure` | interval(s) between adjacent staff lines: `uniform-whole-step` \| `uniform-minor-3rd` \| `uniform-major-3rd` \| `uniform-tritone` \| `uniform-octave` \| `mixed-whole-step-major-3rd` \| `keyboard-7-5` (line group mirrors the black-key 2+3 pattern) \| `other-mixed` \| `unknown` |
| `staff.lines-per-octave` | non-negative integer \| `unknown` |
| `staff.semitone-pattern` | the `staff.semitonePattern` equivalent in this platform's config schema: a list of semitone offsets within the octave where lines sit, e.g. `[0, 4, 8]` — **derivable only when** `staff.orientation = horizontal` and `staff.pitch-axis = linear-chromatic`; otherwise `not-derivable`; `unknown` when derivable in principle but the sources don't fix the offsets |
| `staff.line-variations` | subset of `{none, thickness (bold/heavy vs light), dashed-or-dotted, colored, grouping-gap (unequal spacing between line groups)}` \| `unknown` |
| `staff.compactness` | `full-height` (every chromatic pitch has its own vertical position) \| `compact` (notehead shape/side disambiguates pitches sharing a position) \| `unknown`. Must be consistent with `staff.pitch-axis`. |

### 3. Ledger lines

| Field | Closed value set |
|---|---|
| `ledgers.usage` | `conventional` (short lines extend the staff pattern for out-of-staff notes) \| `none-observed` \| `modified` (present but with non-standard placement/appearance — describe in notes) \| `unknown` |

### 4. Noteheads

| Field | Closed value set |
|---|---|
| `noteheads.shape-scheme` | `uniform` (one shape for all pitch classes) \| `binary-6-6` (two shapes alternating by whole-tone scale) \| `by-pc-set` (shapes assigned to defined pitch-class sets other than 6-6) \| `per-pc-distinct` (12 distinct shapes) \| `duration-carrying` (shape varies by duration, not pitch) \| `other` \| `unknown` |
| `noteheads.fill-scheme` | solid/hollow usage: `all-solid` \| `binary-6-6` \| `by-pc-set` \| `duration-carrying` (traditional: hollow = longer values) \| `mixed-pitch-and-duration` \| `other` \| `unknown` |
| `noteheads.color-scheme` | `monochrome` \| `two-color` (incl. black/white beyond hollow/solid, or black/red etc.) \| `multi-color-by-pc` \| `other` \| `unknown` |
| `noteheads.internal-glyphs` | glyphs or symbols inside/attached to noteheads carrying pitch info: `none` \| `letters` \| `numbers` \| `symbols` \| `unknown` |

### 5. Auxiliary devices

| Field | Closed value set |
|---|---|
| `aux.clef` | `none-observed` \| `traditional` (treble/bass etc., possibly repositioned) \| `custom-symbol` \| `octave-number-or-label` (register identified by number/letter rather than a clef glyph) \| `unknown` |
| `aux.key-signature` | `none-observed` (chromatic staff, no signature) \| `traditional` \| `custom` (non-traditional signature device — describe in notes) \| `unknown` |
| `aux.octave-markers` | `none-observed` \| `numbers-or-letters` \| `line-marking` (distinguished line/zone marks octaves) \| `other` \| `unknown` |
| `aux.accidentals` | `not-needed` (fully chromatic placement, no accidental glyphs) \| `traditional` \| `custom` \| `unknown` |

### 6. Duration

| Field | Closed value set |
|---|---|
| `duration.representation` | `traditional` (hollow/solid heads + stems/flags/beams/dots) \| `notehead-style` (duration encoded in notehead appearance outside the traditional hollow/solid convention) \| `proportional-spatial` (duration = horizontal extent/spacing of the note glyph itself, piano-roll-like — Dodeka reference case) \| `stem-flag-only` (heads uniform; stems/flags alone carry duration) \| `other` \| `unknown` |

### 7. Notes

| Field | Type |
|---|---|
| `notes` | free text: qualifications, notable devices, anything load-bearing for feasibility classification. May be empty. |

## Feasibility hooks (why these fields)

Session 2 classifies records into tiers against these platform invariants;
the schema fields that witness each invariant:

- **One pitch per vertical grid position** → `staff.pitch-axis`,
  `staff.compactness` (compact staves such as the Twinline family).
- **Horizontal staff orientation** → `staff.orientation` (Klavar family).
- **Duration expressed via hollow/solid + shape config, not glyph geometry** →
  `duration.representation` (Dodeka's `proportional-spatial` encoding is the
  reference counterexample).
- **Staff expressible as a per-octave semitone pattern** →
  `staff.semitone-pattern`, `staff.interval-structure`.
- **Auxiliary-device gaps (sets 009/010 scope)** → the `aux.*` fields.
