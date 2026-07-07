/**
 * cnb-key-signature.js — Key-signature renderer (set 010)
 *
 * Renders the selected key's signature into a gutter column at the start of
 * the staff, positioned on the semitone grid. Pure config-in/DOM-out: no
 * state, no event listeners. Composes with the set-009 clef gutter (clef
 * first, then key signature, left to right).
 *
 * Two mark styles (s1 decision D2; binding rule 2's two arms):
 *
 *   "notehead-chords" (default — operator directive, mirroring the engine's
 *   keysig.ly): the key's scale as REAL noteheads — every pitch class of the
 *   key ascending from the tonic, plus the octave tonic — interleaved into
 *   two columns (even indices left, odd indices right). For a 7-note key
 *   this reads as two stacked 7th chords: degrees 1-3-5-7 on the root in
 *   the left column, degrees 2-4-6-8 on the second degree in the right
 *   column, chord qualities falling out of the mode automatically. Each
 *   notehead is resolved through the normal rule pipeline at crotchet
 *   duration (the engine resolves keysig noteheads at quarter-note
 *   duration — stencils.ly cnb:get-keysig-note-stencil), with the selected
 *   key passed as the rule-match key context. Ledger lines are drawn per
 *   column through the shared ledger rules, beneath the noteheads
 *   (keysig.ly's two-pass layering). A vertical separator bar (the engine's
 *   gold bar, cnb:gold #ffd42a) caps the right edge, spanning
 *   staff.midpoint ± extentSemis.
 *
 *   "dot": a simple built-in mark — one filled circle per scale degree at
 *   the same grid positions, single column, colored by the same notehead
 *   color resolution.
 *
 * The displayed key is EXAMPLE DATA (architecture principle 1): it arrives
 * as the keyName argument (the collection passes options.keys[0]), never
 * from the config. Rendering is gated on keys.enabled AND
 * keys.keySignature.enabled AND the key name resolving to a definition
 * (E2: "only when keys.enabled and a signature device is configured").
 *
 * Vertical anchoring (s1 decision D4): tonicOctave null = auto — the
 * octave span [tonicSemi, tonicSemi+12] is centered on staff.midpoint,
 * ties resolving upward (C tonic, midpoint 12 → tonic at semitone 12,
 * matching the engine's middle-C anchor for the default config). An
 * explicit integer tonicOctave overrides.
 *
 * Inspired by Clairnote DN's alternative key signatures (design
 * CC BY-SA 4.0, Paul Morris); no code is ported from clairnote.ly — the
 * notehead-chord layout follows this project's own engine module
 * (keysig.ly in the chromatic-notation-base repo).
 *
 * Dependencies: Modules A (config), B (music), 1 (grid context passed in),
 * 5 (ledger set), 6 (notehead).
 */

import { CNBConfig } from "./cnb-config.js";
import { CNBMusic } from "./cnb-music.js";
import { CNBNotehead } from "./cnb-notehead.js";
import { CNBLedgerSet } from "./cnb-ledger-set.js";

const NS = "http://www.w3.org/2000/svg";

/** Signature duration: the engine resolves keysig noteheads at quarter
 *  note (duration 3) — stencils.ly cnb:get-keysig-note-stencil. */
const SIGNATURE_DURATION = "crotchet";

/** Concrete notehead resolution — same concretion rule as
 *  CNBCard.resolveNotehead (explicit rule color wins, else palette color,
 *  else black), pinned against it by a parity unit test. */
function resolveMark(config, pc, keyName) {
  const resolved = CNBConfig.resolveNotehead(config, pc, SIGNATURE_DURATION, keyName);
  return {
    ...resolved,
    color: resolved.color ?? CNBConfig.resolveColor(config, pc) ?? "#000000",
  };
}

export const CNBKeySignature = {

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
    const parsed = CNBMusic.parseTonicPc(def.name);
    if (parsed !== null) return parsed;
    const first = (def.pitchClasses || []).find(pc => Number.isInteger(pc));
    return CNBMusic.pitchClass(first ?? 0);
  },

  /**
   * Absolute semitone of the rendered tonic (s1 decision D4).
   * Explicit integer keySignature.tonicOctave places the tonic in that
   * octave; null/absent auto-centers the octave span on staff.midpoint
   * with ties resolving upward.
   *
   * @param {object} config
   * @param {object} def
   * @returns {number}
   */
  tonicSemi(config, def) {
    const pc = CNBKeySignature.tonicPc(def);
    const ks = (config.keys || {}).keySignature || {};
    if (Number.isInteger(ks.tonicOctave)) {
      return CNBMusic.absoluteSemi(pc, ks.tonicOctave);
    }
    const midpoint = (config.staff || {}).midpoint ?? 12;
    // Center [t, t+12] on the midpoint: minimize |t + 6 − midpoint| over
    // t = pc + 12k. Math.round rounds half-up, so ties choose the higher
    // octave (engine parity: C tonic, midpoint 12 → t = 12).
    const k = Math.round((midpoint - 6 - pc) / 12);
    return CNBMusic.absoluteSemi(pc, k);
  },

  /**
   * The signature's absolute semitones, ascending: every distinct pitch
   * class of the key ordered as a scale from the tonic, plus the octave
   * tonic (keysig.ly's 8-pitch layout for 7-note keys). Null when no key
   * resolves.
   *
   * @param {object} config
   * @param {string|null} keyName
   * @returns {number[]|null}
   */
  signatureSemis(config, keyName) {
    const active = CNBKeySignature.activeKey(config, keyName);
    if (!active) return null;
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
   * markWidth: notehead-chords → the widest resolved notehead in px;
   *            dot → the dot diameter in px.
   * columns:   2 for notehead-chords, 1 for dot.
   * separatorPx: separator bar thickness in px (0 when disabled).
   * contentWidth: columns × markWidth + separatorPx.
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
    const shapes = config.shapes || {};

    let markWidth = 0;
    let columns = 1;
    if (style === "dot") {
      const radiusPct = ks.dot?.radiusPct ?? 30;
      markWidth = 2 * (radiusPct / 100) * pxPerSemi;
    } else {
      columns = 2;
      for (const semi of semis) {
        const mark = resolveMark(config, CNBMusic.pitchClass(semi), keyName);
        const shape = shapes[mark.shape];
        if (!shape) continue;
        const { pixelWidth } = CNBNotehead.measure(shape, pxPerSemi);
        if (pixelWidth > markWidth) markWidth = pixelWidth;
      }
    }
    if (!(markWidth > 0)) return null;

    const sep = ks.separator || {};
    const separatorPx = sep.enabled === false
      ? 0
      : CNBConfig.pctToPx(sep.thicknessPct ?? 25, pxPerSemi);

    return {
      style,
      markWidth,
      columns,
      separatorPx,
      contentWidth: columns * markWidth + separatorPx,
      semis,
    };
  },

  /**
   * Total width of the key-signature gutter in px: content width plus the
   * configured horizontal padding on both sides. 0 when nothing renders —
   * the collection reserves no gutter (default-off compatibility).
   *
   * @param {object} config
   * @param {number} pxPerSemi
   * @param {string|null} keyName
   * @returns {number}
   */
  gutterWidth(config, pxPerSemi, keyName) {
    const m = CNBKeySignature.measure(config, pxPerSemi, keyName);
    if (!m) return 0;
    const paddingH = config.keys?.keySignature?.gutter?.paddingH ?? 12;
    return m.contentWidth + 2 * paddingH;
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
    const paddingH = ks.gutter?.paddingH ?? 12;
    const shapes = config.shapes || {};

    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-key-signature");

    if (m.style === "dot") {
      const radius = m.markWidth / 2;
      const cx = paddingH + radius;
      for (const semi of m.semis) {
        const mark = resolveMark(config, CNBMusic.pitchClass(semi), keyName);
        const circle = document.createElementNS(NS, "circle");
        circle.setAttribute("cx", String(cx));
        circle.setAttribute("cy", String(gridContext.semiToY(semi)));
        circle.setAttribute("r", String(radius));
        circle.setAttribute("fill", mark.color);
        g.appendChild(circle);
      }
    } else {
      const leftX = paddingH + m.markWidth / 2;
      const rightX = leftX + m.markWidth;
      const evenSemis = m.semis.filter((_, i) => i % 2 === 0);
      const oddSemis = m.semis.filter((_, i) => i % 2 === 1);

      // Ledger layer first, noteheads on top (keysig.ly's two-pass
      // layering). Ledger length = 4/3 × notehead width, the engine's
      // keysig ledger proportion.
      const ledgerOpts = { width: m.markWidth * (4 / 3) };
      CNBLedgerSet.render(g, gridContext, config, evenSemis, { ...ledgerOpts, centerX: leftX });
      CNBLedgerSet.render(g, gridContext, config, oddSemis, { ...ledgerOpts, centerX: rightX });

      m.semis.forEach((semi, i) => {
        const mark = resolveMark(config, CNBMusic.pitchClass(semi), keyName);
        const shape = shapes[mark.shape];
        if (!shape) return;
        const { scaleFactor } = CNBNotehead.measure(shape, gridContext.pxPerSemi);
        CNBNotehead.render(g, {
          shape,
          x: i % 2 === 0 ? leftX : rightX,
          y: gridContext.semiToY(semi),
          scaleFactor,
          hollow: mark.hollow,
          color: mark.color,
        });
      });
    }

    if (m.separatorPx > 0) {
      const sep = ks.separator || {};
      const midpoint = (config.staff || {}).midpoint ?? 12;
      const extent = sep.extentSemis ?? 12;
      const x = paddingH + m.columns * m.markWidth + m.separatorPx / 2;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("class", "cnb-key-signature-separator");
      line.setAttribute("x1", String(x));
      line.setAttribute("x2", String(x));
      line.setAttribute("y1", String(gridContext.semiToY(midpoint + extent)));
      line.setAttribute("y2", String(gridContext.semiToY(midpoint - extent)));
      line.setAttribute("stroke", sep.color ?? "#ffd42a");
      line.setAttribute("stroke-width", String(m.separatorPx));
      g.appendChild(line);
    }

    svgParent.appendChild(g);
    return g;
  },

};
