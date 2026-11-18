/**
 * cnb-common-props-editor-tests.js — Unit tests for Module 15
 * (Common Properties Editor)
 *
 * Covers the state → config.durations / config.engine builds (including
 * every throw branch), the config → state inverse (round-tripped on every
 * branch), the retired repeatCounts and stemThickness (session 34), Module A
 * validation pass-through, exporter integration (Section C repeat field and
 * Section B emit-if-changed through Module 11), the render() UI driven
 * against a stub DOM, and renderPreview() (Module 10 composition) against
 * the same stub.
 */

import { CNBCommonPropsEditor } from "../ui/common-props-editor.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
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
// Same stub pattern as the Module 12–14 tests: supports createElement and
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

const E = CNBCommonPropsEditor;

/** Editor state for the default 4-8 config. */
function defaultState() {
  return E.stateFromConfig(CNBConfig.createDefault());
}

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // ── ENGINE_DEFAULTS ──
  {
    name: "ENGINE_DEFAULTS matches plan §4.10 / LY spec §5.2",
    fn: () => {
      assertEqual(E.ENGINE_DEFAULTS, {
        lilypondVersion: "2.24.2",
        falseHollow: false,
        defaultMagnify: "7/4",
        indent: 0,
        collisionThreshold: 2,
      }, "engine defaults");
    },
  },

  // ── stateFromConfig ──
  {
    name: "stateFromConfig: default config → shape mode, default engine, no repeat counts",
    fn: () => {
      const s = defaultState();
      assert(s.representationMode === "shape", "mode");
      assert(!("repeatCounts" in s), "no repeat counts: the engine's are fixed (session 34)");
      assertEqual(s.engine, E.ENGINE_DEFAULTS, "engine");
      assert(s.definitions.length === 4 && s.definitions[0].name === "crotchet", "definitions");
    },
  },
  {
    name: "stateFromConfig: repeat mode recognized; anything else normalizes to shape",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.durations.representationMode = "repeat";
      assert(E.stateFromConfig(cfg).representationMode === "repeat", "repeat kept");
      cfg.durations.representationMode = "bogus";
      assert(E.stateFromConfig(cfg).representationMode === "shape", "bogus → shape");
    },
  },
  {
    name: "stateFromConfig: missing engine fields fall back to §4.10 defaults",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine = { falseHollow: true };
      const s = E.stateFromConfig(cfg);
      assert(s.engine.falseHollow === true, "explicit kept");
      assert(s.engine.defaultMagnify === "7/4" && s.engine.indent === 0,
        "missing filled from defaults");
    },
  },
  {
    name: "stateFromConfig: state is independent of the config (deep clone)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = E.stateFromConfig(cfg);
      s.definitions[0].name = "mutated";
      assert(cfg.durations.definitions[0].name === "crotchet", "config defs untouched");
    },
  },

  // ── buildDurations ──
  {
    name: "buildDurations: default state emits the plan §4.8 slice unchanged",
    fn: () => {
      const out = E.buildDurations(defaultState());
      assertEqual(out, CNBConfig.createDefault().durations, "slice");
    },
  },
  {
    name: "buildDurations: emitted slice shares no references with state",
    fn: () => {
      const s = defaultState();
      const out = E.buildDurations(s);
      out.definitions[0].name = "mutated";
      assert(s.definitions[0].name === "crotchet", "definitions cloned");
    },
  },
  {
    name: "buildDurations: throws on representationMode outside {shape, repeat}",
    fn: () => {
      const s = defaultState();
      s.representationMode = "bogus";
      assertThrows(() => E.buildDurations(s), "bogus mode");
      s.representationMode = undefined;
      assertThrows(() => E.buildDurations(s), "undefined mode");
    },
  },
  {
    name: "buildDurations: throws on non-array definitions",
    fn: () => {
      const s = defaultState();
      s.definitions = null;
      assertThrows(() => E.buildDurations(s), "null definitions");
    },
  },
  {
    name: "buildDurations: a config's retired repeatCounts are not carried (session 34)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.durations.repeatCounts = { minim: 3 };
      const out = E.buildDurations(E.stateFromConfig(cfg));
      assertEqual(Object.keys(out), ["definitions", "representationMode", "repeatOverlap"], "definitions, the mode and the overlap only");
    },
  },

  // ── buildEngine ──
  {
    name: "buildEngine: default state emits the plan §4.10 slice unchanged",
    fn: () => {
      assertEqual(E.buildEngine(defaultState()), CNBConfig.createDefault().engine, "slice");
    },
  },
  {
    name: "buildEngine: throws on empty or non-string lilypondVersion",
    fn: () => {
      for (const bad of ["", null, 2.24]) {
        const s = defaultState();
        s.engine.lilypondVersion = bad;
        assertThrows(() => E.buildEngine(s), `version ${JSON.stringify(bad)}`);
      }
    },
  },
  {
    name: "buildEngine: defaultMagnify accepts integer, decimal, and N/M fraction strings",
    fn: () => {
      for (const good of ["2", "1.75", "7/4"]) {
        const s = defaultState();
        s.engine.defaultMagnify = good;
        assert(E.buildEngine(s).defaultMagnify === good, `magnify ${good}`);
      }
    },
  },
  {
    name: "buildEngine: throws on malformed defaultMagnify (empty, non-numeric, zero denominator, number type)",
    fn: () => {
      for (const bad of ["", "abc", "7/0", "7/4/2", 1.75]) {
        const s = defaultState();
        s.engine.defaultMagnify = bad;
        assertThrows(() => E.buildEngine(s), `magnify ${JSON.stringify(bad)}`);
      }
    },
  },
  {
    name: "buildEngine: throws on non-finite indent / collisionThreshold",
    fn: () => {
      for (const field of ["indent", "collisionThreshold"]) {
        for (const bad of ["3", null, NaN, Infinity]) {
          const s = defaultState();
          s.engine[field] = bad;
          assertThrows(() => E.buildEngine(s), `${field} ${String(bad)}`);
        }
      }
    },
  },
  {
    name: "buildEngine: a retired engine.stemThickness is dropped (session 34: the preview draws the engine's stem)",
    fn: () => {
      const s = defaultState();
      s.engine.stemThickness = 1.5;
      assert(!("stemThickness" in E.buildEngine(s)), "not built");
    },
  },
  {
    name: "buildEngine: a retired engine.multinotePadding is dropped (session 58: the overlap is durations.repeatOverlap)",
    fn: () => {
      const s = defaultState();
      s.engine.multinotePadding = -0.25;
      assert(!("multinotePadding" in E.buildEngine(s)), "not built");
    },
  },
  {
    name: "buildDurations / stateFromConfig: durations.repeatOverlap rides through unchanged (session 58)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.durations.repeatOverlap = 0.25;
      const s = E.stateFromConfig(cfg);
      assert(s.repeatOverlap === 0.25, "state carries it");
      assert(E.buildDurations(s).repeatOverlap === 0.25, "the slice carries it");
      delete cfg.durations.repeatOverlap;
      assert(!("repeatOverlap" in E.buildDurations(E.stateFromConfig(cfg))), "absent stays absent");
    },
  },
  {
    name: "buildEngine: falseHollow coerces to a boolean; the retired useAccessibleColors is dropped (session 37)",
    fn: () => {
      const s = defaultState();
      s.engine.falseHollow = 1;
      s.engine.useAccessibleColors = true;
      const out = E.buildEngine(s);
      assert(out.falseHollow === true, "coerced");
      assert(!("useAccessibleColors" in out), "not built");
    },
  },

  // ── applyToConfig ──
  {
    name: "applyToConfig: replaces only durations and engine; other sections untouched",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = defaultState();
      s.representationMode = "repeat";
      s.engine.falseHollow = true;
      const out = E.applyToConfig(cfg, s);
      assert(out.durations.representationMode === "repeat", "durations replaced");
      assert(out.engine.falseHollow === true, "engine replaced");
      assertEqual(out.staff, cfg.staff, "staff untouched");
      assertEqual(out.noteheadRules, cfg.noteheadRules, "rules untouched");
      assertEqual(out.shapes, cfg.shapes, "shapes untouched");
      assert(cfg.durations.representationMode === "shape", "input config not mutated");
    },
  },
  {
    name: "applyToConfig: result passes CNBConfig.validate for the default config",
    fn: () => {
      const result = CNBConfig.validate(E.applyToConfig(CNBConfig.createDefault(), defaultState()));
      assert(result.valid, "valid: " + result.errors.join("; "));
    },
  },

  // ── Round-trips (stateFromConfig ∘ applyToConfig) ──
  {
    name: "round-trip: default state survives applyToConfig → stateFromConfig",
    fn: () => {
      const s = defaultState();
      assertEqual(E.stateFromConfig(E.applyToConfig(CNBConfig.createDefault(), s)), s, "state");
    },
  },
  {
    name: "round-trip: repeat mode",
    fn: () => {
      const s = defaultState();
      s.representationMode = "repeat";
      assertEqual(E.stateFromConfig(E.applyToConfig(CNBConfig.createDefault(), s)), s, "state");
    },
  },
  {
    name: "round-trip: fully edited engine",
    fn: () => {
      const s = defaultState();
      s.engine = {
        lilypondVersion: "2.25.0",
        falseHollow: true,
        defaultMagnify: "3/2",
        indent: 5,
        collisionThreshold: 1,
      };
      assertEqual(E.stateFromConfig(E.applyToConfig(CNBConfig.createDefault(), s)), s, "state");
    },
  },
  // ── Exporter integration (Module 11) ──
  {
    name: "exporter: representationMode drives Section C's repeat field (LY spec §6.1)",
    fn: () => {
      const s = defaultState();
      let out = E.applyToConfig(CNBConfig.createDefault(), s);
      let c = CNBLilypond.sectionC(out);
      assert(c.includes("(repeat     . #f)") && !c.includes("(repeat     . #t)"), "shape → #f");
      s.representationMode = "repeat";
      out = E.applyToConfig(CNBConfig.createDefault(), s);
      c = CNBLilypond.sectionC(out);
      assert(c.includes("(repeat     . #t)") && !c.includes("(repeat     . #f)"), "repeat → #t");
    },
  },
  {
    name: "exporter: default engine state emits no engine settings in Section B (emit-if-changed)",
    fn: () => {
      const b = CNBLilypond.sectionB(E.applyToConfig(CNBConfig.createDefault(), defaultState()));
      for (const token of ["cnb:false-hollow", "cnb:multinote-padding", "cnb:default-magnify",
                           "cnb:indent", "cnb:collision-threshold", "cnb:stem-thickness"]) {
        assert(!b.includes(token), `${token} omitted at defaults`);
      }
    },
  },
  {
    name: "exporter: changed engine values reach Section B",
    fn: () => {
      const s = defaultState();
      s.engine.falseHollow = true;
      s.engine.defaultMagnify = "3/2";
      const b = CNBLilypond.sectionB(E.applyToConfig(CNBConfig.createDefault(), s));
      assert(b.includes("#(set! cnb:false-hollow #t)"), "falseHollow emitted");
      assert(b.includes("#(set! cnb:default-magnify 3/2)"), "magnify emitted");
    },
  },

  // ── render() against the DOM stub ──
  {
    name: "render: structure — definitions (read-only), engine, validation; no repeat counts (session 34), no mode control (session 36)",
    fn: () => withDomStub((container) => {
      const handle = E.render(container);
      const root = handle.root;
      const defRows = findAll(root, "cnb-cpe-def-row");
      assert(defRows.length === 4, "4 definition rows");
      assertEqual(defRows.map(r => r.attrs["data-duration"]),
        ["crotchet", "minim", "semibreve", "breve"], "definition order");
      assert(findAll(defRows[0], "input").length === 0 &&
             defRows[0].children.length === 0, "definition rows carry no inputs (read-only)");
      for (const cls of ["cnb-cpe-mode", "cnb-cpe-mode-option", "cnb-cpe-mode-help"]) {
        assert(findAll(root, cls).length === 0, `no ${cls}: the mode is chosen on the canvas`);
      }
      for (const cls of ["cnb-cpe-repeats", "cnb-cpe-repeat-row", "cnb-cpe-repeat-count"]) {
        assert(findAll(root, cls).length === 0, `no ${cls}: the engine's counts are fixed`);
      }
      assert(findAll(root, "cnb-cpe-engine-row").length === 5, "5 engine rows (§4.10 fields but the stem thickness, session 34, accessible colours, session 37, and multinote padding, session 58)");
      assert(findAll(root, "cnb-cpe-row-multinote").length === 0, "no Multinote padding: the overlap is set on the canvas (session 58)");
      assert(findAll(root, "cnb-cpe-valid").length === 1, "validation valid");
    }),
  },
  {
    name: "render: the config's mode rides through every slice unchanged (session 36)",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      cfg.durations.representationMode = "repeat";
      let last = null;
      const handle = E.render(container, { config: cfg, onChange: (slices) => { last = slices; } });
      findAll(handle.root, "cnb-cpe-false-hollow")[0].onchange({ target: { checked: true } });
      assert(last.durations.representationMode === "repeat", "an engine edit keeps the mode");
      assert(!("REPRESENTATION_MODES" in E), "the mode vocabulary left the editor");
    }),
  },
  {
    name: "render: engine checkbox edits propagate and flip the emit-if-changed badge",
    fn: () => withDomStub((container) => {
      let last = null;
      const handle = E.render(container, { onChange: (slices) => { last = slices; } });
      const badge = () => findAll(
        findAll(handle.root, "cnb-cpe-row-false-hollow")[0], "cnb-cpe-badge")[0].textContent;
      assert(badge() === "engine default — omitted at export", "default badge");
      findAll(handle.root, "cnb-cpe-false-hollow")[0].onchange({ target: { checked: true } });
      assert(last.engine.falseHollow === true, "slice");
      assert(badge() === "non-default — will be emitted", "changed badge");
    }),
  },
  {
    name: "render: defaultMagnify commits valid forms and ignores malformed input",
    fn: () => withDomStub((container) => {
      const handle = E.render(container);
      const magnify = () => findAll(handle.root, "cnb-cpe-default-magnify")[0];
      magnify().oninput({ target: { value: "abc" } });
      assert(handle.getEngine().defaultMagnify === "7/4", "malformed ignored");
      magnify().oninput({ target: { value: "3/2" } });
      assert(handle.getEngine().defaultMagnify === "3/2", "fraction committed");
    }),
  },
  {
    name: "render: lilypondVersion commits non-empty strings and ignores empty input",
    fn: () => withDomStub((container) => {
      const handle = E.render(container);
      const version = () => findAll(handle.root, "cnb-cpe-lilypond-version")[0];
      version().oninput({ target: { value: "" } });
      assert(handle.getEngine().lilypondVersion === "2.24.2", "empty ignored");
      version().oninput({ target: { value: "2.25.0" } });
      assert(handle.getEngine().lilypondVersion === "2.25.0", "committed");
    }),
  },
  {
    name: "render: there is no stem thickness control (session 34)",
    fn: () => withDomStub((container) => {
      const handle = E.render(container);
      for (const cls of ["cnb-cpe-row-stem", "cnb-cpe-stem-auto", "cnb-cpe-stem-thickness"]) {
        assert(findAll(handle.root, cls).length === 0, `no ${cls}`);
      }
    }),
  },
  {
    name: "render: onChange slices and getState are clones — mutating them cannot corrupt state",
    fn: () => withDomStub((container) => {
      let last = null;
      const handle = E.render(container, { onChange: (slices) => { last = slices; } });
      findAll(handle.root, "cnb-cpe-false-hollow")[0].onchange({ target: { checked: true } });
      last.engine.falseHollow = "corrupted";
      last.durations.definitions[0].name = "corrupted";
      const st = handle.getState();
      st.engine.indent = 42;
      assert(handle.getEngine().falseHollow === true, "engine state intact");
      assert(handle.getDurations().definitions[0].name === "crotchet", "durations state intact");
      assert(handle.getEngine().indent === 0, "getState clone");
    }),
  },
  {
    name: "render: setState + applyTo produce a config that validates",
    fn: () => withDomStub((container) => {
      const handle = E.render(container);
      handle.setState({ representationMode: "repeat" });
      const cfg = handle.applyTo(CNBConfig.createDefault());
      assert(cfg.durations.representationMode === "repeat", "applied");
      assert(CNBConfig.validate(cfg).valid, "valid");
    }),
  },
  {
    name: "render: seeded from a non-default config",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      cfg.durations.representationMode = "repeat";
      cfg.engine.indent = 7;
      const handle = E.render(container, { config: cfg });
      assert(handle.getDurations().representationMode === "repeat", "mode seeded");
      assert(handle.getEngine().indent === 7, "engine seeded");
    }),
  },

  // ── renderPreview() against the DOM stub ──
  {
    name: "renderPreview: shape mode — one collection row per duration, no legend",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      const out = E.renderPreview(container, cfg, { pitchClasses: [0, 4, 7] });
      assert(out.mode === "shape", "mode");
      assertEqual(out.durationsShown, ["crotchet", "minim", "semibreve", "breve"], "all rows");
      assert(findAll(out.root, "cnb-duration-row").length === 4, "4 duration rows");
      assert(findAll(out.root, "cnb-cpe-repeat-legend").length === 0, "no legend");
      assertEqual(out.legendItems, [], "no legend items");
      assert(findAll(out.root, "cnb-cpe-preview-note")[0].textContent.includes("(repeat . #f)"),
        "note names the exporter field");
    }),
  },
  {
    name: "renderPreview: repeat mode — one row per duration plus a legend of the engine's counts (a retired repeatCounts ignored)",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      cfg.durations.representationMode = "repeat";
      cfg.durations.repeatCounts = { minim: 3 };
      const out = E.renderPreview(container, cfg, { pitchClasses: [0, 4, 7] });
      assert(out.mode === "repeat", "mode");
      assertEqual(out.durationsShown, ["crotchet", "minim", "semibreve", "breve"], "all rows");
      assert(findAll(out.root, "cnb-duration-row").length === 4, "4 duration rows");
      const items = findAll(out.root, "cnb-cpe-repeat-item");
      assert(items.length === 3, "3 legend items");
      assertEqual(out.legendItems,
        [{ name: "minim", count: 2 }, { name: "semibreve", count: 4 }, { name: "breve", count: 8 }],
        "legend items are the engine's counts");
      assert(items[0].textContent === "Minim (Half): 2 heads", "legend text");
      assert(items[2].textContent === "Breve (Double Whole): two tied semibreves, 8 heads",
        "the breve's legend text (session 44)");
      assert(findAll(out.root, "cnb-cpe-preview-note")[0].textContent.includes("(repeat . #t)"),
        "note names the exporter field");
    }),
  },
  {
    name: "renderPreview: throws on empty definitions and on invalid representationMode",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      cfg.durations.definitions = [];
      assertThrows(() => E.renderPreview(container, cfg), "empty definitions");
      const cfg2 = CNBConfig.createDefault();
      cfg2.durations.representationMode = "bogus";
      assertThrows(() => E.renderPreview(container, cfg2), "invalid mode");
    }),
  },
];
