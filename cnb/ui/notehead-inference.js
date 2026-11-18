/**
 * notehead-inference.js — the look table and rule inference (session 23)
 *
 * The notehead-first editor edits one table, a look per pitch class, and
 * writes the rules from it (design docs/planning/notehead-first-editor-design.md
 * §0.4, §5). This module is that model, as pure functions with no DOM:
 *
 *   lookTable(config)        → 12 rows, one per pitch class
 *   inferAttribute(values)   → default, period and groups of one attribute (§5.1)
 *   inferRules(config, table)→ the named rules, plus colour's pattern in words
 *   ruleLines(config, table) → the rule list in words, one line per attribute
 *                              (§5.4, session 27)
 *   writeBack(config, table) → a new config whose rules are written from
 *                              the table (§5.1, §5.3, §5.5)
 *
 * A look row: { pc, shape, hollow, color, heightSemis, widthSemis,
 * xOffsetStaffSpaces }. color is the rules' apply.color, or null for none
 * (drawn black). heightSemis / widthSemis null mean
 * the shape's own size, as in CNBConfig.resolveNotehead.
 *
 * Owned and kept rules. The table is per pitch class only, so it is read
 * from the rules that match every duration and every key and set no
 * offKeyMark (ownsRule). The other rules are kept verbatim by writeBack,
 * above the inferred ones in priority (§5.5): a kept rule already above
 * every inferred rule keeps its priority, a lower one is raised just above
 * them, and their order never changes (session 27).
 *
 * Colour (session 37). A notehead's colour lives on its rules, as its
 * shape and fill do: the Default carries the most common colour when it is
 * not none, and each other colour gets a rule ({color: null} for none).
 *
 * Size (session 39). When no notehead is at its shape's own size, the
 * Default carries the most common size (the general notehead height), and
 * each other size gets a rule. Otherwise the default is the shape's own
 * size, which a rule cannot set, and each set size gets a rule.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBMusic } from "../src/cnb-music.js";
import { CNBColor } from "../src/cnb-color.js";
import { CNBBuiltinShapes } from "./builtin-shapes.js";

const PERIODS = [1, 2, 3, 4, 6];
const ACCIDENTALS = [1, 3, 6, 8, 10];
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const PCS = [...Array(12).keys()];

function pcName(pc) {
  const l = CNBMusic.pcLabel(pc);
  return l.text + (l.sharp ? "♯" : "");
}

/** "C", "C♯ and D", "C, E and G♯". */
function listNames(pcs) {
  return listWords(pcs.map(pcName));
}

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const sizeKey = (row) => `${row.heightSemis}|${row.widthSemis}`;
const OWN_SIZE = "null|null";

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A rule the inference owns: every duration, every key, no offKeyMark. */
function ownsRule(rule) {
  const m = (rule && rule.match) || {};
  const a = (rule && rule.apply) || {};
  return m.durations === "all" && m.keys === "all" && !a.offKeyMark;
}

/** The look table: one row per pitch class, from the owned rules. */
function lookTable(config) {
  const owned = { ...config, noteheadRules: (config.noteheadRules || []).filter(ownsRule) };
  return PCS.map(pc => {
    const r = CNBConfig.resolveNotehead(owned, pc, "crotchet", null);
    return {
      pc,
      shape: r.shape,
      hollow: !!r.hollow,
      color: r.color ?? null,
      heightSemis: r.heightSemis,
      widthSemis: r.widthSemis,
      xOffsetStaffSpaces: r.xOffsetStaffSpaces || 0,
    };
  });
}

/**
 * Infer one attribute from its 12 values (design §5.1). `def` is the most
 * common value, ties broken by C's; `period` the smallest of 1, 2, 3, 4, 6
 * the values repeat at, else 12. Each other value is a group of the pitch
 * classes that have it, with its pattern in words. Pass `def` to fix the
 * default instead (size and side step, see inferRules).
 */
function inferAttribute(values, def) {
  const counts = new Map();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  if (def === undefined) {
    def = values[0];
    for (const [v, n] of counts) if (n > counts.get(def)) def = v;
  }
  const period = PERIODS.find(p => values.every((v, i) => v === values[(i + p) % 12])) ?? 12;
  const groups = [...counts.keys()].filter(v => v !== def).map(value => {
    const pcs = PCS.filter(pc => values[pc] === value);
    let words;
    if (period < 12) words = `every ${period} semitones from ${listNames(pcs.filter(pc => pc < period))}`;
    else if (sameList(pcs, ACCIDENTALS)) words = "on the accidentals";
    else if (sameList(pcs, NATURALS)) words = "on the naturals";
    else words = "on " + listNames(pcs);
    return { value, pcs, words };
  });
  return { def, period, groups, cycle: values.slice(0, period), values };
}

function rule(name, pcs, apply) {
  return { name, priority: 0, match: { pitchClasses: pcs, durations: "all", keys: "all" }, apply };
}

/** "Hollow, every 2 semitones from C♯" or "Hollow on the accidentals". */
function ruleName(label, group) {
  return group.words.startsWith("every") ? `${label}, ${group.words}` : `${label} ${group.words}`;
}

/** "Height 1.5, width 3 semitones" from a size key. */
function sizeWords(key) {
  const [h, w] = key.split("|");
  const parts = [];
  if (h !== "null") parts.push(`height ${h}`);
  if (w !== "null") parts.push(`width ${w}`);
  return capitalise(parts.join(", ")) + " semitones";
}

/** The size apply block for a size key: only the fields that are set. */
function sizeApply(key, table) {
  const row = table.find(r => sizeKey(r) === key);
  const apply = {};
  if (row.heightSemis !== null) apply.heightSemis = row.heightSemis;
  if (row.widthSemis !== null) apply.widthSemis = row.widthSemis;
  return apply;
}

/** "sky blue" for #87ceeb: the nearest colour name, lower case. */
function colourName(hex) {
  return CNBColor.baseColorName(hex).toLowerCase();
}

/**
 * The inferred rules for a look table, in priority order: the Default, then
 * one rule per non-default value of shape, fill, size and side step. The
 * side step defaults to no step, which is never written. Size defaults to
 * the shape's own size whenever a notehead is at it, because a rule cannot
 * set "the shape's own size" (null is not a valid heightSemis); else to its
 * most common value, which the Default carries (session 39). Colour (session 37) defaults to
 * its most common value: the Default carries it unless it is none, and each
 * other colour gets a rule, {color: null} for none. Also returns colour's
 * inference with its words for the rule list.
 */
function inferRules(config, table) {
  const { shape, fill, size, side, colour } = attributes(table);

  const defApply = { shape: shape.def, hollow: fill.def };
  if (colour.def !== null) defApply.color = colour.def;
  if (size.def !== OWN_SIZE) Object.assign(defApply, sizeApply(size.def, table));
  const rules = [rule(`Default (${shape.def}, ${fill.def ? "hollow" : "solid"})`, "all",
    defApply)];
  for (const g of shape.groups) rules.push(rule(ruleName(capitalise(g.value), g), g.pcs, { shape: g.value }));
  for (const g of fill.groups) rules.push(rule(ruleName(g.value ? "Hollow" : "Solid", g), g.pcs, { hollow: g.value }));
  for (const g of size.groups) rules.push(rule(ruleName(sizeWords(g.value), g), g.pcs, sizeApply(g.value, table)));
  for (const g of side.groups) rules.push(rule(ruleName(`Side step ${g.value}`, g), g.pcs, { xOffsetStaffSpaces: g.value }));
  for (const g of colour.groups) {
    rules.push(rule(ruleName(g.value === null ? "No colour" : capitalise(colourName(g.value)), g), g.pcs, { color: g.value }));
  }
  rules.forEach((r, i) => { r.priority = i; });

  const named = colour.cycle.map(hex => (hex === null ? "none" : colourName(hex)));
  colour.words = colour.period === 1 ? `${named[0]} everywhere`
    : colour.period < 12 ? `every ${colour.period} semitones: ${named.join(", ")}`
    : `one per pitch class: ${named.join(", ")}`;

  return { rules, colour };
}

/** Each attribute's inference (§5.1). The side step has a fixed default, and
 *  size one while any notehead is at its shape's own size (see inferRules). */
function attributes(table) {
  return {
    shape: inferAttribute(table.map(r => r.shape)),
    fill: inferAttribute(table.map(r => r.hollow)),
    size: inferAttribute(table.map(sizeKey), table.some(r => sizeKey(r) === OWN_SIZE) ? OWN_SIZE : undefined),
    side: inferAttribute(table.map(r => r.xOffsetStaffSpaces), 0),
    colour: inferAttribute(table.map(r => (r.color === null ? null : r.color.toLowerCase()))),
  };
}

/** "kite down" for kite-down. */
const shapeWords = (name) => name.replace(/-/g, " ");

/**
 * The rule list of design §5.4 (shown on the Noteheads step until session
 * 77; kept for the UAT and a summary of the notation), one line per
 * attribute, in words, always
 * in the order Shape, Fill, Size, Side step, Colour. Each line has its
 * attribute, its words
 * ("Shape: kite down, with kite up every 4 semitones from C♯ and D") and
 * its values, the default first: { value, pcs } with the pitch classes
 * that have it (value: a shape name, true for hollow, { heightSemis,
 * widthSemis }, a side step in staff spaces, or a colour hex or null).
 */
function ruleLines(config, table) {
  const a = attributes(table);
  const { colour } = inferRules(config, table);
  const pcsOf = (inf, value) => PCS.filter(pc => inf.values[pc] === value);
  const line = (attribute, label, inf, defWords, groupWords, value = v => v) => {
    const words = inf.groups.length === 0 ? `${label}: ${defWords} everywhere`
      : `${label}: ${defWords}, with ` + listWords(inf.groups.map(g => `${groupWords(g.value)} ${g.words}`));
    return {
      attribute,
      words,
      values: [inf.def, ...inf.groups.map(g => g.value)].map(v => ({ value: value(v), pcs: pcsOf(inf, v) })),
    };
  };
  const sizeValue = (key) => {
    const [h, w] = key.split("|");
    return { heightSemis: h === "null" ? null : Number(h), widthSemis: w === "null" ? null : Number(w) };
  };
  const sizeDef = a.size.def === OWN_SIZE ? "the shape's own" : sizeWords(a.size.def).toLowerCase();
  const size = line("size", "Size", a.size, sizeDef, k => sizeWords(k).toLowerCase(), sizeValue);
  if (!a.size.groups.length && a.size.def === OWN_SIZE) size.words = "Size: each shape at its own size";
  const lines = [
    line("shape", "Shape", a.shape, shapeWords(a.shape.def), shapeWords),
    line("fill", "Fill", a.fill, a.fill.def ? "hollow" : "solid", v => (v ? "hollow" : "solid")),
    size,
    line("side", "Side step", a.side, "none", v => `${v} staff spaces`),
  ];
  const colourWords = colour.words.replace(": ", ", ");
  lines.push({
    attribute: "colour",
    words: `Colour: ${colourWords}`,
    values: [a.colour.def, ...a.colour.groups.map(g => g.value)].map(v => ({ value: v, pcs: pcsOf(a.colour, v) })),
  });
  return lines;
}

/** "a", "a and b", "a, b and c". */
function listWords(items) {
  return items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

/**
 * The kept rules above the inferred ones (§5.5). A kept rule that already
 * sits above every inferred rule keeps its priority; a lower one is raised
 * to just above them. The kept rules are listed in their priority order
 * (stable), so a raised rule that ties another still applies after the
 * kept rules before it: their order never changes.
 */
function keptAbove(kept, inferredCount) {
  return kept
    .map((r, i) => [r, i])
    .sort(([a, i], [b, j]) => ((a.priority || 0) - (b.priority || 0)) || (i - j))
    .map(([r]) => {
      if ((r.priority || 0) < inferredCount) r.priority = inferredCount;
      return r;
    });
}

/**
 * A new config written from a look table: the inferred rules, the kept
 * rules above them (keptAbove). Nothing else changes.
 */
function writeBack(config, table) {
  const out = CNBConfig.clone(config);
  const { rules } = inferRules(config, table);
  const kept = (out.noteheadRules || []).filter(r => !ownsRule(r));
  out.noteheadRules = [...rules, ...keptAbove(kept, rules.length)];
  return out;
}

// ── The notehead designs (session 75, notehead-duration design §6.1) ──────

const LONGER = ["minim", "semibreve", "breve"];
const BREVE_STYLES = ["double", "tied"];

/** A rule that names keys: set aside by designOf, kept by withDesign. */
const keyed = (rule) => ((rule && rule.match) || {}).keys !== "all";

/** The height most noteheads resolve to (the notehead height, step 1). */
function commonHeight(config, table) {
  const heights = table.map(r => r.heightSemis ?? ((config.shapes || {})[r.shape] || {}).semitoneHeight ?? null);
  return inferAttribute(heights).def;
}

/** A conventional head's size at height h: none at its own height. */
function conventionalSize(name, h) {
  const s = CNBBuiltinShapes.get(name);
  if (h === null || round4(h) === s.semitoneHeight) return {};
  return { heightSemis: round4(h), widthSemis: round4(h * s.naturalWidth / s.naturalHeight) };
}

const round4 = (v) => Math.round(v * 1e4) / 1e4;

function durationRule(name, durations, apply) {
  return { name, priority: 0, match: { pitchClasses: "all", durations, keys: "all" }, apply };
}

/** The rules a design writes for particular durations, at height h. */
function designRules(design, h) {
  if (design === "conventional") {
    return [
      durationRule("Minims (conventional, hollow)", ["minim"], { hollow: true }),
      durationRule("Semibreves (conventional)", ["semibreve"],
        { shape: "conventional-semibreve", hollow: true, ...conventionalSize("conventional-semibreve", h) }),
      durationRule("Breves (conventional)", ["breve"],
        { shape: "conventional-breve", hollow: true, ...conventionalSize("conventional-breve", h) }),
    ];
  }
  if (design === "hollows") return [durationRule("Hollow minims and longer", LONGER, { hollow: true })];
  return [];
}

/** The rules for particular durations, by match and apply, to compare. */
const ruleKey = (rules) => JSON.stringify(rules.map(r => [r.match, r.apply]));

/**
 * Which design a notation's noteheads are (design §6.1): "conventional",
 * "hollows", "repeated", or null, the designer's own. Rules that name keys
 * are set aside first.
 *   conventional — shape mode, no breveStyle but "single"; every notehead
 *     the conventional crotchet, solid, at one size; and exactly the rules
 *     withDesign writes for minims, semibreves and breves at that height.
 *   hollows — shape mode, breveStyle "double" or "tied"; every notehead
 *     solid for every duration; and exactly the one Hollow minims and
 *     longer rule.
 *   repeated — repeat mode, and every rule matches every duration.
 * @param {object} config
 * @returns {"conventional"|"hollows"|"repeated"|null}
 */
function designOf(config) {
  const rules = (config.noteheadRules || []).filter(r => !keyed(r));
  const durations = (config.durations || {});
  if (durations.representationMode === "repeat") {
    return rules.every(r => r.match.durations === "all") ? "repeated" : null;
  }
  const others = rules.filter(r => !ownsRule(r));
  const table = lookTable({ ...config, noteheadRules: rules });
  if (table.some(r => r.hollow)) return null;
  const style = durations.breveStyle;
  if (table.every(r => r.shape === "conventional-crotchet") && new Set(table.map(sizeKey)).size === 1 &&
    (style === undefined || style === "single") &&
    ruleKey(others) === ruleKey(designRules("conventional", commonHeight(config, table)))) {
    return "conventional";
  }
  if (BREVE_STYLES.includes(style) && ruleKey(others) === ruleKey(designRules("hollows"))) return "hollows";
  return null;
}

/**
 * The config with its noteheads made a design (design §6.1, §6.2), keeping
 * what it can of the look table: "conventional" keeps each notehead's
 * colour and the notehead height, its head the conventional crotchet;
 * "hollows" keeps each notehead's shape, colour and size and makes it
 * solid; "repeated" keeps the whole look table. The rules for particular
 * durations are replaced with the design's own (none for "repeated"), and
 * rules that name keys are kept above them. The mode is "shape", or
 * "repeat" for "repeated"; breveStyle is the one given under "hollows"
 * (else the notation's own double or tied, else "tied"), and left out
 * otherwise. The conventional heads are added to the shapes when used.
 * The input is not changed.
 * @param {object} config
 * @param {"conventional"|"hollows"|"repeated"} design
 * @param {"double"|"tied"} [breveStyle]
 * @returns {object}
 */
function withDesign(config, design, breveStyle) {
  let out = CNBConfig.clone(config);
  const keyRules = (out.noteheadRules || []).filter(keyed);
  out.noteheadRules = (out.noteheadRules || []).filter(r => !keyed(r) && ownsRule(r));
  let table = lookTable(out);
  const h = commonHeight(out, table);
  if (design === "conventional") {
    for (const name of ["conventional-crotchet", "conventional-semibreve", "conventional-breve"]) {
      out = CNBBuiltinShapes.withShape(out, name);
    }
    const size = conventionalSize("conventional-crotchet", h);
    table = table.map(r => ({ ...r, shape: "conventional-crotchet", hollow: false,
      heightSemis: size.heightSemis ?? null, widthSemis: size.widthSemis ?? null }));
  } else if (design === "hollows") {
    table = table.map(r => ({ ...r, hollow: false }));
  }
  const inferred = inferRules(out, table).rules;
  out.noteheadRules = [...inferred, ...designRules(design, h), ...keyRules];
  out.noteheadRules.forEach((r, i) => { r.priority = i; });

  const durations = { ...(out.durations || {}), representationMode: design === "repeated" ? "repeat" : "shape" };
  delete durations.breveStyle;
  if (design === "hollows") {
    const own = (config.durations || {}).breveStyle;
    durations.breveStyle = breveStyle || (BREVE_STYLES.includes(own) ? own : "tied");
  }
  out.durations = durations;
  return out;
}

export const CNBNoteheadInference = {
  ownsRule,
  lookTable,
  inferAttribute,
  inferRules,
  ruleLines,
  writeBack,
  designOf,
  withDesign,
};
