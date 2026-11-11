/**
 * key-signature-editor.js — Key Signature Editor (set 010, session 2)
 *
 * Edits the `config.keys` section activated in set 010 session 1
 * (architecture plan §4.9): the `keys.enabled` master gate, the key
 * definitions the signature renders from, and the `keys.keySignature`
 * subsection (enable toggle, mark-style selection, placement-rule
 * controls, separator/dot styling). `keys.offKeyMark` passes
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
 * Export (session 30, LY spec 1.3.7 §5.6): the engine engraves the
 * signature from the score's `\key`, and the exporter writes its on/off
 * state, an explicit tonic octave and the separator's styling, and since
 * session 49 the mark table for any other signature (§5.6a). The spacing
 * around the signature is the engine's (session 34), so nothing here is
 * preview-only, and a config's keySignature.gutter is not carried.
 *
 * The panel (session 50, key-signature design §7) speaks a designer's
 * words: Show the key signature; Notes (the whole scale, or the tonic and
 * the half steps; the tonic an octave up); Stacks (the four stacking rules,
 * the direction, hidden under odd-left-even-right, and the gold stem with
 * its colour, its thickness in staff spaces and whether several stems share
 * it); Looks (all marks, flats, sharps and every second stack: each a menu
 * saying its look in words and opening the notehead panel's controls,
 * shape with its thumbnails and the host's Import from SVG (opts.importControl),
 * fill, colour and, but for every second stack, size, each field with an
 * "as …" choice that clears it; a built-in shape the notation lacks is
 * added, reported as onChange({ keys, shapes })); Place (the middle of the
 * staff, the bottom, top or every line set);
 * and a note when two marks of one stack run together in the key picked on
 * the staff (opts.key, which also counts the stems). The key definitions
 * follow, under "Keys for notehead rules". `style`, the placement rule, the
 * tonic octave and the gold stem's extent have no controls: their stored
 * values are kept as they are, and an unknown style or rule is reported by
 * validation rather than rewritten.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     enabled: boolean,                    // keys.enabled (master gate)
 *     definitions: [ { name, pitchClasses, tonicPc? } ],  // pass through
 *     offKeyMark: object,                  // untouched passthrough
 *     keySignature: {
 *       enabled: boolean,
 *       style: string,   // "notehead-chords" (single-value vocabulary)
 *       notes, upperTonic, looks, stacking, alternate, columns,
 *                        // the designer's settings (session 48), edited
 *                        // in the panel since session 50
 *       placement: { rule: string, tonicOctave: number|null, position },
 *       separator: { enabled, color, thicknessPct, extentSemis, shareThickness }
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

// ─── Pure helpers ────────────────────────────────────────────────────────────

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/** The schema's keySignature, and the designer's settings at their defaults. */
const DEFAULT_KS = CNBConfig.createDefault().keys.keySignature;
const DESIGNER_FIELDS = ["notes", "upperTonic", "looks", "stacking", "alternate", "columns"];
const DESIGNER_DEFAULTS = Object.fromEntries(DESIGNER_FIELDS.map(f => [f, DEFAULT_KS[f]]));

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
const STYLES = ["notehead-chords"];
const PLACEMENT_RULES = ["scale-from-tonic"];

/** The looks the panel edits (design §4.1, §7), in its words. */
const LOOK_KINDS = [["all", "All marks"], ["flat", "Flats"], ["sharp", "Sharps"], ["alternate", "Every second stack"]];

/** What an unset field of each look is: the look beneath. */
const AS_BENEATH = { all: "as the noteheads", flat: "as all marks", sharp: "as all marks", alternate: "as the others" };

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
    return {
      enabled: !!state.enabled,
      definitions: deepClone(state.definitions),
      offKeyMark: isPlainObject(state.offKeyMark) ? deepClone(state.offKeyMark) : {},
      keySignature: {
        enabled: !!ks.enabled,
        style: ks.style,
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
        style: typeof ks.style === "string" ? ks.style : "notehead-chords",
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
   *   ├── div.cnb-kse-signature       (show, Notes, Stacks with the gold
   *   │                                stem and the overlap note, Place)
   *   ├── div.cnb-kse-definitions     (Keys for notehead rules: rows + add)
   *   └── div.cnb-kse-validation      (Module A pass-through + editor checks)
   *
   * While keys.enabled is false every control below the master toggle is
   * rendered with disabled = true (explicit disabled state, not hidden).
   *
   * @param {HTMLElement} container
   * @param {{config?: object, key?: {tonic:number, mode:string, spelling?:string}|null,
   *          onChange?: (slices: {keys: object}, state: object) => void}} [opts]
   *        `key` is the key picked on the staff, for the stems' count and
   *        the overlap note (neither without it).
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

    // Editor state only: which look menus are open, and the size lock.
    const openLooks = new Set();
    let lockLooks = true;

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
      wrap.appendChild(el("div", "cnb-kse-title", "Key signature"));

      const enable = el("label", "cnb-kse-sig-enable");
      const cb = el("input", "cnb-kse-sig-enable-check");
      cb.type = "checkbox";
      cb.checked = !!ks.enabled;
      cb.onchange = (e) => { ks.enabled = checkedFrom(e, cb); changed(); };
      enable.appendChild(control(cb));
      enable.appendChild(el("span", "cnb-kse-sig-enable-text", "Show the key signature"));
      wrap.appendChild(enable);

      // Which key draws (session 36): the one picked on the staff, whether
      // or not a key is defined here.
      if (state.enabled && ks.enabled) {
        wrap.appendChild(el("div", "cnb-kse-sig-status",
          "The signature draws for the key and mode picked on the staff."));
      }

      const sig = pickedSignature();
      wrap.appendChild(drawNotes(ks));
      wrap.appendChild(drawStacks(ks, sig));
      wrap.appendChild(drawLooks(ks));
      wrap.appendChild(drawPlace(ks));
      return wrap;
    }

    function drawNotes(ks) {
      return row("cnb-kse-notes", "Notes",
        radios("cnb-kse-notes-choice", ks.notes, [
          ["all", "The whole scale"],
          ["tonic-and-half-steps", "The tonic and the half steps"],
        ], (v) => { ks.notes = v; }),
        checkbox("cnb-kse-upper-tonic", ks.upperTonic !== false, "The tonic an octave up",
          (v) => { ks.upperTonic = v; }));
    }

    function drawStacks(ks, sig) {
      const stacking = radios("cnb-kse-stacking", ks.stacking, [
        ["degrees", "Stacked sevenths: 1 3 5 7 left, 2 4 6 8 right"],
        ["parity", "Odd semitones left, even right"],
        ["parity-stacks", "A new stack at each change of odd and even"],
        ["parity-zigzag", "Zigzag at each change of odd and even"],
      ], (v) => { ks.stacking = v; });

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

      const overlap = sig && sig.overlaps.length > 0
        ? el("div", "cnb-kse-overlap-note",
          "In this key some marks in one stack run together. A smaller height under Looks keeps them apart.")
        : null;
      return row("cnb-kse-stacks", "Stacks", stacking, direction, drawGoldStem(ks, sig), overlap);
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

    // ── Looks (design §4.1, §7): the notehead panel's own controls ────────
    /** The look a kind edits, created when missing. */
    function lookOf(ks, kind) {
      if (kind === "alternate") {
        if (!isPlainObject(ks.alternate)) ks.alternate = {};
        return ks.alternate;
      }
      if (!isPlainObject(ks.looks)) ks.looks = {};
      if (!isPlainObject(ks.looks[kind])) ks.looks[kind] = {};
      return ks.looks[kind];
    }

    /** Set a look's field, or clear it (undefined): "as …" beneath. */
    function setLookField(kind, field, value, extra) {
      const look = lookOf(state.keySignature, kind);
      if (value === undefined) delete look[field];
      else look[field] = value;
      // A new shape keeps the look's height, and with the aspect ratio kept
      // its width follows the shape's proportions, as in the notehead panel.
      if (field === "shape" && lockLooks && look.heightSemis !== undefined) {
        const shape = sizedShape(state.keySignature, kind);
        if (shape) look.widthSemis = Math.round(look.heightSemis * shape.naturalWidth / shape.naturalHeight * 1e4) / 1e4;
      }
      changed(extra);
    }

    /** A shape by name, from the config or else the built-in set. */
    const shapeOf = (name) => (baseConfig.shapes || {})[name] || CNBBuiltinShapes.get(name);

    /** The shape a look's size is measured on: its own, else the one beneath. */
    function sizedShape(ks, kind) {
      const look = lookOf(ks, kind);
      const name = look.shape ?? (kind !== "all" ? lookOf(ks, "all").shape : undefined) ??
        CNBConfig.resolveNotehead(baseConfig, 0, "crotchet", null).shape;
      return shapeOf(name);
    }

    function drawLooks(ks) {
      const wrap = el("div", "cnb-kse-looks");
      for (const [kind, label] of LOOK_KINDS) {
        const look = lookOf(ks, kind);
        const menu = el("details", "cnb-kse-look");
        menu.setAttribute("data-look", kind);
        menu.open = openLooks.has(kind);
        menu.ontoggle = () => { if (menu.open) openLooks.add(kind); else openLooks.delete(kind); };
        const summary = el("summary", "cnb-kse-look-summary");
        summary.appendChild(el("span", "cnb-kse-look-label", label));
        summary.appendChild(el("span", "cnb-kse-look-words",
          CNBKeySignatureEditor.lookSummary(look, kind, baseConfig.shapes)));
        menu.appendChild(summary);
        const body = el("div", "cnb-kse-look-body");
        body.appendChild(drawLookShape(kind, look));
        body.appendChild(drawLookFill(kind, look));
        body.appendChild(drawLookColour(kind, look));
        if (kind !== "alternate") body.appendChild(drawLookSize(ks, kind, look));
        menu.appendChild(body);
        wrap.appendChild(menu);
      }
      return row("cnb-kse-looks-row", "Looks", wrap);
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

    function drawLookShape(kind, look) {
      const group = lookGroup("Shape");
      const asBeneath = lookButton("cnb-kse-look-shape cnb-kse-look-as", AS_BENEATH[kind], look.shape === undefined,
        () => setLookField(kind, "shape", undefined));
      asBeneath.setAttribute("data-shape", "");
      group.appendChild(asBeneath);
      const names = Object.keys(baseConfig.shapes || {});
      for (const name of CNBBuiltinShapes.NAMES) if (!names.includes(name)) names.push(name);
      for (const name of names) {
        const shape = shapeOf(name);
        const b = lookButton("cnb-kse-look-shape", "", look.shape === name, () => {
          // A built-in shape the notation lacks is added to it (session 50).
          const added = !(name in (baseConfig.shapes || {}));
          if (added) baseConfig.shapes = CNBBuiltinShapes.withShape(baseConfig, name).shapes;
          setLookField(kind, "shape", name, added ? { shapes: deepClone(baseConfig.shapes) } : undefined);
        });
        b.setAttribute("data-shape", name);
        b.title = shape.displayName || name;
        b.appendChild(CNBNoteheadPanel.thumbnail(shape));
        group.appendChild(b);
      }
      if (opts.importControl) {
        const slot = el("div", "cnb-kse-look-import");
        // The host adds the imported shape to the notation and hands it
        // here too, so the look's width can follow its proportions.
        opts.importControl(slot, (name, shape) => {
          if (shape) baseConfig.shapes = { ...(baseConfig.shapes || {}), [name]: shape };
          setLookField(kind, "shape", name);
        });
        group.appendChild(slot);
      }
      return group;
    }

    function drawLookFill(kind, look) {
      const group = lookGroup("Fill");
      for (const [value, text] of [[undefined, AS_BENEATH[kind]], [false, "Solid"], [true, "Hollow"]]) {
        const b = lookButton("cnb-kse-look-fill", text, look.hollow === value,
          () => setLookField(kind, "hollow", value));
        b.setAttribute("data-fill", value === undefined ? "" : value ? "hollow" : "solid");
        group.appendChild(b);
      }
      return group;
    }

    function drawLookColour(kind, look) {
      const group = lookGroup("Colour");
      const asBeneath = lookButton("cnb-kse-look-colour", AS_BENEATH[kind], look.color === undefined,
        () => setLookField(kind, "color", undefined));
      asBeneath.setAttribute("data-color", "");
      group.appendChild(asBeneath);
      const none = lookButton("cnb-kse-look-colour", "None", look.color === null,
        () => setLookField(kind, "color", null));
      none.setAttribute("data-color", "none");
      group.appendChild(none);
      const input = el("input", "cnb-kse-look-colour-input");
      input.type = "color";
      input.value = typeof look.color === "string" ? look.color : "#000000";
      input.title = "A colour";
      // The colour applies once, when the picker closes (session 36).
      input.onchange = (e) => {
        const v = String(valueFrom(e, input)).toLowerCase();
        if (isValidHex(v)) setLookField(kind, "color", v);
      };
      group.appendChild(control(input));
      return group;
    }

    function drawLookSize(ks, kind, look) {
      const group = lookGroup("Size");
      const asBeneath = lookButton("cnb-kse-look-size-as", AS_BENEATH[kind],
        look.heightSemis === undefined && look.widthSemis === undefined, () => {
          const target = lookOf(state.keySignature, kind);
          delete target.heightSemis;
          delete target.widthSemis;
          changed();
        });
      group.appendChild(asBeneath);
      const shape = sizedShape(ks, kind);
      const ratio = shape ? shape.naturalWidth / shape.naturalHeight : 1;
      const round4 = (v) => Math.round(v * 1e4) / 1e4;
      const setSize = (h, w) => {
        const target = lookOf(state.keySignature, kind);
        target.heightSemis = round4(h);
        target.widthSemis = round4(w);
        changed();
      };
      const field = (className, label, value, onValue) => {
        const wrap = el("label", "cnb-kse-look-field");
        wrap.appendChild(el("span", "", label));
        const input = el("input", className);
        input.type = "number";
        input.min = "0.25";
        input.max = "4";
        input.step = "0.05";
        input.value = value === undefined ? "" : String(value);
        input.placeholder = "—";
        input.onchange = (e) => {
          const v = numberFrom(e, input);
          if (v !== null && v > 0) onValue(v);
        };
        wrap.appendChild(control(input));
        wrap.appendChild(el("span", "cnb-kse-field-unit", "semitones"));
        return wrap;
      };
      group.appendChild(field("cnb-kse-look-height", "Height", look.heightSemis,
        (h) => setSize(h, lockLooks || look.widthSemis === undefined ? h * ratio : look.widthSemis)));
      group.appendChild(field("cnb-kse-look-width", "Width", look.widthSemis,
        (w) => setSize(lockLooks || look.heightSemis === undefined ? w / ratio : look.heightSemis, w)));
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

    function drawPlace(ks) {
      return row("cnb-kse-place", "Place",
        radios("cnb-kse-position", ks.placement.position, [
          ["middle", "In the middle of the staff"],
          ["bottom-set", "On the bottom line set"],
          ["top-set", "On the top line set"],
          ["every-set", "On every line set"],
        ], (v) => { ks.placement.position = v; }),
        el("div", "cnb-kse-hint",
          "A line set is a run of staff lines one staff space apart. On every line set the " +
          "signature repeats; the tonic and the half steps alone keep it less busy."));
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
