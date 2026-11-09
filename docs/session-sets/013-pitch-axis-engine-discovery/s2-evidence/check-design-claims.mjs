/**
 * check-design-claims.mjs — session 2 evidence script (set 013).
 *
 * Machine-checks the enumerated claims below (groups A–F) from the two
 * design deliverables:
 *   docs/planning/pitch-axis-design.md
 *   docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md
 * The coverage claim is exactly these groups — computed results are
 * recomputed against real modules; numeric SOURCE CITATIONS (values the
 * docs quote from session 1's measurements or the survey) are anchored
 * against their source documents (group F, added in verification round 1).
 *
 * Groups:
 *   A. Linear degeneracy — the axis formula with the identity map reproduces
 *      the REAL exporter's computeStaffLinePositions output for the default
 *      config (imported code, not a re-derivation).
 *   B. Spike reproduction — the axis formula with the session-1 Twinline map
 *      reproduces the spike's staff-line positions '(-3 -1 1 4 6 8) and the
 *      s1-measured notehead staff positions (c'=-4, d'=-3, c''=+3, c'''=+10,
 *      b=-5, g=-7), the shared-pair coincidences, and the stem-flip anchor
 *      (midpoint semi 7 -> staff position 0; f'/f#' -> -1).
 *   C. Octave arithmetic — euclidean pc/octave math used by the compiled
 *      Scheme procedure matches CNBMusic for negative semitones; identity-map
 *      regionOfSemi degenerates to Math.floor(s/12).
 *   D. Cited code quotes — the literal code strings the design cites exist in
 *      the named source files at the named behavior sites.
 *   E. Cited paths — every repo path referenced by the two deliverables
 *      exists; cited anchors/IDs exist in their target docs.
 *   F. Numeric source citations (added in verification round 1) — values
 *      the docs quote from session 1's measurements (+0.85 offset, 26
 *      single-note columns, 35/35 · 7/7 · 30/30 tallies) exist verbatim in
 *      s1-engine-coordination.md; the "9 systems" I2 count is recomputed
 *      from the feasibility matrix's own rows 32–40; the worked-example
 *      map satisfies validation rule PA-8 (global monotonicity).
 *
 * Run from the repo root:  node docs/session-sets/013-pitch-axis-engine-discovery/s2-evidence/check-design-claims.mjs
 * Exit code 0 = all checks pass.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const p = (rel) => resolve(repo, rel);

const { CNBLilypond } = await import(
  new URL("file:///" + p("cnb/src/cnb-lilypond.js").replace(/\\/g, "/")).href
);
const { CNBConfig } = await import(
  new URL("file:///" + p("cnb/src/cnb-config.js").replace(/\\/g, "/")).href
);
const { CNBMusic } = await import(
  new URL("file:///" + p("cnb/src/cnb-music.js").replace(/\\/g, "/")).href
);

let pass = 0, fail = 0;
function check(label, ok, detail = "") {
  if (ok) { pass++; console.log(`PASS  ${label}${detail ? "  [" + detail + "]" : ""}`); }
  else    { fail++; console.log(`FAIL  ${label}${detail ? "  [" + detail + "]" : ""}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── The design's axis formula (design §1.1 / draft §5.4a), as specified ────
function makeAxis({ positions, octaveStride, axisUnitsPerStaffSpace }) {
  const positionOfSemi = (s) => {
    const pc = ((s % 12) + 12) % 12;
    const oct = Math.floor(s / 12);
    return positions[pc] + oct * octaveStride;
  };
  return {
    positionOfSemi,
    regionOfSemi: (s) => Math.floor(positionOfSemi(s) / octaveStride),
    lyPos: (s, midpointSemi) =>
      (2 * (positionOfSemi(s) - positionOfSemi(midpointSemi))) / axisUnitsPerStaffSpace,
  };
}
function axisStaffLinePositions(axis, pattern, midpointSemi) {
  const out = new Set();
  for (const oct of [0, 1]) {
    for (const s of pattern) out.add(axis.lyPos(s + oct * 12, midpointSemi));
  }
  return [...out].sort((a, b) => a - b);
}

console.log("── A. Linear degeneracy against the real exporter ──");
{
  const config = CNBConfig.createDefault(); // 4-8 system, midpoint 12, sps 4
  const real = CNBLilypond.computeStaffLinePositions(config);
  const identity = makeAxis({
    positions: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    octaveStride: 12,
    axisUnitsPerStaffSpace: config.staff.semitonesPerStaffSpace,
  });
  const viaAxis = axisStaffLinePositions(identity, config.staff.semitonePattern, config.staff.midpoint);
  check("A1 real exporter default 4-8 positions", eq(real, [-4, -2, 2, 4]), JSON.stringify(real));
  check("A2 identity-map axis formula == real exporter output", eq(viaAxis, real),
    `axis=${JSON.stringify(viaAxis)}`);
  // identity-map degeneracies (design §2.1)
  let idOk = true, regOk = true;
  for (let s = -13; s <= 25; s++) {
    if (identity.positionOfSemi(s) !== s) idOk = false;
    if (identity.regionOfSemi(s) !== Math.floor(s / 12)) regOk = false;
  }
  check("A3 identity map: positionOfSemi(s) === s for s in [-13,25]", idOk);
  check("A4 identity map: regionOfSemi === floor(s/12) (== CNBMusic.ledgerOctaveRegion)", regOk &&
    [-13, -1, 0, 11, 12, 24].every(s => identity.regionOfSemi(s) === CNBMusic.ledgerOctaveRegion(s)));
}

console.log("── B. Spike reproduction (s1 measured geometry) ──");
{
  // The design/draft worked example: s1's Twinline-like map.
  const twin = makeAxis({
    positions: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6],
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
  });
  const MID = 7; // staff.midpoint (G) -> axis position 4
  check("B1 midpoint semi 7 -> axis position 4", twin.positionOfSemi(7) === 4);
  const lines = axisStaffLinePositions(twin, [2, 5, 8], MID);
  check("B2 staff pattern [2,5,8] -> '(-3 -1 1 4 6 8) (spike's cnb:staff-line-positions)",
    eq(lines, [-3, -1, 1, 4, 6, 8]), JSON.stringify(lines));
  // s1 §3.1 measured notehead staff positions
  const expected = [
    ["c'", 0, -4], ["c#'", 1, -4], ["d'", 2, -3],
    ["c'' (stride)", 12, 3], ["c'''", 24, 10],
    ["b (negative octave)", -1, -5], ["g (negative octave)", -5, -7],
  ];
  for (const [name, semi, want] of expected) {
    const got = twin.lyPos(semi, MID);
    check(`B3 ${name} semi ${semi} -> staff position ${want}`, got === want, `got ${got}`);
  }
  // shared pairs coincide (s1: five shared-position pairs, Δpos = 0)
  const pairs = [[0, 1], [3, 4], [5, 6], [8, 9], [10, 11]];
  check("B4 all five shared pairs coincide (positions equal within pairs)",
    pairs.every(([a, b]) => twin.positionOfSemi(a) === twin.positionOfSemi(b)));
  check("B5 D and G unshared",
    ![0, 3, 5, 8, 10, 1, 4, 6, 9, 11].some(pc => twin.positionOfSemi(pc) === twin.positionOfSemi(2)) &&
    ![0, 3, 5, 8, 10, 1, 4, 6, 9, 11].some(pc => twin.positionOfSemi(pc) === twin.positionOfSemi(7)));
  // stem flip (s1 §3.3): f'/f#' pos -1 (up), g' pos 0 (down)
  check("B6 stem-flip anchor: f'(5) and f#'(6) -> -1; g'(7) -> 0 (midpoint at position 0)",
    twin.lyPos(5, MID) === -1 && twin.lyPos(6, MID) === -1 && twin.lyPos(7, MID) === 0);
}

console.log("── C. Octave arithmetic (compiled-procedure semantics) ──");
{
  // Scheme (modulo s 12) is floored for positive modulus; the JS equivalent
  // is ((s%12)+12)%12 == CNBMusic.pitchClass, and oct = (s - pc)/12 is an
  // exact integer == Math.floor(s/12) == CNBMusic.octave.
  let ok = true;
  for (let s = -25; s <= 25; s++) {
    const pc = ((s % 12) + 12) % 12;
    const oct = (s - pc) / 12;
    if (pc !== CNBMusic.pitchClass(s)) ok = false;
    if (!Number.isInteger(oct) || oct !== Math.floor(s / 12) || oct !== CNBMusic.octave(s)) ok = false;
  }
  check("C1 euclidean pc/oct == CNBMusic.pitchClass/octave, oct exact integer, s in [-25,25]", ok);
  check("C2 (modulo -1 12) semantics: pc(-1)=11, oct(-1)=-1",
    CNBMusic.pitchClass(-1) === 11 && CNBMusic.octave(-1) === -1);
}

console.log("── D. Cited code quotes exist at the cited sites ──");
{
  const quotes = [
    ["cnb/src/cnb-grid.js", "(maxSemi - semi) * pxPerSemi", "literal linear semiToY body (design §1.3/§2.2)"],
    ["cnb/src/cnb-card.js", "offsetPercent: 0", "card hardcodes symmetric zero offset (design §3.3)"],
    ["cnb/src/cnb-stem.js", "avg < staffMidpoint ? \"up\" : \"down\"", "semitone-average stem direction (design §2.3)"],
    ["cnb/src/cnb-ledger-set.js", "Math.abs(noteSemi - ld.semi) < nearestStaff", "strict-< proximity tie rule (design §2.4)"],
    ["cnb/src/cnb-lilypond.js", "x: round4((pt.x || 0) / spsDiv)", "attachment ÷ sps conversion site (draft §4.4a)"],
    ["cnb/src/cnb-lilypond.js", "positions.push(2 * (s + oct * 12 - midpoint) / sps)", "linear staff-line-positions formula (draft §5.4a degeneracy)"],
    ["cnb/src/cnb-lilypond.js", "const absolute = (thicknessPct / 100) * (1 / sps)", "thickness ÷ sps conversion site (draft §5.3a)"],
    ["cnb/src/cnb-music.js", "may need a different definition in some staff configs", "ledgerOctaveRegion variant anticipated (design §2.3)"],
    ["cnb/src/cnb-config.js", "const isPlainObject = v => v !== null", "type-safe validation posture reused (design §1.4)"],
  ];
  for (const [file, needle, why] of quotes) {
    const text = readFileSync(p(file), "utf8");
    check(`D ${file} contains cited quote`, text.includes(needle), why);
  }
}

console.log("── E. Cited paths and anchors resolve ──");
{
  const paths = [
    "docs/planning/pitch-axis-design.md",
    "docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md",
    "docs/planning/pitch-axis-design-consult.md",
    "docs/planning/pitch-axis-design-recommendation.md",
    "docs/session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md",
    "docs/session-sets/013-pitch-axis-engine-discovery/s2-evidence",
    "docs/research/gallery-survey/feasibility-matrix.md",
    "docs/CNB-LY-EXPORT-SPEC-v1_2.md",
    "cnb/src/cnb-grid.js", "cnb/src/cnb-ledger-set.js", "cnb/src/cnb-double-notehead.js",
    "cnb/src/cnb-stem.js", "cnb/src/cnb-card.js", "cnb/src/cnb-collection.js",
    "cnb/src/cnb-key-signature.js", "cnb/src/cnb-music.js", "cnb/src/cnb-config.js",
    "cnb/src/cnb-lilypond.js",
  ];
  for (const rel of paths) check(`E path exists: ${rel}`, existsSync(p(rel)));

  const anchors = [
    ["docs/research/gallery-survey/feasibility-matrix.md", "**I2 — One pitch per vertical grid position.**", "I2 invariant"],
    ["docs/session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md", "E13-2", "engine work item cited"],
    ["docs/session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md", "'(-3 -1 1 4 6 8)", "spike staff-line positions cited"],
    ["docs/session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md", "cnb:keysig-tonic-octave", "engine anchor precedent cited"],
    ["docs/CNB-LY-EXPORT-SPEC-v1_2.md", "1.2.1", "canonical spec version cited by the draft"],
    ["docs/planning/pitch-axis-design-recommendation.md", "xOffsetStaffSpaces", "consult field name"],
    ["docs/planning/pitch-axis-design-recommendation.md", "octaveStride", "consult field name"],
    ["docs/planning/pitch-axis-design-consult.md", "axisUnitsPerStaffSpace", "consult field name"],
  ];
  for (const [file, needle, why] of anchors) {
    const text = readFileSync(p(file), "utf8");
    check(`E anchor in ${file}`, text.includes(needle), why);
  }
}

console.log("── F. Numeric source citations (added in verification round 1) ──");
{
  const s1 = readFileSync(p("docs/session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md"), "utf8");
  // design §3.1 / draft §6.3 example value 0.85 = s1's measured offset
  check("F1 s1 record contains the +0.850 measured head/stem shift (design §3.1 / draft §6.3 example value)",
    s1.includes("+0.850") && s1.includes("0.85"));
  // design §3.3 "all 26 single-note columns"
  check("F2 s1 record contains the 26-single-note-column measurement",
    s1.includes("all 26 single-note columns"));
  // change-log / submission tallies 35/35, 7/7, 30/30
  check("F3 s1 record contains the 35/35 noteheads, 7/7 ledgers, 30/30 stems tallies",
    s1.includes("35/35 noteheads, 7/7 ledgers, 30/30 stems"));
  // "9 systems" / "records 32–40": recompute from the matrix's own rows
  const matrix = readFileSync(p("docs/research/gallery-survey/feasibility-matrix.md"), "utf8");
  const i2Rows = matrix.split("\n").filter(line =>
    /^\|\s*(3[2-9]|40)\s*\|/.test(line) && line.includes("breaks **I2**"));
  check("F4 feasibility-matrix rows 32–40 breaking I2 number exactly 9 ('9 systems' claim)",
    i2Rows.length === 9, `counted ${i2Rows.length}`);
  check("F5 matrix's own tier-4-by-invariant line lists I2 records 32–40 count (9)",
    matrix.includes("(compact): 32–40 (9)"));
  // PA-8 (global monotonicity) holds for the worked-example map
  const pos = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6], stride = 7;
  const nonDecreasing = pos.every((v, i) => i === 0 || v >= pos[i - 1]);
  check("F6 worked-example map satisfies PA-8: non-decreasing in pc order", nonDecreasing);
  check("F7 worked-example map satisfies PA-8: positions[11] <= positions[0] + octaveStride",
    pos[11] <= pos[0] + stride, `${pos[11]} <= ${pos[0] + stride}`);
  // and PA-8's cross-octave guarantee: positionOfSemi globally non-decreasing over a wide range
  const twin = makeAxis({ positions: pos, octaveStride: stride, axisUnitsPerStaffSpace: 2 });
  let global = true;
  for (let s = -24; s < 48; s++) {
    if (twin.positionOfSemi(s + 1) < twin.positionOfSemi(s)) global = false;
  }
  check("F8 PA-8 conditions imply global monotonicity of positionOfSemi over [-24,48]", global);
  // sanity: PA-8 correctly REJECTS a non-monotonic map
  const bad = [0, 2, 1, 3, 3, 4, 4, 5, 5, 6, 6, 6];
  check("F9 PA-8 rejects a non-monotonic map (negative control)",
    !bad.every((v, i) => i === 0 || v >= bad[i - 1]));
}

console.log(`\nTOTAL: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
