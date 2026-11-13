/**
 * mockup.js — clefs sized about an anchor (session 59).
 *
 * Draws index.html's cases with the Configurator's own card collection, on
 * the default 4-8 staff and on Kite 4-369's: the treble, bass, alto and
 * dozenal clefs at today's size beside the automatic size. Today's size is
 * the clefs as session 45 added them, built here so the comparison does not
 * follow the panel's definitions: LilyPond's size in staff spaces (a glyph
 * naturalHeight ÷ 250 staff spaces, the dozenal numeral 3). The automatic
 * size is the panel's own definition (CNBBuiltinClefs.definition, its
 * semitoneHeight null), LilyPond's size with each staff space drawn as the
 * staff's symbol space (CNBStaff.symbolSpace: the least of the noteheads'
 * mean height, one staff space and 3 semitones, the rule the sharps and
 * flats follow). Both are drawn by CNBClef as the build draws them, each
 * about its anchor point, marked in red: a standard clef's is on the line it
 * marks (reference.x, at the glyph's origin), the dozenal clef's its middle,
 * on the staff's middle line.
 *
 * Each caption carries data-clef, data-variant and data-height, which
 * screenshot.mjs checks.
 */
import { CNBConfig } from "../../../cnb/src/cnb-config.js";
import { CNBClef } from "../../../cnb/src/cnb-clef.js";
import { CNBStaff } from "../../../cnb/src/cnb-staff.js";
import { CNBCollection } from "../../../cnb/src/cnb-collection.js";
import { CNBMusic } from "../../../cnb/src/cnb-music.js";
import { CNBBuiltinClefs } from "../../../cnb/ui/builtin-clefs.js";

const PX_PER_SEMI = 9;
const NS = "http://www.w3.org/2000/svg";
const NOTES = [0, 4, 7];   // C, E and G crotchets beside the clef, for scale
/** LilyPond's font units in a staff space (Emmentaler's clefs). */
const UNITS_PER_STAFF_SPACE = 250;

function noteName(semi) {
  const { text, sharp } = CNBMusic.pcLabel(CNBMusic.pitchClass(semi));
  return text + (sharp ? "♯" : "");
}

const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

/**
 * The clef definition: the automatic one the panel adds, or today's, the
 * same clef at LilyPond's size in staff spaces.
 */
function clefDef(config, name, variant) {
  const auto = CNBBuiltinClefs.definition(config, name);
  if (variant === "automatic") return auto;
  const sps = config.staff.semitonesPerStaffSpace;
  if (name === "dozenal") return { ...auto, semitoneHeight: 3 * sps };
  return { ...auto, semitoneHeight: round(auto.naturalHeight / UNITS_PER_STAFF_SPACE * sps, 4) };
}

/** Mark the anchor point on a drawn clef, in its g's coordinates. */
function markAnchor(cell, config) {
  const g = cell.querySelector("g.cnb-clef");
  const shown = CNBClef.shown(config);
  if (!g || !shown) return;
  const { def, height } = shown;
  const dot = document.createElementNS(NS, "circle");
  dot.setAttribute("fill", "#d62f2f");
  if (def.kind === "dozenal") {
    // The g is in staff spaces (scaled with the height) from the middle line.
    const scale = Number(/scale\(([^)]+)\)/.exec(g.getAttribute("transform"))[1]);
    const width = CNBClef.measure(def, 1, 1).pixelWidth;   // at 3 staff spaces, in g units
    dot.setAttribute("cx", String(width / 2));
    dot.setAttribute("cy", "0");
    dot.setAttribute("r", String(3.5 / scale));
  } else {
    const sf = height * PX_PER_SEMI / def.naturalHeight;
    dot.setAttribute("cx", String((def.reference.x - (def.viewBoxMinX || 0)) * sf));
    dot.setAttribute("cy", String((def.reference.y - (def.viewBoxMinY || 0)) * sf));
    dot.setAttribute("r", "3.5");
  }
  g.appendChild(dot);
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
function variant(config, name, which, label) {
  const c = CNBConfig.clone(config);
  c.clef = { enabled: true, active: name, glyphs: { [name]: clefDef(config, name, which) }, gutter: { paddingH: 8 } };
  const cell = el("div", "variant");
  CNBCollection.render(cell, c, { pitchClasses: NOTES, durations: ["crotchet"] });
  // The anchor is marked once the cell is in the page.
  pending.push(() => markAnchor(cell, c));
  const { height, def } = CNBClef.shown(c);
  const anchorSemi = name === "dozenal" ? config.staff.midpoint : def.anchorSemi;
  const caption = el("div", "caption",
    `${label}: ${round(height)} semitones tall (${round(height / config.staff.semitonesPerStaffSpace)} ` +
    `staff spaces); sits on ${round(anchorSemi)} (${noteName(Math.round(anchorSemi))})`);
  caption.dataset.clef = name;
  caption.dataset.variant = which;
  caption.dataset.height = String(height);
  cell.appendChild(caption);
  return cell;
}

async function notations() {
  const kite = CNBConfig.merge(await (await fetch("../../../cnb/fixtures/kite-4-369-config.json")).json());
  const list = [
    { id: "default", name: "Default 4-8 staff", config: CNBConfig.createDefault() },
    { id: "kite", name: "Kite 4-369", config: kite },
  ];
  for (const n of list) n.config.display.pxPerSemi = PX_PER_SEMI;
  return list;
}

function draw(root, list) {
  for (const { id, name, config } of list) {
    const unit = CNBStaff.symbolSpace(config);
    const sps = config.staff.semitonesPerStaffSpace;
    const f = unit / sps;
    const card = el("section", "notation");
    card.dataset.notation = id;
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
      pair.appendChild(variant(config, clef.name, "today", "Today"));
      pair.appendChild(variant(config, clef.name, "automatic", "Automatic"));
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
