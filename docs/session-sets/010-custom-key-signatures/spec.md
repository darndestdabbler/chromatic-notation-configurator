# Custom key signatures

> **Purpose:** Add custom key-signature support — per-key marks positioned
> on the semitone grid at the start of the staff (Clairnote DN's stacked
> marks are the motivating reference case) — across the config schema,
> preview renderer, UI, and (as engine capability allows) the LilyPond
> export. The exact requirement scope is
> `docs/research/gallery-survey/enhancement-requirements.md` (set 008's
> output), which this set treats as its scope authority.
> **Session Set:** `docs/session-sets/010-custom-key-signatures/`
> **Created:** 2026-07-06
> **Workflow:** full
> **Prerequisite:** `008-gallery-survey-and-feasibility` complete (scope
> authority); `009-custom-clefs` complete is strongly recommended — the
> key signature shares the gutter/grid glyph-placement infrastructure the
> clef set builds, and building it second avoids duplicating that work.

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # a human must visually confirm key-signature rendering in the preview and via the UI
requiresE2E: suggested                 # a Playwright pass over the key-signature editor would help; the visual test page + UAT are the primary checks
uatScope: per-set                      # one UAT pass at session 2 covering schema→preview→UI→export end-to-end
uatStyle: dsl                          # checklist in DSL step style executed via the repo's Playwright driver pattern (per sets 004–006)
verificationMode: out-of-band-or-none  # Lightweight only; inert on Full
totalSessions: 2
prerequisites:
  - slug: 008-gallery-survey-and-feasibility
    condition: complete
  - slug: 009-custom-clefs
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: same as set 009 — a schema-extending feature that must not
> disturb the proven round-trip; cross-provider verification stays on.

> **Scope note — lifecycle records (explicit exemption; carried forward at
> authoring time from set 007's spec, where the precedent was established at
> the verifier's request in set 006):** each session's **Touches** line
> scopes the session's *product* changes only. The Dabbler session lifecycle
> additionally writes this set's own runtime records under
> `docs/session-sets/010-custom-key-signatures/` — `session-state.json`,
> `session-events.jsonl`, `activity-log.json`, per-session working notes
> (e.g. `s1-engine-coordination.md`), `sN-uat.md`, `sN-verification.md`
> (and `sN-issues.json` when a round finds issues), `disposition.json`, and
> `change-log.md` on the final session — as the workflow SSoT describes
> ("Runtime artifacts such as `session-state.json`, … appear as the first
> session runs") and as the shared close gate enforces
> (`check_activity_log_entry`, `working_tree_clean`, `pushed_to_remote`).
> These records are **exempt from the Touches restriction** and are
> committed as docs-only commits, separate from product code.

---

## Project Overview

Per `docs/planning/project-plan.md` §8 (expansion program) and set 008's
`enhancement-requirements.md`, this set activates the config schema's
stubbed `keys` section (architecture plan §4.9) with a key-signature
capability.

**Binding design rules:**

1. **Default-off compatibility.** Key signatures default to disabled, and
   with the default config the preview output and the generated `.ly`
   export are unchanged from their pre-set-010 state — verified
   mechanically, same technique as set 009's step 3.
2. **Build on the existing `keys` schema stub.** `keys.definitions`
   (name + pitch-class list) already exists in the schema and has UI
   presence from set 006. The key signature is defined *relative to a key
   definition*: a mark style (glyph from the shape/glyph pipeline, or a
   simple built-in mark such as a dot) plus a placement rule mapping the
   key's pitch classes (or its tonic — decide against the requirements
   catalog and document the choice) to grid positions in the staff-start
   gutter.
3. **Reuse the set-009 gutter infrastructure.** Rendering composes with
   the clef gutter (clef then key signature, left to right) rather than
   introducing a second placement mechanism.
4. **Engine capability governs export** — same rule as set 009: session 1
   inspects the engine, records the outcome in
   `s1-engine-coordination.md`, and session 2 emits only what the engine
   supports; missing engine capability is documented as engine-repo work,
   not implemented here.
5. **IP posture:** Clairnote DN is the motivating reference
   (design licensed CC BY-SA 4.0; Paul Morris's `clairnote.ly`
   implementation is GPL v3). Per `docs/planning/project-plan.md` §5:
   study the *published description* of the notation, do not port code
   from `clairnote.ly`, attribute the inspiration in doc comments, and use
   "inspired by" framing in any UI copy.

**Non-goals:** off-key note marking (`offKeyMark` visual treatment remains
deferred per the architecture plan §11); key-aware notehead rule *matching*
beyond what sets 005–006 already shipped; reproduction configs (set 011);
engine-repo code changes.

---

## Sessions

### Session 1 of 2: Schema and preview rendering

**Goal:** Key-signature config under `keys` with default-off
compatibility, and grid-positioned preview rendering with tests and a
visual test page.

**Steps:**
1. Read `docs/research/gallery-survey/enhancement-requirements.md` (key
   signature entry) and record in the session notes any scope adjustments
   it forces on the sketch below.
2. Extend Module A (`cnb/src/cnb-config.js`): add a `keys.keySignature`
   subsection (default disabled) covering mark style (glyph reference or
   built-in mark), the placement rule (per binding rule 2), and gutter
   sizing. Extend `validate()` accordingly; existing validation behavior
   unchanged.
3. Pin default-export compatibility: test asserting
   `CNBLilypond.generate(createDefault())` output is identical before and
   after the schema change.
4. Implement preview rendering: `cnb/src/cnb-key-signature.js` (pure
   config-in/DOM-out), composing with the set-009 gutter in
   `cnb/src/cnb-collection.js`; renders the marks for the currently
   selected key.
5. Unit tests (`cnb/tests/cnb-key-signature-tests.js`, config-test
   additions) and a visual test page
   (`cnb/test-pages/test-key-signature.html`) showing marks against the
   debug grid for several keys and staff patterns, with and without a
   clef enabled.
6. Engine capability discovery: inspect the engine for key-signature
   placement hooks; write `s1-engine-coordination.md` recording what
   exists and what export form session 2 will emit.
7. Run `node cnb/tests/run-tests.js` and `node legacy/run-tests.js`; no
   regressions.

**Creates:** `cnb/src/cnb-key-signature.js`,
`cnb/tests/cnb-key-signature-tests.js`,
`cnb/test-pages/test-key-signature.html`, `s1-engine-coordination.md` (in
this set's directory)

**Touches:** `cnb/src/cnb-config.js`, `cnb/src/cnb-collection.js`,
`cnb/tests/` (config/collection test additions)

**Ends with:** default config renders and exports exactly as before;
enabling a key signature renders grid-positioned marks for the selected
key in the preview and visual test page, composing correctly with a clef;
the coordination note pins session 2's export form.

**Progress keys:** `session-001/keysig-schema-and-preview`, `session-001/engine-coordination`

---

### Session 2 of 2: UI editor, export, docs, and UAT

**Goal:** Key-signature editing in the UI, export per the session-1
coordination outcome, and updated project docs.

**Steps:**
1. Build the key-signature editor UI (enable toggle, mark-style selection,
   placement-rule controls), wired into the assembled UI alongside the
   existing key-definition controls from set 006, following the
   property-based event wiring pattern so `render()` stays Node-testable.
   Render an explicit empty/disabled state when `keys.enabled` is false
   (per the set-006 session 3 lesson: gate exactly on the documented
   condition and show a disabled state, don't hide).
2. Implement export per `s1-engine-coordination.md`: emit the engine's
   supported form in `cnb/src/cnb-lilypond.js` (with section tests), or —
   if the engine has no hook — emit nothing and pin with a test that a
   key-signature-enabled config generates a valid `.ly` identical to the
   same config with it disabled.
3. Ensure JSON save/load round-trips the new subsection (REPLACE_PATHS
   entry if an open-keyed map was introduced).
4. Update `docs/CNB-ARCHITECTURE-PLAN-v2.md` §4.9 with the activated
   schema, and `docs/CNB-LY-EXPORT-SPEC-v1_2.md` only if export emission
   was added (version-note addendum).
5. UAT (per `uatScope: per-set`, `requiresUAT: true`): DSL-style checklist
   in `s2-uat.md` executed with the Playwright driver pattern
   (`cnb/uat/`), covering enable → key selection → mark styling → preview
   → save/load → export; then obtain the human operator's visual
   attestation, recorded verbatim in `s2-uat.md` before verification
   round 1.
6. Run `node cnb/tests/run-tests.js` and `node legacy/run-tests.js`; no
   regressions.
7. As the final session in this set, write `change-log.md` per the shared
   close-out gate (`docs/dabbler/start-here.md` Step 5).

**Creates:** key-signature editor module under `cnb/ui/`, `change-log.md`

**Touches:** `cnb/src/cnb-lilypond.js` (only if emission was pinned in
session 1), `cnb/ui/` (app wiring, config IO), `cnb/uat/`, `cnb/tests/`,
`docs/CNB-ARCHITECTURE-PLAN-v2.md`, `docs/CNB-LY-EXPORT-SPEC-v1_2.md`
(conditional, per step 4), `cnb/src/cnb-config.js` and
`cnb/src/cnb-key-signature.js` (see the note below)

> **Touches expansion — operator UAT direction (added during session 2,
> attributed to the task owner):** the set's `requiresUAT: true` flow and
> session-2 step 5 ("obtain the human operator's visual attestation")
> invoke the task owner's authority over the rendered result. In session-2
> UAT the operator directed changes to the key-signature RENDERER and
> SCHEMA — specifically: (a) the separator bar must run through the
> horizontal middle of the note columns and be thicker (engine-verified
> geometry: `keys.keySignature.separator` defaults + `cnb-key-signature.js`
> render order); and (b) after evaluating simple-mark styles (dot, interval
> blocks, staggered ledgers), ship the note-stack as the SOLE style and
> defer richer custom-symbol signatures — reverting the `style` vocabulary
> to a single value and removing the alternate-style schema subsections.
> These land in `cnb/src/cnb-config.js` (schema defaults + validation) and
> `cnb/src/cnb-key-signature.js` (the Module 22 renderer, a session-1
> Creates file), both outside the original session-2 Touches list. The
> verbatim operator dialogue driving each change is recorded in `s2-uat.md`
> (UAT rounds 1–3) and the design consult in `s2-design-consult.md`.

**Ends with:** a key signature can be configured, previewed, saved,
loaded, and exported through the UI; default-off output is proven
unchanged; docs reflect the activated `keys` section; a human has attested
the visual result.

**Progress keys:** `session-002/keysig-ui-and-export`, `session-002/docs-and-uat`

---

## End-of-set deliverables

- `keys.keySignature` config capability (default-off, output-compatible),
  preview module composing with the clef gutter, UI editor, JSON
  round-trip, and export behavior pinned to actual engine capability.
- Engine coordination record (`s1-engine-coordination.md`) stating any
  engine-repo follow-on work.
- Updated architecture plan (and export spec if emission was added).
