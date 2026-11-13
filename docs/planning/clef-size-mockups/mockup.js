/**
 * mockup.js — clefs sized about an anchor (session 59).
 *
 * Draws index.html's cases with the Configurator's own card collection, on
 * the default 4-8 staff and on Kite 4-369's: the treble, bass, alto and
 * dozenal clefs at today's size (CNBBuiltinClefs.definition, LilyPond's size
 * in staff spaces) beside the proposed automatic size, LilyPond's size with
 * each staff space drawn as the least of the noteheads' mean height, one staff
 * space and 3 semitones (CNBKeySignature.signHeight's automatic rule, which
 * the sharps and flats follow). The proposed size is scaled about the clef's
 * anchor point, marked in red: a standard clef's anchor is on the line it
 * marks (the glyph's origin), so its top is the marked semitone plus the
 * line's depth at the new height; the dozenal clef's is its middle, on the
 * staff's middle line. It is a sketch for the operator's pick, not the build:
 * the dozenal clef's size is prototyped by wrapping CNBClef's measure, extent
 * and render.
 */
import { CNBConfig } from "../../../cnb/src/cnb-config.js";
import { CNBClef } from "../../../cnb/src/cnb-clef.js";
import { CNBCollection } from "../../../cnb/src/cnb-collection.js";
import { CNBMusic } from "../../../cnb/src/cnb-music.js";
import { CNBBuiltinClefs } from "../../../cnb/ui/builtin-clefs.js";

const PX_PER_SEMI = 9;
const NS = "http://www.w3.org/2000/svg";
const NOTES = [0, 4, 7];   // C, E and G crotchets beside the clef, for scale

/** The marked line's pitch class and the anchor's x on it (font units). */
const STANDARD = {
  treble: { pc: 7, x: null },   // the curl's eye on the G line, found from the outline
  bass: { pc: 5, x: 608 },      // between the two dots, on the F line
  alto: { pc: 0, x: 318 },      // the middle, where the two halves meet on the C line
};

// ── The dozenal clef at a size: a scale about the middle line ─────────────
const measure = CNBClef.measure.bind(CNBClef);
CNBClef.measure = (def, pxPerSemi, space) => {
  const m = measure(def, pxPerSemi, space);
  const f = def.kind === "dozenal" ? def.mockScale ?? 1 : 1;
  return { ...m, pixelWidth: m.pixelWidth * f, pixelHeight: m.pixelHeight * f };
};
const extent = CNBClef.extent.bind(CNBClef);
CNBClef.extent = (config) => {
  const e = extent(config);
  const active = CNBClef.activeGlyph(config);
  const f = active && active.def.kind === "dozenal" ? active.def.mockScale ?? 1 : 1;
  if (!e || f === 1) return e;
  const mid = config.staff.midpoint;
  return { top: mid + (e.top - mid) * f, bottom: mid + (e.bottom - mid) * f };
};
const render = CNBClef.render.bind(CNBClef);
CNBClef.render = (svg, grid, config) => {
  const g = render(svg, grid, config);
  const active = CNBClef.activeGlyph(config);
  if (g && active.def.kind === "dozenal" && active.def.mockScale) {
    g.setAttribute("transform", g.getAttribute("transform")
      .replace(/scale\(([^)]+)\)/, (_, s) => `scale(${Number(s) * active.def.mockScale})`));
  }
  return g;
};

/** The least of the noteheads' mean height, one staff space and 3 semitones. */
function symbolSpace(config) {
  const heights = [];
  for (let pc = 0; pc < 12; pc++) {
    const head = CNBConfig.resolveNotehead(config, pc, "crotchet", null);
    const shape = config.shapes[head.shape];
    if (shape) heights.push(head.heightSemis ?? shape.semitoneHeight);
  }
  const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
  return Math.min(mean, config.staff.semitonesPerStaffSpace, 3);
}

/** The semitone of pc nearest the staff's middle, as the built-in clefs place it. */
function markedSemi(config, pc) {
  const mid = config.staff.midpoint;
  return pc + 12 * Math.round((mid - pc) / 12);
}

function noteName(semi) {
  const { text, sharp } = CNBMusic.pcLabel(CNBMusic.pitchClass(semi));
  return text + (sharp ? "♯" : "");
}

const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

/**
 * The clef definition and its anchor: today's, or scaled by f about the
 * anchor. { def, anchorSemi, anchorX } (anchorX in font units, a glyph's).
 */
function clefCase(config, name, f) {
  const today = CNBBuiltinClefs.definition(config, name);
  if (name === "dozenal") {
    return { def: f === 1 ? today : { ...today, mockScale: f }, anchorSemi: config.staff.midpoint };
  }
  const { pc, x } = STANDARD[name];
  const marked = markedSemi(config, pc);
  const height = today.semitoneHeight * f;
  const depth = -today.viewBoxMinY / today.naturalHeight * height;   // the line is the origin
  const def = { ...today, semitoneHeight: round(height, 4), anchorSemi: round(marked + depth, 4) };
  return { def, anchorSemi: marked, anchorX: x };
}

/** Mark the anchor point on a drawn clef, in its g's pixel coordinates. */
function markAnchor(cell, config, def, anchorX) {
  const g = cell.querySelector("g.cnb-clef");
  if (!g) return;
  const dot = document.createElementNS(NS, "circle");
  dot.setAttribute("fill", "#d62f2f");
  if (def.kind === "dozenal") {
    // The g is in staff spaces from the middle line: its middle across, on the line.
    const space = CNBClef.staffSpacePx(config, PX_PER_SEMI) * (def.mockScale ?? 1);
    const width = CNBClef.measure(def, PX_PER_SEMI, CNBClef.staffSpacePx(config, PX_PER_SEMI)).pixelWidth;
    dot.setAttribute("cx", String(width / 2 / space));
    dot.setAttribute("cy", "0");
    dot.setAttribute("r", String(3.5 / space));
  } else {
    const path = g.querySelector("path");
    const x = anchorX ?? curlEye(path, def);
    const sf = def.semitoneHeight * PX_PER_SEMI / def.naturalHeight;
    dot.setAttribute("cx", String((x - (def.viewBoxMinX || 0)) * sf));
    dot.setAttribute("cy", String((0 - (def.viewBoxMinY || 0)) * sf));
    dot.setAttribute("r", "3.5");
  }
  g.appendChild(dot);
}

/**
 * The treble clef's curl eye on the G line (y 0, font units): the gaps
 * between the outline's ink along the line, the innermost of the spiral's
 * being the one nearest the middle of the ink there.
 */
function curlEye(path) {
  const ink = [];
  for (let x = 0; x <= 700; x += 1) ink.push(path.isPointInFill(new DOMPoint(x, 0)));
  const first = ink.indexOf(true), last = ink.lastIndexOf(true);
  const gaps = [];
  for (let x = first, start = null; x <= last; x++) {
    if (!ink[x] && start === null) start = x;
    if (ink[x] && start !== null) { gaps.push([start, x]); start = null; }
  }
  const middle = (first + last) / 2;
  gaps.sort((a, b) => Math.abs((a[0] + a[1]) / 2 - middle) - Math.abs((b[0] + b[1]) / 2 - middle));
  return gaps.length ? (gaps[0][0] + gaps[0][1]) / 2 : middle;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Anchor marks to draw once the cases are in the page. */
const pending = [];

/** One variant: the collection with the clef shown, its anchor marked, and a caption. */
function variant(config, name, f, label) {
  const { def, anchorSemi, anchorX } = clefCase(config, name, f);
  const c = CNBConfig.clone(config);
  c.clef = { enabled: true, active: name, glyphs: { [name]: def }, gutter: { paddingH: 8 } };
  const cell = el("div", "variant");
  CNBCollection.render(cell, c, { pitchClasses: NOTES, durations: ["crotchet"] });
  // The anchor is marked once the cell is in the page, where the outline can be hit-tested.
  pending.push(() => markAnchor(cell, c, def, anchorX));
  const height = name === "dozenal"
    ? 3 * config.staff.semitonesPerStaffSpace * f
    : def.semitoneHeight;
  cell.appendChild(el("div", "caption",
    `${label}: ${round(height)} semitones tall (${round(height / config.staff.semitonesPerStaffSpace)} ` +
    `staff spaces); sits on ${round(anchorSemi)} (${noteName(Math.round(anchorSemi))})`));
  return cell;
}

async function notations() {
  const kite = CNBConfig.merge(await (await fetch("../../../cnb/fixtures/kite-4-369-config.json")).json());
  const list = [
    { name: "Default 4-8 staff", config: CNBConfig.createDefault() },
    { name: "Kite 4-369", config: kite },
  ];
  for (const n of list) n.config.display.pxPerSemi = PX_PER_SEMI;
  return list;
}

function draw(root, list) {
  for (const { name, config } of list) {
    const unit = symbolSpace(config);
    const sps = config.staff.semitonesPerStaffSpace;
    const f = unit / sps;
    const card = el("section", "notation");
    card.appendChild(el("h3", null, name));
    card.appendChild(el("p", null,
      `${sps} semitones a staff space; the noteheads' mean height ${round(unit, 3)} semitones, so the ` +
      `automatic size draws a staff space as ${round(unit, 3)} semitones: ${Math.round(f * 100)}% of ` +
      `today's size${f === 1 ? " (unchanged here)" : ""}.`));
    const grid = el("div", "clefs");
    for (const clef of CNBBuiltinClefs.CHOICES) {
      const cell = el("div", "clef-case");
      cell.appendChild(el("h4", null, clef.displayName));
      const pair = el("div", "pair");
      pair.appendChild(variant(config, clef.name, 1, "Today"));
      pair.appendChild(variant(config, clef.name, f, "Automatic"));
      cell.appendChild(pair);
      grid.appendChild(cell);
    }
    card.appendChild(grid);
    root.appendChild(card);
  }
}

draw(document.getElementById("clef-cases"), await notations());
for (const mark of pending) mark();
document.body.setAttribute("data-ready", "");
