/**
 * cnb-ledger-line.js — Module 4: Ledger Line
 *
 * Pure SVG element factory for a single ledger line. Supports optional rounded ends.
 * No dependencies.
 */

export const CNBLedgerLine = {
  /**
   * Render a ledger line (either <line> or rounded <rect>) into svgParent.
   *
   * @param {SVGElement} svgParent
   * @param {{y:number,centerX:number,width:number,thickness:number,color:string,style:string,roundedEnds:boolean}} opts
   * @returns {SVGElement}
   */
  render(svgParent, { y, centerX, width, thickness, color, style, roundedEnds }) {
    const NS = "http://www.w3.org/2000/svg";
    let elem;

    if (roundedEnds) {
      // Rect centered on (centerX, y); the rect body IS the line, so it is
      // filled with the line color and has no stroke (a stroke would add to
      // the visual thickness).
      elem = document.createElementNS(NS, "rect");
      const x = centerX - width / 2;
      const ytop = y - thickness / 2;
      elem.setAttribute("x", String(x));
      elem.setAttribute("y", String(ytop));
      elem.setAttribute("width", String(width));
      elem.setAttribute("height", String(thickness));
      elem.setAttribute("rx", String(thickness / 2));
      elem.setAttribute("ry", String(thickness / 2));
      elem.setAttribute("fill", color);
    } else {
      elem = document.createElementNS(NS, "line");
      elem.setAttribute("x1", String(centerX - width / 2));
      elem.setAttribute("x2", String(centerX + width / 2));
      elem.setAttribute("y1", String(y));
      elem.setAttribute("y2", String(y));
      elem.setAttribute("stroke", color);
      elem.setAttribute("stroke-width", String(thickness));
      if (style === "dashed") {
        elem.setAttribute("stroke-dasharray", "8,4");
      } else if (style === "dotted") {
        elem.setAttribute("stroke-dasharray", "2,4");
      }
    }

    svgParent.appendChild(elem);
    return elem;
  },
};
