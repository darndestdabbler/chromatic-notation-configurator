/**
 * cnb-collection.js — Module 10: Card Collection
 *
 * Lays out multiple octave-chord cards in a row, with continuous staff lines
 * drawn once in a background SVG spanning all columns:
 *
 *   div.cnb-preview                (returned; one child row per duration)
 *   └── div.cnb-duration-row
 *       ├── div.cnb-duration-caption   (only when several durations shown)
 *       └── div.preview-container
 *           ├── svg.staff-lines-bg     (absolute, offset by topLabelHeight)
 *           └── div.pc-columns         (flex row of Module 9 cards,
 *                                       preceded by div.clef-col when
 *                                       clef.enabled — set 009)
 *
 * The background SVG is offset down by the grid's topLabelHeight so its
 * coordinate system lines up with each card's note-slice SVG, giving
 * continuous staff lines behind all columns.
 *
 * Key rows are deferred (Architecture Plan §5 Module 10 "future"): the keys
 * option is accepted but rows are rendered with key = null.
 *
 * Dependencies: Modules A, 1, 3, 9.
 */

import { CNBGrid } from "./cnb-grid.js";
import { CNBStaff } from "./cnb-staff.js";
import { CNBCard } from "./cnb-card.js";
import { CNBClef } from "./cnb-clef.js";

const NS = "http://www.w3.org/2000/svg";

const DEFAULT_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** One duration row: background staff SVG + flex row of cards. */
function renderRow(config, { pitchClasses, duration, showCaption }) {
  const grid = CNBGrid.create(config, CNBCollection.gridRange(pitchClasses));

  const row = document.createElement("div");
  row.className = "cnb-duration-row";

  if (showCaption) {
    const def = (config.durations?.definitions || []).find(d => d.name === duration);
    const caption = document.createElement("div");
    caption.className = "cnb-duration-caption";
    caption.textContent = def?.displayName ?? duration;
    caption.style.fontFamily = config.display?.label?.fontFamily ?? "Oswald";
    caption.style.color = config.display?.label?.color ?? "#555555";
    row.appendChild(caption);
  }

  const previewContainer = document.createElement("div");
  previewContainer.className = "preview-container";
  previewContainer.style.position = "relative";
  previewContainer.style.display = "inline-block";
  previewContainer.style.background = config.display?.card?.background ?? "#FFFFFF";

  // Clef gutter (set 009): 0 when clef.enabled is false, so the default
  // layout is unchanged. Staff lines run behind the gutter (bg spans it).
  const clefGutterWidth = CNBClef.gutterWidth(config, grid.pxPerSemi);

  const totalWidth = clefGutterWidth + pitchClasses.reduce(
    (sum, pc) => sum + CNBCard.columnWidth(config, grid, { pc, duration }),
    0
  );

  const bg = document.createElementNS(NS, "svg");
  bg.setAttribute("class", "staff-lines-bg");
  bg.setAttribute("width", String(totalWidth));
  bg.setAttribute("height", String(grid.svgHeight));
  bg.style.position = "absolute";
  bg.style.top = grid.topLabelHeight + "px";
  bg.style.left = "0";

  if (config.display?.debugGrid) {
    const staffPositions = CNBStaff.getPositions(config, {
      minSemi: grid.minSemi,
      maxSemi: grid.maxSemi,
    });
    CNBGrid.renderDebugOverlay(bg, grid, staffPositions);
  }
  CNBStaff.render(bg, grid, config, totalWidth);

  const columns = document.createElement("div");
  columns.className = "pc-columns";
  columns.style.display = "flex";
  columns.style.position = "relative";

  if (clefGutterWidth > 0) {
    const clefCol = document.createElement("div");
    clefCol.className = "clef-col";
    clefCol.style.width = clefGutterWidth + "px";
    clefCol.style.flex = "0 0 auto";

    const topSpacer = document.createElement("div");
    topSpacer.style.height = grid.topLabelHeight + "px";
    clefCol.appendChild(topSpacer);

    const clefSvg = document.createElementNS(NS, "svg");
    clefSvg.setAttribute("class", "clef-slice");
    clefSvg.setAttribute("width", String(clefGutterWidth));
    clefSvg.setAttribute("height", String(grid.svgHeight));
    clefSvg.style.display = "block";
    CNBClef.render(clefSvg, grid, config);
    clefCol.appendChild(clefSvg);

    const bottomSpacer = document.createElement("div");
    bottomSpacer.style.height = grid.bottomLabelHeight + "px";
    clefCol.appendChild(bottomSpacer);

    columns.appendChild(clefCol);
  }

  for (const pc of pitchClasses) {
    CNBCard.render(columns, grid, config, { pc, duration, key: null });
  }

  previewContainer.appendChild(bg);
  previewContainer.appendChild(columns);
  row.appendChild(previewContainer);
  return row;
}

export const CNBCollection = {

  /**
   * Grid range for a set of pitch classes: from the lowest lower-note down
   * 4 semis (ledger/stem headroom) to the highest upper-note (pc + 12) up 4.
   *
   * @param {number[]} pitchClasses
   * @returns {{minSemi:number, maxSemi:number}}
   */
  gridRange(pitchClasses) {
    return {
      minSemi: Math.min(...pitchClasses) - 4,
      maxSemi: Math.max(...pitchClasses) + 12 + 4,
    };
  },

  /**
   * Render a collection of octave-chord cards and append it to container.
   *
   * @param {HTMLElement} container
   * @param {object} config
   * @param {{pitchClasses?:number[], durations?:string[], keys?:string[]|null}} [options]
   *        pitchClasses defaults to the full chromatic row 0–12;
   *        durations defaults to ["crotchet"], one row per entry;
   *        keys is accepted but deferred (rows render with key = null).
   * @returns {HTMLDivElement} the div.cnb-preview element
   */
  render(container, config, options = {}) {
    const pitchClasses = options.pitchClasses ?? DEFAULT_PCS;
    const durations = options.durations ?? ["crotchet"];

    const root = document.createElement("div");
    root.className = "cnb-preview";

    for (const duration of durations) {
      root.appendChild(renderRow(config, {
        pitchClasses,
        duration,
        showCaption: durations.length > 1,
      }));
    }

    container.appendChild(root);
    return root;
  },

};
