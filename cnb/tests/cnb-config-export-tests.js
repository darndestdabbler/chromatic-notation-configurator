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
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBSvgImporter } from "../ui/svg-importer.js";

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
    name: "key-scoped rules (session 34): the export carries the rule, with no warning about it",
    fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.keys.enabled = true;
      cfg.keys.definitions = [{ name: "G major", pitchClasses: [7, 9, 11, 0, 2, 4, 6] }];
      cfg.noteheadRules.push({
        name: "F♯ red in G major",
        priority: 5,
        match: { pitchClasses: [6], durations: "all", keys: ["G major"] },
        apply: { color: "#FF0000" },
      });
      const v = EX.validateForExport(cfg);
      assert(v.valid === true, "exportable");
      assert(!v.warnings.some(w => w.includes('Rule "F♯ red in G major"')),
        "no warning names the rule: " + JSON.stringify(v.warnings));
      const ly = CNBLilypond.generate(cfg);
      assert(ly.includes("(cnb:register-color! 'red-ff0000 \"#FF0000\")") && ly.includes(";; Key G major"),
        "the rule's colour and its key's branch are in the export");
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
      assert(preview.textContent.includes("No file name"), "error text");
    }),
  },
  {
    name: "render: the button says Export for LilyPond, and the preview-only settings are named once",
    fn: () => withDomStub((container) => {
      const api = EX.render(container, { getConfig: () => CNBConfig.createDefault() });
      assertEqual(findAll(api.root, "cnb-cex-export")[0].textContent, "Export for LilyPond", "button text");
      const notes = findAll(api.root, "cnb-cex-preview-only");
      assertEqual(notes.length, 1, "one sentence");
      assertEqual(notes[0].textContent, EX.PREVIEW_ONLY_SENTENCE, "the sentence");
      // One sentence, naming what the exporter's header lists, and saying
      // the clef and the rest of the key signature export (session 30).
      assertEqual(EX.PREVIEW_ONLY_SENTENCE.split(/[.!?](\s|$)/).filter(s => s && s.trim()).length, 1, "a single sentence");
      for (const s of ["Everything shown here is exported or drawn here as LilyPond draws it", "off-key marks"]) {
        assert(EX.PREVIEW_ONLY_SENTENCE.includes(s), `names ${s}`);
      }
      for (const s of ["stem thickness", "spacing", "repeat counts", "particular key", "ledger"]) {
        assert(!EX.PREVIEW_ONLY_SENTENCE.includes(s), `${s} is no longer preview-only (session 34)`);
      }
      assert(!EX.PREVIEW_ONLY_SENTENCE.includes("placement, bar"), "placement and the bar are no longer preview-only");
      assert(!/colou?r-?blind/i.test(EX.PREVIEW_ONLY_SENTENCE), "no colour-blind switch to name (session 37)");
      api.exportLy();   // download throws without opts.download: the sentence survives a redraw
      assertEqual(findAll(api.root, "cnb-cex-preview-only").length, 1, "still one after a redraw");
    }),
  },
  {
    name: "render meta: without onMeta no fields are drawn",
    fn: () => withDomStub((container) => {
      const api = EX.render(container, { getConfig: () => CNBConfig.createDefault() });
      assertEqual(findAll(api.root, "cnb-cex-meta").length, 0, "no meta block");
      assertEqual(findAll(api.root, "cnb-cex-meta-input").length, 0, "no inputs");
    }),
  },
  {
    name: "render meta: with onMeta the name, file suffix, label and footnote edit meta through the host",
    fn: () => withDomStub((container) => {
      let config = CNBConfig.createDefault();
      const seen = [];
      let api = null;
      api = EX.render(container, {
        getConfig: () => config,
        onMeta: (meta) => { seen.push(meta); config = { ...config, meta }; api.redraw(); },
      });
      const fields = findAll(api.root, "cnb-cex-meta-field");
      assertEqual(fields.map(f => f.getAttribute("data-meta")).join(","),
        "configName,fileSuffix,notationLabel,notationFootnote", "the four fields, in order");
      assertEqual(fields.map(f => findAll(f, "cnb-cex-meta-label")[0].textContent).join(","),
        "Name,File suffix,Notation label,Footnote", "designer labels");
      const input = (key) => findAll(fields.find(f => f.getAttribute("data-meta") === key), "cnb-cex-meta-input")[0];
      assertEqual(input("configName").value, "Default 4-8 System", "seeded from meta");
      assertEqual(input("notationFootnote").value, "", "empty footnote");

      const suffix = input("fileSuffix");
      suffix.oninput({ target: { value: "-Kite" } });
      assertEqual(seen.length, 1, "onMeta called");
      assertEqual(seen[0].fileSuffix, "-Kite", "edited field");
      assertEqual(seen[0].configName, "Default 4-8 System", "other fields kept");
      assertEqual(findAll(api.root, "cnb-cex-filename")[0].textContent, "kite.ly", "the file name follows");
      assert(input("fileSuffix") === suffix, "the input survives the redraw, so it keeps its focus");

      config = { ...config, meta: { ...config.meta, notationLabel: "Loaded elsewhere" } };
      api.redraw();
      assertEqual(input("notationLabel").value, "Loaded elsewhere", "redraw refreshes a value changed elsewhere");
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

  // ── Hostile input (session 6): export of an invalid config ────────────────
  {
    name: "render blocked: several errors at once → one .cnb-cex-verror row per error, count in the status",
    fn: () => withDomStub((container) => {
      const cfg = CNBConfig.createDefault();
      cfg.meta.fileSuffix = "NoHyphen";                         // LY spec §8 check 6
      cfg.noteheadRules[0].apply.color = "black";             // check 7: not #RRGGBB
      cfg.noteheadRules.push({                                   // check 1: missing shape
        name: "Ghost", priority: 5,
        match: { pitchClasses: [0], durations: "all", keys: "all" },
        apply: { shape: "ghost-shape" },
      });
      let downloads = 0, exports = 0;
      const api = EX.render(container, {
        getConfig: () => cfg, download: () => downloads++, onExport: () => exports++,
      });
      let result;
      try { result = api.exportLy(); } catch (err) { throw new Error("exportLy threw: " + err.message); }
      assert(result === null && downloads === 0 && exports === 0, "blocked: no download, no onExport");
      const errors = EX.validateForExport(cfg).errors;
      const rows = findAll(api.root, "cnb-cex-verror").map(r => r.textContent);
      assertEqual(rows, errors, "every validation error is a visible row");
      assert(rows.some(r => r.includes("fileSuffix") || r.includes("hyphen")), "suffix error shown: " + rows.join(" | "));
      assert(rows.some(r => r.includes("black")), "colour error shown: " + rows.join(" | "));
      assert(rows.some(r => r.includes("ghost-shape")), "missing-shape error shown: " + rows.join(" | "));
      const status = findAll(api.root, "cnb-cex-status")[0].textContent;
      assert(status.includes(`fix ${errors.length} errors`), "status counts the errors: " + status);
    }),
  },
  {
    name: "render export: a config whose validation throws shows 'Export failed' and exportLy returns null",
    fn: () => withDomStub((container) => {
      // Structurally broken (a null shape entry): Module A's validate() throws.
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"] = null;
      let downloads = 0;
      const api = EX.render(container, { getConfig: () => cfg, download: () => downloads++ });
      let result;
      try { result = api.exportLy(); } catch (err) { throw new Error("exportLy threw: " + err.message); }
      assert(result === null && downloads === 0, "nothing exported");
      const err = findAll(api.root, "cnb-cex-error")[0].textContent;
      assert(err.startsWith("Export failed: "), "visible failure: " + err);
      assert(findAll(api.root, "cnb-cex-valid").length === 0, "no valid badge");
    }),
  },

  // ── Minim stem anchors (toolkit session 4 pair) reach the export ──────────

  {
    name: "an imported shape with a minim stem pair exports distinct minim-up/minim-down attachments",
    fn: () => {
      // buildShape() is pure: feed it extract()-shaped fields directly.
      const rect = (x, y) => ({ x, y, width: 20, height: 350 });
      const { shape, error } = CNBSvgImporter.buildShape({
        svgPath: "M 120 0 C 120 -55 66 -100 0 -100 C -66 -100 -120 -55 -120 0 C -120 55 -66 100 0 100 C 66 100 120 55 120 0 Z",
        svgHollowPath: null, isFalseHollow: false,
        lilypondNotehead: null, lilypondHollow: null,
        semitoneHeight: 2, viewBoxWidth: 240, viewBoxHeight: 200,
        stemUpRect: rect(100, -350), stemDownRect: rect(-120, 0),
        stemMinimUpRect: rect(70, -380), stemMinimDownRect: rect(-90, 25),
        stemUpPoint: null, stemDownPoint: null,
      }, "Oval");
      assert(error === null, "shape builds: " + error);
      const config = CNBConfig.createDefault();
      config.shapes = { oval: shape };
      config.noteheadRules[0].apply.shape = "oval";
      const result = CNBConfigExport.buildExport(config);
      assert(result.ok, "export succeeds: " + result.validation.errors.join("; "));
      const pair = (key) => {
        const m = result.ly.match(new RegExp(`\\(cons '${key}\\s+'\\(([^)]*)\\)`));
        assert(m, `${key} attachment emitted`);
        return m[1].trim();
      };
      // minimUp (0.8, 0.3) and minimDown (-0.8, -0.25) in semitones, x moved
      // half the 0.13-staff-space stem outward (0.26 semitones at sps 4,
      // session 40), written relative to the oval's ±1.2 × ±1 semitone
      // extent (session 33).
      assert(pair("minim-up") !== pair("crotchet-up"), "minim-up differs from crotchet-up");
      assert(pair("minim-down") !== pair("crotchet-down"), "minim-down differs from crotchet-down");
      const [ux, uy] = pair("minim-up").split(" . ").map(Number);
      const [dx, dy] = pair("minim-down").split(" . ").map(Number);
      assert(Math.abs(ux - 0.8833) < 1e-4 && Math.abs(uy - 0.3) < 1e-4, "minim-up value: " + pair("minim-up"));
      assert(Math.abs(dx + 0.8833) < 1e-4 && Math.abs(dy + 0.25) < 1e-4, "minim-down value: " + pair("minim-down"));
    },
  },

  // ── Pitch axis (set 014 session 3): export through the UI path ────────────

  {
    name: "pitch axis: validateForExport passes an enabled axis config and buildExport emits the hook (the §8a gate is lifted)",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.pitchAxis = {
        enabled: true,
        kind: "pitch-class-map-v1",
        octaveStride: 7,
        axisUnitsPerStaffSpace: 2,
        pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
      };
      const v = CNBConfigExport.validateForExport(config);
      assert(v.valid === true, "export is not blocked: " + v.errors.join("; "));
      const result = CNBConfigExport.buildExport(config);
      assert(result.ok === true, "buildExport succeeds");
      assert(result.ly.includes("cnb:get-pitch-staff-position"), "the export carries the pitch-axis hook");
      // Parity with generate(): an invalid axis section blocks both paths.
      config.pitchAxis.octaveStride = 0;
      const blocked = CNBConfigExport.validateForExport(config);
      assert(blocked.valid === false, "invalid axis blocks the UI export");
      assert(blocked.errors.some(e => e.includes("octaveStride")), "the Module A error is surfaced");
      assertThrows(() => CNBLilypond.generate(config), "octaveStride", "generate() refuses the same config");
      assert(CNBConfigExport.buildExport(config).ok === false, "buildExport blocks without throwing");
    },
  },
  {
    name: "PREVIEW_ONLY_SENTENCE names off-key marks as neither drawn nor exported yet (session 29)",
    fn: () => {
      assert(EX.PREVIEW_ONLY_SENTENCE.includes("off-key marks are kept in the file but neither drawn here nor exported yet"),
        EX.PREVIEW_ONLY_SENTENCE);
    },
  },
];
