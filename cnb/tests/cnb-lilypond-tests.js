/**
 * cnb-lilypond-tests.js — Unit tests for Module 11 (LilyPond Exporter)
 *
 * Session 1 coverage: header, Section A (named definitions), Section B
 * (engine settings), and the svgPathToLilypond / toSchemeSymbol /
 * computeStaffLinePositions helpers.
 *
 * Session 2 coverage: Section C (configuration procedure — memv grouping,
 * duration-aware compound conditions, repeat field), generate() (order +
 * export validation). The parity tests against the legacy exporter were
 * retired with the monolith (preserved at tag `legacy-monolith-final`).
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "fs";
import { execFile } from "child_process";
import { createHash } from "crypto";
import { findEngine, measureNoteheads, engraveNoteheads, measureClef, measureKeySignature, measureKeySignatureMarks, measureStaffPositions, measureLedgers, measureSpacing, NO_PAGES } from "./engine-probe.js";
import { CNBClef } from "../src/cnb-clef.js";
import { CNBBuiltinClefs } from "../ui/builtin-clefs.js";
import { CNBClefEditor } from "../ui/clef-editor.js";
import { withDomStub } from "./svg-stub.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBCard } from "../src/cnb-card.js";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBLilypond, _internals } from "../src/cnb-lilypond.js";
import { CNBScheme } from "../src/cnb-scheme.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBKeySignature } from "../src/cnb-key-signature.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBMusic } from "../src/cnb-music.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBLedgerSet } from "../src/cnb-ledger-set.js";
import { CNBAccidentalGlyphs } from "../src/cnb-accidental-glyphs.js";
import { CNBPreviewDisplay } from "../ui/preview-display.js";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function contains(haystack, needle, msg) {
  if (!haystack.includes(needle)) {
    throw new Error(`${msg || "contains"}: output does not include ${JSON.stringify(needle)}`);
  }
}

function lacks(haystack, needle, msg) {
  if (haystack.includes(needle)) {
    throw new Error(`${msg || "lacks"}: output unexpectedly includes ${JSON.stringify(needle)}`);
  }
}

/** Config with colour rules on PCs 0–2 for color-registration tests (a
 *  notehead's colour lives on its rules, session 37). */
function colourConfig() {
  const cfg = CNBConfig.createDefault();
  [["#1B9E77", 0], ["#D95F02", 1], ["#7570B3", 2]].forEach(([hex, pc], i) => cfg.noteheadRules.push({
    name: "Colour " + hex, priority: 2 + i,
    match: { pitchClasses: [pc], durations: "all", keys: "all" }, apply: { color: hex },
  }));
  return cfg;
}

/**
 * Parse a Section C string into a map pc → { shape, color, hollow,
 * attachment, condition }. Expands memv groups; skips the else fallback.
 * Used for semantic comparison (structure, not formatting).
 */
function parseSectionCClauses(text) {
  const map = {};
  let pcs = null;
  let condition = null;

  for (const line of text.split("\n")) {
    const memv = line.match(/\(memv pc '\(([\d ]+)\)\)/);
    const single = line.match(/\(= pc (\d+)\)/);
    if (line.includes("(else")) { pcs = null; condition = null; continue; }
    if (memv || single) {
      pcs = memv ? memv[1].trim().split(/\s+/).map(Number) : [Number(single[1])];
      condition = line.trim();
      continue;
    }
    const field = line.match(/\((shape|color|hollow|attachment|x-offset)\s+\.\s+([^)\s]+)\)/);
    if (field && pcs) {
      for (const pc of pcs) {
        if (!map[pc]) map[pc] = { condition };
        map[pc][field[1]] = field[2];
      }
    }
  }
  return map;
}

/** The default config with the given staff pattern and spacing (midpoint 12). */
/** The default config with keys on, C and G defined, and F♯ red in G (rule index 2). */
function keyRuleConfig() {
  const cfg = CNBConfig.createDefault();
  cfg.keys.enabled = true;
  cfg.keys.definitions = [
    { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
    { name: "G", pitchClasses: [7, 9, 11, 0, 2, 4, 6] },
  ];
  cfg.noteheadRules.push({ name: "F♯ red in G", priority: 5,
    match: { pitchClasses: [6], durations: "all", keys: ["G"] }, apply: { color: "#FF0000" } });
  return cfg;
}

function staffConfig(pattern, sps) {
  const cfg = CNBConfig.createDefault();
  cfg.staff.semitonePattern = pattern;
  cfg.staff.semitonesPerStaffSpace = sps;
  return cfg;
}

export const tests = [

  // ── pathToStaffSpace / svgPathToLilypond (audit H2/H3) ─────────────────────

  // The toolkit writes kite-up.svg (4 semitones tall, 100 SVG units per
  // semitone) as semitone-unit data: (moveto 0 2) (lineto 2 1) …
  { name: "pathToStaffSpace: a toolkit (semitone-unit) path is divided by sps 1, 2 and 3", fn: () => {
      const commands = [
        { cmd: "moveto", args: [0, 2] }, { cmd: "lineto", args: [2, 1] },
        { cmd: "curveto", args: [3, 3, -3, 3, 0, -2] }, { cmd: "closepath", args: [] },
      ];
      eq(CNBLilypond.pathToStaffSpace(commands, 1),
        "'(\n    (moveto 0 2)\n    (lineto 2 1)\n    (curveto 3 3 -3 3 0 -2)\n    (closepath))", "sps 1");
      eq(CNBLilypond.pathToStaffSpace(commands, 2),
        "'(\n    (moveto 0 1)\n    (lineto 1 0.5)\n    (curveto 1.5 1.5 -1.5 1.5 0 -1)\n    (closepath))", "sps 2");
      eq(CNBLilypond.pathToStaffSpace(commands, 3),
        "'(\n    (moveto 0 0.6667)\n    (lineto 0.6667 0.3333)\n    (curveto 1 1 -1 1 0 -0.6667)\n    (closepath))", "sps 3");
    }},

  { name: "pathToStaffSpace: flipY negates Y only", fn: () => {
      eq(CNBLilypond.pathToStaffSpace([{ cmd: "moveto", args: [4, 8] }], 2, true), "'(\n    (moveto 2 -4))");
    }},

  { name: "svgPathToLilypond normalises SVG units: ÷ units per semitone, Y up, ÷ sps 1, 2 and 3", fn: () => {
      // kite-up.svg's notehead d, 100 SVG units per semitone: the same
      // geometry as the toolkit path above, so the same output at each sps.
      const d = "M 0 -200 L 200 -100 C 300 -300 -300 -300 0 200 Z";
      for (const [sps, expected] of [
        [1, "'(\n    (moveto 0 2)\n    (lineto 2 1)\n    (curveto 3 3 -3 3 0 -2)\n    (closepath))"],
        [2, "'(\n    (moveto 0 1)\n    (lineto 1 0.5)\n    (curveto 1.5 1.5 -1.5 1.5 0 -1)\n    (closepath))"],
        [3, "'(\n    (moveto 0 0.6667)\n    (lineto 0.6667 0.3333)\n    (curveto 1 1 -1 1 0 -0.6667)\n    (closepath))"],
      ]) {
        eq(CNBLilypond.svgPathToLilypond(d, 100, sps), expected, `sps ${sps}`);
      }
    }},

  { name: "svgPathToLilypond uses the shape's own units per semitone (136.2 for the gallery shapes)", fn: () => {
      // 136.2 SVG units = 1 semitone; sps 2 → 0.5 staff space
      contains(CNBLilypond.svgPathToLilypond("M 136.2 -272.4", 136.2, 2), "(moveto 0.5 1)");
    }},

  { name: "svgPathToLilypond folds H/V into lineto with tracked position", fn: () => {
      const out = CNBLilypond.svgPathToLilypond("M 0 0 H 5 V 6 Z", 1, 1);
      contains(out, "(lineto 5 0)");
      contains(out, "(lineto 5 -6)");
    }},

  { name: "svgPathToLilypond rounds to 4 decimals and normalizes -0 to 0", fn: () => {
      contains(CNBLilypond.svgPathToLilypond("M 0.123456 -1.999999", 1, 1), "(moveto 0.1235 2)");
      contains(CNBLilypond.svgPathToLilypond("M -0.00001 0.00001", 1, 1), "(moveto 0 0)");
    }},

  { name: "svgPathToLilypond returns '() for empty/invalid input", fn: () => {
      eq(CNBLilypond.svgPathToLilypond("", 100, 4), "'()");
      eq(CNBLilypond.svgPathToLilypond(null, 100, 4), "'()");
    }},

  // ── toSchemeSymbol ─────────────────────────────────────────────────────────

  { name: "toSchemeSymbol combines name and hex", fn: () => {
      eq(CNBLilypond.toSchemeSymbol("Shamrock", "#1B9E77"), "shamrock-1b9e77");
    }},

  { name: "toSchemeSymbol without hex slugs the name", fn: () => {
      eq(CNBLilypond.toSchemeSymbol("Crotchet–Minim"), "crotchet-minim");
      eq(CNBLilypond.toSchemeSymbol("My  Shape!!"), "my-shape");
    }},

  { name: "toSchemeSymbol collapses repeats and trims hyphens", fn: () => {
      eq(CNBLilypond.toSchemeSymbol("--Weird---Name--"), "weird-name");
    }},

  // ── computeStaffLinePositions ──────────────────────────────────────────────

  // LilyPond staff positions are half-staff-spaces from center (LY spec
  // §5.1; engine cnb/config.ly) — the ×2 factor is the 007-s1 D2 fix.
  { name: "staff-line-positions: 4-8 system, midpoint 12, sps 4 → (-4 -2 2 4) half-staff-spaces", fn: () => {
      const cfg = CNBConfig.createDefault();
      const pos = CNBLilypond.computeStaffLinePositions(cfg);
      eq(JSON.stringify(pos), JSON.stringify([-4, -2, 2, 4]));
    }},

  { name: "staff-line-positions: 3-6-9 system, midpoint 12, sps 3 → (-6 -4 -2 2 4 6) half-staff-spaces (engine reference)", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.semitonePattern = [3, 6, 9];
      cfg.staff.semitonesPerStaffSpace = 3;
      const pos = CNBLilypond.computeStaffLinePositions(cfg);
      eq(JSON.stringify(pos), JSON.stringify([-6, -4, -2, 2, 4, 6]));
    }},

  // Session 32's presets: spacing 2, midpoint 12.
  { name: "staff-line-positions: 2-4-6-8-10 system, midpoint 12, sps 2 → (-10 -8 -6 -4 -2 2 4 6 8 10)", fn: () => {
      const cfg = staffConfig([2, 4, 6, 8, 10], 2);
      eq(JSON.stringify(CNBLilypond.computeStaffLinePositions(cfg)), JSON.stringify([-10, -8, -6, -4, -2, 2, 4, 6, 8, 10]));
      contains(CNBLilypond.generate(cfg), "#(set! cnb:staff-line-positions '(-10 -8 -6 -4 -2 2 4 6 8 10))");
    }},

  { name: "staff-line-positions: 3-5-7-9 system, midpoint 12, sps 2 → (-9 -7 -5 -3 3 5 7 9), lines on odd positions", fn: () => {
      const cfg = staffConfig([3, 5, 7, 9], 2);
      eq(JSON.stringify(CNBLilypond.computeStaffLinePositions(cfg)), JSON.stringify([-9, -7, -5, -3, 3, 5, 7, 9]));
      contains(CNBLilypond.generate(cfg), "#(set! cnb:staff-line-positions '(-9 -7 -5 -3 3 5 7 9))");
    }},

  { name: "staff-line-positions (engine): 3-5-7-9 engraves its lines on the odd positions, where the preview draws them", fn: async () => {
      // No other fixture puts lines on odd staff positions. The preview's
      // lines for the card range, as half-staff-spaces from the midpoint,
      // must be the engraved ones. (Noteheads are not compared: on a
      // linear staff the engine's staff-position property stays LilyPond's
      // diatonic one, whatever the staff.)
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const cfg = staffConfig([3, 5, 7, 9], 2);
      const preview = CNBStaff.getPositions(cfg, { minSemi: 0, maxSemi: 24 })
        .map(S => 2 * (S - cfg.staff.midpoint) / cfg.staff.semitonesPerStaffSpace);
      eq(JSON.stringify(preview), JSON.stringify([-9, -7, -5, -3, 3, 5, 7, 9]), "preview lines");
      const { lines, error } = await measureStaffPositions(engine, CNBLilypond.generate(cfg));
      assert(!error, `the export must engrave: ${error}`);
      eq(JSON.stringify([...lines].sort((a, b) => a - b)), JSON.stringify(preview), "engraved lines");
    }},

  // ── Ledger lines (session 34, LY spec 1.3.9 §5.7) ─────────────────────────

  { name: "ledgers: Section B writes, per pitch the preview draws, the ledgers it draws there, and gives each notehead its pitch's", fn: () => {
      const b = CNBLilypond.sectionB(CNBConfig.createDefault());
      contains(b, "#(define cnb:ledgers-by-semitone", "the table");
      // Default 4-8: C and C♯ share the C ledger (staff position −6), D adds
      // its own (−5); B, between C and the staff, has none, though the engine
      // rounds its position (−0.5) to C''s 0; C'' has the in-gap ledger at 0.
      for (const entry of ["(0 . (-6))", "(1 . (-6))", "(2 . (-6 -5))", "(11 . ())", "(12 . (0))", "(22 . (5))", "(24 . (6))"]) {
        contains(b, entry, entry);
      }
      lacks(b, "(25 . ", "nothing beyond the card range");
      lacks(b, "(-1 . ", "nor below it");
      contains(b, "\\override NoteHead.ledger-positions =", "per-notehead ledgers");
      contains(b, "\\override NoteHead.no-ledgers =", "and none where the preview draws none");
      lacks(b, "cnb:ledger-overrides", "keyed by pitch, not by the rounded position");
    }},

  { name: "ledgers: a mark-table signature's marks beyond the cards' pitches get their entries too (session 50, engine 1.4.1)", fn: () => {
      const config = keySignatureConfig();
      config.keys.keySignature.placement.position = "bottom-set";
      const b = CNBLilypond.sectionB(config);
      // Keys on the bottom set reach below middle C: the B♭ there, −2, has
      // the canvas's A♯ ledger (template 10, staff position −7).
      contains(b, "(-2 . (-7))", "the low B♭'s ledger");
      const keys = [...b.matchAll(/\((-?\d+) \. \(/g)].map(m => Number(m[1]));
      const marks = new Set(_internals.markTable(config).flatMap(e => e.sig.marks.map(m => m.semi)));
      for (const s of marks) assert(keys.includes(s), `an entry for the mark at ${s}`);
      eq(keys.filter(s => s < 0 || s > 24).length, [...marks].filter(s => s < 0 || s > 24).length, "and none for other pitches");
      eq(JSON.stringify(keys), JSON.stringify([...keys].sort((x, y) => x - y)), "in order");
      // The scale stack ('chord) adds nothing: its marks are on the cards' pitches.
      const chord = CNBLilypond.sectionB(keySignatureConfig());
      lacks(chord, "(-1 . ", "nothing below the cards' pitches");
      lacks(chord, "(25 . ", "nor above them");
    }},

  { name: "ledgers: keys are engine semitones — the midpoint's offset from 12 on a linear staff, Configurator semitones under an axis", fn: () => {
      const moved = CNBConfig.createDefault();
      moved.staff.midpoint = 18;                       // C renamed F♯: pattern and templates move by 6
      moved.staff.semitonePattern = [2, 10];
      moved.ledgers.templates = moved.ledgers.templates.map(t =>
        ({ ...t, semiWithinOctave: (t.semiWithinOctave + 6) % 12, triggerPCs: t.triggerPCs.map(p => (p + 6) % 12) }));
      const b = CNBLilypond.sectionB(moved);
      contains(b, "(0 . (-6))", "preview semitone 6 (the moved C), engine semitone 0, keeps C's ledger");
      contains(b, "'((-6 . ", "the table starts at preview semitone 0, engine −6");
      const twin = JSON.parse(readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json"), "utf8"));
      contains(CNBLilypond.sectionB(twin), "'((0 . ", "an axis config keys by its own semitones");
    }},

  // Engine round trip (session 34): for the default, Kite 4-369 and 45deg-369
  // fixtures and every gallery file (Twinline among them), every card's
  // octave chord engraves exactly the ledgers the card draws, in-gap ledgers
  // included. Skips with the reason logged without LilyPond or the engine.
  { name: "ledgers (engine): every card engraves the ledgers the preview draws, default, Kite, 45deg-369 and every gallery file", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const gallery = path.join(CNB_DIR, "assets", "examples", "gallery");
      const configs = [["default", CNBConfig.createDefault()]];
      for (const f of ["kite-4-369-config.json", "45deg-369-config.json"]) {
        configs.push([f, CNBConfigIO.loadFromText(readFileSync(path.join(CNB_DIR, "fixtures", f), "utf8")).config]);
      }
      for (const f of readdirSync(gallery).filter(n => n.endsWith(".json"))) {
        configs.push([f, CNBConfigIO.loadFromText(readFileSync(path.join(gallery, f), "utf8")).config]);
      }
      const names = ["c", "cis", "d", "dis", "e", "f", "fis", "g", "gis", "a", "ais", "b"];
      const pitch = e => names[((e % 12) + 12) % 12] + ["", "'", "''", "'''"][Math.floor(e / 12) + 1];
      const failures = [];
      for (const [name, config] of configs) {
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const half = CNBStaff.staffSpacePx(config, grid) / 2;
        const middleY = grid.semiToY(config.staff.midpoint);
        const shift = grid.axis && grid.axis.enabled ? 0 : config.staff.midpoint - 12;
        const cards = [...Array(13).keys()].map(pc => withDomStub(container => {
          const svg = CNBCard.render(container, grid, config, { pc, duration: "crotchet" }).children[1];
          const rects = svg.children.find(c => c.getAttribute("class") === "cnb-ledger-set").children;
          return [...new Set(rects.map(r => Math.round(
            (middleY - Number(r.getAttribute("y")) - Number(r.getAttribute("height")) / 2) / half * 1e4) / 1e4))]
            .sort((a, b) => a - b);
        }));
        const music = [...Array(13).keys()].map(pc => `<${pitch(pc - shift)} ${pitch(pc + 12 - shift)}>4 r4`).join(" ");
        const { chords, error } = await measureLedgers(engine, CNBLilypond.generate(config), music);
        if (error) { failures.push(`${name}: ${error.slice(0, 400)}`); continue; }
        if (chords.length !== 13) { failures.push(`${name}: ${chords.length} chords engraved`); continue; }
        cards.forEach((want, pc) => {
          const got = chords[pc].ledgers;
          if (got.length !== want.length || got.some((p, i) => Math.abs(p - want[i]) > 2e-3)) {
            failures.push(`${name} pc ${pc}: engraved ledgers at ${JSON.stringify(got)}, preview ${JSON.stringify(want)}`);
          }
        });
      }
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    }},

  // ── Key-scoped notehead rules (session 34, LY spec 1.3.9 §6.4) ────────────

  { name: "keys: Section C branches on the sorted pitch classes of each key a rule names, the key-less clauses as the fallback", fn: () => {
      const cfg = keyRuleConfig();
      const c = CNBLilypond.sectionC(cfg);
      contains(c, "(key-pcs (sort (list-copy key) <))", "the key, sorted");
      contains(c, ";; Key G\n         ((equal? key-pcs '(0 2 4 6 7 9 11))", "G's branch");
      lacks(c, ";; Key C\n", "C names no rule: no branch of its own");
      contains(c, ";; Any other key\n         (else", "the fallback");
      const g = c.slice(c.indexOf(";; Key G"), c.indexOf(";; Any other key"));
      contains(g, "F♯ → crotchet-minim, hollow, red-ff0000", "F♯ red in G");
      lacks(c.slice(c.indexOf(";; Any other key")), "red-ff0000", "black in any other key");
      contains(CNBLilypond.sectionA(cfg), "(cnb:register-color! 'red-ff0000 \"#FF0000\")", "the key's colour is registered");
    }},

  { name: "keys: with keys off, or no rule naming a defined key, Section C is the key-less procedure", fn: () => {
      const plain = CNBLilypond.sectionC(CNBConfig.createDefault());
      const off = keyRuleConfig();
      off.keys.enabled = false;
      eq(CNBLilypond.sectionC(off).replace(/red-ff0000/g, "x"), CNBLilypond.sectionC(off), "no red at all");
      lacks(CNBLilypond.sectionC(off), "key-pcs", "keys off: no dispatch (the preview applies no key)");
      const undefinedKey = keyRuleConfig();
      undefinedKey.noteheadRules[2].match.keys = ["D"];
      eq(CNBLilypond.sectionC(undefinedKey), plain, "a rule naming no defined key: byte-identical to the default");
    }},

  { name: "keys: definitions sharing a pitch-class set make one branch, the first named in definition order", fn: () => {
      const cfg = keyRuleConfig();
      cfg.keys.definitions.push({ name: "E minor", pitchClasses: [4, 6, 7, 9, 11, 0, 2] });
      cfg.noteheadRules.push({ name: "E minor blue", priority: 6,
        match: { pitchClasses: [4], durations: "all", keys: ["E minor"] }, apply: { color: "#0000FF" } });
      const c = CNBLilypond.sectionC(cfg);
      eq(c.split("((equal? key-pcs '(0 2 4 6 7 9 11))").length, 2, "one branch for the set");
      contains(c, ";; Key G\n", "named after G, defined first");
    }},

  // Engine round trip (session 34): one key-scoped colour rule, F♯ red in G,
  // engraves red under \key g \major and black under \key c \major, as the
  // preview draws it in those keys. Skips with the reason logged without
  // LilyPond or the engine.
  { name: "keys (engine): a key-scoped colour rule engraves in its key and not in another", fn: async () => {
      const cfg = keyRuleConfig();
      eq(CNBConfig.resolveNotehead(cfg, 6, "crotchet", "G").color, "#FF0000", "preview: red in G");
      eq(CNBConfig.resolveNotehead(cfg, 6, "crotchet", "C").color, null, "preview: no colour in C");
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const { noteheads, error } = await engraveNoteheads(engine, CNBLilypond.generate(cfg),
        "\\key g \\major fis'4 g'4 \\key c \\major fis'4");
      assert(!error, `the export must engrave: ${error}`);
      eq(JSON.stringify(noteheads.map(n => [n.pc, n.color])),
        JSON.stringify([[6, "#ff0000"], [7, "#000000"], [6, "#000000"]]), "F♯ red in G only");
    }},

  // LY spec 1.3.5 §5.1a: the range is the 24 semitones centred on the
  // midpoint, which is octaves 0 and 1 whenever the midpoint is 12.
  { name: "staff-line-positions 1.3.5: every config with midpoint 12 gets the octave-0-and-1 positions", fn: () => {
      const gallery = path.join(CNB_DIR, "assets", "examples", "gallery");
      const configs = [["createDefault", CNBConfig.createDefault()]];
      for (const f of ["kite-4-369-config.json", "45deg-369-config.json", "sized-config.json"]) {
        configs.push([f, JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", f), "utf8"))]);
      }
      for (const f of readdirSync(gallery).filter(n => n.endsWith(".json"))) {
        configs.push([f, JSON.parse(readFileSync(path.join(gallery, f), "utf8"))]);
      }
      let checked = 0;
      for (const [name, cfg] of configs) {
        if (cfg.staff.midpoint !== 12) continue;
        const sps = cfg.pitchAxis && cfg.pitchAxis.enabled ? cfg.pitchAxis.axisUnitsPerStaffSpace : cfg.staff.semitonesPerStaffSpace;
        const old = [];
        for (const oct of [0, 1]) for (const s of cfg.staff.semitonePattern) old.push(2 * (s + oct * 12 - 12) / sps);
        old.sort((a, b) => a - b);
        eq(JSON.stringify(CNBLilypond.computeStaffLinePositions(cfg)), JSON.stringify(old), name);
        checked++;
      }
      assert(checked >= 20, `checked ${checked} midpoint-12 configs`);
    }},

  { name: "staff-line-positions 1.3.5: the range follows the midpoint, so a moved pitch keeps the staff", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.midpoint = 6;             // C renamed F♯ (shiftPitch −6)
      cfg.staff.semitonePattern = [2, 10];
      eq(JSON.stringify(CNBLilypond.computeStaffLinePositions(cfg)), JSON.stringify([-4, -2, 2, 4]), "midpoint 6");
      cfg.staff.midpoint = 18;
      eq(JSON.stringify(CNBLilypond.computeStaffLinePositions(cfg)), JSON.stringify([-4, -2, 2, 4]), "midpoint 18");
    }},

  // ── header ─────────────────────────────────────────────────────────────────

  { name: "header emits version, include, and generated-by block", fn: () => {
      const cfg = CNBConfig.createDefault();
      const out = CNBLilypond.header(cfg);
      contains(out, '\\version "2.24.2"');
      contains(out, '\\include "ChromaticNotationBase.ly"');
      contains(out, "Default 4-8 System — Generated by Chromatic Configurator");
      contains(out, "DO NOT EDIT BY HAND");
      contains(out, "%% Source: Default 4-8 System.json");
      lacks(out, "palette");
    }},

  { name: "header names no palette, no colour-blind switch and no preview-only setting (session 37)", fn: () => {
      const cfg = colourConfig();
      const out = CNBLilypond.header(cfg) + CNBLilypond.generate(cfg);
      for (const item of ["palette", "Preview-only", "cnb:use-accessible-colors", "cb-safe", "(standard)"]) lacks(out, item);
    }},

  { name: "header version comes from engine.lilypondVersion", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.lilypondVersion = "2.25.0";
      contains(CNBLilypond.header(cfg), '\\version "2.25.0"');
    }},

  // ── Section A: paths ───────────────────────────────────────────────────────

  { name: "sectionA falls back to SVG path conversion in staff-space units when lilypondPath is null", fn: () => {
      // Default crotchet-minim: 100 SVG units per semitone, sps 4 →
      // M 163.578 -81.573 becomes (moveto 0.4089 0.2039), not raw SVG (H3).
      const out = CNBLilypond.sectionA(CNBConfig.createDefault());
      contains(out, "#(define cnb:crotchet-minim-path '(\n    (moveto 0.4089 0.2039)");
      lacks(out, "163.578");
    }},

  { name: "sectionA emits a pre-baked lilypondPath ÷ sps, re-emitted from its numbers (H2)", fn: () => {
      const cfg = CNBConfig.createDefault(); // sps 4
      cfg.shapes["crotchet-minim"].lilypondPath = "'((moveto 0.80 -0.0) (closepath))";
      cfg.shapes["crotchet-minim"].lilypondHollowPath = "'( (moveto 2 0)\n(closepath) )";
      const out = CNBLilypond.sectionA(cfg);
      contains(out, "#(define cnb:crotchet-minim-path '(\n    (moveto 0.2 0)\n    (closepath)))");
      contains(out, "#(define cnb:crotchet-minim-cutout-path '(\n    (moveto 0.5 0)\n    (closepath)))");
      lacks(out, "curveto", "pre-baked paths should suppress fallback conversion");
    }},

  { name: "sectionA divides path data by axisUnitsPerStaffSpace under a pitch axis", fn: () => {
      const cfg = spikeAxisConfig(); // axisUnitsPerStaffSpace 2, staff sps 4
      cfg.shapes["crotchet-minim"].lilypondPath = "'((moveto 1 -1) (closepath))";
      contains(CNBLilypond.sectionA(cfg), "#(define cnb:crotchet-minim-path '(\n    (moveto 0.5 -0.5)\n    (closepath)))");
    }},

  { name: "sectionA refuses a pre-baked path that does not parse, naming the field", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].lilypondPath = `'()) (system "calc") (define x '()`;
      let threw = null;
      try { CNBLilypond.sectionA(cfg); } catch (err) { threw = err; }
      assert(threw !== null, "sectionA must throw");
      contains(threw.message, `shapes["crotchet-minim"].lilypondPath`);
    }},

  { name: "emitters: comment fields cannot break out of a %% or ;; comment", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.meta.notationLabel = 'Label\n#(display "X1")';
      cfg.meta.configName = 'Name\r#(display "X2")';
      cfg.durations.definitions[0].name = 'crotchet\n#(display "X4")';
      cfg.noteheadRules.push({ name: "q", priority: 5,
        match: { pitchClasses: [0], durations: [cfg.durations.definitions[0].name], keys: "all" },
        apply: { hollow: true } });
      const out = CNBLilypond.header(cfg) + CNBLilypond.sectionC(cfg);
      for (const line of out.split("\n")) {
        assert(!/^\s*#\(display/.test(line), `no line may start with injected Scheme: ${JSON.stringify(line)}`);
      }
      contains(out, '%% Label #(display "X1") — Generated by Chromatic Configurator');
      contains(out, '%% Source: Name #(display "X2").json');
      contains(out, '(crotchet #(display "X4"))');
    }},

  { name: "emitters: metadata strings stay inside their Scheme string literal", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.meta.notationFootnote = 'a") (display "X") ("';
      contains(CNBLilypond.sectionB(cfg), '  "a\\") (display \\"X\\") (\\"")');
    }},

  { name: "emitters: invalid version, magnify, symbol and number values make export throw naming the field", fn: () => {
      const cases = [
        ["engine.lilypondVersion", (c) => { c.engine.lilypondVersion = '2.24.2"\n#(display "X")'; }, (c) => CNBLilypond.header(c)],
        ["engine.defaultMagnify", (c) => { c.engine.defaultMagnify = '7/4) #(display "X")'; }, (c) => CNBLilypond.sectionB(c)],
        ["engine.indent", (c) => { c.engine.indent = '(display "X")'; }, (c) => CNBLilypond.sectionB(c)],
        ["Shape", (c) => { c.shapes["音符"] = c.shapes["crotchet-minim"]; delete c.shapes["crotchet-minim"];
          for (const r of c.noteheadRules) if (r.apply.shape) r.apply.shape = "音符"; }, (c) => CNBLilypond.sectionA(c)],
      ];
      for (const [field, mutate, emit] of cases) {
        const cfg = colourConfig();
        mutate(cfg);
        let threw = null;
        try { emit(cfg); } catch (err) { threw = err; }
        assert(threw !== null, `${field}: must throw`);
        contains(threw.message, field, `${field}: error names the field`);
      }
    }},

  { name: "emitters: ratio defaultMagnify is re-emitted from its numbers", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.defaultMagnify = "8/5";
      contains(CNBLilypond.sectionB(cfg), "#(set! cnb:default-magnify 8/5)");
    }},

  { name: "baselines: the default config still exports byte-identically to default-export-baseline.ly", fn: () => {
      const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      const baseline = readFileSync(path.join(CNB_DIR, "fixtures", "default-export-baseline.ly"), "utf8");
      eq(normalize(CNBLilypond.generate(CNBConfig.createDefault())), normalize(baseline), "default export");
    }},

  { name: "baselines: the Kite 4-369 export still exports byte-identically to kite-4-369-export-baseline.ly", fn: () => {
      // Captured before session 11's path-unit change: the export set 007
      // matched to the engine's golden score, which the rebuilt fixture must
      // reproduce, except its stem attachments, which since session 40 centre
      // the stems where the SVG's stem rects draw them.
      const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      const baseline = readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-export-baseline.ly"), "utf8");
      const config = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8"));
      eq(normalize(CNBLilypond.generate(config)), normalize(baseline), "Kite export");
    }},

  { name: "baselines: the 45deg-369 export still exports byte-identically to 45deg-369-export-baseline.ly", fn: () => {
      // Exported by cnb/fixtures/export-config.mjs in session 16.
      const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      const baseline = readFileSync(path.join(CNB_DIR, "fixtures", "45deg-369-export-baseline.ly"), "utf8");
      const config = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "45deg-369-config.json"), "utf8"));
      eq(normalize(CNBLilypond.generate(config)), normalize(baseline), "45deg-369 export");
    }},

  { name: "baselines: the Kite 4-369 export carries its toolkit (semitone-unit) paths ÷ sps 3", fn: () => {
      const text = readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8");
      const { config } = CNBConfigIO.loadFromText(text);
      const out = CNBLilypond.generate(config);
      const sps = config.staff.semitonesPerStaffSpace;
      eq(sps, 3, "Kite staff");
      let count = 0;
      for (const [name, shape] of Object.entries(config.shapes)) {
        const sym = _internals.slug(name);
        for (const [key, def] of [["lilypondPath", "path"], ["lilypondHollowPath", "cutout-path"]]) {
          if (!shape[key]) continue;
          const scaled = CNBLilypond.pathToStaffSpace(CNBScheme.parsePath(shape[key]), sps);
          contains(out, `#(define cnb:${sym}-${def} ${scaled})`, `${name} ${key}`);
          count++;
        }
      }
      assert(count >= 2, `expected pre-baked Kite paths, found ${count}`);
      contains(out, "(moveto 0 0.6667)", "kite-up's toolkit (moveto 0 2) at sps 3");
    }},

  { name: "sectionA registers paths and hollow cutouts", fn: () => {
      const out = CNBLilypond.sectionA(CNBConfig.createDefault());
      contains(out, "#(cnb:register-path! 'crotchet-minim cnb:crotchet-minim-path)");
      contains(out, "#(cnb:register-hollow! 'crotchet-minim-cutout cnb:crotchet-minim-cutout-path)");
    }},

  { name: "sectionA omits hollow registration when shape has no hollow path", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].svgHollowPath = null;
      // Default rules mark sharps hollow; drop that rule so the config stays coherent
      cfg.noteheadRules = [cfg.noteheadRules[0]];
      const out = CNBLilypond.sectionA(cfg);
      lacks(out, "register-hollow!");
      lacks(out, "cutout-path");
    }},

  // ── Section A: attachments ─────────────────────────────────────────────────

  { name: "sectionA writes SVG anchors half a stem outward, relative to the registered path's extent (LilyPond's stem-attachment units)", fn: () => {
      // The default shape's path spans about ±172.4 × ±136.2 SVG units (its
      // curves' true extremes). The anchor (146.426, −42.9985) is the stem's
      // centre; LilyPond puts the stem's edge on the attachment point, so x
      // moves outward by half the 0.13-staff-space stem, 0.26 semitones at
      // sps 4: (146.426 + 26) / 172.426 = 1, the notehead's right edge
      // (session 40). Y is 0.3157 of the half height up (session 33, LY spec
      // §4.4b, §4.4c). At sps 3 the half stem is 19.5 units.
      const cfg = CNBConfig.createDefault();
      const out = CNBLilypond.sectionA(cfg);
      contains(out, "#(cnb:register-attachment! 'crotchet-minim-attach");
      contains(out, "(cons 'crotchet-up   '(1 . 0.3157))");
      contains(out, "(cons 'crotchet-down '(-1 . -0.3157))");
      contains(out, "(cons 'minim-up      '(1 . 0.3157))");
      contains(out, "(cons 'minim-down    '(-1 . -0.3157))");
      cfg.staff.semitonesPerStaffSpace = 3;
      contains(CNBLilypond.sectionA(cfg), "(cons 'crotchet-up   '(0.9623 . 0.3157))", "(146.426 + 19.5) / 172.426");
    }},

  { name: "every shipped config that draws the default notehead attaches its stems on its sides, up at x 1, down at x −1 (session 40)", fn: () => {
      // Each gallery file sets the default notehead's anchors for its own
      // staff (its semitones, or axis units, per staff space).
      const gallery = path.join(CNB_DIR, "assets", "examples", "gallery");
      const configs = [["default", CNBConfig.createDefault()],
        ["sized-config.json", JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "sized-config.json"), "utf8"))]];
      for (const f of readdirSync(gallery).filter(n => n.endsWith(".json")).sort()) {
        configs.push([f, CNBConfigIO.loadFromText(readFileSync(path.join(gallery, f), "utf8")).config]);
      }
      const failures = [];
      let checked = 0;
      for (const [label, config] of configs) {
        const block = /#\(cnb:register-attachment! 'crotchet-minim-attach[\s\S]*?\)\)\)\)/.exec(CNBLilypond.sectionA(config));
        if (!block) continue;                       // the default notehead is not drawn
        checked++;
        for (const [key, x] of [["crotchet-up", 1], ["crotchet-down", -1], ["minim-up", 1], ["minim-down", -1]]) {
          const m = new RegExp(`'${key}\\s+'\\((\\S+) \\. `).exec(block[0]);
          if (!m || Number(m[1]) !== x) failures.push(`${label} ${key}: x ${m && m[1]}, want ${x}`);
        }
      }
      assert(checked >= 15, `the default notehead is drawn by ${checked} configs`);
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    }},

  { name: "attachmentPoints measures a curve's true extremes, not its control points", fn: () => {
      // The curve (0,0)→(4,0) with controls at y 4 peaks at y 3, so the
      // extent is x 0…4, y 0…3: (4, 3) is the top-right corner, (2, 1.5) the centre.
      const shape = {
        naturalHeight: 3, semitoneHeight: 3,
        lilypondPath: "'((moveto 0 0) (curveto 0 4 4 4 4 0) (closepath))",
        lilypondAnchors: {
          crotchetUp: { x: 4, y: 3 }, crotchetDown: { x: 2, y: 1.5 },
          minimUp: { x: 0, y: 0 }, minimDown: { x: 3, y: 0.75 },
        },
      };
      // A stem of no thickness (staff space 0), so x reads the anchor alone.
      const pts = _internals.attachmentPoints(shape, null, 0);
      eq(JSON.stringify(pts.crotchetUp), JSON.stringify({ x: 1, y: 1 }), "corner");
      eq(JSON.stringify(pts.crotchetDown), JSON.stringify({ x: 0, y: 0 }), "centre");
      eq(JSON.stringify(pts.minimUp), JSON.stringify({ x: -1, y: -1 }), "origin corner");
      eq(JSON.stringify(pts.minimDown), JSON.stringify({ x: 0.5, y: -0.5 }), "inside");
    }},

  { name: "attachmentPoints moves x half the engine's stem outward (session 40), not scaled with a sized variant", fn: () => {
      // The extent is x −2…2. A staff space of 4 semitones makes half the
      // 0.13 stem 0.26 semitones: an up stem's edge right of the anchor, a
      // down stem's left of it. At scale.x 2 the extent doubles and the half
      // stem does not; y is the anchor's alone.
      const shape = {
        naturalHeight: 4, semitoneHeight: 4,
        lilypondPath: "'((moveto 0 2) (lineto 2 0) (lineto 0 -2) (lineto -2 0) (closepath))",
        lilypondAnchors: {
          crotchetUp: { x: 0, y: 1 }, crotchetDown: { x: 0, y: -1 },
          minimUp: { x: 1, y: 1 }, minimDown: { x: -1, y: -1 },
        },
      };
      const pts = _internals.attachmentPoints(shape, null, 4);
      eq(JSON.stringify(pts.crotchetUp), JSON.stringify({ x: 0.13, y: 0.5 }), "centred up: 0.26 / 2");
      eq(JSON.stringify(pts.crotchetDown), JSON.stringify({ x: -0.13, y: -0.5 }), "centred down");
      eq(JSON.stringify(pts.minimUp), JSON.stringify({ x: 0.63, y: 0.5 }), "(1 + 0.26) / 2");
      const sized = _internals.attachmentPoints(shape, { x: 2, y: 3 }, 4);
      eq(JSON.stringify(sized.crotchetUp), JSON.stringify({ x: 0.065, y: 0.5 }), "sized: 0.26 / 4");
      eq(JSON.stringify(sized.minimUp), JSON.stringify({ x: 0.565, y: 0.5 }), "sized: (2 + 0.26) / 4");
    }},

  { name: "sectionA prefers lilypondAnchors (semitone units), relative to the pre-baked path's extent", fn: () => {
      // Kite values: the kite path spans ±2 semitones each way, so 1.8
      // semitones up is 0.9. X is the anchor moved half the 0.13-staff-space
      // stem outward, 0.195 semitones at sps 3 (session 40): a centred
      // crotchet anchor is ±0.0975, the minim's ∓0.73 is ∓(0.73 − 0.195) / 2.
      const cfg = CNBConfig.createDefault();
      cfg.staff.semitonePattern = [3, 6, 9];
      cfg.staff.semitonesPerStaffSpace = 3;
      cfg.shapes["crotchet-minim"].lilypondPath = "'((moveto 0 2) (lineto 2 1) (lineto 0 -2) (lineto -2 1) (lineto 0 2) (closepath))";
      cfg.shapes["crotchet-minim"].lilypondAnchors = {
        crotchetUp:   { x: 0,     y: 1.8 },
        crotchetDown: { x: 0,     y: -1.8 },
        minimUp:      { x: -0.73, y: 1.8 },
        minimDown:    { x: 0.73,  y: -1.8 },
      };
      const out = CNBLilypond.sectionA(cfg);
      contains(out, "(cons 'crotchet-up   '(0.0975 . 0.9))");
      contains(out, "(cons 'crotchet-down '(-0.0975 . -0.9))");
      contains(out, "(cons 'minim-up      '(-0.2675 . 0.9))");
      contains(out, "(cons 'minim-down    '(0.2675 . -0.9))");
    }},

  { name: "sectionA marks stemless shapes and skips attachment registration", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].anchors = null;
      cfg.shapes["crotchet-minim"].lilypondAnchors = null;
      const out = CNBLilypond.sectionA(cfg);
      contains(out, "%% crotchet-minim: stemless — no attachment registered");
      lacks(out, "register-attachment!");
    }},

  // ── Section A: colors ──────────────────────────────────────────────────────

  { name: "sectionA default config registers only black", fn: () => {
      const out = CNBLilypond.sectionA(CNBConfig.createDefault());
      contains(out, `#(cnb:register-color! 'black-000000 "#000000")`);
      lacks(out, "cnb:use-accessible-colors");
    }},

  { name: "sectionA registers each colour the noteheads use once, named from its hex, with no accessible branch", fn: () => {
      const out = CNBLilypond.sectionA(colourConfig());
      contains(out, `#(cnb:register-color! 'shamrock-1b9e77 "#1B9E77")`);
      contains(out, `#(cnb:register-color! 'cinnamon-d95f02 "#D95F02")`);
      contains(out, `#(cnb:register-color! 'amethyst-7570b3 "#7570B3")`);
      // PCs without a colour rule are black
      contains(out, `#(cnb:register-color! 'black-000000 "#000000")`);
      eq((out.match(/cnb:register-color!/g) || []).length, 4, "each colour once");
      lacks(out, "cnb:use-accessible-colors");
      lacks(out, "#(if");
    }},

  { name: "sectionA registers a colour two rules spell in different cases once", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules.push(
        { name: "F", priority: 2, match: { pitchClasses: [5], durations: "all", keys: "all" }, apply: { color: "#FF0000" } },
        { name: "G", priority: 3, match: { pitchClasses: [7], durations: "all", keys: "all" }, apply: { color: "#ff0000" } });
      const out = CNBLilypond.sectionA(cfg);
      const matches = out.match(/\(cnb:register-color! 'red-ff0000 /g) || [];
      eq(matches.length, 1, "registered once");
      const clauses = parseSectionCClauses(CNBLilypond.sectionC(cfg));
      eq(clauses[5].color, "red-ff0000", "F");
      eq(clauses[7].color, "red-ff0000", "G");
    }},

  { name: "sectionA ignores a palette left in a config (session 37)", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.palette = { name: "Old", colors: [{ pc: 0, hex: "#1B9E77" }], cbSafeColors: [{ pc: 0, hex: "#009F81" }], schemeSymbols: { "#1B9E77": "x" } };
      eq(CNBLilypond.generate(cfg).replace(/^%% Date: .*$/m, ""), CNBLilypond.generate(CNBConfig.createDefault()).replace(/^%% Date: .*$/m, ""), "same as no palette");
    }},

  // ── Section B ──────────────────────────────────────────────────────────────

  { name: "sectionB always emits staff geometry (positions in half-staff-spaces, D2)", fn: () => {
      const out = CNBLilypond.sectionB(CNBConfig.createDefault());
      contains(out, "#(set! cnb:semitones-per-staff-space 4)");
      contains(out, "#(set! cnb:staff-line-positions '(-4 -2 2 4))");
    }},

  { name: "sectionB always emits cnb:use-procedure-model #t (D1 — engine defaults to the vector model)", fn: () => {
      const out = CNBLilypond.sectionB(CNBConfig.createDefault());
      contains(out, "#(set! cnb:use-procedure-model #t)");
    }},

  { name: "sectionB omits all engine settings at their defaults", fn: () => {
      const out = CNBLilypond.sectionB(CNBConfig.createDefault());
      lacks(out, "cnb:false-hollow");
      lacks(out, "cnb:multinote-padding");
      lacks(out, "cnb:multinote-overlap");
      lacks(out, "cnb:default-magnify");
      lacks(out, "cnb:indent");
      lacks(out, "cnb:collision-threshold");
      lacks(out, "cnb:default-staff-line-thickness");
      lacks(out, "cnb:default-staff-line-color");
      lacks(out, "cnb:stem-thickness");
    }},

  { name: "sectionB emits changed engine settings", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.falseHollow = true;
      cfg.engine.defaultMagnify = "3/2";
      cfg.engine.indent = 5;
      cfg.engine.collisionThreshold = 3;
      const out = CNBLilypond.sectionB(cfg);
      contains(out, "#(set! cnb:false-hollow #t)");
      contains(out, "#(set! cnb:default-magnify 3/2)");
      contains(out, "#(set! cnb:indent 5)");
      contains(out, "#(set! cnb:collision-threshold 3)");
    }},

  { name: "sectionB writes cnb:multinote-overlap in repeat mode only; the retired engine.multinotePadding is never written (session 58)", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.multinotePadding = -1;
      lacks(CNBLilypond.sectionB(cfg), "cnb:multinote-overlap", "shape mode");
      lacks(CNBLilypond.sectionB(cfg), "cnb:multinote-padding", "shape mode");
      cfg.durations.representationMode = "repeat";
      let out = CNBLilypond.sectionB(cfg);
      contains(out, "#(set! cnb:multinote-overlap 0.3333)");
      lacks(out, "cnb:multinote-padding");
      cfg.durations.repeatOverlap = 0.25;
      contains(CNBLilypond.sectionB(cfg), "#(set! cnb:multinote-overlap 0.25)");
      cfg.durations.repeatOverlap = 0;
      contains(CNBLilypond.sectionB(cfg), "#(set! cnb:multinote-overlap 0)");
      delete cfg.durations.repeatOverlap;
      contains(CNBLilypond.sectionB(cfg), "#(set! cnb:multinote-overlap 0.3333)", "unset: 1/3");
    }},

  { name: "M1: a set engine.stemThickness is never exported (the engine has no cnb:stem-thickness)", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.engine.stemThickness = 1.5;
      assert(CNBConfig.validate(cfg).valid, "the setting stays valid config");
      lacks(CNBLilypond.generate(cfg), "cnb:stem-thickness");
    }},

  { name: "M2: a config carrying retired staff-line thickness and color (session 34) exports unchanged", fn: () => {
      const cfg = CNBConfig.createDefault();
      const before = CNBLilypond.generate(cfg);
      cfg.staff.lineDefaults = { thicknessPct: 40, color: "#333333" };
      const out = CNBLilypond.generate(cfg);
      lacks(out, "cnb:default-staff-line-thickness");
      lacks(out, "cnb:default-staff-line-color");
      eq(out, before, "staff styling does not reach the export");
    }},

  { name: "sectionB always emits file-suffix and notation-label", fn: () => {
      const out = CNBLilypond.sectionB(CNBConfig.createDefault());
      contains(out, `#(set! cnb:file-suffix "-Default48")`);
      contains(out, `#(set! cnb:notation-label "Default 4-8 System")`);
    }},

  { name: "sectionB emits footnote only when non-empty, with Scheme escaping", fn: () => {
      const cfg = CNBConfig.createDefault();
      let out = CNBLilypond.sectionB(cfg);
      lacks(out, "cnb:notation-footnote");

      cfg.meta.notationFootnote = 'Uses "hollow" sharps';
      out = CNBLilypond.sectionB(cfg);
      contains(out, "#(set! cnb:notation-footnote");
      contains(out, '  "Uses \\"hollow\\" sharps")');
    }},

  // ── Internals ──────────────────────────────────────────────────────────────

  { name: "usedShapes resolves rule-referenced shapes from the default config", fn: () => {
      const shapes = _internals.usedShapes(CNBConfig.createDefault());
      eq(JSON.stringify(shapes), JSON.stringify(["crotchet-minim"]));
    }},

  { name: "usedShapes ignores shapes not present in config.shapes", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules.push({
        name: "Ghost shape",
        priority: 5,
        match: { pitchClasses: [0], durations: "all", keys: "all" },
        apply: { shape: "does-not-exist" },
      });
      const shapes = _internals.usedShapes(cfg);
      eq(JSON.stringify(shapes), JSON.stringify(["crotchet-minim"]));
    }},

  { name: "usedColors lists the distinct non-black rule colours, in first-use order", fn: () => {
      const { colors, hasBlack } = _internals.usedColors(colourConfig());
      eq(colors.length, 3);
      eq(colors[0].hex, "#1B9E77");
      eq(colors[0].symbol, "shamrock-1b9e77");
      assert(!("cbHex" in colors[0]), "no colour-blind twin");
      assert(hasBlack, "PCs 3–11 have no colour rule and should count as black");
    }},

  // ── Section C: procedure structure ─────────────────────────────────────────

  { name: "sectionC emits the procedure scaffolding (set!/lambda/let/cond)", fn: () => {
      const out = CNBLilypond.sectionC(CNBConfig.createDefault());
      contains(out, "SECTION C — CONFIGURATION PROCEDURE");
      contains(out, "#(set! cnb:get-notehead-config");
      contains(out, "(lambda (semitone duration key)");
      contains(out, "(let ((pc (modulo semitone 12)))");
      contains(out, "(cond");
    }},

  { name: "sectionC groups identical configs into memv clauses (default: naturals vs sharps)", fn: () => {
      const out = CNBLilypond.sectionC(CNBConfig.createDefault());
      contains(out, "((memv pc '(0 2 4 5 7 9 11))");
      contains(out, "((memv pc '(1 3 6 8 10))");
      const clauses = parseSectionCClauses(out);
      // Naturals: solid; sharps: hollow via the shape's cutout
      eq(clauses[0].hollow, "#f", "pc 0 solid");
      eq(clauses[1].hollow, "crotchet-minim-cutout", "pc 1 hollow");
      for (let pc = 0; pc < 12; pc++) {
        eq(clauses[pc].shape, "crotchet-minim", `pc ${pc} shape`);
        eq(clauses[pc].color, "black-000000", `pc ${pc} default black`);
        eq(clauses[pc].attachment, "crotchet-minim-attach", `pc ${pc} attachment`);
      }
    }},

  { name: "sectionC uses (= pc N) for single-pc groups", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules.push({
        name: "F is red",
        priority: 2,
        match: { pitchClasses: [5], durations: "all", keys: "all" },
        apply: { color: "#FF0000" },
      });
      const out = CNBLilypond.sectionC(cfg);
      contains(out, "((= pc 5)");
      const clauses = parseSectionCClauses(out);
      eq(clauses[5].color, "red-ff0000");
    }},

  { name: "sectionC resolves rule colours to their scheme symbols", fn: () => {
      const out = CNBLilypond.sectionC(colourConfig());
      const clauses = parseSectionCClauses(out);
      eq(clauses[0].color, "shamrock-1b9e77");
      eq(clauses[1].color, "cinnamon-d95f02");
      eq(clauses[2].color, "amethyst-7570b3");
      eq(clauses[3].color, "black-000000");
    }},

  { name: "sectionC emits hollow #f when the shape has no hollow path", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].svgHollowPath = null;
      const out = CNBLilypond.sectionC(cfg);
      const clauses = parseSectionCClauses(out);
      eq(clauses[1].hollow, "#f", "sharp resolves hollow but shape has no cutout");
    }},

  { name: "sectionC emits attachment #f for stemless shapes", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].anchors = null;
      cfg.shapes["crotchet-minim"].lilypondAnchors = null;
      const out = CNBLilypond.sectionC(cfg);
      const clauses = parseSectionCClauses(out);
      eq(clauses[0].attachment, "#f");
    }},

  { name: "sectionC repeat field follows representationMode", fn: () => {
      const cfg = CNBConfig.createDefault();
      // Default mode is "shape" (distinct shapes per duration) → #f
      contains(CNBLilypond.sectionC(cfg), "(repeat     . #f)");
      lacks(CNBLilypond.sectionC(cfg), "(repeat     . #t)");
      cfg.durations.representationMode = "repeat";
      contains(CNBLilypond.sectionC(cfg), "(repeat     . #t)");
      lacks(CNBLilypond.sectionC(cfg), "(repeat     . #f)");
    }},

  { name: "sectionC emits a fallback else clause closing the procedure", fn: () => {
      const out = CNBLilypond.sectionC(CNBConfig.createDefault());
      contains(out, ";; Fallback");
      contains(out, "(else");
      // else alist ends the cond, let, lambda, and set! forms
      contains(out, "(repeat     . #f)))))))");
    }},

  { name: "sectionC warns and emits no procedure when no rules are defined", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules = [];
      const out = CNBLilypond.sectionC(cfg);
      contains(out, "%% WARNING: No notehead rules defined.");
      lacks(out, "cnb:get-notehead-config");
    }},

  // ── Section C: duration-aware compound conditions ──────────────────────────

  { name: "sectionC default config has no duration conditions (uniform across durations)", fn: () => {
      const out = CNBLilypond.sectionC(CNBConfig.createDefault());
      lacks(out, "(= duration");
    }},

  { name: "sectionC emits compound (and pc duration) clauses for duration-varying pcs", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules.push({
        name: "C is hollow as a minim",
        priority: 2,
        match: { pitchClasses: [0], durations: ["minim"], keys: "all" },
        apply: { hollow: true },
      });
      const out = CNBLilypond.sectionC(cfg);
      // pc 0 varies by duration → one compound clause per duration
      contains(out, "((and (= pc 0) (= duration 3))"); // crotchet: solid
      contains(out, "((and (= pc 0) (= duration 2))"); // minim: hollow
      // remaining naturals stay in a duration-free memv group
      contains(out, "((memv pc '(2 4 5 7 9 11))");
      // the minim clause carries the hollow cutout
      const minimClause = out.slice(out.indexOf("((and (= pc 0) (= duration 2))"));
      contains(minimClause.slice(0, 300), "(hollow     . crotchet-minim-cutout)");
      // the crotchet clause stays solid
      const crotchetClause = out.slice(out.indexOf("((and (= pc 0) (= duration 3))"));
      contains(crotchetClause.slice(0, 300), "(hollow     . #f)");
    }},

  // ── generate ───────────────────────────────────────────────────────────────

  { name: "generate concatenates header, A, B, C in mandatory order", fn: () => {
      const out = CNBLilypond.generate(CNBConfig.createDefault());
      assert(out.startsWith('\\version "2.24.2"'), "file starts with version declaration");
      const iHeader = out.indexOf("Generated by Chromatic Configurator");
      const iA = out.indexOf("SECTION A — NAMED DEFINITIONS");
      const iB = out.indexOf("SECTION B — ENGINE SETTINGS");
      const iC = out.indexOf("SECTION C — CONFIGURATION PROCEDURE");
      assert(iHeader >= 0 && iA > iHeader, "A after header");
      assert(iB > iA, "B after A");
      assert(iC > iB, "C after B");
    }},

  { name: "generate output contains the complete Section C procedure", fn: () => {
      const out = CNBLilypond.generate(CNBConfig.createDefault());
      contains(out, "#(set! cnb:get-notehead-config");
      contains(out, "((memv pc '(0 2 4 5 7 9 11))");
    }},

  { name: "generate throws on blocking validation errors", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.staff.semitonePattern = [4]; // fewer than 2 staff lines
      let threw = false;
      try { CNBLilypond.generate(cfg); } catch (err) {
        threw = true;
        contains(err.message, "export validation");
        contains(err.message, "at least 2 semitone positions");
      }
      assert(threw, "generate should throw on invalid config");
    }},

  { name: "generate throws when a used shape has no path data", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.shapes["crotchet-minim"].svgPath = null;
      cfg.shapes["crotchet-minim"].lilypondPath = null;
      let threw = false;
      try { CNBLilypond.generate(cfg); } catch (err) {
        threw = true;
        contains(err.message, 'Shape "crotchet-minim" has no path data');
      }
      assert(threw, "generate should throw when path data is missing");
    }},

  { name: "sectionC throws when a duration-varying duration lacks lilypondDuration", fn: () => {
      const cfg = CNBConfig.createDefault();
      delete cfg.durations.definitions.find(d => d.name === "minim").lilypondDuration;
      cfg.noteheadRules.push({
        name: "C is hollow as a minim",
        priority: 2,
        match: { pitchClasses: [0], durations: ["minim"], keys: "all" },
        apply: { hollow: true },
      });
      let threw = false;
      try { CNBLilypond.sectionC(cfg); } catch (err) {
        threw = true;
        contains(err.message, 'Duration "minim" has no numeric lilypondDuration');
      }
      assert(threw, "sectionC should refuse to emit a duration-insensitive clause");
    }},

  // ── Clef (session 30, engine handoff 005 §5, LY spec 1.3.7 §5.5) ─────────

  { name: "clef: a config with no clef shown (the default) engraves none — 'none, no registration, no gutter", fn: () => {
      for (const config of [CNBConfig.createDefault(), glyphClefConfig()]) {
        if (config.clef.enabled) config.clef.enabled = false;
        const out = CNBLilypond.generate(config);
        contains(out, "%% Clef\n#(set! cnb:clef-style 'none)", "'none in Section B");
        lacks(out, "cnb:register-clef!", "nothing registered");
        lacks(out, "cnb:clef-gutter-semitones", "no gutter");
      }
    }},

  { name: "clef: a glyph clef is registered (path, anchor, height) and shown as 'custom by name, with its gutter in semitones", fn: () => {
      const config = glyphClefConfig();
      assert(CNBConfig.validate(config).valid, "valid");
      const a = CNBLilypond.sectionA(config);
      const path = CNBLilypond.svgPathToLilypond("M 0 0 L 100 0 L 100 300 L 0 300 Z", 50, 1);
      contains(a, `#(cnb:register-clef! 'express-b\n   (list\n     (cons 'path ${path.replace(/\n/g, "\n       ")})\n` +
        "     (cons 'anchor-semitones 22.784)\n     (cons 'height-semitones 6)))", "registration");
      const b = CNBLilypond.sectionB(config);
      contains(b, "#(set! cnb:clef-style 'custom)\n#(set! cnb:clef-name 'express-b)\n#(set! cnb:clef-gutter-semitones 1.25)",
        "style, name, and 20 px ÷ 16 px per semitone");
      lacks(b, "cnb:clef-size-semitones", "the glyph's own height-semitones sizes it");
    }},

  { name: "clef: a glyph's lilypondPath and colour are carried; on a linear staff the anchor keeps its distance from the midpoint", fn: () => {
      const config = glyphClefConfig({ lilypondPath: "'((moveto 0 0) (lineto 1 3) (closepath))", color: "#1b9e77" });
      const a = CNBLilypond.sectionA(config);
      const baked = CNBScheme.path("'((moveto 0 0) (lineto 1 3) (closepath))", "t").replace(/\n/g, "\n       ");
      contains(a, `(cons 'path ${baked})`, "pre-baked path");
      contains(a, "(cons 'color \"#1b9e77\")))", "colour");
      config.staff.midpoint = 7;   // the engine's middle line is semitone 12 under the treble clef
      contains(CNBLilypond.sectionA(config), "(cons 'anchor-semitones 27.784)", "22.784 − 7 + 12");
      config.clef.glyphs["express-b"].color = "red";
      let threw = null;
      try { CNBLilypond.sectionA(config); } catch (err) { threw = err; }
      assert(threw && /color/.test(threw.message), "a colour that is not #RRGGBB is refused");
    }},

  { name: "clef: under a pitch axis a fractional anchor is used as is (the hook reads Configurator semitones)", fn: () => {
      const config = spikeAxisConfig();
      config.clef = glyphClefConfig().clef;
      config.clef.glyphs["express-b"].anchorSemi = 12.5;
      contains(CNBLilypond.sectionA(config), "(cons 'anchor-semitones 12.5)", "anchor as is");
    }},

  { name: "clef: a text clef is 'text with a markup of its font, colour and bold weight, at its height", fn: () => {
      const config = textClefConfig();
      assert(CNBConfig.validate(config).valid, "valid");
      const b = CNBLilypond.sectionB(config);
      contains(b, "#(set! cnb:clef-style 'text)\n" +
        "#(set! cnb:clef-text (markup #:with-color \"#aa0000\" #:override (cons 'font-name \"Georgia, serif Bold\") \"4\"))\n" +
        "#(set! cnb:clef-size-semitones 4)\n#(set! cnb:clef-gutter-semitones 0.75)", "text clef settings");
      lacks(CNBLilypond.sectionA(config), "cnb:register-clef!", "nothing registered");
      config.clef.glyphs.lbl.text = 'say "hi"';
      contains(CNBLilypond.sectionB(config), '"say \\"hi\\""', "label text is a Scheme string");
    }},

  { name: "clef (engine): a glyph clef on a pitch axis with a fractional anchor engraves its top edge where the preview draws it", fn: async () => {
      // Handoff 008 §5 flag 5. The preview puts the glyph's top at
      // semiToY(anchorSemi), axis position positionOfSemi(anchorSemi).
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const { config } = CNBConfigIO.loadFromText(readFileSync(
        path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json"), "utf8"));
      config.clef = glyphClefConfig().clef;
      config.clef.glyphs["express-b"].anchorSemi = 13.5;   // between C♯ and D an octave up
      const axis = CNBPitchAxis.create(config);
      const units = config.pitchAxis.axisUnitsPerStaffSpace;
      const top = 2 * (axis.positionOfSemi(13.5) - axis.positionOfSemi(config.staff.midpoint)) / units;
      const bottom = top - 2 * 6 / units;
      const { clef, error } = await measureClef(engine, CNBLilypond.generate(config));
      assert(!error, `the export must compile: ${error}`);
      assert(clef, "a clef was engraved");
      assert(Math.abs(clef.top - top) < 0.01, `top ${clef.top} half-staff-spaces, preview ${top}`);
      assert(Math.abs(clef.bottom - bottom) < 0.01, `bottom ${clef.bottom}, preview ${bottom}`);
    }},

  { name: "clef (engine): a text clef engraves at its preview height, and a config with no clef engraves none", fn: async () => {
      // The engine places a text clef at its own height, not at anchorSemi
      // (LY spec 1.3.7 §5.5, a known divergence), so only the height is
      // measured here.
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const config = textClefConfig();
      const { clef, error } = await measureClef(engine, CNBLilypond.generate(config));
      assert(!error, `the export must compile: ${error}`);
      const want = 2 * 4 / config.staff.semitonesPerStaffSpace;
      assert(clef && Math.abs((clef.top - clef.bottom) - want) <= 0.05 * want,
        `height ${clef && clef.top - clef.bottom} half-staff-spaces, preview ${want}`);
      const none = await measureClef(engine, CNBLilypond.generate(CNBConfig.createDefault()));
      assert(!none.error, `the default export must compile: ${none.error}`);
      eq(none.clef, null, "no clef stencil");
    }},

  // ── The clefs the panel offers (session 45, LY spec 1.3.13 §5.5) ──────

  { name: "clef: the dozenal clef exports 'dozenal, its height and its gutter, and registers nothing", fn: () => {
      const config = builtinClefConfig(CNBConfig.createDefault(), "dozenal");
      assert(CNBConfig.validate(config).valid, "valid");
      // Its automatic height (session 59): 3 × the noteheads' 2.724 semitones.
      contains(CNBLilypond.sectionB(config),
        "%% Clef\n#(set! cnb:clef-style 'dozenal)\n#(set! cnb:clef-size-semitones 8.172)\n" +
        "#(set! cnb:clef-gutter-semitones 0.75)", "dozenal settings");
      lacks(CNBLilypond.sectionB(config), "cnb:clef-name", "no name");
      lacks(CNBLilypond.sectionA(config), "cnb:register-clef!", "nothing registered");
    }},

  { name: "clef: the dozenal clef's height is exported as set by hand, or automatic (session 59)", fn: () => {
      const config = builtinClefConfig(CNBConfig.createDefault(), "dozenal");
      config.clef.glyphs.dozenal.semitoneHeight = 10;
      contains(CNBLilypond.sectionB(config), "#(set! cnb:clef-size-semitones 10)", "set by hand");
      const kite = builtinClefConfig(JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8")), "dozenal");
      contains(CNBLilypond.sectionB(kite), "#(set! cnb:clef-size-semitones 9)", "Kite: LilyPond's 3 staff spaces of 3 semitones");
    }},

  { name: "clef: a referenced glyph clef registers its top as drawn, from its anchor, at a set and an automatic height (session 59)", fn: () => {
      // The 300-unit test glyph anchored 100 units below its top, on 20.
      const config = glyphClefConfig({ reference: { x: 50, y: 100 }, anchorSemi: 20 });
      contains(CNBLilypond.sectionA(config),
        "     (cons 'anchor-semitones 22)\n     (cons 'height-semitones 6)))", "6 semitones: the top 2 above the anchor");
      config.clef.glyphs["express-b"].semitoneHeight = 9;
      contains(CNBLilypond.sectionA(config),
        "     (cons 'anchor-semitones 23)\n     (cons 'height-semitones 9)))", "9 semitones, about the anchor");
      // Automatic: 3 staff spaces of 100 units, 2.724 semitones each on the default staff.
      Object.assign(config.clef.glyphs["express-b"], { semitoneHeight: null, staffSpaceUnits: 100 });
      contains(CNBLilypond.sectionA(config),
        `     (cons 'anchor-semitones ${CNBScheme.number(20 + 2.724)})\n` +
        `     (cons 'height-semitones ${CNBScheme.number(3 * 2.724)})))`, "automatic, about the anchor");
      config.staff.midpoint = 7;   // on a linear staff the anchor keeps its distance from the midpoint
      contains(CNBLilypond.sectionA(config), `(cons 'anchor-semitones ${CNBScheme.number(20 + 2.724 - 7 + 12)})`, "converted as before");
    }},

  { name: "clef: a treble clef from the panel exports as a registered glyph, its top and height as placed", fn: () => {
      const config = builtinClefConfig(CNBConfig.createDefault(), "treble");
      // Its top and height as drawn: automatic, its anchor on G (session 59).
      const shown = CNBClef.shown(config);
      const a = CNBLilypond.sectionA(config);
      contains(a, "#(cnb:register-clef! 'treble", "registered");
      contains(a, `(cons 'anchor-semitones ${CNBScheme.number(shown.top)})`, "its top (midpoint 12: as is)");
      contains(a, `(cons 'height-semitones ${CNBScheme.number(shown.height)})`, "its height");
      contains(CNBLilypond.sectionB(config), "#(set! cnb:clef-style 'custom)\n#(set! cnb:clef-name 'treble)", "shown");
    }},

  { name: "clef (engine): the dozenal clef, at its automatic size and one set by hand, engraves where, as tall and as wide as the preview draws it, about the middle line", fn: async () => {
      // The preview draws the engine's numeral 50 (CNBClef.extent,
      // CNBClef.measure), scaled about the middle line (session 59, engine
      // 1.8.0); measureClef reads it in half staff spaces from the middle line.
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const kite = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8"));
      const sized = (base, height) => {
        const config = builtinClefConfig(base, "dozenal");
        config.clef.glyphs.dozenal.semitoneHeight = height;
        return config;
      };
      for (const [label, config] of [
        ["default, automatic (8.172 semitones)", builtinClefConfig(CNBConfig.createDefault(), "dozenal")],
        ["Kite 4-369, automatic (9 semitones)", builtinClefConfig(kite, "dozenal")],
        ["default, 14 semitones set by hand", sized(CNBConfig.createDefault(), 14)],
        ["Kite 4-369, 6 semitones set by hand", sized(kite, 6)],
      ]) {
        const sps = config.staff.semitonesPerStaffSpace;
        const mid = config.staff.midpoint;
        const shown = CNBClef.shown(config);
        const want = CNBClef.extent(config);
        const ly = CNBLilypond.generate(config);
        const { clef, error } = await measureClef(engine, ly);
        assert(!error, `${label}: the export must compile: ${error}`);
        assert(clef, `${label}: a clef was engraved`);
        // In staff spaces from the middle line, the preview's and the engraving's.
        const top = (want.top - mid) / sps, bottom = (want.bottom - mid) / sps;
        assert(Math.abs(clef.top / 2 - top) < 0.001, `${label}: top ${clef.top / 2} staff spaces, preview ${top}`);
        assert(Math.abs(clef.bottom / 2 - bottom) < 0.001, `${label}: bottom ${clef.bottom / 2}, preview ${bottom}`);
        // Its anchor, the middle line, divides it as at LilyPond's 3 staff spaces.
        const height = shown.height / sps;
        assert(Math.abs((clef.top - clef.bottom) / 2 - height) < 0.001,
          `${label}: height ${(clef.top - clef.bottom) / 2} staff spaces, preview ${height}`);
        assert(Math.abs(clef.top / (clef.top - clef.bottom) - 1.4418 / 3) < 0.001,
          `${label}: ${clef.top / (clef.top - clef.bottom)} of it above the middle line, at 3 staff spaces ${1.4418 / 3}`);
        const spacing = await measureSpacing(engine, ly, "c'4");
        assert(!spacing.error, spacing.error);
        const gutter = config.clef.gutter.paddingH / config.display.pxPerSemi / sps;
        const engraved = spacing.clef.right - spacing.clef.left - gutter;
        const drawn = CNBClef.measure(config.clef.glyphs.dozenal, 1 / sps, 1, shown.height).pixelWidth;
        assert(Math.abs(engraved - drawn) < 0.02 * height / 3,
          `${label}: width ${engraved} staff spaces, preview ${drawn}`);
      }
    }},

  { name: "clef (engine): the treble, bass and alto clefs at their automatic size and resized, and a treble moved, engrave over their ranges with each anchor on its pitch", fn: async () => {
      // Each glyph clef's anchor is its line's point (session 59): G for the
      // treble, F for the bass, C for the alto, at reference.y in its SVG.
      // Resized, it keeps that point on its pitch.
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const kite = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8"));
      const resized = (config, height) => {
        const copy = CNBConfig.clone(config);
        copy.clef = CNBClefEditor.withHeight(config.clef, height);
        return copy;
      };
      const cases = [];
      for (const [staff, base] of [["default", CNBConfig.createDefault()], ["Kite 4-369", kite]]) {
        for (const name of ["treble", "bass", "alto"]) {
          const config = builtinClefConfig(base, name);
          cases.push([`${name} on ${staff}, automatic`, config]);
          cases.push([`${name} on ${staff}, resized to 1.5×`, resized(config, CNBClef.shown(config).height * 1.5)]);
          cases.push([`${name} on ${staff}, resized to 10 semitones`, resized(config, 10)]);
        }
      }
      const treble = builtinClefConfig(CNBConfig.createDefault(), "treble");
      const moved = CNBConfig.clone(treble);
      moved.clef = CNBClefEditor.withHeight(CNBClefEditor.withAnchor(treble.clef, 9.5), 12);
      cases.push(["treble moved to 9.5 and resized to 12 semitones", moved]);
      for (const [label, config] of cases) {
        const shown = CNBClef.shown(config);
        const { top, bottom } = CNBClef.extent(config);
        const mid = config.staff.midpoint;
        const sps = config.staff.semitonesPerStaffSpace;
        const { clef, error } = await measureClef(engine, CNBLilypond.generate(config));
        assert(!error, `${label}: the export must compile: ${error}`);
        assert(clef, `${label}: a clef was engraved`);
        assert(Math.abs(clef.top / 2 - (top - mid) / sps) < 0.001,
          `${label}: top ${clef.top / 2} staff spaces, preview ${(top - mid) / sps}`);
        assert(Math.abs(clef.bottom / 2 - (bottom - mid) / sps) < 0.001,
          `${label}: bottom ${clef.bottom / 2}, preview ${(bottom - mid) / sps}`);
        // The anchor, read from the engraved edges at its place in the glyph.
        const def = shown.def;
        const depth = (def.reference.y - (def.viewBoxMinY || 0)) / def.naturalHeight;
        const anchor = clef.top / 2 - depth * (clef.top - clef.bottom) / 2;
        const pitch = (def.anchorSemi - mid) / sps;
        assert(Math.abs(anchor - pitch) < 0.001,
          `${label}: anchor ${anchor} staff spaces, its pitch (semitone ${def.anchorSemi}) ${pitch}`);
      }
    }},

  // ── Key signature (session 30, engine handoff 006 §3, LY spec 1.3.7 §5.6) ─

  { name: "key signature: 'none unless keys and the signature are both on (the default included)", fn: () => {
      contains(CNBLilypond.sectionB(CNBConfig.createDefault()), "%% Key signature\n#(set! cnb:keysig-style 'none)", "default");
      const keysOff = keySignatureConfig();
      keysOff.keys.enabled = false;
      contains(CNBLilypond.sectionB(keysOff), "#(set! cnb:keysig-style 'none)", "keys off");
      const sigOff = keySignatureConfig();
      sigOff.keys.keySignature.enabled = false;
      contains(CNBLilypond.sectionB(sigOff), "#(set! cnb:keysig-style 'none)", "signature off");
      // A signature on at the engine's defaults writes nothing at all.
      lacks(CNBLilypond.sectionB(keySignatureConfig()), "keysig", "the engine's 'chord and default bar");
    }},

  { name: "key signature: the bar's colour, thickness (pct ÷ (10 × sps)) and extent are written when they differ from the engine's", fn: () => {
      const config = keySignatureConfig();
      assert(CNBConfig.validate(config).valid, "valid");
      Object.assign(config.keys.keySignature.separator, { color: "#123ABC", thicknessPct: 80, extentSemis: 6 });
      contains(CNBLilypond.sectionB(config), "%% Key signature\n#(set! cnb:keysig-bar-color \"#123ABC\")\n" +
        "#(set! cnb:keysig-bar-thickness 2)\n#(set! cnb:keysig-bar-extent-semis 6)", "80 ÷ (10 × 4) = 2");
      config.staff.semitonesPerStaffSpace = 3;
      config.keys.keySignature.separator.thicknessPct = 160;
      contains(CNBLilypond.sectionB(config), "#(set! cnb:keysig-bar-thickness 5.3333)", "the default 160% at sps 3 is not the engine's 4");
      config.keys.keySignature.separator.enabled = false;
      contains(CNBLilypond.sectionB(config), "#(set! cnb:keysig-bar-thickness 0)", "a separator that is off draws a zero-width bar");
      config.keys.keySignature.separator.color = "gold";
      let threw = null;
      try { CNBLilypond.sectionB(config); } catch (err) { threw = err; }
      assert(threw && /separator\.color/.test(threw.message), "a colour that is not #RRGGBB is refused");
    }},

  { name: "key signature: an explicit tonic octave is written as is on a linear staff; automatic writes none", fn: () => {
      const config = keySignatureConfig();
      lacks(CNBLilypond.sectionB(config), "cnb:keysig-tonic-octave", "automatic: the engine's own octave");
      config.keys.keySignature.placement.tonicOctave = 2;
      contains(CNBLilypond.sectionB(config), "#(set! cnb:keysig-tonic-octave 2)", "explicit, no offset");
      const axis = spikeAxisConfig();
      axis.keys = keySignatureConfig().keys;
      axis.keys.keySignature.placement.tonicOctave = 2;
      const b = CNBLilypond.sectionB(axis);
      eq(b.split("cnb:keysig-tonic-octave").length, 2, "under an axis it is written once, by the axis block");
    }},

  // ── The mark table (session 49, engine handoff 030, LY spec 1.3.15 §5.6a) ─

  { name: "mark table: today's signature exports as before, a stored but unused setting included", fn: () => {
      const today = CNBLilypond.generate(keySignatureConfig());
      const config = keySignatureConfig();
      // Under "degrees" every key has two stacks: the shared thickness never applies.
      config.keys.keySignature.separator.shareThickness = false;
      config.keys.keySignature.looks = { all: { shape: undefined }, flat: {}, sharp: {} };
      eq(_internals.markTable(config).length, 0, "no table");
      eq(CNBLilypond.generate(config), today, "byte for byte");
      lacks(today, "'marks", "'chord");
    }},

  { name: "mark table: any other signature writes 'marks and 105 keys, told apart by tonic and spelling", fn: () => {
      for (const change of [
        ks => { ks.stacking = "parity"; },
        ks => { ks.stacking = "parity-stacks"; },
        ks => { ks.stacking = "parity-zigzag"; },
        ks => { ks.upperTonic = false; },
        ks => { ks.notes = "tonic-and-half-steps"; },
        ks => { ks.columns = "left-in-sharp-keys"; },
        ks => { ks.placement.position = "every-set"; },
        ks => { ks.looks.flat = { hollow: true }; },
        ks => { ks.alternate = { color: "#cc79a7" }; },
      ]) {
        const config = keySignatureConfig();
        change(config.keys.keySignature);
        const b = CNBLilypond.sectionB(config);
        contains(b, "%% Key signature\n#(set! cnb:keysig-style 'marks)", String(change));
        eq(b.split("\n     (((").length - 1, 105, `${change}: 15 spellings × 7 modes`);
        lacks(b, "cnb:keysig-bar", "the bars are the table's");
      }
      const config = keySignatureConfig();
      config.keys.keySignature.stacking = "parity";
      const b = CNBLilypond.sectionB(config);
      contains(b, ";; C major\n     (((0 . 0) . (0 2 4 5 7 9 11))", "C major");
      contains(b, ";; A minor\n     (((5 . 0) . (0 2 4 5 7 9 11))", "A minor: the same pitch classes, another tonic");
      contains(b, ";; F♯ major\n     (((3 . 1/2) . (1 3 5 6 8 10 11))", "F♯ major");
      contains(b, ";; G♭ major\n     (((4 . -1/2) . (1 3 5 6 8 10 11))", "G♭ major: the same pitch classes, another spelling");
    }},

  { name: "mark table: each entry is CNBKeySignature.marks for the key the canvas's picker gives", fn: () => {
      const config = keySignatureConfig();
      Object.assign(config.keys.keySignature, { stacking: "parity-stacks", upperTonic: false });
      config.keys.keySignature.looks.sharp = { color: "#cc79a7" };
      config.noteheadRules.push({ name: "G is red", priority: 9,
        match: { pitchClasses: [7], durations: "all", keys: ["G"] }, apply: { color: "#ff0000" } });
      const table = _internals.markTable(config);
      eq(table.length, 105, "entries");
      for (const e of table) {
        const tonic = CNBKeySignature.parseTonicPc(e.spelling);
        const picked = CNBPreviewDisplay.withKey(config, { tonic, mode: e.mode, spelling: e.spelling });
        const def = CNBKeySignature.activeKey(picked.config, picked.name).def;
        eq(JSON.stringify(e.sig), JSON.stringify(CNBKeySignature.marks(picked.config, def)), `${e.spelling} ${e.mode}`);
        eq(e.pcs.join(" "), CNBMusic.scale(tonic, e.mode).sort((a, b) => a - b).join(" "), "sorted pitch classes");
      }
      // The written entry carries those columns, bars and marks.
      const g = table.find(e => e.spelling === "G" && e.mode === "major").sig;
      const b = CNBLilypond.sectionB(config);
      const start = b.indexOf(";; G major");
      const entry = b.slice(start, b.indexOf(";; ", start + 1));
      contains(entry, `(columns ${g.columns.map(x => _internals.fmtNum(x)).join(" ")})`, "columns");
      for (const bar of g.bars) {
        contains(entry, `(${_internals.fmtNum(bar.x)} ${bar.bottom} ${bar.top} "${bar.color}" ${_internals.fmtNum(bar.thickness)})`, "bar");
      }
      contains(entry, "(7 0 head crotchet-minim #f red-ff0000)", "G in G, coloured by its key-scoped rule");
      contains(entry, "crotchet-minim-cutout puce-cc79a7)", "F♯, the sharp look");
      eq(entry.split(" head ").length - 1, g.marks.length, "every mark");
    }},

  { name: "mark table: Section A registers the shapes, sizes and colours only the signature's looks use", fn: () => {
      const config = keySignatureConfig();
      config.keys.keySignature.looks.flat = { color: "#0072b2", heightSemis: 2 };
      const out = CNBLilypond.generate(config);
      contains(out, "#(cnb:register-path! 'crotchet-minim-h2-w", "the sized variant");
      contains(out, "#(cnb:register-color! 'cerulean-0072b2 \"#0072b2\")", "the flats' colour");
      contains(out, " head crotchet-minim-h2-w", "named in the table");
      lacks(CNBLilypond.generate(keySignatureConfig()), "-h2-w", "registered only when used");
    }},

  // Engine-backed (session 49): the mark table engraves what the canvas
  // draws. For the default config and the Clairnote DN gallery file, under
  // each setting, in D major, B♭ major and C major (key changes in one
  // score), every mark's height, column and look (size, fill and colour),
  // every bar and the signature's ink are held to the preview's within 0.001
  // staff spaces, and again at other magnifications, which a plain score
  // engraves since engine 1.5.0 (before it, these ran at 7/4: session 52),
  // and under a staff's own \magnifyStaff. Since engine 1.4.1
  // (engine session 33) the signature's heads take the notation's ledgers, so
  // every stack's ledgers are held to the canvas's and the ink is compared
  // in every signature (session 50).
  { name: "mark table (engine): every mark, bar and the signature's ink engrave where the preview draws them, at any magnification", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      // The DN noteheads under the default signature, whose settings each
      // run changes: the file's own Clairnote signature (session 50) has its
      // round trip below.
      const dn = () => {
        const config = CNBConfigIO.loadFromText(readFileSync(
          path.join(CNB_DIR, "assets", "examples", "gallery", "clairnote-dn.json"), "utf8")).config;
        config.keys.keySignature = { ...CNBConfig.createDefault().keys.keySignature, enabled: true };
        return config;
      };
      const settings = [
        ["degrees, no upper tonic", ks => { ks.upperTonic = false; }],
        ["parity", ks => { ks.stacking = "parity"; }],
        ["parity-stacks", ks => { ks.stacking = "parity-stacks"; }],
        ["parity-zigzag", ks => { ks.stacking = "parity-zigzag"; }],
        ["the tonic and the half steps", ks => { ks.notes = "tonic-and-half-steps"; }],
        ["the bottom line set", ks => { ks.placement.position = "bottom-set"; }],
        ["the top line set", ks => { ks.placement.position = "top-set"; }],
        ["every line set", ks => { ks.placement.position = "every-set"; }],
        ["several gold stems, unshared", ks => {
          ks.stacking = "parity-stacks";
          Object.assign(ks.separator, { shareThickness: false, color: "#123abc", thicknessPct: 80 });
        }],
        ["looks", ks => {
          ks.looks.flat = { color: "#0072b2" };
          ks.looks.sharp = { hollow: true };
          ks.alternate = { color: "#cc79a7" };
        }],
      ];
      const runs = [];
      for (const [name, base] of [["default", () => keySignatureConfig()], ["clairnote-dn", dn]]) {
        for (const [label, change] of settings) {
          const config = base();
          change(config.keys.keySignature);
          runs.push({ label: `${name}, ${label}`, config, music: "" });
        }
      }
      for (const magnify of ["1", "5/2"]) {
        for (const stacking of ["parity-stacks", "parity"]) {
          const config = keySignatureConfig();
          config.keys.keySignature.stacking = stacking;
          config.engine.defaultMagnify = magnify;
          runs.push({ label: `default, ${stacking}, magnify ${magnify}`, config, music: "" });
        }
      }
      const small = keySignatureConfig();
      small.keys.keySignature.placement.position = "every-set";
      runs.push({ label: "default, every line set, \\magnifyStaff 2/3", config: small, music: "\\magnifyStaff #2/3 " });

      const keys = [["d", "major", "D"], ["bes", "major", "B♭"], ["c", "major", "C"]];
      const failures = [];
      let inkCompared = 0;
      let inkPastMarks = 0;
      const near = (a, b) => Math.abs(a - b) < 1e-3;
      const results = [];
      for (let i = 0; i < runs.length; i += 4) {   // four compiles at a time
        results.push(...await Promise.all(runs.slice(i, i + 4).map(run => {
          const ly = CNBLilypond.generate(run.config);
          const music = run.music + keys.map(([t, mode]) => `\\key ${t} \\${mode} c'1`).join(" ");
          return measureKeySignatureMarks(engine, ly, music).then(got => ({ run, ly, got }));
        })));
      }
      for (const { run, ly, got } of results) {
        const { label, config } = run;
        if (got.error) { failures.push(`${label}: ${got.error.slice(0, 400)}`); continue; }
        if (got.signatures.length !== keys.length) { failures.push(`${label}: ${got.signatures.length} signatures engraved`); continue; }
        const table = _internals.markTable(config);
        const space = CNBStaff.staffSpacePx(config, { pxPerSemi: 1, axis: CNBPitchAxis.create(config) });
        const movetos = sym => {
          const m = new RegExp(`#\\(define cnb:${sym}-path ([\\s\\S]*?)\\n\\n`).exec(ly);
          return m ? (m[1].match(/moveto/g) || []).length : 0;
        };
        keys.forEach(([, mode, spelling], k) => {
          const where = `${label}, ${spelling} ${mode}`;
          const sig = table.find(e => e.spelling === spelling && e.mode === mode).sig;
          const engraved = got.signatures[k];
          const seen = new Set();
          const heads = engraved.paths.filter(p => {
            if (p.color.every(c => c === 1)) return false;        // a false hollow's white overlay
            const id = [...p.x, ...p.y].map(v => v.toFixed(4)).join(" ");
            return seen.has(id) ? false : (seen.add(id), true);
          });
          if (heads.length !== sig.marks.length) failures.push(`${where}: ${heads.length} heads engraved, ${sig.marks.length} drawn`);
          const width = sig.columns.length > 0 ? 2 * sig.columns[0] : 0;   // a stack's width
          for (const { semi, column, mark } of sig.marks) {
            const x = sig.columns[column];
            const y = CNBStaff.lilypondPosition(config, semi) / 2;
            const h = heads.find(p => near((p.x[0] + p.x[1]) / 2, x) && near((p.y[0] + p.y[1]) / 2, y));
            if (!h) { failures.push(`${where}: no head at column ${column} (${x}), semitone ${semi} (${y})`); continue; }
            const size = CNBNotehead.measure(config.shapes[mark.shape], 1, mark);
            if (!near(h.x[1] - h.x[0], size.pixelWidth / space) || !near(h.y[1] - h.y[0], size.pixelHeight / space)) {
              failures.push(`${where}: semitone ${semi} engraved ${h.x[1] - h.x[0]} × ${h.y[1] - h.y[0]}, drawn ${size.pixelWidth / space} × ${size.pixelHeight / space}`);
            }
            const rgb = [1, 3, 5].map(j => parseInt(mark.color.slice(j, j + 2), 16) / 255);
            if (!rgb.every((c, j) => Math.abs(c - h.color[j]) < 1e-3)) failures.push(`${where}: semitone ${semi} colour ${h.color}, drawn ${mark.color}`);
            const f = _internals.sectionCFields(config, mark);
            const subpaths = movetos(f.shapeSym) + (f.hollowSym === "#f" ? 0 : movetos(`${f.shapeSym}-cutout`));
            if (h.subpaths !== subpaths) failures.push(`${where}: semitone ${semi} has ${h.subpaths} subpaths, ${mark.hollow ? "hollow" : "solid"} wants ${subpaths}`);
          }
          const bars = engraved.lines.filter(l => near(l.x1, l.x2)).sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
          const drawnBars = sig.bars.map(b => ({ x: b.x, bottom: CNBStaff.lilypondPosition(config, b.bottom) / 2,
            top: CNBStaff.lilypondPosition(config, b.top) / 2, b })).sort((a, b) => a.x - b.x || a.bottom - b.bottom);
          if (bars.length !== drawnBars.length) failures.push(`${where}: ${bars.length} bars engraved, ${drawnBars.length} drawn`);
          drawnBars.forEach((d, j) => {
            const e = bars[j];
            if (!e) return;
            const rgb = [1, 3, 5].map(n => parseInt(d.b.color.slice(n, n + 2), 16) / 255);
            if (!near(e.x1, d.x) || !near(Math.min(e.y1, e.y2), d.bottom) || !near(Math.max(e.y1, e.y2), d.top) ||
                !near(e.thickness, d.b.thickness) || !rgb.every((c, n) => Math.abs(c - e.color[n]) < 1e-3)) {
              failures.push(`${where}: bar ${j} engraved ${JSON.stringify(e)}, drawn ${JSON.stringify(d)}`);
            }
          });
          // The ledgers, by stack: the engine's and the canvas's.
          const ledgers = engraved.lines.filter(l => near(l.y1, l.y2));
          for (const l of ledgers) {
            if (!near(l.x2 - l.x1 + l.thickness, width * 4 / 3 + 0.2)) failures.push(`${where}: a ledger ${l.x2 - l.x1 + l.thickness} long, drawn ${width * 4 / 3 + 0.2}`);
          }
          // Since engine 1.4.1 every stack's ledgers are the canvas's (session 50).
          const stackOf = l => sig.columns.findIndex(c => near((l.x1 + l.x2) / 2, c));
          const drawnLedgers = c => {
            const semis = sig.marks.filter(m => m.column === c).map(m => m.semi);
            return semis.length === 0 ? [] : CNBLedgerSet.ledgersFor(config, semis,
              { minSemi: Math.min(...semis) - 12, maxSemi: Math.max(...semis) + 12 }, CNBPitchAxis.create(config))
              .map(s => CNBStaff.lilypondPosition(config, s) / 2);
          };
          sig.columns.forEach((_, c) => {
            const engravedYs = [...new Set(ledgers.filter(l => stackOf(l) === c).map(l => l.y1.toFixed(3)))].sort();
            const drawnYs = [...new Set(drawnLedgers(c).map(y => y.toFixed(3)))].sort();
            if (engravedYs.join(" ") !== drawnYs.join(" ")) {
              failures.push(`${where}: stack ${c} engraved ledgers at ${engravedYs.join(" ") || "none"}, drawn at ${drawnYs.join(" ") || "none"}`);
            }
          });
          if (ledgers.some(l => stackOf(l) < 0)) failures.push(`${where}: a ledger under no stack`);
          const drawnLedgered = c => drawnLedgers(c).length > 0;
          const last = sig.columns.length - 1;
          inkCompared++;
          if (drawnLedgered(0) || drawnLedgered(last)) inkPastMarks++;
          const overhang = width / 6 + 0.1;
          const left = drawnLedgered(0) ? -overhang : 0;
          const right = sig.columns.length * width + (drawnLedgered(last) ? overhang : 0);
          if (!near(engraved.x[0], left) || !near(engraved.x[1], right)) {
            failures.push(`${where}: ink ${engraved.x[0]} … ${engraved.x[1]}, drawn ${left} … ${right}`);
          }
        });
      }
      assert(inkCompared === runs.length * keys.length && inkPastMarks >= 1,
        `the ink was compared in only ${inkCompared} signatures, ${inkPastMarks} with a ledger past the marks`);
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    }},

  // Session 64: the Clairnote SN and DN gallery files' mark tables, pinned
  // byte for byte as their looks by layer exported them, so that redrawn
  // with spelled looks (step-by-step design §3.3, §3.5) they export as before.
  { name: "mark table: the Clairnote SN and DN gallery files export the mark tables they did before their spelled looks", fn: () => {
      const table = ly => {
        const start = ly.indexOf("#(set! cnb:keysig-style 'marks)");
        assert(start >= 0, "a mark table");
        const end = ly.indexOf("\n     ))", start) + "\n     ))".length;
        return ly.slice(start, end);
      };
      for (const [file, hash] of [
        ["clairnote-sn", "00f04fb53d676dd9e1369bd98b2a12fd2daa60eccd0e2ce20639dbde74e2bda5"],
        ["clairnote-dn", "00f04fb53d676dd9e1369bd98b2a12fd2daa60eccd0e2ce20639dbde74e2bda5"],
      ]) {
        const config = CNBConfigIO.loadFromText(
          readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", `${file}.json`), "utf8")).config;
        eq(createHash("sha256").update(table(CNBLilypond.generate(config))).digest("hex"), hash, `${file}: its mark table`);
      }
    }},

  // Session 64 (step-by-step design §3.5): the mark table writes what
  // CNBKeySignature.marks gives for spelled looks and a column gap, in the
  // table's format (LY spec §5.6a, unchanged).
  { name: "mark table: a spelled look and a column gap are written as CNBKeySignature.marks gives them", fn: () => {
      const config = keySignatureConfig();
      config.shapes.ring = CNBConfig.clone(config.shapes["crotchet-minim"]);
      config.keys.keySignature.looks.spelled = { "C♯": { shape: "ring" }, "D♭": { color: "#0000ff" } };
      config.keys.keySignature.columnGap = -0.5;
      const ly = CNBLilypond.generate(config);
      contains(ly, "#(set! cnb:keysig-style 'marks)", "the mark table, not the scale stack");
      contains(ly, "cnb:register-path! 'ring", "the spelled look's shape registered");
      contains(ly, "#(cnb:register-color! 'blue-0000ff", "and its colour");
      const keyOf = (spelling, mode) => CNBKeySignature.keys(config).find(e => e.spelling === spelling && e.mode === mode).def;
      const entry = (spelling, mode) => {
        const start = ly.indexOf(`     ;; ${spelling} ${mode}\n`);
        assert(start >= 0, `${spelling} ${mode}'s entry`);
        return { sig: CNBKeySignature.marks(config, keyOf(spelling, mode)), text: ly.slice(start, ly.indexOf("\n     ;;", start + 1)) };
      };
      const d = entry("D", "major");
      contains(d.text, `(columns ${d.sig.columns.map(x => _internals.fmtNum(x)).join(" ")})`, "D major's columns, the gap's");
      assert(/\(\d+ \d+ head ring \S+ black-000000\)/.test(d.text), "D major's C♯ the ring");
      lacks(d.text, "blue-0000ff", "no D♭ in D major");
      const db = entry("D♭", "major");
      assert(/\(\d+ \d+ head crotchet-minim \S+ blue-0000ff\)/.test(db.text), "D♭ major's D♭ blue");
      lacks(db.text, "ring", "no C♯ in D♭ major");
      const plain = CNBKeySignature.marks(keySignatureConfig(), keyOf("D", "major"));
      const closer = (plain.columns[1] - plain.columns[0]) - (d.sig.columns[1] - d.sig.columns[0]);
      assert(Math.abs(closer - 0.5 / 4) < 1e-9, `the columns closer by the gap, 0.125 staff spaces: ${closer}`);
    }},

  // Engine-backed (session 55, LY spec 1.3.19 §5.6a, engine 1.6.0; it
  // replaces session 50's Clairnote round trip, which held box-centred marks):
  // the model's mark table engraves what the canvas draws. In C, D, B♭, A and
  // E♭ major, every symbol of every mark (each base and added symbol, heads,
  // symbols and signs), every stack's ledgers and the ink are held to the
  // canvas's within 0.001 staff spaces (holdMarkTable), for the default and
  // Kite 4-369; the Clairnote SN and DN gallery files' own signatures, dots
  // with tails placed by their reference points; the traditional starting
  // point on the bottom line set and on every line set, where two line sets'
  // copies meet; an asymmetric head with a reference point; offsets in x and
  // in y; added symbols at sizes other than their shape's own; a hollow base
  // whose shape takes no ledgers; coloured and moved signs; the Twinline
  // pitch axis; and (session 64) spelled looks over the line and space looks,
  // and a negative column gap, on the default staff and Clairnote SN's.
  { name: "mark table (engine): the model's symbols — placed, sized, coloured and layered — engrave where the canvas draws them", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const keys = [["c", "major", "C"], ["d", "major", "D"], ["bes", "major", "B♭"], ["a", "major", "A"], ["ees", "major", "E♭"]];
      const load = (...p) => CNBConfigIO.loadFromText(readFileSync(path.join(CNB_DIR, ...p), "utf8")).config;
      const keysOn = config => {
        config.keys.enabled = true;
        config.keys.definitions = [{ name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11] }];
        config.keys.keySignature = { ...CNBConfig.createDefault().keys.keySignature, enabled: true };
        return config;
      };
      const base = () => keySignatureConfig();
      const runs = [];
      const run = (label, config, change) => { change(config.keys.keySignature, config); runs.push({ label, config }); };

      run("default, solid on a line, hollow in a space", base(), ks => {
        ks.looks.line = { hollow: false };
        ks.looks.space = { hollow: true };
      });
      run("Kite 4-369, sharps with a small added kite", keysOn(load("fixtures", "kite-4-369-config.json")), ks => {
        ks.looks.sharp = { added: [{ shape: "kite-up", heightSemis: 1, widthSemis: 1, offset: { x: 1.6, y: 0.5 } }] };
      });
      for (const file of ["clairnote-sn", "clairnote-dn"]) runs.push({ label: file, config: load("assets", "examples", "gallery", `${file}.json`) });
      for (const position of ["bottom-set", "every-set"]) {
        run(`traditional, ${position}`, base(), (ks, config) => { traditional(config); config.keys.keySignature.placement.position = position; });
      }
      run("an asymmetric head placed by its reference point", base(), (ks, config) => {
        // A one-sided quadrilateral whose reference point is off its box's centre.
        config.shapes.wedge = { displayName: "Wedge", svgPath: "M -60 -50 L 140 -20 L 60 60 L -60 40 Z", svgHollowPath: null,
          naturalHeight: 110, naturalWidth: 200, semitoneHeight: 2, anchors: null, lilypondPath: null,
          lilypondHollowPath: null, lilypondAnchors: null, reference: { x: -20, y: 10 } };
        ks.looks.all = { shape: "wedge" };
        ks.placement.position = "every-set";
      });
      run("offsets in x and in y", base(), ks => {
        ks.looks.flat = { offset: { x: 0.5, y: 0.75 } };
        ks.looks.sharp = { offset: { x: -0.4, y: -0.6 } };
        ks.looks.natural = { offset: { x: 0, y: 0.3 } };
        ks.placement.position = "bottom-set";
      });
      run("added symbols of other sizes", base(), ks => {
        ks.looks.all = { added: [
          { shape: "crotchet-minim", heightSemis: 1, widthSemis: 1.5, offset: { x: 1.6, y: 0.5 } },
          { shape: "crotchet-minim", heightSemis: 0.6, offset: { x: -1.5, y: -0.5 } }] };
        ks.looks.flat = { color: "#0072b2" };
      });
      run("a hollow base whose shape takes no ledgers", base(), (ks, config) => {
        config.shapes.ring = { ...CNBConfig.clone(config.shapes["crotchet-minim"]), ledgers: false };
        ks.looks.all = { shape: "ring", hollow: true };
        ks.looks.flat = { shape: "crotchet-minim" };
        ks.placement.position = "bottom-set";
      });
      run("coloured and moved signs", base(), (ks, config) => {
        traditional(config);
        ks.looks.sharp = { sign: "sharp", color: "#cc0000", offset: { x: 0.3, y: 0.5 } };
        ks.looks.flat = { sign: "flat", color: "#0072b2", offset: { x: 0, y: -0.5 } };
      });
      run("the Twinline pitch axis", keysOn(load("assets", "examples", "gallery", "twinline-compact.json")), ks => {
        ks.looks.sharp = { added: [{ shape: "crotchet-minim", heightSemis: 0.8, offset: { x: 1.2, y: -0.4 } }] };
        ks.looks.flat = { offset: { x: 0.3, y: 0.4 } };
      });
      // Session 64 (step-by-step design §3.5): spelled looks over the line and
      // space looks, and a negative column gap.
      run("spelled looks", base(), (ks, config) => {
        config.shapes.ring = { ...CNBConfig.clone(config.shapes["crotchet-minim"]), ledgers: false };
        ks.looks.line = { hollow: false };
        ks.looks.space = { hollow: true };
        ks.looks.spelled = {
          "F♯": { shape: "ring", color: "#cc0000" },
          "C♯": { added: [{ shape: "crotchet-minim", heightSemis: 0.8, offset: { x: 1.2, y: 0.4 } }] },
          "B♭": { hollow: false, color: "#0072b2", offset: { x: 0.3, y: 0 } },
          "A♯": { color: "#00aa00" },
        };
      });
      run("a negative column gap", base(), ks => {
        ks.columnGap = -0.75;
        ks.placement.position = "bottom-set";
      });
      run("Clairnote SN with a negative column gap", load("assets", "examples", "gallery", "clairnote-sn.json"), ks => {
        ks.columnGap = -0.5;
      });

      const { failures, symbols } = await holdMarkTable(engine, runs, keys);
      if (failures.length > 0) throw new Error(failures.join("\n    "));
      assert(symbols.head > 0 && symbols.symbol > 0 && symbols.sign > 0, `every kind compared: ${JSON.stringify(symbols)}`);
    }},

  // ─── Accidentals (session 51, LY spec 1.3.17) ─────────────────────────────

  { name: "mark table: accidentals write each sign as (semi column sharp) or (semi column flat), register nothing and add no ledger entry", fn: () => {
      const entry = (out, name) => {
        const m = new RegExp(`;; ${name}\\n([\\s\\S]*?)(?=\\n     ;;|\\n     \\)\\))`).exec(out);
        assert(m, `${name} has an entry`);
        return m[1];
      };
      const config = keySignatureConfig();
      traditional(config);
      const out = CNBLilypond.generate(config);
      contains(out, "#(set! cnb:keysig-style 'marks)", "the mark table");
      eq(entry(out, "C major"), "     (((0 . 0) . (0 2 4 5 7 9 11))\n      . ((columns)\n         (bars)\n         (marks)))",
        "C major: no signs");
      // Each sign at its scale (session 52, engine 1.5.0): automatic, 2.724
      // semitones between a sharp's bars, so 0.6473 of LilyPond's size.
      contains(entry(out, "D major"), "(columns 0.356 1.0681)", "D major's columns, the scaled sharp's width apart");
      contains(entry(out, "D major"), "(marks (6 0 sharp 0.6473)\n                (13 1 sharp 0.6473))", "F♯ C♯ at the notes they make, at their scale");
      contains(entry(out, "B♭ major"), "(columns 0.2925 0.8775)", "B♭ major's columns, emmentaler-26's scaled flat apart");
      contains(entry(out, "B♭ major"), "(marks (10 0 flat 0.6473)\n                (15 1 flat 0.6473))", "B♭ E♭ from the tonic B♭ at 10");
      // A size set by hand: 5 semitones, 5 / 1.052 / 4 of LilyPond's size.
      const big = CNBConfig.clone(config);
      big.keys.keySignature.signs = { heightSemis: 5 };
      contains(entry(CNBLilypond.generate(big), "D major"), "(marks (6 0 sharp 1.1882)\n                (13 1 sharp 1.1882))", "5 semitones set by hand");
      // A size whose scale is 1 writes none, as an engine before 1.5.0 reads it.
      const full = CNBConfig.clone(config);
      full.keys.keySignature.signs = { heightSemis: 1.052 * 4 };
      const fullOut = CNBLilypond.generate(full);
      contains(entry(fullOut, "D major"), "(columns 0.55 1.65)", "LilyPond's size: a sharp's width apart");
      contains(entry(fullOut, "D major"), "(marks (6 0 sharp)\n                (13 1 sharp))", "scale 1: no fourth element");
      const table = out.slice(out.indexOf("cnb:keysig-marks"));
      lacks(table.slice(0, table.indexOf("\n\n")), " head ", "no heads");

      // Every line set: two copies, each from column 0; their marks beyond
      // the cards' pitches add no ledger entry (signs have no ledgers).
      config.keys.keySignature.placement.position = "every-set";
      const every = CNBLilypond.generate(config);
      contains(entry(every, "D major"), "(marks (6 0 sharp 0.6473)\n                (13 1 sharp 0.6473)\n                (18 0 sharp 0.6473)\n                (25 1 sharp 0.6473))", "D major twice");
      contains(entry(every, "B♭ major"), "(marks (-2 0 flat 0.6473)\n                (3 1 flat 0.6473)\n                (10 0 flat 0.6473)\n                (15 1 flat 0.6473))", "B♭ major twice, the lower below the cards");
      lacks(every, "(25 . (", "no ledger entry for C♯ at 25");
      lacks(every, "(-2 . (", "no ledger entry for B♭ at −2");
      eq(every.split("#(cnb:register-path!").length, CNBLilypond.generate(CNBConfig.createDefault()).split("#(cnb:register-path!").length,
        "Section A registers only the noteheads' paths");
      lacks(every, "(at ", "unmoved signs are centred, as before");
    }},

  // ─── The model's symbols (session 55, LY spec 1.3.19, engine 1.6.0) ───────

  { name: "mark table: a shape with a reference point, or a moved one, writes (at dx . dy); a centred, unmoved one does not", fn: () => {
      const config = keySignatureConfig();
      const ks = config.keys.keySignature;
      // The default head with its reference point 1 semitone right of its
      // centre: its origin goes 1 semitone (¼ staff space) left of the line.
      config.shapes.dot = { ...CNBConfig.clone(config.shapes["crotchet-minim"]), reference: { x: 100, y: 0 } };
      ks.looks.all = { shape: "dot" };
      const out = CNBLilypond.generate(config);
      // The default draws sharps hollow, so a dot names its cutout or #f.
      const heads = out.match(/ head dot \S+ black-000000[^\n]*/g) || [];
      eq(heads.length, 105 * 8, "every key's eight dots");
      assert(heads.every(h => h.includes(" (at -0.25 . 0))")), "every dot placed by its reference point");

      // No reference point: an offset moves the origin from the line, in staff spaces.
      const moved = keySignatureConfig();
      moved.keys.keySignature.looks.all = { offset: { x: 0.4, y: -0.8 } };
      contains(CNBLilypond.generate(moved), " head crotchet-minim #f black-000000 (at 0.1 . -0.2))", "an offset head");
      // Centred and unmoved: as before.
      const plain = keySignatureConfig();
      plain.keys.keySignature.notes = "tonic-and-half-steps";
      const plainOut = CNBLilypond.generate(plain);
      contains(plainOut, "#(set! cnb:keysig-style 'marks)", "a mark table");
      lacks(plainOut, "(at ", "no head placed");
      lacks(plainOut, " symbol ", "no symbol kind");
    }},

  { name: "mark table: an added symbol follows its base as a solid symbol mark, adds no ledger entry and registers its size", fn: () => {
      const config = keySignatureConfig();
      config.keys.keySignature.placement.position = "every-set";
      config.shapes.tail = { ...CNBConfig.clone(config.shapes["crotchet-minim"]), reference: { x: 0, y: 0 }, ledgers: false };
      const without = CNBLilypond.generate(config);
      config.keys.keySignature.looks.sharp = { added: [{ shape: "tail" }] };
      const out = CNBLilypond.generate(config);
      const d = out.slice(out.indexOf(";; D major"), out.indexOf(";; D♯ major") > 0 ? out.indexOf(";; D♯ major") : out.indexOf(";; E♭ major"));
      // The default draws sharps hollow; the tail is solid all the same.
      const layered = d.match(/\((-?\d+) (\d+) head crotchet-minim crotchet-minim-cutout black-000000\)\n\s+\(\1 \2 symbol tail #f black-000000 \(at 0 \. 0\)\)/g) || [];
      eq(layered.length, 4, "F♯ and C♯ in both copies, each a head and then its solid tail");
      eq((d.match(/ symbol /g) || []).length, 4, "no other symbol");
      const ledgers = ly => ly.slice(ly.indexOf("#(define cnb:ledgers-by-semitone"), ly.indexOf("#(define (cnb:ledgers-of"));
      eq(ledgers(out), ledgers(without), "the tails add no ledger entry");
      contains(out, "#(cnb:register-path! 'tail ", "the tail registered");

      // A size of its own: a sized variant, named in the table.
      config.keys.keySignature.looks.sharp = { added: [{ shape: "tail", heightSemis: 1 }] };
      const sized = CNBLilypond.generate(config);
      contains(sized, "#(cnb:register-path! 'tail-h1-w", "the sized tail registered");
      contains(sized, " symbol tail-h1-w", "and named in the table");
      lacks(sized, "#(cnb:register-path! 'tail ", "the tail at its own size is not used");
    }},

  { name: "mark table: a hollow base whose shape takes no ledgers is a symbol with its cutout and no ledger entry", fn: () => {
      const config = keySignatureConfig();
      config.keys.keySignature.placement.position = "every-set";
      config.shapes.ring = { ...CNBConfig.clone(config.shapes["crotchet-minim"]), ledgers: false };
      config.keys.keySignature.looks.all = { shape: "ring", hollow: true };
      const out = CNBLilypond.generate(config);
      contains(out, " symbol ring ring-cutout black-000000)", "a hollow symbol, centred");
      lacks(out, " head ring", "no head");
      contains(out, "#(define cnb:ring-cutout-path", "its cutout registered");
      // B♭ major's low B♭ on the bottom set (−2) takes no ledger entry now.
      lacks(out, "(-2 . (", "no ledger entry below the cards");
    }},

  { name: "mark table: a coloured sign writes its registered colour after its scale; a moved one writes its scale and at", fn: () => {
      const config = keySignatureConfig();
      traditional(config);
      config.keys.keySignature.looks.sharp.color = "#cc0000";
      const out = CNBLilypond.generate(config);
      const red = "fire-engine-red-cc0000";   // named from the hex (cnb-color.js)
      contains(out, `#(cnb:register-color! '${red} "#cc0000")`, "the sign's colour registered");
      contains(out, `(6 0 sharp 0.6473 ${red})\n                (13 1 sharp 0.6473 ${red}))`, "D major's red sharps");
      contains(out, "(10 0 flat 0.6473)\n                (15 1 flat 0.6473))", "B♭ major's black flats as before");
      // At LilyPond's size the scale is written all the same.
      config.keys.keySignature.signs = { heightSemis: 1.052 * 4 };
      contains(CNBLilypond.generate(config), `(6 0 sharp 1 ${red})`, "scale 1 kept before the colour");
      // A black sign moved: its scale, then its origin placed.
      config.keys.keySignature.looks.flat.offset = { x: 0, y: 1 };
      const placed = CNBLilypond.generate(config);
      assert(/\(10 0 flat 1 \(at -?[\d.]+ \. 0\.25\)\)/.test(placed), "B♭ moved up a semitone, ¼ staff space");
      lacks(placed, "flat 1 black", "no colour on a black sign");
    }},

  // Engine-backed (session 51): the traditional signature engraves where the
  // canvas draws it. For the default config and Kite 4-369, in the middle, on
  // the bottom line set and on every line set, in C, D and B♭ major (key
  // changes in one score), at the automatic size and one set by hand (session
  // 52), and at magnifications 1, 7/4, 4/5 and 5/2: every engraved
  // sign's kind, its origin's height, its box (so its column and size, in the
  // optical size LilyPond picks) and the signature's ink within 0.001 staff
  // spaces of the preview's, and no ledgers, paths or bars. C major engraves
  // nothing.
  { name: "mark table (engine): sharps and flats engrave where the canvas draws them, on any line set, at any magnification", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const kite = () => {
        const config = CNBConfigIO.loadFromText(readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8")).config;
        config.keys.enabled = true;
        config.keys.keySignature.enabled = true;
        return config;
      };
      // Each at the automatic size and at 4 semitones set by hand (session
      // 52, engine 1.5.0: each sign scaled by its mark's fourth element).
      const sizes = [["automatic", null], ["4 semitones", 4]];
      const runs = [];
      for (const [name, base] of [["default", keySignatureConfig], ["Kite 4-369", kite]]) {
        for (const position of ["middle", "bottom-set", "every-set"]) {
          for (const [size, heightSemis] of sizes) {
            const config = base();
            traditional(config);
            config.keys.keySignature.placement.position = position;
            config.keys.keySignature.signs = { heightSemis };
            runs.push({ label: `${name}, ${position}, ${size}`, config, music: "" });
          }
        }
      }
      // Since engine 1.5.0 (engine handoff 035 §1b) a plain score engraves at
      // the cnb:default-magnify the export sets, so these scores need no
      // \magnifyStaff of their own. Each picks its optical size.
      // Both notations, in the middle and on every line set, at each size.
      for (const magnify of ["1", "4/5", "5/2"]) {
        for (const [name, base] of [["default", keySignatureConfig], ["Kite 4-369", kite]]) {
          for (const position of ["middle", "every-set"]) {
            for (const [size, heightSemis] of sizes) {
              if (magnify === "4/5" && (name !== "default" || position !== "every-set")) continue;
              const config = base();
              traditional(config);
              config.keys.keySignature.placement.position = position;
              config.keys.keySignature.signs = { heightSemis };
              config.engine.defaultMagnify = magnify;
              runs.push({ label: `${name}, ${position}, magnify ${magnify}, ${size}`, config, music: "" });
            }
          }
        }
      }
      const keys = [["c", "major", "C"], ["d", "major", "D"], ["bes", "major", "B♭"]];
      const near = (a, b) => Math.abs(a - b) < 1e-3;
      const failures = [];
      const results = [];
      for (let i = 0; i < runs.length; i += 4) {   // four compiles at a time
        results.push(...await Promise.all(runs.slice(i, i + 4).map(run =>
          measureKeySignatureMarks(engine, CNBLilypond.generate(run.config),
            run.music + keys.map(([t, mode]) => `\\key ${t} \\${mode} c'1`).join(" ")).then(got => ({ run, got })))));
      }
      for (const { run: { label, config }, got } of results) {
        if (got.error) { failures.push(`${label}: ${got.error.slice(0, 400)}`); continue; }
        // C major has no signs, so only D's and B♭'s signatures engrave.
        if (got.signatures.length !== 2) { failures.push(`${label}: ${got.signatures.length} signatures engraved, 2 wanted`); continue; }
        const table = _internals.markTable(config);
        const r = CNBScheme.parseRatio(config.engine.defaultMagnify);
        const magnify = r.num / (r.den ?? 1);
        if (table.find(e => e.spelling === "C" && e.mode === "major").sig.marks.length !== 0) failures.push(`${label}: C major draws signs`);
        keys.slice(1).forEach(([, mode, spelling], k) => {
          const where = `${label}, ${spelling} ${mode}`;
          const sig = table.find(e => e.spelling === spelling && e.mode === mode).sig;
          const engraved = got.signatures[k];
          if (engraved.paths.length > 0 || engraved.lines.length > 0) {
            failures.push(`${where}: ${engraved.paths.length} paths and ${engraved.lines.length} lines (ledgers or bars) engraved, none wanted`);
          }
          if (engraved.glyphs.length !== sig.marks.length) failures.push(`${where}: ${engraved.glyphs.length} signs engraved, ${sig.marks.length} drawn`);
          let left = Infinity;
          let right = -Infinity;
          for (const { semi, column, mark } of sig.marks) {
            // The sign at its scale (session 52), about its origin.
            const raw = CNBAccidentalGlyphs.glyph(mark.sign, magnify);
            const glyph = { x: raw.x.map(v => v * mark.scale), y: raw.y.map(v => v * mark.scale) };
            const x = sig.columns[column];
            const y = CNBStaff.lilypondPosition(config, semi) / 2;
            const e = engraved.glyphs.find(g => near((g.x[0] + g.x[1]) / 2, x) && near(g.origin[1], y));
            if (!e) { failures.push(`${where}: no sign at column ${column} (${x}), semitone ${semi} (${y})`); continue; }
            if (e.name !== `accidentals.${mark.sign}`) failures.push(`${where}: semitone ${semi} engraved ${e.name}, drawn a ${mark.sign}`);
            if (!near(e.x[1] - e.x[0], glyph.x[1] - glyph.x[0]) || !near(e.y[0] - e.origin[1], glyph.y[0]) || !near(e.y[1] - e.origin[1], glyph.y[1])) {
              failures.push(`${where}: semitone ${semi} engraved ${JSON.stringify(e)}, drawn a box ${JSON.stringify([glyph.x, glyph.y])}`);
            }
            left = Math.min(left, x - (glyph.x[1] - glyph.x[0]) / 2);
            right = Math.max(right, x + (glyph.x[1] - glyph.x[0]) / 2);
          }
          if (!near(engraved.x[0], left) || !near(engraved.x[1], right)) {
            failures.push(`${where}: ink ${engraved.x[0]} … ${engraved.x[1]}, drawn ${left} … ${right}`);
          }
        });
      }
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    }},

  { name: "mark table (engine): a key the table lacks engraves no signature and the engine names it", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const config = keySignatureConfig();
      config.keys.keySignature.stacking = "parity";
      const got = await measureKeySignatureMarks(engine, CNBLilypond.generate(config), "\\key dis \\major c'1");
      assert(!got.error, got.error);
      eq(got.signatures.length, 0, "no signature for D♯ major");
      assert(got.warnings.some(w => /no entry for the key of #<Pitch dis/.test(w)), `the engine names the key: ${got.warnings.join(" | ")}`);
    }},

  { name: "key signature (engine): a styled bar engraves its colour and thickness, and the marks where the preview draws them", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const config = keySignatureConfig();
      config.keys.keySignature.placement.tonicOctave = 1;
      Object.assign(config.keys.keySignature.separator, { color: "#123abc", thicknessPct: 80, extentSemis: 2 });
      // The marks: G's scale from the preview's tonic in octave 1 (semitones
      // 19–31, above the middle), each a head of the default shape's height.
      // The bar runs ±extentSemis about the middle line, its round ends
      // half its thickness further, so it reaches below the marks.
      const semis = CNBKeySignature.signatureSemis(config, "G");
      const sps = config.staff.semitonesPerStaffSpace;
      const head = config.shapes["crotchet-minim"].semitoneHeight / sps;   // half-heights, in half-staff-spaces
      const top = 2 * (Math.max(...semis) - config.staff.midpoint) / sps + head;
      const bottom = -(2 * 2 / sps + 0.8 / sps);
      const { keySignature: ks, error } = await measureKeySignature(engine, CNBLilypond.generate(config), "g \\major");
      assert(!error, `the export must compile: ${error}`);
      assert(ks && ks.bar, `a key signature with a bar was engraved: ${JSON.stringify(ks)}`);
      assert(Math.abs(ks.top - top) < 0.02, `top ${ks.top} half-staff-spaces, preview ${top}`);
      assert(Math.abs(ks.bottom - bottom) < 0.02, `bottom ${ks.bottom} (the bar's end), preview ${bottom}`);
      const want = [0x12, 0x3a, 0xbc].map(v => v / 255);
      assert(ks.bar.color.every((v, i) => Math.abs(v - want[i]) < 1e-3), `bar colour ${ks.bar.color}`);
      assert(Math.abs(ks.bar.thickness - 0.8 / sps) < 1e-3, `bar ${ks.bar.thickness} staff spaces, preview ${0.8 / sps}`);
      const off = await measureKeySignature(engine, CNBLilypond.generate(CNBConfig.createDefault()), "g \\major");
      assert(!off.error, `the default export must compile: ${off.error}`);
      eq(off.keySignature, null, "a config with the signature off engraves none");
    }},

  // ── Pitch axis (set 014 session 3): v1.3 emission, §8a gate lifted ──────

  // The 013 spike engraved '(-3 -1 1 4 6 8), the staff over semitones 0–23.
  // Since 1.3.5 (§5.1a) the range is centred on the midpoint, semitones
  // −5…18 for the spike's midpoint 7: G♯ below (−4) replaces G♯ two
  // octaves up (20), three lines either side of G.
  { name: "pitch axis §5.4a: the 013 spike staff, centred on its midpoint, is '(-6 -3 -1 1 4 6)", fn: () => {
      const config = spikeAxisConfig();
      eq(CNBLilypond.computeStaffLinePositions(config).join(" "), "-6 -3 -1 1 4 6", "spike staff positions");
    }},

  { name: "pitch axis §5.4a: staff lines collapsing onto one axis position are emitted once", fn: () => {
      const config = spikeAxisConfig();
      config.staff.semitonePattern = [2, 5, 6, 8, 9];   // 5/6 and 8/9 share positions 3 and 5
      eq(CNBLilypond.computeStaffLinePositions(config).join(" "), "-6 -3 -1 1 4 6", "deduplicated and sorted");
    }},

  { name: "pitch axis §5.4b: the compiled procedure inlines map, stride, midpoint anchor and axis units; middle C maps to -4", fn: () => {
      const config = spikeAxisConfig();
      const b = CNBLilypond.sectionB(config);
      contains(b, "#(set! cnb:get-pitch-staff-position", "hook set");
      contains(b, "(vector-ref #(0 0 1 2 2 3 3 4 5 5 6 6) pc)", "positions vector");
      contains(b, "(* oct 7))))", "octave stride");
      contains(b, "(/ (* 2 (- pos 4)) 2))))", "midpoint anchor 4 and axis-units divisor 2");
      contains(b, "12 pitch classes on 7 positions/octave", "comment counts distinct positions");
      // Evaluate the emitted arithmetic the way Scheme does (floored modulo).
      const hook = (semi) => {
        const pc = ((semi % 12) + 12) % 12;
        const oct = (semi - pc) / 12;
        const pos = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6][pc] + oct * 7;
        return (2 * (pos - 4)) / 2;
      };
      eq(hook(0), -4, "middle C → -4");
      eq(hook(7), 0, "midpoint G → 0");
      eq(hook(-1), -5, "B below middle C (negative octave) → -5");
      // The hook block sits after staff geometry and before the metadata.
      assert(b.indexOf("cnb:staff-line-positions") < b.indexOf("cnb:get-pitch-staff-position"), "after staff geometry");
      assert(b.indexOf("cnb:get-pitch-staff-position") < b.indexOf("%% Metadata"), "before metadata");
    }},

  { name: "pitch axis: cnb:semitones-per-staff-space uses axisUnitsPerStaffSpace (handoff 008 §4.1)", fn: () => {
      const config = spikeAxisConfig();
      config.staff.semitonesPerStaffSpace = 4;
      const b = CNBLilypond.sectionB(config);
      contains(b, "#(set! cnb:semitones-per-staff-space 2)", "axis units, not the linear sps");
      lacks(b, "cnb:default-staff-line-thickness", "no staff-line styling (M2)");
    }},

  { name: "pitch axis: an attachment's half stem is in axis units per staff space (LY spec §4.4c), its anchor relative to the extent", fn: () => {
      const config = spikeAxisConfig();
      const shape = config.shapes["crotchet-minim"];
      const up = (cfg) => /\(cons 'crotchet-up   '\(([^)]*)\)\)/.exec(CNBLilypond.sectionA(cfg))[1];
      const want = (units) => _internals.fmtPair(_internals.attachmentPoints(shape, null, units).crotchetUp);
      eq(up(config), want(2), "axis units 2");
      config.pitchAxis.axisUnitsPerStaffSpace = 4;
      eq(up(config), want(4), "axis units 4");
      assert(want(2) !== want(4), "a wider staff space, a wider half stem");
      config.pitchAxis.enabled = false;
      eq(up(config), want(config.staff.semitonesPerStaffSpace), "linear: semitones per staff space");
    }},

  { name: "pitch axis: explicit cnb:keysig-tonic-octave — placement.tonicOctave when integer, else the auto octave for a C tonic (handoff 008 §4.2)", fn: () => {
      const config = spikeAxisConfig();
      contains(CNBLilypond.sectionB(config), "#(set! cnb:keysig-tonic-octave 0)", "auto: midpoint 7 → octave 0");
      config.staff.midpoint = 19;
      contains(CNBLilypond.sectionB(config), "#(set! cnb:keysig-tonic-octave 1)", "auto: midpoint 19 → octave 1");
      config.keys.keySignature.placement.tonicOctave = -1;
      contains(CNBLilypond.sectionB(config), "#(set! cnb:keysig-tonic-octave -1)", "explicit octave as given");
    }},

  { name: "pitch axis §6.3: nonzero x-offset is emitted, joins the grouping key, and zero is omitted", fn: () => {
      const config = spikeAxisConfig();
      config.noteheadRules.push({
        name: "shared-position sharps sit right", priority: 10,
        match: { pitchClasses: [1, 4, 6, 9, 11], durations: "all", keys: "all" },
        apply: { xOffsetStaffSpaces: 0.85 },
      });
      config.noteheadRules.push({
        name: "zero offset is no offset", priority: 11,
        match: { pitchClasses: [2], durations: "all", keys: "all" },
        apply: { xOffsetStaffSpaces: 0 },
      });
      const c = CNBLilypond.sectionC(config);
      const byPc = parseSectionCClauses(c);
      for (let pc = 0; pc < 12; pc++) {
        const expected = [1, 4, 6, 9, 11].includes(pc) ? "0.85" : undefined;
        eq(byPc[pc]["x-offset"], expected, `pc ${pc} x-offset`);
      }
      // Grouping: an offset pc never shares a clause with an unshifted pc of
      // otherwise-identical fields (E is solid like C, D, F — but alone with
      // the other solid offset pcs).
      eq(byPc[4].condition, "((memv pc '(4 9 11))", "solid offset pcs E, A, B grouped together");
      eq(byPc[0].condition, "((memv pc '(0 2 5 7))", "solid unshifted pcs grouped apart");
      contains(c, "+0.85 staff-space right", "clause comment names the offset");
      lacks(c, "(x-offset   . 0)", "zero offsets never emitted");
    }},

  { name: "pitch axis: generate() exports an enabled axis config (the §8a gate is lifted)", fn: () => {
      const ly = CNBLilypond.generate(spikeAxisConfig());
      contains(ly, "cnb:get-pitch-staff-position", "the hook is emitted");
      contains(ly, "#(set! cnb:staff-line-positions '(-6 -3 -1 1 4 6))", "axis staff, centred on the midpoint (1.3.5)");
    }},

  { name: "pitch axis: disabled or non-boolean-enabled sections export byte-identically to the default, even with xOffsetStaffSpaces rules", fn: () => {
      const defaultLy = CNBLilypond.generate(CNBConfig.createDefault());
      for (const enabled of [false, 1, "true"]) {
        const config = CNBConfig.createDefault();
        config.pitchAxis = { ...spikeAxisConfig().pitchAxis, enabled };
        config.noteheadRules.push({
          name: "offset", priority: 10,
          match: { pitchClasses: [1], durations: "all", keys: "all" },
          apply: { xOffsetStaffSpaces: 0.85 },
        });
        eq(CNBLilypond.generate(config), defaultLy, `enabled: ${JSON.stringify(enabled)}`);
      }
    }},

  { name: "pitch axis §8 checks 8, 9, 11 and 12 (10 retired with the line overrides, session 34): generate() refuses configs failing the axis validation", fn: () => {
      const cases = [
        ["8 kind", c => { c.pitchAxis.kind = "other"; }, "pitchAxis.kind must be"],
        ["9 map coverage", c => { c.pitchAxis.pitchClasses.pop(); }, "exactly 12 entries"],
        ["9 duplicate pc", c => { c.pitchAxis.pitchClasses[11].pc = 10; }, "more than one entry for pc 10"],
        ["9 stride", c => { c.pitchAxis.octaveStride = 0; }, "octaveStride must be a finite number > 0"],
        ["9 axis units", c => { c.pitchAxis.axisUnitsPerStaffSpace = -2; }, "axisUnitsPerStaffSpace must be a finite number > 0"],
        ["11 x-offset", c => {
          c.noteheadRules.push({ name: "bad", priority: 9, match: { pitchClasses: [1], durations: "all", keys: "all" }, apply: { xOffsetStaffSpaces: "0.85" } });
        }, "xOffsetStaffSpaces must be a finite number"],
        ["12 monotonic", c => { c.pitchAxis.pitchClasses[3].position = 0.5; c.pitchAxis.pitchClasses[2].position = 1; }, "not globally non-decreasing"],
      ];
      for (const [label, mutate, message] of cases) {
        const config = spikeAxisConfig();
        mutate(config);
        let threw = null;
        try { CNBLilypond.generate(config); } catch (err) { threw = err; }
        assert(threw !== null, `check ${label}: generate() must throw`);
        contains(threw.message, "Config failed export validation", `check ${label}: validation error`);
        contains(threw.message, message, `check ${label}`);
      }
    }},

  { name: "pitch axis: the Twinline compact fixture, loaded through CNBConfigIO, exports byte-identically to its pinned baseline", fn: () => {
      const normalize = (text) => text
        .replace(/\r\n/g, "\n")
        .replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      const fixture = readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json"), "utf8");
      const { config, validation } = CNBConfigIO.loadFromText(fixture);
      assert(validation.valid, "fixture validates: " + validation.errors.join("; "));
      const baseline = readFileSync(path.join(CNB_DIR, "fixtures", "twinline-compact-export-baseline.ly"), "utf8");
      eq(normalize(CNBLilypond.generate(config)), normalize(baseline), "pinned compact export");
    }},

  // ── Hostile input (session 10, audit 2026-11-02 H1/L6) ─────────────────────
  { name: "hostile: the shared-config.json label payload exports with no live Scheme", fn: () => {
      const { config, validation } = loadHostileSharedConfig();
      assert(validation.valid, "the payload is text, so the config stays valid: " + validation.errors.join("; "));
      const out = CNBLilypond.generate(config);
      assertNoLiveScheme(out, CNBLilypond.generate(CNBConfigIO.loadFromText(
        JSON.stringify({ version: "1.0", meta: { configName: "Shared System", fileSuffix: "-Shared", notationLabel: "Innocent" } })).config),
        "INJECTED-VIA-NOTATION-LABEL");
    }},

  { name: "hostile: every field payload is rejected by validation and export alike, or exports inert", fn: () => {
      const base = hostileBaseConfig();
      deepEqArr(CNBConfig.validate(base).errors, [], "base config is valid");
      const baseOut = CNBLilypond.generate(base);
      for (const p of hostilePayloads()) {
        const config = applyPayload(base, p);
        const { errors } = CNBConfig.validate(config);
        let exported = null, threw = null;
        try { exported = CNBLilypond.generate(config); } catch (err) { threw = err; }
        if (p.expect === "rejected") {
          assert(errors.length > 0, `${p.field}: validation must reject`);
          assert(threw !== null, `${p.field}: generate() must throw`);
          // The emitters refuse it on their own too, not only through validate().
          let emitterThrew = false;
          try {
            CNBLilypond.header(config); CNBLilypond.sectionA(config);
            CNBLilypond.sectionB(config); CNBLilypond.sectionC(config);
          } catch (_) { emitterThrew = true; }
          assert(emitterThrew, `${p.field}: an emitter must refuse the value`);
        } else {
          assert(errors.length === 0, `${p.field}: validation must accept: ${errors.join("; ")}`);
          assert(threw === null, `${p.field}: generate() must not throw: ${threw && threw.message}`);
          // The payload reached the output (a shape name only as its slug).
          contains(exported.toLowerCase(), p.marker.toLowerCase(), `${p.field}: the payload text is carried (inert)`);
          assertNoLiveScheme(exported, baseOut, p.marker, p.field);
        }
      }
    }},

  { name: "size (engine): the default config engraves noteheads 0.5–3 staff spaces wide and tall", fn: async () => {
      // Audit H3: the fallback once emitted raw SVG units, so one notehead
      // filled the page. Measured from a real engine render.
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const { noteheads, error } = await measureNoteheads(engine, CNBLilypond.generate(CNBConfig.createDefault()));
      assert(!error, `the default export must compile and engrave: ${error}`);
      eq(noteheads.length, 12, "one notehead per pitch class");
      for (const { pc, width, height } of noteheads) {
        assert(width >= 0.5 && width <= 3, `pc ${pc}: width ${width} staff spaces is outside 0.5–3`);
        assert(height >= 0.5 && height <= 3, `pc ${pc}: height ${height} staff spaces is outside 0.5–3`);
      }
    }},

  { name: "durations (engine): \"C minims are hollow\" engraves c'4 solid and c'2 hollow", fn: async () => {
      // Audit 2026-11-02 H4: the engine's duration categories were one off,
      // so a minim rule hollowed quarter notes. Fixed in the engine's 1.1.1;
      // this pins it from a real render.
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const config = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "kite-4-369-config.json"), "utf8"));
      config.noteheadRules.push({
        name: "C minims are hollow", priority: 3,
        match: { pitchClasses: [0], durations: ["minim"], keys: "all" },
        apply: { hollow: true },
      });
      const { noteheads, error } = await engraveNoteheads(engine, CNBLilypond.generate(config), "c'4 c'2");
      assert(!error, `the export must compile and engrave: ${error}`);
      eq(noteheads.length, 2, "two noteheads");
      const [quarter, half] = noteheads;
      assert(quarter.pc === 0 && quarter.durationLog === 2, `first is the quarter C: ${JSON.stringify(quarter)}`);
      assert(half.pc === 0 && half.durationLog === 1, `second is the half C: ${JSON.stringify(half)}`);
      assert(!quarter.hollow, "the quarter C is solid");
      assert(half.hollow, "the half C is hollow");
    }},

  // ── session 22: sized shape variants (LY spec §4.1c) ───────────────────────

  { name: "registrationFor: the shape's own size is the shape; another size is a named, scaled variant", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = cfg.shapes["crotchet-minim"];
      const ownW = shape.naturalWidth * shape.semitoneHeight / shape.naturalHeight;
      const plain = _internals.registrationFor(cfg, { shape: "crotchet-minim", heightSemis: null, widthSemis: null });
      eq(plain.sym, "crotchet-minim", "unsized symbol"); eq(plain.scale, null, "unsized scale");
      const same = _internals.registrationFor(cfg, { shape: "crotchet-minim", heightSemis: shape.semitoneHeight, widthSemis: ownW });
      eq(same.scale, null, "explicitly own size is the shape");
      const sized = _internals.registrationFor(cfg, { shape: "crotchet-minim", heightSemis: 1.5, widthSemis: 3 });
      eq(sized.sym, "crotchet-minim-h1p5-w3", "variant symbol");
      assert(Math.abs(sized.scale.y - 1.5 / shape.semitoneHeight) < 1e-12, "scale.y = height / semitoneHeight");
      assert(Math.abs(sized.scale.x - 3 / ownW) < 1e-12, "scale.x = width / natural width");
      const hOnly = _internals.registrationFor(cfg, { shape: "crotchet-minim", heightSemis: 2, widthSemis: null });
      eq(hOnly.sym, `crotchet-minim-h2-w${_internals.fmtNum(ownW).replace(".", "p")}`, "height only keeps the natural width");
      eq(hOnly.scale.x, 1, "height only: x unscaled");
    }},

  { name: "sized variants: Section A scales the path and cutout of each variant and computes its attachments at its scale", fn: () => {
      const cfg = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "sized-config.json"), "utf8"));
      const a = CNBLilypond.sectionA(cfg);
      const shape = cfg.shapes["crotchet-minim"];
      const sps = cfg.staff.semitonesPerStaffSpace;
      const ups = shape.naturalHeight / shape.semitoneHeight;
      for (const r of [{ heightSemis: 1.5, widthSemis: 3 }, { heightSemis: null, widthSemis: 4 }]) {
        const reg = _internals.registrationFor(cfg, { shape: "crotchet-minim", ...r });
        contains(a, `#(define cnb:${reg.sym}-path ${CNBLilypond.svgPathToLilypond(shape.svgPath, ups, sps, reg.scale)})`, `${reg.sym} path`);
        contains(a, `#(define cnb:${reg.sym}-cutout-path ${CNBLilypond.svgPathToLilypond(shape.svgHollowPath, ups, sps, reg.scale)})`, `${reg.sym} cutout`);
        contains(a, `#(cnb:register-path! '${reg.sym} cnb:${reg.sym}-path)`, `${reg.sym} registered`);
        contains(a, `#(cnb:register-hollow! '${reg.sym}-cutout cnb:${reg.sym}-cutout-path)`, `${reg.sym} cutout registered`);
        // Attachments are relative to the path's extent, which scales with
        // the anchor, but the half stem added to x does not (session 40):
        // a variant's points are computed at its scale.
        const pts = _internals.attachmentPoints(shape, reg.scale, sps);
        assert(pts.crotchetUp.x !== _internals.attachmentPoints(shape, null, sps).crotchetUp.x, `${reg.sym}: x differs from the shape's`);
        contains(a, `#(cnb:register-attachment! '${reg.sym}-attach\n   (list\n     (cons 'crotchet-up   '(${_internals.fmtPair(pts.crotchetUp)}))`, `${reg.sym} attachment value`);
      }
      contains(a, "#(cnb:register-path! 'crotchet-minim cnb:crotchet-minim-path)", "the unsized shape is still used (D, E, F, G, A, B)");
    }},

  { name: "sized variants: the path is the unsized path with x × scale.x and y × scale.y", fn: () => {
      const cmds = [{ cmd: "moveto", args: [2, 4] }, { cmd: "closepath", args: [] }];
      eq(CNBLilypond.pathToStaffSpace(cmds, 2, false, "t", { x: 3, y: 0.5 }), "'(\n    (moveto 3 1)\n    (closepath))", "pre-baked");
      eq(CNBLilypond.pathToStaffSpace(cmds, 2, false, "t"), "'(\n    (moveto 1 2)\n    (closepath))", "no scale unchanged");
      eq(CNBLilypond.svgPathToLilypond("M 100 200 Z", 100, 1, { x: 2, y: 3 }), "'(\n    (moveto 2 -6)\n    (closepath))", "fallback");
    }},

  { name: "sized variants: Section C points pitch classes at their variant, and size joins the grouping key", fn: () => {
      const cfg = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "sized-config.json"), "utf8"));
      const clauses = parseSectionCClauses(CNBLilypond.sectionC(cfg));
      for (const pc of [1, 3, 6, 8, 10]) {
        eq(clauses[pc].shape, "crotchet-minim-h1p5-w3", `pc ${pc} shape`);
        eq(clauses[pc].hollow, "crotchet-minim-h1p5-w3-cutout", `pc ${pc} hollow`);
        eq(clauses[pc].attachment, "crotchet-minim-h1p5-w3-attach", `pc ${pc} attachment`);
      }
      eq(clauses[0].shape, "crotchet-minim-h2p724-w4", "C: own height, width 4");
      for (const pc of [2, 4, 5, 7, 9, 11]) eq(clauses[pc].shape, "crotchet-minim", `pc ${pc} unsized`);
      // Same shape, colour and hollow, different sizes → separate clauses.
      const two = CNBConfig.createDefault();
      two.noteheadRules.push(
        { name: "D", priority: 2, match: { pitchClasses: [2], durations: "all", keys: "all" }, apply: { heightSemis: 2 } },
        { name: "E", priority: 2, match: { pitchClasses: [4], durations: "all", keys: "all" }, apply: { heightSemis: 3 } },
      );
      const c2 = parseSectionCClauses(CNBLilypond.sectionC(two));
      assert(c2[2].condition !== c2[4].condition, "D and E are not grouped");
      eq(c2[0].condition, c2[5].condition, "unsized naturals still grouped");
    }},

  { name: "sized variants: a shape every pitch class resizes is not registered at its own size", fn: () => {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules[0].apply.heightSemis = 2;
      const a = CNBLilypond.sectionA(cfg);
      lacks(a, "#(cnb:register-path! 'crotchet-minim cnb:", "no unsized registration");
      eq(_internals.usedRegistrations(cfg).length, 1, "one variant");
    }},

  // ── session 60: noteheads placed by their shape's reference point (§4.1e) ──

  { name: "registrationFor: a notehead whose shape's reference point is off its origin vertically names a -ref variant, moved by the reference's height", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = cfg.shapes["crotchet-minim"];
      shape.reference = { x: 30, y: 50 };
      const ups = shape.naturalHeight / shape.semitoneHeight;
      const reg = _internals.registrationFor(cfg, { shape: "crotchet-minim", notehead: true });
      eq(reg.sym, "crotchet-minim-ref", "a notehead's symbol");
      eq(reg.scale, null, "at its own size");
      assert(Math.abs(reg.shiftSemis - 50 / ups) < 1e-12, `moved up the reference's height in semitones: ${reg.shiftSemis}`);
      eq(_internals.registrationFor(cfg, { shape: "crotchet-minim" }).sym, "crotchet-minim", "a mark's symbol is the unmoved shape");
      const sized = _internals.registrationFor(cfg, { shape: "crotchet-minim", heightSemis: 1.5, widthSemis: 3, notehead: true });
      eq(sized.sym, "crotchet-minim-h1p5-w3-ref", "a sized notehead's symbol");
      assert(Math.abs(sized.shiftSemis - 50 / ups * sized.scale.y) < 1e-12, "moved at the variant's scale");
      shape.reference = { x: 30, y: 0 };
      eq(_internals.registrationFor(cfg, { shape: "crotchet-minim", notehead: true }).sym, "crotchet-minim", "reference.y 0: the shape");
      delete shape.reference;
      eq(_internals.registrationFor(cfg, { shape: "crotchet-minim", notehead: true }).sym, "crotchet-minim", "no reference: the shape");
    }},

  { name: "reference point: pathToStaffSpace adds shiftY staff spaces to every y, after the conversion", fn: () => {
      const cmds = [{ cmd: "moveto", args: [2, 4] }, { cmd: "curveto", args: [0, 0, 2, 2, 4, 4] }, { cmd: "closepath", args: [] }];
      eq(CNBLilypond.pathToStaffSpace(cmds, 2, false, "t", null, 0.5), "'(\n    (moveto 1 2.5)\n    (curveto 0 0.5 1 1.5 2 2.5)\n    (closepath))", "pre-baked");
      eq(CNBLilypond.svgPathToLilypond("M 100 200 Z", 100, 1, { x: 2, y: 3 }, 1), "'(\n    (moveto 2 -5)\n    (closepath))", "fallback, scaled and moved");
    }},

  { name: "reference point: Section A registers the moved path and cutout with the shape's attachments, and Section C names them", fn: () => {
      const cfg = CNBConfig.createDefault();
      const shape = cfg.shapes["crotchet-minim"];
      shape.reference = { x: 0, y: 50 };
      const sps = cfg.staff.semitonesPerStaffSpace;
      const ups = shape.naturalHeight / shape.semitoneHeight;
      const a = CNBLilypond.sectionA(cfg);
      contains(a, `#(define cnb:crotchet-minim-ref-path ${CNBLilypond.svgPathToLilypond(shape.svgPath, ups, sps, null, 0.5 / sps)})`, "the path moved up 0.5 semitones");
      contains(a, `#(define cnb:crotchet-minim-ref-cutout-path ${CNBLilypond.svgPathToLilypond(shape.svgHollowPath, ups, sps, null, 0.5 / sps)})`, "the cutout too");
      contains(a, "#(cnb:register-path! 'crotchet-minim-ref cnb:crotchet-minim-ref-path)", "registered");
      contains(a, "#(cnb:register-hollow! 'crotchet-minim-ref-cutout cnb:crotchet-minim-ref-cutout-path)", "its cutout registered");
      // Relative to the extent, which moves with the path: the shape's points.
      const pts = _internals.attachmentPoints(shape, null, sps);
      contains(a, `#(cnb:register-attachment! 'crotchet-minim-ref-attach\n   (list\n     (cons 'crotchet-up   '(${_internals.fmtPair(pts.crotchetUp)}))\n     (cons 'crotchet-down '(${_internals.fmtPair(pts.crotchetDown)}))`, "the shape's attachment points");
      lacks(a, "#(cnb:register-path! 'crotchet-minim cnb:", "no notehead uses the unmoved shape");
      const clauses = parseSectionCClauses(CNBLilypond.sectionC(cfg));
      for (let pc = 0; pc < 12; pc++) {
        eq(clauses[pc].shape, "crotchet-minim-ref", `pc ${pc} shape`);
        eq(clauses[pc].attachment, "crotchet-minim-ref-attach", `pc ${pc} attachment`);
      }
      eq(clauses[1].hollow, "crotchet-minim-ref-cutout", "a sharp's cutout");
      // A sized notehead: its variant, moved at its scale.
      cfg.noteheadRules.push({ name: "small C", priority: 5, match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { heightSemis: 1.5, widthSemis: 3 } });
      const reg = _internals.registrationFor(cfg, { shape: "crotchet-minim", heightSemis: 1.5, widthSemis: 3, notehead: true });
      contains(CNBLilypond.sectionA(cfg), `#(define cnb:crotchet-minim-h1p5-w3-ref-path ${CNBLilypond.svgPathToLilypond(shape.svgPath, ups, sps, reg.scale, reg.shiftSemis / sps)})`, "the sized variant moved");
      eq(parseSectionCClauses(CNBLilypond.sectionC(cfg))[0].shape, "crotchet-minim-h1p5-w3-ref", "C names it");
    }},

  { name: "reference point: a key signature's marks keep the unmoved shape and their (at dx . dy), so the reference is applied once", fn: () => {
      const config = keySignatureConfig();
      config.keys.keySignature.notes = "tonic-and-half-steps";
      config.shapes["crotchet-minim"].reference = { x: 0, y: 50 };
      const out = CNBLilypond.generate(config);
      const heads = out.match(/ head crotchet-minim\S* [^\n]*/g) || [];
      assert(heads.length > 0, "the marks are heads");
      assert(heads.every(h => h.startsWith(" head crotchet-minim ") && h.includes(" (at 0 . 0.125))")),
        `each mark the unmoved shape, its origin 0.5 semitones up: ${heads[0]}`);
      contains(out, "#(cnb:register-path! 'crotchet-minim cnb:crotchet-minim-path)", "the marks' shape registered");
      contains(out, "#(cnb:register-path! 'crotchet-minim-ref cnb:crotchet-minim-ref-path)", "the noteheads' beside it");
    }},

  { name: "reference point: a default signature sharing a shape whose reference is off its origin across and in height: the marks placed by both from the mark table, the noteheads by the height alone", fn: () => {
      const config = keySignatureConfig();
      const shape = config.shapes["crotchet-minim"];
      shape.reference = { x: 100, y: 50 };
      const sps = config.staff.semitonesPerStaffSpace;
      const ups = shape.naturalHeight / shape.semitoneHeight;
      // The canvas: each mark's origin 1 semitone (¼ staff space) left of its
      // stack's line and ½ semitone (⅛) above its pitch, so the point is there.
      const table = _internals.markTable(config);
      eq(table.length, 105, "the mark table, not 'chord's scale stack");
      const heads = table.flatMap(e => e.sig.marks.flatMap(m => m.symbols)).filter(s => s.kind === "head");
      assert(heads.length > 0 && heads.every(s => s.reference && Math.abs(s.x + 0.25) < 1e-9 && Math.abs(s.y - 0.125) < 1e-9),
        `every mark placed by x and y: ${JSON.stringify(heads[0])}`);
      // The export: the marks name the unmoved shape and their at …
      const out = CNBLilypond.generate(config);
      contains(out, "#(set! cnb:keysig-style 'marks)", "the mark table");
      const written = out.match(/ head crotchet-minim\S* [^\n]*/g) || [];
      assert(written.length > 0 && written.every(h => h.startsWith(" head crotchet-minim ") && h.includes(" (at -0.25 . 0.125))")),
        `each mark the unmoved shape at both coordinates: ${written[0]}`);
      // … and the noteheads the -ref variant, moved up the reference's height, not across.
      contains(out, `#(define cnb:crotchet-minim-ref-path ${CNBLilypond.svgPathToLilypond(shape.svgPath, ups, sps, null, 50 / ups / sps)})`, "moved in y only");
      const clauses = parseSectionCClauses(CNBLilypond.sectionC(config));
      for (let pc = 0; pc < 12; pc++) eq(clauses[pc].shape, "crotchet-minim-ref", `pc ${pc}`);
      // With the reference off its origin in height alone, 'chord's heads, drawn
      // through Section C as -ref, are placed as the canvas places them.
      shape.reference = { x: 0, y: 50 };
      lacks(CNBLilypond.generate(config), "cnb:keysig-style 'marks", "the scale stack");
    }},

  { name: "reference point: a config without one exports as before (a reference with y 0 included)", fn: () => {
      const cfg = CNBConfig.createDefault();
      const before = CNBLilypond.generate(cfg).replace(/^%% Date: .*$/m, "");
      cfg.shapes["crotchet-minim"].reference = { x: 40, y: 0 };
      eq(CNBLilypond.generate(cfg).replace(/^%% Date: .*$/m, ""), before, "byte for byte");
    }},

  { name: "baselines: the sized fixture exports byte-identically to sized-export-baseline.ly", fn: () => {
      // Exported by cnb/fixtures/export-config.mjs in session 22.
      const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      const baseline = readFileSync(path.join(CNB_DIR, "fixtures", "sized-export-baseline.ly"), "utf8");
      const config = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "sized-config.json"), "utf8"));
      eq(normalize(CNBLilypond.generate(config)), normalize(baseline), "sized export");
    }},

  { name: "size (engine): the sized fixture engraves each pitch class at its resolved height and width (±5%)", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const cfg = JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", "sized-config.json"), "utf8"));
      const { noteheads, error } = await measureNoteheads(engine, CNBLilypond.generate(cfg));
      assert(!error, `the sized export must compile and engrave: ${error}`);
      eq(noteheads.length, 12, "one notehead per pitch class");
      const shape = cfg.shapes["crotchet-minim"];
      const sps = cfg.staff.semitonesPerStaffSpace;
      const ownW = shape.naturalWidth * shape.semitoneHeight / shape.naturalHeight;
      const failures = [];
      for (const { pc, width, height } of noteheads) {
        const r = CNBConfig.resolveNotehead(cfg, pc, "crotchet", null);
        const wantH = (r.heightSemis ?? shape.semitoneHeight) / sps;
        const wantW = (r.widthSemis ?? ownW) / sps;
        if (!(Math.abs(height - wantH) <= 0.05 * wantH)) failures.push(`pc ${pc}: height ${height}, want ${wantH}`);
        if (!(Math.abs(width - wantW) <= 0.05 * wantW)) failures.push(`pc ${pc}: width ${width}, want ${wantW}`);
      }
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    }},

  { name: "hostile (engine): LilyPond never prints a payload from an accepted export", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const exports = [{ marker: "INJECTED-VIA-NOTATION-LABEL", ly: CNBLilypond.generate(loadHostileSharedConfig().config) }];
      for (const p of hostilePayloads()) {
        if (p.expect !== "exported") continue;
        exports.push({ marker: p.marker, ly: CNBLilypond.generate(applyPayload(hostileBaseConfig(), p)) });
      }
      const dir = mkdtempSync(path.join(os.tmpdir(), "cnb-hostile-"));
      try {
        const runs = exports.map(({ marker, ly }, i) => new Promise((resolve) => {
          const sub = path.join(dir, String(i));
          mkdirSync(sub);
          writeFileSync(path.join(sub, "config.ly"), ly, "utf8");
          writeFileSync(path.join(sub, "score.ly"),
            '\\version "2.24.2"\n\\include "config.ly"\n{ c\'4 cis\'4 d\'4 e\'4 }\n', "utf8");
          execFile(engine.lilypond, [...NO_PAGES, "-I", engine.dir, "-o", path.join(sub, "out"), "score.ly"],
            { cwd: sub, timeout: 120000, windowsHide: true },
            (error, stdout, stderr) => resolve({ marker, error, output: `${stdout}\n${stderr}` }));
        }));
        for (const { marker, error, output } of await Promise.all(runs)) {
          assert(!output.includes(marker), `${marker}: LilyPond printed the payload:\n${output}`);
          assert(!error, `${marker}: the export must compile (so the payload was really read): ${error && error.message}\n${output}`);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }},

  { name: "round trip (engine): joy-to-the-world-45deg.ly engraves through the engine at 1.2.0 or later", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      // Stem anchors inside the head need engine 1.2.0 (its session 17).
      const version = JSON.parse(readFileSync(path.join(engine.dir, "version.json"), "utf8")).version;
      const [major, minor] = version.split(".").map(Number);
      assert(major > 1 || (major === 1 && minor >= 2), `the engine at ${engine.dir} is ${version}; 1.2.0 or later is needed`);
      const fixtures = path.join(CNB_DIR, "fixtures");
      const dir = mkdtempSync(path.join(os.tmpdir(), "cnb-45deg-"));
      try {
        const { error, output } = await new Promise((resolve) => {
          execFile(engine.lilypond, [...NO_PAGES, "-I", engine.dir, "-I", fixtures, "-o", path.join(dir, "out"),
            path.join(fixtures, "joy-to-the-world-45deg.ly")],
            { cwd: dir, timeout: 120000, windowsHide: true },
            (error, stdout, stderr) => resolve({ error, output: `${stdout}\n${stderr}` }));
        });
        assert(!error, `lilypond must exit 0: ${error && error.message}\n${output}`);
        assert(!/error:/.test(output), `lilypond printed an error:\n${output}`);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }},

];

// ── Hostile-input helpers (session 10) ───────────────────────────────────────

const HOSTILE_DIR = path.join(CNB_DIR, "fixtures", "hostile");

function deepEqArr(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function loadHostileSharedConfig() {
  return CNBConfigIO.loadFromText(readFileSync(path.join(HOSTILE_DIR, "shared-config.json"), "utf8"));
}

function hostilePayloads() {
  return JSON.parse(readFileSync(path.join(HOSTILE_DIR, "field-payloads.json"), "utf8"));
}

/**
 * The config every field payload is applied to: the default plus rule
 * colours (so A5 registers colours), a footnote (so B3 emits its
 * conditional footnote line), and a minim-only rule (so Section C emits
 * duration-aware clauses whose comments carry duration names).
 */
function hostileBaseConfig() {
  const config = colourConfig();
  config.meta.notationFootnote = "Base footnote";
  config.noteheadRules.push({
    name: "Minim C hollow", priority: 5,
    match: { pitchClasses: [0], durations: ["minim"], keys: "all" },
    apply: { hollow: true },
  });
  return config;
}

/** A clone of config with one payload applied (a field write or a shape rename). */
function applyPayload(config, p) {
  const out = CNBConfig.clone(config);
  if (p.renameShape) {
    out.shapes[p.value] = out.shapes[p.renameShape];
    delete out.shapes[p.renameShape];
    for (const rule of out.noteheadRules) {
      if (rule.apply && rule.apply.shape === p.renameShape) rule.apply.shape = p.value;
    }
    return out;
  }
  let target = out;
  for (const key of p.path.slice(0, -1)) target = target[key];
  target[p.path[p.path.length - 1]] = p.value;
  return out;
}

/**
 * The .ly with its comments (%… and ;… to end of line) and string literals
 * removed — what LilyPond and Guile actually read as code.
 */
function liveCode(ly) {
  let code = "";
  for (let i = 0; i < ly.length; i++) {
    const ch = ly[i];
    if (ch === '"') {
      for (i++; i < ly.length && ly[i] !== '"'; i++) if (ly[i] === "\\") i++;
      code += '""';
    } else if (ch === "%" || ch === ";") {
      while (i < ly.length && ly[i] !== "\n") i++;
      code += "\n";
    } else {
      code += ch;
    }
  }
  return code;
}

/**
 * An accepted payload adds no #( or $( to the live code beyond the
 * exporter's own template (the same config without the payload), and its
 * marker appears only inside comments or string literals.
 */
function assertNoLiveScheme(out, baseOut, marker, label = marker) {
  const count = (text) => (liveCode(text).match(/[#$]\(/g) || []).length;
  eq(count(out), count(baseOut), `${label}: #( / $( count in live code`);
  lacks(liveCode(out), marker, `${label}: the marker must not reach live code`);
}

// ── Pitch-axis test helper (set 014) ─────────────────────────────────────────

/**
 * The v1.3 §5.4b worked-check configuration (the 013 session-1 spike):
 * Twinline-like map, stride 7, 2 axis units per staff space, staff pattern
 * [2, 5, 8], midpoint 7.
 */
function spikeAxisConfig() {
  const config = CNBConfig.createDefault();
  config.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
  };
  config.staff.semitonePattern = [2, 5, 8];
  config.staff.midpoint = 7;
  return config;
}

// ── Clef test helpers (session 30) ───────────────────────────────────────────

/** The default config with a 300 × 100 glyph clef, 6 semitones tall, shown. */
function glyphClefConfig(overrides = {}) {
  const config = CNBConfig.createDefault();
  config.clef = {
    enabled: true,
    active: "express-b",
    glyphs: {
      "express-b": {
        displayName: "Express B Clef", kind: "glyph",
        svgPath: "M 0 0 L 100 0 L 100 300 L 0 300 Z",
        naturalHeight: 300, naturalWidth: 100, semitoneHeight: 6,
        viewBoxMinX: 0, viewBoxMinY: 0, lilypondPath: null, anchorSemi: 22.784,
        ...overrides,
      },
    },
    gutter: { paddingH: 20 },
  };
  return config;
}

/**
 * Hold engraved mark-table signatures to the canvas (session 55, LY spec
 * 1.3.19 §5.6a, engine 1.6.0): each run's config is exported and engraved in
 * the given keys (key changes in one score), and for every key, every symbol
 * of every mark the preview draws (CNBKeySignature.marks: each base and added
 * symbol, heads, symbols and signs) is matched to an engraved path or glyph
 * by its box, within 0.001 staff spaces: a shape at its origin (its stack's
 * line plus the symbol's x, the mark's pitch plus its y) plus its path's box
 * at its size, with its fill (subpaths) and colour; a sign by its origin and
 * box at its scale, its colour. Then every stack's ledgers (each head base's
 * own, 4/3 of its box and their caps, centred on it), the gold stems' count
 * and the signature's ink. Returns { failures, symbols } with the number of
 * symbols compared of each kind.
 *
 * @param {object} engine  from findEngine()
 * @param {{label:string, config:object, music?:string}[]} runs
 * @param {[string, string, string][]} keys  [LilyPond tonic, mode, spelling]
 */
async function holdMarkTable(engine, runs, keys) {
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  const failures = [];
  const symbols = { head: 0, symbol: 0, sign: 0 };
  const results = [];
  for (let i = 0; i < runs.length; i += 4) {   // four compiles at a time
    results.push(...await Promise.all(runs.slice(i, i + 4).map(run => {
      const ly = CNBLilypond.generate(run.config);
      const music = (run.music || "") + keys.map(([t, mode]) => `\\key ${t} \\${mode} c'1`).join(" ");
      return measureKeySignatureMarks(engine, ly, music).then(got => ({ run, ly, got }));
    })));
  }
  for (const { run: { label, config }, ly, got } of results) {
    if (got.error) { failures.push(`${label}: ${got.error.slice(0, 400)}`); continue; }
    if (got.warnings.length > 0) failures.push(`${label}: ${got.warnings.join("; ")}`);
    const table = _internals.markTable(config);
    const sigOf = ([, mode, spelling]) => table.find(e => e.spelling === spelling && e.mode === mode).sig;
    // A key with no marks (C major's sharps or flats) engraves no signature.
    const drawnKeys = keys.filter(key => sigOf(key).marks.length > 0);
    if (got.signatures.length !== drawnKeys.length) {
      failures.push(`${label}: ${got.signatures.length} signatures engraved, ${drawnKeys.length} drawn`);
      continue;
    }
    const axis = CNBPitchAxis.create(config);
    const space = CNBStaff.staffSpacePx(config, { pxPerSemi: 1, axis });
    const ratio = CNBScheme.parseRatio(config.engine.defaultMagnify);
    const magnify = ratio.num / (ratio.den ?? 1);
    const movetos = sym => {
      const m = new RegExp(`#\\(define cnb:${sym}-path ([\\s\\S]*?)\\n\\n`).exec(ly);
      return m ? (m[1].match(/moveto/g) || []).length : 0;
    };
    const rgbOf = hex => [1, 3, 5].map(j => parseInt(hex.slice(j, j + 2), 16) / 255);
    const sameColor = (hex, got) => rgbOf(hex).every((c, j) => Math.abs(c - (got || [0, 0, 0])[j]) < 1e-3);
    /** A shape symbol's ink, in staff spaces, Y up: its path's box at its size about its origin. */
    const inkOf = (sym, line, pitch) => {
      const shape = config.shapes[sym.shape];
      const b = CNBNotehead.box(shape);
      const sx = (sym.widthSemis ?? shape.semitoneHeight * shape.naturalWidth / shape.naturalHeight) / shape.naturalWidth / space;
      const sy = (sym.heightSemis ?? shape.semitoneHeight) / shape.naturalHeight / space;
      const ox = line + sym.x, oy = pitch + sym.y;
      return { x: [ox + b.x[0] * sx, ox + b.x[1] * sx], y: [oy - b.y[1] * sy, oy - b.y[0] * sy] };
    };
    drawnKeys.forEach((key, k) => {
      const [, mode, spelling] = key;
      const where = `${label}, ${spelling} ${mode}`;
      const sig = sigOf(key);
      const engraved = got.signatures[k];
      // A false hollow's overlay is white; since engine 1.6.0 each mark is drawn once.
      const paths = engraved.paths.filter(p => !p.color.every(c => c === 1));
      const used = new Set();
      const wanted = sig.marks.flatMap(m => m.symbols.filter(s => s.kind !== "sign")).length;
      if (paths.length !== wanted) failures.push(`${where}: ${paths.length} shapes engraved, ${wanted} drawn`);
      const signs = sig.marks.flatMap(m => m.symbols.filter(s => s.kind === "sign")).length;
      if (engraved.glyphs.length !== signs) failures.push(`${where}: ${engraved.glyphs.length} signs engraved, ${signs} drawn`);
      if (engraved.lines.filter(l => near(l.x1, l.x2)).length !== sig.bars.length) {
        failures.push(`${where}: ${engraved.lines.filter(l => near(l.x1, l.x2)).length} gold stems engraved, ${sig.bars.length} drawn`);
      }
      let left = Infinity;
      let right = -Infinity;
      const widen = x => { left = Math.min(left, x[0]); right = Math.max(right, x[1]); };
      const bases = [];   // each head base: its box and its semitone, for the ledgers
      let whites = 0;     // the false hollows drawn, each a white overlay engraved
      for (const { semi, column, symbols: syms } of sig.marks) {
        const line = sig.columns[column];
        const pitch = CNBStaff.lilypondPosition(config, semi) / 2;
        syms.forEach((sym, s) => {
          const what = `${where}: semitone ${semi}, ${s === 0 ? "base" : `added ${s}`} ${sym.shape || sym.sign}`;
          symbols[sym.kind]++;
          if (sym.kind === "sign") {
            const glyph = signGlyphBox(sym.sign, magnify);
            const scale = sym.scale;
            const ox = line + sym.x, oy = pitch + sym.y;
            const g = engraved.glyphs.find(e => e.name === `accidentals.${sym.sign}` &&
              near(e.origin[0], ox) && near(e.origin[1], oy));
            if (!g) { failures.push(`${what}: no sign with its origin at ${ox}, ${oy}`); return; }
            const want = { x: [ox + glyph.x[0] * scale, ox + glyph.x[1] * scale], y: [oy + glyph.y[0] * scale, oy + glyph.y[1] * scale] };
            if (!near(g.x[0], want.x[0]) || !near(g.x[1], want.x[1]) || !near(g.y[0], want.y[0]) || !near(g.y[1], want.y[1])) {
              failures.push(`${what}: engraved box ${JSON.stringify([g.x, g.y])}, drawn ${JSON.stringify([want.x, want.y])}`);
            }
            if (!sameColor(sym.color, g.color)) failures.push(`${what}: colour ${g.color}, drawn ${sym.color}`);
            widen(want.x);
            return;
          }
          const ink = inkOf(sym, line, pitch);
          const p = paths.find((e, j) => !used.has(j) && near(e.x[0], ink.x[0]) && near(e.x[1], ink.x[1]) &&
            near(e.y[0], ink.y[0]) && near(e.y[1], ink.y[1]) && (used.add(j), true));
          if (!p) { failures.push(`${what}: nothing engraved at ${JSON.stringify(ink)}`); return; }
          if (!sameColor(sym.color, p.color)) failures.push(`${what}: colour ${p.color}, drawn ${sym.color}`);
          const f = _internals.sectionCFields(config, sym);
          const hollow = f.hollowSym !== "#f";
          // A true hollow is one path with its cutout as a further subpath; a
          // false hollow (engine.falseHollow) a solid path under a white one.
          const falseHollow = hollow && config.engine.falseHollow;
          const subpaths = movetos(f.shapeSym) + (hollow && !falseHollow ? movetos(`${f.shapeSym}-cutout`) : 0);
          if (p.subpaths !== subpaths) failures.push(`${what}: ${p.subpaths} subpaths, ${sym.hollow ? "hollow" : "solid"} wants ${subpaths}`);
          if (falseHollow) whites++;
          widen(ink.x);
          if (s === 0 && sym.kind === "head") bases.push({ semi, ink });
        });
      }
      const overlays = engraved.paths.length - paths.length;
      if (overlays !== whites) failures.push(`${where}: ${overlays} white overlays engraved, ${whites} false hollows drawn`);
      // The ledgers: each head base's own (cnb:ledgers-by-semitone), centred on
      // its box and 4/3 of it plus their caps; a base sharing its box with
      // another shares its ledgers.
      const ledgers = engraved.lines.filter(l => near(l.y1, l.y2));
      const groups = new Map();
      for (const { semi, ink } of bases) {
        const centre = (ink.x[0] + ink.x[1]) / 2;
        const width = ink.x[1] - ink.x[0];
        const id = `${centre.toFixed(3)} ${width.toFixed(3)}`;
        if (!groups.has(id)) groups.set(id, { centre, width, ys: new Set() });
        for (const s of CNBLedgerSet.ledgersFor(config, [semi], { minSemi: semi - 12, maxSemi: semi + 12 }, axis)) {
          groups.get(id).ys.add((CNBStaff.lilypondPosition(config, s) / 2).toFixed(3));
        }
      }
      const matched = new Set();
      for (const { centre, width, ys } of groups.values()) {
        const length = width * 4 / 3 + 0.2;
        const mine = ledgers.filter((l, j) => near((l.x1 + l.x2) / 2, centre) && near(l.x2 - l.x1 + l.thickness, length) && (matched.add(j), true));
        const e = [...new Set(mine.map(l => l.y1.toFixed(3)))].sort().join(" ");
        const d = [...ys].sort().join(" ");
        if (e !== d) failures.push(`${where}: ledgers at x ${centre.toFixed(3)} engraved at ${e || "none"}, drawn at ${d || "none"}`);
        if (ys.size > 0) widen([centre - length / 2, centre + length / 2]);
      }
      if (matched.size !== ledgers.length) failures.push(`${where}: ${ledgers.length - matched.size} ledgers engraved under no head`);
      if (!Number.isFinite(left)) { left = 0; right = 0; }
      if (!near(engraved.x[0], left) || !near(engraved.x[1], right)) {
        failures.push(`${where}: ink ${engraved.x[0]} … ${engraved.x[1]}, drawn ${left} … ${right}`);
      }
    });
  }
  return { failures, symbols };
}

/** A sign's box about its origin at scale 1, in staff spaces, Y up, in the optical size LilyPond draws at magnify. */
function signGlyphBox(sign, magnify) {
  const g = CNBAccidentalGlyphs.glyph(sign, magnify);
  return { x: g.x, y: g.y };
}

/**
 * The traditional signature (session 54, key-signature design §13.2): session
 * 51's "accidentals" style as the one model converts it, black signs climbing.
 */
function traditional(config) {
  Object.assign(config.keys.keySignature,
    CNBConfig.signatureStyleToModel({ keys: { keySignature: { style: "accidentals" } } }).keys.keySignature);
}

/** The default config with keys and a key signature on, at the engine's defaults, and a G key. */
function keySignatureConfig() {
  const config = CNBConfig.createDefault();
  config.keys.enabled = true;
  config.keys.definitions = [{ name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11] }];
  config.keys.keySignature.enabled = true;
  return config;
}

/** The default config with a red "4" text clef, 4 semitones tall, shown. */
/** base with one of the panel's clefs shown (session 45). */
function builtinClefConfig(base, name) {
  const config = CNBConfig.clone(base);
  config.clef = { enabled: true, active: name,
    glyphs: { [name]: CNBBuiltinClefs.definition(base, name) }, gutter: { paddingH: 12 } };
  return config;
}

function textClefConfig() {
  const config = CNBConfig.createDefault();
  config.clef = {
    enabled: true,
    active: "lbl",
    glyphs: { lbl: { kind: "text", text: "4", textHeightSemis: 4, anchorSemi: 20, fontFamily: "Georgia, serif", color: "#aa0000" } },
    gutter: { paddingH: 12 },
  };
  return config;
}
