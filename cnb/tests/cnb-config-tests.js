/**
 * cnb-config-tests.js — Unit tests for Module A (Config Schema)
 */

import { CNBConfig } from "../src/cnb-config.js";

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
  if (Math.abs(a - b) > epsilon) throw new Error(`${msg || "approx"}: expected ~${b}, got ${a}`);
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
  { name: "validate: bad hex in palette → error", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.palette.colors = [{ pc: 0, hex: "BADHEX", name: "Bad" }];
    const result = CNBConfig.validate(cfg);
    assert(!result.valid, "should be invalid");
    assert(result.errors.some(e => e.includes("BADHEX")), "should mention BADHEX");
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
  { name: "validate: CB-safe palette shorter than primary → warning", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.palette.colors = [
      { pc: 0, hex: "#FF0000", name: "Red" },
      { pc: 1, hex: "#00FF00", name: "Green" },
    ];
    cfg.palette.cbSafeColors = [
      { pc: 0, hex: "#CC0000", name: "DarkRed" },
    ];
    const result = CNBConfig.validate(cfg);
    assert(result.warnings.some(w => w.includes("CB-safe")), "should warn about shorter CB-safe palette");
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
    eq(merged.display.stemThicknessPct, def.display.stemThicknessPct, "stemThicknessPct unchanged");
    eq(merged.display.debugGrid, false, "debugGrid unchanged");
  }},
  { name: "merge: merging new noteheadRules replaces the array entirely", fn: () => {
    const def = CNBConfig.createDefault();
    const newRules = [{ name: "Only", priority: 0, match: { pitchClasses: "all", durations: "all", keys: "all" }, apply: { shape: "crotchet-minim", hollow: false, color: null, offKeyMark: false } }];
    const merged = CNBConfig.merge(def, { noteheadRules: newRules });
    eq(merged.noteheadRules.length, 1, "should have exactly 1 rule");
    eq(merged.noteheadRules[0].name, "Only");
  }},
  { name: "merge: nested staff.lineDefaults preserves unmodified sibling fields", fn: () => {
    const def = CNBConfig.createDefault();
    const merged = CNBConfig.merge(def, { staff: { lineDefaults: { thicknessPct: 30 } } });
    eq(merged.staff.lineDefaults.thicknessPct, 30, "thicknessPct changed");
    eq(merged.staff.lineDefaults.color, "#000000", "color unchanged");
    eq(merged.staff.lineDefaults.style, "solid", "style unchanged");
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

  // ── resolveColor ──────────────────────────────────────────────────────────
  { name: "resolveColor: no palette → null", fn: () => {
    const cfg = CNBConfig.createDefault(); // palette.colors is empty
    eq(CNBConfig.resolveColor(cfg, 0), null);
  }},
  { name: "resolveColor: with primary palette returns correct hex", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.palette.colors = [
      { pc: 0, hex: "#FF0000", name: "Red" },
      { pc: 1, hex: "#00FF00", name: "Green" },
    ];
    eq(CNBConfig.resolveColor(cfg, 0), "#FF0000");
    eq(CNBConfig.resolveColor(cfg, 1), "#00FF00");
  }},
  { name: "resolveColor: useCBSafe returns CB-safe hex", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.palette.colors = [{ pc: 0, hex: "#FF0000", name: "Red" }];
    cfg.palette.cbSafeColors = [{ pc: 0, hex: "#CC0000", name: "DarkRed" }];
    cfg.palette.useCBSafe = false;
    eq(CNBConfig.resolveColor(cfg, 0), "#FF0000", "primary without CB-safe");
    cfg.palette.useCBSafe = true;
    eq(CNBConfig.resolveColor(cfg, 0), "#CC0000", "CB-safe when toggled");
  }},
  { name: "resolveColor: PC not in palette → null", fn: () => {
    const cfg = CNBConfig.createDefault();
    cfg.palette.colors = [{ pc: 0, hex: "#FF0000", name: "Red" }];
    eq(CNBConfig.resolveColor(cfg, 5), null, "PC 5 not in palette");
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
