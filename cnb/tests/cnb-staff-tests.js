/**
 * cnb-staff-tests.js — Unit tests for Module 3 (Staff)
 *
 * Pure logic is tested directly; the axis-path render (set 014) runs
 * through the svg stub. Visual correctness is verified on the test pages.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { withSvgStub } from "./svg-stub.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

export const tests = [
  { name: "getPositions 0-24 with 4-8 pattern returns 4,8,16,20", fn: () => {
      const cfg = CNBConfig.createDefault();
      const pos = CNBStaff.getPositions(cfg, { minSemi: 0, maxSemi: 24 });
      eq(JSON.stringify(pos), JSON.stringify([4, 8, 16, 20]));
    }},

  { name: "getPositions 0-24 with 3-6-9 pattern", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.semitonePattern = [3,6,9];
      const pos = CNBStaff.getPositions(cfg, { minSemi: 0, maxSemi: 24 });
      eq(JSON.stringify(pos), JSON.stringify([3,6,9,15,18,21]));
    }},

  { name: "getPositions 0-12 with 4-8 returns [4,8]", fn: () => {
      const cfg = CNBConfig.createDefault();
      const pos = CNBStaff.getPositions(cfg, { minSemi: 0, maxSemi: 12 });
      eq(JSON.stringify(pos), JSON.stringify([4,8]));
    }},

  { name: "getPositions single semitone range returns that line", fn: () => {
      const cfg = CNBConfig.createDefault();
      const pos = CNBStaff.getPositions(cfg, { minSemi: 4, maxSemi: 4 });
      eq(JSON.stringify(pos), JSON.stringify([4]));
    }},

  { name: "getPositions results are sorted ascending", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.semitonePattern = [8,4]; // unsorted pattern
      const pos = CNBStaff.getPositions(cfg, { minSemi: 0, maxSemi: 24 });
      eq(JSON.stringify(pos), JSON.stringify([4,8,16,20]));
    }},

  { name: "getMidpoint returns config.staff.midpoint", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.midpoint = 42;
      eq(CNBStaff.getMidpoint(cfg), 42);
    }},

  { name: "default line thickness 20% of 16px semitone converts to 3.2px", fn: () => {
      const cfg = CNBConfig.createDefault();
      const px = CNBConfig.pctToPx(cfg.staff.lineDefaults.thicknessPct, cfg.display.pxPerSemi);
      eq(px, 3.2);
    }},

  { name: "override thickness 50% of 16px semitone converts to 8px", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.lineOverrides = { "4": { thicknessPct: 50 } };
      const props = Object.assign({}, cfg.staff.lineDefaults, cfg.staff.lineOverrides["4"]);
      eq(CNBConfig.pctToPx(props.thicknessPct, cfg.display.pxPerSemi), 8);
    }},

  { name: "line override merges thickness only", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.lineOverrides = { "4": { thicknessPct: 50 } };
      const positions = CNBStaff.getPositions(cfg, { minSemi: 0, maxSemi: 24 });
      const pc = positions[0] % 12;
      const overrides = cfg.staff.lineOverrides;
      const defaults = cfg.staff.lineDefaults;
      const props = Object.assign({}, defaults, overrides[String(pc)] || {});
      eq(props.thicknessPct, 50);
    }},

  // ── Axis path (set 014 s2, design §2.3) ──────────────────────────────

  { name: "render (axis): pattern semitones collapsing onto one axis position draw one line", fn: () => {
      const cfg = twinlineConfig();
      const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
      withSvgStub(svg => {
        const g = CNBStaff.render(svg, grid, cfg, 100);
        // [2,5,6,8,9] → axis {1,3,3,5,5}: three lines per octave, two octaves.
        eq(g.children.length, 6, "deduplicated line count");
        const ys = g.children.map(l => Number(l.getAttribute("y1")));
        eq(new Set(ys).size, 6, "distinct y per line");
        eq(ys[1], grid.semiToY(5), "F/F♯ collapsed line at their shared y");
        eq(grid.semiToY(5), grid.semiToY(6), "F and F♯ share a y");
      });
    }},

  { name: "render (axis): collapsed lines merge their overrides", fn: () => {
      const cfg = twinlineConfig();
      cfg.staff.lineOverrides = { "5": { thicknessPct: 50 }, "6": { color: "#ff0000" } };
      const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 12 });
      withSvgStub(svg => {
        const g = CNBStaff.render(svg, grid, cfg, 100);
        const line = g.children.find(l => Number(l.getAttribute("y1")) === grid.semiToY(5));
        eq(line.getAttribute("stroke-width"), "8", "thickness override from pc 5");
        eq(line.getAttribute("stroke"), "#ff0000", "color override from pc 6");
      });
    }},

  { name: "render (linear): the same pattern without the axis draws every semitone", fn: () => {
      const cfg = twinlineConfig();
      cfg.pitchAxis.enabled = false;
      const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
      withSvgStub(svg => {
        eq(CNBStaff.render(svg, grid, cfg, 100).children.length, 10, "no dedup on the linear path");
      });
    }},
];

/** Default config on the 013 Twinline axis with staff lines at axis {1,3,5}. */
function twinlineConfig() {
  const cfg = CNBConfig.createDefault();
  cfg.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
  };
  cfg.staff.semitonePattern = [2, 5, 6, 8, 9];
  cfg.staff.midpoint = 7;
  return cfg;
}
