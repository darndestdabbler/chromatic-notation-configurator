/**
 * cnb-ledger-set-tests.js — Unit tests for Module 5 (Ledger Set)
 *
 * Covers the architecture plan's exhaustive ledger test cases: C, D, E, F,
 * C' under both 4-8 and 3-6-9 patterns, C'', A♯, and octave awareness —
 * plus buildDefs expansion, isBetweenNoteAndStaff, and proximity mode.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBLedgerSet } from "../src/cnb-ledger-set.js";
import { withSvgStub } from "./svg-stub.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eqArr(a, b, msg) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${msg || "eqArr"}: expected ${jb}, got ${ja}`);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

// Default 4-8 system. The staff pattern is periodic; resolve() callers pass
// positions expanded beyond the note range (as render() does), so include
// octave -1 and octave 2 lines.
const STAFF_48 = [-8, -4, 4, 8, 16, 20, 28, 32];

// 3-6-9 system staff, same expansion policy.
const STAFF_369 = [-9, -6, -3, 3, 6, 9, 15, 18, 21, 27, 30, 33];

function config48() {
  return CNBConfig.createDefault();
}

function config369() {
  const cfg = CNBConfig.createDefault();
  cfg.staff.semitonePattern = [3, 6, 9];
  cfg.staff.semitonesPerStaffSpace = 3;
  return cfg;
}

function defs48(range = { minSemi: -4, maxSemi: 28 }) {
  return CNBLedgerSet.buildDefs(config48(), range);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // ── buildDefs ──────────────────────────────────────────────────────────────

  { name: "buildDefs expands default templates across octaves 0–2", fn: () => {
      const defs = CNBLedgerSet.buildDefs(config48(), { minSemi: 0, maxSemi: 26 });
      eqArr(defs.map(d => d.semi), [0, 2, 10, 12, 14, 22, 24, 26], "def positions");
    }},

  { name: "buildDefs drops positions outside the range", fn: () => {
      const defs = CNBLedgerSet.buildDefs(config48(), { minSemi: 0, maxSemi: 20 });
      eqArr(defs.map(d => d.semi), [0, 2, 10, 12, 14], "def positions");
    }},

  { name: "buildDefs handles negative range start", fn: () => {
      const defs = CNBLedgerSet.buildDefs(config48(), { minSemi: -4, maxSemi: 10 });
      // Octave -1 instances at -12, -10, -2 → only -2 is in range.
      eqArr(defs.map(d => d.semi), [-2, 0, 2, 10], "def positions");
    }},

  { name: "buildDefs copies triggerPCs and triggerMode from the template", fn: () => {
      const defs = defs48();
      const def0 = defs.find(d => d.semi === 0);
      eqArr(def0.triggerPCs, [0, 1, 2], "triggerPCs");
      assert(def0.triggerMode === "override", "triggerMode");
    }},

  { name: "buildDefs attaches lineOverrides by semiWithinOctave to every octave instance", fn: () => {
      const cfg = config48();
      cfg.ledgers.lineOverrides = { "0": { color: "#ff0000" } };
      const defs = CNBLedgerSet.buildDefs(cfg, { minSemi: 0, maxSemi: 24 });
      for (const semi of [0, 12, 24]) {
        const d = defs.find(x => x.semi === semi);
        assert(d.overrides.color === "#ff0000", `override attached at ${semi}`);
      }
      const d2 = defs.find(x => x.semi === 2);
      eqArr(Object.keys(d2.overrides), [], "no override at semi 2");
    }},

  { name: "buildDefs drops proximity templates when proximityRule is false", fn: () => {
      const cfg = config48();
      cfg.ledgers.templates = [
        { semiWithinOctave: 0, triggerPCs: [0], triggerMode: "override" },
        { semiWithinOctave: 6, triggerPCs: [], triggerMode: "proximity" },
      ];
      cfg.ledgers.proximityRule = false;
      const defs = CNBLedgerSet.buildDefs(cfg, { minSemi: 0, maxSemi: 11 });
      eqArr(defs.map(d => d.semi), [0], "only override def kept");
    }},

  // ── isBetweenNoteAndStaff ──────────────────────────────────────────────────

  { name: "isBetween: note at ledger, not on a staff line → true", fn: () => {
      assert(CNBLedgerSet.isBetweenNoteAndStaff(0, 0, STAFF_48) === true);
    }},

  { name: "isBetween: note at ledger, on a staff line → false", fn: () => {
      assert(CNBLedgerSet.isBetweenNoteAndStaff(4, 4, STAFF_48) === false);
    }},

  { name: "isBetween: ledger above note needs a staff line above the ledger", fn: () => {
      assert(CNBLedgerSet.isBetweenNoteAndStaff(0, 2, STAFF_48) === true, "staff at 4 above ledger 2");
      assert(CNBLedgerSet.isBetweenNoteAndStaff(33, 34, STAFF_48) === false, "no staff above 34");
    }},

  { name: "isBetween: ledger below note needs a staff line below the ledger", fn: () => {
      assert(CNBLedgerSet.isBetweenNoteAndStaff(22, 21, STAFF_48) === true, "staff at 20 below ledger 21");
      assert(CNBLedgerSet.isBetweenNoteAndStaff(2, 0, [4, 8, 16, 20]) === false, "no staff below 0 in truncated array");
      assert(CNBLedgerSet.isBetweenNoteAndStaff(2, 0, STAFF_48) === true, "periodic staff has -4 below 0");
    }},

  // ── resolve: architecture-plan exhaustive cases (default 4-8 config) ──────

  { name: "C (semi 0): C-ledger shown at semi 0", fn: () => {
      eqArr(CNBLedgerSet.resolve([0], defs48(), STAFF_48), [0]);
    }},

  { name: "D (semi 2): C-ledger (0) and D-ledger (2) both shown", fn: () => {
      eqArr(CNBLedgerSet.resolve([2], defs48(), STAFF_48), [0, 2]);
    }},

  { name: "E (semi 4, on staff line): no ledgers", fn: () => {
      eqArr(CNBLedgerSet.resolve([4], defs48(), STAFF_48), []);
    }},

  { name: "F (semi 5, inside staff): no ledgers", fn: () => {
      eqArr(CNBLedgerSet.resolve([5], defs48(), STAFF_48), []);
    }},

  // C' (semi 12) — the architecture plan's prose for this case says "inside
  // staff, no ledgers" in 4-8, but the default 4-8 config carries the C
  // template (override, PCs 0-2) in every octave, and the plan's own
  // algorithm (and design note: no outside-staff gate) shows the octave
  // instance at 12. The legacy monolith renders it the same way. So: shown
  // with the default templates; hidden only when no template matches.
  { name: "C' (semi 12) in 4-8 with default C template: ledger at 12 shown", fn: () => {
      eqArr(CNBLedgerSet.resolve([12], defs48(), STAFF_48), [12]);
    }},

  { name: "C' (semi 12) in 4-8 with no matching template: no ledgers", fn: () => {
      const cfg = config48();
      cfg.ledgers.templates = [];
      const defs = CNBLedgerSet.buildDefs(cfg, { minSemi: -4, maxSemi: 28 });
      eqArr(CNBLedgerSet.resolve([12], defs, STAFF_48), []);
    }},

  { name: "C' (semi 12) in 3-6-9: ledger triggered in the 9–15 gap (no outside-staff gate)", fn: () => {
      const defs = CNBLedgerSet.buildDefs(config369(), { minSemi: -4, maxSemi: 28 });
      eqArr(CNBLedgerSet.resolve([12], defs, STAFF_369), [12]);
    }},

  { name: "C'' (semi 24): upper C-ledger shown", fn: () => {
      eqArr(CNBLedgerSet.resolve([24], defs48(), STAFF_48), [24]);
    }},

  { name: "A♯ (semi 22): A♯-ledger shown above staff line 20", fn: () => {
      eqArr(CNBLedgerSet.resolve([22], defs48(), STAFF_48), [22]);
    }},

  { name: "octave awareness: lower C ledger (0) NOT triggered by note at 24", fn: () => {
      const result = CNBLedgerSet.resolve([24], defs48(), STAFF_48);
      assert(!result.includes(0), "ledger 0 must not appear");
      assert(!result.includes(12), "ledger 12 must not appear");
      eqArr(result, [24]);
    }},

  { name: "octave chord C+C' (0, 12): each octave's C ledger shown", fn: () => {
      eqArr(CNBLedgerSet.resolve([0, 12], defs48(), STAFF_48), [0, 12]);
    }},

  // ── resolve: proximity mode ────────────────────────────────────────────────

  { name: "proximity: note strictly closer to ledger than to staff → shown", fn: () => {
      // 4-8 staff; proximity def at 0. Note at 1: |1-0|=1 < |1-4|=3.
      const defs = [{ semi: 0, triggerPCs: [], triggerMode: "proximity" }];
      eqArr(CNBLedgerSet.resolve([1], defs, STAFF_48), [0]);
    }},

  { name: "proximity: tie with nearest staff line → not shown", fn: () => {
      // Note at 2: |2-0|=2 is NOT < |2-4|=2.
      const defs = [{ semi: 0, triggerPCs: [], triggerMode: "proximity" }];
      eqArr(CNBLedgerSet.resolve([2], defs, STAFF_48), []);
    }},

  { name: "proximity: note on the ledger itself → shown", fn: () => {
      const defs = [{ semi: 0, triggerPCs: [], triggerMode: "proximity" }];
      eqArr(CNBLedgerSet.resolve([0], defs, STAFF_48), [0]);
    }},

  { name: "proximity is octave-aware too", fn: () => {
      const defs = [{ semi: 0, triggerPCs: [], triggerMode: "proximity" }];
      // Note at 12 is region 1; def at 0 is region 0 → never shown,
      // even though |12-0| is irrelevant here.
      eqArr(CNBLedgerSet.resolve([12], defs, STAFF_48), []);
    }},

  // ── resolve: hygiene ───────────────────────────────────────────────────────

  { name: "resolve de-duplicates a ledger triggered by multiple notes", fn: () => {
      // C (pc 0) and C♯ (pc 1) both trigger the C ledger at 0.
      eqArr(CNBLedgerSet.resolve([0, 1], defs48(), STAFF_48), [0]);
    }},

  { name: "resolve returns sorted positions regardless of note order", fn: () => {
      eqArr(CNBLedgerSet.resolve([22, 0], defs48(), STAFF_48), [0, 22]);
    }},

  { name: "resolve with empty notes returns empty", fn: () => {
      eqArr(CNBLedgerSet.resolve([], defs48(), STAFF_48), []);
    }},

  // ── render (via DOM stub) ──────────────────────────────────────────────────

  { name: "render: appends a group with one rect per resolved ledger", fn: () => {
      withSvgStub(svg => {
        const cfg = config48();
        const grid = CNBGrid.create(cfg, { minSemi: -4, maxSemi: 28 });
        const g = CNBLedgerSet.render(svg, grid, cfg, [2], { centerX: 50 });
        assert(svg.children[0] === g, "group appended to parent");
        assert(g.getAttribute("class") === "cnb-ledger-set", "group class");
        assert(g.children.length === 2, "D shows ledgers at 0 and 2");
        for (const child of g.children) {
          assert(child.tag === "rect", "roundedEnds default renders rects");
        }
      });
    }},

  { name: "render: rects centered on semiToY with pct-derived thickness and centerX", fn: () => {
      withSvgStub(svg => {
        const cfg = config48();
        const grid = CNBGrid.create(cfg, { minSemi: -4, maxSemi: 28 });
        const g = CNBLedgerSet.render(svg, grid, cfg, [0], { centerX: 50, width: 40 });
        assert(g.children.length === 1, "C shows one ledger");
        const rect = g.children[0];
        const thickness = CNBConfig.pctToPx(cfg.ledgers.lineDefaults.thicknessPct, grid.pxPerSemi);
        assert(parseFloat(rect.getAttribute("height")) === thickness, "thickness from pct");
        assert(parseFloat(rect.getAttribute("y")) === grid.semiToY(0) - thickness / 2, "vertically centered on semi 0");
        assert(parseFloat(rect.getAttribute("x")) === 50 - 40 / 2, "horizontally centered on centerX");
        assert(parseFloat(rect.getAttribute("width")) === 40, "explicit width honored");
      });
    }},

  { name: "render: lineOverrides restyle every octave instance of a template", fn: () => {
      withSvgStub(svg => {
        const cfg = config48();
        cfg.ledgers.lineOverrides = { "0": { color: "#ff0000" } };
        const grid = CNBGrid.create(cfg, { minSemi: -4, maxSemi: 28 });
        const g = CNBLedgerSet.render(svg, grid, cfg, [0, 12], { centerX: 50 });
        assert(g.children.length === 2, "ledgers at 0 and 12");
        for (const rect of g.children) {
          assert(rect.getAttribute("fill") === "#ff0000", "override color applied");
        }
      });
    }},

  { name: "render: note on a staff line renders an empty group", fn: () => {
      withSvgStub(svg => {
        const cfg = config48();
        const grid = CNBGrid.create(cfg, { minSemi: -4, maxSemi: 28 });
        const g = CNBLedgerSet.render(svg, grid, cfg, [4], { centerX: 50 });
        assert(g.children.length === 0, "E on staff line: no ledgers");
      });
    }},

  { name: "render: default opts produce a positive width and column-padding centerX", fn: () => {
      withSvgStub(svg => {
        const cfg = config48();
        const grid = CNBGrid.create(cfg, { minSemi: -4, maxSemi: 28 });
        const g = CNBLedgerSet.render(svg, grid, cfg, [0]);
        const rect = g.children[0];
        const width = parseFloat(rect.getAttribute("width"));
        assert(width > 0, "default width computed from first shape");
        const paddingH = cfg.display.column.paddingH;
        const centerX = parseFloat(rect.getAttribute("x")) + width / 2;
        assert(centerX === paddingH + width / 2, "default centerX = paddingH + width/2");
      });
    }},

  { name: "render: grid range cropping does not change decisions (D near range floor)", fn: () => {
      withSvgStub(svg => {
        const cfg = config48();
        // Range starts at 0, so no staff line below semi 0 is visible — the
        // periodic staff expansion inside render() must still show D's C-ledger.
        const grid = CNBGrid.create(cfg, { minSemi: 0, maxSemi: 24 });
        const g = CNBLedgerSet.render(svg, grid, cfg, [2], { centerX: 50 });
        assert(g.children.length === 2, "ledgers at 0 and 2 despite cropped viewport");
      });
    }},

];
