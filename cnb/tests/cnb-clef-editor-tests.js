/**
 * cnb-clef-editor-tests.js — Unit tests for the Clef Editor
 * (set 009 session 2)
 *
 * Covers the pure state ↔ config builders (buildClef / applyToConfig /
 * stateFromConfig, round-tripped on every branch), the render() UI driven
 * against a stub DOM (enable toggle, glyph selection, anchor-semitone
 * control including FLOAT values, gutter sizing, explicit empty states),
 * the clef import wiring with an injected parser, and the Module A
 * validation pass-through.
 */

import { CNBClefEditor } from "../ui/clef-editor.js";
import { CNBConfig } from "../src/cnb-config.js";

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

  // ── render(): enable toggle ──
  { name: "render: enable checkbox reflects state and toggling fires onChange with the built slice", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: (slices, state) => { last = { slices, state }; },
        });
        const cb = findAll(api.root, "cnb-cle-enable-check")[0];
        eq(cb.checked, false, "seeded unchecked from default config");
        cb.onchange({ target: { checked: true } });
        eq(last.slices.clef.enabled, true, "onChange slice enabled");
        deepEq(last.slices.clef, api.getClef(), "slice matches getClef()");
        eq(findAll(api.root, "cnb-cle-enable-check")[0].checked, true, "redraw shows checked");
      });
    }},

  { name: "render: the enable toggle says what it does, and no Preview only badge (the clef exports, session 30)", fn: () => {
      withDomStub(container => {
        const api = E.render(container, { config: CNBConfig.createDefault() });
        const toggle = findAll(api.root, "cnb-cle-enable")[0];
        eq(findAll(toggle, "cnb-cle-enable-text")[0].textContent, "Show a clef at the start of the staff", "toggle text");
        eq(findAll(api.root, "cnb-badge").length, 0, "no badge");
        eq(E.CLEF_PREVIEW_ONLY, undefined, "no preview-only tooltip");
        // The panel's own text; the validation list is the checks list's (hidden in the app).
        const text = api.root.children
          .filter(c => !String(c.className).includes("cnb-cle-validation"))
          .map(subtreeText).join(" ");
        for (const dev of ["Clef glyph", "Module", "set 0", "Gutter", "Anchor", "Toolkit contract", "Float"]) {
          assert(!text.includes(dev), `no developer wording "${dev}" in: ${text}`);
        }
      });
    }},

  // ── render(): glyph selection ──
  { name: "render: glyph rows list every definition and clicking one sets it active", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: clefConfig(),
          onChange: (slices) => { last = slices; },
        });
        const rows = findAll(api.root, "cnb-cle-glyph-option");
        eq(rows.length, 2, "both definitions listed");
        const active = rows.filter(r => r.className.includes("selected"));
        eq(active.length, 1, "one selected row");
        eq(active[0].getAttribute("data-glyph-name"), "test-clef", "seeded active selected");

        const textRow = rows.find(r => r.getAttribute("data-glyph-name") === "register-5");
        textRow.onclick();
        eq(last.clef.active, "register-5", "clicking a row activates it");
        const after = findAll(api.root, "cnb-cle-glyph-option")
          .find(r => r.getAttribute("data-glyph-name") === "register-5");
        assert(after.className.includes("selected"), "redraw marks the new selection");
      });
    }},

  { name: "render: with no glyphs the list and anchor sections show explicit empty-state notes", fn: () => {
      withDomStub(container => {
        const api = E.render(container, { config: CNBConfig.createDefault() });
        eq(findAll(api.root, "cnb-cle-glyph-option").length, 0, "no glyph rows");
        eq(findAll(api.root, "cnb-cle-empty").length, 1, "glyph-list empty state");
        eq(findAll(api.root, "cnb-cle-anchor-empty").length, 1, "anchor empty state");
        eq(findAll(api.root, "cnb-cle-anchor-input").length, 0, "no anchor input");
      });
    }},

  // ── withRange (session 45) ──
  { name: "withRange: moves and resizes the active glyph clef (top → anchorSemi, top − bottom → semitoneHeight)", fn: () => {
      const clef = clefConfig().clef;
      const moved = E.withRange(clef, 23.5, 17.5);
      eq(moved.glyphs["test-clef"].anchorSemi, 23.5, "top");
      eq(moved.glyphs["test-clef"].semitoneHeight, 6, "same height: moved");
      const taller = E.withRange(clef, 20, 8.25);
      eq(taller.glyphs["test-clef"].semitoneHeight, 11.75, "resized");
      eq(taller.glyphs["register-5"].anchorSemi, 18, "other definitions untouched");
      eq(clef.glyphs["test-clef"].anchorSemi, 20, "the argument is not mutated");
      eq(clef.glyphs["test-clef"].semitoneHeight, 6, "nor its height");
    }},

  { name: "withRange: null for an empty or reversed range, a non-number, or a clef that is not a glyph", fn: () => {
      const clef = clefConfig().clef;
      eq(E.withRange(clef, 14, 14), null, "empty range");
      eq(E.withRange(clef, 10, 14), null, "bottom above top");
      eq(E.withRange(clef, NaN, 14), null, "not a number");
      eq(E.withRange({ ...clef, active: "register-5" }, 20, 14), null, "a text clef");
      eq(E.withRange({ ...clef, active: null }, 20, 14), null, "no clef active");
      eq(E.withRange({ ...clef, active: "d", glyphs: { d: { kind: "dozenal" } } }, 20, 14), null, "the dozenal clef");
    }},

  // ── render(): the range of a glyph clef (session 45) ──
  { name: "render: a glyph clef's range fields show its bottom and top and write them, decimals included", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: clefConfig(),
          onChange: (slices) => { last = slices; },
        });
        eq(findAll(api.root, "cnb-cle-anchor-input").length, 0, "no top-only field for a glyph");
        const bottom = findAll(api.root, "cnb-cle-range-bottom")[0];
        const top = findAll(api.root, "cnb-cle-range-top")[0];
        eq(bottom.value, "14", "bottom = anchorSemi − semitoneHeight");
        eq(top.value, "20", "top = anchorSemi");
        top.oninput({ target: { value: "22.784" } });
        eq(last.clef.glyphs["test-clef"].anchorSemi, 22.784, "top written");
        eq(last.clef.glyphs["test-clef"].semitoneHeight, 8.784, "the bottom stays put");
        findAll(api.root, "cnb-cle-range-bottom")[0].oninput({ target: { value: "10" } });
        eq(last.clef.glyphs["test-clef"].semitoneHeight, 12.784, "bottom written, the top stays");
        eq(last.clef.glyphs["register-5"].anchorSemi, 18, "other definition untouched");
        assert(subtreeText(findAll(api.root, "cnb-cle-glyph-option")[0]).includes("semitones 10 to 22.784"),
          "the glyph's row shows its range");
      });
    }},

  { name: "render: range input that is not a number, or leaves no room, is ignored (no onChange)", fn: () => {
      withDomStub(container => {
        let calls = 0;
        const api = E.render(container, {
          config: clefConfig(),
          onChange: () => { calls++; },
        });
        findAll(api.root, "cnb-cle-range-top")[0].oninput({ target: { value: "not-a-number" } });
        findAll(api.root, "cnb-cle-range-top")[0].oninput({ target: { value: "12" } });
        findAll(api.root, "cnb-cle-range-bottom")[0].oninput({ target: { value: "20" } });
        eq(calls, 0, "no onChange");
        eq(api.getState().glyphs["test-clef"].anchorSemi, 20, "state unchanged");
        eq(api.getState().glyphs["test-clef"].semitoneHeight, 6, "height unchanged");
      });
    }},

  // ── render(): the clefs to choose from (session 45) ──
  { name: "render: Dozenal, Treble, Bass and Alto buttons; one adds its clef, shows it and turns the clef on", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: (slices) => { last = slices; },
        });
        const buttons = findAll(api.root, "cnb-cle-choice");
        eq(buttons.map(b => b.textContent).join(" "), "Dozenal Treble Bass Alto", "the four choices");
        assert(buttons.every(b => !b.className.includes(" on")), "none shown yet");
        buttons.find(b => b.getAttribute("data-clef") === "treble").onclick();
        eq(last.clef.enabled, true, "the clef is turned on");
        eq(last.clef.active, "treble", "treble shown");
        eq(last.clef.glyphs.treble.kind, "glyph", "LilyPond's treble glyph added");
        // G (7) nearest the default middle, 4 semitones a staff space.
        assert(Math.abs(last.clef.glyphs.treble.anchorSemi - (7 + 1194.75 / 250 * 4)) < 1e-4, "its line on G");
        const on = findAll(api.root, "cnb-cle-choice").filter(b => b.className.includes(" on"));
        eq(on.length, 1, "one button marked");
        eq(on[0].getAttribute("data-clef"), "treble", "the treble button");
        findAll(api.root, "cnb-cle-choice").find(b => b.getAttribute("data-clef") === "dozenal").onclick();
        eq(last.clef.active, "dozenal", "dozenal shown");
        eq(last.clef.glyphs.dozenal.kind, "dozenal", "the dozenal clef added");
        assert("treble" in last.clef.glyphs, "the treble clef stays in the list");
        eq(CNBConfig.validate(api.applyTo(CNBConfig.createDefault())).valid, true, "valid");
      });
    }},

  { name: "render: choosing a clef the config already has keeps its placement", fn: () => {
      withDomStub(container => {
        let last = null;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: (slices) => { last = slices; },
        });
        findAll(api.root, "cnb-cle-choice").find(b => b.getAttribute("data-clef") === "bass").onclick();
        findAll(api.root, "cnb-cle-range-top")[0].oninput({ target: { value: "30" } });
        findAll(api.root, "cnb-cle-choice").find(b => b.getAttribute("data-clef") === "alto").onclick();
        findAll(api.root, "cnb-cle-choice").find(b => b.getAttribute("data-clef") === "bass").onclick();
        eq(last.clef.active, "bass", "bass shown again");
        eq(last.clef.glyphs.bass.anchorSemi, 30, "its moved top kept");
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
        findAll(api.root, "cnb-cle-choice").find(b => b.getAttribute("data-clef") === "alto").onclick();
        eq(last.clef.glyphs.alto.anchorSemi, 24 + 8, "C nearest 24 is 24; the top is 2 staff spaces above");
      });
    }},

  { name: "render: the dozenal clef has no fields; the panel says the engine places it", fn: () => {
      withDomStub(container => {
        const config = CNBConfig.createDefault();
        config.clef = { ...config.clef, enabled: true, active: "dozenal", glyphs: { dozenal: { kind: "dozenal", displayName: "Dozenal" } } };
        const api = E.render(container, { config });
        eq(findAll(api.root, "cnb-cle-range-top").length, 0, "no range");
        eq(findAll(api.root, "cnb-cle-anchor-input").length, 0, "no top field");
        const note = findAll(api.root, "cnb-cle-dozenal-note")[0];
        assert(note && note.textContent.includes("50 for treble"), "the note names the numeral");
      });
    }},

  { name: "render: switching the active glyph re-seeds the anchor input from that definition", fn: () => {
      withDomStub(container => {
        const api = E.render(container, { config: clefConfig() });
        findAll(api.root, "cnb-cle-glyph-option")
          .find(r => r.getAttribute("data-glyph-name") === "register-5")
          .onclick();
        eq(findAll(api.root, "cnb-cle-anchor-input")[0].value, "18",
          "anchor input shows the new active definition's value");
      });
    }},

  // ── render(): gutter sizing ──
  { name: "render: gutter padding input edits gutter.paddingH; negative input is ignored", fn: () => {
      withDomStub(container => {
        let last = null;
        let calls = 0;
        const api = E.render(container, {
          config: clefConfig(),
          onChange: (slices) => { last = slices; calls++; },
        });
        const pad = findAll(api.root, "cnb-cle-gutter-input")[0];
        eq(pad.value, "10", "seeded from config");
        pad.oninput({ target: { value: "24" } });
        eq(last.clef.gutter.paddingH, 24, "padding applied");
        const before = calls;
        pad.oninput({ target: { value: "-5" } });
        eq(calls, before, "negative input ignored");
        eq(api.getState().gutter.paddingH, 24, "state keeps the last valid value");
      });
    }},

  // ── render(): import wiring ──
  { name: "render: importClefText adds the glyph, activates it, and fires onChange", fn: () => {
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
        eq(last.clef.glyphs["my-clef"].kind, "glyph", "glyph entry stored");
        assert(subtreeText(api.root).includes('Imported the clef "my-clef"'),
          "status line shown");
        eq(findAll(api.root, "cnb-cle-glyph-option").length, 1, "glyph row rendered");
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

  { name: "render: the imported glyph's default anchor centers on the seeded config's staff midpoint", fn: () => {
      withDomStub(container => {
        const config = CNBConfig.createDefault();
        config.staff.midpoint = 18;
        const api = E.render(container, {
          config,
          parser: stubParserFor(CLEF_SVG_DOC),
        });
        api.importClefText("<svg/>", "centered.svg");
        // semitoneHeight 6 → anchor = midpoint + height/2 = 18 + 3
        eq(api.getState().glyphs["centered"].anchorSemi, 21, "midpoint forwarded to the importer");
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

];
