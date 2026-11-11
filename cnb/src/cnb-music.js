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

/** The seven letters C D E F G A B and their natural pitch classes. */
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
/** A note name's accidental, by alteration −1, 0, 1. */
const ACCIDENTALS = { "-1": "♭", "0": "", "1": "♯" };

/** A note name's letter (0–6) and alteration (−1, 0, 1), or null. */
function parseNote(name) {
  const m = /^([A-G])([♯#♭b]?)$/.exec(String(name ?? ""));
  if (!m) return null;
  const alteration = m[2] === "♯" || m[2] === "#" ? 1 : m[2] === "♭" || m[2] === "b" ? -1 : 0;
  return { letter: LETTERS.indexOf(m[1]), alteration };
}

/** Every note name with at most one sharp or flat: 21 names. */
const NOTE_NAMES = LETTERS.flatMap(letter => [-1, 0, 1].map(a => letter + ACCIDENTALS[a]));

export const CNBMusic = {

  MODES,

  /**
   * A seven-note key spelled on the seven letters from its tonic's name
   * (session 48, key-signature design §3): each note, from the tonic up,
   * with its alteration, −1 flat, 0 natural, 1 sharp. Null for a key that is
   * not seven notes with the tonic among them, or that would need a double
   * sharp or flat. spell("G♭", scale(6, "major")) → G♭ A♭ B♭ C♭ D♭ E♭ F.
   * @param {string} tonicName  a letter and an optional ♯ ♭ (# b)
   * @param {number[]} pitchClasses  the key's pitch classes, in any order
   * @returns {{pc:number, alteration:number}[]|null}
   */
  spell(tonicName, pitchClasses) {
    const tonic = parseNote(tonicName);
    if (!tonic) return null;
    const tonicPc = CNBMusic.pitchClass(LETTER_PC[tonic.letter] + tonic.alteration);
    const pcs = [...new Set((pitchClasses || []).map(pc => CNBMusic.pitchClass(pc)))]
      .sort((a, b) => CNBMusic.pitchClass(a - tonicPc) - CNBMusic.pitchClass(b - tonicPc));
    if (pcs.length !== 7 || pcs[0] !== tonicPc) return null;
    const notes = pcs.map((pc, i) => ({
      pc,
      alteration: CNBMusic.pitchClass(pc - LETTER_PC[(tonic.letter + i) % 7] + 6) - 6,
    }));
    return notes.every(n => Math.abs(n.alteration) <= 1) ? notes : null;
  },

  /**
   * The tonic names a mode's keys take with at most seven sharps or flats
   * (session 48, key-signature design §3): 15 for each mode, in pitch-class
   * order, a sharp before its enharmonic flat. In major: C C♯ D♭ D E♭ E F F♯
   * G♭ G A♭ A B♭ B C♭.
   * @param {string} mode  a MODES name
   * @returns {string[]}
   */
  spellings(mode) {
    return NOTE_NAMES
      .map(name => ({ name, note: parseNote(name) }))
      .map(n => ({ ...n, pc: CNBMusic.pitchClass(LETTER_PC[n.note.letter] + n.note.alteration) }))
      .filter(n => CNBMusic.spell(n.name, CNBMusic.scale(n.pc, mode)) !== null)
      .sort((a, b) => a.pc - b.pc || b.note.alteration - a.note.alteration)
      .map(n => n.name);
  },

  /**
   * The tonic's name for a key given no spelling (session 48): of the names
   * of tonicPc that spell the key, the one with the fewest sharps and flats,
   * a tie to the sharp (F♯ major, D♭ major). A key that no name spells (not
   * seven notes) takes the natural name, else the sharp.
   * @param {number} tonicPc  0–11
   * @param {number[]} pitchClasses
   * @returns {string}
   */
  defaultSpelling(tonicPc, pitchClasses) {
    const names = NOTE_NAMES
      .map(name => ({ name, note: parseNote(name) }))
      .filter(n => CNBMusic.pitchClass(LETTER_PC[n.note.letter] + n.note.alteration) === tonicPc);
    const count = name => CNBMusic.spell(name, pitchClasses).filter(n => n.alteration !== 0).length;
    const spelled = names.filter(n => CNBMusic.spell(n.name, pitchClasses) !== null)
      .sort((a, b) => count(a.name) - count(b.name) || b.note.alteration - a.note.alteration);
    if (spelled.length > 0) return spelled[0].name;
    return (names.find(n => n.note.alteration === 0) || names.find(n => n.note.alteration === 1)).name;
  },

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
