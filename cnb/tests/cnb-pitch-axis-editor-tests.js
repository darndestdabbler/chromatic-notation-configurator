/**
 * cnb-pitch-axis-editor-tests.js — Unit tests for the Pitch Axis Editor
 * (set 014 session 4)
 *
 * Covers the pure builders (buildPitchAxis / applyToConfig /
 * stateFromConfig), the Twinline-like preset compilation (applyPreset), the
 * absent-section byte-identity rule, and the render() UI driven against a
 * stub DOM with the Module A validation pass-through.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBPitchAxisEditor } from "../ui/pitch-axis-editor.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function deepEq(a, b, msg) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${msg || "deepEq"}: expected ${jb}, got ${ja}`);
}

function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch (_) { threw = true; }
  if (!threw) throw new Error(msg || "expected function to throw");
}

// ─── HTML DOM stub (element-property event wiring, textContent clearing) ────
// Same stub pattern as the Module 12–17 editor tests.

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

function findAll(el, token) {
  const out = [];
  for (const child of el.children || []) {
    if (String(child.className || "").split(/\s+/).includes(token)) out.push(child);
    out.push(...findAll(child, token));
  }
  return out;
}

function subtreeText(el) {
  let out = String(el.textContent || "");
  for (const child of el.children || []) out += subtreeText(child);
  return out;
}

function loadTwinline() {
  const text = readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json"), "utf8");
  return CNBConfigIO.loadFromText(text).config;
}

const E = CNBPitchAxisEditor;
const TWINLINE_POSITIONS = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

export const tests = [

  // ── stateFromConfig ────────────────────────────────────────────────────
  { name: "stateFromConfig: absent section opens as the linear degeneracy, not present", fn: () => {
    const s = E.stateFromConfig(CNBConfig.createDefault());
    eq(s.present, false, "present");
    eq(s.enabled, false, "enabled");
    eq(s.kind, "pitch-class-map-v1", "kind");
    eq(s.octaveStride, 12, "stride");
    eq(s.axisUnitsPerStaffSpace, 4, "units = staff.semitonesPerStaffSpace");
    deepEq(s.positions, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], "identity positions");
  }},

  { name: "stateFromConfig: reads the Twinline fixture's section", fn: () => {
    const s = E.stateFromConfig(loadTwinline());
    eq(s.present, true, "present");
    eq(s.enabled, true, "enabled");
    eq(s.octaveStride, 7, "stride");
    eq(s.axisUnitsPerStaffSpace, 2, "units");
    deepEq(s.positions, TWINLINE_POSITIONS, "positions");
  }},

  { name: "stateFromConfig: malformed map entries fall back per pc; unknown kind kept for validation", fn: () => {
    const config = CNBConfig.createDefault();
    config.pitchAxis = { enabled: true, kind: "future-kind", octaveStride: "x",
      pitchClasses: [{ pc: 3, position: 1.5 }, { pc: 99, position: 0 }, null] };
    const s = E.stateFromConfig(config);
    eq(s.kind, "future-kind", "kind kept");
    eq(s.octaveStride, 12, "bad stride falls back");
    eq(s.positions[3], 1.5, "valid entry read");
    eq(s.positions[4], 4, "missing entry identity");
  }},

  // ── buildPitchAxis / applyToConfig ─────────────────────────────────────
  { name: "buildPitchAxis → stateFromConfig round-trips the fixture section exactly", fn: () => {
    const config = loadTwinline();
    deepEq(E.buildPitchAxis(E.stateFromConfig(config)), config.pitchAxis, "round-trip");
  }},

  { name: "buildPitchAxis: throws on structurally invalid state", fn: () => {
    const good = E.stateFromConfig(loadTwinline());
    assertThrows(() => E.buildPitchAxis(null), "null state");
    assertThrows(() => E.buildPitchAxis({ ...good, octaveStride: NaN }), "NaN stride");
    assertThrows(() => E.buildPitchAxis({ ...good, axisUnitsPerStaffSpace: "2" }), "string units");
    assertThrows(() => E.buildPitchAxis({ ...good, positions: [0, 1] }), "short positions");
    assertThrows(() => E.buildPitchAxis({ ...good, kind: 3 }), "non-string kind");
  }},

  { name: "buildPitchAxis: range problems are NOT thrown (left to Module A validation)", fn: () => {
    const s = { ...E.stateFromConfig(loadTwinline()), octaveStride: 0 };
    const config = E.applyToConfig(loadTwinline(), s);
    const v = CNBConfig.validate(config);
    assert(!v.valid && v.errors.some((m) => m.includes("octaveStride")), "PA-3 reported");
  }},

  { name: "applyToConfig: absent section + enabled unchecked leaves the config byte-identical", fn: () => {
    const config = CNBConfig.createDefault();
    const out = E.applyToConfig(config, E.stateFromConfig(config));
    assert(!("pitchAxis" in out), "no pitchAxis section created");
    eq(JSON.stringify(out), JSON.stringify(config), "byte-identical JSON");
  }},

  { name: "applyToConfig: does not mutate its inputs and touches no other section", fn: () => {
    const config = loadTwinline();
    const before = JSON.stringify(config);
    const state = { ...E.stateFromConfig(config), octaveStride: 8 };
    const out = E.applyToConfig(config, state);
    eq(JSON.stringify(config), before, "input unchanged");
    eq(out.pitchAxis.octaveStride, 8, "stride applied");
    deepEq(out.noteheadRules, config.noteheadRules, "rules untouched");
    deepEq(out.staff, config.staff, "staff untouched");
  }},

  // ── applyPreset ────────────────────────────────────────────────────────
  { name: "applyPreset twinline-7: compiles into the design §1.1 map (= the fixture's section)", fn: () => {
    const { pitchAxis } = E.applyPreset(CNBConfig.createDefault(), "twinline-7");
    deepEq(pitchAxis, loadTwinline().pitchAxis, "map");
  }},

  { name: "applyPreset twinline-7: appends one offset rule on the upper shared members at top priority", fn: () => {
    const config = CNBConfig.createDefault();
    const { noteheadRules } = E.applyPreset(config, "twinline-7");
    eq(noteheadRules.length, config.noteheadRules.length + 1, "one rule added");
    const rule = noteheadRules[noteheadRules.length - 1];
    deepEq(rule.match.pitchClasses, [1, 4, 6, 9, 11], "upper members");
    deepEq(rule.apply, { xOffsetStaffSpaces: 0.85 }, "apply only the offset");
    const maxOther = Math.max(...config.noteheadRules.map((r) => r.priority));
    eq(rule.priority, maxOther + 1, "highest priority");
    deepEq(noteheadRules.slice(0, -1), config.noteheadRules, "existing rules kept");
  }},

  { name: "applyPreset: applying twice does not duplicate the offset rule", fn: () => {
    const config = CNBConfig.createDefault();
    const once = E.applyPreset(config, "twinline-7");
    const twice = E.applyPreset({ ...config, noteheadRules: once.noteheadRules }, "twinline-7");
    deepEq(twice.noteheadRules, once.noteheadRules, "idempotent");
  }},

  { name: "applyPreset: the compiled default config validates and exports", fn: () => {
    const config = CNBConfig.createDefault();
    const { pitchAxis, noteheadRules } = E.applyPreset(config, "twinline-7");
    config.pitchAxis = pitchAxis;
    config.noteheadRules = noteheadRules;
    const v = CNBConfig.validate(config);
    assert(v.valid, "valid: " + v.errors.join("; "));
    const ly = CNBLilypond.generate(config);
    assert(ly.includes("cnb:get-pitch-staff-position"), "axis procedure emitted");
    assert(/\(x-offset\s+\. 0\.85\)/.test(ly), "offset emitted");
  }},

  { name: "applyPreset: unknown preset throws", fn: () => {
    assertThrows(() => E.applyPreset(CNBConfig.createDefault(), "nope"));
  }},

  // ── render ─────────────────────────────────────────────────────────────
  { name: "render: draws all sections, 12 position inputs, and a valid-config note", fn: () => withDomStub((container) => {
    const api = E.render(container, { config: loadTwinline() });
    eq(container.children[0], api.root, "mounted");
    for (const cls of ["cnb-pae-enable", "cnb-pae-preset", "cnb-pae-fields", "cnb-pae-positions", "cnb-pae-validation"]) {
      eq(findAll(api.root, cls).length, 1, cls);
    }
    eq(findAll(api.root, "cnb-pae-position-input").length, 12, "12 inputs");
    eq(findAll(api.root, "cnb-pae-valid").length, 1, "valid note");
  })},

  { name: "render: opening on a default config fires no change and yields no section", fn: () => withDomStub((container) => {
    let calls = 0;
    const api = E.render(container, { config: CNBConfig.createDefault(), onChange: () => { calls++; } });
    eq(calls, 0, "no onChange on mount");
    eq(api.getPitchAxis(), null, "no section");
  })},

  { name: "render: enabling creates the section (linear degeneracy) via onChange", fn: () => withDomStub((container) => {
    let last = null;
    const api = E.render(container, { config: CNBConfig.createDefault(), onChange: (s) => { last = s; } });
    const cb = findAll(api.root, "cnb-pae-enable-check")[0];
    cb.onchange({ target: { checked: true } });
    eq(last.pitchAxis.enabled, true, "enabled");
    eq(last.pitchAxis.octaveStride, 12, "linear stride");
    assert(!("noteheadRules" in last), "rules not reported");
  })},

  { name: "render: editing stride and a position reports the new section; bad input ignored", fn: () => withDomStub((container) => {
    let last = null;
    const api = E.render(container, { config: loadTwinline(), onChange: (s) => { last = s; } });
    findAll(api.root, "cnb-pae-stride-input")[0].onchange({ target: { value: "8" } });
    eq(last.pitchAxis.octaveStride, 8, "stride");
    findAll(api.root, "cnb-pae-position-input")[11].onchange({ target: { value: "6.5" } });
    eq(last.pitchAxis.pitchClasses[11].position, 6.5, "pc 11 position");
    last = null;
    findAll(api.root, "cnb-pae-units-input")[0].onchange({ target: { value: "abc" } });
    eq(last, null, "non-numeric input ignored");
  })},

  { name: "render: a non-monotonic map is reported by the validation pass-through", fn: () => withDomStub((container) => {
    const api = E.render(container, { config: loadTwinline() });
    findAll(api.root, "cnb-pae-position-input")[2].onchange({ target: { value: "-1" } });
    const errors = findAll(api.root, "cnb-pae-error").map(subtreeText).join(" ");
    assert(errors.includes("non-decreasing"), "PA-8 shown: " + errors);
  })},

  { name: "render: preset button reports the compiled map and the new rules", fn: () => withDomStub((container) => {
    let last = null;
    const api = E.render(container, { config: CNBConfig.createDefault(), onChange: (s) => { last = s; } });
    findAll(api.root, "cnb-pae-preset-apply")[0].onclick();
    deepEq(last.pitchAxis, loadTwinline().pitchAxis, "map");
    eq(last.noteheadRules[last.noteheadRules.length - 1].apply.xOffsetStaffSpaces, 0.85, "offset rule");
    eq(findAll(api.root, "cnb-pae-enable-check")[0].checked, true, "panel shows enabled");
    eq(findAll(api.root, "cnb-pae-valid").length, 1, "valid after preset");
  })},
];
