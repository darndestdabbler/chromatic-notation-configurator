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
      // Default anchor centers the glyph on the default midpoint 12: 12 + 6/2
      approx(glyph.anchorSemi, 15, "default anchor centers on midpoint");
      assert(!warnings.some(w => /stem/i.test(w)), "no stem warnings for clefs");
    }},

  { name: "importer: buildClefGlyph derives semitoneHeight from viewBox when the attribute is absent", fn: () => {
      const ex = CNBSvgImporter.extractClef(stubDoc({
        rootAttrs: { viewBox: "0 0 120 450" },
        byId: { clef: stubEl({ d: "M 0 0" }) },
      }));
      const { glyph, warnings } = CNBSvgImporter.buildClefGlyph(ex, "X", { defaultMidpoint: 10 });
      approx(glyph.semitoneHeight, 4.5, "450 / 100 units per semitone");
      approx(glyph.anchorSemi, 12.25, "10 + 4.5/2");
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
