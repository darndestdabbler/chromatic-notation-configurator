/**
 * cnb-grid.js — Module 1: Semitone Grid
 *
 * Coordinate system for all rendering modules.
 * Converts between semitone positions and pixel coordinates.
 * Renders a debug overlay for visual verification.
 *
 * Set 014 (pitch axis): axis-enabled contexts map semitones through
 * CNBPitchAxis (design docs/planning/pitch-axis-design.md §2.2) — the
 * axis formula for semiToY/svgHeight, yToAxis instead of a scalar
 * yToSemi (the inverse is many-to-one; callers use axis.semisAtPosition /
 * axis.nearestSemisForY), and the axis context exposed as `axis`.
 * Disabled/absent/inactive pitchAxis keeps the LITERAL pre-set-014 code
 * path and constructs no axis at all (design §1.3, deviation D3 —
 * byte-identity by construction, pinned against the pre-change baseline
 * fixture cnb/fixtures/grid-baseline.json).
 *
 * Depends on: Module A (cnb-config.js) — reads display settings;
 * Module 24 (cnb-pitch-axis.js) — axis contexts only.
 *
 * Part of the Chromatic Notation Builder modular architecture.
 */

import { CNBPitchAxis } from "./cnb-pitch-axis.js";

export const CNBGrid = {

  /**
   * Create a grid context from config and a semitone range.
   *
   * The grid maps semitone values to Y pixel positions.
   * Higher pitch = lower Y (standard music convention: high notes at top).
   *
   * @param {object} config   Full CNB config (reads config.display, config.pitchAxis)
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

    // ── Axis path (set 014) ──────────────────────────────────────────────
    // Consulted only when the section claims to be enabled; an inactive
    // axis (unknown kind, structurally unsound map) falls through to the
    // literal linear path below and exposes no axis at all.
    if (config.pitchAxis?.enabled === true) {
      const axis = CNBPitchAxis.create(config);
      if (axis.enabled) {
        // One axis unit renders at the px height one semitone renders on
        // the linear path (the design §1.2 unit contract).
        const pxPerAxisUnit = pxPerSemi;
        // PA-8 guarantees the map is globally non-decreasing, so the
        // range endpoints' positions are the extremes.
        const maxAxisPos = axis.positionOfSemi(maxSemi);
        const minAxisPos = axis.positionOfSemi(minSemi);

        const svgHeight   = (maxAxisPos - minAxisPos) * pxPerAxisUnit;
        const totalHeight = topLabelHeight + svgHeight + bottomLabelHeight;

        /**
         * Convert a semitone value to a Y pixel position within the SVG.
         * Grid placement goes through the axis: two semitones sharing an
         * axis position land on the same Y.
         * @param {number} semi
         * @returns {number}
         */
        function semiToY(semi) {
          return (maxAxisPos - axis.positionOfSemi(semi)) * pxPerAxisUnit;
        }

        /**
         * Convert a Y pixel position to an AXIS position. There is no
         * scalar yToSemi in axis contexts — the inverse is many-to-one;
         * use axis.semisAtPosition / axis.nearestSemisForY for candidates.
         * @param {number} y
         * @returns {number}
         */
        function yToAxis(y) {
          return maxAxisPos - y / pxPerAxisUnit;
        }

        return {
          pxPerSemi,
          minSemi,
          maxSemi,
          totalSemiRange,
          svgHeight,
          semiToY,
          yToAxis,
          axis,
          topLabelHeight,
          bottomLabelHeight,
          totalHeight,
        };
      }
    }

    // ── Linear path — the literal pre-set-014 body ───────────────────────
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
   *
   * Linear contexts (the literal pre-set-014 branch): faint lines at
   * every semitone, staff positions highlighted, octave boundaries
   * marked, semitone numbers labeled.
   *
   * Axis contexts: one line per DECLARED axis position, labeled with ALL
   * semitones mapping there (e.g. "0,1"); a position is highlighted as
   * staff/octave when any of its semitones is.
   *
   * @param {SVGElement} svgParent      The SVG element to render into
   * @param {object}     gridContext    From CNBGrid.create()
   * @param {number[]}   staffPositions Absolute semitone positions of staff lines
   * @returns {SVGGElement}
   */
  renderDebugOverlay(svgParent, gridContext, staffPositions = []) {
    const { minSemi, maxSemi, semiToY } = gridContext;
    const staffSet = new Set(staffPositions);

    const NS = "http://www.w3.org/2000/svg";
    const g  = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-debug-grid");

    const width = svgParent.getAttribute("width") || svgParent.viewBox?.baseVal?.width || 400;

    if (gridContext.axis && gridContext.axis.enabled) {
      // Group the range's integer semitones by declared axis position.
      const axis = gridContext.axis;
      const byPos = new Map();
      for (let semi = Math.ceil(minSemi); semi <= maxSemi; semi++) {
        const pos = axis.positionOfSemi(semi);
        if (!byPos.has(pos)) byPos.set(pos, []);
        byPos.get(pos).push(semi);
      }
      const positions = [...byPos.keys()].sort((a, b) => a - b);

      for (const pos of positions) {
        const semis = byPos.get(pos);
        const y = semiToY(semis[0]);
        const isStaff  = semis.some(s => staffSet.has(s));
        const isOctave = semis.some(s => s % 12 === 0);

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

        // Label: every semitone mapping to this axis position.
        const text = document.createElementNS(NS, "text");
        text.setAttribute("x", "4");
        text.setAttribute("y", String(y - 2));
        text.setAttribute("font-size", "9");
        text.setAttribute("font-family", "monospace");
        text.setAttribute("fill", isStaff ? "#4488cc" : "#aaaaaa");
        text.textContent = semis.join(",");
        g.appendChild(text);
      }

      svgParent.appendChild(g);
      return g;
    }

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
