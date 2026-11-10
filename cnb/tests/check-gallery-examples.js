/**
 * check-gallery-examples.js — mechanical gate over the gallery reproduction
 * fixture corpus (session-set 011).
 *
 * For every fixture under cnb/assets/examples/gallery/*.json it asserts, per
 * the set-011 session-1 spec (step 2):
 *   1. The fixture LOADS the way the UI loads it — through
 *      CNBConfigIO.loadFromText() (merge over defaults + REPLACE_PATHS +
 *      validate) — and CNBConfig.validate() reports valid:true (no errors).
 *   2. CNBConfig.resolveNotehead() succeeds for all 12 pitch classes across
 *      every duration the fixture defines (durations.definitions[].name).
 *   3. CNBLilypond.generate() returns a non-empty string without throwing.
 *   4. (engine-backed, session 11 — audit H2/H3) the export engraves: each
 *      pitch class's notehead, measured from a real LilyPond render, is the
 *      size the preview draws it (its path's drawn extent in semitones ÷ sps
 *      staff spaces, ±5%). Skips with the reason logged when
 *      lilypond is not on PATH or the engine repository is not found.
 *      (Operator decision, session 11: a fixed 0.5–3 staff-space bound
 *      would fail the Express Stave fixtures, whose 2-semitone heads at 6
 *      semitones per staff space legitimately engrave ~0.33 staff spaces.)
 *
 * The script is runnable standalone (`node cnb/tests/check-gallery-examples.js`,
 * exit 0 = all pass, 1 = any failure) AND exports a `tests` array so the main
 * runner (cnb/tests/run-tests.js) picks it up like any other suite — one test
 * per fixture plus a corpus-coverage test.
 *
 * Loading through CNBConfigIO (not a bare CNBConfig.merge) is deliberate: the
 * fixtures are the Configurator's native save format and are loaded through
 * JSON load during UAT, so the check exercises exactly that path.
 */

import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBLilypond, _internals } from "../src/cnb-lilypond.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { findEngine, measureNoteheads } from "./engine-probe.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GALLERY_DIR = path.resolve(__dirname, "..", "assets", "examples", "gallery");

/** Fixture files in the gallery corpus, sorted for deterministic order. */
export function galleryFixtureFiles() {
  let entries;
  try {
    entries = readdirSync(GALLERY_DIR);
  } catch (err) {
    throw new Error(`Cannot read gallery fixture dir ${GALLERY_DIR}: ${err.message}`);
  }
  return entries.filter(f => f.endsWith(".json")).sort()
    .map(f => path.join(GALLERY_DIR, f));
}

/**
 * Run the three checks against one fixture file. Throws on the first failure
 * with a message naming the fixture; returns a small summary on success.
 */
export function checkFixture(file) {
  const name = path.basename(file);
  const text = readFileSync(file, "utf8");

  // 1. Load exactly as the UI does, then validate.
  const { config, validation } = CNBConfigIO.loadFromText(text);
  if (!validation.valid) {
    throw new Error(`${name}: validation failed —\n    ${validation.errors.join("\n    ")}`);
  }

  // 2. resolveNotehead succeeds for all 12 PCs × every defined duration.
  const durations = (config.durations?.definitions || []).map(d => d.name);
  if (durations.length === 0) {
    throw new Error(`${name}: no durations defined`);
  }
  for (const duration of durations) {
    for (let pc = 0; pc < 12; pc++) {
      const r = CNBConfig.resolveNotehead(config, pc, duration, null);
      if (!r || typeof r.shape !== "string" || !(r.shape in (config.shapes || {}))) {
        throw new Error(
          `${name}: resolveNotehead(pc=${pc}, ${duration}) did not resolve to a defined shape ` +
          `(got ${JSON.stringify(r && r.shape)})`);
      }
    }
  }

  // 3. LilyPond export returns without error.
  const ly = CNBLilypond.generate(config);
  if (typeof ly !== "string" || ly.length === 0) {
    throw new Error(`${name}: CNBLilypond.generate() returned empty output`);
  }

  return { name, durations: durations.length, warnings: validation.warnings.length };
}

/** Allowed relative difference between engraved and preview notehead size. */
const SIZE_TOLERANCE = 0.05;

/**
 * The drawn extent of an SVG path (absolute M/L/H/V/C/Z, as the exporter's
 * fallback reads it) in its own units: { width, height }. Cubic segments
 * contribute their true extrema, not their control points — the same
 * geometric bounding box LilyPond gives a path stencil. This, not the
 * shape's (possibly padded) naturalWidth/naturalHeight viewBox, is what the
 * preview draws.
 */
export function pathBounds(d) {
  const xs = [], ys = [];
  let x = 0, y = 0;
  // Extrema of one cubic coordinate: endpoints plus roots of B'(t) in (0, 1).
  const cubic = (p0, p1, p2, p3, out) => {
    out.push(p0, p3);
    const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
    const roots = Math.abs(a) < 1e-12
      ? (Math.abs(b) < 1e-12 ? [] : [-c / b])
      : (() => {
          const disc = b * b - 4 * a * c;
          if (disc < 0) return [];
          return [(-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a)];
        })();
    for (const t of roots) {
      if (t > 0 && t < 1) {
        const u = 1 - t;
        out.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3);
      }
    }
  };
  for (const { cmd, args } of _internals.parseSvgPath(d)) {
    if (cmd === "M" || cmd === "L") { x = args[0]; y = args[1]; xs.push(x); ys.push(y); }
    else if (cmd === "H") { x = args[0]; xs.push(x); }
    else if (cmd === "V") { y = args[0]; ys.push(y); }
    else if (cmd === "C") {
      cubic(x, args[0], args[2], args[4], xs);
      cubic(y, args[1], args[3], args[5], ys);
      x = args[4]; y = args[5];
    }
  }
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/**
 * Check 4 (engine-backed, session 11): every gallery export's noteheads
 * engrave at the size the preview shows them. For each pitch class the
 * shape resolved at crotchet duration must engrave its drawn path's width
 * and height (pathBounds of svgPath) ÷ SVG units per semitone (naturalHeight
 * / semitoneHeight) ÷ sps staff spaces, within SIZE_TOLERANCE (sps =
 * axisUnitsPerStaffSpace under a pitch axis) — the preview draws that path
 * at semitoneHeight × pxPerSemi / naturalHeight. Resolves with a list of
 * failures; [] when every notehead fits.
 */
export async function checkGalleryNoteheadSizes(engine, files = galleryFixtureFiles()) {
  const runs = files.map(async (file) => {
    const name = path.basename(file);
    const { config } = CNBConfigIO.loadFromText(readFileSync(file, "utf8"));
    const { noteheads, error } = await measureNoteheads(engine, CNBLilypond.generate(config));
    if (error) return [`${name}: the export did not engrave — ${error.split("\n")[0]}`];
    const axis = CNBPitchAxis.create(config);
    const sps = axis.enabled ? axis.unitsPerStaffSpace : config.staff.semitonesPerStaffSpace;
    const failures = [];
    if (noteheads.length !== 12) failures.push(`${name}: measured ${noteheads.length} noteheads, expected 12`);
    for (const { pc, width, height } of noteheads) {
      const shapeName = CNBConfig.resolveNotehead(config, pc, "crotchet", null).shape;
      // The engine's quarter-note duration category is off by one (audit
      // H4), so a duration-scoped shape rule would make the quarter note's
      // shape ambiguous; no fixture has one, and this keeps it explicit.
      if (CNBConfig.resolveNotehead(config, pc, "minim", null).shape !== shapeName) {
        failures.push(`${name} pc ${pc}: crotchet and minim resolve different shapes — the quarter-note probe cannot tell which the engine draws`);
        continue;
      }
      const shape = config.shapes[shapeName];
      const unitsPerSemitone = shape.naturalHeight / shape.semitoneHeight;
      const drawn = pathBounds(shape.svgPath);
      const expected = {
        width: drawn.width / unitsPerSemitone / sps,
        height: drawn.height / unitsPerSemitone / sps,
      };
      for (const [dim, got] of [["width", width], ["height", height]]) {
        if (!(Math.abs(got - expected[dim]) <= SIZE_TOLERANCE * expected[dim])) {
          failures.push(`${name} shape "${shapeName}" pc ${pc}: engraved ${dim} ${got.toFixed(4)} ` +
            `staff spaces, preview ${expected[dim].toFixed(4)}`);
        }
      }
    }
    return failures;
  });
  return (await Promise.all(runs)).flat();
}

// ─── Test suite (consumed by run-tests.js) ────────────────────────────────────

export const tests = [
  {
    name: "gallery corpus is non-empty",
    fn: () => {
      const files = galleryFixtureFiles();
      if (files.length === 0) throw new Error("no gallery fixtures found");
    },
  },
  ...galleryFixtureFiles().map(file => ({
    name: `fixture ${path.basename(file)} validates, resolves 12 PCs, and exports`,
    fn: () => { checkFixture(file); },
  })),
  {
    name: "gallery (engine): every fixture's noteheads engrave at their preview size (±5%)",
    fn: async () => {
      const engine = findEngine();
      if (engine.skip) { console.log(`      (skipped: ${engine.skip})`); return; }
      const failures = await checkGalleryNoteheadSizes(engine);
      if (failures.length > 0) throw new Error(failures.join("\n    "));
    },
  },
];

// ─── Standalone entry point ───────────────────────────────────────────────────

function isMain() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const files = galleryFixtureFiles();
  let pass = 0;
  const failures = [];
  console.log(`Gallery fixture check — ${files.length} fixture(s) in ${GALLERY_DIR}\n`);
  for (const file of files) {
    try {
      const s = checkFixture(file);
      console.log(`  ✓ ${s.name} (${s.durations} durations, ${s.warnings} warning(s))`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${path.basename(file)}`);
      console.log(`      ${err.message}`);
      failures.push(err.message);
    }
  }
  const engine = findEngine();
  if (engine.skip) {
    console.log(`  - notehead size check skipped: ${engine.skip}`);
  } else {
    const sizeFailures = await checkGalleryNoteheadSizes(engine, files);
    for (const f of sizeFailures) console.log(`  ✗ ${f}`);
    if (sizeFailures.length === 0) console.log("  ✓ every fixture's noteheads engrave at their preview size");
    failures.push(...sizeFailures);
  }
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
  console.log("All gallery fixtures pass.");
}
