# AI-assisted workflow guide

**Where an AI assistant helps — and where it must not — when designing a
chromatic notation system with the Configurator.**

> **Audience.** An operator who has read the
> [notation-builder playbook](notation-builder-playbook.md) and wants to use
> an AI assistant (a chat model, a coding agent) to move faster through
> specific steps of that same build. This guide is the companion to the
> playbook: it does not re-teach the platform model — it annotates the
> playbook's own 12-step walkthrough (its Part 4) with *where AI earns its
> keep, where it doesn't, and what you check before you trust its output*.
>
> **How claims are grounded.** As in the playbook, every "the platform can do
> X" statement cites the config schema, a source module, or a checked-in
> fixture; every "cannot" statement cites a named invariant (playbook Part 2)
> and an exemplar system from the
> [feasibility matrix](../research/gallery-survey/feasibility-matrix.md) and
> [reproduction report](../research/gallery-survey/reproduction-report.md).
> The AI cannot lift those limits — so the constraints in the playbook apply
> unchanged to anything AI drafts.
>
> **IP posture (carries through unchanged —
> [`docs/planning/project-plan.md`](../planning/project-plan.md) §5).** An AI
> asked to "make me Clairnote" will happily oblige; you must not let it. Any
> reproduction of a published system is a *reproduction study*: build from the
> public description or image, attribute the original in `meta`
> (`systemName`/`systemCreator`/`systemYear`/`sourceUrl`), frame it "inspired
> by", and **never let the AI ingest or port that system's own implementation
> code** (Clairnote SN's design is CC BY-SA 4.0 but `clairnote.ly` is GPL v3;
> Chromatic Lyre's `lyrebird.ly` carries no license — treat as
> all-rights-reserved). If you paste a system's source into a prompt, you have
> created a derivative-work problem the platform's own code carefully avoids.

---

## Part 1 — The core discipline: AI drafts, the platform and the human verify

The Configurator was built with a single validation philosophy, stated across
every session of its construction and encoded in the code itself: **never emit
a value you cannot derive — validate it, or record it as unknown and ask.**
`CNBConfig.validate()` blocks the export on malformed input
(`cnb/src/cnb-config.js`); the SVG importer warns rather than guesses when a
shape lacks `data-lilypond-*` attributes (`cnb/ui/svg-importer.js`); the whole
gallery-reproduction effort recorded deviations as gaps instead of forcing them
(playbook Part 3). AI assistance fits this philosophy exactly when — and only
when — you treat it the same way:

- **AI is a drafting accelerator, not an authority.** It turns a description,
  an image, or a prose rule into a *candidate* config, path, or rule set. That
  candidate is untrusted until the platform's own machinery accepts it.
- **Two verifiers already exist; use them on every AI output.** `CNBConfig.validate()`
  (the same checks the exporter runs, playbook Part 5) and your own eyes on the
  live preview / the module test pages (`cnb/test-pages/test-*.html`). An
  AI-drafted config that has not passed both is not done.
- **The human keeps the aesthetic and the sign-off.** Which shapes *look*
  right, whether a color reads, whether a reproduction is faithful — these are
  reserved to you, mirroring this repo's own UAT discipline (a human operator
  attested every one of the 17 set-011 fixtures; reproduction report).

Everything below is an application of that one rule.

---

## Part 2 — Pipeline map: AI value per walkthrough step

The playbook's Part 4 lists 12 build steps in config-composition order. Here is
each, tagged **High** (AI drafts a first pass you then verify), **Lower** (a
mechanical UI action AI can't do for you, or where drafting saves little), or
**Human** (a judgment reserved to you). The "verify with" column is the
platform machinery that turns the AI draft from candidate into config.

| # | Walkthrough step | AI value | What AI produces | Verify with |
|---|---|---|---|---|
| — | **Characterize an existing system** (before step 1) | **High** | A draft config skeleton from a system's image/description — staff pattern, notehead scheme, palette guess | `CNBConfig.validate()` + preview; the [feasibility matrix](../research/gallery-survey/feasibility-matrix.md) for the tier/invariant check |
| 1 | Staff pattern → stem direction | **High** | A `staff.semitonePattern` + `midpoint` + `semitonesPerStaffSpace` from a described line layout | Staff/Ledger editor's derived LilyPond-geometry panel; preview |
| 2 | Ledger templates | **High** | `ledgers.templates` entries (`semiWithinOctave`/`triggerPCs`/`triggerMode`) from a described ledger behavior | Preview: ledgers appear only under the intended pitch classes (mind gap A) |
| 3 | Shape authoring / import | **High (geometry draft) / Human (final glyph)** | Draft SVG path `d` strings and toolkit `data-*` attributes for a described glyph | Import through `cnb/ui/svg-importer.js`; **visual** check on `test-notehead.html`; anchor check on `test-stem.html` |
| 4 | Notehead rules | **High** | `noteheadRules` JSON translating a prose scheme ("black keys hollow", "three shapes by diminished-7th set") into cumulative rules | `CNBConfig.resolveNotehead` per PC; preview across all 12 |
| 5 | Palette | **Lower / Human** | A candidate 12-color mapping; but color *choice* and CB-safe adequacy are aesthetic | Palette editor; the exporter's CB-safe ΔE warning (LY spec §8) |
| 6 | Durations | **Lower** | Confirming `representationMode`; little to draft | Common Properties editor |
| 7 | Clef / key signature (optional) | **High (config) / Human (glyph)** | A `clef` or `keys.keySignature` config block from a description | Clef/Key-signature editors; preview; `validate()` (enabled-only checks) |
| 8 | Validate | **High (interpret)** | An explanation of a validation error and the fix | `CNBConfig.validate()` must return no errors — the AI's explanation is not a substitute for a clean run |
| 9 | Preview | **Human** | — (AI cannot see your screen) | Your eyes on `cnb/ui/preview-display.js` output |
| 10 | Save JSON | **Lower** | Draft `meta` attribution fields for a reproduction study | Config Save/Load round-trip |
| 11 | Export `.ly` | **Lower** | — (mechanical); AI can *explain* the emitted Scheme | Config Export panel; the export is deterministic from the config |
| 12 | Render through the engine + diff | **High** | The export→render→diff verification loop as a runnable script | Actual render + pixel/section diff against the target (playbook step 12) |

Three bands, in one line: **AI is high-value wherever the work is
"description or prose → structured JSON/SVG that the platform can then check"
(the characterization, staff, ledger, rule, and geometry-draft steps and the
verification loop); it is lower-value on the mechanical UI clicks; and it is
reserved from the aesthetic choices and the final visual sign-off.**

---

## Part 3 — Prompt templates for the high-value steps

Each template embeds the schema excerpt or doc pointer the model needs, states
the expected output shape, and ends with the **verification instruction** — the
platform check you run before trusting the result. Fill the `‹angle-bracket›`
slots. The templates assume the model has no repo access; if you are using a
coding agent that can read the repo, replace the pasted excerpts with file
pointers (they are named in each template).

### 3.1 Characterize an existing system → draft config skeleton

> You are drafting a **reproduction-study** config for the Chromatic Notation
> Configurator. This is a study of a *published* system: attribute it, frame it
> "inspired by", and **do not** use or request that system's own
> implementation code — work only from the description below.
>
> System description / image notes: ‹paste the public description; describe the
> staff lines, notehead shapes, any colors, any clef/key-signature device›.
>
> The platform model (authoritative): staff is `staff.semitonePattern` —
> semitone offsets 0–11 within an octave that carry a line, repeating every
> octave. Noteheads are assigned by cumulative priority-ordered
> `noteheadRules`, each with a `match` (`pitchClasses`/`durations`/`keys`) and
> an `apply` (`shape`/`hollow`/`color`/`offKeyMark`). Pitch class 0 = C.
> Full schema: `docs/CNB-ARCHITECTURE-PLAN-v2.md` §4.
>
> **Before drafting, check the design against the five invariants** in
> `docs/playbook/notation-builder-playbook.md` Part 2 (I1 horizontal only, I2
> one pitch per row, I3 duration-in-notehead only, I4 per-octave periodic, I5
> absolute pitch). If the described system violates one, say so and stop — do
> not invent a representation for it.
>
> Output: a JSON config skeleton (staff, ledgers, noteheadRules, palette,
> meta) as partial-over-default JSON. For any value you cannot derive from the
> description, **emit `null` and list it under an `"_unknowns"` note** — do not
> guess.
>
> **Verification:** I will load your JSON through `CNBConfig.validate()` and the
> live preview; it must validate with no errors and resolve a notehead for all
> 12 pitch classes. Any `_unknowns` you flag, I will resolve by hand.

### 3.2 Staff pattern → `semitonePattern` / `midpoint`

> Convert this described staff into the platform's `staff` config. Lines are
> placed by `semitonePattern`: the within-octave semitone offsets (0=C, 1=C♯, …
> 11=B) that carry a line; the pattern repeats every octave
> (`cnb/src/cnb-staff.js`). `semitonesPerStaffSpace` is the informational
> spacing; `midpoint` is the absolute semitone where stems flip (up below,
> down at/above).
>
> Described staff: ‹e.g. "three lines on E, G, and A♯; a minor-third staff"›.
>
> Output: `{ "staff": { "semitonePattern": [...], "semitonesPerStaffSpace": N,
> "midpoint": M, "lineOverrides": { ... } } }`. Put any bold/dashed/colored line
> in `lineOverrides` keyed by the within-octave position (`style` is
> `solid`/`dashed`/`dotted`).
>
> Expected: `[4,7,10]` for "E, G, A♯". Note that overrides apply to *every*
> octave's instance of a position — if the description needs a line to differ
> per octave, flag it (invariant I4-adjacent; not expressible).
>
> **Verification:** the Staff/Ledger editor's derived panel shows the exact
> `cnb:staff-line-positions` the export will emit (half-staff-space units,
> `2 × (S − midpoint) / sps`); I confirm it matches the intended layout in the
> preview.

### 3.3 Prose ledger behavior → `ledgers.templates`

> Translate this ledger behavior into `ledgers.templates`. Each template:
> `{ "semiWithinOctave": ‹where the ledger LINE sits, 0–11›, "triggerPCs":
> [‹which pitch classes bring it out›], "triggerMode": "override" | "proximity" }`.
> `override` shows the ledger whenever a trigger-PC note is displayed;
> `proximity` shows it when the note is strictly closer to it than to any staff
> line. A ledger only renders when it lies between the note and the nearest
> staff line (`cnb/src/cnb-ledger-set.js`).
>
> Described behavior: ‹e.g. "a single ledger below the staff for C and C♯"›.
>
> Expected: the ledger's own position and its triggers are **different fields** —
> "a ledger at C♯ that appears for C and C♯" is
> `{ "semiWithinOctave": 1, "triggerPCs": [0,1], "triggerMode": "override" }`,
> NOT `triggerPCs` equal to the ledger position. **Constraint (gap A,
> `docs/playbook/notation-builder-playbook.md` Part 3):** ledger octave-regions
> align to C, so a note just below a C boundary (A♯, B) cannot be connected
> upward to the next C's ledger. If the description needs that, flag it and trim
> the trigger rather than emitting a ledger at the wrong C.
>
> **Verification:** in the preview, the ledger must appear under exactly the
> intended notes and nowhere else, across the whole chromatic row.

### 3.4 Prose notehead scheme → `noteheadRules`

> Translate this notehead scheme into cumulative `noteheadRules`. Resolution
> (`cnb/src/cnb-config.js` `resolveNotehead`) starts from defaults
> `{ shape: firstShape, hollow: false, color: null, offKeyMark: false }` and
> walks rules in ascending `priority`, each `apply` **merging over** the running
> state — so only name the fields a rule changes. Each rule:
> `{ "name": "...", "priority": N, "match": { "pitchClasses": "all" | [...],
> "durations": "all" | [...], "keys": "all" | [...] }, "apply": { "shape": "...",
> "hollow": true|false, "color": "#RRGGBB"|null, "offKeyMark": false } }`.
> `color: null` means "use the palette color for this PC". Schema:
> `docs/CNB-ARCHITECTURE-PLAN-v2.md` §4.5.
>
> Described scheme: ‹e.g. "ovals on the on-line diminished-7th set {1,4,7,10},
> up-triangles on {2,5,8,11}, down-triangles on {0,3,6,9}"; or "one shape
> everywhere, black keys hollow"›.
>
> Expected: a base rule matching `pitchClasses: "all"` (so all 12 are covered),
> then higher-priority rules that set only the differing field. For "black keys
> hollow" that second rule is `{ "match": { "pitchClasses": [1,3,6,8,10] },
> "apply": { "hollow": true } }` — no `shape` (it would clobber the base).
> Every `apply.shape` must name a shape that exists in `config.shapes`; every
> `apply.color` must be `#RRGGBB` or `null`.
>
> **Verification:** I will call `CNBConfig.resolveNotehead(config, pc,
> "crotchet", null)` for pc 0–11 and confirm each resolves to the intended
> shape/hollow/color, then eyeball the preview. `validate()` must report all 12
> pitch classes covered and no unknown-shape/invalid-hex errors.

### 3.5 Described glyph → draft SVG path + toolkit `data-*` attributes

> Draft an SVG notehead for import into the Configurator's Shape Importer
> (`cnb/ui/svg-importer.js`). The toolkit contract (LY spec §7, README
> walkthrough step 1): the glyph is normalized to **100 units per semitone**;
> set `data-semitone-height` (convention: **2** for a two-semitone notehead),
> stem-anchor placemarkers (`data-stem-up-x/y`, `data-stem-down-x/y` in SVG
> units — use **x: 0** for a center-attached stem), and, if you can, pre-baked
> `data-lilypond-notehead` / `data-lilypond-hollow` path strings; without them
> the exporter falls back to automatic conversion (a warning, not an error).
>
> Described glyph: ‹e.g. "an equilateral up-triangle, two semitones tall,
> center-attached stem"›.
>
> Output: the `<path d="...">` (and a hollow-cutout path if the design is
> hollow), plus the `data-*` attribute values. Keep it a single normalized
> glyph — no rotation/scale transforms (each variant is its own path).
>
> **Verification (mandatory visual — AI cannot self-verify geometry):** I import
> it and *look* at it on `cnb/test-pages/test-notehead.html`, and I check the
> stem attaches correctly on `test-stem.html`. Anchor points are trusted only
> after this visual check — the 4-point anchor model assumes a stem width of
> ~1/5 semitone (playbook Part 5); a wrong anchor looks off-center even when the
> JSON is valid.

### 3.6 The export → render → diff verification loop

> Write a runnable script for the reproduction verification loop
> (playbook Part 4 step 12; README end-to-end walkthrough). Given a config JSON,
> it should: (1) export `.ly` headlessly via `cnb/src/cnb-lilypond.js`
> `CNBLilypond.generate(config)` (see `cnb/fixtures/export-kite-4-369.mjs` for
> the driver pattern); (2) render it through the engine with
> `lilypond -dbackend=svg` against a score that `\include`s it; (3) diff the
> result against the target — section-by-section for the `.ly`, and/or a raster
> pixel-compare for the SVG.
>
> Output: a Node script plus the `lilypond` command line. Do not invent engine
> internals — the engine repo is
> `https://github.com/darndestdabbler/lilypond-chromatic-notation-base`; the
> checked-in `cnb/fixtures/` Kite 4-369 round-trip is the reference that renders
> pixel-identical to the engine's golden baseline.
>
> **Verification:** the loop is itself the verification. A clean section diff (or
> zero differing pixels) is the pass; any diff is a real discrepancy to
> catalog — do not explain it away.

---

## Part 4 — Cautions

The failure modes an AI assistant introduces, and the guardrail for each. All
of them are the same rule (Part 1) in a specific place.

- **Every AI-drafted config must pass `CNBConfig.validate()` with no errors
  before you trust it** — the same checks the exporter runs (playbook Part 5,
  LY spec §8). A model that says "this config is valid" is not a substitute for
  the run. Treat validation output, not the model's assurance, as truth.
- **Geometry needs eyes, not just a valid schema.** A syntactically valid SVG
  path and a valid anchor block can still render a lopsided glyph or an
  off-center stem. Import every AI-drafted shape and view it on
  `cnb/test-pages/test-notehead.html` / `test-stem.html` before using it. This
  is the one step no validator covers and no model can self-check.
- **Never let an AI guess a value it cannot derive.** This is the platform's
  own philosophy turned on the assistant: if the source description doesn't
  determine a color, an anchor coordinate, a `semitoneHeight`, the model must
  emit `null` / an `_unknowns` note and let you resolve it — not fabricate a
  plausible number. A guessed anchor or a guessed hex that *validates* is worse
  than a flagged unknown, because it passes silently. (The set-011 build treated
  every underivable value this way; the importer itself warns rather than
  guesses.)
- **The AI cannot lift a platform limit.** If a design hits an invariant (I1–I5,
  playbook Part 2), no amount of prompting produces a faithful config — the
  schema has no representation for it. A model asked to "make the staff
  vertical" or "encode duration as note width" will emit something that
  validates and is *structurally wrong*. Check the design against Part 2
  *before* prompting, and take the model's "I can't represent this" as a
  correct answer, not an obstacle to prompt around.
- **Aesthetic and fidelity judgment stay with you.** Whether colors read,
  whether a reproduction is faithful to the published system, whether the result
  is *good* — reserved to the human, exactly as this repo reserves final visual
  sign-off to its operator (every set-011 fixture was human-attested;
  reproduction report). The AI proposes; you dispose.
- **IP: keep the model away from implementation code.** Do not paste a target
  system's `.ly`/JS source into a prompt or point an agent at it; work from the
  public *design*. Attribute reproductions in `meta` and frame them "inspired
  by" (project-plan §5). The platform's own code was built by studying published
  designs, never porting the prior-art implementations — hold AI-assisted work
  to the same line.

---

## See also

- [Notation-builder playbook](notation-builder-playbook.md) — the platform
  model, the five invariants, the reproduction evidence, and the 12-step build
  walkthrough this guide annotates.
- [Feasibility matrix](../research/gallery-survey/feasibility-matrix.md) and
  [reproduction report](../research/gallery-survey/reproduction-report.md) — the
  evidence base for every capability and constraint claim.
- [README end-to-end walkthrough](../../README.md#end-to-end-walkthrough-from-shape-to-rendered-score)
  — the full three-tool pipeline including the render half.
