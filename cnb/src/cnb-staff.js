/**
 * cnb-staff.js — Module 3: Staff
 *
 * Uses staff pattern from configuration to compute absolute semitone positions
 * and render all staff lines across the SVG width, as the engine draws them
 * (session 34): no config setting styles them.
 *
 * Dependencies: Module 24 (pitch axis) and Module 2 (staff line)
 *
 * Set 014 (pitch axis): axis-enabled grid contexts draw one line per axis
 * position.
 */

import { CNBPitchAxis } from "./cnb-pitch-axis.js";
import { CNBStaffLine } from "./cnb-staff-line.js";

// The engine leaves LilyPond's staff lines alone: 0.1 staff spaces thick,
// black and solid (session 34, measured against the engine).
const STAFF_LINE_THICKNESS = 0.1;

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
   * The staff's lines as LilyPond staff positions, the values exported as
   * cnb:staff-line-positions: semitonePattern expanded across the 24
   * semitones centred on the midpoint (midpoint − 12 ≤ S < midpoint + 12;
   * octaves 0 and 1 at the default midpoint 12 — session 28, LY spec 1.3.5
   * §5.1a), then 2 × (S − midpoint) / semitonesPerStaffSpace — LilyPond
   * staff positions are HALF-staff-spaces from center (LY spec §5.1; engine
   * cnb/config.ly). 4-8 system, midpoint 12, sps 4 → [-4, -2, 2, 4];
   * 3-6-9, midpoint 12, sps 3 → [-6, -4, -2, 2, 4, 6] (007-s1 D2).
   * Non-integer results are kept as decimals (plan open question 7).
   * Under an enabled pitch axis the v1.3 §5.4a axis formula applies instead:
   * 2 × (pos(S) − pos(midpoint)) / axisUnitsPerStaffSpace, deduplicated
   * (pattern lines may collapse onto one axis position) and sorted.
   *
   * @param {object} config
   * @returns {number[]}
   */
  lilypondPositions(config) {
    const staff = config.staff || {};
    const pattern = (staff.semitonePattern || []).slice().sort((a, b) => a - b);
    const midpoint = staff.midpoint || 0;

    // So moving the pitch (staff.midpoint and the pattern together, design
    // §3.1) never brings a line back at the other edge.
    const staffSemis = [];
    for (let oct = Math.floor((midpoint - 12) / 12); oct <= Math.floor((midpoint + 12) / 12); oct++) {
      for (const s of pattern) {
        const abs = s + oct * 12;
        if (abs >= midpoint - 12 && abs < midpoint + 12) staffSemis.push(abs);
      }
    }

    const unique = new Set(staffSemis.map(abs => CNBStaff.lilypondPosition(config, abs)));
    return [...unique].sort((a, b) => a - b);
  },

  /**
   * A semitone's LilyPond staff position: half staff spaces above the
   * middle of the staff, 2 × (S − midpoint) / semitonesPerStaffSpace, or
   * under an enabled pitch axis 2 × (pos(S) − pos(midpoint)) /
   * axisUnitsPerStaffSpace (LY spec §5.1, §5.4a).
   *
   * @param {object} config
   * @param {number} semi
   * @returns {number}
   */
  lilypondPosition(config, semi) {
    const staff = config.staff || {};
    const midpoint = staff.midpoint || 0;
    const axis = CNBPitchAxis.create(config);
    if (axis.enabled) {
      return 2 * (axis.positionOfSemi(semi) - axis.positionOfSemi(midpoint)) / axis.unitsPerStaffSpace;
    }
    return 2 * (semi - midpoint) / (staff.semitonesPerStaffSpace || 1);
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
    const thickness = STAFF_LINE_THICKNESS * CNBStaff.staffSpacePx(config, gridContext);

    const NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-staff");

    // Pattern semitones collapsing onto one axis position draw ONE line
    // (set 014, design §2.3).
    const ys = new Set(positions.map(abs => gridContext.semiToY(abs)));
    for (const y of ys) {
      CNBStaffLine.render(g, { y, x1: 0, x2: totalWidth, thickness });
    }

    svgParent.appendChild(g);
    return g;
  },

  /**
   * Pixels per staff space on a grid: one staff space is
   * staff.semitonesPerStaffSpace semitones, or
   * pitchAxis.axisUnitsPerStaffSpace axis units under an enabled pitch axis,
   * and the grid draws pxPerSemi px per unit.
   *
   * @param {object} config
   * @param {object} gridContext  from CNBGrid.create()
   * @returns {number}
   */
  staffSpacePx(config, gridContext) {
    const axis = gridContext.axis;
    const units = axis && axis.enabled
      ? axis.unitsPerStaffSpace
      : ((config.staff && config.staff.semitonesPerStaffSpace) || 1);
    return gridContext.pxPerSemi * units;
  },
};
