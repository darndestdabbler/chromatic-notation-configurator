/**
 * cnb-config-export-tests.js — Unit tests for Module 18 (Config Export /
 * LilyPond)
 *
 * Covers filename derivation (fileSuffix precedence, configName fallback,
 * every throw branch), validateForExport (Module A errors pass through, the
 * exporter-side path-data check mirrors CNBLilypond.generate()'s throw,
 * filename derivability blocks, warnings never block), the
 * validate-then-export flow of buildExport (blocked on errors, proceeds
 * with warnings, exact string parity with a direct CNBLilypond.generate()
 * call, no input mutation), and the render() UI driven against a stub DOM
 * (successful export path, blocked path with errors surfaced and no
 * download/onExport, delivery-failure path, blocked-then-fixed flow).
 */

import { CNBConfigExport } from "../ui/config-export.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond, PITCH_AXIS_GATE_MESSAGE } from "../src/cnb-lilypond.js";

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
// Same stub pattern as the Module 12–17 tests.

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

const EX = CNBConfigExport;

/** A customized-but-valid config: 3-6-9 staff system in repeat mode. */
function customConfig() {
  const cfg = CNBConfig.createDefault();
  cfg.staff.semitonePattern = [3, 6, 9];
  cfg.staff.semitonesPerStaffSpace = 3;
  cfg.durations.representationMode = "repeat";
  cfg.meta.configName = "Kite 3-6-9";
  cfg.meta.fileSuffix = "-Kite369";
  return cfg;
}

/** Default config broken to a single staff line (Module A error 5). */
function brokenConfig() {
  const cfg = CNBConfig.createDefault();
  cfg.staff.semitonePattern = [4];
  return cfg;
}

/** Default config whose only used shape has no path data at all. */
function pathlessConfig() {
  const cfg = CNBConfig.createDefault();
  cfg.shapes["crotchet-minim"].svgPath = null;
  cfg.shapes["crotchet-minim"].lilypondPath = null;
  return cfg;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // ── deriveFilename ──
  {
    name: "deriveFilename: fileSuffix takes precedence — default config → default48.ly",
    fn: () => {
      const meta = CNBConfig.createDefault().meta;
      assertEqual(meta.fileSuffix, "-Default48", "precondition: default suffix");
      assertEqual(EX.deriveFilename(meta), "default48.ly", "suffix slug wins over configName");
    },
  },
  {
    name: "deriveFilename: fileSuffix slugged with the Module 17 rule (case, punctuation runs, edge trim)",
    fn: () => {
      assertEqual(EX.deriveFilename({ fileSuffix: "-My Suffix!!", configName: "x" }), "my-suffix.ly");
      assertEqual(EX.deriveFilename({ fileSuffix: "-KITE--3.6.9-" }), "kite-3-6-9.ly");
    },
  },
  {
    name: "deriveFilename: falls back to configName when fileSuffix is empty, missing, non-string, or slugs empty",
    fn: () => {
      assertEqual(EX.deriveFilename({ fileSuffix: "", configName: "Default 4-8 System" }),
        "default-4-8-system.ly", "empty suffix");
      assertEqual(EX.deriveFilename({ configName: "Default 4-8 System" }),
        "default-4-8-system.ly", "missing suffix");
      assertEqual(EX.deriveFilename({ fileSuffix: 42, configName: "My System" }),
        "my-system.ly", "non-string suffix");
      assertEqual(EX.deriveFilename({ fileSuffix: "-♯♯♯", configName: "My System" }),
        "my-system.ly", "suffix with no alphanumerics falls through");
    },
  },
  {
    name: "deriveFilename: throws when meta is not an object or neither field derives a slug",
    fn: () => {
      assertThrows(() => EX.deriveFilename(null), "must be an object", "null meta");
      assertThrows(() => EX.deriveFilename("x"), "must be an object", "string meta");
      assertThrows(() => EX.deriveFilename({}), "Cannot derive", "empty meta");
      assertThrows(() => EX.deriveFilename({ fileSuffix: "", configName: "" }), "Cannot derive", "both empty");
      assertThrows(() => EX.deriveFilename({ fileSuffix: "-♯", configName: "♯♯♯" }), "Cannot derive", "no alphanumerics");
    },
  },

  // ── validateForExport ──
  {
    name: "validateForExport: default config is exportable — valid, no errors, warnings present",
    fn: () => {
      const v = EX.validateForExport(CNBConfig.createDefault());
      assert(v.valid === true, "valid");
      assertEqual(v.errors, [], "no errors");
      assert(v.warnings.length > 0, "default config carries Module A warnings (e.g. no data-lilypond-*)");
    },
  },
  {
    name: "validateForExport: throws on a non-object config (caller bug)",
    fn: () => {
      assertThrows(() => EX.validateForExport(null), "must be an object", "null");
      assertThrows(() => EX.validateForExport([1]), "must be an object", "array");
    },
  },
  {
    name: "validateForExport: Module A blocking errors pass through (single staff line)",
    fn: () => {
      const v = EX.validateForExport(brokenConfig());
      assert(v.valid === false, "invalid");
      assert(v.errors.some(e => e.includes("at least 2")), "staff-pattern error surfaced");
    },
  },
  {
    name: "validateForExport: exporter-side path-data check mirrors CNBLilypond.generate()'s throw",
    fn: () => {
      const cfg = pathlessConfig();
      const v = EX.validateForExport(cfg);
      assert(v.valid === false, "path-less used shape blocks");
      assert(v.errors.some(e => e.includes("no path data")), "path-data error surfaced");
      // Parity: generate() throws on exactly this condition.
      assertThrows(() => CNBLilypond.generate(cfg), "no path data", "generate parity");
    },
  },
  {
    name: "validateForExport: a shape without path data that no rule uses does NOT block",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["unused-blob"] = { displayName: "Unused", svgPath: null, lilypondPath: null };
      const v = EX.validateForExport(cfg);
      assert(v.valid === true, "unused shape ignored (same as generate())");
    },
  },
  {
    name: "key-scoped rules: validateForExport and generate() agree (both resolve with key=null)",
    fn: () => {
      // A key-scoped rule referencing a PATHLESS shape: with key=null the
      // rule matches in neither Module 18's usedShapeNames() nor Module 11's
      // usedShapes() (cnb-lilypond.js resolveAll passes key=null), so the
      // shape is outside both used-shape sets — validateForExport stays
      // valid AND generate() does not throw. This pins that no config can
      // pass validateForExport and then hit generate()'s path-data throw.
      const cfg = CNBConfig.createDefault();
      cfg.shapes["ghost"] = { displayName: "Ghost", svgPath: null, lilypondPath: null };
      cfg.noteheadRules.push({
        name: "G-major only",
        priority: 2,
        match: { pitchClasses: "all", durations: "all", keys: ["G"] },
        apply: { shape: "ghost" },
      });
      const v = EX.validateForExport(cfg);
      assert(v.valid === true, "key-scoped pathless shape does not block (unused at key=null)");
      let generated = null;
      try { generated = CNBLilypond.generate(cfg); } catch (err) {
        throw new Error("generate() threw where validateForExport passed: " + err.message);
      }
      assert(typeof generated === "string" && generated.length > 0, "generate() succeeded");
      // Flip the same rule to all keys: now BOTH sides flag the same defect.
      cfg.noteheadRules[cfg.noteheadRules.length - 1].match.keys = "all";
      const v2 = EX.validateForExport(cfg);
      assert(v2.valid === false && v2.errors.some(e => e.includes('"ghost"') && e.includes("no path data")),
        "all-keys pathless shape blocks in validateForExport");
      assertThrows(() => CNBLilypond.generate(cfg), "no path data", "and generate() throws on the same config");
    },
  },
  {
    name: "validateForExport: an underivable filename is a blocking error",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.meta.fileSuffix = "";
      cfg.meta.configName = "";
      const v = EX.validateForExport(cfg);
      assert(v.valid === false, "blocked");
      assert(v.errors.some(e => e.includes("Cannot derive a .ly filename")), "filename error surfaced");
    },
  },
  {
    name: "validateForExport: missing meta section reports the filename block instead of crashing",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      delete cfg.meta;
      const v = EX.validateForExport(cfg);
      assert(v.valid === false, "blocked");
      assert(v.errors.some(e => e.includes("Cannot derive a .ly filename")), "filename error surfaced");
    },
  },

  // ── buildExport ──
  {
    name: "buildExport: success carries ok, filename, validation, and a complete .ly text",
    fn: () => {
      const result = EX.buildExport(CNBConfig.createDefault());
      assert(result.ok === true, "ok");
      assertEqual(result.filename, "default48.ly", "filename");
      assert(result.validation.valid && result.validation.warnings.length > 0, "validation carried");
      assert(result.ly.startsWith('\\version'), "starts with version declaration");
      assert(result.ly.includes("SECTION A") && result.ly.includes("SECTION B") &&
        result.ly.includes("SECTION C"), "all sections present");
    },
  },
  {
    name: "buildExport: ly is EXACTLY CNBLilypond.generate(config) — default config (spec step 3)",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      assert(EX.buildExport(cfg).ly === CNBLilypond.generate(cfg), "verbatim string parity");
    },
  },
  {
    name: "buildExport: ly parity holds on a customized config (3-6-9 pattern, repeat mode)",
    fn: () => {
      const cfg = customConfig();
      const result = EX.buildExport(cfg);
      assert(result.ly === CNBLilypond.generate(cfg), "verbatim string parity");
      assertEqual(result.filename, "kite369.ly", "suffix-derived filename");
      assert(/\(repeat\s+\. #t\)/.test(result.ly), "repeat mode reaches Section C");
    },
  },
  {
    name: "buildExport: blocked on errors — ok false, ly and filename null, no throw",
    fn: () => {
      const result = EX.buildExport(brokenConfig());
      assert(result.ok === false, "blocked");
      assert(result.ly === null && result.filename === null, "no artifact");
      assert(result.validation.errors.length > 0, "errors carried");
    },
  },
  {
    name: "buildExport: proceeds with warnings (default config warns but exports)",
    fn: () => {
      const result = EX.buildExport(CNBConfig.createDefault());
      assert(result.ok === true && result.validation.warnings.length > 0,
        "warnings do not block (spec step 3)");
    },
  },
  {
    name: "buildExport: throws on a non-object config; does not mutate the input",
    fn: () => {
      assertThrows(() => EX.buildExport(undefined), "must be an object", "undefined");
      const cfg = CNBConfig.createDefault();
      const before = JSON.stringify(cfg);
      EX.buildExport(cfg);
      assertEqual(JSON.stringify(cfg), before, "input untouched");
    },
  },

  // ── render(): construction ──
  {
    name: "render: throws without getConfig; builds export row, status/error/validation areas",
    fn: () => withDomStub((container) => {
      assertThrows(() => EX.render(container, {}), "getConfig", "missing accessor");
      EX.render(container, { getConfig: () => CNBConfig.createDefault() });
      const root = container.children[0];
      assertEqual(root.className, "cnb-config-export", "root class");
      const btn = findAll(root, "cnb-cex-export")[0];
      assert(btn && btn.tag === "button" && typeof btn.onclick === "function", "export button wired");
      assert(findAll(root, "cnb-cex-status").length === 1, "status area");
      assert(findAll(root, "cnb-cex-error").length === 1, "error area");
      assert(findAll(root, "cnb-cex-validation").length === 1, "validation area");
      assertEqual(findAll(root, "cnb-cex-validation")[0].children.length, 0,
        "validation area empty before any export attempt");
    }),
  },
  {
    name: "render: filename preview shows the derived name, or the derive error for a bad meta",
    fn: () => withDomStub((container) => {
      const good = EX.render(container, { getConfig: () => CNBConfig.createDefault() });
      assertEqual(findAll(good.root, "cnb-cex-filename")[0].textContent, "default48.ly", "derived preview");
      const badCfg = CNBConfig.createDefault();
      badCfg.meta.fileSuffix = "";
      badCfg.meta.configName = "";
      const bad = EX.render(container, { getConfig: () => badCfg });
      const preview = findAll(bad.root, "cnb-cex-filename")[0];
      assert(preview.className.includes("cnb-cex-filename-error"), "error class");
      assert(preview.textContent.includes("no filename"), "error text");
    }),
  },

  // ── render(): export success path ──
  {
    name: "render export: button click delivers the .ly via download() and reports through onExport",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      const downloads = [];
      const exports = [];
      const api = EX.render(container, {
        getConfig: () => cfg,
        download: (d) => downloads.push(d),
        onExport: (ly, info) => exports.push({ ly, info }),
      });
      const btn = findAll(api.root, "cnb-cex-export")[0];
      btn.onclick();
      assertEqual(downloads.length, 1, "one download");
      assertEqual(downloads[0].filename, "default48.ly", "filename");
      assert(downloads[0].ly === CNBLilypond.generate(cfg), "downloaded text = direct generate()");
      assertEqual(exports.length, 1, "one onExport");
      assert(exports[0].ly === downloads[0].ly, "onExport gets the same text");
      assertEqual(exports[0].info.filename, "default48.ly", "onExport filename");
      assert(findAll(api.root, "cnb-cex-status")[0].textContent.includes("Exported as default48.ly"),
        "status updated");
      assertEqual(findAll(api.root, "cnb-cex-error")[0].textContent, "", "no error");
      assert(findAll(api.root, "cnb-cex-valid").length === 1, "valid badge rendered");
      assert(findAll(api.root, "cnb-cex-vwarning").length > 0, "warnings rendered on success too");
      assert(findAll(api.root, "cnb-cex-verror").length === 0, "no error rows");
    }),
  },
  {
    name: "render export: download() failure is surfaced and onExport is not called",
    fn: () => withDomStub((container) => {
      let exports = 0;
      const api = EX.render(container, {
        getConfig: () => CNBConfig.createDefault(),
        download: () => { throw new Error("disk on fire"); },
        onExport: () => exports++,
      });
      assert(api.exportLy() === null, "exportLy returns null");
      assert(exports === 0, "no onExport after failed delivery");
      assert(findAll(api.root, "cnb-cex-error")[0].textContent.includes("disk on fire"), "cause surfaced");
    }),
  },
  {
    name: "render export: exportLy() returns the built result on success",
    fn: () => withDomStub((container) => {
      const api = EX.render(container, {
        getConfig: () => CNBConfig.createDefault(),
        download: () => {},
      });
      const result = api.exportLy();
      assert(result !== null && result.ok === true, "result returned");
      assertEqual(result.filename, "default48.ly", "filename in result");
    }),
  },

  // ── render(): blocked path ──
  {
    name: "render blocked: validation errors → no download, no onExport, reasons in .cnb-cex-verror",
    fn: () => withDomStub((container) => {
      let downloads = 0, exports = 0;
      const api = EX.render(container, {
        getConfig: () => brokenConfig(),
        download: () => downloads++,
        onExport: () => exports++,
      });
      assert(api.exportLy() === null, "exportLy returns null");
      assert(downloads === 0 && exports === 0, "no download, no onExport");
      const statusEl = findAll(api.root, "cnb-cex-status")[0];
      assert(statusEl.textContent.includes("Export blocked"), "blocked status");
      assert(statusEl.className.includes("cnb-cex-status-blocked"),
        "blocked modifier class for host styling");
      assertEqual(findAll(api.root, "cnb-cex-error")[0].textContent, "",
        "error area empty — a validation block is not an unexpected failure");
      const errRows = findAll(api.root, "cnb-cex-verror");
      assert(errRows.length > 0 && errRows.some(r => r.textContent.includes("at least 2")),
        "the WHY is rendered (spec step 2)");
      assert(findAll(api.root, "cnb-cex-valid").length === 0, "no valid badge");
    }),
  },
  {
    name: "render blocked: underivable filename blocks through the same validation path",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      cfg.meta.fileSuffix = "";
      cfg.meta.configName = "";
      let downloads = 0;
      const api = EX.render(container, {
        getConfig: () => cfg,
        download: () => downloads++,
      });
      assert(api.exportLy() === null && downloads === 0, "blocked, no download");
      assert(findAll(api.root, "cnb-cex-verror").some(r => r.textContent.includes("Cannot derive")),
        "filename block explained");
    }),
  },
  {
    name: "render blocked-then-fixed: host fixes the config and the next export succeeds",
    fn: () => withDomStub((container) => {
      // Host wiring like the test page: the shell owns one mutable config.
      const hostConfig = brokenConfig();
      const downloads = [];
      const api = EX.render(container, {
        getConfig: () => hostConfig,
        download: (d) => downloads.push(d),
      });
      assert(api.exportLy() === null, "first attempt blocked");
      assert(findAll(api.root, "cnb-cex-verror").length > 0, "errors shown");
      hostConfig.staff.semitonePattern = [4, 8];   // the fix
      const result = api.exportLy();
      assert(result !== null && result.ok === true, "second attempt succeeds");
      assertEqual(downloads.length, 1, "download delivered after fix");
      assert(findAll(api.root, "cnb-cex-verror").length === 0, "error rows cleared");
      assert(findAll(api.root, "cnb-cex-valid").length === 1, "valid badge shown");
      const statusEl = findAll(api.root, "cnb-cex-status")[0];
      assert(statusEl.textContent.includes("Exported as"), "status flipped to exported");
      assert(!statusEl.className.includes("cnb-cex-status-blocked"),
        "blocked modifier class cleared after the fix");
    }),
  },

  // ── Pitch axis (set 014): the §8a fail-loud gate through the UI path ──────

  {
    name: "fail-loud gate parity: validateForExport blocks a pitchAxis-enabled config with the exact message generate() throws; buildExport blocks without throwing",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.pitchAxis = {
        enabled: true,
        kind: "pitch-class-map-v1",
        octaveStride: 7,
        axisUnitsPerStaffSpace: 2,
        pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
      };
      // UI side: a blocking validation error (no throw), so the export
      // button explains the block instead of crashing.
      const v = CNBConfigExport.validateForExport(config);
      assert(v.valid === false, "export is blocked");
      assert(v.errors.includes(PITCH_AXIS_GATE_MESSAGE), "the §8a gate message is surfaced verbatim");
      // Parity: generate() throws with the IDENTICAL text.
      assertThrows(() => CNBLilypond.generate(config), PITCH_AXIS_GATE_MESSAGE,
        "generate() throws the same §8a message");
      // buildExport follows the blocked contract (ok:false, no throw).
      const result = CNBConfigExport.buildExport(config);
      assert(result.ok === false && result.ly === null, "buildExport blocks");
      assert(result.validation.errors.includes(PITCH_AXIS_GATE_MESSAGE), "blocked result carries the gate error");
      // Disabling the section lifts the gate.
      config.pitchAxis.enabled = false;
      const lifted = CNBConfigExport.validateForExport(config);
      assert(!lifted.errors.some(e => e.includes("§8a")), "no gate error when disabled");
      assert(CNBConfigExport.buildExport(config).ok === true, "export proceeds when disabled");
    },
  },
];
