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
import { findEngine, measureNoteheads, measureStems } from "./engine-probe.js";
import { readFileSync } from "fs";
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

  { name: "resolveNotehead: color falls back to black with no palette and no rule color", fn: () => {
      const { config } = fixture();
      eq(CNBCard.resolveNotehead(config, 0, "crotchet", null).color, "#000000", "fallback color");
    }},

  { name: "resolveNotehead: palette color used when rule color is null", fn: () => {
      const { config } = fixture();
      config.palette.colors = [{ pc: 0, hex: "#FF0000", name: "Red" }];
      eq(CNBCard.resolveNotehead(config, 0, "crotchet", null).color, "#FF0000", "palette color");
    }},

  { name: "resolveNotehead: explicit rule color overrides the palette", fn: () => {
      const { config } = fixture();
      config.palette.colors = [{ pc: 0, hex: "#FF0000", name: "Red" }];
      config.noteheadRules.push({
        name: "C is blue", priority: 2,
        match: { pitchClasses: [0], durations: "all", keys: "all" },
        apply: { color: "#0000FF" },
      });
      eq(CNBCard.resolveNotehead(config, 0, "crotchet", null).color, "#0000FF", "rule color wins");
    }},

  { name: "resolveNotehead: pc 12 (upper C) normalizes to pitch class 0", fn: () => {
      const { config } = fixture();
      config.palette.colors = [{ pc: 0, hex: "#FF0000", name: "Red" }];
      eq(CNBCard.resolveNotehead(config, 12, "crotchet", null).color, "#FF0000", "pc 12 → pc 0");
    }},

  // ── columnWidth ────────────────────────────────────────────────────────────

  { name: "columnWidth = the engine's ledger (1.5 notehead widths) + 2 × paddingH", fn: () => {
      const { config, grid, shape } = fixture();
      const { pixelWidth } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const expected = pixelWidth * 1.5 + 2 * config.display.column.paddingH;
      approx(CNBCard.columnWidth(config, grid, { pc: 0, duration: "crotchet" }), expected, "column width");
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
      config.palette.colors = [{ pc: 5, hex: "#1B9E77", name: "Shamrock" }];
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
        approx(stemEdge(stem, "up"), headX + shape.anchors.crotchetUp.x * scaleFactor, "stem follows the head (up)");
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
        approx(stemEdge(stem, "down"),
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

  { name: "repeatCount: 1 in shape mode; engine counts in repeat mode (minim 2, semibreve 4, breve 4)", fn: () => {
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

  { name: "repeatLayout: copies edge to edge, default padding -0.5 staff space (linear, sps 4)", fn: () => {
      const { config, grid, shape } = repeatFixture();
      const { pixelWidth: w } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const step = w - 0.5 * 4 * 16;
      const crotchet = CNBCard.repeatLayout(config, grid, shape, "crotchet");
      eq(crotchet.count, 1, "crotchet count");
      eq(crotchet.offsets.length, 1, "crotchet one offset");
      approx(crotchet.groupWidth, w, "crotchet width");
      const minim = CNBCard.repeatLayout(config, grid, shape, "minim");
      eq(minim.count, 2, "minim count");
      approx(minim.offsets[0], -step / 2, "minim left");
      approx(minim.offsets[1], step / 2, "minim right");
      approx(minim.groupWidth, 2 * w - 32, "minim group width");
      const semibreve = CNBCard.repeatLayout(config, grid, shape, "semibreve");
      [-1.5, -0.5, 0.5, 1.5].forEach((k, i) => approx(semibreve.offsets[i], k * step, `semibreve ${i}`));
      approx(semibreve.groupWidth, 4 * w - 3 * 32, "semibreve group width");
    }},

  { name: "repeatLayout: engine.multinotePadding changes the step", fn: () => {
      const { config, grid, shape } = repeatFixture();
      config.engine.multinotePadding = 0.25;
      const { pixelWidth: w } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const minim = CNBCard.repeatLayout(config, grid, shape, "minim");
      approx(minim.offsets[1] - minim.offsets[0], w + 0.25 * 4 * 16, "step");
      approx(minim.groupWidth, 2 * w + 16, "group width");
    }},

  { name: "repeatLayout (axis): a staff space is axis.unitsPerStaffSpace axis units", fn: () => {
      const { config, grid, shape } = axisFixture();
      config.durations.representationMode = "repeat";
      const { pixelWidth: w } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const minim = CNBCard.repeatLayout(config, grid, shape, "minim");
      approx(minim.offsets[1] - minim.offsets[0], w - 0.5 * 2 * 16, "step at 2 units per staff space");
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
        approx(stemEdge(stem, "up"),
          centerX + shape.anchors.minimUp.x * scaleFactor * (layout.groupWidth / w), "stem at the anchor's relative position across the group");
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
  // as the preview's repeated group. Measured at session 18: Kite 2.1670 /
  // 3.8340 engraved vs 2.1667 / 3.8333 previewed, 45deg-369 the same to
  // 0.0003. Skips with the reason logged without LilyPond or the engine.
  { name: "repeatLayout (engine): Kite and 45deg-369 repeated heads engrave at the preview's group width (±5%)", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const failures = [];
      for (const file of ["kite-4-369-config.json", "45deg-369-config.json"]) {
        const config = CNBConfigIO.loadFromText(readFileSync(path.join(FIXTURES, file), "utf8")).config;
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const unitsPerStaffSpace = grid.axis?.enabled ? grid.axis.unitsPerStaffSpace : config.staff.semitonesPerStaffSpace;
        const ly = CNBLilypond.generate(config);
        for (const [duration, token] of [["minim", "2"], ["semibreve", "1"], ["breve", "\\breve"]]) {
          const { noteheads, error } = await measureNoteheads(engine, ly, token);
          if (error) { failures.push(`${file} ${duration}: ${error}`); continue; }
          for (const { pc, width } of noteheads) {
            const shape = config.shapes[CNBCard.resolveNotehead(config, pc, duration, null).shape];
            const preview = CNBCard.repeatLayout(config, grid, shape, duration).groupWidth / (grid.pxPerSemi * unitsPerStaffSpace);
            if (!(Math.abs(width - preview) <= 0.05 * preview)) {
              failures.push(`${file} ${duration} pc ${pc}: engraved ${width} staff spaces, preview ${preview}`);
            }
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
  // stem's left), and so does the preview (session 33), so the anchored edges
  // agree; the export writes the attachment in LilyPond's stem-attachment
  // units, relative to the notehead's extent (session 33). Since session 34
  // the stems' widths agree as well (the next test).
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
  // card's octave chord, crotchet and minim, on the default and Kite 4-369
  // fixtures, the engraved stem's direction, thickness and both ends, in
  // staff spaces from the middle line, match the rendered card's. The cards
  // cover stems up and down, shortened (far head on the middle line or past
  // it) and full length. Skips with the reason logged without LilyPond or
  // the engine.
  { name: "stem (engine): every card's stem engraves at the preview's direction, thickness and ends, default and Kite, crotchet and minim", fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const names = ["c", "cis", "d", "dis", "e", "f", "fis", "g", "gis", "a", "ais", "b"];
      const kite = CNBConfigIO.loadFromText(readFileSync(path.join(FIXTURES, "kite-4-369-config.json"), "utf8")).config;
      const failures = [];
      for (const [label, config] of [["default", CNBConfig.createDefault()], ["Kite 4-369", kite]]) {
        const grid = CNBGrid.create(config, { minSemi: -4, maxSemi: 28 });
        const staffSpacePx = grid.pxPerSemi * config.staff.semitonesPerStaffSpace;
        const middleY = grid.semiToY(config.staff.midpoint);
        const ly = CNBLilypond.generate(config);
        for (const [duration, token] of [["crotchet", "4"], ["minim", "2"]]) {
          // Card pc p draws semitones p and p + 12, the engine's p' and p''.
          const previews = names.map((_, pc) => withDomStub(container => {
            const { stem } = dissect(CNBCard.render(container, grid, config, { pc, duration }));
            const [y1, y2] = ["y1", "y2"].map(k => (middleY - Number(stem.getAttribute(k))) / staffSpacePx);
            return { direction: y2 > y1 ? 1 : -1, width: Number(stem.getAttribute("stroke-width")) / staffSpacePx,
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
            for (const k of ["width", "bottom", "top"]) {
              if (!(Math.abs(got[k] - want[k]) <= 1e-3)) {
                failures.push(`${label} ${duration} pc ${pc} ${k}: engraved ${got[k]} staff spaces, preview ${want[k]} (±0.001)`);
              }
            }
          });
        }
      }
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
        approx(stemEdge(stem, "up"), colWidth / 2 + shape.anchors.crotchetUp.x * m.scaleX, "stem anchor x follows scaleX");
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
      const step = w + (config.engine.multinotePadding) * config.staff.semitonesPerStaffSpace * 16;
      approx(sized.groupWidth, w + step, "group width from the sized notehead");
      deepEqOffsets(sized.offsets, [-step / 2, step / 2]);
    }},

];

function deepEqOffsets(a, b) {
  eq(a.length, b.length, "offset count");
  a.forEach((v, i) => approx(v, b[i], `offset ${i}`));
}

/** The stem edge that sits on the anchor (session 33): an up stem's right edge, a down stem's left. */
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
