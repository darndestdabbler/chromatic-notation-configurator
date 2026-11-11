/**
 * cnb-key-signature-tests.js — Unit tests for the set-010 key-signature
 * feature
 *
 * Covers: the key signature's LilyPond export (the default config against
 * its baseline fixture; an enabled signature left to the engine's 'chord, a
 * disabled one exported as 'none — session 30), the tonic
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
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CNBConfig } from "../src/cnb-config.js";
import { CNBMusic } from "../src/cnb-music.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBKeySignature } from "../src/cnb-key-signature.js";
import { CNBAccidentalGlyphs } from "../src/cnb-accidental-glyphs.js";
import { CNBScheme } from "../src/cnb-scheme.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBCard } from "../src/cnb-card.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBClef } from "../src/cnb-clef.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { findEngine, measureSpacing, readKeys } from "./engine-probe.js";
import { withSvgStub, withDomStub } from "./svg-stub.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "..", "fixtures");
const GALLERY_DIR = path.join(__dirname, "..", "assets", "examples", "gallery");
const BASELINE_PATH = path.join(FIXTURES, "default-export-baseline.ly");
const SIGNATURE_BASELINE = path.join(FIXTURES, "key-signature-baseline.json");

// ─── The signature on the canvas, pinned (session 48) ───────────────────────
//
// The key-signature designer (design docs/planning/key-signature-designer-
// design.md) adds settings whose defaults are today's signature. Every probe
// renders CNBCollection.render at crotchet through the stub DOM, with keys and
// the signature on and one key defined, and hashes the JSON of the tree. The
// hashes in cnb/fixtures/key-signature-baseline.json were captured by
// captureSignatureBaseline() with the code before the designer, so a match
// proves each fixture and gallery file draws its signature exactly as before.
// The fixture's description lists the intentional re-captures since: in
// session 50 every probe, for the scale stack spaced by its ink (engine
// 1.4.1); the sized fixture and the Hass and Trilinear files, when each
// head's ledgers took its own width; and the Clairnote SN and DN files,
// which took their own Clairnote-style signatures (dots and slashed dots),
// so their probes pin those signatures instead.

/** The keys each probe draws: name, pitch classes and tonic. */
const SIGNATURE_KEYS = [
  { name: "C major", pitchClasses: [0, 2, 4, 5, 7, 9, 11], tonicPc: 0 },
  { name: "A minor", pitchClasses: [9, 11, 0, 2, 4, 5, 7], tonicPc: 9 },
  { name: "D major", pitchClasses: [2, 4, 6, 7, 9, 11, 1], tonicPc: 2 },
  { name: "E♭ major", pitchClasses: [3, 5, 7, 8, 10, 0, 2], tonicPc: 3 },
];

/** The pinned probes: [{ id, config, options }], in a fixed order. */
export function signatureProbes() {
  const load = file => CNBConfigIO.loadFromText(fs.readFileSync(file, "utf8")).config;
  const sources = [
    ["default", CNBConfig.createDefault()],
    ...["kite-4-369-config.json", "45deg-369-config.json", "sized-config.json"]
      .map(f => [f, load(path.join(FIXTURES, f))]),
    ...fs.readdirSync(GALLERY_DIR).filter(f => f.endsWith(".json")).sort()
      .map(f => [`gallery/${f}`, load(path.join(GALLERY_DIR, f))]),
  ];
  const probes = [];
  for (const [id, source] of sources) {
    for (const key of SIGNATURE_KEYS) {
      const config = CNBConfig.clone(source);
      config.keys.enabled = true;
      config.keys.definitions = [CNBConfig.clone(key)];
      config.keys.keySignature.enabled = true;
      probes.push({ id: `${id} · ${key.name}`, config, options: { durations: ["crotchet"], keys: [key.name] } });
    }
  }
  return probes;
}

/** Recompute every probe's hash (used to write the fixture, and by the pin). */
export function captureSignatureBaseline() {
  return signatureProbes().map(p => {
    const json = withDomStub(container => JSON.stringify(CNBCollection.render(container, p.config, p.options)));
    return { id: p.id, sha256: createHash("sha256").update(json).digest("hex"), length: json.length };
  });
}

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
// The engine's spacing (session 34): 0.75 staff spaces before the ink;
// the first card's notehead centred 4.8636 after it, behind its column
// padding (16) and its ledger (1.5 notehead widths). 64 px per staff space.
// The ink (session 50, engine 1.4.1): in C major both stacks of the default
// staff have a ledger (C's and D's in the gap, C′'s above), which reaches a
// sixth of the head's width and its 0.1-staff-space cap past the marks.
const OVERHANG = MARK_W / 6 + 0.1 * 64;                    // ≈ 15.596
const PAD_LEFT = 0.75 * 64 + OVERHANG;
const PAD_RIGHT = 4.8636 * 64 - (16 + 0.75 * MARK_W) + OVERHANG;
const GUTTER_W = PAD_LEFT + 2 * MARK_W + PAD_RIGHT;
const GRID_RANGE = { minSemi: -4, maxSemi: 28 };
const semiToYExpected = semi => (28 - semi) * PX_PER_SEMI;

export const tests = [

  // ── Export (session 30, LY spec 1.3.7 §5.6) ────────────────────────────

  { name: "export: the default config matches default-export-baseline.ly byte-for-byte", fn: () => {
      const baseline = normalizeLy(fs.readFileSync(BASELINE_PATH, "utf8"));
      const current = normalizeLy(CNBLilypond.generate(CNBConfig.createDefault()));
      eq(current, baseline, "default export");
    }},

  { name: "export: a keysig-enabled config engraves the engine's signature, and the same config disabled exports 'none", fn: () => {
      const enabled = keysigConfig();
      const disabled = CNBConfig.clone(enabled);
      disabled.keys.keySignature.enabled = false;
      assert(!CNBLilypond.generate(enabled).includes("cnb:keysig-style"), "enabled at the defaults: the engine's 'chord");
      assert(CNBLilypond.generate(disabled).includes("#(set! cnb:keysig-style 'none)"), "disabled: no signature engraved");
    }},

  { name: "signature baseline: every fixture and gallery file draws its signature exactly as before the designer, in four keys", fn: () => {
      const baseline = JSON.parse(fs.readFileSync(SIGNATURE_BASELINE, "utf8")).probes;
      const current = captureSignatureBaseline();
      deepEq(current.map(p => p.id), baseline.map(p => p.id), "the probes");
      const changed = current.filter((p, i) => p.sha256 !== baseline[i].sha256 || p.length !== baseline[i].length);
      assert(changed.length === 0, `drawn differently: ${changed.map(p => p.id).join(", ")}`);
    }},

  // Engine-backed (session 48, design §9): the key-signature designer's mark
  // table is keyed by the tonic's spelling and the key's pitch classes, so
  // the engine must read both from the score's \key. A Staff engraver reads
  // them at each engraved signature: an enharmonic pair (F♯ and G♭ major,
  // the same pitch classes), a flat key, a key change, the signature repeated
  // at a system start, and a transposed score. Skips with the reason logged
  // without LilyPond or the engine.
  { name: "engine (key identity): the tonic's spelling and the key's pitch classes are read from \\key, at a key change, a system start and under \\transpose", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const got = await readKeys(engine, CNBLilypond.generate(CNBConfig.createDefault()),
        "\\key fis \\major c'1 \\key ges \\major c'1 \\break c'1 \\key bes \\major c'1 " +
        "\\transpose c d { \\key c \\major c'1 }");
      if (got.error) throw new Error(got.error);
      const FIS = { notename: 3, alteration: 0.5, pitchClasses: [1, 3, 5, 6, 8, 10, 11] };
      const GES = { notename: 4, alteration: -0.5, pitchClasses: [1, 3, 5, 6, 8, 10, 11] };
      const BES = { notename: 6, alteration: -0.5, pitchClasses: [0, 2, 3, 5, 7, 9, 10] };
      const D = { notename: 1, alteration: 0, pitchClasses: [1, 2, 4, 6, 7, 9, 11] };
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      // Each key in the order engraved; a signature at a system start
      // repeats the key in force, so consecutive repeats are collapsed.
      const sequence = got.keys.filter((k, i) => i === 0 || !same(k, got.keys[i - 1]));
      deepEq(sequence, [FIS, GES, BES, D], "the keys engraved, in order");
      // The \break repeats G♭ major's signature at the second system's start.
      assert(got.keys.filter(k => same(k, GES)).length >= 2,
        `G♭ major is read again at the system start (read ${JSON.stringify(got.keys)})`);
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

  { name: "gutterWidth: notehead-chords → two columns plus the engine's spacing either side (the separator adds no width)", fn: () => {
      approx(CNBKeySignature.gutterWidth(keysigConfig(), PX_PER_SEMI, "C"), GUTTER_W, "2 notehead columns + the engine's spacing");
      const noBar = keysigConfig([C_MAJOR], { separator: { enabled: false } });
      approx(CNBKeySignature.gutterWidth(noBar, PX_PER_SEMI, "C"), GUTTER_W, "separator on/off does not change the width");
      const retired = keysigConfig([C_MAJOR], { gutter: { paddingH: 40 } });
      approx(CNBKeySignature.gutterWidth(retired, PX_PER_SEMI, "C"), GUTTER_W, "a retired gutter.paddingH is not read");
    }},

  { name: "padding: the engine's spacing either side, the right side from the first card's notehead centre when given", fn: () => {
      const config = keysigConfig();
      const p = CNBKeySignature.padding(config, PX_PER_SEMI, "C");
      approx(p.left, PAD_LEFT, "0.75 staff spaces before the ink, the first stack's ledger");
      approx(p.right, PAD_RIGHT, "a mark-sized notehead's column stands for the first card");
      approx(CNBKeySignature.padding(config, PX_PER_SEMI, "C", 100).right, 4.8636 * 64 - 100 + OVERHANG, "first card centred 100 px in");
      approx(CNBKeySignature.gutterWidth(config, PX_PER_SEMI, "C", 100), PAD_LEFT + 2 * MARK_W + 4.8636 * 64 - 100 + OVERHANG, "gutterWidth follows");
      eq(CNBKeySignature.padding(config, PX_PER_SEMI, null), null, "no key: null");
    }},

  { name: "gutterWidth: after a clef the marks start 3.5 staff spaces after the clef glyph's left edge", fn: () => {
      const config = keysigConfig();
      config.clef.enabled = true;
      config.clef.glyphs = { four: { displayName: "4", kind: "text", text: "4", textHeightSemis: 4, anchorSemi: 14 } };
      config.clef.active = "four";
      const glyph = CNBClef.measure(config.clef.glyphs.four, PX_PER_SEMI).pixelWidth;
      const clefPad = config.clef.gutter.paddingH;
      const left = CNBKeySignature.gutterWidth(config, PX_PER_SEMI, "C") - 2 * MARK_W - PAD_RIGHT;
      approx(clefPad + glyph + clefPad + left - clefPad, 3.5 * 64, "glyph left edge → marks: 3.5 staff spaces");
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
        const leftX = PAD_LEFT + MARK_W / 2;
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
        approx(parseFloat(line.getAttribute("x1")), PAD_LEFT + MARK_W, "bar x = column midpoint");
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
        for (let pc = 0; pc < 12; pc++) {
          config.noteheadRules.push({ name: `PC${pc}`, priority: 2, match: { pitchClasses: [pc], durations: "all", keys: "all" },
            apply: { color: `#1000${pc.toString(16).padStart(2, "0")}`.toUpperCase() } });
        }
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

  // Engine-backed (session 34): the signature's gutter gives the engine's
  // spacing. In the default config with G's signature, the marks start where
  // the engraved signature starts after the staff's start (or after a text
  // clef's left edge), and the first card's notehead is centred as far after
  // the marks as the first engraved notehead (±0.005 staff spaces). Skips
  // with the reason logged without LilyPond or the engine.
  { name: "gutter (engine): the marks and the first notehead sit where the engine spaces them — with and without a clef, with marks wider than the first card's notehead, fixed and fluid at any row width", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const G = { name: "G", pitchClasses: [7, 9, 11, 0, 2, 4, 6] };
      const BF = { name: "B♭", pitchClasses: [10, 0, 2, 3, 5, 7, 9] };
      const failures = [];
      // A signature from the mark table is spaced by its ink (session 49,
      // engine handoff 030 §3): G's stacks at each change of parity, its first
      // and last stacks with no ledger, then its first stack with a ledger
      // reaching past the marks (G♭ with ledgers in the top line set).
      // The spacing is in staff spaces, so it holds at any magnification.
      // Sharps or flats (session 51) are spaced by their boxes, the flat's in
      // the optical size LilyPond picks for the staff's magnification.
      for (const { label, clef, wideG, stacking, position, magnify, gallery, style, flat } of [
        { label: "no clef" }, { label: "text clef", clef: true }, { label: "a wide G mark", wideG: true },
        { label: "text clef, magnify 1", clef: true, magnify: "1" },
        { label: "mark table, no clef", stacking: "parity-stacks" },
        { label: "mark table, text clef", clef: true, stacking: "parity-stacks" },
        { label: "mark table, the top line set", position: "top-set" },
        { label: "mark table, text clef, magnify 5/2", clef: true, stacking: "parity", magnify: "5/2" },
        // Marks of two widths (session 50): plain dots and slashed dots, each
        // with its own ledgers, a stack of narrow marks starting its ink later.
        { label: "Clairnote SN, slashed and plain dots", gallery: "clairnote-sn.json" },
        { label: "Clairnote SN, text clef", gallery: "clairnote-sn.json", clef: true },
        { label: "sharps, no clef", style: "accidentals" },
        { label: "sharps, text clef", style: "accidentals", clef: true },
        { label: "flats, no clef", style: "accidentals", flat: true },
        { label: "flats, text clef", style: "accidentals", flat: true, clef: true },
      ]) {
        const config = gallery
          ? CNBConfigIO.loadFromText(fs.readFileSync(path.join(GALLERY_DIR, gallery), "utf8")).config
          : keysigConfig([C_MAJOR, G, BF]);
        const key = flat ? "B♭" : "G";
        if (style) config.keys.keySignature.style = style;
        if (stacking) config.keys.keySignature.stacking = stacking;
        if (position) config.keys.keySignature.placement.position = position;
        if (magnify) config.engine.defaultMagnify = magnify;
        if (clef) {
          config.clef.enabled = true;
          config.clef.glyphs = { four: { displayName: "4", kind: "text", text: "4", textHeightSemis: 4, anchorSemi: 14 } };
          config.clef.active = "four";
        }
        // G's marks (its tonic among them) twice as wide as the first card's C.
        if (wideG) {
          config.noteheadRules.push({ name: "wide G", priority: 9,
            match: { pitchClasses: [7], durations: "all", keys: "all" }, apply: { widthSemis: 6 } });
        }
        const space = 64;                                  // 4 semitones × 16 px
        const preview = withDomStub(container => {
          const root = CNBCollection.render(container, config, { keys: [key] });
          const pc = root.children[0].children.find(c => c.className === "preview-container");
          const cols = pc.children.find(c => c.className === "pc-columns").children;
          const widths = cols.map(c => parseFloat(c.style.width));
          const k = clef ? 1 : 0;                          // the keysig column
          const kStart = widths.slice(0, k).reduce((a, b) => a + b, 0);
          const sig = cols[k].children[1].children[0];
          // Every drawn mark (in the order measure gives them), each its own
          // width about its centre: a stack may go left, or hold narrower marks.
          const heads = sig.children.filter(c => String(c.getAttribute("transform") || "").startsWith("translate"));
          const measured = CNBKeySignature.measure(config, PX_PER_SEMI, key).marks;
          let left = Infinity;
          let right = -Infinity;
          heads.forEach((h, i) => {
            const { mark } = measured[i];
            if (mark.sign) {
              // A sign's box, from its origin.
              const r = CNBScheme.parseRatio(config.engine.defaultMagnify);
              const box = CNBAccidentalGlyphs.glyph(mark.sign, r.num / (r.den ?? 1)).x;
              const origin = kStart + parseFloat(/translate\(([-\d.eE+]+) /.exec(h.getAttribute("transform"))[1]);
              left = Math.min(left, origin + box[0] * space);
              right = Math.max(right, origin + box[1] * space);
              return;
            }
            const w = CNBNotehead.measure(config.shapes[mark.shape], PX_PER_SEMI, mark).pixelWidth;
            const x = kStart + parseTranslate(h.getAttribute("transform")).x;
            left = Math.min(left, x - w / 2);
            right = Math.max(right, x + w / 2);
          });
          // The ink, as drawn: the ledgers reach past the marks. Since engine
          // 1.4.1 the scale stack's heads take the notation's ledgers too, so
          // its ink is measured the same way (session 50).
          for (const set of sig.children.filter(c => c.getAttribute("class") === "cnb-ledger-set")) {
            for (const r of set.children) {
              left = Math.min(left, kStart + Number(r.getAttribute("x")));
              right = Math.max(right, kStart + Number(r.getAttribute("x")) + Number(r.getAttribute("width")));
            }
          }
          return {
            before: (clef ? left - config.clef.gutter.paddingH : left) / space,
            after: (kStart + widths[k] + widths[k + 1] / 2 - right) / space,
            inkRight: right - kStart,                      // from the signature's column
          };
        });
        const got = await measureSpacing(engine, CNBLilypond.generate(config), `\\key ${flat ? "bes" : "g"} \\major c'4 d'4`);
        if (got.error || !got.keySignature || !got.firstNote) { failures.push(`${label}: ${got.error || "nothing engraved"}`); continue; }
        const before = got.keySignature.left - (clef ? got.clef.left : got.staffStart);
        const after = (got.firstNote.left + got.firstNote.right) / 2 - got.keySignature.right;
        if (Math.abs(before - preview.before) > 5e-3) failures.push(`${label}: before the marks, engraved ${before}, preview ${preview.before}`);
        if (Math.abs(after - preview.after) > 5e-3) failures.push(`${label}: marks to the first notehead, engraved ${after}, preview ${preview.after}`);

        // The app's fluid canvas stretches the cards: its key-signature track,
        // as CSS resolves it at rows from the minimum to columns 3000 px wide
        // (past where the cards stop growing), keeps the first notehead as far
        // after the marks as the engraving.
        const template = withDomStub(container => {
          const row = CNBCollection.render(container, config, { fluid: true, keys: [key] }).children[0];
          const system = row.children.find(c => c.className === "preview-container");
          return system.children.find(c => c.className === "pc-columns").style.gridTemplateColumns;
        });
        const tracks = /^(?:(\S+)px )?max\(0px, min\(calc\((\S+)px - (\S+) \* 100%\), (\S+)px\)\) repeat\(13, minmax\((\S+)px, (\S+)px\)\)$/.exec(template);
        if (!tracks) { failures.push(`${label}: fluid track template ${template}`); continue; }
        const [fixed, P, Q, hi, colMin, maxCol] = [Number(tracks[1] || 0), ...tracks.slice(2).map(Number)];
        const marks = preview.inkRight;
        for (const W of [fixed + hi + 13 * colMin, fixed + hi + 13 * colMin + 500, 13 * 800, 13 * 3000]) {
          const K = Math.max(0, Math.min(P - Q * W, hi));
          const t = Math.min(maxCol, Math.max(colMin, (W - fixed - K) / 13));
          const fluidAfter = (K + t / 2 - marks) / space;
          if (Math.abs(after - fluidAfter) > 5e-3) failures.push(`${label}, fluid row ${W} px: marks to the first notehead, engraved ${after}, preview ${fluidAfter}`);
        }
      }
      if (failures.length > 0) throw new Error(failures.join("\n    "));
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
        approx(parseFloat(col.style.width), GUTTER_W, "gutter width");
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
      const space = grid.pxPerSemi * config.pitchAxis.axisUnitsPerStaffSpace;
      // The engine's 0.75 staff spaces before the ink, which here starts at
      // the first stack's ledger (session 50, engine 1.4.1).
      const paddingH = 0.75 * space + m.markWidth / 6 + 0.1 * space;
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

  // ── session 22: resolved notehead size ─────────────────────────────────────

  { name: "size: the widest resolved mark sets markWidth; marks draw at their resolved size", fn: () => {
      const config = keysigConfig();
      config.noteheadRules.push({
        name: "wide G", priority: 2, match: { pitchClasses: [7], durations: "all", keys: "all" },
        apply: { heightSemis: 2, widthSemis: 5 },
      });
      const m = CNBKeySignature.measure(config, PX_PER_SEMI, "C");
      approx(m.markWidth, 5 * PX_PER_SEMI, "markWidth = the sized G's width");
      approx(m.contentWidth, 2 * 5 * PX_PER_SEMI, "content width follows");
      const grid = CNBGrid.create(config, GRID_RANGE);
      const shape = config.shapes["crotchet-minim"];
      const sized = CNBNotehead.measure(shape, PX_PER_SEMI, { heightSemis: 2, widthSemis: 5 });
      const plainScale = CNBNotehead.measure(shape, PX_PER_SEMI).scaleFactor;
      withSvgStub(svg => {
        const g = CNBKeySignature.render(svg, grid, config, "C");
        const heads = g.children.filter(c => c.tag === "g" && c.getAttribute("class") !== "cnb-ledger-set");
        m.semis.forEach((semi, i) => {
          const t = heads[i].children[0].getAttribute("transform");
          eq(t, semi % 12 === 7 ? `scale(${sized.scaleX},${sized.scaleY})` : `scale(${plainScale})`, `mark ${semi} scale`);
        });
      });
    }},

  { name: "size: an unsized key signature measures as before", fn: () => {
      const m = CNBKeySignature.measure(keysigConfig(), PX_PER_SEMI, "C");
      approx(m.markWidth, MARK_W, "markWidth unchanged");
    }},

  // ── session 48: marks, the key-signature designer's scale notes ───────────

  { name: "marks: the default is today's scale stack — eight marks in two stacked sevenths, one gold stem over the middle ± 12, 0.4 staff spaces", fn: () => {
      const sig = CNBKeySignature.marks(keysigConfig(), C_KEY);
      deepEq(sig.marks.map(m => m.semi), [12, 14, 16, 17, 19, 21, 23, 24], "C major from the middle's C");
      deepEq(sig.marks.map(m => m.column), [0, 1, 0, 1, 0, 1, 0, 1], "1 3 5 7 left, 2 4 6 8 right");
      approx(sig.columns[1] - sig.columns[0], MARK_W / 64, "the stacks a mark's width apart, in staff spaces");
      eq(sig.bars.length, 1, "one stem");
      const [bar] = sig.bars;
      deepEq([bar.top, bar.bottom, bar.column, bar.middle, bar.color], [24, 0, 0, true, "#ffd42a"], "the stem");
      approx(bar.x, MARK_W / 64, "between the stacks");
      approx(bar.thickness, 0.4, "160% of a semitone at 4 semitones per staff space");
      deepEq(sig.overlaps, [], "no marks run together");
      deepEq(CNBKeySignature.signatureSemis(keysigConfig(), "C"), [12, 14, 16, 17, 19, 21, 23, 24], "signatureSemis");
      eq(CNBKeySignature.marks(keysigConfig([], { style: "sparkles" }), C_KEY), null, "an unknown style");
    }},

  { name: "marks: the four stacking rules, for an even tonic (C major, A minor's parity) and an odd one (D♭ major)", fn: () => {
      const cols = (stacking, key) => CNBKeySignature.marks(keysigConfig([], { stacking }), key).marks.map(m => m.column);
      // C major: C D E F G A B C′, semitone parity e e e o o o o e.
      deepEq(cols("degrees", C_KEY), [0, 1, 0, 1, 0, 1, 0, 1], "C: stacked sevenths");
      deepEq(cols("parity", C_KEY), [1, 1, 1, 0, 0, 0, 0, 1], "C: odd semitones left, even right");
      deepEq(cols("parity-stacks", C_KEY), [0, 0, 0, 1, 1, 1, 1, 2], "C: C D E | F G A B | C′");
      deepEq(cols("parity-zigzag", C_KEY), [0, 0, 0, 1, 1, 1, 1, 0], "C: the zigzag, odd-left mirrored");
      deepEq(cols("parity-stacks", A_MINOR_KEY), [0, 0, 1, 1, 1, 2, 2, 2], "A minor: A B | C D E | F G A′");
      // D♭ major: D♭ E♭ F G♭ A♭ B♭ C D♭′, parity o o o e e e e o.
      deepEq(cols("degrees", DB_KEY), [0, 1, 0, 1, 0, 1, 0, 1], "D♭: stacked sevenths");
      deepEq(cols("parity", DB_KEY), [0, 0, 0, 1, 1, 1, 1, 0], "D♭: odd left");
      deepEq(cols("parity-stacks", DB_KEY), [0, 0, 0, 1, 1, 1, 1, 2], "D♭: new stacks");
      deepEq(cols("parity-zigzag", DB_KEY), [0, 0, 0, 1, 1, 1, 1, 0], "D♭: the zigzag is odd-left itself");
    }},

  { name: "marks: the upper tonic off, and the tonic and the half steps alone, keep each note's stack", fn: () => {
      const sig = (ks, key = C_KEY) => CNBKeySignature.marks(keysigConfig([], ks), key).marks;
      const noUpper = sig({ upperTonic: false, stacking: "parity-stacks" });
      deepEq(noUpper.map(m => m.semi), [12, 14, 16, 17, 19, 21, 23], "seven notes");
      deepEq(noUpper.map(m => m.column), [0, 0, 0, 1, 1, 1, 1], "Clairnote's 3–4");
      deepEq(sig({ upperTonic: false, stacking: "parity-stacks" }, A_MINOR_KEY).map(m => m.column),
        [0, 0, 1, 1, 1, 2, 2], "A minor: Clairnote's 2–3–2");
      const halves = sig({ notes: "tonic-and-half-steps" });
      deepEq(halves.map(m => m.semi), [12, 16, 17, 23, 24], "C, E and F, B and C′");
      deepEq(halves.map(m => m.column), [0, 0, 1, 0, 1], "their stacked-seventh stacks");
      deepEq(sig({ notes: "tonic-and-half-steps" }, A_MINOR_KEY).map(m => m.semi), [9, 11, 12, 16, 17],
        "A minor: A, B and C, E and F (G to A′ is a whole step)");
      deepEq(sig({ notes: "tonic-and-half-steps", upperTonic: false }).map(m => m.semi), [12, 16, 17, 23],
        "without the upper tonic");
    }},

  { name: "marks: each mark's look — the notehead's own, then all marks, then flats or sharps by the key's spelling, then every second stack", fn: () => {
      const config = keysigConfig([], {
        looks: { all: { heightSemis: 1, widthSemis: 1 }, flat: { color: "#0000ff" }, sharp: { color: "#ff0000", hollow: true } },
        alternate: { color: "#00ff00" },
      });
      config.noteheadRules.push({ name: "D is grey", priority: 5,
        match: { pitchClasses: [2], durations: "all", keys: "all" }, apply: { color: "#888888" } });
      const looks = key => CNBKeySignature.marks(config, key).marks.map(({ mark }) =>
        `${mark.color}${mark.hollow ? " hollow" : ""}`);
      // B♭ major: B♭ C D E♭ F G A B♭′; odd-numbered notes are the second stack.
      // The default rules hollow the black-key pitch classes (B♭, E♭), which
      // no look changes.
      deepEq(looks(BB_KEY), ["#0000ff hollow", "#00ff00", "#888888", "#00ff00 hollow", "#000000", "#00ff00", "#000000", "#00ff00 hollow"],
        "flats blue, every second stack green over them; D grey from its rule");
      const mark = CNBKeySignature.marks(config, BB_KEY).marks[0].mark;
      deepEq([mark.heightSemis, mark.widthSemis, mark.shape], [1, 1, "crotchet-minim"], "all marks' size, the notehead's shape");
      // The default rule hollows the black-key pitch classes; the sharps' look keeps it, and adds red.
      deepEq(looks(D_KEY).filter((_, i) => i % 2 === 0), ["#888888", "#ff0000 hollow", "#000000", "#ff0000 hollow"],
        "D major's first stack: D grey, F♯ and C♯ red and hollow");
    }},

  { name: "marks: the spelling tells F♯ major from G♭ major — the definition's, the name's, else the default", fn: () => {
      const config = keysigConfig([], { looks: { all: {}, flat: { color: "#0000ff" }, sharp: { color: "#ff0000" } } });
      const colors = key => CNBKeySignature.marks(config, key).marks.map(m => m.mark.color);
      const pcs = [6, 8, 10, 11, 1, 3, 5];
      deepEq(colors({ name: "F♯ major", pitchClasses: pcs, tonicPc: 6 }),
        ["#ff0000", "#ff0000", "#ff0000", "#000000", "#ff0000", "#ff0000", "#ff0000", "#ff0000"], "F♯ G♯ A♯ B C♯ D♯ E♯ F♯′");
      deepEq(colors({ name: "G♭ major", pitchClasses: pcs, tonicPc: 6 }),
        ["#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0000ff", "#0000ff", "#000000", "#0000ff"], "G♭ A♭ B♭ C♭ D♭ E♭ F G♭′");
      deepEq(colors({ name: "Picked", pitchClasses: pcs, tonicPc: 6, spelling: "G♭" }),
        colors({ name: "G♭ major", pitchClasses: pcs, tonicPc: 6 }), "the definition's spelling (the picker's)");
      deepEq(colors({ name: "Mystery", pitchClasses: pcs, tonicPc: 6 }),
        colors({ name: "F♯ major", pitchClasses: pcs, tonicPc: 6 }), "no spelling: the default, a tie to the sharp");
      deepEq(colors({ name: "Pentatonic", pitchClasses: [0, 2, 4, 7, 9], tonicPc: 0 }), Array(6).fill("#000000"),
        "a key no name spells: every note natural");
    }},

  // ─── Accidentals (session 51, design §5) ──────────────────────────────────

  { name: "marks: accidentals — the sharps in the order F C G D A E B, the flats B E A D G C F, each its own column; nothing for C major", fn: () => {
      const acc = key => CNBKeySignature.marks(keysigConfig([], { style: "accidentals" }), key);
      const signs = key => acc(key).marks.map(m => [m.mark.sign, CNBMusic.pitchClass(m.semi), m.column]);
      deepEq(signs(C_KEY), [], "C major: no signs");
      deepEq(acc(C_KEY).columns, [], "…and no columns");
      deepEq(signs(D_KEY), [["sharp", 6, 0], ["sharp", 1, 1]], "D major: F♯ C♯");
      const EB_KEY = { name: "E♭ major", pitchClasses: [3, 5, 7, 8, 10, 0, 2], tonicPc: 3 };
      deepEq(signs(EB_KEY), [["flat", 10, 0], ["flat", 3, 1], ["flat", 8, 2]], "E♭ major: B♭ E♭ A♭");
      deepEq(signs(FS_KEY).map(s => s[1]), [6, 1, 8, 3, 10, 5], "F♯ major: F♯ C♯ G♯ D♯ A♯ E♯");
      deepEq(signs(FS_KEY).map(s => s[2]), [0, 1, 2, 3, 4, 5], "…one column each");
      const CB_KEY = { name: "C♭ major", pitchClasses: [11, 1, 3, 4, 6, 8, 10], tonicPc: 11 };
      deepEq(signs(CB_KEY).map(s => s[1]), [10, 3, 8, 1, 6, 11, 4], "C♭ major: B♭ E♭ A♭ D♭ G♭ C♭ F♭");
      deepEq(signs({ name: "E minor", pitchClasses: [4, 6, 7, 9, 11, 0, 2], tonicPc: 4 }), [["sharp", 6, 0]], "E minor: F♯");
      deepEq(signs({ name: "D minor", pitchClasses: [2, 4, 5, 7, 9, 10, 0], tonicPc: 2 }), [["flat", 10, 0]], "D minor: B♭");
      deepEq(signs({ name: "Pentatonic", pitchClasses: [0, 2, 4, 7, 9], tonicPc: 0 }), [], "a key no letters spell: none");
      acc(D_KEY).columns.forEach((x, c) => approx(x, (c + 0.5) * 1.1, "columns a sharp's 1.1 staff spaces apart"));
      // At the default magnification, 7/4, LilyPond draws emmentaler-26's flat, 0.9037 wide.
      acc(EB_KEY).columns.forEach((x, c) => approx(x, (c + 0.5) * 0.9037, "columns a flat's 0.9037 staff spaces apart"));
      const one = keysigConfig([], { style: "accidentals" });
      one.engine.defaultMagnify = "1";
      CNBKeySignature.marks(one, EB_KEY).columns.forEach((x, c) => approx(x, (c + 0.5) * 0.92, "at magnify 1, emmentaler-20's 0.92"));
      deepEq(acc(D_KEY).bars, [], "no gold stems");
      deepEq(acc(FS_KEY).overlaps, [], "no overlaps");
    }},

  { name: "marks: accidentals — each sign at the note it makes, in the octave of the scale from the place's tonic; every line set restarts the columns", fn: () => {
      const at = (position, key, staff) => {
        const config = keysigConfig([], { style: "accidentals",
          placement: { rule: "scale-from-tonic", tonicOctave: null, position } });
        if (staff) config.staff = staff;
        return CNBKeySignature.marks(config, key).marks.map(m => [m.semi, m.column]);
      };
      const EB_KEY = { name: "E♭ major", pitchClasses: [3, 5, 7, 8, 10, 0, 2], tonicPc: 3 };
      deepEq(at("middle", D_KEY), [[6, 0], [13, 1]], "D major in the middle: D at 2, F♯ 6, C♯ 13");
      deepEq(at("middle", EB_KEY), [[10, 0], [3, 1], [8, 2]], "E♭ major: E♭ at 3, B♭ 10, A♭ 8");
      deepEq(at("bottom-set", D_KEY), [[6, 0], [13, 1]], "the bottom set 4–8: D at 2");
      deepEq(at("top-set", D_KEY), [[18, 0], [25, 1]], "the top set 16–20: D at 14");
      deepEq(at("every-set", D_KEY), [[6, 0], [13, 1], [18, 0], [25, 1]], "every set: two copies, each from column 0");
      const kite = { semitonePattern: [3, 6, 9], midpoint: 12, semitonesPerStaffSpace: 3 };
      deepEq(at("middle", D_KEY, kite), [[6, 0], [13, 1]], "Kite's staff, the middle: the same notes");
      deepEq(at("top-set", D_KEY, kite), [[18, 0], [25, 1]], "Kite's top set 15–21: D at 14");
      deepEq(at("bottom-set", EB_KEY, kite), [[10, 0], [3, 1], [8, 2]], "Kite's bottom set 3–9: E♭ at 3");
    }},

  { name: "accidentals: not the scale stack; validation accepts the style", fn: () => {
      assert(CNBKeySignature.isScaleStack(keysigConfig()), "the default is the scale stack");
      assert(!CNBKeySignature.isScaleStack(keysigConfig([], { style: "accidentals" })), "accidentals are not");
      assert(CNBConfig.validate(keysigConfig([D_KEY], { style: "accidentals" })).valid, "valid");
    }},

  { name: "render: accidentals — black Emmentaler signs at LilyPond's size, in its optical size, centred on their columns, no ledgers or stems", fn: () => {
      const EB_KEY = { name: "E♭ major", pitchClasses: [3, 5, 7, 8, 10, 0, 2], tonicPc: 3 };
      const space = 4 * PX_PER_SEMI;                       // the default staff: 64 px a staff space
      for (const [key, sign, extent, width, magnify, height] of [
        [D_KEY, "sharp", [0, 1.1], 1.1, "1", 3], [EB_KEY, "flat", [-0.12, 0.8], 0.92, "1", 2.512],
        [EB_KEY, "flat", [-0.1037, 0.8], 0.9037, "7/4", 2.508],      // emmentaler-26
      ]) {
        withSvgStub(svg => {
          const config = keysigConfig([key], { style: "accidentals" });
          config.engine.defaultMagnify = magnify;
          const grid = CNBGrid.create(config, GRID_RANGE);
          const g = CNBKeySignature.render(svg, grid, config, key.name);
          const marks = CNBKeySignature.marks(config, key).marks;
          eq(g.children.length, marks.length, `${key.name}: the signs alone, no ledgers or stems`);
          const m = CNBKeySignature.measure(config, PX_PER_SEMI, key.name);
          approx(m.markWidth, width * space, `${key.name}: a column is a ${sign}'s width`);
          const { left } = CNBKeySignature.padding(config, PX_PER_SEMI, key.name);
          approx(left, 0.75 * space, `${key.name}: its ink 0.75 staff spaces after the staff's start`);
          g.children.forEach((p, c) => {
            eq(p.tag, "path", "a path");
            eq(p.getAttribute("class"), "cnb-key-signature-sign", "its class");
            eq(p.getAttribute("fill"), "#000000", "black");
            const t = /translate\(([-\d.eE+]+) ([-\d.eE+]+)\) scale\(([-\d.eE+]+)\)/.exec(p.getAttribute("transform"));
            assert(t, "translate and scale");
            approx(parseFloat(t[3]), space / 250, "250 font units a staff space");
            // The glyph's extent centred on its column.
            const centre = left + (c + 0.5) * width * space;
            approx(parseFloat(t[1]) + (extent[0] + extent[1]) / 2 * space, centre, `${sign} ${c} centred`);
            approx(parseFloat(t[2]), semiToYExpected(marks[c].semi), `${sign} ${c}: its origin at its semitone`);
          });
          // The glyph's outline, at that scale: a sharp 3 staff spaces tall.
          const ys = g.children[0].getAttribute("d").match(/-?\d+(\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 1);
          approx((Math.max(...ys) - Math.min(...ys)) / 250, height, `${sign} at magnify ${magnify}: its outline's height in staff spaces`, 1e-3);
        });
      }
      eq(CNBKeySignature.gutterWidth(keysigConfig([C_KEY], { style: "accidentals" }), PX_PER_SEMI, C_KEY.name), 0,
        "C major: nothing drawn, no gutter");
    }},

  { name: "marks: stacks go to the left in sharp keys — mirrored for D major, not for B♭ or C major, nor under odd-left-even-right", fn: () => {
      const cols = (key, stacking) => CNBKeySignature.marks(keysigConfig([], { stacking, columns: "left-in-sharp-keys" }), key)
        .marks.map(m => m.column);
      // D major: D E F♯ | G A B C♯ | D′ under new stacks at each parity change.
      deepEq(cols(D_KEY, "parity-stacks"), [2, 2, 2, 1, 1, 1, 1, 0], "D major, a sharp key: mirrored");
      deepEq(cols(BB_KEY, "parity-stacks"), [0, 0, 0, 1, 1, 1, 1, 2], "B♭ major, a flat key: B♭ C D | E♭ F G A | B♭′ to the right");
      deepEq(cols(C_KEY, "parity-stacks"), [0, 0, 0, 1, 1, 1, 1, 2], "C major, neither: to the right");
      deepEq(cols(D_KEY, "parity"), [1, 1, 1, 0, 0, 0, 0, 1], "odd-left-even-right fixes each side");
      deepEq(cols(D_KEY, "degrees"), [1, 0, 1, 0, 1, 0, 1, 0], "stacked sevenths mirror too");
    }},

  { name: "marks: the bottom, top and every line set, each copy's octave centred on its set; the middle keeps the tonic octave", fn: () => {
      const at = (position, key, extra = {}) => CNBKeySignature.marks(
        keysigConfig([], { placement: { rule: "scale-from-tonic", tonicOctave: null, position, ...extra } }), key).marks;
      // The default 4-8 staff's sets: 4–8 (middle 6) and 16–20 (middle 18).
      eq(at("bottom-set", C_KEY)[0].semi, 0, "C on the bottom set: C to C′, 0–12");
      eq(at("bottom-set", G_KEY)[0].semi, -5, "G on the bottom set: from the G below the set to the G inside it");
      eq(at("top-set", C_KEY)[0].semi, 12, "C on the top set: 12–24");
      eq(at("bottom-set", FS_KEY)[0].semi, 6, "F♯ midway on the set: the higher octave on a tie");
      eq(at("middle", C_KEY, { tonicOctave: 2 })[0].semi, 24, "an explicit tonic octave moves the middle");
      eq(at("bottom-set", C_KEY, { tonicOctave: 2 })[0].semi, 0, "…and not a line set");
      // Every line set: two copies, the root at 12 a double notehead under stacked sevenths.
      const every = at("every-set", C_KEY);
      eq(every.length, 16, "two copies of eight");
      deepEq(every.filter(m => m.semi === 12).map(m => m.column), [1, 0], "the lower copy's C′ right, the upper's C left");
      const parity = CNBKeySignature.marks(keysigConfig([], { stacking: "parity",
        placement: { rule: "scale-from-tonic", tonicOctave: null, position: "every-set" } }), C_KEY).marks;
      eq(parity.filter(m => m.semi === 12).length, 1, "one stack: the root drawn once");
      // Kite's 3-6-9 staff: sets 3–9 and 15–21.
      const kite = keysigConfig([], { placement: { rule: "scale-from-tonic", tonicOctave: null, position: "top-set" } });
      kite.staff = { semitonePattern: [3, 6, 9], midpoint: 12, semitonesPerStaffSpace: 3 };
      eq(CNBKeySignature.marks(kite, C_KEY).marks[0].semi, 12, "Kite's top set, middle 18: C at 12");
      // A staff of one set (lines 0, 4, … 20, one space apart): every set is one copy.
      const one = keysigConfig([], { placement: { rule: "scale-from-tonic", tonicOctave: null, position: "every-set" } });
      one.staff = { semitonePattern: [0, 4, 8], midpoint: 12, semitonesPerStaffSpace: 4 };
      eq(CNBKeySignature.marks(one, C_KEY).marks.length, 8, "one copy");
    }},

  { name: "marks: a gold stem between each pair of neighbouring stacks, sharing the thickness when set; over each copy's marks on a line set", fn: () => {
      const bars = (ks, key = C_KEY) => CNBKeySignature.marks(keysigConfig([], ks), key).bars;
      const shared = bars({ stacking: "parity-stacks" });
      deepEq(shared.map(b => b.column), [0, 1], "two stems for three stacks");
      shared.forEach(b => approx(b.thickness, 0.2, "half each"));
      approx(shared[1].x - shared[0].x, MARK_W / 64, "a stack apart");
      bars({ stacking: "parity-stacks", separator: { enabled: true, color: "#123456", thicknessPct: 160, extentSemis: 12, shareThickness: false } })
        .forEach(b => { approx(b.thickness, 0.4, "full each"); eq(b.color, "#123456", "its colour"); });
      approx(bars({ separator: { enabled: true, color: "#ffd42a", thicknessPct: 160, extentSemis: 12, shareThickness: false } })[0].thickness,
        0.4, "one stem: unchanged either way");
      deepEq(bars({ separator: { enabled: false, color: "#ffd42a", thicknessPct: 160, extentSemis: 12 } }), [], "off: none");
      const every = bars({ placement: { rule: "scale-from-tonic", tonicOctave: null, position: "every-set" } });
      deepEq(every.map(b => [b.bottom, b.top, b.middle]), [[0, 12, false], [12, 24, false]], "each copy's stem over its marks");
    }},

  { name: "marks: marks that run together in one stack are reported — the default notehead a whole step apart, and not small marks", fn: () => {
      const overlaps = ks => CNBKeySignature.marks(keysigConfig([], ks), C_KEY).overlaps;
      const parity = overlaps({ stacking: "parity" });
      assert(parity.some(o => o.column === 0 && o.semis[0] === 17 && o.semis[1] === 19),
        `F and G, 2 semitones apart, overlap at 2.724 tall: ${JSON.stringify(parity)}`);
      deepEq(overlaps({ stacking: "parity", looks: { all: { heightSemis: 1.2, widthSemis: 1.2 }, flat: {}, sharp: {} } }), [],
        "Clairnote-sized marks do not");
      deepEq(overlaps({}), [], "stacked sevenths, 3 and 4 semitones apart, do not");
    }},

  { name: "render: marks of two widths — each head's ledgers at its own width, and the ink from them (session 50, as the engine draws them)", fn: () => {
      // C narrower than the other marks: its in-gap ledger (semitone 12)
      // is 4/3 of its own width and its caps, not of the widest mark's.
      const config = keysigConfig();
      config.noteheadRules.push({ name: "narrow C", priority: 9,
        match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { widthSemis: 2 } });
      const space = 64;
      const narrow = 2 * PX_PER_SEMI;
      withSvgStub(svg => {
        const grid = CNBGrid.create(config, GRID_RANGE);
        const g = CNBKeySignature.render(svg, grid, config, "C");
        const widths = g.children.filter(c => c.getAttribute("class") === "cnb-ledger-set")
          .flatMap(set => set.children.map(r => Number(r.getAttribute("width"))));
        assert(widths.some(w => Math.abs(w - (narrow * 4 / 3 + 0.2 * space)) < 1e-6), `C's own ledger: ${widths}`);
        assert(widths.some(w => Math.abs(w - (MARK_W * 4 / 3 + 0.2 * space)) < 1e-6), `D's, at the wide marks' width: ${widths}`);
      });
      // The first stack (C E G B) starts its ink at C's ledger, which reaches
      // 2/3 of C's width and its cap from the stack's centre.
      const inkLeft = Math.min(0, MARK_W / 2 - (narrow * 2 / 3 + 0.1 * space));
      approx(CNBKeySignature.padding(config, PX_PER_SEMI, "C").left, 0.75 * space - inkLeft,
        "0.75 staff spaces before the ink");
    }},

  { name: "render: three stacks and two stems for a new stack at each change of parity; the gutter widens by a stack", fn: () => {
      const config = keysigConfig([C_MAJOR], { stacking: "parity-stacks" });
      eq(CNBKeySignature.measure(config, PX_PER_SEMI, "C").contentWidth, 3 * MARK_W, "three stacks wide");
      // Spaced by its ink (session 49), as the scale stack is since session
      // 50: C and D (first stack) and the upper C (last) have ledgers, each
      // reaching 1/6 of a head and its 0.1-staff-space cap past the marks, as
      // the scale stack's first and last stacks do in C (GUTTER_W).
      approx(CNBKeySignature.gutterWidth(config, PX_PER_SEMI, "C"), GUTTER_W + MARK_W,
        "a stack wider than the scale stack's, the ledgers past the marks as for it");
      withSvgStub(svg => {
        const grid = CNBGrid.create(config, GRID_RANGE);
        const g = CNBKeySignature.render(svg, grid, config, "C");
        const left = PAD_LEFT;
        const stems = g.children.filter(c => c.getAttribute("class") === "cnb-key-signature-separator");
        deepEq(stems.map(s => Number(s.getAttribute("x1"))).map(x => Math.round((x - left) / MARK_W)), [1, 2], "between the stacks");
        stems.forEach(s => approx(Number(s.getAttribute("stroke-width")), SEPARATOR_PX / 2, "shared"));
        stems.forEach(s => eq(s.getAttribute("stroke-linecap"), "round", "round caps, as engraved"));
        const heads = g.children.filter(c => String(c.getAttribute("transform") || "").startsWith("translate"));
        const xs = [...new Set(heads.map(h => Math.round((parseTranslate(h.getAttribute("transform")).x - left) / MARK_W * 2)))];
        deepEq(xs, [1, 3, 5], "the heads at three stack centres");
      });
    }},

  { name: "isScaleStack: the defaults, and settings that do not apply, are the scale stack; any other setting is not", fn: () => {
      assert(CNBKeySignature.isScaleStack(keysigConfig([C_MAJOR])), "the defaults");
      const unused = keysigConfig([C_MAJOR]);
      unused.keys.keySignature.separator.shareThickness = false;   // two stacks: one stem, nothing to share
      unused.keys.keySignature.looks = { all: { color: undefined }, flat: {}, sharp: {} };
      assert(CNBKeySignature.isScaleStack(unused), "a setting that does not apply");
      for (const [label, ks] of [
        ["notes", { notes: "tonic-and-half-steps" }], ["upper tonic", { upperTonic: false }],
        ["stacking", { stacking: "parity" }], ["columns", { columns: "left-in-sharp-keys" }],
        ["place", { placement: { rule: "scale-from-tonic", tonicOctave: null, position: "top-set" } }],
        ["a look", { looks: { all: {}, flat: { hollow: true }, sharp: {} } }],
        ["a colour of none", { looks: { all: { color: null }, flat: {}, sharp: {} } }],
        ["every second stack", { alternate: { color: "#cc79a7" } }],
      ]) {
        assert(!CNBKeySignature.isScaleStack(keysigConfig([C_MAJOR], ks)), label);
      }
    }},

  { name: "render: a signature's ledgers are 4/3 of a head and their round caps long, as engraved", fn: () => {
      const config = keysigConfig([C_MAJOR]);
      withSvgStub(svg => {
        const g = CNBKeySignature.render(svg, CNBGrid.create(config, GRID_RANGE), config, "C");
        const rects = g.children.filter(c => c.getAttribute("class") === "cnb-ledger-set").flatMap(s => s.children);
        assert(rects.length > 0, "C major draws ledgers");
        rects.forEach(r => approx(Number(r.getAttribute("width")), MARK_W * 4 / 3 + 0.2 * 64, "length"));
      });
    }},

  { name: "render: on every line set the shared root is a double notehead — two heads side by side at one height", fn: () => {
      const config = keysigConfig([C_MAJOR], { placement: { rule: "scale-from-tonic", tonicOctave: null, position: "every-set" } });
      withSvgStub(svg => {
        const grid = CNBGrid.create(config, GRID_RANGE);
        const g = CNBKeySignature.render(svg, grid, config, "C");
        const heads = g.children.filter(c => String(c.getAttribute("transform") || "").startsWith("translate"))
          .map(h => parseTranslate(h.getAttribute("transform")));
        eq(heads.length, 16, "two copies");
        const root = heads.filter(h => Math.abs(h.y - semiToYExpected(12)) < 1e-9);
        eq(root.length, 2, "two heads at the root");
        approx(Math.abs(root[0].x - root[1].x), MARK_W, "side by side");
        eq(g.children.filter(c => c.getAttribute("class") === "cnb-key-signature-separator").length, 2, "a stem per copy");
      });
    }},

];

// Keys for the marks tests (session 48): definitions as the picker passes them.
const C_KEY = { name: "C major", pitchClasses: [0, 2, 4, 5, 7, 9, 11], tonicPc: 0 };
const A_MINOR_KEY = { name: "A minor", pitchClasses: [9, 11, 0, 2, 4, 5, 7], tonicPc: 9 };
const G_KEY = { name: "G major", pitchClasses: [7, 9, 11, 0, 2, 4, 6], tonicPc: 7 };
const D_KEY = { name: "D major", pitchClasses: [2, 4, 6, 7, 9, 11, 1], tonicPc: 2 };
const FS_KEY = { name: "F♯ major", pitchClasses: [6, 8, 10, 11, 1, 3, 5], tonicPc: 6 };
const BB_KEY = { name: "B♭ major", pitchClasses: [10, 0, 2, 3, 5, 7, 9], tonicPc: 10 };
const DB_KEY = { name: "D♭ major", pitchClasses: [1, 3, 5, 6, 8, 10, 0], tonicPc: 1 };

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
