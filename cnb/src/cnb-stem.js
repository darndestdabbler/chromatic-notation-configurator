/**
 * cnb-stem.js — Module 8: Stem
 *
 * Computes stem direction/geometry using the 4-point anchor model and renders a
 * simple vertical line. Depends on config for display settings.
 *
 * Public API mirrors the Architecture Plan §6.
 */

import { CNBConfig } from "./cnb-config.js";

export const CNBStem = {
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
   * @param {object} config          Full CNB config (for display settings)
   * @param {object} opts
   * @param {object} opts.shape
   * @param {number} opts.scaleFactor
   * @param {number} opts.centerX
   * @param {number[]} opts.noteYPositions   Array of Y coordinates for each notehead in the chord
   * @param {"up"|"down"} opts.direction
   * @param {string} opts.duration          Duration name ("crotchet", "minim", etc.)
   * @returns {{x:number,y1:number,y2:number,thickness:number}|null}
   */
  geometry(config, { shape, scaleFactor, centerX, noteYPositions, direction, duration }) {
    if (!shape.anchors) return null;
    // only crotchet/minim have stems
    if (duration !== "crotchet" && duration !== "minim") return null;

    const key = direction === "up"
      ? (duration === "crotchet" ? "crotchetUp" : "minimUp")
      : (duration === "crotchet" ? "crotchetDown" : "minimDown");
    const anchor = shape.anchors[key];
    if (!anchor) return null;

    const anchorXpx = anchor.x * scaleFactor;
    const anchorYpx = anchor.y * scaleFactor;

    const stemX = centerX + anchorXpx;

    const pxPerSemi = (config.display && config.display.pxPerSemi) || 16;
    const noteheadHeightPx = shape.semitoneHeight * pxPerSemi;
    const extensionPx = (config.display.stemExtension || 0) * noteheadHeightPx;

    const low = Math.max(...noteYPositions);
    const high = Math.min(...noteYPositions);

    let y1, y2;
    if (direction === "up") {
      // attach at the lowest notehead's anchor point, extend above highest
      y1 = low + anchorYpx;
      y2 = high - extensionPx;
    } else {
      // down: attach at the highest notehead's anchor point, extend below lowest
      y1 = high + anchorYpx;
      y2 = low + extensionPx;
    }

    const thickness = CNBConfig.pctToPx(
      config.display.stemThicknessPct,
      config.display.pxPerSemi
    );

    return { x: stemX, y1, y2, thickness };
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
