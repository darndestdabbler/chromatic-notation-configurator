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
import { findEngine, measureNoteheads, engraveNoteheads, measureClef, measureKeySignature, measureStaffPositions, measureLedgers } from "./engine-probe.js";
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
      // matched to the engine's golden score, which the rebuilt fixture must reproduce.
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

  { name: "sectionA writes SVG anchors relative to the registered path's extent (LilyPond's stem-attachment units)", fn: () => {
      // The default shape's path spans about ±172.4 × ±136.2 SVG units (its
      // curves' true extremes), so the anchor (157.2926, −42.9985) is 0.9122
      // of the half width right and 0.3157 of the half height up, whatever
      // the staff's sps (session 33, LY spec 1.3.8 §4.4b).
      const out = CNBLilypond.sectionA(CNBConfig.createDefault());
      contains(out, "#(cnb:register-attachment! 'crotchet-minim-attach");
      contains(out, "(cons 'crotchet-up   '(0.9122 . 0.3157))");
      contains(out, "(cons 'crotchet-down '(-0.9122 . -0.3157))");
      contains(out, "(cons 'minim-up      '(0.9122 . 0.3157))");
      contains(out, "(cons 'minim-down    '(-0.9122 . -0.3157))");
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
      const pts = _internals.attachmentPoints(shape);
      eq(JSON.stringify(pts.crotchetUp), JSON.stringify({ x: 1, y: 1 }), "corner");
      eq(JSON.stringify(pts.crotchetDown), JSON.stringify({ x: 0, y: 0 }), "centre");
      eq(JSON.stringify(pts.minimUp), JSON.stringify({ x: -1, y: -1 }), "origin corner");
      eq(JSON.stringify(pts.minimDown), JSON.stringify({ x: 0.5, y: -0.5 }), "inside");
    }},

  { name: "sectionA prefers lilypondAnchors (semitone units), relative to the pre-baked path's extent", fn: () => {
      // Kite reference values: the kite path spans ±2 semitones each way, so
      // 1.8 semitones up is the engine's 0.9 and minim x ∓0.73 is ∓0.365, at
      // any sps (session 33).
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
      contains(out, "(cons 'crotchet-up   '(0 . 0.9))");
      contains(out, "(cons 'crotchet-down '(0 . -0.9))");
      contains(out, "(cons 'minim-up      '(-0.365 . 0.9))");
      contains(out, "(cons 'minim-down    '(0.365 . -0.9))");
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
      cfg.engine.multinotePadding = -1;
      cfg.engine.defaultMagnify = "3/2";
      cfg.engine.indent = 5;
      cfg.engine.collisionThreshold = 3;
      const out = CNBLilypond.sectionB(cfg);
      contains(out, "#(set! cnb:false-hollow #t)");
      contains(out, "#(set! cnb:multinote-padding -1)");
      contains(out, "#(set! cnb:default-magnify 3/2)");
      contains(out, "#(set! cnb:indent 5)");
      contains(out, "#(set! cnb:collision-threshold 3)");
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

  { name: "pitch axis: attachment points do not depend on axisUnitsPerStaffSpace (relative units, LY spec 1.3.8 §4.4b)", fn: () => {
      const config = spikeAxisConfig();
      const block = (cfg) => /#\(cnb:register-attachment![\s\S]*?\)\)\)\)/.exec(CNBLilypond.sectionA(cfg))[0];
      const axis2 = block(config);
      config.pitchAxis.axisUnitsPerStaffSpace = 4;
      eq(block(config), axis2, "axis units 2 and 4");
      config.pitchAxis.enabled = false;
      eq(block(config), axis2, "linear");
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

  { name: "sized variants: Section A scales the path and cutout of each variant and keeps its shape's relative attachments", fn: () => {
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
        // the anchor: a variant registers its shape's own points.
        const pts = _internals.attachmentPoints(shape);
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
          execFile(engine.lilypond, ["-I", engine.dir, "-o", path.join(sub, "out"), "score.ly"],
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
          execFile(engine.lilypond, ["-I", engine.dir, "-I", fixtures, "-o", path.join(dir, "out"),
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

/** The default config with keys and a key signature on, at the engine's defaults, and a G key. */
function keySignatureConfig() {
  const config = CNBConfig.createDefault();
  config.keys.enabled = true;
  config.keys.definitions = [{ name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11] }];
  config.keys.keySignature.enabled = true;
  return config;
}

/** The default config with a red "4" text clef, 4 semitones tall, shown. */
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
