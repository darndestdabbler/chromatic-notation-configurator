/**
 * pitch-model.js — pitch, nudges and staff spacing (session 24)
 *
 * The notehead-first editor's two pitch variables (design
 * docs/planning/notehead-first-editor-design.md §3, §4), as pure functions
 * with no DOM. Each returns a new config or value and never changes its
 * input.
 *
 *   shiftPitch(config, d)            → the pitch moved by d semitones, the
 *                                      staff kept where it is (§3.1)
 *   readNudges(config)               → { nudges, staffSpacing }, or null for
 *                                      a map nudges can't show (§3.2–§3.5)
 *   writeNudges(config, n, spacing)  → nudges written as a stride-12 pitch
 *                                      axis, or the section removed (§3.2)
 *   nudgeLimits(nudges, pc)          → { min, max } of one nudge (§3.2)
 *   renameDelta(fromPc, toPc)        → the d, −6…+5, from one name to another
 *   renameNotehead(config, from, to) → names changed, the picture kept (§4.1)
 *
 * A nudge is a pitch class's offset from its own semitone, −1…+1; its
 * position is pc + nudge. Nudges are read relative to C, whose nudge is
 * always 0 (session 28). Nudges and spacing are rounded to 4 decimals (the
 * exporter's precision), and so are the positions written from them, so two
 * pitch classes that share a spot get the same number.
 *
 * shiftPitch, writeNudges and renameNotehead keep Automatic ledger lines
 * automatic for the new staff and pitch axis (session 28, design §1).
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBNoteheadInference } from "./notehead-inference.js";
import { CNBStaffRuleEditor } from "./staff-rule-editor.js";

const PCS = [...Array(12).keys()];
const EPS = 1e-9;

const mod12 = (x) => ((x % 12) + 12) % 12;
// `|| 0` turns −0 into 0.
const round4 = (x) => Math.round(x * 1e4) / 1e4 || 0;

/** An overrides map keyed by semitone within the octave, its keys moved by d. */
function shiftKeys(overrides, d) {
  if (!overrides || typeof overrides !== "object") return overrides;
  const out = {};
  for (const [key, val] of Object.entries(overrides)) out[String(mod12(Number(key) + d))] = val;
  return out;
}

/**
 * Move the pitch by d semitones and keep the staff where it is on the page
 * (§3.1): the midpoint, the staff pattern, the ledger templates and both
 * line-override maps move by the same d. The pitch-axis map is not touched,
 * so each nudge travels with its pitch class (§4.3). Automatic ledger lines
 * stay automatic (keepAutomaticLedgers).
 */
function shiftPitch(config, d) {
  if (!Number.isInteger(d)) throw new Error(`shiftPitch: d must be a whole number of semitones, got ${d}`);
  return keepAutomaticLedgers(config, shiftRaw(config, d));
}

/** shiftPitch without the Automatic ledger rewrite. */
function shiftRaw(config, d) {
  const out = CNBConfig.clone(config);
  if (d === 0) return out;
  const staff = out.staff || {};
  if (Number.isFinite(staff.midpoint)) staff.midpoint += d;
  if (Array.isArray(staff.semitonePattern)) {
    staff.semitonePattern = staff.semitonePattern.map(s => mod12(s + d)).sort((a, b) => a - b);
  }
  staff.lineOverrides = shiftKeys(staff.lineOverrides, d);
  const ledgers = out.ledgers || {};
  if (Array.isArray(ledgers.templates)) {
    for (const t of ledgers.templates) {
      t.semiWithinOctave = mod12(t.semiWithinOctave + d);
      if (Array.isArray(t.triggerPCs)) t.triggerPCs = t.triggerPCs.map(pc => mod12(pc + d));
    }
  }
  ledgers.lineOverrides = shiftKeys(ledgers.lineOverrides, d);
  return out;
}

/**
 * The nudges and staff spacing a config shows (§3.2–§3.4). With no active
 * pitch axis every nudge is 0 and the spacing is staff.semitonesPerStaffSpace.
 * Every map, stride 12 included, is measured from C's position and rescaled
 * to stride 12 (§3.3): nudge(pc) = (position(pc) − position(0)) × 12 /
 * octaveStride − pc. C is the reference, so its nudge always reads 0, and a
 * map whose positions are all shifted by the same amount (which draws and
 * engraves the same as no shift) reads as no nudges. The spacing is
 * axisUnitsPerStaffSpace × 12 / octaveStride (§3.4). Null when a nudge
 * falls outside ±1: the map is a custom axis nudges can't show (§3.5).
 */
function readNudges(config) {
  const axis = CNBPitchAxis.create(config);
  if (!axis.enabled) {
    return { nudges: PCS.map(() => 0), staffSpacing: (config.staff || {}).semitonesPerStaffSpace };
  }
  const stride = axis.octaveStride;
  const pos = PCS.map(pc => axis.positionOfSemi(pc));
  const nudges = PCS.map(pc => round4((pos[pc] - pos[0]) * 12 / stride - pc));
  if (nudges.some(n => Math.abs(n) > 1 + EPS)) return null;
  return { nudges, staffSpacing: round4(axis.unitsPerStaffSpace * 12 / stride) };
}

/**
 * The range one nudge may take (§3.2): within ±1, and never past its
 * neighbours, so notes may share a spot but never reorder. Wraps at B and C:
 * B's upper neighbour is the next C, 12 + nudge(0).
 */
function nudgeLimits(nudges, pc) {
  const below = nudges[mod12(pc - 1)];
  const above = nudges[mod12(pc + 1)];
  return { min: Math.max(-1, below - 1), max: Math.min(1, above + 1) };
}

/**
 * Write nudges and a staff spacing (§3.2, §3.4). The spacing goes to
 * staff.semitonesPerStaffSpace and may be a decimal. While any nudge is
 * non-zero, pitchAxis is a stride-12 map with position pc + nudge and the
 * spacing as its axisUnitsPerStaffSpace; when every nudge is 0 the section
 * is removed, which restores the linear output.
 */
function writeNudges(config, nudges, staffSpacing) {
  if (!Array.isArray(nudges) || nudges.length !== 12 || !nudges.every(Number.isFinite)) {
    throw new Error("writeNudges: nudges must be 12 finite numbers");
  }
  if (!Number.isFinite(staffSpacing) || staffSpacing <= 0) {
    throw new Error(`writeNudges: the staff spacing must be a positive number, got ${staffSpacing}`);
  }
  for (const pc of PCS) {
    const { min, max } = nudgeLimits(nudges, pc);
    if (nudges[pc] < min - EPS || nudges[pc] > max + EPS) {
      throw new Error(`writeNudges: nudge ${nudges[pc]} for pitch class ${pc} is outside ${min}…${max}`);
    }
  }
  const out = CNBConfig.clone(config);
  out.staff = { ...out.staff, semitonesPerStaffSpace: staffSpacing };
  if (nudges.every(n => n === 0)) {
    delete out.pitchAxis;
  } else {
    out.pitchAxis = {
      enabled: true,
      kind: "pitch-class-map-v1",
      octaveStride: 12,
      axisUnitsPerStaffSpace: staffSpacing,
      pitchClasses: PCS.map(pc => ({ pc, position: round4(pc + nudges[pc]) })),
    };
  }
  return keepAutomaticLedgers(config, out);
}

/** The shift, −6…+5 semitones, that takes the name fromPc to toPc. */
function renameDelta(fromPc, toPc) {
  return mod12(toPc - fromPc + 6) - 6;
}

/**
 * Rename the notehead named fromPc to toPc (§4.1): the pitch moves by the d
 * between them, and the look table and the pitch-axis map rotate by the
 * same d, so every spot keeps its look and its nudge and nothing on the
 * page moves (§4.3). The map rotates so that semitone s + d takes the
 * position s had, plus a whole shift (exactly d on a stride-12 map, so its
 * nudges rotate as they are).
 */
function renameNotehead(config, fromPc, toPc) {
  const d = renameDelta(fromPc, toPc);
  if (d === 0) return CNBConfig.clone(config);
  const table = CNBNoteheadInference.lookTable(config);
  const rotated = PCS.map(pc => ({ ...table[mod12(pc - d)], pc }));
  const out = CNBNoteheadInference.writeBack(shiftRaw(config, d), rotated);
  const axis = CNBPitchAxis.create(config);
  if (axis.enabled) {
    const shift = Math.round(d * axis.octaveStride / 12);
    out.pitchAxis.pitchClasses = PCS.map(pc => ({
      pc,
      position: round4(axis.positionOfSemi(pc - d) + shift),
    }));
  }
  return keepAutomaticLedgers(config, out);
}

/**
 * Automatic ledger lines stay automatic (session 28): when the input's
 * ledgers are exactly the Automatic spots of its own staff and pitch axis,
 * the output gets the Automatic spots of its new staff and pitch axis, so
 * the spots follow the lines as the nudges place them. My own rules are
 * never rewritten. Changes `after` and returns it.
 */
function keepAutomaticLedgers(before, after) {
  if (!before.ledgers || !after.ledgers) return after;
  try {
    const pattern = (before.staff && before.staff.semitonePattern) || [];
    if (CNBStaffRuleEditor.ledgerModeOf(pattern, before.ledgers, CNBPitchAxis.create(before)) !== "automatic") {
      return after;
    }
    after.ledgers.templates = CNBStaffRuleEditor.automaticTemplates(
      (after.staff && after.staff.semitonePattern) || [], CNBPitchAxis.create(after));
  } catch {
    // A pattern the staff editor cannot read has no Automatic spots.
  }
  return after;
}

export const CNBPitchModel = {
  shiftPitch,
  readNudges,
  writeNudges,
  nudgeLimits,
  renameDelta,
  renameNotehead,
};
