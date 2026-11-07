/**
 * uat-config-export.mjs — Playwright UAT driver for Module 18 (Config
 * Export / LilyPond), session-set 006 session 2.
 *
 * Executes the DSL-style checklist recorded in
 * docs/session-sets/006-config-io-export-and-preview/s2-uat.md against
 * cnb/test-pages/test-config-export.html, served from the repo root by a
 * built-in static server. (The dabbler-uat-dsl compiler is still in
 * bootstrap; this driver is the checklist's executable form and can be
 * replaced by the compiled DSL output once that pipeline lands.)
 *
 * Flow (spec step 3): configure a valid notation system through the
 * sets 004–005 editors (Module 12 palette → Dark2 3-color preset;
 * Module 13 staff rules → 3-6-9 system; Module 15 common properties →
 * repeat representation mode), click export, confirm a
 * .ly file downloads and its contents match a direct
 * CNBLilypond.generate() call on the same config — the direct call runs in
 * THIS Node process on the full config read from the page's state panel,
 * so the parity check is independent of the browser. Also covers the
 * blocked path (spec step 2): break the config through the staff editor
 * (single-line custom pattern), confirm export is blocked with the reasons
 * listed and no download fired, then fix and export again.
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-config-export.mjs
 *
 * Requirements — the driver errors out (exit 2) rather than guessing:
 *   - playwright-core in the repo's node_modules (`npm install`), or set CNB_UAT_PLAYWRIGHT
 *     to a directory whose node_modules contains it
 *     (`npm install` at the repository root installs it).
 *   - A Chromium executable: CNB_UAT_CHROMIUM if set to a non-empty value
 *     (a non-empty-but-invalid path is an error, not a fallback — cache
 *     discovery is NOT attempted; an unset or empty variable means cache
 *     discovery); otherwise the newest chromium-* browser discovered in
 *     the platform's ms-playwright cache directory.
 *
 * Optional: CNB_UAT_PORT (default 8147), CNB_UAT_SHOTS (screenshot dir,
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
import { CNBLilypond } from "../src/cnb-lilypond.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8147);
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
      "a Chromium/Chrome binary, or install one (npx playwright-core install chromium).");
    process.exit(2);
  }
}
await mkdir(SHOT_DIR, { recursive: true });

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
  viewport: { width: 1500, height: 1600 },
  acceptDownloads: true,           // the export button triggers a real download
});

const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

// Count EVERY download the page fires — the blocked-export check asserts
// this counter does not move.
let downloadCount = 0;
page.on("download", () => downloadCount++);

const URL_PATH = `http://localhost:${PORT}/cnb/test-pages/test-config-export.html`;
await page.goto(URL_PATH);
await page.waitForSelector(".cnb-config-export");

const fullConfig = async () => JSON.parse(await page.textContent("#state-json"));
const status = async () => page.textContent(".cnb-cex-status");
const errorArea = async () => page.textContent(".cnb-cex-error");
const filenamePreview = async () => page.textContent(".cnb-cex-filename");
const verrorTexts = async () => page.$$eval(".cnb-cex-verror", els => els.map(e => e.textContent));
const modeSelected = async (mode) => page.evaluate((mode) =>
  document.querySelector(`.cnb-cpe-mode-option[data-mode="${mode}"]`).classList.contains("selected"), mode);

// ── Initial state ────────────────────────────────────────────────────────────
check('PAGE title contains "Config Export"', (await page.title()).includes("Config Export"));
check('EXPORT PANEL: button present, filename preview "default48.ly" (from meta.fileSuffix)',
  await page.evaluate(() => !!document.querySelector(".cnb-cex-export")) &&
  (await filenamePreview()) === "default48.ly",
  await filenamePreview());
let cfg = await fullConfig();
check("STATE PANEL: full default config exposed (4-8 pattern, shape mode, fileSuffix -Default48)",
  JSON.stringify(cfg.staff.semitonePattern) === "[4,8]" &&
  cfg.durations.representationMode === "shape" && cfg.meta.fileSuffix === "-Default48");
check("EDITORS (Modules 12 + 13 + 15) mounted on the shared config",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-palette-editor") &&
    !!document.querySelector(".cnb-sre-pattern-option.selected") &&
    !!document.querySelector('.cnb-cpe-mode-option[data-mode="shape"]')) &&
  await modeSelected("shape"));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s2-initial.png"), fullPage: true });

// ── Configure a valid notation system through the sets 004–005 editors ──────
await page.click('.cnb-pal-option[data-preset-key="dark2-3"]');   // Module 12 (set 004)
await page.click('.cnb-sre-pattern-option[data-pattern-key="3-6-9"]');   // Module 13
await page.click('.cnb-cpe-mode-option[data-mode="repeat"]');            // Module 15
cfg = await fullConfig();
check("EDIT: Dark2 3-color palette reaches the shared config (12 per-PC colors, scheme symbols)",
  cfg.palette.colors.length === 12 &&
  cfg.palette.colors[0].hex.toLowerCase() === "#1b9e77" &&
  Object.keys(cfg.palette.schemeSymbols || {}).length > 0,
  JSON.stringify({ n: cfg.palette.colors.length, first: cfg.palette.colors[0] }));
check("EDIT: 3-6-9 staff system + repeat mode reach the shared config",
  JSON.stringify(cfg.staff.semitonePattern) === "[3,6,9]" &&
  cfg.staff.semitonesPerStaffSpace === 3 &&
  cfg.durations.representationMode === "repeat",
  JSON.stringify({ pattern: cfg.staff.semitonePattern, sps: cfg.staff.semitonesPerStaffSpace, mode: cfg.durations.representationMode }));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s2-configured.png"), fullPage: true });

// ── Export (download captured) ───────────────────────────────────────────────
const [download1] = await Promise.all([
  page.waitForEvent("download"),
  page.click(".cnb-cex-export"),
]);
check('EXPORT: download suggested filename is "default48.ly"',
  download1.suggestedFilename() === "default48.ly",
  download1.suggestedFilename());
const exportedPath = path.join(SHOT_DIR, "uat-006-s2-exported.ly");
await download1.saveAs(exportedPath);
const exported = await readFile(exportedPath, "utf8");
check("EXPORT: file is a complete .ly (version declaration, Sections A/B/C)",
  exported.startsWith('\\version') && exported.includes("SECTION A") &&
  exported.includes("SECTION B") && exported.includes("SECTION C"));
check("EXPORT: 3-6-9 staff geometry reached Section B (sps 3, positions from the editor)",
  exported.includes("cnb:semitones-per-staff-space 3") &&
  exported.includes("cnb:staff-line-positions"));
check("EXPORT: repeat representation mode reached Section C ((repeat . #t) clauses)",
  /\(repeat\s+\. #t\)/.test(exported));
check("EXPORT: the set-004 palette reached Section A (cnb:register-color! shamrock-1b9e77)",
  exported.includes("cnb:register-color!") && exported.includes("shamrock-1b9e77"));
check('EXPORT: status line reads "Exported as default48.ly"; error area empty',
  (await status()).includes("Exported as default48.ly") && (await errorArea()) === "");
check("EXPORT: validation area shows the valid badge + Module A warnings, no errors",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-verror").length === 0 &&
    document.querySelectorAll(".cnb-cex-vwarning").length > 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s2-exported.png"), fullPage: true });

// ── Parity: downloaded file === direct CNBLilypond.generate() in Node ───────
cfg = await fullConfig();
let direct = null, directErr = null;
try { direct = CNBLilypond.generate(cfg); } catch (err) { directErr = err.message; }
check("PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call " +
  "on the same config (run in Node, independent of the browser)",
  direct !== null && direct === exported,
  directErr || `lengths ${exported.length} vs ${direct ? direct.length : "n/a"}`);

// ── Blocked export: break the config through the staff editor ───────────────
// Custom pattern starts from the current 3-6-9 selection; toggling off
// PCs 3 and 6 leaves a single staff line (Module A error: at least 2).
await page.click('.cnb-sre-pattern-option[data-pattern-key="custom"]');
await page.click('.cnb-sre-pc-toggle[data-pc="3"]');
await page.click('.cnb-sre-pc-toggle[data-pc="6"]');
cfg = await fullConfig();
check("BREAK: custom single-line pattern [9] reaches the shared config",
  JSON.stringify(cfg.staff.semitonePattern) === "[9]",
  JSON.stringify(cfg.staff.semitonePattern));

const downloadsBefore = downloadCount;
await page.click(".cnb-cex-export");
await page.waitForFunction(() =>
  document.querySelector(".cnb-cex-status").textContent.includes("Export blocked"));
// Give any (wrong) download a moment to fire before asserting the counter.
await page.waitForTimeout(400);
check("BLOCKED: no download fired", downloadCount === downloadsBefore,
  `downloads ${downloadsBefore} -> ${downloadCount}`);
check('BLOCKED: status reads "Export blocked — fix 1 error below" (with the blocked ' +
  "styling class); error area empty (a validation block is not an unexpected failure)",
  (await status()).includes("Export blocked") && (await status()).includes("1 error") &&
  (await errorArea()) === "" &&
  await page.evaluate(() =>
    document.querySelector(".cnb-cex-status").classList.contains("cnb-cex-status-blocked")),
  await status());
check("BLOCKED: the WHY is listed — staff pattern needs at least 2 positions (spec step 2)",
  (await verrorTexts()).some(t => t.includes("at least 2")),
  (await verrorTexts()).join(" | "));
check("BLOCKED: no valid badge; warnings still listed",
  await page.evaluate(() =>
    !document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-vwarning").length > 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s2-blocked.png"), fullPage: true });

// ── Fix and export again ─────────────────────────────────────────────────────
await page.click('.cnb-sre-pattern-option[data-pattern-key="3-6-9"]');
const [download2] = await Promise.all([
  page.waitForEvent("download"),
  page.click(".cnb-cex-export"),
]);
const fixedPath = path.join(SHOT_DIR, "uat-006-s2-fixed.ly");
await download2.saveAs(fixedPath);
const fixed = await readFile(fixedPath, "utf8");
check("FIXED: after restoring 3-6-9, export succeeds again and matches the first export",
  download2.suggestedFilename() === "default48.ly" && fixed === exported);
check("FIXED: validation area back to valid badge, no error rows",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-verror").length === 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s2-fixed.png"), fullPage: true });

// ── No errors ────────────────────────────────────────────────────────────────
check("NO console or page errors across the whole flow", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots + exported files: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
