/**
 * mockup.js — the step-by-step Configurator mock-ups (session 61).
 *
 * Draws index.html with the Configurator's own staff, notehead, ledger,
 * card, collection and key-signature code: the stepped app with its
 * grouped, numbered navigation (built from a sketch of the step registry,
 * design §4), the key-signature steps 6–9 (design §3), and the tutorial
 * notation (design §5). The diamond and the parallelogram are drawn here
 * as stand-ins: the tutorial's diamond is the reader's own, made with the
 * toolkit, and the parallelogram is a built-in shape the build adds.
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
import { CNBCollection } from "../../../cnb/src/cnb-collection.js";

const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const svgEl = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

// ── The step registry, as design §4 sketches it ─────────────────────────────

const STEPS = [
  { id: "notehead-height", number: 1, group: "The staff", label: "Notehead height", title: "Notehead height" },
  { id: "staff", number: 2, group: "The staff", label: "Staff", title: "Staff" },
  { id: "pitch", number: 3, group: "The staff", label: "Pitch", title: "Pitch" },
  { id: "ledger-lines", number: 4, group: "The staff", label: "Ledger lines", title: "Ledger lines" },
  { id: "noteheads", number: 5, group: "Noteheads", label: "Noteheads", title: "Noteheads" },
  { id: "ks-symbol-type", number: 6, group: "Key signature", label: "Symbol type", title: "Key signature symbol type" },
  { id: "ks-custom-symbols", number: 7, group: "Key signature", label: "Custom symbols",
    title: "Custom key signature symbols", disabledReason: "Choose Custom marks in step 6" },
  { id: "ks-designer", number: 8, group: "Key signature", label: "Designer", title: "Key signature designer" },
  { id: "ks-preview", number: 9, group: "Key signature", label: "Preview", title: "Key signature preview" },
  { id: "clef-symbol", number: 10, group: "Clef", label: "Symbol and size", title: "Clef symbol import and sizing" },
  { id: "clef-placement", number: 11, group: "Clef", label: "Placement", title: "Clef semitone/staff assignment" },
  { id: "export", number: 12, group: "Finish", label: "Export", title: "Export" },
];

function drawNav(host, openId) {
  const groups = [...new Set(STEPS.map(s => s.group))];
  for (const g of groups) {
    const div = document.createElement("div");
    div.className = "group";
    const head = document.createElement("div");
    head.className = "group-head";
    head.innerHTML = `<span>${g}</span><span>▾</span>`;
    div.appendChild(head);
    for (const s of STEPS.filter(x => x.group === g)) {
      const a = document.createElement("div");
      a.className = "step-link" + (s.id === openId ? " on" : "") + (s.disabledReason ? " off" : "");
      a.innerHTML = `<span class="n">${s.number}</span><span>${s.label}` +
        (s.disabledReason ? `<span class="why">${s.disabledReason}</span>` : "") + "</span>";
      div.appendChild(a);
    }
    host.appendChild(div);
  }
  host.appendChild(document.createElement("hr"));
  const adv = document.createElement("div");
  adv.className = "step-link";
  adv.innerHTML = `<span class="n"></span><span>Advanced</span>`;
  host.appendChild(adv);
}

// ── The tutorial notation's config (design §5) ──────────────────────────────

/** The reader's diamond: 2 semitones tall, 3 wide, at the toolkit's 100 units a semitone. */
const DIAMOND = {
  displayName: "Diamond",
  svgPath: "M 0 -100 L 150 0 L 0 100 L -150 0 Z",
  svgHollowPath: "M 0 -58 L 87 0 L 0 58 L -87 0 Z",
  naturalHeight: 200, naturalWidth: 300, semitoneHeight: 2,
  // The stems' centres half a stem (0.065 staff spaces × 2 semitones × 100) in from the corners.
  anchors: { crotchetUp: { x: 137, y: 0 }, crotchetDown: { x: -137, y: 0 },
             minimUp: { x: 137, y: 0 }, minimDown: { x: -137, y: 0 } },
  lilypondPath: null, lilypondHollowPath: null, lilypondAnchors: null,
};

/** The optional section's diamond, twice as wide as tall: 2 × 4 semitones. */
const DIAMOND_WIDE = { ...DIAMOND, displayName: "Wide diamond",
  svgPath: "M 0 -100 L 200 0 L 0 100 L -200 0 Z", svgHollowPath: null, naturalWidth: 400, anchors: null };

/** The built-in custom mark custom marks start from: 2 semitones high, 4 wide, leaning right. */
const PARALLELOGRAM = { ...DIAMOND, displayName: "Parallelogram",
  svgPath: "M -200 100 L -100 -100 L 200 -100 L 100 100 Z", svgHollowPath: null, naturalWidth: 400,
  anchors: null, ledgers: false };

function tutorialConfig({ repeat = false, hollowMinims = true, looks = null } = {}) {
  const c = CNBConfig.createDefault();
  c.shapes = { ...c.shapes, diamond: DIAMOND, "diamond-wide": DIAMOND_WIDE, parallelogram: PARALLELOGRAM };
  c.staff = { ...c.staff, semitonePattern: [3, 5, 7, 9], midpoint: 12, semitonesPerStaffSpace: 2 };
  // B's ledger; C♯'s, from which C hangs (a ledger answers only to its own octave).
  c.ledgers = { ...c.ledgers, templates: [
    { semiWithinOctave: 11, triggerPCs: [11], triggerMode: "override" },
    { semiWithinOctave: 1, triggerPCs: [0, 1], triggerMode: "override" },
  ] };
  c.noteheadRules = [
    { name: "Default", priority: 0, match: { pitchClasses: "all", durations: "all", keys: "all" },
      apply: { shape: "diamond", hollow: false, color: null, offKeyMark: false } },
    { name: "Red", priority: 1, match: { pitchClasses: [1, 3, 6, 8, 10], durations: "all", keys: "all" },
      apply: { color: "#cc0000" } },
  ];
  if (hollowMinims) {
    c.noteheadRules.push({ name: "Hollow minims", priority: 2,
      match: { pitchClasses: "all", durations: ["minim"], keys: "all" }, apply: { hollow: true } });
  }
  c.durations = { ...c.durations, representationMode: repeat ? "repeat" : "shape" };
  c.display = { ...c.display, pxPerSemi: 9 };
  c.keys = { ...c.keys, enabled: true, keySignature: { ...c.keys.keySignature, enabled: true,
    stacking: "parity-stacks", ...(looks ? { looks: { ...c.keys.keySignature.looks, ...looks } } : {}) } };
  c.meta = { ...c.meta, configName: "Tutorial 3-5-7-9", fileSuffix: "-Tutorial3579", notationLabel: "Tutorial 3-5-7-9" };
  return c;
}

/** The config with a key as a definition, as the canvas's key picker gives it. */
function withKey(config, tonicPc, mode, spelling = null) {
  const pcs = CNBMusic.scale(tonicPc, mode).slice().sort((a, b) => a - b);
  const sp = spelling || CNBMusic.defaultSpelling(tonicPc, pcs);
  const name = `${sp} ${mode}`;
  const def = { name, pitchClasses: pcs, tonicPc, spelling: sp };
  return { config: { ...config, keys: { ...config.keys, definitions: [def] } }, name };
}

// ── 1. The stepped app ──────────────────────────────────────────────────────

drawNav($("nav"), "noteheads");
CNBCollection.render($("step5-canvas"), tutorialConfig(), { durations: ["crotchet", "minim"], fluid: true, rows: 2 });

// ── 2. The key-signature steps ──────────────────────────────────────────────

const LETTERS = "CDEFGAB";
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ALTS = [{ a: -1, sign: "♭" }, { a: 0, sign: "" }, { a: 1, sign: "♯" }];
const SPELLED_PX = 7;
const WIDE = { minSemi: -24, maxSemi: 48 };

/** One spelled note's cell: a strip of the staff with its mark on its pitch. */
function spelledCell(config, letterIndex, alt, kind, selected) {
  const semi = 12 + LETTER_PC[letterIndex] + alt.a;
  const pc = CNBMusic.pitchClass(semi);
  const cfg = { ...config, display: { ...config.display, pxPerSemi: SPELLED_PX } };
  const grid = CNBGrid.create(cfg, { minSemi: semi - 3, maxSemi: semi + 3 });
  const width = 46;
  const svg = svgEl("svg", { width, height: Math.ceil(grid.svgHeight) });
  CNBStaff.render(svg, grid, cfg, width);
  const space = SPELLED_PX * cfg.staff.semitonesPerStaffSpace;
  const cx = width / 2;
  const y = grid.semiToY(semi);

  if (kind === "accidentals" && alt.a !== 0) {
    const glyph = CNBAccidentalGlyphs.glyph(alt.a > 0 ? "sharp" : "flat", 7 / 4);
    const size = space * CNBKeySignature.signScale(cfg);
    const p = svgEl("path", { d: glyph.path, fill: "#000",
      transform: `translate(${cx - (glyph.x[0] + glyph.x[1]) / 2 * size} ${y}) scale(${size / CNBAccidentalGlyphs.UNITS_PER_STAFF_SPACE})` });
    svg.appendChild(p);
  } else {
    const look = CNBConfig.resolveNotehead(cfg, pc, "crotchet", null);
    const shapeName = kind === "custom" ? (selected ? "diamond-wide" : "parallelogram") : look.shape;
    const shape = cfg.shapes[shapeName];
    if (kind !== "custom" || shape.ledgers !== false) {
      for (const l of CNBLedgerSet.ledgersFor(cfg, [semi], WIDE)) {
        CNBLedgerLine.render(svg, { y: grid.semiToY(l), centerX: cx,
          width: CNBLedgerSet.width(shape.naturalWidth * shape.semitoneHeight / shape.naturalHeight * SPELLED_PX),
          thickness: 0.2 * space });
      }
    }
    const m = CNBNotehead.measure(shape, SPELLED_PX);
    const g = CNBNotehead.render(svg, { shape, x: cx, y, scaleFactor: m.scaleFactor,
      hollow: kind === "custom" ? false : look.hollow, color: kind === "custom" ? "#000" : (look.color || "#000") });
    if (kind === "accidentals") g.setAttribute("opacity", "0.3");
  }
  const cell = document.createElement("div");
  cell.className = "cell" + (selected ? " sel" : "");
  cell.appendChild(svg);
  const lab = document.createElement("span");
  lab.className = "lab";
  lab.textContent = LETTERS[letterIndex] + alt.sign;
  cell.appendChild(lab);
  return cell;
}

function drawSpelled(host, config, kind, isSelected = () => false) {
  host.appendChild(document.createElement("span"));
  for (const L of LETTERS) {
    const c = document.createElement("span");
    c.className = "collab";
    c.textContent = L;
    host.appendChild(c);
  }
  for (const alt of [...ALTS].reverse()) {
    const lab = document.createElement("span");
    lab.className = "rowlab";
    lab.textContent = alt.a > 0 ? "sharp" : alt.a < 0 ? "flat" : "natural";
    host.appendChild(lab);
    for (let i = 0; i < 7; i++) host.appendChild(spelledCell(config, i, alt, kind, isSelected(alt)));
  }
}

const tut = tutorialConfig();
drawSpelled($("spelled-noteheads"), tut, "noteheads");
drawSpelled($("spelled-accidentals"), tut, "accidentals");
drawSpelled($("spelled-custom"), tut, "custom", (alt) => alt.a > 0);

/** A key's signature on its staff, at px a semitone; the marks only when `mini`. */
function signature(config, tonicPc, mode, px, { mini = false, spelling = null } = {}) {
  const { config: picked, name } = withKey(config, tonicPc, mode, spelling);
  picked.display = { ...(picked.display || {}), pxPerSemi: px };
  const m = CNBKeySignature.measure(picked, px, name);
  if (!m) return null;
  const grid = CNBGrid.create(picked, { minSemi: Math.min(...m.semis) - 3, maxSemi: Math.max(...m.semis) + 3 });
  const left = CNBKeySignature.padding(picked, px, name).left + (m.extraLeftPx || 0);
  const width = 2 * left + m.contentWidth;
  const shown = mini ? m.contentWidth + 8 : width;
  const svg = svgEl("svg", { width: Math.ceil(shown), height: Math.ceil(grid.svgHeight),
    viewBox: `${mini ? left - 4 : 0} 0 ${shown} ${grid.svgHeight}` });
  CNBStaff.render(svg, grid, picked, width);
  CNBKeySignature.render(svg, grid, picked, name);
  return svg;
}

for (const [pc, mode, sp] of [[7, "major", "G"], [3, "major", "E♭"]]) {
  const fig = document.createElement("div");
  const s = signature(tut, pc, mode, 14, { spelling: sp });
  if (s) fig.appendChild(s);
  const cap = document.createElement("div");
  cap.className = "hint";
  cap.textContent = `${sp} ${mode}`;
  fig.appendChild(cap);
  $("designer").appendChild(fig);
}

/** A mode's 15 spellings, sharp keys then flat keys, by their number of signs. */
function keysOf(mode) {
  const signs = (name) => {
    const tonic = CNBKeySignature.parseTonicPc(name);
    return (CNBMusic.spell(name, CNBMusic.scale(tonic, mode)) || []).reduce((s, n) => s + n.alteration, 0);
  };
  const names = CNBMusic.spellings(mode).map(name => ({ name, n: signs(name) }));
  return [...names.filter(k => k.n >= 0).sort((a, b) => a.n - b.n),
    ...names.filter(k => k.n < 0).sort((a, b) => b.n - a.n)].map(k => k.name);
}

const all = $("keys-all");
for (const mode of Object.keys(CNBMusic.MODES)) {
  const lab = document.createElement("span");
  lab.className = "mode";
  lab.textContent = mode;
  all.appendChild(lab);
  for (const name of keysOf(mode)) {
    const cell = document.createElement("div");
    cell.className = "mini" + (mode === "major" && name === "G" ? " picked" : "");
    const s = signature(tut, CNBKeySignature.parseTonicPc(name), mode, 2.2, { mini: true, spelling: name });
    if (s) cell.appendChild(s);
    const l = document.createElement("div");
    l.className = "lab";
    l.textContent = name;
    cell.appendChild(l);
    all.appendChild(cell);
  }
}

// ── 3. The tutorial notation ────────────────────────────────────────────────

// One row where the window holds the octave, else two (the canvas's own rule, design §6.1 of the notehead-first design).
const ROW = { fluid: true, rows: window.innerWidth >= 1400 ? 1 : 2 };
{
  const { config, name } = withKey(tutorialConfig(), 7, "major", "G");
  CNBCollection.render($("tut-crotchet"), config, { ...ROW, durations: ["crotchet"], keys: [name] });
}
CNBCollection.render($("tut-minim-repeat"), tutorialConfig({ repeat: true, hollowMinims: false }), { ...ROW, durations: ["minim"] });
CNBCollection.render($("tut-minim-hollow"), tutorialConfig(), { ...ROW, durations: ["minim"] });
{
  const { config, name } = withKey(tutorialConfig({ looks: { all: { shape: "diamond-wide" } } }), 3, "major", "E♭");
  CNBCollection.render($("tut-custom"), config, { ...ROW, durations: ["crotchet"], keys: [name] });
}

document.body.dataset.ready = "1";
