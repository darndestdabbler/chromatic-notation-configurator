/**
 * cnb-staff-rule-editor-tests.js — Unit tests for Module 13
 * (Staff/Ledger Rule Editor)
 *
 * Covers the derived-geometry math (legacy GCD port + exporter-formula
 * parity with Module 11), the state → config.staff / config.ledgers builds,
 * the config → state inverse (round-tripped on every branch), Module A
 * validation pass-through, integration with Module 3 (staff positions) and
 * Module 5 (ledger resolution), the render() UI driven against a stub DOM,
 * and renderPreview() against the SVG stub.
 */

import { CNBStaffRuleEditor } from "../ui/staff-rule-editor.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBLedgerSet } from "../src/cnb-ledger-set.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBPitchModel } from "../ui/pitch-model.js";
import { readFileSync, readdirSync } from "node:fs";

/** The twinline-compact gallery config (pitch axis on, staff midpoint 7). */
function loadTwinlineCompact() {
  const text = readFileSync(new URL("../assets/examples/gallery/twinline-compact.json", import.meta.url), "utf8");
  const { config, validation } = CNBConfigIO.loadFromText(text);
  if (!validation.valid) throw new Error("fixture invalid: " + validation.errors.join("; "));
  return config;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqualArrays(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || "arrays differ"}: expected ${e}, got ${a}`);
}

function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch (_) { threw = true; }
  if (!threw) throw new Error(msg || "expected function to throw");
}

// ─── HTML DOM stub (element-property event wiring, textContent clearing) ────
// Same stub pattern as the Module 12 tests: supports createElement and
// createElementNS so render() and renderPreview() both run.

function makeHtmlStubElement(tag) {
  const el = {
    tag,
    attrs: {},
    children: [],
    style: {},
    className: "",
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    appendChild(child) { this.children.push(child); return child; },
  };
  let text = "";
  Object.defineProperty(el, "textContent", {
    get: () => text,
    set: (v) => { text = String(v); if (text === "") el.children.length = 0; },
  });
  return el;
}

function withDomStub(fn) {
  const had = "document" in globalThis;
  const prev = globalThis.document;
  globalThis.document = {
    createElement: (tag) => makeHtmlStubElement(tag),
    createElementNS: (_ns, tag) => makeHtmlStubElement(tag),
  };
  try {
    return fn(makeHtmlStubElement("div"));
  } finally {
    if (had) globalThis.document = prev;
    else delete globalThis.document;
  }
}

/** All descendants (depth-first) whose className includes the given token. */
function findAll(el, token) {
  const out = [];
  for (const child of el.children || []) {
    if (String(child.className || "").split(/\s+/).includes(token)) out.push(child);
    out.push(...findAll(child, token));
  }
  return out;
}

/** All descendants (depth-first) with a given attribute value. */
function findByAttr(el, attr, value) {
  const out = [];
  for (const child of el.children || []) {
    if (child.attrs && child.attrs[attr] === value) out.push(child);
    out.push(...findByAttr(child, attr, value));
  }
  return out;
}

const E = CNBStaffRuleEditor;

/** Editor state for the default 4-8 config. */
function defaultState() {
  return E.stateFromConfig(CNBConfig.createDefault());
}

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // ── derivedGeometry ──
  {
    // LY positions are half-staff-spaces from center (LY spec §5.1) — the
    // ×2 factor is the 007-s1 D2 fix, kept in parity with Module 11.
    name: "derivedGeometry: 4-8 → sps 4, midpoint 12, LY positions (-4 -2 2 4)",
    fn: () => {
      const g = E.derivedGeometry([4, 8]);
      assert(g.semitonesPerStaffSpace === 4, "sps");
      assert(g.midpoint === 12, "midpoint");
      assertEqualArrays(g.lyPositions, [-4, -2, 2, 4], "lyPositions");
    },
  },
  {
    name: "derivedGeometry: 3-6-9 → sps 3, LY positions (-6 -4 -2 2 4 6)",
    fn: () => {
      const g = E.derivedGeometry([3, 6, 9]);
      assert(g.semitonesPerStaffSpace === 3, "sps");
      assertEqualArrays(g.lyPositions, [-6, -4, -2, 2, 4, 6], "lyPositions");
    },
  },
  {
    name: "derivedGeometry: dedupes and sorts the input pattern",
    fn: () => {
      const g = E.derivedGeometry([8, 4, 8]);
      assertEqualArrays(g.semitonePattern, [4, 8], "pattern deduped+sorted");
      assert(g.semitonesPerStaffSpace === 4, "sps unaffected by dupes");
    },
  },
  {
    name: "derivedGeometry: throws on out-of-range or non-integer entries",
    fn: () => {
      assertThrows(() => E.derivedGeometry([4, 13]), "13 out of range");
      assertThrows(() => E.derivedGeometry([4, 1.5]), "non-integer");
      assertThrows(() => E.derivedGeometry([4, "8"]), "string entry");
      assertThrows(() => E.derivedGeometry("4,8"), "non-array");
    },
  },
  {
    name: "derivedGeometry: degenerate patterns (<2 lines) get sps 1, no throw",
    fn: () => {
      assert(E.derivedGeometry([5]).semitonesPerStaffSpace === 1, "single line");
      const empty = E.derivedGeometry([]);
      assert(empty.semitonesPerStaffSpace === 1, "empty");
      assertEqualArrays(empty.lyPositions, [], "no positions");
    },
  },
  {
    name: "derivedGeometry: LY positions match Module 11's computeStaffLinePositions",
    fn: () => {
      const config = CNBConfig.createDefault();
      for (const pattern of [[4, 8], [3, 6, 9], [2, 7]]) {
        const state = { ...defaultState(), patternKey: "custom", customPattern: pattern };
        const applied = E.applyToConfig(config, state);
        assertEqualArrays(
          E.derivedGeometry(pattern).lyPositions,
          CNBLilypond.computeStaffLinePositions(applied),
          `exporter parity for ${JSON.stringify(pattern)}`
        );
      }
    },
  },

  // ── buildStaff ──
  {
    name: "buildStaff: produces a schema-shaped staff slice with derived geometry",
    fn: () => {
      const s = E.buildStaff(defaultState());
      assertEqualArrays(s.semitonePattern, [4, 8], "pattern");
      assert(s.midpoint === 12 && s.semitonesPerStaffSpace === 4, "derived");
      assert(s.lineDefaults.thicknessPct === 20 && s.lineDefaults.color === "#000000", "defaults");
    },
  },
  {
    name: "buildStaff: copies lineDefaults (no shared reference with state)",
    fn: () => {
      const state = defaultState();
      const s = E.buildStaff(state);
      s.lineDefaults.thicknessPct = 99;
      assert(state.lineDefaults.thicknessPct === 20, "state untouched");
    },
  },
  {
    name: "buildStaff: prunes empty override entries, keeps populated ones",
    fn: () => {
      const state = defaultState();
      state.lineOverrides = { "4": { color: "#ff0000" }, "8": {} };
      const s = E.buildStaff(state);
      assert(s.lineOverrides["4"].color === "#ff0000", "kept");
      assert(!("8" in s.lineOverrides), "empty pruned");
    },
  },
  {
    name: "buildStaff: overrides for lines outside the active pattern are not emitted",
    fn: () => {
      const state = defaultState();
      state.lineOverrides = { "4": { color: "#ff0000" } };
      state.patternKey = "3-6-9";
      const s = E.buildStaff(state);
      assert(!("4" in s.lineOverrides), "semi 4 is not a 3-6-9 staff line");
      assert(Object.keys(s.lineOverrides).length === 0, "nothing else leaks");
    },
  },
  {
    name: "buildStaff: out-of-pattern overrides survive in state — switching back restores them",
    fn: () => {
      const state = defaultState();
      state.lineOverrides = { "4": { color: "#ff0000" } };
      state.patternKey = "3-6-9";
      assert(!("4" in E.buildStaff(state).lineOverrides), "hidden while 3-6-9");
      state.patternKey = "4-8";
      assert(E.buildStaff(state).lineOverrides["4"].color === "#ff0000", "restored on 4-8");
    },
  },
  {
    name: "buildStaff: unknown patternKey throws (no silent fallback)",
    fn: () => {
      const state = { ...defaultState(), patternKey: "5-10" };
      assertThrows(() => E.buildStaff(state), "unknown preset key");
    },
  },
  {
    name: "M4: editing twinline-compact's staff colour keeps midpoint 7 and sps; the pitch-axis export is byte-identical",
    fn: () => {
      const config = loadTwinlineCompact();
      const state = E.stateFromConfig(config);
      state.lineDefaults.color = "#ff0000";
      const edited = E.applyToConfig(config, state);
      // The staff slice differs only in the edited field.
      const expected = CNBConfig.clone(config.staff);
      expected.lineDefaults.color = "#ff0000";
      assert(JSON.stringify(edited.staff) === JSON.stringify(expected),
        "staff slice changed only in lineDefaults.color: " + JSON.stringify(edited.staff));
      assert(edited.staff.midpoint === 7 && edited.staff.semitonesPerStaffSpace === 4, "geometry kept");
      // Staff colour is preview-only, so the export does not change at all.
      assert(CNBLilypond.generate(edited) === CNBLilypond.generate(config), "pitch-axis export byte-identical");
    },
  },
  {
    name: "M4: changing the pattern re-derives midpoint and sps; switching back restores the loaded values",
    fn: () => {
      const state = E.stateFromConfig(loadTwinlineCompact());
      state.patternKey = "3-6-9";
      const derived = E.buildStaff(state);
      assert(derived.midpoint === 12 && derived.semitonesPerStaffSpace === 3, "derived for the new pattern");
      state.patternKey = "custom";   // customPattern still holds the loaded [2, 5, 6, 8, 9]
      const back = E.buildStaff(state);
      assert(back.midpoint === 7 && back.semitonesPerStaffSpace === 4, "loaded geometry restored");
    },
  },

  // ── buildLedgers ──
  {
    name: "buildLedgers: dedupes and sorts triggerPCs, keeps template order",
    fn: () => {
      const state = defaultState();
      state.templates = [
        { semiWithinOctave: 10, triggerPCs: [10, 10, 11, 0], triggerMode: "override" },
        { semiWithinOctave: 0, triggerPCs: [2, 0, 1], triggerMode: "override" },
      ];
      const l = E.buildLedgers(state);
      assertEqualArrays(l.templates[0].triggerPCs, [0, 10, 11], "deduped+sorted");
      assert(l.templates[0].semiWithinOctave === 10, "order preserved");
      assertEqualArrays(l.templates[1].triggerPCs, [0, 1, 2], "second template");
    },
  },
  {
    name: "buildLedgers: proximityRule is a boolean, defaults preserved",
    fn: () => {
      const state = defaultState();
      state.proximityRule = false;
      const l = E.buildLedgers(state);
      assert(l.proximityRule === false, "off");
      assert(l.lineDefaults.thicknessPct === 40 && l.lineDefaults.roundedEnds === true, "defaults");
    },
  },
  {
    name: "buildLedgers: throws on invalid position or trigger mode",
    fn: () => {
      const state = defaultState();
      state.templates = [{ semiWithinOctave: 12, triggerPCs: [0], triggerMode: "override" }];
      assertThrows(() => E.buildLedgers(state), "position 12");
      state.templates = [{ semiWithinOctave: 0, triggerPCs: [0], triggerMode: "always" }];
      assertThrows(() => E.buildLedgers(state), "bad mode");
    },
  },

  // ── automaticTemplates + ledger mode (session 26, design §1) ──
  {
    name: "automaticTemplates: the staff's spacing continued past its lines, as proximity templates",
    fn: () => {
      const at = (pattern) => E.automaticTemplates(pattern).map(t => t.semiWithinOctave);
      assertEqualArrays(at([4, 8]), [0], "4-8: spacing 4 continues to C");
      assertEqualArrays(at([3, 6, 9]), [0], "3-6-9: spacing 3 continues to C");
      assertEqualArrays(at([2, 6]), [10], "2-6: spacing 4 from D gives A♯");
      assertEqualArrays(at([0, 4, 8]), [], "0-4-8: every spot is already a line");
      assertEqualArrays(at([1, 7]), [], "1-7: spacing 6, both spots are lines");
      assertEqualArrays(at([0, 2, 7]), [1, 3, 4, 5, 6, 8, 9, 10, 11], "spacing 1: every other spot");
      assertEqualArrays(at([]), [], "no lines, no spots");
      for (const t of E.automaticTemplates([4, 8])) {
        assert(t.triggerMode === "proximity" && t.triggerPCs.length === 0, "proximity, no triggers");
      }
      assertEqualArrays(at([8, 4, 8]), [0], "input sorted and deduped");
    },
  },
  {
    name: "ledgerModeOf: automatic only for exactly the automatic templates, in order, with the proximity rule on",
    fn: () => {
      const auto = { templates: E.automaticTemplates([2, 6]), proximityRule: true };
      assert(E.ledgerModeOf([2, 6], auto) === "automatic", "exact match");
      assert(E.ledgerModeOf([2, 6], { ...auto, proximityRule: false }) === "own", "proximity off");
      assert(E.ledgerModeOf([4, 8], auto) === "own", "other pattern's spots");
      const withTriggers = { templates: [{ semiWithinOctave: 10, triggerPCs: [9], triggerMode: "proximity" }], proximityRule: true };
      assert(E.ledgerModeOf([2, 6], withTriggers) === "own", "triggers would be lost on write-back");
      assert(E.ledgerModeOf([0, 4, 8], { templates: [], proximityRule: true }) === "automatic", "no spots, none written");
      assert(E.ledgerModeOf([3, 6, 9], { templates: [], proximityRule: true }) === "own", "45deg-369: no ledgers is own");
      assert(defaultState().ledgerMode === "own", "the default config's override templates are own rules");
      const kite = JSON.parse(readFileSync(new URL("../fixtures/kite-4-369-config.json", import.meta.url), "utf8"));
      assert(E.stateFromConfig(kite).ledgerMode === "own", "Kite's override template is an own rule");
    },
  },
  {
    name: "ledgerModeOf: a template missing triggerPCs, or with an extra field, is own (session 26 review)",
    fn: () => {
      const eq = (a, b, msg) => assert(a === b, `${msg}: expected ${b}, got ${a}`);
      const exact = E.automaticTemplates([4, 8]);
      eq(JSON.stringify(exact), JSON.stringify([{ semiWithinOctave: 0, triggerPCs: [], triggerMode: "proximity" }]), "4-8 spots");
      const mode = (templates) => E.ledgerModeOf([4, 8], { templates, proximityRule: true });
      eq(mode(exact), "automatic", "the exact templates");
      eq(mode([{ triggerMode: "proximity", triggerPCs: [], semiWithinOctave: 0 }]), "automatic", "field order does not matter");
      eq(mode([{ semiWithinOctave: 0, triggerMode: "proximity" }]), "own", "triggerPCs missing");
      eq(mode([{ ...exact[0], note: "mine" }]), "own", "an extra field");
      eq(mode([{ ...exact[0], triggerPCs: null }]), "own", "triggerPCs not an array");
      eq(mode([...exact, ...exact]), "own", "a repeated template");

      // The same under a pitch axis: Twinline's exact spots are automatic,
      // the same spots with an extra field are not.
      const twinline = JSON.parse(readFileSync(
        new URL("../assets/examples/gallery/twinline-compact.json", import.meta.url), "utf8"));
      const axis = CNBPitchAxis.create(twinline);
      const pattern = twinline.staff.semitonePattern;
      const spots = E.automaticTemplates(pattern, axis);
      assert(spots.length > 0, "Twinline has automatic spots");
      eq(E.ledgerModeOf(pattern, { templates: spots, proximityRule: true }, axis), "automatic", "axis: exact");
      eq(E.ledgerModeOf(pattern, { templates: spots.map(t => ({ ...t, color: "#000000" })), proximityRule: true }, axis),
        "own", "axis: an extra field");
      eq(E.ledgerModeOf(pattern, { templates: spots.map(({ triggerPCs, ...t }) => t), proximityRule: true }, axis),
        "own", "axis: triggerPCs missing");
    },
  },
  {
    name: "automaticTemplates under a pitch axis: unchanged with no axis; an identity axis gives today's spots (every gallery pattern)",
    fn: () => {
      const dir = new URL("../assets/examples/gallery/", import.meta.url);
      const patterns = [[4, 8], [3, 6, 9]];
      for (const f of readdirSync(dir).filter(n => n.endsWith(".json"))) {
        const c = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
        if (!c.pitchAxis) patterns.push(c.staff.semitonePattern);
      }
      for (const pattern of patterns) {
        const today = JSON.stringify(E.automaticTemplates(pattern));
        const sps = E.derivedGeometry(pattern).semitonesPerStaffSpace;
        const linear = CNBPitchAxis.create({ staff: { semitonePattern: pattern, semitonesPerStaffSpace: sps } });
        assert(JSON.stringify(E.automaticTemplates(pattern, linear)) === today, `${pattern}: a disabled axis changes nothing`);
        const identity = CNBPitchAxis.create({ staff: {}, pitchAxis: {
          enabled: true, kind: "pitch-class-map-v1", octaveStride: 12, axisUnitsPerStaffSpace: sps,
          pitchClasses: [...Array(12).keys()].map(pc => ({ pc, position: pc })) } });
        assert(JSON.stringify(E.automaticTemplates(pattern, identity)) === today,
          `${pattern}: the identity axis gives today's spots, got ${JSON.stringify(E.automaticTemplates(pattern, identity))}`);
      }
    },
  },
  {
    name: "automaticTemplates under a pitch axis: Twinline gives C and A♯, at stride 7 and in nudge form (session 28)",
    fn: () => {
      const stride7 = loadTwinlineCompact();
      const r = CNBPitchModel.readNudges(stride7);
      const nudgeForm = CNBPitchModel.writeNudges(stride7, r.nudges, r.staffSpacing);
      for (const [name, cfg] of [["stride 7", stride7], ["nudge form", nudgeForm]]) {
        const templates = E.automaticTemplates(cfg.staff.semitonePattern, CNBPitchAxis.create(cfg));
        assertEqualArrays(templates.map(t => t.semiWithinOctave), [0, 10], `${name}: spots at C and A♯`);
        assert(templates.every(t => t.triggerMode === "proximity" && t.triggerPCs.length === 0), `${name}: proximity`);
        const automatic = { ...cfg, ledgers: { ...cfg.ledgers, templates, proximityRule: true } };
        const state = E.stateFromConfig(automatic);
        assert(state.ledgerMode === "automatic", `${name}: opens as Automatic`);
        assert(JSON.stringify(E.applyToConfig(automatic, state).ledgers.templates) === JSON.stringify(templates),
          `${name}: writes back unchanged`);
      }
      assert(E.stateFromConfig(stride7).ledgerMode === "own", "the fixture's override templates stay own rules");
    },
  },
  {
    name: "automatic mode: buildLedgers follows the pattern; a loaded automatic config writes back unchanged",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.ledgers.templates = E.automaticTemplates([4, 8]);
      const state = E.stateFromConfig(config);
      assert(state.ledgerMode === "automatic", "recognised on load");
      assert(JSON.stringify(E.applyToConfig(config, state).ledgers) === JSON.stringify(config.ledgers),
        "write-back is the loaded ledgers");
      state.patternKey = "custom";
      state.customPattern = [2, 6];
      const l = E.buildLedgers(state);
      assertEqualArrays(l.templates.map(t => t.semiWithinOctave), [10], "spots follow the new pattern");
      assert(l.proximityRule === true, "proximity on");
    },
  },

  // ── applyToConfig + validation pass-through ──
  {
    name: "applyToConfig: does not mutate the input config",
    fn: () => {
      const config = CNBConfig.createDefault();
      const state = defaultState();
      state.patternKey = "3-6-9";
      const before = JSON.stringify(config);
      E.applyToConfig(config, state);
      assert(JSON.stringify(config) === before, "input untouched");
    },
  },
  {
    name: "applyToConfig: default state produces a config that validates clean",
    fn: () => {
      const applied = E.applyToConfig(CNBConfig.createDefault(), defaultState());
      const v = CNBConfig.validate(applied);
      assert(v.valid, "valid: " + v.errors.join("; "));
    },
  },
  {
    name: "validation pass-through: 1-line custom pattern surfaces the Module A error",
    fn: () => {
      const state = { ...defaultState(), patternKey: "custom", customPattern: [4] };
      const applied = E.applyToConfig(CNBConfig.createDefault(), state);
      const v = CNBConfig.validate(applied);
      assert(!v.valid, "invalid");
      assert(v.errors.some(e => e.includes("at least 2")), "staff line count error");
    },
  },

  // ── stateFromConfig + round-trips ──
  {
    name: "stateFromConfig: default config → 4-8 preset, 3 templates, proximity on",
    fn: () => {
      const state = defaultState();
      assert(state.patternKey === "4-8", "preset recognized");
      assert(state.templates.length === 3, "templates");
      assert(state.proximityRule === true, "proximity");
      assertEqualArrays(state.customPattern, [4, 8], "customPattern seeded");
    },
  },
  {
    name: "stateFromConfig: recognizes 3-6-9 preset; unknown patterns open as custom",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.staff.semitonePattern = [3, 6, 9];
      assert(E.stateFromConfig(config).patternKey === "3-6-9", "3-6-9 recognized");
      config.staff.semitonePattern = [2, 7];
      const custom = E.stateFromConfig(config);
      assert(custom.patternKey === "custom", "custom branch");
      assertEqualArrays(custom.customPattern, [2, 7], "custom pattern kept");
    },
  },
  {
    name: "round-trip: preset branch (apply → recover → apply is stable)",
    fn: () => {
      const config = CNBConfig.createDefault();
      const state = defaultState();
      const applied = E.applyToConfig(config, state);
      const recovered = E.stateFromConfig(applied);
      assert(recovered.patternKey === "4-8", "preset survives");
      const applied2 = E.applyToConfig(config, recovered);
      assert(JSON.stringify(applied.staff) === JSON.stringify(applied2.staff), "staff stable");
      assert(JSON.stringify(applied.ledgers) === JSON.stringify(applied2.ledgers), "ledgers stable");
    },
  },
  {
    name: "round-trip: custom pattern branch",
    fn: () => {
      const state = { ...defaultState(), patternKey: "custom", customPattern: [1, 5, 9] };
      const applied = E.applyToConfig(CNBConfig.createDefault(), state);
      const recovered = E.stateFromConfig(applied);
      assert(recovered.patternKey === "custom", "custom survives");
      assertEqualArrays(recovered.customPattern, [1, 5, 9], "pattern");
      const applied2 = E.applyToConfig(CNBConfig.createDefault(), recovered);
      assert(JSON.stringify(applied.staff) === JSON.stringify(applied2.staff), "stable");
    },
  },
  {
    name: "round-trip: overrides, edited templates, and flags survive",
    fn: () => {
      const state = defaultState();
      state.lineOverrides = { "4": { thicknessPct: 35, style: "dashed", color: "#cc0000" } };
      state.templates = [{ semiWithinOctave: 5, triggerPCs: [5, 6], triggerMode: "proximity" }];
      state.proximityRule = false;
      state.ledgerDefaults.widthMultiplier = 3;
      const applied = E.applyToConfig(CNBConfig.createDefault(), state);
      const recovered = E.stateFromConfig(applied);
      assert(recovered.lineOverrides["4"].style === "dashed", "override");
      assert(recovered.templates[0].triggerMode === "proximity", "template mode");
      assert(recovered.proximityRule === false, "proximity flag");
      assert(recovered.ledgerDefaults.widthMultiplier === 3, "ledger defaults");
      const applied2 = E.applyToConfig(CNBConfig.createDefault(), recovered);
      assert(JSON.stringify(applied.ledgers) === JSON.stringify(applied2.ledgers), "stable");
    },
  },

  // ── Integration with Modules 3 and 5 ──
  {
    name: "integration: 3-6-9 state yields CNBStaff positions [3,6,9,15,18,21] over 0–24",
    fn: () => {
      const state = { ...defaultState(), patternKey: "3-6-9" };
      const applied = E.applyToConfig(CNBConfig.createDefault(), state);
      assertEqualArrays(
        CNBStaff.getPositions(applied, { minSemi: 0, maxSemi: 24 }),
        [3, 6, 9, 15, 18, 21],
        "positions"
      );
    },
  },
  {
    name: "integration: removing the C template stops CNBLedgerSet showing a ledger for C",
    fn: () => {
      const config = CNBConfig.createDefault();
      const range = { minSemi: 0, maxSemi: 24 };
      const staffPositions = [4, 8, 16, 20];

      const before = CNBLedgerSet.resolve(
        [0], CNBLedgerSet.buildDefs(config, range), staffPositions);
      assert(before.includes(0), "default config shows C ledger at 0");

      const state = defaultState();
      state.templates = state.templates.filter(t => t.semiWithinOctave !== 0);
      const applied = E.applyToConfig(config, state);
      const after = CNBLedgerSet.resolve(
        [0], CNBLedgerSet.buildDefs(applied, range), staffPositions);
      assert(!after.includes(0), "edited config no longer shows it");
    },
  },

  // ── render() UI against the DOM stub ──
  {
    name: "render: builds pattern options, derived panel, override rows, template rows, validation",
    fn: () => withDomStub((container) => {
      const handle = E.render(container, {});
      assert(handle.root.className === "cnb-staff-rule-editor", "root class");
      assert(findAll(handle.root, "cnb-sre-pattern-option").length === 3, "2 presets + custom");
      const derived = findAll(handle.root, "cnb-sre-derived-row");
      assert(derived.some(d => d.textContent === "Staff spacing: 4 semitones per staff space"), "staff spacing shown");
      assert(derived.some(d => d.textContent === "Middle of the staff: C, semitone 12"), "middle of the staff shown");
      assert(findAll(handle.root, "cnb-sre-override-row").length === 2, "one row per pattern line");
      assert(findAll(handle.root, "cnb-sre-template-row").length === 3, "default templates");
      assert(findAll(handle.root, "cnb-sre-valid").length === 1, "validation OK banner");
    }),
  },
  {
    name: "render L1: under a pitch axis the derived panel shows the export's axis unit and loaded midpoint (twinline-compact)",
    fn: () => withDomStub((container) => {
      const config = loadTwinlineCompact();
      const handle = E.render(container, { config });
      const rows = findAll(handle.root, "cnb-sre-derived-row").map(d => d.textContent);
      const exported = CNBLilypond.sectionB(config);
      assert(exported.includes("#(set! cnb:semitones-per-staff-space 2)"), "the export uses the axis unit");
      // 2 axis units at stride 7 are 12 / 3.5 semitones (design §3.4),
      // which the Pitch section sets (session 28).
      assert(rows.includes("Staff spacing: 3.4286 semitones per staff space, set in the Pitch section"),
        "axis spacing shown: " + JSON.stringify(rows));
      assert(rows.includes("Middle of the staff: G, semitone 7"), "loaded midpoint shown");
    }),
  },
  {
    name: "render: preview-only controls carry a Preview only badge with a tooltip, and no paragraph (M2, design §8.6)",
    fn: () => withDomStub((container) => {
      const handle = E.render(container, {});
      assert(findAll(handle.root, "cnb-sre-preview-only").length === 0, "no preview-only paragraphs");
      const badges = (token) => findAll(findAll(handle.root, token)
        .find(s => String(s.className).includes("cnb-sre-section")), "cnb-badge");
      // Staff lines: thickness, style and colour each carry one.
      assert(badges("cnb-sre-staff-defaults").length === 3, "a badge beside each staff line control");
      for (const token of ["cnb-sre-overrides", "cnb-sre-ledger-mode", "cnb-sre-ledger-defaults"]) {
        assert(badges(token).length === 1, `${token} carries one badge`);
      }
      for (const b of findAll(handle.root, "cnb-badge")) {
        assert(b.textContent === "Preview only", "badge text");
        assert(b.title.includes("not exported") && b.title.includes("LilyPond"), "tooltip: " + b.title);
      }
      assert(badges("cnb-sre-ledger-mode")[0].title.includes("ledger"), "the ledger badge names ledger lines");
    }),
  },
  {
    name: "render: clicking the 3-6-9 preset updates state, onChange slice, and derived panel",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      const opt = findByAttr(handle.root, "data-pattern-key", "3-6-9")[0];
      opt.onclick();
      assertEqualArrays(lastSlices.staff.semitonePattern, [3, 6, 9], "onChange staff slice");
      assert(lastSlices.staff.semitonesPerStaffSpace === 3, "derived sps in slice");
      const derived = findAll(handle.root, "cnb-sre-derived-row");
      assert(derived.some(d => d.textContent === "Staff spacing: 3 semitones per staff space"), "derived redrawn");
      assert(findAll(handle.root, "cnb-sre-override-row").length === 3, "override rows follow pattern");
    }),
  },
  {
    name: "render: custom pattern seeds from current preset; PC toggles edit it",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      findByAttr(handle.root, "data-pattern-key", "custom")[0].onclick();
      assertEqualArrays(handle.getState().customPattern, [4, 8], "seeded from 4-8");
      const pills = findAll(handle.root, "cnb-sre-pc-toggle");
      assert(pills.length === 12, "12 PC toggles");
      pills[0].onclick();   // add C
      assertEqualArrays(lastSlices.staff.semitonePattern, [0, 4, 8], "C added");
      // Re-query after redraw, toggle C off again — back to the original
      findAll(handle.root, "cnb-sre-pc-toggle")[0].onclick();
      assertEqualArrays(lastSlices.staff.semitonePattern, [4, 8], "double toggle restores");
    }),
  },
  {
    name: "render: staff defaults inputs update lineDefaults through onChange",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      const section = findAll(handle.root, "cnb-sre-staff-defaults")
        .find(s => String(s.className).includes("cnb-sre-section"));
      const thick = findAll(section, "cnb-sre-thickness")[0];
      thick.oninput({ target: { value: "35" } });
      assert(lastSlices.staff.lineDefaults.thicknessPct === 35, "thickness");
      const style = findAll(section, "cnb-sre-style")[0];
      style.onchange({ target: { value: "dotted" } });
      assert(lastSlices.staff.lineDefaults.style === "dotted", "style");
      const color = findAll(section, "cnb-sre-color")[0];
      color.oninput({ target: { value: "#123456" } });
      assert(lastSlices.staff.lineDefaults.color === "#123456", "color");
      assert(handle.getStaff().lineDefaults.thicknessPct === 35, "getStaff agrees");
    }),
  },
  {
    name: "render: line color input — `input` emits without redrawing (the picker stays open); `change` redraws",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      let emits = 0;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; emits++; } });
      const colorIn = (token) => findAll(findAll(handle.root, token)
        .find(s => String(s.className).includes("cnb-sre-section")), "cnb-sre-color")[0];
      for (const [token, slice] of [["cnb-sre-staff-defaults", "staff"], ["cnb-sre-ledger-defaults", "ledgers"]]) {
        const before = colorIn(token);
        const n = emits;
        before.oninput({ target: { value: "#123456" } });
        assert(emits === n + 1 && lastSlices[slice].lineDefaults.color === "#123456", `${token}: input emits`);
        assert(colorIn(token) === before, `${token}: input leaves the same element in the DOM`);
        before.onchange({ target: { value: "#654321" } });
        assert(emits === n + 2 && lastSlices[slice].lineDefaults.color === "#654321", `${token}: change emits`);
        assert(colorIn(token) !== before, `${token}: change redraws`);
      }
    }),
  },
  {
    name: "render: non-numeric thickness input is ignored (no NaN in state)",
    fn: () => withDomStub((container) => {
      const handle = E.render(container, {});
      const thick = findAll(handle.root, "cnb-sre-thickness")[0];
      thick.oninput({ target: { value: "abc" } });
      assert(handle.getStaff().lineDefaults.thicknessPct === 20, "unchanged");
    }),
  },
  {
    name: "render: enabling an override seeds it from defaults; editing and disabling work",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });

      const row = findByAttr(handle.root, "data-line-pc", "4")[0];
      findAll(row, "cnb-sre-override-check")[0].onchange({ target: { checked: true } });
      assert(lastSlices.staff.lineOverrides["4"].thicknessPct === 20, "seeded from defaults");

      const row2 = findByAttr(handle.root, "data-line-pc", "4")[0];
      findAll(row2, "cnb-sre-color")[0].oninput({ target: { value: "#ff0000" } });
      assert(lastSlices.staff.lineOverrides["4"].color === "#ff0000", "override edited");
      assert(lastSlices.staff.lineDefaults.color === "#000000", "defaults untouched");

      const row3 = findByAttr(handle.root, "data-line-pc", "4")[0];
      findAll(row3, "cnb-sre-override-check")[0].onchange({ target: { checked: false } });
      assert(!("4" in lastSlices.staff.lineOverrides), "override removed");
    }),
  },
  {
    name: "render: add / edit / remove ledger templates through the UI",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });

      findAll(handle.root, "cnb-sre-template-add")[0].onclick();
      assert(lastSlices.ledgers.templates.length === 4, "added");
      assert(lastSlices.ledgers.templates[3].semiWithinOctave === 0, "new template default");

      const row = findByAttr(handle.root, "data-template-index", "3")[0];
      findAll(row, "cnb-sre-template-pos")[0].onchange({ target: { value: "7" } });
      assert(lastSlices.ledgers.templates[3].semiWithinOctave === 7, "position edited");

      const row2 = findByAttr(handle.root, "data-template-index", "3")[0];
      findAll(row2, "cnb-sre-template-remove")[0].onclick();
      assert(lastSlices.ledgers.templates.length === 3, "removed");
    }),
  },
  {
    name: "render: trigger pills toggle PCs without duplicates; mode select switches to proximity",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });

      // Template 0 (position 0, triggers [0,1,2]): toggle D♯ (pc 3) on
      const row = findByAttr(handle.root, "data-template-index", "0")[0];
      findAll(row, "cnb-sre-trigger-pill")[3].onclick();
      assertEqualArrays(lastSlices.ledgers.templates[0].triggerPCs, [0, 1, 2, 3], "added once");

      // Toggle it back off (re-query after redraw)
      const rowB = findByAttr(handle.root, "data-template-index", "0")[0];
      findAll(rowB, "cnb-sre-trigger-pill")[3].onclick();
      assertEqualArrays(lastSlices.ledgers.templates[0].triggerPCs, [0, 1, 2], "double toggle restores");

      const rowC = findByAttr(handle.root, "data-template-index", "0")[0];
      findAll(rowC, "cnb-sre-template-mode")[0].onchange({ target: { value: "proximity" } });
      assert(lastSlices.ledgers.templates[0].triggerMode === "proximity", "mode switched");
      const rowD = findByAttr(handle.root, "data-template-index", "0")[0];
      assert(String(findAll(rowD, "cnb-sre-template-triggers")[0].className).includes("inactive"),
        "trigger pills marked inactive in proximity mode");
    }),
  },
  {
    name: "render: proximity checkbox (only with a 'when a note is near' rule, or while off) and ledger defaults",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      assert(findAll(handle.root, "cnb-sre-proximity").length === 0, "no near rule: no checkbox");

      const row = findByAttr(handle.root, "data-template-index", "0")[0];
      findAll(row, "cnb-sre-template-mode")[0].onchange({ target: { value: "proximity" } });
      assert(findAll(handle.root, "cnb-sre-proximity").length === 1, "a near rule shows it");
      findAll(handle.root, "cnb-sre-proximity-check")[0].onchange({ target: { checked: false } });
      assert(lastSlices.ledgers.proximityRule === false, "proximity off");
      const rowB = findByAttr(handle.root, "data-template-index", "0")[0];
      findAll(rowB, "cnb-sre-template-mode")[0].onchange({ target: { value: "override" } });
      assert(findAll(handle.root, "cnb-sre-proximity").length === 1, "still shown while off, so it can be turned on");

      const wm = findAll(handle.root, "cnb-sre-width-multiplier")[0];
      wm.oninput({ target: { value: "3.5" } });
      assert(lastSlices.ledgers.lineDefaults.widthMultiplier === 3.5, "width multiplier");

      findAll(handle.root, "cnb-sre-rounded-check")[0].onchange({ target: { checked: false } });
      assert(lastSlices.ledgers.lineDefaults.roundedEnds === false, "rounded ends off");
    }),
  },
  {
    name: "render: invalid transient state (custom, 1 line) shows the validation error inline",
    fn: () => withDomStub((container) => {
      const handle = E.render(container, {});
      findByAttr(handle.root, "data-pattern-key", "custom")[0].onclick();
      // Turn off E and G♯, leaving one line... first toggle E (pc 4) off
      findAll(handle.root, "cnb-sre-pc-toggle")[4].onclick();
      const errors = findAll(handle.root, "cnb-sre-error");
      assert(errors.some(e => e.textContent.includes("at least 2")), "error surfaced");
      assert(findAll(handle.root, "cnb-sre-valid").length === 0, "no valid banner");
      const derivedErr = findAll(handle.root, "cnb-sre-derived-error");
      assert(derivedErr.length === 1, "derived panel shows the shortfall");
    }),
  },
  {
    name: "render: seeds from a passed config (3-6-9 preset recognized)",
    fn: () => withDomStub((container) => {
      const config = CNBConfig.createDefault();
      config.staff.semitonePattern = [3, 6, 9];
      config.staff.semitonesPerStaffSpace = 3;
      const handle = E.render(container, { config });
      assert(handle.getState().patternKey === "3-6-9", "preset from config");
      const selected = findAll(handle.root, "cnb-sre-pattern-option")
        .filter(o => String(o.className).includes("selected"));
      assert(selected.length === 1 && selected[0].getAttribute("data-pattern-key") === "3-6-9",
        "3-6-9 option selected");
    }),
  },
  {
    name: "render: pattern options have a title and a description; a preset's Staff lines on pills make it custom",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      const titles = findAll(handle.root, "cnb-sre-pattern-title").map(t => t.textContent);
      assertEqualArrays(titles, ["4–8", "3–6–9", "Custom"], "titles");
      const descs = findAll(handle.root, "cnb-sre-pattern-desc").map(t => t.textContent);
      assert(descs[0] === "Two lines an octave, on E and G♯", "4-8 described");
      const pills = findAll(handle.root, "cnb-sre-pc-toggle");
      assert(pills.length === 12, "pills shown for a preset");
      assert(pills.filter(p => String(p.className).includes(" on")).length === 2, "the preset's lines are on");
      pills[0].onclick();   // add C to 4-8
      assert(handle.getState().patternKey === "custom", "now custom");
      assertEqualArrays(lastSlices.staff.semitonePattern, [0, 4, 8], "started from the preset");
    }),
  },
  {
    name: "render parts: each part draws only its own sections; unknown parts throw",
    fn: () => withDomStub((container) => {
      const has = (root, token) => findAll(root, token).length > 0;
      const staff = E.render(container, { parts: ["staff"] }).root;
      assert(has(staff, "cnb-sre-pattern") && has(staff, "cnb-sre-derived") && has(staff, "cnb-sre-staff-defaults"), "staff part");
      assert(!has(staff, "cnb-sre-overrides") && !has(staff, "cnb-sre-ledger-mode"), "no other part");
      const ledgers = E.render(container, { parts: ["ledgers"] }).root;
      assert(has(ledgers, "cnb-sre-ledger-mode") && has(ledgers, "cnb-sre-ledgers") && has(ledgers, "cnb-sre-ledger-defaults"), "ledgers part");
      assert(!has(ledgers, "cnb-sre-pattern") && !has(ledgers, "cnb-sre-overrides"), "no staff");
      const overrides = E.render(container, { parts: ["overrides"] }).root;
      assert(has(overrides, "cnb-sre-overrides") && !has(overrides, "cnb-sre-pattern") && !has(overrides, "cnb-sre-ledgers"), "overrides part");
      const all = E.render(container, {}).root;
      const order = all.children.map(c => String(c.className).split(" ").pop());
      assertEqualArrays(order, ["cnb-sre-pattern", "cnb-sre-derived", "cnb-sre-staff-defaults", "cnb-sre-overrides",
        "cnb-sre-ledger-mode", "cnb-sre-ledgers", "cnb-sre-ledger-defaults", "cnb-sre-validation"], "default: all, in order");
      let lastSlices = null;
      const ledgerOnly = E.render(container, { parts: ["ledgers"], onChange: (s) => { lastSlices = s; } });
      findAll(ledgerOnly.root, "cnb-sre-template-add")[0].onclick();
      assertEqualArrays(lastSlices.staff.semitonePattern, [4, 8], "a part still emits the whole staff slice");
      assertThrows(() => E.render(container, { parts: ["pitch"] }), "unknown part");
    }),
  },
  {
    name: "render: switching to Automatic writes the automatic spots; back to My own rules starts from them",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      const modeButton = (mode) => findByAttr(handle.root, "data-ledger-mode", mode)[0];
      assert(String(modeButton("own").className).includes("on"), "the default config opens in My own rules");
      assert(findAll(handle.root, "cnb-sre-template-row").length === 3, "its rules listed");
      assert(findAll(handle.root, "cnb-sre-ledger-mode-desc")[0].textContent === E.LEDGER_MODES.own.description, "own described");

      modeButton("automatic").onclick();
      assert(handle.getState().ledgerMode === "automatic", "mode switched");
      assert(JSON.stringify(lastSlices.ledgers.templates) === JSON.stringify(E.automaticTemplates([4, 8])), "automatic spots written");
      assert(lastSlices.ledgers.proximityRule === true, "proximity on");
      assert(findAll(handle.root, "cnb-sre-template-row").length === 0, "no rule list in Automatic");
      assert(findAll(handle.root, "cnb-sre-proximity").length === 0, "no proximity box in Automatic");
      assert(findAll(handle.root, "cnb-sre-ledger-mode-desc")[0].textContent === E.LEDGER_MODES.automatic.description, "automatic described");

      findByAttr(handle.root, "data-pattern-key", "3-6-9")[0].onclick();
      assertEqualArrays(lastSlices.ledgers.templates.map(t => t.semiWithinOctave), [0], "spots follow the pattern");

      modeButton("own").onclick();
      assert(handle.getState().ledgerMode === "own", "back to own");
      assert(JSON.stringify(lastSlices.ledgers.templates) === JSON.stringify(E.automaticTemplates([3, 6, 9])),
        "own rules start from the automatic spots");
      const row = findByAttr(handle.root, "data-template-index", "0")[0];
      assert(findAll(row, "cnb-sre-template-mode")[0].value === "proximity", "listed as 'when a note is near'");
    }),
  },

  // ── renderPreview() against the DOM stub ──
  {
    name: "renderPreview: default config over 0–24 → 4 staff lines, 25 note columns",
    fn: () => withDomStub((container) => {
      const out = E.renderPreview(container, CNBConfig.createDefault());
      assert(out.svg.getAttribute("class") === "cnb-sre-preview", "svg class");
      assert(out.staffGroup.children.length === 4, "staff lines at 4,8,16,20");
      assert(out.noteGroups.length === 25, "25 chromatic example notes");
      assert(container.children.includes(out.svg), "appended to host");
    }),
  },
  {
    name: "renderPreview: 3-6-9 applied config → 6 staff lines",
    fn: () => withDomStub((container) => {
      const state = { ...defaultState(), patternKey: "3-6-9" };
      const applied = E.applyToConfig(CNBConfig.createDefault(), state);
      const out = E.renderPreview(container, applied);
      assert(out.staffGroup.children.length === 6, "staff lines at 3,6,9,15,18,21");
    }),
  },
  {
    name: "renderPreview: ledger columns match Module 5 resolution (C has a ledger, F none)",
    fn: () => withDomStub((container) => {
      const out = E.renderPreview(container, CNBConfig.createDefault());
      const colC = out.noteGroups.find(n => n.semi === 0);
      const colF = out.noteGroups.find(n => n.semi === 5);
      assert(colC.ledgerGroup.children.length === 1, "C ledger at semi 0");
      assert(colF.ledgerGroup.children.length === 0, "F inside staff, no ledger");
      const colD = out.noteGroups.find(n => n.semi === 2);
      assert(colD.ledgerGroup.children.length === 2, "D shows C and D ledgers");
    }),
  },
  {
    name: "renderPreview: octave awareness — C'' column carries the upper C ledger only",
    fn: () => withDomStub((container) => {
      const out = E.renderPreview(container, CNBConfig.createDefault());
      const colC2 = out.noteGroups.find(n => n.semi === 24);
      assert(colC2.ledgerGroup.children.length === 1, "one ledger");
      // Its Y must equal the grid position of semi 24, not semi 0
      const y = out.gridContext.semiToY(24);
      const rect = colC2.ledgerGroup.children[0];
      const rectCenterY = parseFloat(rect.getAttribute("y")) + parseFloat(rect.getAttribute("height")) / 2;
      assert(Math.abs(rectCenterY - y) < 1e-6, "ledger drawn at semi 24");
    }),
  },
  {
    name: "renderPreview: marker dots sit at each note's grid Y; edge notes padded, not clipped",
    fn: () => withDomStub((container) => {
      const out = E.renderPreview(container, CNBConfig.createDefault(), { colWidth: 20 });
      const top = out.noteGroups.find(n => n.semi === 24);
      assert(parseFloat(top.marker.getAttribute("cy")) === out.gridContext.semiToY(24), "cy");
      assert(parseFloat(out.svg.getAttribute("height")) ===
        out.gridContext.svgHeight + 2 * out.gridContext.pxPerSemi, "vertical padding");
      assert(parseFloat(out.svg.getAttribute("width")) === 25 * 20, "width follows colWidth");
    }),
  },
  {
    name: "renderPreview: honors exampleNotes and pxPerSemi options",
    fn: () => withDomStub((container) => {
      const out = E.renderPreview(container, CNBConfig.createDefault(), {
        exampleNotes: [0, 12, 24],
        pxPerSemi: 8,
      });
      assert(out.noteGroups.length === 3, "explicit example notes");
      assert(out.gridContext.pxPerSemi === 8, "pxPerSemi override");
    }),
  },
];
