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
 *   - The toolkit normalizes shapes to 100 SVG units per semitone, centered
 *     on the origin, and sets the root viewBox to the exact notehead bounds.
 *     Pre-baked LilyPond paths are SVG coordinates ÷ 100 with Y negated.
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

function roundTo(value, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
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
   * rect (in native SVG units, same space as svgPath).
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

    const upPoint = r => r
      ? { x: roundTo(r.x + r.width / 2, 4), y: roundTo(r.y + r.height, 4) }
      : { x: 0, y: 0 };
    const downPoint = r => r
      ? { x: roundTo(r.x + r.width / 2, 4), y: roundTo(r.y, 4) }
      : { x: 0, y: 0 };

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
   * representation (007-s2 D5): the staff-space conversion (÷
   * semitonesPerStaffSpace) happens in the exporter at export time,
   * because the target unit depends on the staff config, which can change
   * after import. Matches the exporter's fallback conversion in
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

    const svgPath = noteheadEl.getAttribute("d") || "";
    if (!svgPath) return { error: 'The "notehead" element has no path data (d attribute)' };

    // Hollow cutout — the toolkit emits id="hollow"; legacy files may carry
    // id="false-hollow" (per-shape false-hollow marker).
    const hollowEl = byId(doc, "hollow") || byId(doc, "false-hollow");
    const isFalseHollow = !!hollowEl && hollowEl.getAttribute("id") === "false-hollow";

    // Stem placemarker rects (current toolkit contract — see module header)
    const readStemRect = (id) => {
      const el = byId(doc, id);
      if (!el) return { rect: null, nonRect: false };
      if (localTag(el) !== "rect") return { rect: null, nonRect: true };
      return {
        rect: CNBSvgImporter.parseRectAttrs({
          x: el.getAttribute("x"),
          y: el.getAttribute("y"),
          width: el.getAttribute("width"),
          height: el.getAttribute("height"),
        }),
        nonRect: false,
      };
    };
    const up = readStemRect("stem-up");
    const down = readStemRect("stem-down");
    const minimUp = readStemRect("stem-minim-up");
    const minimDown = readStemRect("stem-minim-down");

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

    return {
      svgPath,
      svgHollowPath: hollowEl ? (hollowEl.getAttribute("d") || null) : null,
      isFalseHollow,
      lilypondNotehead: noteheadEl.getAttribute("data-lilypond-notehead") || null,
      lilypondHollow: hollowEl ? (hollowEl.getAttribute("data-lilypond-hollow") || null) : null,
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
    const warnings = [];
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
   * cutouts are not part of the clef contract and are ignored. The glyph
   * element is id="clef" when present, falling back to id="notehead"
   * (toolkit-authored files) and then to the first <path> in the document.
   *
   * @param {Document|object} doc
   * @returns {object} extracted fields, or { error }
   */
  extractClef(doc) {
    const root = (doc.documentElement && localTag(doc.documentElement) === "svg")
      ? doc.documentElement
      : (typeof doc.querySelector === "function" ? doc.querySelector("svg") : null);
    if (!root) return { error: "No <svg> root element found" };

    const glyphEl = byId(doc, "clef") || byId(doc, "notehead") ||
      (typeof doc.querySelector === "function" ? doc.querySelector("path") : null);
    if (!glyphEl) return { error: 'No clef glyph element found (id="clef", id="notehead", or any <path>)' };

    const svgPath = glyphEl.getAttribute("d") || "";
    if (!svgPath) return { error: "The clef glyph element has no path data (d attribute)" };

    const semitoneHeightStr = glyphEl.getAttribute("data-semitone-height");
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
      lilypondPath: glyphEl.getAttribute("data-lilypond-clef")
        || glyphEl.getAttribute("data-lilypond-notehead") || null,
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
   * anchorSemi (the semitone of the glyph's TOP edge — a float; see
   * cnb-clef.js) defaults to centering the glyph on defaultMidpoint, so a
   * freshly imported clef lands mid-staff until positioned.
   *
   * @param {object} extracted           Output of extractClef()
   * @param {string} [displayName]
   * @param {{defaultMidpoint?:number}} [opts]
   * @returns {{glyph:object|null, warnings:string[], error:string|null}}
   */
  buildClefGlyph(extracted, displayName, opts = {}) {
    const warnings = [];
    if (extracted.error) return { glyph: null, warnings, error: extracted.error };

    const baked = prebakedPath(extracted.lilypondPath, "data-lilypond-clef / data-lilypond-notehead");
    if (baked.error) return { glyph: null, warnings, error: baked.error };

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
    if (!extracted.lilypondPath) {
      warnings.push(
        "No data-lilypond-clef / data-lilypond-notehead attribute — export of " +
        "this glyph will need a fallback conversion if the engine gains clef support");
    }

    const midpoint = opts.defaultMidpoint ?? 12;
    const glyph = {
      displayName: displayName || "Imported Clef",
      kind: "glyph",
      svgPath: extracted.svgPath,
      naturalHeight,
      naturalWidth,
      semitoneHeight,
      viewBoxMinX: extracted.viewBoxMinX ?? 0,
      viewBoxMinY: extracted.viewBoxMinY ?? 0,
      lilypondPath: baked.path,
      anchorSemi: roundTo(midpoint + semitoneHeight / 2, 4),
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
