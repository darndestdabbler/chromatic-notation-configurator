/**
 * svg-importer.js — Module 16: SVG Shape Importer
 *
 * Reads SVG files exported by the Music Glyph Toolkit (Inkscape extension)
 * and builds a `config.shapes[name]` entry per the Module A schema
 * (architecture plan §4.2).
 *
 * Data contract (re-validated 2026-07-05 against the toolkit's
 * `music_glyph_toolkit.py`, the authority per this set's spec):
 *
 *   - `#notehead` path carries `data-semitone-height` and (opt-in)
 *     `data-lilypond-notehead`; `#hollow` carries (opt-in)
 *     `data-lilypond-hollow` (LY spec §7.2 — these ARE emitted today).
 *   - The `data-stem-up-x/y` / `data-stem-down-x/y` attributes documented in
 *     LY spec §7.1 are NOT emitted by the current toolkit — it actively
 *     removes them as stale output of prior versions. Stem attachment is
 *     conveyed instead by `<rect id="stem-up">` / `<rect id="stem-down">`
 *     placemarker geometry: the attachment point is the bottom-center of
 *     the stem-up rect and the top-center of the stem-down rect (matches
 *     legacy computeStemAnchorsFromRects()).
 *   - Optional minim pair (toolkit session 4): `<rect id="stem-minim-up">` /
 *     `<rect id="stem-minim-down">`, user-drawn, read with the same rule into
 *     anchors.minimUp/minimDown. Absent (or only half present, with a
 *     warning) → the minim anchors copy the crotchet anchors.
 *   - A stem rect's own `transform` attribute, composed with its ancestors'
 *     (session 62), is applied before its anchor is read (toolkit audit M8:
 *     Inkscape stores a flipped rect as raw geometry plus scale(-1)); the
 *     anchor comes from the rect's own ends mapped through it, so a rotated
 *     rect anchors at its end (session 11 review). One the importer cannot
 *     read is an import error.
 *   - The toolkit normalizes shapes to 100 SVG units per semitone, centered
 *     on the origin, and sets the root viewBox to the exact notehead bounds.
 *     Pre-baked LilyPond paths are SVG coordinates ÷ 100 with Y negated.
 *
 * A file drawn by hand imports where it was drawn (session 62, step-by-step
 * design §8). Each imported path (the notehead, its hollow, a clef's glyph
 * paths) is stored in the root <svg>'s units, the viewBox's: its d is
 * normalised once, at import, to absolute M, L, C and Z (normalizePath:
 * every SVG 1.1 command, each arc as cubics within 0.01 units), with the
 * composed transform of the element and every ancestor up to the root
 * applied (matrix, translate, scale, rotate, skewX, skewY). A rect, circle,
 * ellipse, polygon or polyline is read as the path it draws (shapeToPath).
 * The stem rects go through the same transforms, and the reference points
 * the panels set (a clef's box centre, a symbol's origin) are in the same
 * units, so all of them sit on the ink as drawn. A path with no transform
 * on it or its ancestors whose commands are all absolute M, L, H, V, C or Z,
 * as toolkit output always is, is stored exactly as it is. Refused, naming
 * the element and what to do in Inkscape: <text> (Object to Path), a path
 * with no fill, drawn by its stroke (Stroke to Path), <use>, <image>, a
 * nested <svg>, and clip-path, mask or filter on an imported element or an
 * ancestor. Nothing a file refers to is fetched.
 *
 * Parsing/extraction is pure: `extract()` takes any Document-like object
 * (real DOMParser output or a test stub exposing getElementById /
 * querySelector / getAttribute) and `buildShape()` takes plain data.
 * Only `parseSvgText()` touches DOMParser; file-picker wiring lives in the
 * test page / app layer.
 *
 * Pre-baked `data-lilypond-*` paths are parsed, never passed through as
 * text: one that does not parse is an import error, and one that does is
 * stored re-serialized from its numbers (audit 2026-11-02, H1).
 *
 * Dependencies: cnb-scheme.js (path parsing); Module A schema is a
 * structural contract only.
 */

import { CNBScheme } from "../src/cnb-scheme.js";

// SVG units per semitone in Music Glyph Toolkit output (TARGET_HEIGHT = S × 100)
const TOOLKIT_UNITS_PER_SEMITONE = 100;

/**
 * A pre-baked LilyPond path attribute, parsed and re-serialized from its
 * numbers. Absent → { path: null }; unparseable → { error } naming the
 * attribute.
 */
function prebakedPath(text, attr) {
  if (!text) return { path: null, error: null };
  const commands = CNBScheme.parsePath(text);
  if (!commands) {
    return {
      path: null,
      error: `${attr} is not valid LilyPond path data (only moveto, lineto, ` +
        "curveto and closepath with numbers are accepted) — not imported",
    };
  }
  return { path: CNBScheme.path(commands, attr), error: null };
}

/** The product m·n of two parseTransform matrices (n applies first). */
function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],        m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],        m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

const IDENTITY = [1, 0, 0, 1, 0, 0];

/**
 * Parse an SVG `transform` list of matrix(a b c d e f), translate(tx [ty]),
 * scale(sx [sy]), rotate(deg [cx cy]), skewX(deg) and skewY(deg), composed
 * in order (the rightmost function applies first, per SVG), into one matrix
 * [a, b, c, d, e, f] with x' = a·x + c·y + e and y' = b·x + d·y + f. A
 * blank transform is the identity; one that does not parse is null.
 */
function parseTransform(transform) {
  const text = transform === null || transform === undefined ? "" : String(transform);
  let m = IDENTITY;
  const re = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)\s*,?/gy;
  let pos = 0;
  let match;
  while (pos < text.length && (match = re.exec(text)) !== null) {
    pos = re.lastIndex;
    const argText = match[2].trim();
    const args = argText === "" ? [] : argText.split(/[\s,]+/).map(Number);
    if (args.some(n => !Number.isFinite(n))) return null;
    const n = args.length;
    let t;
    switch (match[1]) {
      case "matrix":
        if (n !== 6) return null;
        t = args;
        break;
      case "translate":
        if (n !== 1 && n !== 2) return null;
        t = [1, 0, 0, 1, args[0], n === 2 ? args[1] : 0];
        break;
      case "scale":
        if (n !== 1 && n !== 2) return null;
        t = [args[0], 0, 0, n === 2 ? args[1] : args[0], 0, 0];
        break;
      case "rotate": {
        if (n !== 1 && n !== 3) return null;
        const rad = args[0] * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        t = [cos, sin, -sin, cos, 0, 0];
        if (n === 3) {
          t = mul(mul([1, 0, 0, 1, args[1], args[2]], t), [1, 0, 0, 1, -args[1], -args[2]]);
        }
        break;
      }
      case "skewX":
      case "skewY": {
        if (n !== 1) return null;
        const tan = Math.tan(args[0] * Math.PI / 180);
        t = match[1] === "skewX" ? [1, 0, tan, 1, 0, 0] : [1, tan, 0, 1, 0, 0];
        break;
      }
    }
    m = mul(m, t);
  }
  return text.slice(pos).trim() === "" ? m : null;
}

/** Drop float noise (cos 90°) and -0. */
function clean(v) {
  return roundTo(v, 9) + 0;
}

/** A point through a parseTransform matrix. */
function applyTransform(m, x, y) {
  return { x: clean(m[0] * x + m[2] * y + m[4]), y: clean(m[1] * x + m[3] * y + m[5]) };
}

function roundTo(value, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

// ─── Path normalisation (session 62, step-by-step design §8) ────────────────

// Each command's number of arguments, by its upper-case letter.
const PATH_ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/**
 * Tokenise SVG path data into [{ cmd, args }], each command repeated as
 * often as its arguments run (an M's extra pairs as L, an m's as l), or
 * null when it does not parse. Arc flags may be written without separators
 * ("a1 1 0 01 2 2").
 */
function tokenizePath(d) {
  const text = String(d);
  const number = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  const out = [];
  let i = 0;
  const skip = () => { while (i < text.length && /[\s,]/.test(text[i])) i++; };
  skip();
  if (i >= text.length || !/[Mm]/.test(text[i])) return null;
  while (i < text.length) {
    const cmd = text[i];
    const upper = cmd.toUpperCase();
    if (!(upper in PATH_ARITY)) return null;
    i++;
    const arity = PATH_ARITY[upper];
    let first = true;
    for (;;) {
      skip();
      if (arity === 0 || i >= text.length || /[A-Za-z]/.test(text[i])) {
        if (first && arity !== 0) return null;   // a command with no arguments
        if (arity === 0) out.push({ cmd, args: [] });
        break;
      }
      const args = [];
      for (let k = 0; k < arity; k++) {
        skip();
        if (upper === "A" && (k === 3 || k === 4)) {
          if (text[i] !== "0" && text[i] !== "1") return null;
          args.push(Number(text[i++]));
          continue;
        }
        number.lastIndex = i;
        const m = number.exec(text);
        if (!m) return null;
        args.push(Number(m[0]));
        i = number.lastIndex;
      }
      if (args.some(n => !Number.isFinite(n))) return null;
      const repeat = first ? cmd : (upper === "M" ? (cmd === "M" ? "L" : "l") : cmd);
      out.push({ cmd: repeat, args });
      first = false;
    }
  }
  return out;
}

/** The largest singular value of a matrix's linear part (its greatest stretch). */
function maxStretch(m) {
  const s = m[0] * m[0] + m[1] * m[1] + m[2] * m[2] + m[3] * m[3];
  const det = m[0] * m[3] - m[1] * m[2];
  return Math.sqrt((s + Math.sqrt(Math.max(0, s * s - 4 * det * det))) / 2);
}

/**
 * An SVG arc from (x1, y1), its radii nonzero, as cubic Béziers [[c1x, c1y, c2x, c2y, x, y], …]
 * in the arc's own (untransformed) coordinates, with enough of them that,
 * once a matrix stretching by at most `stretch` is applied, each lies within
 * 0.01 units of the true arc (SVG 1.1 implementation notes F.6.5, F.6.6).
 */
function arcToCubics(x1, y1, rx, ry, phiDeg, largeArc, sweep, x2, y2, stretch) {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = phiDeg * Math.PI / 180;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) { const r = Math.sqrt(lambda); rx *= r; ry *= r; }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (largeArc === sweep) coef = -coef;
  const cxp = coef * rx * yp / ry, cyp = -coef * ry * xp / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let delta = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  // A cubic on a unit-circle arc of a quarter turn is within 2.73e-4 of it,
  // the error scaling as the angle's sixth power; half the tolerance is left
  // for the 4-decimal rounding and the arc's own float error.
  const radius = Math.max(rx, ry) * stretch;
  const maxAngle = Math.min(Math.PI / 2, (Math.PI / 2) * Math.pow(0.005 / (2.73e-4 * radius), 1 / 6));
  const n = Math.max(1, Math.ceil(Math.abs(delta) / maxAngle));
  const step = delta / n;
  const k = 4 / 3 * Math.tan(step / 4);
  const point = (t) => {
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
  };
  const tangent = (t) => {
    const ex = -rx * Math.sin(t), ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  const cubics = [];
  for (let s = 0; s < n; s++) {
    const a = theta1 + s * step, b = a + step;
    const [ax, ay] = point(a), [bx, by] = s === n - 1 ? [x2, y2] : point(b);
    const [tax, tay] = tangent(a), [tbx, tby] = tangent(b);
    cubics.push([ax + k * tax, ay + k * tay, bx - k * tbx, by - k * tby, bx, by]);
  }
  return cubics;
}

/** A coordinate as the normalised path writes it: 4 decimals, no -0. */
function pathNumber(v) {
  return String(roundTo(v, 4) + 0);
}

// ─── Reading a drawn element where it is drawn (session 62) ─────────────────

// The elements a clef import reads as its glyph (paths and basic shapes).
const DRAWN_TAGS = ["path", "rect", "circle", "ellipse", "polygon", "polyline"];

/** The element's ancestors below the root <svg>, nearest first. */
function ancestorsOf(el, root) {
  const out = [];
  for (let n = el.parentNode; n && n !== root && typeof n.getAttribute === "function"; n = n.parentNode) {
    out.push(n);
  }
  return out;
}

/** An element as a message names it: <path id="x">. */
function describe(el) {
  const id = el.getAttribute("id");
  return `<${localTag(el)}${id ? ` id="${id}"` : ""}>`;
}

/** A presentation property, from the style attribute first, else the attribute. */
function styleProp(el, name) {
  const style = el.getAttribute("style");
  if (style) {
    for (const decl of String(style).split(";")) {
      const at = decl.indexOf(":");
      if (at > 0 && decl.slice(0, at).trim().toLowerCase() === name) return decl.slice(at + 1).trim();
    }
  }
  const attr = el.getAttribute(name);
  return attr === null ? null : String(attr).trim();
}

/**
 * The composed transform of an element and every ancestor up to the root
 * <svg>, as one parseTransform matrix: { matrix, any } (any: some transform
 * is set), or { matrix: null, el } naming the element whose transform does
 * not parse.
 */
function composedTransform(el, root) {
  let m = IDENTITY;
  let any = false;
  for (const n of [el, ...ancestorsOf(el, root)]) {
    const t = n.getAttribute("transform");
    const parsed = parseTransform(t);
    if (!parsed) return { matrix: null, el: n, transform: t };
    if (t !== null && String(t).trim() !== "") any = true;
    m = mul(parsed, m);
  }
  return { matrix: m, any };
}

/**
 * An imported element's path, in the root's units: { d, transformed } or
 * { error }, transformed when a transform was applied to it. A
 * path with no transform on it or its ancestors whose commands are all
 * absolute ones every reader reads (M, L, H, V, C, Z), as toolkit output
 * always is, is returned as it is; anything else is normalised through the
 * composed transform. Refused, naming the element: clip-path, mask or
 * filter on it or an ancestor, and no fill (drawn by its stroke).
 */
function importedPath(el, root) {
  const name = describe(el);
  const chain = [el, ...ancestorsOf(el, root)];
  const releases = [["clip-path", "Object > Clip > Release"], ["mask", "Object > Mask > Release"],
    ["filter", "Filters > Remove Filters"]];
  for (const n of chain) {
    for (const [prop, command] of releases) {
      const v = styleProp(n, prop);
      if (v && v !== "none") {
        return { error: `${name} has a ${prop}${n === el ? "" : ` (on ${describe(n)})`}, which the importer ` +
          `cannot read: in Inkscape use ${command}, then import again` };
      }
    }
  }
  let fill = null;
  for (const n of [...chain, root]) {
    fill = styleProp(n, "fill");
    if (fill !== null) break;
  }
  if (fill === "none") {
    return { error: `${name} has no fill, so it is drawn only by its stroke: in Inkscape use ` +
      "Path > Stroke to Path, then import again" };
  }
  const d = CNBSvgImporter.shapeToPath(el);
  if (!d) {
    return { error: `${name} has no path data` + (localTag(el) === "path" ? " (d attribute)" : " (it draws nothing)") };
  }
  const { matrix, any, el: bad, transform } = composedTransform(el, root);
  if (!matrix) {
    return { error: `${name} has a transform the importer cannot read (${JSON.stringify(transform)}` +
      `${bad === el ? "" : ` on ${describe(bad)}`})` };
  }
  const tokens = tokenizePath(d);
  if (!tokens) return { error: `${name} has path data the importer cannot read` };
  if (!any && localTag(el) === "path" && tokens.every(t => "MLHVCZ".includes(t.cmd))) return { d };
  return { d: CNBSvgImporter.normalizePath(d, matrix), transformed: any };
}

/**
 * The first element the importer refuses wherever it is drawn (outside
 * <defs>): text, a clone, a bitmap or a nested <svg>, as a message naming
 * it and what to do in Inkscape; null when there is none.
 */
function refusedElement(doc, root) {
  if (typeof doc.querySelectorAll !== "function") return null;
  const advice = {
    text: "select it and use Path > Object to Path",
    use: "select it and use Edit > Clone > Unlink Clone",
    image: "trace it with Path > Trace Bitmap, or redraw it as paths",
    svg: "move its contents into the drawing (Object > Ungroup)",
  };
  for (const el of Array.from(doc.querySelectorAll("text, use, image, svg"))) {
    if (!(localTag(el) in advice) || el === root || ancestorsOf(el, root).some(a => localTag(a) === "defs")) continue;
    return `The file has ${describe(el)}, which the importer cannot read: in Inkscape, ` +
      `${advice[localTag(el)]}, then import again`;
  }
  return null;
}

/** A rect's corners mapped through a matrix, as their axis-aligned box. */
function rectBox(rect, m) {
  const corners = [
    [rect.x, rect.y], [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height], [rect.x + rect.width, rect.y + rect.height],
  ].map(([x, y]) => applyTransform(m, x, y));
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { x: minX, y: minY, width: clean(Math.max(...xs) - minX), height: clean(Math.max(...ys) - minY) };
}

/** A rect's own top- and bottom-centre mapped through a matrix. */
function rectEnds(rect, m) {
  const cx = rect.x + rect.width / 2;
  return { top: applyTransform(m, cx, rect.y), bottom: applyTransform(m, cx, rect.y + rect.height) };
}

/** Find an element by id, tolerating documents without getElementById. */
function byId(doc, id) {
  if (typeof doc.getElementById === "function") {
    const el = doc.getElementById(id);
    if (el) return el;
  }
  if (typeof doc.querySelector === "function") {
    return doc.querySelector(`[id="${id}"]`);
  }
  return null;
}

/**
 * The error message for text that is not an SVG file at all, or null. It
 * is refused BEFORE DOMParser sees it: Firefox logs every XML parse failure
 * to the console as an error, and a file with no <svg element cannot be an
 * SVG anyway.
 */
function notSvgError(svgText) {
  return /<svg\b/i.test(String(svgText))
    ? null
    : "Invalid SVG: the file contains no <svg> element (is it an SVG file?)";
}

/** Local (namespace-free, lowercase) tag name of an element. */
function localTag(el) {
  const raw = el.tagName || el.tag || "";
  return raw.replace(/^.*:/, "").toLowerCase();
}

export const CNBSvgImporter = {

  /**
   * Suggest a shape name from a filename: strip path and extension.
   * @param {string} filename
   * @returns {string}
   */
  shapeNameFromFilename(filename) {
    if (!filename) return "shape";
    const base = String(filename).replace(/^.*[/\\]/, "");
    return base.replace(/\.[^.]+$/, "") || "shape";
  },

  /**
   * Human-readable display name from a shape name:
   * "crotchet-minim" → "Crotchet Minim".
   * @param {string} name
   * @returns {string}
   */
  displayNameFromShapeName(name) {
    return String(name)
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Shape";
  },

  /**
   * Parse an SVG viewBox attribute string.
   * @param {string|null} vb
   * @returns {{minX:number,minY:number,width:number,height:number}|null}
   */
  parseViewBox(vb) {
    if (!vb) return null;
    const parts = String(vb).trim().split(/[\s,]+/).map(Number);
    if (parts.length < 4 || parts.some(Number.isNaN)) return null;
    return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
  },

  /**
   * Normalise SVG path data (session 62, step-by-step design §8): every
   * SVG 1.1 command is written as absolute M, L, C or Z with `matrix`
   * (parseTransform's form) applied to every point. Relative commands are
   * made absolute, H and V become lines, S, Q and T cubics, and each arc the
   * cubics that lie within 0.01 units of it after the matrix; z returns the
   * current point to its subpath's start. Numbers are rounded to 4 decimals.
   *
   * @param {string} d
   * @param {number[]} [matrix]  [a, b, c, d, e, f]; the identity by default
   * @returns {string|null} the normalised path, or null when d does not parse
   */
  normalizePath(d, matrix = IDENTITY) {
    if (d === null || d === undefined) return null;
    const tokens = tokenizePath(d);
    if (!tokens) return null;
    const stretch = maxStretch(matrix);
    const out = [];
    const put = (cmd, ...xy) => {
      const nums = [];
      for (let i = 0; i < xy.length; i += 2) {
        const p = applyTransform(matrix, xy[i], xy[i + 1]);
        nums.push(pathNumber(p.x), pathNumber(p.y));
      }
      out.push([cmd, ...nums].join(" "));
    };
    let x = 0, y = 0, startX = 0, startY = 0;
    let cubicCtrl = null, quadCtrl = null;   // the last C/S second control, Q/T control
    for (const { cmd, args } of tokens) {
      const upper = cmd.toUpperCase();
      const ox = cmd === upper ? 0 : x, oy = cmd === upper ? 0 : y;
      let nextCubic = null, nextQuad = null;
      switch (upper) {
        case "M":
          x = args[0] + ox; y = args[1] + oy; startX = x; startY = y;
          put("M", x, y);
          break;
        case "L":
          x = args[0] + ox; y = args[1] + oy;
          put("L", x, y);
          break;
        case "H":
          x = args[0] + ox;
          put("L", x, y);
          break;
        case "V":
          y = args[0] + oy;
          put("L", x, y);
          break;
        case "C":
        case "S": {
          const [c1x, c1y] = upper === "C" ? [args[0] + ox, args[1] + oy]
            : cubicCtrl ? [2 * x - cubicCtrl[0], 2 * y - cubicCtrl[1]] : [x, y];
          const a = upper === "C" ? args.slice(2) : args;
          const c2x = a[0] + ox, c2y = a[1] + oy;
          x = a[2] + ox; y = a[3] + oy;
          put("C", c1x, c1y, c2x, c2y, x, y);
          nextCubic = [c2x, c2y];
          break;
        }
        case "Q":
        case "T": {
          const [qx, qy] = upper === "Q" ? [args[0] + ox, args[1] + oy]
            : quadCtrl ? [2 * x - quadCtrl[0], 2 * y - quadCtrl[1]] : [x, y];
          const a = upper === "Q" ? args.slice(2) : args;
          const ex = a[0] + ox, ey = a[1] + oy;
          put("C", x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y),
            ex + 2 / 3 * (qx - ex), ey + 2 / 3 * (qy - ey), ex, ey);
          x = ex; y = ey;
          nextQuad = [qx, qy];
          break;
        }
        case "A": {
          const ex = args[5] + ox, ey = args[6] + oy;
          if (args[0] === 0 || args[1] === 0) {
            if (ex !== x || ey !== y) put("L", ex, ey);
          } else {
            for (const c of arcToCubics(x, y, args[0], args[1], args[2], args[3], args[4], ex, ey, stretch)) {
              put("C", ...c);
            }
          }
          x = ex; y = ey;
          break;
        }
        case "Z":
          out.push("Z");
          x = startX; y = startY;
          break;
      }
      cubicCtrl = nextCubic;
      quadCtrl = nextQuad;
    }
    return out.join(" ");
  },

  /**
   * The path data of a drawable element: a path's d, or a basic shape's
   * outline as SVG draws it (rect with rounded corners, circle, ellipse,
   * polygon, polyline), still to be normalised. null for an element that
   * draws nothing (a zero-sized rect, a circle of radius 0, fewer than two
   * points) or is not one of these.
   *
   * @param {Element|object} el  exposes getAttribute and tagName
   * @returns {string|null}
   */
  shapeToPath(el) {
    const num = (name) => {
      const v = parseFloat(el.getAttribute(name));
      return Number.isFinite(v) ? v : null;
    };
    const ellipse = (cx, cy, rx, ry) => (rx > 0 && ry > 0)
      ? `M ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} Z`
      : null;
    switch (localTag(el)) {
      case "path":
        return el.getAttribute("d") || null;
      case "rect": {
        const x = num("x") ?? 0, y = num("y") ?? 0, w = num("width") ?? 0, h = num("height") ?? 0;
        if (!(w > 0 && h > 0)) return null;
        // An omitted radius takes the other as given, then each is clamped.
        let rx = num("rx"), ry = num("ry");
        if (rx !== null && rx < 0) rx = null;
        if (ry !== null && ry < 0) ry = null;
        [rx, ry] = [Math.min(rx ?? ry ?? 0, w / 2), Math.min(ry ?? rx ?? 0, h / 2)];
        if (rx === 0 || ry === 0) return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
        const arc = (ex, ey) => `A ${rx} ${ry} 0 0 1 ${ex} ${ey}`;
        return `M ${x + rx} ${y} L ${x + w - rx} ${y} ${arc(x + w, y + ry)} L ${x + w} ${y + h - ry} ` +
          `${arc(x + w - rx, y + h)} L ${x + rx} ${y + h} ${arc(x, y + h - ry)} L ${x} ${y + ry} ${arc(x + rx, y)} Z`;
      }
      case "circle": {
        const r = num("r") ?? 0;
        return ellipse(num("cx") ?? 0, num("cy") ?? 0, r, r);
      }
      case "ellipse":
        return ellipse(num("cx") ?? 0, num("cy") ?? 0, num("rx") ?? 0, num("ry") ?? 0);
      case "polygon":
      case "polyline": {
        const nums = String(el.getAttribute("points") || "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
        if (nums.some(v => !Number.isFinite(v))) return null;
        const pairs = Math.floor(nums.length / 2);
        if (pairs < 2) return null;
        const pts = [];
        for (let i = 0; i < pairs; i++) pts.push(`${i === 0 ? "M" : "L"} ${nums[2 * i]} ${nums[2 * i + 1]}`);
        return pts.join(" ") + (localTag(el) === "polygon" ? " Z" : "");
      }
    }
    return null;
  },

  /**
   * Convert rect attribute strings to numbers (missing/invalid → 0).
   * @param {{x:any,y:any,width:any,height:any}} attrs
   * @returns {{x:number,y:number,width:number,height:number}}
   */
  parseRectAttrs(attrs) {
    return {
      x: parseFloat(attrs.x) || 0,
      y: parseFloat(attrs.y) || 0,
      width: parseFloat(attrs.width) || 0,
      height: parseFloat(attrs.height) || 0,
    };
  },

  /**
   * Apply an SVG `transform` attribute to a rect, returning the axis-aligned
   * bounding box of its four transformed corners (toolkit audit M8: Inkscape
   * stores a flipped placemarker as e.g. `x="-70" y="10" transform="scale(-1)"`,
   * so the raw geometry sits on the opposite side of the notehead).
   *
   * Accepts a transform list of matrix(a b c d e f), translate(tx [ty]),
   * scale(sx [sy]), rotate(deg [cx cy]), skewX(deg) and skewY(deg), composed
   * in order (the rightmost function applies first, per SVG).
   *
   * @param {{x:number,y:number,width:number,height:number}} rect
   * @param {string|null} transform
   * @returns {{x:number,y:number,width:number,height:number}|null} the
   *          transformed bounding box; the rect itself when there is no
   *          transform; null when the transform does not parse
   */
  transformRect(rect, transform) {
    if (transform === null || transform === undefined || String(transform).trim() === "") return rect;
    const m = parseTransform(transform);
    return m ? rectBox(rect, m) : null;
  },

  /**
   * A stem rect's two ends, its own top-centre and bottom-centre, mapped
   * through its `transform` attribute (session 11 review). The anchor is
   * read from these rather than from the transformed bounding box, whose
   * edges stop being the rect's ends once it is rotated: rotate(90) on
   * {0, 0, 10, 20} puts the bottom-centre at (-20, 5), where the box's
   * bottom-centre would be (-10, 10).
   *
   * @param {{x:number,y:number,width:number,height:number}} rect  untransformed
   * @param {string|null} transform
   * @returns {{top:{x:number,y:number}, bottom:{x:number,y:number}}|null}
   *          null when the transform does not parse
   */
  stemRectEnds(rect, transform) {
    const m = parseTransform(transform);
    return m ? rectEnds(rect, m) : null;
  },

  /**
   * Derive the 4-point anchor model from explicit attachment points, e.g.
   * the LY spec §7.1 `data-stem-up-x/y` / `data-stem-down-x/y` attributes
   * (fallback contract — current toolkit output uses stem rects instead).
   * One up/down pair, so crotchet and minim anchors are identical.
   *
   * @param {{x:number,y:number}|null} upPoint
   * @param {{x:number,y:number}|null} downPoint
   * @returns {object|null} null when neither point is present
   */
  anchorsFromStemPoints(upPoint, downPoint) {
    if (!upPoint && !downPoint) return null;
    const up = upPoint ? { x: roundTo(upPoint.x, 4), y: roundTo(upPoint.y, 4) } : { x: 0, y: 0 };
    const down = downPoint ? { x: roundTo(downPoint.x, 4), y: roundTo(downPoint.y, 4) } : { x: 0, y: 0 };
    return {
      crotchetUp:   { ...up },
      crotchetDown: { ...down },
      minimUp:      { ...up },
      minimDown:    { ...down },
    };
  },

  /**
   * Derive the 4-point anchor model (architecture plan §4.2) from the
   * toolkit's stem placemarker rects. The regular pair gives the crotchet
   * anchors; the optional minim pair, when BOTH rects are given, gives the
   * minim anchors, otherwise the minim anchors copy the crotchet ones.
   *
   * Attachment points: bottom-center of an up rect, top-center of a down
   * rect (in native SVG units, same space as svgPath). A rect read through
   * a transform carries `ends` (stemRectEnds): an up rect then anchors at
   * whichever end is lower on the page (greater y), a down rect at the
   * higher one, and when the two are level (a quarter turn) at its own
   * bottom-centre for up and top-centre for down. Inkscape's scale(-1)
   * flip therefore reads as it is drawn.
   *
   * @param {{x:number,y:number,width:number,height:number}|null} stemUpRect
   * @param {{x:number,y:number,width:number,height:number}|null} stemDownRect
   * @param {{x:number,y:number,width:number,height:number}|null} [minimUpRect]
   * @param {{x:number,y:number,width:number,height:number}|null} [minimDownRect]
   * @returns {{crotchetUp:{x,y},crotchetDown:{x,y},minimUp:{x,y},minimDown:{x,y}}|null}
   *          null when neither regular rect is present (stemless shape)
   */
  anchorsFromStemRects(stemUpRect, stemDownRect, minimUpRect = null, minimDownRect = null) {
    if (!stemUpRect && !stemDownRect) return null;

    const endsOf = r => r.ends || {
      top: { x: r.x + r.width / 2, y: r.y },
      bottom: { x: r.x + r.width / 2, y: r.y + r.height },
    };
    const point = p => ({ x: roundTo(p.x, 4), y: roundTo(p.y, 4) });
    const upPoint = r => {
      if (!r) return { x: 0, y: 0 };
      const { top, bottom } = endsOf(r);
      return point(top.y > bottom.y ? top : bottom);
    };
    const downPoint = r => {
      if (!r) return { x: 0, y: 0 };
      const { top, bottom } = endsOf(r);
      return point(bottom.y < top.y ? bottom : top);
    };

    const up = upPoint(stemUpRect);
    const down = downPoint(stemDownRect);
    const minimPair = !!minimUpRect && !!minimDownRect;

    return {
      crotchetUp:   { ...up },
      crotchetDown: { ...down },
      minimUp:      minimPair ? upPoint(minimUpRect) : { ...up },
      minimDown:    minimPair ? downPoint(minimDownRect) : { ...down },
    };
  },

  /**
   * Convert native-SVG-unit anchors to SEMITONE units at import time:
   * ÷ coordScale (SVG units per semitone), Y inverted (SVG Y-down →
   * LilyPond Y-up). Semitone units are the canonical lilypondAnchors
   * representation (007-s2 D5): the exporter converts them at export time
   * to LilyPond's stem-attachment units, relative to the notehead path's
   * extent (session 33). Matches the exporter's fallback conversion in
   * cnb-lilypond.js attachmentPoints().
   *
   * @param {object|null} anchors        4-point anchors in SVG units
   * @param {number} naturalHeight
   * @param {number} semitoneHeight
   * @returns {object|null}
   */
  toLilypondAnchors(anchors, naturalHeight, semitoneHeight) {
    if (!anchors || !naturalHeight || !semitoneHeight) return null;
    const coordScale = naturalHeight / semitoneHeight;
    const conv = p => ({
      x: roundTo(p.x / coordScale, 4),
      y: roundTo(-p.y / coordScale, 4),
    });
    return {
      crotchetUp:   conv(anchors.crotchetUp),
      crotchetDown: conv(anchors.crotchetDown),
      minimUp:      conv(anchors.minimUp),
      minimDown:    conv(anchors.minimDown),
    };
  },

  /**
   * Extract raw shape data from a parsed toolkit SVG document.
   *
   * @param {Document|object} doc  Parsed SVG document (or test stub with
   *                               getElementById/querySelector; elements
   *                               expose getAttribute and tagName)
   * @returns {object} extracted fields, or { error } when the document is
   *                   not a usable toolkit notehead SVG
   */
  extract(doc) {
    const root = (doc.documentElement && localTag(doc.documentElement) === "svg")
      ? doc.documentElement
      : (typeof doc.querySelector === "function" ? doc.querySelector("svg") : null);
    if (!root) return { error: "No <svg> root element found" };

    const noteheadEl = byId(doc, "notehead");
    if (!noteheadEl) {
      return {
        error: 'No element with id="notehead" found — this does not look like ' +
          "Music Glyph Toolkit output (run the toolkit's Notehead mode on it first)",
      };
    }

    const refused = refusedElement(doc, root);
    if (refused) return { error: refused };

    // The notehead and hollow in the root's units, through every transform
    // (session 62); toolkit output is stored as it is.
    const notehead = importedPath(noteheadEl, root);
    if (notehead.error) return { error: notehead.error };
    const svgPath = notehead.d;

    // Hollow cutout — the toolkit emits id="hollow"; legacy files may carry
    // id="false-hollow" (per-shape false-hollow marker).
    const hollowEl = byId(doc, "hollow") || byId(doc, "false-hollow");
    const isFalseHollow = !!hollowEl && hollowEl.getAttribute("id") === "false-hollow";
    // A hollow element that draws nothing is no hollow, as before.
    const hollow = hollowEl && CNBSvgImporter.shapeToPath(hollowEl) ? importedPath(hollowEl, root) : { d: null };
    if (hollow.error) return { error: hollow.error };

    // Stem placemarker rects (current toolkit contract — see module header),
    // read through the rect's own transform attribute (toolkit audit M8)
    // composed with its ancestors' (session 62).
    const readStemRect = (id) => {
      const el = byId(doc, id);
      if (!el) return { rect: null, nonRect: false };
      if (localTag(el) !== "rect") return { rect: null, nonRect: true };
      const raw = CNBSvgImporter.parseRectAttrs({
        x: el.getAttribute("x"),
        y: el.getAttribute("y"),
        width: el.getAttribute("width"),
        height: el.getAttribute("height"),
      });
      const { matrix, any, el: bad, transform } = composedTransform(el, root);
      if (!matrix) {
        return {
          error: `The "${id}" rect has a transform the importer cannot read ` +
            `(${JSON.stringify(transform)}${bad === el ? "" : ` on ${describe(bad)}`}) — ` +
            "only matrix, translate, scale, rotate, skewX and skewY are accepted",
        };
      }
      if (!any) return { rect: raw, nonRect: false };
      // The anchor is read from the rect's own ends, not the box (session 11 review).
      return { rect: { ...rectBox(raw, matrix), ends: rectEnds(raw, matrix) }, nonRect: false };
    };
    const up = readStemRect("stem-up");
    const down = readStemRect("stem-down");
    const minimUp = readStemRect("stem-minim-up");
    const minimDown = readStemRect("stem-minim-down");
    const rectError = [up, down, minimUp, minimDown].find(r => r.error);
    if (rectError) return { error: rectError.error };

    const semitoneHeightStr = noteheadEl.getAttribute("data-semitone-height");
    const semitoneHeight = semitoneHeightStr !== null && semitoneHeightStr !== ""
      ? parseFloat(semitoneHeightStr)
      : null;

    // LY spec §7.1 attachment-point attributes — fallback contract for files
    // predating the stem-rect placemarkers (both coordinates required).
    const numAttr = (el, name) => {
      const v = el.getAttribute(name);
      if (v === null || v === "" || String(v).trim().endsWith("%")) return null;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    const stemPoint = (xAttr, yAttr) => {
      const x = numAttr(noteheadEl, xAttr);
      const y = numAttr(noteheadEl, yAttr);
      return (x !== null && y !== null) ? { x, y } : null;
    };

    const viewBox = CNBSvgImporter.parseViewBox(root.getAttribute("viewBox"));

    // A shape import reads notehead mode's attributes; glyph mode's
    // data-lilypond-glyph on the same element is stale or foreign (toolkit
    // audit M7) and is ignored with a warning.
    const warnings = [];
    for (const [el, label] of [[noteheadEl, "notehead"], [hollowEl, "hollow"]]) {
      if (el && el.getAttribute("data-lilypond-glyph")) {
        warnings.push(`data-lilypond-glyph on #${label} ignored: a shape import reads ` +
          "notehead-mode data (the file was processed in the toolkit's glyph mode)");
      }
    }
    // A pre-baked path does not carry the transform the SVG path was drawn
    // through (session 62), so it is dropped and the export converts the
    // SVG path, which does.
    const prebaked = (el, attr, imported) => {
      const text = el ? el.getAttribute(attr) || null : null;
      if (text && imported.transformed) {
        warnings.push(`${attr} on ${describe(el)} ignored: the path is drawn through a transform ` +
          "the pre-baked path does not carry, so the LilyPond export converts the SVG path instead");
        return null;
      }
      return text;
    };

    return {
      svgPath,
      warnings,
      svgHollowPath: hollow.d,
      isFalseHollow,
      lilypondNotehead: prebaked(noteheadEl, "data-lilypond-notehead", notehead),
      lilypondHollow: prebaked(hollowEl, "data-lilypond-hollow", hollow),
      semitoneHeight: Number.isFinite(semitoneHeight) ? semitoneHeight : null,
      stemUpRect: up.rect,
      stemDownRect: down.rect,
      stemUpNonRect: up.nonRect,
      stemDownNonRect: down.nonRect,
      stemMinimUpRect: minimUp.rect,
      stemMinimDownRect: minimDown.rect,
      stemMinimUpNonRect: minimUp.nonRect,
      stemMinimDownNonRect: minimDown.nonRect,
      stemUpPoint: stemPoint("data-stem-up-x", "data-stem-up-y"),
      stemDownPoint: stemPoint("data-stem-down-x", "data-stem-down-y"),
      viewBoxWidth: viewBox ? viewBox.width : null,
      viewBoxHeight: viewBox ? viewBox.height : null,
      rootWidth: numAttr(root, "width"),
      rootHeight: numAttr(root, "height"),
      error: null,
    };
  },

  /**
   * Build a Module A `config.shapes[name]` entry from extracted fields.
   * Pure function — no DOM access.
   *
   * @param {object} extracted   Output of extract()
   * @param {string} [displayName]
   * @returns {{shape:object|null, warnings:string[], error:string|null}}
   */
  buildShape(extracted, displayName) {
    const warnings = [...(extracted.warnings || [])];
    if (extracted.error) return { shape: null, warnings, error: extracted.error };

    const notehead = prebakedPath(extracted.lilypondNotehead, "data-lilypond-notehead");
    if (notehead.error) return { shape: null, warnings, error: notehead.error };
    const hollow = prebakedPath(extracted.lilypondHollow, "data-lilypond-hollow");
    if (hollow.error) return { shape: null, warnings, error: hollow.error };

    // semitoneHeight: from data-semitone-height, else derived from the
    // toolkit's 100-units-per-semitone viewBox convention.
    let semitoneHeight = extracted.semitoneHeight;
    if (semitoneHeight === null) {
      if (extracted.viewBoxHeight) {
        semitoneHeight = roundTo(extracted.viewBoxHeight / TOOLKIT_UNITS_PER_SEMITONE, 4);
        warnings.push(
          "Missing data-semitone-height — derived " + semitoneHeight +
          " from the viewBox height (100 SVG units per semitone)");
      } else {
        return {
          shape: null, warnings,
          error: "Cannot determine shape size: no data-semitone-height and no viewBox",
        };
      }
    }

    // naturalHeight/naturalWidth: raw SVG coordinate dimensions, matching
    // the path coordinate space (scale = semitoneHeight × pxPerSemi / naturalHeight).
    // Sources in order: viewBox, then root width/height attributes. Width is
    // never invented — a wrong guess would silently distort the shape.
    const naturalHeight = extracted.viewBoxHeight || extracted.rootHeight ||
      semitoneHeight * TOOLKIT_UNITS_PER_SEMITONE;
    const naturalWidth = extracted.viewBoxWidth || extracted.rootWidth || null;
    if (naturalWidth === null) {
      return {
        shape: null, warnings,
        error: "Cannot determine shape width: no viewBox and no numeric width attribute",
      };
    }
    if (!extracted.viewBoxHeight) {
      warnings.push(extracted.rootHeight
        ? "Missing viewBox — natural dimensions read from root width/height attributes"
        : "Missing viewBox — natural height assumed from semitone height");
    }

    if (extracted.stemUpNonRect || extracted.stemDownNonRect ||
        extracted.stemMinimUpNonRect || extracted.stemMinimDownNonRect) {
      warnings.push(
        "Stem element(s) present but not <rect> placemarkers — ignored " +
        "(re-run the Music Glyph Toolkit to regenerate stems)");
    }
    if (!!extracted.stemUpRect !== !!extracted.stemDownRect) {
      warnings.push("Only one stem placemarker rect found — missing anchor defaults to (0,0)");
    }

    const minimUpRect = extracted.stemMinimUpRect || null;
    const minimDownRect = extracted.stemMinimDownRect || null;
    if (!!minimUpRect !== !!minimDownRect) {
      warnings.push(
        "Only one minim stem placemarker rect found (" +
        (minimUpRect ? "stem-minim-down" : "stem-minim-up") + " is missing) — " +
        "minim anchors copy the crotchet anchors");
    }
    if ((minimUpRect || minimDownRect) && !extracted.stemUpRect && !extracted.stemDownRect) {
      warnings.push("Minim stem placemarkers without stem-up/stem-down rects — ignored");
    }

    // Anchor sources in order: stem placemarker rects (current toolkit
    // contract), then LY spec §7.1 data-stem-* attributes (legacy contract).
    let anchors = CNBSvgImporter.anchorsFromStemRects(
      extracted.stemUpRect, extracted.stemDownRect, minimUpRect, minimDownRect);
    if (!anchors) {
      anchors = CNBSvgImporter.anchorsFromStemPoints(
        extracted.stemUpPoint, extracted.stemDownPoint);
      if (anchors) {
        warnings.push(
          "Stem anchors read from data-stem-* attributes (LY spec §7.1) — " +
          "the current toolkit emits stem placemarker rects instead");
        if (!!extracted.stemUpPoint !== !!extracted.stemDownPoint) {
          warnings.push("Only one data-stem-* anchor pair found — missing anchor defaults to (0,0)");
        }
      }
    }
    if (!anchors) {
      warnings.push("No stem placemarkers — imported as a stemless shape (anchors: null)");
    }

    if (!extracted.lilypondNotehead) {
      warnings.push(
        "No data-lilypond-notehead attribute — the exporter will fall back to " +
        "svgPathToLilypond() conversion (LY spec §7.2)");
    }
    if (extracted.svgHollowPath && !extracted.lilypondHollow) {
      warnings.push(
        "Hollow path has no data-lilypond-hollow attribute — the exporter will " +
        "fall back to svgPathToLilypond() conversion (LY spec §7.2)");
    }
    if (extracted.isFalseHollow) {
      warnings.push(
        'Hollow element id is "false-hollow" — imported as a regular hollow path; ' +
        "false-hollow behavior is the engine-level setting engine.falseHollow");
    }

    const shape = {
      displayName: displayName || "Imported Shape",
      svgPath: extracted.svgPath,
      svgHollowPath: extracted.svgHollowPath || null,
      naturalHeight,
      naturalWidth,
      semitoneHeight,
      anchors,
      lilypondPath: notehead.path,
      lilypondHollowPath: hollow.path,
      lilypondAnchors: CNBSvgImporter.toLilypondAnchors(anchors, naturalHeight, semitoneHeight),
    };
    return { shape, warnings, error: null };
  },

  /**
   * Extract raw clef glyph data from a parsed SVG document (set 009).
   * Reuses the toolkit data-* contract; stem/anchor placemarkers and hollow
   * cutouts are not part of the clef contract and are ignored.
   *
   * The glyph paths are id="clef" when present; otherwise every <path>
   * carrying the toolkit's glyph-mode data-lilypond-glyph attribute (toolkit
   * audit M5: glyph mode writes one per path); otherwise id="notehead"
   * (toolkit notehead-mode files); otherwise every drawn path and basic
   * shape outside <defs>, other than stem placemarkers (session 62). All of
   * them are imported, each in the root's units (see the module header):
   * their paths are joined into svgPath,
   * and each one's pre-baked path is returned in lilypondPieces for
   * buildClefGlyph to parse and merge.
   *
   * Per path, the clef target's own attributes (data-lilypond-clef, then
   * data-lilypond-glyph) win over notehead mode's data-lilypond-notehead;
   * a path carrying both modes' attributes gets a warning naming the one
   * ignored (toolkit audit M7: a file reprocessed in the other mode keeps
   * stale attributes).
   *
   * @param {Document|object} doc
   * @returns {object} extracted fields, or { error }
   */
  extractClef(doc) {
    const root = (doc.documentElement && localTag(doc.documentElement) === "svg")
      ? doc.documentElement
      : (typeof doc.querySelector === "function" ? doc.querySelector("svg") : null);
    if (!root) return { error: "No <svg> root element found" };

    const refused = refusedElement(doc, root);
    if (refused) return { error: refused };

    // Every drawn shape outside <defs>, in document order, other than the
    // toolkit's stem placemarkers (session 62: basic shapes as well as paths).
    const drawn = typeof doc.querySelectorAll === "function"
      ? Array.from(doc.querySelectorAll(DRAWN_TAGS.join(", "))).filter(el =>
        DRAWN_TAGS.includes(localTag(el)) && !/^stem-/.test(el.getAttribute("id") || "") &&
        !ancestorsOf(el, root).some(a => localTag(a) === "defs"))
      : (typeof doc.querySelector === "function" && doc.querySelector("path") ? [doc.querySelector("path")] : []);
    const clefEl = byId(doc, "clef");
    const glyphModePaths = drawn.filter(el => localTag(el) === "path" && el.getAttribute("data-lilypond-glyph") !== null);
    const noteheadEl = byId(doc, "notehead");
    const glyphEls = clefEl ? [clefEl]
      : glyphModePaths.length > 0 ? glyphModePaths
      : noteheadEl ? [noteheadEl]
      : drawn;
    if (glyphEls.length === 0) {
      return { error: 'No clef glyph element found (id="clef", data-lilypond-glyph paths, id="notehead", or any drawn path or shape)' };
    }

    // Each in the root's units, through every transform (session 62).
    const imports = [];
    for (const el of glyphEls) {
      const imported = importedPath(el, root);
      if (imported.error) return { error: imported.error };
      imports.push(imported);
    }
    const svgPath = imports.map(i => i.d).join(" ");

    const warnings = [];
    const lilypondPieces = glyphEls.map((el, i) => {
      const where = glyphEls.length > 1 ? ` on glyph path ${i + 1}` : "";
      const attr = ["data-lilypond-clef", "data-lilypond-glyph", "data-lilypond-notehead"]
        .find(a => el.getAttribute(a));
      if (attr && attr !== "data-lilypond-notehead") {
        for (const stale of ["data-lilypond-notehead", "data-lilypond-hollow"]) {
          if (el.getAttribute(stale)) {
            warnings.push(`${stale}${where} ignored: the path also carries ${attr}, ` +
              "which matches a clef import (the file was processed in both toolkit modes)");
          }
        }
      }
      // A pre-baked path does not carry the transform the SVG path was drawn
      // through (session 62): it is dropped, and the export converts the SVG path.
      if (attr && imports[i].transformed) {
        warnings.push(`${attr}${where} ignored: the path is drawn through a transform the pre-baked ` +
          "path does not carry, so the LilyPond export converts the SVG path instead");
        return null;
      }
      return attr ? { attr: attr + where, text: el.getAttribute(attr) } : null;
    });

    const heightEl = glyphEls.find(el => el.getAttribute("data-semitone-height")) || glyphEls[0];
    const semitoneHeightStr = heightEl.getAttribute("data-semitone-height");
    const semitoneHeight = semitoneHeightStr !== null && semitoneHeightStr !== ""
      ? parseFloat(semitoneHeightStr)
      : null;

    const numAttr = (el, name) => {
      const v = el.getAttribute(name);
      if (v === null || v === "" || String(v).trim().endsWith("%")) return null;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };

    const viewBox = CNBSvgImporter.parseViewBox(root.getAttribute("viewBox"));

    return {
      svgPath,
      lilypondPieces,
      warnings,
      semitoneHeight: Number.isFinite(semitoneHeight) ? semitoneHeight : null,
      viewBoxMinX: viewBox ? viewBox.minX : null,
      viewBoxMinY: viewBox ? viewBox.minY : null,
      viewBoxWidth: viewBox ? viewBox.width : null,
      viewBoxHeight: viewBox ? viewBox.height : null,
      rootWidth: numAttr(root, "width"),
      rootHeight: numAttr(root, "height"),
      error: null,
    };
  },

  /**
   * Build a `config.clef.glyphs[name]` entry from extractClef() output.
   * Pure function — no DOM access.
   *
   * The clef's anchor point (reference, session 59; see cnb-clef.js)
   * starts at its box's centre, and anchorSemi, the semitone it sits on, at
   * defaultMidpoint, so a freshly imported clef lands centred mid-staff
   * until its anchor is picked and it is positioned.
   *
   * @param {object} extracted           Output of extractClef()
   * @param {string} [displayName]
   * @param {{defaultMidpoint?:number}} [opts]
   * @returns {{glyph:object|null, warnings:string[], error:string|null}}
   */
  buildClefGlyph(extracted, displayName, opts = {}) {
    const warnings = [...(extracted.warnings || [])];
    if (extracted.error) return { glyph: null, warnings, error: extracted.error };

    // Each glyph path's pre-baked data is parsed on its own (a piece that
    // does not parse is an import error) and the commands are merged into
    // one path. Any path without pre-baked data → no lilypondPath at all.
    const pieces = extracted.lilypondPieces || [];
    const commands = [];
    for (const piece of pieces) {
      if (!piece) continue;
      const parsed = CNBScheme.parsePath(piece.text);
      if (!parsed) {
        return {
          glyph: null, warnings,
          error: `${piece.attr} is not valid LilyPond path data (only moveto, lineto, ` +
            "curveto and closepath with numbers are accepted) — not imported",
        };
      }
      commands.push(...parsed);
    }
    const complete = pieces.length > 0 && pieces.every(Boolean);
    const lilypondPath = complete ? CNBScheme.path(commands, "clef path") : null;

    let semitoneHeight = extracted.semitoneHeight;
    if (semitoneHeight === null) {
      if (extracted.viewBoxHeight) {
        semitoneHeight = roundTo(extracted.viewBoxHeight / TOOLKIT_UNITS_PER_SEMITONE, 4);
        warnings.push(
          "Missing data-semitone-height — derived " + semitoneHeight +
          " from the viewBox height (100 SVG units per semitone)");
      } else {
        return {
          glyph: null, warnings,
          error: "Cannot determine clef size: no data-semitone-height and no viewBox",
        };
      }
    }

    const naturalHeight = extracted.viewBoxHeight || extracted.rootHeight ||
      semitoneHeight * TOOLKIT_UNITS_PER_SEMITONE;
    const naturalWidth = extracted.viewBoxWidth || extracted.rootWidth || null;
    if (naturalWidth === null) {
      return {
        glyph: null, warnings,
        error: "Cannot determine clef width: no viewBox and no numeric width attribute",
      };
    }
    if (!extracted.viewBoxHeight) {
      warnings.push(extracted.rootHeight
        ? "Missing viewBox — natural dimensions read from root width/height attributes"
        : "Missing viewBox — natural height assumed from semitone height");
    }
    if (!lilypondPath) {
      warnings.push(
        (pieces.length > 1 ? "Not every glyph path has a " : "No ") +
        "data-lilypond-clef / data-lilypond-glyph / data-lilypond-notehead attribute, so the " +
        "LilyPond export converts this glyph's SVG path instead");
    }

    // The anchor (session 59) starts at the box's centre, on the staff's
    // middle, so the clef lands centred there until its anchor is picked.
    const midpoint = opts.defaultMidpoint ?? 12;
    const viewBoxMinX = extracted.viewBoxMinX ?? 0;
    const viewBoxMinY = extracted.viewBoxMinY ?? 0;
    const glyph = {
      displayName: displayName || "Imported Clef",
      kind: "glyph",
      svgPath: extracted.svgPath,
      naturalHeight,
      naturalWidth,
      semitoneHeight,
      viewBoxMinX,
      viewBoxMinY,
      lilypondPath,
      reference: { x: roundTo(viewBoxMinX + naturalWidth / 2, 4), y: roundTo(viewBoxMinY + naturalHeight / 2, 4) },
      anchorSemi: midpoint,
    };
    return { glyph, warnings, error: null };
  },

  /**
   * Parse raw SVG text into a `config.clef.glyphs[name]` entry (set 009).
   * Clef counterpart of parseSvgText.
   *
   * @param {string} svgText
   * @param {string} filename
   * @param {{parser?:{parseFromString:Function}, defaultMidpoint?:number}} [opts]
   * @returns {{name:string|null, glyph:object|null, warnings:string[], error:string|null}}
   */
  parseClefSvgText(svgText, filename, opts = {}) {
    const notSvg = notSvgError(svgText);
    if (notSvg) return { name: null, glyph: null, warnings: [], error: notSvg };
    const parser = opts.parser || new globalThis.DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");

    const parseError = typeof doc.querySelector === "function"
      ? doc.querySelector("parsererror")
      : null;
    if (parseError) {
      const detail = (parseError.textContent || "malformed XML").substring(0, 120);
      return { name: null, glyph: null, warnings: [], error: "Invalid SVG: " + detail };
    }

    const name = CNBSvgImporter.shapeNameFromFilename(filename);
    const built = CNBSvgImporter.buildClefGlyph(
      CNBSvgImporter.extractClef(doc),
      CNBSvgImporter.displayNameFromShapeName(name),
      opts);
    return { name, glyph: built.glyph, warnings: built.warnings, error: built.error };
  },

  /**
   * Parse raw SVG text into a Module A shape entry. Browser entry point —
   * uses DOMParser (injectable for tests via opts.parser).
   *
   * @param {string} svgText
   * @param {string} filename   Used to suggest the shape name
   * @param {{parser?:{parseFromString:Function}}} [opts]
   * @returns {{name:string|null, shape:object|null, warnings:string[], error:string|null}}
   */
  parseSvgText(svgText, filename, opts = {}) {
    const notSvg = notSvgError(svgText);
    if (notSvg) return { name: null, shape: null, warnings: [], error: notSvg };
    const parser = opts.parser || new globalThis.DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");

    const parseError = typeof doc.querySelector === "function"
      ? doc.querySelector("parsererror")
      : null;
    if (parseError) {
      const detail = (parseError.textContent || "malformed XML").substring(0, 120);
      return { name: null, shape: null, warnings: [], error: "Invalid SVG: " + detail };
    }

    const name = CNBSvgImporter.shapeNameFromFilename(filename);
    const built = CNBSvgImporter.buildShape(
      CNBSvgImporter.extract(doc),
      CNBSvgImporter.displayNameFromShapeName(name));
    return { name, shape: built.shape, warnings: built.warnings, error: built.error };
  },

  /**
   * Render the reusable import control (file picker + drag-and-drop zone)
   * into a container. Each imported file is parsed via parseSvgText and the
   * result is delivered to onResult. Host pages/apps own layout, styling
   * hooks (.cnb-svg-drop-zone / .dragover), and what to do with the result.
   *
   * @param {HTMLElement} container
   * @param {{onResult:(result:object)=>void, label?:string}} opts
   * @returns {{root:HTMLElement, input:HTMLInputElement, importFile:(file:File)=>Promise<void>}}
   */
  renderImportControl(container, { onResult, label } = {}) {
    const doc = globalThis.document;
    const zone = doc.createElement("div");
    zone.className = "cnb-svg-drop-zone";
    zone.textContent = label || "Click to choose a .svg file or drag & drop here";

    const input = doc.createElement("input");
    input.type = "file";
    input.accept = ".svg";
    input.style.display = "none";

    // A file that cannot be read or parsed is user input, not a defect:
    // it reaches onResult as an error result, never as an unhandled rejection.
    const importFile = async (file) => {
      if (!file) return;
      let result;
      try {
        result = CNBSvgImporter.parseSvgText(await file.text(), file.name);
      } catch (err) {
        result = {
          name: null, shape: null, warnings: [],
          error: `Could not read ${file.name}: ${(err && err.message) || err}`,
        };
      }
      onResult(result);
    };

    zone.addEventListener("click", () => input.click());
    input.addEventListener("change", async (e) => {
      await importFile(e.target.files[0]);
      e.target.value = "";
    });
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      const file = files.find(f => f.name.toLowerCase().endsWith(".svg"));
      if (file) await importFile(file);
      else onResult({ name: null, shape: null, warnings: [], error: "No .svg file found in drop." });
    });

    container.appendChild(zone);
    container.appendChild(input);
    return { root: zone, input, importFile };
  },
};
