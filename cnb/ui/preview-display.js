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
 *   - Key selection renders only when config.keys.enabled is true and key
 *     definitions exist (spec step 1: "(if keys.enabled) key selection").
 *     The chosen key is passed to CNBCollection.render() as options.keys =
 *     [name]; Module 10 accepts the option but renders key rows with
 *     key = null (deferred per architecture plan §5 Module 10 "Key rows
 *     (future)"), and the visible .cnb-pvd-key-note states exactly that so
 *     the control never overclaims what the preview shows. A selected key
 *     that the current config no longer defines is retained in state and
 *     pruned at build time, like durations.
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
 *   │   └── div.cnb-pvd-key        (only when keys.enabled with definitions:
 *   │                               select + deferral note)
 *   ├── div.cnb-pvd-empty          (message when no duration is selected;
 *   │                               absent otherwise)
 *   └── div.cnb-pvd-preview        (Module 10 output; absent when empty)
 *
 * Dependencies: Module A (config shape), Module B (pitch labels),
 * Module 10 (card collection).
 */

import { CNBMusic } from "../src/cnb-music.js";
import { CNBCollection } from "../src/cnb-collection.js";

const PC_MIN = 0;
const PC_MAX = 12;   // upper C completing the chromatic row (Module B/10)

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

export const CNBPreviewDisplay = {

  PC_MIN,
  PC_MAX,

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
   * Key names available for selection: the config's key definitions when
   * config.keys.enabled is true, else [] (no key control is shown).
   * @param {object} config
   * @returns {string[]}
   */
  keyNames(config) {
    const keys = (config || {}).keys || {};
    if (!keys.enabled) return [];
    return (keys.definitions || []).map(k => k.name).filter(Boolean);
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
   * the config's first duration (Module 10's default single row) and no
   * key selected.
   * @param {object} config
   * @returns {{fromPc:number, toPc:number, durations:string[], key:string|null}}
   */
  defaultState(config) {
    return {
      fromPc: PC_MIN,
      toPc: PC_MAX,
      durations: [CNBPreviewDisplay.durationNames(config)[0]],
      key: null,
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
   *   - keys = [state.key] when keys are enabled and the key is currently
   *     defined, else null.
   * @param {object} config
   * @param {{fromPc:number, toPc:number, durations:string[], key:string|null}} state
   * @returns {{pitchClasses:number[], durations:string[], keys:string[]|null}}
   */
  buildOptions(config, state) {
    if (!isPlainObject(state)) {
      throw new Error(`Display state must be an object (got ${JSON.stringify(state)})`);
    }
    if (!Array.isArray(state.durations)) {
      throw new Error(`state.durations must be an array (got ${JSON.stringify(state.durations)})`);
    }
    if (state.key !== null && state.key !== undefined && typeof state.key !== "string") {
      throw new Error(`state.key must be a string or null (got ${JSON.stringify(state.key)})`);
    }
    const vocab = CNBPreviewDisplay.durationNames(config);
    const keys = CNBPreviewDisplay.keyNames(config);
    return {
      pitchClasses: CNBPreviewDisplay.buildPitchClasses(state.fromPc, state.toPc),
      durations: vocab.filter(name => state.durations.includes(name)),
      keys: (state.key !== null && state.key !== undefined && keys.includes(state.key))
        ? [state.key]
        : null,
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
   *
   * @param {HTMLElement} container
   * @param {{getConfig: () => object, onRender?: Function,
   *          collection?: {render: Function}}} opts
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

    const state = CNBPreviewDisplay.defaultState(getConfig());

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
      return wrap;
    }

    // ── Key selection (only when the config enables keys) ─────────────────
    function drawKey() {
      const names = CNBPreviewDisplay.keyNames(getConfig());
      if (names.length === 0) return null;
      const wrap = el("div", "cnb-pvd-key");
      wrap.appendChild(el("span", "cnb-pvd-key-label", "Key"));
      const select = el("select", "cnb-pvd-key-select");
      const none = el("option", "", "(none)");
      none.value = "";
      select.appendChild(none);
      for (const name of names) {
        const option = el("option", "", name);
        option.value = name;
        if (name === state.key) option.selected = true;
        select.appendChild(option);
      }
      select.value = names.includes(state.key) ? state.key : "";
      select.onchange = (e) => {
        const v = valueFrom(e, select);
        state.key = v === "" ? null : v;
        changed();
      };
      wrap.appendChild(select);
      wrap.appendChild(el("span", "cnb-pvd-key-note",
        "Key rows are deferred in the card collection (plan §5 Module 10) — " +
        "the selection is passed through but cards render key-neutral."));
      return wrap;
    }

    // ── Preview area ──────────────────────────────────────────────────────
    function drawPreview() {
      const config = getConfig();
      const options = CNBPreviewDisplay.buildOptions(config, state);
      if (options.durations.length === 0) {
        root.appendChild(el("div", "cnb-pvd-empty",
          "No duration selected — pick at least one duration pill to render the preview."));
        onRender(options, null);
        return;
      }
      const preview = el("div", "cnb-pvd-preview");
      collection.render(preview, config, options);
      root.appendChild(preview);
      onRender(options, preview);
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      const controls = el("div", "cnb-pvd-controls");
      controls.appendChild(drawRange());
      controls.appendChild(drawDurations());
      const key = drawKey();
      if (key) controls.appendChild(key);
      root.appendChild(controls);
      drawPreview();
    }

    const changed = () => redraw();

    redraw();
    container.appendChild(root);

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
      redraw,
    };
  },
};
