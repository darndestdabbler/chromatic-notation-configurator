/**
 * staff-rule-editor.js — Module 13: Staff/Ledger Rule Editor
 *
 * Ports the legacy "Staff rules panel" (`legacy/chromatic-configurator.html`
 * STAFF PANEL + EditPopup._buildStaffForm + renderStaffCard, and the derived
 * panel driven by `legacy/configurator-core.js` deriveSemitonesPerStaffSpace)
 * onto the Module A config schema (architecture plan §4.3–4.4). The legacy
 * files are reference behavior only and are not touched.
 *
 * Schema reconciliation (legacy → Module A), decided for this port:
 *   - Legacy kept one first-match-wins `staffRules` list with rule types
 *     'staff' | 'ledger' | 'none'. Module A splits this: 'staff' rule
 *     pitchClasses become `staff.semitonePattern`; each 'ledger' rule
 *     { pitchClasses: [p], override: [pcs] } becomes a template
 *     { semiWithinOctave: p, triggerPCs: pcs, triggerMode: "override" };
 *     a legacy ledger with override = null ("All — auto proximity") becomes
 *     triggerMode "proximity". The 'none' type existed only to mask
 *     later first-match-wins rules and has no equivalent — the pattern and
 *     templates are explicit, so nothing needs masking.
 *   - Legacy derived semitones-per-staff-space with a GCD over consecutive
 *     staff offsets including the octave wrap (Core.deriveSemitonesPerStaffSpace);
 *     that algorithm is ported verbatim in derivedGeometry(). Legacy
 *     deriveStaffLinePositions() however emitted a FIXED symmetric ±2/±4/±6
 *     list that ignored the actual offsets — that drifted from the plan.
 *     Here the derived panel uses the plan §4.3 formula
 *     (S - midpoint) / semitonesPerStaffSpace over octaves 0–1, which is
 *     exactly Module 11's computeStaffLinePositions(), so the panel always
 *     agrees with the exporter (parity is unit-tested).
 *   - `staff.midpoint` is the center of the two-octave octave-chord card
 *     range (semis 0–24), i.e. 12, for every pattern — both plan examples
 *     (4-8 and 3-6-9) use it and the card/stem modules assume it.
 *   - Legacy line styling lived in a shared named-styles table (App.styles);
 *     Module A replaces that with staff/ledger lineDefaults plus sparse
 *     per-position lineOverrides, which this editor edits directly.
 *   - `ledgers.lineOverrides` (per-template styling overrides) are preserved
 *     through the editor state but have no editing UI in this session; the
 *     staff-side lineOverrides UI is the spec deliverable.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     patternKey:     "4-8" | "3-6-9" | "custom",
 *     customPattern:  number[],            // active when patternKey==="custom"
 *     lineDefaults:   { thicknessPct, style, color },          // staff
 *     lineOverrides:  { [semiWithinOctave]: {thicknessPct?, style?, color?} },
 *     templates:      [{ semiWithinOctave, triggerPCs, triggerMode }],
 *     proximityRule:  boolean,
 *     ledgerDefaults: { thicknessPct, widthMultiplier, style, color, roundedEnds },
 *     ledgerOverrides:{ ... }                                   // passthrough
 *   }
 *
 * Rendering contract (same as Module 12): render() builds plain DOM via
 * document.createElement, wires events as element properties
 * (onclick/oninput/onchange) so the whole UI is exercisable in Node against a
 * stub document, and reports every state change through
 * onChange({ staff, ledgers }, state) where the slices are ready
 * `config.staff` / `config.ledgers` objects. Hosts own layout and styling via
 * the .cnb-sre-* class hooks.
 *
 * Dependencies: Module A (validation pass-through and config plumbing).
 * renderPreview() additionally composes Module 1 (grid), Module 3 (staff) and
 * Module 5 (ledger set) — the spec's step 3 live-preview wiring ships in the
 * module so hosts (test page now, Module 19 later) only place it. The preview
 * renders example notes (chromatic run) as plain marker dots; example data is
 * not config (design principle #1) and noteheads are Module 6's job.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBLedgerSet } from "../src/cnb-ledger-set.js";

// Pitch-class labels (kept inline like Module 12 so the editor core adds no
// dependency beyond Module A).
const PC_LABELS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

const LINE_STYLES = ["solid", "dashed", "dotted"];

/**
 * Staff pattern presets. "4-8" is the default config's system; "3-6-9" is
 * the plan's worked alternative (gap systems exercise the no-hard-gate
 * ledger rules). Anything else is edited as "custom".
 */
const STAFF_PATTERN_PRESETS = {
  "4-8":   { label: "4–8 (E, G♯) — 2 lines per octave",     pattern: [4, 8] },
  "3-6-9": { label: "3–6–9 (D♯, F♯, A) — 3 lines per octave", pattern: [3, 6, 9] },
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

function gcd2(a, b) {
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/**
 * Sort, dedupe and validate a semitone-within-octave pattern.
 * Throws on non-integer or out-of-range entries — invalid pattern input is a
 * caller bug, not something to silently repair.
 */
function sanitizePattern(pattern) {
  if (!Array.isArray(pattern)) {
    throw new Error("Staff pattern must be an array of semitones (0–11)");
  }
  for (const p of pattern) {
    if (!Number.isInteger(p) || p < 0 || p > 11) {
      throw new Error(`Invalid staff pattern entry ${JSON.stringify(p)} — must be an integer 0–11`);
    }
  }
  return [...new Set(pattern)].sort((a, b) => a - b);
}

/** The effective semitone pattern for an editor state. */
function patternOf(state) {
  if (state.patternKey === "custom") return sanitizePattern(state.customPattern || []);
  const preset = STAFF_PATTERN_PRESETS[state.patternKey];
  if (!preset) {
    throw new Error(`Unknown staff pattern key "${state.patternKey}"`);
  }
  return preset.pattern.slice();
}

/** Drop override entries that carry no fields. */
function pruneOverrides(overrides) {
  const out = {};
  for (const [key, val] of Object.entries(overrides || {})) {
    if (val && typeof val === "object" && Object.keys(val).length > 0) {
      out[key] = deepClone(val);
    }
  }
  return out;
}

export const CNBStaffRuleEditor = {

  STAFF_PATTERN_PRESETS,
  PC_LABELS,
  LINE_STYLES,

  /**
   * Derive staff geometry from a semitone-within-octave pattern.
   *
   * semitonesPerStaffSpace: GCD of consecutive pattern gaps including the
   * octave wrap-around (legacy Core.deriveSemitonesPerStaffSpace, ported
   * verbatim; 1 for degenerate patterns of fewer than 2 lines).
   * midpoint: 12 — center of the two-octave card range (see module header).
   * lyPositions: the plan §4.3 / Module 11 formula over octaves 0–1.
   *
   * @param {number[]} pattern  semitone-within-octave positions (0–11)
   * @returns {{semitonePattern:number[], midpoint:number,
   *            semitonesPerStaffSpace:number, lyPositions:number[]}}
   */
  derivedGeometry(pattern) {
    const cleaned = sanitizePattern(pattern);
    const midpoint = 12;

    let sps = 1;
    if (cleaned.length >= 2) {
      const diffs = [];
      for (let i = 1; i < cleaned.length; i++) diffs.push(cleaned[i] - cleaned[i - 1]);
      diffs.push(12 - cleaned[cleaned.length - 1] + cleaned[0]);
      sps = diffs.reduce(gcd2);
    }

    const lyPositions = [];
    for (const oct of [0, 1]) {
      for (const s of cleaned) lyPositions.push((s + oct * 12 - midpoint) / sps);
    }
    lyPositions.sort((a, b) => a - b);

    return { semitonePattern: cleaned, midpoint, semitonesPerStaffSpace: sps, lyPositions };
  },

  /**
   * Build a ready `config.staff` slice (plan §4.3) from editor state.
   * Pure function; throws on invalid state rather than guessing.
   *
   * Emitted lineOverrides are intersected with the active pattern: an
   * override for a semitone that is no longer a staff line never reaches the
   * config. The editor STATE still keeps such entries, so switching a
   * pattern away and back restores the override in both the UI and the
   * emitted slice.
   *
   * @param {object} state
   * @returns {object} config.staff object
   */
  buildStaff(state) {
    const geo = CNBStaffRuleEditor.derivedGeometry(patternOf(state));
    const activeKeys = new Set(geo.semitonePattern.map(String));
    const overrides = {};
    for (const [key, val] of Object.entries(pruneOverrides(state.lineOverrides))) {
      if (activeKeys.has(key)) overrides[key] = val;
    }
    return {
      semitonePattern: geo.semitonePattern,
      midpoint: geo.midpoint,
      semitonesPerStaffSpace: geo.semitonesPerStaffSpace,
      lineDefaults: deepClone(state.lineDefaults),
      lineOverrides: overrides,
    };
  },

  /**
   * Build a ready `config.ledgers` slice (plan §4.4) from editor state.
   * Template triggerPCs are deduped and sorted (many-to-one user input);
   * invalid positions or trigger modes throw.
   * @param {object} state
   * @returns {object} config.ledgers object
   */
  buildLedgers(state) {
    const templates = (state.templates || []).map((t, i) => {
      if (!Number.isInteger(t.semiWithinOctave) || t.semiWithinOctave < 0 || t.semiWithinOctave > 11) {
        throw new Error(`Ledger template ${i + 1} has invalid semiWithinOctave ${JSON.stringify(t.semiWithinOctave)}`);
      }
      if (t.triggerMode !== "override" && t.triggerMode !== "proximity") {
        throw new Error(`Ledger template ${i + 1} has invalid triggerMode ${JSON.stringify(t.triggerMode)}`);
      }
      return {
        semiWithinOctave: t.semiWithinOctave,
        triggerPCs: sanitizePattern(t.triggerPCs || []),
        triggerMode: t.triggerMode,
      };
    });
    return {
      templates,
      proximityRule: !!state.proximityRule,
      lineDefaults: deepClone(state.ledgerDefaults),
      lineOverrides: deepClone(state.ledgerOverrides || {}),
    };
  },

  /**
   * Apply an editor state to a config: returns a new config with the staff
   * and ledgers sections replaced (all other sections untouched). Neither
   * argument is mutated.
   * @param {object} config
   * @param {object} state
   * @returns {object}
   */
  applyToConfig(config, state) {
    const out = CNBConfig.clone(config);
    out.staff = CNBStaffRuleEditor.buildStaff(state);
    out.ledgers = CNBStaffRuleEditor.buildLedgers(state);
    return out;
  },

  /**
   * Recover an editor state from a config (inverse of applyToConfig for the
   * staff/ledgers slices). Patterns matching a preset select it; anything
   * else opens as "custom".
   * @param {object} config
   * @returns {object} editor state
   */
  stateFromConfig(config) {
    const staff = (config && config.staff) || {};
    const ledgers = (config && config.ledgers) || {};
    const pattern = sanitizePattern(staff.semitonePattern || []);

    let patternKey = "custom";
    for (const [key, preset] of Object.entries(STAFF_PATTERN_PRESETS)) {
      if (preset.pattern.length === pattern.length &&
          preset.pattern.every((p, i) => p === pattern[i])) {
        patternKey = key;
        break;
      }
    }

    return {
      patternKey,
      customPattern: pattern.slice(),
      lineDefaults: {
        thicknessPct: 20, style: "solid", color: "#000000",
        ...deepClone(staff.lineDefaults || {}),
      },
      lineOverrides: pruneOverrides(staff.lineOverrides),
      templates: (ledgers.templates || []).map(t => ({
        semiWithinOctave: t.semiWithinOctave,
        triggerPCs: sanitizePattern(t.triggerPCs || []),
        triggerMode: t.triggerMode,
      })),
      proximityRule: ledgers.proximityRule !== false,
      ledgerDefaults: {
        thicknessPct: 40, widthMultiplier: 2.0, style: "solid",
        color: "#000000", roundedEnds: true,
        ...deepClone(ledgers.lineDefaults || {}),
      },
      ledgerOverrides: deepClone(ledgers.lineOverrides || {}),
    };
  },

  /**
   * Render the staff/ledger rule editor into a container.
   *
   * Structure (all styling left to the host via class hooks):
   *   div.cnb-staff-rule-editor
   *   ├── div.cnb-sre-pattern         (preset options + custom PC toggles)
   *   ├── div.cnb-sre-derived         (sps, midpoint, LY staff-line-positions)
   *   ├── div.cnb-sre-staff-defaults  (thicknessPct / style / color)
   *   ├── div.cnb-sre-overrides       (per-staff-line override rows)
   *   ├── div.cnb-sre-ledgers         (template rows + add button)
   *   ├── label.cnb-sre-proximity     (proximityRule checkbox)
   *   ├── div.cnb-sre-ledger-defaults (thickness / width / style / color / ends)
   *   └── div.cnb-sre-validation      (CNBConfig.validate pass-through)
   *
   * Events are wired as element properties (onclick/oninput/onchange) so the
   * editor is fully drivable in Node tests via a stub document.
   *
   * @param {HTMLElement} container
   * @param {{config?:object, onChange?:(slices:{staff:object,ledgers:object}, state:object)=>void}} [opts]
   *        `config` seeds the editor state and is the base for the validation
   *        pass-through (defaults to CNBConfig.createDefault()).
   * @returns {{root:HTMLElement, getState:()=>object, getStaff:()=>object,
   *            getLedgers:()=>object, applyTo:(config:object)=>object,
   *            setState:(partial:object)=>void, redraw:()=>void}}
   */
  render(container, opts = {}) {
    const doc = globalThis.document;
    const baseConfig = opts.config ? CNBConfig.clone(opts.config) : CNBConfig.createDefault();
    const state = CNBStaffRuleEditor.stateFromConfig(baseConfig);
    const onChange = opts.onChange || (() => {});

    const root = doc.createElement("div");
    root.className = "cnb-staff-rule-editor";

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
        { staff: CNBStaffRuleEditor.buildStaff(state), ledgers: CNBStaffRuleEditor.buildLedgers(state) },
        deepClone(state)
      );
    };

    // ── Pattern section ──────────────────────────────────────────────────
    function drawPattern() {
      const wrap = el("div", "cnb-sre-section cnb-sre-pattern");
      wrap.appendChild(el("div", "cnb-sre-title", "Staff pattern"));

      for (const [key, preset] of Object.entries(STAFF_PATTERN_PRESETS)) {
        const opt = el("div", "cnb-sre-pattern-option" + (state.patternKey === key ? " selected" : ""), preset.label);
        opt.setAttribute("data-pattern-key", key);
        opt.onclick = () => { state.patternKey = key; changed(); };
        wrap.appendChild(opt);
      }

      const custom = el("div", "cnb-sre-pattern-option cnb-sre-pattern-custom" +
        (state.patternKey === "custom" ? " selected" : ""), "Custom pattern");
      custom.setAttribute("data-pattern-key", "custom");
      custom.onclick = () => {
        if (state.patternKey !== "custom") {
          // Seed the custom pattern from the current effective pattern so
          // switching to Custom starts from what the user already sees.
          state.customPattern = patternOf(state);
          state.patternKey = "custom";
          changed();
        }
      };
      wrap.appendChild(custom);

      if (state.patternKey === "custom") {
        const pcs = el("div", "cnb-sre-custom-pcs");
        for (let pc = 0; pc < 12; pc++) {
          const on = (state.customPattern || []).includes(pc);
          const pill = el("button", "cnb-sre-pc-toggle" + (on ? " on" : ""), PC_LABELS[pc]);
          pill.type = "button";
          pill.setAttribute("data-pc", String(pc));
          pill.title = `Semitone ${pc}`;
          pill.onclick = () => {
            const set = new Set(state.customPattern || []);
            if (set.has(pc)) set.delete(pc); else set.add(pc);
            state.customPattern = [...set].sort((a, b) => a - b);
            changed();
          };
          pcs.appendChild(pill);
        }
        wrap.appendChild(pcs);
      }
      return wrap;
    }

    // ── Derived panel (legacy staff-derived, exporter formula) ───────────
    function drawDerived() {
      const wrap = el("div", "cnb-sre-derived");
      const pattern = patternOf(state);
      if (pattern.length < 2) {
        wrap.appendChild(el("div", "cnb-sre-derived-error",
          "Need at least 2 staff lines per octave."));
        return wrap;
      }
      const geo = CNBStaffRuleEditor.derivedGeometry(pattern);
      wrap.appendChild(el("div", "cnb-sre-derived-row",
        "Semitones per staff space: " + geo.semitonesPerStaffSpace));
      wrap.appendChild(el("div", "cnb-sre-derived-row",
        "Staff midpoint: " + geo.midpoint));
      wrap.appendChild(el("div", "cnb-sre-derived-row",
        "LilyPond staff-line-positions: (" + geo.lyPositions.join(" ") + ")"));
      wrap.appendChild(el("div", "cnb-sre-derived-row",
        "Staff lines per octave: " + geo.semitonePattern.length));
      return wrap;
    }

    // ── Shared line-style field row ──────────────────────────────────────
    function lineStyleFields(target, prefix, onEdit) {
      const row = el("div", prefix + "-fields cnb-sre-fields");

      const thick = el("input", "cnb-sre-thickness");
      thick.type = "number";
      thick.min = "1";
      thick.max = "100";
      thick.step = "1";
      thick.value = String(target.thicknessPct);
      thick.title = "Thickness (% of semitone height)";
      thick.oninput = (e) => {
        const v = numberFrom(e, thick);
        if (v !== null) { target.thicknessPct = v; onEdit(); }
      };
      row.appendChild(thick);

      const style = el("select", "cnb-sre-style");
      for (const s of LINE_STYLES) {
        const o = el("option", null, s);
        o.value = s;
        if (s === target.style) o.selected = true;
        style.appendChild(o);
      }
      style.value = target.style;
      style.onchange = (e) => { target.style = valueFrom(e, style); onEdit(); };
      row.appendChild(style);

      const color = el("input", "cnb-sre-color");
      color.type = "color";
      color.value = target.color;
      color.oninput = (e) => { target.color = valueFrom(e, color); onEdit(); };
      row.appendChild(color);

      return row;
    }

    function drawStaffDefaults() {
      const wrap = el("div", "cnb-sre-section cnb-sre-staff-defaults");
      wrap.appendChild(el("div", "cnb-sre-title", "Staff line defaults"));
      wrap.appendChild(el("div", "cnb-sre-hint", "Thickness (% of semitone) · style · color"));
      wrap.appendChild(lineStyleFields(state.lineDefaults, "cnb-sre-staff-defaults", changed));
      return wrap;
    }

    // ── Per-line overrides (staff.lineOverrides) ─────────────────────────
    function drawOverrides() {
      const wrap = el("div", "cnb-sre-section cnb-sre-overrides");
      wrap.appendChild(el("div", "cnb-sre-title", "Per-line overrides"));

      const pattern = patternOf(state);
      if (pattern.length === 0) {
        wrap.appendChild(el("div", "cnb-sre-hint", "No staff lines in the pattern yet."));
        return wrap;
      }

      for (const pc of pattern) {
        const key = String(pc);
        const overridden = key in state.lineOverrides;
        const row = el("div", "cnb-sre-override-row" + (overridden ? " overridden" : ""));
        row.setAttribute("data-line-pc", key);

        const label = el("label", "cnb-sre-override-toggle");
        const cb = el("input", "cnb-sre-override-check");
        cb.type = "checkbox";
        cb.checked = overridden;
        cb.onchange = (e) => {
          if (checkedFrom(e, cb)) {
            // Seed from current defaults so enabling is visually a no-op
            // until the user edits a field.
            state.lineOverrides[key] = deepClone(state.lineDefaults);
          } else {
            delete state.lineOverrides[key];
          }
          changed();
        };
        label.appendChild(cb);
        label.appendChild(el("span", "cnb-sre-override-name",
          PC_LABELS[pc] + " (semi " + pc + ")"));
        row.appendChild(label);

        if (overridden) {
          row.appendChild(lineStyleFields(state.lineOverrides[key], "cnb-sre-override", changed));
        }
        wrap.appendChild(row);
      }
      return wrap;
    }

    // ── Ledger templates ─────────────────────────────────────────────────
    function drawLedgers() {
      const wrap = el("div", "cnb-sre-section cnb-sre-ledgers");
      wrap.appendChild(el("div", "cnb-sre-title", "Ledger line templates"));
      wrap.appendChild(el("div", "cnb-sre-hint",
        "Where ledger lines CAN appear (per octave) and which nearby pitch " +
        "classes trigger them. Proximity mode shows the ledger for any note " +
        "closer to it than to a staff line."));

      (state.templates || []).forEach((t, idx) => {
        const row = el("div", "cnb-sre-template-row");
        row.setAttribute("data-template-index", String(idx));

        const pos = el("select", "cnb-sre-template-pos");
        for (let pc = 0; pc < 12; pc++) {
          const o = el("option", null, pc + " · " + PC_LABELS[pc]);
          o.value = String(pc);
          if (pc === t.semiWithinOctave) o.selected = true;
          pos.appendChild(o);
        }
        pos.value = String(t.semiWithinOctave);
        pos.title = "Ledger position (semitone within octave)";
        pos.onchange = (e) => {
          const v = parseInt(valueFrom(e, pos), 10);
          if (Number.isInteger(v)) { t.semiWithinOctave = v; changed(); }
        };
        row.appendChild(pos);

        const mode = el("select", "cnb-sre-template-mode");
        for (const m of ["override", "proximity"]) {
          const o = el("option", null, m);
          o.value = m;
          if (m === t.triggerMode) o.selected = true;
          mode.appendChild(o);
        }
        mode.value = t.triggerMode;
        mode.title = "Trigger mode";
        mode.onchange = (e) => { t.triggerMode = valueFrom(e, mode); changed(); };
        row.appendChild(mode);

        const pills = el("span", "cnb-sre-template-triggers" +
          (t.triggerMode === "proximity" ? " inactive" : ""));
        for (let pc = 0; pc < 12; pc++) {
          const on = (t.triggerPCs || []).includes(pc);
          const pill = el("button", "cnb-sre-trigger-pill" + (on ? " on" : ""), PC_LABELS[pc]);
          pill.type = "button";
          pill.setAttribute("data-pc", String(pc));
          pill.title = t.triggerMode === "proximity"
            ? "Trigger pitch classes are ignored in proximity mode"
            : "Toggle trigger pitch class " + PC_LABELS[pc];
          pill.onclick = () => {
            const set = new Set(t.triggerPCs || []);
            if (set.has(pc)) set.delete(pc); else set.add(pc);
            t.triggerPCs = [...set].sort((a, b) => a - b);
            changed();
          };
          pills.appendChild(pill);
        }
        row.appendChild(pills);

        const remove = el("button", "cnb-sre-template-remove", "×");
        remove.type = "button";
        remove.title = "Remove template";
        remove.onclick = () => { state.templates.splice(idx, 1); changed(); };
        row.appendChild(remove);

        wrap.appendChild(row);
      });

      const add = el("button", "cnb-sre-template-add", "+ Add ledger template");
      add.type = "button";
      add.onclick = () => {
        state.templates.push({ semiWithinOctave: 0, triggerPCs: [0], triggerMode: "override" });
        changed();
      };
      wrap.appendChild(add);
      return wrap;
    }

    function drawProximity() {
      const label = el("label", "cnb-sre-proximity");
      const cb = el("input", "cnb-sre-proximity-check");
      cb.type = "checkbox";
      cb.checked = !!state.proximityRule;
      cb.onchange = (e) => { state.proximityRule = checkedFrom(e, cb); changed(); };
      label.appendChild(cb);
      label.appendChild(el("span", "cnb-sre-proximity-text",
        "Enable proximity rule (proximity-mode templates show for any nearby note)"));
      return label;
    }

    function drawLedgerDefaults() {
      const wrap = el("div", "cnb-sre-section cnb-sre-ledger-defaults");
      wrap.appendChild(el("div", "cnb-sre-title", "Ledger line defaults"));
      wrap.appendChild(el("div", "cnb-sre-hint",
        "Thickness (% of semitone) · style · color · width (× notehead) · rounded ends"));
      wrap.appendChild(lineStyleFields(state.ledgerDefaults, "cnb-sre-ledger-defaults", changed));

      const extras = el("div", "cnb-sre-fields cnb-sre-ledger-extras");
      const widthMult = el("input", "cnb-sre-width-multiplier");
      widthMult.type = "number";
      widthMult.min = "0.5";
      widthMult.max = "5";
      widthMult.step = "0.1";
      widthMult.value = String(state.ledgerDefaults.widthMultiplier);
      widthMult.title = "Width (× notehead width)";
      widthMult.oninput = (e) => {
        const v = numberFrom(e, widthMult);
        if (v !== null) { state.ledgerDefaults.widthMultiplier = v; changed(); }
      };
      extras.appendChild(widthMult);

      const rounded = el("label", "cnb-sre-rounded");
      const cb = el("input", "cnb-sre-rounded-check");
      cb.type = "checkbox";
      cb.checked = !!state.ledgerDefaults.roundedEnds;
      cb.onchange = (e) => { state.ledgerDefaults.roundedEnds = checkedFrom(e, cb); changed(); };
      rounded.appendChild(cb);
      rounded.appendChild(el("span", "cnb-sre-rounded-text", "Rounded ends"));
      extras.appendChild(rounded);

      wrap.appendChild(extras);
      return wrap;
    }

    // ── Validation pass-through (Module A) ───────────────────────────────
    function drawValidation() {
      const wrap = el("div", "cnb-sre-validation");
      let result;
      try {
        result = CNBConfig.validate(CNBStaffRuleEditor.applyToConfig(baseConfig, state));
      } catch (err) {
        wrap.appendChild(el("div", "cnb-sre-error", "Editor state error: " + err.message));
        return wrap;
      }
      if (result.valid) {
        wrap.appendChild(el("div", "cnb-sre-valid", "Config valid ✓"));
      }
      for (const msg of result.errors) {
        wrap.appendChild(el("div", "cnb-sre-error", msg));
      }
      for (const msg of result.warnings) {
        wrap.appendChild(el("div", "cnb-sre-warning", msg));
      }
      return wrap;
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      root.appendChild(drawPattern());
      root.appendChild(drawDerived());
      root.appendChild(drawStaffDefaults());
      root.appendChild(drawOverrides());
      root.appendChild(drawLedgers());
      root.appendChild(drawProximity());
      root.appendChild(drawLedgerDefaults());
      root.appendChild(drawValidation());
    }

    redraw();
    container.appendChild(root);

    return {
      root,
      getState: () => deepClone(state),
      getStaff: () => CNBStaffRuleEditor.buildStaff(state),
      getLedgers: () => CNBStaffRuleEditor.buildLedgers(state),
      applyTo: (config) => CNBStaffRuleEditor.applyToConfig(config, state),
      setState: (partial) => { Object.assign(state, deepClone(partial)); changed(); },
      redraw,
    };
  },

  /**
   * Render a live staff/ledger preview for a config: continuous staff lines
   * (Module 3) plus, per example note, that note's resolved ledger lines
   * (Module 5) and a small marker dot at the note position. The example
   * notes are display samples, not config — they exercise the octave-aware
   * ledger rules across the range.
   *
   * @param {HTMLElement} host  container the <svg> is appended to
   * @param {object} config     full CNB config
   * @param {{minSemi?:number, maxSemi?:number, exampleNotes?:number[],
   *          colWidth?:number, pxPerSemi?:number}} [opts]
   * @returns {{svg:SVGElement, gridContext:object, staffGroup:SVGGElement,
   *            noteGroups:Array<{semi:number, ledgerGroup:SVGGElement, marker:SVGElement}>}}
   */
  renderPreview(host, config, opts = {}) {
    const doc = globalThis.document;
    const NS = "http://www.w3.org/2000/svg";

    const minSemi = opts.minSemi ?? 0;
    const maxSemi = opts.maxSemi ?? 24;
    const cfg = opts.pxPerSemi
      ? CNBConfig.merge(config, { display: { pxPerSemi: opts.pxPerSemi } })
      : config;

    const grid = CNBGrid.create(cfg, { minSemi, maxSemi });

    let notes = opts.exampleNotes;
    if (!notes) {
      notes = [];
      for (let s = minSemi; s <= maxSemi; s++) notes.push(s);
    }

    const colWidth = opts.colWidth ?? 32;
    const pad = grid.pxPerSemi;
    const width = notes.length * colWidth;

    const svg = doc.createElementNS(NS, "svg");
    svg.setAttribute("class", "cnb-sre-preview");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(grid.svgHeight + 2 * pad));

    // Inner group shifted down by pad so markers at the range edges don't clip.
    const inner = doc.createElementNS(NS, "g");
    inner.setAttribute("transform", `translate(0 ${pad})`);
    svg.appendChild(inner);

    const staffGroup = CNBStaff.render(inner, grid, cfg, width);

    const noteGroups = notes.map((semi, i) => {
      const centerX = i * colWidth + colWidth / 2;
      const ledgerGroup = CNBLedgerSet.render(inner, grid, cfg, [semi], {
        centerX,
        width: colWidth * 0.7,
      });
      const marker = doc.createElementNS(NS, "circle");
      marker.setAttribute("class", "cnb-sre-preview-note");
      marker.setAttribute("cx", String(centerX));
      marker.setAttribute("cy", String(grid.semiToY(semi)));
      marker.setAttribute("r", String(grid.pxPerSemi * 0.42));
      marker.setAttribute("fill", "#546e7a");
      marker.setAttribute("fill-opacity", "0.85");
      inner.appendChild(marker);
      return { semi, ledgerGroup, marker };
    });

    host.appendChild(svg);
    return { svg, gridContext: grid, staffGroup, noteGroups };
  },
};
