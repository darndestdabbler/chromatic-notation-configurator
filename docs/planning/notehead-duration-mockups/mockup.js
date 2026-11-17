/**
 * mockup.js — how noteheads show duration (session 74).
 *
 * Draws index.html's mock-ups with the Configurator's own card collection:
 * the Noteheads step's choice of design, the panel and the controls above
 * the canvas under A (conventional noteheads), B.i (hollows) and B.ii
 * (repeated heads), B.i's two breves, and a gallery file that fits none.
 * The panels and buttons are sketches in HTML; every notehead, stem, ledger
 * and tie is drawn by cnb/src.
 *
 * Two things are prototyped here, not built (session 75 and 76 build them):
 *   - the conventional noteheads, from Emmentaler's outlines (below);
 *   - B.i's breve in shape mode, durations.breveStyle "double" or "tied",
 *     by wrapping CNBCard.repeatLayout: a double notehead is laid out as a
 *     repeated minim's two heads, two tied semibreves as a repeat-mode
 *     breve whose groups are one head each.
 */
import { CNBConfig } from "../../../cnb/src/cnb-config.js";
import { CNBCard } from "../../../cnb/src/cnb-card.js";
import { CNBNotehead } from "../../../cnb/src/cnb-notehead.js";
import { CNBCollection } from "../../../cnb/src/cnb-collection.js";

/**
 * LilyPond's own noteheads: Emmentaler's noteheads.s2, s1, s0 and sM1, from
 * LilyPond 2.24's emmentaler-20.otf (SIL OFL 1.1,
 * cnb/assets/fonts/OFL-Emmentaler.txt), read with fontTools for these
 * mock-ups only: font units (250 a staff space), Y negated, centred on each
 * glyph's box; path the outer outline, hollow the hole.
 */
const EMMENTALER = {
  crotchet: { glyph: "noteheads.s2", width: 326, height: 272,
    path: "M55 -136C14 -136 -26 -123 -61 -102C-108 -74 -163 -24 -163 47C-163 108 -110 136 -55 136C-14 136 26 123 61 102C108 74 163 24 163 -47C163 -108 110 -136 55 -136Z",
    hollow: null },
  minim: { glyph: "noteheads.s1", width: 344, height: 272,
    path: "M90 -136C16 -136 -45 -122 -98 -86C-130 -64 -149 -29 -161 8C-167 26 -172 46 -172 65C-172 115 -135 136 -89 136C-15 136 45 122 98 86C130 64 150 29 162 -8C168 -26 172 -46 172 -65C172 -115 136 -136 90 -136Z",
    hollow: "M142 -65C142 -55 138 -45 131 -37C111 -12 64 17 27 41C-10 65 -56 96 -87 105C-91 106 -95 106 -99 106C-120 106 -141 89 -141 65C-141 55 -138 45 -131 37C-111 12 -64 -17 -27 -41C10 -65 57 -96 88 -105C92 -106 96 -106 100 -106C121 -106 142 -89 142 -65Z" },
  semibreve: { glyph: "noteheads.s0", width: 491, height: 272,
    path: "M245.5 -0C245.5 -43 211.5 -75 173.5 -96C120.5 -125 59.5 -136 -0.5 -136C-60.5 -136 -120.5 -125 -173.5 -96C-211.5 -75 -245.5 -43 -245.5 -0C-245.5 43 -211.5 75 -173.5 96C-120.5 125 -60.5 136 -0.5 136C59.5 136 120.5 125 173.5 96C211.5 75 245.5 43 245.5 -0Z",
    hollow: "M-32.5 -112C44.5 -112 101.5 -53 101.5 24C101.5 69 82.5 112 32.5 112C-44.5 112 -101.5 53 -101.5 -24C-101.5 -69 -82.5 -112 -32.5 -112Z" },
  breve: { glyph: "noteheads.sM1", width: 588, height: 360,
    path: "M0 -136C-95 -136 -228 -101 -244 -15V-155C-244 -169 -255 -180 -269 -180C-283 -180 -294 -169 -294 -155V155C-294 169 -283 180 -269 180C-255 180 -244 169 -244 155V15C-228 101 -95 136 0 136C95 136 228 101 244 15V155C244 169 255 180 269 180C283 180 294 169 294 155V-155C294 -169 283 -180 269 -180C255 -180 244 -169 244 -155V-15C228 -101 95 -136 0 -136Z",
    hollow: "M-33 -112C44 -112 101 -53 101 24C101 69 83 112 33 112C-44 112 -102 53 -102 -24C-102 -69 -83 -112 -33 -112Z" },
};

const DURATIONS = ["crotchet", "minim", "semibreve", "breve"];
const HOLLOW_LONGER = { name: "Hollow minims and longer", match: { pitchClasses: "all",
  durations: ["minim", "semibreve", "breve"], keys: "all" }, apply: { hollow: true } };

// ── B.i's breve, prototyped (session 76 builds it) ─────────────────────────
const isBreve = (config, duration) =>
  ((config.durations.definitions || []).find(d => d.name === duration) || {}).lilypondDuration <= 0;
const repeatLayout = CNBCard.repeatLayout.bind(CNBCard);
CNBCard.repeatLayout = (config, grid, shape, duration, size) => {
  const style = config.durations && config.durations.breveStyle;
  if (config.durations.representationMode === "repeat" || !style || !isBreve(config, duration)) {
    return repeatLayout(config, grid, shape, duration, size);
  }
  const { pixelWidth, pixelHeight, scaleY } = CNBNotehead.measure(shape, grid.pxPerSemi, size);
  const staffSpacePx = (config.staff.semitonesPerStaffSpace || 4) * grid.pxPerSemi;
  if (style === "double") {
    const step = pixelWidth * (1 - (config.durations.repeatOverlap ?? 1 / 3));
    return { count: 2, offsets: [-step / 2, step / 2], groupWidth: pixelWidth + step, ties: [], staffSpacePx };
  }
  const pitch = pixelWidth + staffSpacePx;   // two heads 1 staff space apart, tied middle to middle
  return { count: 2, offsets: [-pitch / 2, pitch / 2], groupWidth: 2 * pixelWidth + staffSpacePx,
    ties: [{ x1: -pitch / 2, x2: pitch / 2, dy: pixelHeight / 2 + CNBNotehead.referenceShift(shape, scaleY) }],
    staffSpacePx };
};

// ── The notations ──────────────────────────────────────────────────────────
const load = async (url) => CNBConfig.merge(CNBConfig.createDefault(), await (await fetch(url)).json());

/** The rules, renumbered by their order. */
const ranked = (rules) => rules.map((r, i) => ({ ...r, priority: i }));

/** A: the conventional noteheads at the default notehead's height, red on the accidentals. */
function conventional() {
  const c = CNBConfig.createDefault();
  const k = 2.724 / EMMENTALER.crotchet.height;   // the crotchet 2.724 semitones tall, the rest in proportion
  const half = 0.065 * 250;                       // half the engine's stem, font units
  for (const [d, g] of Object.entries(EMMENTALER)) {
    const stem = d === "crotchet" || d === "minim";
    const x = g.width / 2 - half;
    const anchor = { x, y: -0.3 * g.height / 2 };
    c.shapes["conventional-" + d] = {
      displayName: "Conventional " + d, svgPath: g.path, svgHollowPath: g.hollow,
      naturalHeight: g.height, naturalWidth: g.width, semitoneHeight: g.height * k,
      anchors: stem ? { crotchetUp: anchor, crotchetDown: { x: -x, y: -anchor.y },
        minimUp: anchor, minimDown: { x: -x, y: -anchor.y } } : null,
      lilypondPath: null, lilypondHollowPath: null, lilypondAnchors: null,
    };
  }
  const only = (d) => ({ pitchClasses: "all", durations: [d], keys: "all" });
  c.noteheadRules = ranked([
    { name: "Default", match: { pitchClasses: "all", durations: "all", keys: "all" },
      apply: { shape: "conventional-crotchet", hollow: false, color: null, offKeyMark: false } },
    { name: "Minims", match: only("minim"), apply: { shape: "conventional-minim", hollow: true } },
    { name: "Semibreves", match: only("semibreve"), apply: { shape: "conventional-semibreve", hollow: true } },
    { name: "Breves", match: only("breve"), apply: { shape: "conventional-breve", hollow: true } },
    { name: "Red on the accidentals", match: { pitchClasses: [1, 3, 6, 8, 10], durations: "all", keys: "all" },
      apply: { color: "#cc0000" } },
  ]);
  return c;
}

/** B.i from a notation: its pitch-by-pitch fill dropped, the hollows rule, the breve style. */
function hollows(config, breveStyle) {
  const c = CNBConfig.clone(config);
  c.durations.representationMode = "shape";
  c.durations.breveStyle = breveStyle;
  const kept = c.noteheadRules.filter(r => r.match.durations === "all").map(r => {
    const apply = { ...r.apply };
    if (r.match.pitchClasses === "all") apply.hollow = false; else delete apply.hollow;
    return { ...r, apply };
  });
  c.noteheadRules = ranked([...kept, HOLLOW_LONGER]);
  return c;
}

async function notations() {
  const tutorial = await load("../../playbook/tutorial/downloads/tutorial.json");
  const plain = CNBConfig.createDefault();
  plain.noteheadRules = plain.noteheadRules.filter(r => r.name === "Default");
  const n = {
    a: conventional(),
    bi: hollows(tutorial, "tied"),
    bii: await load("../../../cnb/fixtures/kite-4-369-config.json"),
    own: await load("../../../cnb/assets/examples/gallery/clairnote-dn.json"),
    breves: [
      ["The default notehead: a double notehead", hollows(plain, "double")],
      ["The default notehead: two tied semibreves", hollows(plain, "tied")],
      ["The tutorial's diamond: a double notehead", hollows(tutorial, "double")],
      ["The tutorial's diamond: two tied semibreves", hollows(tutorial, "tied")],
    ],
  };
  return n;
}

// ── Drawing ────────────────────────────────────────────────────────────────
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/** A notation drawn small: px per semitone and label size set on a copy. */
function sized(config, px, labelPx) {
  const c = CNBConfig.clone(config);
  c.display.pxPerSemi = px;
  c.display.label.fontSize = labelPx;
  c.display.label.marginTop = 4;
  c.display.label.marginBottom = 4;
  c.display.column.paddingH = 6;
  c.clef.enabled = false;   // the noteheads alone
  return c;
}

/** One duration of a notation, captioned: its cards for the pitch classes. */
function duration(config, d, pcs, caption) {
  const cell = el("div", "dur");
  if (caption) cell.appendChild(el("div", "cap", caption));
  CNBCollection.render(cell, config, { pitchClasses: pcs, durations: [d] });
  return cell;
}

/** The four durations side by side. */
function fourDurations(config, pcs, px, labelPx, captions = true) {
  const row = el("div", captions ? "rows" : "thumbs");
  const c = sized(config, px, labelPx);
  for (const d of DURATIONS) {
    const cell = duration(c, d, pcs, captions ? d[0].toUpperCase() + d.slice(1) + "s" : null);
    if (!captions) { cell.className = "thumb"; cell.appendChild(el("div", null, d)); }
    row.appendChild(cell);
  }
  return row;
}

const opt = (label, on, dim) => `<span class="opt${on ? " on" : ""}${dim ? " dim" : ""}">${label}</span>`;

/** The step's card: the question, the two designs, the choices under Your own notehead. */
function stepCard(n, picked) {
  const card = el("div", "card");
  card.appendChild(el("div", "card-head", `<h2>5&nbsp; Noteheads</h2><span class="sub">${{
    a: "Conventional noteheads picked", bi: "Your own notehead, duration by hollows, picked",
    bii: "Your own notehead, duration by repeated heads, picked", own: "A notation that fits none" }[picked]}</span>`));
  const body = el("div", "card-body");
  body.appendChild(el("p", "question", "How should the noteheads show duration?"));
  const designs = el("div", "designs");
  const a = el("div", "design" + (picked === "a" ? " on" : ""),
    "<b>Conventional noteheads</b><div class=\"says\">The crotchet, minim, semibreve and breve every musician reads. Only the colour varies by pitch.</div>");
  a.appendChild(fourDurations(n.a, [7], 4, 9, false));
  designs.appendChild(a);
  const custom = picked === "bii" ? n.bii : picked === "own" ? n.own : n.bi;
  const b = el("div", "design" + (picked === "bi" || picked === "bii" ? " on" : ""),
    "<b>Your own notehead</b><div class=\"says\">Its shape, colour and size vary by pitch. Choose how duration shows.</div>");
  b.appendChild(fourDurations(custom, [7], 4, 9, false));
  const way = picked === "bii" ? "bii" : picked === "bi" ? "bi" : null;
  b.appendChild(el("div", "sub-choice", `<span>Duration shows by</span>${
    opt("Hollows: crotchets solid, longer notes hollow", way === "bi", !way)}${
    opt("Repeated heads: minim ×2, semibreve ×4", way === "bii", !way)}`));
  if (way === "bi") {
    b.appendChild(el("div", "sub-choice", `<span>The breve</span>${
      opt("Two tied semibreves", true)}${opt("A double notehead", false)}`));
  }
  if (way === "bii") {
    b.appendChild(el("div", "sub-choice", `<span>Overlap</span><span class="field">33.3</span><span class="hint">% of a head's width (moved here from above the canvas)</span>`));
  }
  designs.appendChild(b);
  body.appendChild(designs);
  if (picked === "own") {
    body.appendChild(el("div", "own", "<b>Your own noteheads.</b> These noteheads show duration in their own way. " +
      "Each notehead's look below is the same for every duration; rules for particular durations are in " +
      "Advanced › Notehead rules. Pick a design to use one instead."));
  }
  card.appendChild(body);
  return card;
}

/** The notehead panel's rows under a design: [label, on, content or why not]. */
const PANEL = {
  a: [["Colour", true, `<span class="swatch" style="background:#000"></span><span class="swatch" style="background:#cc0000"></span><span class="hint">None · ▢ · Suggested colours</span>`],
      ["Height", true, `<span class="field">2.724</span><span class="hint">semitones, every notehead (step 1's)</span>`],
      ["Fill", false, `<span class="why">the duration's</span>`],
      ["Shape", false, `<span class="why">conventional</span>`]],
  bi: [["Colour", true, `<span class="swatch" style="background:#000"></span><span class="swatch" style="background:#cc0000"></span><span class="hint">None · ▢ · Suggested colours</span>`],
       ["Shape", true, `<span class="field">◆ diamond ▾</span><span class="hint">Import from SVG · the point on the pitch</span>`],
       ["Size", true, `<span class="field">h</span><span class="field">w</span><span class="hint">semitones, 🔒 aspect</span>`],
       ["Fill", false, `<span class="why">crotchets solid, longer notes hollow</span>`]],
  bii: [["Colour", true, `<span class="swatch" style="background:#50b4e9"></span><span class="swatch" style="background:#cc79a7"></span><span class="hint">None · ▢ · Suggested colours</span>`],
        ["Fill", true, `${opt("Solid", false)}${opt("Hollow", true)}`],
        ["Shape", true, `<span class="field">◇ kite (up) ▾</span><span class="hint">Import from SVG · the point on the pitch</span>`],
        ["Size", true, `<span class="field">h</span><span class="field">w</span><span class="hint">semitones, 🔒 aspect</span>`]],
  own: [["Colour", true, `<span class="swatch" style="background:#000"></span><span class="hint">None · ▢ · Suggested colours</span>`],
        ["Fill", true, `${opt("Solid", false)}${opt("Hollow", true)}`],
        ["Shape", true, `<span class="field">crotchet-minim ▾</span><span class="hint">Import from SVG</span>`],
        ["Size", true, `<span class="field">h</span><span class="field">w</span><span class="hint">semitones</span>`]],
};

function panel(kind, title) {
  const p = el("div", "panel", `<h4>${title}</h4>`);
  for (const [label, on, content] of PANEL[kind]) {
    p.appendChild(el("div", "panel-row" + (on ? "" : " off"), `<span>${label}</span>${content}`));
  }
  return p;
}

function toolbar() {
  return el("div", "toolbar", `<span>Show</span>${["Crotchets", "Minims", "Semibreves", "Breves"]
    .map(d => `<span class="pill">${d}</span>`).join("")}<span class="pill on">All four</span>` +
    `<span>· Pitch range C to C′ · Key C major</span>` +
    `<span class="gone">no Shape or Repeat choice, no Hollow minims tick</span>`);
}

function designBlock(n, kind, heading, panelTitle, pcs) {
  const card = el("div", "card");
  card.appendChild(el("div", "card-head", `<h2>${heading}</h2>`));
  const body = el("div", "card-body layout");
  body.appendChild(panel(kind, panelTitle));
  const canvas = el("div");
  canvas.appendChild(toolbar());
  canvas.appendChild(fourDurations(n[kind], pcs, 7, 12));
  body.appendChild(canvas);
  card.appendChild(body);
  return card;
}

function draw(n) {
  const step = document.getElementById("step-body");
  for (const picked of ["a", "bi", "bii"]) step.appendChild(stepCard(n, picked));

  const designs = document.getElementById("designs-body");
  designs.appendChild(designBlock(n, "a", "A. Conventional noteheads (red on the accidentals)",
    "C♯ selected: the colour, and one height", [0, 1]));
  designs.appendChild(designBlock(n, "bi", "B.i. Your own notehead, by hollows: the tutorial's diamond",
    "C♯ selected: colour, shape and size, no fill", [0, 1]));
  designs.appendChild(designBlock(n, "bii", "B.ii. Your own notehead, by repeated heads: Kite 4-369",
    "C♯ selected: everything, the same for every duration", [0, 1]));

  const breves = el("div", "breves");
  for (const [caption, config] of n.breves) {
    const cell = el("div", "card card-body");
    cell.appendChild(el("div", "caption", caption + " (the semibreve beside it, for reference)"));
    const row = el("div", "rows");
    const c = sized(config, 9, 12);
    row.appendChild(duration(c, "semibreve", [0, 2, 4], "Semibreves"));
    row.appendChild(duration(c, "breve", [0, 2, 4], "Breves"));
    cell.appendChild(row);
    breves.appendChild(cell);
  }
  document.getElementById("breves-body").appendChild(breves);

  const own = document.getElementById("own-body");
  own.appendChild(stepCard(n, "own"));
  own.appendChild(designBlock(n, "own", "Clairnote DN: fill by pitch, its minims drawn as its crotchets",
    "C♯ selected: everything, as today", [0, 1]));
}

draw(await notations());
document.body.setAttribute("data-ready", "");
