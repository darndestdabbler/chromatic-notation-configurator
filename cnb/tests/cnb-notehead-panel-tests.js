/**
 * cnb-notehead-panel-tests.js — Unit tests for the notehead panel
 * (session 27, design docs/planning/notehead-first-editor-design.md §2, §5.4)
 *
 * Covers the pure helpers (giveTargets, applyLook, sharesSpot,
 * keptRulesFor, withTwin) and the panel driven against a stub DOM: each
 * control writes its rules and palette through the inference, the colour
 * input keeps its element on `input` and redraws on `change` (session 21's
 * wiring), Shift-selection edits every selected notehead, Give this look
 * to, the side step's visibility, the kept-rule marker, and (session 28)
 * renaming a notehead and its nudge.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBNoteheadPanel as P } from "../ui/notehead-panel.js";
import { CNBNoteheadInference as I } from "../ui/notehead-inference.js";
import { CNBBuiltinShapes } from "../ui/builtin-shapes.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBPitchModel as PM } from "../ui/pitch-model.js";

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

function twinline() {
  const text = readFileSync(path.join(CNB_DIR, "assets", "examples", "gallery", "twinline-compact.json"), "utf8");
  return CNBConfigIO.loadFromText(text).config;
}

// ─── HTML DOM stub (element-property event wiring, textContent clearing) ────

function makeStubElement(tag) {
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
    createElement: (tag) => makeStubElement(tag),
    createElementNS: (_ns, tag) => makeStubElement(tag),
  };
  try {
    return fn(makeStubElement("div"));
  } finally {
    if (had) globalThis.document = prev;
    else delete globalThis.document;
  }
}

/** All descendants whose className includes the token. */
function findAll(el, token) {
  const out = [];
  for (const child of el.children || []) {
    if (String(child.className || "").split(/\s+/).includes(token)) out.push(child);
    out.push(...findAll(child, token));
  }
  return out;
}

function findOne(el, token) {
  const all = findAll(el, token);
  if (all.length !== 1) throw new Error(`expected exactly 1 .${token}, found ${all.length}`);
  return all[0];
}

const byData = (el, token, attr, value) => findAll(el, token).find(e => e.getAttribute(attr) === value);

/** Render a panel for a host owning one config (the panel's onChange
 *  replaces it) and run fn(h) with the stub document installed throughout. */
function withPanel(config, selection, fn, extra) {
  return withDomStub(container => {
    const h = { config, changes: 0, closed: 0 };
    h.api = P.render(container, {
      getConfig: () => h.config,
      selection,
      onChange: (c) => { h.config = c; h.changes++; },
      onClose: () => { h.closed++; },
      ...extra,
    });
    return fn(h);
  });
}

const resolved = (config, pc) => CNBConfig.resolveNotehead(config, pc, "crotchet", null);

export const tests = [

  // ── Name and nudge (session 28, design §2, §4.1) ────────────────────────

  { name: "name: \"This notehead is\" shows only for one selected notehead, at its name", fn: () => {
      withPanel(CNBConfig.createDefault(), [2], h => {
        const select = findOne(h.api.root, "cnb-nhp-name-select");
        eq(select.value, "2", "D");
        eq(select.children.length, 12, "the twelve names");
      });
      withPanel(CNBConfig.createDefault(), [2, 4], h => {
        eq(findAll(h.api.root, "cnb-nhp-name-select").length, 0, "no rename for two noteheads");
      });
    }},

  { name: "name: renaming C to E keeps every look at its spot and reports E", fn: () => {
      const before = fixture("kite-4-369-config.json");
      const renamed = [];
      withPanel(before, [0], h => {
        findOne(h.api.root, "cnb-nhp-name-select").onchange({ target: { value: "4" } });
        eq(h.changes, 1, "one change");
        deepEq(renamed, [4], "the host moves the selection to E");
        deepEq(h.config, PM.renameNotehead(before, 0, 4), "renameNotehead");
        for (let p = 0; p < 12; p++) {
          const was = resolved(before, p);
          const now = resolved(h.config, (p + 4) % 12);
          deepEq([now.shape, now.hollow, now.color], [was.shape, was.hollow, was.color], `the look at old ${p}`);
        }
        findOne(h.api.root, "cnb-nhp-name-select").onchange({ target: { value: "0" } });
        eq(h.changes, 1, "the same name changes nothing");
      }, { onRename: (to) => renamed.push(to) });
    }},

  { name: "nudge: one selected notehead gets its nudge with its limits; none for a custom map or two noteheads", fn: () => {
      const cfg = PM.writeNudges(CNBConfig.createDefault(), [0, 0, -0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4);
      withPanel(cfg, [1], h => {
        const group = findOne(h.api.root, "cnb-nhp-nudge");
        eq(findOne(group, "cnb-pp-nudge-reach").style.width, "75%", "C♯ can go from −1 to D's +0.5");
        findOne(group, "cnb-pp-nudge-field").onchange({ target: { value: "0.9" } });
        eq(h.changes, 1, "written");
        eq(PM.readNudges(h.config).nudges[1], 0.5, "clamped at D");
        eq(findOne(findOne(h.api.root, "cnb-nhp-nudge"), "cnb-pp-nudge-field").value, "0.5", "redrawn");
        assert(findAll(h.api.root, "cnb-nhp-side").length === 1, "now sharing D's spot: the side step shows");
      });
      withPanel(cfg, [1, 3], h => {
        eq(findAll(h.api.root, "cnb-nhp-nudge").length, 0, "no nudge for two noteheads");
      });
      const custom = CNBConfig.createDefault();
      custom.pitchAxis = { enabled: true, kind: "pitch-class-map-v1", octaveStride: 12, axisUnitsPerStaffSpace: 4,
        pitchClasses: [0, 0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((position, pc) => ({ pc, position })) };
      withPanel(custom, [5], h => {
        eq(findAll(h.api.root, "cnb-nhp-nudge").length, 0, "no nudge for a custom map");
      });
    }},

  // ── Pure helpers ──────────────────────────────────────────────────────

  { name: "giveTargets: All, every N from the pitch class, the accidentals and the naturals", fn: () => {
      deepEq(P.giveTargets(5, "all"), [...Array(12).keys()], "all");
      deepEq(P.giveTargets(1, "every-2"), [1, 3, 5, 7, 9, 11], "every other from C♯");
      deepEq(P.giveTargets(1, "every-3"), [1, 4, 7, 10], "every 3rd from C♯");
      deepEq(P.giveTargets(2, "every-4"), [2, 6, 10], "every 4th from D");
      deepEq(P.giveTargets(11, "every-6"), [5, 11], "every 6th from B");
      deepEq(P.giveTargets(0, "accidentals"), [1, 3, 6, 8, 10], "accidentals");
      deepEq(P.giveTargets(0, "naturals"), [0, 2, 4, 5, 7, 9, 11], "naturals");
      let threw = false;
      try { P.giveTargets(0, "every-5"); } catch { threw = true; }
      assert(threw, "an unknown choice throws");
    }},

  { name: "applyLook: copies only the chosen parts, never the side step, and leaves the input", fn: () => {
      const table = I.lookTable(CNBConfig.createDefault());
      const look = { ...table[1], color: "#ff0000", shape: "kite-up", heightSemis: 2, widthSemis: 3, xOffsetStaffSpaces: 0.5 };
      const out = P.applyLook(table, [0, 4], look, ["colour", "size"]);
      deepEq([out[0].color, out[0].heightSemis, out[0].widthSemis], ["#ff0000", 2, 3], "colour and size copied");
      deepEq([out[0].shape, out[0].hollow, out[0].xOffsetStaffSpaces], ["crotchet-minim", false, 0], "shape, fill, side step not");
      eq(out[2], table[2], "other pitch classes untouched");
      eq(table[0].color, null, "input unchanged");
    }},

  { name: "sharesSpot: never on a linear staff; on Twinline for the shared pairs only", fn: () => {
      const linear = CNBConfig.createDefault();
      assert([...Array(12).keys()].every(pc => !P.sharesSpot(linear, pc)), "linear");
      const twin = twinline();
      assert(P.sharesSpot(twin, 0) && P.sharesSpot(twin, 1), "C and C♯ share a spot");
      assert(!P.sharesSpot(twin, 2), "D is alone");
      assert(P.sharesSpot(twin, 11), "B shares with A♯");
    }},

  { name: "keptRulesFor: the rules for particular durations or keys that cover the pitch class", fn: () => {
      const config = CNBConfig.createDefault();
      config.noteheadRules.push(
        { name: "Minim C", priority: 5, match: { pitchClasses: [0], durations: ["minim"], keys: "all" }, apply: { hollow: true } },
        { name: "All minims", priority: 6, match: { pitchClasses: "all", durations: ["minim"], keys: "all" }, apply: { hollow: true } });
      deepEq(P.keptRulesFor(config, 0).map(r => r.name), ["Minim C", "All minims"], "C");
      deepEq(P.keptRulesFor(config, 1).map(r => r.name), ["All minims"], "C♯");
    }},

  { name: "withTwin: every pitch class of the colour gets the twin", fn: () => {
      const kite = fixture("kite-4-369-config.json");
      const out = P.withTwin(kite, "#CC79A7", "#0072b2");
      deepEq(out.palette.cbSafeColors.filter(c => c.hex === "#0072b2").map(c => c.pc), [1, 4, 7, 10], "rose's pitch classes");
      eq(out.palette.cbSafeColors.find(c => c.pc === 0).hex, "#50b4e9", "others kept");
      eq(kite.palette.cbSafeColors.find(c => c.pc === 1).hex, "#cc79a7", "input unchanged");
    }},

  // ── The panel ─────────────────────────────────────────────────────────

  { name: "render: requires getConfig and a selection", fn: () => {
      withDomStub(container => {
        let threw = 0;
        try { P.render(container, { selection: [0] }); } catch { threw++; }
        try { P.render(container, { getConfig: () => CNBConfig.createDefault(), selection: [] }); } catch { threw++; }
        eq(threw, 2, "both throw");
      });
    }},

  { name: "summary: the look in words, with the palette's colour name or black", fn: () => {
      const kite = fixture("kite-4-369-config.json");
      eq(P.summary(kite, I.lookTable(kite)[1]), "kite up · hollow · rose", "Kite C♯");
      const def = CNBConfig.createDefault();
      eq(P.summary(def, I.lookTable(def)[0]), "crotchet minim · solid · black", "default C");
    }},

  { name: "render: the title and summary, the close-up of the one notehead, and the three columns", fn: () => {
      withPanel(CNBConfig.createDefault(), [1], (h) => {
        eq(findOne(h.api.root, "cnb-nhp-title").textContent, "C♯", "title");
        eq(findOne(h.api.root, "cnb-nhp-summary").textContent, "crotchet minim · hollow · black", "summary");
        const cols = findAll(findOne(h.api.root, "cnb-nhp-closeup"), "pc-col");
        deepEq(cols.map(c => c.getAttribute("data-pc")), ["1"], "the selected notehead alone");
        eq(findAll(h.api.root, "cnb-nhp-col").length, 3, "three columns");
        findOne(h.api.root, "cnb-nhp-close").onclick();
        eq(h.closed, 1, "✕ closes");
      });
    }},

  { name: "fill: Hollow writes an inferred rule; a Shift-selection edits every selected notehead", fn: () => {
      withPanel(CNBConfig.createDefault(), [0, 4], (h) => {
        eq(findOne(h.api.root, "cnb-nhp-title").textContent, "C and E (2 noteheads)", "title");
        byData(h.api.root, "cnb-nhp-fill-option", "data-fill", "hollow").onclick();
        assert(resolved(h.config, 0).hollow && resolved(h.config, 4).hollow, "C and E hollow");
        assert(!resolved(h.config, 2).hollow, "D still solid");
        assert(h.config.noteheadRules.every(I.ownsRule), "only inferred rules");
        assert(h.config.noteheadRules.every(r => r.apply.color === undefined), "no apply.color");
        assert(byData(h.api.root, "cnb-nhp-fill-option", "data-fill", "hollow").className.includes(" on"), "redrawn with Hollow on");
      });
    }},

  { name: "colour: a drag (input) only tints the close-up; the colour applies once, on change (session 36)", fn: () => {
      withPanel(CNBConfig.createDefault(), [2], (h) => {
        /** The fills of the close-up's notehead paths (not the hollow cut-outs). */
        const fills = () => {
          const out = [];
          const visit = (n) => { for (const c of n.children || []) { if (c.tag === "path" && c.attrs.fill !== "white") out.push(c.attrs.fill); visit(c); } };
          visit(findOne(h.api.root, "cnb-nhp-closeup"));
          return out;
        };
        assert(fills().length > 0 && fills().every(f => f === "#000000"), "the close-up starts black");
        const input = findOne(h.api.root, "cnb-nhp-color-input");
        input.oninput({ target: { value: "#ff0000" } });
        eq(h.changes, 0, "no onChange while dragging");
        assert(fills().every(f => f === "#ff0000"), "the close-up's noteheads take the colour");
        eq(findOne(h.api.root, "cnb-nhp-color-input"), input, "same element after input");
        eq(CNBConfig.resolveColor(h.config, 2), null, "nothing written yet");
        input.onchange({ target: { value: "#ff0000" } });
        eq(h.changes, 1, "onChange once, on change");
        assert(findOne(h.api.root, "cnb-nhp-color-input") !== input, "redrawn on change");
        eq(CNBConfig.resolveColor(h.config, 2), "#ff0000", "D is red");
        eq(h.config.palette.schemeSymbols["#ff0000"], "red-ff0000", "the colour gets its Scheme symbol");
        findOne(h.api.root, "cnb-nhp-color-input").onchange({ target: { value: "#00ff00" } });
        eq(CNBConfig.resolveColor(h.config, 2), "#00ff00", "D is green");
        eq(h.config.palette.schemeSymbols["#00ff00"], "green-00ff00", "and green its name");
      });
    }},

  { name: "colour: a swatch in use, and None, which takes the colour back out of the palette", fn: () => {
      withPanel(fixture("kite-4-369-config.json"), [0], (h) => {
        const swatches = findAll(h.api.root, "cnb-nhp-swatch").map(s => s.getAttribute("data-color"));
        deepEq(swatches, ["none", "#50b4e9", "#cc79a7", "#000000"], "None, then the colours in use");
        byData(h.api.root, "cnb-nhp-swatch", "data-color", "#cc79a7").onclick();
        eq(h.config.palette.colors.find(c => c.pc === 0).hex, "#cc79a7", "C is rose");
        byData(h.api.root, "cnb-nhp-swatch", "data-color", "none").onclick();
        assert(!h.config.palette.colors.some(c => c.pc === 0), "C has no palette colour");
        assert(!h.config.palette.cbSafeColors.some(c => c.pc === 0), "nor a twin");
        assert(byData(h.api.root, "cnb-nhp-swatch", "data-color", "none").className.includes(" on"), "None shown on");
        eq(findAll(h.api.root, "cnb-nhp-twin").length, 0, "no twin control for none");
      });
    }},

  { name: "colour: the colour-blind-safe alternative is written for every pitch class of the colour", fn: () => {
      withPanel(fixture("kite-4-369-config.json"), [1], (h) => {
        const twin = findOne(h.api.root, "cnb-nhp-twin-input");
        eq(twin.value, "#cc79a7", "starts at the current twin");
        twin.oninput({ target: { value: "#0072b2" } });
        eq(h.changes, 0, "a drag writes nothing (session 36)");
        eq(findOne(h.api.root, "cnb-nhp-twin-input"), twin, "same element after input");
        twin.onchange({ target: { value: "#0072b2" } });
        eq(h.changes, 1, "the twin applies once, on change");
        deepEq(h.config.palette.cbSafeColors.filter(c => c.hex === "#0072b2").map(c => c.pc), [1, 4, 7, 10], "rose's twins");
      });
    }},

  { name: "colour: Start from a palette fills all twelve colours from a preset", fn: () => {
      withPanel(CNBConfig.createDefault(), [0], (h) => {
        const select = findOne(h.api.root, "cnb-nhp-preset");
        select.onchange({ target: { value: "dark2-3" } });
        const colors = h.config.palette.colors;
        eq(colors.length, 12, "twelve colours");
        eq(colors[0].hex, colors[3].hex, "the three colours cycle");
        assert(colors[0].hex !== colors[1].hex, "distinct neighbours");
        eq(CNBConfig.resolveColor(h.config, 4), colors[4].hex, "drawn");
        assert(h.config.noteheadRules.every(r => r.apply.color === undefined), "no colour rules");
      });
    }},

  { name: "shape: the config's shapes, then the built-in ones; a built-in shape enters the config when chosen", fn: () => {
      withPanel(CNBConfig.createDefault(), [1], (h) => {
        deepEq(findAll(h.api.root, "cnb-nhp-shape-option").map(b => b.getAttribute("data-shape")),
          ["crotchet-minim", "ellipse-45deg", "kite-up", "kite-down"], "thumbnails");
        byData(h.api.root, "cnb-nhp-shape-option", "data-shape", "kite-up").onclick();
        deepEq(h.config.shapes["kite-up"], CNBBuiltinShapes.get("kite-up"), "copied into the config");
        eq(resolved(h.config, 1).shape, "kite-up", "C♯ is kite up");
        eq(resolved(h.config, 0).shape, "crotchet-minim", "C unchanged");
        eq(CNBConfig.validate(h.config).errors.length, 0, "valid");
      });
    }},

  { name: "shape: the importControl slot, and chooseShape for an imported shape", fn: () => {
      let slots = 0;
      withPanel(CNBConfig.createDefault(), [3], (h) => {
        eq(slots, 1, "the host's importer drawn in the shape row");
        h.config = { ...h.config, shapes: { ...h.config.shapes, mine: { ...CNBBuiltinShapes.get("kite-down"), displayName: "Mine" } } };
        h.api.chooseShape("mine");
        eq(resolved(h.config, 3).shape, "mine", "D♯ uses the imported shape");
      }, { importControl: (slot) => { slots++; slot.appendChild(document.createElement("input")); } });
    }},

  { name: "size: the height with the lock on sets the width at the shape's ratio; reset clears both", fn: () => {
      withPanel(CNBConfig.createDefault(), [0], (h) => {
        const shape = h.config.shapes["crotchet-minim"];
        const ratio = shape.naturalWidth / shape.naturalHeight;
        eq(Number(findOne(h.api.root, "cnb-nhp-height").value), 2.724, "starts at the shape's own height");
        findOne(h.api.root, "cnb-nhp-height").onchange({ target: { value: "2" } });
        const r = resolved(h.config, 0);
        deepEq([r.heightSemis, r.widthSemis], [2, Math.round(2 * ratio * 1e4) / 1e4], "locked");
        findOne(h.api.root, "cnb-nhp-lock-input").onchange({ target: { checked: false } });
        findOne(h.api.root, "cnb-nhp-width").onchange({ target: { value: "4" } });
        deepEq([resolved(h.config, 0).heightSemis, resolved(h.config, 0).widthSemis], [2, 4], "unlocked: width alone");
        findOne(h.api.root, "cnb-nhp-size-reset").onclick();
        deepEq([resolved(h.config, 0).heightSemis, resolved(h.config, 0).widthSemis], [null, null], "the shape's own size");
        assert(h.config.noteheadRules.length === 2, "no size rule left");
      });
    }},

  { name: "side step: shown only for a notehead on a neighbour's spot, and written", fn: () => {
      withPanel(CNBConfig.createDefault(), [1], (h) => {
        eq(findAll(h.api.root, "cnb-nhp-side").length, 0, "linear: no side step");
      });
      withPanel(twinline(), [2], (h) => {
        eq(findAll(h.api.root, "cnb-nhp-side").length, 0, "Twinline D: alone");
      });
      withPanel(twinline(), [0], (h) => {
        const input = findOne(h.api.root, "cnb-nhp-side-input");
        eq(input.value, "0", "C has no step");
        input.onchange({ target: { value: "-0.5" } });
        eq(resolved(h.config, 0).xOffsetStaffSpaces, -0.5, "written");
        eq(resolved(h.config, 1).xOffsetStaffSpaces, 0.85, "C♯ kept");
      });
      for (const selection of [[0, 2], [2, 0]]) {
        withPanel(twinline(), selection, (h) => {
          const label = JSON.stringify(selection);
          findOne(h.api.root, "cnb-nhp-side-input").onchange({ target: { value: "-0.5" } });
          eq(resolved(h.config, 0).xOffsetStaffSpaces, -0.5, `${label}: C, which shares a spot, takes the step`);
          eq(resolved(h.config, 2).xOffsetStaffSpaces, 0, `${label}: D, selected with it but alone, does not`);
        });
      }
    }},

  { name: "Give this look to: copies the chosen parts to the choice, from the selected pitch class", fn: () => {
      const config = fixture("kite-4-369-config.json");
      withPanel(config, [1], (h) => {
        const part = (name) => findAll(h.api.root, "cnb-nhp-give-parts")[0].children
          .map(l => l.children[0]).find(b => b.getAttribute("data-part") === name);
        part("colour").onchange({ target: { checked: false } });
        part("shape").onchange({ target: { checked: false } });
        part("size").onchange({ target: { checked: false } });
        byData(h.api.root, "cnb-nhp-give-option", "data-give", "all").onclick();
        assert([...Array(12).keys()].every(pc => resolved(h.config, pc).hollow), "all hollow");
        eq(resolved(h.config, 0).shape, "kite-down", "shape not copied");
        eq(CNBConfig.resolveColor(h.config, 0), "#50b4e9", "colour not copied");
      });
      withPanel(CNBConfig.createDefault(), [2], (h) => {
        findOne(h.api.root, "cnb-nhp-color-input").onchange({ target: { value: "#0000ff" } });
        byData(h.api.root, "cnb-nhp-give-option", "data-give", "every-3").onclick();
        deepEq([...Array(12).keys()].filter(pc => CNBConfig.resolveColor(h.config, pc) === "#0000ff"), [2, 5, 8, 11], "every 3rd from D");
      });
    }},

  // ── The rule list (§5.4) ──────────────────────────────────────────────

  { name: "renderRuleList: Kite's lines in words, with thumbnails and swatches", fn: () => {
      withDomStub(container => {
        const list = P.renderRuleList(container, fixture("kite-4-369-config.json"));
        eq(container.children[0], list, "appended");
        const lines = findAll(list, "cnb-nhp-rule");
        deepEq(lines.map(l => l.getAttribute("data-attribute")), ["shape", "fill", "size", "side", "colour"], "one line per attribute");
        deepEq(lines.map(l => findOne(l, "cnb-nhp-rule-words").textContent), [
          "Shape: kite down, with kite up every 4 semitones from C♯ and D",
          "Fill: solid, with hollow every 2 semitones from C♯",
          "Size: each shape at its own size",
          "Side step: none everywhere",
          "Colour: every 3 semitones, skyblue, rose, black",
        ], "words");
        eq(findOne(lines[0], "cnb-nhp-rule-marks").children.filter(c => c.tag === "svg").length, 2, "two shape thumbnails");
        deepEq(findAll(lines[4], "cnb-nhp-rule-swatch").map(s => s.style.background), ["#50b4e9", "#cc79a7", "#000000"], "swatches");
      });
    }},

  { name: "renderRuleList: hovering a line reports the pitch classes it covers, leaving reports none", fn: () => {
      withDomStub(container => {
        const hovers = [];
        const list = P.renderRuleList(container, fixture("kite-4-369-config.json"), { onHover: (pcs) => hovers.push(pcs) });
        const lines = findAll(list, "cnb-nhp-rule");
        lines[0].onmouseenter();
        lines[0].onmouseleave();
        lines[1].onmouseenter();
        deepEq(hovers, [[1, 2, 5, 6, 9, 10], [], [1, 3, 5, 7, 9, 11]], "kite up, none, hollow");
        const plain = P.renderRuleList(container, { ...CNBConfig.createDefault() }, { onHover: (pcs) => hovers.push(pcs) });
        findAll(plain, "cnb-nhp-rule")[0].onmouseenter();
        deepEq(hovers[hovers.length - 1], [...Array(12).keys()], "a shape everywhere covers every notehead");
        eq(findAll(findAll(plain, "cnb-nhp-rule")[4], "cnb-nhp-none").length, 1, "no colour: the None swatch");
      });
    }},

  { name: "the marker names the rules for particular durations or keys that change this notehead", fn: () => {
      const config = CNBConfig.createDefault();
      config.noteheadRules.push({ name: "Minim C", priority: 5, match: { pitchClasses: [0], durations: ["minim"], keys: "all" }, apply: { hollow: true } });
      withPanel(config, [0], (h) => {
        eq(findOne(h.api.root, "cnb-nhp-kept").textContent,
          "1 rule for particular durations or keys also changes this notehead — Advanced", "C");
        byData(h.api.root, "cnb-nhp-fill-option", "data-fill", "hollow").onclick();
        deepEq(h.config.noteheadRules.filter(r => !I.ownsRule(r)).map(r => r.name), ["Minim C"], "kept through an edit");
      });
      withPanel(config, [1], (h) => {
        eq(findAll(h.api.root, "cnb-nhp-kept").length, 0, "C♯: none");
      });
    }},
];
