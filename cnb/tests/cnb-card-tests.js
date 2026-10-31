/**
 * cnb-card-tests.js — Unit tests for Module 9 (Octave Chord Card)
 *
 * Tests resolveNotehead / columnWidth pure logic plus the render() DOM
 * structure via the stub document; visual correctness is verified on
 * test-card.html / test-collection.html.
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { CNBStem } from "../src/cnb-stem.js";
import { CNBCard } from "../src/cnb-card.js";
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

  { name: "columnWidth = notehead width × widthMultiplier + 2 × paddingH", fn: () => {
      const { config, grid, shape } = fixture();
      const { pixelWidth } = CNBNotehead.measure(shape, grid.pxPerSemi);
      const expected = pixelWidth * config.ledgers.lineDefaults.widthMultiplier
        + 2 * config.display.column.paddingH;
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
          shape, scaleFactor, centerX,
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
        approx(Number(stem.getAttribute("x1")), headX + shape.anchors.crotchetUp.x * scaleFactor, "stem follows the head (up)");
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
        approx(Number(stem.getAttribute("x1")),
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

];

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
