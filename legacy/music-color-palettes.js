/**
 * music-color-palettes.js
 * 
 * Self-contained color palette module for alternative music notation.
 * No external dependencies.
 * 
 * Provides:
 *  - Curated standard + colorblind-safe palettes at sizes 2, 3, 4, 6, 7, 11
 *  - nearestColorName(hex) — finds closest named color via CIELAB ΔE 2000
 *  - matchToCBSafe(hexArray) — maps any palette to colorblind-safe alternatives
 *  - deltaE(hex1, hex2) — perceptual color distance
 *  - distanceFromWhite(hex)
 */

(function(root) {
  "use strict";

  // ============================================================
  // COLOR MATH (sRGB → XYZ → CIELAB, ΔE 2000)
  // ============================================================

  function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function(c) {
      return Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
    }).join('');
  }

  function srgbToLinear(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function rgbToXyz(r, g, b) {
    var rl = srgbToLinear(r);
    var gl = srgbToLinear(g);
    var bl = srgbToLinear(b);
    return [
      0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl,
      0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl,
      0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl
    ];
  }

  // D65 white point
  var Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;

  function labF(t) {
    var d = 6 / 29;
    return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
  }

  function xyzToLab(x, y, z) {
    var fx = labF(x / Xn);
    var fy = labF(y / Yn);
    var fz = labF(z / Zn);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function hexToLab(hex) {
    var rgb = hexToRgb(hex);
    var xyz = rgbToXyz(rgb[0], rgb[1], rgb[2]);
    return xyzToLab(xyz[0], xyz[1], xyz[2]);
  }

  /**
   * CIEDE2000 color difference
   * Reference: Sharma, Wu, Dalal (2005)
   */
  function deltaE(hex1, hex2) {
    var PI = Math.PI;
    var abs = Math.abs, sqrt = Math.sqrt, pow = Math.pow;
    var cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, exp = Math.exp;

    function rad2deg(rad) { return (360 * rad) / (2 * PI); }
    function deg2rad(deg) { return (2 * PI * deg) / 360; }

    var lab1 = hexToLab(hex1);
    var lab2 = hexToLab(hex2);
    var L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
    var L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];

    var avgL = (L1 + L2) / 2;
    var C1 = sqrt(a1 * a1 + b1 * b1);
    var C2 = sqrt(a2 * a2 + b2 * b2);
    var avgC = (C1 + C2) / 2;

    var G = 0.5 * (1 - sqrt(pow(avgC, 7) / (pow(avgC, 7) + pow(25, 7))));
    var a1p = a1 * (1 + G);
    var a2p = a2 * (1 + G);
    var C1p = sqrt(a1p * a1p + b1 * b1);
    var C2p = sqrt(a2p * a2p + b2 * b2);
    var avgCp = (C1p + C2p) / 2;

    var h1p = rad2deg(atan2(b1, a1p));
    if (h1p < 0) h1p += 360;
    var h2p = rad2deg(atan2(b2, a2p));
    if (h2p < 0) h2p += 360;

    var avgHp = abs(h1p - h2p) > 180
      ? (h1p + h2p + 360) / 2
      : (h1p + h2p) / 2;

    var T = 1
      - 0.17 * cos(deg2rad(avgHp - 30))
      + 0.24 * cos(deg2rad(2 * avgHp))
      + 0.32 * cos(deg2rad(3 * avgHp + 6))
      - 0.20 * cos(deg2rad(4 * avgHp - 63));

    var dhp = h2p - h1p;
    if (abs(dhp) > 180) {
      dhp = h2p <= h1p ? dhp + 360 : dhp - 360;
    }
    dhp = 2 * sqrt(C1p * C2p) * sin(deg2rad(dhp) / 2);

    var dL = L2 - L1;
    var dCp = C2p - C1p;

    var sl = 1 + (0.015 * pow(avgL - 50, 2)) / sqrt(20 + pow(avgL - 50, 2));
    var sc = 1 + 0.045 * avgCp;
    var sh = 1 + 0.015 * avgCp * T;

    var dTheta = 30 * exp(-pow((avgHp - 275) / 25, 2));
    var Rc = 2 * sqrt(pow(avgCp, 7) / (pow(avgCp, 7) + pow(25, 7)));
    var Rt = -Rc * sin(2 * deg2rad(dTheta));

    var result = sqrt(
      pow(dL / sl, 2) +
      pow(dCp / sc, 2) +
      pow(dhp / sh, 2) +
      Rt * (dCp / sc) * (dhp / sh)
    );

    return Math.max(0, Math.min(100, result));
  }

  function distanceFromWhite(hex) {
    return deltaE(hex, '#ffffff');
  }


  // ============================================================
  // NAMED COLOR DICTIONARY (~150 common colors)
  // ============================================================

  var NAMED_COLORS = {
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
    "Zinnwaldite Brown": "#2C1608"
  };


  // ============================================================
  // nearestColorName(hex) → "ColorName-#hexvalue"
  // ============================================================

  function nearestColorName(hex) {
    var bestName = "Unknown";
    var bestDist = Infinity;

    for (var name in NAMED_COLORS) {
      if (!NAMED_COLORS.hasOwnProperty(name)) continue;
      var dist = deltaE(hex, NAMED_COLORS[name]);
      if (dist < bestDist) {
        bestDist = dist;
        bestName = name;
      }
    }

    var normalized = rgbToHex.apply(null, hexToRgb(hex));
    return bestName + "-" + normalized;
  }


  // ============================================================
  // COLORBLIND-SAFE SOURCE PALETTE (12 colors)
  // ============================================================

  var CB_SAFE_SOURCE = [
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
    { name: "Mint",       hex: "#00fccf" }
  ];


  // ============================================================
  // matchToCBSafe(hexArray)
  //
  // Takes an array of hex strings and returns an array of objects:
  //   { original, cbSafe: {name, hex}, distance }
  //
  // Uses greedy closest-first assignment so the best matches
  // are claimed first.
  // ============================================================

  function matchToCBSafe(hexArray) {
    if (hexArray.length > CB_SAFE_SOURCE.length) {
      throw new Error(
        "Cannot match " + hexArray.length + " colors; CB-safe source has " + CB_SAFE_SOURCE.length
      );
    }

    var n = hexArray.length;
    var m = CB_SAFE_SOURCE.length;

    // Build all pairs with distances
    var pairs = [];
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < m; j++) {
        pairs.push({ i: i, j: j, d: deltaE(hexArray[i], CB_SAFE_SOURCE[j].hex) });
      }
    }
    pairs.sort(function(a, b) { return a.d - b.d; });

    // Greedy assignment
    var usedInput = {};
    var usedCB = {};
    var result = new Array(n);
    var assigned = 0;

    for (var k = 0; k < pairs.length && assigned < n; k++) {
      var p = pairs[k];
      if (usedInput[p.i] || usedCB[p.j]) continue;
      usedInput[p.i] = true;
      usedCB[p.j] = true;
      result[p.i] = {
        original: hexArray[p.i],
        cbSafe: { name: CB_SAFE_SOURCE[p.j].name, hex: CB_SAFE_SOURCE[p.j].hex },
        distance: Math.round(p.d * 10) / 10
      };
      assigned++;
    }

    return result;
  }


  // ============================================================
  // CURATED PALETTES
  // ============================================================

  var STANDARD_PALETTES = {
    2: [
      { name: "Teal",    hex: "#1b9e77" },
      { name: "Orange",  hex: "#d95f02" }
    ],
    3: [
      { name: "Teal",    hex: "#1b9e77" },
      { name: "Orange",  hex: "#d95f02" },
      { name: "Lilac",   hex: "#7570b3" }
    ],
    4: [
      { name: "Teal",    hex: "#1b9e77" },
      { name: "Orange",  hex: "#d95f02" },
      { name: "Lilac",   hex: "#7570b3" },
      { name: "Pink",    hex: "#e7298a" }
    ],
    6: [
      { name: "Teal",    hex: "#1b9e77" },
      { name: "Orange",  hex: "#d95f02" },
      { name: "Lilac",   hex: "#7570b3" },
      { name: "Pink",    hex: "#e7298a" },
      { name: "Green",   hex: "#66a61e" },
      { name: "Gold",    hex: "#e6ab02" }
    ],
    7: [
      { name: "Teal",    hex: "#1b9e77" },
      { name: "Orange",  hex: "#d95f02" },
      { name: "Lilac",   hex: "#7570b3" },
      { name: "Pink",    hex: "#e7298a" },
      { name: "Green",   hex: "#66a61e" },
      { name: "Gold",    hex: "#e6ab02" },
      { name: "Brown",   hex: "#a6761d" }
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
      { name: "Plum",       hex: "#6a3d9a" }
    ]
  };

  var COLORBLIND_SAFE_PALETTES = {
    2: [
      { name: "Blue",    hex: "#0077BB" },
      { name: "Orange",  hex: "#EE7733" }
    ],
    3: [
      { name: "Blue",    hex: "#0077BB" },
      { name: "Orange",  hex: "#EE7733" },
      { name: "Teal",    hex: "#009988" }
    ],
    4: [
      { name: "Blue",    hex: "#4477AA" },
      { name: "Yellow",  hex: "#CCBB44" },
      { name: "Red",     hex: "#EE6677" },
      { name: "Green",   hex: "#228833" }
    ],
    6: [
      { name: "Blue",    hex: "#0077BB" },
      { name: "Cyan",    hex: "#33BBEE" },
      { name: "Teal",    hex: "#009988" },
      { name: "Orange",  hex: "#EE7733" },
      { name: "Red",     hex: "#CC3311" },
      { name: "Magenta", hex: "#EE3377" }
    ],
    7: [
      { name: "Blue",    hex: "#4477AA" },
      { name: "Cyan",    hex: "#66CCEE" },
      { name: "Green",   hex: "#228833" },
      { name: "Yellow",  hex: "#CCBB44" },
      { name: "Red",     hex: "#EE6677" },
      { name: "Purple",  hex: "#AA3377" },
      { name: "Gray",    hex: "#778899" }
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
      { name: "Crimson",    hex: "#e20134" }
    ]
  };


  // ============================================================
  // PUBLIC API
  // ============================================================

  var MusicColorPalettes = {
    deltaE: deltaE,
    distanceFromWhite: distanceFromWhite,
    nearestColorName: nearestColorName,
    matchToCBSafe: matchToCBSafe,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    hexToLab: hexToLab,
    NAMED_COLORS: NAMED_COLORS,
    STANDARD_PALETTES: STANDARD_PALETTES,
    COLORBLIND_SAFE_PALETTES: COLORBLIND_SAFE_PALETTES,
    CB_SAFE_SOURCE: CB_SAFE_SOURCE
  };

  if (typeof window !== 'undefined') {
    window.MusicColorPalettes = MusicColorPalettes;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicColorPalettes;
  }

})(this);
