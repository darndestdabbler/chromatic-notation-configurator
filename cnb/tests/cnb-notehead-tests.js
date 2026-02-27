/**
 * cnb-notehead-tests.js — Unit tests for Module 6 (Notehead measure())
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBNotehead } from "../src/cnb-notehead.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function approx(a, b, msg, epsilon = 1e-9) {
  if (Math.abs(a - b) > epsilon)
    throw new Error(`${msg || "approx"}: expected ~${b}, got ${a}`);
}

export const tests = [
  { name: "measure formula with crotchet-minim shape and pxPerSemi=16", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = cfg.shapes["crotchet-minim"];
      const m = CNBNotehead.measure(shape, 16);
      approx(m.scaleFactor, 0.16, "scaleFactor");
      approx(m.pixelHeight, 43.584, "pixelHeight");
      approx(m.pixelWidth, 55.17632, "pixelWidth");
    }},
  { name: "measure pixelHeight equals semitoneHeight × pxPerSemi", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = cfg.shapes["crotchet-minim"];
      const pxPerSemi = 32;
      const m = CNBNotehead.measure(shape, pxPerSemi);
      approx(m.pixelHeight, shape.semitoneHeight * pxPerSemi, "height vs semitoneHeight");
    }},
];
