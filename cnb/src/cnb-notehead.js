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
   * Compute scale factors and pixel dimensions based on a shape and pxPerSemi.
   *
   * size (session 22) is the resolved notehead size in semitones,
   * { heightSemis, widthSemis }; a missing or null value means the shape's
   * own semitoneHeight / natural width. scaleY follows the height, scaleX
   * the width, and scaleFactor is scaleY. With no size, scaleX === scaleY
   * and the result is what it always was.
   *
   * @param {object} shape           Shape config object
   * @param {number} pxPerSemi       Pixels per semitone (from gridContext)
   * @param {{heightSemis?:number|null, widthSemis?:number|null}} [size]
   * @returns {{scaleFactor:number,scaleX:number,scaleY:number,pixelWidth:number,pixelHeight:number}}
   */
  measure(shape, pxPerSemi, size = {}) {
    const ownScale = (shape.semitoneHeight * pxPerSemi) / shape.naturalHeight;
    const scaleY = size.heightSemis != null ? (size.heightSemis * pxPerSemi) / shape.naturalHeight : ownScale;
    const scaleX = size.widthSemis != null ? (size.widthSemis * pxPerSemi) / shape.naturalWidth : ownScale;
    const pixelHeight = shape.naturalHeight * scaleY;
    const pixelWidth = shape.naturalWidth * scaleX;
    return { scaleFactor: scaleY, scaleX, scaleY, pixelWidth, pixelHeight };
  },

  /**
   * Render the notehead at position (x,y). The caller is responsible for
   * computing the appropriate scaleFactor (use `measure`). Optional scaleX /
   * scaleY (session 22) stretch a sized notehead; when they are equal or
   * absent the transform is scale(scaleFactor), as before.
   *
   * @param {SVGElement} svgParent
   * @param {{shape:object,x:number,y:number,scaleFactor:number,scaleX?:number,scaleY?:number,
   *          hollow:boolean,color:string}} opts
   * @returns {SVGGElement}
   */
  render(svgParent, { shape, x, y, scaleFactor, scaleX, scaleY, hollow, color }) {
    const NS = "http://www.w3.org/2000/svg";
    const sx = scaleX ?? scaleFactor;
    const sy = scaleY ?? scaleFactor;
    const scale = sx === sy ? `scale(${scaleFactor})` : `scale(${sx},${sy})`;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("transform", `translate(${x},${y})`);

    const main = document.createElementNS(NS, "path");
    main.setAttribute("d", shape.svgPath);
    main.setAttribute("transform", scale);
    main.setAttribute("fill", color);
    g.appendChild(main);

    if (hollow && shape.svgHollowPath) {
      const hollowPath = document.createElementNS(NS, "path");
      hollowPath.setAttribute("d", shape.svgHollowPath);
      hollowPath.setAttribute("transform", scale);
      hollowPath.setAttribute("fill", "white");
      g.appendChild(hollowPath);
    }

    svgParent.appendChild(g);
    return g;
  },
};
