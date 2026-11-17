/**
 * cnb-clef-tests.js — Unit tests for the set-009 clef feature
 *
 * Covers: the clef's LilyPond export (the default config against its
 * baseline fixture; an enabled clef exported, a disabled one exported as
 * 'none — session 30), CNBClef measure/gutter/render (including
 * FLOAT anchorSemi — the s1 anchoring decision), clef glyph SVG import,
 * and the collection's clef gutter column.
 *
 * The clef SECTION tests (schema defaults, merge, validation) live in
 * cnb-config-tests.js — they are Module A behavior (spec step 6
 * "config-test additions").
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBClef } from "../src/cnb-clef.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBCard } from "../src/cnb-card.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBSvgImporter } from "../ui/svg-importer.js";
import { withSvgStub, withDomStub } from "./svg-stub.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(__dirname, "..", "fixtures", "default-export-baseline.ly");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function approx(a, b, msg, tol = 1e-9) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
}

/** Normalize an export for comparison: date line + line endings. */
function normalizeLy(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
}

const TEST_GLYPH = {
  displayName: "Test Clef",
  kind: "glyph",
  svgPath: "M 0 0 L 100 0 L 100 300 L 0 300 Z",
  naturalHeight: 300,
  naturalWidth: 100,
  semitoneHeight: 6,
  viewBoxMinX: 0,
  viewBoxMinY: 0,
  lilypondPath: null,
  anchorSemi: 20,
};

/** Default config with the clef enabled on a fresh copy of TEST_GLYPH. */
function clefConfig(glyphOverrides = {}, clefOverrides = {}) {
  const config = CNBConfig.createDefault();
  config.clef = {
    ...config.clef,
    enabled: true,
    active: "test-clef",
    glyphs: { "test-clef": { ...TEST_GLYPH, ...glyphOverrides } },
    ...clefOverrides,
  };
  return config;
}

/** The engine's dozenal clef (session 45). */
const DOZENAL = { kind: "dozenal", displayName: "Dozenal" };

/** Default config showing the dozenal clef, at a height set by hand when given. */
function dozenalConfig(height) {
  const config = CNBConfig.createDefault();
  const def = height === undefined ? { ...DOZENAL } : { ...DOZENAL, semitoneHeight: height };
  config.clef = { ...config.clef, enabled: true, active: "dozenal", glyphs: { dozenal: def } };
  return config;
}

// ── Minimal SVG document stub for importer tests ─────────────────────────────

function stubEl(attrs) {
  return { getAttribute: (k) => (k in attrs ? String(attrs[k]) : null), tagName: attrs.tagName || "path" };
}

function stubDoc({ rootAttrs = {}, byId = {}, firstPath = null }) {
  const root = { ...stubEl({ tagName: "svg", ...rootAttrs }) };
  return {
    documentElement: root,
    getElementById: (id) => byId[id] || null,
    querySelector: (sel) => (sel === "path" ? firstPath : null),
  };
}

export const tests = [

  // ── Export (session 30, LY spec 1.3.7 §5.5) ────────────────────────────

  { name: "export: the default config matches default-export-baseline.ly byte-for-byte", fn: () => {
      const baseline = normalizeLy(fs.readFileSync(BASELINE_PATH, "utf8"));
      const current = normalizeLy(CNBLilypond.generate(CNBConfig.createDefault()));
      eq(current, baseline, "default export");
    }},

  { name: "export: a clef-enabled config exports its clef, and the same config disabled exports 'none", fn: () => {
      const enabled = clefConfig();
      const disabled = CNBConfig.clone(enabled);
      disabled.clef.enabled = false;
      const on = CNBLilypond.generate(enabled);
      const off = CNBLilypond.generate(disabled);
      assert(on.includes("#(set! cnb:clef-style 'custom)") && on.includes("#(cnb:register-clef! 'test-clef"), "enabled: the glyph is registered and shown");
      assert(off.includes("#(set! cnb:clef-style 'none)") && !off.includes("cnb:register-clef!"), "disabled: no clef engraved");
    }},

  // ── CNBClef.activeGlyph / measure / gutterWidth ────────────────────────

  { name: "activeGlyph: null when disabled, unset, or unknown; resolves when valid", fn: () => {
      eq(CNBClef.activeGlyph(CNBConfig.createDefault()), null, "disabled");
      const noActive = clefConfig();
      noActive.clef.active = null;
      eq(CNBClef.activeGlyph(noActive), null, "no active name");
      const unknown = clefConfig();
      unknown.clef.active = "nope";
      eq(CNBClef.activeGlyph(unknown), null, "unknown name");
      const ok = CNBClef.activeGlyph(clefConfig());
      eq(ok.name, "test-clef", "resolved name");
      eq(ok.def.semitoneHeight, 6, "resolved def");
    }},

  { name: "measure: glyph kind scales like noteheads (semitoneHeight × pxPerSemi / naturalHeight)", fn: () => {
      const m = CNBClef.measure(TEST_GLYPH, 16);
      approx(m.scaleFactor, 0.32, "scale");
      approx(m.pixelWidth, 32, "width");
      approx(m.pixelHeight, 96, "height");
    }},

  { name: "measure: text kind sizes the em-box from textHeightSemis", fn: () => {
      const m = CNBClef.measure({ kind: "text", text: "50", textHeightSemis: 5 }, 16);
      approx(m.pixelHeight, 80, "height");
      approx(m.pixelWidth, 0.6 * 80 * 2, "width estimate");
    }},

  { name: "gutterWidth: 0 when disabled (no gutter reserved), width + 2×padding when active", fn: () => {
      eq(CNBClef.gutterWidth(CNBConfig.createDefault(), 16), 0, "disabled → 0");
      approx(CNBClef.gutterWidth(clefConfig(), 16), 32 + 24, "enabled → glyph + padding");
    }},

  // ── The dozenal clef (session 45) ──────────────────────────────────────

  { name: "measure: the dozenal numeral is 3 staff spaces tall and two half-width digits wide", fn: () => {
      // The left digit's ink, 722 font units, is made 3 staff spaces tall;
      // each digit's advance (574 units) is drawn at half that scale.
      const m = CNBClef.measure(DOZENAL, 16, 64);
      approx(m.pixelHeight, 3 * 64, "3 staff spaces");
      approx(m.pixelWidth, 574 * 3 / 722 * 64, "advance × scale", 1e-9);
      approx(m.pixelWidth / 64, 2.385, "about 2.385 staff spaces (the engine's 2.395, measured)", 0.0005);
    }},

  { name: "gutterWidth: the dozenal clef is measured at its height, LilyPond's 3 staff spaces or automatic", fn: () => {
      const config = dozenalConfig(12);
      approx(CNBClef.gutterWidth(config, 16), 574 * 3 / 722 * 64 + 24, "12 semitones at sps 4: 64 px a staff space");
      config.staff.semitonesPerStaffSpace = 3;
      config.clef.glyphs.dozenal.semitoneHeight = 9;
      approx(CNBClef.gutterWidth(config, 16), 574 * 3 / 722 * 48 + 24, "9 semitones at sps 3: 48 px");
      // Automatic (session 59): 3 × CNBStaff.symbolSpace, 3 × 2.724 on the default staff.
      approx(CNBClef.gutterWidth(dozenalConfig(), 16), 574 / 722 * 3 * 2.724 * 16 + 24, "automatic");
    }},

  { name: "shown: the dozenal clef's height is set by hand, or automatic, 3 × symbolSpace (session 59)", fn: () => {
      approx(CNBClef.shown(dozenalConfig()).height, 3 * 2.724, "automatic on the default staff", 1e-9);
      approx(CNBClef.shown(dozenalConfig(null)).height, 3 * 2.724, "null is automatic", 1e-9);
      eq(CNBClef.shown(dozenalConfig(10)).height, 10, "set by hand");
      eq(CNBClef.shown(dozenalConfig()).top, null, "no top: it sits on the middle line");
      const kite = dozenalConfig();
      kite.staff.semitonesPerStaffSpace = 3;
      kite.shapes["crotchet-minim"].semitoneHeight = 4;
      approx(CNBClef.shown(kite).height, 9, "capped at a staff space: LilyPond's 3 staff spaces", 1e-9);
    }},

  { name: "render: the dozenal clef draws 5 and 0 on the middle line, as the engine engraves 50", fn: () => {
      withSvgStub(svg => {
        const config = dozenalConfig(12);
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const g = CNBClef.render(svg, grid, config);
        // midpoint 12 → y = (28 − 12) × 16 = 256; a staff space is 64 px.
        eq(g.getAttribute("transform"), "translate(12,256) scale(64)", "middle line, staff-space units");
        eq(g.children.length, 2, "two digits");
        const [five, zero] = g.children;
        assert(five.getAttribute("d").startsWith("M535 234"), "the left digit is 5");
        assert(zero.getAttribute("d").startsWith("M546 342"), "the right digit is 0");
        const s = 3 / 722;
        eq(five.getAttribute("transform"), `translate(0,1.5) scale(${s / 2},${-s})`, "3 staff spaces tall, half across, 1.5 down");
        eq(zero.getAttribute("transform"), `translate(${574 * s / 2},1) scale(${s / 2},${-s * 2 / 3})`, "2/3 tall, after the 5, 1 down");
        eq(five.getAttribute("fill"), "#000000", "black, as engraved");
      });
    }},

  { name: "render: the dozenal clef at another height is scaled about the middle line (session 59)", fn: () => {
      withSvgStub(svg => {
        const config = dozenalConfig(6);
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const g = CNBClef.render(svg, grid, config);
        // Half LilyPond's 12 semitones: half the staff space, the middle line unmoved.
        eq(g.getAttribute("transform"), "translate(12,256) scale(32)", "scaled about the middle line");
        const auto = CNBClef.render(svg, grid, dozenalConfig());
        const m = /^translate\(12,256\) scale\(([^)]+)\)$/.exec(auto.getAttribute("transform"));
        assert(m, "automatic: on the middle line");
        approx(Number(m[1]), 64 * 2.724 / 4, "automatic: 2.724 semitones a staff space", 1e-9);
      });
    }},

  { name: "extent: the dozenal numeral spans 1.4418 above to 1.5582 below the middle line", fn: () => {
      const config = dozenalConfig(12);
      const e = CNBClef.extent(config);
      approx(e.top, 12 + 1.4418 * 4, "top (engine: 1.44181 staff spaces)", 0.001);
      approx(e.bottom, 12 - 1.5582 * 4, "bottom (engine: −1.55819)", 0.001);
      config.staff.semitonesPerStaffSpace = 3;
      config.staff.midpoint = 10;
      config.clef.glyphs.dozenal.semitoneHeight = 9;
      approx(CNBClef.extent(config).top, 10 + 1.4418 * 3, "follows the staff's middle and spacing", 0.001);
    }},

  { name: "extent: the dozenal numeral at a set or automatic height, about the middle line (session 59)", fn: () => {
      const set = CNBClef.extent(dozenalConfig(6));
      approx(set.top, 12 + 1.4418 * 2, "6 semitones: half of 3 staff spaces' top", 0.001);
      approx(set.bottom, 12 - 1.5582 * 2, "and bottom", 0.001);
      const auto = CNBClef.extent(dozenalConfig());
      approx(auto.top, 12 + 1.4418 * 2.724, "automatic: 2.724 semitones a staff space", 0.001);
      approx(auto.bottom, 12 - 1.5582 * 2.724, "bottom", 0.001);
    }},

  // ── Sized about an anchor (session 59) ─────────────────────────────────

  { name: "shown: a glyph clef without a reference keeps anchorSemi as its top and semitoneHeight as its height", fn: () => {
      const shown = CNBClef.shown(clefConfig({ anchorSemi: 20.5 }));
      eq(shown.top, 20.5, "top = anchorSemi");
      eq(shown.height, 6, "height = semitoneHeight");
      eq(CNBClef.shown(CNBConfig.createDefault()), null, "no clef shown");
    }},

  { name: "shown: a referenced clef's anchor sits on anchorSemi, its top above it at each size", fn: () => {
      // The test glyph is 300 units tall; its anchor 100 units below its top.
      const at = (height) => CNBClef.shown(clefConfig({ reference: { x: 50, y: 100 }, anchorSemi: 10, semitoneHeight: height }));
      eq(at(6).top, 12, "6 semitones: the anchor a third down, 2 below the top");
      eq(at(3).top, 11, "3 semitones: 1 below the top");
      eq(at(9).top, 13, "9 semitones: 3 below the top");
      const e = CNBClef.extent(clefConfig({ reference: { x: 50, y: 100 }, anchorSemi: 10, semitoneHeight: 9 }));
      eq(e.top, 13, "extent: top");
      eq(e.bottom, 4, "extent: bottom, the anchor two-thirds up");
      // A viewBox offset: the reference is in the glyph's own coordinates.
      eq(CNBClef.shown(clefConfig({ reference: { x: 0, y: 0 }, viewBoxMinY: -150, anchorSemi: 10 })).top, 13,
        "origin in the middle: half the height above");
    }},

  { name: "shown: an automatic glyph height is its LilyPond height in staff spaces × symbolSpace", fn: () => {
      // 300 units at 100 a staff space: 3 staff spaces, 2.724 semitones each on the default staff.
      const shown = CNBClef.shown(clefConfig({ semitoneHeight: null, staffSpaceUnits: 100, reference: { x: 0, y: 150 }, anchorSemi: 7 }));
      approx(shown.height, 3 * 2.724, "automatic height", 1e-9);
      approx(shown.top, 7 + 1.5 * 2.724, "the anchor in the middle stays on 7", 1e-9);
      const set = CNBClef.shown(clefConfig({ semitoneHeight: 12, staffSpaceUnits: 100, reference: { x: 0, y: 150 }, anchorSemi: 7 }));
      eq(set.height, 12, "a height set by hand stays");
      eq(set.top, 13, "about the anchor");
    }},

  { name: "shown: under a pitch axis a referenced clef's top is found in axis positions (Twinline)", fn: () => {
      const config = clefConfig({ reference: { x: 0, y: 150 }, anchorSemi: 7, semitoneHeight: 4 });
      config.staff.midpoint = 7;
      config.pitchAxis = {
        enabled: true, kind: "pitch-class-map-v1", octaveStride: 7, axisUnitsPerStaffSpace: 2,
        pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
      };
      // G (7) is at position 4; 2 axis units above it is position 6, A♯ (10).
      eq(CNBClef.shown(config).top, 10, "the top 2 axis units above G");
      config.clef.glyphs["test-clef"].semitoneHeight = 3;
      // 1.5 units above position 4 is 5.5, halfway from A (9, at 5) to A♯ (10, at 6).
      approx(CNBClef.shown(config).top, 9.5, "fractional, interpolated as the grid places it", 1e-9);
    }},

  { name: "render: a referenced clef is drawn at its height with its anchor on its semitone", fn: () => {
      withSvgStub(svg => {
        const config = clefConfig({ reference: { x: 50, y: 100 }, anchorSemi: 10, semitoneHeight: 3 });
        const grid = CNBGrid.create(config, { minSemi: 0, maxSemi: 24 });
        const g = CNBClef.render(svg, grid, config);
        // The top is 11: y = (24 − 11) × 16 = 208; the path at 3 × 16 / 300 = 0.16.
        eq(g.getAttribute("transform"), "translate(12,208)", "top edge at the anchor's top");
        assert(g.children[0].getAttribute("transform").startsWith("scale(0.16)"), "scaled to 3 semitones");
        eq(Number(g.children[1].getAttribute("width")), 16, "the handle spans the scaled width");
      });
    }},

  { name: "extent: a glyph's and a text clef's top and bottom; null when no clef shows", fn: () => {
      const glyph = CNBClef.extent(clefConfig({ anchorSemi: 20.5 }));
      eq(glyph.top, 20.5, "glyph top = anchorSemi");
      eq(glyph.bottom, 14.5, "glyph bottom = anchorSemi − semitoneHeight");
      const text = CNBClef.extent(clefConfig({ kind: "text", text: "4", textHeightSemis: 5, anchorSemi: 18 }));
      eq(text.top, 18, "text top");
      eq(text.bottom, 13, "text bottom");
      eq(CNBClef.extent(CNBConfig.createDefault()), null, "the default config shows none");
      const off = clefConfig();
      off.clef.enabled = false;
      eq(CNBClef.extent(off), null, "disabled");
    }},

  // ── CNBClef.render ─────────────────────────────────────────────────────

  { name: "render: nothing rendered and null returned when no clef is active", fn: () => {
      withSvgStub(svg => {
        const config = CNBConfig.createDefault();
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        eq(CNBClef.render(svg, grid, config), null, "returns null");
        eq(svg.children.length, 0, "no children appended");
      });
    }},

  { name: "render: glyph top placed at semiToY(anchorSemi), left at paddingH", fn: () => {
      withSvgStub(svg => {
        const config = clefConfig();
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const g = CNBClef.render(svg, grid, config);
        // anchorSemi 20 → y = (28 - 20) × 16 = 128
        eq(g.getAttribute("transform"), "translate(12,128)", "gutter x + anchor y");
        const pathEl = g.children[0];
        eq(pathEl.tag, "path", "path child");
        eq(pathEl.getAttribute("d"), TEST_GLYPH.svgPath, "path data");
        eq(pathEl.getAttribute("transform"), "scale(0.32) translate(0,0)", "scale + viewBox shift");
      });
    }},

  { name: "render: a glyph clef draws a hidden resize handle along its bottom edge (session 45)", fn: () => {
      withSvgStub(svg => {
        const config = clefConfig();
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const g = CNBClef.render(svg, grid, config);
        const handle = g.children.find(c => c.getAttribute("class") === "cnb-clef-resize");
        assert(handle, "a handle");
        eq(handle.tag, "rect", "a rect");
        // 6 semitones × 16 px = 96 px tall, 32 px wide; the handle 8 px, centred on the bottom.
        eq(handle.getAttribute("y"), "92", "centred on the bottom edge");
        eq(handle.getAttribute("height"), "8", "8 px tall");
        eq(handle.getAttribute("width"), "32", "as wide as the clef");
        eq(handle.getAttribute("fill"), "none", "unpainted");
        eq(handle.getAttribute("visibility"), "hidden", "hidden until the canvas shows it");
      });
      withSvgStub(svg => {
        const config = clefConfig({ kind: "text", text: "4", textHeightSemis: 5 });
        const g = CNBClef.render(svg, CNBGrid.create(config, { minSemi: -4, maxSemi: 28 }), config);
        assert(!g.children.some(c => c.getAttribute("class") === "cnb-clef-resize"), "no handle on a text clef");
      });
      withSvgStub(svg => {
        const config = dozenalConfig();
        const g = CNBClef.render(svg, CNBGrid.create(config, { minSemi: -4, maxSemi: 28 }), config);
        assert(!g.children.some(c => c.getAttribute("class") === "cnb-clef-resize"), "none on the dozenal clef");
      });
    }},

  { name: "render: FLOAT anchorSemi positions fractionally on the grid", fn: () => {
      withSvgStub(svg => {
        const config = clefConfig({ anchorSemi: 20.5 });
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const g = CNBClef.render(svg, grid, config);
        eq(g.getAttribute("transform"), "translate(12,120)", "7.5 semis × 16px");
      });
    }},

  { name: "render: non-zero viewBox min offsets shift the glyph origin to (0,0)", fn: () => {
      withSvgStub(svg => {
        const config = clefConfig({ viewBoxMinX: -50, viewBoxMinY: -150 });
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const g = CNBClef.render(svg, grid, config);
        eq(g.children[0].getAttribute("transform"), "scale(0.32) translate(50,150)", "min offsets negated");
      });
    }},

  { name: "render: text kind renders a bold label with em-box height from textHeightSemis", fn: () => {
      withSvgStub(svg => {
        const config = clefConfig({ kind: "text", text: "50", textHeightSemis: 5 });
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const g = CNBClef.render(svg, grid, config);
        const textEl = g.children[0];
        eq(textEl.tag, "text", "text child");
        eq(textEl.textContent, "50", "label text");
        eq(textEl.getAttribute("font-size"), "80", "em-box height 5 × 16");
        eq(textEl.getAttribute("y"), "80", "baseline at box bottom");
      });
    }},

  // ── Collection integration ─────────────────────────────────────────────

  { name: "collection: default config renders no clef column (layout unchanged)", fn: () => {
      withDomStub(container => {
        const root = CNBCollection.render(container, CNBConfig.createDefault());
        const row = root.children[0];
        const previewContainer = row.children.find(c => c.className === "preview-container");
        const columns = previewContainer.children.find(c => c.className === "pc-columns");
        eq(columns.children.length, 13, "13 cards, no clef column");
        assert(columns.children.every(c => c.className === "pc-col"), "cards only");
      });
    }},

  { name: "collection: enabled clef prepends a clef-col with spacers and a clef-slice SVG", fn: () => {
      withDomStub(container => {
        const config = clefConfig();
        const root = CNBCollection.render(container, config);
        const row = root.children[0];
        const previewContainer = row.children.find(c => c.className === "preview-container");
        const columns = previewContainer.children.find(c => c.className === "pc-columns");
        eq(columns.children.length, 14, "clef column + 13 cards");
        const clefCol = columns.children[0];
        eq(clefCol.className, "clef-col", "clef column first");
        eq(clefCol.style.width, "56px", "gutter width (32 + 2×12)");
        const slice = clefCol.children[1];
        eq(slice.getAttribute("class"), "clef-slice", "clef SVG between the spacers");
        eq(slice.children.length, 1, "clef rendered into the slice");
        eq(slice.children[0].getAttribute("class"), "cnb-clef", "cnb-clef group");
      });
    }},

  { name: "collection: staff background spans the clef gutter plus all card columns", fn: () => {
      withDomStub(container => {
        const config = clefConfig();
        const pcs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const grid = CNBGrid.create(config, CNBCollection.gridRange(pcs));
        const cardsWidth = pcs.reduce(
          (sum, pc) => sum + CNBCard.columnWidth(config, grid, { pc, duration: "crotchet" }), 0);
        const root = CNBCollection.render(container, config);
        const row = root.children[0];
        const previewContainer = row.children.find(c => c.className === "preview-container");
        const bg = previewContainer.children.find(c => c.getAttribute("class") === "staff-lines-bg");
        approx(parseFloat(bg.getAttribute("width")), 56 + cardsWidth, "bg width includes gutter");
      });
    }},

  // ── SVG importer: clef glyph kind ──────────────────────────────────────

  { name: "importer: extractClef reads id=\"clef\" with the toolkit data-* contract", fn: () => {
      const doc = stubDoc({
        rootAttrs: { viewBox: "-50 -150 100 300" },
        byId: { clef: stubEl({ d: "M 0 0 L 1 1", "data-semitone-height": "6" }) },
      });
      const ex = CNBSvgImporter.extractClef(doc);
      eq(ex.error, null, "no error");
      eq(ex.svgPath, "M 0 0 L 1 1", "path");
      eq(ex.semitoneHeight, 6, "semitone height");
      eq(ex.viewBoxMinX, -50, "viewBox minX kept");
      eq(ex.viewBoxMinY, -150, "viewBox minY kept");
    }},

  { name: "importer: extractClef falls back to id=\"notehead\", then to the first <path>", fn: () => {
      const viaNotehead = CNBSvgImporter.extractClef(stubDoc({
        rootAttrs: { viewBox: "0 0 100 300" },
        byId: { notehead: stubEl({ d: "M 2 2", "data-semitone-height": "3" }) },
      }));
      eq(viaNotehead.svgPath, "M 2 2", "notehead fallback");
      const viaPath = CNBSvgImporter.extractClef(stubDoc({
        rootAttrs: { viewBox: "0 0 100 300" },
        firstPath: stubEl({ d: "M 3 3" }),
      }));
      eq(viaPath.svgPath, "M 3 3", "first-path fallback");
      const none = CNBSvgImporter.extractClef(stubDoc({ rootAttrs: { viewBox: "0 0 1 1" } }));
      assert(none.error && none.error.includes("No clef glyph element"), "error when nothing found");
    }},

  { name: "importer: buildClefGlyph builds a kind:\"glyph\" entry, no stem/anchor requirements", fn: () => {
      const ex = CNBSvgImporter.extractClef(stubDoc({
        rootAttrs: { viewBox: "-50 -150 100 300" },
        byId: { clef: stubEl({ d: "M 0 0 L 1 1", "data-semitone-height": "6" }) },
      }));
      const { glyph, warnings, error } = CNBSvgImporter.buildClefGlyph(ex, "My Clef");
      eq(error, null, "no error");
      eq(glyph.kind, "glyph", "kind");
      eq(glyph.displayName, "My Clef", "display name");
      eq(glyph.naturalHeight, 300, "natural height");
      eq(glyph.naturalWidth, 100, "natural width");
      eq(glyph.semitoneHeight, 6, "semitone height");
      // The anchor starts at the box's centre, on the default midpoint 12
      // (session 59), so the glyph is centred there: its top 12 + 6/2.
      eq(JSON.stringify(glyph.reference), JSON.stringify({ x: 0, y: 0 }), "the box's centre");
      eq(glyph.anchorSemi, 12, "anchored on the midpoint");
      const config = clefConfig();
      config.clef.glyphs["test-clef"] = glyph;
      approx(CNBClef.shown(config).top, 15, "centred on the midpoint, as before");
      assert(!warnings.some(w => /stem/i.test(w)), "no stem warnings for clefs");
    }},

  { name: "importer: buildClefGlyph derives semitoneHeight from viewBox when the attribute is absent", fn: () => {
      const ex = CNBSvgImporter.extractClef(stubDoc({
        rootAttrs: { viewBox: "0 0 120 450" },
        byId: { clef: stubEl({ d: "M 0 0" }) },
      }));
      const { glyph, warnings } = CNBSvgImporter.buildClefGlyph(ex, "X", { defaultMidpoint: 10 });
      approx(glyph.semitoneHeight, 4.5, "450 / 100 units per semitone");
      eq(JSON.stringify(glyph.reference), JSON.stringify({ x: 60, y: 225 }), "the box's centre");
      eq(glyph.anchorSemi, 10, "anchored on the midpoint, its top 10 + 4.5/2");
      assert(warnings.some(w => w.includes("data-semitone-height")), "derivation warned");
    }},

  { name: "importer: parseClefSvgText end-to-end with an injected parser", fn: () => {
      const doc = stubDoc({
        rootAttrs: { viewBox: "0 0 100 300" },
        byId: { clef: stubEl({ d: "M 0 0 L 9 9", "data-semitone-height": "3" }) },
      });
      const result = CNBSvgImporter.parseClefSvgText("<svg/>", "express-b-clef.svg", {
        parser: { parseFromString: () => doc },
      });
      eq(result.error, null, "no error");
      eq(result.name, "express-b-clef", "name from filename");
      eq(result.glyph.displayName, "Express B Clef", "display name");
      eq(result.glyph.kind, "glyph", "kind");
    }},

];
