/**
 * key-signature-editor.js — Key Signature Editor (set 010, session 2)
 *
 * Edits the `config.keys` section activated in set 010 session 1
 * (architecture plan §4.9): the `keys.enabled` master gate, the key
 * definitions the signature renders from, and the `keys.keySignature`
 * subsection (the panel of the key-signature design §7, below).
 * `keys.offKeyMark` passes
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
 * Preserve-and-report: an unknown `placement.rule` string loaded from a
 * config file is kept in the editor state; the Module A validation
 * pass-through reports it. The editor never silently rewrites loaded values.
 *
 * Editor-level checks beyond Module A (labeled "Editor check" in the
 * validation panel): duplicate definition names — key selection and rule
 * matching are name-keyed, so a duplicated name makes later definitions
 * unreachable.
 *
 * Export (session 30, LY spec 1.3.7 §5.6): the engine engraves the
 * signature from the score's `\key`, and the exporter writes its on/off
 * state, an explicit tonic octave and the separator's styling, and since
 * session 49 the mark table for any other signature (§5.6a). The spacing
 * around the signature is the engine's (session 34), so nothing here is
 * preview-only, and a config's keySignature.gutter is not carried.
 *
 * The panel (session 50, key-signature design §7) speaks a designer's
 * words, and since session 56 it is the editor of design §13.8. Its head
 * has Show the key signature and Start from, which replaces the signature's
 * settings with the defaults (the noteheads) or the traditional signature
 * once confirmed (opts.confirm), keeping Show the key signature. Edit picks
 * the layer edited: all marks, naturals, flats, sharps, a line or ledger, a
 * space, or every second stack (design §13.4). The look card edits that
 * layer's look in every key: which symbol (its base, or Added 1 or Added 2,
 * up to two, each removable), the symbol (as beneath, the notation's and the
 * built-in shapes as CNBNoteheadPanel.thumbnail draws them, Emmentaler's
 * sharp and flat for a base, and the host's Import from SVG,
 * opts.importControl), the fill and colour (a base's), the size (a shape's
 * height and width, or the signs' one size, signs.heightSemis, automatic
 * or a number) and the offset in semitones, each field's "as …" clearing
 * it; a built-in shape the notation lacks is added, reported as
 * onChange({ keys, shapes }). Which layer and symbol are picked is editor
 * state, not config (opts.view, which the host may keep across re-mounts).
 * Then Notes (the whole scale, the tonic and the half steps, or the sharps
 * or flats only; the tonic an octave up), Stacks (the four stacking rules
 * and the cycle of fifths; the direction, hidden under odd-left-even-right,
 * and the gold stem with its colour, its thickness in staff spaces and
 * whether several stems share it, counted in the key picked on the staff,
 * opts.key; under the cycle of fifths its heights instead, in a window
 * raised in sharp and flat keys, or climbing), and Place (the middle of the
 * staff, the bottom, top or every line set). Session 56 removed the Draw,
 * Looks and Size rows and the overlap note, which the touch check replaces
 * (CNBKeySignature.touches). The key definitions follow, under "Keys for
 * notehead rules". The placement rule, the tonic octave and the gold stem's
 * extent have no controls: their stored values are kept as they are, and an
 * unknown rule is reported by validation rather than rewritten.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     enabled: boolean,                    // keys.enabled (master gate)
 *     definitions: [ { name, pitchClasses, tonicPc? } ],  // pass through
 *     offKeyMark: object,                  // untouched passthrough
 *     keySignature: {
 *       enabled: boolean,
 *       notes, upperTonic, looks, stacking, heights, window, alternate,
 *       columns,         // the designer's settings (session 48), edited
 *                        // in the panel since session 50; heights and
 *                        // window and the looks' new fields (session 54)
 *                        // carried through as they are
 *       placement: { rule: string, tonicOctave: number|null, position },
 *       separator: { enabled, color, thicknessPct, extentSemis, shareThickness },
 *       signs: { heightSemis: number|null }   // session 52; null = automatic
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
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBPreviewDisplay } from "./preview-display.js";
import { CNBNoteheadPanel } from "./notehead-panel.js";
import { CNBBuiltinShapes } from "./builtin-shapes.js";
import { CNBColor } from "../src/cnb-color.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBAccidentalGlyphs } from "../src/cnb-accidental-glyphs.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBScheme } from "../src/cnb-scheme.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// ─── Pure helpers ────────────────────────────────────────────────────────────

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/** The schema's keySignature, and the designer's settings at their defaults. */
const DEFAULT_KS = CNBConfig.createDefault().keys.keySignature;
const DESIGNER_FIELDS = ["notes", "upperTonic", "looks", "stacking", "heights", "window", "alternate", "columns"];
const DESIGNER_DEFAULTS = Object.fromEntries(DESIGNER_FIELDS.map(f => [f, DEFAULT_KS[f]]));

/** The traditional signature as a starting point (session 54, design
 *  §13.2): the sharps or flats only, Emmentaler's signs with no colour, the
 *  cycle of fifths in a window, over the defaults. */
const TRADITIONAL_START = {
  notes: "altered",
  stacking: "fifths",
  heights: "window",
  looks: { ...DEFAULT_KS.looks, flat: { sign: "flat", color: null }, sharp: { sign: "sharp", color: null } },
};

/** Start from (design §13.8): each starting point, its button and the
 *  question it asks before replacing the signature's settings. */
const START_FROM = [
  ["noteheads", "The noteheads",
    "Start from the noteheads? This replaces the key signature's settings (Undo puts them back)."],
  ["traditional", "Traditional sharps and flats",
    "Start from traditional sharps and flats? This replaces the key signature's settings (Undo puts them back)."],
];

/** The designer's settings (session 48) of a keySignature, copied as they
 *  are: the panel has no controls for them yet, and validation checks them. */
function designerSettings(ks) {
  return Object.fromEntries(DESIGNER_FIELDS.map(f => [f, deepClone(ks[f])]));
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidHex(v) {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Known vocabulary (Module A validate() accepts exactly these). */
const PLACEMENT_RULES = ["scale-from-tonic"];

/** The layers Edit picks (design §13.4, §13.8), in its words. */
const LAYERS = [
  ["all", "All marks"], ["natural", "Naturals"], ["flat", "Flats"], ["sharp", "Sharps"],
  ["line", "On a line or ledger"], ["space", "In a space"], ["alternate", "Every second stack"],
];

/** Each layer's name and what its edits reach, for the look card. */
const LAYER_WORDS = {
  all: { name: "All marks", scope: "all marks" },
  natural: { name: "Naturals", scope: "all naturals" },
  flat: { name: "Flats", scope: "all flats" },
  sharp: { name: "Sharps", scope: "all sharps" },
  line: { name: "On a line or ledger", scope: "all marks on a line or ledger" },
  space: { name: "In a space", scope: "all marks in a space" },
  alternate: { name: "Every second stack", scope: "the marks of every second stack" },
};

/** The layers a mark's spelling picks: a click on a mark follows them. */
const SPELLINGS = ["natural", "flat", "sharp"];

/** What an unset field of each look is: the look beneath. */
const AS_BENEATH = {
  all: "as the noteheads", natural: "as all marks", flat: "as all marks", sharp: "as all marks",
  line: "as beneath", space: "as beneath", alternate: "as the others",
};

/** A layer's look in a keySignature, created when missing (mutates ks). */
function lookIn(ks, layer) {
  if (layer === "alternate") {
    if (!isPlainObject(ks.alternate)) ks.alternate = {};
    return ks.alternate;
  }
  if (!isPlainObject(ks.looks)) ks.looks = {};
  if (!isPlainObject(ks.looks[layer])) ks.looks[layer] = {};
  return ks.looks[layer];
}

const round4 = (v) => Math.round(v * 1e4) / 1e4;

/** The canvas's magnification: px a semitone (axis unit), about twice the
 *  staff's Medium size (design §13.8). */
const CANVAS_PX_PER_SEMI = 24;

/** An imported symbol's enlarged drawing, for its reference point: px tall. */
const REFERENCE_PX = 120;

/** The other keys' small signatures: px a semitone, as the mock-ups draw them. */
const MINI_PX = 4;

/** Snap a dragged value to tenths of a semitone (design §13.8). */
function snap(v) {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? 0 : r;
}

/** The staff's magnification, engine.defaultMagnify (7/4 unless set). */
function magnification(config) {
  const r = CNBScheme.parseRatio((config.engine || {}).defaultMagnify ?? "7/4");
  return r && r.num > 0 ? r.num / (r.den ?? 1) : 7 / 4;
}

/**
 * Which marks of a key's signature each layer reaches (design §13.4): for
 * each layer, the indices into CNBKeySignature.marks(config, def).marks
 * whose look it is laid over. Found by marking the layer's look and reading
 * the mark back, so it follows the model's own rules.
 */
function layerMembers(config, def) {
  const out = {};
  for (const [layer] of LAYERS) {
    const probe = CNBConfig.clone(config);
    lookIn(probe.keys.keySignature, layer).__layer = true;
    const sig = CNBKeySignature.marks(probe, def);
    out[layer] = new Set();
    (sig ? sig.marks : []).forEach((m, i) => { if (m.mark.__layer) out[layer].add(i); });
  }
  return out;
}

/** A symbol's box in px about its mark's line and pitch, y down, from its
 *  path as the canvas draws it (CNBKeySignature.measure's layouts). */
function symbolBox(config, s) {
  if (s.kind === "sign") {
    const b = CNBNotehead.box({ svgPath: CNBAccidentalGlyphs.glyph(s.sign, magnification(config)).path });
    const k = s.size / CNBAccidentalGlyphs.UNITS_PER_STAFF_SPACE;
    return { x0: s.x + b.x[0] * k, x1: s.x + b.x[1] * k, y0: s.y + b.y[0] * k, y1: s.y + b.y[1] * k };
  }
  const b = CNBNotehead.box(config.shapes[s.shape]);
  return { x0: s.x + b.x[0] * s.scaleX, x1: s.x + b.x[1] * s.scaleX, y0: s.y + b.y[0] * s.scaleY, y1: s.y + b.y[1] * s.scaleY };
}

/** A small drawing of Emmentaler's sharp or flat, the look card's thumbnail. */
function signThumbnail(sign) {
  const glyph = CNBAccidentalGlyphs.glyph(sign, 7 / 4);
  const box = CNBNotehead.box({ svgPath: glyph.path });
  const k = 24 / (box.y[1] - box.y[0]);
  const w = Math.ceil((box.x[1] - box.x[0]) * k) + 4;
  const h = 28;
  const doc = globalThis.document;
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", glyph.path);
  path.setAttribute("fill", "#1c1c1e");
  path.setAttribute("transform", `translate(${2 - box.x[0] * k} ${2 - box.y[0] * k}) scale(${k})`);
  svg.appendChild(path);
  return svg;
}

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

  PLACEMENT_RULES,

  /** The canvas's px a semitone (design §13.8). */
  CANVAS_PX_PER_SEMI,

  /**
   * A dragged value snapped to tenths of a semitone (design §13.8). A value
   * loaded from a file is never snapped: only a drag's result is.
   * @param {number} v
   * @returns {number}
   */
  snap,

  /**
   * The layer a click on a mark selects (design §13.8): its spelling's
   * (naturals, flats or sharps), unless another layer is picked in Edit,
   * which then stays picked.
   * @param {Object<string, Set<number>>} members  each layer's marks (by index)
   * @param {number} index  the mark clicked
   * @param {{layer: string, pinned?: boolean}} view
   * @returns {string}
   */
  layerFor(members, index, view) {
    if (view.pinned) return view.layer;
    return SPELLINGS.find(layer => members[layer] && members[layer].has(index)) ?? view.layer;
  },

  /**
   * How the reference picker draws a shape enlarged (design §13.3): k px a
   * native SVG unit, its box REFERENCE_PX tall (at most twice that wide),
   * the box taking in its origin and its reference point (a tail's lie
   * outside its path), with 12 px around it; (ox, oy) where the shape's
   * origin falls.
   * @param {object} shape  a config.shapes entry
   * @returns {{k:number, ox:number, oy:number, width:number, height:number}}
   */
  referenceGeometry(shape) {
    const box = CNBNotehead.box(shape);
    const ref = shape.reference || { x: 0, y: 0 };
    for (const [x, y] of [[0, 0], [ref.x, ref.y]]) {
      box.x = [Math.min(box.x[0], x), Math.max(box.x[1], x)];
      box.y = [Math.min(box.y[0], y), Math.max(box.y[1], y)];
    }
    const w = box.x[1] - box.x[0], h = box.y[1] - box.y[0];
    const k = Math.min(REFERENCE_PX / h, 2 * REFERENCE_PX / w);
    const pad = 12;
    return { k, ox: pad - box.x[0] * k, oy: pad - box.y[0] * k, width: w * k + 2 * pad, height: h * k + 2 * pad };
  },

  /**
   * The reference point a click at (px, py) on the enlarged drawing gives,
   * in the shape's native SVG units, to 2 places.
   * @param {{k:number, ox:number, oy:number}} geometry  referenceGeometry's
   * @param {number} px
   * @param {number} py
   * @returns {{x:number, y:number}}
   */
  referenceAt(geometry, px, py) {
    const at = v => Math.round(v * 100) / 100 || 0;
    return { x: at((px - geometry.ox) / geometry.k), y: at((py - geometry.oy) / geometry.k) };
  },

  /**
   * A mode's 15 spellings in the order the other keys show them (design
   * §13.8): the sharp keys by their number of sharps, C first in major,
   * then the flat keys by their number of flats.
   * @param {string} mode  a CNBMusic.MODES name
   * @returns {string[]}
   */
  keyOrder(mode) {
    const count = (spelling, alteration) => {
      const spelled = CNBMusic.spell(spelling, CNBMusic.scale(CNBKeySignature.parseTonicPc(spelling), mode)) || [];
      return spelled.filter(n => n.alteration === alteration).length;
    };
    const flats = name => count(name, -1);
    const sharps = name => count(name, 1);
    return CNBMusic.spellings(mode).slice()
      .sort((a, b) => (flats(a) > 0) - (flats(b) > 0) || sharps(a) - sharps(b) || flats(a) - flats(b));
  },

  /**
   * The offset a drag of (dx, dy) px writes, from the offset it started at,
   * in semitones, y up, snapped (design §13.6, §13.8).
   * @param {{x:number, y:number}} start
   * @param {number} dx
   * @param {number} dy   px, down
   * @param {number} pxPerSemi
   * @returns {{x:number, y:number}}
   */
  dragOffset(start, dx, dy, pxPerSemi) {
    return { x: snap(start.x + dx / pxPerSemi), y: snap(start.y - dy / pxPerSemi) };
  },

  /**
   * The size a drag of the corner handle by dy px down writes, from the size
   * it started at: the height grows by dy, snapped and at least a tenth, and
   * the width keeps the proportions it started with.
   * @param {{heightSemis:number, widthSemis:number}} start
   * @param {number} dy
   * @param {number} pxPerSemi
   * @returns {{heightSemis:number, widthSemis:number}}
   */
  dragSize(start, dy, pxPerSemi) {
    const heightSemis = Math.max(0.1, snap(start.heightSemis + dy / pxPerSemi));
    return { heightSemis, widthSemis: round4(heightSemis * start.widthSemis / start.heightSemis) };
  },

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
    const height = isPlainObject(ks.signs) ? ks.signs.heightSemis ?? null : null;
    if (height !== null && (typeof height !== "number" || !Number.isFinite(height))) {
      throw new Error(`keySignature.signs.heightSemis must be a finite number or null for automatic (got ${JSON.stringify(height)})`);
    }
    return {
      enabled: !!state.enabled,
      definitions: deepClone(state.definitions),
      offKeyMark: isPlainObject(state.offKeyMark) ? deepClone(state.offKeyMark) : {},
      keySignature: {
        enabled: !!ks.enabled,
        ...designerSettings(ks),
        placement: {
          rule: placement.rule,
          tonicOctave: placement.tonicOctave,
          position: placement.position,
        },
        separator: {
          enabled: !!sep.enabled,
          color: sep.color,
          thicknessPct: sep.thicknessPct,
          extentSemis: sep.extentSemis,
          shareThickness: sep.shareThickness,
        },
        signs: { heightSemis: height },
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
        ...designerSettings({ ...DESIGNER_DEFAULTS, ...ks }),
        placement: {
          rule: typeof placement.rule === "string" ? placement.rule : "scale-from-tonic",
          tonicOctave: Number.isInteger(placement.tonicOctave) ? placement.tonicOctave : null,
          position: placement.position ?? DEFAULT_KS.placement.position,
        },
        separator: {
          enabled: sep.enabled !== false,   // schema default: true
          color: isValidHex(sep.color) ? sep.color : "#ffd42a",
          thicknessPct: finite(sep.thicknessPct, 0, 160),
          extentSemis: finite(sep.extentSemis, 0, 12, true),
          shareThickness: sep.shareThickness ?? DEFAULT_KS.separator.shareThickness,
        },
        // A stored number is kept as it is, for validation to judge.
        signs: { heightSemis: Number.isFinite(ks.signs?.heightSemis) ? ks.signs.heightSemis : null },
      },
    };
  },

  /**
   * Semitones (or pitch-axis units) per staff space for a config: the unit
   * the gold stem's thicknessPct is a percentage of, a hundredth each.
   * @param {object} config
   * @returns {number}
   */
  semisPerStaffSpace(config) {
    return CNBStaff.staffSpacePx(config, { pxPerSemi: 1, axis: CNBPitchAxis.create(config) });
  },

  /** A stored thicknessPct in staff spaces, to 4 places, at sps semitones
   *  (or axis units) per staff space. */
  thicknessInStaffSpaces(thicknessPct, sps) {
    return Math.round((thicknessPct / 100 / sps) * 1e4) / 1e4;
  },

  /** A thickness in staff spaces as the stored thicknessPct, to 4 places. */
  thicknessPct(staffSpaces, sps) {
    return Math.round(staffSpaces * sps * 100 * 1e4) / 1e4;
  },

  /**
   * A starting point (design §13.2, §13.8): the signature's defaults (the
   * noteheads) or the traditional signature over them, keeping enabled.
   * @param {object} ks     a keySignature
   * @param {"noteheads"|"traditional"} which
   * @returns {object} a new keySignature
   */
  startFrom(ks, which) {
    const start = deepClone(DEFAULT_KS);
    if (which === "traditional") Object.assign(start, deepClone(TRADITIONAL_START));
    start.enabled = !!(ks && ks.enabled);
    return start;
  },

  /**
   * A keySignature with one field of a layer's look set, or cleared when
   * value is undefined (design §13.4): the base's (symbol "base") or an
   * added symbol's (its index). A base's shape and sign are one slot
   * (§13.3): setting either removes the other, and clearing either clears
   * both. The input is not changed.
   * @param {object} ks
   * @param {string} layer   "all" | "natural" | "flat" | "sharp" | "line" | "space" | "alternate"
   * @param {"base"|number} symbol
   * @param {string} field
   * @param {*} value
   * @returns {object}
   */
  lookWith(ks, layer, symbol, field, value) {
    const out = deepClone(ks);
    const look = lookIn(out, layer);
    const target = symbol === "base" ? look : look.added[symbol];
    if (value === undefined) delete target[field];
    else target[field] = value;
    if (symbol === "base" && (field === "shape" || field === "sign")) {
      if (value === undefined) { delete target.shape; delete target.sign; }
      else delete target[field === "shape" ? "sign" : "shape"];
    }
    return out;
  },

  /**
   * A keySignature with a layer's added symbols replaced whole (design
   * §13.4), or cleared, "as …" beneath, when added is undefined; [] removes
   * those beneath. The input is not changed.
   * @param {object} ks
   * @param {string} layer
   * @param {object[]|undefined} added
   * @returns {object}
   */
  addedWith(ks, layer, added) {
    const out = deepClone(ks);
    const look = lookIn(out, layer);
    if (added === undefined) delete look.added;
    else look.added = deepClone(added);
    return out;
  },

  /**
   * A look in words, for its menu's summary: "as the noteheads" (all marks),
   * "as all marks" (flats, sharps) or "as the others" (every second stack)
   * when it sets nothing, else what it sets: the shape's name, the fill, the
   * colour's name (or no colour) and the size.
   * @param {object} look    { shape, hollow, color, heightSemis, widthSemis }
   * @param {string} kind    "all" | "flat" | "sharp" | "alternate"
   * @param {object} [shapes] the config's shapes, for the shape's name
   * @returns {string}
   */
  lookSummary(look, kind, shapes = {}) {
    const words = [];
    const l = look || {};
    if (l.shape !== undefined) {
      const shape = (shapes || {})[l.shape] || CNBBuiltinShapes.get(l.shape);
      words.push((shape && shape.displayName) || l.shape);
    }
    if (l.hollow !== undefined) words.push(l.hollow ? "hollow" : "solid");
    if (l.color !== undefined) words.push(l.color === null ? "no colour" : CNBColor.baseColorName(l.color));
    if (l.heightSemis !== undefined || l.widthSemis !== undefined) {
      words.push(l.widthSemis === undefined ? `${l.heightSemis} semitones tall`
        : l.heightSemis === undefined ? `${l.widthSemis} semitones wide`
        : `${l.heightSemis} × ${l.widthSemis} semitones`);
    }
    // An offset (session 56), in semitones.
    if (isPlainObject(l.offset)) words.push(`moved ${l.offset.x ?? 0}, ${l.offset.y ?? 0} semitones`);
    // Added symbols (session 55), each by its shape's name: the Clairnote
    // files' tails read "with Clairnote key-signature tail, down (sharp)".
    if (Array.isArray(l.added)) {
      const names = l.added.map(a => {
        const shape = (shapes || {})[a && a.shape] || CNBBuiltinShapes.get(a && a.shape);
        return (shape && shape.displayName) || (a && a.shape);
      });
      words.push(names.length === 0 ? "no added symbols" : `with ${names.join(" and ")}`);
    }
    return words.length === 0 ? AS_BENEATH[kind] : words.join(", ");
  },

  /**
   * What each gold stem gets, in words, for a key with `stems` stems
   * (null when no key is drawn) and the thickness shared or not.
   * @param {number|null} stems
   * @param {boolean} shared
   * @returns {string}
   */
  shareText(stems, shared) {
    if (stems === null) return shared ? "(each of n stems: 1/n of it)" : "(each stem: all of it)";
    if (stems === 0) return "(one stack in this key: no stem)";
    if (stems === 1) return "(1 stem in this key: all of it)";
    if (!shared) return `(${stems} stems in this key: all of it each)`;
    const part = { 2: "half", 3: "a third", 4: "a quarter" }[stems] || `1/${stems}`;
    return `(${stems} stems in this key: ${part} each)`;
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
   *   ├── div.cnb-kse-signature       (the head: show and Start from; Edit and
   *   │                                the look card; Notes; Stacks with the
   *   │                                gold stem or the heights; Place)
   *   ├── div.cnb-kse-definitions     (Keys for notehead rules: rows + add)
   *   └── div.cnb-kse-validation      (Module A pass-through + editor checks)
   *
   * While keys.enabled is false every control below the master toggle is
   * rendered with disabled = true (explicit disabled state, not hidden).
   *
   * @param {HTMLElement} container
   * @param {{config?: object, key?: {tonic:number, mode:string, spelling?:string}|null,
   *          view?: {layer?: string, symbol?: "base"|number, pinned?: boolean},
   *          confirm?: (question: string) => boolean,
   *          importControl?: (slot: HTMLElement, give: (name: string, shape?: object) => void) => void,
   *          onChange?: (slices: {keys: object, shapes?: object}, state: object) => void}} [opts]
   *        `key` is the key picked on the staff, for the stems' count.
   *        `view` is the editor's picked layer and symbol, kept by the host
   *        across re-mounts; `confirm` asks before Start from (the
   *        browser's confirm by default).
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

    // extra: other slices a change makes, { shapes } when a look takes a
    // built-in shape the notation lacks (session 50).
    const emit = (extra) => {
      onChange({ keys: CNBKeySignatureEditor.buildKeys(state), ...(extra || {}) }, deepClone(state));
    };

    const changed = (extra) => {
      redraw();
      emit(extra);
    };

    // Editor state only, not config: the layer picked in Edit, the symbol
    // selected (the base, or an added symbol's index) and whether the layer
    // stays picked when a mark is clicked (design §13.8). The host may keep
    // it across re-mounts (opts.view). And the size lock.
    const view = opts.view || {};
    if (!LAYER_WORDS[view.layer]) Object.assign(view, { layer: "all", symbol: "base", pinned: false });
    if (view.symbol !== "base" && !Number.isInteger(view.symbol)) view.symbol = "base";
    let lockLooks = true;
    const confirm = opts.confirm ||
      ((question) => (typeof globalThis.confirm === "function" ? globalThis.confirm(question) : true));

    /** Everything below the master toggle is disabled while keys.enabled
     *  is false (explicit disabled state — set-006 s3 lesson). */
    const gated = () => !state.enabled;

    const control = (e) => { e.disabled = gated(); return e; };

    const subtitle = (text) => el("div", "cnb-kse-subtitle", text);

    // ── keys.enabled master toggle (never disabled) ──────────────────────
    function drawKeysEnable() {
      const label = el("label", "cnb-kse-keys-enable");
      const cb = el("input", "cnb-kse-keys-enable-check");
      cb.type = "checkbox";
      cb.checked = !!state.enabled;
      cb.onchange = (e) => { state.enabled = checkedFrom(e, cb); changed(); };
      label.appendChild(cb);
      label.appendChild(el("span", "cnb-kse-keys-enable-text",
        "Use keys: name the keys this notation knows, for its key signature and for rules in a key"));
      return label;
    }

    function drawDisabledNote() {
      if (!gated()) return null;
      return el("div", "cnb-kse-disabled-note",
        "Keys are off. The settings below are kept, but nothing to do with " +
        "keys shows until keys are on.");
    }

    // ── Key definitions ──────────────────────────────────────────────────
    function drawDefinitions() {
      const wrap = el("div", "cnb-kse-section cnb-kse-definitions");
      wrap.appendChild(el("div", "cnb-kse-title", "Keys for notehead rules"));
      wrap.appendChild(el("div", "cnb-kse-hint",
        "A key named here can be given to a notehead rule; the signature needs none. " +
        "Each key has a name and its notes. Its tonic is the one you choose, " +
        "else the note its name starts with, else its first note."));

      if (state.definitions.length === 0) {
        wrap.appendChild(el("div", "cnb-kse-empty",
          "No keys yet: the staff draws the key picked there. Add one to give a notehead rule a key."));
      }

      state.definitions.forEach((def, index) => {
        const row = el("div", "cnb-kse-def-row");
        row.setAttribute("data-def-index", String(index));

        const name = el("input", "cnb-kse-def-name");
        name.type = "text";
        name.value = def.name;
        name.title = "The key's name, as the Key menu and the rules show it";
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
        tonic.title = "Tonic (auto: from the name, else the first note)";
        const auto = el("option", "", "Tonic: auto");
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
        const sourceText = { explicit: "explicit", name: "from name", fallback: "first note" }[info.source];
        row.appendChild(el("span", "cnb-kse-def-tonic-hint",
          `tonic ${pcName(info.pc)} (${sourceText})`));

        const remove = el("button", "cnb-kse-def-remove", "×");
        remove.type = "button";
        remove.title = "Remove this key";
        remove.onclick = () => { state.definitions.splice(index, 1); changed(); };
        row.appendChild(control(remove));

        wrap.appendChild(row);
      });

      const add = el("button", "cnb-kse-def-add", "+ Add a key");
      add.type = "button";
      add.onclick = () => { state.definitions.push(definitionTemplate()); changed(); };
      wrap.appendChild(control(add));
      return wrap;
    }

    // ── Key signature (design §7) ─────────────────────────────────────────
    /** The signature for the key picked on the staff, or null when none is
     *  drawn (keys or the signature off, or no key picked). */
    function pickedSignature() {
      if (!opts.key) return null;
      let config;
      try { config = CNBKeySignatureEditor.applyToConfig(baseConfig, state); } catch (_) { return null; }
      const { config: picked, name } = CNBPreviewDisplay.withKey(config, opts.key);
      const active = CNBKeySignature.activeKey(picked, name);
      return active ? CNBKeySignature.marks(picked, active.def) : null;
    }

    /** A row of radios writing one value: options are [value, label]. */
    function radios(className, current, options, write) {
      const group = el("div", "cnb-kse-radios " + className);
      for (const [value, label] of options) {
        const option = el("label", "cnb-kse-radio" + (value === current ? " on" : ""));
        option.setAttribute("data-value", value);
        const input = el("input", "cnb-kse-radio-input");
        input.type = "radio";
        input.name = className;
        input.value = value;
        input.checked = value === current;
        input.onchange = () => { write(value); changed(); };
        option.appendChild(control(input));
        option.appendChild(el("span", "", label));
        group.appendChild(option);
      }
      return group;
    }

    /** A checkbox writing a boolean. */
    function checkbox(className, checked, text, write) {
      const label = el("label", "cnb-kse-check " + className);
      const input = el("input", className + "-check");
      input.type = "checkbox";
      input.checked = !!checked;
      input.onchange = (e) => { write(checkedFrom(e, input)); changed(); };
      label.appendChild(control(input));
      label.appendChild(el("span", "", text));
      return label;
    }

    /** One row of the panel: its label, then its controls. */
    function row(className, label, ...children) {
      const wrap = el("div", "cnb-kse-row " + className);
      wrap.appendChild(el("div", "cnb-kse-row-label", label));
      const body = el("div", "cnb-kse-row-body");
      for (const child of children) if (child) body.appendChild(child);
      wrap.appendChild(body);
      return wrap;
    }

    function drawSignature() {
      const ks = state.keySignature;
      const wrap = el("div", "cnb-kse-section cnb-kse-signature");
      wrap.appendChild(drawHead(ks));

      // Which key draws (session 36): the one picked on the staff, whether
      // or not a key is defined here.
      if (state.enabled && ks.enabled) {
        wrap.appendChild(el("div", "cnb-kse-sig-status",
          "The signature draws for the key picked here, which is the staff's key too."));
      }

      wrap.appendChild(drawEditor(ks));
      wrap.appendChild(drawNotes(ks));
      wrap.appendChild(drawStacks(ks, pickedSignature()));
      wrap.appendChild(drawPlace(ks));
      return wrap;
    }

    // The head (design §13.8): Show the key signature, and Start from, which
    // replaces the signature's settings with the defaults or the traditional
    // signature once confirmed, keeping Show the key signature (session 56;
    // session 54's Draw row).
    function drawHead(ks) {
      const head = el("div", "cnb-kse-head");
      head.appendChild(el("div", "cnb-kse-title", "Key signature"));

      const enable = el("label", "cnb-kse-sig-enable");
      const cb = el("input", "cnb-kse-sig-enable-check");
      cb.type = "checkbox";
      cb.checked = !!ks.enabled;
      cb.onchange = (e) => { ks.enabled = checkedFrom(e, cb); changed(); };
      enable.appendChild(control(cb));
      enable.appendChild(el("span", "cnb-kse-sig-enable-text", "Show the key signature"));
      head.appendChild(enable);

      const start = el("div", "cnb-kse-start");
      start.appendChild(el("span", "cnb-kse-field-label", "Start from"));
      for (const [which, text, question] of START_FROM) {
        const b = el("button", "cnb-kse-start-button", text);
        b.type = "button";
        b.setAttribute("data-start", which);
        b.onclick = () => {
          if (!confirm(question)) return;
          state.keySignature = CNBKeySignatureEditor.startFrom(state.keySignature, which);
          pickLayer("all");
          changed();
        };
        start.appendChild(control(b));
      }
      head.appendChild(start);
      return head;
    }

    // The editor (design §13.8): Edit picks the layer, and the look card
    // edits it, every key at once.
    function drawEditor(ks) {
      const wrap = el("div", "cnb-kse-editor");
      const bar = el("div", "cnb-kse-bar");
      bar.appendChild(drawKeyPicker());
      bar.appendChild(drawLayers());
      wrap.appendChild(bar);
      const workspace = el("div", "cnb-kse-workspace");
      workspace.appendChild(drawStage());
      workspace.appendChild(drawLookCard(ks));
      wrap.appendChild(workspace);
      return wrap;
    }

    // ── The canvas (design §13.8): the picked key's signature, magnified ──
    const PX = CANVAS_PX_PER_SEMI;
    const SVG = (tag, attrs) => {
      const e = doc.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, String(v));
      return e;
    };
    let drag = null;   // while a pointer is down on a symbol or the handle
    let touchListOpen = false;   // the list of keys whose marks touch, open
    let model = null;  // what the canvas last drew

    /** The picked key's signature as the canvas draws it, or null. */
    function canvasModel() {
      if (!opts.key || !state.enabled || !state.keySignature.enabled) return null;
      let config;
      try { config = CNBKeySignatureEditor.applyToConfig(baseConfig, state); } catch (_) { return null; }
      const { config: picked, name } = CNBPreviewDisplay.withKey(config, opts.key);
      const active = CNBKeySignature.activeKey(picked, name);
      if (!active) return null;
      picked.display = { ...(picked.display || {}), pxPerSemi: PX };
      const m = CNBKeySignature.measure(picked, PX, name);
      if (!m) return null;
      // Each symbol's box and reference point about its mark's line and pitch.
      const symbols = m.marks.map((mk, i) => (m.layouts[i] || []).map((s, k) => {
        const base = mk.mark.offset || { x: 0, y: 0 };
        const own = k === 0 ? { x: 0, y: 0 } : ((mk.mark.added || [])[k - 1] || {}).offset || { x: 0, y: 0 };
        return { s, box: symbolBox(picked, s), point: { x: (base.x + own.x) * PX, y: -(base.y + own.y) * PX } };
      }));
      // The grid reaches every symbol, with a semitone to spare, so most
      // signatures fit the canvas's 360 px.
      let low = Infinity, high = -Infinity;
      m.marks.forEach((mk, i) => symbols[i].forEach(({ box }) => {
        low = Math.min(low, mk.semi - box.y1 / PX);
        high = Math.max(high, mk.semi - box.y0 / PX);
      }));
      const grid = CNBGrid.create(picked, { minSemi: Math.floor(low) - 1, maxSemi: Math.ceil(high) + 1 });
      const left = CNBKeySignature.padding(picked, PX, name).left + (m.extraLeftPx || 0);
      const lineX = (mk, i) => left + m.lead + mk.column * m.markWidth + (m.offsets ? m.offsets[i] : 0);
      return { config: picked, name, m, grid, symbols, lineX, width: 2 * left + m.contentWidth,
        members: layerMembers(picked, active.def) };
    }

    /** The symbol of a mark the selection edits, by its index (0 the base). */
    const selectedIndex = () => (view.symbol === "base" ? 0 : view.symbol + 1);

    /** The mark the selection is shown on: the one clicked, else the
     *  layer's first. */
    function focusOf(md) {
      const members = md.members[view.layer] || new Set();
      if (members.has(view.mark) && md.symbols[view.mark][selectedIndex()]) return view.mark;
      return [...members].find(i => md.symbols[i][selectedIndex()]) ?? null;
    }

    /** Draw the canvas into its box: the staff's lines, the signature, and
     *  the selection: every instance of the layer's selected symbol outlined,
     *  and on the focused one its box, reference point and corner handle. */
    function drawCanvas(box) {
      box.textContent = "";
      model = canvasModel();
      if (!model) {
        box.appendChild(el("div", "cnb-kse-canvas-empty",
          !state.enabled || !state.keySignature.enabled ? "Show the key signature to edit it here."
            : !opts.key ? "Pick a key on the staff to edit its signature here."
            : "This key's signature has no marks."));
        return;
      }
      const { config, m, grid, symbols } = model;
      const svg = SVG("svg", { width: Math.ceil(model.width), height: Math.ceil(grid.svgHeight),
        class: "cnb-kse-canvas-svg" });
      CNBStaff.render(svg, grid, config, model.width);
      CNBKeySignature.render(svg, grid, config, model.name, { marked: true });

      const overlay = SVG("g", { class: "cnb-kse-selection" });
      const sel = selectedIndex();
      const focus = focusOf(model);
      for (const i of model.members[view.layer] || []) {
        const sym = symbols[i][sel];
        if (!sym) continue;
        const x = model.lineX(m.marks[i], i), y = grid.semiToY(m.marks[i].semi);
        overlay.appendChild(SVG("rect", { class: "cnb-kse-instance" + (i === focus ? " focus" : ""),
          x: x + sym.box.x0, y: y + sym.box.y0, width: sym.box.x1 - sym.box.x0, height: sym.box.y1 - sym.box.y0 }));
        if (i !== focus) continue;
        const px = x + sym.point.x, py = y + sym.point.y;
        overlay.appendChild(SVG("path", { class: "cnb-kse-reference",
          d: `M ${px - 5} ${py} H ${px + 5} M ${px} ${py - 5} V ${py + 5}` }));
        const hx = x + sym.box.x1, hy = y + sym.box.y1;
        overlay.appendChild(SVG("rect", { class: "cnb-kse-handle", "data-handle": "1", x: hx - 4, y: hy - 4, width: 8, height: 8 }));
        if (drag && drag.moved) {
          const look = selectedLook();
          const h = sym.s.kind === "sign" ? CNBKeySignature.signHeight(config).semis
            : sym.s.heightSemis ?? config.shapes[sym.s.shape].semitoneHeight;
          const off = (sel === 0 ? m.marks[i].mark.offset : look && look.offset) || { x: 0, y: 0 };
          const readout = SVG("text", { class: "cnb-kse-readout", x: hx + 8, y: hy + 4 });
          readout.textContent = `h ${Number(h.toFixed(2))} · offset x ${off.x.toFixed(1)} y ${off.y.toFixed(1)}`;
          overlay.appendChild(readout);
        }
      }
      svg.appendChild(overlay);
      box.appendChild(svg);
    }

    /** The symbol or handle a pointer went down on, or null. */
    function hitOf(target, box) {
      for (let t = target; t && t !== box; t = t.parentNode) {
        if (!t.getAttribute) return null;
        if (t.getAttribute("data-handle")) return { handle: true };
        const mark = t.getAttribute("data-mark");
        if (mark !== null && mark !== undefined) return { mark: Number(mark), symbol: Number(t.getAttribute("data-symbol")) };
      }
      return null;
    }

    /** Select what a click hit (design §13.8): its layer by layerFor, and
     *  the added symbol clicked when that layer sets it, else the base. */
    function selectHit(hit) {
      const layer = CNBKeySignatureEditor.layerFor(model.members, hit.mark, view);
      const look = lookOf(state.keySignature, layer);
      view.layer = layer;
      view.symbol = hit.symbol > 0 && Array.isArray(look.added) && look.added[hit.symbol - 1] ? hit.symbol - 1 : "base";
      view.mark = hit.mark;
    }

    // ── The key picker and the other keys (design §13.8) ──────────────────
    /** The key picked on the staff, spelled; C major when none is. */
    function pickedKey() {
      const key = opts.key || CNBPreviewDisplay.DEFAULT_KEY;
      const spelling = key.spelling ?? CNBMusic.defaultSpelling(key.tonic, CNBMusic.scale(key.tonic, key.mode));
      return { tonic: key.tonic, mode: key.mode, spelling };
    }

    /** Pick a key: the host changes the staff's picker, and so this one. */
    const pickKey = (key) => { if (opts.onKey) opts.onKey(key); };

    function drawKeyPicker() {
      const key = pickedKey();
      const wrap = el("div", "cnb-kse-key");
      wrap.appendChild(el("span", "cnb-kse-field-label", "Key"));
      const tonic = el("select", "cnb-kse-key-tonic");
      tonic.setAttribute("aria-label", "Key");
      for (const name of CNBMusic.spellings(key.mode)) {
        const option = el("option", "", name);
        option.value = name;
        if (name === key.spelling) option.selected = true;
        tonic.appendChild(option);
      }
      tonic.value = key.spelling;
      tonic.onchange = (e) => {
        const spelling = valueFrom(e, tonic);
        pickKey({ tonic: CNBKeySignature.parseTonicPc(spelling), mode: key.mode, spelling });
      };
      wrap.appendChild(control(tonic));
      const mode = el("select", "cnb-kse-key-mode");
      mode.setAttribute("aria-label", "Mode");
      for (const name of Object.keys(CNBMusic.MODES)) {
        const option = el("option", "", name);
        option.value = name;
        if (name === key.mode) option.selected = true;
        mode.appendChild(option);
      }
      mode.value = key.mode;
      mode.onchange = (e) => {
        // As the staff's picker: the spelling stays where the new mode has
        // it, else the tonic takes the new mode's default.
        const next = valueFrom(e, mode);
        const spelling = CNBMusic.spellings(next).includes(key.spelling) ? key.spelling
          : CNBMusic.defaultSpelling(key.tonic, CNBMusic.scale(key.tonic, next));
        pickKey({ tonic: key.tonic, mode: next, spelling });
      };
      wrap.appendChild(control(mode));
      return wrap;
    }

    /** A key's name as the picker says it: "G major". */
    const keyName = (k) => `${k.spelling} ${k.mode}`;

    /** A small drawing of a key's signature, at MINI_PX a semitone. */
    function miniSignature(config, key) {
      const { config: picked, name } = CNBPreviewDisplay.withKey(config, key);
      picked.display = { ...(picked.display || {}), pxPerSemi: MINI_PX };
      const m = CNBKeySignature.measure(picked, MINI_PX, name);
      if (!m) return null;
      const grid = CNBGrid.create(picked, { minSemi: Math.min(...m.semis) - 3, maxSemi: Math.max(...m.semis) + 3 });
      const left = CNBKeySignature.padding(picked, MINI_PX, name).left + (m.extraLeftPx || 0);
      const width = 2 * left + m.contentWidth;
      // Shown from just before the marks to just after them, so the mode's
      // 15 keys fit a row.
      const shown = m.contentWidth + 8;
      const svg = SVG("svg", { width: Math.ceil(shown), height: Math.ceil(grid.svgHeight), class: "cnb-kse-mini-svg",
        viewBox: `${left - 4} 0 ${shown} ${grid.svgHeight}` });
      CNBStaff.render(svg, grid, picked, width);
      CNBKeySignature.render(svg, grid, picked, name);
      return svg;
    }

    /** Beneath the canvas: the picked mode's 15 keys, each a small
     *  signature, a key whose marks touch outlined with its count; and the
     *  line saying how many of the 105 keys have marks that touch, which
     *  opens their list. The touch check runs here, when the panel draws
     *  after a change, never while a drag moves. */
    function drawOtherKeys() {
      const wrap = el("div", "cnb-kse-keys");
      if (!state.enabled || !state.keySignature.enabled) return wrap;
      let config;
      try { config = CNBKeySignatureEditor.applyToConfig(baseConfig, state); } catch (_) { return wrap; }
      const touching = CNBKeySignature.touchingKeys(config);
      const counts = new Map(touching.map(k => [keyName(k), k.count]));
      const picked = pickedKey();

      wrap.appendChild(el("div", "cnb-kse-field-label cnb-kse-keys-title", `Other keys in ${picked.mode}`));
      const strip = el("div", "cnb-kse-key-strip");
      for (const spelling of CNBKeySignatureEditor.keyOrder(picked.mode)) {
        const key = { tonic: CNBKeySignature.parseTonicPc(spelling), mode: picked.mode, spelling };
        const count = counts.get(keyName(key)) || 0;
        const b = el("button", "cnb-kse-mini" + (spelling === picked.spelling ? " on" : "") + (count ? " touch" : ""));
        b.type = "button";
        b.setAttribute("data-key", spelling);
        b.title = keyName(key) + (count ? `: marks touch in ${count} ${count === 1 ? "place" : "places"}` : "");
        const svg = miniSignature(config, key);
        if (svg) b.appendChild(svg);
        b.appendChild(el("span", "cnb-kse-mini-name", spelling + (count ? ` · ${count} touch` : "")));
        b.onclick = () => pickKey(key);
        strip.appendChild(control(b));
      }
      wrap.appendChild(strip);

      if (touching.length === 0) {
        wrap.appendChild(el("div", "cnb-kse-touch-summary", "No marks touch in any of the 105 keys."));
        return wrap;
      }
      const list = el("details", "cnb-kse-touch-list");
      list.open = touchListOpen;
      list.ontoggle = () => { touchListOpen = list.open; };
      list.appendChild(el("summary", "cnb-kse-touch-summary",
        `Marks touch in ${touching.length} of the 105 ${touching.length === 1 ? "key" : "keys"}`));
      const keys = el("div", "cnb-kse-touch-keys");
      for (const k of touching) {
        const b = el("button", "cnb-kse-touch-key", `${keyName(k)} · ${k.count}`);
        b.type = "button";
        b.setAttribute("data-key", keyName(k));
        b.onclick = () => pickKey({ tonic: k.tonic, mode: k.mode, spelling: k.spelling });
        keys.appendChild(control(b));
      }
      list.appendChild(keys);
      wrap.appendChild(list);
      return wrap;
    }

    function drawStage() {
      const stage = el("div", "cnb-kse-stage");
      const box = el("div", "cnb-kse-canvas");
      box.onpointerdown = (e) => {
        const hit = model && hitOf(e.target, box);
        if (!hit) return;
        if (!hit.handle) selectHit(hit);
        const focus = focusOf(model);
        if (focus === null) return;
        const mk = model.m.marks[focus];
        const sym = model.symbols[focus][selectedIndex()];
        let start;
        if (!hit.handle) {
          start = (view.symbol === "base" ? mk.mark.offset : ((mk.mark.added || [])[view.symbol] || {}).offset) || { x: 0, y: 0 };
        } else if (sym.s.kind === "sign") {
          start = CNBKeySignature.signHeight(model.config).semis;
        } else {
          const shape = model.config.shapes[sym.s.shape];
          const own = shape.semitoneHeight;
          start = { heightSemis: sym.s.heightSemis ?? own,
            widthSemis: sym.s.widthSemis ?? shape.naturalWidth * own / shape.naturalHeight };
        }
        drag = { kind: hit.handle ? (sym.s.kind === "sign" ? "signs" : "size") : "move",
          x0: e.clientX, y0: e.clientY, start, moved: false };
        if (box.setPointerCapture && e.pointerId !== undefined) box.setPointerCapture(e.pointerId);
        drawCanvas(box);
      };
      box.onpointermove = (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        drag.moved = true;
        const E = CNBKeySignatureEditor;
        if (drag.kind === "move") {
          state.keySignature = E.lookWith(state.keySignature, view.layer, view.symbol, "offset",
            E.dragOffset(drag.start, dx, dy, PX));
        } else if (drag.kind === "signs") {
          state.keySignature = { ...state.keySignature, signs: { heightSemis: Math.max(0.1, snap(drag.start + dy / PX)) } };
        } else {
          const size = E.dragSize(drag.start, dy, PX);
          const sized = E.lookWith(state.keySignature, view.layer, view.symbol, "heightSemis", size.heightSemis);
          state.keySignature = E.lookWith(sized, view.layer, view.symbol, "widthSemis", size.widthSemis);
        }
        // Only the canvas redraws while the pointer moves; the change is
        // reported once, when it is released: one drag, one step of undo.
        drawCanvas(box);
      };
      box.onpointerup = box.onpointercancel = () => {
        if (!drag) return;
        const moved = drag.moved;
        drag = null;
        if (moved) changed();
        else redraw();
      };
      drawCanvas(box);
      stage.appendChild(box);
      stage.appendChild(el("div", "cnb-kse-hint",
        "Drag a mark to move its category, the corner handle to resize it; values snap to tenths of a semitone. A click picks another mark."));
      stage.appendChild(drawOtherKeys());
      return stage;
    }

    /** Pick a layer to edit: a spelling's (naturals, flats, sharps) follows
     *  a click on a mark, any other stays picked (design §13.8). */
    function pickLayer(layer) {
      view.layer = layer;
      view.symbol = "base";
      view.pinned = !SPELLINGS.includes(layer);
    }

    function drawLayers() {
      const bar = el("div", "cnb-kse-layers");
      bar.appendChild(el("span", "cnb-kse-field-label", "Edit"));
      for (const [layer, label] of LAYERS) {
        const b = el("button", "cnb-kse-layer" + (layer === view.layer ? " on" : ""), label);
        b.type = "button";
        b.setAttribute("data-layer", layer);
        b.onclick = () => { pickLayer(layer); redraw(); };
        bar.appendChild(control(b));
      }
      return bar;
    }

    function drawNotes(ks) {
      return row("cnb-kse-notes", "Notes",
        radios("cnb-kse-notes-choice", ks.notes, [
          ["all", "The whole scale"],
          ["tonic-and-half-steps", "The tonic and the half steps"],
          ["altered", "The sharps or flats only"],
        ], (v) => { ks.notes = v; }),
        // Each letter has one mark under the cycle of fifths (design §13.5).
        ks.stacking === "fifths" ? null
          : checkbox("cnb-kse-upper-tonic", ks.upperTonic !== false, "The tonic an octave up",
            (v) => { ks.upperTonic = v; }));
    }

    function drawStacks(ks, sig) {
      const stacking = radios("cnb-kse-stacking", ks.stacking, [
        ["degrees", "Stacked sevenths: 1 3 5 7 left, 2 4 6 8 right"],
        ["parity", "Odd semitones left, even right"],
        ["parity-stacks", "A new stack at each change of odd and even"],
        ["parity-zigzag", "Zigzag at each change of odd and even"],
        ["fifths", "Cycle of fifths, one to a column"],
      ], (v) => { ks.stacking = v; });

      // The cycle of fifths has its heights, and no direction or gold stem.
      if (ks.stacking === "fifths") return row("cnb-kse-stacks", "Stacks", stacking, drawHeights(ks));

      // Odd-left-even-right fixes each side, so the direction does not apply.
      let direction = null;
      if (ks.stacking !== "parity") {
        direction = el("div", "cnb-kse-direction");
        direction.appendChild(el("span", "cnb-kse-field-label", "Stacks go"));
        direction.appendChild(radios("cnb-kse-columns", ks.columns, [
          ["right", "to the right"],
          ["left-in-sharp-keys", "to the left in sharp keys"],
        ], (v) => { ks.columns = v; }));
      }
      return row("cnb-kse-stacks", "Stacks", stacking, direction, drawGoldStem(ks, sig));
    }

    // The cycle of fifths' heights (design §13.5): in a window around the
    // line set, raised in sharp and in flat keys, or climbing with the scale.
    function drawHeights(ks) {
      const wrap = el("div", "cnb-kse-heights");
      wrap.appendChild(radios("cnb-kse-heights-choice", ks.heights, [
        ["window", "Heights in a window around the line set"],
        ["scale", "Climbing with the scale"],
      ], (v) => { ks.heights = v; }));
      if (ks.heights === "scale") return wrap;
      const fields = el("div", "cnb-kse-fields cnb-kse-window");
      fields.appendChild(el("span", "cnb-kse-field-label", "Window raised"));
      for (const [family, label] of [["sharp", "sharps"], ["flat", "flats"]]) {
        fields.appendChild(el("span", "cnb-kse-field-unit", label));
        const input = el("input", "cnb-kse-window-" + family);
        input.type = "number";
        input.step = "1";
        input.value = String((ks.window || {})[family] ?? 0);
        input.title = `How far the window is raised in ${family} keys, in semitones (negative lowers it)`;
        input.onchange = (e) => {
          const v = numberFrom(e, input);
          if (v !== null) { ks.window = { sharp: 0, flat: 0, ...(ks.window || {}), [family]: v }; changed(); }
        };
        fields.appendChild(control(input));
      }
      fields.appendChild(el("span", "cnb-kse-field-unit", "semitones"));
      wrap.appendChild(fields);
      return wrap;
    }

    function drawGoldStem(ks, sig) {
      const sep = ks.separator;
      const wrap = el("div", "cnb-kse-separator");
      const line = el("div", "cnb-kse-fields");
      line.appendChild(checkbox("cnb-kse-sep-enable", sep.enabled, "Gold stem between the stacks",
        (v) => { sep.enabled = v; }));

      const color = el("input", "cnb-kse-sep-color");
      color.type = "color";
      color.value = sep.color;
      color.title = "The gold stem's colour";
      // A drag (`input`) changes only the field's own swatch; the colour
      // applies once, when the picker closes (`change`, session 36).
      color.onchange = (e) => {
        const v = String(valueFrom(e, color));
        if (isValidHex(v)) { sep.color = v; changed(); }
      };
      line.appendChild(el("span", "cnb-kse-field-unit", "colour"));
      line.appendChild(control(color));

      // Stored as a percentage of a semitone (or axis unit); shown in staff spaces.
      const sps = CNBKeySignatureEditor.semisPerStaffSpace(baseConfig);
      const thickness = el("input", "cnb-kse-sep-thickness");
      thickness.type = "number";
      thickness.min = "0";
      thickness.step = "0.05";
      thickness.value = String(CNBKeySignatureEditor.thicknessInStaffSpaces(sep.thicknessPct, sps));
      thickness.title = "The gold stem's thickness";
      thickness.onchange = (e) => {
        const v = numberFrom(e, thickness);
        if (v !== null && v >= 0) {
          sep.thicknessPct = CNBKeySignatureEditor.thicknessPct(v, sps);
          changed();
        }
      };
      line.appendChild(el("span", "cnb-kse-field-unit", "thickness"));
      line.appendChild(control(thickness));
      line.appendChild(el("span", "cnb-kse-field-unit", "staff spaces"));
      wrap.appendChild(line);

      if (sep.enabled) {
        const stems = sig ? Math.max(0, sig.columns.length - 1) : null;
        const share = checkbox("cnb-kse-sep-share", sep.shareThickness !== false,
          "Several stems share the thickness", (v) => { sep.shareThickness = v; });
        share.appendChild(el("span", "cnb-kse-share-text",
          " " + CNBKeySignatureEditor.shareText(stems, sep.shareThickness !== false)));
        wrap.appendChild(share);
      }
      return wrap;
    }

    // ── The look card (design §13.3, §13.8): the picked layer's look ──────
    /** The look a layer edits, created when missing. */
    const lookOf = (ks, layer) => lookIn(ks, layer);

    /** The selected symbol's look: the layer's own, or one of its added symbols. */
    function selectedLook() {
      const look = lookOf(state.keySignature, view.layer);
      return view.symbol === "base" ? look : look.added[view.symbol];
    }

    /** Set a field of the selected symbol, or clear it (undefined): "as …" beneath. */
    function writeLook(field, value, extra) {
      state.keySignature = CNBKeySignatureEditor.lookWith(state.keySignature, view.layer, view.symbol, field, value);
      // A new shape keeps the symbol's height, and with the aspect ratio kept
      // its width follows the shape's proportions, as in the notehead panel.
      const sym = selectedLook();
      if (field === "shape" && value !== undefined && lockLooks && sym.heightSemis !== undefined) {
        const shape = shapeOf(value);
        if (shape) sym.widthSemis = round4(sym.heightSemis * shape.naturalWidth / shape.naturalHeight);
      }
      changed(extra);
    }

    /** Set the layer's added symbols whole, or clear them (undefined). */
    function writeAdded(added, symbol = "base") {
      state.keySignature = CNBKeySignatureEditor.addedWith(state.keySignature, view.layer, added);
      view.symbol = symbol;
      changed();
    }

    /** A shape by name, from the config or else the built-in set. */
    const shapeOf = (name) => (baseConfig.shapes || {})[name] || CNBBuiltinShapes.get(name);

    /** The shape a base's size is measured on: its own, else the one beneath. */
    function sizedShape(ks, layer) {
      const look = lookOf(ks, layer);
      const name = look.shape ?? (layer !== "all" ? lookOf(ks, "all").shape : undefined) ??
        CNBConfig.resolveNotehead(baseConfig, 0, "crotchet", null).shape;
      return shapeOf(name);
    }

    // ── An imported symbol's reference point and ledgers (design §13.3) ───
    let importing = null;   // the shape just imported, its reference being set

    /** Set a field of one of the notation's shapes, or remove it
     *  (undefined), and report the shapes with the keys. */
    function writeShape(name, field, value) {
      const shape = { ...baseConfig.shapes[name] };
      if (value === undefined) delete shape[field];
      else shape[field] = value;
      baseConfig.shapes = { ...baseConfig.shapes, [name]: shape };
      changed({ shapes: deepClone(baseConfig.shapes) });
    }

    /** An imported symbol: added to the notation with its reference point
     *  at the SVG's origin (the toolkit's notehead centre) and, for flats or
     *  sharps, no ledger lines; given to the selected symbol; and its
     *  reference picker opened. */
    function adoptImport(name, shape) {
      if (!shape) { writeLook("shape", name); return; }
      const adopted = { ...shape, reference: { x: 0, y: 0 } };
      if (view.layer === "flat" || view.layer === "sharp") adopted.ledgers = false;
      baseConfig.shapes = { ...(baseConfig.shapes || {}), [name]: adopted };
      importing = name;
      writeLook("shape", name, { shapes: deepClone(baseConfig.shapes) });
    }

    /** The imported symbol enlarged, its reference point marked; a click
     *  moves the point. Then Takes ledger lines, and Done. */
    function drawReferencePicker(name) {
      const shape = baseConfig.shapes[name];
      const wrap = el("div", "cnb-kse-reference-picker");
      wrap.appendChild(el("div", "cnb-kse-hint",
        "Click the symbol at the point that sits on the mark's pitch, such as a dot's centre."));
      const g = CNBKeySignatureEditor.referenceGeometry(shape);
      const svg = SVG("svg", { width: Math.ceil(g.width), height: Math.ceil(g.height), class: "cnb-kse-reference-svg" });
      svg.appendChild(SVG("path", { d: shape.svgPath, fill: "#1c1c1e",
        transform: `translate(${g.ox} ${g.oy}) scale(${g.k})` }));
      const ref = shape.reference || { x: 0, y: 0 };
      const cx = g.ox + ref.x * g.k, cy = g.oy + ref.y * g.k;
      svg.appendChild(SVG("path", { class: "cnb-kse-reference",
        d: `M ${cx - 8} ${cy} H ${cx + 8} M ${cx} ${cy - 8} V ${cy + 8}` }));
      svg.onclick = (e) => {
        const rect = svg.getBoundingClientRect ? svg.getBoundingClientRect() : { left: 0, top: 0 };
        writeShape(name, "reference", CNBKeySignatureEditor.referenceAt(g, e.clientX - rect.left, e.clientY - rect.top));
      };
      wrap.appendChild(svg);
      const ledgers = el("label", "cnb-kse-check cnb-kse-takes-ledgers");
      const box = el("input", "cnb-kse-takes-ledgers-check");
      box.type = "checkbox";
      box.checked = shape.ledgers !== false;
      box.onchange = (e) => writeShape(name, "ledgers", checkedFrom(e, box) ? undefined : false);
      ledgers.appendChild(control(box));
      ledgers.appendChild(el("span", "", "Takes ledger lines"));
      wrap.appendChild(ledgers);
      const done = el("button", "cnb-kse-reference-done", "Done");
      done.type = "button";
      done.onclick = () => { importing = null; redraw(); };
      wrap.appendChild(control(done));
      return wrap;
    }

    function drawLookCard(ks) {
      const layer = view.layer;
      const look = lookOf(ks, layer);
      if (view.symbol !== "base" && !(Array.isArray(look.added) && look.added[view.symbol])) view.symbol = "base";
      const base = view.symbol === "base";
      const sym = selectedLook();
      const words = LAYER_WORDS[layer];

      const card = el("div", "cnb-kse-look-card");
      card.setAttribute("data-look", layer);
      card.appendChild(el("div", "cnb-kse-look-title", words.name));
      card.appendChild(el("div", "cnb-kse-look-scope", `Edits ${words.scope} in every key`));
      card.appendChild(el("div", "cnb-kse-look-words",
        CNBKeySignatureEditor.lookSummary(look, layer, baseConfig.shapes)));
      card.appendChild(drawSymbols(layer, look));
      card.appendChild(drawLookShape(layer, sym));
      if (importing && sym.shape === importing && (baseConfig.shapes || {})[importing]) {
        card.appendChild(drawReferencePicker(importing));
      }
      if (base && look.sign === undefined) card.appendChild(drawLookFill(layer, look));
      if (base) card.appendChild(drawLookColour(layer, look));
      if (base && look.sign !== undefined) card.appendChild(drawSignSize(ks));
      else if (layer !== "alternate" || !base) card.appendChild(drawLookSize(ks, layer, sym));
      card.appendChild(drawLookOffset(layer, sym));
      return card;
    }

    /** A segmented button: on when the look's field is that value. */
    function lookButton(className, text, on, onclick) {
      const b = el("button", className + (on ? " on" : ""), text);
      b.type = "button";
      b.onclick = onclick;
      return control(b);
    }

    function lookGroup(label) {
      const group = el("div", "cnb-kse-look-group");
      group.appendChild(el("span", "cnb-kse-look-group-label", label));
      return group;
    }

    // Which symbol is edited (design §13.8): the base, or an added one, each
    // removable; up to two added (§13.3), the layer's added field replaced whole.
    function drawSymbols(layer, look) {
      const group = lookGroup("Symbols");
      const added = Array.isArray(look.added) ? look.added : null;
      const select = (symbol, text) => {
        const b = lookButton("cnb-kse-look-select", text, view.symbol === symbol, () => { view.symbol = symbol; redraw(); });
        b.setAttribute("data-symbol", String(symbol));
        return b;
      };
      group.appendChild(select("base", "Base"));
      (added || []).forEach((_, i) => {
        group.appendChild(select(i, `Added ${i + 1}`));
        const remove = lookButton("cnb-kse-look-remove", "×", false,
          () => writeAdded(added.filter((__, j) => j !== i)));
        remove.setAttribute("data-symbol", String(i));
        remove.title = `Remove added symbol ${i + 1}`;
        group.appendChild(remove);
      });
      if (!added || added.length < 2) {
        const list = added || [];
        group.appendChild(lookButton("cnb-kse-look-add", "+ Add a symbol", false, () =>
          writeAdded([...list, { shape: CNBConfig.resolveNotehead(baseConfig, 0, "crotchet", null).shape }], list.length)));
      }
      if (added) {
        group.appendChild(lookButton("cnb-kse-look-added-as", `Added symbols ${AS_BENEATH[layer]}`, false,
          () => writeAdded(undefined)));
      }
      return group;
    }

    // The symbol (design §13.3): a notehead shape, imported or built in, or,
    // for a base, Emmentaler's sharp or flat; one slot.
    function drawLookShape(layer, sym) {
      const base = view.symbol === "base";
      const group = lookGroup("Symbol");
      if (base) {
        const asBeneath = lookButton("cnb-kse-look-shape cnb-kse-look-as", AS_BENEATH[layer],
          sym.shape === undefined && sym.sign === undefined, () => writeLook("shape", undefined));
        asBeneath.setAttribute("data-shape", "");
        group.appendChild(asBeneath);
      }
      const names = Object.keys(baseConfig.shapes || {});
      for (const name of CNBBuiltinShapes.NAMES) if (!names.includes(name)) names.push(name);
      for (const name of names) {
        const shape = shapeOf(name);
        const b = lookButton("cnb-kse-look-shape", "", sym.shape === name, () => {
          // A built-in shape the notation lacks is added to it (session 50).
          const added = !(name in (baseConfig.shapes || {}));
          if (added) baseConfig.shapes = CNBBuiltinShapes.withShape(baseConfig, name).shapes;
          writeLook("shape", name, added ? { shapes: deepClone(baseConfig.shapes) } : undefined);
        });
        b.setAttribute("data-shape", name);
        b.title = shape.displayName || name;
        b.appendChild(CNBNoteheadPanel.thumbnail(shape));
        group.appendChild(b);
      }
      if (base) {
        for (const [sign, title] of [["sharp", "Sharp"], ["flat", "Flat"]]) {
          const b = lookButton("cnb-kse-look-shape cnb-kse-look-sign", "", sym.sign === sign, () => writeLook("sign", sign));
          b.setAttribute("data-sign", sign);
          b.title = `${title} (Emmentaler's)`;
          b.appendChild(signThumbnail(sign));
          group.appendChild(b);
        }
      }
      if (opts.importControl) {
        const slot = el("div", "cnb-kse-look-import");
        // The host hands the imported shape here; the panel adds it to the
        // notation, with its reference point and ledgers (session 56).
        opts.importControl(slot, adoptImport);
        group.appendChild(slot);
      }
      return group;
    }

    function drawLookFill(layer, look) {
      const group = lookGroup("Fill");
      for (const [value, text] of [[undefined, AS_BENEATH[layer]], [false, "Solid"], [true, "Hollow"]]) {
        const b = lookButton("cnb-kse-look-fill", text, look.hollow === value,
          () => writeLook("hollow", value));
        b.setAttribute("data-fill", value === undefined ? "" : value ? "hollow" : "solid");
        group.appendChild(b);
      }
      return group;
    }

    function drawLookColour(layer, look) {
      const group = lookGroup("Colour");
      const asBeneath = lookButton("cnb-kse-look-colour", AS_BENEATH[layer], look.color === undefined,
        () => writeLook("color", undefined));
      asBeneath.setAttribute("data-color", "");
      group.appendChild(asBeneath);
      const none = lookButton("cnb-kse-look-colour", "None", look.color === null,
        () => writeLook("color", null));
      none.setAttribute("data-color", "none");
      group.appendChild(none);
      const input = el("input", "cnb-kse-look-colour-input");
      input.type = "color";
      input.value = typeof look.color === "string" ? look.color : "#000000";
      input.title = "A colour";
      // The colour applies once, when the picker closes (session 36).
      input.onchange = (e) => {
        const v = String(valueFrom(e, input)).toLowerCase();
        if (isValidHex(v)) writeLook("color", v);
      };
      group.appendChild(control(input));
      return group;
    }

    /** A number field writing a value through onValue when it is accepted. */
    function numberField(className, label, value, unit, step, onValue, accept = v => v > 0) {
      const wrap = el("label", "cnb-kse-look-field");
      if (label) wrap.appendChild(el("span", "", label));
      const input = el("input", className);
      input.type = "number";
      input.step = step;
      input.value = value === undefined ? "" : String(value);
      input.placeholder = "—";
      input.onchange = (e) => {
        const v = numberFrom(e, input);
        if (v !== null && accept(v)) onValue(v);
      };
      wrap.appendChild(control(input));
      if (unit) wrap.appendChild(el("span", "cnb-kse-field-unit", unit));
      return wrap;
    }

    function drawLookSize(ks, layer, sym) {
      const group = lookGroup("Size");
      const base = view.symbol === "base";
      group.appendChild(lookButton("cnb-kse-look-size-as", base ? AS_BENEATH[layer] : "its shape's own",
        sym.heightSemis === undefined && sym.widthSemis === undefined, () => {
          const cleared = CNBKeySignatureEditor.lookWith(state.keySignature, layer, view.symbol, "heightSemis", undefined);
          state.keySignature = CNBKeySignatureEditor.lookWith(cleared, layer, view.symbol, "widthSemis", undefined);
          changed();
        }));
      const shape = base ? sizedShape(ks, layer) : shapeOf(sym.shape);
      const ratio = shape ? shape.naturalWidth / shape.naturalHeight : 1;
      const setSize = (h, w) => {
        const sized = CNBKeySignatureEditor.lookWith(state.keySignature, layer, view.symbol, "heightSemis", round4(h));
        state.keySignature = CNBKeySignatureEditor.lookWith(sized, layer, view.symbol, "widthSemis", round4(w));
        changed();
      };
      group.appendChild(numberField("cnb-kse-look-height", "Height", sym.heightSemis, "semitones", "0.05",
        (h) => setSize(h, lockLooks || sym.widthSemis === undefined ? h * ratio : sym.widthSemis)));
      group.appendChild(numberField("cnb-kse-look-width", "Width", sym.widthSemis, "semitones", "0.05",
        (w) => setSize(lockLooks || sym.heightSemis === undefined ? w / ratio : sym.heightSemis, w)));
      const lock = el("label", "cnb-kse-check cnb-kse-look-lock");
      const box = el("input", "cnb-kse-look-lock-check");
      box.type = "checkbox";
      box.checked = lockLooks;
      box.onchange = (e) => { lockLooks = checkedFrom(e, box); };
      lock.appendChild(control(box));
      lock.appendChild(el("span", "", "Keep aspect ratio"));
      group.appendChild(lock);
      return group;
    }

    // ── The signs' size (session 52): one size for the sharps and flats ───
    /** The size the automatic rule gives the config as edited. */
    function automaticHeight() {
      let config;
      try { config = CNBKeySignatureEditor.applyToConfig(baseConfig, state); } catch (_) { config = CNBConfig.clone(baseConfig); }
      config.keys.keySignature.signs = { heightSemis: null };
      return CNBKeySignature.signHeight(config).semis;
    }

    function drawSignSize(ks) {
      if (!isPlainObject(ks.signs)) ks.signs = { heightSemis: null };
      const signs = ks.signs;
      const shown = Number(automaticHeight().toFixed(2));
      const group = lookGroup("Size");
      group.appendChild(lookButton("cnb-kse-sign-size-auto", `Automatic (${shown})`, signs.heightSemis === null,
        () => { signs.heightSemis = null; changed(); }));
      group.appendChild(numberField("cnb-kse-sign-size", "", signs.heightSemis ?? shown,
        "semitones between a sharp's bars", "0.25", (v) => { signs.heightSemis = v; changed(); }));
      group.appendChild(el("div", "cnb-kse-hint", "The sharps and flats share one size."));
      return group;
    }

    // The offset (design §13.6), in semitones: the base's from the mark's
    // pitch on its stack, an added symbol's from the base's point.
    function drawLookOffset(layer, sym) {
      const group = lookGroup("Offset");
      const base = view.symbol === "base";
      group.appendChild(lookButton("cnb-kse-look-offset-as", base ? AS_BENEATH[layer] : "none",
        sym.offset === undefined, () => writeLook("offset", undefined)));
      const offset = sym.offset || { x: 0, y: 0 };
      for (const axisName of ["x", "y"]) {
        group.appendChild(numberField("cnb-kse-look-offset-" + axisName, axisName, offset[axisName], null, "0.1",
          (v) => writeLook("offset", { ...offset, [axisName]: v }), () => true));
      }
      group.appendChild(el("span", "cnb-kse-field-unit", "semitones"));
      return group;
    }

    function drawPlace(ks) {
      // The tonic and the half steps are a choice of the key's notes alone.
      const hint = "A line set is a run of staff lines one staff space apart. On every line set the " +
        (ks.notes === "altered" ? "signature repeats."
          : "signature repeats; the tonic and the half steps alone keep it less busy.");
      return row("cnb-kse-place", "Place",
        radios("cnb-kse-position", ks.placement.position, [
          ["middle", "In the middle of the staff"],
          ["bottom-set", "On the bottom line set"],
          ["top-set", "On the top line set"],
          ["every-set", "On every line set"],
        ], (v) => { ks.placement.position = v; }),
        el("div", "cnb-kse-hint", hint));
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
      root.appendChild(drawSignature());
      root.appendChild(drawDefinitions());
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
