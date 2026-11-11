/**
 * cnb-key-signature-editor-tests.js — Unit tests for the Key Signature
 * Editor (set 010 session 2)
 *
 * Covers the pure state ↔ config builders (buildKeys / applyToConfig /
 * stateFromConfig, round-tripped on every branch), the render() UI driven
 * against a stub DOM (keys.enabled master gate with its explicit disabled
 * state, key-definition rows, signature style/placement/separator/
 * controls), the editor-level duplicate-name check, the Module A
 * validation pass-through, and the export through the editor path (an
 * editor-built keysig-enabled config leaves the signature to the engine;
 * the default, signature off, exports 'none — session 30).
 */

import { CNBKeySignatureEditor } from "../ui/key-signature-editor.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";

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
      style: "notehead-chords",
      // The designer's settings (session 48), carried through unchanged.
      notes: "tonic-and-half-steps",
      upperTonic: false,
      looks: { all: { heightSemis: 1.2, widthSemis: 1.2 }, flat: { color: "#0000ff" }, sharp: { hollow: true } },
      stacking: "parity-stacks",
      alternate: { color: "#ff0000" },
      columns: "left-in-sharp-keys",
      placement: { rule: "scale-from-tonic", tonicOctave: 2, position: "every-set" },
      separator: { enabled: false, color: "#123abc", thicknessPct: 40, extentSemis: 6, shareThickness: false },
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
      eq(state.keySignature.style, "notehead-chords", "default style");
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
      eq(state.keySignature.style, "notehead-chords", "missing signature → defaults");

      const malformed = E.stateFromConfig({ keys: {
        enabled: "yes", definitions: "nope", offKeyMark: 4,
        keySignature: { style: 7, placement: 3, separator: { color: "gold", thicknessPct: -1, extentSemis: 0 },
                        gutter: { paddingH: NaN } },   // retired (session 34): dropped
      } });
      eq(malformed.enabled, true, "truthy enabled coerced");
      deepEq(malformed.definitions, [], "non-array definitions → []");
      deepEq(malformed.offKeyMark, {}, "non-object offKeyMark → {}");
      eq(malformed.keySignature.style, "notehead-chords", "non-string style → default");
      eq(malformed.keySignature.placement.rule, "scale-from-tonic", "non-object placement → default rule");
      eq(malformed.keySignature.separator.color, "#ffd42a", "invalid hex → default");
      eq(malformed.keySignature.separator.thicknessPct, 160, "negative thickness → default");
      eq(malformed.keySignature.separator.extentSemis, 12, "zero extent → default");
      assert(!("gutter" in malformed.keySignature), "a retired gutter is not carried");
  } },

  { name: "stateFromConfig: unknown style/rule STRINGS are preserved (preserve-and-report)", fn: () => {
      const state = E.stateFromConfig({ keys: { keySignature: {
        style: "tonic-label", placement: { rule: "tonic-only" },
      } } });
      eq(state.keySignature.style, "tonic-label", "unknown style kept");
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
        enabled: true, style: "notehead-chords",
        placement: { rule: "scale-from-tonic", tonicOctave: null },
        separator: { enabled: true, color: "#ffd42a", thicknessPct: 160, extentSemis: 12 },
      } } });
      const ks = CNBConfig.createDefault().keys.keySignature;
      for (const f of ["notes", "upperTonic", "looks", "stacking", "alternate", "columns"]) {
        deepEq(state.keySignature[f], ks[f], f);
      }
      eq(state.keySignature.placement.position, "middle", "placement.position");
      eq(state.keySignature.separator.shareThickness, true, "separator.shareThickness");
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
      assertThrows(() => E.buildKeys(withSig({ style: 4 })), "non-string style");
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
                             "cnb-kse-sig-enable-check", "cnb-kse-placement-rule",
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

  { name: "render: style options — the single notehead-chords style, selected, said as LilyPond draws it", fn: () => {
      withDomStub((container) => {
        const api = E.render(container, { config: keysConfig() });
        const options = findAll(api.root, "cnb-kse-style-option");
        eq(options.length, 1, "one implemented style");
        eq(options[0].getAttribute("data-style"), "notehead-chords", "notehead-chords");
        assert(options[0].className.includes("selected"), "selected by default");
        eq(subtreeText(findAll(options[0], "cnb-kse-style-label")[0]), "Notehead chords", "label");
        assert(subtreeText(options[0]).includes("as LilyPond draws it"), "the engine's style, in words");
        assert(subtreeText(options[0]).includes("others may come later"), "notes other styles may come");
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

  { name: "render: an unrecognized loaded style is shown as an extra option and reported by validation", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.style = "tonic-label";
        const api = E.render(container, { config });
        const options = findAll(api.root, "cnb-kse-style-option");
        eq(options.length, 2, "unknown style appended after the one known style");
        assert(subtreeText(options[1]).includes("unrecognized"), "labeled unrecognized");
        assert(options[1].className.includes("selected"), "and selected");
        const errors = findAll(api.root, "cnb-kse-error");
        assert(errors.some(e => subtreeText(e).includes("keys.keySignature.style")),
          "Module A error surfaced");
      });
  } },

  { name: "render: placement rule select offers the implemented vocabulary and writes the rule", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });
        const rule = findAll(api.root, "cnb-kse-placement-rule")[0];
        eq(rule.children.length, 1, "one implemented rule");
        eq(rule.children[0].value, "scale-from-tonic", "the keysig.ly rule");
        rule.value = "scale-from-tonic";
        rule.onchange();
        eq(last.keys.keySignature.placement.rule, "scale-from-tonic", "rule written");
      });
  } },

  { name: "render: an unrecognized loaded placement rule is preserved in the select and reported", fn: () => {
      withDomStub((container) => {
        const config = keysConfig();
        config.keys.keySignature.placement.rule = "tonic-only";
        const api = E.render(container, { config });
        const rule = findAll(api.root, "cnb-kse-placement-rule")[0];
        eq(rule.children.length, 2, "unknown rule appended");
        eq(rule.value, "tonic-only", "unknown rule stays selected");
        const errors = findAll(api.root, "cnb-kse-error");
        assert(errors.some(e => subtreeText(e).includes("placement.rule")),
          "Module A error surfaced");
      });
  } },

  { name: "render: tonic octave — auto checkbox ↔ explicit integer input (preview-only note shown)", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });

        const auto = findAll(api.root, "cnb-kse-octave-auto-check")[0];
        eq(auto.checked, true, "auto by default");
        eq(findAll(api.root, "cnb-kse-octave-input")[0].disabled, true, "explicit input disabled on auto");

        auto.checked = false;
        auto.onchange();
        eq(last.keys.keySignature.placement.tonicOctave, 1, "unchecking auto adopts an explicit octave");

        const input = findAll(api.root, "cnb-kse-octave-input")[0];
        eq(input.disabled, false, "explicit input enabled");
        input.value = "2";
        input.oninput();
        eq(last.keys.keySignature.placement.tonicOctave, 2, "explicit octave written");

        const auto2 = findAll(api.root, "cnb-kse-octave-auto-check")[0];
        auto2.checked = true;
        auto2.onchange();
        eq(last.keys.keySignature.placement.tonicOctave, null, "auto restores null");
      });
  } },

  { name: "render: separator controls write enabled/color/thicknessPct/extentSemis", fn: () => {
      withDomStub((container) => {
        let last = null;
        const api = E.render(container, { config: keysConfig(), onChange: (slices) => { last = slices; } });

        const cb = findAll(api.root, "cnb-kse-sep-enable-check")[0];
        cb.checked = false;
        cb.onchange();
        eq(last.keys.keySignature.separator.enabled, false, "separator disabled");

        const color = findAll(api.root, "cnb-kse-sep-color")[0];
        color.value = "#112233";
        color.onchange();
        eq(last.keys.keySignature.separator.color, "#112233", "color written");

        const thickness = findAll(api.root, "cnb-kse-sep-thickness")[0];
        thickness.value = "40";
        thickness.oninput();
        eq(last.keys.keySignature.separator.thicknessPct, 40, "thickness written");

        const extent = findAll(api.root, "cnb-kse-sep-extent")[0];
        extent.value = "6";
        extent.oninput();
        eq(last.keys.keySignature.separator.extentSemis, 6, "extent written");
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
