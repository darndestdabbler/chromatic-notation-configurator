/**
 * preview-display.js — Module 19: Preview Display
 *
 * The full preview with controls for pitch class range, duration selection,
 * and (when `keys.enabled`) key selection, driving Module 10's
 * CNBCollection.render() live from the shared config (session-set 006
 * spec, session 3 step 1). This is the top of the architecture plan's
 * dependency table — it composes, it does not render notation itself.
 *
 * Scope decisions for this build (session-set 006, session 3):
 *   - Pitch class range is a from/to pair over 0–12 (12 = the upper C that
 *     completes the chromatic row, per Module B's chromaticLabels() and
 *     Module 10's default row 0–12). buildPitchClasses() THROWS on
 *     non-integers, out-of-range values, or from > to (caller-bug policy,
 *     Modules 13–18 precedent). The UI itself can never produce that state:
 *     moving one endpoint past the other DRAGS the other endpoint along
 *     (documented interaction rule — the selects always hold a valid range,
 *     so no silent swap/clamp guessing is ever needed).
 *   - Duration selection is a set of toggle pills over the duration names in
 *     config.durations.definitions (falling back to ["crotchet"] when the
 *     config defines none — the same documented fallback Modules 11 and 18
 *     use). Selected names are RETAINED in editor state and PRUNED against
 *     the current config's vocabulary at build time (the verified set-005
 *     "retain in state, prune at emit" pattern), so a config change that
 *     removes a duration doesn't corrupt the selection and restoring the
 *     duration restores the selection. Deselecting every pill is allowed:
 *     the preview area then shows an explicit .cnb-pvd-empty message
 *     instead of a collection — an honest empty state, not a guessed row.
 *   - The key is a tonic and a mode (session 36): a key and mode picker,
 *     shown whatever the config, over the twelve tonics and the seven modes
 *     LilyPond's \key names (CNBMusic.MODES). The pick is example data,
 *     like the durations: withKey() gives the drawn copy of the config the
 *     picked key as a definition, so the signature draws for it, and
 *     options.keys = [its name]. With keys off there is no key (the export
 *     applies none either).
 *   - Module 19 does not own config state — the host does ("the UI shell
 *     owns state") — so render() takes a `getConfig` accessor (Modules
 *     17/18 contract) and the host calls the returned redraw() whenever the
 *     shared config changes. The range/duration/key selection is the
 *     module's OWN display state (what to show, not what the notation
 *     system is — the plan's config vs. example-data split), exposed via
 *     getState()/setState().
 *
 * Editor-side contract (same rendering rules as Modules 12–18): render()
 * builds plain DOM via document.createElement, wires events as element
 * properties (onclick/onchange) so the whole UI is exercisable in Node
 * against a stub document, and leaves all layout/styling to the host via
 * the .cnb-pvd-* class hooks.
 *
 * Structure:
 *   div.cnb-preview-display
 *   ├── div.cnb-pvd-controls
 *   │   ├── div.cnb-pvd-range      (from/to selects over PCs 0–12)
 *   │   ├── div.cnb-pvd-durations  (one toggle pill per duration name)
 *   │   └── div.cnb-pvd-key        (tonic and mode selects; the button that
 *   │                               turns the signature on, while it is
 *   │                               off; a note when keys are on and none
 *   │                               is defined)
 *   ├── div.cnb-pvd-empty          (message when no duration is selected;
 *   │                               absent otherwise)
 *   └── div.cnb-pvd-preview        (Module 10 output; absent when empty)
 *
 * Session 25 (the editor's reflowing canvas, design §6.1):
 *   - Size: a segmented control (Small 9, Medium 11, Large 16 px per
 *     semitone). The preview draws a display copy of the config at that
 *     size and ignores the saved display.pxPerSemi; the copy is never
 *     written back. The choice is the viewer's, remembered in the
 *     browser's localStorage (SIZE_STORAGE_KEY), every access guarded so a
 *     blocked storage means Medium. opts.storage replaces localStorage
 *     (null: remember nothing).
 *   - Rows: the collection renders fluid, on one row when the preview's
 *     width is at least CNBCollection.minRowWidth for one row, otherwise
 *     on two (rowsFor). A ResizeObserver on the root (opts.ResizeObserver
 *     replaces the global; without one the width is unknown and the
 *     preview stays on one row) redraws only when the row count changes.
 *     Below the two-row minimum the preview is marked cnb-pvd-overflow
 *     (the host scrolls it with a fade) and the size hint suggests a
 *     smaller Size.
 *   - opts.rangeHost: when given, the pitch-range control is drawn there
 *     (the editor puts it in Advanced) instead of in the controls.
 *
 * Session 26 (each section's preview, design §6): setFocus("ledger-lines")
 * draws the canvas with every candidate ledger spot and the class
 * cnb-pvd-focus-ledgers, so the host tints the columns whose data-ledgers
 * is not 0; renderPartial draws the Clef or Key signature section's
 * partial staff, that gutter and the first three columns.
 *
 * Session 27 (selecting noteheads, design §2, §5.4): a click on a canvas
 * column (its data-pc; C′ is pitch class 0) calls opts.onSelect(pc,
 * { add }), add being true for a Shift-click (since session 38 a Ctrl- or
 * Cmd-click too); the page owns the selection. With an onSelect, the
 * toolbar's hint says how to select (SELECT_HINT) outside pitch mode.
 * setMarks({ selected, tinted }) marks the columns of those pitch classes
 * with the classes cnb-pvd-selected and cnb-pvd-tint (in every row, C′ with
 * C) without a redraw, and the marks are put back after every redraw.
 *
 * Session 28 (pitch, design §4.2): the canvas always draws the collection's
 * label strip (labelStrip), quiet, and counts it in the row choice.
 * setPitchMode(true) puts the class cnb-pvd-pitch-mode on the root and a
 * hint in the toolbar, with no redraw; in pitch mode a pointer drag on a
 * row's strip moves its labels in whole semitones, and the release calls
 * opts.onPitchDrag(d), d the semitones dragged, downward positive (the
 * host applies CNBPitchModel.shiftPitch(config, d)).
 *
 * Session 43 (nudges you can drag): in pitch mode, with opts.onNudgeDrag,
 * a pointer drag on a pitch column moves its note-slice with the pointer,
 * and the release calls opts.onNudgeDrag(pc, units), units the axis units
 * dragged upward (pixels ÷ display.pxPerSemi, to 2 places; the host
 * applies CNBPitchModel.dragNudge). Esc, a cancel or a move under
 * NUDGE_THRESHOLD pixels puts the slice back and reports nothing. A drag
 * that moved swallows the click that follows, so it does not also select.
 *
 * Session 45 (clefs): with the Clef section open (setFocus("clef")) and
 * opts.onClefDrag, a glyph clef can be dragged on the canvas. The root gets
 * the class cnb-pvd-clef-mode, which shows the clef's resize handle
 * (rect.cnb-clef-resize, on its bottom edge), and the toolbar says what to
 * do (CLEF_HINT). A drag on the clef moves it with the pointer, a drag on
 * its handle moves only the handle, and the release calls
 * opts.onClefDrag("move" | "resize", semis), semis the semitones dragged
 * upward (pixels ÷ display.pxPerSemi, to 2 places; the host applies
 * CNBClefEditor.withRange). Esc, a cancel or a move under NUDGE_THRESHOLD
 * pixels puts it back and reports nothing.
 *
 * Session 36 (the rebuilds' rough edges): beside the duration buttons, when
 * the host passes opts.onRepresentationMode, a two-way choice between each
 * duration's own shape and repeated heads (durations.representationMode,
 * REPRESENTATION_CHOICES); a click on the other one calls
 * opts.onRepresentationMode("shape" | "repeat") and the host writes it.
 *
 * Session 36 also turns the key select into the key and mode picker (see
 * the scope decisions above). While the signature is off and the host
 * passes opts.onSignatureOn, a button beside the picker asks the host to
 * turn on the default signature (keys.enabled, keys.keySignature.enabled,
 * the scale stack).
 *
 * Dependencies: Module A (config shape), Module B (pitch labels, modes),
 * Module 10 (card collection).
 */

import { CNBMusic } from "../src/cnb-music.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBClef } from "../src/cnb-clef.js";

const PC_MIN = 0;
const PC_MAX = 12;   // upper C completing the chromatic row (Module B/10)

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/** The canvas sizes in px per semitone (design §6.1). */
const SIZES = { small: 9, medium: 11, large: 16 };
const DEFAULT_SIZE = "medium";
const SIZE_STORAGE_KEY = "cnb.canvasSize";

/** The choice beside the duration buttons (session 36), in the designer's
 *  words: durations.representationMode → its label. */
const REPRESENTATION_CHOICES = {
  shape: "Its own shape for each duration",
  repeat: "Repeat the notehead",
};
/** The engine's repeat counts (CNBCard.repeatCount), shown with the choice. */
const REPEAT_HINT = "Repeated: minim ×2, semibreve ×4, breve as two tied semibreves";

/** The key picker's tonics and the key shown first (session 36). */
const TONIC_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const DEFAULT_KEY = { tonic: 0, mode: "major" };

/** The sorted, distinct pitch classes of a list, as a comparable string. */
function pcSet(pcs) {
  return [...new Set(pcs.map(CNBMusic.pitchClass))].sort((a, b) => a - b).join(" ");
}

/** Throws unless key is { tonic: 0–11, mode: a CNBMusic.MODES name }. */
function checkKey(key) {
  if (!isPlainObject(key)) throw new Error(`state.key must be { tonic, mode } (got ${JSON.stringify(key)})`);
  CNBMusic.scale(key.tonic, key.mode);
}

/** The toolbar hint in pitch mode (session 28, mock-up 3). */
const PITCH_HINT = "Drag the labels on the left to move the pitches against the staff, or a notehead up or down to nudge it";
/** The pixels a notehead drag must move before it nudges (session 43). */
const NUDGE_THRESHOLD = 3;
/** The toolbar hint with the Clef section open and a glyph clef shown (session 45). */
const CLEF_HINT = "Drag the clef up or down to move it, or its bottom edge to make it taller or shorter";
/** The toolbar hint when noteheads can be selected (session 38). */
const SELECT_HINT = "Click a notehead to give it a look; Shift+click or Ctrl+click to select several";

/** The canvas's label style (design §6.2): plain, compact pitch labels. */
const EDITOR_LABEL = { fontSize: 15, marginTop: 6, marginBottom: 6, padding: 4, color: "#5b5d63" };

/** The browser's localStorage, or null where reading it throws or it is absent. */
function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const CNBPreviewDisplay = {

  PC_MIN,
  PC_MAX,
  SIZES,
  DEFAULT_SIZE,
  SIZE_STORAGE_KEY,
  EDITOR_LABEL,
  REPRESENTATION_CHOICES,
  REPEAT_HINT,
  SELECT_HINT,
  TONIC_NAMES,
  DEFAULT_KEY,

  /**
   * The remembered Size: the stored name when it is one of SIZES, else
   * Medium (also when the storage is null or throws).
   * @param {{getItem: Function}|null} storage
   * @returns {"small"|"medium"|"large"}
   */
  readSize(storage) {
    try {
      const v = storage ? storage.getItem(SIZE_STORAGE_KEY) : null;
      return Object.hasOwn(SIZES, v) ? v : DEFAULT_SIZE;
    } catch {
      return DEFAULT_SIZE;
    }
  },

  /**
   * Remember a Size; a null or failing storage remembers nothing.
   * @param {{setItem: Function}|null} storage
   * @param {"small"|"medium"|"large"} size
   */
  writeSize(storage, size) {
    try {
      if (storage) storage.setItem(SIZE_STORAGE_KEY, size);
    } catch {
      // Blocked storage: the choice lasts until the page reloads.
    }
  },

  /**
   * The config the canvas draws: a copy with display.pxPerSemi set to the
   * Size, no column padding, because the fluid grid gives every column its
   * own 2 px either side of the widest ledger, and the editor's label
   * style: plain 15 px labels in --ink-2 with tight margins (design §6.1,
   * §6.2, as in the mock-ups). The input is not changed.
   * @param {object} config
   * @param {"small"|"medium"|"large"} size
   * @returns {object}
   */
  displayConfig(config, size) {
    const display = config.display || {};
    return {
      ...config,
      display: {
        ...display,
        pxPerSemi: SIZES[size],
        column: { ...(display.column || {}), paddingH: 0 },
        label: { ...(display.label || {}), ...EDITOR_LABEL },
      },
    };
  },

  /** The pitch classes a partial preview shows: the first three columns. */
  PARTIAL_PCS: [0, 1, 2],

  /**
   * A partial staff for the Clef or Key signature section (session 26,
   * design §6): that section's gutter and the first three columns (C, C♯,
   * D) on one fluid row, at the canvas Size, with the other gutter turned
   * off, in a div.cnb-pvd-partial appended to host. The config is not
   * changed. With duration null (the canvas has no duration selected, so
   * it draws no staff) nothing is drawn (session 26 review).
   * @param {HTMLElement} host
   * @param {object} config
   * @param {{part:"clef"|"key-signature", size?:"small"|"medium"|"large",
   *          duration?:string|null, key?:{tonic:number, mode:string}|null}} opts
   *        key: the key picked on the canvas (withKey), or null for none
   * @returns {HTMLDivElement|null} the div.cnb-pvd-partial, or null when
   *          duration is null
   */
  renderPartial(host, config, { part, size = DEFAULT_SIZE, duration = "crotchet", key = null } = {}) {
    if (part !== "clef" && part !== "key-signature") {
      throw new Error(`renderPartial: part must be "clef" or "key-signature" (got ${JSON.stringify(part)})`);
    }
    if (duration === null) return null;
    const picked = CNBPreviewDisplay.withKey(config, key);
    const drawn = CNBPreviewDisplay.displayConfig(picked.config, size);
    if (part === "clef" && drawn.keys) {
      drawn.keys = { ...drawn.keys, keySignature: { ...(drawn.keys.keySignature || {}), enabled: false } };
    }
    if (part === "key-signature" && drawn.clef) {
      drawn.clef = { ...drawn.clef, enabled: false };
    }
    const wrap = globalThis.document.createElement("div");
    wrap.className = "cnb-pvd-partial";
    CNBCollection.render(wrap, drawn, {
      pitchClasses: CNBPreviewDisplay.PARTIAL_PCS,
      durations: [duration],
      keys: picked.name ? [picked.name] : null,
      fluid: true,
      rows: 1,
    });
    host.appendChild(wrap);
    return wrap;
  },

  /**
   * One row when the width holds a one-row layout, otherwise two.
   * @param {object} config   the config as drawn (displayConfig)
   * @param {object} options  collection options (pitchClasses, durations, keys)
   * @param {number} width    px available
   * @returns {1|2}
   */
  rowsFor(config, options, width) {
    return width >= CNBCollection.minRowWidth(config, { ...options, labelStrip: true, rows: 1 }) ? 1 : 2;
  },

  /**
   * Display label for a pitch-class select option: note name via Module B,
   * with ♯ for sharps and a prime mark for the upper C (pc 12).
   * pcOptionLabel(1) = "C♯", pcOptionLabel(12) = "C′".
   * @param {number} pc  0–12
   * @returns {string}
   */
  pcOptionLabel(pc) {
    const label = CNBMusic.pcLabel(pc % 12);
    return label.text + (label.sharp ? "♯" : "") + (pc === PC_MAX ? "′" : "");
  },

  /**
   * Duration names defined in the config, in definition order — the pill
   * vocabulary. Falls back to ["crotchet"] when the config defines none
   * (the same documented fallback as Modules 11 and 18).
   * @param {object} config
   * @returns {string[]}
   */
  durationNames(config) {
    const defs = (((config || {}).durations || {}).definitions) || [];
    const names = defs.map(d => d.name).filter(Boolean);
    return names.length > 0 ? names : ["crotchet"];
  },

  /**
   * The config with the key picked on the canvas (session 36): with keys
   * on, its keys.definitions carry the picked key, under the name of the
   * defined key the export engraves for those pitch classes (LY spec 1.3.9
   * §6.4: the first in definition order that a rule names, else the first
   * with them) and with the picked tonic, or, when none is defined, a new
   * definition named for it ("D dorian"). The signature and the key-scoped
   * rules then draw as engraved. With keys off, or no key, the config comes
   * back as it is and the name is null. The input is not changed.
   * @param {object} config
   * @param {{tonic:number, mode:string}|null} key
   * @returns {{config: object, name: string|null}}
   */
  withKey(config, key) {
    const keys = (config || {}).keys || {};
    if (key === null || key === undefined || !keys.enabled) return { config, name: null };
    checkKey(key);
    const pcs = CNBMusic.scale(key.tonic, key.mode).sort((a, b) => a - b);
    const set = pcSet(pcs);
    const defs = Array.isArray(keys.definitions) ? keys.definitions : [];
    const sameSet = (d) => isPlainObject(d) && Array.isArray(d.pitchClasses) && pcSet(d.pitchClasses) === set;
    const named = new Set((config.noteheadRules || [])
      .flatMap(r => (r && r.match && Array.isArray(r.match.keys)) ? r.match.keys : []));
    const match = defs.find(d => sameSet(d) && named.has(d.name)) || defs.find(sameSet);
    const name = match ? match.name : `${TONIC_NAMES[key.tonic]} ${key.mode}`;
    const picked = { ...(match || { pitchClasses: pcs }), name, tonicPc: key.tonic };
    const definitions = match ? defs.map(d => (d === match ? picked : d)) : [...defs, picked];
    return { config: { ...config, keys: { ...keys, definitions } }, name };
  },

  /**
   * The contiguous pitch-class list for a from/to range, inclusive.
   * buildPitchClasses(0, 12) → [0, 1, …, 12]. Throws on non-integer or
   * out-of-range endpoints and on from > to (caller-bug policy — the UI's
   * endpoint-drag rule keeps its own state permanently valid).
   * @param {number} fromPc  0–12
   * @param {number} toPc    0–12, >= fromPc
   * @returns {number[]}
   */
  buildPitchClasses(fromPc, toPc) {
    for (const [label, v] of [["fromPc", fromPc], ["toPc", toPc]]) {
      if (!Number.isInteger(v) || v < PC_MIN || v > PC_MAX) {
        throw new Error(
          `${label} must be an integer in ${PC_MIN}–${PC_MAX} (got ${JSON.stringify(v)})`);
      }
    }
    if (fromPc > toPc) {
      throw new Error(`Pitch range is inverted: fromPc ${fromPc} > toPc ${toPc}`);
    }
    const pcs = [];
    for (let pc = fromPc; pc <= toPc; pc++) pcs.push(pc);
    return pcs;
  },

  /**
   * Initial display state for a config: the full chromatic row 0–12 with
   * the config's first duration (Module 10's default single row) and the
   * key of C major.
   * @param {object} config
   * @returns {{fromPc:number, toPc:number, durations:string[], key:{tonic:number, mode:string}}}
   */
  defaultState(config) {
    return {
      fromPc: PC_MIN,
      toPc: PC_MAX,
      durations: [CNBPreviewDisplay.durationNames(config)[0]],
      key: { ...DEFAULT_KEY },
    };
  },

  /**
   * Build the CNBCollection.render() options for a config + display state,
   * applying the prune-at-build rules from the module header:
   *   - pitchClasses from the from/to range (throws via buildPitchClasses
   *     on an invalid range — caller bug);
   *   - durations = state.durations ∩ the config's current duration
   *     vocabulary, in vocabulary order (may be EMPTY — the caller decides
   *     what an empty preview looks like; render() shows .cnb-pvd-empty);
   *   - keys = [the picked key's name] (withKey) when keys are enabled,
   *     else null. state.key is { tonic, mode } or null (no key); anything
   *     else throws.
   * @param {object} config
   * @param {{fromPc:number, toPc:number, durations:string[], key:{tonic:number, mode:string}|null}} state
   * @returns {{pitchClasses:number[], durations:string[], keys:string[]|null}}
   */
  buildOptions(config, state) {
    if (!isPlainObject(state)) {
      throw new Error(`Display state must be an object (got ${JSON.stringify(state)})`);
    }
    if (!Array.isArray(state.durations)) {
      throw new Error(`state.durations must be an array (got ${JSON.stringify(state.durations)})`);
    }
    if (state.key !== null && state.key !== undefined) checkKey(state.key);
    const vocab = CNBPreviewDisplay.durationNames(config);
    const { name } = CNBPreviewDisplay.withKey(config, state.key ?? null);
    return {
      pitchClasses: CNBPreviewDisplay.buildPitchClasses(state.fromPc, state.toPc),
      durations: vocab.filter(d => state.durations.includes(d)),
      keys: name ? [name] : null,
    };
  },

  /**
   * Render the preview display into a container.
   *
   * Module 19 does not own config state. The host supplies:
   *   - getConfig (REQUIRED): () => the current shared config. render()
   *     throws without it — there is no sensible default to guess. The
   *     host calls the returned redraw() after every config change so the
   *     preview (and the control vocabularies) follow the shared state.
   *   - onRender(options, target): informational callback invoked after
   *     each preview (re)render with the exact options object passed to
   *     the collection and the rendered .cnb-pvd-preview element — or,
   *     when no duration is selected, with options and null.
   *   - collection: injection seam for the collection renderer (defaults
   *     to Module 10's CNBCollection; tests may pass a recorder). Must
   *     expose render(container, config, options).
   *   - onRepresentationMode(mode) (session 36): when given, the toolbar
   *     draws the choice between each duration's own shape ("shape") and
   *     repeated heads ("repeat") beside the duration buttons, and a click
   *     on the one not in the config reports it; the host writes
   *     durations.representationMode and calls redraw().
   *   - onSignatureOn() (session 36): when given, while the key signature
   *     is off, a button beside the key picker asks the host to turn on the
   *     default signature (the scale stack); the host writes the config and
   *     calls redraw().
   *
   * @param {HTMLElement} container
   * @param {{getConfig: () => object, onRender?: Function,
   *          collection?: {render: Function},
   *          onRepresentationMode?: (mode: "shape"|"repeat") => void,
   *          onSignatureOn?: () => void}} opts
   * @returns {{root: HTMLElement, getState: () => object,
   *            setState: (partial: object) => void,
   *            getOptions: () => object, redraw: () => void}}
   */
  render(container, opts = {}) {
    if (typeof opts.getConfig !== "function") {
      throw new Error("CNBPreviewDisplay.render requires opts.getConfig — the host owns config state");
    }
    const doc = globalThis.document;
    const getConfig = opts.getConfig;
    const onRender = opts.onRender || (() => {});
    const collection = opts.collection || CNBCollection;
    const storage = "storage" in opts ? opts.storage : browserStorage();
    const Observer = "ResizeObserver" in opts ? opts.ResizeObserver : globalThis.ResizeObserver;
    const rangeHost = opts.rangeHost || null;

    const state = CNBPreviewDisplay.defaultState(getConfig());
    let size = CNBPreviewDisplay.readSize(storage);
    let width = Infinity;     // unknown until measured: one row
    let rows = 1;             // the row count of the last drawn preview
    let preview = null;       // the last drawn .cnb-pvd-preview
    let sizeHint = null;      // the hint shown below the two-row minimum
    let focus = null;         // the open section (setFocus); "ledger-lines" marks ledgers
    const onSelect = opts.onSelect || null;
    let marks = { selected: [], tinted: [] };   // setMarks, put back after every redraw
    let columns = [];         // the drawn pitch columns (data-pc), for the marks
    const onPitchDrag = opts.onPitchDrag || null;
    const onNudgeDrag = opts.onNudgeDrag || null;
    let swallowClick = false; // a notehead drag moved: the click that follows does not select
    const onClefDrag = opts.onClefDrag || null;
    const onRepresentationMode = opts.onRepresentationMode || null;
    const onSignatureOn = opts.onSignatureOn || null;
    let pitchMode = false;    // setPitchMode: the label strip is draggable
    let pitchHint = null;     // the toolbar hint shown in pitch mode

    const root = doc.createElement("div");
    root.className = "cnb-preview-display";

    const el = (tag, className, text) => {
      const e = doc.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };

    const valueFrom = (e, input) =>
      (e && e.target && e.target.value !== undefined) ? e.target.value : input.value;

    // ── Range controls ────────────────────────────────────────────────────
    function drawRange() {
      const wrap = el("div", "cnb-pvd-range");
      wrap.appendChild(el("span", "cnb-pvd-range-label", "Pitch range"));

      const pcSelect = (cls, current, onPick) => {
        const select = el("select", cls);
        for (let pc = PC_MIN; pc <= PC_MAX; pc++) {
          const option = el("option", "",
            pc + " — " + CNBPreviewDisplay.pcOptionLabel(pc));
          option.value = String(pc);
          if (pc === current) option.selected = true;
          select.appendChild(option);
        }
        select.value = String(current);
        select.onchange = (e) => onPick(parseInt(valueFrom(e, select), 10));
        return select;
      };

      wrap.appendChild(pcSelect("cnb-pvd-from", state.fromPc, (pc) => {
        state.fromPc = pc;
        // Endpoint-drag rule (module header): the range stays valid.
        if (state.toPc < pc) state.toPc = pc;
        changed();
      }));
      wrap.appendChild(el("span", "cnb-pvd-range-to", "to"));
      wrap.appendChild(pcSelect("cnb-pvd-to", state.toPc, (pc) => {
        state.toPc = pc;
        if (state.fromPc > pc) state.fromPc = pc;
        changed();
      }));
      return wrap;
    }

    // ── Duration pills ────────────────────────────────────────────────────
    function drawDurations() {
      const wrap = el("div", "cnb-pvd-durations");
      wrap.appendChild(el("span", "cnb-pvd-durations-label", "Durations"));
      for (const name of CNBPreviewDisplay.durationNames(getConfig())) {
        const on = state.durations.includes(name);
        const pill = el("button", "cnb-pvd-duration-pill" + (on ? " on" : ""), name);
        pill.type = "button";
        pill.setAttribute("data-duration", name);
        pill.onclick = () => {
          state.durations = on
            ? state.durations.filter(n => n !== name)
            : [...state.durations, name];
          changed();
        };
        wrap.appendChild(pill);
      }
      if (onRepresentationMode) wrap.appendChild(drawRepresentation());
      return wrap;
    }

    // ── Shapes or repeated heads (session 36) ─────────────────────────────
    function drawRepresentation() {
      const current = ((getConfig() || {}).durations || {}).representationMode === "repeat" ? "repeat" : "shape";
      const wrap = el("div", "cnb-pvd-repeat");
      const group = el("div", "cnb-pvd-repeat-options");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", "Longer durations");
      for (const [mode, label] of Object.entries(REPRESENTATION_CHOICES)) {
        const on = mode === current;
        const button = el("button", "cnb-pvd-repeat-option" + (on ? " on" : ""), label);
        button.type = "button";
        button.setAttribute("data-mode", mode);
        button.setAttribute("aria-pressed", String(on));
        button.onclick = () => { if (!on) onRepresentationMode(mode); };
        group.appendChild(button);
      }
      wrap.appendChild(group);
      wrap.appendChild(el("span", "cnb-pvd-repeat-hint", REPEAT_HINT));
      return wrap;
    }

    // ── The key and mode picker (session 36) ──────────────────────────────
    function drawKey() {
      const keys = (getConfig() || {}).keys || {};
      const signatureOn = !!(keys.enabled && (keys.keySignature || {}).enabled);
      const key = state.key || DEFAULT_KEY;
      const wrap = el("div", "cnb-pvd-key");
      wrap.appendChild(el("span", "cnb-pvd-key-label", "Key"));

      const tonic = el("select", "cnb-pvd-key-tonic");
      tonic.setAttribute("aria-label", "Key");
      TONIC_NAMES.forEach((text, pc) => {
        const option = el("option", "", text);
        option.value = String(pc);
        if (pc === key.tonic) option.selected = true;
        tonic.appendChild(option);
      });
      tonic.value = String(key.tonic);
      tonic.onchange = (e) => {
        state.key = { ...key, tonic: parseInt(valueFrom(e, tonic), 10) };
        changed();
      };
      wrap.appendChild(tonic);

      const mode = el("select", "cnb-pvd-key-mode");
      mode.setAttribute("aria-label", "Mode");
      for (const name of Object.keys(CNBMusic.MODES)) {
        const option = el("option", "", name);
        option.value = name;
        if (name === key.mode) option.selected = true;
        mode.appendChild(option);
      }
      mode.value = key.mode;
      mode.onchange = (e) => {
        state.key = { ...key, mode: valueFrom(e, mode) };
        changed();
      };
      wrap.appendChild(mode);

      if (!signatureOn && onSignatureOn) {
        const on = el("button", "cnb-pvd-signature-on", "Show the key signature");
        on.type = "button";
        on.title = "The scale stack: the key's scale as stacked noteheads, as the engine engraves it";
        on.onclick = () => onSignatureOn();
        wrap.appendChild(on);
      }
      if (keys.enabled && !(Array.isArray(keys.definitions) && keys.definitions.length)) {
        wrap.appendChild(el("span", "cnb-pvd-key-note",
          "No keys are defined yet, so no notehead rule can be for a particular key."));
      }
      return wrap;
    }

    // ── Size (session 25) ─────────────────────────────────────────────────
    function drawSize() {
      const wrap = el("div", "cnb-pvd-size");
      wrap.appendChild(el("span", "cnb-pvd-size-label", "Size"));
      const group = el("div", "cnb-pvd-size-options");
      for (const name of Object.keys(SIZES)) {
        const button = el("button", "cnb-pvd-size-option" + (name === size ? " on" : ""),
          name[0].toUpperCase() + name.slice(1));
        button.type = "button";
        button.setAttribute("data-size", name);
        button.onclick = () => {
          size = name;
          CNBPreviewDisplay.writeSize(storage, name);
          changed();
        };
        group.appendChild(button);
      }
      wrap.appendChild(group);
      sizeHint = el("span", "cnb-pvd-size-hint", "");
      wrap.appendChild(sizeHint);
      return wrap;
    }

    // ── Preview area ──────────────────────────────────────────────────────
    /** The drawn config and the collection options for the current state. */
    function drawn() {
      const picked = CNBPreviewDisplay.withKey(getConfig(), state.key);
      const config = CNBPreviewDisplay.displayConfig(picked.config, size);
      return { config, options: CNBPreviewDisplay.buildOptions(config, state) };
    }

    /** Below the two-row minimum: mark the preview and suggest a smaller Size. */
    function updateOverflow(config, options) {
      if (!preview) return;
      const overflow = width < CNBCollection.minRowWidth(config, { ...options, labelStrip: true, rows: 2 });
      preview.className = "cnb-pvd-preview" + (overflow ? " cnb-pvd-overflow" : "") +
        (focus === "ledger-lines" ? " cnb-pvd-focus-ledgers" : "");
      sizeHint.textContent = !overflow ? ""
        : size === "small" ? "The staff is wider than the window."
        : "The staff is wider than the window: choose a smaller Size.";
    }

    // ── Selection and marks (session 27, design §2, §5.4) ─────────────────
    /** The columns under el that carry data-pc (a card's column). */
    function pitchColumns(el) {
      const out = [];
      for (const child of el.children || []) {
        // The label strip's labels carry data-pc too; they are not columns.
        if (child.className === "label-col") continue;
        if (typeof child.getAttribute === "function" && child.getAttribute("data-pc") !== null) out.push(child);
        else out.push(...pitchColumns(child));
      }
      return out;
    }

    /** Turn one class token on or off in an element's className. */
    function setToken(e, token, on) {
      const tokens = String(e.className || "").split(/\s+/).filter(t => t && t !== token);
      if (on) tokens.push(token);
      e.className = tokens.join(" ");
    }

    /** Put the marks on the drawn columns: C′ (12) is marked with C. */
    function applyMarks() {
      for (const col of columns) {
        const pc = Number(col.getAttribute("data-pc")) % 12;
        setToken(col, "cnb-pvd-selected", marks.selected.includes(pc));
        setToken(col, "cnb-pvd-tint", marks.tinted.includes(pc));
      }
    }

    /** Wire the columns' clicks and mark them. */
    function wireColumns() {
      columns = preview ? pitchColumns(preview) : [];
      if (onSelect) {
        for (const col of columns) {
          const pc = Number(col.getAttribute("data-pc")) % 12;
          col.onclick = (e) => {
            if (swallowClick) { swallowClick = false; return; }
            onSelect(pc, { add: !!(e && (e.shiftKey || e.ctrlKey || e.metaKey)) });
          };
        }
      }
      applyMarks();
    }

    // ── The label strip in pitch mode (session 28, design §4.2) ───────────
    /** The descendants of el whose class attribute is cls. */
    function byClassAttr(el, cls) {
      const out = [];
      for (const child of el.children || []) {
        if (typeof child.getAttribute === "function" && child.getAttribute("class") === cls) out.push(child);
        else out.push(...byClassAttr(child, cls));
      }
      return out;
    }

    /**
     * Make each row's label strip draggable in pitch mode. A drag moves the
     * strip's labels with the pointer in whole semitones of step px
     * (downward positive), the middle line staying put; the release reports
     * the semitones moved through opts.onPitchDrag, and Esc, a cancel or no
     * move puts the labels back.
     */
    function wireStrips(step) {
      for (const slice of preview ? byClassAttr(preview, "label-slice") : []) {
        const labels = byClassAttr(slice, "pitch-label");
        let drag = null;
        const place = (d) => {
          for (const g of labels) g.setAttribute("transform", d === 0 ? "" : `translate(0 ${d * step})`);
        };
        const end = (report) => {
          if (!drag) return;
          const d = drag.d;
          globalThis.removeEventListener?.("keydown", drag.onKey);
          drag = null;
          place(0);
          if (report && d !== 0 && onPitchDrag) onPitchDrag(d);
        };
        slice.onpointerdown = (e) => {
          if (!pitchMode || !e) return;
          const onKey = (k) => { if (k && k.key === "Escape") end(false); };
          drag = { startY: e.clientY, d: 0, onKey };
          globalThis.addEventListener?.("keydown", onKey);
          if (typeof slice.setPointerCapture === "function" && e.pointerId !== undefined) {
            try { slice.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
          }
          if (typeof e.preventDefault === "function") e.preventDefault();
        };
        slice.onpointermove = (e) => {
          if (!drag || !e) return;
          const d = Math.round((e.clientY - drag.startY) / step) || 0;
          if (d !== drag.d) {
            drag.d = d;
            place(d);
          }
        };
        slice.onpointerup = () => end(true);
        slice.onpointercancel = () => end(false);
      }
    }

    /**
     * Make each pitch column's noteheads draggable in pitch mode (session
     * 43): the note-slice follows the pointer up and down, and the release
     * reports the axis units dragged upward through opts.onNudgeDrag(pc,
     * units). Esc, a cancel or a move under NUDGE_THRESHOLD puts it back.
     */
    function wireNudges(step) {
      if (!onNudgeDrag) return;
      for (const col of columns) {
        const pc = Number(col.getAttribute("data-pc")) % 12;
        const slice = byClassAttr(col, "note-slice")[0];
        if (!slice) continue;
        let drag = null;
        const place = (dy) => { slice.style.transform = dy === 0 ? "" : `translateY(${dy}px)`; };
        const end = (report) => {
          if (!drag) return;
          const { dy, moved } = drag;
          globalThis.removeEventListener?.("keydown", drag.onKey);
          drag = null;
          place(0);
          if (moved) swallowClick = true;
          if (report && moved) {
            const units = Math.round(-dy / step * 100) / 100 || 0;
            if (units !== 0) onNudgeDrag(pc, units);
          }
        };
        col.onpointerdown = (e) => {
          swallowClick = false;
          if (!pitchMode || !e) return;
          const onKey = (k) => { if (k && k.key === "Escape") end(false); };
          drag = { startY: e.clientY, dy: 0, moved: false, onKey };
          globalThis.addEventListener?.("keydown", onKey);
          if (typeof col.setPointerCapture === "function" && e.pointerId !== undefined) {
            try { col.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
          }
          if (typeof e.preventDefault === "function") e.preventDefault();
        };
        col.onpointermove = (e) => {
          if (!drag || !e) return;
          drag.dy = e.clientY - drag.startY;
          if (Math.abs(drag.dy) >= NUDGE_THRESHOLD) drag.moved = true;
          if (drag.moved) place(drag.dy);
        };
        col.onpointerup = () => end(true);
        col.onpointercancel = () => end(false);
      }
    }

    /** Clef mode (session 45): the Clef section is open, the host takes
     *  drags, and the shown clef is a glyph clef. */
    function clefMode() {
      const active = onClefDrag && focus === "clef" ? CNBClef.activeGlyph(getConfig()) : null;
      return !!active && (active.def.kind || "glyph") === "glyph";
    }

    /**
     * Make the canvas's clef draggable in clef mode (session 45): a drag on
     * the clef moves its slice with the pointer, a drag on its resize handle
     * moves the handle, and the release reports the semitones dragged
     * upward through opts.onClefDrag("move" | "resize", semis). Esc, a
     * cancel or a move under NUDGE_THRESHOLD puts it back.
     */
    function wireClef(step) {
      if (!clefMode()) return;
      for (const col of preview ? byClassName(preview, "clef-col") : []) {
        const slice = byClassAttr(col, "clef-slice")[0];
        if (!slice) continue;
        let drag = null;
        const place = (dy) => {
          const moving = drag && drag.kind === "resize" ? drag.handle : slice;
          if (!moving) return;
          if (drag && drag.kind === "resize") {
            moving.setAttribute("transform", dy === 0 ? "" : `translate(0 ${dy})`);
          } else {
            moving.style.transform = dy === 0 ? "" : `translateY(${dy}px)`;
          }
        };
        const end = (report) => {
          if (!drag) return;
          const { dy, moved, kind } = drag;
          place(0);
          globalThis.removeEventListener?.("keydown", drag.onKey);
          drag = null;
          if (report && moved) {
            const semis = Math.round(-dy / step * 100) / 100 || 0;
            if (semis !== 0) onClefDrag(kind, semis);
          }
        };
        col.onpointerdown = (e) => {
          if (!e) return;
          const target = e.target;
          const kind = target && typeof target.getAttribute === "function" &&
            target.getAttribute("class") === "cnb-clef-resize" ? "resize" : "move";
          const onKey = (k) => { if (k && k.key === "Escape") end(false); };
          drag = { startY: e.clientY, dy: 0, moved: false, kind, handle: kind === "resize" ? target : null, onKey };
          globalThis.addEventListener?.("keydown", onKey);
          if (typeof col.setPointerCapture === "function" && e.pointerId !== undefined) {
            try { col.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
          }
          if (typeof e.preventDefault === "function") e.preventDefault();
        };
        col.onpointermove = (e) => {
          if (!drag || !e) return;
          drag.dy = e.clientY - drag.startY;
          if (Math.abs(drag.dy) >= NUDGE_THRESHOLD) drag.moved = true;
          if (drag.moved) place(drag.dy);
        };
        col.onpointerup = () => end(true);
        col.onpointercancel = () => end(false);
      }
    }

    /** The descendants of el whose className includes the token cls. */
    function byClassName(el, cls) {
      const out = [];
      for (const child of el.children || []) {
        if (String(child.className || "").split(/\s+/).includes(cls)) out.push(child);
        else out.push(...byClassName(child, cls));
      }
      return out;
    }

    /** The hint and the class for pitch mode and clef mode, with no
     *  redraw; outside them, the selection hint when noteheads can be
     *  selected. */
    function applyPitchMode() {
      const clef = !pitchMode && clefMode();
      setToken(root, "cnb-pvd-pitch-mode", pitchMode);
      setToken(root, "cnb-pvd-clef-mode", clef);
      if (pitchHint) {
        pitchHint.textContent = pitchMode ? PITCH_HINT : clef ? CLEF_HINT : onSelect ? SELECT_HINT : "";
      }
    }

    function drawPreview() {
      const { config, options } = drawn();
      preview = null;
      columns = [];
      if (options.durations.length === 0) {
        root.appendChild(el("div", "cnb-pvd-empty",
          "No duration selected — pick at least one duration pill to render the preview."));
        onRender(options, null);
        return;
      }
      rows = CNBPreviewDisplay.rowsFor(config, options, width);
      const collectionOptions = { ...options, fluid: true, rows, labelStrip: true };
      if (focus === "ledger-lines") collectionOptions.ledgerSpots = true;
      preview = el("div", "cnb-pvd-preview");
      collection.render(preview, config, collectionOptions);
      root.appendChild(preview);
      wireColumns();
      wireStrips(config.display.pxPerSemi);
      wireNudges(config.display.pxPerSemi);
      wireClef(config.display.pxPerSemi);
      updateOverflow(config, options);
      onRender(collectionOptions, preview);
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      const controls = el("div", "cnb-pvd-controls");
      if (rangeHost) {
        rangeHost.textContent = "";
        rangeHost.appendChild(drawRange());
      } else {
        controls.appendChild(drawRange());
      }
      controls.appendChild(drawDurations());
      controls.appendChild(drawKey());
      pitchHint = el("span", "cnb-pvd-pitch-hint", "");
      controls.appendChild(pitchHint);
      controls.appendChild(drawSize());
      root.appendChild(controls);
      drawPreview();
      applyPitchMode();
    }

    const changed = () => redraw();

    /** A new width: redraw when the row count changes, else re-mark overflow. */
    function resized(newWidth) {
      width = newWidth;
      const { config, options } = drawn();
      if (options.durations.length === 0) return;
      if (CNBPreviewDisplay.rowsFor(config, options, width) !== rows) redraw();
      else updateOverflow(config, options);
    }

    container.appendChild(root);
    redraw();
    if (typeof Observer === "function") {
      new Observer(entries => {
        const entry = entries[entries.length - 1];
        if (entry) resized(entry.contentRect.width);
      }).observe(root);
    }

    return {
      root,
      getState: () => deepClone(state),
      setState: (partial) => {
        if (!isPlainObject(partial)) {
          throw new Error(`setState expects an object (got ${JSON.stringify(partial)})`);
        }
        // Validate the merged state BEFORE adopting it (throws leave the
        // current state and DOM untouched — caller-bug policy).
        const candidate = { ...deepClone(state), ...deepClone(partial) };
        CNBPreviewDisplay.buildOptions(getConfig(), candidate);
        Object.assign(state, candidate);
        redraw();
      },
      getOptions: () => CNBPreviewDisplay.buildOptions(getConfig(), state),
      getSize: () => size,
      getRows: () => rows,
      /** The section the page shows (session 26, design §6): "ledger-lines"
       *  draws every candidate ledger spot and marks the preview so the
       *  host tints the columns that draw ledger lines; anything else draws
       *  the canvas as usual. Redraws only when the focus changes. */
      setFocus: (name) => {
        const next = name ?? null;
        if (next === focus) return;
        focus = next;
        redraw();
      },
      getFocus: () => focus,
      /** Mark the columns of the selected and the tinted pitch classes
       *  (0–11; C′ follows C) with cnb-pvd-selected and cnb-pvd-tint, with
       *  no redraw. The marks are put back after every redraw. */
      setMarks: ({ selected = [], tinted = [] } = {}) => {
        marks = { selected: selected.slice(), tinted: tinted.slice() };
        applyMarks();
      },
      /** Pitch mode (session 28, design §4.2): the canvas gets the class
       *  cnb-pvd-pitch-mode and the toolbar its hint, with no redraw, and a
       *  drag on a label strip reports opts.onPitchDrag(d), and a drag on a
       *  notehead opts.onNudgeDrag(pc, units) (session 43). Kept across
       *  redraws. */
      setPitchMode: (on) => {
        pitchMode = !!on;
        applyPitchMode();
      },
      getPitchMode: () => pitchMode,
      redraw,
    };
  },
};
