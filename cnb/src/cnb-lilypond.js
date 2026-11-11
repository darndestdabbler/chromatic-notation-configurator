/**
 * cnb-lilypond.js — Module 11: LilyPond Exporter
 *
 * Generates .ly file content from a config JSON per CNB-LY-EXPORT-SPEC-v1.2,
 * plus the v1.3 pitch-axis surface (CNB-LY-EXPORT-SPEC-v1_3.md), emitted only
 * when pitchAxis is enabled — disabled configs run the literal v1.2.1 paths.
 * This is a port of the proven export logic in the legacy monolith's
 * configurator-core.js (preserved at git tag legacy-monolith-final)
 * (generateSectionA/B, svgPathToLilypond, toSchemeSymbol, and helpers),
 * mapped onto the modular config schema (Architecture Plan §4).
 *
 * Covers the full export: header, Section A (named definitions), Section B
 * (engine settings), Section C (configuration procedure), and generate().
 *
 * Dependencies: Module A (config), Module B (music), Module 24 (pitch axis)
 */

import { CNBConfig } from "./cnb-config.js";
import { CNBColor } from "./cnb-color.js";
import { CNBClef } from "./cnb-clef.js";
import { CNBMusic } from "./cnb-music.js";
import { CNBPitchAxis } from "./cnb-pitch-axis.js";
import { CNBScheme } from "./cnb-scheme.js";
import { CNBStaff } from "./cnb-staff.js";
import { CNBStem } from "./cnb-stem.js";
import { CNBLedgerSet } from "./cnb-ledger-set.js";

// ─── Engine defaults (LY spec §5.2 / Appendix A) ─────────────────────────────
// Values the CNB engine assumes when a setting is not emitted. Section B
// emits a setting only when the config differs from these (emit-if-changed).

const ENGINE_DEFAULTS = {
  falseHollow: false,
  multinotePadding: -0.5,
  defaultMagnify: "7/4",
  indent: 0,
  collisionThreshold: 2,
};

// ─── Internal helpers ────────────────────────────────────────────────────────

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

// Every config value reaches the .ly through a CNBScheme emitter (audit
// 2026-11-02, H1): comment text, Scheme strings, symbols, numbers, ratios,
// versions and path data. Nothing below interpolates raw config text.

/** Scheme-safe slug: lowercase, non-alphanumerics collapsed to hyphens. */
const slug = CNBScheme.slug;

/** Format a finite number for Scheme output (throws naming the field otherwise). */
function fmtNum(n, field = "exported number") {
  return CNBScheme.number(n, field);
}

/** Format an {x, y} point as a Scheme pair body: "x . y". */
function fmtPair(pt, field = "exported point") {
  return `${fmtNum(pt.x, field)} . ${fmtNum(pt.y, field)}`;
}

/** Escape a string for a Scheme string literal (the text between the quotes). */
function escSchemeString(s) {
  return CNBScheme.string(s).slice(1, -1);
}

/** The Scheme symbol for a shape name (throws naming the shape when invalid). */
function shapeSymbol(name) {
  return CNBScheme.symbol(slug(name), `Shape ${JSON.stringify(name)} name`);
}

/** Human-readable pitch class name for comments (C, C♯, D, ...). */
function pcName(pc) {
  const label = CNBMusic.pcLabel(pc);
  return label.sharp ? `${label.text}♯` : label.text;
}

/** Duration names defined in the config (fallback: crotchet only). */
function durationNames(config) {
  const defs = (config.durations && config.durations.definitions) || [];
  const names = defs.map(d => d.name).filter(Boolean);
  return names.length > 0 ? names : ["crotchet"];
}

/**
 * Resolve every (pc × duration) combination through the notehead rules.
 * Returns a flat array of { pc, duration, shape, hollow, color, heightSemis,
 * widthSemis } where color is the rules' hex or null (black: a notehead's
 * colour lives only on its rules, session 37) and the sizes are null unless
 * a rule sets them.
 */
function resolveAll(config) {
  const results = [];
  for (const key of [null, ...keyBranches(config).map(b => b.name)]) {
    for (const duration of durationNames(config)) {
      for (let pc = 0; pc < 12; pc++) {
        const r = CNBConfig.resolveNotehead(config, pc, duration, key);
        results.push({
          pc, duration, shape: r.shape, hollow: r.hollow, color: r.color,
          heightSemis: r.heightSemis, widthSemis: r.widthSemis,
        });
      }
    }
  }
  return results;
}

/**
 * The keys Section C dispatches on (session 34, LY spec 1.3.9 §6.4): with
 * keys on, each key definition a notehead rule names, as { name, pcs }
 * with pcs its sorted pitch classes, the one thing the engine passes for a
 * key. Definitions sharing a pitch-class set make one branch, the first of
 * them in definition order (validation warns when they resolve
 * differently). Empty with keys off: the preview applies no key then.
 *
 * @param {object} config
 * @returns {{name:string, pcs:number[]}[]}
 */
function keyBranches(config) {
  const keys = config.keys || {};
  if (!keys.enabled) return [];
  const named = new Set();
  for (const rule of config.noteheadRules || []) {
    if (rule && rule.match && Array.isArray(rule.match.keys)) rule.match.keys.forEach(k => named.add(k));
  }
  const branches = [];
  const seen = new Set();
  for (const def of keys.definitions || []) {
    if (!def || !named.has(def.name) || !Array.isArray(def.pitchClasses)) continue;
    const pcs = [...new Set(def.pitchClasses.map(CNBMusic.pitchClass))].sort((a, b) => a - b);
    const set = pcs.join(" ");
    if (seen.has(set)) continue;
    seen.add(set);
    branches.push({ name: def.name, pcs });
  }
  return branches;
}

/**
 * The registration a resolved notehead draws with (session 22, LY spec
 * §4.1c). At the shape's own size it is the shape itself: { name, sym,
 * scale: null }. At any other resolved size it is a sized variant of the
 * shape, named "<shape>-h<height>-w<width>" (sizes in semitones, formatted
 * like every exported number, "." written "p"), whose path, cutout and
 * attachments are the shape's scaled by scale.x = width / natural width and
 * scale.y = height / semitoneHeight. A size left unset takes the shape's own.
 *
 * @param {object} config
 * @param {{shape:string, heightSemis?:number|null, widthSemis?:number|null}} r
 * @returns {{name:string, sym:string, scale:{x:number,y:number}|null,
 *            heightSemis?:number, widthSemis?:number}}
 */
function registrationFor(config, r) {
  const name = r.shape || "";
  const sym = shapeSymbol(name);
  const shape = (config.shapes || {})[name];
  if (!shape || (r.heightSemis == null && r.widthSemis == null)) return { name, sym, scale: null };
  const ownH = shape.semitoneHeight;
  const ownW = shape.naturalWidth * shape.semitoneHeight / shape.naturalHeight;
  const h = r.heightSemis ?? ownH;
  const w = r.widthSemis ?? ownW;
  if (h === ownH && w === ownW) return { name, sym, scale: null };
  const part = (v, field) => fmtNum(v, field).replace(".", "p");
  return {
    name,
    sym: CNBScheme.symbol(`${sym}-h${part(h, "apply.heightSemis")}-w${part(w, "apply.widthSemis")}`, `Sized shape ${JSON.stringify(name)}`),
    scale: { x: w / ownW, y: h / ownH },
    heightSemis: h,
    widthSemis: w,
  };
}

/**
 * Every registration Section A must emit: per used shape (sorted), the shape
 * itself when some notehead uses it at its own size, then its sized variants
 * sorted by symbol. Variants that format to the same symbol are one.
 */
function usedRegistrations(config) {
  const shapes = config.shapes || {};
  const bySym = new Map();
  for (const r of resolveAll(config)) {
    if (!r.shape || !shapes[r.shape]) continue;
    const reg = registrationFor(config, r);
    if (!bySym.has(reg.sym)) bySym.set(reg.sym, reg);
  }
  return [...bySym.values()].sort((a, b) =>
    a.name !== b.name ? (a.name < b.name ? -1 : 1)
      : (a.scale === null) !== (b.scale === null) ? (a.scale === null ? -1 : 1)
        : (a.sym < b.sym ? -1 : a.sym > b.sym ? 1 : 0));
}

/**
 * Shape names actually referenced by the resolved notehead configs,
 * filtered to shapes that exist in config.shapes, sorted.
 * (Port of legacy getUsedShapes, driven by rule resolution instead of
 * raw rule inspection since the new schema's rules are cumulative.)
 */
function usedShapes(config) {
  const shapes = config.shapes || {};
  const used = new Set();
  for (const r of resolveAll(config)) {
    if (r.shape && shapes[r.shape]) used.add(r.shape);
  }
  return [...used].sort();
}

/**
 * Scheme symbol for a color hex, named from the hex (session 37):
 * nearestColorName → toSchemeSymbol, e.g. "#1b9e77" → "shamrock-1b9e77".
 */
function colorSymbolFor(hex) {
  return CNBScheme.symbol(CNBColor.schemeSymbol(hex), `color ${JSON.stringify(hex)}`);
}

/** True when a resolved colour draws black (none, or #000000). */
const isBlack = (hex) => !hex || hex.toLowerCase() === "#000000";

/**
 * The distinct non-black colours the resolved noteheads use, in first-use
 * order, each { hex, symbol }, compared without regard to case; and whether
 * any notehead is black.
 */
function usedColors(config) {
  const colors = [];
  const seen = new Set();
  let hasBlack = false;
  for (const r of resolveAll(config)) {
    if (isBlack(r.color)) { hasBlack = true; continue; }
    const lower = r.color.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    colors.push({ hex: r.color, symbol: colorSymbolFor(r.color) });
  }
  return { colors, hasBlack };
}

/**
 * Convert a shape's stem anchors to LilyPond attachment points, in the
 * units LilyPond's NoteHead.stem-attachment reads, which the engine passes
 * cnb:register-attachment! points to unchanged (cnb/stems.ly): each
 * coordinate a fraction of the notehead stencil's extent, −1 at the
 * left/bottom edge, 1 at the right/top, 0 at the extent's centre (LY spec
 * 1.3.8 §4.4b; session 33).
 *
 * The extent is the one Section A registers for the shape: its pre-baked
 * lilypondPath, else svgPath through the fallback normalisation, both taken
 * here in SEMITONE units, Y up. The anchor is in the same units:
 * shape.lilypondAnchors as stored (canonically semitones, the importer's
 * toLilypondAnchors output), else shape.anchors ÷ SVG units per semitone,
 * Y negated. The staff-space divisor (÷ sps, or ÷ axisUnitsPerStaffSpace
 * under a pitch axis) scales path and anchor alike, so it cancels.
 *
 * The anchor is the stem's centre, as the SVG's stem rect draws it (session
 * 40, LY spec §4.4c), and LilyPond puts the stem's edge on the attachment
 * point (an up stem's right edge, a down stem's left), so each point's x is
 * the anchor moved outward by half the engine's stem (CNBStem.THICKNESS
 * staff spaces). That half stem does not scale with a sized variant (§4.1c),
 * so a variant's points are computed at its scale. Y is the anchor's.
 * Returns null for stemless shapes (both anchor sets null).
 *
 * @param {object} shape  config.shapes entry
 * @param {{x:number,y:number}|null} scale  a sized variant's scale, or null
 * @param {number} staffSpaceSemis  one staff space in semitones (sps, or
 *        axisUnitsPerStaffSpace under a pitch axis)
 */
function attachmentPoints(shape, scale, staffSpaceSemis) {
  const natH = shape.naturalHeight || 1;
  const unitsPerSemitone = natH / (shape.semitoneHeight || natH);
  const fromSvg = (pt) => ({ x: pt.x / unitsPerSemitone, y: -pt.y / unitsPerSemitone });

  let anchors;
  if (shape.lilypondAnchors) anchors = shape.lilypondAnchors;
  else if (shape.anchors) {
    anchors = {};
    for (const key of ["crotchetUp", "crotchetDown", "minimUp", "minimDown"]) {
      if (shape.anchors[key]) anchors[key] = fromSvg(shape.anchors[key]);
    }
  } else return null;

  const commands = shape.lilypondPath
    ? (CNBScheme.parsePath(shape.lilypondPath) || [])
    : svgCommands(shape.svgPath).map(({ cmd, args }) => ({
        cmd, args: args.map((v, i) => (i % 2 === 0 ? v : -v) / unitsPerSemitone),
      }));
  const extent = pathExtent(commands);
  const sx = scale ? scale.x : 1;
  const halfStem = CNBStem.THICKNESS / 2 * staffSpaceSemis;
  const relative = (v, [min, max], k = 1) =>
    max > min ? Math.round((2 * v - (min + max) * k) / ((max - min) * k) * 10000) / 10000 : 0;
  const toLy = (pt, side) => ({
    x: relative((pt.x || 0) * sx + side * halfStem, extent.x, sx),
    y: relative(pt.y || 0, extent.y),
  });

  return {
    crotchetUp:   toLy(anchors.crotchetUp   || { x: 0, y: 0 }, 1),
    crotchetDown: toLy(anchors.crotchetDown || { x: 0, y: 0 }, -1),
    minimUp:      toLy(anchors.minimUp      || { x: 0, y: 0 }, 1),
    minimDown:    toLy(anchors.minimDown    || { x: 0, y: 0 }, -1),
  };
}

/** LilyPond duration number for a named duration, or null when unknown. */
function durationLyNumber(config, name) {
  const defs = (config.durations && config.durations.definitions) || [];
  const def = defs.find(d => d.name === name);
  return (def && typeof def.lilypondDuration === "number") ? def.lilypondDuration : null;
}

/**
 * Normalize one resolved notehead entry into the Section C alist fields.
 * Mirrors legacy generateSectionC's per-group symbol derivation:
 *   hollow  → "<shape>-cutout" only when the shape actually has hollow path data
 *   attach  → "<shape>-attach" only when the shape has stem anchors
 *   color   → the rules' hex, else black
 * A notehead resolved to a size other than its shape's own names the sized
 * variant (registrationFor) in shape, hollow and attachment, so the size is
 * part of the grouping key through those symbols (session 22).
 */
function sectionCFields(config, r) {
  const shapes = config.shapes || {};
  const shape = shapes[r.shape];
  const shapeSym = registrationFor(config, r).sym;

  const hasHollowPath = !!(shape && (shape.lilypondHollowPath || shape.svgHollowPath));
  const hollowSym = (r.hollow && hasHollowPath) ? `${shapeSym}-cutout` : "#f";

  const hasAnchors = !!(shape && (shape.lilypondAnchors || shape.anchors));
  const attachSym = hasAnchors ? `${shapeSym}-attach` : "#f";

  const colorSym = isBlack(r.color) ? "black-000000" : colorSymbolFor(r.color);

  return { shapeSym, colorSym, hollowSym, attachSym };
}

/** Grouping key: pcs/durations sharing this key share one cond clause. */
function sectionCKey(f) {
  const base = `${f.shapeSym}|${f.colorSym}|${f.hollowSym}|${f.attachSym}`;
  // v1.3 §6.3: a nonzero x-offset joins the grouping key (0 leaves it as is).
  return f.xOffset ? `${base}|${f.xOffset}` : base;
}

/**
 * Section B lines for an enabled pitch axis (v1.3 §5.4b): the compiled
 * cnb:get-pitch-staff-position procedure — absolute semitone (exact
 * integer; middle C = 0) → staff position in half-staff-spaces, with
 * staff.midpoint anchored at 0 — then an explicit cnb:keysig-tonic-octave
 * (engine handoff 008 §4.2): placement through the hook is clef-independent,
 * so the signature's octave SELECTION must not fall back to middleCPosition.
 * The hook reads its argument as a Configurator semitone, so the octave is
 * given in Configurator octave numbering — placement.tonicOctave when it is
 * an integer, else the octave the preview's auto rule picks for a C tonic.
 *
 * @param {object} config
 * @param {object} axis  an enabled CNBPitchAxis context for config
 * @returns {string[]}
 */
function pitchAxisLines(config, axis) {
  const pa = config.pitchAxis;
  const staff = config.staff || {};
  const midpoint = staff.midpoint || 0;
  const positions = pa.pitchClasses.slice().sort((a, b) => a.pc - b.pc).map(e => e.position);
  const vector = positions.map(p => fmtNum(p, "pitchAxis.pitchClasses position")).join(" ");
  const anchor = fmtNum(axis.positionOfSemi(midpoint), "pitchAxis position of staff.midpoint");
  const stride = fmtNum(axis.octaveStride, "pitchAxis.octaveStride");
  const units = fmtNum(axis.unitsPerStaffSpace, "pitchAxis.axisUnitsPerStaffSpace");
  const distinct = new Set(positions).size;

  const placement = ((config.keys || {}).keySignature || {}).placement || {};
  const tonicOctave = Number.isInteger(placement.tonicOctave)
    ? placement.tonicOctave
    : Math.round((midpoint - 6) / 12);   // CNBKeySignature.tonicSemi auto rule, pc 0

  return [
    `%% Pitch axis (${CNBScheme.comment(pa.kind)}) — 12 pitch classes on ${distinct} positions/octave`,
    `%% map [${vector}] · octave stride ${stride}`,
    `%% axis units per staff space: ${units} · midpoint semi ${fmtNum(midpoint, "staff.midpoint")} → axis position ${anchor}`,
    "#(set! cnb:get-pitch-staff-position",
    "   (lambda (semitone)",
    "     (let* ((pc (modulo semitone 12))",
    "            (oct (/ (- semitone pc) 12))",
    `            (pos (+ (vector-ref #(${vector}) pc)`,
    `                    (* oct ${stride}))))`,
    `       (/ (* 2 (- pos ${anchor})) ${units}))))`,
    "",
    "%% Key-signature octave — explicit under a pitch axis (engine handoff 008 §4.2)",
    `#(set! cnb:keysig-tonic-octave ${fmtNum(tonicOctave, "keys.keySignature.placement.tonicOctave")})`,
  ];
}

/** A #RRGGBB colour as a Scheme string, else throws naming the field. */
function hexString(v, field) {
  if (typeof v !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v)) {
    throw new Error(`${field}: ${JSON.stringify(v)} is not a #RRGGBB colour`);
  }
  return CNBScheme.string(v);
}

/**
 * The shown clef as the engine names it (engine handoff 005 §5, LY spec
 * 1.3.7 §5.5): { name, def, sym, field }, or null when no clef is shown.
 */
function shownClef(config) {
  const active = CNBClef.activeGlyph(config);
  if (!active) return null;
  const field = `clef.glyphs[${JSON.stringify(active.name)}]`;
  return { ...active, sym: CNBScheme.symbol(slug(active.name), `${field} name`), field };
}

/**
 * A glyph clef's top-edge anchor on the engine's semitone axis (handoff 005
 * §5 flag A: middle C = 0, with middleCPosition). On a linear staff the
 * engine puts semitone 12 on the middle line under the treble clef, where
 * the preview puts staff.midpoint, so the anchor keeps its distance from
 * the midpoint. Under a pitch axis the hook reads Configurator semitones
 * directly (LY spec §5.4c), so the anchor is used as is.
 */
function clefAnchor(config, def) {
  if (CNBPitchAxis.create(config).enabled) return def.anchorSemi;
  return def.anchorSemi - ((config.staff || {}).midpoint || 0) + 12;
}

/**
 * Section A lines registering a shown glyph clef with cnb:register-clef!
 * (handoff 005 §2): its pre-baked lilypondPath, else svgPath converted like
 * a notehead fallback (the engine measures the path and scales it to
 * height-semitones, so only its shape matters), the converted anchor, the
 * design height, and the colour when one is set. [] for a text clef or none.
 */
function clefRegistrationLines(config) {
  const clef = shownClef(config);
  if (!clef || (clef.def.kind || "glyph") !== "glyph") return [];
  const { def, sym, field } = clef;
  const path = def.lilypondPath
    ? CNBScheme.path(def.lilypondPath, `${field}.lilypondPath`)
    : CNBLilypond.svgPathToLilypond(def.svgPath, def.naturalHeight / def.semitoneHeight, 1);
  const lines = [
    "%% --- Register clef ---",
    `#(cnb:register-clef! '${sym}`,
    "   (list",
    `     (cons 'path ${path.replace(/\n/g, "\n       ")})`,
    `     (cons 'anchor-semitones ${fmtNum(clefAnchor(config, def), `${field}.anchorSemi`)})`,
    `     (cons 'height-semitones ${fmtNum(def.semitoneHeight, `${field}.semitoneHeight`)})`,
  ];
  if (def.color) lines.push(`     (cons 'color ${hexString(def.color, `${field}.color`)})`);
  lines[lines.length - 1] += "))";
  lines.push("");
  return lines;
}

// The pitches the preview draws: card pc p (0–12) draws semitones p and
// p + 12 (CNBCard).
const PREVIEW_SEMIS = { min: 0, max: 24 };
const LEDGER_ENTRIES_PER_LINE = 6;

/**
 * Section B ledger lines (session 34, LY spec 1.3.9 §5.7). For every pitch
 * the preview draws, the ledgers it draws for a note there
 * (CNBLedgerSet.ledgersFor), as LilyPond staff positions, an empty list
 * where it draws none. Each notehead takes its pitch's entry through
 * NoteHead.ledger-positions (no-ledgers for an empty one), so the engine's
 * own rule adds nothing. A pitch beyond them keeps the engine's rule, which
 * reaches the engraved staff: the preview's staff repeats every octave, the
 * engraved one has only the exported lines. The table is keyed by the
 * pitch, not by cnb:ledger-overrides' notehead position: the engine hands
 * its rule the position rounded to a whole number, which two pitches can
 * share (B at −0.5 and C at 0 on a 4-semitone staff) when the preview draws
 * them different ledgers. Keys are engine semitones (middle C = 0): under a
 * pitch axis the hook reads Configurator semitones as they are (§5.4c); on a
 * linear staff the engine puts semitone 12 on the middle line, where the
 * preview puts the midpoint (§5.5).
 */
function ledgerLines(config, axis) {
  const midpoint = (config.staff || {}).midpoint || 0;
  const shift = axis.enabled ? 0 : midpoint - 12;
  const entries = [];
  for (let s = PREVIEW_SEMIS.min; s <= PREVIEW_SEMIS.max; s++) {
    const ledgers = CNBLedgerSet.ledgersFor(config, [s], { minSemi: s - 12, maxSemi: s + 12 }, axis)
      .map(l => fmtNum(CNBStaff.lilypondPosition(config, l), "ledger position (ledgers.templates)"));
    entries.push(`(${fmtNum(s - shift, "staff.midpoint")} . (${ledgers.join(" ")}))`);
  }
  const rows = [];
  for (let i = 0; i < entries.length; i += LEDGER_ENTRIES_PER_LINE) {
    rows.push("     " + entries.slice(i, i + LEDGER_ENTRIES_PER_LINE).join(" "));
  }
  return [
    "%% Ledger lines — each notehead the preview draws gets the ledgers drawn",
    "%% there: engine semitone (middle C = 0) → ledger staff positions. Any",
    "%% other pitch keeps the engine's ledger rule.",
    "#(define cnb:ledgers-by-semitone",
    "   '(" + rows.join("\n").trimStart(),
    "     ))",
    "#(define (cnb:ledgers-of grob)",
    "   (assv (ly:pitch-semitones (ly:event-property (event-cause grob) 'pitch))",
    "         cnb:ledgers-by-semitone))",
    "\\layout {",
    "  \\context {",
    "    \\Voice",
    "    \\override NoteHead.ledger-positions =",
    "      #(lambda (grob) (let ((e (cnb:ledgers-of grob))) (if e (cdr e) '())))",
    "    \\override NoteHead.no-ledgers =",
    "      #(lambda (grob) (let ((e (cnb:ledgers-of grob))) (and e (null? (cdr e)))))",
    "  }",
    "}",
  ];
}

/**
 * Section B clef lines (handoff 005 §1, LY spec 1.3.7 §5.5). cnb:clef-style
 * is always written: 'none when no clef is shown, 'dozenal for the engine's
 * own dozenal clef (session 45, LY spec 1.3.13; drawn and placed by the
 * engine, so nothing else is written for it), 'custom naming the registered
 * glyph (an imported clef, or a treble, bass or alto clef from the panel),
 * or 'text with the label as a markup carrying the preview's font, colour
 * and bold weight, at its preview height. A shown clef also gets its
 * gutter, the preview's paddingH in semitones (the engine adds it on the
 * right only).
 */
function clefLines(config) {
  const clef = shownClef(config);
  const lines = ["%% Clef"];
  if (!clef) {
    lines.push("#(set! cnb:clef-style 'none)");
    return lines;
  }
  const { def, sym, field } = clef;
  if (def.kind === "dozenal") {
    lines.push("#(set! cnb:clef-style 'dozenal)");
  } else if ((def.kind || "glyph") === "text") {
    const font = CNBScheme.string(`${def.fontFamily || "Georgia, serif"} Bold`);
    const color = hexString(def.color || "#000000", `${field}.color`);
    lines.push("#(set! cnb:clef-style 'text)");
    lines.push(`#(set! cnb:clef-text (markup #:with-color ${color} #:override (cons 'font-name ${font}) ${CNBScheme.string(def.text)}))`);
    lines.push(`#(set! cnb:clef-size-semitones ${fmtNum(def.textHeightSemis, `${field}.textHeightSemis`)})`);
  } else {
    lines.push("#(set! cnb:clef-style 'custom)");
    lines.push(`#(set! cnb:clef-name '${sym})`);
  }
  const display = config.display || {};
  const paddingH = (config.clef.gutter || {}).paddingH ?? 12;
  lines.push(`#(set! cnb:clef-gutter-semitones ${fmtNum(paddingH / (display.pxPerSemi || 16), "clef.gutter.paddingH")})`);
  return lines;
}

/**
 * Section B key-signature lines (engine handoff 006 §1–§3, LY spec 1.3.7
 * §5.6). 'none unless keys and the signature are both on; the engine's
 * default 'chord is the one style, so it is not written. With the signature
 * on, each bar setting is written only when it differs from the engine's
 * default: the colour (#ffd42a), the thickness in #:draw-line units,
 * thicknessPct / (10 × semitones per staff space) (4), or 0 for a separator
 * that is off — the engine has no switch for the bar alone — and the
 * half-extent in semitones (12). On a linear staff an explicit tonic octave
 * is written as is: the engine places semitone s where the preview does at
 * the default middle (12), so their octaves agree, as a round trip measures
 * (the handoff's −1 offset does not hold). Under a pitch axis
 * pitchAxisLines() writes the octave instead (§5.4d).
 *
 * @param {object} config
 * @param {number} sps  semitones (axis units under an axis) per staff space
 * @param {boolean} axisOn
 * @returns {string[]}
 */
function keySignatureLines(config, sps, axisOn) {
  const keys = config.keys || {};
  const ks = keys.keySignature || {};
  const lines = ["%% Key signature"];
  if (!keys.enabled || !ks.enabled) {
    lines.push("#(set! cnb:keysig-style 'none)");
    return lines;
  }
  const sep = ks.separator || {};
  const color = sep.color ?? "#ffd42a";
  if (color.toLowerCase() !== "#ffd42a") {
    lines.push(`#(set! cnb:keysig-bar-color ${hexString(color, "keys.keySignature.separator.color")})`);
  }
  const thickness = sep.enabled === false ? 0 : (sep.thicknessPct ?? 160) / (10 * sps);
  if (thickness !== 4) {
    lines.push(`#(set! cnb:keysig-bar-thickness ${fmtNum(thickness, "keys.keySignature.separator.thicknessPct")})`);
  }
  const extent = sep.extentSemis ?? 12;
  if (extent !== 12) {
    lines.push(`#(set! cnb:keysig-bar-extent-semis ${fmtNum(extent, "keys.keySignature.separator.extentSemis")})`);
  }
  const octave = (ks.placement || {}).tonicOctave;
  if (!axisOn && Number.isInteger(octave)) {
    lines.push(`#(set! cnb:keysig-tonic-octave ${fmtNum(octave, "keys.keySignature.placement.tonicOctave")})`);
  }
  return lines.length === 1 ? [] : lines;
}

/**
 * Scheme condition for a pitch-class group (port of legacy
 * buildPitchClassCondition): single pc → (= pc N), several → memv.
 */
function pcCondition(pcs, varName) {
  if (!Array.isArray(pcs) || pcs.length === 0) return "#f";
  if (pcs.length === 1) return `(= ${varName} ${pcs[0]})`;
  return `(memv ${varName} '(${pcs.join(" ")}))`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const CNBLilypond = {

  /**
   * Convert path commands to the staff-space units the engine draws
   * registered paths in (audit 2026-11-02, H2/H3). The one conversion both
   * path sources go through: every coordinate is divided by
   * unitsPerStaffSpace, Y is negated when flipY is set, and the result is
   * re-emitted from its numbers through CNBScheme.path.
   *
   *   - Pre-baked data-lilypond-* paths are semitone units, Y up (toolkit
   *     output: SVG units ÷ 100, Y negated) → (commands, sps, false).
   *   - The svgPathToLilypond fallback passes native SVG units, Y down →
   *     (commands, unitsPerSemitone × sps, true).
   *
   * sps is staff.semitonesPerStaffSpace, or pitchAxis.axisUnitsPerStaffSpace
   * under a pitch axis.
   *
   * A sized variant (session 22, LY spec §4.1c) passes scale: x coordinates
   * are multiplied by scale.x and y by scale.y as well.
   *
   * @param {{cmd:string, args:number[]}[]} commands  moveto/lineto/curveto/closepath
   * @param {number} unitsPerStaffSpace
   * @param {boolean} [flipY=false]
   * @param {string} [field]  named in the error when the data is invalid
   * @param {{x:number,y:number}|null} [scale]  sized-variant scale
   * @returns {string} e.g. "'(\n    (moveto 0 0.6667)\n    (closepath))"
   */
  pathToStaffSpace(commands, unitsPerStaffSpace, flipY = false, field = "path data", scale = null) {
    const div = unitsPerStaffSpace || 1;
    const ySign = flipY ? -1 : 1;
    const sx = scale ? scale.x : 1;
    const sy = scale ? scale.y : 1;
    const scaled = commands.map(({ cmd, args }) => ({
      cmd,
      args: args.map((v, i) => (i % 2 === 0 ? v * sx : ySign * v * sy) / div),
    }));
    return CNBScheme.path(scaled, field);
  },

  /**
   * Fallback for shapes without pre-baked LilyPond data: convert an SVG path
   * `d` string (absolute M/L/H/V/C/Z, H/V folded into lineto) to staff-space
   * LilyPond path data with the toolkit's normalisation — ÷ SVG units per
   * semitone (naturalHeight / semitoneHeight; 100 for toolkit output), Y
   * negated (SVG Y-down → LilyPond Y-up), then ÷ sps via pathToStaffSpace.
   * The shape's coordinate origin is its centre, as in the preview and the
   * stored stem anchors.
   *
   * @param {string} svgPath  SVG path d attribute
   * @param {number} unitsPerSemitone  SVG units per semitone of the shape
   * @param {number} sps  staff semitones (or axis units) per staff space
   * @param {{x:number,y:number}|null} [scale]  sized-variant scale (§4.1c)
   * @returns {string} e.g. "'(\n    (moveto 0 0.6667)\n    (closepath))"
   */
  svgPathToLilypond(svgPath, unitsPerSemitone, sps, scale = null) {
    return CNBLilypond.pathToStaffSpace(svgCommands(svgPath), (unitsPerSemitone || 1) * (sps || 1), true, "svgPath", scale);
  },

  /**
   * Generate a Scheme symbol from a color/shape name, optionally suffixed
   * with a hex value for uniqueness (LY spec §4.5 color name pipeline).
   * toSchemeSymbol("Shamrock", "#1B9E77") → "shamrock-1b9e77"
   * toSchemeSymbol("Crotchet–Minim")      → "crotchet-minim"
   *
   * @param {string} name
   * @param {string} [hex]  #RRGGBB — appended lowercase without the "#"
   * @returns {string}
   */
  toSchemeSymbol(name, hex) {
    const base = slug(name);
    if (!hex) return base;
    const hexPart = String(hex).replace("#", "").toLowerCase();
    return base ? `${base}-${hexPart}` : hexPart;
  },

  /**
   * Compute cnb:staff-line-positions values from the staff config: the
   * staff's lines as LilyPond staff positions, CNBStaff.lilypondPositions
   * (LY spec §5.1, 1.3.5 §5.1a; §5.4a under a pitch axis), which the
   * preview's stems also read (session 34).
   *
   * @param {object} config
   * @returns {number[]}
   */
  computeStaffLinePositions(config) {
    return CNBStaff.lilypondPositions(config);
  },

  /**
   * Generate the file header (LY spec §3): version declaration, engine
   * include, and the generated-by comment block.
   * @param {object} config
   * @returns {string}
   */
  header(config) {
    const meta = config.meta || {};
    const engine = config.engine || {};
    const rule = "%% " + "%".repeat(76);

    const lines = [];
    lines.push(`\\version "${CNBScheme.version(engine.lilypondVersion || "2.24.2", "engine.lilypondVersion")}"`);
    lines.push(`\\include "ChromaticNotationBase.ly"`);
    lines.push("");
    lines.push(rule);
    lines.push("%%");
    lines.push(`%% ${CNBScheme.comment(meta.notationLabel || "Untitled")} — Generated by Chromatic Configurator`);
    lines.push(`%% Date: ${new Date().toISOString().split("T")[0]}`);
    lines.push(`%% Configurator version: ${CNBConfig.VERSION}`);
    lines.push("%%");
    lines.push("%% DO NOT EDIT BY HAND — regenerate from the Configurator.");
    if (meta.configName) {
      lines.push(`%% Source: ${CNBScheme.comment(meta.configName)}.json`);
    }
    lines.push("%%");
    lines.push(rule);
    lines.push("");

    return lines.join("\n");
  },

  /**
   * Generate Section A — named definitions (LY spec §4):
   * A1 path definitions, A2 path registrations, A3 hollow cutout
   * registrations, A4 stem attachment registrations (4-point model),
   * A5 color registrations: the colours the noteheads use (session 37).
   * A1–A4 run over the used registrations: each used shape at its own size,
   * and each sized variant (session 22, LY spec §4.1c) with its path, cutout
   * and attachments scaled.
   * @param {object} config
   * @returns {string}
   */
  sectionA(config) {
    const shapes = config.shapes || {};
    const registrations = usedRegistrations(config);

    const lines = [];
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%     SECTION A — NAMED DEFINITIONS");
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("");

    // Staff-space divisor for path data: ÷ sps, or
    // ÷ axisUnitsPerStaffSpace under a pitch axis (v1.3 §4.1b).
    const axis = CNBPitchAxis.create(config);
    const pathSps = axis.enabled
      ? axis.unitsPerStaffSpace
      : (config.staff || {}).semitonesPerStaffSpace || 1;

    // A1. Path variable definitions
    lines.push("%% --- Path variables ---");
    for (const { name, sym, scale, heightSemis, widthSemis } of registrations) {
      const shape = shapes[name];
      const field = (key) => `shapes[${JSON.stringify(name)}].${key}`;
      if (scale) {
        lines.push(`%% ${sym}: ${CNBScheme.comment(name)} sized to ${fmtNum(heightSemis, "apply.heightSemis")} × ${fmtNum(widthSemis, "apply.widthSemis")} semitones (height × width)`);
      }
      const natH = shape.naturalHeight || 1;
      const unitsPerSemitone = natH / (shape.semitoneHeight || natH);

      // Prefer the pre-baked LilyPond path from data-lilypond-notehead
      // (semitone units), re-emitted from its parsed numbers in staff-space
      // units (never as text); else convert the SVG path.
      const toStaffSpace = (text, key) => {
        const commands = CNBScheme.parsePath(text);
        if (!commands) throw new Error(`${field(key)}: not valid LilyPond path data`);
        return CNBLilypond.pathToStaffSpace(commands, pathSps, false, field(key), scale);
      };
      const pathDef = shape.lilypondPath
        ? toStaffSpace(shape.lilypondPath, "lilypondPath")
        : CNBLilypond.svgPathToLilypond(shape.svgPath, unitsPerSemitone, pathSps, scale);
      lines.push(`#(define cnb:${sym}-path ${pathDef})`);
      lines.push("");

      if (shape.lilypondHollowPath || shape.svgHollowPath) {
        const hollowDef = shape.lilypondHollowPath
          ? toStaffSpace(shape.lilypondHollowPath, "lilypondHollowPath")
          : CNBLilypond.svgPathToLilypond(shape.svgHollowPath, unitsPerSemitone, pathSps, scale);
        lines.push(`#(define cnb:${sym}-cutout-path ${hollowDef})`);
        lines.push("");
      }
    }

    // A2. Path registrations
    lines.push("%% --- Register paths ---");
    for (const { sym } of registrations) {
      lines.push(`#(cnb:register-path! '${sym} cnb:${sym}-path)`);
    }
    lines.push("");

    // A3. Hollow cutout registrations
    const hollowRegs = registrations.filter(({ name }) => shapes[name].lilypondHollowPath || shapes[name].svgHollowPath);
    if (hollowRegs.length > 0) {
      lines.push("%% --- Register hollow cutouts ---");
      for (const { sym } of hollowRegs) {
        lines.push(`#(cnb:register-hollow! '${sym}-cutout cnb:${sym}-cutout-path)`);
      }
      lines.push("");
    }

    // A4. Stem attachment registrations (4-point model), in LilyPond's
    // stem-attachment units relative to the registered path's extent
    // (LY spec 1.3.8 §4.4b), half a stem outward of the anchor (§4.4c).
    lines.push("%% --- Register stem attachments ---");
    for (const { name, sym, scale } of registrations) {
      const pts = attachmentPoints(shapes[name], scale, pathSps);
      if (!pts) {
        lines.push(`%% ${sym}: stemless — no attachment registered`);
        lines.push("");
        continue;
      }
      const field = `shapes[${JSON.stringify(name)}] stem anchors`;
      lines.push(`#(cnb:register-attachment! '${sym}-attach`);
      lines.push(`   (list`);
      lines.push(`     (cons 'crotchet-up   '(${fmtPair(pts.crotchetUp, field)}))`);
      lines.push(`     (cons 'crotchet-down '(${fmtPair(pts.crotchetDown, field)}))`);
      lines.push(`     (cons 'minim-up      '(${fmtPair(pts.minimUp, field)}))`);
      lines.push(`     (cons 'minim-down    '(${fmtPair(pts.minimDown, field)}))))`);
      lines.push("");
    }

    // A5. Color registrations (LY spec 1.3.10 §4.5a): each colour the
    // resolved noteheads use, once, named from its hex. There is no
    // accessible branch: a colour-blind variant is a config of its own.
    const { colors, hasBlack } = usedColors(config);
    if (colors.length > 0 || hasBlack) lines.push("%% --- Register colors ---");
    for (const c of colors) {
      lines.push(`#(cnb:register-color! '${c.symbol} ${CNBScheme.string(c.hex)})`);
    }
    if (hasBlack) lines.push(`#(cnb:register-color! 'black-000000 "#000000")`);
    if (colors.length > 0 || hasBlack) lines.push("");

    // A6. Clef glyph registration (LY spec 1.3.7 §5.5)
    lines.push(...clefRegistrationLines(config));

    return lines.join("\n");
  },

  /**
   * Generate Section B — engine settings (LY spec §5):
   * B1 staff geometry (always), the pitch axis when enabled, the clef
   * (always: LY spec 1.3.7 §5.5), B2 emit-if-changed engine settings,
   * B3 metadata.
   * @param {object} config
   * @returns {string}
   */
  sectionB(config) {
    const staff = config.staff || {};
    const engine = config.engine || {};
    const meta = config.meta || {};
    const d = ENGINE_DEFAULTS;

    const lines = [];
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%     SECTION B — ENGINE SETTINGS");
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("");

    // Model selection — always emitted. The engine defaults
    // cnb:use-procedure-model to #f (vector model) and silently ignores
    // Sections A/C without it; every Configurator export is procedure-model
    // by construction (007-s1 D1).
    lines.push("%% Model selection — Configurator exports drive the procedure model");
    lines.push("#(set! cnb:use-procedure-model #t)");
    lines.push("");

    // B1. Staff geometry — always emitted. Under a pitch axis the axis unit
    // takes the semitone's place in every semitone→staff-space conversion
    // (v1.3 §5.3a/§5.4a; engine handoff 008 §4.1), so the engine's remaining
    // ÷sps length conversions (clef size/gutter, keysig bar extent) read
    // grid units, as the preview does.
    lines.push("%% Staff geometry");
    const axis = CNBPitchAxis.create(config);
    const sps = axis.enabled ? axis.unitsPerStaffSpace : staff.semitonesPerStaffSpace || 1;
    const positions = CNBLilypond.computeStaffLinePositions(config);
    const spsField = axis.enabled ? "pitchAxis.axisUnitsPerStaffSpace" : "staff.semitonesPerStaffSpace";
    lines.push(`#(set! cnb:semitones-per-staff-space ${fmtNum(sps, spsField)})`);
    lines.push(`#(set! cnb:staff-line-positions '(${positions
      .map(p => fmtNum(p, "staff-line position (staff.semitonePattern, staff.midpoint)")).join(" ")}))`);
    lines.push("");

    if (axis.enabled) {
      lines.push(...pitchAxisLines(config, axis));
      lines.push("");
    }

    lines.push(...ledgerLines(config, axis));
    lines.push("");

    lines.push(...clefLines(config));
    lines.push("");

    const keySignature = keySignatureLines(config, sps, axis.enabled);
    if (keySignature.length > 0) {
      lines.push(...keySignature);
      lines.push("");
    }

    // B2. Emit-if-changed engine settings
    const changed = [];
    if ((engine.falseHollow || false) !== d.falseHollow) {
      changed.push(`#(set! cnb:false-hollow ${engine.falseHollow ? "#t" : "#f"})`);
    }
    if (engine.multinotePadding !== undefined && engine.multinotePadding !== d.multinotePadding) {
      changed.push(`#(set! cnb:multinote-padding ${fmtNum(engine.multinotePadding, "engine.multinotePadding")})`);
    }
    if (engine.defaultMagnify !== undefined && String(engine.defaultMagnify) !== d.defaultMagnify) {
      changed.push(`#(set! cnb:default-magnify ${CNBScheme.ratio(engine.defaultMagnify, "engine.defaultMagnify")})`);
    }
    if (engine.indent !== undefined && engine.indent !== d.indent) {
      changed.push(`#(set! cnb:indent ${fmtNum(engine.indent, "engine.indent")})`);
    }
    if (engine.collisionThreshold !== undefined && engine.collisionThreshold !== d.collisionThreshold) {
      changed.push(`#(set! cnb:collision-threshold ${fmtNum(engine.collisionThreshold, "engine.collisionThreshold")})`);
    }

    // Staff-line colour and thickness are never emitted: the engine reads
    // cnb:default-staff-line-thickness / -color only in advanced mode
    // (cnb:staff-and-ledger-lines), which the Configurator does not emit, so
    // they are preview-only (LY spec 1.3.3; audit 2026-11-02, M2).
    // engine.stemThickness is never emitted: the engine defines no
    // cnb:stem-thickness, and setting it is an "Unbound variable" error
    // that stops LilyPond (audit 2026-11-02, M1). The setting is preview-only.

    if (changed.length > 0) {
      lines.push("%% Engine settings (non-default)");
      lines.push(...changed);
      lines.push("");
    }

    // B3. Metadata — always emitted (footnote only when non-empty)
    lines.push("%% Metadata");
    lines.push(`#(set! cnb:file-suffix ${CNBScheme.string(meta.fileSuffix || "")})`);
    lines.push(`#(set! cnb:notation-label ${CNBScheme.string(meta.notationLabel || "")})`);
    if (meta.notationFootnote) {
      lines.push(`#(set! cnb:notation-footnote`);
      lines.push(`  ${CNBScheme.string(meta.notationFootnote)})`);
    }
    lines.push("");

    return lines.join("\n");
  },

  /**
   * Generate Section C — the configuration procedure (LY spec §6):
   * resolves all 12 pitch classes (× durations) via CNBConfig.resolveNotehead,
   * groups pitch classes with identical resolved configs, and emits cond
   * clauses with memv grouping. Pitch classes whose config varies by duration
   * get compound (and <pc-cond> (= duration N)) clauses (LY spec §6.2).
   * The repeat field follows config.durations.representationMode:
   * "repeat" → #t, otherwise (distinct shapes per duration) → #f.
   * @param {object} config
   * @returns {string}
   * @throws {Error} when a duration-varying clause is needed for a duration
   *                 that has no numeric lilypondDuration
   */
  sectionC(config) {
    const lines = [];
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%     SECTION C — CONFIGURATION PROCEDURE");
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%");
    lines.push("%% The procedure below maps (semitone, duration, key) to a config alist.");
    lines.push("%% Generated from the notehead rules, resolved per pitch class");
    lines.push("%% (priority-ordered cumulative merge via CNBConfig.resolveNotehead).");
    lines.push("%%");
    lines.push("");

    if ((config.noteheadRules || []).length === 0) {
      lines.push("%% WARNING: No notehead rules defined.");
      lines.push("");
      return lines.join("\n");
    }

    const representationMode = (config.durations && config.durations.representationMode) || "shape";
    const repeat = representationMode === "repeat" ? "#t" : "#f";
    const axisOn = CNBPitchAxis.create(config).enabled;
    const durations = durationNames(config);

    // One (cond …) over pc × duration for a key (null: no key), its "(cond"
    // indented n spaces; its last line closes the cond.
    const condLines = (key, n) => {
      const out = [];
      const at = (k) => " ".repeat(n + k);

      // Resolve the full pc × duration matrix, normalized to emission fields.
      // The x-offset field's whole lifecycle is axis-gated (v1.3 §6.3): 0 on a
      // linear config whatever the rules say, and a 0 is never emitted.
      const byDuration = {};
      for (const duration of durations) {
        byDuration[duration] = [];
        for (let pc = 0; pc < 12; pc++) {
          const r = CNBConfig.resolveNotehead(config, pc, duration, key);
          const f = sectionCFields(config, { pc, ...r });
          f.xOffset = axisOn && r.xOffsetStaffSpaces ? r.xOffsetStaffSpaces : 0;
          byDuration[duration].push(f);
        }
      }

      // Split pcs into duration-uniform (one clause per group, no duration
      // condition) and duration-varying (compound clauses per duration).
      const uniformPCs = [];
      const varyingPCs = [];
      for (let pc = 0; pc < 12; pc++) {
        const keys = durations.map(d => sectionCKey(byDuration[d][pc]));
        (keys.every(k => k === keys[0]) ? uniformPCs : varyingPCs).push(pc);
      }

      const groupBy = (pcs, duration) => {
        const groups = {};
        for (const pc of pcs) {
          const f = byDuration[duration][pc];
          const k = sectionCKey(f);
          if (!groups[k]) groups[k] = { fields: f, pitchClasses: [] };
          groups[k].pitchClasses.push(pc);
        }
        return Object.values(groups).sort((a, b) => a.pitchClasses[0] - b.pitchClasses[0]);
      };

      const emitClause = (comment, condition, f) => {
        out.push(`${at(2)};; ${CNBScheme.comment(comment)}`);
        out.push(`${at(2)}(${condition}`);
        out.push(`${at(3)}'((shape      . ${f.shapeSym})`);
        out.push(`${at(5)}(color      . ${f.colorSym})`);
        out.push(`${at(5)}(hollow     . ${f.hollowSym})`);
        out.push(`${at(5)}(attachment . ${f.attachSym})`);
        out.push(`${at(5)}(off-key-mark . #f)`);
        if (f.xOffset) out.push(`${at(5)}(x-offset   . ${fmtNum(f.xOffset, "apply.xOffsetStaffSpaces")})`);
        out.push(`${at(5)}(repeat     . ${repeat})))`);
        out.push("");
      };

      const offsetLabel = (f) => !f.xOffset ? ""
        : `, ${f.xOffset > 0 ? "+" : ""}${fmtNum(f.xOffset, "apply.xOffsetStaffSpaces")} staff-space ${f.xOffset > 0 ? "right" : "left"}`;

      out.push(`${at(0)}(cond`);

      // Duration-uniform clauses (resolved identically for every duration —
      // grouping evaluated against the first duration, arbitrary by uniformity).
      for (const group of groupBy(uniformPCs, durations[0])) {
        const names = group.pitchClasses.map(pcName).join(", ");
        const hollowLabel = group.fields.hollowSym === "#f" ? "solid" : "hollow";
        emitClause(
          `${names} → ${group.fields.shapeSym}, ${hollowLabel}, ${group.fields.colorSym}${offsetLabel(group.fields)}`,
          pcCondition(group.pitchClasses, "pc"),
          group.fields
        );
      }

      // Duration-varying clauses: compound (and <pc-cond> (= duration N)).
      for (const duration of durations) {
        const groups = groupBy(varyingPCs, duration);
        if (groups.length === 0) continue;
        const lyNum = durationLyNumber(config, duration);
        if (lyNum === null) {
          // A wildcard here would make the clause duration-insensitive and
          // silently wrong — refuse to emit instead.
          throw new Error(
            `Duration "${duration}" has no numeric lilypondDuration in ` +
            `config.durations.definitions — cannot emit duration-aware Section C clauses`
          );
        }
        for (const group of groups) {
          const names = group.pitchClasses.map(pcName).join(", ");
          const hollowLabel = group.fields.hollowSym === "#f" ? "solid" : "hollow";
          emitClause(
            `${names} (${duration}) → ${group.fields.shapeSym}, ${hollowLabel}, ${group.fields.colorSym}${offsetLabel(group.fields)}`,
            `(and ${pcCondition(group.pitchClasses, "pc")} (= duration ${fmtNum(lyNum, `durations ${JSON.stringify(duration)} lilypondDuration`)}))`,
            group.fields
          );
        }
      }

      // Fallback (unreachable when all 12 pcs are covered — safety net, as in
      // the legacy exporter, which also forces hollow #f here).
      const fb = byDuration[durations[0]][0];
      out.push(`${at(2)};; Fallback`);
      out.push(`${at(2)}(else`);
      out.push(`${at(3)}'((shape      . ${fb.shapeSym})`);
      out.push(`${at(5)}(color      . ${fb.colorSym})`);
      out.push(`${at(5)}(hollow     . #f)`);
      out.push(`${at(5)}(attachment . ${fb.attachSym})`);
      out.push(`${at(5)}(off-key-mark . #f)`);
      if (fb.xOffset) out.push(`${at(5)}(x-offset   . ${fmtNum(fb.xOffset, "apply.xOffsetStaffSpaces")})`);
      out.push(`${at(5)}(repeat     . ${repeat}))))`);
      return out;
    };

    lines.push("#(set! cnb:get-notehead-config");
    lines.push("   (lambda (semitone duration key)");
    const branches = keyBranches(config);
    if (branches.length === 0) {
      lines.push("     (let ((pc (modulo semitone 12)))");
      lines.push(...condLines(null, 7));
      lines[lines.length - 1] += ")))";
    } else {
      // Key dispatch (session 34, LY spec 1.3.9 §6.4): the engine passes the
      // key as its pitch classes, so each key a rule names is a branch on
      // that sorted list; any other key resolves as with no key.
      lines.push("     (let ((pc (modulo semitone 12))");
      lines.push("           (key-pcs (sort (list-copy key) <)))");
      lines.push("       (cond");
      for (const { name, pcs } of branches) {
        lines.push(`         ;; ${CNBScheme.comment(`Key ${name}`)}`);
        lines.push(`         ((equal? key-pcs '(${pcs.map(p => fmtNum(p, `keys.definitions ${JSON.stringify(name)} pitchClasses`)).join(" ")}))`);
        lines.push(...condLines(name, 10));
        lines[lines.length - 1] += ")";
        lines.push("");
      }
      lines.push("         ;; Any other key");
      lines.push("         (else");
      lines.push(...condLines(null, 10));
      lines[lines.length - 1] += ")))))";
    }
    lines.push("");

    return lines.join("\n");
  },

  /**
   * Generate the complete .ly file: header + Section A + Section B +
   * Section C in the mandatory order (LY spec §2). Runs the export
   * validation checks (LY spec §8) first and throws on blocking errors;
   * warnings are non-blocking and not surfaced here (use CNBConfig.validate
   * directly to inspect them).
   * @param {object} config
   * @returns {string}
   * @throws {Error} when the config fails export validation
   */
  generate(config) {
    // Pitch-axis configs export since set 014 session 3 lifted the v1.3 §8a
    // fail-loud gate: the engine shipped E13-1/E13-2 (engine set 008
    // configurator-handoff). The §8 axis checks 8-12 are Module A's PA-1…PA-8
    // blocking errors, enforced by the validate() call below.
    const validation = CNBConfig.validate(config);
    const errors = validation.errors.slice();

    // Exporter-side check (LY spec §8 check 1): every shape the resolved
    // rules reference must carry path data to emit in Section A.
    const shapes = config.shapes || {};
    for (const name of usedShapes(config)) {
      const shape = shapes[name];
      if (!shape.lilypondPath && !shape.svgPath) {
        errors.push(`Shape "${name}" has no path data (lilypondPath or svgPath)`);
      }
    }

    if (errors.length > 0) {
      throw new Error(
        "Config failed export validation:\n  - " + errors.join("\n  - ")
      );
    }

    return [
      CNBLilypond.header(config),
      CNBLilypond.sectionA(config),
      CNBLilypond.sectionB(config),
      CNBLilypond.sectionC(config),
    ].join("\n");
  },

};

// Internal helpers exposed for unit testing only — not part of the module API.
export const _internals = {
  parseSvgPath,
  slug,
  fmtNum,
  fmtPair,
  escSchemeString,
  pcName,
  durationNames,
  resolveAll,
  usedShapes,
  usedRegistrations,
  registrationFor,
  usedColors,
  attachmentPoints,
  durationLyNumber,
  sectionCFields,
  pcCondition,
};
