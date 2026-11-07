/**
 * cnb-pitch-panel-tests.js — Unit tests for the Pitch section (session 28,
 * design docs/planning/notehead-first-editor-design.md §3, mock-up 3)
 *
 * Covers the controls on the default config and on Twinline (the §3.3
 * nudges and the shared marks), the middle of the staff, the staff spacing,
 * a nudge change and its limits, C fixed as the reference, every nudge
 * back at 0, the custom-map fallback (§3.5), a stride-7 map kept until a
 * control changes, and nudgeControl on its own.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBPitchPanel } from "../ui/pitch-panel.js";
import { CNBPitchModel as P } from "../ui/pitch-model.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBConfig } from "../src/cnb-config.js";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function near(a, b, tol, msg) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg || "near"}: expected ${b} ± ${tol}, got ${a}`);
}

// ─── HTML DOM stub (element-property event wiring, textContent clearing) ────

function makeStubElement(tag) {
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
    createElement: (tag) => makeStubElement(tag),
    createElementNS: (_ns, tag) => makeStubElement(tag),
  };
  try {
    return fn(makeStubElement("div"));
  } finally {
    if (had) globalThis.document = prev;
    else delete globalThis.document;
  }
}

/** All descendants (depth-first) whose className includes the token. */
function findAll(el, token) {
  const out = [];
  for (const child of el.children || []) {
    if (String(child.className || "").split(/\s+/).includes(token)) out.push(child);
    out.push(...findAll(child, token));
  }
  return out;
}

function findOne(el, token) {
  const all = findAll(el, token);
  if (all.length !== 1) throw new Error(`expected one .${token}, found ${all.length}`);
  return all[0];
}

function twinline() {
  const file = path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json");
  return CNBConfigIO.loadFromText(readFileSync(file, "utf8")).config;
}

/** A default config with these nudges written as a stride-12 axis. */
function nudged(nudges) {
  return P.writeNudges(CNBConfig.createDefault(), nudges, 4);
}

/** Render the section on a held config; changes replace it. */
function mount(container, config, extra = {}) {
  const state = { config, changes: 0, advanced: 0 };
  const api = CNBPitchPanel.render(container, {
    getConfig: () => state.config,
    onChange: (c) => { state.config = c; state.changes++; },
    onOpenAdvanced: () => { state.advanced++; },
    ...extra,
  });
  const control = (pc) => findAll(api.root, "cnb-pp-nudge").find(c => c.getAttribute("data-pc") === String(pc));
  return { api, state, control };
}

const field = (control) => findOne(control, "cnb-pp-nudge-field");
const ZEROS = Array(12).fill(0);
const TWINLINE_NUDGES = [0, -1, -0.29, 0.43, -0.57, 0.14, -0.86, -0.14, 0.57, -0.43, 0.29, -0.71];

export const tests = [

  { name: "render: the default config shows C in the middle, spacing 4, and twelve nudges at 0 with C fixed", fn: () => {
      withDomStub(container => {
        const { api, state, control } = mount(container, CNBConfig.createDefault());
        assert(container.children.includes(api.root), "appended");
        eq(findOne(api.root, "cnb-pp-middle").value, "0", "middle of the staff: C");
        eq(findOne(api.root, "cnb-pp-spacing").value, "4", "spacing");
        eq(findOne(api.root, "cnb-pp-spacing").disabled, false, "spacing editable");
        eq(findAll(api.root, "cnb-pp-nudge").length, 12, "twelve nudges");
        for (let pc = 0; pc < 12; pc++) {
          eq(field(control(pc)).value, "0", `pc ${pc} at 0`);
          eq(findAll(control(pc), "cnb-pp-nudge-shares").length, 0, `pc ${pc} shares nothing`);
        }
        eq(field(control(0)).disabled, true, "C fixed");
        eq(findOne(control(0), "cnb-pp-nudge-slider").disabled, true, "C's slider fixed");
        eq(field(control(5)).disabled, false, "F editable");
        eq(findAll(api.root, "cnb-pp-custom").length, 0, "no custom-map note");
        eq(state.changes, 0, "drawing writes nothing");
      });
    }},

  { name: "render: Twinline shows the §3.3 nudges and marks the five shared pairs", fn: () => {
      withDomStub(container => {
        const { api, state, control } = mount(container, twinline());
        TWINLINE_NUDGES.forEach((n, pc) => near(Number(field(control(pc)).value), n, 0.005, `pc ${pc}`));
        eq(findOne(control(1), "cnb-pp-nudge-value").textContent, "−1.00", "C♯ shown as −1.00");
        eq(findOne(control(3), "cnb-pp-nudge-value").textContent, "+0.43", "D♯ shown as +0.43");
        for (let pc = 0; pc < 12; pc++) {
          const shared = ![2, 7].includes(pc);
          eq(findAll(control(pc), "cnb-pp-nudge-shares").length, shared ? 1 : 0, `pc ${pc} shares`);
        }
        near(Number(findOne(api.root, "cnb-pp-spacing").value), 12 / 3.5, 1e-4, "spacing 3.43");
        eq(findOne(api.root, "cnb-pp-middle").value, "7", "middle of the staff: G");
        eq(state.changes, 0, "the stride-7 map is not rewritten by drawing");
      });
    }},

  { name: "middle of the staff: choosing G moves the pitch by −5 from C", fn: () => {
      withDomStub(container => {
        const before = CNBConfig.createDefault();
        const { api, state } = mount(container, before);
        const select = findOne(api.root, "cnb-pp-middle");
        select.onchange({ target: { value: "7" } });
        eq(state.changes, 1, "one change");
        eq(JSON.stringify(state.config), JSON.stringify(P.shiftPitch(before, -5)), "shiftPitch by renameDelta(C, G)");
        eq(state.config.staff.midpoint, 7, "midpoint G");
        eq(findOne(api.root, "cnb-pp-middle").value, "7", "redrawn at G");
        findOne(api.root, "cnb-pp-middle").onchange({ target: { value: "7" } });
        eq(state.changes, 1, "the same middle writes nothing");
      });
    }},

  { name: "staff spacing: a decimal is written; zero, negative or not a number is refused", fn: () => {
      withDomStub(container => {
        const { api, state } = mount(container, CNBConfig.createDefault());
        findOne(api.root, "cnb-pp-spacing").onchange({ target: { value: "3.5" } });
        eq(state.changes, 1, "written");
        eq(state.config.staff.semitonesPerStaffSpace, 3.5, "decimal spacing");
        assert(!("pitchAxis" in state.config), "no nudges: still no pitch axis");
        for (const bad of ["0", "-2", "abc", ""]) {
          findOne(api.root, "cnb-pp-spacing").onchange({ target: { value: bad } });
          eq(state.changes, 1, `${JSON.stringify(bad)} refused`);
          eq(findOne(api.root, "cnb-pp-error").textContent, "The staff spacing must be a number above 0.", "says why");
        }
        findOne(api.root, "cnb-pp-spacing").onchange({ target: { value: "3" } });
        eq(state.changes, 2, "a good value after a bad one");
        eq(findAll(api.root, "cnb-pp-error").length, 0, "the message goes");
      });
    }},

  { name: "nudges: a change is written as a stride-12 axis; it is clamped to its limits, which the bar shades", fn: () => {
      withDomStub(container => {
        const { state, control } = mount(container, CNBConfig.createDefault());
        field(control(2)).onchange({ target: { value: "-0.5" } });
        eq(state.changes, 1, "written");
        eq(state.config.pitchAxis.octaveStride, 12, "stride 12");
        eq(state.config.pitchAxis.pitchClasses[2].position, 1.5, "D at 1.5");
        // C♯ now stops at D: max = min(1, −0.5 + 1) = 0.5.
        const reach = findOne(control(1), "cnb-pp-nudge-reach");
        eq(reach.style.left, "0%", "reach starts at −1");
        eq(reach.style.width, "75%", "and ends at +0.5");
        field(control(1)).onchange({ target: { value: "0.9" } });
        eq(P.readNudges(state.config).nudges[1], 0.5, "clamped to D's spot");
        assert(findAll(control(1), "cnb-pp-nudge-shares").length === 1, "C♯ now shares D's spot");
        assert(findAll(control(2), "cnb-pp-nudge-shares").length === 1, "and D shares C♯'s");
        field(control(1)).onchange({ target: { value: "-3" } });
        eq(P.readNudges(state.config).nudges[1], -1, "clamped to −1");
        const slider = findOne(control(4), "cnb-pp-nudge-slider");
        slider.oninput({ target: { value: "0.25" } });
        eq(findOne(control(4), "cnb-pp-nudge-value").textContent, "+0.25", "the slider shows its value while moving");
        const changes = state.changes;
        slider.onchange({ target: { value: "0.25" } });
        eq(state.changes, changes + 1, "and writes on release");
      });
    }},

  { name: "nudges: C cannot be nudged, and every nudge back at 0 removes pitchAxis", fn: () => {
      withDomStub(container => {
        const { state, control } = mount(container, nudged([0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        field(control(0)).onchange({ target: { value: "0.5" } });
        eq(state.changes, 0, "C is the reference");
        field(control(2)).onchange({ target: { value: "0" } });
        eq(state.changes, 1, "D back at 0");
        assert(!("pitchAxis" in state.config), "the section is removed");
      });
    }},

  { name: "custom pitch axis: the section says so, disables the spacing and nudges, and opens Advanced", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.pitchAxis = { enabled: true, kind: "pitch-class-map-v1", octaveStride: 12, axisUnitsPerStaffSpace: 4,
        pitchClasses: [0, 0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((position, pc) => ({ pc, position })) };
      withDomStub(container => {
        const { api, state, control } = mount(container, cfg);
        const note = findOne(api.root, "cnb-pp-custom");
        assert(findOne(note, "cnb-pp-custom-text").textContent.startsWith(
          "This file uses a custom pitch axis that nudges can't show"), "the message");
        eq(findOne(api.root, "cnb-pp-spacing").disabled, true, "spacing disabled");
        for (let pc = 0; pc < 12; pc++) eq(field(control(pc)).disabled, true, `pc ${pc} disabled`);
        field(control(5)).onchange({ target: { value: "0.5" } });
        findOne(api.root, "cnb-pp-spacing").onchange({ target: { value: "3" } });
        eq(state.changes, 0, "the map is never rewritten");
        findOne(note, "cnb-pp-open-advanced").onclick();
        eq(state.advanced, 1, "opens Advanced › Pitch axis map");
        eq(findOne(api.root, "cnb-pp-middle").disabled, undefined, "the middle of the staff still works");
      });
    }},

  { name: "stride-7 Twinline is kept until a control changes, then written at stride 12 with the same picture", fn: () => {
      const before = twinline();
      withDomStub(container => {
        const { api, state } = mount(container, before);
        api.redraw();
        eq(state.changes, 0, "redrawn, not written");
        eq(state.config.pitchAxis.octaveStride, 7, "still stride 7");
        const read = P.readNudges(before);
        findOne(api.root, "cnb-pp-spacing").onchange({ target: { value: "3.5" } });
        eq(state.changes, 1, "a spacing change writes");
        eq(state.config.pitchAxis.octaveStride, 12, "now stride 12");
        P.readNudges(state.config).nudges.forEach((n, pc) => near(n, read.nudges[pc], 1e-4, `pc ${pc} nudge kept`));
        eq(state.config.staff.semitonesPerStaffSpace, 3.5, "the new spacing");
      });
    }},

  { name: "nudgeControl: one pitch class's control, as the notehead panel uses it", fn: () => {
      withDomStub(container => {
        const changes = [];
        const cfg = nudged([0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        const control = CNBPitchPanel.nudgeControl(container, { config: cfg, pc: 1, onChange: (c) => changes.push(c) });
        assert(container.children.includes(control), "appended");
        eq(findOne(control, "cnb-pp-nudge-name").textContent, "C♯", "named");
        eq(findAll(control, "cnb-pp-nudge-shares").length, 1, "C♯ on C's spot");
        field(control).onchange({ target: { value: "-0.5" } });
        eq(changes.length, 1, "reported");
        eq(P.readNudges(changes[0]).nudges[1], -0.5, "the new nudge");
        eq(CNBPitchPanel.formatNudge(0), "0", "0 shown bare");
        eq(CNBPitchPanel.shares(ZEROS, 3), false, "no nudges, no sharing");
      });
    }},

  { name: "render: requires getConfig", fn: () => {
      let threw = false;
      try { CNBPitchPanel.render({}, {}); } catch { threw = true; }
      assert(threw, "throws without getConfig");
    }},
];
