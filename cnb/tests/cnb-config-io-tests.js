/**
 * cnb-config-io-tests.js — Unit tests for Module 17 (Config Save/Load)
 *
 * Covers filename derivation (every branch including the throw cases),
 * plan §4.11 timestamp stamping (first save vs. later saves, no input
 * mutation), buildSaveFile, parseConfigFile's descriptive throws on
 * malformed files, mergeLoaded (partial configs gain defaults, open-keyed
 * map sections replace instead of merging, version-drift notes, non-blocking
 * validation), save→load round-trip fidelity (deep-equal, including a
 * custom-shapes config that would fail under a plain deep merge), and the
 * render() UI driven against a stub DOM (save path, load path, and the
 * malformed-file path leaving state untouched).
 */

import { CNBConfigIO } from "../ui/config-io.js";
import { CNBConfig } from "../src/cnb-config.js";

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
// Same stub pattern as the Module 12–15 tests.

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

const IO = CNBConfigIO;
const NOW_1 = "2026-07-05T12:00:00.000Z";
const NOW_2 = "2026-07-06T09:30:00.000Z";

/** A config whose open-keyed map sections all differ from the defaults. */
function customConfig() {
  const cfg = CNBConfig.createDefault();
  cfg.meta.configName = "Kite 3-6-9";
  // Replace the shapes map entirely: only a custom shape, no crotchet-minim.
  cfg.shapes = {
    "kite-up": {
      displayName: "Kite Up",
      svgPath: "M 0 -100 L 80 40 L -80 40 Z",
      svgHollowPath: null,
      naturalHeight: 140,
      naturalWidth: 160,
      semitoneHeight: 2.0,
      anchors: null,
      lilypondPath: null,
      lilypondHollowPath: null,
      lilypondAnchors: null,
    },
  };
  cfg.noteheadRules = [{
    name: "Default",
    priority: 0,
    match: { pitchClasses: "all", durations: "all", keys: "all" },
    apply: { shape: "kite-up", hollow: false, color: null, offKeyMark: false },
  }];
  cfg.staff.lineOverrides = { "3": { thicknessPct: 30 } };
  cfg.ledgers.lineOverrides = { "0": { color: "#333333" } };
  cfg.palette.schemeSymbols = { "#1B9E77": "shamrock-1b9e77" };
  cfg.durations.repeatCounts = { minim: 2 };
  return cfg;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // ── deriveFilename ──
  {
    name: "deriveFilename: default config name → default-4-8-system.cnb.json",
    fn: () => {
      assertEqual(IO.deriveFilename("Default 4-8 System"), "default-4-8-system.cnb.json");
    },
  },
  {
    name: "deriveFilename: punctuation/space runs collapse to one hyphen; case lowered; edges trimmed",
    fn: () => {
      assertEqual(IO.deriveFilename("  My — (Weird!!) Config #2  "), "my-weird-config-2.cnb.json");
      assertEqual(IO.deriveFilename("ALLCAPS"), "allcaps.cnb.json");
      assertEqual(IO.deriveFilename("-already-slugged-"), "already-slugged.cnb.json");
    },
  },
  {
    name: "deriveFilename: throws on non-string, empty, whitespace, and no-alphanumeric names",
    fn: () => {
      assertThrows(() => IO.deriveFilename(undefined), "must be a string", "undefined");
      assertThrows(() => IO.deriveFilename(42), "must be a string", "number");
      assertThrows(() => IO.deriveFilename(""), "no letters or digits", "empty");
      assertThrows(() => IO.deriveFilename("   "), "no letters or digits", "whitespace");
      assertThrows(() => IO.deriveFilename("♯♯♯"), "no letters or digits", "symbols only");
    },
  },

  // ── stampMeta ──
  {
    name: "stampMeta: first save sets created AND modified (plan §4.11)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      assert(cfg.meta.created === null, "precondition: default created is null");
      const stamped = IO.stampMeta(cfg, NOW_1);
      assertEqual(stamped.meta.created, NOW_1, "created");
      assertEqual(stamped.meta.modified, NOW_1, "modified");
    },
  },
  {
    name: "stampMeta: later saves preserve created and update only modified",
    fn: () => {
      const first = IO.stampMeta(CNBConfig.createDefault(), NOW_1);
      const second = IO.stampMeta(first, NOW_2);
      assertEqual(second.meta.created, NOW_1, "created preserved");
      assertEqual(second.meta.modified, NOW_2, "modified updated");
    },
  },
  {
    name: "stampMeta: does not mutate the input config",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      IO.stampMeta(cfg, NOW_1);
      assert(cfg.meta.created === null && cfg.meta.modified === null, "input untouched");
    },
  },
  {
    name: "stampMeta: empty-string created counts as unset; missing meta object is created",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.meta.created = "";
      assertEqual(IO.stampMeta(cfg, NOW_1).meta.created, NOW_1, "empty string re-stamped");
      const bare = { version: "1.0" };
      const stamped = IO.stampMeta(bare, NOW_1);
      assertEqual(stamped.meta, { created: NOW_1, modified: NOW_1 }, "meta created from scratch");
    },
  },
  {
    name: "stampMeta: throws on a timestamp that is not a parseable ISO string",
    fn: () => {
      assertThrows(() => IO.stampMeta(CNBConfig.createDefault(), undefined), "Invalid timestamp", "undefined");
      assertThrows(() => IO.stampMeta(CNBConfig.createDefault(), "not a date"), "Invalid timestamp", "garbage");
      assertThrows(() => IO.stampMeta(CNBConfig.createDefault(), 1234567890), "Invalid timestamp", "number");
    },
  },

  // ── buildSaveFile ──
  {
    name: "buildSaveFile: returns stamped config, pretty JSON of it, and derived filename",
    fn: () => {
      const built = IO.buildSaveFile(CNBConfig.createDefault(), { now: NOW_1 });
      assertEqual(built.filename, "default-4-8-system.cnb.json", "filename");
      assertEqual(built.config.meta.created, NOW_1, "stamped created");
      assertEqual(JSON.parse(built.json), built.config, "json is the stamped config");
      assert(built.json.includes("\n  "), "json is pretty-printed");
    },
  },
  {
    name: "buildSaveFile: does not mutate input; throws on non-object config and missing configName",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      IO.buildSaveFile(cfg, { now: NOW_1 });
      assert(cfg.meta.created === null, "input untouched");
      assertThrows(() => IO.buildSaveFile(null), "must be an object", "null config");
      const noName = CNBConfig.createDefault();
      noName.meta.configName = "";
      assertThrows(() => IO.buildSaveFile(noName, { now: NOW_1 }), "no letters or digits", "empty name");
      delete noName.meta;
      assertThrows(() => IO.buildSaveFile(noName, { now: NOW_1 }), "must be a string", "missing meta");
    },
  },

  // ── parseConfigFile ──
  {
    name: "parseConfigFile: valid JSON object parses; root must be a plain object",
    fn: () => {
      assertEqual(IO.parseConfigFile('{"version":"1.0"}'), { version: "1.0" }, "object ok");
      assertThrows(() => IO.parseConfigFile("[1,2,3]"), "an array", "array root");
      assertThrows(() => IO.parseConfigFile("null"), "null", "null root");
      assertThrows(() => IO.parseConfigFile("42"), "number", "number root");
      assertThrows(() => IO.parseConfigFile('"hi"'), "string", "string root");
    },
  },
  {
    name: "parseConfigFile: descriptive throws on non-string input and malformed JSON",
    fn: () => {
      assertThrows(() => IO.parseConfigFile(undefined), "must be a string", "undefined");
      assertThrows(() => IO.parseConfigFile('{"version": '), "not valid JSON", "truncated");
      assertThrows(() => IO.parseConfigFile("not json at all"), "not valid JSON", "garbage");
    },
  },

  // ── mergeLoaded ──
  {
    name: "mergeLoaded: partial config gains defaults for everything it omits",
    fn: () => {
      const { config } = IO.mergeLoaded({ version: "1.0", staff: { semitonePattern: [3, 6, 9] } });
      assertEqual(config.staff.semitonePattern, [3, 6, 9], "provided array replaces");
      assertEqual(config.staff.midpoint, 12, "omitted staff field from defaults");
      assert("crotchet-minim" in config.shapes, "omitted shapes section from defaults");
      assertEqual(config.display.pxPerSemi, 16, "omitted display from defaults");
    },
  },
  {
    name: "mergeLoaded: provided open-keyed maps REPLACE defaults (no resurrected entries)",
    fn: () => {
      const parsed = {
        version: "1.0",
        shapes: { "kite-up": { displayName: "Kite Up" } },
        durations: { repeatCounts: { minim: 2 } },
        palette: { schemeSymbols: { "#123456": "x-123456" } },
        staff: { lineOverrides: { "3": { thicknessPct: 30 } } },
        ledgers: { lineOverrides: { "0": { color: "#333333" } } },
      };
      const { config } = IO.mergeLoaded(parsed);
      assertEqual(Object.keys(config.shapes), ["kite-up"], "default shape not resurrected");
      assertEqual(config.durations.repeatCounts, { minim: 2 }, "default repeat counts not resurrected");
      assertEqual(config.palette.schemeSymbols, { "#123456": "x-123456" }, "schemeSymbols replaced");
      assertEqual(config.staff.lineOverrides, { "3": { thicknessPct: 30 } }, "staff overrides replaced");
      assertEqual(config.ledgers.lineOverrides, { "0": { color: "#333333" } }, "ledger overrides replaced");
      // Fixed-schema neighbors still merged from defaults:
      assertEqual(config.durations.representationMode, "shape", "sibling field from defaults");
      assertEqual(config.palette.name, "None", "sibling field from defaults");
    },
  },
  {
    name: "mergeLoaded: map sections the file omits stay at defaults",
    fn: () => {
      const { config } = IO.mergeLoaded({ version: "1.0" });
      assertEqual(config, CNBConfig.createDefault(), "empty file → pure defaults");
    },
  },
  {
    name: "mergeLoaded: a null/wrong-typed map section falls back to merge behavior (defaults kept)",
    fn: () => {
      const { config } = IO.mergeLoaded({ version: "1.0", shapes: null, staff: { lineOverrides: null } });
      assertEqual(config.shapes, CNBConfig.createDefault().shapes, "null shapes → default shapes kept");
      assertEqual(config.staff.lineOverrides, {}, "null overrides → default kept");
    },
  },
  {
    name: "mergeLoaded: version notes — missing version and drifted version are advisories",
    fn: () => {
      assert(IO.mergeLoaded({}).notes[0].includes("no version field"), "missing version noted");
      assert(IO.mergeLoaded({ version: "0.9" }).notes[0].includes('"0.9"'), "drift noted");
      assertEqual(IO.mergeLoaded({ version: "1.0" }).notes, [], "matching version → no notes");
    },
  },
  {
    name: "mergeLoaded: validation is returned but does not block the load",
    fn: () => {
      const { config, validation } = IO.mergeLoaded({ version: "1.0", staff: { semitonePattern: [4] } });
      assert(validation.valid === false, "invalid config detected");
      assert(validation.errors.some(e => e.includes("at least 2")), "staff error surfaced");
      assertEqual(config.staff.semitonePattern, [4], "config still returned as loaded");
    },
  },
  {
    name: "mergeLoaded: throws on a non-object argument (caller bug)",
    fn: () => {
      assertThrows(() => IO.mergeLoaded(null), "parseConfigFile", "null");
      assertThrows(() => IO.mergeLoaded([1]), "parseConfigFile", "array");
    },
  },

  // ── Round-trip fidelity (spec step 3) ──
  {
    name: "round-trip: default config save → load is deep-equal (stamped config)",
    fn: () => {
      const built = IO.buildSaveFile(CNBConfig.createDefault(), { now: NOW_1 });
      const loaded = IO.loadFromText(built.json);
      assertEqual(loaded.config, built.config, "deep-equal after round trip");
      assert(loaded.validation.valid, "round-tripped default config valid");
      assertEqual(loaded.notes, [], "no version notes");
    },
  },
  {
    name: "round-trip: custom-shape config is deep-equal (map replacement, no default bleed-through)",
    fn: () => {
      const built = IO.buildSaveFile(customConfig(), { now: NOW_1 });
      const loaded = IO.loadFromText(built.json);
      assertEqual(loaded.config, built.config, "deep-equal after round trip");
      assertEqual(Object.keys(loaded.config.shapes), ["kite-up"], "only the saved shape");
      assertEqual(loaded.config.durations.repeatCounts, { minim: 2 }, "only the saved counts");
    },
  },
  {
    name: "round-trip: second save of a loaded config preserves created, updates modified",
    fn: () => {
      const first = IO.buildSaveFile(CNBConfig.createDefault(), { now: NOW_1 });
      const loaded = IO.loadFromText(first.json);
      const second = IO.buildSaveFile(loaded.config, { now: NOW_2 });
      assertEqual(second.config.meta.created, NOW_1, "created survives save→load→save");
      assertEqual(second.config.meta.modified, NOW_2, "modified re-stamped");
    },
  },
  {
    name: "loadFromText: malformed text throws (the render() load path catches this)",
    fn: () => {
      assertThrows(() => IO.loadFromText("{oops"), "not valid JSON", "malformed");
      assertThrows(() => IO.loadFromText("[]"), "an array", "array root");
    },
  },

  // ── render(): construction ──
  {
    name: "render: throws without getConfig; builds save row, load row, status/error/validation areas",
    fn: () => withDomStub((container) => {
      assertThrows(() => IO.render(container, {}), "getConfig", "missing accessor");
      IO.render(container, { getConfig: () => CNBConfig.createDefault() });
      const root = container.children[0];
      assertEqual(root.className, "cnb-config-io", "root class");
      assert(findAll(root, "cnb-cio-save").length === 1, "save button");
      const file = findAll(root, "cnb-cio-file")[0];
      assert(file && file.type === "file", "file input");
      assertEqual(file.getAttribute("accept"), ".json,application/json", "accept attr");
      assert(typeof file.onchange === "function", "file input change wired");
      assert(findAll(root, "cnb-cio-status").length === 1, "status area");
      assert(findAll(root, "cnb-cio-error").length === 1, "error area");
      assert(findAll(root, "cnb-cio-validation").length === 1, "validation area");
    }),
  },
  {
    name: "render: filename preview shows the derived name, or the derive error for a bad name",
    fn: () => withDomStub((container) => {
      const good = IO.render(container, { getConfig: () => CNBConfig.createDefault() });
      assertEqual(findAll(good.root, "cnb-cio-filename")[0].textContent,
        "default-4-8-system.cnb.json", "derived preview");
      const badCfg = CNBConfig.createDefault();
      badCfg.meta.configName = "";
      const bad = IO.render(container, { getConfig: () => badCfg });
      const preview = findAll(bad.root, "cnb-cio-filename")[0];
      assert(preview.className.includes("cnb-cio-filename-error"), "error class");
      assert(preview.textContent.includes("no filename"), "error text");
    }),
  },

  // ── render(): save path ──
  {
    name: "render save: button click delivers the file via download() and reports through onSave",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      const downloads = [];
      const saves = [];
      const api = IO.render(container, {
        getConfig: () => cfg,
        now: () => NOW_1,
        download: (d) => downloads.push(d),
        onSave: (stamped, info) => saves.push({ stamped, info }),
      });
      const btn = findAll(api.root, "cnb-cio-save")[0];
      btn.onclick();
      assertEqual(downloads.length, 1, "one download");
      assertEqual(downloads[0].filename, "default-4-8-system.cnb.json", "filename");
      assertEqual(saves.length, 1, "one onSave");
      assertEqual(saves[0].stamped.meta.created, NOW_1, "stamped config handed to host");
      assertEqual(JSON.parse(downloads[0].json), saves[0].stamped, "downloaded json = stamped config");
      assert(findAll(api.root, "cnb-cio-status")[0].textContent.includes("Saved as default-4-8-system.cnb.json"),
        "status updated");
      assertEqual(findAll(api.root, "cnb-cio-error")[0].textContent, "", "no error");
    }),
  },
  {
    name: "render save: underivable filename → error shown, no download, no onSave",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      cfg.meta.configName = "♯♯♯";
      let downloads = 0, saves = 0;
      const api = IO.render(container, {
        getConfig: () => cfg,
        now: () => NOW_1,
        download: () => downloads++,
        onSave: () => saves++,
      });
      assert(api.save() === null, "save returns null");
      assert(downloads === 0 && saves === 0, "no download, no onSave");
      assert(findAll(api.root, "cnb-cio-error")[0].textContent.includes("Save failed"), "error surfaced");
    }),
  },
  {
    name: "render save: download() failure is surfaced and onSave is not called",
    fn: () => withDomStub((container) => {
      let saves = 0;
      const api = IO.render(container, {
        getConfig: () => CNBConfig.createDefault(),
        now: () => NOW_1,
        download: () => { throw new Error("disk on fire"); },
        onSave: () => saves++,
      });
      assert(api.save() === null, "save returns null");
      assert(saves === 0, "no onSave after failed delivery");
      assert(findAll(api.root, "cnb-cio-error")[0].textContent.includes("disk on fire"), "cause surfaced");
    }),
  },

  // ── render(): load path ──
  {
    name: "render load: valid text → onLoad(config, {validation, notes}), status + validation shown",
    fn: () => withDomStub((container) => {
      const built = IO.buildSaveFile(customConfig(), { now: NOW_1 });
      const loads = [];
      const api = IO.render(container, {
        getConfig: () => CNBConfig.createDefault(),
        onLoad: (config, info) => loads.push({ config, info }),
      });
      const result = api.loadText(built.json, "kite.cnb.json");
      assert(result !== null, "load succeeded");
      assertEqual(loads.length, 1, "one onLoad");
      assertEqual(loads[0].config, built.config, "merged config handed to host");
      assert(loads[0].info.validation.valid === false || loads[0].info.validation.valid === true,
        "validation handed to host");
      const status = findAll(api.root, "cnb-cio-status")[0].textContent;
      assert(status.includes("Loaded kite.cnb.json") && status.includes("Kite 3-6-9"), "status names file and config");
    }),
  },
  {
    name: "render load: validation errors and warnings render in the validation area (load not blocked)",
    fn: () => withDomStub((container) => {
      const loads = [];
      const api = IO.render(container, {
        getConfig: () => CNBConfig.createDefault(),
        onLoad: (config, info) => loads.push({ config, info }),
      });
      api.loadText('{"version":"1.0","staff":{"semitonePattern":[4]}}');
      assertEqual(loads.length, 1, "onLoad still called");
      assert(findAll(api.root, "cnb-cio-verror").length > 0, "errors rendered");
      assert(findAll(api.root, "cnb-cio-valid").length === 0, "no valid badge");
      // A clean default file renders the valid badge and its warnings:
      api.loadText(IO.buildSaveFile(CNBConfig.createDefault(), { now: NOW_1 }).json);
      assert(findAll(api.root, "cnb-cio-valid").length === 1, "valid badge");
      assert(findAll(api.root, "cnb-cio-vwarning").length > 0, "warnings rendered (default has W3)");
    }),
  },
  {
    name: "render load: version-drift note renders in the validation area",
    fn: () => withDomStub((container) => {
      const api = IO.render(container, { getConfig: () => CNBConfig.createDefault() });
      api.loadText('{"version":"0.9"}');
      const notes = findAll(api.root, "cnb-cio-note");
      assert(notes.length === 1 && notes[0].textContent.includes('"0.9"'), "drift note shown");
    }),
  },
  {
    name: "render load: malformed file → error shown, onLoad NOT called, app state untouched",
    fn: () => withDomStub((container) => {
      let loads = 0;
      const api = IO.render(container, {
        getConfig: () => CNBConfig.createDefault(),
        onLoad: () => loads++,
      });
      assert(api.loadText("{not json") === null, "load returns null");
      assert(loads === 0, "onLoad not called");
      assert(findAll(api.root, "cnb-cio-error")[0].textContent.includes("not valid JSON"), "cause surfaced");
      assert(api.loadText("[1,2]") === null, "array root rejected");
      assert(loads === 0, "onLoad still not called");
    }),
  },
  {
    name: "render: a failed load keeps the previous successful load's validation display",
    fn: () => withDomStub((container) => {
      const api = IO.render(container, { getConfig: () => CNBConfig.createDefault() });
      api.loadText(IO.buildSaveFile(CNBConfig.createDefault(), { now: NOW_1 }).json);
      assert(findAll(api.root, "cnb-cio-valid").length === 1, "valid badge from good load");
      api.loadText("{broken");
      assert(findAll(api.root, "cnb-cio-error")[0].textContent.includes("Load failed"), "error shown");
      assert(findAll(api.root, "cnb-cio-valid").length === 1, "prior validation display intact");
    }),
  },
];
