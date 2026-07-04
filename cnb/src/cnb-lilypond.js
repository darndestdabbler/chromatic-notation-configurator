/**
 * cnb-lilypond.js — Module 11: LilyPond Exporter
 *
 * Generates .ly file content from a config JSON per CNB-LY-EXPORT-SPEC-v1.2.
 * This is a port of the proven export logic in legacy/configurator-core.js
 * (generateSectionA/B, svgPathToLilypond, toSchemeSymbol, and helpers),
 * mapped onto the modular config schema (Architecture Plan §4).
 *
 * Session 1 scope: header + Section A (named definitions) + Section B
 * (engine settings) + helpers. Section C and generate() land in Session 2.
 *
 * Dependencies: Module A (config), Module B (music)
 */

import { CNBConfig } from "./cnb-config.js";
import { CNBMusic } from "./cnb-music.js";

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
 * Convert a shape's stem anchors to LilyPond attachment points.
 * Prefers shape.lilypondAnchors (already in LilyPond units, converted at
 * import time). Falls back to converting shape.anchors from native SVG
 * units: ÷ coordScale (SVG units per semitone), Y-inverted (SVG Y-down →
 * LilyPond Y-up) — same conversion as legacy buildAttachmentPoints().
 * Returns null for stemless shapes (both anchor sets null).
 */
function attachmentPoints(shape) {
  if (shape.lilypondAnchors) return shape.lilypondAnchors;
  if (!shape.anchors) return null;

  const natH = shape.naturalHeight || 1;
  const semiH = shape.semitoneHeight || natH;
  const coordScale = natH / semiH;

  const toLy = (pt) => ({
    x: Math.round((pt.x / coordScale) * 10000) / 10000,
    y: Math.round((-pt.y / coordScale) * 10000) / 10000,
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
   * Compute cnb:staff-line-positions values from the staff config
   * (Architecture Plan §4.3): expand semitonePattern across the two-octave
   * card range (octaves 0 and 1), then (S - midpoint) / semitonesPerStaffSpace.
   * 4-8 system, midpoint 12, sps 4 → [-2, -1, 1, 2].
   * Non-integer results are kept as decimals (plan open question 7).
   *
   * @param {object} config
   * @returns {number[]}
   */
  computeStaffLinePositions(config) {
    const staff = config.staff || {};
    const pattern = (staff.semitonePattern || []).slice().sort((a, b) => a - b);
    const midpoint = staff.midpoint || 0;
    const sps = staff.semitonesPerStaffSpace || 1;

    const positions = [];
    for (const oct of [0, 1]) {
      for (const s of pattern) {
        positions.push((s + oct * 12 - midpoint) / sps);
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

    // A4. Stem attachment registrations (4-point model)
    lines.push("%% --- Register stem attachments ---");
    for (const name of shapeNames) {
      const sym = slug(name);
      const pts = attachmentPoints(shapes[name]);
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

    // B1. Staff geometry — always emitted
    lines.push("%% Staff geometry");
    const sps = staff.semitonesPerStaffSpace || 1;
    const positions = CNBLilypond.computeStaffLinePositions(config);
    lines.push(`#(set! cnb:semitones-per-staff-space ${fmtNum(sps)})`);
    lines.push(`#(set! cnb:staff-line-positions '(${positions.map(fmtNum).join(" ")}))`);
    lines.push("");

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
    //   (pct / 100) × (1 / semitonesPerStaffSpace)   [staff-space units].
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
};
