/**
 * palette-editor.js — Module 12: Palette Editor
 *
 * Ports the working palette system from `music-color-palettes.js` and
 * the legacy PaletteUI modal (`chromatic-configurator.html`) onto the
 * Module A config schema (architecture plan §4.6). The legacy files were
 * removed in 1.0.0 and are preserved at git tag `legacy-monolith-final`.
 *
 * What is ported verbatim (same algorithms, same constants):
 *   - CIELAB / CIEDE2000 color math: hexToRgb, rgbToHex, hexToLab, deltaE
 *   - NAMED_COLORS dictionary and nearestColorName(hex) → "Name-#hex"
 *   - CB_SAFE_SOURCE + matchToCBSafe(hexArray) greedy closest-first matching
 *   - STANDARD_PALETTES / COLORBLIND_SAFE_PALETTES curated presets
 *   - PALETTE_PRESET_KEYS and the preset-list / custom-editor / CB-match UI
 *   - toSchemeSymbol(name) (legacy configurator-core.js single-argument form)
 *     and colorSchemeSymbol(hex) = toSchemeSymbol(nearestColorName(hex)),
 *     e.g. "#1b9e77" → "shamrock-1b9e77" — this feeds the exporter's
 *     `palette.schemeSymbols` map (plan §4.6 LY mapping table).
 *
 * Schema reconciliation (legacy → Module A), decided for this port:
 *   - Legacy `noteheadPalette.mode` conflated two things: which preset family
 *     is listed, and which colors render. Here they are separate: the editor
 *     has a preset *family* tab (standard Dark2 sets vs. curated CB-safe
 *     sets), and `palette.useCBSafe` is the preview toggle mirroring the
 *     engine's `cnb:use-accessible-colors` flag (LY spec §4.5). It is
 *     preview-only: the export always carries both branches, and the score
 *     selects one with that flag (audit 2026-11-02, L2).
 *   - Module A `palette.colors` is per pitch class, but the curated palettes
 *     have 2/3/4/6/7/11 colors. The editor assigns colors by cycling the
 *     pool: PC p gets pool[p % N]. This is deterministic, covers all 12 PCs,
 *     and the per-PC preview shows exactly what CNBConfig.resolveColor()
 *     will return.
 *   - `palette.cbSafeColors` (the accessible branch of the LY Section A
 *     conditional): for standard presets and standard-tab custom palettes it
 *     is the matchToCBSafe() pairing (legacy export behavior); for CB-safe
 *     presets and CB-safe-tab custom palettes it is the identity mapping —
 *     "for CB-safe-as-primary mode, both branches have the same hex values"
 *     (LY spec §4.5).
 *
 * Naming/attribution (spec caution, checked for this module): preset labels
 * are purely descriptive of colors ("Dark2 · 3 colors", "CB-Safe · 7
 * colors"). "Dark2" names the ColorBrewer palette the colors come from
 * (sizes 2–7; the 11-color set extends it with four additional hues chosen
 * for this project). The CB-safe sets for sizes 2–7 follow Paul Tol's
 * colorblind-safe schemes; the 11-color CB-safe set is this project's own.
 * No palette name or label references any external music-notation system.
 *
 * Rendering contract: render() builds plain DOM via document.createElement,
 * wires events as element properties (onclick/oninput/onchange) so the whole
 * UI is exercisable in Node against a stub document, and reports every state
 * change through onChange(palette, selection) where `palette` is a ready
 * `config.palette` object. Hosts own layout and styling via the .cnb-pal-*
 * class hooks.
 *
 * Dependencies: none (Module A schema is a structural contract only).
 */

// ============================================================
// COLOR MATH (sRGB → XYZ → CIELAB, ΔE 2000) — ported from
// the legacy music-color-palettes.js (tag legacy-monolith-final)
// ============================================================

function hexToRgb(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(c =>
    Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")
  ).join("");
}

function srgbToLinear(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r, g, b) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  return [
    0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl,
    0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl,
    0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl,
  ];
}

// D65 white point
const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;

function labF(t) {
  const d = 6 / 29;
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

function xyzToLab(x, y, z) {
  const fx = labF(x / Xn);
  const fy = labF(y / Yn);
  const fz = labF(z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function hexToLab(hex) {
  const rgb = hexToRgb(hex);
  const xyz = rgbToXyz(rgb[0], rgb[1], rgb[2]);
  return xyzToLab(xyz[0], xyz[1], xyz[2]);
}

/**
 * CIEDE2000 color difference. Reference: Sharma, Wu, Dalal (2005).
 * Ported unchanged from the legacy music-color-palettes.js.
 */
function deltaE(hex1, hex2) {
  const PI = Math.PI;
  const { abs, sqrt, pow, cos, sin, atan2, exp } = Math;

  const rad2deg = rad => (360 * rad) / (2 * PI);
  const deg2rad = deg => (2 * PI * deg) / 360;

  const [L1, a1, b1] = hexToLab(hex1);
  const [L2, a2, b2] = hexToLab(hex2);

  const avgL = (L1 + L2) / 2;
  const C1 = sqrt(a1 * a1 + b1 * b1);
  const C2 = sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const G = 0.5 * (1 - sqrt(pow(avgC, 7) / (pow(avgC, 7) + pow(25, 7))));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = sqrt(a1p * a1p + b1 * b1);
  const C2p = sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  let h1p = rad2deg(atan2(b1, a1p));
  if (h1p < 0) h1p += 360;
  let h2p = rad2deg(atan2(b2, a2p));
  if (h2p < 0) h2p += 360;

  const avgHp = abs(h1p - h2p) > 180
    ? (h1p + h2p + 360) / 2
    : (h1p + h2p) / 2;

  const T = 1
    - 0.17 * cos(deg2rad(avgHp - 30))
    + 0.24 * cos(deg2rad(2 * avgHp))
    + 0.32 * cos(deg2rad(3 * avgHp + 6))
    - 0.20 * cos(deg2rad(4 * avgHp - 63));

  let dhp = h2p - h1p;
  if (abs(dhp) > 180) {
    dhp = h2p <= h1p ? dhp + 360 : dhp - 360;
  }
  dhp = 2 * sqrt(C1p * C2p) * sin(deg2rad(dhp) / 2);

  const dL = L2 - L1;
  const dCp = C2p - C1p;

  const sl = 1 + (0.015 * pow(avgL - 50, 2)) / sqrt(20 + pow(avgL - 50, 2));
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * T;

  const dTheta = 30 * exp(-pow((avgHp - 275) / 25, 2));
  const Rc = 2 * sqrt(pow(avgCp, 7) / (pow(avgCp, 7) + pow(25, 7)));
  const Rt = -Rc * sin(2 * deg2rad(dTheta));

  const result = sqrt(
    pow(dL / sl, 2) +
    pow(dCp / sc, 2) +
    pow(dhp / sh, 2) +
    Rt * (dCp / sc) * (dhp / sh)
  );

  return Math.max(0, Math.min(100, result));
}

function distanceFromWhite(hex) {
  return deltaE(hex, "#ffffff");
}

// ============================================================
// NAMED COLOR DICTIONARY (~150 common colors) — ported unchanged
// ============================================================

const NAMED_COLORS = {
  "Alice Blue": "#F0F8FF", "Amaranth": "#E52B50", "Amber": "#FFBF00",
  "Amethyst": "#9966CC", "Apricot": "#FBCEB1", "Aqua": "#00FFFF",
  "Aquamarine": "#7FFFD4", "Azure": "#007FFF", "Beige": "#F5F5DC",
  "Bistre": "#3D2B1F", "Black": "#000000", "Blue": "#0000FF",
  "Blue-Green": "#0095B6", "Blue-Violet": "#8A2BE2", "Brass": "#B5A642",
  "Brick Red": "#CB4154", "Bronze": "#CD7F32", "Brown": "#964B00",
  "Buff": "#F0DC82", "Burgundy": "#800020", "Burnt Orange": "#CC5500",
  "Burnt Sienna": "#E97451", "Burnt Umber": "#8A3324",
  "Cambridge Blue": "#A3C1AD", "Camel": "#C19A6B", "Cardinal": "#C41E3A",
  "Carmine": "#960018", "Carnation Pink": "#FFA6C9", "Celadon": "#ACE1AF",
  "Cerise": "#DE3163", "Cerulean": "#007BA7", "Champagne": "#F7E7CE",
  "Charcoal": "#36454F", "Chartreuse": "#7FFF00", "Chocolate": "#7B3F00",
  "Cinnamon": "#D2691E", "Cobalt": "#0047AB", "Copper": "#B87333",
  "Coral": "#FF7F50", "Cornflower Blue": "#6495ED", "Cream": "#FFFDD0",
  "Crimson": "#DC143C", "Cyan": "#00FFFF", "Daffodil": "#FFFF31",
  "Dark Blue": "#00008B", "Dark Green": "#013220", "Dark Red": "#8B0000",
  "Deep Pink": "#FF1493", "Denim": "#1560BD", "Dodger Blue": "#1E90FF",
  "Eggplant": "#614051", "Emerald": "#50C878", "Fern Green": "#4F7942",
  "Fire Engine Red": "#CE2029", "Flax": "#EEDC82", "Forest Green": "#228B22",
  "French Rose": "#F64A8A", "Fuchsia": "#FF00FF", "Gamboge": "#E49B0F",
  "Gold": "#FFD700", "Goldenrod": "#DAA520", "Grape": "#6F2DA8",
  "Gray": "#808080", "Green": "#00FF00", "Han Purple": "#5218FA",
  "Harlequin": "#3FFF00", "Heliotrope": "#DF73FF", "Hot Pink": "#FF69B4",
  "Indigo": "#4B0082", "Ivory": "#FFFFF0", "Jade": "#00A86B",
  "Kelly Green": "#4CBB17", "Khaki": "#C3B091", "Lavender": "#B57EDC",
  "Lemon": "#FFF44F", "Lilac": "#C8A2C8", "Lime": "#BFFF00",
  "Lime Green": "#32CD32", "Linen": "#FAF0E6", "Magenta": "#FF00FF",
  "Mahogany": "#C04000", "Maize": "#FBEC5D", "Malachite": "#0BDA51",
  "Maroon": "#800000", "Mauve": "#E0B0FF", "Midnight Blue": "#191970",
  "Mint Green": "#98FF98", "Moss Green": "#8A9A5B", "Mustard": "#FFDB58",
  "Navy Blue": "#000080", "Ochre": "#CC7722", "Olive": "#808000",
  "Olive Drab": "#6B8E23", "Orange": "#FF7F00", "Orange-Red": "#FF4500",
  "Orchid": "#DA70D6", "Pale Blue": "#AFEEEE", "Peach": "#FFE5B4",
  "Pear": "#D1E231", "Periwinkle": "#CCCCFF", "Persian Blue": "#1C39BB",
  "Pine Green": "#01796F", "Pink": "#FFC0CB", "Plum": "#8E4585",
  "Powder Blue": "#B0E0E6", "Prussian Blue": "#003153", "Puce": "#CC8899",
  "Pumpkin": "#FF7518", "Purple": "#800080", "Raspberry": "#E30B5C",
  "Red": "#FF0000", "Red-Violet": "#C71585", "Robin Egg Blue": "#00CCCC",
  "Rose": "#FF007F", "Royal Blue": "#4169E1", "Royal Purple": "#7851A9",
  "Ruby": "#E0115F", "Russet": "#80461B", "Rust": "#B7410E",
  "Saffron": "#F4C430", "Salmon": "#FA8072", "Sandy Brown": "#F4A460",
  "Sangria": "#92000A", "Sapphire": "#0F52BA", "Scarlet": "#FF2400",
  "Sea Green": "#2E8B57", "Sepia": "#704214", "Shamrock": "#009E60",
  "Sienna": "#A0522D", "Silver": "#C0C0C0", "Sky Blue": "#87CEEB",
  "Slate Gray": "#708090", "Spring Green": "#00FF7F",
  "Steel Blue": "#4682B4", "Tan": "#D2B48C", "Tangerine": "#FF9966",
  "Taupe": "#483C32", "Teal": "#008080", "Thistle": "#D8BFD8",
  "Tomato": "#FF6347", "Turquoise": "#40E0D0", "Ultramarine": "#3F00FF",
  "Vermilion": "#E34234", "Violet": "#8B00FF", "Viridian": "#40826D",
  "Wheat": "#F5DEB3", "White": "#FFFFFF", "Wine": "#722F37",
  "Wisteria": "#C9A0DC", "Yellow": "#FFFF00", "Yellow-Green": "#9ACD32",
  "Zinnwaldite Brown": "#2C1608",
};

/**
 * Nearest named color via CIEDE2000: "#1b9e77" → "Shamrock-#1b9e77".
 * Same return format as the legacy library (name + "-" + normalized hex).
 */
function nearestColorName(hex) {
  let bestName = "Unknown";
  let bestDist = Infinity;

  for (const name of Object.keys(NAMED_COLORS)) {
    const dist = deltaE(hex, NAMED_COLORS[name]);
    if (dist < bestDist) {
      bestDist = dist;
      bestName = name;
    }
  }

  const normalized = rgbToHex(...hexToRgb(hex));
  return bestName + "-" + normalized;
}

/** Nearest color name without the hex suffix: "#1b9e77" → "Shamrock". */
function baseColorName(hex) {
  return nearestColorName(hex).split("-#")[0];
}

// ============================================================
// SCHEME SYMBOL PIPELINE — ported from the legacy configurator-core.js
// ============================================================

/**
 * Scheme symbol from a name: "Shamrock-#1b9e77" → "shamrock-1b9e77".
 * (Legacy configurator-core.js toSchemeSymbol; the exporter module has an
 * equivalent two-argument form.)
 */
function toSchemeSymbol(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Scheme symbol for a color hex via the nearest-name pipeline:
 * "#1b9e77" → "shamrock-1b9e77". Feeds config.palette.schemeSymbols.
 */
function colorSchemeSymbol(hex) {
  if (!hex || typeof hex !== "string") return "black-000000";
  return toSchemeSymbol(nearestColorName(hex));
}

// ============================================================
// COLORBLIND-SAFE SOURCE + MATCHING — ported unchanged
// ============================================================

const CB_SAFE_SOURCE = [
  { name: "Violet",     hex: "#8400cd" },
  { name: "Gold",       hex: "#ffc33b" },
  { name: "Blue",       hex: "#0058cb" },
  { name: "Orange",     hex: "#ff6e3a" },
  { name: "Teal",       hex: "#009f81" },
  { name: "Rose",       hex: "#ff5aaf" },
  { name: "Slate",      hex: "#4a5568" },
  { name: "Pink",       hex: "#ffb2fd" },
  { name: "Chartreuse", hex: "#a8a000" },
  { name: "Sky",        hex: "#00c2f9" },
  { name: "Crimson",    hex: "#e20134" },
  { name: "Mint",       hex: "#00fccf" },
];

/**
 * Map an array of hex colors to colorblind-safe alternatives using greedy
 * closest-first assignment (best matches claimed first). Returns
 * [{ original, cbSafe: {name, hex}, distance }] aligned with the input.
 * Throws when the input exceeds the CB-safe source size (12).
 */
function matchToCBSafe(hexArray) {
  if (hexArray.length > CB_SAFE_SOURCE.length) {
    throw new Error(
      "Cannot match " + hexArray.length + " colors; CB-safe source has " + CB_SAFE_SOURCE.length
    );
  }

  const n = hexArray.length;
  const m = CB_SAFE_SOURCE.length;

  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      pairs.push({ i, j, d: deltaE(hexArray[i], CB_SAFE_SOURCE[j].hex) });
    }
  }
  pairs.sort((a, b) => a.d - b.d);

  const usedInput = {};
  const usedCB = {};
  const result = new Array(n);
  let assigned = 0;

  for (let k = 0; k < pairs.length && assigned < n; k++) {
    const p = pairs[k];
    if (usedInput[p.i] || usedCB[p.j]) continue;
    usedInput[p.i] = true;
    usedCB[p.j] = true;
    result[p.i] = {
      original: hexArray[p.i],
      cbSafe: { name: CB_SAFE_SOURCE[p.j].name, hex: CB_SAFE_SOURCE[p.j].hex },
      distance: Math.round(p.d * 10) / 10,
    };
    assigned++;
  }

  return result;
}

// ============================================================
// CURATED PALETTES — ported unchanged
// ============================================================

const STANDARD_PALETTES = {
  2: [
    { name: "Teal",    hex: "#1b9e77" },
    { name: "Orange",  hex: "#d95f02" },
  ],
  3: [
    { name: "Teal",    hex: "#1b9e77" },
    { name: "Orange",  hex: "#d95f02" },
    { name: "Lilac",   hex: "#7570b3" },
  ],
  4: [
    { name: "Teal",    hex: "#1b9e77" },
    { name: "Orange",  hex: "#d95f02" },
    { name: "Lilac",   hex: "#7570b3" },
    { name: "Pink",    hex: "#e7298a" },
  ],
  6: [
    { name: "Teal",    hex: "#1b9e77" },
    { name: "Orange",  hex: "#d95f02" },
    { name: "Lilac",   hex: "#7570b3" },
    { name: "Pink",    hex: "#e7298a" },
    { name: "Green",   hex: "#66a61e" },
    { name: "Gold",    hex: "#e6ab02" },
  ],
  7: [
    { name: "Teal",    hex: "#1b9e77" },
    { name: "Orange",  hex: "#d95f02" },
    { name: "Lilac",   hex: "#7570b3" },
    { name: "Pink",    hex: "#e7298a" },
    { name: "Green",   hex: "#66a61e" },
    { name: "Gold",    hex: "#e6ab02" },
    { name: "Brown",   hex: "#a6761d" },
  ],
  11: [
    { name: "Teal",       hex: "#1b9e77" },
    { name: "Orange",     hex: "#d95f02" },
    { name: "Lilac",      hex: "#7570b3" },
    { name: "Pink",       hex: "#e7298a" },
    { name: "Green",      hex: "#66a61e" },
    { name: "Gold",       hex: "#e6ab02" },
    { name: "Brown",      hex: "#a6761d" },
    { name: "Slate",      hex: "#666666" },
    { name: "Cobalt",     hex: "#1f4e79" },
    { name: "Crimson",    hex: "#b2182b" },
    { name: "Plum",       hex: "#6a3d9a" },
  ],
};

const COLORBLIND_SAFE_PALETTES = {
  2: [
    { name: "Blue",    hex: "#0077BB" },
    { name: "Orange",  hex: "#EE7733" },
  ],
  3: [
    { name: "Blue",    hex: "#0077BB" },
    { name: "Orange",  hex: "#EE7733" },
    { name: "Teal",    hex: "#009988" },
  ],
  4: [
    { name: "Blue",    hex: "#4477AA" },
    { name: "Yellow",  hex: "#CCBB44" },
    { name: "Red",     hex: "#EE6677" },
    { name: "Green",   hex: "#228833" },
  ],
  6: [
    { name: "Blue",    hex: "#0077BB" },
    { name: "Cyan",    hex: "#33BBEE" },
    { name: "Teal",    hex: "#009988" },
    { name: "Orange",  hex: "#EE7733" },
    { name: "Red",     hex: "#CC3311" },
    { name: "Magenta", hex: "#EE3377" },
  ],
  7: [
    { name: "Blue",    hex: "#4477AA" },
    { name: "Cyan",    hex: "#66CCEE" },
    { name: "Green",   hex: "#228833" },
    { name: "Yellow",  hex: "#CCBB44" },
    { name: "Red",     hex: "#EE6677" },
    { name: "Purple",  hex: "#AA3377" },
    { name: "Gray",    hex: "#778899" },
  ],
  11: [
    { name: "Violet",     hex: "#8400cd" },
    { name: "Gold",       hex: "#ffc33b" },
    { name: "Blue",       hex: "#0058cb" },
    { name: "Orange",     hex: "#ff6e3a" },
    { name: "Teal",       hex: "#009f81" },
    { name: "Rose",       hex: "#ff5aaf" },
    { name: "Slate",      hex: "#4a5568" },
    { name: "Pink",       hex: "#ffb2fd" },
    { name: "Chartreuse", hex: "#a8a000" },
    { name: "Sky",        hex: "#00c2f9" },
    { name: "Crimson",    hex: "#e20134" },
  ],
};

/**
 * Preset registry — ported from legacy configurator-core.js
 * PALETTE_PRESET_KEYS. Labels are descriptive of the colors only (see the
 * naming/attribution note in the module header).
 */
const PALETTE_PRESET_KEYS = {
  "dark2-2":   { size: 2,  family: "standard", label: "Dark2 · 2 colors" },
  "dark2-3":   { size: 3,  family: "standard", label: "Dark2 · 3 colors" },
  "dark2-4":   { size: 4,  family: "standard", label: "Dark2 · 4 colors" },
  "dark2-6":   { size: 6,  family: "standard", label: "Dark2 · 6 colors" },
  "dark2-7":   { size: 7,  family: "standard", label: "Dark2 · 7 colors" },
  "dark2-11":  { size: 11, family: "standard", label: "Dark2 · 11 colors" },
  "cbsafe-2":  { size: 2,  family: "cbsafe",   label: "CB-Safe · 2 colors" },
  "cbsafe-3":  { size: 3,  family: "cbsafe",   label: "CB-Safe · 3 colors" },
  "cbsafe-4":  { size: 4,  family: "cbsafe",   label: "CB-Safe · 4 colors" },
  "cbsafe-6":  { size: 6,  family: "cbsafe",   label: "CB-Safe · 6 colors" },
  "cbsafe-7":  { size: 7,  family: "cbsafe",   label: "CB-Safe · 7 colors" },
  "cbsafe-11": { size: 11, family: "cbsafe",   label: "CB-Safe · 11 colors" },
};

// Pitch-class labels for the per-PC preview strip (kept inline so this
// module's dependency list stays empty, matching the architecture plan's
// Module 12 dependency row).
const PC_LABELS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

// Legacy PaletteUI.selectCustom() seed colors
const DEFAULT_CUSTOM_COLORS = ["#e41a1c", "#377eb8", "#4daf4a"];

/** Default editor selection: legacy DEFAULT_NOTEHEAD_PALETTE (dark2-3). */
function defaultSelection() {
  return {
    source: "preset",        // "preset" | "custom"
    family: "standard",      // which preset family tab is active
    presetKey: "dark2-3",
    customColors: [],
    useCBSafe: false,
  };
}

export const CNBPaletteEditor = {

  // Ported color library surface (parity with legacy MusicColorPalettes)
  deltaE,
  distanceFromWhite,
  nearestColorName,
  baseColorName,
  matchToCBSafe,
  hexToRgb,
  rgbToHex,
  hexToLab,
  toSchemeSymbol,
  colorSchemeSymbol,
  NAMED_COLORS,
  STANDARD_PALETTES,
  COLORBLIND_SAFE_PALETTES,
  CB_SAFE_SOURCE,
  PALETTE_PRESET_KEYS,

  defaultSelection,

  /**
   * Curated colors for a preset key: [{name, hex}] or null when unknown.
   * @param {string} presetKey
   * @returns {{name:string,hex:string}[]|null}
   */
  presetColors(presetKey) {
    const info = PALETTE_PRESET_KEYS[presetKey];
    if (!info) return null;
    const lib = info.family === "cbsafe" ? COLORBLIND_SAFE_PALETTES : STANDARD_PALETTES;
    const pal = lib[info.size];
    return pal ? pal.map(c => ({ name: c.name, hex: c.hex })) : null;
  },

  /**
   * The active color pool for a selection: [{name, hex}].
   * Custom colors get nearest-color-name display names.
   * @param {object} selection
   * @returns {{name:string,hex:string}[]}
   */
  selectionPool(selection) {
    if (selection.source === "custom") {
      return (selection.customColors || []).map(hex => ({ name: baseColorName(hex), hex }));
    }
    return CNBPaletteEditor.presetColors(selection.presetKey) || [];
  },

  /**
   * The config with palette.schemeSymbols cut to the colours it uses
   * (session 36): the notehead rules' colours and the palette's colours and
   * colour-blind colours, compared without regard to case. A colour tried
   * and then replaced leaves no name behind. The export looks up only used
   * colours, so its output does not change. The input is not changed; a
   * config with nothing to cut comes back as it is.
   * @param {object} config
   * @returns {object}
   */
  usedSchemeSymbols(config) {
    const palette = config && config.palette;
    if (!palette || !palette.schemeSymbols) return config;
    const used = new Set();
    for (const rule of config.noteheadRules || []) {
      const color = rule && rule.apply && rule.apply.color;
      if (typeof color === "string") used.add(color.toLowerCase());
    }
    for (const entry of [...(palette.colors || []), ...(palette.cbSafeColors || [])]) {
      if (entry && typeof entry.hex === "string") used.add(entry.hex.toLowerCase());
    }
    const kept = {};
    for (const [hex, symbol] of Object.entries(palette.schemeSymbols)) {
      if (used.has(hex.toLowerCase())) kept[hex] = symbol;
    }
    if (Object.keys(kept).length === Object.keys(palette.schemeSymbols).length) return config;
    return { ...config, palette: { ...palette, schemeSymbols: kept } };
  },

  /**
   * Build a Module A `config.palette` object (architecture plan §4.6) from
   * an editor selection. Pure function.
   *
   * Per-PC assignment cycles the pool (PC p → pool[p % N]); cbSafeColors is
   * the matchToCBSafe() pairing for standard-family selections and the
   * identity mapping for CB-safe-family selections (LY spec §4.5, CB-safe
   * -as-primary); schemeSymbols maps each primary hex to its
   * nearestColorName-derived Scheme symbol.
   *
   * @param {object} selection  {source, family, presetKey, customColors, useCBSafe}
   * @returns {object} config.palette object
   */
  buildPalette(selection) {
    const pool = CNBPaletteEditor.selectionPool(selection);
    const useCBSafe = !!selection.useCBSafe;

    if (pool.length === 0) {
      return { name: "None", colors: [], cbSafeColors: [], useCBSafe, schemeSymbols: {} };
    }

    const isCBSafePrimary = selection.source === "custom"
      ? selection.family === "cbsafe"
      : (PALETTE_PRESET_KEYS[selection.presetKey] || {}).family === "cbsafe";

    // CB-safe branch pool, aligned index-for-index with the primary pool.
    // Matching runs on UNIQUE hexes so a repeated primary hex always maps to
    // the same CB-safe color — schemeSymbols is keyed by hex, and the
    // exporter needs one unambiguous accessible mapping per hex/symbol.
    let cbPool;
    if (isCBSafePrimary) {
      cbPool = pool.map(c => ({ name: c.name, hex: c.hex }));
    } else {
      const uniqueHexes = [...new Set(pool.map(c => c.hex))];
      const cbByHex = {};
      matchToCBSafe(uniqueHexes).forEach((m, i) => { cbByHex[uniqueHexes[i]] = m.cbSafe; });
      cbPool = pool.map(c => ({ name: cbByHex[c.hex].name, hex: cbByHex[c.hex].hex }));
    }

    const colors = [];
    const cbSafeColors = [];
    for (let pc = 0; pc < 12; pc++) {
      const idx = pc % pool.length;
      colors.push({ pc, hex: pool[idx].hex, name: pool[idx].name });
      cbSafeColors.push({ pc, hex: cbPool[idx].hex, name: cbPool[idx].name });
    }

    const schemeSymbols = {};
    for (const c of pool) {
      if (!(c.hex in schemeSymbols)) schemeSymbols[c.hex] = colorSchemeSymbol(c.hex);
    }

    const name = selection.source === "custom"
      ? "Custom · " + pool.length + " colors"
      : (PALETTE_PRESET_KEYS[selection.presetKey] || {}).label || selection.presetKey;

    return { name, colors, cbSafeColors, useCBSafe, schemeSymbols };
  },

  /**
   * Best-effort inverse of buildPalette: recover an editor selection from a
   * saved config.palette (for reopening the editor on a loaded config).
   * Returns the default selection when the palette is empty or not
   * recognizable.
   *
   * @param {object|null} palette
   * @returns {object} selection
   */
  selectionFromPalette(palette) {
    const sel = defaultSelection();
    if (!palette || !Array.isArray(palette.colors) || palette.colors.length === 0) return sel;
    sel.useCBSafe = !!palette.useCBSafe;

    // Recover the pool: shortest prefix whose cycling reproduces all entries
    const byPc = new Array(12).fill(null);
    for (const e of palette.colors) {
      if (e && Number.isInteger(e.pc) && e.pc >= 0 && e.pc < 12) byPc[e.pc] = e.hex;
    }
    if (byPc.some(h => h === null)) return sel;

    let pool = byPc;
    for (let n = 1; n < 12; n++) {
      if (byPc.every((hex, pc) => hex === byPc[pc % n])) { pool = byPc.slice(0, n); break; }
    }

    // Match against a preset (by exact hex sequence)
    for (const [key, info] of Object.entries(PALETTE_PRESET_KEYS)) {
      const preset = CNBPaletteEditor.presetColors(key);
      if (preset && preset.length === pool.length &&
          preset.every((c, i) => c.hex.toLowerCase() === pool[i].toLowerCase())) {
        sel.source = "preset";
        sel.family = info.family;
        sel.presetKey = key;
        return sel;
      }
    }

    sel.source = "custom";
    // A CB-safe-as-primary palette is stored with cbSafeColors identical to
    // colors (LY spec §4.5 identity mapping) — recover the CB-safe family
    // from that so re-editing keeps the identity branch.
    const cbByPc = new Map((palette.cbSafeColors || []).map(e => [e.pc, e.hex]));
    const isIdentity = palette.colors.length > 0 &&
      palette.colors.every(c => cbByPc.get(c.pc) === c.hex);
    sel.family = isIdentity ? "cbsafe" : "standard";
    sel.customColors = [...pool];
    return sel;
  },

  /**
   * Random color kept perceptually distinct from existing ones (legacy
   * PaletteUI.randomDistinctColor: 50 candidates, maximin ΔE).
   * @param {string[]} existing
   * @param {() => number} [rng]  injectable for tests
   * @returns {string} hex
   */
  randomDistinctColor(existing, rng = Math.random) {
    let best = "#808080", bestMinDist = 0;
    for (let attempt = 0; attempt < 50; attempt++) {
      const r = Math.floor(rng() * 200 + 28);
      const g = Math.floor(rng() * 200 + 28);
      const b = Math.floor(rng() * 200 + 28);
      const hex = rgbToHex(r, g, b);
      let minDist = 100;
      for (const ex of existing) {
        const d = deltaE(hex, ex);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) { bestMinDist = minDist; best = hex; }
    }
    return best;
  },

  /**
   * Render the palette editor into a container.
   *
   * Structure (all styling left to the host via class hooks):
   *   div.cnb-palette-editor
   *   ├── div.cnb-pal-tabs            (Standard / Colorblind-safe preset tabs)
   *   ├── div.cnb-pal-presets         (preset options grouped by size)
   *   ├── div.cnb-pal-custom          (custom colors: pick, edit, add, remove)
   *   ├── div.cnb-pal-cb-match        (CB-safe alternative pairing, ΔE)
   *   ├── label.cnb-pal-cb-toggle     (useCBSafe checkbox)
   *   ├── div.cnb-pal-preview         (per-PC color preview strip)
   *   └── div.cnb-pal-attribution     (palette source attribution)
   *
   * Events are wired as element properties (onclick/oninput/onchange) so the
   * editor is fully drivable in Node tests via a stub document.
   *
   * @param {HTMLElement} container
   * @param {{selection?:object, palette?:object, onChange?:(palette:object, selection:object)=>void}} [opts]
   *        Pass `selection` to start from an editor selection, or `palette`
   *        to recover one from a saved config.palette (selection wins).
   * @returns {{root:HTMLElement, getSelection:()=>object, getPalette:()=>object,
   *            setSelection:(sel:object)=>void, redraw:()=>void}}
   */
  render(container, opts = {}) {
    const doc = globalThis.document;
    const state = opts.selection
      ? { ...defaultSelection(), ...opts.selection }
      : CNBPaletteEditor.selectionFromPalette(opts.palette || null);
    const onChange = opts.onChange || (() => {});

    const root = doc.createElement("div");
    root.className = "cnb-palette-editor";

    const el = (tag, className, text) => {
      const e = doc.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };

    const emit = () => {
      onChange(CNBPaletteEditor.buildPalette(state), { ...state, customColors: [...state.customColors] });
    };

    const changed = () => {
      redraw();
      emit();
    };

    const selectFamily = (family) => {
      state.family = family;
      // Keep a preset selection meaningful across tabs: remap to the
      // same-size preset in the new family (legacy setMode behavior).
      if (state.source === "preset") {
        const info = PALETTE_PRESET_KEYS[state.presetKey];
        if (info && info.family !== family) {
          const prefix = family === "cbsafe" ? "cbsafe-" : "dark2-";
          state.presetKey = prefix + info.size;
        }
      }
      changed();
    };

    const selectPreset = (key) => {
      state.source = "preset";
      state.presetKey = key;
      changed();
    };

    const selectCustom = () => {
      state.source = "custom";
      if (!state.customColors || state.customColors.length === 0) {
        state.customColors = [...DEFAULT_CUSTOM_COLORS];
      }
      changed();
    };

    function drawTabs() {
      const tabs = el("div", "cnb-pal-tabs");
      for (const [family, label] of [["standard", "Standard"], ["cbsafe", "Colorblind-safe"]]) {
        const btn = el("button", "cnb-pal-tab" + (state.family === family ? " active" : ""), label);
        btn.type = "button";
        btn.onclick = () => selectFamily(family);
        tabs.appendChild(btn);
      }
      return tabs;
    }

    function drawPresets() {
      const wrap = el("div", "cnb-pal-presets");

      // Group active-family presets by size (legacy renderPresets)
      const groups = {};
      for (const [key, info] of Object.entries(PALETTE_PRESET_KEYS)) {
        if (info.family !== state.family) continue;
        (groups[info.size] = groups[info.size] || []).push(key);
      }

      for (const size of Object.keys(groups).map(Number).sort((a, b) => a - b)) {
        const group = el("div", "cnb-pal-size-group");
        group.appendChild(el("div", "cnb-pal-size-label", size + " colors"));

        for (const key of groups[size]) {
          const preset = CNBPaletteEditor.presetColors(key);
          const isSelected = state.source === "preset" && state.presetKey === key;
          const option = el("div", "cnb-pal-option" + (isSelected ? " selected" : ""));
          option.setAttribute("data-preset-key", key);

          const swatches = el("div", "cnb-pal-option-swatches");
          for (const c of preset) {
            const sw = el("div", "cnb-pal-swatch");
            sw.style.background = c.hex;
            sw.title = c.name + " " + c.hex;
            swatches.appendChild(sw);
          }
          option.appendChild(swatches);
          option.appendChild(el("span", "cnb-pal-option-name", PALETTE_PRESET_KEYS[key].label));
          option.onclick = () => selectPreset(key);
          group.appendChild(option);
        }
        wrap.appendChild(group);
      }
      return wrap;
    }

    function drawCustom() {
      const wrap = el("div", "cnb-pal-custom" + (state.source === "custom" ? " selected" : ""));

      const header = el("div", "cnb-pal-custom-header");
      const pick = el("button", "cnb-pal-custom-select",
        state.family === "cbsafe" ? "Custom CB-safe palette" : "Custom palette");
      pick.type = "button";
      pick.onclick = () => selectCustom();
      header.appendChild(pick);
      wrap.appendChild(header);

      if (state.family === "cbsafe" && state.source === "custom") {
        wrap.appendChild(el("div", "cnb-pal-warning",
          "⚠ Custom CB-safe palettes are not tested for all types of color " +
          "vision deficiency. When possible, use a preset."));
      }

      const cells = el("div", "cnb-pal-custom-colors");
      (state.customColors || []).forEach((hex, idx) => {
        const cell = el("div", "cnb-pal-custom-cell");
        const input = el("input", "cnb-pal-custom-input");
        input.type = "color";
        input.value = hex;
        // A drag step or typed digit (`input`) changes only the field's own
        // swatch; the colour applies once, when the picker closes (`change`,
        // session 36), so the page redraws once rather than on every step.
        input.onchange = (e) => {
          state.customColors[idx] = (e && e.target && e.target.value) || input.value;
          state.source = "custom";
          changed();
        };
        cell.appendChild(input);

        const remove = el("button", "cnb-pal-custom-remove", "×");
        remove.type = "button";
        remove.title = "Remove";
        remove.onclick = () => {
          if (state.customColors.length > 1) {
            state.customColors.splice(idx, 1);
            changed();
          }
        };
        cell.appendChild(remove);
        cells.appendChild(cell);
      });

      if ((state.customColors || []).length < 12) {
        const add = el("button", "cnb-pal-custom-add", "+");
        add.type = "button";
        add.onclick = () => {
          state.customColors = state.customColors || [];
          state.customColors.push(CNBPaletteEditor.randomDistinctColor(state.customColors));
          state.source = "custom";
          changed();
        };
        cells.appendChild(add);
      }
      wrap.appendChild(cells);

      if ((state.customColors || []).length > 0) {
        wrap.appendChild(el("div", "cnb-pal-custom-names",
          state.customColors.map(hex => nearestColorName(hex)).join(" · ")));
      }
      return wrap;
    }

    function drawCBMatch() {
      // Legacy renderCBMatch: only meaningful when the primary palette is a
      // standard one — CB-safe-as-primary uses the identity mapping.
      const wrap = el("div", "cnb-pal-cb-match");
      if (state.family !== "standard") return wrap;

      wrap.appendChild(el("div", "cnb-pal-cb-match-title", "CB-safe alternative (export branch)"));
      const pool = CNBPaletteEditor.selectionPool(state);
      if (pool.length === 0) {
        wrap.appendChild(el("div", "cnb-pal-cb-match-empty",
          "Select a palette to see the CB-safe alternative."));
        return wrap;
      }
      const matches = matchToCBSafe(pool.map(c => c.hex));
      for (const m of matches) {
        const row = el("div", "cnb-pal-cb-match-row");
        const from = el("div", "cnb-pal-swatch");
        from.style.background = m.original;
        row.appendChild(from);
        row.appendChild(el("span", "cnb-pal-cb-match-arrow", "→"));
        const to = el("div", "cnb-pal-swatch");
        to.style.background = m.cbSafe.hex;
        row.appendChild(to);
        row.appendChild(el("span", "cnb-pal-cb-match-name", m.cbSafe.name));
        row.appendChild(el("span", "cnb-pal-cb-match-de", "(ΔE " + m.distance + ")"));
        wrap.appendChild(row);
      }
      return wrap;
    }

    function drawCBToggle() {
      const label = el("label", "cnb-pal-cb-toggle");
      const checkbox = el("input", "cnb-pal-cb-toggle-input");
      checkbox.type = "checkbox";
      checkbox.checked = !!state.useCBSafe;
      checkbox.onchange = (e) => {
        state.useCBSafe = e && e.target ? !!e.target.checked : !!checkbox.checked;
        changed();
      };
      label.appendChild(checkbox);
      label.appendChild(el("span", "cnb-pal-cb-toggle-text",
        "Use colorblind-safe alternative colors (cnb:use-accessible-colors)"));
      // Preview-only (audit 2026-11-02, L2): the export carries both
      // branches whatever this toggle says; the score picks one.
      label.appendChild(el("span", "cnb-pal-preview-only",
        "Preview-only: the export carries both palettes, and a score uses the " +
        "colorblind-safe one when it sets cnb:use-accessible-colors to #t " +
        "before \\include."));
      return label;
    }

    function drawPreview() {
      const wrap = el("div", "cnb-pal-preview");
      wrap.appendChild(el("div", "cnb-pal-preview-title", "Colors per pitch class"));
      const strip = el("div", "cnb-pal-preview-strip");
      const palette = CNBPaletteEditor.buildPalette(state);
      const active = state.useCBSafe ? palette.cbSafeColors : palette.colors;
      for (let pc = 0; pc < 12; pc++) {
        const entry = active.find(c => c.pc === pc);
        const cell = el("div", "cnb-pal-preview-cell");
        cell.appendChild(el("div", "cnb-pal-preview-label", PC_LABELS[pc]));
        const sw = el("div", "cnb-pal-swatch cnb-pal-preview-swatch");
        if (entry) {
          sw.style.background = entry.hex;
          sw.title = entry.name + " " + entry.hex +
            (palette.schemeSymbols[entry.hex] ? " · " + palette.schemeSymbols[entry.hex] : "");
        }
        cell.appendChild(sw);
        strip.appendChild(cell);
      }
      wrap.appendChild(strip);
      return wrap;
    }

    function drawAttribution() {
      return el("div", "cnb-pal-attribution",
        "Palette sources: “Dark2” after ColorBrewer (Brewer et al.; the " +
        "11-color set adds four hues of our own). CB-safe presets follow " +
        "Paul Tol’s colorblind-safe schemes; the 11-color CB-safe set is " +
        "this project’s own. Labels describe colors only.");
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      root.appendChild(drawTabs());
      root.appendChild(drawPresets());
      root.appendChild(drawCustom());
      root.appendChild(drawCBMatch());
      root.appendChild(drawCBToggle());
      root.appendChild(drawPreview());
      root.appendChild(drawAttribution());
    }

    redraw();
    container.appendChild(root);

    return {
      root,
      getSelection: () => ({ ...state, customColors: [...(state.customColors || [])] }),
      getPalette: () => CNBPaletteEditor.buildPalette(state),
      setSelection: (sel) => { Object.assign(state, sel); changed(); },
      redraw,
    };
  },
};
