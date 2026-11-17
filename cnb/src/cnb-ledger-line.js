/**
 * cnb-ledger-line.js — Module 4: Ledger Line
 *
 * Pure SVG element factory for a single ledger line, as LilyPond draws one
 * (session 34): a black bar with fully rounded ends.
 * No dependencies.
 */

export const CNBLedgerLine = {
  /**
   * Render a ledger line (a rounded <rect>) into svgParent.
   *
   * @param {SVGElement} svgParent
   * @param {{y:number,centerX:number,width:number,thickness:number}} opts
   * @returns {SVGRectElement}
   */
  render(svgParent, { y, centerX, width, thickness }) {
    const NS = "http://www.w3.org/2000/svg";
    // Rect centered on (centerX, y); the rect body IS the line, so it is
    // filled and has no stroke (a stroke would add to the visual thickness).
    const elem = document.createElementNS(NS, "rect");
    elem.setAttribute("x", String(centerX - width / 2));
    elem.setAttribute("y", String(y - thickness / 2));
    elem.setAttribute("width", String(width));
    elem.setAttribute("height", String(thickness));
    elem.setAttribute("rx", String(thickness / 2));
    elem.setAttribute("ry", String(thickness / 2));
    elem.setAttribute("fill", "#000000");

    svgParent.appendChild(elem);
    return elem;
  },
};
