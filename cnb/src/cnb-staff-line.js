/**
 * cnb-staff-line.js — Module 2: Staff Line
 *
 * Pure SVG element factory for a single horizontal staff line.
 * This module has no external dependencies.
 */

export const CNBStaffLine = {
  /**
   * Render a horizontal staff line into the given SVG parent.
   *
   * @param {SVGElement} svgParent
   * @param {{y:number,x1:number,x2:number,thickness:number,color:string,style:string}} opts
   * @returns {SVGLineElement}
   */
  render(svgParent, { y, x1, x2, thickness, color, style }) {
    const NS = "http://www.w3.org/2000/svg";
    const line = document.createElementNS(NS, "line");

    line.setAttribute("x1", String(x1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", String(thickness));

    if (style === "dashed") {
      line.setAttribute("stroke-dasharray", "8,4");
    } else if (style === "dotted") {
      line.setAttribute("stroke-dasharray", "2,4");
    }

    svgParent.appendChild(line);
    return line;
  },
};
