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

export const CNBCard = {

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
    const { pixelWidth } = CNBNotehead.measure(shape, gridContext.pxPerSemi);
    const multiplier = config.ledgers?.lineDefaults?.widthMultiplier ?? 2.0;
    const paddingH = config.display?.column?.paddingH ?? 16;
    if (gridContext.axis && gridContext.axis.enabled) {
      return pixelWidth * multiplier + 2 * paddingH + Math.abs(axisOffsetPx(gridContext, resolved));
    }
    return pixelWidth * multiplier + 2 * paddingH;
  },

  /**
   * Render one octave-chord card and append it to container.
   *
   * @param {HTMLElement} container
   * @param {object} gridContext  From CNBGrid.create()
   * @param {object} config
   * @param {{pc:number, duration:string, key?:string|null}} example
   * @returns {HTMLDivElement} the div.pc-col element
   */
  render(container, gridContext, config, { pc, duration, key = null }) {
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
    col.style.width = colWidth + "px";
    col.style.flex = "0 0 auto";

    col.appendChild(buildLabel(config, gridContext.topLabelHeight, labelInfo, "top"));

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "note-slice");
    svg.setAttribute("width", String(colWidth));
    svg.setAttribute("height", String(gridContext.svgHeight));
    svg.style.display = "block";

    // 1. Ledger lines (bottom layer)
    const { pixelWidth } = CNBNotehead.measure(shape, gridContext.pxPerSemi);
    const multiplier = config.ledgers?.lineDefaults?.widthMultiplier ?? 2.0;
    CNBLedgerSet.render(svg, gridContext, config, [lowerSemi, upperSemi], {
      centerX: headX,
      width: pixelWidth * multiplier,
    });

    // 2. Stem (under the noteheads)
    const durationDef = (config.durations?.definitions || []).find(d => d.name === duration);
    if (!durationDef || durationDef.hasStem !== false) {
      const direction = CNBStem.direction(
        [lowerSemi, upperSemi],
        config.staff?.midpoint ?? 12,
        gridContext.axis
      );
      const { scaleFactor } = CNBNotehead.measure(shape, gridContext.pxPerSemi);
      const geometry = CNBStem.geometry(config, {
        shape,
        scaleFactor,
        centerX: headX,
        noteYPositions: [gridContext.semiToY(lowerSemi), gridContext.semiToY(upperSemi)],
        direction,
        duration,
      });
      CNBStem.render(svg, geometry);
    }

    // 3. Octave pair of noteheads (top layer)
    CNBDoubleNotehead.render(svg, gridContext, {
      lowerSemi,
      upperSemi,
      lowerNote: { shape, hollow: resolved.hollow, color: resolved.color },
      upperNote: { shape, hollow: resolved.hollow, color: resolved.color },
      centerX: baseX,
      offsetPercent: 0,
      lowerOffsetPx: offsetPx,
      upperOffsetPx: offsetPx,
    });

    col.appendChild(svg);
    col.appendChild(buildLabel(config, gridContext.bottomLabelHeight, labelInfo, "bottom"));

    container.appendChild(col);
    return col;
  },

};
