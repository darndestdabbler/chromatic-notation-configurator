/**
 * cnb-ledger-set.js — Module 5: Ledger Set
 *
 * Evaluates ledger display rules (octave-aware proximity/override algorithm)
 * for a set of noteheads and renders the resulting ledger lines.
 *
 * Key design points (Architecture Plan §5, Module 5):
 * - No "outside staff" hard gate: ledgers inside staff gaps (e.g. semi 12 in
 *   a 3-6-9 pattern) can be shown when a notehead triggers them.
 * - Octave awareness: a ledger def only responds to noteheads in the same
 *   octave region (a C ledger at semi 0 is never triggered by a C at semi 24).
 * - The staff is periodic. render() expands the staff pattern one octave
 *   beyond the grid range so that viewport cropping does not change ledger
 *   decisions near the range edges.
 *
 * Dependencies: Module A (config), Module B (music), Module 4 (ledger line),
 * Module 1 (grid context is passed in). Module 3 (staff) is deliberately NOT
 * imported; the pattern expansion needed here is computed locally.
 */

import { CNBConfig } from "./cnb-config.js";
import { CNBMusic } from "./cnb-music.js";
import { CNBLedgerLine } from "./cnb-ledger-line.js";

/** Expand config.staff.semitonePattern to absolute positions within a range. */
function expandStaffPositions(config, minSemi, maxSemi) {
  const pattern = (config.staff && config.staff.semitonePattern) || [];
  const result = [];
  const minOct = Math.floor(minSemi / 12) - 1;
  const maxOct = Math.floor(maxSemi / 12) + 1;
  for (let oct = minOct; oct <= maxOct; oct++) {
    for (const s of pattern) {
      const abs = s + oct * 12;
      if (abs >= minSemi && abs <= maxSemi) result.push(abs);
    }
  }
  return result.sort((a, b) => a - b);
}

/** Default ledger width: notehead width of the first shape × widthMultiplier. */
function defaultLedgerWidth(config, pxPerSemi) {
  const defaults = (config.ledgers && config.ledgers.lineDefaults) || {};
  const multiplier = defaults.widthMultiplier ?? 2.0;
  const names = Object.keys(config.shapes || {});
  if (names.length === 0) return 2 * pxPerSemi * multiplier;
  const shape = config.shapes[names[0]];
  const scaleFactor = (shape.semitoneHeight * pxPerSemi) / shape.naturalHeight;
  return shape.naturalWidth * scaleFactor * multiplier;
}

export const CNBLedgerSet = {

  /**
   * Expand ledger templates into absolute-semitone ledger defs for every
   * octave overlapping the given range. Positions outside [minSemi, maxSemi]
   * are dropped. Proximity-mode templates are dropped entirely when
   * config.ledgers.proximityRule is false.
   *
   * @param {object} config
   * @param {{minSemi:number, maxSemi:number}} range
   * @returns {Array<{semi:number, triggerPCs:number[], triggerMode:string, overrides:object}>}
   */
  buildDefs(config, { minSemi, maxSemi }) {
    const ledgers = config.ledgers || {};
    const templates = ledgers.templates || [];
    const lineOverrides = ledgers.lineOverrides || {};
    const proximityEnabled = ledgers.proximityRule !== false;

    const defs = [];
    const minOct = Math.floor(minSemi / 12);
    const maxOct = Math.floor(maxSemi / 12);
    for (let oct = minOct; oct <= maxOct; oct++) {
      for (const t of templates) {
        if (t.triggerMode === "proximity" && !proximityEnabled) continue;
        const semi = t.semiWithinOctave + oct * 12;
        if (semi < minSemi || semi > maxSemi) continue;
        defs.push({
          semi,
          triggerPCs: (t.triggerPCs || []).slice(),
          triggerMode: t.triggerMode,
          overrides: lineOverrides[String(t.semiWithinOctave)] || {},
        });
      }
    }
    return defs.sort((a, b) => a.semi - b.semi);
  },

  /**
   * True when the ledger lies on the path connecting the note to the staff:
   * - note below ledger → a staff line must exist above the ledger
   * - note above ledger → a staff line must exist below the ledger
   * - note at the ledger → show unless the note sits on a staff line
   *
   * The staff is conceptually periodic, so callers should pass staff
   * positions expanded beyond the note range (render() does this).
   *
   * @param {number} noteSemi
   * @param {number} ledgerSemi
   * @param {number[]} staffPositions
   * @returns {boolean}
   */
  isBetweenNoteAndStaff(noteSemi, ledgerSemi, staffPositions) {
    if (noteSemi === ledgerSemi) return !staffPositions.includes(ledgerSemi);
    if (noteSemi < ledgerSemi) return staffPositions.some(s => s > ledgerSemi);
    return staffPositions.some(s => s < ledgerSemi);
  },

  /**
   * Determine which ledger positions to display for a set of noteheads.
   *
   * Override mode: show when the note's pitch class is in the def's
   * triggerPCs. Proximity mode: show when the note is strictly closer to the
   * ledger than to any staff line. Both modes additionally require
   * isBetweenNoteAndStaff, and both are octave-aware: a def only responds to
   * notes in its own octave region.
   *
   * @param {number[]} noteSemitones
   * @param {Array<{semi:number, triggerPCs:number[], triggerMode:string}>} ledgerDefs
   * @param {number[]} staffPositions
   * @returns {number[]} sorted, de-duplicated ledger semitone positions
   */
  resolve(noteSemitones, ledgerDefs, staffPositions) {
    const result = new Set();

    for (const noteSemi of noteSemitones) {
      const pc = CNBMusic.pitchClass(noteSemi);
      const noteRegion = CNBMusic.ledgerOctaveRegion(noteSemi);

      for (const ld of ledgerDefs) {
        if (CNBMusic.ledgerOctaveRegion(ld.semi) !== noteRegion) continue;

        if (ld.triggerMode === "override") {
          if (
            ld.triggerPCs.includes(pc) &&
            CNBLedgerSet.isBetweenNoteAndStaff(noteSemi, ld.semi, staffPositions)
          ) {
            result.add(ld.semi);
          }
        } else if (ld.triggerMode === "proximity") {
          let nearestStaff = Infinity;
          for (const s of staffPositions) {
            const d = Math.abs(noteSemi - s);
            if (d < nearestStaff) nearestStaff = d;
          }
          if (
            Math.abs(noteSemi - ld.semi) < nearestStaff &&
            CNBLedgerSet.isBetweenNoteAndStaff(noteSemi, ld.semi, staffPositions)
          ) {
            result.add(ld.semi);
          }
        }
      }
    }

    return [...result].sort((a, b) => a - b);
  },

  /**
   * Resolve and render the ledger lines for a set of noteheads into a group.
   *
   * @param {SVGElement} svgParent
   * @param {object} gridContext   From CNBGrid.create()
   * @param {object} config
   * @param {number[]} noteSemitones
   * @param {{centerX?:number, width?:number}} [opts]
   *        width defaults to first-shape notehead width × widthMultiplier;
   *        centerX defaults to column.paddingH + width/2 (a column layout).
   * @returns {SVGGElement}
   */
  render(svgParent, gridContext, config, noteSemitones, opts = {}) {
    const defs = CNBLedgerSet.buildDefs(config, {
      minSemi: gridContext.minSemi,
      maxSemi: gridContext.maxSemi,
    });
    const staffPositions = expandStaffPositions(
      config,
      gridContext.minSemi - 12,
      gridContext.maxSemi + 12
    );
    const semis = CNBLedgerSet.resolve(noteSemitones, defs, staffPositions);

    const lineDefaults = (config.ledgers && config.ledgers.lineDefaults) || {};
    const width = opts.width ?? defaultLedgerWidth(config, gridContext.pxPerSemi);
    const paddingH = config.display?.column?.paddingH ?? 16;
    const centerX = opts.centerX ?? paddingH + width / 2;

    const overridesBySemi = new Map(defs.map(d => [d.semi, d.overrides]));

    const NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-ledger-set");

    for (const semi of semis) {
      const props = Object.assign({}, lineDefaults, overridesBySemi.get(semi) || {});
      CNBLedgerLine.render(g, {
        y: gridContext.semiToY(semi),
        centerX,
        width,
        thickness: CNBConfig.pctToPx(props.thicknessPct, gridContext.pxPerSemi),
        color: props.color,
        style: props.style,
        roundedEnds: props.roundedEnds,
      });
    }

    svgParent.appendChild(g);
    return g;
  },

};
