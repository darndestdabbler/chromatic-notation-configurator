/**
 * cnb-stem-tests.js — Unit tests for Module 8 (Stem)
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBStem } from "../src/cnb-stem.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

export const tests = [
  { name: "direction up when average below midpoint", fn: () => {
      eq(CNBStem.direction([0,12], 12), "up");
    }},
  { name: "direction down when average at or above midpoint", fn: () => {
      eq(CNBStem.direction([12,24], 12), "down");
      eq(CNBStem.direction([12], 12), "down");
    }},
  { name: "direction up with 11,12 vs midpoint 12", fn: () => {
      eq(CNBStem.direction([11,12], 12), "up");
    }},

  { name: "geometry returns null for null anchors", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = { anchors: null, semitoneHeight: 1 };
      const geom = CNBStem.geometry(cfg, { shape, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" });
      assert(geom === null, "should be null");
    }},

  { name: "geometry returns null for non-stem duration", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = { anchors: { crotchetUp:{x:1,y:0}, crotchetDown:{x:-1,y:0}, minimUp:{x:1,y:0}, minimDown:{x:-1,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { shape, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"semibreve" });
      assert(geom === null, "should be null for semibreve");
    }},

  { name: "stemX sign reflects anchor.x and direction", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0}, crotchetDown:{x:-10,y:0}, minimUp:{x:10,y:0}, minimDown:{x:-10,y:0} }, semitoneHeight:2 };
      const upGeom = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:5, noteYPositions:[0], direction:"up", duration:"crotchet" });
      eq(upGeom.x > 5, true, "stem for up should be right of center");
      const downGeom = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:5, noteYPositions:[0], direction:"down", duration:"crotchet" });
      eq(downGeom.x < 5, true, "stem for down should be left of center");
    }},

  { name: "thickness equals pctToPx default 26,16", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:0,y:0}, crotchetDown:{x:0,y:0}, minimUp:{x:0,y:0}, minimDown:{x:0,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" });
      const expected = CNBConfig.pctToPx(cfg.display.stemThicknessPct, cfg.display.pxPerSemi);
      eq(geom.thickness, expected);
    }},
];
