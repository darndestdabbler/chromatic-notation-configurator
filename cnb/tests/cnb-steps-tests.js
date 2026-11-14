/**
 * cnb-steps-tests.js — the step registry (cnb/ui/steps.js, session 63)
 *
 * Holds the registry to the step-by-step design (§1.1, §2.1, §4): the ids,
 * numbers, groups, labels and titles in order; availability and its
 * reasons; next and back under every availability; and the sidebar and the
 * step bar built from it, against the stub document. A step renamed or
 * reordered here and not in the design fails these tests.
 */

import { CNBSteps, CNBStepNav } from "../ui/steps.js";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBKeySignatureEditor } from "../ui/key-signature-editor.js";
import { withDomStub } from "./svg-stub.js";
import { STAGES } from "../uat/uat-tutorial.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GALLERY_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "examples", "gallery");
const TUTORIAL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "playbook", "tutorial");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(actual, expected, message) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
}

/** A config with the key signature and the clef on or off; custom, a
 *  signature of its own symbols rather than a starting point (step 7). */
function configWith({ signature = false, clef = false, custom = false } = {}) {
  const config = CNBConfig.createDefault();
  config.keys.enabled = signature;
  config.keys.keySignature.enabled = signature;
  if (custom) config.keys.keySignature.looks.spelled = { E: { hollow: true } };
  if (clef) {
    config.clef.enabled = true;
    config.clef.active = "dozenal";
    config.clef.glyphs = { dozenal: { displayName: "Dozenal", kind: "dozenal", semitoneHeight: null } };
  }
  return config;
}

const ALL = [
  { signature: false, clef: false }, { signature: true, clef: false },
  { signature: false, clef: true }, { signature: true, clef: true },
  { signature: true, clef: false, custom: true }, { signature: true, clef: true, custom: true },
];

const STEP_7_REASON = "Choose Custom marks in step 6 to design your own symbols.";

const ids = () => CNBSteps.map(s => s.id);

/** Every element under root, depth first. */
function walk(root, out = []) {
  out.push(root);
  for (const child of root.children || []) walk(child, out);
  return out;
}

const text = (e) => walk(e).map(n => (typeof n.textContent === "string" ? n.textContent : "")).join("");
const links = (root) => walk(root).filter(n => n.className && n.className.split(" ").includes("section-link"));

export const tests = [
  {
    name: "CNBSteps: twelve steps, ids unique, numbered 1 to 12 in order",
    fn: () => {
      eq(ids(), ["notehead-height", "staff", "pitch", "ledger-lines", "noteheads",
        "ks-symbol-type", "ks-custom-symbols", "ks-designer", "ks-preview",
        "clef-symbol", "clef-placement", "export"], "ids");
      assert(new Set(ids()).size === 12, "ids are unique");
      eq(CNBSteps.map(s => s.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "numbers");
    },
  },
  {
    name: "CNBSteps: groups, short labels and full titles as the design lists them",
    fn: () => {
      eq(CNBSteps.map(s => s.group), ["The staff", "The staff", "The staff", "The staff", "Noteheads",
        "Key signature", "Key signature", "Key signature", "Key signature", "Clef", "Clef", "Finish"], "groups");
      eq(CNBSteps.map(s => s.label), ["Notehead height", "Staff", "Pitch", "Ledger lines", "Noteheads",
        "Symbol type", "Custom symbols", "Designer", "Preview", "Symbol and size", "Placement", "Export"], "labels");
      eq(CNBSteps.map(s => s.title), ["Notehead height", "Staff", "Pitch", "Ledger lines", "Noteheads",
        "Key signature symbol type", "Custom key signature symbols", "Key signature designer",
        "Key signature preview", "Clef symbol import and sizing", "Clef semitone/staff assignment",
        "Export"], "titles");
    },
  },
  {
    name: "CNBSteps: components and canvases (design §1.1, §1.2)",
    fn: () => {
      eq(CNBSteps.map(s => s.component), ["noteheads", "staff", "staff", "staff", "noteheads",
        "keySignature", "keySignature", "keySignature", null, "clef", "clef", "meta"], "components");
      eq(CNBSteps.map(s => s.canvas), ["staff", "staff", "staff", "staff", "staff",
        "spelled", "spelled", "designer", "keys", "clef", "staff", "staff"], "canvases");
    },
  },
  {
    name: "CNBStepNav.byId: a step by its id, null for an unknown one or Advanced",
    fn: () => {
      eq(CNBStepNav.byId("ks-designer").number, 8, "ks-designer");
      assert(CNBStepNav.byId("advanced") === null, "advanced is no step");
      assert(CNBStepNav.byId("key-signature") === null, "the old section is no step");
    },
  },
  {
    name: "CNBStepNav.isAvailable / reason: step 7 needs a signature of its own symbols, 8 and 9 a signature, step 11 a clef, the rest are always available",
    fn: () => {
      for (const on of ALL) {
        const config = configWith(on);
        for (const step of CNBSteps) {
          const needsSignature = ["ks-designer", "ks-preview"].includes(step.id);
          const expected = step.id === "ks-custom-symbols" ? on.signature && !!on.custom
            : needsSignature ? on.signature : step.id === "clef-placement" ? on.clef : true;
          eq(CNBStepNav.isAvailable(step.id, config), expected, `${step.id} ${JSON.stringify(on)}`);
          const reason = CNBStepNav.reason(step.id, config);
          if (expected) assert(reason === null, `${step.id} has no reason when available`);
          else eq(reason, step.id === "ks-custom-symbols" ? STEP_7_REASON
            : needsSignature ? "Show a key signature in step 6 first."
            : "Choose or import a clef in step 10 first.", `${step.id} reason`);
        }
      }
    },
  },
  {
    name: "CNBStepNav.isAvailable: keys on with the signature off, or the signature on with keys off, is no signature",
    fn: () => {
      const keysOnly = configWith();
      keysOnly.keys.enabled = true;
      assert(!CNBStepNav.isAvailable("ks-designer", keysOnly), "keys on, signature off");
      const sigOnly = configWith();
      sigOnly.keys.keySignature.enabled = true;
      assert(!CNBStepNav.isAvailable("ks-designer", sigOnly), "signature on, keys off");
      const noActive = configWith({ clef: true });
      noActive.clef.active = null;
      assert(!CNBStepNav.isAvailable("clef-placement", noActive), "a clef on with none chosen");
    },
  },
  {
    name: "CNBStepNav.next / back: every step, with the signature and the clef on and off",
    fn: () => {
      for (const on of ALL) {
        const config = configWith(on);
        const open = CNBSteps.filter(s => CNBStepNav.isAvailable(s.id, config)).map(s => s.id);
        for (const step of CNBSteps) {
          const i = ids().indexOf(step.id);
          const after = open.filter(id => ids().indexOf(id) > i);
          const before = open.filter(id => ids().indexOf(id) < i);
          const next = CNBStepNav.next(step.id, config);
          const back = CNBStepNav.back(step.id, config);
          eq(next && next.id, after[0] || null, `next from ${step.id} ${JSON.stringify(on)}`);
          eq(back && back.id, before[before.length - 1] || null, `back from ${step.id} ${JSON.stringify(on)}`);
        }
      }
    },
  },
  {
    name: "CNBStepNav.next / back: the design's examples, and null at either end",
    fn: () => {
      const none = configWith();
      eq(CNBStepNav.next("ks-symbol-type", none).id, "clef-symbol", "next from 6 skips 7–9 without a signature");
      eq(CNBStepNav.back("clef-symbol", none).id, "ks-symbol-type", "back from 10 to 6");
      eq(CNBStepNav.back("export", none).id, "clef-symbol", "back from 12 to 10 without a clef");
      const start = configWith({ signature: true, clef: true });
      eq(CNBStepNav.next("ks-symbol-type", start).id, "ks-designer", "next from 6 skips 7 for a starting point");
      eq(CNBStepNav.back("ks-designer", start).id, "ks-symbol-type", "back from 8 to 6");
      const both = configWith({ signature: true, clef: true, custom: true });
      eq(CNBStepNav.next("ks-symbol-type", both).id, "ks-custom-symbols", "next from 6 to 7");
      eq(CNBStepNav.back("ks-designer", both).id, "ks-custom-symbols", "back from 8 to 7");
      eq(CNBStepNav.back("export", both).id, "clef-placement", "back from 12 to 11");
      assert(CNBStepNav.back("notehead-height", both) === null, "no back from step 1");
      assert(CNBStepNav.next("export", both) === null, "no next from step 12");
      assert(CNBStepNav.next("advanced", both) === null && CNBStepNav.back("advanced", both) === null,
        "Advanced has neither");
    },
  },
  {
    name: "CNBStepNav.renderNav: group headings, then each step's number and label in order, then Advanced",
    fn: () => withDomStub(container => {
      CNBStepNav.renderNav(container, { current: "staff", config: configWith(), onOpen: () => {} });
      const root = container.children[container.children.length - 1];
      const items = root.children.map(c => c.className === "step-group" ? "# " + c.textContent
        : c.tag === "hr" ? "—" : c.getAttribute("data-section"));
      eq(items, ["# The staff", "notehead-height", "staff", "pitch", "ledger-lines",
        "# Noteheads", "noteheads",
        "# Key signature", "ks-symbol-type", "ks-custom-symbols", "ks-designer", "ks-preview",
        "# Clef", "clef-symbol", "clef-placement", "# Finish", "export", "—", "advanced"], "the list");
      const shown = links(root).map(l => text(l));
      eq(shown, CNBSteps.map(s => String(s.number) + s.label).concat(["Advanced"]), "numbers and labels");
      const current = links(root).filter(l => l.getAttribute("aria-current") === "true");
      eq(current.map(l => l.getAttribute("data-section")), ["staff"], "the current step marked");
      assert(current[0].className.split(" ").includes("on"), "the current step highlighted");
    }),
  },
  {
    name: "CNBStepNav.renderNav: an unavailable step is greyed with its reason and does not open",
    fn: () => withDomStub(container => {
      const opened = [];
      CNBStepNav.renderNav(container, { current: "staff", config: configWith(), onOpen: (id) => opened.push(id) });
      const root = container.children[container.children.length - 1];
      const byId = (id) => links(root).find(l => l.getAttribute("data-section") === id);
      for (const id of ["ks-custom-symbols", "ks-designer", "ks-preview", "clef-placement"]) {
        const link = byId(id);
        eq(link.getAttribute("aria-disabled"), "true", id + " greyed");
        assert(link.className.split(" ").includes("unavailable"), id + " unavailable class");
        eq(link.title, CNBStepNav.reason(id, configWith()), id + " reason");
        link.onclick();
      }
      eq(opened, [], "no greyed step opens");
      for (const id of ["ks-symbol-type", "clef-symbol", "advanced"]) {
        assert(byId(id).getAttribute("aria-disabled") === null, id + " not greyed");
        byId(id).onclick();
      }
      eq(opened, ["ks-symbol-type", "clef-symbol", "advanced"], "available steps open");
    }),
  },
  {
    name: "CNBStepNav.renderNav: with a signature of its own symbols and a clef on, no step is greyed",
    fn: () => withDomStub(container => {
      CNBStepNav.renderNav(container, { current: "export", config: configWith({ signature: true, clef: true, custom: true }), onOpen: () => {} });
      const root = container.children[container.children.length - 1];
      eq(links(root).filter(l => l.getAttribute("aria-disabled") === "true").length, 0, "none greyed");
    }),
  },
  {
    name: "CNBStepNav.renderBar: Back and Next by number and title, skipping greyed steps",
    fn: () => withDomStub(container => {
      const opened = [];
      CNBStepNav.renderBar(container, { current: "ks-symbol-type", config: configWith(), onOpen: (id) => opened.push(id) });
      const root = container.children[container.children.length - 1];
      const buttons = root.children.filter(c => c.tag === "button");
      eq(buttons.map(b => b.textContent), ["← 5. Noteheads", "10. Clef symbol import and sizing →"], "labels");
      buttons.forEach(b => b.onclick());
      eq(opened, ["noteheads", "clef-symbol"], "each opens its step");
    }),
  },
  {
    name: "CNBStepNav.renderBar: no Back on step 1, no Next on step 12, nothing in Advanced",
    fn: () => withDomStub(container => {
      const config = configWith({ signature: true, clef: true, custom: true });
      const buttons = (current) => {
        CNBStepNav.renderBar(container, { current, config, onOpen: () => {} });
        const root = container.children[container.children.length - 1];
        return root.children.filter(c => c.tag === "button").map(b => b.textContent);
      };
      eq(buttons("notehead-height"), ["2. Staff →"], "step 1");
      eq(buttons("ks-symbol-type"), ["← 5. Noteheads", "7. Custom key signature symbols →"], "step 6 with a signature");
      eq(buttons("export"), ["← 11. Clef semitone/staff assignment"], "step 12");
      eq(buttons("advanced"), [], "Advanced");
    }),
  },
  {
    name: "CNBStepNav.startingPoint: each of step 6's starting points, and a signature of its own symbols",
    fn: () => {
      const config = configWith({ signature: true });
      eq(CNBStepNav.startingPoint(config), "noteheads", "the defaults: Noteheads");
      const as = (which) => {
        const c = CNBConfig.clone(config);
        c.keys.keySignature = CNBKeySignatureEditor.startFrom(c.keys.keySignature, which);
        return c;
      };
      eq(CNBStepNav.startingPoint(as("noteheads")), "noteheads", "startFrom noteheads");
      eq(CNBStepNav.startingPoint(as("traditional")), "traditional", "startFrom traditional: Accidentals");
      eq(CNBStepNav.startingPoint(as("custom")), null, "startFrom custom: neither");
      const moved = as("traditional");
      Object.assign(moved.keys.keySignature, { heights: "scale", signs: { heightSemis: 4 }, columnGap: 1 });
      moved.keys.keySignature.placement.position = "every-set";
      eq(CNBStepNav.startingPoint(moved), "traditional", "the designer's heights, place, gap and the signs' size do not count");
      const saved = CNBConfigIO.mergeLoaded({ keys: { enabled: true, keySignature: { enabled: true, style: "accidentals" } } }).config;
      eq(CNBStepNav.startingPoint(saved), "traditional", "a saved accidentals style is Accidentals");
      const stacked = configWith({ signature: true });
      stacked.keys.keySignature.stacking = "parity-stacks";
      stacked.keys.keySignature.columnGap = -0.5;
      eq(CNBStepNav.startingPoint(stacked), "noteheads", "no look set: Noteheads, whatever the stacking");
      for (const [label, edit] of [
        ["a sharps' colour", k => { k.looks.sharp = { color: "#ff0000" }; }],
        ["a line's fill", k => { k.looks.line = { hollow: true }; }],
        ["every second stack's colour", k => { k.alternate = { color: "#00ff00" }; }],
        ["a spelled note's look", k => { k.looks.spelled = { "C♯": { shape: "kite-up" } }; }],
      ]) {
        const own = configWith({ signature: true });
        edit(own.keys.keySignature);
        eq(CNBStepNav.startingPoint(own), null, label + ": its own symbols");
        assert(CNBStepNav.isAvailable("ks-custom-symbols", own), label + ": step 7 open");
      }
      const red = as("traditional");
      red.keys.keySignature.looks.sharp.color = "#cc0000";
      eq(CNBStepNav.startingPoint(red), null, "red sharps are not Accidentals");
      const emptySpelled = configWith({ signature: true });
      emptySpelled.keys.keySignature.looks.spelled = { E: {} };
      eq(CNBStepNav.startingPoint(emptySpelled), "noteheads", "an empty spelled look sets nothing");
    },
  },
  {
    name: "CNBStepNav.startingPoint / isAvailable: each gallery file, loaded as the app loads it",
    fn: () => {
      const custom = ["clairnote-dn.json", "clairnote-sn.json"];
      const files = fs.readdirSync(GALLERY_DIR).filter(f => f.endsWith(".json"));
      assert(files.length >= 18, "the gallery's files");
      for (const file of files) {
        const config = CNBConfigIO.loadFromText(fs.readFileSync(path.join(GALLERY_DIR, file), "utf8")).config;
        const shown = !!(config.keys.enabled && config.keys.keySignature.enabled);
        eq(shown, custom.includes(file), file + " shows a signature");
        eq(CNBStepNav.startingPoint(config), custom.includes(file) ? null : "noteheads", file + " starting point");
        eq(CNBStepNav.isAvailable("ks-custom-symbols", config), custom.includes(file), file + " step 7");
        eq(CNBStepNav.reason("ks-custom-symbols", config), custom.includes(file) ? null : STEP_7_REASON, file + " reason");
      }
    },
  },
  {
    name: "the walk-through's stages (cnb/uat/uat-tutorial.mjs, imported without starting a browser) are the registry's ids in its order",
    fn: () => {
      // STAGES is written out by hand in the driver (design §4, §6), so a
      // step renamed or reordered in the registry and not there fails here.
      eq(STAGES, ids(), "STAGES");
    },
  },
  {
    name: "the tutorial (docs/playbook/tutorial/index.html): one section per step, headed \"N. title\" in the registry's order and words, each showing the walk-through's NN-<id>.png",
    fn: () => {
      const html = fs.readFileSync(path.join(TUTORIAL_DIR, "index.html"), "utf8");
      const sections = [...html.matchAll(/<section id="step-([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
      eq(sections.map(m => m[1]), ids(), "step section ids");
      const plain = (s) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      eq(sections.map(m => plain((m[2].match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || "")),
        CNBSteps.map(s => `${s.number}. ${s.title}`), "step headings");
      for (const [i, m] of sections.entries()) {
        const shot = `shots/${String(CNBSteps[i].number).padStart(2, "0")}-${CNBSteps[i].id}.png`;
        assert(m[2].includes(`src="${shot}"`), `${m[1]} shows ${shot}`);
      }
    },
  },
  {
    name: "the tutorial: every image and relative link names a file beside it, and every picture has alt text",
    fn: () => {
      const html = fs.readFileSync(path.join(TUTORIAL_DIR, "index.html"), "utf8");
      const refs = [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map(m => m[1])
        .filter(u => !/^(?:[a-z]+:|#)/i.test(u));
      assert(refs.length > 0, "the page links to its pictures and downloads");
      const missing = refs.filter(u => !fs.existsSync(path.join(TUTORIAL_DIR, decodeURIComponent(u.split("#")[0]))));
      eq(missing, [], "links to missing files");
      const images = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
      eq(images.filter(img => !/\balt="[^"]+"/.test(img)), [], "images without alt text");
      for (const file of fs.readdirSync(path.join(TUTORIAL_DIR, "shots"))) {
        assert(refs.includes(`shots/${file}`), `the page shows shots/${file}`);
      }
      for (const file of fs.readdirSync(path.join(TUTORIAL_DIR, "downloads"))) {
        assert(refs.includes(`downloads/${file}`), `the page links downloads/${file}`);
      }
    },
  },
];
