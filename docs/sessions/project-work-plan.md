# Project work plan — sessions

**Written by `dabbler` as a fold of `activity-log.json`.**
Hand edits are overwritten by the next append. The record is the log;
this page is one view of it.

---

## Sessions

The numbered sessions are declared from `session-plan.md`; each one's task is what its own plan step declared.

| # | Session | Releasable | Declared |
| ---: | --- | --- | --- |
| 1 | Export-spec adoption + `CNBPitchAxis` + grid (P1, P2) | — | not declared |
| 2 | Consumer rethread (P3) | no | 2026-10-31 |
| 3 | Exporter + fixtures + engine round-trip (P4) — **gated on engine set 008** | no | 2026-10-31 |
| 4 | UI presets + re-tier + operator UAT (P5, P6) | no | 2026-10-31 |
| 5 | Browser UAT becomes reproducible | no | 2026-10-31 |
| 6 | Hostile input, error paths and the browser matrix | no | 2026-11-01 |
| 7 | Retire `legacy/`, rewrite the README and the guidance | no | 2026-11-01 |
| 8 | Packaging | — | not declared |
| 9 | Release 1.0.0 (release: 1.0.0) | — | not declared |

### Session 2 — Consumer rethread (P3)

**Releasable: no.**

Rethread every preview geometry consumer through the grid's pitch axis (design docs/planning/pitch-axis-design.md §2.3–§2.5, §3.3), keeping the axis-disabled surface byte-identical by construction. First, before any source change, capture a pre-change preview-DOM baseline fixture (CNBCollection.render through the svg/DOM stub for the default config, the Kite 4-369 config, every gallery example, a key-signature-enabled config, a debug-grid config, and the same configs with a present-but-disabled pitchAxis section) and pin it with a test. Then: CNBStaff.render dedups lines by axis position on the axis path (overrides merged) and keeps its literal loop on the linear path; CNBLedgerSet.resolve/render gain an axis path that converts to axis positions at the top, gates on axis.regionOfSemi, keeps the strict `<` proximity rule, and draws keyed by axis position, while the linear path runs the literal current arithmetic; CNBStem.direction averages axis positions against positionOfSemi(staff.midpoint) when given an enabled axis (literal body otherwise); CNBDoubleNotehead.layout accepts additive per-note lowerOffsetPx/upperOffsetPx (default 0); CNBCard computes offsetPx = xOffsetStaffSpaces × axis.unitsPerStaffSpace × pxPerSemi in axis mode only, applies it to both noteheads, the ledgers and the stem centerX, and widens columnWidth by |offsetPx|; CNBKeySignature treats separator.extentSemis as a length on the axis path and applies the same resolved offset to its marks. The collection needs no code change (everything flows through the grid context) and gets an axis-row integration test. Finally a visual test page cnb/test-pages/test-pitch-axis.html renders a compact-axis card row with the 013 Twinline map and debug grid, and a Chromium geometry smoke driver cnb/uat/uat-pitch-axis.mjs (the repo's existing driver pattern) asserts its geometry in a real browser.

### Session 3 — Exporter + fixtures + engine round-trip (P4) — **gated on engine set 008**

**Releasable: no.**

Session 3 (P4) of the pitch-axis program. The engine gate is met: the engine repo's set 008-pitch-axis-hook closed 2026-07-13 and its configurator-handoff.md records E13-1 (the cnb:get-pitch-staff-position hook) and E13-2 (the x-offset field) as shipped with golden-baseline evidence. This session (1) removes the §8a fail-loud gate from cnb-lilypond.js and its mirror in the UI export wrapper in the same change that first emits the v1.3 surface: the compiled pitch-axis procedure and axis staff-line positions with collapse dedup (§5.4a/b), the axisUnitsPerStaffSpace substitutions in attachments and staff-line thickness (§4.4a/§5.3a), and the (x-offset . N) field in the Section C grouping key (§6.3), with exporter-level tests that §8 checks 8-12 (already Module A PA-1..PA-8) now block generate(), reconciled against the handoff: cnb:semitones-per-staff-space is emitted as axisUnitsPerStaffSpace under an axis (handoff §4.1) and an explicit cnb:keysig-tonic-octave is emitted under an axis (handoff §4.2, octave convention verified by the round-trip render); (2) records those reconciliations as a v1.3.1 clarification of the canonical spec; (3) adds a Twinline-family compact fixture (the 013 map, shared-pair xOffsetStaffSpaces 0.85) under cnb/assets/examples/gallery/ so it loads through CNBConfigIO via the existing gallery gate, with a pinned export baseline; (4) runs the engine round-trip (export, then lilypond 2.24.2 -dbackend=svg in the engine repo, then tools/harvest_svg.py) and commits a driver, the harvested evidence and a node measurement script that checks engine positions and x-offsets against the preview's CNBPitchAxis model, excluding the documented divergence list. All axis-disabled exports stay byte-identical (existing default and Kite baselines unchanged).

**Amended after acceptance:**

- 2026-10-31 — step 'spec-clarification': its files: The architecture plan's §4.13 export-surface note still states that generate() throws on pitchAxis.enabled (the lifted §8a gate); it must be corrected alongside the spec. (claude-code (anthropic, claude-opus-5-5))
- 2026-10-31 — step 'compact-fixture': its files: The set-014 s2 preview baseline sweeps every gallery fixture to pin the axis-DISABLED (pre-rethread) preview; an axis-enabled gallery fixture has no linear baseline, so previewProbes() must skip pitchAxis-enabled fixtures (axis previews are covered by the s2 axis render tests). (claude-code (anthropic, claude-opus-5-5))
- 2026-10-31 — step 'engine-roundtrip': its files: A shared-position chord pair is already separated by LilyPond's own arrangement (+0.49 here), so the x-offset effect is measured test-minus-control (engine set 008 s2 method): the control export, score, SVG and harvest join the evidence; measure.mjs reads the key-signature marks from the SVGs, so both SVGs are kept. (claude-code (anthropic, claude-opus-5-5))

### Session 4 — UI presets + re-tier + operator UAT (P5, P6)

**Releasable: no.**

Finish the pitch-axis implementation (design phases P5 and P6). Build the pitch-axis editor panel (cnb/ui/pitch-axis-editor.js) on the Modules 12–17 editor contract: property-based event wiring, a Node-testable render(), pure stateFromConfig/buildPitchAxis/applyToConfig builders and Module A validation pass-through. It edits enable, kind, octaveStride, axisUnitsPerStaffSpace and the 12 per-pc positions, and offers one preset, "Twinline-like 7-position", which compiles into the explicit design §1.1 map plus a named notehead rule carrying the shared-pair xOffsetStaffSpaces. The editor never creates a pitchAxis section the user did not ask for, so default configs stay byte-identical. Let the notehead rule editor keep and edit apply.xOffsetStaffSpaces; today its builder drops the field, so loading the Twinline fixture loses its offsets. Wire the panel into the app shell, cnb/index.html (the repository has no cnb/ui/app.js; index.html is the shell that the plan's app.js entry stands for). Re-tier feasibility-matrix records 32–40 as a dated amendment, with the twinline-compact fixture and the session-3 engine round-trip as evidence. Record the operator's verbatim UAT decision in docs/sessions/uat-session-4.md. Close out the pitch-axis work in docs/sessions/change-log.md.

### Session 5 — Browser UAT becomes reproducible

**Releasable: no.**

Make the browser UAT reproducible from a fresh clone. Add a private root package.json with no runtime dependencies that declares playwright-core as its only devDependency (with the generated package-lock.json committed and node_modules/ ignored), a `test` script (`node cnb/tests/run-tests.js`) and a `uat` script that runs a small sequential runner, cnb/uat/run-uat.mjs, which spawns every cnb/uat/uat-*.mjs driver in turn and exits non-zero on the first failure; document `npm install` and `npx playwright install chromium` in the README. The drivers already resolve playwright-core from their own location first (which reaches the repository's node_modules) and fall back to CNB_UAT_PLAYWRIGHT; their not-found messages are updated to point at `npm install` at the repository root. Then run every driver (there are eleven uat-*.mjs files, not the ten the plan counts: uat-gallery-previews.mjs is a capture tool and is included), fix whatever drift broke in the drivers or the app, and record each driver's result in docs/uat-status.md. Finally declare the UAT run as a second suite `cnb-uat` in dabbler.yaml (`command: npm run uat`, expensive, whole_at_close, runs_whole, covers [cnb/]) and update the comment there that says the drivers are undeclared.

### Session 6 — Hostile input, error paths and the browser matrix

**Releasable: no.**

Make the app report hostile input instead of failing in the console, prove it in three browsers, and read the toolkit's minim stem anchors. A probe of the current code found the gaps: wrong-typed sections in a loaded JSON (shapes as an array, noteheadRules as an object, staff.semitonePattern as a string, palette.colors as a string) either throw inside CNBConfig.validate with an unhelpful message or load cleanly and then crash the preview/editors inside the load promise, which reaches the console and leaves the app half-mounted; the SVG import control has no catch around reading/parsing a file; and the non-toolkit-SVG error does not say what to do. The fixes stay small: config-io checks the merged config's value types against createDefault() (array vs object vs primitive, where the default is not null) and rejects a mismatch with a message naming the field, and catches a throwing onLoad into its error area; the app shell's onLoad restores the previous config and re-mounts when adopting a loaded config throws; the import control catches read/parse failures into an error result, and the missing-#notehead error says the file is not Music Glyph Toolkit output. The toolkit has shipped the minim pair (its session 4: <rect id="stem-minim-up"> / <rect id="stem-minim-down">), so the SVG importer reads it with the same rect rule as the regular pair into anchors.minimUp/minimDown, falling back to the crotchet anchors when the pair is absent (with a warning on a half pair); the exporter already emits minim-up/minim-down from lilypondAnchors, which a new export test pins. A new Playwright driver runs the hostile inputs against cnb/index.html in Chromium, Firefox and Edge, asserting a visible message for each and no page or console errors; anything it finds broken is fixed, and the README gains a Supported browsers table.

**Amended after acceptance:**

- 2026-11-01 — step 'uat-hostile-input': its files: Firefox logs an 'XML Parsing Error' console error whenever DOMParser receives non-XML text; the importer now refuses text with no <svg element before parsing, which needs the importer and its tests (claude-code (anthropic, claude-opus-5-5))

### Session 7 — Retire `legacy/`, rewrite the README and the guidance

**Releasable: no.**

Retire the legacy monolith and bring the repository's front-door documentation up to a 1.0.0 product. Tag the current commit `legacy-monolith-final`, delete `legacy/`, and repoint every live reference to it at the tag: the architecture plan's file-structure section, `docs/planning/project-plan.md`, the port-origin comments in four `cnb/` files, and `cnb/tests/cnb-lilypond-tests.js`, which (contrary to the session plan's note) still requires `legacy/configurator-core.js` for three legacy-parity tests; those tests and their now-unused helpers go with the code they compared against. Rewrite the README for a complete 1.0.0 product: status complete, export spec v1.3, no `legacy/`, a "Known limitations" section summarizing and linking Part 2 of the notation-builder playbook (I1, I3, I4, I5 as hard limits; I2 relaxed by the optional `pitchAxis` section per the feasibility matrix §9), a "Running the tests and UAT" section matching `dabbler.yaml`, and LilyPond 2.24.x or 2.26.x for engraving. Update `CLAUDE.md` (spec v1.3, Module 24 `cnb-pitch-axis.js`, no legacy section or legacy test command). Replace the placeholder `docs/planning/lessons-learned.md` with real lessons harvested from the session-set change logs, delete the empty `lessons-archive.md` and the TODO-template `project-guidance.md`, leaving no v1 `ai_router` instructions, and add a root `version.json` reading `{ "version": "1.0.0" }`.
