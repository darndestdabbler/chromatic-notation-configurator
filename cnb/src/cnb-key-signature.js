/**
 * cnb-key-signature.js — Key-signature renderer (set 010)
 *
 * Renders the selected key's signature into a gutter column at the start of
 * the staff, positioned on the semitone grid. Pure config-in/DOM-out: no
 * state, no event listeners. Composes with the set-009 clef gutter (clef
 * first, then key signature, left to right).
 *
 * The default signature mirrors the engine's keysig.ly (the
 * glyph-from-the-shape-pipeline arm of binding rule 2). The task owner
 * evaluated simple built-in marks (dot, interval blocks, staggered ledgers)
 * across set-010 s2 UAT and chose the note stack, deferring richer
 * custom-symbol signatures to a future set (s2-uat.md,
 * s2-design-consult.md); session 54's one model is that future (below).
 *
 *   The default: the key's scale as REAL noteheads — every pitch
 *   class of the key ascending from the tonic, plus the octave tonic —
 *   interleaved into two columns (even indices left, odd indices right).
 *   For a 7-note key this reads as two stacked 7th chords: degrees 1-3-5-7
 *   on the root in the left column, degrees 2-4-6-8 on the second degree in
 *   the right column, chord qualities falling out of the mode automatically.
 *   Each notehead is resolved through the normal rule pipeline at crotchet
 *   duration (the engine resolves keysig noteheads at quarter-note
 *   duration — stencils.ly cnb:get-keysig-note-stencil), with the selected
 *   key passed as the rule-match key context. Ledger lines are drawn per
 *   column through the shared ledger rules, beneath the noteheads
 *   (keysig.ly's two-pass layering).
 *
 * A vertical separator bar — the engine's gold STEM (cnb:gold #ffd42a) —
 * runs through the horizontal middle of the columns, beneath the marks,
 * spanning staff.midpoint ± extentSemis. (keysig.ly draws its bar at
 * max-notehead-x-offset − width/2 = exactly midway between the column
 * centers, 0.4 staff-space thick, stencil-added UNDER the marks; geometry
 * confirmed against engine SVG renders in s2 UAT after the operator
 * corrected session 1's "right edge" reading, which came from a misleading
 * keysig.ly comment.)
 *
 * The displayed key is EXAMPLE DATA (architecture principle 1): it arrives
 * as the keyName argument (the collection passes options.keys[0]), never
 * from the config. Rendering is gated on keys.enabled AND
 * keys.keySignature.enabled AND the key name resolving to a definition
 * (E2: "only when keys.enabled and a signature device is configured").
 *
 * Placement is driven by the keys.keySignature.placement subsection
 * (binding rule 2's placement rule; session 2's placement-rule controls
 * edit it): placement.rule names how the key's pitch classes map to grid
 * positions — "scale-from-tonic" (s1 decision D1) is the vocabulary's
 * only implemented value, and an unknown rule renders nothing (validation
 * reports it as an error). Vertical anchoring (s1 decision D4):
 * placement.tonicOctave null = auto — the octave span
 * [tonicSemi, tonicSemi+12] is centered on staff.midpoint, ties resolving
 * upward (C tonic, midpoint 12 → tonic at semitone 12, matching the
 * engine's middle-C anchor for the default config). An explicit integer
 * tonicOctave overrides.
 *
 * Inspired by Clairnote DN's alternative key signatures (design
 * CC BY-SA 4.0, Paul Morris); no code is ported from clairnote.ly — the
 * notehead-chord layout follows this project's own engine module
 * (keysig.ly in the chromatic-notation-base repo).
 *
 * Session 48 (the key-signature designer, docs/planning/key-signature-
 * designer-design.md §4, §8): what is drawn is one pure answer, marks(),
 * for every scale-note choice — the notes, the upper tonic, the looks of all
 * marks, flats, sharps and every second stack, the four stacking rules and
 * their direction, the gold stems between neighbouring stacks, and the place
 * (the middle, or the bottom, top or every line set). measure, the gutter
 * and render draw from it; at the defaults it is the stack described above,
 * drawn exactly as before (cnb/fixtures/key-signature-baseline.json).
 *
 * Session 51 (design §5) drew the traditional signature as a style of its
 * own, sized in semitones since session 52 (signHeight, signScale): the
 * signs are Emmentaler's (cnb-accidental-glyphs.js), in the optical size
 * LilyPond uses at the config's magnification, scaled about their origins by
 * one factor, with no ledgers and no gold stems.
 *
 * Session 54 (design §13): one model draws every signature, and `style` is
 * retired (CNBConfig.signatureStyleToModel converts a saved one on load).
 * The notes can be the sharps or flats only; the looks for naturals, a line
 * or ledger and a space join those of all marks, flats, sharps and every
 * second stack; a look's sign makes a mark Emmentaler's sharp or flat, black
 * unless a look colours it; a look may add up to two symbols, solid, in the
 * mark's colour, with no ledgers. A shape's reference point is placed on the
 * mark's pitch plus the look's offset, and a shape without one has its box
 * centred there, as before; a shape with ledgers false takes none, and a
 * head's ledgers follow its base. The step between stacks is the farthest
 * any mark reaches right of its line plus the farthest any reaches left.
 * Stacking "fifths" puts one mark in each column in the cycle of fifths, at
 * its note in the scale ("scale", session 51's rule) or in an octave's
 * window around its line set ("window"). The traditional signature is the
 * sharps or flats only, the signs and the cycle of fifths.
 *
 * Set 014 (pitch axis): mark placement already flows through semiToY; on
 * an axis config each mark also takes its resolved xOffsetStaffSpaces
 * (widening the gutter to fit), its ledgers follow it, and the separator's
 * extentSemis is converted as a length, not mapped through the axis
 * (design §1.2/§2.3). Linear configs render exactly as before.
 *
 * Dependencies: Modules A (config), B (music), 1 (grid context passed in),
 * 5 (ledger set), 6 (notehead), 24 (pitch axis — gutter measurement), and
 * the accidental glyphs.
 */

import { CNBConfig } from "./cnb-config.js";
import { CNBMusic } from "./cnb-music.js";
import { CNBNotehead } from "./cnb-notehead.js";
import { CNBLedgerSet } from "./cnb-ledger-set.js";
import { CNBPitchAxis } from "./cnb-pitch-axis.js";
import { CNBClef } from "./cnb-clef.js";
import { CNBStaff } from "./cnb-staff.js";
import { CNBScheme } from "./cnb-scheme.js";
import { CNBAccidentalGlyphs } from "./cnb-accidental-glyphs.js";

const NS = "http://www.w3.org/2000/svg";

// The engine's spacing around the signature (session 34, measured from
// renders), in staff spaces: the signature's ink starts 0.75 after the
// staff's start, or its marks 3.5 after the clef's left edge (LilyPond's
// clef-to-signature minimum-space), and the first note's head is centred
// 4.8636 after its ink, whatever the widths of the marks and of that
// notehead (measured). The ink is the marks and any ledger of the first or
// last stack (session 50, engine 1.4.1).
const SPACE_BEFORE = 0.75;
const FIRST_NOTE_CENTRE = 4.8636;
// A signature drawn from the mark table (LY spec 1.3.15 §5.6a) is spaced by
// its ink (session 49, measured from renders, a time signature after it as
// in a score): the ink starts 0.75 after the staff's start, and the first
// note's head is centred 4.8636 after it ends. After a clef, LilyPond places
// the signature's origin, the first stack's left edge, 2.9286 after the
// clef's left edge, whatever its ink, and the scale stack's marks 3.5 (they
// start 4/7 into its stencil).
//
// Both at the engine's default magnification, 7/4 (session 52, measured
// against engine 1.5.0, which engraves a score at the config's): LilyPond
// puts the origin 3.5 after the clef's box, its clef-to-signature minimum
// space, and the engine draws every clef 1 unmagnified staff space, 1/m of
// the staff's, right of its box (clefs.ly X-offset), so the origin is 3.5 −
// 1/m after the clef's ink. And the first note follows a 4/4 time signature,
// 1.15 after the signature and 2 before the note's centre, as wide as its
// optical size draws it (below).
const CLEF_SPACE = 3.5;
const SCALE_STACK_INSET = 4 / 7;
// The 4/4 time signature's width in staff spaces in each Emmentaler optical
// size, measured from LilyPond 2.24 renders (session 52). Below emmentaler-16
// (magnifications under 0.8) LilyPond also keeps the staff lines and the
// note's spacing at their unmagnified sizes, which the preview does not follow.
const TIME_SIGNATURE_WIDTH = { 11: 1.6486, 13: 1.6614, 14: 1.6728, 16: 1.6829, 18: 1.692, 20: 1.7, 23: 1.7072, 26: 1.7135 };

// The engine's signature ledger (keysig.ly cnb:add-keysig-ledgers): 4/3 of
// its head's width, drawn as a line 0.2 staff spaces thick with round caps,
// which reach half that beyond each end.
const LEDGER_CAP = 0.1;

// The traditional signature's signs (session 51, design §5): Emmentaler's
// sharp and flat in the optical size LilyPond draws the staff with
// (cnb-accidental-glyphs.js), at the config's own magnification.
function signGlyph(config, sign) {
  return CNBAccidentalGlyphs.glyph(sign, magnification(config));
}

/** The staff's magnification, engine.defaultMagnify (7/4 unless set). */
function magnification(config) {
  const r = CNBScheme.parseRatio((config.engine || {}).defaultMagnify ?? "7/4");
  return r && r.num > 0 ? r.num / (r.den ?? 1) : 7 / 4;
}

/** The automatic size's cap, in semitones (session 52). */
const SIGN_HEIGHT_CAP = 3;

/** The order of a signature's sharps (and, reversed, its flats) by letter. */
const SHARP_ORDER = "FCGDAEB";

/** A sign's width in staff spaces, at its size (session 52). */
const signWidth = (config, sign) => {
  const { x } = signGlyph(config, sign);
  return (x[1] - x[0]) * CNBKeySignature.signScale(config);
};

/** One staff space in px. */
const spacePx = (config, pxPerSemi) =>
  CNBStaff.staffSpacePx(config, { pxPerSemi, axis: CNBPitchAxis.create(config) });

/** A signature ledger's whole length in px, its caps included. */
function ledgerLength(markWidth, space) {
  return markWidth * (4 / 3) + 2 * LEDGER_CAP * space;
}

/** CNBKeySignature.padding for a measured signature. */
function gutterPadding(config, pxPerSemi, m, firstHeadCenter) {
  const space = CNBStaff.staffSpacePx(config, { pxPerSemi, axis: CNBPitchAxis.create(config) });
  const clef = CNBClef.activeGlyph(config);
  const scaleStack = CNBKeySignature.isScaleStack(config);
  const mag = magnification(config);
  const fromClef = (CLEF_SPACE + (scaleStack ? SCALE_STACK_INSET : 0) - 1 / mag) * space;
  const firstNote = FIRST_NOTE_CENTRE -
    (TIME_SIGNATURE_WIDTH[26] - TIME_SIGNATURE_WIDTH[CNBAccidentalGlyphs.designSize(mag)]);
  const left = clef
    ? Math.max(0, fromClef - CNBClef.measure(clef.def, pxPerSemi, space).pixelWidth -
        (config.clef?.gutter?.paddingH ?? 12))
    : SPACE_BEFORE * space;
  // Without the first card, a column for a notehead the size of the marks
  // stands for it: its padding plus half its ledger (CNBCard.columnWidth).
  const inset = firstHeadCenter ??
    (config.display?.column?.paddingH ?? 16) + CNBLedgerSet.width(m.markWidth) / 2;
  // The ink, from the stacks' start: since engine 1.4.1 (engine session 33)
  // the signature's heads take the notation's ledgers, as the canvas draws
  // them, so the scale stack is spaced by its ink as the mark table is
  // (session 50).
  const ink = inkExtent(config, pxPerSemi, m, space);
  const before = clef ? 0 : -ink.left;
  const after = ink.right - m.columns * m.markWidth;
  return { left: Math.max(0, left + before), right: Math.max(0, after + firstNote * space - inset) };
}

/**
 * A mark's symbols at pxPerSemi (session 54, design §13.3, §13.6): the base
 * (a head, a sign, or a symbol, a shape with ledgers false), then the added
 * ones. Each is { kind, shape | sign, hollow, color, heightSemis, widthSemis,
 * scale, x, y, cx, width, ... } in px from the column's line and the mark's
 * pitch, y down: x, y where its origin goes, cx its box's centre (a shape's
 * box is centred on its origin, as the preview always draws it; a sign's on
 * its reference) and width the box's. The base's point is the line plus the
 * look's offset (semitones, axis units under an axis); a shape with a
 * reference point has it there, one without has its box centred there, as
 * today, and a sign has its reference (its box's centre across, its origin
 * up and down). An added symbol is placed the same way at the base's point
 * plus its own offset, solid, in the mark's colour. Null when the base's
 * shape is not defined.
 */
function symbolsOf(config, mark, pxPerSemi) {
  const shapes = config.shapes || {};
  const place = (point, offset) => ({
    x: point.x + ((offset && offset.x) || 0) * pxPerSemi,
    y: point.y - ((offset && offset.y) || 0) * pxPerSemi,
  });
  const shaped = (kind, name, size, point, look) => {
    const shape = shapes[name];
    if (!shape) return null;
    const { scaleFactor, scaleX, scaleY, pixelWidth } = CNBNotehead.measure(shape, pxPerSemi, size);
    const ref = shape.reference;
    const x = ref ? point.x - ref.x * scaleX : point.x;
    const y = ref ? point.y - ref.y * scaleY : point.y;
    return { kind, shape: name, hollow: look.hollow, color: look.color,
      heightSemis: size.heightSemis ?? null, widthSemis: size.widthSemis ?? null,
      reference: !!ref, x, y, cx: x, width: pixelWidth, scaleFactor, scaleX, scaleY };
  };
  const point = place({ x: 0, y: 0 }, mark.offset);
  let base;
  if (mark.sign) {
    const glyph = signGlyph(config, mark.sign);
    const size = spacePx(config, pxPerSemi) * (mark.scale ?? 1);
    base = { kind: "sign", sign: mark.sign, scale: mark.scale ?? 1, color: mark.color, reference: true,
      x: point.x - (glyph.x[0] + glyph.x[1]) / 2 * size, y: point.y, cx: point.x,
      width: signWidth(config, mark.sign) * spacePx(config, pxPerSemi), size };
  } else {
    const shape = shapes[mark.shape];
    base = shape && shaped(shape.ledgers === false ? "symbol" : "head", mark.shape, mark, point, mark);
  }
  if (!base) return null;
  const added = (Array.isArray(mark.added) ? mark.added : []).map(a => a &&
    shaped("symbol", a.shape, a, place(point, a.offset), { hollow: false, color: mark.color }));
  return [base, ...added.filter(Boolean)];
}

/** How far a signature's marks reach left and right of their stacks' lines, in px. */
function reachOf(layouts) {
  let left = 0;
  let right = 0;
  for (const layout of layouts) {
    for (const s of layout || []) {
      left = Math.max(left, -(s.cx - s.width / 2));
      right = Math.max(right, s.cx + s.width / 2);
    }
  }
  return { left, right };
}

/** A head's ledgers at pitch semi: whether the notation draws any there. */
function ledgered(config, semi, axis) {
  return CNBLedgerSet.ledgersFor(config, [semi], { minSemi: semi - 12, maxSemi: semi + 12 }, axis).length > 0;
}

/** A mark's base for ledgers, or a stand-in for one whose shape is missing. */
const baseOf = (m, i) => (m.layouts[i] ? m.layouts[i][0] : { kind: "head", cx: 0, width: m.markWidth });

/**
 * The signature's ink in px from the stacks' start, as the engine draws it
 * (session 50): each mark's symbols, and each head's own ledgers, 4/3 of its
 * base's width and their round caps (keysig.ly cnb:add-keysig-ledgers),
 * centred on its base, so a narrow mark beside a wide one draws shorter
 * ledgers and a stack of narrow marks starts its ink later.
 */
function inkExtent(config, pxPerSemi, m, space) {
  const axis = CNBPitchAxis.create(config);
  let left = Infinity;
  let right = -Infinity;
  m.marks.forEach(({ semi, column }, i) => {
    const base = baseOf(m, i);
    const half = base.kind === "head" && ledgered(config, semi, axis)
      ? ledgerLength(base.width, space) / 2 : base.width / 2;
    const line = (column + 0.5) * m.markWidth + (m.lead - m.markWidth / 2);
    left = Math.min(left, line + base.cx - half);
    right = Math.max(right, line + base.cx + half);
    for (const s of (m.layouts[i] || []).slice(1)) {
      left = Math.min(left, line + s.cx - s.width / 2);
      right = Math.max(right, line + s.cx + s.width / 2);
    }
  });
  return Number.isFinite(left) ? { left, right } : { left: 0, right: m.columns * m.markWidth };
}

/** A look that sets nothing: every field unset (design §6). */
const lookUnset = look => Object.values(look || {}).every(v => v === undefined);

/** The looks a mark can take (session 54, design §13.4). */
const LOOK_NAMES = ["all", "natural", "flat", "sharp", "line", "space"];

/** Signature duration: the engine resolves keysig noteheads at quarter
 *  note (duration 3) — stencils.ly cnb:get-keysig-note-stencil. */
const SIGNATURE_DURATION = "crotchet";

/** Concrete notehead resolution — same concretion rule as
 *  CNBCard.resolveNotehead (the rules' colour, else black), pinned against
 *  it by a parity unit test. */
function resolveMark(config, pc, keyName) {
  const resolved = CNBConfig.resolveNotehead(config, pc, SIGNATURE_DURATION, keyName);
  return {
    ...resolved,
    color: resolved.color ?? "#000000",
  };
}

/** A look laid over a mark (session 48, design §4.1): each field the look
 *  sets replaces the mark's, offset and added whole (session 54, §13.4); a
 *  colour of null is none, black; shape and sign are one slot (§13.3). */
function overLook(mark, look) {
  const out = { ...mark };
  for (const [field, value] of Object.entries(look || {})) {
    if (value === undefined) continue;
    out[field] = field === "color" ? (value ?? "#000000") : value;
    if (field === "sign") delete out.shape;
    if (field === "shape") delete out.sign;
  }
  return out;
}

/**
 * A mark's look (design §13.4): the notehead's own at crotchet in the key,
 * then each layer over it. A sign takes its colour from the looks alone,
 * black unless one sets it, and nothing else of the notehead's: no
 * disambiguating x offset (§13.2); scale is the signs' (signScale).
 */
function markLook(config, pc, keyName, layers, scale) {
  let mark = resolveMark(config, pc, keyName);
  let lookColor;
  for (const look of layers) {
    mark = overLook(mark, look);
    if (look && look.color !== undefined) lookColor = look.color ?? "#000000";
  }
  if (mark.sign) {
    mark.color = lookColor ?? "#000000";
    mark.scale = scale();
    delete mark.xOffsetStaffSpaces;
  }
  return mark;
}

/**
 * Whether a mark at semi is on a line (design §13.4): a staff line's pitch,
 * or one of the notation's ledgers for a note there is its own; by axis
 * position, within 1e-6, under a pitch axis.
 */
function onLine(config, semi, axis) {
  const range = { minSemi: semi - 12, maxSemi: semi + 12 };
  const at = s => Math.abs(axis.positionOfSemi(s) - axis.positionOfSemi(semi)) < 1e-6;
  return CNBStaff.getPositions(config, range).some(at) ||
    CNBLedgerSet.ledgersFor(config, [semi], range, axis).some(at);
}

/** The key's tonic spelled (design §3): the definition's spelling, else its
 *  name's leading note, when either spells the tonic, else the default. */
function tonicName(def, tonic, pcs) {
  const named = /^\s*([A-Ga-g])([#♯b♭]?)/.exec(String(def.name ?? ""));
  const candidates = [def.spelling, named && named[1].toUpperCase() + named[2]];
  return candidates.find(name => typeof name === "string" &&
      CNBKeySignature.parseTonicPc(name) === tonic && CNBMusic.spell(name, pcs) !== null) ??
    CNBMusic.defaultSpelling(tonic, pcs);
}

/**
 * The staff's line sets (design §4.5): runs of the engraved staff's lines
 * one staff space apart, over staff.midpoint − 12 ≤ S < staff.midpoint + 12
 * (LY spec §5.1a), lowest first, each { low, high } in semitones.
 */
function lineSets(config) {
  const midpoint = (config.staff || {}).midpoint ?? 12;
  const lines = CNBStaff.getPositions(config, { minSemi: midpoint - 12, maxSemi: midpoint + 12 })
    .filter(s => s < midpoint + 12);
  const sets = [];
  for (const s of lines) {
    const last = sets[sets.length - 1];
    if (last && CNBStaff.lilypondPosition(config, s) - CNBStaff.lilypondPosition(config, last.high) <= 2 + 1e-9) {
      last.high = s;
    } else {
      sets.push({ low: s, high: s });
    }
  }
  return sets;
}

/**
 * Each copy of the signature (design §4.5): { tonic, middle }, the middle's
 * tonicSemi and staff.midpoint, or one copy on the bottom, the top or every
 * line set, each copy's octave the one whose middle is nearest its set's
 * middle (the higher on a tie), and its middle the set's. Copies sharing a
 * tonic are one unless byMiddle (the window's heights, which follow the
 * middle). chosen: the line sets, empty for the middle.
 */
function copiesOf(config, key, tonic, byMiddle) {
  const position = (((config.keys || {}).keySignature || {}).placement || {}).position ?? "middle";
  const sets = position === "middle" ? [] : lineSets(config);
  const chosen = position === "bottom-set" ? sets.slice(0, 1)
    : position === "top-set" ? sets.slice(-1)
    : position === "every-set" ? sets : [];
  if (chosen.length === 0) {
    return { chosen, copies: [{ tonic: CNBKeySignature.tonicSemi(config, key), middle: (config.staff || {}).midpoint ?? 12 }] };
  }
  const copies = [];
  for (const s of chosen) {
    const middle = (s.low + s.high) / 2;
    const copy = { tonic: CNBMusic.absoluteSemi(tonic, Math.round((middle - 6 - tonic) / 12)), middle };
    if (byMiddle || !copies.some(c => c.tonic === copy.tonic)) copies.push(copy);
  }
  return { chosen, copies };
}

/**
 * Each note's stack (design §4.4), for the scale's semitones from the tonic
 * (the upper tonic included), the tonic on tonicPc: before the direction is
 * applied, the tonic's stack first.
 */
function stacksOf(stacking, offsets, tonicPc) {
  const odd = offsets.map(o => (tonicPc + o) % 2 === 1);
  if (stacking === "parity") return odd.map(o => (o ? 0 : 1));
  if (stacking === "parity-stacks" || stacking === "parity-zigzag") {
    const stacks = [0];
    for (let i = 1; i < offsets.length; i++) {
      const change = odd[i] !== odd[i - 1];
      stacks.push(stacking === "parity-stacks" ? stacks[i - 1] + (change ? 1 : 0)
        : change ? 1 - stacks[i - 1] : stacks[i - 1]);
    }
    return stacks;
  }
  return offsets.map((_, i) => i % 2);   // "degrees": stacked sevenths
}

export const CNBKeySignature = {

  /**
   * Parse the tonic pitch class from a key name (s1 decision D3).
   * Reads a leading note letter A–G (either case) plus an optional
   * accidental (# ♯ b ♭) immediately after it, ignoring leading
   * whitespace: "C" → 0, "F# minor" → 6, "bb" → 10, "B♭ Dorian" → 10.
   * Returns null when the name does not begin with a note letter.
   * (Lives here rather than in Module B: cnb-music.js is outside this
   * session's product-file scope.)
   * @param {string} name
   * @returns {number|null}
   */
  parseTonicPc(name) {
    const m = /^\s*([A-Ga-g])([#♯b♭]?)/.exec(String(name ?? ""));
    if (!m) return null;
    const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
    const alt = m[2] === "#" || m[2] === "♯" ? 1 : (m[2] === "b" || m[2] === "♭" ? -1 : 0);
    return (((base + alt) % 12) + 12) % 12;
  },

  /**
   * True when the signature is the scale stack the engine's 'chord style
   * draws (LY spec 1.3.15 §5.6a, design §9): the settings that apply to it
   * at their defaults, notes "all", the upper tonic, stacking "degrees",
   * columns "right", the middle of the staff, and no look or alternate field
   * set. A setting that does not apply does not count: under "degrees" every
   * key has two stacks, so separator.shareThickness never applies. Any other
   * signature is drawn from the mark table, and spaced by its ink; so is
   * the sharps or flats only and the cycle of fifths (session 54), and any
   * look for naturals, a line or a space.
   *
   * @param {object} config
   * @returns {boolean}
   */
  isScaleStack(config) {
    const ks = (config.keys || {}).keySignature || {};
    return (ks.notes ?? "all") === "all" && ks.upperTonic !== false &&
      (ks.stacking ?? "degrees") === "degrees" && (ks.columns ?? "right") === "right" &&
      ((ks.placement || {}).position ?? "middle") === "middle" &&
      LOOK_NAMES.every(k => lookUnset((ks.looks || {})[k])) && lookUnset(ks.alternate);
  },

  /**
   * The size of a traditional signature's signs (session 52): the sharp's
   * height from the top left of its upper bar to the top left of its lower
   * bar, in semitones (axis units under a pitch axis). A number set in
   * keySignature.signs.heightSemis is kept as it is. Otherwise it is
   * automatic, the least of the noteheads' mean height (the twelve pitch
   * classes' crotchet noteheads as they resolve with no key), one staff
   * space and 3 semitones: 2.724 on the default staff, 3 on Kite 4-369, 1 on
   * a staff with a line every semitone.
   *
   * @param {object} config
   * @returns {{semis:number, automatic:boolean}}
   */
  signHeight(config) {
    const set = (((config.keys || {}).keySignature || {}).signs || {}).heightSemis;
    if (typeof set === "number" && Number.isFinite(set) && set > 0) return { semis: set, automatic: false };
    const shapes = config.shapes || {};
    const heights = [];
    for (let pc = 0; pc < 12; pc++) {
      const head = CNBConfig.resolveNotehead(config, pc, "crotchet", null);
      const shape = shapes[head.shape];
      if (shape) heights.push(head.heightSemis ?? shape.semitoneHeight);
    }
    const space = CNBStaff.staffSpacePx(config, { pxPerSemi: 1, axis: CNBPitchAxis.create(config) });
    const mean = heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : Infinity;
    return { semis: Math.min(mean, space, SIGN_HEIGHT_CAP), automatic: true };
  },

  /**
   * The factor a traditional signature's sharp and flat are drawn at, and
   * exported with (session 52): signHeight ÷ the sharp's bar spacing in the
   * optical size drawn (cnb-accidental-glyphs.js) ÷ the semitones (axis
   * units) per staff space. 0.6473 on the default staff.
   *
   * @param {object} config
   * @returns {number}
   */
  signScale(config) {
    const space = CNBStaff.staffSpacePx(config, { pxPerSemi: 1, axis: CNBPitchAxis.create(config) });
    return CNBKeySignature.signHeight(config).semis / signGlyph(config, "sharp").bars / space;
  },

  /**
   * Resolve the key definition the signature renders, or null when the
   * feature is disabled, no key is selected, or the name is unknown or has
   * no usable pitchClasses.
   *
   * @param {object} config
   * @param {string|null} keyName  Selected key (example data)
   * @returns {{name:string, def:object}|null}
   */
  activeKey(config, keyName) {
    const keys = config.keys || {};
    const ks = keys.keySignature || {};
    if (!keys.enabled || !ks.enabled || !keyName) return null;
    const def = (keys.definitions || []).find(d => d && d.name === keyName);
    if (!def || !Array.isArray(def.pitchClasses)) return null;
    if (!def.pitchClasses.some(pc => Number.isInteger(pc))) return null;
    return { name: keyName, def };
  },

  /**
   * Tonic pitch class for a key definition (s1 decision D3):
   * explicit def.tonicPc → parsed from the leading note letter of the
   * name → the first listed pitch class.
   *
   * @param {object} def  keys.definitions entry
   * @returns {number}
   */
  tonicPc(def) {
    if (Number.isInteger(def.tonicPc) && def.tonicPc >= 0 && def.tonicPc <= 11) {
      return def.tonicPc;
    }
    const parsed = CNBKeySignature.parseTonicPc(def.name);
    if (parsed !== null) return parsed;
    const first = (def.pitchClasses || []).find(pc => Number.isInteger(pc));
    return CNBMusic.pitchClass(first ?? 0);
  },

  /**
   * Absolute semitone of the rendered tonic (s1 decision D4).
   * An explicit integer keySignature.placement.tonicOctave places the
   * tonic in that octave; null/absent auto-centers the octave span on
   * staff.midpoint with ties resolving upward.
   *
   * @param {object} config
   * @param {object} def
   * @returns {number}
   */
  tonicSemi(config, def) {
    const pc = CNBKeySignature.tonicPc(def);
    const ks = (config.keys || {}).keySignature || {};
    const placement = ks.placement || {};
    if (Number.isInteger(placement.tonicOctave)) {
      return CNBMusic.absoluteSemi(pc, placement.tonicOctave);
    }
    const midpoint = (config.staff || {}).midpoint ?? 12;
    // Center [t, t+12] on the midpoint: minimize |t + 6 − midpoint| over
    // t = pc + 12k. Math.round rounds half-up, so ties choose the higher
    // octave (engine parity: C tonic, midpoint 12 → t = 12).
    const k = Math.round((midpoint - 6 - pc) / 12);
    return CNBMusic.absoluteSemi(pc, k);
  },

  /**
   * What the signature draws for a key (session 48, key-signature design
   * §4, §8; one model since session 54, §13): one pure answer the preview
   * draws and the export writes.
   *
   * The scale is the key's pitch classes from the tonic and the tonic an
   * octave up. Each note joins a stack (keySignature.stacking, assigned over
   * the whole scale, before notes are left out): "degrees" (even-numbered
   * notes left, odd right: two stacked sevenths), "parity" (odd semitones
   * left, even right), "parity-stacks" (a new stack to the right at each
   * change of the semitone's parity) or "parity-zigzag" (the other stack at
   * each change). With columns "left-in-sharp-keys" a key with sharps
   * mirrors its stacks (not under "parity"). Then the upper tonic is left
   * out unless upperTonic; with notes "tonic-and-half-steps" every note but
   * the tonic and both notes of each half step, and with "altered" every
   * note but the key's sharps or flats.
   *
   * "fifths" (§13.5) is the cycle of fifths, one mark to a column, left to
   * right, by letter: F C G D A E B in a sharp key, B E A D G C F otherwise
   * (a key the seven letters do not spell keeps its scale's order). It has
   * no gold stem, no direction and no upper tonic; every second stack is
   * every second column. Its heights are "scale", each mark at its note in
   * the scale from its copy's tonic, or "window", each at the octave of its
   * note in [middle − 6, middle + 6) raised by window.sharp in a sharp key
   * and window.flat in a flat key, middle the copy's line set's (the
   * staff's midpoint in the middle), so every copy has its own window.
   *
   * Each mark's look is the notehead the rules give its pitch at crotchet
   * in this key, then looks.all, then looks.natural, .flat or .sharp by the
   * key's spelling (the definition's spelling, else its name's, else
   * CNBMusic.defaultSpelling), then looks.line or .space by the mark's pitch
   * (onLine), then alternate on every second stack from the tonic's. A look's
   * sign makes the mark Emmentaler's sharp or flat, black unless a look
   * colours it, at signScale. The place (placement.position) is the middle of
   * the staff (tonicSemi, an explicit tonicOctave included) or one copy on
   * the bottom, the top or every line set, each copy's octave the one whose
   * middle is nearest its set's middle (the higher on a tie); two marks at
   * one semitone in one stack are one.
   *
   * Each mark gains symbols (§13.10): its base and added symbols in order,
   * { kind: "head" | "sign" | "symbol", shape | sign, hollow, color,
   * heightSemis, widthSemis, scale, reference, x, y }, x and y where the
   * symbol's origin goes from its stack's line and the mark's pitch, in
   * staff spaces, y up (symbolsOf); reference false for a box centred there.
   *
   * columns: each stack's line, in staff spaces, the farthest any mark
   * reaches right of its line plus the farthest any reaches left apart
   * (§13.6; the widest mark's width for marks centred on their lines). bars:
   * the gold stems, one between each pair of neighbouring stacks (column:
   * the stack before it), over the staff's middle ± separator.extentSemis
   * (middle: true, a length under a pitch axis) or a line-set copy's marks,
   * thicknessPct in staff spaces, shared among a copy's stems when
   * separator.shareThickness. overlaps: neighbouring marks in one stack
   * nearer on the grid than half their heights' sum.
   *
   * Null for an unknown placement rule, or a key with no pitch classes.
   *
   * @param {object} config
   * @param {{name:string, pitchClasses:number[], tonicPc?:number, spelling?:string}} key
   *        a key definition
   * @returns {{marks:{semi:number, column:number, mark:object, symbols:object[]}[], columns:number[],
   *            bars:{x:number, column:number, top:number, bottom:number, color:string,
   *                  thickness:number, middle:boolean}[],
   *            overlaps:{column:number, semis:number[]}[]}|null}
   */
  marks(config, key) {
    const ks = (config.keys || {}).keySignature || {};
    const placement = ks.placement || {};
    if ((placement.rule ?? "scale-from-tonic") !== "scale-from-tonic") return null;
    const pcs = [...new Set((key.pitchClasses || []).filter(pc => Number.isInteger(pc)))];
    if (pcs.length === 0) return null;

    const tonic = CNBKeySignature.tonicPc(key);
    const offsets = pcs.map(pc => CNBMusic.pitchClass(pc - tonic)).sort((a, b) => a - b);
    offsets.push(12);
    const spelling = tonicName(key, tonic, pcs);
    const spelled = CNBMusic.spell(spelling, pcs);
    const alteration = pc => (spelled ? spelled.find(n => n.pc === pc).alteration : 0);
    const sharpKey = !!spelled && spelled.some(note => note.alteration === 1);
    const flatKey = !!spelled && spelled.some(note => note.alteration === -1);

    // Stacks, then the notes drawn, then the direction.
    const stacking = ks.stacking ?? "degrees";
    const fifths = stacking === "fifths";
    const last = offsets.length - 1;
    const halfStep = i => offsets[i + 1] - offsets[i] === 1 || offsets[i] - offsets[i - 1] === 1;
    const drawn = offsets.map((o, i) => (i < last || (ks.upperTonic !== false && !fifths)) &&
      (ks.notes === "tonic-and-half-steps" ? o === 0 || halfStep(i)
        : ks.notes === "altered" ? alteration(CNBMusic.pitchClass(tonic + o)) !== 0 : true));
    // The order the marks are listed in, and each one's stack.
    let order = offsets.map((_, i) => i).filter(i => drawn[i]);
    let stacks;
    if (fifths) {
      const letter = "CDEFGAB".indexOf(spelling[0]);
      const letters = spelled ? new Map(spelled.map((note, i) => [note.pc, "CDEFGAB"[(letter + i) % 7]])) : null;
      const cycle = sharpKey ? SHARP_ORDER : [...SHARP_ORDER].reverse().join("");
      const rank = i => (letters ? cycle.indexOf(letters.get(CNBMusic.pitchClass(tonic + offsets[i]))) : i);
      order = order.sort((a, b) => rank(a) - rank(b));
      stacks = [];
      order.forEach((i, column) => { stacks[i] = column; });
    } else {
      stacks = stacksOf(stacking, offsets, tonic);
    }
    const n = order.length === 0 ? 0 : 1 + Math.max(...order.map(i => stacks[i]));
    const mirror = !fifths && ks.columns === "left-in-sharp-keys" && stacking !== "parity" && sharpKey;
    const columnOf = i => (mirror ? n - 1 - stacks[i] : stacks[i]);
    const alternates = i => (fifths ? stacks[i] % 2 === 1 : (stacks[i] - stacks[0]) % 2 !== 0);

    const windowed = fifths && ks.heights !== "scale";
    const { chosen, copies: places } = copiesOf(config, key, tonic, windowed);
    const raise = (sharpKey ? ks.window?.sharp : flatKey ? ks.window?.flat : 0) ?? 0;
    const semiOf = (place, o) => {
      if (!windowed) return place.tonic + o;
      const low = Math.ceil(place.middle - 6 + raise);
      return low + CNBMusic.pitchClass(tonic + o - low);
    };

    const looks = ks.looks || {};
    const byLine = !lookUnset(looks.line) || !lookUnset(looks.space);
    const axis = CNBPitchAxis.create(config);
    let scale;
    const signScale = () => (scale ??= CNBKeySignature.signScale(config));
    const copies = places.map(place => order.map(i => {
      const semi = semiOf(place, offsets[i]);
      const pc = CNBMusic.pitchClass(semi);
      const alt = alteration(pc);
      const mark = markLook(config, pc, key.name, [
        looks.all,
        alt === 1 ? looks.sharp : alt === -1 ? looks.flat : looks.natural,
        byLine ? (onLine(config, semi, axis) ? looks.line : looks.space) : undefined,
        alternates(i) ? ks.alternate : undefined,
      ], signScale);
      return { semi, column: columnOf(i), mark };
    }));
    const seen = new Set();
    const marks = copies.flat().filter(m => {
      const id = `${m.semi} ${m.column}`;
      return seen.has(id) ? false : (seen.add(id), true);
    });

    // Columns and the gold stems, in staff spaces.
    const shapes = config.shapes || {};
    const space = CNBStaff.staffSpacePx(config, { pxPerSemi: 1, axis });
    const layouts = marks.map(({ mark }) => symbolsOf(config, mark, 1));
    const reach = reachOf(layouts);
    const width = (reach.left + reach.right) / space;
    const lead = reach.left / space - width / 2;
    const columns = Array.from({ length: n }, (_, c) => (c + 0.5) * width + lead);
    marks.forEach((m, i) => {
      m.symbols = (layouts[i] || []).map(({ kind, shape, sign, hollow, color, heightSemis, widthSemis, scale: s, reference, x, y }) =>
        ({ kind, ...(sign ? { sign, scale: s } : { shape, hollow, heightSemis, widthSemis }), color, reference,
          x: x / space, y: -y / space }));
    });
    const sep = ks.separator || {};
    const pct = (sep.thicknessPct ?? 160) / (sep.shareThickness !== false ? Math.max(1, n - 1) : 1);
    const bars = [];
    if (!fifths && sep.enabled !== false && pct > 0) {
      const midpoint = (config.staff || {}).midpoint ?? 12;
      const extent = sep.extentSemis ?? 12;
      const spans = chosen.length === 0
        ? [{ top: midpoint + extent, bottom: midpoint - extent, middle: true }]
        : copies.map(c => ({ top: Math.max(...c.map(m => m.semi)), bottom: Math.min(...c.map(m => m.semi)), middle: false }));
      for (const span of spans) {
        for (let c = 0; c < n - 1; c++) {
          bars.push({ x: (c + 1) * width, column: c, ...span,
            color: sep.color ?? "#ffd42a", thickness: pct / 100 / space });
        }
      }
    }

    const height = ({ mark }) => mark.heightSemis ?? shapes[mark.shape]?.semitoneHeight ?? 0;
    const overlaps = [];
    for (let c = 0; c < n; c++) {
      const stack = marks.filter(m => m.column === c).sort((a, b) => a.semi - b.semi);
      for (let j = 1; j < stack.length; j++) {
        if (axis.distance(stack[j - 1].semi, stack[j].semi) < (height(stack[j - 1]) + height(stack[j])) / 2) {
          overlaps.push({ column: c, semis: [stack[j - 1].semi, stack[j].semi] });
        }
      }
    }
    return { marks, columns, bars, overlaps };
  },

  /**
   * The signature's absolute semitones, ascending: those of marks() for
   * the key keyName names. Null when no key resolves, or the placement rule
   * is unknown.
   *
   * @param {object} config
   * @param {string|null} keyName
   * @returns {number[]|null}
   */
  signatureSemis(config, keyName) {
    const active = CNBKeySignature.activeKey(config, keyName);
    const sig = active && CNBKeySignature.marks(config, active.def);
    return sig ? [...new Set(sig.marks.map(m => m.semi))].sort((a, b) => a - b) : null;
  },

  /**
   * Geometry shared by gutterWidth() and render(), so the reserved gutter
   * always matches what is drawn. Null when nothing would render (feature
   * gated off, no notes, or — for notehead-chords — no resolvable shape).
   *
   * marks() in px, for the key keyName names.
   *
   * markWidth: the step between columns in px — the farthest any mark
   *            reaches right of its stack's line plus the farthest any reaches
   *            left (session 54, design §13.6): the widest drawn mark (at its
   *            resolved size, session 22) when every mark is centred.
   * lead:      the first stack's line from the stacks' start, in px: the
   *            farthest reach left (half markWidth when every mark is centred).
   * columns:   the number of stacks (2 under the default stacked sevenths).
   * separatorPx: one gold stem's thickness in px (0 when disabled), the
   *            thickness shared among a copy's stems when shareThickness.
   * contentWidth: columns × markWidth — the stems run between the columns,
   *            so they add no width of their own.
   * marks, bars: marks()'s; layouts: each mark's symbols in px (symbolsOf),
   *            null for a mark whose shape is not defined.
   *
   * Null when no key resolves, the placement rule is unknown (validation
   * reports it) or no referenced shape resolves.
   *
   * @param {object} config
   * @param {number} pxPerSemi
   * @param {string|null} keyName
   * @returns {{markWidth:number, lead:number, columns:number,
   *            separatorPx:number, contentWidth:number, semis:number[],
   *            marks:object[], layouts:object[], bars:object[]}|null}
   */
  measure(config, pxPerSemi, keyName) {
    const active = CNBKeySignature.activeKey(config, keyName);
    const sig = active && CNBKeySignature.marks(config, active.def);
    if (!sig) return null;

    const ks = (config.keys || {}).keySignature || {};
    const columns = sig.columns.length;

    const layouts = sig.marks.map(({ mark }) => symbolsOf(config, mark, pxPerSemi));
    const reach = reachOf(layouts);
    const markWidth = reach.left + reach.right;
    if (!(markWidth > 0)) return null;

    const sep = ks.separator || {};
    const separatorPx = sep.enabled === false
      ? 0
      : CNBConfig.pctToPx((sep.thicknessPct ?? 160) /
          (sep.shareThickness !== false ? Math.max(1, columns - 1) : 1), pxPerSemi);

    const result = {
      markWidth,
      lead: reach.left,
      columns,
      separatorPx,
      contentWidth: columns * markWidth,
      semis: sig.marks.map(m => m.semi),
      marks: sig.marks,
      layouts,
      bars: sig.bars,
    };

    // Pitch axis (set 014): each mark carries its resolved
    // xOffsetStaffSpaces (the notehead pipeline's disambiguation, axis-gated
    // like the card's), and the content widens so offset marks don't clip.
    const axis = CNBPitchAxis.create(config);
    if (!axis.enabled) return result;
    const offsets = sig.marks.map(({ mark }) =>
      (mark.xOffsetStaffSpaces || 0) * axis.unitsPerStaffSpace * pxPerSemi);
    result.offsets = offsets;
    result.extraLeftPx = Math.max(0, ...offsets.map(o => -o));
    result.contentWidth += result.extraLeftPx + Math.max(0, ...offsets);
    return result;
  },

  /**
   * The gutter's padding left and right of the marks, in px, giving the
   * engine's spacing (session 34): the ink starts 0.75 staff spaces after
   * the staff's start, or, with a clef shown, the marks 3.5 after the clef
   * glyph's left edge (2.9286 for a mark-table signature; the clef column
   * pads the glyph on both sides); the first card's notehead is centred
   * 4.8636 after the ink. The ink is the marks and the ledgers of the first
   * and last stacks (session 50). These are at the default magnification;
   * at another, both follow the engine (session 52): the clef's offset is
   * 1/m staff spaces and the time signature's width its optical size's.
   * Null when nothing renders.
   *
   * @param {object} config
   * @param {number} pxPerSemi
   * @param {string|null} keyName
   * @param {number} [firstHeadCenter]  the first card's CNBCard.headCenterX;
   *        absent, a column for a notehead the size of the marks stands for it
   * @returns {{left:number, right:number}|null} px
   */
  padding(config, pxPerSemi, keyName, firstHeadCenter) {
    const m = CNBKeySignature.measure(config, pxPerSemi, keyName);
    return m ? gutterPadding(config, pxPerSemi, m, firstHeadCenter) : null;
  },

  /**
   * Total width of the key-signature gutter in px: content width plus the
   * padding that gives the engine's spacing either side (padding()). 0 when
   * nothing renders — the collection reserves no gutter (default-off
   * compatibility).
   *
   * @param {object} config
   * @param {number} pxPerSemi
   * @param {string|null} keyName
   * @param {number} [firstHeadCenter]  as for padding()
   * @returns {number}
   */
  gutterWidth(config, pxPerSemi, keyName, firstHeadCenter) {
    const m = CNBKeySignature.measure(config, pxPerSemi, keyName);
    if (!m) return 0;
    const { left, right } = gutterPadding(config, pxPerSemi, m, firstHeadCenter);
    return left + m.contentWidth + right;
  },

  /**
   * Render the selected key's signature into svgParent. Returns null
   * (rendering nothing) when nothing is active — same geometry gate as
   * gutterWidth().
   *
   * @param {SVGElement} svgParent
   * @param {object} gridContext   From CNBGrid.create()
   * @param {object} config
   * @param {string|null} keyName  Selected key (example data)
   * @returns {SVGGElement|null}
   */
  render(svgParent, gridContext, config, keyName) {
    const m = CNBKeySignature.measure(config, gridContext.pxPerSemi, keyName);
    if (!m) return null;

    const ks = (config.keys || {}).keySignature || {};
    // Pitch axis (set 014): offset marks shift the columns right by the
    // largest leftward offset; on a linear grid m.offsets is absent and
    // the left padding is used unchanged.
    const { left } = gutterPadding(config, gridContext.pxPerSemi, m);
    const paddingH = m.offsets ? left + m.extraLeftPx : left;

    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-key-signature");

    // The gold stems first — the engine's stem is stencil-added UNDER the
    // ledger lines and noteheads (keysig.ly bottom layer), each between two
    // neighbouring stacks.
    if (m.separatorPx > 0) {
      for (const bar of m.bars) {
        const x = paddingH + (bar.column + 1) * m.markWidth;
        const line = document.createElementNS(NS, "line");
        line.setAttribute("class", "cnb-key-signature-separator");
        line.setAttribute("x1", String(x));
        line.setAttribute("x2", String(x));
        if (bar.middle && gridContext.axis && gridContext.axis.enabled) {
          // extentSemis is a LENGTH (design §1.2/§2.3): px, not axis positions.
          const extent = ks.separator?.extentSemis ?? 12;
          const midY = gridContext.semiToY((config.staff || {}).midpoint ?? 12);
          line.setAttribute("y1", String(midY - extent * gridContext.pxPerSemi));
          line.setAttribute("y2", String(midY + extent * gridContext.pxPerSemi));
        } else {
          line.setAttribute("y1", String(gridContext.semiToY(bar.top)));
          line.setAttribute("y2", String(gridContext.semiToY(bar.bottom)));
        }
        line.setAttribute("stroke", bar.color);
        line.setAttribute("stroke-width", String(m.separatorPx));
        // The engine's bar is a line with round caps, half its thickness
        // beyond each end (session 49).
        line.setAttribute("stroke-linecap", "round");
        g.appendChild(line);
      }
    }

    // Each stack's line: the stems stand at the boundaries between stacks.
    const leftX = paddingH + m.lead;
    const columnX = c => leftX + c * m.markWidth;

    // Ledger layer first, the marks on top (keysig.ly's two-pass layering):
    // every ledger is drawn before any mark. Ledger length = 4/3 × the
    // head's base's width, the engine's keysig ledger proportion, and its
    // round caps (session 49), centred on the base, so it moves with the
    // base's offset (session 54); marks of one width in a stack share their
    // ledgers, and a narrower mark draws its own shorter ones, as the engine
    // does (session 50).
    const space = CNBStaff.staffSpacePx(config, gridContext);
    const groups = new Map();   // "x width" → { x, width, semis }
    const axis = CNBPitchAxis.create(config);
    const join = ({ semi }, i, x) => {
      const base = baseOf(m, i);
      // Signs, and symbols whose shape takes no ledgers, have none.
      if (base.kind !== "head") return;
      // A mark with no ledgers of its own joins the stack's usual group.
      const width = ledgered(config, semi, axis) ? base.width : m.markWidth;
      const at = x + base.cx;
      const id = `${at} ${width}`;
      if (!groups.has(id)) groups.set(id, { x: at, width, semis: [] });
      groups.get(id).semis.push(semi);
    };
    if (m.offsets) {
      // Axis path: ledgers follow their marks' offsets.
      m.marks.forEach((mk, i) => join(mk, i, columnX(mk.column) + m.offsets[i]));
    } else {
      for (let c = 0; c < m.columns; c++) {
        const stack = m.marks.map((mk, i) => [mk, i]).filter(([mk]) => mk.column === c);
        if (stack.length === 0) groups.set(`empty ${c}`, { x: columnX(c), width: m.markWidth, semis: [] });
        for (const [mk, i] of stack) join(mk, i, columnX(c));
      }
    }
    for (const { x, width, semis } of groups.values()) {
      CNBLedgerSet.render(g, gridContext, config, semis, { width: ledgerLength(width, space), centerX: x });
    }

    // Each mark's symbols, the base then the added ones.
    m.marks.forEach(({ semi, column }, i) => {
      const lineX = m.offsets ? columnX(column) + m.offsets[i] : columnX(column);
      const y = gridContext.semiToY(semi);
      for (const sym of m.layouts[i] || []) {
        if (sym.kind === "sign") {
          // A sign at its size (session 52), scaled about its origin, its
          // box centred on its point and its origin at its point's height
          // (engine handoffs 030 §1, 035 §1a), black unless a look colours it.
          const sign = signGlyph(config, sym.sign);
          const size = space * sym.scale;
          const scale = size / CNBAccidentalGlyphs.UNITS_PER_STAFF_SPACE;
          const path = document.createElementNS(NS, "path");
          path.setAttribute("class", "cnb-key-signature-sign");
          path.setAttribute("d", sign.path);
          path.setAttribute("fill", sym.color);
          path.setAttribute("transform", `translate(${lineX + sym.cx - (sign.x[0] + sign.x[1]) / 2 * size} ` +
            `${y + sym.y}) scale(${scale})`);
          g.appendChild(path);
          continue;
        }
        CNBNotehead.render(g, {
          shape: (config.shapes || {})[sym.shape],
          x: lineX + sym.x,
          y: y + sym.y,
          scaleFactor: sym.scaleFactor,
          scaleX: sym.scaleX,
          scaleY: sym.scaleY,
          hollow: sym.hollow,
          color: sym.color,
        });
      }
    });

    svgParent.appendChild(g);
    return g;
  },

};
