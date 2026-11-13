/**
 * cnb-accidental-glyphs-tests.js — Unit tests for the traditional key
 * signature's sharp and flat (session 51)
 *
 * The optical size LilyPond picks for a magnification, and each sign's
 * outline and box. The boxes were read from LilyPond 2.24; the engine round
 * trips in cnb-lilypond-tests.js hold the engraved signs to them.
 */

import { CNBAccidentalGlyphs as G } from "../src/cnb-accidental-glyphs.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

/** The outline's numbers, as [x, y] pairs in font units. */
function points(path) {
  const n = path.match(/-?\d+(\.\d+)?/g).map(Number);
  const out = [];
  for (let i = 0; i < n.length; i += 2) out.push([n[i], n[i + 1]]);
  return out;
}

export const tests = [
  { name: "designSize: the optical size nearest 20 pt × the magnification, as LilyPond picks it", fn: () => {
      // Measured in LilyPond 2.24 under \magnifyStaff (session 51).
      for (const [m, size] of [[0.5, 11], [0.55, 11], [0.65, 13], [2 / 3, 13], [0.7, 14], [0.8, 16], [0.9, 18],
                               [1, 20], [1.15, 23], [7 / 6, 23], [1.3, 26], [1.5, 26], [7 / 4, 26], [2, 26], [2.5, 26]]) {
        eq(G.designSize(m), size, `magnify ${m}`);
      }
      eq(G.designSize(NaN), 20, "no magnification: 1");
      eq(G.designSize(0), 20, "a magnification of 0: 1");
    }},

  { name: "glyph: each size's sharp and flat, their boxes in staff spaces as LilyPond measures them", fn: () => {
      for (const m of [0.5, 0.65, 0.7, 0.8, 0.9, 1, 1.15, 7 / 4]) {
        const sharp = G.glyph("sharp", m);
        const flat = G.glyph("flat", m);
        eq(JSON.stringify(sharp.x), "[0,1.1]", `magnify ${m}: a sharp 1.1 staff spaces wide`);
        eq(JSON.stringify(sharp.y), "[-1.5,1.5]", `magnify ${m}: 3 tall about its centre line`);
        eq(flat.x[1], 0.8, `magnify ${m}: a flat's right edge`);
        assert(flat.x[0] < -0.1 && flat.x[0] > -0.19, `magnify ${m}: a flat's left edge ${flat.x[0]}`);
        assert(flat.y[0] < 0 && flat.y[1] > 1.7, `magnify ${m}: a flat stands above its bowl line`);
        for (const [sign, g] of [["sharp", sharp], ["flat", flat]]) {
          assert(/^M [-\d. LCZM]+Z$/.test(g.path), `${sign} at ${m}: absolute M/L/C/Z commands`);
          // The outline lies near its box (Y negated in the path).
          const ps = points(g.path);
          const xs = ps.map(p => p[0] / G.UNITS_PER_STAFF_SPACE);
          const ys = ps.map(p => -p[1] / G.UNITS_PER_STAFF_SPACE);
          assert(Math.abs(Math.max(...xs) - g.x[1]) < 0.05 && Math.abs(Math.max(...ys) - g.y[1]) < 0.05,
            `${sign} at ${m}: its outline within its box's reach`);
        }
      }
      eq(G.glyph("flat", 1).x[0], -0.12, "emmentaler-20's flat");
      eq(G.glyph("flat", 7 / 4).x[0], -0.1037, "emmentaler-26's flat, the engine's default magnification");
    }},

  { name: "glyph: each size's sharp bars, the top left of its upper bar to the top left of its lower bar, as its outline draws them", fn: () => {
      for (const m of [0.5, 0.65, 0.7, 0.8, 0.9, 1, 1.15, 7 / 4]) {
        const sharp = G.glyph("sharp", m);
        // The bars' left edges are at x 0: the top of each, upper (y < 0 in
        // the path) and lower.
        const left = points(sharp.path).filter(p => p[0] === 0).map(p => p[1]);
        const upper = Math.min(...left.filter(y => y < 0));
        const lower = Math.min(...left.filter(y => y > 0));
        eq(sharp.bars, (lower - upper) / G.UNITS_PER_STAFF_SPACE, `magnify ${m}: emmentaler-${G.designSize(m)}`);
        eq(G.glyph("flat", m).bars, undefined, `magnify ${m}: a flat has no bars`);
      }
      eq(G.glyph("sharp", 7 / 4).bars, 1.052, "emmentaler-26's, the engine's default magnification");
      eq(G.glyph("sharp", 1).bars, 1.052, "emmentaler-20's");
      eq(G.glyph("sharp", 0.5).bars, 1.048, "emmentaler-11's");
    }},
];
