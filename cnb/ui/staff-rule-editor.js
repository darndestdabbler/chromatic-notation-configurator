/**
 * staff-rule-editor.js — Module 13: Staff/Ledger Rule Editor
 *
 * Ports the legacy "Staff rules panel" (`chromatic-configurator.html`
 * STAFF PANEL + EditPopup._buildStaffForm + renderStaffCard, and the derived
 * panel driven by `configurator-core.js` deriveSemitonesPerStaffSpace)
 * onto the Module A config schema (architecture plan §4.3–4.4). The legacy
 * files were removed in 1.0.0 and are preserved at git tag
 * `legacy-monolith-final`.
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
 *     Here the derived panel uses the formula
 *     2 × (S - midpoint) / semitonesPerStaffSpace over octaves 0–1
 *     (half-staff-space units, LY spec §5.1 — the ×2 is the 007-s2 D2 fix;
 *     plan §4.3 originally omitted it), which is exactly Module 11's
 *     linear computeStaffLinePositions() (parity is unit-tested). The
 *     derived PANEL reads the full config the editor produces, so under a
 *     pitch axis it shows the axis unit the export uses (audit 2026-11-02,
 *     L1); since session 26 it shows the staff spacing and the middle of
 *     the staff in a designer's words, not the LilyPond positions.
 *   - Ledger mode (session 26, design §1): "automatic" writes
 *     automaticTemplates(pattern), proximity templates where the staff's
 *     spacing continues past its lines, with the proximity rule on; a
 *     config opens in it only when its ledgers are exactly that, so
 *     opening and saving changes nothing. Anything else is "own" (My own
 *     rules), today's template list. Since session 28 the automatic spots
 *     follow the lines as the config's pitch axis places them (the nudges
 *     of the Pitch section), kept in the state as `pitchAxis`.
 *   - `staff.midpoint` is the center of the two-octave octave-chord card
 *     range (semis 0–24), i.e. 12, for every pattern — every preset (4-8,
 *     3-6-9, 2-4-6-8-10, 3-5-7-9) uses it and the card/stem modules assume it. That
 *     derived value (and the GCD sps) applies only when the pattern changes:
 *     while the pattern is the one loaded, the loaded midpoint and sps are
 *     kept, so a pitch-axis config (midpoint 7 for twinline-compact) is not
 *     moved by an unrelated edit (audit 2026-11-02, M4).
 *   - Legacy line styling lived in a shared named-styles table (App.styles).
 *     There is none now: the preview draws staff and ledger lines as the
 *     engine engraves them (session 34), so the editor emits no line style
 *     and a config's retired lineDefaults / lineOverrides are not carried.
 *
 * Editor state model (the render() UI edits this; all builds are pure):
 *   {
 *     patternKey:     "4-8" | "3-6-9" | "2-4-6-8-10" | "3-5-7-9" | "custom",
 *     customPattern:  number[],            // active when patternKey==="custom"
 *     loadedGeometry: { semitonePattern, midpoint, semitonesPerStaffSpace } | null,
 *                                          // kept while the pattern is unchanged
 *     templates:      [{ semiWithinOctave, triggerPCs, triggerMode }],
 *     proximityRule:  boolean,
 *     ledgerMode:     "automatic" | "own",  // automatic: templates from the pattern
 *     pitchAxis:      object | null,        // the config's, read only (places the automatic spots)
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
 * Dependencies: Module A (validation pass-through and config plumbing);
 * Module 24 for the derived panel's axis unit.
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
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";

// Pitch-class labels (kept inline like Module 12 so the editor core adds no
// dependency beyond Module A).
const PC_LABELS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** The two ledger modes (design §1, step 3) and what each one does. */
const LEDGER_MODES = {
  automatic: {
    label: "Automatic",
    description: "A ledger line can appear wherever the staff's spacing continues past its " +
      "lines, and shows when a notehead is closer to it than to any staff line.",
  },
  own: {
    label: "My own rules",
    description: "At each spot you add, a ledger line shows when one of the chosen notes is played.",
  },
};

/** The template trigger modes, in a designer's words. */
const TRIGGER_MODE_LABELS = {
  override: "when one of these is played",
  proximity: "when a note is near",
};

/**
 * Staff pattern presets. "4-8" is the default config's system; "3-6-9" is
 * the plan's worked alternative (gap systems exercise the no-hard-gate
 * ledger rules). "2-4-6-8-10" and "3-5-7-9" (session 32) complete the
 * evenly spaced staves centred on F♯: 4-8, 3-6-9 and 2-4-6-8-10 leave one
 * missing line, on C, while 3-5-7-9 puts C in a space. Anything else is
 * edited as "custom".
 */
const STAFF_PATTERN_PRESETS = {
  "4-8":   { title: "4–8",   description: "Two lines an octave, on E and G♯",          pattern: [4, 8] },
  "3-6-9": { title: "3–6–9", description: "Three lines an octave, on D♯, F♯ and A", pattern: [3, 6, 9] },
  "2-4-6-8-10": { title: "2–4–6–8–10", description: "Five lines an octave, on D, E, F♯, G♯ and A♯", pattern: [2, 4, 6, 8, 10] },
  "3-5-7-9": { title: "3–5–7–9", description: "Four lines an octave, on D♯, F, G and A", pattern: [3, 5, 7, 9] },
};

/** The parts render() can draw, in the order it draws them. */
const PARTS = ["staff", "ledgers"];

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

/** The pitch axis an editor state was loaded with (disabled when none). */
function axisOf(state) {
  return CNBPitchAxis.create({ staff: {}, pitchAxis: state.pitchAxis || undefined });
}

/** automaticTemplates under an enabled pitch axis (session 28). */
function axisAutomaticTemplates(cleaned, axis) {
  const TOL = 1e-3;
  const oct = axis.octaveStride;
  const space = axis.unitsPerStaffSpace;
  if (!(space > 0) || !(oct > 0)) return [];
  const pos = [...Array(12).keys()].map(pc => axis.positionOfSemi(pc));
  const same = (a, b) => {
    const d = (((a - b) % oct) + oct) % oct;
    return Math.min(d, oct - d) < TOL;
  };
  const lines = [];
  for (const s of cleaned) if (!lines.some(l => same(l, pos[s]))) lines.push(pos[s]);
  lines.sort((a, b) => a - b);
  const spots = [];
  lines.forEach((a, i) => {
    const b = i + 1 < lines.length ? lines[i + 1] : lines[0] + oct;
    for (let x = a + space; x < b - TOL; x += space) spots.push(x);
    for (let x = b - space; x > a + TOL; x -= space) spots.push(x);
  });
  const out = [];
  const taken = [];
  for (let pc = 0; pc < 12; pc++) {
    const p = pos[pc];
    if (lines.some(l => same(l, p)) || taken.some(t => same(t, p))) continue;
    if (!spots.some(x => same(x, p))) continue;
    taken.push(p);
    out.push({ semiWithinOctave: pc, triggerPCs: [], triggerMode: "proximity" });
  }
  return out;
}

export const CNBStaffRuleEditor = {

  STAFF_PATTERN_PRESETS,
  PC_LABELS,
  LEDGER_MODES,
  PARTS,

  /**
   * The Automatic ledger templates for a staff pattern (design §1, step 3):
   * a proximity template, with no trigger pitch classes, at every position
   * 0–11 that is not a staff line and whose distance from the first line
   * is a multiple of the staff spacing (derivedGeometry's), ascending. So
   * the staff's own spacing continues into its gaps and beyond its outer
   * lines: 4-8, 3-6-9 and 2-4-6-8-10 give C, 3-5-7-9 gives C♯ and B. An
   * empty pattern gives none.
   *
   * Under an enabled pitch axis (session 28) the spots follow the lines as
   * the axis places them: from each staff line, whole staff spacings
   * (axis.unitsPerStaffSpace) into the gap before the next line, cyclic
   * over the axis octave. Each spot gets one template, at the lowest pitch
   * class that sits there (within 0.001) and is not on a staff line.
   * Twinline, at stride 7 or in nudge form, gives C and A♯.
   * @param {number[]} pattern  semitone-within-octave positions (0–11)
   * @param {object} [axis]  a CNBPitchAxis; with none, or a disabled one,
   *                         the spots are as above
   * @returns {Array<{semiWithinOctave:number, triggerPCs:number[], triggerMode:"proximity"}>}
   */
  automaticTemplates(pattern, axis) {
    const cleaned = sanitizePattern(pattern);
    if (cleaned.length === 0) return [];
    if (axis && axis.enabled) return axisAutomaticTemplates(cleaned, axis);
    const sps = CNBStaffRuleEditor.derivedGeometry(cleaned).semitonesPerStaffSpace;
    const out = [];
    for (let p = 0; p < 12; p++) {
      if (!cleaned.includes(p) && (((p - cleaned[0]) % sps) + sps) % sps === 0) {
        out.push({ semiWithinOctave: p, triggerPCs: [], triggerMode: "proximity" });
      }
    }
    return out;
  },

  /**
   * The ledger mode a config's ledgers are in: "automatic" when its
   * templates are exactly automaticTemplates(pattern), in order, and the
   * proximity rule is on, so writing them back changes nothing; else "own".
   * Exactly means each loaded template has the same three fields and no
   * other: one missing triggerPCs, or carrying an extra field, is "own"
   * (session 26 review), so the next edit cannot silently rewrite it.
   * @param {number[]} pattern
   * @param {object} ledgers  config.ledgers
   * @param {object} [axis]   the config's CNBPitchAxis, as for automaticTemplates
   * @returns {"automatic"|"own"}
   */
  ledgerModeOf(pattern, ledgers, axis) {
    const l = ledgers || {};
    if (l.proximityRule === false) return "own";
    const auto = CNBStaffRuleEditor.automaticTemplates(pattern, axis);
    const loaded = Array.isArray(l.templates) ? l.templates : [];
    const exact = (t, a) => t !== null && typeof t === "object" && !Array.isArray(t) &&
      Object.keys(t).length === 3 && Array.isArray(t.triggerPCs) &&
      t.semiWithinOctave === a.semiWithinOctave &&
      t.triggerMode === a.triggerMode &&
      JSON.stringify(t.triggerPCs) === JSON.stringify(a.triggerPCs);
    return loaded.length === auto.length && loaded.every((t, i) => exact(t, auto[i]))
      ? "automatic" : "own";
  },

  /**
   * Derive staff geometry from a semitone-within-octave pattern.
   *
   * semitonesPerStaffSpace: GCD of consecutive pattern gaps including the
   * octave wrap-around (legacy Core.deriveSemitonesPerStaffSpace, ported
   * verbatim; 1 for degenerate patterns of fewer than 2 lines).
   * midpoint: 12 — center of the two-octave card range (see module header).
   * lyPositions: the Module 11 formula 2 × (S − midpoint) / sps over
   * octaves 0–1 — half-staff-space units per LY spec §5.1 (007-s2 D2).
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
      for (const s of cleaned) lyPositions.push(2 * (s + oct * 12 - midpoint) / sps);
    }
    lyPositions.sort((a, b) => a - b);

    return { semitonePattern: cleaned, midpoint, semitonesPerStaffSpace: sps, lyPositions };
  },

  /**
   * Build a ready `config.staff` slice (plan §4.3) from editor state.
   * Pure function; throws on invalid state rather than guessing.
   *
   * @param {object} state
   * @returns {object} config.staff object
   */
  buildStaff(state) {
    const geo = CNBStaffRuleEditor.derivedGeometry(patternOf(state));
    // Keep the loaded midpoint and sps while the pattern is the one they were
    // loaded with: an edit to anything else (even a colour) must not move the
    // staff. A pitch axis anchors on the midpoint (audit 2026-11-02, M4).
    const loaded = state.loadedGeometry;
    if (loaded && loaded.semitonePattern.length === geo.semitonePattern.length &&
        loaded.semitonePattern.every((p, i) => p === geo.semitonePattern[i])) {
      geo.midpoint = loaded.midpoint;
      geo.semitonesPerStaffSpace = loaded.semitonesPerStaffSpace;
    }
    return {
      semitonePattern: geo.semitonePattern,
      midpoint: geo.midpoint,
      semitonesPerStaffSpace: geo.semitonesPerStaffSpace,
    };
  },

  /**
   * Build a ready `config.ledgers` slice (plan §4.4) from editor state.
   * Template triggerPCs are deduped and sorted (many-to-one user input);
   * invalid positions or trigger modes throw. In the "automatic" ledger
   * mode the templates are automaticTemplates of the current pattern and
   * the proximity rule is on, whatever the state's template list holds.
   * @param {object} state
   * @returns {object} config.ledgers object
   */
  buildLedgers(state) {
    if (state.ledgerMode === "automatic") {
      return {
        templates: CNBStaffRuleEditor.automaticTemplates(patternOf(state), axisOf(state)),
        proximityRule: true,
      };
    }
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

    // The loaded staff geometry, kept by buildStaff while the pattern is
    // unchanged (M4). Absent when the config does not carry both values.
    const loadedGeometry = Number.isFinite(staff.midpoint) && Number.isFinite(staff.semitonesPerStaffSpace)
      ? { semitonePattern: pattern.slice(), midpoint: staff.midpoint,
          semitonesPerStaffSpace: staff.semitonesPerStaffSpace }
      : null;

    return {
      patternKey,
      customPattern: pattern.slice(),
      loadedGeometry,
      templates: (ledgers.templates || []).map(t => ({
        semiWithinOctave: t.semiWithinOctave,
        triggerPCs: sanitizePattern(t.triggerPCs || []),
        triggerMode: t.triggerMode,
      })),
      proximityRule: ledgers.proximityRule !== false,
      // The config's pitch axis, which places the Automatic spots
      // (session 28). The editor does not edit it.
      pitchAxis: config && config.pitchAxis ? deepClone(config.pitchAxis) : null,
      ledgerMode: CNBStaffRuleEditor.ledgerModeOf(pattern, ledgers, CNBPitchAxis.create(config || {})),
    };
  },

  /**
   * Render the staff/ledger rule editor into a container.
   *
   * Structure (all styling left to the host via class hooks), by part:
   *   div.cnb-staff-rule-editor
   *   ├── staff:     div.cnb-sre-pattern         (pattern options, Staff lines on pills)
   *   │              div.cnb-sre-derived         (staff spacing, middle of the staff; read-only)
   *   ├── ledgers:   div.cnb-sre-ledger-mode     (Automatic / My own rules)
   *   │              div.cnb-sre-ledgers         (My own rules only: template rows + add)
   *   │              label.cnb-sre-proximity     (My own rules, with a "when a note is near"
   *   │                                           rule or the rule off: proximityRule)
   *   └── div.cnb-sre-validation                 (CNBConfig.validate pass-through)
   * The lines have no look of their own to edit: the preview draws staff and
   * ledger lines as the engine does, and the export carries which ledgers
   * show (session 34), so nothing here is preview-only.
   *
   * Events are wired as element properties (onclick/oninput/onchange) so the
   * editor is fully drivable in Node tests via a stub document.
   *
   * @param {HTMLElement} container
   * @param {{config?:object, parts?:string[], onChange?:(slices:{staff:object,ledgers:object}, state:object)=>void}} [opts]
   *        `config` seeds the editor state and is the base for the validation
   *        pass-through (defaults to CNBConfig.createDefault()). `parts`
   *        (session 26) names what to draw, from PARTS ("staff", "ledgers";
   *        both by default, always in that order), so
   *        a host can mount the editor once per section; every mount still
   *        emits both whole slices from its own state.
   * @returns {{root:HTMLElement, getState:()=>object, getStaff:()=>object,
   *            getLedgers:()=>object, applyTo:(config:object)=>object,
   *            setState:(partial:object)=>void, redraw:()=>void}}
   */
  render(container, opts = {}) {
    const doc = globalThis.document;
    const baseConfig = opts.config ? CNBConfig.clone(opts.config) : CNBConfig.createDefault();
    const parts = new Set(opts.parts ?? PARTS);
    for (const p of parts) {
      if (!PARTS.includes(p)) {
        throw new Error(`Unknown staff editor part ${JSON.stringify(p)} (expected ${PARTS.join(", ")})`);
      }
    }
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

    const checkedFrom = (e, input) =>
      e && e.target && e.target.checked !== undefined ? !!e.target.checked : !!input.checked;

    const valueFrom = (e, input) =>
      (e && e.target && e.target.value !== undefined) ? e.target.value : input.value;

    const emit = () => {
      onChange(
        { staff: CNBStaffRuleEditor.buildStaff(state), ledgers: CNBStaffRuleEditor.buildLedgers(state) },
        deepClone(state)
      );
    };

    const changed = () => {
      redraw();
      emit();
    };

    const title = (text) => el("div", "cnb-sre-title", text);

    // ── Pattern section ──────────────────────────────────────────────────
    function drawPattern() {
      const wrap = el("div", "cnb-sre-section cnb-sre-pattern");
      wrap.appendChild(title("Pattern"));

      const option = (key, titleText, description) => {
        const opt = el("div", "cnb-sre-pattern-option" +
          (key === "custom" ? " cnb-sre-pattern-custom" : "") +
          (state.patternKey === key ? " selected" : ""));
        opt.setAttribute("data-pattern-key", key);
        opt.appendChild(el("span", "cnb-sre-pattern-title", titleText));
        opt.appendChild(el("span", "cnb-sre-pattern-desc", description));
        return opt;
      };

      const options = el("div", "cnb-sre-pattern-options");
      for (const [key, preset] of Object.entries(STAFF_PATTERN_PRESETS)) {
        const opt = option(key, preset.title, preset.description);
        opt.onclick = () => { state.patternKey = key; changed(); };
        options.appendChild(opt);
      }

      // Seed the custom pattern from the current effective pattern so
      // switching to Custom starts from what the user already sees.
      const toCustom = () => {
        if (state.patternKey !== "custom") {
          state.customPattern = patternOf(state);
          state.patternKey = "custom";
        }
      };
      const custom = option("custom", "Custom", "Choose the notes the lines sit on");
      custom.onclick = () => {
        if (state.patternKey !== "custom") { toCustom(); changed(); }
      };
      options.appendChild(custom);
      wrap.appendChild(options);

      // Staff lines on: always shown; a click on a preset's pills makes the
      // pattern custom, starting from the preset.
      wrap.appendChild(title("Staff lines on"));
      const current = patternOf(state);
      const pcs = el("div", "cnb-sre-custom-pcs");
      for (let pc = 0; pc < 12; pc++) {
        const on = current.includes(pc);
        const pill = el("button", "cnb-sre-pc-toggle" + (on ? " on" : ""), PC_LABELS[pc]);
        pill.type = "button";
        pill.setAttribute("data-pc", String(pc));
        pill.title = (on ? "Remove the line on " : "Add a line on ") + PC_LABELS[pc];
        pill.onclick = () => {
          toCustom();
          const set = new Set(state.customPattern || []);
          if (set.has(pc)) set.delete(pc); else set.add(pc);
          state.customPattern = [...set].sort((a, b) => a - b);
          changed();
        };
        pcs.appendChild(pill);
      }
      wrap.appendChild(pcs);
      return wrap;
    }

    // ── Derived panel (legacy staff-derived, exporter formula) ───────────
    function drawDerived() {
      const wrap = el("div", "cnb-sre-derived");
      const pattern = patternOf(state);
      if (pattern.length < 2) {
        wrap.appendChild(el("div", "cnb-sre-derived-error",
          "A staff needs at least 2 lines an octave."));
        return wrap;
      }
      // The geometry the export will carry: the full config this editor
      // produces, so the lines are right under a pitch axis too (audit
      // 2026-11-02, L1). Read-only here: the Pitch section edits them.
      let cfg;
      try {
        cfg = CNBStaffRuleEditor.applyToConfig(baseConfig, state);
      } catch (err) {
        wrap.appendChild(el("div", "cnb-sre-derived-error", "Editor state error: " + err.message));
        return wrap;
      }
      const axis = CNBPitchAxis.create(cfg);
      // Under a pitch axis the spacing is the Pitch section's, in semitones
      // (design §3.4: axis units × 12 / octave stride).
      wrap.appendChild(el("div", "cnb-sre-derived-row", axis.enabled
        ? "Staff spacing: " + Math.round(axis.unitsPerStaffSpace * 12 / axis.octaveStride * 1e4) / 1e4 +
          " semitones per staff space, set in the Pitch section"
        : "Staff spacing: " + cfg.staff.semitonesPerStaffSpace + " semitones per staff space"));
      const mid = cfg.staff.midpoint;
      wrap.appendChild(el("div", "cnb-sre-derived-row",
        "Middle of the staff: " +
        (Number.isInteger(mid) ? PC_LABELS[((mid % 12) + 12) % 12] + ", semitone " : "semitone ") + mid));
      return wrap;
    }

    // ── Ledger templates ─────────────────────────────────────────────────
    /** The Automatic / My own rules choice (design §1, step 3; §8.3). */
    function drawLedgerMode() {
      const wrap = el("div", "cnb-sre-section cnb-sre-ledger-mode");
      wrap.appendChild(title("Which ones show"));
      const group = el("div", "segmented cnb-sre-ledger-mode-options");
      for (const [mode, info] of Object.entries(LEDGER_MODES)) {
        const button = el("button", state.ledgerMode === mode ? "on" : "", info.label);
        button.type = "button";
        button.setAttribute("data-ledger-mode", mode);
        button.onclick = () => {
          if (state.ledgerMode === mode) return;
          // Either way the list starts from the automatic spots: switching
          // to My own rules edits them rather than starting from nothing.
          state.templates = CNBStaffRuleEditor.automaticTemplates(patternOf(state), axisOf(state));
          if (mode === "automatic") state.proximityRule = true;
          state.ledgerMode = mode;
          changed();
        };
        group.appendChild(button);
      }
      wrap.appendChild(group);
      wrap.appendChild(el("div", "cnb-sre-hint cnb-sre-ledger-mode-desc",
        LEDGER_MODES[state.ledgerMode === "automatic" ? "automatic" : "own"].description));
      return wrap;
    }

    function drawLedgers() {
      const wrap = el("div", "cnb-sre-section cnb-sre-ledgers");
      wrap.appendChild(title("My own rules"));

      (state.templates || []).forEach((t, idx) => {
        const row = el("div", "cnb-sre-template-row");
        row.setAttribute("data-template-index", String(idx));

        row.appendChild(el("span", "cnb-sre-template-at", "At"));
        const pos = el("select", "cnb-sre-template-pos");
        for (let pc = 0; pc < 12; pc++) {
          const o = el("option", null, PC_LABELS[pc]);
          o.value = String(pc);
          if (pc === t.semiWithinOctave) o.selected = true;
          pos.appendChild(o);
        }
        pos.value = String(t.semiWithinOctave);
        pos.title = "Where the ledger line sits, in every octave";
        pos.onchange = (e) => {
          const v = parseInt(valueFrom(e, pos), 10);
          if (Number.isInteger(v)) { t.semiWithinOctave = v; changed(); }
        };
        row.appendChild(pos);

        row.appendChild(el("span", "cnb-sre-template-show", "show a ledger line"));
        const mode = el("select", "cnb-sre-template-mode");
        for (const m of ["override", "proximity"]) {
          const o = el("option", null, TRIGGER_MODE_LABELS[m]);
          o.value = m;
          if (m === t.triggerMode) o.selected = true;
          mode.appendChild(o);
        }
        mode.value = t.triggerMode;
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
            ? "A ledger line shown when a note is near does not use these"
            : (on ? "Stop showing it for " : "Show it for ") + PC_LABELS[pc];
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
        remove.title = "Remove this ledger line";
        remove.onclick = () => { state.templates.splice(idx, 1); changed(); };
        row.appendChild(remove);

        wrap.appendChild(row);
      });

      const add = el("button", "cnb-sre-template-add", "+ Add a ledger line");
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
        "Show the ledger lines set to “when a note is near”"));
      return label;
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
      if (parts.has("staff")) {
        root.appendChild(drawPattern());
        root.appendChild(drawDerived());
      }
      if (parts.has("ledgers")) {
        root.appendChild(drawLedgerMode());
        if (state.ledgerMode !== "automatic") {
          root.appendChild(drawLedgers());
          // The proximity switch matters only to rules set to "when a note
          // is near", so it shows only when one is (or while it is off).
          if ((state.templates || []).some(t => t.triggerMode === "proximity") || !state.proximityRule) {
            root.appendChild(drawProximity());
          }
        }
      }
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
