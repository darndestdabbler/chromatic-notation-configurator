/**
 * mockup.js — key-signature editor mock-ups (session 53).
 *
 * Draws index.html's cases with the Configurator's own staff, notehead,
 * ledger and Emmentaler sign code, and a prototype of the amended design's
 * one model (key-signature-designer-design.md §13): which notes, the looks
 * laid over one another (naturals, flats, sharps, on a line or ledger, in a
 * space), symbols placed by their reference point plus an offset, added
 * symbols (tails), the stacking rules and the cycle of fifths with its
 * one-octave window, and the touch check over every key. It is a sketch
 * for review, not the build: a tail is drawn as a stroke here, where the
 * build would import it as a shape.
 */
import { CNBConfig } from "../../../cnb/src/cnb-config.js";
import { CNBMusic } from "../../../cnb/src/cnb-music.js";
import { CNBGrid } from "../../../cnb/src/cnb-grid.js";
import { CNBStaff } from "../../../cnb/src/cnb-staff.js";
import { CNBNotehead } from "../../../cnb/src/cnb-notehead.js";
import { CNBLedgerSet } from "../../../cnb/src/cnb-ledger-set.js";
import { CNBLedgerLine } from "../../../cnb/src/cnb-ledger-line.js";
import { CNBAccidentalGlyphs } from "../../../cnb/src/cnb-accidental-glyphs.js";
import { CNBKeySignature } from "../../../cnb/src/cnb-key-signature.js";

const NS = "http://www.w3.org/2000/svg";
const LETTERS = "CDEFGAB";
const SHARP_ORDER = "FCGDAEB";
const FLAT_ORDER = "BEADGCF";
const MAG = 7 / 4;                       // the engine's default magnification
const CONCERT_SPACE_PX = 20 * MAG / 4 * 96 / 72;   // one staff space at concert size: 11.67 px
const WIDE = { minSemi: -48, maxSemi: 72 };

// ── Keys ────────────────────────────────────────────────────────────────────

/** A key's seven notes, spelled from the tonic up: { pc, alteration, offset, letter }. */
function spelled(key) {
  const tonic = CNBKeySignature.parseTonicPc(key.tonic);
  const notes = CNBMusic.spell(key.tonic, CNBMusic.scale(tonic, key.mode));
  const first = LETTERS.indexOf(key.tonic[0]);
  return notes.map((n, i) => ({ ...n, offset: CNBMusic.pitchClass(n.pc - tonic),
    letter: LETTERS[(first + i) % 7] }));
}

/** A mode's 15 spellings, sharp keys then flat keys, each by its number of signs. */
function keysOf(mode) {
  const signed = name => spelled({ tonic: name, mode }).reduce((s, n) => s + n.alteration, 0);
  const names = CNBMusic.spellings(mode).map(name => ({ name, n: signed(name) }));
  return [...names.filter(k => k.n >= 0).sort((a, b) => a.n - b.n),
    ...names.filter(k => k.n < 0).sort((a, b) => b.n - a.n)].map(k => k.name);
}

// ── The staff ───────────────────────────────────────────────────────────────

/** Line sets: runs of the staff's lines one staff space apart (design §4.5). */
function lineSets(config) {
  const mid = config.staff.midpoint;
  const lines = CNBStaff.getPositions(config, { minSemi: mid - 12, maxSemi: mid + 12 })
    .filter(s => s < mid + 12);
  const sets = [];
  for (const s of lines) {
    const last = sets[sets.length - 1];
    if (last && CNBStaff.lilypondPosition(config, s) - CNBStaff.lilypondPosition(config, last.high) <= 2 + 1e-9) last.high = s;
    else sets.push({ low: s, high: s });
  }
  return sets;
}

/** The tonic's semitone in the middle (today's rule) or centred on a set. */
function tonicFor(config, pc, set) {
  if (!set) return pc + 12 * Math.round((config.staff.midpoint - 6 - pc) / 12);
  return CNBMusic.absoluteSemi(pc, Math.round(((set.low + set.high) / 2 - 6 - pc) / 12));
}

/** On a line or a ledger (design §13.4): a staff line's semitone, or one the notation's ledgers give a note there. */
function onLine(config, semi) {
  return CNBStaff.getPositions(config, WIDE).includes(semi) ||
    CNBLedgerSet.ledgersFor(config, [semi], WIDE).includes(semi);
}

// ── The model ───────────────────────────────────────────────────────────────

/** Each note's stack under today's rules (design §4.4). */
function stacksOf(stacking, offsets, tonicPc) {
  const odd = offsets.map(o => (tonicPc + o) % 2 === 1);
  if (stacking === "parity") return odd.map(o => (o ? 0 : 1));
  if (stacking === "parity-stacks") {
    const stacks = [0];
    for (let i = 1; i < offsets.length; i++) stacks.push(stacks[i - 1] + (odd[i] !== odd[i - 1] ? 1 : 0));
    return stacks;
  }
  return offsets.map((_, i) => i % 2);
}

/** The looks laid over one another (design §13.4), the last winning; a shape and a sign share one slot. */
function lookFor(config, sig, note, semi) {
  const own = CNBConfig.resolveNotehead(config, note.pc, "crotchet", null);
  const look = { shape: own.shape, sign: null, hollow: own.hollow, color: own.color ?? "#000000",
    heightSemis: own.heightSemis, widthSemis: own.widthSemis, offset: { x: 0, y: 0 }, added: [] };
  const looks = sig.looks || {};
  const kind = note.alteration === 1 ? "sharp" : note.alteration === -1 ? "flat" : "natural";
  for (const layer of [looks.all, looks[kind], onLine(config, semi) ? looks.line : looks.space]) {
    for (const [field, value] of Object.entries(layer || {})) {
      if (field === "shape") { look.shape = value; look.sign = null; }
      else if (field === "sign") { look.sign = value; look.shape = null; }
      else if (field === "color") look.color = value ?? "#000000";
      else look[field] = value;
    }
  }
  return { ...look, kind };
}

/** A symbol's parts in semitones about the mark's point, each a capsule for the touch check. */
function partsOf(config, look) {
  const sps = config.staff.semitonesPerStaffSpace;
  const parts = [];
  const { x: ox, y: oy } = look.offset;
  if (look.sign) {
    const g = CNBAccidentalGlyphs.glyph(look.sign, MAG);
    const k = CNBKeySignature.signScale(config) * sps;          // semitones per staff space of glyph
    const w = (g.x[1] - g.x[0]) * k;
    parts.push({ type: "sign", sign: look.sign, glyph: g, k, cx: ox, cy: oy,
      left: w / 2 - ox, right: w / 2 + ox, ledgers: false,
      caps: [{ a: [ox, oy + g.y[0] * k * 0.6], b: [ox, oy + g.y[1] * k * 0.6], r: w / 2 }] });
  } else {
    const shape = config.shapes[look.shape];
    const h = look.heightSemis ?? shape.semitoneHeight;
    const w = look.widthSemis ?? shape.naturalWidth * shape.semitoneHeight / shape.naturalHeight;
    const half = Math.max(0, (w - h) / 2);
    parts.push({ type: "shape", shape, h, w, hollow: look.hollow, cx: ox, cy: oy,
      left: w / 2 - ox, right: w / 2 + ox, ledgers: shape.ledgers !== false,
      caps: [{ a: [ox - half, oy], b: [ox + half, oy], r: Math.min(w, h) / 2 }] });
  }
  for (const add of look.added || []) {
    const ax = ox + (add.offset?.x ?? 0), ay = oy + (add.offset?.y ?? 0);
    const a = [ax + add.from[0], ay + add.from[1]], b = [ax + add.to[0], ay + add.to[1]];
    parts.push({ type: "tail", a, b, thick: add.thick,
      left: -Math.min(a[0], b[0]) + add.thick / 2, right: Math.max(a[0], b[0]) + add.thick / 2,
      caps: [{ a, b, r: add.thick / 2 }] });
  }
  return parts;
}

/**
 * The signature for a key (design §13.2–§13.6): marks { semi, column, look,
 * parts }, the column step and the stacks' lines, in semitones.
 */
function layout(config, sig, key) {
  const notes = spelled(key);
  const tonicPc = notes[0].pc;
  const sharpKey = notes.some(n => n.alteration === 1);
  const sets = lineSets(config);
  const places = sig.place === "middle" ? [null] : sig.place === "bottom" ? [sets[0]]
    : sig.place === "top" ? [sets[sets.length - 1]] : sets;
  const scale = [...notes, { ...notes[0], offset: 12 }];
  const raw = [];

  if (sig.stacking === "fifths") {
    const order = sharpKey ? SHARP_ORDER : FLAT_ORDER;
    const chosen = notes.filter(n => sig.notes !== "altered" || n.alteration !== 0)
      .sort((a, b) => order.indexOf(a.letter) - order.indexOf(b.letter));
    for (const set of places) {
      const t = tonicFor(config, tonicPc, set);
      const centre = set ? (set.low + set.high) / 2 : config.staff.midpoint;
      chosen.forEach((n, column) => {
        const raise = (n.alteration === 1 ? sig.window?.sharp : n.alteration === -1 ? sig.window?.flat : 0) ?? 0;
        const low = centre - 6 + raise;                              // the window [low, low + 12)
        const semi = sig.heights === "scale" ? t + n.offset : n.pc + 12 * Math.ceil((low - n.pc) / 12);
        raw.push({ semi, column, note: n });
      });
    }
  } else {
    const offsets = scale.map(n => n.offset);
    const stacks = stacksOf(sig.stacking, offsets, tonicPc);
    const half = i => offsets[i + 1] - offsets[i] === 1 || offsets[i] - offsets[i - 1] === 1;
    const drawn = scale.map((n, i) => (i < 7 || sig.upperTonic) &&
      (sig.notes !== "altered" || n.alteration !== 0) &&
      (sig.notes !== "tonic-and-half-steps" || i === 0 || i === 7 || half(i)));
    const n = 1 + Math.max(...stacks.filter((_, i) => drawn[i]));
    const mirror = sig.columns === "left-in-sharp-keys" && sharpKey;
    for (const set of places) {
      const t = tonicFor(config, tonicPc, set);
      scale.forEach((note, i) => {
        if (!drawn[i]) return;
        const column = mirror ? n - 1 - stacks[i] : stacks[i];
        const semi = t + note.offset;
        if (!raw.some(m => m.semi === semi && m.column === column)) raw.push({ semi, column, note });
      });
    }
  }

  const marks = raw.map(m => {
    const look = lookFor(config, sig, m.note, m.semi);
    return { ...m, look, parts: partsOf(config, look) };
  });
  // The step: the farthest any mark reaches right of its stack's line, plus the farthest left.
  const left = Math.max(0, ...marks.flatMap(m => m.parts.map(p => p.left)));
  const right = Math.max(0, ...marks.flatMap(m => m.parts.map(p => p.right)));
  const columns = 1 + Math.max(0, ...marks.map(m => m.column));
  return { marks, left, right, step: left + right, columns, sharpKey };
}

// ── The touch check (design §13.7) ──────────────────────────────────────────

function segDist(p1, q1, p2, q2) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const clamp = v => Math.max(0, Math.min(1, v));
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a < 1e-12 && e < 1e-12) { s = 0; t = 0; }
  else if (a < 1e-12) { s = 0; t = clamp(f / e); }
  else {
    const c = dot(d1, r);
    if (e < 1e-12) { t = 0; s = clamp(-c / a); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? clamp((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); }
    }
  }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s], c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t];
  return Math.hypot(c1[0] - c2[0], c1[1] - c2[1]);
}

/** The pairs of marks whose ink touches, in the same or neighbouring stacks. */
function touches(config, sig, key) {
  const L = layout(config, sig, key);
  const at = (m, c) => ({ a: [c.a[0] + m.column * L.step, c.a[1] + m.semi],
    b: [c.b[0] + m.column * L.step, c.b[1] + m.semi], r: c.r });
  const found = [];
  L.marks.forEach((m, i) => L.marks.slice(i + 1).forEach(n => {
    if (Math.abs(m.column - n.column) > 1) return;
    const hit = m.parts.some(p => n.parts.some(q => p.caps.some(c => q.caps.some(d => {
      const A = at(m, c), B = at(n, d);
      return segDist(A.a, A.b, B.a, B.b) < A.r + B.r - 1e-6;
    }))));
    if (hit) found.push([m, n]);
  }));
  return found;
}

// ── Drawing ─────────────────────────────────────────────────────────────────

const el = (name, attrs = {}) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

/**
 * Draws a signature into a new SVG. opts: pxPerSemi; range "staff" (the
 * whole engraved staff) or "marks"; select (a kind to show selected);
 * touched (pairs to mark); padLeft / padRight in staff spaces.
 */
function drawSignature(config, sig, key, opts) {
  const px = opts.pxPerSemi;
  const L = layout(config, sig, key);
  const mid = config.staff.midpoint;
  const lows = L.marks.flatMap(m => [m.semi - 3]), highs = L.marks.flatMap(m => [m.semi + 3]);
  let minSemi = Math.min(...lows), maxSemi = Math.max(...highs);
  if (opts.range === "staff") { minSemi = Math.min(minSemi, mid - 13); maxSemi = Math.max(maxSemi, mid + 13); }
  else {
    const lines = CNBStaff.getPositions(config, { minSemi: minSemi - 6, maxSemi: maxSemi + 6 });
    minSemi = Math.min(minSemi, ...lines.filter(s => s >= minSemi - 2)) - 1;
    maxSemi = Math.max(maxSemi, ...lines.filter(s => s <= maxSemi + 2)) + 1;
  }
  minSemi = Math.floor(minSemi); maxSemi = Math.ceil(maxSemi);
  const grid = CNBGrid.create({ ...config, display: { ...config.display, pxPerSemi: px } }, { minSemi, maxSemi });
  const space = CNBStaff.staffSpacePx(config, grid);
  const padL = (opts.padLeft ?? 0.75) * space, padR = (opts.padRight ?? 1.5) * space;
  const x0 = padL + L.left * px;
  const colX = c => x0 + c * L.step * px;
  const width = Math.ceil(x0 + (L.columns - 1) * L.step * px + L.right * px + padR);
  const height = grid.svgHeight;

  const svg = el("svg", { width, height, viewBox: `0 0 ${width} ${height}` });
  CNBStaff.render(svg, grid, config, width);

  // The gold stem between neighbouring stacks, beneath the marks (not under the cycle of fifths).
  if (sig.stem && sig.stacking !== "fifths" && L.columns > 1) {
    const top = sig.place === "middle" ? mid + 12 : Math.max(...L.marks.map(m => m.semi));
    const bottom = sig.place === "middle" ? mid - 12 : Math.min(...L.marks.map(m => m.semi));
    for (let c = 0; c < L.columns - 1; c++) {
      const x = (colX(c) + colX(c + 1)) / 2;
      svg.appendChild(el("line", { x1: x, x2: x, y1: grid.semiToY(Math.min(top, maxSemi)),
        y2: grid.semiToY(Math.max(bottom, minSemi)), stroke: "#ffd42a",
        "stroke-width": 0.4 * space / (L.columns - 1), "stroke-linecap": "round" }));
    }
  }

  // Each stack's ledgers, beneath its marks, from the marks that take them.
  for (let c = 0; c < L.columns; c++) {
    const inCol = L.marks.filter(m => m.column === c && m.parts[0].ledgers);
    if (inCol.length === 0) continue;
    const w = Math.max(...inCol.map(m => m.parts[0].w)) * px;
    for (const semi of CNBLedgerSet.ledgersFor(config, inCol.map(m => m.semi), { minSemi, maxSemi })) {
      CNBLedgerLine.render(svg, { y: grid.semiToY(semi), centerX: colX(c),
        width: w * 4 / 3 + 0.2 * space, thickness: 0.2 * space });
    }
  }

  // The marks: each symbol at its point (the reference point plus its offset).
  const touched = new Set((opts.touched || []).flat());
  for (const m of L.marks) {
    const cx = colX(m.column), cy = grid.semiToY(m.semi);
    for (const p of m.parts) {
      if (p.type === "shape") {
        const meas = CNBNotehead.measure(p.shape, px, { heightSemis: p.h, widthSemis: p.w });
        CNBNotehead.render(svg, { shape: p.shape, x: cx + p.cx * px, y: cy - p.cy * px,
          scaleFactor: meas.scaleFactor, scaleX: meas.scaleX, scaleY: meas.scaleY,
          hollow: p.hollow, color: m.look.color });
      } else if (p.type === "sign") {
        const k = p.k * px / CNBAccidentalGlyphs.UNITS_PER_STAFF_SPACE;
        const boxMid = (p.glyph.x[0] + p.glyph.x[1]) / 2 * CNBAccidentalGlyphs.UNITS_PER_STAFF_SPACE;
        const g = el("g", { transform: `translate(${cx + p.cx * px},${cy - p.cy * px}) scale(${k}) translate(${-boxMid},0)` });
        g.appendChild(el("path", { d: p.glyph.path, fill: m.look.color }));
        svg.appendChild(g);
      } else {
        svg.appendChild(el("line", { x1: cx + p.a[0] * px, y1: cy - p.a[1] * px,
          x2: cx + p.b[0] * px, y2: cy - p.b[1] * px, stroke: m.look.color,
          "stroke-width": p.thick * px, "stroke-linecap": "round" }));
      }
    }
    if (touched.has(m)) {
      svg.appendChild(el("circle", { cx, cy, r: Math.max(5, 1.4 * px), fill: "none",
        stroke: "#b3261e", "stroke-width": 1.5 }));
    }
    if (opts.select && m.look.kind === opts.select) {
      const p = m.parts[0];
      const ext = Math.max(...m.parts.map(q => q.left)) * px, extR = Math.max(...m.parts.map(q => q.right)) * px;
      const h = (p.h ?? 2) * px;
      const primary = m === L.marks.find(n => n.look.kind === opts.select);
      svg.appendChild(el("rect", { x: cx - ext - 3, y: cy - h / 2 - 3, width: ext + extR + 6, height: h + 6,
        fill: "none", stroke: "#2f5bd3", "stroke-width": primary ? 1.5 : 1,
        "stroke-dasharray": primary ? "" : "3 3", opacity: primary ? 1 : 0.7 }));
      // The reference point: a small cross on the mark's pitch.
      svg.appendChild(el("path", { d: `M ${cx - 5} ${cy} H ${cx + 5} M ${cx} ${cy - 5} V ${cy + 5}`,
        stroke: "#2f5bd3", "stroke-width": 1.5 }));
      if (primary) {
        svg.appendChild(el("rect", { x: cx + extR, y: cy + h / 2, width: 8, height: 8,
          fill: "#fff", stroke: "#2f5bd3", "stroke-width": 1.5 }));
        const t = el("text", { x: cx + extR + 12, y: cy + h / 2 + 8, "font-size": 11,
          "font-family": "system-ui, sans-serif", fill: "#2f5bd3" });
        t.textContent = opts.readout ?? "";
        svg.appendChild(t);
      }
    }
  }
  return svg;
}

// ── Configs and signatures ──────────────────────────────────────────────────

async function load(url) { return CNBConfig.merge(await (await fetch(url)).json()); }

const configs = {
  default: CNBConfig.createDefault(),
  sn: await load("../../../cnb/assets/examples/gallery/clairnote-sn.json"),
  dn: await load("../../../cnb/assets/examples/gallery/clairnote-dn.json"),
};

// Clairnote's tails (design §13.3, §13.7): each an added symbol from the dot's centre, its
// reference point, starting in the dot's ring and leaving it at 30° below (a sharp) or above
// (a flat) the horizontal, to the left; 0.36 semitones (0.09 staff spaces) thick.
const tail = (sign, degrees = 30, length = 1.15) => {
  const a = degrees * Math.PI / 180, start = [-0.5, sign * 0.29];
  return { from: start, to: [start[0] - length * Math.cos(a), start[1] + sign * length * Math.sin(a)], thick: 0.36 };
};

const SIGS = {
  noteheads: { notes: "all", upperTonic: true, stacking: "degrees", place: "middle", stem: true, looks: {} },
  traditional: { notes: "altered", stacking: "fifths", heights: "window", window: { sharp: 0, flat: 0 },
    place: "middle", looks: { flat: { sign: "flat" }, sharp: { sign: "sharp" } } },
  traditionalScale: { notes: "altered", stacking: "fifths", heights: "scale", place: "middle",
    looks: { flat: { sign: "flat" }, sharp: { sign: "sharp" } } },
  sn: { notes: "all", upperTonic: false, stacking: "parity-stacks", columns: "left-in-sharp-keys", place: "bottom",
    looks: { all: { shape: "clairnote-dot" }, line: { hollow: false }, space: { hollow: true },
      flat: { added: [tail(1)] }, sharp: { added: [tail(-1)] } } },
  dn: { notes: "all", upperTonic: false, stacking: "parity-stacks", columns: "left-in-sharp-keys", place: "bottom",
    looks: { all: { shape: "clairnote-dot" }, flat: { added: [tail(1)] }, sharp: { added: [tail(-1)] } } },
};
SIGS.snSteep = { ...SIGS.sn, looks: { ...SIGS.sn.looks,
  flat: { added: [tail(1, 75, 1.4)] }, sharp: { added: [tail(-1, 75, 1.4)] } } };

const MODES = Object.keys(CNBMusic.MODES);
const allKeys = () => MODES.flatMap(mode => keysOf(mode).map(tonic => ({ tonic, mode })));
const keyName = k => `${k.tonic} ${k.mode}`;

// ── The editor (section 1) ──────────────────────────────────────────────────

const EDIT_KEY = { tonic: "B♭", mode: "major" };
const editor = document.getElementById("magnified");
editor.appendChild(drawSignature(configs.sn, SIGS.sn, EDIT_KEY,
  { pxPerSemi: 24, range: "marks", select: "flat", padLeft: 1.2, padRight: 4, readout: "h 1.6 · offset x 0.0 y 0.0" }));

document.getElementById("staff-strip").appendChild(drawSignature(configs.sn, SIGS.sn, EDIT_KEY,
  { pxPerSemi: 6, range: "staff", padRight: 12 }));

// Other keys: the picked mode's 15 spellings at the staff's small size, a key whose marks touch outlined.
function otherKeys(target, sig, mode, picked) {
  for (const tonic of keysOf(mode)) {
    const key = { tonic, mode };
    const found = touches(configs.sn, sig, key);
    const fig = document.createElement("figure");
    fig.className = "mini" + (tonic === picked ? " picked" : "") + (found.length ? " touch" : "");
    fig.appendChild(drawSignature(configs.sn, sig, key, { pxPerSemi: 3.6, range: "marks", touched: found,
      padLeft: 0.5, padRight: 0.5 }));
    const cap = document.createElement("figcaption");
    cap.innerHTML = `<b>${tonic}</b>` + (found.length ? ` · ${found.length} touch` : "");
    fig.appendChild(cap);
    target.appendChild(fig);
  }
}
function summary(sig) {
  const hit = allKeys().filter(k => touches(configs.sn, sig, k).length > 0);
  return hit.length === 0 ? "No marks touch in any of the 105 keys."
    : `Marks touch in ${hit.length} of the 105 keys: ${hit.slice(0, 8).map(keyName).join(", ")}` +
      (hit.length > 8 ? `, and ${hit.length - 8} more.` : ".");
}
otherKeys(document.getElementById("others"), SIGS.sn, "major", EDIT_KEY.tonic);
document.getElementById("touch-summary").textContent = summary(SIGS.sn);
otherKeys(document.getElementById("others-steep"), SIGS.snSteep, "major", EDIT_KEY.tonic);
document.getElementById("touch-summary-steep").textContent = summary(SIGS.snSteep);

// The look card's symbol thumbnails.
function thumb(target, label, draw, on) {
  const b = document.createElement("button");
  b.className = "thumb" + (on ? " on" : "");
  b.title = label;
  const svg = el("svg", { width: 40, height: 40, viewBox: "-20 -20 40 40" });
  draw(svg);
  b.appendChild(svg);
  const cap = document.createElement("span");
  cap.textContent = label;
  b.appendChild(cap);
  target.appendChild(b);
}
const shapeThumb = (name, hollow) => svg => {
  const s = configs.sn.shapes[name];
  const k = 22 / Math.max(s.naturalWidth, s.naturalHeight);
  CNBNotehead.render(svg, { shape: s, x: 0, y: 0, scaleFactor: k, hollow, color: "#1c1c1e" });
};
const signThumb = sign => svg => {
  const g = CNBAccidentalGlyphs.glyph(sign, MAG);
  const u = CNBAccidentalGlyphs.UNITS_PER_STAFF_SPACE;
  const k = 30 / ((g.y[1] - g.y[0]) * u);
  const gr = el("g", { transform: `scale(${k}) translate(${-(g.x[0] + g.x[1]) / 2 * u},${(g.y[0] + g.y[1]) / 2 * u})` });
  gr.appendChild(el("path", { d: g.path, fill: "#1c1c1e" }));
  svg.appendChild(gr);
};
const tailThumb = t => svg => {
  const k = 9;
  svg.appendChild(el("line", { x1: t.from[0] * k + 6, y1: -t.from[1] * k, x2: t.to[0] * k + 6, y2: -t.to[1] * k,
    stroke: "#1c1c1e", "stroke-width": t.thick * k, "stroke-linecap": "round" }));
  svg.appendChild(el("path", { d: "M 3 0 H 9 M 6 -3 V 3", stroke: "#2f5bd3", "stroke-width": 1.2 }));
};
const symbols = document.getElementById("symbols");
thumb(symbols, "As beneath", shapeThumb("clairnote-dot", false), true);
thumb(symbols, "Notehead", shapeThumb("crotchet-minim", false), false);
thumb(symbols, "Dot", shapeThumb("clairnote-dot", false), false);
thumb(symbols, "Sharp", signThumb("sharp"), false);
thumb(symbols, "Flat", signThumb("flat"), false);
const added = document.getElementById("added");
thumb(added, "Tail up", tailThumb(tail(1)), true);

// ── At concert size (section 2) ─────────────────────────────────────────────

const CASES = [
  { sig: "noteheads", config: "default", title: "The notehead signature (the default)",
    keys: [{ tonic: "D", mode: "major" }, { tonic: "B♭", mode: "major" }],
    note: "Every mark the notehead's own look, stacked sevenths, the gold stem, in the middle." },
  { sig: "traditional", config: "default", title: "Traditional, the window's zigzag",
    keys: [{ tonic: "E", mode: "major" }, { tonic: "A♭", mode: "major" }],
    note: "The sharps or flats only, Emmentaler's signs, the cycle of fifths, each in the octave window around the staff's middle." },
  { sig: "traditionalScale", config: "default", title: "Traditional, climbing (session 51's heights)",
    keys: [{ tonic: "E", mode: "major" }, { tonic: "A♭", mode: "major" }],
    note: "The same with the heights \"scale\": what a config saved with today's \"Sharps or flats\" draws." },
  { sig: "sn", config: "sn", title: "Clairnote SN with tails",
    keys: [{ tonic: "D", mode: "major" }, { tonic: "B♭", mode: "major" }],
    note: "A dot for every mark, solid on a line or ledger and hollow in a space (the line and space looks); a tail up for a flat, down for a sharp." },
  { sig: "dn", config: "dn", title: "Clairnote DN with tails",
    keys: [{ tonic: "D", mode: "major" }, { tonic: "B♭", mode: "major" }],
    note: "The dot follows DN's noteheads, solid and hollow by turns; the same tails." },
];
const concert = document.getElementById("concert");
for (const c of CASES) {
  const row = document.createElement("div");
  row.className = "concert-row";
  const head = document.createElement("div");
  head.className = "concert-head";
  head.innerHTML = `<b>${c.title}</b><span>${c.note}</span>`;
  row.appendChild(head);
  for (const key of c.keys) {
    const fig = document.createElement("figure");
    fig.className = "case";
    const sizes = document.createElement("div");
    sizes.className = "sizes";
    const sps = configs[c.config].staff.semitonesPerStaffSpace;
    sizes.appendChild(drawSignature(configs[c.config], SIGS[c.sig], key,
      { pxPerSemi: CONCERT_SPACE_PX / sps, range: "staff", padRight: 3 }));
    sizes.appendChild(drawSignature(configs[c.config], SIGS[c.sig], key,
      { pxPerSemi: 3 * CONCERT_SPACE_PX / sps, range: "staff", padRight: 1.5 }));
    fig.appendChild(sizes);
    const cap = document.createElement("figcaption");
    cap.innerHTML = `<b>${keyName(key)}</b> · concert size, and 3×`;
    fig.appendChild(cap);
    row.appendChild(fig);
  }
  concert.appendChild(row);
}

document.body.dataset.ready = "true";
