/**
 * cnb-lilypond-tests.js — Unit tests for Module 11 (LilyPond Exporter)
 *
 * Session 1 coverage: header, Section A (named definitions), Section B
 * (engine settings), and the svgPathToLilypond / toSchemeSymbol /
 * computeStaffLinePositions helpers.
 *
 * Session 2 coverage: Section C (configuration procedure — memv grouping,
 * duration-aware compound conditions, repeat field), generate() (order +
 * export validation), and Section C parity against the legacy exporter.
 */

import { createRequire } from "module";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond, _internals, PITCH_AXIS_GATE_MESSAGE } from "../src/cnb-lilypond.js";

const require = createRequire(import.meta.url);
const Legacy = require("../../legacy/configurator-core.js");

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
    const field = line.match(/\((shape|color|hollow|attachment)\s+\.\s+([^)\s]+)\)/);
    if (field && pcs) {
      for (const pc of pcs) {
        if (!map[pc]) map[pc] = { condition };
        map[pc][field[1]] = field[2];
      }
    }
  }
  return map;
}

/**
 * Legacy app state equivalent to the new default 4-8 config.
 * Legacy models anchors as 2-point stemUp/stemDown + overlapPercent;
 * 100% overlap reproduces the default shape's minim==crotchet anchors,
 * so the derived 4-point attachment set is identical to the new module's.
 */
function legacyDefaultApp() {
  const cfg = CNBConfig.createDefault();
  const shape = cfg.shapes["crotchet-minim"];
  const app = Legacy.createDefaultApp();
  app.meta.name = cfg.meta.configName;
  app.meta.label = cfg.meta.notationLabel;
  app.meta.suffix = cfg.meta.fileSuffix;
  app.defs = {
    "crotchet-minim": {
      path: shape.svgPath,
      hollowPath: shape.svgHollowPath,
      anchors: { stemUp: shape.anchors.crotchetUp, stemDown: shape.anchors.crotchetDown },
      overlapPercent: 100,
      naturalHeight: shape.naturalHeight,
      naturalWidth: shape.naturalWidth,
      semitoneHeight: shape.semitoneHeight,
    },
  };
  app.noteheadRules = [
    { ruleType: "shape", pitchClasses: "all", shape: "crotchet-minim" },
    { ruleType: "hollow", pitchClasses: [1, 3, 6, 8, 10], hollow: true },
  ];
  app.staffRules = [{ type: "staff", pitchClasses: [4, 8] }];
  return app;
}

/** Split a full .ly text into { header, a, b, c } on the section banners. */
function splitSections(text) {
  const iA = text.indexOf("SECTION A");
  const iB = text.indexOf("SECTION B");
  const iC = text.indexOf("SECTION C");
  assert(iA >= 0 && iB > iA && iC > iB, "file has sections A, B, C in order");
  return {
    header: text.slice(0, iA),
    a: text.slice(iA, iB),
    b: text.slice(iB, iC),
    c: text.slice(iC),
  };
}

/** Semantic lines: comments and blanks dropped, whitespace runs collapsed. */
function semanticLines(section) {
  return section.split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("%%") && !l.startsWith(";;"))
    .map(l => l.replace(/\s+/g, " "));
}

/** Parse single-line `#(set! cnb:name value)` settings into a map. */
function parseSettings(section) {
  const map = {};
  for (const line of section.split("\n")) {
    const m = line.match(/^#\(set! (cnb:[a-z-]+) (.+)\)\s*$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

export const tests = [

  // ── svgPathToLilypond ──────────────────────────────────────────────────────

  { name: "svgPathToLilypond converts M/L/C/Z", fn: () => {
      const out = CNBLilypond.svgPathToLilypond("M 0 1 L 2 3 C 4 5 6 7 8 9 Z");
      eq(out, "'(\n    (moveto 0 1)\n    (lineto 2 3)\n    (curveto 4 5 6 7 8 9)\n    (closepath))");
    }},

  { name: "svgPathToLilypond folds H/V into lineto with tracked position", fn: () => {
      const out = CNBLilypond.svgPathToLilypond("M 0 0 H 5 V 6 Z");
      contains(out, "(lineto 5 0)");
      contains(out, "(lineto 5 6)");
    }},

  { name: "svgPathToLilypond rounds to 4 decimals by default", fn: () => {
      const out = CNBLilypond.svgPathToLilypond("M 0.123456 1.999999");
      contains(out, "(moveto 0.1235 2)");
    }},

  { name: "svgPathToLilypond honors explicit precision", fn: () => {
      const out = CNBLilypond.svgPathToLilypond("M 0.123456 1", 2);
      contains(out, "(moveto 0.12 1)");
    }},

  { name: "svgPathToLilypond normalizes -0 to 0", fn: () => {
      const out = CNBLilypond.svgPathToLilypond("M -0.00001 -0.00001");
      contains(out, "(moveto 0 0)");
    }},

  { name: "svgPathToLilypond returns '() for empty/invalid input", fn: () => {
      eq(CNBLilypond.svgPathToLilypond(""), "'()");
      eq(CNBLilypond.svgPathToLilypond(null), "'()");
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
      contains(out, "%% Color palette: None (standard)");
      contains(out, "cnb:use-accessible-colors");
    }},

  { name: "header version comes from engine.lilypondVersion", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.lilypondVersion = "2.25.0";
      contains(CNBLilypond.header(cfg), '\\version "2.25.0"');
    }},

  // ── Section A: paths ───────────────────────────────────────────────────────

  { name: "sectionA falls back to SVG path conversion when lilypondPath is null", fn: () => {
      const out = CNBLilypond.sectionA(CNBConfig.createDefault());
      contains(out, "#(define cnb:crotchet-minim-path '(");
      contains(out, "(moveto 163.578 -81.573)");
    }},

  { name: "sectionA prefers pre-baked lilypondPath verbatim", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].lilypondPath = "'((moveto 0.8 0) (closepath))";
      cfg.shapes["crotchet-minim"].lilypondHollowPath = "'((moveto 0.5 0) (closepath))";
      const out = CNBLilypond.sectionA(cfg);
      contains(out, "#(define cnb:crotchet-minim-path '((moveto 0.8 0) (closepath)))");
      contains(out, "#(define cnb:crotchet-minim-cutout-path '((moveto 0.5 0) (closepath)))");
      lacks(out, "curveto", "pre-baked paths should suppress fallback conversion");
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
      cfg.engine.stemThickness = 1.5;
      const out = CNBLilypond.sectionB(cfg);
      contains(out, "#(set! cnb:false-hollow #t)");
      contains(out, "#(set! cnb:multinote-padding -1)");
      contains(out, "#(set! cnb:default-magnify 3/2)");
      contains(out, "#(set! cnb:indent 5)");
      contains(out, "#(set! cnb:collision-threshold 3)");
      contains(out, "#(set! cnb:stem-thickness 1.5)");
    }},

  { name: "sectionB converts changed staff-line thickness: 40% at sps 4 → 0.1", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.lineDefaults.thicknessPct = 40;
      const out = CNBLilypond.sectionB(cfg);
      contains(out, "#(set! cnb:default-staff-line-thickness 0.1)");
    }},

  { name: "sectionB emits changed staff-line color", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.lineDefaults.color = "#333333";
      const out = CNBLilypond.sectionB(cfg);
      contains(out, `#(set! cnb:default-staff-line-color "#333333")`);
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

  // ── Legacy parity ──────────────────────────────────────────────────────────

  { name: "parity: sectionC is semantically equivalent to the legacy exporter for the default 4-8 config", fn: () => {
      const legacyOut = Legacy.generateSectionC(legacyDefaultApp());
      const newOut = CNBLilypond.sectionC(CNBConfig.createDefault());

      const legacyClauses = parseSectionCClauses(legacyOut);
      const newClauses = parseSectionCClauses(newOut);

      for (let pc = 0; pc < 12; pc++) {
        assert(legacyClauses[pc], `legacy covers pc ${pc}`);
        assert(newClauses[pc], `new exporter covers pc ${pc}`);
        eq(newClauses[pc].shape, legacyClauses[pc].shape, `pc ${pc} shape parity`);
        eq(newClauses[pc].color, legacyClauses[pc].color, `pc ${pc} color parity`);
        eq(newClauses[pc].hollow, legacyClauses[pc].hollow, `pc ${pc} hollow parity`);
        eq(newClauses[pc].attachment, legacyClauses[pc].attachment, `pc ${pc} attachment parity`);
        // Same grouping: identical configs merge into the same memv clause
        eq(newClauses[pc].condition, legacyClauses[pc].condition, `pc ${pc} condition parity`);
      }
    }},

  { name: "parity: pc-condition helper matches legacy buildPitchClassCondition", fn: () => {
      eq(_internals.pcCondition([5], "pc"), Legacy.buildPitchClassCondition([5], "pc"));
      eq(_internals.pcCondition([0, 4, 8], "pc"), Legacy.buildPitchClassCondition([0, 4, 8], "pc"));
      eq(_internals.pcCondition([], "pc"), Legacy.buildPitchClassCondition([], "pc"));
    }},

  { name: "parity: generate() vs legacy generateLy(), section by section, for the default 4-8 config", fn: () => {
      const newFile = CNBLilypond.generate(CNBConfig.createDefault());
      const legacyFile = Legacy.generateLy(legacyDefaultApp());

      const n = splitSections(newFile);
      const l = splitSections(legacyFile);

      // Header: same structural invariants
      for (const needle of ['\\version "2.24.2"', '\\include "ChromaticNotationBase.ly"',
                            "Generated by Chromatic Configurator", "DO NOT EDIT BY HAND"]) {
        contains(n.header, needle, "new header");
        contains(l.header, needle, "legacy header");
      }

      // Section A: semantically identical line for line (comments/whitespace
      // aside) — same path definitions, registrations, cutouts, and color
      // registrations — EXCEPT the attachment point values: legacy converts
      // SVG anchors to semitone units only (frozen pre-catalog behavior),
      // while the new exporter converts on to staff-space units at export
      // time (007-s1 D5 fix: ÷ semitonesPerStaffSpace — 1.5729 semitones →
      // 0.3932 staff-spaces at the default sps 4). Both pinned below.
      const isAttachValue = (line) => line.startsWith("(cons '");
      eq(JSON.stringify(semanticLines(n.a).filter(x => !isAttachValue(x))),
         JSON.stringify(semanticLines(l.a).filter(x => !isAttachValue(x))),
        "Section A semantic lines (attachment values pinned separately)");
      contains(n.a, "(cons 'crotchet-up   '(0.3932 . 0.1075))", "new: staff-space units (D5 fix)");
      contains(n.a, "(cons 'minim-down    '(-0.3932 . -0.1075))", "new: staff-space units (D5 fix)");
      contains(l.a, "(cons 'crotchet-up   '(1.5729 . 0.43))", "legacy: semitone units (frozen)");
      contains(l.a, "(cons 'minim-down    '(-1.5729 . -0.43))", "legacy: semitone units (frozen)");

      // Section B: same settings, with two documented divergences pinned:
      //  - staff-line-positions: legacy's deriveStaffLinePositions is a V1
      //    fixed symmetric placement (always ±2 ±4 ±6 half-spaces) that
      //    ignores the actual pattern; the new exporter implements the
      //    midpoint formula in half-staff-space units, 2 × (S − midpoint) /
      //    sps (LY spec §5.1; the ×2 is the 007-s1 D2 fix). Worked example:
      //    4-8 system, midpoint 12, sps 4 → (-4 -2 2 4).
      //  - use-procedure-model: the new exporter always emits it (007-s1 D1
      //    fix — the engine defaults to the vector model and silently
      //    ignores Sections A/C without it); legacy, frozen pre-catalog,
      //    never emitted it.
      const nSet = parseSettings(n.b);
      const lSet = parseSettings(l.b);
      eq(nSet["cnb:semitones-per-staff-space"], lSet["cnb:semitones-per-staff-space"], "sps parity");
      eq(nSet["cnb:file-suffix"], lSet["cnb:file-suffix"], "file-suffix parity");
      eq(nSet["cnb:notation-label"], lSet["cnb:notation-label"], "notation-label parity");
      eq(Object.keys(nSet).length, 5, "new Section B emits the always-emitted settings incl. use-procedure-model");
      eq(Object.keys(lSet).length, 4, "legacy Section B emits only its four always-emitted settings");
      eq(nSet["cnb:use-procedure-model"], "#t", "new: D1 fix — procedure model always on");
      eq(lSet["cnb:use-procedure-model"], undefined, "legacy: predates the D1 catalog entry");
      eq(nSet["cnb:staff-line-positions"], "'(-4 -2 2 4)", "new: half-staff-space conversion (D2)");
      eq(lSet["cnb:staff-line-positions"], "'(-6 -4 -2 2 4 6)", "legacy: V1 symmetric placeholder");

      // Section C: full semantic equivalence, from the end-to-end outputs
      const nClauses = parseSectionCClauses(n.c);
      const lClauses = parseSectionCClauses(l.c);
      for (let pc = 0; pc < 12; pc++) {
        eq(nClauses[pc].shape, lClauses[pc].shape, `pc ${pc} shape parity`);
        eq(nClauses[pc].color, lClauses[pc].color, `pc ${pc} color parity`);
        eq(nClauses[pc].hollow, lClauses[pc].hollow, `pc ${pc} hollow parity`);
        eq(nClauses[pc].attachment, lClauses[pc].attachment, `pc ${pc} attachment parity`);
        eq(nClauses[pc].condition, lClauses[pc].condition, `pc ${pc} condition parity`);
      }
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

  // ── Pitch axis (set 014): the §8a fail-loud interim gate ─────────────────

  { name: "fail-loud gate (§8a): generate() throws on a pitchAxis-enabled config, naming the missing engine capability", fn: () => {
      const enabled = pitchAxisEnabledConfig();
      assert(CNBConfig.validate(enabled).valid, "the compact config itself is VALID — the gate is an engine-capability block, not a validation failure");
      let threw = null;
      try { CNBLilypond.generate(enabled); } catch (err) { threw = err; }
      assert(threw !== null, "generate() must throw (binding rule 3: no silent linear .ly for a compact config, ever)");
      eq(threw.message, PITCH_AXIS_GATE_MESSAGE, "the exact §8a gate message");
      contains(threw.message, "E13-1", "names the missing hook work item");
      contains(threw.message, "E13-2", "names the missing x-offset work item");
      contains(threw.message, "cnb:get-pitch-staff-position", "names the engine hook");
      contains(threw.message, "§8a", "cites the spec rule");
    }},

  { name: "fail-loud gate (§8a): the gate fires on the enabled flag alone, even when the section is otherwise malformed", fn: () => {
      const config = CNBConfig.createDefault();
      config.pitchAxis = { enabled: true };   // no kind/map/stride — still blocked
      let threw = null;
      try { CNBLilypond.generate(config); } catch (err) { threw = err; }
      assert(threw !== null, "throws");
      eq(threw.message, PITCH_AXIS_GATE_MESSAGE, "the gate message, not a generic validation error");
    }},

  { name: "fail-loud gate (§8a): a disabled pitchAxis section does not trip the gate and exports byte-identically to the default", fn: () => {
      const disabled = pitchAxisEnabledConfig();
      disabled.pitchAxis.enabled = false;
      const disabledLy = CNBLilypond.generate(disabled);   // must not throw
      const defaultLy = CNBLilypond.generate(CNBConfig.createDefault());
      eq(disabledLy, defaultLy, "disabled pitchAxis section is invisible to the exporter");
      lacks(disabledLy, "pitch-axis", "no pitch-axis token in the export");
      lacks(disabledLy, "pitchAxis", "no pitchAxis token in the export");
    }},

];

// ── Pitch-axis gate test helper (set 014) ────────────────────────────────────

/** Default config with the design §1.1 Twinline-like pitch axis enabled. */
function pitchAxisEnabledConfig() {
  const config = CNBConfig.createDefault();
  config.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
  };
  return config;
}
