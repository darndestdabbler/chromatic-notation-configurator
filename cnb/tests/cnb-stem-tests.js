/**
 * cnb-stem-tests.js — Unit tests for Module 8 (Stem)
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBStem } from "../src/cnb-stem.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { findEngine, measureStems } from "./engine-probe.js";

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
      const geom = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" });
      assert(geom === null, "should be null");
    }},

  { name: "geometry returns null for non-stem duration", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = { anchors: { crotchetUp:{x:1,y:0}, crotchetDown:{x:-1,y:0}, minimUp:{x:1,y:0}, minimDown:{x:-1,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"semibreve" });
      assert(geom === null, "should be null for semibreve");
    }},

  { name: "stemX sign reflects anchor.x and direction", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0}, crotchetDown:{x:-10,y:0}, minimUp:{x:10,y:0}, minimDown:{x:-10,y:0} }, semitoneHeight:2 };
      const upGeom = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:5, noteYPositions:[0], direction:"up", duration:"crotchet" });
      eq(upGeom.x > 5, true, "stem for up should be right of center");
      const downGeom = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:5, noteYPositions:[0], direction:"down", duration:"crotchet" });
      eq(downGeom.x < 5, true, "stem for down should be left of center");
    }},

  { name: "geometry: a shape's reference point moves the stem's attached end with the head, not its far end", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:-20}, crotchetDown:{x:-10,y:20}, minimUp:{x:10,y:-20}, minimDown:{x:-10,y:20} }, semitoneHeight:2 };
      const placed = { ...s, reference: { x: 7, y: 30 } };
      for (const direction of ["up", "down"]) {
        const opts = { gridContext: grid(cfg), scaleFactor:0.5, centerX:0, noteYPositions:[200, 300], direction, duration:"crotchet" };
        const plain = CNBStem.geometry(cfg, { ...opts, shape: s });
        const moved = CNBStem.geometry(cfg, { ...opts, shape: placed });
        approx(moved.y1, plain.y1 - 15, `${direction}: the attached end 30 × 0.5 px higher, with the head`);
        approx(moved.y2, plain.y2, `${direction}: the far end where it was`);
        approx(moved.x, plain.x, `${direction}: x unchanged`);
      }
    }},

  { name: "crotchet vs minim anchor selection (up)", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0}, crotchetDown:{x:-10,y:0}, minimUp:{x:20,y:0}, minimDown:{x:-20,y:0} }, semitoneHeight:2 };
      const crotchet = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" });
      const minim    = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"minim" });
      approx(crotchet.x, 10, "crotchetUp anchor x (the stem's centre on the anchor)");
      approx(minim.x, 20, "minimUp anchor x");
    }},

  { name: "crotchet vs minim anchor selection (down)", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0}, crotchetDown:{x:-10,y:0}, minimUp:{x:20,y:0}, minimDown:{x:-20,y:0} }, semitoneHeight:2 };
      const crotchet = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"down", duration:"crotchet" });
      const minim    = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"down", duration:"minim" });
      approx(crotchet.x, -10, "crotchetDown anchor x (the stem's centre on the anchor)");
      approx(minim.x, -20, "minimDown anchor x");
    }},

  // The engine's stem (session 34). On the default grid the middle line is at
  // y 256 and a half staff space is 32 px.
  { name: "geometry: an up stem attaches at the lowest notehead and runs 3.5 staff spaces past a far notehead below the middle line", fn: () => {
      const cfg = CNBConfig.createDefault();
      const g = grid(cfg);
      const s = { anchors: { crotchetUp:{x:0,y:0}, crotchetDown:{x:0,y:0}, minimUp:{x:0,y:0}, minimDown:{x:0,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { gridContext: g, shape:s, scaleFactor:1, centerX:0, noteYPositions:[g.semiToY(0), g.semiToY(8)], direction:"up", duration:"crotchet" });
      eq(geom.y1, g.semiToY(0), "attaches at the lowest notehead (max y)");
      eq(geom.y2, g.semiToY(8) - 7 * 32, "3.5 staff spaces above the highest");
    }},

  { name: "geometry: a stem whose far notehead is on the middle line is shortened, up and down, as LilyPond engraves it", fn: () => {
      const cfg = CNBConfig.createDefault();
      const g = grid(cfg);
      const s = { anchors: { crotchetUp:{x:0,y:0}, crotchetDown:{x:0,y:0}, minimUp:{x:0,y:0}, minimDown:{x:0,y:0} }, semitoneHeight:2 };
      const up = CNBStem.geometry(cfg, { gridContext: g, shape:s, scaleFactor:1, centerX:0, noteYPositions:[g.semiToY(0), g.semiToY(12)], direction:"up", duration:"minim" });
      approx(up.y2, 256 - (20 / 3) * 32, "up: 10/3 staff spaces above the middle line (engine render)");
      const down = CNBStem.geometry(cfg, { gridContext: g, shape:s, scaleFactor:1, centerX:0, noteYPositions:[g.semiToY(12), g.semiToY(24)], direction:"down", duration:"crotchet" });
      eq(down.y1, g.semiToY(24), "down: attaches at the highest notehead (min y)");
      approx(down.y2, 256 + (20 / 3) * 32, "down: 10/3 staff spaces below the middle line");
    }},

  { name: "length: 3.5 staff spaces, shortened by a third of the reach past the staff, by at most 1 staff space", fn: () => {
      const fourEight = [-4, -2, 2, 4];               // radius 4 half spaces
      eq(CNBStem.length(-0.5, fourEight), 7, "far notehead short of the middle line: full length");
      approx(CNBStem.length(0, fourEight), 20 / 3, "on the middle line");
      approx(CNBStem.length(2.5, fourEight), 7 - 3.5 / 3, "2.5 half spaces past it");
      eq(CNBStem.length(10, fourEight), 5, "shortened by at most 2 half spaces");
      const wider = [-6, -4, -2, 0, 2, 4];            // radius 5
      eq(CNBStem.length(0, wider), 7, "a wider staff shortens later");
      approx(CNBStem.length(1.5, wider), 6.5, "1.5 past the middle on the wider staff (engine render)");
    }},

  { name: "anchor y offset shifts attachment point from notehead center", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:-40}, crotchetDown:{x:-10,y:40}, minimUp:{x:10,y:-40}, minimDown:{x:-10,y:40} }, semitoneHeight:2 };
      const up = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:0.5, centerX:0, noteYPositions:[100], direction:"up", duration:"crotchet" });
      eq(up.y1, 100 + (-40 * 0.5), "up: y1 = noteY + anchor.y × scaleFactor");
      const down = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:0.5, centerX:0, noteYPositions:[100], direction:"down", duration:"crotchet" });
      eq(down.y1, 100 + (40 * 0.5), "down: y1 = noteY + anchor.y × scaleFactor");
    }},

  { name: "geometry centres the stem on the anchor, as the SVG's stem rect draws it (session 40): a centred anchor centres the stem", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0}, crotchetDown:{x:-10,y:0}, minimUp:{x:0,y:0}, minimDown:{x:0,y:0} }, semitoneHeight:2 };
      const at = (direction, duration) => CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:50, noteYPositions:[0], direction, duration });
      approx(at("up", "crotchet").x, 60, "up: centre on the anchor");
      approx(at("down", "crotchet").x, 40, "down: centre on the anchor");
      approx(at("up", "minim").x, 50, "a centred anchor centres an up stem");
      approx(at("down", "minim").x, 50, "and a down stem");
    }},

  { name: "THICKNESS is the engine's stem, 0.13 staff spaces", fn: () => {
      eq(CNBStem.THICKNESS, 0.13);
    }},

  { name: "geometry returns null for a stemless shape with no anchors property", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { semitoneHeight: 2 };
      const geom = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" });
      assert(geom === null, "should be null when anchors is undefined");
    }},

  { name: "geometry returns null for missing anchor key", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"down", duration:"minim" });
      assert(geom === null, "should be null when the selected anchor key is absent");
    }},

  { name: "thickness is the engine's 0.13 staff spaces (linear: 4 semitones per staff space)", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:0,y:0}, crotchetDown:{x:0,y:0}, minimUp:{x:0,y:0}, minimDown:{x:0,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" });
      approx(geom.thickness, 0.13 * 4 * 16, "0.13 × 64 px");
      cfg.display.stemThicknessPct = 80;              // retired (session 34): not read
      approx(CNBStem.geometry(cfg, { gridContext: grid(cfg), shape:s, scaleFactor:1, centerX:0, noteYPositions:[0], direction:"up", duration:"crotchet" }).thickness,
        0.13 * 4 * 16, "stemThicknessPct is not read");
    }},

  // Engine-backed (session 34): LilyPond carries the stem of a note far from
  // the staff to the middle line, but the engine sets no-stem-extend, so it
  // does not (engine cnb/layout.ly). A note well below the staff (E, two
  // staff spaces under the lowest line) stems up, and one well above (C'''',
  // three octaves up) stems down; each engraves 3.5 staff spaces long, short
  // of the middle line, where the preview draws it (±0.001 staff spaces).
  // Skips with the reason logged without LilyPond or the engine.
  { name: "geometry (engine): far from the staff a stem is not carried to the middle line, as the engine engraves it", fn: async () => {
      const cfg = CNBConfig.createDefault();
      const g = CNBGrid.create(cfg, { minSemi: -12, maxSemi: 40 });
      const shape = cfg.shapes["crotchet-minim"];
      const { scaleFactor } = CNBNotehead.measure(shape, g.pxPerSemi);
      const middleY = g.semiToY(cfg.staff.midpoint);
      const cases = [{ semi: -8, pitch: "e" }, { semi: 36, pitch: "c''''" }].map(c => {
        const direction = CNBStem.direction([c.semi], cfg.staff.midpoint);
        const geom = CNBStem.geometry(cfg, { gridContext: g, shape, scaleFactor, centerX: 0,
          noteYPositions: [g.semiToY(c.semi)], direction, duration: "crotchet" });
        const [a, b] = [geom.y1, geom.y2].map(y => (middleY - y) / 64);
        return { ...c, dir: direction === "up" ? 1 : -1, bottom: Math.min(a, b), top: Math.max(a, b) };
      });
      eq(cases.map(c => c.dir).join(), "1,-1", "E stems up, C'''' down");
      assert(cases[0].top < -1 && cases[1].bottom > 1, "both stems end well short of the middle line");
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const { stems, error } = await measureStems(engine, CNBLilypond.generate(cfg), cases.map(c => c.pitch + "4").join(" "));
      assert(!error, `the export must engrave: ${error}`);
      eq(stems.length, 2, "two stems");
      cases.forEach((c, i) => {
        eq(stems[i].direction, c.dir, `${c.pitch}: direction`);
        for (const k of ["bottom", "top"]) {
          assert(Math.abs(stems[i][k] - c[k]) <= 1e-3, `${c.pitch} ${k}: engraved ${stems[i][k]}, preview ${c[k]}`);
        }
      });
    }},

  { name: "thickness and length (axis): one staff space is axisUnitsPerStaffSpace axis units", fn: () => {
      const cfg = twinlineConfig();                   // 2 axis units per staff space, midpoint G (axis 4)
      const g = grid(cfg);
      const s = { anchors: { crotchetUp:{x:0,y:0}, crotchetDown:{x:0,y:0}, minimUp:{x:0,y:0}, minimDown:{x:0,y:0} }, semitoneHeight:2 };
      const geom = CNBStem.geometry(cfg, { gridContext: g, shape:s, scaleFactor:1, centerX:0, noteYPositions:[g.semiToY(0)], direction:"up", duration:"crotchet" });
      approx(geom.thickness, 0.13 * 2 * 16, "0.13 × 32 px");
      // C (axis 0) is 4 half spaces below the middle line: the full 3.5 staff spaces.
      approx(geom.y2, g.semiToY(0) - 7 * 16, "7 half spaces of 16 px");
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
  { name: "geometry widthScale: default 1 is unchanged; 2 doubles the anchored edge's x offset, as LilyPond scales the attachment across the group", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:-4}, crotchetDown:{x:-10,y:4}, minimUp:{x:6,y:-4}, minimDown:{x:-6,y:4} }, semitoneHeight:2 };
      const opts = { gridContext: grid(cfg), shape:s, scaleFactor:1.5, centerX:50, noteYPositions:[100, 40], direction:"up", duration:"minim" };
      const plain = CNBStem.geometry(cfg, opts);
      const half = plain.thickness / 2;
      eq(JSON.stringify(CNBStem.geometry(cfg, { ...opts, widthScale: 1 })), JSON.stringify(plain), "explicit 1 = default");
      approx(plain.x, 50 + 6 * 1.5, "default x: the centre on the anchor");
      const doubled = CNBStem.geometry(cfg, { ...opts, widthScale: 2 });
      approx(doubled.x + half, 50 + 2 * (6 * 1.5 + half), "the right edge's offset doubled");
      eq(doubled.y1, plain.y1, "y1 unchanged");
      eq(doubled.y2, plain.y2, "y2 unchanged");
    }},
  { name: "geometry scaleX (session 22): default scaleFactor is unchanged; a sized notehead's scaleX moves the anchor x only", fn: () => {
      const cfg = CNBConfig.createDefault();
      const s = { anchors: { crotchetUp:{x:10,y:-4}, crotchetDown:{x:-10,y:4}, minimUp:{x:6,y:-4}, minimDown:{x:-6,y:4} }, semitoneHeight:2 };
      const opts = { gridContext: grid(cfg), shape:s, scaleFactor:1.5, centerX:50, noteYPositions:[100, 40], direction:"up", duration:"crotchet" };
      const plain = CNBStem.geometry(cfg, opts);
      eq(JSON.stringify(CNBStem.geometry(cfg, { ...opts, scaleX: 1.5 })), JSON.stringify(plain), "scaleX = scaleFactor is the default");
      const wide = CNBStem.geometry(cfg, { ...opts, scaleX: 3 });
      approx(wide.x, 50 + 10 * 3, "anchor x follows scaleX");
      eq(wide.y1, plain.y1, "anchor y follows scaleFactor");
      eq(wide.y2, plain.y2, "y2 unchanged");
      const half = plain.thickness / 2;
      const down = CNBStem.geometry(cfg, { ...opts, direction: "down", scaleX: 3, widthScale: 2 });
      approx(down.x - half, 50 + 2 * (-10 * 3 - half), "scaleX composes with widthScale (the left edge)");
    }},
];

/** The grid a card draws on (default 4-8: 16 px per semitone, 64 px per staff space, middle line at semitone 12). */
function grid(cfg) {
  return CNBGrid.create(cfg, { minSemi: -4, maxSemi: 28 });
}

function approx(a, b, msg, tol = 1e-9) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
}

function twinlineAxis() {
  return CNBPitchAxis.create(twinlineConfig());
}

function twinlineConfig() {
  const cfg = CNBConfig.createDefault();
  cfg.staff.midpoint = 7;
  cfg.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
  };
  return cfg;
}
