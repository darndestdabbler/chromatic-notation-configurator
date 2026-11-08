/**
 * cnb-music.js — Module B: Music Theory Utilities
 *
 * Pure functions for pitch class arithmetic, note naming, and octave math.
 * No dependencies. No side effects. No DOM access.
 *
 * Part of the Chromatic Notation Builder modular architecture.
 */

const PC_LABELS = [
  { text: "C",  sharp: false },
  { text: "C",  sharp: true  },
  { text: "D",  sharp: false },
  { text: "D",  sharp: true  },
  { text: "E",  sharp: false },
  { text: "F",  sharp: false },
  { text: "F",  sharp: true  },
  { text: "G",  sharp: false },
  { text: "G",  sharp: true  },
  { text: "A",  sharp: false },
  { text: "A",  sharp: true  },
  { text: "B",  sharp: false },
];

/**
 * The seven modes LilyPond's \key names (\major, \minor, \dorian, …), as
 * semitones above the tonic, ascending (session 36). LilyPond also accepts
 * \ionian and eolian, which are \major and \minor.
 */
const MODES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian:    [0, 1, 3, 5, 6, 8, 10],
};

export const CNBMusic = {

  MODES,

  /**
   * The pitch classes of a key: its mode's degrees from the tonic,
   * ascending from the tonic. scale(7, "major") = [7, 9, 11, 0, 2, 4, 6].
   * Throws on a tonic outside 0–11 or a mode not in MODES.
   * @param {number} tonicPc  0–11
   * @param {string} mode     a MODES name
   * @returns {number[]}
   */
  scale(tonicPc, mode) {
    if (!Number.isInteger(tonicPc) || tonicPc < 0 || tonicPc > 11) {
      throw new Error(`scale: tonic must be a pitch class 0–11 (got ${JSON.stringify(tonicPc)})`);
    }
    if (!Object.hasOwn(MODES, mode)) {
      throw new Error(`scale: unknown mode ${JSON.stringify(mode)} (one of ${Object.keys(MODES).join(", ")})`);
    }
    return MODES[mode].map(step => (tonicPc + step) % 12);
  },

  /**
   * Pitch class from absolute semitone. Always returns 0–11.
   * Handles negative semitones correctly: pitchClass(-1) = 11.
   * @param {number} semi
   * @returns {number}
   */
  pitchClass(semi) {
    return ((semi % 12) + 12) % 12;
  },

  /**
   * Octave number from absolute semitone.
   * octave(0) = 0, octave(12) = 1, octave(-1) = -1.
   * @param {number} semi
   * @returns {number}
   */
  octave(semi) {
    return Math.floor(semi / 12);
  },

  /**
   * Absolute semitone from pitch class + octave.
   * absoluteSemi(0, 1) = 12.
   * @param {number} pc  0–11
   * @param {number} oct
   * @returns {number}
   */
  absoluteSemi(pc, oct) {
    return pc + oct * 12;
  },

  /**
   * Label object for a pitch class.
   * pcLabel(0) = { text: "C", sharp: false }
   * pcLabel(1) = { text: "C", sharp: true }
   * @param {number} pc  0–11
   * @returns {{ text: string, sharp: boolean }}
   */
  pcLabel(pc) {
    return { ...PC_LABELS[pc] };
  },

  /**
   * All 13 labels for a full chromatic row (C through C').
   * Index 0 = lower C, index 12 = upper C.
   * @returns {Array<{ text: string, sharp: boolean }>}
   */
  chromaticLabels() {
    const labels = PC_LABELS.map(l => ({ ...l }));
    labels.push({ text: "C", sharp: false });
    return labels;
  },

  /**
   * Which octave region a semitone belongs to for ledger line purposes.
   * Currently identical to octave(), but kept as a separate function because
   * the ledger algorithm may need a different definition in some staff configs.
   * ledgerOctaveRegion(0) = 0, ledgerOctaveRegion(12) = 1.
   * @param {number} semi
   * @returns {number}
   */
  ledgerOctaveRegion(semi) {
    return Math.floor(semi / 12);
  },

};
