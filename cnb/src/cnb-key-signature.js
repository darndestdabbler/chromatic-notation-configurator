/**
 * cnb-key-signature.js — Key-signature renderer (set 010)
 *
 * Renders the selected key's signature into a gutter column at the start of
 * the staff, positioned on the semitone grid. Pure config-in/DOM-out: no
 * state, no event listeners. Composes with the set-009 clef gutter (clef
 * first, then key signature, left to right).
 *
 * One mark style is implemented, "notehead-chords" (mirroring the engine's
 * keysig.ly — the glyph-from-the-shape-pipeline arm of binding rule 2). The
 * task owner evaluated simple built-in marks (dot, interval blocks,
 * staggered ledgers) across set-010 s2 UAT and chose the note stack as the
 * sole style, deferring richer custom-symbol signatures to a future set
 * (s2-uat.md, s2-design-consult.md). `style` is a single-value vocabulary;
 * an unknown style renders nothing (validation reports it), keeping the
 * field the extension point for those future styles.
 *
 *   "notehead-chords": the key's scale as REAL noteheads — every pitch
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
 * Session 51 (design §5): the style "accidentals" is the traditional
 * signature, a sharp for each sharp of the key in the order F C G D A E B or
 * a flat for each flat in the order B E A D G C F, each in its own column,
 * at the semitone of the note it makes, in the octave the place gives that
 * note in the scale; on every line set each copy's columns start again.
 * The signs are Emmentaler's (cnb-accidental-glyphs.js), in the optical
 * size LilyPond uses at the config's magnification, black, with no ledgers
 * and no gold stems; the scale-note settings do not apply, and the place
 * does. Since session 52 the signs are sized in semitones, as the noteheads
 * are (signHeight, signScale): the sharp and the flat are scaled about their
 * origins by one factor, and the columns are the scaled signs' widths apart.
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

/** A mark's drawn width in px: a sign's, its shape's at its size, or the widest's. */
function markWidthOf(config, pxPerSemi, m, mark) {
  if (mark.sign) return signWidth(config, mark.sign) * spacePx(config, pxPerSemi);
  const shape = (config.shapes || {})[mark.shape];
  return shape ? CNBNotehead.measure(shape, pxPerSemi, mark).pixelWidth : m.markWidth;
}

/**
 * The signature's ink in px from the stacks' start, as the engine draws it
 * (session 50): each head's box centred on its stack, and each head's own
 * ledgers, 4/3 of its own width and their round caps (keysig.ly
 * cnb:add-keysig-ledgers), so a narrow mark beside a wide one draws shorter
 * ledgers and a stack of narrow marks starts its ink later.
 */
function inkExtent(config, pxPerSemi, m, space) {
  const axis = CNBPitchAxis.create(config);
  let left = Infinity;
  let right = -Infinity;
  for (const { semi, column, mark } of m.marks) {
    const w = markWidthOf(config, pxPerSemi, m, mark);
    const ledgered = !mark.sign &&
      CNBLedgerSet.ledgersFor(config, [semi], { minSemi: semi - 12, maxSemi: semi + 12 }, axis).length > 0;
    const half = ledgered ? ledgerLength(w, space) / 2 : w / 2;
    const x = (column + 0.5) * m.markWidth;
    left = Math.min(left, x - half);
    right = Math.max(right, x + half);
  }
  return Number.isFinite(left) ? { left, right } : { left: 0, right: m.columns * m.markWidth };
}

/** A look that sets nothing: every field unset (design §6). */
const lookUnset = look => Object.values(look || {}).every(v => v === undefined);

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
 *  sets replaces the mark's; a colour of null is none, black. */
function overLook(mark, look) {
  const out = { ...mark };
  for (const [field, value] of Object.entries(look || {})) {
    if (value !== undefined) out[field] = field === "color" ? (value ?? "#000000") : value;
  }
  return out;
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
 * The tonic semitone of each copy of the signature (design §4.5): the
 * middle's tonicSemi, or one copy on the bottom, the top or every line set,
 * each copy's octave the one whose middle is nearest its set's middle (the
 * higher on a tie). chosen: the line sets, empty for the middle.
 */
function copyTonics(config, key, tonic) {
  const position = (((config.keys || {}).keySignature || {}).placement || {}).position ?? "middle";
  const sets = position === "middle" ? [] : lineSets(config);
  const chosen = position === "bottom-set" ? sets.slice(0, 1)
    : position === "top-set" ? sets.slice(-1)
    : position === "every-set" ? sets : [];
  const tonics = chosen.length === 0 ? [CNBKeySignature.tonicSemi(config, key)]
    : [...new Set(chosen.map(s =>
        CNBMusic.absoluteSemi(tonic, Math.round(((s.low + s.high) / 2 - 6 - tonic) / 12))))];
  return { chosen, tonics };
}

/**
 * CNBKeySignature.marks under the style "accidentals" (session 51, design
 * §5): the key spelled, its sharps in the order F C G D A E B or its flats
 * in the order B E A D G C F, each sign at the semitone of the note it makes
 * in the scale from each copy's tonic, in its own column from 0, every
 * copy's columns starting again at 0, each at the signs' scale (session 52).
 * No bars, no overlaps; the columns' centres the scaled sign's width apart,
 * in staff spaces. A key with neither, or
 * none the seven letters spell, draws nothing.
 */
function accidentalMarks(config, key, pcs) {
  const tonic = CNBKeySignature.tonicPc(key);
  const name = tonicName(key, tonic, pcs);
  const spelled = CNBMusic.spell(name, pcs);
  const letter = "CDEFGAB".indexOf(name[0]);
  const altered = (spelled || []).map((note, i) => ({ ...note, letter: "CDEFGAB"[(letter + i) % 7] }))
    .filter(note => note.alteration !== 0);
  const sign = altered.some(note => note.alteration === 1) ? "sharp" : "flat";
  const order = sign === "sharp" ? SHARP_ORDER : [...SHARP_ORDER].reverse().join("");
  altered.sort((a, b) => order.indexOf(a.letter) - order.indexOf(b.letter));

  const { tonics } = copyTonics(config, key, tonic);
  const scale = CNBKeySignature.signScale(config);
  const marks = tonics.flatMap(t => altered.map((note, column) =>
    ({ semi: t + CNBMusic.pitchClass(note.pc - tonic), column, mark: { sign, scale } })));
  const width = signWidth(config, sign);
  const columns = altered.map((_, c) => (c + 0.5) * width);
  return { marks, columns, bars: [], overlaps: [] };
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
   * every "accidentals" signature (session 51).
   *
   * @param {object} config
   * @returns {boolean}
   */
  isScaleStack(config) {
    const ks = (config.keys || {}).keySignature || {};
    return ks.style !== "accidentals" && (ks.notes ?? "all") === "all" && ks.upperTonic !== false &&
      (ks.stacking ?? "degrees") === "degrees" && (ks.columns ?? "right") === "right" &&
      ((ks.placement || {}).position ?? "middle") === "middle" &&
      ["all", "flat", "sharp"].every(k => lookUnset((ks.looks || {})[k])) && lookUnset(ks.alternate);
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
   * §4, §8): one pure answer the preview draws and the export will write.
   *
   * The scale is the key's pitch classes from the tonic and the tonic an
   * octave up. Each note joins a stack (keySignature.stacking, assigned over
   * the whole scale, before notes are left out): "degrees" (even-numbered
   * notes left, odd right: two stacked sevenths), "parity" (odd semitones
   * left, even right), "parity-stacks" (a new stack to the right at each
   * change of the semitone's parity) or "parity-zigzag" (the other stack at
   * each change). With columns "left-in-sharp-keys" a key with sharps
   * mirrors its stacks (not under "parity"). Then the upper tonic is left
   * out unless upperTonic, and with notes "tonic-and-half-steps" every note
   * but the tonic and both notes of each half step.
   *
   * Each mark's look is the notehead the rules give its pitch at crotchet
   * in this key, then looks.all, then looks.flat or looks.sharp by the
   * key's spelling (the definition's spelling, else its name's, else
   * CNBMusic.defaultSpelling), then alternate on every second stack from the
   * tonic's. The place (placement.position) is the middle of the staff
   * (tonicSemi, an explicit tonicOctave included) or one copy on the bottom,
   * the top or every line set, each copy's octave the one whose middle is
   * nearest its set's middle (the higher on a tie); two marks at one
   * semitone in one stack are one.
   *
   * columns: each stack's centre, in staff spaces, the widest mark's width
   * apart. bars: the gold stems, one between each pair of neighbouring
   * stacks (column: the stack before it), over the staff's middle ±
   * separator.extentSemis (middle: true, a length under a pitch axis) or a
   * line-set copy's marks, thicknessPct in staff spaces, shared among a
   * copy's stems when separator.shareThickness. overlaps: neighbouring marks
   * in one stack nearer on the grid than half their heights' sum.
   *
   * Under the style "accidentals" (session 51, design §5) each mark is
   * { sign: "sharp" | "flat", scale } (scale: signScale, session 52), the
   * columns the scaled sign's width apart: the key's sharps in the order F C G D A E B
   * or its flats in the order B E A D G C F, each at the semitone of the
   * note it makes, in its own column, every copy's columns from 0; no bars
   * or overlaps, and nothing for a key with neither.
   *
   * Null for an unknown style or placement rule, or a key with no pitch
   * classes.
   *
   * @param {object} config
   * @param {{name:string, pitchClasses:number[], tonicPc?:number, spelling?:string}} key
   *        a key definition
   * @returns {{marks:{semi:number, column:number, mark:object}[], columns:number[],
   *            bars:{x:number, column:number, top:number, bottom:number, color:string,
   *                  thickness:number, middle:boolean}[],
   *            overlaps:{column:number, semis:number[]}[]}|null}
   */
  marks(config, key) {
    const ks = (config.keys || {}).keySignature || {};
    const placement = ks.placement || {};
    const style = ks.style ?? "notehead-chords";
    if (style !== "notehead-chords" && style !== "accidentals") return null;
    if ((placement.rule ?? "scale-from-tonic") !== "scale-from-tonic") return null;
    const pcs = [...new Set((key.pitchClasses || []).filter(pc => Number.isInteger(pc)))];
    if (pcs.length === 0) return null;
    if (style === "accidentals") return accidentalMarks(config, key, pcs);

    const tonic = CNBKeySignature.tonicPc(key);
    const offsets = pcs.map(pc => CNBMusic.pitchClass(pc - tonic)).sort((a, b) => a - b);
    offsets.push(12);
    const spelled = CNBMusic.spell(tonicName(key, tonic, pcs), pcs);
    const alteration = pc => (spelled ? spelled.find(n => n.pc === pc).alteration : 0);

    // Stacks, then the notes drawn, then the direction.
    const stacking = ks.stacking ?? "degrees";
    const stacks = stacksOf(stacking, offsets, tonic);
    const last = offsets.length - 1;
    const halfStep = i => offsets[i + 1] - offsets[i] === 1 || offsets[i] - offsets[i - 1] === 1;
    const drawn = offsets.map((o, i) => (i < last || ks.upperTonic !== false) &&
      (ks.notes !== "tonic-and-half-steps" || o === 0 || halfStep(i)));
    const n = 1 + Math.max(...stacks.filter((_, i) => drawn[i]));
    const mirror = ks.columns === "left-in-sharp-keys" && stacking !== "parity" &&
      !!spelled && spelled.some(note => note.alteration === 1);
    const columnOf = i => (mirror ? n - 1 - stacks[i] : stacks[i]);

    const { chosen, tonics } = copyTonics(config, key, tonic);

    const looks = ks.looks || {};
    const copies = tonics.map(t => {
      const marks = [];
      offsets.forEach((o, i) => {
        if (!drawn[i]) return;
        const semi = t + o;
        const pc = CNBMusic.pitchClass(semi);
        let mark = overLook(resolveMark(config, pc, key.name), looks.all);
        if (alteration(pc) !== 0) mark = overLook(mark, alteration(pc) === 1 ? looks.sharp : looks.flat);
        if ((stacks[i] - stacks[0]) % 2 !== 0) mark = overLook(mark, ks.alternate);
        marks.push({ semi, column: columnOf(i), mark });
      });
      return marks;
    });
    const seen = new Set();
    const marks = copies.flat().filter(m => {
      const id = `${m.semi} ${m.column}`;
      return seen.has(id) ? false : (seen.add(id), true);
    });

    // Columns and the gold stems, in staff spaces.
    const shapes = config.shapes || {};
    const axis = CNBPitchAxis.create(config);
    const space = CNBStaff.staffSpacePx(config, { pxPerSemi: 1, axis });
    const width = Math.max(0, ...marks.map(({ mark }) =>
      shapes[mark.shape] ? CNBNotehead.measure(shapes[mark.shape], 1, mark).pixelWidth : 0)) / space;
    const columns = Array.from({ length: n }, (_, c) => (c + 0.5) * width);
    const sep = ks.separator || {};
    const pct = (sep.thicknessPct ?? 160) / (sep.shareThickness !== false ? Math.max(1, n - 1) : 1);
    const bars = [];
    if (sep.enabled !== false && pct > 0) {
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
   * the key keyName names. Null when no key resolves, or the style or the
   * placement rule is unknown.
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
   * markWidth: the per-mark horizontal extent of ONE column in px — the
   *            widest drawn mark (at its resolved size, session 22).
   * columns:   the number of stacks (2 under the default stacked sevenths).
   * separatorPx: one gold stem's thickness in px (0 when disabled), the
   *            thickness shared among a copy's stems when shareThickness.
   * contentWidth: columns × markWidth — the stems run between the columns,
   *            so they add no width of their own.
   * marks, bars: marks()'s.
   *
   * Null when no key resolves, the style or placement rule is unknown
   * (validation reports it) or no referenced shape resolves.
   *
   * @param {object} config
   * @param {number} pxPerSemi
   * @param {string|null} keyName
   * @returns {{style:string, markWidth:number, columns:number,
   *            separatorPx:number, contentWidth:number, semis:number[],
   *            marks:object[], bars:object[]}|null}
   */
  measure(config, pxPerSemi, keyName) {
    const active = CNBKeySignature.activeKey(config, keyName);
    const sig = active && CNBKeySignature.marks(config, active.def);
    if (!sig) return null;

    const ks = (config.keys || {}).keySignature || {};
    const shapes = config.shapes || {};
    const columns = sig.columns.length;

    let markWidth = 0;
    for (const { mark } of sig.marks) {
      const shape = shapes[mark.shape];
      if (!shape && !mark.sign) continue;
      const pixelWidth = mark.sign ? signWidth(config, mark.sign) * spacePx(config, pxPerSemi)
        : CNBNotehead.measure(shape, pxPerSemi, mark).pixelWidth;
      if (pixelWidth > markWidth) markWidth = pixelWidth;
    }
    if (!(markWidth > 0)) return null;

    const sep = ks.separator || {};
    const separatorPx = sep.enabled === false
      ? 0
      : CNBConfig.pctToPx((sep.thicknessPct ?? 160) /
          (sep.shareThickness !== false ? Math.max(1, columns - 1) : 1), pxPerSemi);

    const result = {
      style: ks.style ?? "notehead-chords",
      markWidth,
      columns,
      separatorPx,
      contentWidth: columns * markWidth,
      semis: sig.marks.map(m => m.semi),
      marks: sig.marks,
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
    const shapes = config.shapes || {};

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

    // Each stack's centre: the stems stand at the boundaries between them.
    const leftX = paddingH + m.markWidth / 2;
    const columnX = c => leftX + c * m.markWidth;

    // Ledger layer first, noteheads on top (keysig.ly's two-pass
    // layering). Ledger length = 4/3 × the head's own width, the engine's
    // keysig ledger proportion, and its round caps (session 49); marks of
    // one width in a stack share their ledgers, and a narrower mark draws
    // its own shorter ones, as the engine does (session 50).
    const space = CNBStaff.staffSpacePx(config, gridContext);
    const groups = new Map();   // "x width" → { x, width, semis }
    const axis = CNBPitchAxis.create(config);
    const join = ({ semi, mark }, x) => {
      // A mark with no ledgers of its own joins the stack's usual group.
      const ledgered = CNBLedgerSet.ledgersFor(config, [semi], { minSemi: semi - 12, maxSemi: semi + 12 }, axis).length > 0;
      const width = ledgered ? markWidthOf(config, gridContext.pxPerSemi, m, mark) : m.markWidth;
      const id = `${x} ${width}`;
      if (!groups.has(id)) groups.set(id, { x, width, semis: [] });
      groups.get(id).semis.push(semi);
    };
    // Signs have no ledgers (session 51).
    if (m.offsets) {
      // Axis path: ledgers follow their marks' offsets.
      m.marks.forEach((mk, i) => { if (!mk.mark.sign) join(mk, columnX(mk.column) + m.offsets[i]); });
    } else {
      for (let c = 0; c < m.columns; c++) {
        const stack = m.marks.filter(mk => mk.column === c);
        if (stack.length === 0) groups.set(`empty ${c}`, { x: columnX(c), width: m.markWidth, semis: [] });
        for (const mk of stack) if (!mk.mark.sign) join(mk, columnX(c));
      }
    }
    for (const { x, width, semis } of groups.values()) {
      CNBLedgerSet.render(g, gridContext, config, semis, { width: ledgerLength(width, space), centerX: x });
    }

    m.marks.forEach(({ semi, column, mark }, i) => {
      const x = m.offsets ? columnX(column) + m.offsets[i] : columnX(column);
      if (mark.sign) {
        // A sign, black at its size (session 52), scaled about its origin,
        // its extent centred on its column and its origin at its semitone's
        // height (engine handoffs 030 §1, 035 §1a).
        const sign = signGlyph(config, mark.sign);
        const size = space * (mark.scale ?? 1);
        const scale = size / CNBAccidentalGlyphs.UNITS_PER_STAFF_SPACE;
        const path = document.createElementNS(NS, "path");
        path.setAttribute("class", "cnb-key-signature-sign");
        path.setAttribute("d", sign.path);
        path.setAttribute("fill", "#000000");
        path.setAttribute("transform", `translate(${x - (sign.x[0] + sign.x[1]) / 2 * size} ` +
          `${gridContext.semiToY(semi)}) scale(${scale})`);
        g.appendChild(path);
        return;
      }
      const shape = shapes[mark.shape];
      if (!shape) return;
      const { scaleFactor, scaleX, scaleY } = CNBNotehead.measure(shape, gridContext.pxPerSemi, mark);
      CNBNotehead.render(g, {
        shape,
        x,
        y: gridContext.semiToY(semi),
        scaleFactor,
        scaleX,
        scaleY,
        hollow: mark.hollow,
        color: mark.color,
      });
    });

    svgParent.appendChild(g);
    return g;
  },

};
