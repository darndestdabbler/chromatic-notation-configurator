/**
 * cnb-notehead.js — Module 6: Notehead
 *
 * Computes sizing and renders a single notehead shape. Relies on shape data from
 * the configuration module.
 *
 * Dependencies: Module A (cnb-config.js) for config shape structure.
 */

export const CNBNotehead = {
  /**
   * Compute scale factor and pixel dimensions based on a shape and pxPerSemi.
   *
   * @param {object} shape           Shape config object
   * @param {number} pxPerSemi       Pixels per semitone (from gridContext)
   * @returns {{scaleFactor:number,pixelWidth:number,pixelHeight:number}}
   */
  measure(shape, pxPerSemi) {
    const scaleFactor = (shape.semitoneHeight * pxPerSemi) / shape.naturalHeight;
    const pixelHeight = shape.naturalHeight * scaleFactor;
    const pixelWidth = shape.naturalWidth * scaleFactor;
    return { scaleFactor, pixelWidth, pixelHeight };
  },

  /**
   * Render the notehead at position (x,y). The caller is responsible for
   * computing the appropriate scaleFactor (use `measure`).
   *
   * @param {SVGElement} svgParent
   * @param {{shape:object,x:number,y:number,scaleFactor:number,hollow:boolean,color:string}} opts
   * @returns {SVGGElement}
   */
  render(svgParent, { shape, x, y, scaleFactor, hollow, color }) {
    const NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("transform", `translate(${x},${y})`);

    const main = document.createElementNS(NS, "path");
    main.setAttribute("d", shape.svgPath);
    main.setAttribute("transform", `scale(${scaleFactor})`);
    main.setAttribute("fill", color);
    g.appendChild(main);

    if (hollow && shape.svgHollowPath) {
      const hollowPath = document.createElementNS(NS, "path");
      hollowPath.setAttribute("d", shape.svgHollowPath);
      hollowPath.setAttribute("transform", `scale(${scaleFactor})`);
      hollowPath.setAttribute("fill", "white");
      g.appendChild(hollowPath);
    }

    svgParent.appendChild(g);
    return g;
  },
};
