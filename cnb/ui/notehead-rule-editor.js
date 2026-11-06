/**
 * notehead-rule-editor.js — Module 14: Notehead Rule Editor
 *
 * Ports the legacy "Notehead cards" UI (`chromatic-configurator.html`
 * NOTEHEADS PANEL: renderNoteheadCard, EditPopup._buildNoteheadForm,
 * Actions.moveNoteheadRule/deleteNoteheadRule, and the cumulative resolver
 * `configurator-core.js` Core.resolveAllNoteheadConfigs) onto the
 * Module A config schema (architecture plan §4.5). The legacy files were
 * removed in 1.0.0 and are preserved at git tag `legacy-monolith-final`.
 *
 * Schema reconciliation (legacy → Module A), decided for this port:
 *   - Legacy kept single-property rules (`ruleType: 'shape' | 'hollow' |
 *     'color'`, one value each) applied in list order, last-match-wins per
 *     property. Module A rules carry a sparse `apply` block that may set any
 *     combination of shape/hollow/color/offKeyMark, walked in ascending
 *     `priority` order with only the fields present in `apply` overwriting
 *     (CNBConfig.resolveNotehead). This editor keeps the legacy list-order
 *     mental model — the rule list is shown top-to-bottom in application
 *     order and reordered with move up/down — and each apply property gets
 *     an enable toggle, so a legacy single-property rule is simply a rule
 *     with one apply field enabled.
 *   - Priority is normalized at emit: buildRules() assigns priority = list
 *     index (0, 1, 2, …). stateFromConfig() sorts incoming rules by their
 *     priority ascending (stable for ties — Array.prototype.sort is stable,
 *     matching resolveNotehead's own tie behavior), so arbitrary incoming
 *     priorities (e.g. 5/10) round-trip to the same *resolution semantics*
 *     even though the numbers are renumbered.
 *   - Legacy color rules picked a hex from the active palette. Module A
 *     encodes "use the palette" as `color: null` and an explicit hex as an
 *     override (§4.5). The editor exposes both: color mode "palette"
 *     (emits null) or "custom" (emits the hex from the color input).
 *   - Legacy blocked deleting the last rule with an alert(). Here removal
 *     is always allowed; an empty rule list simply fails Module A
 *     validation ("PC n is not covered by any notehead rule") which the
 *     validation strip surfaces live — consistent with the modular design
 *     where the schema, not the UI, owns invariants.
 *   - `match.keys` is editable against the key names defined in
 *     `config.keys.definitions` (plan §4.9). The legacy UI pinned this at
 *     "Keys (V2 — all keys for now)"; here the pills appear as soon as the
 *     host config defines keys — with no definitions there is nothing to
 *     narrow to, and the row says so. Key names present in a loaded rule
 *     but absent from the definitions still get pills (union), so they
 *     stay editable rather than being stranded.
 *   - `apply.offKeyMark` is editable per §4.5's "false | mark identifier":
 *     an enable toggle plus a mode select — "No mark" emits the explicit
 *     `false`, "Mark identifier" emits a non-empty string edited in a text
 *     input (seeded with the placeholder identifier "cross", the same
 *     seed-then-edit pattern as the custom-color control's #000000). The
 *     mark's *visual treatment* remains deferred (plan §11.4), so the
 *     resolved strip and preview show the effective mark identifier as
 *     text.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     rules: [                       // list order = application order
 *       {
 *         name:  string,
 *         match: { pitchClasses: "all"|number[], durations: "all"|string[],
 *                  keys: "all"|string[] },
 *         apply: { shape?: string, hollow?: boolean,
 *                  color?: string|null, offKeyMark?: false|string,
 *                  xOffsetStaffSpaces?: number,    // axis-gated (set 014)
 *                  heightSemis?: number, widthSemis?: number }  // size (session 22)
 *       }, ...
 *     ],
 *     previewDuration: string,       // display-only: duration the resolved
 *     previewKey: string|null        // strip resolves for, and the key
 *   }                                // context (null = none) — not config data
 *
 * Selection-representation note: an explicit pitch-class list that happens
 * to contain all 12 PCs is NOT auto-collapsed to "all" (nor the reverse) —
 * the user's representation is preserved exactly so build/parse round-trips
 * are lossless on every branch.
 *
 * Rendering contract (same as Modules 12–13): render() builds plain DOM via
 * document.createElement, wires events as element properties
 * (onclick/oninput/onchange) so the whole UI is exercisable in Node against
 * a stub document, and reports every state change through
 * onChange({ noteheadRules }, state) where the slice is a ready
 * `config.noteheadRules` array. Hosts own layout and styling via the
 * .cnb-nre-* class hooks.
 *
 * Dependencies: Module A (rule resolution, validation pass-through, config
 * plumbing). renderResolvedPreview() additionally composes Module 6
 * (Notehead) — the spec's step 3 live-resolved preview ships in the module
 * so hosts (test page now, Module 19 later) only place it. The resolved
 * strip inside render() shows the same CNBConfig.resolveNotehead() output
 * textually (shape · solid/hollow · color swatch) per pitch class.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBNotehead } from "../src/cnb-notehead.js";

// Pitch-class labels (kept inline like Modules 12–13 so the editor core
// adds no dependency beyond Module A).
const PC_LABELS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

// ─── Pure helpers ────────────────────────────────────────────────────────────

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/**
 * Sort, dedupe and validate an explicit pitch-class list.
 * Throws on non-integer or out-of-range entries — invalid input is a caller
 * bug, not something to silently repair.
 */
function sanitizePCs(pcs) {
  if (!Array.isArray(pcs)) {
    throw new Error("Pitch-class match must be \"all\" or an array of pitch classes (0–11)");
  }
  for (const p of pcs) {
    if (!Number.isInteger(p) || p < 0 || p > 11) {
      throw new Error(`Invalid pitch class ${JSON.stringify(p)} — must be an integer 0–11`);
    }
  }
  return [...new Set(pcs)].sort((a, b) => a - b);
}

/** "all" passes through; arrays are deduped (order preserved for strings). */
function sanitizeNameList(list, what) {
  if (list === "all") return "all";
  if (!Array.isArray(list)) {
    throw new Error(`${what} match must be "all" or an array (got ${JSON.stringify(list)})`);
  }
  return [...new Set(list)];
}

/** Duration names defined by a config (crotchet, minim, …). */
function durationNames(config) {
  return (((config || {}).durations || {}).definitions || []).map(d => d.name);
}

/** Key names defined by a config (plan §4.9 keys.definitions). */
function keyNames(config) {
  return (((config || {}).keys || {}).definitions || []).map(d => d.name);
}

/** Same #RRGGBB rule Module A's validate() applies (LY spec §8 check 7). */
function isValidHex(str) {
  return typeof str === "string" && /^#[0-9A-Fa-f]{6}$/.test(str);
}

export const CNBNoteheadRuleEditor = {

  PC_LABELS,

  /**
   * Build a ready `config.noteheadRules` array (plan §4.5) from editor
   * state. Pure function; throws on invalid state rather than guessing.
   *
   * Priority is the list index — the array order IS the application order.
   * Explicit pitch-class lists are deduped and sorted (many-to-one user
   * input); duration/key lists are deduped. The `apply` block is emitted
   * sparse — only the properties the rule actually sets are present, which
   * is what gives Module A its inherit-from-previous-match semantics. An
   * empty apply block is legal (the rule is a no-op) and emitted as-is.
   *
   * @param {object} state
   * @returns {object[]} config.noteheadRules array
   */
  buildRules(state) {
    return (state.rules || []).map((rule, i) => {
      const match = rule.match || {};
      const pcs = match.pitchClasses === "all" ? "all" : sanitizePCs(match.pitchClasses);
      const out = {
        name: typeof rule.name === "string" && rule.name !== "" ? rule.name : `Rule ${i + 1}`,
        priority: i,
        match: {
          pitchClasses: pcs,
          durations: sanitizeNameList(match.durations ?? "all", "Duration"),
          keys: sanitizeNameList(match.keys ?? "all", "Key"),
        },
        apply: {},
      };
      const apply = rule.apply || {};
      if (apply.shape !== undefined) {
        if (typeof apply.shape !== "string" || apply.shape === "") {
          throw new Error(`Rule ${i + 1} has invalid apply.shape ${JSON.stringify(apply.shape)}`);
        }
        out.apply.shape = apply.shape;
      }
      if (apply.hollow !== undefined) out.apply.hollow = !!apply.hollow;
      if (apply.color !== undefined) {
        if (apply.color !== null && !isValidHex(apply.color)) {
          throw new Error(
            `Rule ${i + 1} has invalid apply.color ${JSON.stringify(apply.color)} — must be null (palette) or #RRGGBB`);
        }
        out.apply.color = apply.color;
      }
      if (apply.offKeyMark !== undefined) {
        const mark = apply.offKeyMark;
        if (mark !== false && !(typeof mark === "string" && mark.length > 0)) {
          throw new Error(
            `Rule ${i + 1} has invalid apply.offKeyMark ${JSON.stringify(mark)} — must be false or a mark identifier`);
        }
        out.apply.offKeyMark = mark;
      }
      if (apply.xOffsetStaffSpaces !== undefined) {
        const x = apply.xOffsetStaffSpaces;
        if (typeof x !== "number" || !Number.isFinite(x)) {
          throw new Error(
            `Rule ${i + 1} has invalid apply.xOffsetStaffSpaces ${JSON.stringify(x)} — must be a finite number (staff spaces)`);
        }
        out.apply.xOffsetStaffSpaces = x;
      }
      for (const field of ["heightSemis", "widthSemis"]) {
        if (apply[field] === undefined) continue;
        const v = apply[field];
        if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
          throw new Error(
            `Rule ${i + 1} has invalid apply.${field} ${JSON.stringify(v)} — must be a number of semitones greater than 0`);
        }
        out.apply[field] = v;
      }
      return out;
    });
  },

  /**
   * Apply an editor state to a config: returns a new config with the
   * noteheadRules section replaced (all other sections untouched). Neither
   * argument is mutated.
   * @param {object} config
   * @param {object} state
   * @returns {object}
   */
  applyToConfig(config, state) {
    const out = CNBConfig.clone(config);
    out.noteheadRules = CNBNoteheadRuleEditor.buildRules(state);
    return out;
  },

  /**
   * Recover an editor state from a config (inverse of applyToConfig for the
   * noteheadRules slice). Rules are ordered by ascending priority (stable
   * for ties), matching CNBConfig.resolveNotehead's walk order, so the
   * displayed list order is exactly the application order.
   * @param {object} config
   * @returns {object} editor state
   */
  stateFromConfig(config) {
    const incoming = ((config || {}).noteheadRules || [])
      .slice()
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const rules = incoming.map((r, i) => {
      const match = r.match || {};
      const rule = {
        name: typeof r.name === "string" && r.name !== "" ? r.name : `Rule ${i + 1}`,
        match: {
          pitchClasses: match.pitchClasses === "all" ? "all" : sanitizePCs(match.pitchClasses || []),
          durations: sanitizeNameList(match.durations ?? "all", "Duration"),
          keys: sanitizeNameList(match.keys ?? "all", "Key"),
        },
        apply: {},
      };
      const apply = r.apply || {};
      if (apply.shape !== undefined) rule.apply.shape = apply.shape;
      if (apply.hollow !== undefined) rule.apply.hollow = !!apply.hollow;
      if (apply.color !== undefined) rule.apply.color = apply.color;
      if (apply.offKeyMark !== undefined) rule.apply.offKeyMark = deepClone(apply.offKeyMark);
      if (apply.xOffsetStaffSpaces !== undefined) rule.apply.xOffsetStaffSpaces = apply.xOffsetStaffSpaces;
      if (apply.heightSemis !== undefined) rule.apply.heightSemis = apply.heightSemis;
      if (apply.widthSemis !== undefined) rule.apply.widthSemis = apply.widthSemis;
      return rule;
    });

    const firstDuration = durationNames(config)[0];
    return { rules, previewDuration: firstDuration || "crotchet", previewKey: null };
  },

  /**
   * Resolve all 12 pitch classes through Module A for one duration/key and
   * attach the effective display color (explicit rule hex, else the
   * palette color for the PC, else black — the same precedence the plan
   * gives the preview renderer and §4.5 gives the exporter's default).
   *
   * @param {object} config        full CNB config (rules already applied)
   * @param {string} duration      e.g. "crotchet"
   * @param {string|null} [key]
   * @returns {Array<{pc:number, label:string, shape:string, hollow:boolean,
   *                  color:string|null, offKeyMark:boolean|string,
   *                  effectiveColor:string}>}
   */
  resolveAll(config, duration, key = null) {
    const out = [];
    for (let pc = 0; pc < 12; pc++) {
      const r = CNBConfig.resolveNotehead(config, pc, duration, key);
      const effectiveColor = r.color !== null && r.color !== undefined
        ? r.color
        : (CNBConfig.resolveColor(config, pc) || "#000000");
      out.push({ pc, label: PC_LABELS[pc], ...r, effectiveColor });
    }
    return out;
  },

  /**
   * Render the notehead rule editor into a container.
   *
   * Structure (all styling left to the host via class hooks):
   *   div.cnb-notehead-rule-editor
   *   ├── div.cnb-nre-rules          (one card per rule, application order)
   *   │   └── div.cnb-nre-rule-card[data-rule-index]
   *   │       ├── div.cnb-nre-rule-head   (order no., name, move/remove)
   *   │       ├── div.cnb-nre-match       (PC / duration / key pills)
   *   │       └── div.cnb-nre-apply       (shape / hollow / color / off-key mark)
   *   ├── button.cnb-nre-rule-add
   *   ├── div.cnb-nre-resolved       (live resolveNotehead strip, per PC)
   *   └── div.cnb-nre-validation     (CNBConfig.validate pass-through)
   *
   * Events are wired as element properties (onclick/oninput/onchange) so the
   * editor is fully drivable in Node tests via a stub document.
   *
   * @param {HTMLElement} container
   * @param {{config?:object, onChange?:(slices:{noteheadRules:object[]}, state:object)=>void}} [opts]
   *        `config` seeds the editor state, supplies the shape and duration
   *        vocabularies, and is the base for the validation pass-through
   *        (defaults to CNBConfig.createDefault()).
   * @returns {{root:HTMLElement, getState:()=>object, getRules:()=>object[],
   *            applyTo:(config:object)=>object, setState:(partial:object)=>void,
   *            redraw:()=>void}}
   */
  render(container, opts = {}) {
    const doc = globalThis.document;
    const baseConfig = opts.config ? CNBConfig.clone(opts.config) : CNBConfig.createDefault();
    const state = CNBNoteheadRuleEditor.stateFromConfig(baseConfig);
    const onChange = opts.onChange || (() => {});

    const shapeNames = Object.keys(baseConfig.shapes || {});
    const durNames = durationNames(baseConfig);
    const keyVocab = keyNames(baseConfig);
    // xOffsetStaffSpaces is axis-gated (design §3.2): the row is offered
    // only while the pitch axis is enabled, or to a rule that already sets
    // it (so a loaded value stays visible and removable).
    const axisEnabled = !!(baseConfig.pitchAxis && baseConfig.pitchAxis.enabled);
    // Per-rule "Keep aspect ratio" lock (session 22): editor-only, not
    // config data; a rule with no entry is locked.
    const sizeLocks = new WeakMap();

    // Pill vocabulary for a name-list dimension: the config's definitions
    // plus any names already selected on the rule (union), so names loaded
    // from a config that lacks their definition stay editable.
    const nameVocab = (vocab, current) =>
      [...new Set([...vocab, ...(current === "all" ? [] : current)])];

    const root = doc.createElement("div");
    root.className = "cnb-notehead-rule-editor";

    const el = (tag, className, text) => {
      const e = doc.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };

    const checkedFrom = (e, input) =>
      e && e.target && e.target.checked !== undefined ? !!e.target.checked : !!input.checked;

    const valueFrom = (e, input) =>
      (e && e.target && e.target.value !== undefined) ? e.target.value : input.value;

    const emit = () => {
      onChange({ noteheadRules: CNBNoteheadRuleEditor.buildRules(state) }, deepClone(state));
    };

    const changed = () => {
      redraw();
      emit();
    };

    // ── Match pills (shared between PC and duration dimensions) ──────────
    // `get()` returns "all" or an array; `set(next)` writes it back.
    // Clicking "All" selects the all-matcher; clicking a value pill while
    // "all" is active switches to an explicit list of everything except the
    // clicked value ("all except this" — the least surprising narrowing).
    function matchPills(cssPrefix, values, labels, get, set) {
      const wrap = el("span", cssPrefix + "s cnb-nre-pills");
      const current = get();
      const isAll = current === "all";

      const allPill = el("button", "cnb-nre-all-pill" + (isAll ? " on" : ""), "All");
      allPill.type = "button";
      allPill.setAttribute("data-value", "all");
      allPill.onclick = () => { if (get() !== "all") { set("all"); changed(); } };
      wrap.appendChild(allPill);

      values.forEach((value, i) => {
        const on = isAll || current.includes(value);
        const pill = el("button", cssPrefix + (on ? " on" : ""), labels[i]);
        pill.type = "button";
        pill.setAttribute("data-value", String(value));
        pill.onclick = () => {
          const cur = get();
          if (cur === "all") {
            set(values.filter(v => v !== value));
          } else {
            const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
            set(typeof value === "number" ? next.sort((a, b) => a - b) : next);
          }
          changed();
        };
        wrap.appendChild(pill);
      });
      return wrap;
    }

    // ── Apply-property row: enable checkbox + a control when enabled ─────
    function applyRow(cssName, labelText, enabled, onToggle, buildControl) {
      const row = el("div", "cnb-nre-apply-row " + cssName + (enabled ? " enabled" : ""));
      const label = el("label", "cnb-nre-apply-toggle");
      const cb = el("input", cssName + "-check cnb-nre-apply-check");
      cb.type = "checkbox";
      cb.checked = enabled;
      cb.onchange = (e) => { onToggle(checkedFrom(e, cb)); changed(); };
      label.appendChild(cb);
      label.appendChild(el("span", "cnb-nre-apply-name", labelText));
      row.appendChild(label);
      if (enabled) row.appendChild(buildControl());
      return row;
    }

    function drawRuleCard(rule, idx, total) {
      const card = el("div", "cnb-nre-rule-card");
      card.setAttribute("data-rule-index", String(idx));

      // ── Header: order number, name, move/remove ──
      const head = el("div", "cnb-nre-rule-head");
      head.appendChild(el("span", "cnb-nre-rule-num", String(idx + 1)));

      const name = el("input", "cnb-nre-rule-name");
      name.type = "text";
      name.value = rule.name;
      name.title = "Rule name";
      name.oninput = (e) => {
        // Name edits don't change resolution — update state and notify
        // without a redraw so typing keeps focus in the real DOM.
        rule.name = valueFrom(e, name);
        onChange({ noteheadRules: CNBNoteheadRuleEditor.buildRules(state) }, deepClone(state));
      };
      head.appendChild(name);

      const up = el("button", "cnb-nre-rule-up", "▲");
      up.type = "button";
      up.title = "Apply earlier (later rules override earlier ones)";
      up.disabled = idx === 0;
      up.onclick = () => {
        if (idx > 0) {
          [state.rules[idx - 1], state.rules[idx]] = [state.rules[idx], state.rules[idx - 1]];
          changed();
        }
      };
      head.appendChild(up);

      const down = el("button", "cnb-nre-rule-down", "▼");
      down.type = "button";
      down.title = "Apply later (later rules override earlier ones)";
      down.disabled = idx === total - 1;
      down.onclick = () => {
        if (idx < state.rules.length - 1) {
          [state.rules[idx], state.rules[idx + 1]] = [state.rules[idx + 1], state.rules[idx]];
          changed();
        }
      };
      head.appendChild(down);

      const remove = el("button", "cnb-nre-rule-remove", "×");
      remove.type = "button";
      remove.title = "Remove rule";
      remove.onclick = () => { state.rules.splice(idx, 1); changed(); };
      head.appendChild(remove);

      card.appendChild(head);

      // ── Match section ──
      const match = el("div", "cnb-nre-match");
      const pcRow = el("div", "cnb-nre-match-row cnb-nre-match-pcs-row");
      pcRow.appendChild(el("span", "cnb-nre-match-label", "Pitch classes"));
      pcRow.appendChild(matchPills(
        "cnb-nre-pc-pill",
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        PC_LABELS,
        () => rule.match.pitchClasses,
        (v) => { rule.match.pitchClasses = v; },
      ));
      match.appendChild(pcRow);

      const durRow = el("div", "cnb-nre-match-row cnb-nre-match-durs-row");
      durRow.appendChild(el("span", "cnb-nre-match-label", "Durations"));
      const durValues = nameVocab(durNames, rule.match.durations);
      durRow.appendChild(matchPills(
        "cnb-nre-dur-pill",
        durValues,
        durValues,
        () => rule.match.durations,
        (v) => { rule.match.durations = v; },
      ));
      match.appendChild(durRow);

      const keyRow = el("div", "cnb-nre-match-row cnb-nre-match-keys-row");
      keyRow.appendChild(el("span", "cnb-nre-match-label", "Keys"));
      const keyValues = nameVocab(keyVocab, rule.match.keys);
      keyRow.appendChild(matchPills(
        "cnb-nre-key-pill",
        keyValues,
        keyValues,
        () => rule.match.keys,
        (v) => { rule.match.keys = v; },
      ));
      if (keyValues.length === 0) {
        keyRow.appendChild(el("span", "cnb-nre-keys-note",
          "No keys defined in config.keys.definitions — nothing to narrow to yet"));
      }
      match.appendChild(keyRow);
      card.appendChild(match);

      // ── Apply section (sparse — unset properties inherit) ──
      const apply = el("div", "cnb-nre-apply");
      apply.appendChild(el("div", "cnb-nre-apply-hint",
        "Properties this rule sets. Unset properties inherit from earlier matching rules."));

      apply.appendChild(applyRow("cnb-nre-apply-shape", "Shape",
        rule.apply.shape !== undefined,
        (on) => {
          if (on) rule.apply.shape = shapeNames[0];
          else delete rule.apply.shape;
        },
        () => {
          const sel = el("select", "cnb-nre-shape-select");
          for (const s of shapeNames) {
            const o = el("option", null, (baseConfig.shapes[s].displayName || s));
            o.value = s;
            if (s === rule.apply.shape) o.selected = true;
            sel.appendChild(o);
          }
          sel.value = rule.apply.shape;
          sel.onchange = (e) => { rule.apply.shape = valueFrom(e, sel); changed(); };
          return sel;
        }));

      apply.appendChild(applyRow("cnb-nre-apply-hollow", "Hollow",
        rule.apply.hollow !== undefined,
        (on) => {
          if (on) rule.apply.hollow = true;
          else delete rule.apply.hollow;
        },
        () => {
          const sel = el("select", "cnb-nre-hollow-select");
          for (const [value, text] of [["hollow", "Hollow cutout"], ["solid", "Solid fill"]]) {
            const o = el("option", null, text);
            o.value = value;
            if ((value === "hollow") === !!rule.apply.hollow) o.selected = true;
            sel.appendChild(o);
          }
          sel.value = rule.apply.hollow ? "hollow" : "solid";
          sel.onchange = (e) => { rule.apply.hollow = valueFrom(e, sel) === "hollow"; changed(); };
          return sel;
        }));

      apply.appendChild(applyRow("cnb-nre-apply-color", "Color",
        rule.apply.color !== undefined,
        (on) => {
          if (on) rule.apply.color = null;      // palette mode by default
          else delete rule.apply.color;
        },
        () => {
          const wrap = el("span", "cnb-nre-color-control");
          const mode = el("select", "cnb-nre-color-mode");
          for (const [value, text] of [["palette", "From palette"], ["custom", "Custom hex"]]) {
            const o = el("option", null, text);
            o.value = value;
            if ((value === "custom") === (rule.apply.color !== null)) o.selected = true;
            mode.appendChild(o);
          }
          mode.value = rule.apply.color === null ? "palette" : "custom";
          mode.onchange = (e) => {
            rule.apply.color = valueFrom(e, mode) === "palette" ? null : "#000000";
            changed();
          };
          wrap.appendChild(mode);
          if (rule.apply.color !== null) {
            const color = el("input", "cnb-nre-color-input");
            color.type = "color";
            color.value = rule.apply.color;
            // `input` only emits: a redraw would close the open picker.
            // Closing it (`change`) redraws (session 21).
            color.oninput = (e) => { rule.apply.color = valueFrom(e, color); emit(); };
            color.onchange = (e) => { rule.apply.color = valueFrom(e, color); changed(); };
            wrap.appendChild(color);
          }
          return wrap;
        }));

      apply.appendChild(applyRow("cnb-nre-apply-mark", "Off-key mark",
        rule.apply.offKeyMark !== undefined,
        (on) => {
          if (on) rule.apply.offKeyMark = false;   // explicit "no mark"
          else delete rule.apply.offKeyMark;
        },
        () => {
          const wrap = el("span", "cnb-nre-mark-control");
          const mode = el("select", "cnb-nre-mark-mode");
          for (const [value, text] of [["none", "No mark"], ["mark", "Mark identifier"]]) {
            const o = el("option", null, text);
            o.value = value;
            if ((value === "mark") === (rule.apply.offKeyMark !== false)) o.selected = true;
            mode.appendChild(o);
          }
          mode.value = rule.apply.offKeyMark === false ? "none" : "mark";
          mode.onchange = (e) => {
            // "cross" is a placeholder identifier the user edits — the same
            // seed-then-edit pattern as the custom-color control's #000000.
            rule.apply.offKeyMark = valueFrom(e, mode) === "none" ? false : "cross";
            changed();
          };
          wrap.appendChild(mode);
          if (rule.apply.offKeyMark !== false) {
            const input = el("input", "cnb-nre-mark-input");
            input.type = "text";
            input.value = rule.apply.offKeyMark;
            input.title = "Off-key mark identifier";
            input.oninput = (e) => {
              // Like name edits: update state and notify without a redraw so
              // typing keeps focus. While the identifier is transiently
              // invalid (empty), buildRules throws — hold the notification
              // rather than emitting or silently repairing; the strips
              // surface the error on the next redraw.
              rule.apply.offKeyMark = valueFrom(e, input);
              let slice;
              try {
                slice = CNBNoteheadRuleEditor.buildRules(state);
              } catch (_) {
                return;
              }
              onChange({ noteheadRules: slice }, deepClone(state));
            };
            wrap.appendChild(input);
          }
          return wrap;
        }));

      if (axisEnabled || rule.apply.xOffsetStaffSpaces !== undefined) {
        apply.appendChild(applyRow("cnb-nre-apply-xoffset", "Horizontal offset (staff spaces)",
          rule.apply.xOffsetStaffSpaces !== undefined,
          (on) => {
            if (on) rule.apply.xOffsetStaffSpaces = 0;
            else delete rule.apply.xOffsetStaffSpaces;
          },
          () => {
            const input = el("input", "cnb-nre-xoffset-input");
            input.type = "number";
            input.step = "any";
            input.value = String(rule.apply.xOffsetStaffSpaces);
            input.title = "Shift right (positive) or left (negative) to tell apart pitch classes that share a staff position";
            input.onchange = (e) => {
              const v = parseFloat(valueFrom(e, input));
              if (Number.isFinite(v)) { rule.apply.xOffsetStaffSpaces = v; changed(); }
            };
            return input;
          }));
      }

      // Size (session 22): height and width in semitones. "Keep aspect
      // ratio" (editor-only, on by default) makes the width follow the
      // height at the shape's natural ratio; off, the width is free.
      const sizeShape = baseConfig.shapes?.[rule.apply.shape] || baseConfig.shapes?.[shapeNames[0]];
      const ratio = sizeShape ? sizeShape.naturalWidth / sizeShape.naturalHeight : 1;
      const ownHeight = sizeShape ? sizeShape.semitoneHeight : 1;
      const round4 = (v) => Math.round(v * 10000) / 10000;
      apply.appendChild(applyRow("cnb-nre-apply-size", "Size (semitones)",
        rule.apply.heightSemis !== undefined || rule.apply.widthSemis !== undefined,
        (on) => {
          if (on) {
            rule.apply.heightSemis = ownHeight;
            rule.apply.widthSemis = round4(ownHeight * ratio);
          } else {
            delete rule.apply.heightSemis;
            delete rule.apply.widthSemis;
          }
        },
        () => {
          const wrap = el("span", "cnb-nre-size");
          const locked = sizeLocks.get(rule) ?? true;
          const sizeInput = (cls, label, value) => {
            const input = el("input", cls);
            input.type = "number";
            input.min = "0.25";
            input.max = "4";
            input.step = "0.05";
            input.value = value === undefined ? "" : String(value);
            input.title = `${label} in semitones (0.25–4)`;
            return input;
          };
          const height = sizeInput("cnb-nre-size-height", "Height", rule.apply.heightSemis);
          height.placeholder = String(round4(ownHeight));
          height.onchange = (e) => {
            const v = parseFloat(valueFrom(e, height));
            if (!(Number.isFinite(v) && v > 0)) return;
            rule.apply.heightSemis = v;
            if (sizeLocks.get(rule) ?? true) rule.apply.widthSemis = round4(v * ratio);
            changed();
          };
          const width = sizeInput("cnb-nre-size-width", "Width", rule.apply.widthSemis);
          width.placeholder = String(round4(ownHeight * ratio));
          width.disabled = locked;
          width.onchange = (e) => {
            const v = parseFloat(valueFrom(e, width));
            if (Number.isFinite(v) && v > 0) { rule.apply.widthSemis = v; changed(); }
          };
          const lockLabel = el("label", "cnb-nre-size-lock-label");
          const lock = el("input", "cnb-nre-size-lock");
          lock.type = "checkbox";
          lock.checked = locked;
          lock.onchange = (e) => {
            const on = checkedFrom(e, lock);
            sizeLocks.set(rule, on);
            // Turning the lock back on puts the width back on the ratio.
            if (on && rule.apply.heightSemis !== undefined) {
              rule.apply.widthSemis = round4(rule.apply.heightSemis * ratio);
              changed();
            } else {
              redraw();
            }
          };
          lockLabel.appendChild(lock);
          lockLabel.appendChild(el("span", null, "Keep aspect ratio"));
          wrap.appendChild(el("span", "cnb-nre-size-label", "Height"));
          wrap.appendChild(height);
          wrap.appendChild(el("span", "cnb-nre-size-label", "Width"));
          wrap.appendChild(width);
          wrap.appendChild(el("span", "cnb-nre-size-hint",
            `natural width ${round4(ownHeight * ratio)} at height ${round4(ownHeight)}`));
          wrap.appendChild(lockLabel);
          return wrap;
        }));

      card.appendChild(apply);
      return card;
    }

    function drawRules() {
      const wrap = el("div", "cnb-nre-rules");
      wrap.appendChild(el("div", "cnb-nre-title",
        "Notehead rules — applied top to bottom; later rules override earlier ones"));
      state.rules.forEach((rule, idx) => {
        wrap.appendChild(drawRuleCard(rule, idx, state.rules.length));
      });
      return wrap;
    }

    function drawAddButton() {
      const add = el("button", "cnb-nre-rule-add", "+ Add rule");
      add.type = "button";
      add.onclick = () => {
        state.rules.push({
          name: `Rule ${state.rules.length + 1}`,
          match: { pitchClasses: "all", durations: "all", keys: "all" },
          apply: {},
        });
        changed();
      };
      return add;
    }

    // ── Resolved strip: CNBConfig.resolveNotehead per PC, live ───────────
    function drawResolved() {
      const wrap = el("div", "cnb-nre-resolved");
      const head = el("div", "cnb-nre-resolved-head");
      head.appendChild(el("span", "cnb-nre-title", "Resolved per pitch class"));

      const durSel = el("select", "cnb-nre-resolved-duration");
      for (const d of durNames) {
        const o = el("option", null, d);
        o.value = d;
        if (d === state.previewDuration) o.selected = true;
        durSel.appendChild(o);
      }
      durSel.value = state.previewDuration;
      durSel.title = "Duration to resolve for";
      durSel.onchange = (e) => { state.previewDuration = valueFrom(e, durSel); changed(); };
      head.appendChild(durSel);

      const keySel = el("select", "cnb-nre-resolved-key");
      const noKey = el("option", null, "(no key)");
      noKey.value = "";
      if (state.previewKey === null) noKey.selected = true;
      keySel.appendChild(noKey);
      for (const k of keyVocab) {
        const o = el("option", null, k);
        o.value = k;
        if (k === state.previewKey) o.selected = true;
        keySel.appendChild(o);
      }
      keySel.value = state.previewKey === null ? "" : state.previewKey;
      keySel.title = "Key context to resolve for";
      keySel.onchange = (e) => {
        const v = valueFrom(e, keySel);
        state.previewKey = v === "" ? null : v;
        changed();
      };
      head.appendChild(keySel);
      wrap.appendChild(head);

      let resolved;
      try {
        resolved = CNBNoteheadRuleEditor.resolveAll(
          CNBNoteheadRuleEditor.applyToConfig(baseConfig, state),
          state.previewDuration, state.previewKey);
      } catch (err) {
        wrap.appendChild(el("div", "cnb-nre-error", "Editor state error: " + err.message));
        return wrap;
      }

      const row = el("div", "cnb-nre-resolved-row");
      for (const r of resolved) {
        const cell = el("div", "cnb-nre-resolved-cell");
        cell.setAttribute("data-pc", String(r.pc));
        cell.appendChild(el("div", "cnb-nre-resolved-pc", r.label));
        const shape = baseConfig.shapes[r.shape];
        cell.appendChild(el("div", "cnb-nre-resolved-shape",
          shape ? (shape.displayName || r.shape) : (r.shape ? r.shape + " (missing)" : "—")));
        cell.appendChild(el("div", "cnb-nre-resolved-fill", r.hollow ? "hollow" : "solid"));
        const mark = el("div", "cnb-nre-resolved-mark",
          r.offKeyMark === false ? "no mark" : "mark: " + r.offKeyMark);
        mark.setAttribute("data-mark", String(r.offKeyMark));
        cell.appendChild(mark);
        const swatch = el("div", "cnb-nre-resolved-swatch");
        swatch.setAttribute("data-color", r.effectiveColor);
        swatch.title = r.color === null
          ? `palette → ${r.effectiveColor}`
          : `rule color ${r.effectiveColor}`;
        if (swatch.style) swatch.style.background = r.effectiveColor;
        cell.appendChild(swatch);
        row.appendChild(cell);
      }
      wrap.appendChild(row);
      return wrap;
    }

    // ── Validation pass-through (Module A) ───────────────────────────────
    function drawValidation() {
      const wrap = el("div", "cnb-nre-validation");
      let result;
      try {
        result = CNBConfig.validate(CNBNoteheadRuleEditor.applyToConfig(baseConfig, state));
      } catch (err) {
        wrap.appendChild(el("div", "cnb-nre-error", "Editor state error: " + err.message));
        return wrap;
      }
      if (result.valid) {
        wrap.appendChild(el("div", "cnb-nre-valid", "Config valid ✓"));
      }
      for (const msg of result.errors) {
        wrap.appendChild(el("div", "cnb-nre-error", msg));
      }
      for (const msg of result.warnings) {
        wrap.appendChild(el("div", "cnb-nre-warning", msg));
      }
      return wrap;
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      root.appendChild(drawRules());
      root.appendChild(drawAddButton());
      root.appendChild(drawResolved());
      root.appendChild(drawValidation());
    }

    redraw();
    container.appendChild(root);

    return {
      root,
      getState: () => deepClone(state),
      getRules: () => CNBNoteheadRuleEditor.buildRules(state),
      applyTo: (config) => CNBNoteheadRuleEditor.applyToConfig(config, state),
      setState: (partial) => { Object.assign(state, deepClone(partial)); changed(); },
      redraw,
    };
  },

  /**
   * Render a live resolved-notehead preview row for a config: one cell per
   * pitch class, each drawing the PC's resolved notehead through Module 6
   * (shape, hollow, effective color) with its label underneath. This is the
   * visual companion to the editor's textual resolved strip — the same
   * CNBConfig.resolveNotehead output, drawn as actual noteheads.
   *
   * @param {HTMLElement} host  container the row is appended to
   * @param {object} config     full CNB config (rules already applied)
   * @param {{duration?:string, key?:string|null, pxPerSemi?:number,
   *          cellWidth?:number}} [opts]
   * @returns {{row:HTMLElement,
   *            cells:Array<{pc:number, resolved:object, svg:SVGElement|null}>}}
   */
  renderResolvedPreview(host, config, opts = {}) {
    const doc = globalThis.document;
    const NS = "http://www.w3.org/2000/svg";

    const duration = opts.duration || durationNames(config)[0] || "crotchet";
    const pxPerSemi = opts.pxPerSemi ?? ((config.display || {}).pxPerSemi || 16);
    const cellWidth = opts.cellWidth ?? Math.ceil(pxPerSemi * 4);
    const cellHeight = Math.ceil(pxPerSemi * 4);

    const resolved = CNBNoteheadRuleEditor.resolveAll(config, duration, opts.key ?? null);

    const row = doc.createElement("div");
    row.className = "cnb-nre-preview-row";

    const cells = resolved.map((r) => {
      const cell = doc.createElement("div");
      cell.className = "cnb-nre-preview-cell";
      cell.setAttribute("data-pc", String(r.pc));

      const shape = (config.shapes || {})[r.shape];
      let svg = null;
      if (shape) {
        svg = doc.createElementNS(NS, "svg");
        svg.setAttribute("class", "cnb-nre-preview-notehead");
        svg.setAttribute("width", String(cellWidth));
        svg.setAttribute("height", String(cellHeight));
        // Drawn at the resolved size (session 22).
        const { scaleFactor, scaleX, scaleY } = CNBNotehead.measure(shape, pxPerSemi, r);
        CNBNotehead.render(svg, {
          shape,
          x: cellWidth / 2,
          y: cellHeight / 2,
          scaleFactor,
          scaleX,
          scaleY,
          hollow: r.hollow,
          color: r.effectiveColor,
        });
        cell.appendChild(svg);
      } else {
        const missing = doc.createElement("div");
        missing.className = "cnb-nre-preview-missing";
        missing.textContent = r.shape ? `missing shape "${r.shape}"` : "no shape";
        cell.appendChild(missing);
      }

      const label = doc.createElement("div");
      label.className = "cnb-nre-preview-label";
      label.textContent = r.label;
      cell.appendChild(label);

      // Effective off-key mark, as text — the mark's visual treatment is
      // deferred (plan §11.4), so the preview shows the resolved identifier.
      if (r.offKeyMark !== false) {
        const mark = doc.createElement("div");
        mark.className = "cnb-nre-preview-mark";
        mark.textContent = "mark: " + r.offKeyMark;
        cell.appendChild(mark);
      }

      row.appendChild(cell);
      return { pc: r.pc, resolved: r, svg };
    });

    host.appendChild(row);
    return { row, cells };
  },
};
