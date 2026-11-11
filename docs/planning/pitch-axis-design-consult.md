# Pitch-axis (I2 relaxation) — cross-provider design consult

**Date:** 2026-07-10
**Question:** What would it take to let different pitches sit at the same
vertical position — or, generally, at non-uniform (non-semitone) vertical
positions — so the platform can express compact-staff systems (the Twinline /
TwinNote / Bilinear family, ~9 published systems, invariant **I2** in the
[feasibility matrix](../research/gallery-survey/feasibility-matrix.md))?
**Status:** Design scoping for a prospective session set (013+). Not yet
started; no code changed. Records two independent architect opinions to feed
the eventual spec, following the set-010-s2 design-consult precedent.

Two architects were consulted cross-provider on the same brief (the brief is
reproduced at the end):

- **GPT-5-4 (OpenAI)** — obtained manually (the router's OpenAI tier-3 path was
  timing out); recorded verbatim in
  [`pitch-axis-design-recommendation.md`](pitch-axis-design-recommendation.md).
- **Gemini-Pro (Google)** — routed via the AI router
  (`task_type=architecture`); reproduced verbatim in §B below.

---

## Synthesis — what they agree on (this is the recommendation)

The two converge strongly. Where they differ, GPT is consistently the stricter
/ more production-hardened of the two; the synthesis takes the stricter reading.

1. **Config model — an explicit pitch-class → position map, versioned and
   default-off.** Both reject a parameterized "compact/diatonic mode" in the
   core (GPT: "it will become a taxonomy argument"); named modes like
   "Twinline-ish 7-position" become **UI presets that compile into the explicit
   map**. The map lives in a new optional top-level `pitchAxis` section:
   - 12 pitch-class positions + an **octave stride** (7 for a diatonic-like
     compact axis; Gemini's `octaveHeight`, GPT's `octaveStride`).
   - GPT adds two fields worth keeping: an explicit `enabled` flag + `kind`
     version tag (`"pitch-class-map-v1"`), and an **`axisUnitsPerStaffSpace`**
     unit contract (the missing piece in Gemini's shape — it ties the abstract
     axis unit to LilyPond staff-spaces).
   - **Unset ⇒ exactly today**: `position(pc)=pc`, stride 12, axis-unit =
     `staff.semitonesPerStaffSpace`.

2. **Default-off = byte-identical, enforced by keeping the old path, not by
   re-deriving it.** Gemini says "synthesize the linear map internally"; GPT is
   stricter and correct given the hard constraint — when `pitchAxis?.enabled`
   is false, **keep the literal old formula/code path** in `cnb-grid.js` and
   `cnb-lilypond.js` untouched, don't route default configs through new export
   branches, and don't write the default into saved configs. Take GPT's version
   (it protects the Kite round-trip + export-baseline tests by construction).

3. **Grid becomes the sole axis gatekeeper; semitone stays pitch-identity,
   axis-position becomes geometry.** Add an axis helper
   (`positionOfSemi`/`regionOfSemi`/`distance`); `semiToY` survives as a thin
   wrapper `= (maxAxis − positionOfSemi(semi)) · pxPerAxisUnit`. Both flag the
   **one genuinely new API shape**: the inverse can no longer be a scalar —
   `yToSemi` must return **candidates** (`vStepToSemis` / `nearestSemisForY`),
   0–1 in the linear case, 2 for a shared position. A fake single semitone would
   hide the central many-to-one fact.

4. **Disambiguation reuses the notehead-rule system.** Add one optional
   resolved field, a **per-pitch horizontal offset in staff-space units**
   (GPT `xOffsetStaffSpaces`, Gemini `horizontalOffset`) — negative = left,
   positive = right, missing = centered. Both agree on staff-space units (not
   notehead-width %) specifically because LilyPond consumes staff-space offsets
   directly. GPT works out the preview consequences the current code doesn't yet
   support: `CNBDoubleNotehead` must accept **per-note** X offsets (today only a
   symmetric octave-pair `offsetPercent`), and the **stem attachment must move
   with the offset notehead** (the card hardcodes `offsetPercent: 0` and one
   `centerX`).

5. **Ledger logic: re-metricate to axis coordinates, keep the algorithm.** Both:
   convert every semitone input to axis positions at the top of
   `cnb-ledger-set.js`; the proximity/betweenness/region predicates keep their
   form (`region = floor(pos / octaveStride)`); **keep the strict `<` tie
   rule** (GPT: essential so shared positions and staff-line coincidences don't
   invent extra ledgers). GPT adds two things: **key rendered ledgers by axis
   position** so two templates collapsing onto the same vertical place draw one
   line, and **validation rejects conflicting style overrides** for templates
   that collapse. Stem direction switches from semitone-average to
   axis-position-average vs `positionOf(staff.midpoint)`.

6. **The engine decision — both say pursue the two-repo change; do NOT ship
   preview-only.** This is the decisive point, and it is where this feature
   **differs from clefs (009) and key signatures (010)**. Those were
   preview-forward but faithful — a clef-less or keysig-less export is
   *incomplete*, not *wrong*. A compact-staff config exported through the
   linear engine engraves at the **wrong pitch positions** — actively wrong.
   Both architects reject accepting that:
   - GPT: production export must **fail loudly** when `pitchAxis.enabled` and
     the engine lacks the hook; allow only internal fixtures / hidden
     experimental previews until then — "Do not silently emit a linear `.ly`."
   - Gemini: "no front-end work should proceed beyond a prototype until the
     engine change is agreed upon and planned."
   - Concrete engine hook (GPT): a procedure
     `cnb:get-pitch-staff-position (lambda (semitone) …)` returning
     half-staff-spaces (same unit as `cnb:staff-line-positions`); the exported
     JSON map compiles to that procedure. The current
     `cnb:semitones-per-staff-space` + `cnb:staff-line-positions` describe staff
     *lines* but not *pitch placement*, so they are not enough.

## Where they diverge (and the call)

| Point | Gemini | GPT | Take |
|---|---|---|---|
| Map shape | `positions[12]` + `octaveHeight` | `[{pc,position}]` + `octaveStride` + `axisUnitsPerStaffSpace` + `enabled` + `kind` | **GPT** — versioned, explicit unit contract |
| Default-off | synthesize linear map internally | keep the literal old code path untouched | **GPT** — stronger byte-identity guarantee |
| Engine gate | pursue two-repo; prototype-only until agreed | pursue two-repo; **fail-loud export**, hidden experimental preview only | **GPT** — the explicit guard operationalizes the principle |
| Export detail | mirror the JSON map into the engine | `(x-offset . N)` in Section C only when nonzero/enabled; a new export-spec **v1.3** | **GPT** — preserves current byte output field-by-field |

No genuine conflict — GPT is a superset of Gemini's plan with the guard rails
filled in. Gemini's independent arrival at the same explicit-map + V-Step +
notehead-offset + two-repo conclusion is strong corroboration that this is the
right shape, not one model's idiosyncrasy.

## Recommended sequencing (merged)

Both put the **engine spike first** as a hard go/no-go. Merged phase list:

0. **Engine spike + coordination (highest risk, go/no-go).** Hand-author one
   compact axis in LilyPond and prove the engine can place noteheads, stems,
   collisions, and ledgers from a `cnb:get-pitch-staff-position` procedure.
   Record it as an engine-repo coordination note (the 009/010 pattern). **If the
   engine cannot consume an arbitrary semitone→staff-position procedure without
   a large engraver rewrite, STOP** — the only remaining path would be "preview
   compact, export linear," which violates the platform's central promise.
1. **Export spec v1.3** for `pitchAxis` + `x-offset`; old exports byte-identical.
2. **`CNBPitchAxis` + grid** with tests: disabled output unchanged (literal old
   path), non-uniform 1:1 works, many-to-one returns inverse candidates.
3. **Rethread consumers** (staff, ledgers, double-notehead, stem, card/collection)
   onto axis positions for geometry, semitone identity preserved; all existing
   tests stay byte-identical before the feature is switched on.
4. **Compact fixtures + round-trip export tests**, gated on the engine capability.
5. **UI presets last** — presets generate the explicit map + notehead-rule
   offsets.
6. **Re-tier** the I2 records in the feasibility matrix as a dated amendment
   (the 008-s2 framework-change rule) once a Twinline fixture reproduces.

## Highest risks (both)

- The engine may not cleanly override placement for all relevant engravers
  (the whole feature hinges on this — hence phase 0).
- The "axis units per staff-space" contract must be crisp or shape sizing /
  stem attachment drift.
- Many-to-one offsets for real multi-note chords expose layout complexity
  beyond the current octave-pair preview.
- Ledger parity: the preview's ledger rules are richer than the currently
  visible export surface, so preview↔engine ledger agreement is the subtle part.

---

## §A. GPT-5-4 (OpenAI) — verbatim

See [`pitch-axis-design-recommendation.md`](pitch-axis-design-recommendation.md)
(checked in alongside this file).

## §B. Gemini-Pro (Google) — verbatim

> Here is a direct, opinionated design recommendation.
>
> ### 1. The Pitch-Axis Config Model
>
> Adopt a fully general, explicit lookup table. It is the most declarative, future-proof model and directly represents the desired mapping. Parameterized modes are brittle and insufficient for the variety of real-world systems.
>
> **Recommendation:** Add a new top-level optional object to the config schema named `pitchAxis`.
>
> ```json
> "pitchAxis": {
>   "positions": [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6],
>   "octaveHeight": 7
> }
> ```
>
> - **`positions`**: An array of 12 numbers representing the vertical position for each chromatic pitch class (C, C#, D, ... B) within a single octave. The unit of these values is a new abstract coordinate, the "Vertical Step" or **V-Step**.
> - **`octaveHeight`**: A number defining the total height of one octave in V-Steps. This is the value by which `positions` are offset for each successive octave.
>
> **Degeneracy (for byte-identical compatibility):** If the `pitchAxis` object is absent or null, the system internally synthesizes the legacy linear model: `positions = [0..11]` and `octaveHeight = 12`. In this state, one V-Step is identical to one semitone, and all downstream logic behaves exactly as it does today.
>
> ### 2. The Grid Rewrite
>
> `cnb-grid.js` must be refactored to be the sole gatekeeper of the new pitch-to-position mapping, introducing the V-Step coordinate. Core functions: `semiToVStep(semi)` (= `positions[pc] + oct*octaveHeight`), `vStepToY(vStep)` (pure linear, same form as old `semiToY`), `yToVStep(y)` (linear inverse). **The critical API change:** the inverse `vStepToSemis(vStep)` returns an *array* of semitones (0–1 in the linear case, 2 for compact staves); any module that used `yToSemi` for hit-testing must handle the array. `semiToY(semi)` survives as a composition wrapper `vStepToY(semiToVStep(semi))`. Blast radius is contained: other modules stop doing semitone arithmetic for vertical placement and ask the grid.
>
> ### 3. Disambiguation
>
> Leverage the existing `noteheadRules`. Add one optional property `horizontalOffset` (in staff spaces; positive = right). The notehead renderer applies `transform="translate(x,0)"` when present. Simple, declarative, reuses the rule matcher.
>
> ### 4. The Ledger-Logic Rework
>
> Migrate `ledger-set.js` from semitone-space to V-Step-space: convert all semitone inputs to V-Steps at the top; rewrite the gates (proximity `abs(noteVStep-ledgerVStep)`, betweenness, region `floor(vStep/octaveHeight)`). Algorithms are sound; only the input domain changes. Identical behavior when vStep == semi.
>
> ### 5. The Engine Question
>
> **Pursue a two-repo change.** Violating preview-equals-export for a whole class of systems is too high a cost and undermines the platform's core value; faking it with LilyPond overrides doesn't scale. Extend the engine: replace the single `cnb:semitones-per-staff-space` scalar with a pitch-map mirroring the JSON `pitchAxis`. **No front-end work should proceed beyond a prototype until the engine change is agreed upon and planned.**
>
> ### 6. Sequencing & Risk
>
> Phase 0 — Engine protocol & proof of concept (highest risk): propose the map as an engine hook; hand-author a `.ly` that typesets a Twinline scale via the hook; **go/no-go gate — if the engine maintainers refuse, STOP.** Phase 1 — grid refactor (byte-identical, pure plumbing). Phase 2 — logic migration (ledger-set etc., still byte-identical). Phase 3 — feature implementation (consume `pitchAxis` + `horizontalOffset`; tests for a non-uniform 1:1 and a many-to-one compact staff). Phase 4 — exporter & integration (emit the map; round-trip preview↔engrave). The cross-repo engine dependency is by far the highest risk and must be resolved first; the second is subtle ledger-migration bugs, mitigated by keeping phases 1–2 output-identical.

---

## Appendix — the brief given to both architects

The full prompt (system description, the semitone-linear `semiToY`, the module
inventory, the hard constraints, and the six specific questions) is preserved at
`scratchpad/consult_prompt.txt`; its substance is summarized in the Question
block at the top of this document. Both models received it identically.
