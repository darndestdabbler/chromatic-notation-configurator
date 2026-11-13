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

### Session 20: Design revision: the canvas reflows instead of scaling

**Why.** Reviewing the session 19 design on 2026-11-06, the operator asked
that the staff canvas never scroll sideways to show the octave, and that
the noteheads not change size as the window is resized. Session 19's §6
did the opposite: it scaled `display.pxPerSemi` to fit the width. The
operator proposed a table of 13 (or 14) columns, with the staff cut into
vertical slices centred in each column, so the spacing between notes
adjusts on its own, and asked that it look better. The preview already
draws each column's noteheads, stems and ledgers in its own SVG. Only the
staff lines share one background SVG, sized to the columns' fixed total,
so the change is to the column widths and the staff background, not a new
renderer. This session revises the design and its mock-ups. It changes no
application code.

1. Register.
2. Revise `docs/planning/notehead-first-editor-design.md` (§6, §7, and
   wherever else it touches):
   - **Fixed size.** Noteheads are drawn at a fixed px per semitone,
     whatever the window width. Choose the editor's default and say why.
   - **A table of columns.** 13 equal pitch columns, each at least as wide
     as the widest column the config needs, sharing any spare width
     equally, with each column's drawing centred. The label strip and the
     clef and key-signature gutters form a fixed 14th column on the left.
   - **The staff lines.** Weigh one staff SVG per row, stretched to the
     row's width (lines drawn to 100%), against per-column staff slices,
     including the seam where two slices meet at a fractional pixel. Pick
     one and say why.
   - **One row or two.** When one row does not fit, the canvas shows two:
     C to F♯ and G to C′, each starting with its own label strip and
     gutters. Page code picks the row count from the space available. The
     rendering modules stay pure: the collection takes a `rows` option and
     reports its minimum width. Say what happens below the two-row minimum.
   - **Looks better.** Equal columns, plain pitch labels instead of boxed
     chips, full-height selection and hover marks, a quiet gutter for the
     label strip, and space between the two rows, each judged in
     screenshots.
   - Renumber the proposed program for this session's insertion (sessions
     23–30, release last). Update its session 24 equivalent (the new page)
     to build this canvas, and say which `cnb/src` modules change (at least
     `cnb-collection.js`) and how the preview baseline is kept.
3. Revise the mock-ups under `docs/planning/notehead-first-mockups/` to
   draw the canvas this way with the real preview modules. Screenshot each
   at 1440 and 1280 px, showing one row and two rows, for the default
   config and for Kite 4-369. Judge them against the design, revise until
   they hold up, and replace the screenshots in the design's §10. Remove
   the mock-up stylesheet's unused side-panel styles.

### Session 21: The colour picker stays open

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

### Session 22: Each notehead has its own height and width

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

### The notehead-first program (sessions 23–35)

**Operator, 2026-11-06:** approved the program in §12 of
[`docs/planning/notehead-first-editor-design.md`](../planning/notehead-first-editor-design.md)
(sessions 19 and 20), with one change: the canvas **Size is kept in the
browser, not saved in the file** (session 25 carries it out). The design and
its mock-ups (§10) are the specification. Every UI session (25–32 and 35) ends by
taking the app's screenshots at 1440 and 1280 px with session 25's driver
and judging them against the mock-ups: layout, type, spacing, wording, the
row count each width should give (§6.1), and no horizontal overflow. The
judgement and the screenshots go in `docs/uat-status.md`. Where a session
finds a better answer than a mock-up, it updates the mock-up in the same
session. No session before 36 releases; the first release is the site's
first deploy (see "No release until the UI is stable").

**Plan amended 2026-11-07, after session 26:** three sessions inserted for
what reviews, audits and the v1 session sets left open. Session 29 takes
the small defects, test gaps and stale documents; session 30 exports the
clef and key signature, which the engine has taken since July and the
configurator still leaves out; session 31 is design §8.5, the checks list
in a designer's terms. Sessions 27 and 28 gain the inference, pitch-model
and ledger fixes they are the first to need, and "The UI is stable" and
the release become 32 and 33. Larger deferred work is listed, unscheduled,
under "After 1.1.0". The release stays 1.1.0, a minor version: the clef
and key-signature export is a new feature, with no breaking change.

**Plan amended 2026-11-07, during session 27:** one session inserted
before the release (operator). Session 32 adds the 2–4–6–8–10 and
3–5–7–9 staff presets; "The UI is stable" and the release become 33 and
34. The release stays 1.1.0: the presets are a feature, so they belong
in the same minor version.

**Plan amended 2026-11-07, during session 29:** one session inserted
before "The UI is stable" (operator). Session 29's engine-backed stem test
found that exported stem attachments are in staff spaces where the engine
reads LilyPond's relative units, so engraved stems sit nearer the
notehead's centre than the preview draws them. Session 33 fixes the
export; "The UI is stable" and the release become 34 and 35, so the
operator's rebuilds and the README pictures follow the fix. The release
stays 1.1.0: the fix changes no config or setting.

**Plan amended 2026-11-07, after session 33:** one session inserted before
"The UI is stable" (operator: "address all gaps that we have now in a
session"). Session 34 closes every gap between the preview and the
engraving that this repository can close; "The UI is stable" and the
release become 35 and 36. The operator's rule for each gap: a setting the
engine cannot take leaves the editors and the preview draws what the engine
engraves, while ledger rules and key-scoped notehead rules, which the
engine can take, are exported. The three gaps only the engine can close
(text-clef height, the clef's left padding, the key-signature octave under
a pitch axis) are planned as session 24 of the engine repository. The
release stays 1.1.0: no config stops loading.

**Plan amended 2026-11-08, during session 35:** four sessions inserted
before "The UI is stable", and a 1.2.0 program after the release
(operator). The operator's rebuilds of Kite 4-369 and 45deg-369 found rough
edges they chose to plan rather than fix in session 35
(`docs/uat-status.md`, session 35): sessions 36–39 take them, "The UI is
stable" moves to 40 and the release to 41. The release stays 1.1.0: no
config stops loading, and session 37 reads the palettes of older configs
into their noteheads. Three larger ideas from the same review (a
key-signature designer, published component schemas with partial-config
import, and clefs to pick from) are planned as sessions 42 on, toward
1.2.0, a minor version, since each adds a feature and none breaks a
config.

**Plan amended 2026-11-09, during session 38:** two sessions inserted
before undo (operator). The operator's rebuild of Kite 4-369 in session 38
(`docs/uat-status.md`, session 38) asked for the workflow in the order a
notation is designed, starting from the notehead's height (session 39),
and for stems placed where the notehead's SVG puts them (session 40), the
choice session 33 left to the operator. Undo moves to 41, "The UI is
stable" to 42 and the release to 43, and the 1.2.0 sessions to 44 on. The
release stays 1.1.0.

### Session 23: The look table and rule inference

**Why.** The notehead-first editor edits one table, a look per pitch class,
and writes the rules from it (design §0, §5). This session builds that
model with no UI, so the panels in sessions 27 and 28 sit on tested logic.

1. Register.
2. `cnb/ui/notehead-inference.js`, pure functions: the look table from a
   config (shape, fill, colour, size, side step per pitch class, as
   `resolveNotehead` and the palette give them); the inference of §5.1
   (default value, smallest period in 1, 2, 3, 4, 6, then the accidentals,
   else explicit pitch classes), with rule names in words; and the write
   back: inferred rules for shape, fill, size and side step, colour to the
   palette (§5.3), rules restricted to durations or keys kept verbatim
   above them (§5.5).
3. Tests in `cnb/tests/cnb-notehead-inference-tests.js`: for every gallery
   and fixture config, writing back its own look table resolves to the
   same looks for every pitch class, duration and key; the Kite 4-369,
   45deg-369 and default exports stay byte-identical; the §5.2 worked
   examples infer the rules the design shows.

### Session 24: Pitch, nudges and staff spacing

**Why.** Pitch (the middle of the staff) and the per-pitch-class nudge are
the editor's two pitch variables (design §3, §4). This session builds their
arithmetic with no UI.

1. Register.
2. `cnb/ui/pitch-model.js`, pure functions: moving the pitch by *d*
   semitones, rewriting the midpoint, staff pattern, ledger templates and
   line overrides together (§3.1); nudges to and from `pitchAxis`
   (stride 12, fractional positions, `axisUnitsPerStaffSpace` = the staff
   spacing; the section removed when every nudge is 0) with each nudge's
   limits (§3.2); converting a stride-7 map to nudges, and the ±1 test
   that keeps a map that cannot convert (§3.3, §3.5); renaming a notehead,
   which rotates the look table and the nudges (§4.1, §4.3).
3. The staff spacing accepts a decimal (§3.4). An engine render of
   Twinline in nudge form (staff spacing 3.43) confirms it engraves at the
   positions of the stride-7 fixture, through `cnb/tests/engine-probe.js`
   or the round-trip recipe, skipping with a reason when `lilypond` is not
   on `PATH`.
4. Tests in `cnb/tests/cnb-pitch-model-tests.js`, including Twinline's
   nudges from the §3.3 table and the no-reordering limits.

### Session 25: The new page

**Why.** Replace the 7,200 px column of eleven panels with the one-screen
layout of design §7, the look of §8 and the reflowing canvas of §6.1.

1. Register.
2. **Size stays in the browser** (operator, 2026-11-06). The canvas draws
   at the toolbar's Size (Small 9, Medium 11, Large 16 px per semitone;
   Medium the first time), remembered per browser, not in the file. The
   canvas ignores the saved `display.pxPerSemi`, which keeps its meaning
   for the test pages and the gallery. Choose the browser storage in the
   session and say why. Update the design §6.1, §10 and §11, which
   describe the saved-field version.
3. The reflowing canvas in `cnb/src`: `cnb-collection.js` gains the
   `fluid` and `rows` options and `minRowWidth`; `cnb-staff.js` draws the
   lines to `100%` in fluid mode; `cnb-card.js` marks each column with
   `data-pc` and centres its drawing in a wider column. With both options
   off, today's layout is unchanged and the preview baseline
   (`cnb/fixtures/preview-baseline.json`) pins it. New tests in each
   changed module's test file pin the fluid layout. In `cnb/ui`,
   `preview-display.js` gains the Size control and picks one row or two
   with a `ResizeObserver`, redrawing only when the count changes.
4. The shell: top bar (name, checks indicator, Open, Save, Export for
   LilyPond), section list, canvas, one panel at a time; the design tokens
   and type (§8.1–8.3) in one stylesheet; the checks indicator as the only
   place validation shows (§8.5); Advanced with View file (JSON). The
   existing editors are mounted in their sections or in Advanced (§9).
5. The UAT drivers follow the moved panels. A new driver screenshots the
   app at 1440 and 1280 px for the screenshot checks.

### Session 26: The panels speak to a designer

**Why.** The kept panels still use developer wording and unstyled
controls (design §8.4, §8.6, §8.8).

1. Register.
2. Restyle and reword Staff, Ledger lines (with Automatic or My own rules,
   §1), Clef, Key signature and Export, each with its preview (§6). Module
   and set numbers leave the titles. Preview-only badges replace the
   repeated paragraphs, and the Export section names the preview-only
   settings once.
3. Tests and UAT drivers follow the wording.

### Session 27: The notehead panel

**Why.** The heart of the design: click a notehead to give it a look, and
the rules follow (design §2, §5.4).

1. Register.
2. Click and Shift-click selection on the canvas; the notehead panel
   docked under it: colour (with session 21's `input`/`change` wiring and
   Start from a palette), fill, shape (the config's shapes, the built-in
   shapes, Import from SVG), size (session 22's fields), side step, and
   Give this look to. Every change goes through session 23's inference.
3. Two inference fixes the session 23 review left open, which the panel is
   the first to need: a notehead whose colour is taken back to none (black)
   writes the palette without it, which `writeBack` cannot do yet; and a
   rule kept for particular durations or keys is raised in priority only
   when it does not already sit above every inferred rule, as design §5.5
   says, not with all the kept rules in bulk.
4. The rule list under the canvas, in words, with hover tint (§5.4).
5. Tests in the new modules' test files; a UAT driver that builds the Kite
   looks by clicking and checks the export matches the fixture.

### Session 28: Pitch

**Why.** The label strip, renaming and nudges (design §3, §4).

1. Register.
2. The label strip in each row's 14th column, quiet everywhere and
   draggable in the Pitch section; renaming a notehead from its panel; the
   Pitch section (middle of the staff, staff spacing, nudges with their
   limits), all through session 24's model; the custom-map fallback in
   Advanced (§3.5).
3. Two pitch-model questions sessions 24 and 25 left to this session:
   - `readNudges` measures a stride-12 map's nudges from 0, not from C's
     position, as the design's formula does, so a map whose every position
     is shifted by the same amount reads as twelve equal nudges instead of
     none (session 24 review). Use C's position, with the test the review
     gives (`writeNudges` with every nudge 0.5, read back as zeros).
   - The staff's edges under a pitch shift (design §11): the exporter and
     the preview expand the pattern over semitones 0–23, so a shift that
     carries a line past one edge brings it back at the other. Decide
     whether the drawn and exported range follows the middle of the staff,
     record the decision in the design, and pin it with a test that renames
     C to F♯ on the default staff.
   - Ledger lines under nudges: session 26's Automatic ledger spots follow
     the semitone pattern, not the nudged positions, and the Twinline-like
     preset keeps the 4-8 templates (the one caveat the operator was told
     of at the session 4 UAT, `docs/sessions/uat-session-4.md`). Automatic
     spots follow the staff spacing as the nudges place the lines.
4. Tests and a UAT driver that rebuilds Twinline from nudges.

### Session 29: Loose ends from sessions 2–26 and the v1 sets

**Why.** Reviews and audits from session 2 on, and the records of the v1
session sets 001–014 (`docs/session-sets/`), left small defects, test gaps
and stale documents that no session took up. None blocks a designer today,
but each is a wrong answer or an unchecked claim, and the release should
not carry them. The larger items those records defer are under "After
1.1.0" at the end of this plan.

1. Register.
2. Numbers that overflow (session 10 review): `CNBScheme.parseRatio` and
   `parsePath` accept a decimal of hundreds of digits, which becomes
   `Infinity`, so validation passes a config that export then refuses, and
   the SVG importer can throw instead of returning its import error. Reject
   non-finite numbers where they are parsed. Tests in
   `cnb/tests/cnb-scheme-tests.js`, `cnb-config-tests.js` and
   `cnb-svg-importer-tests.js`: a 400-digit `engine.defaultMagnify` fails
   validation by name, and a 400-digit path number is an import error.
3. Rotated stem rects (session 11 review): `transformRect` reduces a
   transformed rect to its bounding box before the anchors are read, so a
   rotated stem rect anchors at the wrong point (`rotate(90)` on
   `{0, 0, 10, 20}`: the bottom centre is `(-20, 5)`, the box gives
   `(-10, 10)`). Read the anchor from the transformed corners. Test in
   `cnb-svg-importer-tests.js`.
4. Two engine-backed tests that skip with the reason when `lilypond` is not
   on `PATH`:
   - **Durations** (audit 2026-11-02, H4). The engine fixed its duration
     categories in its 1.1.1, but this repository has no test that a
     duration rule engraves on the right notes. With the Kite fixture plus
     "C minims are hollow", `c'4 c'2` engraves the quarter solid and the
     half hollow. In `cnb-lilypond-tests.js`, through
     `cnb/tests/engine-probe.js`.
   - **Repeat-mode stems** (session 18 review). In repeat mode, with a stem
     anchor off the notehead's centre, the engraved stem's x matches the
     preview's, measured from the render rather than from
     `CNBCard.repeatLayout`. In `cnb-card-tests.js`.
5. Small wording and behaviour fixes:
   - Advanced › Durations: the repeat counts' inactive label says "Used
     only in repeat mode" although nothing uses them (session 18 review);
     say they are kept but not used.
   - Automatic ledger lines are recognised on load only when each loaded
     template matches exactly, with `triggerPCs` present and no other
     fields (session 26 review).
   - With every duration deselected, the Clef and Key signature panels show
     no partial staff, as the canvas shows none, rather than a crotchet one
     (session 26 review).
   - Design §10: correct the 880 px measurement to the seven-track second
     row the code draws (session 20 review).
   - `docs/uat-status.md`: the "first run with no repairs" sentence no
     longer matches the history (session 21 review).
6. The Google Fonts request (session 15 review): the page fetches Oswald
   from Google at run time, though the site was described as fetching
   nothing, and the UAT drivers stub the request so it is never checked.
   Serve Oswald from the site (`cnb/assets/fonts/`, under its SIL Open Font
   Licence, with the licence file beside it), drop the Google links, and
   have `uat-site.mjs` fail on any request outside the site's own origin.
   The UAT screenshots then draw the labels in Oswald, as the mock-ups do.
7. Off-key marks: a rule's `apply.offKeyMark` can be edited, but the
   preview draws no mark and the export writes `(off-key-mark . #f)`, with
   no word to the designer (architecture §11 question 4; set 005 s2 UAT).
   Until off-key marking is built (see "After 1.1.0"), validation warns and
   names each rule that sets one, the control carries a Preview only badge
   saying it is not drawn or exported yet, and the Export sentence names
   it.
8. The UAT setup (sessions 5 and 6 reviews):
   - `CLAUDE.md` says Node.js 18+, but `playwright-core` 1.64 needs 20:
     say 20+ for the browser UAT.
   - README installs browsers with `npx playwright install`, which can
     fetch an unpinned `playwright`; use the locked `playwright-core`'s
     own installer.
   - README's browser table says "Chromium / Chrome 156"; the drivers run
     Playwright's Chromium, not Google Chrome.
   - `uat-hostile-input.mjs` pins Firefox's "no console errors" for
     malformed XML that still contains an `<svg` token.
9. Stale documents (session 7 review; set 012; engine handoff 008 §5;
   architecture plan §11):
   - `docs/planning/project-plan.md` "Current state" still says two
     codebases coexist and the exporter and UI do not exist.
   - `docs/planning/pitch-axis-design.md` §3.4 and §5.2 risk 1 still give
     the superseded "diatonic-`staff-position`-derived" chord diagnosis;
     the export spec §6.3 has the correction.
   - Two engine behaviours under a pitch axis (handoff 008 §5, flags 1
     and 2) are documented nowhere here: collision analysis rounds axis
     positions to whole numbers, and LilyPond drops the down-stem head's
     dots for dotted notes in two voices at one axis position. Add them to
     the export spec and README "Known limitations".
   - `docs/playbook/notation-builder-playbook.md` still treats I2 as a hard
     limit and counts nine Tier-4 I2 records; the pitch axis lifted it
     (feasibility matrix §9).
   - Architecture plan §11: questions 1, 2, 6 and 7 and the clef half of
     5 are settled in the code and read as open. Mark each with how it was
     settled; question 8 (stem attachment) stays open.

### Session 30: The clef and the key signature reach LilyPond

**Why.** The engine has taken a clef and key-signature configuration since
its sets 005 and 006 (July 2026), and their handoffs list this repository's
side as owed (engine `docs/planning/configurator-coordination-backlog.md`
§1–§2): the exporter still writes nothing for either. So the preview and
the engraving disagree. Every export, even one with the clef off, engraves
the engine's default dozenal clef, which the preview does not draw, and a
config that turns its key signature off still engraves one.

1. Register.
2. Read the two handoffs first:
   `docs/session-sets/005-clef-configurability/configurator-handoff.md` §5
   and `006-keysig-configurability/configurator-handoff.md` §3 in the
   engine repo. Their flags set the conversions: the clef anchor's
   middle-C = 0 origin, the gutter from px to semitones, the clef path's
   command-list format, the text label's colour and font, the
   `thicknessPct` conversion (`thicknessPct / (10 × semitones per staff
   space)`), the tonic octave's numbering on a linear staff (the handoff's
   −1, which the session-3 round trip found does not apply under a pitch
   axis), and a separator that is off with no engine switch for it.
3. Export, emit-if-changed like the other engine settings:
   - **Clef:** `cnb:clef-style` (`'none` when the clef is off, `'custom`
     with the glyph registered by `cnb:register-clef!` and named by
     `cnb:clef-name`, `'text` with `cnb:clef-text`), and the size and
     gutter settings.
   - **Key signature:** `cnb:keysig-style` (`'none` when it is off), the
     bar's colour, thickness and extent, and `cnb:keysig-tonic-octave` on
     linear staves too.
   Decide, and record in the spec, whether the default config, whose clef
   is off, exports `'none` (the preview's answer) or leaves the engine's
   dozenal clef; either way the default export baseline changes only on
   purpose, and the change is named in `CHANGELOG.md`.
4. Lift the tests that pin "no clef token" and "no keysig token", add the
   addendum to `docs/CNB-LY-EXPORT-SPEC-v1_3.md` (1.3.5), and update the
   architecture plan §4.9 and §4.12, which say nothing is emitted.
5. Engine round trips, skipping with the reason without `lilypond`: a clef
   glyph, a text clef and a key signature with a styled bar engrave where
   the preview draws them, measured through `cnb/tests/engine-probe.js`;
   one of them on a pitch axis with a fractional clef anchor (handoff 008
   §5, flag 5).
6. The Clef and Key signature panels lose the Preview only badges that no
   longer apply, and the Export section's sentence and README "Preview-only
   settings" follow.
7. Screenshots that show the two previews at work (operator, 2026-11-07:
   session 26's panel shots used Kite, which has neither, so its Clef and
   Key signature previews drew three bare columns). `uat-app-layout.mjs`
   saves the Clef panel with a clef glyph on and the Key signature panel
   with keys and a signature on, for a key chosen on the canvas, and checks
   that each partial staff draws its gutter. Judge them and record them in
   `docs/uat-status.md`. The design's §10 has no mock-up for these
   sections; these shots stand in for one.

### Session 31: The checks speak to a designer

**Why.** Design §8.5: each item in the checks list says the problem in a
designer's terms and links to the control that fixes it. Session 25 built
the indicator and the list with today's messages, and session 25's record
gave the rewording to session 26, whose section did not include it. It
comes after sessions 27 and 28 because its links open the notehead panel,
the Pitch section and the other controls those sessions build.

1. Register.
2. A pure function in `cnb/ui/`, tested in its own test file, maps each
   validation and export message to designer wording and a target: the
   noteheads to select, or the section (and control) to open. The messages
   themselves stay as they are in `CNBConfig.validate` and
   `CNBConfigExport.validateForExport`, so their tests and the
   export-blocking rules do not change. A message the map does not know
   shows as today, with no link.
3. The checks list shows the designer wording and a link (**Show the
   rule**, **Select the notehead**, **Open Staff**) that does what it says;
   the Export button's tooltip uses the same wording. Mock-up 4 is the
   reference.
4. Tests, and the layout driver opens the list for a config with a warning
   and follows its link.

### Session 32: Two more staves to start from

**Why.** The Staff panel offers 4–8 and 3–6–9. With 2–4–6–8–10 and
3–5–7–9 added (operator, 2026-11-07), the presets cover the evenly
spaced staves centred on F♯, whose gap is centred on C, at spacings of
4, 3 and 2 semitones. 2–4–6–8–10 belongs with 4–8 and 3–6–9: its gap is
one missing line, on C (the gallery's Richter entries,
`docs/research/gallery-survey/catalog.md`). 3–5–7–9 is the other case,
where C falls in a space: its Automatic ledgers are B and C♯.

1. Register.
2. `STAFF_PATTERN_PRESETS` (`cnb/ui/staff-rule-editor.js`) gains
   "2-4-6-8-10" ("Five lines an octave, on D, E, F♯, G♯ and A♯") and
   "3-5-7-9" ("Four lines an octave, on D♯, F, G and A"), after the two
   there now. The `patternKey` type and the comments that name the
   presets (the preset table, `automaticTemplates`) follow. The midpoint
   stays 12 and the spacing derives as 2, so no geometry code changes;
   tests pin both.
3. Tests:
   - in `cnb-staff-rule-editor-tests.js`: each new pattern opens as its
     preset and saves back unchanged; `automaticTemplates` gives `[0]`
     for 2–4–6–8–10 and `[1, 11]` for 3–5–7–9;
   - in `cnb-ledger-set-tests.js`: what 3–5–7–9's Automatic ledgers draw
     around C. Octave-aware resolution (region `floor(semi / 12)`) gives
     C at 12 the C♯ ledger at 13 only, and B at 11 its own ledger, so C
     shows one ledger above and none below. Pin that, and show it to the
     operator at the UAT; if it is judged wrong, the fix is planned, not
     made here;
   - in `cnb-lilypond-tests.js`: the staff-line positions,
     `'(-10 -8 -6 -4 -2 2 4 6 8 10)` for 2–4–6–8–10 and
     `'(-9 -7 -5 -3 3 5 7 9)` for 3–5–7–9. The second puts lines on odd
     staff positions, which no fixture does yet, so engrave it once
     through `cnb/tests/engine-probe.js`, skipping with the reason
     without `lilypond`, and check that the lines fall where the preview
     draws them.
4. `uat-app-layout.mjs` saves the Staff panel and canvas with each new
   preset chosen. Judge the shots against the mock-ups and record them in
   `docs/uat-status.md`.

### Session 33: Stems engrave where the preview draws them

**Why.** Session 29's engine-backed stem test found that the exporter and
the engine disagree on the units of a stem attachment. The exporter writes
`cnb:register-attachment!` points in staff spaces (LY spec §4.4, §4.4a),
but the engine passes them unchanged to LilyPond's
`NoteHead.stem-attachment` (`cnb/stems.ly`), which reads each as a
fraction of the notehead's half-width and half-height, −1 to 1 (the
engine's own default, `'(1 . 0)`, is the right edge). So every exported
shape with stems engraves them nearer the centre than the preview draws
them: the default crotchet's up stem sits 0.105 staff spaces right of the
note's centre on the page and 0.393 in the preview, its repeat-mode minim
0.176 against 0.558. The Kite fixture is right only because its
`lilypondAnchors` were hand-set to the golden file's relative numbers.
Every 1.0.0 export with stems is affected, so this goes before the
release.

1. Register.
2. The exporter (`cnb/src/cnb-lilypond.js`) writes each attachment in
   LilyPond's relative units: x ÷ half the registered path's width, y ÷
   half its height, measured from the path it registers, so a sized
   variant (§4.1c) keeps the same relative point. The pitch-axis
   substitution (§4.4a) no longer enters, since the unit cancels.
   `lilypondAnchors` stay semitone units in the config.
3. The Kite fixture's `lilypondAnchors` become true semitone anchors that
   export to the golden file's `(0 . 0.9)` / `(-0.365 . 0.9)`; check the
   45deg-369 fixture and the gallery files the same way. Regenerate the
   default, Kite 4-369, 45deg-369, sized and Twinline baselines, and
   record the change as LY spec 1.3.7, with a note that 1.0.0 exports
   with stems should be regenerated.
4. Remove the skip from session 29's test in `cnb/tests/cnb-card-tests.js`
   ("repeat mode (engine): the engraved stem x matches the preview's"):
   minims and crotchets, stem up and down, within half the engraved stem
   width, since LilyPond puts the stem's edge, not its centre, at the
   attachment point. If that half width proves visible, decide with the
   operator whether the preview or the export moves.

### Session 34: The preview draws what the engine engraves

**Why.** Session 33 found the preview and the engraving differ wherever the
preview has a setting the engine never receives, and the operator's rule is
that a difference a user could notice, or that would make them doubt the
export, is fixed rather than documented. Measured on 2026-11-07 against the
engine, default config, in staff spaces: stems are 0.13 thick and reach
about 3.5 past the far head's centre on the page, but 0.065 and 1.70 in the
preview; staff lines are 0.10 on the page and 0.05 in the preview. Staff and
ledger line thickness, colour and dash, ledger width and rounded ends, the
ledger rules, key-scoped notehead rules, the repeat counts and the
key-signature gutter all change the preview and nothing on the page
(LY spec §5.2a). The operator chose, per gap (2026-11-07):

- where the engine has its own fixed value and no setting in its simple
  mode, **the preview draws the engine's value** and the setting leaves the
  editors. The engine's advanced line mode (`cnb:staff-and-ledger-lines`) is
  not used;
- **ledger rules are exported**: the engine's simple mode takes, for each
  notehead position, the exact ledgers to draw (`cnb:ledger-overrides`,
  `cnb/ledgers.ly`), so the ledger editor keeps working;
- the three gaps only the engine can close go to the engine repository's
  plan, as its session 24.

1. Register.
2. **Stems.** The preview draws a stem at the engine's thickness and length,
   in staff spaces (axis units per staff space under a pitch axis): LilyPond's
   0.13 thickness and its length past the far notehead, including the cases
   where LilyPond shortens a stem or carries it to the middle line, as
   measured against the engine. `display.stemThicknessPct` and
   `display.stemExtension` stop being read. An engine-backed test in
   `cnb/tests/cnb-card-tests.js` pins stem thickness and both ends, crotchet
   and minim, up and down, for the default and Kite fixtures.
3. **Staff and ledger lines.** The preview draws staff lines and ledgers at
   the engine's thickness and length, black and solid, measured from a
   render. The line settings the engine does not take (staff and ledger
   thickness, colour, dash, line overrides, ledger width multiplier and
   rounded ends) leave the staff editor and stop being read; configs that
   carry them still load. An engine-backed test pins the measured sizes.
4. **Which ledgers appear.** The export writes, for every notehead position
   in the engine's range, the ledgers the preview draws for a note there,
   as `cnb:ledger-overrides` (and `cnb:ledger-positions` if the overrides
   need them), linear and pitch-axis alike, so the engraving shows the
   preview's ledgers, in-gap ledgers included. An engine round trip
   compares the engraved ledger positions with the preview's for the
   default, Kite 4-369, 45deg-369 and Twinline fixtures and every gallery
   file. This retires the "in-gap ledger difference" listed under "Limits
   kept on purpose".
5. **Key-scoped notehead rules.** Section C dispatches on the key the engine
   passes (the key's pitch-class list), so a rule whose `match.keys` names
   a key definition engraves as the preview draws it. Validation stops
   warning that such rules are preview-only. An engine round trip checks one
   key-scoped colour rule in two keys.
6. **The rest.** The key-signature gutter follows the engine's spacing and
   its setting leaves the editor; the repeat counts leave the editor (the
   engine's counts are fixed, session 18). The baselines (export and
   preview) are regenerated and every change is listed.
7. LY spec 1.3.9 records the ledger and key exports and §5.2a's shorter
   preview-only list; the architecture plan's display, staff and ledger
   sections say what the preview now draws. The README's "Preview-only
   settings" list shrinks to what remains (the colour-blind palette toggle,
   which the score selects).

### Session 35: The UI is stable

**Why.** The release waits for a stable UI (operator, 2026-11-06).

1. Register.
2. The operator rebuilds Kite 4-369 and 45deg-369 from scratch in the new
   UI, and while doing so checks the colour pickers by hand (drag in the
   field, type a full hex value) in each editor that has one, the check
   session 21 left owed. The rough edges found are fixed in this session,
   or planned as sessions before 36 if they are large.
3. README text and pictures follow the new UI. Its "Preview-only settings"
   list matches the Export section's sentence as session 34 leaves it, and
   it no longer introduces the unused repeat counts as settings that change
   the preview (session 18 review). The full UAT runs.
4. The operator declares the UI stable, which is the condition for
   session 36. *(Amended during session 35: the rough edges went to
   sessions 36–39, so the declaration moves to session 40.)*

### Session 36: Rough edges from the rebuilds

**Why.** The operator's rebuilds in session 35 (`docs/uat-status.md`).

1. Register.
2. **Save where the designer chooses.** Save and Export .ly open the
   browser's save dialog where it has one (Chrome and Edge), suggesting the
   name they use today; a browser without one (Firefox) keeps the
   download.
3. **Repeat mode where the durations are.** The choice between distinct
   shapes per duration and repeated heads sits beside the duration buttons
   on the staff, in a designer's words, and leaves Advanced → Durations and
   engine.
4. **Colour fields apply once.** While a designer drags in a colour field,
   only the swatch and the notehead change; the colour is applied when the
   drag ends. Only the colours a config uses keep a name in
   `palette.schemeSymbols`.
5. **An unused shape does not warn.** Validation's warnings about a shape's
   paths name only shapes some notehead uses.
6. **The signature on the staff.** The canvas has a key and mode picker and
   draws the chosen key's signature. One button turns on the default
   signature, the scale stack (the stacked notehead chords the engine
   draws). Its messages are in a designer's words: with keys on and none
   defined it says so without naming `config.keys.definitions`.

### Session 37: Colours chosen directly

**Why.** Palettes are more than a designer needs (operator, 2026-11-08):
many systems stay black, and a colour-blind variant is simply a second
config.

1. Register.
2. A notehead's colour is chosen on the notehead (or its rule) and carried
   there; the config has no palette to fill. Palettes become suggestions a
   designer can apply from help, colour-blind-safe sets among them.
3. The colour-blind alternative and the export's accessible-colour branch
   go: a variant is a config saved under another name (session 36's save
   dialog). The exporter registers the colours the noteheads use. No engine
   change: `cnb:use-accessible-colors` is simply never set.
4. A config with a palette still loads, its colours moved onto the
   noteheads, so it previews and exports as before. The baselines and the
   LY spec say what changed.

### Session 38: Selecting several noteheads, found at once

**Why.** The operator gave each notehead its look in turn, not knowing the
canvas already selects several with Shift+click and the notehead panel's
"Give this look to" copies a look to many (session 35,
`docs/uat-status.md`).

1. Register.
2. The canvas and the Noteheads section say how to select several
   noteheads; Ctrl+click selects as Shift+click does, and a selection can
   be cleared in one move. "Give this look to" says what it does before it
   is used.
3. The operator tries it on a fresh rebuild of Kite 4-369 and judges
   whether it is now found without being told.

### Session 39: The workflow in the order a notation is designed

**Why.** In the session-38 rebuild the operator judged a notehead's height
against the staff before they had set either, and asked for the sections in
the order a designer settles them, each step resting on the last (operator,
2026-11-09).

1. Register.
2. The page starts, as now, from a conventional notehead on the 4-8 staff.
   The first step sets the general notehead height, for every notehead, on
   that staff, and the notehead drawn is that height.
3. The sections follow in this order: notehead height, Staff, Ledger lines,
   Noteheads (the shape, colour, fill and size of selected noteheads), Key
   signature, Clef. Pitch stays beside Staff, and Advanced and Export stay
   last.

### Session 40: Stems where the notehead's SVG puts them

**Why.** Since session 33 a stem's edge sits on its anchor, as LilyPond's
does, so a stem drawn centred in the notehead's SVG (Kite 4-369, 45deg-369)
previews and engraves half a stem off centre. Session 33 left this to the
operator, who chose: a stem goes where the SVG's stem rect puts it, and the
default notehead's stems take the conventional positions, up on the right
and down on the left (operator, 2026-11-09).

1. Register.
2. A stem rect in an imported SVG places the stem itself, in the preview
   and in the engraving: the Kite and 45deg stems are centred.
3. The default notehead's up stem is on its right and its down stem on its
   left, in the preview and the engraving. The operator may supply the
   positions.
4. The fixtures and export baselines follow, with an engine round trip,
   and the LY spec records the change.

### Session 41: Undo and redo

**Why.** A wrong change can only be put right by hand (operator,
2026-11-08).

1. Register.
2. Undo and redo of every change to the config, several levels, with
   buttons and Ctrl+Z / Ctrl+Shift+Z. A colour drag or a typed value is one
   step. Opening a config is a step too.

### Session 42: The UI is stable

**Why.** The release waits for a stable UI (operator, 2026-11-06).

1. Register.
2. The operator tries sessions 36–41 in the app. Rough edges found are
   fixed here, or planned as sessions before 43 if they are large.
3. The README's text and picture follow the UI as it now is. The full UAT
   runs.
4. The operator declares the UI stable, which is the condition for
   session 43. *(Amended during session 42: the operator's try-out found
   four large rough edges (`docs/uat-status.md`, session 42) and asked
   that all of them come before the 1.1.0 release. They are sessions
   43–46 and on, and the declaration moves to the session before the
   release, which is numbered once session 46 has said how many sessions
   the key-signature designer takes.)*

### Session 43: Nudges you can see and drag

**Why.** The operator's try-out in session 42 (`docs/uat-status.md`): the
notehead in the middle of the staff cannot be nudged, and the sliders crowd
the number fields so that each sits nearer the next pitch class than its
own.

1. Register.
2. Any notehead can be nudged, the one in the middle of the staff
   included; nudges are no longer measured from a fixed C.
3. The sliders go. A notehead is nudged by dragging it up and down on the
   canvas, and by its number field. Each pitch class's field is framed (a
   light grey border or background) so it is clear which notehead it
   belongs to.

### Session 44: The breve as tied semibreves

**Why.** In repeat mode the semibreve and the breve both show 4 heads, the
engine's fixed counts (session 18). Doubling to 8 for the breve strings too
many heads together; the operator prefers a breve written as tied
semibreves (session 42).

1. Register.
2. With the engine's repository: in repeat mode a breve engraves as two
   semibreves tied, and the preview draws it so. Longer values, if any, as
   more tied semibreves.
3. The engine's golden files, the export baselines and the LY spec follow,
   with an engine round trip.

*(Amended during session 44, 2026-11-10: the operator chose to keep the
breve as one note whose repeat-mode stencil is two semibreve groups with a
tie between them, and to have the engine work done as engine session 25,
"The breve as tied semibreves", in the engine repository's plan. That
session makes the engine change and regenerates its goldens. This
session's round trip waits for it to land.)*

### Session 45: Clefs

**Why.** The engine's dozenal clef is not drawn in the preview, and the
standard clefs take an import to use (operator, 2026-11-08). In the
session-42 try-out the operator found the clef not yet working: an imported
clef symbol should be resizable and placed vertically, and shown over a
range of semitones.

1. Register.
2. The preview draws the dozenal clef, and buttons choose it or a standard
   clef (treble, bass, alto), each placed at the pitch it marks, from
   glyphs whose licence allows it (Bravura, SIL OFL, for example).
3. An imported clef symbol is resized and moved up and down on the canvas
   or by its fields, and a clef says over which semitones it is shown,
   in the preview and the engraving (engine work, if the engine has no
   such setting).

### Session 46: The breve's tie below the noteheads

**Why.** In the session-45 try-out the operator found the breve's tie wrong
(2026-11-11): it should be below the noteheads, not in the gap between the
two groups on the heads' centre line. Ideally one tie spans from the centre
of the first notehead of the first group to the centre of the last notehead
of the last group.

1. Register.
2. With the engine's repository (engine 1.3.0 draws the tie, so this is an
   engine session and an engine patch release, 1.3.1): in repeat mode a
   breve's tie is one tie under each notehead, its ends at the centres of
   the first head of the first group and the last head of the last group,
   below the heads, curving down as LilyPond's ties under a note do. The
   two groups and the gap between them stay as they are. The preview draws
   it so (`CNBCard.tiedGroups`, `CNBCard.tiePath`), the tie still black,
   and the ledgers and column still the breve's whole width.
3. The engine's golden files, the LY spec (§4.1d) and the engine round
   trip in `cnb/tests/cnb-card-tests.js` follow, the round trip measuring
   the tie's ends and lowest point against the preview.

*(Amended during session 46, 2026-11-11: the engine work is engine
session 28, "The breve's tie below the noteheads", in the engine
repository's plan, followed by its session 29, the 1.3.1 release. The
tie's ends sit at the bottom of the heads (the group's lower edge), where
LilyPond's own ties under a note start. This session's round trip waits
for engine session 28 to land.)*

### Session 47: Designing the key-signature designer

**Why.** A signature should be as easy to design as the noteheads, and
reach Clairnote's, traditional ones and the scale stack alike (operator,
2026-11-08), without a designer defining every key in every mode
(operator, session 42).

1. Register.
2. A design document only, no code, from the operator's outline in
   `docs/uat-status.md` (session 42): two kinds of signature, **traditional
   accidentals** or **scale notes**. Scale notes have the shape, colour and
   size of their noteheads for naturals, flats and sharps across all
   pitches; the upper tonic shown or hidden; the option of only the tonic
   and the notes a half step apart; the stacking (two stacks of odd and
   even notes, optionally with the gold stem, or a new stack to the right
   at each half step, optionally alternating fill, colour or shape, enough
   for Clairnote's); and how the signature repeats across the staff's line
   groups (once, placed on the bottom group, the top group or near the
   notes; or repeated across every visible group, the root as a double
   notehead). It names the engine work (the mark-list hook of the engine
   backlog §2.3).
3. The design goes to a cross-provider consult (GPT and Gemini) before the
   operator approves it, and it plans the sessions that build it.

*(Done in session 47: the design is
[`docs/planning/key-signature-designer-design.md`](../planning/key-signature-designer-design.md),
approved by the operator on 2026-11-11 after two consult rounds (GPT and
Gemini, then Sol and Argon at the operator's request,
[`key-signature-designer-consult.md`](../planning/key-signature-designer-consult.md))
and a review of mock-ups
([`key-signature-mockups/`](../planning/key-signature-mockups/index.html)).
It plans sessions 48–51 below; the UI-stable session is 52 and the 1.1.0
release 53.)*

### Session 48: Scale notes on the canvas, and the engine's hook planned

**Why.** The approved key-signature design (session 47), first its scale
notes: the operator's outline, their four stacking rules and placement on
the staff's line sets. Its engine contract is settled here, before
anything is built on it (both consult rounds).

1. Register.
2. First, a LilyPond probe (`cnb/tests/engine-probe.js`) confirms that the
   engine can read the tonic's spelling and the key's pitch classes from
   real `\key` events, for a sharp key, a flat key and an enharmonic pair.
   If it cannot, the session stops and the design is revisited.
3. The `keys.keySignature` fields of design §6, each defaulting to today's
   signature, with validation, and the architecture plan's §4.9.
4. `CNBKeySignature.marks` (design §8) for every scale-note choice of
   design §4: the looks of all marks, flats, sharps and every second stack;
   the upper tonic; the whole scale or the tonic and the half steps; the
   four stacking rules; the direction; the gold stems, with their colour,
   thickness and shared thickness; and the middle, bottom, top and every
   line set, centred. `render` draws from it, with the overlap warning's
   test. The staff's picker offers each mode's 15 spellings (design §3).
   Tests in `cnb/tests/cnb-key-signature-tests.js` and
   `cnb/tests/cnb-preview-display-tests.js`: each choice, C major, A minor,
   odd and even tonics under each rule, a sharp and a flat key, and every
   fixture and gallery file drawing exactly as before.
5. *Engine work:* insert the engine's session 30, the mark-list hook
   (design §9: `cnb:keysig-style 'marks` and `cnb:keysig-marks` with column
   offsets and bars, heads, Emmentaler sharps and flats, no cancelling
   naturals; tests for a key change, enharmonic spellings, a transposed
   score and system starts; goldens on LilyPond 2.24 and 2.26; the
   handoff), and its session 31, the 1.4.0 release, into the engine's plan.

*(Done in session 48, 2026-11-11: the probe read the tonic's spelling and
the key's pitch classes from `\key`, F♯ and G♭ major told apart, at a key
change, a system start and under `\transpose`, so the design stands. The
engine work is engine sessions 30 and 31 in the engine repository's plan,
"Key signatures from a mark list" and its release 1.4.0; session 49's
export and round trip wait for engine session 30 to land.)*

### Session 49: Scale notes reach LilyPond

**Why.** The engraving has to draw what the canvas draws (design §9).

1. Register.
2. Once engine session 30 has landed (otherwise the step is blocked): the
   exporter writes the mark table, 105 keys, for any signature whose
   effective settings are not today's; today's signature exports byte for
   byte as before. LY spec 1.3.15 §5.6a, the architecture plan, the README.
3. An engine round trip on a representative set (the default and
   Clairnote DN fixtures; each stacking rule; the upper tonic on and off;
   the half steps alone; the bottom, top and every line set; several gold
   stems) holds each engraved mark's height, column and look, each bar,
   and the signature's width to the preview's within 0.001 staff spaces. A
   key the table lacks engraves no signature and warns. The five export
   baselines stay byte-identical.

*(Done in session 49, 2026-11-11: the table exports and its marks, bars
and ledger lengths engrave as drawn, at any magnification. At the
operator's request the preview was made as true as possible: a mark-table
signature is spaced by its ink as the engine spaces it, and every
signature's gold stems have round caps and its ledgers their engraved
length. The round trip also found that the engine's signature heads take
ledgers from its own rule rather than the notation's, so the ink was held
only where the two agree; at the operator's choice the fix is engine
session 33 (engine 1.4.1, session 34 its release), and session 51 holds
the rest once it lands.)*

### Session 50: The Key signature panel

**Why.** A designer sets the signature in the panel, in a designer's words
(design §7).

1. Register.
2. The panel of design §7: what is drawn, the notes, the stacks and the
   gold stem, the looks (the notehead panel's own controls), the place,
   and the overlap note.
3. The Clairnote SN and DN gallery files take Clairnote-style signatures:
   dot and tailed-dot symbols, each placed by the dot's centre, tails thick
   and steep enough to read; a new stack at each change of parity, going
   left in sharp keys; no upper tonic; no gold stem. They are checked at
   concert size on an engraved page.
   *(Amended 2026-11-11, at the operator's choice, after that check.)* The
   sharps and flats are the dot with a slash through it, rising (/) for a
   sharp and falling (\) for a flat, not a one-sided tail. Engraved at
   concert size, a one-sided tail steep enough to read ran into the next dot
   of a whole-step stack. Placing the dot by its centre also needed hidden
   balancing geometry, because the engine centres a mark's box on its stack,
   and that geometry printed as specks. The slash is symmetric about the
   dot, so the dot is placed by its centre with no hidden geometry, and it
   clears the next dot (`docs/sessions/session-050/notes.md`).
4. A UAT driver for each choice on the canvas; screenshots at 1440 and
   1280 px, judged against the mock-ups. *Engine work:* none.
5. *(Moved from session 51 item 4 on 2026-11-11, at the operator's choice,
   when engine session 33 landed before this session ran.)* The
   key-signature round trips hold every signature head's ledgers to the
   canvas's, and every signature's ink, the scale stack and the mark table
   alike; the preview spaces the scale stack by its ink, the export gives
   each mark beyond the cards' pitches its ledger entry, and LY spec §5.6a
   drops its known divergence (1.3.16).

### Session 51: Accidentals

**Why.** Traditional accidentals, which may help pianists (operator,
session 42), the design's second kind of signature (design §5).

1. Register.
2. `CNBKeySignature.marks` for accidentals: in the traditional order, each
   sign at the pitch it makes, in its own column, each copy's columns
   starting again on every line set, no ledgers; Emmentaler's sharp and
   flat (SIL OFL 1.1, its licence already in `cnb/assets/fonts/`); the
   panel's "Sharps or flats".
3. The export writes them through the mark table; an engine round trip for
   C, a sharp key and a flat key, on the bottom line set and on every line
   set; tests and the UAT. *Engine work:* none beyond engine session 30,
   which draws sharps and flats.

*(The signature-ledger item that was 4 here moved to session 50, item 5,
when engine session 33 (engine 1.4.1) landed before session 50 ran.)*

### Session 52: Sharps and flats sized to the noteheads

**Why.** Session 51 draws the signs at LilyPond's size, 3 staff spaces
tall for a sharp. On the default staff, at 4 semitones a staff space, that
is 12 semitones, an octave, far too big beside its noteheads (operator,
2026-11-11). The signs are to be sized in semitones, as the noteheads are,
and the size is to be adjustable.

1. Register.
2. **The size.** `keys.keySignature.signs.heightSemis`: the sharp's height,
   measured from the top left of its upper bar to the top left of its lower
   bar, in semitones (axis units under a pitch axis, as a notehead's
   height). `null`, the default, is automatic: the least of the
   noteheads' mean height (the twelve pitch classes' crotchet noteheads as
   they resolve with no key), one staff space, and 3 semitones (operator,
   2026-11-11, after seeing 2 and 3 semitones on the default staff). Each
   part covers one kind of staff. The 3-semitone cap holds back very large
   noteheads, such as Kite 4-369's 4 semitones, which would otherwise make
   enormous signs. The noteheads set the size on most staffs. A staff space
   sets it on very dense staffs (0-5-7 and Avique, a line every semitone),
   where it gives LilyPond's own proportion, the bars a staff space apart.
   The rule gives 2.72 on the default staff, 3 on Kite, 1 on 0-5-7 and
   Avique, and 2 on the rest of the gallery. A number set by hand stays as
   it is when the noteheads or the staff change. The flat is scaled by the
   same factor as the sharp. The factor is the size ÷ the sharp's bar
   spacing (about 1.05 staff spaces; measure it from the outline in each
   optical size) ÷ the semitones per staff space. The columns are the
   scaled signs' widths apart. Validation: `null`, or a finite number
   greater than 0, with a warning outside 1–12 semitones. On the default
   staff the sharp comes out 7.77 semitones tall instead of 12.
3. **The panel.** Under "Sharps or flats", a Size row: "Automatic (2.72)",
   showing the size the rule gives, or a number in semitones that
   overrides it, with a way back to automatic. The Place row's hint stops
   mentioning the tonic and the half steps under sharps or flats (left over
   from session 51).
4. **The export.** Once the engine draws sized signs (otherwise the step is
   blocked): each sign mark carries its factor, `(semi column sharp
   0.6473)`. The factor is left out when it is 1, so an export from an
   engine without the field still parses. LY spec §5.6a (1.3.18), the
   architecture plan and the README are updated. The five export baselines
   stay byte-identical.
5. An engine round trip, for the default and Kite 4-369, middle and every
   line set, C, D and B♭ major, at the automatic size and one set by hand, and
   magnifications 1, 7/4 and 5/2: every sign's origin, its box and the ink
   are within 0.001 staff spaces of the preview's, and the spacing is
   within 0.005. Tests, and UAT screenshots at 1440 and 1280 px.
   *Engine work:* a sign mark's optional fourth element scales the glyph
   about its origin (engine session 35, engine 1.5.0, released in engine
   session 36).
6. **The magnification a config sets.** Engine session 35 also makes a
   plain score engrave at the exported `cnb:default-magnify`, where today
   only a staff that magnifies itself with `\magnifyStaff
   #cnb:default-magnify` does (found in session 51). Once it has landed, the
   round trips drop that prefix where the engine's handoff says they can,
   and LY spec §5.6a's paragraph on the magnification a score engraves with
   is rewritten to match.

### Session 53: Designing the key-signature editor

**Why.** A signature is set today in the panel's rows. It is either "the
key's notes", one shape per mark centred on its stack, or "sharps or
flats", Emmentaler's signs and nothing else. The operator wants an editor
for signatures (2026-11-11): the signature shown magnified, its marks
noteheads, sharps and flats or imported symbols, each of which can be resized
and moved, with rules for stacking and offsets. It starts from the notehead
signature, and for accidentals the arrangement is the cycle of fifths.

Clairnote shows the need (operator, 2026-11-11). A mark on a line or a
ledger is solid and one in a space hollow; a flat has a diagonal tail up and
a sharp a diagonal tail down. So a mark is one to three shapes. Session 50
tried one-sided tails and dropped them for two reasons
(`docs/sessions/session-050/notes.md`). The engine centres a mark's box on
its stack, so a one-sided symbol needed invisible balancing geometry, which
LilyPond printed as specks. And a steep tail ran into the next dot of a
whole-step stack.

1. Register.
2. A design only, no code: an amendment to
   `docs/planning/key-signature-designer-design.md`.
   - **One model for every signature,** in place of the two styles. A
     signature is four choices:
     - which notes get a mark: every note of the scale, or the altered notes
       only;
     - what each mark is drawn with;
     - how the marks are arranged;
     - their sizes and offsets.

     The notehead signature is the default, and the traditional signature is
     a starting point: altered notes only, Emmentaler's signs, the cycle of
     fifths, no gold stem. A config with either of today's styles loads and
     draws as it does now.
   - **Symbols.** A mark's symbol is a notehead (the notehead's own look or a
     chosen shape), Emmentaler's sharp or flat, or an imported SVG. It is
     chosen separately for naturals, flats and sharps, and imports are
     separate for flats and sharps. A mark is a base plus up to two added
     symbols, such as a tail, so one tail serves a solid dot and a hollow one.
     Each symbol has a reference point that sits on its pitch, such as a
     flat's bowl line, and says whether it takes ledger lines (a notehead
     does, a sign does not). An imported symbol has both set when it is
     imported.
   - **When a look applies.** Natural, flat or sharp; on a line or a ledger,
     or in a space; every second stack.
   - **Arrangement.** Today's stacking rules, or the cycle of fifths with one
     sign to a column. Traditional signatures zigzag (treble sharps F high, C
     lower, G high, then D, A, E, B) to stay within the staff, where session
     51's signs climb, each in the scale's octave above the tonic. The design
     gives a chromatic staff a zigzag rule, for example each sign within a
     window around its line set.
   - **The editor.** The signature magnified on a canvas, starting from the
     notehead panel's thumbnails, controls and SVG import. A drag moves or
     resizes a symbol, in semitones. An edit applies to its category, not to
     one mark in one key: dragging one flat moves every flat, and resizing a
     sharp sets session 52's size. A key picker, and small previews of other
     keys, show what an edit does across the 105 keys, where an offset that
     fits B♭ may collide in G♭.
   - **Placing a mark.** By its reference point plus an offset, rather than
     by centring its box, so no hidden geometry is needed.
   - **Tails.** How a tail clears the next dot of a stack.
   - **The rest.** The config, which panel rows the editor replaces, the
     preview, the mark table's format, and the engine's work: imported
     symbols as signs, placement by reference point and offset, and layered
     marks.
3. Mock-ups, made before the design goes for approval: the editor at 1440
   and 1280 px, with its key picker and its previews of other keys; the
   notehead signature, a traditional one with the zigzag, and Clairnote SN
   and DN with tails, each in sharp and flat keys at concert size. The
   operator reviews them.
4. A cross-provider consult before the operator approves the design. The
   design plans the sessions that build it, and the engine session they
   need. The operator decides whether they come before the 1.1.0 release.

*(Done in session 53: the amendment is §13 of
[`docs/planning/key-signature-designer-design.md`](../planning/key-signature-designer-design.md),
with mock-ups in
[`docs/planning/key-signature-editor-mockups/`](../planning/key-signature-editor-mockups/index.html)
and a consult with Sol and Argon in
[`docs/planning/key-signature-editor-consult.md`](../planning/key-signature-editor-consult.md).
The operator approved it on 2026-11-11 and put the sessions it plans, 54–56
below, before the UI-stable session (57) and the 1.1.0 release (58): "No
one is using this yet; so, no need to worry about release-related stuff.")*

### Session 54: One model for the key signature, on the canvas

**Why.** The approved key-signature editor design (session 53, design §13)
replaces the two styles with one model. It is built on the canvas first, and
the engine's work is planned.

1. Register.
2. The config of design §13.9 with its validation, and
   `CNBConfig.signatureStyleToModel`, called by `CNBConfigIO.mergeLoaded`
   before the defaults are merged. It converts a saved `style`: the
   accidentals style becomes the sharps or flats only, black signs and the
   cycle of fifths, climbing (§13.2).
3. In `CNBKeySignature.marks` and `render` (§13.3–§13.6):
   - the looks for naturals, a line or ledger and a space;
   - the signs as a look, black unless a look colours them;
   - added symbols, each `offset` and `added` replaced whole;
   - shapes' `reference` and `ledgers`;
   - placement by reference point plus offset;
   - the column step;
   - the sharps or flats only, with the cycle of fifths and both heights,
     the window shared by the key's family.
4. Tests in `cnb/tests/cnb-key-signature-tests.js` and
   `cnb/tests/cnb-config-tests.js`:
   - the window's zigzag on the default and Kite staffs, in sharp and flat
     keys, with the window raised;
   - a one-sided symbol placed by its reference point, and its ledgers;
   - every fixture and gallery file, and both of today's styles after
     conversion, drawing exactly as before.
5. Today's panel keeps working on the model, its Draw row setting the
   traditional starting point or the defaults, until session 56.
6. *Engine work:* insert into the engine's plan the session of design
   §13.10 and its release, 1.6.0: engine sessions 37 and 38. Session 37
   covers:
   - `(at dx . dy)` on every mark;
   - a colour on `sharp` and `flat`;
   - the `symbol` kind, solid or hollow, with no ledgers;
   - every ledger drawn before the marks.

### Session 55: The key signature's model reaches LilyPond

**Why.** The engine's contract is proved before the editor is built on it
(design §13.11, from the consult).

1. Register.
2. Once engine session 37 has landed and engine 1.6.0 is released (engine
   session 38; otherwise the step is blocked), the mark table carries
   (design §13.10), as engine 1.6.0 reads it:
   - the `at` placement;
   - signs' colours;
   - the `symbol` kind;
   - layered marks.

   LY spec 1.3.19 §5.6a, the architecture plan and the README are
   updated. The five export baselines stay byte-identical.
3. The Clairnote SN and DN gallery files take Clairnote's own signatures,
   their tails imported as filled shapes. Dots are solid on a line or ledger
   and hollow in a space (SN through the line and space looks, DN through
   its noteheads). Flats have a tail up and sharps a tail down, each an
   added symbol shallow enough to clear (design §13.7). They are checked at
   concert size on an engraved page, as session 50 checked them.
4. An engine round trip holds every symbol's placement, size and colour,
   every stack's ledgers and the ink to the preview's within 0.001 staff
   spaces. It covers:
   - the default, Kite 4-369 and both Clairnote files;
   - the traditional starting point on the bottom and every line set;
   - C, D and B♭ major;
   - an asymmetric head with a reference point;
   - offsets in x and y;
   - added symbols of other sizes;
   - a hollow base without ledgers;
   - a coloured and moved sign;
   - the Twinline pitch axis;
   - the seam between two line sets' copies.

   *Engine work:* engine sessions 37 and 38, planned in session 54.

### Session 56: The key-signature editor

**Why.** A signature designed on a magnified canvas, an edit moving a
whole category in every key (design §13.8).

1. Register.
2. The editor of design §13.8:
   - the magnified canvas, its height capped, with selection (a mark's
     spelling or the picked layer; the base or an added symbol), the drags,
     their snapping, one drag one step of undo, and the fields;
   - Edit and the look card, with the signs' thumbnails;
   - Import from SVG with its reference point and "Takes ledger lines";
   - the key picker, the mode's 15 keys previewed, and the list of keys
     whose marks touch;
   - the touch check over the 105 keys, by ink, as a warning (§13.7);
   - Start from.
3. The rows the editor replaces are removed: Draw, Looks, Size and the
   overlap note. A UAT driver covers each drag and choice; screenshots at
   1440 and 1280 px, judged against the mock-ups. *Engine work:* none.

### Session 57: The UI is stable

**Why.** The release waits for a stable UI (operator, 2026-11-06); the
declaration moved here in session 42.

1. Register.
2. The operator tries sessions 43–56 in the app. Rough edges found are
   fixed here, or planned as sessions before 58 if they are large.
3. The README's text and picture follow the UI as it now is. The full UAT
   runs.
4. The operator declares the UI stable, which is the condition for
   session 58. *(Amended during session 57: the operator's try-out found
   rough edges too large for it (`docs/uat-status.md`, session 57) and
   delayed the release: "This is too complicated as it stands. It needs to
   be more user friendly before a release." They are sessions 58–61 and
   the sessions 61 plans, and the declaration moves to the session before
   the release, numbered once session 61 has planned the build.)*

### Session 58: The repeated noteheads' overlap and the breve's tie

**Why.** The operator's try-out in session 57 (`docs/uat-status.md`,
items 2 and 3): the overlap of repeated heads is slightly too much with the
sample noteheads, may matter per shape, and its one control (Multinote
padding, in staff spaces) is out of sight in Advanced; and the breve's tie,
under all eight heads, looks a little odd.

1. Register.
2. Mock-ups first: the tie from the middle of the first semibreve group to
   the middle of the second, beside today's, and the heads at 1/3 overlap
   beside today's. The operator picks.
3. The overlap is set as a fraction of each head's width, beside repeat
   mode, for each shape if the mock-ups show it is needed; the tie as
   picked. Preview and engraving alike, with an engine round trip.
   *Engine work:* both (the engine builds the repeated stencil and its tie).

*(Amended during session 58, 2026-11-12: from the mock-ups in
`docs/planning/repeat-overlap-mockups/` (`shots/overlap.png`,
`shots/tie.png`) the operator picked the breve's tie from the middle of the
first semibreve group to the middle of the second, a default overlap of 1/3
of each head's own width, and one fraction for every shape, with no value
per shape. The engine work is engine session 39, "The repeated noteheads'
overlap and the breve's tie" (`cnb:multinote-overlap`, default `#f`, and
the tie between the groups' centres), in the engine repository's plan,
followed by its session 40, the 1.7.0 release. This session's round trip
waits for engine session 39 to land.)*

### Session 59: Clefs sized about an anchor

**Why.** The operator's try-out in session 57 (item 4): the clefs are too
big, as the sharps and flats were, and their height should be adjustable
without the clef leaving its pitch.

1. Register.
2. Each clef has an anchor point (the treble clef's curl, the point between
   the bass clef's dots, the alto and dozenal clefs' middle; an imported
   clef's picked by a click, as the key signature's reference point is) and
   the pitch it sits on. Resizing scales the clef about its anchor, so the
   anchor stays on its pitch. The default size follows the staff, as the
   signs' does.
3. Preview and engraving alike, with an engine round trip. *Engine work:*
   the dozenal clef's size; a glyph clef needs none.

*(Amended during session 59, 2026-11-13: from the mock-up in
`docs/planning/clef-size-mockups/` (`shots/clefs.png`) the operator picked
the automatic size, LilyPond's size with each staff space drawn as the
least of the noteheads' mean height, one staff space and 3 semitones (the
signs' rule; 68% of today's size on the default staff, unchanged on Kite
4-369's), and confirmed the four anchors as marked. The engine work is
engine session 41, "The dozenal clef sized about the middle line"
(`cnb:clef-size-semitones` scaling the dozenal numeral's offsets with its
height), in the engine repository's plan, followed by its session 42, the
1.8.0 release. This session's round trip waits for engine session 41 to
land.)*

### Session 60: Noteheads centred by their shape's reference point

**Why.** The operator's try-out in session 57 (item 1): some shapes are
better placed by their centre of mass than their vertical centre. The
consult ([`nudge-staff-lines-consult.md`](../planning/nudge-staff-lines-consult.md))
put it on the shape.

1. Register.
2. A shape's reference point (`shapes[name].reference`), which the key
   signature already reads, is the point a notehead puts on its pitch too;
   it can be picked when a shape is imported and changed after. Staff lines
   and ledgers stay at the pitch; the stem follows the drawn head.
3. Exported as a vertically translated shape variant, as sized variants
   are, the key signature not applying it twice; stems, dots and repeated
   heads with an asymmetric shape checked by an engine round trip.
   *Engine work:* none.

### Session 61: Designing the step-by-step Configurator

**Why.** The operator's try-out in session 57 (item 5): the key-signature
designer is too complicated, and the Configurator should read as a
sequence of steps.

1. Register.
2. A design document only, no code, from the operator's outline in
   `docs/uat-status.md` (session 57): the steps Notehead height, Staff,
   Pitch, Ledger lines, Noteheads, Key signature symbol type (noteheads,
   accidentals or custom marks), Custom key signature symbols (21 spelled
   notes, multi-select, imported symbols, six for Clairnote; only when
   needed), Key signature designer (stacking, column spacing, the gold
   stem), Key signature preview (every key and mode), Clef symbol import and
   sizing, Clef semitone/staff assignment; without the whole-staff canvas in
   the key-signature steps. It considers grouping the navigation panel (as
   `darndestdabbler/uat-checklist-editor` does) and numbering the steps or
   enabling them in order.
3. **The tutorial notation** (operator, 2026-11-13). One notation of the
   project's own, built from the default config to an exported `.ly`: a
   3-5-7-9 staff with ledgers at B and C♯ in the gap; diamond noteheads
   about 1.5 times as wide as tall, drawn by the reader in Inkscape with
   the toolkit; C♯, D♯, F♯, G♯ and A♯ red; minims as repeated heads first,
   then switched to hollows; a key signature of the same noteheads in
   Clairnote's stacks, credited; the operator's own C clef
   (`D:\sample-c-clef.svg`, to be checked in, its leftover font style
   removed), its anchor at its left middle, on middle C. An optional
   section draws a diamond twice as wide as tall and makes it the key
   signature's symbol, which exercises the custom symbols step.
4. **The walk-through.** A Playwright script that builds that notation, one
   stage per step, saving a screenshot at each; it is the stepped UI's
   golden-path UAT. It imports the finished SVGs, checked in as fixtures
   and made by following the tutorial. The steps come from one registry
   that the navigation, the walk-through and the tutorial read, so a
   renamed or reordered step fails a test.
5. **The tutorial.** In `docs/playbook/` and on the site, one section per
   step in the registry's order and words, illustrated by the
   walk-through's screenshots, with the fixtures as downloads. Its
   notehead-drawing chapter recommends starting from flat ovals for the
   head and the hollow (a rounded rectangle also serves for the hollow),
   grouping, rotating and ungrouping them, and says where the reference
   point (session 60) goes. The design says which session writes it.
6. **Importing a hand-drawn SVG.** The importer applies a path's ancestor
   transforms (a layer's or a group's), which it does not read today
   (`cnb/ui/svg-importer.js`), so a file straight from Inkscape, the
   operator's clef among them, imports where it was drawn. The design says
   which build session carries it.
7. **AI-assisted designing.** The step boundaries are drawn so each step
   edits one component of the config, the unit a schema describes and a
   partial import replaces. The design specifies the schemas, partial
   import at a step, a prompt per step in the AI-assisted workflow guide
   (`docs/playbook/ai-assisted-workflow.md`), and command-line validate,
   export and render-to-image for an agent working in the repository. It
   is built at 1.2.0 ("Published schemas and partial configs", below)
   unless the operator moves it.
8. Mock-ups, and a cross-provider consult, before the operator approves it;
   it plans the sessions that build it.

*(Done in session 61: the design is
[`docs/planning/step-by-step-configurator-design.md`](../planning/step-by-step-configurator-design.md),
with mock-ups in
[`docs/planning/step-by-step-mockups/`](../planning/step-by-step-mockups/index.html)
and a consult with Sol and Argon in
[`docs/planning/step-by-step-configurator-consult.md`](../planning/step-by-step-configurator-consult.md).
The operator approved it on 2026-11-13 (design §14): short labels under
static group headings, numbered steps with Next and Back and no enforced
order; the importer's transforms and path commands in session 62; the
diamonds drawn by the operator in session 67; the tutorial in session 68;
AI-assisted designing at 1.2.0; sessions 62–69 below before the 1.1.0
release, now session 70.)*

### Session 62: Importing a hand-drawn SVG

**Why.** A file straight from Inkscape does not import where it was drawn:
the importer reads no group's or layer's transform, and the export skips
relative and arc path commands. The operator's C clef has both (design
§8).

1. Register.
2. `cnb/ui/svg-importer.js` normalises each imported path to absolute M,
   L, C and Z with the transforms of the path and every ancestor applied
   (every transform kind, skew included), arcs within 0.01 stored units,
   basic shapes converted, the hollow, stem rects and reference point
   transformed with the head, and text, stroke-only paths, `use`, images,
   nested `svg`, clipping, masks and filters refused by name. A path
   already absolute and untransformed, as toolkit output is, is stored as
   it is.
3. The operator's clef (`D:\sample-c-clef.svg`) checked in as
   `docs/playbook/tutorial/downloads/c-clef.svg`, its leftover style
   properties removed, and imported in `uat-clef-editor.mjs`, engraved
   where the canvas draws it. The five export baselines unchanged.

### Session 63: The steps and the navigation

**Why.** The Configurator reads as a sequence of steps (design §1, §2, §4).

1. Register.
2. The step registry, `cnb/ui/steps.js`: twelve steps, their groups,
   labels, titles, components and availability, `next` and `back`, with
   `cnb/tests/cnb-steps-tests.js`.
3. The sidebar built from it (static group headings, numbers, short
   labels), a sticky Next/Back bar, steps greyed by availability with
   their reasons, the key-signature and clef panels shown as their steps,
   the whole-staff canvas hidden in steps 6–9, and the key definitions
   moved to Advanced.
4. "Hollow minims" beside the canvas's longer-durations choice, adding or
   removing one ordinary rule (design §5.1).
5. The drivers whose sections moved updated to the steps, opened by
   keyboard and at 1280 px.

### Session 64: The key signature's spelled looks

**Why.** Custom marks are chosen per spelled note, and their columns can
be tightened (design §3.5).

1. Register.
2. `keys.keySignature.looks.spelled` (the 21 spelled notes, laid over the
   line and space looks and under `alternate`), `columnGap`, and the
   built-in parallelogram, through `CNBConfig`, `CNBKeySignature.marks`
   and the mark table.
3. The Clairnote SN and DN gallery files redrawn with the six symbols,
   their mark tables byte for byte as before; the five export baselines
   unchanged; an engine round trip of a spelled look and a negative gap.
   *Engine work:* none.

### Session 65: Key-signature steps 6 and 7

**Why.** The key signature's kind of mark, and custom symbols on the 21
spelled notes (design §3.1–§3.3).

1. Register.
2. Step 6: Show a key signature, and the starting points Noteheads,
   Accidentals and Custom marks over the 21 spelled notes; a card
   highlighted only when the signature is exactly that starting point.
3. Step 7, available for any other signature: the 21 spelled notes
   selected by click, Shift or Ctrl and keyboard, the Select row, and the
   look card on the selection with mixed fields; an imported symbol added
   to the shapes by name.
4. `uat-key-signature.mjs` rewritten to the steps, building Clairnote SN's
   signature from its six symbols; undo after each starting point and
   import.

### Session 66: Key-signature steps 8 and 9

**Why.** The designer and the preview of every key (design §3.4).

1. Register.
2. Step 8: notes, stacks (the column gap by field and by dragging the
   second column, one step of undo), the gold stem and the place.
3. Step 9: the 7 modes' 15 keys each, with the touch check, a key opening
   in step 8.

### Session 67: The walk-through

**Why.** The tutorial notation built step by step is the stepped UI's
golden-path UAT (design §5, §6).

1. Register.
2. A draft of the tutorial's drawing chapter; the operator draws the
   diamonds (2 × 3 semitones, and the optional 2 × 4) in Inkscape with the
   toolkit, checked in as the tutorial's downloads.
3. `cnb/uat/uat-tutorial.mjs`: one stage per step, its stages written by
   hand and held to the registry; `tutorial.json`, `tutorial.ly` and
   `tutorial-custom.ly` checked in and compared; screenshots into
   `docs/playbook/tutorial/shots/` on request. An engine render of
   `tutorial.ly`.

### Session 68: The tutorial

**Why.** One notation built from start to finish, for a designer to follow
(design §7).

1. Register.
2. `docs/playbook/tutorial/index.html`: before you start, drawing the
   notehead, one section per step in the registry's order and words with
   the walk-through's screenshots, the optional custom symbol, and
   engraving it; held to the registry by `cnb-steps-tests.js`.
3. `cnb/site/assemble-site.mjs` copies it to `/tutorial/`; the app's
   header, the README and the playbook link to it; `uat-site.mjs` checks
   it on the site and opened from the repository.

### Session 69: The UI is stable

**Why.** The release waits for a stable UI (operator, 2026-11-06; moved
here in session 61).

1. Register.
2. The operator tries sessions 58–68 in the app and the tutorial. Rough
   edges found are fixed here, or planned as sessions before 70 if they
   are large.
3. The README's text and picture follow the UI as it now is. The full UAT
   runs.
4. The operator declares the UI stable, which is the condition for
   session 70.

### Session 70: Release 1.1.0 (release: 1.1.0)

**Why.** The first release since the UI work, and the site's first deploy.

1. Register.
2. Take over the withdrawn 1.0.2 `CHANGELOG.md` entry and `version.json`,
   renamed to 1.1.0, and add the notehead-first editor, the clef and
   key-signature export, and sessions 36 onward, to the entry.
3. The tag deploys the site. Confirm it is up and that the README and the
   `file://` notice link work.

---

## Toward 1.2.0

Planned with the operator on 2026-11-08. Release version proposed: 1.2.0,
a minor version, since the item adds a feature and breaks no config. The
clefs and the key-signature designer, first planned here, moved before
1.1.0 in session 42 (operator). The session is numbered after the 1.1.0
release.

### Published schemas and partial configs

**Why.** With a published schema for each part of a config, a designer can
have an AI write that part and import it (operator, 2026-11-08).

1. Register.
2. One JSON Schema for each component (noteheads and their rules, staff
   and ledgers, clef, key signature) and one for the whole config,
   versioned, in the repository and on the site at stable addresses. A test
   holds the schemas and `CNBConfig.validate` to the same answer for every
   fixture, every gallery config and a set of bad samples.
3. Open imports a partial config into its own section, says what it will
   change first, and validates it as any config is. *(Session 61, design
   §9.2: "Import this part…" at each editing step, shapes added by name;
   Open stays for whole configs.)*
4. The AI-assisted workflow guide gains a prompt for each component, with
   the schema's address. *(Session 61, design §9.3: one prompt per step, in
   the registry's order and words.)*
5. *(Added in session 61, design §9.4.)* `node cnb/cli/cnb.mjs` with
   `validate`, `export` and `render` (to an image, through the UAT's server
   and Chromium), for an agent working in the repository.

---

## After 1.1.0: work the records defer

Larger items that the v1 session sets (001–014), the gallery survey and
sessions 1–4 deferred, still open on 2026-11-07. None is scheduled. Each is
a feature or a research task that needs its own design, or a decision from
the operator, before it becomes numbered sessions; most serve the
full-gallery goal (`docs/research/gallery-survey/reproduction-report.md`,
"Strategic note"). Release versions are proposed when they are planned.

- **Export what engine session 24 adds** (operator, 2026-11-07): once the
  engine anchors a text clef, pads the clef gutter on both sides and picks
  the key-signature octave per tonic under a pitch axis, the exporter
  writes the new settings and LY spec §5.4d and §5.5 drop their "known
  divergence" notes. Needs that engine release first.
- **Off-key marking** (architecture §11 question 4; sets 005, 010): draw
  the mark in the preview and export it. The engine already takes it
  (`cnb:register-off-key-mark!`, the `off-key-mark` field). Key rows in
  the card collection (architecture §5 Module 10, "future") are likely
  part of it, since a mark depends on the key.
- **E3, stem and duration devices** (`enhancement-requirements.md` E3):
  several stems, auxiliary stems, new flags, direction-dependent ticks.
  Configurator and engine; blocks Tier-2 records 20, 22, 29, 34, 36, 38
  and 40. A program of its own.
- **E4, accidental marks** (E4; records 4, 27, 29). Configurator and
  engine; may share machinery with off-key marking.
- **Key signatures made of custom symbols, in the Clairnote style** (set
  010 s2 notes D11, D12 and its design consult; record 40). The engine
  backlog §2.3 says to reopen a mark-list rendering hook when this is
  scheduled. *Planned since 2026-11-08 as session 42 and on; since
  2026-11-09, 44 and on; since 2026-11-10, 46 and on; since 2026-11-11,
  designed in session 47 and built in sessions 48–51, the mark-list hook
  being engine session 30; Clairnote's tailed marks, through the
  key-signature editor designed in session 53, in sessions 54–56.*
- **Gallery fidelity** (`reproduction-report.md`):
  - Gap A, a ledger rule that hides a ledger when a staff line lies between
    it and the note, which would let the Clairnote SN/DN, Chromatic Lyre
    and AxLoMaFi fixtures drop their trimmed trigger lists (preview only);
  - Gap C, the Hass notehead's vertical offset, perhaps now possible with
    session 22's sizes and session 24's nudges (test that first);
  - Gap D, polished glyph SVGs for the Hass, AxLoMaFi, Schoenberg,
    Trilinear and Jazz-oval fixtures, and their real sizes through
    `heightSemis` (operator assets);
  - a configurable dash pattern for staff and ledger lines (preview only);
  - the 21 provisional verdicts of feasibility matrix §5 and per-system
    reproduction fixtures for records 32–40 (sessions 1–4 carried this
    forward).
- **Limits kept on purpose**, listed so they are not mistaken for
  backlog: invariants I1, I3, I4 and I5, non-monotonic axis maps (PA-8),
  mixed-offset chords across pitch classes, record 7's grouped far-side
  ledgers, and a glyph-internal clef anchor attribute (the float top anchor
  covers every surveyed clef). Session 34 retired two: the in-gap ledger
  difference (the ledgers export, LY spec 1.3.9 §5.7) and architecture §11
  question 8 (the preview draws the engine's stem).
