/**
 * cnb-checks-wording-tests.js — Unit tests for the checks list's designer
 * wording (session 31, design docs/planning/notehead-first-editor-design.md
 * §8.5, mock-up 4).
 *
 * Each mapped message is taken from real CNBConfig.validate /
 * CNBConfigExport.validateForExport output for a config that produces it,
 * so a reworded validation message shows up here as an unmapped one. Pins
 * the designer wording, the link's label and its target, and that an
 * unknown message comes back as itself with no link.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBChecksWording as W } from "../ui/checks-wording.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBConfigExport } from "../ui/config-export.js";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}
function eq(actual, expected, message) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
}

const kite = () => CNBConfig.merge(JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8")));

/** The one message of `config` that starts with `prefix`, described. */
function describeFirst(config, prefix) {
  const { errors, warnings } = CNBConfigExport.validateForExport(config);
  const message = [...errors, ...warnings].find(m => m.startsWith(prefix));
  assert(message, `no message starting ${JSON.stringify(prefix)} in ${JSON.stringify([...errors, ...warnings])}`);
  return W.describe(message, config);
}

/** Kite with one extra rule (appended, highest priority). */
function withRule(rule) {
  const c = kite();
  c.noteheadRules.push({ priority: 99, match: { pitchClasses: "all", durations: "all", keys: "all" }, ...rule });
  return c;
}

const ruleTarget = (c, name) => ({ kind: "rule", index: c.noteheadRules.findIndex(r => r.name === name) });

export const tests = [
  {
    name: "describe: an unknown message comes back as itself, with no link",
    fn: () => {
      eq(W.describe("engine.indent must be a finite number (got \"x\")", kite()),
        { text: "engine.indent must be a finite number (got \"x\")", link: null }, "pass-through");
      eq(W.describe("something new", undefined), { text: "something new", link: null }, "no config");
    },
  },
  {
    name: "describe: keys LilyPond cannot tell apart name both and the one engraved, opening the key signature (session 34)",
    fn: () => {
      const c = kite();
      c.keys.enabled = true;
      c.keys.definitions = [
        { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
        { name: "A minor", pitchClasses: [9, 11, 0, 2, 4, 5, 7] },
      ];
      c.noteheadRules.push({ name: "In A minor, A is blue", priority: 99,
        match: { pitchClasses: [9], durations: "all", keys: ["A minor"] }, apply: { color: "#0000FF" } });
      const { warnings } = CNBConfigExport.validateForExport(c);
      assert(!warnings.some(w => w.startsWith("Rule \"In A minor")), "the key-scoped rule itself is not a check");
      const d = describeFirst(c, "Key definitions");
      eq(d.text, "The keys “C”, “A minor” have the same notes, so LilyPond cannot tell them apart: it engraves them all as “A minor” does.", "wording");
      eq(d.link, { label: "Open Key signature", target: { kind: "section", section: "key-signature" } }, "link");
    },
  },
  {
    name: "describe: rule messages link to the rule they name",
    fn: () => {
      const cases = [
        [{ name: "Odd shape", apply: { shape: "nope" } }, "Rule \"Odd shape\" references",
          "“Odd shape” gives the shape “nope”, which this notation does not have."],
        [{ name: "Bad colour", apply: { color: "red" } }, "Rule \"Bad colour\"",
          "“Bad colour” gives the colour “red”, which is not a colour like #1b9e77."],
        [{ name: "Zero", apply: { heightSemis: 0 } }, "Rule \"Zero\"",
          "“Zero” makes noteheads tall by an amount that is not a size: it must be a number of semitones above 0."],
        [{ name: "Huge", apply: { widthSemis: 9 } }, "Rule \"Huge\"",
          "“Huge” makes noteheads 9 semitones wide, outside the usual 0.25 to 4, so they may not look right."],
        [{ name: "Marked", apply: { offKeyMark: "dot" } }, "Rule \"Marked\"",
          "“Marked” sets an off-key mark, which is not drawn here or exported yet."],
        [{ name: "Shifted", apply: { xOffsetStaffSpaces: 0.5 } }, "Rule \"Shifted\"",
          "“Shifted” moves noteheads sideways, but no two notes share a place on this staff, so the move is ignored."],
      ];
      for (const [rule, prefix, text] of cases) {
        const c = withRule(rule);
        const d = describeFirst(c, prefix);
        eq(d.text, text, rule.name);
        eq(d.link, { label: "Show the rule", target: ruleTarget(c, rule.name) }, rule.name + " link");
      }
    },
  },
  {
    name: "describe: hollow on a shape with no hollow, from a rule and from resolution",
    fn: () => {
      const c = kite();
      const name = Object.keys(c.shapes)[0];
      c.shapes[name] = { ...c.shapes[name], svgHollowPath: null };
      c.noteheadRules.push({ name: "Hollow D", priority: 99,
        match: { pitchClasses: [2], durations: "all", keys: "all" }, apply: { shape: name, hollow: true } });
      const rule = describeFirst(c, "Rule \"Hollow D\"");
      eq(rule.text, `“Hollow D” makes noteheads hollow, but the “${name}” shape has no hollow drawn inside it.`, "rule wording");
      eq(rule.link.target, ruleTarget(c, "Hollow D"), "rule target");
      const pc = describeFirst(c, "PC 2 ");
      eq(pc.text, `D is hollow, but its shape, “${name}”, has no hollow drawn inside it, so it shows solid.`, "pc wording");
      eq(pc.link, { label: "Select the notehead", target: { kind: "noteheads", pcs: [2] } }, "pc link");
    },
  },
  {
    name: "describe: an uncovered pitch class selects that notehead",
    fn: () => {
      const c = kite();
      c.noteheadRules = [{ name: "Most", priority: 0,
        match: { pitchClasses: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], durations: "all", keys: "all" },
        apply: { shape: Object.keys(c.shapes)[0] } }];
      const d = describeFirst(c, "Pitch class 1 ");
      eq(d.text, "C♯ has no notehead: no rule gives it a look.", "wording");
      eq(d.link, { label: "Select the notehead", target: { kind: "noteheads", pcs: [1] } }, "link");
    },
  },
  {
    name: "describe: a black notation gets no colour message (session 37: many systems stay black)",
    fn: () => {
      const { warnings } = CNBConfig.validate(CNBConfig.createDefault());
      assert(!warnings.some(w => /colou?r|palette/i.test(w)), JSON.stringify(warnings));
    },
  },
  {
    name: "describe: shape messages select the noteheads that use the shape",
    fn: () => {
      const def = CNBConfig.createDefault();
      const fallback = describeFirst(def, "Shape \"crotchet-minim\" has no lilypondPath");
      eq(fallback.text, "The “crotchet-minim” shape has no LilyPond drawing of its own, so the export traces its SVG outline.", "fallback wording");
      eq(fallback.link.label, "Select the noteheads", "fallback label");
      eq(fallback.link.target.pcs.length, 12, "every notehead uses it");

      const unused = W.describe("Shape \"spare\" has no lilypondPath (will use fallback SVG conversion at export)", def);
      eq(unused.link, null, "no notehead uses the shape: no link");

      const noPath = CNBConfig.createDefault();
      noPath.shapes["crotchet-minim"] = { ...noPath.shapes["crotchet-minim"], svgPath: null, lilypondPath: null };
      eq(describeFirst(noPath, "Shape \"crotchet-minim\" has no path data").text,
        "The “crotchet-minim” shape has no outline, so it cannot be exported.", "no path data");

      const badName = CNBConfig.createDefault();
      badName.shapes["9x"] = badName.shapes["crotchet-minim"];
      eq(describeFirst(badName, "Shape \"9x\" has no usable").text,
        "The “9x” shape's name cannot be used in LilyPond: it needs a name that starts with a Latin letter.", "unusable name");

      const clash = CNBConfig.createDefault();
      clash.shapes["Crotchet Minim"] = clash.shapes["crotchet-minim"];
      const d = describeFirst(clash, "Shapes ");
      eq(d.text, "The “crotchet-minim” and “Crotchet Minim” shapes get the same LilyPond name, “crotchet-minim”: one of them needs another name.", "clash");
      eq(d.link.target.pcs.length, 12, "clash selects the noteheads using either");
    },
  },
  {
    name: "describe: indistinguishable shared positions select both noteheads",
    fn: () => {
      const c = CNBConfig.merge(JSON.parse(readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json"), "utf8")));
      c.noteheadRules = [{ name: "Plain", priority: 0, match: { pitchClasses: "all", durations: "all", keys: "all" },
        apply: { shape: Object.keys(c.shapes)[0], hollow: false, color: null } }];
      const d = describeFirst(c, "Shared axis position");
      eq(d.text, "C and C♯ sit at the same place on the staff and look the same, so a reader cannot tell them apart.", "wording");
      eq(d.link, { label: "Select the noteheads", target: { kind: "noteheads", pcs: [0, 1] } }, "link");
    },
  },
  {
    name: "describe: staff, export, key, clef and axis messages open their section",
    fn: () => {
      const open = (section, control) => {
        const names = { staff: "Staff", export: "Export", "key-signature": "Key signature", clef: "Clef", advanced: "Advanced", "ledger-lines": "Ledger lines" };
        const target = { kind: "section", section };
        if (control) target.control = control;
        return { label: "Open " + names[section], target };
      };
      const check = (mutate, prefix, text, link) => {
        const c = CNBConfig.createDefault();
        mutate(c);
        const d = describeFirst(c, prefix);
        eq(d.text, text, prefix);
        eq(d.link, link, prefix + " link");
      };
      check(c => { c.staff.semitonePattern = [4]; }, "Staff pattern must",
        "The staff needs at least two lines an octave (it has 1).", open("staff"));
      check(c => { c.meta.fileSuffix = "Mine"; }, "meta.fileSuffix",
        "The file suffix must start with a hyphen, as in “-Mine”.", open("export", '[data-meta="fileSuffix"] input'));
      check(c => { c.meta.fileSuffix = ""; c.meta.configName = "—"; }, "Cannot derive",
        "The exported file has no name: give the notation a name or a file suffix with letters or digits.",
        open("export", '[data-meta="configName"] input'));
      check(c => { c.meta.notationLabel = ""; }, "meta.notationLabel",
        "The notation has no label, so a score that prints it prints nothing.", open("export", '[data-meta="notationLabel"] input'));
      check(c => { c.keys.keySignature.enabled = true; }, "keys.keySignature.enabled is true",
        "The key signature is on but keys are off, so no signature is drawn.", open("key-signature", ".cnb-kse-keys-enable-check"));
      check(c => { c.keys.enabled = true; c.keys.keySignature.enabled = true; c.keys.definitions = [{ name: "Mode 1", pitchClasses: [0, 2] }]; }, "Key definition \"Mode 1\" has no tonicPc",
        "The key “Mode 1” has no tonic, and its name does not start with a note letter, so its first note is taken as the tonic.", open("key-signature"));
      check(c => { c.keys.enabled = true; c.keys.keySignature.enabled = true; c.keys.definitions = [{ name: "D", pitchClasses: [] }]; }, "Key definition \"D\" needs",
        "The key “D” has no notes.", open("key-signature"));
      check(c => { c.clef.enabled = true; }, "clef.enabled",
        "The clef is on but none is chosen, so none is drawn.", open("clef"));
      check(c => { c.clef.enabled = true; c.clef.active = "gone"; }, "clef.active",
        "The chosen clef, “gone”, is not in this notation.", open("clef"));
      check(c => { c.clef.enabled = true; c.clef.active = "g";
        c.clef.glyphs.g = { kind: "glyph", svgPath: "M 0 0 L 1 1 Z", naturalHeight: 3, naturalWidth: 1, semitoneHeight: 6, anchorSemi: 200 }; },
        "Clef glyph \"g\" anchorSemi", "The clef “g” is placed far above or below the staff.", open("clef"));
      check(c => { c.clef.enabled = true; c.clef.active = "g"; c.clef.glyphs.g = { kind: "glyph", anchorSemi: 10 }; },
        "Clef glyph \"g\" has no svgPath", "The clef “g” cannot be drawn: its imported drawing is incomplete.", open("clef"));
      check(c => { c.clef.enabled = true; c.clef.active = "t"; c.clef.glyphs.t = { kind: "text", text: "", textHeightSemis: 4, anchorSemi: 10 }; },
        "Clef text entry \"t\" has no text", "The text clef “t” has no text.", open("clef"));
      check(c => { c.clef.enabled = true; c.clef.active = "t"; c.clef.glyphs.t = { kind: "text", text: "4", textHeightSemis: 0, anchorSemi: 10 }; },
        "Clef text entry \"t\" needs", "The text clef “t” needs a height above 0.", open("clef"));
    },
  },
  {
    name: "describe: pitch-axis map messages open Advanced at the map",
    fn: () => {
      const twin = () => CNBConfig.merge(JSON.parse(readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json"), "utf8")));
      const link = { label: "Open Advanced", target: { kind: "section", section: "advanced", control: "#pitch-axis-map" } };

      const down = twin();
      down.pitchAxis.pitchClasses[3].position = 0;
      const d = describeFirst(down, "pitchAxis map is not globally");
      eq(d.text, "The pitch axis map puts a higher note below a lower one: the notes must go up the staff in order.", "order wording");
      eq(d.link, link, "order link");

      const wrap = twin();
      wrap.pitchAxis.pitchClasses[11].position = 7.5;
      eq(describeFirst(wrap, "pitchAxis map breaks").link, link, "octave-boundary link");

      const outside = twin();
      outside.pitchAxis.pitchClasses[11].position = 7;
      const o = describeFirst(outside, "pitchAxis positions for pc");
      eq(o.text, "B sits outside its octave on the pitch axis map, so octaves overlap.", "outside wording");
      eq(o.link, link, "outside link");
    },
  },
  {
    name: "describe: a rule the config does not have gets no link",
    fn: () => {
      const d = W.describe("Rule \"Gone\" sets an off-key mark (\"dot\"), which is not drawn in the preview or exported yet", kite());
      eq(d.text, "“Gone” sets an off-key mark, which is not drawn here or exported yet.", "wording");
      eq(d.link, null, "no link");
    },
  },
];
