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
  { name: "measure preserves the shape's natural aspect ratio", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = cfg.shapes["crotchet-minim"];
      const m = CNBNotehead.measure(shape, 16);
      approx(m.pixelWidth / m.pixelHeight, shape.naturalWidth / shape.naturalHeight, "aspect ratio");
    }},
  { name: "measure scales linearly with pxPerSemi", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = cfg.shapes["crotchet-minim"];
      const m16 = CNBNotehead.measure(shape, 16);
      const m32 = CNBNotehead.measure(shape, 32);
      approx(m32.scaleFactor, m16.scaleFactor * 2, "scaleFactor doubles");
      approx(m32.pixelWidth, m16.pixelWidth * 2, "pixelWidth doubles");
      approx(m32.pixelHeight, m16.pixelHeight * 2, "pixelHeight doubles");
    }},
  { name: "measure works for a synthetic 1-semitone shape", fn: () => {
      const shape = { naturalHeight: 100, naturalWidth: 150, semitoneHeight: 1 };
      const m = CNBNotehead.measure(shape, 20);
      approx(m.scaleFactor, 0.2, "scaleFactor");
      approx(m.pixelHeight, 20, "pixelHeight = 1 semitone = 20px");
      approx(m.pixelWidth, 30, "pixelWidth");
    }},
];
