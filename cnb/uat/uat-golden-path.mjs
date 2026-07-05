/**
 * uat-golden-path.mjs — Playwright UAT driver for Module 19 (Preview
 * Display) and the assembled application shell, session-set 006 session 3.
 *
 * Executes the DSL-style checklist recorded in
 * docs/session-sets/006-config-io-export-and-preview/s3-uat.md against
 * cnb/index.html (the application entry point), served from the repo root
 * by a built-in static server. (The dabbler-uat-dsl compiler is still in
 * bootstrap; this driver is the checklist's executable form and can be
 * replaced by the compiled DSL output once that pipeline lands.)
 *
 * Flow (spec step 3, the full golden path): import an SVG shape (set 004,
 * Module 16) → pick a palette (set 004, Module 12) → add notehead/staff
 * rules (set 005, Modules 14/13) → adjust common properties (set 005,
 * Module 15) → preview the full chromatic row and exercise the Module 19
 * range/duration controls → save the config (Module 17, real download
 * captured) and load it back → export a .ly file (Module 18, real download
 * captured) — confirming each step's output is visible and correct before
 * moving to the next. The save and export parity checks run direct
 * CNBLilypond / CNBStaff calls in THIS Node process on the full config
 * read from the page's live state panel, so they are independent of the
 * browser.
 *
 * The Google Fonts CDN requests made by index.html (Oswald, preview-only
 * cosmetics per CLAUDE.md) are stubbed with empty responses so the run
 * asserts app behavior, not CDN availability.
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-golden-path.mjs
 *
 * Requirements — the driver errors out (exit 2) rather than guessing:
 *   - playwright-core resolvable from this file, or set CNB_UAT_PLAYWRIGHT
 *     to a directory whose node_modules contains it
 *     (e.g. a scratch dir where you ran `npm install playwright-core`).
 *   - A Chromium executable: CNB_UAT_CHROMIUM if set to a non-empty value
 *     (a non-empty-but-invalid path is an error, not a fallback — cache
 *     discovery is NOT attempted; an unset or empty variable means cache
 *     discovery); otherwise the newest chromium-* browser discovered in
 *     the platform's ms-playwright cache directory.
 *
 * Optional: CNB_UAT_PORT (default 8148), CNB_UAT_SHOTS (screenshot dir,
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
import { CNBStaff } from "../src/cnb-staff.js";
import { CNBCollection } from "../src/cnb-collection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8148);
const SHOT_DIR = process.env.CNB_UAT_SHOTS || path.join(os.tmpdir(), "cnb-uat");

// ── Dependency resolution (explicit errors, no silent fallbacks) ────────────
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

// ── Toolkit-style sample notehead SVG (same contract as the Module 16 test
//    page's built-in sample: 100 units/semitone, centered viewBox, stem
//    placemarker rects, data-semitone-height, pre-baked data-lilypond-*) ────
const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="-120 -100 240 200">
  <g id="layer1">
    <rect id="stem-down" x="-120" y="0" width="22.2222" height="350" style="fill:#00FFFF;stroke:none"/>
    <rect id="stem-up" x="97.7778" y="-350" width="22.2222" height="350" style="fill:#FF00FF;stroke:none"/>
    <path id="notehead"
          d="M 120 0 C 120 -55 66 -100 0 -100 C -66 -100 -120 -55 -120 0 C -120 55 -66 100 0 100 C 66 100 120 55 120 0 Z"
          data-semitone-height="2.0"
          data-lilypond-notehead="'(
    (moveto 1.2 0)
    (curveto 1.2 0.55 0.66 1.0 0 1.0)
    (curveto -0.66 1.0 -1.2 0.55 -1.2 0)
    (curveto -1.2 -0.55 -0.66 -1.0 0 -1.0)
    (curveto 0.66 -1.0 1.2 -0.55 1.2 0)
    (closepath))"
          style="fill:#000000;stroke:none"/>
    <path id="hollow"
          d="M 80 0 C 80 -36 44 -64 0 -64 C -44 -64 -80 -36 -80 0 C -80 36 -44 64 0 64 C 44 64 80 36 80 0 Z"
          data-lilypond-hollow="'(
    (moveto 0.8 0)
    (curveto 0.8 0.36 0.44 0.64 0 0.64)
    (curveto -0.44 0.64 -0.8 0.36 -0.8 0)
    (curveto -0.8 -0.36 -0.44 -0.64 0 -0.64)
    (curveto 0.44 -0.64 0.8 -0.36 0.8 0)
    (closepath))"
          style="fill:#FFFFFF;stroke:none"/>
  </g>
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
await page.goto(URL_PATH);
await page.waitForSelector(".cnb-preview-display");

const fullConfig = async () => JSON.parse(await page.textContent("#state-json"));
const cardCount = async () => page.$$eval(".cnb-pvd-preview .pc-col", els => els.length);
const captionCount = async () => page.$$eval(".cnb-pvd-preview .cnb-duration-caption", els => els.length);
const staffLineCount = async () =>
  page.$$eval(".cnb-pvd-preview .staff-lines-bg line", els => els.length);

// ── STEP 0: initial assembly ────────────────────────────────────────────────
check('PAGE title is "Chromatic Notation Configurator"',
  (await page.title()) === "Chromatic Notation Configurator", await page.title());
check("ASSEMBLY: all eight module roots mounted (Modules 12–19 on one page)",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-preview-display") &&
    !!document.querySelector(".cnb-config-io") &&
    !!document.querySelector(".cnb-config-export") &&
    !!document.querySelector(".cnb-svg-drop-zone") &&
    !!document.querySelector(".cnb-palette-editor") &&
    !!document.querySelector(".cnb-staff-rule-editor") &&
    !!document.querySelector(".cnb-notehead-rule-editor") &&
    !!document.querySelector(".cnb-common-props-editor")));
check("PREVIEW: full chromatic row on load — 13 cards, one caption-less duration row, 4 duration pills (crotchet on), no key control (keys disabled)",
  (await cardCount()) === 13 && (await captionCount()) === 0 &&
  await page.evaluate(() =>
    document.querySelectorAll(".cnb-pvd-duration-pill").length === 4 &&
    document.querySelectorAll(".cnb-pvd-duration-pill.on").length === 1 &&
    document.querySelector('.cnb-pvd-duration-pill[data-duration="crotchet"]').classList.contains("on") &&
    !document.querySelector(".cnb-pvd-key")),
  `cards=${await cardCount()}`);
let cfg = await fullConfig();
check("STATE PANEL: full default config exposed (4-8 pattern, one shape, shape mode)",
  JSON.stringify(cfg.staff.semitonePattern) === "[4,8]" &&
  JSON.stringify(Object.keys(cfg.shapes)) === '["crotchet-minim"]' &&
  cfg.durations.representationMode === "shape");
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-initial.png"), fullPage: true });

// ── STEP 1: import an SVG shape (set 004, Module 16) ────────────────────────
await page.setInputFiles('#svg-importer-host input[type="file"]', {
  name: "uat-ellipse.svg", mimeType: "image/svg+xml",
  buffer: Buffer.from(SAMPLE_SVG, "utf8"),
});
await page.waitForFunction(() =>
  document.getElementById("import-status").textContent.includes("uat-ellipse"));
check('IMPORT: status confirms \'Imported shape "uat-ellipse"\' with no warnings (pre-baked data-lilypond-* present)',
  (await page.textContent("#import-status")).includes('Imported shape "uat-ellipse"') &&
  await page.$$eval("#import-warnings li", els => els.length === 0),
  await page.textContent("#import-status"));
cfg = await fullConfig();
check("IMPORT: shape entry reaches the shared config — semitoneHeight 2, pre-baked LilyPond paths, stem-rect anchors (bottom-center of stem-up rect)",
  !!cfg.shapes["uat-ellipse"] &&
  cfg.shapes["uat-ellipse"].semitoneHeight === 2 &&
  typeof cfg.shapes["uat-ellipse"].lilypondPath === "string" &&
  typeof cfg.shapes["uat-ellipse"].lilypondHollowPath === "string" &&
  cfg.shapes["uat-ellipse"].anchors.crotchetUp.x === 108.8889 &&
  cfg.shapes["uat-ellipse"].anchors.crotchetUp.y === 0,
  JSON.stringify(cfg.shapes["uat-ellipse"] && cfg.shapes["uat-ellipse"].anchors));
check("IMPORT: the notehead rule editor re-seeded — its shape selects now offer the imported shape",
  await page.evaluate(() =>
    [...document.querySelectorAll(".cnb-nre-shape-select option")]
      .some(o => o.value === "uat-ellipse")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-imported.png"), fullPage: true });

// ── STEP 2: pick a palette (set 004, Module 12) ─────────────────────────────
await page.click('.cnb-pal-option[data-preset-key="dark2-3"]');
cfg = await fullConfig();
check("PALETTE: Dark2 3-color preset reaches the shared config (12 per-PC colors, first #1b9e77, scheme symbols)",
  cfg.palette.colors.length === 12 &&
  cfg.palette.colors[0].hex.toLowerCase() === "#1b9e77" &&
  Object.keys(cfg.palette.schemeSymbols || {}).length > 0,
  JSON.stringify({ n: cfg.palette.colors.length, first: cfg.palette.colors[0] }));
check("PALETTE: the preview re-rendered live — noteheads now carry the palette fill #1b9e77",
  await page.$$eval('.cnb-pvd-preview path[fill="#1b9e77"]', els => els.length > 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-palette.png"), fullPage: true });

// ── STEP 3: staff rules (set 005, Module 13) ────────────────────────────────
await page.click('.cnb-sre-pattern-option[data-pattern-key="3-6-9"]');
cfg = await fullConfig();
check("STAFF RULES: 3-6-9 system reaches the shared config (pattern [3,6,9], sps 3)",
  JSON.stringify(cfg.staff.semitonePattern) === "[3,6,9]" &&
  cfg.staff.semitonesPerStaffSpace === 3,
  JSON.stringify(cfg.staff.semitonePattern));
// Independent Node-side computation of the expected staff line count for
// the preview's grid range (full row 0–12 → semis −4..28).
const expectedLines = CNBStaff.getPositions(cfg, CNBCollection.gridRange(
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).length;
check(`STAFF RULES: preview background staff re-rendered — ${expectedLines} lines (Node-side CNBStaff.getPositions on the same config)`,
  (await staffLineCount()) === expectedLines,
  `dom=${await staffLineCount()} expected=${expectedLines}`);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-staff.png"), fullPage: true });

// ── STEP 4: add a notehead rule (set 005, Module 14) ────────────────────────
await page.click(".cnb-nre-rule-add");
await page.check('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-apply-shape input');
await page.selectOption('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-shape-select', "uat-ellipse");
cfg = await fullConfig();
check("NOTEHEAD RULE: added rule 3 (match all, apply shape uat-ellipse) reaches the shared config",
  cfg.noteheadRules.length === 3 &&
  cfg.noteheadRules[2].apply.shape === "uat-ellipse" &&
  cfg.noteheadRules[2].match.pitchClasses === "all",
  JSON.stringify(cfg.noteheadRules[2]));
check("NOTEHEAD RULE: the preview re-rendered live — noteheads now draw the imported ellipse path",
  await page.evaluate(() =>
    [...document.querySelectorAll(".cnb-pvd-preview path")]
      .some(p => (p.getAttribute("d") || "").startsWith("M 120 0 C 120 -55"))));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-rule.png"), fullPage: true });

// ── STEP 5: common properties (set 005, Module 15) ──────────────────────────
await page.click('.cnb-cpe-mode-option[data-mode="repeat"]');
cfg = await fullConfig();
check("COMMON PROPS: repeat representation mode reaches the shared config and shows selected",
  cfg.durations.representationMode === "repeat" &&
  await page.evaluate(() =>
    document.querySelector('.cnb-cpe-mode-option[data-mode="repeat"]').classList.contains("selected")));

// ── STEP 6: exercise the Module 19 preview controls ─────────────────────────
await page.selectOption(".cnb-pvd-from", "4");
await page.selectOption(".cnb-pvd-to", "8");
check("PREVIEW CONTROLS: narrowing the pitch range to 4–8 renders 5 cards",
  (await cardCount()) === 5, `cards=${await cardCount()}`);
await page.click('.cnb-pvd-duration-pill[data-duration="minim"]');
check("PREVIEW CONTROLS: toggling minim on renders two captioned duration rows (10 cards)",
  (await cardCount()) === 10 && (await captionCount()) === 2,
  `cards=${await cardCount()} captions=${await captionCount()}`);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-preview-controls.png"), fullPage: true });
await page.click('.cnb-pvd-duration-pill[data-duration="crotchet"]');
await page.click('.cnb-pvd-duration-pill[data-duration="minim"]');
check("PREVIEW CONTROLS: deselecting every duration shows the explicit empty message, no collection",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-pvd-empty") &&
    !document.querySelector(".cnb-pvd-preview")));
await page.click('.cnb-pvd-duration-pill[data-duration="crotchet"]');
await page.selectOption(".cnb-pvd-from", "0");
await page.selectOption(".cnb-pvd-to", "12");
check("PREVIEW CONTROLS: restoring range 0–12 + crotchet renders the full chromatic row again",
  (await cardCount()) === 13 && (await captionCount()) === 0,
  `cards=${await cardCount()}`);

// ── STEP 7: save the config (Module 17, real download) ──────────────────────
const [saveDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click(".cnb-cio-save"),
]);
check('SAVE: download suggested filename is "default-4-8-system.cnb.json" (derived from meta.configName)',
  saveDownload.suggestedFilename() === "default-4-8-system.cnb.json",
  saveDownload.suggestedFilename());
const savedPath = path.join(SHOT_DIR, "uat-006-s3-saved.cnb.json");
await saveDownload.saveAs(savedPath);
const savedJson = JSON.parse(await readFile(savedPath, "utf8"));
cfg = await fullConfig();
check("SAVE: timestamps stamped per plan §4.11 — meta.created and meta.modified are ISO strings in the file",
  Number.isFinite(Date.parse(savedJson.meta.created)) &&
  Number.isFinite(Date.parse(savedJson.meta.modified)));
check("SAVE: the shell ADOPTED the stamped config — the live state panel is deep-equal to the downloaded file",
  JSON.stringify(cfg) === JSON.stringify(savedJson),
  `panel ${JSON.stringify(cfg.meta)} vs file ${JSON.stringify(savedJson.meta)}`);
check("SAVE: everything configured this session is in the file (uat-ellipse shape, 12 palette colors, [3,6,9], repeat mode, 3 rules)",
  !!savedJson.shapes["uat-ellipse"] &&
  savedJson.palette.colors.length === 12 &&
  JSON.stringify(savedJson.staff.semitonePattern) === "[3,6,9]" &&
  savedJson.durations.representationMode === "repeat" &&
  savedJson.noteheadRules.length === 3);

// ── STEP 8: load the saved config back (Module 17 round trip) ───────────────
await page.setInputFiles(".cnb-cio-file", savedPath);
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
cfg = await fullConfig();
check("LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file",
  JSON.stringify(cfg) === JSON.stringify(savedJson));
check("LOAD: loaded config reported valid in the IO panel",
  await page.evaluate(() => !!document.querySelector(".cnb-cio-valid")));
check("LOAD: every editor re-seeded from the loaded config (3-6-9 selected, Dark2-3 selected, repeat selected, 3 rule cards) and the preview still shows 13 cards",
  await page.evaluate(() =>
    document.querySelector('.cnb-sre-pattern-option[data-pattern-key="3-6-9"]').classList.contains("selected") &&
    document.querySelector('.cnb-pal-option[data-preset-key="dark2-3"]').classList.contains("selected") &&
    document.querySelector('.cnb-cpe-mode-option[data-mode="repeat"]').classList.contains("selected") &&
    document.querySelectorAll(".cnb-nre-rule-card").length === 3) &&
  (await cardCount()) === 13);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-loaded.png"), fullPage: true });

// ── STEP 9: export a .ly file (Module 18, real download) ────────────────────
const [exportDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click(".cnb-cex-export"),
]);
check('EXPORT: download suggested filename is "default48.ly" (from meta.fileSuffix)',
  exportDownload.suggestedFilename() === "default48.ly",
  exportDownload.suggestedFilename());
const exportedPath = path.join(SHOT_DIR, "uat-006-s3-exported.ly");
await exportDownload.saveAs(exportedPath);
const exported = await readFile(exportedPath, "utf8");
cfg = await fullConfig();
let direct = null, directErr = null;
try { direct = CNBLilypond.generate(cfg); } catch (err) { directErr = err.message; }
check("EXPORT PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)",
  direct !== null && direct === exported,
  directErr || `lengths ${exported.length} vs ${direct ? direct.length : "n/a"}`);
check("EXPORT: the whole session's configuration reached the .ly — imported shape registered, 3-6-9 geometry, repeat clauses, palette colors",
  exported.includes("cnb:register-path! 'uat-ellipse") &&
  exported.includes("cnb:semitones-per-staff-space 3") &&
  /\(repeat\s+\. #t\)/.test(exported) &&
  exported.includes("shamrock-1b9e77"));
check('EXPORT: status "Exported as default48.ly" with the valid badge, no error rows',
  (await page.textContent(".cnb-cex-status")).includes("Exported as default48.ly") &&
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-verror").length === 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-exported.png"), fullPage: true });

// ── STEP 10: no errors ───────────────────────────────────────────────────────
check("NO console or page errors across the whole golden path", consoleErrors.length === 0,
  consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots + saved/exported files: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
