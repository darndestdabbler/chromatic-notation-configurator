/**
 * cnb-key-signature-editor-tests.js — Unit tests for the Key Signature
 * Editor (set 010 session 2)
 *
 * Covers the pure state ↔ config builders (buildKeys / applyToConfig /
 * stateFromConfig, round-tripped on every branch), the render() UI driven
 * against a stub DOM (keys.enabled master gate with its explicit disabled
 * state, key-definition rows, and the panel of the key-signature design §7,
 * session 50: Notes, Stacks with the gold stem and the overlap note, and
 * Place), the editor-level duplicate-name check, the Module A
 * validation pass-through, and the export through the editor path (an
 * editor-built keysig-enabled config leaves the signature to the engine;
 * the default, signature off, exports 'none — session 30).
 */

import { CNBKeySignatureEditor } from "../ui/key-signature-editor.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBBuiltinShapes } from "../ui/builtin-shapes.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBMusic } from "../src/cnb-music.js";
import { CNBKeySignature } from "../src/cnb-key-signature.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
// Same stub pattern as the Module 12–15 and clef editor tests.

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

/** All descendants whose attribute holds the value (as one of its tokens). */
function findAttr(el, attr, value) {
  const out = [];
  for (const child of el.children || []) {
    const v = child.getAttribute ? child.getAttribute(attr) : null;
    if (v !== null && v !== undefined && String(v).split(/\s+/).includes(value)) out.push(child);
    out.push(...findAttr(child, attr, value));
  }
  return out;
}

/** The canvas's drawn symbols: every element marked with data-mark. */
function symbolsIn(el) {
  const out = [];
  for (const child of el.children || []) {
    if (child.getAttribute && child.getAttribute("data-mark") !== null) out.push(child);
    out.push(...symbolsIn(child));
  }
  return out;
}

const E = CNBKeySignatureEditor;

const C_MAJOR = { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] };
const A_MAJOR = { name: "A", pitchClasses: [1, 2, 4, 6, 8, 9, 11] };

/** Default config with keys + key signature enabled on a C-major definition. */
function keysConfig() {
  const config = CNBConfig.createDefault();
  config.keys.enabled = true;
  config.keys.definitions = [JSON.parse(JSON.stringify(C_MAJOR))];
  config.keys.keySignature.enabled = true;
  return config;
}

/** A fully-populated, non-default keys section exercising every field. */
function fancyKeys() {
  return {
    enabled: true,
    definitions: [
      { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
      { name: "Mystery", pitchClasses: [3, 7, 10], tonicPc: 7 },
    ],
    offKeyMark: { future: true },
    keySignature: {
      enabled: true,
      // The designer's settings (session 48), carried through unchanged,
      // the model's (session 54) among them.
      notes: "tonic-and-half-steps",
      upperTonic: false,
      looks: { all: { heightSemis: 1.2, widthSemis: 1.2, offset: { x: 0.5, y: 0 } }, natural: { added: [{ shape: "crotchet-minim", offset: { x: 1, y: 1 } }] },
        flat: { color: "#0000ff" }, sharp: { hollow: true, sign: "sharp" }, line: { hollow: false }, space: { hollow: true } },
      stacking: "parity-stacks",
      heights: "scale",
      window: { sharp: 2, flat: -1 },
      alternate: { color: "#ff0000" },
      columns: "left-in-sharp-keys",
      placement: { rule: "scale-from-tonic", tonicOctave: 2, position: "every-set" },
      separator: { enabled: false, color: "#123abc", thicknessPct: 40, extentSemis: 6, shareThickness: false },
      signs: { heightSemis: 3.5 },
    },
  };
}

export const tests = [

  // ─── stateFromConfig ───────────────────────────────────────────────────

  { name: "stateFromConfig: default config opens as the default-off state", fn: () => {
      const state = E.stateFromConfig(CNBConfig.createDefault());
      eq(state.enabled, false, "keys disabled");
      deepEq(state.definitions, [], "no definitions");
      eq(state.keySignature.enabled, false, "signature disabled");
      assert(!("style" in state.keySignature), "no style (retired in session 54)");
      eq(state.keySignature.heights, "window", "the model's defaults");
      eq(state.keySignature.placement.rule, "scale-from-tonic", "default rule");
      eq(state.keySignature.placement.tonicOctave, null, "auto octave");
      eq(state.keySignature.separator.enabled, true, "separator on by default");
      eq(state.keySignature.separator.color, "#ffd42a", "engine gold");
      eq(state.keySignature.separator.thicknessPct, 160, "default thickness (engine 0.4 staff-space at sps 4)");
      eq(state.keySignature.separator.extentSemis, 12, "default extent");
      assert(!("dot" in state.keySignature) && !("intervalBlocks" in state.keySignature) &&
        !("staggeredLedgers" in state.keySignature), "no simple-mark style subsections");
      assert(!("gutter" in state.keySignature), "no gutter: the spacing is the engine's (session 34)");
  } },

  { name: "stateFromConfig: tolerant of missing/malformed sections (pre-set-010 configs)", fn: () => {
      const state = E.stateFromConfig({});
      eq(state.enabled, false, "missing keys → disabled");
      deepEq(state.definitions, [], "missing definitions → []");
      eq(state.keySignature.notes, "all", "missing signature → defaults");

      const malformed = E.stateFromConfig({ keys: {
        enabled: "yes", definitions: "nope", offKeyMark: 4,
        keySignature: { style: 7, placement: 3, separator: { color: "gold", thicknessPct: -1, extentSemis: 0 },
                        gutter: { paddingH: NaN } },   // retired (session 34): dropped
      } });
      eq(malformed.enabled, true, "truthy enabled coerced");
      deepEq(malformed.definitions, [], "non-array definitions → []");
      deepEq(malformed.offKeyMark, {}, "non-object offKeyMark → {}");
      assert(!("style" in malformed.keySignature), "a carried style is not read");
      eq(malformed.keySignature.placement.rule, "scale-from-tonic", "non-object placement → default rule");
      eq(malformed.keySignature.separator.color, "#ffd42a", "invalid hex → default");
      eq(malformed.keySignature.separator.thicknessPct, 160, "negative thickness → default");
      eq(malformed.keySignature.separator.extentSemis, 12, "zero extent → default");
      assert(!("gutter" in malformed.keySignature), "a retired gutter is not carried");
  } },

  { name: "stateFromConfig: an unknown rule STRING is preserved (preserve-and-report); a style is not carried", fn: () => {
      const state = E.stateFromConfig({ keys: { keySignature: {
        style: "tonic-label", placement: { rule: "tonic-only" },
      } } });
      assert(!("style" in state.keySignature), "style retired (session 54): not carried");
      eq(state.keySignature.placement.rule, "tonic-only", "unknown rule kept");
  } },

  // ─── buildKeys / round-trips ───────────────────────────────────────────

  { name: "buildKeys ∘ stateFromConfig round-trips the default keys slice deep-equal", fn: () => {
      const config = CNBConfig.createDefault();
      deepEq(E.buildKeys(E.stateFromConfig(config)), config.keys, "default round-trip");
  } },

  { name: "buildKeys ∘ stateFromConfig round-trips a fully-populated keys section", fn: () => {
      const config = CNBConfig.createDefault();
      config.keys = fancyKeys();
      deepEq(E.buildKeys(E.stateFromConfig(config)), config.keys, "fancy round-trip");
  } },

  { name: "stateFromConfig: a keySignature saved before the designer's settings (session 48) opens with them at their defaults", fn: () => {
      const state = E.stateFromConfig({ keys: { keySignature: {
        enabled: true,
        placement: { rule: "scale-from-tonic", tonicOctave: null },
        separator: { enabled: true, color: "#ffd42a", thicknessPct: 160, extentSemis: 12 },
      } } });
      const ks = CNBConfig.createDefault().keys.keySignature;
      for (const f of ["notes", "upperTonic", "looks", "stacking", "heights", "window", "alternate", "columns"]) {
        deepEq(state.keySignature[f], ks[f], f);
      }
      eq(state.keySignature.placement.position, "middle", "placement.position");
      eq(state.keySignature.separator.shareThickness, true, "separator.shareThickness");
      eq(state.keySignature.signs.heightSemis, null, "signs.heightSemis (session 52): automatic");
  } },

  { name: "stateFromConfig / buildKeys: signs.heightSemis kept as stored, automatic when absent; a non-number in state throws", fn: () => {
      const stored = h => E.stateFromConfig({ keys: { keySignature: { signs: { heightSemis: h } } } }).keySignature.signs.heightSemis;
      eq(stored(2.5), 2.5, "a number kept");
      eq(stored(0), 0, "an invalid number kept, for validation to report");
      eq(stored("big"), null, "a non-number: automatic");
      eq(E.stateFromConfig({ keys: { keySignature: {} } }).keySignature.signs.heightSemis, null, "absent: automatic");
      const state = E.stateFromConfig(CNBConfig.createDefault());
      state.keySignature.signs.heightSemis = "3";
      let threw = false;
      try { E.buildKeys(state); } catch (e) { threw = /signs\.heightSemis/.test(e.message); }
      assert(threw, "buildKeys throws on a non-number");
  } },

  { name: "applyToConfig replaces only the keys section and mutates neither argument", fn: () => {
      const config = CNBConfig.createDefault();
      const before = JSON.stringify(config);
      const state = E.stateFromConfig(config);
      state.enabled = true;
      state.definitions.push(JSON.parse(JSON.stringify(C_MAJOR)));
      const stateBefore = JSON.stringify(state);
      const out = E.applyToConfig(config, state);
      eq(out.keys.enabled, true, "keys section replaced");
      eq(out.keys.definitions.length, 1, "definition applied");
      eq(JSON.stringify(config), before, "input config not mutated");
      eq(JSON.stringify(state), stateBefore, "input state not mutated");
      deepEq(out.staff, config.staff, "staff untouched");
      deepEq(out.shapes, config.shapes, "shapes untouched");
      deepEq(out.clef, config.clef, "clef untouched");
  } },

  { name: "buildKeys: offKeyMark passes through untouched (deferred per plan §11)", fn: () => {
      const state = E.stateFromConfig(CNBConfig.createDefault());
      state.offKeyMark = { mark: "asterisk", size: 2 };
      deepEq(E.buildKeys(state).offKeyMark, { mark: "asterisk", size: 2 }, "passthrough");
  } },

  { name: "buildKeys: throws on structurally invalid state (caller-bug policy)", fn: () => {
      const good = () => E.stateFromConfig(CNBConfig.createDefault());
      assertThrows(() => E.buildKeys(null), "non-object state");
      assertThrows(() => E.buildKeys({ ...good(), definitions: "x" }), "non-array definitions");
      assertThrows(() => E.buildKeys({ ...good(), definitions: [null] }), "non-object definition");
      assertThrows(() => E.buildKeys({ ...good(), definitions: [{ name: 7, pitchClasses: [] }] }), "non-string name");
      assertThrows(() => E.buildKeys({ ...good(), definitions: [{ name: "C", pitchClasses: "all" }] }), "non-array pitchClasses");
      assertThrows(() => E.buildKeys({ ...good(), keySignature: null }), "non-object keySignature");

      const withSig = (patch) => {
        const s = good();
        Object.assign(s.keySignature, patch);
        return s;
      };
      assertThrows(() => E.buildKeys(withSig({ placement: { rule: 5, tonicOctave: null } })), "non-string rule");
      assertThrows(() => E.buildKeys(withSig({ placement: { rule: "scale-from-tonic", tonicOctave: 1.5 } })), "fractional tonicOctave");
      assertThrows(() => E.buildKeys(withSig({ separator: { enabled: true, color: "gold", thicknessPct: 25, extentSemis: 12 } })), "invalid hex");
      assertThrows(() => E.buildKeys(withSig({ separator: { enabled: true, color: "#ffd42a", thicknessPct: -1, extentSemis: 12 } })), "negative thickness");
      assertThrows(() => E.buildKeys(withSig({ separator: { enabled: true, color: "#ffd42a", thicknessPct: 25, extentSemis: 0 } })), "non-positive extent");
  } },

  { name: "buildKeys: mid-edit-reachable states do NOT throw (validation reports them)", fn: () => {
      const state = E.stateFromConfig(CNBConfig.createDefault());
      state.enabled = false;
      state.keySignature.enabled = true;   // signature on, keys off
      state.definitions = [{ name: "", pitchClasses: [] }];   // empty mid-edit
      const keys = E.buildKeys(state);
      eq(keys.keySignature.enabled, true, "built without throwing");
  } },

  // ─── tonicInfo (D3 chain mirrored for the hint) ────────────────────────

  { name: "tonicInfo: explicit tonicPc → name letter → first-pc fallback, with the source named", fn: () => {
      deepEq(E.tonicInfo({ name: "C", pitchClasses: [0], tonicPc: 4 }),
        { pc: 4, source: "explicit" }, "explicit wins");
      deepEq(E.tonicInfo({ name: "F# minor", pitchClasses: [0] }),
        { pc: 6, source: "name" }, "parsed from name");
      deepEq(E.tonicInfo({ name: "Mystery", pitchClasses: [7, 9] }),
        { pc: 7, source: "fallback" }, "first-pc fallback");
  } },

  // ─── editorWarnings ────────────────────────────────────────────────────

  { name: "editorWarnings: duplicate definition names are flagged; unique/empty names are not", fn: () => {
      const state = E.stateFromConfig(CNBConfig.createDefault());
      state.definitions = [
        { name: "C", pitchClasses: [0] },
        { name: "C", pitchClasses: [1] },
        { name: "D", pitchClasses: [2] },
        { name: "", pitchClasses: [3] },
        { name: "", pitchClasses: [4] },
      ];
      const warnings = E.editorWarnings(state);
      eq(warnings.length, 1, "one duplicate warning");
      assert(warnings[0].includes('"C"'), "names the duplicate");
      deepEq(E.editorWarnings(E.stateFromConfig(CNBConfig.createDefault())), [], "no warnings on default");
  } },

  // ─── render(): master gate and explicit disabled state ────────────────

  { name: "render: keys disabled → explicit disabled note, controls disabled, master toggle live", fn: () => {
      withDomStub((container) => {
        const config = CNBConfig.createDefault();
        config.keys.definitions = [JSON.parse(JSON.stringify(C_MAJOR))];
        E.render(container, { config });
        const root = container.children[0];

        eq(findAll(root, "cnb-kse-disabled-note").length, 1, "disabled note shown");
        assert(subtreeText(root).includes("Keys are off"), "note explains the state");

        const master = findAll(root, "cnb-kse-keys-enable-check")[0];
        assert(master && !master.disabled, "master toggle is NOT disabled");

        for (const token of ["cnb-kse-def-name", "cnb-kse-pc-pill", "cnb-kse-def-tonic",
                             "cnb-kse-def-remove", "cnb-kse-def-add",
                             "cnb-kse-sig-enable-check", "cnb-kse-radio-input",
                             "cnb-kse-sep-color"]) {
          const controls = findAll(root, token);
          assert(controls.length > 0, `${token} rendered while gated (shown, not hidden)`);
          assert(controls.every(c => c.disabled === true), `${token} disabled while keys are off`);
        }
      });
  } },

  { name: "render: enabling keys through the master toggle removes the note and enables controls", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, {
          config: CNBConfig.createDefault(),
          onChange: (slices) => { last = slices; },
        });
        const master = findAll(api.root, "cnb-kse-keys-enable-check")[0];
        master.checked = true;
        master.onchange();
        eq(last.keys.enabled, true, "onChange carries keys.enabled");
        eq(findAll(api.root, "cnb-kse-disabled-note").length, 0, "note removed");
        const add = findAll(api.root, "cnb-kse-def-add")[0];
        eq(add.disabled, false, "controls enabled");
      });
  } },

  // ─── render(): key definition controls ────────────────────────────────

  { name: "render: empty definitions → explicit empty note; add button appends the visible C-major template", fn: () => {
      withDomStub((container) => {
        const config = CNBConfig.createDefault();
        config.keys.enabled = true;
        let last = null;
        const api = E.render(container, { config, onChange: (slices) => { last = slices; } });
        eq(findAll(api.root, "cnb-kse-empty").length, 1, "empty state shown");

        findAll(api.root, "cnb-kse-def-add")[0].onclick();
        eq(last.keys.definitions.length, 1, "definition added");
        eq(last.keys.definitions[0].name, "C", "template name");
        deepEq(last.keys.definitions[0].pitchClasses, [0, 2, 4, 5, 7, 9, 11], "template is C major");
        eq(findAll(api.root, "cnb-kse-empty").length, 0, "empty note gone");
        eq(findAll(api.root, "cnb-kse-def-row").length, 1, "row rendered");
      });
  } },

  { name: "render: signature status note — the key and mode picked on the staff, defined or not (session 36); absent when off", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.definitions = [];
        const api = E.render(container, { config });
        let status = findAll(api.root, "cnb-kse-sig-status");
        eq(status.length, 1, "status shown");
        eq(status[0].textContent, "The signature draws for the key picked here, which is the staff's key too.", "with no key defined");

        findAll(api.root, "cnb-kse-def-add")[0].onclick();
        status = findAll(api.root, "cnb-kse-sig-status");
        eq(status.length, 1, "status still shown");
        eq(status[0].textContent, "The signature draws for the key picked here, which is the staff's key too.", "with a key defined");

        api.setState({ keySignature: { ...api.getState().keySignature, enabled: false } });
        eq(findAll(api.root, "cnb-kse-sig-status").length, 0, "no status while the signature is off");
        api.setState({ keySignature: { ...api.getState().keySignature, enabled: true }, enabled: false });
        eq(findAll(api.root, "cnb-kse-sig-status").length, 0, "no status while keys are off");
      });
  } },

  { name: "render: definition name input, pitch-class pills, and remove button edit the definition", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });

        const name = findAll(api.root, "cnb-kse-def-name")[0];
        name.value = "C lydian";
        name.oninput();
        eq(last.keys.definitions[0].name, "C lydian", "name edited");

        // Pill 6 (F♯) is off in C major → toggling adds it, sorted into place.
        const pills = findAll(api.root, "cnb-kse-pc-pill");
        eq(pills.length, 12, "twelve pills per definition");
        pills[6].onclick();
        deepEq(last.keys.definitions[0].pitchClasses, [0, 2, 4, 5, 6, 7, 9, 11], "F♯ added sorted");
        // Re-query after redraw: pill 6 is now on → toggling removes it.
        findAll(api.root, "cnb-kse-pc-pill")[6].onclick();
        deepEq(last.keys.definitions[0].pitchClasses, [0, 2, 4, 5, 7, 9, 11], "F♯ removed");

        findAll(api.root, "cnb-kse-def-remove")[0].onclick();
        deepEq(last.keys.definitions, [], "definition removed");
      });
  } },

  { name: "render: tonic select writes/clears tonicPc; the hint names the D3 resolution source", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });

        assert(subtreeText(findAll(api.root, "cnb-kse-def-tonic-hint")[0]).includes("tonic C (from name)"),
          "auto hint shows name-parsed tonic");

        const tonic = findAll(api.root, "cnb-kse-def-tonic")[0];
        tonic.value = "7";
        tonic.onchange();
        eq(last.keys.definitions[0].tonicPc, 7, "explicit tonic written");
        assert(subtreeText(findAll(api.root, "cnb-kse-def-tonic-hint")[0]).includes("tonic G (explicit)"),
          "hint shows explicit tonic");

        const tonic2 = findAll(api.root, "cnb-kse-def-tonic")[0];
        tonic2.value = "";
        tonic2.onchange();
        assert(!("tonicPc" in last.keys.definitions[0]), "auto clears tonicPc");
      });
  } },

  { name: "render: duplicate definition names surface as an editor warning in the validation panel", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.definitions = [
          JSON.parse(JSON.stringify(C_MAJOR)),
          JSON.parse(JSON.stringify(C_MAJOR)),
        ];
        const api = E.render(container, { config });
        const editorWarnings = findAll(api.root, "cnb-kse-editor-warning");
        eq(editorWarnings.length, 1, "duplicate warning shown");
        assert(subtreeText(editorWarnings[0]).includes("Editor check"), "labeled as an editor check");
      });
  } },

  // ─── render(): signature controls ─────────────────────────────────────

  { name: "render: signature enable toggle writes keySignature.enabled", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.enabled = false;
        let last = null;
        const api = E.render(container, { config, onChange: (slices) => { last = slices; } });
        const cb = findAll(api.root, "cnb-kse-sig-enable-check")[0];
        cb.checked = true;
        cb.onchange();
        eq(last.keys.keySignature.enabled, true, "signature enabled");
      });
  } },

  { name: "render: separator color applies once (session 36) — a drag (`input`) writes nothing; `change` emits once and redraws", fn: () => {
      withDomStub((container) => {
        let last = null;
        let emits = 0;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; emits++; } });
        const before = findAll(api.root, "cnb-kse-sep-color")[0];
        assert(typeof before.oninput !== "function", "a drag step has no handler: only the field's swatch changes");
        eq(emits, 0, "nothing written before change");
        before.onchange({ target: { value: "#445566" } });
        eq(emits, 1, "change emits once");
        eq(last.keys.keySignature.separator.color, "#445566", "change writes the color");
        assert(findAll(api.root, "cnb-kse-sep-color")[0] !== before, "change redraws");
      });
  } },

  { name: "render: nothing is preview-only — no spacing control and no badge (session 34: the spacing is the engine's)", fn: () => {
      withDomStub((container) => {
        const api = E.render(container, { config: keysConfig() });
        eq(findAll(api.root, "cnb-kse-gutter").length, 0, "no spacing control");
        eq(findAll(api.root, "cnb-badge").length, 0, "no badge");
        assert(!("PREVIEW_ONLY" in E), "no preview-only tooltips");
        eq(findAll(api.root, "cnb-kse-octave-note").length, 0, "no preview-only paragraph");
        const text = api.root.children
          .filter(c => !String(c.className).includes("cnb-kse-validation"))
          .map(subtreeText).join(" ");
        for (const dev of ["keysig.ly", "Preview-only", "Gutter", "midpoint", "pitch class", "definition", "Enable", "scale-from-tonic"]) {
          assert(!text.includes(dev), `no developer wording "${dev}"`);
        }
      });
  } },

  { name: "render: an unrecognized loaded placement rule is kept and reported by validation; a carried style is not", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.style = "tonic-label";
        config.keys.keySignature.placement.rule = "tonic-only";
        const api = E.render(container, { config });
        assert(!("style" in api.getKeys().keySignature), "style retired (session 54): not carried");
        eq(api.getKeys().keySignature.placement.rule, "tonic-only", "rule kept");
        const errors = findAll(api.root, "cnb-kse-error").map(subtreeText);
        assert(!errors.some(e => e.includes("style")), "no style error");
        assert(errors.some(e => e.includes("placement.rule")), "rule error surfaced");
      });
  } },

  // ─── render(): the panel of design §7 (session 50) ────────────────────

  { name: "render: the old Marks, rule, tonic-octave and extent controls are gone, and their stored values are kept", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.placement.tonicOctave = 2;
        config.keys.keySignature.separator.extentSemis = 6;
        let last = null;
        const api = E.render(container, { config, onChange: (slices) => { last = slices; } });
        for (const token of ["cnb-kse-style-option", "cnb-kse-placement-rule", "cnb-kse-octave-auto-check",
                             "cnb-kse-octave-input", "cnb-kse-sep-extent"]) {
          eq(findAll(api.root, token).length, 0, `${token} gone`);
        }
        const upper = findAll(api.root, "cnb-kse-upper-tonic-check")[0];
        upper.checked = false;
        upper.onchange();
        eq(last.keys.keySignature.placement.tonicOctave, 2, "tonic octave kept");
        eq(last.keys.keySignature.separator.extentSemis, 6, "extent kept");
        assert(!("style" in last.keys.keySignature), "no style written");
      });
  } },

  { name: "render: the signature comes first, the key definitions below it under Keys for notehead rules", fn: () => {
      withDomStub((container) => {
        const api = E.render(container, { config: keysConfig() });
        const sections = api.root.children.map(c => String(c.className));
        const sig = sections.findIndex(c => c.includes("cnb-kse-signature"));
        const defs = sections.findIndex(c => c.includes("cnb-kse-definitions"));
        assert(sig >= 0 && defs > sig, "definitions follow the signature");
        eq(subtreeText(findAll(api.root.children[defs], "cnb-kse-title")[0]), "Keys for notehead rules", "title");
        eq(subtreeText(findAll(api.root, "cnb-kse-sig-enable")[0]), "Show the key signature", "show label");
      });
  } },

  { name: "render: Notes — the whole scale, the tonic and the half steps, or the sharps or flats only; the tonic an octave up, not under the cycle of fifths", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const options = () => findAll(findAll(api.root, "cnb-kse-notes-choice")[0], "cnb-kse-radio");
        deepEq(options().map(o => o.getAttribute("data-value")), ["all", "tonic-and-half-steps", "altered"], "three choices");
        assert(options()[0].className.includes("on"), "the whole scale by default");
        deepEq(options().map(o => subtreeText(o)), ["The whole scale", "The tonic and the half steps", "The sharps or flats only"], "in words");
        for (const value of ["tonic-and-half-steps", "altered", "all"]) {
          options().find(o => o.getAttribute("data-value") === value).children[0].onchange();
          eq(last.keys.keySignature.notes, value, `${value} written`);
        }

        const upper = findAll(api.root, "cnb-kse-upper-tonic-check")[0];
        eq(upper.checked, true, "upper tonic on by default");
        upper.checked = false;
        upper.onchange();
        eq(last.keys.keySignature.upperTonic, false, "upper tonic written");

        findAll(findAll(api.root, "cnb-kse-stacking")[0], "cnb-kse-radio")
          .find(o => o.getAttribute("data-value") === "fifths").children[0].onchange();
        eq(findAll(api.root, "cnb-kse-upper-tonic").length, 0, "hidden under the cycle of fifths");
        eq(last.keys.keySignature.upperTonic, false, "its value kept");
      });
  } },

  { name: "render: Stacks — the four rules and the cycle of fifths write stacking; the direction is hidden under odd-left-even-right", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const values = () => findAll(findAll(api.root, "cnb-kse-stacking")[0], "cnb-kse-radio");
        deepEq(values().map(o => o.getAttribute("data-value")),
          ["degrees", "parity", "parity-stacks", "parity-zigzag", "fifths"], "five rules");
        eq(subtreeText(values()[0]), "Stacked sevenths: 1 3 5 7 left, 2 4 6 8 right", "the default in words");
        eq(subtreeText(values()[4]), "Cycle of fifths, one to a column", "the cycle of fifths in words");
        for (const value of ["parity-stacks", "parity-zigzag", "parity", "degrees"]) {
          values().find(o => o.getAttribute("data-value") === value).children[0].onchange();
          eq(last.keys.keySignature.stacking, value, `${value} written`);
          eq(findAll(api.root, "cnb-kse-columns").length, value === "parity" ? 0 : 1,
            `direction ${value === "parity" ? "hidden" : "shown"} under ${value}`);
        }
        const direction = findAll(findAll(api.root, "cnb-kse-columns")[0], "cnb-kse-radio");
        deepEq(direction.map(o => o.getAttribute("data-value")), ["right", "left-in-sharp-keys"], "two directions");
        direction[1].children[0].onchange();
        eq(last.keys.keySignature.columns, "left-in-sharp-keys", "direction written");
      });
  } },

  { name: "render: the cycle of fifths — its heights, in a window raised for sharps and flats or climbing; no direction or gold stem", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        eq(findAll(api.root, "cnb-kse-heights").length, 0, "no heights under stacked sevenths");
        findAll(findAll(api.root, "cnb-kse-stacking")[0], "cnb-kse-radio")
          .find(o => o.getAttribute("data-value") === "fifths").children[0].onchange();
        eq(last.keys.keySignature.stacking, "fifths", "written");
        for (const token of ["cnb-kse-columns", "cnb-kse-separator"]) eq(findAll(api.root, token).length, 0, `${token} hidden`);
        const heights = () => findAll(findAll(api.root, "cnb-kse-heights-choice")[0], "cnb-kse-radio");
        deepEq(heights().map(o => o.getAttribute("data-value")), ["window", "scale"], "two heights");
        assert(heights()[0].className.includes("on"), "in a window by default");

        const sharp = findAll(api.root, "cnb-kse-window-sharp")[0];
        eq(sharp.value, "0", "raised by 0");
        sharp.value = "3";
        sharp.onchange();
        deepEq(last.keys.keySignature.window, { sharp: 3, flat: 0 }, "the sharps' window raised");
        const flat = findAll(api.root, "cnb-kse-window-flat")[0];
        flat.value = "-2";
        flat.onchange();
        deepEq(last.keys.keySignature.window, { sharp: 3, flat: -2 }, "the flats' lowered");
        flat.value = "abc";
        flat.onchange();
        deepEq(last.keys.keySignature.window, { sharp: 3, flat: -2 }, "not a number: not written");

        heights()[1].children[0].onchange();
        eq(last.keys.keySignature.heights, "scale", "climbing written");
        eq(findAll(api.root, "cnb-kse-window").length, 0, "no window while climbing");
        deepEq(last.keys.keySignature.window, { sharp: 3, flat: -2 }, "its values kept");
      });
  } },

  { name: "render: Place — the middle of the staff, or the bottom, top or every line set", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const options = () => findAll(findAll(api.root, "cnb-kse-position")[0], "cnb-kse-radio");
        deepEq(options().map(o => o.getAttribute("data-value")), ["middle", "bottom-set", "top-set", "every-set"], "four places");
        assert(options()[0].className.includes("on"), "the middle by default");
        for (const value of ["bottom-set", "top-set", "every-set", "middle"]) {
          options().find(o => o.getAttribute("data-value") === value).children[0].onchange();
          eq(last.keys.keySignature.placement.position, value, `${value} written`);
        }
      });
  } },

  { name: "startFrom: the noteheads are the defaults and the traditional signature its settings over them, Show the key signature kept", fn: () => {
      const ks = { ...fancyKeys().keySignature, enabled: true };
      deepEq(E.startFrom(ks, "noteheads"), { ...CNBConfig.createDefault().keys.keySignature, enabled: true }, "the defaults");
      const traditional = E.startFrom(ks, "traditional");
      deepEq([traditional.enabled, traditional.notes, traditional.stacking, traditional.heights, traditional.placement.position],
        [true, "altered", "fifths", "window", "middle"], "the traditional starting point");
      deepEq(traditional.looks, { all: {}, natural: {}, flat: { sign: "flat", color: null }, sharp: { sign: "sharp", color: null }, line: {}, space: {} },
        "Emmentaler's signs with no colour, the other looks cleared");
      deepEq(traditional.alternate, {}, "every second stack cleared");
      eq(E.startFrom({ ...ks, enabled: false }, "traditional").enabled, false, "off stays off");
      eq(ks.notes, "tonic-and-half-steps", "the input unchanged");
  } },

  { name: "render: Start from — asks first, then replaces the signature's settings, keeping Show the key signature (design §13.8)", fn: () => {
      withDomStub((container) => {
        let last = null;
        let answer = false;
        const asked = [];
        const config = keysConfig();
        config.keys.keySignature.notes = "tonic-and-half-steps";
        config.keys.keySignature.placement.position = "top-set";
        const api = E.render(container, { config, confirm: (q) => { asked.push(q); return answer; },
          onChange: (slices) => { last = slices; } });
        const start = (which) => findAll(api.root, "cnb-kse-start-button").find(b => b.getAttribute("data-start") === which);
        deepEq(findAll(api.root, "cnb-kse-start-button").map(b => subtreeText(b)),
          ["The noteheads", "Traditional sharps and flats"], "two starting points, in words");

        start("traditional").onclick();
        eq(asked.length, 1, "it asks");
        assert(asked[0].includes("replaces"), "saying the settings are replaced");
        eq(last, null, "cancelled: nothing written");

        answer = true;
        start("traditional").onclick();
        const ks = last.keys.keySignature;
        deepEq([ks.enabled, ks.notes, ks.stacking, ks.placement.position], [true, "altered", "fifths", "middle"], "the traditional signature");
        assert(!("style" in ks), "no style written");
        assert(CNBConfig.validate({ ...CNBConfig.clone(config), keys: last.keys }).valid, "the starting point validates");
        for (const token of ["cnb-kse-notes", "cnb-kse-stacks", "cnb-kse-look-card", "cnb-kse-place"]) {
          assert(findAll(api.root, token).length > 0, `${token} still shown`);
        }

        start("noteheads").onclick();
        deepEq(last.keys.keySignature, { ...CNBConfig.createDefault().keys.keySignature, enabled: true },
          "the noteheads: the defaults, Show the key signature kept");
      });
  } },

  { name: "render: the rows the editor replaced are gone — Draw, Looks, Size and the overlap note (session 56)", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.stacking = "parity-stacks";   // marks that touch in C major
        const api = E.render(container, { config, key: { tonic: 0, mode: "major" } });
        for (const token of ["cnb-kse-draw", "cnb-kse-style", "cnb-kse-looks-row", "cnb-kse-look", "cnb-kse-size",
          "cnb-kse-size-choice", "cnb-kse-overlap-note"]) {
          eq(findAll(api.root, token).length, 0, `${token} gone`);
        }
      });
  } },

  { name: "render: Place's hint names the tonic and the half steps only under the key's notes (session 52)", fn: () => {
      for (const [notes, mentions] of [["all", true], ["altered", false]]) {
        withDomStub((container) => {
          const config = keysConfig();
          config.keys.keySignature.notes = notes;
          const api = E.render(container, { config });
          const hint = subtreeText(findAll(findAll(api.root, "cnb-kse-place")[0], "cnb-kse-hint")[0]);
          assert(hint.includes("On every line set the signature repeats"), `${notes}: the line sets`);
          eq(hint.includes("half steps"), mentions, `${notes}: the tonic and the half steps`);
        });
      }
  } },

  { name: "render: the gold stem's show, colour and thickness, the thickness in staff spaces at 4 and 3 semitones per staff space", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const thickness = findAll(api.root, "cnb-kse-sep-thickness")[0];
        eq(thickness.value, "0.4", "160% of a semitone at 4 semitones per staff space is 0.4 staff spaces");
        thickness.value = "0.5";
        thickness.onchange();
        eq(last.keys.keySignature.separator.thicknessPct, 200, "0.5 staff spaces written as 200%");

        const color = findAll(api.root, "cnb-kse-sep-color")[0];
        color.value = "#112233";
        color.onchange();
        eq(last.keys.keySignature.separator.color, "#112233", "colour written");

        const cb = findAll(api.root, "cnb-kse-sep-enable-check")[0];
        eq(subtreeText(findAll(api.root, "cnb-kse-sep-enable")[0]), "Gold stem between the stacks", "in words");
        cb.checked = false;
        cb.onchange();
        eq(last.keys.keySignature.separator.enabled, false, "stem off");
      });
      withDomStub((container) => {
        const config = keysConfig();
        config.staff.semitonesPerStaffSpace = 3;
        let last = null;
        const api = E.render(container, { config, onChange: (slices) => { last = slices; } });
        const thickness = findAll(api.root, "cnb-kse-sep-thickness")[0];
        eq(thickness.value, "0.5333", "160% at 3 semitones per staff space");
        thickness.value = "0.5";
        thickness.onchange();
        eq(last.keys.keySignature.separator.thicknessPct, 150, "0.5 staff spaces at sps 3 is 150%");
      });
  } },

  { name: "thicknessInStaffSpaces / thicknessPct / semisPerStaffSpace convert the stored percentage", fn: () => {
      eq(E.thicknessInStaffSpaces(160, 4), 0.4, "160% at 4");
      eq(E.thicknessPct(0.4, 4), 160, "and back");
      eq(E.thicknessInStaffSpaces(100, 3), 0.3333, "shown to 4 places");
      eq(E.thicknessPct(0.5, 3), 150, "0.5 staff spaces at 3");
      eq(E.semisPerStaffSpace(CNBConfig.createDefault()), 4, "the default staff");
      const axis = CNBConfig.createDefault();
      axis.pitchAxis = { enabled: true, kind: "pitch-class-map-v1", octaveStride: 7, axisUnitsPerStaffSpace: 2,
        pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })) };
      eq(E.semisPerStaffSpace(axis), 2, "the pitch axis's units under an axis");
  } },

  { name: "shareText: what each stem gets, in this key", fn: () => {
      eq(E.shareText(1, true), "(1 stem in this key: all of it)", "one stem");
      eq(E.shareText(2, true), "(2 stems in this key: half each)", "two, shared");
      eq(E.shareText(3, true), "(3 stems in this key: a third each)", "three, shared");
      eq(E.shareText(5, true), "(5 stems in this key: 1/5 each)", "five, shared");
      eq(E.shareText(2, false), "(2 stems in this key: all of it each)", "two, not shared");
      eq(E.shareText(0, true), "(one stack in this key: no stem)", "one stack");
      eq(E.shareText(null, true), "(each of n stems: 1/n of it)", "no key picked");
  } },

  { name: "render: Several stems share the thickness — counted for the picked key, written, and hidden with the stem off", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.stacking = "parity-stacks";   // C major: C D E | F G A B | C′
        let last = null;
        const api = E.render(container, { config, key: { tonic: 0, mode: "major" }, onChange: (slices) => { last = slices; } });
        eq(subtreeText(findAll(api.root, "cnb-kse-share-text")[0]).trim(), "(2 stems in this key: half each)", "two stems in C major");
        const share = findAll(api.root, "cnb-kse-sep-share-check")[0];
        share.checked = false;
        share.onchange();
        eq(last.keys.keySignature.separator.shareThickness, false, "sharing written");
        eq(subtreeText(findAll(api.root, "cnb-kse-share-text")[0]).trim(), "(2 stems in this key: all of it each)", "not shared");

        const stem = findAll(api.root, "cnb-kse-sep-enable-check")[0];
        stem.checked = false;
        stem.onchange();
        eq(findAll(api.root, "cnb-kse-sep-share").length, 0, "hidden with the stem off");
      });
      withDomStub((container) => {
        const api = E.render(container, { config: keysConfig(), key: { tonic: 0, mode: "major" } });
        eq(subtreeText(findAll(api.root, "cnb-kse-share-text")[0]).trim(), "(1 stem in this key: all of it)", "stacked sevenths: one stem");
      });
  } },


  { name: "lookSummary: 'as …' beneath for an empty look, else what it sets, in words", fn: () => {
      eq(E.lookSummary({}, "all"), "as the noteheads", "all marks");
      eq(E.lookSummary({}, "flat"), "as all marks", "flats");
      eq(E.lookSummary({}, "sharp"), "as all marks", "sharps");
      eq(E.lookSummary({}, "alternate"), "as the others", "every second stack");
      eq(E.lookSummary({ shape: "kite-up", hollow: true }, "all"), CNBBuiltinShapes.get("kite-up").displayName + ", hollow",
        "a built-in shape by its name, and the fill");
      const shapes = CNBConfig.createDefault().shapes;
      eq(E.lookSummary({ shape: "crotchet-minim", hollow: false, color: null, heightSemis: 1.5, widthSemis: 1.9 }, "sharp", shapes),
        "Crotchet–Minim, solid, no colour, 1.5 × 1.9 semitones", "every field");
      assert(E.lookSummary({ color: "#0072b2" }, "flat").length > 0 && !E.lookSummary({ color: "#0072b2" }, "flat").startsWith("as"),
        "a colour by its name");
      eq(E.lookSummary({ heightSemis: 2 }, "all"), "2 semitones tall", "a height alone");
      // Added symbols by their shapes' names (session 55), and none set to none.
      const tails = { tail: { displayName: "Tail, down" } };
      eq(E.lookSummary({ added: [{ shape: "tail" }] }, "sharp", tails), "with Tail, down", "an added symbol");
      eq(E.lookSummary({ hollow: true, added: [{ shape: "tail" }, { shape: "kite-up" }] }, "flat", tails),
        `hollow, with Tail, down and ${CNBBuiltinShapes.get("kite-up").displayName}`, "two added symbols");
      eq(E.lookSummary({ added: [] }, "sharp"), "no added symbols", "the added symbols beneath removed");
      eq(E.lookSummary({ offset: { x: 0.5, y: -1 } }, "flat"), "moved 0.5, -1 semitones", "an offset (session 56)");
  } },

  { name: "lookWith / addedWith: a field of a layer's base or added symbol set and cleared, shape and sign one slot, the input unchanged", fn: () => {
      const ks = CNBConfig.createDefault().keys.keySignature;
      const a = E.lookWith(ks, "flat", "base", "shape", "kite-up");
      deepEq(a.looks.flat, { shape: "kite-up" }, "a shape");
      deepEq(ks.looks.flat, {}, "the input unchanged");
      deepEq(E.lookWith(a, "flat", "base", "sign", "flat").looks.flat, { sign: "flat" }, "a sign replaces the shape");
      deepEq(E.lookWith(E.lookWith(a, "flat", "base", "sign", "flat"), "flat", "base", "shape", "dot").looks.flat,
        { shape: "dot" }, "and a shape the sign");
      deepEq(E.lookWith(E.lookWith(a, "flat", "base", "hollow", true), "flat", "base", "shape", undefined).looks.flat,
        { hollow: true }, "clearing the shape clears the slot, the rest kept");
      deepEq(E.lookWith(ks, "alternate", "base", "color", null).alternate, { color: null }, "every second stack's look");
      deepEq(E.lookWith({ ...ks, looks: undefined }, "line", "base", "hollow", false).looks, { line: { hollow: false } },
        "a missing look is made");

      const tailed = E.addedWith(ks, "sharp", [{ shape: "tail" }]);
      deepEq(tailed.looks.sharp, { added: [{ shape: "tail" }] }, "added symbols written whole");
      deepEq(E.lookWith(tailed, "sharp", 0, "offset", { x: 0.5, y: 0 }).looks.sharp.added, [{ shape: "tail", offset: { x: 0.5, y: 0 } }],
        "an added symbol's field");
      deepEq(E.lookWith(tailed, "sharp", 0, "shape", "dot").looks.sharp.added, [{ shape: "dot" }], "an added symbol's shape");
      deepEq(E.addedWith(tailed, "sharp", []).looks.sharp, { added: [] }, "[] removes those beneath");
      deepEq(E.addedWith(tailed, "sharp", undefined).looks.sharp, {}, "undefined clears it: as beneath");
  } },

  { name: "render: Edit — seven layers; the card names the picked one and says it edits the category in every key", fn: () => {
      withDomStub((container) => {
        const view = {};
        const api = E.render(container, { config: keysConfig(), view });
        const layers = () => findAll(api.root, "cnb-kse-layer");
        deepEq(layers().map(b => b.getAttribute("data-layer")), ["all", "natural", "flat", "sharp", "line", "space", "alternate"],
          "seven layers");
        deepEq(layers().map(b => subtreeText(b)),
          ["All marks", "Naturals", "Flats", "Sharps", "On a line or ledger", "In a space", "Every second stack"], "in words");
        const card = () => findAll(api.root, "cnb-kse-look-card")[0];
        eq(card().getAttribute("data-look"), "all", "all marks at first");
        eq(subtreeText(findAll(card(), "cnb-kse-look-scope")[0]), "Edits all marks in every key", "its scope");

        layers().find(b => b.getAttribute("data-layer") === "flat").onclick();
        eq(card().getAttribute("data-look"), "flat", "flats picked");
        assert(layers().find(b => b.getAttribute("data-layer") === "flat").className.includes("on"), "shown on");
        eq(subtreeText(findAll(card(), "cnb-kse-look-scope")[0]), "Edits all flats in every key", "every flat in every key");
        deepEq([view.layer, view.pinned], ["flat", false], "a spelling's layer follows clicks on marks");
        layers().find(b => b.getAttribute("data-layer") === "space").onclick();
        deepEq([view.layer, view.pinned], ["space", true], "any other stays picked");
        eq(subtreeText(findAll(card(), "cnb-kse-look-scope")[0]), "Edits all marks in a space in every key", "its scope");
      });
      // The host keeps the view across a re-mount.
      withDomStub((container) => {
        const view = { layer: "sharp", symbol: "base", pinned: false };
        const api = E.render(container, { config: keysConfig(), view });
        eq(findAll(api.root, "cnb-kse-look-card")[0].getAttribute("data-look"), "sharp", "re-mounted on sharps");
      });
  } },

  { name: "render: the look card's symbol — as beneath, the notation's and built-in shapes, and Emmentaler's sharp and flat, one slot", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), view: { layer: "sharp" }, onChange: (slices) => { last = slices; } });
        const card = () => findAll(api.root, "cnb-kse-look-card")[0];
        const shape = (name) => findAll(card(), "cnb-kse-look-shape").find(b => b.getAttribute("data-shape") === name);
        const sign = (name) => findAll(card(), "cnb-kse-look-sign").find(b => b.getAttribute("data-sign") === name);
        deepEq(findAll(card(), "cnb-kse-look-sign").map(b => b.getAttribute("data-sign")), ["sharp", "flat"], "two signs");
        eq(sign("flat").children[0].tag, "svg", "each with its thumbnail");

        shape("crotchet-minim").onclick();
        eq(last.keys.keySignature.looks.sharp.shape, "crotchet-minim", "shape set");
        assert(!("shapes" in last), "a shape the notation has adds none");
        assert(shape("crotchet-minim").className.includes("on"), "and shown on");
        sign("sharp").onclick();
        deepEq(last.keys.keySignature.looks.sharp, { sign: "sharp" }, "the sign replaces the shape");
        assert(sign("sharp").className.includes("on"), "shown on");
        eq(findAll(card(), "cnb-kse-look-fill").length, 0, "a sign has no fill");
        assert(CNBConfig.validate({ ...keysConfig(), keys: last.keys }).valid, "valid");
        shape("").onclick();
        deepEq(last.keys.keySignature.looks.sharp, {}, "'as all marks' clears the slot");
      });
  } },

  { name: "render: a look's fill and colour are set and cleared through its 'as …' choice", fn: () => {
      withDomStub((container) => {
        let last = null;
        const view = { layer: "flat" };
        const api = E.render(container, { config: keysConfig(), view, onChange: (slices) => { last = slices; } });
        const card = () => findAll(api.root, "cnb-kse-look-card")[0];
        const pick = (token, attr, value) => findAll(card(), token).find(b => b.getAttribute(attr) === value);

        pick("cnb-kse-look-fill", "data-fill", "hollow").onclick();
        eq(last.keys.keySignature.looks.flat.hollow, true, "hollow");
        pick("cnb-kse-look-fill", "data-fill", "solid").onclick();
        eq(last.keys.keySignature.looks.flat.hollow, false, "solid");
        pick("cnb-kse-look-fill", "data-fill", "").onclick();
        assert(!("hollow" in last.keys.keySignature.looks.flat), "cleared");

        findAll(api.root, "cnb-kse-layer").find(b => b.getAttribute("data-layer") === "alternate").onclick();
        pick("cnb-kse-look-colour", "data-color", "none").onclick();
        eq(last.keys.keySignature.alternate.color, null, "none: no colour");
        findAll(card(), "cnb-kse-look-colour-input")[0].onchange({ target: { value: "#CC79A7" } });
        eq(last.keys.keySignature.alternate.color, "#cc79a7", "a colour, when the picker closes");
        pick("cnb-kse-look-colour", "data-color", "").onclick();
        assert(!("color" in last.keys.keySignature.alternate), "'as the others' clears it");
        eq(findAll(card(), "cnb-kse-look-height").length, 0, "every second stack has no size");
      });
  } },

  { name: "render: a look's size — height and width in semitones, the aspect ratio kept, cleared together", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const card = () => findAll(api.root, "cnb-kse-look-card")[0];
        const shape = CNBConfig.createDefault().shapes["crotchet-minim"];
        const ratio = shape.naturalWidth / shape.naturalHeight;
        const height = findAll(card(), "cnb-kse-look-height")[0];
        height.value = "1.5";
        height.onchange();
        eq(last.keys.keySignature.looks.all.heightSemis, 1.5, "height");
        eq(last.keys.keySignature.looks.all.widthSemis, Math.round(1.5 * ratio * 1e4) / 1e4, "width at the notehead's ratio");

        const lock = findAll(card(), "cnb-kse-look-lock-check")[0];
        lock.checked = false;
        lock.onchange();
        const width = findAll(card(), "cnb-kse-look-width")[0];
        width.value = "1";
        width.onchange();
        eq(last.keys.keySignature.looks.all.widthSemis, 1, "width alone with the ratio unlocked");
        eq(last.keys.keySignature.looks.all.heightSemis, 1.5, "height kept");

        findAll(card(), "cnb-kse-look-size-as")[0].onclick();
        assert(!("heightSemis" in last.keys.keySignature.looks.all) && !("widthSemis" in last.keys.keySignature.looks.all),
          "'as the noteheads' clears both");
      });
  } },

  { name: "render: a look's new shape keeps its height, the width following the shape's proportions while the ratio is kept", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const card = () => findAll(api.root, "cnb-kse-look-card")[0];
        const shapeButton = (name) => findAll(card(), "cnb-kse-look-shape").find(b => b.getAttribute("data-shape") === name);
        const height = findAll(card(), "cnb-kse-look-height")[0];
        height.value = "1.5";
        height.onchange();
        shapeButton("kite-up").onclick();
        const kite = CNBBuiltinShapes.get("kite-up");
        eq(last.keys.keySignature.looks.all.heightSemis, 1.5, "height kept");
        eq(last.keys.keySignature.looks.all.widthSemis, Math.round(1.5 * kite.naturalWidth / kite.naturalHeight * 1e4) / 1e4,
          "width at the kite's proportions");

        const lock = findAll(card(), "cnb-kse-look-lock-check")[0];
        lock.checked = false;
        lock.onchange();
        const width = findAll(card(), "cnb-kse-look-width")[0];
        width.value = "1";
        width.onchange();
        shapeButton("crotchet-minim").onclick();
        eq(last.keys.keySignature.looks.all.heightSemis, 1.5, "with the ratio not kept, the height stays");
        eq(last.keys.keySignature.looks.all.widthSemis, 1, "and so does the width");
      });
  } },

  { name: "render: an imported shape given to a look keeps its height, the width following the imported shape's proportions", fn: () => {
      withDomStub((container) => {
        let last = null;
        const gives = [];
        const api = E.render(container, {
          config: keysConfig(),
          onChange: (slices) => { last = slices; },
          importControl: (slot, give) => { gives.push(give); },
        });
        const height = findAll(api.root, "cnb-kse-look-height")[0];   // all marks
        height.value = "1.5";
        height.onchange();
        const dot = { displayName: "Dot", svgPath: "M 80 0 L 0 80 L -80 0 L 0 -80 Z", naturalHeight: 160, naturalWidth: 240,
          semitoneHeight: 1.6, anchors: null };
        gives[gives.length - 1]("dot", dot);
        eq(last.keys.keySignature.looks.all.shape, "dot", "the imported shape given to the look");
        eq(last.keys.keySignature.looks.all.heightSemis, 1.5, "height kept");
        eq(last.keys.keySignature.looks.all.widthSemis, 2.25, "width at the imported shape's proportions (1.5 × 240 / 160)");
      });
  } },

  { name: "render: a built-in shape the notation lacks is added to it, and reported with the keys", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const card = findAll(api.root, "cnb-kse-look-card")[0];
        const kite = findAll(card, "cnb-kse-look-shape").find(b => b.getAttribute("data-shape") === "kite-up");
        assert(kite, "the built-in shapes are offered");
        kite.onclick();
        eq(last.keys.keySignature.looks.all.shape, "kite-up", "given to the look");
        assert(last.shapes && last.shapes["kite-up"] && last.shapes["crotchet-minim"], "added to the notation's shapes");
        eq(findAll(api.root, "cnb-kse-valid").length, 1, "and the config validates with it");
      });
  } },

  { name: "render: the look card's Import from SVG is the host's, and gives the imported shape to the picked layer", fn: () => {
      withDomStub((container) => {
        let last = null;
        const gives = [];
        const api = E.render(container, {
          config: keysConfig(),
          view: { layer: "sharp" },
          onChange: (slices) => { last = slices; },
          importControl: (slot, give) => { slot.setAttribute("data-import", "yes"); gives.push(give); },
        });
        eq(findAll(api.root, "cnb-kse-look-import").length, 1, "one, in the look card");
        gives[gives.length - 1]("dot");
        eq(last.keys.keySignature.looks.sharp.shape, "dot", "the imported shape given to Sharps");
      });
  } },

  { name: "render: a sign's size is the signs' — automatic with the rule's size, or a number in semitones (session 52)", fn: () => {
      withDomStub((container) => {
        let last = null;
        const config = keysConfig();
        config.keys.keySignature.looks.flat = { sign: "flat" };
        const api = E.render(container, { config, view: { layer: "flat" }, onChange: (slices) => { last = slices; } });
        const card = () => findAll(api.root, "cnb-kse-look-card")[0];
        const auto = () => findAll(card(), "cnb-kse-sign-size-auto")[0];
        const field = () => findAll(card(), "cnb-kse-sign-size")[0];
        eq(findAll(card(), "cnb-kse-look-height").length, 0, "no height and width for a sign");
        eq(subtreeText(auto()), "Automatic (2.72)", "the default staff's automatic size");
        assert(auto().className.includes("on"), "automatic by default");
        eq(field().value, "2.72", "the field shows the automatic size");

        field().value = "5";
        field().onchange();
        eq(last.keys.keySignature.signs.heightSemis, 5, "a typed size written to the signs' size");
        assert(!auto().className.includes("on"), "no longer automatic");
        for (const bad of ["0", "-2", "abc", ""]) {
          field().value = bad;
          field().onchange();
          eq(last.keys.keySignature.signs.heightSemis, 5, `${JSON.stringify(bad)} not written`);
        }
        auto().onclick();
        eq(last.keys.keySignature.signs.heightSemis, null, "back to automatic: null");
      });
      // Kite 4-369's noteheads are held to 3 semitones.
      withDomStub((container) => {
        const kite = CNBConfigIO.loadFromText(readFileSync(path.join(__dirname, "..", "fixtures", "kite-4-369-config.json"), "utf8")).config;
        kite.keys.enabled = true;
        kite.keys.keySignature.enabled = true;
        kite.keys.keySignature.looks.sharp = { sign: "sharp" };
        const api = E.render(container, { config: kite, view: { layer: "sharp" } });
        eq(subtreeText(findAll(api.root, "cnb-kse-sign-size-auto")[0]), "Automatic (3)", "Kite 4-369");
      });
  } },

  { name: "render: a look's offset — x and y in semitones, written whole, cleared through 'as …'", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), view: { layer: "flat" }, onChange: (slices) => { last = slices; } });
        const card = () => findAll(api.root, "cnb-kse-look-card")[0];
        const x = findAll(card(), "cnb-kse-look-offset-x")[0];
        eq(x.value, "0", "none: 0");
        x.value = "0.5";
        x.onchange();
        deepEq(last.keys.keySignature.looks.flat.offset, { x: 0.5, y: 0 }, "x written, y 0");
        const y = findAll(card(), "cnb-kse-look-offset-y")[0];
        y.value = "-1.2";
        y.onchange();
        deepEq(last.keys.keySignature.looks.flat.offset, { x: 0.5, y: -1.2 }, "y written, x kept");
        findAll(card(), "cnb-kse-look-offset-as")[0].onclick();
        assert(!("offset" in last.keys.keySignature.looks.flat), "'as all marks' clears it");
      });
  } },

  { name: "render: added symbols — up to two, each selected as Added 1 or 2 with its own shape, size and offset, removable, and cleared together", fn: () => {
      withDomStub((container) => {
        let last = null;
        const config = keysConfig();
        let shapes = config.shapes;
        const api = E.render(container, { config, view: { layer: "sharp" },
          onChange: (slices) => { last = slices; if (slices.shapes) shapes = slices.shapes; } });
        const card = () => findAll(api.root, "cnb-kse-look-card")[0];
        const add = () => findAll(card(), "cnb-kse-look-add")[0];
        const select = (s) => findAll(card(), "cnb-kse-look-select").find(b => b.getAttribute("data-symbol") === String(s));
        eq(findAll(card(), "cnb-kse-look-added-as").length, 0, "none set: as all marks");

        add().onclick();
        deepEq(last.keys.keySignature.looks.sharp.added, [{ shape: "crotchet-minim" }], "one added, the notehead's shape");
        assert(select(0).className.includes("on"), "and selected as Added 1");
        eq(subtreeText(select(0)), "Added 1", "in words");
        eq(findAll(card(), "cnb-kse-look-sign").length, 0, "an added symbol is a shape, never a sign");
        eq(findAll(card(), "cnb-kse-look-fill").length + findAll(card(), "cnb-kse-look-colour").length, 0,
          "solid, in the mark's colour");
        findAll(card(), "cnb-kse-look-shape").find(b => b.getAttribute("data-shape") === "kite-up").onclick();
        eq(last.keys.keySignature.looks.sharp.added[0].shape, "kite-up", "its shape");
        const height = findAll(card(), "cnb-kse-look-height")[0];
        height.value = "1";
        height.onchange();
        eq(last.keys.keySignature.looks.sharp.added[0].heightSemis, 1, "its size");
        const x = findAll(card(), "cnb-kse-look-offset-x")[0];
        x.value = "0.8";
        x.onchange();
        deepEq(last.keys.keySignature.looks.sharp.added[0].offset, { x: 0.8, y: 0 }, "its offset");
        assert(!("offset" in last.keys.keySignature.looks.sharp), "not the base's");
        assert(CNBConfig.validate({ ...CNBConfig.clone(config), shapes, keys: last.keys }).valid,
          "valid");

        add().onclick();
        eq(last.keys.keySignature.looks.sharp.added.length, 2, "a second");
        assert(select(1).className.includes("on"), "selected as Added 2");
        eq(findAll(card(), "cnb-kse-look-add").length, 0, "no third");

        findAll(card(), "cnb-kse-look-remove").find(b => b.getAttribute("data-symbol") === "0").onclick();
        eq(last.keys.keySignature.looks.sharp.added.length, 1, "the first removed");
        eq(last.keys.keySignature.looks.sharp.added[0].shape, "crotchet-minim", "the second kept");
        assert(select("base").className.includes("on"), "the base selected again");
        findAll(card(), "cnb-kse-look-remove")[0].onclick();
        deepEq(last.keys.keySignature.looks.sharp.added, [], "none: those beneath removed too");
        findAll(card(), "cnb-kse-look-added-as")[0].onclick();
        assert(!("added" in last.keys.keySignature.looks.sharp), "'Added symbols as all marks' clears the field");
      });
  } },

  // ─── render(): the canvas (design §13.8, session 56) ────────────────────

  { name: "snap / layerFor / dragOffset / dragSize: the canvas's pure rules", fn: () => {
      eq(E.snap(0.26), 0.3, "to tenths");
      eq(E.snap(-0.04), 0, "and no negative zero");
      eq(E.snap(1.25), 1.3, "half up");
      eq(E.CANVAS_PX_PER_SEMI, 24, "24 px a semitone");
      const members = { natural: new Set([0, 1]), flat: new Set([2]), sharp: new Set(), space: new Set([1, 2]) };
      eq(E.layerFor(members, 2, { layer: "all", pinned: false }), "flat", "a flat's spelling");
      eq(E.layerFor(members, 0, { layer: "flat", pinned: false }), "natural", "a natural's, from flats");
      eq(E.layerFor(members, 2, { layer: "space", pinned: true }), "space", "a picked layer stays picked");
      deepEq(E.dragOffset({ x: 0, y: 0 }, 37, -14, 24), { x: 1.5, y: 0.6 }, "37 px right, 14 up, snapped, y up");
      deepEq(E.dragOffset({ x: 0.37, y: 0 }, 0, 0, 24), { x: 0.4, y: 0 }, "a drag's result snaps");
      deepEq(E.dragSize({ heightSemis: 2, widthSemis: 3 }, 24, 24), { heightSemis: 3, widthSemis: 4.5 }, "taller by 24 px, the proportions kept");
      deepEq(E.dragSize({ heightSemis: 2, widthSemis: 3 }, -240, 24), { heightSemis: 0.1, widthSemis: 0.15 }, "at least a tenth");
  } },

  { name: "render: the canvas draws the picked key's signature magnified, each symbol marked; a note without a key or with the signature off", fn: () => {
      withDomStub((container) => {
        const api = E.render(container, { config: keysConfig(), key: { tonic: 2, mode: "major" } });
        const canvas = findAll(api.root, "cnb-kse-canvas")[0];
        const svg = canvas.children[0];
        eq(svg.tag, "svg", "a drawing");
        eq(svg.getAttribute("class"), "cnb-kse-canvas-svg", "the canvas's");
        const marks = symbolsIn(svg);
        eq(new Set(marks.map(m => m.getAttribute("data-mark"))).size, 8, "D major's eight marks");
        assert(findAttr(svg, "class", "cnb-staff").length === 1, "the staff's lines");
        eq(findAttr(svg, "class", "cnb-kse-instance").length, 8, "all marks outlined: the layer picked");
        eq(findAttr(svg, "data-handle", "1").length, 1, "one handle, on the focused mark");
      });
      withDomStub((container) => {
        const api = E.render(container, { config: keysConfig() });
        assert(subtreeText(findAll(api.root, "cnb-kse-canvas")[0]).includes("Pick a key on the staff"), "no key: a note");
      });
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.enabled = false;
        const api = E.render(container, { config, key: { tonic: 2, mode: "major" } });
        assert(subtreeText(findAll(api.root, "cnb-kse-canvas")[0]).includes("Show the key signature"), "off: a note");
      });
  } },

  { name: "render: a click on a mark selects its spelling's layer, unless another is picked; a click alone writes nothing", fn: () => {
      withDomStub((container) => {
        let emitted = 0;
        const view = {};
        const api = E.render(container, { config: keysConfig(), key: { tonic: 2, mode: "major" }, view,
          onChange: () => { emitted++; } });
        const click = (mark) => {
          const canvas = findAll(api.root, "cnb-kse-canvas")[0];
          const target = symbolsIn(canvas).find(e => e.getAttribute("data-mark") === String(mark));
          canvas.onpointerdown({ target, clientX: 100, clientY: 100, pointerId: 1 });
          canvas.onpointerup({ clientX: 100, clientY: 100 });
        };
        click(2);   // F♯
        eq(view.layer, "sharp", "F♯: sharps");
        eq(findAll(api.root, "cnb-kse-look-card")[0].getAttribute("data-look"), "sharp", "the card follows");
        click(0);   // D
        eq(view.layer, "natural", "D: naturals");
        eq(emitted, 0, "a click writes nothing");
        findAll(api.root, "cnb-kse-layer").find(b => b.getAttribute("data-layer") === "space").onclick();
        click(2);
        eq(view.layer, "space", "a picked layer stays picked");
      });
  } },

  { name: "render: dragging a mark sets its layer's offset, snapped, and reports it once, when released", fn: () => {
      withDomStub((container) => {
        const changes = [];
        const api = E.render(container, { config: keysConfig(), key: { tonic: 2, mode: "major" },
          onChange: (slices) => { changes.push(slices); } });
        const canvas = () => findAll(api.root, "cnb-kse-canvas")[0];
        const target = symbolsIn(canvas()).find(e => e.getAttribute("data-mark") === "2");
        canvas().onpointerdown({ target, clientX: 100, clientY: 100, pointerId: 1 });
        canvas().onpointermove({ clientX: 110, clientY: 95 });
        canvas().onpointermove({ clientX: 137, clientY: 86 });
        eq(changes.length, 0, "nothing reported while it moves");
        assert(subtreeText(canvas()).includes("offset x 1.5 y 0.6"), "the values beside the handle");
        canvas().onpointerup({ clientX: 137, clientY: 86 });
        eq(changes.length, 1, "one change: one step of undo");
        deepEq(changes[0].keys.keySignature.looks.sharp.offset, { x: 1.5, y: 0.6 }, "every sharp's offset");
        eq(findAll(api.root, "cnb-kse-look-offset-x")[0].value, "1.5", "the field shows it");
      });
  } },

  { name: "render: the corner handle sizes the selected symbol, or the signs' one size for a sign", fn: () => {
      withDomStub((container) => {
        const changes = [];
        const api = E.render(container, { config: keysConfig(), key: { tonic: 2, mode: "major" },
          view: { layer: "sharp" }, onChange: (slices) => { changes.push(slices); } });
        const canvas = () => findAll(api.root, "cnb-kse-canvas")[0];
        const handle = findAttr(canvas(), "data-handle", "1")[0];
        canvas().onpointerdown({ target: handle, clientX: 0, clientY: 0, pointerId: 1 });
        canvas().onpointermove({ clientX: 0, clientY: 24 });
        canvas().onpointerup({});
        eq(changes.length, 1, "once");
        const shape = CNBConfig.createDefault().shapes["crotchet-minim"];
        const look = changes[0].keys.keySignature.looks.sharp;
        eq(look.heightSemis, 3.7, "2.724 and a semitone, snapped");
        eq(look.widthSemis, Math.round(3.7 * shape.naturalWidth / shape.naturalHeight * 1e4) / 1e4, "the width in proportion");
      });
      withDomStub((container) => {
        const changes = [];
        const config = keysConfig();
        config.keys.keySignature.looks.sharp = { sign: "sharp" };
        const api = E.render(container, { config, key: { tonic: 2, mode: "major" },
          view: { layer: "sharp" }, onChange: (slices) => { changes.push(slices); } });
        const canvas = () => findAll(api.root, "cnb-kse-canvas")[0];
        canvas().onpointerdown({ target: findAttr(canvas(), "data-handle", "1")[0], clientX: 0, clientY: 0, pointerId: 1 });
        canvas().onpointermove({ clientX: 0, clientY: 24 });
        canvas().onpointerup({});
        eq(changes[0].keys.keySignature.signs.heightSemis, 3.7, "the signs' size, from the automatic 2.724");
        deepEq(changes[0].keys.keySignature.looks.sharp, { sign: "sharp" }, "the sharps' look unchanged");
      });
  } },

  { name: "render: a click on an added symbol selects it, and its drag sets its own offset", fn: () => {
      withDomStub((container) => {
        const changes = [];
        const config = keysConfig();
        config.keys.keySignature.looks.sharp = { added: [{ shape: "crotchet-minim", heightSemis: 1, widthSemis: 1, offset: { x: 1, y: 0 } }] };
        const view = {};
        const api = E.render(container, { config, key: { tonic: 2, mode: "major" }, view,
          onChange: (slices) => { changes.push(slices); } });
        const canvas = () => findAll(api.root, "cnb-kse-canvas")[0];
        const tail = symbolsIn(canvas()).find(e => e.getAttribute("data-mark") === "2" && e.getAttribute("data-symbol") === "1");
        assert(tail, "the added symbol is drawn and marked");
        canvas().onpointerdown({ target: tail, clientX: 0, clientY: 0, pointerId: 1 });
        canvas().onpointermove({ clientX: 12, clientY: 0 });
        canvas().onpointerup({});
        deepEq([view.layer, view.symbol], ["sharp", 0], "Added 1 of the sharps");
        deepEq(changes[0].keys.keySignature.looks.sharp.added[0].offset, { x: 1.5, y: 0 }, "its own offset, from where it was");
        assert(!("offset" in changes[0].keys.keySignature.looks.sharp), "not the base's");
      });
  } },

  // ─── render(): the key picker and the other keys (design §13.8) ────────

  { name: "render: the key picker is the staff's key and mode; a change picks the staff's key through onKey", fn: () => {
      withDomStub((container) => {
        const picks = [];
        const api = E.render(container, { config: keysConfig(), key: { tonic: 3, mode: "major", spelling: "E♭" },
          onKey: (key) => { picks.push(key); } });
        const tonic = findAll(api.root, "cnb-kse-key-tonic")[0];
        const mode = findAll(api.root, "cnb-kse-key-mode")[0];
        eq(tonic.value, "E♭", "the staff's spelling");
        eq(tonic.children.length, 15, "the mode's 15 spellings");
        eq(mode.value, "major", "and mode");
        tonic.onchange({ target: { value: "F♯" } });
        deepEq(picks[0], { tonic: 6, mode: "major", spelling: "F♯" }, "a tonic picked");
        mode.onchange({ target: { value: "minor" } });
        deepEq(picks[1], { tonic: 3, mode: "minor", spelling: "E♭" }, "a mode, the spelling kept where it has one");
        mode.onchange({ target: { value: "locrian" } });
        eq(picks[2].mode, "locrian", "locrian");
        eq(picks[2].tonic, 3, "the tonic kept");
      });
  } },

  { name: "render: the other keys — the picked mode's 15 keys as small signatures, the picked one marked, a click picking one", fn: () => {
      withDomStub((container) => {
        const picks = [];
        const api = E.render(container, { config: keysConfig(), key: { tonic: 2, mode: "major" },
          onKey: (key) => { picks.push(key); } });
        const minis = findAll(api.root, "cnb-kse-mini");
        deepEq(minis.map(b => b.getAttribute("data-key")),
          ["C", "G", "D", "A", "E", "B", "F♯", "C♯", "F", "B♭", "E♭", "A♭", "D♭", "G♭", "C♭"],
          "the mode's 15 keys, sharp keys then flat keys");
        deepEq(E.keyOrder("minor").slice(0, 3), ["A", "E", "B"], "in minor, from A");
        deepEq(E.keyOrder("minor").slice(-2), ["E♭", "A♭"], "to A♭");
        assert(minis.every(b => b.children[0].tag === "svg"), "each a drawing");
        deepEq(minis.filter(b => b.className.includes(" on")).map(b => b.getAttribute("data-key")), ["D"], "D picked");
        eq(findAll(api.root, "cnb-kse-mini").filter(b => b.className.includes("touch")).length, 0, "none touch");
        eq(subtreeText(findAll(api.root, "cnb-kse-touch-summary")[0]), "No marks touch in any of the 105 keys.", "the line says so");
        minis.find(b => b.getAttribute("data-key") === "B♭").onclick();
        deepEq(picks[0], { tonic: 10, mode: "major", spelling: "B♭" }, "B♭ major picked");
      });
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.enabled = false;
        const api = E.render(container, { config, key: { tonic: 2, mode: "major" } });
        eq(findAll(api.root, "cnb-kse-mini").length, 0, "none while the signature is off");
      });
  } },

  { name: "render: keys whose marks touch are outlined with their count, and the line opens their list, a click picking one", fn: () => {
      withDomStub((container) => {
        const picks = [];
        const config = keysConfig();
        config.keys.keySignature.stacking = "parity";   // the default noteheads a whole step apart
        const api = E.render(container, { config, key: { tonic: 0, mode: "major" }, onKey: (key) => { picks.push(key); } });
        const minis = findAll(api.root, "cnb-kse-mini");
        assert(minis.every(b => b.className.includes("touch")), "every key outlined");
        const c = minis.find(b => b.getAttribute("data-key") === "C");
        const count = CNBKeySignature.touches(config, { name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11], tonicPc: 0 }).length;
        eq(subtreeText(findAll(c, "cnb-kse-mini-name")[0]), `C · ${count} touch`, "with the number of places");
        const list = findAll(api.root, "cnb-kse-touch-list")[0];
        eq(list.tag, "details", "a list that opens");
        eq(subtreeText(findAll(list, "cnb-kse-touch-summary")[0]), "Marks touch in 105 of the 105 keys", "the line");
        const keys = findAll(list, "cnb-kse-touch-key");
        eq(keys.length, 105, "every key listed");
        keys.find(b => b.getAttribute("data-key") === "G♯ minor").onclick();
        deepEq(picks[0], { tonic: 8, mode: "minor", spelling: "G♯" }, "a click picks its tonic and mode");
      });
  } },

  // ─── render(): an imported symbol's reference point (design §13.3) ─────

  { name: "referenceGeometry / referenceAt: the enlarged drawing, and the native point a click gives", fn: () => {
      const dot = { svgPath: "M 80 0 L 0 80 L -80 0 L 0 -80 Z" };
      const g = E.referenceGeometry(dot);
      eq(g.k, 0.75, "120 px for its 160 units");
      deepEq([g.ox, g.oy, g.width, g.height], [72, 72, 144, 144], "its origin 12 px in, past half its box");
      deepEq(E.referenceAt(g, 72, 72), { x: 0, y: 0 }, "the origin");
      deepEq(E.referenceAt(g, 102, 57), { x: 40, y: -20 }, "30 px right, 15 up: 40 units right, 20 up (y down)");
      const wide = E.referenceGeometry({ svgPath: "M -400 -20 L 400 -20 L 400 20 L -400 20 Z" });
      eq(wide.k, 0.3, "a wide symbol held to 240 px wide");
      const tail = E.referenceGeometry({ svgPath: "M 40 -20 L 100 -60 L 100 -40 L 40 0 Z" });
      deepEq([tail.ox, tail.oy], [12, 12 + 60 * tail.k], "a tail's box takes in its origin, the dot's centre");
      const moved = E.referenceGeometry({ svgPath: "M 40 -20 L 100 -60 L 100 -40 L 40 0 Z", reference: { x: -20, y: 10 } });
      eq(moved.ox, 12 + 20 * moved.k, "and its reference point");
  } },

  { name: "render: a symbol imported for flats takes no ledgers and its reference at the origin; a click moves the point, the box sets its ledgers", fn: () => {
      withDomStub((container) => {
        let last = null;
        const gives = [];
        const config = keysConfig();
        const api = E.render(container, { config, view: { layer: "flat" },
          onChange: (slices) => { last = slices; },
          importControl: (slot, give) => { gives.push(give); } });
        const tail = { displayName: "Tail", svgPath: "M 0 0 L 100 -40 L 100 -20 L 0 20 Z", naturalHeight: 60, naturalWidth: 100,
          semitoneHeight: 0.6, anchors: null };
        gives[gives.length - 1]("tail", tail);
        eq(last.keys.keySignature.looks.flat.shape, "tail", "given to the flats");
        deepEq(last.shapes.tail.reference, { x: 0, y: 0 }, "its reference at the SVG's origin");
        eq(last.shapes.tail.ledgers, false, "for flats: no ledger lines");
        eq(last.shapes.tail.svgPath, tail.svgPath, "the imported shape itself");
        assert(CNBConfig.validate({ ...CNBConfig.clone(config), shapes: last.shapes, keys: last.keys }).valid, "valid");

        const picker = () => findAll(api.root, "cnb-kse-reference-picker")[0];
        assert(picker(), "the reference picker opens");
        const takes = findAll(picker(), "cnb-kse-takes-ledgers-check")[0];
        eq(takes.checked, false, "Takes ledger lines: off");
        eq(subtreeText(findAll(picker(), "cnb-kse-takes-ledgers")[0]), "Takes ledger lines", "in words");

        const g = E.referenceGeometry(tail);
        findAttr(picker(), "class", "cnb-kse-reference-svg")[0].onclick({ clientX: g.ox + 50 * g.k, clientY: g.oy });
        deepEq(last.shapes.tail.reference, { x: 50, y: 0 }, "a click moves the point");

        takes.checked = true;
        takes.onchange();
        assert(!("ledgers" in last.shapes.tail), "on: the field removed, so it takes them");
        const again = findAll(picker(), "cnb-kse-takes-ledgers-check")[0];
        again.checked = false;
        again.onchange();
        eq(last.shapes.tail.ledgers, false, "and off again");

        findAll(picker(), "cnb-kse-reference-done")[0].onclick();
        eq(findAll(api.root, "cnb-kse-reference-picker").length, 0, "Done closes it");
      });
  } },

  { name: "render: a symbol imported for naturals takes ledger lines", fn: () => {
      withDomStub((container) => {
        let last = null;
        const gives = [];
        const api = E.render(container, { config: keysConfig(), view: { layer: "natural" },
          onChange: (slices) => { last = slices; },
          importControl: (slot, give) => { gives.push(give); } });
        gives[gives.length - 1]("dot", { displayName: "Dot", svgPath: "M 80 0 L 0 80 L -80 0 L 0 -80 Z",
          naturalHeight: 160, naturalWidth: 160, semitoneHeight: 1.6, anchors: null });
        assert(!("ledgers" in last.shapes.dot), "no ledgers field: it takes them");
        eq(findAll(api.root, "cnb-kse-takes-ledgers-check")[0].checked, true, "the box on");
      });
  } },

  // ─── render(): validation pass-through ────────────────────────────────

  { name: "render: validation panel — valid default state shows Config valid ✓", fn: () => {
      withDomStub((container) => {
        const api = E.render(container, { config: CNBConfig.createDefault() });
        eq(findAll(api.root, "cnb-kse-valid").length, 1, "valid marker shown");
      });
  } },

  { name: "render: signature enabled while keys are disabled surfaces the Module A warning", fn: () => {
      withDomStub((container) => {
        const config = CNBConfig.createDefault();
        config.keys.keySignature.enabled = true;
        const api = E.render(container, { config });
        const warnings = findAll(api.root, "cnb-kse-warning");
        assert(warnings.some(w => subtreeText(w).includes("keys.enabled is false")),
          "gating warning surfaced");
      });
  } },

  // ─── API surface ───────────────────────────────────────────────────────

  { name: "render: getState/getKeys/applyTo/setState round the editor state through the builders", fn: () => {
      withDomStub((container) => {
        const api = E.render(container, { config: keysConfig() });
        const state = api.getState();
        eq(state.enabled, true, "getState reflects the seeded config");

        const keys = api.getKeys();
        eq(keys.keySignature.enabled, true, "getKeys builds the slice");

        const applied = api.applyTo(CNBConfig.createDefault());
        deepEq(applied.keys, keys, "applyTo replaces the keys section");

        api.setState({ enabled: false });
        eq(api.getKeys().enabled, false, "setState adopts the partial");
        eq(findAll(api.root, "cnb-kse-disabled-note").length, 1, "redraw follows setState");
      });
  } },

  // ─── Export through the editor path (session 30, LY spec 1.3.7 §5.6) ──

  { name: "export: an editor-built keysig-enabled config hands the signature to the engine; the default exports 'none", fn: () => {
      withDomStub((container) => {
        const api = E.render(container, { config: CNBConfig.createDefault() });

        // Drive the full UI flow: enable keys → add a definition → enable
        // the signature → style/placement edits.
        const master = findAll(api.root, "cnb-kse-keys-enable-check")[0];
        master.checked = true;
        master.onchange();
        findAll(api.root, "cnb-kse-def-add")[0].onclick();
        const sig = findAll(api.root, "cnb-kse-sig-enable-check")[0];
        sig.checked = true;
        sig.onchange();

        const edited = api.applyTo(CNBConfig.createDefault());
        eq(edited.keys.keySignature.enabled, true, "signature enabled through the UI");
        assert(!CNBLilypond.generate(edited).includes("cnb:keysig-style"),
          "signature on at the defaults: the engine's own 'chord style, nothing written");
        assert(CNBLilypond.generate(CNBConfig.createDefault()).includes("#(set! cnb:keysig-style 'none)"),
          "the default config, signature off: 'none");
      });
  } },

];
