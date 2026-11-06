/**
 * cnb-lilypond-tests.js — Unit tests for Module 11 (LilyPond Exporter)
 *
 * Session 1 coverage: header, Section A (named definitions), Section B
 * (engine settings), and the svgPathToLilypond / toSchemeSymbol /
 * computeStaffLinePositions helpers.
 *
 * Session 2 coverage: Section C (configuration procedure — memv grouping,
 * duration-aware compound conditions, repeat field), generate() (order +
 * export validation). The parity tests against the legacy exporter were
 * retired with the monolith (preserved at tag `legacy-monolith-final`).
 */

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "fs";
import { execFile } from "child_process";
import { findEngine, measureNoteheads } from "./engine-probe.js";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBLilypond, _internals } from "../src/cnb-lilypond.js";
import { CNBScheme } from "../src/cnb-scheme.js";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function contains(haystack, needle, msg) {
  if (!haystack.includes(needle)) {
    throw new Error(`${msg || "contains"}: output does not include ${JSON.stringify(needle)}`);
  }
}

function lacks(haystack, needle, msg) {
  if (haystack.includes(needle)) {
    throw new Error(`${msg || "lacks"}: output unexpectedly includes ${JSON.stringify(needle)}`);
  }
}

/** Config with a small palette on PCs 0–2 for color-registration tests. */
function paletteConfig() {
  const cfg = CNBConfig.createDefault();
  cfg.palette = {
    name: "Dark2 · 3 colors",
    colors: [
      { pc: 0, hex: "#1B9E77", name: "Shamrock" },
      { pc: 1, hex: "#D95F02", name: "Orange" },
      { pc: 2, hex: "#7570B3", name: "Lilac" },
    ],
    cbSafeColors: [
      { pc: 0, hex: "#009F81", name: "Teal" },
      { pc: 1, hex: "#FF6E3A", name: "Orange CB" },
      { pc: 2, hex: "#0058CB", name: "Blue" },
    ],
    useCBSafe: false,
    schemeSymbols: {
      "#1B9E77": "shamrock-1b9e77",
      "#D95F02": "orange-d95f02",
      "#7570B3": "lilac-7570b3",
    },
  };
  return cfg;
}

/**
 * Parse a Section C string into a map pc → { shape, color, hollow,
 * attachment, condition }. Expands memv groups; skips the else fallback.
 * Used for semantic comparison (structure, not formatting).
 */
function parseSectionCClauses(text) {
  const map = {};
  let pcs = null;
  let condition = null;

  for (const line of text.split("\n")) {
    const memv = line.match(/\(memv pc '\(([\d ]+)\)\)/);
    const single = line.match(/\(= pc (\d+)\)/);
    if (line.includes("(else")) { pcs = null; condition = null; continue; }
    if (memv || single) {
      pcs = memv ? memv[1].trim().split(/\s+/).map(Number) : [Number(single[1])];
      condition = line.trim();
      continue;
    }
    const field = line.match(/\((shape|color|hollow|attachment|x-offset)\s+\.\s+([^)\s]+)\)/);
    if (field && pcs) {
      for (const pc of pcs) {
        if (!map[pc]) map[pc] = { condition };
        map[pc][field[1]] = field[2];
      }
    }
  }
  return map;
}

export const tests = [

  // ── pathToStaffSpace / svgPathToLilypond (audit H2/H3) ─────────────────────

  // The toolkit writes kite-up.svg (4 semitones tall, 100 SVG units per
  // semitone) as semitone-unit data: (moveto 0 2) (lineto 2 1) …
  { name: "pathToStaffSpace: a toolkit (semitone-unit) path is divided by sps 1, 2 and 3", fn: () => {
      const commands = [
        { cmd: "moveto", args: [0, 2] }, { cmd: "lineto", args: [2, 1] },
        { cmd: "curveto", args: [3, 3, -3, 3, 0, -2] }, { cmd: "closepath", args: [] },
      ];
      eq(CNBLilypond.pathToStaffSpace(commands, 1),
        "'(\n    (moveto 0 2)\n    (lineto 2 1)\n    (curveto 3 3 -3 3 0 -2)\n    (closepath))", "sps 1");
      eq(CNBLilypond.pathToStaffSpace(commands, 2),
        "'(\n    (moveto 0 1)\n    (lineto 1 0.5)\n    (curveto 1.5 1.5 -1.5 1.5 0 -1)\n    (closepath))", "sps 2");
      eq(CNBLilypond.pathToStaffSpace(commands, 3),
        "'(\n    (moveto 0 0.6667)\n    (lineto 0.6667 0.3333)\n    (curveto 1 1 -1 1 0 -0.6667)\n    (closepath))", "sps 3");
    }},

  { name: "pathToStaffSpace: flipY negates Y only", fn: () => {
      eq(CNBLilypond.pathToStaffSpace([{ cmd: "moveto", args: [4, 8] }], 2, true), "'(\n    (moveto 2 -4))");
    }},

  { name: "svgPathToLilypond normalises SVG units: ÷ units per semitone, Y up, ÷ sps 1, 2 and 3", fn: () => {
      // kite-up.svg's notehead d, 100 SVG units per semitone: the same
      // geometry as the toolkit path above, so the same output at each sps.
      const d = "M 0 -200 L 200 -100 C 300 -300 -300 -300 0 200 Z";
      for (const [sps, expected] of [
        [1, "'(\n    (moveto 0 2)\n    (lineto 2 1)\n    (curveto 3 3 -3 3 0 -2)\n    (closepath))"],
        [2, "'(\n    (moveto 0 1)\n    (lineto 1 0.5)\n    (curveto 1.5 1.5 -1.5 1.5 0 -1)\n    (closepath))"],
        [3, "'(\n    (moveto 0 0.6667)\n    (lineto 0.6667 0.3333)\n    (curveto 1 1 -1 1 0 -0.6667)\n    (closepath))"],
      ]) {
        eq(CNBLilypond.svgPathToLilypond(d, 100, sps), expected, `sps ${sps}`);
      }
    }},

  { name: "svgPathToLilypond uses the shape's own units per semitone (136.2 for the gallery shapes)", fn: () => {
      // 136.2 SVG units = 1 semitone; sps 2 → 0.5 staff space
      contains(CNBLilypond.svgPathToLilypond("M 136.2 -272.4", 136.2, 2), "(moveto 0.5 1)");
    }},

  { name: "svgPathToLilypond folds H/V into lineto with tracked position", fn: () => {
      const out = CNBLilypond.svgPathToLilypond("M 0 0 H 5 V 6 Z", 1, 1);
      contains(out, "(lineto 5 0)");
      contains(out, "(lineto 5 -6)");
    }},

  { name: "svgPathToLilypond rounds to 4 decimals and normalizes -0 to 0", fn: () => {
      contains(CNBLilypond.svgPathToLilypond("M 0.123456 -1.999999", 1, 1), "(moveto 0.1235 2)");
      contains(CNBLilypond.svgPathToLilypond("M -0.00001 0.00001", 1, 1), "(moveto 0 0)");
    }},

  { name: "svgPathToLilypond returns '() for empty/invalid input", fn: () => {
      eq(CNBLilypond.svgPathToLilypond("", 100, 4), "'()");
      eq(CNBLilypond.svgPathToLilypond(null, 100, 4), "'()");
    }},

  // ── toSchemeSymbol ─────────────────────────────────────────────────────────

  { name: "toSchemeSymbol combines name and hex", fn: () => {
      eq(CNBLilypond.toSchemeSymbol("Shamrock", "#1B9E77"), "shamrock-1b9e77");
    }},

  { name: "toSchemeSymbol without hex slugs the name", fn: () => {
      eq(CNBLilypond.toSchemeSymbol("Crotchet–Minim"), "crotchet-minim");
      eq(CNBLilypond.toSchemeSymbol("My  Shape!!"), "my-shape");
    }},

  { name: "toSchemeSymbol collapses repeats and trims hyphens", fn: () => {
      eq(CNBLilypond.toSchemeSymbol("--Weird---Name--"), "weird-name");
    }},

  // ── computeStaffLinePositions ──────────────────────────────────────────────

  // LilyPond staff positions are half-staff-spaces from center (LY spec
  // §5.1; engine cnb/config.ly) — the ×2 factor is the 007-s1 D2 fix.
  { name: "staff-line-positions: 4-8 system, midpoint 12, sps 4 → (-4 -2 2 4) half-staff-spaces", fn: () => {
      const cfg = CNBConfig.createDefault();
      const pos = CNBLilypond.computeStaffLinePositions(cfg);
      eq(JSON.stringify(pos), JSON.stringify([-4, -2, 2, 4]));
    }},

  { name: "staff-line-positions: 3-6-9 system, midpoint 12, sps 3 → (-6 -4 -2 2 4 6) half-staff-spaces (engine reference)", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.semitonePattern = [3, 6, 9];
      cfg.staff.semitonesPerStaffSpace = 3;
      const pos = CNBLilypond.computeStaffLinePositions(cfg);
      eq(JSON.stringify(pos), JSON.stringify([-6, -4, -2, 2, 4, 6]));
    }},

  // ── header ─────────────────────────────────────────────────────────────────

  { name: "header emits version, include, and generated-by block", fn: () => {
      const cfg = CNBConfig.createDefault();
      const out = CNBLilypond.header(cfg);
      contains(out, '\\version "2.24.2"');
      contains(out, '\\include "ChromaticNotationBase.ly"');
      contains(out, "Default 4-8 System — Generated by Chromatic Configurator");
      contains(out, "DO NOT EDIT BY HAND");
      contains(out, "%% Source: Default 4-8 System.json");
      contains(out, "%% Color palette: none (no palette colors are exported)");
    }},

  { name: "header lists the preview-only settings the export leaves out (M2, L2, L3)", fn: () => {
      const out = CNBLilypond.header(CNBConfig.createDefault());
      for (const item of ["staff line colour and thickness", "ledger rules", "stem",
                          "thickness, repeat counts", "the CB-safe preview toggle", "rules scoped to a key"]) {
        contains(out, item);
      }
    }},

  { name: "header names the palette only when Section A carries its colors, and claims no cb-safe mode (L2)", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.palette = {
        name: "Two", useCBSafe: true, schemeSymbols: {},
        colors: [{ pc: 0, hex: "#1B9E77" }, { pc: 1, hex: "#D95F02" }],
        cbSafeColors: [{ pc: 0, hex: "#0077BB" }, { pc: 1, hex: "#EE7733" }],
      };
      let out = CNBLilypond.generate(cfg);
      contains(out, "%% Color palette: Two\n");
      contains(out, "%% Primary palette: Two\n");
      contains(out, "cnb:use-accessible-colors");
      lacks(out, "cb-safe)");
      lacks(out, "(standard)");
      // An explicit rule color on every pitch class: the palette is named in
      // the config but none of its colors reaches the export.
      cfg.noteheadRules.push({ name: "All teal", priority: 9,
        match: { pitchClasses: "all", durations: "all", keys: "all" }, apply: { color: "#123456" } });
      out = CNBLilypond.generate(cfg);
      contains(out, "%% Color palette: none (no palette colors are exported)");
      contains(out, "%% Primary palette: none (rule colors only)");
      lacks(out, "Color palette: Two");
    }},

  { name: "header version comes from engine.lilypondVersion", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.lilypondVersion = "2.25.0";
      contains(CNBLilypond.header(cfg), '\\version "2.25.0"');
    }},

  // ── Section A: paths ───────────────────────────────────────────────────────

  { name: "sectionA falls back to SVG path conversion in staff-space units when lilypondPath is null", fn: () => {
      // Default crotchet-minim: 100 SVG units per semitone, sps 4 →
      // M 163.578 -81.573 becomes (moveto 0.4089 0.2039), not raw SVG (H3).
      const out = CNBLilypond.sectionA(CNBConfig.createDefault());
      contains(out, "#(define cnb:crotchet-minim-path '(\n    (moveto 0.4089 0.2039)");
      lacks(out, "163.578");
    }},

  { name: "sectionA emits a pre-baked lilypondPath ÷ sps, re-emitted from its numbers (H2)", fn: () => {
      const cfg = CNBConfig.createDefault(); // sps 4
      cfg.shapes["crotchet-minim"].lilypondPath = "'((moveto 0.80 -0.0) (closepath))";
      cfg.shapes["crotchet-minim"].lilypondHollowPath = "'( (moveto 2 0)\n(closepath) )";
      const out = CNBLilypond.sectionA(cfg);
      contains(out, "#(define cnb:crotchet-minim-path '(\n    (moveto 0.2 0)\n    (closepath)))");
      contains(out, "#(define cnb:crotchet-minim-cutout-path '(\n    (moveto 0.5 0)\n    (closepath)))");
      lacks(out, "curveto", "pre-baked paths should suppress fallback conversion");
    }},

  { name: "sectionA divides path data by axisUnitsPerStaffSpace under a pitch axis", fn: () => {
      const cfg = spikeAxisConfig(); // axisUnitsPerStaffSpace 2, staff sps 4
      cfg.shapes["crotchet-minim"].lilypondPath = "'((moveto 1 -1) (closepath))";
      contains(CNBLilypond.sectionA(cfg), "#(define cnb:crotchet-minim-path '(\n    (moveto 0.5 -0.5)\n    (closepath)))");
    }},

  { name: "sectionA refuses a pre-baked path that does not parse, naming the field", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].lilypondPath = `'()) (system "calc") (define x '()`;
      let threw = null;
      try { CNBLilypond.sectionA(cfg); } catch (err) { threw = err; }
      assert(threw !== null, "sectionA must throw");
      contains(threw.message, `shapes["crotchet-minim"].lilypondPath`);
    }},

  { name: "emitters: comment fields cannot break out of a %% or ;; comment", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.meta.notationLabel = 'Label\n#(display "X1")';
      cfg.meta.configName = 'Name\r#(display "X2")';
      cfg.palette.name = 'Pal\n#(display "X3")';
      cfg.durations.definitions[0].name = 'crotchet\n#(display "X4")';
      cfg.noteheadRules.push({ name: "q", priority: 5,
        match: { pitchClasses: [0], durations: [cfg.durations.definitions[0].name], keys: "all" },
        apply: { hollow: true } });
      const out = CNBLilypond.header(cfg) + CNBLilypond.sectionC(cfg);
      for (const line of out.split("\n")) {
        assert(!/^\s*#\(display/.test(line), `no line may start with injected Scheme: ${JSON.stringify(line)}`);
      }
      contains(out, '%% Label #(display "X1") — Generated by Chromatic Configurator');
      contains(out, '%% Source: Name #(display "X2").json');
      contains(out, '(crotchet #(display "X4"))');
    }},

  { name: "emitters: metadata strings stay inside their Scheme string literal", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.meta.notationFootnote = 'a") (display "X") ("';
      contains(CNBLilypond.sectionB(cfg), '  "a\\") (display \\"X\\") (\\"")');
    }},

  { name: "emitters: invalid version, magnify, symbol and number values make export throw naming the field", fn: () => {
      const cases = [
        ["engine.lilypondVersion", (c) => { c.engine.lilypondVersion = '2.24.2"\n#(display "X")'; }, (c) => CNBLilypond.header(c)],
        ["engine.defaultMagnify", (c) => { c.engine.defaultMagnify = '7/4) #(display "X")'; }, (c) => CNBLilypond.sectionB(c)],
        ["engine.indent", (c) => { c.engine.indent = '(display "X")'; }, (c) => CNBLilypond.sectionB(c)],
        ["palette.schemeSymbols", (c) => { c.palette.schemeSymbols["#1B9E77"] = 'x) (display "X") (quote'; }, (c) => CNBLilypond.sectionA(c)],
        ["Shape", (c) => { c.shapes["音符"] = c.shapes["crotchet-minim"]; delete c.shapes["crotchet-minim"];
          for (const r of c.noteheadRules) if (r.apply.shape) r.apply.shape = "音符"; }, (c) => CNBLilypond.sectionA(c)],
      ];
      for (const [field, mutate, emit] of cases) {
        const cfg = paletteConfig();
        mutate(cfg);
        let threw = null;
        try { emit(cfg); } catch (err) { threw = err; }
        assert(threw !== null, `${field}: must throw`);
        contains(threw.message, field, `${field}: error names the field`);
      }
    }},

  { name: "emitters: ratio defaultMagnify is re-emitted from its numbers", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.defaultMagnify = "8/5";
      contains(CNBLilypond.sectionB(cfg), "#(set! cnb:default-magnify 8/5)");
    }},

  { name: "baselines: the default config still exports byte-identically to default-export-baseline.ly", fn: () => {
      const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      const baseline = readFileSync(path.join(CNB_DIR, "fixtures", "default-export-baseline.ly"), "utf8");
      eq(normalize(CNBLilypond.generate(CNBConfig.createDefault())), normalize(baseline), "default export");
    }},

  { name: "baselines: the Kite 4-369 export still exports byte-identically to kite-4-369-export-baseline.ly", fn: () => {
      // Captured before session 11's path-unit change: the export set 007
      // matched to the engine's golden score, which the rebuilt fixture must reproduce.
      const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      const baseline = readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-export-baseline.ly"), "utf8");
      const config = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8"));
      eq(normalize(CNBLilypond.generate(config)), normalize(baseline), "Kite export");
    }},

  { name: "baselines: the 45deg-369 export still exports byte-identically to 45deg-369-export-baseline.ly", fn: () => {
      // Exported by cnb/fixtures/export-config.mjs in session 16.
      const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      const baseline = readFileSync(path.join(CNB_DIR, "fixtures", "45deg-369-export-baseline.ly"), "utf8");
      const config = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "45deg-369-config.json"), "utf8"));
      eq(normalize(CNBLilypond.generate(config)), normalize(baseline), "45deg-369 export");
    }},

  { name: "baselines: the Kite 4-369 export carries its toolkit (semitone-unit) paths ÷ sps 3", fn: () => {
      const text = readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8");
      const { config } = CNBConfigIO.loadFromText(text);
      const out = CNBLilypond.generate(config);
      const sps = config.staff.semitonesPerStaffSpace;
      eq(sps, 3, "Kite staff");
      let count = 0;
      for (const [name, shape] of Object.entries(config.shapes)) {
        const sym = _internals.slug(name);
        for (const [key, def] of [["lilypondPath", "path"], ["lilypondHollowPath", "cutout-path"]]) {
          if (!shape[key]) continue;
          const scaled = CNBLilypond.pathToStaffSpace(CNBScheme.parsePath(shape[key]), sps);
          contains(out, `#(define cnb:${sym}-${def} ${scaled})`, `${name} ${key}`);
          count++;
        }
      }
      assert(count >= 2, `expected pre-baked Kite paths, found ${count}`);
      contains(out, "(moveto 0 0.6667)", "kite-up's toolkit (moveto 0 2) at sps 3");
    }},

  { name: "sectionA registers paths and hollow cutouts", fn: () => {
      const out = CNBLilypond.sectionA(CNBConfig.createDefault());
      contains(out, "#(cnb:register-path! 'crotchet-minim cnb:crotchet-minim-path)");
      contains(out, "#(cnb:register-hollow! 'crotchet-minim-cutout cnb:crotchet-minim-cutout-path)");
    }},

  { name: "sectionA omits hollow registration when shape has no hollow path", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].svgHollowPath = null;
      // Default rules mark sharps hollow; drop that rule so the config stays coherent
      cfg.noteheadRules = [cfg.noteheadRules[0]];
      const out = CNBLilypond.sectionA(cfg);
      lacks(out, "register-hollow!");
      lacks(out, "cutout-path");
    }},

  // ── Section A: attachments ─────────────────────────────────────────────────

  { name: "sectionA converts SVG anchors to staff-space units (÷ scale, Y-invert, ÷ sps)", fn: () => {
      // naturalHeight 272.4 / semitoneHeight 2.724 → 100 SVG units per
      // semitone; default staff has sps 4, so 157.2926 SVG units →
      // 1.5729 semitones → 0.3932 staff-spaces (007-s1 D5 fix).
      const out = CNBLilypond.sectionA(CNBConfig.createDefault());
      contains(out, "#(cnb:register-attachment! 'crotchet-minim-attach");
      contains(out, "(cons 'crotchet-up   '(0.3932 . 0.1075))");
      contains(out, "(cons 'crotchet-down '(-0.3932 . -0.1075))");
      contains(out, "(cons 'minim-up      '(0.3932 . 0.1075))");
      contains(out, "(cons 'minim-down    '(-0.3932 . -0.1075))");
    }},

  { name: "sectionA prefers lilypondAnchors (semitone units), converting ÷ sps at export", fn: () => {
      // Kite reference values: 2.7 semitones at sps 3 → the engine's 0.9
      // staff-space attachment; minim x ∓1.095 → ∓0.365 (007-s1 D5).
      const cfg = CNBConfig.createDefault();
      cfg.staff.semitonePattern = [3, 6, 9];
      cfg.staff.semitonesPerStaffSpace = 3;
      cfg.shapes["crotchet-minim"].lilypondAnchors = {
        crotchetUp:   { x: 0,      y: 2.7 },
        crotchetDown: { x: 0,      y: -2.7 },
        minimUp:      { x: -1.095, y: 2.7 },
        minimDown:    { x: 1.095,  y: -2.7 },
      };
      const out = CNBLilypond.sectionA(cfg);
      contains(out, "(cons 'crotchet-up   '(0 . 0.9))");
      contains(out, "(cons 'crotchet-down '(0 . -0.9))");
      contains(out, "(cons 'minim-up      '(-0.365 . 0.9))");
      contains(out, "(cons 'minim-down    '(0.365 . -0.9))");
    }},

  { name: "sectionA marks stemless shapes and skips attachment registration", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].anchors = null;
      cfg.shapes["crotchet-minim"].lilypondAnchors = null;
      const out = CNBLilypond.sectionA(cfg);
      contains(out, "%% crotchet-minim: stemless — no attachment registered");
      lacks(out, "register-attachment!");
    }},

  // ── Section A: colors ──────────────────────────────────────────────────────

  { name: "sectionA default config registers only black (no palette)", fn: () => {
      const out = CNBLilypond.sectionA(CNBConfig.createDefault());
      contains(out, `#(cnb:register-color! 'black-000000 "#000000")`);
      lacks(out, "cnb:use-accessible-colors");
    }},

  { name: "sectionA emits CB-safe conditional block with identical symbols in both branches", fn: () => {
      const out = CNBLilypond.sectionA(paletteConfig());
      contains(out, "#(if (and (defined? 'cnb:use-accessible-colors) cnb:use-accessible-colors)");
      // Accessible branch uses CB-safe hex under the primary symbol
      contains(out, `(cnb:register-color! 'shamrock-1b9e77 "#009F81")`);
      contains(out, `(cnb:register-color! 'orange-d95f02 "#FF6E3A")`);
      contains(out, `(cnb:register-color! 'lilac-7570b3 "#0058CB")`);
      // Primary branch uses the primary hex under the same symbol
      contains(out, `(cnb:register-color! 'shamrock-1b9e77 "#1B9E77")`);
      contains(out, `(cnb:register-color! 'orange-d95f02 "#D95F02")`);
      contains(out, `(cnb:register-color! 'lilac-7570b3 "#7570B3")`);
      // PCs without palette entries fall back to black
      contains(out, `#(cnb:register-color! 'black-000000 "#000000")`);
    }},

  { name: "sectionA falls back to color-<hex> symbols when schemeSymbols is empty", fn: () => {
      const cfg = paletteConfig();
      cfg.palette.schemeSymbols = {};
      const out = CNBLilypond.sectionA(cfg);
      contains(out, `(cnb:register-color! 'color-1b9e77 "#1B9E77")`);
    }},

  { name: "sectionA registers explicit rule colors with identity CB fallback", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules.push({
        name: "F is red",
        priority: 2,
        match: { pitchClasses: [5], durations: "all", keys: "all" },
        apply: { color: "#FF0000" },
      });
      const out = CNBLilypond.sectionA(cfg);
      // Appears in both branches with the same hex (no CB pairing known)
      const matches = out.match(/\(cnb:register-color! 'color-ff0000 "#FF0000"\)/g) || [];
      eq(matches.length, 2, "explicit color registered once per branch");
    }},

  // ── Section B ──────────────────────────────────────────────────────────────

  { name: "sectionB always emits staff geometry (positions in half-staff-spaces, D2)", fn: () => {
      const out = CNBLilypond.sectionB(CNBConfig.createDefault());
      contains(out, "#(set! cnb:semitones-per-staff-space 4)");
      contains(out, "#(set! cnb:staff-line-positions '(-4 -2 2 4))");
    }},

  { name: "sectionB always emits cnb:use-procedure-model #t (D1 — engine defaults to the vector model)", fn: () => {
      const out = CNBLilypond.sectionB(CNBConfig.createDefault());
      contains(out, "#(set! cnb:use-procedure-model #t)");
    }},

  { name: "sectionB omits all engine settings at their defaults", fn: () => {
      const out = CNBLilypond.sectionB(CNBConfig.createDefault());
      lacks(out, "cnb:false-hollow");
      lacks(out, "cnb:multinote-padding");
      lacks(out, "cnb:default-magnify");
      lacks(out, "cnb:indent");
      lacks(out, "cnb:collision-threshold");
      lacks(out, "cnb:default-staff-line-thickness");
      lacks(out, "cnb:default-staff-line-color");
      lacks(out, "cnb:stem-thickness");
    }},

  { name: "sectionB emits changed engine settings", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.falseHollow = true;
      cfg.engine.multinotePadding = -1;
      cfg.engine.defaultMagnify = "3/2";
      cfg.engine.indent = 5;
      cfg.engine.collisionThreshold = 3;
      const out = CNBLilypond.sectionB(cfg);
      contains(out, "#(set! cnb:false-hollow #t)");
      contains(out, "#(set! cnb:multinote-padding -1)");
      contains(out, "#(set! cnb:default-magnify 3/2)");
      contains(out, "#(set! cnb:indent 5)");
      contains(out, "#(set! cnb:collision-threshold 3)");
    }},

  { name: "M1: a set engine.stemThickness is never exported (the engine has no cnb:stem-thickness)", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.stemThickness = 1.5;
      assert(CNBConfig.validate(cfg).valid, "the setting stays valid config");
      lacks(CNBLilypond.generate(cfg), "cnb:stem-thickness");
    }},

  { name: "M2: changed staff-line thickness and color are preview-only — the export is unchanged", fn: () => {
      const cfg = CNBConfig.createDefault();
      const before = CNBLilypond.generate(cfg);
      cfg.staff.lineDefaults.thicknessPct = 40;
      cfg.staff.lineDefaults.color = "#333333";
      const out = CNBLilypond.generate(cfg);
      lacks(out, "cnb:default-staff-line-thickness");
      lacks(out, "cnb:default-staff-line-color");
      eq(out, before, "staff styling does not reach the export");
    }},

  { name: "sectionB always emits file-suffix and notation-label", fn: () => {
      const out = CNBLilypond.sectionB(CNBConfig.createDefault());
      contains(out, `#(set! cnb:file-suffix "-Default48")`);
      contains(out, `#(set! cnb:notation-label "Default 4-8 System")`);
    }},

  { name: "sectionB emits footnote only when non-empty, with Scheme escaping", fn: () => {
      const cfg = CNBConfig.createDefault();
      let out = CNBLilypond.sectionB(cfg);
      lacks(out, "cnb:notation-footnote");

      cfg.meta.notationFootnote = 'Uses "hollow" sharps';
      out = CNBLilypond.sectionB(cfg);
      contains(out, "#(set! cnb:notation-footnote");
      contains(out, '  "Uses \\"hollow\\" sharps")');
    }},

  // ── Internals ──────────────────────────────────────────────────────────────

  { name: "usedShapes resolves rule-referenced shapes from the default config", fn: () => {
      const shapes = _internals.usedShapes(CNBConfig.createDefault());
      eq(JSON.stringify(shapes), JSON.stringify(["crotchet-minim"]));
    }},

  { name: "usedShapes ignores shapes not present in config.shapes", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules.push({
        name: "Ghost shape",
        priority: 5,
        match: { pitchClasses: [0], durations: "all", keys: "all" },
        apply: { shape: "does-not-exist" },
      });
      const shapes = _internals.usedShapes(cfg);
      eq(JSON.stringify(shapes), JSON.stringify(["crotchet-minim"]));
    }},

  { name: "usedColors pairs primary and CB-safe hexes by pitch class", fn: () => {
      const { colors, hasBlack } = _internals.usedColors(paletteConfig());
      eq(colors.length, 3);
      eq(colors[0].hex, "#1B9E77");
      eq(colors[0].cbHex, "#009F81");
      eq(colors[0].symbol, "shamrock-1b9e77");
      assert(hasBlack, "PCs 3–11 have no palette entry and should count as black");
    }},

  // ── Section C: procedure structure ─────────────────────────────────────────

  { name: "sectionC emits the procedure scaffolding (set!/lambda/let/cond)", fn: () => {
      const out = CNBLilypond.sectionC(CNBConfig.createDefault());
      contains(out, "SECTION C — CONFIGURATION PROCEDURE");
      contains(out, "#(set! cnb:get-notehead-config");
      contains(out, "(lambda (semitone duration key)");
      contains(out, "(let ((pc (modulo semitone 12)))");
      contains(out, "(cond");
    }},

  { name: "sectionC groups identical configs into memv clauses (default: naturals vs sharps)", fn: () => {
      const out = CNBLilypond.sectionC(CNBConfig.createDefault());
      contains(out, "((memv pc '(0 2 4 5 7 9 11))");
      contains(out, "((memv pc '(1 3 6 8 10))");
      const clauses = parseSectionCClauses(out);
      // Naturals: solid; sharps: hollow via the shape's cutout
      eq(clauses[0].hollow, "#f", "pc 0 solid");
      eq(clauses[1].hollow, "crotchet-minim-cutout", "pc 1 hollow");
      for (let pc = 0; pc < 12; pc++) {
        eq(clauses[pc].shape, "crotchet-minim", `pc ${pc} shape`);
        eq(clauses[pc].color, "black-000000", `pc ${pc} default black`);
        eq(clauses[pc].attachment, "crotchet-minim-attach", `pc ${pc} attachment`);
      }
    }},

  { name: "sectionC uses (= pc N) for single-pc groups", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules.push({
        name: "F is red",
        priority: 2,
        match: { pitchClasses: [5], durations: "all", keys: "all" },
        apply: { color: "#FF0000" },
      });
      const out = CNBLilypond.sectionC(cfg);
      contains(out, "((= pc 5)");
      const clauses = parseSectionCClauses(out);
      eq(clauses[5].color, "color-ff0000");
    }},

  { name: "sectionC resolves palette colors to their scheme symbols", fn: () => {
      const out = CNBLilypond.sectionC(paletteConfig());
      const clauses = parseSectionCClauses(out);
      eq(clauses[0].color, "shamrock-1b9e77");
      eq(clauses[1].color, "orange-d95f02");
      eq(clauses[2].color, "lilac-7570b3");
      eq(clauses[3].color, "black-000000");
    }},

  { name: "sectionC emits hollow #f when the shape has no hollow path", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].svgHollowPath = null;
      const out = CNBLilypond.sectionC(cfg);
      const clauses = parseSectionCClauses(out);
      eq(clauses[1].hollow, "#f", "sharp resolves hollow but shape has no cutout");
    }},

  { name: "sectionC emits attachment #f for stemless shapes", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].anchors = null;
      cfg.shapes["crotchet-minim"].lilypondAnchors = null;
      const out = CNBLilypond.sectionC(cfg);
      const clauses = parseSectionCClauses(out);
      eq(clauses[0].attachment, "#f");
    }},

  { name: "sectionC repeat field follows representationMode", fn: () => {
      const cfg = CNBConfig.createDefault();
      // Default mode is "shape" (distinct shapes per duration) → #f
      contains(CNBLilypond.sectionC(cfg), "(repeat     . #f)");
      lacks(CNBLilypond.sectionC(cfg), "(repeat     . #t)");
      cfg.durations.representationMode = "repeat";
      contains(CNBLilypond.sectionC(cfg), "(repeat     . #t)");
      lacks(CNBLilypond.sectionC(cfg), "(repeat     . #f)");
    }},

  { name: "sectionC emits a fallback else clause closing the procedure", fn: () => {
      const out = CNBLilypond.sectionC(CNBConfig.createDefault());
      contains(out, ";; Fallback");
      contains(out, "(else");
      // else alist ends the cond, let, lambda, and set! forms
      contains(out, "(repeat     . #f)))))))");
    }},

  { name: "sectionC warns and emits no procedure when no rules are defined", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules = [];
      const out = CNBLilypond.sectionC(cfg);
      contains(out, "%% WARNING: No notehead rules defined.");
      lacks(out, "cnb:get-notehead-config");
    }},

  // ── Section C: duration-aware compound conditions ──────────────────────────

  { name: "sectionC default config has no duration conditions (uniform across durations)", fn: () => {
      const out = CNBLilypond.sectionC(CNBConfig.createDefault());
      lacks(out, "(= duration");
    }},

  { name: "sectionC emits compound (and pc duration) clauses for duration-varying pcs", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules.push({
        name: "C is hollow as a minim",
        priority: 2,
        match: { pitchClasses: [0], durations: ["minim"], keys: "all" },
        apply: { hollow: true },
      });
      const out = CNBLilypond.sectionC(cfg);
      // pc 0 varies by duration → one compound clause per duration
      contains(out, "((and (= pc 0) (= duration 3))"); // crotchet: solid
      contains(out, "((and (= pc 0) (= duration 2))"); // minim: hollow
      // remaining naturals stay in a duration-free memv group
      contains(out, "((memv pc '(2 4 5 7 9 11))");
      // the minim clause carries the hollow cutout
      const minimClause = out.slice(out.indexOf("((and (= pc 0) (= duration 2))"));
      contains(minimClause.slice(0, 300), "(hollow     . crotchet-minim-cutout)");
      // the crotchet clause stays solid
      const crotchetClause = out.slice(out.indexOf("((and (= pc 0) (= duration 3))"));
      contains(crotchetClause.slice(0, 300), "(hollow     . #f)");
    }},

  // ── generate ───────────────────────────────────────────────────────────────

  { name: "generate concatenates header, A, B, C in mandatory order", fn: () => {
      const out = CNBLilypond.generate(CNBConfig.createDefault());
      assert(out.startsWith('\\version "2.24.2"'), "file starts with version declaration");
      const iHeader = out.indexOf("Generated by Chromatic Configurator");
      const iA = out.indexOf("SECTION A — NAMED DEFINITIONS");
      const iB = out.indexOf("SECTION B — ENGINE SETTINGS");
      const iC = out.indexOf("SECTION C — CONFIGURATION PROCEDURE");
      assert(iHeader >= 0 && iA > iHeader, "A after header");
      assert(iB > iA, "B after A");
      assert(iC > iB, "C after B");
    }},

  { name: "generate output contains the complete Section C procedure", fn: () => {
      const out = CNBLilypond.generate(CNBConfig.createDefault());
      contains(out, "#(set! cnb:get-notehead-config");
      contains(out, "((memv pc '(0 2 4 5 7 9 11))");
    }},

  { name: "generate throws on blocking validation errors", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.semitonePattern = [4]; // fewer than 2 staff lines
      let threw = false;
      try { CNBLilypond.generate(cfg); } catch (err) {
        threw = true;
        contains(err.message, "export validation");
        contains(err.message, "at least 2 semitone positions");
      }
      assert(threw, "generate should throw on invalid config");
    }},

  { name: "generate throws when a used shape has no path data", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].svgPath = null;
      cfg.shapes["crotchet-minim"].lilypondPath = null;
      let threw = false;
      try { CNBLilypond.generate(cfg); } catch (err) {
        threw = true;
        contains(err.message, 'Shape "crotchet-minim" has no path data');
      }
      assert(threw, "generate should throw when path data is missing");
    }},

  { name: "sectionC throws when a duration-varying duration lacks lilypondDuration", fn: () => {
      const cfg = CNBConfig.createDefault();
      delete cfg.durations.definitions.find(d => d.name === "minim").lilypondDuration;
      cfg.noteheadRules.push({
        name: "C is hollow as a minim",
        priority: 2,
        match: { pitchClasses: [0], durations: ["minim"], keys: "all" },
        apply: { hollow: true },
      });
      let threw = false;
      try { CNBLilypond.sectionC(cfg); } catch (err) {
        threw = true;
        contains(err.message, 'Duration "minim" has no numeric lilypondDuration');
      }
      assert(threw, "sectionC should refuse to emit a duration-insensitive clause");
    }},

  // ── Clef non-emission (set 009 session 2, per s1-engine-coordination.md:
  //    the engine exposes no clef hook, so the exporter emits NOTHING for
  //    clefs — a clef-enabled config must export exactly like the same
  //    config with the clef disabled, and remain a valid export) ──

  { name: "generate: clef-enabled config passes validation and exports byte-identically to clef-disabled (no engine clef hook — s1 coordination)", fn: () => {
      const enabled = CNBConfig.createDefault();
      enabled.clef = {
        enabled: true,
        active: "express-b",
        glyphs: {
          "express-b": {
            displayName: "Express B Clef",
            kind: "glyph",
            svgPath: "M 0 0 L 100 0 L 100 300 L 0 300 Z",
            naturalHeight: 300,
            naturalWidth: 100,
            semitoneHeight: 6,
            viewBoxMinX: 0,
            viewBoxMinY: 0,
            lilypondPath: null,
            anchorSemi: 22.784,
          },
        },
        gutter: { paddingH: 20 },
      };
      const disabled = CNBConfig.clone(enabled);
      disabled.clef.enabled = false;

      assert(CNBConfig.validate(enabled).valid, "clef-enabled config is valid");
      const enabledLy = CNBLilypond.generate(enabled);   // throws on blocking errors
      const disabledLy = CNBLilypond.generate(disabled);
      // The header stamps a date-only line, so two same-run exports are
      // byte-identical without normalization.
      eq(enabledLy, disabledLy, "clef section is invisible to the exporter");
      lacks(enabledLy, "clef", "no clef token anywhere in the export");
    }},

  // ── Key-signature non-emission (set 010 session 2, per that set's
  //    s1-engine-coordination.md: the engine already renders notehead-chord
  //    key signatures from the score's \key through the exported notehead
  //    config, and exposes no key-signature configuration surface — there
  //    is nothing for the exporter to emit. A keysig-enabled config must
  //    export exactly like the same config with it disabled, and remain a
  //    valid export) ──

  { name: "generate: key-signature-enabled config passes validation and exports byte-identically to key-signature-disabled (engine renders keysigs from the score's \\key — s1 coordination)", fn: () => {
      const enabled = CNBConfig.createDefault();
      enabled.keys.enabled = true;
      enabled.keys.definitions = [
        { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
        { name: "A", pitchClasses: [1, 2, 4, 6, 8, 9, 11], tonicPc: 9 },
      ];
      enabled.keys.keySignature = {
        enabled: true,
        style: "notehead-chords",
        placement: { rule: "scale-from-tonic", tonicOctave: 2 },
        separator: { enabled: true, color: "#123abc", thicknessPct: 40, extentSemis: 6 },
        gutter: { paddingH: 20 },
      };
      const disabled = CNBConfig.clone(enabled);
      disabled.keys.keySignature.enabled = false;

      assert(CNBConfig.validate(enabled).valid, "keysig-enabled config is valid");
      const enabledLy = CNBLilypond.generate(enabled);   // throws on blocking errors
      const disabledLy = CNBLilypond.generate(disabled);
      // The header stamps a date-only line, so two same-run exports are
      // byte-identical without normalization.
      eq(enabledLy, disabledLy, "keySignature section is invisible to the exporter");
      lacks(enabledLy, "keysig", "no keysig token anywhere in the export");
      lacks(enabledLy, "keySignature", "no keySignature token anywhere in the export");
    }},

  // ── Pitch axis (set 014 session 3): v1.3 emission, §8a gate lifted ──────

  { name: "pitch axis §5.4a: computeStaffLinePositions reproduces the 013 spike staff '(-3 -1 1 4 6 8)", fn: () => {
      const config = spikeAxisConfig();
      eq(CNBLilypond.computeStaffLinePositions(config).join(" "), "-3 -1 1 4 6 8", "spike staff positions");
    }},

  { name: "pitch axis §5.4a: staff lines collapsing onto one axis position are emitted once", fn: () => {
      const config = spikeAxisConfig();
      config.staff.semitonePattern = [2, 5, 6, 8, 9];   // 5/6 and 8/9 share positions 3 and 5
      eq(CNBLilypond.computeStaffLinePositions(config).join(" "), "-3 -1 1 4 6 8", "deduplicated and sorted");
    }},

  { name: "pitch axis §5.4b: the compiled procedure inlines map, stride, midpoint anchor and axis units; middle C maps to -4", fn: () => {
      const config = spikeAxisConfig();
      const b = CNBLilypond.sectionB(config);
      contains(b, "#(set! cnb:get-pitch-staff-position", "hook set");
      contains(b, "(vector-ref #(0 0 1 2 2 3 3 4 5 5 6 6) pc)", "positions vector");
      contains(b, "(* oct 7))))", "octave stride");
      contains(b, "(/ (* 2 (- pos 4)) 2))))", "midpoint anchor 4 and axis-units divisor 2");
      contains(b, "12 pitch classes on 7 positions/octave", "comment counts distinct positions");
      // Evaluate the emitted arithmetic the way Scheme does (floored modulo).
      const hook = (semi) => {
        const pc = ((semi % 12) + 12) % 12;
        const oct = (semi - pc) / 12;
        const pos = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6][pc] + oct * 7;
        return (2 * (pos - 4)) / 2;
      };
      eq(hook(0), -4, "middle C → -4");
      eq(hook(7), 0, "midpoint G → 0");
      eq(hook(-1), -5, "B below middle C (negative octave) → -5");
      // The hook block sits after staff geometry and before the metadata.
      assert(b.indexOf("cnb:staff-line-positions") < b.indexOf("cnb:get-pitch-staff-position"), "after staff geometry");
      assert(b.indexOf("cnb:get-pitch-staff-position") < b.indexOf("%% Metadata"), "before metadata");
    }},

  { name: "pitch axis: cnb:semitones-per-staff-space uses axisUnitsPerStaffSpace (handoff 008 §4.1); staff-line thickness stays preview-only", fn: () => {
      const config = spikeAxisConfig();
      config.staff.semitonesPerStaffSpace = 4;
      config.staff.lineDefaults.thicknessPct = 30;
      const b = CNBLilypond.sectionB(config);
      contains(b, "#(set! cnb:semitones-per-staff-space 2)", "axis units, not the linear sps");
      lacks(b, "cnb:default-staff-line-thickness", "preview-only (M2)");
    }},

  { name: "pitch axis §4.4a: attachment points divide by axisUnitsPerStaffSpace", fn: () => {
      const config = spikeAxisConfig();
      config.staff.semitonesPerStaffSpace = 4;
      config.shapes["crotchet-minim"].lilypondAnchors = {
        crotchetUp: { x: 1, y: 0.5 }, crotchetDown: { x: -1, y: -0.5 },
        minimUp: { x: 1, y: 0.5 }, minimDown: { x: -1, y: -0.5 },
      };
      const a = CNBLilypond.sectionA(config);
      contains(a, "(cons 'crotchet-up   '(0.5 . 0.25))", "÷ 2, not ÷ 4");
    }},

  { name: "pitch axis: explicit cnb:keysig-tonic-octave — placement.tonicOctave when integer, else the auto octave for a C tonic (handoff 008 §4.2)", fn: () => {
      const config = spikeAxisConfig();
      contains(CNBLilypond.sectionB(config), "#(set! cnb:keysig-tonic-octave 0)", "auto: midpoint 7 → octave 0");
      config.staff.midpoint = 19;
      contains(CNBLilypond.sectionB(config), "#(set! cnb:keysig-tonic-octave 1)", "auto: midpoint 19 → octave 1");
      config.keys.keySignature.placement.tonicOctave = -1;
      contains(CNBLilypond.sectionB(config), "#(set! cnb:keysig-tonic-octave -1)", "explicit octave as given");
    }},

  { name: "pitch axis §6.3: nonzero x-offset is emitted, joins the grouping key, and zero is omitted", fn: () => {
      const config = spikeAxisConfig();
      config.noteheadRules.push({
        name: "shared-position sharps sit right", priority: 10,
        match: { pitchClasses: [1, 4, 6, 9, 11], durations: "all", keys: "all" },
        apply: { xOffsetStaffSpaces: 0.85 },
      });
      config.noteheadRules.push({
        name: "zero offset is no offset", priority: 11,
        match: { pitchClasses: [2], durations: "all", keys: "all" },
        apply: { xOffsetStaffSpaces: 0 },
      });
      const c = CNBLilypond.sectionC(config);
      const byPc = parseSectionCClauses(c);
      for (let pc = 0; pc < 12; pc++) {
        const expected = [1, 4, 6, 9, 11].includes(pc) ? "0.85" : undefined;
        eq(byPc[pc]["x-offset"], expected, `pc ${pc} x-offset`);
      }
      // Grouping: an offset pc never shares a clause with an unshifted pc of
      // otherwise-identical fields (E is solid like C, D, F — but alone with
      // the other solid offset pcs).
      eq(byPc[4].condition, "((memv pc '(4 9 11))", "solid offset pcs E, A, B grouped together");
      eq(byPc[0].condition, "((memv pc '(0 2 5 7))", "solid unshifted pcs grouped apart");
      contains(c, "+0.85 staff-space right", "clause comment names the offset");
      lacks(c, "(x-offset   . 0)", "zero offsets never emitted");
    }},

  { name: "pitch axis: generate() exports an enabled axis config (the §8a gate is lifted)", fn: () => {
      const ly = CNBLilypond.generate(spikeAxisConfig());
      contains(ly, "cnb:get-pitch-staff-position", "the hook is emitted");
      contains(ly, "#(set! cnb:staff-line-positions '(-3 -1 1 4 6 8))", "axis staff");
    }},

  { name: "pitch axis: disabled or non-boolean-enabled sections export byte-identically to the default, even with xOffsetStaffSpaces rules", fn: () => {
      const defaultLy = CNBLilypond.generate(CNBConfig.createDefault());
      for (const enabled of [false, 1, "true"]) {
        const config = CNBConfig.createDefault();
        config.pitchAxis = { ...spikeAxisConfig().pitchAxis, enabled };
        config.noteheadRules.push({
          name: "offset", priority: 10,
          match: { pitchClasses: [1], durations: "all", keys: "all" },
          apply: { xOffsetStaffSpaces: 0.85 },
        });
        eq(CNBLilypond.generate(config), defaultLy, `enabled: ${JSON.stringify(enabled)}`);
      }
    }},

  { name: "pitch axis §8 checks 8-12: generate() refuses configs failing the axis validation", fn: () => {
      const cases = [
        ["8 kind", c => { c.pitchAxis.kind = "other"; }, "pitchAxis.kind must be"],
        ["9 map coverage", c => { c.pitchAxis.pitchClasses.pop(); }, "exactly 12 entries"],
        ["9 duplicate pc", c => { c.pitchAxis.pitchClasses[11].pc = 10; }, "more than one entry for pc 10"],
        ["9 stride", c => { c.pitchAxis.octaveStride = 0; }, "octaveStride must be a finite number > 0"],
        ["9 axis units", c => { c.pitchAxis.axisUnitsPerStaffSpace = -2; }, "axisUnitsPerStaffSpace must be a finite number > 0"],
        ["10 collapsing overrides", c => {
          c.staff.semitonePattern = [2, 5, 6, 8];
          c.staff.lineOverrides = { 5: { color: "#ff0000" }, 6: { color: "#0000ff" } };
        }, "collapse onto one axis position"],
        ["11 x-offset", c => {
          c.noteheadRules.push({ name: "bad", priority: 9, match: { pitchClasses: [1], durations: "all", keys: "all" }, apply: { xOffsetStaffSpaces: "0.85" } });
        }, "xOffsetStaffSpaces must be a finite number"],
        ["12 monotonic", c => { c.pitchAxis.pitchClasses[3].position = 0.5; c.pitchAxis.pitchClasses[2].position = 1; }, "not globally non-decreasing"],
      ];
      for (const [label, mutate, message] of cases) {
        const config = spikeAxisConfig();
        mutate(config);
        let threw = null;
        try { CNBLilypond.generate(config); } catch (err) { threw = err; }
        assert(threw !== null, `check ${label}: generate() must throw`);
        contains(threw.message, "Config failed export validation", `check ${label}: validation error`);
        contains(threw.message, message, `check ${label}`);
      }
    }},

  { name: "pitch axis: the Twinline compact fixture, loaded through CNBConfigIO, exports byte-identically to its pinned baseline", fn: () => {
      const normalize = (text) => text
        .replace(/\r\n/g, "\n")
        .replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      const fixture = readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json"), "utf8");
      const { config, validation } = CNBConfigIO.loadFromText(fixture);
      assert(validation.valid, "fixture validates: " + validation.errors.join("; "));
      const baseline = readFileSync(path.join(CNB_DIR, "fixtures", "twinline-compact-export-baseline.ly"), "utf8");
      eq(normalize(CNBLilypond.generate(config)), normalize(baseline), "pinned compact export");
    }},

  // ── Hostile input (session 10, audit 2026-11-02 H1/L6) ─────────────────────
  { name: "hostile: the shared-config.json label payload exports with no live Scheme", fn: () => {
      const { config, validation } = loadHostileSharedConfig();
      assert(validation.valid, "the payload is text, so the config stays valid: " + validation.errors.join("; "));
      const out = CNBLilypond.generate(config);
      assertNoLiveScheme(out, CNBLilypond.generate(CNBConfigIO.loadFromText(
        JSON.stringify({ version: "1.0", meta: { configName: "Shared System", fileSuffix: "-Shared", notationLabel: "Innocent" } })).config),
        "INJECTED-VIA-NOTATION-LABEL");
    }},

  { name: "hostile: every field payload is rejected by validation and export alike, or exports inert", fn: () => {
      const base = hostileBaseConfig();
      deepEqArr(CNBConfig.validate(base).errors, [], "base config is valid");
      const baseOut = CNBLilypond.generate(base);
      for (const p of hostilePayloads()) {
        const config = applyPayload(base, p);
        const { errors } = CNBConfig.validate(config);
        let exported = null, threw = null;
        try { exported = CNBLilypond.generate(config); } catch (err) { threw = err; }
        if (p.expect === "rejected") {
          assert(errors.length > 0, `${p.field}: validation must reject`);
          assert(threw !== null, `${p.field}: generate() must throw`);
          // The emitters refuse it on their own too, not only through validate().
          let emitterThrew = false;
          try {
            CNBLilypond.header(config); CNBLilypond.sectionA(config);
            CNBLilypond.sectionB(config); CNBLilypond.sectionC(config);
          } catch (_) { emitterThrew = true; }
          assert(emitterThrew, `${p.field}: an emitter must refuse the value`);
        } else {
          assert(errors.length === 0, `${p.field}: validation must accept: ${errors.join("; ")}`);
          assert(threw === null, `${p.field}: generate() must not throw: ${threw && threw.message}`);
          // The payload reached the output (a shape name only as its slug).
          contains(exported.toLowerCase(), p.marker.toLowerCase(), `${p.field}: the payload text is carried (inert)`);
          assertNoLiveScheme(exported, baseOut, p.marker, p.field);
        }
      }
    }},

  { name: "size (engine): the default config engraves noteheads 0.5–3 staff spaces wide and tall", fn: async () => {
      // Audit H3: the fallback once emitted raw SVG units, so one notehead
      // filled the page. Measured from a real engine render.
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const { noteheads, error } = await measureNoteheads(engine, CNBLilypond.generate(CNBConfig.createDefault()));
      assert(!error, `the default export must compile and engrave: ${error}`);
      eq(noteheads.length, 12, "one notehead per pitch class");
      for (const { pc, width, height } of noteheads) {
        assert(width >= 0.5 && width <= 3, `pc ${pc}: width ${width} staff spaces is outside 0.5–3`);
        assert(height >= 0.5 && height <= 3, `pc ${pc}: height ${height} staff spaces is outside 0.5–3`);
      }
    }},

  { name: "hostile (engine): LilyPond never prints a payload from an accepted export", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const exports = [{ marker: "INJECTED-VIA-NOTATION-LABEL", ly: CNBLilypond.generate(loadHostileSharedConfig().config) }];
      for (const p of hostilePayloads()) {
        if (p.expect !== "exported") continue;
        exports.push({ marker: p.marker, ly: CNBLilypond.generate(applyPayload(hostileBaseConfig(), p)) });
      }
      const dir = mkdtempSync(path.join(os.tmpdir(), "cnb-hostile-"));
      try {
        const runs = exports.map(({ marker, ly }, i) => new Promise((resolve) => {
          const sub = path.join(dir, String(i));
          mkdirSync(sub);
          writeFileSync(path.join(sub, "config.ly"), ly, "utf8");
          writeFileSync(path.join(sub, "score.ly"),
            '\\version "2.24.2"\n\\include "config.ly"\n{ c\'4 cis\'4 d\'4 e\'4 }\n', "utf8");
          execFile(engine.lilypond, ["-I", engine.dir, "-o", path.join(sub, "out"), "score.ly"],
            { cwd: sub, timeout: 120000, windowsHide: true },
            (error, stdout, stderr) => resolve({ marker, error, output: `${stdout}\n${stderr}` }));
        }));
        for (const { marker, error, output } of await Promise.all(runs)) {
          assert(!output.includes(marker), `${marker}: LilyPond printed the payload:\n${output}`);
          assert(!error, `${marker}: the export must compile (so the payload was really read): ${error && error.message}\n${output}`);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }},

  { name: "round trip (engine): joy-to-the-world-45deg.ly engraves through the engine at 1.2.0 or later", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      // Stem anchors inside the head need engine 1.2.0 (its session 17).
      const version = JSON.parse(readFileSync(path.join(engine.dir, "version.json"), "utf8")).version;
      const [major, minor] = version.split(".").map(Number);
      assert(major > 1 || (major === 1 && minor >= 2), `the engine at ${engine.dir} is ${version}; 1.2.0 or later is needed`);
      const fixtures = path.join(CNB_DIR, "fixtures");
      const dir = mkdtempSync(path.join(os.tmpdir(), "cnb-45deg-"));
      try {
        const { error, output } = await new Promise((resolve) => {
          execFile(engine.lilypond, ["-I", engine.dir, "-I", fixtures, "-o", path.join(dir, "out"),
            path.join(fixtures, "joy-to-the-world-45deg.ly")],
            { cwd: dir, timeout: 120000, windowsHide: true },
            (error, stdout, stderr) => resolve({ error, output: `${stdout}\n${stderr}` }));
        });
        assert(!error, `lilypond must exit 0: ${error && error.message}\n${output}`);
        assert(!/error:/.test(output), `lilypond printed an error:\n${output}`);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }},

];

// ── Hostile-input helpers (session 10) ───────────────────────────────────────

const HOSTILE_DIR = path.join(CNB_DIR, "fixtures", "hostile");

function deepEqArr(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function loadHostileSharedConfig() {
  return CNBConfigIO.loadFromText(readFileSync(path.join(HOSTILE_DIR, "shared-config.json"), "utf8"));
}

function hostilePayloads() {
  return JSON.parse(readFileSync(path.join(HOSTILE_DIR, "field-payloads.json"), "utf8"));
}

/**
 * The config every field payload is applied to: the default plus a palette
 * colour (so A5 emits schemeSymbols), a footnote (so B3 emits its
 * conditional footnote line), and a minim-only rule (so Section C emits
 * duration-aware clauses whose comments carry duration names).
 */
function hostileBaseConfig() {
  const config = paletteConfig();
  config.meta.notationFootnote = "Base footnote";
  config.noteheadRules.push({
    name: "Minim C hollow", priority: 5,
    match: { pitchClasses: [0], durations: ["minim"], keys: "all" },
    apply: { hollow: true },
  });
  return config;
}

/** A clone of config with one payload applied (a field write or a shape rename). */
function applyPayload(config, p) {
  const out = CNBConfig.clone(config);
  if (p.renameShape) {
    out.shapes[p.value] = out.shapes[p.renameShape];
    delete out.shapes[p.renameShape];
    for (const rule of out.noteheadRules) {
      if (rule.apply && rule.apply.shape === p.renameShape) rule.apply.shape = p.value;
    }
    return out;
  }
  let target = out;
  for (const key of p.path.slice(0, -1)) target = target[key];
  target[p.path[p.path.length - 1]] = p.value;
  return out;
}

/**
 * The .ly with its comments (%… and ;… to end of line) and string literals
 * removed — what LilyPond and Guile actually read as code.
 */
function liveCode(ly) {
  let code = "";
  for (let i = 0; i < ly.length; i++) {
    const ch = ly[i];
    if (ch === '"') {
      for (i++; i < ly.length && ly[i] !== '"'; i++) if (ly[i] === "\\") i++;
      code += '""';
    } else if (ch === "%" || ch === ";") {
      while (i < ly.length && ly[i] !== "\n") i++;
      code += "\n";
    } else {
      code += ch;
    }
  }
  return code;
}

/**
 * An accepted payload adds no #( or $( to the live code beyond the
 * exporter's own template (the same config without the payload), and its
 * marker appears only inside comments or string literals.
 */
function assertNoLiveScheme(out, baseOut, marker, label = marker) {
  const count = (text) => (liveCode(text).match(/[#$]\(/g) || []).length;
  eq(count(out), count(baseOut), `${label}: #( / $( count in live code`);
  lacks(liveCode(out), marker, `${label}: the marker must not reach live code`);
}

// ── Pitch-axis test helper (set 014) ─────────────────────────────────────────

/**
 * The v1.3 §5.4b worked-check configuration (the 013 session-1 spike):
 * Twinline-like map, stride 7, 2 axis units per staff space, staff pattern
 * [2, 5, 8], midpoint 7.
 */
function spikeAxisConfig() {
  const config = CNBConfig.createDefault();
  config.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
  };
  config.staff.semitonePattern = [2, 5, 8];
  config.staff.midpoint = 7;
  return config;
}
