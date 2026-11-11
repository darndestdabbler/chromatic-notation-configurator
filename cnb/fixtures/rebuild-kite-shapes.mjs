/**
 * rebuild-kite-shapes.mjs — regenerate the Kite 4-369 fixture's shapes from
 * real data (session 11, audit H2): import cnb/fixtures/kite-up.svg and
 * kite-down.svg through the Module 16 importer, exactly as the UI does, and
 * write the resulting shape entries into kite-4-369-config.json. Nothing in
 * the shapes is edited by hand.
 *
 * Usage:
 *   node cnb/fixtures/rebuild-kite-shapes.mjs           rewrite the config
 *   node cnb/fixtures/rebuild-kite-shapes.mjs --check   exit 1 if out of date
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const load = (...p) => import(pathToFileURL(join(here, "..", ...p)).href);
const { CNBSvgImporter } = await load("ui", "svg-importer.js");
const { parseSvgDocument } = await load("tests", "svg-stub.js");

const configPath = join(here, "kite-4-369-config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

const shapes = {};
for (const name of ["kite-up", "kite-down"]) {
  const doc = parseSvgDocument(readFileSync(join(here, `${name}.svg`), "utf8"));
  const displayName = config.shapes[name]?.displayName;
  const { shape, warnings, error } = CNBSvgImporter.buildShape(CNBSvgImporter.extract(doc), displayName);
  if (error) {
    console.error(`${name}.svg: ${error}`);
    process.exit(2);
  }
  for (const w of warnings) console.error(`${name}.svg: warning: ${w}`);
  shapes[name] = shape;
}

const upToDate = JSON.stringify(config.shapes) === JSON.stringify(shapes);
if (process.argv.includes("--check")) {
  if (!upToDate) console.error("kite-4-369-config.json shapes differ from the imported SVGs — run without --check");
  process.exit(upToDate ? 0 : 1);
}

// Replace only the "shapes" member's text, so the rest of the hand-laid-out
// fixture keeps its formatting: find its object's matching close brace,
// skipping braces inside strings.
const text = readFileSync(configPath, "utf8");
const key = '\n  "shapes": ';
const start = text.indexOf(key) + key.length;
let depth = 0, end = start, inString = false;
for (; end < text.length; end++) {
  const ch = text[end];
  if (inString) {
    if (ch === "\\") end++;
    else if (ch === '"') inString = false;
  } else if (ch === '"') inString = true;
  else if (ch === "{") depth++;
  else if (ch === "}" && --depth === 0) break;
}
const shapesText = JSON.stringify(shapes, null, 2).replace(/\n/g, "\n  ");
const updated = text.slice(0, start) + shapesText + text.slice(end + 1);
if (JSON.stringify(JSON.parse(updated).shapes) !== JSON.stringify(shapes)) {
  console.error("internal error: the spliced config does not carry the imported shapes");
  process.exit(2);
}
writeFileSync(configPath, updated, "utf8");
console.error(`wrote ${configPath}${upToDate ? " (unchanged)" : ""}`);
