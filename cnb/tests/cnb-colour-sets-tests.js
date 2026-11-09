/**
 * cnb-colour-sets-tests.js — Unit tests for cnb/ui/colour-sets.js
 *
 * The suggested colour sets (session 37): the curated Dark2 and
 * colour-blind-safe sets, and apply(), which cycles a set over the twelve
 * noteheads of a look table.
 */

import { CNBColourSets } from "../ui/colour-sets.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBNoteheadInference } from "../ui/notehead-inference.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

const table = () => CNBNoteheadInference.lookTable(CNBConfig.createDefault());

export const tests = [
  {
    name: "SETS: six Dark2 sets then six colour-blind-safe sets, with unique keys",
    fn: () => {
      const keys = CNBColourSets.SETS.map(s => s.key);
      assert(new Set(keys).size === keys.length, "unique keys");
      assert(JSON.stringify(keys) === JSON.stringify([
        "dark2-2", "dark2-3", "dark2-4", "dark2-6", "dark2-7", "dark2-11",
        "cbsafe-2", "cbsafe-3", "cbsafe-4", "cbsafe-6", "cbsafe-7", "cbsafe-11",
      ]), keys.join(","));
      for (const s of CNBColourSets.SETS) {
        assert(s.colors.length === Number(s.key.split("-")[1]), `${s.key} size`);
        assert(s.colourBlindSafe === s.key.startsWith("cbsafe"), `${s.key} marked`);
        assert(s.colors.every(c => /^#[0-9a-f]{6}$/i.test(c.hex) && c.name), `${s.key} colours`);
      }
    },
  },
  {
    name: "SETS: the curated colours are the palette editor's (Dark2 3 starts teal, orange, lilac)",
    fn: () => {
      const d3 = CNBColourSets.SETS.find(s => s.key === "dark2-3").colors.map(c => c.hex);
      assert(JSON.stringify(d3) === JSON.stringify(["#1b9e77", "#d95f02", "#7570b3"]), d3.join(","));
      const d11 = CNBColourSets.SETS.find(s => s.key === "dark2-11").colors;
      assert(d11[7].hex === "#666666" && d11[10].hex === "#6a3d9a", "Dark2 11 extension");
      const cb4 = CNBColourSets.SETS.find(s => s.key === "cbsafe-4").colors.map(c => c.hex);
      assert(JSON.stringify(cb4) === JSON.stringify(["#4477AA", "#CCBB44", "#EE6677", "#228833"]), cb4.join(","));
    },
  },
  {
    name: "apply: pitch class p takes colour p % N, lower case, and keeps the rest of the row",
    fn: () => {
      const out = CNBColourSets.apply(table(), "cbsafe-3");
      const want = ["#0077bb", "#ee7733", "#009988"];
      out.forEach((row, pc) => assert(row.color === want[pc % 3], `pc ${pc}: ${row.color}`));
      const before = table();
      out.forEach((row, pc) => assert(row.shape === before[pc].shape && row.hollow === before[pc].hollow, `pc ${pc} look kept`));
    },
  },
  {
    name: "apply: black is none, and an unknown key returns the table unchanged",
    fn: () => {
      const t = table();
      assert(CNBColourSets.apply(t, "no-such-set") === t, "unknown key");
      const fake = t.map((row, pc) => ({ ...row, pc }));
      const set = CNBColourSets.SETS[0];
      const saved = set.colors;
      set.colors = [{ name: "Black", hex: "#000000" }, { name: "Red", hex: "#FF0000" }];
      try {
        const out = CNBColourSets.apply(fake, set.key);
        assert(out[0].color === null && out[1].color === "#ff0000", JSON.stringify(out.slice(0, 2).map(r => r.color)));
      } finally {
        set.colors = saved;
      }
    },
  },
  {
    name: "apply: the input table is not changed",
    fn: () => {
      const t = table();
      const copy = JSON.stringify(t);
      CNBColourSets.apply(t, "dark2-2");
      assert(JSON.stringify(t) === copy, "input unchanged");
    },
  },
];
