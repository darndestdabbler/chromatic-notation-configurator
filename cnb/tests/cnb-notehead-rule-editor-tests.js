/**
 * cnb-notehead-rule-editor-tests.js — Unit tests for Module 14
 * (Notehead Rule Editor)
 *
 * Covers the state → config.noteheadRules build (priority = list order,
 * sparse apply blocks, input sanitizing), the config → state inverse
 * (round-tripped on every branch: "all" vs explicit lists, full-12 lists
 * not collapsed, sparse apply combos, offKeyMark/keys passthrough,
 * arbitrary-priority normalization), resolveAll against Module A's
 * resolveNotehead + resolveColor precedence, reordering semantics, the
 * render() UI driven against a stub DOM, and renderResolvedPreview()
 * against the SVG stub.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBNoteheadRuleEditor } from "../ui/notehead-rule-editor.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBConfigIO } from "../ui/config-io.js";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The Twinline compact gallery fixture (set 014), loaded through CNBConfigIO. */
function twinlineConfig() {
  const text = readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json"), "utf8");
  return CNBConfigIO.loadFromText(text).config;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqualJson(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || "values differ"}: expected ${e}, got ${a}`);
}

function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch (_) { threw = true; }
  if (!threw) throw new Error(msg || "expected function to throw");
}

// ─── HTML DOM stub (element-property event wiring, textContent clearing) ────
// Same stub pattern as the Module 12/13 tests: supports createElement and
// createElementNS so render() and renderResolvedPreview() both run.

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

const E = CNBNoteheadRuleEditor;

/** Editor state for the default config (2 rules: Default + Sharps hollow). */
function defaultState() {
  return E.stateFromConfig(CNBConfig.createDefault());
}

/** Default config extended with a second shape and a small palette. */
function richConfig() {
  const config = CNBConfig.createDefault();
  config.shapes["diamond"] = {
    displayName: "Diamond",
    svgPath: "M 0 -100 L 120 0 L 0 100 L -120 0 Z",
    svgHollowPath: "M 0 -55 L 66 0 L 0 55 L -66 0 Z",
    naturalHeight: 200,
    naturalWidth: 240,
    semitoneHeight: 2.0,
    anchors: null,
    lilypondPath: null,
    lilypondHollowPath: null,
    lilypondAnchors: null,
  };
  config.palette = {
    name: "Demo",
    colors: [{ pc: 0, hex: "#1b9e77", name: "Shamrock" }, { pc: 1, hex: "#d95f02", name: "Orange" }],
    cbSafeColors: [],
    useCBSafe: false,
    schemeSymbols: {},
  };
  config.keys.definitions = [
    { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
    { name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11] },
  ];
  return config;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // ── buildRules ──
  {
    name: "buildRules: priority equals list index; sparse apply preserved",
    fn: () => {
      const rules = E.buildRules(defaultState());
      assert(rules.length === 2, "two rules");
      assert(rules[0].priority === 0 && rules[1].priority === 1, "index priorities");
      assertEqualJson(Object.keys(rules[1].apply), ["hollow"], "second rule stays hollow-only");
      assertEqualJson(Object.keys(rules[0].apply), ["shape", "hollow", "color", "offKeyMark"],
        "first rule keeps all four fields");
    },
  },
  {
    name: "buildRules: default state round-trips the default config byte-identically",
    fn: () => {
      assertEqualJson(E.buildRules(defaultState()), CNBConfig.createDefault().noteheadRules,
        "emitted rules equal the source");
    },
  },
  {
    name: "buildRules: dedupes and sorts explicit pitch classes and durations",
    fn: () => {
      const state = { rules: [{
        name: "R",
        match: { pitchClasses: [10, 3, 3, 1], durations: ["minim", "crotchet", "minim"], keys: "all" },
        apply: { hollow: true },
      }] };
      const [r] = E.buildRules(state);
      assertEqualJson(r.match.pitchClasses, [1, 3, 10], "PCs deduped+sorted");
      assertEqualJson(r.match.durations, ["minim", "crotchet"], "durations deduped, order kept");
    },
  },
  {
    name: "buildRules: empty apply block is legal and emitted as-is; blank name defaulted",
    fn: () => {
      const state = { rules: [{ name: "", match: { pitchClasses: "all", durations: "all", keys: "all" }, apply: {} }] };
      const [r] = E.buildRules(state);
      assertEqualJson(r.apply, {}, "no-op apply");
      assert(r.name === "Rule 1", "name defaulted");
    },
  },
  {
    name: "buildRules: throws on out-of-range PCs, bad shape, bad color (no silent repair)",
    fn: () => {
      const base = { match: { pitchClasses: "all", durations: "all", keys: "all" } };
      assertThrows(() => E.buildRules({ rules: [{ ...base, match: { ...base.match, pitchClasses: [12] }, apply: {} }] }), "PC 12");
      assertThrows(() => E.buildRules({ rules: [{ ...base, match: { ...base.match, pitchClasses: "some" }, apply: {} }] }), "non-array PCs");
      assertThrows(() => E.buildRules({ rules: [{ ...base, apply: { shape: "" } }] }), "empty shape");
      assertThrows(() => E.buildRules({ rules: [{ ...base, apply: { color: 42 } }] }), "numeric color");
    },
  },
  {
    name: "buildRules: color must be null or #RRGGBB — Module A's hex rule, enforced at build",
    fn: () => {
      const rule = (color) => ({ rules: [{
        name: "R", match: { pitchClasses: "all", durations: "all", keys: "all" }, apply: { color },
      }] });
      assertThrows(() => E.buildRules(rule("red")), "named color string");
      assertThrows(() => E.buildRules(rule("#12345")), "short hex");
      assertThrows(() => E.buildRules(rule("#GGGGGG")), "non-hex digits");
      assertThrows(() => E.buildRules(rule("cc0000")), "missing #");
      assert(E.buildRules(rule("#AbCdEf"))[0].apply.color === "#AbCdEf", "mixed-case hex accepted");
      assert(E.buildRules(rule(null))[0].apply.color === null, "null (palette) accepted");
    },
  },
  {
    name: "buildRules: offKeyMark must be false or a non-empty identifier",
    fn: () => {
      const rule = (offKeyMark) => ({ rules: [{
        name: "R", match: { pitchClasses: "all", durations: "all", keys: "all" }, apply: { offKeyMark },
      }] });
      assertThrows(() => E.buildRules(rule(true)), "true is not in the schema (false | identifier)");
      assertThrows(() => E.buildRules(rule("")), "empty identifier");
      assertThrows(() => E.buildRules(rule(5)), "numeric mark");
      assert(E.buildRules(rule(false))[0].apply.offKeyMark === false, "explicit no-mark accepted");
      assert(E.buildRules(rule("cross"))[0].apply.offKeyMark === "cross", "identifier accepted");
    },
  },

  // ── applyToConfig + validation pass-through ──
  {
    name: "applyToConfig: does not mutate the input config; replaces only noteheadRules",
    fn: () => {
      const config = CNBConfig.createDefault();
      const before = JSON.stringify(config);
      const state = defaultState();
      state.rules.push({ name: "X", match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { hollow: true } });
      const applied = E.applyToConfig(config, state);
      assert(JSON.stringify(config) === before, "input untouched");
      assert(applied.noteheadRules.length === 3, "rules replaced");
      assert(JSON.stringify(applied.staff) === JSON.stringify(config.staff), "staff untouched");
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
    name: "validation pass-through: unknown shape and uncovered PCs surface Module A errors",
    fn: () => {
      const config = CNBConfig.createDefault();
      const state = { rules: [{
        name: "Bad", match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { shape: "nope" },
      }], previewDuration: "crotchet" };
      const v = CNBConfig.validate(E.applyToConfig(config, state));
      assert(!v.valid, "invalid");
      assert(v.errors.some(e => e.includes('unknown shape "nope"')), "shape error");
      assert(v.errors.some(e => e.includes("Pitch class 1 is not covered")), "coverage error");
    },
  },

  // ── stateFromConfig + round-trips ──
  {
    name: "stateFromConfig: orders rules by ascending priority (stable), keeps sparse apply",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.noteheadRules = [
        { name: "B", priority: 10, match: { pitchClasses: [1], durations: "all", keys: "all" }, apply: { hollow: true } },
        { name: "A", priority: 5, match: { pitchClasses: "all", durations: "all", keys: "all" }, apply: { shape: "crotchet-minim" } },
      ];
      const state = E.stateFromConfig(config);
      assert(state.rules[0].name === "A" && state.rules[1].name === "B", "sorted by priority");
      assertEqualJson(Object.keys(state.rules[1].apply), ["hollow"], "sparse apply kept");
      assert(state.previewDuration === "crotchet", "preview duration seeded from first duration def");
    },
  },
  {
    name: "round-trip: arbitrary priorities normalize to 0..n-1 with identical resolution",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.noteheadRules = [
        { name: "A", priority: 5, match: { pitchClasses: "all", durations: "all", keys: "all" },
          apply: { shape: "crotchet-minim", hollow: false, color: null, offKeyMark: false } },
        { name: "B", priority: 10, match: { pitchClasses: [1], durations: "all", keys: "all" }, apply: { hollow: true } },
      ];
      const applied = E.applyToConfig(config, E.stateFromConfig(config));
      assertEqualJson(applied.noteheadRules.map(r => r.priority), [0, 1], "renumbered");
      for (let pc = 0; pc < 12; pc++) {
        for (const dur of ["crotchet", "minim"]) {
          assertEqualJson(
            CNBConfig.resolveNotehead(applied, pc, dur, null),
            CNBConfig.resolveNotehead(config, pc, dur, null),
            `resolution parity pc=${pc} dur=${dur}`);
        }
      }
    },
  },
  {
    name: "round-trip: explicit full-12 PC list is NOT collapsed to \"all\"",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.noteheadRules[0].match.pitchClasses = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const applied = E.applyToConfig(config, E.stateFromConfig(config));
      assertEqualJson(applied.noteheadRules[0].match.pitchClasses,
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], "list representation preserved");
    },
  },
  {
    name: "round-trip: offKeyMark and explicit keys lists pass through untouched",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.noteheadRules.push({
        name: "Marks", priority: 2,
        match: { pitchClasses: [6], durations: ["minim"], keys: ["C", "G"] },
        apply: { offKeyMark: "cross" },
      });
      const applied = E.applyToConfig(config, E.stateFromConfig(config));
      const marks = applied.noteheadRules[2];
      assert(marks.apply.offKeyMark === "cross", "offKeyMark preserved");
      assertEqualJson(marks.match.keys, ["C", "G"], "keys list preserved");
      assertEqualJson(marks.match.durations, ["minim"], "durations list preserved");
      // Stability: a second round-trip changes nothing
      const applied2 = E.applyToConfig(config, E.stateFromConfig(applied));
      assertEqualJson(applied2.noteheadRules, applied.noteheadRules, "stable");
    },
  },
  {
    name: "round-trip: explicit color hex and color:null (palette) both survive",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.noteheadRules.push(
        { name: "Hex", priority: 2, match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { color: "#cc0000" } },
        { name: "Pal", priority: 3, match: { pitchClasses: [1], durations: "all", keys: "all" }, apply: { color: null } },
      );
      const applied = E.applyToConfig(config, E.stateFromConfig(config));
      assert(applied.noteheadRules[2].apply.color === "#cc0000", "hex kept");
      assert(applied.noteheadRules[3].apply.color === null, "null kept (palette mode)");
    },
  },

  // ── resolveAll + reordering semantics ──
  {
    name: "resolveAll: default config — sharps hollow, naturals solid, all 12 PCs",
    fn: () => {
      const resolved = E.resolveAll(CNBConfig.createDefault(), "crotchet", null);
      assert(resolved.length === 12, "12 entries");
      for (const r of resolved) {
        assert(r.shape === "crotchet-minim", `pc ${r.pc} shape`);
        assert(r.hollow === [1, 3, 6, 8, 10].includes(r.pc), `pc ${r.pc} hollow`);
        assert(r.effectiveColor === "#000000", `pc ${r.pc} black without palette`);
      }
      assert(resolved[1].label === "C♯", "labels attached");
    },
  },
  {
    name: "resolveAll: effective color precedence — explicit hex > palette > black",
    fn: () => {
      const config = richConfig();   // palette covers PCs 0 and 1
      config.noteheadRules.push({
        name: "Red C", priority: 2,
        match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { color: "#cc0000" },
      });
      const resolved = E.resolveAll(config, "crotchet", null);
      assert(resolved[0].effectiveColor === "#cc0000", "explicit rule hex wins for C");
      assert(resolved[0].color === "#cc0000", "raw resolved color kept");
      assert(resolved[1].effectiveColor === "#d95f02", "palette color for C♯ (color null)");
      assert(resolved[2].effectiveColor === "#000000", "black when PC not in palette");
    },
  },
  {
    name: "resolveAll: duration-specific rule only affects its duration",
    fn: () => {
      const config = richConfig();
      config.noteheadRules.push({
        name: "Minim diamonds", priority: 2,
        match: { pitchClasses: "all", durations: ["minim"], keys: "all" }, apply: { shape: "diamond" },
      });
      assert(E.resolveAll(config, "crotchet", null)[0].shape === "crotchet-minim", "crotchet untouched");
      assert(E.resolveAll(config, "minim", null)[0].shape === "diamond", "minim overridden");
    },
  },
  {
    name: "reordering: swapping list order flips which rule wins (later overrides earlier)",
    fn: () => {
      const mk = (rules) => E.applyToConfig(CNBConfig.createDefault(),
        { rules: rules.map(r => JSON.parse(JSON.stringify(r))), previewDuration: "crotchet" });
      const solid = { name: "Solid C", match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { hollow: false } };
      const hollow = { name: "Hollow C", match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { hollow: true } };
      const base = { name: "Base", match: { pitchClasses: "all", durations: "all", keys: "all" },
        apply: { shape: "crotchet-minim", hollow: false, color: null, offKeyMark: false } };
      assert(CNBConfig.resolveNotehead(mk([base, solid, hollow]), 0, "crotchet", null).hollow === true,
        "hollow last → hollow wins");
      assert(CNBConfig.resolveNotehead(mk([base, hollow, solid]), 0, "crotchet", null).hollow === false,
        "solid last → solid wins");
    },
  },
  {
    name: "partial-apply inheritance: later hollow-only rule keeps earlier shape and color",
    fn: () => {
      const config = richConfig();
      config.noteheadRules = [
        { name: "Base", priority: 0, match: { pitchClasses: "all", durations: "all", keys: "all" },
          apply: { shape: "diamond", hollow: false, color: "#112233", offKeyMark: false } },
        { name: "Hollow C", priority: 1, match: { pitchClasses: [0], durations: "all", keys: "all" },
          apply: { hollow: true } },
      ];
      const r = E.resolveAll(config, "crotchet", null)[0];
      assert(r.hollow === true, "hollow overridden");
      assert(r.shape === "diamond" && r.effectiveColor === "#112233",
        "shape and color inherited from the earlier match");
    },
  },

  // ── render() UI against the DOM stub ──
  {
    name: "render: default config → 2 rule cards, resolved strip with 12 cells, valid banner",
    fn: () => withDomStub((container) => {
      const handle = E.render(container, {});
      assert(handle.root.className === "cnb-notehead-rule-editor", "root class");
      assert(findAll(handle.root, "cnb-nre-rule-card").length === 2, "one card per rule");
      assert(findAll(handle.root, "cnb-nre-resolved-cell").length === 12, "12 resolved cells");
      assert(findAll(handle.root, "cnb-nre-valid").length === 1, "validation OK banner");
      const nums = findAll(handle.root, "cnb-nre-rule-num").map(n => n.textContent);
      assertEqualJson(nums, ["1", "2"], "application-order numbering");
    }),
  },
  {
    name: "render: add rule appends an all/all/all no-op rule and reports it through onChange",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      findAll(handle.root, "cnb-nre-rule-add")[0].onclick();
      assert(lastSlices.noteheadRules.length === 3, "3 rules in slice");
      const added = lastSlices.noteheadRules[2];
      assert(added.match.pitchClasses === "all" && added.priority === 2, "all-matcher at priority 2");
      assertEqualJson(added.apply, {}, "no-op apply");
      assert(findAll(handle.root, "cnb-nre-rule-card").length === 3, "card drawn");
    }),
  },
  {
    name: "render: remove rule updates slice; removing every rule surfaces coverage errors",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      findAll(handle.root, "cnb-nre-rule-remove")[0].onclick();   // remove "Default"
      assert(lastSlices.noteheadRules.length === 1, "one rule left");
      findAll(handle.root, "cnb-nre-rule-remove")[0].onclick();   // remove the last one
      assert(lastSlices.noteheadRules.length === 0, "empty list allowed");
      const errors = findAll(handle.root, "cnb-nre-error");
      assert(errors.some(e => e.textContent.includes("not covered")), "Module A coverage errors shown");
      assert(findAll(handle.root, "cnb-nre-valid").length === 0, "no valid banner");
    }),
  },
  {
    name: "render: move down/up swaps rules and the resolved strip follows",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      // Default order: Default (sets hollow false) then Sharps-hollow → C♯ hollow.
      let cell = findAll(handle.root, "cnb-nre-resolved-cell")[1];
      assert(findAll(cell, "cnb-nre-resolved-fill")[0].textContent === "hollow", "C♯ hollow initially");

      // Move "Sharps are hollow" (index 1) up → Default now applies last,
      // its hollow:false wins for sharps.
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1, "cnb-nre-rule-up")[0].onclick();
      assert(lastSlices.noteheadRules[0].name === "Sharps are hollow", "order swapped in slice");
      assert(lastSlices.noteheadRules[0].priority === 0 && lastSlices.noteheadRules[1].priority === 1,
        "priorities follow the new order");
      cell = findAll(handle.root, "cnb-nre-resolved-cell")[1];
      assert(findAll(cell, "cnb-nre-resolved-fill")[0].textContent === "solid",
        "C♯ now solid — Default's hollow:false overrides");

      // Move it back down — hollow again.
      const card0 = findByAttr(handle.root, "data-rule-index", "0")[0];
      findAll(card0, "cnb-nre-rule-down")[0].onclick();
      cell = findAll(handle.root, "cnb-nre-resolved-cell")[1];
      assert(findAll(cell, "cnb-nre-resolved-fill")[0].textContent === "hollow", "C♯ hollow restored");
    }),
  },
  {
    name: "render: first card's up and last card's down buttons are disabled",
    fn: () => withDomStub((container) => {
      const handle = E.render(container, {});
      const card0 = findByAttr(handle.root, "data-rule-index", "0")[0];
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      assert(findAll(card0, "cnb-nre-rule-up")[0].disabled === true, "first up disabled");
      assert(findAll(card0, "cnb-nre-rule-down")[0].disabled === false, "first down enabled");
      assert(findAll(card1, "cnb-nre-rule-down")[0].disabled === true, "last down disabled");
    }),
  },
  {
    name: "render: PC pills — clicking a pill while \"all\" narrows to all-except-clicked",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      const card0 = findByAttr(handle.root, "data-rule-index", "0")[0];
      // Rule 1 matches "all": the All pill is on and every PC pill renders on.
      assert(String(findAll(card0, "cnb-nre-all-pill")[0].className).includes("on"), "All pill on");
      findAll(card0, "cnb-nre-pc-pill")[4].onclick();   // click E
      assertEqualJson(lastSlices.noteheadRules[0].match.pitchClasses,
        [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11], "explicit list of everything except E");
      // Clicking the All pill restores the all-matcher.
      const card0b = findByAttr(handle.root, "data-rule-index", "0")[0];
      findAll(card0b, "cnb-nre-all-pill")[0].onclick();
      assert(lastSlices.noteheadRules[0].match.pitchClasses === "all", "back to all");
    }),
  },
  {
    name: "render: PC pills — explicit list toggles add/remove without duplicates",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      // Rule 2 has explicit PCs [1,3,6,8,10]
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1, "cnb-nre-pc-pill")[0].onclick();   // add C
      assertEqualJson(lastSlices.noteheadRules[1].match.pitchClasses, [0, 1, 3, 6, 8, 10], "C added once");
      const card1b = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1b, "cnb-nre-pc-pill")[0].onclick();  // remove C again
      assertEqualJson(lastSlices.noteheadRules[1].match.pitchClasses, [1, 3, 6, 8, 10], "double toggle restores");
    }),
  },
  {
    name: "render: duration pills narrow a rule to specific durations",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      const durPills = findAll(card1, "cnb-nre-dur-pill");
      assert(durPills.length === 4, "one pill per duration definition");
      durPills[0].onclick();   // while "all": narrow to everything except crotchet
      assertEqualJson(lastSlices.noteheadRules[1].match.durations,
        ["minim", "semibreve", "breve"], "all-except-crotchet");
      // Resolved strip (crotchet) now shows C♯ solid; switching the strip to
      // minim shows it hollow again.
      let cell = findAll(handle.root, "cnb-nre-resolved-cell")[1];
      assert(findAll(cell, "cnb-nre-resolved-fill")[0].textContent === "solid", "crotchet no longer matched");
      findAll(handle.root, "cnb-nre-resolved-duration")[0].onchange({ target: { value: "minim" } });
      assert(handle.getState().previewDuration === "minim", "preview duration switched");
      cell = findAll(handle.root, "cnb-nre-resolved-cell")[1];
      assert(findAll(cell, "cnb-nre-resolved-fill")[0].textContent === "hollow", "minim still matched");
    }),
  },
  {
    name: "render: shape toggle enables apply.shape seeded with the first shape; select edits it",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const config = richConfig();
      const handle = E.render(container, { config, onChange: (slices) => { lastSlices = slices; } });
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1, "cnb-nre-apply-shape-check")[0].onchange({ target: { checked: true } });
      assert(lastSlices.noteheadRules[1].apply.shape === "crotchet-minim", "seeded with first shape");
      const card1b = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1b, "cnb-nre-shape-select")[0].onchange({ target: { value: "diamond" } });
      assert(lastSlices.noteheadRules[1].apply.shape === "diamond", "shape edited");
      const cell = findAll(handle.root, "cnb-nre-resolved-cell")[1];
      assert(findAll(cell, "cnb-nre-resolved-shape")[0].textContent === "Diamond",
        "resolved strip shows the sharp's new shape");
      // Disabling returns the property to inherit (removed from apply).
      const card1c = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1c, "cnb-nre-apply-shape-check")[0].onchange({ target: { checked: false } });
      assert(!("shape" in lastSlices.noteheadRules[1].apply), "shape removed → inherits");
    }),
  },
  {
    name: "render: hollow select flips between hollow cutout and solid fill",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      assert(findAll(card1, "cnb-nre-hollow-select")[0].value === "hollow", "existing value shown");
      findAll(card1, "cnb-nre-hollow-select")[0].onchange({ target: { value: "solid" } });
      assert(lastSlices.noteheadRules[1].apply.hollow === false, "flipped to solid");
      const cell = findAll(handle.root, "cnb-nre-resolved-cell")[1];
      assert(findAll(cell, "cnb-nre-resolved-fill")[0].textContent === "solid", "strip follows");
    }),
  },
  {
    name: "render: color toggle defaults to palette mode (null); custom mode edits a hex",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const config = richConfig();
      const handle = E.render(container, { config, onChange: (slices) => { lastSlices = slices; } });
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1, "cnb-nre-apply-color-check")[0].onchange({ target: { checked: true } });
      assert(lastSlices.noteheadRules[1].apply.color === null, "palette mode emits null");
      // C♯ is in the demo palette → effective color comes from it.
      let swatch = findAll(findAll(handle.root, "cnb-nre-resolved-cell")[1], "cnb-nre-resolved-swatch")[0];
      assert(swatch.getAttribute("data-color") === "#d95f02", "palette color in strip");

      const card1b = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1b, "cnb-nre-color-mode")[0].onchange({ target: { value: "custom" } });
      assert(lastSlices.noteheadRules[1].apply.color === "#000000", "custom mode starts at black");
      const card1c = findByAttr(handle.root, "data-rule-index", "1")[0];
      // The hex applies, and the panel (and its resolved strip) redraws,
      // when the picker closes.
      findAll(card1c, "cnb-nre-color-input")[0].onchange({ target: { value: "#cc0000" } });
      assert(lastSlices.noteheadRules[1].apply.color === "#cc0000", "hex edited");
      swatch = findAll(findAll(handle.root, "cnb-nre-resolved-cell")[1], "cnb-nre-resolved-swatch")[0];
      assert(swatch.getAttribute("data-color") === "#cc0000", "strip shows the rule hex");

      const card1d = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1d, "cnb-nre-color-mode")[0].onchange({ target: { value: "palette" } });
      assert(lastSlices.noteheadRules[1].apply.color === null, "back to palette mode");
    }),
  },
  {
    name: "render: color input applies once (session 36) — a drag (`input`) writes nothing; `change` emits once and redraws",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      let emits = 0;
      const config = richConfig();
      config.noteheadRules[1].apply.color = "#000000";
      const handle = E.render(container, { config, onChange: (slices) => { lastSlices = slices; emits++; } });
      const input = () => findAll(findByAttr(handle.root, "data-rule-index", "1")[0], "cnb-nre-color-input")[0];
      const before = input();
      assert(typeof before.oninput !== "function", "a drag step has no handler: only the field's swatch changes");
      assert(emits === 0, "nothing written before change");
      before.onchange({ target: { value: "#0000ff" } });
      assert(emits === 1 && lastSlices.noteheadRules[1].apply.color === "#0000ff", "change emits once");
      assert(input() !== before, "change redraws");
    }),
  },
  {
    name: "render: keys row — pills from config.keys.definitions, narrowing and All restore",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { config: richConfig(), onChange: (slices) => { lastSlices = slices; } });
      const card0 = findByAttr(handle.root, "data-rule-index", "0")[0];
      const keyPills = findAll(card0, "cnb-nre-key-pill");
      assert(keyPills.length === 2, "C and G pills from the definitions");
      keyPills[0].onclick();   // click C while "all" → all-except-C = [G]
      assertEqualJson(lastSlices.noteheadRules[0].match.keys, ["G"], "narrowed to G");
      const card0b = findByAttr(handle.root, "data-rule-index", "0")[0];
      const allPill = findAll(findAll(card0b, "cnb-nre-match-keys-row")[0], "cnb-nre-all-pill")[0];
      allPill.onclick();
      assert(lastSlices.noteheadRules[0].match.keys === "all", "All pill restores");
    }),
  },
  {
    name: "render: keys row without definitions shows the nothing-to-narrow note, no pills",
    fn: () => withDomStub((container) => {
      const handle = E.render(container, {});   // default config: keys.definitions []
      const card0 = findByAttr(handle.root, "data-rule-index", "0")[0];
      assert(findAll(card0, "cnb-nre-key-pill").length === 0, "no key pills");
      assert(findAll(card0, "cnb-nre-keys-note").length === 1, "note shown");
    }),
  },
  {
    name: "render: key names on a loaded rule stay editable even without definitions (union)",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const config = CNBConfig.createDefault();   // no key definitions
      config.noteheadRules[1].match.keys = ["D"];
      const handle = E.render(container, { config, onChange: (slices) => { lastSlices = slices; } });
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      const pills = findAll(card1, "cnb-nre-key-pill");
      assert(pills.length === 1 && pills[0].textContent === "D", "stranded key gets a pill");
      pills[0].onclick();   // remove it
      assertEqualJson(lastSlices.noteheadRules[1].match.keys, [], "removable");
    }),
  },
  {
    name: "render: resolved strip key selector changes which key-matched rules apply",
    fn: () => withDomStub((container) => {
      const config = richConfig();
      config.noteheadRules.push({
        name: "G-key red", priority: 2,
        match: { pitchClasses: "all", durations: "all", keys: ["G"] }, apply: { color: "#cc0000" },
      });
      const handle = E.render(container, { config });
      const swatchOf = () => findAll(findAll(handle.root, "cnb-nre-resolved-cell")[2],
        "cnb-nre-resolved-swatch")[0].getAttribute("data-color");
      assert(swatchOf() === "#000000", "(no key) → key rule not matched, D stays black");
      findAll(handle.root, "cnb-nre-resolved-key")[0].onchange({ target: { value: "G" } });
      assert(handle.getState().previewKey === "G", "previewKey switched");
      assert(swatchOf() === "#cc0000", "key G → rule applies");
      findAll(handle.root, "cnb-nre-resolved-key")[0].onchange({ target: { value: "" } });
      assert(handle.getState().previewKey === null, "back to no key");
      assert(swatchOf() === "#000000", "rule no longer matched");
    }),
  },
  {
    name: "render: off-key mark toggle — enable emits false, mark mode edits an identifier",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1, "cnb-nre-apply-mark-check")[0].onchange({ target: { checked: true } });
      assert(lastSlices.noteheadRules[1].apply.offKeyMark === false, "enable emits explicit no-mark");
      let cell = findAll(handle.root, "cnb-nre-resolved-cell")[1];
      assert(findAll(cell, "cnb-nre-resolved-mark")[0].textContent === "no mark", "strip shows no mark");

      const card1b = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1b, "cnb-nre-mark-mode")[0].onchange({ target: { value: "mark" } });
      assert(lastSlices.noteheadRules[1].apply.offKeyMark === "cross", "mark mode seeds the placeholder");
      const card1c = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1c, "cnb-nre-mark-input")[0].oninput({ target: { value: "flat-mark" } });
      assert(lastSlices.noteheadRules[1].apply.offKeyMark === "flat-mark", "identifier edited");
      assert(findByAttr(handle.root, "data-rule-index", "1")[0] === card1c,
        "identifier typing does not rebuild the card");
      handle.redraw();
      cell = findAll(handle.root, "cnb-nre-resolved-cell")[1];
      assert(findAll(cell, "cnb-nre-resolved-mark")[0].textContent === "mark: flat-mark",
        "strip shows the effective mark for matched PCs");

      const card1d = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1d, "cnb-nre-apply-mark-check")[0].onchange({ target: { checked: false } });
      assert(!("offKeyMark" in lastSlices.noteheadRules[1].apply), "disable removes → inherits");
    }),
  },
  {
    name: "render: emptying the mark identifier holds the onChange (invalid transient state)",
    fn: () => withDomStub((container) => {
      let calls = 0;
      const handle = E.render(container, { onChange: () => { calls++; } });
      const card1 = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1, "cnb-nre-apply-mark-check")[0].onchange({ target: { checked: true } });
      const card1b = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1b, "cnb-nre-mark-mode")[0].onchange({ target: { value: "mark" } });
      const before = calls;
      const card1c = findByAttr(handle.root, "data-rule-index", "1")[0];
      findAll(card1c, "cnb-nre-mark-input")[0].oninput({ target: { value: "" } });
      assert(calls === before, "no onChange with an empty identifier");
      assert(handle.getState().rules[1].apply.offKeyMark === "", "state holds the transient value");
      handle.redraw();
      const errors = findAll(handle.root, "cnb-nre-error");
      assert(errors.some(e => e.textContent.includes("offKeyMark")), "strips surface the error");
    }),
  },
  {
    name: "render: rule name edits reach the slice without a redraw (focus preserved)",
    fn: () => withDomStub((container) => {
      let lastSlices = null;
      const handle = E.render(container, { onChange: (slices) => { lastSlices = slices; } });
      const card0 = findByAttr(handle.root, "data-rule-index", "0")[0];
      const nameInput = findAll(card0, "cnb-nre-rule-name")[0];
      nameInput.oninput({ target: { value: "Base rule" } });
      assert(lastSlices.noteheadRules[0].name === "Base rule", "name in slice");
      assert(findByAttr(handle.root, "data-rule-index", "0")[0] === card0,
        "card not rebuilt by a name edit");
      assert(handle.getState().rules[0].name === "Base rule", "state agrees");
    }),
  },
  {
    name: "render: hollow rule on a shape without a hollow path surfaces the Module A warning",
    fn: () => withDomStub((container) => {
      const config = richConfig();
      config.shapes["diamond"].svgHollowPath = null;
      config.noteheadRules = [
        { name: "Base", priority: 0, match: { pitchClasses: "all", durations: "all", keys: "all" },
          apply: { shape: "diamond", hollow: true, color: null, offKeyMark: false } },
      ];
      const handle = E.render(container, { config });
      const warnings = findAll(handle.root, "cnb-nre-warning");
      assert(warnings.some(w => w.textContent.includes("has no svgHollowPath")), "W2 surfaced");
    }),
  },

  // ── renderResolvedPreview() against the DOM stub ──
  {
    name: "renderResolvedPreview: 12 cells, hollow PCs draw two paths, solid PCs one",
    fn: () => withDomStub((container) => {
      const out = E.renderResolvedPreview(container, CNBConfig.createDefault(), { duration: "crotchet" });
      assert(out.cells.length === 12, "12 cells");
      assert(container.children.includes(out.row), "row appended to host");
      const pathCount = (cell) => cell.svg.children[0].children.length;
      assert(pathCount(out.cells[0]) === 1, "C solid → 1 path");
      assert(pathCount(out.cells[1]) === 2, "C♯ hollow → filled path + white cutout");
      assert(out.cells[1].resolved.hollow === true, "resolved data attached");
    }),
  },
  {
    name: "renderResolvedPreview: duration option changes which rules apply",
    fn: () => withDomStub((container) => {
      const config = richConfig();
      config.noteheadRules.push({
        name: "Minim diamonds", priority: 2,
        match: { pitchClasses: "all", durations: ["minim"], keys: "all" }, apply: { shape: "diamond" },
      });
      const crotchet = E.renderResolvedPreview(container, config, { duration: "crotchet" });
      const minim = E.renderResolvedPreview(container, config, { duration: "minim" });
      assert(crotchet.cells[0].resolved.shape === "crotchet-minim", "crotchet base shape");
      assert(minim.cells[0].resolved.shape === "diamond", "minim shape rule applied");
    }),
  },
  {
    name: "renderResolvedPreview: missing shape renders a labelled placeholder, svg null",
    fn: () => withDomStub((container) => {
      const config = CNBConfig.createDefault();
      config.noteheadRules.push({
        name: "Ghost", priority: 2,
        match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { shape: "ghost" },
      });
      const out = E.renderResolvedPreview(container, config, { duration: "crotchet" });
      assert(out.cells[0].svg === null, "no svg for missing shape");
      const missing = findAll(out.row, "cnb-nre-preview-missing");
      assert(missing.length === 1 && missing[0].textContent.includes("ghost"), "placeholder names the shape");
      assert(out.cells[1].svg !== null, "other PCs unaffected");
    }),
  },
  {
    name: "renderResolvedPreview: key option and off-key mark badge follow the resolution",
    fn: () => withDomStub((container) => {
      const config = richConfig();
      config.noteheadRules.push({
        name: "Off-key in G", priority: 2,
        match: { pitchClasses: [1], durations: "all", keys: ["G"] }, apply: { offKeyMark: "cross" },
      });
      const noKey = E.renderResolvedPreview(container, config, { duration: "crotchet" });
      assert(findAll(noKey.row, "cnb-nre-preview-mark").length === 0, "no badge without the key");
      const inG = E.renderResolvedPreview(container, config, { duration: "crotchet", key: "G" });
      const badges = findAll(inG.row, "cnb-nre-preview-mark");
      assert(badges.length === 1 && badges[0].textContent === "mark: cross", "badge for C♯ in G");
      assert(inG.cells[1].resolved.offKeyMark === "cross", "resolved data carries the mark");
    }),
  },
  {
    name: "renderResolvedPreview: notehead color and labels come from the resolution",
    fn: () => withDomStub((container) => {
      const config = richConfig();   // palette: PC0 shamrock, PC1 orange
      const out = E.renderResolvedPreview(container, config, { duration: "crotchet" });
      const fillOf = (cell) => cell.svg.children[0].children[0].getAttribute("fill");
      assert(fillOf(out.cells[0]) === "#1b9e77", "C uses its palette color");
      assert(fillOf(out.cells[2]) === "#000000", "D falls back to black");
      const labels = findAll(out.row, "cnb-nre-preview-label").map(l => l.textContent);
      assertEqualJson(labels.slice(0, 3), ["C", "C♯", "D"], "PC labels");
    }),
  },

  // ── xOffsetStaffSpaces (set 014, axis-gated) ─────────────────────────────
  {
    name: "xOffsetStaffSpaces: the Twinline fixture's offset rule round-trips through the builders",
    fn: () => {
      const config = twinlineConfig();
      const rules = E.buildRules(E.stateFromConfig(config));
      const offset = rules.find(r => r.apply.xOffsetStaffSpaces !== undefined);
      assert(offset, "offset rule kept");
      assertEqualJson(offset.apply, { xOffsetStaffSpaces: 0.85 }, "apply block");
      assertEqualJson(offset.match.pitchClasses, [1, 4, 6, 9, 11], "match");
      for (let pc = 0; pc < 12; pc++) {
        const before = CNBConfig.resolveNotehead(config, pc, "crotchet", null).xOffsetStaffSpaces;
        const after = CNBConfig.resolveNotehead({ ...config, noteheadRules: rules }, pc, "crotchet", null).xOffsetStaffSpaces;
        assert(before === after, `pc ${pc} resolves to the same offset`);
      }
    },
  },
  {
    name: "xOffsetStaffSpaces: non-finite or non-numeric values throw; finite values (incl. negative) accepted",
    fn: () => {
      const rule = (x) => ({ rules: [{
        name: "R", match: { pitchClasses: "all", durations: "all", keys: "all" }, apply: { xOffsetStaffSpaces: x },
      }] });
      assertThrows(() => E.buildRules(rule(NaN)), "NaN");
      assertThrows(() => E.buildRules(rule(Infinity)), "Infinity");
      assertThrows(() => E.buildRules(rule("0.85")), "string");
      assertThrows(() => E.buildRules(rule(null)), "null");
      assert(E.buildRules(rule(-0.5))[0].apply.xOffsetStaffSpaces === -0.5, "negative accepted");
      assert(E.buildRules(rule(0))[0].apply.xOffsetStaffSpaces === 0, "zero accepted");
    },
  },
  {
    name: "xOffsetStaffSpaces: row absent on a linear config, present on every rule when the axis is enabled",
    fn: () => withDomStub((container) => {
      const linear = E.render(container, { config: CNBConfig.createDefault() });
      assert(findAll(linear.root, "cnb-nre-apply-xoffset").length === 0, "no row while axis absent");

      const axisConfig = twinlineConfig();
      const axis = E.render(container, { config: axisConfig });
      assert(findAll(axis.root, "cnb-nre-apply-xoffset").length === axisConfig.noteheadRules.length,
        "one row per rule while axis enabled");
    }),
  },
  {
    name: "xOffsetStaffSpaces: a rule carrying the field keeps its row with the axis disabled",
    fn: () => withDomStub((container) => {
      const config = twinlineConfig();
      config.pitchAxis.enabled = false;
      const api = E.render(container, { config });
      const rows = findAll(api.root, "cnb-nre-apply-xoffset");
      assert(rows.length === 1, "only the rule that sets it");
      assert(findAll(rows[0], "cnb-nre-xoffset-input")[0].value === "0.85", "value shown");
    }),
  },
  {
    name: "xOffsetStaffSpaces: toggling the row on seeds 0, editing reports the value, toggling off removes it",
    fn: () => withDomStub((container) => {
      let last = null;
      const config = twinlineConfig();
      const api = E.render(container, { config, onChange: (s) => { last = s; } });
      const firstRow = () => findAll(api.root, "cnb-nre-apply-xoffset")[0];
      findAll(firstRow(), "cnb-nre-apply-check")[0].onchange({ target: { checked: true } });
      assert(last.noteheadRules[0].apply.xOffsetStaffSpaces === 0, "seeded 0");
      findAll(firstRow(), "cnb-nre-xoffset-input")[0].onchange({ target: { value: "-0.4" } });
      assert(last.noteheadRules[0].apply.xOffsetStaffSpaces === -0.4, "edited");
      last = null;
      findAll(firstRow(), "cnb-nre-xoffset-input")[0].onchange({ target: { value: "" } });
      assert(last === null, "empty input ignored");
      findAll(firstRow(), "cnb-nre-apply-check")[0].onchange({ target: { checked: false } });
      assert(!("xOffsetStaffSpaces" in last.noteheadRules[0].apply), "removed");
    }),
  },

  // ── session 22: notehead size ──────────────────────────────────────────────
  {
    name: "size: buildRules / stateFromConfig round-trip heightSemis and widthSemis; invalid values throw",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.noteheadRules[1].apply.heightSemis = 1.5;
      config.noteheadRules[1].apply.widthSemis = 3;
      const rules = E.buildRules(E.stateFromConfig(config));
      assert(rules[1].apply.heightSemis === 1.5 && rules[1].apply.widthSemis === 3, "round-trip");
      assert(!("heightSemis" in rules[0].apply), "absent stays absent");
      const rule = (field, v) => ({ rules: [{ name: "r", match: { pitchClasses: "all" }, apply: { [field]: v } }] });
      for (const field of ["heightSemis", "widthSemis"]) {
        for (const bad of [0, -1, NaN, Infinity, "2", null]) assertThrows(() => E.buildRules(rule(field, bad)), `${field} ${bad}`);
        assert(E.buildRules(rule(field, 0.25))[0].apply[field] === 0.25, `${field} accepted`);
      }
    },
  },
  {
    name: "size: toggling the row on seeds the shape's own size; off removes both fields",
    fn: () => withDomStub((container) => {
      let last = null;
      const config = CNBConfig.createDefault();
      const shape = config.shapes["crotchet-minim"];
      const api = E.render(container, { config, onChange: (s) => { last = s; } });
      const row = () => findAll(api.root, "cnb-nre-apply-size")[1];
      assert(findAll(api.root, "cnb-nre-apply-size").length === config.noteheadRules.length, "one size row per rule");
      findAll(row(), "cnb-nre-apply-check")[0].onchange({ target: { checked: true } });
      const a = last.noteheadRules[1].apply;
      assert(a.heightSemis === shape.semitoneHeight, "seeded own height");
      const ownW = Math.round(shape.semitoneHeight * shape.naturalWidth / shape.naturalHeight * 10000) / 10000;
      assert(a.widthSemis === ownW, `seeded natural width ${a.widthSemis}`);
      findAll(row(), "cnb-nre-apply-check")[0].onchange({ target: { checked: false } });
      assert(!("heightSemis" in last.noteheadRules[1].apply) && !("widthSemis" in last.noteheadRules[1].apply), "both removed");
    }),
  },
  {
    name: "size: with the lock on (default) editing the height rewrites the width at the natural ratio; off, the width is free",
    fn: () => withDomStub((container) => {
      let last = null;
      const config = CNBConfig.createDefault();
      const shape = config.shapes["crotchet-minim"];
      const ratio = shape.naturalWidth / shape.naturalHeight;
      config.noteheadRules[1].apply.heightSemis = 2;
      config.noteheadRules[1].apply.widthSemis = 2;
      const api = E.render(container, { config, onChange: (s) => { last = s; } });
      const row = () => findAll(api.root, "cnb-nre-apply-size")[1];
      assert(findAll(row(), "cnb-nre-size-lock")[0].checked === true, "lock on by default");
      assert(findAll(row(), "cnb-nre-size-width")[0].disabled === true, "width follows the height while locked");
      findAll(row(), "cnb-nre-size-height")[0].onchange({ target: { value: "3" } });
      assert(last.noteheadRules[1].apply.heightSemis === 3, "height edited");
      assert(Math.abs(last.noteheadRules[1].apply.widthSemis - 3 * ratio) < 1e-4, "width at the natural ratio");
      // Unlock: the width is free and the height no longer moves it.
      findAll(row(), "cnb-nre-size-lock")[0].onchange({ target: { checked: false } });
      assert(findAll(row(), "cnb-nre-size-width")[0].disabled === false, "width editable when unlocked");
      findAll(row(), "cnb-nre-size-width")[0].onchange({ target: { value: "1.2" } });
      assert(last.noteheadRules[1].apply.widthSemis === 1.2, "width set freely");
      findAll(row(), "cnb-nre-size-height")[0].onchange({ target: { value: "2.5" } });
      assert(last.noteheadRules[1].apply.widthSemis === 1.2, "width untouched by the height while unlocked");
      // Relock: the width returns to the ratio.
      findAll(row(), "cnb-nre-size-lock")[0].onchange({ target: { checked: true } });
      assert(Math.abs(last.noteheadRules[1].apply.widthSemis - 2.5 * ratio) < 1e-4, "relocking restores the ratio");
      last = null;
      findAll(row(), "cnb-nre-size-height")[0].onchange({ target: { value: "" } });
      assert(last === null, "empty input ignored");
    }),
  },
  {
    name: "size: a size-only rule takes its ratio and hint from the shape an earlier rule chose, not the first shape",
    fn: () => withDomStub((container) => {
      let last = null;
      const config = CNBConfig.createDefault();
      const a = config.shapes["crotchet-minim"];               // first shape, ratio ≈ 1.266
      config.shapes["square-b"] = { ...a, displayName: "Square B", naturalWidth: 100, naturalHeight: 100, semitoneHeight: 2 };
      config.noteheadRules = [
        { name: "Use B", priority: 0, match: { pitchClasses: "all", durations: "all", keys: "all" },
          apply: { shape: "square-b", hollow: false } },
        { name: "Size only", priority: 1, match: { pitchClasses: "all", durations: "all", keys: "all" }, apply: {} },
      ];
      const api = E.render(container, { config, onChange: (s) => { last = s; } });
      const row = () => findAll(api.root, "cnb-nre-apply-size")[1];
      findAll(row(), "cnb-nre-apply-check")[0].onchange({ target: { checked: true } });
      assert(last.noteheadRules[1].apply.heightSemis === 2, `seeded B's height: ${last.noteheadRules[1].apply.heightSemis}`);
      assert(last.noteheadRules[1].apply.widthSemis === 2, `seeded B's natural width: ${last.noteheadRules[1].apply.widthSemis}`);
      const hint = findAll(row(), "cnb-nre-size-hint")[0].textContent;
      assert(hint === "natural width 2 at height 2", `hint from B: ${hint}`);
      findAll(row(), "cnb-nre-size-height")[0].onchange({ target: { value: "3" } });
      assert(last.noteheadRules[1].apply.widthSemis === 3, `locked width at B's 1:1 ratio: ${last.noteheadRules[1].apply.widthSemis}`);
    }),
  },
  {
    name: "size: the hint shows the shape's natural width; the preview cell draws the resolved size",
    fn: () => withDomStub((container) => {
      const config = CNBConfig.createDefault();
      const shape = config.shapes["crotchet-minim"];
      config.noteheadRules[1].apply.heightSemis = 1;
      config.noteheadRules[1].apply.widthSemis = 3;
      const api = E.render(container, { config });
      const hint = findAll(findAll(api.root, "cnb-nre-apply-size")[1], "cnb-nre-size-hint")[0];
      const ownW = Math.round(shape.semitoneHeight * shape.naturalWidth / shape.naturalHeight * 10000) / 10000;
      assert(hint.textContent === `natural width ${ownW} at height ${shape.semitoneHeight}`, `hint: ${hint.textContent}`);
      const host = makeHtmlStubElement("div");
      const { cells } = E.renderResolvedPreview(host, config, { pxPerSemi: 16 });
      const sx = 3 * 16 / shape.naturalWidth, sy = 1 * 16 / shape.naturalHeight;
      const sharpPath = cells[1].svg.children[0].children[0];
      assert(sharpPath.getAttribute("transform") === `scale(${sx},${sy})`, `sized cell: ${sharpPath.getAttribute("transform")}`);
      const plainPath = cells[0].svg.children[0].children[0];
      assert(plainPath.getAttribute("transform") === `scale(${shape.semitoneHeight * 16 / shape.naturalHeight})`, "unsized cell unchanged");
    }),
  },
  {
    name: "render: the off-key mark row carries a Preview only badge saying it is not drawn or exported yet (session 29)",
    fn: () => withDomStub((container) => {
      const handle = E.render(container, {});
      const rows = findAll(handle.root, "cnb-nre-apply-mark");
      assert(rows.length > 0, "every rule card has an off-key mark row");
      for (const row of rows) {
        const badges = findAll(row, "cnb-badge");
        assert(badges.length === 1 && badges[0].textContent === "Preview only", "one Preview only badge");
        assert(badges[0].title === E.OFF_KEY_MARK_TOOLTIP, "its tooltip");
      }
      assert(/not drawn in the preview or exported yet/.test(E.OFF_KEY_MARK_TOOLTIP), "the tooltip says why");
      assert(findAll(findAll(handle.root, "cnb-nre-apply-shape")[0] || { children: [] }, "cnb-badge").length === 0,
        "other apply rows carry no badge");
    }),
  },
];
