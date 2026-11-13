/**
 * cnb-clef.js — Clef renderer (set 009)
 *
 * Renders the active clef glyph into a left gutter column, vertically
 * positioned on the semitone grid. Pure config-in/DOM-out: no state, no
 * event listeners.
 *
 * Anchoring model (set 009 s1 decision): a clef definition's `anchorSemi`
 * is the semitone position of the glyph's TOP edge, and it is a FLOAT.
 * Surveyed designs (Bravura gClef, Clairnote 2017 clefs, Express Stave
 * F/B/D) all register clefs by an interior musical reference point, which
 * puts the bounding-box top at a fractional grid offset — so integer-only
 * top anchoring cannot express them. Any interior-point registration
 * reduces to a fractional top anchor: anchorSemi = markedPitchSemi + k,
 * where k is the (possibly fractional) semitone distance from the glyph
 * top down to the marking feature.
 *
 * Three definition kinds:
 *   kind "glyph" — imported SVG path (toolkit contract: svgPath, natural
 *                  dimensions, semitoneHeight, optional viewBox min offsets)
 *   kind "text"  — register label (octave numeral/letter, E1 catalog
 *                  records 20/40); rendered as an SVG <text> whose em-box
 *                  is textHeightSemis tall. Numerals have no descenders,
 *                  so the visual top sits slightly below the anchor
 *                  (cap-height < em-height) — an accepted approximation,
 *                  verified visually on the test page.
 *   kind "dozenal" — the engine's dozenal clef (session 45), drawn as the
 *                  engine engraves it under the score's default treble clef:
 *                  the register numeral 50 (cnb/clefs.ly cnb:dozenal-clef
 *                  at middleCPosition −6). It has no size or anchor of its
 *                  own; it is placed on the staff's middle line.
 *
 * The dozenal clef's geometry is cnb:build-dozenal-clef-stencil's, in staff
 * spaces: the left digit's ink scaled to 3 staff spaces tall and half that
 * across, moved down 0.5; the right digit at 2/3 of that height, placed at
 * the left digit's advance; both moved down 1 staff space from the middle
 * line (the engraver's Y-offset). Its digits are TeX Gyre Schola Bold's '5'
 * and '0' (GUST Font License, cnb/assets/fonts/GUST-TeXGyreSchola.txt),
 * whose metrics and outlines match C059 Bold, the bold serif LilyPond 2.24
 * engraves them in. An engine round trip measures its top at 1.4418 and its
 * bottom at −1.5582 staff spaces from the middle line, as computed here.
 *
 * extent(config) gives the shown clef's top and bottom in semitones, which
 * the card collection widens a row's grid to hold (session 45). A glyph
 * clef also draws rect.cnb-clef-resize along its bottom edge, unpainted and
 * hidden; the editor's canvas shows it as the handle that resizes the clef.
 *
 * Dependencies: Module 1 (grid context passed in), Module A (clef schema),
 * Module 24 (the staff space under a pitch axis).
 */

import { CNBPitchAxis } from "./cnb-pitch-axis.js";

const NS = "http://www.w3.org/2000/svg";

/**
 * The dozenal numeral's digits, TeX Gyre Schola Bold, in font units (1000
 * to the em, Y up): their outlines, the ink's bottom and top (the same for
 * both) and the advance width (the same for every digit).
 */
const DOZENAL_DIGITS = {
  five: "M535 234C535 364 430 460 286 460C239 460 208 452 142 422L157 551C204 541 244 536 283 536C411 536 506 612 506 697C506 703 503 708 498 708C494 708 488 707 482 705C449 697 379 691 301 691C218 691 168 695 106 708L83 380C61 358 57 351 57 335C57 314 73 298 94 298C116 298 135 316 135 338C135 342 134 348 133 354C163 379 203 392 244 392C319 392 357 337 357 229C357 108 314 43 234 43C189 43 146 64 146 85C146 91 149 94 158 99C197 118 212 137 212 171C212 220 178 253 127 253C69 253 31 213 31 151C31 51 121 -14 259 -14C423 -14 535 87 535 234Z",
  zero: "M546 342C546 542 443 708 287 708C137 708 27 555 27 347C27 139 137 -14 287 -14C434 -14 546 139 546 342ZM372 345C372 116 359 38 286 38C216 38 199 105 199 347C199 576 211 656 286 656C355 656 372 590 372 345Z",
  inkBottom: -14,
  inkTop: 708,
  advance: 574,
};

/** Staff spaces per font unit: the left digit's ink made 3 staff spaces tall. */
const DOZENAL_SCALE = 3 / (DOZENAL_DIGITS.inkTop - DOZENAL_DIGITS.inkBottom);
/** The numeral's top and bottom, in staff spaces above the middle line. */
const DOZENAL_TOP = DOZENAL_DIGITS.inkTop * DOZENAL_SCALE - 1.5;
const DOZENAL_BOTTOM = DOZENAL_DIGITS.inkBottom * DOZENAL_SCALE - 1.5;
/** Its width in staff spaces: two half-width advances. */
const DOZENAL_WIDTH = DOZENAL_DIGITS.advance * DOZENAL_SCALE;

/** The height in px of a glyph clef's resize handle, on its bottom edge. */
const RESIZE_HANDLE_PX = 8;

/** Semitones (axis units under a pitch axis) per staff space. */
function unitsPerStaffSpace(config) {
  const axis = CNBPitchAxis.create(config);
  return axis.enabled
    ? axis.unitsPerStaffSpace
    : ((config.staff && config.staff.semitonesPerStaffSpace) || 1);
}

export const CNBClef = {

  /**
   * Resolve the active clef definition, or null when the clef is disabled
   * or the reference is missing/unknown.
   *
   * @param {object} config
   * @returns {{name:string, def:object}|null}
   */
  activeGlyph(config) {
    const clef = config.clef || {};
    if (!clef.enabled || !clef.active) return null;
    const def = (clef.glyphs || {})[clef.active];
    return def ? { name: clef.active, def } : null;
  },

  /**
   * Compute pixel dimensions for a clef definition.
   * Glyph kind mirrors CNBNotehead.measure; text kind sizes the em-box
   * from textHeightSemis and estimates width per glyph at 0.6 em; the
   * dozenal kind is measured in staff spaces, so it needs staffSpacePx.
   *
   * @param {object} def        clef.glyphs[name] entry
   * @param {number} pxPerSemi
   * @param {number} [staffSpacePx]  px per staff space (the dozenal kind)
   * @returns {{scaleFactor:number, pixelWidth:number, pixelHeight:number}}
   */
  measure(def, pxPerSemi, staffSpacePx) {
    if (def.kind === "dozenal") {
      return { scaleFactor: 1, pixelWidth: DOZENAL_WIDTH * staffSpacePx, pixelHeight: 3 * staffSpacePx };
    }
    if ((def.kind || "glyph") === "text") {
      const pixelHeight = (def.textHeightSemis || 0) * pxPerSemi;
      const pixelWidth = 0.6 * pixelHeight * String(def.text || "").length;
      return { scaleFactor: 1, pixelWidth, pixelHeight };
    }
    const scaleFactor = (def.semitoneHeight * pxPerSemi) / def.naturalHeight;
    return {
      scaleFactor,
      pixelWidth: def.naturalWidth * scaleFactor,
      pixelHeight: def.naturalHeight * scaleFactor,
    };
  },

  /**
   * Total width of the clef gutter in px: active glyph width plus the
   * configured horizontal padding on both sides. 0 when no clef renders —
   * the collection reserves no gutter (default-off compatibility).
   *
   * @param {object} config
   * @param {number} pxPerSemi
   * @returns {number}
   */
  gutterWidth(config, pxPerSemi) {
    const active = CNBClef.activeGlyph(config);
    if (!active) return 0;
    const paddingH = config.clef?.gutter?.paddingH ?? 12;
    return CNBClef.measure(active.def, pxPerSemi, CNBClef.staffSpacePx(config, pxPerSemi)).pixelWidth +
      2 * paddingH;
  },

  /**
   * Pixels per staff space at pxPerSemi: semitonesPerStaffSpace semitones,
   * or axisUnitsPerStaffSpace axis units under a pitch axis (as
   * CNBStaff.staffSpacePx, from the config alone).
   *
   * @param {object} config
   * @param {number} pxPerSemi
   * @returns {number}
   */
  staffSpacePx(config, pxPerSemi) {
    return pxPerSemi * unitsPerStaffSpace(config);
  },

  /**
   * The shown clef's top and bottom in semitones (session 45): a glyph's
   * anchorSemi and anchorSemi − semitoneHeight, a text clef's with
   * textHeightSemis, the dozenal numeral's from the middle line. Null when
   * no clef is shown. Under a pitch axis the dozenal clef's staff spaces
   * are counted in axis units.
   *
   * @param {object} config
   * @returns {{top:number, bottom:number}|null}
   */
  extent(config) {
    const active = CNBClef.activeGlyph(config);
    if (!active) return null;
    const { def } = active;
    if (def.kind === "dozenal") {
      const mid = config.staff?.midpoint ?? 12;
      const units = unitsPerStaffSpace(config);
      return { top: mid + DOZENAL_TOP * units, bottom: mid + DOZENAL_BOTTOM * units };
    }
    const height = (def.kind || "glyph") === "text" ? def.textHeightSemis : def.semitoneHeight;
    return { top: def.anchorSemi, bottom: def.anchorSemi - height };
  },

  /**
   * Render the active clef into svgParent. The glyph's TOP edge is placed
   * at semiToY(anchorSemi); the left edge sits at gutter.paddingH. The
   * dozenal numeral is placed on the middle line, semiToY(staff.midpoint).
   * Returns null (rendering nothing) when no clef is active.
   *
   * @param {SVGElement} svgParent
   * @param {object} gridContext   From CNBGrid.create()
   * @param {object} config
   * @returns {SVGGElement|null}
   */
  render(svgParent, gridContext, config) {
    const active = CNBClef.activeGlyph(config);
    if (!active) return null;
    const { def } = active;

    const paddingH = config.clef?.gutter?.paddingH ?? 12;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-clef");

    if (def.kind === "dozenal") {
      // In staff spaces from the middle line, Y down: the left digit's ink
      // at (y × scale) − 1.5 up, the right digit's at (y × 2/3 scale) − 1.
      const space = CNBClef.staffSpacePx(config, gridContext.pxPerSemi);
      const middleY = gridContext.semiToY(config.staff?.midpoint ?? 12);
      g.setAttribute("transform", `translate(${paddingH},${middleY}) scale(${space})`);
      const digits = [
        [DOZENAL_DIGITS.five, `translate(0,1.5) scale(${DOZENAL_SCALE / 2},${-DOZENAL_SCALE})`],
        [DOZENAL_DIGITS.zero, `translate(${DOZENAL_WIDTH / 2},1) scale(${DOZENAL_SCALE / 2},${-DOZENAL_SCALE * 2 / 3})`],
      ];
      for (const [d, transform] of digits) {
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", d);
        path.setAttribute("transform", transform);
        path.setAttribute("fill", "#000000");
        g.appendChild(path);
      }
      svgParent.appendChild(g);
      return g;
    }

    const topY = gridContext.semiToY(def.anchorSemi);
    const { scaleFactor, pixelHeight } = CNBClef.measure(def, gridContext.pxPerSemi);
    g.setAttribute("transform", `translate(${paddingH},${topY})`);

    if ((def.kind || "glyph") === "text") {
      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", "0");
      text.setAttribute("y", String(pixelHeight));
      text.setAttribute("font-size", String(pixelHeight));
      text.setAttribute("font-family", def.fontFamily || "Georgia, serif");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("fill", def.color || "#000000");
      text.textContent = def.text;
      g.appendChild(text);
    } else {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", def.svgPath);
      // Right-to-left: shift the viewBox origin to (0,0), then scale to
      // pixels — so the glyph's top-left corner lands exactly on the g's
      // translate target regardless of the SVG's coordinate convention
      // (toolkit noteheads are origin-centered; other sources may not be).
      const minX = def.viewBoxMinX || 0;
      const minY = def.viewBoxMinY || 0;
      path.setAttribute("transform", `scale(${scaleFactor}) translate(${-minX},${-minY})`);
      path.setAttribute("fill", def.color || "#000000");
      g.appendChild(path);
      // The resize handle along the bottom edge (session 45): hidden, and
      // shown by the editor's canvas while the Clef section is open.
      const { pixelWidth } = CNBClef.measure(def, gridContext.pxPerSemi);
      const handle = document.createElementNS(NS, "rect");
      handle.setAttribute("class", "cnb-clef-resize");
      handle.setAttribute("x", "0");
      handle.setAttribute("y", String(pixelHeight - RESIZE_HANDLE_PX / 2));
      handle.setAttribute("width", String(pixelWidth));
      handle.setAttribute("height", String(RESIZE_HANDLE_PX));
      handle.setAttribute("fill", "none");
      handle.setAttribute("visibility", "hidden");
      g.appendChild(handle);
    }

    svgParent.appendChild(g);
    return g;
  },

};
