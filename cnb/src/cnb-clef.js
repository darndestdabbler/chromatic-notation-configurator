/**
 * cnb-clef.js — Clef renderer (set 009)
 *
 * Renders the active clef glyph into a left gutter column, vertically
 * positioned on the semitone grid. Pure config-in/DOM-out: no state, no
 * event listeners.
 *
 * Anchoring model (set 009 s1 decision): a clef definition's `anchorSemi`
 * is the semitone position of the glyph's TOP edge, and it is a FLOAT.
 * Surveyed designs (Bravura gClef, Clairnote 2017 clefs, Express Stave
 * F/B/D) all register clefs by an interior musical reference point, which
 * puts the bounding-box top at a fractional grid offset — so integer-only
 * top anchoring cannot express them. Any interior-point registration
 * reduces to a fractional top anchor: anchorSemi = markedPitchSemi + k,
 * where k is the (possibly fractional) semitone distance from the glyph
 * top down to the marking feature.
 *
 * Two definition kinds:
 *   kind "glyph" — imported SVG path (toolkit contract: svgPath, natural
 *                  dimensions, semitoneHeight, optional viewBox min offsets)
 *   kind "text"  — register label (octave numeral/letter, E1 catalog
 *                  records 20/40); rendered as an SVG <text> whose em-box
 *                  is textHeightSemis tall. Numerals have no descenders,
 *                  so the visual top sits slightly below the anchor
 *                  (cap-height < em-height) — an accepted approximation,
 *                  verified visually on the test page.
 *
 * Dependencies: Module 1 (grid context passed in), Module A (clef schema).
 */

const NS = "http://www.w3.org/2000/svg";

export const CNBClef = {

  /**
   * Resolve the active clef definition, or null when the clef is disabled
   * or the reference is missing/unknown.
   *
   * @param {object} config
   * @returns {{name:string, def:object}|null}
   */
  activeGlyph(config) {
    const clef = config.clef || {};
    if (!clef.enabled || !clef.active) return null;
    const def = (clef.glyphs || {})[clef.active];
    return def ? { name: clef.active, def } : null;
  },

  /**
   * Compute pixel dimensions for a clef definition.
   * Glyph kind mirrors CNBNotehead.measure; text kind sizes the em-box
   * from textHeightSemis and estimates width per glyph at 0.6 em.
   *
   * @param {object} def        clef.glyphs[name] entry
   * @param {number} pxPerSemi
   * @returns {{scaleFactor:number, pixelWidth:number, pixelHeight:number}}
   */
  measure(def, pxPerSemi) {
    if ((def.kind || "glyph") === "text") {
      const pixelHeight = (def.textHeightSemis || 0) * pxPerSemi;
      const pixelWidth = 0.6 * pixelHeight * String(def.text || "").length;
      return { scaleFactor: 1, pixelWidth, pixelHeight };
    }
    const scaleFactor = (def.semitoneHeight * pxPerSemi) / def.naturalHeight;
    return {
      scaleFactor,
      pixelWidth: def.naturalWidth * scaleFactor,
      pixelHeight: def.naturalHeight * scaleFactor,
    };
  },

  /**
   * Total width of the clef gutter in px: active glyph width plus the
   * configured horizontal padding on both sides. 0 when no clef renders —
   * the collection reserves no gutter (default-off compatibility).
   *
   * @param {object} config
   * @param {number} pxPerSemi
   * @returns {number}
   */
  gutterWidth(config, pxPerSemi) {
    const active = CNBClef.activeGlyph(config);
    if (!active) return 0;
    const paddingH = config.clef?.gutter?.paddingH ?? 12;
    return CNBClef.measure(active.def, pxPerSemi).pixelWidth + 2 * paddingH;
  },

  /**
   * Render the active clef into svgParent. The glyph's TOP edge is placed
   * at semiToY(anchorSemi); the left edge sits at gutter.paddingH.
   * Returns null (rendering nothing) when no clef is active.
   *
   * @param {SVGElement} svgParent
   * @param {object} gridContext   From CNBGrid.create()
   * @param {object} config
   * @returns {SVGGElement|null}
   */
  render(svgParent, gridContext, config) {
    const active = CNBClef.activeGlyph(config);
    if (!active) return null;
    const { def } = active;

    const paddingH = config.clef?.gutter?.paddingH ?? 12;
    const topY = gridContext.semiToY(def.anchorSemi);
    const { scaleFactor, pixelHeight } = CNBClef.measure(def, gridContext.pxPerSemi);

    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-clef");
    g.setAttribute("transform", `translate(${paddingH},${topY})`);

    if ((def.kind || "glyph") === "text") {
      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", "0");
      text.setAttribute("y", String(pixelHeight));
      text.setAttribute("font-size", String(pixelHeight));
      text.setAttribute("font-family", def.fontFamily || "Georgia, serif");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("fill", def.color || "#000000");
      text.textContent = def.text;
      g.appendChild(text);
    } else {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", def.svgPath);
      // Right-to-left: shift the viewBox origin to (0,0), then scale to
      // pixels — so the glyph's top-left corner lands exactly on the g's
      // translate target regardless of the SVG's coordinate convention
      // (toolkit noteheads are origin-centered; other sources may not be).
      const minX = def.viewBoxMinX || 0;
      const minY = def.viewBoxMinY || 0;
      path.setAttribute("transform", `scale(${scaleFactor}) translate(${-minX},${-minY})`);
      path.setAttribute("fill", def.color || "#000000");
      g.appendChild(path);
    }

    svgParent.appendChild(g);
    return g;
  },

};
