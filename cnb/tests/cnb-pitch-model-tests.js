/**
 * cnb-pitch-model-tests.js — Unit tests for pitch, nudges and staff spacing
 * (session 24, design docs/planning/notehead-first-editor-design.md §3, §4)
 *
 * Covers shiftPitch (the staff stays, the labels move), readNudges (linear,
 * Twinline's §3.3 table and §3.4 spacing, the ±1 test of §3.5, nudges read
 * relative to C),
 * writeNudges (stride-12 form, the section removed at all zeros, a decimal
 * spacing), nudgeLimits (no reordering, the wrap at B and C), renameDelta
 * and renameNotehead (every spot keeps its look and nudge), and an engine
 * render of Twinline in nudge form against the stride-7 fixture.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBPitchModel as P } from "../ui/pitch-model.js";
import { CNBNoteheadInference } from "../ui/notehead-inference.js";
import { CNBStaffRuleEditor } from "../ui/staff-rule-editor.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { findEngine, measureStaffPositions } from "./engine-probe.js";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function deepEq(a, b, msg) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${msg || "deepEq"}: expected ${jb}, got ${ja}`);
}

function near(a, b, tol, msg) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg || "near"}: expected ${b} ± ${tol}, got ${a}`);
}

function fixture(name) {
  return JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", name), "utf8"));
}

function twinline() {
  const file = path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json");
  return CNBConfigIO.loadFromText(readFileSync(file, "utf8")).config;
}

const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
const mod12 = (x) => ((x % 12) + 12) % 12;
const sortNum = (xs) => xs.slice().sort((a, b) => a - b);

/** The exported staff-line positions, folded into one period of the staff. */
function foldedLines(config) {
  const axis = CNBPitchAxis.create(config);
  const period = 2 * axis.octaveStride / axis.unitsPerStaffSpace;
  const fold = (x) => Math.round((((x % period) + period) % period) * 1e3) / 1e3;
  return sortNum([...new Set(CNBLilypond.computeStaffLinePositions(config).map(fold))]);
}

/** Every semitone's axis position relative to the middle of the staff, in staff spaces. */
function picture(config, semis) {
  const axis = CNBPitchAxis.create(config);
  const mid = axis.positionOfSemi(config.staff.midpoint);
  return semis.map(s => (axis.positionOfSemi(s) - mid) / axis.unitsPerStaffSpace);
}

const RANGE = [...Array(36).keys()].map(s => s - 6);
const ZEROS = Array(12).fill(0);

// Design §3.3: Twinline's nudges, to the two decimals the table shows.
const TWINLINE_NUDGES = [0, -1, -0.29, 0.43, -0.57, 0.14, -0.86, -0.14, 0.57, -0.43, 0.29, -0.71];

export const tests = [

  // ── renameDelta ──────────────────────────────────────────────────────────

  { name: "renameDelta: the shift from one name to another is −6…+5", fn: () => {
      eq(P.renameDelta(3, 3), 0, "same name");
      eq(P.renameDelta(0, 5), 5, "C → F");
      eq(P.renameDelta(0, 6), -6, "C → F♯ goes down");
      eq(P.renameDelta(7, 0), 5, "G → C");
      eq(P.renameDelta(11, 0), 1, "B → C wraps up");
      eq(P.renameDelta(0, 11), -1, "C → B wraps down");
    }},

  // ── shiftPitch ───────────────────────────────────────────────────────────

  { name: "shiftPitch: midpoint, pattern and ledger templates move by d", fn: () => {
      const cfg = CNBConfig.createDefault();
      const before = JSON.stringify(cfg);
      const out = P.shiftPitch(cfg, 3);
      eq(JSON.stringify(cfg), before, "the input is not changed");
      eq(out.staff.midpoint, 15, "midpoint");
      deepEq(out.staff.semitonePattern, [7, 11], "pattern");
      deepEq(out.ledgers.templates.map(t => [t.semiWithinOctave, t.triggerPCs]),
        [[3, [3, 4, 5]], [5, [5]], [1, [1]]], "templates, mod 12");
    }},

  { name: "shiftPitch: the staff stays and the labels move (default, Kite 4-369)", fn: () => {
      for (const [name, cfg] of [["default", CNBConfig.createDefault()], ["kite", fixture("kite-4-369-config.json")]]) {
        const lines = CNBLilypond.computeStaffLinePositions(cfg);
        for (let d = -6; d <= 5; d++) {
          const out = P.shiftPitch(cfg, d);
          deepEq(sortNum(out.staff.semitonePattern), sortNum(cfg.staff.semitonePattern.map(p => mod12(p + d))),
            `${name} d=${d}: each line now holds the pitch class d above`);
          deepEq(foldedLines(out), foldedLines(cfg), `${name} d=${d}: the staff's lines relative to the middle`);
          // The exporter's range follows the middle of the staff (session 28,
          // LY spec 1.3.5 §5.1a), so the positions are exactly the same for
          // every d.
          deepEq(CNBLilypond.computeStaffLinePositions(out), lines, `${name} d=${d}: exported staff-line positions`);
        }
      }
    }},

  { name: "shiftPitch: d then −d restores the config; the pitch axis is not touched", fn: () => {
      for (const cfg of [fixture("kite-4-369-config.json"), twinline()]) {
        for (const d of [-6, -1, 2, 5]) {
          const out = P.shiftPitch(cfg, d);
          deepEq(out.pitchAxis, cfg.pitchAxis, `d=${d}: pitchAxis unchanged`);
          deepEq(P.shiftPitch(out, -d), cfg, `d=${d} then ${-d}`);
        }
      }
    }},

  { name: "shiftPitch: a fractional shift throws", fn: () => {
      let threw = false;
      try { P.shiftPitch(CNBConfig.createDefault(), 0.5); } catch { threw = true; }
      assert(threw, "d = 0.5 must throw");
    }},

  // ── readNudges ───────────────────────────────────────────────────────────

  { name: "readNudges: a linear config has every nudge at 0 and its own spacing", fn: () => {
      deepEq(P.readNudges(CNBConfig.createDefault()), { nudges: ZEROS, staffSpacing: 4 }, "default");
      deepEq(P.readNudges(fixture("kite-4-369-config.json")), { nudges: ZEROS, staffSpacing: 3 }, "Kite");
    }},

  { name: "readNudges: Twinline's nudges match the §3.3 table and its spacing is 12 / 3.5", fn: () => {
      const r = P.readNudges(twinline());
      assert(r, "Twinline fits in ±1");
      r.nudges.forEach((n, pc) => near(n, TWINLINE_NUDGES[pc], 0.005, `nudge of pc ${pc}`));
      eq(r.nudges[1], -1, "C♯ reaches C");
      near(r.staffSpacing, 12 / 3.5, 1e-4, "staff spacing");
    }},

  { name: "readNudges: a map that needs more than ±1 reads as null (§3.5)", fn: () => {
      const cfg = CNBConfig.createDefault();
      const positions = [0, 0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11];   // C, C♯ and D on one spot
      cfg.pitchAxis = { enabled: true, kind: "pitch-class-map-v1", octaveStride: 12, axisUnitsPerStaffSpace: 4,
        pitchClasses: positions.map((position, pc) => ({ pc, position })) };
      eq(P.readNudges(cfg), null, "D would need −2");
    }},

  { name: "readNudges: a stride-12 map is read relative to C's position (session 28)", fn: () => {
      const cfg = CNBConfig.createDefault();
      const nudges = [0.25, 0.25, 0.25, 0.25, -0.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25];
      cfg.pitchAxis = { enabled: true, kind: "pitch-class-map-v1", octaveStride: 12, axisUnitsPerStaffSpace: 4,
        pitchClasses: nudges.map((n, pc) => ({ pc, position: pc + n })) };
      const r = P.readNudges(cfg);
      eq(r.nudges[0], 0, "C is the reference");
      eq(r.nudges[4], -0.75, "E reads −0.75 from C");
      r.nudges.forEach((n, pc) => { if (pc !== 4) eq(n, 0, `pc ${pc} sits level with C's shift`); });
    }},

  { name: "readNudges: writeNudges with every nudge 0.5 reads back as zeros (session 24 review)", fn: () => {
      const out = P.writeNudges(CNBConfig.createDefault(), Array(12).fill(0.5), 4);
      deepEq(P.readNudges(out), { nudges: ZEROS, staffSpacing: 4 }, "a uniform shift is no nudge");
    }},

  // ── writeNudges ──────────────────────────────────────────────────────────

  { name: "writeNudges: Twinline in nudge form validates and keeps the stride-7 positions", fn: () => {
      const cfg = twinline();
      const { nudges, staffSpacing } = P.readNudges(cfg);
      const out = P.writeNudges(cfg, nudges, staffSpacing);
      deepEq(CNBConfig.validate(out).errors, [], "no errors");
      eq(out.pitchAxis.octaveStride, 12, "stride 12");
      eq(out.pitchAxis.axisUnitsPerStaffSpace, staffSpacing, "axis units are the spacing");
      eq(out.staff.semitonesPerStaffSpace, staffSpacing, "spacing in the staff");
      picture(out, RANGE).forEach((p, i) => near(p, picture(cfg, RANGE)[i], 1e-3, `semitone ${RANGE[i]}`));
      const lines = CNBLilypond.computeStaffLinePositions(out);
      const expected = CNBLilypond.computeStaffLinePositions(cfg);
      eq(lines.length, expected.length, "the staff lines collapse as before");
      lines.forEach((l, i) => near(l, expected[i], 1e-3, `staff line ${i}`));
      const pos = out.pitchAxis.pitchClasses.map(e => e.position);
      for (const [a, b] of [[0, 1], [3, 4], [5, 6], [8, 9], [10, 11]]) {
        eq(pos[a], pos[b], `pcs ${a} and ${b} share a spot exactly`);
      }
      deepEq(P.readNudges(out), { nudges, staffSpacing }, "reads back the same");
    }},

  { name: "writeNudges: all zeros removes the section; the default export stays byte-identical", fn: () => {
      const out = P.writeNudges(twinline(), ZEROS, 4);
      assert(!("pitchAxis" in out), "pitchAxis removed");
      const def = P.writeNudges(CNBConfig.createDefault(), ZEROS, 4);
      const expected = readFileSync(path.join(CNB_DIR, "fixtures", "default-export-baseline.ly"), "utf8");
      eq(normalize(CNBLilypond.generate(def)), normalize(expected), "default export");
    }},

  { name: "writeNudges: the staff spacing may be a decimal (§3.4)", fn: () => {
      const out = P.writeNudges(CNBConfig.createDefault(), ZEROS, 3.5);
      eq(out.staff.semitonesPerStaffSpace, 3.5, "spacing");
      deepEq(CNBConfig.validate(out).errors, [], "no errors");
      assert(CNBLilypond.generate(out).includes("#(set! cnb:semitones-per-staff-space 3.5)"), "exported as 3.5");
    }},

  { name: "writeNudges: bad nudges or spacing throw", fn: () => {
      const cfg = CNBConfig.createDefault();
      const bad = [
        () => P.writeNudges(cfg, ZEROS.slice(1), 4),
        () => P.writeNudges(cfg, ZEROS, 0),
        () => P.writeNudges(cfg, ZEROS, NaN),
        () => P.writeNudges(cfg, ZEROS.map((n, pc) => pc === 4 ? 1.5 : n), 4),
      ];
      bad.forEach((f, i) => {
        let threw = false;
        try { f(); } catch { threw = true; }
        assert(threw, `case ${i} must throw`);
      });
    }},

  // ── nudgeLimits ──────────────────────────────────────────────────────────

  { name: "nudgeLimits: ±1, stopped at the neighbours, wrapping at B and C", fn: () => {
      deepEq(P.nudgeLimits(ZEROS, 5), { min: -1, max: 1 }, "free");
      const n = ZEROS.slice();
      n[1] = -1;                                  // C♯ onto C
      deepEq(P.nudgeLimits(n, 0), { min: -1, max: 0 }, "C stops at C♯");
      deepEq(P.nudgeLimits(n, 2), { min: -1, max: 1 }, "D keeps its full range");
      const w = ZEROS.slice();
      w[0] = -0.5;                                // C nudged down, toward B
      w[11] = 0.25;
      deepEq(P.nudgeLimits(w, 11), { min: -1, max: 0.5 }, "B stops at the next C");
      deepEq(P.nudgeLimits(w, 0), { min: -0.75, max: 1 }, "C stops at the B below");
    }},

  { name: "nudgeLimits: reaching a neighbour shares its spot; passing it throws", fn: () => {
      const n = ZEROS.slice();
      n[1] = -1;
      const out = P.writeNudges(CNBConfig.createDefault(), n, 4);
      eq(out.pitchAxis.pitchClasses[0].position, out.pitchAxis.pitchClasses[1].position, "C and C♯ share");
      deepEq(CNBConfig.validate(out).errors, [], "no errors");
      n[0] = 0.5;                                 // C past C♯
      let threw = false;
      try { P.writeNudges(CNBConfig.createDefault(), n, 4); } catch { threw = true; }
      assert(threw, "reordering must throw");
      const w = ZEROS.slice();
      w[11] = 1;
      w[0] = -0.5;                                // B past the next C
      threw = false;
      try { P.writeNudges(CNBConfig.createDefault(), w, 4); } catch { threw = true; }
      assert(threw, "reordering across the octave must throw");
    }},

  // ── renameNotehead ───────────────────────────────────────────────────────

  { name: "renameNotehead: every spot keeps its look; the staff stays (default, Kite)", fn: () => {
      for (const [name, cfg] of [["default", CNBConfig.createDefault()], ["kite", fixture("kite-4-369-config.json")]]) {
        const before = CNBNoteheadInference.lookTable(cfg);
        for (const [from, to] of [[0, 5], [4, 0], [9, 3]]) {
          const d = P.renameDelta(from, to);
          const out = P.renameNotehead(cfg, from, to);
          eq(out.staff.midpoint, cfg.staff.midpoint + d, `${name} ${from}→${to}: midpoint`);
          deepEq(CNBConfig.validate(out).errors, [], `${name} ${from}→${to}: no errors`);
          const after = CNBNoteheadInference.lookTable(out);
          for (let pc = 0; pc < 12; pc++) {
            deepEq({ ...after[mod12(pc + d)], pc }, before[pc], `${name} ${from}→${to}: the spot of pc ${pc}`);
          }
          deepEq(foldedLines(out), foldedLines(cfg), `${name} ${from}→${to}: staff lines`);
        }
      }
      deepEq(P.renameNotehead(fixture("kite-4-369-config.json"), 2, 2), fixture("kite-4-369-config.json"), "no change");
    }},

  { name: "renameNotehead: C to F♯ on the default staff keeps the staff, exported and drawn (session 28, design §11)", fn: () => {
      const def = CNBConfig.createDefault();
      const out = P.renameNotehead(def, 0, 6);
      eq(out.staff.midpoint, 6, "the middle of the staff is now F♯ (d = −6)");
      deepEq(CNBLilypond.computeStaffLinePositions(out), [-4, -2, 2, 4], "exported staff-line positions");
      assert(normalize(CNBLilypond.sectionB(out)).includes("#(set! cnb:staff-line-positions '(-4 -2 2 4))"), "Section B");
      // The canvas draws every line the pattern puts in its range (C to C′
      // with headroom), so relative to the middle it draws the same lines
      // wherever its range before and after overlap.
      const range = { minSemi: -4, maxSemi: 28 };
      const rel = (cfg) => CNBStaff.getPositions(cfg, range).map(s => s - cfg.staff.midpoint);
      const before = rel(def);
      const after = rel(out);
      const lo = Math.max(range.minSemi - def.staff.midpoint, range.minSemi - out.staff.midpoint);
      const hi = Math.min(range.maxSemi - def.staff.midpoint, range.maxSemi - out.staff.midpoint);
      const inBoth = (xs) => xs.filter(x => x >= lo && x <= hi);
      deepEq(inBoth(after), inBoth(before), "drawn lines relative to the middle");
      assert(inBoth(before).length >= 4, "the overlap holds the staff");
    }},

  { name: "renameNotehead: every spot keeps its nudge (Twinline, stride 7 and nudge form)", fn: () => {
      const stride7 = twinline();
      const r = P.readNudges(stride7);
      const nudgeForm = P.writeNudges(stride7, r.nudges, r.staffSpacing);
      for (const cfg of [stride7, nudgeForm]) {
        const stride = cfg.pitchAxis.octaveStride;
        for (const [from, to] of [[0, 7], [7, 0], [2, 11]]) {
          const d = P.renameDelta(from, to);
          const out = P.renameNotehead(cfg, from, to);
          eq(out.pitchAxis.octaveStride, stride, `stride ${stride} ${from}→${to}: stride kept`);
          deepEq(CNBConfig.validate(out).errors, [], `stride ${stride} ${from}→${to}: no errors`);
          const was = picture(cfg, RANGE);
          picture(out, RANGE.map(s => s + d)).forEach((p, i) =>
            near(p, was[i], 1e-3, `stride ${stride} ${from}→${to}: semitone ${RANGE[i]}`));
          deepEq(foldedLines(out), foldedLines(cfg), `stride ${stride} ${from}→${to}: staff lines`);
        }
      }
      // The nudges rotate, read relative to the new C (session 28). Renaming
      // C to F puts the old G, nudged −0.14, on the new C, so every nudge
      // reads 0.14 higher.
      const out = P.renameNotehead(nudgeForm, 0, 5);
      const d = P.renameDelta(0, 5);
      const rotated = r.nudges.map((_, pc) => r.nudges[mod12(pc - d)]);
      P.readNudges(out).nudges.forEach((n, pc) =>
        near(n, rotated[pc] - rotated[0], 1e-3, `rotated nudge of pc ${pc}, relative to C`));
      // Renaming C to G puts the old F (+0.14) on the new C, and the old C♯
      // (−1) then needs −1.14 from it: a custom pitch axis (§3.5).
      eq(P.readNudges(P.renameNotehead(nudgeForm, 0, 7)), null, "C→G needs more than ±1 from the new C");
    }},

  // ── Automatic ledger lines follow the nudges (session 28) ───────────────

  { name: "Automatic ledgers stay automatic through a nudge change, a shift and a rename", fn: () => {
      const auto = (cfg) => CNBStaffRuleEditor.automaticTemplates(cfg.staff.semitonePattern, CNBPitchAxis.create(cfg));
      const isAuto = (cfg) => CNBStaffRuleEditor.ledgerModeOf(cfg.staff.semitonePattern, cfg.ledgers, CNBPitchAxis.create(cfg)) === "automatic";
      // Twinline's staff with Automatic ledgers, in linear form first.
      const cfg = twinline();
      const r = P.readNudges(cfg);
      let linear = P.writeNudges(cfg, ZEROS, 4);
      linear.ledgers = { ...linear.ledgers, templates: auto(linear), proximityRule: true };
      assert(isAuto(linear), "starts Automatic");
      const nudged = P.writeNudges(linear, r.nudges, r.staffSpacing);
      deepEq(nudged.ledgers.templates.map(t => t.semiWithinOctave), [0, 10], "nudged: spots at C and A♯");
      assert(isAuto(nudged), "nudged: Automatic");
      for (const d of [-6, -1, 3, 5]) {
        assert(isAuto(P.shiftPitch(nudged, d)), `shift ${d}: Automatic`);
      }
      for (const [from, to] of [[0, 5], [2, 9], [7, 0]]) {
        assert(isAuto(P.renameNotehead(nudged, from, to)), `rename ${from}→${to}: Automatic`);
      }
      assert(isAuto(P.writeNudges(nudged, ZEROS, 4)), "nudges back at 0: Automatic");
    }},

  { name: "My own ledger rules are never rewritten by a nudge change, a shift or a rename", fn: () => {
      const cfg = twinline();
      const own = JSON.stringify(cfg.ledgers.templates);
      const r = P.readNudges(cfg);
      deepEq(JSON.stringify(P.writeNudges(cfg, r.nudges, r.staffSpacing).ledgers.templates), own, "writeNudges");
      const def = CNBConfig.createDefault();
      const shifted = P.shiftPitch(def, 2);
      deepEq(shifted.ledgers.templates.map(t => t.semiWithinOctave),
        def.ledgers.templates.map(t => mod12(t.semiWithinOctave + 2)), "shiftPitch moves them by d, as before");
      deepEq(P.renameNotehead(def, 0, 2).ledgers.templates, shifted.ledgers.templates, "renameNotehead moves them by d");
    }},

  // ── Engine ───────────────────────────────────────────────────────────────

  { name: "engine: Twinline in nudge form (spacing 3.4286) engraves at the stride-7 positions", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const stride7 = twinline();
      const r = P.readNudges(stride7);
      const nudgeForm = P.writeNudges(stride7, r.nudges, r.staffSpacing);
      const [want, got] = await Promise.all([stride7, nudgeForm]
        .map(c => measureStaffPositions(engine, CNBLilypond.generate(c))));
      assert(!want.error, `the stride-7 export must engrave: ${want.error}`);
      assert(!got.error, `the nudge-form export must engrave: ${got.error}`);
      eq(got.noteheads.length, 12, "one notehead per pitch class");
      got.noteheads.forEach(({ pc, position }, i) => {
        eq(pc, want.noteheads[i].pc, "same note order");
        near(position, want.noteheads[i].position, 0.01, `pc ${pc}: staff position`);
      });
      eq(got.lines.length, want.lines.length, "same number of staff lines");
      sortNum(got.lines).forEach((l, i) => near(l, sortNum(want.lines)[i], 0.01, `staff line ${i}`));
    }},
];
