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
import { withDomStub } from "./svg-stub.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(actual, expected, message) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
}

/** A config with the key signature and the clef on or off. */
function configWith({ signature = false, clef = false } = {}) {
  const config = CNBConfig.createDefault();
  config.keys.enabled = signature;
  config.keys.keySignature.enabled = signature;
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
];

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
    name: "CNBStepNav.isAvailable / reason: steps 7–9 need a signature, step 11 a clef, the rest are always available",
    fn: () => {
      for (const on of ALL) {
        const config = configWith(on);
        for (const step of CNBSteps) {
          const needsSignature = ["ks-custom-symbols", "ks-designer", "ks-preview"].includes(step.id);
          const expected = needsSignature ? on.signature : step.id === "clef-placement" ? on.clef : true;
          eq(CNBStepNav.isAvailable(step.id, config), expected, `${step.id} ${JSON.stringify(on)}`);
          const reason = CNBStepNav.reason(step.id, config);
          if (expected) assert(reason === null, `${step.id} has no reason when available`);
          else eq(reason, needsSignature ? "Show a key signature in step 6 first."
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
      const both = configWith({ signature: true, clef: true });
      eq(CNBStepNav.next("ks-symbol-type", both).id, "ks-custom-symbols", "next from 6 to 7");
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
    name: "CNBStepNav.renderNav: with the signature and a clef on, no step is greyed",
    fn: () => withDomStub(container => {
      CNBStepNav.renderNav(container, { current: "export", config: configWith({ signature: true, clef: true }), onOpen: () => {} });
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
      const config = configWith({ signature: true, clef: true });
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
];
