/**
 * cnb-card.js — Module 9: Octave Chord Card
 *
 * Composes ledger set (Module 5), double notehead (Module 7), and stem
 * (Module 8) into a single octave-chord column:
 *
 *   div.pc-col
 *   ├── div.label-top        (material-card pitch label)
 *   ├── svg.note-slice       (ledger lines, stem, noteheads)
 *   └── div.label-bottom     (material-card pitch label)
 *
 * Staff lines are deliberately NOT drawn here — Module 10 (collection) draws
 * them once, in a background SVG spanning all columns, offset by the grid's
 * topLabelHeight so its coordinates line up with each card's note-slice.
 *
 * Example data is (pc, duration, key): pc may be 0–12 (12 = the upper C of a
 * chromatic row); the card renders the octave chord at semitones pc and
 * pc + 12.
 *
 * Set 014 (pitch axis): on an axis grid the resolved xOffsetStaffSpaces
 * shifts both noteheads, their ledgers and the stem by
 * xOffsetStaffSpaces × axis.unitsPerStaffSpace × pxPerSemi, the column
 * widens by that |offset|, and stem direction reads the axis (design
 * §2.3/§3.3). On a linear grid the offset is ignored (axis-gated, §3.2).
 *
 * Session 18 (repeat mode): with durations.representationMode "repeat" the
 * card draws each duration's notehead as the engine engraves it
 * (cnb:build-duration-stencil, engine cnb/stencils.ly): minim ×2, semibreve
 * and breve ×4, each copy edge to edge with engine.multinotePadding staff
 * spaces between them, the group centred on the head position. The stem
 * attaches at the anchor's relative position across the whole group (as
 * LilyPond's stem-attachment does), and the ledgers and the column widen
 * by the group's extra width. One head (shape mode, crotchets) takes the
 * existing code path unchanged.
 *
 * Session 44 (the breve as tied semibreves, engine session 25): in repeat
 * mode a breve draws as two semibreve groups of 4 heads, 1 staff space
 * apart, with a tie on each notehead of the octave pair: LilyPond's
 * make-tie-stencil (CNBCard.tiePath), drawn black whatever the notehead's
 * colour, as the engine engraves it. The ledgers and the column follow the
 * whole width. Session 46 (engine session 28): the tie runs below the
 * heads, from the centre of the first head to the centre of the last, its
 * ends at the heads' bottom, curving down (CNBCard.tieBottom says how low).
 *
 * Session 58 (engine session 39): the copies overlap by
 * durations.repeatOverlap, a share of the head's own width (1/3 by
 * default), each copy (1 − repeatOverlap) head widths after the last;
 * engine.multinotePadding (staff spaces) is retired and not read. The
 * breve's tie runs from the middle of the first semibreve group to the
 * middle of the second, as a tie joins two notes, still at the heads'
 * bottom.
 *
 * Session 22 (notehead size): the resolved heightSemis / widthSemis set the
 * notehead measurement, and the ledger width, column width, repeated group,
 * stem anchor (scaleX) and octave pair follow it. Unsized, nothing changes.
 *
 * Dependencies: Modules A, B, 1 (grid context passed in), 5, 6, 7, 8.
 */

import { CNBConfig } from "./cnb-config.js";
import { CNBMusic } from "./cnb-music.js";
import { CNBNotehead } from "./cnb-notehead.js";
import { CNBDoubleNotehead } from "./cnb-double-notehead.js";
import { CNBLedgerSet } from "./cnb-ledger-set.js";
import { CNBStem } from "./cnb-stem.js";

const NS = "http://www.w3.org/2000/svg";

/** Build one material-card pitch label (top or bottom). */
function buildLabel(config, heightPx, { text, sharp }, position) {
  const display = config.display || {};
  const label = display.label || {};
  const cardStyle = display.card || {};

  const div = document.createElement("div");
  div.className = position === "top" ? "label-top" : "label-bottom";
  div.style.height = heightPx + "px";
  div.style.display = "flex";
  div.style.alignItems = "center";
  div.style.justifyContent = "center";

  const span = document.createElement("span");
  span.className = "cnb-label-card";
  span.style.fontFamily = label.fontFamily ?? "Oswald";
  span.style.fontSize = (label.fontSize ?? 22) + "px";
  span.style.fontWeight = String(label.fontWeight ?? 400);
  span.style.color = label.color ?? "#555555";
  span.style.background = cardStyle.background ?? "#FFFFFF";
  span.style.border = "1px solid #e5e5e5";
  span.style.borderRadius = (cardStyle.borderRadius ?? 6) + "px";
  span.style.boxShadow = cardStyle.shadow ?? "0 2px 12px rgba(0,0,0,0.12)";
  span.style.padding = `0 ${label.padding ?? 6}px`;
  span.style.lineHeight = "1.25";

  const textSpan = document.createElement("span");
  textSpan.className = "cnb-label-text";
  textSpan.textContent = text;
  span.appendChild(textSpan);

  if (sharp) {
    const sharpStyle = label.sharpStyle || {};
    const s = document.createElement("span");
    s.className = "cnb-label-sharp";
    s.textContent = "♯";
    s.style.fontSize = (sharpStyle.fontSize ?? 0.75) + "em";
    s.style.position = "relative";
    // "raise" is upward-positive em, CSS `top` is downward-positive, hence
    // the negation. The fallback mirrors the schema default of -0.15
    // (architecture plan §4.7: the shrunken ♯ sits slightly lowered).
    s.style.top = -(sharpStyle.raise ?? -0.15) + "em";
    span.appendChild(s);
  }

  div.appendChild(span);
  return div;
}

/**
 * Pitch-axis notehead offset in px (set 014, design §3.3):
 * xOffsetStaffSpaces × axis.unitsPerStaffSpace × pxPerSemi. Axis-gated
 * (design §3.2) — 0 on a linear grid, whatever the rules say.
 */
function axisOffsetPx(gridContext, resolved) {
  const axis = gridContext.axis;
  if (!axis || !axis.enabled) return 0;
  return (resolved.xOffsetStaffSpaces || 0) * axis.unitsPerStaffSpace * gridContext.pxPerSemi;
}

/** The repeated heads' overlap when a config sets none: 1/3 of a head's width (session 58). */
const DEFAULT_REPEAT_OVERLAP = 1 / 3;

/** The gap between tied semibreve groups, in staff spaces (engine session 25). */
const TIE_GAP = 1;

/** The tie's thickness, in staff spaces (engine session 25). */
const TIE_THICKNESS = 0.12;

/** The tie's colour: LilyPond's default black, not the notehead's (engine session 25). */
const TIE_COLOR = "#000000";

/** The duration category of a duration name (lilypondDuration; 3 if unknown). */
function durationCategory(config, duration) {
  const def = (config.durations?.definitions || []).find(d => d.name === duration);
  return def?.lilypondDuration ?? 3;
}

export const CNBCard = {

  /**
   * How many heads one group of a duration has: 1 unless
   * durations.representationMode is "repeat"; then by the duration
   * definition's lilypondDuration (the engine's duration category): 3 or
   * more → 1, 2 (minim) → 2, 1 or 0 (semibreve, breve) → 4. A breve is two
   * such groups, tied (tiedGroups). The engine's counts are fixed;
   * durations.repeatCounts is not read.
   *
   * @param {object} config
   * @param {string} duration  duration name
   * @returns {number}
   */
  repeatCount(config, duration) {
    if (config.durations?.representationMode !== "repeat") return 1;
    const category = durationCategory(config, duration);
    if (category >= 3) return 1;
    return category === 2 ? 2 : 4;
  },

  /**
   * How many tied semibreve groups a duration draws: 2 for a breve
   * (lilypondDuration 0 or less) in repeat mode, as the engine engraves it
   * (its session 25); otherwise 1.
   *
   * @param {object} config
   * @param {string} duration  duration name
   * @returns {number}
   */
  tiedGroups(config, duration) {
    if (config.durations?.representationMode !== "repeat") return 1;
    return durationCategory(config, duration) <= 0 ? 2 : 1;
  },

  /**
   * Horizontal layout of a duration's repeated heads (pure). Each copy
   * starts (1 − durations.repeatOverlap) head widths after the last
   * (session 58). A breve's two groups sit 1 staff space apart, with one
   * tie below the heads from the middle of the first group to the middle
   * of the second (sessions 46 and 58). Offsets and tie ends are relative
   * to the centre of the whole; a tie's dy is its ends' height below the
   * head's centre, the heads' bottom.
   *
   * @param {object} config
   * @param {object} gridContext
   * @param {object} shape     shape config object
   * @param {string} duration  duration name
   * @param {{heightSemis?:number|null, widthSemis?:number|null}} [size]
   *        the resolved notehead size (session 22); absent = the shape's own
   * @returns {{count:number, offsets:number[], groupWidth:number,
   *            ties:Array<{x1:number, x2:number, dy:number}>, staffSpacePx:number}} px;
   *          count is the number of heads, groupWidth the whole width
   */
  repeatLayout(config, gridContext, shape, duration, size) {
    const perGroup = CNBCard.repeatCount(config, duration);
    const groups = CNBCard.tiedGroups(config, duration);
    const { pixelWidth, pixelHeight } = CNBNotehead.measure(shape, gridContext.pxPerSemi, size);
    const axis = gridContext.axis;
    const unitsPerStaffSpace = axis && axis.enabled
      ? axis.unitsPerStaffSpace
      : (config.staff?.semitonesPerStaffSpace ?? 4);
    const staffSpacePx = unitsPerStaffSpace * gridContext.pxPerSemi;
    if (perGroup === 1) return { count: 1, offsets: [0], groupWidth: pixelWidth, ties: [], staffSpacePx };
    const overlap = config.durations?.repeatOverlap ?? DEFAULT_REPEAT_OVERLAP;
    const step = pixelWidth * (1 - overlap);
    const width = pixelWidth + (perGroup - 1) * step;
    const gap = TIE_GAP * staffSpacePx;
    const pitch = width + gap;
    const offsets = [];
    const centres = [];
    for (let g = 0; g < groups; g++) {
      const centre = (g - (groups - 1) / 2) * pitch;
      centres.push(centre);
      for (let i = 0; i < perGroup; i++) offsets.push(centre + (i - (perGroup - 1) / 2) * step);
    }
    const ties = groups > 1
      ? [{ x1: centres[0], x2: centres[centres.length - 1], dy: pixelHeight / 2 }]
      : [];
    return {
      count: perGroup * groups,
      offsets,
      groupWidth: groups * width + (groups - 1) * gap,
      ties,
      staffSpacePx,
    };
  },

  /**
   * A tie as LilyPond's make-tie-stencil draws it, bowing down from y
   * between x1 and x2 (pure, px, SVG y down). Its height is LilyPond's
   * slur height for the width (height limit 1, ratio 0.33, in staff
   * spaces), its outline make-bow-stencil's bezier sandwich (angularity
   * 0.5, 0.12 staff spaces thick), stroked at min(2 × thickness, 0.1)
   * staff spaces and filled.
   *
   * @param {number} x1  left end
   * @param {number} x2  right end
   * @param {number} y   the ends' y
   * @param {number} staffSpacePx
   * @returns {{d:string, strokeWidth:number, height:number}} height: the
   *          bow's height in px (the curve's middle sits that far below y)
   */
  tiePath(x1, x2, y, staffSpacePx) {
    const width = Math.abs(x2 - x1) / staffSpacePx;
    const height = (2 / Math.PI) * Math.atan(Math.PI * width * 0.33 * 0.5);
    const outer = (4 / 3) * height;
    const inner = outer - TIE_THICKNESS;
    const at = (u, v) => `${x1 + u * (x2 - x1)},${y + v * staffSpacePx}`;
    const d = `M ${at(0, 0)} C ${at(0.25, outer)} ${at(0.75, outer)} ${at(1, 0)} ` +
      `C ${at(0.75, inner)} ${at(0.25, inner)} ${at(0, 0)} Z`;
    return { d, strokeWidth: Math.min(2 * TIE_THICKNESS, 0.1) * staffSpacePx, height: height * staffSpacePx };
  },

  /**
   * How low a card's lowest tie reaches (session 46): the y, in px on the
   * grid, of the lowest ink of the tie under the card's lower notehead (the
   * bow's middle, plus half the outline's stroke), or null when the card
   * draws no tie. The collection widens its grid to hold it.
   *
   * @param {object} config
   * @param {object} gridContext
   * @param {{pc:number, duration:string, key?:string|null}} example
   * @returns {number|null} px
   */
  tieBottom(config, gridContext, { pc, duration, key = null }) {
    const resolved = CNBCard.resolveNotehead(config, pc, duration, key);
    const shape = config.shapes[resolved.shape];
    const { ties, staffSpacePx } = CNBCard.repeatLayout(config, gridContext, shape, duration, resolved);
    if (ties.length === 0) return null;
    const { x1, x2, dy } = ties[0];
    const tie = CNBCard.tiePath(x1, x2, 0, staffSpacePx);
    return gridContext.semiToY(pc) + dy + tie.height + tie.strokeWidth / 2;
  },

  /**
   * Resolve the effective notehead render config for (pc, duration, key).
   * Delegates rule walking to CNBConfig.resolveNotehead, then makes the
   * color concrete: the rules' colour, otherwise black (a notehead's colour
   * lives only on its rules, session 37). pc may be 0–12 (normalized).
   *
   * @param {object} config
   * @param {number} pc        0–12
   * @param {string} duration  e.g. "crotchet"
   * @param {string|null} key
   * @returns {{shape:string, hollow:boolean, color:string, offKeyMark:boolean|string,
   *            xOffsetStaffSpaces:number}}
   */
  resolveNotehead(config, pc, duration, key) {
    const normalized = CNBMusic.pitchClass(pc);
    const resolved = CNBConfig.resolveNotehead(config, normalized, duration, key);
    return {
      ...resolved,
      color: resolved.color ?? "#000000",
    };
  },

  /**
   * Column width for a card: the ledger line for the resolved notehead (the
   * widest element in the column; in repeat mode, for the repeated group,
   * as LilyPond draws it — CNBLedgerSet.width) plus horizontal padding on
   * both sides. Module 10 sums these to size the background staff SVG. On
   * a pitch-axis grid the column widens by the notehead's |offset| (set
   * 014) so an offset head does not clip.
   *
   * @param {object} config
   * @param {object} gridContext
   * @param {{pc:number, duration:string, key?:string|null}} example
   * @returns {number} px
   */
  columnWidth(config, gridContext, { pc, duration, key = null }) {
    const resolved = CNBCard.resolveNotehead(config, pc, duration, key);
    const shape = config.shapes[resolved.shape];
    const paddingH = config.display?.column?.paddingH ?? 16;
    const { groupWidth } = CNBCard.repeatLayout(config, gridContext, shape, duration, resolved);
    const ledgerWidth = CNBLedgerSet.width(groupWidth);
    if (gridContext.axis && gridContext.axis.enabled) {
      return ledgerWidth + 2 * paddingH + Math.abs(axisOffsetPx(gridContext, resolved));
    }
    return ledgerWidth + 2 * paddingH;
  },

  /**
   * Where a card's noteheads are centred, in px from its column's left edge:
   * the middle of the column, moved by half the notehead's pitch-axis offset
   * (set 014). The key-signature gutter spaces the first card from it
   * (session 34).
   *
   * @param {object} config
   * @param {object} gridContext
   * @param {{pc:number, duration:string, key?:string|null}} example
   * @returns {number} px
   */
  headCenterX(config, gridContext, { pc, duration, key = null }) {
    const centerX = CNBCard.columnWidth(config, gridContext, { pc, duration, key }) / 2;
    return centerX + axisOffsetPx(gridContext, CNBCard.resolveNotehead(config, pc, duration, key)) / 2;
  },

  /**
   * Render one octave-chord card and append it to container.
   *
   * @param {HTMLElement} container
   * @param {object} gridContext  From CNBGrid.create()
   * @param {object} config
   * @param {{pc:number, duration:string, key?:string|null}} example
   * @param {{fluid?:boolean}} [layout]  fluid (session 25, the editor's
   *        reflowing canvas, design §6.1): the column takes no fixed width,
   *        so it fills its grid cell; the note-slice keeps its own width,
   *        centred in the column; and the column carries data-pc (the
   *        card's pc, 0–12) for hit-testing and data-ledgers (the number
   *        of ledger lines it draws; session 26). Off, the output is
   *        unchanged.
   * @returns {HTMLDivElement} the div.pc-col element
   */
  render(container, gridContext, config, { pc, duration, key = null }, layout = {}) {
    const fluid = layout.fluid === true;
    const resolved = CNBCard.resolveNotehead(config, pc, duration, key);
    const shape = config.shapes[resolved.shape];

    const lowerSemi = pc;
    const upperSemi = pc + 12;

    const colWidth = CNBCard.columnWidth(config, gridContext, { pc, duration, key });
    const centerX = colWidth / 2;
    // Pitch-axis offset (set 014): the octave pair shares one pc, hence one
    // offset. The offset heads — with their ledgers and stem — sit at headX;
    // the unshifted center moves the other way by half, so both fit the
    // widened column. On a linear grid offsetPx is 0 and both are centerX.
    const offsetPx = axisOffsetPx(gridContext, resolved);
    const baseX = offsetPx === 0 ? centerX : centerX - offsetPx / 2;
    const headX = CNBCard.headCenterX(config, gridContext, { pc, duration, key });
    const labelInfo = CNBMusic.pcLabel(CNBMusic.pitchClass(pc));

    const col = document.createElement("div");
    col.className = "pc-col";
    if (fluid) {
      col.setAttribute("data-pc", String(pc));
    } else {
      col.style.width = colWidth + "px";
      col.style.flex = "0 0 auto";
    }

    col.appendChild(buildLabel(config, gridContext.topLabelHeight, labelInfo, "top"));

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "note-slice");
    svg.setAttribute("width", String(colWidth));
    svg.setAttribute("height", String(gridContext.svgHeight));
    svg.style.display = "block";
    if (fluid) svg.style.margin = "0 auto";

    // 1. Ledger lines (bottom layer), as long as LilyPond draws them for the
    // notehead or, in repeat mode, the repeated group. The resolved size
    // (session 22) sets the notehead measurement that the ledger width,
    // stem anchor and noteheads all follow.
    const measured = CNBNotehead.measure(shape, gridContext.pxPerSemi, resolved);
    const { pixelWidth } = measured;
    const repeat = CNBCard.repeatLayout(config, gridContext, shape, duration, resolved);
    const ledgerGroup = CNBLedgerSet.render(svg, gridContext, config, [lowerSemi, upperSemi], {
      centerX: headX,
      width: CNBLedgerSet.width(repeat.groupWidth),
    });
    // Fluid columns say how many ledger lines they draw, so the editor's
    // Ledger lines section can tint them (session 26, design §6).
    if (fluid) col.setAttribute("data-ledgers", String(ledgerGroup.children.length));

    // 2. Stem (under the noteheads)
    const durationDef = (config.durations?.definitions || []).find(d => d.name === duration);
    if (!durationDef || durationDef.hasStem !== false) {
      const direction = CNBStem.direction(
        [lowerSemi, upperSemi],
        config.staff?.midpoint ?? 12,
        gridContext.axis
      );
      const geometry = CNBStem.geometry(config, {
        gridContext,
        shape,
        scaleFactor: measured.scaleFactor,
        scaleX: measured.scaleX,
        centerX: headX,
        noteYPositions: [gridContext.semiToY(lowerSemi), gridContext.semiToY(upperSemi)],
        direction,
        duration,
        widthScale: repeat.groupWidth / pixelWidth,
      });
      CNBStem.render(svg, geometry);
    }

    // 3. Octave pair of noteheads (top layer), once per repeated copy
    const size = { heightSemis: resolved.heightSemis, widthSemis: resolved.widthSemis };
    for (const dx of repeat.offsets) {
      CNBDoubleNotehead.render(svg, gridContext, {
        lowerSemi,
        upperSemi,
        lowerNote: { shape, hollow: resolved.hollow, color: resolved.color, size },
        upperNote: { shape, hollow: resolved.hollow, color: resolved.color, size },
        centerX: baseX,
        offsetPercent: 0,
        lowerOffsetPx: offsetPx + dx,
        upperOffsetPx: offsetPx + dx,
      });
    }

    // 4. A breve's tie (sessions 44 and 46), below the heads of each notehead
    for (const semi of [lowerSemi, upperSemi]) {
      for (const { x1, x2, dy } of repeat.ties) {
        const tie = CNBCard.tiePath(headX + x1, headX + x2, gridContext.semiToY(semi) + dy, repeat.staffSpacePx);
        const path = document.createElementNS(NS, "path");
        path.setAttribute("class", "cnb-tie");
        path.setAttribute("d", tie.d);
        // Black whatever the notehead's colour: the engine adds the tie after
        // it colours the head (engine session 25 handoff, §1 "Flag").
        path.setAttribute("fill", TIE_COLOR);
        path.setAttribute("stroke", TIE_COLOR);
        path.setAttribute("stroke-width", String(tie.strokeWidth));
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("stroke-linecap", "round");
        svg.appendChild(path);
      }
    }

    col.appendChild(svg);
    col.appendChild(buildLabel(config, gridContext.bottomLabelHeight, labelInfo, "bottom"));

    container.appendChild(col);
    return col;
  },

};
