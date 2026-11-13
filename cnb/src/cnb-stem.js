/**
 * cnb-stem.js — Module 8: Stem
 *
 * Computes stem direction/geometry using the 4-point anchor model and renders a
 * simple vertical line at the engine's stem size: its thickness and length
 * are LilyPond's, in staff spaces, so no config setting changes them
 * (session 34).
 *
 * Public API mirrors the Architecture Plan §6.
 */

import { CNBStaff } from "./cnb-staff.js";

// LilyPond's stem, which the engine leaves at its defaults (session 34,
// measured against the engine): 0.13 staff spaces thick (1.3 staff-line
// thicknesses), 3.5 staff spaces long for a crotchet or a minim, and
// shortened by up to 1 staff space (stem-shorten). Lengths in half spaces.
const STEM_THICKNESS = 0.13;
const STEM_LENGTH = 7;
const STEM_SHORTEN = 2;

export const CNBStem = {
  /** The engine's stem thickness, in staff spaces (session 34). */
  THICKNESS: STEM_THICKNESS,

  /**
   * Decide stem direction based on chord semitone average vs staff midpoint.
   * With an enabled axis (set 014, design §2.5) the chord's axis-position
   * average is compared against the midpoint's axis position instead —
   * same `<` → up, ≥ → down form.
   * @param {number[]} chordSemitones
   * @param {number} staffMidpoint
   * @param {object} [axis]  gridContext.axis; absent/disabled = linear
   * @returns {"up"|"down"}
   */
  direction(chordSemitones, staffMidpoint, axis) {
    if (axis && axis.enabled) {
      const avgPos = chordSemitones.reduce((a, s) => a + axis.positionOfSemi(s), 0) / chordSemitones.length;
      return avgPos < axis.positionOfSemi(staffMidpoint) ? "up" : "down";
    }
    const avg = chordSemitones.reduce((a, b) => a + b, 0) / chordSemitones.length;
    return avg < staffMidpoint ? "up" : "down";
  },

  /**
   * Compute stem geometry. Returns null if the shape has no anchors or duration
   * is not crotchet/minim.
   *
   * @param {object} config          Full CNB config (staff geometry)
   * @param {object} opts
   * @param {object} opts.gridContext  the grid the noteheads are drawn on
   *        (CNBGrid.create): its pxPerSemi, semiToY and axis give the staff
   *        space and the middle line
   * @param {object} opts.shape
   * @param {number} opts.scaleFactor
   * @param {number} opts.centerX
   * @param {number[]} opts.noteYPositions   Array of Y coordinates for each notehead in the chord
   * @param {"up"|"down"} opts.direction
   * @param {string} opts.duration          Duration name ("crotchet", "minim", etc.)
   * @param {number} [opts.widthScale=1]    Notehead group width ÷ one head's width.
   *        Repeat mode (session 18) draws a group of heads; the anchor's x
   *        offset scales with it, so the stem attaches at the anchor's
   *        relative position across the group, as LilyPond's
   *        stem-attachment (relative to the notehead extent) does.
   * @param {number} [opts.scaleX=scaleFactor]  Horizontal scale of a sized
   *        notehead (session 22, CNBNotehead.measure's scaleX); the anchor's
   *        x offset uses it, its y offset uses scaleFactor (= scaleY).
   * @returns {{x:number,y1:number,y2:number,thickness:number}|null}
   */
  geometry(config, { gridContext, shape, scaleFactor, scaleX = scaleFactor, centerX, noteYPositions, direction, duration, widthScale = 1 }) {
    if (!shape.anchors) return null;
    // only crotchet/minim have stems
    if (duration !== "crotchet" && duration !== "minim") return null;

    const key = direction === "up"
      ? (duration === "crotchet" ? "crotchetUp" : "minimUp")
      : (duration === "crotchet" ? "crotchetDown" : "minimDown");
    const anchor = shape.anchors[key];
    if (!anchor) return null;

    const anchorYpx = anchor.y * scaleFactor;

    // The engine's stem (session 34), in staff spaces.
    const pxPerHalfSpace = CNBStaff.staffSpacePx(config, gridContext) / 2;
    const thickness = STEM_THICKNESS * 2 * pxPerHalfSpace;

    // The anchor is the stem's centre, as the SVG's stem rect draws it
    // (session 40). LilyPond puts the stem's edge (an up stem's right, a
    // down stem's left) on the attachment point, which the export writes
    // half a stem outward of the anchor, relative to the notehead's extent
    // (LY spec §4.4c). Across a repeated group that edge scales with the
    // group, so the preview places the edge the same way and the centre
    // half a stem inward of it: for one head, the centre is on the anchor.
    const side = direction === "up" ? 1 : -1;
    const edgeX = centerX + (anchor.x * scaleX + side * thickness / 2) * widthScale;
    const stemX = edgeX - side * thickness / 2;

    const low = Math.max(...noteYPositions);
    const high = Math.min(...noteYPositions);
    const dir = direction === "up" ? 1 : -1;
    // The stem starts at the near notehead's anchor and runs past the far
    // one's centre.
    const y1 = (direction === "up" ? low : high) + anchorYpx;
    const farY = direction === "up" ? high : low;
    const far = dir * (gridContext.semiToY(config.staff.midpoint) - farY) / pxPerHalfSpace;
    const y2 = farY - dir * CNBStem.length(far, CNBStaff.lilypondPositions(config)) * pxPerHalfSpace;

    return { x: stemX, y1, y2, thickness };
  },

  /**
   * LilyPond's length for a crotchet or minim stem, from the far notehead's
   * centre to the stem's end, in half staff spaces (measured against the
   * engine, session 34). The full length is 3.5 staff spaces. A stem whose
   * far notehead is on the middle line or beyond it, in the stem's
   * direction, is shortened by a third of a half space for each half space
   * its full length would reach past one staff space beyond the staff's
   * radius, by at most one staff space (LilyPond's stem-shorten). The engine
   * sets no-stem-extend, so no stem is carried to the middle line.
   *
   * @param {number} far  the far notehead's staff position, half staff
   *        spaces from the middle line, positive in the stem's direction
   * @param {number[]} staffPositions  the staff's lines, LilyPond staff
   *        positions (CNBStaff.lilypondPositions)
   * @returns {number} half staff spaces
   */
  length(far, staffPositions) {
    if (far < 0 || staffPositions.length === 0) return STEM_LENGTH;
    const radius = (Math.max(...staffPositions) - Math.min(...staffPositions)) / 2;
    const reach = far + STEM_LENGTH - (radius + 2);
    return STEM_LENGTH - Math.min(STEM_SHORTEN, Math.max(0, reach / 3));
  },

  /**
   * Render a stem line given precomputed geometry. Returns null if geometry is
   * null.
   * @param {SVGElement} svgParent
   * @param {{x:number,y1:number,y2:number,thickness:number}|null} stemGeometry
   * @returns {SVGLineElement|null}
   */
  render(svgParent, stemGeometry) {
    if (!stemGeometry) return null;
    const NS = "http://www.w3.org/2000/svg";
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", String(stemGeometry.x));
    line.setAttribute("x2", String(stemGeometry.x));
    line.setAttribute("y1", String(stemGeometry.y1));
    line.setAttribute("y2", String(stemGeometry.y2));
    line.setAttribute("stroke", "#000000");
    line.setAttribute("stroke-width", String(stemGeometry.thickness));
    svgParent.appendChild(line);
    return line;
  },
};
