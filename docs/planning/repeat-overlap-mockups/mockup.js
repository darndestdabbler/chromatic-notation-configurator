/**
 * mockup.js — the repeated noteheads' overlap and the breve's tie (session 58).
 *
 * Draws index.html's cases with the Configurator's own card collection, in
 * repeat mode, on the default 4-8, Kite 4-369 and 45deg-369 noteheads. Two
 * things are prototyped by wrapping CNBCard.repeatLayout, which the card and
 * the collection call: the copies' overlap as a fraction of the head's own
 * width (today it is engine.multinotePadding, -0.5 staff spaces), and the
 * breve's tie from the middle of the first semibreve group to the middle of
 * the second (today it runs from the first head's centre to the last's).
 * Both ties are drawn with CNBCard.tiePath, at the heads' bottom. It is a
 * sketch for the operator's pick, not the build.
 */
import { CNBConfig } from "../../../cnb/src/cnb-config.js";
import { CNBNotehead } from "../../../cnb/src/cnb-notehead.js";
import { CNBCard } from "../../../cnb/src/cnb-card.js";
import { CNBCollection } from "../../../cnb/src/cnb-collection.js";

const PX_PER_SEMI = 12;
const TIE_GAP = 1;   // staff spaces between a breve's two groups, as today

/** What the wrapped layout draws: overlap null = today's padding; tie "today" | "groups". */
let mode = { overlap: null, tie: "today" };

const todayLayout = CNBCard.repeatLayout.bind(CNBCard);
CNBCard.repeatLayout = (config, grid, shape, duration, size) => {
  const today = todayLayout(config, grid, shape, duration, size);
  if (today.count === 1) return today;
  const perGroup = CNBCard.repeatCount(config, duration);
  const groups = CNBCard.tiedGroups(config, duration);
  const { pixelWidth } = CNBNotehead.measure(shape, grid.pxPerSemi, size);
  const step = mode.overlap === null ? today.offsets[1] - today.offsets[0] : pixelWidth * (1 - mode.overlap);
  const width = pixelWidth + (perGroup - 1) * step;
  const gap = TIE_GAP * today.staffSpacePx;
  const pitch = width + gap;
  const offsets = [];
  const centres = [];
  for (let g = 0; g < groups; g++) {
    const centre = (g - (groups - 1) / 2) * pitch;
    centres.push(centre);
    for (let i = 0; i < perGroup; i++) offsets.push(centre + (i - (perGroup - 1) / 2) * step);
  }
  const dy = today.ties.length ? today.ties[0].dy : 0;
  const ties = groups < 2 ? []
    : mode.tie === "groups"
      ? [{ x1: centres[0], x2: centres[centres.length - 1], dy }]
      : [{ x1: offsets[0], x2: offsets[offsets.length - 1], dy }];
  return { ...today, offsets, groupWidth: groups * width + (groups - 1) * gap, ties };
};

/** The three notations, in repeat mode at the mock-ups' size. */
async function notations() {
  const load = async (file) => CNBConfig.merge(await (await fetch(`../../../cnb/fixtures/${file}`)).json());
  const list = [
    { name: "Default 4-8 notehead", config: CNBConfig.createDefault() },
    { name: "Kite 4-369", config: await load("kite-4-369-config.json") },
    { name: "45deg-369", config: await load("45deg-369-config.json") },
  ];
  for (const n of list) {
    n.config.durations.representationMode = "repeat";
    n.config.display.pxPerSemi = PX_PER_SEMI;
  }
  return list;
}

/** Today's overlap as a share of the head's width at a pitch class. */
function todayShare(config, pc) {
  const resolved = CNBCard.resolveNotehead(config, pc, "semibreve", null);
  const widthSemis = CNBNotehead.measure(config.shapes[resolved.shape], 1, resolved).pixelWidth;
  const padding = config.engine.multinotePadding ?? -0.5;
  return -padding * config.staff.semitonesPerStaffSpace / widthSemis;
}

const pct = (f) => `${Math.round(f * 100)}%`;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** One variant: a caption and the collection drawn under the given mode. */
function variant(config, caption, m, durations, pc) {
  const cell = el("div", "variant");
  cell.appendChild(el("div", "caption", caption));
  mode = m;
  CNBCollection.render(cell, config, { pitchClasses: [pc], durations });
  mode = { overlap: null, tie: "today" };
  return cell;
}

const PC = 0;   // C: on the default staff it takes ledgers, so their width shows too

function drawOverlap(root, list) {
  for (const { name, config } of list) {
    const share = todayShare(config, PC);
    const card = el("section", "notation");
    card.appendChild(el("h3", null, name));
    const row = el("div", "variants");
    row.appendChild(variant(config,
      `Today: −0.5 staff spaces, ${pct(share)} of the head's width`,
      { overlap: null, tie: "today" }, ["minim", "semibreve", "breve"], PC));
    row.appendChild(variant(config,
      "1/3 of the head's width (33%)",
      { overlap: 1 / 3, tie: "today" }, ["minim", "semibreve", "breve"], PC));
    card.appendChild(row);
    root.appendChild(card);
  }
}

function drawTie(root, list) {
  for (const { name, config } of list) {
    const share = todayShare(config, PC);
    const card = el("section", "notation");
    card.appendChild(el("h3", null, `${name}: the breve`));
    const grid = el("div", "variants two-by-two");
    for (const [overlap, label] of [[null, `today's overlap (${pct(share)})`], [1 / 3, "1/3 overlap"]]) {
      grid.appendChild(variant(config, `Today's tie, first head's centre to the last's — ${label}`,
        { overlap, tie: "today" }, ["breve"], PC));
      grid.appendChild(variant(config, `Middle of the first group to the middle of the second — ${label}`,
        { overlap, tie: "groups" }, ["breve"], PC));
    }
    card.appendChild(grid);
    root.appendChild(card);
  }
}

const list = await notations();
drawOverlap(document.getElementById("overlap-cases"), list);
drawTie(document.getElementById("tie-cases"), list);
document.body.setAttribute("data-ready", "");
