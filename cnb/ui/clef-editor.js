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
 * clef on; a clef already there keeps its placement. A text clef keeps its
 * top field.
 *
 * Session 59 (clefs sized about an anchor): a glyph clef is placed by the
 * semitone its anchor point sits on ("Sits on semitone", withAnchor; "Top at
 * semitone" for a clef saved before session 59, which has no anchor point)
 * and sized by its Height, a number in semitones or Automatic, which follows
 * the staff (withHeight); the clef is scaled about its anchor. "Pick the
 * anchor point" opens the clef enlarged, and a click on it sets its
 * reference (CNBKeySignatureEditor.referenceGeometry / referenceAt); an
 * import opens it. The dozenal clef sits on the middle line and has a
 * Height. The canvas's drags use withAnchor and withHeight too.
 *
 * Session 79 (clef-steps design, docs/planning/clef-steps-design.md §2.2):
 * the panel is four options in a designer's order, each a dropdown. a. One
 * Clef dropdown, No clef, the built-in clefs and the imported ones, with
 * Import from SVG… beside it, in place of the checkbox, the clef buttons and
 * the list of clefs. b. Anchor: Top, Middle, Bottom (withAnchorChoice) or A
 * point on the clef, which opens the picker, then the Height. c. Sits on:
 * the canvas's pitches (pitchOptions) or a semitone of the designer's own.
 * d. A line saying the space after the clef is LilyPond's: the padding
 * field is gone, and gutter.paddingH keeps its stored value.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     enabled: boolean,
 *     active:  string | null,          // name into glyphs
 *     glyphs:  { [name]: definition }, // full definitions pass through
 *     gutter:  { paddingH: number }    // px after the glyph, kept as stored
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
 * (CNBSvgImporter.parseClefSvgText for the import wiring), Module 20 (the
 * clef as drawn, CNBClef.shown), the built-in clefs (builtin-clefs.js), the
 * key-signature editor's reference picker geometry.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBClef } from "../src/cnb-clef.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBMusic } from "../src/cnb-music.js";
import { CNBSvgImporter } from "./svg-importer.js";
import { CNBBuiltinClefs } from "./builtin-clefs.js";
import { CNBKeySignatureEditor } from "./key-signature-editor.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// ─── Pure helpers ────────────────────────────────────────────────────────────

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Rounded to 4 places, as the fields show a value. */
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

/** The active definition when it has a height of its own (a glyph or the
 *  dozenal clef), or null. */
function activeSizedDef(clef) {
  const def = isPlainObject(clef) && typeof clef.active === "string" && isPlainObject(clef.glyphs)
    ? clef.glyphs[clef.active]
    : null;
  return isPlainObject(def) && ["glyph", "dozenal"].includes(def.kind || "glyph") ? def : null;
}

/** Whether a definition's size can be automatic: the dozenal clef, or a
 *  glyph that knows its units per LilyPond staff space (session 59). */
function canBeAutomatic(def) {
  return def.kind === "dozenal" || def.staffSpaceUnits > 0;
}

/** The pitch classes the canvas draws, C to the C above. */
const CANVAS_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The Anchor dropdown's choices (session 79, clef-steps design §2.2 b). */
const ANCHOR_CHOICES = [
  ["top", "Top"],
  ["middle", "Middle"],
  ["bottom", "Bottom"],
  ["point", "A point on the clef"],
];

/** The height in a glyph's native units of the top, middle and bottom. */
function boxHeight(def, choice) {
  const minY = def.viewBoxMinY || 0;
  return { top: minY, middle: minY + def.naturalHeight / 2, bottom: minY + def.naturalHeight }[choice];
}

export const CNBClefEditor = {

  /** The Anchor dropdown's choices: [[value, label]]. */
  ANCHOR_CHOICES,

  /**
   * Which Anchor choice a definition's anchor point is (session 79, design
   * §2.2 b): "top", "middle" or "bottom" when its reference's height is
   * exactly the top, middle or bottom of the glyph's box, otherwise "point".
   * A definition without a reference, or a text clef, is "top": that is what
   * it draws (anchorSemi its top edge).
   *
   * @param {object} def  a config.clef.glyphs entry
   * @returns {"top"|"middle"|"bottom"|"point"}
   */
  anchorChoice(def) {
    if (!isPlainObject(def) || (def.kind || "glyph") !== "glyph" || !isPlainObject(def.reference)) return "top";
    for (const choice of ["top", "middle", "bottom"]) {
      if (def.reference.y === boxHeight(def, choice)) return choice;
    }
    return "point";
  },

  /**
   * A clef slice with its active glyph clef's anchor point at the choice
   * (session 79, design §2.2 b): Top, Middle and Bottom write the reference
   * at the box's centre across and its top, middle or bottom; "point" keeps
   * the stored point, which the picker then moves. anchorSemi is kept, so the
   * new anchor sits on the same pitch. Null, changing nothing, for a choice
   * not offered or an active clef that is not a glyph clef. Pure.
   *
   * @param {object} clef  a config.clef slice (or editor state)
   * @param {string} choice  "top" | "middle" | "bottom" | "point"
   * @returns {object|null}
   */
  withAnchorChoice(clef, choice) {
    if (!activeGlyphDef(clef) || !ANCHOR_CHOICES.some(([value]) => value === choice)) return null;
    const out = deepClone(clef);
    const def = out.glyphs[out.active];
    if (choice !== "point") {
      def.reference = { x: (def.viewBoxMinX || 0) + def.naturalWidth / 2, y: boxHeight(def, choice) };
    }
    return out;
  },

  /**
   * The pitches the Sits on dropdown offers (session 79, design §2.2 c):
   * every semitone the canvas draws, top to bottom, each named as the label
   * strip names it, with its semitone: "G · semitone 19".
   *
   * @param {object} config
   * @returns {{semi:number, name:string}[]}
   */
  pitchOptions(config) {
    const base = isPlainObject(config) ? { ...config, clef: { enabled: false } } : undefined;
    const { minSemi, maxSemi } = CNBCollection.gridRange(CANVAS_PCS, base);
    const out = [];
    for (let semi = Math.floor(maxSemi); semi >= Math.ceil(minSemi); semi--) {
      const label = CNBMusic.pcLabel(CNBMusic.pitchClass(semi));
      out.push({ semi, name: `${label.text}${label.sharp ? "♯" : ""} · semitone ${semi}` });
    }
    return out;
  },

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
   * A clef slice with its active glyph clef's anchor on semitone `semi`
   * (session 59): its anchorSemi, the semitone its anchor point sits on (the
   * top, for a clef with no anchor point). Null, changing nothing, when semi
   * is not a finite number or the active clef is not a glyph clef. Pure: the
   * argument is not mutated.
   *
   * @param {object} clef  a config.clef slice (or editor state)
   * @param {number} semi
   * @returns {object|null}
   */
  withAnchor(clef, semi) {
    if (!activeGlyphDef(clef) || !Number.isFinite(semi)) return null;
    const out = deepClone(clef);
    out.glyphs[out.active].anchorSemi = round4(semi);
    return out;
  },

  /**
   * A clef slice with its active glyph or dozenal clef at `height`
   * semitones (session 59), scaled about its anchor, or automatic for null
   * (the dozenal clef, or a glyph with staffSpaceUnits). Null, changing
   * nothing, for a height that is not a positive finite number or null, a
   * null the clef cannot take, or an active clef with no height of its own.
   * Pure: the argument is not mutated.
   *
   * @param {object} clef  a config.clef slice (or editor state)
   * @param {number|null} height
   * @returns {object|null}
   */
  withHeight(clef, height) {
    const def = activeSizedDef(clef);
    if (!def) return null;
    if (height === null ? !canBeAutomatic(def) : !(Number.isFinite(height) && height > 0)) return null;
    const out = deepClone(clef);
    out.glyphs[out.active].semitoneHeight = height === null ? null : round4(height);
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
   * Structure (all styling left to the host via class hooks; session 79,
   * clef-steps design §2.2):
   *   div.cnb-clef-editor
   *   ├── div.cnb-cle-clef        (a. select.cnb-cle-select: No clef, the
   *   │                            built-in clefs, the imported ones under
   *   │                            optgroup "Imported"; Import from SVG…,
   *   │                            its hidden file input, the import status)
   *   ├── div.cnb-cle-anchor      (b. select.cnb-cle-anchor-select, Top,
   *   │                            Middle, Bottom or A point on the clef,
   *   │                            which opens the picker; the Height; the
   *   │                            dozenal clef's note and Height instead)
   *   ├── div.cnb-cle-sits-on     (c. select.cnb-cle-sits-select, the
   *   │                            canvas's pitches and A semitone of my
   *   │                            own…, with input.cnb-cle-sits; the
   *   │                            dozenal clef's middle of the staff)
   *   ├── div.cnb-cle-space-note  (d. the space after the clef is LilyPond's)
   *   └── div.cnb-cle-validation  (CNBConfig.validate pass-through)
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
   *        `parts` (session 63, step-by-step design §1.3; session 79, design
   *        §2.3) draws only what one step shows: "symbol" (step 10: a, b,
   *        the Height and the validation) and "placement" (step 11: c and
   *        d). Without it the whole panel draws.
   *        `view` (session 79), an object the host keeps across re-mounts:
   *        view.ownSemitone is true while A semitone of my own is open.
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

    const valueFrom = (e, input) =>
      String(e && e.target && e.target.value !== undefined ? e.target.value : input.value);

    // Editor state the host keeps across re-mounts (session 79): whether
    // "A semitone of my own" is open in Sits on.
    const view = opts.view || {};

    // Import panel state (shown by redraw; config state stays in `state`).
    let importStatus = "";
    let importError = "";
    let importWarnings = [];
    // The anchor picker, open for the active glyph clef (session 59).
    let picking = false;
    // The parts one step shows (session 63), or null for the whole panel.
    const parts = Array.isArray(opts.parts) ? new Set(opts.parts) : null;

    const changed = () => {
      redraw();
      onChange({ clef: CNBClefEditor.buildClef(state) }, deepClone(state));
    };

    /**
     * Import a clef glyph from raw SVG text (session-1 importer contract).
     * On success the glyph is added to state.glyphs under the
     * filename-derived name (replacing any existing entry with that name)
     * and becomes the clef shown; on error the state is untouched
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
      state.enabled = true;   // chosen, as in the Clef dropdown (session 79)
      picking = true;   // its anchor point is picked next (session 59)
      importError = "";
      importStatus = `Imported the clef "${result.name}"` +
        (replaced ? " (it replaces the clef of that name)" : "");
      changed();
      return result;
    }

    // ── a. The clef: one dropdown, and Import beside it (session 79) ─────
    /** The active definition while the clef is shown, or null. */
    const shownDef = () => (state.enabled && state.active && isPlainObject(state.glyphs[state.active])
      ? state.glyphs[state.active]
      : null);

    function drawClef() {
      const wrap = el("div", "cnb-cle-section cnb-cle-clef");
      const row = el("div", "cnb-cle-fields");
      row.appendChild(el("span", "cnb-cle-field-label", "Clef"));
      const select = el("select", "cnb-cle-select");
      select.setAttribute("aria-label", "Clef");
      const option = (parent, value, text) => {
        const o = el("option", "", text);
        o.value = value;
        parent.appendChild(o);
      };
      option(select, "none", "No clef");
      const builtIn = new Set(CNBBuiltinClefs.CHOICES.map(c => c.name));
      for (const { name, displayName } of CNBBuiltinClefs.CHOICES) option(select, name, displayName);
      const imported = Object.keys(state.glyphs).filter(name => !builtIn.has(name));
      if (imported.length > 0) {
        const group = el("optgroup", "cnb-cle-imported");
        group.setAttribute("label", "Imported");
        for (const name of imported) option(group, name, (state.glyphs[name] && state.glyphs[name].displayName) || name);
        select.appendChild(group);
      }
      select.value = shownDef() ? state.active : "none";
      select.onchange = (e) => {
        const name = valueFrom(e, select);
        picking = false;
        if (name === "none") {
          state.enabled = false;
        } else {
          if (!(name in state.glyphs)) state.glyphs[name] = CNBBuiltinClefs.definition(currentConfig(), name);
          state.active = name;
          state.enabled = true;
        }
        changed();
      };
      row.appendChild(select);

      // Import from SVG…: the button opens the file input, which stays hidden.
      const input = el("input", "cnb-cle-file");
      input.type = "file";
      input.setAttribute("accept", ".svg,image/svg+xml");
      input.hidden = true;
      input.onchange = (e) => {
        const file = e && e.target && e.target.files && e.target.files[0];
        if (!file) return;
        file.text().then(
          (text) => importClefText(text, file.name),
          (err) => { importError = "Import failed: could not read the file (" + err.message + ")"; redraw(); }
        );
      };
      const importButton = el("button", "cnb-cle-import-button", "Import from SVG…");
      importButton.type = "button";
      importButton.onclick = () => { if (input.click) input.click(); };
      row.appendChild(importButton);
      row.appendChild(input);
      wrap.appendChild(row);
      wrap.appendChild(el("div", "cnb-cle-hint",
        "The dozenal clef is the engine's own number for the register. The treble, bass and alto " +
        "clefs are LilyPond's, each placed on the pitch it marks: G, F or C. An SVG of your own " +
        "is imported as a clef, and you then pick the point of it that sits on its pitch."));

      wrap.appendChild(el("div", "cnb-cle-import-status", importStatus));
      wrap.appendChild(el("div", "cnb-cle-import-error", importError));
      const warnList = el("ul", "cnb-cle-import-warnings");
      for (const w of importWarnings) warnList.appendChild(el("li", "cnb-cle-import-warning", w));
      wrap.appendChild(warnList);
      return wrap;
    }

    // ── b. Its anchor, and its height (session 79) ───────────────────────
    function drawAnchorChoice() {
      const active = shownDef();
      if (!active) return null;
      const wrap = el("div", "cnb-cle-section cnb-cle-anchor");
      const kind = active.kind || "glyph";
      if (kind === "dozenal") {
        wrap.appendChild(el("div", "cnb-cle-dozenal-note",
          "The dozenal clef sits on the middle of the staff, and grows or shrinks about it."));
        wrap.appendChild(drawHeight(active));
        return wrap;
      }
      const row = el("div", "cnb-cle-fields");
      row.appendChild(el("span", "cnb-cle-field-label", "Anchor"));
      const select = el("select", "cnb-cle-anchor-select");
      select.setAttribute("aria-label", "Anchor");
      for (const [value, text] of kind === "glyph" ? ANCHOR_CHOICES : ANCHOR_CHOICES.slice(0, 1)) {
        const o = el("option", "", text);
        o.value = value;
        select.appendChild(o);
      }
      select.value = picking ? "point" : CNBClefEditor.anchorChoice(active);
      if (kind !== "glyph") {
        select.disabled = true;   // a text clef is placed by its top
      } else {
        select.onchange = (e) => {
          const choice = valueFrom(e, select);
          picking = choice === "point";
          if (picking) redraw();
          else adopt(CNBClefEditor.withAnchorChoice(state, choice));
        };
      }
      row.appendChild(select);
      wrap.appendChild(row);
      wrap.appendChild(el("div", "cnb-cle-hint",
        "The point of the clef that sits on its pitch. A new height grows or shrinks the clef about it."));
      if (kind === "glyph" && picking) wrap.appendChild(drawPicker(active));
      if (kind === "glyph") wrap.appendChild(drawHeight(active));
      return wrap;
    }

    // ── c. Where the anchor sits, and d. the space after it (session 79) ─
    function drawSitsOn() {
      const wrap = el("div", "cnb-cle-section cnb-cle-sits-on");
      const active = shownDef();
      if (!active) {
        wrap.appendChild(el("div", "cnb-cle-anchor-empty", "Choose or import a clef in step 10 to place it."));
        return wrap;
      }
      const kind = active.kind || "glyph";
      const row = el("div", "cnb-cle-fields");
      row.appendChild(el("span", "cnb-cle-field-label", "Sits on"));
      if (kind === "dozenal") {
        row.appendChild(el("span", "cnb-cle-sits-fixed", "the middle of the staff"));
        wrap.appendChild(row);
        wrap.appendChild(el("div", "cnb-cle-dozenal-note",
          "The score's own clef sets its number: 50 for treble, 40 for alto, 30 for bass."));
        return wrap;
      }
      const pitches = CNBClefEditor.pitchOptions(currentConfig());
      const onPitch = pitches.some(p => p.semi === active.anchorSemi);
      const own = !!view.ownSemitone || !onPitch;
      const select = el("select", "cnb-cle-sits-select");
      select.setAttribute("aria-label", "Sits on");
      for (const p of pitches) {
        const o = el("option", "", p.name);
        o.value = String(p.semi);
        select.appendChild(o);
      }
      const ownOption = el("option", "", "A semitone of my own…");
      ownOption.value = "own";
      select.appendChild(ownOption);
      select.value = own ? "own" : String(active.anchorSemi);
      const write = (semi) => {
        if (kind === "glyph") adopt(CNBClefEditor.withAnchor(state, semi));
        else { active.anchorSemi = semi; changed(); }
      };
      select.onchange = (e) => {
        const value = valueFrom(e, select);
        view.ownSemitone = value === "own";
        if (view.ownSemitone) redraw();
        else write(Number(value));
      };
      row.appendChild(select);
      if (own) {
        const field = numberField("cnb-cle-sits", active.anchorSemi);
        field.setAttribute("aria-label", "Semitone");
        field.oninput = (e) => {
          const v = numberFrom(e, field);
          if (v !== null) write(v);
        };
        row.appendChild(field);
      }
      wrap.appendChild(row);
      wrap.appendChild(el("div", "cnb-cle-hint", kind === "glyph"
        ? "The pitch the clef's anchor sits on. You can also drag the clef up or down in the " +
          "preview, or its corner to make it taller or shorter about its anchor."
        : "The pitch the top of the clef sits on."));
      return wrap;
    }

    function drawSpaceNote() {
      return el("div", "cnb-cle-hint cnb-cle-space-note",
        "The space after the clef is LilyPond's: it engraves the clef 0.75 staff spaces after the " +
        "start of the staff and spaces what follows from it, and the preview does the same.");
    }

    /** Write an edited clef slice back into the state and report it. */
    function adopt(next) {
      if (!next) return;   // not a number, or not a size the clef can take
      state.glyphs = next.glyphs;
      changed();
    }

    /** A number field. */
    function numberField(className, value) {
      const input = el("input", className);
      input.type = "number";
      input.step = "any";
      input.value = String(value);
      return input;
    }

    /**
     * The active clef's height (session 59): a number in semitones, or
     * Automatic, which follows the staff, for a clef that can take it. The
     * field shows the height drawn.
     */
    function drawHeight(active) {
      const row = el("div", "cnb-cle-fields cnb-cle-size");
      let drawn = null;
      try {
        // Measured as shown, whether or not the clef is on yet.
        const config = CNBClefEditor.applyToConfig(currentConfig(), { ...state, enabled: true });
        const shown = CNBClef.shown(config);
        drawn = shown && Number.isFinite(shown.height) ? round4(shown.height) : null;
      } catch { /* an invalid state: the validation section says why */ }
      const automatic = active.semitoneHeight === null || active.semitoneHeight === undefined;
      const height = numberField("cnb-cle-height", drawn ?? "");
      height.oninput = (e) => {
        const v = numberFrom(e, height);
        if (v !== null) adopt(CNBClefEditor.withHeight(state, v));
      };
      row.appendChild(el("span", "cnb-cle-range-label", "Height"));
      row.appendChild(height);
      row.appendChild(el("span", "cnb-cle-unit", "semitones"));
      if (canBeAutomatic(active)) {
        const label = el("label", "cnb-cle-height-auto");
        const box = el("input", "cnb-cle-height-auto-check");
        box.type = "checkbox";
        box.checked = automatic;
        box.onchange = (e) => adopt(CNBClefEditor.withHeight(state, checkedFrom(e, box) ? null : drawn));
        label.appendChild(box);
        label.appendChild(el("span", "", "Automatic: follows the staff and its noteheads"));
        row.appendChild(label);
      }
      return row;
    }

    /**
     * The anchor picker (session 59): the clef enlarged, its anchor point
     * marked; a click on it moves the point (the clef's reference, in its
     * native SVG units), which then sits on the clef's semitone.
     */
    function drawPicker(active) {
      const wrap = el("div", "cnb-cle-anchor-picker");
      wrap.appendChild(el("div", "cnb-cle-hint",
        "Click the clef at the point that sits on its pitch: the curl of a treble clef, between " +
        "the dots of a bass clef."));
      const SVG = (tag, attrs) => {
        const e = doc.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
        return e;
      };
      const g = CNBKeySignatureEditor.referenceGeometry(active);
      const svg = SVG("svg", { width: Math.ceil(g.width), height: Math.ceil(g.height), class: "cnb-cle-anchor-svg" });
      svg.appendChild(SVG("path", { d: active.svgPath, fill: "#1c1c1e",
        transform: `translate(${g.ox} ${g.oy}) scale(${g.k})` }));
      if (active.reference) {
        const cx = g.ox + active.reference.x * g.k, cy = g.oy + active.reference.y * g.k;
        svg.appendChild(SVG("path", { class: "cnb-cle-anchor-mark",
          d: `M ${cx - 8} ${cy} H ${cx + 8} M ${cx} ${cy - 8} V ${cy + 8}` }));
      }
      svg.onclick = (e) => {
        const rect = svg.getBoundingClientRect ? svg.getBoundingClientRect() : { left: 0, top: 0 };
        active.reference = CNBKeySignatureEditor.referenceAt(g, e.clientX - rect.left, e.clientY - rect.top);
        changed();
      };
      wrap.appendChild(svg);
      const done = el("button", "cnb-cle-anchor-done", "Done");
      done.type = "button";
      done.onclick = () => { picking = false; redraw(); };
      wrap.appendChild(done);
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
      // Step 10 ("symbol"): a, b and Height; step 11 ("placement"): c and
      // d (session 79, design §2.3). Without parts, all of them.
      const symbol = !parts || parts.has("symbol");
      const placement = !parts || parts.has("placement");
      if (symbol) {
        root.appendChild(drawClef());
        const anchor = drawAnchorChoice();
        if (anchor) root.appendChild(anchor);
      }
      if (placement) {
        root.appendChild(drawSitsOn());
        root.appendChild(drawSpaceNote());
      }
      if (symbol) root.appendChild(drawValidation());
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
