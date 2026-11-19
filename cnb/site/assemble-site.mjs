/**
 * assemble-site.mjs — copies the app into a directory for GitHub Pages.
 *
 * Usage: node cnb/site/assemble-site.mjs <outDir>
 *
 * The app is self-contained in cnb/: index.html imports only ./src/ and
 * ./ui/, and those import only each other. This copies index.html, src/,
 * ui/ and assets/ into <outDir>, so the app sits at the site root, and the
 * tutorial (docs/playbook/tutorial/: its page, shots/ and downloads/) into
 * <outDir>/tutorial/, where the app's header links (session 68). It is a
 * copy, not a build: nothing is transformed. Tests, UAT drivers, test pages,
 * fixtures and the other docs are not copied.
 */
import { cpSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: node cnb/site/assemble-site.mjs <outDir>");
  process.exit(2);
}

const CNB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(outDir, { recursive: true });
for (const entry of ["index.html", "src", "ui", "assets"]) {
  cpSync(path.join(CNB, entry), path.join(outDir, entry), { recursive: true });
}
cpSync(path.join(CNB, "..", "docs", "playbook", "tutorial"), path.join(outDir, "tutorial"), { recursive: true });
console.log(`Site assembled in ${path.resolve(outDir)}`);
