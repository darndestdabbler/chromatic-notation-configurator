# Gallery survey — characterization catalog

**Session set:** `008-gallery-survey-and-feasibility` (session 1)
**Survey date:** 2026-07-06
**Schema:** every record below conforms to `schema.md` (fixed field list,
closed value sets plus `unknown`).
**Coverage:** one record per entry in `index.md` — 54 gallery systems, in
index order — plus one supplementary out-of-gallery record (Dodeka, §S1).

Preamble notes:

- Characterizations draw on each system's gallery detail page and gallery
  image(s) only; the supplementary Dodeka record cites its external sources
  explicitly. `unknown` marks every attribute the sources did not support
  confidently — most commonly `duration.representation` and
  `noteheads.fill-scheme`, because many gallery images are standardized
  single-duration chromatic-scale renderings and many detail pages are
  silent on rhythm.
- Per the project's IP posture (project plan §5), records cite images by URL
  and do not reproduce them into this repo.
- `staff.semitone-pattern` values use this platform's convention: semitone
  offsets within one octave, offset 0 = pitch class C.

## Gallery records

### 1. Untitled (Heinrich Richter, 1847)

| Field | Value |
|---|---|
| `name` | Untitled |
| `creator` | Heinrich Richter |
| `year` | 1847 |
| `gallery-category` | Lines a Whole Step Apart, 5 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/untitled-by-heinrich-richter/ |
| `sources` | https://musicnotation.org/system/untitled-by-heinrich-richter/; https://musicnotation.org/wp-content/uploads/2012/07/5-line-chromatic-staff-heinrich-richter.png; https://musicnotation.org/wp-content/uploads/2012/08/chromatic-scale-caption-grey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | mixed-whole-step-major-3rd |
| `staff.lines-per-octave` | 5 |
| `staff.semitone-pattern` | [2, 4, 6, 8, 10] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Page text: 5-line whole-step staff shared by many inventors (Brandt, Frix, Huntington, Sacher, Schumann, Vincent, Wilbert, Wolf); "first ledger line C as in traditional notation" — so staff lines sit at D,E,F#,G#,A# → pattern [2,4,6,8,10], with a major-3rd gap (C ledger position) between octave line-groups (grouping-gap and mixed interval verdicts from text + image). Image confirms first note C carries a ledger line and each semitone alternates line/space. Image shows a two-octave standard staff; text says one- or two-octave variants exist. Noteheads in gallery image are uniform hollow ovals (standardized example, single duration) — fill scheme by duration and duration representation not determinable. |

### 2. Untitled (Grace Frix, 1992)

| Field | Value |
|---|---|
| `name` | Untitled |
| `creator` | Grace Frix |
| `year` | 1992 |
| `gallery-category` | Lines a Whole Step Apart, 5 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/untitled-by-grace-frix/ |
| `sources` | https://musicnotation.org/system/untitled-by-grace-frix/; https://musicnotation.org/wp-content/uploads/2012/07/untitled-grace-frix.png; https://musicnotation.org/wp-content/uploads/2012/08/chromatic-scale-caption-grey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | mixed-whole-step-major-3rd |
| `staff.lines-per-octave` | 5 |
| `staff.semitone-pattern` | [0, 4, 6, 8, 10] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | custom-symbol |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Page text: same 5-line whole-step staff family but "makes the first ledger line D (instead of C)" — so staff lines sit at E,F#,G#,A#,C → pattern [0,4,6,8,10]; the major-3rd gap between octave line-groups falls at D. Clef: text states a Δ (delta) symbol placed at the D above middle C with a ledger line through it → custom-symbol. Image (two-octave staff, uniform hollow oval noteheads on chromatic scale) is consistent; single-duration example, so fill/duration schemes not determinable. |

### 3. C-Symmetrical Semitone Notation (Ronald Sadlier, 1991)

| Field | Value |
|---|---|
| `name` | C-Symmetrical Semitone Notation |
| `creator` | Ronald Sadlier |
| `year` | 1991 |
| `gallery-category` | Lines a Whole Step Apart, 5 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/c-symmetrical-semitone-notation/ |
| `sources` | https://musicnotation.org/system/c-symmetrical-semitone-notation/; https://musicnotation.org/wp-content/uploads/2012/07/c-symmetrical-semitone-ronald-sadlier.png; https://musicnotation.org/wp-content/uploads/2012/08/chromatic-scale-caption-grey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | mixed-whole-step-major-3rd |
| `staff.lines-per-octave` | 5 |
| `staff.semitone-pattern` | [2, 4, 6, 8, 10] |
| `staff.line-variations` | {thickness, grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Page text: "identical to the regular five-line staff systems, except that the second and fourth lines are heavier"; "the single ledger line is C" → staff lines D,E,F#,G#,A#, pattern [2,4,6,8,10]. Heavier 2nd/4th lines (E and G♯ if counted from the bottom; counting direction not stated) confirmed visible in image → thickness variation; these are within-octave orientation aids, not octave markers. Major-3rd gap at the C ledger between octave line-groups (grouping-gap). Gallery image uses uniform hollow oval noteheads, single duration — fill/duration schemes not determinable. |

### 4. Notation Godjevatz (Velizar Godjevatz, 1948)

| Field | Value |
|---|---|
| `name` | Notation Godjevatz |
| `creator` | Velizar Godjevatz |
| `year` | 1948 |
| `gallery-category` | Lines a Whole Step Apart, 5 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/notation-godjevatz-by-velizar-godjevatz/ |
| `sources` | https://musicnotation.org/system/notation-godjevatz-by-velizar-godjevatz/; https://musicnotation.org/wp-content/uploads/2012/07/notation-godjevatz-velizar-godjevatz.png; https://musicnotation.org/wp-content/uploads/2012/08/chromatic-scale-caption-grey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | mixed-whole-step-major-3rd |
| `staff.lines-per-octave` | 5 |
| `staff.semitone-pattern` | [0, 2, 4, 8, 10] |
| `staff.line-variations` | {thickness, grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | traditional |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | traditional |
| `duration.representation` | unknown |
| `notes` | Page text: one-octave staff of two 3-line groups (lower C,D,E; upper G#,A#,C) with a single ledger line in the MIDDLE of the staff for F#/Gb → pattern [0,2,4,8,10] with F#(6) as an in-staff ledger — non-standard ledger placement → modified. C lines (lowest and highest) "optionally heavier" → thickness (optional) + line-marking octave cue. Major-3rd gap E→G# around the F# ledger (grouping-gap; mixed interval verdict from text + image). Text: Godjevatz "allowed for the option to use accidental signs... both in key signatures and for accidental notes" → key-signature/accidentals recorded traditional but explicitly OPTIONAL (chromatic placement makes them redundant). Image: two-octave stack, uniform hollow oval noteheads, single duration — fill/duration schemes not determinable. |

### 5. A-B Chromatic Notation (Albert Brennink, 1976)

| Field | Value |
|---|---|
| `name` | A-B Chromatic Notation |
| `creator` | Albert Brennink |
| `year` | 1976 |
| `gallery-category` | Lines a Whole Step Apart, 4 or 3 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/a-b-chromatic-notation-by-albert-brennink/ |
| `sources` | https://musicnotation.org/system/a-b-chromatic-notation-by-albert-brennink/; https://musicnotation.org/wp-content/uploads/2012/07/a-b-chromatic-albert-brennink1.png; https://musicnotation.org/wp-content/uploads/2012/08/chromatic-scale-caption-grey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | other-mixed |
| `staff.lines-per-octave` | 4 |
| `staff.semitone-pattern` | [0, 6, 8, 10] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Page text: four-line whole-step staff, bottom line F# so A falls at staff center → lines F#,G#,A#,C = pattern [0,6,8,10]. Interval structure other-mixed: whole steps within the group plus a tritone gap C→F# (containing ledger positions D and E) between octave groups (grouping-gap). Image (two-octave staff) shows short ledger lines through/around the D–E notes below each 4-line group, continuing the whole-step grid → conventional ledgers. Uniform hollow oval noteheads in gallery image, single duration — fill/duration schemes not determinable. |

### 6. 6-6 Tetragram (Richard Parncutt, 1996)

| Field | Value |
|---|---|
| `name` | 6-6 Tetragram |
| `creator` | Richard Parncutt |
| `year` | 1996 |
| `gallery-category` | Lines a Whole Step Apart, 4 or 3 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/6-6-tetragram-by-richard-parncutt/ |
| `sources` | https://musicnotation.org/system/6-6-tetragram-by-richard-parncutt/; https://musicnotation.org/wp-content/uploads/2012/07/6-6-tetragram-richard-parncutt.png; https://musicnotation.org/wp-content/uploads/2012/08/chromatic-scale-caption-grey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | other-mixed |
| `staff.lines-per-octave` | 4 |
| `staff.semitone-pattern` | [5, 7, 9, 11] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Page text: the four lines are F,G,A,B → pattern [5,7,9,11]; spaces above/below the staff are C,D,E and the two ledger lines are C#,D# — the staff is aligned with the keyboard 7-5 pattern (three in-staff spaces = the 3-black-key group), though the lines themselves are a single whole-step tetragram, not 2+3 black-key line groups, hence other-mixed (whole steps + tritone gap B→F between octave groups; grouping-gap). Image confirms C#/D# ledger lines below the upper octave group. Modification of Brennink's design (text). Uniform hollow oval noteheads, single duration in gallery image — fill/duration schemes not determinable. |

### 7. 6-6 Trigram Notation (Richard Parncutt, 1990)

| Field | Value |
|---|---|
| `name` | 6-6 Trigram Notation |
| `creator` | Richard Parncutt |
| `year` | 1990 |
| `gallery-category` | Lines a Whole Step Apart, 4 or 3 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/6-6-trigram-notation-by-richard-parncutt/ |
| `sources` | https://musicnotation.org/system/6-6-trigram-notation-by-richard-parncutt/; https://musicnotation.org/wp-content/uploads/2012/07/6-6-trigram-richard-parncutt.png; https://musicnotation.org/wp-content/uploads/2012/08/chromatic-scale-caption-grey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | other-mixed |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | [6, 8, 10] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Page text: three solid staff lines per octave represent the 3-black-key group F#,G#,A# → pattern [6,8,10]; ledger lines represent C,D,E and appear "in groups of three... above, below, and between [the staff groups] as needed" — group rendering confirmed in image (first notes C–E each carry a stack of short trigram ledger lines) → modified ledger appearance. Interval structure other-mixed: whole steps within the trigram, minor-6th gap A#→F# between octave groups (grouping-gap). Not classed keyboard-7-5: lines mark only the 3-black-key group, though text notes alignment with the 7-5 pitch pattern. Uniform hollow oval noteheads, single duration — fill/duration schemes not determinable. |

### 8. Untitled (Klaus Lieber, 1983)

| Field | Value |
|---|---|
| `name` | Untitled |
| `creator` | Klaus Lieber |
| `year` | 1983 |
| `gallery-category` | Lines a Whole Step Apart, 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/untitled-by-klaus-lieber/ |
| `sources` | https://musicnotation.org/system/untitled-by-klaus-lieber/; https://musicnotation.org/wp-content/uploads/2012/07/untitled-klaus-lieber.png; https://musicnotation.org/wp-content/uploads/2012/08/chromatic-scale-caption-grey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-whole-step |
| `staff.lines-per-octave` | 6 |
| `staff.semitone-pattern` | [0, 2, 4, 6, 8, 10] |
| `staff.line-variations` | {thickness} |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Page text: seven-line staff, top and bottom lines bold, bold lines are C, five standard lines between → per-octave pattern [0,2,4,6,8,10] (C counted once per octave), uniform whole-step spacing. Image (two stacked staves) shows evenly spaced lines with bold lines at top, middle, and bottom — stacked staves share the C line, giving a continuous whole-step grid. Bold C lines → thickness variation and line-marking octave cue (text + image). Registers covered by stacking staves (piano staff = six stacked staves, text); no ledger lines mentioned or visible in example → none-observed. Uniform hollow oval noteheads, single duration — fill/duration schemes not determinable. |

### 9. Notation for the System of Equal Tones (Gustave Decher, 1877)

| Field | Value |
|---|---|
| `name` | Notation for the System of Equal Tones |
| `creator` | Gustave Decher |
| `year` | 1877 |
| `gallery-category` | Lines a Whole Step Apart, 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/notation-for-the-system-of-equal-tones-by-gustave-decher/ |
| `sources` | https://musicnotation.org/system/notation-for-the-system-of-equal-tones-by-gustave-decher/; https://musicnotation.org/wp-content/uploads/2012/07/system-of-equal-tones-gustave-decher.png; https://musicnotation.org/wp-content/uploads/2012/08/chromatic-scale-caption-grey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-whole-step |
| `staff.lines-per-octave` | 6 |
| `staff.semitone-pattern` | [1, 3, 5, 7, 9, 11] |
| `staff.line-variations` | {thickness} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | all-solid |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | not-needed |
| `duration.representation` | proportional-spatial |
| `notes` | Full name "Notation for the System of Equal Tones Applied to the Chromatic Keyboard"; essentially identical to Hans Krenn's "Seven-tone or Twelve-tone Notation" (1910). Page text: same seven-line whole-step staff as Lieber's but the bold top/bottom lines represent A → lines A,B,C#,D#,F,G per octave = pattern [1,3,5,7,9,11] (C=0 anchoring; C itself is a space). Bold A lines → thickness + line-marking (text + image). Text: "Traditional ledger lines are used for notes extending beyond the staff" → conventional. Duration (text): all notes look like traditional quarter notes (solid heads → all-solid, uniform shape); short bar lines divide beats within the measure, N notes in a beat = N equal subdivisions, ties across beat separations give longer values → classified proportional-spatial (duration from grouping/spacing within beat compartments, not notehead appearance). Piano staff: two staves connected by full bar lines. |

### 10. Untitled (Franz Grassl, 1983)

| Field | Value |
|---|---|
| `name` | Untitled |
| `creator` | Franz Grassl |
| `year` | 1983 |
| `gallery-category` | Lines a Whole Step Apart, 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/untitled-by-franz-grassl/ |
| `sources` | https://musicnotation.org/system/untitled-by-franz-grassl/; https://musicnotation.org/wp-content/uploads/2012/07/untitled-franz-grassl.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-whole-step |
| `staff.lines-per-octave` | 6 |
| `staff.semitone-pattern` | [1, 3, 5, 7, 9, 11] |
| `staff.line-variations` | {dashed-or-dotted} |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Semitone pattern from page text: four solid lines are F, G, A, B (bottom solid line is F, spaces are F#, G#, A#) and the two dashed lines are C# and D#, giving offsets [1,3,5,7,9,11]. Page text says the dashed lines take the place of ledger lines; no out-of-staff ledger lines appear in the image, hence none-observed. Fill is the 7-5 pattern (C-major notes white/hollow, other five black/solid) per text and image — hollow/solid encodes pitch class, so it cannot carry duration; the page says nothing about rhythmic notation, hence duration unknown. Text notes an alternative 1983 Chroma Foundation depiction used conventional (duration) notehead coloring instead. |

### 11. Ambros System (August Ambros, 1883)

| Field | Value |
|---|---|
| `name` | Ambros System |
| `creator` | August Ambros |
| `year` | 1883 |
| `gallery-category` | Lines a Whole Step Apart, 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/ambros-system-by-august-ambros/ |
| `sources` | https://musicnotation.org/system/ambros-system-by-august-ambros/; https://musicnotation.org/wp-content/uploads/2012/07/ambros-system-august-ambros.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-whole-step |
| `staff.lines-per-octave` | 6 |
| `staff.semitone-pattern` | [0, 2, 4, 6, 8, 10] |
| `staff.line-variations` | {dashed-or-dotted} |
| `staff.compactness` | full-height |
| `ledgers.usage` | unknown |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Pattern anchored by text: lowest solid line is C, with three solid lines (C, E, G#) alternating with three dashed lines (D, F#, A#), confirmed by the alternating solid/dashed lines in the image. "Traditional rhythmic notation is used" (text) supports duration-carrying fill and traditional duration. Example image keeps the chromatic scale inside the two-octave staff, so ledger behavior is unknown. |

### 12. Douzave System (John Leon Acheson, 1936)

| Field | Value |
|---|---|
| `name` | Douzave System |
| `creator` | John Leon Acheson |
| `year` | 1936 |
| `gallery-category` | Lines a Whole Step Apart, 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/douzave-system-by-john-leon-acheson/ |
| `sources` | https://musicnotation.org/system/douzave-system-by-john-leon-acheson/; https://musicnotation.org/wp-content/uploads/2012/07/douzave-john-acheson.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-whole-step |
| `staff.lines-per-octave` | 6 |
| `staff.semitone-pattern` | [0, 2, 4, 6, 8, 10] |
| `staff.line-variations` | {thickness, dashed-or-dotted} |
| `staff.compactness` | full-height |
| `ledgers.usage` | unknown |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Pattern from text: bold line is C, dashed top line is F#, remaining four normal lines fall on D, E, G#, A# (whole-step spacing), giving [0,2,4,6,8,10]. The bold C line distinguishes each octave, hence octave-markers = line-marking. Page text says nothing about rhythmic notation and the example image shows only hollow noteheads in a scale, so fill-scheme and duration are unknown. Scale stays within the two-octave staff, so ledger behavior is unknown. |

### 13. Notagraph (Constance Virtue, 1933)

| Field | Value |
|---|---|
| `name` | Notagraph |
| `creator` | Constance Virtue |
| `year` | 1933 |
| `gallery-category` | Lines a Whole Step Apart, 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/notagraph-by-constance-virtue/ |
| `sources` | https://musicnotation.org/system/notagraph-by-constance-virtue/; https://musicnotation.org/wp-content/uploads/2012/07/notagraph-constance-virtue.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-whole-step |
| `staff.lines-per-octave` | 6 |
| `staff.semitone-pattern` | [0, 2, 4, 6, 8, 10] |
| `staff.line-variations` | {dashed-or-dotted} |
| `staff.compactness` | full-height |
| `ledgers.usage` | unknown |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Standard staff is 7 lines spanning C to C inclusive (top and bottom lines both C, dashed middle line F#, per text), i.e. lines at every whole step anchored on C — 6 unique lines per octave, [0,2,4,6,8,10]. "Traditional rhythmic notation is used" (text) supports duration-carrying fill and traditional duration. Two stacked one-octave staves shown in the image; no out-of-staff notes, so ledger behavior is unknown. The C lines are solid like the other non-dashed lines (not visually distinguished), hence octave-markers none-observed. |

### 14. Note for Note (Walter H. Thelwall, 1897)

| Field | Value |
|---|---|
| `name` | Note for Note |
| `creator` | Walter H. Thelwall |
| `year` | 1897 |
| `gallery-category` | Lines a Whole Step Apart, 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/note-for-note-by-walter-h-thelwall/ |
| `sources` | https://musicnotation.org/system/note-for-note-by-walter-h-thelwall/; https://musicnotation.org/wp-content/uploads/2012/07/note-for-note-walter-thelwall.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-whole-step |
| `staff.lines-per-octave` | 6 |
| `staff.semitone-pattern` | [0, 2, 4, 6, 8, 10] |
| `staff.line-variations` | {thickness, dashed-or-dotted} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Seven-line standard staff with bold middle line C and top/bottom lines both F#/Gb (text); all lines a whole step apart, so the per-octave pattern anchored at C is [0,2,4,6,8,10] with the C line bold. Text and image show two ledger lines below the staff continuing the whole-step pattern down to a dashed line that also represents C (staff spans about an octave and a half); the short ledger lines under low notes in the image behave conventionally, hence conventional. Bold C line (and dashed lower C line) mark the register, hence octave-markers line-marking. "Traditional noteheads are used" (text) supports duration-carrying fill and traditional duration. |

### 15. Proportional Chromatic Musical Notation (Henri Carcelle, 1977)

| Field | Value |
|---|---|
| `name` | Proportional Chromatic Musical Notation |
| `creator` | Henri Carcelle |
| `year` | 1977 |
| `gallery-category` | Lines a Whole Step Apart, 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/proportional-chromatic-musical-notation-by-henri-carcelle/ |
| `sources` | https://musicnotation.org/system/proportional-chromatic-musical-notation-by-henri-carcelle/; https://musicnotation.org/wp-content/uploads/2012/07/proportional-chromatic-henri-carcelle.png; https://musicnotation.org/wp-content/uploads/2013/03/carcelle-vertical.gif |
| `staff.orientation` | vertical |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-whole-step |
| `staff.lines-per-octave` | 6 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {dashed-or-dotted} |
| `staff.compactness` | full-height |
| `ledgers.usage` | unknown |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Designed to be read vertically top-to-bottom like Klavar, with pitches ascending left to right (text; confirmed by the carcelle-vertical.gif, which shows each of the 12 pitch classes at its own equally spaced horizontal position — hence linear-chromatic). Standard staff is a symmetrical set of nine lines spanning about an octave and a half in the pattern solid, dotted, solid, solid, dashed, solid, solid, dotted, solid (text). "Traditional noteheads and time values are used" (text) supports duration-carrying fill and traditional duration, despite the system's name. The note-name letters beside the vertical GIF are an illustration legend, not a system device. The gallery thumbnail PNG shows the staff rotated to horizontal for comparison. |

### 16. Isomorph Notation (Tadeusz Wójcik, 1952)

| Field | Value |
|---|---|
| `name` | Isomorph Notation |
| `creator` | Tadeusz Wójcik |
| `year` | 1952 |
| `gallery-category` | Lines a Whole Step and Major 3rd Apart, 4 per Octave |
| `detail-url` | https://musicnotation.org/system/isomorph-notation-by-tadeusz-wojcik/ |
| `sources` | https://musicnotation.org/system/isomorph-notation-by-tadeusz-wojcik/; https://musicnotation.org/wp-content/uploads/2012/07/isomorph-tadeusz-wojcik.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | mixed-whole-step-major-3rd |
| `staff.lines-per-octave` | 4 |
| `staff.semitone-pattern` | [2, 6, 8, 10] |
| `staff.line-variations` | {thickness} |
| `staff.compactness` | full-height |
| `ledgers.usage` | unknown |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | not-needed |
| `duration.representation` | proportional-spatial |
| `notes` | Pattern directly from text: heavy line is D (offset 2), three ordinary lines are F#, G#, A# (offsets 6, 8, 10), with the D-to-group distance twice the within-group spacing — consistent with linear-chromatic placement. The heavy D line distinguishes each octave, hence octave-markers line-marking. Black noteheads for the whole-tone scale containing the lines, white for the other whole-tone scale (text and image), hence binary-6-6 fill; text notes noteheads are actually circular (depicted oval in the image) and white/black heads sit on opposite sides of the stem, as in Klavar. "The rhythmic notation is proportional" (text), hence proportional-spatial. |

### 17. DA Notation (Rich Reed, 1986)

| Field | Value |
|---|---|
| `name` | DA Notation |
| `creator` | Rich Reed |
| `year` | 1986 |
| `gallery-category` | Lines a Whole Step and Major 3rd Apart, 4 per Octave |
| `detail-url` | https://musicnotation.org/system/da-notation-by-rich-reed/ |
| `sources` | https://musicnotation.org/system/da-notation-by-rich-reed/; https://musicnotation.org/wp-content/uploads/2012/07/da-notation-rich-reed.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | mixed-whole-step-major-3rd |
| `staff.lines-per-octave` | 4 |
| `staff.semitone-pattern` | [0, 4, 6, 8] |
| `staff.line-variations` | {thickness} |
| `staff.compactness` | full-height |
| `ledgers.usage` | unknown |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Staff "basically identical to Isomorph Notation" but with the heavy bottom and top lines representing C (text; image shows heavy lines at staff top and bottom). With the Isomorph structure (group of three whole-step lines, major-3rd gap to the heavy line on each side) anchored so the heavy lines are C, the pattern is [0, 4, 6, 8] (C, E, F#, G#). Heavy C lines mark octaves, hence line-marking. Uses the same alternating (whole-tone) notehead color as Isomorph, hence binary-6-6 fill (also visible in the image). "The rhythmic notation is mostly traditional rather than proportional" (text) — recorded as traditional, but since hollow/solid encodes pitch, duration presumably rides on stems/flags/beams; the qualifier "mostly" is the text's own. |

### 18. Numbered Notes, Notes-Only (Jason MacCoy, 2009)

| Field | Value |
|---|---|
| `name` | Numbered Notes, Notes-Only |
| `creator` | Jason MacCoy |
| `year` | 2009 |
| `gallery-category` | Lines a Minor 3rd Apart, 3 or 4 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/numbered-notes-notes-only-by-jason-maccoy/ |
| `sources` | https://musicnotation.org/system/numbered-notes-notes-only-by-jason-maccoy/; https://musicnotation.org/wp-content/uploads/2012/07/numbered-notes-notes-jason-maccoy.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-minor-3rd |
| `staff.lines-per-octave` | 4 |
| `staff.semitone-pattern` | unknown |
| `staff.line-variations` | none |
| `staff.compactness` | full-height |
| `ledgers.usage` | unknown |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Text: "The Numbered Notes staff is rare in that it spaces its lines a minor third apart," comparing it to the chromatic button accordion's 4-4-4 minor-third layout — a uniform minor-3rd staff yields 4 lines per octave. Neither text nor the thumbnail image fixes which pitch class the lines sit on, so the semitone pattern is unknown (derivable in principle). This Notes-Only version omits the identifying numbers, hence internal-glyphs none (the Numbers-Only sibling version uses numbers as noteheads). "Rhythmic notation is the same as in traditional notation" (text), hence duration-carrying fill and traditional duration. Staff lines in the image appear uniform solid black, hence line-variations none. |

### 19. Numbered Notes, Numbers-Only (Jason MacCoy, 2009)

| Field | Value |
|---|---|
| `name` | Numbered Notes, Numbers-Only Version |
| `creator` | Jason MacCoy |
| `year` | 2009 |
| `gallery-category` | Lines a Minor 3rd Apart, 3 or 4 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/numbered-notes-numbers-only-by-jason-maccoy/ |
| `sources` | https://musicnotation.org/system/numbered-notes-numbers-only-by-jason-maccoy/; https://musicnotation.org/wp-content/uploads/2012/07/numbered-notes-numbers-jason-maccoy.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-minor-3rd |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | [4, 7, 10] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | per-pc-distinct |
| `noteheads.fill-scheme` | other |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | numbers |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | other |
| `notes` | The numerals 1–12 (1 = C) serve as the noteheads themselves, so shape-scheme = per-pc-distinct and internal-glyphs = numbers; there is no solid/hollow fill dimension (fill-scheme = other). Semitone pattern from pixel measurement of the gallery image: lines sit at E, G, A# ([4, 7, 10]) with C#-position ledger lines at semitones 1 and 13 (C hangs just below its C# ledger); the Hass 3-line page confirms "this staff is the same as that of the Numbered Notes system" with C# on a ledger line. Image shows two 3-line octave groups separated by a 6-semitone gap (grouping-gap at the octave boundary). Duration: page text says rhythmic notation "is the same as in traditional notation, except that a novel means of distinguishing between half and quarter notes is introduced"; numeral noteheads preclude the traditional hollow/solid convention and the novel half/quarter device is not specified in the sources, hence `other`. |

### 20. Lautus Notation (Bruce Allen Dickey, 2011)

| Field | Value |
|---|---|
| `name` | Lautus Notation |
| `creator` | Bruce Allen Dickey |
| `year` | 2011 |
| `gallery-category` | Lines a Minor 3rd Apart, 3 or 4 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/lautus-notation-by-bruce-allen-dickey/ |
| `sources` | https://musicnotation.org/system/lautus-notation-by-bruce-allen-dickey/; https://musicnotation.org/wp-content/uploads/2012/07/lautus-bruce-dickey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-minor-3rd |
| `staff.lines-per-octave` | 4 |
| `staff.semitone-pattern` | [2, 5, 8, 11] |
| `staff.line-variations` | {thickness} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | all-solid |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | octave-number-or-label |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | numbers-or-letters |
| `aux.accidentals` | not-needed |
| `duration.representation` | stem-flag-only |
| `notes` | Text: lines are G#, B, D, F with the F line bold; pixel measurement of the image confirms lines every 3 semitones continuously across stacked octaves (no octave gap) with the bold lines at F positions, i.e. pattern [2, 5, 8, 11] with thickness override on 5. Clef/octave: "In place of a clef, a large Arabic numeral indicates the octave number" (text); the single bold line per octave also aids octave orientation. Ledgers: Dickey recommends a single-octave staff with ledger lines to reduce visual density (text; not shown in image). Duration: hollow noteheads are not used — all heads solid black; half notes have a regular stem plus a neighboring half-height stem, whole notes a double stem, breves a triple stem; half and longer rests are nontraditional stem-like marks; an optional variant uses fully traditional rhythmic notation (text). Quarter and shorter durations use traditional stems/flags. |

### 21. Hass Notation, 3-Line Version (Peter Hass, 2014)

| Field | Value |
|---|---|
| `name` | Hass Notation, 3-Line Version |
| `creator` | Peter Hass |
| `year` | 2014 |
| `gallery-category` | Lines a Minor 3rd Apart, 3 or 4 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/hass-notation-3-line-version/ |
| `sources` | https://musicnotation.org/system/hass-notation-3-line-version/; https://musicnotation.org/wp-content/uploads/2015/02/hass-notation-3-line-version-peter-hass.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-minor-3rd |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | [4, 7, 10] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | by-pc-set |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Text: lines spaced a minor 3rd apart, C# ("O") on a ledger line; pixel measurement of the image confirms lines at E, G, A# ([4, 7, 10]) with the C# ledger at semitone 1, and two 3-line octave groups separated by a 6-semitone gap (grouping-gap). Three notehead shapes assigned by staff position: ovals on lines (pc set {1, 4, 7, 10}), upward and downward triangles in the two space positions — the three diminished-7th-type sets, mirroring the three rows of a chromatic button accordion (text) — hence by-pc-set. "Rhythmic notation is traditional" (text), so fill carries duration; example image shows all-solid quarter-note heads. Stems are horizontally centered on noteheads rather than left/right (text). New pitch names O, S, V, I for C#, D#, F#, G# are nomenclature only, not notation glyphs. |

### 22. Trilinear Notation (José A. Sotorrio, 2017)

| Field | Value |
|---|---|
| `name` | Trilinear Notation |
| `creator` | José A. Sotorrio |
| `year` | 2017 |
| `gallery-category` | Lines a Minor 3rd Apart, 3 or 4 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/trilinear-notation-jose-sotorrio/ |
| `sources` | https://musicnotation.org/system/trilinear-notation-jose-sotorrio/; https://musicnotation.org/wp-content/uploads/2017/02/trilinear-jose-a-sotorrio-wpcf_500x110.png; https://musicnotation.org/wp-content/uploads/2017/02/trilinear-with-trichromatic-jose-a-sotorrio-wpcf_500x110.png; https://musicnotation.org/wp-content/uploads/2017/02/trilinear-durations.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-minor-3rd |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | [4, 7, 10] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | by-pc-set |
| `noteheads.fill-scheme` | other |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | stem-flag-only |
| `notes` | Record describes the "basic" version. Three notehead glyphs — X, O, and triangular "<" — cycle by staff position and correspond to the three diminished 7th chords (by-pc-set); pixel measurement of the basic image confirms the same staff as Numbered Notes/Hass: lines at E, G, A# ([4, 7, 10]; lowest staff line = E per text), O-heads of the {C#, E, G, A#} set on lines, C# on a ledger line, and octave line groups separated by a 6-semitone gap. Fill: heads are stroke-drawn glyphs (O always hollow), not a solid/hollow scheme — hence `other`. Duration (durations image): whole = bare glyph, half = glyph with a short vertical tick on the opposite side from the conventional stem, quarter = full stem, eighth/sixteenth = stem plus flags; heads never change with duration, hence stem-flag-only. A second "Tri-Chromatic" variant shifts the mapping to Pertchik's tri-chromatic keyboard: staff lines are colored red, hollow O = his white notes, solid X = his black notes, "<" heads on the red lines (variant image shows red lines) — variant only, not reflected in the enum values above. |

### 23. Chromatic 6-6 Notation (Johannes Beyreuther, 1985)

| Field | Value |
|---|---|
| `name` | Chromatic 6-6 Notation |
| `creator` | Johannes Beyreuther |
| `year` | 1985 |
| `gallery-category` | Lines a Major 3rd Apart, 3 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/chromatic-6-6-notation-by-johannes-beyreuther/ |
| `sources` | https://musicnotation.org/system/chromatic-6-6-notation-by-johannes-beyreuther/; https://musicnotation.org/wp-content/uploads/2012/07/chromatic-66-johannes-beyreuther.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | [0, 4, 8] |
| `staff.line-variations` | {dashed-or-dotted} |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | proportional-spatial |
| `notes` | Staff (text + pixel measurement of image): five evenly spaced lines a major 3rd apart spanning "about an octave and a half" (C to E' in the image), with the middle line dashed; the dashed line is a property of the 5-line staff arrangement (G# in the image), not octave-cyclic. Bottom line anchors at C, giving per-octave pattern [0, 4, 8]. Between adjacent lines are three note elevations (each semitone has its own position — linear-chromatic). Fill: solid heads = C whole-tone set (on/midway between lines), hollow heads = C# whole-tone set "hugging" the lines (text describes these as black vs white notes; image shows solid vs hollow) — binary-6-6. Duration: "Rhythmic notation is basically proportional with dashes representing beats of time (though this is not the case in this illustration)" (text). |

### 24. 6-6 Klavar (Cornelis Pot, 1972)

| Field | Value |
|---|---|
| `name` | 6-6 Klavar |
| `creator` | Cornelis Pot |
| `year` | 1972 |
| `gallery-category` | Lines a Major 3rd Apart, 3 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/6-6-klavar-by-cornelis-pot/ |
| `sources` | https://musicnotation.org/system/6-6-klavar-by-cornelis-pot/; https://musicnotation.org/wp-content/uploads/2012/07/6-6-klavar-cornelis-pot-horizontal.png; https://musicnotation.org/wp-content/uploads/2013/03/66klavar-vertical.gif |
| `staff.orientation` | vertical |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {thickness} |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Vertical staff read top to bottom, pitch ascending left to right (text; vertical GIF rendered fine and confirms). Standard staff: seven lines spanning two octaves, every third line bold (text + both images) — bold line recurs once per octave (line-marking octave cue). Semitone-pattern not-derivable (vertical orientation); for reference, the gallery's horizontal transcription measures lines at C#, F, A equivalents ([1, 5, 9]) with the bold line at C#, but the page notes conflicting accounts of whether the bold lines represent C#/Db or C (Brennink 1983 says C). Fill (both images): hollow heads = C whole-tone set, solid heads = C# whole-tone set — binary-6-6. Duration: sources say nothing about rhythm for this system and the images show only stemless heads, hence unknown. |

### 25. Untitled (Arnold Schoenberg, 1924)

| Field | Value |
|---|---|
| `name` | Untitled |
| `creator` | Arnold Schoenberg |
| `year` | 1924 |
| `gallery-category` | Lines a Major 3rd Apart, 3 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/untitled-by-arnold-schoenberg/ |
| `sources` | https://musicnotation.org/system/untitled-by-arnold-schoenberg/; https://musicnotation.org/wp-content/uploads/2012/07/untitled-arnold-schoenberg.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | [0, 4, 8] |
| `staff.line-variations` | {thickness} |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | symbols |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Text: three solid lines at C, E, G#/Ab ([0, 4, 8]); when the staff extends beyond one octave the C line is made bold — pixel measurement of the image confirms six evenly spaced lines (major 3rd apart, no octave gap) with 2px-bold lines exactly at the two C positions (thickness variation; also the octave cue → line-marking). The three note elevations between lines are marked by short slash marks passing below, above, or through the noteheads (text + image: on-line notes plain, between-line notes slashed) — internal-glyphs = symbols. "Otherwise traditional notes, stems, and rhythmic notation are used" (text) → duration traditional, fill duration-carrying. Schoenberg considered dotted/dashed line substitutions but concluded they would not be necessary (text). Ledgers not shown or discussed. |

### 26. Panot Notation (George Skapski, 1956)

| Field | Value |
|---|---|
| `name` | Panot Notation |
| `creator` | George Skapski |
| `year` | 1956 |
| `gallery-category` | Lines a Major 3rd Apart, 2 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/panot-notation-by-george-skapski/ |
| `sources` | https://musicnotation.org/system/panot-notation-by-george-skapski/; https://musicnotation.org/wp-content/uploads/2012/07/panot-george-skapski.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [4, 8] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | all-solid |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Text: the two lines per octave represent E and G#/Ab ([4, 8] — the same pattern as this platform's default config), with a ledger line above and below the staff for C; standard staff spans two octaves, so line pairs are separated by an 8-semitone octave gap (grouping-gap; pixel measurement confirms lines at E, G#, E', G#'). Ledgers = modified: on the two-octave staff the C ledger also occurs internally, between the octave line pairs (image shows C at semitone 12 on a short ledger between the G# and E' lines, also drawn beside the adjacent B). Three note elevations between adjacent lines (incl. ledger) — every semitone has its own position. "All the notes are black and circular" (text + image) → uniform, all-solid, monochrome. Duration: "A novel rhythmic notation is used" with no further detail in the sources — non-traditional but unclassifiable, hence unknown. |

### 27. Clairnote SN (Paul Morris, 2018)

| Field | Value |
|---|---|
| `name` | Clairnote SN |
| `creator` | Paul Morris |
| `year` | 2018 |
| `gallery-category` | Lines a Major 3rd Apart, 2 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/clairnote-sn-paul-morris/ |
| `sources` | https://musicnotation.org/system/clairnote-sn-paul-morris/; https://musicnotation.org/wp-content/uploads/2018/12/clairnote-sn-paul-morris.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [4, 8] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | unknown |
| `aux.key-signature` | custom |
| `aux.octave-markers` | unknown |
| `aux.accidentals` | custom |
| `duration.representation` | traditional |
| `notes` | Line pattern "similar to Skapski's Panot" (text); pixel measurement of the image confirms staff lines at E and G# ([4, 8]) with the octave line pairs separated by an 8-semitone gap (grouping-gap). Ledgers = modified: "internal" floating ledger lines for D, F#/Gb, A#/Bb sit between staff/ledger lines rather than aligning with them, and C/E/G# ledgers align with the staff pattern (text + image: C, D, F#, A#, C' all carry short lines); the internal C ledger also occurs between staff lines. Regular alternation of line and space notes gives a 6-6 line pattern (text). Every pitch has its own vertical position (full-height, linear) but the staff is vertically compressed — noteheads of adjacent pitches overlap and an octave spans about 1.3× a traditional staff octave (vs 1.714× for a standard chromatic staff) (text). Standard rhythm notation and oval noteheads (text) → duration traditional, fill duration-carrying. Aux: the system "has a system of alternative accidental signs, key signatures, and clefs" (text) → key-signature and accidentals custom; the form of the clefs and any octave markers is not shown in these sources → unknown. |

### 28. Untitled (Johannes Beyreuther, 1959)

| Field | Value |
|---|---|
| `name` | Untitled |
| `creator` | Johannes Beyreuther |
| `year` | 1959 |
| `gallery-category` | Lines a Major 3rd Apart, 2 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/untitled-by-johannes-beyreuther/ |
| `sources` | https://musicnotation.org/system/untitled-by-johannes-beyreuther/; https://musicnotation.org/wp-content/uploads/2012/07/untitled-johannes-beyreuther.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [4, 8] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | proportional-spatial |
| `notes` | Text: lines represent E and G#/Ab, with a ledger line for C above and below the staff; the standard staff spans two octaves. Interval structure: within-octave line pair is a major 3rd; the gap between octave line groups is a minor 6th bridged by the C ledger, so C-E-G# forms a uniform major-3rd grid (grouping-gap visible in image). Ledgers marked `modified` because C always carries a ledger line, including inside the gap between octave line groups (mid-staff ledger visible in image at C'); otherwise conventional short dashes. Circular noteheads alternate solid/hollow highlighting the 6-6 pitch pattern (text + image; solid = C,D,E,F#,G#,A# whole-tone set per image). Rhythm is proportional, "somewhat like Klavar notation" (text). Fully chromatic placement, no accidental glyphs, clef, key signature, or octave markers in image or text. Beyreuther later withdrew this proposal in favor of its "dashed line" cousin (text). |

### 29. Clairnote DN (Paul Morris, 2006)

| Field | Value |
|---|---|
| `name` | Clairnote DN |
| `creator` | Paul Morris |
| `year` | 2006 |
| `gallery-category` | Lines a Major 3rd Apart, 2 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/clairnote-dn-by-paul-morris/ |
| `sources` | https://musicnotation.org/system/clairnote-dn-by-paul-morris/; https://musicnotation.org/wp-content/uploads/2012/07/clairnote-dn-paul-morris.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [4, 8] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | custom-symbol |
| `aux.key-signature` | custom |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | custom |
| `duration.representation` | stem-flag-only |
| `notes` | Same line pattern as Beyreuther's Untitled (lines E and G#, ledger for C): [4, 8]. Still one vertical position per semitone (full-height / linear-chromatic), but the whole staff is vertically compressed — an octave is about 1.3x the traditional-staff octave rather than 12/7 ~ 1.714x, achieved by letting adjacent noteheads overlap more (text). Grouping-gap between octave line pairs and mid-gap C ledger confirmed in image, hence `ledgers = modified`. Traditional oval noteheads alternate solid/hollow with solid notes on the lines, highlighting the 6-6 pitch pattern (text + image). Duration marked `stem-flag-only` because solid/hollow encodes pitch, not duration; rhythm follows traditional stems/flags/beams/dots except a double stem indicates half notes (text). Text states Clairnote DN "has a system of alternative accidental signs, key signatures, and clefs" — hence custom clef/key-signature/accidentals (none visible in the scale image). Historical: introduced 2006 as "Expanded Black-Oval Twinline"; compact-staff aspect and alternative signatures added 2013 under the name "Clairnote"; renamed Clairnote DN ("Dual Noteheads") in 2018. |

### 30. Chromatic Lyre Notation (Jan Braunstein, 2009)

| Field | Value |
|---|---|
| `name` | Chromatic Lyre Notation |
| `creator` | Jan Braunstein |
| `year` | 2009 |
| `gallery-category` | Lines a Major 3rd Apart, 2 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/chromatic-lyre-notation-by-jan-braunstein/ |
| `sources` | https://musicnotation.org/system/chromatic-lyre-notation-by-jan-braunstein/; https://musicnotation.org/wp-content/uploads/2012/07/chromatic-lyre-notation-jan-braunstein.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [4, 8] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | traditional |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | numbers-or-letters |
| `aux.accidentals` | not-needed |
| `duration.representation` | other |
| `notes` | Same line pattern as Beyreuther's systems: lines for E and G#/Ab, ledger line for C (text) → [4, 8]; grouping-gap and mid-gap C ledger visible in image (hence `ledgers = modified`). Solid/hollow noteheads emphasize the 6-6 pitch pattern, but inverted relative to Beyreuther/Clairnote: the line-notes (whole-tone set C,D,E,F#,G#,A#) are hollow so handwritten solid dots don't blend into lines (text + image). Designed for chromatic lyres: solid vs hollow corresponds to the two string rows / hands (text). Uses a traditional alto clef to mark middle C, with 8va/8vb/15va/15vb symbols incorporated into the clef to shift the staff's register — hence `aux.octave-markers = numbers-or-letters` (text). Duration `other`: traditional except half notes have no stem, whole notes get a single vertical line on either side of the notehead, double whole notes a double line; rests follow the same convention (text). Fully chromatic placement, no accidentals or key signature mentioned or shown. |

### 31. AxLoMaFi (Jai Park, 2014)

| Field | Value |
|---|---|
| `name` | AxLoMaFi |
| `creator` | Jai Park |
| `year` | 2014 |
| `gallery-category` | Lines a Major 3rd Apart, 2 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/axlomafi-jai-park/ |
| `sources` | https://musicnotation.org/system/axlomafi-jai-park/; https://musicnotation.org/wp-content/uploads/2015/01/trine-line-by-jai-park.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [4, 8] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Originally called Trine Line (2014); renamed AxLoMaFi 2016 (text). Middle C on the ledger line, E and G# on the two staff lines (text) → [4, 8]; grouping-gap between octave line pairs and mid-gap C ledger visible in image (hence `ledgers = modified`). Shape scheme binary-6-6 via notehead ORIENTATION rather than fill: one whole-tone scale's noteheads slant upward to the right, the other's upward to the left (text + image). Fill `unknown`: the scale image shows all-solid slanted noteheads, and although the text says "rhythmic notation is the same as in traditional notation" (hence duration = traditional, including dot placement), the sources never show hollow forms. Color: monochrome baseline; noteheads are OPTIONALLY colored with a different color per pitch class (text) — optional feature only. Stems attach to the horizontal center of the notehead instead of left/right; in the original Trine Line version flags extended in the notehead's slant direction, revised in AxLoMaFi to always extend right (text). No clef, key signature, octave markers, or accidentals in image or text; fully chromatic placement. |

### 32. Chromatic Twinline (Leo de Vries, 1986)

| Field | Value |
|---|---|
| `name` | Chromatic Twinline |
| `creator` | Leo de Vries |
| `year` | 1986 |
| `gallery-category` | Lines a Major 3rd Apart, 2 per Octave, Compact Staff |
| `detail-url` | https://musicnotation.org/system/chromatic-twinline-by-leo-de-vries/ |
| `sources` | https://musicnotation.org/system/chromatic-twinline-by-leo-de-vries/; https://musicnotation.org/wp-content/uploads/2012/07/twinline-chromatic-leo-de-vries.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | compact |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | compact |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Compact Twinline-family staff: 2-line staff with the lower line E (and by the major-3rd category, the upper line G#/Ab), C on a ledger line above and below (text). Between any two adjacent lines there are only three elevations for notes (text), so the octave is vertically compressed and notes adjacent to a line crowd the line's vertical zone: DISAMBIGUATION is by notehead shape — a note resting against a line takes a semicircular shape (flat side on the line, body above or below it indicating which neighbor pitch it is), while other notes are ovals (text + image). Hence pitch-axis/compactness = compact and semitone-pattern not-derivable. Fill alternates in a 6-6 pattern: semicircles black, ovals white (text + image), and the shape classes coincide with the two whole-tone sets, so both shape and fill are binary-6-6. Image (two-octave form) shows the line pairs separated by a larger octave gap (grouping-gap) with a mid-gap C ledger, hence `ledgers = modified`. Duration: text says only "rhythmic notation is mostly traditional"; since fill is pitch-bound, the traditional hollow-half convention cannot apply and the half-note device is unspecified in the sources. No clef, key signature, octave markers, or accidentals in image or text. |

### 33. Diatonic Twinline (Leo de Vries, 1986)

| Field | Value |
|---|---|
| `name` | Diatonic Twinline |
| `creator` | Leo de Vries |
| `year` | 1986 |
| `gallery-category` | Lines a Major 3rd Apart, 2 per Octave, Compact Staff |
| `detail-url` | https://musicnotation.org/system/diatonic-twinline-by-leo-de-vries/ |
| `sources` | https://musicnotation.org/system/diatonic-twinline-by-leo-de-vries/; https://musicnotation.org/wp-content/uploads/2012/07/twinline-diatonic-leo-de-vries.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | compact |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | compact |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Identical staff geometry to Chromatic Twinline: 2-line staff (lower line E), C ledger above and below, three elevations between adjacent lines, semicircular notehead shape when a note rests against a line (text) — pitches sharing a line's vertical zone are disambiguated by shape (semicircle vs oval) and by which side of the line the semicircle's body sits. Shape classes follow the same 6-6 structural alternation as Chromatic Twinline, but FILL follows the 7-5 piano-key pattern: notehead color (solid/hollow) corresponds to black/white piano keys (text; mixed solid ovals and solid semicircles visible in image) — hence fill = by-pc-set. Intended by de Vries as a temporary transitional system toward Chromatic Twinline (text). Image (two-octave form) shows grouping-gap between line pairs and mid-gap C ledger (`ledgers = modified`). Duration: text says only "rhythmic notation is mostly traditional"; fill is pitch-bound so the half-note device is unspecified. No clef, key signature, octave markers, or accidentals in image or text. |

### 34. Twinline Notation (Thomas Reed, 1986)

| Field | Value |
|---|---|
| `name` | Twinline Notation |
| `creator` | Thomas Reed |
| `year` | 1986 |
| `gallery-category` | Lines a Major 3rd Apart, 2 per Octave, Compact Staff |
| `detail-url` | https://musicnotation.org/system/twinline-notation-by-thomas-reed/ |
| `sources` | https://musicnotation.org/system/twinline-notation-by-thomas-reed/; https://musicnotation.org/wp-content/uploads/2012/07/twinline-tom-reed.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | compact |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | compact |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | other |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | stem-flag-only |
| `notes` | Reed's modification of de Vries' Chromatic Twinline (text). Two-line staff, lower line E, C ledger above and below, three elevations between adjacent lines (text). Compact disambiguation: notes next to a line take a TRIANGULAR shape with the base resting on the closer line — image shows upward-pointing triangles sitting on a line (pitch just above) and downward-pointing triangles hanging from a line (pitch just below), vs ovals on lines and in mid-space; triangle notes are the second whole-tone set, so shape scheme is binary-6-6. Fill = `other`: ALL noteheads are white/hollow for ease of handwriting (text + image); the closed set has no all-hollow value. Duration = stem-flag-only: heads carry no duration information; rhythm is mostly traditional with a novel flag indicating half notes (text). Image (two-octave form) shows grouping-gap between octave line pairs and mid-gap C ledger (`ledgers = modified`). No clef, key signature, octave markers, or accidentals in image or text. |

### 35. Black Triangle Twinline (Doug Keislar, 2006)

| Field | Value |
|---|---|
| `name` | Black Triangle Twinline |
| `creator` | Doug Keislar |
| `year` | 2006 |
| `gallery-category` | Lines a Major 3rd Apart, 2 per Octave, Compact Staff |
| `detail-url` | https://musicnotation.org/system/black-triangle-twinline-by-doug-keislar/ |
| `sources` | https://musicnotation.org/system/black-triangle-twinline-by-doug-keislar/; https://musicnotation.org/wp-content/uploads/2012/07/twinline-black-triangle-doug-keislar.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | compact |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | compact |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Keislar's variant of Reed's Twinline (itself a version of de Vries' Twinline): same compact two-line staff (lines E and G#, C ledger, three elevations between lines), pitches crowding a line disambiguated by triangular noteheads whose base rests on the nearer line (pointing up = above the line, down = below) vs ovals (text + image). Difference from Reed: the triangles are filled SOLID like de Vries' Chromatic Twinline, emphasizing the 6-6 pitch pattern via fill in addition to shape (text; image shows solid triangles, hollow ovals) — hence shape and fill both binary-6-6. In handwriting the triangles may optionally be left hollow (= Reed's Twinline), or written as forward/backward slashes with ovals as dots (text). Duration `unknown`: the page does not describe rhythmic notation for this variant (presumably as Reed's, but not stated). Image (two-octave form) shows grouping-gap between octave line pairs and mid-gap C ledger (`ledgers = modified`). No clef, key signature, octave markers, or accidentals in image or text. |

### 36. Black-Oval Twinline (Paul Morris, 2006)

| Field | Value |
|---|---|
| `name` | Black-Oval Twinline |
| `creator` | Paul Morris |
| `year` | 2006 |
| `gallery-category` | Lines a Major 3rd Apart, 2 per Octave, Compact Staff |
| `detail-url` | https://musicnotation.org/system/black-oval-twinline-by-paul-morris/ |
| `sources` | https://musicnotation.org/system/black-oval-twinline-by-paul-morris/; https://musicnotation.org/wp-content/uploads/2012/07/twinline-black-oval-paul-morris.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | compact |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | compact |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | stem-flag-only |
| `notes` | Morris' variation on Reed's Twinline: same compact two-line staff (lines E and G#, C ledger, three elevations between adjacent lines); pitches crowding a line disambiguated by triangle-vs-oval notehead shape and by which side of the line the triangle's body sits (text + image). Inverse fill of Keislar's variant: HOLLOW triangles and SOLID ovals (text; image shows solid ovals incl. C on its ledger, hollow triangles) — shape and fill both binary-6-6. Duration = stem-flag-only: heads carry pitch, not duration; a double stem indicates half notes, otherwise traditional rhythmic notation (text). Text notes solid ovals keep quarter/eighth/sixteenth notes visually consistent with traditional notation, and mentions the POSSIBILITY of notehead alterations (e.g. small internal dots) as an alternative accidental system — potential only, not part of the system as shown, so `aux.accidentals = not-needed`. Was the original companion of (Expanded Black-Oval Twinline ->) Clairnote DN, sharing line pattern and solid/hollow pattern; briefly named "TwinNote" (2009) and earlier "White-Triangle Twinline" (text). Similar to Sotorrio's earlier Bilinear Notation, designed independently (text). Image (two-octave form) shows grouping-gap between octave line pairs and mid-gap C ledger (`ledgers = modified`). No clef, key signature, or octave markers in image or text. |

### 37. Bilinear Notation (José A. Sotorrío, 1997)

| Field | Value |
|---|---|
| `name` | Bilinear Notation |
| `creator` | José A. Sotorrío |
| `year` | 1997 |
| `gallery-category` | Lines a Major 3rd Apart, 2 per Octave, Compact Staff |
| `detail-url` | https://musicnotation.org/system/bilinear-notation-by-jose-a-sotorrio/ |
| `sources` | https://musicnotation.org/system/bilinear-notation-by-jose-a-sotorrio/; https://musicnotation.org/wp-content/uploads/2012/07/bilinear-jose-sotorrio.png; https://musicnotation.org/wp-content/uploads/2013/03/blinearcomparison2.jpg |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | compact |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | compact |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | mixed-pitch-and-duration |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | unknown |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | other |
| `aux.accidentals` | not-needed |
| `duration.representation` | other |
| `notes` | Twinline-family compact staff: each line/space holds two chromatic neighbors, disambiguated by notehead shape — ovals alternate with triangles (6-6 whole-tone alternation; both gallery images). Text: same line pattern as Twinline; Bilinear's triangles have a sharper tip angle than Twinline's right triangles. Drawn staff lines pair up (M3 within octave, larger gap across octaves — grouping-gap visible in scale image); counting the C ledger line the line grid is uniform major 3rds (C, E, G#), with C on a ledger like traditional middle C (first note of scale image sits on a short ledger). Fill/duration (text + comparison image): for quarter notes and shorter, solid ovals and hollow triangles; for half/whole notes, larger hollow ovals and hollow half-ovals replace them — notehead shape/size/fill vary by duration on top of traditional stems/flags (comparison image shows stems, flags, beams), hence duration.representation = other. Optional color system for sharps/flats/naturals (text; base system monochrome). Text: "new register symbols" (form unknown — hence aux.octave-markers = other, aux.clef = unknown); proposed standardized microtone accidentals and chord symbols. No key signature in either image. Bilinear website (www.SpectralMusic.com) no longer exists. |

### 38. TwinNote (Paul Morris, 2009)

| Field | Value |
|---|---|
| `name` | TwinNote |
| `creator` | Paul Morris |
| `year` | 2009 |
| `gallery-category` | Lines a Major 3rd Apart, 2 per Octave, Compact Staff |
| `detail-url` | https://musicnotation.org/system/twinnote-by-paul-morris/ |
| `sources` | https://musicnotation.org/system/twinnote-by-paul-morris/; https://musicnotation.org/wp-content/uploads/2012/07/twinnote-paul-morris.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | compact |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | compact |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | binary-6-6 |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | stem-flag-only |
| `notes` | Same line pattern and compact staff as the Twinline systems (text). Two notes per line and per space; disambiguation is by triangle orientation and fill: hollow point-down triangles alternate with solid point-up triangles, emphasizing the 6-6 whole-tone pattern (text + scale image). Only triangles, no ovals (deliberate, to stay visually distinct from traditional notation). Since fill carries pitch, half notes get a double stem; otherwise traditional rhythmic notation (text) — heads do not change with duration, hence stem-flag-only. C sits on a ledger line below the staff (scale image, first note); drawn staff lines pair up with a larger gap across octaves (grouping-gap; scale image); with the C ledger included the grid is uniform major 3rds. In March 2011 Morris shifted note positions up a semitone so C D E F G A B match the lines/spaces of the traditional treble staff (text). Shorthand handwritten forms exist (all-hollow, baseless triangles). No clef, key signature, or octave marker appears in image or text. |

### 39. TwinNote TD (Paul Morris, 2009)

| Field | Value |
|---|---|
| `name` | TwinNote TD |
| `creator` | Paul Morris |
| `year` | 2009 |
| `gallery-category` | Lines a Major 3rd Apart, 2 per Octave, Compact Staff |
| `detail-url` | https://musicnotation.org/system/twinnote-td-by-paul-morris/ |
| `sources` | https://musicnotation.org/system/twinnote-td-by-paul-morris/; https://musicnotation.org/wp-content/uploads/2012/07/twinnote-td-paul-morris.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | compact |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | compact |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | "Traditional duration" variant of TwinNote (text): same compact Twinline staff, two notes per line/space disambiguated by triangle orientation alone (point-down alternating with point-up, 6-6 pattern), while hollow vs. solid indicates duration exactly as in traditional notation — hence fill-scheme = duration-carrying and duration.representation = traditional. Scale image shows all-hollow triangles of both orientations (single duration sample) with the first note (C) on a ledger line below the staff. Drawn staff lines pair up with a larger gap across octaves (grouping-gap; scale image); with the C ledger included the line grid is uniform major 3rds. Same March 2011 semitone shift as TwinNote (text). No clef, key signature, or octave marker appears in image or text. |

### 40. Chromatic Nydana (Dan Lindgren, 2011)

| Field | Value |
|---|---|
| `name` | Chromatic Nydana |
| `creator` | Dan Lindgren |
| `year` | 2011 |
| `gallery-category` | Lines a Major 3rd Apart, 2 per Octave, Compact Staff |
| `detail-url` | https://musicnotation.org/system/chromatic-nydana-by-dan-lindgren/ |
| `sources` | https://musicnotation.org/system/chromatic-nydana-by-dan-lindgren/; https://musicnotation.org/wp-content/uploads/2012/07/nydana-chromatic-dan-lindren.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | compact |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | compact |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | octave-number-or-label |
| `aux.key-signature` | custom |
| `aux.octave-markers` | numbers-or-letters |
| `aux.accidentals` | not-needed |
| `duration.representation` | stem-flag-only |
| `notes` | Text: two lines per octave spaced a major third apart, same compact line pattern as the other Twinline-family systems; C sits on a ledger line (like traditional middle C), completing a uniform major-3rd line grid; drawn lines pair with a larger cross-octave gap (grouping-gap; scale image). Pitches sharing a line/space are disambiguated by shape: circles alternate with rectangles (6-6 whole-tone alternation), while black/white fill follows the 7-5 piano-key pattern (fill-scheme = by-pc-set); both confirmed by scale image (hollow circles, solid and hollow rectangles). All ink monochrome — "white" = hollow. In place of clefs, Roman numerals identify the octave (e.g. IV = middle C octave; text) — hence clef = octave-number-or-label and octave-markers = numbers-or-letters. Compact custom key signature: a single sharp or flat with a number above it giving the count in the equivalent traditional signature; natural sign denotes C major (text). Because fill carries pitch, half notes get hooked stems and whole notes/breves get novel stems; a parallel rest-symbol system reuses the same stems/flags (text) — hence stem-flag-only. Novel intonation symbols for ±23-cent and ±11-cent alterations (text). Lindgren removed Chromatic Nydana from his website in April 2012 to focus on (diatonic) Nydana. |

### 41. MUTO Notation (MUTO Foundation, 1995)

| Field | Value |
|---|---|
| `name` | MUTO Notation |
| `creator` | MUTO Music Method Foundation |
| `year` | 1995 |
| `gallery-category` | Lines a Tritone Apart, 2 per Octave, or 1 Line per Octave |
| `detail-url` | https://musicnotation.org/system/muto-notation-by-muto-foundation/ |
| `sources` | https://musicnotation.org/system/muto-notation-by-muto-foundation/; https://musicnotation.org/wp-content/uploads/2012/07/muto-muto-music-method-foundation.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-tritone |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [0, 6] |
| `staff.line-variations` | {thickness} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | line-marking |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Text: basic drawn staff is three lines spaced a tritone apart — bottom and top lines bold and both C, middle line F#/Gb — i.e. 2 distinct line pitch classes per octave, semitone pattern [0, 6] with C anchoring offset 0 (text names the lines explicitly). Bold C lines double as octave markers (line-marking) and give the thickness variation (both text and image, where outer lines render heavier). Between adjacent lines are five evenly spaced note elevations, three on ledger lines (D/E pair and G#/A# pair), so including ledgers every line is a whole step apart, a 6-6 grid of line-notes and space-notes — every semitone has its own vertical position (linear-chromatic, full-height). Ledger usage = modified: ledger lines occur at fixed positions inside the staff span as part of the pitch grid, not only beyond the staff. Scale image shows uniform hollow oval noteheads throughout (single-duration sample; some struck through by their ledger lines) — duration semantics and fill usage are not documented on the page, hence unknown. No clef or key signature in image or text. |

### 42. Thumline Notation (Jim Plamondon, 2005)

| Field | Value |
|---|---|
| `name` | Thumline Notation |
| `creator` | Jim Plamondon |
| `year` | 2005 |
| `gallery-category` | Lines a Tritone Apart, 2 per Octave, or 1 Line per Octave |
| `detail-url` | https://musicnotation.org/system/thumline-notation-by-jim-plamondon/ |
| `sources` | https://musicnotation.org/system/thumline-notation-by-jim-plamondon/; https://musicnotation.org/wp-content/uploads/2012/07/thumline-jim-plamondon.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-tritone |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | unknown |
| `staff.line-variations` | {thickness, dashed-or-dotted} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | custom-symbol |
| `aux.key-signature` | custom |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Staff like MUTO's but with alternating solid and dotted lines a tritone apart, plus two ledger lines between them giving a 6-6 whole-step grid of alternating line and space notes (text; image shows dotted and solid lines with struck-through ledger notes). Every chromatic degree has its own vertical position (linear-chromatic, full-height); ledgers = modified (fixed ledger lines inside the staff span form part of the grid). RELATIVE pitch axis: lines and spaces represent chromatic scale degrees from the tonic (solid bold line = Do, dotted line = Se), not fixed pitches — absolute pitches shift with key. Hence semitone-pattern = unknown: line spacing is clear (whole-step grid, staff lines a tritone apart) but the anchoring pitch class is key-dependent (in the depicted key of C it would be [0, 6]). Text calls the Do line "bold" — thickness + dashed-or-dotted variations. Arcs at the start of each staff point to the Do line with Se at the arc's middle (custom-symbol clef-like device). Key signature = custom: the current tonic note is given in the signature and a symbol system indicates key changes and modulation distance (text). Scale image shows uniform hollow oval noteheads only; duration and fill semantics not documented — unknown. Designed for the Thummer isomorphic instrument; the page questions general-purpose suitability. |

### 43. Express Stave: Pianoforte Notation (John Keller, 2010)

| Field | Value |
|---|---|
| `name` | Express Stave: Pianoforte Notation |
| `creator` | John Keller |
| `year` | 2010 |
| `gallery-category` | Lines a Tritone Apart, 2 per Octave, or 1 Line per Octave |
| `detail-url` | https://musicnotation.org/system/express-stave-by-john-keller/ |
| `sources` | https://musicnotation.org/system/express-stave-by-john-keller/; https://musicnotation.org/wp-content/uploads/2021/03/express-stave-pianoforte-notation.png; https://musicnotation.org/wp-content/uploads/2012/07/express-stave-reverse-color-clefs.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-tritone |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [2, 8] |
| `staff.line-variations` | none |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | custom-symbol |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | other |
| `notes` | Keller's preferred/official Express Stave version (renamed from "Reverse-Color" in Feb 2021). Drawn staff: three lines spanning one octave, middle line D, top and bottom lines G#/Ab (text) → 2 line pitch classes per octave, uniform tritone spacing, semitone pattern [2, 8]. Text supports linear-chromatic/full-height: five elevations between adjacent lines, one per semitone — B and F sit midway touching neither line, notes a semitone from a line overlap it slightly, notes two semitones away touch it lightly (scale image shows a steady fine-stepped ascent). Fill carries pitch in the INVERSE of the 7-5 piano-key pattern: naturals ABCDEFG solid/black, "black-key" notes hollow/white (text + image) — by-pc-set; monochrome ink. Ledgers conventional: a D ledger line a tritone above/below the staff appears for the five nearby notes C, C#, D, D#, E (text; top C of scale image carries it); multi-octave ranges stack one-octave staves with the D ledger midway. Three custom clef symbols — F, B, and D clefs replacing bass, treble, and middle clefs (text + clefs image); an additional piano-symbol device left of the staff identifies the D and G# lines. Duration = other: traditional rhythm notation except half and whole notes take a short vertical line on each side of the notehead (breve-like), needed because hollow/solid encodes pitch (text). Accompanying A–L note-naming scheme (I, J for the 2-black-key group; K, L, H for the 3-black-key group). No key signature or octave numeral observed in image or text. |

### 44. Express Stave, 6-6 Jazz Font (John Keller, 2009)

| Field | Value |
|---|---|
| `name` | Express Stave, 6-6 Jazz Font |
| `creator` | John Keller |
| `year` | 2009 |
| `gallery-category` | Lines a Tritone Apart, 2 per Octave, or 1 Line per Octave |
| `detail-url` | https://musicnotation.org/system/express-stave-6-6-jazz-font-by-john-keller/ |
| `sources` | https://musicnotation.org/system/express-stave-6-6-jazz-font-by-john-keller/; https://musicnotation.org/wp-content/uploads/2012/07/express-stave-reverse-color-john-keller1.png; https://musicnotation.org/wp-content/uploads/2012/07/express-stave-reverse-color-clefs.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-tritone |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [2, 8] |
| `staff.line-variations` | none |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | custom-symbol |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | other |
| `notes` | "Jazz font" variation of Express Stave: Pianoforte Notation, recommended by Keller for handwriting; staff, ledgers, fill pattern, and rhythm devices are per the Pianoforte version ("For full details, see Express Stave: Pianoforte Notation" — text), i.e. lines at D and G#/Ab a tritone apart ([2, 8]), one elevation per semitone, D ledger a tritone beyond the staff (top note of scale image carries a short ledger), and half/whole notes marked with side strokes (duration = other). Adds a subtle 6-6 pitch pattern via notehead SLANT: half the noteheads sharply slanted, the other half lying flat, alternating by whole-tone set (text + scale image showing alternating slanted/flat solid and hollow ovals) — recorded as shape-scheme binary-6-6 on top of the 7-5 by-pc-set fill. This version introduced the custom F, B, and D clef symbols (text + clefs image). Originally introduced Feb 2009 with the Original Version's color pattern (F and B then had no center dash/spot because slant distinguished them); in Feb 2021 Keller reversed the color pattern to match Pianoforte Notation — current form has no internal glyphs. No key signature or octave marker observed. |

### 45. Express Stave, Original Version (John Keller, 2005)

| Field | Value |
|---|---|
| `name` | Express Stave, Original Version |
| `creator` | John Keller |
| `year` | 2005 |
| `gallery-category` | Lines a Tritone Apart, 2 per Octave, or 1 Line per Octave |
| `detail-url` | https://musicnotation.org/system/express-stave-original-version-by-john-keller/ |
| `sources` | https://musicnotation.org/system/express-stave-original-version-by-john-keller/; https://musicnotation.org/wp-content/uploads/2012/07/express-stave-john-keller.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-tritone |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [2, 8] |
| `staff.line-variations` | none |
| `staff.compactness` | full-height |
| `ledgers.usage` | conventional |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | symbols |
| `aux.clef` | traditional |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | other |
| `notes` | Original 2005 version (Keller now prefers Pianoforte Notation). Same staff geometry: three drawn lines, middle D, top/bottom G#/Ab, a tritone apart → [2, 8], 2 line pitch classes per octave. Five elevations between adjacent lines, one per semitone; B and F sit midway touching neither line; remaining notes touch a line lightly or with slight overlap (text; scale image shows the fine-stepped ascent) → linear-chromatic, full-height. Text caveat: "in handwritten form no distinction in vertical position is required" for the line-touching notes — notehead color alone disambiguates, so handwritten practice degrades toward compact. Fill = by-pc-set: black/white noteheads DIRECTLY match the 7-5 piano-key colors (naturals white/hollow, black-key notes solid), resembling piano tablature (text; scale image starts on a hollow C). B and F may carry a center dash or spot as extra identification (text) → internal-glyphs = symbols. Clefs: this version used the three traditional clefs (bass, treble, alto) as register indicators for lower/higher/middle A-to-G ranges → traditional. Duration = other: traditional rhythm except half and whole notes take short vertical side-strokes (breve-like), since fill encodes pitch. Historical (text): the Nov 2005 form had bold G# lines, a dotted middle-D line a tritone beyond the staff, and double-stemmed half notes — all removed Dec 2007 (partly due to Finale limitations); current form has no line variations. Top note of scale image sits on a ledger line (conventional D ledger). No key signature or octave numeral observed. |

### 46. Express Stave, Tricolor Version (John Keller, 2010)

| Field | Value |
|---|---|
| `name` | Express Stave, Tricolor Version |
| `creator` | John Keller |
| `year` | 2010 |
| `gallery-category` | Lines a Tritone Apart, 2 per Octave, or 1 Line per Octave |
| `detail-url` | https://musicnotation.org/system/express-stave-tricolor-version-john-keller/ |
| `sources` | https://musicnotation.org/system/express-stave-tricolor-version-john-keller/; https://musicnotation.org/wp-content/uploads/2015/08/express-stave-tri-color-john-keller.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-tritone |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [2, 8] |
| `staff.line-variations` | none |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | custom-symbol |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Semitone pattern [2, 8] derived from pixel analysis of the gallery image: lines evenly spaced a tritone apart with the D notehead sitting on one line and G# on the next (chromatic scale ascends in even ~2.9px semitone steps → linear-chromatic). Tricolor scheme (text + image): three "colors" alternate up the chromatic scale so each diminished-7th chord is one color — solid black {C,D#,F#,A}, hollow white {C#,E,G,A#}, and "gray" {D,F,G#,B} rendered as a notehead with a staff line or short ledger line through it (image confirms theta-like line-through heads on F and B). Ledgers marked `modified` because short lines double as the gray-color marker inside the staff (F, B), besides the conventional stroke on the high C. Clef: text says Keller's novel clef symbols (shown on the main Express Stave page) are used → custom-symbol; not visible in the gallery image. Duration `unknown`: fill is used for pitch color, and the page does not describe rhythm notation. Text notes Keller now prefers his 7-5-colored Express Stave versions over this one. |

### 47. Untitled (Robert Stuckey, 1983)

| Field | Value |
|---|---|
| `name` | Untitled |
| `creator` | Robert Stuckey |
| `year` | 1983 |
| `gallery-category` | Lines a Tritone Apart, 2 per Octave, or 1 Line per Octave |
| `detail-url` | https://musicnotation.org/system/untitled-by-robert-stuckey/ |
| `sources` | https://musicnotation.org/system/untitled-by-robert-stuckey/; https://musicnotation.org/wp-content/uploads/2012/07/untitled-robert-stuckey.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-tritone |
| `staff.lines-per-octave` | 2 |
| `staff.semitone-pattern` | [0, 6] |
| `staff.line-variations` | none |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | other |
| `noteheads.fill-scheme` | other |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | numbers |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | stem-flag-only |
| `notes` | Text: characters 0,1,2,3,4,5,6,7,8,9,X,N replace noteheads, one per chromatic pitch, placed at twelve elevations on a 3-line staff spanning an octave; upper and lower lines are C, middle line is F# → pattern [0, 6]. Gallery image confirms evenly spaced lines a tritone apart (5 lines shown covering two octaves) with digits ascending in even steps. Shape/fill marked `other` because the "noteheads" are numeral/letter glyphs with no solid-hollow dimension; internal-glyphs `numbers` (X and N serve as 10 and 11). Absolute-pitch system, not relative. Duration `stem-flag-only` is an inference from text ("Stems extend upward or downward from the numbers") plus uniform glyph heads; flags/beams not documented. No stems or ledgers appear in the sample image. Stuckey has withdrawn the proposal. |

### 48. Untitled (Nicolai Dolmatov, 1995)

| Field | Value |
|---|---|
| `name` | Untitled |
| `creator` | Nicolai Dolmatov |
| `year` | 1995 |
| `gallery-category` | Lines a Tritone Apart, 2 per Octave, or 1 Line per Octave |
| `detail-url` | https://musicnotation.org/system/untitled-by-nicolai-dolmatov/ |
| `sources` | https://musicnotation.org/system/untitled-by-nicolai-dolmatov/; https://musicnotation.org/wp-content/uploads/2012/07/untitled-nicolai-dolmatov.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-octave |
| `staff.lines-per-octave` | 1 |
| `staff.semitone-pattern` | [0] |
| `staff.line-variations` | none |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | binary-6-6 |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Text: standard staff is three widely spaced horizontal lines (~12mm apart), each representing C, spanning two octaves → 1 line per octave, pattern [0]; gallery image confirms three evenly spaced lines with the chromatic scale ascending in even steps between them (linear-chromatic). Noteheads alternate traditional oval and small "x", six of each per octave → binary-6-6 shape scheme (image confirms alternation). Ledgers `modified`: text says ledger lines representing E and G#/Ab occur as needed, i.e. at fixed chromatic positions inside the wide octave gap rather than only extending the staff outward. Duration `traditional` per text ("Traditional stems, flags etc. are used"); fill-scheme `unknown` because sources do not state whether hollow/solid ovals mark duration (the "x" heads have no fill dimension). |

### 49. Klavar, Mirck Version (Jean de Buur, 2006)

| Field | Value |
|---|---|
| `name` | Klavar, Mirck Version |
| `creator` | Jean de Buur |
| `year` | 2006 |
| `gallery-category` | 7-5 Line Pattern, 3, 5, or 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/klavar-mirck-version-by-jean-de-buur/ |
| `sources` | https://musicnotation.org/system/klavar-mirck-version-by-jean-de-buur/; https://musicnotation.org/wp-content/uploads/2012/07/klavar-mirck-jean-de-buur.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | keyboard-7-5 |
| `staff.lines-per-octave` | 5 |
| `staff.semitone-pattern` | [1, 3, 6, 8, 10] |
| `staff.line-variations` | {thickness, grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | proportional-spatial |
| `notes` | Explicitly de Buur's HORIZONTAL and pitch-proportional variation of Klavar (text). 7-5 line pattern: lines are the five black-key notes (groups of 2 and 3), spaces are the C-major/white-key notes → pattern [1, 3, 6, 8, 10]; the gap between the 2-line and 3-line groups is 1.5 spaces so spacing is exactly pitch-proportional (text + pixel analysis of image: 4px per semitone throughout). Line variations: grouping-gap (1.5-space inter-group gap) and thickness — text says the group of three lines is "slightly darker" than the group of two; in the gallery image the 3-group renders heavier (2px vs 1px), so this may equally be a gray-vs-black color distinction. Noteheads circular: black on lines (black keys), white in spaces (white keys) → fill by-pc-set (7-5). Duration proportional: distance between note stems indicates timing (text). Notes generally sit right of the stem (unlike Klavar's black-left/white-right rule), except in chords. An accompanying solfege-based naming scheme adds names for the five black-key notes. |

### 50. Klavar, Dekker Version (Antoon Dekker, 2015)

| Field | Value |
|---|---|
| `name` | Klavar, Dekker Version |
| `creator` | Antoon Dekker |
| `year` | 2015 |
| `gallery-category` | 7-5 Line Pattern, 3, 5, or 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/klavar-dekker-version-by-antoon-dekker/ |
| `sources` | https://musicnotation.org/system/klavar-dekker-version-by-antoon-dekker/; https://musicnotation.org/wp-content/uploads/2015/08/klavar-dekker-antoon-dekker.png; https://musicnotation.org/wp-content/uploads/2012/07/klavar-dekker-and-standard.png |
| `staff.orientation` | vertical |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | keyboard-7-5 |
| `staff.lines-per-octave` | 5 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {thickness, grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | proportional-spatial |
| `notes` | Orientation VERTICAL: text states Dekker retains the vertical orientation of the original Klavar staff and that the gallery chromatic-scale image is rotated 90° for display; the comparison image (klavar-dekker-and-standard.png) confirms vertical staves. Hence semitone-pattern not-derivable; the pattern equivalent along the pitch axis is the 7-5 black-key line set (as Mirck). Identical to Pot's Klavar except: (1) pitch axis is pitch-proportional as in Mirck → linear-chromatic; (2) notehead placement left/right of the stem follows a 6-6 pattern (C,D,E,F#,G#,A# on one side; C#,D#,F,G,A,B on the other), making interval/chord shapes transposition-invariant and matching a Jankó-style 6-6 keyboard. Noteheads circular, black-key notes black on lines, white-key notes white in spaces (7-5 fill). Line variations from gallery image: 3-line group heavier/darker than 2-line group, inter-group gap 1.5 spaces. Duration proportional-spatial inferred from "identical to Klavar" (Klavar rhythm is proportional; the two stated exceptions do not concern rhythm). |

### 51. ChromaTonnetz (Joe Austin, 2010)

| Field | Value |
|---|---|
| `name` | ChromaTonnetz |
| `creator` | Joe Austin |
| `year` | 2010 |
| `gallery-category` | 7-5 Line Pattern, 3, 5, or 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/chromatonnetz-by-joe-austin/ |
| `sources` | https://musicnotation.org/system/chromatonnetz-by-joe-austin/; https://musicnotation.org/wp-content/uploads/2014/02/tonnetz-based-4x3-joe-austin.png |
| `staff.orientation` | vertical |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | keyboard-7-5 |
| `staff.lines-per-octave` | 5 |
| `staff.semitone-pattern` | not-derivable |
| `staff.line-variations` | {dashed-or-dotted, grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | by-pc-set |
| `noteheads.fill-scheme` | by-pc-set |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | other |
| `notes` | Orientation recorded `vertical` per text ("The above staff is similar to Mirck but it is usually vertically oriented as in Klavar"); the gallery image shows it rotated horizontal, where the line pattern equivalent is [1, 3, 6, 8, 10] with C# and D# as DASHED lines (vs Mirck's gray) — image confirms 3 solid + 2 dashed lines per octave at pitch-proportional spacing. The notehead system is staff-agnostic: Austin says it can be used with any staff, or none, including the traditional staff. Noteheads: triangles in 4 orientations x 3 fill patterns (solid black, open white, and "gray" approximated by a smaller nested triangle) giving each of the 12 pitch classes a unique appearance (a chromatic shape-note system, confirmed in image). Same orientation = same augmented triad; same fill = same diminished-7th chord. Shape and fill both recorded by-pc-set; the nested inner triangle is a fill rendering, not an internal pitch glyph. Duration `other`: any rhythm notation independent of notehead shape/fill works — e.g. traditional slightly modified (double-stemmed half notes) or stemless proportional spacing with rest (%) and continue (") symbols. Movable-do use possible (shape series transposed to the tonic). |

### 52. Keyboard (7-5) Trigram Notation (Richard Parncutt, 1989)

| Field | Value |
|---|---|
| `name` | Keyboard (or 7-5) Trigram Notation |
| `creator` | Richard Parncutt |
| `year` | 1989 |
| `gallery-category` | 7-5 Line Pattern, 3, 5, or 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/keyboard-7-5-trigram-notation-by-richard-parncutt/ |
| `sources` | https://musicnotation.org/system/keyboard-7-5-trigram-notation-by-richard-parncutt/; https://musicnotation.org/wp-content/uploads/2012/07/7-5-trigram-richard-parncutt.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | keyboard-7-5 |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | [6, 8, 10] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | unknown |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | unknown |
| `notes` | Text: a group of three solid staff lines alternates with a group of two LEDGER lines; 7-5 pattern much like Mirck (lines = black keys, spaces = C-major/white keys), inter-group distance 1.5 spaces so note spacing is even and pitch-proportional. Only the 3-line group (F#, G#, A#) is drawn as full staff lines → 3 lines per octave, pattern [6, 8, 10]; pixel analysis of the image confirms 3 solid lines per octave at 2-semitone spacing with an 8-semitone gap to the next group. The C#/D# pair appear only as short ledger lines when needed → ledgers `modified` (routine mid-gap positions inside the octave, seen through/near the low C–E notes in the image). interval-structure recorded keyboard-7-5 per the page's own "7-5 line pattern" description, noting 2 of the 5 line positions are ledgers. Gallery sample shows uniform hollow (semibreve-style) oval noteheads; whether fill carries duration is unstated → fill-scheme and duration unknown (page describes only the staff). |

### 53. Avique Notation (Anne and Bill Collins, 1974)

| Field | Value |
|---|---|
| `name` | Avique Notation |
| `creator` | Anne and Bill Collins |
| `year` | 1974 |
| `gallery-category` | 7-5 Line Pattern, 3, 5, or 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/avique-notation-by-anne-and-bill-collins/ |
| `sources` | https://musicnotation.org/system/avique-notation-by-anne-and-bill-collins/; https://musicnotation.org/wp-content/uploads/2012/07/avique-anne-bill-collins.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | other-mixed |
| `staff.lines-per-octave` | 6 |
| `staff.semitone-pattern` | [0, 4, 5, 7, 9, 11] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Inverse of the Mirck 7-5 staff (text): lines represent the seven C-major/white-key notes, black keys sit in spaces; no space exists between E-F and B-C (those line pairs are closer together). D is drawn as a ledger line in the middle of the single-octave staff, so the full staff lines per octave are C, E, F, G, A, B → 6 lines, pattern [0, 4, 5, 7, 9, 11], D(2) on a mid-staff ledger → ledgers `modified` (image confirms the ledger stroke through D). Pixel analysis confirms pitch-proportional spacing (1-semitone E-F/B-C line gaps exactly half the 2-semitone gaps) → linear-chromatic. interval-structure `other-mixed` (adjacent staff-line intervals 4,1,2,2,2,1 semitones); the page's own framing is a "7-5 line pattern" with lines on white keys. Gallery sample shows uniform hollow oval (semibreve-style) noteheads; text: "Traditional rhythmic notation is used" → duration traditional, fill duration-carrying. |

### 54. 0-5-7 Notation (Richard Parncutt, 1984)

| Field | Value |
|---|---|
| `name` | 0-5-7 Notation |
| `creator` | Richard Parncutt |
| `year` | 1984 |
| `gallery-category` | 7-5 Line Pattern, 3, 5, or 6 Lines per Octave |
| `detail-url` | https://musicnotation.org/system/0-5-7-notation-by-richard-parncutt/ |
| `sources` | https://musicnotation.org/system/0-5-7-notation-by-richard-parncutt/; https://musicnotation.org/wp-content/uploads/2012/07/0-5-7-notation-richard-parncutt.png |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | other-mixed |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | [0, 5, 7] |
| `staff.line-variations` | {grouping-gap} |
| `staff.compactness` | full-height |
| `ledgers.usage` | modified |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | duration-carrying |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | none-observed |
| `aux.accidentals` | not-needed |
| `duration.representation` | traditional |
| `notes` | Text: 7-5 conceptual grid where every line or ledger line is a white-key note; the three fully visible staff lines are C, F, G (hence "0-5-7" / "C-F-G" notation) → pattern [0, 5, 7]; D, E, A, B appear as ledger lines and black keys sit on spaces → ledgers `modified` (image confirms ledger strokes through D, E, A, B mid-gap). Pixel analysis of the image confirms pitch-proportional spacing (C-F and G-C gaps 20px = 5 semitones, F-G 8px = 2 semitones at 4px/semitone) → linear-chromatic. interval-structure `other-mixed` (adjacent staff-line intervals 5,2,5 semitones); the page's own framing is a "7-5 line pattern". No space between E-F or B-C line positions (those pairs closer together). Gallery sample shows uniform hollow oval (semibreve-style) noteheads; text: "Traditional rhythmic notation is used" → duration traditional, fill duration-carrying. |

## Supplementary record (out-of-gallery)

Dodeka is not listed in the gallery (verified against the harvested index of
54 detail links, 2026-07-06; musicnotation.org lists it only on its "More
Notation Systems" page). Per the set spec it is recorded here as a
supplementary out-of-gallery entry, because it is the platform's known
reference case for the duration-encoding constraint.

### S1. Dodeka Music Notation (Jacques-Daniel Rochat, unknown)

| Field | Value |
|---|---|
| `name` | Dodeka Music Notation |
| `creator` | Jacques-Daniel Rochat |
| `year` | unknown (Wikipedia: "invented and designed in the 1980s"; no single year given) |
| `gallery-category` | out-of-gallery |
| `detail-url` | https://dodekamusic.com/learn/alternative-music-notation/dodeka-alternative-music-notation/ |
| `sources` | https://dodekamusic.com/learn/alternative-music-notation/dodeka-alternative-music-notation/ (text + images `files/small-802.png`, `small-805.png`, `small-823.png`, `small-835.png`); https://en.wikipedia.org/wiki/Dodeka_music_notation; https://musicnotation.org/systems/more-notation-systems/ (listing + criteria references) |
| `staff.orientation` | horizontal |
| `staff.pitch-axis` | linear-chromatic |
| `staff.interval-structure` | uniform-major-3rd |
| `staff.lines-per-octave` | 3 |
| `staff.semitone-pattern` | [0, 4, 8] |
| `staff.line-variations` | none |
| `staff.compactness` | full-height |
| `ledgers.usage` | none-observed |
| `noteheads.shape-scheme` | uniform |
| `noteheads.fill-scheme` | all-solid |
| `noteheads.color-scheme` | monochrome |
| `noteheads.internal-glyphs` | none |
| `aux.clef` | none-observed |
| `aux.key-signature` | none-observed |
| `aux.octave-markers` | unknown |
| `aux.accidentals` | not-needed |
| `duration.representation` | proportional-spatial |
| `notes` | Line pitches are stated by the source text: "on the line (C, E, G#); above the line (C#, F, A); between the lines (D, F#, A#); and under the line (D#, G, B)" — hence semitone pattern [0, 4, 8] with C on a line. The site draws one octave as a four-line block ("DODEKA's four-line structure", `small-802.png`): the 4th line is the next octave's C, so the per-octave period is 3 lines. Duration is the platform-relevant attribute: "the easiest way to indicate the length of a note is to give it a horizontal size proportional to its duration" (piano-roll-like bar length; `small-823.png` shows uniform solid rectangular noteheads for all 12 pitch classes). Multi-octave diagrams (`small-805.png`) show out-of-staff notes (e.g. C6, E-1) without ledger lines. Octave labels (C1…C6) appear in teaching diagrams, but whether scores carry octave markers is not determinable from the sources. No clef glyph, key signature, or accidental appears in any consulted notation image; the system's own text says sheet music "is devoid of any accidentals". Dodeka uses its own note-letter names (C K D T E F H G P A V B, `small-823.png`) as pedagogy, not as in-notehead glyphs. The notation was co-designed with the Dodeka isomorphic keyboard. |
