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
 * Module 16) → colour the noteheads with a suggested set (session 37) → add notehead/staff
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
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-golden-path.mjs
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
import { useCanvasSize, useDownloads, openSection, openAdvanced, selectNotehead } from "./app-page.mjs";

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

const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

const URL_PATH = `http://localhost:${PORT}/cnb/index.html`;
// The canvas draws at Small, where the full row fits one row (design §6.1).
await useCanvasSize(page, "small");
await useDownloads(page);
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
check("ASSEMBLY: the six always-mounted module roots on one page (Modules 13–15, 17–19; the SVG importer opens with a notehead, session 27; the palette editor retired in session 37)",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-preview-display") &&
    !!document.querySelector(".cnb-config-io") &&
    !!document.querySelector(".cnb-config-export") &&
    !document.querySelector(".cnb-palette-editor") &&
    !!document.querySelector(".cnb-staff-rule-editor") &&
    !!document.querySelector(".cnb-notehead-rule-editor") &&
    !!document.querySelector(".cnb-common-props-editor")));
check("PREVIEW: full chromatic row on load — 13 cards, one caption-less duration row, 4 duration pills (crotchet on), the key picker at C major (session 36)",
  (await cardCount()) === 13 && (await captionCount()) === 0 &&
  await page.evaluate(() =>
    document.querySelectorAll(".cnb-pvd-duration-pill").length === 4 &&
    document.querySelectorAll(".cnb-pvd-duration-pill.on").length === 1 &&
    document.querySelector('.cnb-pvd-duration-pill[data-duration="crotchet"]').classList.contains("on") &&
    document.querySelector(".cnb-pvd-key-tonic").value === "C" &&
    document.querySelector(".cnb-pvd-key-mode").value === "major"),
  `cards=${await cardCount()}`);
let cfg = await fullConfig();
check("STATE PANEL: full default config exposed (4-8 pattern, one shape, shape mode)",
  JSON.stringify(cfg.staff.semitonePattern) === "[4,8]" &&
  JSON.stringify(Object.keys(cfg.shapes)) === '["crotchet-minim"]' &&
  cfg.durations.representationMode === "shape");
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-initial.png"), fullPage: true });

// ── STEP 1: import an SVG shape (set 004, Module 16) ────────────────────────
// Since session 27 the importer is the notehead panel's Import from SVG.
await selectNotehead(page, 0);
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

// ── STEP 2: colour the noteheads with a suggested set (session 37) ─────────
// The notehead panel, open on C since step 1, has the Suggested colours help.
await page.click(".cnb-nhp-suggest > summary");
await page.click('.cnb-nhp-suggest-set[data-set="dark2-3"] .cnb-nhp-suggest-apply');
cfg = await fullConfig();
const colourOf = (c, pc) => {
  let color = null;
  for (const r of c.noteheadRules.slice().sort((a, b) => a.priority - b.priority)) {
    const m = r.match;
    if ((m.pitchClasses === "all" || m.pitchClasses.includes(pc)) && m.durations === "all" && m.keys === "all" &&
        r.apply.color !== undefined) color = r.apply.color;
  }
  return color;
};
check("COLOURS: the Dark2 3-colour set reaches the notehead rules (C #1b9e77, C♯ #d95f02, D #7570b3, cycling), with no palette",
  !("palette" in cfg) &&
  JSON.stringify([0, 1, 2, 3].map(pc => colourOf(cfg, pc))) === JSON.stringify(["#1b9e77", "#d95f02", "#7570b3", "#1b9e77"]),
  JSON.stringify(cfg.noteheadRules.map(r => [r.name, r.apply.color])));
check("COLOURS: the preview re-rendered live — noteheads now carry the fill #1b9e77",
  await page.$$eval('.cnb-pvd-preview path[fill="#1b9e77"]', els => els.length > 0));
const colourRules = cfg.noteheadRules.length;
await page.screenshot({ path: path.join(SHOT_DIR, "uat-037-colours.png"), fullPage: true });

// ── STEP 3: staff rules (set 005, Module 13) ────────────────────────────────
await openSection(page, "staff");
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

// ── STEP 4: add a notehead rule (set 005, Module 14; Advanced since session 27)
await openAdvanced(page, "Rules for particular durations or keys");
await page.click(".cnb-nre-rule-add");
await page.check(`.cnb-nre-rule-card[data-rule-index="${colourRules}"] .cnb-nre-apply-shape input`);
await page.selectOption(`.cnb-nre-rule-card[data-rule-index="${colourRules}"] .cnb-nre-shape-select`, "uat-ellipse");
cfg = await fullConfig();
check(`NOTEHEAD RULE: added rule ${colourRules + 1} (match all, apply shape uat-ellipse) reaches the shared config`,
  cfg.noteheadRules.length === colourRules + 1 &&
  cfg.noteheadRules[colourRules].apply.shape === "uat-ellipse" &&
  cfg.noteheadRules[colourRules].match.pitchClasses === "all",
  JSON.stringify(cfg.noteheadRules[colourRules]));
check("NOTEHEAD RULE: the preview re-rendered live — noteheads now draw the imported ellipse path",
  await page.evaluate(() =>
    [...document.querySelectorAll(".cnb-pvd-preview path")]
      .some(p => (p.getAttribute("d") || "").startsWith("M 120 0 C 120 -55"))));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-rule.png"), fullPage: true });

// ── STEP 5: repeated heads, chosen beside the duration buttons (session 36) ─
await page.click('.canvas-card .cnb-pvd-repeat-option[data-mode="repeat"]');
cfg = await fullConfig();
check("REPEAT MODE: chosen on the canvas, it reaches the shared config and shows on; Advanced › Durations and engine has no mode control",
  cfg.durations.representationMode === "repeat" &&
  await page.evaluate(() =>
    document.querySelector('.canvas-card .cnb-pvd-repeat-option[data-mode="repeat"]').classList.contains("on") &&
    !document.querySelector("#props-editor-host .cnb-cpe-mode-option")));
// The repeated heads' overlap, beside the repeat choice (session 58).
check("OVERLAP: in repeat mode the canvas shows the Overlap field at 1/3 of a head's width; Advanced has no Multinote padding",
  await page.evaluate(() =>
    document.querySelector(".canvas-card .cnb-pvd-overlap-input").value === "33.3" &&
    !document.querySelector("#props-editor-host .cnb-cpe-multinote-padding")));
await page.fill(".canvas-card .cnb-pvd-overlap-input", "25");
await page.dispatchEvent(".canvas-card .cnb-pvd-overlap-input", "change");
cfg = await fullConfig();
check("OVERLAP: setting 25% reaches the shared config as durations.repeatOverlap 0.25, and the field shows it",
  cfg.durations.repeatOverlap === 0.25 &&
  await page.evaluate(() => document.querySelector(".canvas-card .cnb-pvd-overlap-input").value === "25"),
  `repeatOverlap ${cfg.durations.repeatOverlap}`);

// ── STEP 6: exercise the Module 19 preview controls ─────────────────────────
// The pitch range sits in Advanced since session 25 (design §9).
await openAdvanced(page, "Pitch range shown");
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
  page.click("#save-config"),
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
check("SAVE: everything configured this session is in the file (uat-ellipse shape, the rule colours, [3,6,9], repeat mode at 25% overlap, the added rule)",
  !!savedJson.shapes["uat-ellipse"] &&
  !("palette" in savedJson) && colourOf(savedJson, 0) === "#1b9e77" &&
  JSON.stringify(savedJson.staff.semitonePattern) === "[3,6,9]" &&
  savedJson.durations.representationMode === "repeat" &&
  savedJson.durations.repeatOverlap === 0.25 &&
  savedJson.noteheadRules.length === colourRules + 1);

// ── STEP 8: load the saved config back (Module 17 round trip) ───────────────
await page.setInputFiles("#open-file", savedPath);
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
cfg = await fullConfig();
check("LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file",
  JSON.stringify(cfg) === JSON.stringify(savedJson));
check("LOAD: loaded config reported valid in the IO panel",
  await page.evaluate(() => !!document.querySelector(".cnb-cio-valid")));
check(`LOAD: every editor re-seeded from the loaded config (3-6-9 selected, repeat selected at 25% overlap, ${colourRules + 1} rule cards) and the preview still shows 13 cards in the rule colours`,
  await page.evaluate((n) =>
    document.querySelector('.cnb-sre-pattern-option[data-pattern-key="3-6-9"]').classList.contains("selected") &&
    document.querySelector('.canvas-card .cnb-pvd-repeat-option[data-mode="repeat"]').classList.contains("on") &&
    document.querySelector(".canvas-card .cnb-pvd-overlap-input").value === "25" &&
    document.querySelectorAll(".cnb-nre-rule-card").length === n &&
    document.querySelectorAll('.cnb-pvd-preview path[fill="#1b9e77"]').length > 0, colourRules + 1) &&
  (await cardCount()) === 13);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-loaded.png"), fullPage: true });

// ── STEP 9: export a .ly file (Module 18, real download) ────────────────────
const [exportDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click("#export-ly"),
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
check("EXPORT: the whole session's configuration reached the .ly — imported shape registered, 3-6-9 geometry, repeat clauses, the rule colours",
  exported.includes("cnb:register-path! 'uat-ellipse") &&
  exported.includes("cnb:semitones-per-staff-space 3") &&
  /\(repeat\s+\. #t\)/.test(exported) &&
  exported.includes("#(cnb:register-color! 'shamrock-1b9e77 \"#1b9e77\")") &&
  !exported.includes("cnb:use-accessible-colors"));
check('EXPORT: status "Exported as default48.ly" with the valid badge, no error rows',
  (await page.textContent(".cnb-cex-status")).includes("Exported as default48.ly") &&
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-verror").length === 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-006-s3-exported.png"), fullPage: true });

// ── STEP 9b: the save dialog (session 36) ───────────────────────────────────
// Chromium has a save dialog, which this driver removes before the page
// loads (useDownloads) so that the steps above capture real downloads. A
// stand-in dialog now records what Save and Export ask it for and write,
// and saves under a name of the designer's choosing.
await page.evaluate(() => {
  window.__saves = [];
  window.__cancelNext = false;
  window.showSaveFilePicker = async (options) => {
    if (window.__cancelNext) {
      window.__cancelNext = false;
      throw new DOMException("The user aborted a request.", "AbortError");
    }
    const entry = { options, text: "", closed: false };
    window.__saves.push(entry);
    const ext = options.types[0].accept[Object.keys(options.types[0].accept)[0]][0];
    return {
      name: "chosen-name" + ext,
      async createWritable() {
        return { async write(t) { entry.text += t; }, async close() { entry.closed = true; } };
      },
    };
  };
});
const topbarStatus = () => page.textContent("#topbar-status");
await page.click("#save-config");
await page.waitForFunction(() => document.getElementById("topbar-status").textContent.startsWith("Saved as "));
let dialogSave = await page.evaluate(() => window.__saves[0]);
cfg = await fullConfig();
check('SAVE DIALOG: Save opens the save dialog suggesting "default-4-8-system.cnb.json" as a JSON file',
  dialogSave.options.suggestedName === "default-4-8-system.cnb.json" &&
  JSON.stringify(dialogSave.options.types[0].accept) === JSON.stringify({ "application/json": [".json"] }),
  JSON.stringify(dialogSave.options));
check("SAVE DIALOG: the file written is the saved config (deep-equal to the live state), and closed",
  dialogSave.closed && JSON.stringify(JSON.parse(dialogSave.text)) === JSON.stringify(cfg));
check('SAVE DIALOG: the top bar names the file as the designer chose it ("Saved as chosen-name.json")',
  (await topbarStatus()) === "Saved as chosen-name.json", await topbarStatus());

await page.click("#export-ly");
await page.waitForFunction(() => document.getElementById("topbar-status").textContent.startsWith("Exported as "));
dialogSave = await page.evaluate(() => window.__saves[1]);
check('SAVE DIALOG: Export opens the save dialog suggesting "default48.ly" as a .ly file',
  dialogSave.options.suggestedName === "default48.ly" &&
  JSON.stringify(dialogSave.options.types[0].accept) === JSON.stringify({ "text/plain": [".ly"] }),
  JSON.stringify(dialogSave.options));
check("SAVE DIALOG: the .ly written is byte-identical to a direct CNBLilypond.generate() call, and closed",
  dialogSave.closed && dialogSave.text === CNBLilypond.generate(cfg));
check('SAVE DIALOG: the top bar reads "Exported as chosen-name.ly"',
  (await topbarStatus()) === "Exported as chosen-name.ly", await topbarStatus());

await page.evaluate(() => { window.__cancelNext = true; });
await page.click("#save-config");
await page.waitForFunction(() => document.getElementById("topbar-status").textContent.startsWith("Not saved"));
check("SAVE DIALOG: cancelling the dialog writes nothing and the top bar says the save was cancelled",
  (await page.evaluate(() => window.__saves.length)) === 2 &&
  (await topbarStatus()) === "Not saved: the save was cancelled.", await topbarStatus());

// ── STEP 10: no errors ───────────────────────────────────────────────────────
check("NO console or page errors across the whole golden path", consoleErrors.length === 0,
  consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots + saved/exported files: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
