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
 * - Set 014 (pitch axis): with an enabled gridContext.axis, resolve/render
 *   run the same algorithm in axis coordinates and key lines by axis
 *   position (design §2.4); otherwise the literal pre-set-014 arithmetic.
 *
 * - The lines are drawn as the engine draws them (session 34): LilyPond's
 *   0.2 staff spaces thick, 1.5 notehead widths long, black, rounded ends.
 *
 * Dependencies: Module B (music), Module 4 (ledger line), Module 3 (staff:
 * only its staff-space size; the pattern expansion needed here is computed
 * locally), Module 1 (grid context is passed in).
 */

import { CNBMusic } from "./cnb-music.js";
import { CNBLedgerLine } from "./cnb-ledger-line.js";
import { CNBStaff } from "./cnb-staff.js";

// LilyPond's ledger line, which the engine leaves at its defaults (session
// 34, measured against the engine): 0.2 staff spaces thick (line thickness
// plus a tenth of a staff space), and as long as the notehead widened by a
// quarter of its width on each side (length-fraction 0.25).
const LEDGER_THICKNESS = 0.2;
const LEDGER_LENGTH = 1.5;

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

/** Default ledger width: the ledger for the first shape's notehead. */
function defaultLedgerWidth(config, pxPerSemi) {
  const names = Object.keys(config.shapes || {});
  if (names.length === 0) return CNBLedgerSet.width(2 * pxPerSemi);
  const shape = config.shapes[names[0]];
  const scaleFactor = (shape.semitoneHeight * pxPerSemi) / shape.naturalHeight;
  return CNBLedgerSet.width(shape.naturalWidth * scaleFactor);
}

/**
 * CNBLedgerSet.resolve on an enabled axis (design §2.4): the linear
 * algorithm with positions in place of semitones. Returns one
 * representative semitone (the lowest shown def) per axis position.
 */
function resolveOnAxis(noteSemitones, ledgerDefs, staffPositions, axis) {
  const staffPos = [...new Set(staffPositions.map(s => axis.positionOfSemi(s)))];
  const byPos = new Map();

  for (const noteSemi of noteSemitones) {
    const pc = CNBMusic.pitchClass(noteSemi);
    const notePos = axis.positionOfSemi(noteSemi);
    const noteRegion = axis.regionOfSemi(noteSemi);
    let nearestStaff = Infinity;
    for (const s of staffPos) {
      const d = Math.abs(notePos - s);
      if (d < nearestStaff) nearestStaff = d;
    }

    for (const ld of ledgerDefs) {
      if (axis.regionOfSemi(ld.semi) !== noteRegion) continue;
      const ledgerPos = axis.positionOfSemi(ld.semi);
      const between = CNBLedgerSet.isBetweenNoteAndStaff(notePos, ledgerPos, staffPos);

      let show = false;
      if (ld.triggerMode === "override") {
        show = ld.triggerPCs.includes(pc) && between;
      } else if (ld.triggerMode === "proximity") {
        // Strict `<` is load-bearing: shared positions and staff
        // coincidences produce exact ties, which must not add ledgers.
        show = Math.abs(notePos - ledgerPos) < nearestStaff && between;
      }
      if (show && !(byPos.has(ledgerPos) && byPos.get(ledgerPos) <= ld.semi)) {
        byPos.set(ledgerPos, ld.semi);
      }
    }
  }

  return [...byPos.values()].sort((a, b) => a - b);
}

export const CNBLedgerSet = {

  /**
   * The length of LilyPond's ledger line for a notehead (in repeat mode,
   * the group of repeated heads) of the given width, in the same units.
   * @param {number} headWidth
   * @returns {number}
   */
  width(headWidth) {
    return headWidth * LEDGER_LENGTH;
  },

  /**
   * Expand ledger templates into absolute-semitone ledger defs for every
   * octave overlapping the given range. Positions outside [minSemi, maxSemi]
   * are dropped. Proximity-mode templates are dropped entirely when
   * config.ledgers.proximityRule is false.
   *
   * @param {object} config
   * @param {{minSemi:number, maxSemi:number}} range
   * @returns {Array<{semi:number, triggerPCs:number[], triggerMode:string}>}
   */
  buildDefs(config, { minSemi, maxSemi }) {
    const ledgers = config.ledgers || {};
    const templates = ledgers.templates || [];
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
   * Axis mode (set 014, design §2.4): with an enabled axis, every input is
   * converted to axis positions at the top and the SAME predicates run in
   * axis coordinates — region via axis.regionOfSemi, the strict `<`
   * proximity rule, betweenness against the deduplicated staff positions.
   * Defs collapsing onto one axis position yield ONE result: the lowest
   * shown def semitone at that position stands for the line.
   *
   * @param {number[]} noteSemitones
   * @param {Array<{semi:number, triggerPCs:number[], triggerMode:string}>} ledgerDefs
   * @param {number[]} staffPositions
   * @param {object} [axis]  gridContext.axis; absent/disabled = linear
   * @returns {number[]} sorted, de-duplicated ledger semitone positions
   */
  resolve(noteSemitones, ledgerDefs, staffPositions, axis) {
    if (axis && axis.enabled) return resolveOnAxis(noteSemitones, ledgerDefs, staffPositions, axis);

    // Linear path — the literal pre-set-014 arithmetic.
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
   * The ledger semitones the preview draws for a set of noteheads on a grid
   * spanning `range`: the templates expanded over the range, the staff one
   * octave beyond it (the staff is periodic, so cropping must not change a
   * decision near the edge), resolved. render() draws these; the LilyPond
   * export writes them for every pitch (session 34).
   *
   * @param {object} config
   * @param {number[]} noteSemitones
   * @param {{minSemi:number, maxSemi:number}} range
   * @param {object} [axis]  gridContext.axis; absent/disabled = linear
   * @returns {number[]} sorted ledger semitones
   */
  ledgersFor(config, noteSemitones, { minSemi, maxSemi }, axis) {
    const defs = CNBLedgerSet.buildDefs(config, { minSemi, maxSemi });
    const staffPositions = expandStaffPositions(config, minSemi - 12, maxSemi + 12);
    return CNBLedgerSet.resolve(noteSemitones, defs, staffPositions, axis && axis.enabled ? axis : null);
  },

  /**
   * Resolve and render the ledger lines for a set of noteheads into a group.
   *
   * @param {SVGElement} svgParent
   * @param {object} gridContext   From CNBGrid.create()
   * @param {object} config
   * @param {number[]} noteSemitones
   * @param {{centerX?:number, width?:number}} [opts]
   *        width defaults to the ledger for the first shape's notehead
   *        (CNBLedgerSet.width); centerX defaults to column.paddingH +
   *        width/2 (a column layout).
   * @returns {SVGGElement}
   */
  render(svgParent, gridContext, config, noteSemitones, opts = {}) {
    const semis = CNBLedgerSet.ledgersFor(config, noteSemitones,
      { minSemi: gridContext.minSemi, maxSemi: gridContext.maxSemi }, gridContext.axis);

    const width = opts.width ?? defaultLedgerWidth(config, gridContext.pxPerSemi);
    const paddingH = config.display?.column?.paddingH ?? 16;
    const centerX = opts.centerX ?? paddingH + width / 2;
    const thickness = LEDGER_THICKNESS * CNBStaff.staffSpacePx(config, gridContext);

    const NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "cnb-ledger-set");

    for (const semi of semis) {
      CNBLedgerLine.render(g, { y: gridContext.semiToY(semi), centerX, width, thickness });
    }

    svgParent.appendChild(g);
    return g;
  },

};
