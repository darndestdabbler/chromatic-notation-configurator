/**
 * export-config.mjs — fixture pipeline driver (headless half).
 *
 * Generates a .ly config from a Configurator JSON config via
 * CNBLilypond.generate() — the same call the UI export button makes.
 *
 * Usage:
 *   node cnb/fixtures/export-config.mjs <config.json> [outFile]
 *
 * With no outFile the generated .ly is written to stdout. Validation
 * warnings (non-blocking) are printed to stderr either way.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const load = (...p) => import(pathToFileURL(join(here, "..", ...p)).href);
const { CNBConfig } = await load("src", "cnb-config.js");
const { CNBLilypond } = await load("src", "cnb-lilypond.js");

const [configPath, outFile] = process.argv.slice(2);
if (!configPath) {
  console.error("usage: node cnb/fixtures/export-config.mjs <config.json> [outFile]");
  process.exit(2);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));

const validation = CNBConfig.validate(config);
for (const w of validation.warnings) console.error(`warning: ${w}`);
if (!validation.valid) {
  console.error("Fixture failed validation:");
  for (const e of validation.errors) console.error(`  - ${e}`);
  process.exit(2);
}

const ly = CNBLilypond.generate(config);

if (outFile) {
  writeFileSync(outFile, ly, "utf8");
  console.error(`wrote ${outFile} (${ly.length} bytes)`);
} else {
  process.stdout.write(ly);
}
