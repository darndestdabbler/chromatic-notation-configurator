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
| 8 | Packaging | no | 2026-11-01 |
| 9 | Release 1.0.0 (release: 1.0.0) | yes | 2026-11-02 |
| 10 | No imported text can become Scheme | no | 2026-11-02 |
| 11 | Path data in the units the engine reads | no | 2026-11-03 |
| 12 | Export only what the engine engraves | no | 2026-11-03 |
| 13 | Documentation, archive and 1.0.1 | no | 2026-11-03 |
| 14 | Release 1.0.1 (release: 1.0.1) | yes | 2026-11-03 |
| 15 | The app online, and a page that says why it is blank | no | 2026-11-05 |
| 16 | A second reference notation, 45deg-369 | no | 2026-11-05 |
| 17 | The preview draws an imported notehead at its own height at once | no | 2026-11-06 |
| 18 | The preview shows what repeat mode engraves | no | 2026-11-06 |
| 19 | Design: a notehead-first editor | — | not declared |
| 20 | The colour picker stays open | — | not declared |
| 21 | Each notehead has its own height and width | — | not declared |

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

### Session 8 — Packaging

**Releasable: no.**

Declare how this repository packages a release: add a `packaging:` block to dabbler.yaml with a `pack` and no `push`, whose argv makes a source archive of the trunk with `git archive --format=zip --output={output}/chromatic-notation-configurator-1.0.0.zip HEAD`, and correct the comment above it that says the repository declares no packaging. The block is checked with `dabbler packaging --rehearse`.

### Session 9 — Release 1.0.0 (release: 1.0.0)

**Releasable: yes.**

Release 1.0.0: the framework packs and publishes what is on the trunk.

### Session 10 — No imported text can become Scheme

**Releasable: no.**

Close audit findings H1, L6 and M5 (docs/planning/audit-2026-11-02.md) so that no text from an imported config or SVG can become Scheme in the exported .ly. A new pure module, cnb/src/cnb-scheme.js (CNBScheme), holds the only emitters the exporter may use: comment text (control characters and newlines become spaces), Scheme strings (escape backslash and double quote), symbols (must match ^[a-z][a-z0-9-]*$, else throw naming the field), numbers (finite JavaScript numbers formatted by the exporter; engine.defaultMagnify's fraction string is parsed into two finite numbers and re-emitted from them), versions (^\d+\.\d+\.\d+$), and LilyPond path data (strictly parsed into moveto/lineto/curveto/closepath commands with numeric arguments and re-emitted from the numbers in the exporter's existing layout), plus the slug function shape symbols come from. cnb/src/cnb-lilypond.js routes every emitted value through these emitters and never interpolates raw config text. CNBConfig.validate uses the same predicates so it rejects every value an emitter would reject (version, magnify, schemeSymbols values, unparseable lilypondPath/lilypondHollowPath, non-finite numeric fields the exporter emits), and adds the M5 errors: a shape whose slug is empty or not a valid symbol, and two shapes whose slugs collide, each error naming the shapes. The SVG importer parses data-lilypond-* paths (notehead, hollow and clef) and turns a path that does not parse into an import error, storing the re-serialized form otherwise. Hostile-input fixtures (the audit's shared-config.json label payload, an SVG whose data-lilypond-notehead carries #(display ...), and one payload per affected field) drive unit tests asserting each payload is rejected by validation and export alike or exports a .ly whose #( and $( occurrences are exactly those of the same config without the payload, and an engine-backed test that compiles each accepted export with LilyPond (skipping with a logged reason when lilypond is not on PATH or the engine repository is not found) and asserts the payload text is never printed. Output for every valid existing config, including the default, Kite and twinline-compact baselines and the gallery, stays byte-identical.

### Session 11 — Path data in the units the engine reads

**Releasable: no.**

Close audit findings H2 and H3 and toolkit-audit findings M5, M7 and M8 (importer side), so every exported notehead path is in the staff-space units the engine draws. One conversion function in cnb/src/cnb-lilypond.js, CNBLilypond.pathToStaffSpace(commands, unitsPerStaffSpace, flipY), serves both sources. Toolkit data-lilypond-* paths are in semitone units, Y up; they are divided by the staff's semitones per staff space (axisUnitsPerStaffSpace under a pitch axis), the same divisor attachmentPoints() uses for anchors. The fallback svgPathToLilypond(svgPath, unitsPerSemitone, sps) converts SVG M/L/H/V/C/Z to path commands and applies the toolkit normalisation through the same function: divide by the shape's SVG units per semitone (naturalHeight / semitoneHeight, which is 100 for toolkit output), negate Y, then divide by sps. The centre is the shape's coordinate origin. The toolkit centres its output there, and both the preview and the stored anchors already treat that point as the notehead centre. Re-centring on the bounding box would pull the deliberately asymmetric gallery shapes (the oval-slash heads) off their own stem anchors. Unit tests cover both sources at sps 1, 2 and 3. Fixtures are regenerated from real data. First, the current Kite export (which matched the engine's golden score in set 007) is pinned as cnb/fixtures/kite-4-369-export-baseline.ly. Then kite-up.svg and kite-down.svg get true toolkit-unit data-lilypond-* attributes, produced by the toolkit's own format_scheme(parse_and_normalize(d)), plus stem-minim rects that carry the engine reference's minim anchors. A tracked script, cnb/fixtures/rebuild-kite-shapes.mjs (with a --check mode), rebuilds the Kite config's shapes by importing those SVGs through CNBSvgImporter. The rebuilt Kite export must equal the pinned baseline, and it is also rendered through the engine against the golden score using the set-007 recipe, with the result recorded in the step notes. If either check fails, the step finds which side is wrong and records it rather than scaling by hand. twinline-compact has no source SVG, so its real data is its stored svgPath: its hand-pre-divided lilypondPath and lilypondHollowPath are removed and the corrected fallback produces them. default-export-baseline.ly is re-baselined. A shared test helper, cnb/tests/engine-probe.js, finds LilyPond and the engine and measures engraved notehead stencil extents from a real render, skipping with a logged reason when either is missing. It drives two engine-backed tests. The first asserts that the default config's noteheads are 0.5 to 3 staff spaces in width and height. The second covers every gallery export, per the operator's decision this session: three Express Stave fixtures legitimately engrave at about 0.33 staff spaces, the size the preview shows. Each notehead's engraved width and height must therefore match its preview size within 5%: semitoneHeight / sps tall, and naturalWidth / (naturalHeight / semitoneHeight) / sps wide. On the importer side: extractClef accepts the toolkit's glyph-mode data-lilypond-glyph attribute and imports every glyph path, merging their path data, not only the first. When an element carries both modes' attributes, the importer prefers the one that matches the import target (notehead data for shapes, clef or glyph data for clefs) and warns. A stem rect's own transform attribute (matrix, translate, scale, rotate) is applied before its anchor is read. Each of these gets a unit test. The LY export spec gains a 1.3.2 entry recording the path-unit rule, and the architecture plan's §4.2 note on pre-baked paths is corrected.

### Session 12 — Export only what the engine engraves

**Releasable: no.**

Make the LilyPond export carry only what the engine engraves, and say so wherever a setting stops at the preview (audit 2026-11-02 M1-M4, L1-L5). The exporter stops emitting cnb:stem-thickness (undefined in the engine, fatal in LilyPond) and the no-op cnb:default-staff-line-thickness / -color settings. The export header lists the preview-only settings (staff line colour and thickness, ledger rules, stem thickness, repeat counts, the CB-safe preview toggle, key-scoped notehead rules), names the colour palette only when Section A actually registers colours from it, and no longer claims a cb-safe mode the file does not engrave. The matching UI controls (stem thickness, staff line styling, ledger rules, CB-safe toggle, repeat counts) carry a preview-only note, and README Known limitations lists them. A notehead rule scoped to a key gets a CNBConfig.validate() warning naming the rule, which the export panel shows, instead of vanishing silently. The staff editor keeps the loaded staff.midpoint and semitonesPerStaffSpace while the pattern is unchanged, re-deriving them only when the pattern itself changes, with a test that edits twinline-compact (midpoint 7) and finds its pitch-axis export byte-identical. The derived-geometry panel shows the staff-line positions the exporter computes for the full config, so it is right under a pitch axis. Every approx() test helper fails on NaN, and the test runner counts a test file with no tests export as a failure. The pinned export baselines are regenerated by running the exporter, the LY spec records the change as 1.3.3, and the cnb-unit suite passes.

**Rolled back:**

- 2026-11-03 — session 12 — Rollback to Start of This Session from the Work Explorer (operator)

### Session 13 — Documentation, archive and 1.0.1

**Releasable: no.**

Finish the documentation and archive work for 1.0.1. Push the local `legacy-monolith-final` tag to origin (audit M6) and confirm that every README and CLAUDE.md mention of it now resolves on GitHub. The README names it in plain text, and CLAUDE.md does not mention it. Fix the README's description of `cnb/assets/` to say gallery example configs (L7). Confirm that README "Known limitations" lists everything sessions 10–12 made preview-only, and set its status line to 1.0.1. Add a `.gitattributes` that export-ignores `.vscode/`, `AGENTS.md`, `CLAUDE.md`, `docs/sessions/`, `docs/transcripts/` and `docs/planning/`. Make the declared pack read the working-tree attributes and name the zip by `{version}`, so that `dabbler packaging --rehearse` shows the exclusion before the commit and session 14 packs a 1.0.1 zip. List the rehearsed zip in `docs/sessions/session-013/notes.md`. Set `version.json` to 1.0.1 and add a `CHANGELOG.md` with 1.0.0 and 1.0.1. The 1.0.1 entry says that 1.0.0 exports with toolkit shapes or fallback paths were mis-scaled and should be regenerated.

### Session 14 — Release 1.0.1 (release: 1.0.1)

**Releasable: yes.**

Release 1.0.1: the framework packs and publishes what is on the trunk.

### Session 15 — The app online, and a page that says why it is blank

**Releasable: no.**

Put the configurator online and make a file:// open explain itself. cnb/index.html gains a small classic inline script, run before the module script, that shows a visible notice at the top of the page when location.protocol is "file:": the app must be served over HTTP, a link to https://configurator.darndestdabbler.org/, and the README's two local commands (npx serve . / python -m http.server 8000, then open /cnb/index.html); the page also gets an inline <link rel="icon"> so a served page logs no favicon 404. A dependency-free Node script, cnb/site/assemble-site.mjs <outDir>, copies cnb/index.html, cnb/src/, cnb/ui/ and cnb/assets/ into <outDir> so the app sits at the site root, with no transform. A GitHub Actions workflow, .github/workflows/pages.yml, runs on push of v* tags and on workflow_dispatch, assembles the site into _site and deploys it with actions/configure-pages, actions/upload-pages-artifact and actions/deploy-pages (pinned to major versions, pages/id-token write and contents read permissions, a pages concurrency group, no tests); .gitattributes export-ignores /.github. A Chromium UAT driver, cnb/uat/uat-site.mjs, on the existing driver pattern, assembles the site into a temp directory, serves it over HTTP and checks that / renders the preview and mounts the editors with no notice and no page or console errors, then opens the working tree's cnb/index.html over file:// and checks the notice is visible and names the live URL. The README's Usage leads with the live site, keeps the local-server instructions for development and mentions the notice; CHANGELOG.md opens a 1.0.2 entry; docs/uat-status.md records the new driver's result and the dabbler.yaml comment's driver count goes to 13. The operator prerequisites (public repository, Pages source GitHub Actions, the custom domain, DNS and HTTPS) are checked read-only with gh api and recorded in the notes.

**Amended after acceptance:**

- 2026-11-05 — step 'file-protocol-notice': its checks: node cnb/tests/run-tests.js fails identically on the unchanged tree: its engine-backed gallery size check (check-gallery-examples) measures noteheads at 7/4 the preview size against the sibling engine repo, which changed on 2026-11-05 (its sessions 22-23). That failure does not describe this step; the markup check does, and the whole suite still runs as the run of record. (claude-code (anthropic, claude-opus-5-5))

**Rolled back:**

- 2026-11-05 — session 15 — Rollback to Start of This Session from the Work Explorer (operator)

### Session 16 — A second reference notation, 45deg-369

**Releasable: no.**

Make 45deg-369 a checked-in, test-gated reference notation beside Kite 4-369, and plan the follow-on work from the operator's 2026-11-05 Configurator feedback. The operator handed over cnb/fixtures/45deg-369-config.json and 45deg-369-from-configurator.ly made in the app; on the operator's instruction this session corrects the config where it departs from the design (the shape is imported from the committed cnb/fixtures/45deg.svg and named 45deg instead of draft-notehead, the unused crotchet-minim shape is removed, and the meta block gets the 45deg-369 name, suffix, label and footnote instead of the default 4-8 system's), keeping the staff, the operator's empty ledger templates, the #56b3e9 blue, the keys section and the repeat mode as the operator made them. The hand-exported .ly is superseded by an export from the corrected config and is not committed. The one-fixture export driver becomes cnb/fixtures/export-config.mjs <config.json> [out.ly], with export-kite-4-369.mjs kept as a wrapper the umbrella pipeline names; 45deg-369-export-baseline.ly is pinned byte-identically as Kite's is; the importer tests prove the fixture imports with the toolkit's anchors (up (0, 1.649), down (0, -1.650), minim pair equal to crotchet pair) read from the SVG's rects and that the export divides them by 3; the config joins the preview baseline probes; joy-to-the-world-45deg.ly engraves through the engine (1.2.0 or later) as a test that skips with a reason when lilypond or the engine is absent. README, CHANGELOG 1.0.2 and version.json 1.0.2 follow. Finally, sessions 18-21 are added to the session plan after the 1.0.2 release: the notehead-height preview bug, a preview of repeated noteheads and multinote padding, a 1.1.0 release, and a design session for a notehead-first editor with rule inference.

**Amended after acceptance:**

- 2026-11-05 — step 'correct-config': its checks: The shape cannot be named 45deg: validation rejects it because a Scheme symbol must start with a Latin letter. It is named ellipse-45deg instead; the check follows. (claude-code (anthropic, claude-opus-5-5))
- 2026-11-05 — step 'engine-round-trip': its files: The engraved round trip shows the 45deg-369 footnote set in step correct-config running off the page; it is shortened to Kite's length, and the export baseline follows. (claude-code (anthropic, claude-opus-5-5))

### Session 17 — The preview draws an imported notehead at its own height at once

**Releasable: no.**

Find and fix why the app's preview drew a freshly imported 4-semitone notehead too small until an unrelated edit redrew it. A new Playwright driver, cnb/uat/uat-imported-notehead.mjs, loads cnb/fixtures/kite-4-369-config.json into cnb/index.html, imports cnb/fixtures/45deg.svg, applies it in the default notehead rule, and measures every drawn notehead's height in the preview before any further edit. It checks that each is 4 semitones (4 x pxPerSemi) and that the preview is unchanged by a later unrelated edit (a notehead colour change). A first in-browser probe through the file input, including re-importing a shape under the same name, drew it at 64 px (4 semitones) at once, so the driver also follows the operator's other routes (drag-and-drop, applying through a new rule, a colour edit afterwards) until it finds the path that leaves the preview stale or wrongly scaled. The fix goes at that cause. A unit test goes in the test file named after the source file that changes, the driver pins the behaviour in the browser, and docs/uat-status.md records the driver and its run.

**Amended after acceptance:**

- 2026-11-06 — step 'fix': its files: The driver did not reproduce the stale height on any route and found no cause, so no source file changes; the step adds a regression unit test pinning the imported 45deg shape's preview size (4 x pxPerSemi) in the importer's test file (claude-code (anthropic, claude-opus-5-5))

### Session 18 — The preview shows what repeat mode engraves

**Releasable: no.**

Make the preview show what repeat mode engraves, and say why no key signature draws. In representationMode "repeat", each card draws a duration's notehead as the engine's cnb:build-duration-stencil lays it out: the engine's fixed counts (lilypondDuration 3 or more: 1 head; 2 (minim): 2; 1 or 0 (semibreve, breve): 4), each copy placed edge to edge with engine.multinotePadding staff spaces between them (staff space = staff.semitonesPerStaffSpace semitones, or axis.unitsPerStaffSpace axis units under a pitch axis), the group centred on the head position. The stem attaches as LilyPond's relative stem-attachment does, at the anchor's relative position across the whole group's width, and the ledgers and column widen by the group's extra width. Shape mode is unchanged and byte-identical: the shape-mode preview-baseline probes stay pinned, and only the two repeat-mode probes (kite-4-369, 45deg-369, which render minims) are re-captured. An engine-backed test (skipping without LilyPond) engraves the Kite and 45deg-369 exports at minim, semibreve and breve and checks that the engraved notehead group's width matches the preview's group width within 5%. The key-signature panel and the preview's key selector each say when keys and the signature are enabled but no key is defined or none is selected, so nothing draws. The common-props editor's repeat-count text and its renderPreview legend state the counts the preview and engine actually use, and README "Preview-only settings", the architecture plan's open question 3 and the CHANGELOG 1.0.2 entry are updated.

**Amended after acceptance:**

- 2026-11-06 — step 'repeat-counts-text': its files: The common-props test page's intro describes the old repeat-mode preview (single base row); it changes with renderPreview (claude-code (anthropic, claude-opus-5-5))
