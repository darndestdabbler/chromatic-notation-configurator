/**
 * cnb-palette-editor-tests.js — Unit tests for Module 12 (Palette Editor)
 *
 * Covers the ported color library (CIEDE2000, nearest-name, CB-safe
 * matching), the selection → config.palette build (cycling, CB branch,
 * scheme symbols), the selection round-trip, integration with Module A
 * (validate/resolveColor) and Module 11 (exported color registrations), and
 * the render() UI driven against a stub DOM.
 */

import { CNBPaletteEditor } from "../ui/palette-editor.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function approx(a, b, msg, epsilon = 1e-6) {
  if (!(Math.abs(a - b) <= epsilon))
    throw new Error(`${msg || "approx"}: expected ~${b}, got ${a}`);
}

// ─── HTML DOM stub (element-property event wiring, textContent clearing) ────

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

function withHtmlStub(fn) {
  const had = "document" in globalThis;
  const prev = globalThis.document;
  globalThis.document = { createElement: (tag) => makeHtmlStubElement(tag) };
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

const P = CNBPaletteEditor;

// Selection helpers
const presetSel = (key, extra = {}) => ({
  ...P.defaultSelection(),
  source: "preset",
  family: P.PALETTE_PRESET_KEYS[key].family,
  presetKey: key,
  ...extra,
});
const customSel = (colors, extra = {}) => ({
  ...P.defaultSelection(),
  source: "custom",
  customColors: colors,
  ...extra,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

export const tests = [

  // ── Color math ──
  {
    name: "deltaE: identical colors have distance 0",
    fn: () => { approx(P.deltaE("#1b9e77", "#1b9e77"), 0, "deltaE self"); },
  },
  {
    name: "deltaE: black vs white is the maximum (100)",
    fn: () => { approx(P.deltaE("#000000", "#ffffff"), 100, "deltaE black/white"); },
  },
  {
    name: "deltaE: symmetric",
    fn: () => {
      approx(P.deltaE("#d95f02", "#7570b3"), P.deltaE("#7570b3", "#d95f02"), "symmetry");
    },
  },
  {
    name: "hexToRgb/rgbToHex round-trip, 3-digit hex expansion",
    fn: () => {
      assert(P.rgbToHex(...P.hexToRgb("#1B9E77")) === "#1b9e77", "round-trip normalizes case");
      const rgb = P.hexToRgb("#f0a");
      assert(rgb[0] === 255 && rgb[1] === 0 && rgb[2] === 170, "3-digit hex expands");
    },
  },
  {
    name: "hexToLab: white is L=100, a=b=0",
    fn: () => {
      const [L, a, b] = P.hexToLab("#ffffff");
      approx(L, 100, "L", 1e-3);
      approx(a, 0, "a", 1e-3);
      approx(b, 0, "b", 1e-3);
    },
  },
  {
    name: "distanceFromWhite: white is 0, black is 100",
    fn: () => {
      approx(P.distanceFromWhite("#ffffff"), 0, "white");
      approx(P.distanceFromWhite("#000000"), 100, "black");
    },
  },

  // ── Nearest-name / scheme-symbol pipeline ──
  {
    name: "nearestColorName: exact dictionary color matches itself",
    fn: () => {
      assert(P.nearestColorName("#FF0000") === "Red-#ff0000",
        `got ${P.nearestColorName("#FF0000")}`);
    },
  },
  {
    name: "colorSchemeSymbol: spec example #1b9e77 → shamrock-1b9e77 (LY spec §4.5)",
    fn: () => {
      assert(P.colorSchemeSymbol("#1b9e77") === "shamrock-1b9e77",
        `got ${P.colorSchemeSymbol("#1b9e77")}`);
    },
  },
  {
    name: "toSchemeSymbol: lowercases, collapses non-alphanumerics, trims hyphens",
    fn: () => {
      assert(P.toSchemeSymbol("Shamrock-#1b9e77") === "shamrock-1b9e77", "name+hex");
      assert(P.toSchemeSymbol("Crotchet–Minim") === "crotchet-minim", "en dash collapses");
      assert(P.toSchemeSymbol("--Weird  name!--") === "weird-name", "trim + collapse");
    },
  },
  {
    name: "colorSchemeSymbol: non-string falls back to black-000000",
    fn: () => {
      assert(P.colorSchemeSymbol(null) === "black-000000", "null");
      assert(P.colorSchemeSymbol(undefined) === "black-000000", "undefined");
    },
  },
  {
    name: "baseColorName strips the hex suffix, keeps hyphenated names intact",
    fn: () => {
      assert(P.baseColorName("#FF0000") === "Red", "Red");
      assert(P.baseColorName("#0095B6") === "Blue-Green", "hyphenated name survives");
    },
  },

  // ── matchToCBSafe ──
  {
    name: "matchToCBSafe: CB-safe source colors map to themselves at distance 0",
    fn: () => {
      const hexes = P.CB_SAFE_SOURCE.slice(0, 4).map(c => c.hex);
      const m = P.matchToCBSafe(hexes);
      for (let i = 0; i < hexes.length; i++) {
        assert(m[i].cbSafe.hex === hexes[i], `self-match ${hexes[i]}`);
        approx(m[i].distance, 0, "distance 0");
      }
    },
  },
  {
    name: "matchToCBSafe: result aligned with input, one-to-one, distances rounded",
    fn: () => {
      const hexes = P.STANDARD_PALETTES[7].map(c => c.hex);
      const m = P.matchToCBSafe(hexes);
      assert(m.length === 7, "length preserved");
      const used = new Set();
      for (let i = 0; i < m.length; i++) {
        assert(m[i].original === hexes[i], "aligned with input");
        assert(!used.has(m[i].cbSafe.hex), "no CB color assigned twice");
        used.add(m[i].cbSafe.hex);
        assert(m[i].distance === Math.round(m[i].distance * 10) / 10, "distance rounded to 0.1");
      }
    },
  },
  {
    name: "matchToCBSafe: more than 12 inputs throws",
    fn: () => {
      let threw = false;
      try { P.matchToCBSafe(new Array(13).fill("#123456")); } catch (_) { threw = true; }
      assert(threw, "expected throw for 13 colors");
    },
  },

  // ── Presets ──
  {
    name: "presetColors: every registered preset resolves with the declared size",
    fn: () => {
      for (const [key, info] of Object.entries(P.PALETTE_PRESET_KEYS)) {
        const colors = P.presetColors(key);
        assert(Array.isArray(colors), `${key} resolves`);
        assert(colors.length === info.size, `${key} has ${info.size} colors`);
        for (const c of colors) assert(/^#[0-9a-fA-F]{6}$/.test(c.hex), `${key} hex format`);
      }
      assert(P.presetColors("nope-9") === null, "unknown key → null");
    },
  },
  {
    name: "preset labels reference no external notation system (naming check)",
    fn: () => {
      const banned = /clairnote|lyre|kite|giedraitis|dodeka|hamburg|musix|parncutt/i;
      for (const info of Object.values(P.PALETTE_PRESET_KEYS)) {
        assert(!banned.test(info.label), `label "${info.label}" is descriptive only`);
      }
      for (const pal of [P.STANDARD_PALETTES, P.COLORBLIND_SAFE_PALETTES]) {
        for (const colors of Object.values(pal)) {
          for (const c of colors) assert(!banned.test(c.name), `color name "${c.name}"`);
        }
      }
    },
  },

  // ── buildPalette ──
  {
    name: "buildPalette: standard preset cycles the pool across all 12 PCs",
    fn: () => {
      const pal = P.buildPalette(presetSel("dark2-3"));
      assert(pal.colors.length === 12, "12 primary entries");
      assert(pal.cbSafeColors.length === 12, "12 CB entries");
      for (let pc = 0; pc < 12; pc++) {
        const entry = pal.colors[pc];
        assert(entry.pc === pc, "pc field");
        const expected = P.STANDARD_PALETTES[3][pc % 3];
        assert(entry.hex === expected.hex, `pc ${pc} cycles to pool[${pc % 3}]`);
        assert(entry.name === expected.name, `pc ${pc} carries curated name`);
      }
      assert(pal.name === "Dark2 · 3 colors", "label");
      assert(pal.useCBSafe === false, "useCBSafe default");
    },
  },
  {
    name: "buildPalette: cbSafeColors pair with primaries index-for-index (matchToCBSafe)",
    fn: () => {
      const pal = P.buildPalette(presetSel("dark2-4"));
      const matches = P.matchToCBSafe(P.STANDARD_PALETTES[4].map(c => c.hex));
      for (let pc = 0; pc < 12; pc++) {
        const m = matches[pc % 4];
        assert(pal.cbSafeColors[pc].hex === m.cbSafe.hex, `pc ${pc} CB pairing`);
        assert(pal.cbSafeColors[pc].name === m.cbSafe.name, `pc ${pc} CB name`);
      }
    },
  },
  {
    name: "buildPalette: schemeSymbols map every unique primary hex",
    fn: () => {
      const pal = P.buildPalette(presetSel("dark2-3"));
      const uniqueHexes = [...new Set(pal.colors.map(c => c.hex))];
      assert(Object.keys(pal.schemeSymbols).length === uniqueHexes.length, "one symbol per hex");
      for (const hex of uniqueHexes) {
        assert(pal.schemeSymbols[hex] === P.colorSchemeSymbol(hex), `symbol for ${hex}`);
      }
      assert(pal.schemeSymbols["#1b9e77"] === "shamrock-1b9e77", "spec example symbol");
    },
  },
  {
    name: "buildPalette: CB-safe preset uses the identity mapping (LY spec §4.5)",
    fn: () => {
      const pal = P.buildPalette(presetSel("cbsafe-7"));
      for (let pc = 0; pc < 12; pc++) {
        assert(pal.cbSafeColors[pc].hex === pal.colors[pc].hex, `pc ${pc} identity`);
      }
      assert(pal.name === "CB-Safe · 7 colors", "label");
    },
  },
  {
    name: "buildPalette: custom palette uses nearest names and Custom · N label",
    fn: () => {
      const pal = P.buildPalette(customSel(["#FF0000", "#0000FF"]));
      assert(pal.name === "Custom · 2 colors", "label");
      assert(pal.colors[0].hex === "#FF0000" && pal.colors[0].name === "Red", "pc 0");
      assert(pal.colors[1].name === "Blue", "pc 1 nearest name");
      assert(pal.colors[2].hex === "#FF0000", "pc 2 cycles");
      const cb = P.matchToCBSafe(["#FF0000", "#0000FF"]);
      assert(pal.cbSafeColors[0].hex === cb[0].cbSafe.hex, "custom gets matched CB branch");
    },
  },
  {
    name: "buildPalette: custom under the CB-safe tab is CB-safe-as-primary (identity)",
    fn: () => {
      const pal = P.buildPalette(customSel(["#0077BB", "#EE7733"], { family: "cbsafe" }));
      for (let pc = 0; pc < 12; pc++) {
        assert(pal.cbSafeColors[pc].hex === pal.colors[pc].hex, `pc ${pc} identity`);
      }
    },
  },
  {
    name: "buildPalette: useCBSafe passes through; empty custom yields empty palette",
    fn: () => {
      assert(P.buildPalette(presetSel("dark2-2", { useCBSafe: true })).useCBSafe === true, "toggle on");
      const empty = P.buildPalette(customSel([]));
      assert(empty.name === "None", "empty name");
      assert(empty.colors.length === 0 && empty.cbSafeColors.length === 0, "empty arrays");
    },
  },

  {
    name: "buildPalette: duplicate custom hexes share one CB-safe mapping per hex",
    fn: () => {
      // Verification round-1 issue: matchToCBSafe is one-to-one per index,
      // so a repeated primary hex must not fan out to different CB colors —
      // schemeSymbols is keyed by hex and the exporter needs one accessible
      // mapping per symbol.
      const pal = P.buildPalette(customSel(["#FF0000", "#0000FF", "#FF0000"]));
      assert(pal.cbSafeColors[0].hex === pal.cbSafeColors[2].hex,
        "repeated primary hex maps to the same CB-safe hex");
      assert(Object.keys(pal.schemeSymbols).length === 2, "one symbol per unique hex");
      const uniqueCb = P.matchToCBSafe(["#FF0000", "#0000FF"]);
      assert(pal.cbSafeColors[0].hex === uniqueCb[0].cbSafe.hex, "matching ran on unique hexes");
      assert(pal.cbSafeColors[1].hex === uniqueCb[1].cbSafe.hex, "second unique hex pairing");
    },
  },

  // ── selectionFromPalette round-trip ──
  {
    name: "selectionFromPalette: preset palettes round-trip (key, family, useCBSafe)",
    fn: () => {
      for (const key of ["dark2-4", "cbsafe-6", "dark2-11"]) {
        const sel = P.selectionFromPalette(P.buildPalette(presetSel(key, { useCBSafe: true })));
        assert(sel.source === "preset" && sel.presetKey === key, `${key} recovered`);
        assert(sel.family === P.PALETTE_PRESET_KEYS[key].family, `${key} family`);
        assert(sel.useCBSafe === true, `${key} useCBSafe`);
      }
    },
  },
  {
    name: "selectionFromPalette: custom palettes recover the cycled pool",
    fn: () => {
      const colors = ["#112233", "#445566", "#778899"];
      const sel = P.selectionFromPalette(P.buildPalette(customSel(colors)));
      assert(sel.source === "custom", "custom recovered");
      assert(sel.customColors.length === 3, "pool length recovered from cycling");
      assert(sel.customColors.every((h, i) => h === colors[i]), "pool hexes");
    },
  },
  {
    name: "selectionFromPalette: CB-safe custom palettes keep the identity branch",
    fn: () => {
      // Verification round-1 issue: the custom fallback dropped the CB-safe
      // family, so re-editing a saved CB-safe custom palette silently
      // switched its cbSafeColors branch to matchToCBSafe pairings.
      const colors = ["#336699", "#996633"];   // not a preset sequence
      const saved = P.buildPalette(customSel(colors, { family: "cbsafe" }));
      const sel = P.selectionFromPalette(saved);
      assert(sel.source === "custom" && sel.family === "cbsafe", "CB-safe family recovered");
      const rebuilt = P.buildPalette(sel);
      assert(rebuilt.colors.every((c, i) => rebuilt.cbSafeColors[i].hex === c.hex),
        "identity branch preserved through the round trip");
      // Standard custom palettes still recover as standard
      const std = P.selectionFromPalette(P.buildPalette(customSel(["#FF0000", "#00FF00"])));
      assert(std.family === "standard", "matched-branch custom stays standard");
    },
  },
  {
    name: "selectionFromPalette: empty/missing palette falls back to the default",
    fn: () => {
      const def = P.defaultSelection();
      for (const input of [null, {}, { colors: [] }]) {
        const sel = P.selectionFromPalette(input);
        assert(sel.source === def.source && sel.presetKey === def.presetKey, "default selection");
      }
    },
  },

  // ── randomDistinctColor ──
  {
    name: "randomDistinctColor: deterministic with injected rng, valid hex, distinct",
    fn: () => {
      let seed = 42;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const existing = ["#1b9e77", "#d95f02"];
      const hex = P.randomDistinctColor(existing, rng);
      assert(/^#[0-9a-f]{6}$/.test(hex), `hex format: ${hex}`);
      let seed2 = 42;
      const rng2 = () => { seed2 = (seed2 * 16807) % 2147483647; return seed2 / 2147483647; };
      assert(P.randomDistinctColor(existing, rng2) === hex, "deterministic");
      for (const ex of existing) assert(P.deltaE(hex, ex) > 5, `distinct from ${ex}`);
    },
  },

  // ── Integration: Module A (config) ──
  {
    name: "integration: built palette validates against Module A",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.palette = P.buildPalette(presetSel("dark2-7"));
      const result = CNBConfig.validate(config);
      assert(result.valid, `expected valid, got errors: ${result.errors.join("; ")}`);
      assert(!result.warnings.some(w => w.includes("CB-safe palette has")),
        "CB branch fully populated");
    },
  },
  {
    name: "integration: CNBConfig.resolveColor honors the built useCBSafe toggle",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.palette = P.buildPalette(presetSel("dark2-3"));
      assert(CNBConfig.resolveColor(config, 0) === "#1b9e77", "primary when toggle off");
      config.palette = P.buildPalette(presetSel("dark2-3", { useCBSafe: true }));
      const cbHex = P.matchToCBSafe(["#1b9e77"])[0] && config.palette.cbSafeColors[0].hex;
      assert(CNBConfig.resolveColor(config, 0) === cbHex, "CB hex when toggle on");
      assert(cbHex !== "#1b9e77", "CB alternative differs from primary");
    },
  },

  // ── Integration: Module 11 (exporter) ──
  {
    name: "integration: exporter emits the palette's scheme symbols and both A5 branches",
    fn: () => {
      const config = CNBConfig.createDefault();
      config.palette = P.buildPalette(presetSel("dark2-3"));
      const ly = CNBLilypond.generate(config);
      assert(ly.includes("cnb:use-accessible-colors"), "A5 conditional present");
      for (const [hex, sym] of Object.entries(config.palette.schemeSymbols)) {
        assert(ly.includes(`(cnb:register-color! '${sym} "${hex}")`),
          `primary branch registers ${sym}`);
        const cbHex = config.palette.cbSafeColors.find(
          c => config.palette.colors.find(p => p.pc === c.pc).hex === hex).hex;
        assert(ly.includes(`(cnb:register-color! '${sym} "${cbHex}")`),
          `accessible branch registers ${sym} → ${cbHex}`);
      }
    },
  },

  // ── render() against the DOM stub ──
  {
    name: "render: builds tabs, presets, custom, CB match, toggle, 12-cell preview",
    fn: () => withHtmlStub((container) => {
      const handle = P.render(container, {});
      assert(container.children.length === 1, "one root appended");
      const root = handle.root;
      assert(findAll(root, "cnb-pal-tab").length === 2, "two family tabs");
      assert(findAll(root, "cnb-pal-option").length === 6, "six standard presets listed");
      assert(findAll(root, "cnb-pal-custom").length === 1, "custom section");
      assert(findAll(root, "cnb-pal-cb-match").length === 1, "CB match panel");
      assert(findAll(root, "cnb-pal-cb-toggle-input").length === 1, "CB toggle");
      const cbNote = findAll(findAll(root, "cnb-pal-cb-toggle")[0], "cnb-pal-preview-only");
      assert(cbNote.length === 1 && cbNote[0].textContent.startsWith("Preview-only:") &&
        cbNote[0].textContent.includes("cnb:use-accessible-colors"), "CB toggle labelled preview-only (L2)");
      assert(findAll(root, "cnb-pal-preview-cell").length === 12, "12 preview cells");
      assert(findAll(root, "cnb-pal-attribution").length === 1, "attribution note");
      const selected = findAll(root, "cnb-pal-option").filter(o => o.className.includes("selected"));
      assert(selected.length === 1 &&
        selected[0].getAttribute("data-preset-key") === "dark2-3", "default preset selected");
    }),
  },
  {
    name: "render: clicking a preset fires onChange with the built config.palette",
    fn: () => withHtmlStub((container) => {
      let got = null;
      const handle = P.render(container, { onChange: (pal, sel) => { got = { pal, sel }; } });
      const option = findAll(handle.root, "cnb-pal-option")
        .find(o => o.getAttribute("data-preset-key") === "dark2-7");
      option.onclick();
      assert(got, "onChange fired");
      assert(got.sel.presetKey === "dark2-7", "selection updated");
      assert(got.pal.name === "Dark2 · 7 colors", "palette rebuilt");
      assert(got.pal.colors.length === 12, "per-PC entries in payload");
      assert(handle.getPalette().name === "Dark2 · 7 colors", "handle agrees");
    }),
  },
  {
    name: "render: family tab switch lists CB presets and remaps to the same size",
    fn: () => withHtmlStub((container) => {
      const handle = P.render(container, { selection: presetSel("dark2-7") });
      const cbTab = findAll(handle.root, "cnb-pal-tab")[1];
      cbTab.onclick();
      assert(handle.getSelection().family === "cbsafe", "family switched");
      assert(handle.getSelection().presetKey === "cbsafe-7", "same-size preset remapped");
      const keys = findAll(handle.root, "cnb-pal-option").map(o => o.getAttribute("data-preset-key"));
      assert(keys.length === 6 && keys.every(k => k.startsWith("cbsafe-")), "CB presets listed");
      assert(findAll(handle.root, "cnb-pal-cb-match-row").length === 0,
        "no CB match rows for CB-safe-as-primary");
    }),
  },
  {
    name: "render: selecting custom seeds the legacy default colors",
    fn: () => withHtmlStub((container) => {
      const handle = P.render(container, {});
      findAll(handle.root, "cnb-pal-custom-select")[0].onclick();
      const sel = handle.getSelection();
      assert(sel.source === "custom", "custom selected");
      assert(sel.customColors.join(",") === "#e41a1c,#377eb8,#4daf4a", "legacy seed colors");
      assert(findAll(handle.root, "cnb-pal-custom-input").length === 3, "three color inputs");
      assert(findAll(handle.root, "cnb-pal-custom-names").length === 1, "nearest-name line");
    }),
  },
  {
    name: "render: custom color edit, add (max 12), and remove (min 1)",
    fn: () => withHtmlStub((container) => {
      const handle = P.render(container, { selection: customSel(["#FF0000"]) });
      // Edit
      const input = findAll(handle.root, "cnb-pal-custom-input")[0];
      input.oninput({ target: { value: "#00ff00" } });
      assert(handle.getSelection().customColors[0] === "#00ff00", "edit applies");
      // Remove blocked at one color
      findAll(handle.root, "cnb-pal-custom-remove")[0].onclick();
      assert(handle.getSelection().customColors.length === 1, "min 1 enforced");
      // Add up to 12, then the add button disappears
      for (let i = 0; i < 11; i++) findAll(handle.root, "cnb-pal-custom-add")[0].onclick();
      assert(handle.getSelection().customColors.length === 12, "grew to 12");
      assert(findAll(handle.root, "cnb-pal-custom-add").length === 0, "max 12 enforced");
      // Remove works above the minimum
      findAll(handle.root, "cnb-pal-custom-remove")[0].onclick();
      assert(handle.getSelection().customColors.length === 11, "remove applies");
    }),
  },
  {
    name: "render: custom color input — `input` emits without redrawing (the picker stays open); `change` redraws",
    fn: () => withHtmlStub((container) => {
      let got = null;
      let emits = 0;
      const handle = P.render(container, {
        selection: customSel(["#FF0000"]),
        onChange: (pal, sel) => { got = { pal, sel }; emits++; },
      });
      const before = findAll(handle.root, "cnb-pal-custom-input")[0];
      const names = () => findAll(handle.root, "cnb-pal-custom-names")[0].textContent;
      const namesBefore = names();
      before.oninput({ target: { value: "#00ff00" } });
      assert(emits === 1 && got.sel.customColors[0] === "#00ff00", "input emits the new color");
      assert(findAll(handle.root, "cnb-pal-custom-input")[0] === before, "input leaves the same element in the DOM");
      assert(names() === namesBefore, "derived names wait for the picker to close");
      before.onchange({ target: { value: "#00ff00" } });
      assert(emits === 2 && got.sel.customColors[0] === "#00ff00", "change emits");
      assert(findAll(handle.root, "cnb-pal-custom-input")[0] !== before, "change redraws");
      assert(names() !== namesBefore, "nearest-color names catch up on change");
    }),
  },
  {
    name: "render: CB-safe toggle flips useCBSafe and the preview swatches",
    fn: () => withHtmlStub((container) => {
      let last = null;
      const handle = P.render(container, {
        selection: presetSel("dark2-3"),
        onChange: (pal) => { last = pal; },
      });
      const before = findAll(handle.root, "cnb-pal-preview-swatch")[0].style.background;
      const toggle = findAll(handle.root, "cnb-pal-cb-toggle-input")[0];
      toggle.onchange({ target: { checked: true } });
      assert(handle.getSelection().useCBSafe === true, "toggle applied");
      assert(last && last.useCBSafe === true, "onChange payload carries toggle");
      const after = findAll(handle.root, "cnb-pal-preview-swatch")[0].style.background;
      assert(before === "#1b9e77", "preview showed primary before");
      assert(after === last.cbSafeColors[0].hex && after !== before,
        "preview shows CB alternative after");
    }),
  },
  {
    name: "render: initializes from a saved config.palette (selectionFromPalette path)",
    fn: () => withHtmlStub((container) => {
      const saved = P.buildPalette(presetSel("cbsafe-4", { useCBSafe: true }));
      const handle = P.render(container, { palette: saved });
      const sel = handle.getSelection();
      assert(sel.presetKey === "cbsafe-4" && sel.family === "cbsafe", "preset recovered");
      assert(sel.useCBSafe === true, "toggle recovered");
      const toggle = findAll(handle.root, "cnb-pal-cb-toggle-input")[0];
      assert(toggle.checked === true, "checkbox reflects state");
    }),
  },
];
