/**
 * cnb-pitch-axis-tests.js — Unit tests for Module 24 (Pitch Axis), set 014
 *
 * Covers: linear degeneracy (absent/disabled/inactive sections — exact
 * identity, the design §1.2 machine-checked anchor #1), the design §1.1
 * Twinline-like map (positionOfSemi across octaves incl. negatives,
 * fractional interpolation), the 013 spike-geometry reproduction
 * (machine-checked anchor #2: staff `'(-3 -1 1 4 6 8)`, middle C → −4),
 * non-uniform 1:1 maps, many-to-one candidate inverses, activation-gate
 * rejection of structurally unsound sections (the render-time mirror of
 * PA-1…PA-4/PA-8), and the byte-identity pins: the grid's disabled path
 * against the pre-change baseline fixture (cnb/fixtures/grid-baseline.json,
 * captured at 2cf7d647) and the exporter's blindness to a disabled
 * pitchAxis section (default-export-baseline.ly).
 *
 * The pitchAxis SECTION tests (validation PA-1…PA-8 / PA-W1/W3/W4,
 * resolveNotehead xOffsetStaffSpaces) live in cnb-config-tests.js — they
 * are Module A behavior. Grid axis-context tests live in
 * cnb-grid-tests.js — they are Module 1 behavior.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CNBConfig } from "../src/cnb-config.js";
import { CNBMusic } from "../src/cnb-music.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { withSvgStub } from "./svg-stub.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRID_BASELINE_PATH = path.join(__dirname, "..", "fixtures", "grid-baseline.json");
const LY_BASELINE_PATH = path.join(__dirname, "..", "fixtures", "default-export-baseline.ly");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function deepEq(a, b, msg) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${msg || "deepEq"}: expected ${y}, got ${x}`);
}

function approx(a, b, msg, tol = 1e-9) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
}

/** Normalize an export for comparison: date line + line endings. */
function normalizeLy(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
}

// ── Map fixtures ─────────────────────────────────────────────────────────────

/** The design §1.1 Twinline-like map: five shared-position pairs
 *  (C,C♯) (D♯,E) (F,F♯) (G♯,A) (A♯,B); D and G unshared. */
const TWINLINE_POSITIONS = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

function pitchClassesFrom(positions) {
  return positions.map((position, pc) => ({ pc, position }));
}

/** Default config with an enabled Twinline-like pitch axis (design §1.1). */
function twinlineConfig(overrides = {}) {
  const config = CNBConfig.createDefault();
  config.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: pitchClassesFrom(TWINLINE_POSITIONS),
    ...overrides,
  };
  return config;
}

/** Explicit identity axis: the design §1.2 degeneracy-check geometry. */
function identityAxisConfig() {
  const config = CNBConfig.createDefault();
  config.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 12,
    axisUnitsPerStaffSpace: config.staff.semitonesPerStaffSpace,
    pitchClasses: pitchClassesFrom([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  };
  return config;
}

// ── Grid-baseline probe (duplicated from the session evidence script
//    docs/session-sets/014-pitch-axis-implementation/s1-evidence/
//    make-grid-baseline.mjs, which captured the fixture at 2cf7d647,
//    BEFORE the set-014 grid changes) ─────────────────────────────────────────

function serializeEl(el) {
  const out = { tag: el.tag, attrs: {} };
  for (const k of Object.keys(el.attrs).sort()) out.attrs[k] = el.attrs[k];
  if (el.textContent !== undefined) out.text = String(el.textContent);
  out.children = (el.children || []).map(serializeEl);
  return out;
}

function probeGrid(range, pxPerSemi) {
  const config = CNBConfig.createDefault();
  if (pxPerSemi !== null) config.display.pxPerSemi = pxPerSemi;
  const grid = CNBGrid.create(config, range);

  const context = {
    pxPerSemi: grid.pxPerSemi,
    minSemi: grid.minSemi,
    maxSemi: grid.maxSemi,
    totalSemiRange: grid.totalSemiRange,
    svgHeight: grid.svgHeight,
    topLabelHeight: grid.topLabelHeight,
    bottomLabelHeight: grid.bottomLabelHeight,
    totalHeight: grid.totalHeight,
    hasYToSemi: typeof grid.yToSemi === "function",
    axisProperty: Object.prototype.hasOwnProperty.call(grid, "axis") ? "present" : "absent",
  };

  const semiToY = {};
  for (let s = range.minSemi; s <= range.maxSemi; s++) {
    semiToY[String(s)] = grid.semiToY(s);
    if (s < range.maxSemi) semiToY[String(s) + ".5"] = grid.semiToY(s + 0.5);
  }
  for (const f of [22.784, 7.25]) {
    if (f >= range.minSemi && f <= range.maxSemi) semiToY[String(f)] = grid.semiToY(f);
  }

  const yToSemi = {};
  for (const y of [0, grid.svgHeight / 2, grid.svgHeight, 7.3]) {
    yToSemi[String(y)] = grid.yToSemi(y);
  }

  const staffPositions = CNBStaff.getPositions(config, range);
  const overlay = withSvgStub(svg => {
    svg.setAttribute("width", "400");
    CNBGrid.renderDebugOverlay(svg, grid, staffPositions);
    return serializeEl(svg);
  });

  return { range, pxPerSemiOverride: pxPerSemi, context, semiToY, yToSemi, staffPositions, debugOverlay: overlay };
}

export const tests = [

  // ── Byte-identity pins (spec binding rule 2) ────────────────────────────

  { name: "grid invariance: the axis-disabled grid path is byte-identical to the pre-change baseline (context, semiToY, yToSemi, debug overlay)", fn: () => {
    const baseline = fs.readFileSync(GRID_BASELINE_PATH, "utf8").replace(/\r\n/g, "\n");
    const current = {
      description: "Pre-change CNBGrid baseline for axis-disabled configs (captured at 2cf7d647, before set-014 s1 grid changes)",
      probes: [
        probeGrid({ minSemi: 0, maxSemi: 24 }, null),
        probeGrid({ minSemi: -4, maxSemi: 28 }, null),
        probeGrid({ minSemi: 3, maxSemi: 21 }, null),
        probeGrid({ minSemi: 0, maxSemi: 24 }, 20),
      ],
    };
    eq(JSON.stringify(current, null, 2) + "\n", baseline,
      "disabled grid output unchanged by the set-014 axis path");
  }},

  { name: "export invariance: a config with a DISABLED pitchAxis section exports byte-identically to the pre-change default baseline", fn: () => {
    const config = twinlineConfig({ enabled: false });
    const baseline = normalizeLy(fs.readFileSync(LY_BASELINE_PATH, "utf8"));
    eq(normalizeLy(CNBLilypond.generate(config)), baseline,
      "exporter is blind to a disabled pitchAxis section (emission lands in session 3, axis-gated)");
  }},

  // ── Linear degeneracy (design §2.1 / machine-checked anchor #1) ─────────

  { name: "degeneracy: absent section → inactive axis with the exact identity map", fn: () => {
    const axis = CNBPitchAxis.create(CNBConfig.createDefault());
    eq(axis.enabled, false, "enabled");
    eq(axis.octaveStride, 12, "stride");
    eq(axis.unitsPerStaffSpace, 4, "unitsPerStaffSpace = staff.semitonesPerStaffSpace");
    for (const s of [-13, -1, 0, 1, 7, 11, 12, 24, 0.5, 7.25, -0.5, 22.784]) {
      eq(axis.positionOfSemi(s), s, `positionOfSemi(${s}) exact identity`);
    }
  }},

  { name: "degeneracy: enabled:false section → inactive axis", fn: () => {
    const axis = CNBPitchAxis.create(twinlineConfig({ enabled: false }));
    eq(axis.enabled, false, "enabled");
    eq(axis.positionOfSemi(13), 13, "identity");
  }},

  { name: "degeneracy: regionOfSemi matches CNBMusic.ledgerOctaveRegion on the inactive axis", fn: () => {
    const axis = CNBPitchAxis.create(CNBConfig.createDefault());
    for (const s of [-13, -1, 0, 5, 11, 12, 23, 24, 25]) {
      eq(axis.regionOfSemi(s), CNBMusic.ledgerOctaveRegion(s), `regionOfSemi(${s})`);
    }
  }},

  { name: "degeneracy: distance is |a − b| on the inactive axis", fn: () => {
    const axis = CNBPitchAxis.create(CNBConfig.createDefault());
    eq(axis.distance(3, 10), 7, "3↔10");
    eq(axis.distance(10, 3), 7, "10↔3");
    eq(axis.distance(-2, 2), 4, "-2↔2");
    eq(axis.distance(5, 5), 0, "5↔5");
  }},

  { name: "degeneracy: semisAtPosition(p) → [p] for integer p in range, [] otherwise", fn: () => {
    const axis = CNBPitchAxis.create(CNBConfig.createDefault());
    const range = { minSemi: 0, maxSemi: 24 };
    deepEq(axis.semisAtPosition(7, range), [7], "integer in range");
    deepEq(axis.semisAtPosition(0, range), [0], "lower bound");
    deepEq(axis.semisAtPosition(24, range), [24], "upper bound");
    deepEq(axis.semisAtPosition(7.5, range), [], "non-integer position");
    deepEq(axis.semisAtPosition(25, range), [], "outside range");
    deepEq(axis.semisAtPosition(-1, range), [], "below range");
  }},

  { name: "degeneracy: an explicit ENABLED identity axis reproduces positionOfSemi(s) === s (design §1.2 degeneracy check)", fn: () => {
    const axis = CNBPitchAxis.create(identityAxisConfig());
    eq(axis.enabled, true, "identity axis is active");
    eq(axis.octaveStride, 12, "stride");
    eq(axis.unitsPerStaffSpace, 4, "units = sps");
    for (const s of [-13, -1, 0, 1, 7, 11, 12, 24, 0.5, 7.25]) {
      eq(axis.positionOfSemi(s), s, `positionOfSemi(${s})`);
    }
    for (const s of [-1, 0, 11, 12, 24]) {
      eq(axis.regionOfSemi(s), CNBMusic.ledgerOctaveRegion(s), `regionOfSemi(${s})`);
    }
    deepEq(axis.semisAtPosition(7, { minSemi: 0, maxSemi: 24 }), [7], "1:1 inverse");
  }},

  // ── Activation gate (render-time mirror of PA-1…PA-4/PA-8) ─────────────

  { name: "activation: unknown kind is treated as inactive (set-010 vocabulary posture)", fn: () => {
    const axis = CNBPitchAxis.create(twinlineConfig({ kind: "pitch-class-map-v2" }));
    eq(axis.enabled, false, "unknown kind inactive");
    eq(axis.positionOfSemi(1), 1, "identity fallback");
  }},

  { name: "activation: structurally unsound maps are treated as inactive", fn: () => {
    const cases = {
      "11 entries": { pitchClasses: pitchClassesFrom(TWINLINE_POSITIONS).slice(0, 11) },
      "duplicate pc": { pitchClasses: [...pitchClassesFrom(TWINLINE_POSITIONS).slice(0, 11), { pc: 0, position: 6 }] },
      "non-finite position": { pitchClasses: pitchClassesFrom([0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, NaN]) },
      "non-object entry": { pitchClasses: [...pitchClassesFrom(TWINLINE_POSITIONS).slice(0, 11), 6] },
      "stride 0": { octaveStride: 0 },
      "negative stride": { octaveStride: -7 },
      "non-numeric units": { axisUnitsPerStaffSpace: "2" },
      "non-monotonic map (PA-8)": { pitchClasses: pitchClassesFrom([0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 5]) },
      "cross-octave violation (PA-8)": { pitchClasses: pitchClassesFrom([0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7.5]) },
    };
    for (const [label, overrides] of Object.entries(cases)) {
      const axis = CNBPitchAxis.create(twinlineConfig(overrides));
      eq(axis.enabled, false, `${label} → inactive`);
      eq(axis.positionOfSemi(13), 13, `${label} → identity fallback`);
    }
  }},

  // ── Twinline map: positionOfSemi (design §1.1) ──────────────────────────

  { name: "twinline: positionOfSemi implements map[pc] + octave × stride, negative octaves included (013 spike §3.1)", fn: () => {
    const axis = CNBPitchAxis.create(twinlineConfig());
    eq(axis.enabled, true, "active");
    eq(axis.octaveStride, 7, "stride");
    eq(axis.unitsPerStaffSpace, 2, "unit contract");
    // Octave 0: the declared map
    for (let pc = 0; pc < 12; pc++) {
      eq(axis.positionOfSemi(pc), TWINLINE_POSITIONS[pc], `pc ${pc}`);
    }
    // Octave 1 and 2: + stride per octave
    eq(axis.positionOfSemi(12), 7, "semi 12 (C')");
    eq(axis.positionOfSemi(13), 7, "semi 13 (C♯') shares C''s position");
    eq(axis.positionOfSemi(24), 14, "semi 24 (C'')");
    eq(axis.positionOfSemi(19), 11, "semi 19 (G') = 4 + 7");
    // Negative octave: b at semi −1 → −1×7 + 6 = −1 (the spike's measured case)
    eq(axis.positionOfSemi(-1), -1, "semi -1 (B below C) → -1");
    eq(axis.positionOfSemi(-12), -7, "semi -12 (C below) → -7");
    eq(axis.positionOfSemi(-11), -7, "semi -11 (C♯ below) shares it");
  }},

  { name: "twinline: fractional semitones interpolate linearly; shared pairs are flat", fn: () => {
    const axis = CNBPitchAxis.create(twinlineConfig());
    eq(axis.positionOfSemi(0.5), 0, "0.5 flat across the (C,C♯) pair");
    eq(axis.positionOfSemi(1.5), 0.5, "1.5 between pos 0 and 1");
    eq(axis.positionOfSemi(2.25), 1.25, "2.25 between pos 1 and 2");
    eq(axis.positionOfSemi(11.5), 6.5, "11.5 between pos 6 (B) and 7 (C')");
    eq(axis.positionOfSemi(-0.5), -0.5, "-0.5 between pos -1 (B) and 0 (C)");
    eq(axis.positionOfSemi(22.784), 13, "22.784 flat across the (A♯',B') pair");
  }},

  { name: "twinline: regionOfSemi = floor(position / stride)", fn: () => {
    const axis = CNBPitchAxis.create(twinlineConfig());
    eq(axis.regionOfSemi(0), 0, "semi 0");
    eq(axis.regionOfSemi(11), 0, "semi 11");
    eq(axis.regionOfSemi(12), 1, "semi 12");
    eq(axis.regionOfSemi(23), 1, "semi 23");
    eq(axis.regionOfSemi(24), 2, "semi 24");
    eq(axis.regionOfSemi(-1), -1, "semi -1");
    eq(axis.regionOfSemi(-12), -1, "semi -12");
  }},

  { name: "twinline: distance is measured in axis units, not semitones", fn: () => {
    const axis = CNBPitchAxis.create(twinlineConfig());
    eq(axis.distance(0, 1), 0, "shared pair distance 0");
    eq(axis.distance(0, 2), 1, "C to D");
    eq(axis.distance(0, 12), 7, "one octave = stride");
    eq(axis.distance(4, 3), 0, "E to D♯ shared");
    eq(axis.distance(11, 12), 1, "B to C' adjacent positions");
  }},

  // ── Many-to-one candidate inverses ──────────────────────────────────────

  { name: "twinline: semisAtPosition returns candidate arrays (2 on shared positions, 1 on unshared, 0 when undeclared)", fn: () => {
    const axis = CNBPitchAxis.create(twinlineConfig());
    const range = { minSemi: 0, maxSemi: 24 };
    deepEq(axis.semisAtPosition(0, range), [0, 1], "shared pair (C,C♯)");
    deepEq(axis.semisAtPosition(7, range), [12, 13], "shared pair next octave");
    deepEq(axis.semisAtPosition(1, range), [2], "unshared D");
    deepEq(axis.semisAtPosition(4, range), [7], "unshared G");
    deepEq(axis.semisAtPosition(14, range), [24], "range end (C'')");
    deepEq(axis.semisAtPosition(0.5, range), [], "undeclared fractional position");
    deepEq(axis.semisAtPosition(15, range), [], "beyond range");
    deepEq(axis.semisAtPosition(0, { minSemi: 1, maxSemi: 24 }), [1], "range clips candidates");
  }},

  { name: "non-uniform 1:1 map: fractional declared positions place and invert exactly", fn: () => {
    const positions = [0, 0.5, 1.5, 2, 3, 3.5, 4.5, 5, 6, 6.5, 7.5, 8];
    const axis = CNBPitchAxis.create(twinlineConfig({
      octaveStride: 9,
      pitchClasses: pitchClassesFrom(positions),
    }));
    eq(axis.enabled, true, "active");
    for (let pc = 0; pc < 12; pc++) {
      eq(axis.positionOfSemi(pc), positions[pc], `pc ${pc}`);
    }
    eq(axis.positionOfSemi(13), 9.5, "pc 1 next octave: 0.5 + 9");
    const range = { minSemi: 0, maxSemi: 24 };
    deepEq(axis.semisAtPosition(0.5, range), [1], "fractional declared position inverts");
    deepEq(axis.semisAtPosition(6.5, range), [9], "1:1 single candidate");
    deepEq(axis.semisAtPosition(1, range), [], "undeclared integer position");
    // Every pc inverts to exactly itself (1:1)
    for (let pc = 0; pc < 12; pc++) {
      deepEq(axis.semisAtPosition(positions[pc], { minSemi: 0, maxSemi: 11 }), [pc], `inverse of pc ${pc}`);
    }
  }},

  { name: "boundary-equality map (PA-8 boundary, legal): candidate arrays can carry 3+ entries — pc 11 joins the next octave's shared pair", fn: () => {
    // positions[11] === positions[0] + octaveStride: B sits exactly one
    // stride above C, i.e. ON the next octave's (C,C♯) shared position.
    // PA-8 admits this (boundary equality is legal, pinned in the config
    // tests); the inverse at that position has THREE candidates, so the
    // candidate contract is "arrays of any length", not capped at 2.
    const positions = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7];
    const config = twinlineConfig({ pitchClasses: pitchClassesFrom(positions) });
    const axis = CNBPitchAxis.create(config);
    eq(axis.enabled, true, "boundary-equality map is legal and active");
    eq(axis.positionOfSemi(11), 7, "B → position 7");
    eq(axis.positionOfSemi(12), 7, "C' → position 7");
    eq(axis.positionOfSemi(13), 7, "C♯' → position 7");
    const range = { minSemi: 0, maxSemi: 24 };
    deepEq(axis.semisAtPosition(7, range), [11, 12, 13], "three candidates at one position");
    deepEq(axis.semisAtPosition(14, range), [23, 24], "B' joins C'' at the range end (C♯'' is out of range)");
    // Hit-testing surfaces the full trio too:
    const grid = CNBGrid.create(config, range);
    deepEq(grid.axis.nearestSemisForY(grid.semiToY(12), grid), [11, 12, 13], "nearestSemisForY returns all three");
  }},

  { name: "twinline: nearestSemisForY snaps to the nearest declared position (ties resolve upward)", fn: () => {
    const config = twinlineConfig();
    const grid = CNBGrid.create(config, { minSemi: 0, maxSemi: 24 });
    const px = grid.pxPerSemi;
    // Exactly on the shared (C,C♯) line
    deepEq(grid.axis.nearestSemisForY(grid.semiToY(0), grid), [0, 1], "exact shared line");
    // Exactly on unshared D
    deepEq(grid.axis.nearestSemisForY(grid.semiToY(2), grid), [2], "exact unshared line");
    // Slightly above position 0 (toward position 1): still nearest 0
    deepEq(grid.axis.nearestSemisForY(grid.semiToY(0) - 0.25 * px, grid), [0, 1], "near miss keeps pair");
    // Exactly between positions 0 and 1 → tie resolves upward to position 1 (D)
    deepEq(grid.axis.nearestSemisForY(grid.semiToY(0) - 0.5 * px, grid), [2], "tie resolves upward");
  }},

  // ── The 013 spike geometry (machine-checked anchor #2) ──────────────────

  { name: "spike reproduction: staff [2,5,8] · midpoint 7 · stride 7 · units 2 → LY positions (-3 -1 1 4 6 8), middle C → -4, midpoint → 0", fn: () => {
    const config = twinlineConfig();
    config.staff.semitonePattern = [2, 5, 8];
    config.staff.midpoint = 7;
    const axis = CNBPitchAxis.create(config);
    const units = axis.unitsPerStaffSpace;
    const anchor = axis.positionOfSemi(config.staff.midpoint);
    eq(anchor, 4, "midpoint G → axis position 4");

    // Expanded staff semitones over the two-octave card range (design §1.2):
    const staffSemis = [2, 5, 8, 14, 17, 20];
    const lyPositions = staffSemis.map(s => 2 * (axis.positionOfSemi(s) - anchor) / units);
    deepEq(lyPositions, [-3, -1, 1, 4, 6, 8], "the spike's cnb:staff-line-positions");

    // Middle C (semitone 0) lands at the spike's measured ANCHOR, −4:
    eq(2 * (axis.positionOfSemi(0) - anchor) / units, -4, "middle C → LY position -4");
    // The midpoint lands at LY position 0 — the stem flip the engine showed:
    eq(2 * (axis.positionOfSemi(7) - anchor) / units, 0, "midpoint → LY position 0");
  }},

];
