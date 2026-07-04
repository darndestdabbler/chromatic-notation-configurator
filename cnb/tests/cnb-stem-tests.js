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

  { name: "crotchet vs minim anchor selection (up)", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0}, crotchetDown:{x:-10,y:0}, minimUp:{x:20,y:0}, minimDown:{x:-20,y:0} }, semitoneHeight:2 };
      const crotchet = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" });
      const minim    = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"minim" });
      eq(crotchet.x, 10, "crotchetUp anchor x");
      eq(minim.x, 20, "minimUp anchor x");
    }},

  { name: "crotchet vs minim anchor selection (down)", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0}, crotchetDown:{x:-10,y:0}, minimUp:{x:20,y:0}, minimDown:{x:-20,y:0} }, semitoneHeight:2 };
      const crotchet = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"down", duration:"crotchet" });
      const minim    = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"down", duration:"minim" });
      eq(crotchet.x, -10, "crotchetDown anchor x");
      eq(minim.x, -20, "minimDown anchor x");
    }},

  { name: "stem up extends above highest notehead by stemExtension notehead-heights", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:0,y:0}, crotchetDown:{x:0,y:0}, minimUp:{x:0,y:0}, minimDown:{x:0,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[100, 40], direction:"up", duration:"crotchet" });
      const noteheadHeightPx = s.semitoneHeight * cfg.display.pxPerSemi;
      eq(geom.y1, 100, "attaches at lowest notehead (max y)");
      eq(geom.y2, 40 - cfg.display.stemExtension * noteheadHeightPx, "extends above highest (min y)");
      eq(geom.y2 < geom.y1, true, "up stem: y2 above y1");
    }},

  { name: "stem down extends below lowest notehead by stemExtension notehead-heights", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:0,y:0}, crotchetDown:{x:0,y:0}, minimUp:{x:0,y:0}, minimDown:{x:0,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[100, 40], direction:"down", duration:"crotchet" });
      const noteheadHeightPx = s.semitoneHeight * cfg.display.pxPerSemi;
      eq(geom.y1, 40, "attaches at highest notehead (min y)");
      eq(geom.y2, 100 + cfg.display.stemExtension * noteheadHeightPx, "extends below lowest (max y)");
      eq(geom.y2 > geom.y1, true, "down stem: y2 below y1");
    }},

  { name: "anchor y offset shifts attachment point from notehead center", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:-40}, crotchetDown:{x:-10,y:40}, minimUp:{x:10,y:-40}, minimDown:{x:-10,y:40} }, semitoneHeight:2 };
      const up = CNBStem.geometry(cfg, { shape:s, scaleFactor:0.5, centerX:0, noteYPositions:[100], direction:"up", duration:"crotchet" });
      eq(up.y1, 100 + (-40 * 0.5), "up: y1 = noteY + anchor.y × scaleFactor");
      const down = CNBStem.geometry(cfg, { shape:s, scaleFactor:0.5, centerX:0, noteYPositions:[100], direction:"down", duration:"crotchet" });
      eq(down.y1, 100 + (40 * 0.5), "down: y1 = noteY + anchor.y × scaleFactor");
    }},

  { name: "geometry returns null for a stemless shape with no anchors property", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { semitoneHeight: 2 };
      const geom = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" });
      assert(geom === null, "should be null when anchors is undefined");
    }},

  { name: "geometry returns null for missing anchor key", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"down", duration:"minim" });
      assert(geom === null, "should be null when the selected anchor key is absent");
    }},

  { name: "thickness equals pctToPx default 26,16", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:0,y:0}, crotchetDown:{x:0,y:0}, minimUp:{x:0,y:0}, minimDown:{x:0,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" });
      const expected = CNBConfig.pctToPx(cfg.display.stemThicknessPct, cfg.display.pxPerSemi);
      eq(geom.thickness, expected);
    }},
];
