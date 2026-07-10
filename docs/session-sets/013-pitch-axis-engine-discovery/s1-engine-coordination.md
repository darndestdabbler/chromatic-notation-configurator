# Set 013 Session 1 — Engine capability discovery: pitch axis (I2 relaxation)

**Date:** 2026-07-10
**Engine repo inspected:** `d:/Projects/lilypond-chromatic-notation-base`
(local clone of `lilypond-chromatic-notation-base`, LilyPond 2.24.2), files
`cnb/noteheads.ly`, `cnb/staff.ly`, `cnb/ledgers.ly`, `cnb/stems.ly`,
`cnb/dots.ly`, `cnb/articulations.ly`, `cnb/keysig.ly`, `cnb/clefs.ly`,
`cnb/config.ly`, `cnb/layout.ly`, `cnb/procedure.ly`.
**Purpose (spec steps 1–4):** determine whether the CNB engine can place
noteheads, stems, and ledgers from an arbitrary, many-to-one
semitone→staff-position map (the design consult's proposed
`cnb:get-pitch-staff-position` hook), evidenced by an actual engine render of
a hand-authored compact-axis proof; name the minimal engine change; reach a
defensible GO / NO-GO. Per binding rule 2, **no `cnb/` source was changed and
nothing was committed to the engine repo** — the proof is a throwaway
score-level coercion.

---

## RECOMMENDATION: **GO**

The engine placed a Twinline-like compact axis (12 pitch classes on 7
positions per octave, five shared-position pairs) **exactly** — 35/35
noteheads at the mapped staff positions, 7/7 expected ledger lines at mapped
axis positions with all negative cases correct, stems attached to and
directed from the mapped geometry — from a score-level override that
approximates the proposed hook (a post-placement coercion of the same
formula site; see §2.1 for its limits), with **no engine-source changes at
all**.

Scope of the GO, stated precisely: the spike proves **vertical-placement
feasibility** — that noteheads, stems, and ledgers follow an arbitrary
many-to-one semitone→staff-position procedure. Clean compact-axis rendering
additionally requires at least one further bounded engine change beyond the
vertical hook: chord-internal horizontal arrangement is diatonic-derived
(`staff-position`-based, not geometry-based), so the `x-offset`
disambiguation for chords needs its own decided mechanism — measured in
§3.4 and named as engine work item E13-2. Collision behavior beyond
single-voice chords was only partially explored (§3.4, §5). Neither finding
requires an engraver rewrite; the consult's STOP condition ("cannot consume
an arbitrary semitone→staff-position procedure without a large engraver
rewrite") is **not met**.

---

## 1. The engine's placement model today (spec step 1)

### 1.1 Noteheads: ONE formula, one site, sets `Y-offset` directly

The notehead engraver (`cnb/noteheads.ly:83-109`) is the **single place**
where a semitone becomes a vertical coordinate. For every NoteHead grob it
executes (noteheads.ly:101-105):

```scheme
;; Set the vertical position based on semitone value.
(ly:grob-set-property! grob 'Y-offset
      (* (+ note-semis (* 2 middleCPosition))
         (/ 1 cnb:semitones-per-staff-space)
         staff-space))
```

Two properties of this site are decisive for the pitch-axis question:

- **It sets `Y-offset` as a plain number** — a continuous quantity, not a
  quantized staff step. Nothing constrains the value to be linear in the
  semitone; any finite value renders.
- **It never sets `staff-position`.** The engine leaves LilyPond's own
  (diatonic, pitch-derived) `staff-position` property untouched and simply
  overrides the geometry.

### 1.2 The vertical-placement consumers read the geometry back, not the pitch

The load-bearing architectural fact for this discovery: LilyPond's
`Staff_symbol_referencer` derives a grob's staff position **geometry-first**
(from its actual Y coordinate relative to the staff symbol), so the
*vertical-placement* consumers listed below see the *placed* position, not
the linear formula or the diatonic pitch. This is deliberately a claim about
these enumerated consumers, verified empirically in §3 — NOT about every
grob property: chord-internal **horizontal** arrangement reads the diatonic
`staff-position` property instead, as §3.4 measures (the one counterexample
found, handled by work item E13-2):

- **Ledger lines.** LilyPond's native ledger machinery calls
  `StaffSymbol.ledger-positions-function` with the notehead's geometric
  position; the engine installs its proximity rule there
  (`cnb:ledger-positions-function`, ledgers.ly:253-258; wired by the
  staff-symbol engraver, staff.ly:312-323). Ledger candidates are
  auto-generated from `cnb:staff-line-positions` spacing
  (`cnb:auto-generate-ledger-candidates`, ledgers.ly:120-151) — pure
  staff-position-space logic with no semitone input anywhere.
- **Augmentation dots** read `(ly:grob-staff-position parent)` (geometric)
  and reuse the proximity rule (dots.ly:69-112).
- **Articulations** likewise (`ly:grob-staff-position note-head`,
  articulations.ly:90-105).
- **Stems.** LilyPond computes stem extent and default direction from the
  noteheads' geometric positions; the engine's own stem code
  (`cnb:stem-attachment`, stems.ly:48-77) selects the attachment point by
  **pitch class and duration** from the config cache — axis-agnostic — and
  `cnb:compensate-stem-length` (stems.ly:113-127) depends only on
  `staff-space`.
- **Collisions.** `NoteCollision.note-collision-threshold` /
  `Stem.note-collision-threshold` are plain thresholds (layout.ly:97-98)
  applied by LilyPond to observed positions.

**Consequence:** a non-linear, many-to-one pitch→position map inserted at the
one formula in §1.1 propagates to ledgers, dots, articulations, stem extents,
and stem directions *automatically* — there is no second **vertical**
placement pipeline to rewrite. (The spike below confirms this empirically
for noteheads, stems, and ledgers rather than by argument; dots and
articulations share the same geometric read but were not separately
exercised in the spike.) Horizontal chord arrangement is the exception,
per §3.4.

### 1.3 The other linear sites (secondary consumers of the hook)

Grepping the engine for `cnb:semitones-per-staff-space` /
`ly:pitch-semitones` finds exactly two other places that convert semitones to
vertical positions, both self-contained stencil builders:

- **Key signature** (`cnb/keysig.ly:217-248`): places the notehead-chord
  marks at `semi × (1/sps)` staff-spaces. Would consume the same hook when a
  pitch axis is enabled (bounded change, same shape as the notehead one).
- **Clef** (`cnb/clefs.ly:203-261`): anchors the custom-clef glyph in
  semitone units ÷ sps. Same remark.

`cnb/off-key.ly`, `cnb/beams.ly`, `cnb/stencils.ly` use semitones only for
pitch-class identity (config lookup), never for vertical placement.

### 1.4 Where the map must intervene — answer to spec step 1

Exactly one primary site (`cnb/noteheads.ly:102-105`) and two secondary
stencil-builder sites (keysig, clef). Everything else follows the geometry.

---

## 2. The throwaway proof (spec step 2)

### 2.1 Design

`s1-evidence/pitch-axis-spike.ly` (also inlined in Appendix A) coerces the
engine into a compact axis **without touching engine source**, by adding a
score-level engraver that re-sets `NoteHead.Y-offset` at
`stop-translation-timestep` — i.e., deterministically *after* the engine's
own acknowledger has applied the linear formula — from a simulated hook with
the proposed signature:

> **What this coercion is and is not.** It is a proof of *post-placement*
> feasibility: it demonstrates that overriding the §1.1 formula's output
> propagates through everything that reads geometry (ledgers, stem extents,
> stem directions). It is an **approximation of** — not fully equivalent
> to — an actual engine hook: it runs later in the timestep than the
> engine's acknowledger would call the hook, and it leaves LilyPond's
> diatonic `staff-position` property untouched, so it cannot validate (and
> §3.4 shows it does not control) behaviors that depend on
> `staff-position`-based logic or earlier layout phases — chord-internal
> horizontal arrangement being the measured case. Those belong to the
> engine-side work items in §6.

```scheme
#(define (spike:get-pitch-staff-position semitone) ...)
;; semitone → LilyPond staff position (half-staff-spaces from center)
```

- **Axis:** the design consult's Twinline-like map — pc→position
  `[0,0,1,2,2,3,3,4,5,5,6,6]`, octave stride 7. Shared pairs: (C,C♯) (D♯,E)
  (F,F♯) (G♯,A) (A♯,B); D and G unshared. Anchor: middle C at LilyPond
  position −4.
- **Staff:** `cnb:staff-line-positions '(-3 -1 1 4 6 8)` — 3 lines per
  octave at axis positions {1,3,5}, two octaves shown (an asymmetric compact
  staff with an internal 3-half-space gap between positions 1 and 4).
- **Disambiguation:** the sharper member of each shared pair
  (pcs {1,4,6,9,11}) has its notehead stencil translated **+0.85
  staff-spaces right** via `ly:stencil-translate-axis` — the mechanism an
  engine-side `(x-offset . N)` field would use (moving the stencil moves the
  grob's extent, unlike `extra-offset`).
- **Score:** the full chromatic octave in crotchets, second-octave spot
  checks, above/below-staff ledger exercises, shared-position chords
  (`<c' cis'>`, `<gis' a'>`, `<f' fis'>`), a spanning chord (`<c' g'>`),
  repeat-mode minims, and a semibreve. Clef and keysig displays were set to
  `'none` to isolate the placement question.
- **Control:** `pitch-axis-spike-ctrl.ly` — byte-identical except
  `spike:x-offset 0.0` — isolates exactly what the x-offset mechanism does.

One LilyPond-API correction was needed during authoring: the Scheme-engraver
timestep slot is named `stop-translation-timestep` (LilyPond silently ignores
unknown slot names — an initial `end-translation-timestep` spelling left the
linear placement in force, caught because the measured render matched the
linear formula exactly, `pos = semi − 12` for the default treble
`middleCPosition = −6`).

### 2.2 Render and measurement method

Rendered with the real engine from the engine repo root:

```
lilypond -dbackend=svg -o <scratchpad>/pitch-axis-spike <scratchpad>/pitch-axis-spike.ly
  → Success: compilation successfully completed  (exit 0)
```

with `cnb/test-ids.ly` included, so every notehead/stem/ledger carries
`data-midi` / measure / beat attributes in the SVG. Measurement:
`tools/harvest_svg.py` (the set-007 instrument) → structured JSON →
`s1-evidence/measure_spike.py` derives each element's **true LilyPond staff
position** from absolute SVG y using the staff extremes (top line = +8,
bottom line = −3, 11 half-spaces apart) and compares against the map.
Complete transcript with exit code: `s1-evidence/measure_transcript.txt`.
The LedgerLineSpanner is a single spanner grob per system, so individual
ledger lines were additionally extracted directly from the SVG stencil
(seven `<rect>`s; rect center = rect top + half thickness).

---

## 3. Measured results (spec step 2, evidence)

### 3.1 Noteheads: 35/35 exact

Every notehead in the render sits at the mapped position with a constant
measured delta of **+0.010 half-staff-space** (= half the staff-line
thickness, a harvester line-edge-vs-center artifact; uniform across all 35,
including both renders). Excerpt (full table in
`s1-evidence/measure_transcript.txt`):

| note | semi | pc | expected pos | measured pos |
|---|---|---|---|---|
| c′ | 0 | 0 | −4 | −3.990 |
| c♯′ | 1 | 1 | −4 | −3.990 |
| d′ | 2 | 2 | −3 | −2.990 |
| … all 12 pcs … | | | | all Δ = +0.010 |
| c″ (stride) | 12 | 0 | +3 | +3.010 |
| c‴ | 24 | 0 | +10 | +10.010 |
| b (negative octave) | −1 | 11 | −5 | −4.990 |
| g | −5 | 7 | −7 | −6.990 |

**Verdict: `notehead placement: 35/35 at expected mapped position, 0
mismatches`.** Many-to-one confirmed: all five shared pairs coincide
(measured Δpos = 0.000 within pairs); the octave stride of 7 and euclidean
negative-octave arithmetic both place exactly.

### 3.2 Ledger lines: 7/7 correct in axis coordinates, negatives correct

The LedgerLineSpanner is one spanner grob per system, so the harvester
reports it as a single element (`ledger-lines=1` in
`measure_transcript.txt`); the individual ledger lines are the `<rect>`s
inside its stencil. `s1-evidence/extract_ledgers.py` walks the tagged
spanner subtree and prints each rect with its true staff position
(rect center = rect top + half height); its complete transcript with exit
code is `s1-evidence/ledger_extraction_transcript.txt`:

```
ledger rect 1: x=68.066 ... y_center=11.845 staff_position=-4.991
ledger rect 2: x=68.066 ... y_center=12.845 staff_position=-6.991
ledger rect 3: x=65.868 ... y_center=11.845 staff_position=-4.991
ledger rect 4: x=63.669 ... y_center=11.845 staff_position=-4.991
ledger rect 5: x=60.621 ... y_center=11.845 staff_position=-4.991
ledger rect 6: x=56.662 ... y_center=4.345  staff_position=+10.009
ledger rect 7: x=54.464 ... y_center=4.345  staff_position=+10.009
total ledger rects: 7
```

(The ±0.009 is the same line-thickness measurement artifact as the
noteheads' +0.010.) Mapped to their triggering notes by x:

| trigger note (pos) | ledger(s) drawn at | expected |
|---|---|---|
| b (−5) | −5 | −5 ✓ |
| a (−6) | −5 | −5 ✓ |
| g♯ (−6) | −5 | −5 ✓ |
| g (−7) | −5 and −7 | −5, −7 ✓ |
| c‴ (+10), twice | +10, +10 | +10 ✓ |

Negative cases, equally important:
- a♯″/b″ at position +9 (one half-space above the top line, no candidate
  between): **no ledger** — correct.
- Notes inside the staff's internal gap (positions 2–3 between lines 1
  and 4): **no ledger** — matches the engine's outside-staff-only proximity
  rule (a known preview↔engine ledger-richness divergence that predates this
  set; the preview's override/proximity templates can draw in-gap ledgers,
  the engine's rule does not — carried into session 2's design as an
  existing, not new, parity limit).
- Ledger candidates were auto-generated from the **compact** staff pattern
  (min spacing 2 half-spaces) with no semitone involvement — pure
  staff-position space, exactly as §1.2 predicted.

### 3.3 Stems: attachment, extent, and direction all follow the map

- Every single-note stem (26 of the 30) spans exactly 7 half-spaces from its
  (mapped) notehead position (LilyPond's default length under
  `no-stem-extend`), on the correct side, including below-staff and
  above-staff notes; the 4 chord stems span from their far head's mapped
  position with the same 7-half-space extension.
- **Direction flips at LilyPond position 0** (geometric): mapped positions
  ≤ −1 got up-stems, ≥ 0 got down-stems — e.g. f′/f♯′ (pos −1) up, g′
  (pos 0) down. Stem direction is therefore driven by the *mapped* geometry,
  not the diatonic pitch. Design consequence for session 2: the exported
  axis map must anchor the config's `staff.midpoint` at LilyPond position 0
  — which is already exactly today's `staff-line-positions` conversion
  convention (`2 × (S − midpoint) / sps`), so this is a consistency
  requirement, not a new mechanism.
- The spanning chord `<c' g'>` drew one stem connecting positions −4 → 0 and
  extending to +7 — multi-note stem geometry intact on the compact axis.
- Repeat-mode minims (2 stacked heads) and the semibreve (4 heads) rendered
  intact at mapped positions — the multi-notehead machinery is
  placement-independent.

### 3.4 The x-offset disambiguation: proven for single notes; chords need a named work item

Diffing the offset render against the byte-identical control
(`spike:x-offset 0.85` vs `0.0`) per notehead — the comparison is
`s1-evidence/xoffset_control_diff.py`, complete transcript with exit code in
`s1-evidence/xoffset_control_diff_transcript.txt`:

- **Single (non-chord) notes: exact and complete.** Each offset pc's head
  moved **+0.850** and *its stem moved with it* (Δx_stem = Δx_head to 3
  decimals for all 26 single-note columns), because stem X derives from the
  head's extent, which the stencil translation moves. The shift also
  **accumulates in horizontal spacing** (each offset column pushes all later
  columns +0.85 right) — the spacing engine treats the offset head's true
  extent correctly instead of overlapping it.
- **Chords: diatonic-derived arrangement interferes.** LilyPond arranges
  chord-internal head X by the heads' *diatonic* step relationship
  (`staff-position` property, which the engine never overrides), not by the
  mapped geometry:
  - `<c' cis'>` (same diatonic step → unison treatment): offset honored —
    head separation 0.357 (control) → 1.207 (offset) = +0.85 ✓.
  - `<f' fis'>` (same diatonic step): same, +0.85 honored ✓.
  - `<gis' a'>` (adjacent diatonic steps → "second" arrangement): offset
    **absorbed** — separation 0.357 in *both* renders; the note-column's
    extent-based head alignment re-derives X and cancels the stencil
    translation.

  This is the design consult's flagged risk ("many-to-one offsets for real
  multi-note chords may expose layout complexity") now made concrete and
  measured. It is bounded: it affects only the x-offset field for
  chord-internal shared-position pairs whose members are diatonic neighbors,
  and the engine change (E13-2 below) must choose the mechanism — e.g.,
  setting the mapped value into `NoteHead.staff-position` so LilyPond's
  chord/collision logic operates in axis space, or applying the offset via
  `NoteHead.X-offset` after note-column layout. Single-voice single notes —
  the whole of the octave-card preview surface — are fully proven.

### 3.5 Visual

`s1-evidence/pitch-axis-spike-png.png` — the compact staff reads exactly as
intended: chromatic scale ascending in shared-position pairs (each pair at
one height, sharper member offset right), three-line octaves with the
internal gap, ledgers below m6 and above m5, correct stems throughout.

---

## 4. The minimal engine hook (spec step 3)

The spike demonstrates that overriding the §1.1 formula's output is
sufficient for the **vertical placement** of noteheads, stems, and ledgers
(measured in §3; dots and articulations share the same geometric read,
§1.2). The minimal engine change *for vertical placement* is therefore
exactly the consult's proposal, at the site §1.1 identified — with the
explicit caveat that clean compact-axis rendering as a whole also needs
E13-2 (chord-internal horizontal arrangement, §3.4), which this hook alone
does not solve:

```scheme
%% cnb/config.ly — new setting, default #f = today's behavior
#(define cnb:get-pitch-staff-position #f)
```

```scheme
%% cnb/noteheads.ly — the only required VERTICAL-placement change
(ly:grob-set-property! grob 'Y-offset
      (* (if (procedure? cnb:get-pitch-staff-position)
             (cnb:get-pitch-staff-position note-semis)     ;; half-staff-spaces
             (* (+ note-semis (* 2 middleCPosition))       ;; literal old
                (/ 2 cnb:semitones-per-staff-space)))      ;; formula, kept
         0.5 staff-space))
```

(Modulo exact refactoring style — the requirement is: **hook consulted when
set; the literal existing formula on the `#f` path**, preserving the
default-off byte-identity constraint on the engine side the same way the
Configurator preserves it on the export side.)

- **Unit contract:** the hook returns LilyPond staff positions
  (half-staff-spaces from center) — the same unit as
  `cnb:staff-line-positions`, per the consult. The exported procedure bakes
  the octave anchor in (as the spike's `ANCHOR = −4` did), making placement
  clef-independent; note that the linear path's anchor is `middleCPosition`-
  driven, so the exporter must state the anchor rule explicitly (the engine
  already has a precedent for explicit-anchor-overrides-middleCPosition:
  `cnb:keysig-tonic-octave`, config.ly:216-222). **Session 2 design input.**
- **This is a bounded addition, not a rewrite.** One conditional at one
  site; ledger, dot, articulation, and stem-geometry code needs **zero**
  changes for vertical placement (§1.2; empirically shown for noteheads,
  stems, and ledgers in §3). Unlike the spike's coercion, the real hook
  runs inside the acknowledger (the earliest point the engine touches
  placement), and E13-2 will decide whether it should *additionally* write
  the mapped value into `staff-position` so `staff-position`-based logic
  (chord arrangement, collisions) operates in axis space — a question the
  spike deliberately could not answer (§2.1). The consult's STOP condition
  is not met.

## 5. Conclusion: GO (spec step 4)

- The engine **can** place noteheads, stems, and ledgers from an arbitrary
  many-to-one semitone→staff-position procedure: shown by an actual
  LilyPond 2.24.2 render of a hand-authored Twinline-like compact axis,
  measured element-by-element (35/35 noteheads, 7/7 ledgers, 30/30 stems —
  transcripts in `s1-evidence/`). This is the go/no-go question the spec
  poses, and the evidence answers it affirmatively.
- The GO is for **vertical-placement feasibility**. Clean compact-axis
  rendering as a whole needs the §4 hook **plus** at least E13-2
  (chord-internal horizontal arrangement) from §6 — still bounded additions,
  no engraver rewrite.
- The one measured complication (chord x-offset absorption, §3.4) is a
  named, bounded engine work item with two candidate mechanisms, not a
  feasibility threat: it does not affect where anything is placed
  vertically, and the entire single-note surface (the octave-card preview's
  rendering model) is unaffected.
- **Collision coverage is partial.** The spike exercised single-voice
  chords only (unison-, second-, shared-position and spanning chords); the
  diatonic-second absorption is the one collision-adjacent break observed.
  Multi-voice collisions, `NoteCollision` shifts across voices, and
  collision thresholds in axis space were **not** exercised and remain
  follow-on observation work under E13-2/E13-5.
- Until the engine work ships, the Configurator side must follow the
  consult's fail-loud rule (production export errors when
  `pitchAxis.enabled`; no silent linear `.ly`) — session 2 design scope.

## 6. Engine-repo work items (owned by `lilypond-chromatic-notation-base`)

Recorded here per the 009/010 coordination pattern; **none implemented in
this set** (binding rule 2). Suggested IDs continue the cross-repo handoff
convention:

- **E13-1 — the pitch-axis hook.** `cnb:get-pitch-staff-position` (default
  `#f`) consulted by the notehead engraver as in §4; literal old formula on
  the disabled path; a golden-baseline render (Kite 4-369) must be
  byte-identical with the hook unset.
- **E13-2 — `(x-offset . N)` notehead-config field.** Consume an optional
  per-(pc, duration) horizontal offset in staff-spaces from the procedure
  model's returned alist (Section C). Stencil translation is the proven
  mechanism for single notes (§3.4); the chord case needs a decided
  mechanism (set mapped `staff-position` so chord layout runs in axis
  space, or post-layout `X-offset`); acceptance evidence should include a
  diatonic-second shared-position chord.
- **E13-3 — key-signature placement through the hook.** keysig.ly's
  `semi × (1/sps)` mark placement (§1.3) uses the hook when set, so the
  notehead-chord signature lands on the compact axis.
- **E13-4 — clef anchor through the hook** (only if a custom clef is
  enabled together with a pitch axis; clefs.ly:203-261).
- **E13-5 — collision threshold semantics.** Verify
  `cnb:collision-threshold` (default 2, layout.ly:97-98) against axis-space
  distances once E13-2's mechanism is chosen; shared positions make
  geometric distance 0 the common case.

## 7. What this set's session 2 takes from this record

1. GO (scoped per §5: vertical-placement feasibility proven; chord
   x-offset mechanism is engine work item E13-2, a design input rather than
   a blocker) — proceed to the `pitchAxis` schema + export v1.3 draft
   design.
2. The hook unit contract (half-staff-spaces; `staff.midpoint` anchored at
   LilyPond position 0; explicit octave anchor rule — §3.3, §4).
3. The chord x-offset evidence (§3.4) feeds the disambiguation-field design
   and its export surface.
4. The in-gap ledger divergence note (§3.2) feeds the ledger
   reframing design as a pre-existing parity limit.
5. Fail-loud export gating while the engine capability does not exist (§5).

---

## Appendix A — the throwaway proof source

Checked into `s1-evidence/pitch-axis-spike.ly` (offset variant;
`pitch-axis-spike-ctrl.ly` is identical with `spike:x-offset 0.0`). Renders,
harvests, the measurement script, and the full measurement transcript with
exit code are alongside it in `s1-evidence/`. These are session-record
evidence files, not product fixtures — no `cnb/` source in either repo was
changed. `git status --porcelain` in the engine repo after the spike shows
**zero modified or added tracked files** (its only entries are untracked
orchestration scaffolding — `.dabbler/`, `.venv/`, engine-side docs — that
predate this session); every spike artifact was written to this repo's
session-set evidence directory or the session scratchpad.
