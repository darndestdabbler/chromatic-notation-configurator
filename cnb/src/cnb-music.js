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

export const CNBMusic = {

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
