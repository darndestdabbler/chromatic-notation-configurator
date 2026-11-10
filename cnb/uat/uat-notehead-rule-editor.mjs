/**
 * uat-notehead-rule-editor.mjs — Playwright UAT driver for Module 14
 * (Notehead Rule Editor), session-set 005 session 2.
 *
 * Executes the DSL-style checklist recorded in
 * docs/session-sets/005-rule-editors/s2-uat.md against
 * cnb/test-pages/test-notehead-rule-editor.html, served from the repo root
 * by a built-in static server. (The dabbler-uat-dsl compiler is still in
 * bootstrap; this driver is the checklist's executable form and can be
 * replaced by the compiled DSL output once that pipeline lands.)
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-notehead-rule-editor.mjs
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
 * Optional: CNB_UAT_PORT (default 8144), CNB_UAT_SHOTS (screenshot dir,
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
const PORT = Number(process.env.CNB_UAT_PORT || 8144);
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

await page.goto(`http://localhost:${PORT}/cnb/test-pages/test-notehead-rule-editor.html`);
await page.waitForSelector(".cnb-notehead-rule-editor");

const readJson = async () => JSON.parse(await page.textContent("#config-json"));
const cardCount = async () => page.evaluate(() =>
  document.querySelectorAll(".cnb-nre-rule-card").length);
const stripFill = async (pc) => page.evaluate((pc) => document
  .querySelector(`.cnb-nre-resolved-cell[data-pc="${pc}"] .cnb-nre-resolved-fill`).textContent, pc);
const stripShape = async (pc) => page.evaluate((pc) => document
  .querySelector(`.cnb-nre-resolved-cell[data-pc="${pc}"] .cnb-nre-resolved-shape`).textContent, pc);
const stripSwatch = async (pc) => page.evaluate((pc) => document
  .querySelector(`.cnb-nre-resolved-cell[data-pc="${pc}"] .cnb-nre-resolved-swatch`).dataset.color, pc);
const stripMark = async (pc) => page.evaluate((pc) => document
  .querySelector(`.cnb-nre-resolved-cell[data-pc="${pc}"] .cnb-nre-resolved-mark`).dataset.mark, pc);
// Preview row (Module 6): the notehead <g> holds 1 path (solid) or 2 (hollow).
const previewPathCount = async (pc) => page.evaluate((pc) => document
  .querySelector(`#preview-host .cnb-nre-preview-cell[data-pc="${pc}"] svg g`).children.length, pc);
const previewFill = async (pc) => page.evaluate((pc) => document
  .querySelector(`#preview-host .cnb-nre-preview-cell[data-pc="${pc}"] svg g path`).getAttribute("fill"), pc);
const previewPathD = async (pc) => page.evaluate((pc) => document
  .querySelector(`#preview-host .cnb-nre-preview-cell[data-pc="${pc}"] svg g path`).getAttribute("d"), pc);

// ── Initial state ────────────────────────────────────────────────────────────
check('PAGE title contains "Notehead Rule Editor"', (await page.title()).includes("Notehead Rule Editor"));
check("RULE LIST has 2 cards, numbered in application order",
  await page.evaluate(() => {
    const nums = [...document.querySelectorAll(".cnb-nre-rule-num")].map(n => n.textContent);
    return JSON.stringify(nums) === '["1","2"]';
  }));
check('RULE NAMES are "Default" and "Sharps are hollow"',
  await page.evaluate(() => {
    const names = [...document.querySelectorAll(".cnb-nre-rule-name")].map(i => i.value);
    return JSON.stringify(names) === '["Default","Sharps are hollow"]';
  }));
check("RESOLVED STRIP has 12 cells, duration select at crotchet",
  await page.evaluate(() =>
    document.querySelectorAll(".cnb-nre-resolved-cell").length === 12 &&
    document.querySelector(".cnb-nre-resolved-duration").value === "crotchet"));
check("RESOLVED STRIP C solid, C♯ hollow (cumulative sharps rule)",
  (await stripFill(0)) === "solid" && (await stripFill(1)) === "hollow");
check('RESOLVED STRIP explicit no-mark state is visibly rendered ("no mark")',
  await page.evaluate(() => {
    const m = document.querySelector('.cnb-nre-resolved-cell[data-pc="0"] .cnb-nre-resolved-mark');
    const style = getComputedStyle(m);
    return m.textContent === "no mark" && style.visibility !== "hidden" &&
      style.display !== "none" && m.offsetHeight > 0;
  }));
check("PREVIEW ROW has 12 notehead cells (Module 6 rendering)",
  await page.evaluate(() =>
    document.querySelectorAll("#preview-host .cnb-nre-preview-cell svg").length === 12));
check("PREVIEW C is 1 path (solid), C♯ is 2 paths (hollow cutout)",
  (await previewPathCount(0)) === 1 && (await previewPathCount(1)) === 2);
check("PREVIEW colours: no rule gives one, so C and D are black (no palette since session 37)",
  (await previewFill(0)) === "#000000" && (await previewFill(2)) === "#000000");
let j = await readJson();
check("JSON PANEL 2 rules, priorities [0,1], second rule apply is hollow-only",
  j.length === 2 && j[0].priority === 0 && j[1].priority === 1 &&
  JSON.stringify(Object.keys(j[1].apply)) === '["hollow"]');
check("VALIDATION shows Config valid", await page.evaluate(() => !!document.querySelector(".cnb-nre-valid")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s2-initial.png"), fullPage: true });

// ── Reorder an existing rule above/below its neighbor ──────────────────────
await page.click('.cnb-nre-rule-card[data-rule-index="1"] .cnb-nre-rule-up');
j = await readJson();
check('MOVE "Sharps are hollow" UP: JSON order swapped, priorities renumbered [0,1]',
  j[0].name === "Sharps are hollow" && j[0].priority === 0 &&
  j[1].name === "Default" && j[1].priority === 1);
check("MOVE UP: C♯ resolves solid — Default's hollow:false now applies later and wins",
  (await stripFill(1)) === "solid");
check("MOVE UP: preview C♯ redrawn with 1 path (solid)", (await previewPathCount(1)) === 1);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s2-reordered.png"), fullPage: true });

await page.click('.cnb-nre-rule-card[data-rule-index="0"] .cnb-nre-rule-down');
j = await readJson();
check("MOVE BACK DOWN: original order restored, C♯ hollow again",
  j[1].name === "Sharps are hollow" && (await stripFill(1)) === "hollow" &&
  (await previewPathCount(1)) === 2);

// ── Add a rule and give it shape + color ────────────────────────────────────
await page.click(".cnb-nre-rule-add");
j = await readJson();
check("ADD RULE: 3 cards; new rule matches all/all/all with empty apply at priority 2",
  (await cardCount()) === 3 && j.length === 3 && j[2].priority === 2 &&
  j[2].match.pitchClasses === "all" && JSON.stringify(j[2].apply) === "{}");
check("ADD RULE: resolution unchanged by the no-op rule (C♯ still hollow)",
  (await stripFill(1)) === "hollow");

await page.click('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-apply-shape-check');
j = await readJson();
check("ENABLE SHAPE: seeded with the first shape (crotchet-minim)",
  j[2].apply.shape === "crotchet-minim");
await page.selectOption('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-shape-select', "diamond");
j = await readJson();
check('SELECT DIAMOND: JSON apply.shape = "diamond"; strip shows Diamond for C',
  j[2].apply.shape === "diamond" && (await stripShape(0)) === "Diamond");
check("SELECT DIAMOND: preview C path is the diamond geometry",
  (await previewPathD(0)).startsWith("M 0 -100"));

await page.click('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-apply-color-check');
j = await readJson();
check("ENABLE COLOR: none (black) emits color null, and the mode shows None",
  j[2].apply.color === null &&
  await page.$eval('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-color-mode', el => el.value === "none" &&
    [...el.options].map(o => o.value).join(",") === "none,custom"));
await page.selectOption('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-color-mode', "custom");
await page.evaluate(() => {
  const inp = document.querySelector('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-color-input');
  inp.value = "#cc0000";
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  // Closing the picker fires `change`, which applies the colour and
  // redraws the panel and its resolved strip (`input` alone changes only
  // the field's own swatch; session 36).
  inp.dispatchEvent(new Event("change", { bubbles: true }));
});
j = await readJson();
check('CUSTOM COLOR #cc0000: JSON apply.color set; strip swatch and preview fill follow',
  j[2].apply.color === "#cc0000" && (await stripSwatch(0)) === "#cc0000" &&
  (await previewFill(0)) === "#cc0000");
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s2-new-rule.png"), fullPage: true });

// ── Narrow the new rule to specific durations; flip the resolved duration ──
await page.click('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-dur-pill[data-value="crotchet"]');
j = await readJson();
check("NARROW DURATIONS: clicking crotchet while \"all\" leaves [minim, semibreve, breve]",
  JSON.stringify(j[2].match.durations) === '["minim","semibreve","breve"]');
check("NARROW DURATIONS: crotchet strip reverts to Crotchet–Minim, black",
  (await stripShape(0)) === "Crotchet–Minim" && (await stripSwatch(0)) === "#000000" &&
  (await previewFill(0)) === "#000000");
await page.selectOption(".cnb-nre-resolved-duration", "minim");
check("SWITCH STRIP TO MINIM: diamond + #cc0000 apply again (rule matches minim)",
  (await stripShape(0)) === "Diamond" && (await stripSwatch(0)) === "#cc0000" &&
  (await previewFill(0)) === "#cc0000");
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s2-durations.png"), fullPage: true });

// ── Off-key mark on the new rule ────────────────────────────────────────────
await page.click('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-apply-mark-check');
j = await readJson();
check("ENABLE OFF-KEY MARK: emits the explicit false (no mark); strip cell agrees",
  j[2].apply.offKeyMark === false && (await stripMark(0)) === "false");
await page.selectOption('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-mark-mode', "mark");
j = await readJson();
check('MARK MODE: seeds identifier "cross"; strip shows "mark: cross"; preview badges on all 12 PCs',
  j[2].apply.offKeyMark === "cross" && (await stripMark(0)) === "cross" &&
  await page.evaluate(() =>
    document.querySelectorAll("#preview-host .cnb-nre-preview-mark").length === 12 &&
    document.querySelector("#preview-host .cnb-nre-preview-mark").textContent === "mark: cross"));
await page.evaluate(() => {
  const inp = document.querySelector('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-mark-input');
  inp.value = "flat-9";
  inp.dispatchEvent(new Event("input", { bubbles: true }));
});
j = await readJson();
check('EDIT MARK IDENTIFIER to "flat-9": JSON apply.offKeyMark follows', j[2].apply.offKeyMark === "flat-9");

// ── Narrow the new rule to key G; flip the resolved key context ────────────
await page.click('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-key-pill[data-value="C"]');
j = await readJson();
check('NARROW KEYS: clicking "C" while "All" leaves ["G"]',
  JSON.stringify(j[2].match.keys) === '["G"]');
check("NARROW KEYS: with (no key) context the rule stops matching — minim strip reverts",
  (await stripShape(0)) === "Crotchet–Minim" && (await stripSwatch(0)) === "#000000" &&
  (await stripMark(0)) === "false" &&
  await page.evaluate(() =>
    document.querySelectorAll("#preview-host .cnb-nre-preview-mark").length === 0));
await page.selectOption(".cnb-nre-resolved-key", "G");
check("SWITCH STRIP KEY TO G: diamond + #cc0000 + mark flat-9 apply again",
  (await stripShape(0)) === "Diamond" && (await stripSwatch(0)) === "#cc0000" &&
  (await stripMark(0)) === "flat-9" && (await previewFill(0)) === "#cc0000");
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s2-keys-mark.png"), fullPage: true });

// ── Remove the added rule ───────────────────────────────────────────────────
await page.click('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-rule-remove');
j = await readJson();
check("REMOVE RULE: back to 2 rules; minim resolution reverts to the defaults",
  (await cardCount()) === 2 && j.length === 2 &&
  (await stripShape(0)) === "Crotchet–Minim" && (await stripSwatch(0)) === "#000000");
check("REMOVE RULE: validation still Config valid",
  await page.evaluate(() => !!document.querySelector(".cnb-nre-valid")));

// ── No errors ────────────────────────────────────────────────────────────────
check("NO console or page errors across the whole flow", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
