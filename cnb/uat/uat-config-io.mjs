/**
 * uat-config-io.mjs — Playwright UAT driver for Module 17 (Config
 * Save/Load), session-set 006 session 1.
 *
 * Executes the DSL-style checklist recorded in
 * docs/session-sets/006-config-io-export-and-preview/s1-uat.md against
 * cnb/test-pages/test-config-io.html, served from the repo root by a
 * built-in static server. (The dabbler-uat-dsl compiler is still in
 * bootstrap; this driver is the checklist's executable form and can be
 * replaced by the compiled DSL output once that pipeline lands.)
 *
 * Flow (spec step 4): edit the config through a set-005 editor (Module 15),
 * save to JSON (a real browser download is captured), RELOAD the app, load
 * the JSON file back through the file input, and confirm the editor
 * reflects the reloaded state. Also covers second-save timestamp behavior
 * (created preserved, modified re-stamped) and a malformed-file load.
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-config-io.mjs
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
 * Optional: CNB_UAT_PORT (default 8146), CNB_UAT_SHOTS (screenshot dir,
 * default <os tmpdir>/cnb-uat).
 *
 * Exit code 0 = all checks passed; 1 = at least one check failed.
 */
import http from "http";
import os from "os";
import { readFile, mkdir, writeFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8146);
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
  viewport: { width: 1500, height: 1400 },
  acceptDownloads: true,           // the save button triggers a real download
});

const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

const URL_PATH = `http://localhost:${PORT}/cnb/test-pages/test-config-io.html`;
await page.goto(URL_PATH);
await page.waitForSelector(".cnb-config-io");

const statePanel = async () => JSON.parse(await page.textContent("#state-json"));
const status = async () => page.textContent(".cnb-cio-status");
const errorArea = async () => page.textContent(".cnb-cio-error");
const modeSelected = async (mode) => page.evaluate((mode) =>
  document.querySelector(`.cnb-cpe-mode-option[data-mode="${mode}"]`).classList.contains("selected"), mode);
const minimCount = async () => page.evaluate(() =>
  document.querySelector('.cnb-cpe-repeat-count[data-duration="minim"]').value);
const falseHollowChecked = async () => page.evaluate(() =>
  document.querySelector(".cnb-cpe-false-hollow").checked);
const setTextInput = async (selector, value) => page.evaluate(({ selector, value }) => {
  const inp = document.querySelector(selector);
  inp.value = value;
  inp.dispatchEvent(new Event("input", { bubbles: true }));
}, { selector, value });
const isIso = (s) => typeof s === "string" && Number.isFinite(Date.parse(s));

// ── Initial state ────────────────────────────────────────────────────────────
check('PAGE title contains "Config Save/Load"', (await page.title()).includes("Config Save/Load"));
check("IO PANEL: save button, filename preview, and .json file input present",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cio-save") &&
    document.querySelector(".cnb-cio-filename").textContent === "default-4-8-system.cnb.json" &&
    document.querySelector(".cnb-cio-file").getAttribute("accept") === ".json,application/json"));
let st = await statePanel();
check("STATE PANEL: default config — timestamps null, shape mode, engine defaults",
  st.meta.created === null && st.meta.modified === null &&
  st.durations.representationMode === "shape" && st.engine.falseHollow === false);
check("EDITOR (Module 15) mounted on the shared config", await modeSelected("shape"));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s1-initial.png"), fullPage: true });

// ── Edit the config through the set-005 editor ──────────────────────────────
await page.click('.cnb-cpe-mode-option[data-mode="repeat"]');
await setTextInput('.cnb-cpe-repeat-count[data-duration="minim"]', "3");
await page.click(".cnb-cpe-false-hollow");
st = await statePanel();
check("EDIT: repeat mode + minim count 3 + falseHollow true reach the shared config",
  st.durations.representationMode === "repeat" &&
  st.durations.repeatCounts.minim === 3 && st.engine.falseHollow === true);

// ── First save (download captured) ──────────────────────────────────────────
const [download1] = await Promise.all([
  page.waitForEvent("download"),
  page.click(".cnb-cio-save"),
]);
check('SAVE 1: download suggested filename is "default-4-8-system.cnb.json"',
  download1.suggestedFilename() === "default-4-8-system.cnb.json",
  download1.suggestedFilename());
const savedPath = path.join(SHOT_DIR, "uat-006-s1-saved.cnb.json");
await download1.saveAs(savedPath);
const saved1 = JSON.parse(await readFile(savedPath, "utf8"));
check("SAVE 1: file carries the edited state (repeat mode, minim 3, falseHollow)",
  saved1.durations.representationMode === "repeat" &&
  saved1.durations.repeatCounts.minim === 3 && saved1.engine.falseHollow === true);
check("SAVE 1: meta.created and meta.modified stamped as ISO timestamps (first save)",
  isIso(saved1.meta.created) && saved1.meta.modified === saved1.meta.created);
st = await statePanel();
check("SAVE 1: host adopted the stamped config (state panel shows created/modified)",
  st.meta.created === saved1.meta.created && st.meta.modified === saved1.meta.modified);
check('SAVE 1: status line reads "Saved as default-4-8-system.cnb.json"',
  (await status()).includes("Saved as default-4-8-system.cnb.json"));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s1-saved.png"), fullPage: true });

// ── Second save: created preserved, modified re-stamped ─────────────────────
await new Promise(r => setTimeout(r, 1100));   // ensure a later timestamp second
const [download2] = await Promise.all([
  page.waitForEvent("download"),
  page.click(".cnb-cio-save"),
]);
const saved2Path = path.join(SHOT_DIR, "uat-006-s1-saved-2.cnb.json");
await download2.saveAs(saved2Path);
const saved2 = JSON.parse(await readFile(saved2Path, "utf8"));
check("SAVE 2: meta.created preserved from the first save; meta.modified re-stamped later",
  saved2.meta.created === saved1.meta.created &&
  isIso(saved2.meta.modified) && saved2.meta.modified > saved1.meta.modified,
  `created ${saved2.meta.created}, modified ${saved2.meta.modified}`);

// ── Reload the app: state is gone ────────────────────────────────────────────
await page.reload();
await page.waitForSelector(".cnb-config-io");
st = await statePanel();
check("RELOAD: app back at defaults (shape mode, no falseHollow, timestamps null)",
  st.durations.representationMode === "shape" && st.engine.falseHollow === false &&
  st.meta.created === null && await modeSelected("shape") && !(await falseHollowChecked()));

// ── Load the saved file back ─────────────────────────────────────────────────
await page.setInputFiles(".cnb-cio-file", savedPath);
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
check('LOAD: status names the file and the config ("Loaded … Default 4-8 System")',
  (await status()).includes("uat-006-s1-saved.cnb.json") &&
  (await status()).includes("Default 4-8 System"));
check("LOAD: validation area shows the loaded config valid (with Module A warnings)",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cio-valid") &&
    document.querySelectorAll(".cnb-cio-verror").length === 0 &&
    document.querySelectorAll(".cnb-cio-vwarning").length > 0));
st = await statePanel();
check("LOAD: shared config restored (repeat mode, minim 3, falseHollow, timestamps)",
  st.durations.representationMode === "repeat" && st.durations.repeatCounts.minim === 3 &&
  st.engine.falseHollow === true && st.meta.created === saved1.meta.created);
check("LOAD: the set-005 EDITOR reflects the reloaded state (repeat selected, minim 3, falseHollow checked)",
  (await modeSelected("repeat")) && (await minimCount()) === "3" && (await falseHollowChecked()));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s1-loaded.png"), fullPage: true });

// ── Malformed file: error surfaced, state untouched ─────────────────────────
const badPath = path.join(SHOT_DIR, "uat-006-s1-malformed.cnb.json");
await writeFile(badPath, "{ this is not json", "utf8");
await page.setInputFiles(".cnb-cio-file", badPath);
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-error").textContent.includes("Load failed"));
check("MALFORMED LOAD: error area names the JSON parse failure",
  (await errorArea()).includes("not valid JSON"));
st = await statePanel();
check("MALFORMED LOAD: shared config and editor untouched (still the loaded state)",
  st.durations.representationMode === "repeat" && st.engine.falseHollow === true &&
  (await modeSelected("repeat")) && (await falseHollowChecked()));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s1-malformed.png"), fullPage: true });

// ── No errors ────────────────────────────────────────────────────────────────
check("NO console or page errors across the whole flow", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots + saved files: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
