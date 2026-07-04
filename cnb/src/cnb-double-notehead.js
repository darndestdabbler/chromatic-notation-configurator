/**
 * cnb-double-notehead.js — Module 7: Double Notehead
 *
 * Renders an octave pair of noteheads within a column, with an optional
 * horizontal offset for collision avoidance.
 *
 * The offset is expressed as a percentage of the notehead width (the wider
 * of the two, when they differ) and is split symmetrically: the lower note
 * shifts left of centerX by half the offset, the upper note shifts right by
 * half, keeping the pair centered on centerX.
 *
 * `lowerNote.shape` / `upperNote.shape` are shape config OBJECTS
 * (config.shapes[name]), not shape names — this module takes no config.
 *
 * Dependencies: Module 6 (notehead), Module 1 (grid context is passed in).
 */

import { CNBNotehead } from "./cnb-notehead.js";

export const CNBDoubleNotehead = {

  /**
   * Compute positions and scale factors for the pair (pure — no DOM).
   *
   * @param {object} gridContext  From CNBGrid.create()
   * @param {{lowerSemi:number, upperSemi:number,
   *          lowerNote:{shape:object}, upperNote:{shape:object},
   *          centerX:number, offsetPercent?:number}} opts
   * @returns {{lowerX:number, upperX:number, lowerY:number, upperY:number,
   *            lowerScale:number, upperScale:number}}
   */
  layout(gridContext, { lowerSemi, upperSemi, lowerNote, upperNote, centerX, offsetPercent = 0 }) {
    const lowerM = CNBNotehead.measure(lowerNote.shape, gridContext.pxPerSemi);
    const upperM = CNBNotehead.measure(upperNote.shape, gridContext.pxPerSemi);
    const refWidth = Math.max(lowerM.pixelWidth, upperM.pixelWidth);
    const offset = (offsetPercent / 100) * refWidth;
    return {
      lowerX: centerX - offset / 2,
      upperX: centerX + offset / 2,
      lowerY: gridContext.semiToY(lowerSemi),
      upperY: gridContext.semiToY(upperSemi),
      lowerScale: lowerM.scaleFactor,
      upperScale: upperM.scaleFactor,
    };
  },

  /**
   * Render the pair of noteheads. Lower is drawn first (upper paints on top
   * if they ever overlap).
   *
   * @param {SVGElement} svgParent
   * @param {object} gridContext
   * @param {{lowerSemi:number, upperSemi:number,
   *          lowerNote:{shape:object, hollow?:boolean, color?:string},
   *          upperNote:{shape:object, hollow?:boolean, color?:string},
   *          centerX:number, offsetPercent?:number}} opts
   * @returns {{lowerG:SVGGElement, upperG:SVGGElement, lowerY:number, upperY:number}}
   */
  render(svgParent, gridContext, opts) {
    const l = CNBDoubleNotehead.layout(gridContext, opts);

    const lowerG = CNBNotehead.render(svgParent, {
      shape: opts.lowerNote.shape,
      x: l.lowerX,
      y: l.lowerY,
      scaleFactor: l.lowerScale,
      hollow: !!opts.lowerNote.hollow,
      color: opts.lowerNote.color || "#000000",
    });

    const upperG = CNBNotehead.render(svgParent, {
      shape: opts.upperNote.shape,
      x: l.upperX,
      y: l.upperY,
      scaleFactor: l.upperScale,
      hollow: !!opts.upperNote.hollow,
      color: opts.upperNote.color || "#000000",
    });

    return { lowerG, upperG, lowerY: l.lowerY, upperY: l.upperY };
  },

};
