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
 * above the inferred ones in priority (§5.5).
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
  const n = pcs.map(pcName);
  return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
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
  return { def, period, groups, cycle: values.slice(0, period) };
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
  const shape = inferAttribute(table.map(r => r.shape));
  const fill = inferAttribute(table.map(r => r.hollow));
  const size = inferAttribute(table.map(sizeKey), "null|null");
  const side = inferAttribute(table.map(r => r.xOffsetStaffSpaces), 0);

  const rules = [rule(`Default (${shape.def}, ${fill.def ? "hollow" : "solid"})`, "all",
    { shape: shape.def, hollow: fill.def })];
  for (const g of shape.groups) rules.push(rule(ruleName(capitalise(g.value), g), g.pcs, { shape: g.value }));
  for (const g of fill.groups) rules.push(rule(ruleName(g.value ? "Hollow" : "Solid", g), g.pcs, { hollow: g.value }));
  for (const g of size.groups) rules.push(rule(ruleName(sizeWords(g.value), g), g.pcs, sizeApply(g.value, table)));
  for (const g of side.groups) rules.push(rule(ruleName(`Side step ${g.value}`, g), g.pcs, { xOffsetStaffSpaces: g.value }));
  rules.forEach((r, i) => { r.priority = i; });

  const colour = inferAttribute(table.map(r => (r.color === null ? null : r.color.toLowerCase())));
  const named = colour.cycle.map(hex => (hex === null ? "none" : colourName(config, hex)));
  colour.words = colour.period === 1 ? `${named[0]} everywhere`
    : colour.period < 12 ? `every ${colour.period} semitones: ${named.join(", ")}`
    : `one per pitch class: ${named.join(", ")}`;

  return { rules, colour };
}

/** palette.colors written from the table: unchanged entries kept as they are, in order. */
function writeColors(colors, table) {
  const out = colors.slice();
  for (const row of table) {
    if (row.color === null) continue;
    const i = out.findIndex(c => c.pc === row.pc);
    if (i >= 0 && out[i].hex.toLowerCase() === row.color.toLowerCase()) continue;
    const entry = { pc: row.pc, hex: row.color, name: CNBPaletteEditor.baseColorName(row.color) };
    if (i >= 0) out[i] = { ...out[i], ...entry };
    else out.push(entry);
  }
  return out;
}

/**
 * A new config written from a look table: the inferred rules, the kept
 * rules above them (priorities raised only when needed, order unchanged),
 * and colour in palette.colors. Nothing else changes.
 */
function writeBack(config, table) {
  const out = CNBConfig.clone(config);
  const { rules } = inferRules(config, table);
  const kept = (out.noteheadRules || []).filter(r => !ownsRule(r));
  const lowest = Math.min(...kept.map(r => r.priority || 0));
  const lift = kept.length ? Math.max(0, rules.length - lowest) : 0;
  for (const r of kept) r.priority = (r.priority || 0) + lift;
  out.noteheadRules = [...rules, ...kept];
  if (out.palette || table.some(r => r.color !== null)) {
    const palette = out.palette || { colors: [] };
    out.palette = { ...palette, colors: writeColors(palette.colors || [], table) };
  }
  return out;
}

export const CNBNoteheadInference = {
  ownsRule,
  lookTable,
  inferAttribute,
  inferRules,
  writeBack,
};
