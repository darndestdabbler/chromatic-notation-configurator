/**
 * cnb-notehead-panel-tests.js — Unit tests for the notehead panel
 * (session 27, design docs/planning/notehead-first-editor-design.md §2, §5.4)
 *
 * Covers the pure helpers (withShape, sharesSpot, keptRulesFor) and the
 * panel driven against a stub DOM: each control writes its rules through the
 * inference (colour too, session 37), the colour input keeps its element on
 * `input` and redraws on `change` (session 21's wiring), Shift-selection
 * edits every selected notehead, a new shape's width (session 42), the side
 * step's visibility, the kept-rule marker, and (session 28) renaming a
 * notehead and its nudge. Give this look to went in session 42.
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

/** A fixture as the app loads it: a palette it still carries is on its noteheads. */
function fixture(name) {
  return CNBConfigIO.loadFromText(readFileSync(path.join(CNB_DIR, "fixtures", name), "utf8")).config;
}

/** The colour a pitch class is drawn in: its rules' colour, or null (black). */
const colourOf = (config, pc) => CNBConfig.resolveNotehead(config, pc, "crotchet", null).color;

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

  { name: "thumbnail: a shape drawn solid at 7 px per semitone, as the shape buttons and the signature's looks show it (session 50)", fn: () => {
      withDomStub(() => {
        const shape = CNBConfig.createDefault().shapes["crotchet-minim"];
        const svg = P.thumbnail(shape);
        eq(svg.tag, "svg", "an <svg>");
        const w = Math.ceil(7 * shape.semitoneHeight * shape.naturalWidth / shape.naturalHeight) + 4;
        const h = Math.ceil(7 * shape.semitoneHeight) + 4;
        eq(svg.getAttribute("width"), String(w), "the shape's width at 7 px per semitone, 2 px either side");
        eq(svg.getAttribute("height"), String(h), "and its height");
        const paths = [];
        const visit = (n) => { for (const c of n.children || []) { if (c.tag === "path") paths.push(c); visit(c); } };
        visit(svg);
        assert(paths.length > 0 && paths.every(p => p.getAttribute("fill") === "#1c1c1e"), "drawn solid in ink");
      });
  } },

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
        const f = findOne(group, "cnb-pp-nudge-field");
        eq([f.min, f.max].join(" "), "-1 0.5", "C♯ can go from −1 to D's +0.5");
        eq(findAll(group, "cnb-pp-nudge-slider").length, 0, "no slider (session 43)");
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

  { name: "withShape (session 42): a sized notehead keeps its height, its width at the new shape's proportions", fn: () => {
      const config = CNBBuiltinShapes.withShape(CNBConfig.createDefault(), "kite-up");
      const row = { ...I.lookTable(config)[0], heightSemis: 3, widthSemis: 3.7977, xOffsetStaffSpaces: 0.5 };
      const out = P.withShape(config, row, "kite-up");
      const kite = config.shapes["kite-up"];
      const want = Math.round(3 * kite.naturalWidth / kite.naturalHeight * 1e4) / 1e4;
      deepEq([out.shape, out.heightSemis, out.widthSemis], ["kite-up", 3, want], "height kept, width follows");
      eq(out.xOffsetStaffSpaces, 0.5, "the rest of the row kept");
      eq(row.shape, "crotchet-minim", "input unchanged");
    }},

  { name: "withShape: a size equal to the new shape's own is none, and a notehead at its own size stays so", fn: () => {
      const config = CNBBuiltinShapes.withShape(CNBConfig.createDefault(), "kite-up");
      const kite = config.shapes["kite-up"];
      const own = kite.semitoneHeight;
      const at = P.withShape(config, { ...I.lookTable(config)[0], heightSemis: own, widthSemis: 9 }, "kite-up");
      deepEq([at.heightSemis, at.widthSemis], [null, null], "the kite's own height and width");
      const plain = P.withShape(config, { ...I.lookTable(config)[0], heightSemis: null, widthSemis: 2 }, "kite-up");
      deepEq([plain.heightSemis, plain.widthSemis], [null, null], "no height: the new shape's own size");
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

  // ── The panel ─────────────────────────────────────────────────────────

  { name: "render: requires getConfig and a selection", fn: () => {
      withDomStub(container => {
        let threw = 0;
        try { P.render(container, { selection: [0] }); } catch { threw++; }
        try { P.render(container, { getConfig: () => CNBConfig.createDefault(), selection: [] }); } catch { threw++; }
        eq(threw, 2, "both throw");
      });
    }},

  { name: "summary: the look in words, with the colour's nearest name or black", fn: () => {
      const kite = fixture("kite-4-369-config.json");
      eq(P.summary(kite, I.lookTable(kite)[1]), "kite up · hollow · puce", "Kite C♯");
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
        eq(colourOf(h.config, 2), null, "nothing written yet");
        input.onchange({ target: { value: "#ff0000" } });
        eq(h.changes, 1, "onChange once, on change");
        assert(findOne(h.api.root, "cnb-nhp-color-input") !== input, "redrawn on change");
        eq(colourOf(h.config, 2), "#ff0000", "D is red");
        assert(!("palette" in h.config), "no palette written (session 37)");
        findOne(h.api.root, "cnb-nhp-color-input").onchange({ target: { value: "#00ff00" } });
        eq(colourOf(h.config, 2), "#00ff00", "D is green");
      });
    }},

  { name: "colour: a swatch in use, and None, which takes the colour back off the notehead", fn: () => {
      withPanel(fixture("kite-4-369-config.json"), [0], (h) => {
        const swatches = findAll(h.api.root, "cnb-nhp-swatch").map(s => s.getAttribute("data-color"));
        deepEq(swatches, ["none", "#50b4e9", "#cc79a7"], "None, then the colours in use");
        byData(h.api.root, "cnb-nhp-swatch", "data-color", "#cc79a7").onclick();
        eq(colourOf(h.config, 0), "#cc79a7", "C is puce");
        byData(h.api.root, "cnb-nhp-swatch", "data-color", "none").onclick();
        eq(colourOf(h.config, 0), null, "C has no colour");
        eq(colourOf(h.config, 3), "#50b4e9", "D♯ keeps its colour");
        assert(byData(h.api.root, "cnb-nhp-swatch", "data-color", "none").className.includes(" on"), "None shown on");
      });
    }},

  { name: "colour: no colour-blind alternative and no palette select (session 37)", fn: () => {
      withPanel(fixture("kite-4-369-config.json"), [1], (h) => {
        eq(findAll(h.api.root, "cnb-nhp-twin").length, 0, "no twin control");
        eq(findAll(h.api.root, "cnb-nhp-preset").length, 0, "no palette select");
      });
    }},

  { name: "colour: Suggested colours lists the sets and Apply colours the twelve noteheads", fn: () => {
      withPanel(CNBConfig.createDefault(), [0], (h) => {
        const help = findOne(h.api.root, "cnb-nhp-suggest");
        eq(help.tag, "details", "a help disclosure");
        assert(/another name/.test(findOne(help, "cnb-nhp-suggest-note").textContent), "says how to make a colour-blind version");
        const sets = findAll(help, "cnb-nhp-suggest-set");
        eq(sets.length, 14, "fourteen sets, two led by black (session 42)");
        const labels = sets.map(s => findOne(s, "cnb-nhp-suggest-label").textContent);
        assert(labels.filter(l => l.startsWith("Colour-blind safe")).length === 6, "colour-blind-safe sets marked");
        const dark3 = sets.find(s => s.getAttribute("data-set") === "dark2-3");
        eq(findAll(dark3, "cnb-nhp-suggest-swatch").length, 3, "its swatches");
        findOne(dark3, "cnb-nhp-suggest-apply").onclick();
        eq(h.changes, 1, "one change");
        const colours = [...Array(12).keys()].map(pc => colourOf(h.config, pc));
        deepEq(colours.slice(0, 3), ["#1b9e77", "#d95f02", "#7570b3"], "teal, orange, lilac");
        eq(colours[3], colours[0], "the three colours cycle");
        assert(!("palette" in h.config), "no palette written");
        assert(h.config.noteheadRules.every(I.ownsRule), "only inferred rules");
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

  { name: "selecting several (session 38): the head's hint and the Close title, for one notehead and for several", fn: () => {
      withPanel(CNBConfig.createDefault(), [1], (h) => {
        eq(findOne(h.api.root, "cnb-nhp-select-hint").textContent,
          "Shift+click or Ctrl+click more noteheads on the staff to change them together.", "one");
        eq(findOne(h.api.root, "cnb-nhp-close").title, "Close and clear the selection (Esc)", "close title");
      });
      withPanel(CNBConfig.createDefault(), [0, 4], (h) => {
        eq(findOne(h.api.root, "cnb-nhp-select-hint").textContent,
          "Shift+click or Ctrl+click a selected notehead to drop it. Esc or Close clears the selection.", "several");
      });
    }},

  { name: "Give this look to is gone (session 42): a look reaches many noteheads by selecting them", fn: () => {
      withPanel(CNBConfig.createDefault(), [4, 0], (h) => {
        eq(findAll(h.api.root, "cnb-nhp-give").length, 0, "no Give this look to");
        eq(findAll(h.api.root, "cnb-nhp-right").length, 0, "no empty right column on a linear staff");
      });
      withPanel(twinline(), [0], (h) => {
        eq(findAll(h.api.root, "cnb-nhp-right").length, 1, "the right column holds the nudge and side step");
      });
    }},

  { name: "shape (session 42): a notehead 4 semitones tall that becomes a kite is 4 wide, not the old shape's width", fn: () => {
      withPanel(CNBConfig.createDefault(), [0], (h) => {
        findOne(h.api.root, "cnb-nhp-height").onchange({ target: { value: "4" } });
        eq(Number(findOne(h.api.root, "cnb-nhp-width").value), 5.0639, "the default notehead's proportions");
        byData(h.api.root, "cnb-nhp-shape-option", "data-shape", "kite-up").onclick();
        const r = resolved(h.config, 0);
        eq(r.shape, "kite-up", "kite");
        assert(r.widthSemis === null && r.heightSemis === null, `the kite's own 4 × 4: ${JSON.stringify([r.heightSemis, r.widthSemis])}`);
        eq(Number(findOne(h.api.root, "cnb-nhp-width").value), 4, "the field shows 4");
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
          "Colour: every 3 semitones, sky blue, puce, none",
        ], "words");
        eq(findOne(lines[0], "cnb-nhp-rule-marks").children.filter(c => c.tag === "svg").length, 2, "two shape thumbnails");
        deepEq(findAll(lines[4], "cnb-nhp-rule-swatch").map(s => s.style.background || "none"), ["#50b4e9", "#cc79a7", "none"], "swatches, black as none");
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

  { name: "generalHeight: the default notehead is at its shape's own 2.724 semitones; the most common height wins", fn: () => {
      eq(P.generalHeight(CNBConfig.createDefault()), 2.724, "default");
      const config = CNBConfig.createDefault();
      config.noteheadRules.push({ name: "C small", priority: 5, match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { heightSemis: 1.5 } });
      eq(P.generalHeight(config), 2.724, "one notehead sized: the others' height");
    }},

  { name: "setGeneralHeight: every notehead at the height, the width at the shape's ratio, carried by the Default rule", fn: () => {
      const config = CNBConfig.createDefault();
      const before = JSON.stringify(config);
      const out = P.setGeneralHeight(config, 4);
      eq(JSON.stringify(config), before, "input unchanged");
      const width = Math.round(4 * 344.852 / 272.4 * 1e4) / 1e4;
      for (let pc = 0; pc < 12; pc++) {
        const r = CNBConfig.resolveNotehead(out, pc, "crotchet", null);
        eq(r.heightSemis, 4, `height of ${pc}`);
        eq(r.widthSemis, width, `width of ${pc}`);
      }
      const def = out.noteheadRules.find(r => r.match.pitchClasses === "all");
      eq(def.apply.heightSemis, 4, "the Default carries the height");
      eq(def.apply.widthSemis, width, "and the width");
      eq(out.noteheadRules.filter(r => "heightSemis" in r.apply).length, 1, "no other size rule");
      eq(P.generalHeight(out), 4, "reads back");
      eq(CNBConfig.validate(out).errors.length, 0, "valid");
    }},

  { name: "setGeneralHeight: the shape's own height, or null, clears every size", fn: () => {
      const sized = P.setGeneralHeight(CNBConfig.createDefault(), 4);
      for (const out of [P.setGeneralHeight(sized, 2.724), P.setGeneralHeight(sized, null)]) {
        eq(out.noteheadRules.filter(r => "heightSemis" in r.apply || "widthSemis" in r.apply).length, 0, "no size written");
        eq(CNBConfig.resolveNotehead(out, 0, "crotchet", null).heightSemis, null, "C at its own size");
      }
    }},

  { name: "renderGeneralHeight: the field shows the height, and a change or the reset reports the new config", fn: () => {
      withDomStub(container => {
        let config = CNBConfig.createDefault();
        let changes = 0;
        const api = P.renderGeneralHeight(container, { getConfig: () => config, onChange: (c) => { config = c; changes++; } });
        const input = () => findOne(api.root, "cnb-nhp-general-height");
        eq(input().value, "2.724", "starts at the shape's own height");
        input().onchange({ target: { value: "4" } });
        eq(changes, 1, "one change");
        eq(CNBConfig.resolveNotehead(config, 7, "crotchet", null).heightSemis, 4, "G at 4");
        eq(input().value, "4", "redrawn at 4");
        input().onchange({ target: { value: "-1" } });
        eq(changes, 1, "a height that is not positive writes nothing");
        findOne(api.root, "cnb-nhp-general-reset").onclick();
        eq(changes, 2, "the reset reports");
        eq(CNBConfig.resolveNotehead(config, 7, "crotchet", null).heightSemis, null, "G at its own size");
        let threw = false;
        try { P.renderGeneralHeight(container, {}); } catch { threw = true; }
        assert(threw, "requires getConfig");
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
