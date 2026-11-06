/**
 * cnb-double-notehead-tests.js — Unit tests for Module 7 (Double Notehead)
 *
 * Tests the pure layout() computation plus the render() DOM output via a
 * stub document; visual correctness is verified on the test pages
 * (test-ledger.html octave-chord column and, next session, test-card.html).
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBDoubleNotehead } from "../src/cnb-double-notehead.js";
import { withSvgStub } from "./svg-stub.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function approx(a, b, msg, tol = 1e-9) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
}

function fixture() {
  const config = CNBConfig.createDefault();
  const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
  const shape = config.shapes["crotchet-minim"];
  return { config, grid, shape };
}

export const tests = [

  { name: "layout: y positions come from semiToY of each semitone", fn: () => {
      const { grid, shape } = fixture();
      const l = CNBDoubleNotehead.layout(grid, {
        lowerSemi: 0, upperSemi: 12,
        lowerNote: { shape }, upperNote: { shape },
        centerX: 100,
      });
      eq(l.lowerY, grid.semiToY(0), "lowerY");
      eq(l.upperY, grid.semiToY(12), "upperY");
      assert(l.upperY < l.lowerY, "higher pitch renders at smaller y");
    }},

  { name: "layout: offsetPercent 0 (and default) puts both noteheads at centerX", fn: () => {
      const { grid, shape } = fixture();
      const explicit = CNBDoubleNotehead.layout(grid, {
        lowerSemi: 0, upperSemi: 12,
        lowerNote: { shape }, upperNote: { shape },
        centerX: 100, offsetPercent: 0,
      });
      eq(explicit.lowerX, 100, "lowerX");
      eq(explicit.upperX, 100, "upperX");
      const defaulted = CNBDoubleNotehead.layout(grid, {
        lowerSemi: 0, upperSemi: 12,
        lowerNote: { shape }, upperNote: { shape },
        centerX: 100,
      });
      eq(defaulted.lowerX, 100, "default lowerX");
      eq(defaulted.upperX, 100, "default upperX");
    }},

  { name: "layout: offsetPercent 100 separates noteheads by one notehead width, centered", fn: () => {
      const { grid, shape } = fixture();
      const { pixelWidth } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const l = CNBDoubleNotehead.layout(grid, {
        lowerSemi: 0, upperSemi: 12,
        lowerNote: { shape }, upperNote: { shape },
        centerX: 100, offsetPercent: 100,
      });
      approx(l.upperX - l.lowerX, pixelWidth, "separation = notehead width");
      approx((l.lowerX + l.upperX) / 2, 100, "pair stays centered on centerX");
      assert(l.lowerX < 100 && l.upperX > 100, "lower shifts left, upper shifts right");
    }},

  { name: "layout: offset scales with the wider of the two shapes", fn: () => {
      const { grid, shape } = fixture();
      // A shape twice as wide at the same rendered height.
      const wide = { ...shape, naturalWidth: shape.naturalWidth * 2 };
      const wideWidth = CNBNotehead.measure(wide, grid.pxPerSemi).pixelWidth;
      const l = CNBDoubleNotehead.layout(grid, {
        lowerSemi: 0, upperSemi: 12,
        lowerNote: { shape }, upperNote: { shape: wide },
        centerX: 100, offsetPercent: 50,
      });
      approx(l.upperX - l.lowerX, wideWidth / 2, "offset uses max pixelWidth");
    }},

  { name: "layout: scale factors match CNBNotehead.measure per shape", fn: () => {
      const { grid, shape } = fixture();
      const small = { ...shape, semitoneHeight: shape.semitoneHeight / 2 };
      const l = CNBDoubleNotehead.layout(grid, {
        lowerSemi: 0, upperSemi: 12,
        lowerNote: { shape }, upperNote: { shape: small },
        centerX: 100,
      });
      eq(l.lowerScale, CNBNotehead.measure(shape, grid.pxPerSemi).scaleFactor, "lowerScale");
      eq(l.upperScale, CNBNotehead.measure(small, grid.pxPerSemi).scaleFactor, "upperScale");
      assert(l.upperScale < l.lowerScale, "smaller semitoneHeight → smaller scale");
    }},

  { name: "layout: works for a non-octave pair (any two semitones)", fn: () => {
      const { grid, shape } = fixture();
      const l = CNBDoubleNotehead.layout(grid, {
        lowerSemi: 3, upperSemi: 7,
        lowerNote: { shape }, upperNote: { shape },
        centerX: 40,
      });
      eq(l.lowerY, grid.semiToY(3), "lowerY at semi 3");
      eq(l.upperY, grid.semiToY(7), "upperY at semi 7");
    }},

  // ── render (via DOM stub) ──────────────────────────────────────────────────

  { name: "render: appends two groups and returns {lowerG, upperG, lowerY, upperY}", fn: () => {
      const { grid, shape } = fixture();
      withSvgStub(svg => {
        const r = CNBDoubleNotehead.render(svg, grid, {
          lowerSemi: 0, upperSemi: 12,
          lowerNote: { shape, hollow: false, color: "#123456" },
          upperNote: { shape, hollow: false, color: "#654321" },
          centerX: 100,
        });
        eq(svg.children.length, 2, "two notehead groups appended");
        assert(svg.children[0] === r.lowerG, "lower drawn first (under)");
        assert(svg.children[1] === r.upperG, "upper drawn second (on top)");
        eq(r.lowerY, grid.semiToY(0), "lowerY");
        eq(r.upperY, grid.semiToY(12), "upperY");
      });
    }},

  { name: "render: groups positioned by layout() and paths carry note colors", fn: () => {
      const { grid, shape } = fixture();
      withSvgStub(svg => {
        const opts = {
          lowerSemi: 0, upperSemi: 12,
          lowerNote: { shape, hollow: false, color: "#123456" },
          upperNote: { shape, hollow: false, color: "#654321" },
          centerX: 100, offsetPercent: 20,
        };
        const l = CNBDoubleNotehead.layout(grid, opts);
        const r = CNBDoubleNotehead.render(svg, grid, opts);
        eq(r.lowerG.getAttribute("transform"), `translate(${l.lowerX},${l.lowerY})`, "lower group transform");
        eq(r.upperG.getAttribute("transform"), `translate(${l.upperX},${l.upperY})`, "upper group transform");
        eq(r.lowerG.children[0].getAttribute("fill"), "#123456", "lower fill");
        eq(r.upperG.children[0].getAttribute("fill"), "#654321", "upper fill");
      });
    }},

  { name: "render: hollow note gets a white overlay path, solid note does not", fn: () => {
      const { grid, shape } = fixture();
      withSvgStub(svg => {
        const r = CNBDoubleNotehead.render(svg, grid, {
          lowerSemi: 1, upperSemi: 13,
          lowerNote: { shape, hollow: false, color: "#000000" },
          upperNote: { shape, hollow: true, color: "#000000" },
          centerX: 100,
        });
        eq(r.lowerG.children.length, 1, "solid: single path");
        eq(r.upperG.children.length, 2, "hollow: main path + overlay");
        eq(r.upperG.children[1].getAttribute("fill"), "white", "overlay is white");
      });
    }},

  { name: "render: default color is black when note.color is absent", fn: () => {
      const { grid, shape } = fixture();
      withSvgStub(svg => {
        const r = CNBDoubleNotehead.render(svg, grid, {
          lowerSemi: 0, upperSemi: 12,
          lowerNote: { shape }, upperNote: { shape },
          centerX: 100,
        });
        eq(r.lowerG.children[0].getAttribute("fill"), "#000000", "default fill");
      });
    }},

  { name: "layout: per-note offsets default to 0 and leave the symmetric layout unchanged", fn: () => {
      const { grid, shape } = fixture();
      const base = { lowerSemi: 0, upperSemi: 12, lowerNote: { shape }, upperNote: { shape }, centerX: 100, offsetPercent: 20 };
      const a = CNBDoubleNotehead.layout(grid, base);
      const b = CNBDoubleNotehead.layout(grid, { ...base, lowerOffsetPx: 0, upperOffsetPx: 0 });
      eq(JSON.stringify(a), JSON.stringify(b), "explicit zeros match the defaults");
    }},

  { name: "layout: per-note offsets add to the symmetric offsetPercent result", fn: () => {
      const { grid, shape } = fixture();
      const base = { lowerSemi: 0, upperSemi: 12, lowerNote: { shape }, upperNote: { shape }, centerX: 100, offsetPercent: 20 };
      const a = CNBDoubleNotehead.layout(grid, base);
      const b = CNBDoubleNotehead.layout(grid, { ...base, lowerOffsetPx: 13.6, upperOffsetPx: -5 });
      approx(b.lowerX, a.lowerX + 13.6, "lower shifted right");
      approx(b.upperX, a.upperX - 5, "upper shifted left");
      eq(b.lowerY, a.lowerY, "y unaffected");
    }},

  { name: "render: per-note offsets move the rendered noteheads", fn: () => {
      const { grid, shape } = fixture();
      withSvgStub(svg => {
        const opts = { lowerSemi: 0, upperSemi: 12, lowerNote: { shape }, upperNote: { shape }, centerX: 100 };
        const expected = CNBDoubleNotehead.layout(grid, { ...opts, lowerOffsetPx: 10, upperOffsetPx: 10 });
        const plain = CNBDoubleNotehead.layout(grid, opts);
        eq(expected.lowerX, plain.lowerX + 10, "layout carries the offset");
        const r = CNBDoubleNotehead.render(svg, grid, { ...opts, lowerOffsetPx: 10, upperOffsetPx: 10 });
        eq(r.lowerG.getAttribute("transform"), `translate(${expected.lowerX},${expected.lowerY})`, "lower placed at offset x");
        eq(r.upperG.getAttribute("transform"), `translate(${expected.upperX},${expected.upperY})`, "upper placed at offset x");
      });
    }},

  // ── session 22: resolved size ──────────────────────────────────────────────
  { name: "layout: unsized notes give equal x and y scales (unchanged)", fn: () => {
      const { grid, shape } = fixture();
      const l = CNBDoubleNotehead.layout(grid, {
        lowerSemi: 0, upperSemi: 12, lowerNote: { shape }, upperNote: { shape }, centerX: 100,
      });
      const m = CNBNotehead.measure(shape, grid.pxPerSemi);
      eq(l.lowerScale, m.scaleFactor, "lowerScale");
      eq(l.lowerScaleX, m.scaleFactor, "lowerScaleX"); eq(l.lowerScaleY, m.scaleFactor, "lowerScaleY");
      eq(l.upperScaleX, m.scaleFactor, "upperScaleX"); eq(l.upperScaleY, m.scaleFactor, "upperScaleY");
    }},
  { name: "layout: each note's size sets its scales; the offset uses the wider resolved width", fn: () => {
      const { grid, shape } = fixture();
      const size = { heightSemis: 2, widthSemis: 6 };
      const l = CNBDoubleNotehead.layout(grid, {
        lowerSemi: 0, upperSemi: 12,
        lowerNote: { shape, size }, upperNote: { shape },
        centerX: 100, offsetPercent: 50,
      });
      const sized = CNBNotehead.measure(shape, grid.pxPerSemi, size);
      approx(l.lowerScaleX, sized.scaleX, "lower scaleX"); approx(l.lowerScaleY, sized.scaleY, "lower scaleY");
      approx(l.lowerScale, sized.scaleY, "lower scaleFactor = scaleY");
      approx(sized.pixelWidth, 6 * grid.pxPerSemi, "sized width 6 semis");
      const offset = 0.5 * sized.pixelWidth;   // sized is wider than the natural one
      approx(l.upperX - l.lowerX, offset, "offset from resolved width");
    }},
  { name: "render: a sized note is drawn with scale(sx,sy)", fn: () => {
      const { grid, shape } = fixture();
      const size = { heightSemis: 2, widthSemis: 6 };
      withSvgStub(() => {
        const parent = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const r = CNBDoubleNotehead.render(parent, grid, {
          lowerSemi: 0, upperSemi: 12,
          lowerNote: { shape, size }, upperNote: { shape }, centerX: 100,
        });
        const m = CNBNotehead.measure(shape, grid.pxPerSemi, size);
        eq(r.lowerG.children[0].getAttribute("transform"), `scale(${m.scaleX},${m.scaleY})`, "lower stretched");
        eq(r.upperG.children[0].getAttribute("transform"), `scale(${CNBNotehead.measure(shape, grid.pxPerSemi).scaleFactor})`, "upper unchanged");
      });
    }},

];
