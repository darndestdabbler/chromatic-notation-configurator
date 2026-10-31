#!/usr/bin/env node
/**
 * measure.mjs — preview↔engine parity for the pitch-axis round-trip
 * (set 014 session 3).
 *
 * Reads the engine render of twinline-roundtrip-score.ly (harvested JSON +
 * the SVG beside it) and checks it against the PREVIEW's model of the same
 * fixture — CNBPitchAxis, CNBKeySignature and the exported staff — so every
 * expectation is computed by Configurator code, never hand-typed:
 *
 *   1. staff lines: the harvested line count equals the exported
 *      (deduplicated) cnb:staff-line-positions count;
 *   2. noteheads: every head sits at
 *        2 × (positionOfSemi(semi) − positionOfSemi(midpoint)) / axisUnits
 *      half-staff-spaces from the center (tolerance 0.05 — the known +0.01
 *      line-edge harvest artifact fits inside it);
 *   3. shared-position chord pairs coincide vertically, and the x-offset
 *      widens each pair's horizontal separation by the difference of the
 *      members' resolved xOffsetStaffSpaces (tolerance 0.02), measured
 *      against the CONTROL render — the same score over an export without
 *      offsets — because LilyPond already separates a shared-position pair
 *      on its own (engine set 008 s2 test-vs-control method);
 *   4. single-note stems point up below the midpoint and down at/above it
 *      (the preview's stem rule, CNBStem.direction);
 *   5. key-signature marks (\key g \major) land at the positions of the
 *      preview's CNBKeySignature.signatureSemis for that key (tolerance
 *      0.15, the bbox-centre instrument of engine set 008 s3).
 *
 * Ledger lines are reported, not asserted: the engine draws its own ledgers
 * (the exporter emits no ledger rules), and the in-gap ledger divergence is
 * a documented parity limit (pitch-axis design §2.4).
 *
 * Usage: node measure.mjs <harvested.json> [<render.svg>] [<control.harvested.json>]
 * (the SVG and the control default to the files beside the harvest).
 * Exits 0 only when every check passes.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..", "..");
const FIXTURE = path.join(REPO, "cnb", "assets", "examples", "gallery", "twinline-compact.json");
const imp = (p) => import(pathToFileURL(path.join(REPO, p)));

const { CNBConfigIO } = await imp("cnb/ui/config-io.js");
const { CNBConfig } = await imp("cnb/src/cnb-config.js");
const { CNBPitchAxis } = await imp("cnb/src/cnb-pitch-axis.js");
const { CNBLilypond } = await imp("cnb/src/cnb-lilypond.js");
const { CNBKeySignature } = await imp("cnb/src/cnb-key-signature.js");

const harvestedPath = process.argv[2];
if (!harvestedPath) {
  console.error("usage: node measure.mjs <harvested.json> [<render.svg>]");
  process.exit(2);
}
const svgPath = process.argv[3] || harvestedPath.replace(/\.harvested\.json$/, ".svg");
const controlPath = process.argv[4]
  || harvestedPath.replace(/\.harvested\.json$/, "-control.harvested.json");
const d = JSON.parse(readFileSync(harvestedPath, "utf8"));
const svg = readFileSync(svgPath, "utf8");
const ctrl = JSON.parse(readFileSync(controlPath, "utf8"));

// ── The preview's model of the fixture ──────────────────────────────────────
const { config } = CNBConfigIO.loadFromText(readFileSync(FIXTURE, "utf8"));
const axis = CNBPitchAxis.create(config);
if (!axis.enabled) throw new Error("fixture has no enabled pitch axis");
const midpoint = config.staff.midpoint;
const anchor = axis.positionOfSemi(midpoint);
const expectedPos = (semi) => 2 * (axis.positionOfSemi(semi) - anchor) / axis.unitsPerStaffSpace;
const staffPositions = CNBLilypond.computeStaffLinePositions(config);
const TOP_POS = Math.max(...staffPositions);
const BOTTOM_POS = Math.min(...staffPositions);
const xOffsetOf = (semi) =>
  CNBConfig.resolveNotehead(config, ((semi % 12) + 12) % 12, "crotchet", null).xOffsetStaffSpaces || 0;

// ── Engine geometry ─────────────────────────────────────────────────────────
const staff = d.staff;
const halfSpace = (staff.bottom_line_y - staff.top_line_y) / (TOP_POS - BOTTOM_POS);
const staffSpace = 2 * halfSpace;
const yToPos = (y) => TOP_POS - (y - staff.top_line_y) / halfSpace;
const fmt = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); return ok; };

// 1. Staff lines.
console.log(`staff: top_y=${staff.top_line_y} bottom_y=${staff.bottom_line_y} ` +
  `lines=${staff.line_count} (exported '(${staffPositions.join(" ")}))`);
check(staff.line_count === staffPositions.length,
  `staff line count ${staff.line_count} != exported ${staffPositions.length}`);

// 2. Noteheads.
const heads = d.elements.filter(e => e.type === "notehead");
const stems = d.elements.filter(e => e.type === "stem");
const at = (e) => `${e.data.measure}@${e.data.beat}`;
const columns = new Map();
for (const h of heads) {
  if (!columns.has(at(h))) columns.set(at(h), []);
  columns.get(at(h)).push(h);
}
console.log(`\nnoteheads: ${heads.length}`);
console.log(`${"column".padEnd(10)} ${"semi".padStart(4)} ${"exp".padStart(6)} ${"meas".padStart(8)} ${"delta".padStart(7)}`);
let headFails = 0;
for (const h of heads.slice().sort((a, b) => Number(a.data.measure) - Number(b.data.measure)
    || a.data.beat - b.data.beat || a.data.midi - b.data.midi)) {
  const semi = Number(h.data.midi) - 60;
  const exp = expectedPos(semi);
  const meas = yToPos(h.absolute.y);
  const ok = Math.abs(meas - exp) < 0.05;
  if (!ok) headFails++;
  console.log(`${at(h).padEnd(10)} ${String(semi).padStart(4)} ${fmt(exp).padStart(6)} ` +
    `${fmt(meas).padStart(8)} ${fmt(meas - exp).padStart(7)}${ok ? "" : "  <-- MISMATCH"}`);
}
check(heads.length === 37, `expected 37 noteheads (25 single + 6 pairs), harvested ${heads.length}`);
check(headFails === 0, `${headFails} notehead(s) off the preview's axis position`);

// 3. Shared-position chord pairs: separation in the test render minus the
// separation of the same pair in the control render.
const ctrlHead = new Map(ctrl.elements.filter(e => e.type === "notehead").map(e => [e.id, e]));
const ctrlSpace = (ctrl.staff.bottom_line_y - ctrl.staff.top_line_y) / (TOP_POS - BOTTOM_POS) * 2;
console.log("\nchord pairs (dpos must be 0; effect = dx(test) − dx(control), staff spaces):");
let pairs = 0;
for (const [key, mates] of columns) {
  if (mates.length !== 2) continue;
  pairs++;
  const [lo, hi] = mates.slice().sort((a, b) => a.data.midi - b.data.midi);
  const [cLo, cHi] = [ctrlHead.get(lo.id), ctrlHead.get(hi.id)];
  if (!check(cLo && cHi, `chord ${key}: missing from the control render`)) continue;
  const dpos = yToPos(hi.absolute.y) - yToPos(lo.absolute.y);
  const dx = (hi.absolute.x - lo.absolute.x) / staffSpace;
  const dxCtrl = (cHi.absolute.x - cLo.absolute.x) / ctrlSpace;
  const expEffect = xOffsetOf(hi.data.midi - 60) - xOffsetOf(lo.data.midi - 60);
  const ok = Math.abs(dpos) < 0.01 && Math.abs(dx - dxCtrl - expEffect) < 0.02;
  check(ok, `chord ${key}: dpos=${fmt(dpos)} effect=${fmt(dx - dxCtrl)}, expected dpos 0 effect ${fmt(expEffect)}`);
  console.log(`  ${key.padEnd(8)} midi ${lo.data.midi}/${hi.data.midi}: dpos=${fmt(dpos)} ` +
    `dx=${fmt(dx)} control=${fmt(dxCtrl)} effect=${fmt(dx - dxCtrl)} expected ${fmt(expEffect)}` +
    (ok ? "" : "  <-- MISMATCH"));
}
check(pairs === 6, `expected 6 chord pairs, found ${pairs}`);

// 4. Single-note stem directions.
let dirFails = 0;
for (const s of stems) {
  const mates = columns.get(at(s)) || [];
  if (mates.length !== 1) continue;
  const bb = s.visual.bbox;
  const head = yToPos(mates[0].absolute.y);
  const up = (yToPos(bb.y) - head) > (head - yToPos(bb.y + bb.h));
  const expectUp = axis.positionOfSemi(mates[0].data.midi - 60) < anchor;
  if (up !== expectUp) dirFails++;
}
console.log(`\nsingle-note stems: ${dirFails === 0 ? "all" : "NOT all"} flip at the midpoint ` +
  `(${stems.length} stems harvested)`);
check(dirFails === 0, `${dirFails} single-note stem direction mismatch(es)`);

// 5. Key-signature marks: translate() groups drawing a <path> inside ks-1.
// The engine draws each mark twice (ledgers, then the heads again on top —
// keysig.ly's two-pass layering), so identical translates count once.
const ksStart = svg.indexOf('<g id="ks-1"');
const ksEnd = svg.indexOf('<g id="', ksStart + 1);
const ksBlock = ksStart < 0 ? "" : svg.slice(ksStart, ksEnd < 0 ? undefined : ksEnd);
const markTranslates = new Set(
  [...ksBlock.matchAll(/translate\(([-\d.]+), ([-\d.]+)\)">\s*<path/g)].map(m => `${m[1]},${m[2]}`));
const markYs = [...markTranslates].map(t => Number(t.split(",")[1]));
const keyConfig = CNBConfig.clone(config);
keyConfig.keys.enabled = true;
keyConfig.keys.definitions = [{ name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11], tonicPc: 7 }];
keyConfig.keys.keySignature.enabled = true;
const keySemis = CNBKeySignature.signatureSemis(keyConfig, "G");
const markPos = markYs.map(yToPos).sort((a, b) => a - b);
const expMarks = keySemis.map(expectedPos).sort((a, b) => a - b);
console.log(`\nkey signature (G major, exported cnb:keysig-tonic-octave): ` +
  `preview semis [${keySemis.join(" ")}]`);
console.log(`  expected positions [${expMarks.map(fmt).join(" ")}]`);
console.log(`  measured positions [${markPos.map(fmt).join(" ")}]`);
check(markPos.length === expMarks.length,
  `keysig mark count ${markPos.length} != preview ${expMarks.length}`);
check(markPos.every((p, i) => Math.abs(p - expMarks[i]) < 0.15),
  "keysig marks off the preview's signature positions");

// Ledgers — reported only (design §2.4 parity limit; engine-owned ledgers).
const ledgers = d.elements.filter(e => e.type === "ledger-line");
console.log(`\nledger-line grobs: ${ledgers.length} (report only — design §2.4)`);

console.log();
if (failures.length) {
  console.log("PARITY: FAIL");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("PARITY: PASS — the engine places noteheads, chord offsets, stems and " +
  "key-signature marks where the preview does");
