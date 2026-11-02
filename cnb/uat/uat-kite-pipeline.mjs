/**
 * uat-kite-pipeline.mjs — Session-set 007 session 1: UI half of the
 * end-to-end pipeline round-trip.
 *
 * Drives the assembled application (cnb/index.html) through the golden
 * path for the Kite 4-369 baseline-reproduction fixture, in two phases.
 *
 * PHASE A — author the system through the set-004/005 editors, from the
 * default config (proving the spec's "design a notation system ... using
 * the assembled UI" step, not just config loading):
 *   A1. Import kite-down.svg and kite-up.svg (toolkit format, pre-baked
 *       data-lilypond-* and stem placemarker rects) via Module 16.
 *   A2. Select the 3-6-9 staff pattern via Module 13.
 *   A3. Select repeat representation mode via Module 15.
 *   A4. Author the custom CB-safe 3-color palette (skyblue/rose/black,
 *       per-PC cycling pool) via Module 12.
 *   A5. Author the three Kite rules via Module 14 (default → kite-down;
 *       hollow on odd PCs; kite-up on PCs 1,2,5,6,9,10).
 *   A6. Export via Module 18 and compare against the fixture-driven
 *       export: identical staff geometry, whitespace-normalized-identical
 *       path definitions, identical Section C (shape, hollow, attachment,
 *       color hex) mapping for all 12 PCs — with the remaining known,
 *       documented import-pipeline divergences pinned literally (one-pair
 *       minim anchors D6, no engine-settings/meta editors). The session-1
 *       anchor unit bug D5 is FIXED in session 2: lilypondAnchors are
 *       canonically semitone units and the exporter converts to
 *       staff-space units (÷ sps) at export time.
 *
 * PHASE B — load the complete fixture (the release-gate artifact path):
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
 * The captured Phase B download is written to
 * <shots>/kite-4-369-ui-export.ly so the render/diff step can consume the
 * UI-exported artifact directly; the Phase A authored export is written to
 * <shots>/kite-4-369-ui-authored.ly.
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
const fixtureJson = JSON.parse(await readFile(FIXTURE, "utf8"));
const fixtureExport = CNBLilypond.generate(fixtureJson);
const norm = (s) => s.replace(/\s+/g, " ").trim();

// Section C extraction: pc → { shape, hollow, attach, colorHex-or-symbol }.
// Color symbols carry the hex as a suffix (toSchemeSymbol), so mapping
// equality is judged on the hex suffix (naming prefix differs between the
// fixture's stored schemeSymbols and nearestColorName on a custom palette).
function sectionCMap(ly) {
  const map = {};
  const clauseRe = /\(\(?= pc (\d+)\)[\s\S]*?\(shape\s+\.\s+([\w-]+)\)[\s\S]*?\(color\s+\.\s+([\w-]+)\)[\s\S]*?\(hollow\s+\.\s+([\w#f-]+)\)[\s\S]*?\(attachment\s+\.\s+([\w#f-]+)\)/g;
  let m;
  while ((m = clauseRe.exec(ly)) !== null) {
    const colorSym = m[3];
    const hexMatch = colorSym.match(/([0-9a-f]{6})$/);
    map[Number(m[1])] = {
      shape: m[2],
      colorHex: hexMatch ? hexMatch[1] : colorSym,
      hollow: m[4],
      attach: m[5],
    };
  }
  return map;
}

// ═════════════════════ PHASE A — author the system in the UI ═══════════════

// ── A1: import the two kite shapes (Module 16, toolkit SVG contract) ────────
for (const name of ["kite-down", "kite-up"]) {
  await page.setInputFiles('#svg-importer-host input[type="file"]', {
    name: `${name}.svg`, mimeType: "image/svg+xml",
    buffer: await readFile(path.join(ROOT, "cnb", "fixtures", `${name}.svg`)),
  });
  await page.waitForFunction((n) =>
    document.getElementById("import-status").textContent.includes(`"${n}"`), name);
}
let cfg = await fullConfig();
check("AUTHOR/import: both kite shapes reach the shared config with pre-baked LilyPond paths (whitespace-normalized-identical to the fixture's) and semitoneHeight 4",
  !!cfg.shapes["kite-up"] && !!cfg.shapes["kite-down"] &&
  cfg.shapes["kite-up"].semitoneHeight === 4 &&
  norm(cfg.shapes["kite-up"].lilypondPath) === norm(fixtureJson.shapes["kite-up"].lilypondPath) &&
  norm(cfg.shapes["kite-down"].lilypondPath) === norm(fixtureJson.shapes["kite-down"].lilypondPath) &&
  norm(cfg.shapes["kite-up"].lilypondHollowPath) === norm(fixtureJson.shapes["kite-up"].lilypondHollowPath) &&
  norm(cfg.shapes["kite-down"].lilypondHollowPath) === norm(fixtureJson.shapes["kite-down"].lilypondHollowPath),
  JSON.stringify(Object.keys(cfg.shapes)));
check("AUTHOR/import: stem placemarker rects produce native crotchet anchors (0, -270)/(0, 270) — bottom-center of stem-up, top-center of stem-down",
  cfg.shapes["kite-up"].anchors.crotchetUp.x === 0 &&
  cfg.shapes["kite-up"].anchors.crotchetUp.y === -270 &&
  cfg.shapes["kite-up"].anchors.crotchetDown.y === 270,
  JSON.stringify(cfg.shapes["kite-up"].anchors));
// D6 pin (documented importer contract, module header: "One up/down pair,
// so crotchet and minim anchors are identical at import time"): the fixture
// carries the engine reference's distinct minim offsets; import cannot.
// (Fixture values are semitone units per the D5 fix: ∓1.095 semitones =
// the reference's ∓0.365 staff-spaces at sps 3.)
check("AUTHOR/import PIN(D6): imported minim anchors equal crotchet anchors (one-pair toolkit contract), while the fixture carries the reference's distinct minim x-offsets -1.095/1.095 semitones",
  cfg.shapes["kite-up"].anchors.minimUp.x === cfg.shapes["kite-up"].anchors.crotchetUp.x &&
  fixtureJson.shapes["kite-up"].lilypondAnchors.minimUp.x === -1.095 &&
  fixtureJson.shapes["kite-up"].lilypondAnchors.minimDown.x === 1.095);
// D5 FIXED (session 2): lilypondAnchors are canonically SEMITONE units —
// 270 native SVG units ÷ 100 units-per-semitone = 2.7 — and the imported
// shape now agrees with the fixture exactly. The staff-space conversion
// (÷ sps → 0.9) happens in the exporter at export time (asserted on the
// authored export below).
check("AUTHOR/import (D5 fixed): imported lilypondAnchors agree with the fixture — crotchetUp y = 2.7 semitone units on both",
  cfg.shapes["kite-up"].lilypondAnchors.crotchetUp.y === 2.7 &&
  fixtureJson.shapes["kite-up"].lilypondAnchors.crotchetUp.y === 2.7,
  JSON.stringify(cfg.shapes["kite-up"].lilypondAnchors));

// ── A2: staff pattern 3-6-9 (Module 13) ─────────────────────────────────────
await page.click('.cnb-sre-pattern-option[data-pattern-key="3-6-9"]');
// ── A3: repeat representation mode (Module 15) ──────────────────────────────
await page.click('.cnb-cpe-mode-option[data-mode="repeat"]');
cfg = await fullConfig();
check("AUTHOR/staff+mode: 3-6-9 (pattern [3,6,9], sps 3, midpoint 12) and repeat mode reach the shared config",
  JSON.stringify(cfg.staff.semitonePattern) === "[3,6,9]" &&
  cfg.staff.semitonesPerStaffSpace === 3 &&
  cfg.staff.midpoint === 12 &&
  cfg.durations.representationMode === "repeat");

// ── A4: custom CB-safe palette, 3-color cycling pool (Module 12) ────────────
await page.click(".cnb-pal-tab:has-text('Colorblind-safe')");
await page.click(".cnb-pal-custom-select");
// Normalize the custom pool to exactly 3 cells, then set the Kite colors.
await page.evaluate(() => {
  const cells = () => document.querySelectorAll(".cnb-pal-custom-cell").length;
  while (cells() > 3) document.querySelector(".cnb-pal-custom-remove").click();
  while (cells() < 3) document.querySelector(".cnb-pal-custom-add").click();
});
const KITE_POOL = ["#50b4e9", "#cc79a7", "#000000"];
for (let i = 0; i < 3; i++) {
  await page.evaluate(([idx, hex]) => {
    const input = document.querySelectorAll(".cnb-pal-custom-input")[idx];
    input.value = hex;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [i, KITE_POOL[i]]);
}
cfg = await fullConfig();
check("AUTHOR/palette: custom CB-safe pool cycles per-PC exactly like the fixture — all 12 primary hexes match, and cbSafeColors is the identity mapping",
  cfg.palette.colors.length === 12 &&
  cfg.palette.colors.every((c, pc) =>
    c.hex.toLowerCase() === fixtureJson.palette.colors[pc].hex.toLowerCase()) &&
  cfg.palette.cbSafeColors.every((c, pc) => c.hex === cfg.palette.colors[pc].hex),
  JSON.stringify((cfg.palette.colors || []).slice(0, 4)));

// ── A5: the three Kite rules (Module 14) ────────────────────────────────────
// Rule 0 (Default): point its shape at kite-down.
await page.selectOption('.cnb-nre-rule-card[data-rule-index="0"] .cnb-nre-shape-select', "kite-down");
// Rule 1 ("Sharps are hollow", [1,3,6,8,10]) → odd semitones [1,3,5,7,9,11]:
for (const pc of [6, 8, 10, 5, 7, 9, 11]) {
  await page.click(`.cnb-nre-rule-card[data-rule-index="1"] .cnb-nre-pc-pill[data-value="${pc}"]`);
}
// Rule 2 (new): kite-up on PCs 1,2,5,6,9,10 (mod-4 = 1|2 cycle).
await page.click(".cnb-nre-rule-add");
await page.check('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-apply-shape input');
await page.selectOption('.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-shape-select', "kite-up");
for (const pc of [0, 3, 4, 7, 8, 11]) {
  await page.click(`.cnb-nre-rule-card[data-rule-index="2"] .cnb-nre-pc-pill[data-value="${pc}"]`);
}
cfg = await fullConfig();
check("AUTHOR/rules: 3 rules in the shared config with the Kite match sets (hollow [1,3,5,7,9,11]; kite-up [1,2,5,6,9,10])",
  cfg.noteheadRules.length === 3 &&
  JSON.stringify(cfg.noteheadRules[1].match.pitchClasses) === "[1,3,5,7,9,11]" &&
  JSON.stringify(cfg.noteheadRules[2].match.pitchClasses) === "[1,2,5,6,9,10]" &&
  cfg.noteheadRules[2].apply.shape === "kite-up",
  JSON.stringify(cfg.noteheadRules.map(r => ({ m: r.match.pitchClasses, a: r.apply }))));
// Strongest equivalence check: resolve all 12 PCs through Module A on BOTH
// configs in this Node process — shape and hollow must match the fixture's.
{
  const { CNBConfig } = await import("../src/cnb-config.js");
  let allMatch = true;
  const detail = [];
  for (let pc = 0; pc < 12; pc++) {
    const a = CNBConfig.resolveNotehead(cfg, pc, "crotchet", null);
    const f = CNBConfig.resolveNotehead(fixtureJson, pc, "crotchet", null);
    if (a.shape !== f.shape || a.hollow !== f.hollow) {
      allMatch = false;
      detail.push(`pc${pc}: ${a.shape}/${a.hollow} vs ${f.shape}/${f.hollow}`);
    }
  }
  check("AUTHOR/rules: CNBConfig.resolveNotehead on the authored config matches the fixture for all 12 PCs (shape + hollow)",
    allMatch, detail.join("; "));
}
check("AUTHOR: engine.falseHollow remains at its default (false) — no engine-settings editor exists in the as-built UI (set-005 verified CPE scope: durations + representation mode); the fixture supplies it for the release-gate artifact",
  cfg.engine.falseHollow === false && fixtureJson.engine.falseHollow === true);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-007-s1-authored.png"), fullPage: true });

// ── A6: export the AUTHORED system and compare with the fixture export ──────
const [authoredDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click(".cnb-cex-export"),
]);
const authoredPath = path.join(SHOT_DIR, "kite-4-369-ui-authored.ly");
await authoredDownload.saveAs(authoredPath);
const authored = await readFile(authoredPath, "utf8");

check("AUTHOR/export: staff geometry identical to the fixture export — sps 3 and the engine-reference half-staff-space positions '(-6 -4 -2 2 4 6) (D2 fixed), plus cnb:use-procedure-model #t (D1 fixed) in both",
  authored.includes("#(set! cnb:semitones-per-staff-space 3)") &&
  authored.includes("#(set! cnb:staff-line-positions '(-6 -4 -2 2 4 6))") &&
  fixtureExport.includes("#(set! cnb:staff-line-positions '(-6 -4 -2 2 4 6))") &&
  authored.includes("#(set! cnb:use-procedure-model #t)") &&
  fixtureExport.includes("#(set! cnb:use-procedure-model #t)"));
{
  const pathDef = (ly, sym) => {
    const m = ly.match(new RegExp(`#\\(define cnb:${sym} '\\([\\s\\S]*?\\)\\)\\)`));
    return m ? norm(m[0]) : `MISSING ${sym}`;
  };
  const symsEqual = ["kite-up-path", "kite-up-cutout-path", "kite-down-path", "kite-down-cutout-path"]
    .every(sym => pathDef(authored, sym) === pathDef(fixtureExport, sym));
  check("AUTHOR/export: all four Section A path definitions are whitespace-normalized-identical to the fixture export's",
    symsEqual);
}
{
  const am = sectionCMap(authored);
  const fm = sectionCMap(fixtureExport);
  let same = Object.keys(fm).length === 12 && Object.keys(am).length === 12;
  const detail = [];
  for (let pc = 0; pc < 12 && same !== false; pc++) {
    const a = am[pc], f = fm[pc];
    if (!a || !f || a.shape !== f.shape || a.hollow !== f.hollow ||
        a.attach !== f.attach || a.colorHex !== f.colorHex) {
      same = false;
      detail.push(`pc${pc}: ${JSON.stringify(a)} vs ${JSON.stringify(f)}`);
    }
  }
  check("AUTHOR/export: Section C mapping (shape, hollow, attachment, color hex) identical to the fixture export for all 12 PCs",
    same, detail.join("; "));
}
check("AUTHOR/export: authored colors registered with the exact Kite hexes (symbol prefix from nearestColorName may differ from the fixture's stored names; the hex suffix and registered value are what the engine consumes)",
  /\(cnb:register-color! '[\w-]*50b4e9 "#50b4e9"\)/.test(authored) &&
  /\(cnb:register-color! '[\w-]*cc79a7 "#cc79a7"\)/.test(authored) &&
  authored.includes(`#(cnb:register-color! 'black-000000 "#000000")`));
check("AUTHOR/export PIN(D6, D5 fixed): authored attachments now emit the engine-reference staff-space units ('(0 . 0.9) at sps 3) but remain one-pair (minim x = 0, D6), while the fixture export carries the reference's distinct minim x-offsets ('(-0.365 . 0.9))",
  authored.includes("(cons 'crotchet-up   '(0 . 0.9))") &&
  authored.includes("(cons 'minim-up      '(0 . 0.9))") &&
  fixtureExport.includes("(cons 'crotchet-up   '(0 . 0.9))") &&
  fixtureExport.includes("(cons 'minim-up      '(-0.365 . 0.9))"));
check("AUTHOR/export PIN(no engine/meta editors): authored export omits cnb:false-hollow (engine default #f) and keeps the default config's meta (no meta editor exists to change it); the fixture export sets the Kite values for all three",
  !authored.includes("cnb:false-hollow") &&
  authored.includes('#(set! cnb:file-suffix "-Default48")') &&
  authored.includes('#(set! cnb:notation-label "Default 4-8 System")') &&
  fixtureExport.includes("#(set! cnb:false-hollow #t)") &&
  fixtureExport.includes('#(set! cnb:file-suffix "-Kite-4-369-Procedure")'));

// ═════════════════ PHASE B — the release-gate fixture path ═════════════════

// ── STEP 1: load the Kite 4-369 fixture through the Module 17 loader ────────
await page.setInputFiles(".cnb-cio-file", FIXTURE);
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
check("LOAD: config-io reports the fixture loaded and valid",
  await page.evaluate(() => !!document.querySelector(".cnb-cio-valid")));

cfg = await fullConfig();
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

let fromFixture = null, fixtureErr = null;
try { fromFixture = CNBLilypond.generate(fixtureJson); } catch (err) { fixtureErr = err.message; }
check("PARITY: downloaded .ly is byte-identical to generate() on the fixture file itself (same artifact the headless driver renders through the engine)",
  fromFixture !== null && fromFixture === exported,
  fixtureErr || `lengths ${exported.length} vs ${fromFixture ? fromFixture.length : "n/a"}`);

check("EXPORT CONTENT: Kite system reached the .ly — procedure model on (D1), both kite paths, 3-6-9 geometry, false-hollow, repeat #t clauses, baked skyblue/rose colors",
  exported.includes("#(set! cnb:use-procedure-model #t)") &&
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
