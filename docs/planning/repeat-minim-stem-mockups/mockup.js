/**
 * mockup.js — a repeated minim's stem on its notehead (session 72).
 *
 * Draws index.html's cases with the Configurator's own card collection, in
 * repeat mode at the default overlap, on the default notehead, Kite 4-369
 * (with its own minim anchors and with its crotchet anchors) and the
 * tutorial's diamonds. The rule is prototyped by wrapping CNBStem.geometry,
 * which the card calls with the group's width scale: the rule draws the
 * single head's stem (width scale 1) moved onto the last head of the group
 * when the stem is up and the first when it is down. With two heads each
 * (1 − overlap) head widths apart, those heads' centres are half a step
 * either side of the group's centre, and the step is (widthScale − 1) head
 * widths. It is a sketch for the operator's pick, not the build.
 */
import { CNBConfig } from "../../../cnb/src/cnb-config.js";
import { CNBStem } from "../../../cnb/src/cnb-stem.js";
import { CNBCollection } from "../../../cnb/src/cnb-collection.js";

const PX_PER_SEMI = 14;
const PCS = [0, 9];   // C: stem up; A: stem down (the octave chord's average against the middle)

/** What the wrapped geometry draws: "today" (across the group) or "rule" (on one head). */
let mode = "today";

const geometry = CNBStem.geometry.bind(CNBStem);
CNBStem.geometry = (config, opts) => {
  const widthScale = opts.widthScale ?? 1;
  if (mode === "today" || widthScale === 1) return geometry(config, opts);
  const one = geometry(config, { ...opts, widthScale: 1 });
  if (!one) return one;
  const scaleX = opts.scaleX ?? opts.scaleFactor;
  const headWidth = opts.shape.naturalWidth * scaleX;
  const half = (widthScale - 1) * headWidth / 2;   // the chosen head's centre from the group's
  return { ...one, x: one.x + (opts.direction === "up" ? half : -half) };
};

/** The notations, in repeat mode at the mock-ups' size. */
async function notations() {
  const load = async (url) => CNBConfig.merge(await (await fetch(url)).json());
  const kite = await load("../../../cnb/fixtures/kite-4-369-config.json");
  const kiteCentred = CNBConfig.clone(kite);
  for (const shape of Object.values(kiteCentred.shapes)) {
    if (!shape.anchors) continue;
    shape.anchors.minimUp = { ...shape.anchors.crotchetUp };
    shape.anchors.minimDown = { ...shape.anchors.crotchetDown };
  }
  const list = [
    { name: "Default notehead (side stems)", config: CNBConfig.createDefault() },
    { name: "Kite 4-369, its own minim anchors (0.73 semitones off centre)", config: kite },
    { name: "Kite 4-369, its crotchet anchors (centred) for the minim", config: kiteCentred },
    { name: "The tutorial's diamonds (centred stems)",
      config: await load("../../playbook/tutorial/downloads/tutorial.json") },
  ];
  for (const n of list) {
    n.config.durations.representationMode = "repeat";
    n.config.display.pxPerSemi = PX_PER_SEMI;
  }
  return list;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** One variant: a caption and the collection drawn under the given mode. */
function variant(config, caption, m, durations) {
  const cell = el("div", "variant");
  cell.appendChild(el("div", "caption", caption));
  mode = m;
  CNBCollection.render(cell, config, { pitchClasses: PCS, durations });
  mode = "today";
  return cell;
}

function draw(root, list) {
  for (const { name, config } of list) {
    const card = el("section", "notation");
    card.appendChild(el("h3", null, name));
    const row = el("div", "variants");
    row.appendChild(variant(config, "The crotchet, for reference", "today", ["crotchet"]));
    row.appendChild(variant(config, "The minim today: the anchor's share of the whole group", "today", ["minim"]));
    row.appendChild(variant(config, "The minim by the rule: up on the last head, down on the first", "rule", ["minim"]));
    card.appendChild(row);
    root.appendChild(card);
  }
}

draw(document.getElementById("stem-cases"), await notations());
document.body.setAttribute("data-ready", "");
