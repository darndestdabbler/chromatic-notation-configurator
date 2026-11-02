/**
 * cnb-grid-tests.js — Unit tests for Module 1 (Semitone Grid)
 *
 * Tests the pure coordinate logic (create/semiToY/yToSemi) plus, from
 * set 014, the axis-enabled contexts (semiToY through CNBPitchAxis,
 * yToAxis, the absent scalar yToSemi, and the axis-aware debug overlay
 * via the svg stub). The disabled path's byte-identity pin against the
 * pre-change baseline fixture lives in cnb-pitch-axis-tests.js.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid }   from "../src/cnb-grid.js";
import { withSvgStub } from "./svg-stub.js";

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

  // ── Axis contexts (set 014, design §2.2) ──────────────────────────────────

  { name: "axis: disabled/absent pitchAxis exposes no axis and keeps yToSemi", fn: () => {
    const plain = makeGrid();
    assert(!("axis" in plain), "no axis property on the default grid");
    assert(typeof plain.yToSemi === "function", "yToSemi present");
    const disabled = CNBGrid.create(twinlineAxisConfig({ enabled: false }), { minSemi: 0, maxSemi: 24 });
    assert(!("axis" in disabled), "no axis property when disabled");
    assert(typeof disabled.yToSemi === "function", "yToSemi present when disabled");
  }},

  { name: "axis: an enabled but INACTIVE section (unknown kind) falls back to the literal linear context", fn: () => {
    const g = CNBGrid.create(twinlineAxisConfig({ kind: "not-a-kind" }), { minSemi: 0, maxSemi: 24 });
    assert(!("axis" in g), "no axis exposed");
    assert(typeof g.yToSemi === "function", "linear yToSemi");
    approx(g.semiToY(0), g.svgHeight, "linear semiToY");
    eq(g.svgHeight, 24 * g.pxPerSemi, "linear svgHeight");
  }},

  { name: "axis: enabled context exposes axis, drops yToSemi, provides yToAxis", fn: () => {
    const g = CNBGrid.create(twinlineAxisConfig(), { minSemi: 0, maxSemi: 24 });
    assert(g.axis && g.axis.enabled === true, "axis exposed and enabled");
    eq(g.yToSemi, undefined, "no scalar yToSemi in axis contexts (many-to-one inverse)");
    assert(typeof g.yToAxis === "function", "yToAxis provided");
  }},

  { name: "axis: semiToY = (maxAxisPos − positionOfSemi) × pxPerAxisUnit; shared pairs land on one Y", fn: () => {
    const g = CNBGrid.create(twinlineAxisConfig(), { minSemi: 0, maxSemi: 24 });
    const px = g.pxPerSemi;   // pxPerAxisUnit = display.pxPerSemi (§1.2 unit contract)
    // maxAxisPos = position(24) = 14 on the Twinline map (stride 7)
    approx(g.semiToY(24), 0, "maxSemi at top");
    approx(g.semiToY(0), 14 * px, "semi 0 at 14 axis units down");
    approx(g.semiToY(1), g.semiToY(0), "C and C♯ share one Y");
    approx(g.semiToY(13), g.semiToY(12), "C' and C♯' share one Y");
    approx(g.semiToY(2), 13 * px, "D one axis unit above the C pair");
    approx(g.semiToY(0) - g.semiToY(2), px, "one axis unit = pxPerSemi pixels");
  }},

  { name: "axis: svgHeight spans axis positions, not semitones", fn: () => {
    const g = CNBGrid.create(twinlineAxisConfig(), { minSemi: 0, maxSemi: 24 });
    eq(g.svgHeight, 14 * g.pxPerSemi, "14 axis units over the two-octave range");
    eq(g.totalSemiRange, 24, "totalSemiRange stays in semitones (identity)");
    approx(g.totalHeight, g.topLabelHeight + g.svgHeight + g.bottomLabelHeight, "totalHeight");
  }},

  { name: "axis: yToAxis inverts semiToY onto axis positions", fn: () => {
    const g = CNBGrid.create(twinlineAxisConfig(), { minSemi: 0, maxSemi: 24 });
    for (const s of [0, 1, 2, 7, 12, 13, 24, 0.5, 11.5]) {
      approx(g.yToAxis(g.semiToY(s)), g.axis.positionOfSemi(s), `yToAxis∘semiToY for semi ${s}`);
    }
  }},

  { name: "axis: fractional semitones (clef-style anchors) place through interpolation", fn: () => {
    const g = CNBGrid.create(twinlineAxisConfig(), { minSemi: 0, maxSemi: 24 });
    const px = g.pxPerSemi;
    // 1.5 interpolates to axis position 0.5 → y = (14 − 0.5) × px
    approx(g.semiToY(1.5), 13.5 * px, "semi 1.5 → axis 0.5");
    // 22.784 is flat across the (A♯',B') pair at position 13
    approx(g.semiToY(22.784), 1 * px, "semi 22.784 → axis 13");
  }},

  { name: "axis: ENABLED identity axis reproduces the linear grid's numbers (design §1.2 degeneracy check)", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.pitchAxis = {
      enabled: true,
      kind: "pitch-class-map-v1",
      octaveStride: 12,
      axisUnitsPerStaffSpace: cfg.staff.semitonesPerStaffSpace,
      pitchClasses: Array.from({ length: 12 }, (_, pc) => ({ pc, position: pc })),
    };
    const gAxis   = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
    const gLinear = makeGrid(0, 24);
    eq(gAxis.svgHeight, gLinear.svgHeight, "svgHeight matches");
    eq(gAxis.totalHeight, gLinear.totalHeight, "totalHeight matches");
    for (let s = 0; s <= 24; s++) {
      eq(gAxis.semiToY(s), gLinear.semiToY(s), `semiToY(${s}) matches`);
      eq(gAxis.semiToY(s + 0.5), gLinear.semiToY(s + 0.5), `semiToY(${s}.5) matches`);
    }
  }},

  { name: "axis: debug overlay draws one line per declared axis position, labeled with all semitones mapping there", fn: () => {
    withSvgStub(svg => {
      const cfg = twinlineAxisConfig();
      const g = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
      svg.setAttribute("width", "400");
      const overlay = CNBGrid.renderDebugOverlay(svg, g, [4, 8, 16, 20]);
      const lines = overlay.children.filter(c => c.tag === "line");
      const labels = overlay.children.filter(c => c.tag === "text");
      // Twinline over 0..24: axis positions 0..14 → 15 distinct lines
      eq(lines.length, 15, "one line per declared axis position");
      eq(labels.length, 15, "one label per line");
      const texts = labels.map(l => l.textContent);
      assert(texts.includes("0,1"), "shared pair labeled '0,1'");
      assert(texts.includes("12,13"), "next-octave pair labeled '12,13'");
      assert(texts.includes("2"), "unshared D labeled '2'");
      assert(texts.includes("24"), "range end labeled '24'");
      // Staff highlight: semis 4 (pos 2) and 8 (pos 5) are staff lines;
      // the pos-2 line carries both 3 and 4 → highlighted.
      const staffLabel = labels.find(l => l.textContent === "3,4");
      eq(staffLabel.getAttribute("fill"), "#4488cc", "staff-carrying position highlighted");
      const y34 = lines[labels.indexOf(staffLabel)];
      eq(y34.getAttribute("stroke"), "#4488cc", "staff line color");
    });
  }},

];

// ── Pitch-axis test helper (set 014) ─────────────────────────────────────────

/** Default config with the design §1.1 Twinline-like axis enabled. */
function twinlineAxisConfig(overrides = {}) {
  const config = CNBConfig.createDefault();
  config.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
    ...overrides,
  };
  return config;
}
