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
 *                                       clef.enabled — set 009 — then
 *                                       div.keysig-col when the key
 *                                       signature renders — set 010)
 *
 * The background SVG is offset down by the grid's topLabelHeight so its
 * coordinate system lines up with each card's note-slice SVG, giving
 * continuous staff lines behind all columns.
 *
 * Key rows are deferred (Architecture Plan §5 Module 10 "future"): the keys
 * option is accepted but rows are rendered with key = null. Set 010 uses
 * options.keys[0] as the SELECTED key for the key-signature gutter (the
 * displayed key is example data — s1 decision D5); card rendering is
 * unchanged.
 *
 * Session 25 (the editor's reflowing canvas, design §6.1): the fluid option
 * makes each row's .pc-columns a CSS grid — the gutter tracks, then equal
 * columns no narrower than the widest card — with the staff SVG a grid item
 * at width 100% spanning the gutters and the row's cards, and rows: 2
 * splits the row into two systems on the same grid. minRowWidth() gives the
 * narrowest row, so the page can choose one row or two. Off, the layout
 * above is unchanged.
 *
 * Dependencies: Modules A, 1, 3, 9.
 */

import { CNBGrid } from "./cnb-grid.js";
import { CNBStaff } from "./cnb-staff.js";
import { CNBCard } from "./cnb-card.js";
import { CNBClef } from "./cnb-clef.js";
import { CNBKeySignature } from "./cnb-key-signature.js";

const NS = "http://www.w3.org/2000/svg";

const DEFAULT_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Build a fixed-width gutter column (clef / key signature): top and bottom
 * label-height spacers around a grid-height SVG slice that renderInto fills.
 */
function gutterColumn(grid, { className, sliceClass, width, renderInto }) {
  const col = document.createElement("div");
  col.className = className;
  col.style.width = width + "px";
  col.style.flex = "0 0 auto";

  const topSpacer = document.createElement("div");
  topSpacer.style.height = grid.topLabelHeight + "px";
  col.appendChild(topSpacer);

  const slice = document.createElementNS(NS, "svg");
  slice.setAttribute("class", sliceClass);
  slice.setAttribute("width", String(width));
  slice.setAttribute("height", String(grid.svgHeight));
  slice.style.display = "block";
  renderInto(slice);
  col.appendChild(slice);

  const bottomSpacer = document.createElement("div");
  bottomSpacer.style.height = grid.bottomLabelHeight + "px";
  col.appendChild(bottomSpacer);

  return col;
}

/** Space between the two systems of a two-row fluid canvas (design §6.1). */
const SYSTEM_GAP_PX = 24;

/**
 * The fluid grid's column minimum: the widest column the shown cards need
 * (any pitch class, any shown duration), rounded up, plus 2 px either side.
 * Column widths do not depend on the grid's semitone range, so one grid
 * over all the pitch classes serves every system.
 */
function fluidColumnMin(config, grid, pitchClasses, durations) {
  let widest = 0;
  for (const duration of durations) {
    for (const pc of pitchClasses) {
      widest = Math.max(widest, CNBCard.columnWidth(config, grid, { pc, duration }));
    }
  }
  return Math.ceil(widest) + 4;
}

/** The pitch classes of each system: one, or the first ceil(n/2) and the rest. */
function splitSystems(pitchClasses, rows) {
  if (rows !== 2) return [pitchClasses];
  const half = Math.ceil(pitchClasses.length / 2);
  return [pitchClasses.slice(0, half), pitchClasses.slice(half)];
}

/**
 * One fluid system (session 25, design §6.1): a CSS grid of the gutter
 * tracks then `slots` equal columns no narrower than colMin. The staff SVG
 * is a grid item on the first grid row, spanning the gutters and this
 * system's own columns, so its lines (drawn to 100%) end after its last
 * card, and the cards are placed explicitly beside it.
 */
function renderFluidSystem(config, { pitchClasses, duration, key, slots, colMin, first }) {
  const grid = CNBGrid.create(config, CNBCollection.gridRange(pitchClasses));
  const clefGutterWidth = CNBClef.gutterWidth(config, grid.pxPerSemi);
  const keySigGutterWidth = CNBKeySignature.gutterWidth(config, grid.pxPerSemi, key);

  const gutters = [];
  if (clefGutterWidth > 0) {
    gutters.push(gutterColumn(grid, {
      className: "clef-col",
      sliceClass: "clef-slice",
      width: clefGutterWidth,
      renderInto: svg => CNBClef.render(svg, grid, config),
    }));
  }
  if (keySigGutterWidth > 0) {
    gutters.push(gutterColumn(grid, {
      className: "keysig-col",
      sliceClass: "keysig-slice",
      width: keySigGutterWidth,
      renderInto: svg => CNBKeySignature.render(svg, grid, config, key),
    }));
  }

  const container = document.createElement("div");
  container.className = "preview-container";
  container.style.position = "relative";
  container.style.display = "block";
  container.style.minWidth = (clefGutterWidth + keySigGutterWidth + slots * colMin) + "px";
  container.style.background = config.display?.card?.background ?? "#FFFFFF";
  if (!first) container.style.marginTop = SYSTEM_GAP_PX + "px";

  const columns = document.createElement("div");
  columns.className = "pc-columns";
  columns.style.display = "grid";
  columns.style.position = "relative";
  columns.style.gridTemplateColumns = [
    ...gutters.map(g => g.style.width),
    `repeat(${slots}, minmax(${colMin}px, 1fr))`,
  ].join(" ");

  const bg = document.createElementNS(NS, "svg");
  bg.setAttribute("class", "staff-lines-bg");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", String(grid.svgHeight));
  bg.style.display = "block";
  bg.style.gridRow = "1";
  bg.style.gridColumn = `1 / span ${gutters.length + pitchClasses.length}`;
  bg.style.alignSelf = "start";
  bg.style.marginTop = grid.topLabelHeight + "px";
  if (config.display?.debugGrid) {
    const staffPositions = CNBStaff.getPositions(config, {
      minSemi: grid.minSemi,
      maxSemi: grid.maxSemi,
    });
    CNBGrid.renderDebugOverlay(bg, grid, staffPositions);
  }
  CNBStaff.render(bg, grid, config, "100%");
  columns.appendChild(bg);

  gutters.forEach((g, i) => {
    g.style.gridRow = "1";
    g.style.gridColumn = String(i + 1);
    columns.appendChild(g);
  });
  pitchClasses.forEach((pc, i) => {
    const col = CNBCard.render(columns, grid, config, { pc, duration, key: null }, { fluid: true });
    col.style.gridRow = "1";
    col.style.gridColumn = String(gutters.length + i + 1);
  });

  container.appendChild(columns);
  return container;
}

/** One fluid duration row: an optional caption, then one system or two. */
function renderFluidRow(config, { pitchClasses, duration, key, showCaption, rows, colMin }) {
  const row = document.createElement("div");
  row.className = "cnb-duration-row";
  if (showCaption) row.appendChild(durationCaption(config, duration));
  const systems = splitSystems(pitchClasses, rows);
  systems.forEach((pcs, i) => {
    row.appendChild(renderFluidSystem(config, {
      pitchClasses: pcs, duration, key, slots: systems[0].length, colMin, first: i === 0,
    }));
  });
  return row;
}

/** The caption naming a duration row (several durations shown). */
function durationCaption(config, duration) {
  const def = (config.durations?.definitions || []).find(d => d.name === duration);
  const caption = document.createElement("div");
  caption.className = "cnb-duration-caption";
  caption.textContent = def?.displayName ?? duration;
  caption.style.fontFamily = config.display?.label?.fontFamily ?? "Oswald";
  caption.style.color = config.display?.label?.color ?? "#555555";
  return caption;
}

/** One duration row: background staff SVG + flex row of cards. */
function renderRow(config, { pitchClasses, duration, key, showCaption }) {
  const grid = CNBGrid.create(config, CNBCollection.gridRange(pitchClasses));

  const row = document.createElement("div");
  row.className = "cnb-duration-row";

  if (showCaption) row.appendChild(durationCaption(config, duration));

  const previewContainer = document.createElement("div");
  previewContainer.className = "preview-container";
  previewContainer.style.position = "relative";
  previewContainer.style.display = "inline-block";
  previewContainer.style.background = config.display?.card?.background ?? "#FFFFFF";

  // Clef gutter (set 009): 0 when clef.enabled is false, so the default
  // layout is unchanged. Staff lines run behind the gutter (bg spans it).
  const clefGutterWidth = CNBClef.gutterWidth(config, grid.pxPerSemi);

  // Key-signature gutter (set 010): 0 unless keys.enabled,
  // keys.keySignature.enabled, and the selected key resolves. Composes
  // after the clef, left to right (binding rule 3).
  const keySigGutterWidth = CNBKeySignature.gutterWidth(config, grid.pxPerSemi, key);

  const totalWidth = clefGutterWidth + keySigGutterWidth + pitchClasses.reduce(
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
    columns.appendChild(gutterColumn(grid, {
      className: "clef-col",
      sliceClass: "clef-slice",
      width: clefGutterWidth,
      renderInto: svg => CNBClef.render(svg, grid, config),
    }));
  }

  if (keySigGutterWidth > 0) {
    columns.appendChild(gutterColumn(grid, {
      className: "keysig-col",
      sliceClass: "keysig-slice",
      width: keySigGutterWidth,
      renderInto: svg => CNBKeySignature.render(svg, grid, config, key),
    }));
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
   * The narrowest width a fluid row can take (session 25, design §6.1):
   * the clef and key-signature gutters plus one column minimum (the widest
   * column the shown cards need, rounded up, plus 2 px either side) per
   * slot. One row has a slot per pitch class; two rows have ceil(n / 2).
   * The page code compares the canvas width with it to choose the rows.
   *
   * @param {object} config
   * @param {{pitchClasses?:number[], durations?:string[], keys?:string[]|null,
   *          rows?:1|2}} [options]  as for render()
   * @returns {number} px
   */
  minRowWidth(config, options = {}) {
    const pitchClasses = options.pitchClasses ?? DEFAULT_PCS;
    const durations = options.durations ?? ["crotchet"];
    const key = (options.keys && options.keys[0]) ?? null;
    const grid = CNBGrid.create(config, CNBCollection.gridRange(pitchClasses));
    const colMin = fluidColumnMin(config, grid, pitchClasses, durations);
    const slots = splitSystems(pitchClasses, options.rows)[0].length;
    return CNBClef.gutterWidth(config, grid.pxPerSemi) +
      CNBKeySignature.gutterWidth(config, grid.pxPerSemi, key) +
      slots * colMin;
  },

  /**
   * Render a collection of octave-chord cards and append it to container.
   *
   * @param {HTMLElement} container
   * @param {object} config
   * @param {{pitchClasses?:number[], durations?:string[], keys?:string[]|null,
   *          fluid?:boolean, rows?:1|2}} [options]
   *        pitchClasses defaults to the full chromatic row 0–12;
   *        durations defaults to ["crotchet"], one row per entry;
   *        keys[0] selects the key shown in the key-signature gutter
   *        (set 010); key ROWS remain deferred (cards render key = null).
   *        fluid (session 25, design §6.1): each row is a grid of equal
   *        columns no narrower than the widest, sharing any spare width,
   *        with the staff stretched to the row; rows 2 (fluid only) splits
   *        the pitch classes into two systems, C to F♯ and G to C′ for the
   *        full row, on the same column grid. With fluid off the layout is
   *        the fixed one, unchanged.
   * @returns {HTMLDivElement} the div.cnb-preview element
   */
  render(container, config, options = {}) {
    const pitchClasses = options.pitchClasses ?? DEFAULT_PCS;
    const durations = options.durations ?? ["crotchet"];
    const key = (options.keys && options.keys[0]) ?? null;

    const root = document.createElement("div");
    root.className = "cnb-preview";

    if (options.fluid === true) {
      const grid = CNBGrid.create(config, CNBCollection.gridRange(pitchClasses));
      const colMin = fluidColumnMin(config, grid, pitchClasses, durations);
      const rows = options.rows === 2 ? 2 : 1;
      for (const duration of durations) {
        root.appendChild(renderFluidRow(config, {
          pitchClasses,
          duration,
          key,
          showCaption: durations.length > 1,
          rows,
          colMin,
        }));
      }
      container.appendChild(root);
      return root;
    }

    for (const duration of durations) {
      root.appendChild(renderRow(config, {
        pitchClasses,
        duration,
        key,
        showCaption: durations.length > 1,
      }));
    }

    container.appendChild(root);
    return root;
  },

};
