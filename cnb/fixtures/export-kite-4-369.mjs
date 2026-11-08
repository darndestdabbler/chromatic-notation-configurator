/**
 * export-kite-4-369.mjs — Session-set 007 pipeline driver, kept because the
 * umbrella's pipeline names it. It runs export-config.mjs on
 * cnb/fixtures/kite-4-369-config.json.
 *
 * Usage:
 *   node cnb/fixtures/export-kite-4-369.mjs [outFile]
 *
 * With no outFile the generated .ly is written to stdout. Validation
 * warnings (non-blocking) are printed to stderr either way.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
process.argv.splice(2, 0, join(here, "kite-4-369-config.json"));
await import("./export-config.mjs");
