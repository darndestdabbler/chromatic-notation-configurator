/**
 * cnb-notehead-inference-tests.js — Unit tests for the look table and rule
 * inference (session 23, design docs/planning/notehead-first-editor-design.md §5)
 *
 * Covers lookTable, inferAttribute (default tie-break, period, accidentals,
 * explicit lists), inferRules against the §5.2 worked examples, and
 * writeBack: every gallery and fixture config written back from its own
 * look table resolves to the same noteheads and colours, its export does
 * not change, and rules the inference does not own are kept above the
 * inferred ones (§5.5). Fixtures load as the app loads them, so a palette
 * they still carry is on their noteheads (session 37).
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBNoteheadInference as I } from "../ui/notehead-inference.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { galleryFixtureFiles } from "./check-gallery-examples.js";

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

function fixture(name) {
  return CNBConfigIO.loadFromText(readFileSync(path.join(CNB_DIR, "fixtures", name), "utf8")).config;
}

function gallery(name) {
  const text = readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", name), "utf8");
  return CNBConfigIO.loadFromText(text).config;
}

const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");

/** Every config the round trip covers, by name. */
function allConfigs() {
  const configs = {
    "default": CNBConfig.createDefault(),
    "kite-4-369": fixture("kite-4-369-config.json"),
    "45deg-369": fixture("45deg-369-config.json"),
    "sized": fixture("sized-config.json"),
  };
  for (const file of galleryFixtureFiles()) configs[path.basename(file)] = gallery(path.basename(file));
  return configs;
}

/** Resolved notehead plus effective colour for every pc × duration × key (or none). */
function resolveEverything(config) {
  const durations = ((config.durations && config.durations.definitions) || []).map(d => d.name);
  const keys = [null, ...((config.keys && config.keys.definitions) || []).map(k => k.name)];
  const out = [];
  for (let pc = 0; pc < 12; pc++) {
    for (const d of durations.length ? durations : ["crotchet"]) {
      for (const k of keys) {
        const r = CNBConfig.resolveNotehead(config, pc, d, k);
        out.push({ pc, d, k, ...r, color: r.color && r.color.toLowerCase() });
      }
    }
  }
  return out;
}

const written = (config) => I.writeBack(config, I.lookTable(config));

/** [name, pitch classes] of the inferred rules. */
const ruleSummary = (config) =>
  I.inferRules(config, I.lookTable(config)).rules.map(r => [r.name, r.match.pitchClasses]);

const ACC = [1, 3, 6, 8, 10];
const ODD = [1, 3, 5, 7, 9, 11];

export const tests = [

  // ── ownsRule / lookTable ──────────────────────────────────────────────

  { name: "ownsRule: owns rules for every duration and key with no offKeyMark", fn: () => {
      const m = (durations, keys) => ({ match: { pitchClasses: "all", durations, keys }, apply: {} });
      assert(I.ownsRule(m("all", "all")), "all/all");
      assert(!I.ownsRule(m(["minim"], "all")), "duration-scoped");
      assert(!I.ownsRule(m("all", ["G"])), "key-scoped");
      assert(!I.ownsRule({ ...m("all", "all"), apply: { offKeyMark: "dot" } }), "offKeyMark");
    }},

  { name: "lookTable: one row per pitch class with shape, fill, colour, size and side step", fn: () => {
      const t = I.lookTable(fixture("sized-config.json"));
      eq(t.length, 12, "rows");
      deepEq(t[0], { pc: 0, shape: "crotchet-minim", hollow: false, color: null, heightSemis: null, widthSemis: 4, xOffsetStaffSpaces: 0 }, "C");
      deepEq([t[1].hollow, t[1].heightSemis, t[1].widthSemis], [true, 1.5, 3], "C♯");
      const kite = I.lookTable(fixture("kite-4-369-config.json"));
      deepEq(kite.slice(0, 3).map(r => [r.shape, r.color]), [["kite-down", "#50b4e9"], ["kite-up", "#cc79a7"], ["kite-up", null]], "Kite colours from its rules");
      eq(I.lookTable(gallery("twinline-compact.json"))[1].xOffsetStaffSpaces, 0.85, "Twinline C♯ side step");
    }},

  // ── inferAttribute ────────────────────────────────────────────────────

  { name: "inferAttribute: the default is the most common value, ties broken by C", fn: () => {
      const alt = [...Array(12).keys()].map(pc => (pc % 2 ? "a" : "b"));
      eq(I.inferAttribute(alt).def, "b", "6–6 tie goes to C's value");
      eq(I.inferAttribute(alt.map((v, pc) => (pc === 0 ? "c" : v === "b" ? "a" : v))).def, "a", "majority wins over C");
    }},

  { name: "inferAttribute: the smallest period in 1, 2, 3, 4, 6", fn: () => {
      const same = I.inferAttribute(Array(12).fill("x"));
      deepEq([same.period, same.groups], [1, []], "one value");
      const every3 = I.inferAttribute([...Array(12).keys()].map(pc => (pc % 3 === 0 ? "x" : "y")));
      eq(every3.period, 3, "period 3");
      deepEq(every3.groups, [{ value: "x", pcs: [0, 3, 6, 9], words: "every 3 semitones from C" }], "group");
      deepEq(every3.cycle, ["x", "y", "y"], "cycle");
      const every6 = I.inferAttribute([...Array(12).keys()].map(pc => (pc % 6 === 5 ? "x" : "y")));
      deepEq([every6.period, every6.groups[0].words], [6, "every 6 semitones from F"], "period 6");
    }},

  { name: "inferAttribute: no period → the accidentals, the naturals, else an explicit list", fn: () => {
      const acc = I.inferAttribute([...Array(12).keys()].map(pc => ACC.includes(pc)));
      deepEq([acc.period, acc.def, acc.groups[0].pcs, acc.groups[0].words], [12, false, ACC, "on the accidentals"], "accidentals");
      const nat = I.inferAttribute([...Array(12).keys()].map(pc => (ACC.includes(pc) ? 0 : 0.5)), 0);
      eq(nat.groups[0].words, "on the naturals", "naturals, with the default fixed");
      const list = I.inferAttribute([...Array(12).keys()].map(pc => [0, 4, 8].includes(pc) || pc === 1));
      eq(list.groups[0].words, "on C, C♯, E and G♯", "explicit list");
    }},

  // ── inferRules: the §5.2 worked examples ──────────────────────────────

  { name: "inferRules (§5.2): default 4-8 → Default and Hollow on the accidentals", fn: () => {
      deepEq(ruleSummary(CNBConfig.createDefault()),
        [["Default (crotchet-minim, solid)", "all"], ["Hollow on the accidentals", ACC]], "rules");
    }},

  { name: "inferRules (§5.2): Kite 4-369 → kite-up every 4, hollow every 2, colours every 3", fn: () => {
      const kite = fixture("kite-4-369-config.json");
      deepEq(ruleSummary(kite), [
        ["Default (kite-down, solid)", "all"],
        ["Kite-up, every 4 semitones from C♯ and D", [1, 2, 5, 6, 9, 10]],
        ["Hollow, every 2 semitones from C♯", ODD],
        ["Puce, every 3 semitones from C♯", [1, 4, 7, 10]],
        ["No colour, every 3 semitones from D", [2, 5, 8, 11]],
      ], "rules");
      const { rules, colour } = I.inferRules(kite, I.lookTable(kite));
      deepEq([colour.period, colour.cycle], [3, ["#50b4e9", "#cc79a7", null]], "colour cycle");
      eq(colour.words, "every 3 semitones: sky blue, puce, none", "colour words");
      deepEq(rules.map(r => r.apply.color), ["#50b4e9", undefined, undefined, "#cc79a7", null], "colour on the rules");
    }},

  { name: "inferRules (§5.2): 45deg-369 → hollow every 2, colours every 3", fn: () => {
      const deg = fixture("45deg-369-config.json");
      deepEq(ruleSummary(deg), [
        ["Default (ellipse-45deg, solid)", "all"],
        ["Hollow, every 2 semitones from C♯", ODD],
        ["Puce, every 3 semitones from C♯", [1, 4, 7, 10]],
        ["Sky blue, every 3 semitones from D", [2, 5, 8, 11]],
      ], "rules");
      const { colour } = I.inferRules(deg, I.lookTable(deg));
      eq(colour.words, "every 3 semitones: none, puce, sky blue", "colour words");
    }},

  { name: "inferRules (§5.2): Twinline → accidentals hollow, explicit side step", fn: () => {
      const twin = gallery("twinline-compact.json");
      deepEq(ruleSummary(twin), [
        ["Default (crotchet-minim, solid)", "all"],
        ["Hollow on the accidentals", ACC],
        ["Side step 0.85 on C♯, E, F♯, A and B", [1, 4, 6, 9, 11]],
      ], "rules");
      const side = I.inferRules(twin, I.lookTable(twin)).rules[2];
      deepEq(side.apply, { xOffsetStaffSpaces: 0.85 }, "side step apply");
    }},

  { name: "inferRules: sizes write only the fields they set, never apply.color", fn: () => {
      const sized = fixture("sized-config.json");
      const rules = I.inferRules(sized, I.lookTable(sized)).rules;
      deepEq(rules.map(r => [r.name, r.priority, r.apply]), [
        ["Default (crotchet-minim, solid)", 0, { shape: "crotchet-minim", hollow: false }],
        ["Hollow on the accidentals", 1, { hollow: true }],
        ["Width 4 semitones on C", 2, { widthSemis: 4 }],
        ["Height 1.5, width 3 semitones on the accidentals", 3, { heightSemis: 1.5, widthSemis: 3 }],
      ], "rules");
      for (const r of rules) deepEq([r.match.durations, r.match.keys], ["all", "all"], r.name);
    }},

  // ── ruleLines: the rule list in words (§5.4, session 27) ──────────────

  { name: "ruleLines (§5.2): default 4-8 → one line per attribute, each at its default where uniform", fn: () => {
      const c = CNBConfig.createDefault();
      const lines = I.ruleLines(c, I.lookTable(c));
      deepEq(lines.map(l => [l.attribute, l.words]), [
        ["shape", "Shape: crotchet minim everywhere"],
        ["fill", "Fill: solid, with hollow on the accidentals"],
        ["size", "Size: each shape at its own size"],
        ["side", "Side step: none everywhere"],
        ["colour", "Colour: none everywhere"],
      ], "lines");
      deepEq(lines[2].values, [{ value: { heightSemis: null, widthSemis: null }, pcs: [...Array(12).keys()] }], "size value");
      deepEq(lines[1].values, [{ value: false, pcs: [0, 2, 4, 5, 7, 9, 11] }, { value: true, pcs: ACC }], "fill values, default first");
    }},

  { name: "ruleLines (§5.2): Kite 4-369 → kite up every 4, hollow every 2, colours every 3", fn: () => {
      const kite = fixture("kite-4-369-config.json");
      const lines = I.ruleLines(kite, I.lookTable(kite));
      deepEq(lines.map(l => l.words), [
        "Shape: kite down, with kite up every 4 semitones from C♯ and D",
        "Fill: solid, with hollow every 2 semitones from C♯",
        "Size: each shape at its own size",
        "Side step: none everywhere",
        "Colour: every 3 semitones, sky blue, puce, none",
      ], "words");
      deepEq(lines[0].values, [{ value: "kite-down", pcs: [0, 3, 4, 7, 8, 11] }, { value: "kite-up", pcs: [1, 2, 5, 6, 9, 10] }], "shape values");
      deepEq(lines[4].values.map(v => [v.value, v.pcs]), [
        ["#50b4e9", [0, 3, 6, 9]], ["#cc79a7", [1, 4, 7, 10]], [null, [2, 5, 8, 11]],
      ], "colour values");
    }},

  { name: "ruleLines (§5.2): 45deg-369 → one shape, hollow every 2, colours every 3", fn: () => {
      const deg = fixture("45deg-369-config.json");
      deepEq(I.ruleLines(deg, I.lookTable(deg)).map(l => l.words), [
        "Shape: ellipse 45deg everywhere",
        "Fill: solid, with hollow every 2 semitones from C♯",
        "Size: each shape at its own size",
        "Side step: none everywhere",
        "Colour: every 3 semitones, none, puce, sky blue",
      ], "words");
    }},

  { name: "ruleLines (§5.2): Twinline → its side steps in words; sizes in words", fn: () => {
      const twin = gallery("twinline-compact.json");
      const lines = I.ruleLines(twin, I.lookTable(twin));
      deepEq(lines.map(l => l.attribute), ["shape", "fill", "size", "side", "colour"], "attributes");
      eq(lines[3].words, "Side step: none, with 0.85 staff spaces on C♯, E, F♯, A and B", "side words");
      deepEq(lines[3].values, [{ value: 0, pcs: [0, 2, 3, 5, 7, 8, 10] }, { value: 0.85, pcs: [1, 4, 6, 9, 11] }], "side values");
      const noSteps = I.lookTable(twin).map(r => ({ ...r, xOffsetStaffSpaces: 0 }));
      eq(I.ruleLines(twin, noSteps).find(l => l.attribute === "side").words, "Side step: none everywhere", "axis, no step");
      const sized = fixture("sized-config.json");
      const size = I.ruleLines(sized, I.lookTable(sized)).find(l => l.attribute === "size");
      eq(size.words, "Size: the shape's own, with width 4 semitones on C and height 1.5, width 3 semitones on the accidentals", "size words");
      deepEq(size.values[2], { value: { heightSemis: 1.5, widthSemis: 3 }, pcs: ACC }, "size value");
    }},

  // ── writeBack ─────────────────────────────────────────────────────────

  { name: "writeBack: every gallery and fixture config resolves the same for every pc, duration and key", fn: () => {
      const configs = allConfigs();
      assert(Object.keys(configs).length >= 22, "corpus present");
      for (const [name, config] of Object.entries(configs)) {
        const after = written(config);
        deepEq(resolveEverything(after), resolveEverything(config), name);
        eq(CNBConfig.validate(after).errors.length, 0, `${name} validates`);
      }
    }},

  { name: "writeBack: the default, Kite 4-369 and 45deg-369 exports do not change", fn: () => {
      for (const [name, config] of [["default", CNBConfig.createDefault()],
        ["kite", fixture("kite-4-369-config.json")], ["45deg", fixture("45deg-369-config.json")]]) {
        eq(normalize(CNBLilypond.generate(written(config))), normalize(CNBLilypond.generate(config)), name);
      }
    }},

  { name: "writeBack: writes no palette (session 37)", fn: () => {
      assert(!("palette" in written(fixture("kite-4-369-config.json"))), "Kite");
      assert(!("palette" in written(CNBConfig.createDefault())), "default");
    }},

  { name: "writeBack (§5.3, §5.5): a colour is written as a rule; scoped rules are kept above", fn: () => {
      const config = CNBConfig.createDefault();
      config.keys.enabled = true;
      config.keys.definitions = [{ name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11] }];
      const minim = { name: "Minim C is wide", priority: 1, match: { pitchClasses: [0], durations: ["minim"], keys: "all" }, apply: { widthSemis: 4 } };
      const inG = { name: "In G, F♯ is solid", priority: 3, match: { pitchClasses: [6], durations: "all", keys: ["G"] }, apply: { hollow: false } };
      config.noteheadRules.push(minim, inG,
        { name: "C is red", priority: 2, match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { color: "#ff0000" } });

      const after = written(config);
      deepEq(resolveEverything(after), resolveEverything(config), "same resolutions");
      const kept = after.noteheadRules.filter(r => !I.ownsRule(r));
      deepEq(kept.map(r => [r.name, r.match, r.apply]), [minim, inG].map(r => [r.name, r.match, r.apply]), "kept verbatim, in order");
      const top = Math.max(...after.noteheadRules.filter(I.ownsRule).map(r => r.priority));
      assert(kept.every(r => r.priority > top), "kept rules above the inferred ones");
      assert(kept[0].priority <= kept[1].priority, "order kept");
      deepEq(after.noteheadRules.filter(r => r.apply.color !== undefined).map(r => [r.name, r.match.pitchClasses, r.apply]),
        [["Red on C", [0], { color: "#ff0000" }]], "one colour rule");
      eq(config.noteheadRules.length, 5, "input not mutated");
    }},

  { name: "writeBack: a colour taken back to none draws and exports black", fn: () => {
      const kite = fixture("kite-4-369-config.json");
      const table = I.lookTable(kite);
      table[1].color = null;                       // C♯, puce → none
      const after = I.writeBack(kite, table);
      eq(CNBConfig.resolveNotehead(after, 1, "crotchet", null).color, null, "C♯ has no colour");
      eq(CNBConfig.resolveNotehead(after, 4, "crotchet", null).color, "#cc79a7", "E keeps puce");
      const ly = CNBLilypond.generate(after);
      const cSharp = ly.split(";; C♯")[1].split(";;")[0];
      assert(/\(color\s+\. black-000000\)/.test(cSharp), "C♯ exports black: " + cSharp);
      eq(I.lookTable(after)[1].color, null, "reads back as none");
    }},

  { name: "writeBack (§5.5, session 27): only kept rules below the inferred ones are raised, in order", fn: () => {
      const config = CNBConfig.createDefault();            // infers 2 rules: priorities 0 and 1
      const kept = (name, priority) => ({ name, priority, match: { pitchClasses: [0], durations: ["minim"], keys: "all" }, apply: { widthSemis: 3 } });
      config.noteheadRules.push(kept("high", 9), kept("low", 0), kept("mid", 1), kept("edge", 2));
      const after = written(config);
      const out = after.noteheadRules.filter(r => !I.ownsRule(r));
      deepEq(out.map(r => [r.name, r.priority]), [["low", 2], ["mid", 2], ["edge", 2], ["high", 9]], "raised just above, high kept");
      const sorted = after.noteheadRules.slice().sort((a, b) => a.priority - b.priority).filter(r => !I.ownsRule(r)).map(r => r.name);
      deepEq(sorted, ["low", "mid", "edge", "high"], "applied in their old order");
      const top = Math.max(...after.noteheadRules.filter(I.ownsRule).map(r => r.priority));
      assert(out.every(r => r.priority > top), "all above the inferred rules");
      deepEq(resolveEverything(after), resolveEverything(config), "same resolutions");
    }},
];
