# The key-signature editor — cross-provider design consult

**Date:** 2026-11-11 (session 53).
**Subject:** the amendment in
[`key-signature-designer-design.md`](key-signature-designer-design.md) §13,
the key-signature editor, and its mock-ups
([`key-signature-editor-mockups/`](key-signature-editor-mockups/index.html)),
before the operator approves it (session plan, session 53 item 4).

## How it was run

One identical brief went to two models, in one call each, at the same time,
from a script kept outside the tracked tree (the session's scratch
directory), with the API keys from the environment. They are the models the
operator named for the session-47 consult's second round:

- **Sol:** `gpt-6.1-sol` (OpenAI Responses API, reasoning effort high). The
  first call's connection timed out waiting for the reply, so the same
  request was sent again in the API's background mode and its result
  fetched when it completed.
- **Argon:** `gemini-4-argon` (Google Generative Language API,
  `generateContent`).

The brief (reproduced at the end) gave the project's context, what is being
decided, the operator's request, the project's rule against
over-engineering and nine questions. To it were appended, verbatim, session
50's notes on the Clairnote signatures (`docs/sessions/session-050/notes.md`)
and the whole design document as it stood after the mock-ups: sections 1–12
and the Approval as approved in session 47, and the amendment, §13, as
reproduced at the end of this record. Three images went with it: the mock-up
page's editor, its touch check with a steeper tail, and its concert-size
section, each screenshotted at 1440 px, device scale 2 (the committed
`shots/key-signature-editor-1440.png` shows the same page whole). Both
replies are reproduced verbatim below.

## Synthesis

### Where they agree, and what is taken

| # | Point | Taken into the design |
|---|---|---|
| 1 | **The one model is sound**, and converting a saved `style` on load is safe for drawing and export. | Yes, as designed (§13.2). The conversion runs before the defaults are merged and is idempotent (Sol). |
| 2 | **Keep signature symbols in `config.shapes`**, with `reference` and `ledgers`; a second registry would duplicate import, validation and export. | Yes (§13.3). Only the signature reads the two fields, so a notehead rule using the same shape is unchanged (Sol). |
| 3 | **The layer order is right**, and "on a line or ledger" from the staff lines and the notation's ledgers is enough for Clairnote. | Yes (§13.4). It is decided from the pitch before any offset, and by axis position under a pitch axis (Sol). |
| 4 | **`added` (and `offset`) must be one field each**, replaced whole by a layer that sets it, so a space's hollow fill does not wipe a flat's tail and tails from two layers do not stack. | Yes (§13.4): `{ x: 0, y: 0 }` resets an offset, `added: []` removes the added symbols. |
| 5 | **The one-octave window is the right generalisation**, raised apart for sharps and flats, 0 by default. | Yes (§13.5). Sol: say it wraps the fifths' order into an octave rather than reproducing every clef; a copy's marks share its key's window, naturals included; the upper tonic does not apply. All taken. |
| 6 | **Keep both placements** (reference point, or today's centred box), and the column step "farthest right plus farthest left". | Yes (§13.6). An offset on a shape with no reference moves today's placement; a base's offset moves its tails; a head's ledgers move with it and a tail does not lengthen them (Sol). |
| 7 | **No automatic avoidance; an advisory touch check**, defined on the real ink, not boxes. | Yes (§13.7): whole marks compared, boxes first and then an offscreen ink mask at a fixed resolution, seams included, run after a drag; a warning in the checks list that never blocks the export. |
| 8 | **The mark table cannot carry a coloured sign**, though the editor offers one. | Yes (§13.10): a sign may carry a colour after its scale, omitted when black. |
| 9 | **`symbol` loses a hollow base's cut-out.** | Yes (§13.10): `symbol` takes a cutout as `head` does, with no ledgers. |
| 10 | **"The most specific layer" a click selects is undefined**, since every mark is on a line or in a space. | Yes (§13.8): a click selects the mark's spelling unless the designer has picked another layer, which stays picked; the base and each added symbol are selected apart (both, Sol's Base / Added 1 / Added 2). |
| 11 | **Origin-only `(at dx . dy)` is the right, least engine contract**; the engine's spacing follows the placed stencils. | Yes (§13.10). `dx` and `dy` are converted as the path is, scaled and Y negated (Sol). |

### Taken from one model

- **Sol:** signs start black, so a notehead's colour never reaches them
  (§13.2); "Edits all flats in every key" beside the controls; the canvas's
  height capped; the list of touching keys opening, each a click to pick
  its key and mode; one drag one step of undo, loaded values never snapped;
  Start from keeping the shown state and the picked key (§13.8); repeated
  marks removed before a mark splits into its symbols, and every ledger
  drawn before the marks (§13.10); the program reordered, the export
  before the editor, so the engine's contract is proved first, and the
  round trip's added cases (§13.11); the gallery's tails approved only after
  engraving the imported filled shapes, not the mock-ups' strokes.
- **Argon:** the spacing reads the placed stencils' extents (§13.10).

### Not taken

- **One added symbol instead of two** (Argon). The session plan asks for a
  base plus up to two added symbols.
- **A look's size for signs, flats and sharps sized apart** (Sol). The
  session plan has resizing a sharp set session 52's size, one size for
  both.
- **A recovery copy of the notehead settings an accidentals config was not
  using** (Sol). Nothing reads them; the export and the drawing are kept.
- **Removing the colour's "None"** (Argon). None is black (design §4.6), not
  invisible.
- **No resize handle for added symbols** (Argon). The selected symbol,
  base or added, takes the handle, as Sol's explicit selection allows.

### Where they differ: before or after 1.1.0

The operator decides. **Argon** would build the editor before 1.1.0, so the
release does not ship the two styles the next one retires, nor the gallery's
slashed dots. **Sol** would release 1.1.0 first: the amendment changes the
model, the importer, the interaction and the engine's contract, and is not a
finishing touch to a release whose UI is to be declared stable.

## Sol (gpt-6.1-sol), verbatim

## Recommendation

**Approve the unified model, with revisions before building.** Reuse the existing shape registry and mark-table architecture. Do not add automatic collision avoidance or a separate signature-symbol subsystem.

The main gaps are loss of dormant settings during migration, inconsistent treatment of sign sizes, incomplete engine support for colour and hollow symbols, and ambiguous selection semantics.

### 1. One model and conversion

**The four choices are sound.** They separate musical content, appearance, arrangement and geometry without introducing per-key exceptions.

The migration is not yet fully safe:

- Clearing the old accidental style’s ignored looks and overwriting its notes/stacking discards the designer’s dormant notehead-signature settings. Preserve those discarded fields in a migration-only recovery copy; do not maintain two live models.
- Emmentaler signs must explicitly start **black**. Clearing the looks otherwise permits colour inherited from the notehead rules to reach them.
- Preserve every active notehead-style setting, not merely the defaults.

Run conversion on loaded data **before merging defaults**, validate afterwards, and make it idempotent. Test both legacy styles across all 105 keys, including non-default placement and sign size. Rendering/export compatibility is achievable; unchanged editing state is not something the current conversion can promise.

### 2. Symbols

**Keep signature symbols in `config.shapes`.** A second registry would duplicate import, validation, sizing and export machinery.

The shared `shape | sign` slot and at most two additions are sufficient. Do not generalise this into arbitrary groups or nested components.

Two revisions:

- Scope the new metadata’s effect explicitly: importing a signature symbol must not unexpectedly change ordinary score noteheads that share its shape.
- Remove the special rule that look sizes cannot affect signs. Use per-look height/width for signs too, with the existing `signs.heightSemis` as the compatibility fallback. Resizing a selected sharp should not silently resize flats.

`reference` is useful geometric metadata. `ledgers` can remain a shape default for signature use, provided its scope is documented.

### 3. When a look applies

**Keep the proposed order.** It provides Clairnote’s required combinations without conditional-rule machinery.

Define line/space membership from the mark’s **musical pitch before visual offsets**, using the ordinary note’s ledger rules—not whether this particular symbol draws ledgers. Under a pitch axis, compare mapped positions with a documented numerical tolerance.

For Clairnote:

- **SN:** set line/ledger fill solid and space fill hollow explicitly.
- **DN:** leave these fill overrides unset so the notehead rules supply the alternation.

Also specify inheritance for compound fields: `added` replaces the inherited list; `[]` removes inherited additions. Do not concatenate additions from successive layers.

### 4. Cycle of fifths and the window

**Use the one-octave window.** It is a small, understandable generalisation of octave-wrapped fifths ordering.

Keep separate sharp/flat raises and default both to zero. They provide useful register control without per-clef placement tables. Show them only for window heights.

Qualify the claim: this produces a **fifths-order octave wrap**, not necessarily every conventional clef’s exact signature placement—especially because this project intentionally places signs at the altered pitches.

Define which window applies when naturals are included: choose by the **key’s sharp/flat family**, so the whole copy shares one window; neutral keys use the documented neutral choice.

Finally, specify upper-tonic behaviour: it must not create a duplicate tonic at the same height inside a one-octave window, and it has no effect for “sharps or flats only.”

### 5. Placement

**Keep both placements.** Legacy box-centred placement is necessary for compatibility; reference-point placement solves the balancing-speck problem directly.

Close two ambiguities:

- Without an explicit reference, an offset moves the **legacy placement**. It must not switch anchoring conventions.
- A mark’s offset moves the compound mark; each addition’s offset is relative to that moved anchor. Moving the dot should not leave its tail behind.

The exported translation must subtract the **scaled and transformed** reference point, including SVG normalisation and the canvas/LilyPond y-direction conversion.

The uniform column step, **maximum right reach + maximum left reach**, is a good simple rule. Include actual stroke and ledger extents where they affect spacing, and preserve any existing clearance. The formula prevents overlap; equality can still mean touching.

### 6. Tails

**Shallow tails, explicit spacing and an advisory check are enough.** Automatic avoidance would undermine predictable rules and add disproportionate complexity.

Make the check’s meaning precise:

- Compare complete **logical marks**, not their constituent dot and tail against one another.
- Include actual filled/stroked geometry and hollow cutouts.
- Do not report intended base–tail joins or staff/ledger crossings as accidental collisions.
- Check repeated-copy seams as well as ordinary stacks.

Do not build an exact arbitrary-SVG intersection engine for this feature. Use bounding boxes first, then a fixed-resolution offscreen ink-mask check through the existing renderer, with a documented advisory tolerance. Run the full 105-key check after a gesture or short debounce.

The concert-size mock-ups support continuing, but the stroke prototype is not the final proof. Approve the gallery tails only after engraving the actual imported filled shapes.

### 7. The editor

**Keep category-wide editing, the dashed affected-mark outlines, reference cross, numeric fields and key previews.** Those communicate the model well.

Change these details:

- **Selection:** membership alone cannot determine the “most specific” layer—every mark belongs to line or space. Default base selection to its spelling category; select an addition’s owning layer when clicking that addition. Retain an explicitly chosen Edit layer rather than resetting it on every click.
- **Components:** provide explicit Base / Added 1 / Added 2 selection and removal. A composite outline must not leave the designer guessing whether resizing affects the dot or tail.
- **Scope:** state beside the controls, “Edits all flats in every key,” or equivalent.
- **Layout:** cap the magnified viewport’s height. In the mock-up it pushes Notes, Stacks and Place too far below the working area. Let the 15 previews wrap at narrower widths.
- **Results:** make the “96 keys” result expandable and clickable, switching both tonic and mode. Do not dump 96 names into the panel.
- **Interaction:** one drag is one undo step; snapping affects edited values only, never loaded values.

Keep both Start from buttons and confirmation. Preserve the picked key and Show checkbox when resetting the design.

### 8. Mark table and engine

**Origin-only `(at dx . dy)` is the right contract.** The engine should receive resolved geometry, not learn reference points, inheritance or stacking rules.

The proposed format is missing two capabilities:

1. **Coloured signs.** The example’s sharp/flat entries have no colour field, despite the editor promising coloured signs. Add a backward-compatible optional colour suffix.
2. **Hollow symbols without ledgers.** Mapping every `ledgers: false` base to an always-solid `symbol` loses its cutout. Give `symbol` the same solid/hollow payload as `head`, but no ledger generation. Added tails use solid.

Also settle these behaviours:

- Deduplicate logical marks **before** expanding their components; never collapse layered entries merely because semitone and column match.
- Generate all ledgers before drawing any symbol.
- A tail must not widen its dot’s ledger. A referenced or horizontally offset head must have its ledger span aligned with the placed head.
- Omit new suffixes for legacy-equivalent placements and colours, including unchanged signs, so byte-identical exports remain possible.

With those corrections, this remains a small engine extension.

### 9. Program and release

**Prove the engine contract before finishing the editor.** I would order the work:

1. Model, migration and compatibility fixtures.
2. Engine extension plus a minimal export/round-trip proof.
3. Full editor and touch check.
4. Final gallery engraving, integration tests and UAT.

That can still fit three Configurator milestones and one engine milestone, but Session B is substantial; the session count should not become a reason to cut verification.

Add round trips for an asymmetric referenced head, nonzero x/y offsets, differently sized additions, a hollow no-ledger base, coloured signs, pitch-axis placement and repeated-copy seams. Retain key-change, transposition and system-start regressions.

**I recommend releasing the already-built 1.1.0 first**, then shipping this amendment as the next feature release. It changes the model, importer, interaction and engine contract; it is not a small finishing task for a stable release.

## Other changes

- Define offsets as complete vectors: unset inherits; an explicit zero resets. Avoid component-by-component inheritance surprises.
- Validate positive sizes, Boolean ledger settings and all addition fields using the existing validators.
- Preserve inactive settings, but choose the legacy/default export path from **effective behaviour**, not the presence of new fields.
- Distinguish collision **pairs** from affected **marks** in counts. “Two marks touch” and “two contacts” are different results.
- Keep touch findings advisory, not export-blocking errors. Align the app’s status wording so “No problems” does not contradict visible touch warnings.
- Remove the mock-up’s “new” labels from production.

The useful restraint is already present: no per-key edits, no automatic avoidance, no separate symbol library, and no general-purpose composition graph. Keep that restraint while making the few missing semantics explicit.

## Argon (gemini-4-argon), verbatim

### Answers to your questions

**1. One model (13.2).**
The unification into four orthogonal choices is sound and eliminates the artificial boundary between scale-note and accidental signatures. Converting `style` on load via `signatureStyleToModel` is safe and preserves byte-identical output for existing configs. The only thing lost is the ability to toggle back and forth between "noteheads" and "accidentals" while keeping separate look settings in memory—and since "Start from" replaces settings with undo support, nothing of practical value is lost.

**2. Symbols (13.3).**
Sharing `config.shapes` with optional `reference` and `ledgers` fields and sharing one slot between `shape` and `sign` is the right call. A separate symbol store would duplicate SVG import, validation, and Section A LilyPond registration for no gain. However, **cap `added` at one symbol, not two** (see *Where the amendment is more than needed* below).

**3. When a look applies (13.4).**
The 5-layer cascade and the definition of "on a line or ledger" (checking staff lines or `CNBLedgerSet.ledgersFor` at the mark's own pitch) are exact and sufficient for both Clairnote SN and DN. Because `line` and `space` sit above `flat` and `sharp` in the cascade, **specify explicitly that `added` symbols are inherited unless explicitly cleared** (or additive across layers)—otherwise `looks.space` setting `hollow: true` must not wipe out `looks.flat.added`. Since `looks.space` leaves `added` unset, standard field-level inheritance ("each field left unset keeps the one beneath") handles this cleanly, provided `added` is treated as a single field on the look.

**4. The cycle of fifths and the window (13.5).**
A 12-semitone window `[middle - 6, middle + 6)` around the line set's midpoint is the cleanest mathematical generalisation of the traditional five-line zigzag to arbitrary chromatic staffs. The independent `window: { sharp: 0, flat: 0 }` raise is necessary for designers emulating traditional treble/bass offsets, and `0` is the right default.

**5. Placement (13.6).**
Keeping box-centred placement when `reference` and `offset` are absent is essential for backward compatibility and zero-migration of existing shapes. The asymmetric column-step rule (`maxRightReach + maxLeftReach`) is exact, simple, and avoids over-spacing one-sided tails.

**6. Tails (13.7).**
Yes. Shallow tails, asymmetric column steps, and a deterministic 105-key touch check solve session 50's failures without introducing complex and unpredictable auto-collision avoidance. **Specify the geometry of the touch check**: checking bounding-box intersection on axis-aligned boxes will falsely flag diagonal tails as touching neighbouring dots; use the shape's actual polygon/path ink (or segment-to-box distance) so a 30° tail whose bounding box grazes a neighbour's bounding box isn't falsely flagged.

**7. The editor (13.8).**
The category-level editing model, 15-key strip, and 105-key touch summary are well-judged. Looking at the mock-ups, make three adjustments:
- **Clicking a mark vs. its layer:** In the mock-up, clicking a flat in Clairnote SN selects `Flats`. If `In a space` also has overrides (e.g. `hollow: true`), "the most specific layer the mark belongs to" would select `In a space` instead of `Flats` for a hollow flat. **Change the click rule:** clicking a mark selects its accidental kind (`Naturals`, `Flats`, or `Sharps`) unless the user has already selected `All marks`, `On a line`, `In a space`, or `Every second stack` in the `Edit` bar.
- **Selecting base vs. added symbol on the canvas:** When a flat has an added tail, clarify what dragging on the canvas moves. Recommend: clicking/dragging the base shape moves/resizes the base; clicking/dragging the added symbol moves/resizes the added symbol.
- **Colour "None" button:** In the first mock-up, the Look card's Colour row shows `[As beneath] [None] [■]`. A mark with no colour is invisible; remove `None` so Colour is just `[As beneath]` and the colour picker `[■]`.

**8. The mark table and the engine (13.10).**
Pre-computing `dx` and `dy` as `offset - reference` in the Configurator so the engine only shifts stencil origins via `(at dx . dy)` is the minimum viable engine work. Adding the `symbol` kind (filled path, no cutout, no ledgers) and drawing in table order after bars and ledgers is complete and sound. One detail to pin down: **confirm how `cnb:keysig-marks` spaces the signature horizontally when `(at dx . dy)` is used**—the engine must use the translated stencil's true X-extent when computing the signature's total width and right-hand padding, which LilyPond's `ly:stencil-translate` does automatically.

**9. The program (13.11).**
The three-session split (Model + tests → Editor UI → Engine + export round-trip) is in the right order. **Do this before 1.1.0.** Releasing 1.1.0 with the two-style `style: "notehead-chords" | "accidentals"` schema and immediately retiring and migrating it in 1.2.0 creates unnecessary legacy config churn and ships Clairnote gallery files with interim slashed-dot workarounds instead of their true signatures.

---

### Where the amendment is more than needed (cut these)

1. **`added` up to two symbols → limit to one single `added` symbol.**
   No requirement or real-world notation system in scope needs three shapes per mark (base + 2 added). Allowing an array of up to two requires list management UI (`+ Add a symbol`, delete buttons, selecting which added symbol is being dragged). Replace `added: [...]` with a single optional `added: { shape, heightSemis, widthSemis, offset } | null` (or a single dropdown in the Look card: `Added symbol: [None ▾]`). If a designer ever needs two extra strokes, they can combine them into one SVG.
2. **Added symbol sizing on the canvas.**
   Allowing `offset` (or `heightSemis`/`widthSemis` in the card) on an added symbol is useful, but if the added symbol is imported at its intended size relative to the dot, it rarely needs independent 2D handle resizing on the canvas. Keep the canvas resize handle strictly for the active symbol (or base mark) to avoid overlapping handles on small marks.

### Where the amendment is not enough (specify these)

1. **Hollow added symbols or hollow custom shapes without cutouts.**
   Section 13.10 says `symbol` is drawn "filled in the colour, with no cutout and no ledgers. It serves added symbols and any base whose shape has `ledgers: false`." What if a base shape has `ledgers: false` AND `hollow: true`? If `symbol` has no cutout support in the engine, setting `hollow: true` on a ledgerless base shape will silently fail in LilyPond. **Fix:** Either let `head` take a boolean `<ledgers?>` flag instead of introducing `symbol` for base shapes, or specify that `symbol` is only used when `hollow` is false (or for `added` symbols, which are always solid).
2. **Sign colour in the mark table.**
   Section 13.2 notes a designer can "give the signs a colour", and the Look card shows a Colour control when editing Flats/Sharps. However, in §13.10 the mark table entry for a sign is `(13 1 sharp 0.6473 (at 0.1 . 0.25))`—it has no `<color>` field! **Fix:** Include colour in the `sharp` and `flat` mark-table entries (or specify that colour does not apply to Emmentaler signs and hide Colour when a sign is chosen). Supporting colour on signs by passing `<color>` in the mark table is cleaner and matches §13.2.

## The brief

Sent as below, followed by session 50's notes and the design document (see How it was run). The opening part, verbatim:

````markdown
# Design consult: the key-signature editor

You are reviewing a design for the Chromatic Notation Configurator, a browser tool (vanilla JavaScript, no
build step) in which a designer builds a chromatic music notation system (staff lines, ledger lines,
notehead shapes and their rules, clef, key signature), previews it on a canvas, and exports a LilyPond
file that a companion LilyPond engine (Scheme) engraves. The preview and the engraving must agree to
within 0.001 staff spaces, which engine round trips in the test suite check. One JSON config drives both.

## What is being decided

Sessions 47 to 52 designed and built a key-signature designer with two styles: "the key's notes" (each
mark one notehead shape, its box centred on its stack, with four stacking rules, looks for all marks,
flats, sharps and every second stack, and placement on the staff's line sets) and "sharps or flats"
(LilyPond's own Emmentaler signs, sized in semitones). The engine draws any signature from an exported
"mark table": for each of 105 keys (15 tonic spellings x 7 modes), the columns, gold bars and marks.

The operator now wants an editor for signatures (2026-11-11): "the signature shown magnified, its marks
noteheads, sharps and flats or imported symbols, each of which can be resized and moved, with rules for
stacking and offsets. It starts from the notehead signature, and for accidentals the arrangement is the
cycle of fifths." Clairnote shows the need: a signature mark on a line or a ledger is solid and one in a
space hollow; a flat has a diagonal tail up and a sharp a diagonal tail down, so a mark is one to three
shapes. Session 50 tried one-sided tails and dropped them (its notes are below): the engine centres a
mark's box on its stack, so a one-sided symbol needed invisible balancing geometry that LilyPond printed
as specks, and a steep tail ran into the next dot of a whole-step stack.

The amendment under review is section 13 of the design document reproduced below (sections 1 to 12 and
the Approval are the design already approved and built in sessions 48 to 52). Mock-ups are attached as
images:

1. The editor at 1440 px: the app's Key signature section with the staff's canvas, the magnified
   signature (Clairnote SN in B-flat major, the flats selected: the solid outline is the mark clicked
   with its reference point cross and resize handle, dashed outlines the other flats the edit moves),
   the look card for flats, the key picker and Edit layer chips, the mode's 15 keys as small previews,
   and the touch check's summary over all 105 keys (none touch with the designed 30-degree tails).
2. The touch check with a steeper tail (75 degrees, 1.4 semitones): keys whose marks touch are outlined,
   their touching marks circled, and 96 of the 105 keys are named as touching.
3. At concert size (LilyPond's 20-point staff at the engine's 7/4 magnification, one staff space 11.7 px)
   and three times as large, each in a sharp and a flat key: the notehead signature (the default); the
   traditional signature with the window's zigzag; the same climbing (what a config saved with today's
   "Sharps or flats" draws); Clairnote SN with tails (dots solid on a line or ledger, hollow in a space,
   through the new line and space looks); Clairnote DN with tails (the dot follows DN's alternating
   noteheads).

The mock-ups draw with the Configurator's own staff, notehead, ledger and Emmentaler code and a prototype
of the amendment's model; tails are drawn as strokes, where the build would import them as shapes.

## The project's rule

Over-engineering is strictly forbidden: the value of a design is measured as much by its simplicity and
clarity as by meeting the requirements. Say where the amendment is more than the requirements need, and
where it is not enough.

## Questions

1. **One model.** Is replacing the two styles with four choices (which notes; what each mark is drawn
   with; arrangement; sizes and offsets) sound, and is converting a saved `style` on load (13.2) safe?
   Is anything a designer has today lost?
2. **Symbols (13.3).** Imported signature symbols go into `config.shapes` with two new optional fields,
   `reference` and `ledgers`, and a look's `shape` and new `sign` share one slot. Up to two added symbols
   per look. Is this the simplest structure that works, or should signature symbols live apart from
   noteheads?
3. **When a look applies (13.4).** The layer order (notehead's own; all marks; naturals, flats or sharps;
   on a line or ledger, or in a space; every second stack) and the definition of "on a line or ledger".
   Right, and enough for Clairnote?
4. **The cycle of fifths and the window (13.5).** Is a one-octave window around the line set, raised
   separately for sharps and flats, the right generalisation of the traditional zigzag to a chromatic
   staff? Is the raise needed, and is the default (0, centred on the set) right?
5. **Placement (13.6).** A symbol with a reference point is placed by it plus an offset; one without is
   placed as today (its box centred). Is keeping both placements right? Is the column step rule right?
6. **Tails (13.7).** Shallow tails, the column step and a measured touch check over all 105 keys, with no
   automatic avoidance. Enough?
7. **The editor (13.8).** An edit applies to a category, never to one mark in one key; a click selects
   the mark's most specific layer; drags snap to tenths of a semitone; the mode's 15 keys previewed and a
   105-key summary; "Start from" buttons; which panel rows it replaces. What would you change, judging
   also from the mock-up images?
8. **The mark table and the engine (13.10).** An optional `(at dx . dy)` placement on each mark, a new
   `symbol` kind (a registered path with no cutout or ledgers), layered marks as several entries at one
   semitone and column. Is this the least engine work that carries the editor, and is anything missing
   or wrong?
9. **The program (13.11).** Three Configurator sessions and one engine session. Anything missing or in
   the wrong order? Should they come before the 1.1.0 release (the operator decides; give your view)?

Answer each question briefly and concretely, then list anything else you would change. Recommend; do
not survey options you would not pick.
````

### The amendment as sent (§13 before the consult)

Sections 1–12 and the Approval were as they stand in the design document. Section 13 was sent as follows; §13.12 of the design lists what the consult changed.

````markdown
## 13. Amendment: the key-signature editor (session 53)

**Session:** 53 (2026-11-11). A design only: no code changes with it.
**Source:** the session plan's session 53, from the operator's request
(2026-11-11): an editor that shows the signature magnified, its marks
noteheads, sharps and flats or imported symbols, each of which can be
resized and moved, with rules for stacking and offsets.
**Mock-ups:** [`key-signature-editor-mockups/`](key-signature-editor-mockups/index.html).

### 13.1 Why

Sessions 48–52 built two styles. "The key's notes" draws one shape per
mark with its box centred on its stack. "Sharps or flats" draws Emmentaler's
signs and nothing else. Clairnote shows what neither can do (operator,
2026-11-11). A mark on a line or a ledger is solid and one in a space is
hollow, and a flat has a diagonal tail up and a sharp a diagonal tail down.
A mark is therefore one to three shapes: a dot, solid or hollow, and a tail.
Session 50 tried one-sided tails and dropped them for two reasons
(`docs/sessions/session-050/notes.md`):

1. **Hidden geometry.** The engine centres a mark's box on its stack. A
   one-sided symbol therefore needed an invisible sliver opposite its tail
   to keep its dot on the stack, and LilyPond printed the sliver as a speck.
2. **The next dot.** A steep tail ran into the next dot of a whole-step
   stack.

This amendment answers both (§13.6, §13.7). It replaces the two styles with
one model and gives the model an editor.

### 13.2 One model for every signature

A signature is four choices:

| Choice | Values |
|---|---|
| **Which notes get a mark** | the whole scale (the default), the tonic and the half steps (§4.3), or **the sharps or flats only**; and the upper tonic, as today (§4.2) |
| **What each mark is drawn with** | a look for naturals, flats and sharps, laid over the notehead's own look (§13.3, §13.4) |
| **How the marks are arranged** | today's four stacking rules (§4.4), or **the cycle of fifths, one mark to a column** (§13.5); and the place (§4.5) |
| **Their sizes and offsets** | each symbol's size and its offset from the mark's pitch, in semitones (§13.3, §13.6) |

**The notehead signature is the default**: the whole scale, every mark the
notehead's own look, stacked sevenths, in the middle, with the gold stem.
It is today's default signature, unchanged.

**The traditional signature is a starting point**, not a separate style.
It sets the sharps or flats only; Emmentaler's sharp for sharps and flat for
flats; the cycle of fifths, with the heights the window gives (§13.5); and
the place in the middle. Under the cycle of fifths there is no gold stem
(§13.5). The designer can change any of it afterwards: give the signs a
colour, move them, or draw dots for them.

**Configs saved today load and draw as they do now.** `style` is retired,
and a config that carries it is converted when it loads, as a palette is
(`CNBConfig.paletteToRules`). A new pure function,
`CNBConfig.signatureStyleToModel`, is called by `CNBConfigIO.mergeLoaded`:

- `"notehead-chords"` needs nothing: the model's defaults are that style.
  The field is dropped.
- `"accidentals"` becomes the sharps or flats only, `looks.flat.sign
  "flat"`, `looks.sharp.sign "sharp"`, and the cycle of fifths with the
  heights `"scale"` (§13.5). Those are session 51's signs, each at its note
  in the scale's octave from the tonic. `looks.all`, `looks.flat`,
  `looks.sharp` and `alternate` are cleared first: the accidentals style
  ignored them, and left in place they would colour or reshape the signs.
  `signs.heightSemis` stays as it is.

Every fixture and gallery file therefore draws, and exports, byte for byte
as before, which the first building session pins (§13.11).

### 13.3 Symbols

A mark's **base** is one of three kinds of symbol:

- **A notehead**: the notehead's own look (nothing set), or a chosen
  shape from `config.shapes`, which is today's look `shape`.
- **Emmentaler's sharp or flat**: the look's new field `sign`, `"sharp"`
  or `"flat"`. These are the signs session 51 draws, sized by session 52's
  `signs.heightSemis`. One size serves both signs, and a look's height and
  width do not apply to them.
- **An imported SVG**, which is a shape like any other. It is imported
  through the notehead panel's Import from SVG into `config.shapes`, and
  chosen as `shape`. A look's `shape` and `sign` are one slot: a layer that
  sets either replaces both beneath it.

Each kind is chosen separately for naturals, flats and sharps (§13.4), and
flats and sharps each have their own Import from SVG, so a designer imports
the flat's symbol while editing flats.

**Added symbols.** A look may add up to two symbols to the base, `added:
[{ shape, heightSemis, widthSemis, offset }]`, each a shape from
`config.shapes`. An added symbol is drawn over the base, solid, in the
mark's colour, and has no ledgers of its own. So one tail serves a solid dot
and a hollow one: the flats' look adds a tail, and the dot beneath is solid
or hollow as its line or space gives it (§13.4). Two added symbols are
enough for a dot with a tail and a second stroke, and the limit keeps the
look's controls small.

**A symbol's reference point and its ledgers.** Two new optional shape
fields:

- **`reference: { x, y }`**, in the shape's native SVG units: the point
  that sits on the mark's pitch, such as a dot's centre or a flat's bowl
  line. A shape without one is placed as today, its box centred on its
  stack and its origin at its pitch. Every shape saved today is therefore
  placed as it is now.
- **`ledgers: false`**: the symbol takes no ledger lines, as a sign does
  not. A shape without the field takes them, as a notehead does.

For Emmentaler's signs both are fixed: the reference is the sign's box's
centre across and its origin up and down, a sharp's centre line and a flat's
bowl line, which is where session 51 puts them, and a sign takes no ledgers.

**On import** the panel shows the symbol enlarged, with its reference point
marked. The point starts at the SVG's origin, which is the toolkit's
notehead centre. A click on the symbol moves the point. Beneath it is a
checkbox, "Takes ledger lines", which starts on when importing for naturals
and off when importing for flats or sharps. The toolkit's `data-*`
attributes are read as for a notehead (Module 16), and stem anchors are not
needed.

### 13.4 When a look applies

Looks are laid over one another, each field left unset keeping the one
beneath, in this order, the last winning:

1. the notehead's own look (at crotchet, in the key), as today;
2. **all marks** (`looks.all`), as today;
3. **naturals** (`looks.natural`, new), **flats** (`looks.flat`) or
   **sharps** (`looks.sharp`), by the key's spelling;
4. **on a line or a ledger** (`looks.line`, new) or **in a space**
   (`looks.space`, new);
5. **every second stack** (`alternate`), as today.

A mark is **on a line** when its pitch is a staff line's, or when the
notation's ledgers for a note at its pitch (`CNBLedgerSet.ledgersFor`)
include its own semitone. Otherwise it is in a space. This holds whether or
not the mark draws ledgers, so a sign can take the line look too. Under a
pitch axis the comparison is by axis position.

A look's fields are today's `shape`, `hollow`, `color`, `heightSemis` and
`widthSemis`, plus `sign`, `offset` and `added`. Clairnote SN is then:

- all marks are a small dot;
- spaces are hollow;
- flats add a tail up;
- sharps add a tail down.

### 13.5 Arrangement

`stacking` gains a fifth value, **`"fifths"`: the cycle of fifths, one mark
to a column.** In a sharp key the marks are in the order F C G D A E B, and
in a flat key, or a key with neither, B E A D G C F. The order is by letter,
so it applies to every mark drawn, naturals included, when the notes are
the whole scale. Under `"fifths"` the gold stem, the stack direction
(`columns`) and every second stack apply as follows:

- there is no gold stem;
- the direction does not apply, and the columns go left to right;
- every second stack is every second column.

**Heights** (`heights`, under `"fifths"` only):

- **`"scale"`**: each mark at its note in the scale's octave from the
  tonic, which is session 51's rule. The signs climb as the key's notes do.
- **`"window"`**: each mark at the octave of its note that falls in a
  **one-octave window around its line set**: the semitones from the set's
  middle − 6 up to, but not including, its middle + 6. In the middle
  place, the window is around `staff.midpoint`.

The window gives the traditional zigzag on any staff. A fifth up is 7
semitones and a fourth down 5, so in a window of 12 each next sign is
either a fifth up or a fourth down, and the signs zigzag instead of
climbing, as a treble signature's do (G5, D5, A4: down twice).
On the default staff's bottom set (lines 4 and 8, middle 6, window 0–11):

- the sharps fall on 6 1 8 3 10 5 0 (F♯ C♯ G♯ D♯ A♯ E♯ B♯);
- the flats fall on 10 3 8 1 6 11 4 (B♭ E♭ A♭ D♭ G♭ C♭ F♭).

The traditional treble clef does the same with its own windows: its sharps
fall in A4–G5 and its flats in F4–E5. One setting moves the window:
**`window: { sharp: 0, flat: 0 }`**, the semitones by which the sharps'
window and the flats' window are raised (negative lowers). It is
needed because a traditional signature's sharps sit a third above its
flats, and some designers will want that. Both are 0 by default.

Every line set's copy has its own window, as each copy has its own octave
today (§4.5). The marks keep their order by letter, so the window changes
only their heights.

### 13.6 Placing a mark, and its sizes and offsets

**A mark is placed by its reference point plus an offset.** For a symbol
with a reference point (§13.3), the reference point goes to the mark's pitch
on its stack, moved by the symbol's **`offset: { x, y }`**, in semitones
(axis units under a pitch axis, as a notehead's size). Its box is not
centred. A one-sided symbol therefore needs no hidden geometry: a dot with
a tail has its reference at the dot's centre, and the dot sits on the stack
whatever the tail does. That is session 50's first failure answered.

- An added symbol is placed the same way, at the base's point plus its own
  offset, so a tail is drawn as a shape of its own and moved by itself.
- A symbol with no reference point and no offset is placed as today, its
  box centred. Every config saved today keeps that placement.
- **Sizes** are each symbol's `heightSemis` and `widthSemis`, as a
  notehead's are (null = the shape's own). The signs' size is
  `signs.heightSemis` (§13.3).

**Columns.** The step between columns is the farthest any mark reaches to
the right of its stack's line plus the farthest any mark reaches to the
left, the offsets and added symbols included. No mark's ink then overlaps
the next column's. A mark centred on its stack, as every mark today is,
gives its width, today's step, so nothing saved today moves. A mark that
reaches out to one side widens the step for the whole signature, which
keeps the rule to one number. *(Revised after the mock-ups: the first draft
took twice the farthest reach, which spaced a tailed dot's stacks half as
wide again as they need.)*

### 13.7 Tails

How a tail clears the next dot of its stack, session 50's second failure:

- **Shallow and short.** A stack holds notes a whole step, 2 semitones,
  apart. With a dot 1.6 semitones high and its reference at the centre, the
  next dot's edge is 1.2 semitones above the centre. A tail leaving the dot
  at 30° from the horizontal and reaching 0.8 semitones past its side
  rises about 0.5 semitones, and clears the next dot by more than its own
  thickness. Session 50's 55° tail rose about 1.1 semitones and met the
  dot. The editor's drag sets the tail's offset and size (§13.8), so the
  designer can make it shallower and shorter until it clears.
- **The next stack.** The column step reaches the farthest ink (§13.6), so
  a tail never reaches into the next stack. "Stacks go to the left in sharp
  keys" (§4.4) remains for Clairnote's own arrangement.
- **Measured, not avoided.** The editor checks every mark's ink against the
  other marks in its stack and in the neighbouring stacks, for all 105 keys.
  This replaces §4.4's height-only overlap note. It names the keys where two
  marks touch. No mark is moved automatically.

### 13.8 The editor

The Key signature section's panel holds the editor
(mock-ups, at 1440 and 1280 px):

```
Key signature   [x] Show the key signature     Start from: [The noteheads] [Traditional sharps and flats]

  ┌ Key: [D ▾] [major ▾] ───────────────────────────────────┐  ┌ Sharps ──────────────────────┐
  │                                                          │  │ Symbol  [notehead thumbnails] │
  │     the signature, magnified, on the staff's lines      │  │         [♯] [♭]  Import from SVG│
  │     and ledgers; a mark selected shows its reference     │  │ Fill    (as beneath) Solid Hollow│
  │     point, its box and a resize handle                   │  │ Colour  ■   Size  h [ ] w [ ]   │
  │                                                          │  │ Offset  x [0.0] y [0.0] semis   │
  └──────────────────────────────────────────────────────────┘  │ Added   [tail ▾] [+ Add a symbol]│
  Other keys:  C  G  D  A  E  B  F♯ C♯ | F  B♭ E♭ A♭ D♭ G♭ C♭   └──────────────────────────────┘
               (each a small signature; a key whose marks touch is outlined, "2 marks touch")
  Edit: (o) Sharps  ( ) Flats  ( ) Naturals  ( ) All marks  ( ) On a line  ( ) In a space  ( ) Every second stack

  Notes   (o) The whole scale  ( ) The tonic and the half steps  ( ) The sharps or flats only   [x] The tonic an octave up
  Stacks  ( ) Stacked sevenths … ( ) Cycle of fifths, one to a column: heights (o) in a window ( ) climbing
          window raised: sharps [0] flats [0] semitones
  Place   (o) In the middle of the staff ( ) bottom line set ( ) top line set ( ) every line set
```

- **The canvas** draws the signature for the picked key magnified, at 24
  px a semitone (about twice the staff's Medium size), with the staff's
  lines near the marks and the marks' ledgers, through the same `render`
  the staff uses. The magnification is a grid context with a larger
  `pxPerSemi`, and nothing else changes. *(The first draft said four times
  the staff's scale; the mock-ups showed that an octave's signature would
  then be taller than the panel.)*
- **The edit applies to its category, never to one mark in one key.** A
  click on a mark selects it and its category, the most specific layer of
  "Edit" the mark belongs to, which starts at its kind (natural, flat or
  sharp). The designer may pick a wider or other layer in "Edit". Dragging
  a symbol's body sets the layer's `offset` (or an added symbol's own
  offset), so dragging one flat moves every flat in every key. Dragging the
  corner handle sets its size, or `signs.heightSemis` for a sign, so
  resizing a sharp resizes both signs, as session 52's size does. Values
  snap to tenths of a semitone and show beside the handle while dragging.
  The fields on the right show and set the same numbers.
- **The look card** is the notehead panel's controls, its thumbnails
  shared as `CNBNoteheadPanel.thumbnail`, with Emmentaler's sharp and flat
  as two more thumbnails, Import from SVG (§13.3), the offset fields, and
  the added symbols. Each field's "as …" clears it, as today.
- **The key picker** is the staff's own key and mode, shown above the
  canvas. Changing it here changes the staff's picker too.
- **Other keys.** Beneath the canvas, the picked mode's 15 spellings as
  small signatures at the staff's scale, sharp keys then flat keys. A click
  picks one. A key whose marks touch (§13.7) is outlined, with the count.
  A line beneath says how many of the 105 keys have marks that touch, and
  names them. An offset that fits B♭ major may collide in G♭ major, and
  this is where the designer sees it.
- **Start from** sets the notehead signature (the defaults) or the
  traditional one (§13.2) after asking to confirm, since it replaces the
  signature's settings. Undo restores them (session 41's history).

**Panel rows the editor replaces:**

| Today's row | Becomes |
|---|---|
| Draw (the key's notes / sharps or flats) | **Start from**, and the third Notes choice |
| Looks (four menus) | **Edit** and the look card |
| Size (sharps and flats) | the sign's resize handle, and the size field in the look card ("Automatic (2.72)" kept) |
| The overlap note | the touch check over all keys (§13.7) |

Show the key signature, Notes, Stacks with the gold stem, and Place stay as
they are, each with the additions above. Controls that do not apply are
hidden, as today. The key definitions stay below, under "Keys for notehead
rules".

### 13.9 The config

```javascript
keySignature: {
  enabled: false,
  // style: retired; converted on load (§13.2)
  notes: "all",                    // | "tonic-and-half-steps" | "altered"
  upperTonic: true,
  looks: {                         // each field unset = the look beneath (§13.4)
    all: {}, natural: {}, flat: {}, sharp: {}, line: {}, space: {}
  },                               // { shape | sign, hollow, color, heightSemis, widthSemis,
                                   //   offset: { x, y }, added: [{ shape, heightSemis, widthSemis, offset }] }
  alternate: {},                   // every second stack, as today, with the same fields
  stacking: "degrees",             // | "parity" | "parity-stacks" | "parity-zigzag" | "fifths"
  heights: "window",               // under "fifths": | "scale"
  window: { sharp: 0, flat: 0 },   // under "fifths" and "window": semitones up
  columns: "right",                // as today
  placement: { … },                // as today
  separator: { … },                // as today
  signs: { heightSemis: null }     // as today: the size of both signs
}
shapes[name].reference             // optional { x, y }, native SVG units (§13.3)
shapes[name].ledgers               // optional; false = no ledger lines
```

**Validation** extends today's checks:

- each new vocabulary is checked;
- `sign` is `"sharp"` or `"flat"`;
- an offset is two finite numbers;
- `added` has at most two entries, each naming a shape that exists;
- a reference point is two finite numbers;
- a look that sets both `shape` and `sign` is an error.

Settings that do not apply are kept and ignored, as today, so switching
back restores them.

### 13.10 The preview, the mark table and the engine's work

**The preview.** `CNBKeySignature.marks` stays the one function that says
what is drawn, and the exporter writes its result (§8). Each mark gains the
symbols it draws, in order: the base, then the added ones, each with its
kind and its placement, either the box centred as today or a point (the
reference point plus the offset, in staff spaces from the column and the
pitch). `render` and the editor's canvas draw from it.

**The mark table** (LY spec §5.6a) keeps its format. Each mark gains one
optional last element, the placement **`(at dx . dy)`**, in staff spaces.
With it, the stencil's origin goes to the column plus `dx` and the
semitone's height plus `dy`, and its box is not centred:

```lilypond
(marks (6 0 head clairnote-dot #f black-000000)                 ; as today
       (6 0 symbol clairnote-tail-down black-000000 (at -0.05 . 0))
       (13 1 sharp 0.6473 (at 0.1 . 0.25)))                      ; a sign moved
```

- **`dx` and `dy`** are the offset less the reference point, so the engine
  places only origins and never needs a symbol's reference.
- **A mark without `at`** is placed as today. Every table exported today is
  therefore engraved as before.
- **A sign with `at`** writes its scale even when it is 1, so the element
  positions stay fixed.
- **A new kind, `symbol`**: `(semi column symbol <path> <color> [at])`. It
  is a path Section A registers, drawn filled in the colour, with no cutout
  and no ledgers. It serves added symbols and any base whose shape has
  `ledgers: false`.
- **Layered marks** are several marks at one semitone and column. The
  engine draws them in the table's order after the bars and the ledgers. A
  mark's ledgers come from its `head`, so a tail adds none.

**The engine's work** is one engine session and its release. Its sessions
are numbered when the first building session inserts them into the
engine's plan, after its session 36, the 1.5.0 release:

1. `(at dx . dy)` on `head`, `symbol`, `sharp` and `flat` marks, as above.
2. The `symbol` kind.
3. Drawing order: bars, ledgers, then the marks in table order.
4. Goldens and integration specs on LilyPond 2.24 and 2.26, the handoff,
   and **engine 1.6.0**, a minor release, since it adds to the format and
   changes no existing output.

The space around the signature needs nothing new: the preview already
spaces a mark-table signature by its ink, and the engine's ink is its
stencil, whatever the placement.

### 13.11 The program

Each session ends with the browser UAT and screenshots at 1440 and
1280 px, as sessions 25 onward do.

**Session A: The model on the canvas, and the engine planned.**

1. Register.
2. The config of §13.9 with its validation, and
   `CNBConfig.signatureStyleToModel` called on load.
3. The looks for naturals, lines and spaces, the signs as a look, added
   symbols, reference points, offsets and columns (§13.3–§13.6), and the
   sharps or flats only with the cycle of fifths and both heights (§13.5).
   All of it goes in `CNBKeySignature.marks` and `render`, with tests in
   `cnb/tests/cnb-key-signature-tests.js` and
   `cnb/tests/cnb-config-tests.js`. The tests cover:
   - the window's zigzag on the default and Kite staffs, in sharp and flat
     keys, with the window raised;
   - a one-sided symbol placed by its reference point;
   - every fixture and gallery file, and both of today's styles after
     conversion, drawing exactly as before.
4. *Engine work:* insert the engine session of §13.10 and its 1.6.0
   release into the engine's plan.

**Session B: The editor.**

1. Register.
2. The panel of §13.8:
   - the magnified canvas, with selection, the drags, their snapping and
     the fields;
   - Edit and the look card, with the signs' thumbnails;
   - Import from SVG with its reference point and ledgers;
   - the key picker and the other keys' previews;
   - the touch check over the 105 keys (§13.7);
   - Start from.
3. The rows the editor replaces are removed (§13.8). A UAT driver covers
   each drag and choice. *Engine work:* none.

**Session C: The editor reaches LilyPond.**

1. Register.
2. Once the engine session has landed (otherwise the step is blocked):
   the mark table's `at` placement, the `symbol` kind and layered marks
   (§13.10). LY spec 1.3.19 §5.6a, the architecture plan and the README
   are updated. The five export baselines stay byte-identical.
3. The Clairnote SN and DN gallery files take Clairnote's own signatures:
   dots solid on lines and hollow in spaces, a tail up for flats and down
   for sharps, each tail an added symbol shallow enough to clear (§13.7).
   They are checked at concert size on an engraved page, as session 50
   checked them.
4. An engine round trip holds every symbol's placement, size and colour,
   every stack's ledgers and the ink to the preview's within 0.001 staff
   spaces. It covers the default, Kite 4-369 and both Clairnote files; the
   traditional starting point on the bottom and every line set; a sign
   moved; and C, D and B♭ major. *Engine work:* the engine session of
   §13.10.

The operator decides where these sessions go: before the UI-stable session
and the 1.1.0 release, which are then renumbered after them, or after
1.1.0. The decision is recorded in §13.13.
````
