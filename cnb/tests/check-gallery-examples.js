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
import { CNBLilypond } from "../src/cnb-lilypond.js";

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
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
  console.log("All gallery fixtures pass.");
}
