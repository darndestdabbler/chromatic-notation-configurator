/**
 * uat-clef-editor.mjs — Playwright UAT driver for the set-009 custom clef
 * feature (session-set 009 session 2).
 *
 * Executes the DSL-style checklist recorded in
 * docs/session-sets/009-custom-clefs/s2-uat.md against cnb/index.html (the
 * assembled application), served from the repo root by a built-in static
 * server. (The dabbler-uat-dsl compiler is still in bootstrap; this driver
 * is the checklist's executable form, following the accepted set-004/005/006
 * pattern.)
 *
 * Flow (spec step 5): import a clef SVG through the clef editor → enable
 * the clef → position it (float anchor semitone + gutter padding) →
 * confirm the preview renders the grid-positioned clef gutter → save the
 * config (real download) and load it back → export a .ly file (real
 * download) — with Node-side parity checks run in THIS process on the full
 * config read from the page's live state panel: CNBClef.gutterWidth /
 * CNBGrid.semiToY for the preview geometry, CNBLilypond.generate for the
 * export (both the byte-identity of the download and the set-009
 * no-emission pin: clef-enabled ≡ clef-disabled).
 *
 * The Google Fonts CDN requests made by index.html (preview-only
 * cosmetics) are stubbed with empty responses so the run asserts app
 * behavior, not CDN availability.
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-clef-editor.mjs
 *
 * Requirements — the driver errors out (exit 2) rather than guessing:
 *   - playwright-core in the repo's node_modules (`npm install`), or set CNB_UAT_PLAYWRIGHT
 *     to a directory whose node_modules contains it.
 *   - A Chromium executable: CNB_UAT_CHROMIUM if set to a non-empty value
 *     (a non-empty-but-invalid path is an error, not a fallback); otherwise
 *     the newest chromium-* browser in the platform's ms-playwright cache.
 *
 * Optional: CNB_UAT_PORT (default 8149), CNB_UAT_SHOTS (screenshot dir,
 * default <os tmpdir>/cnb-uat).
 *
 * Exit code 0 = all checks passed; 1 = at least one check failed.
 */
import http from "http";
import os from "os";
import { readFile, mkdir } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBClef } from "../src/cnb-clef.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { useCanvasSize, canvasConfig, openSection } from "./app-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8149);
const SHOT_DIR = process.env.CNB_UAT_SHOTS || path.join(os.tmpdir(), "cnb-uat");

// ── Dependency resolution (explicit errors, no silent fallbacks) ────────────
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright-core"));
} catch {
  const alt = process.env.CNB_UAT_PLAYWRIGHT;
  if (!alt) {
    console.error(
      "playwright-core not found. Run `npm install` at the repository root, " +
      "or set CNB_UAT_PLAYWRIGHT to a directory whose " +
      "node_modules contains it.");
    process.exit(2);
  }
  try {
    ({ chromium } = createRequire(path.join(alt, "resolve-anchor.js"))("playwright-core"));
  } catch (err) {
    console.error(
      `playwright-core could not be resolved from CNB_UAT_PLAYWRIGHT=${alt} ` +
      `(${err.message}). Point it at a directory whose node_modules contains playwright-core.`);
    process.exit(2);
  }
}

/**
 * Newest chromium-* executable in the platform's ms-playwright browser
 * cache, or null. (Same locations Playwright itself installs into.)
 */
function findCachedChromium() {
  const cacheRoot = process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "ms-playwright")
    : process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
      : path.join(os.homedir(), ".cache", "ms-playwright");
  if (!existsSync(cacheRoot)) return null;
  const revisions = readdirSync(cacheRoot)
    .filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  const exeSubpaths = process.platform === "win32"
    ? ["chrome-win64/chrome.exe", "chrome-win/chrome.exe"]
    : process.platform === "darwin"
      ? ["chrome-mac/Chromium.app/Contents/MacOS/Chromium"]
      : ["chrome-linux/chrome"];
  for (const rev of revisions) {
    for (const sub of exeSubpaths) {
      const exe = path.join(cacheRoot, rev, sub);
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}

let EXE;
if (process.env.CNB_UAT_CHROMIUM) {
  EXE = process.env.CNB_UAT_CHROMIUM;
  if (!existsSync(EXE)) {
    console.error(`CNB_UAT_CHROMIUM is set but does not exist: ${EXE}`);
    process.exit(2);
  }
} else {
  EXE = findCachedChromium();
  if (!EXE) {
    console.error(
      "No Chromium found in the ms-playwright cache. Set CNB_UAT_CHROMIUM to " +
      "a Chromium/Chrome binary, or install one (npx playwright install chromium).");
    process.exit(2);
  }
}
await mkdir(SHOT_DIR, { recursive: true });

// ── Toolkit-style sample clef SVG (session-1 importer contract: id="clef"
//    glyph element, data-semitone-height, viewBox; stem/anchor attributes
//    are not required for clefs) ───────────────────────────────────────────
const SAMPLE_CLEF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="300" viewBox="0 0 100 300">
  <path id="clef"
        d="M 50 0 L 100 60 L 65 60 L 65 240 L 100 240 L 50 300 L 0 240 L 35 240 L 35 60 L 0 60 Z"
        data-semitone-height="6"
        style="fill:#000000;stroke:none"/>
</svg>`;

// ── Static server over the repo root ────────────────────────────────────────
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    const file = path.join(ROOT, urlPath);
    if (!path.resolve(file).startsWith(path.resolve(ROOT))) {
      res.writeHead(403); res.end(); return;
    }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});
await new Promise(r => server.listen(PORT, r));

// ── Checklist harness ────────────────────────────────────────────────────────
const results = [];
let failCount = 0;
function check(label, cond, detail = "") {
  const ok = !!cond;
  if (!ok) failCount++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? "  [" + detail + "]" : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1800 },
  acceptDownloads: true,           // save + export both trigger real downloads
});

// Stub the Google Fonts CDN (preview-only cosmetics) so the run asserts app
// behavior, not CDN availability.
await page.route("https://fonts.googleapis.com/**", route =>
  route.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.route("https://fonts.gstatic.com/**", route =>
  route.fulfill({ status: 200, contentType: "font/woff2", body: "" }));

const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

const URL_PATH = `http://localhost:${PORT}/cnb/index.html`;
// The canvas draws at Small, where the full row fits one row (design §6.1).
await useCanvasSize(page, "small");
await page.goto(URL_PATH);
await page.waitForSelector(".cnb-clef-editor", { state: "attached" });
await openSection(page, "clef");

const fullConfig = async () => JSON.parse(await page.textContent("#state-json"));
/** The config as the canvas draws it (the Small display copy). */
const drawn = (c) => canvasConfig(c, "small");
const clefColCount = async () => page.$$eval(".cnb-pvd-preview .clef-col", els => els.length);

// The full-chromatic preview row (PCs 0–12) — the range the preview grid is
// created over, used for the Node-side semiToY parity check.
const FULL_ROW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ── STEP 0: initial assembly (default-off compatibility) ────────────────────
check("ASSEMBLY: the clef editor is mounted alongside the set-006 modules",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-clef-editor") &&
    !!document.querySelector(".cnb-preview-display") &&
    !!document.querySelector(".cnb-config-io") &&
    !!document.querySelector(".cnb-config-export")));
check("DEFAULT-OFF: enable checkbox unchecked, glyph list and anchor sections show explicit empty-state notes",
  await page.evaluate(() =>
    !document.querySelector(".cnb-cle-enable-check").checked &&
    !!document.querySelector(".cnb-cle-empty") &&
    !!document.querySelector(".cnb-cle-anchor-empty") &&
    !document.querySelector(".cnb-cle-glyph-option")));
let cfg = await fullConfig();
check("DEFAULT-OFF: state panel shows the schema default clef section",
  JSON.stringify(cfg.clef) ===
    JSON.stringify({ enabled: false, active: null, glyphs: {}, gutter: { paddingH: 12 } }),
  JSON.stringify(cfg.clef));
check("DEFAULT-OFF: the preview reserves NO clef gutter (no .clef-col) and shows 13 cards",
  (await clefColCount()) === 0 &&
  await page.$$eval(".cnb-pvd-preview .pc-col", els => els.length === 13));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-initial.png"), fullPage: true });

// ── STEP 1: import a clef SVG through the clef editor ───────────────────────
await page.setInputFiles(".cnb-cle-file", {
  name: "uat-clef.svg", mimeType: "image/svg+xml",
  buffer: Buffer.from(SAMPLE_CLEF_SVG, "utf8"),
});
await page.waitForFunction(() =>
  document.querySelector(".cnb-cle-import-status").textContent.includes("uat-clef"));
check('IMPORT: status confirms \'Imported the clef "uat-clef"\'',
  (await page.textContent(".cnb-cle-import-status")).includes('Imported the clef "uat-clef"'),
  await page.textContent(".cnb-cle-import-status"));
cfg = await fullConfig();
check("IMPORT: the glyph entry reaches the shared config (kind glyph, semitoneHeight 6, natural 100×300, default anchor centered on midpoint 12 → 15)",
  !!cfg.clef.glyphs["uat-clef"] &&
  cfg.clef.glyphs["uat-clef"].kind === "glyph" &&
  cfg.clef.glyphs["uat-clef"].semitoneHeight === 6 &&
  cfg.clef.glyphs["uat-clef"].naturalWidth === 100 &&
  cfg.clef.glyphs["uat-clef"].naturalHeight === 300 &&
  cfg.clef.glyphs["uat-clef"].anchorSemi === 15,
  JSON.stringify(cfg.clef.glyphs["uat-clef"]));
check("IMPORT: the imported glyph is listed and selected as active; the anchor control appears",
  cfg.clef.active === "uat-clef" &&
  await page.evaluate(() =>
    document.querySelectorAll(".cnb-cle-glyph-option").length === 1 &&
    document.querySelector('.cnb-cle-glyph-option[data-glyph-name="uat-clef"]')
      .classList.contains("selected") &&
    !!document.querySelector(".cnb-cle-anchor-input")));
check("IMPORT: the clef stays disabled until enabled — the preview still has no .clef-col",
  (await clefColCount()) === 0);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-imported.png"), fullPage: true });

// ── STEP 2: enable the clef ─────────────────────────────────────────────────
await page.check(".cnb-cle-enable-check");
cfg = await fullConfig();
check("ENABLE: clef.enabled true in the shared config, validation shows Config valid ✓",
  cfg.clef.enabled === true &&
  await page.evaluate(() =>
    !!document.querySelector(".cnb-clef-editor .cnb-cle-valid")));
const expectedGutter0 = CNBClef.gutterWidth(drawn(cfg), drawn(cfg).display.pxPerSemi);
check(`ENABLE: the preview grew a clef gutter column of ${expectedGutter0}px (Node-side CNBClef.gutterWidth on the same config)`,
  (await clefColCount()) === 1 &&
  await page.$eval(".cnb-pvd-preview .clef-col",
    (el, w) => el.style.width === w + "px", expectedGutter0),
  `dom width=${await page.$eval(".cnb-pvd-preview .clef-col", el => el.style.width).catch(() => "n/a")}`);
check("ENABLE: the clef glyph is rendered in the gutter (one .cnb-clef group with the imported path)",
  await page.evaluate(() =>
    document.querySelectorAll(".cnb-pvd-preview .cnb-clef").length === 1 &&
    (document.querySelector(".cnb-pvd-preview .cnb-clef path").getAttribute("d") || "")
      .startsWith("M 50 0 L 100 60")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-enabled.png"), fullPage: true });

// ── STEP 3: position the clef (float anchor + gutter padding) ───────────────
// First an integer anchor on the TOP STAFF LINE (semi 20), where correct
// registration is visually obvious: the glyph's pointed top edge must sit
// exactly on the line. This is the primary human-attestation frame.
await page.fill(".cnb-cle-anchor-input", "20");
cfg = await fullConfig();
const grid0 = CNBGrid.create(drawn(cfg), CNBCollection.gridRange(FULL_ROW));
check(`POSITION: anchor 20 (top staff line) — clef group at translate(12,${grid0.semiToY(20)}), glyph top ON the line (Node-side parity)`,
  cfg.clef.glyphs["uat-clef"].anchorSemi === 20 &&
  await page.$eval(".cnb-pvd-preview .cnb-clef",
    (el, t) => el.getAttribute("transform") === t, `translate(12,${grid0.semiToY(20)})`));
check("POSITION: the glyph's rendered top edge coincides with a staff line's y in PAGE coordinates (getBoundingClientRect, ±1px) — i.e. anchor 20 puts the top edge ON the semi-20 line",
  await page.evaluate(() => {
    const clefPath = document.querySelector(".cnb-pvd-preview .cnb-clef path");
    const lines = [...document.querySelectorAll(".cnb-pvd-preview .staff-lines-bg line")];
    if (!clefPath || lines.length === 0) return false;
    const top = clefPath.getBoundingClientRect().top;
    // The preview range spans multiple octaves, so several staff lines
    // render above semi 20 (the pattern repeats per octave) — assert the
    // glyph top lands exactly on ONE of the rendered lines' y.
    return lines.some(l => {
      const b = l.getBoundingClientRect();
      return Math.abs(top - (b.top + b.height / 2)) <= 1;
    });
  }));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-anchor20.png"), fullPage: true });

// Then the FLOAT anchor (the s1 anchoring decision).
await page.fill(".cnb-cle-anchor-input", "22.784");
cfg = await fullConfig();
check("POSITION: float anchor 22.784 reaches the active definition in the shared config",
  cfg.clef.glyphs["uat-clef"].anchorSemi === 22.784,
  JSON.stringify(cfg.clef.glyphs["uat-clef"].anchorSemi));
// Node-side geometry parity: the glyph's group must sit at
// translate(paddingH, semiToY(anchorSemi)) on the same grid the preview
// creates for the full row.
const grid1 = CNBGrid.create(drawn(cfg), CNBCollection.gridRange(FULL_ROW));
const expectedY1 = grid1.semiToY(22.784);
check(`POSITION: the rendered clef group sits at translate(12,${expectedY1}) (Node-side CNBGrid.semiToY parity)`,
  await page.$eval(".cnb-pvd-preview .cnb-clef",
    (el, t) => el.getAttribute("transform") === t, `translate(12,${expectedY1})`),
  await page.$eval(".cnb-pvd-preview .cnb-clef", el => el.getAttribute("transform")).catch(() => "n/a"));

await page.fill(".cnb-cle-gutter-input", "20");
cfg = await fullConfig();
check("POSITION: gutter padding 20 reaches the shared config",
  cfg.clef.gutter.paddingH === 20, JSON.stringify(cfg.clef.gutter));
const expectedGutter1 = CNBClef.gutterWidth(drawn(cfg), drawn(cfg).display.pxPerSemi);
const grid2 = CNBGrid.create(drawn(cfg), CNBCollection.gridRange(FULL_ROW));
check(`POSITION: gutter column resized to ${expectedGutter1}px and the clef re-anchored at translate(20,${grid2.semiToY(22.784)})`,
  await page.$eval(".cnb-pvd-preview .clef-col",
    (el, w) => el.style.width === w + "px", expectedGutter1) &&
  await page.$eval(".cnb-pvd-preview .cnb-clef",
    (el, t) => el.getAttribute("transform") === t, `translate(20,${grid2.semiToY(22.784)})`));
check("POSITION: the background staff spans the gutter (staff lines run behind the clef)",
  await page.evaluate(() => {
    const bg = document.querySelector(".cnb-pvd-preview .staff-lines-bg");
    const col = document.querySelector(".cnb-pvd-preview .clef-col");
    if (!bg || !col) return false;
    const bgBox = bg.getBoundingClientRect();
    const colBox = col.getBoundingClientRect();
    return bgBox.left <= colBox.left + 1 && bgBox.right > colBox.right;
  }));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-positioned.png"), fullPage: true });

// ── STEP 4: save the config (Module 17, real download) ──────────────────────
const [saveDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click("#save-config"),
]);
const savedPath = path.join(SHOT_DIR, "uat-009-s2-saved.cnb.json");
await saveDownload.saveAs(savedPath);
const savedJson = JSON.parse(await readFile(savedPath, "utf8"));
cfg = await fullConfig();
check("SAVE: the shell adopted the stamped config — the live state panel is deep-equal to the downloaded file",
  JSON.stringify(cfg) === JSON.stringify(savedJson));
check("SAVE: the clef section is in the file — enabled, active uat-clef, float anchor 22.784, gutter 20",
  savedJson.clef.enabled === true &&
  savedJson.clef.active === "uat-clef" &&
  savedJson.clef.glyphs["uat-clef"].anchorSemi === 22.784 &&
  savedJson.clef.gutter.paddingH === 20,
  JSON.stringify(savedJson.clef));

// ── STEP 5: load the saved config back (Module 17 round trip) ───────────────
await page.setInputFiles("#open-file", savedPath);
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
cfg = await fullConfig();
check("LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file (clef.glyphs replace, no default bleed-through)",
  JSON.stringify(cfg) === JSON.stringify(savedJson));
check("LOAD: loaded config reported valid in the IO panel",
  await page.evaluate(() => !!document.querySelector(".cnb-cio-valid")));
check("LOAD: the clef editor re-seeded from the loaded config (enabled checked, uat-clef selected, anchor 22.784, gutter 20)",
  await page.evaluate(() =>
    document.querySelector(".cnb-cle-enable-check").checked &&
    document.querySelector('.cnb-cle-glyph-option[data-glyph-name="uat-clef"]')
      .classList.contains("selected") &&
    document.querySelector(".cnb-cle-anchor-input").value === "22.784" &&
    document.querySelector(".cnb-cle-gutter-input").value === "20"));
check("LOAD: the preview still renders the positioned clef gutter",
  (await clefColCount()) === 1 &&
  await page.$eval(".cnb-pvd-preview .cnb-clef",
    (el, t) => el.getAttribute("transform") === t, `translate(20,${grid2.semiToY(22.784)})`));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-loaded.png"), fullPage: true });

// ── STEP 6: export a .ly file (Module 18, real download) ────────────────────
const [exportDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click("#export-ly"),
]);
const exportedPath = path.join(SHOT_DIR, "uat-009-s2-exported.ly");
await exportDownload.saveAs(exportedPath);
const exported = await readFile(exportedPath, "utf8");
cfg = await fullConfig();
let direct = null, directErr = null;
try { direct = CNBLilypond.generate(cfg); } catch (err) { directErr = err.message; }
check("EXPORT PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)",
  direct !== null && direct === exported,
  directErr || `lengths ${exported.length} vs ${direct ? direct.length : "n/a"}`);
// The set-009 no-emission pin, end-to-end: the engine has no clef hook
// (s1-engine-coordination.md), so the clef-enabled download must be
// byte-identical to the export of the same config with the clef disabled.
const disabledCfg = CNBConfig.clone(cfg);
disabledCfg.clef.enabled = false;
check("EXPORT NO-EMISSION: the clef-enabled download is byte-identical to generate() of the same config with the clef disabled, and contains no clef token",
  direct !== null && CNBLilypond.generate(disabledCfg) === exported &&
  !exported.includes("clef"),
  "clef leaked into the export");
check("EXPORT: valid badge shown, no error rows",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-verror").length === 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-exported.png"), fullPage: true });

// ── STEP 7: no errors ────────────────────────────────────────────────────────
check("NO console or page errors across the whole clef flow", consoleErrors.length === 0,
  consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots + saved/exported files: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
