/**
 * uat-common-props-editor.mjs — Playwright UAT driver for Module 15
 * (Common Properties Editor), session-set 005 session 3.
 *
 * Executes the DSL-style checklist recorded in
 * docs/session-sets/005-rule-editors/s3-uat.md against
 * cnb/test-pages/test-common-props-editor.html, served from the repo root
 * by a built-in static server. (The dabbler-uat-dsl compiler is still in
 * bootstrap; this driver is the checklist's executable form and can be
 * replaced by the compiled DSL output once that pipeline lands.)
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-common-props-editor.mjs
 *
 * Requirements — the driver errors out (exit 2) rather than guessing:
 *   - playwright-core in the repo's node_modules (`npm install`), or set CNB_UAT_PLAYWRIGHT
 *     to a directory whose node_modules contains it
 *     (`npm install` at the repository root installs it).
 *   - A Chromium executable: CNB_UAT_CHROMIUM if set to a non-empty value
 *     (a non-empty-but-invalid path is an error, not a fallback — cache
 *     discovery is NOT attempted; an unset or empty variable means cache
 *     discovery);
 *     otherwise the newest chromium-* browser discovered in the platform's
 *     ms-playwright cache directory (%LOCALAPPDATA%/ms-playwright on
 *     Windows, ~/Library/Caches/ms-playwright on macOS,
 *     ~/.cache/ms-playwright on Linux).
 *
 * Optional: CNB_UAT_PORT (default 8145), CNB_UAT_SHOTS (screenshot dir,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8145);
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
    // An explicitly configured path that is wrong is an error to surface,
    // not something to silently paper over with cache discovery.
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
const page = await browser.newPage({ viewport: { width: 1500, height: 1400 } });

const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

await page.goto(`http://localhost:${PORT}/cnb/test-pages/test-common-props-editor.html`);
await page.waitForSelector(".cnb-common-props-editor");

const readJson = async () => JSON.parse(await page.textContent("#config-json"));
const sectionB = async () => page.textContent("#section-b");
const repeatField = async () => page.textContent("#lilypond-repeat-field");
const rowCount = async () => page.evaluate(() =>
  document.querySelectorAll("#preview-host .cnb-duration-row").length);
const captionCount = async () => page.evaluate(() =>
  document.querySelectorAll("#preview-host .cnb-duration-caption").length);
const legendTexts = async () => page.evaluate(() =>
  [...document.querySelectorAll("#preview-host .cnb-cpe-repeat-item")].map(i => i.textContent));
// Notehead groups in the first card of the duration row at `rowIndex`.
const headsInFirstCard = async (rowIndex) => page.evaluate((rowIndex) => {
  const row = document.querySelectorAll("#preview-host .cnb-duration-row")[rowIndex];
  const svg = row.querySelector(".pc-col .note-slice");
  return [...svg.children].filter(c => c.tagName === "g" && c.getAttribute("class") !== "cnb-ledger-set").length;
}, rowIndex);
const badgeText = async (rowClass) => page.evaluate((rowClass) =>
  document.querySelector(`.${rowClass} .cnb-cpe-badge`).textContent, rowClass);
const setTextInput = async (selector, value) => page.evaluate(({ selector, value }) => {
  const inp = document.querySelector(selector);
  inp.value = value;
  inp.dispatchEvent(new Event("input", { bubbles: true }));
}, { selector, value });

// ── Initial state (shape mode, engine defaults) ─────────────────────────────
check('PAGE title contains "Common Properties Editor"',
  (await page.title()).includes("Common Properties Editor"));
check("DEFINITIONS list has 4 read-only rows in definition order",
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".cnb-cpe-def-row")];
    return JSON.stringify(rows.map(r => r.dataset.duration)) ===
      '["crotchet","minim","semibreve","breve"]' &&
      rows.every(r => r.querySelectorAll("input,select,button").length === 0);
  }));
check("NO MODE CONTROL in the editor: the app chooses the mode on the canvas (session 36); the page's toggle shows shape",
  await page.evaluate(() =>
    !document.querySelector("#editor-host .cnb-cpe-mode, #editor-host .cnb-cpe-mode-option") &&
    document.querySelector('#mode-toggle button[data-mode="shape"]').classList.contains("selected")));
check("NO REPEAT COUNTS section: the preview and the engine draw fixed counts (session 34)",
  await page.evaluate(() => !document.querySelector(".cnb-cpe-repeats, .cnb-cpe-repeat-count")));
check("ENGINE block has 5 rows; false-hollow badge reads default-omitted; no stem thickness row (the preview draws the engine's stem), no accessible-colours row (retired, session 37) and no multinote padding row (retired, session 58: the overlap is set on the canvas)",
  await page.evaluate(() =>
    document.querySelectorAll(".cnb-cpe-engine-row").length === 5 &&
    document.querySelector(".cnb-cpe-row-accessible") === null &&
    document.querySelector(".cnb-cpe-row-multinote") === null &&
    document.querySelector(".cnb-cpe-row-false-hollow .cnb-cpe-badge").textContent ===
      "engine default — omitted at export" &&
    document.querySelector(".cnb-cpe-row-stem") === null));
check("PREVIEW shows 4 captioned duration rows (Module 10, shape mode)",
  (await rowCount()) === 4 && (await captionCount()) === 4 &&
  await page.evaluate(() =>
    document.querySelector("#preview-host .cnb-duration-caption").textContent === "Crotchet (Quarter)"));
let j = await readJson();
check("JSON PANEL: shape mode, no repeat counts, default engine",
  j.durations.representationMode === "shape" && !("repeatCounts" in j.durations) &&
  j.engine.falseHollow === false && !("stemThickness" in j.engine));
check("SECTION B omits all emit-if-changed engine settings at defaults",
  await sectionB().then(b =>
    !b.includes("cnb:false-hollow") && !b.includes("cnb:default-magnify") &&
    !b.includes("cnb:stem-thickness") && !b.includes("cnb:multinote-padding")));
check('REPEAT FIELD line shows "(repeat . #f)"', (await repeatField()).includes("(repeat . #f)"));
check("VALIDATION shows Config valid", await page.evaluate(() => !!document.querySelector(".cnb-cpe-valid")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s3-initial.png"), fullPage: true });

// ── Toggle representation mode to "repeat" ──────────────────────────────────
await page.click('#mode-toggle button[data-mode="repeat"]');
check("TOGGLE REPEAT: the page's toggle shows repeat (set through the editor's setState)",
  await page.evaluate(() =>
    document.querySelector('#mode-toggle button[data-mode="repeat"]').classList.contains("selected")));
check("TOGGLE REPEAT: 4 captioned rows; each card draws the engine's repeated heads (crotchet 1, minim 2, semibreve 4, breve 8 octave pairs: two tied semibreves, session 44)",
  (await rowCount()) === 4 && (await captionCount()) === 4 &&
  JSON.stringify([await headsInFirstCard(0), await headsInFirstCard(1), await headsInFirstCard(2), await headsInFirstCard(3)]) ===
    JSON.stringify([2, 4, 8, 16]));
check("TOGGLE REPEAT: the breve's card draws a tie on each notehead of the pair; no other card draws one",
  await page.evaluate(() => [...document.querySelectorAll("#preview-host .cnb-duration-row")]
    .map(row => row.querySelector(".pc-col .note-slice").querySelectorAll(".cnb-tie").length)
    .join(",") === "0,0,0,2"));
check("TOGGLE REPEAT: legend lists the engine's counts — minim 2, semibreve 4, breve two tied semibreves of 8 heads",
  await legendTexts().then(t => JSON.stringify(t) === JSON.stringify([
    "Minim (Half): 2 heads",
    "Semibreve (Whole): 4 heads",
    "Breve (Double Whole): two tied semibreves, 8 heads",
  ])));
j = await readJson();
check('TOGGLE REPEAT: JSON representationMode "repeat"; Section C repeat field flips to #t',
  j.durations.representationMode === "repeat" && (await repeatField()).includes("(repeat . #t)"));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s3-repeat-mode.png"), fullPage: true });


// ── Engine settings ──────────────────────────────────────────────────────────
await page.click(".cnb-cpe-false-hollow");
j = await readJson();
check("FALSE HOLLOW on: JSON true; badge flips; Section B emits #(set! cnb:false-hollow #t)",
  j.engine.falseHollow === true &&
  (await badgeText("cnb-cpe-row-false-hollow")) === "non-default — will be emitted" &&
  (await sectionB()).includes("#(set! cnb:false-hollow #t)"));

await setTextInput(".cnb-cpe-default-magnify", "3/2");
j = await readJson();
check('MAGNIFY "3/2": JSON follows; Section B emits #(set! cnb:default-magnify 3/2)',
  j.engine.defaultMagnify === "3/2" &&
  (await sectionB()).includes("#(set! cnb:default-magnify 3/2)"));

await page.screenshot({ path: path.join(SHOT_DIR, "uat-s3-engine.png"), fullPage: true });

// ── Back to shape mode ───────────────────────────────────────────────────────
await page.click('#mode-toggle button[data-mode="shape"]');
j = await readJson();
check("BACK TO SHAPE: 4 preview rows restored, legend gone, repeat field #f",
  (await rowCount()) === 4 &&
  await page.evaluate(() =>
    document.querySelectorAll("#preview-host .cnb-cpe-repeat-item").length === 0) &&
  (await repeatField()).includes("(repeat . #f)") &&
  j.durations.representationMode === "shape");
check("BACK TO SHAPE: validation still Config valid",
  await page.evaluate(() => !!document.querySelector(".cnb-cpe-valid")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s3-back-to-shape.png"), fullPage: true });

// ── No errors ────────────────────────────────────────────────────────────────
check("NO console or page errors across the whole flow", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
