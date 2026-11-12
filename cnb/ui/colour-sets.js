/**
 * colour-sets.js — suggested colour sets (session 37)
 *
 * A notehead's colour lives on the notehead (its rules); a config has no
 * palette. These are the curated sets the palette editor (Module 12,
 * retired in session 37) offered, kept as suggestions a designer can apply
 * from the notehead panel's Suggested colours help. Applying one colours
 * the twelve noteheads by cycling the set, as the palette editor did: pitch
 * class p takes colors[p % N]. Black is none.
 *
 * The sets, moved unchanged: "Dark2" names the ColorBrewer palette the
 * standard colours come from (sizes 2–7; the 11-colour set extends it with
 * four hues chosen for this project). The colour-blind-safe sets for sizes
 * 2–7 follow Paul Tol's schemes; the 11-colour one is this project's own.
 *
 * Session 42 adds two sets the operator asked for, each led by black:
 * black, rose and sky blue; and black, deep pink, shamrock and sky blue.
 *
 * A colour-blind version of a notation is a second config: the same one
 * saved under another name with other colours.
 *
 * Dependencies: none.
 */

const DARK2 = [
  { name: "Teal",    hex: "#1b9e77" },
  { name: "Orange",  hex: "#d95f02" },
  { name: "Lilac",   hex: "#7570b3" },
  { name: "Pink",    hex: "#e7298a" },
  { name: "Green",   hex: "#66a61e" },
  { name: "Gold",    hex: "#e6ab02" },
  { name: "Brown",   hex: "#a6761d" },
];

const DARK2_11 = [
  ...DARK2,
  { name: "Slate",   hex: "#666666" },
  { name: "Cobalt",  hex: "#1f4e79" },
  { name: "Crimson", hex: "#b2182b" },
  { name: "Plum",    hex: "#6a3d9a" },
];

const COLOUR_BLIND_SAFE = {
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

/** The operator's sets (session 42), each led by black. */
const WITH_BLACK = [
  { key: "black-3", colors: [
    { name: "Black",     hex: "#000000" },
    { name: "Rose",      hex: "#CC79A7" },
    { name: "Sky blue",  hex: "#56B3E9" },
  ] },
  { key: "black-4", colors: [
    { name: "Black",     hex: "#000000" },
    { name: "Deep pink", hex: "#E23084" },
    { name: "Shamrock",  hex: "#2B9E7B" },
    { name: "Sky blue",  hex: "#56B3E9" },
  ] },
];

const SIZES = [2, 3, 4, 6, 7, 11];

/** The sets, Dark2 first, then the colour-blind-safe ones, then those led
 *  by black, each { key, label, colourBlindSafe, colors }. */
const SETS = [
  ...SIZES.map(n => ({
    key: `dark2-${n}`, label: `Dark2 · ${n} colours`, colourBlindSafe: false,
    colors: n === 11 ? DARK2_11 : DARK2.slice(0, n),
  })),
  ...SIZES.map(n => ({
    key: `cbsafe-${n}`, label: `Colour-blind safe · ${n} colours`, colourBlindSafe: true,
    colors: COLOUR_BLIND_SAFE[n],
  })),
  ...WITH_BLACK.map(({ key, colors }) => ({
    key, label: colors.map(c => c.name).join(", "), colourBlindSafe: false, colors,
  })),
];

export const CNBColourSets = {

  SETS,

  /**
   * A look table with a set's colours: pitch class p takes the set's
   * colour p % N, lower case, and black is none (null). An unknown key
   * returns the table as it is. The input is not changed.
   * @param {object[]} table  look-table rows (notehead-inference.js)
   * @param {string} key
   * @returns {object[]}
   */
  apply(table, key) {
    const set = SETS.find(s => s.key === key);
    if (!set) return table;
    return table.map(row => {
      const hex = set.colors[row.pc % set.colors.length].hex.toLowerCase();
      return { ...row, color: hex === "#000000" ? null : hex };
    });
  },
};
