/**
 * cnb-staff-tests.js — Unit tests for Module 3 (Staff)
 *
 * Only the pure logic functions are tested; rendering requires DOM and is
 * verified via the visual test page.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBStaff } from "../src/cnb-staff.js";

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
];
