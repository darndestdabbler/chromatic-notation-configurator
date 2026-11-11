/**
 * clef-editor.js — Clef Editor (set 009, session 2)
 *
 * Edits the `config.clef` section added in set 009 session 1 (architecture
 * plan §4.12): the enable toggle, glyph selection from imported clef
 * glyphs, the active definition's anchor-semitone control, and gutter
 * sizing. Also hosts the clef glyph import wiring (session-1's
 * CNBSvgImporter.parseClefSvgText) so the assembled UI gets the full
 * import → enable → position flow from one panel — reusable UI wiring
 * lives in the module, host pages only place it.
 *
 * Schema notes this editor honors (set 009 s1 decisions, s1-notes.md):
 *   - `anchorSemi` lives on EACH clef definition (per-definition anchors:
 *     switching the active clef preserves each definition's registration),
 *     so the anchor control edits the ACTIVE definition's field.
 *   - `anchorSemi` is the semitone of the glyph's TOP edge and is a FLOAT
 *     (surveyed designs — Bravura gClef, Clairnote, Express Stave — register
 *     clefs by interior features, putting the box top at fractional grid
 *     offsets). The input therefore uses step="any" and accepts any finite
 *     number; Module A validation warns outside the typical −24…72 range.
 *   - `clef.glyphs` entries carry kind "glyph" (imported SVG) or "text"
 *     (register label). Import creates glyph entries; text entries are
 *     author-editable config that this editor lists and positions like any
 *     other definition (E1 catalog: both are clef-slot devices).
 *
 * Session 45 (clefs): a row of buttons, Dozenal, Treble, Bass and Alto,
 * adds that clef (CNBBuiltinClefs.definition, for the config's staff) when
 * the config has none of that name, makes it the active one and turns the
 * clef on; a clef already there keeps its placement. A glyph clef is shown
 * over a range of semitones, "Shown from semitone … to …", which
 * withRange(clef, top, bottom) writes as its anchorSemi (the top) and
 * semitoneHeight (top − bottom); the canvas's drag uses it too. A text
 * clef keeps its top field; the dozenal clef has neither, since the engine
 * sets its size and place.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     enabled: boolean,
 *     active:  string | null,          // name into glyphs
 *     glyphs:  { [name]: definition }, // full definitions pass through
 *     gutter:  { paddingH: number }    // px padding each side of the glyph
 *   }
 *
 * The UI cannot express every invalid config (e.g. enabled with a missing
 * glyph loaded from a file), so — like Modules 12–15 — invalid-but-editable
 * situations are surfaced through the Module A validation pass-through
 * rather than thrown, while structurally invalid STATE (non-object glyphs,
 * non-finite gutter padding) throws from the pure builders: that is a
 * caller bug, not user input.
 *
 * Rendering contract (same as Modules 12–17): render() builds plain DOM
 * via document.createElement, wires events as element properties
 * (onclick/oninput/onchange) so the whole UI is exercisable in Node against
 * a stub document, and reports every state change through
 * onChange({ clef }, state) where `clef` is a ready `config.clef` object.
 * Hosts own layout and styling via the .cnb-cle-* class hooks.
 *
 * Dependencies: Module A (validation pass-through), Module 16
 * (CNBSvgImporter.parseClefSvgText for the import wiring), the built-in
 * clefs (builtin-clefs.js).
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBSvgImporter } from "./svg-importer.js";
import { CNBBuiltinClefs } from "./builtin-clefs.js";

// ─── Pure helpers ────────────────────────────────────────────────────────────

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Rounded to 4 places, as the range fields show a value. */
function round4(v) {
  return Math.round(v * 1e4) / 1e4;
}

/** The active definition of a clef slice when it is a glyph clef, or null. */
function activeGlyphDef(clef) {
  const def = isPlainObject(clef) && typeof clef.active === "string" && isPlainObject(clef.glyphs)
    ? clef.glyphs[clef.active]
    : null;
  return isPlainObject(def) && (def.kind || "glyph") === "glyph" ? def : null;
}

export const CNBClefEditor = {

  /**
   * Build a ready `config.clef` slice from editor state. Pure function;
   * throws on structurally invalid state (see module header) rather than
   * guessing. An enabled state with no active glyph is NOT a throw — the
   * user reaches it mid-edit and Module A validation reports it.
   *
   * @param {object} state
   * @returns {object} config.clef object
   */
  buildClef(state) {
    if (!isPlainObject(state)) {
      throw new Error("Clef editor state must be an object");
    }
    if (state.active !== null && typeof state.active !== "string") {
      throw new Error(`clef.active must be null or a glyph name string (got ${JSON.stringify(state.active)})`);
    }
    if (!isPlainObject(state.glyphs)) {
      throw new Error("clef.glyphs must be an object map of clef definitions");
    }
    const paddingH = state.gutter && state.gutter.paddingH;
    if (typeof paddingH !== "number" || !Number.isFinite(paddingH) || paddingH < 0) {
      throw new Error(`clef.gutter.paddingH must be a finite non-negative number (got ${JSON.stringify(paddingH)})`);
    }
    return {
      enabled: !!state.enabled,
      active: state.active,
      glyphs: deepClone(state.glyphs),
      gutter: { paddingH },
    };
  },

  /**
   * A clef slice with its active glyph clef shown from semitone `bottom` to
   * semitone `top` (session 45): anchorSemi = top, semitoneHeight =
   * top − bottom. Null, changing nothing, when top is not above bottom,
   * either is not a finite number, or the active clef is not a glyph clef.
   * Pure: the argument is not mutated.
   *
   * @param {object} clef    a config.clef slice (or editor state)
   * @param {number} top     semitone of the clef's top
   * @param {number} bottom  semitone of its bottom
   * @returns {object|null}
   */
  withRange(clef, top, bottom) {
    if (!activeGlyphDef(clef) || !Number.isFinite(top) || !Number.isFinite(bottom) || !(top > bottom)) {
      return null;
    }
    const out = deepClone(clef);
    const def = out.glyphs[out.active];
    def.anchorSemi = top;
    def.semitoneHeight = round4(top - bottom);
    return out;
  },

  /**
   * Apply an editor state to a config: returns a new config with the clef
   * section replaced (all other sections untouched). Neither argument is
   * mutated.
   * @param {object} config
   * @param {object} state
   * @returns {object}
   */
  applyToConfig(config, state) {
    const out = CNBConfig.clone(config);
    out.clef = CNBClefEditor.buildClef(state);
    return out;
  },

  /**
   * Recover an editor state from a config (inverse of applyToConfig for
   * the clef slice). Tolerant of configs predating the clef section — a
   * missing or malformed section opens as the default-off state.
   * @param {object} config
   * @returns {object} editor state
   */
  stateFromConfig(config) {
    const clef = isPlainObject(config && config.clef) ? config.clef : {};
    const gutter = isPlainObject(clef.gutter) ? clef.gutter : {};
    return {
      enabled: !!clef.enabled,
      active: typeof clef.active === "string" ? clef.active : null,
      glyphs: isPlainObject(clef.glyphs) ? deepClone(clef.glyphs) : {},
      gutter: {
        paddingH: (typeof gutter.paddingH === "number" && Number.isFinite(gutter.paddingH) && gutter.paddingH >= 0)
          ? gutter.paddingH
          : 12,
      },
    };
  },

  /**
   * Render the clef editor into a container.
   *
   * Structure (all styling left to the host via class hooks):
   *   div.cnb-clef-editor
   *   ├── label.cnb-cle-enable      (enable checkbox)
   *   ├── div.cnb-cle-choices      (Dozenal, Treble, Bass, Alto buttons)
   *   ├── div.cnb-cle-import       (clef SVG file input + import status)
   *   ├── div.cnb-cle-glyphs       (glyph selection rows, or empty-state note)
   *   ├── div.cnb-cle-anchor       (a glyph clef's range inputs, a text
   *   │                             clef's anchorSemi input, the dozenal
   *   │                             note, or .cnb-cle-anchor-empty note)
   *   ├── div.cnb-cle-gutter       (gutter.paddingH input)
   *   └── div.cnb-cle-validation   (CNBConfig.validate pass-through)
   *
   * Events are wired as element properties (onclick/oninput/onchange) so the
   * editor is fully drivable in Node tests via a stub document. The file
   * input's browser-only file reading is isolated in the onchange handler;
   * tests drive importClefText() directly with an injected opts.parser.
   *
   * @param {HTMLElement} container
   * @param {{config?:object,
   *          onChange?:(slices:{clef:object}, state:object)=>void,
   *          parser?:{parseFromString:Function}}} [opts]
   *        `config` seeds the editor state and is the base for the
   *        validation pass-through (defaults to CNBConfig.createDefault()).
   *        `parser` is forwarded to CNBSvgImporter.parseClefSvgText —
   *        pass a stub in DOM-less tests (the default is DOMParser).
   *        `getConfig` (session 45), when given, returns the current config,
   *        whose staff a chosen clef is placed for; otherwise `config`.
   * @returns {{root:HTMLElement, getState:()=>object, getClef:()=>object,
   *            applyTo:(config:object)=>object, setState:(partial:object)=>void,
   *            importClefText:(svgText:string, filename:string)=>object|null,
   *            redraw:()=>void}}
   */
  render(container, opts = {}) {
    const doc = globalThis.document;
    const baseConfig = opts.config ? CNBConfig.clone(opts.config) : CNBConfig.createDefault();
    const state = CNBClefEditor.stateFromConfig(baseConfig);
    const onChange = opts.onChange || (() => {});
    const currentConfig = () => (opts.getConfig ? opts.getConfig() : baseConfig);

    const root = doc.createElement("div");
    root.className = "cnb-clef-editor";

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

    // Import panel state (shown by redraw; config state stays in `state`).
    let importStatus = "";
    let importError = "";
    let importWarnings = [];

    const changed = () => {
      redraw();
      onChange({ clef: CNBClefEditor.buildClef(state) }, deepClone(state));
    };

    /**
     * Import a clef glyph from raw SVG text (session-1 importer contract).
     * On success the glyph is added to state.glyphs under the
     * filename-derived name (replacing any existing entry with that name)
     * and becomes the active selection; on error the state is untouched
     * and the message is shown in .cnb-cle-import-error. Returns the
     * parse result either way (null only on a missing filename/text type
     * error thrown by the importer).
     */
    function importClefText(svgText, filename) {
      const midpoint = (baseConfig.staff && typeof baseConfig.staff.midpoint === "number")
        ? baseConfig.staff.midpoint
        : 12;
      const result = CNBSvgImporter.parseClefSvgText(svgText, filename, {
        parser: opts.parser,
        defaultMidpoint: midpoint,
      });
      importWarnings = result.warnings || [];
      if (result.error) {
        importError = "Import failed: " + result.error;
        importStatus = "";
        redraw();   // config untouched — no onChange
        return result;
      }
      const replaced = result.name in state.glyphs;
      state.glyphs[result.name] = result.glyph;
      state.active = result.name;
      importError = "";
      importStatus = `Imported the clef "${result.name}"` +
        (replaced ? " (it replaces the clef of that name)" : "");
      changed();
      return result;
    }

    // ── Enable toggle ────────────────────────────────────────────────────
    function drawEnable() {
      const label = el("label", "cnb-cle-enable");
      const cb = el("input", "cnb-cle-enable-check");
      cb.type = "checkbox";
      cb.checked = !!state.enabled;
      cb.onchange = (e) => { state.enabled = checkedFrom(e, cb); changed(); };
      label.appendChild(cb);
      label.appendChild(el("span", "cnb-cle-enable-text", "Show a clef at the start of the staff"));
      return label;
    }

    // ── The clefs to choose from (session 45) ────────────────────────────
    function drawChoices() {
      const wrap = el("div", "cnb-cle-section cnb-cle-choices");
      wrap.appendChild(el("div", "cnb-cle-title", "Choose a clef"));
      wrap.appendChild(el("div", "cnb-cle-hint",
        "The dozenal clef is the engine's own number for the register. The treble, bass and " +
        "alto clefs are LilyPond's, each placed on the pitch it marks: G, F or C."));
      const row = el("div", "cnb-cle-fields");
      for (const { name, displayName } of CNBBuiltinClefs.CHOICES) {
        const on = state.enabled && state.active === name;
        const button = el("button", "cnb-cle-choice" + (on ? " on" : ""), displayName);
        button.type = "button";
        button.setAttribute("data-clef", name);
        button.onclick = () => {
          if (!(name in state.glyphs)) {
            state.glyphs[name] = CNBBuiltinClefs.definition(currentConfig(), name);
          }
          state.active = name;
          state.enabled = true;
          changed();
        };
        row.appendChild(button);
      }
      wrap.appendChild(row);
      return wrap;
    }

    // ── Clef glyph import (session-1 importer, clef kind) ────────────────
    function drawImport() {
      const wrap = el("div", "cnb-cle-section cnb-cle-import");
      wrap.appendChild(el("div", "cnb-cle-title", "Import a clef from SVG"));
      wrap.appendChild(el("div", "cnb-cle-hint",
        "An SVG drawn with the music glyph toolkit, which records its height in semitones."));

      const input = el("input", "cnb-cle-file");
      input.type = "file";
      input.setAttribute("accept", ".svg,image/svg+xml");
      input.onchange = (e) => {
        const file = e && e.target && e.target.files && e.target.files[0];
        if (!file) return;
        file.text().then(
          (text) => importClefText(text, file.name),
          (err) => { importError = "Import failed: could not read the file (" + err.message + ")"; redraw(); }
        );
      };
      wrap.appendChild(input);

      wrap.appendChild(el("div", "cnb-cle-import-status", importStatus));
      wrap.appendChild(el("div", "cnb-cle-import-error", importError));
      const warnList = el("ul", "cnb-cle-import-warnings");
      for (const w of importWarnings) {
        warnList.appendChild(el("li", "cnb-cle-import-warning", w));
      }
      wrap.appendChild(warnList);
      return wrap;
    }

    // ── Glyph selection ──────────────────────────────────────────────────
    function drawGlyphs() {
      const wrap = el("div", "cnb-cle-section cnb-cle-glyphs");
      wrap.appendChild(el("div", "cnb-cle-title", "Clefs"));

      const names = Object.keys(state.glyphs);
      if (names.length === 0) {
        wrap.appendChild(el("div", "cnb-cle-empty", "No clefs yet: import one from SVG above."));
        return wrap;
      }

      for (const name of names) {
        const def = state.glyphs[name];
        const isActive = state.active === name;
        const row = el("div", "cnb-cle-glyph-option" + (isActive ? " selected" : ""));
        row.setAttribute("data-glyph-name", name);
        const kind = (def && def.kind) || "glyph";
        const top = def && typeof def.anchorSemi === "number" ? def.anchorSemi : "?";
        const detail = kind === "dozenal"
          ? "the engine's number, on the middle of the staff"
          : kind === "text"
            ? `text “${(def && def.text) || ""}” · top at semitone ${top}`
            : `drawing · semitones ${typeof top === "number" && typeof def.semitoneHeight === "number"
                ? round4(top - def.semitoneHeight) : "?"} to ${top}`;
        row.appendChild(el("span", "cnb-cle-glyph-name",
          ((def && def.displayName) || name)));
        row.appendChild(el("span", "cnb-cle-glyph-detail", detail));
        row.onclick = () => { state.active = name; changed(); };
        wrap.appendChild(row);
      }
      return wrap;
    }

    // ── Where the clef is shown (active definition) ──────────────────────
    function drawAnchor() {
      const wrap = el("div", "cnb-cle-section cnb-cle-anchor");

      const active = state.active && isPlainObject(state.glyphs[state.active])
        ? state.glyphs[state.active]
        : null;
      if (!active) {
        wrap.appendChild(el("div", "cnb-cle-title", "Where the clef is shown"));
        wrap.appendChild(el("div", "cnb-cle-anchor-empty",
          "Import or choose a clef to place it."));
        return wrap;
      }
      const kind = active.kind || "glyph";
      if (kind === "dozenal") {
        wrap.appendChild(el("div", "cnb-cle-title", "Where the clef is shown"));
        wrap.appendChild(el("div", "cnb-cle-dozenal-note",
          "The engine sets the dozenal clef's size and place, on the middle of the staff. " +
          "The score's own clef sets its number: 50 for treble, 40 for alto, 30 for bass."));
        return wrap;
      }
      if (kind === "glyph") return drawRange(wrap, active);

      wrap.appendChild(el("div", "cnb-cle-title", "Top of the clef"));

      wrap.appendChild(el("div", "cnb-cle-hint",
        "The semitone the top of the clef sits on. Decimals are allowed: a clef " +
        "is usually placed by a feature inside it, such as the curl of a treble clef."));

      const row = el("div", "cnb-cle-fields");
      const anchor = el("input", "cnb-cle-anchor-input");
      anchor.type = "number";
      anchor.step = "any";
      anchor.value = String(active.anchorSemi);
      anchor.oninput = (e) => {
        const v = numberFrom(e, anchor);
        if (v !== null) { active.anchorSemi = v; changed(); }
      };
      row.appendChild(anchor);
      row.appendChild(el("span", "cnb-cle-anchor-name",
        "semitones, for " + ((active.displayName) || state.active)));
      wrap.appendChild(row);
      return wrap;
    }

    /** A glyph clef's range: its bottom and top semitones (session 45). */
    function drawRange(wrap, active) {
      wrap.appendChild(el("div", "cnb-cle-title", "Where the clef is shown"));
      wrap.appendChild(el("div", "cnb-cle-hint",
        "The semitones from the bottom of the clef to its top, in the preview and in LilyPond. " +
        "Decimals are allowed. With this section open you can also drag the clef up or down " +
        "on the staff, or drag its bottom edge to make it taller or shorter."));

      const top = active.anchorSemi;
      const bottom = round4(active.anchorSemi - active.semitoneHeight);
      const row = el("div", "cnb-cle-fields");
      const field = (className, value) => {
        const input = el("input", className);
        input.type = "number";
        input.step = "any";
        input.value = String(value);
        return input;
      };
      const bottomInput = field("cnb-cle-range-bottom", bottom);
      const topInput = field("cnb-cle-range-top", top);
      const apply = (newTop, newBottom) => {
        const next = CNBClefEditor.withRange(state, newTop, newBottom);
        if (!next) return;   // not a number, or no room between them
        state.glyphs = next.glyphs;
        changed();
      };
      bottomInput.oninput = (e) => {
        const v = numberFrom(e, bottomInput);
        if (v !== null) apply(top, v);
      };
      topInput.oninput = (e) => {
        const v = numberFrom(e, topInput);
        if (v !== null) apply(v, bottom);
      };
      row.appendChild(el("span", "cnb-cle-range-label", "Shown from semitone"));
      row.appendChild(bottomInput);
      row.appendChild(el("span", "cnb-cle-range-label", "to"));
      row.appendChild(topInput);
      wrap.appendChild(row);
      return wrap;
    }

    // ── Gutter sizing ────────────────────────────────────────────────────
    function drawGutter() {
      const wrap = el("div", "cnb-cle-section cnb-cle-gutter");
      wrap.appendChild(el("div", "cnb-cle-title", "Space either side"));
      wrap.appendChild(el("div", "cnb-cle-hint", "Room on each side of the clef, before the first note."));

      const row = el("div", "cnb-cle-fields");
      const pad = el("input", "cnb-cle-gutter-input");
      pad.type = "number";
      pad.min = "0";
      pad.step = "1";
      pad.value = String(state.gutter.paddingH);
      pad.oninput = (e) => {
        const v = numberFrom(e, pad);
        if (v !== null && v >= 0) { state.gutter.paddingH = v; changed(); }
      };
      row.appendChild(pad);
      row.appendChild(el("span", "cnb-cle-unit", "px"));
      wrap.appendChild(row);
      return wrap;
    }

    // ── Validation pass-through (Module A) ───────────────────────────────
    function drawValidation() {
      const wrap = el("div", "cnb-cle-validation");
      let result;
      try {
        result = CNBConfig.validate(CNBClefEditor.applyToConfig(baseConfig, state));
      } catch (err) {
        wrap.appendChild(el("div", "cnb-cle-error", "Editor state error: " + err.message));
        return wrap;
      }
      if (result.valid) {
        wrap.appendChild(el("div", "cnb-cle-valid", "Config valid ✓"));
      }
      for (const msg of result.errors) {
        wrap.appendChild(el("div", "cnb-cle-error", msg));
      }
      for (const msg of result.warnings) {
        wrap.appendChild(el("div", "cnb-cle-warning", msg));
      }
      return wrap;
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      root.appendChild(drawEnable());
      root.appendChild(drawChoices());
      root.appendChild(drawImport());
      root.appendChild(drawGlyphs());
      root.appendChild(drawAnchor());
      root.appendChild(drawGutter());
      root.appendChild(drawValidation());
    }

    redraw();
    container.appendChild(root);

    return {
      root,
      getState: () => deepClone(state),
      getClef: () => CNBClefEditor.buildClef(state),
      applyTo: (config) => CNBClefEditor.applyToConfig(config, state),
      setState: (partial) => { Object.assign(state, deepClone(partial)); changed(); },
      importClefText,
      redraw,
    };
  },
};
