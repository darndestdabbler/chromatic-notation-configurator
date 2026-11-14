/**
 * steps.js — the step registry (step-by-step design §4, session 63)
 *
 * The Configurator is a sequence of twelve numbered steps in five groups
 * (design §1.1). This list is the one place they are named, numbered and
 * ordered: the sidebar and the step bar are built from it here, and the
 * walk-through and the tutorial follow it (sessions 67 and 68).
 *
 * Each step:
 *   id         the panel's data-panel and the sidebar link's data-section
 *   number     1–12, in order
 *   group      the sidebar's heading
 *   label      the sidebar's short label (the group supplies the rest)
 *   title      the full title: the panel's heading
 *   component  the part of the config it edits (design §1.2); null for a view
 *   canvas     what the canvas area shows: "staff", "spelled", "designer",
 *              "keys" or "clef"
 * and, where it can be greyed (design §2.1), available(config) and the
 * reason it is not.
 *
 * The registry is data: it imports no editor. The order is suggested, not
 * enforced: every available step can be opened at any time.
 */

import { CNBClef } from "../src/cnb-clef.js";

/** A key signature is shown: keys and the signature both on. */
function signatureShown(config) {
  const keys = (config && config.keys) || {};
  return !!(keys.enabled && keys.keySignature && keys.keySignature.enabled);
}

/** A clef is shown. */
function clefShown(config) {
  return !!CNBClef.activeGlyph(config || {});
}

/** A look that sets nothing: missing, or every field unset. */
const unset = (look) => !look || Object.values(look).every(v => v === undefined);

/** A look that is exactly Emmentaler's sign with no colour. */
const signLook = (look, sign) => !!look && look.sign === sign && look.color === null &&
  Object.keys(look).filter(k => look[k] !== undefined).length === 2;

/**
 * Which of step 6's starting points the signature is exactly (session 65,
 * design §3.1): "noteheads" when it sets no look (every look, each spelled
 * note's and every second stack's unset), "traditional" (Accidentals) when
 * its notes are the altered ones, its stacking the cycle of fifths, its
 * flats' and sharps' looks Emmentaler's signs with no colour and every other
 * look unset; else null, the designer's own symbols. The designer's other
 * settings (heights, columns, the gold stem, the place, the signs' size, the
 * column gap) do not count.
 */
function startingPoint(config) {
  const ks = ((config && config.keys) || {}).keySignature || {};
  const looks = ks.looks || {};
  const spelled = Object.values(looks.spelled || {});
  const others = ["all", "natural", "line", "space"].every(l => unset(looks[l])) &&
    spelled.every(unset) && unset(ks.alternate);
  if (!others) return null;
  if (unset(looks.flat) && unset(looks.sharp)) return "noteheads";
  if (ks.notes === "altered" && ks.stacking === "fifths" &&
    signLook(looks.flat, "flat") && signLook(looks.sharp, "sharp")) return "traditional";
  return null;
}

const NEEDS_SIGNATURE = "Show a key signature in step 6 first.";

/** The twelve steps, in order (design §1.1). Step 7 is available when a
 *  signature is shown that is neither of step 6's starting points: Custom
 *  marks, or the designer's own symbols (design §3.1). */
export const CNBSteps = [
  { id: "notehead-height", number: 1, group: "The staff", label: "Notehead height",
    title: "Notehead height", component: "noteheads", canvas: "staff" },
  { id: "staff", number: 2, group: "The staff", label: "Staff",
    title: "Staff", component: "staff", canvas: "staff" },
  { id: "pitch", number: 3, group: "The staff", label: "Pitch",
    title: "Pitch", component: "staff", canvas: "staff" },
  { id: "ledger-lines", number: 4, group: "The staff", label: "Ledger lines",
    title: "Ledger lines", component: "staff", canvas: "staff" },
  { id: "noteheads", number: 5, group: "Noteheads", label: "Noteheads",
    title: "Noteheads", component: "noteheads", canvas: "staff" },
  { id: "ks-symbol-type", number: 6, group: "Key signature", label: "Symbol type",
    title: "Key signature symbol type", component: "keySignature", canvas: "spelled" },
  { id: "ks-custom-symbols", number: 7, group: "Key signature", label: "Custom symbols",
    title: "Custom key signature symbols", component: "keySignature", canvas: "spelled",
    available: (config) => signatureShown(config) && startingPoint(config) === null,
    unavailable: "Choose Custom marks in step 6 to design your own symbols." },
  { id: "ks-designer", number: 8, group: "Key signature", label: "Designer",
    title: "Key signature designer", component: "keySignature", canvas: "designer",
    available: signatureShown, unavailable: NEEDS_SIGNATURE },
  { id: "ks-preview", number: 9, group: "Key signature", label: "Preview",
    title: "Key signature preview", component: null, canvas: "keys",
    available: signatureShown, unavailable: NEEDS_SIGNATURE },
  { id: "clef-symbol", number: 10, group: "Clef", label: "Symbol and size",
    title: "Clef symbol import and sizing", component: "clef", canvas: "clef" },
  { id: "clef-placement", number: 11, group: "Clef", label: "Placement",
    title: "Clef semitone/staff assignment", component: "clef", canvas: "staff",
    available: clefShown, unavailable: "Choose or import a clef in step 10 first." },
  { id: "export", number: 12, group: "Finish", label: "Export",
    title: "Export", component: "meta", canvas: "staff" },
];

/** Advanced: unnumbered, below the steps. */
const ADVANCED = { id: "advanced", label: "Advanced" };

function el(tag, className, text) {
  const e = globalThis.document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export const CNBStepNav = {
  /** Which of step 6's starting points the signature is exactly:
   *  "noteheads", "traditional" or null (session 65, design §3.1). */
  startingPoint,

  /** A step by its id, or null. */
  byId(id) {
    return CNBSteps.find(s => s.id === id) || null;
  },

  /** Whether a step can be opened with this config. */
  isAvailable(id, config) {
    const step = CNBStepNav.byId(id);
    return !!step && (!step.available || step.available(config));
  },

  /** Why a step cannot be opened, or null when it can. */
  reason(id, config) {
    const step = CNBStepNav.byId(id);
    if (!step) return null;
    return CNBStepNav.isAvailable(id, config) ? null : step.unavailable;
  },

  /** The nearest available step after this one, or null at the end. */
  next(id, config) {
    const i = CNBSteps.findIndex(s => s.id === id);
    if (i < 0) return null;
    return CNBSteps.slice(i + 1).find(s => CNBStepNav.isAvailable(s.id, config)) || null;
  },

  /** The nearest available step before this one, or null at the start. */
  back(id, config) {
    const i = CNBSteps.findIndex(s => s.id === id);
    if (i < 0) return null;
    return CNBSteps.slice(0, i).reverse().find(s => CNBStepNav.isAvailable(s.id, config)) || null;
  },

  /**
   * The sidebar (design §2.1): each group's heading, then its steps, each a
   * button.section-link showing its number and short label; then a rule and
   * Advanced, unnumbered. An unavailable step is greyed (aria-disabled), its
   * reason its title, and does not open.
   * @param {HTMLElement} container
   * @param {{current: string, config: object, onOpen: (id: string) => void}} opts
   * @returns {HTMLElement} the list
   */
  renderNav(container, { current, config, onOpen }) {
    const root = el("div", "step-nav");
    let group = null;
    const link = (id, number, label) => {
      const b = el("button", "section-link");
      b.type = "button";
      b.setAttribute("data-section", id);
      if (number !== null) b.appendChild(el("span", "step-number", String(number)));
      b.appendChild(el("span", "step-label", label));
      const reason = id === ADVANCED.id ? null : CNBStepNav.reason(id, config);
      if (reason) {
        b.className += " unavailable";
        b.setAttribute("aria-disabled", "true");
        b.title = reason;
        b.onclick = () => {};
      } else {
        b.onclick = () => onOpen(id);
      }
      if (id === current) {
        b.className += " on";
        b.setAttribute("aria-current", "true");
      }
      return b;
    };
    for (const step of CNBSteps) {
      if (step.group !== group) {
        group = step.group;
        root.appendChild(el("div", "step-group", group));
      }
      root.appendChild(link(step.id, step.number, step.label));
    }
    root.appendChild(el("hr"));
    root.appendChild(link(ADVANCED.id, null, ADVANCED.label));
    container.textContent = "";
    container.appendChild(root);
    return root;
  },

  /**
   * The step bar (design §2.2): Back to the nearest available step before,
   * Next to the nearest after, each by its number and title, each left out
   * at its end. Advanced has none.
   * @param {HTMLElement} container
   * @param {{current: string, config: object, onOpen: (id: string) => void}} opts
   * @returns {HTMLElement} the bar
   */
  renderBar(container, { current, config, onOpen }) {
    const root = el("div", "step-bar-inner");
    if (CNBStepNav.byId(current)) {
      const back = CNBStepNav.back(current, config);
      const next = CNBStepNav.next(current, config);
      if (back) {
        const b = el("button", "step-back", `← ${back.number}. ${back.title}`);
        b.type = "button";
        b.setAttribute("data-step", back.id);
        b.onclick = () => onOpen(back.id);
        root.appendChild(b);
      }
      root.appendChild(el("span", "step-bar-spacer"));
      if (next) {
        const b = el("button", "step-next", `${next.number}. ${next.title} →`);
        b.type = "button";
        b.setAttribute("data-step", next.id);
        b.onclick = () => onOpen(next.id);
        root.appendChild(b);
      }
    }
    container.textContent = "";
    container.appendChild(root);
    return root;
  },
};
