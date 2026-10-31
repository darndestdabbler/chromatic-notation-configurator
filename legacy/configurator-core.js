/**
 * configurator-core.js — ChromaticNotationBase Configurator Core Logic
 *
 * All pure/testable functions for the Chromatic Configurator.
 * No DOM access. No side effects. Import this from both the main
 * app and the test runner.
 *
 * Version: 4.0
 * Date: February 2026
 *
 * v4.0 changes:
 *   - Cumulative notehead rules: shape/hollow/color as separate rule types
 *   - Palette-based color system (noteheadPalette replaces colors dict)
 *   - Accessible color switching (conditional color registration in Section A)
 *   - Section C generated from resolved configs with memv grouping
 *   - Color name pipeline: nearestColorName → toSchemeSymbol
 *   - v3→v4 migration
 *
 * v3.0 changes:
 *   - mapChrom/mapStaff replaced by noteheadRules/staffRules (rule-based model)
 *   - Pre-baked LilyPond path support (lilypondPath, lilypondHollow fields)
 *   - New shape fields: semitoneHeight, naturalWidth
 *   - Vector model flag removed (procedure model is the only model)
 *   - v1→v2→v3 migration chain
 */

"use strict";

const Core = (() => {

// ═══════════════════════════════════════════════════════════════════════════
//  0. DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════════════

// MusicColorPalettes: loaded via <script> in browser, require() in Node
const MCP = (typeof require !== 'undefined')
    ? require('./music-color-palettes.js')
    : (typeof window !== 'undefined' ? window.MusicColorPalettes : null);

// ═══════════════════════════════════════════════════════════════════════════
//  1. CONSTANTS & PRESETS
// ═══════════════════════════════════════════════════════════════════════════

const VERSION = "4.0";

const PITCH_CLASS_NAMES = [
    "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"
];

const DURATION_CATEGORIES = [
    { value: 0, label: "Breve+" },
    { value: 1, label: "Whole" },
    { value: 2, label: "Half" },
    { value: 3, label: "Quarter+" }
];

const OFF_KEY_MODES = [
    { value: "none",         label: "None" },
    { value: "dot",          label: "Dot" },
    { value: "ring",         label: "Ring" },
    { value: "tick",         label: "Tick" },
    { value: "sharp-sign",   label: "Sharp sign" },
    { value: "flat-sign",    label: "Flat sign" },
    { value: "natural-sign", label: "Natural sign" }
];

/**
 * Color palette presets from cnb/colors.ly
 */
const COLOR_PRESETS = {
    "Rich Tricolor": {
        "color-primary":   "#7d3fff",
        "color-secondary": "#dc4538",
        "color-tertiary":  "#0f9e59"
    },
    "Colorblind-Safe Tricolor": {
        "color-primary":   "#50b4e9",
        "color-secondary": "#cc79a7",
        "color-tertiary":  "#000000"
    },
    "CNB 12-Semitone": {
        "color-violet":     "#8400cd",
        "color-gold":       "#ffc33b",
        "color-blue":       "#0058cb",
        "color-orange":     "#ff6e3a",
        "color-teal":       "#009f81",
        "color-rose":       "#ff5aaf",
        "color-slate":      "#4a5568",
        "color-pink":       "#ffb2fd",
        "color-chartreuse": "#a8a000",
        "color-sky":        "#00c2f9",
        "color-crimson":    "#e20134",
        "color-mint":       "#00fccf"
    },
    "Monochrome": {
        "color-primary": "#000000"
    }
};

/**
 * Engine setting defaults — matches cnb/config.ly
 */
const ENGINE_DEFAULTS = {
    falseHollow:          false,
    multinotePadding:     -0.5,
    defaultMagnify:       1.75,   // 7/4
    collisionThreshold:   2,
    staffLineThickness:   2,
    staffLineColor:       "#000000",
    indent:               0,
    ledgerExtendRange:    30,
    stemThickness:        null    // null = auto-compute from notehead height
};

/**
 * Valid preset keys for palettes — maps to MusicColorPalettes sizes.
 */
const PALETTE_PRESET_KEYS = {
    'dark2-2':  { size: 2,  label: 'Dark2 · 2 colors' },
    'dark2-3':  { size: 3,  label: 'Dark2 · 3 colors' },
    'dark2-4':  { size: 4,  label: 'Dark2 · 4 colors' },
    'dark2-6':  { size: 6,  label: 'Dark2 · 6 colors' },
    'dark2-7':  { size: 7,  label: 'Dark2 · 7 colors' },
    'dark2-11': { size: 11, label: 'Dark2 · 11 colors' },
    'cbsafe-2':  { size: 2,  label: 'CB-Safe · 2 colors' },
    'cbsafe-3':  { size: 3,  label: 'CB-Safe · 3 colors' },
    'cbsafe-4':  { size: 4,  label: 'CB-Safe · 4 colors' },
    'cbsafe-6':  { size: 6,  label: 'CB-Safe · 6 colors' },
    'cbsafe-7':  { size: 7,  label: 'CB-Safe · 7 colors' },
    'cbsafe-11': { size: 11, label: 'CB-Safe · 11 colors' }
};

/**
 * Default notehead palette.
 */
const DEFAULT_NOTEHEAD_PALETTE = {
    mode: 'standard',       // 'standard' or 'cbsafe'
    selected: 'preset',     // 'preset' or 'custom'
    presetKey: 'dark2-3',
    customColors: []
};


// ═══════════════════════════════════════════════════════════════════════════
//  2. DATA MODEL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a fresh default App state.
 */
function createDefaultApp() {
    return {
        meta: {
            version: VERSION,
            name: "",
            label: "",
            suffix: "",
            footnote: ""
        },
        layout: { pxPerSemi: 20 },
        notehead: { heightInSemitones: 4.0, verticalOffset: 0 },
        engine: { ...ENGINE_DEFAULTS },
        defs: {},
        noteheadPalette: { ...DEFAULT_NOTEHEAD_PALETTE },
        styles: {
            "staff":    { color: "#000000", thickness: 1, dash: null },
            "ledger":   { color: "#000000", thickness: 1, dash: null }
        },
        noteheadRules: [],
        staffRules: []
    };
}

/**
 * Migrate an older App state to the current version.
 * Handles v1.0 → v2.0 → v3.0 migration chain.
 */
function migrateApp(app) {
    const v = app.meta?.version || "1.0";

    if (v === "1.0") {
        // --- v1.0 → v2.0 migration ---

        // Add engine settings with defaults
        if (!app.engine) {
            app.engine = { ...ENGINE_DEFAULTS };
        }

        // Add missing meta fields
        app.meta.version = "2.0";
        if (!app.meta.label)    app.meta.label = app.meta.name || "";
        if (!app.meta.suffix)   app.meta.suffix = "";
        if (!app.meta.footnote) app.meta.footnote = "";

        // Migrate colors: extract unique hex colors from mapChrom, create named entries
        if (!app.colors) {
            app.colors = {};
            const hexToName = {};
            let colorIdx = 0;
            if (app.mapChrom) {
                app.mapChrom.forEach(row => {
                    if (row.color && typeof row.color === "string" && row.color.startsWith("#")) {
                        if (!hexToName[row.color]) {
                            const name = `color-${colorIdx}`;
                            hexToName[row.color] = name;
                            app.colors[name] = row.color;
                            colorIdx++;
                        }
                        row.color = hexToName[row.color];
                    }
                });
            }
        }

        // Migrate shape defs: mark for overlapPercent backfill
        if (app.defs) {
            Object.values(app.defs).forEach(def => {
                if (def.overlapPercent === undefined) {
                    def.overlapPercent = null;
                }
            });
        }
    }

    if (v === "1.0" || v === "2.0") {
        // --- v2.0 → v3.0 migration ---
        app.meta.version = "3.0";

        // Migrate mapChrom → noteheadRules
        if (app.mapChrom && !app.noteheadRules) {
            app.noteheadRules = migrateMapChromToRules(app.mapChrom);
        }
        if (!app.noteheadRules) {
            app.noteheadRules = [];
        }

        // Migrate mapStaff → staffRules
        if (app.mapStaff && !app.staffRules) {
            app.staffRules = migrateMapStaffToRules(app.mapStaff);
        }
        if (!app.staffRules) {
            app.staffRules = [];
        }

        // Clean up legacy arrays
        delete app.mapChrom;
        delete app.mapStaff;

        // Add new shape model fields (nullable)
        if (app.defs) {
            Object.values(app.defs).forEach(def => {
                if (def.lilypondPath === undefined)   def.lilypondPath = null;
                if (def.lilypondHollow === undefined)  def.lilypondHollow = null;
                if (def.semitoneHeight === undefined)   def.semitoneHeight = def.naturalHeight || null;
                if (def.naturalWidth === undefined)     def.naturalWidth = def.naturalHeight || null;
                if (def.type === undefined)             def.type = "notehead";
                if (def.isFalseHollow === undefined)   def.isFalseHollow = false;
            });
        }
    }

    if (v === "1.0" || v === "2.0" || v === "3.0") {
        // --- v3.0 → v4.0 migration ---
        app.meta.version = VERSION;

        // Migrate monolithic noteheadRules to cumulative rules
        if (app.noteheadRules && app.noteheadRules.length > 0 &&
            app.noteheadRules[0].ruleType === undefined) {
            app.noteheadRules = migrateMonolithicToCumulative(app.noteheadRules);
            // Resolve named color references to hex values
            if (app.colors) {
                resolveColorRefsInRules(app.noteheadRules, app.colors);
            }
        }

        // Migrate App.colors → App.noteheadPalette
        if (app.colors && !app.noteheadPalette) {
            app.noteheadPalette = migrateColorsToPalette(app.colors);
        }
        if (!app.noteheadPalette) {
            app.noteheadPalette = { ...DEFAULT_NOTEHEAD_PALETTE };
        }
        delete app.colors;
    }

    // --- Post-migration cleanup (applies to all versions) ---

    // Remove deprecated defaultOverlapPercent from engine; set per-shape defaults
    if (app.engine && app.engine.defaultOverlapPercent !== undefined) {
        const oldGlobal = app.engine.defaultOverlapPercent;
        delete app.engine.defaultOverlapPercent;
        if (app.defs) {
            Object.values(app.defs).forEach(def => {
                if (def.overlapPercent === null || def.overlapPercent === undefined) {
                    def.overlapPercent = oldGlobal;
                }
            });
        }
    }

    // Ensure stemThickness exists in engine
    if (app.engine && app.engine.stemThickness === undefined) {
        app.engine.stemThickness = null;
    }

    // Ensure all shape defs have overlapPercent (non-null)
    if (app.defs) {
        Object.values(app.defs).forEach(def => {
            if (def.overlapPercent === null || def.overlapPercent === undefined) {
                def.overlapPercent = 25;
            }
        });
    }

    return app;
}

/**
 * Migrate v2 mapChrom (12-element array) to noteheadRules.
 * Groups identical configs into rules with pitch-class sets.
 *
 * @param {Array} mapChrom - 12-element array of {shape, color, hollow}
 * @returns {Array} noteheadRules
 */
function migrateMapChromToRules(mapChrom) {
    const groups = {};
    mapChrom.forEach((row, i) => {
        if (!row.shape) return;
        const key = `${row.shape}|${row.color}|${row.hollow}`;
        if (!groups[key]) groups[key] = { ...row, pitchClasses: [] };
        groups[key].pitchClasses.push(i);
    });
    return Object.values(groups).map(g => ({
        shape: g.shape,
        color: g.color,
        hollow: g.hollow,
        pitchClasses: g.pitchClasses.length === 12 ? 'all' : g.pitchClasses,
        durations: 'all',
        keys: 'all'
    }));
}

/**
 * Migrate v2 mapStaff (12-element array) to staffRules.
 * Groups identical configs into rules with pitch-class sets.
 *
 * @param {Array} mapStaff - 12-element array of {type, style, override}
 * @returns {Array} staffRules
 */
function migrateMapStaffToRules(mapStaff) {
    const groups = {};
    mapStaff.forEach((row, i) => {
        if (row.type === 'none') return;
        const key = `${row.type}|${row.style}`;
        if (!groups[key]) groups[key] = { type: row.type, style: row.style, override: row.override, pitchClasses: [] };
        groups[key].pitchClasses.push(i);
    });
    return Object.values(groups).map(g => ({
        type: g.type,
        style: g.style,
        override: g.override,
        pitchClasses: g.pitchClasses.length === 12 ? 'all' : g.pitchClasses,
        keys: 'all'
    }));
}

/**
 * Migrate v3 monolithic noteheadRules to v4 cumulative rules.
 * Each old rule (shape + color + hollow) becomes up to 3 separate rules.
 *
 * @param {Array} oldRules - v3-style rules with shape, color, hollow fields
 * @returns {Array} cumulative rules with ruleType field
 */
function migrateMonolithicToCumulative(oldRules) {
    const newRules = [];
    for (const rule of oldRules) {
        // Shape rule (always emit if shape is set)
        if (rule.shape) {
            newRules.push({
                ruleType: 'shape',
                shape: rule.shape,
                pitchClasses: rule.pitchClasses,
                durations: rule.durations || 'all',
                keys: rule.keys || 'all'
            });
        }
        // Hollow rule (only if hollow is true)
        if (rule.hollow) {
            newRules.push({
                ruleType: 'hollow',
                hollow: true,
                pitchClasses: rule.pitchClasses,
                durations: rule.durations || 'all',
                keys: rule.keys || 'all'
            });
        }
        // Color rule (only if color is set and is a hex value)
        if (rule.color) {
            // In v3, color was a named reference (e.g. 'color-primary').
            // We need the hex value. The caller should have the colors dict
            // available, but during migration we store the name as-is and
            // resolve it in the migration caller.
            newRules.push({
                ruleType: 'color',
                color: rule.color,  // hex or name — resolved by migrateApp
                pitchClasses: rule.pitchClasses,
                durations: rule.durations || 'all',
                keys: rule.keys || 'all'
            });
        }
    }
    return newRules;
}

/**
 * Migrate v3 App.colors dict to v4 noteheadPalette.
 * Creates a custom palette from the existing color hex values.
 *
 * @param {object} colors - { name: hex } dictionary
 * @returns {object} noteheadPalette state
 */
function migrateColorsToPalette(colors) {
    const hexValues = Object.values(colors || {}).filter(h =>
        typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h)
    );
    if (hexValues.length === 0) {
        return { ...DEFAULT_NOTEHEAD_PALETTE };
    }
    // Deduplicate and filter out black (black is the default, not a palette color)
    const unique = [...new Set(hexValues.map(h => h.toLowerCase()))]
        .filter(h => h !== '#000000');
    if (unique.length === 0) {
        return { ...DEFAULT_NOTEHEAD_PALETTE };
    }
    return {
        mode: 'standard',
        selected: 'custom',
        presetKey: 'dark2-3',
        customColors: unique
    };
}

/**
 * Resolve color references in migrated cumulative rules.
 * Converts v3 named color references to hex values using the old colors dict.
 *
 * @param {Array} rules - cumulative rules (may have named color refs)
 * @param {object} colors - old { name: hex } dictionary
 */
function resolveColorRefsInRules(rules, colors) {
    for (const rule of rules) {
        if (rule.ruleType === 'color' && rule.color && colors) {
            // If it's a named reference (not a hex value), resolve it
            if (!rule.color.startsWith('#') && colors[rule.color]) {
                rule.color = colors[rule.color];
            }
        }
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  3. SVG PATH PARSING & CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse an SVG path `d` attribute string into a command array.
 * Handles: M, L, C, Z (absolute only — Baker should normalize).
 * Also handles H, V for robustness.
 *
 * @param {string} d - SVG path d attribute
 * @returns {Array<{cmd: string, args: number[]}>}
 */
function parseSvgPath(d) {
    if (!d || typeof d !== "string") return [];

    const commands = [];
    // Match command letter followed by its numeric arguments
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
 * Convert an SVG path `d` string to LilyPond nested-list format string.
 *
 * @param {string} d - SVG path d attribute (absolute commands only: M, L, C, Z, H, V)
 * @param {number} [precision=4] - Decimal places for coordinates
 * @returns {string} LilyPond path string, e.g. "'((moveto 0 0.6667) (lineto ...))"
 */
function svgPathToLilypond(d, precision) {
    if (precision === undefined) precision = 4;
    const cmds = parseSvgPath(d);
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
                // Skip unsupported commands (s, q, t, a, etc.)
                // Baker should have normalized these already
                break;
        }
    }

    return "'(\n    " + parts.join("\n    ") + ")";
}

/**
 * Convert an SVG path `d` string to a LilyPond path data list
 * (as a JavaScript array for internal use, not a string).
 *
 * @param {string} d - SVG path d attribute
 * @returns {Array<Array>} e.g. [["moveto", 0, 0.6667], ["lineto", 0.6667, 0.3333], ...]
 */
function svgPathToCommands(d) {
    const cmds = parseSvgPath(d);
    const result = [];
    let curX = 0, curY = 0;

    for (const { cmd, args } of cmds) {
        switch (cmd) {
            case "M":
                result.push(["moveto", args[0], args[1]]);
                curX = args[0]; curY = args[1];
                break;
            case "L":
                result.push(["lineto", args[0], args[1]]);
                curX = args[0]; curY = args[1];
                break;
            case "H":
                result.push(["lineto", args[0], curY]);
                curX = args[0];
                break;
            case "V":
                result.push(["lineto", curX, args[0]]);
                curY = args[0];
                break;
            case "C":
                result.push(["curveto", args[0], args[1], args[2], args[3], args[4], args[5]]);
                curX = args[4]; curY = args[5];
                break;
            case "Z": case "z":
                result.push(["closepath"]);
                break;
        }
    }
    return result;
}


// ═══════════════════════════════════════════════════════════════════════════
//  3b. SVG PATH PROCESSING PIPELINE (ported from SVG Baker)
//
//  Full pipeline: parse → normalize (rel→abs, arcs→cubics, smooth→cubics,
//  H/V→L) → apply transforms → center → round → stringify.
//
//  Internal format: [{t: 'M', args: [x, y]}, {t: 'C', args: [...]}, ...]
//  Output after normalize is always absolute M, L, C, Z only.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tokenizing SVG path parser (ported from Baker).
 * Handles scientific notation, implicit repeated commands, etc.
 *
 * @param {string} d - SVG path d attribute
 * @returns {Array<{t: string, args: number[]}>}
 */
function bakerParsePath(d) {
    if (!d) return [];
    const regex = /([a-zA-Z])|([-+]?(?:\d*\.?\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;
    const tokens = d.match(regex);
    if (!tokens) return [];
    const cmds = [];
    let i = 0;
    while (i < tokens.length) {
        const tok = tokens[i];
        if (/^[a-zA-Z]$/.test(tok)) {
            const cmd = { t: tok, args: [] };
            i++;
            while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                const val = parseFloat(tokens[i]);
                if (!isNaN(val)) cmd.args.push(val);
                i++;
            }
            cmds.push(cmd);
        } else {
            i++;
        }
    }
    return cmds;
}

/**
 * Convert an SVG arc segment to cubic Bézier curves.
 * Implements the SVG spec's endpoint-to-center parameterization.
 *
 * @param {number} x1 - Start point x
 * @param {number} y1 - Start point y
 * @param {number} rx - X radius
 * @param {number} ry - Y radius
 * @param {number} angle - X-axis rotation in degrees
 * @param {boolean} largeArc - Large arc flag
 * @param {boolean} sweep - Sweep flag
 * @param {number} x2 - End point x
 * @param {number} y2 - End point y
 * @returns {Array<{t: string, args: number[]}>} Array of C commands
 */
function arcToCubic(x1, y1, rx, ry, angle, largeArc, sweep, x2, y2) {
    if (x1 === x2 && y1 === y2) return [];
    if (rx === 0 || ry === 0) return [{ t: 'L', args: [x2, y2] }];

    rx = Math.abs(rx);
    ry = Math.abs(ry);

    const phi = (angle * Math.PI) / 180;
    const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cosPhi * dx + sinPhi * dy;
    const y1p = -sinPhi * dx + cosPhi * dy;

    let rxSq = rx * rx, rySq = ry * ry;
    const x1pSq = x1p * x1p, y1pSq = y1p * y1p;

    // Correct out-of-range radii
    const radCheck = (x1pSq / rxSq) + (y1pSq / rySq);
    if (radCheck > 1) {
        const factor = Math.sqrt(radCheck);
        rx *= factor; ry *= factor;
        rxSq = rx * rx; rySq = ry * ry;
    }

    // Center point computation
    let num = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
    if (num < 0) num = 0;
    const den = rxSq * y1pSq + rySq * x1pSq;
    let coef = (den === 0) ? 0 : Math.sqrt(num / den);
    if (largeArc === sweep) coef = -coef;

    const cxp = coef * ((rx * y1p) / ry);
    const cyp = coef * (-(ry * x1p) / rx);
    const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

    // Angle computation
    const vecAngle = (ux, uy, vx, vy) => {
        const sign = (ux * vy - uy * vx < 0) ? -1 : 1;
        const dot = ux * vx + uy * vy;
        const mag = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
        let val = dot / mag;
        if (val > 1) val = 1;
        if (val < -1) val = -1;
        return sign * Math.acos(val);
    };

    const startAngle = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let deltaAngle = vecAngle(
        (x1p - cxp) / rx, (y1p - cyp) / ry,
        (-x1p - cxp) / rx, (-y1p - cyp) / ry
    );
    if (!sweep && deltaAngle > 0) deltaAngle -= Math.PI * 2;
    if (sweep && deltaAngle < 0) deltaAngle += Math.PI * 2;

    // Split into ≤90° segments
    const segments = Math.max(Math.ceil(Math.abs(deltaAngle) / (Math.PI / 2)), 1);
    const step = deltaAngle / segments;
    const curves = [];

    for (let i = 0; i < segments; i++) {
        const theta1 = startAngle + i * step;
        const theta2 = startAngle + (i + 1) * step;
        const alpha = Math.sin(step) * (Math.sqrt(4 + 3 * Math.pow(Math.tan(step / 2), 2)) - 1) / 3;

        const p1x = cx + rx * Math.cos(theta1) * cosPhi - ry * Math.sin(theta1) * sinPhi;
        const p1y = cy + rx * Math.cos(theta1) * sinPhi + ry * Math.sin(theta1) * cosPhi;
        const p2x = cx + rx * Math.cos(theta2) * cosPhi - ry * Math.sin(theta2) * sinPhi;
        const p2y = cy + rx * Math.cos(theta2) * sinPhi + ry * Math.sin(theta2) * cosPhi;

        const d1x = -rx * Math.sin(theta1) * cosPhi - ry * Math.cos(theta1) * sinPhi;
        const d1y = -rx * Math.sin(theta1) * sinPhi + ry * Math.cos(theta1) * cosPhi;
        const d2x = -rx * Math.sin(theta2) * cosPhi - ry * Math.cos(theta2) * sinPhi;
        const d2y = -rx * Math.sin(theta2) * sinPhi + ry * Math.cos(theta2) * cosPhi;

        curves.push({
            t: 'C',
            args: [
                p1x + alpha * d1x, p1y + alpha * d1y,
                p2x - alpha * d2x, p2y - alpha * d2y,
                p2x, p2y
            ]
        });
    }
    return curves;
}

/**
 * Normalize a parsed command array to absolute M, L, C, Z only.
 * Converts relative→absolute, H/V→L, A→C (via arcToCubic),
 * S→C, Q→C, T→C (smooth/quadratic curve expansion).
 *
 * @param {Array<{t: string, args: number[]}>} cmds
 * @returns {Array<{t: string, args: number[]}>} Normalized commands
 */
function normalizeCommands(cmds) {
    const res = [];
    let cur = { x: 0, y: 0 };
    let lastC = { x: 0, y: 0 };  // last control point (for S/T reflection)
    let lastCmd = null;

    const getAbs = (isRel, x, y) => ({
        x: isRel ? cur.x + (isNaN(x) ? 0 : x) : (isNaN(x) ? cur.x : x),
        y: isRel ? cur.y + (isNaN(y) ? 0 : y) : (isNaN(y) ? cur.y : y)
    });

    cmds.forEach(c => {
        const isRel = (c.t === c.t.toLowerCase());
        const T = c.t.toUpperCase();

        if (T === 'A') {
            // Arc: args = [rx, ry, angle, largeArc, sweep, x, y] (possibly repeated)
            for (let k = 0; k + 6 < c.args.length || k === 0 && c.args.length >= 7; k += 7) {
                const p = getAbs(isRel, c.args[k + 5], c.args[k + 6]);
                const curves = arcToCubic(
                    cur.x, cur.y,
                    c.args[k], c.args[k + 1], c.args[k + 2],
                    c.args[k + 3] !== 0, c.args[k + 4] !== 0,
                    p.x, p.y
                );
                res.push(...curves);
                cur = p;
                lastC = p;
            }
        } else if (T === 'M') {
            if (c.args.length >= 2) {
                const p = getAbs(isRel, c.args[0], c.args[1]);
                res.push({ t: 'M', args: [p.x, p.y] });
                cur = p;
                lastC = p;
                // Extra coordinate pairs after M are implicit L commands
                for (let k = 2; k < c.args.length; k += 2) {
                    const pi = getAbs(isRel, c.args[k], c.args[k + 1]);
                    res.push({ t: 'L', args: [pi.x, pi.y] });
                    cur = pi;
                    lastC = pi;
                }
            }
        } else if (T === 'L') {
            for (let k = 0; k < c.args.length; k += 2) {
                const p = getAbs(isRel, c.args[k], c.args[k + 1]);
                res.push({ t: 'L', args: [p.x, p.y] });
                cur = p;
                lastC = p;
            }
        } else if (T === 'H') {
            for (let k = 0; k < c.args.length; k++) {
                const x = isRel ? cur.x + c.args[k] : c.args[k];
                res.push({ t: 'L', args: [x, cur.y] });
                cur = { x, y: cur.y };
                lastC = cur;
            }
        } else if (T === 'V') {
            for (let k = 0; k < c.args.length; k++) {
                const y = isRel ? cur.y + c.args[k] : c.args[k];
                res.push({ t: 'L', args: [cur.x, y] });
                cur = { x: cur.x, y };
                lastC = cur;
            }
        } else if (T === 'C') {
            for (let k = 0; k < c.args.length; k += 6) {
                const c1 = getAbs(isRel, c.args[k], c.args[k + 1]);
                const c2 = getAbs(isRel, c.args[k + 2], c.args[k + 3]);
                const p = getAbs(isRel, c.args[k + 4], c.args[k + 5]);
                res.push({ t: 'C', args: [c1.x, c1.y, c2.x, c2.y, p.x, p.y] });
                cur = p;
                lastC = c2;
            }
        } else if (T === 'S') {
            for (let k = 0; k < c.args.length; k += 4) {
                // Reflect last control point
                let c1 = cur;
                if (lastCmd === 'C' || lastCmd === 'S') {
                    c1 = { x: 2 * cur.x - lastC.x, y: 2 * cur.y - lastC.y };
                }
                const c2 = getAbs(isRel, c.args[k], c.args[k + 1]);
                const p = getAbs(isRel, c.args[k + 2], c.args[k + 3]);
                res.push({ t: 'C', args: [c1.x, c1.y, c2.x, c2.y, p.x, p.y] });
                cur = p;
                lastC = c2;
            }
        } else if (T === 'Q') {
            for (let k = 0; k < c.args.length; k += 4) {
                const c1 = getAbs(isRel, c.args[k], c.args[k + 1]);
                const p = getAbs(isRel, c.args[k + 2], c.args[k + 3]);
                // Quadratic→cubic: CP1 = P0 + 2/3*(Q-P0), CP2 = P + 2/3*(Q-P)
                const cp1 = { x: cur.x + (2 / 3) * (c1.x - cur.x), y: cur.y + (2 / 3) * (c1.y - cur.y) };
                const cp2 = { x: p.x + (2 / 3) * (c1.x - p.x), y: p.y + (2 / 3) * (c1.y - p.y) };
                res.push({ t: 'C', args: [cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y] });
                cur = p;
                lastC = c1;
            }
        } else if (T === 'T') {
            for (let k = 0; k < c.args.length; k += 2) {
                // Reflect last quadratic control point
                let c1 = cur;
                if (lastCmd === 'Q' || lastCmd === 'T') {
                    c1 = { x: 2 * cur.x - lastC.x, y: 2 * cur.y - lastC.y };
                }
                const p = getAbs(isRel, c.args[k], c.args[k + 1]);
                const cp1 = { x: cur.x + (2 / 3) * (c1.x - cur.x), y: cur.y + (2 / 3) * (c1.y - cur.y) };
                const cp2 = { x: p.x + (2 / 3) * (c1.x - p.x), y: p.y + (2 / 3) * (c1.y - p.y) };
                res.push({ t: 'C', args: [cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y] });
                cur = p;
                lastC = c1;
            }
        } else if (T === 'Z') {
            res.push({ t: 'Z', args: [] });
        }

        lastCmd = T;
    });

    return res;
}

/**
 * Apply an affine transformation matrix to normalized commands.
 *
 * @param {Array<{t: string, args: number[]}>} cmds - Normalized (M/L/C/Z)
 * @param {{a:number, b:number, c:number, d:number, e:number, f:number}} m - 2D affine matrix
 * @returns {Array<{t: string, args: number[]}>}
 */
function applyMatrix(cmds, m) {
    const tf = (x, y) => ({
        x: m.a * x + m.c * y + m.e,
        y: m.b * x + m.d * y + m.f
    });
    return cmds.map(cmd => {
        const newArgs = [];
        const args = cmd.args;
        if (cmd.t === 'M' || cmd.t === 'L') {
            for (let k = 0; k < args.length; k += 2) {
                const p = tf(args[k], args[k + 1]);
                newArgs.push(p.x, p.y);
            }
        } else if (cmd.t === 'C') {
            for (let k = 0; k < args.length; k += 6) {
                const p1 = tf(args[k], args[k + 1]);
                const p2 = tf(args[k + 2], args[k + 3]);
                const p = tf(args[k + 4], args[k + 5]);
                newArgs.push(p1.x, p1.y, p2.x, p2.y, p.x, p.y);
            }
        }
        // Z has no args
        return { t: cmd.t, args: newArgs };
    });
}

/**
 * Compute the bounding box of normalized path commands.
 * Uses only the coordinate points (endpoints + control points for curves).
 * For tight bbox of curves, use findPathExtremePoints instead.
 *
 * @param {Array<{t: string, args: number[]}>} cmds
 * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, height: number}}
 */
function pathBBox(cmds) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cmds.forEach(c => {
        for (let k = 0; k < c.args.length; k += 2) {
            const x = c.args[k], y = c.args[k + 1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    });
    if (minX === Infinity) return { minX: 0, minY: 0, width: 0, height: 0, maxX: 0, maxY: 0 };
    return { minX, minY, width: maxX - minX, height: maxY - minY, maxX, maxY };
}

/**
 * Translate all coordinates in normalized commands.
 *
 * @param {Array<{t: string, args: number[]}>} cmds
 * @param {number} dx
 * @param {number} dy
 * @returns {Array<{t: string, args: number[]}>}
 */
function bakerTranslatePath(cmds, dx, dy) {
    return cmds.map(c => {
        const newArgs = [...c.args];
        for (let k = 0; k < newArgs.length; k += 2) {
            newArgs[k] += dx;
            newArgs[k + 1] += dy;
        }
        return { t: c.t, args: newArgs };
    });
}

/**
 * Serialize normalized commands back to an SVG path `d` string.
 *
 * @param {Array<{t: string, args: number[]}>} cmds
 * @param {number} [precision=3] - Decimal places for rounding
 * @returns {string}
 */
function stringifyPath(cmds, precision) {
    if (precision === undefined) precision = 3;
    const factor = Math.pow(10, precision);
    return cmds.map(c =>
        c.t + (c.args.length > 0
            ? " " + c.args.map(n => Math.round(n * factor) / factor).join(" ")
            : "")
    ).join(" ");
}

/**
 * Center normalized commands at the origin.
 * Translates so the bounding box center = (0, 0).
 *
 * @param {Array<{t: string, args: number[]}>} cmds
 * @returns {{cmds: Array, offset: {x: number, y: number}, bbox: object}}
 */
function centerPath(cmds) {
    const bbox = pathBBox(cmds);
    const cx = bbox.minX + bbox.width / 2;
    const cy = bbox.minY + bbox.height / 2;
    return {
        cmds: bakerTranslatePath(cmds, -cx, -cy),
        offset: { x: -cx, y: -cy },
        bbox
    };
}

/**
 * Full bake pipeline for a path string: parse → normalize → stringify.
 * Does NOT apply transforms (that requires DOM/getCTM, done in HTML).
 *
 * @param {string} d - Raw SVG path d attribute
 * @param {boolean} [shouldCenter=true] - Center at origin
 * @param {number} [precision=3] - Rounding precision
 * @returns {{path: string, cmds: Array, bbox: object, height: number, offset: {x:number, y:number}}}
 */
function bakePath(d, shouldCenter, precision) {
    if (shouldCenter === undefined) shouldCenter = true;
    if (precision === undefined) precision = 3;
    const raw = bakerParsePath(d);
    const normalized = normalizeCommands(raw);
    let finalCmds, offset, bbox;
    if (shouldCenter) {
        const centered = centerPath(normalized);
        finalCmds = centered.cmds;
        offset = centered.offset;
        bbox = pathBBox(finalCmds);
    } else {
        finalCmds = normalized;
        offset = { x: 0, y: 0 };
        bbox = pathBBox(normalized);
    }
    return {
        path: stringifyPath(finalCmds, precision),
        cmds: finalCmds,
        bbox,
        height: bbox.height,
        offset
    };
}

// --- Shape element → command array converters ---
// These accept attribute values (not DOM elements) so they're testable.

/**
 * Convert circle attributes to path commands.
 * @returns {Array<{t: string, args: number[]}>}
 */
function circleToCommands(cx, cy, r) {
    cx = cx || 0; cy = cy || 0; r = r || 0;
    return [
        { t: 'M', args: [cx - r, cy] },
        { t: 'A', args: [r, r, 0, 1, 0, cx + r, cy] },
        { t: 'A', args: [r, r, 0, 1, 0, cx - r, cy] },
        { t: 'Z', args: [] }
    ];
}

/**
 * Convert rect attributes to path commands.
 * @returns {Array<{t: string, args: number[]}>}
 */
function rectToCommands(x, y, w, h) {
    x = x || 0; y = y || 0;
    return [
        { t: 'M', args: [x, y] },
        { t: 'L', args: [x + w, y] },
        { t: 'L', args: [x + w, y + h] },
        { t: 'L', args: [x, y + h] },
        { t: 'Z', args: [] }
    ];
}

/**
 * Convert polygon/polyline point arrays to path commands.
 * @param {number[]} points - Flat array [x1,y1, x2,y2, ...]
 * @param {boolean} [close=true] - Whether to close (polygon vs polyline)
 * @returns {Array<{t: string, args: number[]}>}
 */
function polygonToCommands(points, close) {
    if (close === undefined) close = true;
    if (!points || points.length < 2) return [];
    const cmds = [{ t: 'M', args: [points[0], points[1]] }];
    for (let k = 2; k < points.length; k += 2) {
        cmds.push({ t: 'L', args: [points[k], points[k + 1]] });
    }
    if (close) cmds.push({ t: 'Z', args: [] });
    return cmds;
}


// ═══════════════════════════════════════════════════════════════════════════
//  3c. FUZZY ID MATCHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canonicalize a raw SVG element ID to one of the standard IDs:
 * 'notehead', 'hollow', 'stem-up', 'stem-down'.
 *
 * Also detects 'false-hollow' as a special hollow variant (returns 'hollow'
 * but sets the isFalseHollow flag via the returned object).
 *
 * @param {string} rawId
 * @returns {{canonical: string, isFalseHollow: boolean} | null}
 */
function canonicalizeId(rawId) {
    if (!rawId || typeof rawId !== 'string') return null;
    const id = rawId.toLowerCase().replace(/[-_\s]+/g, '-').replace(/^-|-$/g, '');

    // Stem-up patterns (check before "notehead" to avoid false matches on "notehead-main")
    const stemUpPatterns = [
        'stem-up', 'up-stem', 'stemup', 'upstem'
    ];
    if (stemUpPatterns.some(p => id === p)) {
        return { canonical: 'stem-up', isFalseHollow: false };
    }

    // Stem-down patterns
    const stemDownPatterns = [
        'stem-down', 'down-stem', 'stemdown', 'downstem'
    ];
    if (stemDownPatterns.some(p => id === p)) {
        return { canonical: 'stem-down', isFalseHollow: false };
    }

    // False-hollow patterns (must check BEFORE hollow)
    const falseHollowPatterns = [
        'false-hollow', 'falsehollow'
    ];
    if (falseHollowPatterns.some(p => id === p)) {
        return { canonical: 'hollow', isFalseHollow: true };
    }

    // Hollow patterns
    const hollowPatterns = [
        'hollow', 'hollow-cutout', 'hollowcutout'
    ];
    if (hollowPatterns.some(p => id === p)) {
        return { canonical: 'hollow', isFalseHollow: false };
    }

    // Notehead patterns
    const noteheadPatterns = [
        'notehead', 'note-head', 'notehead-main', 'notehead-main'
    ];
    if (noteheadPatterns.some(p => id === p)) {
        return { canonical: 'notehead', isFalseHollow: false };
    }

    return null;
}


// ═══════════════════════════════════════════════════════════════════════════
//  3d. BÉZIER EXTREMA & DEFAULT STEM ANCHORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find the t values where a cubic Bézier's x-coordinate has extrema.
 * For B(t) = (1-t)³p0 + 3(1-t)²t·p1 + 3(1-t)t²·p2 + t³·p3,
 * solve dB/dt = 0 (a quadratic in t), return t values in [0, 1].
 *
 * @param {number} p0 - Start point x
 * @param {number} p1 - Control point 1 x
 * @param {number} p2 - Control point 2 x
 * @param {number} p3 - End point x
 * @returns {number[]} t values where extrema occur (0 ≤ t ≤ 1)
 */
function cubicExtremaT(p0, p1, p2, p3) {
    // dB/dt = at² + bt + c = 0
    const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
    const b = 6 * (p0 - 2 * p1 + p2);
    const c = 3 * (p1 - p0);

    const results = [];

    if (Math.abs(a) < 1e-12) {
        // Linear: bt + c = 0
        if (Math.abs(b) > 1e-12) {
            const t = -c / b;
            if (t > 1e-9 && t < 1 - 1e-9) results.push(t);
        }
    } else {
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
            const sqrtDisc = Math.sqrt(disc);
            const t1 = (-b + sqrtDisc) / (2 * a);
            const t2 = (-b - sqrtDisc) / (2 * a);
            if (t1 > 1e-9 && t1 < 1 - 1e-9) results.push(t1);
            if (t2 > 1e-9 && t2 < 1 - 1e-9) results.push(t2);
        }
    }

    return results;
}

/**
 * Evaluate a cubic Bézier at parameter t.
 * @returns {number}
 */
function cubicAt(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/**
 * Find the leftmost and rightmost points on a normalized path (M/L/C/Z).
 * For line segments, checks endpoints. For cubics, also checks x-extrema.
 *
 * @param {Array<{t: string, args: number[]}>} cmds - Normalized commands
 * @returns {{left: {x: number, y: number}, right: {x: number, y: number}}}
 */
function findPathExtremePoints(cmds) {
    let leftPt = { x: Infinity, y: 0 };
    let rightPt = { x: -Infinity, y: 0 };
    let curX = 0, curY = 0;

    const consider = (x, y) => {
        if (x < leftPt.x || (x === leftPt.x && y < leftPt.y)) {
            leftPt = { x, y };
        }
        if (x > rightPt.x || (x === rightPt.x && y > rightPt.y)) {
            rightPt = { x, y };
        }
    };

    for (const cmd of cmds) {
        if (cmd.t === 'M' || cmd.t === 'L') {
            consider(cmd.args[0], cmd.args[1]);
            curX = cmd.args[0];
            curY = cmd.args[1];
        } else if (cmd.t === 'C') {
            const [c1x, c1y, c2x, c2y, px, py] = cmd.args;
            // Check endpoint
            consider(px, py);
            // Check x-extrema along the curve
            const tVals = cubicExtremaT(curX, c1x, c2x, px);
            for (const t of tVals) {
                const ex = cubicAt(curX, c1x, c2x, px, t);
                const ey = cubicAt(curY, c1y, c2y, py, t);
                consider(ex, ey);
            }
            curX = px;
            curY = py;
        }
        // Z doesn't move the "pen" in a way that creates new extrema
    }

    return { left: leftPt, right: rightPt };
}

/**
 * Compute default stem attachment anchor points for a shape.
 *
 * stem-down (left side): stem outer-left edge aligns with shape's left edge.
 *   x = leftmostX + stemWidth/2,  y = y at the leftmost point.
 *
 * stem-up (right side): stem outer-right edge aligns with shape's right edge.
 *   x = rightmostX - stemWidth/2,  y = y at the rightmost point.
 *
 * All coordinates are in the path's own coordinate system (centered at origin).
 *
 * @param {Array<{t: string, args: number[]}>} cmds - Normalized, centered path commands
 * @param {number} stemWidth - Stem thickness in path coordinates
 * @returns {{stemUp: {x: number, y: number}, stemDown: {x: number, y: number}}}
 */
function computeDefaultStemAnchors(cmds, stemWidth) {
    if (!stemWidth) stemWidth = 0;
    const extremes = findPathExtremePoints(cmds);

    return {
        stemDown: {
            x: roundTo(extremes.left.x + stemWidth / 2, 4),
            y: roundTo(extremes.left.y, 4)
        },
        stemUp: {
            x: roundTo(extremes.right.x - stemWidth / 2, 4),
            y: roundTo(extremes.right.y, 4)
        }
    };
}


// ═══════════════════════════════════════════════════════════════════════════
//  3e. SVG IMPORT HELPERS
//
//  Pure functions for extracting shape definitions from Music Glyph Toolkit
//  SVGs. The HTML layer handles DOMParser and attribute extraction; these
//  functions operate on plain objects so they're testable without a DOM.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute stem attachment anchors from stem rectangle geometry.
 *
 * The Inkscape extension draws stems as <rect> elements. The attachment
 * point is where the stem meets the notehead:
 *   - stem-up:   horizontal center, BOTTOM edge (y + height)
 *   - stem-down:  horizontal center, TOP edge (y)
 *
 * Returns coordinates in the SVG's native coordinate system (same space
 * as the path `d` attribute). Conversion to LilyPond coordinates (÷ scale,
 * Y-invert) happens at .ly export time in buildAttachmentPoints().
 *
 * @param {object|null} stemUpRect  - {x, y, width, height} or null
 * @param {object|null} stemDownRect - {x, y, width, height} or null
 * @returns {{ stemUp: {x: number, y: number}, stemDown: {x: number, y: number} }}
 */
function computeStemAnchorsFromRects(stemUpRect, stemDownRect) {
    let stemUp = { x: 0, y: 0 };
    let stemDown = { x: 0, y: 0 };

    if (stemUpRect) {
        stemUp = {
            x: roundTo(stemUpRect.x + stemUpRect.width / 2, 4),
            y: roundTo(stemUpRect.y + stemUpRect.height, 4)   // bottom edge
        };
    }

    if (stemDownRect) {
        stemDown = {
            x: roundTo(stemDownRect.x + stemDownRect.width / 2, 4),
            y: roundTo(stemDownRect.y, 4)                      // top edge
        };
    }

    return { stemUp, stemDown };
}

/**
 * Build a shape definition from attributes extracted from a Music Glyph
 * Toolkit SVG.  Pure function — no DOM access.
 *
 * @param {object} params
 * @param {string}      params.name             - Shape name (e.g. "kite-up")
 * @param {string}      params.noteheadPath     - SVG `d` attribute of #notehead
 * @param {string|null} params.hollowPath       - SVG `d` attribute of #hollow, or null
 * @param {string|null} params.lilypondNotehead - data-lilypond-notehead text, or null
 * @param {string|null} params.lilypondHollow   - data-lilypond-hollow text, or null
 * @param {number|null} params.semitoneHeight   - data-semitone-height, or null
 * @param {object|null} params.stemUpRect       - {x, y, width, height} or null
 * @param {object|null} params.stemDownRect     - {x, y, width, height} or null
 * @param {number|null} params.viewBoxWidth     - SVG viewBox width (SVG units)
 * @param {number|null} params.viewBoxHeight    - SVG viewBox height (SVG units)
 * @param {boolean}     params.isFalseHollow    - true if hollow element has id "false-hollow"
 * @param {string}      [params.type="notehead"] - Shape type
 * @returns {object} Shape definition for App.defs
 */
function buildShapeDef(params) {
    const type = params.type || "notehead";

    // semitoneHeight: semantic value from data attr (e.g., 4.0 semitones)
    const semitoneHeight = params.semitoneHeight ||
        (params.viewBoxHeight ? roundTo(params.viewBoxHeight / 100, 4) : null);

    // naturalHeight/naturalWidth: raw SVG coordinate dimensions.
    // These match the path `d` attribute coordinate space so the renderer
    // can scale the path correctly: displayScale = pxPerSemi * semitoneHeight / naturalHeight.
    const naturalHeight = params.viewBoxHeight || (semitoneHeight ? semitoneHeight * 100 : null);
    const naturalWidth = params.viewBoxWidth || (naturalHeight || null);

    // Stem anchors from rect geometry (null if no stem rects present)
    const hasStemRects = (params.stemUpRect !== null && params.stemUpRect !== undefined) ||
                         (params.stemDownRect !== null && params.stemDownRect !== undefined);
    const anchors = hasStemRects
        ? computeStemAnchorsFromRects(params.stemUpRect, params.stemDownRect)
        : null;

    return {
        type,
        path: params.noteheadPath || "",
        hollowPath: params.hollowPath || null,
        naturalHeight,
        semitoneHeight,
        naturalWidth,
        anchors,
        lilypondPath: params.lilypondNotehead || null,
        lilypondHollow: params.lilypondHollow || null,
        overlapPercent: 25,
        isFalseHollow: params.isFalseHollow || false
    };
}

/**
 * Extract rect attributes from a plain object or from typical SVG attribute values.
 * Convenience parser for { x, y, width, height } string→number conversion.
 *
 * @param {object} attrs - { x: string|number, y: string|number, width: string|number, height: string|number }
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function parseRectAttrs(attrs) {
    return {
        x: parseFloat(attrs.x) || 0,
        y: parseFloat(attrs.y) || 0,
        width: parseFloat(attrs.width) || 0,
        height: parseFloat(attrs.height) || 0
    };
}

/**
 * Suggest a shape name from a filename.
 * Strips extension and path, keeps the base name.
 *
 * @param {string} filename
 * @returns {string}
 */
function shapeNameFromFilename(filename) {
    if (!filename) return "shape";
    // Strip path
    const base = filename.replace(/^.*[/\\]/, "");
    // Strip extension
    return base.replace(/\.[^.]+$/, "") || "shape";
}


// ═══════════════════════════════════════════════════════════════════════════
//  4. ANCHOR / STEM ATTACHMENT MATH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Derive minim (half-note) stem attachment points from crotchet (quarter-note)
 * anchors and overlap percentage.
 *
 * Double noteheads: the second notehead is placed to the RIGHT of the first.
 * - Stem-down attaches to the FIRST (left) notehead — same position as crotchet.
 * - Stem-up attaches to the SECOND (right) notehead — shifted right by the offset.
 *
 * NOTE: This algorithm assumes the first notehead is the reference point.
 * If LilyPond centers the pair, both anchors would need to be adjusted.
 * Needs verification against LilyPond rendering (Session 4).
 *
 * @param {{x: number, y: number}} stemUp - Crotchet stem-up anchor (notehead coords, normalized ~±1)
 * @param {{x: number, y: number}} stemDown - Crotchet stem-down anchor
 * @param {number} overlapPercent - 0–100, how much noteheads overlap
 * @param {number} noteheadWidth - Width of one notehead in notehead-coordinate units
 * @returns {{ minimUp: {x: number, y: number}, minimDown: {x: number, y: number} }}
 */
function deriveMinimAnchors(stemUp, stemDown, overlapPercent, noteheadWidth) {
    if (noteheadWidth === undefined) noteheadWidth = 1.333;

    // The second notehead is offset to the right.
    // offset = noteheadWidth * (1 - overlapPercent/100)
    const offset = noteheadWidth * (1 - overlapPercent / 100);

    // Stem-down: stays on first (left) notehead — unchanged
    // Stem-up: shifts to second (right) notehead
    return {
        minimUp:   { x: roundTo(stemUp.x + offset, 4),  y: stemUp.y },
        minimDown: { x: roundTo(stemDown.x, 4),          y: stemDown.y }
    };
}

/**
 * Build a full 4-point attachment config from a shape definition.
 * Converts anchors from the path's SVG coordinate space to LilyPond
 * coordinates (÷ scale, Y-inverted) for .ly export.
 *
 * @param {object} shapeDef - Shape definition from App.defs
 * @returns {object} { crotchetUp, crotchetDown, minimUp, minimDown } each {x, y}
 */
function buildAttachmentPoints(shapeDef) {
    // Stemless shapes have null anchors — no attachment points to emit
    if (!shapeDef.anchors) return null;

    const overlap = shapeDef.overlapPercent !== null && shapeDef.overlapPercent !== undefined
        ? shapeDef.overlapPercent
        : 25;  // Default overlap if not specified

    const su = shapeDef.anchors.stemUp   || { x: 0, y: 0 };
    const sd = shapeDef.anchors.stemDown || { x: 0, y: 0 };

    // Convert from path coordinate space to LilyPond coordinates.
    // SVG paths use Y-down; LilyPond uses Y-up. Scale factor converts
    // SVG units to LilyPond semitone units:
    //   Music Glyph Toolkit: 100 SVG units = 1 semitone → scale = 100
    //   Legacy (STANDARD_OVAL): naturalHeight ≈ semitoneHeight → scale ≈ 1
    const natH = shapeDef.naturalHeight || 1;
    const semiH = shapeDef.semitoneHeight || natH;
    const coordScale = natH / semiH;

    const toLy = (pt) => ({
        x: roundTo(pt.x / coordScale, 4),
        y: roundTo(-(pt.y / coordScale), 4)   // Y-invert: SVG Y-down → LilyPond Y-up
    });

    const suLy = toLy(su);
    const sdLy = toLy(sd);

    // Use naturalWidth (in LilyPond scale) for minim anchor derivation
    const noteWidth = shapeDef.naturalWidth
        ? roundTo(shapeDef.naturalWidth / coordScale, 4)
        : (semiH || 1.333);

    const minim = deriveMinimAnchors(suLy, sdLy, overlap, noteWidth);

    return {
        crotchetUp:   suLy,
        crotchetDown: sdLy,
        minimUp:      minim.minimUp,
        minimDown:    minim.minimDown
    };
}


// ═══════════════════════════════════════════════════════════════════════════
//  5. STAFF DERIVATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract the set of pitch-class offsets (0–11) that have a given line type
 * from staffRules.
 *
 * @param {Array} staffRules - array of rule objects with {type, pitchClasses, ...}
 * @param {string} lineType - "staff" or "ledger"
 * @returns {number[]} sorted pitch-class offsets
 */
function getStaffPitchClasses(staffRules, lineType) {
    const pcs = new Set();
    for (const rule of (staffRules || [])) {
        if (rule.type !== lineType) continue;
        if (rule.pitchClasses === 'all') {
            for (let i = 0; i < 12; i++) pcs.add(i);
        } else if (Array.isArray(rule.pitchClasses)) {
            rule.pitchClasses.forEach(pc => pcs.add(pc));
        }
    }
    return [...pcs].sort((a, b) => a - b);
}

/**
 * Derive semitones-per-staff-space from staff rules.
 *
 * Algorithm:
 * 1. Find all semitone offsets (0–11) that are type 'staff'
 * 2. Sort ascending
 * 3. Compute differences between consecutive staff offsets (wrapping around octave)
 * 4. Return GCD of all differences
 *
 * @param {Array} staffRules - staffRules array
 * @returns {number} semitones per staff space (integer ≥ 1)
 */
function deriveSemitonesPerStaffSpace(staffRules) {
    const staffOffsets = getStaffPitchClasses(staffRules, "staff");

    if (staffOffsets.length < 2) {
        return 1; // Degenerate: fewer than 2 staff lines
    }

    const diffs = [];
    for (let i = 1; i < staffOffsets.length; i++) {
        diffs.push(staffOffsets[i] - staffOffsets[i - 1]);
    }
    // Wrap-around difference (last to first, crossing octave boundary)
    diffs.push(12 - staffOffsets[staffOffsets.length - 1] + staffOffsets[0]);

    return gcd(diffs);
}

/**
 * Derive staff-line-positions from staff rules and semitones-per-staff-space.
 *
 * Produces positions in half-staff-space units, centered around 0 with
 * a center gap (no line at position 0). Uses symmetric placement:
 * N lines above center at +2, +4, +6, ... and N lines below at -2, -4, -6, ...
 *
 * @param {Array} staffRules - staffRules array
 * @param {number} semiPerSpace - semitones per staff space
 * @param {number} [linesPerSide=3] - number of lines above (and below) center
 * @returns {number[]} sorted list of half-staff-space positions
 */
function deriveStaffLinePositions(staffRules, semiPerSpace, linesPerSide) {
    if (linesPerSide === undefined) linesPerSide = 3;

    const staffOffsets = getStaffPitchClasses(staffRules, "staff");
    if (staffOffsets.length === 0) return [];

    // The spacing between adjacent staff lines in half-staff-space units is always 2
    // (1 staff-space = 2 half-staff-spaces). Lines are uniformly spaced.
    const spacing = 2;

    // Generate symmetric positions with center gap (no line at 0)
    const positions = [];
    for (let i = 1; i <= linesPerSide; i++) {
        positions.push(-i * spacing);
        positions.push(i * spacing);
    }

    return positions.sort((a, b) => a - b);
}

/**
 * Derive ledger line positions from staff rules.
 * Returns empty array if ledgers should be auto-generated by the engine.
 *
 * @param {Array} staffRules - staffRules array
 * @param {number} semiPerSpace
 * @returns {number[]} explicit ledger positions, or empty for auto
 */
function deriveLedgerPositions(staffRules, semiPerSpace) {
    // For V1: return empty (auto-generate).
    // The engine's proximity algorithm handles ledger placement.
    return [];
}


// ═══════════════════════════════════════════════════════════════════════════
//  6. NAMING CONVENTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate Scheme-safe symbol name from a user-facing name.
 * Converts to lowercase, replaces spaces/special chars with hyphens.
 *
 * @param {string} name
 * @returns {string}
 */
function toSchemeSymbol(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Generate the hollow cutout name for a shape.
 * Convention: <shape-name>-cutout
 */
function hollowNameFor(shapeName) {
    return shapeName + "-cutout";
}

/**
 * Generate the attachment name for a shape.
 * Convention: <shape-name>-attach
 */
function attachmentNameFor(shapeName) {
    return shapeName + "-attach";
}


// ═══════════════════════════════════════════════════════════════════════════
//  6b. PALETTE & COLOR NAME PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the active palette colors as an array of hex strings.
 *
 * @param {object} palette - noteheadPalette state object
 * @returns {string[]} array of hex color strings
 */
function getActivePaletteColors(palette) {
    if (!palette) return [];
    if (palette.selected === 'custom') {
        return [...(palette.customColors || [])];
    }
    // Preset mode
    const info = PALETTE_PRESET_KEYS[palette.presetKey];
    if (!info || !MCP) return [];
    const size = info.size;
    const key = palette.presetKey;
    // Determine which palette collection to use
    if (key.startsWith('cbsafe-')) {
        const pal = MCP.COLORBLIND_SAFE_PALETTES[size];
        return pal ? pal.map(c => c.hex) : [];
    } else {
        // Standard (Dark2) presets
        if (palette.mode === 'cbsafe') {
            const pal = MCP.COLORBLIND_SAFE_PALETTES[size];
            return pal ? pal.map(c => c.hex) : [];
        }
        const pal = MCP.STANDARD_PALETTES[size];
        return pal ? pal.map(c => c.hex) : [];
    }
}

/**
 * Generate a Scheme symbol name from a hex color.
 * Uses MusicColorPalettes.nearestColorName() for human-readable names.
 *
 * @param {string} hex - color hex string (e.g. "#1b9e77")
 * @returns {string} Scheme symbol (e.g. "shamrock-1b9e77")
 */
function colorToSchemeSymbol(hex) {
    if (!hex || typeof hex !== 'string') return 'black-000000';
    if (!MCP) {
        // Fallback without MCP library: just use hex
        return toSchemeSymbol('color-' + hex.replace('#', ''));
    }
    const name = MCP.nearestColorName(hex);
    return toSchemeSymbol(name);
}

/**
 * Get CB-safe alternative hex values for an array of hex colors.
 *
 * @param {string[]} hexArray - primary palette hex values
 * @returns {Array<{original: string, cbSafe: {name: string, hex: string}, distance: number}>}
 */
function getCBSafeAlternatives(hexArray) {
    if (!MCP || !hexArray || hexArray.length === 0) return [];
    try {
        return MCP.matchToCBSafe(hexArray);
    } catch (e) {
        // matchToCBSafe throws if input exceeds CB_SAFE_SOURCE.length
        return [];
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  6c. CUMULATIVE RULE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve all 12 pitch classes by walking cumulative rules top-to-bottom.
 * Last-match-wins per property (shape, hollow, color).
 *
 * @param {Array} noteheadRules - cumulative rules with ruleType field
 * @param {object} defs - shape definitions (for default shape)
 * @returns {Array<{shape: string, hollow: boolean, color: string}>} 12-element array
 */
function resolveAllNoteheadConfigs(noteheadRules, defs) {
    const defaultShape = Object.keys(defs || {})[0] || 'standard-oval';
    const defaults = {
        shape: defaultShape,
        hollow: false,
        color: '#000000'
    };
    const configs = Array.from({length: 12}, () => ({...defaults}));

    for (const rule of (noteheadRules || [])) {
        const pcs = rule.pitchClasses === 'all'
            ? [0,1,2,3,4,5,6,7,8,9,10,11]
            : (Array.isArray(rule.pitchClasses) ? rule.pitchClasses : []);

        for (const pc of pcs) {
            if (pc < 0 || pc > 11) continue;
            if (rule.ruleType === 'shape' && rule.shape) {
                configs[pc].shape = rule.shape;
            } else if (rule.ruleType === 'hollow') {
                configs[pc].hollow = !!rule.hollow;
            } else if (rule.ruleType === 'color' && rule.color) {
                configs[pc].color = rule.color;
            }
        }
    }
    return configs;
}

/**
 * Group pitch classes that share identical resolved configs.
 * Returns an array of { shape, hollow, color, pitchClasses } objects,
 * sorted by the first pitch class in each group.
 *
 * @param {Array} configs - 12-element array from resolveAllNoteheadConfigs
 * @returns {Array<{shape: string, hollow: boolean, color: string, pitchClasses: number[]}>}
 */
function groupResolvedConfigs(configs) {
    const groups = {};
    for (let pc = 0; pc < 12; pc++) {
        const c = configs[pc];
        const key = `${c.shape}|${c.hollow}|${c.color}`;
        if (!groups[key]) {
            groups[key] = { shape: c.shape, hollow: c.hollow, color: c.color, pitchClasses: [] };
        }
        groups[key].pitchClasses.push(pc);
    }
    return Object.values(groups).sort((a, b) => a.pitchClasses[0] - b.pitchClasses[0]);
}


// ═══════════════════════════════════════════════════════════════════════════
//  7. VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate the App state for .ly export readiness.
 *
 * @param {object} app - The App state
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateForExport(app) {
    const errors = [];
    const warnings = [];

    // Meta checks
    if (!app.meta.label) {
        warnings.push("Notation label is empty.");
    }
    if (app.meta.suffix && !app.meta.suffix.startsWith("-")) {
        errors.push("File suffix must start with a hyphen (e.g., '-MyNotation').");
    }

    // Shape checks
    const shapeNames = Object.keys(app.defs || {});
    if (shapeNames.length === 0) {
        errors.push("No shapes defined. Import at least one SVG shape.");
    }

    // Notehead rules coverage (cumulative model)
    const rules = app.noteheadRules || [];
    if (rules.length > 0) {
        // Check that all 12 pitch classes are covered by at least one shape rule
        const shapeCoveredPCs = new Set();
        rules.forEach(rule => {
            if (rule.ruleType !== 'shape') return;
            if (rule.pitchClasses === 'all') {
                for (let i = 0; i < 12; i++) shapeCoveredPCs.add(i);
            } else if (Array.isArray(rule.pitchClasses)) {
                rule.pitchClasses.forEach(pc => shapeCoveredPCs.add(pc));
            }
        });
        for (let i = 0; i < 12; i++) {
            if (!shapeCoveredPCs.has(i)) {
                errors.push(`Pitch class ${i} (${PITCH_CLASS_NAMES[i]}) is not covered by any shape rule.`);
            }
        }

        // Check references in each rule by type
        rules.forEach((rule, idx) => {
            if (rule.ruleType === 'shape') {
                if (!rule.shape) {
                    errors.push(`Rule ${idx + 1} (shape) has no shape assigned.`);
                } else if (!app.defs[rule.shape]) {
                    errors.push(`Rule ${idx + 1} (shape) references unknown shape '${rule.shape}'.`);
                }
            } else if (rule.ruleType === 'color') {
                if (!rule.color) {
                    errors.push(`Rule ${idx + 1} (color) has no color assigned.`);
                } else if (!/^#[0-9a-fA-F]{6}$/.test(rule.color)) {
                    errors.push(`Rule ${idx + 1} (color) has invalid hex format: '${rule.color}'.`);
                }
            }
            // Hollow rules don't need additional reference checks
        });

        // Resolve all configs and check for hollow/shape mismatches
        const resolved = resolveAllNoteheadConfigs(rules, app.defs || {});
        for (let pc = 0; pc < 12; pc++) {
            const cfg = resolved[pc];
            if (cfg.hollow && cfg.shape && app.defs[cfg.shape] && !app.defs[cfg.shape].hollowPath) {
                warnings.push(`Pitch class ${pc} (${PITCH_CLASS_NAMES[pc]}) is hollow but shape '${cfg.shape}' has no hollow path.`);
            }
        }

        // Warn about shapes imported without pre-baked LilyPond paths
        const usedShapes = getUsedShapes(app);
        usedShapes.forEach(name => {
            const def = app.defs[name];
            if (def && !def.lilypondPath) {
                warnings.push(`Shape '${name}' has no pre-baked LilyPond path (using fallback conversion).`);
            }
        });

        // Warn about color rules that reference non-palette colors
        const paletteColors = getActivePaletteColors(app.noteheadPalette);
        const paletteLower = new Set(paletteColors.map(h => h.toLowerCase()));
        rules.forEach((rule, idx) => {
            if (rule.ruleType === 'color' && rule.color) {
                if (!paletteLower.has(rule.color.toLowerCase()) && rule.color.toLowerCase() !== '#000000') {
                    warnings.push(`Rule ${idx + 1} (color) uses '${rule.color}' which is not in the active palette.`);
                }
            }
        });

    } else {
        errors.push("No notehead rules defined.");
    }

    // Staff checks
    const staffPCs = getStaffPitchClasses(app.staffRules || [], "staff");
    if (staffPCs.length < 2) {
        errors.push("Need at least 2 staff lines (pitch classes with type 'staff').");
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}


// ═══════════════════════════════════════════════════════════════════════════
//  8. .LY EXPORT — SECTION A (Named Definitions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate Section A of the .ly export: named definitions.
 *
 * @param {object} app
 * @returns {string}
 */
function generateSectionA(app) {
    const lines = [];
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%     SECTION A — NAMED DEFINITIONS");
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("");

    // A1. Path variable definitions
    lines.push("%% --- Path variables ---");
    const shapesUsed = getUsedShapes(app);

    for (const name of shapesUsed) {
        const def = app.defs[name];
        if (!def) continue;

        const varName = `cnb:${toSchemeSymbol(name)}-path`;

        // Prefer pre-baked LilyPond path from SVG data-lilypond-notehead attribute
        if (def.lilypondPath) {
            lines.push(`#(define ${varName} ${def.lilypondPath})`);
        } else {
            const lyPath = svgPathToLilypond(def.path);
            lines.push(`#(define ${varName} ${lyPath})`);
        }
        lines.push("");

        // Hollow cutout if it exists
        if (def.hollowPath) {
            const hollowVar = `cnb:${toSchemeSymbol(name)}-cutout-path`;
            if (def.lilypondHollow) {
                lines.push(`#(define ${hollowVar} ${def.lilypondHollow})`);
            } else {
                const lyHollow = svgPathToLilypond(def.hollowPath);
                lines.push(`#(define ${hollowVar} ${lyHollow})`);
            }
            lines.push("");
        }
    }

    // A2. Path registrations
    lines.push("%% --- Register paths ---");
    for (const name of shapesUsed) {
        if (!app.defs[name]) continue;
        const sym = toSchemeSymbol(name);
        lines.push(`#(cnb:register-path! '${sym} cnb:${sym}-path)`);
    }
    lines.push("");

    // A3. Hollow cutout registrations
    const hollowShapes = shapesUsed.filter(n => app.defs[n]?.hollowPath);
    if (hollowShapes.length > 0) {
        lines.push("%% --- Register hollow cutouts ---");
        for (const name of hollowShapes) {
            const sym = toSchemeSymbol(name);
            lines.push(`#(cnb:register-hollow! '${sym}-cutout cnb:${sym}-cutout-path)`);
        }
        lines.push("");
    }

    // A4. Stem attachment registrations
    lines.push("%% --- Register stem attachments ---");
    for (const name of shapesUsed) {
        const def = app.defs[name];
        if (!def) continue;
        const pts = buildAttachmentPoints(def);
        if (!pts) {
            // Stemless shape — skip attachment registration
            lines.push(`%% ${toSchemeSymbol(name)}: stemless — no attachment registered`);
            lines.push("");
            continue;
        }
        const sym = toSchemeSymbol(name);
        lines.push(`#(cnb:register-attachment! '${sym}-attach`);
        lines.push(`   (list`);
        lines.push(`     (cons 'crotchet-up   '(${fmtPair(pts.crotchetUp)}))`);
        lines.push(`     (cons 'crotchet-down '(${fmtPair(pts.crotchetDown)}))`);
        lines.push(`     (cons 'minim-up      '(${fmtPair(pts.minimUp)}))`);
        lines.push(`     (cons 'minim-down    '(${fmtPair(pts.minimDown)}))))`);
        lines.push("");
    }

    // A5. Color registrations — with accessible color switching
    const resolved = resolveAllNoteheadConfigs(app.noteheadRules || [], app.defs || {});
    const uniqueColors = [...new Set(resolved.map(c => c.color))]
        .filter(h => h && h.toLowerCase() !== '#000000');

    if (uniqueColors.length > 0) {
        // Generate symbol names for each unique color
        const colorSymbols = {};
        for (const hex of uniqueColors) {
            colorSymbols[hex] = colorToSchemeSymbol(hex);
        }

        // Get CB-safe alternatives
        const cbMapping = getCBSafeAlternatives(uniqueColors);

        // Determine palette label for comment
        const palLabel = app.noteheadPalette
            ? (app.noteheadPalette.selected === 'preset'
                ? (PALETTE_PRESET_KEYS[app.noteheadPalette.presetKey]?.label || app.noteheadPalette.presetKey)
                : 'Custom')
            : 'Custom';

        lines.push(`%% Color registrations`);
        lines.push(`%% Primary palette: ${palLabel}`);
        lines.push(`%% Accessible palette: auto-generated CB-safe match`);
        lines.push(`%%`);
        lines.push(`%% Usage: Set cnb:use-accessible-colors to #t before \\include`);
        lines.push(`%% to activate the colorblind-safe alternative.`);
        lines.push("");

        lines.push(`#(if (and (defined? 'cnb:use-accessible-colors) cnb:use-accessible-colors)`);
        lines.push(`  (begin`);
        lines.push(`    ;; Accessible (colorblind-safe) palette`);
        for (let i = 0; i < uniqueColors.length; i++) {
            const hex = uniqueColors[i];
            const sym = colorSymbols[hex];
            const cbHex = (cbMapping && cbMapping[i]) ? cbMapping[i].cbSafe.hex : hex;
            lines.push(`    (cnb:register-color! '${sym} "${cbHex}")`);
        }
        lines.push(`  )`);
        lines.push(`  (begin`);
        lines.push(`    ;; Primary palette`);
        for (const hex of uniqueColors) {
            const sym = colorSymbols[hex];
            lines.push(`    (cnb:register-color! '${sym} "${hex}")`);
        }
        lines.push(`  ))`);
        lines.push("");
    }

    // Also register black if used (identity in both branches, no conditional needed)
    const hasBlack = resolved.some(c => c.color && c.color.toLowerCase() === '#000000');
    if (hasBlack) {
        lines.push(`#(cnb:register-color! 'black-000000 "#000000")`);
        lines.push("");
    }

    return lines.join("\n");
}


// ═══════════════════════════════════════════════════════════════════════════
//  9. .LY EXPORT — SECTION B (Engine Settings)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate Section B of the .ly export: engine settings.
 *
 * @param {object} app
 * @returns {string}
 */
function generateSectionB(app) {
    const lines = [];
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%     SECTION B — ENGINE SETTINGS");
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("");

    // B1. Staff geometry (derived from staffRules)
    const semiPerSpace = deriveSemitonesPerStaffSpace(app.staffRules || []);
    const staffPositions = deriveStaffLinePositions(app.staffRules || [], semiPerSpace);
    lines.push(`#(set! cnb:semitones-per-staff-space ${semiPerSpace})`);
    lines.push(`#(set! cnb:staff-line-positions '(${staffPositions.join(" ")}))`);

    // B2. Emit-if-changed settings
    const e = app.engine;
    const d = ENGINE_DEFAULTS;

    if (e.falseHollow !== d.falseHollow) {
        lines.push(`#(set! cnb:false-hollow ${e.falseHollow ? "#t" : "#f"})`);
    }
    if (e.multinotePadding !== d.multinotePadding) {
        lines.push(`#(set! cnb:multinote-padding ${fmtNum(e.multinotePadding)})`);
    }
    if (e.defaultMagnify !== d.defaultMagnify) {
        lines.push(`#(set! cnb:default-magnify ${fmtRational(e.defaultMagnify)})`);
    }
    if (e.indent !== d.indent) {
        lines.push(`#(set! cnb:indent ${fmtNum(e.indent)})`);
    }
    if (e.collisionThreshold !== d.collisionThreshold) {
        lines.push(`#(set! cnb:collision-threshold ${fmtNum(e.collisionThreshold)})`);
    }
    if (e.staffLineThickness !== d.staffLineThickness) {
        lines.push(`#(set! cnb:default-staff-line-thickness ${fmtNum(e.staffLineThickness)})`);
    }
    if (e.staffLineColor !== d.staffLineColor) {
        lines.push(`#(set! cnb:default-staff-line-color "${e.staffLineColor}")`);
    }
    if (e.stemThickness !== null && e.stemThickness !== undefined) {
        lines.push(`#(set! cnb:stem-thickness ${fmtNum(e.stemThickness)})`);
    }

    // B4. Always: metadata
    const suffix = app.meta.suffix || "";
    lines.push(`#(set! cnb:file-suffix "${escSchemeString(suffix)}")`);
    lines.push(`#(set! cnb:notation-label "${escSchemeString(app.meta.label || "")}")`);
    if (app.meta.footnote) {
        lines.push(`#(set! cnb:notation-footnote`);
        lines.push(`  "${escSchemeString(app.meta.footnote)}")`);
    }

    lines.push("");
    return lines.join("\n");
}


// ═══════════════════════════════════════════════════════════════════════════
//  10. .LY EXPORT — SECTION C (Configuration Procedure)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate Section C of the .ly export: the cond-based procedure.
 * Resolves cumulative rules, groups identical configs, emits compact cond.
 *
 * @param {object} app
 * @returns {string}
 */
function generateSectionC(app) {
    const lines = [];
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%     SECTION C — CONFIGURATION PROCEDURE");
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%");
    lines.push("%% The procedure below maps (semitone, duration, key) to a config alist.");
    lines.push("%% Generated from cumulative rules (shape/hollow/color), last-match-wins per property.");
    lines.push("%%");
    lines.push("");

    const rules = app.noteheadRules || [];
    if (rules.length === 0) {
        lines.push("%% WARNING: No notehead rules defined.");
        lines.push("");
        return lines.join("\n");
    }

    // Resolve all 12 pitch classes
    const resolved = resolveAllNoteheadConfigs(rules, app.defs || {});
    const groups = groupResolvedConfigs(resolved);

    lines.push("#(set! cnb:get-notehead-config");
    lines.push("   (lambda (semitone duration key)");
    lines.push("     (let ((pc (modulo semitone 12)))");
    lines.push("       (cond");

    for (const group of groups) {
        const shapeSym = toSchemeSymbol(group.shape);
        const colorSym = colorToSchemeSymbol(group.color);

        const hollowSym = (group.hollow && app.defs[group.shape]?.hollowPath)
            ? `${shapeSym}-cutout`
            : "#f";

        // Stemless shapes get #f for attachment
        const shapeDef = app.defs[group.shape];
        const attachSym = (shapeDef && shapeDef.anchors) ? `${shapeSym}-attach` : "#f";

        // Build comment with pitch class names
        const pcNames = group.pitchClasses.map(pc => PITCH_CLASS_NAMES[pc]).join(", ");
        const hollowLabel = group.hollow ? "hollow" : "solid";
        lines.push(`         ;; ${pcNames} → ${group.shape}, ${hollowLabel}, ${colorSym}`);

        // Build condition
        const condition = buildPitchClassCondition(group.pitchClasses, 'pc');

        lines.push(`         (${condition}`);
        lines.push(`          '((shape      . ${shapeSym})`);
        lines.push(`            (color      . ${colorSym})`);
        lines.push(`            (hollow     . ${hollowSym})`);
        lines.push(`            (attachment . ${attachSym})`);
        lines.push(`            (off-key-mark . #f)))`);
        lines.push("");
    }

    // Fallback (should never be reached if all 12 PCs are covered, but safety)
    const fallback = resolved[0];
    const fbShapeSym = toSchemeSymbol(fallback.shape);
    const fbColorSym = colorToSchemeSymbol(fallback.color);
    const fbShapeDef = app.defs[fallback.shape];
    const fbAttachSym = (fbShapeDef && fbShapeDef.anchors) ? `${fbShapeSym}-attach` : "#f";

    lines.push("         ;; Fallback");
    lines.push(`         (else`);
    lines.push(`          '((shape      . ${fbShapeSym})`);
    lines.push(`            (color      . ${fbColorSym})`);
    lines.push(`            (hollow     . #f)`);
    lines.push(`            (attachment . ${fbAttachSym})`);
    lines.push(`            (off-key-mark . #f)))))))`);
    lines.push("");

    return lines.join("\n");
}

/**
 * Build the Scheme condition expression for a notehead rule.
 *
 * @param {object} rule - {pitchClasses, durations, keys}
 * @returns {string} Scheme condition expression
 */
function buildRuleCondition(rule) {
    const pcCond = buildPitchClassCondition(rule.pitchClasses);
    // Duration and key conditions reserved for future use
    // When implemented, they would be combined with 'and':
    //   (and <pcCond> <durCond> <keyCond>)
    return pcCond;
}

/**
 * Build the Scheme pitch-class condition for a rule.
 *
 * @param {string|number[]} pitchClasses - 'all' or array of pitch-class integers
 * @param {string} [varName='semitone'] - Scheme variable name to test against
 * @returns {string}
 */
function buildPitchClassCondition(pitchClasses, varName) {
    if (!varName) varName = 'semitone';
    if (pitchClasses === 'all') {
        return "#t";
    }
    if (!Array.isArray(pitchClasses) || pitchClasses.length === 0) {
        return "#f";
    }
    if (pitchClasses.length === 1) {
        return `(= ${varName} ${pitchClasses[0]})`;
    }
    return `(memv ${varName} '(${pitchClasses.join(" ")}))`;
}

/**
 * Build a human-readable comment for a rule.
 *
 * @param {object} rule
 * @returns {string}
 */
function buildRuleComment(rule) {
    let pcLabel;
    if (rule.pitchClasses === 'all') {
        pcLabel = "All pitch classes";
    } else if (Array.isArray(rule.pitchClasses)) {
        pcLabel = rule.pitchClasses.map(pc => PITCH_CLASS_NAMES[pc]).join(", ");
    } else {
        pcLabel = "???";
    }
    return pcLabel;
}


// ═══════════════════════════════════════════════════════════════════════════
//  11. .LY EXPORT — FULL FILE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a complete .ly export file.
 *
 * @param {object} app
 * @returns {string}
 */
function generateLy(app) {
    const lines = [];

    // Determine palette label
    const palLabel = app.noteheadPalette
        ? (app.noteheadPalette.selected === 'preset'
            ? (PALETTE_PRESET_KEYS[app.noteheadPalette.presetKey]?.label || app.noteheadPalette.presetKey)
            : 'Custom')
        : 'Custom';
    const palMode = app.noteheadPalette?.mode || 'standard';

    // Header
    lines.push(`\\version "2.24.2"`);
    lines.push(`\\include "ChromaticNotationBase.ly"`);
    lines.push("");
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("%%");
    lines.push(`%% ${app.meta.label || "Untitled"} — Generated by Chromatic Configurator`);
    lines.push(`%% Date: ${new Date().toISOString().split("T")[0]}`);
    lines.push(`%% Configurator version: ${VERSION}`);
    lines.push("%%");
    lines.push("%% DO NOT EDIT BY HAND — regenerate from the Configurator.");
    if (app.meta.name) {
        lines.push(`%% Source: ${app.meta.name}.json`);
    }
    lines.push("%%");
    lines.push(`%% Color palette: ${palLabel} (${palMode})`);
    lines.push("%% Set cnb:use-accessible-colors to #t before \\include to use");
    lines.push("%% the colorblind-safe alternative palette.");
    lines.push("%%");
    lines.push("%% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    lines.push("");
    lines.push("");

    // Sections
    lines.push(generateSectionA(app));
    lines.push("");
    lines.push(generateSectionB(app));
    lines.push("");
    lines.push(generateSectionC(app));

    return lines.join("\n");
}


// ═══════════════════════════════════════════════════════════════════════════
//  12. JSON SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serialize App state to JSON string.
 */
function serializeApp(app) {
    return JSON.stringify(app, null, 2);
}

/**
 * Deserialize JSON string to App state, with version migration.
 *
 * @param {string} json
 * @returns {object} migrated App state
 * @throws {Error} on invalid JSON
 */
function deserializeApp(json) {
    const app = JSON.parse(json);
    return migrateApp(app);
}


// ═══════════════════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS (internal)
// ═══════════════════════════════════════════════════════════════════════════

function roundTo(n, places) {
    const f = Math.pow(10, places);
    return Math.round(n * f) / f;
}

function gcd(arr) {
    function _gcd(a, b) {
        a = Math.abs(a); b = Math.abs(b);
        while (b) { [a, b] = [b, a % b]; }
        return a;
    }
    return arr.reduce((acc, val) => _gcd(acc, val));
}

function fmtNum(n) {
    // Format number for Scheme: remove trailing zeros but keep as decimal if needed
    if (Number.isInteger(n)) return String(n);
    return String(parseFloat(n.toFixed(4)));
}

function fmtRational(n) {
    // Try to express as a ratio for Scheme readability
    // 1.75 → 7/4, etc.
    const common = [
        [7/4, "7/4"], [3/2, "3/2"], [5/4, "5/4"], [4/3, "4/3"],
        [2, "2"], [1, "1"], [9/4, "9/4"], [5/2, "5/2"]
    ];
    for (const [val, str] of common) {
        if (Math.abs(n - val) < 0.0001) return str;
    }
    return fmtNum(n);
}

function fmtPair(pt) {
    // Format {x, y} as "x . y" for Scheme pair
    return `${fmtNum(pt.x)} . ${fmtNum(pt.y)}`;
}

function escSchemeString(s) {
    // Escape for Scheme string literal
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Get the set of shape names actually referenced by noteheadRules.
 * For cumulative rules, only 'shape' type rules have shape references.
 * Also handles legacy monolithic rules (no ruleType field).
 */
function getUsedShapes(app) {
    const used = new Set();
    (app.noteheadRules || []).forEach(rule => {
        if (rule.ruleType === 'shape' && rule.shape) {
            used.add(rule.shape);
        } else if (!rule.ruleType && rule.shape) {
            // Legacy monolithic rule
            used.add(rule.shape);
        }
    });
    return [...used].sort();
}

/**
 * Positive modulo (handles negative values correctly).
 */
function posMod(n, m) {
    return ((n % m) + m) % m;
}

/**
 * Compute the default stem thickness based on notehead and semitone dimensions.
 * Formula: min(noteheadHeight / 9, semitoneHeight * 0.26)
 *
 * @param {number} noteheadHeight - Height of notehead in display units (e.g., pixels)
 * @param {number} semitoneHeight - Height of one semitone in display units (e.g., pxPerSemi)
 * @returns {number} stem thickness in the same units
 */
function computeDefaultStemThickness(noteheadHeight, semitoneHeight) {
    return Math.min(noteheadHeight / 9, semitoneHeight * 0.26);
}

/**
 * Compute the default staff-line thickness from stem thickness.
 * Formula: stemThickness * 0.76
 *
 * @param {number} stemThickness - Stem thickness
 * @returns {number} staff-line thickness
 */
function computeDefaultStaffLineThickness(stemThickness) {
    return roundTo(stemThickness * 0.76, 2);
}


// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

return {
    // Constants
    VERSION,
    PITCH_CLASS_NAMES,
    DURATION_CATEGORIES,
    OFF_KEY_MODES,
    COLOR_PRESETS,
    ENGINE_DEFAULTS,
    PALETTE_PRESET_KEYS,
    DEFAULT_NOTEHEAD_PALETTE,

    // Data model
    createDefaultApp,
    migrateApp,
    migrateMapChromToRules,
    migrateMapStaffToRules,
    migrateMonolithicToCumulative,
    migrateColorsToPalette,
    resolveColorRefsInRules,

    // Path conversion
    parseSvgPath,
    svgPathToLilypond,
    svgPathToCommands,

    // Baker pipeline (ported from SVG Baker)
    bakerParsePath,
    arcToCubic,
    normalizeCommands,
    applyMatrix,
    pathBBox,
    bakerTranslatePath,
    stringifyPath,
    centerPath,
    bakePath,
    circleToCommands,
    rectToCommands,
    polygonToCommands,

    // Fuzzy ID matching
    canonicalizeId,

    // Bézier extrema & stem anchors
    cubicExtremaT,
    cubicAt,
    findPathExtremePoints,
    computeDefaultStemAnchors,

    // SVG import helpers
    computeStemAnchorsFromRects,
    buildShapeDef,
    parseRectAttrs,
    shapeNameFromFilename,

    // Anchor math
    deriveMinimAnchors,
    buildAttachmentPoints,

    // Staff derivation
    getStaffPitchClasses,
    deriveSemitonesPerStaffSpace,
    deriveStaffLinePositions,
    deriveLedgerPositions,

    // Naming & color pipeline
    toSchemeSymbol,
    hollowNameFor,
    attachmentNameFor,
    colorToSchemeSymbol,

    // Palette
    getActivePaletteColors,
    getCBSafeAlternatives,

    // Cumulative rule resolution
    resolveAllNoteheadConfigs,
    groupResolvedConfigs,

    // Validation
    validateForExport,

    // LY export
    generateSectionA,
    generateSectionB,
    generateSectionC,
    generateLy,

    // Section C helpers (exposed for testing)
    buildRuleCondition,
    buildPitchClassCondition,
    buildRuleComment,

    // JSON
    serializeApp,
    deserializeApp,

    // Utilities (exposed for testing)
    roundTo,
    gcd,
    fmtNum,
    fmtRational,
    fmtPair,
    escSchemeString,
    getUsedShapes,
    posMod,
    computeDefaultStemThickness,
    computeDefaultStaffLineThickness
};

})();

// Support both browser and potential Node.js usage
if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
}
