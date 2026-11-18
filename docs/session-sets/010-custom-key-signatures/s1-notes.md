# Set 010 — Session 1 working notes

**Session:** 1 of 2 (schema and preview rendering)
**Date:** 2026-07-07
**Orchestrator:** claude-code / anthropic

---

## Step 1 — Scope adjustments against the requirements catalog (E2)

Spec step 1 requires recording any scope adjustments the E2 entry of
`docs/research/gallery-survey/enhancement-requirements.md` forces on the
spec's sketch. Two adjustments, both narrowing uncertainty rather than
changing scope:

### A1 — Operator directive: the default mark style is the engine's notehead-chord key signature

At session start the operator (task owner) directed, verbatim:

> "Keep in mind that the default should be the key signature of real
> noteheads as two stacked 7th chords per keysig.ly"

`keysig.ly` is the CNB engine module
(`d:/Projects/lilypond-chromatic-notation-base/cnb/keysig.ly`) that
replaces LilyPond's standard key signature with **actual noteheads**: the
key's scale rendered as 8 pitches (7 scale degrees ascending from the
tonic, plus the octave tonic), interleaved into two columns — even
indices left, odd indices right — which reads as **two stacked 7th
chords** (degrees 1-3-5-7 on the root; degrees 2-4-6-8 on the second
degree; chord qualities fall out of the mode automatically), capped with
a gold vertical bar (`cnb:gold`, `#ffd42a`, colors.ly:47) spanning ±1
octave around the staff center.

Consequence for the schema: `keys.keySignature.style` defaults to
`"notehead-chords"`, and that style reproduces the keysig.ly layout in
the preview. This *supersedes* the E2 sketch's implied glyph-count
default ("glyph refs + counts, or a tonic-label mode") as the default —
the sketch's options remain as the vocabulary (see A2/D2).

### A2 — E2's engine assumption is out of date: signature rendering is NOT new engine surface

E2 states "signature *rendering* is new engine surface" and "engine-side
stencil/placement contract must be agreed in set 010". Session-1 engine
inspection (step 6) found the engine **already renders** notehead-chord
key signatures: `cnb-key-signature-engraver` is unconditionally installed
in the Staff context (layout.ly:48), driven by the score's `\key`, and
resolves noteheads through the procedure-model config at quarter-note
duration (stencils.ly:393 `cnb:get-keysig-note-stencil` → duration 3).
Details and the export consequence are in `s1-engine-coordination.md`.

---

## Design decisions (D-numbered; the coordination note carries the engine-facing ones)

### D1 — Placement rule maps the key's full pitch-class set, not the tonic alone

Binding rule 2 asked for a decision between mapping the key's pitch
classes and mapping its tonic. **Decision: the full pitch-class set**,
ordered as an ascending scale from the tonic plus the octave tonic —
because (a) that is exactly what the engine's keysig.ly draws (all 7
degrees + octave; the two-7th-chords reading), so preview and engraved
output agree by construction, and (b) the E2 drivers (Clairnote SN/DN)
display the tonality, not a single tonic mark. A tonic-label mode
(Thumline, catalog record 42) is Tier-4 evidence only and is deferred.

### D2 — Two mark styles cover binding rule 2's two arms

Binding rule 2: "a mark style (glyph from the shape/glyph pipeline, or a
simple built-in mark such as a dot)".

- `"notehead-chords"` (default, per A1) is the *glyph-from-the-shape-pipeline*
  arm: every mark is a real notehead resolved through
  `CNBConfig.resolveNotehead(config, pc, "crotchet", keyName)` against
  `config.shapes` — the same shape/glyph pipeline the cards use, with the
  crotchet duration mirroring the engine's quarter-note choice.
- `"dot"` is the *simple built-in mark* arm: a filled circle per scale
  degree at the same grid positions, colored by the same notehead color
  resolution.

### D3 — Tonic resolution chain

`keys.definitions` entries are `{ name, pitchClasses }` (set 006) — no
tonic field. The renderer resolves the tonic pitch class as:

1. `def.tonicPc` (new OPTIONAL field, integer 0–11) when present;
2. else `CNBKeySignature.parseTonicPc(def.name)` — leading note letter
   A–G plus optional accidental (`#`, `♯`, `b`, `♭`), so "C", "F# minor",
   "B♭ Dorian" all parse;
3. else the first listed pitch class (validation warns when a definition
   will hit this fallback).

*(Round-1 remediation: the parser was first added to `cnb-music.js`
(Module B), which is outside this session's product-file scope; it now
lives in `cnb-key-signature.js` and Module B is byte-identical to its
pre-session state. See the remediation section below.)*

### D4 — Vertical anchoring: auto-centering on the staff midpoint, explicit `tonicOctave` override

The engine anchors the signature at middle C (tonic placed in the octave
starting at the engraved staff center). Reproducing that literally in the
preview puts high-tonic signatures (e.g. B) mostly above the preview's
default viewport. **Decision:** `keySignature.placement.tonicOctave:
null` (the default) auto-selects the octave that centers the signature's
octave span on `staff.midpoint` (ties resolve upward, so a C tonic with
midpoint 12 lands at semitone 12 — matching the engine exactly for the
default config); an explicit integer `tonicOctave` overrides. Documented
deviation: for non-C tonics the preview centers the stack on the staff
while the engine anchors at middle C — a display-only placement
difference in the same spirit as other preview-only display settings.

### D8 — Explicit placement-rule surface (added in verification round 1)

Round 1 of session-1 verification correctly observed that the placement
behavior was hard-coded with no config surface for session 2's
"placement-rule controls" to edit. Remediation: the schema now carries
`keys.keySignature.placement = { rule, tonicOctave }`, where `rule` names
how the key's pitch classes map to grid positions — `"scale-from-tonic"`
(decision D1, the keysig.ly rule) is the only implemented value,
validation rejects anything else, and the renderer treats an unknown rule
as inactive (renders nothing). Future placement rules (e.g. a tonic-label
mode, catalog record 42) extend the `rule` vocabulary. `tonicOctave`
moved from the subsection root into `placement`, since it is a placement
parameter.

### D5 — The displayed key is example data, not config

Architecture principle 1 (config defines the system; example data defines
what to show). Which key's signature is displayed comes from the render
call — `CNBCollection.render(..., { keys: ["G"] })` uses `keys[0]` — not
from the config. The gate for rendering is
`keys.enabled && keys.keySignature.enabled && (a selected key name
resolves to a definition)`, per E2's "only when `keys.enabled` and a
signature device is configured". No key selected → no gutter. Cards
continue to render with `key = null` (key *rows* remain deferred per
Module 10's contract; unchanged by this set).

### D6 — No new open-keyed maps

`keys.keySignature` is a fixed-shape object (style, tonicOctave,
separator, dot, gutter); `keys.definitions` is an array, which
`CNBConfig.merge` already replaces in full. No `REPLACE_PATHS` addition
is needed in config-io (session 2 step 3's "if an open-keyed map was
introduced" condition is not met).

### D7 — IP posture

Clairnote DN is the motivating reference (design CC BY-SA 4.0; Paul
Morris's `clairnote.ly` is GPL v3). No code was read from or ported from
`clairnote.ly`; the notehead-chord signature mirrors this project's own
engine module (`keysig.ly` in the chromatic-notation-base repo), and the
module doc comments attribute the Clairnote inspiration with
"inspired by" framing.
