/**
 * notehead-panel.js — the notehead panel (session 27)
 *
 * A click on a notehead selects its pitch class and opens this panel,
 * docked under the canvas (design docs/planning/notehead-first-editor-design.md
 * §2). It edits the look of the selected noteheads, and every change goes
 * through the look table and its inference (notehead-inference.js): the
 * panel changes the rows of the selected pitch classes and hands the host
 * writeBack(config, table), so the rules and the palette always follow from
 * the noteheads.
 *
 * The panel has three columns:
 *   - the first selected notehead drawn alone at the Large size, and, with
 *     one notehead selected, "This notehead is: C ▾", which renames it
 *     (session 28, §4.1);
 *   - its look: colour (swatches of the colours in use, None, a colour input,
 *     the colour's colour-blind-safe alternative, Start from a palette),
 *     fill (Solid or Hollow), shape (the config's shapes, then the built-in
 *     ones, then Import from SVG) and size (height and width in semitones,
 *     with an aspect-ratio lock);
 *   - with one notehead selected, its nudge (the Pitch section's control,
 *     session 28) when the pitch axis can show nudges; the side step, shown
 *     only when the pitch axis puts the notehead on a neighbour's spot; and
 *     Give this look to.
 * A marker says when a rule for particular durations or keys also changes
 * the notehead (§5.5); those rules are edited in Advanced.
 *
 * Colour inputs follow session 21's wiring: `input` updates the look and
 * calls onChange without a redraw, so the open picker stays open; `change`
 * redraws.
 *
 * renderRuleList (session 27, design §5.4) draws the Noteheads section's
 * rule list in words, read-only, from ruleLines.
 *
 * Editor contract as the other cnb/ui modules: plain DOM through
 * document.createElement, events wired as element properties, so the panel
 * runs in Node against a stub document. The host owns the config: render()
 * reads it through getConfig and reports each new config through onChange.
 */

import { CNBMusic } from "../src/cnb-music.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBNoteheadInference as I } from "./notehead-inference.js";
import { CNBBuiltinShapes } from "./builtin-shapes.js";
import { CNBPaletteEditor } from "./palette-editor.js";
import { CNBPreviewDisplay } from "./preview-display.js";
import { CNBPitchModel } from "./pitch-model.js";
import { CNBPitchPanel } from "./pitch-panel.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const ACCIDENTALS = [1, 3, 6, 8, 10];
const PARTS = ["colour", "fill", "shape", "size"];

/** The Give this look to choices, in the order shown. */
const GIVE = [
  ["all", "All"],
  ["every-2", "Every other"],
  ["every-3", "Every 3rd"],
  ["every-4", "Every 4th"],
  ["every-6", "Every 6th"],
  ["accidentals", "The accidentals"],
  ["naturals", "The naturals"],
];

const round4 = (x) => Math.round(x * 1e4) / 1e4;

function pcName(pc) {
  const l = CNBMusic.pcLabel(pc);
  return l.text + (l.sharp ? "♯" : "");
}

function listNames(pcs) {
  const n = pcs.map(pcName);
  return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
}

/** The shape's own size in semitones: { height, width }. */
function ownSize(shape) {
  return { height: shape.semitoneHeight, width: round4(shape.naturalWidth * shape.semitoneHeight / shape.naturalHeight) };
}

/** A shape by name, from the config or else the built-in set. */
function shapeOf(config, name) {
  return (config.shapes && config.shapes[name]) || CNBBuiltinShapes.get(name);
}

/** A small solid drawing of a shape, at 7 px per semitone, as an <svg>. */
function thumbnail(shape) {
  const m = CNBNotehead.measure(shape, 7);
  const svg = globalThis.document.createElementNS(SVG_NS, "svg");
  const w = Math.ceil(m.pixelWidth) + 4;
  const h = Math.ceil(m.pixelHeight) + 4;
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  CNBNotehead.render(svg, { shape, x: w / 2, y: h / 2, scaleFactor: m.scaleFactor, hollow: false, color: "#1c1c1e" });
  return svg;
}

/** The colours in use, lower-cased, in pitch-class order. */
function coloursInUse(table) {
  const out = [];
  for (const row of table) {
    const hex = row.color && row.color.toLowerCase();
    if (hex && !out.includes(hex)) out.push(hex);
  }
  return out;
}

export const CNBNoteheadPanel = {

  GIVE,
  PARTS,

  /**
   * The pitch classes a Give this look to choice covers, from pc: "all",
   * "every-N" (N in 2, 3, 4, 6: pc, pc + N, …), "accidentals", "naturals".
   * @param {number} pc 0–11
   * @param {string} kind
   * @returns {number[]}
   */
  giveTargets(pc, kind) {
    const all = [...Array(12).keys()];
    if (kind === "all") return all;
    if (kind === "accidentals") return ACCIDENTALS.slice();
    if (kind === "naturals") return all.filter(p => !ACCIDENTALS.includes(p));
    const m = /^every-(2|3|4|6)$/.exec(kind);
    if (m) return all.filter(p => (p - pc + 12) % Number(m[1]) === 0);
    throw new Error(`giveTargets: unknown choice ${JSON.stringify(kind)}`);
  },

  /**
   * A new look table with the given parts of a look copied to the pitch
   * classes: "colour" (color), "fill" (hollow), "shape", "size" (heightSemis
   * and widthSemis). The side step is never copied. The input is not changed.
   * @param {object[]} table
   * @param {number[]} pcs
   * @param {object} look   a look-table row
   * @param {string[]} parts
   * @returns {object[]}
   */
  applyLook(table, pcs, look, parts) {
    return table.map(row => {
      if (!pcs.includes(row.pc)) return row;
      const out = { ...row };
      if (parts.includes("colour")) out.color = look.color;
      if (parts.includes("fill")) out.hollow = look.hollow;
      if (parts.includes("shape")) out.shape = look.shape;
      if (parts.includes("size")) {
        out.heightSemis = look.heightSemis;
        out.widthSemis = look.widthSemis;
      }
      return out;
    });
  },

  /**
   * Whether the pitch axis puts pc on the same spot as the pitch class just
   * below or just above it (then the side step is offered). False with no
   * enabled axis.
   * @param {object} config
   * @param {number} pc 0–11
   * @returns {boolean}
   */
  sharesSpot(config, pc) {
    const axis = CNBPitchAxis.create(config);
    if (!axis.enabled) return false;
    const p = axis.positionOfSemi(pc);
    return axis.positionOfSemi(pc - 1) === p || axis.positionOfSemi(pc + 1) === p;
  },

  /**
   * A look in words, for the panel's head: "kite up · hollow · rose". The
   * colour is its palette name, else its nearest colour name, else "black".
   * @param {object} config
   * @param {object} row  a look-table row
   * @returns {string}
   */
  summary(config, row) {
    const hex = row.color && row.color.toLowerCase();
    const entry = hex && ((config.palette && config.palette.colors) || []).find(c => c.hex.toLowerCase() === hex);
    const colour = !hex ? "black" : (entry && entry.name ? entry.name : CNBPaletteEditor.baseColorName(hex)).toLowerCase();
    return [row.shape.replace(/-/g, " "), row.hollow ? "hollow" : "solid", colour].join(" · ");
  },

  /**
   * The rules for particular durations or keys (the rules the inference
   * does not own, §5.5) that also change this pitch class.
   * @param {object} config
   * @param {number} pc
   * @returns {object[]}
   */
  keptRulesFor(config, pc) {
    return (config.noteheadRules || []).filter(r => !I.ownsRule(r) &&
      (r.match.pitchClasses === "all" || (r.match.pitchClasses || []).includes(pc)));
  },

  /**
   * The config with a colour-blind-safe alternative for one colour: every
   * pitch class whose palette colour is hex gets twin in
   * palette.cbSafeColors. The input is not changed.
   * @param {object} config
   * @param {string} hex
   * @param {string} twin
   * @returns {object}
   */
  withTwin(config, hex, twin) {
    const palette = config.palette || { colors: [] };
    const cb = (palette.cbSafeColors || []).slice();
    for (const c of palette.colors || []) {
      if (c.hex.toLowerCase() !== hex.toLowerCase()) continue;
      const entry = { pc: c.pc, hex: twin, name: CNBPaletteEditor.baseColorName(twin) };
      const i = cb.findIndex(e => e.pc === c.pc);
      if (i >= 0) cb[i] = entry;
      else cb.push(entry);
    }
    return { ...config, palette: { ...palette, cbSafeColors: cb } };
  },

  /**
   * The Noteheads section's rule list (design §5.4): one read-only line per
   * attribute from ruleLines, in words, with swatches for the colours and
   * thumbnails for the shapes. Hovering a line calls onHover with the pitch
   * classes it covers (those away from the default), and leaving it calls
   * onHover([]). Appended to host as a ul.cnb-nhp-rules.
   * @param {HTMLElement} host
   * @param {object} config
   * @param {{onHover?: (pcs: number[]) => void}} [opts]
   * @returns {HTMLUListElement}
   */
  renderRuleList(host, config, { onHover = () => {} } = {}) {
    const doc = globalThis.document;
    const list = doc.createElement("ul");
    list.className = "cnb-nhp-rules";
    for (const line of I.ruleLines(config, I.lookTable(config))) {
      const li = doc.createElement("li");
      li.className = "cnb-nhp-rule";
      li.setAttribute("data-attribute", line.attribute);
      const marks = doc.createElement("span");
      marks.className = "cnb-nhp-rule-marks";
      for (const { value } of line.values) {
        if (line.attribute === "colour") {
          const s = doc.createElement("span");
          s.className = "cnb-nhp-rule-swatch" + (value === null ? " cnb-nhp-none" : "");
          if (value !== null) s.style.background = value;
          marks.appendChild(s);
        } else if (line.attribute === "shape") {
          const shape = shapeOf(config, value);
          if (shape) marks.appendChild(thumbnail(shape));
        }
      }
      li.appendChild(marks);
      const words = doc.createElement("span");
      words.className = "cnb-nhp-rule-words";
      words.textContent = line.words;
      li.appendChild(words);
      const covered = line.values.slice(1).flatMap(v => v.pcs).sort((a, b) => a - b);
      li.onmouseenter = () => onHover(covered.length ? covered : line.values[0].pcs);
      li.onmouseleave = () => onHover([]);
      list.appendChild(li);
    }
    host.appendChild(list);
    return list;
  },

  /**
   * Render the panel for the selected pitch classes (the first is the one
   * drawn and whose look the controls show; every edit applies to all).
   * @param {HTMLElement} container
   * @param {{getConfig: () => object, selection: number[],
   *          onChange?: (config: object) => void, onClose?: () => void,
   *          onRename?: (toPc: number) => void,
   *          importControl?: (host: HTMLElement) => void}} opts
   *        importControl draws the host's SVG importer into the shape row;
   *        the host adds the imported shape and calls chooseShape(name).
   *        onRename (session 28): after a rename has been reported through
   *        onChange, the new name of the selected notehead, so the host can
   *        move the selection to it and draw the panel again.
   * @returns {{root: HTMLElement, redraw: () => void, chooseShape: (name: string) => void}}
   */
  render(container, opts = {}) {
    if (typeof opts.getConfig !== "function") {
      throw new Error("CNBNoteheadPanel.render requires opts.getConfig — the host owns config state");
    }
    const selection = (opts.selection || []).slice();
    if (selection.length === 0) throw new Error("CNBNoteheadPanel.render requires a selection");
    const getConfig = opts.getConfig;
    const onChange = opts.onChange || (() => {});
    const onClose = opts.onClose || (() => {});
    const onRename = opts.onRename || (() => {});
    const importControl = opts.importControl || null;
    const doc = globalThis.document;
    const pc = selection[0];

    let lock = true;                 // Keep aspect ratio (editor state only)
    let parts = PARTS.slice();       // what Give this look to copies

    const el = (tag, className, text) => {
      const e = doc.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const button = (className, text, onclick) => {
      const b = el("button", className, text);
      b.type = "button";
      b.onclick = onclick;
      return b;
    };
    const valueOf = (e, input) => (e && e.target && e.target.value !== undefined ? e.target.value : input.value);

    const root = el("div", "cnb-notehead-panel");

    /** Write a table (and any extra config change) through the inference. */
    function commit(table, { config = getConfig(), redraw = true } = {}) {
      onChange(I.writeBack(config, table));
      if (redraw) draw();
    }

    /** Change the selected rows of the current look table. */
    /** Change the rows of the selected pitch classes (or of pcs, a part of
     *  the selection) in the current look table. */
    function edit(change, { pcs = selection, ...options } = {}) {
      const table = I.lookTable(getConfig()).map(row => (pcs.includes(row.pc) ? { ...row, ...change(row) } : row));
      commit(table, options);
    }

    /** A colour for the selection; a new colour also gets its Scheme symbol. */
    function setColour(hex, { redraw = true } = {}) {
      const color = hex === null ? null : hex.toLowerCase();
      let config = getConfig();
      if (color && color !== "#000000") {
        const symbols = (config.palette && config.palette.schemeSymbols) || {};
        if (!Object.keys(symbols).some(k => k.toLowerCase() === color)) {
          const palette = config.palette || { colors: [] };
          config = { ...config, palette: { ...palette, schemeSymbols: { ...symbols, [color]: CNBPaletteEditor.colorSchemeSymbol(color) } } };
        }
      }
      const table = I.lookTable(getConfig()).map(row => (selection.includes(row.pc) ? { ...row, color } : row));
      commit(table, { config, redraw });
    }

    function chooseShape(name) {
      const config = CNBBuiltinShapes.withShape(getConfig(), name);
      const table = I.lookTable(getConfig()).map(row => (selection.includes(row.pc) ? { ...row, shape: name } : row));
      commit(table, { config });
    }

    // ── The notehead alone, at Large ──────────────────────────────────────
    function drawCloseUp(config) {
      const wrap = el("div", "cnb-nhp-closeup");
      const drawn = CNBPreviewDisplay.displayConfig(config, "large");
      if (drawn.clef) drawn.clef = { ...drawn.clef, enabled: false };
      if (drawn.keys) drawn.keys = { ...drawn.keys, keySignature: { ...(drawn.keys.keySignature || {}), enabled: false } };
      CNBCollection.render(wrap, drawn, { pitchClasses: [pc], durations: ["crotchet"], fluid: true, rows: 1 });
      return wrap;
    }

    // ── Colour ────────────────────────────────────────────────────────────
    function drawColour(config, table) {
      const row = table[pc];
      const group = el("div", "cnb-nhp-group cnb-nhp-colour");
      group.appendChild(el("p", "cnb-nhp-label", "Colour"));
      const swatches = el("div", "cnb-nhp-swatches");
      const current = row.color && row.color.toLowerCase();
      const none = button("cnb-nhp-swatch cnb-nhp-none" + (current ? "" : " on"), "", () => setColour(null));
      none.title = "None (black)";
      none.setAttribute("data-color", "none");
      swatches.appendChild(none);
      for (const hex of coloursInUse(table)) {
        const s = button("cnb-nhp-swatch" + (hex === current ? " on" : ""), "", () => setColour(hex));
        s.style.background = hex;
        s.title = CNBPaletteEditor.baseColorName(hex);
        s.setAttribute("data-color", hex);
        swatches.appendChild(s);
      }
      group.appendChild(swatches);

      const pick = el("label", "cnb-nhp-pick");
      pick.appendChild(el("span", "", "New colour…"));
      const input = el("input", "cnb-nhp-color-input");
      input.type = "color";
      input.value = current || "#000000";
      input.oninput = (e) => setColour(valueOf(e, input), { redraw: false });
      input.onchange = (e) => setColour(valueOf(e, input));
      pick.appendChild(input);
      group.appendChild(pick);

      if (current) {
        const cb = ((config.palette && config.palette.cbSafeColors) || []).find(c => c.pc === pc);
        const twin = el("label", "cnb-nhp-pick cnb-nhp-twin");
        twin.appendChild(el("span", "", "Colour-blind-safe alternative"));
        const tInput = el("input", "cnb-nhp-twin-input");
        tInput.type = "color";
        tInput.value = cb ? cb.hex : current;
        const setTwin = (e, redraw) => {
          onChange(CNBNoteheadPanel.withTwin(getConfig(), current, valueOf(e, tInput)));
          if (redraw) draw();
        };
        tInput.oninput = (e) => setTwin(e, false);
        tInput.onchange = (e) => setTwin(e, true);
        twin.appendChild(tInput);
        group.appendChild(twin);
      }

      const presets = el("select", "cnb-nhp-preset");
      const first = el("option", "", "Start from a palette…");
      first.value = "";
      presets.appendChild(first);
      for (const [key, info] of Object.entries(CNBPaletteEditor.PALETTE_PRESET_KEYS)) {
        const o = el("option", "", info.label);
        o.value = key;
        presets.appendChild(o);
      }
      presets.value = "";
      presets.onchange = (e) => {
        const key = valueOf(e, presets);
        const info = CNBPaletteEditor.PALETTE_PRESET_KEYS[key];
        if (!info) return;
        const palette = CNBPaletteEditor.buildPalette({
          source: "preset", family: info.family, presetKey: key, customColors: [], useCBSafe: false,
        });
        const base = getConfig();
        const config = { ...base, palette: { ...(base.palette || {}), ...palette } };
        const table = I.lookTable(base).map(r => {
          const entry = palette.colors.find(c => c.pc === r.pc);
          return { ...r, color: entry ? entry.hex : null };
        });
        commit(table, { config });
      };
      group.appendChild(presets);
      return group;
    }

    // ── Fill ──────────────────────────────────────────────────────────────
    function drawFill(table) {
      const group = el("div", "cnb-nhp-group cnb-nhp-fill");
      group.appendChild(el("p", "cnb-nhp-label", "Fill"));
      const seg = el("div", "cnb-nhp-segmented");
      for (const [hollow, text] of [[false, "Solid"], [true, "Hollow"]]) {
        const b = button("cnb-nhp-fill-option" + (table[pc].hollow === hollow ? " on" : ""), text,
          () => edit(() => ({ hollow })));
        b.setAttribute("data-fill", hollow ? "hollow" : "solid");
        seg.appendChild(b);
      }
      group.appendChild(seg);
      return group;
    }

    // ── Shape ─────────────────────────────────────────────────────────────
    function drawShape(config, table) {
      const group = el("div", "cnb-nhp-group cnb-nhp-shape");
      group.appendChild(el("p", "cnb-nhp-label", "Shape"));
      const list = el("div", "cnb-nhp-shapes");
      const names = Object.keys(config.shapes || {});
      for (const name of CNBBuiltinShapes.NAMES) if (!names.includes(name)) names.push(name);
      for (const name of names) {
        const shape = shapeOf(config, name);
        const b = button("cnb-nhp-shape-option" + (table[pc].shape === name ? " on" : ""), "", () => chooseShape(name));
        b.setAttribute("data-shape", name);
        b.title = shape.displayName || name;
        b.appendChild(thumbnail(shape));
        list.appendChild(b);
      }
      group.appendChild(list);
      if (importControl) {
        const slot = el("div", "cnb-nhp-import");
        importControl(slot);
        group.appendChild(slot);
      }
      return group;
    }

    // ── Size ──────────────────────────────────────────────────────────────
    function drawSize(config, table) {
      const row = table[pc];
      const shape = shapeOf(config, row.shape);
      const own = ownSize(shape);
      const height = row.heightSemis ?? own.height;
      const width = row.widthSemis ?? own.width;
      const group = el("div", "cnb-nhp-group cnb-nhp-size");
      group.appendChild(el("p", "cnb-nhp-label", "Size"));

      /** Write a size, clearing each value equal to the shape's own. */
      const setSize = (h, w) => edit(r => {
        const o = ownSize(shapeOf(getConfig(), r.shape));
        return {
          heightSemis: round4(h) === round4(o.height) ? null : round4(h),
          widthSemis: round4(w) === round4(o.width) ? null : round4(w),
        };
      });
      const ratio = shape.naturalWidth / shape.naturalHeight;
      const field = (cls, label, value, onValue) => {
        const wrap = el("label", "cnb-nhp-field");
        wrap.appendChild(el("span", "", label));
        const input = el("input", cls);
        input.type = "number";
        input.min = "0.25";
        input.max = "4";
        input.step = "0.05";
        input.value = String(round4(value));
        input.onchange = (e) => {
          const v = Number(valueOf(e, input));
          if (Number.isFinite(v) && v > 0) onValue(v);
        };
        wrap.appendChild(input);
        wrap.appendChild(el("span", "cnb-nhp-unit", "semitones"));
        return wrap;
      };
      group.appendChild(field("cnb-nhp-height", "Height", height, (h) => setSize(h, lock ? h * ratio : width)));
      group.appendChild(field("cnb-nhp-width", "Width", width, (w) => setSize(lock ? w / ratio : height, w)));

      const lockLabel = el("label", "cnb-nhp-lock");
      const box = el("input", "cnb-nhp-lock-input");
      box.type = "checkbox";
      box.checked = lock;
      box.onchange = (e) => { lock = e && e.target ? !!e.target.checked : !lock; };
      lockLabel.appendChild(box);
      lockLabel.appendChild(el("span", "", "Keep aspect ratio"));
      group.appendChild(lockLabel);
      group.appendChild(button("cnb-nhp-size-reset", "The shape's own size",
        () => edit(() => ({ heightSemis: null, widthSemis: null }))));
      return group;
    }

    // ── Side step ─────────────────────────────────────────────────────────
    /** Shown when a selected notehead shares a spot; it edits only those
     *  that do, and shows the first one's step. */
    function drawSideStep(config, table) {
      const sharing = selection.filter(p => CNBNoteheadPanel.sharesSpot(config, p));
      if (sharing.length === 0) return null;
      const group = el("div", "cnb-nhp-group cnb-nhp-side");
      group.appendChild(el("p", "cnb-nhp-label", "Side step"));
      const wrap = el("label", "cnb-nhp-field");
      const input = el("input", "cnb-nhp-side-input");
      input.type = "number";
      input.step = "0.05";
      input.value = String(table[sharing[0]].xOffsetStaffSpaces || 0);
      input.onchange = (e) => {
        const v = Number(valueOf(e, input));
        if (Number.isFinite(v)) edit(() => ({ xOffsetStaffSpaces: v }), { pcs: sharing });
      };
      wrap.appendChild(input);
      wrap.appendChild(el("span", "cnb-nhp-unit", "staff spaces"));
      group.appendChild(wrap);
      const names = listNames(sharing.slice().sort((a, b) => a - b));
      group.appendChild(el("p", "cnb-nhp-hint", sharing.length === 1
        ? `${names} shares its spot with a neighbour; a side step keeps the two readable.`
        : `${names} share their spots with neighbours; a side step keeps them readable.`));
      return group;
    }

    // ── Name and nudge (session 28, design §2, §4.1) ──────────────────────
    /** "This notehead is: C ▾": renaming moves the names, not the picture. */
    function drawName() {
      const group = el("div", "cnb-nhp-group cnb-nhp-name");
      const label = el("label", "cnb-nhp-field");
      label.appendChild(el("span", "cnb-nhp-label", "This notehead is:"));
      const select = el("select", "cnb-nhp-name-select");
      for (let p = 0; p < 12; p++) {
        const option = el("option", "", pcName(p));
        option.value = String(p);
        if (p === pc) option.selected = true;
        select.appendChild(option);
      }
      select.value = String(pc);
      select.onchange = (e) => {
        const to = Number(valueOf(e, select));
        if (!Number.isInteger(to) || to === pc) return;
        onChange(CNBPitchModel.renameNotehead(getConfig(), pc, to));
        onRename(to);
      };
      label.appendChild(select);
      group.appendChild(label);
      group.appendChild(el("p", "cnb-nhp-hint",
        "Renaming changes the names only: every notehead keeps its look and its place."));
      return group;
    }

    /** The selected notehead's nudge, when the pitch axis can show nudges. */
    function drawNudge(config) {
      if (!CNBPitchModel.readNudges(config)) return null;
      const group = el("div", "cnb-nhp-group cnb-nhp-nudge");
      group.appendChild(el("p", "cnb-nhp-label", "Nudge"));
      CNBPitchPanel.nudgeControl(group, { config, pc, onChange: (c) => { onChange(c); draw(); } });
      group.appendChild(el("p", "cnb-nhp-hint", pc === 0
        ? "C is the reference: nudges are measured from it. Nudge the others to move them against C."
        : "Up to a semitone above or below its own place, never past its neighbours."));
      return group;
    }

    // ── Give this look to ─────────────────────────────────────────────────
    function drawGive() {
      const group = el("div", "cnb-nhp-group cnb-nhp-give");
      group.appendChild(el("p", "cnb-nhp-label", "Give this look to"));
      const which = el("div", "cnb-nhp-give-parts");
      for (const part of PARTS) {
        const label = el("label", "cnb-nhp-give-part");
        const box = el("input", "");
        box.type = "checkbox";
        box.checked = parts.includes(part);
        box.setAttribute("data-part", part);
        box.onchange = (e) => {
          const on = e && e.target ? !!e.target.checked : !parts.includes(part);
          parts = PARTS.filter(p => (p === part ? on : parts.includes(p)));
        };
        label.appendChild(box);
        label.appendChild(el("span", "", part[0].toUpperCase() + part.slice(1)));
        which.appendChild(label);
      }
      group.appendChild(which);
      const choices = el("div", "cnb-nhp-give-choices");
      for (const [kind, text] of GIVE) {
        const b = button("cnb-nhp-give-option", text, () => {
          const table = I.lookTable(getConfig());
          const targets = CNBNoteheadPanel.giveTargets(pc, kind);
          commit(CNBNoteheadPanel.applyLook(table, targets, table[pc], parts));
        });
        b.setAttribute("data-give", kind);
        choices.appendChild(b);
      }
      group.appendChild(choices);
      return group;
    }

    function draw() {
      root.textContent = "";
      const config = getConfig();
      const table = I.lookTable(config);

      const head = el("div", "cnb-nhp-head");
      const title = selection.length === 1 ? pcName(pc)
        : `${listNames(selection.slice().sort((a, b) => a - b))} (${selection.length} noteheads)`;
      head.appendChild(el("h2", "cnb-nhp-title", title));
      head.appendChild(el("span", "cnb-nhp-summary", CNBNoteheadPanel.summary(config, table[pc])));
      const close = button("cnb-nhp-close", "Close ✕", () => onClose());
      close.title = "Close (Esc)";
      close.setAttribute("aria-label", "Close");
      head.appendChild(close);
      root.appendChild(head);

      const kept = CNBNoteheadPanel.keptRulesFor(config, pc).length;
      if (kept) {
        root.appendChild(el("p", "cnb-nhp-kept",
          `${kept} ${kept === 1 ? "rule" : "rules"} for particular durations or keys also ${kept === 1 ? "changes" : "change"} this notehead — Advanced`));
      }

      const body = el("div", "cnb-nhp-body");
      const left = el("div", "cnb-nhp-col cnb-nhp-left");
      left.appendChild(drawCloseUp(config));
      if (selection.length === 1) left.appendChild(drawName());
      const middle = el("div", "cnb-nhp-col cnb-nhp-look");
      middle.appendChild(drawColour(config, table));
      middle.appendChild(drawFill(table));
      middle.appendChild(drawShape(config, table));
      middle.appendChild(drawSize(config, table));
      const right = el("div", "cnb-nhp-col cnb-nhp-right");
      const nudge = selection.length === 1 ? drawNudge(config) : null;
      if (nudge) right.appendChild(nudge);
      const side = drawSideStep(config, table);
      if (side) right.appendChild(side);
      right.appendChild(drawGive());
      body.appendChild(left);
      body.appendChild(middle);
      body.appendChild(right);
      root.appendChild(body);
    }

    container.appendChild(root);
    draw();
    return { root, redraw: draw, chooseShape };
  },
};
