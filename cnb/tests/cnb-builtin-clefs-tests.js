/**
 * cnb-builtin-clefs-tests.js — Unit tests for the clefs the Clef panel
 * offers (session 45, cnb/ui/builtin-clefs.js)
 *
 * Each definition validates; a standard clef puts its anchor, on its line
 * (G, F, C), on its pitch in the octave nearest the staff's middle, at an
 * automatic size, LilyPond's in staff spaces drawn at the staff's symbol size
 * (session 59), on the default, Kite 4-369 and Twinline (pitch axis)
 * staves; and its path uses only the commands the exporter converts.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBBuiltinClefs as B } from "../ui/builtin-clefs.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBClef } from "../src/cnb-clef.js";
import { CNBStaff } from "../src/cnb-staff.js";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function approx(a, b, msg, tol = 1e-4) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
}

function json(file) {
  return JSON.parse(readFileSync(path.join(CNB_DIR, file), "utf8"));
}

/** Emmentaler's glyphs: the marked line's depth below the top, and the
 *  height, in font units (250 to a staff space). */
const EMMENTALER = {
  treble: { line: 1194.75, height: 1829.75 },
  bass: { line: 263, height: 776 },
  alto: { line: 500, height: 1000 },
};

/** config with the clef `name` shown. */
function withClef(config, name) {
  const out = CNBConfig.clone(config);
  out.clef = { ...out.clef, enabled: true, active: name, glyphs: { [name]: B.definition(config, name) } };
  return out;
}

/** A clef's top edge and height as drawn (CNBClef.shown, session 59). */
function shownOn(config, name) {
  return CNBClef.shown(withClef(config, name));
}

export const tests = [

  { name: "CHOICES: dozenal, treble, bass and alto, in that order", fn: () => {
      eq(B.CHOICES.map(c => c.name).join(" "), "dozenal treble bass alto", "names");
      eq(B.CHOICES.map(c => c.displayName).join(" "), "Dozenal Treble Bass Alto", "display names");
    }},

  { name: "definition: each clef validates on the default, Kite and Twinline staves", fn: () => {
      const staves = {
        default: CNBConfig.createDefault(),
        kite: json("fixtures/kite-4-369-config.json"),
        twinline: CNBConfig.merge(json("assets/examples/gallery/twinline-compact.json")),
      };
      for (const [staff, config] of Object.entries(staves)) {
        for (const { name } of B.CHOICES) {
          const result = CNBConfig.validate(withClef(config, name));
          assert(result.valid, `${name} on ${staff}: ${result.errors.join("; ")}`);
          assert(!result.warnings.some(w => /clef/i.test(w)), `${name} on ${staff} warns: ${result.warnings.join("; ")}`);
        }
      }
    }},

  { name: "definition: the dozenal clef has no place of its own, and its size is automatic (session 59)", fn: () => {
      const def = B.definition(CNBConfig.createDefault(), "dozenal");
      eq(JSON.stringify(def), JSON.stringify({ kind: "dozenal", displayName: "Dozenal", semitoneHeight: null }), "dozenal");
    }},

  { name: "definition: each standard clef's anchor is on its line, its size automatic (session 59)", fn: () => {
      const config = CNBConfig.createDefault();
      for (const [name, x] of [["treble", 313], ["bass", 608], ["alto", 318]]) {
        const def = B.definition(config, name);
        eq(JSON.stringify(def.reference), JSON.stringify({ x, y: 0 }), `${name}: the anchor on its line, the glyph's origin`);
        eq(def.semitoneHeight, null, `${name}: automatic`);
        eq(def.staffSpaceUnits, 250, `${name}: Emmentaler's 250 units a staff space`);
        eq(-def.viewBoxMinY, EMMENTALER[name].line, `${name}: the line ${EMMENTALER[name].line} units below the top`);
      }
    }},

  { name: "definition: on the default staff, G, F and C nearest the middle (12) are marked", fn: () => {
      const config = CNBConfig.createDefault();   // midpoint 12
      eq(B.definition(config, "treble").anchorSemi, 7, "treble: G below the middle");
      eq(B.definition(config, "bass").anchorSemi, 17, "bass: F above the middle");
      eq(B.definition(config, "alto").anchorSemi, 12, "alto: C on the middle");
      // Automatic: 4 staff spaces of 2.724 semitones (the noteheads' height), about C.
      const alto = shownOn(config, "alto");
      approx(alto.height, 4 * 2.724, "4 staff spaces of 2.724 semitones");
      approx(alto.top, 12 + 2 * 2.724, "its middle on C");
    }},

  { name: "definition: on Kite 4-369 (3 semitones a staff space) the clefs are LilyPond's size", fn: () => {
      const config = json("fixtures/kite-4-369-config.json");
      eq(config.staff.semitonesPerStaffSpace, 3, "Kite's spacing");
      for (const [name, semi] of [["treble", 7], ["bass", 17], ["alto", 12]]) {
        eq(B.definition(config, name).anchorSemi, semi, `${name} marks semitone ${semi}`);
        const shown = shownOn(config, name);
        approx(shown.height, EMMENTALER[name].height / 250 * 3, `${name} at LilyPond's size`);
        approx(shown.top, semi + EMMENTALER[name].line / 250 * 3, `${name}: its line on ${semi}`);
      }
    }},

  { name: "definition: a moved middle moves the marked octave", fn: () => {
      const config = CNBConfig.createDefault();
      config.staff.midpoint = 20;
      eq(B.definition(config, "treble").anchorSemi, 19, "G nearest 20 is 19");
      eq(B.definition(config, "alto").anchorSemi, 24, "C nearest 20 is 24");
      config.staff.midpoint = 6;   // F♯: C at 0 and 12 equally near, the higher taken
      eq(B.definition(config, "alto").anchorSemi, 12, "a tie takes the higher");
    }},

  { name: "definition: under a pitch axis the size is in axis units (Twinline)", fn: () => {
      const config = CNBConfig.merge(json("assets/examples/gallery/twinline-compact.json"));
      const units = CNBStaff.symbolSpace(config);
      approx(shownOn(config, "treble").height, EMMENTALER.treble.height / 250 * units, "height in axis units");
    }},

  { name: "definition: under a pitch axis each clef's line lands on its pitch's axis position (Twinline)", fn: () => {
      const config = CNBConfig.merge(json("assets/examples/gallery/twinline-compact.json"));
      const axis = CNBPitchAxis.create(config);
      assert(axis.enabled, "Twinline has a pitch axis");
      const units = CNBStaff.symbolSpace(config);
      const mid = config.staff.midpoint;
      for (const [name, pc] of [["treble", 7], ["bass", 5], ["alto", 0]]) {
        const marked = pc + 12 * Math.round((mid - pc) / 12);
        const shown = shownOn(config, name);
        const line = axis.positionOfSemi(shown.top) - EMMENTALER[name].line / 250 * units;
        approx(line, axis.positionOfSemi(marked), `${name}: its line at the axis position of semitone ${marked}`, 1e-3);
      }
    }},

  { name: "definition: LilyPond's proportions, sized as the staff's symbols are (treble 7.319, bass 3.104, alto 4 staff spaces)", fn: () => {
      const config = CNBConfig.createDefault();
      for (const [name, spaces] of [["treble", 7.319], ["bass", 3.104], ["alto", 4]]) {
        const def = B.definition(config, name);
        approx(shownOn(config, name).height / 2.724, spaces, `${name} height in symbol staff spaces`, 0.001);
        eq(def.naturalHeight, EMMENTALER[name].height, `${name} natural height`);
        eq(def.kind, "glyph", `${name} is a glyph clef`);
        eq(def.lilypondPath, null, `${name}: the exporter converts its SVG path`);
      }
    }},

  { name: "definition: an unknown name gives null", fn: () => {
      eq(B.definition(CNBConfig.createDefault(), "tenor"), null, "tenor is not offered");
    }},

  { name: "paths: only absolute M, L, C and Z commands, which the exporter converts", fn: () => {
      const config = CNBConfig.createDefault();
      for (const name of ["treble", "bass", "alto"]) {
        const d = B.definition(config, name).svgPath;
        assert(/^(?:[MLCZ](?: -?\d+(?:\.\d+)?)*\s*)+$/.test(d), `${name}: unexpected path syntax`);
        const ly = CNBLilypond.generate(withClef(config, name));
        assert(ly.includes(`#(cnb:register-clef! '${name}`), `${name} is registered`);
        assert(!/NaN|undefined/.test(ly), `${name}: the export has no NaN`);
      }
    }},

];
