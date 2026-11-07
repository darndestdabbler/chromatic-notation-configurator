/**
 * cnb-notehead-tests.js — Unit tests for Module 6 (Notehead measure())
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { withSvgStub } from "./svg-stub.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function approx(a, b, msg, epsilon = 1e-9) {
  if (!(Math.abs(a - b) <= epsilon))
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

  // ── session 22: resolved size ──────────────────────────────────────────────
  { name: "measure with no size (or null sizes) equals the unsized result, scaleX = scaleY = scaleFactor", fn: () => {
      const shape = CNBConfig.createDefault().shapes["crotchet-minim"];
      const plain = CNBNotehead.measure(shape, 16);
      const nulls = CNBNotehead.measure(shape, 16, { heightSemis: null, widthSemis: null });
      for (const m of [plain, nulls]) {
        approx(m.scaleFactor, 0.16, "scaleFactor");
        assert(m.scaleX === m.scaleFactor && m.scaleY === m.scaleFactor, "x, y and scaleFactor equal");
        approx(m.pixelWidth, 55.17632, "pixelWidth");
        approx(m.pixelHeight, 43.584, "pixelHeight");
      }
    }},
  { name: "measure with heightSemis / widthSemis gives those sizes in px, independently", fn: () => {
      const shape = { semitoneHeight: 1, naturalHeight: 100, naturalWidth: 150 };
      const m = CNBNotehead.measure(shape, 20, { heightSemis: 2, widthSemis: 4 });
      approx(m.pixelHeight, 40, "height 2 semis");
      approx(m.pixelWidth, 80, "width 4 semis");
      approx(m.scaleY, 0.4, "scaleY"); approx(m.scaleX, 80 / 150, "scaleX");
      approx(m.scaleFactor, m.scaleY, "scaleFactor is scaleY");
      const hOnly = CNBNotehead.measure(shape, 20, { heightSemis: 2 });
      approx(hOnly.pixelHeight, 40, "height only: height");
      approx(hOnly.pixelWidth, 30, "height only: natural width");
      const wOnly = CNBNotehead.measure(shape, 20, { widthSemis: 3 });
      approx(wOnly.pixelHeight, 20, "width only: own height");
      approx(wOnly.pixelWidth, 60, "width only: width");
    }},
  { name: "render: scale(sf) when scaleX equals scaleY (or absent); scale(sx,sy) when stretched", fn: () => {
      const shape = { svgPath: "M 0 0 Z", svgHollowPath: "M 1 1 Z", semitoneHeight: 1, naturalHeight: 100, naturalWidth: 150 };
      withSvgStub(() => {
        const parent = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const plain = CNBNotehead.render(parent, { shape, x: 0, y: 0, scaleFactor: 0.2, hollow: true, color: "#000" });
        for (const p of plain.children) assert(p.getAttribute("transform") === "scale(0.2)", "plain transform");
        const same = CNBNotehead.render(parent, { shape, x: 0, y: 0, scaleFactor: 0.2, scaleX: 0.2, scaleY: 0.2, hollow: false, color: "#000" });
        assert(same.children[0].getAttribute("transform") === "scale(0.2)", "equal scales keep scale(sf)");
        const m = CNBNotehead.measure(shape, 20, { heightSemis: 2, widthSemis: 4 });
        const sized = CNBNotehead.render(parent, { shape, x: 0, y: 0, scaleFactor: m.scaleFactor, scaleX: m.scaleX, scaleY: m.scaleY, hollow: true, color: "#000" });
        for (const p of sized.children) {
          assert(p.getAttribute("transform") === `scale(${m.scaleX},${m.scaleY})`, `sized transform: ${p.getAttribute("transform")}`);
        }
      });
    }},
];
