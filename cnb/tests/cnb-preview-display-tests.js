/**
 * cnb-preview-display-tests.js — Unit tests for Module 19 (Preview Display)
 *
 * Covers the pure helpers (pcOptionLabel, durationNames with the Modules
 * 11/18 fallback, withKey (session 36), buildPitchClasses with
 * every throw branch, defaultState, buildOptions with the prune-at-build
 * rules and its throw branches) and the render() UI driven against a stub
 * DOM: control structure, the live Module 10 preview (real CNBCollection
 * under the stub), duration pill toggling down to the explicit empty
 * state, the range endpoint-drag rule, the key and mode picker and the
 * button that turns the signature on (session 36),
 * setState validation, redraw() following host config changes (duration
 * vocabulary and background staff geometry, the latter cross-checked
 * against CNBStaff.getPositions), and the collection injection seam.
 */

import { CNBPreviewDisplay } from "../ui/preview-display.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBKeySignature } from "../src/cnb-key-signature.js";
import { CNBBuiltinClefs } from "../ui/builtin-clefs.js";

/** The default config showing one of the built-in clefs (session 45). */
function clefShown(name) {
  const config = CNBConfig.createDefault();
  config.clef = { ...config.clef, enabled: true, active: name,
    glyphs: { [name]: CNBBuiltinClefs.definition(config, name) } };
  return config;
}

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

  // ── withKey (session 36) ──
  {
    name: "withKey: with keys off, or no key, the config comes back as it is and the name is null",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const out = PVD.withKey(cfg, { tonic: 7, mode: "major" });
      assert(out.config === cfg && out.name === null, "keys off");
      const keyed = keyedConfig();
      const none = PVD.withKey(keyed, null);
      assert(none.config === keyed && none.name === null, "no key");
    },
  },
  {
    name: "withKey: a defined key with the picked pitch classes lends its name, with the picked tonic; the input is not changed",
    fn: () => {
      const cfg = keyedConfig();
      const before = JSON.stringify(cfg);
      const g = PVD.withKey(cfg, { tonic: 7, mode: "major" });
      assertEqual(g.name, "G", "G major is the defined G");
      assertEqual(g.config.keys.definitions.map(d => [d.name, d.tonicPc ?? null]), [["C", null], ["G", 7]]);
      const e = PVD.withKey(cfg, { tonic: 4, mode: "minor" });
      assertEqual(e.name, "G", "E minor has G major's pitch classes");
      assertEqual(e.config.keys.definitions[1].tonicPc, 4, "drawn from E");
      assertEqual(JSON.stringify(cfg), before, "input unchanged");
    },
  },
  {
    name: "withKey: the definition a rule names wins among those sharing the pitch classes (LY spec §6.4)",
    fn: () => {
      const cfg = keyedConfig();
      cfg.keys.definitions.push({ name: "A minor", pitchClasses: [9, 11, 0, 2, 4, 5, 7], tonicPc: 9 });
      assertEqual(PVD.withKey(cfg, { tonic: 0, mode: "major" }).name, "C", "no rule names either: the first");
      cfg.noteheadRules.push({ name: "In A minor", priority: 5,
        match: { pitchClasses: [0], durations: "all", keys: ["A minor"] }, apply: { hollow: true } });
      assertEqual(PVD.withKey(cfg, { tonic: 0, mode: "major" }).name, "A minor", "the one a rule names");
    },
  },
  {
    name: "withKey: a key nobody defined is added under its own name; a bad key throws",
    fn: () => {
      const cfg = keyedConfig();
      const d = PVD.withKey(cfg, { tonic: 2, mode: "dorian" });
      assertEqual(d.name, "C", "D dorian has C major's pitch classes");
      const fs = PVD.withKey(cfg, { tonic: 6, mode: "major" });
      assertEqual(fs.name, "F♯ major");
      assertEqual(fs.config.keys.definitions[2],
        { pitchClasses: [1, 3, 5, 6, 8, 10, 11], name: "F♯ major", tonicPc: 6, spelling: "F♯" });
      const empty = keyedConfig();
      empty.keys.definitions = [];
      assertEqual(PVD.withKey(empty, { tonic: 3, mode: "minor", spelling: "E♭" }).name, "E♭ minor", "no definitions at all");
      assertEqual(PVD.withKey(empty, { tonic: 3, mode: "minor" }).name, "D♯ minor",
        "no spelling: the default, D♯ and E♭ minor tying at six to the sharp");
      assertThrows(() => PVD.withKey(cfg, { tonic: 12, mode: "major" }), "tonic");
      assertThrows(() => PVD.withKey(cfg, { tonic: 0, mode: "bebop" }), "unknown mode");
      assertThrows(() => PVD.withKey(cfg, "G"), "must be { tonic, mode }");
      assertThrows(() => PVD.withKey(cfg, { tonic: 6, mode: "major", spelling: "G" }), "state.key.spelling",
        "a spelling of another tonic");
      assertThrows(() => PVD.withKey(cfg, { tonic: 3, mode: "major", spelling: "D♯" }), "state.key.spelling",
        "not one of major's (D♯ major needs F𝄪)");
    },
  },
  {
    name: "withKey: the picked spelling reaches the definition, so F♯ and G♭ major draw their sharps and flats (session 48)",
    fn: () => {
      const cfg = keyedConfig();
      cfg.keys.keySignature = { ...CNBConfig.createDefault().keys.keySignature, enabled: true,
        looks: { all: {}, flat: { color: "#0000ff" }, sharp: { color: "#ff0000" } } };
      const colours = key => {
        const { config, name } = PVD.withKey(cfg, key);
        return CNBKeySignature.measure(config, 16, name).marks.map(m => m.mark.color);
      };
      const gb = PVD.withKey(cfg, { tonic: 6, mode: "major", spelling: "G♭" });
      assertEqual(gb.name, "G♭ major", "named for its spelling");
      assertEqual(gb.config.keys.definitions.at(-1).spelling, "G♭");
      assertEqual(colours({ tonic: 6, mode: "major", spelling: "G♭" }).filter(c => c === "#0000ff").length, 7, "six flats and the upper G♭");
      assertEqual(colours({ tonic: 6, mode: "major", spelling: "F♯" }).filter(c => c === "#ff0000").length, 7, "six sharps and the upper F♯");
      const g = PVD.withKey(cfg, { tonic: 7, mode: "major", spelling: "G" });
      assertEqual(g.config.keys.definitions[1], { name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11], tonicPc: 7, spelling: "G" },
        "a defined key lends its name and takes the spelling");
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
    name: "defaultState: full chromatic row, first config duration, C major",
    fn: () => {
      assertEqual(PVD.defaultState(CNBConfig.createDefault()),
        { fromPc: 0, toPc: 12, durations: ["crotchet"], key: { tonic: 0, mode: "major" } });
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
    name: "buildOptions: keys = [the picked key's name] with keys on, null with keys off or no key",
    fn: () => {
      const state = { fromPc: 0, toPc: 12, durations: ["crotchet"], key: { tonic: 7, mode: "major" } };
      assertEqual(PVD.buildOptions(keyedConfig(), state).keys, ["G"], "a defined key");
      const other = keyedConfig();
      other.keys.definitions = [{ name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] }];
      assertEqual(PVD.buildOptions(other, state).keys, ["G major"], "a key nobody defined");
      assertEqual(PVD.buildOptions(CNBConfig.createDefault(), state).keys, null, "keys disabled");
      assertEqual(PVD.buildOptions(keyedConfig(), { ...state, key: null }).keys, null, "no key");
    },
  },
  {
    name: "buildOptions: throws on malformed state (non-object, non-array durations, a key that is not { tonic, mode }, inverted range)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      assertThrows(() => PVD.buildOptions(cfg, null), "must be an object");
      assertThrows(() => PVD.buildOptions(cfg, { fromPc: 0, toPc: 12, durations: "crotchet", key: null }),
        "must be an array");
      assertThrows(() => PVD.buildOptions(cfg, { fromPc: 0, toPc: 12, durations: [], key: 3 }),
        "must be { tonic, mode }");
      assertThrows(() => PVD.buildOptions(cfg, { fromPc: 0, toPc: 12, durations: [], key: { tonic: 0, mode: "x" } }),
        "unknown mode");
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
    name: "render: root appended; controls hold two 13-option range selects, one pill per config duration and the key picker",
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
        assertEqual(findAll(api.root, "cnb-pvd-key").length, 1, "the key picker, whatever the config (session 36)");
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
        assertEqual(calls[0].options, { ...PVD.buildOptions(cfg, api.getState()), fluid: true, rows: 1, labelStrip: true });
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

  // ── render: shapes or repeated heads (session 36) ──
  {
    name: "render: without onRepresentationMode there is no shape/repeat choice",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        assertEqual(findAll(api.root, "cnb-pvd-repeat").length, 0, "no choice");
      });
    },
  },
  {
    name: "render: onRepresentationMode draws the choice beside the duration buttons, in a designer's words, with the engine's counts",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg, onRepresentationMode: () => {} });
        const durations = findOne(api.root, "cnb-pvd-durations");
        const choice = findOne(durations, "cnb-pvd-repeat", "inside the durations group");
        const options = findAll(choice, "cnb-pvd-repeat-option");
        assertEqual(options.map(o => [o.getAttribute("data-mode"), o.textContent]),
          [["shape", "Its own shape for each duration"], ["repeat", "Repeat the notehead"]]);
        assertEqual(options.map(o => o.className.includes(" on")), [true, false], "the config's mode is on");
        assertEqual(options.map(o => o.getAttribute("aria-pressed")), ["true", "false"]);
        assertEqual(findOne(choice, "cnb-pvd-repeat-hint").textContent,
          "Repeated: minim ×2, semibreve ×4, breve as two tied semibreves");
      });
    },
  },
  {
    name: "render: a click on the other choice reports it; the host writes the mode and the redraw shows it on",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const reported = [];
        let api = null;
        api = PVD.render(container, {
          getConfig: () => cfg,
          onRepresentationMode: (mode) => {
            reported.push(mode);
            cfg.durations.representationMode = mode;
            api.redraw();
          },
        });
        const option = (mode) => findAll(api.root, "cnb-pvd-repeat-option")
          .find(o => o.getAttribute("data-mode") === mode);
        option("shape").onclick();
        assertEqual(reported, [], "the mode already on reports nothing");
        option("repeat").onclick();
        assertEqual(reported, ["repeat"], "repeat reported");
        assert(option("repeat").className.includes(" on") && !option("shape").className.includes(" on"),
          "repeat on after the redraw");
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

  // ── render: the key and mode picker (session 36) ──
  {
    name: "render: the key and mode picker — the mode's 15 spelled tonics and the seven modes, C major first; a pick passes through options.keys",
    fn: () => {
      const cfg = keyedConfig();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const keyWrap = findOne(api.root, "cnb-pvd-key");
        const tonic = findOne(keyWrap, "cnb-pvd-key-tonic");
        const mode = findOne(keyWrap, "cnb-pvd-key-mode");
        assertEqual(tonic.children.map(o => o.textContent),
          ["C", "C♯", "D♭", "D", "E♭", "E", "F", "F♯", "G♭", "G", "A♭", "A", "B♭", "B", "C♭"], "major's 15 (session 48)");
        assertEqual(tonic.children.map(o => o.value), tonic.children.map(o => o.textContent), "valued by name");
        assertEqual(mode.children.map(o => o.textContent),
          ["major", "minor", "dorian", "phrygian", "lydian", "mixolydian", "locrian"]);
        assertEqual([tonic.value, mode.value], ["C", "major"], "C major first");
        assertEqual(api.getOptions().keys, ["C"], "the defined C");
        findOne(api.root, "cnb-pvd-key-tonic").onchange({ target: { value: "G" } });
        assertEqual(api.getState().key, { tonic: 7, mode: "major", spelling: "G" });
        assertEqual(api.getOptions().keys, ["G"]);
        findOne(api.root, "cnb-pvd-key-mode").onchange({ target: { value: "mixolydian" } });
        assertEqual(api.getState().key, { tonic: 7, mode: "mixolydian", spelling: "G" });
        assertEqual(api.getOptions().keys, ["C"], "G mixolydian has C major's pitch classes");
        assertEqual(findAll(api.root, "cnb-pvd-key-note").length, 0, "no developer note");
      });
    },
  },
  {
    name: "render: F♯ and G♭ major are both offered and passed through; minor offers its own 15; a mode without the spelling takes the tonic's default (session 48)",
    fn: () => {
      const cfg = keyedConfig();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const pick = (cls, value) => findOne(api.root, cls).onchange({ target: { value } });
        pick("cnb-pvd-key-tonic", "G♭");
        assertEqual(api.getState().key, { tonic: 6, mode: "major", spelling: "G♭" });
        assertEqual(api.getOptions().keys, ["G♭ major"], "no key G♭ is defined: named for it");
        assertEqual(findOne(api.root, "cnb-pvd-key-tonic").value, "G♭", "the redraw shows G♭");
        pick("cnb-pvd-key-tonic", "F♯");
        assertEqual(api.getOptions().keys, ["F♯ major"], "F♯ major is another key");
        pick("cnb-pvd-key-mode", "minor");
        assertEqual(findOne(api.root, "cnb-pvd-key-tonic").children.map(o => o.value),
          ["C", "C♯", "D", "D♯", "E♭", "E", "F", "F♯", "G", "G♯", "A♭", "A", "A♯", "B♭", "B"], "minor's 15");
        assertEqual(api.getState().key, { tonic: 6, mode: "minor", spelling: "F♯" }, "F♯ minor keeps its spelling");
        pick("cnb-pvd-key-mode", "major");
        pick("cnb-pvd-key-tonic", "C♭");
        pick("cnb-pvd-key-mode", "minor");
        assertEqual(api.getState().key, { tonic: 11, mode: "minor", spelling: "B" }, "C♭ minor is no key: B minor");
        assertThrows(() => api.setState({ key: { tonic: 11, mode: "minor", spelling: "C♭" } }), "state.key.spelling",
          "a spelling the mode lacks");
      });
    },
  },
  {
    name: "render: the picked key's signature draws, a key nobody defined included; the config is not changed",
    fn: () => {
      const cfg = keyedConfig();
      cfg.keys.keySignature = { ...CNBConfig.createDefault().keys.keySignature, enabled: true };
      const before = JSON.stringify(cfg);
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        assertEqual(findAll(api.root, "keysig-col").length, 1, "C major's signature");
        api.setState({ key: { tonic: 6, mode: "major" } });
        assertEqual(findAll(api.root, "keysig-col").length, 1, "F♯ major's signature, though no key F♯ is defined");
        assertEqual(api.getOptions().keys, ["F♯ major"]);
      });
      assertEqual(JSON.stringify(cfg), before, "the config is not changed");
    },
  },
  {
    name: "render: with keys on and none defined the toolbar says so in a designer's words",
    fn: () => {
      const cfg = keyedConfig();
      cfg.keys.definitions = [];
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg });
        const note = findOne(api.root, "cnb-pvd-key-note");
        assertEqual(note.textContent, "No keys are defined yet, so no notehead rule can be for a particular key.");
        assert(!note.textContent.includes("config."), "no config path");
        cfg.keys.enabled = false;
        api.redraw();
        assertEqual(findAll(api.root, "cnb-pvd-key-note").length, 0, "keys off: no note");
        assertEqual(api.getOptions().keys, null, "keys off: no key");
      });
    },
  },
  {
    name: "render: while the signature is off, one button asks the host to turn it on; it goes once the signature is on",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        assertEqual(findAll(PVD.render(container, { getConfig: () => cfg }).root, "cnb-pvd-signature-on").length, 0,
          "no button without onSignatureOn");
      });
      withDomStub(container => {
        let calls = 0;
        let api = null;
        api = PVD.render(container, {
          getConfig: () => cfg,
          onSignatureOn: () => {
            calls++;
            cfg.keys.enabled = true;
            cfg.keys.keySignature.enabled = true;
            api.redraw();
          },
        });
        const button = findOne(api.root, "cnb-pvd-signature-on");
        assertEqual(button.textContent, "Show the key signature");
        button.onclick();
        assertEqual(calls, 1, "reported");
        assertEqual(findAll(api.root, "cnb-pvd-signature-on").length, 0, "gone once on");
        assertEqual(findAll(api.root, "keysig-col").length, 1, "C major's signature draws");
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
        assertEqual(api.getState(), { fromPc: 2, toPc: 6, durations: ["minim"], key: { tonic: 0, mode: "major" } });
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
        assertEqual(api.getState(), { fromPc: 0, toPc: 12, durations: ["crotchet"], key: { tonic: 0, mode: "major" } });
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
        assertEqual(calls[0].config, PVD.displayConfig(cfg, "medium"), "the display copy of the shared config");
        assertEqual(calls[0].options, { ...PVD.buildOptions(cfg, api.getState()), fluid: true, rows: 1, labelStrip: true });
        assert(calls[0].target === findOne(api.root, "cnb-pvd-preview"), "renders into the preview element");
        assertEqual(findAll(api.root, "pc-col").length, 0, "Module 10 not invoked");
      });
    },
  },

  // ── Size and rows (session 25, design §6.1) ──
  {
    name: "SIZES: Small 9, Medium 11, Large 16 px per semitone; Medium by default",
    fn: () => {
      assertEqual(PVD.SIZES, { small: 9, medium: 11, large: 16 });
      assertEqual(PVD.DEFAULT_SIZE, "medium");
    },
  },
  {
    name: "readSize: the stored step, else Medium (absent, unknown, null storage, throwing storage)",
    fn: () => {
      assertEqual(PVD.readSize(memoryStorage({ [PVD.SIZE_STORAGE_KEY]: "large" })), "large");
      assertEqual(PVD.readSize(memoryStorage({})), "medium", "absent");
      assertEqual(PVD.readSize(memoryStorage({ [PVD.SIZE_STORAGE_KEY]: "huge" })), "medium", "unknown");
      assertEqual(PVD.readSize(memoryStorage({ [PVD.SIZE_STORAGE_KEY]: "toString" })), "medium", "inherited name");
      assertEqual(PVD.readSize(null), "medium", "no storage");
      assertEqual(PVD.readSize({ getItem() { throw new Error("blocked"); } }), "medium", "blocked");
    },
  },
  {
    name: "writeSize: stores the step under SIZE_STORAGE_KEY; a null or throwing storage is ignored",
    fn: () => {
      const s = memoryStorage({});
      PVD.writeSize(s, "small");
      assertEqual(s.data[PVD.SIZE_STORAGE_KEY], "small");
      PVD.writeSize(null, "small");
      PVD.writeSize({ setItem() { throw new Error("blocked"); } }, "small");
    },
  },
  {
    name: "displayConfig: a copy at the Size's px per semitone, no column padding and the editor's label style; the saved display is untouched",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const copy = PVD.displayConfig(cfg, "small");
      assertEqual(copy.display.pxPerSemi, 9);
      assertEqual(copy.display.column.paddingH, 0, "the fluid grid pads the columns itself");
      assertEqual(cfg.display.pxPerSemi, 16, "input unchanged");
      assertEqual(cfg.display.column.paddingH, 16, "input padding unchanged");
      assertEqual(copy.display.label, { ...cfg.display.label, ...PVD.EDITOR_LABEL }, "the editor's label style");
      assertEqual(PVD.EDITOR_LABEL, { fontSize: 15, marginTop: 6, marginBottom: 6, padding: 4, color: "#5b5d63" });
      assertEqual(copy.display.label.fontFamily, cfg.display.label.fontFamily, "the label font kept");
      assertEqual(cfg.display.label.fontSize, 22, "input labels unchanged");
      assertEqual(copy.display.card, cfg.display.card, "other display settings kept");
      assert(copy.staff === cfg.staff, "the rest of the config is shared, not changed");
    },
  },
  {
    name: "rowsFor: one row at or above the one-row minimum, two below it",
    fn: () => {
      const cfg = PVD.displayConfig(CNBConfig.createDefault(), "medium");
      const options = { pitchClasses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], durations: ["crotchet"], keys: null };
      const min = CNBCollection.minRowWidth(cfg, { ...options, labelStrip: true, rows: 1 });
      assertEqual(PVD.rowsFor(cfg, options, min), 1, "at the minimum");
      assertEqual(PVD.rowsFor(cfg, options, min - 1), 2, "just below");
      assertEqual(PVD.rowsFor(cfg, options, Infinity), 1, "unknown width");
    },
  },
  {
    name: "render: the Size control starts at the stored step, draws at it, and remembers a new choice",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const storage = memoryStorage({ [PVD.SIZE_STORAGE_KEY]: "large" });
      withDomStub(container => {
        const calls = [];
        const api = PVD.render(container, {
          getConfig: () => cfg, storage, ResizeObserver: null,
          collection: { render: (target, config, options) => calls.push({ config, options }) },
        });
        const options = findAll(api.root, "cnb-pvd-size-option");
        assertEqual(options.map(b => b.getAttribute("data-size")), ["small", "medium", "large"]);
        assertEqual(options.filter(b => b.className.includes(" on")).map(b => b.getAttribute("data-size")), ["large"]);
        assertEqual(calls[0].config.display.pxPerSemi, 16, "drawn at Large");
        options[0].onclick();
        assertEqual(api.getSize(), "small");
        assertEqual(storage.data[PVD.SIZE_STORAGE_KEY], "small", "remembered");
        assertEqual(calls[calls.length - 1].config.display.pxPerSemi, 9, "redrawn at Small");
        assertEqual(cfg.display.pxPerSemi, 16, "the shared config is never written");
      });
    },
  },
  {
    name: "render: the observed width picks the rows, and a resize redraws only when the count changes",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const observer = fakeObserver();
        const calls = [];
        const api = PVD.render(container, {
          getConfig: () => cfg, storage: null, ResizeObserver: observer.Ctor,
          onRender: (options) => calls.push(options),
        });
        assert(observer.target === api.root, "observes the root");
        assertEqual(calls.length, 1, "one render on mount");
        assertEqual(calls[0].rows, 1, "one row before a width is known");
        const drawnCfg = PVD.displayConfig(cfg, "medium");
        const one = CNBCollection.minRowWidth(drawnCfg, { rows: 1, labelStrip: true });
        const two = CNBCollection.minRowWidth(drawnCfg, { rows: 2, labelStrip: true });
        observer.resize(one + 50);
        assertEqual(calls.length, 1, "still one row: no redraw");
        observer.resize(one - 1);
        assertEqual(calls.length, 2, "two rows: redrawn");
        assertEqual(calls[1].rows, 2);
        assertEqual(api.getRows(), 2);
        assertEqual(findAllByClassAttr(api.root, "staff-lines-bg").length, 2, "two systems drawn");
        observer.resize(two + 10);
        assertEqual(calls.length, 2, "still two rows: no redraw");
        assertEqual(findOne(api.root, "cnb-pvd-preview").className, "cnb-pvd-preview", "not overflowing");
        assertEqual(findOne(api.root, "cnb-pvd-size-hint").textContent, "", "no hint");
        observer.resize(two - 1);
        assertEqual(calls.length, 2, "below the two-row minimum: no redraw");
        assertEqual(findOne(api.root, "cnb-pvd-preview").className, "cnb-pvd-preview cnb-pvd-overflow", "overflow marked");
        assert(findOne(api.root, "cnb-pvd-size-hint").textContent.includes("smaller Size"), "hint suggests a smaller Size");
        observer.resize(one);
        assertEqual(calls.length, 3, "back to one row: redrawn");
        assertEqual(calls[2].rows, 1);
      });
    },
  },
  {
    name: "render: rangeHost receives the pitch-range control instead of the controls",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const rangeHost = makeHtmlStubElement("div");
        const api = PVD.render(container, { getConfig: () => cfg, storage: null, rangeHost });
        assertEqual(findAll(api.root, "cnb-pvd-range").length, 0, "not in the controls");
        assertEqual(findAll(rangeHost, "cnb-pvd-range").length, 1, "in the range host");
        const from = findOne(rangeHost, "cnb-pvd-from");
        from.onchange({ target: { value: "7" } });
        assertEqual(api.getState().fromPc, 7, "the moved control still drives the preview");
        assertEqual(findAll(rangeHost, "cnb-pvd-range").length, 1, "redrawn in place, not duplicated");
        assertEqual(findAll(api.root, "pc-col").length, 6, "the preview follows");
      });
    },
  },

  // ── Section previews (session 26, design §6) ──
  {
    name: "render: setFocus(\"ledger-lines\") draws the ledger spots and marks the preview; other focus does not",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        let lastOptions = null;
        const api = PVD.render(container, { getConfig: () => cfg, storage: null,
          onRender: (options) => { lastOptions = options; } });
        const preview = () => findOne(api.root, "cnb-pvd-preview");
        assert(!String(preview().className).includes("cnb-pvd-focus-ledgers"), "no mark at first");
        assertEqual(findAllByClassAttr(api.root, "ledger-spot").length, 0, "no spots at first");
        assertEqual(api.getFocus(), null, "no focus");

        api.setFocus("ledger-lines");
        assertEqual(api.getFocus(), "ledger-lines", "focus kept");
        assert(String(preview().className).includes("cnb-pvd-focus-ledgers"), "preview marked");
        assertEqual(lastOptions.ledgerSpots, true, "the collection was asked for the spots");
        assert(findAllByClassAttr(api.root, "ledger-spot").length > 0, "spots drawn");
        const cols = findAll(api.root, "pc-col");
        assert(cols.some(c => c.getAttribute("data-ledgers") !== "0") &&
          cols.some(c => c.getAttribute("data-ledgers") === "0"), "columns say which draw ledger lines");

        api.setFocus("clef");
        assert(!String(preview().className).includes("cnb-pvd-focus-ledgers"), "mark removed");
        assertEqual(findAllByClassAttr(api.root, "ledger-spot").length, 0, "spots removed");
        assertEqual(lastOptions.ledgerSpots, undefined, "not asked for");
      });
    },
  },
  {
    name: "render: setFocus redraws only when the focus changes, and the mark survives an overflow update",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const obs = fakeObserver();
      withDomStub(container => {
        let renders = 0;
        const api = PVD.render(container, { getConfig: () => cfg, storage: null,
          ResizeObserver: obs.Ctor, onRender: () => { renders++; } });
        api.setFocus("ledger-lines");
        const n = renders;
        api.setFocus("ledger-lines");
        assertEqual(renders, n, "same focus: no redraw");
        obs.resize(100);   // below the two-row minimum: overflow re-marks the class
        const cls = String(findOne(api.root, "cnb-pvd-preview").className);
        assert(cls.includes("cnb-pvd-overflow") && cls.includes("cnb-pvd-focus-ledgers"), "both marks: " + cls);
      });
    },
  },
  // ── Selection and marks (session 27, design §2, §5.4) ──
  {
    name: "render: a click on a column selects its pitch class, Shift-, Ctrl- or Cmd-click adds, and C′ is C",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const picks = [];
        const api = PVD.render(container, { getConfig: () => cfg, storage: null,
          onSelect: (pc, how) => picks.push([pc, how.add]) });
        const col = (pc) => findAll(api.root, "pc-col").find(c => c.getAttribute("data-pc") === String(pc));
        col(1).onclick({ shiftKey: false });
        col(4).onclick({ shiftKey: true });
        col(5).onclick({ ctrlKey: true });
        col(6).onclick({ metaKey: true });
        col(12).onclick({});
        assertEqual(picks, [[1, false], [4, true], [5, true], [6, true], [0, false]], "picks");
      });
    },
  },
  {
    name: "render: without onSelect the columns take no clicks",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg, storage: null });
        assert(findAll(api.root, "pc-col").every(c => c.onclick === undefined), "no click handlers");
      });
    },
  },
  {
    name: "setMarks: marks the selected and tinted columns, C′ with C, and keeps them across redraws and rows",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const obs = fakeObserver();
      withDomStub(container => {
        let renders = 0;
        const api = PVD.render(container, { getConfig: () => cfg, storage: null,
          ResizeObserver: obs.Ctor, onRender: () => { renders++; } });
        const marked = (token) => findAll(api.root, token).map(c => c.getAttribute("data-pc")).join(",");
        const before = renders;
        api.setMarks({ selected: [0], tinted: [1, 5] });
        assertEqual(renders, before, "no redraw");
        assertEqual(marked("cnb-pvd-selected"), "0,12", "C and C′ selected");
        assertEqual(marked("cnb-pvd-tint"), "1,5", "tinted");
        assert(findAll(api.root, "cnb-pvd-selected").every(c => c.className.split(" ").includes("pc-col")), "column class kept");

        api.redraw();
        assertEqual(marked("cnb-pvd-selected"), "0,12", "after a redraw");
        const drawnCfg = PVD.displayConfig(cfg, "medium");
        obs.resize(CNBCollection.minRowWidth(drawnCfg, { rows: 1, labelStrip: true }) - 1);
        assertEqual(api.getRows(), 2, "two rows");
        assertEqual(marked("cnb-pvd-tint"), "1,5", "after the row count changes");

        api.setMarks({ selected: [3] });
        assertEqual(marked("cnb-pvd-selected"), "3", "replaced");
        assertEqual(marked("cnb-pvd-tint"), "", "tint cleared");
      });
    },
  },
  // ── Pitch mode and the label strip (session 28, design §4.2) ──
  {
    name: "render: the canvas draws the label strip in every row, and its labels are not columns",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const obs = fakeObserver();
      withDomStub(container => {
        const picks = [];
        const api = PVD.render(container, { getConfig: () => cfg, storage: null, ResizeObserver: obs.Ctor,
          onSelect: (pc) => picks.push(pc) });
        assertEqual(findAll(api.root, "label-col").length, 1, "one strip on one row");
        assert(findAllByClassAttr(api.root, "pitch-label").length > 13, "a label per semitone");
        obs.resize(CNBCollection.minRowWidth(PVD.displayConfig(cfg, "medium"), { rows: 1, labelStrip: true }) - 1);
        assertEqual(findAll(api.root, "label-col").length, 2, "a strip on each of two rows");
        api.setMarks({ selected: [0] });
        assert(findAllByClassAttr(api.root, "pitch-label").every(g => !String(g.className || "").includes("cnb-pvd-selected")),
          "labels are never marked");
      });
    },
  },
  {
    name: "setPitchMode: the class and the hint come and go with no redraw, and survive a redraw",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        let renders = 0;
        const api = PVD.render(container, { getConfig: () => cfg, storage: null, onRender: () => { renders++; } });
        const hint = () => findOne(api.root, "cnb-pvd-pitch-hint").textContent;
        const on = () => api.root.className.split(" ").includes("cnb-pvd-pitch-mode");
        assert(!on() && hint() === "", "off at first");
        const before = renders;
        api.setPitchMode(true);
        assertEqual(renders, before, "no redraw");
        assert(on(), "class on");
        assertEqual(hint(), "Drag the labels on the left to move the pitches against the staff, or a notehead up or down to nudge it", "hint");
        api.redraw();
        assert(on() && hint() !== "", "kept across a redraw");
        assertEqual(api.getPitchMode(), true);
        api.setPitchMode(false);
        assert(!on() && hint() === "", "off again");
      });
    },
  },
  {
    name: "the selection hint: shown with onSelect outside pitch mode, giving way to the pitch hint",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg, storage: null, onSelect: () => {} });
        const hint = () => findOne(api.root, "cnb-pvd-pitch-hint").textContent;
        assertEqual(hint(), "Click a notehead to give it a look; Shift+click or Ctrl+click to select several", "selection hint");
        assertEqual(hint(), PVD.SELECT_HINT);
        api.setPitchMode(true);
        assertEqual(hint(), "Drag the labels on the left to move the pitches against the staff, or a notehead up or down to nudge it", "pitch hint");
        api.setPitchMode(false);
        api.redraw();
        assertEqual(hint(), PVD.SELECT_HINT, "back after pitch mode and a redraw");
      });
    },
  },
  {
    name: "pitch mode: dragging a strip two semitones down reports 2; Esc, no move or pitch mode off report nothing",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const drags = [];
        const api = PVD.render(container, { getConfig: () => cfg, storage: null, onPitchDrag: (d) => drags.push(d) });
        const step = PVD.SIZES.medium;
        const slice = () => findAllByClassAttr(api.root, "label-slice")[0];
        const labels = () => findAllByClassAttr(slice(), "pitch-label");
        slice().onpointerdown({ clientY: 100 });
        slice().onpointermove({ clientY: 100 + 2 * step });
        slice().onpointerup({});
        assertEqual(drags, [], "outside pitch mode a drag does nothing");

        api.setPitchMode(true);
        slice().onpointerdown({ clientY: 100 });
        slice().onpointermove({ clientY: 100 + 2 * step + 3 });
        assert(labels().every(g => g.getAttribute("transform") === `translate(0 ${2 * step})`), "labels follow, snapped");
        const middle = findAllByClassAttr(slice(), "staff-middle")[0];
        assertEqual(middle.getAttribute("transform"), null, "the middle line stays");
        slice().onpointerup({});
        assertEqual(drags, [2], "two semitones down");
        assert(labels().every(g => g.getAttribute("transform") === ""), "labels put back");

        slice().onpointerdown({ clientY: 100 });
        slice().onpointermove({ clientY: 100 - step });
        slice().onpointercancel({});
        slice().onpointerdown({ clientY: 100 });
        slice().onpointerup({});
        assertEqual(drags, [2], "a cancel and a release with no move report nothing");

        const listeners = [];
        const hadAdd = "addEventListener" in globalThis;
        const prevAdd = globalThis.addEventListener;
        const prevRemove = globalThis.removeEventListener;
        globalThis.addEventListener = (type, fn) => listeners.push([type, fn]);
        globalThis.removeEventListener = () => {};
        try {
          slice().onpointerdown({ clientY: 100 });
          slice().onpointermove({ clientY: 100 + step });
          listeners.find(([t]) => t === "keydown")[1]({ key: "Escape" });
          slice().onpointerup({});
        } finally {
          if (hadAdd) { globalThis.addEventListener = prevAdd; globalThis.removeEventListener = prevRemove; }
          else { delete globalThis.addEventListener; delete globalThis.removeEventListener; }
        }
        assertEqual(drags, [2], "Esc puts the strip back");
        assert(labels().every(g => g.getAttribute("transform") === ""), "labels back after Esc");
      });
    },
  },
  {
    name: "pitch mode: dragging a notehead up reports its pitch class and the axis units (session 43)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const drags = [];
        const api = PVD.render(container, { getConfig: () => cfg, storage: null,
          onNudgeDrag: (pc, units) => drags.push([pc, units]) });
        const step = PVD.SIZES.medium;
        const col = (pc) => findAll(api.root, "pc-col").find(c => c.getAttribute("data-pc") === String(pc));
        const slice = (pc) => findAllByClassAttr(col(pc), "note-slice")[0];
        col(4).onpointerdown({ clientY: 100 });
        col(4).onpointermove({ clientY: 100 - step });
        col(4).onpointerup({});
        assertEqual(drags, [], "outside pitch mode a drag does nothing");

        api.setPitchMode(true);
        col(4).onpointerdown({ clientY: 100 });
        col(4).onpointermove({ clientY: 100 - step / 2 });
        assertEqual(slice(4).style.transform, `translateY(${-step / 2}px)`, "the noteheads follow the pointer");
        col(4).onpointerup({});
        assertEqual(drags, [[4, 0.5]], "half a semitone up");
        assertEqual(slice(4).style.transform, "", "put back for the redraw");

        col(12).onpointerdown({ clientY: 100 });
        col(12).onpointermove({ clientY: 100 + 2 * step });
        col(12).onpointerup({});
        assertEqual(drags[1], [0, -2], "C′ nudges C, two semitones down");

        col(7).onpointerdown({ clientY: 100 });
        col(7).onpointermove({ clientY: 102 });
        col(7).onpointerup({});
        col(7).onpointerdown({ clientY: 100 });
        col(7).onpointermove({ clientY: 100 - step });
        col(7).onpointercancel({});
        assertEqual(drags.length, 2, "a move under the threshold and a cancel report nothing");

        const listeners = [];
        const hadAdd = "addEventListener" in globalThis;
        const prevAdd = globalThis.addEventListener;
        const prevRemove = globalThis.removeEventListener;
        globalThis.addEventListener = (type, fn) => listeners.push([type, fn]);
        globalThis.removeEventListener = () => {};
        try {
          col(7).onpointerdown({ clientY: 100 });
          col(7).onpointermove({ clientY: 100 - step });
          listeners.find(([t]) => t === "keydown")[1]({ key: "Escape" });
          col(7).onpointerup({});
        } finally {
          if (hadAdd) { globalThis.addEventListener = prevAdd; globalThis.removeEventListener = prevRemove; }
          else { delete globalThis.addEventListener; delete globalThis.removeEventListener; }
        }
        assertEqual(drags.length, 2, "Esc puts the notehead back");
        assertEqual(slice(7).style.transform, "", "and its slice");
      });
    },
  },
  {
    name: "pitch mode: a notehead drag that moved does not also select; a click still does (session 43)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      withDomStub(container => {
        const picks = [];
        const drags = [];
        const api = PVD.render(container, { getConfig: () => cfg, storage: null,
          onSelect: (pc) => picks.push(pc), onNudgeDrag: (pc, units) => drags.push([pc, units]) });
        api.setPitchMode(true);
        const col = (pc) => findAll(api.root, "pc-col").find(c => c.getAttribute("data-pc") === String(pc));
        col(2).onpointerdown({ clientY: 100 });
        col(2).onpointermove({ clientY: 90 });
        col(2).onpointerup({});
        col(2).onclick({});
        assertEqual([picks, drags.length], [[], 1], "the drag nudged and did not select");
        col(3).onpointerdown({ clientY: 100 });
        col(3).onpointerup({});
        col(3).onclick({});
        assertEqual(picks, [3], "a press with no move is a click");
      });
    },
  },
  {
    name: "clef mode: with the Clef section open and a glyph clef, the class and the hint; not otherwise (session 45)",
    fn: () => {
      const cfg = clefShown("treble");
      withDomStub(container => {
        const api = PVD.render(container, { getConfig: () => cfg, storage: null, onSelect: () => {}, onClefDrag: () => {} });
        const on = () => api.root.className.split(" ").includes("cnb-pvd-clef-mode");
        const hint = () => findOne(api.root, "cnb-pvd-pitch-hint").textContent;
        assert(!on(), "off with no section open");
        api.setFocus("clef");
        assert(on(), "on with the Clef section open");
        assertEqual(hint(), "Drag the clef up or down to move it, or its bottom edge to make it taller or shorter", "hint");
        api.setPitchMode(true);
        assert(!on(), "pitch mode wins");
        api.setPitchMode(false);
        api.setFocus("pitch");
        assert(!on() && hint() === PVD.SELECT_HINT, "off in another section");
      });
      for (const [label, config, opts] of [
        ["the dozenal clef", clefShown("dozenal"), { onClefDrag: () => {} }],
        ["no clef", CNBConfig.createDefault(), { onClefDrag: () => {} }],
        ["no onClefDrag", clefShown("treble"), {}],
      ]) {
        withDomStub(container => {
          const api = PVD.render(container, { getConfig: () => config, storage: null, ...opts });
          api.setFocus("clef");
          assert(!api.root.className.split(" ").includes("cnb-pvd-clef-mode"), `off for ${label}`);
        });
      }
    },
  },
  {
    name: "clef mode: dragging the clef moves it, dragging its handle resizes it; Esc, a cancel or a tiny move report nothing (session 45)",
    fn: () => {
      const cfg = clefShown("treble");
      withDomStub(container => {
        const drags = [];
        const api = PVD.render(container, { getConfig: () => cfg, storage: null,
          onClefDrag: (kind, semis) => drags.push([kind, semis]) });
        const step = PVD.SIZES.medium;
        const col = () => findAll(api.root, "clef-col")[0];
        const slice = () => findAllByClassAttr(col(), "clef-slice")[0];
        const handle = () => findAllByClassAttr(col(), "cnb-clef-resize")[0];
        assertEqual(col().onpointerdown, undefined, "outside clef mode the clef takes no drag");

        api.setFocus("clef");
        col().onpointerdown({ clientY: 100 });
        col().onpointermove({ clientY: 100 - 1.5 * step });
        assertEqual(slice().style.transform, `translateY(${-1.5 * step}px)`, "the clef follows the pointer");
        col().onpointerup({});
        assertEqual(drags, [["move", 1.5]], "moved a semitone and a half up");
        assertEqual(slice().style.transform, "", "put back for the redraw");

        col().onpointerdown({ clientY: 100, target: handle() });
        col().onpointermove({ clientY: 100 + 2 * step });
        assertEqual(handle().getAttribute("transform"), `translate(0 ${2 * step})`, "the handle follows");
        assertEqual(slice().style.transform || "", "", "the clef stays");
        col().onpointerup({});
        assertEqual(drags[1], ["resize", -2], "its bottom two semitones down");

        col().onpointerdown({ clientY: 100 });
        col().onpointermove({ clientY: 102 });
        col().onpointerup({});
        col().onpointerdown({ clientY: 100 });
        col().onpointermove({ clientY: 100 - step });
        col().onpointercancel({});
        assertEqual(drags.length, 2, "a tiny move and a cancel report nothing");

        const listeners = [];
        const hadAdd = "addEventListener" in globalThis;
        const prevAdd = globalThis.addEventListener;
        const prevRemove = globalThis.removeEventListener;
        globalThis.addEventListener = (type, fn) => listeners.push([type, fn]);
        globalThis.removeEventListener = () => {};
        try {
          col().onpointerdown({ clientY: 100 });
          col().onpointermove({ clientY: 100 - step });
          listeners.find(([t]) => t === "keydown")[1]({ key: "Escape" });
          col().onpointerup({});
        } finally {
          if (hadAdd) { globalThis.addEventListener = prevAdd; globalThis.removeEventListener = prevRemove; }
          else { delete globalThis.addEventListener; delete globalThis.removeEventListener; }
        }
        assertEqual(drags.length, 2, "Esc puts the clef back");
        assertEqual(slice().style.transform, "", "and its slice");
      });
    },
  },
  {
    name: "renderPartial: the clef gutter and the first three columns, with the key signature off",
    fn: () => {
      const cfg = keyedConfig();
      cfg.keys.keySignature = { ...CNBConfig.createDefault().keys.keySignature, enabled: true };
      cfg.clef = { enabled: true, active: "num", gutter: { paddingH: 8 },
        glyphs: { num: { kind: "text", text: "4", textHeightSemis: 5, anchorSemi: 20 } } };
      const before = JSON.stringify(cfg);
      withDomStub(container => {
        const wrap = PVD.renderPartial(container, cfg, { part: "clef", size: "large", key: { tonic: 7, mode: "major" } });
        assertEqual(wrap.className, "cnb-pvd-partial", "wrapper class");
        assert(container.children.includes(wrap), "appended to the host");
        assertEqual(findAll(wrap, "pc-col").map(c => c.getAttribute("data-pc")).join(","), "0,1,2", "C, C♯ and D");
        assertEqual(findAll(wrap, "clef-col").length, 1, "the clef gutter");
        assertEqual(findAll(wrap, "keysig-col").length, 0, "no key signature");
        assertEqual(findAll(wrap, "preview-container").length, 1, "one row");
      });
      assertEqual(JSON.stringify(cfg), before, "the config is not changed");
    },
  },
  {
    name: "renderPartial: the key signature gutter for the given key, with the clef off; bad parts throw",
    fn: () => {
      const cfg = keyedConfig();
      cfg.keys.keySignature = { ...CNBConfig.createDefault().keys.keySignature, enabled: true };
      cfg.clef = { enabled: true, active: "num", gutter: { paddingH: 8 },
        glyphs: { num: { kind: "text", text: "4", textHeightSemis: 5, anchorSemi: 20 } } };
      withDomStub(container => {
        const wrap = PVD.renderPartial(container, cfg, { part: "key-signature", size: "medium", key: { tonic: 7, mode: "major" } });
        assertEqual(findAll(wrap, "keysig-col").length, 1, "the key signature gutter");
        assertEqual(findAll(wrap, "clef-col").length, 0, "no clef");
        assertEqual(findAll(wrap, "pc-col").length, 3, "three columns");
        const none = PVD.renderPartial(container, cfg, { part: "key-signature", key: null });
        assertEqual(findAll(none, "keysig-col").length, 0, "no key chosen: no signature");
        const minim = PVD.renderPartial(container, cfg, { part: "key-signature", key: { tonic: 2, mode: "dorian" }, duration: "minim" });
        assertEqual(findAll(minim, "pc-col").length, 3, "a given duration draws too");
        assertThrows(() => PVD.renderPartial(container, cfg, { part: "staff" }), "part", "unknown part");
      });
    },
  },
  {
    name: "renderPartial: duration null (no duration selected) draws nothing for either part (session 26 review)",
    fn: () => {
      const cfg = keyedConfig();
      for (const part of ["clef", "key-signature"]) {
        withDomStub(container => {
          const before = container.children.length;
          assertEqual(PVD.renderPartial(container, cfg, { part, key: { tonic: 7, mode: "major" }, duration: null }), null, `${part}: returns null`);
          assertEqual(container.children.length, before, `${part}: the host stays empty`);
        });
      }
    },
  },
];

/** An in-memory stand-in for localStorage. */
function memoryStorage(initial) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (Object.hasOwn(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

/** A ResizeObserver stand-in whose resize(width) calls the callback. */
function fakeObserver() {
  const handle = { target: null, callback: null };
  handle.Ctor = function (callback) {
    handle.callback = callback;
    this.observe = (target) => { handle.target = target; };
  };
  handle.resize = (width) => handle.callback([{ contentRect: { width } }]);
  return handle;
}
