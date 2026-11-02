/**
 * key-signature-editor.js — Key Signature Editor (set 010, session 2)
 *
 * Edits the `config.keys` section activated in set 010 session 1
 * (architecture plan §4.9): the `keys.enabled` master gate, the key
 * definitions the signature renders from, and the `keys.keySignature`
 * subsection (enable toggle, mark-style selection, placement-rule
 * controls, separator/dot/gutter styling). `keys.offKeyMark` passes
 * through untouched — off-key marking stays deferred (plan §11).
 *
 * Why the key-definition controls live HERE (session-2 design decision,
 * s2-notes.md): sets 005–006 shipped key CONSUMERS — the notehead rule
 * editor's match.keys pills and the preview display's key selector both
 * read `keys.definitions` — but no editor writes `keys.enabled` or
 * `keys.definitions`. The set-010 session-2 goal ("a key signature can be
 * configured … through the UI") and its UAT flow ("enable → key
 * selection → …") need a writer, and the key signature is defined
 * relative to a key definition (set spec binding rule 2), so this panel
 * hosts the whole `keys` section: definitions (name, pitch-class pills,
 * optional explicit tonic) alongside the signature controls.
 *
 * Disabled-state rule (set-006 session-3 lesson; spec session 2 step 1):
 * when `keys.enabled` is false everything below the master toggle is
 * rendered DISABLED with an explicit .cnb-kse-disabled-note — shown, not
 * hidden, and gated exactly on `keys.enabled`.
 *
 * Preserve-and-report: unknown `style` / `placement.rule` strings loaded
 * from a config file are kept in the editor state and shown as an extra
 * "(unrecognized)" option; the Module A validation pass-through reports
 * them. The editor never silently rewrites loaded values.
 *
 * Editor-level checks beyond Module A (labeled "Editor check" in the
 * validation panel): duplicate definition names — key selection and rule
 * matching are name-keyed, so a duplicated name makes later definitions
 * unreachable.
 *
 * Engine-divergence copy (s1-engine-coordination.md §2): the exporter
 * emits NOTHING for this section — the CNB engine renders notehead-chord
 * key signatures from the score's `\key` through the already-exported
 * notehead config. An explicit tonic octave and the separator styling are
 * therefore PREVIEW-ONLY, and the controls say so.
 *
 * `style` is a single-value vocabulary ("notehead-chords"): the task owner
 * evaluated simple built-in marks in set-010 s2 UAT and chose the note
 * stack as the sole style, deferring custom-symbol signatures to a future
 * set (s2-uat.md, s2-design-consult.md). The style select preserves and
 * reports an unknown loaded value rather than rewriting it.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     enabled: boolean,                    // keys.enabled (master gate)
 *     definitions: [ { name, pitchClasses, tonicPc? } ],  // pass through
 *     offKeyMark: object,                  // untouched passthrough
 *     keySignature: {
 *       enabled: boolean,
 *       style: string,   // "notehead-chords" (single-value vocabulary)
 *       placement: { rule: string, tonicOctave: number|null },
 *       separator: { enabled, color, thicknessPct, extentSemis },
 *       gutter: { paddingH: number }
 *     }
 *   }
 *
 * The UI cannot express every invalid config (e.g. a definition with no
 * pitch classes mid-edit), so — like Modules 12–15 and the clef editor —
 * invalid-but-editable situations surface through the Module A validation
 * pass-through, while structurally invalid STATE (non-array definitions,
 * non-finite numbers, invalid separator hex) throws from the pure
 * builders: that is a caller bug, not user input.
 *
 * Rendering contract (same as Modules 12–17 and the clef editor):
 * render() builds plain DOM via document.createElement, wires events as
 * element properties (onclick/oninput/onchange) so the whole UI is
 * exercisable in Node against a stub document, and reports every state
 * change through onChange({ keys }, state) where `keys` is a ready
 * `config.keys` object. Hosts own layout/styling via .cnb-kse-* hooks.
 *
 * Inspired by Clairnote DN's alternative key signatures (design
 * CC BY-SA 4.0, Paul Morris); no code is ported from clairnote.ly.
 *
 * Dependencies: Module A (validation pass-through), Module B (pitch-class
 * labels), cnb-key-signature.js (tonic-resolution chain for the hint).
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBMusic } from "../src/cnb-music.js";
import { CNBKeySignature } from "../src/cnb-key-signature.js";

// ─── Pure helpers ────────────────────────────────────────────────────────────

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidHex(v) {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Known vocabulary (Module A validate() accepts exactly these). */
const STYLES = ["notehead-chords"];
const PLACEMENT_RULES = ["scale-from-tonic"];

/** Pitch-class display label: "C", "C♯", … (Module B). */
function pcName(pc) {
  const label = CNBMusic.pcLabel(pc);
  return label.text + (label.sharp ? "♯" : "");
}

/** New-definition template: a plainly visible C-major scaffold the user
 *  edits — never a silent fallback (set-004 lesson). */
function definitionTemplate() {
  return { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] };
}

export const CNBKeySignatureEditor = {

  STYLES,
  PLACEMENT_RULES,

  /**
   * Build a ready `config.keys` slice from editor state. Pure function;
   * throws on structurally invalid state (see module header) rather than
   * guessing. Mid-edit-reachable situations (empty definition name, no
   * pitch classes, signature enabled while keys disabled) are NOT throws —
   * the Module A validation pass-through reports them.
   *
   * @param {object} state
   * @returns {object} config.keys object
   */
  buildKeys(state) {
    if (!isPlainObject(state)) {
      throw new Error("Key-signature editor state must be an object");
    }
    if (!Array.isArray(state.definitions)) {
      throw new Error("keys.definitions must be an array of key definitions");
    }
    for (const [i, def] of state.definitions.entries()) {
      if (!isPlainObject(def)) {
        throw new Error(`keys.definitions[${i}] must be an object (got ${JSON.stringify(def)})`);
      }
      if (typeof def.name !== "string") {
        throw new Error(`keys.definitions[${i}].name must be a string (got ${JSON.stringify(def.name)})`);
      }
      if (!Array.isArray(def.pitchClasses)) {
        throw new Error(`keys.definitions[${i}].pitchClasses must be an array (got ${JSON.stringify(def.pitchClasses)})`);
      }
    }
    const ks = state.keySignature;
    if (!isPlainObject(ks)) {
      throw new Error("keys.keySignature editor state must be an object");
    }
    if (typeof ks.style !== "string") {
      throw new Error(`keySignature.style must be a string (got ${JSON.stringify(ks.style)})`);
    }
    const placement = ks.placement;
    if (!isPlainObject(placement) || typeof placement.rule !== "string") {
      throw new Error("keySignature.placement must be an object with a string rule");
    }
    if (placement.tonicOctave !== null && !Number.isInteger(placement.tonicOctave)) {
      throw new Error(`keySignature.placement.tonicOctave must be an integer or null for auto (got ${JSON.stringify(placement.tonicOctave)})`);
    }
    const sep = ks.separator;
    if (!isPlainObject(sep)) {
      throw new Error("keySignature.separator editor state must be an object");
    }
    if (!isValidHex(sep.color)) {
      throw new Error(`keySignature.separator.color must be a #RRGGBB hex string (got ${JSON.stringify(sep.color)})`);
    }
    if (typeof sep.thicknessPct !== "number" || !Number.isFinite(sep.thicknessPct) || sep.thicknessPct < 0) {
      throw new Error(`keySignature.separator.thicknessPct must be a finite non-negative number (got ${JSON.stringify(sep.thicknessPct)})`);
    }
    if (typeof sep.extentSemis !== "number" || !Number.isFinite(sep.extentSemis) || sep.extentSemis <= 0) {
      throw new Error(`keySignature.separator.extentSemis must be a finite positive number (got ${JSON.stringify(sep.extentSemis)})`);
    }
    const gutter = ks.gutter;
    if (!isPlainObject(gutter) || typeof gutter.paddingH !== "number" ||
        !Number.isFinite(gutter.paddingH) || gutter.paddingH < 0) {
      throw new Error(`keySignature.gutter.paddingH must be a finite non-negative number (got ${JSON.stringify(gutter && gutter.paddingH)})`);
    }
    return {
      enabled: !!state.enabled,
      definitions: deepClone(state.definitions),
      offKeyMark: isPlainObject(state.offKeyMark) ? deepClone(state.offKeyMark) : {},
      keySignature: {
        enabled: !!ks.enabled,
        style: ks.style,
        placement: {
          rule: placement.rule,
          tonicOctave: placement.tonicOctave,
        },
        separator: {
          enabled: !!sep.enabled,
          color: sep.color,
          thicknessPct: sep.thicknessPct,
          extentSemis: sep.extentSemis,
        },
        gutter: { paddingH: gutter.paddingH },
      },
    };
  },

  /**
   * Apply an editor state to a config: returns a new config with the keys
   * section replaced (all other sections untouched). Neither argument is
   * mutated.
   * @param {object} config
   * @param {object} state
   * @returns {object}
   */
  applyToConfig(config, state) {
    const out = CNBConfig.clone(config);
    out.keys = CNBKeySignatureEditor.buildKeys(state);
    return out;
  },

  /**
   * Recover an editor state from a config (inverse of applyToConfig for
   * the keys slice). Tolerant of configs predating the keySignature
   * subsection — a missing or malformed section opens as the default-off
   * state. Unknown style/rule STRINGS are preserved (preserve-and-report,
   * module header); non-string/malformed values fall back to defaults.
   * @param {object} config
   * @returns {object} editor state
   */
  stateFromConfig(config) {
    const keys = isPlainObject(config && config.keys) ? config.keys : {};
    const ks = isPlainObject(keys.keySignature) ? keys.keySignature : {};
    const placement = isPlainObject(ks.placement) ? ks.placement : {};
    const sep = isPlainObject(ks.separator) ? ks.separator : {};
    const gutter = isPlainObject(ks.gutter) ? ks.gutter : {};
    const finite = (v, min, fallback, exclusive = false) =>
      (typeof v === "number" && Number.isFinite(v) && (exclusive ? v > min : v >= min))
        ? v
        : fallback;
    return {
      enabled: !!keys.enabled,
      definitions: Array.isArray(keys.definitions)
        ? deepClone(keys.definitions.filter(isPlainObject))
        : [],
      offKeyMark: isPlainObject(keys.offKeyMark) ? deepClone(keys.offKeyMark) : {},
      keySignature: {
        enabled: !!ks.enabled,
        style: typeof ks.style === "string" ? ks.style : "notehead-chords",
        placement: {
          rule: typeof placement.rule === "string" ? placement.rule : "scale-from-tonic",
          tonicOctave: Number.isInteger(placement.tonicOctave) ? placement.tonicOctave : null,
        },
        separator: {
          enabled: sep.enabled !== false,   // schema default: true
          color: isValidHex(sep.color) ? sep.color : "#ffd42a",
          thicknessPct: finite(sep.thicknessPct, 0, 160),
          extentSemis: finite(sep.extentSemis, 0, 12, true),
        },
        gutter: { paddingH: finite(gutter.paddingH, 0, 12) },
      },
    };
  },

  /**
   * The tonic-resolution chain for a definition, mirrored from the
   * renderer (s1 decision D3) so the hint states exactly what will render:
   *   explicit tonicPc → parsed from the name's leading note letter →
   *   first listed pitch class (fallback).
   * @param {object} def  keys.definitions entry
   * @returns {{pc: number, source: "explicit"|"name"|"fallback"}}
   */
  tonicInfo(def) {
    if (Number.isInteger(def.tonicPc) && def.tonicPc >= 0 && def.tonicPc <= 11) {
      return { pc: def.tonicPc, source: "explicit" };
    }
    const parsed = CNBKeySignature.parseTonicPc(def.name);
    if (parsed !== null) return { pc: parsed, source: "name" };
    return { pc: CNBKeySignature.tonicPc(def), source: "fallback" };
  },

  /**
   * Editor-level warnings that Module A does not cover (labeled as editor
   * checks in the validation panel): duplicate definition names — the
   * preview's key selector and the rule editor's key matching are
   * name-keyed, so later duplicates are unreachable.
   * @param {object} state
   * @returns {string[]}
   */
  editorWarnings(state) {
    const warnings = [];
    const seen = new Map();
    for (const def of state.definitions) {
      const name = def.name;
      if (typeof name !== "string" || name.length === 0) continue;
      seen.set(name, (seen.get(name) || 0) + 1);
    }
    for (const [name, count] of seen) {
      if (count > 1) {
        warnings.push(
          `Editor check: ${count} definitions share the name "${name}" — key ` +
          `selection and rule matching are name-keyed, so only the first is reachable`);
      }
    }
    return warnings;
  },

  /**
   * Render the key-signature editor into a container.
   *
   * Structure (all styling left to the host via class hooks):
   *   div.cnb-key-signature-editor
   *   ├── label.cnb-kse-keys-enable    (keys.enabled master toggle)
   *   ├── div.cnb-kse-disabled-note    (ONLY while keys.enabled is false)
   *   ├── div.cnb-kse-definitions     (definition rows + add button)
   *   ├── div.cnb-kse-signature       (keySignature.enabled, style,
   *   │                                placement, separator, dot, gutter)
   *   └── div.cnb-kse-validation      (Module A pass-through + editor checks)
   *
   * While keys.enabled is false every control below the master toggle is
   * rendered with disabled = true (explicit disabled state, not hidden).
   *
   * @param {HTMLElement} container
   * @param {{config?: object,
   *          onChange?: (slices: {keys: object}, state: object) => void}} [opts]
   *        `config` seeds the editor state and is the base for the
   *        validation pass-through (defaults to CNBConfig.createDefault()).
   * @returns {{root: HTMLElement, getState: () => object,
   *            getKeys: () => object, applyTo: (config: object) => object,
   *            setState: (partial: object) => void, redraw: () => void}}
   */
  render(container, opts = {}) {
    const doc = globalThis.document;
    const baseConfig = opts.config ? CNBConfig.clone(opts.config) : CNBConfig.createDefault();
    const state = CNBKeySignatureEditor.stateFromConfig(baseConfig);
    const onChange = opts.onChange || (() => {});

    const root = doc.createElement("div");
    root.className = "cnb-key-signature-editor";

    const el = (tag, className, text) => {
      const e = doc.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };

    const numberFrom = (e, input) => {
      const raw = (e && e.target && e.target.value !== undefined) ? e.target.value : input.value;
      const v = parseFloat(raw);
      return Number.isFinite(v) ? v : null;
    };

    const checkedFrom = (e, input) =>
      e && e.target && e.target.checked !== undefined ? !!e.target.checked : !!input.checked;

    const valueFrom = (e, input) =>
      (e && e.target && e.target.value !== undefined) ? e.target.value : input.value;

    const changed = () => {
      redraw();
      onChange({ keys: CNBKeySignatureEditor.buildKeys(state) }, deepClone(state));
    };

    /** Everything below the master toggle is disabled while keys.enabled
     *  is false (explicit disabled state — set-006 s3 lesson). */
    const gated = () => !state.enabled;

    const control = (e) => { e.disabled = gated(); return e; };

    // ── keys.enabled master toggle (never disabled) ──────────────────────
    function drawKeysEnable() {
      const label = el("label", "cnb-kse-keys-enable");
      const cb = el("input", "cnb-kse-keys-enable-check");
      cb.type = "checkbox";
      cb.checked = !!state.enabled;
      cb.onchange = (e) => { state.enabled = checkedFrom(e, cb); changed(); };
      label.appendChild(cb);
      label.appendChild(el("span", "cnb-kse-keys-enable-text",
        "Enable keys (key definitions, key rule matching, and the key signature)"));
      return label;
    }

    function drawDisabledNote() {
      if (!gated()) return null;
      return el("div", "cnb-kse-disabled-note",
        "Keys are disabled — the controls below are shown but inactive. " +
        "Edits are kept; nothing key-related renders or matches until " +
        "keys are enabled.");
    }

    // ── Key definitions ──────────────────────────────────────────────────
    function drawDefinitions() {
      const wrap = el("div", "cnb-kse-section cnb-kse-definitions");
      wrap.appendChild(el("div", "cnb-kse-title", "Key definitions"));
      wrap.appendChild(el("div", "cnb-kse-hint",
        "The keys the signature (and rule matching) can use: a name plus " +
        "the key's pitch classes. The tonic resolves from an explicit " +
        "choice, else the name's leading note letter, else the first " +
        "listed pitch class."));

      if (state.definitions.length === 0) {
        wrap.appendChild(el("div", "cnb-kse-empty",
          "No key definitions yet — add one to give the signature (and the " +
          "preview's key selector) something to render."));
      }

      state.definitions.forEach((def, index) => {
        const row = el("div", "cnb-kse-def-row");
        row.setAttribute("data-def-index", String(index));

        const name = el("input", "cnb-kse-def-name");
        name.type = "text";
        name.value = def.name;
        name.title = "Key name (used by key selection and rule matching)";
        name.oninput = (e) => { def.name = String(valueFrom(e, name)); changed(); };
        row.appendChild(control(name));

        const pills = el("span", "cnb-kse-def-pcs");
        for (let pc = 0; pc <= 11; pc++) {
          const on = def.pitchClasses.includes(pc);
          const pill = el("button", "cnb-kse-pc-pill" + (on ? " on" : ""), pcName(pc));
          pill.type = "button";
          pill.setAttribute("data-pc", String(pc));
          pill.onclick = () => {
            def.pitchClasses = on
              ? def.pitchClasses.filter(v => v !== pc)
              : [...def.pitchClasses, pc].sort((a, b) => a - b);
            changed();
          };
          pills.appendChild(control(pill));
        }
        row.appendChild(pills);

        const tonic = el("select", "cnb-kse-def-tonic");
        tonic.title = "Tonic pitch class (auto = from the name, else the first pitch class)";
        const auto = el("option", "", "auto");
        auto.value = "";
        tonic.appendChild(auto);
        for (let pc = 0; pc <= 11; pc++) {
          const option = el("option", "", pcName(pc));
          option.value = String(pc);
          if (Number.isInteger(def.tonicPc) && def.tonicPc === pc) option.selected = true;
          tonic.appendChild(option);
        }
        tonic.value = Number.isInteger(def.tonicPc) ? String(def.tonicPc) : "";
        tonic.onchange = (e) => {
          const v = valueFrom(e, tonic);
          if (v === "") delete def.tonicPc;
          else def.tonicPc = parseInt(v, 10);
          changed();
        };
        row.appendChild(control(tonic));

        const info = CNBKeySignatureEditor.tonicInfo(def);
        const sourceText = { explicit: "explicit", name: "from name", fallback: "first pitch class" }[info.source];
        row.appendChild(el("span", "cnb-kse-def-tonic-hint",
          `tonic ${pcName(info.pc)} (${sourceText})`));

        const remove = el("button", "cnb-kse-def-remove", "×");
        remove.type = "button";
        remove.title = "Remove this key definition";
        remove.onclick = () => { state.definitions.splice(index, 1); changed(); };
        row.appendChild(control(remove));

        wrap.appendChild(row);
      });

      const add = el("button", "cnb-kse-def-add", "+ Add key definition");
      add.type = "button";
      add.onclick = () => { state.definitions.push(definitionTemplate()); changed(); };
      wrap.appendChild(control(add));
      return wrap;
    }

    // ── Key signature ────────────────────────────────────────────────────
    function drawSignature() {
      const wrap = el("div", "cnb-kse-section cnb-kse-signature");
      wrap.appendChild(el("div", "cnb-kse-title", "Key signature"));
      wrap.appendChild(el("div", "cnb-kse-hint",
        "Grid-positioned marks for the selected key at the start of the " +
        "staff (the key shown is picked in the preview's Key control — " +
        "example data, not config). The exporter emits nothing for this " +
        "section: the CNB engine engraves its notehead-chord key " +
        "signature from the score's \\key through the exported notehead " +
        "config. Inspired by Clairnote DN's alternative key signatures."));

      const enable = el("label", "cnb-kse-sig-enable");
      const cb = el("input", "cnb-kse-sig-enable-check");
      cb.type = "checkbox";
      cb.checked = !!state.keySignature.enabled;
      cb.onchange = (e) => { state.keySignature.enabled = checkedFrom(e, cb); changed(); };
      enable.appendChild(control(cb));
      enable.appendChild(el("span", "cnb-kse-sig-enable-text",
        "Enable key signature (renders in a gutter after the clef)"));
      wrap.appendChild(enable);

      wrap.appendChild(drawStyle());
      wrap.appendChild(drawPlacement());
      wrap.appendChild(drawSeparator());
      wrap.appendChild(drawGutter());
      return wrap;
    }

    function drawStyle() {
      const wrap = el("div", "cnb-kse-style");
      wrap.appendChild(el("div", "cnb-kse-subtitle", "Mark style"));

      const options = [
        {
          value: "notehead-chords",
          label: "Notehead chords (engine style)",
          detail: "The key's scale as real noteheads — 7 degrees ascending " +
            "from the tonic plus the octave tonic, interleaved into two " +
            "columns (two stacked 7th chords), mirroring the engine's " +
            "keysig.ly. The only implemented style; richer custom-symbol " +
            "signatures are a future extension.",
        },
      ];
      if (!STYLES.includes(state.keySignature.style)) {
        options.push({
          value: state.keySignature.style,
          label: `${state.keySignature.style} (unrecognized)`,
          detail: "Loaded from the config file but not a known style — " +
            "validation reports it; pick a known style to fix.",
        });
      }
      for (const option of options) {
        const isOn = state.keySignature.style === option.value;
        const row = el("div", "cnb-kse-style-option" + (isOn ? " selected" : ""));
        row.setAttribute("data-style", option.value);
        row.appendChild(el("div", "cnb-kse-style-label", option.label));
        row.appendChild(el("div", "cnb-kse-style-detail", option.detail));
        row.onclick = () => {
          if (gated()) return;   // real DOM divs have no disabled semantics
          state.keySignature.style = option.value;
          changed();
        };
        wrap.appendChild(row);
      }
      return wrap;
    }

    function drawPlacement() {
      const wrap = el("div", "cnb-kse-placement");
      wrap.appendChild(el("div", "cnb-kse-subtitle", "Placement"));
      wrap.appendChild(el("div", "cnb-kse-hint",
        "How the key's pitch classes map to grid positions. " +
        "\"scale-from-tonic\" (the engine's keysig.ly rule) is the only " +
        "implemented rule; the vocabulary extends when new rules land."));

      const ruleRow = el("div", "cnb-kse-fields");
      ruleRow.appendChild(el("span", "cnb-kse-field-label", "Rule"));
      const rule = el("select", "cnb-kse-placement-rule");
      const ruleValues = PLACEMENT_RULES.includes(state.keySignature.placement.rule)
        ? PLACEMENT_RULES
        : [...PLACEMENT_RULES, state.keySignature.placement.rule];
      for (const value of ruleValues) {
        const option = el("option", "",
          PLACEMENT_RULES.includes(value) ? value : `${value} (unrecognized)`);
        option.value = value;
        if (value === state.keySignature.placement.rule) option.selected = true;
        rule.appendChild(option);
      }
      rule.value = state.keySignature.placement.rule;
      rule.onchange = (e) => {
        state.keySignature.placement.rule = String(valueFrom(e, rule));
        changed();
      };
      ruleRow.appendChild(control(rule));
      wrap.appendChild(ruleRow);

      const octaveRow = el("div", "cnb-kse-fields");
      octaveRow.appendChild(el("span", "cnb-kse-field-label", "Tonic octave"));
      const isAuto = state.keySignature.placement.tonicOctave === null;
      const autoLabel = el("label", "cnb-kse-octave-auto");
      const autoCheck = el("input", "cnb-kse-octave-auto-check");
      autoCheck.type = "checkbox";
      autoCheck.checked = isAuto;
      autoCheck.onchange = (e) => {
        state.keySignature.placement.tonicOctave = checkedFrom(e, autoCheck) ? null : 1;
        changed();
      };
      autoLabel.appendChild(control(autoCheck));
      autoLabel.appendChild(el("span", "cnb-kse-octave-auto-text",
        "auto (center the octave span on the staff midpoint)"));
      octaveRow.appendChild(autoLabel);

      const octave = el("input", "cnb-kse-octave-input");
      octave.type = "number";
      octave.step = "1";
      octave.value = isAuto ? "" : String(state.keySignature.placement.tonicOctave);
      octave.title = "Explicit tonic octave (integer)";
      octave.disabled = gated() || isAuto;
      octave.oninput = (e) => {
        const v = numberFrom(e, octave);
        if (v !== null && Number.isInteger(v)) {
          state.keySignature.placement.tonicOctave = v;
          changed();
        }
      };
      octaveRow.appendChild(octave);
      wrap.appendChild(octaveRow);
      wrap.appendChild(el("div", "cnb-kse-hint cnb-kse-octave-note",
        "Preview-only placement: the engine anchors the signature at " +
        "middle C. The auto rule matches it for the default config."));
      return wrap;
    }

    function drawSeparator() {
      const wrap = el("div", "cnb-kse-separator");
      wrap.appendChild(el("div", "cnb-kse-subtitle", "Separator bar"));
      wrap.appendChild(el("div", "cnb-kse-hint",
        "The gold stem running through the horizontal middle of the mark " +
        "columns (the engine's keysig bar — 0.4 staff-space thick, drawn " +
        "beneath the marks). Styling here is preview-only — the engine " +
        "hard-codes its color and thickness."));

      const row = el("div", "cnb-kse-fields");

      const enable = el("label", "cnb-kse-sep-enable");
      const cb = el("input", "cnb-kse-sep-enable-check");
      cb.type = "checkbox";
      cb.checked = !!state.keySignature.separator.enabled;
      cb.onchange = (e) => { state.keySignature.separator.enabled = checkedFrom(e, cb); changed(); };
      enable.appendChild(control(cb));
      enable.appendChild(el("span", "", "show"));
      row.appendChild(enable);

      const color = el("input", "cnb-kse-sep-color");
      color.type = "color";
      color.value = state.keySignature.separator.color;
      color.title = "Separator color";
      color.oninput = (e) => {
        const v = String(valueFrom(e, color));
        if (isValidHex(v)) { state.keySignature.separator.color = v; changed(); }
      };
      row.appendChild(control(color));

      const thickness = el("input", "cnb-kse-sep-thickness");
      thickness.type = "number";
      thickness.min = "0";
      thickness.step = "1";
      thickness.value = String(state.keySignature.separator.thicknessPct);
      thickness.title = "Thickness (% of semitone height)";
      thickness.oninput = (e) => {
        const v = numberFrom(e, thickness);
        if (v !== null && v >= 0) { state.keySignature.separator.thicknessPct = v; changed(); }
      };
      row.appendChild(control(thickness));
      row.appendChild(el("span", "cnb-kse-field-unit", "% thick"));

      const extent = el("input", "cnb-kse-sep-extent");
      extent.type = "number";
      extent.step = "1";
      extent.value = String(state.keySignature.separator.extentSemis);
      extent.title = "Extent (semitones above/below the staff midpoint)";
      extent.oninput = (e) => {
        const v = numberFrom(e, extent);
        if (v !== null && v > 0) { state.keySignature.separator.extentSemis = v; changed(); }
      };
      row.appendChild(control(extent));
      row.appendChild(el("span", "cnb-kse-field-unit", "± semitones"));

      wrap.appendChild(row);
      return wrap;
    }

    function drawGutter() {
      const wrap = el("div", "cnb-kse-gutter");
      wrap.appendChild(el("div", "cnb-kse-subtitle", "Gutter sizing"));
      const row = el("div", "cnb-kse-fields");
      row.appendChild(el("span", "cnb-kse-field-label", "Padding"));
      const pad = el("input", "cnb-kse-gutter-input");
      pad.type = "number";
      pad.min = "0";
      pad.step = "1";
      pad.value = String(state.keySignature.gutter.paddingH);
      pad.title = "Horizontal padding (px) each side of the signature";
      pad.oninput = (e) => {
        const v = numberFrom(e, pad);
        if (v !== null && v >= 0) { state.keySignature.gutter.paddingH = v; changed(); }
      };
      row.appendChild(control(pad));
      row.appendChild(el("span", "cnb-kse-field-unit", "px per side"));
      wrap.appendChild(row);
      return wrap;
    }

    // ── Validation pass-through (Module A) + editor checks ───────────────
    function drawValidation() {
      const wrap = el("div", "cnb-kse-validation");
      let result;
      try {
        result = CNBConfig.validate(CNBKeySignatureEditor.applyToConfig(baseConfig, state));
      } catch (err) {
        wrap.appendChild(el("div", "cnb-kse-error", "Editor state error: " + err.message));
        return wrap;
      }
      const editorWarnings = CNBKeySignatureEditor.editorWarnings(state);
      if (result.valid && editorWarnings.length === 0) {
        wrap.appendChild(el("div", "cnb-kse-valid", "Config valid ✓"));
      }
      for (const msg of result.errors) {
        wrap.appendChild(el("div", "cnb-kse-error", msg));
      }
      for (const msg of result.warnings) {
        wrap.appendChild(el("div", "cnb-kse-warning", msg));
      }
      for (const msg of editorWarnings) {
        wrap.appendChild(el("div", "cnb-kse-warning cnb-kse-editor-warning", msg));
      }
      return wrap;
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      root.appendChild(drawKeysEnable());
      const note = drawDisabledNote();
      if (note) root.appendChild(note);
      root.appendChild(drawDefinitions());
      root.appendChild(drawSignature());
      root.appendChild(drawValidation());
    }

    redraw();
    container.appendChild(root);

    return {
      root,
      getState: () => deepClone(state),
      getKeys: () => CNBKeySignatureEditor.buildKeys(state),
      applyTo: (config) => CNBKeySignatureEditor.applyToConfig(config, state),
      setState: (partial) => { Object.assign(state, deepClone(partial)); changed(); },
      redraw,
    };
  },
};
