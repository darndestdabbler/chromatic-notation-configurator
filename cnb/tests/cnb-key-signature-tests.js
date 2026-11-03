/**
 * cnb-key-signature-tests.js — Unit tests for the set-010 key-signature
 * feature
 *
 * Covers: default-off compatibility (byte-identical LilyPond export against
 * the pre-change baseline fixture, and keysig-enabled export identical to
 * keysig-disabled — the s1 engine-coordination outcome), the tonic
 * resolution chain (D3), auto/explicit vertical anchoring (D4), the
 * notehead-chords layout (the operator-directed default mirroring the
 * engine's keysig.ly: scale + octave tonic interleaved into two columns =
 * two stacked 7th chords, ledgers beneath, gold separator bar), the dot
 * style, resolution parity with CNBCard, and the collection's keysig
 * gutter column composing after the clef.
 *
 * The keySignature SECTION tests (schema defaults, merge, validation) live
 * in cnb-config-tests.js — they are Module A behavior (spec step 2
 * "config-test additions"); parseTonicPc tests live in cnb-music-tests.js
 * (Module B behavior).
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBKeySignature } from "../src/cnb-key-signature.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBCard } from "../src/cnb-card.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { withSvgStub, withDomStub } from "./svg-stub.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(__dirname, "..", "fixtures", "default-export-baseline.ly");

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

function approx(a, b, msg, tol = 1e-6) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
}

/** Normalize an export for comparison: date line + line endings. */
function normalizeLy(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
}

/** Parse "translate(x,y)" into numbers. */
function parseTranslate(transform) {
  const m = /translate\(([-\d.eE+]+),([-\d.eE+]+)\)/.exec(transform || "");
  assert(m, `transform "${transform}" has no translate()`);
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

const C_MAJOR = { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] };
const A_MAJOR = { name: "A", pitchClasses: [9, 11, 1, 2, 4, 6, 8] };

/** Default config with keys + key signature enabled and the given defs. */
function keysigConfig(definitions = [C_MAJOR], ksOverrides = {}) {
  const config = CNBConfig.createDefault();
  config.keys.enabled = true;
  config.keys.definitions = CNBConfig.clone(definitions);
  config.keys.keySignature = {
    ...config.keys.keySignature,
    enabled: true,
    ...ksOverrides,
  };
  return config;
}

// Default-shape geometry at pxPerSemi 16 (crotchet-minim:
// semitoneHeight 2.724, naturalHeight 272.4, naturalWidth 344.852).
const PX_PER_SEMI = 16;
const MARK_W = (2.724 * PX_PER_SEMI / 272.4) * 344.852; // ≈ 55.17632
// 160% of a semitone = the engine bar's 0.4 staff-space at the default
// staff's 4 semitones per space (s2 UAT engine-render measurement).
const SEPARATOR_PX = (160 / 100) * PX_PER_SEMI;         // 25.6
const GRID_RANGE = { minSemi: -4, maxSemi: 28 };
const semiToYExpected = semi => (28 - semi) * PX_PER_SEMI;

export const tests = [

  // ── Default-off compatibility (spec binding rule 1 / step 3) ───────────

  { name: "export invariance: default config export matches the pre-change baseline byte-for-byte", fn: () => {
      const baseline = normalizeLy(fs.readFileSync(BASELINE_PATH, "utf8"));
      const current = normalizeLy(CNBLilypond.generate(CNBConfig.createDefault()));
      eq(current, baseline, "default export unchanged by the keySignature schema");
    }},

  { name: "export invariance: keysig-enabled config exports identically to keysig-disabled", fn: () => {
      const enabled = keysigConfig();
      const disabled = CNBConfig.clone(enabled);
      disabled.keys.keySignature.enabled = false;
      eq(normalizeLy(CNBLilypond.generate(enabled)),
         normalizeLy(CNBLilypond.generate(disabled)),
         "exporter is blind to the keySignature section (engine renders keysigs from the score's \\key — s1 coordination)");
    }},

  // ── activeKey gating (decision D5) ─────────────────────────────────────

  { name: "activeKey: null unless keys.enabled AND keySignature.enabled AND the key resolves", fn: () => {
      eq(CNBKeySignature.activeKey(CNBConfig.createDefault(), "C"), null, "default config");
      const keysOnly = keysigConfig();
      keysOnly.keys.keySignature.enabled = false;
      eq(CNBKeySignature.activeKey(keysOnly, "C"), null, "signature disabled");
      const ksOnly = keysigConfig();
      ksOnly.keys.enabled = false;
      eq(CNBKeySignature.activeKey(ksOnly, "C"), null, "keys disabled (E2 gate)");
      eq(CNBKeySignature.activeKey(keysigConfig(), null), null, "no key selected");
      eq(CNBKeySignature.activeKey(keysigConfig(), "G"), null, "unknown key name");
      const noPcs = keysigConfig([{ name: "C", pitchClasses: [] }]);
      eq(CNBKeySignature.activeKey(noPcs, "C"), null, "definition without usable pitch classes");
      const ok = CNBKeySignature.activeKey(keysigConfig(), "C");
      eq(ok.name, "C", "resolved name");
      deepEq(ok.def.pitchClasses, C_MAJOR.pitchClasses, "resolved definition");
    }},

  // ── Tonic resolution chain (decision D3) ───────────────────────────────

  { name: "parseTonicPc: natural note letters, either case", fn: () => {
      eq(CNBKeySignature.parseTonicPc("C"), 0);
      eq(CNBKeySignature.parseTonicPc("D"), 2);
      eq(CNBKeySignature.parseTonicPc("g"), 7);
      eq(CNBKeySignature.parseTonicPc("A"), 9);
      eq(CNBKeySignature.parseTonicPc("B"), 11);
    }},

  { name: "parseTonicPc: sharps and flats, ASCII and unicode accidentals", fn: () => {
      eq(CNBKeySignature.parseTonicPc("F#"), 6);
      eq(CNBKeySignature.parseTonicPc("F♯ minor"), 6);
      eq(CNBKeySignature.parseTonicPc("Eb"), 3);
      eq(CNBKeySignature.parseTonicPc("B♭ Dorian"), 10);
      eq(CNBKeySignature.parseTonicPc("bb"), 10, "lowercase b tonic + flat");
      eq(CNBKeySignature.parseTonicPc("Cb"), 11, "flat wraps below C");
    }},

  { name: "parseTonicPc: trailing words and leading whitespace are tolerated", fn: () => {
      eq(CNBKeySignature.parseTonicPc("C major"), 0);
      eq(CNBKeySignature.parseTonicPc("  A"), 9);
    }},

  { name: "parseTonicPc: null when the name does not begin with a note letter", fn: () => {
      eq(CNBKeySignature.parseTonicPc("Mystery"), null);
      eq(CNBKeySignature.parseTonicPc(""), null);
      eq(CNBKeySignature.parseTonicPc(null), null);
      eq(CNBKeySignature.parseTonicPc(undefined), null);
    }},

  { name: "tonicPc: explicit tonicPc → parsed name → first listed pitch class", fn: () => {
      eq(CNBKeySignature.tonicPc({ name: "C", pitchClasses: [0], tonicPc: 4 }), 4, "explicit tonicPc wins");
      eq(CNBKeySignature.tonicPc({ name: "F# minor", pitchClasses: [0] }), 6, "parsed from name");
      eq(CNBKeySignature.tonicPc({ name: "Mystery", pitchClasses: [7, 9] }), 7, "first-pc fallback");
    }},

  // ── Vertical anchoring (decision D4) ───────────────────────────────────

  { name: "tonicSemi: auto centers the octave span on staff.midpoint, ties resolve upward", fn: () => {
      const cfg = keysigConfig();
      // C, midpoint 12: |0+6−12| = |12+6−12| = 6 → tie → upward → 12
      // (engine parity: keysig.ly anchors the C tonic at the staff center).
      eq(CNBKeySignature.tonicSemi(cfg, { name: "C", pitchClasses: [0] }), 12, "C → 12");
      eq(CNBKeySignature.tonicSemi(cfg, { name: "A", pitchClasses: [9] }), 9, "A → 9");
      eq(CNBKeySignature.tonicSemi(cfg, { name: "B", pitchClasses: [11] }), 11, "B → 11");
      eq(CNBKeySignature.tonicSemi(cfg, { name: "F#", pitchClasses: [6] }), 6, "F# → 6 (span centered exactly)");
      const highMid = keysigConfig();
      highMid.staff.midpoint = 18;
      eq(CNBKeySignature.tonicSemi(highMid, { name: "C", pitchClasses: [0] }), 12, "midpoint 18 → C span 12–24 centered on it");
    }},

  { name: "tonicSemi: explicit integer placement.tonicOctave overrides the auto rule", fn: () => {
      const cfg = keysigConfig([C_MAJOR], { placement: { rule: "scale-from-tonic", tonicOctave: 2 } });
      eq(CNBKeySignature.tonicSemi(cfg, { name: "C", pitchClasses: [0] }), 24, "octave 2 → 24");
      eq(CNBKeySignature.tonicSemi(cfg, { name: "A", pitchClasses: [9] }), 33, "octave 2 → 33");
    }},

  // ── Placement rule surface (verification round-1 remediation) ──────────

  { name: "placement.rule: unknown rule renders nothing (signatureSemis null, gutterWidth 0)", fn: () => {
      const cfg = keysigConfig([C_MAJOR], { placement: { rule: "spiral", tonicOctave: null } });
      eq(CNBKeySignature.signatureSemis(cfg, "C"), null, "unknown rule → null");
      eq(CNBKeySignature.gutterWidth(cfg, PX_PER_SEMI, "C"), 0, "unknown rule → no gutter");
      const absent = keysigConfig([C_MAJOR], { placement: {} });
      deepEq(CNBKeySignature.signatureSemis(absent, "C"),
             [12, 14, 16, 17, 19, 21, 23, 24], "absent rule defaults to scale-from-tonic");
    }},

  // ── signatureSemis ──────────────────────────────────────────────────────

  { name: "signatureSemis: the key's scale ascending from the tonic plus the octave tonic (keysig.ly's 8 pitches)", fn: () => {
      deepEq(CNBKeySignature.signatureSemis(keysigConfig(), "C"),
             [12, 14, 16, 17, 19, 21, 23, 24], "C major from semi 12");
      const aMinor = keysigConfig([{ name: "A minor", pitchClasses: [9, 11, 0, 2, 4, 5, 7] }]);
      deepEq(CNBKeySignature.signatureSemis(aMinor, "A minor"),
             [9, 11, 12, 14, 16, 17, 19, 21], "A natural minor from semi 9");
      const dupes = keysigConfig([{ name: "C", pitchClasses: [0, 0, 7, 7] }]);
      deepEq(CNBKeySignature.signatureSemis(dupes, "C"), [12, 19, 24], "duplicate pitch classes collapse");
      eq(CNBKeySignature.signatureSemis(CNBConfig.createDefault(), "C"), null, "null when inactive");
    }},

  // ── measure / gutterWidth ───────────────────────────────────────────────

  { name: "gutterWidth: 0 when disabled or no key selected (no gutter reserved)", fn: () => {
      eq(CNBKeySignature.gutterWidth(CNBConfig.createDefault(), PX_PER_SEMI, "C"), 0, "disabled → 0");
      eq(CNBKeySignature.gutterWidth(keysigConfig(), PX_PER_SEMI, null), 0, "no key → 0");
      eq(CNBKeySignature.gutterWidth(keysigConfig(), PX_PER_SEMI, "G"), 0, "unknown key → 0");
    }},

  { name: "gutterWidth: notehead-chords → two columns + 2×padding (the separator runs through the middle, adding no width)", fn: () => {
      approx(CNBKeySignature.gutterWidth(keysigConfig(), PX_PER_SEMI, "C"),
             2 * MARK_W + 2 * 12, "2 notehead columns + padding");
      const noBar = keysigConfig([C_MAJOR], { separator: { enabled: false } });
      approx(CNBKeySignature.gutterWidth(noBar, PX_PER_SEMI, "C"),
             2 * MARK_W + 2 * 12, "separator on/off does not change the width");
    }},

  { name: "gutterWidth: 0 for an unknown style (validation reports it; renderer inactive)", fn: () => {
      const cfg = keysigConfig([C_MAJOR], { style: "dot" });
      eq(CNBKeySignature.gutterWidth(cfg, PX_PER_SEMI, "C"), 0, "unknown style → no gutter");
      eq(CNBKeySignature.measure(cfg, PX_PER_SEMI, "C"), null, "measure null");
    }},

  { name: "measure: null (and gutterWidth 0) when no referenced shape resolves", fn: () => {
      const cfg = keysigConfig();
      cfg.noteheadRules = [{
        name: "Broken", priority: 0,
        match: { pitchClasses: "all", durations: "all", keys: "all" },
        apply: { shape: "missing-shape", hollow: false, color: null, offKeyMark: false },
      }];
      eq(CNBKeySignature.measure(cfg, PX_PER_SEMI, "C"), null, "measure null");
      eq(CNBKeySignature.gutterWidth(cfg, PX_PER_SEMI, "C"), 0, "gutter 0");
    }},

  // ── render: notehead-chords (the operator-directed default) ────────────

  { name: "render: nothing rendered and null returned when inactive", fn: () => {
      withSvgStub(svg => {
        const config = CNBConfig.createDefault();
        const grid = CNBGrid.create(config, GRID_RANGE);
        eq(CNBKeySignature.render(svg, grid, config, "C"), null, "returns null");
        eq(svg.children.length, 0, "no children appended");
      });
    }},

  { name: "render: separator bar, two ledger layers, 8 noteheads — in that paint order (engine layering: bar at the bottom)", fn: () => {
      withSvgStub(svg => {
        const config = keysigConfig();
        const grid = CNBGrid.create(config, GRID_RANGE);
        const g = CNBKeySignature.render(svg, grid, config, "C");
        eq(g.getAttribute("class"), "cnb-key-signature", "group class");
        eq(g.children.length, 1 + 2 + 8, "separator + 2 ledger groups + 8 noteheads");
        // keysig.ly stencil-adds the gold bar UNDER the notehead/ledger
        // stencil (s2 UAT engine-render correction of the s1 layering).
        eq(g.children[0].tag, "line", "separator drawn first (bottom layer)");
        eq(g.children[1].getAttribute("class"), "cnb-ledger-set", "even-column ledgers next");
        eq(g.children[2].getAttribute("class"), "cnb-ledger-set", "odd-column ledgers next");
        // C major on the default 4-8 staff: even column [12,16,19,23] needs
        // the C-ledger at 12; odd column [14,17,21,24] needs 12 (D triggers
        // the C-ledger), 14, and 24 — the shared octave-aware ledger rules.
        eq(g.children[1].children.length, 1, "even column: ledger at 12");
        eq(g.children[2].children.length, 3, "odd column: ledgers at 12, 14, 24");
      });
    }},

  { name: "render: interleaved columns form the two stacked 7th chords (even left, odd right)", fn: () => {
      withSvgStub(svg => {
        const config = keysigConfig();
        const grid = CNBGrid.create(config, GRID_RANGE);
        const g = CNBKeySignature.render(svg, grid, config, "C");
        const noteheads = g.children.slice(3, 11);
        const leftX = 12 + MARK_W / 2;
        const rightX = leftX + MARK_W;
        const semis = [12, 14, 16, 17, 19, 21, 23, 24];
        noteheads.forEach((nh, i) => {
          const { x, y } = parseTranslate(nh.getAttribute("transform"));
          approx(x, i % 2 === 0 ? leftX : rightX, `notehead ${i} column x`);
          approx(y, semiToYExpected(semis[i]), `notehead ${i} grid y`);
        });
        // Even column = scale degrees 1-3-5-7 (C E G B: C major 7th on the
        // root); odd column = degrees 2-4-6-8 (D F A C: minor 7th on the
        // second degree) — the keysig.ly reading pinned by the operator
        // directive.
        const evenSemis = semis.filter((_, i) => i % 2 === 0);
        const oddSemis = semis.filter((_, i) => i % 2 === 1);
        deepEq(evenSemis.map(s => ((s % 12) + 12) % 12), [0, 4, 7, 11], "left column = Cmaj7");
        deepEq(oddSemis.map(s => ((s % 12) + 12) % 12), [2, 5, 9, 0], "right column = Dmin7");
      });
    }},

  { name: "render: separator bar runs through the middle of the two columns (the engine's gold stem), spans midpoint ± extentSemis", fn: () => {
      withSvgStub(svg => {
        const config = keysigConfig();
        const grid = CNBGrid.create(config, GRID_RANGE);
        const g = CNBKeySignature.render(svg, grid, config, "C");
        const line = g.children[0];
        // keysig.ly bar x = max-notehead-x-offset − width/2 — exactly
        // midway between the column centers (engine-SVG-verified in s2
        // UAT: bar x 7.0212 = midpoint of columns 6.3545/7.6880).
        approx(parseFloat(line.getAttribute("x1")), 12 + MARK_W, "bar x = column midpoint");
        eq(line.getAttribute("x1"), line.getAttribute("x2"), "vertical");
        approx(parseFloat(line.getAttribute("y1")), semiToYExpected(24), "top at midpoint+12");
        approx(parseFloat(line.getAttribute("y2")), semiToYExpected(0), "bottom at midpoint−12");
        eq(line.getAttribute("stroke"), "#ffd42a", "engine cnb:gold");
        // Engine bar = 0.4 staff-space (both sps-3 and sps-4 renders) →
        // 160% of a semitone on the default sps-4 staff.
        approx(parseFloat(line.getAttribute("stroke-width")), SEPARATOR_PX, "thickness 0.4 staff-space (160% of a semitone at sps 4)");
      });
    }},

  { name: "render: separator disabled → no bar element", fn: () => {
      withSvgStub(svg => {
        const config = keysigConfig([C_MAJOR], { separator: { enabled: false } });
        const grid = CNBGrid.create(config, GRID_RANGE);
        const g = CNBKeySignature.render(svg, grid, config, "C");
        eq(g.children.length, 10, "2 ledger groups + 8 noteheads only");
        assert(g.children.every(c => c.tag !== "line"), "no separator line");
      });
    }},

  { name: "render: notehead hollow/color parity with CNBCard.resolveNotehead (A major exercises hollow sharps)", fn: () => {
      withSvgStub(svg => {
        const config = keysigConfig([A_MAJOR]);
        config.palette.colors = Array.from({ length: 12 }, (_, pc) => ({
          pc, hex: `#1000${pc.toString(16).padStart(2, "0")}`.toUpperCase(), name: `PC${pc}`,
        }));
        const grid = CNBGrid.create(config, GRID_RANGE);
        const g = CNBKeySignature.render(svg, grid, config, "A");
        const semis = CNBKeySignature.signatureSemis(config, "A");
        const noteheads = g.children.slice(3, 3 + semis.length);
        noteheads.forEach((nh, i) => {
          const pc = ((semis[i] % 12) + 12) % 12;
          const expected = CNBCard.resolveNotehead(config, pc, "crotchet", "A");
          eq(nh.children[0].getAttribute("fill"), expected.color, `notehead ${i} color parity`);
          eq(nh.children.length, expected.hollow ? 2 : 1, `notehead ${i} hollow overlay parity`);
        });
      });
    }},

  { name: "render: the selected key is the rule-match context for signature noteheads (engine keysig parity)", fn: () => {
      withSvgStub(svg => {
        const config = keysigConfig();
        config.noteheadRules.push({
          name: "C-key color", priority: 5,
          match: { pitchClasses: "all", durations: "all", keys: ["C"] },
          apply: { color: "#123456" },
        });
        const grid = CNBGrid.create(config, GRID_RANGE);
        const g = CNBKeySignature.render(svg, grid, config, "C");
        const noteheads = g.children.slice(3, 11);
        assert(noteheads.every(nh => nh.children[0].getAttribute("fill") === "#123456"),
          "key-scoped rule applies to the signature");
        // Cards still resolve with key = null (key rows deferred), so the
        // key-scoped rule must NOT apply there.
        eq(CNBCard.resolveNotehead(config, 0, "crotchet", null).color, "#000000", "cards unaffected");
      });
    }},

  // ── render: unknown style renders nothing ───────────────────────────────

  { name: "render: an unknown style renders nothing and returns null (validation reports it)", fn: () => {
      withSvgStub(svg => {
        // style is a single-value vocabulary; the simple-mark styles were
        // removed at the task owner's s2 UAT direction (s2-uat.md).
        const config = keysigConfig([C_MAJOR], { style: "dot" });
        const grid = CNBGrid.create(config, GRID_RANGE);
        eq(CNBKeySignature.render(svg, grid, config, "C"), null, "returns null");
        eq(svg.children.length, 0, "nothing appended");
      });
    }},

  // ── Collection integration ─────────────────────────────────────────────

  { name: "collection: default config renders no keysig column (layout unchanged)", fn: () => {
      withDomStub(container => {
        const root = CNBCollection.render(container, CNBConfig.createDefault(), { keys: ["C"] });
        const columns = root.children[0].children
          .find(c => c.className === "preview-container").children
          .find(c => c.className === "pc-columns");
        eq(columns.children.length, 13, "13 cards, no gutter columns");
        assert(columns.children.every(c => c.className === "pc-col"), "cards only");
      });
    }},

  { name: "collection: enabled key signature with a selected key prepends a keysig-col", fn: () => {
      withDomStub(container => {
        const config = keysigConfig();
        const root = CNBCollection.render(container, config, { keys: ["C"] });
        const previewContainer = root.children[0].children.find(c => c.className === "preview-container");
        const columns = previewContainer.children.find(c => c.className === "pc-columns");
        eq(columns.children.length, 14, "keysig column + 13 cards");
        const col = columns.children[0];
        eq(col.className, "keysig-col", "keysig column first");
        approx(parseFloat(col.style.width), 2 * MARK_W + 24, "gutter width");
        const slice = col.children[1];
        eq(slice.getAttribute("class"), "keysig-slice", "keysig SVG between the spacers");
        eq(slice.children[0].getAttribute("class"), "cnb-key-signature", "signature rendered into the slice");
        const bg = previewContainer.children.find(c => c.getAttribute("class") === "staff-lines-bg");
        const cardsWidth = columns.children.slice(1)
          .reduce((sum, c) => sum + parseFloat(c.style.width), 0);
        approx(parseFloat(bg.getAttribute("width")), parseFloat(col.style.width) + cardsWidth,
               "staff background spans the gutter");
      });
    }},

  { name: "collection: no key selected → no keysig column even when enabled (key = example data, D5)", fn: () => {
      withDomStub(container => {
        const root = CNBCollection.render(container, keysigConfig());
        const columns = root.children[0].children
          .find(c => c.className === "preview-container").children
          .find(c => c.className === "pc-columns");
        eq(columns.children.length, 13, "no gutter without a selected key");
      });
    }},

  { name: "collection: clef and key signature compose left to right (clef-col, keysig-col, cards)", fn: () => {
      withDomStub(container => {
        const config = keysigConfig();
        config.clef = {
          ...config.clef,
          enabled: true,
          active: "test-clef",
          glyphs: { "test-clef": {
            displayName: "Test Clef", kind: "glyph",
            svgPath: "M 0 0 L 100 0 L 100 300 L 0 300 Z",
            naturalHeight: 300, naturalWidth: 100, semitoneHeight: 6,
            viewBoxMinX: 0, viewBoxMinY: 0, lilypondPath: null, anchorSemi: 20,
          } },
        };
        const root = CNBCollection.render(container, config, { keys: ["C"] });
        const columns = root.children[0].children
          .find(c => c.className === "preview-container").children
          .find(c => c.className === "pc-columns");
        eq(columns.children.length, 15, "clef + keysig + 13 cards");
        eq(columns.children[0].className, "clef-col", "clef first (binding rule 3)");
        eq(columns.children[1].className, "keysig-col", "key signature second");
        eq(columns.children[2].className, "pc-col", "cards follow");
      });
    }},

  // ── Pitch axis (set 014 s2, design §2.3) ──────────────────────────────────

  { name: "measure (axis): resolved xOffsetStaffSpaces widens the content; linear measure unchanged", fn: () => {
      const config = axisKeysigConfig();
      const pxPerSemi = config.display.pxPerSemi;
      const m = CNBKeySignature.measure(config, pxPerSemi, "C");
      const off = 0.85 * 2 * pxPerSemi;  // E, A, B carry the 0.85 rule
      deepEq(m.offsets, m.semis.map(s => [4, 9, 11].includes(s % 12) ? off : 0), "per-mark offsets");
      eq(m.extraLeftPx, 0, "no leftward offsets");
      approx(m.contentWidth, 2 * m.markWidth + off, "content widened by the largest offset");

      const linear = CNBConfig.clone(config);
      linear.pitchAxis.enabled = false;
      const lm = CNBKeySignature.measure(linear, pxPerSemi, "C");
      assert(!("offsets" in lm), "no offsets on a linear config");
      approx(lm.contentWidth, 2 * lm.markWidth, "linear content width");
    }},

  { name: "render (axis): offset marks shift right; separator extent is a length, not an axis span", fn: () => {
      const config = axisKeysigConfig();
      const grid = CNBGrid.create(config, CNBCollection.gridRange([0, 12]));
      const m = CNBKeySignature.measure(config, grid.pxPerSemi, "C");
      const paddingH = config.keys.keySignature.gutter.paddingH;
      const leftX = paddingH + m.markWidth / 2;
      withSvgStub(svg => {
        const g = CNBKeySignature.render(svg, grid, config, "C");
        const sep = g.children[0];
        eq(sep.getAttribute("class"), "cnb-key-signature-separator", "separator first");
        const midY = grid.semiToY(7);
        approx(Number(sep.getAttribute("y1")), midY - 12 * grid.pxPerSemi, "separator top = midY − 12 semitone lengths");
        approx(Number(sep.getAttribute("y2")), midY + 12 * grid.pxPerSemi, "separator bottom");
        const heads = g.children.filter(c => c.tag === "g" && c.getAttribute("class") !== "cnb-ledger-set");
        eq(heads.length, m.semis.length, "one notehead per mark");
        m.semis.forEach((semi, i) => {
          const { x, y } = parseTranslate(heads[i].getAttribute("transform"));
          approx(x, leftX + (i % 2) * m.markWidth + m.offsets[i], `mark ${semi} x`);
          approx(y, grid.semiToY(semi), `mark ${semi} y`);
        });
      });
    }},

];

/** C-major key signature on the 013 Twinline axis with the 0.85 offset rule. */
function axisKeysigConfig() {
  const config = keysigConfig();
  config.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
  };
  config.staff.semitonePattern = [2, 5, 9];
  config.staff.midpoint = 7;
  config.noteheadRules.push({
    name: "shared-position sharps sit right",
    priority: 10,
    match: { pitchClasses: [1, 4, 6, 9, 11], durations: "all", keys: "all" },
    apply: { xOffsetStaffSpaces: 0.85 },
  });
  return config;
}
