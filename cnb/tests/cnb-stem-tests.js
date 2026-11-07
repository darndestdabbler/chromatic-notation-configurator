/**
 * cnb-stem-tests.js — Unit tests for Module 8 (Stem)
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBStem } from "../src/cnb-stem.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";

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
      const half = crotchet.thickness / 2;
      eq(crotchet.x, 10 - half, "crotchetUp anchor x (right edge on the anchor)");
      eq(minim.x, 20 - half, "minimUp anchor x");
    }},

  { name: "crotchet vs minim anchor selection (down)", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0}, crotchetDown:{x:-10,y:0}, minimUp:{x:20,y:0}, minimDown:{x:-20,y:0} }, semitoneHeight:2 };
      const crotchet = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"down", duration:"crotchet" });
      const minim    = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"down", duration:"minim" });
      const half = crotchet.thickness / 2;
      eq(crotchet.x, -10 + half, "crotchetDown anchor x (left edge on the anchor)");
      eq(minim.x, -20 + half, "minimDown anchor x");
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

  { name: "geometry puts the stem's edge on the anchor, as LilyPond does: an up stem's right edge, a down stem's left edge", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0}, crotchetDown:{x:-10,y:0}, minimUp:{x:10,y:0}, minimDown:{x:-10,y:0} }, semitoneHeight:2 };
      const up = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:50, noteYPositions:[0], direction:"up", duration:"crotchet" });
      const down = CNBStem.geometry(cfg, { shape:s, scaleFactor:1, centerX:50, noteYPositions:[0], direction:"down", duration:"crotchet" });
      eq(up.x + up.thickness / 2, 60, "up: right edge at the anchor");
      eq(down.x - down.thickness / 2, 40, "down: left edge at the anchor");
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

  // ── Axis path (set 014 s2, design §2.5) ──────────────────────────────

  { name: "direction (axis): axis-position average vs the midpoint's axis position", fn: () => {
      const axis = twinlineAxis();                  // midpoint G = semi 7 → axis 4
      // C♯ octave pair [1, 13]: linear avg 7 ≥ 7 → down; axis avg (0 + 7)/2 = 3.5 < 4 → up.
      eq(CNBStem.direction([1, 13], 7), "down", "linear");
      eq(CNBStem.direction([1, 13], 7, axis), "up", "axis");
      // F pair [5, 17]: axis avg (3 + 10)/2 = 6.5 ≥ 4 → down.
      eq(CNBStem.direction([5, 17], 7, axis), "down", "axis F pair");
    }},

  { name: "direction (axis): a note sharing the midpoint's axis position ties → down", fn: () => {
      // Midpoint A (semi 9, axis 5); G♯ (8) shares axis 5: linear 8 < 9 → up, axis tie → down.
      const axis = twinlineAxis();
      eq(CNBStem.direction([8], 9), "up", "linear");
      eq(CNBStem.direction([8], 9, axis), "down", "axis: tie on a shared position → down");
    }},

  { name: "direction: a disabled axis runs the linear body", fn: () => {
      const axis = CNBPitchAxis.create(CNBConfig.createDefault());
      eq(axis.enabled, false, "inactive axis");
      eq(CNBStem.direction([8], 9, axis), "up", "linear result");
    }},
  { name: "geometry widthScale: default 1 is unchanged; 2 doubles the anchor's x offset only", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:-4}, crotchetDown:{x:-10,y:4}, minimUp:{x:6,y:-4}, minimDown:{x:-6,y:4} }, semitoneHeight:2 };
      const opts = { shape:s, scaleFactor:1.5, centerX:50, noteYPositions:[100, 40], direction:"up", duration:"minim" };
      const plain = CNBStem.geometry(cfg, opts);
      eq(JSON.stringify(CNBStem.geometry(cfg, { ...opts, widthScale: 1 })), JSON.stringify(plain), "explicit 1 = default");
      eq(plain.x, 50 + 6 * 1.5 - plain.thickness / 2, "default x");
      const doubled = CNBStem.geometry(cfg, { ...opts, widthScale: 2 });
      eq(doubled.x, 50 + 2 * 6 * 1.5 - plain.thickness / 2, "x offset doubled");
      eq(doubled.y1, plain.y1, "y1 unchanged");
      eq(doubled.y2, plain.y2, "y2 unchanged");
    }},
  { name: "geometry scaleX (session 22): default scaleFactor is unchanged; a sized notehead's scaleX moves the anchor x only", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:-4}, crotchetDown:{x:-10,y:4}, minimUp:{x:6,y:-4}, minimDown:{x:-6,y:4} }, semitoneHeight:2 };
      const opts = { shape:s, scaleFactor:1.5, centerX:50, noteYPositions:[100, 40], direction:"up", duration:"crotchet" };
      const plain = CNBStem.geometry(cfg, opts);
      eq(JSON.stringify(CNBStem.geometry(cfg, { ...opts, scaleX: 1.5 })), JSON.stringify(plain), "scaleX = scaleFactor is the default");
      const wide = CNBStem.geometry(cfg, { ...opts, scaleX: 3 });
      eq(wide.x, 50 + 10 * 3 - plain.thickness / 2, "anchor x follows scaleX");
      eq(wide.y1, plain.y1, "anchor y follows scaleFactor");
      eq(wide.y2, plain.y2, "y2 unchanged");
      const down = CNBStem.geometry(cfg, { ...opts, direction: "down", scaleX: 3, widthScale: 2 });
      eq(down.x, 50 - 10 * 3 * 2 + plain.thickness / 2, "scaleX composes with widthScale");
    }},
];

function twinlineAxis() {
  const cfg = CNBConfig.createDefault();
  cfg.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
  };
  return CNBPitchAxis.create(cfg);
}
