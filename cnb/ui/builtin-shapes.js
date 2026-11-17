/**
 * builtin-shapes.js — the built-in notehead shapes (session 27)
 *
 * A small set, so a new user can design without importing anything
 * (design docs/planning/notehead-first-editor-design.md §2): the default
 * oval (crotchet-minim, as CNBConfig.createDefault has it) and the three
 * shapes of the repository's fixtures, ellipse-45deg
 * (cnb/fixtures/45deg-369-config.json) and kite-up and kite-down
 * (cnb/fixtures/kite-4-369-config.json). Each carries its SVG and LilyPond
 * data, as an imported shape does; cnb/tests/cnb-builtin-shapes-tests.js
 * pins each one equal to its source. Since session 64 the key signature has
 * one of its own, the parallelogram, reached by name but not offered among
 * the noteheads (NAMES), and since session 75 the conventional noteheads
 * are reached so too (CONVENTIONAL_SHAPES).
 *
 * A built-in shape enters a config only when it is first chosen
 * (withShape). The exporter emits only the shapes in use, so an unused
 * built-in shape changes nothing.
 */

import { CNBConfig } from "../src/cnb-config.js";

/** The shapes, by name, in display order. */
const SHAPES = {
  "crotchet-minim": CNBConfig.createDefault().shapes["crotchet-minim"],
  "ellipse-45deg": {
    "displayName": "Ellipse 45deg",
    "svgPath": "M 102.891 102.887 C 8.182 197.596 -114.661 228.307 -171.486 171.481 C -228.311 114.656 -197.6 -8.186 -102.892 -102.895 C -57.411 -148.376 -2.952 -181.154 48.503 -194.018 C 99.959 -206.882 144.197 -198.778 171.485 -171.49 C 228.31 -114.665 197.6 8.178 102.891 102.887 Z",
    "svgHollowPath": "M 51.447 51.443 C -33.791 136.681 -125.924 182.746 -154.337 154.333 C -167.982 140.688 -164.807 111.342 -145.511 72.75 C -126.216 34.158 -92.38 -10.518 -51.447 -51.451 C -10.515 -92.384 34.162 -126.22 72.754 -145.515 C 111.346 -164.811 140.692 -167.985 154.336 -154.341 C 182.75 -125.928 136.684 -33.795 51.447 51.443 Z",
    "naturalHeight": 400,
    "naturalWidth": 400.029,
    "semitoneHeight": 4,
    "anchors": {
      "crotchetUp": {
        "x": 0,
        "y": -164.9111
      },
      "crotchetDown": {
        "x": 0,
        "y": 164.9456
      },
      "minimUp": {
        "x": 0,
        "y": -164.9111
      },
      "minimDown": {
        "x": 0,
        "y": 164.9456
      }
    },
    "lilypondPath": "'(\n    (moveto 1.0289 -1.0289)\n    (curveto 0.0818 -1.976 -1.1466 -2.2831 -1.7149 -1.7148)\n    (curveto -2.2831 -1.1466 -1.976 0.0819 -1.0289 1.029)\n    (curveto -0.5741 1.4838 -0.0295 1.8115 0.485 1.9402)\n    (curveto 0.9996 2.0688 1.442 1.9878 1.7149 1.7149)\n    (curveto 2.2831 1.1467 1.976 -0.0818 1.0289 -1.0289)\n    (closepath))",
    "lilypondHollowPath": "'(\n    (moveto 0.5145 -0.5144)\n    (curveto -0.3379 -1.3668 -1.2592 -1.8275 -1.5434 -1.5433)\n    (curveto -1.6798 -1.4069 -1.6481 -1.1134 -1.4551 -0.7275)\n    (curveto -1.2622 -0.3416 -0.9238 0.1052 -0.5145 0.5145)\n    (curveto -0.1052 0.9238 0.3416 1.2622 0.7275 1.4551)\n    (curveto 1.1135 1.6481 1.4069 1.6799 1.5434 1.5434)\n    (curveto 1.8275 1.2593 1.3668 0.338 0.5145 -0.5144)\n    (closepath))",
    "lilypondAnchors": {
      "crotchetUp": {
        "x": 0,
        "y": 1.6491
      },
      "crotchetDown": {
        "x": 0,
        "y": -1.6495
      },
      "minimUp": {
        "x": 0,
        "y": 1.6491
      },
      "minimDown": {
        "x": 0,
        "y": -1.6495
      }
    }
  },
  "kite-up": {
    "displayName": "Kite (up)",
    "svgPath": "M 0 -200 L 200 -100 L 0 200 L -200 -100 L 0 -200 Z",
    "svgHollowPath": "M 100 -100 L 0 100 L -100 -100 L 100 -100 Z",
    "naturalHeight": 400,
    "naturalWidth": 400,
    "semitoneHeight": 4,
    "anchors": {
      "crotchetUp": {
        "x": 0,
        "y": -180
      },
      "crotchetDown": {
        "x": 0,
        "y": 180
      },
      "minimUp": {
        "x": 0,
        "y": -180
      },
      "minimDown": {
        "x": 0,
        "y": 180
      }
    },
    "lilypondPath": "'(\n    (moveto 0 2)\n    (lineto 2 1)\n    (lineto 0 -2)\n    (lineto -2 1)\n    (lineto 0 2)\n    (closepath))",
    "lilypondHollowPath": "'(\n    (moveto 1 1)\n    (lineto 0 -1)\n    (lineto -1 1)\n    (lineto 1 1)\n    (closepath))",
    "lilypondAnchors": {
      "crotchetUp": {
        "x": 0,
        "y": 1.8
      },
      "crotchetDown": {
        "x": 0,
        "y": -1.8
      },
      "minimUp": {
        "x": 0,
        "y": 1.8
      },
      "minimDown": {
        "x": 0,
        "y": -1.8
      }
    }
  },
  "kite-down": {
    "displayName": "Kite (down)",
    "svgPath": "M 0 200 L -200 100 L 0 -200 L 200 100 L 0 200 Z",
    "svgHollowPath": "M -100 100 L 0 -100 L 100 100 L -100 100 Z",
    "naturalHeight": 400,
    "naturalWidth": 400,
    "semitoneHeight": 4,
    "anchors": {
      "crotchetUp": {
        "x": 0,
        "y": -180
      },
      "crotchetDown": {
        "x": 0,
        "y": 180
      },
      "minimUp": {
        "x": 0,
        "y": -180
      },
      "minimDown": {
        "x": 0,
        "y": 180
      }
    },
    "lilypondPath": "'(\n    (moveto 0 -2)\n    (lineto -2 -1)\n    (lineto 0 2)\n    (lineto 2 -1)\n    (lineto 0 -2)\n    (closepath))",
    "lilypondHollowPath": "'(\n    (moveto -1 -1)\n    (lineto 0 1)\n    (lineto 1 -1)\n    (lineto -1 -1)\n    (closepath))",
    "lilypondAnchors": {
      "crotchetUp": {
        "x": 0,
        "y": 1.8
      },
      "crotchetDown": {
        "x": 0,
        "y": -1.8
      },
      "minimUp": {
        "x": 0,
        "y": 1.8
      },
      "minimDown": {
        "x": 0,
        "y": -1.8
      }
    }
  },
};

/**
 * Built-in shapes for key-signature marks only (session 64, step-by-step
 * design §3.5), by name, not among the noteheads' NAMES. The parallelogram,
 * the Custom marks starting point's symbol: 2 semitones high and 4 wide,
 * leaning right, solid, stemless and taking no ledger lines; the exporter
 * converts its SVG path (no pre-baked LilyPond path).
 */
const SIGNATURE_SHAPES = {
  "parallelogram": {
    "displayName": "Parallelogram",
    "svgPath": "M -200 100 L 100 100 L 200 -100 L -100 -100 Z",
    "svgHollowPath": null,
    "naturalHeight": 200,
    "naturalWidth": 400,
    "semitoneHeight": 2,
    "anchors": null,
    "lilypondPath": null,
    "lilypondHollowPath": null,
    "lilypondAnchors": null,
    "ledgers": false,
  },
};

/**
 * The conventional noteheads (session 75, design
 * docs/planning/notehead-duration-design.md §5), by name, not among the
 * noteheads' NAMES: the Conventional noteheads design gives them. Each is
 * the operator's SVG under cnb/assets/shapes/conventional/, drawn with the
 * music-glyph-toolkit from LilyPond's Emmentaler glyphs (SIL OFL 1.1,
 * cnb/assets/fonts/OFL-Emmentaler.txt), as the SVG importer reads it:
 * crotchet-and-minim.svg the crotchet's head, solid, and the minim's,
 * hollow; semibreve.svg the semibreve; breve-with-bars-01.svg the breve,
 * the semibreve's head with its breve-bar-left and breve-bar-right paths
 * joined to it (single bars), each bar turned to wind as the head does so
 * that the two fill together. Each head is 2 semitones tall at its own
 * size; the breve's bars reach past its head, and its natural width is
 * the bars' extent. The breve and its hollow have no pre-baked LilyPond
 * path: the exporter converts their SVG paths.
 */
const CONVENTIONAL_SHAPES = {
  "conventional-crotchet": {
    "displayName": "Conventional crotchet",
    "svgPath": "M 120.122 -59.891 C 130.711 -38.652 128.211 -11.973 113.172 14.277 C 98.132 40.527 71.785 64.197 39.927 80.081 C 8.068 95.965 -26.691 102.761 -56.706 98.975 C -86.722 95.188 -109.533 81.129 -120.122 59.89 C -130.711 38.651 -128.211 11.973 -113.172 -14.277 C -98.132 -40.527 -71.785 -64.197 -39.927 -80.081 C -8.069 -95.965 26.691 -102.762 56.706 -98.976 C 86.722 -95.189 109.532 -81.13 120.122 -59.891 Z",
    "svgHollowPath": "M 100.102 -49.909 C 111.127 -27.796 75.248 12.476 19.964 40.041 C -35.321 67.604 -89.076 72.023 -100.102 49.908 C -111.127 27.795 -75.248 -12.477 -19.964 -40.041 C 35.321 -67.605 89.076 -72.023 100.102 -49.909 Z",
    "naturalHeight": 200,
    "naturalWidth": 253.168,
    "semitoneHeight": 2,
    "anchors": {
      "crotchetUp": { "x": 115.4726, "y": -31.5765 },
      "crotchetDown": { "x": -115.4726, "y": 31.5761 },
      "minimUp": { "x": 115.4726, "y": -31.5765 },
      "minimDown": { "x": -115.4726, "y": 31.5761 }
    },
    "lilypondPath": "'(\n    (moveto 1.2012 0.5989)\n    (curveto 1.3071 0.3865 1.2821 0.1197 1.1317 -0.1428)\n    (curveto 0.9813 -0.4053 0.7178 -0.642 0.3993 -0.8008)\n    (curveto 0.0807 -0.9597 -0.2669 -1.0276 -0.5671 -0.9898)\n    (curveto -0.8672 -0.9519 -1.0953 -0.8113 -1.2012 -0.5989)\n    (curveto -1.3071 -0.3865 -1.2821 -0.1197 -1.1317 0.1428)\n    (curveto -0.9813 0.4053 -0.7178 0.642 -0.3993 0.8008)\n    (curveto -0.0807 0.9597 0.2669 1.0276 0.5671 0.9898)\n    (curveto 0.8672 0.9519 1.0953 0.8113 1.2012 0.5989)\n    (closepath))",
    "lilypondHollowPath": "'(\n    (moveto 1.001 0.4991)\n    (curveto 1.1113 0.278 0.7525 -0.1248 0.1996 -0.4004)\n    (curveto -0.3532 -0.676 -0.8908 -0.7202 -1.001 -0.4991)\n    (curveto -1.1113 -0.278 -0.7525 0.1248 -0.1996 0.4004)\n    (curveto 0.3532 0.6761 0.8908 0.7202 1.001 0.4991)\n    (closepath))",
    "lilypondAnchors": {
      "crotchetUp": { "x": 1.1547, "y": 0.3158 },
      "crotchetDown": { "x": -1.1547, "y": -0.3158 },
      "minimUp": { "x": 1.1547, "y": 0.3158 },
      "minimDown": { "x": -1.1547, "y": -0.3158 }
    }
  },
  "conventional-semibreve": {
    "displayName": "Conventional semibreve",
    "svgPath": "M 183.333 0.0 C 183.333 26.522 164.018 51.957 129.637 70.711 C 95.255 89.464 48.623 100.0 0.0 100.0 C -48.623 100.0 -95.254 89.464 -129.636 70.711 C -164.017 51.957 -183.333 26.522 -183.333 0.0 C -183.333 -26.522 -164.017 -51.957 -129.636 -70.711 C -95.254 -89.464 -48.623 -100.0 0.0 -100.0 C 48.623 -100.0 95.255 -89.464 129.637 -70.711 C 164.018 -51.957 183.333 -26.522 183.333 0.0 Z",
    "svgHollowPath": "M 37.184 74.578 C 21.36 82.467 2.267 82.176 -15.895 73.769 C -34.057 65.361 -49.8 49.526 -59.662 29.747 C -80.198 -11.442 -70.133 -58.149 -37.183 -74.578 C -4.232 -91.007 39.127 -70.935 59.663 -29.747 C 80.198 11.442 70.134 58.149 37.184 74.578 Z",
    "naturalHeight": 200,
    "naturalWidth": 366.666,
    "semitoneHeight": 2,
    "anchors": null,
    "lilypondPath": "'(\n    (moveto 1.8333 0)\n    (curveto 1.8333 -0.2652 1.6402 -0.5196 1.2964 -0.7071)\n    (curveto 0.9526 -0.8946 0.4862 -1 0 -1)\n    (curveto -0.4862 -1 -0.9525 -0.8946 -1.2964 -0.7071)\n    (curveto -1.6402 -0.5196 -1.8333 -0.2652 -1.8333 0)\n    (curveto -1.8333 0.2652 -1.6402 0.5196 -1.2964 0.7071)\n    (curveto -0.9525 0.8946 -0.4862 1 0 1)\n    (curveto 0.4862 1 0.9526 0.8946 1.2964 0.7071)\n    (curveto 1.6402 0.5196 1.8333 0.2652 1.8333 0)\n    (closepath))",
    "lilypondHollowPath": "'(\n    (moveto 0.3718 -0.7458)\n    (curveto 0.2136 -0.8247 0.0227 -0.8218 -0.159 -0.7377)\n    (curveto -0.3406 -0.6536 -0.498 -0.4953 -0.5966 -0.2975)\n    (curveto -0.802 0.1144 -0.7013 0.5815 -0.3718 0.7458)\n    (curveto -0.0423 0.9101 0.3913 0.7094 0.5966 0.2975)\n    (curveto 0.802 -0.1144 0.7013 -0.5815 0.3718 -0.7458)\n    (closepath))",
    "lilypondAnchors": null
  },
  "conventional-breve": {
    "displayName": "Conventional breve",
    "svgPath": "M 183.333 0.0 C 183.333 26.522 164.018 51.957 129.637 70.711 C 95.255 89.464 48.623 100.0 0.0 100.0 C -48.623 100.0 -95.254 89.464 -129.636 70.711 C -164.017 51.957 -183.333 26.522 -183.333 0.0 C -183.333 -26.522 -164.017 -51.957 -129.636 -70.711 C -95.254 -89.464 -48.623 -100.0 0.0 -100.0 C 48.623 -100.0 95.255 -89.464 129.637 -70.711 C 164.018 -51.957 183.333 -26.522 183.333 0.0 Z M -184.4674 -130.6875 C -176.481 -130.6875 -169.9466 -124.1531 -169.9466 -116.1667 L -169.9466 116.1667 C -169.9466 124.1531 -176.481 130.6875 -184.4674 130.6875 C -192.4539 130.6875 -198.9883 124.1531 -198.9883 116.1667 L -198.9883 -116.1667 C -198.9883 -124.1531 -192.4539 -130.6875 -184.4674 -130.6875 Z M 183.333 -130.6875 C 191.3195 -130.6875 197.8538 -124.1531 197.8538 -116.1667 L 197.8538 116.1667 C 197.8538 124.1531 191.3195 130.6875 183.333 130.6875 C 175.3465 130.6875 168.8122 124.1531 168.8122 116.1667 L 168.8122 -116.1667 C 168.8122 -124.1531 175.3465 -130.6875 183.333 -130.6875 Z",
    "svgHollowPath": "M 37.184 74.578 C 21.36 82.467 2.267 82.176 -15.895 73.769 C -34.057 65.361 -49.8 49.526 -59.662 29.747 C -80.198 -11.442 -70.133 -58.149 -37.183 -74.578 C -4.232 -91.007 39.127 -70.935 59.663 -29.747 C 80.198 11.442 70.134 58.149 37.184 74.578 Z",
    "naturalHeight": 200,
    "naturalWidth": 396.8421,
    "semitoneHeight": 2,
    "anchors": null,
    "lilypondPath": null,
    "lilypondHollowPath": null,
    "lilypondAnchors": null
  },
};

const ALL = { ...SHAPES, ...SIGNATURE_SHAPES, ...CONVENTIONAL_SHAPES };

export const CNBBuiltinShapes = {

  /** The built-in notehead shape names, in display order (the notehead
   *  panel's; the key signature's own shapes are reached by name). */
  NAMES: Object.keys(SHAPES),

  /**
   * A copy of a built-in shape, or null for a name that is not one.
   * @param {string} name
   * @returns {object|null}
   */
  get(name) {
    return Object.hasOwn(ALL, name) ? JSON.parse(JSON.stringify(ALL[name])) : null;
  },

  /**
   * The config with a built-in shape added to config.shapes when it is not
   * there yet. A shape the config already has under that name is left as it
   * is, and so is a name that is not a built-in shape. The input is not
   * changed.
   * @param {object} config
   * @param {string} name
   * @returns {object}
   */
  withShape(config, name) {
    const shapes = config.shapes || {};
    if (Object.hasOwn(shapes, name) || !Object.hasOwn(ALL, name)) return config;
    return { ...config, shapes: { ...shapes, [name]: CNBBuiltinShapes.get(name) } };
  },
};
