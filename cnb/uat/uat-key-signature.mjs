/**
 * uat-key-signature.mjs — Playwright UAT driver for the set-010 custom
 * key-signature feature (session-set 010 session 2).
 *
 * Executes the DSL-style checklist recorded in
 * docs/session-sets/010-custom-key-signatures/s2-uat.md against
 * cnb/index.html (the assembled application), served from the repo root by
 * a built-in static server. (The dabbler-uat-dsl compiler is still in
 * bootstrap; this driver is the checklist's executable form, following the
 * accepted set-004/005/006/009 pattern.)
 *
 * Flow (spec step 5): enable keys → define keys (add/rename definitions,
 * duplicate-name editor check, tonic resolution) → enable the key
 * signature → select the displayed key in the preview → the panel of the
 * key-signature design §7 (session 50: each notes, stacks, gold-stem, looks
 * and place choice, the canvas checked against CNBKeySignature after each;
 * since session 56 the looks through Edit and the look card, and the keys
 * whose marks touch) → Sharps or flats (session 51: C, D and B♭ major in
 * the middle, on the bottom and on every line set, each checked against
 * CNBKeySignature, the export's signs, and the key's notes restored; since
 * session 52 the Size row, automatic and 5 semitones by hand, checked
 * against CNBKeySignature and the export's scale; since session 54 a
 * starting point on the one model: the traditional signature's settings, the
 * window's zigzag in C♯ major, the key's notes restoring the defaults, and
 * configs saved with the accidentals and notehead-chords styles loading as
 * before; since session 56 through Start from, and the signs' size in the
 * look card) → the editor of design §13.8 (session 56: the magnified canvas,
 * a click and the pinned layer, a drag of a mark, of its corner handle and
 * of a sign's, each one step of undo, every Edit layer, the look card's
 * offset and added symbols, Import from SVG with its reference point and
 * Takes ledger lines, the key picker and the other keys, the touch line,
 * its list and the checks' warning, Start from confirmed and cancelled,
 * screenshots at 1440 and 1280 px) → clef
 * composition → save the config (real
 * download) and load it back → export a .ly file (real download, the mark
 * table) → the Clairnote SN gallery file's signature → screenshots at 1440
 * and 1280 px — with Node-side parity checks run in
 * THIS process on the full config read from the page's live state panel:
 * CNBKeySignature.gutterWidth / measure / signatureSemis and
 * CNBGrid.semiToY for the preview geometry, CNBLilypond.generate for the
 * export (both the byte-identity of the download and, since session 30,
 * the signature's emission: its tonic octave when enabled, 'none when not).
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-key-signature.mjs
 *
 * Requirements — the driver errors out (exit 2) rather than guessing:
 *   - playwright-core in the repo's node_modules (`npm install`), or set CNB_UAT_PLAYWRIGHT
 *     to a directory whose node_modules contains it.
 *   - A Chromium executable: CNB_UAT_CHROMIUM if set to a non-empty value
 *     (a non-empty-but-invalid path is an error, not a fallback); otherwise
 *     the newest chromium-* browser in the platform's ms-playwright cache.
 *
 * Optional: CNB_UAT_PORT (default 8151), CNB_UAT_SHOTS (screenshot dir,
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
import { CNBKeySignature } from "../src/cnb-key-signature.js";
import { CNBGrid } from "../src/cnb-grid.js";
import { CNBCollection } from "../src/cnb-collection.js";
import { CNBPreviewDisplay } from "../ui/preview-display.js";
import { CNBConfigExport } from "../ui/config-export.js";
import { useCanvasSize, useDownloads, canvasConfig, openSection, setField } from "./app-page.mjs";
import { withSvgStub } from "../tests/svg-stub.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8151);
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

// ── Toolkit-style sample clef SVG (set-009 importer contract) — used by the
//    clef-composition step ──────────────────────────────────────────────────
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
await page.waitForSelector(".cnb-key-signature-editor", { state: "attached" });

// The key signature's steps (session 63): Show and Start from in step 6, the
// looks in step 7, Notes, Stacks and Place in step 8, the keys in step 9,
// and the keys for notehead rules in Advanced. The staff canvas is hidden in
// steps 6–9 (it keeps its layout), so a canvas measured as the browser lays
// it out is measured from a step that shows it.
const PANEL = {
  type: '[data-panel="ks-symbol-type"]', symbols: '[data-panel="ks-custom-symbols"]',
  designer: '[data-panel="ks-designer"]', preview: '[data-panel="ks-preview"]',
};
/** Advanced, its Keys for notehead rules open. */
async function openKeys() {
  await openSection(page, "advanced");
  await page.evaluate(() => { document.getElementById("keys-for-rules").open = true; });
}
/** A step the canvas shows in. */
const showCanvas = () => openSection(page, "noteheads");
const greyedSteps = () => page.$$eval('.section-link[aria-disabled="true"]', els => els.map(e => e.dataset.section));
await openKeys();

const fullConfig = async () => JSON.parse(await page.textContent("#state-json"));
/** The config as the canvas draws it (the Small display copy). */
const drawn = (c) => canvasConfig(c, "small");
const keysigColCount = async () => page.$$eval(".cnb-pvd-preview .keysig-col", els => els.length);

// The full-chromatic preview row (PCs 0–12) — the range the preview grid is
// created over, used for the Node-side semiToY parity checks.
const FULL_ROW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Rendered keysig notehead marks: [{x, y}] parsed from each notehead
 *  group's translate(x,y) (groups that directly contain a path — ledger
 *  groups contain rects/lines). */
const renderedMarks = () => page.evaluate(() => {
  const gs = [...document.querySelectorAll(".cnb-pvd-preview .cnb-key-signature > g")];
  return gs
    .filter(g => g.querySelector(":scope > path"))
    .map(g => {
      const m = /translate\(([-\d.eE+]+),([-\d.eE+]+)\)/.exec(g.getAttribute("transform") || "");
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
    });
});

/**
 * The rendered distance from the marks' right edge to the centre of the
 * first card's notehead, in px (getBoundingClientRect), and the engine's
 * 4.8636 staff spaces at the canvas's current Size (session 34).
 */
const signatureGap = async (cfg) => {
  const size = await page.$eval(".cnb-pvd-size-option.on", b => b.dataset.size);
  const shown = canvasConfig(cfg, size);
  // The ink: the marks and their ledgers (session 50, engine 1.4.1).
  const got = await page.evaluate(() => {
    const ink = [...document.querySelectorAll(".cnb-pvd-preview .keysig-col .cnb-key-signature > g")]
      .filter(g => g.querySelector(":scope > path") || g.classList.contains("cnb-ledger-set"));
    const head = [...document.querySelectorAll(".cnb-pvd-preview .pc-col")][0]
      .querySelector(".note-slice > g:not(.cnb-ledger-set)");
    const r = head.getBoundingClientRect();
    return (r.left + r.right) / 2 - Math.max(...ink.map(g => g.getBoundingClientRect().right));
  });
  return { size, got, want: 4.8636 * shown.display.pxPerSemi * shown.staff.semitonesPerStaffSpace };
};

/** The marks' left edge in the gutter: the engine's spacing, after the staff's start or a clef (session 34). */
const marksLeft = (cfg, keyName) => CNBKeySignature.padding(drawn(cfg), drawn(cfg).display.pxPerSemi, keyName).left;

/** Node-side expected mark positions for the current config + key: each
 *  mark at its stack's centre and its semitone, under any stacking rule and
 *  place (session 50), in the order the renderer draws them. */
function expectedMarks(cfg, keyName) {
  cfg = drawn(cfg);
  const m = CNBKeySignature.measure(cfg, cfg.display.pxPerSemi, keyName);
  if (!m) return null;
  const grid = CNBGrid.create(cfg, CNBCollection.gridRange(FULL_ROW, cfg, ["crotchet"], keyName));
  const left = marksLeft(cfg, keyName);
  // Each drawn shape (session 55: a mark's base, then its added symbols) at
  // its stack's line plus its own placement; a centred mark's is its line.
  return m.marks.flatMap(({ semi, column }, i) => (m.layouts[i] || [])
    .filter(sym => sym.kind !== "sign")
    .map(sym => ({ x: left + m.lead + column * m.markWidth + sym.x, y: grid.semiToY(semi) + sym.y })));
}

/** The same for a key picked on the staff ({ tonic, mode, spelling }), as the
 *  canvas draws it whether or not a key is defined (CNBPreviewDisplay.withKey). */
function expectedFor(cfg, key) {
  const picked = CNBPreviewDisplay.withKey(cfg, key);
  return expectedMarks(picked.config, picked.name);
}

const close = (a, b) => Math.abs(a - b) < 1e-6;
const marksMatch = (actual, expected) =>
  actual.length === expected.length &&
  actual.every((p, i) => p && close(p.x, expected[i].x) && close(p.y, expected[i].y));

// ── STEP 0: initial assembly (default-off compatibility) ────────────────────
check("ASSEMBLY: the key-signature editor is mounted alongside the set-006/009 modules",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-key-signature-editor") &&
    !!document.querySelector(".cnb-clef-editor") &&
    !!document.querySelector(".cnb-preview-display") &&
    !!document.querySelector(".cnb-config-io") &&
    !!document.querySelector(".cnb-config-export")));
check("DEFAULT-OFF: in Advanced › Keys for notehead rules the master toggle is unchecked, the explicit disabled note is shown, its controls are disabled (shown, not hidden); step 6's Show the key signature stays live (session 63)",
  await page.evaluate(() =>
    !document.querySelector("#keys-for-rules .cnb-kse-keys-enable-check").checked &&
    !!document.querySelector("#keys-for-rules .cnb-kse-disabled-note") &&
    document.querySelector("#keys-for-rules .cnb-kse-def-add").disabled &&
    !document.querySelector('[data-panel="ks-symbol-type"] .cnb-kse-sig-enable-check').disabled));
check("DEFAULT-OFF: steps 7, 8 and 9 are greyed until a signature is shown (session 63)",
  JSON.stringify(await greyedSteps()) === JSON.stringify(["ks-custom-symbols", "ks-designer", "ks-preview", "clef-placement"]),
  JSON.stringify(await greyedSteps()));
let cfg = await fullConfig();
check("DEFAULT-OFF: state panel shows the schema default keys section",
  JSON.stringify(cfg.keys) === JSON.stringify(CNBConfig.createDefault().keys),
  JSON.stringify(cfg.keys));
check("DEFAULT-OFF: the preview reserves NO keysig gutter (no .keysig-col) and shows 13 cards; the key and mode picker shows C major, with the button that turns the signature on (session 36)",
  (await keysigColCount()) === 0 &&
  await page.$$eval(".cnb-pvd-preview .pc-col", els => els.length === 13) &&
  await page.evaluate(() =>
    document.querySelector(".cnb-pvd-key-tonic").value === "C" &&
    document.querySelector(".cnb-pvd-key-mode").value === "major" &&
    !!document.querySelector(".cnb-pvd-signature-on")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-initial.png"), fullPage: true });

// ── STEP 1: enable keys (the master gate) ───────────────────────────────────
await page.check(".cnb-kse-keys-enable-check");
cfg = await fullConfig();
check("ENABLE KEYS: keys.enabled true in the shared config; the disabled note is gone and controls are live",
  cfg.keys.enabled === true &&
  await page.evaluate(() =>
    !document.querySelector(".cnb-kse-disabled-note") &&
    !document.querySelector(".cnb-kse-def-add").disabled));
check("ENABLE KEYS: editor validation shows Config valid ✓ and the definitions section shows its explicit empty note",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-key-signature-editor .cnb-kse-valid") &&
    !!document.querySelector(".cnb-kse-empty")));
check("ENABLE KEYS: with none defined, the toolbar says so in a designer's words, naming no config path (session 36)",
  await page.evaluate(() =>
    document.querySelector(".cnb-pvd-key-note").textContent ===
      "No keys are defined yet, so no notehead rule can be for a particular key."));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-keys-enabled.png"), fullPage: true });

// ── STEP 2: define keys (add, duplicate check, rename, tonic resolution) ────
await page.click(".cnb-kse-def-add");
cfg = await fullConfig();
check("DEFINE: adding a definition appends the visible C-major template to the shared config",
  cfg.keys.definitions.length === 1 &&
  cfg.keys.definitions[0].name === "C" &&
  JSON.stringify(cfg.keys.definitions[0].pitchClasses) === JSON.stringify([0, 2, 4, 5, 7, 9, 11]),
  JSON.stringify(cfg.keys.definitions));
check("DEFINE: the tonic hint resolves the tonic from the name — 'tonic C (from name)' (s1 D3 chain)",
  await page.evaluate(() =>
    document.querySelector(".cnb-kse-def-tonic-hint").textContent === "tonic C (from name)"),
  await page.evaluate(() => document.querySelector(".cnb-kse-def-tonic-hint").textContent));

await page.click(".cnb-kse-def-add");
check("DEFINE: a second 'C' template triggers the duplicate-name editor check in the validation panel",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-kse-editor-warning") &&
    document.querySelector(".cnb-kse-editor-warning").textContent.includes('"C"')));

await page.fill('.cnb-kse-def-row[data-def-index="1"] .cnb-kse-def-name', "D Dorian");
cfg = await fullConfig();
check("DEFINE: renaming the second definition to 'D Dorian' clears the duplicate warning; both definitions are in the config",
  cfg.keys.definitions.length === 2 &&
  cfg.keys.definitions[1].name === "D Dorian" &&
  await page.evaluate(() => !document.querySelector(".cnb-kse-editor-warning")));
check("DEFINE: 'D Dorian' resolves tonic D from the name (same pitch-class set as C major — the tonic is what distinguishes them)",
  await page.evaluate(() =>
    document.querySelector('.cnb-kse-def-row[data-def-index="1"] .cnb-kse-def-tonic-hint')
      .textContent === "tonic D (from name)"));
check("DEFINE: with keys defined, the toolbar's note is gone",
  await page.evaluate(() => !document.querySelector(".cnb-pvd-key-note")));

// ── STEP 3: enable the key signature ────────────────────────────────────────
await openSection(page, "ks-symbol-type");
await page.check(`${PANEL.type} .cnb-kse-sig-enable-check`);
cfg = await fullConfig();
check("ENABLE SIGNATURE: keys.keySignature.enabled true in the shared config, validation still valid",
  cfg.keys.keySignature.enabled === true &&
  await page.evaluate(() => !!document.querySelector(".cnb-key-signature-editor .cnb-kse-valid")));
check("ENABLE SIGNATURE: the picked key's signature draws at once (C major, picked by default; session 36), and the button that turns it on is gone",
  (await keysigColCount()) >= 1 &&
  await page.evaluate(() => !document.querySelector(".cnb-pvd-signature-on")));
check("ENABLE SIGNATURE: steps 7, 8 and 9 are no longer greyed, and step 6 hides the staff canvas (session 63)",
  JSON.stringify(await greyedSteps()) === JSON.stringify(["clef-placement"]) &&
  await page.$eval("#canvas-card", e => e.hidden), JSON.stringify(await greyedSteps()));

// ── STEP 4: the key picked on the staff ─────────────────────────────────────
/** Pick a key and mode in the canvas toolbar (session 36): the tonic by its
 *  spelled name, one of the current mode's 15 (session 48). */
async function pickKey(tonic, mode) {
  await setField(page, ".cnb-pvd-key-tonic", tonic);
  await setField(page, ".cnb-pvd-key-mode", mode);
}
await pickKey("C", "major");
cfg = await fullConfig();
await showCanvas();
// The fluid canvas stretches its columns, so the gutter is a CSS track that
// keeps the engine's spacing at any width (session 34): measured as drawn,
// at two canvas Sizes, ±1 px.
for (const size of ["small", "large", "small"]) {
  await page.click(`.cnb-pvd-size-option[data-size="${size}"]`);
  const gap = await signatureGap(cfg);
  check(`KEY SELECTION (${gap.size}): selecting C grew a keysig gutter column (one per row), and the first card's notehead is centred ${gap.want.toFixed(2)} px (the engine's 4.8636 staff spaces) after the signature's ink, its ledgers included, as drawn (±1 px)`,
    (await keysigColCount()) >= 1 && Math.abs(gap.got - gap.want) <= 1, JSON.stringify(gap));
}

// The fluid rows at any width, as the browser lays them out (session 34): a
// three-card row of the G signature rendered into containers from the row's
// minimum to columns 800 px wide (the track narrower than the marks) and
// 3000 px wide (past where the cards stop growing), with default marks and
// with a G mark twice as wide as the first card's C. Measured as drawn
// (getBoundingClientRect), the first notehead is centred the engine's 4.8636
// staff spaces after the signature's ink, marks and ledgers (±1 px).
{
  const G = { name: "G", pitchClasses: [7, 9, 11, 0, 2, 4, 6] };
  for (const wideG of [false, true]) {
    const rowCfg = CNBConfig.createDefault();
    rowCfg.keys.enabled = true;
    rowCfg.keys.definitions = [{ name: "C", pitchClasses: [0, 2, 4, 5, 7, 9, 11] }, G];
    rowCfg.keys.keySignature.enabled = true;
    if (wideG) {
      rowCfg.noteheadRules.push({ name: "wide G", priority: 9,
        match: { pitchClasses: [7], durations: "all", keys: "all" }, apply: { widthSemis: 6 } });
    }
    const options = { pitchClasses: [0, 1, 2], keys: ["G"], rows: 1 };
    const min = CNBCollection.minRowWidth(rowCfg, options);
    const want = 4.8636 * rowCfg.display.pxPerSemi * rowCfg.staff.semitonesPerStaffSpace;
    const rows = await page.evaluate(async ({ cfg, options, widths }) => {
      const { CNBCollection } = await import("/cnb/src/cnb-collection.js");
      return widths.map(width => {
        const host = document.createElement("div");
        host.style.width = width + "px";
        document.body.appendChild(host);
        CNBCollection.render(host, cfg, { ...options, fluid: true });
        const marks = [...host.querySelectorAll(".keysig-col .cnb-key-signature > g")]
          .filter(g => g.querySelector(":scope > path") || g.classList.contains("cnb-ledger-set"));
        const head = host.querySelector(".pc-col .note-slice > g:not(.cnb-ledger-set)").getBoundingClientRect();
        const gap = (head.left + head.right) / 2 - Math.max(...marks.map(g => g.getBoundingClientRect().right));
        host.remove();
        return { width, gap };
      });
    }, { cfg: rowCfg, options, widths: [Math.ceil(min), Math.ceil(min) + 400, 3 * 800, 3 * 3000] });
    check(`FLUID ROWS${wideG ? " (a G mark wider than the first C)" : ""}: from the minimum row (${Math.ceil(min)} px) to columns 3000 px wide, the first notehead is centred ${want.toFixed(2)} px after the signature's ink, as the browser lays the row out (±1 px)`,
      rows.every(r => Math.abs(r.gap - want) <= 1), JSON.stringify(rows));
  }
}

let expected = expectedMarks(cfg, "C");
let actual = await renderedMarks();
check("KEY SELECTION: 8 notehead marks (7 degrees + octave tonic) at the Node-side expected two-column grid positions (even left, odd right — keysig.ly's stacked-7th-chords layout)",
  expected && expected.length === 8 && marksMatch(actual, expected),
  `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
check("KEY SELECTION: ledger lines render beneath the marks (at least one ledger element inside the keysig group)",
  await page.evaluate(() =>
    document.querySelectorAll(".cnb-pvd-preview .cnb-key-signature rect, .cnb-pvd-preview .cnb-key-signature line:not(.cnb-key-signature-separator)").length > 0));
{
  const grid = CNBGrid.create(drawn(cfg), CNBCollection.gridRange(FULL_ROW));
  const sep = cfg.keys.keySignature.separator;
  const midpoint = cfg.staff.midpoint;
  const m = CNBKeySignature.measure(drawn(cfg), drawn(cfg).display.pxPerSemi, "C");
  const barX = marksLeft(cfg, "C") + (m.columns * m.markWidth) / 2;
  check(`SEPARATOR: the engine-gold stem (${sep.color}) runs through the middle of the columns (x=${barX}) and spans midpoint ± ${sep.extentSemis} semitones (x/y parity with the engine centering rule + CNBGrid.semiToY)`,
    await page.$eval(".cnb-pvd-preview .cnb-key-signature-separator",
      (el, exp) =>
        el.getAttribute("stroke") === exp.color &&
        Math.abs(parseFloat(el.getAttribute("x1")) - exp.x) < 1e-6 &&
        el.getAttribute("y1") === String(exp.y1) &&
        el.getAttribute("y2") === String(exp.y2) &&
        Math.abs(parseFloat(el.getAttribute("stroke-width")) - exp.w) < 1e-6,
      { color: sep.color,
        x: barX,
        w: (sep.thicknessPct / 100) * drawn(cfg).display.pxPerSemi,
        y1: grid.semiToY(midpoint + sep.extentSemis),
        y2: grid.semiToY(midpoint - sep.extentSemis) }));
  check("SEPARATOR: the stem is drawn beneath the marks (first child of the keysig group — engine layering)",
    await page.evaluate(() => {
      const g = document.querySelector(".cnb-pvd-preview .cnb-key-signature");
      return g && g.firstElementChild &&
        g.firstElementChild.classList.contains("cnb-key-signature-separator");
    }));
}
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-key-C.png"), fullPage: true });

await pickKey("D", "dorian");
cfg = await fullConfig();
expected = expectedMarks(cfg, "D Dorian");
actual = await renderedMarks();
check("KEY SELECTION: switching to D Dorian re-anchors the signature on tonic D (same pitch-class set, different tonic — scale-from-tonic placement)",
  expected && expected.length === 8 && marksMatch(actual, expected) &&
  CNBKeySignature.signatureSemis(cfg, "D Dorian")[0] === 2,
  `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-key-d-dorian.png"), fullPage: true });
{
  // A key nobody defined draws too: F♯ major's signature starts on F♯.
  await pickKey("F♯", "major");
  const fsharp = { ...cfg, keys: { ...cfg.keys, definitions: [...cfg.keys.definitions,
    { name: "F♯ major", pitchClasses: [1, 3, 5, 6, 8, 10, 11], tonicPc: 6 }] } };
  const want = expectedMarks(fsharp, "F♯ major");
  const got = await renderedMarks();
  check("KEY SELECTION: a key nobody defined (F♯ major) draws its signature from F♯; the config gains no definition",
    want && want.length === 8 && marksMatch(got, want) &&
    (await fullConfig()).keys.definitions.length === 2,
    `actual=${JSON.stringify(got)} expected=${JSON.stringify(want)}`);
}
await pickKey("C", "major");

// ── STEP 5: the panel of the key-signature design §7 (session 50) ──────────
// Each choice is made in the panel as a designer makes it, and after each
// the canvas must draw exactly what the Node-side renderer gives for the live
// config and the key picked on the staff.
const C_MAJOR_KEY = { tonic: 0, mode: "major", spelling: "C" };
const D_MAJOR_KEY = { tonic: 2, mode: "major", spelling: "D" };
/** Choose a radio of one of step 8's rows by its value. */
async function radio(group, value) {
  await openSection(page, "ks-designer");
  await page.check(`${PANEL.designer} .${group} .cnb-kse-radio[data-value="${value}"] input`);
}
/** Pick a layer in step 7's Edit: the look card then edits it (session 56). */
async function pickLayer(layer) {
  await openSection(page, "ks-custom-symbols");
  await page.click(`${PANEL.symbols} .cnb-kse-layer[data-layer="${layer}"]`);
}
/** Start from in step 6 (session 56): the button, its question accepted or not. */
async function startFrom(which, accept = true) {
  await openSection(page, "ks-symbol-type");
  page.once("dialog", d => (accept ? d.accept() : d.dismiss()));
  await page.click(`${PANEL.type} .cnb-kse-start-button[data-start="${which}"]`);
}
/** The canvas against the Node-side marks for the live config and a key. */
async function canvasDraws(key, label) {
  const live = await fullConfig();
  const want = expectedFor(live, key);
  const got = await renderedMarks();
  return { ok: !!want && marksMatch(got, want), cfg: live, got, want,
    detail: `${label}: actual=${JSON.stringify(got)} expected=${JSON.stringify(want)}` };
}
/** The canvas's gold stems: [{ stroke, width }]. */
const canvasStems = () => page.$$eval(".cnb-pvd-preview .cnb-key-signature-separator",
  els => els.map(e => ({ stroke: e.getAttribute("stroke"), width: parseFloat(e.getAttribute("stroke-width")) })));

check("PANEL: the signature is set in a designer's words, a part in each step (session 63) — step 6 Show the key signature and Start from; step 7 the key, Edit, the canvas and the look card; step 8 the key, the canvas, Notes, Stacks and Place; step 9 the mode's keys; Advanced the keys for notehead rules",
  await page.evaluate(() => {
    // Each selector scoped to the panel, a comma list included.
    const q = (panel, sel) => document.querySelectorAll(sel.split(", ").map(x => `[data-panel="${panel}"] ${x}`).join(", "));
    const labels = [...q("ks-designer", ".cnb-kse-row-label")].map(e => e.textContent);
    return JSON.stringify(labels) === JSON.stringify(["Notes", "Stacks", "Place"]) &&
      q("ks-symbol-type", ".cnb-kse-start-button").length === 2 &&
      q("ks-symbol-type", ".cnb-kse-sig-enable")[0].textContent === "Show the key signature" &&
      q("ks-symbol-type", ".cnb-kse-layer, .cnb-kse-canvas, .cnb-kse-row-label").length === 0 &&
      q("ks-custom-symbols", ".cnb-kse-layer").length === 7 &&
      q("ks-custom-symbols", ".cnb-kse-canvas").length === 1 && q("ks-custom-symbols", ".cnb-kse-look-card").length === 1 &&
      q("ks-custom-symbols", ".cnb-kse-key-tonic").length === 1 && q("ks-custom-symbols", ".cnb-kse-row-label").length === 0 &&
      q("ks-designer", ".cnb-kse-canvas").length === 1 && q("ks-designer", ".cnb-kse-key-tonic").length === 1 &&
      q("ks-designer", ".cnb-kse-look-card, .cnb-kse-layer").length === 0 &&
      q("ks-preview", ".cnb-kse-mini").length === 15 && q("ks-preview", ".cnb-kse-canvas").length === 0 &&
      document.querySelector("#keys-for-rules .cnb-kse-definitions .cnb-kse-title").textContent === "Keys for notehead rules" &&
      document.querySelectorAll(".cnb-kse-definitions").length === 1;
  }));
check("PANEL: no Marks style, placement-rule, tonic-octave or bar-extent control, and no spacing control or Preview only badge; the stored values are kept",
  await page.evaluate(() =>
    !document.querySelector(".cnb-kse-style-option, .cnb-kse-placement-rule, .cnb-kse-octave-auto-check, .cnb-kse-octave-input, .cnb-kse-sep-extent, .cnb-kse-gutter-input") &&
    document.querySelectorAll(".cnb-key-signature-editor .cnb-badge").length === 0) &&
  !("style" in cfg.keys.keySignature) && cfg.keys.keySignature.placement.rule === "scale-from-tonic");

// Notes.
await radio("cnb-kse-notes-choice", "tonic-and-half-steps");
{
  const r = await canvasDraws(C_MAJOR_KEY, "half steps");
  check("NOTES: the tonic and the half steps — C, E and F, B and C′ in C major, five marks, as the Node-side renderer draws them",
    r.cfg.keys.keySignature.notes === "tonic-and-half-steps" && r.ok && r.got.length === 5, r.detail);
}
await radio("cnb-kse-notes-choice", "all");
await page.uncheck(".cnb-kse-upper-tonic-check");
{
  const r = await canvasDraws(C_MAJOR_KEY, "no upper tonic");
  check("NOTES: without the tonic an octave up, the key's seven notes", r.cfg.keys.keySignature.upperTonic === false && r.ok && r.got.length === 7, r.detail);
}
await page.check(".cnb-kse-upper-tonic-check");
{
  const r = await canvasDraws(C_MAJOR_KEY, "upper tonic");
  check("NOTES: the whole scale and the tonic an octave up again, eight marks", r.cfg.keys.keySignature.upperTonic === true && r.ok && r.got.length === 8, r.detail);
}

// Stacks, and the direction, hidden where it does not apply.
for (const [value, stacks] of [["parity", 2], ["parity-zigzag", 2], ["degrees", 2], ["parity-stacks", 3]]) {
  await radio("cnb-kse-stacking", value);
  const r = await canvasDraws(C_MAJOR_KEY, value);
  const columns = new Set(r.got.map(p => p && p.x.toFixed(3))).size;
  check(`STACKS: ${value} — written, drawn as the Node-side renderer draws it in ${stacks} stacks, the direction ${value === "parity" ? "hidden" : "shown"}`,
    r.cfg.keys.keySignature.stacking === value && r.ok && columns === stacks &&
    (await page.$$(".cnb-kse-columns")).length === (value === "parity" ? 0 : 1), r.detail);
}
await pickKey("D", "major");
const rightD = await canvasDraws(D_MAJOR_KEY, "D major, to the right");
await radio("cnb-kse-columns", "left-in-sharp-keys");
{
  const r = await canvasDraws(D_MAJOR_KEY, "D major, to the left");
  const tonic = r.got[0];
  check("STACKS: to the left in sharp keys — D major's stacks mirror, the tonic's stack now the rightmost, as the Node-side renderer draws it",
    rightD.ok && r.cfg.keys.keySignature.columns === "left-in-sharp-keys" && r.ok &&
    tonic.x === Math.max(...r.got.map(p => p.x)) && rightD.got[0].x === Math.min(...rightD.got.map(p => p.x)), r.detail);
}
await pickKey("C", "major");

// The touch check (session 56): a whole step apart in one stack, the
// 2.7-semitone notehead runs into the next, in every key.
{
  const live = await fullConfig();
  const touching = CNBKeySignature.touchingKeys(live);
  const shown = await page.evaluate(() => ({
    c: document.querySelector('.cnb-kse-mini[data-key="C"]').className,
    line: document.querySelector(".cnb-kse-touch-list .cnb-kse-touch-summary")?.textContent,
    checks: [...document.querySelectorAll("#checks-list .checks-item.warn")].map(e => e.textContent),
  }));
  check("TOUCH: with a new stack at each change of parity, the marks touch in every key — C is outlined, the line counts the keys as the touch check does, and the checks list warns",
    touching.length === 105 && shown.c.includes("touch") &&
    shown.line === `Marks touch in ${touching.length} of the 105 keys` &&
    shown.checks.some(t => t.includes(`Marks touch in ${touching.length} keys.`)), JSON.stringify(shown));
}

// The gold stem: two between three stacks, sharing the thickness, then each the whole.
{
  const live = await fullConfig();
  const px = drawn(live).display.pxPerSemi;
  const whole = (live.keys.keySignature.separator.thicknessPct / 100) * px;
  const shared = await canvasStems();
  check("GOLD STEM: two stems between the three stacks, each half the thickness, and the panel says so",
    shared.length === 2 && shared.every(s => Math.abs(s.width - whole / 2) < 1e-6) &&
    (await page.textContent(".cnb-kse-share-text")).includes("2 stems in this key: half each"), JSON.stringify(shared));
  await page.uncheck(".cnb-kse-sep-share-check");
  const unshared = await canvasStems();
  check("GOLD STEM: unshared, each stem takes the whole thickness",
    (await fullConfig()).keys.keySignature.separator.shareThickness === false &&
    unshared.length === 2 && unshared.every(s => Math.abs(s.width - whole) < 1e-6), JSON.stringify(unshared));
  await setField(page, ".cnb-kse-sep-thickness", "0.5");
  await setField(page, ".cnb-kse-sep-color", "#336699");
  const styled = await canvasStems();
  const sps = live.staff.semitonesPerStaffSpace;
  check("GOLD STEM: a thickness of 0.5 staff spaces is written as 200% of a semitone and drawn so; the colour reaches the stems",
    (await fullConfig()).keys.keySignature.separator.thicknessPct === 200 &&
    styled.every(s => Math.abs(s.width - 0.5 * sps * px) < 1e-6 && s.stroke === "#336699"), JSON.stringify(styled));
  await page.uncheck(".cnb-kse-sep-enable-check");
  check("GOLD STEM: turned off, no stem is drawn and the sharing choice is hidden",
    (await canvasStems()).length === 0 && (await page.$$(".cnb-kse-sep-share")).length === 0);
  await page.check(".cnb-kse-sep-enable-check");
}

// Looks: size, shape, fill and colour, each set and cleared.
await pickLayer("all");
await setField(page, '.cnb-kse-look-card[data-look="all"] .cnb-kse-look-height', "1.5");
{
  const r = await canvasDraws(C_MAJOR_KEY, "small marks");
  check("LOOKS: all marks 1.5 semitones tall (the width keeping the notehead's proportions) — drawn so, and no key's marks touch",
    r.cfg.keys.keySignature.looks.all.heightSemis === 1.5 && r.cfg.keys.keySignature.looks.all.widthSemis > 1.5 && r.ok &&
    !(await page.$(".cnb-kse-touch-list")) && CNBKeySignature.touchingKeys(r.cfg).length === 0 &&
    (await page.textContent('.cnb-kse-look-card[data-look="all"] .cnb-kse-look-words')).includes("1.5"), r.detail);
}
await page.click('.cnb-kse-look-card[data-look="all"] .cnb-kse-look-shape[data-shape="kite-up"]');
{
  const r = await canvasDraws(C_MAJOR_KEY, "kite marks");
  const kite = r.cfg.shapes["kite-up"];
  check("LOOKS: a built-in shape the notation lacked (Kite up) is added to it and given to all marks, which draw with it",
    r.cfg.keys.keySignature.looks.all.shape === "kite-up" && !!kite && r.ok &&
    await page.$$eval(".cnb-pvd-preview .cnb-key-signature > g > path:first-child",
      (ps, d) => ps.length > 0 && ps.every(p => p.getAttribute("d") === d), kite.svgPath), r.detail);
}
await page.click('.cnb-kse-look-card[data-look="all"] .cnb-kse-look-shape[data-shape=""]');
check("LOOKS: 'as the noteheads' clears the shape",
  !("shape" in (await fullConfig()).keys.keySignature.looks.all));
await pickKey("D", "major");
await pickLayer("sharp");
await page.click('.cnb-kse-look-card[data-look="sharp"] .cnb-kse-look-fill[data-fill="hollow"]');
{
  const r = await canvasDraws(D_MAJOR_KEY, "hollow sharps");
  const hollow = await page.$$eval(".cnb-pvd-preview .cnb-key-signature > g",
    gs => gs.filter(g => [...g.querySelectorAll(":scope > path")].some(p => p.getAttribute("fill") === "white")).length);
  check("LOOKS: hollow sharps — D major's F♯ and C♯ draw hollow, the others solid",
    r.cfg.keys.keySignature.looks.sharp.hollow === true && r.ok && hollow === 2, `${r.detail} hollow=${hollow}`);
}
await page.click('.cnb-kse-look-card[data-look="sharp"] .cnb-kse-look-fill[data-fill=""]');
await pickLayer("alternate");
await setField(page, '.cnb-kse-look-card[data-look="alternate"] .cnb-kse-look-colour-input', "#cc79a7");
{
  const live = await fullConfig();
  const picked = CNBPreviewDisplay.withKey(live, D_MAJOR_KEY);
  const sig = CNBKeySignature.marks(picked.config, picked.config.keys.definitions.find(d => d.name === picked.name));
  const want = sig.marks.filter(mk => mk.mark.color === "#cc79a7").length;
  const got = await page.$$eval(".cnb-pvd-preview .cnb-key-signature > g > path:first-child",
    ps => ps.filter(p => p.getAttribute("fill") === "#cc79a7").length);
  check("LOOKS: every second stack in puce — those marks draw puce, the others not",
    live.keys.keySignature.alternate.color === "#cc79a7" && want > 0 && got === want && got < sig.marks.length, `drawn ${got}, wanted ${want}`);
}
await page.click('.cnb-kse-look-card[data-look="alternate"] .cnb-kse-look-colour[data-color=""]');
cfg = await fullConfig();
check("LOOKS: 'as all marks' and 'as the others' clear the sharps' fill and the second stacks' colour",
  !("hollow" in cfg.keys.keySignature.looks.sharp) && !("color" in cfg.keys.keySignature.alternate));
await pickKey("C", "major");

// Place.
{
  const counts = {};
  for (const value of ["bottom-set", "top-set", "every-set", "middle"]) {
    await radio("cnb-kse-position", value);
    const r = await canvasDraws(C_MAJOR_KEY, value);
    counts[value] = r.got.length;
    check(`PLACE: ${value} — written and drawn as the Node-side renderer draws it`,
      r.cfg.keys.keySignature.placement.position === value && r.ok, r.detail);
  }
  check("PLACE: on every line set the signature repeats, more marks than in the middle",
    counts["every-set"] > counts.middle, JSON.stringify(counts));
}
cfg = await fullConfig();
// The panel and the canvas at the page's two widths, a look open.
await pickLayer("all");
for (const [width, height] of [[1440, 900], [1280, 800]]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOT_DIR, `uat-050-panel-${width}.png`), fullPage: true });
}
await page.setViewportSize({ width: 1600, height: 1800 });
await page.waitForTimeout(150);

// ── STEP 5b: sharps or flats (session 51, key-signature design §5) ─────────
// Draw: Sharps or flats hides the scale-note rows and keeps Place; for C, a
// sharp key and a flat key, in the middle, on the bottom line set and on
// every line set, the canvas draws exactly the signs the Node-side renderer
// draws for the live config; the export carries them; and the key's notes
// come back with the settings they had.
const BF_MAJOR_KEY = { tonic: 10, mode: "major", spelling: "B♭" };
/** The canvas's signs: each path's class, transform and outline. */
const canvasSigns = () => page.$$eval(".cnb-pvd-preview .cnb-key-signature > path.cnb-key-signature-sign",
  els => els.map(e => ({ transform: e.getAttribute("transform"), d: e.getAttribute("d"), fill: e.getAttribute("fill") })));
/** The Node-side renderer's signs for the live config and a key, on the canvas's grid. */
function expectedSigns(cfg, key) {
  const picked = CNBPreviewDisplay.withKey(cfg, key);
  const shown = drawn(picked.config);
  return withSvgStub(svg => {
    const grid = CNBGrid.create(shown, CNBCollection.gridRange(FULL_ROW, shown, ["crotchet"], picked.name));
    const g = CNBKeySignature.render(svg, grid, shown, picked.name);
    return (g ? g.children : []).map(p => ({ transform: p.getAttribute("transform"), d: p.getAttribute("d"), fill: p.getAttribute("fill") }));
  });
}
const numbers = (t) => (t.match(/-?[\d.]+(e[-+]?\d+)?/gi) || []).map(Number);
const signsMatch = (got, want) => got.length === want.length && got.every((s, i) =>
  s.d === want[i].d && s.fill === want[i].fill &&
  numbers(s.transform).every((v, j) => close(v, numbers(want[i].transform)[j])));

// The whole config before Sharps or flats: the Draw row is a starting point
// (session 54, design §13.2), so it is loaded back afterwards.
const before51Full = await fullConfig();
const before51 = JSON.parse(JSON.stringify(before51Full.keys.keySignature));
await startFrom("traditional");
cfg = await fullConfig();
{
  const ks = cfg.keys.keySignature;
  check("START FROM: Traditional sharps and flats, confirmed, sets the traditional starting point (session 54) — the sharps or flats only, Emmentaler's signs with no colour, the cycle of fifths in a window, the middle of the staff, the other looks and every second stack cleared, Show kept, no style",
    !("style" in ks) && ks.enabled === true && ks.notes === "altered" && ks.stacking === "fifths" && ks.heights === "window" &&
    ks.placement.position === "middle" && JSON.stringify(ks.alternate) === "{}" &&
    JSON.stringify(ks.looks) === JSON.stringify({ all: {}, natural: {}, flat: { sign: "flat", color: null },
      sharp: { sign: "sharp", color: null }, line: {}, space: {}, spelled: {} }), JSON.stringify(ks));
}
check("START FROM: the rows stay — Notes shows the sharps or flats only, Stacks the cycle of fifths with its heights in a window, and Place",
  cfg.keys.keySignature.notes === "altered" &&
  await page.evaluate(() => JSON.stringify([...document.querySelectorAll(".cnb-kse-signature .cnb-kse-row-label")]
    .map(e => e.textContent)) === JSON.stringify(["Notes", "Stacks", "Place"]) &&
    document.querySelector('.cnb-kse-notes-choice .cnb-kse-radio[data-value="altered"] input').checked &&
    document.querySelector('.cnb-kse-stacking .cnb-kse-radio[data-value="fifths"] input').checked &&
    document.querySelector('.cnb-kse-heights-choice .cnb-kse-radio[data-value="window"] input').checked));
await pickLayer("sharp");
check("SIZE: the sharps' look card shows the signs' one size, automatic by default at the rule's size for the default staff, 2.72 semitones, and Place's hint no longer names the half steps",
  cfg.keys.keySignature.signs.heightSemis === null &&
  await page.evaluate(() => {
    const auto = document.querySelector(".cnb-kse-look-card .cnb-kse-sign-size-auto");
    const hint = document.querySelector(".cnb-kse-place .cnb-kse-hint").textContent;
    return auto && auto.classList.contains("on") && auto.textContent === "Automatic (2.72)" &&
      document.querySelector(".cnb-kse-sign-size").value === "2.72" && !hint.includes("half steps");
  }));
for (const [key, label, signs] of [[C_MAJOR_KEY, "C major", 0], [D_MAJOR_KEY, "D major", 2], [BF_MAJOR_KEY, "B♭ major", 2]]) {
  await pickKey(key.spelling, key.mode);
  for (const place of ["middle", "bottom-set", "every-set"]) {
    await radio("cnb-kse-position", place);
    const live = await fullConfig();
    const got = await canvasSigns();
    const want = expectedSigns(live, key);
    const copies = place === "every-set" ? 2 : 1;
    check(`DRAW: ${label}, ${place} — ${signs * copies} ${key.spelling === "B♭" ? "flats" : "sharps"}, black, drawn as the Node-side renderer draws them, and no noteheads, ledgers or gold stems`,
      signsMatch(got, want) && got.length === signs * copies && got.every(s => s.fill === "#000000") &&
      (await renderedMarks()).length === 0 && (await canvasStems()).length === 0 &&
      (await page.$$(".cnb-pvd-preview .keysig-col .cnb-ledger-set line, .cnb-pvd-preview .keysig-col .cnb-ledger-set rect")).length === 0,
      `actual=${JSON.stringify(got.map(s => s.transform))} expected=${JSON.stringify(want.map(s => s.transform))}`);
  }
}
{
  const ly = CNBLilypond.generate(await fullConfig());
  const table = ly.slice(ly.indexOf("#(define cnb:keysig-marks"));
  const marks = table.slice(0, table.indexOf("\n\n"));
  // On every line set, the last place drawn, each copy has its own window
  // (session 54): the bottom set's 0–11 and the top set's 12–23.
  check("DRAW: the export carries the signs through the mark table, at their scale — D major's (6 0 sharp 0.6473) (1 1 sharp 0.6473) (18 0 sharp 0.6473) (13 1 sharp 0.6473), each line set's window, and B♭ major's flats, no heads",
    ly.includes("cnb:keysig-style 'marks") &&
    /\(marks \(6 0 sharp 0\.6473\)\s+\(1 1 sharp 0\.6473\)\s+\(18 0 sharp 0\.6473\)\s+\(13 1 sharp 0\.6473\)/.test(marks) &&
    /\(-?\d+ 0 flat 0\.6473\)/.test(marks) && !/ head /.test(marks), marks.slice(0, 600));
}
// Size set by hand (session 52): 5 semitones between a sharp's bars.
{
  await pickKey("D", "major");
  await radio("cnb-kse-position", "middle");
  const auto = await canvasSigns();
  await page.evaluate(() => {
    const input = document.querySelector(".cnb-kse-sign-size");
    input.value = "5";
    input.dispatchEvent(new Event("change"));
  });
  const live = await fullConfig();
  const got = await canvasSigns();
  const want = expectedSigns(live, D_MAJOR_KEY);
  const scale = s => numbers(s.transform)[2];
  check("SIZE: 5 semitones typed by hand is written, and the canvas redraws its sharps at that size as the Node-side renderer draws them",
    live.keys.keySignature.signs.heightSemis === 5 && signsMatch(got, want) && got.length === 2 &&
    close(scale(got[0]) / scale(auto[0]), 5 / 2.724) &&
    await page.evaluate(() => !document.querySelector(".cnb-kse-sign-size-auto").classList.contains("on")),
    `actual=${JSON.stringify(got.map(s => s.transform))} expected=${JSON.stringify(want.map(s => s.transform))}`);
  const ly = CNBLilypond.generate(live);
  check("SIZE: the export writes the hand-set size as each sign's scale, (6 0 sharp 1.1882)", /\(marks \(6 0 sharp 1\.1882\)/.test(ly));
  await openSection(page, "ks-custom-symbols");
  await page.click(".cnb-kse-sign-size-auto");
  const back = await fullConfig();
  check("SIZE: Automatic again writes null and the canvas draws the automatic size",
    back.keys.keySignature.signs.heightSemis === null && signsMatch(await canvasSigns(), auto));
}
const setSize = (v) => page.evaluate((value) => {
  const input = document.querySelector(".cnb-kse-sign-size");
  input.value = value;
  input.dispatchEvent(new Event("change"));
}, v);
// The panel and the canvas with sharps, at the page's two widths: at the
// automatic size, and at 5 semitones set by hand (session 52).
await pickKey("D", "major");
await openSection(page, "ks-custom-symbols");
for (const [width, height] of [[1440, 900], [1280, 800]]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOT_DIR, `uat-052-signs-auto-${width}.png`), fullPage: true });
  await setSize("5");
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOT_DIR, `uat-052-signs-5-${width}.png`), fullPage: true });
  await page.click(".cnb-kse-sign-size-auto");
}
await page.setViewportSize({ width: 1600, height: 1800 });
await page.waitForTimeout(150);
await radio("cnb-kse-position", "middle");
// The window's zigzag (session 54, design §13.5): C♯ major's seven sharps in
// the octave around the staff's middle, 6–17, a fifth up or a fourth down
// each, not climbing from the tonic as session 51 drew them.
const CS_MAJOR_KEY = { tonic: 1, mode: "major", spelling: "C♯" };
{
  await pickKey("C♯", "major");
  const live = await fullConfig();
  const picked = CNBPreviewDisplay.withKey(live, CS_MAJOR_KEY);
  const sig = CNBKeySignature.marks(picked.config, CNBKeySignature.activeKey(picked.config, picked.name).def);
  const got = await canvasSigns();
  const want = expectedSigns(live, CS_MAJOR_KEY);
  check("DRAW: the window's zigzag — C♯ major's sharps on semitones 6 13 8 15 10 17 12, one to a column, drawn as the Node-side renderer draws them",
    JSON.stringify(sig.marks.map(m => [m.semi, m.column])) === JSON.stringify([[6, 0], [13, 1], [8, 2], [15, 3], [10, 4], [17, 5], [12, 6]]) &&
    signsMatch(got, want) && got.length === 7,
    `semis=${JSON.stringify(sig.marks.map(m => m.semi))} actual=${JSON.stringify(got.map(s => s.transform))}`);
  for (const [width, height] of [[1440, 900], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOT_DIR, `uat-054-window-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1600, height: 1800 });
  await page.waitForTimeout(150);
}
await startFrom("noteheads");
await pickKey("C", "major");
{
  const r = await canvasDraws(C_MAJOR_KEY, "the key's notes again");
  const after = (await fullConfig()).keys.keySignature;
  check("START FROM: The noteheads, confirmed, sets the defaults, Show kept, and the canvas draws the noteheads as the Node-side renderer does",
    JSON.stringify(after) === JSON.stringify({ ...CNBConfig.createDefault().keys.keySignature, enabled: true }) &&
    r.ok && (await canvasSigns()).length === 0 &&
    await page.evaluate(() => JSON.stringify([...document.querySelectorAll(".cnb-kse-signature .cnb-kse-row-label")]
      .map(e => e.textContent)) === JSON.stringify(["Notes", "Stacks", "Place"])),
    `${r.detail} after=${JSON.stringify(after)}`);
}
/** Load a config as a file, and wait for the shell to adopt it. */
async function loadConfig(json, name, adopted) {
  await page.setInputFiles("#open-file", { name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(json), "utf8") });
  await page.waitForFunction(adopted, null, { timeout: 10000 });
}
// A config saved with session 51's style "accidentals" loads as the one
// model, its signs drawn where session 51 drew them: climbing from the tonic.
{
  const saved = JSON.parse(JSON.stringify(before51Full));
  saved.keys.keySignature = { ...saved.keys.keySignature, style: "accidentals" };
  for (const field of ["heights", "window"]) delete saved.keys.keySignature[field];
  delete saved.keys.keySignature.looks.natural;
  delete saved.keys.keySignature.looks.line;
  delete saved.keys.keySignature.looks.space;
  await loadConfig(saved, "saved-accidentals.cnb.json",
    () => JSON.parse(document.querySelector("#state-json").textContent).keys.keySignature.notes === "altered");
  await pickKey("C♯", "major");
  const live = await fullConfig();
  const ks = live.keys.keySignature;
  const picked = CNBPreviewDisplay.withKey(live, CS_MAJOR_KEY);
  const sig = CNBKeySignature.marks(picked.config, CNBKeySignature.activeKey(picked.config, picked.name).def);
  const got = await canvasSigns();
  check("LOAD: a config saved with the style \"accidentals\" loads as the sharps or flats only, black signs and the cycle of fifths climbing, no style — C♯ major's sharps at 6 1 8 3 10 5 12, as session 51 drew them, and the canvas matches",
    !("style" in ks) && ks.notes === "altered" && ks.stacking === "fifths" && ks.heights === "scale" &&
    JSON.stringify(sig.marks.map(m => m.semi)) === JSON.stringify([6, 1, 8, 3, 10, 5, 12]) &&
    signsMatch(got, expectedSigns(live, CS_MAJOR_KEY)) && got.length === 7 && got.every(s => s.fill === "#000000") &&
    await page.evaluate(() => !!document.querySelector(".cnb-kse-notes-choice .cnb-kse-radio.on[data-value=\"altered\"]")),
    `${JSON.stringify(ks)} semis=${JSON.stringify(sig.marks.map(m => m.semi))}`);
}
// The settings of STEP 5 back, as a config saved with the style
// "notehead-chords", which loads as it was.
{
  const saved = JSON.parse(JSON.stringify(before51Full));
  saved.keys.keySignature = { style: "notehead-chords", ...saved.keys.keySignature };
  await loadConfig(saved, "saved-noteheads.cnb.json",
    () => JSON.parse(document.querySelector("#state-json").textContent).keys.keySignature.notes !== "altered");
  await pickKey("C", "major");
  const r = await canvasDraws(C_MAJOR_KEY, "loaded noteheads");
  const after = (await fullConfig()).keys.keySignature;
  check("LOAD: a config saved with the style \"notehead-chords\" loads with no style and every setting as saved, and the canvas draws its noteheads as the Node-side renderer does",
    JSON.stringify(after) === JSON.stringify(before51) && r.ok,
    `${r.detail} before=${JSON.stringify(before51)} after=${JSON.stringify(after)}`);
}
cfg = await fullConfig();

// ── STEP 5c: the key-signature editor (session 56, design §13.8) ────────────
// Each drag and choice of the editor, made with the pointer and the panel's
// controls as a designer makes them; the config is loaded back afterwards,
// since STEP 7 saves the settings of STEP 5.
const before56 = await fullConfig();
await startFrom("noteheads");
await pickKey("D", "major");
await openSection(page, "ks-custom-symbols");
/** D major's marks as the panel's canvas draws them, by pitch class. */
async function dMajorMarks() {
  const live = await fullConfig();
  const picked = CNBPreviewDisplay.withKey(live, D_MAJOR_KEY);
  return CNBKeySignature.marks(picked.config, CNBKeySignature.activeKey(picked.config, picked.name).def).marks;
}
const fsharp = (await dMajorMarks()).findIndex(m => ((m.semi % 12) + 12) % 12 === 6);
/** A mark's base on the panel's canvas, scrolled into view: its centre. */
async function markCentre(index) {
  const loc = page.locator(`${PANEL.symbols} .cnb-kse-canvas [data-mark="${index}"][data-symbol="0"] path`).first();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
/** A pointer drag on the page by (dx, dy) px from a point. */
async function dragBy(from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 3 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 3 });
  const readout = await page.evaluate(() => document.querySelector(".cnb-kse-readout")?.textContent ?? null);
  await page.mouse.up();
  return readout;
}
const cardLook = () => page.$eval(".cnb-kse-look-card", e => e.getAttribute("data-look"));
const undo = () => page.click("#undo-config");
const redo = () => page.click("#redo-config");
{
  const info = await page.evaluate(() => {
    const box = document.querySelector('[data-panel="ks-custom-symbols"] .cnb-kse-canvas');
    return { marks: new Set([...box.querySelectorAll("[data-mark]")].map(e => e.getAttribute("data-mark"))).size,
      maxHeight: getComputedStyle(box).maxHeight, height: box.getBoundingClientRect().height };
  });
  check("EDITOR: the canvas draws the picked key's signature magnified, D major's eight marks, its height capped at 360 px",
    info.marks === (await dMajorMarks()).length && info.marks === 8 && info.maxHeight === "360px" && info.height <= 361,
    JSON.stringify(info));
}
{
  const seen = [];
  for (const layer of ["all", "natural", "flat", "sharp", "line", "space", "alternate"]) {
    await pickLayer(layer);
    seen.push([await cardLook(), await page.textContent(".cnb-kse-look-scope")]);
  }
  check("EDITOR: each of Edit's seven layers opens its look card, which says it edits that category in every key",
    seen.every(([look, scope], i) => look === ["all", "natural", "flat", "sharp", "line", "space", "alternate"][i] &&
      scope.endsWith("in every key")) && seen[2][1] === "Edits all flats in every key", JSON.stringify(seen));
}
// A click selects the mark's spelling, unless a layer is picked.
await pickLayer("natural");
await page.mouse.click(...Object.values(await markCentre(fsharp)));
const clickedSharp = await cardLook();
await pickLayer("space");
await page.mouse.click(...Object.values(await markCentre(fsharp)));
check("EDITOR: a click on F♯ selects the sharps, and with In a space picked in Edit it stays on the spaces; a click writes nothing",
  clickedSharp === "sharp" && (await cardLook()) === "space" &&
  JSON.stringify((await fullConfig()).keys.keySignature) === JSON.stringify({ ...CNBConfig.createDefault().keys.keySignature, enabled: true }));
// A drag moves every sharp, snapped, one step of undo.
await pickLayer("sharp");
{
  const readout = await dragBy(await markCentre(fsharp), 37, -14);
  const after = (await fullConfig()).keys.keySignature.looks.sharp;
  check("EDITOR: dragging F♯ 37 px right and 14 px up moves every sharp by x 1.5, y 0.6 semitones, snapped to tenths, the values shown beside the handle while dragging, and the field shows them",
    JSON.stringify(after.offset) === JSON.stringify({ x: 1.5, y: 0.6 }) && readout && readout.includes("offset x 1.5 y 0.6") &&
    (await page.inputValue(".cnb-kse-look-card .cnb-kse-look-offset-x")) === "1.5", `${JSON.stringify(after)} readout=${readout}`);
  await undo();
  const undone = (await fullConfig()).keys.keySignature.looks.sharp;
  await redo();
  const redone = (await fullConfig()).keys.keySignature.looks.sharp;
  check("EDITOR: one drag is one step of undo — Undo puts the sharps back, Redo moves them again",
    !("offset" in undone) && JSON.stringify(redone.offset) === JSON.stringify({ x: 1.5, y: 0.6 }),
    `${JSON.stringify(undone)} ${JSON.stringify(redone)}`);
  await setField(page, ".cnb-kse-look-card .cnb-kse-look-offset-y", "-0.5");
  check("EDITOR: the offset's y field writes the same number the drag does",
    JSON.stringify((await fullConfig()).keys.keySignature.looks.sharp.offset) === JSON.stringify({ x: 1.5, y: -0.5 }));
  await page.click(".cnb-kse-look-card .cnb-kse-look-offset-as");
}
// The corner handle sizes the sharps; a sign's sizes both signs.
{
  await page.mouse.click(...Object.values(await markCentre(fsharp)));
  const handle = page.locator(`${PANEL.symbols} .cnb-kse-canvas .cnb-kse-handle`);
  await handle.scrollIntoViewIfNeeded();
  const hb = await handle.boundingBox();
  await dragBy({ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, 0, 24);
  const look = (await fullConfig()).keys.keySignature.looks.sharp;
  const shape = before56.shapes["crotchet-minim"];
  check("EDITOR: dragging the corner handle 24 px down makes the sharps a semitone taller, 2.724 to 3.7, snapped, the width in proportion",
    look.heightSemis === 3.7 && Math.abs(look.widthSemis - 3.7 * shape.naturalWidth / shape.naturalHeight) < 1e-3, JSON.stringify(look));
  await undo();
  await page.click('.cnb-kse-look-card .cnb-kse-look-sign[data-sign="sharp"]');
  const live = await fullConfig();
  const auto = CNBKeySignature.signHeight(live).semis;
  await page.mouse.click(...Object.values(await (async () => {
    const loc = page.locator(`${PANEL.symbols} .cnb-kse-canvas [data-mark="${fsharp}"][data-symbol="0"]`);
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  })()));
  await handle.scrollIntoViewIfNeeded();
  // The selection is where the sign is drawn (round 1 of verification): the
  // focused box encloses the drawn sharp's outline, the handle on its corner.
  const placed = await page.evaluate((i) => {
    const svg = document.querySelector(".cnb-kse-canvas svg");
    const sign = document.querySelector(`.cnb-kse-canvas [data-mark="${i}"][data-symbol="0"]`).getBoundingClientRect();
    const box = document.querySelector(".cnb-kse-canvas .cnb-kse-instance.focus").getBoundingClientRect();
    const h = document.querySelector(".cnb-kse-canvas .cnb-kse-handle").getBoundingClientRect();
    return { finite: [svg.width.baseVal.value, svg.height.baseVal.value].every(v => Number.isFinite(v) && v > 0),
      sign: [sign.left, sign.top, sign.right, sign.bottom], box: [box.left, box.top, box.right, box.bottom],
      handle: [(h.left + h.right) / 2, (h.top + h.bottom) / 2] };
  }, fsharp);
  check("EDITOR: with a sign selected the canvas is finite, the focused box encloses the drawn sharp (within 1.5 px) and the handle is on its corner",
    placed.finite && placed.sign.every((v, j) => Math.abs(v - placed.box[j]) <= 1.5) &&
    Math.abs(placed.handle[0] - placed.box[2]) <= 1.5 && Math.abs(placed.handle[1] - placed.box[3]) <= 1.5,
    JSON.stringify(placed));
  const sb = await handle.boundingBox();
  await dragBy({ x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 }, 0, 24);
  const ks = (await fullConfig()).keys.keySignature;
  check("EDITOR: with the sharps Emmentaler's sharp, the handle sets the signs' one size, a semitone more than the automatic size, and the card shows it set by hand",
    ks.looks.sharp.sign === "sharp" && ks.signs.heightSemis === Math.round((auto + 1) * 10) / 10 &&
    !(await page.$eval(".cnb-kse-look-card .cnb-kse-sign-size-auto", e => e.classList.contains("on"))),
    `${JSON.stringify(ks.signs)} auto=${auto}`);
}
// Added symbols.
{
  await page.click(".cnb-kse-look-card .cnb-kse-look-add");
  await page.click('.cnb-kse-look-card .cnb-kse-look-shape[data-shape="kite-up"]');
  const added = (await fullConfig()).keys.keySignature.looks.sharp.added;
  const selected = await page.$eval('.cnb-kse-look-card .cnb-kse-look-select.on', e => e.textContent);
  const drawnAdded = await page.$$eval(`${PANEL.symbols} .cnb-kse-canvas [data-symbol="1"]`, els => els.length);
  check("EDITOR: + Add a symbol adds one to the sharps, selected as Added 1, its shape chosen in the card, drawn over each sharp",
    added.length === 1 && added[0].shape === "kite-up" && selected === "Added 1" && drawnAdded === 2, JSON.stringify(added));
  // Dragging the added symbol moves it alone, by its own offset, one step of undo.
  const extra = page.locator(`${PANEL.symbols} .cnb-kse-canvas [data-mark="${fsharp}"][data-symbol="1"] path`).first();
  await extra.scrollIntoViewIfNeeded();
  const eb = await extra.boundingBox();
  await dragBy({ x: eb.x + eb.width / 2, y: eb.y + eb.height / 2 }, 12, 0);
  const moved = (await fullConfig()).keys.keySignature.looks.sharp;
  await undo();
  const back = (await fullConfig()).keys.keySignature.looks.sharp;
  check("EDITOR: dragging F♯'s added symbol 12 px right moves it alone by x 0.5 semitones, the base's offset untouched, and one Undo puts it back",
    JSON.stringify(moved.added[0].offset) === JSON.stringify({ x: 0.5, y: 0 }) && !("offset" in moved) &&
    !("offset" in back.added[0]) && back.added[0].shape === "kite-up", `${JSON.stringify(moved)} ${JSON.stringify(back)}`);
  await page.click('.cnb-kse-look-card .cnb-kse-look-remove[data-symbol="0"]');
  const removed = (await fullConfig()).keys.keySignature.looks.sharp;
  await page.click(".cnb-kse-look-card .cnb-kse-look-added-as");
  check("EDITOR: × removes it, leaving no added symbols, and 'Added symbols as all marks' clears the field",
    JSON.stringify(removed.added) === "[]" && !("added" in (await fullConfig()).keys.keySignature.looks.sharp));
}
// Import from SVG for the flats: its reference point and its ledgers.
{
  await pickLayer("flat");
  await page.setInputFiles(".cnb-kse-look-card .cnb-kse-look-import input[type=file]",
    path.join(ROOT, "cnb", "assets", "examples", "gallery", "clairnote-symbols", "clairnote-tail-up.svg"));
  await page.waitForSelector(".cnb-kse-reference-picker");
  let live = await fullConfig();
  const name = live.keys.keySignature.looks.flat.shape;
  const shape = live.shapes[name];
  const opened = { name, reference: shape && shape.reference, ledgers: shape && shape.ledgers,
    box: await page.isChecked(".cnb-kse-takes-ledgers-check") };
  await page.locator(".cnb-kse-reference-svg").click({ position: { x: 30, y: 30 } });
  live = await fullConfig();
  const moved = live.shapes[name].reference;
  await page.check(".cnb-kse-takes-ledgers-check");
  const takes = (await fullConfig()).shapes[name];
  await page.uncheck(".cnb-kse-takes-ledgers-check");
  await page.click(".cnb-kse-reference-done");
  check("IMPORT: a symbol imported for flats is given to them with its reference point at the SVG's origin and no ledger lines; a click moves the point, Takes ledger lines sets them, Done closes the picker",
    !!shape && JSON.stringify(opened.reference) === JSON.stringify({ x: 0, y: 0 }) && opened.ledgers === false && opened.box === false &&
    (moved.x !== 0 || moved.y !== 0) && !("ledgers" in takes) &&
    (await fullConfig()).shapes[name].ledgers === false && !(await page.$(".cnb-kse-reference-picker")),
    JSON.stringify({ opened, moved }));
}
// The key picker and the other keys.
{
  await setField(page, ".cnb-kse-key-tonic", "B♭");
  const staff = await page.inputValue(".cnb-pvd-key-tonic");
  const minis = await page.$$eval(".cnb-kse-mini", els => els.map(e => e.getAttribute("data-key")));
  await openSection(page, "ks-preview");
  await page.click('.cnb-kse-mini[data-key="A"]');
  check("KEYS: step 7's key picker picks the staff's key (B♭), the mode's 15 keys show in step 9, sharp keys then flat keys, and a click on A picks it on the staff and in steps 7 and 8",
    staff === "B♭" && minis.length === 15 && minis[0] === "C" && minis[8] === "F" &&
    (await page.inputValue(".cnb-pvd-key-tonic")) === "A" && (await page.inputValue(`${PANEL.symbols} .cnb-kse-key-tonic`)) === "A" &&
    (await page.inputValue(`${PANEL.designer} .cnb-kse-key-tonic`)) === "A", JSON.stringify(minis));
}
// The touch line, its list and the checks' warning.
{
  await startFrom("noteheads");
  await radio("cnb-kse-stacking", "parity");
  const live = await fullConfig();
  const n = CNBKeySignature.touchingKeys(live).length;
  await openSection(page, "ks-preview");
  await page.click(".cnb-kse-touch-list summary");
  const listed = await page.$$eval(".cnb-kse-touch-key", els => els.length);
  await page.click('.cnb-kse-touch-key[data-key="E major"]');
  check("TOUCH: under odd semitones left, even right the marks touch in every key; the line opens their list, and a click on E major picks it",
    n === 105 && listed === 105 && (await page.inputValue(".cnb-pvd-key-tonic")) === "E" &&
    (await page.inputValue(".cnb-pvd-key-mode")) === "major", `touching ${n}, listed ${listed}`);
  await page.click("#checks-indicator");
  const warning = await page.$$eval("#checks-list .checks-item.warn", els => els.map(e => e.textContent));
  await page.keyboard.press("Escape");
  check("TOUCH: the checks list warns 'Marks touch in 105 keys.', and the export is not blocked",
    warning.some(t => t.includes("Marks touch in 105 keys.")) &&
    CNBConfigExport.validateForExport(live).valid, JSON.stringify(warning));
}
// Start from, cancelled, changes nothing.
{
  const was = JSON.stringify((await fullConfig()).keys.keySignature);
  await startFrom("traditional", false);
  check("START FROM: cancelled, the signature's settings stay as they were",
    JSON.stringify((await fullConfig()).keys.keySignature) === was);
}
// The editor at the page's two widths: D major's sharps picked.
await radio("cnb-kse-stacking", "degrees");
await pickKey("D", "major");
await pickLayer("sharp");
for (const [width, height] of [[1440, 900], [1280, 800]]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOT_DIR, `uat-056-editor-${width}.png`), fullPage: true });
  check(`EDITOR ${width}: the editor does not make the page scroll sideways`,
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
}
await page.setViewportSize({ width: 1600, height: 1800 });
await page.waitForTimeout(150);
// STEP 5's settings back, for STEP 7's save.
await page.setInputFiles("#open-file", { name: "before-editor.cnb.json", mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(before56), "utf8") });
await page.waitForFunction((want) => JSON.stringify(JSON.parse(document.querySelector("#state-json").textContent).keys) === want,
  JSON.stringify(before56.keys), { timeout: 10000 });
await pickKey("C", "major");
cfg = await fullConfig();

// ── STEP 6: clef composition (set-009 gutter, left to right) ────────────────
await openSection(page, "clef-symbol");
await page.setInputFiles(".cnb-cle-file", {
  name: "uat-clef.svg", mimeType: "image/svg+xml",
  buffer: Buffer.from(SAMPLE_CLEF_SVG, "utf8"),
});
await page.waitForFunction(() =>
  document.querySelector(".cnb-cle-import-status").textContent.includes("uat-clef"));
await page.check(".cnb-cle-enable-check");
cfg = await fullConfig();
check("COMPOSITION: clef enabled — the preview row is clef-col, then keysig-col, then the 13 cards (clef first, key signature second, left to right)",
  cfg.clef.enabled === true &&
  await page.evaluate(() => {
    // The label strip (session 28) leads the row, outside the staff; the
    // clef and key signature follow it.
    const all = [...document.querySelectorAll(".cnb-pvd-preview .pc-columns > div")];
    const cols = all.filter(c => !c.className.includes("label-col"));
    return all[0].className.includes("label-col") && cols.length === 15 &&
      cols[0].className.includes("clef-col") &&
      cols[1].className.includes("keysig-col") &&
      cols.slice(2).every(c => c.className.includes("pc-col"));
  }));
expected = expectedMarks(cfg, "C");
actual = await renderedMarks();
check("COMPOSITION: the keysig marks sit in their own column 3.5 staff spaces after the clef glyph's left edge, as the engine spaces them (Node-side CNBKeySignature.padding)",
  expected && marksMatch(actual, expected));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-with-clef.png"), fullPage: true });

// ── STEP 7: save the config (Module 17, real download) ──────────────────────
const [saveDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click("#save-config"),
]);
const savedPath = path.join(SHOT_DIR, "uat-010-s2-saved.cnb.json");
await saveDownload.saveAs(savedPath);
const savedJson = JSON.parse(await readFile(savedPath, "utf8"));
cfg = await fullConfig();
check("SAVE: the shell adopted the stamped config — the live state panel is deep-equal to the downloaded file",
  JSON.stringify(cfg) === JSON.stringify(savedJson));
check("SAVE: the keys section is in the file — enabled, 2 definitions, the signature enabled with the panel's choices (a new stack at each change of parity, to the left in sharp keys, unshared 200% stems in #336699, marks 1.5 semitones tall), the stored extent kept, no gutter setting",
  savedJson.keys.enabled === true &&
  savedJson.keys.definitions.length === 2 &&
  savedJson.keys.definitions[1].name === "D Dorian" &&
  savedJson.keys.keySignature.enabled === true &&
  !("style" in savedJson.keys.keySignature) &&
  savedJson.keys.keySignature.stacking === "parity-stacks" &&
  savedJson.keys.keySignature.columns === "left-in-sharp-keys" &&
  savedJson.keys.keySignature.separator.shareThickness === false &&
  savedJson.keys.keySignature.separator.thicknessPct === 200 &&
  savedJson.keys.keySignature.separator.color === "#336699" &&
  savedJson.keys.keySignature.separator.extentSemis === 12 &&
  savedJson.keys.keySignature.looks.all.heightSemis === 1.5 &&
  !("gutter" in savedJson.keys.keySignature),
  JSON.stringify(savedJson.keys));

// ── STEP 8: load the saved config back (Module 17 round trip) ────────────────
await page.setInputFiles("#open-file", savedPath);
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
cfg = await fullConfig();
check("LOAD: round-trip fidelity — the shared config after load is deep-equal to the saved file (fixed-shape keySignature merge, array definitions replace — no default bleed-through)",
  JSON.stringify(cfg) === JSON.stringify(savedJson));
check("LOAD: loaded config reported valid in the IO panel",
  await page.evaluate(() => !!document.querySelector(".cnb-cio-valid")));
await pickLayer("all");
check("LOAD: the key-signature editor re-seeded from the loaded config (master + signature checked, 2 definition rows, its stacking, stems and look)",
  await page.evaluate(() =>
    document.querySelector(".cnb-kse-keys-enable-check").checked &&
    document.querySelector(".cnb-kse-sig-enable-check").checked &&
    document.querySelectorAll(".cnb-kse-def-row").length === 2 &&
    document.querySelector('.cnb-kse-stacking .cnb-kse-radio[data-value="parity-stacks"] input').checked &&
    !document.querySelector(".cnb-kse-sep-share-check").checked &&
    document.querySelector(".cnb-kse-sep-thickness").value === "0.5" &&
    document.querySelector('.cnb-kse-look-card[data-look="all"] .cnb-kse-look-words').textContent.includes("1.5")));
expected = expectedMarks(cfg, "C");
actual = await renderedMarks();
check("LOAD: the preview still renders the key-C signature in its gutter (preview key selection survives the load)",
  (await keysigColCount()) === 1 && expected && marksMatch(actual, expected));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-loaded.png"), fullPage: true });

// ── STEP 9: export a .ly file (Module 18, real download; s1 coordination) ────
const [exportDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.click("#export-ly"),
]);
const exportedPath = path.join(SHOT_DIR, "uat-010-s2-exported.ly");
await exportDownload.saveAs(exportedPath);
const exported = await readFile(exportedPath, "utf8");
cfg = await fullConfig();
let direct = null, directErr = null;
try { direct = CNBLilypond.generate(cfg); } catch (err) { directErr = err.message; }
check("EXPORT PARITY: downloaded .ly is byte-identical to a direct CNBLilypond.generate() call on the same config (run in Node, independent of the browser)",
  direct !== null && direct === exported,
  directErr || `lengths ${exported.length} vs ${direct ? direct.length : "n/a"}`);
// The key signature exports since session 30 (LY spec 1.3.7 §5.6): the
// download leaves the signature on and carries the explicit tonic octave
// set above, and the same config with the signature disabled writes 'none.
const disabledCfg = CNBConfig.clone(cfg);
disabledCfg.keys.keySignature.enabled = false;
const tonicOctave = cfg.keys.keySignature.placement.tonicOctave;
check("EXPORT EMISSION: the keysig-enabled download keeps the signature, as the mark table since the panel's choices are not the scale stack's (LY spec §5.6a), and its tonic octave; with the signature disabled generate() writes 'none",
  direct !== null && !exported.includes("cnb:keysig-style 'none") &&
  exported.includes("#(set! cnb:keysig-style 'marks)") && exported.includes("#(define cnb:keysig-marks") &&
  (!Number.isInteger(tonicOctave) || exported.includes(`#(set! cnb:keysig-tonic-octave ${tonicOctave})`)) &&
  CNBLilypond.generate(disabledCfg).includes("#(set! cnb:keysig-style 'none)"),
  `tonic octave ${tonicOctave}; the key-signature settings are wrong in the export`);
check("EXPORT: valid badge shown, no error rows",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-verror").length === 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-exported.png"), fullPage: true });

// ── STEP 9b: the Clairnote SN gallery file's own signature (sessions 50, 55) ─
await page.setInputFiles("#open-file", path.join(ROOT, "cnb", "assets", "examples", "gallery", "clairnote-sn.json"));
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
await pickKey("D", "major");
{
  const r = await canvasDraws(D_MAJOR_KEY, "Clairnote SN, D major");
  // Since session 55: Clairnote's own signature, a dot for each note, solid
  // on a line or ledger and hollow in a space, and a tail down on each sharp.
  const drawn = await page.$$eval(".cnb-pvd-preview .cnb-key-signature > g:not(.cnb-ledger-set)",
    (gs, [dot, tail]) => ({
      tails: gs.filter(g => g.querySelector("path")?.getAttribute("d") === tail).length,
      dots: gs.filter(g => g.querySelector("path")?.getAttribute("d") === dot).length,
      hollow: gs.filter(g => g.querySelector("path")?.getAttribute("d") === dot && g.querySelectorAll("path").length > 1).length,
    }), [r.cfg.shapes["clairnote-dot"].svgPath, r.cfg.shapes["clairnote-tail-down"].svgPath]);
  check("CLAIRNOTE SN: D major draws as the Node-side renderer draws it — seven dots on the bottom line set, D, E and F♯ solid and G, A, B and C♯ hollow, F♯ and C♯ with a tail down, no gold stem",
    r.ok && drawn.dots === 7 && drawn.hollow === 4 && drawn.tails === 2 && (await canvasStems()).length === 0,
    `${r.detail} ${JSON.stringify(drawn)}`);
  await pickLayer("sharp");
  // Since session 64 the file's six symbols are its spelled looks, which
  // step 7 shows from session 65: read them from the loaded config.
  const spelled = r.cfg.keys.keySignature.looks.spelled || {};
  check("CLAIRNOTE SN: the panel shows the file's choices — a new stack at each change of parity, to the left in sharp keys, no upper tonic, no gold stem, the bottom line set — and its 21 spelled notes their dots, a tail down on C♯",
    await page.evaluate(() => {
      const on = (group, value) => document.querySelector(`.${group} .cnb-kse-radio[data-value="${value}"] input`).checked;
      return on("cnb-kse-stacking", "parity-stacks") && on("cnb-kse-columns", "left-in-sharp-keys") &&
        on("cnb-kse-position", "bottom-set") &&
        !document.querySelector(".cnb-kse-upper-tonic-check").checked &&
        !document.querySelector(".cnb-kse-sep-enable-check").checked;
    }) && Object.keys(spelled).length === 21 && spelled["C♯"].added[0].shape === "clairnote-tail-down",
    JSON.stringify(spelled["C♯"]));
}

// ── STEP 9c: the panel and canvas at the page's two widths ──────────────────
await pickKey("B♭", "major");
await pickLayer("flat");
for (const [width, height] of [[1440, 900], [1280, 800]]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOT_DIR, `uat-056-clairnote-${width}.png`), fullPage: true });
  check(`SCREENSHOT ${width}: step 7 does not make the page scroll sideways`,
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
}

// ── STEP 10: no errors ───────────────────────────────────────────────────────
check("NO console or page errors across the whole key-signature flow", consoleErrors.length === 0,
  consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots + saved/exported files: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
