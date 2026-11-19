/**
 * uat-clef-editor.mjs — Playwright UAT driver for the set-009 custom clef
 * feature (session-set 009 session 2).
 *
 * Executes the DSL-style checklist recorded in
 * docs/session-sets/009-custom-clefs/s2-uat.md against cnb/index.html (the
 * assembled application), served from the repo root by a built-in static
 * server. (The dabbler-uat-dsl compiler is still in bootstrap; this driver
 * is the checklist's executable form, following the accepted set-004/005/006
 * pattern.)
 *
 * Session 45 adds: the Dozenal, Treble, Bass and Alto buttons (each drawn
 * on the canvas and exported), a glyph clef's range fields, and the canvas
 * drag in the Clef section that moves the clef and resizes it by its
 * bottom edge.
 *
 * Session 59 replaces the range fields: a glyph clef is placed by the
 * semitone its anchor point sits on and sized by its Height (a number, or
 * Automatic for the clefs offered), an import opens the anchor picker, where
 * a click sets the anchor point, and the canvas's resize grows the clef about
 * its anchor.
 *
 * Session 79 (clef-steps design §2): the Clef, Anchor and Sits on dropdowns
 * replace the checkbox, the clef buttons, the list of clefs and the
 * semitone field; an import shows the clef; there is no padding field. The
 * canvas is hidden in steps 10 and 11, which draw the clef's own preview
 * beside their options, 16 px a semitone, its anchor marked, its pitch
 * named, and its drags; the canvas (still drawn) and the preview put the
 * clef 0.75 staff spaces after the staff's start.
 *
 * Flow (spec step 5): import a clef SVG through the clef editor (which
 * shows it) → position it (its anchor, a float semitone) →
 * confirm the preview renders the grid-positioned clef gutter → save the
 * config (real download) and load it back → export a .ly file (real
 * download) — with Node-side parity checks run in THIS process on the full
 * config read from the page's live state panel: CNBClef.gutterWidth /
 * CNBGrid.semiToY for the preview geometry, CNBLilypond.generate for the
 * export (both the byte-identity of the download and, since session 30,
 * the clef's emission: registered and shown when enabled, 'none when not).
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-clef-editor.mjs
 *
 * Requirements — the driver errors out (exit 2) rather than guessing:
 *   - playwright-core in the repo's node_modules (`npm install`), or set CNB_UAT_PLAYWRIGHT
 *     to a directory whose node_modules contains it.
 *   - A Chromium executable: CNB_UAT_CHROMIUM if set to a non-empty value
 *     (a non-empty-but-invalid path is an error, not a fallback); otherwise
 *     the newest chromium-* browser in the platform's ms-playwright cache.
 *
 * Optional: CNB_UAT_PORT (default 8149), CNB_UAT_SHOTS (screenshot dir,
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
import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";
import { CNBClef } from "../src/cnb-clef.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBBuiltinClefs } from "../ui/builtin-clefs.js";
import { CNBNotehead } from "../src/cnb-notehead.js";
import { findEngine, measureClef } from "../tests/engine-probe.js";
import { useCanvasSize, useDownloads, canvasConfig, openSection } from "./app-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8149);
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

// ── Toolkit-style sample clef SVG (session-1 importer contract: id="clef"
//    glyph element, data-semitone-height, viewBox; stem/anchor attributes
//    are not required for clefs) ───────────────────────────────────────────
const SAMPLE_CLEF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="300" viewBox="0 0 100 300">
  <path id="clef"
        d="M 50 0 L 100 60 L 65 60 L 65 240 L 100 240 L 50 300 L 0 240 L 35 240 L 35 60 L 0 60 Z"
        data-semitone-height="6"
        style="fill:#000000;stroke:none"/>
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
await page.waitForSelector(".cnb-clef-editor", { state: "attached" });
// Step 10 (session 63): the clef's symbol and size; step 11 is where it sits.
await openSection(page, "clef-symbol");
const placementLink = () => page.$eval('.section-link[data-section="clef-placement"]',
  l => ({ greyed: l.getAttribute("aria-disabled") === "true", reason: l.title }));

const fullConfig = async () => JSON.parse(await page.textContent("#state-json"));
/** The config as the canvas draws it (the Small display copy). */
const drawn = (c) => canvasConfig(c, "small");
const clefColCount = async () => page.$$eval(".cnb-pvd-preview .clef-col", els => els.length);

// The full-chromatic preview row (PCs 0–12) — the range the preview grid is
// created over, used for the Node-side semiToY parity check.
const FULL_ROW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ── STEP 0: initial assembly (default-off compatibility) ────────────────────
check("ASSEMBLY: the clef editor is mounted alongside the set-006 modules",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-clef-editor") &&
    !!document.querySelector(".cnb-preview-display") &&
    !!document.querySelector(".cnb-config-io") &&
    !!document.querySelector(".cnb-config-export")));
check("DEFAULT-OFF: the Clef dropdown says No clef, offers the four clefs, and no Anchor; placement says to choose one",
  await page.evaluate(() =>
    document.querySelector(".cnb-cle-select").value === "none" &&
    [...document.querySelector(".cnb-cle-select").options].map(o => o.textContent).join(",") === "No clef,Dozenal,Treble,Bass,Alto" &&
    !document.querySelector(".cnb-cle-anchor-select") &&
    !!document.querySelector("#clef-placement-host .cnb-cle-anchor-empty") &&
    !document.querySelector(".cnb-cle-enable-check, .cnb-cle-choice, .cnb-cle-glyph-option, .cnb-cle-gutter-input")));
let cfg = await fullConfig();
check("DEFAULT-OFF: state panel shows the schema default clef section",
  JSON.stringify(cfg.clef) ===
    JSON.stringify({ enabled: false, active: null, glyphs: {}, gutter: { paddingH: 12 } }),
  JSON.stringify(cfg.clef));
check("DEFAULT-OFF: the preview reserves NO clef gutter (no .clef-col) and shows 13 cards",
  (await clefColCount()) === 0 &&
  await page.$$eval(".cnb-pvd-preview .pc-col", els => els.length === 13));
check("STEPS: step 10 shows the clef's symbol and size and no placement; step 11 is greyed with its reason and does not open (session 63)",
  JSON.stringify(await placementLink()) === JSON.stringify({ greyed: true, reason: "Choose or import a clef in step 10 first." }) &&
  await page.evaluate(() =>
    !document.querySelector('[data-panel="clef-symbol"]').hidden &&
    !document.querySelector('[data-panel="clef-symbol"] .cnb-cle-sits-select') &&
    document.getElementById("canvas-card").hidden) &&
  await (async () => {
    // Forced: Playwright waits for an aria-disabled link to be enabled.
    await page.click('.section-link[data-section="clef-placement"]', { force: true });
    return page.evaluate(() => document.querySelector('[data-panel="clef-placement"]').hidden &&
      !document.querySelector('[data-panel="clef-symbol"]').hidden);
  })(), JSON.stringify(await placementLink()));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-initial.png"), fullPage: true });

// ── STEP 1: import a clef SVG through the clef editor ───────────────────────
await page.setInputFiles(".cnb-cle-file", {
  name: "uat-clef.svg", mimeType: "image/svg+xml",
  buffer: Buffer.from(SAMPLE_CLEF_SVG, "utf8"),
});
await page.waitForFunction(() =>
  document.querySelector(".cnb-cle-import-status").textContent.includes("uat-clef"));
check('IMPORT: status confirms \'Imported the clef "uat-clef"\'',
  (await page.textContent(".cnb-cle-import-status")).includes('Imported the clef "uat-clef"'),
  await page.textContent(".cnb-cle-import-status"));
cfg = await fullConfig();
check("IMPORT: the glyph entry reaches the shared config (kind glyph, semitoneHeight 6, natural 100×300, its anchor at its box's centre on midpoint 12)",
  !!cfg.clef.glyphs["uat-clef"] &&
  cfg.clef.glyphs["uat-clef"].kind === "glyph" &&
  cfg.clef.glyphs["uat-clef"].semitoneHeight === 6 &&
  cfg.clef.glyphs["uat-clef"].naturalWidth === 100 &&
  cfg.clef.glyphs["uat-clef"].naturalHeight === 300 &&
  JSON.stringify(cfg.clef.glyphs["uat-clef"].reference) === JSON.stringify({ x: 50, y: 150 }) &&
  cfg.clef.glyphs["uat-clef"].anchorSemi === 12,
  JSON.stringify(cfg.clef.glyphs["uat-clef"]));
check("IMPORT: the imported glyph is chosen in the Clef dropdown, under Imported; it sits on semitone 12, 6 semitones tall, and the anchor picker is open on A point on the clef",
  cfg.clef.active === "uat-clef" &&
  await page.evaluate(() =>
    document.querySelector(".cnb-cle-select").value === "uat-clef" &&
    document.querySelector(".cnb-cle-select optgroup").label === "Imported" &&
    document.querySelector(".cnb-cle-sits-select").value === "12" &&
    document.querySelector(".cnb-cle-height").value === "6" &&
    document.querySelector(".cnb-cle-anchor-select").value === "point" &&
    !!document.querySelector(".cnb-cle-anchor-picker .cnb-cle-anchor-svg")));
check("IMPORT: an import shows the clef at once — enabled, and the preview has a .clef-col",
  cfg.clef.enabled === true && (await clefColCount()) === 1);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-imported.png"), fullPage: true });

// The picker draws the 100 × 300 clef 120 px tall (0.4 px a unit) with
// 12 px around it: a click at its pointed top puts the anchor there (the
// browser reports whole pixels, so to within a pixel, 2.5 units).
const pickerBox = await page.locator(".cnb-cle-anchor-svg").boundingBox();
await page.mouse.click(pickerBox.x + 12 + 50 * 0.4, pickerBox.y + 12);
cfg = await fullConfig();
const picked = cfg.clef.glyphs["uat-clef"].reference;
check("PICK: a click at the clef's top in the picker sets its anchor point there (about 50, 0)",
  Math.abs(picked.x - 50) <= 2.5 && Math.abs(picked.y) <= 2.5, JSON.stringify(picked));
await page.click(".cnb-cle-anchor-done");
check("PICK: Done closes the picker", !(await page.$(".cnb-cle-anchor-picker")));
// The Anchor dropdown's Top puts the anchor exactly at the top's middle.
await page.selectOption(".cnb-cle-anchor-select", "bottom");
cfg = await fullConfig();
check("ANCHOR: Bottom puts the anchor at the bottom's middle (50, 300)",
  JSON.stringify(cfg.clef.glyphs["uat-clef"].reference) === JSON.stringify({ x: 50, y: 300 }),
  JSON.stringify(cfg.clef.glyphs["uat-clef"].reference));
await page.selectOption(".cnb-cle-anchor-select", "top");
cfg = await fullConfig();
check("ANCHOR: Top puts it at the top's middle (50, 0), and the dropdown says Top",
  JSON.stringify(cfg.clef.glyphs["uat-clef"].reference) === JSON.stringify({ x: 50, y: 0 }) &&
  (await page.$eval(".cnb-cle-anchor-select", s => s.value)) === "top",
  JSON.stringify(cfg.clef.glyphs["uat-clef"].reference));

// ── STEP 2: the clef is shown ───────────────────────────────────────────────
cfg = await fullConfig();
check("ENABLE: clef.enabled true in the shared config, validation shows Config valid ✓",
  cfg.clef.enabled === true &&
  await page.evaluate(() =>
    !!document.querySelector(".cnb-clef-editor .cnb-cle-valid")));
const expectedGutter0 = CNBClef.gutterWidth(drawn(cfg), drawn(cfg).display.pxPerSemi);
check(`ENABLE: the preview grew a clef gutter column of ${expectedGutter0}px (Node-side CNBClef.gutterWidth on the same config)`,
  (await clefColCount()) === 1 &&
  await page.$eval(".cnb-pvd-preview .clef-col",
    (el, w) => el.style.width === w + "px", expectedGutter0),
  `dom width=${await page.$eval(".cnb-pvd-preview .clef-col", el => el.style.width).catch(() => "n/a")}`);
check("ENABLE: the clef glyph is rendered in the gutter (one .cnb-clef group with the imported path)",
  await page.evaluate(() =>
    document.querySelectorAll(".cnb-pvd-preview .cnb-clef").length === 1 &&
    (document.querySelector(".cnb-pvd-preview .cnb-clef path").getAttribute("d") || "")
      .startsWith("M 50 0 L 100 60")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-enabled.png"), fullPage: true });

// ── STEP 3: position the clef (its anchor, height + gutter padding) ─────────
// Its anchor, at its pointed top, on the TOP STAFF LINE (semi 20), where
// correct registration is visually obvious: the glyph's top edge must sit
// exactly on the line. This is the primary human-attestation frame. A new
// height grows it about that anchor, so the top stays on the line
// (session 59).
/** The clef group's transform the canvas should draw: 0.75 staff spaces
 *  after the staff's start (session 79), its top as drawn (CNBClef.shown,
 *  from its anchor), on the full row's grid. */
const clefAt = (c) => {
  const grid = CNBGrid.create(drawn(c), CNBCollection.gridRange(FULL_ROW, drawn(c)));
  return `translate(${CNBClef.left(drawn(c), drawn(c).display.pxPerSemi)},${grid.semiToY(CNBClef.shown(drawn(c)).top)})`;
};
/** The clef's preview in step 11 (session 79). */
const PLACEMENT_PREVIEW = "#clef-placement-preview-host .cnb-pvd-partial";
check("STEPS: with a clef shown, step 11 is no longer greyed",
  !(await placementLink()).greyed, JSON.stringify(await placementLink()));
await page.fill(".cnb-cle-height", "9");
await openSection(page, "clef-placement");
check("STEPS: step 11 shows where the clef sits beside the clef's own preview, the canvas hidden",
  await page.evaluate(() =>
    !document.querySelector('[data-panel="clef-placement"]').hidden &&
    !!document.querySelector('[data-panel="clef-placement"] .cnb-cle-sits-select') &&
    !document.querySelector('[data-panel="clef-placement"] .cnb-cle-height') &&
    !!document.querySelector("#clef-placement-preview-host .cnb-clef") &&
    document.getElementById("canvas-card").hidden));
check("STEPS: the options are on the left and the preview on the right",
  await page.evaluate(() => {
    const options = document.getElementById("clef-placement-host").getBoundingClientRect();
    const preview = document.getElementById("clef-placement-preview-host").getBoundingClientRect();
    return options.width > 0 && preview.width > options.width && preview.left >= options.right - 1 &&
      Math.abs(preview.top - options.top) < 2;
  }));
await page.selectOption(".cnb-cle-sits-select", "20");
cfg = await fullConfig();
check("POSITION: Sits on G♯ · semitone 20 — 9 semitones tall about its anchor on 20, the top stays on the anchor's semitone",
  cfg.clef.glyphs["uat-clef"].semitoneHeight === 9 && cfg.clef.glyphs["uat-clef"].anchorSemi === 20 &&
  Math.abs(CNBClef.shown(cfg).top - 20) < 0.1 &&
  (await page.$eval(".cnb-cle-sits-select", s => s.selectedOptions[0].textContent)) === "G♯ · semitone 20" &&
  await page.$eval(".cnb-pvd-preview .cnb-clef", (el, t) => el.getAttribute("transform") === t, clefAt(cfg)),
  JSON.stringify(cfg.clef.glyphs["uat-clef"]));
check("PREVIEW: the clef's preview draws it at 16 px a semitone, 0.75 staff spaces (48 px) after the staff's start, its anchor marked and G♯ named beside it",
  await page.evaluate((sel) => {
    const g = document.querySelector(`${sel} .cnb-clef`);
    const anchor = g.querySelector(".cnb-clef-anchor");
    const named = [...document.querySelectorAll(`${sel} .pitch-label.anchor-pitch`)].map(l => l.dataset.semi);
    return g.getAttribute("transform").startsWith("translate(48,") && !!anchor &&
      getComputedStyle(anchor).visibility !== "hidden" && named.join() === "20" &&
      !!document.querySelector(`${sel} .cnb-clef-resize`) && !!document.querySelector(`${sel} .label-col`);
  }, PLACEMENT_PREVIEW));
await openSection(page, "clef-symbol");
await page.fill(".cnb-cle-height", "6");
cfg = await fullConfig();
check(`POSITION: anchor 20 (top staff line), 6 semitones — clef group at ${clefAt(cfg)}, glyph top ON the line (Node-side parity)`,
  cfg.clef.glyphs["uat-clef"].anchorSemi === 20 && cfg.clef.glyphs["uat-clef"].semitoneHeight === 6 &&
  await page.$eval(".cnb-pvd-preview .cnb-clef", (el, t) => el.getAttribute("transform") === t, clefAt(cfg)));
check("POSITION: in the clef's preview, the glyph's rendered top edge coincides with a staff line's y in PAGE coordinates (getBoundingClientRect, ±1px) — i.e. anchor 20 puts the top edge ON the semi-20 line",
  await page.evaluate(() => {
    const clefPath = document.querySelector("#clef-preview-host .cnb-clef path");
    const lines = [...document.querySelectorAll("#clef-preview-host .staff-lines-bg line")];
    if (!clefPath || lines.length === 0) return false;
    const top = clefPath.getBoundingClientRect().top;
    // The preview range spans multiple octaves, so several staff lines
    // render above semi 20 (the pattern repeats per octave) — assert the
    // glyph top lands exactly on ONE of the rendered lines' y.
    return lines.some(l => {
      const b = l.getBoundingClientRect();
      return Math.abs(top - (b.top + b.height / 2)) <= 1;
    });
  }));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-anchor20.png"), fullPage: true });

// Then a FLOAT anchor (the s1 anchoring decision): 22.784.
await openSection(page, "clef-placement");
await page.selectOption(".cnb-cle-sits-select", "own");
await page.fill(".cnb-cle-sits", "22.784");
cfg = await fullConfig();
check("POSITION: A semitone of my own… opens a field, and the float anchor 22.784 reaches the active definition in the shared config",
  cfg.clef.glyphs["uat-clef"].anchorSemi === 22.784 && cfg.clef.glyphs["uat-clef"].semitoneHeight === 6 &&
  (await page.$eval(".cnb-cle-sits-select", s => s.value)) === "own",
  JSON.stringify(cfg.clef.glyphs["uat-clef"]));
// Node-side geometry parity: the glyph's group must sit at
// translate(0.75 staff spaces, semiToY(top)) on the same grid the preview
// creates for the full row.
const expected1 = clefAt(cfg);
check(`POSITION: the rendered clef group sits at ${expected1} (Node-side CNBGrid.semiToY parity)`,
  await page.$eval(".cnb-pvd-preview .cnb-clef",
    (el, t) => el.getAttribute("transform") === t, expected1),
  await page.$eval(".cnb-pvd-preview .cnb-clef", el => el.getAttribute("transform")).catch(() => "n/a"));

check("SPACE: no padding field; step 11 says the space after the clef is LilyPond's, and the stored padding stays 12",
  cfg.clef.gutter.paddingH === 12 &&
  await page.evaluate(() => !document.querySelector(".cnb-cle-gutter-input") &&
    document.querySelector("#clef-placement-host .cnb-cle-space-note").textContent.includes("LilyPond's")),
  JSON.stringify(cfg.clef.gutter));
const expectedGutter1 = CNBClef.gutterWidth(drawn(cfg), drawn(cfg).display.pxPerSemi);
const expected2 = clefAt(cfg);
check(`POSITION: the canvas's gutter column is ${expectedGutter1}px (0.75 staff spaces, the clef, 12 px after it) and the clef at ${expected2}`,
  await page.$eval(".cnb-pvd-preview .clef-col",
    (el, w) => el.style.width === w + "px", expectedGutter1) &&
  await page.$eval(".cnb-pvd-preview .cnb-clef",
    (el, t) => el.getAttribute("transform") === t, expected2));
check("POSITION: in the clef's preview the background staff spans the gutter (staff lines run behind the clef)",
  await page.evaluate((sel) => {
    const bg = document.querySelector(`${sel} .staff-lines-bg`);
    const col = document.querySelector(`${sel} .clef-col`);
    if (!bg || !col) return false;
    const bgBox = bg.getBoundingClientRect();
    const colBox = col.getBoundingClientRect();
    return bgBox.left <= colBox.left + 1 && bgBox.right > colBox.right;
  }, PLACEMENT_PREVIEW));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-positioned.png"), fullPage: true });

// ── STEP 4: save the config (Module 17, real download) ──────────────────────
const [saveDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click("#save-config"),
]);
const savedPath = path.join(SHOT_DIR, "uat-009-s2-saved.cnb.json");
await saveDownload.saveAs(savedPath);
const savedJson = JSON.parse(await readFile(savedPath, "utf8"));
cfg = await fullConfig();
check("SAVE: the shell adopted the stamped config — the live state panel is deep-equal to the downloaded file",
  JSON.stringify(cfg) === JSON.stringify(savedJson));
check("SAVE: the clef section is in the file — enabled, active uat-clef, float anchor 22.784, gutter 12",
  savedJson.clef.enabled === true &&
  savedJson.clef.active === "uat-clef" &&
  savedJson.clef.glyphs["uat-clef"].anchorSemi === 22.784 &&
  savedJson.clef.gutter.paddingH === 12,
  JSON.stringify(savedJson.clef));

// ── STEP 5: load the saved config back (Module 17 round trip) ───────────────
await page.setInputFiles("#open-file", savedPath);
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
cfg = await fullConfig();
check("LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file (clef.glyphs replace, no default bleed-through)",
  JSON.stringify(cfg) === JSON.stringify(savedJson));
check("LOAD: loaded config reported valid in the IO panel",
  await page.evaluate(() => !!document.querySelector(".cnb-cio-valid")));
check("LOAD: the clef editor re-seeded from the loaded config (uat-clef chosen, anchor Top, on its own semitone 22.784, 6 tall)",
  await page.evaluate(() =>
    document.querySelector(".cnb-cle-select").value === "uat-clef" &&
    document.querySelector(".cnb-cle-anchor-select").value === "top" &&
    document.querySelector(".cnb-cle-sits-select").value === "own" &&
    document.querySelector(".cnb-cle-sits").value === "22.784" &&
    document.querySelector(".cnb-cle-height").value === "6"));
check("LOAD: the preview still renders the positioned clef gutter",
  (await clefColCount()) === 1 &&
  await page.$eval(".cnb-pvd-preview .cnb-clef",
    (el, t) => el.getAttribute("transform") === t, expected2));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-loaded.png"), fullPage: true });

// ── STEP 6: export a .ly file (Module 18, real download) ────────────────────
const [exportDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click("#export-ly"),
]);
const exportedPath = path.join(SHOT_DIR, "uat-009-s2-exported.ly");
await exportDownload.saveAs(exportedPath);
const exported = await readFile(exportedPath, "utf8");
cfg = await fullConfig();
let direct = null, directErr = null;
try { direct = CNBLilypond.generate(cfg); } catch (err) { directErr = err.message; }
check("EXPORT PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)",
  direct !== null && direct === exported,
  directErr || `lengths ${exported.length} vs ${direct ? direct.length : "n/a"}`);
// The clef exports since session 30 (LY spec 1.3.7 §5.5): the download
// registers the imported glyph and shows it by name, and the same config
// with the clef disabled engraves none.
const disabledCfg = CNBConfig.clone(cfg);
disabledCfg.clef.enabled = false;
check("EXPORT EMISSION: the clef-enabled download registers the glyph and shows it as 'custom; with the clef disabled generate() writes 'none",
  direct !== null && exported.includes("#(cnb:register-clef! '") &&
  exported.includes("#(set! cnb:clef-style 'custom)") && exported.includes("#(set! cnb:clef-name '") &&
  CNBLilypond.generate(disabledCfg).includes("#(set! cnb:clef-style 'none)"),
  "the clef settings are missing from the export");
check("EXPORT: valid badge shown, no error rows",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-verror").length === 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-009-s2-exported.png"), fullPage: true });

// ── STEP 7: the clefs to choose from (session 45) ───────────────────────────
/** Export through the page's own button, as a designer does. */
async function downloadLy() {
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-ly")]);
  const file = path.join(SHOT_DIR, "uat-045-exported.ly");
  await download.saveAs(file);
  return readFile(file, "utf8");
}

await openSection(page, "clef-symbol");
await page.selectOption(".cnb-cle-select", "dozenal");
cfg = await fullConfig();
check("CHOOSE: Dozenal shows the engine's dozenal clef (kind dozenal), chosen in the dropdown, no Anchor, sitting on the middle of the staff, its height automatic",
  cfg.clef.enabled && cfg.clef.active === "dozenal" && cfg.clef.glyphs.dozenal.kind === "dozenal" &&
  cfg.clef.glyphs.dozenal.semitoneHeight === null &&
  await page.evaluate(() =>
    document.querySelector(".cnb-cle-select").value === "dozenal" &&
    !document.querySelector(".cnb-cle-anchor-select") && !document.querySelector(".cnb-cle-sits-select") &&
    document.querySelector(".cnb-cle-sits-fixed").textContent === "the middle of the staff" &&
    !!document.querySelector(".cnb-cle-dozenal-note") &&
    document.querySelector(".cnb-cle-height-auto-check").checked),
  JSON.stringify(cfg.clef.glyphs.dozenal));
const dozenalGrid = CNBGrid.create(drawn(cfg), CNBCollection.gridRange(FULL_ROW, drawn(cfg)));
// At its automatic height, scaled about the middle line (session 59).
const dozenalSpace = CNBClef.staffSpacePx(drawn(cfg), drawn(cfg).display.pxPerSemi) *
  (CNBClef.shown(drawn(cfg)).height / (3 * drawn(cfg).staff.semitonesPerStaffSpace));
check("CHOOSE: the canvas draws the numeral 50 on the middle line at its automatic size (two digit paths, Node-side transform parity)",
  await page.$eval(".cnb-pvd-preview .cnb-clef", (el, t) =>
    el.getAttribute("transform") === t && el.querySelectorAll("path").length === 2 &&
    el.querySelector("path").getAttribute("d").startsWith("M535 234"),
    `translate(${CNBClef.left(drawn(cfg), drawn(cfg).display.pxPerSemi)},${dozenalGrid.semiToY(cfg.staff.midpoint)}) scale(${dozenalSpace})`));
let ly = await downloadLy();
check("CHOOSE: the export shows the dozenal clef ('dozenal) and registers nothing",
  ly.includes("#(set! cnb:clef-style 'dozenal)") && !ly.includes("cnb:register-clef!") &&
  ly === CNBLilypond.generate(cfg));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-045-dozenal.png"), fullPage: true });

for (const name of ["treble", "bass", "alto"]) {
  const before = await fullConfig();
  await page.selectOption(".cnb-cle-select", name);
  cfg = await fullConfig();
  const want = CNBBuiltinClefs.definition(before, name);
  const def = cfg.clef.glyphs[name];
  check(`CHOOSE: ${name} adds LilyPond's glyph with its anchor on its pitch (semitone ${want.anchorSemi}), its size automatic`,
    cfg.clef.active === name && def && def.anchorSemi === want.anchorSemi &&
    def.semitoneHeight === null && JSON.stringify(def.reference) === JSON.stringify(want.reference) &&
    def.svgPath === want.svgPath,
    JSON.stringify(def && { anchorSemi: def.anchorSemi, semitoneHeight: def.semitoneHeight }));
  const grid = CNBGrid.create(drawn(cfg), CNBCollection.gridRange(FULL_ROW, drawn(cfg)));
  const shown = CNBClef.shown(drawn(cfg));
  check(`CHOOSE: the canvas draws the ${name} clef with its top at semiToY(${shown.top}), not cut off by the row`,
    await page.$eval(".cnb-pvd-preview .cnb-clef", (el, t) => el.getAttribute("transform") === t,
      `translate(${CNBClef.left(drawn(cfg), drawn(cfg).display.pxPerSemi)},${grid.semiToY(shown.top)})`) &&
    grid.minSemi <= shown.top - shown.height && grid.maxSemi >= shown.top);
  ly = await downloadLy();
  check(`CHOOSE: the export registers the ${name} glyph and shows it`,
    ly.includes(`#(cnb:register-clef! '${name}`) && ly.includes(`#(set! cnb:clef-name '${name})`) &&
    ly === CNBLilypond.generate(cfg));
  await page.screenshot({ path: path.join(SHOT_DIR, `uat-045-${name}.png`), fullPage: true });
}

// ── STEP 8: move and resize the clef in its preview (session 45; session 79) ─
await openSection(page, "clef-symbol");
await page.selectOption(".cnb-cle-select", "treble");
await openSection(page, "clef-placement");
// Back on a pitch, Sits on closes the own-semitone field: a drag snaps to semitones.
await page.selectOption(".cnb-cle-sits-select", "7");
check("DRAG: the canvas is hidden and has no clef mode; the clef's preview in step 11 takes the drag",
  await page.evaluate(() =>
    document.getElementById("canvas-card").hidden &&
    !document.querySelector(".cnb-preview-display").classList.contains("cnb-pvd-clef-mode") &&
    document.querySelector("#clef-placement-preview-host .cnb-pvd-partial").classList.contains("cnb-pvd-clef-drag")));
const step = 16;   // the clef's preview is always at 16 px a semitone
const start = (await fullConfig()).clef.glyphs.treble;
const startHeight = CNBClef.shown(await fullConfig()).height;
const glyphBox = await page.locator(`${PLACEMENT_PREVIEW} .cnb-clef path`).first().boundingBox();
await page.mouse.move(glyphBox.x + glyphBox.width / 2, glyphBox.y + glyphBox.height / 2);
await page.mouse.down();
await page.mouse.move(glyphBox.x + glyphBox.width / 2, glyphBox.y + glyphBox.height / 2 - 3.2 * step, { steps: 5 });
await page.mouse.up();
cfg = await fullConfig();
check(`DRAG: dragging the clef 3.2 semitones up moves its anchor to the semitone, ${start.anchorSemi} → ${start.anchorSemi + 3}, still automatic, its pitch named`,
  cfg.clef.glyphs.treble.anchorSemi === start.anchorSemi + 3 &&
  cfg.clef.glyphs.treble.semitoneHeight === null &&
  await page.evaluate(([sel, semi]) =>
    [...document.querySelectorAll(`${sel} .pitch-label.anchor-pitch`)].map(l => l.dataset.semi).join() === String(semi),
    [PLACEMENT_PREVIEW, start.anchorSemi + 3]),
  JSON.stringify(cfg.clef.glyphs.treble.anchorSemi));
const handleBox = await page.locator(`${PLACEMENT_PREVIEW} .cnb-clef-resize`).first().boundingBox();
await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
await page.mouse.down();
await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 2 * step, { steps: 5 });
// While the pointer moves, the clef itself grows (its rendered height),
// about its anchor, so its corner handle, drawn in it, moves down with it.
const midDrag = await page.evaluate((sel) => ({
  clef: document.querySelector(`${sel} .cnb-clef path`).getBoundingClientRect().height,
  handle: document.querySelector(`${sel} .cnb-clef-resize`).getBoundingClientRect().top,
}), PLACEMENT_PREVIEW);
check("DRAG: during the resize the clef grows live, 2 semitones (32 px) taller about its anchor, its corner handle moving down with it",
  Math.abs(midDrag.clef - (glyphBox.height + 2 * step)) < 1 && midDrag.handle > handleBox.y + 1,
  JSON.stringify({ midDrag, before: glyphBox.height, handleTop: handleBox.y }));
await page.mouse.up();
cfg = await fullConfig();
const resized = cfg.clef.glyphs.treble;
const wantHeight = Math.round((startHeight + 2) * 10) / 10;
check(`DRAG: dragging its corner 2 semitones down makes it ${wantHeight} semitones tall, to a tenth, about its anchor (the anchor stays)`,
  resized.anchorSemi === start.anchorSemi + 3 && Math.abs(resized.semitoneHeight - wantHeight) < 1e-9,
  JSON.stringify({ anchorSemi: resized.anchorSemi, semitoneHeight: resized.semitoneHeight }));
check("DRAG: the panels show the dragged anchor and height, no longer automatic",
  await page.evaluate(([sits, height]) =>
    document.querySelector(".cnb-cle-sits-select").value === String(sits) &&
    document.querySelector(".cnb-cle-height").value === String(height) &&
    !document.querySelector(".cnb-cle-height-auto-check").checked,
    [resized.anchorSemi, resized.semitoneHeight]));
ly = await downloadLy();
const dragged = CNBClef.shown(cfg);
check("DRAG: the export carries the dragged clef (its top as drawn and its height)",
  ly.includes(`(cons 'anchor-semitones ${Math.round((dragged.top - cfg.staff.midpoint + 12) * 1e4) / 1e4})`) &&
  ly.includes(`(cons 'height-semitones ${resized.semitoneHeight})`) && ly === CNBLilypond.generate(cfg));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-045-dragged.png"), fullPage: true });

// ── STEP 8b: a clef drawn by hand in Inkscape (session 62) ──────────────────
// The tutorial's c-clef.svg: two paths in a translated layer, relative
// commands and arcs. It imports where it was drawn, the canvas draws it, and
// the engine engraves it where the canvas draws it.
const C_CLEF_TEXT = await readFile(path.join(ROOT, "docs", "playbook", "tutorial", "downloads", "c-clef.svg"), "utf8");
await openSection(page, "clef-symbol");
await page.setInputFiles(".cnb-cle-file", {
  name: "c-clef.svg", mimeType: "image/svg+xml", buffer: Buffer.from(C_CLEF_TEXT, "utf8"),
});
await page.waitForFunction(() =>
  /c-clef|Import failed/.test(document.querySelector(".cnb-cle-import-status").textContent +
    (document.querySelector(".cnb-cle-import-error")?.textContent || "")));
cfg = await fullConfig();
const cClef = cfg.clef.glyphs["c-clef"];
check("HAND-DRAWN: c-clef.svg imports without error and is the active clef, its path absolute M, L, C and Z",
  !!cClef && cfg.clef.active === "c-clef" && /^M [-\d.]+ [-\d.]+( [MLCZ]( [-\d.]+)*)*$/.test(cClef.svgPath),
  await page.textContent(".cnb-clef-editor"));
// Chromium's own measure of the file's drawn paths, in the root's units.
const drawnBox = await page.evaluate((text) => {
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-9999px;top:0";
  host.innerHTML = text.replace(/^<\?xml[^>]*>/, "");
  document.body.appendChild(host);
  const b = host.querySelector("svg").getBBox();
  host.remove();
  return { x: [b.x, b.x + b.width], y: [b.y, b.y + b.height] };
}, C_CLEF_TEXT);
const importedBox = CNBNotehead.box(cClef);
check(`HAND-DRAWN: its box matches the extent Chromium draws the file's paths at (${JSON.stringify(drawnBox)}), within 0.01`,
  [0, 1].every(i => Math.abs(importedBox.x[i] - drawnBox.x[i]) <= 0.01 && Math.abs(importedBox.y[i] - drawnBox.y[i]) <= 0.01),
  JSON.stringify(importedBox));
if (await page.$(".cnb-cle-anchor-done")) await page.click(".cnb-cle-anchor-done");
await page.fill(".cnb-cle-height", "8");
await openSection(page, "clef-placement");
await page.selectOption(".cnb-cle-sits-select", "14");
cfg = await fullConfig();
check("HAND-DRAWN: 8 semitones tall, its anchor (its box's centre) on semitone 14",
  cfg.clef.glyphs["c-clef"].semitoneHeight === 8 && cfg.clef.glyphs["c-clef"].anchorSemi === 14,
  JSON.stringify({ h: cfg.clef.glyphs["c-clef"].semitoneHeight, a: cfg.clef.glyphs["c-clef"].anchorSemi }));
check("HAND-DRAWN: the canvas draws it with its top at semiToY(CNBClef.shown(...).top) (Node-side parity)",
  await page.$eval(".cnb-pvd-preview .cnb-clef", (el, t) => el.getAttribute("transform") === t,
    clefAt(cfg)) &&
  (await page.$eval(".cnb-pvd-preview .cnb-clef path", el => el.getAttribute("d"))) === cfg.clef.glyphs["c-clef"].svgPath,
  await page.$eval(".cnb-pvd-preview .cnb-clef", el => el.getAttribute("transform")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-062-c-clef.png"), fullPage: true });
ly = await downloadLy();
check("HAND-DRAWN: the export registers it and equals CNBLilypond.generate on the same config",
  ly.includes("#(cnb:register-clef! 'c-clef") && ly.includes("#(set! cnb:clef-name 'c-clef)") &&
  ly === CNBLilypond.generate(cfg));
const engine = findEngine();
if (engine.skip) {
  results.push(`SKIP  HAND-DRAWN: engraving not measured (${engine.skip})`);
} else {
  const { clef: engraved, error: engraveError } = await measureClef(engine, ly);
  const { top, bottom } = CNBClef.extent(cfg);
  const mid = cfg.staff.midpoint, sps = cfg.staff.semitonesPerStaffSpace;
  check(`HAND-DRAWN: the engine engraves it where the canvas draws it, top ${(top - mid) / sps} and bottom ${(bottom - mid) / sps} staff spaces, within 0.001`,
    !engraveError && engraved &&
    Math.abs(engraved.top / 2 - (top - mid) / sps) < 0.001 &&
    Math.abs(engraved.bottom / 2 - (bottom - mid) / sps) < 0.001,
    engraveError || JSON.stringify(engraved && { top: engraved.top / 2, bottom: engraved.bottom / 2 }));
}

// ── STEP 9: no errors ────────────────────────────────────────────────────────
check("NO console or page errors across the whole clef flow", consoleErrors.length === 0,
  consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots + saved/exported files: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
