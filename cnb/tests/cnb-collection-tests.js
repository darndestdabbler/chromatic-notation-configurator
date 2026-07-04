/**
 * cnb-collection-tests.js — Unit tests for Module 10 (Card Collection)
 *
 * Tests gridRange plus the render() DOM structure (background staff SVG,
 * flex card row, duration rows) via the stub document; visual correctness
 * is verified on test-collection.html.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBCard } from "../src/cnb-card.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { withDomStub } from "./svg-stub.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function approx(a, b, msg, tol = 1e-9) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
}

/** Pick apart one duration row. */
function dissectRow(row) {
  const caption = row.children.find(c => c.className === "cnb-duration-caption") || null;
  const previewContainer = row.children.find(c => c.className === "preview-container");
  const bg = previewContainer.children.find(c => c.getAttribute("class") === "staff-lines-bg");
  const columns = previewContainer.children.find(c => c.className === "pc-columns");
  return { caption, previewContainer, bg, columns };
}

export const tests = [

  { name: "gridRange: 4 semitones of headroom below the lowest and above the highest chord", fn: () => {
      const full = CNBCollection.gridRange([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      eq(full.minSemi, -4, "full row min");
      eq(full.maxSemi, 28, "full row max (12 + 12 + 4)");
      const subset = CNBCollection.gridRange([3, 7]);
      eq(subset.minSemi, -1, "subset min");
      eq(subset.maxSemi, 23, "subset max");
    }},

  { name: "render: cnb-preview root appended to container, one row, 13 default cards", fn: () => {
      const config = CNBConfig.createDefault();
      withDomStub(container => {
        const root = CNBCollection.render(container, config);
        assert(container.children[0] === root, "appended to container");
        eq(root.className, "cnb-preview", "root class");
        eq(root.children.length, 1, "single duration row");
        const { caption, columns } = dissectRow(root.children[0]);
        assert(caption === null, "no caption for a single duration");
        eq(columns.children.length, 13, "full chromatic row of cards");
        assert(columns.children.every(c => c.className === "pc-col"), "all children are cards");
      });
    }},

  { name: "render: preview-container holds staff bg SVG (first) then pc-columns flex row", fn: () => {
      const config = CNBConfig.createDefault();
      withDomStub(container => {
        const root = CNBCollection.render(container, config);
        const { previewContainer, bg, columns } = dissectRow(root.children[0]);
        eq(previewContainer.children.length, 2, "bg + columns");
        assert(previewContainer.children[0] === bg, "bg painted behind (first)");
        assert(previewContainer.children[1] === columns, "columns on top");
        eq(previewContainer.style.position, "relative", "container positioned");
        eq(bg.style.position, "absolute", "bg absolute");
        eq(columns.style.display, "flex", "columns flex row");
      });
    }},

  { name: "render: staff bg sized to the summed column widths and grid svgHeight", fn: () => {
      const config = CNBConfig.createDefault();
      const pcs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const grid = CNBGrid.create(config, CNBCollection.gridRange(pcs));
      const totalWidth = pcs.reduce(
        (sum, pc) => sum + CNBCard.columnWidth(config, grid, { pc, duration: "crotchet" }), 0);
      withDomStub(container => {
        const root = CNBCollection.render(container, config);
        const { bg } = dissectRow(root.children[0]);
        approx(Number(bg.getAttribute("width")), totalWidth, "bg width = sum of columns");
        eq(bg.getAttribute("height"), String(grid.svgHeight), "bg height");
      });
    }},

  { name: "render: staff bg offset down by topLabelHeight so lines align with note-slices", fn: () => {
      const config = CNBConfig.createDefault();
      const grid = CNBGrid.create(config, CNBCollection.gridRange([0]));
      withDomStub(container => {
        const root = CNBCollection.render(container, config, { pitchClasses: [0] });
        const { bg } = dissectRow(root.children[0]);
        eq(bg.style.top, grid.topLabelHeight + "px", "top offset");
        eq(bg.style.left, "0", "left offset");
      });
    }},

  { name: "render: staff bg contains continuous lines at every staff position in range", fn: () => {
      const config = CNBConfig.createDefault();
      const range = CNBCollection.gridRange([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const positions = CNBStaff.getPositions(config, range); // 4-8 in [-4,28] → [-4,4,8,16,20,28]
      withDomStub(container => {
        const root = CNBCollection.render(container, config);
        const { bg } = dissectRow(root.children[0]);
        const staffG = bg.children.find(c => c.getAttribute("class") === "cnb-staff");
        assert(staffG, "staff group present");
        eq(staffG.children.length, positions.length, "one line per staff position");
        const width = bg.getAttribute("width");
        assert(staffG.children.every(l => l.getAttribute("x2") === width), "lines span full width");
      });
    }},

  { name: "render: pitchClasses subset renders only those cards, in order", fn: () => {
      const config = CNBConfig.createDefault();
      withDomStub(container => {
        const root = CNBCollection.render(container, config, { pitchClasses: [0, 4, 7] });
        const { columns } = dissectRow(root.children[0]);
        eq(columns.children.length, 3, "three cards");
        const texts = columns.children.map(c => c.children[0].children[0].children[0].textContent);
        eq(texts.join(","), "C,E,G", "card order follows pitchClasses");
      });
    }},

  { name: "render: one row per duration, each captioned with the duration displayName", fn: () => {
      const config = CNBConfig.createDefault();
      withDomStub(container => {
        const root = CNBCollection.render(container, config, { durations: ["crotchet", "minim"] });
        eq(root.children.length, 2, "two duration rows");
        const first = dissectRow(root.children[0]);
        const second = dissectRow(root.children[1]);
        eq(first.caption.textContent, "Crotchet (Quarter)", "first caption");
        eq(second.caption.textContent, "Minim (Half)", "second caption");
        eq(first.columns.children.length, 13, "first row full");
        eq(second.columns.children.length, 13, "second row full");
      });
    }},

  { name: "render: display.debugGrid adds the debug overlay behind the staff lines", fn: () => {
      const config = CNBConfig.createDefault();
      config.display.debugGrid = true;
      withDomStub(container => {
        const root = CNBCollection.render(container, config, { pitchClasses: [0, 1] });
        const { bg } = dissectRow(root.children[0]);
        eq(bg.children.length, 2, "debug group + staff group");
        eq(bg.children[0].getAttribute("class"), "cnb-debug-grid", "debug overlay first (behind)");
        eq(bg.children[1].getAttribute("class"), "cnb-staff", "staff lines on top");
      });
    }},

];
