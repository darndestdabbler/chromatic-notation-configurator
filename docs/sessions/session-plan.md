# Session plan — chromatic-notation-configurator

> **Migrated to Dabbler 3.x on 2026-10-30.** Sessions 1–4 are v1 session set
> `014-pitch-axis-implementation`, folded in by `dabbler session migrate`
> (session 1 was already complete and verified). Sessions 5 onward are the
> wrap-up program the operator approved on 2026-10-30, appended at the end of
> this file. Two v1 notions below no longer apply: the "Scope note —
> lifecycle records" (3.x keeps its records under `docs/sessions/` and
> `.dabbler/`, never under `docs/session-sets/`), and the per-set
> `sN-uat.md` / `sN-verification.md` / `disposition.json` files (UAT notes
> for session 4 go in `docs/sessions/uat-session-4.md`). The engine
> dependency named for session 3 is met: the engine repo's set
> `008-pitch-axis-hook` closed on 2026-07-13, with its record at
> `lilypond-chromatic-notation-base/docs/session-sets/008-pitch-axis-hook/configurator-handoff.md`.
>
> **Purpose (sessions 1–4):** Implement the operator-approved pitch-axis design: the
> `pitchAxis` config section, the `CNBPitchAxis` axis gatekeeper, the
> consumer-module rethread, the v1.3 export surface with its fail-loud gate,
> compact-staff fixtures with an engine round-trip, UI presets, and the
> feasibility-matrix re-tier of the Twinline family (records 32–40).
> **Session Set:** `docs/session-sets/014-pitch-axis-implementation/`
> **Created:** 2026-07-10
> **Workflow:** full
> **Authorization:** set 013's per-set UAT — the operator's verbatim decision
> "Approve — authorize implementation set (Recommended)" is on record in
> [`../013-pitch-axis-engine-discovery/s2-uat.md`](../session-sets/013-pitch-axis-engine-discovery/s2-uat.md).
> **Design inputs (authoritative — implement these, do not re-design):**
> [`docs/planning/pitch-axis-design.md`](../planning/pitch-axis-design.md)
> (schema §1, grid contract §2, disambiguation §3, program plan §5, named
> consult deviations §6) and
> [`docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md`](../planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md)
> (the export draft this set adopts). Engine dependency: the engine repo's
> set `008-pitch-axis-hook` (E13-1…E13-5, from
> [`../013-pitch-axis-engine-discovery/s1-engine-coordination.md`](../session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md) §6).

---

## Session Set Configuration

```yaml
tier: full                         # high-stakes engine-contract + geometry work; cross-provider verification per session
requiresUAT: true                      # the operator reviews the compact-staff preview/engrave results before the set closes
requiresE2E: true                      # sessions 3–4 drive the preview and export in a real browser (Playwright) per the repo's UAT-driver pattern
uatScope: per-set                      # one review pass at session 4 covering fixtures, presets, and the round-trip
uatStyle: ad-hoc                       # operator review of rendered compact-staff output, not a scripted DSL flow
verificationMode: out-of-band-or-none  # Lightweight only; inert on Full
totalSessions: 4
prerequisites:
  - slug: 013-pitch-axis-engine-discovery
    condition: complete
```

> **Tier:** `full` | `lightweight` — SSoT:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: this set changes the platform's core coordinate system and its
> export contract. Every session carries the byte-identity pins (Kite
> round-trip, export baselines, full test suite) and a cross-provider
> verifier checking the implementation against the adopted design.

> **Scope note — lifecycle records (explicit exemption; carried forward at
> authoring time from set 013's spec, where the precedent chain from sets
> 006/007 continues):** each session's **Touches** line scopes the
> session's *product* changes only. The Dabbler session lifecycle
> additionally writes this set's own runtime records under
> `docs/session-sets/014-pitch-axis-implementation/` —
> `session-state.json`, `session-events.jsonl`, `activity-log.json`,
> per-session working notes, `sN-uat.md`, `sN-verification.md` (and
> `sN-issues.json` when a round finds issues), `disposition.json`, and
> `change-log.md` on the final session — as the workflow SSoT describes
> ("Runtime artifacts such as `session-state.json`, … appear as the first
> session runs") and as the shared close gate enforces
> (`check_activity_log_entry`, `working_tree_clean`, `pushed_to_remote`).
> These records are **exempt from the Touches restriction** and are
> committed as docs-only commits, separate from product changes.

---

## Project Overview

Set 013 proved (by real engine render) that the CNB engine can place
noteheads, stems, and ledgers from an arbitrary many-to-one
semitone→staff-position procedure, designed the `pitchAxis` schema and the
v1.3 export surface around it, and obtained the operator's authorization to
implement. This set is the configurator-side implementation, phase for
phase the design's §5.1 plan (P1–P6). The engine-side work (P0: the
`cnb:get-pitch-staff-position` hook E13-1, the `x-offset` field E13-2, and
follow-ons E13-3…E13-5) is owned by the **engine repo's set
`008-pitch-axis-hook`** and may run in parallel; only session 3's
round-trip work is blocked on it.

**Binding rules:**

1. **Implement the design as approved — do not re-design.** The design doc
   and the v1.3 draft are the authoritative inputs; any implementation-forced
   departure is called out with its reason in the session record and, if it
   changes the operator-reviewed surface, re-attested at UAT.
2. **Default-off byte-identity is enforced by construction, at every
   phase.** Disabled/absent `pitchAxis` runs the literal pre-existing code
   paths (design §1.3, deviation D3); `createDefault()` gains no `pitchAxis`
   section; every session runs the full suite, the Kite round-trip, and the
   export baselines before commit, and they must be byte-identical until a
   fixture explicitly enables the feature.
3. **Fail-loud export gate until the engine capability lands.** `generate()`
   throws on `pitchAxis.enabled` (draft §8a) until session 3 verifies, from
   the engine repo's set-008 configurator-handoff record, that E13-1 and
   E13-2 have shipped; the gate is removed in the same session that first
   emits §5.4/§6.3, with the engine round-trip as evidence. No silent linear
   `.ly` for a compact config, ever.
4. **No engine commits from this set.** Engine work happens in the engine
   repo's own sets; this set consumes its handoff records (the sets-005/006
   cross-repo rule of engagement).

**Non-goals:** non-monotonic axis kinds (rejected by PA-8 in
`pitch-class-map-v1`; a future kind must specify them first); multi-pc
mixed-offset chord preview (outside the octave-card example surface —
engine E13-2 territory); fixing the pre-existing in-gap ledger
preview↔engine divergence (documented parity limit, design §2.4);
off-key marking; any Tier-4 family other than I2.

---

## Sessions

### Session 1 of 4: Export-spec adoption + `CNBPitchAxis` + grid (P1, P2)

**Goal:** the v1.3 draft is adopted as the canonical export spec, the
architecture plan is amended, and the axis gatekeeper + grid axis path
exist with exhaustive tests — with all pins byte-identical.

**Steps:**
1. Adopt `docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md` as
   `docs/CNB-LY-EXPORT-SPEC-v1_3.md` (v1.2 stays in place for history);
   amend `docs/CNB-ARCHITECTURE-PLAN-v2.md` with the `pitchAxis` section
   (§4.x addendum, the sets-009/010 addendum pattern) and Module inventory
   entries for `CNBPitchAxis`.
2. Build `cnb/src/cnb-pitch-axis.js` per design §2.1: `create(config)`,
   `positionOfSemi` (integer + fractional interpolation), `regionOfSemi`,
   `distance`, `semisAtPosition`, `nearestSemisForY`; linear degeneracy
   exact.
3. Add the grid axis path per design §2.2: axis-enabled contexts get the
   axis formula, `yToAxis`, no scalar `yToSemi`, axis-aware
   `renderDebugOverlay`; the disabled branch keeps the literal current
   `semiToY` body.
4. Module A: `pitchAxis` validation PA-1…PA-8 and PA-W1/W3/W4 (design
   §1.4), type-safe posture; `resolveNotehead` gains `xOffsetStaffSpaces`
   (default 0).
5. Tests (in the existing per-module test files plus
   `cnb-pitch-axis-tests.js`): disabled output byte-identical against a
   pre-change baseline; the design's two machine-checked anchors (linear
   degeneracy; the 013 spike geometry `'(-3 -1 1 4 6 8)` reproduction);
   non-uniform 1:1 maps; many-to-one candidate inverses; PA-8 rejection
   cases.

**Creates:** `cnb/src/cnb-pitch-axis.js`, `cnb/tests/cnb-pitch-axis-tests.js`,
`docs/CNB-LY-EXPORT-SPEC-v1_3.md`.
**Touches:** `cnb/src/cnb-grid.js`, `cnb/src/cnb-config.js`,
`cnb/tests/cnb-grid-tests.js`, `cnb/tests/cnb-config-tests.js`,
`cnb/tests/run-tests.js`, `docs/CNB-ARCHITECTURE-PLAN-v2.md`.
**Progress keys:** `session-001/spec-adoption`, `session-001/axis-and-grid`

### Session 2 of 4: Consumer rethread (P3)

**Goal:** every geometry consumer reads the axis through the grid, with the
entire existing surface byte-identical (feature still off everywhere).

**Steps:**
1. Staff: axis-position dedup on the axis path (design §2.3); literal
   current loop on the linear path.
2. Ledger set: re-metrication per design §2.4 — axis conversion at the top,
   strict `<` preserved, axis-keyed rendering, region via
   `axis.regionOfSemi`; literal current arithmetic on the linear path.
3. Stem direction (axis-position average, design §2.5); double-notehead
   per-note X offsets; card offset + stem-centerX plumbing +
   `columnWidth` widening; collection pass-through (design §2.3).
4. Visual test page `test-pitch-axis.html` (compact-axis card row with the
   013 Twinline map; debug grid) + Chromium geometry smoke per the repo's
   driver pattern.
5. All existing tests, the Kite round-trip, and the export baselines
   byte-identical; new tests for each consumer's axis behavior.

**Creates:** `cnb/test-pages/test-pitch-axis.html`.
**Touches:** `cnb/src/cnb-staff.js`, `cnb/src/cnb-ledger-set.js`,
`cnb/src/cnb-stem.js`, `cnb/src/cnb-double-notehead.js`,
`cnb/src/cnb-card.js`, `cnb/src/cnb-collection.js`,
`cnb/src/cnb-key-signature.js`, their test files, `cnb/tests/run-tests.js`.
**Progress keys:** `session-002/consumer-rethread`, `session-002/byte-identity-pins`

### Session 3 of 4: Exporter + fixtures + engine round-trip (P4) — **gated on engine set 008**

**Gate (check FIRST):** read the engine repo's
`docs/session-sets/008-pitch-axis-hook/` state and configurator-handoff
record. E13-1 (the hook) and E13-2 (the `x-offset` field) must be landed
with their golden-baseline evidence. **If they are not, stop after step 1
and surface to the operator** — do not emit axis output against an engine
that lacks the hook (binding rule 3); the fail-loud gate stays.

**Steps:**
1. Implement the fail-loud gate (draft §8a) + exporter validation additions
   (§8 checks 8–12) — legal and useful even if the engine gate fails.
2. Implement v1.3 emission per the adopted spec: §5.4a/b (compiled
   procedure, axis staff-line positions with dedup), §4.4a/§5.3a
   (`axisUnitsPerStaffSpace` substitutions), §6.3 (`(x-offset . N)` in the
   grouping key), reconciled against the engine handoff's exact contract
   (names/units may have set-008 deviations — reconcile and record).
3. Compact fixtures: at minimum a Twinline-family fixture using the
   013 map with shared-pair `xOffsetStaffSpaces` disambiguation, loaded
   through `CNBConfigIO` like the gallery fixtures.
4. Engine round-trip: export → `lilypond -dbackend=svg` (engine repo,
   LilyPond 2.24.2) → `tools/harvest_svg.py` → measure mapped positions
   (the 013-s1 instrument); preview↔engine parity checks against the
   documented divergence list.
5. Export baselines: all existing (axis-disabled) exports still
   byte-identical; new pinned baseline for the compact fixture.

**Creates:** compact fixture(s) under `cnb/assets/examples/`, round-trip
driver + evidence under this set's session records.
**Touches:** `cnb/src/cnb-lilypond.js`, `cnb/tests/cnb-lilypond-tests.js`,
`cnb/tests/run-tests.js`, `cnb/ui/config-io.js` (only if fixture loading
needs it).
**Progress keys:** `session-003/exporter-and-gate`, `session-003/fixtures-and-roundtrip`

### Session 4 of 4: UI presets + re-tier + operator UAT (P5, P6)

**Steps:**
1. Pitch-axis editor panel (`cnb/ui/pitch-axis-editor.js`, Modules 12–17
   editor contract: property-based event wiring, Node-testable `render()`,
   pure builders, Module A validation pass-through) — enable, kind, stride,
   per-pc positions, `axisUnitsPerStaffSpace`, plus preset(s)
   ("Twinline-like 7-position") that compile into the explicit map +
   offset rules (design §1.1).
2. Wire into the preview app; `xOffsetStaffSpaces` editing on the notehead
   rule editor.
3. Feasibility-matrix re-tier: records 32–40 re-tiered as a dated
   amendment (the 008-s2 framework-change rule) with the reproduced
   fixture as evidence.
4. UAT (per-set): the operator reviews the compact-staff preview, the
   engine render, and the preset flow; verbatim decision in
   `docs/sessions/uat-session-4.md` (attestation before verification
   round 1).
5. Final session: `change-log.md`.

**Creates:** `cnb/ui/pitch-axis-editor.js`,
`cnb/tests/cnb-pitch-axis-editor-tests.js`, `change-log.md`.
**Touches:** `cnb/ui/app.js`, `cnb/ui/notehead-rule-editor.js`,
`cnb/index.html`, `cnb/tests/run-tests.js`,
`docs/research/gallery-survey/feasibility-matrix.md` (dated amendment).
**Progress keys:** `session-004/presets-and-editor`, `session-004/retier-and-uat`

---

<!-- Wrap-up program, approved by the operator 2026-10-30. Goal: the
     Configurator is reliable for simple exploration, fully documented, and
     released as 1.0.0 (then made public under CC0). -->

### Session 5: Browser UAT becomes reproducible

**Why.** The ten Playwright drivers under `cnb/uat/` last ran in July from a
scratch directory. Nothing in the repository declares `playwright-core` or a
Chromium, so on 2026-10-30 none of them can run, and the UI has no automated
end-to-end check.

1. Register.
2. Add a root `package.json` (private, no runtime dependencies) declaring
   `playwright-core` as a devDependency, with scripts `test`
   (`node cnb/tests/run-tests.js`) and `uat` (runs every `cnb/uat/uat-*.mjs`
   driver in sequence and exits non-zero on the first failure); document
   `npm install` and `npx playwright install chromium` in the README. The
   product stays zero-dependency: only dev tooling is declared. Make the
   drivers resolve `playwright-core` from the repository's own
   `node_modules` when `CNB_UAT_PLAYWRIGHT` is unset.
3. Run all ten drivers and fix whatever three months of drift broke, in the
   drivers or the app. Record each driver's result in `docs/uat-status.md`.
4. Either declare the UAT run as a second suite in `dabbler.yaml`
   (`command: npm run uat`, `expensive: true`, `whole_at_close: true`,
   `runs_whole: true`, `covers: [cnb/]`) or record in `docs/uat-status.md`
   why it stays an operator-run check.

**Non-goals.** New UAT coverage. Cross-browser runs (session 6).

**Tests.** `npm run uat` green from a fresh clone after `npm install` and the
Chromium install.

### Session 6: Hostile input, error paths and the browser matrix

**Why.** Every UAT so far followed the golden path. A person exploring will
load the wrong file, an old save, or a shape drawn without the toolkit, and
the app should tell them what is wrong rather than fail in the console.

1. Register.
2. Tests and fixes for: an SVG that is not toolkit output, an SVG without
   `data-lilypond-*` attributes, a JSON save from an older schema version, a
   truncated or non-JSON file, and export of an invalid config. Every
   validation error reaches the user as a visible message; nothing throws to
   the console.
3. Open the app in Chromium, Firefox and Edge; fix what breaks; add a
   "Supported browsers" table to the README.
4. If the toolkit has shipped minim stem anchors (its session 4: a second
   placemarker pair, `<rect id="stem-minim-up">` / `<rect id="stem-minim-down">`,
   with no `data-*` attributes), read them in the SVG importer
   (`cnb/ui/svg-importer.js`) with the same `readStemRect` rule as the
   regular pair (bottom-centre of up, top-centre of down) into
   `anchors.minimUp`/`minimDown`, falling back to the crotchet anchors when
   the pair is absent, and export them; otherwise record that the importer
   still copies crotchet anchors.

**Non-goals.** Schema changes. Mobile layouts.

**Tests.** New cases in `cnb/tests/cnb-svg-importer-tests.js`,
`cnb/tests/cnb-config-io-tests.js` and `cnb/tests/cnb-config-export-tests.js`.

### Session 7: Retire `legacy/`, rewrite the README and the guidance

Policy: fast

**Why.** The README still says the tool "is being rebuilt from a monolithic
HTML file" and cites export spec v1.2; `CLAUDE.md` describes `legacy/` and v1.2;
`legacy/` (about 9,900 lines, reference only) has had no reader since the
rewrite reached parity; `docs/planning/lessons-learned.md` is still the v1
template placeholder.

1. Register.
2. Tag the current commit `legacy-monolith-final`, delete `legacy/`, and
   update every reference to it (README, `CLAUDE.md`, the architecture plan's
   file-structure section) to point at the tag.
3. Rewrite the README for a 1.0.0 product: status "complete", spec v1.3, a
   "Known limitations" section that summarizes and links Part 2 of
   `docs/playbook/notation-builder-playbook.md` (the five invariants, as
   amended by sessions 2–4), and a "Running the tests and UAT" section that
   matches `dabbler.yaml`. Where it names the LilyPond needed to engrave an
   export, say 2.24.x or 2.26.x (the engine supports 2.26 from 1.1.0); the
   current "LilyPond 2.24+" overclaims versions nobody tested. Update `CLAUDE.md` (spec v1.3, Module 24, no
   legacy section).
4. Replace the placeholder `lessons-learned.md` with real lessons harvested
   from the session-set `change-log.md` files, or delete it with
   `lessons-archive.md` and `project-guidance.md`; remove v1 `ai_router`
   instructions from whatever is kept. Add a root `version.json` reading
   `{ "version": "1.0.0" }`: it is the file the release reads its version
   and tag from.

**Non-goals.** Code changes beyond deleting `legacy/`.

**Tests.** The unit suite (no `legacy/` import exists in `cnb/`).

### Session 8: Packaging

Policy: fast

1. Register.
2. Write the `packaging:` block into `dabbler.yaml`, and nothing else: a
   `pack` with no `push`, whose artifact is a source archive of the trunk:
   `argv: ["git", "archive", "--format=zip",
   "--output={output}/chromatic-notation-configurator-1.0.0.zip", "HEAD"]`.
   (`release: tag` is not usable here: in Dabbler 3.27.0 it validates the
   orchestration repository's own manifests and names a `vsix-v*` tag.)
   Check it with `dabbler packaging --rehearse`.

### Session 9: Release 1.0.0 (release: 1.0.0)

The framework publishes sessions 1–7 as 1.0.0: it runs the pack, then
creates the annotated tag `v1.0.0` (from `version.json`) and pushes it to
origin. A major version: this is the first release.

---

## Sessions 1–4 deliverables (v1 set 014)

- `pitchAxis` end to end: schema + validation, axis gatekeeper, grid,
  consumers, exporter (emission live only with the engine capability
  verified; fail-loud otherwise), fixtures, presets, editor.
- Canonical `docs/CNB-LY-EXPORT-SPEC-v1_3.md`; architecture plan amended.
- A Twinline-family fixture reproducing through preview **and** engine,
  with a pinned round-trip baseline.
- Feasibility-matrix records 32–40 re-tiered by dated amendment.
- Operator UAT decision on record; all pre-existing baselines byte-identical
  throughout.

### Session 10: No imported text can become Scheme

**Why.** A whole-repository audit on 2026-11-02
(`docs/planning/audit-2026-11-02.md`; finding IDs below refer to it)
found that a shared config or SVG can put executable Scheme into the
exported `.ly` (H1). LilyPond runs it at compile time, and `(system …)`
would run commands. The affected fields include labels and names that
land in `%%` comments (where a newline ends the comment),
`lilypondVersion`, `schemeSymbols` values, `defaultMagnify`, duration
names, and path data taken verbatim from `data-lilypond-*` attributes,
which the toolkit audit (M11) reached independently. Validation called
these configs valid. 1.0.0 is tagged, and nothing is public; this ships
as 1.0.1.

1. Register.
2. Route every value that `cnb/src/cnb-lilypond.js` emits through a small
   set of emitters, and never interpolate raw config text:
   - **Comment text:** control characters and newlines become spaces (this
     also covers L6).
   - **Scheme strings:** escape `\` and `"`.
   - **Symbols:** match `^[a-z][a-z0-9-]*$`, else the export fails with
     the field's name.
   - **Numbers:** finite JavaScript numbers, formatted by the exporter.
   - **Versions:** match `^\d+\.\d+\.\d+$`.
   - **Path data:** parsed into commands and numbers and re-emitted from
     the numbers, including `data-lilypond-*` from imported SVGs. A path
     that does not parse is an import error, never text passed through.

   Validation rejects every value the emitters would reject, so an invalid
   config never reaches export.
3. M5: shape names whose slugs collide (`Kite Up` / `kite-up`), and names
   whose slug is empty (non-ASCII), get a validation error naming both
   shapes, or a deterministic disambiguating suffix. They never overwrite
   silently.
4. Hostile-input tests:
   - Add the audit's payloads as fixtures: `shared-config.json` (newline
     plus `#(display …)` in the notation label), and an SVG whose
     `data-lilypond-notehead` carries `#(display …)`, plus one payload per
     affected field.
   - Unit tests assert that each payload is either rejected, or exports a
     `.ly` in which no `#(` or `$(` appears outside the exporter's own
     constant template.
   - An engine-backed test, which skips with a reason when LilyPond is not
     on `PATH`, compiles each export and asserts that the payload text is
     never printed.

   Run the cnb-unit suite.

### Session 11: Path data in the units the engine reads

1. Register.
2. H2, H3:
   - **Toolkit paths:** a toolkit SVG's `data-lilypond-*` paths are in
     semitone units. The exporter divides them by the staff's semitones
     per staff space, exactly as `semiToStaffSpace` already does for
     anchors.
   - **Fallback conversion:** `svgPathToLilypond`, the path for SVGs
     without toolkit data, applies the toolkit's normalisation instead of
     emitting raw coordinates: 100 units per semitone, centred, Y up. It
     then applies the same division.
   - **Shared code:** one conversion function serves both paths, with unit
     tests at sps 1, 2 and 3.
3. Regenerate fixtures from real data, never by hand:
   - **Kite and twinline-compact:** rebuild them by importing
     `cnb/fixtures/kite-up.svg` / `kite-down.svg` (and the twinline
     shapes) through the importer, then export. The Kite export must still
     match the engine's golden score. If it does not, find which side is
     wrong and record it; do not hand-scale to make it pass.
   - **Baselines:** re-baseline `default-export-baseline.ly` and the
     gallery baselines.
   - **Size test:** add an engine-backed test (skipping without LilyPond)
     that renders the default config and asserts the notehead bounding box
     is between 0.5 and 3 staff spaces.
   - **Gallery check:** it must do more than prove `generate()` doesn't
     throw. Each gallery export's noteheads must engrave, in the same
     engine-backed measurement, at the size the preview draws them,
     within 5% in width and height. The 0.5–3 staff-space bound applies
     to the default config only. *(Amended 2026-11-03 by operator
     decision during session 11: the Express Stave fixtures draw
     2-semitone noteheads at 6 semitones per staff space, so a correctly
     scaled export engraves them at about 0.33 staff spaces, exactly
     their preview size. A fixed 0.5 lower bound would fail them unless
     the export were mis-scaled or their preview changed.)*
4. Toolkit M5, M7, M8 (the importer side):
   - accept `data-lilypond-glyph`, the toolkit's glyph-mode attribute, for
     clefs, and import every path, not only the first;
   - when an SVG carries attributes from both modes, prefer the one
     matching the import target, and warn;
   - apply a rect's `transform` before reading anchors.

   Toolkit 1.0.1 bakes transforms out, but SVGs from 1.0.0 may still carry
   them. Add a unit test for each.

### Session 12: Export only what the engine engraves

1. Register.
2. M1: the exporter emits no `cnb:stem-thickness`, which the engine
   doesn't define and which makes LilyPond fail. The stem thickness
   control says it is preview-only. M2: staff line colour and thickness,
   and ledger rules, are marked in the UI and in the export header as
   preview-only until the engine supports them. Add them to README
   "Known limitations". Low items L2 and L3 get the same treatment: the
   CB-safe toggle and the edited repeat counts are either exported
   faithfully or labelled preview-only, and the header never claims a
   palette the export doesn't carry.
3. M3: a notehead rule scoped to a key is either exported (Section C can
   branch on `key`) with a test, or refused at export with a warning that
   names the rule; it never vanishes silently. M4: editing the staff
   (even a colour) never resets `staff.midpoint` or sps. Add a test that
   edits twinline-compact (midpoint 7) and asserts the pitch-axis export
   is byte-identical apart from the edited field.
4. L1: fix the "derived LilyPond geometry" panel under a pitch axis.
   L4: every `approx()` helper fails on NaN (`!(Math.abs(a - b) <= tol)`).
   L5: the test runner counts a test file with no `tests` export as a
   failure. Run the cnb-unit suite; it must still pass with no test
   hiding behind the stricter checks.

### Session 13: Documentation, archive and 1.0.1

1. Register.
2. M6: push the `legacy-monolith-final` tag to origin
   (`git push origin legacy-monolith-final`). Check every README and
   `CLAUDE.md` link to it resolves on GitHub. L7: the README describes
   `cnb/assets/` as it is. README "Known limitations" lists what sessions
   10–12 made preview-only.
3. Release archive hygiene: add `.gitattributes` `export-ignore` for
   `.vscode/`, `AGENTS.md`, `CLAUDE.md`, `docs/sessions/`,
   `docs/transcripts/` and `docs/planning/`. Prove it with
   `dabbler packaging --rehearse` (list the zip in the session notes).
   Set `version.json` to `1.0.1`, and add a `CHANGELOG.md` with 1.0.0
   and 1.0.1. The entry must say that exports from 1.0.0 with toolkit
   shapes or fallback paths were mis-scaled and should be regenerated.

### Session 14: Release 1.0.1 (release: 1.0.1)

### Session 15: The app online, and a page that says why it is blank

Scope: `.github/workflows/pages.yml`, `cnb/site/`, `cnb/index.html`,
`cnb/uat/`, `.gitattributes`, `README.md`, `CHANGELOG.md`,
`docs/uat-status.md`, `dabbler.yaml` (comments only).

**Why.** On 2026-11-05 the operator opened `cnb/index.html` from disk and
got a page of empty panels: over `file://` the browser blocks every ES
module import (CORS), so only the static HTML and CSS render, with no
message saying why. The README does say to serve the app over HTTP, but
nobody should have to read it to find out, and most users should not have
to run a server at all. Decided 2026-11-05: the app is published on GitHub
Pages at **`https://configurator.darndestdabbler.org/`**, deployed by a
GitHub Actions workflow **on release tags only**, so the live site is
always a release. The repository is being made public for this. 1.0.2
(session 17) is the first deploy.

**Operator prerequisites** (settings, not files; the session checks them
read-only with `gh api repos/darndestdabbler/chromatic-notation-configurator`
and `…/pages`, records what it finds in the notes, and does not change
them):
- the repository is public;
- Settings → Pages → Source is "GitHub Actions";
- the custom domain `configurator.darndestdabbler.org` is set in Settings →
  Pages (a `CNAME` file is ignored by an Actions deploy), with a DNS CNAME
  record from `configurator` to `darndestdabbler.github.io`, and "Enforce
  HTTPS" ticked once the certificate is issued.

If any of these is missing, the session still lands its files and says so
in the notes. The first deploy (session 17) cannot reach the domain until
they are in place.

**What.**

1. Register.
2. The `file://` notice. `cnb/index.html` gains a small classic (non-module)
   inline script that runs before the module script. When
   `location.protocol === "file:"` it shows a visible notice at the top of
   the page. The notice says the configurator must be served over HTTP,
   links to the live site, and gives the two local commands the README
   gives (`npx serve .` / `python -m http.server 8000`, then open
   `/cnb/index.html`). Over HTTP the notice never appears and nothing else
   changes. Also find the one 404 the page logs when served over HTTP
   (probably `/favicon.ico`) and remove it, for example with an inline
   `<link rel="icon">`, so a served page logs no console errors at all.
3. The published site. The app is self-contained in `cnb/`: `index.html`
   imports only `./src/` and `./ui/`, those import only each other, and
   nothing is fetched at run time. A small Node script,
   `cnb/site/assemble-site.mjs <outDir>`, copies `cnb/index.html`,
   `cnb/src/`, `cnb/ui/` and `cnb/assets/` into `<outDir>` so the app sits
   at the site root (`/`, with no redirect). Tests, UAT drivers, test pages,
   fixtures and docs are not published. It is a copy, not a build: no
   transform, no bundling, no dependency.
4. The workflow, `.github/workflows/pages.yml`. It runs on `push` of tags
   matching `v*` and on `workflow_dispatch`, so the operator can redeploy
   by running it from a chosen tag. It checks out the tag, runs
   `node cnb/site/assemble-site.mjs _site`, and deploys with
   `actions/configure-pages`, `actions/upload-pages-artifact` and
   `actions/deploy-pages`, with `permissions: { pages: write, id-token:
   write, contents: read }` and a `pages` concurrency group. Pin each
   action to a major version. It runs no tests: the release only tags
   what the session gates already passed. `.gitattributes` export-ignores
   `/.github` so the release zip stays as it is.
5. A UAT driver, `cnb/uat/uat-site.mjs`, on the existing driver pattern
   (Chromium):
   - it assembles the site into a temp directory, serves it over HTTP, and
     loads `/`: the preview renders (staff lines and noteheads present),
     the editors mount, the `file://` notice is absent, and there are no
     page or console errors;
   - it loads `cnb/index.html` from the working tree over `file://`: the
     notice is visible and names the live URL.
   Record its result in `docs/uat-status.md`, and update the driver count
   in the `dabbler.yaml` comment.
6. Documentation. README "Usage" leads with the live site
   (`https://configurator.darndestdabbler.org/`, updated at each release),
   keeps the local-server instructions for development, and mentions the
   `file://` notice. Open a `CHANGELOG.md` 1.0.2 entry with the live site
   and the notice. Session 16 adds its fixture to that entry and sets
   `version.json`.

**Non-goals.** No visual redesign of the app. No build step, bundler or
new dependency. No change to how the app behaves over HTTP beyond the
removed 404. No deploy during this session, and no change to repository
settings, Pages settings or DNS: those are the operator's.

**Tests.** The cnb-unit suite (unchanged behaviour; `cnb/index.html` is in
its `covers`) and the cnb-uat suite with the new `uat-site.mjs`. The
workflow itself first runs at the 1.0.2 tag. After session 17, the operator
checks that `https://configurator.darndestdabbler.org/` loads the
configurator.

**Releasable.** No. The first deploy is the 1.0.2 release, session 17.

### Session 16: A second reference notation, 45deg-369

**Why.** Kite 4-369 reads as radical. The operator designed 45deg-369 as
the gentler alternative: the same 3-6-9 staff and 3 semitones per space,
4-semitone ellipses tilted 45°, the same three-colour cycle over a
solid/hollow alternation (period 6), and stems attached on the head's
vertical centre line at the edge of the hole, 1.65 semitones above the
centre for up stems and below it for down stems (toolkit export
`(0.0 . 1.6491)` / `(0.0 . -1.6495)`, semitone units), so a stem never
crosses the hollow. Decided 2026-11-05; the earlier centre anchor
`(0 . 0)` was dropped. The operator authors the shapes and the design by hand
(`D:\projects\chromatic-notation-musicxml-and-45deg-plan.md`, §3) and
hands over, uncommitted in `cnb/fixtures/`: `45deg.svg` (one toolkit
SVG carrying both the `notehead` and the `hollow` path, anchors as above,
no minim pair so minims use the crotchet anchors;
solid or hollow is the rules' choice per pitch class, as with Kite),
`45deg-369-config.json` and `45deg-369-from-configurator.ly`. The
operator's step-by-step guide is
`D:\Projects\chromatic-notation-45deg-walkthrough.md`; a headless
reference copy of the SVG is in `D:\Projects%deg-reference\`. This
session makes them a checked-in, test-gated fixture like Kite's. It
needs engine session 17 (anchors anywhere inside the head) on the engine's
trunk for step 3.

1. Register.
2. Commit the SVG and the JSON. Replace the one-fixture driver with
   `cnb/fixtures/export-config.mjs <config.json> [out.ly]` (the same
   `CNBLilypond.generate()` call), and keep `export-kite-4-369.mjs` as a
   wrapper that calls it, because the umbrella's pipeline names it.
   Export `45deg-369-export-baseline.ly`. In `cnb-lilypond-tests.js`,
   mirror the Kite byte-identical baseline test for 45deg-369; in
   `cnb-collection-tests.js`, add the config to the collection. In
   `cnb-svg-importer-tests.js`, prove that the fixture imports with the
   anchors the toolkit wrote into it, up `(0, 1.649)` and down
   `(0, -1.650)` in semitone units with the minim pair equal to the
   crotchet pair, and that the export writes each divided by the staff's 3
   semitones per space (`0.5497` and `-0.5498`, to the exporter's
   rounding). Read the expected numbers from the fixture's rects in the
   test rather than hard-coding them twice.
3. Round trip: `cnb/fixtures/joy-to-the-world-45deg.ly` (the Kite
   round-trip score with the include changed) engraves through the
   engine at 1.2.0 or later with exit 0 and no `error:` line, as a test
   that runs when `lilypond` is on `PATH` and skips with a reason
   otherwise. README "A worked example, checked in" lists both fixtures
   and says Kite is the golden one and 45deg-369 the reference
   alternative. If the preview cannot draw a stem from an anchor inside
   the head, say
   so under "Preview-only settings". Add the fixture to the
   `CHANGELOG.md` 1.0.2 entry session 15 opened, and set `version.json`
   to `1.0.2`.

### No release until the UI is stable

**Operator, 2026-11-06:** the live site is not deployed until the UI is
stable, because a site that changes under people will confuse them. Every
`v*` tag deploys the site (`.github/workflows/pages.yml`), so no release
session is planned until then. The release planned for 1.0.2 (sessions
15–16) and the one planned for 1.1.0 are withdrawn.

- The `CHANGELOG.md` 1.0.2 entry and `version.json` stay as they are. The
  first release after the UI work takes them over, renamed to its own
  version. That release is also the site's first deploy.
- Until then, the README and the `file://` notice point at
  `https://configurator.darndestdabbler.org/`, which returns 404. The
  first release session confirms the site is up and the link works.
- Commits to `main` do not deploy, so pushing them is safe.

### Session 17: The preview draws an imported notehead at its own height at once

**Why.** On 2026-11-05, while authoring 45deg-369 in the app, the operator
imported a 4-semitone notehead and the preview drew it at about 3 semitones
or less. It came out at its proper height only after an unrelated edit (a
notehead colour change) redrew the preview. The preview is the designer's
main feedback, so it must be right after every edit.

1. Register.
2. Reproduce it in a UAT driver: load the Kite config, import
   `cnb/fixtures/45deg.svg`, apply it in the default rule, and measure the
   drawn notehead's height before any further edit. Find which import or
   rule path leaves the preview with a stale or wrongly scaled shape.
3. Fix it at the cause, and pin it with a unit test in the test file named
   after the source file that changes, plus the UAT driver. Record the
   driver in `docs/uat-status.md`.

### Session 18: The preview shows what repeat mode engraves

**Why.** In `repeat` mode the engine engraves a minim as two heads, a
semibreve and a breve as four, spaced by `cnb:multinote-padding`. The
preview draws one head per note, so the operator cannot see repeat mode or
judge the multinote padding setting (architecture §11, open question 3).
Separately, the 45deg-369 config had key signatures enabled with no key
defined, so no signature could draw, and nothing said why.

1. Register.
2. In `repeat` mode, the card draws each duration's repeated heads as the
   engine lays them out (counts as the engine engraves them: minim ×2,
   semibreve ×4, breve ×4), spaced by `engine.multinotePadding` in staff
   spaces, with stems and ledgers following. `shape` mode is unchanged and
   byte-identical (the preview baseline pins it).
3. Check the spacing against an engine render of the Kite and 45deg-369
   fixtures, as session 11's notehead-size test does.
4. The key-signature panel and the preview's key selector say when keys are
   enabled but none is defined or selected, so nothing draws.
5. README "Preview-only settings": repeat counts are no longer preview-only
   if the counts now follow the engine; say what remains.

### Session 19: Design: a notehead-first editor

**Why.** On 2026-11-05 the operator found the configuration screen
"extremely complicated and daunting" and proposed redesigning it around the
noteheads themselves: the user defines noteheads and the Configurator
infers the rules, instead of the user writing rules. This session writes the
design for the operator's approval. It changes no code; implementation
sessions are planned once the design is approved.

1. Register.
2. Write `docs/planning/notehead-first-editor-design.md`, covering:
   - **Flow.** The staff editor stays as it is. Once the staff exists, the
     preview shows 13 placeholder noteheads (C to C′) at default positions,
     with ledger lines from the default proximity rule. The user can replace
     the proximity rule with their own ledger rules, or otherwise say when
     ledgers show.
   - **Clicking a notehead** sets its colour (an earlier colour or a new
     one), solid or hollow, shape (the imported shapes plus some defaults),
     size, pitch class, and pitch-axis nudge.
   - **Pitch and pitch axis are two independent variables** (operator,
     2026-11-06): a central tendency and a variance.
     - *Pitch* is one number: which pitch class sits at the middle of the
       staff (`staff.midpoint`), snapped to semitones.
     - *Pitch axis* is a nudge per pitch class, from −1 to +1 semitone, with
       0 meaning the notehead is centred on its own semitone. The position is
       pitch class + nudge. This replaces editing the axis map directly. It
       exports through today's pitch-axis machinery (octave stride 12,
       fractional positions, axis units per staff space = the staff's
       semitones per staff space), so the engine needs no change.
     - Nudges may make neighbours share a spot but may never reorder notes;
       the control stops there. The Twinline fixture fits in ±1 (its largest
       nudge is −1, C♯ onto C); its compactness becomes a staff-spacing
       setting. Say what happens to a config whose map needs more than ±1.
   - **Assigning a pitch class is two assignments at once** (operator,
     2026-11-06): pitch class → staff position (does middle C sit at the
     centre?), and this notehead's current look (shape, colour, hollowness,
     size) → that pitch class. Two ways to make them:
     - *Clicking a notehead and naming it* ("make this C") makes both: the
       spot becomes C, and so does the look drawn there. Every other
       notehead relabels by its vertical position relative to it.
     - *A label strip on the left of the staff* makes the first alone. The
       user drags the pitch-class labels up or down, snapping to semitones;
       each look stays with its pitch class and moves with its label.
     - The labels sit one semitone apart, so they stagger in two columns
       (even pitch classes left, odd right, or the reverse) to stay
       readable. Staggering also sets apart labels that share a spot under
       a nudge.
     - Say whether a nudge travels with its pitch class or stays with its
       spot under each of the two ways.
   - **Rule inference.** An algorithm turns the per-notehead choices into
     notehead rules: a period of 1, 2, 3, 4, 6 or 12 semitones, the
     accidentals, or else explicit pitch classes, for each of colour,
     hollowness and shape. Show the inferred rules, and say how a rule that
     no pattern fits is kept.
   - **Previews.** Each panel gets a preview, a partial staff or the full
     staff as it needs.
   - **What it retires.** Which existing panels and modules it replaces,
     hides behind an advanced view, or keeps, and what happens to configs
     whose rules the inference cannot reproduce. The config schema and the
     export stay as they are unless the document argues otherwise.
   - **It has to look good** (operator, 2026-11-06: today it "looks like
     somebody's experiment"). A screenshot review of the current app found:
     - a single 7,200 px column of 11 panels of different widths;
     - developer language on the page (the intro's "shared `config` object"
       and "change callbacks", "(Module 17)" and "(set 009)" in titles);
     - one validation warning repeated under nearly every panel;
     - repeated "Preview-only" paragraphs;
     - raw config JSON on the page;
     - a preview cut off at 1440 px with no sign of the missing columns;
     - 11 px grey labels on unstyled browser controls.
     The design sets the layout, the type, design tokens (colour, spacing,
     radius) and the wording, so the page speaks to a notation designer.
     Validation speaks once, in one place. The JSON and the advanced
     settings move out of the way.
3. Build mock-ups of the main screens: static HTML under
   `docs/planning/notehead-first-mockups/`, using the real preview modules
   where it can. Screenshot them at 1440 and 1280 px wide, judge them
   against the design, and revise them until they hold up. The operator
   approves pictures, not a description.
4. The document ends with a proposed program of implementation sessions and
   their release versions, for the operator to approve. The program's first
   release is the site's first deploy (see "No release until the UI is
   stable"), so it comes once the new UI is stable, not partway through. Every UI session in
   that program ends with screenshot checks at 1440 and 1280 px, judged
   against the approved mock-ups.

### Session 20: The colour picker stays open

**Why.** On 2026-11-05, while defining the 45deg-369 colours, the operator
found that the colour picker closed on every change: a drag in the colour
field or a typed digit in the RGB boxes shut it, so each hex digit had to be
entered on its own, reopening the picker between digits. The cause is in
the editors, not the browser: every colour `<input>` is wired to the
`input` event, which fires on each drag step and each typed digit, and its
handler calls `changed()`, which redraws the whole panel. The redraw
destroys the element that owns the open picker, and the browser closes it.
Four editors share the wiring: `cnb/ui/palette-editor.js` (custom palette
cells), `cnb/ui/notehead-rule-editor.js` (a rule's explicit colour),
`cnb/ui/key-signature-editor.js` (the separator colour) and
`cnb/ui/staff-rule-editor.js` (staff and ledger line colour).

1. Register.
2. In each of the four editors, split the colour input's wiring: on
   `input`, update the state and call `onChange` so the preview follows the
   drag live, but do not redraw; on `change`, which fires when the picker
   closes, do the full `changed()` so derived text such as the palette's
   nearest-colour names catches up. Every other control keeps its wiring.
3. Pin it in the test file named after each editor: an `input` event on a
   colour control leaves that same element in the DOM and emits `onChange`;
   a `change` event redraws. Run the four editors by hand in the browser
   (drag in the field, type a full hex value) and record the check in
   `docs/uat-status.md`.

### Session 21: Each notehead has its own height and width

**Why.** Every notehead is drawn at its shape's `semitoneHeight`, at the
shape's natural aspect ratio. A palette of very different shapes may need
different sizes to look right, and the operator asked (2026-11-06) that a
notehead's height and width each be adjustable from 0.25 to 4 semitones:
the extremes look wrong, but they let the user make whatever adjustment a
design needs. The notehead-first editor (session 19) lists size among the
things a click on a notehead sets, so the schema, preview and export built
here are what that editor will drive. No engine change is needed: the
engine has no size field and builds each stencil from the registered
path's numbers in staff-space units, so the exporter can register a scaled
variant of a shape per size.

1. Register.
2. Schema (`cnb-config.js`): a rule's `apply` block gains optional
   `heightSemis` and `widthSemis`, absolute sizes in semitones, resolved
   through the cumulative rule pipeline like `hollow` and
   `xOffsetStaffSpaces`. Absent means the shape's own `semitoneHeight` and
   its natural width, so every existing config resolves, previews and
   exports exactly as before (the preview and export baselines pin it).
   Validation: a present value must be a finite positive number (error);
   outside 0.25 to 4 semitones warns. Document the fields in the
   architecture plan §4.5 and the LY export spec.
3. Preview: `cnb-notehead.js` measures with separate x and y scale factors
   from the resolved size; the stem anchors, the octave-pair offset
   (`cnb-double-notehead.js`), the ledger width derived from notehead width
   (`cnb-ledger-set.js`, `cnb-card.js`) and the key-signature marks
   (`cnb-key-signature.js`) all follow the resolved measurement. Unit tests
   in the file named after each changed source, and a visual check in
   `cnb/test-pages/test-notehead.html`.
4. Export (`cnb-lilypond.js`): for each distinct resolved (shape, height,
   width) that differs from the shape's own size, Section A registers a
   variant under a derived name (the shape name with a size suffix), with
   its path, hollow cutout and attachment points scaled by the same x and
   y factors, and Section C points the pitch classes at it; the resolved
   size joins the Section C grouping key beside shape, hollow, colour,
   attachment and x-offset. The spec gains a section for the variant
   naming and scaling. Pin a sized export against a new baseline, and
   check the engraved sizes with an engine render through
   `cnb/tests/engine-probe.js`, as session 11's notehead-size test does.
5. Editor (`notehead-rule-editor.js`): a rule's apply block gets height
   and width controls with a "keep aspect ratio" lock, on by default: with
   the lock on, editing the height rewrites the width at the shape's
   natural ratio; with it off, the width is free. The shape's natural width
   shows as a hint beside the field. Keep the controls minimal: the
   notehead-first editor (session 19) will supersede this panel. Record
   the browser check in `docs/uat-status.md`.
6. README "Preview-only settings" and the gallery configs: say that size
   exports, and leave the fixtures' sizes untouched.
