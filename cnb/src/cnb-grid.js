/**
 * cnb-grid.js — Module 1: Semitone Grid
 *
 * Coordinate system for all rendering modules.
 * Converts between semitone positions and pixel coordinates.
 * Renders a debug overlay for visual verification.
 *
 * Depends on: Module A (cnb-config.js) — reads display settings.
 *
 * Part of the Chromatic Notation Builder modular architecture.
 */

export const CNBGrid = {

  /**
   * Create a grid context from config and a semitone range.
   *
   * The grid maps semitone values to Y pixel positions.
   * Higher pitch = lower Y (standard music convention: high notes at top).
   *
   * @param {object} config   Full CNB config (reads config.display)
   * @param {{ minSemi: number, maxSemi: number }} range
   * @returns {object} gridContext
   */
  create(config, { minSemi, maxSemi }) {
    const display = config.display || {};
    const pxPerSemi = display.pxPerSemi ?? 16;
    const label     = display.label    || {};

    const topLabelHeight    = (label.marginTop    ?? 14) + (label.fontSize ?? 22) + (label.padding ?? 6);
    const bottomLabelHeight = (label.marginBottom ?? 14) + (label.fontSize ?? 22) + (label.padding ?? 6);

    const totalSemiRange = maxSemi - minSemi;
    const svgHeight      = totalSemiRange * pxPerSemi;
    const totalHeight    = topLabelHeight + svgHeight + bottomLabelHeight;

    /**
     * Convert a semitone value to a Y pixel position within the SVG.
     * maxSemi → y=0 (top), minSemi → y=svgHeight (bottom).
     * @param {number} semi
     * @returns {number}
     */
    function semiToY(semi) {
      return (maxSemi - semi) * pxPerSemi;
    }

    /**
     * Convert a Y pixel position back to a semitone value.
     * Inverse of semiToY.
     * @param {number} y
     * @returns {number}
     */
    function yToSemi(y) {
      return maxSemi - y / pxPerSemi;
    }

    return {
      pxPerSemi,
      minSemi,
      maxSemi,
      totalSemiRange,
      svgHeight,
      semiToY,
      yToSemi,
      topLabelHeight,
      bottomLabelHeight,
      totalHeight,
    };
  },

  /**
   * Render a debug grid overlay into an SVG element.
   * Draws faint lines at every semitone, highlights staff positions,
   * marks octave boundaries, and labels semitone numbers.
   *
   * @param {SVGElement} svgParent      The SVG element to render into
   * @param {object}     gridContext    From CNBGrid.create()
   * @param {number[]}   staffPositions Absolute semitone positions of staff lines
   * @returns {SVGGElement}
   */
  renderDebugOverlay(svgParent, gridContext, staffPositions = []) {
    const { minSemi, maxSemi, pxPerSemi, semiToY } = gridContext;
    const staffSet = new Set(staffPositions);

    const NS = "http://www.w3.org/2000/svg";
    const g  = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-debug-grid");

    const width = svgParent.getAttribute("width") || svgParent.viewBox?.baseVal?.width || 400;

    for (let semi = minSemi; semi <= maxSemi; semi++) {
      const y = semiToY(semi);
      const isStaff   = staffSet.has(semi);
      const isOctave  = semi % 12 === 0;

      // Horizontal line
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", "0");
      line.setAttribute("x2", String(width));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));

      if (isStaff) {
        line.setAttribute("stroke", "#4488cc");
        line.setAttribute("stroke-width", "1.5");
        line.setAttribute("opacity", "0.8");
      } else if (isOctave) {
        line.setAttribute("stroke", "#888888");
        line.setAttribute("stroke-width", "0.75");
        line.setAttribute("opacity", "0.6");
      } else {
        line.setAttribute("stroke", "#cccccc");
        line.setAttribute("stroke-width", "0.5");
        line.setAttribute("opacity", "0.5");
      }

      g.appendChild(line);

      // Semitone number label
      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", "4");
      text.setAttribute("y", String(y - 2));
      text.setAttribute("font-size", "9");
      text.setAttribute("font-family", "monospace");
      text.setAttribute("fill", isStaff ? "#4488cc" : "#aaaaaa");
      text.textContent = String(semi);
      g.appendChild(text);
    }

    svgParent.appendChild(g);
    return g;
  },

};
