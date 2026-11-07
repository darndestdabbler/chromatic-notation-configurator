/**
 * cnb-builtin-shapes-tests.js — Unit tests for the built-in notehead shapes
 * (session 27, design docs/planning/notehead-first-editor-design.md §2)
 *
 * Each built-in shape equals its source (createDefault, the 45deg-369 and
 * Kite 4-369 fixtures); withShape adds a shape once and never overwrites
 * one; and an unused shape added to a config leaves its export unchanged.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBBuiltinShapes as B } from "../ui/builtin-shapes.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";

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

export const tests = [

  { name: "NAMES: the four built-in shapes, the default oval first", fn: () => {
      deepEq(B.NAMES, ["crotchet-minim", "ellipse-45deg", "kite-up", "kite-down"], "names");
    }},

  { name: "get: each built-in shape equals its source", fn: () => {
      deepEq(B.get("crotchet-minim"), CNBConfig.createDefault().shapes["crotchet-minim"], "crotchet-minim");
      deepEq(B.get("ellipse-45deg"), fixture("45deg-369-config.json").shapes["ellipse-45deg"], "ellipse-45deg");
      const kite = fixture("kite-4-369-config.json").shapes;
      deepEq(B.get("kite-up"), kite["kite-up"], "kite-up");
      deepEq(B.get("kite-down"), kite["kite-down"], "kite-down");
      eq(B.get("diamond"), null, "not a built-in shape");
    }},

  { name: "get: returns a copy", fn: () => {
      const a = B.get("kite-up");
      a.naturalHeight = 1;
      assert(B.get("kite-up").naturalHeight !== 1, "the built-in data is unchanged");
    }},

  { name: "withShape: adds a built-in shape once, leaving the input unchanged", fn: () => {
      const config = CNBConfig.createDefault();
      const added = B.withShape(config, "kite-up");
      deepEq(Object.keys(added.shapes), ["crotchet-minim", "kite-up"], "added");
      deepEq(added.shapes["kite-up"], B.get("kite-up"), "its data");
      deepEq(Object.keys(config.shapes), ["crotchet-minim"], "input unchanged");
      eq(B.withShape(added, "kite-up"), added, "a second add is a no-op");
    }},

  { name: "withShape: never overwrites a shape of that name, and ignores unknown names", fn: () => {
      const config = CNBConfig.createDefault();
      config.shapes["kite-up"] = { ...B.get("kite-up"), displayName: "Mine" };
      eq(B.withShape(config, "kite-up").shapes["kite-up"].displayName, "Mine", "kept");
      eq(B.withShape(config, "diamond"), config, "unknown name");
    }},

  { name: "withShape: an unused shape leaves the export unchanged", fn: () => {
      const config = CNBConfig.createDefault();
      const ly = (c) => CNBLilypond.generate(c).replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      eq(ly(B.withShape(config, "ellipse-45deg")), ly(config), "default export");
    }},
];
