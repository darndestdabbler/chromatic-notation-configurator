/**
 * cnb-notehead.js — Module 6: Notehead
 *
 * Computes sizing and renders a single notehead shape. Relies on shape data from
 * the configuration module. Since session 55 it also holds the SVG path
 * parser and the exact path extent the exporter and the key signature share
 * (CNBNotehead.box).
 *
 * Dependencies: Module A (cnb-config.js) for config shape structure.
 */

// ─── SVG path data (moved from Module 11 in session 55) ─────────────────────

/**
 * Parse an SVG path `d` attribute string into a command array.
 * Handles absolute M, L, C, Z (H, V for robustness). Relative commands and
 * arcs are expected to have been normalized upstream (Baker/toolkit output).
 * Ported verbatim from legacy parseSvgPath().
 */
function parseSvgPath(d) {
  if (!d || typeof d !== "string") return [];

  const commands = [];
  const re = /([MLCSQTAHVZmlcsqtahvz])([^MLCSQTAHVZmlcsqtahvz]*)/g;
  let match;

  while ((match = re.exec(d)) !== null) {
    const cmd = match[1];
    const argStr = match[2].trim();
    const args = argStr.length > 0
      ? argStr.split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
      : [];
    commands.push({ cmd, args });
  }

  return commands;
}

/**
 * An SVG path `d` string as LilyPond path commands (moveto, lineto, curveto,
 * closepath) in the SVG's own units, Y down: absolute M/L/C/Z, with H/V
 * folded into lineto at the tracked position. Unsupported commands (S, Q,
 * T, A, relatives) are skipped — the toolkit normalizes paths to absolute
 * M/L/C/Z before they reach a config.
 */
function svgCommands(svgPath) {
  const commands = [];
  let curX = 0, curY = 0;
  for (const { cmd, args } of parseSvgPath(svgPath)) {
    switch (cmd) {
      case "M":
        commands.push({ cmd: "moveto", args: [args[0], args[1]] });
        curX = args[0]; curY = args[1];
        break;
      case "L":
        commands.push({ cmd: "lineto", args: [args[0], args[1]] });
        curX = args[0]; curY = args[1];
        break;
      case "H":
        commands.push({ cmd: "lineto", args: [args[0], curY] });
        curX = args[0];
        break;
      case "V":
        commands.push({ cmd: "lineto", args: [curX, args[0]] });
        curY = args[0];
        break;
      case "C":
        commands.push({ cmd: "curveto", args: args.slice(0, 6) });
        curX = args[4]; curY = args[5];
        break;
      case "Z":
      case "z":
        commands.push({ cmd: "closepath", args: [] });
        break;
      default:
        break;
    }
  }
  return commands;
}

/**
 * The exact extent of path commands, as LilyPond's make-path-stencil
 * measures it: every line segment's end points and every curve's true
 * extremes (where its derivative is zero), not its control points.
 * @returns {{x:[number,number], y:[number,number]}}
 */
function pathExtent(commands) {
  const x = [Infinity, -Infinity], y = [Infinity, -Infinity];
  const add = (px, py) => {
    x[0] = Math.min(x[0], px); x[1] = Math.max(x[1], px);
    y[0] = Math.min(y[0], py); y[1] = Math.max(y[1], py);
  };
  // Parameters in (0, 1) where one coordinate of a cubic Bézier is extreme.
  const extremes = (p0, p1, p2, p3) => {
    const a = p1 - p0, b = p2 - p1, c = p3 - p2;
    const A = a - 2 * b + c, B = 2 * (b - a), C = a;
    const roots = Math.abs(A) < 1e-12
      ? (Math.abs(B) < 1e-12 ? [] : [-C / B])
      : (() => {
          const d = B * B - 4 * A * C;
          if (d < 0) return [];
          const s = Math.sqrt(d);
          return [(-B + s) / (2 * A), (-B - s) / (2 * A)];
        })();
    return roots.filter(t => t > 0 && t < 1);
  };
  const bezier = (p0, p1, p2, p3, t) =>
    (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;

  let cx = 0, cy = 0, ox = 0, oy = 0;
  for (const { cmd, args } of commands) {
    if (cmd === "moveto") {
      [cx, cy] = args; ox = cx; oy = cy;
    } else if (cmd === "lineto") {
      add(cx, cy); add(args[0], args[1]);
      [cx, cy] = args;
    } else if (cmd === "curveto") {
      const [x1, y1, x2, y2, x3, y3] = args;
      add(cx, cy); add(x3, y3);
      for (const t of [...extremes(cx, x1, x2, x3), ...extremes(cy, y1, y2, y3)]) {
        add(bezier(cx, x1, x2, x3, t), bezier(cy, y1, y2, y3, t));
      }
      cx = x3; cy = y3;
    } else if (cmd === "closepath") {
      add(cx, cy); add(ox, oy);
      cx = ox; cy = oy;
    }
  }
  return { x, y };
}

export const CNBNotehead = {
  parseSvgPath,
  svgCommands,
  pathExtent,

  /**
   * A shape's box: the exact extent of its svgPath (pathExtent), in its
   * native SVG units, Y down, around its origin. The key signature measures a
   * symbol placed by its origin with it (session 55), since such a symbol's
   * box need not be centred on its origin, as a dot's tail is not.
   *
   * @param {object} shape  config.shapes entry
   * @returns {{x:[number,number], y:[number,number]}}
   */
  box(shape) {
    return pathExtent(svgCommands(shape.svgPath));
  },

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
   * How far a notehead is drawn below its pitch, in px, so that its shape's
   * reference point (shape.reference, native SVG units, Y down) sits on the
   * pitch vertically (session 60): −reference.y × scaleY. 0 for a shape
   * without a reference, or with reference.y 0. The reference's x is not
   * applied: a notehead stays centred on its column.
   *
   * @param {object} shape   Shape config object
   * @param {number} scaleY  the notehead's vertical scale (measure's scaleY)
   * @returns {number} px, SVG y down
   */
  referenceShift(shape, scaleY) {
    const y = shape && shape.reference ? shape.reference.y : 0;
    return y ? -y * scaleY : 0;
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
