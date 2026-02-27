/**
 * cnb-grid-tests.js — Unit tests for Module 1 (Semitone Grid)
 *
 * Tests only the pure coordinate logic (create/semiToY/yToSemi).
 * renderDebugOverlay requires a DOM and is tested via the visual test page.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid }   from "../src/cnb-grid.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function approx(a, b, msg, epsilon = 1e-9) {
  if (Math.abs(a - b) > epsilon)
    throw new Error(`${msg || "approx"}: expected ~${b}, got ${a}`);
}

// Helper: create a grid with the default config and a standard range
function makeGrid(minSemi = 0, maxSemi = 24) {
  return CNBGrid.create(CNBConfig.createDefault(), { minSemi, maxSemi });
}

export const tests = [

  // ── Basic structure ───────────────────────────────────────────────────────
  { name: "create() returns a gridContext object", fn: () => {
    const g = makeGrid();
    assert(typeof g === "object" && g !== null, "should be an object");
    assert(typeof g.semiToY === "function", "semiToY should be a function");
    assert(typeof g.yToSemi === "function", "yToSemi should be a function");
  }},

  { name: "pxPerSemi matches config.display.pxPerSemi", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.display.pxPerSemi = 20;
    const g = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
    eq(g.pxPerSemi, 20);
  }},

  { name: "minSemi and maxSemi are stored correctly", fn: () => {
    const g = makeGrid(4, 20);
    eq(g.minSemi, 4);
    eq(g.maxSemi, 20);
  }},

  { name: "totalSemiRange = maxSemi - minSemi", fn: () => {
    const g = makeGrid(0, 24);
    eq(g.totalSemiRange, 24);
  }},

  { name: "svgHeight = totalSemiRange × pxPerSemi", fn: () => {
    const g = makeGrid(0, 24);
    approx(g.svgHeight, 24 * g.pxPerSemi, "svgHeight");
  }},

  { name: "totalHeight = topLabelHeight + svgHeight + bottomLabelHeight", fn: () => {
    const g = makeGrid(0, 24);
    approx(g.totalHeight, g.topLabelHeight + g.svgHeight + g.bottomLabelHeight, "totalHeight");
  }},

  // ── semiToY ───────────────────────────────────────────────────────────────
  { name: "semiToY(maxSemi) = 0 (top of SVG)", fn: () => {
    const g = makeGrid(0, 24);
    approx(g.semiToY(24), 0, "semiToY(maxSemi)");
  }},

  { name: "semiToY(minSemi) = svgHeight (bottom of SVG)", fn: () => {
    const g = makeGrid(0, 24);
    approx(g.semiToY(0), g.svgHeight, "semiToY(minSemi)");
  }},

  { name: "semiToY increases as semitone decreases (higher pitch = lower Y)", fn: () => {
    const g = makeGrid(0, 24);
    assert(g.semiToY(20) < g.semiToY(10), "higher pitch should have smaller Y");
  }},

  { name: "semiToY: one semitone step = pxPerSemi pixels", fn: () => {
    const g = makeGrid(0, 24);
    approx(g.semiToY(12) - g.semiToY(13), g.pxPerSemi, "one semi step");
  }},

  { name: "semiToY(midpoint) = svgHeight / 2 for symmetric range", fn: () => {
    const g = CNBGrid.create(CNBConfig.createDefault(), { minSemi: 0, maxSemi: 24 });
    approx(g.semiToY(12), g.svgHeight / 2, "midpoint at center");
  }},

  // ── yToSemi ───────────────────────────────────────────────────────────────
  { name: "yToSemi(0) = maxSemi", fn: () => {
    const g = makeGrid(0, 24);
    approx(g.yToSemi(0), 24, "yToSemi(0)");
  }},

  { name: "yToSemi(svgHeight) = minSemi", fn: () => {
    const g = makeGrid(0, 24);
    approx(g.yToSemi(g.svgHeight), 0, "yToSemi(svgHeight)");
  }},

  // ── Invertibility ─────────────────────────────────────────────────────────
  { name: "semiToY and yToSemi are exact inverses for integer semitones", fn: () => {
    const g = makeGrid(0, 24);
    for (let semi = 0; semi <= 24; semi++) {
      const y = g.semiToY(semi);
      const back = g.yToSemi(y);
      approx(back, semi, `round-trip for semi=${semi}`, 1e-9);
    }
  }},

  { name: "yToSemi(semiToY(s)) = s for non-integer semitone", fn: () => {
    const g = makeGrid(0, 24);
    const semi = 7.5;
    approx(g.yToSemi(g.semiToY(semi)), semi, "non-integer round-trip");
  }},

  // ── Label heights ─────────────────────────────────────────────────────────
  { name: "topLabelHeight and bottomLabelHeight are positive numbers", fn: () => {
    const g = makeGrid(0, 24);
    assert(g.topLabelHeight > 0,    "topLabelHeight should be positive");
    assert(g.bottomLabelHeight > 0, "bottomLabelHeight should be positive");
  }},

  { name: "changing pxPerSemi scales svgHeight proportionally", fn: () => {
    const cfg1 = CNBConfig.createDefault();
    const cfg2 = CNBConfig.merge(cfg1, { display: { pxPerSemi: 32 } });
    const g1 = CNBGrid.create(cfg1, { minSemi: 0, maxSemi: 24 });
    const g2 = CNBGrid.create(cfg2, { minSemi: 0, maxSemi: 24 });
    approx(g2.svgHeight, g1.svgHeight * 2, "doubling pxPerSemi doubles svgHeight");
  }},

];
