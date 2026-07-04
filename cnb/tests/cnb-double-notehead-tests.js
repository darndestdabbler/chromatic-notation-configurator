/**
 * cnb-double-notehead-tests.js — Unit tests for Module 7 (Double Notehead)
 *
 * Tests the pure layout() computation; render() is verified visually
 * (test-ledger.html octave-chord column and, next session, test-card.html).
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBDoubleNotehead } from "../src/cnb-double-notehead.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function approx(a, b, msg, tol = 1e-9) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
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

];
