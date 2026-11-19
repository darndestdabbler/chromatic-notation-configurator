/**
 * cnb-color.js — colour math and colour names (session 37)
 *
 * Moved verbatim from cnb/ui/palette-editor.js (Module 12), which ported it
 * from the legacy music-color-palettes.js and configurator-core.js (tag
 * legacy-monolith-final). It lives in src so the LilyPond exporter can name
 * the colours it registers from their hex, and the UI can name a colour for
 * a designer:
 *
 *   hexToRgb, rgbToHex, hexToLab   sRGB ↔ CIELAB (D65)
 *   deltaE(hex1, hex2)             CIEDE2000 difference
 *   NAMED_COLORS                   ~150 common colour names
 *   nearestColorName(hex)          "#1b9e77" → "Shamrock-#1b9e77"
 *   baseColorName(hex)             "#1b9e77" → "Shamrock"
 *   toSchemeSymbol(name)           "Shamrock-#1b9e77" → "shamrock-1b9e77"
 *   schemeSymbol(hex)              "#1b9e77" → "shamrock-1b9e77"
 *
 * Dependencies: none.
 */

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
 * "#1b9e77" → "shamrock-1b9e77".
 */
function schemeSymbol(hex) {
  if (!hex || typeof hex !== "string") return "black-000000";
  return toSchemeSymbol(nearestColorName(hex));
}

export const CNBColor = {
  hexToRgb,
  rgbToHex,
  hexToLab,
  deltaE,
  NAMED_COLORS,
  nearestColorName,
  baseColorName,
  toSchemeSymbol,
  schemeSymbol,
};
