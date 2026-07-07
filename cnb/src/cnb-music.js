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
   * Parse the tonic pitch class from a key name (set 010, decision D3).
   * Reads a leading note letter A–G (either case) plus an optional
   * accidental (# ♯ b ♭) immediately after it, ignoring leading whitespace:
   * "C" → 0, "F# minor" → 6, "bb" → 10, "B♭ Dorian" → 10.
   * Returns null when the name does not begin with a note letter.
   * @param {string} name
   * @returns {number|null}
   */
  parseTonicPc(name) {
    const m = /^\s*([A-Ga-g])([#♯b♭]?)/.exec(String(name ?? ""));
    if (!m) return null;
    const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
    const alt = m[2] === "#" || m[2] === "♯" ? 1 : (m[2] === "b" || m[2] === "♭" ? -1 : 0);
    return (((base + alt) % 12) + 12) % 12;
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
