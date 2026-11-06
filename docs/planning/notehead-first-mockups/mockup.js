/**
 * mockup.js: shared drawing for the notehead-first editor mock-ups.
 *
 * Draws the staff canvas with the real preview modules (cnb/src), at a
 * fixed size on one row or two (design §6.1), plus the label strip (§4.2), a close-up
 * of one notehead, shape thumbnails, and the rule inference of design §5
 * in miniature, so the rule list shows what the algorithm really infers.
 *
 * Served from the repository root (screenshot.mjs does this), because ES
 * modules do not load from file://.
 */
import { CNBConfig } from "../../../cnb/src/cnb-config.js";
import { CNBCollection } from "../../../cnb/src/cnb-collection.js";
import { CNBGrid } from "../../../cnb/src/cnb-grid.js";
import { CNBNotehead } from "../../../cnb/src/cnb-notehead.js";
import { CNBCard } from "../../../cnb/src/cnb-card.js";

const NS = "http://www.w3.org/2000/svg";
export const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const ACCIDENTALS = [1, 3, 6, 8, 10];
const ROW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ── Configs ────────────────────────────────────────────────────────────

/** The default config (4-8 staff, the oval notehead). */
export function defaultConfig() {
  return CNBConfig.createDefault();
}

/** Fetch a repository JSON config and merge it over the defaults. */
export async function loadConfig(path) {
  const res = await fetch(new URL("../../../" + path, import.meta.url));
  return CNBConfig.merge(CNBConfig.createDefault(), await res.json());
}

/** The 13 placeholders: every pitch class with the default look (design §1). */
export function placeholders(config) {
  const c = CNBConfig.clone(config);
  c.noteheadRules = [c.noteheadRules[0]];
  c.noteheadRules[0].apply = { ...c.noteheadRules[0].apply, hollow: false, color: null };
  c.palette = { ...c.palette, colors: [], cbSafeColors: [] };
  return c;
}

/**
 * A pitch axis rewritten as nudges (design §3.3): stride 12, C fixed at 0,
 * staff spacing = axisUnitsPerStaffSpace × 12 / octaveStride.
 */
export function nudgeForm(config) {
  const c = CNBConfig.clone(config);
  const ax = c.pitchAxis;
  const pos = pc => ax.pitchClasses.find(e => e.pc === pc).position;
  const k = 12 / ax.octaveStride;
  const nudges = NAMES.map((_, pc) => (pos(pc) - pos(0)) * k - pc);
  const sps = ax.axisUnitsPerStaffSpace * k;
  c.staff.semitonesPerStaffSpace = sps;
  c.pitchAxis = {
    enabled: true, kind: "pitch-class-map-v1", octaveStride: 12, axisUnitsPerStaffSpace: sps,
    pitchClasses: nudges.map((n, pc) => ({ pc, position: pc + n })),
  };
  return { config: c, nudges };
}

// ── The look table and inference (design §0.4, §5) ─────────────────────

export function lookTable(config) {
  return NAMES.map((_, pc) => {
    const r = CNBConfig.resolveNotehead(config, pc, "crotchet", null);
    return {
      shape: r.shape,
      hollow: r.hollow,
      color: (r.color ?? CNBConfig.resolveColor(config, pc) ?? "#000000").toLowerCase(),
      side: r.xOffsetStaffSpaces || 0,
    };
  });
}

function list(pcs) {
  const n = pcs.map(pc => NAMES[pc]);
  return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
}

/** Infer one attribute: default value, period, and one group per other value. */
export function inferAttribute(values) {
  const counts = new Map();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  let def = values[0];
  for (const [v, n] of counts) if (n > counts.get(def)) def = v;
  const period = [1, 2, 3, 4, 6].find(p => values.every((v, i) => v === values[(i + p) % 12])) ?? 12;
  const groups = [...counts.keys()].filter(v => v !== def).map(v => {
    const pcs = values.map((x, pc) => (x === v ? pc : -1)).filter(pc => pc >= 0);
    let words;
    if (period < 12) words = `every ${period} semitones from ${list(pcs.filter(pc => pc < period))}`;
    else if (pcs.join() === ACCIDENTALS.join()) words = "on the accidentals";
    else if (pcs.join() === [0, 2, 4, 5, 7, 9, 11].join()) words = "on the naturals";
    else words = "on " + list(pcs);
    return { value: v, pcs, words };
  });
  return { def, period, groups, cycle: values.slice(0, period) };
}

/** A colour's name from the palette, else its hex. */
export function colourName(config, hex) {
  const all = [...(config.palette.colors || []), ...(config.palette.cbSafeColors || [])];
  const e = all.find(c => c.hex.toLowerCase() === hex);
  return e ? e.name.toLowerCase() : hex === "#000000" ? "black" : hex;
}

const shapeLabel = (config, name) => (config.shapes[name].displayName || name).toLowerCase();

/**
 * Fill ul.rules with the inferred rules in words (design §5.4), one line
 * per attribute. Returns the inference, keyed by attribute.
 */
export function renderRules(ul, config, { hover } = {}) {
  const table = lookTable(config);
  const inf = {
    shape: inferAttribute(table.map(t => t.shape)),
    fill: inferAttribute(table.map(t => (t.hollow ? "hollow" : "solid"))),
    colour: inferAttribute(table.map(t => t.color)),
    side: inferAttribute(table.map(t => t.side)),
  };
  const sw = hex => `<span class="swatch" style="width:16px;height:16px;background:${hex}"></span>`;
  const rows = [];
  const pcsNote = g => `<span class="pcs">${g.pcs.length} of 12</span>`;

  rows.push(["shape", "Shape", el => {
    el.append(shapeThumb(config, inf.shape.def, { height: 18 }), " " + shapeLabel(config, inf.shape.def));
    for (const g of inf.shape.groups) {
      el.append(", with ", shapeThumb(config, g.value, { height: 18 }), ` ${shapeLabel(config, g.value)} ${g.words}`);
    }
  }, inf.shape.groups[0]]);
  rows.push(["fill", "Fill", el => {
    el.append(inf.fill.def);
    for (const g of inf.fill.groups) el.append(`, with ${g.value} ${g.words}`);
  }, inf.fill.groups[0]]);
  rows.push(["colour", "Colour", el => {
    const c = inf.colour;
    if (c.groups.length === 0) { el.innerHTML = `${sw(c.def)} ${colourName(config, c.def)} everywhere`; return; }
    const lead = c.period < 12 ? `every ${c.period} semitones from C:` : "one colour per pitch class:";
    el.innerHTML = lead + " " + c.cycle.map(h => `${sw(h)} ${colourName(config, h)}`).join(", ");
  }, null]);
  rows.push(["size", "Size", el => { el.append("each shape at its own size"); }, null]);
  if (inf.side.groups.length) {
    rows.push(["side", "Side step", el => {
      for (const g of inf.side.groups) el.append(`${g.value} staff space to the right ${g.words}`);
    }, inf.side.groups[0]]);
  }

  for (const [key, attr, fill, group] of rows) {
    const li = document.createElement("li");
    if (key === hover) li.classList.add("hover");
    li.innerHTML = `<span class="attr">${attr}</span><span class="words"></span>${group ? pcsNote(group) : "<span></span>"}`;
    fill(li.querySelector(".words"));
    ul.appendChild(li);
  }
  return inf;
}

// ── Drawing helpers ────────────────────────────────────────────────────

/** A small SVG of one shape (shape picker, rule list). */
export function shapeThumb(config, name, { hollow = false, color = "#1c1c1e", height = 26 } = {}) {
  const shape = config.shapes[name];
  const pxPerSemi = height / shape.semitoneHeight;
  const m = CNBNotehead.measure(shape, pxPerSemi);
  const svg = document.createElementNS(NS, "svg");
  const w = Math.ceil(m.pixelWidth) + 4, h = Math.ceil(m.pixelHeight) + 4;
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.classList.add("thumb");
  CNBNotehead.render(svg, { shape, x: w / 2, y: h / 2, scaleFactor: m.scaleFactor, hollow, color });
  return svg;
}

/** The toolbar's Size steps, in px per semitone (design §6.1). */
export const SIZES = { small: 9, medium: 11, large: 14 };
const GUTTER = 72;      // the fixed 14th column (label strip)
const COL_PAD = 2;      // px either side of the widest ledger

/** A display copy of the config at the chosen size (never saved). */
function displayCopy(config, pxPerSemi, labelSize) {
  const c = CNBConfig.clone(config);
  c.display.pxPerSemi = pxPerSemi;
  c.display.column = { ...c.display.column, paddingH: COL_PAD };
  c.display.label = { ...c.display.label, fontSize: labelSize, marginTop: 6, marginBottom: 6, padding: 4, color: "#5b5d63" };
  c.display.card = { ...c.display.card, shadow: "none" };
  return c;
}

/**
 * Turn one CNBCollection row into the fluid layout the design proposes for
 * CNBCollection's `fluid` option (§6.1): a grid of equal columns no
 * narrower than the widest, each drawing centred, and the staff SVG
 * stretched to the row with its lines drawn to 100%.
 */
function fluidRow(holder, n, slots, colMin) {
  holder.querySelector(".preview-container").style.display = "block";
  const cols = holder.querySelector(".pc-columns");
  cols.style.display = "grid";
  cols.style.gridTemplateColumns = `repeat(${slots}, minmax(${colMin}px, 1fr))`;
  for (const col of holder.querySelectorAll(".pc-col")) {
    col.style.width = "";
    col.style.flex = "";
    col.querySelector("svg").style.margin = "0 auto";
  }
  const bg = holder.querySelector(".staff-lines-bg");
  bg.setAttribute("width", n === slots ? "100%" : (100 * n / slots).toFixed(4) + "%");
  for (const line of bg.querySelectorAll("line")) line.setAttribute("x2", "100%");
}

/**
 * Draw the staff canvas into host at a fixed size, on one row or two
 * (design §6.1). Options:
 *   pcs       pitch classes (default C to C′)
 *   px        px per semitone (default Medium)
 *   rows      1 or 2 (default: one row when it fits the host, else two)
 *   strip     draw the label strip in each row ("drag" for the Pitch section)
 *   selected  pc to outline; covered: pcs to tint
 *   closeup   one fixed-width row centred in the host (the notehead panel)
 * Returns { rows, colMin, oneRowMin }, the numbers the page code would use.
 */
export function renderStaff(host, config, opts = {}) {
  const pcs = opts.pcs ?? ROW;
  const cfg = displayCopy(config, opts.px ?? SIZES.medium, opts.labelSize ?? 15);
  const grid = CNBGrid.create(cfg, CNBCollection.gridRange(pcs));
  const colMin = Math.ceil(Math.max(...pcs.map(pc => CNBCard.columnWidth(cfg, grid, { pc, duration: "crotchet" }))));
  const gutter = opts.strip ? GUTTER : 0;
  const oneRowMin = pcs.length * colMin + gutter;
  const rows = opts.rows ?? (host.clientWidth >= oneRowMin ? 1 : 2);
  const split = rows === 1 ? [pcs] : [pcs.slice(0, 7), pcs.slice(7)];
  const slots = split[0].length;

  host.textContent = "";
  host.dataset.rows = String(rows);
  for (const rowPcs of split) {
    const row = document.createElement("div");
    row.className = "staff-row";
    host.appendChild(row);
    let strip = null;
    if (opts.strip) {
      const g = document.createElement("div");
      g.className = "gutter";
      strip = document.createElement("div");
      strip.className = "strip" + (opts.strip === "drag" ? " drag" : "");
      g.appendChild(strip);
      row.appendChild(g);
    }
    const body = document.createElement("div");
    body.className = "row-body";
    if (opts.closeup) {
      body.style.flex = "none";
      body.style.width = slots * colMin + "px";
      row.style.justifyContent = "center";
    }
    row.appendChild(body);
    CNBCollection.render(body, cfg, { pitchClasses: rowPcs });
    fluidRow(body, rowPcs.length, slots, colMin);
    if (strip) drawStrip(strip, cfg, rowPcs, opts);
    [...body.querySelectorAll(".pc-col")].forEach((col, i) => {
      const pc = rowPcs[i] % 12;
      if (pc === opts.selected) col.classList.add("is-selected");
      if (opts.covered && opts.covered.includes(pc)) col.classList.add("is-covered");
    });
  }
  return { rows, colMin, oneRowMin };
}

/** The canvas toolbar's Size control, with one step marked. */
export function sizeControl(on = "medium") {
  return `<span>Size</span><div class="segmented mini">${Object.keys(SIZES)
    .map(k => `<button class="${k === on ? "on" : ""}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>`;
}

/** The label strip: one label per semitone, even pcs left, odd right. */
function drawStrip(strip, cfg, pcs, opts) {
  const grid = CNBGrid.create(cfg, CNBCollection.gridRange(pcs));
  strip.style.height = grid.totalHeight + "px";
  const lo = Math.ceil(grid.minSemi + 1), hi = Math.floor(grid.maxSemi - 1);
  const mid = cfg.staff.midpoint;
  if (opts.strip === "drag") {
    // The middle of the staff, drawn behind the labels and on into the staff.
    const grip = document.createElement("div");
    grip.className = "grip";
    grip.style.top = Math.round(grid.topLabelHeight + grid.semiToY(mid)) + "px";
    strip.appendChild(grip);
  }
  const shared = new Map();
  for (let s = lo; s <= hi; s++) {
    const y = Math.round(grid.topLabelHeight + grid.semiToY(s));
    const pc = ((s % 12) + 12) % 12;
    const side = pc % 2 === 0 ? "even" : "odd";
    const key = side + y;
    if (shared.has(key)) { shared.get(key).textContent += "·" + NAMES[pc]; continue; }
    const lab = document.createElement("div");
    lab.className = `lab ${side}` + (s === mid ? " mid" : "");
    lab.style.top = y + "px";
    lab.textContent = NAMES[pc];
    strip.appendChild(lab);
    shared.set(key, lab);
  }
}

/** Mark the page ready for screenshot.mjs once fonts and drawing are done. */
export async function ready(fn) {
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]); } catch { /* fonts optional */ }
  await fn();
  document.body.dataset.ready = "1";
}
