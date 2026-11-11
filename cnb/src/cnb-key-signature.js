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
 * Set 014 (pitch axis): mark placement already flows through semiToY; on
 * an axis config each mark also takes its resolved xOffsetStaffSpaces
 * (widening the gutter to fit), its ledgers follow it, and the separator's
 * extentSemis is converted as a length, not mapped through the axis
 * (design §1.2/§2.3). Linear configs render exactly as before.
 *
 * Dependencies: Modules A (config), B (music), 1 (grid context passed in),
 * 5 (ledger set), 6 (notehead), 24 (pitch axis — gutter measurement).
 */

import { CNBConfig } from "./cnb-config.js";
import { CNBMusic } from "./cnb-music.js";
import { CNBNotehead } from "./cnb-notehead.js";
import { CNBLedgerSet } from "./cnb-ledger-set.js";
import { CNBPitchAxis } from "./cnb-pitch-axis.js";
import { CNBClef } from "./cnb-clef.js";
import { CNBStaff } from "./cnb-staff.js";

const NS = "http://www.w3.org/2000/svg";

// The engine's spacing around the signature (session 34, measured from
// renders), in staff spaces: the signature starts 0.75 after the staff's
// start, or 3.5 after the clef's left edge (LilyPond's clef-to-signature
// minimum-space), and the first note's head is centred 4.8636 after it,
// whatever the widths of the marks and of that notehead (measured).
const SPACE_BEFORE = 0.75;
const SPACE_FROM_CLEF = 3.5;
const FIRST_NOTE_CENTRE = 4.8636;

/** CNBKeySignature.padding for a measured signature. */
function gutterPadding(config, pxPerSemi, m, firstHeadCenter) {
  const space = CNBStaff.staffSpacePx(config, { pxPerSemi, axis: CNBPitchAxis.create(config) });
  const clef = CNBClef.activeGlyph(config);
  const left = clef
    ? Math.max(0, SPACE_FROM_CLEF * space - CNBClef.measure(clef.def, pxPerSemi, space).pixelWidth -
        (config.clef?.gutter?.paddingH ?? 12))
    : SPACE_BEFORE * space;
  // Without the first card, a column for a notehead the size of the marks
  // stands for it: its padding plus half its ledger (CNBCard.columnWidth).
  const inset = firstHeadCenter ??
    (config.display?.column?.paddingH ?? 16) + CNBLedgerSet.width(m.markWidth) / 2;
  return { left, right: Math.max(0, FIRST_NOTE_CENTRE * space - inset) };
}

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
   * The signature's absolute semitones, ascending, per the configured
   * placement rule. "scale-from-tonic" (the only implemented rule): every
   * distinct pitch class of the key ordered as a scale from the tonic,
   * plus the octave tonic (keysig.ly's 8-pitch layout for 7-note keys).
   * Null when no key resolves or the placement rule is unknown.
   *
   * @param {object} config
   * @param {string|null} keyName
   * @returns {number[]|null}
   */
  signatureSemis(config, keyName) {
    const active = CNBKeySignature.activeKey(config, keyName);
    if (!active) return null;
    const placement = ((config.keys || {}).keySignature || {}).placement || {};
    if ((placement.rule ?? "scale-from-tonic") !== "scale-from-tonic") return null;
    const tonic = CNBKeySignature.tonicPc(active.def);
    const t = CNBKeySignature.tonicSemi(config, active.def);
    const pcs = [...new Set(active.def.pitchClasses.filter(pc => Number.isInteger(pc)))];
    const offsets = pcs
      .map(pc => (((pc - tonic) % 12) + 12) % 12)
      .sort((a, b) => a - b);
    const semis = offsets.map(o => t + o);
    semis.push(t + 12);
    return semis;
  },

  /**
   * Geometry shared by gutterWidth() and render(), so the reserved gutter
   * always matches what is drawn. Null when nothing would render (feature
   * gated off, no notes, or — for notehead-chords — no resolvable shape).
   *
   * markWidth: the per-mark horizontal extent of ONE column in px — the
   *            widest resolved notehead.
   * columns:   2 (marks stagger left/right of the stem).
   * separatorPx: separator bar thickness in px (0 when disabled).
   * contentWidth: columns × markWidth — the separator runs through the
   *            middle of the columns (the engine's gold stem), so it adds
   *            no width of its own.
   *
   * Null when the style is unknown (validation reports it) or no referenced
   * shape resolves.
   *
   * @param {object} config
   * @param {number} pxPerSemi
   * @param {string|null} keyName
   * @returns {{style:string, markWidth:number, columns:number,
   *            separatorPx:number, contentWidth:number, semis:number[]}|null}
   */
  measure(config, pxPerSemi, keyName) {
    const semis = CNBKeySignature.signatureSemis(config, keyName);
    if (!semis || semis.length === 0) return null;

    const ks = (config.keys || {}).keySignature || {};
    const style = ks.style ?? "notehead-chords";
    if (style !== "notehead-chords") return null;   // unknown style renders nothing
    const shapes = config.shapes || {};
    const columns = 2;

    // The widest resolved notehead (at its resolved size, session 22) sets
    // the column width.
    let markWidth = 0;
    for (const semi of semis) {
      const mark = resolveMark(config, CNBMusic.pitchClass(semi), keyName);
      const shape = shapes[mark.shape];
      if (!shape) continue;
      const { pixelWidth } = CNBNotehead.measure(shape, pxPerSemi, mark);
      if (pixelWidth > markWidth) markWidth = pixelWidth;
    }
    if (!(markWidth > 0)) return null;

    const sep = ks.separator || {};
    const separatorPx = sep.enabled === false
      ? 0
      : CNBConfig.pctToPx(sep.thicknessPct ?? 160, pxPerSemi);

    const result = {
      style,
      markWidth,
      columns,
      separatorPx,
      contentWidth: columns * markWidth,
      semis,
    };

    // Pitch axis (set 014): each mark carries its resolved
    // xOffsetStaffSpaces (the notehead pipeline's disambiguation, axis-gated
    // like the card's), and the content widens so offset marks don't clip.
    const axis = CNBPitchAxis.create(config);
    if (!axis.enabled) return result;
    const offsets = semis.map(semi =>
      (resolveMark(config, CNBMusic.pitchClass(semi), keyName).xOffsetStaffSpaces || 0) *
      axis.unitsPerStaffSpace * pxPerSemi);
    result.offsets = offsets;
    result.extraLeftPx = Math.max(0, ...offsets.map(o => -o));
    result.contentWidth += result.extraLeftPx + Math.max(0, ...offsets);
    return result;
  },

  /**
   * The gutter's padding left and right of the marks, in px, giving the
   * engine's spacing (session 34): the marks start 0.75 staff spaces after
   * the staff's start, or, with a clef shown, 3.5 after the clef glyph's left
   * edge (the clef column pads the glyph on both sides); the first card's
   * notehead is centred 4.8636 after them. Null when nothing renders.
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

    // Separator first — the engine's gold stem is stencil-added UNDER the
    // ledger lines and noteheads (keysig.ly bottom layer), running through
    // the horizontal middle of the mark columns.
    if (m.separatorPx > 0) {
      const sep = ks.separator || {};
      const midpoint = (config.staff || {}).midpoint ?? 12;
      const extent = sep.extentSemis ?? 12;
      const x = paddingH + (m.columns * m.markWidth) / 2;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("class", "cnb-key-signature-separator");
      line.setAttribute("x1", String(x));
      line.setAttribute("x2", String(x));
      if (gridContext.axis && gridContext.axis.enabled) {
        // extentSemis is a LENGTH (design §1.2/§2.3): px, not axis positions.
        const midY = gridContext.semiToY(midpoint);
        line.setAttribute("y1", String(midY - extent * gridContext.pxPerSemi));
        line.setAttribute("y2", String(midY + extent * gridContext.pxPerSemi));
      } else {
        line.setAttribute("y1", String(gridContext.semiToY(midpoint + extent)));
        line.setAttribute("y2", String(gridContext.semiToY(midpoint - extent)));
      }
      line.setAttribute("stroke", sep.color ?? "#ffd42a");
      line.setAttribute("stroke-width", String(m.separatorPx));
      g.appendChild(line);
    }

    // Marks stagger left/right of the stem, which sits at the boundary
    // between the two columns.
    const leftX = paddingH + m.markWidth / 2;
    const rightX = leftX + m.markWidth;
    const evenSemis = m.semis.filter((_, i) => i % 2 === 0);
    const oddSemis = m.semis.filter((_, i) => i % 2 === 1);

    // Ledger layer first, noteheads on top (keysig.ly's two-pass
    // layering). Ledger length = 4/3 × notehead width, the engine's
    // keysig ledger proportion.
    const ledgerOpts = { width: m.markWidth * (4 / 3) };
    if (m.offsets) {
      // Axis path: ledgers follow their marks — one render per
      // (column, offset) group, so equal-offset marks share ledgers.
      const groups = new Map();
      m.semis.forEach((semi, i) => {
        const x = (i % 2 === 0 ? leftX : rightX) + m.offsets[i];
        if (!groups.has(x)) groups.set(x, []);
        groups.get(x).push(semi);
      });
      for (const [x, semis] of groups) {
        CNBLedgerSet.render(g, gridContext, config, semis, { ...ledgerOpts, centerX: x });
      }
    } else {
      CNBLedgerSet.render(g, gridContext, config, evenSemis, { ...ledgerOpts, centerX: leftX });
      CNBLedgerSet.render(g, gridContext, config, oddSemis, { ...ledgerOpts, centerX: rightX });
    }

    m.semis.forEach((semi, i) => {
      const mark = resolveMark(config, CNBMusic.pitchClass(semi), keyName);
      const shape = shapes[mark.shape];
      if (!shape) return;
      const { scaleFactor, scaleX, scaleY } = CNBNotehead.measure(shape, gridContext.pxPerSemi, mark);
      CNBNotehead.render(g, {
        shape,
        x: m.offsets
          ? (i % 2 === 0 ? leftX : rightX) + m.offsets[i]
          : i % 2 === 0 ? leftX : rightX,
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
