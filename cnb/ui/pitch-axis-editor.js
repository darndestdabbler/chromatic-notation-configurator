/**
 * pitch-axis-editor.js — Pitch Axis Editor (set 014, session 4)
 *
 * Edits the optional `config.pitchAxis` section (architecture plan §4.13,
 * design docs/planning/pitch-axis-design.md §1.1): the enable gate, the map
 * kind, octaveStride, axisUnitsPerStaffSpace and the explicit per-pitch-class
 * positions. It also offers one preset, "Twinline-like 7-position", which
 * compiles into the explicit map plus a named notehead rule that carries the
 * shared-pair `xOffsetStaffSpaces` disambiguation (design §1.1 / §3). The
 * schema carries no mode taxonomy, so a preset is only a way to fill in
 * values. Once applied, the section is an ordinary explicit map.
 *
 * Default-off byte-identity (design §1.3): `createDefault()` has no
 * pitchAxis section, and an absent section is a fully defined state. This
 * editor therefore never CREATES the section unless the user enables the
 * axis or applies a preset (`state.present`). Opening and closing the
 * panel on a default config leaves the config unchanged.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     present: boolean,               // write a pitchAxis section at all
 *     enabled: boolean,
 *     kind: string,                   // "pitch-class-map-v1"
 *     octaveStride: number,
 *     axisUnitsPerStaffSpace: number,
 *     positions: number[12]           // position of pc 0..11
 *   }
 *
 * A section that is absent or malformed opens as the linear degeneracy
 * (positions 0..11, stride 12, units = staff.semitonesPerStaffSpace). So
 * enabling the axis without other edits renders exactly like the linear
 * staff, and the user starts from a known geometry.
 *
 * Range problems the user can type in (stride 0, a non-monotonic map) are
 * reported through the Module A validation pass-through (PA-1…PA-8). Only a
 * structurally invalid STATE (non-finite numbers, wrong position count)
 * throws from the pure builders, because that is a caller bug.
 *
 * Rendering contract (same as Modules 12–17): render() builds plain DOM via
 * document.createElement and wires events as element properties, so the UI
 * runs in Node against a stub document. Every state change is reported
 * through onChange({ pitchAxis, noteheadRules? }, state). `pitchAxis` is a
 * ready section, or null when the section should be absent. `noteheadRules`
 * is present only when a preset changed the rules.
 *
 * Dependencies: Module A (clone, validation pass-through).
 */

import { CNBConfig } from "../src/cnb-config.js";

// ─── Pure helpers ────────────────────────────────────────────────────────────

const KIND = "pitch-class-map-v1";
const PC_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/** Presets. Each compiles into an explicit map plus one named offset rule. */
const PRESETS = {
  "twinline-7": {
    displayName: "Twinline-like 7-position",
    // Design §1.1 map: five shared-position pairs (C,C♯) (D♯,E) (F,F♯)
    // (G♯,A) (A♯,B); D and G unshared.
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    positions: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6],
    // The upper member of each shared pair sits right by the spike's
    // measured +0.85 staff spaces (design §3, session-3 round-trip).
    offsetRule: {
      name: "Twinline preset: upper member of each shared position sits right",
      pitchClasses: [1, 4, 6, 9, 11],
      xOffsetStaffSpaces: 0.85,
    },
  },
};

export const CNBPitchAxisEditor = {

  KIND,
  PRESETS,

  /**
   * Build a ready `config.pitchAxis` section from editor state. Pure;
   * throws on structurally invalid state (see module header).
   * @param {object} state
   * @returns {object} config.pitchAxis object
   */
  buildPitchAxis(state) {
    if (!isPlainObject(state)) {
      throw new Error("Pitch axis editor state must be an object");
    }
    if (typeof state.kind !== "string") {
      throw new Error(`pitchAxis.kind must be a string (got ${JSON.stringify(state.kind)})`);
    }
    for (const field of ["octaveStride", "axisUnitsPerStaffSpace"]) {
      if (!isFiniteNumber(state[field])) {
        throw new Error(`pitchAxis.${field} must be a finite number (got ${JSON.stringify(state[field])})`);
      }
    }
    if (!Array.isArray(state.positions) || state.positions.length !== 12 ||
        !state.positions.every(isFiniteNumber)) {
      throw new Error("pitchAxis positions must be an array of 12 finite numbers");
    }
    return {
      enabled: !!state.enabled,
      kind: state.kind,
      octaveStride: state.octaveStride,
      axisUnitsPerStaffSpace: state.axisUnitsPerStaffSpace,
      pitchClasses: state.positions.map((position, pc) => ({ pc, position })),
    };
  },

  /**
   * Apply an editor state to a config. Returns a new config with the
   * pitchAxis section replaced, or removed when `state.present` is false.
   * No other section is touched, and neither argument is mutated.
   */
  applyToConfig(config, state) {
    const out = CNBConfig.clone(config);
    if (state && state.present) {
      out.pitchAxis = CNBPitchAxisEditor.buildPitchAxis(state);
    } else {
      delete out.pitchAxis;
    }
    return out;
  },

  /**
   * Recover an editor state from a config. An absent section, a malformed
   * one, or one with a malformed map opens as the linear degeneracy (see
   * module header). Fields that are present are kept even when Module A
   * would reject their values, so that validation can report them.
   */
  stateFromConfig(config) {
    const sps = config && isPlainObject(config.staff) && isFiniteNumber(config.staff.semitonesPerStaffSpace)
      ? config.staff.semitonesPerStaffSpace
      : 4;
    const pa = config && isPlainObject(config.pitchAxis) ? config.pitchAxis : null;
    const positions = Array.from({ length: 12 }, (_, pc) => pc);
    if (pa && Array.isArray(pa.pitchClasses)) {
      for (const entry of pa.pitchClasses) {
        if (isPlainObject(entry) && Number.isInteger(entry.pc) && entry.pc >= 0 && entry.pc < 12 &&
            isFiniteNumber(entry.position)) {
          positions[entry.pc] = entry.position;
        }
      }
    }
    return {
      present: !!pa,
      enabled: !!(pa && pa.enabled),
      kind: pa && typeof pa.kind === "string" ? pa.kind : KIND,
      octaveStride: pa && isFiniteNumber(pa.octaveStride) ? pa.octaveStride : 12,
      axisUnitsPerStaffSpace: pa && isFiniteNumber(pa.axisUnitsPerStaffSpace) ? pa.axisUnitsPerStaffSpace : sps,
      positions,
    };
  },

  /**
   * Compile a preset against a config. Returns { pitchAxis, noteheadRules }.
   * pitchAxis is the enabled explicit map. noteheadRules is the config's
   * rules with the preset's named offset rule appended at the highest
   * priority. An earlier copy of that rule (matched by name) is dropped
   * first, so applying the preset again does not duplicate it. Pure.
   */
  applyPreset(config, presetId) {
    const preset = PRESETS[presetId];
    if (!preset) throw new Error(`Unknown pitch axis preset ${JSON.stringify(presetId)}`);
    const pitchAxis = CNBPitchAxisEditor.buildPitchAxis({
      enabled: true,
      kind: KIND,
      octaveStride: preset.octaveStride,
      axisUnitsPerStaffSpace: preset.axisUnitsPerStaffSpace,
      positions: preset.positions,
    });
    const others = (Array.isArray(config && config.noteheadRules) ? deepClone(config.noteheadRules) : [])
      .filter((r) => !(r && r.name === preset.offsetRule.name));
    const maxPriority = others.reduce((m, r) => Math.max(m, isFiniteNumber(r && r.priority) ? r.priority : 0), 0);
    const noteheadRules = others.concat([{
      name: preset.offsetRule.name,
      priority: maxPriority + 1,
      match: { pitchClasses: preset.offsetRule.pitchClasses.slice(), durations: "all", keys: "all" },
      apply: { xOffsetStaffSpaces: preset.offsetRule.xOffsetStaffSpaces },
    }]);
    return { pitchAxis, noteheadRules };
  },

  /**
   * Render the pitch axis editor into a container.
   *
   * Structure (styling left to the host via class hooks):
   *   div.cnb-pitch-axis-editor
   *   ├── label.cnb-pae-enable        (enable checkbox)
   *   ├── div.cnb-pae-preset          (preset select + apply button)
   *   ├── div.cnb-pae-fields          (kind select, stride, units per staff space)
   *   ├── div.cnb-pae-positions       (12 per-pc position inputs)
   *   └── div.cnb-pae-validation      (CNBConfig.validate pass-through)
   *
   * @param {HTMLElement} container
   * @param {{config?:object,
   *          onChange?:(slices:{pitchAxis:object|null, noteheadRules?:object[]}, state:object)=>void}} [opts]
   * @returns {{root:HTMLElement, getState:()=>object, getPitchAxis:()=>object|null,
   *            applyTo:(config:object)=>object, applyPreset:(id:string)=>void, redraw:()=>void}}
   */
  render(container, opts = {}) {
    const doc = globalThis.document;
    const baseConfig = opts.config ? CNBConfig.clone(opts.config) : CNBConfig.createDefault();
    const state = CNBPitchAxisEditor.stateFromConfig(baseConfig);
    const onChange = opts.onChange || (() => {});

    const root = doc.createElement("div");
    root.className = "cnb-pitch-axis-editor";

    const el = (tag, className, text) => {
      const e = doc.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };

    const valueFrom = (e, input) =>
      (e && e.target && e.target.value !== undefined) ? e.target.value : input.value;

    const numberFrom = (e, input) => {
      const v = parseFloat(valueFrom(e, input));
      return Number.isFinite(v) ? v : null;
    };

    const sliceOf = () => (state.present ? CNBPitchAxisEditor.buildPitchAxis(state) : null);

    const changed = (extra) => {
      redraw();
      onChange(Object.assign({ pitchAxis: sliceOf() }, extra || {}), deepClone(state));
    };

    let presetId = Object.keys(PRESETS)[0];

    function applyPreset(id) {
      const result = CNBPitchAxisEditor.applyPreset(baseConfig, id);
      baseConfig.noteheadRules = result.noteheadRules;   // validation reads the new rules
      Object.assign(state, CNBPitchAxisEditor.stateFromConfig({ staff: baseConfig.staff, pitchAxis: result.pitchAxis }));
      changed({ noteheadRules: deepClone(result.noteheadRules) });
    }

    function numberInput(className, value, title, onValue) {
      const input = el("input", className);
      input.type = "number";
      input.step = "any";
      input.value = String(value);
      input.title = title;
      // onchange, not oninput: changed() redraws the panel, and redrawing on
      // every keystroke would replace the input the user is typing into.
      input.onchange = (e) => {
        const v = numberFrom(e, input);
        if (v !== null) onValue(v);
      };
      return input;
    }

    // ── Enable toggle ────────────────────────────────────────────────────
    function drawEnable() {
      const label = el("label", "cnb-pae-enable");
      const cb = el("input", "cnb-pae-enable-check");
      cb.type = "checkbox";
      cb.checked = !!state.enabled;
      cb.onchange = (e) => {
        state.enabled = e && e.target && e.target.checked !== undefined ? !!e.target.checked : !!cb.checked;
        if (state.enabled) state.present = true;
        changed();
      };
      label.appendChild(cb);
      label.appendChild(el("span", "cnb-pae-enable-text",
        "Enable pitch axis (map pitch classes to staff positions; several may share one)"));
      return label;
    }

    // ── Preset ───────────────────────────────────────────────────────────
    function drawPreset() {
      const wrap = el("div", "cnb-pae-section cnb-pae-preset");
      wrap.appendChild(el("div", "cnb-pae-title", "Preset"));
      wrap.appendChild(el("div", "cnb-pae-hint",
        "Fills in the map below and adds a notehead rule that offsets the upper " +
        "member of each shared position. Everything stays editable afterwards."));
      const sel = el("select", "cnb-pae-preset-select");
      for (const [id, p] of Object.entries(PRESETS)) {
        const o = el("option", null, p.displayName);
        o.value = id;
        if (id === presetId) o.selected = true;
        sel.appendChild(o);
      }
      sel.value = presetId;
      sel.onchange = (e) => { presetId = valueFrom(e, sel); };
      wrap.appendChild(sel);
      const btn = el("button", "cnb-pae-preset-apply", "Apply preset");
      btn.type = "button";
      btn.onclick = () => applyPreset(presetId);
      wrap.appendChild(btn);
      return wrap;
    }

    // ── Kind, stride, unit contract ──────────────────────────────────────
    function drawFields() {
      const wrap = el("div", "cnb-pae-section cnb-pae-fields");
      wrap.appendChild(el("div", "cnb-pae-title", "Axis"));

      const kindRow = el("label", "cnb-pae-field");
      kindRow.appendChild(el("span", "cnb-pae-label", "Kind"));
      const kind = el("select", "cnb-pae-kind-select");
      const kinds = state.kind === KIND ? [KIND] : [KIND, state.kind];   // keep an unknown loaded kind visible
      for (const k of kinds) {
        const o = el("option", null, k);
        o.value = k;
        if (k === state.kind) o.selected = true;
        kind.appendChild(o);
      }
      kind.value = state.kind;
      kind.onchange = (e) => { state.kind = valueFrom(e, kind); changed(); };
      kindRow.appendChild(kind);
      wrap.appendChild(kindRow);

      const strideRow = el("label", "cnb-pae-field");
      strideRow.appendChild(el("span", "cnb-pae-label", "Positions per octave (octaveStride)"));
      strideRow.appendChild(numberInput("cnb-pae-stride-input", state.octaveStride,
        "Axis positions advance by this much per octave (linear = 12)",
        (v) => { state.octaveStride = v; changed(); }));
      wrap.appendChild(strideRow);

      const unitsRow = el("label", "cnb-pae-field");
      unitsRow.appendChild(el("span", "cnb-pae-label", "Axis units per staff space"));
      unitsRow.appendChild(numberInput("cnb-pae-units-input", state.axisUnitsPerStaffSpace,
        "Replaces staff.semitonesPerStaffSpace in staff-space conversions while enabled",
        (v) => { state.axisUnitsPerStaffSpace = v; changed(); }));
      wrap.appendChild(unitsRow);
      return wrap;
    }

    // ── Per-pc positions ─────────────────────────────────────────────────
    function drawPositions() {
      const wrap = el("div", "cnb-pae-section cnb-pae-positions");
      wrap.appendChild(el("div", "cnb-pae-title", "Position of each pitch class"));
      wrap.appendChild(el("div", "cnb-pae-hint",
        "Axis units within the octave. Equal values share a staff position; " +
        "fractions are allowed. The map must not decrease from C to B."));
      for (let pc = 0; pc < 12; pc++) {
        const row = el("label", "cnb-pae-position");
        row.setAttribute("data-pc", pc);
        row.appendChild(el("span", "cnb-pae-pc-name", PC_NAMES[pc]));
        row.appendChild(numberInput("cnb-pae-position-input", state.positions[pc],
          `Axis position of ${PC_NAMES[pc]}`,
          (v) => { state.positions[pc] = v; changed(); }));
        wrap.appendChild(row);
      }
      return wrap;
    }

    // ── Validation pass-through (Module A) ───────────────────────────────
    function drawValidation() {
      const wrap = el("div", "cnb-pae-validation");
      let result;
      try {
        result = CNBConfig.validate(CNBPitchAxisEditor.applyToConfig(baseConfig, state));
      } catch (err) {
        wrap.appendChild(el("div", "cnb-pae-error", "Editor state error: " + err.message));
        return wrap;
      }
      if (result.valid) wrap.appendChild(el("div", "cnb-pae-valid", "Config valid ✓"));
      for (const msg of result.errors) wrap.appendChild(el("div", "cnb-pae-error", msg));
      for (const msg of result.warnings) wrap.appendChild(el("div", "cnb-pae-warning", msg));
      return wrap;
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      root.appendChild(drawEnable());
      root.appendChild(drawPreset());
      root.appendChild(drawFields());
      root.appendChild(drawPositions());
      root.appendChild(drawValidation());
    }

    redraw();
    container.appendChild(root);

    return {
      root,
      getState: () => deepClone(state),
      getPitchAxis: sliceOf,
      applyTo: (config) => CNBPitchAxisEditor.applyToConfig(config, state),
      applyPreset,
      redraw,
    };
  },
};
