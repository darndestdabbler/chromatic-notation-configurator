/**
 * cnb-music-tests.js — Unit tests for Module B (Music Theory Utilities)
 */

import { CNBMusic } from "../src/cnb-music.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function deepEq(a, b, msg) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${msg || "deepEq"}: expected ${y}, got ${x}`);
}

export const tests = [
  // ── modes and scales (session 36) ──
  { name: "MODES: the seven modes LilyPond's \key names, seven degrees each from 0", fn: () => {
    deepEq(Object.keys(CNBMusic.MODES), ["major", "minor", "dorian", "phrygian", "lydian", "mixolydian", "locrian"], "names");
    for (const [name, steps] of Object.entries(CNBMusic.MODES)) {
      eq(steps.length, 7, name + " has seven degrees");
      eq(steps[0], 0, name + " starts on the tonic");
    }
  }},
  { name: "scale: degrees ascending from the tonic; the relative keys share pitch classes", fn: () => {
    deepEq(CNBMusic.scale(0, "major"), [0, 2, 4, 5, 7, 9, 11], "C major");
    deepEq(CNBMusic.scale(7, "major"), [7, 9, 11, 0, 2, 4, 6], "G major");
    deepEq(CNBMusic.scale(9, "minor"), [9, 11, 0, 2, 4, 5, 7], "A minor");
    deepEq(CNBMusic.scale(2, "dorian"), [2, 4, 5, 7, 9, 11, 0], "D dorian");
    const sorted = (a) => a.slice().sort((x, y) => x - y);
    deepEq(sorted(CNBMusic.scale(9, "minor")), sorted(CNBMusic.scale(0, "major")), "A minor = C major's set");
    deepEq(sorted(CNBMusic.scale(5, "lydian")), sorted(CNBMusic.scale(0, "major")), "F lydian = C major's set");
    deepEq(sorted(CNBMusic.scale(11, "locrian")), sorted(CNBMusic.scale(0, "major")), "B locrian = C major's set");
  }},
  { name: "scale: throws on a bad tonic or an unknown mode", fn: () => {
    for (const bad of [-1, 12, 1.5, "C", null]) {
      let threw = false;
      try { CNBMusic.scale(bad, "major"); } catch { threw = true; }
      assert(threw, "tonic " + JSON.stringify(bad));
    }
    let threw = false;
    try { CNBMusic.scale(0, "ionian-ish"); } catch (e) { threw = /unknown mode/.test(e.message); }
    assert(threw, "unknown mode");
  }},

  // ── key spelling (session 48, key-signature design §3) ──
  { name: "spell: a key spelled on the seven letters from its tonic, F♯ and G♭ major told apart", fn: () => {
    const alts = (name, pcs) => CNBMusic.spell(name, pcs).map(n => n.alteration);
    deepEq(alts("C", CNBMusic.scale(0, "major")), [0, 0, 0, 0, 0, 0, 0], "C major");
    deepEq(alts("F♯", CNBMusic.scale(6, "major")), [1, 1, 1, 0, 1, 1, 1], "F♯ major: F♯ G♯ A♯ B C♯ D♯ E♯");
    deepEq(alts("G♭", CNBMusic.scale(6, "major")), [-1, -1, -1, -1, -1, -1, 0], "G♭ major: G♭ A♭ B♭ C♭ D♭ E♭ F");
    deepEq(alts("B♭", CNBMusic.scale(10, "major")), [-1, 0, 0, -1, 0, 0, 0], "B♭ major");
    deepEq(CNBMusic.spell("A", CNBMusic.scale(9, "minor")).map(n => n.pc), [9, 11, 0, 2, 4, 5, 7], "from the tonic up");
    deepEq(alts("Bb", [10, 0, 2, 3, 5, 7, 9]), [-1, 0, 0, -1, 0, 0, 0], "ASCII flat, any order");
  }},
  { name: "spell: null for a key that is not seven notes, lacks its tonic, or would need a double sharp or flat", fn: () => {
    eq(CNBMusic.spell("C", [0, 2, 4, 7, 9]), null, "pentatonic");
    eq(CNBMusic.spell("C♯", CNBMusic.scale(0, "major")), null, "the tonic is not in the key");
    eq(CNBMusic.spell("B♯", CNBMusic.scale(0, "major")), null, "B♯ with C major's notes needs C𝄪");
    eq(CNBMusic.spell("H", CNBMusic.scale(0, "major")), null, "not a note name");
  }},
  { name: "spellings: each mode's 15 tonics with at most seven sharps or flats, in pitch-class order", fn: () => {
    deepEq(CNBMusic.spellings("major"),
      ["C", "C♯", "D♭", "D", "E♭", "E", "F", "F♯", "G♭", "G", "A♭", "A", "B♭", "B", "C♭"], "major");
    deepEq(CNBMusic.spellings("minor"),
      ["C", "C♯", "D", "D♯", "E♭", "E", "F", "F♯", "G", "G♯", "A♭", "A", "A♯", "B♭", "B"], "minor");
    const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const pcOf = name => (LETTER_PC[name[0]] + (name[1] === "♯" ? 1 : name[1] === "♭" ? -1 : 0) + 12) % 12;
    for (const mode of Object.keys(CNBMusic.MODES)) {
      const names = CNBMusic.spellings(mode);
      eq(names.length, 15, mode + " has 15");
      eq(new Set(names.map(pcOf)).size, 12, mode + " covers every pitch class");
      for (const name of names) {
        const notes = CNBMusic.spell(name, CNBMusic.scale(pcOf(name), mode));
        assert(notes !== null, `${name} ${mode} is spelled`);
        const sharps = notes.filter(n => n.alteration === 1).length;
        const flats = notes.filter(n => n.alteration === -1).length;
        assert(sharps === 0 || flats === 0, `${name} ${mode} has sharps or flats, not both`);
      }
    }
  }},
  { name: "defaultSpelling: the fewest sharps and flats, a tie to the sharp; a key no name spells takes the natural, else the sharp", fn: () => {
    eq(CNBMusic.defaultSpelling(1, CNBMusic.scale(1, "major")), "D♭", "D♭ major (5♭) over C♯ (7♯)");
    eq(CNBMusic.defaultSpelling(6, CNBMusic.scale(6, "major")), "F♯", "F♯ and G♭ major tie: the sharp");
    eq(CNBMusic.defaultSpelling(11, CNBMusic.scale(11, "major")), "B", "B major (5♯) over C♭ (7♭)");
    eq(CNBMusic.defaultSpelling(8, CNBMusic.scale(8, "minor")), "G♯", "G♯ minor (5♯) over A♭ (7♭)");
    eq(CNBMusic.defaultSpelling(0, [0, 2, 4, 7, 9]), "C", "a pentatonic key: the natural name");
    eq(CNBMusic.defaultSpelling(3, [3, 5]), "D♯", "no natural name: the sharp");
  }},

  // ── pitchClass ────────────────────────────────────────────────────────────
  { name: "pitchClass(0) = 0",   fn: () => eq(CNBMusic.pitchClass(0),   0) },
  { name: "pitchClass(11) = 11", fn: () => eq(CNBMusic.pitchClass(11), 11) },
  { name: "pitchClass(12) = 0",  fn: () => eq(CNBMusic.pitchClass(12),  0) },
  { name: "pitchClass(13) = 1",  fn: () => eq(CNBMusic.pitchClass(13),  1) },
  { name: "pitchClass(23) = 11", fn: () => eq(CNBMusic.pitchClass(23), 11) },
  { name: "pitchClass(24) = 0",  fn: () => eq(CNBMusic.pitchClass(24),  0) },
  { name: "pitchClass(-1) = 11", fn: () => eq(CNBMusic.pitchClass(-1), 11) },
  { name: "pitchClass(-12) = 0", fn: () => eq(CNBMusic.pitchClass(-12), 0) },
  { name: "pitchClass(-13) = 11",fn: () => eq(CNBMusic.pitchClass(-13),11) },

  // ── octave ────────────────────────────────────────────────────────────────
  { name: "octave(0) = 0",   fn: () => eq(CNBMusic.octave(0),   0) },
  { name: "octave(11) = 0",  fn: () => eq(CNBMusic.octave(11),  0) },
  { name: "octave(12) = 1",  fn: () => eq(CNBMusic.octave(12),  1) },
  { name: "octave(23) = 1",  fn: () => eq(CNBMusic.octave(23),  1) },
  { name: "octave(24) = 2",  fn: () => eq(CNBMusic.octave(24),  2) },
  { name: "octave(-1) = -1", fn: () => eq(CNBMusic.octave(-1), -1) },
  { name: "octave(-12) = -1",fn: () => eq(CNBMusic.octave(-12),-1) },
  { name: "octave(-13) = -2",fn: () => eq(CNBMusic.octave(-13),-2) },

  // ── absoluteSemi ──────────────────────────────────────────────────────────
  { name: "absoluteSemi(0, 0) = 0",  fn: () => eq(CNBMusic.absoluteSemi(0, 0),  0) },
  { name: "absoluteSemi(0, 1) = 12", fn: () => eq(CNBMusic.absoluteSemi(0, 1), 12) },
  { name: "absoluteSemi(11, 0) = 11",fn: () => eq(CNBMusic.absoluteSemi(11, 0),11) },
  { name: "absoluteSemi(0, 2) = 24", fn: () => eq(CNBMusic.absoluteSemi(0, 2), 24) },
  { name: "absoluteSemi(5, 1) = 17", fn: () => eq(CNBMusic.absoluteSemi(5, 1), 17) },

  // ── pcLabel ───────────────────────────────────────────────────────────────
  { name: "pcLabel(0)  = C natural",  fn: () => { deepEq(CNBMusic.pcLabel(0),  { text: "C", sharp: false }); } },
  { name: "pcLabel(1)  = C sharp",    fn: () => { deepEq(CNBMusic.pcLabel(1),  { text: "C", sharp: true  }); } },
  { name: "pcLabel(2)  = D natural",  fn: () => { deepEq(CNBMusic.pcLabel(2),  { text: "D", sharp: false }); } },
  { name: "pcLabel(3)  = D sharp",    fn: () => { deepEq(CNBMusic.pcLabel(3),  { text: "D", sharp: true  }); } },
  { name: "pcLabel(4)  = E natural",  fn: () => { deepEq(CNBMusic.pcLabel(4),  { text: "E", sharp: false }); } },
  { name: "pcLabel(5)  = F natural",  fn: () => { deepEq(CNBMusic.pcLabel(5),  { text: "F", sharp: false }); } },
  { name: "pcLabel(6)  = F sharp",    fn: () => { deepEq(CNBMusic.pcLabel(6),  { text: "F", sharp: true  }); } },
  { name: "pcLabel(7)  = G natural",  fn: () => { deepEq(CNBMusic.pcLabel(7),  { text: "G", sharp: false }); } },
  { name: "pcLabel(8)  = G sharp",    fn: () => { deepEq(CNBMusic.pcLabel(8),  { text: "G", sharp: true  }); } },
  { name: "pcLabel(9)  = A natural",  fn: () => { deepEq(CNBMusic.pcLabel(9),  { text: "A", sharp: false }); } },
  { name: "pcLabel(10) = A sharp",    fn: () => { deepEq(CNBMusic.pcLabel(10), { text: "A", sharp: true  }); } },
  { name: "pcLabel(11) = B natural",  fn: () => { deepEq(CNBMusic.pcLabel(11), { text: "B", sharp: false }); } },
  { name: "pcLabel returns a copy (no aliasing)", fn: () => {
    const a = CNBMusic.pcLabel(0);
    const b = CNBMusic.pcLabel(0);
    a.text = "mutated";
    eq(b.text, "C", "mutation of one label should not affect another");
  }},

  // ── chromaticLabels ───────────────────────────────────────────────────────
  { name: "chromaticLabels() has 13 entries", fn: () => {
    eq(CNBMusic.chromaticLabels().length, 13);
  }},
  { name: "chromaticLabels()[0] = C natural", fn: () => {
    deepEq(CNBMusic.chromaticLabels()[0], { text: "C", sharp: false });
  }},
  { name: "chromaticLabels()[1] = C sharp", fn: () => {
    deepEq(CNBMusic.chromaticLabels()[1], { text: "C", sharp: true });
  }},
  { name: "chromaticLabels()[12] = C natural (upper C)", fn: () => {
    deepEq(CNBMusic.chromaticLabels()[12], { text: "C", sharp: false });
  }},
  { name: "chromaticLabels()[11] = B natural", fn: () => {
    deepEq(CNBMusic.chromaticLabels()[11], { text: "B", sharp: false });
  }},

  // ── ledgerOctaveRegion ────────────────────────────────────────────────────
  { name: "ledgerOctaveRegion(0) = 0",   fn: () => eq(CNBMusic.ledgerOctaveRegion(0),   0) },
  { name: "ledgerOctaveRegion(11) = 0",  fn: () => eq(CNBMusic.ledgerOctaveRegion(11),  0) },
  { name: "ledgerOctaveRegion(12) = 1",  fn: () => eq(CNBMusic.ledgerOctaveRegion(12),  1) },
  { name: "ledgerOctaveRegion(23) = 1",  fn: () => eq(CNBMusic.ledgerOctaveRegion(23),  1) },
  { name: "ledgerOctaveRegion(24) = 2",  fn: () => eq(CNBMusic.ledgerOctaveRegion(24),  2) },
  { name: "ledgerOctaveRegion(-1) = -1", fn: () => eq(CNBMusic.ledgerOctaveRegion(-1), -1) },

];
