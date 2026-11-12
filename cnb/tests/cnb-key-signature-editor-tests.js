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
        eq(status[0].textContent, "The signature draws for the key and mode picked on the staff.", "with no key defined");

        findAll(api.root, "cnb-kse-def-add")[0].onclick();
        status = findAll(api.root, "cnb-kse-sig-status");
        eq(status.length, 1, "status still shown");
        eq(status[0].textContent, "The signature draws for the key and mode picked on the staff.", "with a key defined");

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

  { name: "render: Notes — the whole scale or the tonic and the half steps, and the tonic an octave up", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const options = findAll(findAll(api.root, "cnb-kse-notes-choice")[0], "cnb-kse-radio");
        deepEq(options.map(o => o.getAttribute("data-value")), ["all", "tonic-and-half-steps"], "two choices");
        assert(options[0].className.includes("on"), "the whole scale by default");
        eq(subtreeText(options[1]), "The tonic and the half steps", "in words");
        options[1].children[0].onchange();
        eq(last.keys.keySignature.notes, "tonic-and-half-steps", "notes written");
        findAll(findAll(api.root, "cnb-kse-notes-choice")[0], "cnb-kse-radio")[0].children[0].onchange();
        eq(last.keys.keySignature.notes, "all", "and back");

        const upper = findAll(api.root, "cnb-kse-upper-tonic-check")[0];
        eq(upper.checked, true, "upper tonic on by default");
        upper.checked = false;
        upper.onchange();
        eq(last.keys.keySignature.upperTonic, false, "upper tonic written");
      });
  } },

  { name: "render: Stacks — the four rules write stacking; the direction is hidden under odd-left-even-right", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const values = () => findAll(findAll(api.root, "cnb-kse-stacking")[0], "cnb-kse-radio");
        deepEq(values().map(o => o.getAttribute("data-value")),
          ["degrees", "parity", "parity-stacks", "parity-zigzag"], "four rules");
        eq(subtreeText(values()[0]), "Stacked sevenths: 1 3 5 7 left, 2 4 6 8 right", "the default in words");
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

  { name: "render: Draw — the key's notes or sharps or flats, each a starting point (session 54); sharps or flats hide Notes, Stacks and Looks and keep Place", fn: () => {
      withDomStub((container) => {
        let last = null;
        const config = keysConfig();
        config.keys.keySignature.notes = "tonic-and-half-steps";
        config.keys.keySignature.stacking = "parity-stacks";
        config.keys.keySignature.looks.all = { hollow: true };
        config.keys.keySignature.alternate = { color: "#ff0000" };
        config.keys.keySignature.placement.position = "top-set";
        const api = E.render(container, { config, key: { tonic: 2, mode: "major" }, onChange: (slices) => { last = slices; } });
        const options = () => findAll(findAll(api.root, "cnb-kse-style")[0], "cnb-kse-radio");
        const pick = value => options().find(o => o.getAttribute("data-value") === value).children[0].onchange();
        const shown = token => findAll(api.root, token).length > 0;
        deepEq(options().map(o => o.getAttribute("data-value")), ["noteheads", "traditional"], "two choices");
        deepEq(options().map(o => subtreeText(o)), ["The key's notes", "Sharps or flats"], "in a designer's words");
        assert(options()[0].className.includes("on"), "the key's notes for a notehead signature");
        for (const token of ["cnb-kse-notes", "cnb-kse-stacks", "cnb-kse-looks", "cnb-kse-place"]) assert(shown(token), `${token} shown`);

        pick("traditional");
        const ks = last.keys.keySignature;
        assert(!("style" in ks), "no style written");
        deepEq([ks.enabled, ks.notes, ks.stacking, ks.heights, ks.placement.position], [true, "altered", "fifths", "window", "middle"],
          "the traditional starting point, Show the key signature kept");
        deepEq(ks.looks, { all: {}, natural: {}, flat: { sign: "flat", color: null }, sharp: { sign: "sharp", color: null }, line: {}, space: {} },
          "Emmentaler's signs with no colour, the other looks cleared");
        deepEq(ks.alternate, {}, "every second stack cleared");
        assert(CNBConfig.validate({ ...CNBConfig.clone(config), keys: last.keys }).valid, "the starting point validates");
        assert(options()[1].className.includes("on"), "sharps or flats read from the model");
        for (const token of ["cnb-kse-notes", "cnb-kse-stacks", "cnb-kse-looks"]) assert(!shown(token), `${token} hidden`);
        assert(shown("cnb-kse-place"), "Place stays");
        findAll(findAll(api.root, "cnb-kse-position")[0], "cnb-kse-radio")
          .find(o => o.getAttribute("data-value") === "every-set").children[0].onchange();
        eq(last.keys.keySignature.placement.position, "every-set", "Place still writes under sharps or flats");

        pick("noteheads");
        deepEq(last.keys.keySignature, { ...CNBConfig.createDefault().keys.keySignature, enabled: true },
          "the key's notes: the defaults, Show the key signature kept");
        for (const token of ["cnb-kse-notes", "cnb-kse-stacks", "cnb-kse-looks"]) assert(shown(token), `${token} back`);
        assert(findAll(api.root, "cnb-kse-stacking")[0].children.find(o => o.className.includes("on"))
          .getAttribute("data-value") === "degrees", "stacked sevenths");
      });
      // A loaded config whose notes are the sharps or flats only opens on Sharps or flats.
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.notes = "altered";
        const api = E.render(container, { config });
        const on = findAll(findAll(api.root, "cnb-kse-style")[0], "cnb-kse-radio").find(o => o.className.includes("on"));
        eq(on.getAttribute("data-value"), "traditional", "read from the model");
      });
  } },

  { name: "render: Size — automatic with the rule's size, or set by hand in semitones, under sharps or flats only (session 52)", fn: () => {
      withDomStub((container) => {
        let last = null;
        const config = keysConfig();
        const api = E.render(container, { config, onChange: (slices) => { last = slices; } });
        const shown = token => findAll(api.root, token).length > 0;
        const draw = value => findAll(findAll(api.root, "cnb-kse-style")[0], "cnb-kse-radio")
          .find(o => o.getAttribute("data-value") === value).children[0].onchange();
        const options = () => findAll(findAll(api.root, "cnb-kse-size-choice")[0], "cnb-kse-radio");
        const pick = value => options().find(o => o.getAttribute("data-value") === value).children[0].onchange();
        const on = () => options().find(o => o.className.includes("on")).getAttribute("data-value");
        const height = () => findAll(api.root, "cnb-kse-size-height")[0];
        assert(!shown("cnb-kse-size"), "hidden under the key's notes");

        draw("traditional");
        assert(shown("cnb-kse-size"), "shown under sharps or flats");
        deepEq(options().map(o => subtreeText(o)), ["Automatic (2.72)", "Set by hand"], "the default staff's automatic size");
        eq(on(), "auto", "automatic by default");
        eq(height().value, "2.72", "the field shows the automatic size");

        height().value = "5";
        height().onchange();
        eq(last.keys.keySignature.signs.heightSemis, 5, "a typed size written");
        eq(on(), "set", "…as a size set by hand");
        eq(height().value, "5", "…and kept in the field");
        for (const bad of ["0", "-2", "abc", ""]) {
          height().value = bad;
          height().onchange();
          eq(last.keys.keySignature.signs.heightSemis, 5, `${JSON.stringify(bad)} not written`);
        }
        eq(subtreeText(options()[0]), "Automatic (2.72)", "the automatic label stays the rule's");

        draw("noteheads");
        assert(!shown("cnb-kse-size"), "hidden again under the key's notes");
        eq(last.keys.keySignature.signs.heightSemis, null, "the defaults: automatic");
        draw("traditional");
        eq(height().value, "2.72", "and back, automatic");
        height().value = "5";
        height().onchange();

        pick("auto");
        eq(last.keys.keySignature.signs.heightSemis, null, "back to automatic: null");
        pick("set");
        eq(last.keys.keySignature.signs.heightSemis, 2.72, "set by hand starts from the automatic size");
      });
      // Kite 4-369's noteheads are held to 3 semitones.
      withDomStub((container) => {
        const kite = CNBConfigIO.loadFromText(readFileSync(path.join(__dirname, "..", "fixtures", "kite-4-369-config.json"), "utf8")).config;
        kite.keys.enabled = true;
        kite.keys.keySignature.enabled = true;
        kite.keys.keySignature.notes = "altered";
        const api = E.render(container, { config: kite });
        eq(subtreeText(findAll(findAll(api.root, "cnb-kse-size-choice")[0], "cnb-kse-radio")[0]), "Automatic (3)", "Kite 4-369");
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

  { name: "render: the overlap note shows when two marks of one stack run together in the picked key, and only then", fn: () => {
      const key = { tonic: 0, mode: "major" };
      withDomStub((container) => {
        // Stacked sevenths: a stack's notes are a third apart, clear of the 2.7-semitone notehead.
        const api = E.render(container, { config: keysConfig(), key });
        eq(findAll(api.root, "cnb-kse-overlap-note").length, 0, "no note under stacked sevenths");
      });
      withDomStub((container) => {
        // A new stack at each change of parity: whole steps, 2 semitones, in one stack.
        const config = keysConfig();
        config.keys.keySignature.stacking = "parity-stacks";
        const api = E.render(container, { config, key });
        const note = findAll(api.root, "cnb-kse-overlap-note");
        eq(note.length, 1, "the note shows");
        assert(subtreeText(note[0]).includes("run together") && subtreeText(note[0]).includes("Looks"),
          "it says the marks run together and points to the looks' size");
        // A smaller look clears it.
        api.setState({ keySignature: { ...api.getState().keySignature, looks: { all: { heightSemis: 1.5, widthSemis: 1.5 }, flat: {}, sharp: {} } } });
        eq(findAll(api.root, "cnb-kse-overlap-note").length, 0, "smaller marks: no note");
      });
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.stacking = "parity-stacks";
        const api = E.render(container, { config });
        eq(findAll(api.root, "cnb-kse-overlap-note").length, 0, "no key picked: no note");
      });
  } },

  // ─── render(): the looks (design §4.1, §7; session 50) ─────────────────

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
  } },

  { name: "render: Looks — a menu for all marks, flats, sharps and every second stack, each saying its look", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.looks.flat = { color: null };
        const api = E.render(container, { config });
        const menus = findAll(api.root, "cnb-kse-look");
        deepEq(menus.map(m => m.getAttribute("data-look")), ["all", "flat", "sharp", "alternate"], "four looks");
        deepEq(menus.map(m => subtreeText(findAll(m, "cnb-kse-look-label")[0])),
          ["All marks", "Flats", "Sharps", "Every second stack"], "in words");
        deepEq(menus.map(m => subtreeText(findAll(m, "cnb-kse-look-words")[0])),
          ["as the noteheads", "no colour", "as all marks", "as the others"], "each says its look");
        eq(menus[0].tag, "details", "a menu that opens");
        eq(findAll(menus[3], "cnb-kse-look-height").length, 0, "every second stack has no size");
        eq(findAll(menus[0], "cnb-kse-look-height").length, 1, "the others have one");
      });
  } },

  { name: "render: a look's shape, fill and colour are set and cleared through its 'as …' choice", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const menu = (kind) => findAll(api.root, "cnb-kse-look").find(m => m.getAttribute("data-look") === kind);
        const pick = (kind, token, attr, value) => findAll(menu(kind), token).find(b => b.getAttribute(attr) === value);

        pick("sharp", "cnb-kse-look-shape", "data-shape", "crotchet-minim").onclick();
        eq(last.keys.keySignature.looks.sharp.shape, "crotchet-minim", "shape set");
        assert(!("shapes" in last), "a shape the notation has adds none");
        assert(pick("sharp", "cnb-kse-look-shape", "data-shape", "crotchet-minim").className.includes("on"), "and shown on");
        pick("sharp", "cnb-kse-look-shape", "data-shape", "").onclick();
        assert(!("shape" in last.keys.keySignature.looks.sharp), "'as all marks' clears it");

        pick("flat", "cnb-kse-look-fill", "data-fill", "hollow").onclick();
        eq(last.keys.keySignature.looks.flat.hollow, true, "hollow");
        pick("flat", "cnb-kse-look-fill", "data-fill", "solid").onclick();
        eq(last.keys.keySignature.looks.flat.hollow, false, "solid");
        pick("flat", "cnb-kse-look-fill", "data-fill", "").onclick();
        assert(!("hollow" in last.keys.keySignature.looks.flat), "cleared");

        pick("alternate", "cnb-kse-look-colour", "data-color", "none").onclick();
        eq(last.keys.keySignature.alternate.color, null, "none: no colour");
        findAll(menu("alternate"), "cnb-kse-look-colour-input")[0].onchange({ target: { value: "#CC79A7" } });
        eq(last.keys.keySignature.alternate.color, "#cc79a7", "a colour, when the picker closes");
        pick("alternate", "cnb-kse-look-colour", "data-color", "").onclick();
        assert(!("color" in last.keys.keySignature.alternate), "'as the others' clears it");
      });
  } },

  { name: "render: a look's size — height and width in semitones, the aspect ratio kept, cleared together", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const menu = () => findAll(api.root, "cnb-kse-look").find(m => m.getAttribute("data-look") === "all");
        const shape = CNBConfig.createDefault().shapes["crotchet-minim"];
        const ratio = shape.naturalWidth / shape.naturalHeight;
        const height = findAll(menu(), "cnb-kse-look-height")[0];
        height.value = "1.5";
        height.onchange();
        eq(last.keys.keySignature.looks.all.heightSemis, 1.5, "height");
        eq(last.keys.keySignature.looks.all.widthSemis, Math.round(1.5 * ratio * 1e4) / 1e4, "width at the notehead's ratio");

        const lock = findAll(menu(), "cnb-kse-look-lock-check")[0];
        lock.checked = false;
        lock.onchange();
        const width = findAll(menu(), "cnb-kse-look-width")[0];
        width.value = "1";
        width.onchange();
        eq(last.keys.keySignature.looks.all.widthSemis, 1, "width alone with the ratio unlocked");
        eq(last.keys.keySignature.looks.all.heightSemis, 1.5, "height kept");

        findAll(menu(), "cnb-kse-look-size-as")[0].onclick();
        assert(!("heightSemis" in last.keys.keySignature.looks.all) && !("widthSemis" in last.keys.keySignature.looks.all),
          "'as the noteheads' clears both");
      });
  } },

  { name: "render: a look's new shape keeps its height, the width following the shape's proportions while the ratio is kept", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const menu = () => findAll(api.root, "cnb-kse-look").find(m => m.getAttribute("data-look") === "all");
        const shapeButton = (name) => findAll(menu(), "cnb-kse-look-shape").find(b => b.getAttribute("data-shape") === name);
        const height = findAll(menu(), "cnb-kse-look-height")[0];
        height.value = "1.5";
        height.onchange();
        shapeButton("kite-up").onclick();
        const kite = CNBBuiltinShapes.get("kite-up");
        eq(last.keys.keySignature.looks.all.heightSemis, 1.5, "height kept");
        eq(last.keys.keySignature.looks.all.widthSemis, Math.round(1.5 * kite.naturalWidth / kite.naturalHeight * 1e4) / 1e4,
          "width at the kite's proportions");

        const lock = findAll(menu(), "cnb-kse-look-lock-check")[0];
        lock.checked = false;
        lock.onchange();
        const width = findAll(menu(), "cnb-kse-look-width")[0];
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
        gives[0]("dot", dot);   // the first look's, all marks
        eq(last.keys.keySignature.looks.all.shape, "dot", "the imported shape given to the look");
        eq(last.keys.keySignature.looks.all.heightSemis, 1.5, "height kept");
        eq(last.keys.keySignature.looks.all.widthSemis, 2.25, "width at the imported shape's proportions (1.5 × 240 / 160)");
      });
  } },

  { name: "render: a built-in shape the notation lacks is added to it, and reported with the keys", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const menu = findAll(api.root, "cnb-kse-look").find(m => m.getAttribute("data-look") === "all");
        const kite = findAll(menu, "cnb-kse-look-shape").find(b => b.getAttribute("data-shape") === "kite-up");
        assert(kite, "the built-in shapes are offered");
        kite.onclick();
        eq(last.keys.keySignature.looks.all.shape, "kite-up", "given to the look");
        assert(last.shapes && last.shapes["kite-up"] && last.shapes["crotchet-minim"], "added to the notation's shapes");
        eq(findAll(api.root, "cnb-kse-valid").length, 1, "and the config validates with it");
      });
  } },

  { name: "render: a look's Import from SVG is the host's, and gives the imported shape to that look", fn: () => {
      withDomStub((container) => {
        let last = null;
        const gives = {};
        const api = E.render(container, {
          config: keysConfig(),
          onChange: (slices) => { last = slices; },
          importControl: (slot, give) => { slot.setAttribute("data-import", "yes"); gives[Object.keys(gives).length] = give; },
        });
        eq(findAll(api.root, "cnb-kse-look-import").length, 4, "one per look");
        gives[2]("dot");   // the third look's, Sharps
        eq(last.keys.keySignature.looks.sharp.shape, "dot", "the imported shape given to Sharps");
      });
  } },

  { name: "render: an open look menu stays open across a change", fn: () => {
      withDomStub((container) => {
        const api = E.render(container, { config: keysConfig() });
        const menu = findAll(api.root, "cnb-kse-look").find(m => m.getAttribute("data-look") === "flat");
        eq(menu.open, false, "closed at first");
        menu.open = true;
        menu.ontoggle();
        findAll(menu, "cnb-kse-look-fill").find(b => b.getAttribute("data-fill") === "hollow").onclick();
        const after = findAll(api.root, "cnb-kse-look").find(m => m.getAttribute("data-look") === "flat");
        assert(after !== menu && after.open === true, "redrawn open");
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
