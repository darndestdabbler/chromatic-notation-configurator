/**
 * mockup.js — key-signature designer mock-ups (session 47).
 *
 * Draws each case of index.html with the real preview modules (staff
 * lines, noteheads, ledgers) and a prototype of the design's mark list
 * (key-signature-designer-design.md §4–§5). It is a sketch for review, not
 * the build: sharps and flats are drawn with a serif font, where the build
 * uses LilyPond's Emmentaler glyphs.
 */
import { CNBConfig } from "../../../cnb/src/cnb-config.js";
import { CNBGrid } from "../../../cnb/src/cnb-grid.js";
import { CNBStaff } from "../../../cnb/src/cnb-staff.js";
import { CNBNotehead } from "../../../cnb/src/cnb-notehead.js";
import { CNBLedgerSet } from "../../../cnb/src/cnb-ledger-set.js";
import { CNBLedgerLine } from "../../../cnb/src/cnb-ledger-line.js";

const NS = "http://www.w3.org/2000/svg";
const PX = 7;                                    // px per semitone
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = "CDEFGAB";
const STEPS = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};
const SHARP_ORDER = "FCGDAEB";
const FLAT_ORDER = "BEADGCF";

/** The key's seven notes, spelled: [{ offset, pc, letter, alter }]. */
function spell(tonic, mode) {
  const li = LETTERS.indexOf(tonic[0]);
  const alter0 = tonic.includes("♯") ? 1 : tonic.includes("♭") ? -1 : 0;
  const tonicPc = (LETTER_PC[tonic[0]] + alter0 + 12) % 12;
  return STEPS[mode].map((offset, d) => {
    const letter = LETTERS[(li + d) % 7];
    const pc = (tonicPc + offset) % 12;
    const alter = ((pc - LETTER_PC[letter] + 18) % 12) - 6;
    return { offset, pc, letter, alter };
  });
}

/** Line sets: runs of staff lines one staff space apart, in the range. */
function lineSets(config) {
  const mid = config.staff.midpoint;
  const sps = config.staff.semitonesPerStaffSpace;
  const lines = CNBStaff.getPositions(config, { minSemi: mid - 12, maxSemi: mid + 12 })
    .filter(s => s >= mid - 12 && s <= mid + 12).sort((a, b) => a - b);
  const sets = [];
  for (const s of lines) {
    const last = sets[sets.length - 1];
    if (last && s - last.hi === sps) last.hi = s;
    else sets.push({ lo: s, hi: s });
  }
  return sets;
}

/** The tonic's semitone for a place and rule. */
function tonicSemi(config, pc, set, rule) {
  const mid = config.staff.midpoint;
  const sps = config.staff.semitonesPerStaffSpace;
  const cands = [-3, -2, -1, 0, 1, 2, 3].map(k => pc + 12 * k);
  if (!set) return pc + 12 * Math.round((mid - 6 - pc) / 12);      // today's middle
  if (rule === "rising") return Math.min(...cands.filter(t => t >= set.lo - sps));
  if (rule === "falling") return Math.max(...cands.filter(t => t + 12 <= set.hi + sps));
  const centre = (set.lo + set.hi) / 2;                              // centred
  return cands.reduce((b, t) => Math.abs(t + 6 - centre) < Math.abs(b + 6 - centre) ? t : b);
}

/** The mark list for a case: [{ semi, col, pc, alter, double, sign }]. */
function marks(config, c) {
  const notes = spell(c.key, c.mode);
  const sharps = notes.some(n => n.alter > 0);
  const flats = notes.some(n => n.alter < 0);
  const sets = lineSets(config);
  const places = c.place === "middle" ? [null]
    : c.place === "bottom" ? [sets[0]]
    : c.place === "top" ? [sets[sets.length - 1]]
    : sets;
  const tonicPc = notes[0].pc;
  const out = [];

  if (c.kind === "accidentals") {
    const altered = notes.filter(n => n.alter !== 0)
      .sort((a, b) => (sharps ? SHARP_ORDER : FLAT_ORDER).indexOf(a.letter) -
                      (sharps ? SHARP_ORDER : FLAT_ORDER).indexOf(b.letter));
    for (const set of places) {
      const t = tonicSemi(config, tonicPc, set, c.rule);
      altered.forEach((n, col) => out.push({
        semi: t + n.offset, col, sign: n.alter > 0 ? "♯" : "♭" }));
    }
    return out;
  }

  // Scale notes: the seven, and the upper tonic. Each stacking rule gives
  // each its stack (column):
  //   degrees        1 3 5 7 left, 2 4 6 8 right (today's stacked sevenths)
  //   parity         odd semitones left, even semitones right
  //   parity-stacks  the tonic left, a new stack to the right at each change
  //                  of semitone parity (Clairnote's)
  //   parity-zigzag  the tonic left, the other stack at each change of parity
  const scale = [...notes, { ...notes[0], offset: 12 }];
  let col = 0;
  const cols = scale.map((n, i) => {
    if (c.stacking === "degrees") return i % 2;
    if (c.stacking === "parity") return n.pc % 2 === 1 ? 0 : 1;
    if (i > 0 && (n.offset - scale[i - 1].offset) % 2 === 1) {
      col = c.stacking === "parity-zigzag" ? 1 - col : col + 1;
    }
    return col;
  });
  const maxCol = Math.max(...cols);
  const left = c.columns === "left-in-sharp-keys" && sharps && !flats;
  const keep = scale.map((n, i) => {
    if (i === 7 && !c.upperTonic) return false;
    if (c.notes !== "half-steps" || i === 0 || i === 7) return true;
    return n.offset - scale[i - 1].offset === 1 || scale[i + 1].offset - n.offset === 1;
  });
  for (const set of places) {
    const t = tonicSemi(config, tonicPc, set, c.rule);
    scale.forEach((n, i) => {
      if (!keep[i]) return;
      const semi = t + n.offset;
      const column = left ? maxCol - cols[i] : cols[i];
      // A root two copies share is drawn in each copy's own stack: in the
      // tonic's and the octave's, a double notehead where they differ.
      if (out.some(m => m.semi === semi && m.col === column)) return;
      out.push({ semi, col: column, pc: n.pc, alter: n.alter });
    });
  }
  return out;
}

/** Draws one case into a card. */
function drawCase(parent, config, c) {
  const list = marks(config, c);
  const mid = config.staff.midpoint;
  const semis = list.map(m => m.semi);
  const signs = c.kind === "accidentals";
  const minSemi = Math.min(mid - 12, ...semis) - (signs ? 6 : 2);
  const maxSemi = Math.max(mid + 12, ...semis) + (signs ? 9 : 2);
  const grid = CNBGrid.create({ ...config, display: { ...config.display, pxPerSemi: PX } }, { minSemi, maxSemi });
  const space = CNBStaff.staffSpacePx(config, grid);

  // The marks' look.
  const look = (m) => {
    const r = CNBConfig.resolveNotehead(config, m.pc, "crotchet", null);
    const k = m.alter > 0 ? "sharp" : m.alter < 0 ? "flat" : "natural";
    const own = { ...r, ...(c.looks?.[k] || {}) };
    if (c.alternate && m.col % 2 === 1) Object.assign(own, c.alternate);
    const shape = config.shapes[own.shape];
    const size = c.scale ? { heightSemis: shape.semitoneHeight * c.scale,
      widthSemis: shape.naturalWidth * shape.semitoneHeight / shape.naturalHeight * c.scale } : {};
    return { shape, hollow: own.hollow, color: own.color ?? "#000000",
      m: CNBNotehead.measure(shape, PX, size) };
  };
  const looks = list.map(m => (c.kind === "accidentals" ? null : look(m)));
  const headW = c.kind === "accidentals" ? space * 1.1
    : Math.max(...looks.map(l => l.m.pixelWidth));
  const cols = Math.max(0, ...list.map(m => m.col)) + 1;
  const x0 = 0.75 * space + headW / 2;
  const sigW = 0.75 * space + cols * headW;
  const width = Math.round(sigW + 7 * space);

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(grid.svgHeight));
  svg.setAttribute("viewBox", `0 0 ${width} ${grid.svgHeight}`);

  // Middle C (the staff's middle), faintly.
  const mc = document.createElementNS(NS, "line");
  mc.setAttribute("x1", "0"); mc.setAttribute("x2", String(width));
  mc.setAttribute("y1", String(grid.semiToY(mid))); mc.setAttribute("y2", String(grid.semiToY(mid)));
  mc.setAttribute("stroke", "#c9c9c9"); mc.setAttribute("stroke-dasharray", "3 3");
  svg.appendChild(mc);
  CNBStaff.render(svg, grid, config, width);

  const colX = (col) => x0 + col * headW;

  // The gold stem between each pair of neighbouring stacks, beneath the
  // marks: over the staff's middle ± 12 in the middle, as today; elsewhere
  // over the signature's own marks. Its colour and thickness (in staff
  // spaces) are the designer's.
  const stemOn = c.stem ?? c.stacking === "degrees";
  if (c.kind !== "accidentals" && stemOn) {
    const [top, bottom] = c.place === "middle" ? [mid + 12, mid - 12]
      : [Math.max(...semis) + 1, Math.min(...semis) - 1];
    for (let col = 0; col < cols - 1; col++) {
      const stem = document.createElementNS(NS, "line");
      const x = colX(col) + headW / 2;
      stem.setAttribute("x1", String(x)); stem.setAttribute("x2", String(x));
      stem.setAttribute("y1", String(grid.semiToY(top)));
      stem.setAttribute("y2", String(grid.semiToY(bottom)));
      stem.setAttribute("stroke", c.stemColor ?? "#ffd42a");
      stem.setAttribute("stroke-width", String((c.stemThickness ?? 0.4) * space));
      svg.appendChild(stem);
    }
  }

  if (c.kind === "accidentals") {
    for (const m of list) {
      const t = document.createElementNS(NS, "text");
      t.textContent = m.sign;
      t.setAttribute("x", String(colX(m.col)));
      t.setAttribute("y", String(grid.semiToY(m.semi) + (m.sign === "♭" ? -0.15 : 0.95) * space));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
      t.setAttribute("font-size", String(2.4 * space));
      svg.appendChild(t);
    }
  } else {
    // Ledgers per column, beneath the heads.
    for (let col = 0; col < cols; col++) {
      const inCol = list.filter(m => m.col === col);
      const ledgers = CNBLedgerSet.ledgersFor(config, inCol.map(m => m.semi), { minSemi, maxSemi });
      for (const semi of ledgers) {
        CNBLedgerLine.render(svg, { y: grid.semiToY(semi), centerX: colX(col),
          width: headW * (4 / 3), thickness: 0.2 * space });
      }
    }
    list.forEach((m, i) => {
      const l = looks[i];
      CNBNotehead.render(svg, { shape: l.shape, x: colX(m.col), y: grid.semiToY(m.semi),
        scaleFactor: l.m.scaleFactor, scaleX: l.m.scaleX, scaleY: l.m.scaleY,
        hollow: l.hollow, color: l.color });
    });
  }

  const card = document.createElement("figure");
  card.className = "case";
  card.appendChild(svg);
  const cap = document.createElement("figcaption");
  cap.innerHTML = c.label;
  card.appendChild(cap);
  parent.appendChild(card);
}

async function load(url) {
  return CNBConfig.merge(await (await fetch(url)).json());
}

const configs = {
  default: CNBConfig.createDefault(),
  clairnote: await load("../../../cnb/assets/examples/gallery/clairnote-dn.json"),
  kite: await load("../../../cnb/fixtures/kite-4-369-config.json"),
};

// Clairnote-like symbols, as a designer might import them: a dot, and the
// dot with a tail rising into it (a sharp) or falling into it (a flat).
const DOT = "M 100 0 A 100 100 0 1 1 -100 0 A 100 100 0 1 1 100 0 Z";
const HOLE = "M 55 0 A 55 55 0 1 1 -55 0 A 55 55 0 1 1 55 0 Z";
const tail = (dy) => `M -340 ${dy * 215} L -84 ${dy * 40} L -70 ${dy * 72} L -326 ${dy * 247} Z`;
const symbol = (name, d) => ({ displayName: name, svgPath: d, svgHollowPath: HOLE,
  naturalHeight: 200, naturalWidth: 200, semitoneHeight: 1.6, anchors: null });
configs.clairnote.shapes = { ...configs.clairnote.shapes,
  "cn-dot": symbol("Dot", DOT),
  "cn-sharp": symbol("Dot, rising tail", DOT + " " + tail(1)),
  "cn-flat": symbol("Dot, falling tail", DOT + " " + tail(-1)) };

const base = { kind: "notes", mode: "major", notes: "all", upperTonic: true,
  stacking: "degrees", columns: "right", place: "middle", rule: "centred" };
const PLACE = { middle: "middle", bottom: "bottom set", top: "top set", both: "both sets" };

for (const section of document.querySelectorAll("[data-cases]")) {
  const config = configs[section.dataset.config || "default"];
  for (const c of JSON.parse(section.dataset.cases)) {
    const k = { ...base, ...c };
    k.label = k.label ?? `<b>${k.key} ${k.mode}</b> · ${PLACE[k.place]}` +
      (k.place !== "middle" && section.dataset.rule ? ` · ${k.rule}` : "");
    drawCase(section.querySelector(".cases"), config, k);
  }
}
document.body.dataset.ready = "true";
