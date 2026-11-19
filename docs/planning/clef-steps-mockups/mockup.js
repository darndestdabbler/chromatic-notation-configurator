/**
 * mockup.js — the Clef steps and the dropdowns (session 78).
 *
 * Draws index.html with the Configurator's own modules: the card
 * collection (its fluid row with the label strip, the pitch names left of
 * the staff), the clef renderer, and the built-in clefs' data
 * (cnb/ui/builtin-clefs.js); the imported clef is the tutorial's C clef
 * (docs/playbook/tutorial/downloads/tutorial.json). Every dropdown is a
 * native <select>, as the key picker's is. The step panels' controls work: they write a clef definition as session 79's editor would
 * (an anchor of Top, Middle or Bottom is a reference point at the glyph's
 * top, middle or bottom; Sits on is anchorSemi; Height is semitoneHeight)
 * and redraw both previews, which a drag on the clef (where it sits) or on
 * its corner (its height) changes too.
 *
 * The preview puts the clef where the engine engraves it, 0.75 staff
 * spaces after the staff's start (measured for this session against engine
 * 1.10.0), and the stored gutter after it only: CNBClef draws the gutter
 * both sides, so the mock-up gives it the mean of the two and moves the
 * glyph to 0.75 staff spaces. Each drawn clef carries data-anchor-y (its
 * anchor's y, from the drawn glyph) and data-pitch-y (the y of the
 * semitone it sits on), and data-left (its left edge from the staff's
 * start), which screenshot.mjs checks.
 */
import { CNBConfig } from "../../../cnb/src/cnb-config.js";
import { CNBClef } from "../../../cnb/src/cnb-clef.js";
import { CNBStaff } from "../../../cnb/src/cnb-staff.js";
import { CNBGrid } from "../../../cnb/src/cnb-grid.js";
import { CNBCollection } from "../../../cnb/src/cnb-collection.js";
import { CNBMusic } from "../../../cnb/src/cnb-music.js";
import { CNBBuiltinClefs } from "../../../cnb/ui/builtin-clefs.js";

const NS = "http://www.w3.org/2000/svg";
const PX = 16;                 // the step preview, a semitone: the canvas's Large
const SMALL_PX = 14;           // the anchor cases
const BEFORE_SS = 0.75;        // the engraved clef's left edge after the staff's start
const GUTTER_PX = 12;          // the stored gutter, drawn after the clef
const ANCHOR = "#d62f2f";
const ACCENT = "#2f6fd6";

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const svgEl = (tag, attrs) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};
const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const noteName = (semi) => {
  const { text, sharp } = CNBMusic.pcLabel(CNBMusic.pitchClass(semi));
  return text + (sharp ? "♯" : "");
};

// ── The clefs ─────────────────────────────────────────────────────────────
const base = CNBConfig.createDefault();
const tutorial = await (await fetch("../../playbook/tutorial/downloads/tutorial.json")).json();
const IMPORTED = { "c-clef": tutorial.clef.glyphs["c-clef"] };

const CLEFS = [
  ...CNBBuiltinClefs.CHOICES.map(({ name, displayName }) => ({ name, displayName, imported: false })),
  ...Object.entries(IMPORTED).map(([name, def]) => ({ name, displayName: def.displayName, imported: true })),
];
const ANCHORS = [["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"], ["point", "A point on the clef"]];

/** A clef's stored definition: built in for this staff, or imported. */
const defOf = (name) => (name in IMPORTED ? JSON.parse(JSON.stringify(IMPORTED[name]))
  : CNBBuiltinClefs.definition(base, name));

/** The reference for an anchor choice (session 79's withAnchorChoice). */
function referenceFor(def, choice, point) {
  const minX = def.viewBoxMinX || 0, minY = def.viewBoxMinY || 0;
  const x = minX + def.naturalWidth / 2;
  if (choice === "top") return { x, y: minY };
  if (choice === "middle") return { x, y: minY + def.naturalHeight / 2 };
  if (choice === "bottom") return { x, y: minY + def.naturalHeight };
  return { ...point };
}

/** The anchor choice a stored point is (session 79's anchorChoice). */
function anchorChoice(def) {
  const ref = def.reference;
  if (!ref) return "top";
  const minY = def.viewBoxMinY || 0;
  if (ref.y === minY) return "top";
  if (ref.y === minY + def.naturalHeight / 2) return "middle";
  if (ref.y === minY + def.naturalHeight) return "bottom";
  return "point";
}

/** Each clef's settings in the panel, from its stored definition. */
const settings = {};
for (const { name } of CLEFS) {
  const def = defOf(name);
  settings[name] = def.kind === "dozenal" ? { height: null } : {
    anchor: anchorChoice(def),
    point: def.reference ? { ...def.reference } : { x: 0, y: 0 },
    sits: def.anchorSemi,
    own: !Number.isInteger(def.anchorSemi),
    height: def.semitoneHeight,
  };
}

/** The notation with this clef, as the editor writes it. */
function configWith(name, s, pxPerSemi) {
  const c = CNBConfig.clone(base);
  c.display.pxPerSemi = pxPerSemi;
  if (name === "none") {
    c.clef = { enabled: false, active: null, glyphs: {}, gutter: { paddingH: GUTTER_PX } };
    return c;
  }
  const def = defOf(name);
  if (def.kind === "dozenal") def.semitoneHeight = s.height;
  else {
    def.reference = referenceFor(def, s.anchor, s.point);
    def.anchorSemi = s.sits;
    def.semitoneHeight = s.height;
  }
  c.clef = { enabled: true, active: name, glyphs: { [name]: def }, gutter: { paddingH: GUTTER_PX } };
  return c;
}

// ── A preview ─────────────────────────────────────────────────────────────
/**
 * Draw the start of the staff with the clef, the pitch names, the anchor
 * marked and the corner handle. Returns { grid, clefSvg, handle } for the
 * drags.
 */
function preview(host, config, { pcs = [0, 1, 2], handle = true } = {}) {
  host.textContent = "";
  const shown = CNBClef.shown(config);
  const space = CNBStaff.staffSpacePx(config, { pxPerSemi: config.display.pxPerSemi });
  const before = BEFORE_SS * space;
  // CNBClef pads both sides by paddingH: give it the mean of the space
  // before and after, then move the glyph to the space before.
  const drawn = CNBConfig.clone(config);
  drawn.clef.gutter = { paddingH: (before + GUTTER_PX) / 2 };
  CNBCollection.render(host, drawn, { pitchClasses: pcs, durations: ["crotchet"], fluid: true, rows: 1, labelStrip: true });
  const grid = CNBGrid.create(drawn, CNBCollection.gridRange(pcs, drawn, ["crotchet"], null));
  const labels = host.querySelector(".label-col svg");
  const clefSvg = host.querySelector(".clef-col svg");
  if (!shown || !clefSvg) return { grid, clefSvg: null };
  const g = clefSvg.querySelector("g.cnb-clef");
  g.setAttribute("transform", g.getAttribute("transform").replace(/^translate\(([^,]+),/, `translate(${before},`));
  const topY = Number(/^translate\([^,]+,([^)]+)\)/.exec(g.getAttribute("transform"))[1]);

  // The anchor, from the glyph as drawn.
  const { def, height } = shown;
  const m = CNBClef.measure(def, grid.pxPerSemi, space, height);
  let ax, ay, sits;
  if (def.kind === "dozenal") {
    sits = config.staff.midpoint;
    ax = before + m.pixelWidth / 2;
    ay = topY;                                   // its g is on the middle line
  } else {
    sits = def.anchorSemi;
    ax = before + (def.reference.x - (def.viewBoxMinX || 0)) * m.scaleFactor;
    ay = topY + (def.reference.y - (def.viewBoxMinY || 0)) * m.scaleFactor;
  }
  const pitchY = grid.semiToY(sits);
  host.dataset.anchorY = String(ay);
  host.dataset.pitchY = String(pitchY);
  host.dataset.left = String(before / space);

  // The guide to the pitch names, and the name highlighted.
  clefSvg.appendChild(svgEl("line", { x1: 0, y1: pitchY, x2: ax, y2: pitchY, stroke: ANCHOR,
    "stroke-width": 1, "stroke-dasharray": "3 3" }));
  if (labels) {
    labels.appendChild(svgEl("line", { x1: 0, y1: pitchY, x2: labels.getAttribute("width") || 200, y2: pitchY,
      stroke: ANCHOR, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    const chip = Number.isInteger(sits) && labels.querySelector(`g.pitch-label[data-semi="${sits}"] rect`);
    if (chip) {
      chip.setAttribute("fill", "#fde3e3");
      chip.setAttribute("stroke", ANCHOR);
      chip.parentNode.querySelector("text").setAttribute("font-weight", "700");
    }
  }
  // The anchor: a ringed cross.
  const r = Math.max(5, grid.pxPerSemi * 0.35);
  clefSvg.appendChild(svgEl("circle", { cx: ax, cy: ay, r, fill: "rgba(255,255,255,.7)", stroke: ANCHOR, "stroke-width": 1.6 }));
  clefSvg.appendChild(svgEl("path", { d: `M ${ax - r - 3} ${ay} H ${ax + r + 3} M ${ax} ${ay - r - 3} V ${ay + r + 3}`,
    stroke: ANCHOR, "stroke-width": 1.6 }));

  // The corner handle, at the bottom right of a glyph's box.
  let corner = null;
  if (handle && def.kind !== "dozenal") {
    const x = before + m.pixelWidth, y = topY + m.pixelHeight;
    clefSvg.appendChild(svgEl("rect", { x: before, y: topY, width: m.pixelWidth, height: m.pixelHeight,
      fill: "none", stroke: ACCENT, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.6 }));
    corner = svgEl("rect", { x: x - 5, y: y - 5, width: 10, height: 10, fill: "#fff", stroke: ACCENT,
      "stroke-width": 1.6, class: "cnb-mock-handle" });
    clefSvg.appendChild(corner);
  }
  return { grid, clefSvg, corner, height };
}

// ── The two steps ─────────────────────────────────────────────────────────
const state = { clef: "treble", picking: false };

function option(letter, title, hint, ...controls) {
  const o = el("div", "option");
  o.appendChild(el("span", "letter", letter));
  o.appendChild(el("span", "title", title));
  if (hint) o.appendChild(el("span", "hint", hint));
  const row = el("div", "controls");
  for (const c of controls) if (c) row.appendChild(c);
  o.appendChild(row);
  return o;
}

function select(options, value, onchange, groups = null) {
  const s = el("select");
  const add = (parent, [v, text]) => {
    const o = el("option", "", text);
    o.value = v;
    if (v === value) o.selected = true;
    parent.appendChild(o);
  };
  for (const opt of options) add(s, opt);
  if (groups) for (const [label, opts] of groups) {
    const g = el("optgroup");
    g.label = label;
    for (const opt of opts) add(g, opt);
    s.appendChild(g);
  }
  s.value = value;
  s.onchange = () => onchange(s.value);
  return s;
}

function numberInput(value, onchange, step = "any") {
  const i = el("input");
  i.type = "number";
  i.step = step;
  i.value = String(value);
  i.onchange = () => { const v = parseFloat(i.value); if (Number.isFinite(v)) onchange(v); };
  return i;
}

/** The picker: the clef enlarged, its point marked; a click moves it. */
function picker(name) {
  const s = settings[name];
  const def = defOf(name);
  const wrap = el("div", "hint");
  wrap.appendChild(el("div", "", "Click the clef at the point that sits on its pitch."));
  const k = 150 / def.naturalHeight;
  const minX = def.viewBoxMinX || 0, minY = def.viewBoxMinY || 0;
  const svg = svgEl("svg", { width: Math.ceil(def.naturalWidth * k) + 20, height: 170 });
  svg.appendChild(svgEl("rect", { x: 10, y: 10, width: def.naturalWidth * k, height: 150, fill: "#f7f6f2" }));
  svg.appendChild(svgEl("path", { d: def.svgPath, fill: "#1c1c1e",
    transform: `translate(10 10) scale(${k}) translate(${-minX} ${-minY})` }));
  const cx = 10 + (s.point.x - minX) * k, cy = 10 + (s.point.y - minY) * k;
  svg.appendChild(svgEl("path", { d: `M ${cx - 8} ${cy} H ${cx + 8} M ${cx} ${cy - 8} V ${cy + 8}`, stroke: ANCHOR, "stroke-width": 2 }));
  svg.style.cursor = "crosshair";
  svg.onclick = (e) => {
    const b = svg.getBoundingClientRect();
    s.point = { x: (e.clientX - b.left - 10) / k + minX, y: (e.clientY - b.top - 10) / k + minY };
    s.anchor = "point";
    draw();
  };
  wrap.appendChild(svg);
  const done = el("button", "", "Done");
  done.onclick = () => { state.picking = false; draw(); };
  wrap.appendChild(done);
  return wrap;
}

function drawStep10(host) {
  host.textContent = "";
  const name = state.clef;
  const builtIn = CLEFS.filter(c => !c.imported).map(c => [c.name, c.displayName]);
  const imported = CLEFS.filter(c => c.imported).map(c => [c.name, c.displayName]);
  const importButton = el("button", "", "Import from SVG…");
  importButton.title = "Adds the clef, chooses it, and opens the anchor picker";
  importButton.onclick = () => { state.clef = "c-clef"; state.picking = true; draw(); };
  host.appendChild(option("a", "Clef", null,
    select([["none", "No clef"], ...builtIn], name, (v) => { state.clef = v; state.picking = false; draw(); },
      [["Imported", imported]]),
    importButton));
  if (name === "none") {
    host.appendChild(el("div", "empty", "No clef is shown. Choose one, or import one from SVG."));
    return;
  }
  const s = settings[name];
  const def = defOf(name);
  if (def.kind === "dozenal") {
    host.appendChild(option("b", "Anchor", "The dozenal clef sits on the middle of the staff, and grows or shrinks about it."));
  } else {
    const hint = s.anchor === "point" && !(name in IMPORTED)
      ? { treble: "The curl, on the treble clef's G line.", bass: "Between the dots, on the bass clef's F line.",
          alto: "The middle, on the alto clef's C line." }[name]
      : "The point of the clef that sits on its pitch.";
    host.appendChild(option("b", "Anchor", hint,
      select(ANCHORS, s.anchor, (v) => { s.anchor = v; state.picking = v === "point"; draw(); }),
      s.anchor === "point" && !state.picking ? Object.assign(el("button", "", "Pick the point…"),
        { onclick: () => { state.picking = true; draw(); } }) : null));
    if (state.picking) host.appendChild(picker(name));
  }
  const shown = CNBClef.shown(configWith(name, s, PX));
  const height = numberInput(round(shown.height, 3), (v) => { if (v > 0) { s.height = v; draw(); } });
  const canAuto = def.kind === "dozenal" || !!def.staffSpaceUnits;
  let auto = null;
  if (canAuto) {
    auto = el("label", "unit");
    const box = el("input");
    box.type = "checkbox";
    box.checked = s.height === null || s.height === undefined;
    box.onchange = () => { s.height = box.checked ? null : round(shown.height, 3); draw(); };
    auto.appendChild(box);
    auto.appendChild(document.createTextNode(" Automatic: follows the staff and its noteheads"));
  }
  host.appendChild(option("", "Height", "A new height grows or shrinks the clef about its anchor.",
    height, el("span", "unit", "semitones"), auto));
  host.appendChild(el("div", "valid", "Config valid ✓"));
}

function drawStep11(host) {
  host.textContent = "";
  const name = state.clef;
  if (name === "none") {
    host.appendChild(el("div", "empty", "Choose or import a clef in step 10 first."));
    return;
  }
  const s = settings[name];
  const def = defOf(name);
  if (def.kind === "dozenal") {
    host.appendChild(option("c", "Sits on", "The middle of the staff, which the dozenal clef keeps."));
  } else {
    const pitches = [];
    for (let semi = 24; semi >= 0; semi--) pitches.push([String(semi), `${noteName(semi)} · semitone ${semi}`]);
    pitches.push(["own", "A semitone of my own…"]);
    const value = s.own || !Number.isInteger(s.sits) || s.sits < 0 || s.sits > 24 ? "own" : String(s.sits);
    host.appendChild(option("c", "Sits on", "The pitch the anchor sits on. Or drag the clef up or down in the preview.",
      select(pitches, value, (v) => {
        if (v === "own") s.own = true;
        else { s.own = false; s.sits = Number(v); }
        draw();
      }),
      value === "own" ? numberInput(s.sits, (v) => { s.sits = v; draw(); }, "0.1") : null,
      value === "own" ? el("span", "unit", "semitones") : null));
  }
  host.appendChild(option("d", "Space after the clef",
    "LilyPond's: it puts the clef 0.75 staff spaces after the start of the staff, and spaces what follows " +
    "from the clef. The preview draws the clef there."));
}

// ── Drags in the previews ─────────────────────────────────────────────────
let drag = null;
function wireDrags(drawn) {
  const s = settings[state.clef];
  if (!drawn.clefSvg || !s || defOf(state.clef).kind === "dozenal") return;
  drawn.clefSvg.onpointerdown = (e) => {
    const resize = e.target === drawn.corner;
    drag = { y0: e.clientY, resize, sits: s.sits, height: drawn.height };
    e.preventDefault();
  };
}
window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const s = settings[state.clef];
  const semis = (drag.y0 - e.clientY) / PX;   // upward
  if (drag.resize) s.height = Math.max(1, round(drag.height - semis, 1));
  else s.sits = s.own ? round(drag.sits + semis, 1) : Math.round(drag.sits + semis);
  draw();
});
window.addEventListener("pointerup", () => { drag = null; });

function draw() {
  drawStep10(document.getElementById("step10-options"));
  drawStep11(document.getElementById("step11-options"));
  const config = configWith(state.clef, settings[state.clef], PX);
  for (const id of ["step10-preview", "step11-preview"]) {
    const host = document.getElementById(id);
    const drawn = preview(host, config);
    host.appendChild(el("div", "hint", state.clef === "none" ? "" :
      "Drag the clef up or down to move it; drag its corner to resize it about its anchor."));
    wireDrags(drawn);
  }
}

// ── The anchor cases ──────────────────────────────────────────────────────
function cases(root) {
  const cDef = defOf("c-clef");
  const list = [
    ...[["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]].map(([anchor, title]) =>
      ({ name: "c-clef", title: `C clef, anchor ${title}`, s: { anchor, point: cDef.reference, sits: 12, height: 8 } })),
    { name: "c-clef", title: "C clef, a point picked on it", s: { anchor: "point", point: { x: 37, y: 25 }, sits: 12, height: 8 } },
    { name: "treble", title: "Treble clef on G", s: { ...settings.treble } },
    { name: "treble", title: "Treble clef on a semitone of my own", s: { ...settings.treble, sits: 18.5, own: true } },
  ];
  for (const { name, title, s } of list) {
    const cell = el("div", "case");
    cell.appendChild(el("h4", null, title));
    const host = el("div", "preview");
    cell.appendChild(host);
    root.appendChild(cell);
    const config = configWith(name, s, SMALL_PX);
    preview(host, config, { pcs: [0], handle: false });
    host.classList.add("anchor-case");
    const sits = CNBClef.shown(config).def.anchorSemi;
    cell.appendChild(el("div", "caption",
      `Sits on ${Number.isInteger(sits) ? noteName(sits) + ", " : ""}semitone ${sits}; ` +
      `the top at semitone ${round(CNBClef.shown(config).top, 3)}`));
  }
}

// ── The dropdowns ─────────────────────────────────────────────────────────
const STACKS = [
  ["degrees", "Stacked sevenths: 1 3 5 7 left, 2 4 6 8 right"],
  ["parity", "Odd semitones left, even right"],
  ["parity-stacks", "A new stack at each change of odd and even"],
  ["parity-zigzag", "Zigzag at each change of odd and even"],
  ["fifths", "Cycle of fifths, one to a column"],
];
const DIRECTION = [["right", "to the right"], ["left-in-sharp-keys", "to the left in sharp keys"]];
const NOTES = [["all", "The whole scale"], ["tonic-and-half-steps", "The tonic and the half steps"],
  ["altered", "The sharps or flats only"]];
const PLACE = [["middle", "In the middle of the staff"], ["bottom-set", "On the bottom line set"],
  ["top-set", "On the top line set"], ["every-set", "On every line set"]];
const HEIGHTS = [["window", "Heights in a window around the line set"], ["scale", "Climbing with the scale"]];
const LAYERS = [["all", "All marks"], ["natural", "Naturals"], ["flat", "Flats"], ["sharp", "Sharps"],
  ["line", "On a line or ledger"], ["space", "In a space"], ["alternate", "Every second stack"]];
const SELECTS = [["all", "All"], ["natural", "Naturals"], ["flat", "Flats"], ["sharp", "Sharps"],
  ["line", "On a line or ledger"], ["space", "In a space"]];

function row(label, ...children) {
  const r = el("div", "row");
  r.appendChild(el("div", "row-label", label));
  const body = el("div");
  for (const c of children) if (c) body.appendChild(c);
  r.appendChild(body);
  return r;
}
function radios(options, value) {
  const g = el("div", "radios");
  for (const [v, text] of options) {
    const l = el("label");
    const i = el("input");
    i.type = "radio";
    i.checked = v === value;
    l.appendChild(i);
    l.appendChild(el("span", "", text));
    g.appendChild(l);
  }
  return g;
}
function buttons(options, value) {
  const g = el("div", "buttons");
  for (const [v, text] of options) g.appendChild(el("button", v === value ? "on" : "", text));
  return g;
}
function dropdown(options, value, open = false, prefix = null) {
  const wrap = el("div");
  const line = el("div", "controls");
  if (prefix) line.appendChild(el("span", "unit", prefix));
  const s = select(options, value, () => {});
  s.classList.add("dropdown");
  line.appendChild(s);
  wrap.appendChild(line);
  if (open) {
    const list = el("div", "open-list");
    for (const [v, text] of options) list.appendChild(el("div", v === value ? "on" : "", text));
    wrap.appendChild(list);
  }
  return wrap;
}
function column(title, ...rows) {
  const c = el("div");
  c.appendChild(el("h4", null, title));
  for (const r of rows) c.appendChild(r);
  return c;
}

function dropdowns() {
  const stacks = document.getElementById("stacks");
  stacks.appendChild(column("Today",
    row("Stacks", radios(STACKS, "degrees"), el("div", "unit", "Stacks go"), radios(DIRECTION, "right"))));
  stacks.appendChild(column("Proposed",
    row("Stacks", dropdown(STACKS, "degrees", true), dropdown(DIRECTION, "right", false, "Stacks go"))));

  const others = document.getElementById("others");
  others.appendChild(column("Today",
    row("Notes", radios(NOTES, "all")),
    row("Place", radios(PLACE, "middle")),
    row("Edit", buttons(LAYERS, "all")),
    row("Heights", el("div", "note", "(Stacks: Cycle of fifths)"), radios(HEIGHTS, "window")),
    row("Select", el("div", "note", "(step 7)"), buttons(SELECTS, null))));
  others.appendChild(column("Proposed",
    row("Notes", dropdown(NOTES, "all")),
    row("Place", dropdown(PLACE, "middle")),
    row("Edit", dropdown(LAYERS, "all", true)),
    row("Heights", el("div", "note", "(Stacks: Cycle of fifths)"), dropdown(HEIGHTS, "window")),
    row("Select", el("div", "note", "(step 7)"), dropdown([["", "Select…"], ...SELECTS], ""))));

  const stay = document.getElementById("stay-card");
  stay.appendChild(el("h3", null, "Rows that stay as buttons"));
  const t = el("table", "stay");
  t.appendChild(Object.assign(el("tr"), { innerHTML: "<th>Step</th><th>Row</th><th>Why</th>" }));
  for (const [step, what, why] of [
    ["2 Staff", "Pattern (4–8, 3–6–9, …, Custom)", "tried against the staff on the canvas"],
    ["4 Ledger lines", "Which ones show: Automatic · My own rules", "two, flipped while watching"],
    ["4, Advanced", "trigger pitch classes; rules' pitch classes", "several picked at once"],
    ["5 Noteheads", "the designs; Duration shows by; The breve", "cards with pictures; two-way, flipped while watching"],
    ["5 Noteheads", "Shape, Fill, colour swatches", "pictures, or two flipped while watching"],
    ["Canvas", "Show (Crotchets … All four), Size", "flipped while watching"],
    ["6 Symbol type", "the starting points", "pictures"],
    ["8 Designer", "look card: Symbols, Symbol, Fill, Colour", "actions, pictures, or flipped while watching"],
  ]) {
    const tr = el("tr");
    for (const text of [step, what, why]) tr.appendChild(el("td", null, text));
    t.appendChild(tr);
  }
  stay.appendChild(t);
}

draw();
cases(document.getElementById("anchor-cases"));
dropdowns();
document.body.setAttribute("data-ready", "");
