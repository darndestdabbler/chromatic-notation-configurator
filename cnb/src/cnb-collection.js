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
 * Session 28 (design §4.2): the labelStrip option puts a label column
 * (div.label-col) first in each fluid system, outside the staff, with one
 * pitch-class label per semitone level with the spot it names.
 *
 * Dependencies: Modules A, B, 1, 3, 9.
 */

import { CNBGrid } from "./cnb-grid.js";
import { CNBStaff } from "./cnb-staff.js";
import { CNBCard } from "./cnb-card.js";
import { CNBLedgerSet } from "./cnb-ledger-set.js";
import { CNBClef } from "./cnb-clef.js";
import { CNBKeySignature } from "./cnb-key-signature.js";
import { CNBMusic } from "./cnb-music.js";

const NS = "http://www.w3.org/2000/svg";

const DEFAULT_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Where the first card's noteheads are centred in its column
 * (CNBCard.headCenterX), which the key-signature gutter spaces from
 * (session 34); undefined with no card. In a fluid row the columns stretch,
 * so the fixed column stands for the first one.
 */
function firstHeadCenter(config, grid, pitchClasses, duration) {
  return pitchClasses.length > 0
    ? CNBCard.headCenterX(config, grid, { pc: pitchClasses[0], duration })
    : undefined;
}

/**
 * Build a fixed-width gutter column (clef / key signature): top and bottom
 * label-height spacers around a grid-height SVG slice that renderInto fills.
 * A fluid key-signature track (session 34) passes its CSS width as
 * cssWidth; the slice keeps its own width, and on a wide row draws on into
 * the first card's track (the column does not clip it).
 */
function gutterColumn(grid, { className, sliceClass, width, cssWidth, renderInto }) {
  const col = document.createElement("div");
  col.className = className;
  col.style.width = cssWidth ?? width + "px";
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
 * The label strip (session 28, design §4.2): two 26 px columns of labels,
 * even pitch classes left and odd right, with 4 px either side.
 */
const LABEL_COL_PX = 26;
const LABEL_STRIP_PX = 4 + 2 * LABEL_COL_PX + 4;

/** A pitch class's name, C to B with ♯ (CNBMusic.pcLabel). */
function pcName(pc) {
  const l = CNBMusic.pcLabel(pc);
  return l.text + (l.sharp ? "♯" : "");
}

/**
 * Fill the label strip's SVG slice: one label per semitone of the grid
 * range, level with the spot it names (grid.semiToY, so a pitch axis
 * places it), in the left column for an even pitch class and the right for
 * an odd one. Labels in one column that share a drawn spot (three
 * neighbours on one spot under a pitch axis) are one label, "C·D". Each
 * label is a g.pitch-label (data-semi: its lowest semitone, data-pc) with a
 * rect.pitch-chip behind its text; line.staff-middle marks the middle of
 * the staff. The page styles both (quiet, or chips in its Pitch section).
 */
function renderLabelStrip(svg, grid, config) {
  const groups = new Map();
  for (let semi = Math.ceil(grid.minSemi); semi <= grid.maxSemi; semi++) {
    const pc = CNBMusic.pitchClass(semi);
    const y = grid.semiToY(semi);
    const key = `${pc % 2}:${Math.round(y * 100)}`;
    if (!groups.has(key)) groups.set(key, { semi, pc, y, names: [] });
    groups.get(key).names.push(pcName(pc));
  }
  const chipH = Math.min(14, Math.max(8, 2 * grid.pxPerSemi - 2));
  for (const { semi, pc, y, names } of groups.values()) {
    const cx = 4 + (pc % 2) * LABEL_COL_PX + LABEL_COL_PX / 2;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "pitch-label");
    g.setAttribute("data-semi", String(semi));
    g.setAttribute("data-pc", String(pc));
    const chip = document.createElementNS(NS, "rect");
    chip.setAttribute("class", "pitch-chip");
    chip.setAttribute("x", String(cx - LABEL_COL_PX / 2 + 1));
    chip.setAttribute("y", String(y - chipH / 2));
    chip.setAttribute("width", String(LABEL_COL_PX - 2));
    chip.setAttribute("height", String(chipH));
    chip.setAttribute("rx", "3");
    chip.setAttribute("fill", "none");
    g.appendChild(chip);
    const text = document.createElementNS(NS, "text");
    text.setAttribute("x", String(cx));
    text.setAttribute("y", String(y));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "11");
    text.setAttribute("fill", "#777777");
    text.textContent = names.join("·");
    g.appendChild(text);
    svg.appendChild(g);
  }
  const mid = config.staff && config.staff.midpoint;
  if (Number.isFinite(mid)) {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("class", "staff-middle");
    line.setAttribute("x1", "0");
    line.setAttribute("x2", String(LABEL_STRIP_PX));
    line.setAttribute("y1", String(grid.semiToY(mid)));
    line.setAttribute("y2", String(grid.semiToY(mid)));
    line.setAttribute("stroke", "none");
    svg.appendChild(line);
  }
}

/**
 * The fluid grid's column minimum: the widest column the shown cards need
 * (any pitch class, any shown duration), rounded up, plus 2 px either side.
 * Column widths do not depend on the grid's semitone range, so one grid
 * over all the pitch classes serves every system.
 */
/**
 * The key-signature track of a fluid row (session 34), or null when no
 * signature shows. A card is centred in its track, which takes
 * t = (100% − fixed − K) / slots, so for the first card's notehead to sit
 * where the engine spaces it (CNBKeySignature.padding) the track must be
 * K = A − t / 2, A being the width the fixed layout's spacing gives to a
 * card of no width. Solved for K that is calc(P − Q × 100%), no wider than
 * its value at the row's minimum, where t = colMin. On a wide row K is
 * narrower than the marks, which then draw on into the first card's track:
 * its notehead is still the engine's spacing after them, far clear of the
 * marks. K reaches 0 when t = 2A (a column of about 940 px at the default
 * size), so the cards' tracks stop growing there: past it a card centred in
 * its track could not be close enough, and the row leaves the spare width
 * after its last card instead.
 *
 * @returns {{css:string, minPx:number, maxColPx:number}|null} the CSS track
 *          width; its width at the row's minimum (px), which the slice keeps,
 *          so the marks and their ledgers always fit it; and the widest a
 *          card's track may grow (px)
 */
function fluidKeySigTrack(config, grid, key, pitchClasses, duration, fixedPx, slots, colMin) {
  const centre = firstHeadCenter(config, grid, pitchClasses, duration);
  const offset = centre === undefined ? 0
    : centre - CNBCard.columnWidth(config, grid, { pc: pitchClasses[0], duration }) / 2;
  const pad = CNBKeySignature.padding(config, grid.pxPerSemi, key, offset);
  if (!pad) return null;
  const A = CNBKeySignature.gutterWidth(config, grid.pxPerSemi, key, offset);
  const marks = A - pad.right;
  const minPx = Math.max(marks, A - colMin / 2);
  const c = 1 - 1 / (2 * slots);
  const P = (A + fixedPx / (2 * slots)) / c;
  const Q = 1 / (2 * slots * c);
  return { css: `max(0px, min(calc(${P}px - ${Q} * 100%), ${minPx}px))`, minPx, maxColPx: 2 * A };
}

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
function renderFluidSystem(config, { pitchClasses, duration, key, slots, colMin, first, ledgerSpots, labelStrip }) {
  const grid = CNBGrid.create(config, CNBCollection.gridRange(pitchClasses, config, [duration], key));
  const clefGutterWidth = CNBClef.gutterWidth(config, grid.pxPerSemi);
  const stripWidth = labelStrip ? LABEL_STRIP_PX : 0;
  const keySig = fluidKeySigTrack(config, grid, key, pitchClasses, duration,
    stripWidth + clefGutterWidth, slots, colMin);
  const keySigGutterWidth = keySig ? keySig.minPx : 0;

  const gutters = [];
  if (labelStrip) {
    gutters.push(gutterColumn(grid, {
      className: "label-col",
      sliceClass: "label-slice",
      width: LABEL_STRIP_PX,
      renderInto: svg => renderLabelStrip(svg, grid, config),
    }));
  }
  if (clefGutterWidth > 0) {
    gutters.push(gutterColumn(grid, {
      className: "clef-col",
      sliceClass: "clef-slice",
      width: clefGutterWidth,
      renderInto: svg => CNBClef.render(svg, grid, config),
    }));
  }
  if (keySig) {
    gutters.push(gutterColumn(grid, {
      className: "keysig-col",
      sliceClass: "keysig-slice",
      width: keySig.minPx,
      cssWidth: keySig.css,
      renderInto: svg => CNBKeySignature.render(svg, grid, config, key),
    }));
  }

  const container = document.createElement("div");
  container.className = "preview-container";
  container.style.position = "relative";
  container.style.display = "block";
  container.style.minWidth = (stripWidth + clefGutterWidth + keySigGutterWidth + slots * colMin) + "px";
  container.style.background = config.display?.card?.background ?? "#FFFFFF";
  if (!first) container.style.marginTop = SYSTEM_GAP_PX + "px";

  const columns = document.createElement("div");
  columns.className = "pc-columns";
  columns.style.display = "grid";
  columns.style.position = "relative";
  columns.style.gridTemplateColumns = [
    ...gutters.map(g => g.style.width),
    `repeat(${slots}, minmax(${colMin}px, ${keySig ? keySig.maxColPx + "px" : "1fr"}))`,
  ].join(" ");

  const bg = document.createElementNS(NS, "svg");
  bg.setAttribute("class", "staff-lines-bg");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", String(grid.svgHeight));
  bg.style.display = "block";
  bg.style.gridRow = "1";
  // The staff runs behind the clef and key-signature gutters but not the
  // label strip, which sits outside the staff on its left (design §4.2).
  const firstStaffTrack = labelStrip ? 2 : 1;
  bg.style.gridColumn = `${firstStaffTrack} / span ${gutters.length - (firstStaffTrack - 1) + pitchClasses.length}`;
  bg.style.alignSelf = "start";
  bg.style.marginTop = grid.topLabelHeight + "px";
  if (config.display?.debugGrid) {
    const staffPositions = CNBStaff.getPositions(config, {
      minSemi: grid.minSemi,
      maxSemi: grid.maxSemi,
    });
    CNBGrid.renderDebugOverlay(bg, grid, staffPositions);
  }
  if (ledgerSpots) renderLedgerSpots(bg, grid, config);
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

/**
 * Every spot where the ledger rules could draw a ledger line in this
 * system's grid range (CNBLedgerSet.buildDefs), as a faint line across the
 * staff SVG, under the staff lines (session 26: the Ledger lines section's
 * preview, design §6). One line per drawn position: positions that a pitch
 * axis collapses onto one are drawn once.
 */
function renderLedgerSpots(bg, grid, config) {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "ledger-spots");
  const ys = new Set();
  for (const def of CNBLedgerSet.buildDefs(config, { minSemi: grid.minSemi, maxSemi: grid.maxSemi })) {
    ys.add(grid.semiToY(def.semi));
  }
  for (const y of [...ys].sort((a, b) => a - b)) {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("class", "ledger-spot");
    line.setAttribute("x1", "0");
    line.setAttribute("x2", "100%");
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "#2f5bd3");
    line.setAttribute("stroke-opacity", "0.35");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-dasharray", "4 4");
    g.appendChild(line);
  }
  bg.appendChild(g);
}

/** One fluid duration row: an optional caption, then one system or two. */
function renderFluidRow(config, { pitchClasses, duration, key, showCaption, rows, colMin, ledgerSpots, labelStrip }) {
  const row = document.createElement("div");
  row.className = "cnb-duration-row";
  if (showCaption) row.appendChild(durationCaption(config, duration));
  const systems = splitSystems(pitchClasses, rows);
  systems.forEach((pcs, i) => {
    row.appendChild(renderFluidSystem(config, {
      pitchClasses: pcs, duration, key, slots: systems[0].length, colMin, first: i === 0, ledgerSpots, labelStrip,
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
  const grid = CNBGrid.create(config, CNBCollection.gridRange(pitchClasses, config, [duration], key));

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
  // after the clef, left to right (binding rule 3). The first card's
  // notehead sets its right padding (session 34).
  const keySigGutterWidth = CNBKeySignature.gutterWidth(config, grid.pxPerSemi, key,
    firstHeadCenter(config, grid, pitchClasses, duration));

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
   * With a config, the range also holds the shown clef (CNBClef.extent,
   * session 45), to the whole semitone, so a clef that reaches past the
   * noteheads is not cut off. With durations, it also holds a breve's tie
   * under the lower noteheads (CNBCard.tieBottom, session 46), whole
   * semitones lower until it fits. With a key, a signature mark beyond the
   * range widens it to that mark with the noteheads' 4 semitones of headroom
   * (session 50), so a signature on a line set beyond the cards' pitches is
   * not cut off.
   *
   * @param {number[]} pitchClasses
   * @param {object} [config]
   * @param {string[]} [durations]  the durations the cards draw
   * @param {string|null} [keyName]  the key whose signature the row draws
   * @returns {{minSemi:number, maxSemi:number}}
   */
  gridRange(pitchClasses, config, durations = [], keyName = null) {
    const range = {
      minSemi: Math.min(...pitchClasses) - 4,
      maxSemi: Math.max(...pitchClasses) + 12 + 4,
    };
    const clef = config ? CNBClef.extent(config) : null;
    if (clef) {
      range.minSemi = Math.min(range.minSemi, Math.floor(clef.bottom));
      range.maxSemi = Math.max(range.maxSemi, Math.ceil(clef.top));
    }
    const signature = config && keyName ? CNBKeySignature.signatureSemis(config, keyName) : null;
    if (signature && signature.length > 0) {
      const low = Math.min(...signature);
      const high = Math.max(...signature);
      if (low < range.minSemi) range.minSemi = Math.floor(low) - 4;
      if (high > range.maxSemi) range.maxSemi = Math.ceil(high) + 4;
    }
    if (config) {
      const clipped = () => {
        const grid = CNBGrid.create(config, range);
        return durations.some(duration => pitchClasses.some(pc =>
          (CNBCard.tieBottom(config, grid, { pc, duration }) ?? 0) > grid.svgHeight));
      };
      while (clipped()) range.minSemi -= 1;
    }
    return range;
  },

  /**
   * The narrowest width a fluid row can take (session 25, design §6.1):
   * the label strip (with labelStrip), the clef and key-signature gutters plus one column minimum (the widest
   * column the shown cards need, rounded up, plus 2 px either side) per
   * slot. One row has a slot per pitch class; two rows have ceil(n / 2).
   * The page code compares the canvas width with it to choose the rows.
   *
   * @param {object} config
   * @param {{pitchClasses?:number[], durations?:string[], keys?:string[]|null,
   *          rows?:1|2, labelStrip?:boolean}} [options]  as for render()
   * @returns {number} px
   */
  minRowWidth(config, options = {}) {
    const pitchClasses = options.pitchClasses ?? DEFAULT_PCS;
    const durations = options.durations ?? ["crotchet"];
    const key = (options.keys && options.keys[0]) ?? null;
    const grid = CNBGrid.create(config, CNBCollection.gridRange(pitchClasses, config, [], key));
    const colMin = fluidColumnMin(config, grid, pitchClasses, durations);
    const slots = splitSystems(pitchClasses, options.rows)[0].length;
    const keySig = fluidKeySigTrack(config, grid, key, pitchClasses, durations[0], 0, slots, colMin);
    return (options.labelStrip === true ? LABEL_STRIP_PX : 0) +
      CNBClef.gutterWidth(config, grid.pxPerSemi) +
      (keySig ? keySig.minPx : 0) +
      slots * colMin;
  },

  /** The label strip's width in px (session 28): 4 + 2 × 26 + 4. */
  LABEL_STRIP_WIDTH: LABEL_STRIP_PX,

  /**
   * Render a collection of octave-chord cards and append it to container.
   *
   * @param {HTMLElement} container
   * @param {object} config
   * @param {{pitchClasses?:number[], durations?:string[], keys?:string[]|null,
   *          fluid?:boolean, rows?:1|2, ledgerSpots?:boolean, labelStrip?:boolean}} [options]
   *        pitchClasses defaults to the full chromatic row 0–12;
   *        durations defaults to ["crotchet"], one row per entry;
   *        keys[0] selects the key shown in the key-signature gutter
   *        (set 010); key ROWS remain deferred (cards render key = null).
   *        fluid (session 25, design §6.1): each row is a grid of equal
   *        columns no narrower than the widest, sharing any spare width,
   *        with the staff stretched to the row; rows 2 (fluid only) splits
   *        the pitch classes into two systems, C to F♯ and G to C′ for the
   *        full row, on the same column grid. ledgerSpots (fluid only,
   *        session 26) draws every candidate ledger spot as a faint
   *        line.ledger-spot under each system's staff lines. labelStrip
   *        (fluid only, session 28, design §4.2) puts div.label-col first in
   *        each system: one pitch-class label per semitone level with its
   *        spot and the middle of the staff marked, outside the staff. With
   *        fluid off the layout is the fixed one, unchanged.
   * @returns {HTMLDivElement} the div.cnb-preview element
   */
  render(container, config, options = {}) {
    const pitchClasses = options.pitchClasses ?? DEFAULT_PCS;
    const durations = options.durations ?? ["crotchet"];
    const key = (options.keys && options.keys[0]) ?? null;

    const root = document.createElement("div");
    root.className = "cnb-preview";

    if (options.fluid === true) {
      const grid = CNBGrid.create(config, CNBCollection.gridRange(pitchClasses, config, [], key));
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
          ledgerSpots: options.ledgerSpots === true,
          labelStrip: options.labelStrip === true,
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
