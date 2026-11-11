/**
 * cnb-staff-tests.js — Unit tests for Module 3 (Staff)
 *
 * Pure logic is tested directly; the axis-path render (set 014) runs
 * through the svg stub. Visual correctness is verified on the test pages.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBCard } from "../src/cnb-card.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { withSvgStub, withDomStub } from "./svg-stub.js";
import { findEngine, measureLines } from "./engine-probe.js";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

export const tests = [
  { name: "lilypondPositions: the lines in half staff spaces from the middle, over the 24 semitones centred on it", fn: () => {
      const cfg = CNBConfig.createDefault();
      eq(JSON.stringify(CNBStaff.lilypondPositions(cfg)), JSON.stringify([-4, -2, 2, 4]), "4-8, midpoint 12, sps 4");
      cfg.staff.semitonePattern = [3, 6, 9];
      cfg.staff.semitonesPerStaffSpace = 3;
      eq(JSON.stringify(CNBStaff.lilypondPositions(cfg)), JSON.stringify([-6, -4, -2, 2, 4, 6]), "3-6-9, sps 3");
      cfg.staff.semitonePattern = [0, 3, 9];         // the pitch moved up 6, pattern and midpoint together:
      cfg.staff.midpoint = 18;                       // the range follows the middle (LY spec 1.3.5)
      eq(JSON.stringify(CNBStaff.lilypondPositions(cfg)), JSON.stringify([-6, -4, -2, 2, 4, 6]), "moved 6 up");
    }},

  { name: "lilypondPosition: half staff spaces above the middle, linear and under an axis", fn: () => {
      const cfg = CNBConfig.createDefault();          // midpoint 12, 4 semitones per staff space
      eq(CNBStaff.lilypondPosition(cfg, 12), 0, "the middle");
      eq(CNBStaff.lilypondPosition(cfg, 0), -6, "middle C");
      eq(CNBStaff.lilypondPosition(cfg, 11), -0.5, "B, half a position below");
      const twin = twinlineConfig();                  // midpoint G (axis 4), 2 axis units per staff space
      eq(CNBStaff.lilypondPosition(twin, 0), -4, "C at axis 0");
      eq(CNBStaff.lilypondPosition(twin, 1), -4, "C♯ shares C's axis position");
    }},

  { name: "lilypondPositions (axis): the axis formula, collapsed lines deduplicated", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.semitonePattern = [2, 5, 8];
      cfg.staff.midpoint = 7;
      cfg.pitchAxis = {
        enabled: true, kind: "pitch-class-map-v1", octaveStride: 7, axisUnitsPerStaffSpace: 2,
        pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
      };
      eq(JSON.stringify(CNBStaff.lilypondPositions(cfg)), JSON.stringify([-6, -3, -1, 1, 4, 6]), "Twinline (LY spec §5.4b)");
    }},

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

  { name: "staffSpacePx: semitonesPerStaffSpace semitones, or axisUnitsPerStaffSpace axis units under a pitch axis", fn: () => {
      const cfg = CNBConfig.createDefault();
      eq(CNBStaff.staffSpacePx(cfg, CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 })), 64, "4 × 16 px");
      const twin = twinlineConfig();
      eq(CNBStaff.staffSpacePx(twin, CNBGrid.create(twin, { minSemi: 0, maxSemi: 24 })), 32, "2 axis units × 16 px");
      twin.pitchAxis.enabled = false;
      eq(CNBStaff.staffSpacePx(twin, CNBGrid.create(twin, { minSemi: 0, maxSemi: 24 })), 64, "a disabled axis is linear");
    }},

  { name: "render: every line is the engine's, black, solid and 0.1 staff spaces thick; retired line settings are not read", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.lineDefaults = { thicknessPct: 50, style: "dashed", color: "#ff0000" };   // retired (session 34)
      cfg.staff.lineOverrides = { "4": { thicknessPct: 80, color: "#00ff00" } };
      const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
      withSvgStub(svg => {
        const lines = CNBStaff.render(svg, grid, cfg, 100).children;
        eq(lines.length, 4, "line count");
        for (const l of lines) {
          eq(l.getAttribute("stroke"), "#000000", "black");
          eq(l.getAttribute("stroke-width"), String(0.1 * 64), "0.1 staff spaces");
          eq(l.getAttribute("stroke-dasharray"), null, "solid");
        }
      });
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

  { name: "render (axis): a line is 0.1 staff spaces of the axis thick", fn: () => {
      const cfg = twinlineConfig();
      const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 12 });
      withSvgStub(svg => {
        for (const l of CNBStaff.render(svg, grid, cfg, 100).children) {
          eq(l.getAttribute("stroke-width"), String(0.1 * 32), "0.1 × 2 axis units × 16 px");
        }
      });
    }},

  // Engine-backed (session 34): the preview draws staff lines and ledgers at
  // the size the engine engraves them. For one octave-chord card with
  // ledgers, on the default and Kite 4-369 fixtures, crotchet and minim, the
  // engraved staff-line thickness and each ledger's thickness and length,
  // in staff spaces, match the rendered card's (±0.001; one chord per
  // score, since LilyPond shortens neighbouring notes' ledgers). Skips with
  // the reason logged without LilyPond or the engine.
  { name: "lines (engine): staff lines and ledgers engrave at the preview's thickness and length, default and Kite", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const kite = CNBConfigIO.loadFromText(readFileSync(path.join(FIXTURES, "kite-4-369-config.json"), "utf8")).config;
      const failures = [];
      for (const [label, config] of [["default", CNBConfig.createDefault()], ["Kite 4-369", kite]]) {
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const space = CNBStaff.staffSpacePx(config, grid);
        const staffLine = withDomStub(svg => Number(CNBStaff.render(svg, grid, config, 100).children[0].getAttribute("stroke-width"))) / space;
        for (const [duration, token] of [["crotchet", "4"], ["minim", "2"]]) {
          // Card pc 0 draws semitones 0 and 12, the engine's c' and c''.
          const ledger = withDomStub(container => {
            const svg = CNBCard.render(container, grid, config, { pc: 0, duration }).children[1];
            const rect = svg.children.find(c => c.getAttribute("class") === "cnb-ledger-set").children[0];
            return { width: Number(rect.getAttribute("width")) / space, thickness: Number(rect.getAttribute("height")) / space };
          });
          const got = await measureLines(engine, CNBLilypond.generate(config), `<c' c''>${token}`);
          if (got.error) { failures.push(`${label} ${duration}: ${got.error}`); continue; }
          const near = (a, b) => Math.abs(a - b) <= 1e-3;
          if (!near(got.staffLine, staffLine)) failures.push(`${label}: staff line engraved ${got.staffLine}, preview ${staffLine}`);
          if (got.ledgers.length === 0) failures.push(`${label} ${duration}: no ledger engraved`);
          for (const l of got.ledgers) {
            for (const k of ["width", "thickness"]) {
              if (!near(l[k], ledger[k])) failures.push(`${label} ${duration} ledger at ${l.y}: ${k} engraved ${l[k]} staff spaces, preview ${ledger[k]}`);
            }
          }
        }
      }
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    }},

  { name: "render (linear): the same pattern without the axis draws every semitone", fn: () => {
      const cfg = twinlineConfig();
      cfg.pitchAxis.enabled = false;
      const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
      withSvgStub(svg => {
        eq(CNBStaff.render(svg, grid, cfg, 100).children.length, 10, "no dedup on the linear path");
      });
    }},

  // ── Fluid width (session 25, design §6.1) ────────────────────────────

  { name: "render (linear): a numeric width runs each line from 0 to that width", fn: () => {
      const cfg = CNBConfig.createDefault();
      const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
      withSvgStub(svg => {
        const lines = CNBStaff.render(svg, grid, cfg, 640).children;
        eq(lines.length, 4, "line count");
        for (const l of lines) {
          eq(l.getAttribute("x1"), "0", "x1");
          eq(l.getAttribute("x2"), "640", "x2");
        }
      });
    }},

  { name: "render (linear): width \"100%\" runs every line to 100%", fn: () => {
      const cfg = CNBConfig.createDefault();
      const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
      withSvgStub(svg => {
        const lines = CNBStaff.render(svg, grid, cfg, "100%").children;
        eq(lines.length, 4, "line count");
        for (const l of lines) {
          eq(l.getAttribute("x1"), "0", "x1");
          eq(l.getAttribute("x2"), "100%", "x2");
        }
      });
    }},

  { name: "render (axis): width \"100%\" runs every deduplicated line to 100%", fn: () => {
      const cfg = twinlineConfig();
      const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
      withSvgStub(svg => {
        const lines = CNBStaff.render(svg, grid, cfg, "100%").children;
        eq(lines.length, 6, "deduplicated line count");
        for (const l of lines) {
          eq(l.getAttribute("x1"), "0", "x1");
          eq(l.getAttribute("x2"), "100%", "x2");
        }
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
