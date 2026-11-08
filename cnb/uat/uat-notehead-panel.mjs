/**
 * uat-notehead-panel.mjs — Playwright UAT driver for the notehead panel
 * (session 27, design docs/planning/notehead-first-editor-design.md §2, §5).
 *
 * Builds the Kite 4-369 looks by clicking noteheads, and checks the export
 * equals the fixture's baseline byte for byte. It opens cnb/index.html with
 * the Kite 4-369 fixture stripped of its looks: the notehead rules reduced
 * to the Default (kite down, solid) and the palette's colours and
 * colour-blind twins cleared. The staff, ledgers, shapes, the palette's name
 * and Scheme symbols, and meta are kept. Then, on the canvas and in the
 * notehead panel:
 *
 *   1. C♯ → kite up, and Give this look to › Every 4th (shape only):
 *      C♯, F, A. D, Shift-click F♯ and A♯ → kite up.
 *   2. C♯ → Hollow, and Every other (fill only): the odd semitones.
 *   3. C, C♯ and D → sky-blue, rose and black through the colour input,
 *      each given to Every 3rd (colour only).
 *
 * Along the way it checks the selection marks, that the colour input's
 * element survives an `input` event (session 21's wiring), the rule list's
 * words and its hover tint, and that the downloaded .ly equals
 * cnb/fixtures/kite-4-369-export-baseline.ly (the date line normalised).
 *
 * Requirements, as the other drivers (uat-app-layout.mjs): playwright-core
 * plus a Chromium from the ms-playwright cache or CNB_UAT_CHROMIUM
 * (exit 2 = missing dependency, 1 = check failure, 0 = all passed).
 * Optional: CNB_UAT_PORT (default 8162), CNB_UAT_SHOTS (screenshot dir,
 * default <os tmpdir>/cnb-uat).
 *
 * Usage: node cnb/uat/uat-notehead-panel.mjs
 */
import http from "http";
import os from "os";
import { readFile, mkdir } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { openSection, selectNotehead, useDownloads } from "./app-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const FIXTURES = path.join(ROOT, "cnb", "fixtures");
const PORT = Number(process.env.CNB_UAT_PORT || 8162);
const SHOT_DIR = process.env.CNB_UAT_SHOTS || path.join(os.tmpdir(), "cnb-uat");

// ── Dependency resolution (same contract as uat-kite-pipeline.mjs) ──────────
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

// ── Static server over the repo root ────────────────────────────────────────
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
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
await mkdir(SHOT_DIR, { recursive: true });

const results = [];
let failCount = 0;
function check(label, cond, detail = "") {
  const ok = !!cond;
  if (!ok) failCount++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? "  [" + detail + "]" : ""}`);
}

// ── The Kite fixture without its looks ──────────────────────────────────────
const kite = JSON.parse(await readFile(path.join(FIXTURES, "kite-4-369-config.json"), "utf8"));
const blank = JSON.parse(JSON.stringify(kite));
blank.noteheadRules = [kite.noteheadRules[0]];          // Default: kite down, solid
blank.palette.colors = [];
blank.palette.cbSafeColors = [];
const baseline = await readFile(path.join(FIXTURES, "kite-4-369-export-baseline.ly"), "utf8");
const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date: <NORMALIZED>");

const browser = await chromium.launch({ executablePath: EXE });
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));
await useDownloads(page);
await page.goto(`http://localhost:${PORT}/cnb/index.html`);
await page.waitForSelector(".cnb-pvd-preview .pc-col");

await page.setInputFiles("#open-file", {
  name: "kite-without-looks.json", mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(blank)),
});
await page.waitForFunction(() =>
  JSON.parse(document.getElementById("state-json").textContent).shapes["kite-up"] !== undefined);

const state = async () => JSON.parse(await page.textContent("#state-json"));
const ruleWords = () => page.$$eval(".cnb-nhp-rule-words", els => els.map(e => e.textContent));
const marked = (cls) => page.$$eval(`.cnb-pvd-preview .pc-col.${cls}`, els => els.map(e => Number(e.dataset.pc)));

await openSection(page, "noteheads");
check("START: the rule list shows one look everywhere",
  JSON.stringify(await ruleWords()) === JSON.stringify(
    ["Shape: kite down everywhere", "Fill: solid everywhere", "Size: each shape at its own size",
      "Side step: none everywhere", "Colour: none everywhere"]),
  JSON.stringify(await ruleWords()));

/** Give this look to, copying only the named part. */
async function give(kind, part) {
  for (const p of ["colour", "fill", "shape", "size"]) {
    const box = `.cnb-nhp-give-parts input[data-part="${p}"]`;
    if (p === part) await page.check(box);
    else await page.uncheck(box);
  }
  await page.click(`.cnb-nhp-give-option[data-give="${kind}"]`);
}

/** Set the selection's colour through the colour input: input, then change. */
async function pickColour(hex) {
  await page.evaluate((value) => {
    const input = document.querySelector(".cnb-nhp-color-input");
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, hex);
}

// ── 1. Shape: kite up every 4 semitones from C♯ and D ───────────────────────
await selectNotehead(page, 1);
check("SELECT: a click opens the notehead panel for C♯, with the rule list still under it",
  (await page.textContent(".cnb-nhp-title")) === "C♯" &&
  await page.isVisible("#notehead-panel-card") &&
  await page.isVisible('[data-panel="noteheads"]'));
check("SELECT: C♯'s column is outlined", JSON.stringify(await marked("cnb-pvd-selected")) === "[1]",
  JSON.stringify(await marked("cnb-pvd-selected")));
await page.click('.cnb-nhp-shape-option[data-shape="kite-up"]');
await give("every-4", "shape");
await selectNotehead(page, 2);
await selectNotehead(page, 6, { add: true });
await selectNotehead(page, 10, { add: true });
check("SHIFT-CLICK: D, F♯ and A♯ are selected together",
  (await page.textContent(".cnb-nhp-title")) === "D, F♯ and A♯ (3 noteheads)" &&
  JSON.stringify(await marked("cnb-pvd-selected")) === "[2,6,10]",
  await page.textContent(".cnb-nhp-title"));
await page.click('.cnb-nhp-shape-option[data-shape="kite-up"]');
let cfg = await state();
check("SHAPE: kite up on C♯, D, F, F♯, A, A♯ as one inferred rule",
  cfg.noteheadRules.some(r => r.apply.shape === "kite-up" &&
    JSON.stringify(r.match.pitchClasses) === "[1,2,5,6,9,10]"),
  JSON.stringify(cfg.noteheadRules.map(r => [r.name, r.match.pitchClasses])));

// ── 2. Fill: hollow every other semitone from C♯ ────────────────────────────
await selectNotehead(page, 1);
await page.click('.cnb-nhp-fill-option[data-fill="hollow"]');
await give("every-2", "fill");

// ── 3. Colour: sky-blue, rose and black every 3 semitones ───────────────────
await selectNotehead(page, 0);
await page.evaluate(() => { window.__colourInput = document.querySelector(".cnb-nhp-color-input"); });
await page.evaluate(() => {
  const input = document.querySelector(".cnb-nhp-color-input");
  input.value = "#50b4e9";
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
check("COLOUR: a drag step (input) keeps the colour input's element (the picker stays open) and tints the close-up only; the canvas and the config wait (session 36)",
  await page.evaluate(() => window.__colourInput === document.querySelector(".cnb-nhp-color-input") &&
    window.__colourInput.isConnected) &&
  await page.$$eval('.cnb-nhp-closeup path[fill="#50b4e9"]', els => els.length > 0) &&
  await page.$$eval('.cnb-pvd-preview .pc-col[data-pc="0"] path[fill="#50b4e9"]', els => els.length === 0) &&
  (await state()).palette.colors.every(c => c.hex.toLowerCase() !== "#50b4e9"));
await pickColour("#50b4e9");
await give("every-3", "colour");
await selectNotehead(page, 1);
await pickColour("#cc79a7");
await give("every-3", "colour");
await selectNotehead(page, 2);
await pickColour("#000000");
await give("every-3", "colour");
await page.screenshot({ path: path.join(SHOT_DIR, "notehead-panel-kite.png"), fullPage: true });

cfg = await state();
check("PALETTE: the twelve colours equal the fixture's",
  cfg.palette.colors.length === 12 &&
  kite.palette.colors.every(c => cfg.palette.colors.find(e => e.pc === c.pc)?.hex.toLowerCase() === c.hex.toLowerCase()),
  JSON.stringify(cfg.palette.colors.map(c => c.hex)));
check("RULES: no colour is written as a rule", cfg.noteheadRules.every(r => r.apply.color === undefined));

// ── The rule list and its hover tint ────────────────────────────────────────
await page.keyboard.press("Escape");
await openSection(page, "noteheads");
const words = await ruleWords();
check("RULE LIST: the Kite rules in words",
  words[0] === "Shape: kite down, with kite up every 4 semitones from C♯ and D" &&
  words[1] === "Fill: solid, with hollow every 2 semitones from C♯" &&
  words[2] === "Size: each shape at its own size" &&
  words[3] === "Side step: none everywhere" &&
  words[4].startsWith("Colour: every 3 semitones, "),
  JSON.stringify(words));
await page.hover(".cnb-nhp-rule >> nth=0");
check("RULE LIST: hovering the shape line tints the six kite-up columns",
  JSON.stringify(await marked("cnb-pvd-tint")) === "[1,2,5,6,9,10]",
  JSON.stringify(await marked("cnb-pvd-tint")));
await page.mouse.move(0, 0);
check("RULE LIST: leaving the line clears the tint", (await marked("cnb-pvd-tint")).length === 0);

// ── The export equals the fixture's ─────────────────────────────────────────
const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-ly")]);
const exported = await readFile(await download.path(), "utf8");
check("EXPORT: the .ly built by clicking equals kite-4-369-export-baseline.ly byte for byte (date normalised)",
  normalize(exported) === normalize(baseline),
  `lengths ${exported.length} vs ${baseline.length}`);

check("NO console or page errors", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();
for (const line of results) console.log(line);
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots: ${SHOT_DIR}`);
process.exit(failCount ? 1 : 0);
