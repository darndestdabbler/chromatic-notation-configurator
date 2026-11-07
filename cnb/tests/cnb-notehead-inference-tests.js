/**
 * cnb-notehead-inference-tests.js — Unit tests for the look table and rule
 * inference (session 23, design docs/planning/notehead-first-editor-design.md §5)
 *
 * Covers lookTable, inferAttribute (default tie-break, period, accidentals,
 * explicit lists), inferRules against the §5.2 worked examples, and
 * writeBack: every gallery and fixture config written back from its own
 * look table resolves to the same noteheads and colours, the reference
 * exports stay byte-identical to their baselines, and rules the inference
 * does not own are kept above the inferred ones (§5.5).
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
  return JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", name), "utf8"));
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
        out.push({ pc, d, k, ...r, color: r.color ?? CNBConfig.resolveColor(config, pc) });
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
      deepEq(kite.slice(0, 3).map(r => [r.shape, r.color]), [["kite-down", "#50b4e9"], ["kite-up", "#cc79a7"], ["kite-up", "#000000"]], "Kite colours from the palette");
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
      ], "rules");
      const { colour } = I.inferRules(kite, I.lookTable(kite));
      deepEq([colour.period, colour.cycle], [3, ["#50b4e9", "#cc79a7", "#000000"]], "colour cycle");
      eq(colour.words, "every 3 semitones: skyblue, rose, black", "colour words");
    }},

  { name: "inferRules (§5.2): 45deg-369 → hollow every 2, colours every 3", fn: () => {
      const deg = fixture("45deg-369-config.json");
      deepEq(ruleSummary(deg), [["Default (ellipse-45deg, solid)", "all"], ["Hollow, every 2 semitones from C♯", ODD]], "rules");
      const { colour } = I.inferRules(deg, I.lookTable(deg));
      eq(colour.words, "every 3 semitones: black, puce, sky blue", "colour words");
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

  { name: "writeBack: the default, Kite 4-369 and 45deg-369 exports stay byte-identical", fn: () => {
      const cases = [
        [CNBConfig.createDefault(), "default-export-baseline.ly"],
        [fixture("kite-4-369-config.json"), "kite-4-369-export-baseline.ly"],
        [fixture("45deg-369-config.json"), "45deg-369-export-baseline.ly"],
      ];
      for (const [config, baseline] of cases) {
        const expected = readFileSync(path.join(CNB_DIR, "fixtures", baseline), "utf8");
        eq(normalize(CNBLilypond.generate(written(config))), normalize(expected), baseline);
      }
    }},

  { name: "writeBack: an unchanged palette is kept as it is, in its order", fn: () => {
      const kite = fixture("kite-4-369-config.json");
      deepEq(written(kite).palette, kite.palette, "Kite palette");
      deepEq(written(CNBConfig.createDefault()).palette, CNBConfig.createDefault().palette, "empty palette");
    }},

  { name: "writeBack (§5.3, §5.5): colour rules move to the palette; scoped rules are kept above", fn: () => {
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
      assert(kept[0].priority < kept[1].priority, "order kept");
      assert(after.noteheadRules.every(r => r.apply.color === undefined), "no apply.color written");
      deepEq(after.palette.colors.map(c => [c.pc, c.hex]), [[0, "#ff0000"]], "colour in the palette");
      eq(config.noteheadRules.length, 5, "input not mutated");
    }},
];
