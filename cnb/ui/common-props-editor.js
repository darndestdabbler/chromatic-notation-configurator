/**
 * common-props-editor.js — Module 15: Common Properties Editor
 *
 * Editor for the global duration/representation settings (`config.durations`,
 * architecture plan §4.8) and the LilyPond engine settings block
 * (`config.engine`, plan §4.10). Ports the legacy partial coverage of this
 * area (legacy `configurator-core.js` only carried ENGINE_DEFAULTS and the
 * Section B emit-if-changed logic; it had no duration/representation UI at
 * all) onto the Module A schema. The legacy files are reference behavior
 * only and are not touched.
 *
 * Scope decisions for this port (session-set 005, session 3):
 *   - Duration definitions are shown as a READ-ONLY list — the spec step
 *     explicitly sanctions "read-only list or limited editing", and the
 *     identity/geometry fields (name, lilypondDuration, defaultShape,
 *     hasStem) feed Modules 8/9 and the shape importer (set 004); editing
 *     them here could dangle shape references that Module A's validate()
 *     does not check. The definitions ride through editor state and builds
 *     unchanged (deep-cloned).
 *   - `representationMode` ("shape" | "repeat") is the editable duration
 *     setting. There are no repeat counts: the preview and the export both
 *     draw the engine's fixed counts (CNBCard.repeatCount — minim ×2,
 *     semibreve ×4, breve ×4; session 18), so `durations.repeatCounts` left
 *     the editor in session 34, and a config that carries it loses it when
 *     the editor builds the durations slice.
 *   - All plan §4.10 engine fields are editable. `defaultMagnify` stays a
 *     STRING to preserve fractions (plan §4.10); accepted forms are an
 *     integer ("2"), a decimal ("1.75") or a fraction with a nonzero
 *     denominator ("7/4"). There is no stem thickness: the preview draws
 *     the engine's stem (session 34), so `engine.stemThickness` is not
 *     edited, and a config that carries it loses it when the editor builds
 *     the engine slice.
 *
 * Exporter effect of `representationMode` (LY spec §6.1, wired in Module 11
 * `CNBLilypond.sectionC`): "repeat" → every Section C clause carries
 * `(repeat . #t)` (longer durations are engraved by repeating the same
 * notehead, the engine's fixed counts); "shape" → `(repeat . #f)` (each duration
 * uses its own notehead shape). The engine settings feed Section B's
 * emit-if-changed block (LY spec §5.2): values equal to the engine defaults
 * are omitted from the export; `lilypondVersion` is always emitted as the
 * `\version` header; `useAccessibleColors` is a runtime flag that is never
 * emitted — the generated file's Section A conditional reads it when the
 * user sets it before `\include`.
 *
 * Validation policy (same split as verified Modules 13/14): the render() UI
 * only commits values that pass the field's own rules (unparsable or
 * out-of-rule input leaves state unchanged, the Module 13 numberFrom
 * precedent), while the pure build functions THROW on invalid state —
 * programmatic misuse is a caller bug, not something to silently repair:
 *   - buildDurations(): throws on a representationMode outside
 *     {"shape","repeat"} and on a non-array definitions list.
 *   - buildEngine(): throws on an empty/non-string lilypondVersion, a
 *     malformed defaultMagnify (see accepted forms above), non-finite
 *     multinotePadding / indent / collisionThreshold.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     definitions:        [...],                    // read-only passthrough
 *     representationMode: "shape" | "repeat",
 *     engine:             { lilypondVersion, falseHollow, multinotePadding,
 *                           defaultMagnify, indent, collisionThreshold,
 *                           useAccessibleColors }
 *   }
 *
 * Rendering contract (same as Modules 12–14): render() builds plain DOM via
 * document.createElement, wires events as element properties
 * (onclick/oninput/onchange) so the whole UI is exercisable in Node against
 * a stub document, and reports every state change through
 * onChange({ durations, engine }, state) where the slices are ready
 * `config.durations` / `config.engine` objects. Hosts own layout and
 * styling via the .cnb-cpe-* class hooks.
 *
 * Dependencies: Module A (validation pass-through and config plumbing).
 * renderPreview() additionally composes Module 10 (Card Collection) — the
 * spec's step 2 preview wiring ships in the module so hosts (test page now,
 * Module 19 later) only place it. In "shape" mode the collection renders
 * one captioned row per duration definition in both modes; in "repeat"
 * mode the cards draw each duration's repeated heads (session 18) and a
 * legend lists the engine's count per repeated duration.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBCard } from "../src/cnb-card.js";

/**
 * Engine defaults per plan §4.10 / LY spec §5.2 — the same table Module 11
 * judges emit-if-changed against (cnb-lilypond.js ENGINE_DEFAULTS, plus the
 * two fields that are not part of Section B's changed-block).
 */
const ENGINE_DEFAULTS = {
  lilypondVersion: "2.24.2",
  falseHollow: false,
  multinotePadding: -0.5,
  defaultMagnify: "7/4",
  indent: 0,
  collisionThreshold: 2,
  useAccessibleColors: false,
};

const REPRESENTATION_MODES = {
  shape: {
    label: "Distinct shapes per duration",
    help: "Each duration definition renders with its own notehead treatment. " +
      "The exporter's Section C emits (repeat . #f) on every clause (LY spec §6.1).",
  },
  repeat: {
    label: "Repeat the base notehead",
    help: "Longer durations are engraved by repeating the base-duration notehead " +
      "(minim ×2, semibreve ×4, breve ×4), as the preview shows. The exporter's Section C emits (repeat . #t) on every " +
      "clause (LY spec §6.1).",
  },
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/** Accepted defaultMagnify forms: integer, decimal, or fraction N/M (M ≠ 0). */
function isValidMagnify(str) {
  if (typeof str !== "string") return false;
  if (/^\d+(\.\d+)?$/.test(str)) return true;
  const frac = str.match(/^(\d+)\/(\d+)$/);
  return !!frac && Number(frac[2]) !== 0;
}

export const CNBCommonPropsEditor = {

  ENGINE_DEFAULTS,
  REPRESENTATION_MODES,

  /**
   * Build a ready `config.durations` slice (plan §4.8) from editor state.
   * Pure function; throws on invalid state rather than guessing.
   * @param {object} state
   * @returns {object} config.durations object
   */
  buildDurations(state) {
    if (!Array.isArray(state.definitions)) {
      throw new Error("Duration definitions must be an array");
    }
    const mode = state.representationMode;
    if (mode !== "shape" && mode !== "repeat") {
      throw new Error(`Invalid representationMode ${JSON.stringify(mode)} — must be "shape" or "repeat"`);
    }
    return {
      definitions: deepClone(state.definitions),
      representationMode: mode,
    };
  },

  /**
   * Build a ready `config.engine` slice (plan §4.10) from editor state.
   * Pure function; throws on invalid state rather than guessing.
   * @param {object} state
   * @returns {object} config.engine object
   */
  buildEngine(state) {
    const e = state.engine || {};
    if (typeof e.lilypondVersion !== "string" || e.lilypondVersion.length === 0) {
      throw new Error(`Invalid lilypondVersion ${JSON.stringify(e.lilypondVersion)} — must be a non-empty string`);
    }
    if (!isValidMagnify(e.defaultMagnify)) {
      throw new Error(`Invalid defaultMagnify ${JSON.stringify(e.defaultMagnify)} — must be an integer, decimal, or N/M fraction string with a nonzero denominator`);
    }
    for (const field of ["multinotePadding", "indent", "collisionThreshold"]) {
      if (typeof e[field] !== "number" || !Number.isFinite(e[field])) {
        throw new Error(`Invalid ${field} ${JSON.stringify(e[field])} — must be a finite number`);
      }
    }
    return {
      lilypondVersion: e.lilypondVersion,
      falseHollow: !!e.falseHollow,
      multinotePadding: e.multinotePadding,
      defaultMagnify: e.defaultMagnify,
      indent: e.indent,
      collisionThreshold: e.collisionThreshold,
      useAccessibleColors: !!e.useAccessibleColors,
    };
  },

  /**
   * Apply an editor state to a config: returns a new config with the
   * durations and engine sections replaced (all other sections untouched).
   * Neither argument is mutated.
   * @param {object} config
   * @param {object} state
   * @returns {object}
   */
  applyToConfig(config, state) {
    const out = CNBConfig.clone(config);
    out.durations = CNBCommonPropsEditor.buildDurations(state);
    out.engine = CNBCommonPropsEditor.buildEngine(state);
    return out;
  },

  /**
   * Recover an editor state from a config (inverse of applyToConfig for the
   * durations/engine slices). Missing engine fields fall back to the plan
   * §4.10 defaults.
   * @param {object} config
   * @returns {object} editor state
   */
  stateFromConfig(config) {
    const durations = (config && config.durations) || {};
    const engine = (config && config.engine) || {};
    return {
      definitions: deepClone(durations.definitions || []),
      representationMode: durations.representationMode === "repeat" ? "repeat" : "shape",
      engine: { ...deepClone(ENGINE_DEFAULTS), ...deepClone(engine) },
    };
  },

  /**
   * Render the common properties editor into a container.
   *
   * Structure (all styling left to the host via class hooks):
   *   div.cnb-common-props-editor
   *   ├── div.cnb-cpe-durations   (read-only duration definition rows)
   *   ├── div.cnb-cpe-mode        (representationMode options + inline help)
   *   ├── div.cnb-cpe-engine      (plan §4.10 fields + emit-if-changed badges)
   *   └── div.cnb-cpe-validation  (CNBConfig.validate pass-through)
   *
   * Events are wired as element properties (onclick/oninput/onchange) so the
   * editor is fully drivable in Node tests via a stub document.
   *
   * @param {HTMLElement} container
   * @param {{config?:object, onChange?:(slices:{durations:object,engine:object}, state:object)=>void}} [opts]
   *        `config` seeds the editor state and is the base for the validation
   *        pass-through (defaults to CNBConfig.createDefault()).
   * @returns {{root:HTMLElement, getState:()=>object, getDurations:()=>object,
   *            getEngine:()=>object, applyTo:(config:object)=>object,
   *            setState:(partial:object)=>void, redraw:()=>void}}
   */
  render(container, opts = {}) {
    const doc = globalThis.document;
    const baseConfig = opts.config ? CNBConfig.clone(opts.config) : CNBConfig.createDefault();
    const state = CNBCommonPropsEditor.stateFromConfig(baseConfig);
    const onChange = opts.onChange || (() => {});

    const root = doc.createElement("div");
    root.className = "cnb-common-props-editor";

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
      onChange(
        {
          durations: CNBCommonPropsEditor.buildDurations(state),
          engine: CNBCommonPropsEditor.buildEngine(state),
        },
        deepClone(state)
      );
    };

    // ── Duration definitions (read-only list) ────────────────────────────
    function drawDurations() {
      const wrap = el("div", "cnb-cpe-section cnb-cpe-durations");
      wrap.appendChild(el("div", "cnb-cpe-title", "Duration definitions"));
      wrap.appendChild(el("div", "cnb-cpe-hint",
        "Read-only in this editor (spec: read-only list) — default shapes " +
        "come from the SVG importer (Module 16) and notehead rules (Module 14)."));
      for (const def of state.definitions) {
        const row = el("div", "cnb-cpe-def-row",
          def.displayName + " — LilyPond duration " + def.lilypondDuration +
          " · shape \"" + def.defaultShape + "\"" +
          " · " + (def.defaultHollow ? "hollow" : "solid") +
          " · " + (def.hasStem ? "stem" : "stemless"));
        row.setAttribute("data-duration", def.name);
        wrap.appendChild(row);
      }
      return wrap;
    }

    // ── Representation mode ──────────────────────────────────────────────
    function drawMode() {
      const wrap = el("div", "cnb-cpe-section cnb-cpe-mode");
      wrap.appendChild(el("div", "cnb-cpe-title", "Duration representation mode"));
      for (const [key, def] of Object.entries(REPRESENTATION_MODES)) {
        const opt = el("div", "cnb-cpe-mode-option" +
          (state.representationMode === key ? " selected" : ""),
          key + " — " + def.label);
        opt.setAttribute("data-mode", key);
        opt.onclick = () => { state.representationMode = key; changed(); };
        wrap.appendChild(opt);
      }
      wrap.appendChild(el("div", "cnb-cpe-mode-help",
        REPRESENTATION_MODES[state.representationMode].help));
      return wrap;
    }

    // ── Engine settings ──────────────────────────────────────────────────

    /** Emit-if-changed badge text for a Section B engine field. */
    function emitBadge(field) {
      const same = JSON.stringify(state.engine[field]) === JSON.stringify(ENGINE_DEFAULTS[field]);
      return same ? "engine default — omitted at export" : "non-default — will be emitted";
    }

    function engineRow(labelText, fieldClass, control, badgeText) {
      const row = el("div", "cnb-cpe-engine-row " + fieldClass);
      row.appendChild(el("span", "cnb-cpe-engine-label", labelText));
      row.appendChild(control);
      row.appendChild(el("span", "cnb-cpe-badge", badgeText));
      return row;
    }

    function textInput(className, value, commit) {
      const input = el("input", className);
      input.type = "text";
      input.value = value;
      input.oninput = (e) => commit(valueFrom(e, input));
      return input;
    }

    function numInput(className, value, step, commit) {
      const input = el("input", className);
      input.type = "number";
      input.step = step;
      input.value = String(value);
      input.oninput = (e) => {
        const v = numberFrom(e, input);
        if (v !== null) commit(v);
      };
      return input;
    }

    function boolInput(className, checked, commit) {
      const input = el("input", className);
      input.type = "checkbox";
      input.checked = checked;
      input.onchange = (e) => commit(checkedFrom(e, input));
      return input;
    }

    function drawEngine() {
      const wrap = el("div", "cnb-cpe-section cnb-cpe-engine");
      wrap.appendChild(el("div", "cnb-cpe-title", "LilyPond engine settings"));
      wrap.appendChild(el("div", "cnb-cpe-hint",
        "Section B uses emit-if-changed (LY spec §5.2): values at engine " +
        "defaults are omitted from the export."));

      wrap.appendChild(engineRow("LilyPond version", "cnb-cpe-row-version",
        textInput("cnb-cpe-lilypond-version", state.engine.lilypondVersion, (v) => {
          // Commit only non-empty strings (empty would make buildEngine throw).
          if (typeof v === "string" && v.length > 0) { state.engine.lilypondVersion = v; changed(); }
        }),
        "always emitted — the \\version header"));

      wrap.appendChild(engineRow("False hollow", "cnb-cpe-row-false-hollow",
        boolInput("cnb-cpe-false-hollow", !!state.engine.falseHollow, (v) => {
          state.engine.falseHollow = v; changed();
        }),
        emitBadge("falseHollow")));

      wrap.appendChild(engineRow("Multinote padding", "cnb-cpe-row-multinote",
        numInput("cnb-cpe-multinote-padding", state.engine.multinotePadding, "0.1", (v) => {
          state.engine.multinotePadding = v; changed();
        }),
        emitBadge("multinotePadding")));

      wrap.appendChild(engineRow("Default magnify", "cnb-cpe-row-magnify",
        textInput("cnb-cpe-default-magnify", state.engine.defaultMagnify, (v) => {
          // Commit only valid magnify forms (integer / decimal / N/M fraction).
          if (isValidMagnify(v)) { state.engine.defaultMagnify = v; changed(); }
        }),
        emitBadge("defaultMagnify")));

      wrap.appendChild(engineRow("Indent", "cnb-cpe-row-indent",
        numInput("cnb-cpe-indent", state.engine.indent, "1", (v) => {
          state.engine.indent = v; changed();
        }),
        emitBadge("indent")));

      wrap.appendChild(engineRow("Collision threshold", "cnb-cpe-row-collision",
        numInput("cnb-cpe-collision-threshold", state.engine.collisionThreshold, "1", (v) => {
          state.engine.collisionThreshold = v; changed();
        }),
        emitBadge("collisionThreshold")));

      wrap.appendChild(engineRow("Use accessible colors", "cnb-cpe-row-accessible",
        boolInput("cnb-cpe-accessible", !!state.engine.useAccessibleColors, (v) => {
          state.engine.useAccessibleColors = v; changed();
        }),
        "runtime flag — not exported; set before \\include"));

      return wrap;
    }

    // ── Validation pass-through (Module A) ───────────────────────────────
    function drawValidation() {
      const wrap = el("div", "cnb-cpe-validation");
      let result;
      try {
        result = CNBConfig.validate(CNBCommonPropsEditor.applyToConfig(baseConfig, state));
      } catch (err) {
        wrap.appendChild(el("div", "cnb-cpe-error", "Editor state error: " + err.message));
        return wrap;
      }
      if (result.valid) {
        wrap.appendChild(el("div", "cnb-cpe-valid", "Config valid ✓"));
      }
      for (const msg of result.errors) {
        wrap.appendChild(el("div", "cnb-cpe-error", msg));
      }
      for (const msg of result.warnings) {
        wrap.appendChild(el("div", "cnb-cpe-warning", msg));
      }
      return wrap;
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      root.appendChild(drawDurations());
      root.appendChild(drawMode());
      root.appendChild(drawEngine());
      root.appendChild(drawValidation());
    }

    redraw();
    container.appendChild(root);

    return {
      root,
      getState: () => deepClone(state),
      getDurations: () => CNBCommonPropsEditor.buildDurations(state),
      getEngine: () => CNBCommonPropsEditor.buildEngine(state),
      applyTo: (config) => CNBCommonPropsEditor.applyToConfig(config, state),
      setState: (partial) => { Object.assign(state, deepClone(partial)); changed(); },
      redraw,
    };
  },

  /**
   * Render a representation-mode-aware preview for a config through Module
   * 10 (Card Collection):
   *
   *   - representationMode "shape": one captioned collection row per
   *     duration definition — distinct notehead treatment (shape rules,
   *     hollowness, stems) per duration is directly visible.
   *   - representationMode "repeat": the same rows, whose cards draw each
   *     duration's repeated heads as the engine engraves them (session 18),
   *     plus a legend with one item per repeated duration ("Minim (Half):
   *     2 heads"), the count from CNBCard.repeatCount.
   *
   * Throws on a config with no duration definitions or an invalid
   * representationMode — a preview of a guessed mode helps nobody.
   *
   * @param {HTMLElement} host  container the preview is appended to
   * @param {object} config     full CNB config
   * @param {{pitchClasses?:number[]}} [opts]  forwarded to CNBCollection.render
   * @returns {{root:HTMLElement, mode:string, durationsShown:string[],
   *            legendItems:Array<{name:string, count:number}>,
   *            collectionRoot:HTMLElement}}
   */
  renderPreview(host, config, opts = {}) {
    const doc = globalThis.document;
    const durations = (config && config.durations) || {};
    const defs = durations.definitions || [];
    if (defs.length === 0) {
      throw new Error("Cannot preview: config.durations.definitions is empty");
    }
    const mode = durations.representationMode;
    if (mode !== "shape" && mode !== "repeat") {
      throw new Error(`Cannot preview: invalid representationMode ${JSON.stringify(mode)}`);
    }

    const root = doc.createElement("div");
    root.className = "cnb-cpe-preview";

    const note = doc.createElement("div");
    note.className = "cnb-cpe-preview-note";
    note.textContent = mode === "shape"
      ? "Mode \"shape\": one row per duration — export emits (repeat . #f)."
      : "Mode \"repeat\": each longer duration draws the heads the engine " +
        "engraves (legend) — export emits (repeat . #t).";
    root.appendChild(note);

    const legendItems = [];
    if (mode === "repeat") {
      const legend = doc.createElement("div");
      legend.className = "cnb-cpe-repeat-legend";
      for (const def of defs) {
        const count = CNBCard.repeatCount(config, def.name);
        if (count === 1) continue;
        const item = doc.createElement("div");
        item.className = "cnb-cpe-repeat-item";
        item.setAttribute("data-duration", def.name);
        item.textContent = def.displayName + ": " + count + " heads";
        legend.appendChild(item);
        legendItems.push({ name: def.name, count });
      }
      root.appendChild(legend);
    }

    const durationsShown = defs.map(d => d.name);
    const collectionOpts = { durations: durationsShown };
    if (opts.pitchClasses) collectionOpts.pitchClasses = opts.pitchClasses;
    const collectionRoot = CNBCollection.render(root, config, collectionOpts);

    host.appendChild(root);
    return { root, mode, durationsShown, legendItems, collectionRoot };
  },
};
