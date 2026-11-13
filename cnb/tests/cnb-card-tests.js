/**
 * cnb-card-tests.js — Unit tests for Module 9 (Octave Chord Card)
 *
 * Tests resolveNotehead / columnWidth pure logic plus the render() DOM
 * structure via the stub document; visual correctness is verified on
 * test-card.html / test-collection.html. One engine-backed test (session 18)
 * checks repeat mode's spacing against a LilyPond render, skipping without
 * the engine.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBStem } from "../src/cnb-stem.js";
import { CNBCard } from "../src/cnb-card.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { withDomStub } from "./svg-stub.js";
import { findEngine, measureNoteheads, measureStems, measureTies, measureHeads } from "./engine-probe.js";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function approx(a, b, msg, tol = 1e-9) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
}

function fixture() {
  const config = CNBConfig.createDefault();
  const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
  const shape = config.shapes["crotchet-minim"];
  return { config, grid, shape };
}

/** Pick apart a rendered card's note-slice SVG. */
function dissect(col) {
  const [labelTop, svg, labelBottom] = col.children;
  const ledgerG = svg.children.find(c => c.getAttribute("class") === "cnb-ledger-set");
  const stem = svg.children.find(c => c.tag === "line");
  const noteheads = svg.children.filter(c => c.tag === "g" && c !== ledgerG);
  return { labelTop, svg, labelBottom, ledgerG, stem, noteheads };
}

export const tests = [

  // ── resolveNotehead ────────────────────────────────────────────────────────

  { name: "resolveNotehead: delegates rule walking (sharps hollow, naturals solid)", fn: () => {
      const { config } = fixture();
      assert(CNBCard.resolveNotehead(config, 1, "crotchet", null).hollow === true, "pc 1 hollow");
      assert(CNBCard.resolveNotehead(config, 0, "crotchet", null).hollow === false, "pc 0 solid");
      eq(CNBCard.resolveNotehead(config, 0, "crotchet", null).shape, "crotchet-minim", "shape");
    }},

  { name: "resolveNotehead: color falls back to black with no rule color", fn: () => {
      const { config } = fixture();
      eq(CNBCard.resolveNotehead(config, 0, "crotchet", null).color, "#000000", "fallback color");
    }},

  { name: "resolveNotehead: a leftover palette is not read (session 37)", fn: () => {
      const { config } = fixture();
      config.palette = { colors: [{ pc: 0, hex: "#FF0000", name: "Red" }] };
      eq(CNBCard.resolveNotehead(config, 0, "crotchet", null).color, "#000000", "black");
    }},

  { name: "resolveNotehead: a later rule's colour overrides an earlier one", fn: () => {
      const { config } = fixture();
      config.noteheadRules.push({ name: "Colour", priority: 2, match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { color: "#FF0000" } });
      config.noteheadRules.push({
        name: "C is blue", priority: 3,
        match: { pitchClasses: [0], durations: "all", keys: "all" },
        apply: { color: "#0000FF" },
      });
      eq(CNBCard.resolveNotehead(config, 0, "crotchet", null).color, "#0000FF", "rule color wins");
    }},

  { name: "resolveNotehead: pc 12 (upper C) normalizes to pitch class 0", fn: () => {
      const { config } = fixture();
      config.noteheadRules.push({ name: "Colour", priority: 2, match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { color: "#FF0000" } });
      eq(CNBCard.resolveNotehead(config, 12, "crotchet", null).color, "#FF0000", "pc 12 → pc 0");
    }},

  // ── columnWidth ────────────────────────────────────────────────────────────

  { name: "columnWidth = the engine's ledger (1.5 notehead widths) + 2 × paddingH", fn: () => {
      const { config, grid, shape } = fixture();
      const { pixelWidth } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const expected = pixelWidth * 1.5 + 2 * config.display.column.paddingH;
      approx(CNBCard.columnWidth(config, grid, { pc: 0, duration: "crotchet" }), expected, "column width");
    }},

  { name: "headCenterX: the column's middle, moved by half a pitch-axis offset (session 34)", fn: () => {
      const { config, grid } = fixture();
      approx(CNBCard.headCenterX(config, grid, { pc: 0, duration: "crotchet" }),
        CNBCard.columnWidth(config, grid, { pc: 0, duration: "crotchet" }) / 2, "linear: the middle");
      const axis = axisFixture();
      const offsetPx = 0.85 * 2 * axis.grid.pxPerSemi;      // OFFSET_RULE on C♯: 0.85 staff spaces of 2 axis units
      approx(CNBCard.headCenterX(axis.config, axis.grid, { pc: 1, duration: "crotchet" }),
        CNBCard.columnWidth(axis.config, axis.grid, { pc: 1, duration: "crotchet" }) / 2 + offsetPx / 2, "axis: half the offset");
    }},

  // ── render: structure ──────────────────────────────────────────────────────

  { name: "render: pc-col with label-top, note-slice svg, label-bottom; appended to container", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 0, duration: "crotchet" });
        assert(container.children[0] === col, "appended to container");
        eq(col.className, "pc-col", "column class");
        eq(col.children.length, 3, "three children");
        eq(col.children[0].className, "label-top", "label-top first");
        eq(col.children[1].getAttribute("class"), "note-slice", "note-slice second");
        eq(col.children[2].className, "label-bottom", "label-bottom last");
      });
    }},

  { name: "render: svg sized to column width × grid svgHeight; labels sized to grid label heights", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 0, duration: "crotchet" });
        const colWidth = CNBCard.columnWidth(config, grid, { pc: 0, duration: "crotchet" });
        const { labelTop, svg, labelBottom } = dissect(col);
        eq(svg.getAttribute("width"), String(colWidth), "svg width");
        eq(svg.getAttribute("height"), String(grid.svgHeight), "svg height");
        eq(labelTop.style.height, grid.topLabelHeight + "px", "top label height");
        eq(labelBottom.style.height, grid.bottomLabelHeight + "px", "bottom label height");
        eq(col.style.width, colWidth + "px", "column width style");
      });
    }},

  // ── render: fluid layout (session 25) ─────────────────────────────────────

  { name: "render: without layout.fluid the column has a fixed width and no data-pc", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 3, duration: "crotchet" }, { fluid: false });
        eq(col.getAttribute("data-pc"), null, "no data-pc");
        eq(col.style.flex, "0 0 auto", "fixed flex basis");
        eq(dissect(col).svg.style.margin, undefined, "slice not centred by margin");
      });
    }},

  { name: "render: layout.fluid fills the grid cell, centres the slice and marks data-pc", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const fixed = CNBCard.render(container, grid, config, { pc: 3, duration: "crotchet" });
        const col = CNBCard.render(container, grid, config, { pc: 3, duration: "crotchet" }, { fluid: true });
        const colWidth = CNBCard.columnWidth(config, grid, { pc: 3, duration: "crotchet" });
        eq(col.getAttribute("data-pc"), "3", "data-pc");
        eq(col.style.width, undefined, "no fixed column width");
        eq(col.style.flex, undefined, "no flex basis");
        const { svg } = dissect(col);
        eq(svg.getAttribute("width"), String(colWidth), "slice keeps its own width");
        eq(svg.style.margin, "0 auto", "slice centred");
        // The drawing itself is the fixed-layout drawing.
        eq(JSON.stringify(svg.children), JSON.stringify(dissect(fixed).svg.children), "same drawing");
      });
    }},

  { name: "render: layout.fluid marks data-ledgers, the number of ledger lines drawn; fixed columns do not", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        for (const pc of [0, 2, 5]) {
          const col = CNBCard.render(container, grid, config, { pc, duration: "crotchet" }, { fluid: true });
          const ledgers = dissect(col).svg.children.find(c => c.getAttribute("class") === "cnb-ledger-set");
          eq(col.getAttribute("data-ledgers"), String(ledgers.children.length), `pc ${pc}: the count drawn`);
        }
        const c = CNBCard.render(container, grid, config, { pc: 0, duration: "crotchet" }, { fluid: true });
        assert(Number(c.getAttribute("data-ledgers")) > 0, "C draws a ledger line");
        const f = CNBCard.render(container, grid, config, { pc: 5, duration: "crotchet" }, { fluid: true });
        eq(f.getAttribute("data-ledgers"), "0", "F draws none");
        const fixed = CNBCard.render(container, grid, config, { pc: 0, duration: "crotchet" });
        eq(fixed.getAttribute("data-ledgers"), null, "no data-ledgers off fluid");
      });
    }},

  { name: "render: layout.fluid marks the upper C as data-pc 12", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 12, duration: "crotchet" }, { fluid: true });
        eq(col.getAttribute("data-pc"), "12", "data-pc of C′");
      });
    }},

  { name: "render: draw order is ledgers, stem, then two noteheads on top", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 0, duration: "crotchet" });
        const { svg, ledgerG, stem, noteheads } = dissect(col);
        eq(svg.children.length, 4, "ledger group + stem + 2 notehead groups");
        assert(svg.children[0] === ledgerG, "ledgers first");
        assert(svg.children[1] === stem, "stem second");
        eq(noteheads.length, 2, "two notehead groups");
        assert(svg.children[2] === noteheads[0] && svg.children[3] === noteheads[1], "noteheads last");
      });
    }},

  // ── render: labels ─────────────────────────────────────────────────────────

  { name: "render: both labels carry the pitch-class text (natural: no sharp span)", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 2, duration: "crotchet" });
        const { labelTop, labelBottom } = dissect(col);
        for (const label of [labelTop, labelBottom]) {
          const card = label.children[0];
          eq(card.className, "cnb-label-card", "material card span");
          eq(card.children.length, 1, "text only, no sharp span");
          eq(card.children[0].textContent, "D", "label text");
        }
      });
    }},

  { name: "render: sharp pitch class gets a styled ♯ span", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 1, duration: "crotchet" });
        const card = dissect(col).labelTop.children[0];
        eq(card.children.length, 2, "text + sharp spans");
        eq(card.children[0].textContent, "C", "base text");
        eq(card.children[1].textContent, "♯", "sharp glyph");
        eq(card.children[1].style.fontSize, config.display.label.sharpStyle.fontSize + "em", "sharp size");
      });
    }},

  { name: "render: pc 12 (upper C) labeled C", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 12, duration: "crotchet" });
        eq(dissect(col).labelTop.children[0].children[0].textContent, "C", "pc 12 label");
      });
    }},

  // ── render: ledgers ────────────────────────────────────────────────────────

  { name: "render: C chord (semis 0+12) shows ledgers at 0 and 12", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 0, duration: "crotchet" });
        const { ledgerG } = dissect(col);
        eq(ledgerG.children.length, 2, "two ledger lines");
        const ys = ledgerG.children.map(c => Number(c.getAttribute("y")) + Number(c.getAttribute("height")) / 2);
        approx(ys[0], grid.semiToY(0), "ledger at semi 0");
        approx(ys[1], grid.semiToY(12), "ledger at semi 12");
      });
    }},

  { name: "render: E chord (on staff lines) shows no ledgers", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 4, duration: "crotchet" });
        eq(dissect(col).ledgerG.children.length, 0, "no ledger lines");
      });
    }},

  // ── render: stem ───────────────────────────────────────────────────────────

  { name: "render: stem line matches CNBStem.geometry (pc 0, direction up, right of center)", fn: () => {
      const { config, grid, shape } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 0, duration: "crotchet" });
        const { stem } = dissect(col);
        assert(stem, "stem rendered");
        const colWidth = CNBCard.columnWidth(config, grid, { pc: 0, duration: "crotchet" });
        const centerX = colWidth / 2;
        const { scaleFactor } = CNBNotehead.measure(shape, grid.pxPerSemi);
        const geo = CNBStem.geometry(config, {
          gridContext: grid, shape, scaleFactor, centerX,
          noteYPositions: [grid.semiToY(0), grid.semiToY(12)],
          direction: "up", duration: "crotchet",
        });
        eq(stem.getAttribute("x1"), String(geo.x), "stem x");
        eq(stem.getAttribute("y1"), String(geo.y1), "stem y1");
        eq(stem.getAttribute("y2"), String(geo.y2), "stem y2");
        assert(geo.x > centerX, "stem up → right side of noteheads");
      });
    }},

  { name: "render: chord at/above midpoint stems down (pc 12 → left side)", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 12, duration: "crotchet" });
        const { stem } = dissect(col);
        assert(stem, "stem rendered");
        const centerX = CNBCard.columnWidth(config, grid, { pc: 12, duration: "crotchet" }) / 2;
        assert(Number(stem.getAttribute("x1")) < centerX, "stem down → left side");
      });
    }},

  { name: "render: stemless duration (semibreve, hasStem false) draws no stem", fn: () => {
      const { config, grid } = fixture();
      // Shape still resolves to crotchet-minim via the Default rule ("all" durations)
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 0, duration: "semibreve" });
        const { svg, stem } = dissect(col);
        assert(!stem, "no stem line");
        eq(svg.children.length, 3, "ledger group + 2 notehead groups only");
      });
    }},

  // ── render: noteheads ──────────────────────────────────────────────────────

  { name: "render: noteheads sit at semiToY(pc) and semiToY(pc+12), centered on the column", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 3, duration: "crotchet" });
        const { noteheads } = dissect(col);
        const centerX = CNBCard.columnWidth(config, grid, { pc: 3, duration: "crotchet" }) / 2;
        eq(noteheads[0].getAttribute("transform"), `translate(${centerX},${grid.semiToY(3)})`, "lower notehead");
        eq(noteheads[1].getAttribute("transform"), `translate(${centerX},${grid.semiToY(15)})`, "upper notehead");
      });
    }},

  { name: "render: hollow pc renders white overlay paths on both noteheads", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 1, duration: "crotchet" });
        const { noteheads } = dissect(col);
        for (const g of noteheads) {
          eq(g.children.length, 2, "main path + hollow overlay");
          eq(g.children[1].getAttribute("fill"), "white", "overlay white");
        }
      });
    }},

  { name: "render: resolved color reaches both notehead fills", fn: () => {
      const { config, grid } = fixture();
      config.noteheadRules.push({ name: "Colour", priority: 2, match: { pitchClasses: [5], durations: "all", keys: "all" }, apply: { color: "#1B9E77" } });
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 5, duration: "crotchet" });
        const { noteheads } = dissect(col);
        eq(noteheads[0].children[0].getAttribute("fill"), "#1B9E77", "lower fill");
        eq(noteheads[1].children[0].getAttribute("fill"), "#1B9E77", "upper fill");
      });
    }},

  // ── Pitch axis (set 014 s2, design §2.3 / §3.3) ───────────────────────────

  { name: "columnWidth (axis): widens by |xOffsetStaffSpaces × unitsPerStaffSpace × pxPerSemi|", fn: () => {
      const { config, grid } = axisFixture();
      const linear = fixture();
      const base = CNBCard.columnWidth(linear.config, linear.grid, { pc: 0, duration: "crotchet" });
      approx(CNBCard.columnWidth(config, grid, { pc: 0, duration: "crotchet" }), base, "no offset on C");
      approx(CNBCard.columnWidth(config, grid, { pc: 1, duration: "crotchet" }), base + 0.85 * 2 * 16, "C♯ widened by 27.2px");
    }},

  { name: "render (axis): offset heads, their ledgers and the stem all shift by the offset", fn: () => {
      const { config, grid, shape } = axisFixture();
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 1, duration: "crotchet" });
        const { svg, ledgerG, stem, noteheads } = dissect(col);
        const colWidth = Number(svg.getAttribute("width"));
        const headX = colWidth / 2 + (0.85 * 2 * 16) / 2;
        for (const [i, semi] of [[0, 1], [1, 13]]) {
          approx(Number(/translate\(([^,]+),/.exec(noteheads[i].getAttribute("transform"))[1]), headX, `head ${i} x`);
          approx(Number(/,([^)]+)\)/.exec(noteheads[i].getAttribute("transform"))[1]), grid.semiToY(semi), `head ${i} y`);
        }
        assert(ledgerG.children.length > 0, "C♯ draws its C ledger");
        const ledger = ledgerG.children[0];
        approx(Number(ledger.getAttribute("x")) + Number(ledger.getAttribute("width")) / 2, headX, "ledger centered on the head");
        const { scaleFactor } = CNBNotehead.measure(shape, grid.pxPerSemi);
        approx(stemCentre(stem), headX + shape.anchors.crotchetUp.x * scaleFactor, "stem follows the head (up)");
      });
    }},

  { name: "render (axis): stem direction reads the axis (C♯ pair up on Twinline, down linearly)", fn: () => {
      const { config, grid, shape } = axisFixture();
      const { scaleFactor } = CNBNotehead.measure(shape, grid.pxPerSemi);
      withDomStub(container => {
        const { svg, stem } = dissect(CNBCard.render(container, grid, config, { pc: 1, duration: "crotchet" }));
        assert(Number(stem.getAttribute("x1")) > Number(svg.getAttribute("width")) / 2, "axis: stem right of center (up)");
      });
      const linear = CNBConfig.clone(config);
      linear.pitchAxis.enabled = false;
      const lgrid = CNBGrid.create(linear, { minSemi: -4, maxSemi: 28 });
      withDomStub(container => {
        const { svg, stem } = dissect(CNBCard.render(container, lgrid, linear, { pc: 1, duration: "crotchet" }));
        approx(stemCentre(stem),
          Number(svg.getAttribute("width")) / 2 + shape.anchors.crotchetDown.x * scaleFactor, "linear: stem down, unshifted");
      });
    }},

  { name: "render (linear): xOffsetStaffSpaces rules are ignored — identical DOM", fn: () => {
      const { config: plain, grid } = fixture();
      const withRule = CNBConfig.clone(plain);
      withRule.noteheadRules.push(OFFSET_RULE);
      for (const pc of [0, 1, 4]) {
        const a = withDomStub(c => JSON.stringify(CNBCard.render(c, grid, plain, { pc, duration: "crotchet" })));
        const b = withDomStub(c => JSON.stringify(CNBCard.render(c, grid, withRule, { pc, duration: "crotchet" })));
        eq(b, a, `pc ${pc} card DOM`);
        eq(CNBCard.columnWidth(withRule, grid, { pc, duration: "crotchet" }),
          CNBCard.columnWidth(plain, grid, { pc, duration: "crotchet" }), `pc ${pc} width`);
      }
    }},

  // ── Repeat mode (session 18: the engine's cnb:build-duration-stencil) ─────

  { name: "repeatCount: 1 in shape mode; heads per group in repeat mode (minim 2, semibreve 4, breve 4)", fn: () => {
      const { config } = fixture();
      for (const d of ["crotchet", "minim", "semibreve", "breve"]) eq(CNBCard.repeatCount(config, d), 1, `shape ${d}`);
      const rep = repeatFixture().config;
      eq(CNBCard.repeatCount(rep, "crotchet"), 1, "crotchet");
      eq(CNBCard.repeatCount(rep, "minim"), 2, "minim");
      eq(CNBCard.repeatCount(rep, "semibreve"), 4, "semibreve");
      eq(CNBCard.repeatCount(rep, "breve"), 4, "breve");
      eq(CNBCard.repeatCount(rep, "no-such-duration"), 1, "unknown duration");
      rep.durations.repeatCounts = { minim: 3, semibreve: 8, breve: 8 };
      eq(CNBCard.repeatCount(rep, "breve"), 4, "repeatCounts is not read");
    }},

  { name: "tiedGroups: a breve is two tied semibreve groups in repeat mode, every other duration one", fn: () => {
      const { config } = fixture();
      for (const d of ["crotchet", "minim", "semibreve", "breve"]) eq(CNBCard.tiedGroups(config, d), 1, `shape ${d}`);
      const rep = repeatFixture().config;
      for (const d of ["crotchet", "minim", "semibreve", "no-such-duration"]) eq(CNBCard.tiedGroups(rep, d), 1, d);
      eq(CNBCard.tiedGroups(rep, "breve"), 2, "breve");
    }},

  { name: "repeatLayout (breve): two semibreve groups 1 staff space apart, one tie below the heads from the middle of the first group to the middle of the second", fn: () => {
      const { config, grid, shape } = repeatFixture();
      const { pixelWidth: w, pixelHeight: hh } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const step = w * (2 / 3);
      const semibreve = CNBCard.repeatLayout(config, grid, shape, "semibreve");
      const ws = semibreve.groupWidth;
      const gap = 4 * 16;
      const breve = CNBCard.repeatLayout(config, grid, shape, "breve");
      eq(breve.count, 8, "8 heads");
      approx(breve.groupWidth, 2 * ws + gap, "two groups and the gap");
      approx(breve.staffSpacePx, 64, "staff space px");
      const pitch = ws + gap;
      [-1.5, -0.5, 0.5, 1.5].forEach((k, i) => {
        approx(breve.offsets[i], -pitch / 2 + k * step, `left group head ${i}`);
        approx(breve.offsets[i + 4], pitch / 2 + k * step, `right group head ${i}`);
      });
      eq(breve.ties.length, 1, "one tie");
      approx(breve.ties[0].x1, -pitch / 2, "tie from the middle of the first group");
      approx(breve.ties[0].x2, pitch / 2, "to the middle of the second");
      approx(breve.ties[0].x1, (breve.offsets[0] + breve.offsets[3]) / 2, "the first group's middle, between its heads");
      approx(breve.ties[0].dy, hh / 2, "its ends at the heads' bottom");
      eq(semibreve.ties.length, 0, "semibreve: no tie");
      eq(CNBCard.repeatLayout(fixture().config, grid, shape, "breve").count, 1, "shape mode: one head");
    }},

  { name: "tiePath: LilyPond's make-tie-stencil, bowing down from the ends, 0.12 staff spaces thick", fn: () => {
      const ss = 64;
      const tie = CNBCard.tiePath(100, 164, 50, ss);
      // slur height for a 1-staff-space tie: (2/π) atan(π × 1 × 0.33 / 2)
      const h = (2 / Math.PI) * Math.atan(Math.PI * 0.33 / 2);
      approx(tie.height, h * ss, "bow height");
      approx(tie.strokeWidth, 0.1 * ss, "stroked at min(2 × 0.12, 0.1) staff spaces");
      const n = tie.d.match(/-?[\d.]+(e-?\d+)?/g).map(Number);
      eq(n.length, 14, "move, two curves of three points");
      approx(n[0], 100, "starts at x1"); approx(n[1], 50, "on the ends' y");
      approx(n[6], 164, "ends at x2"); approx(n[7], 50, "on the ends' y");
      approx(n[2], 100 + 0.25 * 64, "angularity 0.5: control at a quarter");
      approx(n[3], 50 + (4 / 3) * h * ss, "outer control below the ends: bows down");
      approx(n[9], 50 + ((4 / 3) * h - 0.12) * ss, "inner control 0.12 staff spaces inside");
      // The outer curve's middle: (1/8)(p0 + 3 c1 + 3 c2 + p3) in y.
      approx((n[1] + 3 * n[3] + 3 * n[5] + n[7]) / 8, 50 + h * ss, "middle of the bow at the bow height");
    }},

  { name: "render (repeat): a breve draws 16 heads, a tie on each of the pair, ledgers 1.5 × the whole", fn: () => {
      const { config, grid, shape } = repeatFixture();
      config.noteheadRules.push({ name: "red", priority: 5, match: { pitchClasses: [0], durations: "all", keys: "all" }, apply: { color: "#ff0000" } });
      const layout = CNBCard.repeatLayout(config, grid, shape, "breve");
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 0, duration: "breve" });
        const { svg, ledgerG, stem, noteheads } = dissect(col);
        eq(noteheads.length, 16, "8 octave pairs");
        assert(stem === undefined, "no stem");
        const centerX = Number(svg.getAttribute("width")) / 2;
        const ties = svg.children.filter(c => c.getAttribute("class") === "cnb-tie");
        eq(ties.length, 2, "a tie on each notehead of the pair");
        ties.forEach((t, i) => {
          const y = grid.semiToY(i === 0 ? 0 : 12) + CNBNotehead.measure(shape, grid.pxPerSemi).pixelHeight / 2;
          eq(t.getAttribute("d"), CNBCard.tiePath(centerX + layout.ties[0].x1, centerX + layout.ties[0].x2, y, 64).d, `tie ${i}: below the heads, the middle of one group to the middle of the other`);
          eq(t.getAttribute("fill"), "#000000", "black, whatever the notehead's colour, as the engine engraves it");
          eq(t.getAttribute("stroke"), "#000000", "outlined black");
        });
        approx(Number(ledgerG.children[0].getAttribute("width")), 1.5 * layout.groupWidth, "ledger: 1.5 × the whole breve");
      });
      approx(CNBCard.columnWidth(config, grid, { pc: 0, duration: "breve" }), 1.5 * layout.groupWidth + 2 * 16, "column");
      withDomStub(container => {
        const { svg } = dissect(CNBCard.render(container, grid, config, { pc: 0, duration: "semibreve" }));
        eq(svg.children.filter(c => c.getAttribute("class") === "cnb-tie").length, 0, "semibreve: no tie");
      });
    }},

  { name: "reference point (session 60): the heads, the stem's start and the breve's tie move with it; the ledgers stay", fn: () => {
      const { config, grid } = repeatFixture();
      const plain = CNBConfig.clone(config);
      config.shapes["crotchet-minim"].reference = { x: 25, y: 60 };
      const shape = config.shapes["crotchet-minim"];
      const shift = -60 * CNBNotehead.measure(shape, grid.pxPerSemi).scaleY;
      const breve = CNBCard.repeatLayout(config, grid, shape, "breve");
      approx(breve.ties[0].dy, CNBCard.repeatLayout(plain, grid, plain.shapes["crotchet-minim"], "breve").ties[0].dy + shift,
        "the tie at the moved heads' bottom");
      approx(CNBCard.tieBottom(config, grid, { pc: 2, duration: "breve" }),
        CNBCard.tieBottom(plain, grid, { pc: 2, duration: "breve" }) + shift, "tieBottom follows");
      for (const duration of ["crotchet", "minim"]) {
        withDomStub(container => {
          const a = dissect(CNBCard.render(container, grid, plain, { pc: 0, duration }));
          const b = dissect(CNBCard.render(container, grid, config, { pc: 0, duration }));
          const ys = n => n.map(g => Number(g.getAttribute("transform").match(/,(-?[\d.e-]+)\)/)[1]));
          ys(b.noteheads).forEach((y, i) => approx(y, ys(a.noteheads)[i] + shift, `${duration} head ${i}`, 1e-6));
          approx(Number(b.stem.getAttribute("y1")), Number(a.stem.getAttribute("y1")) + shift, `${duration}: the stem's start`, 1e-6);
          approx(Number(b.stem.getAttribute("y2")), Number(a.stem.getAttribute("y2")), `${duration}: its far end`, 1e-6);
          eq(JSON.stringify(b.ledgerG.children.map(l => l.getAttribute("y"))),
            JSON.stringify(a.ledgerG.children.map(l => l.getAttribute("y"))), `${duration}: the ledgers at the pitch`);
        });
      }
    }},

  { name: "tieBottom: the lowest ink of the tie under the lower notehead; null without a tie", fn: () => {
      const { config, grid, shape } = repeatFixture();
      const layout = CNBCard.repeatLayout(config, grid, shape, "breve");
      const tie = CNBCard.tiePath(layout.ties[0].x1, layout.ties[0].x2, 0, 64);
      approx(CNBCard.tieBottom(config, grid, { pc: 2, duration: "breve" }),
        grid.semiToY(2) + layout.ties[0].dy + tie.height + tie.strokeWidth / 2, "bow's middle plus half the stroke");
      eq(CNBCard.tieBottom(config, grid, { pc: 2, duration: "semibreve" }), null, "semibreve: no tie");
      eq(CNBCard.tieBottom(fixture().config, grid, { pc: 2, duration: "breve" }), null, "shape mode: no tie");
    }},

  { name: "repeatLayout: each copy 2/3 of a head's width after the last, the default overlap 1/3", fn: () => {
      const { config, grid, shape } = repeatFixture();
      const { pixelWidth: w } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const step = w * (2 / 3);
      const crotchet = CNBCard.repeatLayout(config, grid, shape, "crotchet");
      eq(crotchet.count, 1, "crotchet count");
      eq(crotchet.offsets.length, 1, "crotchet one offset");
      approx(crotchet.groupWidth, w, "crotchet width");
      const minim = CNBCard.repeatLayout(config, grid, shape, "minim");
      eq(minim.count, 2, "minim count");
      approx(minim.offsets[0], -step / 2, "minim left");
      approx(minim.offsets[1], step / 2, "minim right");
      approx(minim.groupWidth, w + step, "minim group width");
      const semibreve = CNBCard.repeatLayout(config, grid, shape, "semibreve");
      [-1.5, -0.5, 0.5, 1.5].forEach((k, i) => approx(semibreve.offsets[i], k * step, `semibreve ${i}`));
      approx(semibreve.groupWidth, w + 3 * step, "semibreve group width");
    }},

  { name: "repeatLayout: durations.repeatOverlap changes the step; engine.multinotePadding is not read", fn: () => {
      const { config, grid, shape } = repeatFixture();
      const { pixelWidth: w } = CNBNotehead.measure(shape, grid.pxPerSemi);
      config.durations.repeatOverlap = 0.5;
      const half = CNBCard.repeatLayout(config, grid, shape, "minim");
      approx(half.offsets[1] - half.offsets[0], w / 2, "half a head's width at 0.5");
      approx(half.groupWidth, 1.5 * w, "group width");
      config.durations.repeatOverlap = 0;
      approx(CNBCard.repeatLayout(config, grid, shape, "semibreve").groupWidth, 4 * w, "edge to edge at 0");
      config.durations.repeatOverlap = 0.25;
      config.engine.multinotePadding = 3;
      approx(CNBCard.repeatLayout(config, grid, shape, "minim").groupWidth, 1.75 * w, "a saved multinotePadding changes nothing");
      delete config.durations.repeatOverlap;
      approx(CNBCard.repeatLayout(config, grid, shape, "minim").groupWidth, w + w * (2 / 3), "no repeatOverlap: 1/3");
    }},

  { name: "repeatLayout (axis): the step is a share of the head's width, whatever the staff space", fn: () => {
      const { config, grid, shape } = axisFixture();
      config.durations.representationMode = "repeat";
      const { pixelWidth: w } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const minim = CNBCard.repeatLayout(config, grid, shape, "minim");
      approx(minim.offsets[1] - minim.offsets[0], w * (2 / 3), "step at 2 units per staff space");
      approx(minim.staffSpacePx, 2 * 16, "a staff space is 2 axis units");
    }},

  { name: "render (repeat): minim draws 2 octave pairs, semibreve 4; heads, stem and ledgers follow the group", fn: () => {
      const { config, grid, shape } = repeatFixture();
      const { pixelWidth: w, scaleFactor } = CNBNotehead.measure(shape, grid.pxPerSemi);
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 0, duration: "minim" });
        const { svg, ledgerG, stem, noteheads } = dissect(col);
        eq(noteheads.length, 4, "minim: 2 pairs");
        const layout = CNBCard.repeatLayout(config, grid, shape, "minim");
        const centerX = Number(svg.getAttribute("width")) / 2;
        noteheads.forEach((g, i) => approx(Number(/translate\(([^,]+),/.exec(g.getAttribute("transform"))[1]),
          centerX + layout.offsets[Math.floor(i / 2)], `head ${i} x`));
        const half = Number(stem.getAttribute("stroke-width")) / 2;
        approx(stemEdge(stem, "up"),
          centerX + (shape.anchors.minimUp.x * scaleFactor + half) * (layout.groupWidth / w),
          "the stem's anchored edge at its relative position across the group, as LilyPond scales the attachment");
        const ledger = ledgerG.children[0];
        approx(Number(ledger.getAttribute("width")), 1.5 * layout.groupWidth, "ledger: 1.5 × the group, as LilyPond draws it");
        approx(CNBCard.columnWidth(config, grid, { pc: 0, duration: "minim" }),
          CNBCard.columnWidth(fixture().config, grid, { pc: 0, duration: "minim" }) + 1.5 * (layout.groupWidth - w), "column widened by the group's ledger");
      });
      withDomStub(container => {
        const { noteheads, stem } = dissect(CNBCard.render(container, grid, config, { pc: 0, duration: "semibreve" }));
        eq(noteheads.length, 8, "semibreve: 4 pairs");
        assert(stem === undefined, "semibreve: no stem");
      });
    }},

  { name: "render: shape mode draws one pair per duration; repeat-mode crotchet is identical to shape mode", fn: () => {
      const { config, grid } = fixture();
      withDomStub(container => {
        eq(dissect(CNBCard.render(container, grid, config, { pc: 0, duration: "minim" })).noteheads.length, 2, "shape minim");
      });
      const rep = repeatFixture().config;
      for (const pc of [0, 1, 4]) {
        const a = withDomStub(c => JSON.stringify(CNBCard.render(c, grid, config, { pc, duration: "crotchet" })));
        const b = withDomStub(c => JSON.stringify(CNBCard.render(c, grid, rep, { pc, duration: "crotchet" })));
        eq(b, a, `pc ${pc} crotchet DOM`);
      }
    }},

  // Engine-backed (session 18): the Kite and 45deg-369 fixtures are in repeat
  // mode; each engraved minim, semibreve and breve stencil (the engine's
  // repeated heads, cnb:build-duration-stencil) is as wide, in staff spaces,
  // as the preview's repeated group. Skips with the reason logged without
  // LilyPond or the engine.
  //
  // Since session 58 (engine session 39, engine 1.7.0) the copies overlap by
  // a share of the head's width, cnb:multinote-overlap, and the breve's tie
  // runs from the middle of its first semibreve group to the middle of the
  // second. Every width and the tie are held to 0.001 staff spaces, at the
  // default overlap (1/3) and at 0.25. The engraved head is a little wider
  // than the preview's (Kite 1.3335 vs 1.3333: the export writes path
  // coordinates to 4 places), and every head-proportional length scales with
  // it, so each is compared with the preview's layout of the engraved head:
  // its head-proportional part times the engraved head ÷ the preview's (the
  // 1 staff space between a breve's groups does not scale).
  //
  // The tie (sessions 46 and 58) is read from the engraved stencil
  // (measureTies): its ends at the two groups' centres, each measured from
  // its own edge of the stencil (half a group in), and at the heads' bottom;
  // its lowest ink; and the breve's height from the heads' top to it.
  { name: "repeatLayout (engine): Kite and 45deg-369 repeated heads, at overlaps 1/3 and 0.25, engrave at the preview's widths, and the breve's tie at its groups' centres (0.001 staff spaces)", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const failures = [];
      const check = (what, engraved, preview) => {
        if (!(Math.abs(engraved - preview) <= 0.001)) failures.push(`${what}: engraved ${engraved} staff spaces, preview ${preview}`);
      };
      for (const file of ["kite-4-369-config.json", "45deg-369-config.json"]) {
        for (const overlap of [undefined, 0.25]) {
          const config = CNBConfigIO.loadFromText(readFileSync(path.join(FIXTURES, file), "utf8")).config;
          if (overlap !== undefined) config.durations.repeatOverlap = overlap;
          const label = `${file} at overlap ${config.durations.repeatOverlap}`;
          const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
          const unitsPerStaffSpace = grid.axis?.enabled ? grid.axis.unitsPerStaffSpace : config.staff.semitonesPerStaffSpace;
          const ss = grid.pxPerSemi * unitsPerStaffSpace;
          const ly = CNBLilypond.generate(config);
          const scale = {};   // per pc: the engraved head's width ÷ the preview's
          for (const [duration, token] of [["crotchet", "4"], ["minim", "2"], ["semibreve", "1"], ["breve", "\\breve"]]) {
            const { noteheads, error } = await measureNoteheads(engine, ly, token);
            if (error) { failures.push(`${label} ${duration}: ${error}`); continue; }
            for (const { pc, width, height } of noteheads) {
              const shape = config.shapes[CNBCard.resolveNotehead(config, pc, duration, null).shape];
              const head = CNBNotehead.measure(shape, grid.pxPerSemi);
              if (duration === "crotchet") { scale[pc] = width / (head.pixelWidth / ss); continue; }
              const layout = CNBCard.repeatLayout(config, grid, shape, duration);
              const gaps = CNBCard.tiedGroups(config, duration) - 1;   // 1 staff space each
              check(`${label} ${duration} pc ${pc} width`, width, (layout.groupWidth / ss - gaps) * scale[pc] + gaps);
              if (duration !== "breve") continue;
              // From the heads' top to the tie's lowest ink (session 46).
              check(`${label} breve pc ${pc} height`, height,
                (head.pixelHeight / 2 + CNBCard.tieBottom(config, grid, { pc, duration }) - grid.semiToY(pc)) / ss);
            }
          }
          const { ties, error } = await measureTies(engine, ly);
          if (error) { failures.push(`${label} tie: ${error}`); continue; }
          for (const { pc, start, end, x, y } of ties) {
            const shape = config.shapes[CNBCard.resolveNotehead(config, pc, "breve", null).shape];
            const layout = CNBCard.repeatLayout(config, grid, shape, "breve");
            const [tie] = layout.ties;
            const headPx = CNBNotehead.measure(shape, grid.pxPerSemi).pixelWidth;
            // Half a group: from the stencil's left edge to the first group's centre.
            const halfGroup = (tie.x1 - (layout.offsets[0] - headPx / 2)) / ss * scale[pc];
            const ends = -tie.dy / ss;
            check(`${label} breve pc ${pc} tie start x`, start[0] - x[0], halfGroup);
            check(`${label} breve pc ${pc} tie end x`, x[1] - end[0], halfGroup);
            check(`${label} breve pc ${pc} tie start y`, start[1], ends);
            check(`${label} breve pc ${pc} tie end y`, end[1], ends);
            check(`${label} breve pc ${pc} tie lowest point`, y[0],
              (grid.semiToY(pc) - CNBCard.tieBottom(config, grid, { pc, duration: "breve" })) / ss);
          }
        }
      }
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    }},

  // Engine-backed (session 29, session 18 review): in repeat mode the default
  // shape's stem, anchored off the notehead's centre, engraves at the x the
  // card draws it, measured from the render (Stem against NoteHead) and from
  // the rendered card, not from repeatLayout. LilyPond puts the stem's edge,
  // not its centre, on the attachment point (an up stem's right edge, a down
  // stem's left); the export writes that point half a stem outward of the
  // anchor (session 40), in LilyPond's stem-attachment units, relative to the
  // notehead's extent (session 33), and the preview scales the same edge
  // across the group, so the anchored edges agree. Since session 34 the
  // stems' widths agree as well (the next test).
  { name: "repeat mode (engine): the engraved stem's anchored edge matches the preview's, crotchet and minim, up and down", fn: async () => {
      const { config, grid } = repeatFixture();
      const staffSpacePx = grid.pxPerSemi * config.staff.semitonesPerStaffSpace;
      // pc 0 (semis 0 and 12) stems up; pc 6 (6 and 18, averaging the midpoint) stems down.
      const previewX = (pc, duration) => withDomStub(container => {
        const { svg, stem } = dissect(CNBCard.render(container, grid, config, { pc, duration }));
        const direction = pc === 0 ? "up" : "down";
        return (stemEdge(stem, direction) - Number(svg.getAttribute("width")) / 2) / staffSpacePx;
      });
      const cases = [
        { duration: "crotchet", log: 2, pc: 0, dir: 1 }, { duration: "crotchet", log: 2, pc: 6, dir: -1 },
        { duration: "minim", log: 1, pc: 0, dir: 1 }, { duration: "minim", log: 1, pc: 6, dir: -1 },
      ].map(c => ({ ...c, want: previewX(c.pc, c.duration) }));
      for (const c of cases) assert(c.dir * c.want > 0.1, `the default anchors are off centre: ${JSON.stringify(c)}`);

      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const { stems, error } = await measureStems(engine, CNBLilypond.generate(config),
        "\\stemUp c'4 \\stemDown fis'4 \\stemUp c'2 \\stemDown fis'2");
      assert(!error, `the export must compile and engrave: ${error}`);
      eq(stems.length, cases.length, "four stems");
      cases.forEach((c, i) => {
        const stem = stems[i];
        const label = `${c.duration} ${c.dir > 0 ? "up" : "down"}`;
        eq(stem.durationLog, c.log, `${label}: duration`);
        eq(stem.direction, c.dir, `${label}: stem direction`);
        const edge = stem.x + c.dir * stem.width / 2;
        assert(Math.abs(edge - c.want) <= 1e-3,
          `${label}: engraved edge ${edge} staff spaces, preview ${c.want} (±0.001)`);
      });
    }},

  // Engine-backed (session 34): the preview draws the engine's stem. For every
  // card's octave chord, crotchet and minim, on the default, Kite 4-369 and
  // 45deg-369 fixtures, the engraved stem's direction, thickness and both
  // ends, in staff spaces from the middle line, match the rendered card's,
  // and (session 40) so does its centre's x from the notehead's centre. The
  // cards cover stems up and down, shortened (far head on the middle line or
  // past it) and full length. Skips with the reason logged without LilyPond
  // or the engine.
  { name: "stem (engine): every card's stem engraves at the preview's direction, x, thickness and ends, default, Kite and 45deg, crotchet and minim", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const names = ["c", "cis", "d", "dis", "e", "f", "fis", "g", "gis", "a", "ais", "b"];
      const load = (f) => CNBConfigIO.loadFromText(readFileSync(path.join(FIXTURES, f), "utf8")).config;
      const failures = [];
      for (const [label, config] of [["default", CNBConfig.createDefault()],
        ["Kite 4-369", load("kite-4-369-config.json")], ["45deg-369", load("45deg-369-config.json")]]) {
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const staffSpacePx = grid.pxPerSemi * config.staff.semitonesPerStaffSpace;
        const middleY = grid.semiToY(config.staff.midpoint);
        const ly = CNBLilypond.generate(config);
        for (const [duration, token] of [["crotchet", "4"], ["minim", "2"]]) {
          // Card pc p draws semitones p and p + 12, the engine's p' and p''.
          const previews = names.map((_, pc) => withDomStub(container => {
            const { svg, stem } = dissect(CNBCard.render(container, grid, config, { pc, duration }));
            const [y1, y2] = ["y1", "y2"].map(k => (middleY - Number(stem.getAttribute(k))) / staffSpacePx);
            return { direction: y2 > y1 ? 1 : -1, width: Number(stem.getAttribute("stroke-width")) / staffSpacePx,
              x: (stemCentre(stem) - Number(svg.getAttribute("width")) / 2) / staffSpacePx,
              bottom: Math.min(y1, y2), top: Math.max(y1, y2) };
          }));
          const { stems, error } = await measureStems(engine, ly, names.map(n => `<${n}' ${n}''>${token}`).join(" "));
          if (error) { failures.push(`${label} ${duration}: ${error}`); continue; }
          if (stems.length !== names.length) { failures.push(`${label} ${duration}: ${stems.length} stems engraved`); continue; }
          previews.forEach((want, pc) => {
            const got = stems[pc];
            if (got.direction !== want.direction) {
              failures.push(`${label} ${duration} pc ${pc}: engraved direction ${got.direction}, preview ${want.direction}`);
              return;
            }
            for (const k of ["x", "width", "bottom", "top"]) {
              if (!(Math.abs(got[k] - want[k]) <= 1e-3)) {
                failures.push(`${label} ${duration} pc ${pc} ${k}: engraved ${got[k]} staff spaces, preview ${want[k]} (±0.001)`);
              }
            }
          });
        }
      }
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    }},

  // Engine-backed (session 60, LY spec §4.1e): every shape's reference point
  // 0.3 of its height below its centre, so each head is drawn and engraved
  // higher than its pitch, through the exported -ref variants. For every
  // card's octave chord the engraved heads' Y extents (crotchet, minim,
  // semibreve) and stems (crotchet, minim) match the card's within 0.001 staff
  // spaces; the dots of dotted crotchets stay where the config without the
  // reference engraves them; in repeat mode the breve's tie ends, lowest ink
  // and top follow the moved heads.
  { name: "reference point (engine): heads, stems, dots and repeated heads with an off-centre reference engrave where the card draws them", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const names = ["c", "cis", "d", "dis", "e", "f", "fis", "g", "gis", "a", "ais", "b"];
      const load = (f) => CNBConfigIO.loadFromText(readFileSync(path.join(FIXTURES, f), "utf8")).config;
      const offCentre = (config) => {
        const c = CNBConfig.clone(config);
        for (const s of Object.values(c.shapes)) s.reference = { x: 0, y: 0.3 * s.naturalHeight };
        return c;
      };
      const repeat = CNBConfig.createDefault();
      repeat.durations.representationMode = "repeat";
      const failures = [];
      const check = (what, engraved, preview) => {
        if (!(Math.abs(engraved - preview) <= 1e-3)) failures.push(`${what}: engraved ${engraved} staff spaces, preview ${preview} (±0.001)`);
      };
      for (const [label, plain] of [["default", CNBConfig.createDefault()], ["default, repeat", repeat],
        ["Kite 4-369", load("kite-4-369-config.json")]]) {
        const config = offCentre(plain);
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const ss = grid.pxPerSemi * config.staff.semitonesPerStaffSpace;
        const middleY = grid.semiToY(config.staff.midpoint);
        const up = (y) => (middleY - y) / ss;
        const ly = CNBLilypond.generate(config);
        assert(ly.includes("-ref-path"), `${label}: the export registers moved variants`);
        /** The drawn head's extent at semi, staff spaces above the middle line. */
        const drawn = (pc, semi, duration) => {
          const r = CNBCard.resolveNotehead(config, pc, duration, null);
          const shape = config.shapes[r.shape];
          const { scaleY } = CNBNotehead.measure(shape, grid.pxPerSemi, r);
          const y = grid.semiToY(semi) + CNBNotehead.referenceShift(shape, scaleY);
          const box = CNBNotehead.box(shape).y;
          return { bottom: up(y + box[1] * scaleY), top: up(y + box[0] * scaleY) };
        };
        for (const [duration, token, log] of [["crotchet", "4", 2], ["minim", "2", 1], ["semibreve", "1", 0]]) {
          const music = names.map(n => `<${n}' ${n}''>${token}`).join(" ");
          const { heads, error } = await measureHeads(engine, ly, music);
          if (error) { failures.push(`${label} ${duration}: ${error}`); continue; }
          if (heads.length !== 24) { failures.push(`${label} ${duration}: ${heads.length} heads engraved`); continue; }
          for (const h of heads) {
            const want = drawn(((h.semitone % 12) + 12) % 12, h.semitone, duration);
            eq(h.durationLog, log, `${label} ${duration}: duration`);
            check(`${label} ${duration} semitone ${h.semitone} bottom`, h.bottom, want.bottom);
            check(`${label} ${duration} semitone ${h.semitone} top`, h.top, want.top);
          }
          if (duration === "semibreve") continue;
          const { stems, error: stemError } = await measureStems(engine, ly, music);
          if (stemError) { failures.push(`${label} ${duration} stems: ${stemError}`); continue; }
          names.forEach((_, pc) => withDomStub(container => {
            const { svg, stem } = dissect(CNBCard.render(container, grid, config, { pc, duration }));
            const [y1, y2] = ["y1", "y2"].map(k => up(Number(stem.getAttribute(k))));
            const got = stems[pc];
            check(`${label} ${duration} pc ${pc} stem x`, got.x, (stemCentre(stem) - Number(svg.getAttribute("width")) / 2) / ss);
            check(`${label} ${duration} pc ${pc} stem bottom`, got.bottom, Math.min(y1, y2));
            check(`${label} ${duration} pc ${pc} stem top`, got.top, Math.max(y1, y2));
          }));
        }
        // Dots stay at the pitch: as the config without the reference engraves them.
        const dotted = names.map(n => `<${n}' ${n}''>4.`).join(" ");
        const moved = await measureHeads(engine, ly, dotted);
        const still = await measureHeads(engine, CNBLilypond.generate(plain), dotted);
        if (moved.error || still.error) failures.push(`${label} dots: ${moved.error || still.error}`);
        else if (moved.dots.length === 0 || moved.dots.length !== still.dots.length) {
          failures.push(`${label} dots: ${moved.dots.length} engraved, ${still.dots.length} without the reference`);
        } else moved.dots.forEach((d, i) => check(`${label} dot ${i}`, d.y, still.dots[i].y));
        if (config.durations.representationMode !== "repeat") continue;
        // The breve's tie, below the moved heads; y from the pitch, Y up.
        const { ties, error } = await measureTies(engine, ly);
        if (error) { failures.push(`${label} tie: ${error}`); continue; }
        for (const { pc, start, end, y } of ties) {
          const shape = config.shapes[CNBCard.resolveNotehead(config, pc, "breve", null).shape];
          const [tie] = CNBCard.repeatLayout(config, grid, shape, "breve").ties;
          check(`${label} breve pc ${pc} tie start y`, start[1], -tie.dy / ss);
          check(`${label} breve pc ${pc} tie end y`, end[1], -tie.dy / ss);
          check(`${label} breve pc ${pc} tie lowest point`, y[0], (grid.semiToY(pc) - CNBCard.tieBottom(config, grid, { pc, duration: "breve" })) / ss);
          const head = drawn(pc, pc, "breve");
          check(`${label} breve pc ${pc} top`, y[1], head.top - up(grid.semiToY(pc)));
        }
      }
      if (failures.length > 0) throw new Error(failures.slice(0, 30).join("\n    ") + (failures.length > 30 ? `\n    … ${failures.length} in all` : ""));
    }},

  // Session 40: the Kite and 45deg-369 SVGs draw their crotchet stem rects
  // centred on the notehead, and the stem goes where the rect puts it.
  { name: "stem: the Kite 4-369 and 45deg-369 crotchet stems are centred on the notehead, up and down", fn: () => {
      for (const f of ["kite-4-369-config.json", "45deg-369-config.json"]) {
        const config = CNBConfigIO.loadFromText(readFileSync(path.join(FIXTURES, f), "utf8")).config;
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const directions = new Set();
        for (let pc = 0; pc < 12; pc++) withDomStub(container => {
          const { svg, stem } = dissect(CNBCard.render(container, grid, config, { pc, duration: "crotchet" }));
          directions.add(Number(stem.getAttribute("y2")) < Number(stem.getAttribute("y1")) ? "up" : "down");
          approx(stemCentre(stem), Number(svg.getAttribute("width")) / 2, `${f} pc ${pc}: stem centre`);
        });
        eq([...directions].sort().join(), "down,up", `${f}: stems both ways`);
      }
    }},

  // Session 40: the default notehead's stems take the conventional places, the
  // up stem's right edge on the notehead's right edge and the down stem's left
  // edge on its left (the path's extent is ±172.426 SVG units).
  { name: "stem: the default notehead's up stem is on its right edge and its down stem on its left, crotchet and minim", fn: () => {
      const { config, grid, shape } = fixture();
      const { scaleFactor } = CNBNotehead.measure(shape, grid.pxPerSemi);
      for (const duration of ["crotchet", "minim"]) withDomStub(container => {
        // pc 0 (semis 0 and 12) stems up; pc 6 (6 and 18) stems down.
        const up = dissect(CNBCard.render(container, grid, config, { pc: 0, duration }));
        approx(stemEdge(up.stem, "up") - Number(up.svg.getAttribute("width")) / 2, 172.426 * scaleFactor, `${duration} up: right edge`, 1e-3);
        const down = dissect(CNBCard.render(container, grid, config, { pc: 6, duration }));
        approx(stemEdge(down.stem, "down") - Number(down.svg.getAttribute("width")) / 2, -172.4267 * scaleFactor, `${duration} down: left edge`, 1e-3);
      });
    }},

  // Session 40 (verification round 1): every gallery file sets the default
  // notehead's anchors for its own staff, so wherever a card draws that
  // notehead the stem's outer edge is on its side (the path's extent,
  // ±172.426 SVG units), whatever the staff's spacing.
  { name: "stem: every gallery card that draws the default notehead puts its stem's outer edge on the notehead's side", fn: () => {
      const gallery = path.resolve(FIXTURES, "..", "assets", "examples", "gallery");
      const failures = [];
      let checked = 0;
      for (const f of readdirSync(gallery).filter(n => n.endsWith(".json")).sort()) {
        const config = CNBConfigIO.loadFromText(readFileSync(path.join(gallery, f), "utf8")).config;
        const shape = config.shapes["crotchet-minim"];
        if (!shape) continue;
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const { scaleX } = CNBNotehead.measure(shape, grid.pxPerSemi);
        for (let pc = 0; pc < 12; pc++) {
          const r = CNBConfig.resolveNotehead(config, pc, "crotchet", null);
          if (r.shape !== "crotchet-minim" || r.heightSemis != null || r.widthSemis != null) continue;
          withDomStub(container => {
            const { stem, noteheads } = dissect(CNBCard.render(container, grid, config, { pc, duration: "crotchet" }));
            const headX = Number(/translate\(([^,]+),/.exec(noteheads[0].getAttribute("transform"))[1]);
            const up = Number(stem.getAttribute("y2")) < Number(stem.getAttribute("y1"));
            const want = up ? 172.426 * scaleX : -172.4267 * scaleX;
            const got = stemEdge(stem, up ? "up" : "down") - headX;
            checked++;
            if (!(Math.abs(got - want) <= 1e-2)) failures.push(`${f} pc ${pc} ${up ? "up" : "down"}: edge ${got} px from the centre, side ${want}`);
          });
        }
      }
      assert(checked > 100, `${checked} cards checked`);
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    }},

  // ── session 22: resolved notehead size ─────────────────────────────────────

  { name: "size: columnWidth, ledger width, stem anchor and noteheads follow the resolved size", fn: () => {
      const { config, grid, shape } = fixture();
      config.noteheadRules.push({
        name: "big C", priority: 2, match: { pitchClasses: [0], durations: "all", keys: "all" },
        apply: { heightSemis: 4, widthSemis: 6 },
      });
      const m = CNBNotehead.measure(shape, grid.pxPerSemi, { heightSemis: 4, widthSemis: 6 });
      approx(m.pixelWidth, 6 * 16, "sized width 6 semitones");
      const colWidth = CNBCard.columnWidth(config, grid, { pc: 0, duration: "crotchet" });
      approx(colWidth, 6 * 16 * 1.5 + 2 * 16, "column width from the sized notehead");
      withDomStub(container => {
        const col = CNBCard.render(container, grid, config, { pc: 0, duration: "crotchet" });
        const { ledgerG, stem, noteheads } = dissect(col);
        assert(ledgerG.children.length > 0, "C draws its ledger");
        approx(Number(ledgerG.children[0].getAttribute("width")), 6 * 16 * 1.5, "ledger width from the sized notehead");
        approx(stemCentre(stem), colWidth / 2 + shape.anchors.crotchetUp.x * m.scaleX, "stem anchor x follows scaleX");
        const geo = CNBStem.geometry(config, {
          gridContext: grid, shape, scaleFactor: m.scaleFactor, scaleX: m.scaleX, centerX: colWidth / 2,
          noteYPositions: [grid.semiToY(0), grid.semiToY(12)], direction: "up", duration: "crotchet",
        });
        eq(stem.getAttribute("y1"), String(geo.y1), "stem anchor y follows scaleY");
        for (const g of noteheads) eq(g.children[0].getAttribute("transform"), `scale(${m.scaleX},${m.scaleY})`, "sized head");
      });
    }},

  { name: "size: unsized pitch classes are untouched by another pc's size rule", fn: () => {
      const { config, grid } = fixture();
      const before = CNBCard.columnWidth(config, grid, { pc: 2, duration: "crotchet" });
      config.noteheadRules.push({
        name: "big C", priority: 2, match: { pitchClasses: [0], durations: "all", keys: "all" },
        apply: { heightSemis: 4, widthSemis: 6 },
      });
      eq(CNBCard.columnWidth(config, grid, { pc: 2, duration: "crotchet" }), before, "pc 2 column unchanged");
    }},

  { name: "size: repeat mode spaces the copies by the resolved width", fn: () => {
      const { config, grid, shape } = fixture();
      config.durations.representationMode = "repeat";
      const size = { heightSemis: 2, widthSemis: 2 };
      const sized = CNBCard.repeatLayout(config, grid, shape, "minim", size);
      const w = 2 * 16;
      const step = w * (1 - config.durations.repeatOverlap);
      approx(sized.groupWidth, w + step, "group width from the sized notehead");
      deepEqOffsets(sized.offsets, [-step / 2, step / 2]);
    }},

];

function deepEqOffsets(a, b) {
  eq(a.length, b.length, "offset count");
  a.forEach((v, i) => approx(v, b[i], `offset ${i}`));
}

/** A stem's centre x, which sits on its anchor for one head (session 40). */
function stemCentre(stem) {
  return Number(stem.getAttribute("x1"));
}

/** The stem edge LilyPond puts on the attachment point: an up stem's right edge, a down stem's left. */
function stemEdge(stem, direction) {
  const half = Number(stem.getAttribute("stroke-width")) / 2;
  return Number(stem.getAttribute("x1")) + (direction === "up" ? half : -half);
}

/** Default config in repeat mode. */
function repeatFixture() {
  const f = fixture();
  f.config.durations.representationMode = "repeat";
  return f;
}

const OFFSET_RULE = {
  name: "shared-position sharps sit right",
  priority: 10,
  match: { pitchClasses: [1, 4, 6, 9, 11], durations: "all", keys: "all" },
  apply: { xOffsetStaffSpaces: 0.85 },
};

/** Default config on the 013 Twinline axis (midpoint G = 7) with the 0.85 offset rule. */
function axisFixture() {
  const config = CNBConfig.createDefault();
  config.pitchAxis = {
    enabled: true,
    kind: "pitch-class-map-v1",
    octaveStride: 7,
    axisUnitsPerStaffSpace: 2,
    pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
  };
  config.staff.semitonePattern = [2, 5, 9];
  config.staff.midpoint = 7;
  config.noteheadRules.push(OFFSET_RULE);
  const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
  return { config, grid, shape: config.shapes["crotchet-minim"] };
}
