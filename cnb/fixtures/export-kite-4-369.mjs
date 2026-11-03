/**
 * export-kite-4-369.mjs — Session-set 007 pipeline driver (headless half).
 *
 * Generates the Kite 4-369 .ly config from cnb/fixtures/kite-4-369-config.json
 * via CNBLilypond.generate() — the same call the UI export button makes.
 *
 * Usage:
 *   node cnb/fixtures/export-kite-4-369.mjs [outFile]
 *
 * With no outFile the generated .ly is written to stdout. Validation
 * warnings (non-blocking) are printed to stderr either way.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { CNBConfig } = await import(join(here, "..", "src", "cnb-config.js").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "file:///$1:"));
const { CNBLilypond } = await import(join(here, "..", "src", "cnb-lilypond.js").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "file:///$1:"));

const fixturePath = join(here, "kite-4-369-config.json");
const config = JSON.parse(readFileSync(fixturePath, "utf8"));

const validation = CNBConfig.validate(config);
for (const w of validation.warnings) console.error(`warning: ${w}`);
if (!validation.valid) {
  console.error("Fixture failed validation:");
  for (const e of validation.errors) console.error(`  - ${e}`);
  process.exit(2);
}

const ly = CNBLilypond.generate(config);

const outFile = process.argv[2];
if (outFile) {
  writeFileSync(outFile, ly, "utf8");
  console.error(`wrote ${outFile} (${ly.length} bytes)`);
} else {
  process.stdout.write(ly);
}
