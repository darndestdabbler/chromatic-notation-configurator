/**
 * cnb-color-tests.js — Unit tests for cnb/src/cnb-color.js
 *
 * The colour math (CIEDE2000, sRGB ↔ CIELAB) and the nearest-name and
 * Scheme-symbol pipeline, moved with the code from the palette editor's
 * tests in session 37.
 */

import { CNBColor as C } from "../src/cnb-color.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function approx(a, b, msg, epsilon = 1e-6) {
  if (!(Math.abs(a - b) <= epsilon))
    throw new Error(`${msg || "approx"}: expected ~${b}, got ${a}`);
}

export const tests = [
  // ── Color math ──
  {
    name: "deltaE: identical colors have distance 0",
    fn: () => { approx(C.deltaE("#1b9e77", "#1b9e77"), 0, "deltaE self"); },
  },
  {
    name: "deltaE: black vs white is the maximum (100)",
    fn: () => { approx(C.deltaE("#000000", "#ffffff"), 100, "deltaE black/white"); },
  },
  {
    name: "deltaE: symmetric",
    fn: () => {
      approx(C.deltaE("#d95f02", "#7570b3"), C.deltaE("#7570b3", "#d95f02"), "symmetry");
    },
  },
  {
    name: "hexToRgb/rgbToHex round-trip, 3-digit hex expansion",
    fn: () => {
      assert(C.rgbToHex(...C.hexToRgb("#1B9E77")) === "#1b9e77", "round-trip normalizes case");
      const rgb = C.hexToRgb("#f0a");
      assert(rgb[0] === 255 && rgb[1] === 0 && rgb[2] === 170, "3-digit hex expands");
    },
  },
  {
    name: "hexToLab: white is L=100, a=b=0",
    fn: () => {
      const [L, a, b] = C.hexToLab("#ffffff");
      approx(L, 100, "L", 1e-3);
      approx(a, 0, "a", 1e-3);
      approx(b, 0, "b", 1e-3);
    },
  },

  // ── Nearest-name / scheme-symbol pipeline ──
  {
    name: "nearestColorName: exact dictionary color matches itself",
    fn: () => {
      assert(C.nearestColorName("#FF0000") === "Red-#ff0000",
        `got ${C.nearestColorName("#FF0000")}`);
    },
  },
  {
    name: "schemeSymbol: spec example #1b9e77 → shamrock-1b9e77 (LY spec §4.5)",
    fn: () => {
      assert(C.schemeSymbol("#1b9e77") === "shamrock-1b9e77",
        `got ${C.schemeSymbol("#1b9e77")}`);
    },
  },
  {
    name: "toSchemeSymbol: lowercases, collapses non-alphanumerics, trims hyphens",
    fn: () => {
      assert(C.toSchemeSymbol("Shamrock-#1b9e77") === "shamrock-1b9e77", "name+hex");
      assert(C.toSchemeSymbol("Crotchet–Minim") === "crotchet-minim", "en dash collapses");
      assert(C.toSchemeSymbol("--Weird  name!--") === "weird-name", "trim + collapse");
    },
  },
  {
    name: "schemeSymbol: non-string falls back to black-000000",
    fn: () => {
      assert(C.schemeSymbol(null) === "black-000000", "null");
      assert(C.schemeSymbol(undefined) === "black-000000", "undefined");
    },
  },
  {
    name: "baseColorName strips the hex suffix, keeps hyphenated names intact",
    fn: () => {
      assert(C.baseColorName("#FF0000") === "Red", "Red");
      assert(C.baseColorName("#0095B6") === "Blue-Green", "hyphenated name survives");
    },
  },
];
