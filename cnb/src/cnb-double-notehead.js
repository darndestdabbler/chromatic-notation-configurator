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
   * lowerOffsetPx / upperOffsetPx (set 014, design §2.3) are per-note
   * horizontal shifts in px, ADDED to the symmetric offsetPercent result
   * (the pitch-axis xOffsetStaffSpaces disambiguation; default 0).
   *
   * lowerNote.size / upperNote.size (session 22) are each note's resolved
   * { heightSemis, widthSemis } (absent = the shape's own size); the
   * offset reference width is the resolved width.
   *
   * lowerY / upperY are where each head's origin is drawn: its pitch, moved
   * so that its shape's reference point is on the pitch (session 60,
   * CNBNotehead.referenceShift); the pitch itself without a reference.
   *
   * @param {object} gridContext  From CNBGrid.create()
   * @param {{lowerSemi:number, upperSemi:number,
   *          lowerNote:{shape:object, size?:object}, upperNote:{shape:object, size?:object},
   *          centerX:number, offsetPercent?:number,
   *          lowerOffsetPx?:number, upperOffsetPx?:number}} opts
   * @returns {{lowerX:number, upperX:number, lowerY:number, upperY:number,
   *            lowerScale:number, upperScale:number,
   *            lowerScaleX:number, lowerScaleY:number, upperScaleX:number, upperScaleY:number}}
   */
  layout(gridContext, {
    lowerSemi, upperSemi, lowerNote, upperNote, centerX, offsetPercent = 0,
    lowerOffsetPx = 0, upperOffsetPx = 0,
  }) {
    const lowerM = CNBNotehead.measure(lowerNote.shape, gridContext.pxPerSemi, lowerNote.size);
    const upperM = CNBNotehead.measure(upperNote.shape, gridContext.pxPerSemi, upperNote.size);
    const refWidth = Math.max(lowerM.pixelWidth, upperM.pixelWidth);
    const offset = (offsetPercent / 100) * refWidth;
    return {
      lowerX: centerX - offset / 2 + lowerOffsetPx,
      upperX: centerX + offset / 2 + upperOffsetPx,
      lowerY: gridContext.semiToY(lowerSemi) + CNBNotehead.referenceShift(lowerNote.shape, lowerM.scaleY),
      upperY: gridContext.semiToY(upperSemi) + CNBNotehead.referenceShift(upperNote.shape, upperM.scaleY),
      lowerScale: lowerM.scaleFactor,
      upperScale: upperM.scaleFactor,
      lowerScaleX: lowerM.scaleX,
      lowerScaleY: lowerM.scaleY,
      upperScaleX: upperM.scaleX,
      upperScaleY: upperM.scaleY,
    };
  },

  /**
   * Render the pair of noteheads. Lower is drawn first (upper paints on top
   * if they ever overlap).
   *
   * @param {SVGElement} svgParent
   * @param {object} gridContext
   * @param {{lowerSemi:number, upperSemi:number,
   *          lowerNote:{shape:object, hollow?:boolean, color?:string, size?:object},
   *          upperNote:{shape:object, hollow?:boolean, color?:string, size?:object},
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
      scaleX: l.lowerScaleX,
      scaleY: l.lowerScaleY,
      hollow: !!opts.lowerNote.hollow,
      color: opts.lowerNote.color || "#000000",
    });

    const upperG = CNBNotehead.render(svgParent, {
      shape: opts.upperNote.shape,
      x: l.upperX,
      y: l.upperY,
      scaleFactor: l.upperScale,
      scaleX: l.upperScaleX,
      scaleY: l.upperScaleY,
      hollow: !!opts.upperNote.hollow,
      color: opts.upperNote.color || "#000000",
    });

    return { lowerG, upperG, lowerY: l.lowerY, upperY: l.upperY };
  },

};
