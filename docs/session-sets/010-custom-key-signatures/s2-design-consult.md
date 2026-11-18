# Set 010 Session 2 — Design consult: generalized symbol-based key signatures

**Date:** 2026-07-07
**Requested by the operator** during session-2 UAT round 1, verbatim:

> "I wonder how difficult it would be to allow for custom key signatures
> like Clairnote, but more generally: (a) define a set of SVG symbols for
> clefs, (b) define the rules for when (based upon key and mode) and
> where (vertical and relative horizontal positions) those symbols are
> represented in the key signature. That might be too difficult or not
> worth it. Perhaps we should do a consult with GPT and Gemini on this."

**How the consult was run:** one identical design brief (current
`keys.keySignature` state, the extensible `placement.rule` vocabulary,
the SVG symbol pipeline, the engine's missing key-signature config
surface, and the operator's (a)+(b) proposal) routed to **gpt-5-4**
(OpenAI) and **gemini-pro** (Google) via `ai_router.route(task_type=
"architecture", complexity_hint=85)`, each pinned through a scratch
`AI_ROUTER_CONFIG` copy of router-config.yaml with
`routing.task_type_overrides.architecture` set to the target model (the
same supported override mechanism as the 009-s1 verifier swap; the
installed config was not modified).

**Synthesis (the two consults converge):**

- **Verdict: worth doing, kept narrow.** Both recommend a small
  *declarative* symbol-placement system, not a general rule-authoring
  engine. gpt-5-4: "worth it only if you keep it narrow"; gemini-pro:
  "moderately difficult but highly valuable".
- **Same schema shape independently:** a new `placement.rule` value
  (`"by-signature-case"` / `"declarative-map"`) reading a declarative
  table of `{ symbolId, semitone, column }` entries; `symbolId` reuses
  the existing SVG symbol registry; `column` is an abstract horizontal
  slot (never raw x offsets).
- **Never infer mode from pitch-class sets** — both flag the same
  ambiguity (C major / A minor / D dorian share one PC set) and require
  explicit mode/case metadata on key definitions; inference at most as a
  Configurator pre-fill helper.
- **Engine gap is the binding constraint:** preview-only until the
  engine gains (1) a disable flag for its built-in signature and (2) a
  renderer for explicit exported mark lists — both consults say the
  exporter should resolve rules to explicit per-key mark lists rather
  than teaching Scheme the rule vocabulary.
- **Defer the GUI rule editor** — start with presets + JSON editing +
  preview + validation.

**Disposition:** recorded as candidate scope for a future session set
(post-011/012 planning input); no product changes in set 010 follow from
this consult. The `placement.rule` vocabulary shipped in this set is the
designed extension point for it.

---

## Verbatim responses

===== gpt-5-4 (cost: None) =====
1. **Verdict**

**Worth it only if you keep it narrow.**  
A **preset-driven, declarative custom-symbol key signature** feature is reasonable. A **fully general “user-programmable rule system” plus GUI editor** is probably not worth it yet.

Why:

- **Browser-side preview difficulty is moderate**, not extreme:
  - you already have SVG import,
  - you already have semitone-grid placement,
  - `placement.rule` was designed to grow.
- **End-to-end toolchain difficulty is high right now** because the **engine has no key-signature config surface at all** and currently renders its own signature unconditionally from `\key`.

Main cost drivers:

1. **Selection semantics**: deciding which signature applies to which key. This gets messy fast if you try to infer “mode” from a pitch-class set.
2. **Engine support**: arbitrary symbols, spacing, anchors, and disabling/replacing the current built-in signature.
3. **Authoring UX**: a rule editor for “when/where” is expensive in vanilla JS and easy to make confusing.
4. **Symbol metrics**: `data-semitone-height` helps, but custom key-signature symbols also need consistent anchoring and column spacing.

So: **not too difficult if treated as “data-driven preset signatures”**; **too difficult / low ROI if treated as a general rule-authoring system right now**.

---

2. **Minimal schema sketch**

Smallest useful design: **do not build a matcher DSL first**.  
Instead, put the “when” choice on the **key definition** via a case id, and let `placement.rule` map case ids to symbol placements.

```json
{
  "keys": {
    "definitions": [
      {
        "id": "c-ionian",
        "tonicPc": 0,
        "pitchClasses": [0, 2, 4, 5, 7, 9, 11],
        "modeId": "ionian",
        "keySignatureCaseId": "none"
      },
      {
        "id": "g-ionian",
        "tonicPc": 7,
        "pitchClasses": [7, 9, 11, 0, 2, 4, 6],
        "modeId": "ionian",
        "keySignatureCaseId": "one-sharp"
      }
    ],
    "keySignature": {
      "style": "symbols",
      "placement": {
        "rule": "by-signature-case",
        "cases": {
          "none": [],
          "one-sharp": [
            { "symbolId": "clair-sharp", "column": 0, "semitone": 10 }
          ],
          "two-sharps": [
            { "symbolId": "clair-sharp", "column": 0, "semitone": 10 },
            { "symbolId": "clair-sharp", "column": 1, "semitone": 7 }
          ]
        }
      }
    }
  }
}
```

Notes:

- `symbolId` reuses the **existing imported SVG symbol registry**. No new asset format.
- `semitone` = vertical anchor on the existing semitone grid.
- `column` = relative horizontal slot.  
  This is better than raw `x` offsets because it stays declarative and renderer-independent.
- `modeId` is explicit metadata on keys, even if this first rule does not inspect it directly.
- This covers Clairnote-style signatures and more general cases, because any key can point at any case.

If later you really need central matching logic, add a second rule like `"match-table"` with `when: { modeId, tonicPc, keyId }`. I would **not** start there.

---

3. **Main pitfalls**

**a) Mode detection vs explicit metadata**  
Do **not** make the renderer/exporter infer mode from pitch-class sets as the primary mechanism.

Problems with inference:

- same interval content can have multiple musically meaningful names,
- custom/non-diatonic systems may not map cleanly to a known mode catalog,
- future enharmonic or notation-specific distinctions may share the same PC set.

Recommendation:  
- require explicit `modeId` on key definitions;
- even better for this feature, require explicit `keySignatureCaseId`;
- if you want inference, use it only as a **Configurator helper** that pre-fills metadata.

**b) Engine gap**  
This is preview-only until engine work lands. That is the biggest practical limitation.

Best engine strategy when you get there:
- **do not** make Scheme interpret the full rule vocabulary first;
- have the Configurator/exporter **resolve** the cases to explicit per-key mark lists;
- make the engine render those explicit marks.

That keeps rule logic in one place and makes Scheme much simpler.

**c) UI complexity**  
A visual editor for:
- symbol selection,
- per-case placement,
- per-mode/key assignment,
- validation/fallbacks

is a lot of UI for a niche feature. In vanilla JS/no-build-step, it is especially costly.

Recommendation: first support:
- preset import,
- raw JSON editing,
- preview,
- validation errors.

**d) Symbol anchoring and spacing**  
`data-semitone-height` alone may not be enough. Custom symbols need a stable vertical anchor/origin. If your symbol pipeline does not already expose that, add one small anchor concept now.

Also:
- use `column`, not freeform `x`;
- keep horizontal spacing renderer-controlled;
- otherwise browser preview and LilyPond will drift.

**e) Matching/fallback semantics**  
If you later add a `when`-table rule, define:
- exactly one match vs first match wins,
- what happens on no match,
- validation for duplicate/overlapping cases.

**f) Key changes / cancellation logic**  
Defer this. First version should render **absolute signatures** only.  
Do not add “cancel previous signature” behavior yet.

---

4. **Recommended scope cut for one future session-set**

**Build first:**

1. New style: `keys.keySignature.style: "symbols"`.
2. New rule: `placement.rule: "by-signature-case"`.
3. Add `keySignatureCaseId` to key definitions.
4. Reuse existing SVG symbol registry via `symbolId`.
5. Preview + validation only.
6. Ship one concrete preset/example, e.g. a Clairnote-like signature set.

**Defer:**

- mode inference from pitch-class sets,
- a central `when`/predicate DSL,
- GUI rule editor,
- per-symbol fine offsets/kerning,
- collision avoidance beyond simple columns,
- cancellation logic on key changes,
- Scheme-side rule evaluation.

If you can afford **one** engine task in the same period, make it:  
**“disable built-in key signature and render explicit exported mark lists.”**  
Do **not** spend that time on a general rule engine in Scheme.

Bottom line: **yes, worth doing as a small declarative preset system; no, not worth doing yet as a full general-purpose rules/editor feature.**

===== gemini-pro (cost: None) =====
### 1. Verdict and Cost Drivers

This enhancement is moderately difficult but highly valuable. It elevates the tool from a configuration utility to a notation system *design* platform, which aligns perfectly with the project's goals. It is worth the investment.

The main cost drivers are:

1.  **Engine Integration:** This is the primary blocker and highest-cost item. The LilyPond engine currently has no configuration surface for key signatures. All Configurator work will be preview-only until the engine can accept and render this data. This requires significant Scheme development to bypass or replace the engine's built-in behavior.
2.  **Rule-Editing UI Complexity:** While a schema for declarative rules is straightforward, a user interface for creating and editing these rules is not. A simple text area for JSON is low-cost but high-friction for users. A graphical, drag-and-drop rule editor would be a substantial front-end development effort.
3.  **Mode Ambiguity Logic:** A robust system cannot reliably infer musical mode (e.g., major vs. minor) from a pitch-class set alone. This requires enforcing that key definitions in the configuration schema include explicit mode metadata, which may be a new constraint on the system.

---

### 2. Minimal JSON Schema Sketch

This design introduces a new placement rule, `"declarative-map"`, which reads a symbol map from a sibling property, `placement.keyMap`. This fits the existing vocabulary and reuses the SVG symbol pipeline.

```json
{
  "keys": {
    "keySignature": {
      "style": "custom-svg",
      "placement": {
        "rule": "declarative-map",
        "keyMap": {
          "major": [
            { "symbolId": "sharp-line", "semitone": 11, "column": 0 },
            { "symbolId": "sharp-line", "semitone": 6, "column": 0 },
            { "symbolId": "flat-line", "semitone": 4, "column": 1 },
            { "symbolId": "flat-line", "semitone": -1, "column": 1 }
          ],
          "minor": [
            { "symbolId": "hollow-dot", "semitone": 8, "column": 0 },
            { "symbolId": "hollow-dot", "semitone": 3, "column": 0 }
          ],
          "C-major": [
            { "symbolId": "major-tonic-circle", "semitone": 0, "column": 0 }
          ]
        }
      }
    }
  }
}
```

**How it works:**

*   **`placement.rule: "declarative-map"`**: Signals the Configurator's renderer to use the `keyMap` object for symbol placement.
*   **`placement.keyMap`**: An object where each key is a mode identifier (`"major"`, `"minor"`) or a specific key identifier (`"C-major"`). The renderer first looks for a specific key match; if not found, it falls back to the key's mode.
*   **Symbol Placement Array**: Each entry is an array of objects, where each object defines one symbol to be placed.
    *   `symbolId`: The ID of an SVG symbol, reusing the existing import pipeline.
    *   `semitone`: The vertical position on the semitone grid, satisfying the `data-semitone-height` contract.
    *   `column`: A zero-based integer for horizontal positioning, allowing symbols to be stacked or arranged side-by-side like in Clairnote. The renderer will be responsible for defining column widths and alignment.

This schema is minimal, declarative, and directly addresses the owner's request to define WHEN (map keys) and WHERE (`semitone`, `column`) specific SVG symbols (`symbolId`) appear.

---

### 3. Main Pitfalls

1.  **Mode Detection vs. Explicit Metadata:** The most significant logical pitfall. A pitch-class set like `{0, 2, 4, 5, 7, 9, 11}` is shared by C major, A minor, D dorian, etc. The system **must not** attempt to infer mode. **Solution:** The schema for defining keys (elsewhere in the configuration) must be extended to require an explicit `mode` property (e.g., `"major"`). The key signature renderer will use this property to look up rules in the `keyMap`.
2.  **Engine Configuration Gap:** This is the most significant project risk. Without a corresponding engine feature, the Configurator provides a "dead-end" preview. The exported LilyPond configuration will be inert. This can lead to user confusion and design divergence between the preview and the eventual rendered output. Development must be tightly coordinated with the engine team.
3.  **UI Complexity vs. User Power:** A GUI for editing the `keyMap` rules could easily become more complex than the rest of the Configurator combined. It involves managing symbol palettes, grid-based placement, and mapping rules to modes/keys. Starting with direct JSON editing is prudent but limits the feature's accessibility to advanced users.
4.  **Horizontal Layout Semantics:** The `column` property in the schema is an abstraction. The renderer must implement the logic that translates columns into specific X-coordinates. This involves defining column widths, gutter spacing, and alignment within columns, which can become complex if users demand fine-grained control.

---

### 4. Recommended Scope Cut

**Session-Set 1: Build the Preview & Engine Foundation**

**Build First:**

1.  **Implement Schema & Configurator Renderer:** Implement the `"declarative-map"` rule and its rendering logic entirely within the JS Configurator. This is the lowest-risk, highest-value first step. It validates the design and provides immediate visual feedback for notation designers.
2.  **Enforce Explicit Mode:** Update the JSON schema and validation logic to require a `mode` property on all key definitions. This resolves the mode ambiguity pitfall from the start.
3.  **Seed with Examples:** Do not build a GUI editor yet. Instead, hand-craft the JSON `keyMap` for Clairnote and a few other examples. This provides immediate utility for users willing to edit the JSON directly.
4.  **Minimal Engine Hook (Parallel Task):** The first piece of engine work should be the simplest possible hook: a LilyPond function that accepts a list of glyph names and coordinates and renders them at the start of the staff, plus a flag to disable the default key signature renderer. This unblocks the entire feature pipeline.

**Defer:**

1.  **GUI Rule Editor:** A graphical interface for editing the `keyMap` is a major feature. Defer it until the core preview-and-render pipeline is proven and user demand is clear.
2.  **Exporter Logic:** Do not write the JS code to export the `keyMap` to LilyPond format until the engine's configuration surface is stable. Writing it prematurely risks rework.
3.  **Advanced Placement Rules:** Defer any rules more complex than the simple `declarative-map`, such as relative positioning or collision avoidance.

