/**
 * builtin-clefs.js — the clefs the Clef panel offers (session 45)
 *
 * A designer picks a clef without importing one: the engine's dozenal clef,
 * or a standard treble, bass or alto clef. definition(config, name) gives
 * the clef definition (config.clef.glyphs entry, architecture plan §4.12)
 * for the config's staff.
 *
 * The standard clefs are LilyPond's own glyphs, clefs.G, clefs.F and
 * clefs.C of the Emmentaler font (emmentaler-20.otf as shipped with
 * LilyPond 2.24), licensed under the SIL Open Font License 1.1
 * (cnb/assets/fonts/OFL-Emmentaler.txt; Reserved Font Names "Emmentaler"
 * and "Feta"). Their outlines are copied unaltered: font units, Y negated
 * so they read as SVG paths, absolute M/L/C/Z commands only (the commands
 * the LilyPond exporter converts). Each glyph's origin is the line it
 * marks, the G, F or C line, and 250 font units are a staff space, as
 * LilyPond draws them on a 20-point staff.
 *
 * A standard clef is placed as LilyPond places it on a staff: its line on
 * the pitch it marks (G for treble, F for bass, C for alto), here in the
 * octave nearest the staff's middle (staff.midpoint), at LilyPond's size in
 * staff spaces (semitonesPerStaffSpace semitones, or axisUnitsPerStaffSpace
 * under a pitch axis). It is then an ordinary glyph clef: its anchorSemi is
 * its top and its semitoneHeight its height, which the designer can change,
 * and it exports through cnb:register-clef! as an imported glyph does.
 *
 * Dependencies: Module 20 (CNBClef.staffSpacePx, the staff space).
 */

import { CNBClef } from "../src/cnb-clef.js";

/** Font units per staff space in Emmentaler. */
const UNITS_PER_STAFF_SPACE = 250;

/**
 * The standard clefs: the pitch class each marks, and its glyph. lineFromTop
 * is the marked line's depth below the glyph's top, in font units.
 */
const STANDARD = {
  treble: {
    displayName: "Treble",
    glyph: "clefs.G",
    pc: 7,
    svgPath: "M 266 635 L 267 592 L 263 592 C 214 592 172 566 146 527 C 156 531 166 533 177 533 C 229 533 272 490 272 438 C 272 382 231 335 177 335 C 118 335 65 380 65 438 C 65 547 152 635 260 635 Z M 461 203 C 447 80 425 -35 401 -151 C 508 -140 574 -51 574 39 C 574 108 529 179 461 203 Z M 74 -28 C 74 -188 180 -310 287 -431 C 304 -373 319 -314 333 -256 C 231 -233 173 -147 173 -59 C 173 11 210 83 290 126 C 293 127 296 128 299 128 C 311 128 321 117 321 106 C 321 101 319 96 314 91 C 258 59 233 12 233 -32 C 233 -90 278 -143 357 -151 C 383 -32 406 86 420 213 C 393 217 366 219 338 219 C 203 219 74 107 74 -28 Z M 335 262 C 366 262 395 259 424 254 C 427 285 428 315 428 346 C 428 364 427 383 426 401 C 420 500 360 590 267 592 L 266 635 C 380 632 461 526 468 407 C 469 388 470 368 470 349 C 470 314 468 279 465 244 C 491 236 516 225 538 208 C 612 152 645 74 645 -2 C 645 -135 544 -263 389 -263 C 385 -263 380 -262 376 -262 C 359 -331 341 -401 320 -469 C 414 -578 500 -690 500 -833 C 500 -946 438 -1107 367 -1191 C 361 -1196 353 -1196 347 -1191 C 253 -1123 198 -1014 198 -899 C 198 -847 199 -795 205 -743 C 213 -678 231 -615 250 -553 C 133 -418 2 -289 2 -112 C 2 90 147 262 335 262 Z M 428 -916 C 428 -790 362 -689 282 -592 C 264 -653 246 -712 246 -786 C 246 -896 309 -997 408 -1045 C 424 -995 428 -971 428 -916 Z",
    naturalWidth: 643,
    naturalHeight: 1829.75,
    viewBoxMinX: 2,
    viewBoxMinY: -1194.75,
    lineFromTop: 1194.75,
  },
  bass: {
    displayName: "Bass",
    glyph: "clefs.F",
    pc: 5,
    svgPath: "M 557 125 C 557 153 580 176 608 176 C 636 176 659 153 659 125 C 659 97 636 74 608 74 C 580 74 557 97 557 125 Z M 557 -125 C 557 -97 580 -74 608 -74 C 636 -74 659 -97 659 -125 C 659 -153 636 -176 608 -176 C 580 -176 557 -153 557 -125 Z M 232 -263 C 102 -263 0 -152 0 -19 C 0 40 52 87 112 87 C 168 87 212 39 212 -19 C 212 -74 167 -119 112 -119 C 100 -119 89 -116 78 -111 C 103 -183 158 -237 232 -237 C 340 -237 403 -122 403 -2 C 403 226 193 373 -9 491 C -12 494 -13 497 -13 500 C -13 507 -7 513 0 513 C 3 513 6 512 9 509 C 262 402 525 251 525 -12 C 525 -175 404 -263 232 -263 Z",
    naturalWidth: 672,
    naturalHeight: 776,
    viewBoxMinX: -13,
    viewBoxMinY: -263,
    lineFromTop: 263,
  },
  alto: {
    displayName: "Alto",
    glyph: "clefs.C",
    pc: 0,
    svgPath: "M 318 0 C 318 -33 325 -73 363 -73 C 392 -73 420 -42 451 -42 C 574 -42 680 -131 680 -250 C 680 -419 587 -500 415 -500 C 332 -500 263 -439 263 -358 C 263 -316 297 -281 339 -281 C 381 -281 415 -316 415 -358 C 415 -397 366 -395 366 -434 C 366 -457 390 -472 415 -472 C 531 -472 555 -382 555 -250 C 555 -144 543 -70 451 -70 C 379 -70 332 -141 332 -219 C 332 -228 325 -233 318 -233 C 311 -233 305 -228 305 -219 C 305 -143 274 -72 221 -19 L 221 -490 C 221 -496 217 -500 211 -500 L 190 -500 C 184 -500 180 -496 180 -490 L 180 490 C 180 496 184 500 190 500 L 211 500 C 217 500 221 496 221 490 L 221 19 C 274 72 305 143 305 219 C 305 228 311 233 318 233 C 325 233 332 228 332 219 C 332 141 379 70 451 70 C 543 70 555 144 555 250 C 555 382 531 472 415 472 C 390 472 366 457 366 434 C 366 395 415 397 415 358 C 415 316 381 281 339 281 C 297 281 263 316 263 358 C 263 439 332 500 415 500 C 587 500 680 419 680 250 C 680 131 574 42 451 42 C 420 42 392 73 363 73 C 325 73 318 33 318 0 Z M 129 500 C 135 500 139 496 139 490 L 139 -490 C 139 -496 135 -500 129 -500 L 10 -500 C 4 -500 0 -496 0 -490 L 0 490 C 0 496 4 500 10 500 Z",
    naturalWidth: 680,
    naturalHeight: 1000,
    viewBoxMinX: 0,
    viewBoxMinY: -500,
    lineFromTop: 500,
  },
};

/** The clefs offered, in the panel's order, with their names. */
const CHOICES = [
  { name: "dozenal", displayName: "Dozenal" },
  { name: "treble", displayName: STANDARD.treble.displayName },
  { name: "bass", displayName: STANDARD.bass.displayName },
  { name: "alto", displayName: STANDARD.alto.displayName },
];

/** Rounded to 4 places, the precision the panel's fields show. */
function round4(v) {
  return Math.round(v * 1e4) / 1e4;
}

/**
 * The semitone of pitch class pc nearest the staff's middle (the higher of
 * two equally near).
 *
 * @param {object} config
 * @param {number} pc  0–11
 * @returns {number}
 */
function markedSemi(config, pc) {
  const mid = config.staff?.midpoint ?? 12;
  return pc + 12 * Math.round((mid - pc) / 12);
}

export const CNBBuiltinClefs = {

  /** The clefs offered: [{ name, displayName }], in the panel's order. */
  CHOICES,

  /**
   * The clef definition for this config's staff, or null for a name that
   * is not offered. The dozenal clef has no size or place of its own; a
   * standard clef's line is on its pitch in the octave nearest the middle
   * of the staff, at LilyPond's size in staff spaces.
   *
   * @param {object} config
   * @param {string} name  "dozenal" | "treble" | "bass" | "alto"
   * @returns {object|null}  a config.clef.glyphs entry
   */
  definition(config, name) {
    if (name === "dozenal") return { kind: "dozenal", displayName: "Dozenal" };
    const glyph = STANDARD[name];
    if (!glyph) return null;
    const units = CNBClef.staffSpacePx(config, 1) / UNITS_PER_STAFF_SPACE;
    return {
      displayName: glyph.displayName,
      kind: "glyph",
      svgPath: glyph.svgPath,
      naturalHeight: glyph.naturalHeight,
      naturalWidth: glyph.naturalWidth,
      semitoneHeight: round4(glyph.naturalHeight * units),
      viewBoxMinX: glyph.viewBoxMinX,
      viewBoxMinY: glyph.viewBoxMinY,
      lilypondPath: null,
      anchorSemi: round4(markedSemi(config, glyph.pc) + glyph.lineFromTop * units),
    };
  },
};
