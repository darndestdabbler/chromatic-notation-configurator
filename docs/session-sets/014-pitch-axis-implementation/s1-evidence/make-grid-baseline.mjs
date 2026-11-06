/**
 * make-grid-baseline.mjs — Session 014-s1 evidence script
 *
 * Captures the PRE-CHANGE behavior of CNBGrid for axis-disabled configs as
 * a deterministic JSON baseline (cnb/fixtures/grid-baseline.json). Run ONCE
 * against the pre-change tree (HEAD 2cf7d647, before cnb-grid.js gains the
 * axis path); the test suite then pins the disabled code path against this
 * fixture byte-for-byte (design §1.3 / spec binding rule 2: the literal
 * old path, proven by pinning against a pre-change baseline).
 *
 * Probes: grid context scalars, semiToY at integer + fractional semitones,
 * yToSemi samples, and the full debug-overlay DOM (via the test svg stub)
 * for several ranges and pxPerSemi values under the default config.
 *
 * Usage: node docs/session-sets/014-pitch-axis-implementation/s1-evidence/make-grid-baseline.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");

const { CNBConfig } = await import(new URL("file://" + path.join(repoRoot, "cnb", "src", "cnb-config.js").replace(/\\/g, "/")).href);
const { CNBGrid }   = await import(new URL("file://" + path.join(repoRoot, "cnb", "src", "cnb-grid.js").replace(/\\/g, "/")).href);
const { CNBStaff }  = await import(new URL("file://" + path.join(repoRoot, "cnb", "src", "cnb-staff.js").replace(/\\/g, "/")).href);
const { withSvgStub } = await import(new URL("file://" + path.join(repoRoot, "cnb", "tests", "svg-stub.js").replace(/\\/g, "/")).href);

/** Serialize a stub element tree deterministically. */
function serializeEl(el) {
  const out = { tag: el.tag, attrs: {} };
  for (const k of Object.keys(el.attrs).sort()) out.attrs[k] = el.attrs[k];
  if (el.textContent !== undefined) out.text = String(el.textContent);
  out.children = (el.children || []).map(serializeEl);
  return out;
}

/**
 * Probe one (range, pxPerSemi) combination. This exact function is
 * duplicated in cnb-pitch-axis-tests.js — the test re-runs it against the
 * post-change grid and byte-compares the serialized JSON.
 */
function probeGrid(range, pxPerSemi) {
  const config = CNBConfig.createDefault();
  if (pxPerSemi !== null) config.display.pxPerSemi = pxPerSemi;
  const grid = CNBGrid.create(config, range);

  const context = {
    pxPerSemi: grid.pxPerSemi,
    minSemi: grid.minSemi,
    maxSemi: grid.maxSemi,
    totalSemiRange: grid.totalSemiRange,
    svgHeight: grid.svgHeight,
    topLabelHeight: grid.topLabelHeight,
    bottomLabelHeight: grid.bottomLabelHeight,
    totalHeight: grid.totalHeight,
    hasYToSemi: typeof grid.yToSemi === "function",
    axisProperty: Object.prototype.hasOwnProperty.call(grid, "axis") ? "present" : "absent",
  };

  const semiToY = {};
  for (let s = range.minSemi; s <= range.maxSemi; s++) {
    semiToY[String(s)] = grid.semiToY(s);
    if (s < range.maxSemi) semiToY[String(s) + ".5"] = grid.semiToY(s + 0.5);
  }
  // Float probes (clef-style anchors)
  for (const f of [22.784, 7.25]) {
    if (f >= range.minSemi && f <= range.maxSemi) semiToY[String(f)] = grid.semiToY(f);
  }

  const yToSemi = {};
  for (const y of [0, grid.svgHeight / 2, grid.svgHeight, 7.3]) {
    yToSemi[String(y)] = grid.yToSemi(y);
  }

  const staffPositions = CNBStaff.getPositions(config, range);
  const overlay = withSvgStub(svg => {
    svg.setAttribute("width", "400");
    CNBGrid.renderDebugOverlay(svg, grid, staffPositions);
    return serializeEl(svg);
  });

  return { range, pxPerSemiOverride: pxPerSemi, context, semiToY, yToSemi, staffPositions, debugOverlay: overlay };
}

const baseline = {
  description: "Pre-change CNBGrid baseline for axis-disabled configs (captured at 2cf7d647, before set-014 s1 grid changes)",
  probes: [
    probeGrid({ minSemi: 0, maxSemi: 24 }, null),
    probeGrid({ minSemi: -4, maxSemi: 28 }, null),
    probeGrid({ minSemi: 3, maxSemi: 21 }, null),
    probeGrid({ minSemi: 0, maxSemi: 24 }, 20),
  ],
};

const outPath = path.join(repoRoot, "cnb", "fixtures", "grid-baseline.json");
fs.writeFileSync(outPath, JSON.stringify(baseline, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
console.log(`Probes: ${baseline.probes.length}`);
console.log(`Probe 0 svgHeight: ${baseline.probes[0].context.svgHeight}`);
console.log(`Probe 0 overlay children: ${baseline.probes[0].debugOverlay.children.length}`);
