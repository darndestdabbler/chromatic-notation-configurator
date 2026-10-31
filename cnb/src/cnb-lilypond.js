/**
 * cnb-lilypond.js — Module 11: LilyPond Exporter
 *
 * Generates .ly file content from a config JSON per CNB-LY-EXPORT-SPEC-v1.2,
 * plus the v1.3 pitch-axis surface (CNB-LY-EXPORT-SPEC-v1_3.md), emitted only
 * when pitchAxis is enabled — disabled configs run the literal v1.2.1 paths.
 * This is a port of the proven export logic in legacy/configurator-core.js
 * (generateSectionA/B, svgPathToLilypond, toSchemeSymbol, and helpers),
 * mapped onto the modular config schema (Architecture Plan §4).
 *
 * Covers the full export: header, Section A (named definitions), Section B
 * (engine settings), Section C (configuration procedure), and generate().
 *
 * Dependencies: Module A (config), Module B (music), Module 24 (pitch axis)
 */

import { CNBConfig } from "./cnb-config.js";
import { CNBMusic } from "./cnb-music.js";
import { CNBPitchAxis } from "./cnb-pitch-axis.js";

// ─── Engine defaults (LY spec §5.2 / Appendix A) ─────────────────────────────
// Values the CNB engine assumes when a setting is not emitted. Section B
// emits a setting only when the config differs from these (emit-if-changed).

const ENGINE_DEFAULTS = {
  falseHollow: false,
  multinotePadding: -0.5,
  defaultMagnify: "7/4",
  indent: 0,
  collisionThreshold: 2,
  stemThickness: null,          // null = engine auto-computes
  staffLineColor: "#000000",
  // Canonical thickness unit is % of semitone height (LY spec §5.3, default
  // 20% for staff lines). Emit-if-changed is evaluated at the pct level; the
  // emitted value is the converted absolute (staff-space) thickness.
  staffLineThicknessPct: 20,
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

/** Scheme-safe slug: lowercase, non-alphanumerics collapsed to hyphens. */
function slug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Format a number for Scheme output: integer as-is, else max 4 decimals. */
function fmtNum(n) {
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(4)));
}

/** Format an {x, y} point as a Scheme pair body: "x . y". */
function fmtPair(pt) {
  return `${fmtNum(pt.x)} . ${fmtNum(pt.y)}`;
}

/** Escape a string for a Scheme string literal. */
function escSchemeString(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
 * Returns a flat array of { pc, duration, shape, hollow, color } where color
 * is the rule's explicit hex or null (= use palette / default black).
 */
function resolveAll(config) {
  const results = [];
  for (const duration of durationNames(config)) {
    for (let pc = 0; pc < 12; pc++) {
      const r = CNBConfig.resolveNotehead(config, pc, duration, null);
      results.push({ pc, duration, shape: r.shape, hollow: r.hollow, color: r.color });
    }
  }
  return results;
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

/** Palette entry hex for a pc from an entries array, or null. */
function paletteHexFor(entries, pc) {
  const entry = (entries || []).find(c => c.pc === pc);
  return entry ? entry.hex : null;
}

/**
 * Scheme symbol for a color hex. Prefers config.palette.schemeSymbols
 * (generated via nearestColorName at palette-selection time so symbols stay
 * consistent between exports); falls back to "color-<hex>" when the map has
 * no entry — the cnb modules carry no color-naming library of their own.
 */
function colorSymbolFor(config, hex) {
  const symbols = (config.palette && config.palette.schemeSymbols) || {};
  if (symbols[hex]) return symbols[hex];
  const lower = hex.toLowerCase();
  for (const [key, sym] of Object.entries(symbols)) {
    if (key.toLowerCase() === lower) return sym;
  }
  return CNBLilypond.toSchemeSymbol("color", hex);
}

/**
 * Collect the unique non-black colors used by the resolved notehead configs,
 * in first-use (pc) order. Each entry carries the primary hex, its CB-safe
 * alternative (palette pairing by pc, identity when unknown), and its symbol.
 * Also reports whether default black is used by any pc.
 */
function usedColors(config) {
  const palette = config.palette || {};

  // Map primary palette hex → CB-safe hex, paired by pitch class.
  const cbByHex = {};
  for (const entry of (palette.colors || [])) {
    const cb = paletteHexFor(palette.cbSafeColors, entry.pc);
    cbByHex[entry.hex.toLowerCase()] = cb || entry.hex;
  }

  const colors = [];
  const seen = new Set();
  let hasBlack = false;

  for (const r of resolveAll(config)) {
    // Effective export color: explicit rule hex, else palette primary, else black.
    const hex = r.color !== null ? r.color : paletteHexFor(palette.colors, r.pc);
    if (!hex || hex.toLowerCase() === "#000000") {
      hasBlack = true;
      continue;
    }
    const lower = hex.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    colors.push({
      hex,
      cbHex: cbByHex[lower] || hex,
      symbol: colorSymbolFor(config, hex),
    });
  }

  return { colors, hasBlack };
}

/**
 * Convert a shape's stem anchors to LilyPond attachment points, in
 * staff-space units (what cnb:register-attachment! consumes).
 *
 * shape.lilypondAnchors is canonically in SEMITONE units (the importer's
 * toLilypondAnchors output — SVG units ÷ units-per-semitone, Y-inverted).
 * The staff-space conversion (÷ semitonesPerStaffSpace) happens HERE, at
 * export time, because the target unit depends on the staff config, which
 * can change after a shape is imported (007-s1 discrepancy D5).
 *
 * Fallback for shapes without lilypondAnchors: shape.anchors in native SVG
 * units → ÷ coordScale (SVG units per semitone), Y-inverted → ÷ sps.
 * Both paths therefore emit identical values for the same shape.
 * Returns null for stemless shapes (both anchor sets null).
 *
 * @param {object} shape  config.shapes entry
 * @param {number} sps    staff.semitonesPerStaffSpace
 */
function attachmentPoints(shape, sps) {
  const spsDiv = sps || 1;
  const round4 = (v) => Math.round(v * 10000) / 10000;

  if (shape.lilypondAnchors) {
    const semiToStaffSpace = (pt) => ({
      x: round4((pt.x || 0) / spsDiv),
      y: round4((pt.y || 0) / spsDiv),
    });
    return {
      crotchetUp:   semiToStaffSpace(shape.lilypondAnchors.crotchetUp   || { x: 0, y: 0 }),
      crotchetDown: semiToStaffSpace(shape.lilypondAnchors.crotchetDown || { x: 0, y: 0 }),
      minimUp:      semiToStaffSpace(shape.lilypondAnchors.minimUp      || { x: 0, y: 0 }),
      minimDown:    semiToStaffSpace(shape.lilypondAnchors.minimDown    || { x: 0, y: 0 }),
    };
  }
  if (!shape.anchors) return null;

  const natH = shape.naturalHeight || 1;
  const semiH = shape.semitoneHeight || natH;
  const coordScale = natH / semiH;

  const toLy = (pt) => ({
    x: round4(pt.x / coordScale / spsDiv),
    y: round4(-pt.y / coordScale / spsDiv),
  });

  return {
    crotchetUp:   toLy(shape.anchors.crotchetUp   || { x: 0, y: 0 }),
    crotchetDown: toLy(shape.anchors.crotchetDown || { x: 0, y: 0 }),
    minimUp:      toLy(shape.anchors.minimUp      || { x: 0, y: 0 }),
    minimDown:    toLy(shape.anchors.minimDown    || { x: 0, y: 0 }),
  };
}

/** Palette display label + mode for header/Section A comments. */
function paletteLabel(config) {
  const palette = config.palette || {};
  return {
    name: palette.name || "None",
    mode: palette.useCBSafe ? "cb-safe" : "standard",
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
 *   color   → explicit rule hex, else palette primary for the pc, else black
 */
function sectionCFields(config, r) {
  const shapes = config.shapes || {};
  const shape = shapes[r.shape];
  const shapeSym = slug(r.shape || "");

  const hasHollowPath = !!(shape && (shape.lilypondHollowPath || shape.svgHollowPath));
  const hollowSym = (r.hollow && hasHollowPath) ? `${shapeSym}-cutout` : "#f";

  const hasAnchors = !!(shape && (shape.lilypondAnchors || shape.anchors));
  const attachSym = hasAnchors ? `${shapeSym}-attach` : "#f";

  const palette = config.palette || {};
  const hex = r.color !== null ? r.color : paletteHexFor(palette.colors, r.pc);
  const colorSym = (!hex || hex.toLowerCase() === "#000000")
    ? "black-000000"
    : colorSymbolFor(config, hex);

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
  const vector = positions.map(fmtNum).join(" ");
  const anchor = fmtNum(axis.positionOfSemi(midpoint));
  const stride = fmtNum(axis.octaveStride);
  const units = fmtNum(axis.unitsPerStaffSpace);
  const distinct = new Set(positions).size;

  const placement = ((config.keys || {}).keySignature || {}).placement || {};
  const tonicOctave = Number.isInteger(placement.tonicOctave)
    ? placement.tonicOctave
    : Math.round((midpoint - 6) / 12);   // CNBKeySignature.tonicSemi auto rule, pc 0

  return [
    `%% Pitch axis (${pa.kind}) — 12 pitch classes on ${distinct} positions/octave`,
    `%% map [${vector}] · octave stride ${stride}`,
    `%% axis units per staff space: ${units} · midpoint semi ${fmtNum(midpoint)} → axis position ${anchor}`,
    "#(set! cnb:get-pitch-staff-position",
    "   (lambda (semitone)",
    "     (let* ((pc (modulo semitone 12))",
    "            (oct (/ (- semitone pc) 12))",
    `            (pos (+ (vector-ref #(${vector}) pc)`,
    `                    (* oct ${stride}))))`,
    `       (/ (* 2 (- pos ${anchor})) ${units}))))`,
    "",
    "%% Key-signature octave — explicit under a pitch axis (engine handoff 008 §4.2)",
    `#(set! cnb:keysig-tonic-octave ${tonicOctave})`,
  ];
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
   * Convert an SVG path `d` string to LilyPond nested-list format.
   * Absolute M/L/C/Z (H/V folded into lineto). Ported from legacy
   * svgPathToLilypond(). No scaling or Y-inversion is applied — pre-baked
   * lilypondPath data is the preferred source (LY spec §4.1); this fallback
   * assumes coordinates already normalized for LilyPond by the toolkit.
   *
   * @param {string} svgPath  SVG path d attribute
   * @param {number} [precision=4]  Decimal places for coordinates
   * @returns {string} e.g. "'(\n    (moveto 0 0.6667)\n    (closepath))"
   */
  svgPathToLilypond(svgPath, precision) {
    if (precision === undefined) precision = 4;
    const cmds = parseSvgPath(svgPath);
    if (cmds.length === 0) return "'()";

    const fmt = (n) => {
      const rounded = parseFloat(n.toFixed(precision));
      return Object.is(rounded, -0) ? "0" : String(rounded);
    };

    const parts = [];
    let curX = 0, curY = 0;

    for (const { cmd, args } of cmds) {
      switch (cmd) {
        case "M":
          parts.push(`(moveto ${fmt(args[0])} ${fmt(args[1])})`);
          curX = args[0]; curY = args[1];
          break;
        case "L":
          parts.push(`(lineto ${fmt(args[0])} ${fmt(args[1])})`);
          curX = args[0]; curY = args[1];
          break;
        case "H":
          parts.push(`(lineto ${fmt(args[0])} ${fmt(curY)})`);
          curX = args[0];
          break;
        case "V":
          parts.push(`(lineto ${fmt(curX)} ${fmt(args[0])})`);
          curY = args[0];
          break;
        case "C":
          parts.push(`(curveto ${fmt(args[0])} ${fmt(args[1])} ${fmt(args[2])} ${fmt(args[3])} ${fmt(args[4])} ${fmt(args[5])})`);
          curX = args[4]; curY = args[5];
          break;
        case "Z":
        case "z":
          parts.push(`(closepath)`);
          break;
        default:
          // Skip unsupported commands (S, Q, T, A, relatives) — the toolkit
          // normalizes paths to absolute M/L/C/Z before they reach a config.
          break;
      }
    }

    return "'(\n    " + parts.join("\n    ") + ")";
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
   * Compute cnb:staff-line-positions values from the staff config: expand
   * semitonePattern across the two-octave card range (octaves 0 and 1),
   * then 2 × (S - midpoint) / semitonesPerStaffSpace — LilyPond staff
   * positions are HALF-staff-spaces from center (LY spec §5.1; engine
   * cnb/config.ly). 4-8 system, midpoint 12, sps 4 → [-4, -2, 2, 4];
   * 3-6-9, midpoint 12, sps 3 → [-6, -4, -2, 2, 4, 6] (007-s1 D2).
   * Non-integer results are kept as decimals (plan open question 7).
   * Under an enabled pitch axis the v1.3 §5.4a axis formula applies instead:
   * 2 × (pos(S) − pos(midpoint)) / axisUnitsPerStaffSpace, deduplicated
   * (pattern lines may collapse onto one axis position) and sorted.
   *
   * @param {object} config
   * @returns {number[]}
   */
  computeStaffLinePositions(config) {
    const staff = config.staff || {};
    const pattern = (staff.semitonePattern || []).slice().sort((a, b) => a - b);
    const midpoint = staff.midpoint || 0;

    const axis = CNBPitchAxis.create(config);
    if (axis.enabled) {
      const anchor = axis.positionOfSemi(midpoint);
      const unique = new Set();
      for (const oct of [0, 1]) {
        for (const s of pattern) {
          unique.add(2 * (axis.positionOfSemi(s + oct * 12) - anchor) / axis.unitsPerStaffSpace);
        }
      }
      return [...unique].sort((a, b) => a - b);
    }

    const sps = staff.semitonesPerStaffSpace || 1;

    const positions = [];
    for (const oct of [0, 1]) {
      for (const s of pattern) {
        positions.push(2 * (s + oct * 12 - midpoint) / sps);
      }
    }
    return positions.sort((a, b) => a - b);
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
    const pal = paletteLabel(config);
    const rule = "%% " + "%".repeat(76);

    const lines = [];
    lines.push(`\\version "${engine.lilypondVersion || "2.24.2"}"`);
    lines.push(`\\include "ChromaticNotationBase.ly"`);
    lines.push("");
    lines.push(rule);
    lines.push("%%");
    lines.push(`%% ${meta.notationLabel || "Untitled"} — Generated by Chromatic Configurator`);
    lines.push(`%% Date: ${new Date().toISOString().split("T")[0]}`);
    lines.push(`%% Configurator version: ${CNBConfig.VERSION}`);
    lines.push("%%");
    lines.push("%% DO NOT EDIT BY HAND — regenerate from the Configurator.");
    if (meta.configName) {
      lines.push(`%% Source: ${meta.configName}.json`);
    }
    lines.push("%%");
    lines.push(`%% Color palette: ${pal.name} (${pal.mode})`);
    lines.push("%% Set cnb:use-accessible-colors to #t before \\include to use");
    lines.push("%% the colorblind-safe alternative palette.");
    lines.push("%%");
    lines.push(rule);
    lines.push("");

    return lines.join("\n");
  },

  /**
   * Generate Section A — named definitions (LY spec §4):
   * A1 path definitions, A2 path registrations, A3 hollow cutout
   * registrations, A4 stem attachment registrations (4-point model),
   * A5 color registrations with the cnb:use-accessible-colors conditional.
   * @param {object} config
   * @returns {string}
   */
  sectionA(config) {
    const shapes = config.shapes || {};
    const shapeNames = usedShapes(config);

    const lines = [];
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%     SECTION A — NAMED DEFINITIONS");
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("");

    // A1. Path variable definitions
    lines.push("%% --- Path variables ---");
    for (const name of shapeNames) {
      const shape = shapes[name];
      const sym = slug(name);

      // Prefer the pre-baked LilyPond path from data-lilypond-notehead.
      const pathDef = shape.lilypondPath || CNBLilypond.svgPathToLilypond(shape.svgPath);
      lines.push(`#(define cnb:${sym}-path ${pathDef})`);
      lines.push("");

      if (shape.lilypondHollowPath || shape.svgHollowPath) {
        const hollowDef = shape.lilypondHollowPath || CNBLilypond.svgPathToLilypond(shape.svgHollowPath);
        lines.push(`#(define cnb:${sym}-cutout-path ${hollowDef})`);
        lines.push("");
      }
    }

    // A2. Path registrations
    lines.push("%% --- Register paths ---");
    for (const name of shapeNames) {
      const sym = slug(name);
      lines.push(`#(cnb:register-path! '${sym} cnb:${sym}-path)`);
    }
    lines.push("");

    // A3. Hollow cutout registrations
    const hollowShapes = shapeNames.filter(n => shapes[n].lilypondHollowPath || shapes[n].svgHollowPath);
    if (hollowShapes.length > 0) {
      lines.push("%% --- Register hollow cutouts ---");
      for (const name of hollowShapes) {
        const sym = slug(name);
        lines.push(`#(cnb:register-hollow! '${sym}-cutout cnb:${sym}-cutout-path)`);
      }
      lines.push("");
    }

    // A4. Stem attachment registrations (4-point model), converted to
    // staff-space units against the current staff config (D5) — under a
    // pitch axis, ÷ axisUnitsPerStaffSpace instead (v1.3 §4.4a).
    const axis = CNBPitchAxis.create(config);
    const attachSps = axis.enabled
      ? axis.unitsPerStaffSpace
      : (config.staff || {}).semitonesPerStaffSpace || 1;
    lines.push("%% --- Register stem attachments ---");
    for (const name of shapeNames) {
      const sym = slug(name);
      const pts = attachmentPoints(shapes[name], attachSps);
      if (!pts) {
        lines.push(`%% ${sym}: stemless — no attachment registered`);
        lines.push("");
        continue;
      }
      lines.push(`#(cnb:register-attachment! '${sym}-attach`);
      lines.push(`   (list`);
      lines.push(`     (cons 'crotchet-up   '(${fmtPair(pts.crotchetUp)}))`);
      lines.push(`     (cons 'crotchet-down '(${fmtPair(pts.crotchetDown)}))`);
      lines.push(`     (cons 'minim-up      '(${fmtPair(pts.minimUp)}))`);
      lines.push(`     (cons 'minim-down    '(${fmtPair(pts.minimDown)}))))`);
      lines.push("");
    }

    // A5. Color registrations — with accessible color switching (LY spec §4.5)
    const { colors, hasBlack } = usedColors(config);
    if (colors.length > 0) {
      const pal = paletteLabel(config);
      lines.push("%% Color registrations");
      lines.push(`%% Primary palette: ${pal.name} (${pal.mode})`);
      lines.push("%% Accessible palette: CB-safe alternative from the palette");
      lines.push("%%");
      lines.push("%% Usage: Set cnb:use-accessible-colors to #t before \\include");
      lines.push("%% to activate the colorblind-safe alternative.");
      lines.push("");

      lines.push("#(if (and (defined? 'cnb:use-accessible-colors) cnb:use-accessible-colors)");
      lines.push("  (begin");
      lines.push("    ;; Accessible (colorblind-safe) palette");
      for (const c of colors) {
        lines.push(`    (cnb:register-color! '${c.symbol} "${c.cbHex}")`);
      }
      lines.push("  )");
      lines.push("  (begin");
      lines.push("    ;; Primary palette");
      for (const c of colors) {
        lines.push(`    (cnb:register-color! '${c.symbol} "${c.hex}")`);
      }
      lines.push("  ))");
      lines.push("");
    }

    // Default black is identical in both branches — register unconditionally.
    if (hasBlack) {
      lines.push(`#(cnb:register-color! 'black-000000 "#000000")`);
      lines.push("");
    }

    return lines.join("\n");
  },

  /**
   * Generate Section B — engine settings (LY spec §5):
   * B1 staff geometry (always), B2 emit-if-changed engine settings and
   * staff-line styling, B3 metadata.
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
    lines.push(`#(set! cnb:semitones-per-staff-space ${fmtNum(sps)})`);
    lines.push(`#(set! cnb:staff-line-positions '(${positions.map(fmtNum).join(" ")}))`);
    lines.push("");

    if (axis.enabled) {
      lines.push(...pitchAxisLines(config, axis));
      lines.push("");
    }

    // B2. Emit-if-changed engine settings
    const changed = [];
    if ((engine.falseHollow || false) !== d.falseHollow) {
      changed.push(`#(set! cnb:false-hollow ${engine.falseHollow ? "#t" : "#f"})`);
    }
    if (engine.multinotePadding !== undefined && engine.multinotePadding !== d.multinotePadding) {
      changed.push(`#(set! cnb:multinote-padding ${fmtNum(engine.multinotePadding)})`);
    }
    if (engine.defaultMagnify !== undefined && String(engine.defaultMagnify) !== d.defaultMagnify) {
      changed.push(`#(set! cnb:default-magnify ${engine.defaultMagnify})`);
    }
    if (engine.indent !== undefined && engine.indent !== d.indent) {
      changed.push(`#(set! cnb:indent ${fmtNum(engine.indent)})`);
    }
    if (engine.collisionThreshold !== undefined && engine.collisionThreshold !== d.collisionThreshold) {
      changed.push(`#(set! cnb:collision-threshold ${fmtNum(engine.collisionThreshold)})`);
    }

    // Staff-line styling (LY spec §5.3): thickness is canonical as % of
    // semitone height; the emitted absolute value is
    //   (pct / 100) × (1 / semitonesPerStaffSpace)   [staff-space units]
    // (÷ axisUnitsPerStaffSpace under a pitch axis — v1.3 §5.3a; see sps).
    // Emit-if-changed is judged against the canonical default (20%), not the
    // engine's absolute default — the converted value and the engine default
    // live on different scales.
    const lineDefaults = staff.lineDefaults || {};
    const thicknessPct = lineDefaults.thicknessPct !== undefined ? lineDefaults.thicknessPct : d.staffLineThicknessPct;
    if (thicknessPct !== d.staffLineThicknessPct) {
      const absolute = (thicknessPct / 100) * (1 / sps);
      changed.push(`#(set! cnb:default-staff-line-thickness ${fmtNum(absolute)})`);
    }
    const staffColor = lineDefaults.color || d.staffLineColor;
    if (staffColor.toLowerCase() !== d.staffLineColor) {
      changed.push(`#(set! cnb:default-staff-line-color "${staffColor}")`);
    }

    if (engine.stemThickness !== null && engine.stemThickness !== undefined) {
      changed.push(`#(set! cnb:stem-thickness ${fmtNum(engine.stemThickness)})`);
    }

    if (changed.length > 0) {
      lines.push("%% Engine settings (non-default)");
      lines.push(...changed);
      lines.push("");
    }

    // B3. Metadata — always emitted (footnote only when non-empty)
    lines.push("%% Metadata");
    lines.push(`#(set! cnb:file-suffix "${escSchemeString(meta.fileSuffix || "")}")`);
    lines.push(`#(set! cnb:notation-label "${escSchemeString(meta.notationLabel || "")}")`);
    if (meta.notationFootnote) {
      lines.push(`#(set! cnb:notation-footnote`);
      lines.push(`  "${escSchemeString(meta.notationFootnote)}")`);
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

    // Resolve the full pc × duration matrix, normalized to emission fields.
    // The x-offset field's whole lifecycle is axis-gated (v1.3 §6.3): 0 on a
    // linear config whatever the rules say, and a 0 is never emitted.
    const axisOn = CNBPitchAxis.create(config).enabled;
    const durations = durationNames(config);
    const byDuration = {};
    for (const duration of durations) {
      byDuration[duration] = [];
      for (let pc = 0; pc < 12; pc++) {
        const r = CNBConfig.resolveNotehead(config, pc, duration, null);
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
        const key = sectionCKey(f);
        if (!groups[key]) groups[key] = { fields: f, pitchClasses: [] };
        groups[key].pitchClasses.push(pc);
      }
      return Object.values(groups).sort((a, b) => a.pitchClasses[0] - b.pitchClasses[0]);
    };

    const emitClause = (comment, condition, f) => {
      lines.push(`         ;; ${comment}`);
      lines.push(`         (${condition}`);
      lines.push(`          '((shape      . ${f.shapeSym})`);
      lines.push(`            (color      . ${f.colorSym})`);
      lines.push(`            (hollow     . ${f.hollowSym})`);
      lines.push(`            (attachment . ${f.attachSym})`);
      lines.push(`            (off-key-mark . #f)`);
      if (f.xOffset) lines.push(`            (x-offset   . ${fmtNum(f.xOffset)})`);
      lines.push(`            (repeat     . ${repeat})))`);
      lines.push("");
    };

    const offsetLabel = (f) => !f.xOffset ? ""
      : `, ${f.xOffset > 0 ? "+" : ""}${fmtNum(f.xOffset)} staff-space ${f.xOffset > 0 ? "right" : "left"}`;

    lines.push("#(set! cnb:get-notehead-config");
    lines.push("   (lambda (semitone duration key)");
    lines.push("     (let ((pc (modulo semitone 12)))");
    lines.push("       (cond");

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
          `(and ${pcCondition(group.pitchClasses, "pc")} (= duration ${lyNum}))`,
          group.fields
        );
      }
    }

    // Fallback (unreachable when all 12 pcs are covered — safety net, as in
    // the legacy exporter, which also forces hollow #f here).
    const fb = byDuration[durations[0]][0];
    lines.push("         ;; Fallback");
    lines.push(`         (else`);
    lines.push(`          '((shape      . ${fb.shapeSym})`);
    lines.push(`            (color      . ${fb.colorSym})`);
    lines.push(`            (hollow     . #f)`);
    lines.push(`            (attachment . ${fb.attachSym})`);
    lines.push(`            (off-key-mark . #f)`);
    if (fb.xOffset) lines.push(`            (x-offset   . ${fmtNum(fb.xOffset)})`);
    lines.push(`            (repeat     . ${repeat})))))))`);
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
  usedColors,
  attachmentPoints,
  durationLyNumber,
  sectionCFields,
  pcCondition,
};
