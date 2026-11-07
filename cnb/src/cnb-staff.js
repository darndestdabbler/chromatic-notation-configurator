/**
 * cnb-staff.js — Module 3: Staff
 *
 * Uses staff pattern from configuration to compute absolute semitone positions
 * and render all staff lines across the SVG width.
 *
 * Dependencies: Module A (config), Module B (music) and Module 2 (staff line)
 *
 * Set 014 (pitch axis): axis-enabled grid contexts deduplicate lines by
 * axis position; linear contexts run the literal pre-set-014 loop.
 */

import { CNBConfig } from "./cnb-config.js";
import { CNBMusic } from "./cnb-music.js";
import { CNBStaffLine } from "./cnb-staff-line.js";

export const CNBStaff = {
  /**
   * Expand semitonePattern across octaves covering the given range.
   * @param {object} config
   * @param {{minSemi:number,maxSemi:number}} opts
   * @returns {number[]} sorted absolute semitone positions
   */
  getPositions(config, { minSemi, maxSemi }) {
    const pattern = (config.staff && config.staff.semitonePattern) || [];
    const result = [];
    const minOct = Math.floor(minSemi / 12) - 1;
    const maxOct = Math.floor(maxSemi / 12) + 1;
    for (let oct = minOct; oct <= maxOct; oct++) {
      for (const s of pattern) {
        const abs = s + oct * 12;
        if (abs >= minSemi && abs <= maxSemi) {
          result.push(abs);
        }
      }
    }
    return result.sort((a, b) => a - b);
  },

  /**
   * Return the staff midpoint value from config.
   */
  getMidpoint(config) {
    return config.staff && config.staff.midpoint;
  },

  /**
   * Render all staff lines into a group appended to svgParent. Each line
   * runs from x1 0 to x2 totalWidth.
   *
   * totalWidth may be the string "100%" (session 25): the fluid rows of the
   * editor's reflowing canvas (design §6.1) stretch the staff SVG to the
   * row, and every line then runs to the SVG's full width. An SVG with no
   * viewBox does not scale, so the stroke stays the same thickness.
   *
   * @param {SVGElement} svgParent
   * @param {object} gridContext
   * @param {object} config
   * @param {number|"100%"} totalWidth  px, or "100%"
   * @returns {SVGGElement}
   */
  render(svgParent, gridContext, config, totalWidth) {
    const positions = CNBStaff.getPositions(config, {
      minSemi: gridContext.minSemi,
      maxSemi: gridContext.maxSemi,
    });
    const overrides = (config.staff && config.staff.lineOverrides) || {};
    const defaults = (config.staff && config.staff.lineDefaults) || {};

    const NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-staff");

    // Axis path (set 014, design §2.3): pattern semitones collapsing onto
    // one axis position draw ONE line, their overrides merged (PA-6
    // guarantees they do not conflict).
    const axis = gridContext.axis;
    if (axis && axis.enabled) {
      const byPos = new Map();
      for (const abs of positions) {
        const pos = axis.positionOfSemi(abs);
        if (!byPos.has(pos)) byPos.set(pos, { abs, props: Object.assign({}, defaults) });
        Object.assign(byPos.get(pos).props, overrides[String(CNBMusic.pitchClass(abs))] || {});
      }
      for (const { abs, props } of byPos.values()) {
        CNBStaffLine.render(g, {
          y: gridContext.semiToY(abs),
          x1: 0,
          x2: totalWidth,
          thickness: CNBConfig.pctToPx(props.thicknessPct, gridContext.pxPerSemi),
          color: props.color,
          style: props.style,
        });
      }
      svgParent.appendChild(g);
      return g;
    }

    // Linear path — the literal pre-set-014 loop.
    for (const abs of positions) {
      const pc = abs % 12;
      const props = Object.assign({}, defaults, overrides[String(pc)] || {});
      const thicknessPx = CNBConfig.pctToPx(props.thicknessPct, gridContext.pxPerSemi);
      const y = gridContext.semiToY(abs);
      CNBStaffLine.render(g, {
        y,
        x1: 0,
        x2: totalWidth,
        thickness: thicknessPx,
        color: props.color,
        style: props.style,
      });
    }

    svgParent.appendChild(g);
    return g;
  },
};
