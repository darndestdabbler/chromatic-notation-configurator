/**
 * uat-pitch.mjs — Playwright UAT driver for Pitch (session 28, design
 * docs/planning/notehead-first-editor-design.md §3, §4, mock-up 3).
 *
 * Rebuilds Twinline from nudges in cnb/index.html, starting from the
 * default config, and checks it engraves where the stride-7 fixture
 * (cnb/assets/examples/gallery/twinline-compact.json) does:
 *
 *   1. Staff › Staff lines on: C♯, D, G, A♯ and B, with C in the middle.
 *      Moving the middle to G in step 3 renames them D, F, F♯, G♯ and A,
 *      Twinline's lines.
 *   2. Ledger lines › Automatic.
 *   3. Pitch › Middle of the staff: G; Staff spacing 3.4286; then the
 *      nudges of design §3.3, read from the fixture (C♯ −1 … B −0.71).
 *   4. The result: every semitone 0–23 engraves at the fixture's half-space
 *      staff position, and the exported staff-line positions match, within
 *      0.01. The five shared pairs sit level on the canvas, and the
 *      Automatic ledger spots have followed the nudged lines to C and A♯.
 *      The columns that draw ledger lines are the fixture's.
 *
 * Then, separately:
 *   - in the Pitch section, dragging a label strip one semitone down makes
 *     the middle of the staff G♯, and dragging it back makes it G;
 *   - on the default config, renaming C to F♯ from the notehead panel
 *     keeps the exported staff '(-4 -2 2 4) (design §11);
 *   - the fixture itself opens with its nudges shown, and a map that needs
 *     more than ±1 shows the custom-map fallback, whose button opens
 *     Advanced › Pitch axis map.
 *
 * Requirements, as the other drivers (uat-app-layout.mjs): playwright-core
 * plus a Chromium from the ms-playwright cache or CNB_UAT_CHROMIUM
 * (exit 2 = missing dependency, 1 = check failure, 0 = all passed).
 * Optional: CNB_UAT_PORT (default 8163), CNB_UAT_SHOTS (screenshot dir,
 * default <os tmpdir>/cnb-uat).
 *
 * Usage: node cnb/uat/uat-pitch.mjs
 */
import http from "http";
import os from "os";
import { readFile, mkdir } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { openSection, selectNotehead, setField } from "./app-page.mjs";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBPitchAxis } from "../src/cnb-pitch-axis.js";
import { CNBConfigIO } from "../ui/config-io.js";
import { CNBPitchModel } from "../ui/pitch-model.js";
import { CNBPreviewDisplay } from "../ui/preview-display.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8163);
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

// ── The fixture and what it engraves ────────────────────────────────────────
const fixtureText = await readFile(path.join(ROOT, "cnb", "assets", "examples", "gallery", "twinline-compact.json"), "utf8");
const twinline = CNBConfigIO.loadFromText(fixtureText).config;
const target = CNBPitchModel.readNudges(twinline);

/** Each semitone's engraved staff position, in half staff spaces from the middle. */
function engraved(config, semis) {
  const axis = CNBPitchAxis.create(config);
  const mid = axis.positionOfSemi(config.staff.midpoint);
  return semis.map(s => 2 * (axis.positionOfSemi(s) - mid) / axis.unitsPerStaffSpace);
}
const SEMIS = [...Array(24).keys()];
const near = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= 0.01);
const staffLines = (ly) => (ly.match(/cnb:staff-line-positions '\(([^)]*)\)/) || [, ""])[1].trim().split(/\s+/).map(Number);

// ── Browser ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: EXE });
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

const state = async () => JSON.parse(await page.textContent("#state-json"));
const open = async (name, config) => {
  await page.setInputFiles("#open-file", {
    name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)),
  });
  await page.waitForFunction((n) => document.getElementById("topbar-status").textContent === "Opened " + n, name);
};
const exportLy = async () => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-ly")]);
  return readFile(await download.path(), "utf8");
};
/** The lower notehead's y in each canvas column (its translate), by pitch class. */
const lowerHeadY = () => page.$$eval(".cnb-pvd-preview .pc-col", cols => {
  const out = {};
  for (const col of cols) {
    const ys = [...col.querySelectorAll(".note-slice > g[transform^='translate']")]
      .map(g => Number(/translate\(([^,]+),([^)]+)\)/.exec(g.getAttribute("transform"))[2]));
    out[col.dataset.pc] = Math.max(...ys);
  }
  return out;
});
const ledgerColumns = () => page.$$eval(".cnb-pvd-preview .pc-col", cols =>
  cols.filter(c => c.dataset.ledgers !== "0").map(c => Number(c.dataset.pc)));

await page.goto(`http://localhost:${PORT}/cnb/index.html`);
await page.waitForSelector(".cnb-pvd-preview .pc-col");

// ── 1. The staff: lines on C♯, D, G, A♯ and B, the middle at C ──────────────
await openSection(page, "staff");
for (const pc of [1, 2, 7, 10, 11, 4, 8]) {     // add five, then remove E and G♯
  await page.click(`#staff-editor-host .cnb-sre-pc-toggle[data-pc="${pc}"]`);
}
let cfg = await state();
check("STAFF: the custom pattern C♯, D, G, A♯, B with the middle at C",
  JSON.stringify(cfg.staff.semitonePattern) === "[1,2,7,10,11]" && cfg.staff.midpoint === 12,
  JSON.stringify(cfg.staff));

// ── 2. Ledger lines: Automatic ──────────────────────────────────────────────
await openSection(page, "ledger-lines");
await page.click('#ledger-editor-host [data-ledger-mode="automatic"]');

// ── 3. Pitch: the middle at G, the spacing, the nudges ──────────────────────
await openSection(page, "pitch");
check("PITCH: the Pitch section opens with the label strip in drag mode",
  await page.isVisible('[data-panel="pitch"]') &&
  await page.$eval(".cnb-preview-display", e => e.classList.contains("cnb-pvd-pitch-mode")) &&
  await page.isVisible(".cnb-pvd-preview .label-col"));
await setField(page, ".cnb-pp-middle", "7");
cfg = await state();
check("PITCH: the middle of the staff at G renames the lines D, F, F♯, G♯ and A",
  JSON.stringify(cfg.staff.semitonePattern) === "[2,5,6,8,9]" && cfg.staff.midpoint === 7,
  JSON.stringify(cfg.staff));
await setField(page, ".cnb-pp-spacing", String(target.staffSpacing));
for (let pc = 1; pc < 12; pc++) {
  await setField(page, `.cnb-pp-nudge[data-pc="${pc}"] .cnb-pp-nudge-field`, String(target.nudges[pc]));
}
cfg = await state();
const read = CNBPitchModel.readNudges(cfg);
check("NUDGES: the §3.3 nudges and spacing are written",
  read && near(read.nudges, target.nudges) && Math.abs(read.staffSpacing - target.staffSpacing) < 1e-4,
  JSON.stringify(read));
check("NUDGES: written as a stride-12 pitch axis", cfg.pitchAxis && cfg.pitchAxis.octaveStride === 12);
check("SHARES: the Pitch section marks the ten notes of the five shared pairs",
  JSON.stringify(await page.$$eval(".cnb-pp-nudge", els =>
    els.filter(e => e.querySelector(".cnb-pp-nudge-shares")).map(e => Number(e.dataset.pc)))) ===
    "[0,1,3,4,5,6,8,9,10,11]");

// ── 4. The result against the fixture ───────────────────────────────────────
check("ENGRAVED: every semitone 0–23 at the fixture's staff position (±0.01 half-space)",
  near(engraved(cfg, SEMIS), engraved(twinline, SEMIS)),
  JSON.stringify(engraved(cfg, SEMIS).map(x => Math.round(x * 100) / 100)));
const ly = await exportLy();
check("EXPORT: the staff-line positions match the fixture's export (±0.01)",
  near(staffLines(ly), CNBLilypond.computeStaffLinePositions(twinline)),
  `${staffLines(ly)} vs ${CNBLilypond.computeStaffLinePositions(twinline)}`);
check("EXPORT: the pitch-axis procedure is exported", ly.includes("cnb:get-pitch-staff-position"));
check("LEDGERS: the Automatic spots followed the nudged lines to C and A♯",
  JSON.stringify(cfg.ledgers.templates) === JSON.stringify([
    { semiWithinOctave: 0, triggerPCs: [], triggerMode: "proximity" },
    { semiWithinOctave: 10, triggerPCs: [], triggerMode: "proximity" }]) && cfg.ledgers.proximityRule === true,
  JSON.stringify(cfg.ledgers.templates));
await page.screenshot({ path: path.join(SHOT_DIR, "pitch-twinline-rebuilt.png"), fullPage: true });
const rebuiltY = await lowerHeadY();
for (const [a, b] of [[0, 1], [3, 4], [5, 6], [8, 9], [10, 11]]) {
  check(`CANVAS: pitch classes ${a} and ${b} sit level`, Math.abs(rebuiltY[a] - rebuiltY[b]) < 0.5,
    `${rebuiltY[a]} vs ${rebuiltY[b]}`);
}
const rebuiltLedgers = await ledgerColumns();
await open("twinline-compact.json", JSON.parse(fixtureText));
const fixtureLedgers = await ledgerColumns();
check("CANVAS: the columns that draw ledger lines are the fixture's (C, C♯, A♯, B and C′)",
  JSON.stringify(rebuiltLedgers) === JSON.stringify(fixtureLedgers),
  `${JSON.stringify(rebuiltLedgers)} vs ${JSON.stringify(fixtureLedgers)}`);

// ── The fixture opens with its nudges; a bigger map falls back ──────────────
await openSection(page, "pitch");
check("FIXTURE: Twinline at stride 7 shows its nudges, with no custom-map note",
  !(await page.$(".cnb-pp-custom")) &&
  Math.abs(Number(await page.inputValue('.cnb-pp-nudge[data-pc="1"] .cnb-pp-nudge-field')) + 1) < 1e-9);
check("FIXTURE: opening it rewrites nothing", (await state()).pitchAxis.octaveStride === 7);

// ── Dragging the label strip ────────────────────────────────────────────────
const step = CNBPreviewDisplay.SIZES[await page.$eval(".cnb-pvd-size-option.on", b => b.dataset.size)];
async function dragStrip(semitones) {
  const box = await page.locator(".cnb-pvd-preview .label-slice").first().boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + semitones * step / 2, { steps: 3 });
  await page.mouse.move(x, y + semitones * step, { steps: 3 });
  await page.mouse.up();
}
await dragStrip(1);
check("DRAG: dragging the strip one semitone down puts G♯ in the middle",
  (await page.inputValue(".cnb-pp-middle")) === "8" && (await state()).staff.midpoint === 8,
  await page.inputValue(".cnb-pp-middle"));
await dragStrip(-1);
check("DRAG: dragging it back puts G in the middle again",
  (await page.inputValue(".cnb-pp-middle")) === "7" &&
  JSON.stringify((await state()).staff.semitonePattern) === "[2,5,6,8,9]");

const custom = JSON.parse(fixtureText);
custom.pitchAxis.pitchClasses = [0, 0, 0, 1, 2, 3, 3, 4, 5, 5, 6, 6].map((position, pc) => ({ pc, position }));
await open("custom-axis.json", custom);
await openSection(page, "pitch");
check("CUSTOM: a map that needs more than ±1 says so and disables the nudges",
  (await page.textContent(".cnb-pp-custom-text")).startsWith("This file uses a custom pitch axis that nudges can't show") &&
  await page.$eval('.cnb-pp-nudge[data-pc="5"] .cnb-pp-nudge-field', e => e.disabled));
await page.click(".cnb-pp-open-advanced");
check("CUSTOM: its button opens Advanced › Pitch axis map",
  await page.isVisible('[data-panel="advanced"]') && await page.$eval("#pitch-axis-map", d => d.open));

// ── Renaming C to F♯ on the default staff ───────────────────────────────────
await page.reload();
await page.waitForSelector(".cnb-pvd-preview .pc-col");
await selectNotehead(page, 0);
check("RENAME: the notehead panel names the notehead C",
  (await page.inputValue(".cnb-nhp-name-select")) === "0");
await setField(page, ".cnb-nhp-name-select", "6");
cfg = await state();
check("RENAME: the middle of the staff becomes F♯ and the panel follows the notehead to its new name",
  cfg.staff.midpoint === 6 && (await page.textContent(".cnb-nhp-title")) === "F♯" &&
  (await page.inputValue(".cnb-nhp-name-select")) === "6",
  `${cfg.staff.midpoint} ${await page.textContent(".cnb-nhp-title")}`);
const renamedLy = await exportLy();
check("RENAME: the exported staff stays '(-4 -2 2 4) (design §11)",
  renamedLy.includes("#(set! cnb:staff-line-positions '(-4 -2 2 4))"),
  staffLines(renamedLy).join(" "));

check("NO console or page errors", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();
for (const line of results) console.log(line);
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots: ${SHOT_DIR}`);
process.exit(failCount ? 1 : 0);
