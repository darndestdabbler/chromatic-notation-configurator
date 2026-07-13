/**
 * cnb-pitch-axis.js — Module 24: Pitch Axis
 *
 * The axis gatekeeper (design: docs/planning/pitch-axis-design.md §2.1) —
 * the SOLE owner of pitch→grid-position mapping for the optional
 * `pitchAxis` config section (architecture plan §4.13). Semitones remain
 * pitch IDENTITY everywhere; axis positions are GEOMETRY only.
 *
 * Linear degeneracy: when the section is absent, disabled, of unknown
 * kind, or structurally unsound (the renderer-side mirror of validation
 * rules PA-1…PA-4/PA-8 — Module A reports the errors; consumers treat the
 * section as inactive, the set-010 unknown-vocabulary posture), create()
 * returns an inactive axis whose positionOfSemi is the LITERAL identity
 * (`s => s`), stride 12, unitsPerStaffSpace = staff.semitonesPerStaffSpace
 * — every derived function reduces exactly to today's linear arithmetic.
 *
 * Depends on: Module B (cnb-music.js). Module A defines the config
 * section this module reads; there is no code dependency on it.
 *
 * Part of the Chromatic Notation Builder modular architecture.
 */

import { CNBMusic } from "./cnb-music.js";

const KNOWN_KIND = "pitch-class-map-v1";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Structural soundness of an ENABLED pitchAxis section — the activation
 * gate. Mirrors the blocking shape of Module A's PA-1…PA-4 and PA-8
 * (Module A owns the error MESSAGES; this owns the render-time decision):
 * known kind; exactly one entry per pc 0–11 with finite positions;
 * finite positive octaveStride and axisUnitsPerStaffSpace; globally
 * non-decreasing map (PA-8 — the grid's extent math assumes monotonicity,
 * so a rejected map must not activate).
 * @param {object} pa  config.pitchAxis (already known to be a plain object)
 * @returns {number[]|null}  positions-by-pc array when sound, else null
 */
function soundPositions(pa) {
  if (pa.kind !== KNOWN_KIND) return null;
  if (!isFiniteNumber(pa.octaveStride) || pa.octaveStride <= 0) return null;
  if (!isFiniteNumber(pa.axisUnitsPerStaffSpace) || pa.axisUnitsPerStaffSpace <= 0) return null;
  if (!Array.isArray(pa.pitchClasses) || pa.pitchClasses.length !== 12) return null;

  const positions = new Array(12).fill(undefined);
  for (const entry of pa.pitchClasses) {
    if (!isPlainObject(entry)) return null;
    if (!Number.isInteger(entry.pc) || entry.pc < 0 || entry.pc > 11) return null;
    if (!isFiniteNumber(entry.position)) return null;
    if (positions[entry.pc] !== undefined) return null;   // duplicate pc
    positions[entry.pc] = entry.position;
  }
  if (positions.some(p => p === undefined)) return null;   // gap

  // PA-8: non-decreasing in pc order, and across the octave boundary
  for (let pc = 1; pc < 12; pc++) {
    if (positions[pc] < positions[pc - 1]) return null;
  }
  if (positions[11] > positions[0] + pa.octaveStride) return null;

  return positions;
}

export const CNBPitchAxis = {

  /**
   * Create an axis context from a config.
   *
   * @param {object} config  Full CNB config (reads config.pitchAxis,
   *                         config.staff.semitonesPerStaffSpace for the
   *                         degenerate unit contract)
   * @returns {object} axis
   */
  create(config) {
    const pa = isPlainObject(config?.pitchAxis) ? config.pitchAxis : null;
    const positions = pa && pa.enabled === true ? soundPositions(pa) : null;
    const enabled = positions !== null;

    const octaveStride = enabled ? pa.octaveStride : 12;
    const unitsPerStaffSpace = enabled
      ? pa.axisUnitsPerStaffSpace
      : (config?.staff || {}).semitonesPerStaffSpace;

    /**
     * Axis position of a semitone (design §1.1):
     *   positionOfSemi(s) = pitchClasses[pc(s)].position + octave(s) × octaveStride
     * Fractional input interpolates linearly between the two adjacent
     * integer semitones' positions (shared positions make the segment
     * flat — well-defined everywhere).
     * Inactive axis: the literal identity, exact by construction.
     * @param {number} semi
     * @returns {number}
     */
    const positionOfSemi = enabled
      ? function positionOfSemi(semi) {
          if (Number.isInteger(semi)) {
            return positions[CNBMusic.pitchClass(semi)] + CNBMusic.octave(semi) * octaveStride;
          }
          const lo = Math.floor(semi);
          const frac = semi - lo;
          const loPos = positions[CNBMusic.pitchClass(lo)] + CNBMusic.octave(lo) * octaveStride;
          const hiPos = positions[CNBMusic.pitchClass(lo + 1)] + CNBMusic.octave(lo + 1) * octaveStride;
          return loPos + frac * (hiPos - loPos);
        }
      : function positionOfSemi(semi) {
          return semi;
        };

    /**
     * Axis octave region: Math.floor(positionOfSemi(semi) / octaveStride).
     * On the inactive axis this is Math.floor(semi / 12) — exactly
     * CNBMusic.ledgerOctaveRegion.
     * @param {number} semi
     * @returns {number}
     */
    function regionOfSemi(semi) {
      return Math.floor(positionOfSemi(semi) / octaveStride);
    }

    /**
     * Geometric distance between two semitones, in axis units.
     * Inactive axis: |a − b|.
     * @param {number} aSemi
     * @param {number} bSemi
     * @returns {number}
     */
    function distance(aSemi, bSemi) {
      return Math.abs(positionOfSemi(aSemi) - positionOfSemi(bSemi));
    }

    /**
     * The many-to-one inverse — returns CANDIDATES, never a fake scalar.
     * Every integer semitone in [minSemi, maxSemi] whose mapped position
     * equals `position` EXACTLY (the map's declared values; no float
     * tolerance): 0 or 1 entries on a 1:1 axis, 2 on a shared position.
     * @param {number} position
     * @param {{ minSemi: number, maxSemi: number }} range
     * @returns {number[]}  ascending
     */
    function semisAtPosition(position, { minSemi, maxSemi }) {
      const result = [];
      for (let s = Math.ceil(minSemi); s <= Math.floor(maxSemi); s++) {
        if (positionOfSemi(s) === position) result.push(s);
      }
      return result;
    }

    /**
     * Candidates at the declared axis position nearest to a grid Y.
     * Uses the grid's inverse (yToAxis in axis contexts, yToSemi in
     * linear contexts) to get the target axis coordinate, then picks the
     * nearest DECLARED position among the integer semitones in the
     * grid's range (ties resolve upward — the higher position — matching
     * the platform's tie-upward precedent). UI hit-testing that needs
     * one answer must choose from the candidates itself.
     * @param {number} y
     * @param {object} gridContext  From CNBGrid.create()
     * @returns {number[]}
     */
    function nearestSemisForY(y, gridContext) {
      const target = typeof gridContext.yToAxis === "function"
        ? gridContext.yToAxis(y)
        : gridContext.yToSemi(y);
      const range = { minSemi: gridContext.minSemi, maxSemi: gridContext.maxSemi };

      let best = null;
      for (let s = Math.ceil(range.minSemi); s <= Math.floor(range.maxSemi); s++) {
        const pos = positionOfSemi(s);
        const d = Math.abs(pos - target);
        if (best === null || d < best.d || (d === best.d && pos > best.pos)) {
          best = { pos, d };
        }
      }
      if (best === null) return [];
      return semisAtPosition(best.pos, range);
    }

    return {
      enabled,
      octaveStride,
      unitsPerStaffSpace,
      positionOfSemi,
      regionOfSemi,
      distance,
      semisAtPosition,
      nearestSemisForY,
    };
  },

};
