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
 *   writeBack(config, table) → a new config whose rules and palette are
 *                              written from the table (§5.1, §5.3, §5.5)
 *
 * A look row: { pc, shape, hollow, color, heightSemis, widthSemis,
 * xOffsetStaffSpaces }. color is the primary colour (the rule's apply.color,
 * else palette.colors), or null for none. heightSemis / widthSemis null mean
 * the shape's own size, as in CNBConfig.resolveNotehead.
 *
 * Owned and kept rules. The table is per pitch class only, so it is read
 * from the rules that match every duration and every key and set no
 * offKeyMark (ownsRule). The other rules are kept verbatim by writeBack,
 * above the inferred ones in priority (§5.5): a kept rule already above
 * every inferred rule keeps its priority, a lower one is raised just above
 * them, and their order never changes (session 27).
 *
 * Colour (§5.3, session 27). A colour taken back to none removes the pitch
 * class's palette.colors entry and its palette.cbSafeColors twin, so it
 * draws and exports black. A changed colour takes the twin an unchanged
 * pitch class of that colour already has, else its stale twin is dropped.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBMusic } from "../src/cnb-music.js";
import { CNBPaletteEditor } from "./palette-editor.js";

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

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A rule the inference owns: every duration, every key, no offKeyMark. */
function ownsRule(rule) {
  const m = (rule && rule.match) || {};
  const a = (rule && rule.apply) || {};
  return m.durations === "all" && m.keys === "all" && !a.offKeyMark;
}

/** The look table: one row per pitch class, from the owned rules and the palette. */
function lookTable(config) {
  const owned = { ...config, noteheadRules: (config.noteheadRules || []).filter(ownsRule) };
  const colors = (config.palette && config.palette.colors) || [];
  return PCS.map(pc => {
    const r = CNBConfig.resolveNotehead(owned, pc, "crotchet", null);
    const entry = colors.find(c => c.pc === pc);
    return {
      pc,
      shape: r.shape,
      hollow: !!r.hollow,
      color: r.color ?? (entry ? entry.hex : null),
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

function colourName(config, hex) {
  const entry = ((config.palette && config.palette.colors) || [])
    .find(c => c.hex.toLowerCase() === hex);
  return (entry && entry.name ? entry.name : CNBPaletteEditor.baseColorName(hex)).toLowerCase();
}

/**
 * The inferred rules for a look table, in priority order: the Default, then
 * one rule per non-default value of shape, fill, size and side step. Size
 * and side step default to the shape's own size and to no step, because a
 * rule cannot set "the shape's own size" (null is not a valid heightSemis)
 * and a zero side step is never written. Also returns colour's inference
 * with its words for the rule list; colour itself goes to the palette.
 */
function inferRules(config, table) {
  const { shape, fill, size, side } = attributes(table);

  const rules = [rule(`Default (${shape.def}, ${fill.def ? "hollow" : "solid"})`, "all",
    { shape: shape.def, hollow: fill.def })];
  for (const g of shape.groups) rules.push(rule(ruleName(capitalise(g.value), g), g.pcs, { shape: g.value }));
  for (const g of fill.groups) rules.push(rule(ruleName(g.value ? "Hollow" : "Solid", g), g.pcs, { hollow: g.value }));
  for (const g of size.groups) rules.push(rule(ruleName(sizeWords(g.value), g), g.pcs, sizeApply(g.value, table)));
  for (const g of side.groups) rules.push(rule(ruleName(`Side step ${g.value}`, g), g.pcs, { xOffsetStaffSpaces: g.value }));
  rules.forEach((r, i) => { r.priority = i; });

  const colour = attributes(table).colour;
  const named = colour.cycle.map(hex => (hex === null ? "none" : colourName(config, hex)));
  colour.words = colour.period === 1 ? `${named[0]} everywhere`
    : colour.period < 12 ? `every ${colour.period} semitones: ${named.join(", ")}`
    : `one per pitch class: ${named.join(", ")}`;

  return { rules, colour };
}

/** Each attribute's inference (§5.1). Size and side step have fixed defaults (see inferRules). */
function attributes(table) {
  return {
    shape: inferAttribute(table.map(r => r.shape)),
    fill: inferAttribute(table.map(r => r.hollow)),
    size: inferAttribute(table.map(sizeKey), "null|null"),
    side: inferAttribute(table.map(r => r.xOffsetStaffSpaces), 0),
    colour: inferAttribute(table.map(r => (r.color === null ? null : r.color.toLowerCase()))),
  };
}

/** "kite down" for kite-down. */
const shapeWords = (name) => name.replace(/-/g, " ");

/**
 * The rule list of design §5.4, one line per attribute, in words: Shape and
 * Fill always, Size and Side step only when some notehead differs from the
 * default, and Colour always. Each line has its attribute, its words
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
  const lines = [
    line("shape", "Shape", a.shape, shapeWords(a.shape.def), shapeWords),
    line("fill", "Fill", a.fill, a.fill.def ? "hollow" : "solid", v => (v ? "hollow" : "solid")),
  ];
  if (a.size.groups.length) {
    lines.push(line("size", "Size", a.size, "the shape's own", k => sizeWords(k).toLowerCase(), sizeValue));
  }
  if (a.side.groups.length) {
    lines.push(line("side", "Side step", a.side, "none", v => `${v} staff spaces`));
  }
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

const sameHex = (a, b) => a.toLowerCase() === b.toLowerCase();

/**
 * palette.colors and palette.cbSafeColors written from the table. An
 * unchanged entry is kept as it is, in its order. A colour taken back to
 * none (null, drawn black) removes the pitch class's entry and its twin. A
 * changed colour takes the twin that an unchanged pitch class of the same
 * colour already has, else its stale twin is dropped.
 */
function writePalette(palette, table) {
  const colors = (palette.colors || []).slice();
  const cbSafe = (palette.cbSafeColors || []).slice();
  const entryOf = (list, pc) => list.findIndex(c => c.pc === pc);
  const changed = table.filter(row => {
    const i = entryOf(colors, row.pc);
    return row.color === null ? i >= 0 : !(i >= 0 && sameHex(colors[i].hex, row.color));
  });
  const twinOf = (hex) => {
    for (const row of table) {
      if (changed.includes(row) || row.color === null || !sameHex(row.color, hex)) continue;
      const t = cbSafe[entryOf(cbSafe, row.pc)];
      if (t) return t;
    }
    return null;
  };
  const twins = new Map(changed.map(row => [row.pc, row.color === null ? null : twinOf(row.color)]));
  for (const row of changed) {
    const i = entryOf(colors, row.pc);
    if (row.color === null) {
      colors.splice(i, 1);
    } else {
      const entry = { pc: row.pc, hex: row.color, name: CNBPaletteEditor.baseColorName(row.color) };
      if (i >= 0) colors[i] = { ...colors[i], ...entry };
      else colors.push(entry);
    }
    const j = entryOf(cbSafe, row.pc);
    const twin = twins.get(row.pc);
    if (twin) {
      const entry = { ...twin, pc: row.pc };
      if (j >= 0) cbSafe[j] = entry;
      else cbSafe.push(entry);
    } else if (j >= 0) {
      cbSafe.splice(j, 1);
    }
  }
  const out = { ...palette, colors };
  if (palette.cbSafeColors || cbSafe.length) out.cbSafeColors = cbSafe;
  return out;
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
 * rules above them (keptAbove), and colour in the palette (writePalette).
 * Nothing else changes.
 */
function writeBack(config, table) {
  const out = CNBConfig.clone(config);
  const { rules } = inferRules(config, table);
  const kept = (out.noteheadRules || []).filter(r => !ownsRule(r));
  out.noteheadRules = [...rules, ...keptAbove(kept, rules.length)];
  if (out.palette || table.some(r => r.color !== null)) {
    out.palette = writePalette(out.palette || { colors: [] }, table);
  }
  return out;
}

export const CNBNoteheadInference = {
  ownsRule,
  lookTable,
  inferAttribute,
  inferRules,
  ruleLines,
  writeBack,
};
