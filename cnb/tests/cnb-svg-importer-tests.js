/**
 * cnb-svg-importer-tests.js — Unit tests for Module 16 (SVG Shape Importer)
 *
 * Exercises the pure parsing/extraction logic against stub documents shaped
 * like Music Glyph Toolkit output (the current contract: stem placemarker
 * rects, data-semitone-height, opt-in data-lilypond-* attributes).
 * File-picker/DOMParser wiring is exercised on the visual test page.
 */

import { CNBSvgImporter } from "../ui/svg-importer.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function approx(a, b, msg, epsilon = 1e-6) {
  if (Math.abs(a - b) > epsilon)
    throw new Error(`${msg || "approx"}: expected ~${b}, got ${a}`);
}

function assertSame(a, b, msg) {
  if (a.x !== b.x || a.y !== b.y)
    throw new Error(`${msg}: expected (${b.x}, ${b.y}), got (${a.x}, ${a.y})`);
}

// ─── Stub document helpers (mirror DOM getAttribute/tagName contract) ────────

function stubEl(tagName, attrs = {}) {
  return {
    tagName,
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
  };
}

function stubDoc(rootAttrs, elementsById = {}) {
  return {
    documentElement: stubEl("svg", rootAttrs),
    getElementById(id) { return elementsById[id] || null; },
  };
}

// A document shaped like real toolkit output: 2-semitone ellipse notehead
// (from tests/notehead_for_export.svg in the toolkit repo) after processing —
// centered viewBox, stem placemarker rects, pre-baked LilyPond data.
const ELLIPSE_D = "M 120 0 C 120 -55 66 -100 0 -100 C -66 -100 -120 -55 -120 0 C -120 55 -66 100 0 100 C 66 100 120 55 120 0 Z";
const HOLLOW_D = "M 80 0 C 80 -36 44 -64 0 -64 C -44 -64 -80 -36 -80 0 C -80 36 -44 64 0 64 C 44 64 80 36 80 0 Z";
const LY_NOTEHEAD = "'(\n    (moveto 1.2 0)\n    (curveto 1.2 0.55 0.66 1.0 0 1.0)\n    (closepath))";
const LY_HOLLOW = "'(\n    (moveto 0.8 0)\n    (curveto 0.8 0.36 0.44 0.64 0 0.64)\n    (closepath))";

function toolkitDoc(overrides = {}) {
  const els = {
    notehead: stubEl("path", {
      id: "notehead",
      d: ELLIPSE_D,
      "data-semitone-height": "2.0",
      "data-lilypond-notehead": LY_NOTEHEAD,
    }),
    hollow: stubEl("path", {
      id: "hollow",
      d: HOLLOW_D,
      "data-lilypond-hollow": LY_HOLLOW,
    }),
    // Toolkit stem placemarkers: w_stem = max(200/9, 20) = 22.2222,
    // STEM_HEIGHT = 350, attached at the ellipse's widest points (±120, 0).
    "stem-up": stubEl("rect", {
      id: "stem-up", x: "97.7778", y: "-350", width: "22.2222", height: "350",
    }),
    "stem-down": stubEl("rect", {
      id: "stem-down", x: "-120", y: "0", width: "22.2222", height: "350",
    }),
    ...overrides,
  };
  for (const key of Object.keys(overrides)) {
    if (overrides[key] === null) delete els[key];
  }
  return stubDoc({ viewBox: "-120 -100 240 200", width: "240", height: "200" }, els);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // — name helpers —
  { name: "shapeNameFromFilename strips path and extension", fn: () => {
      assert(CNBSvgImporter.shapeNameFromFilename("kite-up.svg") === "kite-up", "basic");
      assert(CNBSvgImporter.shapeNameFromFilename("C:\\shapes\\oval.svg") === "oval", "win path");
      assert(CNBSvgImporter.shapeNameFromFilename("a/b/round.notehead.svg") === "round.notehead", "posix path, last ext only");
      assert(CNBSvgImporter.shapeNameFromFilename("") === "shape", "empty fallback");
      assert(CNBSvgImporter.shapeNameFromFilename(".svg") === "shape", "extension-only fallback");
    }},
  { name: "displayNameFromShapeName title-cases kebab names", fn: () => {
      assert(CNBSvgImporter.displayNameFromShapeName("crotchet-minim") === "Crotchet Minim", "kebab");
      assert(CNBSvgImporter.displayNameFromShapeName("kite_up") === "Kite Up", "snake");
      assert(CNBSvgImporter.displayNameFromShapeName("oval") === "Oval", "single word");
    }},

  // — viewBox / rect parsing —
  { name: "parseViewBox handles space and comma separators", fn: () => {
      const a = CNBSvgImporter.parseViewBox("-120 -100 240 200");
      assert(a.minX === -120 && a.minY === -100 && a.width === 240 && a.height === 200, "space-separated");
      const b = CNBSvgImporter.parseViewBox("-1,-2, 3,4");
      assert(b.width === 3 && b.height === 4, "comma-separated");
    }},
  { name: "parseViewBox rejects missing or malformed values", fn: () => {
      assert(CNBSvgImporter.parseViewBox(null) === null, "null");
      assert(CNBSvgImporter.parseViewBox("") === null, "empty");
      assert(CNBSvgImporter.parseViewBox("0 0 100") === null, "too few parts");
      assert(CNBSvgImporter.parseViewBox("a b c d") === null, "non-numeric");
    }},
  { name: "parseRectAttrs converts strings, defaults invalid to 0", fn: () => {
      const r = CNBSvgImporter.parseRectAttrs({ x: "97.7778", y: "-350", width: "22.2222", height: "350" });
      approx(r.x, 97.7778, "x"); approx(r.y, -350, "y");
      approx(r.width, 22.2222, "width"); approx(r.height, 350, "height");
      const z = CNBSvgImporter.parseRectAttrs({ x: null, y: undefined, width: "abc", height: "" });
      assert(z.x === 0 && z.y === 0 && z.width === 0 && z.height === 0, "invalid → 0");
    }},

  // — anchor derivation from stem placemarker rects —
  { name: "anchorsFromStemRects: up = bottom-center of stem-up rect, down = top-center of stem-down rect", fn: () => {
      const a = CNBSvgImporter.anchorsFromStemRects(
        { x: 97.7778, y: -350, width: 22.2222, height: 350 },
        { x: -120, y: 0, width: 22.2222, height: 350 });
      approx(a.crotchetUp.x, 108.8889, "up.x = rect.x + width/2");
      approx(a.crotchetUp.y, 0, "up.y = rect bottom edge");
      approx(a.crotchetDown.x, -108.8889, "down.x = rect.x + width/2");
      approx(a.crotchetDown.y, 0, "down.y = rect top edge");
    }},
  { name: "anchorsFromStemRects reproduces the default config's crotchet-minim anchors", fn: () => {
      // Reverse-engineered rects for the default shape (naturalWidth 344.852,
      // w_stem = 272.4/9 ≈ 30.2667): bottom-center/top-center must land on
      // the anchor values in CNBConfig.createDefault().
      const def = CNBConfig.createDefault().shapes["crotchet-minim"].anchors;
      const w = 30.2667;
      const a = CNBSvgImporter.anchorsFromStemRects(
        { x: def.crotchetUp.x - w / 2, y: def.crotchetUp.y - 350, width: w, height: 350 },
        { x: def.crotchetDown.x - w / 2, y: def.crotchetDown.y, width: w, height: 350 });
      approx(a.crotchetUp.x, def.crotchetUp.x, "up.x", 1e-4);
      approx(a.crotchetUp.y, def.crotchetUp.y, "up.y", 1e-4);
      approx(a.crotchetDown.x, def.crotchetDown.x, "down.x", 1e-4);
      approx(a.crotchetDown.y, def.crotchetDown.y, "down.y", 1e-4);
    }},
  { name: "anchorsFromStemRects: 4-point model duplicates the toolkit's single up/down pair", fn: () => {
      const a = CNBSvgImporter.anchorsFromStemRects(
        { x: 10, y: -100, width: 20, height: 100 },
        { x: -30, y: 5, width: 20, height: 100 });
      assert(a.minimUp.x === a.crotchetUp.x && a.minimUp.y === a.crotchetUp.y, "minimUp == crotchetUp");
      assert(a.minimDown.x === a.crotchetDown.x && a.minimDown.y === a.crotchetDown.y, "minimDown == crotchetDown");
      assert(a.minimUp !== a.crotchetUp, "distinct objects, not shared references");
    }},
  { name: "anchorsFromStemRects: no rects → null (stemless), one rect → other defaults to origin", fn: () => {
      assert(CNBSvgImporter.anchorsFromStemRects(null, null) === null, "both missing → null");
      const upOnly = CNBSvgImporter.anchorsFromStemRects({ x: 10, y: -100, width: 20, height: 100 }, null);
      approx(upOnly.crotchetUp.x, 20, "up present");
      assert(upOnly.crotchetDown.x === 0 && upOnly.crotchetDown.y === 0, "missing down → (0,0)");
    }},

  // — LilyPond anchor conversion —
  { name: "toLilypondAnchors divides by SVG-units-per-semitone and inverts Y", fn: () => {
      const anchors = CNBSvgImporter.anchorsFromStemRects(
        { x: 97.7778, y: -350, width: 22.2222, height: 350 },
        { x: -120, y: 0, width: 22.2222, height: 350 });
      const ly = CNBSvgImporter.toLilypondAnchors(anchors, 200, 2.0);
      approx(ly.crotchetUp.x, 1.0889, "up.x ÷ 100", 1e-4);
      approx(ly.crotchetUp.y, 0, "up.y inverted", 1e-4);
      approx(ly.crotchetDown.x, -1.0889, "down.x ÷ 100", 1e-4);
    }},
  { name: "toLilypondAnchors inverts a nonzero Y (SVG Y-down → LilyPond Y-up)", fn: () => {
      const anchors = {
        crotchetUp: { x: 157.2926, y: -42.9985 }, crotchetDown: { x: -157.2934, y: 43.0027 },
        minimUp: { x: 157.2926, y: -42.9985 }, minimDown: { x: -157.2934, y: 43.0027 },
      };
      const ly = CNBSvgImporter.toLilypondAnchors(anchors, 272.4, 2.724);
      approx(ly.crotchetUp.y, 0.43, "up.y", 1e-4);
      approx(ly.crotchetDown.y, -0.43, "down.y", 1e-4);
    }},
  { name: "toLilypondAnchors returns null for stemless or unmeasurable shapes", fn: () => {
      assert(CNBSvgImporter.toLilypondAnchors(null, 200, 2) === null, "null anchors");
      const a = { crotchetUp: { x: 1, y: 1 }, crotchetDown: { x: 1, y: 1 }, minimUp: { x: 1, y: 1 }, minimDown: { x: 1, y: 1 } };
      assert(CNBSvgImporter.toLilypondAnchors(a, 0, 2) === null, "no naturalHeight");
      assert(CNBSvgImporter.toLilypondAnchors(a, 200, null) === null, "no semitoneHeight");
    }},
  { name: "import-time lilypondAnchors match the exporter's fallback conversion (Section A parity)", fn: () => {
      // Section A4 output must be identical whether the anchors are converted
      // at import time (lilypondAnchors) or at export time (fallback from
      // anchors) — same formula, same result.
      const cfgFallback = CNBConfig.createDefault();
      const cfgPrebaked = CNBConfig.createDefault();
      const shape = cfgPrebaked.shapes["crotchet-minim"];
      shape.lilypondAnchors = CNBSvgImporter.toLilypondAnchors(
        shape.anchors, shape.naturalHeight, shape.semitoneHeight);
      assert(CNBLilypond.sectionA(cfgPrebaked) === CNBLilypond.sectionA(cfgFallback),
        "Section A differs between import-time and export-time anchor conversion");
    }},

  // — extract() against toolkit-shaped documents —
  { name: "extract reads all fields from a toolkit-shaped document", fn: () => {
      const e = CNBSvgImporter.extract(toolkitDoc());
      assert(e.error === null, "no error");
      assert(e.svgPath === ELLIPSE_D, "svgPath");
      assert(e.svgHollowPath === HOLLOW_D, "svgHollowPath");
      assert(e.lilypondNotehead === LY_NOTEHEAD, "data-lilypond-notehead verbatim");
      assert(e.lilypondHollow === LY_HOLLOW, "data-lilypond-hollow verbatim");
      approx(e.semitoneHeight, 2.0, "data-semitone-height");
      approx(e.viewBoxWidth, 240, "viewBox width");
      approx(e.viewBoxHeight, 200, "viewBox height");
      approx(e.stemUpRect.x, 97.7778, "stem-up rect x");
      approx(e.stemDownRect.y, 0, "stem-down rect y");
      assert(e.isFalseHollow === false, "not false-hollow");
    }},
  { name: "extract errors on missing notehead element or empty path", fn: () => {
      assert(/id="notehead"/.test(CNBSvgImporter.extract(toolkitDoc({ notehead: null })).error), "missing notehead");
      const noD = toolkitDoc({ notehead: stubEl("path", { id: "notehead", "data-semitone-height": "2.0" }) });
      assert(/no path data/.test(CNBSvgImporter.extract(noD).error), "notehead without d");
    }},
  { name: "extract tolerates absent hollow, stems, viewBox, and data attributes", fn: () => {
      const doc = stubDoc({}, { notehead: stubEl("path", { id: "notehead", d: "M 0 0 Z" }) });
      const e = CNBSvgImporter.extract(doc);
      assert(e.error === null, "no error");
      assert(e.svgHollowPath === null && e.lilypondHollow === null, "no hollow");
      assert(e.stemUpRect === null && e.stemDownRect === null, "no stems");
      assert(e.semitoneHeight === null, "no semitone height");
      assert(e.viewBoxWidth === null && e.viewBoxHeight === null, "no viewBox");
    }},
  { name: "extract flags non-rect stem elements instead of misreading them", fn: () => {
      const doc = toolkitDoc({
        "stem-up": stubEl("path", { id: "stem-up", d: "M 109 -100 L 109 -200" }),
      });
      const e = CNBSvgImporter.extract(doc);
      assert(e.stemUpRect === null, "path stem not parsed as rect");
      assert(e.stemUpNonRect === true, "non-rect stem flagged");
      assert(e.stemDownRect !== null, "rect stem still parsed");
    }},
  { name: "extract accepts legacy false-hollow id and flags it", fn: () => {
      const doc = toolkitDoc({
        hollow: null,
        "false-hollow": stubEl("path", { id: "false-hollow", d: HOLLOW_D }),
      });
      const e = CNBSvgImporter.extract(doc);
      assert(e.svgHollowPath === HOLLOW_D, "false-hollow path read");
      assert(e.isFalseHollow === true, "flag set");
    }},

  // — buildShape() → Module A schema entry —
  { name: "buildShape produces a complete Module A shape entry from toolkit data", fn: () => {
      const { shape, warnings, error } = CNBSvgImporter.buildShape(
        CNBSvgImporter.extract(toolkitDoc()), "Ellipse Test");
      assert(error === null, "no error");
      assert(warnings.length === 0, "clean toolkit file yields no warnings: " + warnings.join("; "));
      assert(shape.displayName === "Ellipse Test", "displayName");
      assert(shape.svgPath === ELLIPSE_D && shape.svgHollowPath === HOLLOW_D, "paths");
      approx(shape.semitoneHeight, 2.0, "semitoneHeight");
      approx(shape.naturalHeight, 200, "naturalHeight from viewBox");
      approx(shape.naturalWidth, 240, "naturalWidth from viewBox");
      assert(shape.lilypondPath === LY_NOTEHEAD, "lilypondPath verbatim");
      assert(shape.lilypondHollowPath === LY_HOLLOW, "lilypondHollowPath verbatim");
      approx(shape.anchors.crotchetUp.x, 108.8889, "anchor up.x");
      approx(shape.anchors.minimDown.x, -108.8889, "anchor minimDown.x");
      approx(shape.lilypondAnchors.crotchetUp.x, 1.0889, "lilypondAnchors up.x", 1e-4);
      approx(shape.lilypondAnchors.crotchetUp.y, 0, "lilypondAnchors up.y", 1e-4);
    }},
  { name: "buildShape derives semitoneHeight from viewBox when data attribute missing (with warning)", fn: () => {
      const doc = toolkitDoc({
        notehead: stubEl("path", { id: "notehead", d: ELLIPSE_D }),
      });
      const { shape, warnings } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), "X");
      approx(shape.semitoneHeight, 2.0, "200 viewBox units / 100 per semitone");
      assert(warnings.some(w => /data-semitone-height/.test(w)), "warned about derivation");
    }},
  { name: "buildShape errors when size is undeterminable (no data attribute, no viewBox)", fn: () => {
      const doc = stubDoc({}, { notehead: stubEl("path", { id: "notehead", d: "M 0 0 Z" }) });
      const { shape, error } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), "X");
      assert(shape === null, "no shape");
      assert(/Cannot determine shape size/.test(error), "size error");
    }},
  { name: "buildShape imports stemless shapes with null anchors and null lilypondAnchors", fn: () => {
      const doc = toolkitDoc({ "stem-up": null, "stem-down": null });
      const { shape, warnings } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), "Semibreve");
      assert(shape.anchors === null, "anchors null");
      assert(shape.lilypondAnchors === null, "lilypondAnchors null");
      assert(warnings.some(w => /stemless/.test(w)), "stemless warning");
    }},
  { name: "buildShape warns when pre-baked LilyPond data is absent (exporter fallback path)", fn: () => {
      const doc = toolkitDoc({
        notehead: stubEl("path", { id: "notehead", d: ELLIPSE_D, "data-semitone-height": "2.0" }),
        hollow: stubEl("path", { id: "hollow", d: HOLLOW_D }),
      });
      const { shape, warnings } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), "X");
      assert(shape.lilypondPath === null && shape.lilypondHollowPath === null, "nulls trigger export fallback");
      assert(warnings.some(w => /data-lilypond-notehead/.test(w)), "notehead fallback warning");
      assert(warnings.some(w => /data-lilypond-hollow/.test(w)), "hollow fallback warning");
    }},
  { name: "buildShape warns on non-rect stems and single stem rect", fn: () => {
      const pathStem = toolkitDoc({
        "stem-up": stubEl("path", { id: "stem-up", d: "M 0 0 L 0 -100" }),
        "stem-down": null,
      });
      const r1 = CNBSvgImporter.buildShape(CNBSvgImporter.extract(pathStem), "X");
      assert(r1.warnings.some(w => /not <rect>/.test(w)), "non-rect stem warning");
      const oneRect = toolkitDoc({ "stem-down": null });
      const r2 = CNBSvgImporter.buildShape(CNBSvgImporter.extract(oneRect), "X");
      assert(r2.warnings.some(w => /Only one stem placemarker/.test(w)), "single rect warning");
      assert(r2.shape.anchors.crotchetDown.x === 0, "missing down anchor defaulted");
    }},

  // — minim stem placemarker pair (toolkit session 4) —
  { name: "anchorsFromStemRects reads the minim pair with the same rect rule as the regular pair", fn: () => {
      const a = CNBSvgImporter.anchorsFromStemRects(
        { x: 97.7778, y: -350, width: 22.2222, height: 350 },
        { x: -120, y: 0, width: 22.2222, height: 350 },
        { x: 70, y: -380, width: 20, height: 350 },
        { x: -90, y: 25, width: 20, height: 350 });
      approx(a.crotchetUp.x, 108.8889, "crotchet up unchanged");
      approx(a.minimUp.x, 80, "minimUp.x = rect.x + width/2");
      approx(a.minimUp.y, -30, "minimUp.y = rect bottom edge");
      approx(a.minimDown.x, -80, "minimDown.x = rect.x + width/2");
      approx(a.minimDown.y, 25, "minimDown.y = rect top edge");
    }},
  { name: "anchorsFromStemRects: a half minim pair falls back to the crotchet anchors", fn: () => {
      const a = CNBSvgImporter.anchorsFromStemRects(
        { x: 10, y: -100, width: 20, height: 100 },
        { x: -30, y: 5, width: 20, height: 100 },
        { x: 70, y: -380, width: 20, height: 350 }, null);
      assert(a.minimUp.x === a.crotchetUp.x && a.minimUp.y === a.crotchetUp.y, "minimUp == crotchetUp");
      assert(a.minimDown.x === a.crotchetDown.x && a.minimDown.y === a.crotchetDown.y, "minimDown == crotchetDown");
    }},
  { name: "extract + buildShape: minim pair present → distinct minim anchors and lilypondAnchors", fn: () => {
      const doc = toolkitDoc({
        "stem-minim-up": stubEl("rect", { id: "stem-minim-up", x: "70", y: "-380", width: "20", height: "350" }),
        "stem-minim-down": stubEl("rect", { id: "stem-minim-down", x: "-90", y: "25", width: "20", height: "350" }),
      });
      const e = CNBSvgImporter.extract(doc);
      approx(e.stemMinimUpRect.x, 70, "minim up rect extracted");
      approx(e.stemMinimDownRect.y, 25, "minim down rect extracted");
      const { shape, warnings } = CNBSvgImporter.buildShape(e, "X");
      assert(warnings.length === 0, "clean file with a minim pair yields no warnings: " + warnings.join("; "));
      approx(shape.anchors.minimUp.x, 80, "anchors.minimUp.x");
      approx(shape.anchors.minimDown.y, 25, "anchors.minimDown.y");
      approx(shape.anchors.crotchetUp.x, 108.8889, "crotchet anchors from the regular pair");
      // ÷ 100 SVG units per semitone, Y inverted
      approx(shape.lilypondAnchors.minimUp.x, 0.8, "lilypondAnchors.minimUp.x", 1e-4);
      approx(shape.lilypondAnchors.minimUp.y, 0.3, "lilypondAnchors.minimUp.y inverted", 1e-4);
      approx(shape.lilypondAnchors.minimDown.x, -0.8, "lilypondAnchors.minimDown.x", 1e-4);
      approx(shape.lilypondAnchors.minimDown.y, -0.25, "lilypondAnchors.minimDown.y inverted", 1e-4);
    }},
  { name: "buildShape: minim pair absent → minim anchors copy the crotchet anchors, no warning", fn: () => {
      const { shape, warnings } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(toolkitDoc()), "X");
      assert(!warnings.some(w => /minim/i.test(w)), "no minim warning");
      assertSame(shape.anchors.minimUp, shape.anchors.crotchetUp, "minimUp");
      assertSame(shape.anchors.minimDown, shape.anchors.crotchetDown, "minimDown");
    }},
  { name: "buildShape: half minim pair warns naming the missing rect and falls back", fn: () => {
      const doc = toolkitDoc({
        "stem-minim-up": stubEl("rect", { id: "stem-minim-up", x: "70", y: "-380", width: "20", height: "350" }),
      });
      const { shape, warnings } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), "X");
      assert(warnings.some(w => /minim/.test(w) && /stem-minim-down/.test(w)), "names the missing rect: " + warnings.join("; "));
      assertSame(shape.anchors.minimUp, shape.anchors.crotchetUp, "minimUp falls back");
    }},
  { name: "buildShape: non-rect minim placemarker warns like the regular pair", fn: () => {
      const doc = toolkitDoc({
        "stem-minim-up": stubEl("path", { id: "stem-minim-up", d: "M 0 0 L 0 -100" }),
        "stem-minim-down": stubEl("rect", { id: "stem-minim-down", x: "-90", y: "25", width: "20", height: "350" }),
      });
      const { shape, warnings } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), "X");
      assert(warnings.some(w => /not <rect>/.test(w)), "non-rect warning");
      assertSame(shape.anchors.minimUp, shape.anchors.crotchetUp, "minim anchors fall back");
    }},

  // — imported shape plugs into downstream modules —
  { name: "imported shape works with CNBNotehead.measure (renders at semitoneHeight × pxPerSemi)", fn: () => {
      const { shape } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(toolkitDoc()), "X");
      const m = CNBNotehead.measure(shape, 16);
      approx(m.pixelHeight, 32, "2.0 semitones × 16 px");
      approx(m.pixelWidth, 38.4, "aspect ratio preserved");
    }},
  { name: "imported shape passes Module A validation inside a default config", fn: () => {
      const cfg = CNBConfig.createDefault();
      const { shape } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(toolkitDoc()), "Ellipse");
      cfg.shapes["crotchet-minim"] = shape;
      const result = CNBConfig.validate(cfg);
      assert(result.valid, "config with imported shape validates: " + (result.errors || []).join("; "));
    }},

  // — parseSvgText wrapper (injected parser; DOMParser is browser-side) —
  { name: "parseSvgText names the shape from the filename and builds the entry", fn: () => {
      const parser = { parseFromString: () => Object.assign(toolkitDoc(), { querySelector: () => null }) };
      const r = CNBSvgImporter.parseSvgText("<svg.../>", "shapes/kite-up.svg", { parser });
      assert(r.error === null, "no error");
      assert(r.name === "kite-up", "name from filename");
      assert(r.shape.displayName === "Kite Up", "displayName derived");
      assert(r.shape.svgPath === ELLIPSE_D, "shape built");
    }},
  // — verification round 1 remediations —
  { name: "buildShape reads natural dims from root width/height when viewBox is missing", fn: () => {
      const doc = stubDoc({ width: "240", height: "200" }, {
        notehead: stubEl("path", { id: "notehead", d: ELLIPSE_D, "data-semitone-height": "2.0" }),
      });
      const { shape, warnings, error } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), "X");
      assert(error === null, "no error");
      approx(shape.naturalWidth, 240, "width from root attribute");
      approx(shape.naturalHeight, 200, "height from root attribute");
      assert(warnings.some(w => /root width\/height/.test(w)), "fallback warned");
    }},
  { name: "buildShape errors instead of inventing a square width (no viewBox, no width attr)", fn: () => {
      const doc = stubDoc({}, {
        notehead: stubEl("path", { id: "notehead", d: ELLIPSE_D, "data-semitone-height": "2.0" }),
      });
      const { shape, error } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), "X");
      assert(shape === null, "no shape");
      assert(/Cannot determine shape width/.test(error), "width error: " + error);
    }},
  { name: "anchorsFromStemPoints builds the 4-point model from explicit points", fn: () => {
      const a = CNBSvgImporter.anchorsFromStemPoints({ x: 68.889, y: 0 }, { x: -68.889, y: 0 });
      approx(a.crotchetUp.x, 68.889, "up.x");
      assert(a.minimUp.x === a.crotchetUp.x, "minim duplicates crotchet");
      assert(CNBSvgImporter.anchorsFromStemPoints(null, null) === null, "both missing → null");
      const upOnly = CNBSvgImporter.anchorsFromStemPoints({ x: 5, y: -1 }, null);
      assert(upOnly.crotchetDown.x === 0 && upOnly.crotchetDown.y === 0, "missing down → (0,0)");
    }},
  { name: "extract + buildShape fall back to LY spec §7.1 data-stem-* attributes (no rects)", fn: () => {
      const doc = stubDoc({ viewBox: "-100 -100 200 200" }, {
        notehead: stubEl("path", {
          id: "notehead", d: ELLIPSE_D, "data-semitone-height": "2.0",
          "data-stem-up-x": "68.889", "data-stem-up-y": "0.0",
          "data-stem-down-x": "-68.889", "data-stem-down-y": "0.0",
        }),
      });
      const e = CNBSvgImporter.extract(doc);
      approx(e.stemUpPoint.x, 68.889, "stem-up point extracted");
      const { shape, warnings } = CNBSvgImporter.buildShape(e, "X");
      approx(shape.anchors.crotchetUp.x, 68.889, "anchors from attributes");
      approx(shape.lilypondAnchors.crotchetUp.x, 0.6889, "LY conversion of attribute anchors", 1e-4);
      assert(warnings.some(w => /data-stem-\*/.test(w)), "attribute-contract warning");
      assert(!warnings.some(w => /stemless/.test(w)), "not treated as stemless");
    }},
  { name: "stem placemarker rects take precedence over data-stem-* attributes", fn: () => {
      const doc = toolkitDoc({
        notehead: stubEl("path", {
          id: "notehead", d: ELLIPSE_D, "data-semitone-height": "2.0",
          "data-stem-up-x": "1", "data-stem-up-y": "1",
          "data-stem-down-x": "-1", "data-stem-down-y": "1",
        }),
      });
      const { shape } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), "X");
      approx(shape.anchors.crotchetUp.x, 108.8889, "rect-derived anchor wins");
    }},
  { name: "extract ignores partial or non-numeric data-stem-* attributes", fn: () => {
      const doc = stubDoc({ viewBox: "-100 -100 200 200" }, {
        notehead: stubEl("path", {
          id: "notehead", d: ELLIPSE_D, "data-semitone-height": "2.0",
          "data-stem-up-x": "68.889",             // y missing → pair unusable
          "data-stem-down-x": "abc", "data-stem-down-y": "0",
        }),
      });
      const e = CNBSvgImporter.extract(doc);
      assert(e.stemUpPoint === null, "x-only pair rejected");
      assert(e.stemDownPoint === null, "non-numeric x rejected");
    }},
  { name: "renderImportControl builds the drop zone + hidden file input and parses picked files", fn: async () => {
      // Rich local DOM stub: enough for the control's structure and events.
      const makeEl = (tag) => ({
        tag, children: [], listeners: {}, className: "", textContent: "",
        style: {}, attrs: {},
        classList: {
          add() {}, remove() {},
        },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        appendChild(c) { this.children.push(c); return c; },
        click() {},
      });
      const hadDoc = "document" in globalThis, prevDoc = globalThis.document;
      const hadParser = "DOMParser" in globalThis, prevParser = globalThis.DOMParser;
      globalThis.document = { createElement: makeEl };
      globalThis.DOMParser = class {
        parseFromString() { return Object.assign(toolkitDoc(), { querySelector: () => null }); }
      };
      try {
        const container = makeEl("div");
        const results = [];
        const ctl = CNBSvgImporter.renderImportControl(container, { onResult: r => results.push(r) });
        assert(container.children.length === 2, "zone + input appended");
        assert(ctl.root.className === "cnb-svg-drop-zone", "zone class hook");
        assert(ctl.input.type === "file" && ctl.input.accept === ".svg", "file input configured");
        assert(typeof ctl.root.listeners.click === "function", "click wired");
        assert(typeof ctl.root.listeners.drop === "function", "drop wired");
        // Simulate picking a file through the change handler
        const fakeFile = { name: "kite-up.svg", text: async () => "<svg/>" };
        await ctl.input.listeners.change({ target: { files: [fakeFile], value: "x" } });
        assert(results.length === 1, "onResult called");
        assert(results[0].name === "kite-up", "named from picked file");
        assert(results[0].shape.svgPath === ELLIPSE_D, "shape parsed");
      } finally {
        if (hadDoc) globalThis.document = prevDoc; else delete globalThis.document;
        if (hadParser) globalThis.DOMParser = prevParser; else delete globalThis.DOMParser;
      }
    }},

  // — hostile input (session 6): every failure is a result, never a throw —
  { name: "parseSvgText: a plain SVG that is not toolkit output names the toolkit", fn: () => {
      // e.g. an icon drawn in any editor: an <svg> root and an unnamed <path>
      const plain = Object.assign(
        stubDoc({ viewBox: "0 0 24 24" }, {}),
        { querySelector: (sel) => sel === "path" ? stubEl("path", { d: "M 0 0 L 24 24" }) : null });
      const r = CNBSvgImporter.parseSvgText("<svg>…</svg>", "icon.svg", { parser: { parseFromString: () => plain } });
      assert(r.shape === null, "no shape");
      assert(/id="notehead"/.test(r.error) && /Music Glyph Toolkit/.test(r.error) && /Notehead mode/.test(r.error),
        "error says what to do: " + r.error);
    }},
  { name: "parseSvgText: an SVG without data-lilypond-* imports with both fallback warnings", fn: () => {
      const doc = Object.assign(toolkitDoc({
        notehead: stubEl("path", { id: "notehead", d: ELLIPSE_D, "data-semitone-height": "2.0" }),
        hollow: stubEl("path", { id: "hollow", d: HOLLOW_D }),
      }), { querySelector: () => null });
      const r = CNBSvgImporter.parseSvgText("<svg/>", "oval.svg", { parser: { parseFromString: () => doc } });
      assert(r.error === null, "imports: " + r.error);
      assert(r.shape.lilypondPath === null && r.shape.lilypondHollowPath === null, "export falls back");
      assert(r.warnings.some(w => /data-lilypond-notehead/.test(w)), "notehead warning");
      assert(r.warnings.some(w => /data-lilypond-hollow/.test(w)), "hollow warning");
    }},
  { name: "parseSvgText: non-XML text gives an Invalid SVG error without reaching the parser", fn: () => {
      // Refused before DOMParser: Firefox logs every XML parse failure to
      // the console as an error.
      let parsed = 0;
      const parser = { parseFromString: () => { parsed++; return {}; } };
      const r = CNBSvgImporter.parseSvgText("this is not xml", "notes.svg", { parser });
      assert(r.shape === null && r.name === null, "no shape");
      assert(/^Invalid SVG: the file contains no <svg> element/.test(r.error), "error: " + r.error);
      assert(parsed === 0, "parser never called");
      const c = CNBSvgImporter.parseClefSvgText("{\"not\": \"svg\"}", "clef.svg", { parser });
      assert(c.glyph === null && /no <svg> element/.test(c.error) && parsed === 0, "clef path too: " + c.error);
    }},
  { name: "renderImportControl: a file that cannot be read or parsed reaches onResult as an error", fn: async () => {
      const makeEl = (tag) => ({
        tag, children: [], listeners: {}, className: "", textContent: "", style: {},
        classList: { add() {}, remove() {} },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        appendChild(c) { this.children.push(c); return c; },
        click() {},
      });
      const hadDoc = "document" in globalThis, prevDoc = globalThis.document;
      const hadParser = "DOMParser" in globalThis, prevParser = globalThis.DOMParser;
      globalThis.document = { createElement: makeEl };
      globalThis.DOMParser = class { parseFromString() { throw new Error("parser exploded"); } };
      try {
        const results = [];
        const ctl = CNBSvgImporter.renderImportControl(makeEl("div"), { onResult: r => results.push(r) });
        await ctl.importFile({ name: "locked.svg", text: () => Promise.reject(new Error("permission denied")) });
        assert(results.length === 1, "onResult called for the unreadable file");
        assert(results[0].shape === null && /locked\.svg/.test(results[0].error) &&
          /permission denied/.test(results[0].error), "read error surfaced: " + results[0].error);
        await ctl.importFile({ name: "odd.svg", text: async () => "<svg/>" });
        assert(results.length === 2 && /parser exploded/.test(results[1].error), "parser throw surfaced");
      } finally {
        if (hadDoc) globalThis.document = prevDoc; else delete globalThis.document;
        if (hadParser) globalThis.DOMParser = prevParser; else delete globalThis.DOMParser;
      }
    }},

  { name: "parseSvgText surfaces XML parse errors", fn: () => {
      const parser = { parseFromString: () => ({
        querySelector: (sel) => sel === "parsererror" ? { textContent: "unclosed tag at line 3" } : null,
      }) };
      const r = CNBSvgImporter.parseSvgText("<svg", "bad.svg", { parser });
      assert(r.shape === null, "no shape");
      assert(/Invalid SVG: unclosed tag/.test(r.error), "parse error surfaced");
    }},
];
