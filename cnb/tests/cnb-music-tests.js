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

  // ── parseTonicPc (set 010, tonic resolution decision D3) ─────────────────
  { name: "parseTonicPc: natural note letters, either case", fn: () => {
    eq(CNBMusic.parseTonicPc("C"), 0);
    eq(CNBMusic.parseTonicPc("D"), 2);
    eq(CNBMusic.parseTonicPc("g"), 7);
    eq(CNBMusic.parseTonicPc("A"), 9);
    eq(CNBMusic.parseTonicPc("B"), 11);
  }},
  { name: "parseTonicPc: sharps and flats, ASCII and unicode accidentals", fn: () => {
    eq(CNBMusic.parseTonicPc("F#"), 6);
    eq(CNBMusic.parseTonicPc("F♯ minor"), 6);
    eq(CNBMusic.parseTonicPc("Eb"), 3);
    eq(CNBMusic.parseTonicPc("B♭ Dorian"), 10);
    eq(CNBMusic.parseTonicPc("bb"), 10, "lowercase b tonic + flat");
    eq(CNBMusic.parseTonicPc("Cb"), 11, "flat wraps below C");
  }},
  { name: "parseTonicPc: trailing words and leading whitespace are tolerated", fn: () => {
    eq(CNBMusic.parseTonicPc("C major"), 0);
    eq(CNBMusic.parseTonicPc("  A"), 9);
  }},
  { name: "parseTonicPc: null when the name does not begin with a note letter", fn: () => {
    eq(CNBMusic.parseTonicPc("Mystery"), null);
    eq(CNBMusic.parseTonicPc(""), null);
    eq(CNBMusic.parseTonicPc(null), null);
    eq(CNBMusic.parseTonicPc(undefined), null);
  }},

  // ── ledgerOctaveRegion ────────────────────────────────────────────────────
  { name: "ledgerOctaveRegion(0) = 0",   fn: () => eq(CNBMusic.ledgerOctaveRegion(0),   0) },
  { name: "ledgerOctaveRegion(11) = 0",  fn: () => eq(CNBMusic.ledgerOctaveRegion(11),  0) },
  { name: "ledgerOctaveRegion(12) = 1",  fn: () => eq(CNBMusic.ledgerOctaveRegion(12),  1) },
  { name: "ledgerOctaveRegion(23) = 1",  fn: () => eq(CNBMusic.ledgerOctaveRegion(23),  1) },
  { name: "ledgerOctaveRegion(24) = 2",  fn: () => eq(CNBMusic.ledgerOctaveRegion(24),  2) },
  { name: "ledgerOctaveRegion(-1) = -1", fn: () => eq(CNBMusic.ledgerOctaveRegion(-1), -1) },

];
