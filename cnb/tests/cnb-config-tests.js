/**
 * cnb-config-tests.js — Unit tests for Module A (Config Schema)
 */

import { readFileSync } from "fs";
import { CNBConfig } from "../src/cnb-config.js";

const KITE_FIXTURE = new URL("../fixtures/kite-4-369-config.json", import.meta.url);

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

function approx(a, b, msg, epsilon = 1e-9) {
  if (!(Math.abs(a - b) <= epsilon)) throw new Error(`${msg || "approx"}: expected ~${b}, got ${a}`);
}

export const tests = [

  // ── VERSION ───────────────────────────────────────────────────────────────
  { name: "VERSION is '1.0'", fn: () => eq(CNBConfig.VERSION, "1.0") },

  // ── createDefault ─────────────────────────────────────────────────────────
  { name: "createDefault() returns an object", fn: () => {
    const cfg = CNBConfig.createDefault();
    assert(cfg && typeof cfg === "object", "should be an object");
  }},
  { name: "createDefault() has version '1.0'", fn: () => {
    eq(CNBConfig.createDefault().version, "1.0");
  }},
  { name: "createDefault() has crotchet-minim shape", fn: () => {
    const cfg = CNBConfig.createDefault();
    assert("crotchet-minim" in cfg.shapes, "shapes should contain 'crotchet-minim'");
  }},
  { name: "createDefault() has staff pattern [4, 8]", fn: () => {
    deepEq(CNBConfig.createDefault().staff.semitonePattern, [4, 8]);
  }},
  { name: "createDefault() has 2 noteheadRules", fn: () => {
    eq(CNBConfig.createDefault().noteheadRules.length, 2);
  }},
  { name: "createDefault() returns a fresh copy each call", fn: () => {
    const a = CNBConfig.createDefault();
    const b = CNBConfig.createDefault();
    a.meta.configName = "MUTATED";
    eq(b.meta.configName, "Default 4-8 System", "mutation of one copy should not affect another");
  }},
  { name: "createDefault() passes validate()", fn: () => {
    const result = CNBConfig.validate(CNBConfig.createDefault());
    // Default config should have no errors (warnings about lilypondPath:null and empty label are OK)
    assert(result.valid, `Default config should be valid. Errors: ${result.errors.join("; ")}`);
  }},
  { name: "createDefault() has no stem settings, and a config carrying them still validates (session 34)", fn: () => {
    const def = CNBConfig.createDefault();
    for (const [section, key] of [["display", "stemThicknessPct"], ["display", "stemExtension"], ["engine", "stemThickness"]]) {
      assert(!(key in def[section]), `${section}.${key} is not a default`);
    }
    Object.assign(def.display, { stemThicknessPct: 26, stemExtension: 2.5 });
    def.engine.stemThickness = "0.1";
    assert(CNBConfig.validate(def).valid, "retired stem settings are ignored");
  }},

  // ── validate — errors ─────────────────────────────────────────────────────
  { name: "validate: missing shape reference → error", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.noteheadRules[0].apply.shape = "nonexistent-shape";
    const result = CNBConfig.validate(cfg);
    assert(!result.valid, "should be invalid");
    assert(result.errors.some(e => e.includes("nonexistent-shape")), "should mention the missing shape");
  }},
  { name: "validate: staff pattern < 2 → error", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.staff.semitonePattern = [4];
    const result = CNBConfig.validate(cfg);
    assert(!result.valid, "should be invalid");
    assert(result.errors.some(e => e.includes("at least 2")), "should mention 2 staff lines");
  }},
  { name: "validate: fileSuffix without hyphen → error", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.meta.fileSuffix = "NoHyphen";
    const result = CNBConfig.validate(cfg);
    assert(!result.valid, "should be invalid");
    assert(result.errors.some(e => e.includes('fileSuffix')), "should mention fileSuffix");
  }},
  { name: "validate: fileSuffix empty string → no error", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.meta.fileSuffix = "";
    const result = CNBConfig.validate(cfg);
    assert(!result.errors.some(e => e.includes('fileSuffix')), "empty fileSuffix should not error");
  }},
  { name: "validate: bad hex in rule color → error", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.noteheadRules.push({
      name: "Bad hex",
      priority: 5,
      match: { pitchClasses: [0], durations: "all", keys: "all" },
      apply: { color: "notahex" },
    });
    const result = CNBConfig.validate(cfg);
    assert(!result.valid, "should be invalid");
    assert(result.errors.some(e => e.includes("notahex")), "should mention bad hex");
  }},
  { name: "validate: PC not covered by any rule → error", fn: () => {
    const cfg = CNBConfig.createDefault();
    // Replace the 'all' rule with one that only covers PCs 0-10
    cfg.noteheadRules = [
      {
        name: "Partial",
        priority: 0,
        match: { pitchClasses: [0,1,2,3,4,5,6,7,8,9,10], durations: "all", keys: "all" },
        apply: { shape: "crotchet-minim", hollow: false, color: null, offKeyMark: false },
      },
    ];
    const result = CNBConfig.validate(cfg);
    assert(!result.valid, "should be invalid");
    assert(result.errors.some(e => e.includes("11")), "should mention PC 11 as uncovered");
  }},
  { name: "validate: bad hex in a rule colour → error", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.noteheadRules[1].apply.color = "BADHEX";
    const result = CNBConfig.validate(cfg);
    assert(!result.valid, "should be invalid");
    assert(result.errors.some(e => e.includes("BADHEX")), "should mention BADHEX");
  }},
  { name: "createDefault: no palette; validate reads none (session 37)", fn: () => {
    const cfg = CNBConfig.createDefault();
    assert(!("palette" in cfg), "no palette section");
    cfg.palette = { colors: [{ pc: 0, hex: "BADHEX" }], cbSafeColors: [], schemeSymbols: { "#1B9E77": "x) (" } };
    const result = CNBConfig.validate(cfg);
    assert(!result.errors.some(e => /palette|BADHEX/i.test(e)), JSON.stringify(result.errors));
    assert(!result.warnings.some(w => /palette/i.test(w)), JSON.stringify(result.warnings));
  }},

  { name: "createDefault: the default notehead's stems are on its sides — the export attaches up at x 1, down at x −1 (session 40)", fn: async () => {
    // LilyPond reads an attachment relative to the notehead's extent, so x 1
    // puts the up stem's right edge on the notehead's right edge.
    const { CNBLilypond } = await import("../src/cnb-lilypond.js");
    const out = CNBLilypond.sectionA(CNBConfig.createDefault());
    for (const [key, x] of [["crotchet-up  ", 1], ["crotchet-down", -1], ["minim-up     ", 1], ["minim-down   ", -1]]) {
      const m = new RegExp(`\\(cons '${key} '\\((\\S+) \\. `).exec(out);
      assert(m && Number(m[1]) === x, `${key.trim()}: x ${m && m[1]}, want ${x}`);
    }
  }},

  // ── validate — warnings ───────────────────────────────────────────────────
  { name: "validate: empty notationLabel → warning", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.meta.notationLabel = "";
    const result = CNBConfig.validate(cfg);
    assert(result.warnings.some(w => w.includes("notationLabel")), "should warn about empty label");
  }},
  { name: "validate: shape with lilypondPath:null → warning", fn: () => {
    const result = CNBConfig.validate(CNBConfig.createDefault());
    // Default shape has lilypondPath:null
    assert(result.warnings.some(w => w.includes("lilypondPath")), "should warn about missing lilypondPath");
  }},
  { name: "validate: a shape nothing uses does not warn about its paths (session 36)", fn: () => {
    const cfg = CNBConfig.createDefault();
    const own = { ...cfg.shapes["crotchet-minim"], lilypondPath: "'((moveto 0 1) (lineto 1 0) (closepath))" };
    cfg.shapes.mine = own;
    cfg.noteheadRules[0].apply.shape = "mine";          // the built-in shape stays, unused
    const warnings = CNBConfig.validate(cfg).warnings;
    assert(!warnings.some(w => w.includes('"crotchet-minim"')), "unused shape silent: " + JSON.stringify(warnings));
    assert(!warnings.some(w => w.includes('"mine" has no lilypondPath')), "the used shape has its path");
    cfg.shapes.mine = { ...own, lilypondPath: null };
    assert(CNBConfig.validate(cfg).warnings.some(w => w.startsWith('Shape "mine" has no lilypondPath')), "a used shape still warns");
  }},
  { name: "validate: a shape used only for one duration, or only in one key with keys on, still warns", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.shapes["crotchet-minim"].lilypondPath = "'((moveto 0 1) (lineto 1 0) (closepath))";
    cfg.shapes.spare = { ...cfg.shapes["crotchet-minim"], lilypondPath: null };
    const warns = () => CNBConfig.validate(cfg).warnings.some(w => w.startsWith('Shape "spare" has no lilypondPath'));
    assert(!warns(), "unused: silent");
    cfg.noteheadRules.push({ name: "Breve", priority: 5, match: { pitchClasses: "all", durations: ["breve"], keys: "all" }, apply: { shape: "spare" } });
    assert(warns(), "used by the breve: warns");
    cfg.noteheadRules.pop();
    cfg.keys.definitions = [{ name: "G", pitchClasses: [0, 2, 4, 6, 7, 9, 11] }];
    cfg.noteheadRules.push({ name: "In G", priority: 5, match: { pitchClasses: [6], durations: "all", keys: ["G"] }, apply: { shape: "spare" } });
    assert(!warns(), "keys off: the key's rule draws nothing, silent");
    cfg.keys.enabled = true;
    assert(warns(), "keys on: used in G, warns");
  }},

  // ── merge ─────────────────────────────────────────────────────────────────
  { name: "merge: empty partial over default = structurally equal to default", fn: () => {
    const def = CNBConfig.createDefault();
    const merged = CNBConfig.merge(def, {});
    deepEq(merged, def);
  }},
  { name: "merge: changes pxPerSemi without affecting other display fields", fn: () => {
    const def = CNBConfig.createDefault();
    const merged = CNBConfig.merge(def, { display: { pxPerSemi: 20 } });
    eq(merged.display.pxPerSemi, 20, "pxPerSemi should be 20");
    eq(merged.display.column.paddingH, def.display.column.paddingH, "column padding unchanged");
    eq(merged.display.debugGrid, false, "debugGrid unchanged");
  }},
  { name: "merge: merging new noteheadRules replaces the array entirely", fn: () => {
    const def = CNBConfig.createDefault();
    const newRules = [{ name: "Only", priority: 0, match: { pitchClasses: "all", durations: "all", keys: "all" }, apply: { shape: "crotchet-minim", hollow: false, color: null, offKeyMark: false } }];
    const merged = CNBConfig.merge(def, { noteheadRules: newRules });
    eq(merged.noteheadRules.length, 1, "should have exactly 1 rule");
    eq(merged.noteheadRules[0].name, "Only");
  }},
  { name: "merge: nested display.label preserves unmodified sibling fields", fn: () => {
    const def = CNBConfig.createDefault();
    const merged = CNBConfig.merge(def, { display: { label: { fontSize: 30 } } });
    eq(merged.display.label.fontSize, 30, "fontSize changed");
    eq(merged.display.label.color, "#555555", "color unchanged");
    eq(merged.display.label.fontFamily, "Oswald", "fontFamily unchanged");
  }},
  { name: "merge: does not mutate base", fn: () => {
    const def = CNBConfig.createDefault();
    CNBConfig.merge(def, { display: { pxPerSemi: 99 } });
    eq(def.display.pxPerSemi, 16, "original base should be unmodified");
  }},
  { name: "merge: does not mutate partial", fn: () => {
    const def = CNBConfig.createDefault();
    const partial = { display: { pxPerSemi: 99 } };
    CNBConfig.merge(def, partial);
    eq(partial.display.pxPerSemi, 99, "partial should be unmodified");
    assert(!("debugGrid" in partial.display), "partial should not gain extra keys");
  }},

  // ── clone ─────────────────────────────────────────────────────────────────
  { name: "clone: mutating clone does not affect original", fn: () => {
    const orig = CNBConfig.createDefault();
    const copy = CNBConfig.clone(orig);
    copy.meta.configName = "MUTATED";
    eq(orig.meta.configName, "Default 4-8 System", "original unmodified");
  }},
  { name: "clone: deeply nested objects are independent", fn: () => {
    const orig = CNBConfig.createDefault();
    const copy = CNBConfig.clone(orig);
    copy.shapes["crotchet-minim"].displayName = "changed";
    eq(orig.shapes["crotchet-minim"].displayName, "Crotchet–Minim", "original shape unchanged");
  }},
  { name: "clone: arrays are independent", fn: () => {
    const orig = CNBConfig.createDefault();
    const copy = CNBConfig.clone(orig);
    copy.staff.semitonePattern.push(12);
    eq(orig.staff.semitonePattern.length, 2, "original array unchanged");
  }},

  // ── resolveNotehead ───────────────────────────────────────────────────────
  { name: "resolveNotehead: PC 0 → solid crotchet-minim (default 4-8 config)", fn: () => {
    const cfg = CNBConfig.createDefault();
    const r = CNBConfig.resolveNotehead(cfg, 0, "crotchet", null);
    eq(r.shape, "crotchet-minim");
    eq(r.hollow, false);
    eq(r.color, null);
    eq(r.offKeyMark, false);
  }},
  { name: "resolveNotehead: PC 1 (C♯) → hollow crotchet-minim", fn: () => {
    const cfg = CNBConfig.createDefault();
    const r = CNBConfig.resolveNotehead(cfg, 1, "crotchet", null);
    eq(r.shape, "crotchet-minim", "shape inherited from lower priority rule");
    eq(r.hollow, true, "hollow set by higher priority rule");
  }},
  { name: "resolveNotehead: PC 3, 6, 8, 10 are hollow (default 4-8)", fn: () => {
    const cfg = CNBConfig.createDefault();
    for (const pc of [3, 6, 8, 10]) {
      const r = CNBConfig.resolveNotehead(cfg, pc, "crotchet", null);
      eq(r.hollow, true, `PC ${pc} should be hollow`);
    }
  }},
  { name: "resolveNotehead: PC 0, 2, 4, 5, 7, 9, 11 are solid (default 4-8)", fn: () => {
    const cfg = CNBConfig.createDefault();
    for (const pc of [0, 2, 4, 5, 7, 9, 11]) {
      const r = CNBConfig.resolveNotehead(cfg, pc, "crotchet", null);
      eq(r.hollow, false, `PC ${pc} should be solid`);
    }
  }},
  { name: "resolveNotehead: higher priority wins over lower", fn: () => {
    const cfg = CNBConfig.createDefault();
    // Add a rule at priority 2 that overrides shape for PC 0
    cfg.shapes["special"] = { ...cfg.shapes["crotchet-minim"], displayName: "Special" };
    cfg.noteheadRules.push({
      name: "Special shape for C",
      priority: 2,
      match: { pitchClasses: [0], durations: "all", keys: "all" },
      apply: { shape: "special" },
    });
    const r = CNBConfig.resolveNotehead(cfg, 0, "crotchet", null);
    eq(r.shape, "special", "higher priority rule wins");
    eq(r.hollow, false, "hollow inherited from lower priority");
  }},
  { name: "resolveNotehead: partial apply inherits other fields", fn: () => {
    const cfg = CNBConfig.createDefault();
    // Add rule that only changes color for PC 5
    cfg.noteheadRules.push({
      name: "Color only",
      priority: 3,
      match: { pitchClasses: [5], durations: "all", keys: "all" },
      apply: { color: "#FF0000" },
    });
    const r = CNBConfig.resolveNotehead(cfg, 5, "crotchet", null);
    eq(r.shape, "crotchet-minim", "shape inherited");
    eq(r.hollow, false, "hollow inherited");
    eq(r.color, "#FF0000", "color from new rule");
  }},

  // ── notehead size (session 22) ────────────────────────────────────────────
  { name: "resolveNotehead: heightSemis / widthSemis default to null (the shape's own size)", fn: () => {
    const cfg = CNBConfig.createDefault();
    for (let pc = 0; pc < 12; pc++) {
      const r = CNBConfig.resolveNotehead(cfg, pc, "crotchet", null);
      eq(r.heightSemis, null, `pc ${pc} height`);
      eq(r.widthSemis, null, `pc ${pc} width`);
    }
  }},
  { name: "resolveNotehead: heightSemis / widthSemis merge cumulatively and inherit", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.noteheadRules.push(
      { name: "big sharps", priority: 2, match: { pitchClasses: [1, 3], durations: "all", keys: "all" },
        apply: { heightSemis: 3, widthSemis: 4 } },
      { name: "narrow D#", priority: 3, match: { pitchClasses: [3], durations: "all", keys: "all" },
        apply: { widthSemis: 2 } },
    );
    const cs = CNBConfig.resolveNotehead(cfg, 1, "crotchet", null);
    eq(cs.heightSemis, 3, "C# height"); eq(cs.widthSemis, 4, "C# width");
    const ds = CNBConfig.resolveNotehead(cfg, 3, "crotchet", null);
    eq(ds.heightSemis, 3, "D# height inherited"); eq(ds.widthSemis, 2, "D# width overridden");
    eq(ds.hollow, true, "other fields unaffected");
    const c = CNBConfig.resolveNotehead(cfg, 0, "crotchet", null);
    eq(c.heightSemis, null, "C unsized"); eq(c.widthSemis, null, "C unsized");
  }},
  { name: "validate: a non-finite or non-positive heightSemis / widthSemis is an error naming the rule", fn: () => {
    for (const bad of [0, -1, NaN, Infinity, "2", null]) {
      const cfg = CNBConfig.createDefault();
      cfg.noteheadRules[1].apply.heightSemis = bad;
      cfg.noteheadRules[1].apply.widthSemis = bad;
      const v = CNBConfig.validate(cfg);
      eq(v.valid, false, `${JSON.stringify(bad)} invalid`);
      assert(v.errors.some(e => e.includes('"Sharps are hollow"') && e.includes("apply.heightSemis")), `height error for ${bad}: ${v.errors}`);
      assert(v.errors.some(e => e.includes('"Sharps are hollow"') && e.includes("apply.widthSemis")), `width error for ${bad}: ${v.errors}`);
    }
  }},
  { name: "validate: heightSemis / widthSemis outside 0.25–4 warn; inside, no warning", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.noteheadRules[1].apply.heightSemis = 0.2;
    cfg.noteheadRules[1].apply.widthSemis = 5;
    const v = CNBConfig.validate(cfg);
    eq(v.valid, true, "out-of-range sizes still valid");
    assert(v.warnings.some(w => w.includes('"Sharps are hollow"') && w.includes("apply.heightSemis")), "height warning");
    assert(v.warnings.some(w => w.includes('"Sharps are hollow"') && w.includes("apply.widthSemis")), "width warning");
    const ok = CNBConfig.createDefault();
    ok.noteheadRules[1].apply.heightSemis = 0.25;
    ok.noteheadRules[1].apply.widthSemis = 4;
    const w = CNBConfig.validate(ok);
    eq(w.valid, true, "in range valid");
    assert(!w.warnings.some(x => x.includes("Semis")), `no size warning: ${w.warnings}`);
  }},

  { name: "resolveNotehead: duration matching (rule for crotchet only)", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.noteheadRules.push({
      name: "Crotchet only hollow",
      priority: 5,
      match: { pitchClasses: [0], durations: ["crotchet"], keys: "all" },
      apply: { hollow: true },
    });
    const crotchet = CNBConfig.resolveNotehead(cfg, 0, "crotchet", null);
    const minim    = CNBConfig.resolveNotehead(cfg, 0, "minim", null);
    eq(crotchet.hollow, true,  "crotchet should be hollow");
    eq(minim.hollow,    false, "minim should not be hollow (rule doesn't match)");
  }},
  { name: "resolveNotehead: 'all' match.pitchClasses matches every PC", fn: () => {
    const cfg = CNBConfig.createDefault();
    // The default rule has pitchClasses: "all" — verify it hits all 12
    for (let pc = 0; pc < 12; pc++) {
      const r = CNBConfig.resolveNotehead(cfg, pc, "crotchet", null);
      assert(r.shape !== undefined, `PC ${pc} should resolve a shape`);
    }
  }},

  // ── paletteToRules (session 37) ───────────────────────────────────────────
  { name: "paletteToRules: a config without a palette comes back as it is", fn: () => {
    const cfg = CNBConfig.createDefault();
    assert(CNBConfig.paletteToRules(cfg) === cfg, "same object");
  }},
  { name: "paletteToRules: each non-black colour becomes a rule below every existing rule; the palette goes", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.palette = {
      name: "Two", useCBSafe: true, schemeSymbols: {},
      colors: [{ pc: 0, hex: "#FF0000", name: "Red" }, { pc: 1, hex: "#00ff00" }, { pc: 2, hex: "#ff0000" }, { pc: 3, hex: "#000000" }],
      cbSafeColors: [{ pc: 0, hex: "#CC0000" }],
    };
    const before = JSON.stringify(cfg);
    const out = CNBConfig.paletteToRules(cfg);
    eq(JSON.stringify(cfg), before, "input unchanged");
    assert(!("palette" in out), "palette gone");
    eq(out.noteheadRules.length, 4, "two colour rules added");
    deepEq(out.noteheadRules[0], { name: "Colour Red", priority: 0, match: { pitchClasses: [0, 2], durations: "all", keys: "all" }, apply: { color: "#FF0000" } }, "red rule");
    deepEq(out.noteheadRules[1].match.pitchClasses, [1], "green pcs");
    eq(out.noteheadRules[1].name, "Colour #00ff00", "unnamed colour named by hex");
    eq(out.noteheadRules[2].name, "Default", "existing rules follow");
    deepEq(out.noteheadRules.map(r => r.priority), [0, 1, 2, 3], "existing raised above, order kept");
    for (let pc = 0; pc < 12; pc++) {
      const want = { 0: "#FF0000", 1: "#00ff00", 2: "#FF0000" }[pc] ?? null;
      eq(CNBConfig.resolveNotehead(out, pc, "crotchet", null).color, want, `pc ${pc} (primary colours, not the colour-blind set)`);
    }
  }},
  { name: "paletteToRules: an explicit rule colour still wins; color:null (use the palette) is dropped", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.palette = { colors: [{ pc: 0, hex: "#ff0000" }, { pc: 1, hex: "#ff0000" }] };
    cfg.noteheadRules.push({ name: "Blue C", priority: 5, match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { color: "#0000ff" } });
    const out = CNBConfig.paletteToRules(cfg);
    eq(CNBConfig.resolveNotehead(out, 0, "crotchet", null).color, "#0000ff", "explicit wins");
    eq(CNBConfig.resolveNotehead(out, 1, "crotchet", null).color, "#ff0000", "palette shows through the Default's color:null");
    assert(!("color" in out.noteheadRules.find(r => r.name === "Default").apply), "color:null dropped");
  }},
  { name: "paletteToRules: Kite 4-369 previews as before for every pitch class × duration", fn: () => {
    // The fixture as saved before session 37: its colours in a palette (the
    // colour-blind set the same), the Default saying color:null ("use the
    // palette"), and no colour rules.
    const converted = JSON.parse(readFileSync(KITE_FIXTURE, "utf8"));
    const kite = CNBConfig.clone(converted);
    kite.noteheadRules = kite.noteheadRules.filter(r => !(Object.keys(r.apply).length === 1 && "color" in r.apply));
    kite.noteheadRules.find(r => r.match.pitchClasses === "all").apply.color = null;
    const colors = [...Array(12).keys()].map(pc => ({ pc, hex: CNBConfig.resolveNotehead(converted, pc, "crotchet", null).color || "#000000" }));
    kite.palette = { name: "Kite CB-safe (skyblue/rose/black)", colors, cbSafeColors: colors, useCBSafe: false,
      schemeSymbols: { "#50b4e9": "skyblue-50b4e9", "#cc79a7": "rose-cc79a7" } };
    eq(new Set(colors.map(c => c.hex)).size, 3, "three colours, black among them");
    const was = (pc, d) => {
      const c = CNBConfig.resolveNotehead(kite, pc, d, null).color;
      if (c !== null) return c;
      const e = kite.palette.colors.find(x => x.pc === pc);
      return e && e.hex.toLowerCase() !== "#000000" ? e.hex : null;
    };
    const out = CNBConfig.paletteToRules(kite);
    for (const { name } of kite.durations.definitions) {
      for (let pc = 0; pc < 12; pc++) {
        const got = CNBConfig.resolveNotehead(out, pc, name, null);
        eq(got.color, was(pc, name), `pc ${pc} ${name}`);
        const old = CNBConfig.resolveNotehead(kite, pc, name, null);
        assert(got.shape === old.shape && got.hollow === old.hollow, `pc ${pc} ${name} look kept`);
      }
    }
    const looks = (rules) => rules.map(r => [r.match, r.apply]);
    deepEq(looks(out.noteheadRules), looks(converted.noteheadRules), "the converted fixture's rules, in order");
  }},
  { name: "createDefault: the engine has no useAccessibleColors (retired, session 37)", fn: () => {
    assert(!("useAccessibleColors" in CNBConfig.createDefault().engine), "retired");
  }},

  // ── pctToPx ───────────────────────────────────────────────────────────────
  { name: "pctToPx(20, 16) = 3.2",  fn: () => approx(CNBConfig.pctToPx(20,  16), 3.2,  "pctToPx(20,16)") },
  { name: "pctToPx(100, 16) = 16",  fn: () => approx(CNBConfig.pctToPx(100, 16), 16,   "pctToPx(100,16)") },
  { name: "pctToPx(0, 16) = 0",     fn: () => approx(CNBConfig.pctToPx(0,   16), 0,    "pctToPx(0,16)") },
  { name: "pctToPx(40, 20) = 8",    fn: () => approx(CNBConfig.pctToPx(40,  20), 8,    "pctToPx(40,20)") },
  { name: "pctToPx(26, 16) = 4.16", fn: () => approx(CNBConfig.pctToPx(26,  16), 4.16, "pctToPx(26,16)") },

  // ── Clef section (set 009): defaults, merge, validation ──────────────────

  { name: "clef: default config has clef section — disabled, no active, empty glyphs, paddingH 12", fn: () => {
    const cfg = CNBConfig.createDefault();
    eq(cfg.clef.enabled, false, "enabled");
    eq(cfg.clef.active, null, "active");
    eq(Object.keys(cfg.clef.glyphs).length, 0, "glyphs empty");
    eq(cfg.clef.gutter.paddingH, 12, "gutter padding");
  }},

  { name: "clef: merge — config predating the clef section gains the default-off clef", fn: () => {
    const old = CNBConfig.createDefault();
    delete old.clef;
    const merged = CNBConfig.merge(CNBConfig.createDefault(), old);
    eq(merged.clef.enabled, false, "clef restored default-off");
  }},

  { name: "clef: validate — default (disabled) config produces no clef errors or warnings", fn: () => {
    const result = CNBConfig.validate(CNBConfig.createDefault());
    assert(result.valid, "default config valid");
    assert(!result.errors.some(e => /clef/i.test(e)), "no clef errors");
    assert(!result.warnings.some(w => /clef/i.test(w)), "no clef warnings");
  }},

  { name: "clef: validate — enabled without active is an error", fn: () => {
    const cfg = clefConfig();
    cfg.clef.active = null;
    const result = CNBConfig.validate(cfg);
    assert(result.errors.some(e => e.includes("clef.active names no glyph")), "error emitted");
  }},

  { name: "clef: validate — active referencing an unknown glyph is an error", fn: () => {
    const cfg = clefConfig();
    cfg.clef.active = "nope";
    const result = CNBConfig.validate(cfg);
    assert(result.errors.some(e => e.includes('unknown clef glyph "nope"')), "error emitted");
  }},

  { name: "clef: validate — well-formed enabled clef adds no errors", fn: () => {
    const result = CNBConfig.validate(clefConfig());
    assert(result.valid, "valid: " + result.errors.join("; "));
  }},

  { name: "clef: validate — FLOAT anchorSemi is accepted (s1 anchoring decision)", fn: () => {
    // Surveyed clef designs (Bravura gClef top +1.392 staff-spaces above
    // the top line, Clairnote fractional glyph extents) need non-integer
    // anchors, so anchorSemi is validated as any finite number.
    const result = CNBConfig.validate(clefConfig({ anchorSemi: 22.784 }));
    assert(result.valid, "float anchor valid: " + result.errors.join("; "));
    assert(!result.warnings.some(w => /anchorSemi/.test(w)), "no anchor warning in range");
  }},

  { name: "clef: validate — missing/non-numeric anchorSemi is an error", fn: () => {
    const result = CNBConfig.validate(clefConfig({ anchorSemi: undefined }));
    assert(result.errors.some(e => e.includes("no numeric anchorSemi")), "error emitted");
  }},

  { name: "clef: validate — anchorSemi far outside typical range is a warning, not an error", fn: () => {
    const result = CNBConfig.validate(clefConfig({ anchorSemi: 100 }));
    assert(result.valid, "still valid");
    assert(result.warnings.some(w => w.includes("far outside the typical range")), "warning emitted");
  }},

  { name: "clef: validate — glyph kind missing svgPath / dimensions is an error", fn: () => {
    const result = CNBConfig.validate(clefConfig({ svgPath: "", naturalHeight: 0 }));
    assert(result.errors.some(e => e.includes("has no svgPath")), "svgPath error");
    assert(result.errors.some(e => e.includes("positive natural dimensions")), "dimensions error");
  }},

  { name: "clef: validate — text kind requires text and positive textHeightSemis", fn: () => {
    const bad = CNBConfig.validate(clefConfig({ kind: "text", text: "", textHeightSemis: 0 }));
    assert(bad.errors.some(e => e.includes("has no text")), "text error");
    assert(bad.errors.some(e => e.includes("positive textHeightSemis")), "height error");
    const good = CNBConfig.validate(clefConfig({ kind: "text", text: "4", textHeightSemis: 5 }));
    assert(good.valid, "text entry valid: " + good.errors.join("; "));
  }},

  { name: "clef: validate — unknown kind is an error", fn: () => {
    const result = CNBConfig.validate(clefConfig({ kind: "hologram" }));
    assert(result.errors.some(e => e.includes('unknown kind "hologram"')), "error emitted");
    assert(result.errors.some(e => e.includes('"dozenal"')), "the message names the dozenal kind");
  }},

  { name: "clef: validate — the dozenal kind needs no path, size or anchor", fn: () => {
    const config = CNBConfig.createDefault();
    config.clef = { ...config.clef, enabled: true, active: "dozenal",
      glyphs: { dozenal: { kind: "dozenal", displayName: "Dozenal" } } };
    const result = CNBConfig.validate(config);
    assert(result.valid, "dozenal clef valid: " + result.errors.join("; "));
    assert(!result.warnings.some(w => /clef/i.test(w)), "no clef warnings: " + result.warnings.join("; "));
  }},

  { name: "clef: validate — wrong-typed clef.glyphs reports errors instead of throwing", fn: () => {
    for (const badGlyphs of [42, "map", [1, 2]]) {
      const cfg = clefConfig();
      cfg.clef.glyphs = badGlyphs;
      const result = CNBConfig.validate(cfg);
      assert(result.errors.some(e => e.includes("clef.glyphs must be an object map")),
        "glyphs type error for " + JSON.stringify(badGlyphs));
      assert(result.errors.some(e => e.includes("unknown clef glyph")),
        "active unresolvable for " + JSON.stringify(badGlyphs));
    }
  }},

  { name: "clef: validate — null/primitive glyph definition reports an error instead of throwing", fn: () => {
    for (const badDef of [null, 7, "glyph"]) {
      const cfg = clefConfig();
      cfg.clef.glyphs["test-clef"] = badDef;
      const result = CNBConfig.validate(cfg);
      assert(result.errors.some(e => e.includes('Clef glyph "test-clef" is not an object')),
        "def type error for " + JSON.stringify(badDef));
    }
  }},

  { name: "clef: validate — malformed clef section (non-object) is treated as absent, no throw", fn: () => {
    for (const badClef of [7, "on", [true], null]) {
      const cfg = CNBConfig.createDefault();
      cfg.clef = badClef;
      const result = CNBConfig.validate(cfg);
      assert(result.valid, "no clef errors for clef = " + JSON.stringify(badClef));
    }
  }},

  { name: "clef: validate — non-string active (enabled) reports the no-glyph error, no throw", fn: () => {
    const cfg = clefConfig();
    cfg.clef.active = 3;
    const result = CNBConfig.validate(cfg);
    assert(result.errors.some(e => e.includes("clef.active names no glyph")), "error emitted");
  }},

  { name: "clef: validate — gutter.paddingH must be a finite non-negative number when enabled", fn: () => {
    for (const bad of [-4, NaN, "12", Infinity]) {
      const result = CNBConfig.validate(clefConfig({}, { gutter: { paddingH: bad } }));
      assert(result.errors.some(e => e.includes("clef.gutter.paddingH must be a finite non-negative number")),
        "paddingH error for " + String(bad));
    }
    const zero = CNBConfig.validate(clefConfig({}, { gutter: { paddingH: 0 } }));
    assert(zero.valid, "paddingH 0 valid");
    const absent = CNBConfig.validate(clefConfig({}, { gutter: undefined }));
    assert(absent.valid, "absent gutter valid (renderer defaults 12)");
    const nonObject = CNBConfig.validate(clefConfig({}, { gutter: "wide" }));
    assert(nonObject.errors.some(e => e.includes("clef.gutter must be an object")), "gutter type error");
  }},

  // ── keys.keySignature (set 010) ───────────────────────────────────────────

  { name: "keysig: default config has keySignature section — disabled, notehead-chords style, scale-from-tonic placement, gold separator", fn: () => {
    const ks = CNBConfig.createDefault().keys.keySignature;
    eq(ks.enabled, false, "enabled");
    eq(ks.style, "notehead-chords", "default style per the operator directive (engine keysig.ly)");
    eq(ks.placement.rule, "scale-from-tonic", "placement rule (s1 decision D1)");
    eq(ks.placement.tonicOctave, null, "tonicOctave auto");
    eq(ks.separator.enabled, true, "separator on");
    eq(ks.separator.color, "#ffd42a", "engine cnb:gold");
    eq(ks.separator.thicknessPct, 160, "separator thickness (0.4 staff-space at sps 4 — engine bar, s2 UAT measurement)");
    eq(ks.separator.extentSemis, 12, "±1 octave like the engine bar");
    assert(!("gutter" in ks), "no gutter setting: the spacing is the engine's (session 34)");
    // style is a single-value vocabulary — no per-alternate-style config
    // subsections (the simple-mark styles were removed at the task owner's
    // s2 UAT direction; s2-uat.md).
    assert(!("dot" in ks) && !("intervalBlocks" in ks) && !("staggeredLedgers" in ks),
      "no simple-mark style subsections");
  }},

  { name: "keysig: the designer's settings (session 48) default to today's signature, and a config without them gains them on merge", fn: () => {
    const ks = CNBConfig.createDefault().keys.keySignature;
    eq(ks.notes, "all", "the whole scale");
    eq(ks.upperTonic, true, "the tonic an octave up");
    deepEq(ks.looks, { all: {}, flat: {}, sharp: {} }, "every mark looks like its notehead");
    eq(ks.stacking, "degrees", "stacked sevenths");
    deepEq(ks.alternate, {}, "every second stack as the others");
    eq(ks.columns, "right", "stacks go to the right");
    eq(ks.placement.position, "middle", "in the middle of the staff");
    eq(ks.separator.shareThickness, true, "several stems share the thickness");
    const old = CNBConfig.createDefault();
    for (const f of ["notes", "upperTonic", "looks", "stacking", "alternate", "columns"]) delete old.keys.keySignature[f];
    delete old.keys.keySignature.placement.position;
    delete old.keys.keySignature.separator.shareThickness;
    deepEq(CNBConfig.merge(CNBConfig.createDefault(), old).keys.keySignature, ks, "merged");
    const enabledOld = keysigConfig();
    for (const f of ["notes", "upperTonic", "looks", "stacking", "alternate", "columns"]) delete enabledOld.keys.keySignature[f];
    assert(CNBConfig.validate(enabledOld).valid, "absent settings are their defaults");
  }},

  { name: "keysig: validate — the designer's vocabularies and switches are checked", fn: () => {
    const good = keysigConfig();
    Object.assign(good.keys.keySignature, { notes: "tonic-and-half-steps", upperTonic: false,
      stacking: "parity-zigzag", columns: "left-in-sharp-keys" });
    good.keys.keySignature.placement.position = "every-set";
    good.keys.keySignature.separator.shareThickness = false;
    assert(CNBConfig.validate(good).valid, `every valid value: ${CNBConfig.validate(good).errors}`);
    for (const [field, bad] of [["notes", "some"], ["stacking", "columns"], ["columns", "left"],
                                ["placement.position", "near-the-notes"], ["upperTonic", "yes"],
                                ["separator.shareThickness", 1]]) {
      const cfg = keysigConfig();
      const [a, b] = field.split(".");
      if (b) cfg.keys.keySignature[a][b] = bad; else cfg.keys.keySignature[a] = bad;
      assert(CNBConfig.validate(cfg).errors.some(e => e.includes(`keys.keySignature.${field}`)), `${field} ${JSON.stringify(bad)}`);
    }
    const off = keysigConfig();
    off.keys.keySignature.enabled = false;
    off.keys.keySignature.stacking = "spiral";
    assert(CNBConfig.validate(off).valid, "not checked with the signature off, as today");
  }},

  { name: "keysig: validate — a look is checked as a notehead rule's apply block; every second stack's takes no size", fn: () => {
    const good = keysigConfig();
    good.keys.keySignature.looks = { all: { shape: "crotchet-minim", heightSemis: 1, widthSemis: 1.5 },
      flat: { hollow: true, color: "#0000ff" }, sharp: { color: null } };
    good.keys.keySignature.alternate = { shape: "crotchet-minim", hollow: false, color: "#ff0000" };
    assert(CNBConfig.validate(good).valid, `valid looks: ${CNBConfig.validate(good).errors}`);
    const errorFor = (looks, alternate) => {
      const cfg = keysigConfig();
      if (looks) cfg.keys.keySignature.looks = looks;
      if (alternate) cfg.keys.keySignature.alternate = alternate;
      return CNBConfig.validate(cfg).errors.join("\n");
    };
    assert(/looks\.all references unknown shape "dot"/.test(errorFor({ all: { shape: "dot" } })), "unknown shape");
    assert(/looks\.flat has invalid color hex/.test(errorFor({ flat: { color: "blue" } })), "bad colour");
    assert(/looks\.sharp\.hollow must be true or false/.test(errorFor({ sharp: { hollow: 1 } })), "bad hollow");
    assert(/looks\.all\.heightSemis must be a finite number/.test(errorFor({ all: { heightSemis: 0 } })), "bad size");
    assert(/looks\.natural is not a look/.test(errorFor({ natural: {} })), "no naturals look: all marks stands for them");
    assert(/alternate\.heightSemis is not a look setting/.test(errorFor(null, { heightSemis: 1 })), "no size on every second stack");
    assert(/looks must be an object/.test(errorFor("small")), "looks not an object");
    const tiny = keysigConfig();
    tiny.keys.keySignature.looks.all = { heightSemis: 0.1 };
    assert(CNBConfig.validate(tiny).warnings.some(w => /looks\.all\.heightSemis is 0\.1 semitones/.test(w)), "size warning");
  }},

  { name: "keysig: merge — config predating the keySignature section gains the default-off subsection", fn: () => {
    const old = CNBConfig.createDefault();
    delete old.keys.keySignature;
    const merged = CNBConfig.merge(CNBConfig.createDefault(), old);
    eq(merged.keys.keySignature.enabled, false, "keySignature restored default-off");
    eq(merged.keys.keySignature.style, "notehead-chords", "default style restored");
  }},

  { name: "keysig: validate — default (disabled) config produces no keysig errors or warnings", fn: () => {
    const result = CNBConfig.validate(CNBConfig.createDefault());
    assert(result.valid, "valid");
    assert(!result.errors.some(e => /keySignature|key definition/i.test(e)), "no keysig errors");
    assert(!result.warnings.some(w => /keySignature|key definition/i.test(w)), "no keysig warnings");
  }},

  { name: "keysig: validate — well-formed enabled key signature adds no errors", fn: () => {
    const result = CNBConfig.validate(keysigConfig());
    assert(result.valid, `no errors expected: ${result.errors.join("; ")}`);
  }},

  { name: "keysig: validate — enabled while keys.enabled is false is a warning (E2 gate)", fn: () => {
    const cfg = keysigConfig();
    cfg.keys.enabled = false;
    const result = CNBConfig.validate(cfg);
    assert(result.warnings.some(w => w.includes("keys.enabled is false")), "gate warning emitted");
  }},

  { name: "keysig: validate — notehead-chords passes; unknown style is an error; absent falls back to the default", fn: () => {
    const ok = keysigConfig();
    ok.keys.keySignature.style = "notehead-chords";
    assert(CNBConfig.validate(ok).valid, "notehead-chords valid");
    for (const bad of ["sparkles", "dot", "interval-blocks", "staggered-ledgers"]) {
      const cfg = keysigConfig();
      cfg.keys.keySignature.style = bad;
      assert(CNBConfig.validate(cfg).errors.some(e => e.includes("keys.keySignature.style")),
        `${bad} rejected (only notehead-chords is implemented)`);
    }
    const absent = keysigConfig();
    delete absent.keys.keySignature.style;
    assert(CNBConfig.validate(absent).valid, "absent style valid (defaults to notehead-chords)");
  }},

  { name: "keysig: validate — placement.rule must be a known rule; absent placement/rule defaults", fn: () => {
    const badRule = keysigConfig();
    badRule.keys.keySignature.placement = { rule: "spiral", tonicOctave: null };
    assert(CNBConfig.validate(badRule).errors.some(e => e.includes("placement.rule")), "rule error");
    const nonObject = keysigConfig();
    nonObject.keys.keySignature.placement = "top";
    assert(CNBConfig.validate(nonObject).errors.some(e => e.includes("placement must be an object")), "type error");
    const absent = keysigConfig();
    delete absent.keys.keySignature.placement;
    assert(CNBConfig.validate(absent).valid, "absent placement valid (renderer defaults scale-from-tonic)");
  }},

  { name: "keysig: validate — placement.tonicOctave must be an integer or null", fn: () => {
    for (const bad of [1.5, "1", NaN]) {
      const cfg = keysigConfig();
      cfg.keys.keySignature.placement = { rule: "scale-from-tonic", tonicOctave: bad };
      assert(CNBConfig.validate(cfg).errors.some(e => e.includes("placement.tonicOctave")),
        "tonicOctave error for " + String(bad));
    }
    const explicit = keysigConfig();
    explicit.keys.keySignature.placement = { rule: "scale-from-tonic", tonicOctave: 2 };
    assert(CNBConfig.validate(explicit).valid, "integer tonicOctave valid");
  }},

  { name: "keysig: validate — separator color/thicknessPct/extentSemis are checked", fn: () => {
    const badColor = keysigConfig();
    badColor.keys.keySignature.separator.color = "gold";
    assert(CNBConfig.validate(badColor).errors.some(e => e.includes("separator.color")), "color error");
    const badThickness = keysigConfig();
    badThickness.keys.keySignature.separator.thicknessPct = -1;
    assert(CNBConfig.validate(badThickness).errors.some(e => e.includes("separator.thicknessPct")), "thickness error");
    const badExtent = keysigConfig();
    badExtent.keys.keySignature.separator.extentSemis = 0;
    assert(CNBConfig.validate(badExtent).errors.some(e => e.includes("separator.extentSemis")), "extent error");
    const nonObject = keysigConfig();
    nonObject.keys.keySignature.separator = "bar";
    assert(CNBConfig.validate(nonObject).errors.some(e => e.includes("separator must be an object")), "type error");
  }},

  { name: "keysig: a retired gutter setting (session 34) and repeat counts still validate, unread", fn: () => {
    const cfg = keysigConfig();
    cfg.keys.keySignature.gutter = { paddingH: -4 };
    cfg.durations.repeatCounts = { minim: 0 };
    assert(CNBConfig.validate(cfg).valid, "not checked: neither is read");
    assert(!("repeatCounts" in CNBConfig.createDefault().durations), "no repeat counts default");
  }},

  { name: "keysig: validate — key definitions are checked when the signature is enabled", fn: () => {
    const notArray = keysigConfig();
    notArray.keys.definitions = "C";
    assert(CNBConfig.validate(notArray).errors.some(e => e.includes("keys.definitions must be an array")), "array error");
    const empty = keysigConfig();
    empty.keys.definitions = [];
    assert(!CNBConfig.validate(empty).warnings.some(w => w.includes("keys.definitions")) &&
      CNBConfig.validate(empty).errors.length === 0,
      "no definitions is fine: the canvas draws the key picked there (session 36)");
    const noName = keysigConfig();
    noName.keys.definitions = [{ pitchClasses: [0, 2, 4] }];
    assert(CNBConfig.validate(noName).errors.some(e => e.includes("has no name")), "name error");
    const badPcs = keysigConfig();
    badPcs.keys.definitions = [{ name: "C", pitchClasses: [0, 12] }];
    assert(CNBConfig.validate(badPcs).errors.some(e => e.includes("pitchClasses array of integers 0–11")), "pcs error");
    const badTonic = keysigConfig();
    badTonic.keys.definitions[0].tonicPc = 12;
    assert(CNBConfig.validate(badTonic).errors.some(e => e.includes("tonicPc must be an integer 0–11")), "tonicPc error");
  }},

  { name: "keysig: validate — tonic fallback warning fires only when neither tonicPc nor a parsable name exists", fn: () => {
    const fallback = keysigConfig();
    fallback.keys.definitions = [{ name: "Mystery", pitchClasses: [0, 2, 4, 5, 7, 9, 11] }];
    assert(CNBConfig.validate(fallback).warnings.some(w => w.includes("falls back to the first listed pitch class")),
      "fallback warning emitted");
    const withTonicPc = keysigConfig();
    withTonicPc.keys.definitions = [{ name: "Mystery", pitchClasses: [0, 2, 4, 5, 7, 9, 11], tonicPc: 0 }];
    assert(!CNBConfig.validate(withTonicPc).warnings.some(w => w.includes("falls back")), "tonicPc suppresses it");
    const noteName = keysigConfig();
    noteName.keys.definitions = [{ name: "C major", pitchClasses: [0, 2, 4, 5, 7, 9, 11] }];
    assert(!CNBConfig.validate(noteName).warnings.some(w => w.includes("falls back")), "parsable name suppresses it");
  }},

  { name: "keysig: validate — wrong-typed keys/keySignature sections report or ignore, never throw", fn: () => {
    const keysNotObject = CNBConfig.createDefault();
    keysNotObject.keys = "twelve";
    const r1 = CNBConfig.validate(keysNotObject);
    assert(!r1.errors.some(e => /keySignature/.test(e)), "non-object keys section treated as absent");
    const ksNotObject = CNBConfig.createDefault();
    ksNotObject.keys.keySignature = "on";
    const r2 = CNBConfig.validate(ksNotObject);
    assert(!r2.errors.some(e => /keySignature/.test(e)), "non-object keySignature treated as absent");
  }},

  // ── Pitch axis (set 014): schema posture ──────────────────────────────────

  { name: "pitchAxis: createDefault() gains NO pitchAxis section (design §1.3 — absent is the default state)", fn: () => {
    const cfg = CNBConfig.createDefault();
    assert(!("pitchAxis" in cfg), "no pitchAxis key in the default config");
  }},

  { name: "pitchAxis: validate — a disabled or absent section adds zero checks (output identical to the default config's)", fn: () => {
    const base = CNBConfig.validate(CNBConfig.createDefault());
    const withDisabled = CNBConfig.validate(pitchAxisConfig({ enabled: false }));
    deepEq(withDisabled, base, "disabled section validates exactly as before");
    const withAbsent = CNBConfig.validate(CNBConfig.createDefault());
    deepEq(withAbsent, base, "absent section validates exactly as before");
  }},

  { name: "pitchAxis: validate — malformed sections report errors, never throw (type-safe posture)", fn: () => {
    const notObject = CNBConfig.createDefault();
    notObject.pitchAxis = "compact";
    const r1 = CNBConfig.validate(notObject);
    assert(!r1.errors.some(e => /pitchAxis/.test(e)), "non-object section treated as absent");
    const bare = CNBConfig.createDefault();
    bare.pitchAxis = { enabled: true };
    const r2 = CNBConfig.validate(bare);
    assert(r2.errors.some(e => e.includes("pitchAxis.kind")), "missing kind reported");
    assert(r2.errors.some(e => e.includes("pitchAxis.octaveStride")), "missing stride reported");
    assert(r2.errors.some(e => e.includes("pitchAxis.axisUnitsPerStaffSpace")), "missing units reported");
    assert(r2.errors.some(e => e.includes("pitchAxis.pitchClasses")), "missing map reported");
  }},

  { name: "pitchAxis: validate — the design §1.1 Twinline config passes with no pitch-axis errors or warnings", fn: () => {
    const r = CNBConfig.validate(pitchAxisConfig());
    assert(!r.errors.some(e => /pitchAxis|axis position|xOffsetStaffSpaces/.test(e)), "no axis errors: " + r.errors.join(" | "));
    assert(!r.warnings.some(w => /pitchAxis|axis position|xOffsetStaffSpaces/.test(w)), "no axis warnings: " + r.warnings.join(" | "));
  }},

  // ── Pitch axis: blocking rules PA-1…PA-8 ──────────────────────────────────

  { name: "pitchAxis PA-1: unknown kind is a blocking error", fn: () => {
    const r = CNBConfig.validate(pitchAxisConfig({ kind: "pitch-class-map-v2" }));
    assert(r.errors.some(e => e.includes('pitchAxis.kind must be "pitch-class-map-v1"')), "kind error");
  }},

  { name: "pitchAxis PA-2: the map must cover pc 0–11 exactly once with finite positions", fn: () => {
    const eleven = CNBConfig.validate(pitchAxisConfig({ pitchClasses: twinlineMap().slice(0, 11) }));
    assert(eleven.errors.some(e => e.includes("exactly 12 entries")), "11 entries rejected");

    const dup = twinlineMap();
    dup[11] = { pc: 0, position: 6 };
    const rDup = CNBConfig.validate(pitchAxisConfig({ pitchClasses: dup }));
    assert(rDup.errors.some(e => e.includes("more than one entry for pc 0")), "duplicate pc rejected");

    const badPc = twinlineMap();
    badPc[5] = { pc: 12, position: 3 };
    const rBadPc = CNBConfig.validate(pitchAxisConfig({ pitchClasses: badPc }));
    assert(rBadPc.errors.some(e => e.includes(".pc must be an integer 0–11")), "pc out of range rejected");

    const badPos = twinlineMap();
    badPos[5] = { pc: 5, position: "3" };
    const rBadPos = CNBConfig.validate(pitchAxisConfig({ pitchClasses: badPos }));
    assert(rBadPos.errors.some(e => e.includes("position must be a finite number")), "non-numeric position rejected");

    const nanPos = twinlineMap();
    nanPos[5] = { pc: 5, position: NaN };
    const rNan = CNBConfig.validate(pitchAxisConfig({ pitchClasses: nanPos }));
    assert(rNan.errors.some(e => e.includes("position must be a finite number")), "NaN position rejected");

    const notObj = twinlineMap();
    notObj[5] = 3;
    const rNotObj = CNBConfig.validate(pitchAxisConfig({ pitchClasses: notObj }));
    assert(rNotObj.errors.some(e => e.includes("must be an object")), "non-object entry rejected");
  }},

  { name: "pitchAxis PA-3/PA-4: octaveStride and axisUnitsPerStaffSpace must be finite and > 0", fn: () => {
    for (const bad of [0, -7, NaN, Infinity, "7", null]) {
      const r = CNBConfig.validate(pitchAxisConfig({ octaveStride: bad }));
      assert(r.errors.some(e => e.includes("pitchAxis.octaveStride must be a finite number > 0")),
        "stride error for " + String(bad));
    }
    for (const bad of [0, -2, NaN, "2"]) {
      const r = CNBConfig.validate(pitchAxisConfig({ axisUnitsPerStaffSpace: bad }));
      assert(r.errors.some(e => e.includes("pitchAxis.axisUnitsPerStaffSpace must be a finite number > 0")),
        "units error for " + String(bad));
    }
  }},

  { name: "pitchAxis PA-8: non-monotonic maps are blocking errors (in-octave and cross-octave)", fn: () => {
    const decreasing = CNBConfig.validate(pitchAxisConfig({
      pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 5].map((position, pc) => ({ pc, position })),
    }));
    assert(decreasing.errors.some(e => e.includes("not globally non-decreasing")), "in-octave violation rejected");

    const crossOctave = CNBConfig.validate(pitchAxisConfig({
      pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7.5].map((position, pc) => ({ pc, position })),
    }));
    assert(crossOctave.errors.some(e => e.includes("across the octave boundary")), "cross-octave violation rejected");

    // The boundary case positions[11] === positions[0] + stride is LEGAL
    const boundary = CNBConfig.validate(pitchAxisConfig({
      pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7].map((position, pc) => ({ pc, position })),
    }));
    assert(!boundary.errors.some(e => e.includes("monotonic") || e.includes("non-decreasing")), "boundary equality legal");
  }},

  { name: "retired line settings (session 34): no defaults, and a config carrying them validates, conflicting collapsed overrides included", fn: () => {
    const def = CNBConfig.createDefault();
    for (const section of ["staff", "ledgers"]) {
      assert(!("lineDefaults" in def[section]) && !("lineOverrides" in def[section]), `${section} has no line settings`);
    }
    // Semis 3 and 4 share Twinline position 2; ledger templates 0 and 1 share position 0.
    const cfg = pitchAxisConfig();
    cfg.staff.semitonePattern = [3, 4, 8];
    cfg.staff.lineDefaults = { thicknessPct: "30", color: "black" };
    cfg.staff.lineOverrides = { "3": { color: "#FF0000" }, "4": { color: "#0000FF" } };
    cfg.ledgers.templates = [
      { semiWithinOctave: 0, triggerPCs: [0], triggerMode: "override" },
      { semiWithinOctave: 1, triggerPCs: [1], triggerMode: "override" },
    ];
    cfg.ledgers.lineDefaults = { color: "black", widthMultiplier: 3 };
    cfg.ledgers.lineOverrides = { "0": { thicknessPct: 40 }, "1": { thicknessPct: 60 } };
    const { errors } = CNBConfig.validate(cfg);
    deepEq(errors, [], "the retired settings are not read");
  }},

  { name: "pitchAxis PA-7: apply.xOffsetStaffSpaces must be a finite number when present (enabled configs)", fn: () => {
    for (const bad of ["0.85", NaN, Infinity, null, true]) {
      const cfg = pitchAxisConfig();
      cfg.noteheadRules.push({
        name: "offset", priority: 5,
        match: { pitchClasses: [1], durations: "all", keys: "all" },
        apply: { xOffsetStaffSpaces: bad },
      });
      const r = CNBConfig.validate(cfg);
      assert(r.errors.some(e => e.includes('"offset" apply.xOffsetStaffSpaces must be a finite number')),
        "rejected for " + String(bad));
    }
    const ok = pitchAxisConfig();
    ok.noteheadRules.push({
      name: "offset", priority: 5,
      match: { pitchClasses: [1], durations: "all", keys: "all" },
      apply: { xOffsetStaffSpaces: 0.85 },
    });
    assert(!CNBConfig.validate(ok).errors.some(e => e.includes("xOffsetStaffSpaces")), "finite value accepted");
  }},

  // ── Pitch axis: warnings PA-W1/W3/W4 ──────────────────────────────────────

  { name: "pitchAxis PA-W1: positions outside [0, octaveStride) warn (shifted map, still PA-8-legal)", fn: () => {
    // Uniformly shifted map: positions 7..13 with stride 7 — every position
    // outside [0,7); positions[11]=13 ≤ positions[0]+7=14, so PA-8 holds.
    const shifted = CNBConfig.validate(pitchAxisConfig({
      pitchClasses: [7, 7, 8, 9, 9, 10, 10, 11, 12, 12, 13, 13].map((position, pc) => ({ pc, position })),
    }));
    assert(!shifted.errors.some(e => /pitchAxis/.test(e)), "shifted map has no errors");
    assert(shifted.warnings.some(w => w.includes("outside [0, octaveStride)")), "W1 warning fires");
    const inRange = CNBConfig.validate(pitchAxisConfig());
    assert(!inRange.warnings.some(w => w.includes("outside [0, octaveStride)")), "no W1 for the design map");
  }},

  { name: "pitchAxis PA-W3: indistinguishable shared-position pairs warn; the default sharps-hollow rule disambiguates", fn: () => {
    // Default config rules make sharps hollow → every Twinline shared pair
    // (C,C♯) (D♯,E) (F,F♯) (G♯,A) (A♯,B) differs in hollowness → no warning.
    const distinguishable = CNBConfig.validate(pitchAxisConfig());
    assert(!distinguishable.warnings.some(w => w.includes("indistinguishable")), "sharps-hollow disambiguates");

    // Drop the sharps rule → shared pairs identical → warning per pair.
    const cfg = pitchAxisConfig();
    cfg.noteheadRules = [cfg.noteheadRules[0]];
    const r = CNBConfig.validate(cfg);
    assert(r.warnings.some(w => w.includes("pitch classes 0 and 1") && w.includes("indistinguishable")), "pair (0,1) flagged");
    assert(r.warnings.some(w => w.includes("pitch classes 3 and 4")), "pair (3,4) flagged");

    // An xOffsetStaffSpaces on one member disambiguates again.
    const offset = pitchAxisConfig();
    offset.noteheadRules = [offset.noteheadRules[0], {
      name: "sharps sit right", priority: 1,
      match: { pitchClasses: [1, 4, 6, 9, 11], durations: "all", keys: "all" },
      apply: { xOffsetStaffSpaces: 0.85 },
    }];
    const r2 = CNBConfig.validate(offset);
    assert(!r2.warnings.some(w => w.includes("indistinguishable")), "offset disambiguates");
  }},

  { name: "pitchAxis PA-W4: xOffsetStaffSpaces in rules warns when pitchAxis is disabled or absent (axis-gated lifecycle)", fn: () => {
    const absent = CNBConfig.createDefault();
    absent.noteheadRules.push({
      name: "stray offset", priority: 5,
      match: { pitchClasses: [1], durations: "all", keys: "all" },
      apply: { xOffsetStaffSpaces: 0.85 },
    });
    const r1 = CNBConfig.validate(absent);
    assert(r1.warnings.some(w => w.includes('"stray offset"') && w.includes("axis-gated")), "warns on absent section");

    const disabled = pitchAxisConfig({ enabled: false });
    disabled.noteheadRules.push(absent.noteheadRules[absent.noteheadRules.length - 1]);
    const r2 = CNBConfig.validate(disabled);
    assert(r2.warnings.some(w => w.includes("axis-gated")), "warns on disabled section");

    const enabled = pitchAxisConfig();
    enabled.noteheadRules.push(absent.noteheadRules[absent.noteheadRules.length - 1]);
    const r3 = CNBConfig.validate(enabled);
    assert(!r3.warnings.some(w => w.includes("axis-gated")), "no W4 when enabled");
  }},

  // ── Pitch axis: resolveNotehead xOffsetStaffSpaces ────────────────────────

  { name: "resolveNotehead: xOffsetStaffSpaces defaults to 0", fn: () => {
    const r = CNBConfig.resolveNotehead(CNBConfig.createDefault(), 0, "crotchet", null);
    eq(r.xOffsetStaffSpaces, 0, "built-in default");
  }},

  { name: "resolveNotehead: xOffsetStaffSpaces merges in priority order like every other apply field", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.noteheadRules.push(
      { name: "sharps right", priority: 5, match: { pitchClasses: [1, 6], durations: "all", keys: "all" }, apply: { xOffsetStaffSpaces: 0.85 } },
      { name: "F♯ further", priority: 6, match: { pitchClasses: [6], durations: "all", keys: "all" }, apply: { xOffsetStaffSpaces: -0.5 } },
    );
    eq(CNBConfig.resolveNotehead(cfg, 1, "crotchet", null).xOffsetStaffSpaces, 0.85, "rule value");
    eq(CNBConfig.resolveNotehead(cfg, 6, "crotchet", null).xOffsetStaffSpaces, -0.5, "higher priority wins");
    eq(CNBConfig.resolveNotehead(cfg, 0, "crotchet", null).xOffsetStaffSpaces, 0, "unmatched pc keeps default");
    // Partial apply inheritance: the offset rule sets nothing else
    const r = CNBConfig.resolveNotehead(cfg, 1, "crotchet", null);
    eq(r.hollow, true, "hollow inherited from the sharps rule");
    eq(r.shape, "crotchet-minim", "shape inherited from the default rule");
  }},

  // ── Export safety (audit 2026-11-02, H1/M5) ───────────────────────────────
  { name: "validate() export safety: the default config gains no new errors", fn: () => {
    deepEq(CNBConfig.validate(CNBConfig.createDefault()).errors, [], "default errors");
  }},
  { name: "validate() export safety: each unsafe field value is a blocking error naming the field", fn: () => {
    const shape = (c) => c.shapes["crotchet-minim"];
    const cases = [
      ["engine.lilypondVersion", (c) => { c.engine.lilypondVersion = '2.24.2"\n#(display "X")'; }],
      ["engine.defaultMagnify", (c) => { c.engine.defaultMagnify = '7/4) #(display "X")'; }],
      ["engine.defaultMagnify", (c) => { c.engine.defaultMagnify = null; }],
      // 400 digits parse to Infinity, which export would refuse (session 10 review).
      ["engine.defaultMagnify", (c) => { c.engine.defaultMagnify = "9".repeat(400); }],
      ['Shape "crotchet-minim" lilypondPath', (c) => { shape(c).lilypondPath = `'((moveto 0 ${"9".repeat(400)}))`; }],
      ["engine.multinotePadding", (c) => { c.engine.multinotePadding = "(display 1)"; }],
      ["engine.indent", (c) => { c.engine.indent = NaN; }],
      ["engine.collisionThreshold", (c) => { c.engine.collisionThreshold = Infinity; }],
      ["staff.semitonePattern[1]", (c) => { c.staff.semitonePattern = [4, "8"]; }],
      ["staff.midpoint", (c) => { c.staff.midpoint = "12"; }],
      ["staff.semitonesPerStaffSpace", (c) => { c.staff.semitonesPerStaffSpace = "4) (display 1"; }],
      ['Duration "crotchet" lilypondDuration', (c) => { c.durations.definitions[0].lilypondDuration = "3)"; }],
      ['Shape "crotchet-minim" lilypondPath', (c) => { shape(c).lilypondPath = `'()) (system "calc") (define x '()`; }],
      ['Shape "crotchet-minim" lilypondHollowPath', (c) => { shape(c).lilypondHollowPath = "'((moveto 0 0) #(display 1))"; }],
      ['Shape "crotchet-minim" anchors.crotchetUp.x', (c) => { shape(c).anchors.crotchetUp.x = "1"; }],
      ['Shape "crotchet-minim" naturalHeight', (c) => { shape(c).naturalHeight = "272"; }],
      ['Shape "crotchet-minim" lilypondAnchors.minimUp.y', (c) => {
        shape(c).lilypondAnchors = { crotchetUp: { x: 1, y: 0 }, minimUp: { x: 1, y: "(display 1)" } }; }],
    ];
    for (const [field, mutate] of cases) {
      const cfg = CNBConfig.createDefault();
      mutate(cfg);
      const { valid, errors } = CNBConfig.validate(cfg);
      assert(!valid, `${field}: config must be invalid`);
      assert(errors.some(e => e.includes(field)), `${field}: an error names the field, got ${JSON.stringify(errors)}`);
    }
  }},
  { name: "validate() export safety: safe values in the same fields stay valid", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.engine.lilypondVersion = "2.25.10";
    cfg.engine.defaultMagnify = "8/5";
    cfg.shapes["crotchet-minim"].lilypondPath = "'( (moveto 0 1) (lineto 1 0) (closepath))";
    cfg.shapes["crotchet-minim"].lilypondAnchors = { crotchetUp: { x: 0.7, y: 0 }, minimUp: { x: 1, y: null } };
    cfg.meta.notationLabel = 'Any text\n#(display "fine in a comment")';
    deepEq(CNBConfig.validate(cfg).errors, [], "errors");
  }},
  { name: "validate() M5: two shapes whose names slug alike are an error naming both", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.shapes["Kite Up"] = CNBConfig.clone(cfg.shapes["crotchet-minim"]);
    cfg.shapes["kite-up"] = CNBConfig.clone(cfg.shapes["crotchet-minim"]);
    const { valid, errors } = CNBConfig.validate(cfg);
    assert(!valid, "must be invalid");
    assert(errors.some(e => e.includes('"Kite Up"') && e.includes('"kite-up"')), `error names both shapes: ${JSON.stringify(errors)}`);
  }},
  { name: "validate() M5: a shape name with no usable slug is an error naming the shape", fn: () => {
    for (const name of ["音符", "---", "4-8 head"]) {
      const cfg = CNBConfig.createDefault();
      cfg.shapes[name] = CNBConfig.clone(cfg.shapes["crotchet-minim"]);
      const { valid, errors } = CNBConfig.validate(cfg);
      assert(!valid, `${name}: must be invalid`);
      assert(errors.some(e => e.includes(`Shape "${name}"`)), `${name}: error names the shape: ${JSON.stringify(errors)}`);
    }
  }},
  { name: "validate() (session 34): a key-scoped rule no longer warns; keys sharing pitch classes but drawn differently do", fn: () => {
    const cfg = CNBConfig.createDefault();
    const keyWarnings = (c) => CNBConfig.validate(c).warnings.filter(w => w.includes("scoped to keys") || w.includes("Key definitions"));
    cfg.keys.enabled = true;
    cfg.keys.definitions = [
      { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
      { name: "A minor", pitchClasses: [9, 11, 0, 2, 4, 5, 7] },
      { name: "G", pitchClasses: [7, 9, 11, 0, 2, 4, 6] },
    ];
    cfg.noteheadRules.push({ name: "F♯ red in G", priority: 5,
      match: { pitchClasses: [6], durations: "all", keys: ["G"] }, apply: { color: "#FF0000" } });
    deepEq(keyWarnings(cfg), [], "a key-scoped rule exports: no warning; C and A minor share notes but look alike");
    cfg.noteheadRules.push({ name: "A blue in A minor", priority: 6,
      match: { pitchClasses: [9], durations: "all", keys: ["A minor"] }, apply: { color: "#0000FF" } });
    assert(CNBConfig.validate(cfg).valid, "a warning, not an error");
    const w = keyWarnings(cfg);
    assert(w.length === 1 && w[0].includes('"C", "A minor"') && w[0].includes("(0 2 4 5 7 9 11)") &&
      w[0].includes('draws them all as "A minor"'), `names both keys and the one engraved: ${JSON.stringify(w)}`);
    cfg.keys.enabled = false;
    deepEq(keyWarnings(cfg), [], "keys off: neither the preview nor the export applies a key");
  }},
  { name: "validate(): a rule that sets an off-key mark warns, naming the rule (session 29)", fn: () => {
    const markWarnings = (c) => CNBConfig.validate(c).warnings.filter(w => w.includes("off-key mark"));
    const cfg = CNBConfig.createDefault();
    eq(cfg.noteheadRules[0].apply.offKeyMark, false, "the default rule says no mark");
    deepEq(markWarnings(cfg), [], "offKeyMark false gives no warning");
    cfg.noteheadRules.push({ name: "Off-key crosses", priority: 5,
      match: { pitchClasses: [1, 3], durations: "all", keys: "all" }, apply: { offKeyMark: "cross" } });
    cfg.noteheadRules.push({ name: "No mark here", priority: 6,
      match: { pitchClasses: [6], durations: "all", keys: "all" }, apply: { offKeyMark: false } });
    assert(CNBConfig.validate(cfg).valid, "a warning, not an error");
    const w = markWarnings(cfg);
    assert(w.length === 1 && w[0].includes('Rule "Off-key crosses"') && w[0].includes('"cross"') &&
      w[0].includes("not drawn in the preview or exported yet"), `warning names the rule: ${JSON.stringify(w)}`);
  }},

];

// ── Clef test helpers (set 009) ───────────────────────────────────────────────

const TEST_CLEF_GLYPH = {
  displayName: "Test Clef",
  kind: "glyph",
  svgPath: "M 0 0 L 100 0 L 100 300 L 0 300 Z",
  naturalHeight: 300,
  naturalWidth: 100,
  semitoneHeight: 6,
  viewBoxMinX: 0,
  viewBoxMinY: 0,
  lilypondPath: null,
  anchorSemi: 20,
};

/** Default config with the clef enabled on a fresh copy of TEST_CLEF_GLYPH. */
function clefConfig(glyphOverrides = {}, clefOverrides = {}) {
  const config = CNBConfig.createDefault();
  config.clef = {
    ...config.clef,
    enabled: true,
    active: "test-clef",
    glyphs: { "test-clef": { ...TEST_CLEF_GLYPH, ...glyphOverrides } },
    ...clefOverrides,
  };
  return config;
}

// ── Key-signature test helpers (set 010) ─────────────────────────────────────

/** Default config with keys + key signature enabled and a C-major definition. */
function keysigConfig() {
  const config = CNBConfig.createDefault();
  config.keys.enabled = true;
  config.keys.definitions = [{ name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] }];
  config.keys.keySignature.enabled = true;
  return config;
}

// ── Pitch-axis test helpers (set 014) ────────────────────────────────────────

/** The design §1.1 Twinline-like map: five shared-position pairs. */
function twinlineMap() {
  return [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position }));
}

/** Default config with an enabled Twinline-like pitch axis (design §1.1). */
function pitchAxisConfig(overrides = {}) {
  const config = CNBConfig.createDefault();
  config.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: twinlineMap(),
    ...overrides,
  };
  return config;
}
