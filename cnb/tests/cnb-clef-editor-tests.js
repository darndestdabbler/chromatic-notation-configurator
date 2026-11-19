/**
 * cnb-clef-editor-tests.js — Unit tests for the Clef Editor
 * (set 009 session 2)
 *
 * Covers the pure state ↔ config builders (buildClef / applyToConfig /
 * stateFromConfig, round-tripped on every branch), the render() UI driven
 * against a stub DOM (since session 79 the Clef, Anchor and Sits on
 * dropdowns, Import, the Height, the space note, explicit empty states),
 * the pure anchorChoice / withAnchorChoice / pitchOptions,
 * the clef import wiring with an injected parser, and the Module A
 * validation pass-through.
 */

import { CNBClefEditor } from "../ui/clef-editor.js";
import { CNBBuiltinClefs } from "../ui/builtin-clefs.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBClef } from "../src/cnb-clef.js";

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

function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch (_) { threw = true; }
  if (!threw) throw new Error(msg || "expected function to throw");
}

// ─── HTML DOM stub (element-property event wiring, textContent clearing) ────
// Same stub pattern as the Module 12–15 editor tests.

function makeHtmlStubElement(tag) {
  const el = {
    tag,
    attrs: {},
    children: [],
    style: {},
    className: "",
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    appendChild(child) { this.children.push(child); return child; },
  };
  let text = "";
  Object.defineProperty(el, "textContent", {
    get: () => text,
    set: (v) => { text = String(v); if (text === "") el.children.length = 0; },
  });
  return el;
}

function withDomStub(fn) {
  const had = "document" in globalThis;
  const prev = globalThis.document;
  globalThis.document = {
    createElement: (tag) => makeHtmlStubElement(tag),
    createElementNS: (_ns, tag) => makeHtmlStubElement(tag),
  };
  try {
    return fn(makeHtmlStubElement("div"));
  } finally {
    if (had) globalThis.document = prev;
    else delete globalThis.document;
  }
}

/** All descendants (depth-first) whose className includes the given token. */
function findAll(el, token) {
  const out = [];
  for (const child of el.children || []) {
    if (String(child.className || "").split(/\s+/).includes(token)) out.push(child);
    out.push(...findAll(child, token));
  }
  return out;
}

/** A dropdown's option texts, an optgroup's options in their place. */
function optionTexts(select) {
  return select.children.flatMap(c => (c.tag === "optgroup" ? c.children : [c])).map(o => o.textContent);
}

/** Concatenated textContent of an element subtree. */
function subtreeText(el) {
  let out = String(el.textContent || "");
  for (const child of el.children || []) out += subtreeText(child);
  return out;
}

const E = CNBClefEditor;

const TEST_GLYPH = {
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

const TEXT_GLYPH = {
  displayName: "Register 5",
  kind: "text",
  text: "5",
  textHeightSemis: 4,
  anchorSemi: 18,
};

/** Default config with the clef enabled on fresh copies of the fixtures. */
function clefConfig() {
  const config = CNBConfig.createDefault();
  config.clef = {
    enabled: true,
    active: "test-clef",
    glyphs: {
      "test-clef": JSON.parse(JSON.stringify(TEST_GLYPH)),
      "register-5": JSON.parse(JSON.stringify(TEXT_GLYPH)),
    },
    gutter: { paddingH: 10 },
  };
  return config;
}

// ── Minimal SVG document stub for the import wiring ─────────────────────────

function stubEl(attrs) {
  return { getAttribute: (k) => (k in attrs ? String(attrs[k]) : null), tagName: attrs.tagName || "path" };
}

function stubDoc({ rootAttrs = {}, byId = {}, firstPath = null }) {
  const root = { ...stubEl({ tagName: "svg", ...rootAttrs }) };
  return {
    documentElement: root,
    getElementById: (id) => byId[id] || null,
    querySelector: (sel) => (sel === "path" ? firstPath : null),
  };
}

const CLEF_SVG_DOC = stubDoc({
  rootAttrs: { viewBox: "0 0 100 300" },
  byId: { clef: stubEl({ d: "M 0 0 L 1 1", "data-semitone-height": "6" }) },
});

const stubParserFor = (doc) => ({ parseFromString: () => doc });

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // ── stateFromConfig ──
  { name: "stateFromConfig: default config opens as the default-off state", fn: () => {
      const state = E.stateFromConfig(CNBConfig.createDefault());
      deepEq(state, { enabled: false, active: null, glyphs: {}, gutter: { paddingH: 12 } },
        "default-off state");
    }},

  { name: "stateFromConfig: clef-enabled config preserves glyphs, active, and gutter", fn: () => {
      const state = E.stateFromConfig(clefConfig());
      eq(state.enabled, true, "enabled");
      eq(state.active, "test-clef", "active");
      deepEq(Object.keys(state.glyphs).sort(), ["register-5", "test-clef"], "glyph names");
      eq(state.gutter.paddingH, 10, "gutter padding");
    }},

  { name: "stateFromConfig: glyphs are deep-cloned (editing state never mutates the config)", fn: () => {
      const config = clefConfig();
      const state = E.stateFromConfig(config);
      state.glyphs["test-clef"].anchorSemi = 99;
      eq(config.clef.glyphs["test-clef"].anchorSemi, 20, "config untouched");
    }},

  { name: "stateFromConfig: missing or malformed clef section opens as default-off", fn: () => {
      deepEq(E.stateFromConfig({}), { enabled: false, active: null, glyphs: {}, gutter: { paddingH: 12 } },
        "no clef section");
      deepEq(E.stateFromConfig({ clef: "junk" }).glyphs, {}, "non-object section");
      const badGutter = E.stateFromConfig({ clef: { enabled: true, gutter: { paddingH: -3 } } });
      eq(badGutter.gutter.paddingH, 12, "invalid paddingH falls back to the schema default");
      const badGlyphs = E.stateFromConfig({ clef: { glyphs: ["not", "a", "map"] } });
      deepEq(badGlyphs.glyphs, {}, "non-object glyphs treated as absent");
    }},

  // ── buildClef ──
  { name: "buildClef: builds a ready config.clef slice with deep-cloned glyphs", fn: () => {
      const state = E.stateFromConfig(clefConfig());
      const clef = E.buildClef(state);
      deepEq(clef, {
        enabled: true,
        active: "test-clef",
        glyphs: state.glyphs,
        gutter: { paddingH: 10 },
      }, "slice content");
      clef.glyphs["test-clef"].anchorSemi = 99;
      eq(state.glyphs["test-clef"].anchorSemi, 20, "output detached from state");
    }},

  { name: "buildClef: throws on structurally invalid state (glyphs, paddingH, active type)", fn: () => {
      const base = () => E.stateFromConfig(clefConfig());
      assertThrows(() => E.buildClef(null), "non-object state");
      let s = base(); s.glyphs = "nope";
      assertThrows(() => E.buildClef(s), "non-object glyphs");
      s = base(); s.gutter.paddingH = NaN;
      assertThrows(() => E.buildClef(s), "NaN paddingH");
      s = base(); s.gutter.paddingH = -1;
      assertThrows(() => E.buildClef(s), "negative paddingH");
      s = base(); s.gutter = undefined;
      assertThrows(() => E.buildClef(s), "missing gutter");
      s = base(); s.active = 42;
      assertThrows(() => E.buildClef(s), "non-string active");
    }},

  { name: "buildClef: enabled with no active glyph builds without throwing (validation reports it)", fn: () => {
      const state = E.stateFromConfig(clefConfig());
      state.active = null;
      const clef = E.buildClef(state);
      eq(clef.enabled, true, "still enabled");
      eq(clef.active, null, "no active");
      const validation = CNBConfig.validate(E.applyToConfig(CNBConfig.createDefault(), state));
      assert(validation.errors.some(m => m.includes("clef.active")),
        "Module A validation reports the missing active glyph");
    }},

  // ── applyToConfig ──
  { name: "applyToConfig: replaces only the clef section and mutates neither argument", fn: () => {
      const config = CNBConfig.createDefault();
      const before = JSON.stringify(config);
      const state = E.stateFromConfig(clefConfig());
      const out = E.applyToConfig(config, state);
      deepEq(out.clef, E.buildClef(state), "clef replaced");
      eq(JSON.stringify(config), before, "input config not mutated");
      const { clef: _outClef, ...outRest } = out;
      const { clef: _inClef, ...inRest } = config;
      deepEq(outRest, inRest, "all other sections untouched");
    }},

  // ── state ↔ config round-trip (every branch) ──
  { name: "round-trip: default-off, glyph-kind, and text-kind states survive applyToConfig → stateFromConfig", fn: () => {
      const defaultState = E.stateFromConfig(CNBConfig.createDefault());
      deepEq(E.stateFromConfig(E.applyToConfig(CNBConfig.createDefault(), defaultState)),
        defaultState, "default-off state");

      const glyphState = E.stateFromConfig(clefConfig());
      deepEq(E.stateFromConfig(E.applyToConfig(CNBConfig.createDefault(), glyphState)),
        glyphState, "glyph-kind state");

      const textState = E.stateFromConfig(clefConfig());
      textState.active = "register-5";
      deepEq(E.stateFromConfig(E.applyToConfig(CNBConfig.createDefault(), textState)),
        textState, "text-kind active state");
    }},

  // ── withAnchor and withHeight (session 59) ──
  { name: "withAnchor: moves the active glyph clef's anchor to a semitone; the argument is not mutated", fn: () => {
      const clef = clefConfig().clef;
      const moved = E.withAnchor(clef, 23.5);
      eq(moved.glyphs["test-clef"].anchorSemi, 23.5, "moved");
      eq(moved.glyphs["test-clef"].semitoneHeight, 6, "same height");
      eq(moved.glyphs["register-5"].anchorSemi, 18, "other definitions untouched");
      eq(clef.glyphs["test-clef"].anchorSemi, 20, "the argument is not mutated");
      eq(E.withAnchor(clef, 7.123456).glyphs["test-clef"].anchorSemi, 7.1235, "to 4 places");
    }},

  { name: "withAnchor: null for a non-number, or a clef that is not a glyph", fn: () => {
      const clef = clefConfig().clef;
      eq(E.withAnchor(clef, NaN), null, "not a number");
      eq(E.withAnchor({ ...clef, active: "register-5" }, 20), null, "a text clef");
      eq(E.withAnchor({ ...clef, active: null }, 20), null, "no clef active");
      eq(E.withAnchor({ ...clef, active: "d", glyphs: { d: { kind: "dozenal" } } }, 20), null, "the dozenal clef");
    }},

  { name: "withHeight: a glyph or dozenal clef at a height, or automatic where it can be", fn: () => {
      const clef = clefConfig().clef;
      const taller = E.withHeight(clef, 11.75);
      eq(taller.glyphs["test-clef"].semitoneHeight, 11.75, "resized");
      eq(taller.glyphs["test-clef"].anchorSemi, 20, "its anchor kept");
      eq(clef.glyphs["test-clef"].semitoneHeight, 6, "the argument is not mutated");
      eq(E.withHeight(clef, null), null, "an imported glyph cannot be automatic");
      const builtin = { ...clef, glyphs: { ...clef.glyphs, "test-clef": { ...clef.glyphs["test-clef"], staffSpaceUnits: 100 } } };
      eq(E.withHeight(builtin, null).glyphs["test-clef"].semitoneHeight, null, "automatic with staffSpaceUnits");
      const dozenal = { ...clef, active: "d", glyphs: { d: { kind: "dozenal", semitoneHeight: 8 } } };
      eq(E.withHeight(dozenal, 6).glyphs.d.semitoneHeight, 6, "the dozenal clef's height");
      eq(E.withHeight(dozenal, null).glyphs.d.semitoneHeight, null, "the dozenal clef automatic");
    }},

  { name: "withHeight: null for zero, a negative or a non-number, or a text clef", fn: () => {
      const clef = clefConfig().clef;
      eq(E.withHeight(clef, 0), null, "zero");
      eq(E.withHeight(clef, -2), null, "negative");
      eq(E.withHeight(clef, NaN), null, "not a number");
      eq(E.withHeight({ ...clef, active: "register-5" }, 4), null, "a text clef");
      eq(E.withHeight({ ...clef, active: null }, 4), null, "no clef active");
    }},

  // ── anchorChoice, withAnchorChoice and pitchOptions (session 79) ──
  { name: "anchorChoice: Top, Middle or Bottom when the anchor is exactly there, else a point; no reference reads as Top", fn: () => {
      const at = (reference, extra = {}) => E.anchorChoice({ ...TEST_GLYPH, ...extra, reference });
      eq(E.anchorChoice(TEST_GLYPH), "top", "no reference: the top, as drawn");
      eq(at({ x: 50, y: 0 }), "top", "the top");
      eq(at({ x: 50, y: 150 }), "middle", "the middle");
      eq(at({ x: 0, y: 300 }), "bottom", "the bottom, whatever its x");
      eq(at({ x: 50, y: 100 }), "point", "a point inside");
      eq(at({ x: 0, y: -150 }, { viewBoxMinY: -300 }), "middle", "measured from viewBoxMinY");
      eq(E.anchorChoice(TEXT_GLYPH), "top", "a text clef");
      eq(E.anchorChoice({ kind: "dozenal" }), "top", "the dozenal clef");
      eq(E.anchorChoice(null), "top", "nothing");
      const treble = CNBBuiltinClefs.definition(CNBConfig.createDefault(), "treble");
      eq(E.anchorChoice(treble), "point", "the treble clef's curl");
    }},

  { name: "withAnchorChoice: writes the reference at the box's centre and its top, middle or bottom; a point keeps it", fn: () => {
      const clef = clefConfig().clef;
      deepEq(E.withAnchorChoice(clef, "top").glyphs["test-clef"].reference, { x: 50, y: 0 }, "top");
      deepEq(E.withAnchorChoice(clef, "middle").glyphs["test-clef"].reference, { x: 50, y: 150 }, "middle");
      deepEq(E.withAnchorChoice(clef, "bottom").glyphs["test-clef"].reference, { x: 50, y: 300 }, "bottom");
      eq(E.withAnchorChoice(clef, "middle").glyphs["test-clef"].anchorSemi, 20, "the anchor's semitone kept");
      eq(clef.glyphs["test-clef"].reference, undefined, "the argument is not mutated");
      const offset = { ...clef, glyphs: { ...clef.glyphs, "test-clef": { ...TEST_GLYPH, viewBoxMinX: -50, viewBoxMinY: -150 } } };
      deepEq(E.withAnchorChoice(offset, "bottom").glyphs["test-clef"].reference, { x: 0, y: 150 }, "in the glyph's own units");
      const pointed = { ...clef, glyphs: { ...clef.glyphs, "test-clef": { ...TEST_GLYPH, reference: { x: 10, y: 20 } } } };
      deepEq(E.withAnchorChoice(pointed, "point").glyphs["test-clef"].reference, { x: 10, y: 20 }, "a point keeps the stored one");
      for (const choice of ["top", "middle", "bottom"]) {
        eq(E.anchorChoice(E.withAnchorChoice(clef, choice).glyphs["test-clef"]), choice, `${choice} reads back`);
      }
    }},

  { name: "withAnchorChoice: null for a choice not offered, or a clef that is not a glyph", fn: () => {
      const clef = clefConfig().clef;
      eq(E.withAnchorChoice(clef, "left"), null, "not a choice");
      eq(E.withAnchorChoice({ ...clef, active: "register-5" }, "middle"), null, "a text clef");
      eq(E.withAnchorChoice({ ...clef, active: null }, "middle"), null, "no clef active");
      eq(E.withAnchorChoice({ ...clef, active: "d", glyphs: { d: { kind: "dozenal" } } }, "top"), null, "the dozenal clef");
    }},

  { name: "withAnchorChoice: Top draws as a clef with no anchor point", fn: () => {
      const config = clefConfig();
      const top = { ...config, clef: E.withAnchorChoice(config.clef, "top") };
      eq(CNBClef.shown(top).top, CNBClef.shown(config).top, "the same top");
    }},

  { name: "pitchOptions: every semitone the canvas draws, top to bottom, named as the label strip names it", fn: () => {
      const options = E.pitchOptions(CNBConfig.createDefault());
      eq(options.length, 33, "semitones −4 to 28");
      deepEq(options[0], { semi: 28, name: "E · semitone 28" }, "the top");
      deepEq(options[options.length - 1], { semi: -4, name: "G♯ · semitone -4" }, "the bottom");
      eq(options.find(o => o.semi === 19).name, "G · semitone 19", "G");
      eq(options.find(o => o.semi === 13).name, "C♯ · semitone 13", "a sharp");
      // A clef reaching past the cards does not widen the list.
      const tall = clefConfig();
      tall.clef.glyphs["test-clef"].semitoneHeight = 40;
      eq(E.pitchOptions(tall).length, 33, "the cards' range");
    }},

  // ── render(): a. the Clef dropdown and Import (session 79) ──
  { name: "render: the Clef dropdown offers No clef, the built-in clefs and the imported ones; choosing one adds and shows it", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: (slices) => { last = slices; },
        });
        const select = findAll(api.root, "cnb-cle-select")[0];
        eq(select.tag, "select", "a dropdown");
        eq(select.value, "none", "no clef shown");
        eq(optionTexts(select).join(", "), "No clef, Dozenal, Treble, Bass, Alto", "the choices");
        eq(findAll(api.root, "cnb-cle-enable-check").length, 0, "no checkbox");
        eq(findAll(api.root, "cnb-cle-choice").length, 0, "no clef buttons");
        eq(findAll(api.root, "cnb-cle-glyph-option").length, 0, "no list of clefs");
        select.onchange({ target: { value: "treble" } });
        eq(last.clef.enabled, true, "the clef is turned on");
        eq(last.clef.active, "treble", "treble shown");
        eq(last.clef.glyphs.treble.kind, "glyph", "LilyPond's treble glyph added");
        eq(last.clef.glyphs.treble.anchorSemi, 7, "its line on G nearest the middle");
        eq(findAll(api.root, "cnb-cle-select")[0].value, "treble", "the dropdown shows it");
        findAll(api.root, "cnb-cle-select")[0].onchange({ target: { value: "dozenal" } });
        eq(last.clef.active, "dozenal", "dozenal shown");
        assert("treble" in last.clef.glyphs, "the treble clef stays in the notation");
        findAll(api.root, "cnb-cle-select")[0].onchange({ target: { value: "none" } });
        eq(last.clef.enabled, false, "No clef turns it off");
        assert("dozenal" in last.clef.glyphs && "treble" in last.clef.glyphs, "the clefs stay");
        eq(findAll(api.root, "cnb-cle-anchor").length, 0, "no anchor without a clef");
        eq(CNBConfig.validate(api.applyTo(CNBConfig.createDefault())).valid, true, "valid");
      });
    }},

  { name: "render: imported clefs are offered under Imported, by name", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, { config: clefConfig(), onChange: (slices) => { last = slices; } });
        const select = findAll(api.root, "cnb-cle-select")[0];
        eq(select.value, "test-clef", "the shown clef");
        const group = findAll(select, "cnb-cle-imported")[0];
        eq(group.getAttribute("label"), "Imported", "a group");
        deepEq(group.children.map(o => [o.value, o.textContent]),
          [["test-clef", "Test Clef"], ["register-5", "Register 5"]], "each imported clef");
        select.onchange({ target: { value: "register-5" } });
        eq(last.clef.active, "register-5", "chosen");
      });
    }},

  { name: "render: choosing a clef the config already has keeps its placement", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: (slices) => { last = slices; },
        });
        findAll(api.root, "cnb-cle-select")[0].onchange({ target: { value: "bass" } });
        findAll(api.root, "cnb-cle-sits-select")[0].onchange({ target: { value: "own" } });
        findAll(api.root, "cnb-cle-sits")[0].oninput({ target: { value: "30" } });
        findAll(api.root, "cnb-cle-select")[0].onchange({ target: { value: "alto" } });
        findAll(api.root, "cnb-cle-select")[0].onchange({ target: { value: "bass" } });
        eq(last.clef.active, "bass", "bass shown again");
        eq(last.clef.glyphs.bass.anchorSemi, 30, "its moved anchor kept");
      });
    }},

  { name: "render: a chosen clef is placed for the current config's staff (getConfig)", fn: () => {
      withDomStub(container => {
        let last = null;
        const current = CNBConfig.createDefault();
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          getConfig: () => current,
          onChange: (slices) => { last = slices; },
        });
        current.staff.midpoint = 24;   // the staff moved after the panel was drawn
        findAll(api.root, "cnb-cle-select")[0].onchange({ target: { value: "alto" } });
        eq(last.clef.glyphs.alto.anchorSemi, 24, "C nearest 24 is 24, its anchor's semitone");
      });
    }},

  { name: "render: Import from SVG… opens the hidden file input; the panel has no developer wording", fn: () => {
      withDomStub(container => {
        const api = E.render(container, { config: clefConfig() });
        const button = findAll(api.root, "cnb-cle-import-button")[0];
        eq(button.textContent, "Import from SVG…", "the button");
        const input = findAll(api.root, "cnb-cle-file")[0];
        eq(input.type, "file", "a file input");
        eq(input.hidden, true, "hidden");
        let opened = 0;
        input.click = () => { opened++; };
        button.onclick();
        eq(opened, 1, "the button opens it");
        eq(findAll(api.root, "cnb-badge").length, 0, "no badge");
        const text = api.root.children
          .filter(c => !String(c.className).includes("cnb-cle-validation"))
          .map(subtreeText).join(" ");
        for (const dev of ["Clef glyph", "Module", "set 0", "Gutter", "Toolkit contract", "Float", "paddingH"]) {
          assert(!text.includes(dev), `no developer wording "${dev}" in: ${text}`);
        }
      });
    }},

  // ── render(): b. the Anchor dropdown and the Height ──
  { name: "render: the Anchor dropdown shows the clef's anchor, and Top, Middle or Bottom writes it", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, { config: clefConfig(), onChange: (slices) => { last = slices; } });
        const select = findAll(api.root, "cnb-cle-anchor-select")[0];
        eq(optionTexts(select).join(", "), "Top, Middle, Bottom, A point on the clef", "the choices");
        eq(select.value, "top", "no anchor point: the top");
        select.onchange({ target: { value: "middle" } });
        deepEq(last.clef.glyphs["test-clef"].reference, { x: 50, y: 150 }, "the middle");
        eq(findAll(api.root, "cnb-cle-anchor-select")[0].value, "middle", "shown");
        eq(findAll(api.root, "cnb-cle-anchor-picker").length, 0, "no picker");
      });
    }},

  { name: "render: A point on the clef opens the enlarged clef; a click sets its reference, Done closes it", fn: () => {
      withDomStub(container => {
        let last = null;
        let calls = 0;
        const api = E.render(container, { config: clefConfig(), onChange: (slices) => { last = slices; calls++; } });
        findAll(api.root, "cnb-cle-anchor-select")[0].onchange({ target: { value: "point" } });
        eq(calls, 0, "opening the picker changes nothing");
        eq(findAll(api.root, "cnb-cle-anchor-select")[0].value, "point", "the dropdown says so");
        const svg = findAll(api.root, "cnb-cle-anchor-picker")[0].children.find(c => c.getAttribute("class") === "cnb-cle-anchor-svg");
        assert(svg, "the enlarged clef");
        // The test glyph's box is 100 × 300 units, drawn 120 px tall: 0.4 px a unit, 12 px around.
        svg.onclick({ clientX: 12 + 50 * 0.4, clientY: 12 + 100 * 0.4 });
        deepEq(last.clef.glyphs["test-clef"].reference, { x: 50, y: 100 }, "the point clicked, in the clef's units");
        findAll(api.root, "cnb-cle-anchor-done")[0].onclick();
        eq(findAll(api.root, "cnb-cle-anchor-picker").length, 0, "Done closes it");
        eq(findAll(api.root, "cnb-cle-anchor-select")[0].value, "point", "a point on the clef");
      });
    }},

  { name: "render: a built-in clef opens on A point on the clef, its height automatic until one is typed", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: (slices) => { last = slices; },
        });
        findAll(api.root, "cnb-cle-select")[0].onchange({ target: { value: "alto" } });
        eq(findAll(api.root, "cnb-cle-anchor-select")[0].value, "middle", "the alto clef's middle, on its line");
        eq(findAll(api.root, "cnb-cle-height")[0].value, String(Math.round(4 * 2.724 * 1e4) / 1e4), "automatic: 4 symbol staff spaces");
        eq(findAll(api.root, "cnb-cle-height-auto-check")[0].checked, true, "automatic");
        findAll(api.root, "cnb-cle-height")[0].oninput({ target: { value: "8" } });
        eq(last.clef.glyphs.alto.semitoneHeight, 8, "set by hand");
        eq(findAll(api.root, "cnb-cle-height-auto-check")[0].checked, false, "no longer automatic");
        findAll(api.root, "cnb-cle-height-auto-check")[0].onchange({ target: { checked: true } });
        eq(last.clef.glyphs.alto.semitoneHeight, null, "automatic again");
        findAll(api.root, "cnb-cle-select")[0].onchange({ target: { value: "treble" } });
        eq(findAll(api.root, "cnb-cle-anchor-select")[0].value, "point", "the treble clef's curl");
      });
    }},

  { name: "render: the dozenal clef has no anchor to choose and a height, automatic or set", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: (slices) => { last = slices; },
        });
        findAll(api.root, "cnb-cle-select")[0].onchange({ target: { value: "dozenal" } });
        eq(findAll(api.root, "cnb-cle-anchor-select").length, 0, "no Anchor");
        assert(subtreeText(findAll(api.root, "cnb-cle-anchor")[0]).includes("middle of the staff"), "it sits on the middle");
        eq(findAll(api.root, "cnb-cle-height-auto-check")[0].checked, true, "automatic");
        findAll(api.root, "cnb-cle-height")[0].oninput({ target: { value: "6" } });
        eq(last.clef.glyphs.dozenal.semitoneHeight, 6, "set by hand");
      });
    }},

  { name: "render: a text clef shows Top only", fn: () => {
      withDomStub(container => {
        const config = clefConfig();
        config.clef.active = "register-5";
        const api = E.render(container, { config });
        const select = findAll(api.root, "cnb-cle-anchor-select")[0];
        eq(optionTexts(select).join(", "), "Top", "Top only");
        eq(select.disabled, true, "nothing to choose");
        eq(findAll(api.root, "cnb-cle-height").length, 0, "no height field");
      });
    }},

  // ── render(): c. Sits on, and d. the space after the clef ──
  { name: "render: Sits on offers the canvas's pitches and writes the anchor's semitone", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, { config: clefConfig(), onChange: (slices) => { last = slices; } });
        const select = findAll(api.root, "cnb-cle-sits-select")[0];
        const texts = optionTexts(select);
        eq(texts[0], "E · semitone 28", "top to bottom");
        eq(texts[texts.length - 1], "A semitone of my own…", "then the designer's own");
        eq(select.value, "20", "the clef's semitone");
        eq(findAll(api.root, "cnb-cle-sits").length, 0, "no field while it is on a pitch");
        select.onchange({ target: { value: "19" } });
        eq(last.clef.glyphs["test-clef"].anchorSemi, 19, "written");
        eq(last.clef.glyphs["register-5"].anchorSemi, 18, "other definition untouched");
        eq(findAll(api.root, "cnb-cle-sits-select")[0].value, "19", "shown");
      });
    }},

  { name: "render: A semitone of my own… shows a number field, decimals allowed, kept in the host's view", fn: () => {
      withDomStub(container => {
        let last = null;
        const view = {};
        const api = E.render(container, { config: clefConfig(), view, onChange: (slices) => { last = slices; } });
        findAll(api.root, "cnb-cle-sits-select")[0].onchange({ target: { value: "own" } });
        eq(view.ownSemitone, true, "the host's view says so");
        const field = findAll(api.root, "cnb-cle-sits")[0];
        eq(field.value, "20", "the clef's semitone");
        field.oninput({ target: { value: "22.784" } });
        eq(last.clef.glyphs["test-clef"].anchorSemi, 22.784, "written");
        eq(findAll(api.root, "cnb-cle-sits-select")[0].value, "own", "still the designer's own");
        findAll(api.root, "cnb-cle-sits")[0].oninput({ target: { value: "21" } });
        eq(findAll(api.root, "cnb-cle-sits-select")[0].value, "own", "a whole semitone too, while it is open");
        container.textContent = "";
        const again = E.render(container, { config: { ...clefConfig(), clef: last.clef }, view });
        eq(findAll(again.root, "cnb-cle-sits").length, 1, "a re-mount keeps it open");
        findAll(again.root, "cnb-cle-sits-select")[0].onchange({ target: { value: "12" } });
        eq(view.ownSemitone, false, "a pitch closes it");
      });
      withDomStub(container => {
        const config = clefConfig();
        config.clef.glyphs["test-clef"].anchorSemi = 13.5;
        const api = E.render(container, { config });
        eq(findAll(api.root, "cnb-cle-sits-select")[0].value, "own", "a semitone between pitches is the designer's own");
        eq(findAll(api.root, "cnb-cle-sits")[0].value, "13.5", "in its field");
      });
    }},

  { name: "render: input that is not a number, or not positive, is ignored (no onChange)", fn: () => {
      withDomStub(container => {
        let calls = 0;
        const api = E.render(container, { config: clefConfig(), view: { ownSemitone: true }, onChange: () => { calls++; } });
        findAll(api.root, "cnb-cle-sits")[0].oninput({ target: { value: "not-a-number" } });
        findAll(api.root, "cnb-cle-height")[0].oninput({ target: { value: "0" } });
        findAll(api.root, "cnb-cle-height")[0].oninput({ target: { value: "-3" } });
        eq(calls, 0, "no onChange");
        eq(api.getState().glyphs["test-clef"].anchorSemi, 20, "state unchanged");
        eq(api.getState().glyphs["test-clef"].semitoneHeight, 6, "height unchanged");
      });
    }},

  { name: "render: a text clef's Sits on writes its top", fn: () => {
      withDomStub(container => {
        let last = null;
        const config = clefConfig();
        config.clef.active = "register-5";
        const api = E.render(container, { config, onChange: (slices) => { last = slices; } });
        eq(findAll(api.root, "cnb-cle-sits-select")[0].value, "18", "its top");
        findAll(api.root, "cnb-cle-sits-select")[0].onchange({ target: { value: "16" } });
        eq(last.clef.glyphs["register-5"].anchorSemi, 16, "written");
      });
    }},

  { name: "render: the dozenal clef sits on the middle of the staff, fixed", fn: () => {
      withDomStub(container => {
        const config = CNBConfig.createDefault();
        config.clef = { ...config.clef, enabled: true, active: "dozenal", glyphs: { dozenal: { kind: "dozenal", displayName: "Dozenal" } } };
        const api = E.render(container, { config, parts: ["placement"] });
        eq(findAll(api.root, "cnb-cle-sits-select").length, 0, "no dropdown");
        eq(findAll(api.root, "cnb-cle-sits-fixed")[0].textContent, "the middle of the staff", "fixed");
        assert(subtreeText(findAll(api.root, "cnb-cle-dozenal-note")[0]).includes("50 for treble"), "the note names the numeral");
      });
    }},

  { name: "render: the space after the clef is LilyPond's; no Space either side, and the stored padding is kept", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, { config: clefConfig(), onChange: (slices) => { last = slices; } });
        eq(findAll(api.root, "cnb-cle-gutter-input").length, 0, "no padding field");
        assert(!subtreeText(api.root).includes("Space either side"), "no Space either side");
        const note = findAll(api.root, "cnb-cle-space-note")[0];
        assert(note.textContent.includes("LilyPond's") && note.textContent.includes("0.75 staff spaces"), "the line");
        findAll(api.root, "cnb-cle-sits-select")[0].onchange({ target: { value: "19" } });
        eq(last.clef.gutter.paddingH, 10, "the stored padding kept");
      });
    }},

  { name: "render: with no clef shown, placement says to choose one in step 10", fn: () => {
      withDomStub(container => {
        const api = E.render(container, { config: CNBConfig.createDefault(), parts: ["placement"] });
        eq(findAll(api.root, "cnb-cle-anchor-empty").length, 1, "the note");
        eq(findAll(api.root, "cnb-cle-sits-select").length, 0, "no dropdown");
      });
    }},

  // ── render(): import wiring ──
  { name: "render: importClefText adds the glyph, chooses it, opens the picker and fires onChange", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: (slices) => { last = slices; },
          parser: stubParserFor(CLEF_SVG_DOC),
        });
        const result = api.importClefText("<svg/>", "my-clef.svg");
        eq(result.error, null, "import succeeded");
        eq(last.clef.active, "my-clef", "imported glyph is active");
        eq(last.clef.enabled, true, "and shown");
        eq(last.clef.glyphs["my-clef"].kind, "glyph", "glyph entry stored");
        assert(subtreeText(api.root).includes('Imported the clef "my-clef"'),
          "status line shown");
        eq(findAll(api.root, "cnb-cle-select")[0].value, "my-clef", "the dropdown shows it");
        eq(findAll(api.root, "cnb-cle-anchor-picker").length, 1, "the anchor picker opens");
        eq(findAll(api.root, "cnb-cle-anchor-select")[0].value, "point", "on A point on the clef");
      });
    }},

  { name: "render: a failed clef import leaves state untouched and shows the error (no onChange)", fn: () => {
      withDomStub(container => {
        let calls = 0;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: () => { calls++; },
          parser: stubParserFor(stubDoc({ rootAttrs: { viewBox: "0 0 1 1" } })),
        });
        const result = api.importClefText("<svg/>", "broken.svg");
        assert(result.error, "importer reported an error");
        eq(calls, 0, "no onChange");
        deepEq(api.getState().glyphs, {}, "no glyph added");
        assert(subtreeText(api.root).includes("Import failed:"), "error line shown");
      });
    }},

  { name: "render: the imported glyph's anchor is its middle, on the seeded config's staff midpoint", fn: () => {
      withDomStub(container => {
        const config = CNBConfig.createDefault();
        config.staff.midpoint = 18;
        const api = E.render(container, {
          config,
          parser: stubParserFor(CLEF_SVG_DOC),
        });
        api.importClefText("<svg/>", "centered.svg");
        // The anchor at the box's centre, on the midpoint (session 59).
        eq(api.getState().glyphs["centered"].anchorSemi, 18, "midpoint forwarded to the importer");
        eq(E.anchorChoice(api.getState().glyphs["centered"]), "middle", "Middle");
      });
    }},

  // ── render(): validation pass-through ──
  { name: "render: validation section reports enabled-without-active as an error, valid config as ✓", fn: () => {
      withDomStub(container => {
        const broken = CNBConfig.createDefault();
        broken.clef = { enabled: true, active: null, glyphs: {}, gutter: { paddingH: 12 } };
        const api = E.render(container, { config: broken });
        assert(findAll(api.root, "cnb-cle-error").some(e => e.textContent.includes("clef.active")),
          "missing-active error surfaced");
      });
      withDomStub(container => {
        const api = E.render(container, { config: clefConfig() });
        eq(findAll(api.root, "cnb-cle-valid").length, 1, "valid config shows the ✓ line");
      });
    }},

  // ── render(): API surface ──
  { name: "render: setState applies a partial state and applyTo returns a config with it", fn: () => {
      withDomStub(container => {
        const api = E.render(container, { config: clefConfig() });
        api.setState({ enabled: false });
        eq(api.getClef().enabled, false, "setState applied");
        const out = api.applyTo(CNBConfig.createDefault());
        eq(out.clef.enabled, false, "applyTo carries the state");
        deepEq(Object.keys(out.clef.glyphs).sort(), ["register-5", "test-clef"], "glyphs carried");
      });
    }},

  // ── parts (session 63; session 79, design §2.3): one editor, two steps ──
  { name: "render parts: symbol draws the clef, its anchor, its height and the validation, and no placement", fn: () => {
      withDomStub(container => {
        const config = clefConfig();
        config.clef.glyphs["test-clef"].reference = { x: 50, y: 150 };
        const api = E.render(container, { config, parts: ["symbol"] });
        for (const token of ["cnb-cle-select", "cnb-cle-import-button", "cnb-cle-anchor-select",
                             "cnb-cle-height", "cnb-cle-validation"]) {
          assert(findAll(api.root, token).length > 0, token + " drawn in symbol");
        }
        eq(findAll(api.root, "cnb-cle-sits-select").length, 0, "no Sits on in symbol");
        eq(findAll(api.root, "cnb-cle-space-note").length, 0, "no space note in symbol");
      });
    }},

  { name: "render parts: placement draws only where the clef sits and the space after it", fn: () => {
      withDomStub(container => {
        const config = clefConfig();
        config.clef.glyphs["test-clef"].reference = { x: 50, y: 150 };
        const api = E.render(container, { config, parts: ["placement"] });
        eq(findAll(api.root, "cnb-cle-sits-select").length, 1, "Sits on");
        assert(subtreeText(api.root).includes("drag the clef"), "the preview drag's hint");
        eq(findAll(api.root, "cnb-cle-space-note").length, 1, "the space after the clef");
        for (const token of ["cnb-cle-select", "cnb-cle-import-button", "cnb-cle-anchor-select",
                             "cnb-cle-height", "cnb-cle-validation"]) {
          eq(findAll(api.root, token).length, 0, token + " not drawn in placement");
        }
      });
    }},

  { name: "render parts: both parts draw what the whole panel draws, and an edit in one part emits the whole clef", fn: () => {
      withDomStub(container => {
        const config = clefConfig();
        let last = null;
        const whole = E.render(container, { config });
        for (const token of ["cnb-cle-select", "cnb-cle-anchor-select", "cnb-cle-sits-select", "cnb-cle-space-note", "cnb-cle-validation"]) {
          eq(findAll(whole.root, token).length, 1, token + " in the whole panel");
        }
        container.textContent = "";
        const api = E.render(container, { config, parts: ["placement"], onChange: (s) => { last = s; } });
        findAll(api.root, "cnb-cle-sits-select")[0].onchange({ target: { value: "19" } });
        eq(last.clef.glyphs["test-clef"].anchorSemi, 19, "the edit");
        deepEq(Object.keys(last.clef.glyphs).sort(), ["register-5", "test-clef"], "every glyph carried");
        eq(last.clef.gutter.paddingH, 10, "the gutter carried");
      });
    }},

];
