/**
 * cnb-builtin-shapes-tests.js — Unit tests for the built-in notehead shapes
 * (session 27, design docs/planning/notehead-first-editor-design.md §2)
 *
 * Each built-in notehead shape equals its source (createDefault, the 45deg-369 and
 * Kite 4-369 fixtures); withShape adds a shape once and never overwrites
 * one; and an unused shape added to a config leaves its export unchanged.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBBuiltinShapes as B } from "../ui/builtin-shapes.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBSvgImporter } from "../ui/svg-importer.js";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function deepEq(a, b, msg) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${msg || "deepEq"}: expected ${jb}, got ${ja}`);
}

function fixture(name) {
  return JSON.parse(readFileSync(path.join(CNB_DIR, "fixtures", name), "utf8"));
}

function near(a, b, msg) {
  if (Math.abs(a - b) > 1e-3) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

/**
 * A conventional notehead's SVG (cnb/assets/shapes/conventional/), read by
 * the SVG importer. Node has no DOMParser, so the document is the file's
 * svg, path and rect elements by id, which is all the importer reads.
 */
function importConventional(file) {
  const text = readFileSync(path.join(CNB_DIR, "assets", "shapes", "conventional", file + ".svg"), "utf8");
  const els = {};
  let root = null;
  for (const m of text.matchAll(/<(svg|path|rect)\b([^>]*?)\/?>/g)) {
    const attrs = {};
    for (const a of m[2].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2].replace(/&#10;/g, "\n");
    const el = { tagName: m[1], getAttribute: k => (k in attrs ? attrs[k] : null) };
    if (m[1] === "svg") root = el;
    else if (attrs.id) els[attrs.id] = el;
  }
  const doc = { documentElement: root, getElementById: id => els[id] || null };
  const built = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), file);
  if (built.error) throw new Error(`${file}: ${built.error}`);
  return { shape: built.shape, doc };
}

/** Twice the signed area of a subpath's end points: its winding's sign. */
function winding(d) {
  const v = [...d.matchAll(/[MLC]([^MLCZ]*)/g)].map(m => m[1].trim().split(/\s+/).map(Number).slice(-2));
  return v.reduce((s, [x, y], i) => { const [x2, y2] = v[(i + 1) % v.length]; return s + x * y2 - x2 * y; }, 0);
}

export const tests = [

  { name: "NAMES: the four built-in shapes, the default oval first", fn: () => {
      deepEq(B.NAMES, ["crotchet-minim", "ellipse-45deg", "kite-up", "kite-down"], "names");
    }},

  { name: "get: each built-in shape equals its source", fn: () => {
      deepEq(B.get("crotchet-minim"), CNBConfig.createDefault().shapes["crotchet-minim"], "crotchet-minim");
      deepEq(B.get("ellipse-45deg"), fixture("45deg-369-config.json").shapes["ellipse-45deg"], "ellipse-45deg");
      const kite = fixture("kite-4-369-config.json").shapes;
      deepEq(B.get("kite-up"), kite["kite-up"], "kite-up");
      deepEq(B.get("kite-down"), kite["kite-down"], "kite-down");
      eq(B.get("diamond"), null, "not a built-in shape");
    }},

  { name: "get: returns a copy", fn: () => {
      const a = B.get("kite-up");
      a.naturalHeight = 1;
      assert(B.get("kite-up").naturalHeight !== 1, "the built-in data is unchanged");
    }},

  { name: "withShape: adds a built-in shape once, leaving the input unchanged", fn: () => {
      const config = CNBConfig.createDefault();
      const added = B.withShape(config, "kite-up");
      deepEq(Object.keys(added.shapes), ["crotchet-minim", "kite-up"], "added");
      deepEq(added.shapes["kite-up"], B.get("kite-up"), "its data");
      deepEq(Object.keys(config.shapes), ["crotchet-minim"], "input unchanged");
      eq(B.withShape(added, "kite-up"), added, "a second add is a no-op");
    }},

  { name: "withShape: never overwrites a shape of that name, and ignores unknown names", fn: () => {
      const config = CNBConfig.createDefault();
      config.shapes["kite-up"] = { ...B.get("kite-up"), displayName: "Mine" };
      eq(B.withShape(config, "kite-up").shapes["kite-up"].displayName, "Mine", "kept");
      eq(B.withShape(config, "diamond"), config, "unknown name");
    }},

  { name: "get: the parallelogram, 2 semitones high and 4 wide, leaning right, solid, stemless, no ledgers (session 64, design §3.5)", fn: () => {
      const p = B.get("parallelogram");
      assert(p !== null, "a built-in shape by name");
      assert(!B.NAMES.includes("parallelogram"), "not among the noteheads' NAMES");
      const unit = p.naturalHeight / p.semitoneHeight;
      eq(p.semitoneHeight, 2, "2 semitones high");
      eq(p.naturalWidth / unit, 4, "4 semitones wide");
      eq(p.svgHollowPath, null, "solid");
      eq(p.anchors, null, "stemless");
      eq(p.ledgers, false, "no ledger lines");
      eq(p.lilypondPath, null, "the exporter converts its SVG path");
      const pts = [...p.svgPath.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number);
      const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
      eq(Math.max(...xs) - Math.min(...xs), p.naturalWidth, "its path spans its width");
      eq(Math.max(...ys) - Math.min(...ys), p.naturalHeight, "and its height, centred on its origin");
      const at = y => xs.filter((_, i) => ys[i] === y);
      assert(Math.min(...at(-p.naturalHeight / 2)) > Math.min(...at(p.naturalHeight / 2)), "leaning right: its top starts right of its bottom");
    }},

  { name: "withShape: the parallelogram enters a config by name, and a key signature drawn with it exports (session 64)", fn: () => {
      const config = B.withShape(CNBConfig.createDefault(), "parallelogram");
      deepEq(config.shapes.parallelogram, B.get("parallelogram"), "added");
      config.keys.enabled = true;
      config.keys.keySignature.enabled = true;
      config.keys.keySignature.looks.all = { shape: "parallelogram" };
      assert(CNBConfig.validate(config).valid, `valid: ${CNBConfig.validate(config).errors}`);
      const ly = CNBLilypond.generate(config);
      assert(ly.includes("cnb:register-path! 'parallelogram"), "its path registered");
      assert(/\(\d+ \d+ symbol parallelogram #f black-000000\)/.test(ly), "its marks the symbol kind, with no ledgers");
    }},

  { name: "get: the conventional crotchet and semibreve are their SVGs as the importer reads them, by name, not among NAMES (session 75)", fn: () => {
      for (const [name, file] of [["conventional-crotchet", "crotchet-and-minim"], ["conventional-semibreve", "semibreve"]]) {
        const { shape } = importConventional(file);
        const builtin = B.get(name);
        assert(!B.NAMES.includes(name), `${name}: not among the noteheads' NAMES`);
        deepEq({ ...builtin, displayName: null }, { ...shape, displayName: null }, name);
      }
    }},

  { name: "get: the conventional breve is the semibreve's head with its two bars joined, each winding as the head does (session 75)", fn: () => {
      const { shape, doc } = importConventional("breve-with-bars-01");
      const breve = B.get("conventional-breve");
      assert(!B.NAMES.includes("conventional-breve"), "not among NAMES");
      const parts = breve.svgPath.split(/(?=M )/).map(s => s.trim());
      eq(parts.length, 3, "the head and two bars");
      eq(parts[0], shape.svgPath, "the head is the file's notehead");
      eq(breve.svgHollowPath, shape.svgHollowPath, "its hollow is the file's");
      const points = d => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number)
        .reduce((ps, v, i, a) => (i % 2 ? ps : [...ps, `${a[i]},${a[i + 1]}`]), []).sort();
      for (const [i, id] of [[1, "breve-bar-left"], [2, "breve-bar-right"]]) {
        const bar = CNBSvgImporter.normalizePath(doc.getElementById(id).getAttribute("d"));
        deepEq([...new Set(points(parts[i]))], [...new Set(points(bar))], `${id}: the file's bar`);
        eq(Math.sign(winding(parts[i])), Math.sign(winding(parts[0])), `${id} winds as the head does, so they fill together`);
      }
      const box = CNBNotehead.box(breve);
      eq(breve.naturalWidth, Math.round((box.x[1] - box.x[0]) * 1e4) / 1e4, "its natural width is the bars' extent");
      eq(breve.lilypondPath, null, "the exporter converts its SVG path");
    }},

  { name: "conventional heads: each 2 semitones tall at its own size, the breve's bars taller than its head (session 75)", fn: () => {
      for (const name of ["conventional-crotchet", "conventional-semibreve", "conventional-breve"]) {
        const s = B.get(name);
        eq(s.semitoneHeight, 2, `${name}: 2 semitones`);
        eq(s.naturalHeight, 200, `${name}: its head's height`);
      }
      const head = CNBNotehead.box(B.get("conventional-semibreve"));
      eq(Math.round(head.y[1] - head.y[0]), 200, "the semibreve's ink is its height");
      const breve = CNBNotehead.box(B.get("conventional-breve"));
      assert(breve.y[1] - breve.y[0] > 250, "the breve's bars reach past its head");
    }},

  { name: "conventional crotchet: its stem anchors at its stem rects, the stem's centre at each rect's end (session 75)", fn: () => {
      const { doc } = importConventional("crotchet-and-minim");
      const rect = id => Object.fromEntries(["x", "y", "width", "height"].map(k => [k, Number(doc.getElementById(id).getAttribute(k))]));
      const up = rect("stem-up"), down = rect("stem-down");
      const a = B.get("conventional-crotchet").anchors;
      near(a.crotchetUp.x, up.x + up.width / 2, "up: the rect's centre across");
      near(a.crotchetUp.y, up.y + up.height, "up: the rect's lower end");
      near(a.crotchetDown.x, down.x + down.width / 2, "down: the rect's centre across");
      near(a.crotchetDown.y, down.y, "down: the rect's upper end");
      deepEq(a.minimUp, a.crotchetUp, "the minim's as the crotchet's");
      eq(B.get("conventional-semibreve").anchors, null, "the semibreve is stemless");
      eq(B.get("conventional-breve").anchors, null, "and so is the breve");
    }},

  { name: "withShape: the conventional heads enter a config by name and export (session 75)", fn: () => {
      let config = CNBConfig.createDefault();
      for (const name of ["conventional-crotchet", "conventional-semibreve", "conventional-breve"]) config = B.withShape(config, name);
      config.noteheadRules[0].apply.shape = "conventional-crotchet";
      config.noteheadRules.push({ name: "Breves", priority: 5,
        match: { pitchClasses: "all", durations: ["breve"], keys: "all" }, apply: { shape: "conventional-breve" } });
      assert(CNBConfig.validate(config).valid, `valid: ${CNBConfig.validate(config).errors}`);
      const ly = CNBLilypond.generate(config);
      assert(ly.includes("cnb:register-path! 'conventional-crotchet"), "the crotchet registered");
      assert(ly.includes("cnb:register-path! 'conventional-breve"), "the breve registered");
    }},

  { name: "withShape: an unused shape leaves the export unchanged", fn: () => {
      const config = CNBConfig.createDefault();
      const ly = (c) => CNBLilypond.generate(c).replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");
      eq(ly(B.withShape(config, "ellipse-45deg")), ly(config), "default export");
    }},
];
