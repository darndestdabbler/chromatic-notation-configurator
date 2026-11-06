/**
 * cnb-preview-display-tests.js — Unit tests for Module 19 (Preview Display)
 *
 * Covers the pure helpers (pcOptionLabel, durationNames with the Modules
 * 11/18 fallback, keyNames gated on keys.enabled, buildPitchClasses with
 * every throw branch, defaultState, buildOptions with the prune-at-build
 * rules and its throw branches) and the render() UI driven against a stub
 * DOM: control structure, the live Module 10 preview (real CNBCollection
 * under the stub), duration pill toggling down to the explicit empty
 * state, the range endpoint-drag rule, key selection with the deferral
 * note (including the enabled-but-no-definitions visible empty state),
 * setState validation, redraw() following host config changes (duration
 * vocabulary and background staff geometry, the latter cross-checked
 * against CNBStaff.getPositions), and the collection injection seam.
 */

import { CNBPreviewDisplay } from "../ui/preview-display.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBCollection } from "../src/cnb-collection.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || "values differ"}: expected ${e}, got ${a}`);
}

function assertThrows(fn, msgPart, label) {
  let threw = null;
  try { fn(); } catch (err) { threw = err; }
  if (!threw) throw new Error(label || "expected function to throw");
  if (msgPart && !String(threw.message).includes(msgPart)) {
    throw new Error(`${label || "throw"}: message ${JSON.stringify(threw.message)} lacks ${JSON.stringify(msgPart)}`);
  }
}

// ─── HTML DOM stub (element-property event wiring, textContent clearing) ────
// Same stub pattern as the Module 12–18 tests.

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

function findOne(el, token, label) {
  const all = findAll(el, token);
  if (all.length !== 1) {
    throw new Error(`${label || token}: expected exactly 1 .${token}, found ${all.length}`);
  }
  return all[0];
}

/** All descendants (depth-first) whose class ATTRIBUTE equals the value
 *  (SVG elements set class via setAttribute, not the className property). */
function findAllByClassAttr(el, cls) {
  const out = [];
  for (const child of el.children || []) {
    if (typeof child.getAttribute === "function" && child.getAttribute("class") === cls) out.push(child);
    out.push(...findAllByClassAttr(child, cls));
  }
  return out;
}

/** Count all descendants (depth-first) with the given stub tag name. */
function countTag(el, tag) {
  let n = 0;
  for (const child of el.children || []) {
    if (child.tag === tag) n++;
    n += countTag(child, tag);
  }
  return n;
}

const PVD = CNBPreviewDisplay;

/** Default config with keys enabled and two key definitions. */
function keyedConfig() {
  const cfg = CNBConfig.createDefault();
  cfg.keys = {
    enabled: true,
    definitions: [
      { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
      { name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11] },
    ],
    offKeyMark: {},
  };
  return cfg;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // ── pcOptionLabel ──
  {
    name: "pcOptionLabel: naturals, sharps, and the upper C prime (0→C, 1→C♯, 11→B, 12→C′)",
    fn: () => {
      assertEqual(PVD.pcOptionLabel(0), "C");
      assertEqual(PVD.pcOptionLabel(1), "C♯");
      assertEqual(PVD.pcOptionLabel(11), "B");
      assertEqual(PVD.pcOptionLabel(12), "C′");
    },
  },

  // ── durationNames ──
  {
    name: "durationNames: definition order from the config (default → crotchet/minim/semibreve/breve)",
    fn: () => {
      assertEqual(PVD.durationNames(CNBConfig.createDefault()),
        ["crotchet", "minim", "semibreve", "breve"]);
    },
  },
  {
    name: 'durationNames: falls back to ["crotchet"] when the config defines none (Modules 11/18 fallback)',
    fn: () => {
      assertEqual(PVD.durationNames({}), ["crotchet"], "missing durations section");
      assertEqual(PVD.durationNames({ durations: { definitions: [] } }), ["crotchet"], "empty definitions");
    },
  },

  // ── keyNames ──
  {
    name: "keyNames: [] when keys are disabled (default config) even if definitions exist",
    fn: () => {
      assertEqual(PVD.keyNames(CNBConfig.createDefault()), [], "default config");
      const cfg = keyedConfig();
      cfg.keys.enabled = false;
      assertEqual(PVD.keyNames(cfg), [], "disabled with definitions");
    },
  },
  {
    name: "keyNames: definition names when keys.enabled; [] when enabled without definitions",
    fn: () => {
      assertEqual(PVD.keyNames(keyedConfig()), ["C", "G"]);
      const cfg = keyedConfig();
      cfg.keys.definitions = [];
      assertEqual(PVD.keyNames(cfg), []);
    },
  },

  // ── buildPitchClasses ──
  {
    name: "buildPitchClasses: inclusive contiguous ranges (0–12 full row, 3–7 subrange, single PC)",
    fn: () => {
      assertEqual(PVD.buildPitchClasses(0, 12), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      assertEqual(PVD.buildPitchClasses(3, 7), [3, 4, 5, 6, 7]);
      assertEqual(PVD.buildPitchClasses(5, 5), [5]);
    },
  },
  {
    name: "buildPitchClasses: throws on an inverted range",
    fn: () => assertThrows(() => PVD.buildPitchClasses(7, 3), "inverted"),
  },
  {
    name: "buildPitchClasses: throws on non-integer and out-of-range endpoints",
    fn: () => {
      assertThrows(() => PVD.buildPitchClasses(1.5, 4), "fromPc", "non-integer from");
      assertThrows(() => PVD.buildPitchClasses(0, "12"), "toPc", "string to");
      assertThrows(() => PVD.buildPitchClasses(-1, 4), "fromPc", "below 0");
      assertThrows(() => PVD.buildPitchClasses(0, 13), "toPc", "above 12");
    },
  },

  // ── defaultState ──
  {
    name: "defaultState: full chromatic row, first config duration, no key",
    fn: () => {
      assertEqual(PVD.defaultState(CNBConfig.createDefault()),
        { fromPc: 0, toPc: 12, durations: ["crotchet"], key: null });
    },
  },
  {
    name: "defaultState: fallback duration when the config defines none",
    fn: () => {
      assertEqual(PVD.defaultState({}).durations, ["crotchet"]);
    },
  },

  // ── buildOptions ──
  {
    name: "buildOptions: default state → full row, single crotchet row, keys null",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const options = PVD.buildOptions(cfg, PVD.defaultState(cfg));
      assertEqual(options.pitchClasses.length, 13);
      assertEqual(options.durations, ["crotchet"]);
      assertEqual(options.keys, null);
    },
  },
  {
    name: "buildOptions: durations pruned against the CURRENT config vocabulary (retain in state, prune at build)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const state = { fromPc: 0, toPc: 12, durations: ["crotchet", "longa"], key: null };
      assertEqual(PVD.buildOptions(cfg, state).durations, ["crotchet"],
        "stale name pruned, state untouched");
      assertEqual(state.durations, ["crotchet", "longa"], "selection retained in state");
    },
  },
  {
    name: "buildOptions: durations come out in config vocabulary order regardless of selection order",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const state = { fromPc: 0, toPc: 12, durations: ["minim", "crotchet"], key: null };
      assertEqual(PVD.buildOptions(cfg, state).durations, ["crotchet", "minim"]);
    },
  },
  {
    name: "buildOptions: key passes through only when keys.enabled AND currently defined",
    fn: () => {
      const state = { fromPc: 0, toPc: 12, durations: ["crotchet"], key: "G" };
      assertEqual(PVD.buildOptions(keyedConfig(), state).keys, ["G"], "enabled + defined");
      const undefinedKey = keyedConfig();
      undefinedKey.keys.definitions = [{ name: "C", pitchClasses: [0] }];
      assertEqual(PVD.buildOptions(undefinedKey, state).keys, null, "key no longer defined");
      assertEqual(PVD.buildOptions(CNBConfig.createDefault(), state).keys, null, "keys disabled");
    },
  },
  {
    name: "buildOptions: throws on malformed state (non-object, non-array durations, non-string key, inverted range)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      assertThrows(() => PVD.buildOptions(cfg, null), "must be an object");
      assertThrows(() => PVD.buildOptions(cfg, { fromPc: 0, toPc: 12, durations: "crotchet", key: null }),
        "must be an array");
      assertThrows(() => PVD.buildOptions(cfg, { fromPc: 0, toPc: 12, durations: [], key: 3 }),
        "must be a string or null");
      assertThrows(() => PVD.buildOptions(cfg, { fromPc: 9, toPc: 2, durations: [], key: null }),
        "inverted");
    },
  },

  // ── render: contract and structure ──
  {
    name: "render: throws without the getConfig accessor (the host owns config state)",
    fn: () => {
      withDomStub(container => {
        assertThrows(() => PVD.render(container), "getConfig");
      });
    },
  },
  {
    name: "render: root appended; controls hold two 13-option range selects and one pill per config duration; no key section when keys are disabled",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        assert(container.children[0] === api.root, "appended to container");
        assertEqual(api.root.className, "cnb-preview-display");
        const controls = findOne(api.root, "cnb-pvd-controls");
        const from = findOne(controls, "cnb-pvd-from");
        const to = findOne(controls, "cnb-pvd-to");
        assertEqual(from.children.length, 13, "from options 0–12");
        assertEqual(to.children.length, 13, "to options 0–12");
        assertEqual(from.children[1].textContent, "1 — C♯", "options labeled with note names");
        const pills = findAll(controls, "cnb-pvd-duration-pill");
        assertEqual(pills.map(p => p.getAttribute("data-duration")),
          ["crotchet", "minim", "semibreve", "breve"]);
        assertEqual(pills.filter(p => p.className.includes(" on")).length, 1, "only crotchet on");
        assertEqual(findAll(api.root, "cnb-pvd-key").length, 0, "no key section");
      });
    },
  },
  {
    name: "render: default preview drives the REAL Module 10 collection — 13 cards, one caption-less row",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const preview = findOne(api.root, "cnb-pvd-preview");
        findOne(preview, "cnb-preview", "collection root");
        assertEqual(findAll(preview, "pc-col").length, 13, "full chromatic row of cards");
        assertEqual(findAll(preview, "cnb-duration-caption").length, 0,
          "single duration row has no caption");
        assertEqual(findAll(api.root, "cnb-pvd-empty").length, 0, "no empty message");
      });
    },
  },
  {
    name: "render: onRender reports the exact collection options and the preview element",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const calls = [];
        const api = PVD.render(container, {
          getConfig: () => cfg,
          onRender: (options, target) => calls.push({ options, target }),
        });
        assertEqual(calls.length, 1, "one render on mount");
        assertEqual(calls[0].options, PVD.buildOptions(cfg, api.getState()));
        assert(calls[0].target === findOne(api.root, "cnb-pvd-preview"), "target is the preview element");
      });
    },
  },

  // ── render: duration pills ──
  {
    name: "render: toggling a second pill on renders two captioned duration rows; toggling it off returns to one",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const pill = (name) => findAll(api.root, "cnb-pvd-duration-pill")
          .find(p => p.getAttribute("data-duration") === name);
        pill("minim").onclick();
        assertEqual(api.getState().durations, ["crotchet", "minim"]);
        assertEqual(findAll(api.root, "cnb-duration-caption").length, 2, "two captioned rows");
        assertEqual(findAll(api.root, "pc-col").length, 26, "13 cards per row");
        pill("minim").onclick();
        assertEqual(api.getState().durations, ["crotchet"]);
        assertEqual(findAll(api.root, "cnb-duration-caption").length, 0, "back to one row");
      });
    },
  },
  {
    name: "render: deselecting every pill shows the explicit empty message, renders no collection, and reports onRender(options, null)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const calls = [];
        const api = PVD.render(container, {
          getConfig: () => cfg,
          onRender: (options, target) => calls.push({ options, target }),
        });
        findAll(api.root, "cnb-pvd-duration-pill")
          .find(p => p.getAttribute("data-duration") === "crotchet")
          .onclick();
        assertEqual(api.getState().durations, []);
        findOne(api.root, "cnb-pvd-empty");
        assertEqual(findAll(api.root, "cnb-pvd-preview").length, 0, "no preview element");
        const last = calls[calls.length - 1];
        assertEqual(last.options.durations, [], "empty options reported");
        assert(last.target === null, "null target reported");
      });
    },
  },

  // ── render: pitch range ──
  {
    name: "render: narrowing the range re-renders with fewer cards",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        findOne(api.root, "cnb-pvd-from").onchange({ target: { value: "4" } });
        assertEqual(api.getState().fromPc, 4);
        assertEqual(findAll(api.root, "pc-col").length, 9, "PCs 4–12");
        assertEqual(api.getOptions().pitchClasses, [4, 5, 6, 7, 8, 9, 10, 11, 12]);
      });
    },
  },
  {
    name: "render: endpoint-drag rule — moving one endpoint past the other drags the other along (both directions)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        findOne(api.root, "cnb-pvd-to").onchange({ target: { value: "3" } });
        assertEqual(api.getState(), { ...api.getState(), fromPc: 0, toPc: 3 });
        findOne(api.root, "cnb-pvd-from").onchange({ target: { value: "7" } });
        let s = api.getState();
        assertEqual([s.fromPc, s.toPc], [7, 7], "to dragged up to from");
        findOne(api.root, "cnb-pvd-to").onchange({ target: { value: "2" } });
        s = api.getState();
        assertEqual([s.fromPc, s.toPc], [2, 2], "from dragged down to to");
        assertEqual(findAll(api.root, "pc-col").length, 1, "single-column preview");
      });
    },
  },

  // ── render: key selection ──
  {
    name: "render: key section appears when keys.enabled — (none) + definitions, deferral note, selection passes through options.keys",
    fn: () => {
      const cfg = keyedConfig();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const keyWrap = findOne(api.root, "cnb-pvd-key");
        const select = findOne(keyWrap, "cnb-pvd-key-select");
        assertEqual(select.children.map(o => o.textContent), ["(none)", "C", "G"]);
        const note = findOne(keyWrap, "cnb-pvd-key-note");
        assert(note.textContent.includes("deferred"), "deferral note visible");
        assertEqual(api.getOptions().keys, null, "no key selected initially");
        findOne(api.root, "cnb-pvd-key-select").onchange({ target: { value: "G" } });
        assertEqual(api.getState().key, "G");
        assertEqual(api.getOptions().keys, ["G"]);
        findOne(api.root, "cnb-pvd-key-select").onchange({ target: { value: "" } });
        assertEqual(api.getState().key, null);
        assertEqual(api.getOptions().keys, null);
      });
    },
  },
  {
    name: "render: keys enabled with EMPTY definitions — section stays visible with a disabled (none) select and an explicit empty-definitions note; options.keys null",
    fn: () => {
      const cfg = keyedConfig();
      cfg.keys.definitions = [];
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const keyWrap = findOne(api.root, "cnb-pvd-key");
        const select = findOne(keyWrap, "cnb-pvd-key-select");
        assertEqual(select.children.map(o => o.textContent), ["(none)"], "only the (none) option");
        assert(select.disabled === true, "select disabled");
        const note = findOne(keyWrap, "cnb-pvd-key-note");
        assert(note.textContent.includes("nothing to select yet"), "empty-definitions note visible");
        assertEqual(api.getOptions().keys, null);
      });
    },
  },
  {
    name: "render: key signature enabled — the key note says no signature draws with no key defined, or with (none) selected",
    fn: () => {
      const cfg = keyedConfig();
      cfg.keys.keySignature = { enabled: true };
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const none = findOne(api.root, "cnb-pvd-key-none");
        assert(none.textContent.includes("No key is selected, so no key signature draws"), "(none) note visible");
        findOne(api.root, "cnb-pvd-key-select").onchange({ target: { value: "C" } });
        assertEqual(findAll(api.root, "cnb-pvd-key-none").length, 0, "note gone once a key is selected");
      });
      cfg.keys.definitions = [];
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const note = findOne(api.root, "cnb-pvd-key-note");
        assert(note.textContent.includes("No key is defined, so no key signature draws"), "no-definition note visible");
      });
      cfg.keys.keySignature.enabled = false;
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        assert(!findOne(api.root, "cnb-pvd-key-note").textContent.includes("key signature"), "silent while the signature is off");
      });
    },
  },
  {
    name: "render: a selected key survives the config disabling keys (section hidden, keys null) and returns when re-enabled",
    fn: () => {
      const cfg = keyedConfig();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        findOne(api.root, "cnb-pvd-key-select").onchange({ target: { value: "C" } });
        cfg.keys.enabled = false;
        api.redraw();
        assertEqual(findAll(api.root, "cnb-pvd-key").length, 0, "section hidden");
        assertEqual(api.getOptions().keys, null, "pruned at build");
        assertEqual(api.getState().key, "C", "retained in state");
        cfg.keys.enabled = true;
        api.redraw();
        assertEqual(findOne(api.root, "cnb-pvd-key-select").value, "C", "selection restored");
        assertEqual(api.getOptions().keys, ["C"]);
      });
    },
  },

  // ── render: state API and host redraw ──
  {
    name: "render: setState merges a partial, validates BEFORE adopting (invalid partial throws, state and DOM untouched)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        api.setState({ fromPc: 2, toPc: 6, durations: ["minim"] });
        assertEqual(api.getState(), { fromPc: 2, toPc: 6, durations: ["minim"], key: null });
        assertEqual(findAll(api.root, "pc-col").length, 5, "redrawn from new state");
        assertThrows(() => api.setState({ fromPc: 9 }), "inverted", "9 > 6 rejected");
        assertEqual(api.getState().fromPc, 2, "state untouched after rejected setState");
        assertThrows(() => api.setState("nope"), "expects an object");
      });
    },
  },
  {
    name: "render: getState returns a copy — mutating it does not affect the display",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const s = api.getState();
        s.durations.length = 0;
        s.fromPc = 11;
        assertEqual(api.getState(), { fromPc: 0, toPc: 12, durations: ["crotchet"], key: null });
      });
    },
  },
  {
    name: "render: redraw() follows host config changes — a new duration definition appears as a pill",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        cfg.durations.definitions.push({
          name: "longa", displayName: "Longa", lilypondDuration: -1,
          defaultShape: "crotchet-minim", defaultHollow: false, hasStem: false,
        });
        api.redraw();
        const pills = findAll(api.root, "cnb-pvd-duration-pill");
        assertEqual(pills.map(p => p.getAttribute("data-duration")),
          ["crotchet", "minim", "semibreve", "breve", "longa"]);
        assertEqual(api.getState().durations, ["crotchet"], "selection unchanged");
      });
    },
  },
  {
    name: "render: redraw() follows host config changes — a staff pattern change re-renders the preview's background staff (line count matches CNBStaff.getPositions on the same config)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const bgLineCount = () => {
          const bg = findAllByClassAttr(api.root, "staff-lines-bg");
          assertEqual(bg.length, 1, "one background staff SVG for the single row");
          return countTag(bg[0], "line");
        };
        const expectedFor = () => CNBStaff.getPositions(cfg, CNBCollection.gridRange(
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).length;
        const before = expectedFor();
        assertEqual(bgLineCount(), before, "default 4-8 staff line count");
        cfg.staff.semitonePattern = [3, 6, 9];
        cfg.staff.semitonesPerStaffSpace = 3;
        api.redraw();
        const after = expectedFor();
        assert(after !== before, `precondition: pattern change alters the line count (${before} vs ${after})`);
        assertEqual(bgLineCount(), after, "3-6-9 staff line count after redraw");
      });
    },
  },
  {
    name: "render: collection injection seam — the recorder receives (container, config, options) and replaces Module 10",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const calls = [];
        const api = PVD.render(container, {
          getConfig: () => cfg,
          collection: { render: (target, config, options) => calls.push({ target, config, options }) },
        });
        assertEqual(calls.length, 1);
        assert(calls[0].config === cfg, "shared config passed through");
        assertEqual(calls[0].options, PVD.buildOptions(cfg, api.getState()));
        assert(calls[0].target === findOne(api.root, "cnb-pvd-preview"), "renders into the preview element");
        assertEqual(findAll(api.root, "pc-col").length, 0, "Module 10 not invoked");
      });
    },
  },
];
