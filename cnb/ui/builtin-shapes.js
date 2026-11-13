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
 * the noteheads (NAMES).
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
        "x": -73,
        "y": -180
      },
      "minimDown": {
        "x": 73,
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
        "x": -0.73,
        "y": 1.8
      },
      "minimDown": {
        "x": 0.73,
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
        "x": -73,
        "y": -180
      },
      "minimDown": {
        "x": 73,
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
        "x": -0.73,
        "y": 1.8
      },
      "minimDown": {
        "x": 0.73,
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

const ALL = { ...SHAPES, ...SIGNATURE_SHAPES };

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
