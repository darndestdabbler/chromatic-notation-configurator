/**
 * notehead-panel.js — the notehead panel (session 27)
 *
 * A click on a notehead selects its pitch class and opens this panel,
 * docked under the canvas (design docs/planning/notehead-first-editor-design.md
 * §2). It edits the look of the selected noteheads, and every change goes
 * through the look table and its inference (notehead-inference.js): the
 * panel changes the rows of the selected pitch classes and hands the host
 * writeBack(config, table), so the rules always follow from the noteheads.
 *
 * The panel has three columns:
 *   - the first selected notehead drawn alone at the Large size, and, with
 *     one notehead selected, "This notehead is: C ▾", which renames it
 *     (session 28, §4.1);
 *   - its look: colour (swatches of the colours in use, None, a colour input,
 *     and the Suggested colours help, session 37),
 *     fill (Solid or Hollow), shape (the config's shapes, then the built-in
 *     ones, then Import from SVG) and size (height and width in semitones,
 *     with an aspect-ratio lock);
 *   - with one notehead selected, its nudge (the Pitch section's control,
 *     session 28) when the pitch axis can show nudges; and the side step,
 *     shown only when the pitch axis puts the notehead on a neighbour's spot.
 * A marker says when a rule for particular durations or keys also changes
 * the notehead (§5.5); those rules are edited in Advanced.
 *
 * The panel says how to use it on many noteheads (session 38): a hint under
 * the head on adding (Shift+click or Ctrl+click) and clearing the selection.
 * A look is given to many noteheads by selecting them; Give this look to,
 * which copied a look to a choice of noteheads, went in session 42, since
 * beside a selection it read as a contradiction.
 *
 * A new shape keeps the notehead's height, and its width follows the new
 * shape's proportions (session 42), so a Kite 4 semitones tall is 4 wide.
 *
 * Colour inputs apply once (session 36): while the designer drags, `input`
 * only tints the close-up notehead (the field shows its own colour) and
 * writes nothing; `change`, when the picker closes, writes the colour
 * through onChange and redraws.
 *
 * Colour lives on the noteheads (session 37): the config has no palette,
 * and the curated sets (colour-sets.js) are suggestions, applied from the
 * Suggested colours help. A colour-blind version is the config saved under
 * another name with other colours.
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
import { CNBColor } from "../src/cnb-color.js";
import { CNBColourSets } from "./colour-sets.js";
import { CNBPreviewDisplay } from "./preview-display.js";
import { CNBPitchModel } from "./pitch-model.js";
import { CNBPitchPanel } from "./pitch-panel.js";

const SVG_NS = "http://www.w3.org/2000/svg";
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

  /**
   * A small solid drawing of a shape, at 7 px per semitone, as an <svg>: the
   * shape buttons' picture, shared with the Key signature panel's looks
   * (session 50).
   * @param {object} shape
   * @returns {SVGSVGElement}
   */
  thumbnail,

  /**
   * A look-table row with a new shape (session 42). A notehead at its
   * shape's own size takes the new shape's own size; otherwise it keeps its
   * height and its width follows the new shape's proportions. A size equal
   * to the new shape's own is written as none. The input is not changed.
   * @param {object} config  a config holding the new shape (or a built-in)
   * @param {object} row     a look-table row
   * @param {string} name    the new shape's name
   * @returns {object}
   */
  withShape(config, row, name) {
    if (row.heightSemis === null || row.heightSemis === undefined) {
      return { ...row, shape: name, heightSemis: null, widthSemis: null };
    }
    const shape = shapeOf(config, name);
    const own = ownSize(shape);
    const h = round4(row.heightSemis);
    const w = round4(h * shape.naturalWidth / shape.naturalHeight);
    return { ...row, shape: name, heightSemis: h === round4(own.height) ? null : h, widthSemis: w === own.width ? null : w };
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
   * colour is its nearest colour name, else "black".
   * @param {object} config
   * @param {object} row  a look-table row
   * @returns {string}
   */
  summary(config, row) {
    const hex = row.color && row.color.toLowerCase();
    const colour = !hex ? "black" : CNBColor.baseColorName(hex).toLowerCase();
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
   * The general notehead height (session 39): the most common height the
   * noteheads are drawn at, in semitones (a notehead with no size set is at
   * its shape's own semitoneHeight). Ties go to C's.
   * @param {object} config
   * @returns {number}
   */
  generalHeight(config) {
    const heights = I.lookTable(config).map(r => r.heightSemis ?? shapeOf(config, r.shape).semitoneHeight);
    let best = heights[0];
    const count = (h) => heights.filter(x => x === h).length;
    for (const h of heights) if (count(h) > count(best)) best = h;
    return best;
  },

  /**
   * A new config with every notehead at this height, in semitones, and its
   * width at its shape's own proportions (session 39). A size equal to the
   * shape's own is written as none; null puts every notehead at its
   * shape's own size. Written through the look table, so the Default rule
   * carries the height. The input is not changed.
   * @param {object} config
   * @param {number|null} height
   * @returns {object}
   */
  setGeneralHeight(config, height) {
    const table = I.lookTable(config).map(row => {
      if (height === null) return { ...row, heightSemis: null, widthSemis: null };
      const shape = shapeOf(config, row.shape);
      const own = ownSize(shape);
      const h = round4(height);
      const w = round4(height * shape.naturalWidth / shape.naturalHeight);
      return { ...row, heightSemis: h === round4(own.height) ? null : h, widthSemis: w === own.width ? null : w };
    });
    return I.writeBack(config, table);
  },

  /**
   * The Notehead height section's control (session 39): one Height field in
   * semitones, which sets every notehead's height (setGeneralHeight), and a
   * button for the shapes' own heights. Each edit reports the new config
   * through onChange. Appended to container as a div.cnb-nhp-general.
   * @param {HTMLElement} container
   * @param {{getConfig: () => object, onChange?: (config: object) => void}} opts
   * @returns {{root: HTMLElement, redraw: () => void}}
   */
  renderGeneralHeight(container, opts = {}) {
    if (typeof opts.getConfig !== "function") {
      throw new Error("CNBNoteheadPanel.renderGeneralHeight requires opts.getConfig — the host owns config state");
    }
    const { getConfig } = opts;
    const onChange = opts.onChange || (() => {});
    const doc = globalThis.document;
    const el = (tag, className, text) => {
      const e = doc.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const root = el("div", "cnb-nhp-group cnb-nhp-general");

    function draw() {
      root.textContent = "";
      const wrap = el("label", "cnb-nhp-field");
      wrap.appendChild(el("span", "", "Height"));
      const input = el("input", "cnb-nhp-general-height");
      input.type = "number";
      input.min = "0.25";
      input.max = "4";
      input.step = "0.05";
      input.value = String(round4(CNBNoteheadPanel.generalHeight(getConfig())));
      input.onchange = (e) => {
        const v = Number(e && e.target && e.target.value !== undefined ? e.target.value : input.value);
        if (!(Number.isFinite(v) && v > 0)) return;
        onChange(CNBNoteheadPanel.setGeneralHeight(getConfig(), v));
        draw();
      };
      wrap.appendChild(input);
      wrap.appendChild(el("span", "cnb-nhp-unit", "semitones"));
      root.appendChild(wrap);
      const reset = el("button", "cnb-nhp-general-reset", "The shape's own height");
      reset.type = "button";
      reset.onclick = () => {
        onChange(CNBNoteheadPanel.setGeneralHeight(getConfig(), null));
        draw();
      };
      root.appendChild(reset);
      root.appendChild(el("p", "cnb-nhp-hint",
        "Every notehead's height, in semitones on the staff; each keeps its shape's proportions. " +
        "Set this first: the staff, the ledger lines and each notehead's own size are judged against it."));
    }

    container.appendChild(root);
    draw();
    return { root, redraw: draw };
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

    /** A colour for the selection (null: none, drawn black). */
    function setColour(hex) {
      const color = hex === null ? null : hex.toLowerCase();
      const table = I.lookTable(getConfig()).map(row => (selection.includes(row.pc) ? { ...row, color } : row));
      commit(table);
    }

    /** While a colour field is dragged (session 36): only the close-up's
     *  noteheads take the colour; nothing is written or redrawn. */
    let closeUp = null;
    function tintCloseUp(hex) {
      const visit = (node) => {
        for (const child of node.children || []) {
          const tag = String(child.tagName || child.tag || "").toLowerCase();
          if (tag === "path" && child.getAttribute("fill") !== "white") child.setAttribute("fill", hex);
          visit(child);
        }
      };
      if (closeUp) visit(closeUp);
    }

    function chooseShape(name) {
      const config = CNBBuiltinShapes.withShape(getConfig(), name);
      const table = I.lookTable(getConfig())
        .map(row => (selection.includes(row.pc) ? CNBNoteheadPanel.withShape(config, row, name) : row));
      commit(table, { config });
    }

    // ── The notehead alone, at Large ──────────────────────────────────────
    function drawCloseUp(config) {
      const wrap = el("div", "cnb-nhp-closeup");
      const drawn = CNBPreviewDisplay.displayConfig(config, "large");
      if (drawn.clef) drawn.clef = { ...drawn.clef, enabled: false };
      if (drawn.keys) drawn.keys = { ...drawn.keys, keySignature: { ...(drawn.keys.keySignature || {}), enabled: false } };
      CNBCollection.render(wrap, drawn, { pitchClasses: [pc], durations: ["crotchet"], fluid: true, rows: 1 });
      closeUp = wrap;
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
        s.title = CNBColor.baseColorName(hex);
        s.setAttribute("data-color", hex);
        swatches.appendChild(s);
      }
      group.appendChild(swatches);

      const pick = el("label", "cnb-nhp-pick");
      pick.appendChild(el("span", "", "New colour…"));
      const input = el("input", "cnb-nhp-color-input");
      input.type = "color";
      input.value = current || "#000000";
      // A drag only tints the close-up; the colour applies when it ends
      // (session 36), so the canvas redraws once and keeps up.
      input.oninput = (e) => tintCloseUp(valueOf(e, input));
      input.onchange = (e) => setColour(valueOf(e, input));
      pick.appendChild(input);
      group.appendChild(pick);

      group.appendChild(drawSuggestions());
      return group;
    }

    /** The Suggested colours help (session 37): the curated sets, each
     *  with its swatches and an Apply that colours the twelve noteheads. */
    function drawSuggestions() {
      const help = el("details", "cnb-nhp-suggest");
      help.appendChild(el("summary", "", "Suggested colours"));
      help.appendChild(el("p", "cnb-nhp-suggest-note",
        "Sets to start from, cycled over the twelve noteheads. Those marked colour-blind safe stay " +
        "distinct for most colour-blind readers. For a colour-blind version of your notation, save " +
        "it under another name and give that copy other colours."));
      const list = el("ul", "cnb-nhp-suggest-sets");
      for (const set of CNBColourSets.SETS) {
        const item = el("li", "cnb-nhp-suggest-set");
        item.setAttribute("data-set", set.key);
        const strip = el("span", "cnb-nhp-suggest-swatches");
        for (const c of set.colors) {
          const s = el("span", "cnb-nhp-suggest-swatch");
          s.style.background = c.hex;
          s.title = c.name;
          strip.appendChild(s);
        }
        item.appendChild(strip);
        item.appendChild(el("span", "cnb-nhp-suggest-label", set.label));
        item.appendChild(button("cnb-nhp-suggest-apply", "Apply", () => commit(CNBColourSets.apply(I.lookTable(getConfig()), set.key))));
        list.appendChild(item);
      }
      help.appendChild(list);
      return help;
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
      group.appendChild(el("p", "cnb-nhp-hint",
        "Up to a semitone above or below its own place, never past its neighbours."));
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
      close.title = "Close and clear the selection (Esc)";
      close.setAttribute("aria-label", "Close");
      head.appendChild(close);
      root.appendChild(head);
      // How to select several (session 38).
      root.appendChild(el("p", "cnb-nhp-hint cnb-nhp-select-hint", selection.length === 1
        ? "Shift+click or Ctrl+click more noteheads on the staff to change them together."
        : "Shift+click or Ctrl+click a selected notehead to drop it. Esc or Close clears the selection."));

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
      body.appendChild(left);
      body.appendChild(middle);
      if (right.children.length) body.appendChild(right);
      root.appendChild(body);
    }

    container.appendChild(root);
    draw();
    return { root, redraw: draw, chooseShape };
  },
};
