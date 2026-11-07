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

/** Engine default for cnb:multinote-padding (engine cnb/config.ly). */
const DEFAULT_MULTINOTE_PADDING = -0.5;

export const CNBCard = {

  /**
   * How many heads the engine engraves for a duration: 1 unless
   * durations.representationMode is "repeat"; then by the duration
   * definition's lilypondDuration (the engine's duration category): 3 or
   * more → 1, 2 (minim) → 2, 1 or 0 (semibreve, breve) → 4. The engine's
   * counts are fixed; durations.repeatCounts is not read.
   *
   * @param {object} config
   * @param {string} duration  duration name
   * @returns {number}
   */
  repeatCount(config, duration) {
    if (config.durations?.representationMode !== "repeat") return 1;
    const def = (config.durations.definitions || []).find(d => d.name === duration);
    const category = def?.lilypondDuration ?? 3;
    if (category >= 3) return 1;
    return category === 2 ? 2 : 4;
  },

  /**
   * Horizontal layout of a duration's repeated heads (pure). Copies sit
   * edge to edge with engine.multinotePadding staff spaces between them;
   * offsets are each copy's centre relative to the group centre.
   *
   * @param {object} config
   * @param {object} gridContext
   * @param {object} shape     shape config object
   * @param {string} duration  duration name
   * @param {{heightSemis?:number|null, widthSemis?:number|null}} [size]
   *        the resolved notehead size (session 22); absent = the shape's own
   * @returns {{count:number, offsets:number[], groupWidth:number}} px
   */
  repeatLayout(config, gridContext, shape, duration, size) {
    const count = CNBCard.repeatCount(config, duration);
    const { pixelWidth } = CNBNotehead.measure(shape, gridContext.pxPerSemi, size);
    if (count === 1) return { count, offsets: [0], groupWidth: pixelWidth };
    const axis = gridContext.axis;
    const unitsPerStaffSpace = axis && axis.enabled
      ? axis.unitsPerStaffSpace
      : (config.staff?.semitonesPerStaffSpace ?? 4);
    const padding = config.engine?.multinotePadding ?? DEFAULT_MULTINOTE_PADDING;
    const step = pixelWidth + padding * unitsPerStaffSpace * gridContext.pxPerSemi;
    const offsets = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step);
    return { count, offsets, groupWidth: pixelWidth + (count - 1) * step };
  },

  /**
   * Resolve the effective notehead render config for (pc, duration, key).
   * Delegates rule walking to CNBConfig.resolveNotehead, then makes the
   * color concrete: an explicit rule color wins, otherwise the palette color
   * for the pitch class, otherwise black. pc may be 0–12 (normalized).
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
      color: resolved.color ?? CNBConfig.resolveColor(config, normalized) ?? "#000000",
    };
  },

  /**
   * Column width for a card: resolved notehead width × the ledger
   * widthMultiplier (the widest element in the column) plus horizontal
   * padding on both sides. Module 10 sums these to size the background
   * staff SVG. On a pitch-axis grid the column widens by the notehead's
   * |offset| (set 014) so an offset head does not clip.
   *
   * @param {object} config
   * @param {object} gridContext
   * @param {{pc:number, duration:string, key?:string|null}} example
   * @returns {number} px
   */
  columnWidth(config, gridContext, { pc, duration, key = null }) {
    const resolved = CNBCard.resolveNotehead(config, pc, duration, key);
    const shape = config.shapes[resolved.shape];
    const { pixelWidth } = CNBNotehead.measure(shape, gridContext.pxPerSemi, resolved);
    const multiplier = config.ledgers?.lineDefaults?.widthMultiplier ?? 2.0;
    const paddingH = config.display?.column?.paddingH ?? 16;
    // Repeat mode: the column widens by the repeated group's extra width.
    const { groupWidth } = CNBCard.repeatLayout(config, gridContext, shape, duration, resolved);
    const ledgerWidth = pixelWidth * multiplier + (groupWidth - pixelWidth);
    if (gridContext.axis && gridContext.axis.enabled) {
      return ledgerWidth + 2 * paddingH + Math.abs(axisOffsetPx(gridContext, resolved));
    }
    return ledgerWidth + 2 * paddingH;
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
    const headX = offsetPx === 0 ? centerX : centerX + offsetPx / 2;
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

    // 1. Ledger lines (bottom layer), widened by a repeated group's extra width
    // The resolved size (session 22) sets the notehead measurement that the
    // ledger width, stem anchor and noteheads all follow.
    const measured = CNBNotehead.measure(shape, gridContext.pxPerSemi, resolved);
    const { pixelWidth } = measured;
    const multiplier = config.ledgers?.lineDefaults?.widthMultiplier ?? 2.0;
    const repeat = CNBCard.repeatLayout(config, gridContext, shape, duration, resolved);
    const ledgerGroup = CNBLedgerSet.render(svg, gridContext, config, [lowerSemi, upperSemi], {
      centerX: headX,
      width: pixelWidth * multiplier + (repeat.groupWidth - pixelWidth),
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

    col.appendChild(svg);
    col.appendChild(buildLabel(config, gridContext.bottomLabelHeight, labelInfo, "bottom"));

    container.appendChild(col);
    return col;
  },

};
