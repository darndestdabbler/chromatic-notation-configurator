# Custom clefs

> **Purpose:** Add custom clef support to the platform — a configurable
> clef glyph positioned on the semitone grid — across the config schema,
> preview renderer, UI, and (as engine capability allows) the LilyPond
> export. Motivating systems from the gallery survey include Express Stave
> and Clairnote; the exact requirement scope is
> `docs/research/gallery-survey/enhancement-requirements.md` (set 008's
> output), which this set treats as its scope authority.
> **Session Set:** `docs/session-sets/009-custom-clefs/`
> **Created:** 2026-07-06
> **Workflow:** full
> **Prerequisite:** `008-gallery-survey-and-feasibility` complete (the
> enhancement-requirements catalog defines what "clef support" must cover).

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # a human must visually confirm clef rendering in the preview and via the UI
requiresE2E: suggested                 # a Playwright pass over the clef editor would help; the visual test page + UAT are the primary checks
uatScope: per-set                      # one UAT pass at session 2 covering schema→preview→UI→export end-to-end
uatStyle: dsl                          # checklist in DSL step style executed via the repo's Playwright driver pattern (per sets 004–006)
verificationMode: out-of-band-or-none  # Lightweight only; inert on Full
totalSessions: 2
prerequisites:
  - slug: 008-gallery-survey-and-feasibility
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: first schema-extending feature since the release gate closed;
> a regression here would invalidate the set-007 round-trip guarantee, so
> cross-provider verification stays on.

> **Scope note — lifecycle records (explicit exemption; carried forward at
> authoring time from set 007's spec, where the precedent was established at
> the verifier's request in set 006):** each session's **Touches** line
> scopes the session's *product* changes only. The Dabbler session lifecycle
> additionally writes this set's own runtime records under
> `docs/session-sets/009-custom-clefs/` — `session-state.json`,
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
`enhancement-requirements.md`, this set adds a `clef` config section and
its rendering/UI/export surface.

**Binding design rules:**

1. **Default-off compatibility.** `clef.enabled: false` is the default, and
   with the default config the preview output and the generated `.ly`
   export are unchanged from their pre-set-009 state. This is verified
   mechanically (test comparing `CNBLilypond.generate()` output for the
   default config against a pre-change capture, and a preview test page
   check), not just asserted.
2. **Clef glyphs ride the existing shape pipeline.** A clef glyph is
   authored as an SVG (the `inkscape-music-glyph-toolkit` contract: path
   data, natural dimensions, `data-semitone-height`) and imported via the
   set-004 SVG importer, extended to accept a clef glyph kind. No parallel
   import mechanism.
3. **Grid-positioned rendering.** The clef renders in a left gutter of the
   card collection, vertically positioned via the semitone grid
   (`semiToY`), consistent with the architecture plan's statement that the
   grid module "will also serve as the positioning system for future
   elements like clefs" (Module 1, `docs/CNB-ARCHITECTURE-PLAN-v2.md` §5).
4. **Engine capability governs export.** The
   `lilypond-chromatic-notation-base` engine may or may not expose a clef
   hook today. Session 1 determines this by inspection and records the
   outcome; session 2 emits clef data only in the form the engine actually
   supports. If the engine has no clef support, the export emits nothing
   for clefs, the config still round-trips through JSON save/load, and the
   coordination note records the engine-side work as owned by the engine
   repo — implementing engine features is out of this set's scope.

**Non-goals:** key signatures (set 010); reproduction configs (set 011);
engine-repo code changes.

---

## Sessions

### Session 1 of 2: Schema, import, and preview rendering

**Goal:** `clef` config section with default-off compatibility, clef glyph
import, and grid-positioned preview rendering with tests and a visual test
page.

**Steps:**
1. Read `docs/research/gallery-survey/enhancement-requirements.md` (clef
   entry) and record in the session notes any scope adjustments it forces
   on the sketch below.
2. Extend Module A (`cnb/src/cnb-config.js`): add a `clef` section
   (default `{ enabled: false }`) covering glyph reference (a named entry
   reusing the shapes storage contract or a dedicated `clefGlyphs` map —
   decide against the requirements catalog and document the choice), anchor
   semitone (which grid position the glyph's reference point sits on), and
   horizontal gutter sizing. Extend `validate()` with clef checks (glyph
   exists when enabled, anchor within sane range) and keep all existing
   validation behavior unchanged.
3. Capture the pre-change default export: add a test asserting
   `CNBLilypond.generate(createDefault())` output is identical before and
   after this session's schema change (the clef section must be invisible
   to the exporter while disabled).
4. Extend the SVG importer (`cnb/ui/svg-importer.js` or its actual module
   name in `cnb/ui/`) to accept a clef glyph import, reusing the existing
   `data-*` attribute contract; anchors/stem attributes are not required
   for clefs.
5. Implement preview rendering: a `cnb/src/cnb-clef.js` module (pure
   config-in/DOM-out per the architecture principles) rendering the glyph
   into a left gutter, positioned via the grid; integrate into
   `cnb/src/cnb-collection.js` behind `clef.enabled`.
6. Unit tests (`cnb/tests/cnb-clef-tests.js`, config-test additions) and a
   visual test page (`cnb/test-pages/test-clef.html`) showing the clef
   against the debug grid at several anchor positions and staff patterns.
7. Engine capability discovery: inspect the
   `lilypond-chromatic-notation-base` engine sources for clef/glyph
   placement hooks; write `s1-engine-coordination.md` in this set's
   directory recording what exists, what export form session 2 will emit,
   and what (if anything) is engine-repo work.
8. Run `node cnb/tests/run-tests.js` and `node legacy/run-tests.js`; no
   regressions.

**Creates:** `cnb/src/cnb-clef.js`, `cnb/tests/cnb-clef-tests.js`,
`cnb/test-pages/test-clef.html`, `s1-engine-coordination.md` (in this
set's directory)

**Touches:** `cnb/src/cnb-config.js`, `cnb/src/cnb-collection.js`,
`cnb/ui/` (SVG importer module), `cnb/tests/` (config/collection test
additions)

**Ends with:** default config renders and exports exactly as before;
enabling a clef with an imported glyph renders it grid-positioned in the
preview and the visual test page; the engine coordination note pins what
session 2's export will emit.

**Progress keys:** `session-001/clef-schema-and-preview`, `session-001/engine-coordination`

---

### Session 2 of 2: UI editor, export, docs, and UAT

**Goal:** Clef editing in the UI, export per the session-1 coordination
outcome, and updated project docs.

**Steps:**
1. Build the clef editor UI (enable toggle, glyph selection from imported
   clef glyphs, anchor-semitone control, gutter sizing), wired into the
   assembled UI from set 006, following the property-based event wiring
   pattern used by the existing editors so `render()` stays Node-testable.
2. Implement export per `s1-engine-coordination.md`: if the engine exposes
   a clef hook, extend `cnb/src/cnb-lilypond.js` to emit it (and add
   section tests); if it does not, emit nothing for clefs and add a test
   pinning that a clef-enabled config still generates a valid `.ly` file
   identical to the same config with the clef disabled.
3. Ensure JSON save/load round-trips the `clef` section (including the
   open-keyed glyph map in `CNBConfigIO.REPLACE_PATHS` if the schema choice
   from session 1 introduced one).
4. Update `docs/CNB-ARCHITECTURE-PLAN-v2.md` with the `clef` config section
   and module entry, and `docs/CNB-LY-EXPORT-SPEC-v1_2.md` only if export
   emission was added (marked as a version-note addendum, following the
   007-established correction pattern).
5. UAT (per `uatScope: per-set`, `requiresUAT: true`): DSL-style checklist
   in `s2-uat.md` executed with the repo's Playwright driver pattern
   (`cnb/uat/`), covering import → enable → position → preview → save/load
   → export; then obtain the human operator's visual attestation of the
   rendered clef (attestation recorded verbatim in `s2-uat.md` before
   verification round 1, per the set-007 session 2 procedure).
6. Run `node cnb/tests/run-tests.js` and `node legacy/run-tests.js`; no
   regressions.
7. As the final session in this set, write `change-log.md` per the shared
   close-out gate (`docs/dabbler/start-here.md` Step 5).

**Creates:** clef editor module under `cnb/ui/`, `change-log.md`

**Touches:** `cnb/src/cnb-lilypond.js` (only if emission was pinned in
session 1), `cnb/ui/` (app wiring, config IO), `cnb/uat/`, `cnb/tests/`,
`docs/CNB-ARCHITECTURE-PLAN-v2.md`, `docs/CNB-LY-EXPORT-SPEC-v1_2.md`
(conditional, per step 4)

**Ends with:** a clef can be imported, configured, previewed, saved,
loaded, and exported through the UI; default-off output is proven
unchanged; docs reflect the new section; a human has attested the visual
result.

**Progress keys:** `session-002/clef-ui-and-export`, `session-002/docs-and-uat`

---

## End-of-set deliverables

- `clef` config section (default-off, output-compatible), preview module,
  UI editor, JSON round-trip, and export behavior pinned to actual engine
  capability.
- Engine coordination record (`s1-engine-coordination.md`) stating any
  engine-repo follow-on work.
- Updated architecture plan (and export spec if emission was added).
