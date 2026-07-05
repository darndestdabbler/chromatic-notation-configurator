/**
 * uat-kite-pipeline.mjs — Session-set 007 session 1: UI half of the
 * end-to-end pipeline round-trip.
 *
 * Drives the assembled application (cnb/index.html) through the golden
 * path for the Kite 4-369 baseline-reproduction fixture:
 *   1. Load cnb/fixtures/kite-4-369-config.json via the Module 17 config
 *      loader (real file input).
 *   2. Confirm the shared config adopted the fixture and every editor
 *      re-seeded (3-6-9 staff, repeat mode, kite shapes, preview rows).
 *   3. Export the .ly via the Module 18 export button (real download).
 *   4. Parity: the downloaded .ly must be byte-identical to a direct
 *      CNBLilypond.generate() call on the fixture in THIS Node process
 *      (same call cnb/fixtures/export-kite-4-369.mjs makes) — proving the
 *      UI golden path and the headless export produce the same artifact
 *      that is then rendered through the engine repo.
 *
 * The captured download is written to <shots>/kite-4-369-ui-export.ly so
 * the render/diff step can consume the UI-exported artifact directly.
 *
 * Dependency resolution, env vars, and exit codes are identical to
 * uat-golden-path.mjs (playwright-core + ms-playwright cache Chromium;
 * exit 2 = missing dependency, 1 = check failure, 0 = all passed).
 *
 * Usage: node cnb/uat/uat-kite-pipeline.mjs
 */
import http from "http";
import os from "os";
import { readFile, mkdir } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBCollection } from "../src/cnb-collection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE = path.join(ROOT, "cnb", "fixtures", "kite-4-369-config.json");
const PORT = Number(process.env.CNB_UAT_PORT || 8149);
const SHOT_DIR = process.env.CNB_UAT_SHOTS || path.join(os.tmpdir(), "cnb-uat");

// ── Dependency resolution (same contract as uat-golden-path.mjs) ────────────
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright-core"));
} catch {
  const alt = process.env.CNB_UAT_PLAYWRIGHT;
  if (!alt) {
    console.error(
      "playwright-core not found. Run `npm install playwright-core` next to " +
      "this repo, or set CNB_UAT_PLAYWRIGHT to a directory whose " +
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
  acceptDownloads: true,
});

await page.route("https://fonts.googleapis.com/**", route =>
  route.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.route("https://fonts.gstatic.com/**", route =>
  route.fulfill({ status: 200, contentType: "font/woff2", body: "" }));

const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

await page.goto(`http://localhost:${PORT}/cnb/index.html`);
await page.waitForSelector(".cnb-preview-display");

const fullConfig = async () => JSON.parse(await page.textContent("#state-json"));
const cardCount = async () => page.$$eval(".cnb-pvd-preview .pc-col", els => els.length);

// ── STEP 1: load the Kite 4-369 fixture through the Module 17 loader ────────
await page.setInputFiles(".cnb-cio-file", FIXTURE);
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
check("LOAD: config-io reports the fixture loaded and valid",
  await page.evaluate(() => !!document.querySelector(".cnb-cio-valid")));

let cfg = await fullConfig();
check("LOAD: shared config adopted the Kite 4-369 system (pattern [3,6,9], sps 3, midpoint 12, repeat mode, falseHollow, both kite shapes, 3 rules)",
  JSON.stringify(cfg.staff.semitonePattern) === "[3,6,9]" &&
  cfg.staff.semitonesPerStaffSpace === 3 &&
  cfg.staff.midpoint === 12 &&
  cfg.durations.representationMode === "repeat" &&
  cfg.engine.falseHollow === true &&
  !!cfg.shapes["kite-up"] && !!cfg.shapes["kite-down"] &&
  cfg.noteheadRules.length === 3,
  JSON.stringify({ pattern: cfg.staff.semitonePattern, mode: cfg.durations.representationMode }));

check("LOAD: editors re-seeded — 3-6-9 staff pattern and repeat mode show selected, 3 rule cards",
  await page.evaluate(() =>
    document.querySelector('.cnb-sre-pattern-option[data-pattern-key="3-6-9"]').classList.contains("selected") &&
    document.querySelector('.cnb-cpe-mode-option[data-mode="repeat"]').classList.contains("selected") &&
    document.querySelectorAll(".cnb-nre-rule-card").length === 3));

// ── STEP 2: the preview renders the loaded system ────────────────────────────
const expectedLines = CNBStaff.getPositions(cfg, CNBCollection.gridRange(
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).length;
check(`PREVIEW: full chromatic row (13 cards) with ${expectedLines} staff lines (Node-side CNBStaff.getPositions on the same config)`,
  (await cardCount()) === 13 &&
  await page.$$eval(".cnb-pvd-preview .staff-lines-bg line",
    (els, n) => els.length === n, expectedLines),
  `cards=${await cardCount()}`);
check("PREVIEW: kite noteheads drawn with the baked palette — skyblue #50b4e9 and rose #cc79a7 fills present",
  await page.evaluate(() =>
    [...document.querySelectorAll(".cnb-pvd-preview path")]
      .some(p => (p.getAttribute("fill") || "").toLowerCase() === "#50b4e9") &&
    [...document.querySelectorAll(".cnb-pvd-preview path")]
      .some(p => (p.getAttribute("fill") || "").toLowerCase() === "#cc79a7")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-007-s1-kite-loaded.png"), fullPage: true });

// ── STEP 3: export the .ly via the Module 18 export button ───────────────────
const [exportDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click(".cnb-cex-export"),
]);
check("EXPORT: download produced with a .ly suggested filename",
  exportDownload.suggestedFilename().endsWith(".ly"),
  exportDownload.suggestedFilename());
const exportedPath = path.join(SHOT_DIR, "kite-4-369-ui-export.ly");
await exportDownload.saveAs(exportedPath);
const exported = await readFile(exportedPath, "utf8");
check('EXPORT: status shows the export succeeded with the valid badge, no error rows',
  (await page.textContent(".cnb-cex-status")).includes("Exported as") &&
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-verror").length === 0));

// ── STEP 4: parity with the headless export path ─────────────────────────────
cfg = await fullConfig();
let direct = null, directErr = null;
try { direct = CNBLilypond.generate(cfg); } catch (err) { directErr = err.message; }
check("PARITY: downloaded .ly is byte-identical to CNBLilypond.generate() on the page's live config (Node-side)",
  direct !== null && direct === exported,
  directErr || `lengths ${exported.length} vs ${direct ? direct.length : "n/a"}`);

const fixtureJson = JSON.parse(await readFile(FIXTURE, "utf8"));
let fromFixture = null, fixtureErr = null;
try { fromFixture = CNBLilypond.generate(fixtureJson); } catch (err) { fixtureErr = err.message; }
check("PARITY: downloaded .ly is byte-identical to generate() on the fixture file itself (same artifact the headless driver renders through the engine)",
  fromFixture !== null && fromFixture === exported,
  fixtureErr || `lengths ${exported.length} vs ${fromFixture ? fromFixture.length : "n/a"}`);

check("EXPORT CONTENT: Kite system reached the .ly — both kite paths, 3-6-9 geometry, false-hollow, repeat #t clauses, baked skyblue/rose colors",
  exported.includes("cnb:register-path! 'kite-up") &&
  exported.includes("cnb:register-path! 'kite-down") &&
  exported.includes("cnb:semitones-per-staff-space 3") &&
  exported.includes("cnb:false-hollow #t") &&
  /\(repeat\s+\. #t\)/.test(exported) &&
  exported.includes("skyblue-50b4e9") &&
  exported.includes("rose-cc79a7"),
  exported.slice(0, 200));

check("NO console or page errors across the pipeline",
  consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`UI-exported .ly + screenshots: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
