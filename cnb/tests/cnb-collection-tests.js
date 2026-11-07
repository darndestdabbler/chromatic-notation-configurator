/**
 * cnb-collection-tests.js — Unit tests for Module 10 (Card Collection)
 *
 * Tests gridRange plus the render() DOM structure (background staff SVG,
 * flex card row, duration rows) via the stub document; visual correctness
 * is verified on test-collection.html.
 */

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CNBConfig } from "../src/cnb-config.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBCard } from "../src/cnb-card.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBKeySignature } from "../src/cnb-key-signature.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { withDomStub } from "./svg-stub.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "fixtures");
const GALLERY_DIR = path.resolve(__dirname, "..", "assets", "examples", "gallery");
const PREVIEW_BASELINE = path.join(FIXTURES, "preview-baseline.json");

// ─── Preview-DOM byte-identity pin (set 014 s2) ─────────────────────────────
//
// Every probe renders CNBCollection.render through the stub DOM and hashes
// the JSON serialization of the resulting tree. The hashes in
// cnb/fixtures/preview-baseline.json were captured by capturePreviewBaseline()
// BEFORE any consumer module gained an axis path, so a match proves the
// axis-disabled preview is byte-identical to the pre-rethread code.

/** The 013 Twinline-like map (design §1.1) — five shared pairs. */
export const TWINLINE_PITCH_AXIS = {
  enabled: true,
  kind: "pitch-class-map-v1",
  octaveStride: 7,
  axisUnitsPerStaffSpace: 2,
  pitchClasses: [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position })),
};

function loadViaIO(file) {
  return CNBConfigIO.loadFromText(readFileSync(file, "utf8")).config;
}

function keySigDefault() {
  const config = CNBConfig.createDefault();
  config.keys.enabled = true;
  config.keys.definitions = [{ name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] }];
  config.keys.keySignature.enabled = true;
  return config;
}

/** The pinned probes: [{ id, config, options }], in a fixed order. */
export function previewProbes() {
  const durations = ["crotchet", "minim"];
  const debug = CNBConfig.createDefault();
  debug.display.debugGrid = true;
  const probes = [
    { id: "default", config: CNBConfig.createDefault(), options: { durations } },
    { id: "default-debug-grid", config: debug, options: {} },
    { id: "default-key-signature", config: keySigDefault(), options: { durations, keys: ["C"] } },
    { id: "kite-4-369", config: loadViaIO(path.join(FIXTURES, "kite-4-369-config.json")), options: { durations } },
    { id: "45deg-369", config: loadViaIO(path.join(FIXTURES, "45deg-369-config.json")), options: { durations } },
  ];
  for (const f of readdirSync(GALLERY_DIR).filter(n => n.endsWith(".json")).sort()) {
    const config = loadViaIO(path.join(GALLERY_DIR, f));
    // The baseline pins the axis-DISABLED preview; an axis-enabled fixture
    // (twinline-compact.json, set 014 s3) has no pre-rethread render and is
    // covered by the axis render tests instead.
    if (config.pitchAxis?.enabled === true) continue;
    const keyName = config.keys?.enabled && config.keys.definitions?.[0]?.name;
    probes.push({
      id: `gallery/${f}`,
      config,
      options: keyName ? { durations, keys: [keyName] } : { durations },
    });
  }
  return probes;
}

/** A present-but-disabled pitchAxis section plus an axis-gated offset rule. */
function withDisabledAxis(config) {
  const c = CNBConfig.clone(config);
  c.pitchAxis = { ...TWINLINE_PITCH_AXIS, enabled: false };
  c.noteheadRules = [...(c.noteheadRules || []), {
    name: "axis-gated offset (ignored on a linear config)",
    priority: 1000,
    match: { pitchClasses: [1, 4, 6, 9, 11], durations: "all", keys: "all" },
    apply: { xOffsetStaffSpaces: 0.85 },
  }];
  return c;
}

function renderHash(config, options) {
  const json = withDomStub(container => JSON.stringify(CNBCollection.render(container, config, options)));
  return { sha256: createHash("sha256").update(json).digest("hex"), length: json.length };
}

/** Recompute every probe's hash (used to write the fixture, and by the pin). */
export function capturePreviewBaseline() {
  return previewProbes().map(p => ({ id: p.id, ...renderHash(p.config, p.options) }));
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function approx(a, b, msg, tol = 1e-9) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg || "approx"}: expected ${b}, got ${a}`);
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

  { name: "preview baseline: every probe renders byte-identically to the pre-rethread capture", fn: () => {
      const baseline = JSON.parse(readFileSync(PREVIEW_BASELINE, "utf8"));
      const byId = new Map(baseline.probes.map(p => [p.id, p]));
      const probes = previewProbes();
      eq(probes.length, baseline.probes.length, "probe count matches the baseline");
      for (const p of probes) {
        const pinned = byId.get(p.id);
        assert(pinned, `baseline has probe ${p.id}`);
        const got = renderHash(p.config, p.options);
        eq(got.length, pinned.length, `${p.id}: serialized length`);
        eq(got.sha256, pinned.sha256, `${p.id}: serialized sha256`);
      }
    }},

  { name: "render (axis): full Twinline row — deduped staff, axis svgHeight, shared pairs level, offsets applied", fn: () => {
      const config = CNBConfig.createDefault();
      config.pitchAxis = CNBConfig.clone(TWINLINE_PITCH_AXIS);
      config.staff.semitonePattern = [2, 5, 6, 8, 9];   // axis {1,3,3,5,5}
      config.staff.midpoint = 7;
      config.noteheadRules.push({
        name: "shared-position sharps sit right",
        priority: 10,
        match: { pitchClasses: [1, 4, 6, 9, 11], durations: "all", keys: "all" },
        apply: { xOffsetStaffSpaces: 0.85 },
      });
      const pcs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const grid = CNBGrid.create(config, CNBCollection.gridRange(pcs));
      assert(grid.axis && grid.axis.enabled, "axis grid");
      eq(grid.svgHeight, (16 - -2) * 16, "svgHeight from axis positions of -4 and 28");

      withDomStub(container => {
        const root = CNBCollection.render(container, config);
        const { bg, columns } = dissectRow(root.children[0]);
        eq(bg.getAttribute("height"), String(grid.svgHeight), "bg height");

        const staffSemis = CNBStaff.getPositions(config, grid);
        const distinct = new Set(staffSemis.map(s => grid.axis.positionOfSemi(s)));
        const staffG = bg.children.find(c => c.getAttribute("class") === "cnb-staff");
        eq(staffG.children.length, distinct.size, "one background line per axis position");
        assert(distinct.size < staffSemis.length, "the pattern really collapses");

        const widths = columns.children.map(c => Number(c.style.width.replace("px", "")));
        approx(Number(bg.getAttribute("width")), widths.reduce((a, b) => a + b, 0), "bg width = sum of columns");
        approx(widths[1] - widths[0], 0.85 * 2 * 16, "C♯ column widened by its offset");

        const headXY = col => {
          const svg = col.children[1];
          const head = svg.children.filter(c => c.tag === "g" && c.getAttribute("class") !== "cnb-ledger-set")[0];
          const [, x, y] = /translate\(([^,]+),([^)]+)\)/.exec(head.getAttribute("transform")).map(Number);
          return { x, y, width: Number(svg.getAttribute("width")) };
        };
        const c = headXY(columns.children[0]);
        const cs = headXY(columns.children[1]);
        eq(cs.y, c.y, "C and C♯ share a y");
        approx(c.x, c.width / 2, "C centered");
        approx(cs.x, cs.width / 2 + (0.85 * 2 * 16) / 2, "C♯ shifted right of its column center");
      });
    }},

  { name: "preview baseline: a present-but-disabled pitchAxis (plus xOffsetStaffSpaces rules) changes no byte", fn: () => {
      const baseline = JSON.parse(readFileSync(PREVIEW_BASELINE, "utf8"));
      const byId = new Map(baseline.probes.map(p => [p.id, p]));
      for (const p of previewProbes()) {
        const got = renderHash(withDisabledAxis(p.config), p.options);
        eq(got.sha256, byId.get(p.id).sha256, `${p.id} with disabled axis: serialized sha256`);
      }
    }},

  // ── Fluid layout (session 25, design §6.1) ─────────────────────────────

  { name: "preview baseline: fluid false and rows 2 without fluid render byte-identically", fn: () => {
      const baseline = JSON.parse(readFileSync(PREVIEW_BASELINE, "utf8"));
      const byId = new Map(baseline.probes.map(p => [p.id, p]));
      for (const p of previewProbes()) {
        const got = renderHash(p.config, { ...p.options, fluid: false, rows: 2 });
        eq(got.sha256, byId.get(p.id).sha256, `${p.id}: serialized sha256`);
      }
    }},

  { name: "minRowWidth: one row is 13 column minimums (widest column, rounded up, + 2 px each side)", fn: () => {
      const config = CNBConfig.createDefault();
      const grid = CNBGrid.create(config, CNBCollection.gridRange(DEFAULT_ROW));
      const widest = Math.max(...DEFAULT_ROW.map(pc => CNBCard.columnWidth(config, grid, { pc, duration: "crotchet" })));
      const colMin = Math.ceil(widest) + 4;
      eq(CNBCollection.minRowWidth(config), 13 * colMin, "one row");
      eq(CNBCollection.minRowWidth(config, { rows: 1 }), 13 * colMin, "rows 1");
      eq(CNBCollection.minRowWidth(config, { rows: 2 }), 7 * colMin, "two rows: 7 slots");
    }},

  { name: "minRowWidth: the widest column over every shown duration sets the minimum", fn: () => {
      const config = loadViaIO(path.join(FIXTURES, "kite-4-369-config.json"));
      const grid = CNBGrid.create(config, CNBCollection.gridRange(DEFAULT_ROW));
      const widest = Math.max(...["crotchet", "minim"].flatMap(duration =>
        DEFAULT_ROW.map(pc => CNBCard.columnWidth(config, grid, { pc, duration }))));
      eq(CNBCollection.minRowWidth(config, { durations: ["crotchet", "minim"] }),
        13 * (Math.ceil(widest) + 4), "crotchet + minim");
      assert(CNBCollection.minRowWidth(config, { durations: ["crotchet", "minim"] }) >
        CNBCollection.minRowWidth(config), "repeat-mode minims widen the columns");
    }},

  { name: "minRowWidth: adds the key-signature track at the row's minimum, where a column is colMin wide (session 34)", fn: () => {
      const config = keySigDefault();
      const plain = CNBCollection.minRowWidth(config, { rows: 2 });
      const withKey = CNBCollection.minRowWidth(config, { rows: 2, keys: ["C"] });
      const colMin = plain / 7;                        // 7 slots, no other gutter
      const A = CNBKeySignature.gutterWidth(config, config.display.pxPerSemi, "C", 0);
      approx(withKey - plain, A - colMin / 2, "the first notehead centred 4.8636 staff spaces after the marks");
    }},

  { name: "render (fluid): one system on a grid of 13 equal columns", fn: () => {
      const config = CNBConfig.createDefault();
      const colMin = CNBCollection.minRowWidth(config) / 13;
      withDomStub(container => {
        const root = CNBCollection.render(container, config, { fluid: true });
        eq(root.children.length, 1, "one duration row");
        const systems = fluidSystems(root.children[0]);
        eq(systems.length, 1, "one system");
        const { container: c, columns, bg, cards } = systems[0];
        eq(columns.style.display, "grid", "grid");
        eq(columns.style.gridTemplateColumns, `repeat(13, minmax(${colMin}px, 1fr))`, "template");
        eq(c.style.minWidth, 13 * colMin + "px", "system min width");
        eq(cards.length, 13, "13 cards");
        eq(cards.map(col => col.getAttribute("data-pc")).join(","), DEFAULT_ROW.join(","), "data-pc");
        eq(cards.map(col => col.style.gridColumn).join(","), DEFAULT_ROW.map(i => String(i + 1)).join(","), "explicit cells");
        eq(bg.style.gridColumn, "1 / span 13", "staff spans the row");
      });
    }},

  { name: "render (fluid): the staff SVG is 100% wide and every line runs to 100%", fn: () => {
      const config = CNBConfig.createDefault();
      withDomStub(container => {
        const { bg } = fluidSystems(CNBCollection.render(container, config, { fluid: true }).children[0])[0];
        const grid = CNBGrid.create(config, CNBCollection.gridRange(DEFAULT_ROW));
        eq(bg.getAttribute("width"), "100%", "svg width");
        eq(bg.getAttribute("height"), String(grid.svgHeight), "svg height");
        eq(bg.style.marginTop, grid.topLabelHeight + "px", "aligned with the note-slices");
        const lines = bg.children.find(c => c.getAttribute("class") === "cnb-staff").children;
        eq(lines.length, CNBStaff.getPositions(config, grid).length, "line count");
        assert(lines.every(l => l.getAttribute("x2") === "100%"), "lines to 100%");
      });
    }},

  { name: "render (fluid, ledgerSpots): every candidate ledger spot is a faint line to 100%, under the staff lines", fn: () => {
      const config = CNBConfig.createDefault();   // templates at C, D and A♯
      withDomStub(container => {
        const plain = fluidSystems(CNBCollection.render(container, config, { fluid: true }).children[0])[0].bg;
        assert(!plain.children.some(c => c.getAttribute("class") === "ledger-spots"), "no spots without the option");
        for (const rows of [1, 2]) {
          const systems = fluidSystems(CNBCollection.render(container, config,
            { fluid: true, rows, ledgerSpots: true }).children[0]);
          for (const { bg, cards } of systems) {
            const order = bg.children.map(c => c.getAttribute("class"));
            assert(order.indexOf("ledger-spots") >= 0 && order.indexOf("ledger-spots") < order.indexOf("cnb-staff"),
              "spots drawn before (under) the staff lines");
            const pcs = cards.map(c => Number(c.getAttribute("data-pc")));
            const grid = CNBGrid.create(config, CNBCollection.gridRange(pcs));
            const expected = [];
            for (let s = Math.ceil(grid.minSemi); s <= grid.maxSemi; s++) {
              if ([0, 2, 10].includes(((s % 12) + 12) % 12)) expected.push(String(grid.semiToY(s)));
            }
            const spots = bg.children.find(c => c.getAttribute("class") === "ledger-spots").children;
            eq(JSON.stringify(spots.map(l => l.getAttribute("y1")).sort((a, b) => a - b)),
              JSON.stringify(expected.sort((a, b) => a - b)), `rows ${rows}: one spot per template position in range`);
            assert(spots.every(l => l.getAttribute("class") === "ledger-spot" && l.getAttribute("x2") === "100%"),
              "faint lines across the row");
          }
        }
      });
    }},

  { name: "render (ledgerSpots): ignored without fluid, so the fixed layout is unchanged", fn: () => {
      const config = CNBConfig.createDefault();
      eq(JSON.stringify(renderHash(config, { ledgerSpots: true })), JSON.stringify(renderHash(config, {})), "same output");
    }},

  { name: "render (fluid, rows 2): C to F♯ and G to C′ on the same 7-slot grid, 24 px apart", fn: () => {
      const config = CNBConfig.createDefault();
      const colMin = CNBCollection.minRowWidth(config) / 13;
      withDomStub(container => {
        const systems = fluidSystems(CNBCollection.render(container, config, { fluid: true, rows: 2 }).children[0]);
        eq(systems.length, 2, "two systems");
        const [a, b] = systems;
        eq(a.cards.map(c => c.getAttribute("data-pc")).join(","), "0,1,2,3,4,5,6", "first system");
        eq(b.cards.map(c => c.getAttribute("data-pc")).join(","), "7,8,9,10,11,12", "second system");
        for (const s of systems) {
          eq(s.columns.style.gridTemplateColumns, `repeat(7, minmax(${colMin}px, 1fr))`, "same template");
          eq(s.container.style.minWidth, 7 * colMin + "px", "same min width");
        }
        eq(a.bg.style.gridColumn, "1 / span 7", "first staff spans 7");
        eq(b.bg.style.gridColumn, "1 / span 6", "second staff ends after C′");
        eq(a.container.style.marginTop, undefined, "no gap above the first");
        eq(b.container.style.marginTop, "24px", "24 px between rows");
        const gridB = CNBGrid.create(config, CNBCollection.gridRange([7, 8, 9, 10, 11, 12]));
        eq(b.bg.getAttribute("height"), String(gridB.svgHeight), "each system has its own grid range");
      });
    }},

  { name: "render (fluid): the key-signature track keeps the first notehead 4.8636 staff spaces after the marks at any row width (session 34)", fn: () => {
      const config = keySigDefault();
      const px = config.display.pxPerSemi;
      const pad = CNBKeySignature.padding(config, px, "C", 0);
      const marks = CNBKeySignature.gutterWidth(config, px, "C", 0) - pad.right;   // left padding + marks
      withDomStub(container => {
        const systems = fluidSystems(CNBCollection.render(container, config, { fluid: true, rows: 2, keys: ["C"] }).children[0]);
        for (const s of systems) {
          const key = s.columns.children.find(c => c.className === "keysig-col");
          assert(key, "keysig column");
          eq(key.style.gridColumn, "1", "first track");
          eq(s.cards[0].style.gridColumn, "2", "cards after the gutter");
          // The track as CSS resolves it: max(a, min(calc(P − Q × 100%), M)).
          const template = s.columns.style.gridTemplateColumns;
          const m = /^max\((\S+)px, min\(calc\((\S+)px - (\S+) \* 100%\), (\S+)px\)\) repeat\(7, minmax\((\S+)px, 1fr\)\)$/.exec(template);
          assert(m, "track template: " + template);
          const [lo, P, Q, hi, colMin] = m.slice(1).map(Number);
          eq(key.style.width, template.slice(0, template.indexOf(" repeat(")), "the column takes the track's width");
          for (const W of [7 * colMin + hi, 7 * colMin + hi + 300, 7 * colMin + hi + 900]) {
            const K = Math.max(lo, Math.min(P - Q * W, hi));
            const t = Math.max(colMin, (W - K) / 7);
            approx(K + t / 2 - marks, 4.8636 * 64, `row ${W} px: marks to the first notehead's centre`, 1e-6);
          }
        }
        eq(systems[1].bg.style.gridColumn, "1 / span 7", "staff spans the gutter and six cards");
      });
    }},

  // ── The label strip (session 28, design §4.2) ──────────────────────────

  { name: "render (fluid, labelStrip): a label per semitone, even left and odd right, outside the staff", fn: () => {
      const config = CNBConfig.createDefault();
      withDomStub(container => {
        const [s] = fluidSystems(CNBCollection.render(container, config, { fluid: true, labelStrip: true }).children[0]);
        const strip = s.columns.children.find(c => c.className === "label-col");
        assert(strip, "a label column");
        eq(strip.style.gridColumn, "1", "the first track");
        assert(s.columns.style.gridTemplateColumns.startsWith(CNBCollection.LABEL_STRIP_WIDTH + "px repeat(13, "), "strip track first");
        eq(s.cards[0].style.gridColumn, "2", "cards after the strip");
        eq(s.bg.style.gridColumn, "2 / span 13", "the staff starts after the strip");
        const grid = CNBGrid.create(config, CNBCollection.gridRange(DEFAULT_ROW));
        const { labels, middle } = stripOf(strip);
        const semis = [];
        for (let semi = Math.ceil(grid.minSemi); semi <= grid.maxSemi; semi++) semis.push(semi);
        eq(labels.length, semis.length, "one label per semitone");
        const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
        const leftX = labels.find(l => l.pc === 0).x;
        const rightX = labels.find(l => l.pc === 1).x;
        assert(leftX < rightX, "even left of odd");
        for (const semi of semis) {
          const l = labels.find(x => x.semi === semi);
          const pc = ((semi % 12) + 12) % 12;
          eq(l.text, names[pc], `semitone ${semi} name`);
          eq(l.y, String(grid.semiToY(semi)), `semitone ${semi} level with its spot`);
          eq(l.x, pc % 2 === 0 ? leftX : rightX, `semitone ${semi} column`);
        }
        eq(middle.getAttribute("y1"), String(grid.semiToY(12)), "the middle of the staff marked");
      });
    }},

  { name: "render (fluid, labelStrip): shared spots side by side, and joined as \"C·D\" in one column", fn: () => {
      const twin = loadViaIO(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "examples", "gallery", "twinline-compact.json"));
      withDomStub(container => {
        const [s] = fluidSystems(CNBCollection.render(container, twin, { fluid: true, labelStrip: true }).children[0]);
        const { labels } = stripOf(s.columns.children.find(c => c.className === "label-col"));
        const c = labels.find(l => l.semi === 0);
        const cs = labels.find(l => l.semi === 1);
        eq(c.y, cs.y, "C and C♯ share a spot");
        assert(c.x !== cs.x, "in different columns");
        eq(c.text, "C", "C alone");
      });
      const three = CNBConfig.createDefault();
      three.pitchAxis = { enabled: true, kind: "pitch-class-map-v1", octaveStride: 12, axisUnitsPerStaffSpace: 4,
        pitchClasses: [0, 0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((position, pc) => ({ pc, position })) };
      withDomStub(container => {
        const [s] = fluidSystems(CNBCollection.render(container, three, { fluid: true, labelStrip: true }).children[0]);
        const { labels } = stripOf(s.columns.children.find(c => c.className === "label-col"));
        const joined = labels.find(l => l.semi === 0);
        eq(joined.text, "C·D", "C and D, both even, share one label");
        assert(!labels.some(l => l.semi === 2), "D has no label of its own");
        eq(labels.find(l => l.semi === 1).text, "C♯", "C♯ beside them");
      });
    }},

  { name: "minRowWidth and rows 2 with labelStrip: the strip in every system and in the minimum", fn: () => {
      const config = CNBConfig.createDefault();
      for (const rows of [1, 2]) {
        eq(CNBCollection.minRowWidth(config, { rows, labelStrip: true }),
          CNBCollection.minRowWidth(config, { rows }) + CNBCollection.LABEL_STRIP_WIDTH, `rows ${rows}: strip counted`);
      }
      withDomStub(container => {
        const systems = fluidSystems(CNBCollection.render(container, config, { fluid: true, rows: 2, labelStrip: true }).children[0]);
        eq(systems.length, 2, "two systems");
        for (const s of systems) {
          assert(s.columns.children.some(c => c.className === "label-col"), "each system has a strip");
          eq(s.container.style.minWidth, CNBCollection.minRowWidth(config, { rows: 2, labelStrip: true }) + "px", "min width");
        }
        eq(systems[1].bg.style.gridColumn, "2 / span 6", "second staff after the strip, ending after C′");
      });
    }},

  { name: "render (labelStrip): off, or without fluid, the layout is unchanged", fn: () => {
      const config = CNBConfig.createDefault();
      eq(JSON.stringify(renderHash(config, { labelStrip: true })), JSON.stringify(renderHash(config, {})), "fixed layout");
      withDomStub(container => {
        const [s] = fluidSystems(CNBCollection.render(container, config, { fluid: true }).children[0]);
        assert(!s.columns.children.some(c => c.className === "label-col"), "no strip without the option");
        eq(s.bg.style.gridColumn, "1 / span 13", "staff from the first track");
      });
    }},

  { name: "render (fluid): several durations each get captioned rows of systems", fn: () => {
      const config = CNBConfig.createDefault();
      withDomStub(container => {
        const root = CNBCollection.render(container, config, { fluid: true, rows: 2, durations: ["crotchet", "minim"] });
        eq(root.children.length, 2, "two duration rows");
        for (const row of root.children) {
          eq(row.children[0].className, "cnb-duration-caption", "caption first");
          eq(fluidSystems(row).length, 2, "two systems");
        }
      });
    }},

];

const DEFAULT_ROW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The labels and middle line of a label column's SVG slice. */
function stripOf(strip) {
  const slice = strip.children.find(c => c.getAttribute && c.getAttribute("class") === "label-slice");
  const labels = slice.children.filter(c => c.getAttribute("class") === "pitch-label").map(g => {
    const text = g.children.find(c => c.tag === "text");
    return { semi: Number(g.getAttribute("data-semi")), pc: Number(g.getAttribute("data-pc")),
      text: text.textContent, x: text.getAttribute("x"), y: text.getAttribute("y") };
  });
  const middle = slice.children.find(c => c.getAttribute("class") === "staff-middle");
  return { labels, middle };
}

/** The fluid systems of one duration row. */
function fluidSystems(row) {
  return row.children.filter(c => c.className === "preview-container").map(container => {
    const columns = container.children.find(c => c.className === "pc-columns");
    const bg = columns.children.find(c => c.getAttribute("class") === "staff-lines-bg");
    const cards = columns.children.filter(c => c.className === "pc-col");
    return { container, columns, bg, cards };
  });
}
