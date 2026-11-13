/**
 * checks-wording.js — the checks list in a designer's words (session 31,
 * design docs/planning/notehead-first-editor-design.md §8.5, mock-up 4).
 *
 * CNBConfig.validate and CNBConfigExport.validateForExport keep their
 * messages as they are (their tests and the export-blocking rules read
 * them). This module only rewords them for the checks list and the Export
 * button's tooltip, and names the control that fixes each problem:
 *
 *   describe(message, config) → { text, link }
 *     link: null, or { label, target } where target is
 *       { kind: "rule", index }          a rule in config.noteheadRules
 *       { kind: "noteheads", pcs }       the noteheads to select
 *       { kind: "section", section, control? }
 *                                        a section to open (an app
 *                                        data-section name), and a control
 *                                        in it (a CSS selector)
 *
 * A message the table does not know comes back as itself, with no link.
 * Messages only a hand-edited file can produce (the structure of a
 * section, the engine numbers) are deliberately not in the table.
 *
 * Pure: no DOM, no state.
 */
import { CNBMusic } from "../src/cnb-music.js";
import { CNBConfig } from "../src/cnb-config.js";

const SECTION_NAMES = {
  staff: "Staff", noteheads: "Noteheads", pitch: "Pitch", "ledger-lines": "Ledger lines",
  clef: "Clef", "key-signature": "Key signature", advanced: "Advanced", export: "Export",
};

/** "C♯" for pitch class 1. */
function noteName(pc) {
  const l = CNBMusic.pcLabel(((pc % 12) + 12) % 12);
  return l.text + (l.sharp ? "♯" : "");
}

/** "C", "C and D", "C, D and E". */
function listNames(pcs) {
  const names = pcs.map(noteName);
  return names.length < 2 ? names.join("")
    : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

/** The pitch classes whose crotchet resolves to satisfy `test`. */
function pcsWhere(config, test) {
  const pcs = [];
  for (let pc = 0; pc < 12; pc++) {
    try {
      if (test(CNBConfig.resolveNotehead(config, pc, "crotchet", null), pc)) pcs.push(pc);
    } catch (_) { /* an uncovered pitch class has its own message */ }
  }
  return pcs;
}

const pcsUsingShape = (config, ...names) => pcsWhere(config, (r) => names.includes(r.shape));

function ruleLink(config, name) {
  const rules = (config && config.noteheadRules) || [];
  const index = rules.findIndex(r => (r && r.name ? r.name : "(unnamed)") === name);
  return index < 0 ? null : { label: "Show the rule", target: { kind: "rule", index } };
}

function noteheadLink(pcs) {
  return pcs.length === 0 ? null : {
    label: pcs.length === 1 ? "Select the notehead" : "Select the noteheads",
    target: { kind: "noteheads", pcs },
  };
}

function sectionLink(section, control) {
  const target = { kind: "section", section };
  if (control) target.control = control;
  return { label: "Open " + SECTION_NAMES[section], target };
}

const dimension = (field) => (field === "heightSemis" ? "tall" : "wide");

/**
 * The table, in order: the first pattern that matches the whole message
 * wins. build(match, config) returns { text, link }.
 */
const TABLE = [
  // ── Rules → Show the rule ──
  [/^Rule "(.*)" references unknown shape "(.*)"$/, ([, n, s], c) => ({
    text: `“${n}” gives the shape “${s}”, which this notation does not have.`, link: ruleLink(c, n) })],
  [/^Rule "(.*)" sets hollow:true on shape "(.*)" which has no svgHollowPath$/, ([, n, s], c) => ({
    text: `“${n}” makes noteheads hollow, but the “${s}” shape has no hollow drawn inside it.`, link: ruleLink(c, n) })],
  [/^Rule "(.*)" has invalid color hex "(.*)"$/, ([, n, h], c) => ({
    text: `“${n}” gives the colour “${h}”, which is not a colour like #1b9e77.`, link: ruleLink(c, n) })],
  [/^Rule "(.*)" apply\.(heightSemis|widthSemis) must be a finite number greater than 0 \(got .*\)$/, ([, n, f], c) => ({
    text: `“${n}” makes noteheads ${dimension(f)} by an amount that is not a size: it must be a number of semitones above 0.`, link: ruleLink(c, n) })],
  [/^Rule "(.*)" apply\.(heightSemis|widthSemis) is (.*) semitones, outside the usual 0\.25–4$/, ([, n, f, v], c) => ({
    text: `“${n}” makes noteheads ${v} semitones ${dimension(f)}, outside the usual 0.25 to 4, so they may not look right.`, link: ruleLink(c, n) })],
  [/^Key definitions (.*) have the same pitch classes \(.*\) but notehead rules draw them differently: .* draws them all as "(.*)"$/, ([, list, k]) => ({
    text: `The keys ${list.replace(/"([^"]*)"/g, "“$1”")} have the same notes, so LilyPond cannot tell them apart: it engraves them all as “${k}” does.`,
    link: sectionLink("key-signature") })],
  [/^Rule "(.*)" sets an off-key mark \(.*\), which is not drawn in the preview or exported yet$/, ([, n], c) => ({
    text: `“${n}” sets an off-key mark, which is not drawn here or exported yet.`, link: ruleLink(c, n) })],
  [/^Rule "(.*)" apply\.xOffsetStaffSpaces must be a finite number \(got .*\)$/, ([, n], c) => ({
    text: `“${n}” moves noteheads sideways by an amount that is not a number.`, link: ruleLink(c, n) })],
  [/^Rule "(.*)" sets apply\.xOffsetStaffSpaces while pitchAxis is disabled or absent /, ([, n], c) => ({
    text: `“${n}” moves noteheads sideways, but no two notes share a place on this staff, so the move is ignored.`, link: ruleLink(c, n) })],

  // ── Noteheads → Select the notehead(s) ──
  [/^Pitch class (\d+) is not covered by any notehead rule$/, ([, pc]) => ({
    text: `${noteName(+pc)} has no notehead: no rule gives it a look.`, link: noteheadLink([+pc]) })],
  [/^PC (\d+) resolves to hollow but shape "(.*)" has no svgHollowPath$/, ([, pc, s]) => ({
    text: `${noteName(+pc)} is hollow, but its shape, “${s}”, has no hollow drawn inside it, so it shows solid.`, link: noteheadLink([+pc]) })],
  [/^Shape "(.*)" has no lilypondPath \(will use fallback SVG conversion at export\)$/, ([, s], c) => ({
    text: `The “${s}” shape has no LilyPond drawing of its own, so the export traces its SVG outline.`, link: noteheadLink(pcsUsingShape(c, s)) })],
  [/^Shape "(.*)" has no path data \(lilypondPath or svgPath\)$/, ([, s], c) => ({
    text: `The “${s}” shape has no outline, so it cannot be exported.`, link: noteheadLink(pcsUsingShape(c, s)) })],
  [/^Shape "(.*)" has no usable LilyPond name: /, ([, s], c) => ({
    text: `The “${s}” shape's name cannot be used in LilyPond: it needs a name that starts with a Latin letter.`, link: noteheadLink(pcsUsingShape(c, s)) })],
  [/^Shapes "(.*)" and "(.*)" both export as LilyPond name "(.*)" — rename one$/, ([, a, b, sym], c) => ({
    text: `The “${a}” and “${b}” shapes get the same LilyPond name, “${sym}”: one of them needs another name.`, link: noteheadLink(pcsUsingShape(c, a, b)) })],
  [/^Shared axis position .*: pitch classes (\d+) and (\d+) resolve to indistinguishable noteheads /, ([, a, b]) => ({
    text: `${noteName(+a)} and ${noteName(+b)} sit at the same place on the staff and look the same, so a reader cannot tell them apart.`, link: noteheadLink([+a, +b]) })],

  // ── Sections → Open … ──
  [/^Staff pattern must have at least 2 semitone positions \(found (\d+)\)$/, ([, n]) => ({
    text: `The staff needs at least two lines an octave (it has ${n}).`, link: sectionLink("staff") })],
  [/^meta\.fileSuffix must begin with "-" \(got "(.*)"\)$/, ([, s]) => ({
    text: `The file suffix must start with a hyphen, as in “-${s}”.`, link: sectionLink("export", '[data-meta="fileSuffix"] input') })],
  [/^Cannot derive a \.ly filename: /, () => ({
    text: "The exported file has no name: give the notation a name or a file suffix with letters or digits.",
    link: sectionLink("export", '[data-meta="configName"] input') })],
  [/^meta\.notationLabel is empty$/, () => ({
    text: "The notation has no label, so a score that prints it prints nothing.",
    link: sectionLink("export", '[data-meta="notationLabel"] input') })],
  [/^keys\.keySignature\.enabled is true but keys\.enabled is false/, () => ({
    text: "The key signature is on but keys are off, so no signature is drawn.",
    link: sectionLink("key-signature", ".cnb-kse-keys-enable-check") })],
  [/^Key definition "(.*)" has no tonicPc and its name does not begin with a note letter/, ([, k]) => ({
    text: `The key “${k}” has no tonic, and its name does not start with a note letter, so its first note is taken as the tonic.`,
    link: sectionLink("key-signature") })],
  [/^Key signature marks touch in (\d+) of the 105 keys$/, ([, n]) => ({
    text: `Marks touch in ${n} ${+n === 1 ? "key" : "keys"}.`,
    link: sectionLink("key-signature") })],
  [/^Key definition "(.*)" needs a non-empty pitchClasses array/, ([, k]) => ({
    text: `The key “${k}” has no notes.`, link: sectionLink("key-signature") })],
  [/^clef\.enabled is true but clef\.active names no glyph$/, () => ({
    text: "The clef is on but none is chosen, so none is drawn.", link: sectionLink("clef") })],
  [/^clef\.active references unknown clef glyph "(.*)"$/, ([, g]) => ({
    text: `The chosen clef, “${g}”, is not in this notation.`, link: sectionLink("clef") })],
  [/^Clef glyph "(.*)" anchorSemi .* is far outside the typical range/, ([, g]) => ({
    text: `The clef “${g}” is placed far above or below the staff.`, link: sectionLink("clef") })],
  [/^Clef glyph "(.*)" (has no svgPath|is missing positive natural dimensions|has no numeric anchorSemi)/, ([, g]) => ({
    text: `The clef “${g}” cannot be drawn: its imported drawing is incomplete.`, link: sectionLink("clef") })],
  [/^Clef text entry "(.*)" has no text$/, ([, g]) => ({
    text: `The text clef “${g}” has no text.`, link: sectionLink("clef") })],
  [/^Clef text entry "(.*)" needs a positive textHeightSemis$/, ([, g]) => ({
    text: `The text clef “${g}” needs a height above 0.`, link: sectionLink("clef") })],
  [/^pitchAxis map (is not globally non-decreasing|breaks monotonicity across the octave boundary)/, () => ({
    text: "The pitch axis map puts a higher note below a lower one: the notes must go up the staff in order.",
    link: sectionLink("advanced", "#pitch-axis-map") })],
  [/^pitchAxis positions for pc (.*) lie outside \[0, octaveStride\)/, ([, list]) => {
    const pcs = list.split(", ").map(Number);
    return {
      text: `${listNames(pcs)} ${pcs.length === 1 ? "sits" : "sit"} outside ${pcs.length === 1 ? "its" : "their"} octave on the pitch axis map, so octaves overlap.`,
      link: sectionLink("advanced", "#pitch-axis-map"),
    };
  }],
];

export const CNBChecksWording = {
  /**
   * A validation or export message in a designer's words, and the link
   * that fixes it. An unknown message comes back as itself, with no link.
   * @param {string} message  as CNBConfig.validate / validateForExport give it
   * @param {object} config   the config the message is about
   * @returns {{text: string, link: null|{label: string, target: object}}}
   */
  describe(message, config) {
    for (const [pattern, build] of TABLE) {
      const m = pattern.exec(message);
      if (m) return build(m, config || {});
    }
    return { text: message, link: null };
  },
};
