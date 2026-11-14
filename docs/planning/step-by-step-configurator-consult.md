# The step-by-step Configurator — cross-provider consult

**Date:** 2026-11-13 (session 61).
**Subject:** the design
[`step-by-step-configurator-design.md`](step-by-step-configurator-design.md)
and its mock-ups ([`step-by-step-mockups/`](step-by-step-mockups/)), from the
operator's outline in `docs/uat-status.md` (session 57, item 5) and the
session plan's session 61 section.

## How it was run

One identical brief (reproduced at the end) went to two models, in one call
each, at the same time, from a script kept outside the tracked tree, with the
API keys from the environment. The brief carried the operator's outline, the
whole first draft of the design, nine questions, and three of the mock-ups'
screenshots as images (`shots/steps-1440.png`,
`shots/key-signature-steps.png`, `shots/tutorial-notation.png`, as first
drawn, with "Hollow for minims only" in the notehead panel and folding group
headings).

- **Sol:** `gpt-6.1-sol` (OpenAI, reasoning effort high).
- **Argon:** `gemini-4-argon` (Google).

Both replies are reproduced verbatim below.

## Synthesis

Both approve the direction: numbered steps in groups with free navigation, one
registry, the tutorial as the golden path, the importer normalising at import,
AI-assisted designing after 1.1.0. Where they add to it, the design takes it
(its §13 lists each change):

| # | Point | Sol | Argon | Decision |
|---|---|---|---|---|
| 1 | Group headings | static, not folding | static, not folding | Taken (§2.1). |
| 2 | Availability | §2.1 and §2.2 contradict; define once, Next/Back skip | — | Taken: the registry's `available`, steps 7–9 and 11 (§2.1, §4). |
| 3 | Next/Back far below a long canvas | keep them reachable | — | Taken: a sticky bar (§2.2). |
| 4 | Components | primary ownership, not one per step; pitch is not a crossing; shapes import must not wipe noteheads | same on pitch; merge shapes additively | Taken: shapes added by name, a conflict refused (§0, §1.2, §9.2). |
| 5 | Symbol type read back from the looks | fragile for legacy and mixed files; cards as starting points, a custom/mixed fallback, or a stored field; reset only what is needed | workable if step 7 is enabled by `looks.spelled`, but names the same legacy case | Taken Sol's: cards are starting points, highlighted only on an exact match; step 7 available for any other signature; Custom marks changes only the looks; no stored field (§3.1). |
| 6 | `alternate` over `looks.spelled` | test it cannot unexpectedly replace a chosen symbol | — | Stated and tested: it replaces only what it sets (§3.5, session 64). |
| 7 | Registry and test | data only, no editor import; test ids, numbers, Next/Back; hand-written stages | sufficient as it is | Taken (§4). |
| 8 | C hanging from the C♯ ledger | a learner will trip; explain it | a learner will trip; explain it | Taken: the tutorial's step 4 section shows B, C, C♯ and says why (§5). |
| 9 | Drawing as a prerequisite | let readers take the supplied SVG | — | Taken (§7.2). |
| 10 | "Hollow for minims only" in the notehead panel | must edit an ordinary rule, not duplicate it; scope unclear | scope unclear with five noteheads selected | Taken: "Hollow minims" on the canvas, for the whole notation, adding or removing one rule (§5.1). |
| 11 | Byte-for-byte JSON | exclude volatile fields; save main result before the optional pass; assert intermediate states | sound | Taken: dates left out, both halves of step 5 checked (§6). |
| 12 | The tutorial as one HTML page | test it on the site and opened locally | sound | Taken (§7.1). |
| 13 | The SVG subset | state it: coordinate systems, appearance, referenced content, metadata geometry, tolerance in destination units; reject what is unsupported; leave untransformed paths untouched | basic shapes, every transform kind, `z` resetting the current point | Taken, all of it (§8). |
| 14 | AI: partial import | partial structure, then whole-config validation; schemas out of the browser | cut the top-bar picker for parts | Taken (§9.1, §9.2). |
| 15 | AI: render-to-image | worth it if it reuses the UAT's path | cut it | Kept, reusing `cnb/uat/app-page.mjs`: the session plan asks for it (§9.4). |
| 16 | Session sizes | 62 mixes two concerns; 65 and 66 too big; checks for legacy files, availability, undo, keyboard, narrow widths; an operator try-out before "stable" | 65 is the largest; reuse the editor | Taken: sessions 62–69 (§10). |

## Sol (`gpt-6.1-sol`)

1. **Navigation: yes, with simpler grouping and consistent disabling.**  
   Keep numbers, short sidebar labels, full panel titles, and unrestricted navigation. Static group headings would be simpler than folding groups; all twelve steps already fit comfortably in the mock-up.

   Resolve one contradiction: §2.2 says only step 7 is conditional, but §2.1 also disables 8–9 when keys are off and 11 when the clef is off. Those are reasonable availability conditions, not enforced sequencing. Define them once and make both Next and Back skip unavailable steps.

   Keep Next/Back readily reachable: step 5’s long canvas currently pushes them far below the controls.

2. **Components: useful ownership groups, not independent or step-sized documents.**  
   Multiple steps intentionally edit the same component, and step 9 edits nothing. That is fine; revise the principle to “Each editing step has one primary component.”

   The pitch case is **not** cross-component: `staff` and `pitchAxis` already belong to the same component. Shared shapes are the real exception. A key-signature import must not replace the entire `shapes` section and thereby destroy noteheads. Specify a small, explicit policy for importing referenced shapes and handling ID conflicts, with validation and one undo transaction.

   Also, “Import this part” at Staff can replace ledger settings under the proposed component boundary. Name the component being imported and show the affected sections clearly.

3. **Key-signature model: the two fields are reasonable; type inference needs revision.**  
   `looks.spelled` is a small, compatible extension, and `columnGap: 0` preserves existing layout. Test enharmonic distinctions, partial spelled overrides, inherited look properties, and the interaction with `alternate`. In particular, confirm that `alternate` cannot unexpectedly replace an explicitly chosen custom symbol.

   The proposed type heuristic is not robust: legacy custom signatures need not contain spelled looks, and mixed accidental/custom looks can be misclassified. Treat the cards as **starting-point/reset actions**, not three exhaustive descriptions of every existing configuration. Use a conservative “Custom/mixed” fallback that preserves existing settings. If precise three-way state is essential to enabling step 7, a stored discriminator is safer than increasingly elaborate inference.

   Reset only the settings the choice needs to change; avoid silently resetting stacking and placement.

4. **Registry: sufficient for synchronisation, with two small additions.**  
   The proposed comparisons catch differences in IDs/order between stages and registry, and titles/order between tutorial and registry. They do not detect a coordinated change to all three—and need not.

   Keep an independently authored walk-through handler for each ID; do not manufacture `STAGES` from the registry and then compare them. Test unique IDs, contiguous numbers, and actual Next/Back destinations under the availability conditions. That is more valuable than adding a schema or generator for twelve registry entries.

   Keep the registry as data rather than having it depend on an editor module; classification can live in a small shared helper.

5. **Tutorial notation: visually coherent, but the ledger rule needs deliberate teaching.**  
   The diamonds, spacing and red pitch classes read clearly in the mock-up. The likely stumbling block is **C using the C♯ ledger rather than B’s ledger**. Show B–C–C♯ together and explain that this follows this notation’s octave-scoped ledger rule, not conventional ledger practice.

   The required path is already substantial. Keep the Inkscape/toolkit chapter available, but let readers use the supplied SVG to continue. Showing repeated heads before hollow minims adds another choice; make that a short experiment rather than a prerequisite.

   “Hollow for minims only” is a good shortcut **if it edits an ordinary rule**, not another setting. Define its selection scope, update/remove the existing rule rather than duplicating it, and show mixed or overridden states honestly. The finished tutorial image should also include the imported clef.

6. **Walk-through and tutorial: sound, provided determinism is explicit.**  
   Keep byte-for-byte `.ly` baselines where output is deterministic. For JSON, use deterministic serialization and IDs, or exclude only genuinely volatile metadata before comparison. Otherwise harmless timestamps or generated IDs will create maintenance noise.

   Save and compare the main result **before** the optional custom-symbol pass. Assert meaningful intermediate states, especially repeated heads followed by hollow minims; an end-of-step screenshot alone does not demonstrate both.

   Opt-in screenshot regeneration and one HTML page are good choices. Test it both through the assembled site and opened locally, using relative asset links. Screenshot capture is documentation production, not itself a visual correctness assertion.

7. **SVG import: normalising at import is the right boundary, but define a supported subset.**  
   Applying ancestor transforms and storing plain geometry avoids downstream complexity. Important gaps are:

   - **Coordinate systems:** nested `<svg>` elements, `viewBox`, `preserveAspectRatio`, and transform order—not just transformed groups.
   - **Appearance:** inherited styles, fill rules and compound holes. Transforming path coordinates alone does not preserve stroked artwork, especially under non-uniform scaling.
   - **Referenced or procedural content:** `<use>`, clipping, masks, filters, text and images. Support only what is needed; reject unsupported visible content clearly rather than silently producing a fragment.
   - **Metadata geometry:** transform hollow shapes, reference points and stem rectangles consistently. A rotated stem rectangle cannot automatically remain the same axis-aligned rectangle.
   - **Accuracy:** state the arc tolerance in the destination coordinate system. A large ancestor scale can magnify a nominal 0.01-unit error.

   Reject active/external SVG content. Test bounds against the artwork’s actual transformed extent, not merely its `viewBox`. To preserve existing canonical imports byte for byte, leave already-supported, untransformed paths untouched.

8. **AI assistance: keep it after 1.1; simplify the validation contract.**  
   Five component schemas are enough. Do not create twelve schemas merely because there are twelve steps. Preview-only step 9 needs neither an import button nor a config-generation prompt.

   Make the distinction between **complete components** and **partial section imports** explicit: a schema requiring every component section cannot also validate arbitrary subsets unchanged. Validate partial structure, merge into the current config, then run whole-config validation for references and other semantic checks.

   Keep `CNBConfig.validate` authoritative; do not build a general JSON Schema validator into the browser just for this feature. Development-only schema validation can test the published schemas.

   Headless Chromium rendering is worthwhile for agents, **if it reuses the existing UAT server and rendering path**. It is not worth creating a second renderer.

9. **Build programme: sensible dependencies, but several sessions are oversized.**  
   Session 62 combines a substantial SVG parser/geometry change with an unrelated notehead control. Separate them or move the minim shortcut into the UI work.

   Session 63 can introduce navigation and panel partitioning, but should not depend on the not-yet-implemented custom-symbol workflow. Then land and test the model before its editor, as planned.

   Session 65 is the largest UI risk: selection, mixed-value editing, imports, dragging and 105-key preview deserve separate acceptance checkpoints. Session 66 should likewise establish the fixtures and passing walk-through before writing and capturing the final tutorial.

   Add explicit acceptance checks for legacy custom files, conditional navigation, undo after preset changes/imports, keyboard operation of canvas selections, and narrower layouts. Leave an operator-UAT/fix interval before declaring stability and releasing; “all automated tests pass” is not that declaration.

### Recommendation

**Approve the overall direction, subject to three revisions before implementation:**

- Describe components as ownership/import units and settle shared-shape import behaviour.
- Replace the fragile symbol-type heuristic with a preservation-safe preset/classification policy.
- Bound SVG support explicitly and give its implementation a focused session.

Keep numbered, freely accessible steps, a single registry, the tutorial golden path and the existing rendering/export machinery. Defer AI tooling to 1.2. The design does not need another architectural layer; it needs these few behavioural contracts made precise.

## Argon (`gemini-4-argon`)

1. **The navigation (§2):** Right as designed. Grouped, numbered, non-enforced steps with Next/Back give first-time users a clear path while letting returning users jump directly to any step. Short labels in the sidebar under group headers avoid visual clutter (`Symbol type` under `KEY SIGNATURE` is cleaner than repeating `Key signature` four times). One minor simplification: with only 12 items that all fit above the fold at 1280px and 1440px, collapsible group carets (`▾`) are unnecessary—keep the group headers static.

2. **The step boundaries and components (§1.2):** Yes, the 5-component division is clean, and the two cross-boundary cases are acceptable. Step 3 (`Pitch`) and Step 2 (`Staff`) both belong to the `staff` component anyway. Step 7 adding imported custom key-signature symbols to `shapes` is the only true cross-component write; just ensure that `keySignature.schema.json` and "Import this part…" for `keySignature` accept an optional `shapes` dictionary and merge its entries additively (rather than wiping existing notehead shapes).

3. **The key signature (§3, §3.5):** `looks.spelled` + `columnGap` + the built-in `parallelogram` is the smallest model that satisfies the requirements and preserves backward compatibility. Reading the symbol type back heuristically is fine, with one edge case to guard against: if a user selects **Custom marks** (populating `looks.spelled` with 21 parallelograms) and then in Step 7 clicks "Select All" and sets the symbol to a single shape or removes overrides, the heuristic might still work, *unless* they clear `looks.spelled` or if a legacy config uses `looks.line`/`looks.space` without `looks.spelled` (which would read back as `Noteheads`, leaving Step 7 disabled). Since Step 6's Custom Marks seeds all 21 keys in `looks.spelled`, `Object.keys(looks.spelled || {}).length > 0` is a reliable check, provided Step 7 always writes to `looks.spelled`.

4. **The step registry and its test (§4):** Simple, zero-dependency, and completely sufficient. Exporting `CNBSteps` as a single source of truth and asserting 1:1 alignment against DOM sidebar rendering, `STAGES` in `uat-tutorial.mjs`, and `<h2>` headings in `tutorial/index.html` guarantees nothing drifts.

5. **The tutorial notation (§5):** The notation is visually distinctive and exercises every step well. One thing a learner *will* trip on: in Step 4, why C (semitone 12, the octave boundary) hangs below the C♯ ledger (13) instead of sitting above the B ledger (11). Make sure either Step 4's UI hint or the tutorial text explicitly explains that ledger lines are scoped to a single octave `[0..11]`, so C (0 of the new octave) cannot use B (11 of the previous octave). "Hollow for minims only" (§5.1) is the right pragmatic fix to keep beginners out of Advanced; just ensure it applies cleanly to all noteheads or the active selection without confusing the user if only 5 sharp notes are currently selected (as in the mock-up).

6. **The walk-through and tutorial (§6, §7):** Very sound. Single static HTML file served identically in repo and site avoids build steps; opt-in screenshot regeneration (`CNB_UAT_TUTORIAL_SHOTS`) keeps git clean during normal `npm run uat` runs; byte-for-byte `.json` and `.ly` comparison catches accidental regressions immediately.

7. **Importing a hand-drawn SVG (§8):** Normalising paths to absolute `M/L/C/Z` with composed ancestor transforms at import time is the right architecture—it keeps the runtime config, canvas renderer, and LilyPond exporter simple. Watch for three SVG gaps from Inkscape:
   - **Basic shapes:** Inkscape users often draw `<rect>`, `<circle>`, `<ellipse>`, or `<polygon>` without "Object to Path". Convert these to `<path>` strings before normalising (or fail with a clear message telling them to convert to path).
   - **Transform types:** Support full 2D affine matrices (`matrix`, `translate`, `scale`, `rotate(a, cx, cy)`, `skewX`, `skewY`), as Inkscape frequently writes `matrix(...)` on layers and groups.
   - **Subpath closing (`Z`/`z`):** Ensure `z` resets the current point to the initial point of the *current subpath*, so subsequent relative `m` commands start from the right coordinates.

8. **AI-assisted designing (§9):** Deferring to 1.2.0 is wise. When you build it, consider cutting two things to prevent over-engineering:
   - Cut the section-picker modal on top-bar `Open…` for partial configs; keep top-bar `Open…` strictly for full configs and use the step-level `Import this part…` for partial configs.
   - Cut `cnb.mjs render` (headless Chromium via Playwright) unless an AI agent actively needs it in CI; `uat-*.mjs` already takes screenshots, and maintaining a separate CLI argument parser for canvas rendering adds maintenance surface for marginal gain. `validate` and `export` in pure Node are fast and sufficient.

9. **The build program (§10):** The session order (62 → 67) is logical and each session has clear boundaries. Session 65 (Steps 6–9 UI, 21-note canvas, multi-select, drag-to-gap, 105-key preview) is the largest session; keep it manageable by reusing existing `key-signature-editor.js` rendering and look-card logic via mode flags rather than rewriting components.

---

### Recommendation

**Approve the design for implementation across Sessions 62–67, with AI-assisted features deferred to 1.2.0.** Keep the sidebar groups non-collapsible, handle basic SVG shapes and full matrix transforms in Session 62's SVG normaliser, ensure "Hollow for minims only" acts globally across pitches (or clearly indicates scope) in Step 5, and keep the 1.2.0 CLI limited to pure-Node `validate` and `export`.

## The brief

As sent, verbatim, with the first draft of the design in it (since revised; see its §13). The three screenshots were attached as images.

~~~~markdown
## Consult: the step-by-step Chromatic Notation Configurator

### Context

The Chromatic Notation Configurator is a browser tool (vanilla ES modules, no
build step, no runtime dependencies) for designing chromatic staff notations:
staff lines, ledger lines, notehead shapes and colours, a key signature and a
clef, previewed on a canvas and exported as a LilyPond configuration that an
engine (a separate repository) engraves. The operator tried the app and found
the key-signature designer too complicated; they want the whole Configurator to
read as a sequence of steps. Their outline, verbatim:

5. **The key-signature designer is too complicated** (*planned*: session 61
   designs it with mock-ups, then the sessions it plans). The operator's
   outline, as steps:
   - **a. The kind of mark**: noteheads, accidentals or custom marks.
     Noteheads show in a designer like the notehead designer, with entries
     for flats too. Accidentals appear where sharp and flat noteheads would
     have been, naturals perhaps shown partly dimmed elsewhere. Custom
     marks start as parallelograms 2 semitones high and 4 wide.
   - **b. Custom marks**: on a canvas like the notehead canvas, select one
     or more spelled notes (multi-select, as for noteheads, but with sharps
     and flats both) and replace their parallelograms with imported
     symbols, tails included. That is 21 entries, the 7 letters each
     natural, sharp and flat (E♯, B♯, C♭ and F♭ included); their spacing may
     need tightening, which the magnified designer allows. Clairnote's
     signature takes six symbols (a solid and a hollow dot, each plain, with
     a tail up and with a tail down), which keeps the variables to support
     fewer than separate tails would.
   - **c. The magnified designer**: the stacking, the spacing between
     columns, and whether the gold stem between the stacks is drawn, and
     its style.
   - **d. The preview**: every key, tonic and mode, to see the results.

   The whole-staff canvas at the top of the page is not needed in these
   steps: the canvas of step b takes its place. The operator sees the whole
   Configurator as a sequence of steps: Notehead height, Staff, Pitch,
   Ledger lines, Noteheads, Key signature symbol type, Custom key signature
   symbols (only enabled when needed), Key signature designer (c), Key
   signature preview (d), Clef symbol import and sizing, Clef
   semitone/staff assignment. They want that sequence designed in the same
   session as the key-signature designer, considering groupings in the
   navigation panel (as `darndestdabbler/uat-checklist-editor` has) and
   whether the steps should be numbered, or enabled in turn, to suggest or
   enforce their order.



They also asked for: one tutorial notation of the project's own, built from
the default config to an exported .ly; a Playwright walk-through that builds it
one stage per step as the stepped UI's golden-path UAT; a tutorial with the
walk-through's screenshots; the SVG importer applying ancestor transforms so a
file straight from Inkscape imports where it was drawn; and AI-assisted
designing (a schema per step's config component, partial import at a step, a
prompt per step, command-line validate/export/render). Over-engineering is
strictly forbidden: the value of a design is measured as much by its
simplicity and clarity as by its fit to the requirements.

The design follows in full. Three screenshots of the mock-ups are attached:
(1) the stepped app at 1440 px, step 5 open; (2) the key-signature steps 6-9;
(3) the tutorial notation.

---

# The step-by-step Configurator: design

**Date:** 2026-11-13
**Status:** Design for the operator's approval (session 61). No code
changes. The sessions that build it are planned in §10 and numbered in the
session plan once this design is approved.
**Why:** The operator's try-out in session 57 (`docs/uat-status.md`,
"Trying sessions 43–56", item 5): the key-signature designer is too
complicated, and the Configurator should read as a sequence of steps. The
operator's outline, in their words, is the basis of §1–§3. They also asked
for one notation to be built from start to finish, as a tutorial, a
walk-through that builds it as the stepped UI's golden-path UAT, and a way
for an AI to design one step at a time (session plan, session 61).
**Mock-ups:** [`step-by-step-mockups/`](step-by-step-mockups/), drawn with
the real `cnb/src` modules (§11).

---

## 0. Principles

1. **A step edits one part of the config.** Each step writes one
   component (§1.2), so a step is also the unit a schema describes, a
   partial import replaces and an AI prompt asks for (§9).
2. **The order is suggested, not enforced.** The steps are numbered and
   each has Next and Back, but every step can be opened at any time, since
   a designer who opens a finished file wants to go straight to the step
   they mean to change (§2).
3. **The config grows as little as it can.** Two fields are added, both
   in the key signature (§3.5); everything else the steps write exists
   today. A config saved before this design loads, previews and exports
   exactly as before.
4. **No engine change.** The mark table (LY spec §5.6a) already carries
   any head or symbol at any column, so the key-signature steps export
   through it.

---

## 1. The steps

### 1.1 The sequence

The operator's sequence, numbered, in groups (§2). The name in bold is the
step's title everywhere: the navigation, the panel's heading, the
walk-through's stage and the tutorial's section (§4).

| # | Step | Group | Edits | The canvas shows |
|---|---|---|---|---|
| 1 | **Notehead height** | The staff | every notehead's height (the rules, as today) | the whole staff |
| 2 | **Staff** | The staff | `staff` | the whole staff |
| 3 | **Pitch** | The staff | `staff.midpoint`, `pitchAxis` (nudges) | the whole staff, its labels draggable |
| 4 | **Ledger lines** | The staff | `ledgers` | the whole staff, the ledger spots marked |
| 5 | **Noteheads** | Noteheads | `shapes`, `noteheadRules`, `durations` | the whole staff; a click opens the notehead panel |
| 6 | **Key signature symbol type** | Key signature | `keys.enabled`, `keys.keySignature` (the starting point) | the 21 spelled notes (§3.2) |
| 7 | **Custom key signature symbols** | Key signature | `keys.keySignature.looks.spelled`, `shapes` | the 21 spelled notes, selectable |
| 8 | **Key signature designer** | Key signature | `keys.keySignature` (stacking, columns, gold stem, place) | the picked key's signature, magnified |
| 9 | **Key signature preview** | Key signature | nothing (a view) | every key and mode (§3.4) |
| 10 | **Clef symbol import and sizing** | Clef | `clef.glyphs`, `clef.active`, `clef.enabled` | the clef, enlarged, with its anchor point |
| 11 | **Clef semitone/staff assignment** | Clef | the active glyph's `anchorSemi` | the whole staff with the clef |
| 12 | **Export** | Finish | `meta` | the whole staff |

**Advanced** stays below the numbered steps, unnumbered, as today: the
rules for particular durations or keys, durations and engine, the pitch
axis map, the pitch range shown, and the file as JSON. The key definitions
("Keys for notehead rules") move there from the key-signature panel,
since they serve notehead rules, not the signature.

Step 7 is enabled only when step 6's choice is custom marks (operator:
"only enabled when needed"). Otherwise it is shown greyed, with the
reason: "Choose Custom marks in step 6 to design your own symbols."

### 1.2 The components

The steps fall into five components, the units of §9:

| Component | Config sections | Steps |
|---|---|---|
| `staff` | `staff`, `ledgers`, `pitchAxis` | 2, 3, 4 |
| `noteheads` | `shapes`, `noteheadRules`, `durations` | 1, 5 |
| `keySignature` | `keys` (and the shapes its looks name) | 6, 7, 8 |
| `clef` | `clef` | 10, 11 |
| `meta` | `meta` | 12 |

Two steps reach across a boundary today and keep doing so, as their
results require: renaming a pitch in step 3 rewrites the staff pattern
with its middle (it is in `staff` already), and an imported key-signature
symbol is a shape (step 7 adds it to `shapes`, as the key-signature editor
does today). `display` and `engine` belong to no step; Advanced edits
them.

### 1.3 Where today's panels go

| Today | The stepped UI |
|---|---|
| The seven sections and Advanced, Export | steps 1–5, 12 and Advanced, unchanged inside |
| Key signature: Show and Start from | step 6, Start from gaining Custom marks |
| Key signature: Edit (the layers) and the look card | step 7: the layers become a Select row over the 21 spelled notes (§3.3); the look card stays, applied to the selection |
| Key signature: the canvas, its key picker and the mode's 15 keys | step 8's canvas and key picker; the 15 keys move to step 9, for all 7 modes |
| Key signature: Notes, Stacks, Place, the gold stem | step 8 |
| Key signature: Keys for notehead rules | Advanced |
| Clef: the four buttons, Import, the anchor picker, the height | step 10 |
| Clef: Sits on semitone and the canvas drag | step 11 |

The editors' code stays where it is (`cnb/ui/key-signature-editor.js`,
`cnb/ui/clef-editor.js`); each gains an option naming the part it draws,
so one editor serves two or three steps rather than being split.

---

## 2. The navigation panel

### 2.1 What it looks like

The sidebar lists the steps under their group headings, as the UAT
checklist editor (`darndestdabbler/uat-checklist-editor`) lists areas and
subareas: a group heading that folds, and its steps beneath it. Each step
shows its number, its title and, on the open step, a highlight.

```
THE STAFF                 ▾
  1  Notehead height
  2  Staff
  3  Pitch
  4  Ledger lines
NOTEHEADS                 ▾
  5  Noteheads
KEY SIGNATURE             ▾
  6  Symbol type
  7  Custom symbols        (greyed unless custom marks)
  8  Designer
  9  Preview
CLEF                      ▾
 10  Symbol and size
 11  Placement
FINISH                    ▾
 12  Export
──────────────
     Advanced
```

The sidebar uses short labels inside a group (the group heading supplies
"Key signature" and "Clef"); the step's own heading uses the full title of
§1.1. Both come from the registry (§4).

A group folds when its heading is clicked; the open step's group cannot be
folded. With keys off, the Key signature group shows steps 7–9 greyed with
step 6 open to turn the signature on; with the clef off, step 11 is greyed
the same way. Nothing else is ever disabled.

### 2.2 Numbered, or enabled in order

The operator asked whether the steps should be numbered, or enabled in
turn, to suggest or enforce their order. **Recommendation: number them,
add Next and Back, and enforce nothing** beyond step 7's condition:

- Numbers and Next/Back suggest the order to a first-time designer as
  strongly as a wizard would.
- Every step's result can be changed later, and a designer who opens a
  finished notation, the gallery's included, needs to go straight to step
  8 without passing 1–7. Enforcing the order would stand in their way and
  gain nothing, since no step's controls are invalid before another's.
- Next on the last step of a group opens the next group's first step;
  Next on step 6 skips step 7 when it is greyed.

Each step's panel ends with a bar: "Back: 5 Noteheads" on the left, "Next:
7 Custom key signature symbols" on the right, the names from the registry.

---

## 3. The key-signature steps

The whole-staff canvas is hidden in steps 6–9 (operator: "The whole-staff
canvas at the top of the page is not needed in these steps"): each step
has its own canvas in its place.

### 3.1 Step 6: Key signature symbol type

"Show a key signature" (today's Show, which sets `keys.enabled` and
`keySignature.enabled`), then three choices, each a card with its picture:

- **Noteheads** — the scale as the notation's noteheads (today's default,
  Start from the noteheads). "Noteheads show in a designer like the
  notehead designer, with entries for flats too": the canvas below draws
  the 21 spelled notes as their noteheads.
- **Accidentals** — LilyPond's sharps and flats (today's Start from
  traditional sharps and flats). "Accidentals appear where sharp and flat
  noteheads would have been, naturals perhaps shown partly dimmed
  elsewhere": the canvas draws a sharp at each sharp, a flat at each flat,
  and the naturals' noteheads at 30% opacity.
- **Custom marks** — "Custom marks start as parallelograms 2 semitones
  high and 4 wide": choosing it writes a parallelogram for each of the 21
  spelled notes (§3.5) and enables step 7.

The choice is today's Start from, given a third starting point: it
replaces the signature's settings, asks first, and Undo puts them back.
The step reads the current choice back from the config (a sign as the
flats' or sharps' look and the altered notes only is Accidentals; any
spelled look is Custom marks; anything else is Noteheads), so no field
records it.

### 3.2 The 21 spelled notes

Steps 6 and 7 draw one canvas: the 7 letters across, each in three rows,
flat, natural and sharp (C♭ to B♯, E♯, B♯, C♭ and F♭ included), each mark
drawn with its look at the key signature's size, on its pitch's line or
space of a two-line strip of the staff, so a dot that is solid on a line
and hollow in a space shows that way. A mark's label (C♯, D♭) is beneath
it. The operator noted their spacing "may need tightening, which the
magnified designer allows": the canvas is magnified, 24 px a semitone as
the key-signature editor's is today.

### 3.3 Step 7: Custom key signature symbols

"On a canvas like the notehead canvas, select one or more spelled notes
(multi-select, as for noteheads, but with sharps and flats both) and
replace their parallelograms with imported symbols, tails included."

- **Selecting.** A click selects a spelled note, Shift+click or Ctrl+click
  adds one, as on the notehead canvas. A Select row above the canvas
  selects in one click what today's layers name: All, Naturals, Flats,
  Sharps, On a line or ledger, In a space.
- **The look card** is today's (`cnb/ui/key-signature-editor.js`): the
  symbol (the notation's shapes, the built-in shapes, the parallelogram,
  LilyPond's sharp and flat, or Import from SVG with its reference point
  and Takes ledger lines), fill, colour, size, offset and the added
  symbols, applied to every selected spelled note. A field the selection
  disagrees on shows "mixed".
- **Clairnote** "takes six symbols (a solid and a hollow dot, each plain,
  with a tail up and with a tail down), which keeps the variables to
  support fewer than separate tails would": each spelled note is given one
  of the six as its symbol, the dot solid where its pitch is on a line and
  hollow where it is in a space, the tail up on a flat and down on a sharp.
  The Clairnote SN and DN gallery files are redrawn so (§10, session 64),
  and draw and export as they do now.

### 3.4 Step 8: Key signature designer, and step 9: Key signature preview

**Step 8** is "the stacking, the spacing between columns, and whether the
gold stem between the stacks is drawn, and its style", on today's magnified
canvas with its key picker:

- **Notes** and the upper tonic, as today.
- **Stacks**: the stacking rule, the columns' direction, every second
  stack's look (today's alternate, the one layer that is about stacks),
  and the spacing between columns, `columnGap` (§3.5): a number of
  semitones added between neighbouring columns, negative to tighten them,
  also set by dragging the second column on the canvas.
- **Gold stem**: drawn or not, its colour and thickness, and shared or not,
  as today.
- **Place**: middle, bottom, top or every line set, as today.

**Step 9** draws every key, tonic and mode: the 7 modes as rows, each with
its 15 spellings, sharp keys then flat keys, as small signatures. A key
whose marks touch is outlined with its count, as today, and a click on a
key opens it in step 8. A line above says in how many of the 105 keys the
marks touch.

### 3.5 What the config gains

Two fields, in `keys.keySignature`:

- **`looks.spelled`**: a map from a spelled note (`"C"`, `"C♯"`, `"D♭"` …,
  the 7 letters each natural, sharp and flat, written as
  `CNBMusic.spellings` writes a tonic) to a look of today's form
  (shape or sign, hollow, colour, size, offset, added). It is laid over
  the line and space looks and under `alternate`, so the laying order is:
  the notehead's own, all, natural/flat/sharp, line/space, **spelled**,
  alternate. Missing or empty, nothing changes.
- **`columnGap`**: semitones (axis units under a pitch axis) added between
  neighbouring columns, 0 by default; validation takes a finite number and
  warns when columns would cross.

A built-in shape is added, **`parallelogram`**: 2 semitones high, 4 wide,
leaning right, solid, taking no ledger lines, in `cnb/ui/builtin-shapes.js`
beside the others.

`CNBKeySignature.marks` resolves the new layer and the gap, the mark table
writes what it gives, and the five export baselines are unchanged. No LY
spec section changes: the table's format stays §5.6a's. The architecture
plan's §4.9 gains the two fields.

---

## 4. The step registry

One module, `cnb/ui/steps.js`, lists the steps, and the navigation, the
step panels' Next and Back, the walk-through (§6) and the tutorial (§7)
read it:

```javascript
export const CNBSteps = [
  { id: "notehead-height", number: 1, group: "The staff", label: "Notehead height",
    title: "Notehead height", component: "noteheads", canvas: "staff" },
  { id: "staff", number: 2, group: "The staff", label: "Staff",
    title: "Staff", component: "staff", canvas: "staff" },
  // … one entry per row of §1.1
  { id: "ks-custom-symbols", number: 7, group: "Key signature", label: "Custom symbols",
    title: "Custom key signature symbols", component: "keySignature", canvas: "spelled",
    enabled: (config) => CNBKeySignatureEditor.symbolType(config) === "custom",
    disabledReason: "Choose Custom marks in step 6 to design your own symbols." },
  // …
];
```

`id` is the panel's `data-panel` and the walk-through's stage name;
`label` is the sidebar's; `title` is the panel heading and the tutorial's
section heading; `component` names §1.2's unit; `canvas` says what the
canvas area shows ("staff", "spelled", "designer", "keys", "clef").
`enabled` is given only where a step can be greyed.

**The test that fails on a renamed or reordered step**,
`cnb/tests/cnb-steps-tests.js`:

- the navigation built from the registry (in Node, against the stub
  document) lists the steps in its order with its labels and numbers;
- the walk-through's stages (it exports them as a list, `STAGES`, read by
  the test without starting a browser) are the registry's ids in its
  order;
- the tutorial's step sections (its `<h2>` headings, read from the file)
  are "N. title" for every step, in the registry's order.

A step renamed in the registry and not in the tutorial or the walk-through,
or reordered in one of them only, fails it.

---

## 5. The tutorial notation

One notation of the project's own, built from the default config to an
exported `.ly`. Each item is the step that sets it.

1. **Notehead height**: 2 semitones, one staff space of the staff below.
2. **Staff**: lines at 3, 5, 7 and 9 in each octave (E♭, F, G, A), so 2
   semitones a staff space and a gap of 6 semitones from A to the next
   E♭; the middle stays C (12).
3. **Pitch**: no change; the step is shown and its middle confirmed as C.
4. **Ledger lines**: two ledgers in the gap, at B (11) and C♯ (13). B
   takes the B ledger; C♯ takes the C♯ ledger, and C hangs below it (a
   ledger answers only to notes in its own octave, so C, in the octave
   above B's ledger, takes the C♯ one). A♯ and D sit in the spaces beside
   the staff and take none.
5. **Noteheads**: a diamond about 1.5 times as wide as tall (2 semitones
   tall, 3 wide), drawn by the reader in Inkscape and run through the
   Music Glyph Toolkit's Notehead mode with its hollow and stem rects
   (§7.2), imported. C♯, D♯, F♯, G♯ and A♯ red (`#cc0000`), the rest black.
   **Minims as repeated heads first** (the canvas's "Repeat the notehead",
   at the default overlap of a third), **then switched to hollows**: the
   choice set back to each duration's own look, and the minims made hollow
   with the notehead panel's fill for the minim (§5.1).
6. **Key signature symbol type**: Noteheads.
7. **Custom key signature symbols**: skipped (greyed), except in the
   optional section below.
8. **Key signature designer**: Clairnote's stacks (stacking
   "parity-stacks", a new stack at each change of parity), the gold stem
   drawn. The tutorial credits the design: "Stacked signatures after
   Clairnote, by Paul Morris (clairnote.org), CC BY-SA 4.0; the idea only,
   no code."
9. **Key signature preview**: every key looked at, G major and E♭ major
   picked as examples.
10. **Clef symbol import and sizing**: the operator's own C clef,
    imported from `c-clef.svg` (the operator's `D:\sample-c-clef.svg`,
    checked in with its leftover font style removed, §8), its anchor point
    picked at its left middle (the left edge of its box, half way up), at
    the automatic size.
11. **Clef semitone/staff assignment**: the anchor on middle C, the staff's
    C at semitone 12.
12. **Export**: named "Tutorial 3-5-7-9", file suffix `-Tutorial3579`, the
    `.ly` downloaded.

**Optional section: a custom key-signature symbol.** The reader draws a
second diamond, twice as wide as tall (2 semitones tall, 4 wide, the
parallelogram's size), runs it through the toolkit the same way, chooses
Custom marks in step 6, selects All in step 7 and imports it as the
symbol of every spelled note, then tightens the columns in step 8 with
the column spacing. The walk-through runs this section after the main one
(§6) and exports it as a second file.

### 5.1 Hollow minims from the notehead panel

Today a hollow minim needs a rule for particular durations, in Advanced.
The tutorial's switch should not send a first-time reader there, so the
notehead panel gains one control: while the canvas shows minims and each
duration has its own look, the panel's Fill row offers "Hollow for minims
only", which writes the same duration-scoped rule Advanced writes
(`match.durations: ["minim"]`, `apply.hollow: true`), and the rule list
names it. Session 62 builds it (§10).

---

## 6. The walk-through

`cnb/uat/uat-tutorial.mjs`, a Playwright driver like the others
(`cnb/uat/app-page.mjs` serves and opens the app), builds §5's notation
from the default config, one stage per registry step, in the registry's
order, and saves a screenshot at the end of each:

- **Stages.** `export const STAGES = ["notehead-height", "staff", …]`, the
  registry's ids (§4's test holds them equal). Each stage opens its step
  from the sidebar, does what §5 says for it through the controls a reader
  uses (typing, clicking, file choosers, the canvas drags), checks the
  result on the page and in the live config, and screenshots the main
  area as `NN-<id>.png`. Step 7's stage checks the step is greyed, with
  its reason.
- **The optional section** runs as a second pass of stages 6–8 and 12,
  `07-ks-custom-symbols-optional.png` among its shots.
- **Fixtures.** It imports the finished SVGs, `diamond.svg`,
  `diamond-wide.svg` and `c-clef.svg`, checked in as the tutorial's
  downloads (§7.1) and made by following the tutorial (§7.2). It compares
  each exported `.ly` with the checked-in `tutorial.ly` and
  `tutorial-custom.ly`, and the saved config with `tutorial.json`, byte for
  byte, so a change that alters the tutorial's result fails until the
  downloads are regenerated on purpose.
- **Screenshots.** Into a temporary directory by default, so the UAT suite
  leaves the tree as it was; into the tutorial's `shots/` when run with
  `CNB_UAT_TUTORIAL_SHOTS=docs/playbook/tutorial/shots`, which is how the
  tutorial's pictures are refreshed.
- **Its place in the suite.** It is the stepped UI's golden-path UAT and
  runs in `npm run uat` with the others. `uat-golden-path.mjs` stays, for
  the save, load and export parity checks it makes.

---

## 7. The tutorial

### 7.1 Where it lives

One HTML page, `docs/playbook/tutorial/index.html`, with its pictures in
`shots/` and its downloads in `downloads/` beside it. On the site it is
`/tutorial/`: `cnb/site/assemble-site.mjs` copies the folder as it is, so
the links work in both places, and the app's header links to it. The
README and the notation-builder playbook link to it.

It is HTML rather than Markdown because the site has no build step and
nothing on it converts Markdown; one file read in both places needs no
copy kept in step. In the repository it reads as a page opened locally.

### 7.2 Its sections

- **Before you start**: what the tutorial builds (§5, with the finished
  notation's picture), Inkscape and the Music Glyph Toolkit installed, the
  downloads.
- **Drawing the notehead** (the notehead-drawing chapter): start from flat
  ovals for the head and the hollow (a rounded rectangle also serves for
  the hollow); group them, rotate the group, and ungroup it, so the hollow
  keeps its place inside the head; for the diamond, a square and a smaller
  rounded square rotated 45° and stretched to 1.5 times as wide; draw the
  stem rects; run the toolkit's Notehead mode with a semitone height of 2.
  Where the reference point goes: on the head's visual centre, which for a
  symmetric shape like the diamond is its middle, the default, and for a
  lopsided one its centre of mass; it is picked in step 5 after the
  import, and the staff lines stay where they are.
- **One section per step**, headed "N. title" in the registry's order and
  words (§4), each with what the step is for, what to do in it for this
  notation, and the walk-through's screenshot.
- **Optional: a custom key-signature symbol** (§5), with its two
  screenshots.
- **Engraving it**: the exported `.ly` with a short score, through the
  engine, as the README describes.

The tutorial is written in session 66 (§10), after the walk-through has
produced the screenshots and fixtures it shows.

---

## 8. Importing a hand-drawn SVG

A file saved straight from Inkscape does not import where it was drawn.
The operator's clef shows both reasons:

- **Ancestor transforms.** Its paths sit in a layer with
  `transform="translate(-162.76,-166.10)"`. The importer reads a stem
  rect's own transform but no group's or layer's (`cnb/ui/svg-importer.js`
  says so in its header), so the glyph lands far from its viewBox.
- **Path commands.** Its paths use relative commands (`m`, `l`, `h`, `c`)
  and arcs (`a`), which the path conversion skips
  (`CNBNotehead.svgCommands` reads absolute M, L, H, V, C and Z only), so
  the export would draw a fragment of it. The preview, which draws the
  `d` attribute as SVG, would look right, and the engraving would not.

The fix, in the importer and nowhere else: each imported path's `d` is
normalised once, at import, to absolute M, L, C and Z (relative commands
made absolute, H and V as lines, S, Q and T as cubics, each arc as the
cubics that approximate it within 0.01 SVG units), with the composed
transform of the path and all its ancestors up to the root applied to
every point. A stem rect's transform composes with its ancestors' too.
What the config stores is then plain absolute geometry, so the preview,
the export, the box and the key signature read it as they read toolkit
output, and nothing downstream changes. Toolkit output, already absolute
and untransformed, imports byte for byte as before.

This is session 62 (§10), which also checks the operator's clef in as
`docs/playbook/tutorial/downloads/c-clef.svg`, its leftover style
properties removed.

---

## 9. AI-assisted designing

Built at 1.2.0, in the session the plan calls "Published schemas and
partial configs", unless the operator moves it (§12). It rests on the
components of §1.2.

### 9.1 The schemas

One JSON Schema for each component (`staff`, `noteheads`,
`keySignature`, `clef`, `meta`) and one for the whole config, draft
2020-12, versioned with the config (`version` 1.0 → `v1`):
`cnb/schemas/v1/<component>.schema.json` and `config.schema.json`, copied
to the site at `/schemas/v1/…` by `assemble-site.mjs`, so each has a stable
address. A component schema describes an object whose properties are its
config sections (`{ "staff": …, "ledgers": …, "pitchAxis": … }`). Each
schema states the checks a schema can state (types, ranges, enumerations,
required fields); the checks that need the whole config (a rule naming a
shape that does not exist) stay `CNBConfig.validate`'s.
`cnb/tests/cnb-schemas-tests.js` holds the schemas and
`CNBConfig.validate` to the same answer for every fixture, every gallery
config and a set of bad samples, for what both can judge.

### 9.2 Partial import at a step

Each step's panel gains **Import this part…**, beside Next: a JSON file
holding the step's component (or any of its sections). Before anything
changes it says what will change, section by section ("Staff lines: 4, 8 →
3, 5, 7, 9 · Ledger lines: 3 → 2 templates"), then on Replace merges it
over the config (each named section replaced whole), validates the result
as any opened file is validated, and records it as one step of undo. A
file holding sections of another component is refused, naming them. Open…
in the top bar accepts a partial config too, and asks which sections to
take.

### 9.3 A prompt per step

The AI-assisted workflow guide (`docs/playbook/ai-assisted-workflow.md`)
reorganises its Part 3 into one prompt per step, in the registry's order
and words: what to describe, the schema's address to give the AI, and how
to bring the answer back (Import this part… at that step). Today's
templates 3.2–3.6 become steps 2, 4, 5 and 6–11; 3.1, 3.7 and 3.8 stay as
they are. Each step's panel links to its prompt.

### 9.4 The command line

For an agent working in the repository, `node cnb/cli/cnb.mjs`:

- `validate <config.json> [--component <name>]` — `CNBConfig.validate`,
  or the component's schema for a partial file; errors and warnings
  printed, exit 1 on an error.
- `export <config.json> [-o out.ly]` — `CNBLilypond.generate`.
- `render <config.json> -o out.png [--durations crotchet,minim] [--key G]`
  — the card collection drawn in headless Chromium through
  `playwright-core`, found as the UAT finds it, so an agent sees what the
  canvas shows.

Engraving the `.ly` stays the engine's, through the export → render →
diff loop the guide already describes (3.8).

---

## 10. The build sessions

Each session ends with the unit tests (`node cnb/tests/run-tests.js`) and
the whole UAT (`npm run uat`) passing, as every session does.

**Session 62: Importing a hand-drawn SVG, and hollow minims.** §8's
normalisation in `cnb/ui/svg-importer.js` (path and ancestor transforms,
relative commands, arcs), for noteheads, clefs and key-signature symbols;
the operator's clef checked in as the tutorial's `c-clef.svg`; and §5.1's
"Hollow for minims only". *Checks:* `cnb-svg-importer-tests.js` (a
translated layer, nested groups, each command kind, an arc against its
sampled points, toolkit output unchanged byte for byte); an import of
`c-clef.svg` whose box matches the file's own drawn extent; the five
export baselines unchanged; `uat-clef-editor.mjs` importing `c-clef.svg`;
`cnb-notehead-panel-tests.js` for the fill control.

**Session 63: The steps and the navigation.** `cnb/ui/steps.js`; the
grouped, numbered sidebar built from it; Next and Back; step 7 greyed;
the key-signature and clef panels shown as their steps (§1.3), the canvas
area showing what the registry says; the key definitions moved to
Advanced. *Checks:* `cnb-steps-tests.js` (the navigation's part);
`uat-app-layout.mjs` and the drivers whose sections moved
(`uat-key-signature.mjs`, `uat-clef-editor.mjs`) updated to the steps.

**Session 64: The key signature's spelled looks.** §3.5's
`looks.spelled`, `columnGap` and the parallelogram, through
`CNBConfig` (defaults, validation, merge), `CNBKeySignature.marks` and
the mark table; the Clairnote SN and DN gallery files redrawn with the six
symbols. *Checks:* `cnb-key-signature-tests.js` and
`cnb-lilypond-tests.js` (the layer's place in the order, the gap, both
Clairnote files' mark tables byte for byte as before, the five baselines
unchanged); an engine round trip of a spelled look and a negative gap,
within 0.001 staff spaces.

**Session 65: The key-signature steps.** Steps 6–9 as §3 describes them:
the 21 spelled notes canvas, Custom marks, the selection and Select row,
the look card on a selection, the column gap on the canvas, and the
preview of every key and mode. *Checks:*
`cnb-key-signature-editor-tests.js`; `uat-key-signature.mjs` rewritten to
the steps, building Clairnote SN's signature in step 7 from its six
symbols.

**Session 66: The tutorial and its walk-through.** The diamonds drawn
(§7.2) and checked in with `tutorial.json`, `tutorial.ly` and
`tutorial-custom.ly`; `uat-tutorial.mjs`; the screenshots; the tutorial
page; `assemble-site.mjs` copying it; the header's link. *Checks:*
`cnb-steps-tests.js` (the walk-through's and the tutorial's parts);
`uat-tutorial.mjs`; `uat-site.mjs` finding `/tutorial/` and its downloads;
an engine render of `tutorial.ly`.

**Session 67: The UI is stable** (the operator declares it), then **the
1.1.0 release**.

**At 1.2.0: Published schemas and partial configs** — §9, as the session
plan already describes it, with the command line of §9.4 added.

---

## 11. The mock-ups

[`step-by-step-mockups/`](step-by-step-mockups/) draws, with the real
`cnb/src` modules:

- the stepped Configurator at 1440 and 1280 px: the grouped, numbered
  sidebar with step 5 open and its Next/Back bar (`shots/steps-1440.png`,
  `shots/steps-1280.png`);
- the key-signature steps: step 6's three choices over the 21 spelled
  notes, step 7 with a selection and the look card, step 8's designer
  with the column gap, step 9's every key and mode
  (`shots/key-signature-steps.png`);
- the tutorial notation: the 3-5-7-9 staff with the diamonds, the red
  black-key pitch classes, a hollow minim row, and the key signature in
  Clairnote's stacks (`shots/tutorial-notation.png`).

---

## 12. Questions for the operator

1. The sidebar's short labels inside a group (§2.1), or the full titles
   throughout?
2. Numbering with Next and Back and no enforced order (§2.2)?
3. The diamonds: drawn by the operator following the tutorial's chapter,
   or by the orchestrator, writing the SVG and running the toolkit's
   script from the command line?
4. The tutorial as one HTML page in `docs/playbook/tutorial/` (§7.1)?
5. AI-assisted designing at 1.2.0, or before the 1.1.0 release?


---

### Questions (answer each, numbered, briefly; then a recommendation)

1. The navigation (§2): groups, numbers, Next/Back, and no enforced order
   beyond step 7's condition. Right? Anything simpler or clearer?
2. The step boundaries and components (§1.2): does each step really edit one
   component, and are the two cross-boundary cases acceptable?
3. The key signature (§3, §3.5): a per-spelled-note look layer
   (looks.spelled) laid over today's layers, the symbol type read back from
   the looks rather than stored, and columnGap. Is this the smallest model
   that does what the operator asked, and is reading the type back robust?
4. The step registry and its test (§4): enough to make a renamed or
   reordered step fail? Simpler?
5. The tutorial notation (§5): will it read well (the 3-5-7-9 staff, ledgers
   at B and C-sharp with C hanging from the C-sharp ledger, 2x3-semitone
   diamonds, red black-key pitch classes, Clairnote's stacks)? Anything a
   learner would trip on? Is "Hollow for minims only" (§5.1) the right fix?
6. The walk-through and tutorial (§6, §7): byte-for-byte baselines, opt-in
   screenshots, a single HTML page read in the repo and on the site. Sound?
7. Importing a hand-drawn SVG (§8): normalising each path to absolute
   M/L/C/Z with all transforms applied, arcs approximated within 0.01 units.
   Risks or gaps (clip paths, strokes, use elements, viewBox scaling)?
8. AI-assisted designing (§9): what to cut or simplify? Is render-to-image
   through headless Chromium worth it?
9. The build program (§10): order and size of sessions 62-67. Anything
   missing, mis-ordered or too big for one session?
~~~~
