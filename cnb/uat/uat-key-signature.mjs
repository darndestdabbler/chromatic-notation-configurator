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
 * and place choice, the canvas checked against CNBKeySignature after each,
 * and the overlap note) → Sharps or flats (session 51: C, D and B♭ major in
 * the middle, on the bottom and on every line set, each checked against
 * CNBKeySignature, the export's signs, and the key's notes restored) → clef
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
await openSection(page, "key-signature");

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
  return m.marks
    .filter(({ mark }) => cfg.shapes[mark.shape])
    .map(({ semi, column }) => ({ x: left + (column + 0.5) * m.markWidth, y: grid.semiToY(semi) }));
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
check("DEFAULT-OFF: master toggle unchecked, the explicit disabled note is shown, controls below are disabled (shown, not hidden)",
  await page.evaluate(() =>
    !document.querySelector(".cnb-kse-keys-enable-check").checked &&
    !!document.querySelector(".cnb-kse-disabled-note") &&
    document.querySelector(".cnb-kse-def-add").disabled &&
    document.querySelector(".cnb-kse-sig-enable-check").disabled));
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
await page.check(".cnb-kse-sig-enable-check");
cfg = await fullConfig();
check("ENABLE SIGNATURE: keys.keySignature.enabled true in the shared config, validation still valid",
  cfg.keys.keySignature.enabled === true &&
  await page.evaluate(() => !!document.querySelector(".cnb-key-signature-editor .cnb-kse-valid")));
check("ENABLE SIGNATURE: the picked key's signature draws at once (C major, picked by default; session 36), and the button that turns it on is gone",
  (await keysigColCount()) >= 1 &&
  await page.evaluate(() => !document.querySelector(".cnb-pvd-signature-on")));

// ── STEP 4: the key picked on the staff ─────────────────────────────────────
/** Pick a key and mode in the canvas toolbar (session 36): the tonic by its
 *  spelled name, one of the current mode's 15 (session 48). */
async function pickKey(tonic, mode) {
  await setField(page, ".cnb-pvd-key-tonic", tonic);
  await setField(page, ".cnb-pvd-key-mode", mode);
}
await pickKey("C", "major");
cfg = await fullConfig();
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
/** Choose a radio of one of the panel's rows by its value. */
const radio = (group, value) => page.check(`.${group} .cnb-kse-radio[data-value="${value}"] input`);
/** Open a look's menu (the editor re-mounts on a new key, closing them). */
const openLook = (kind) => page.evaluate((k) => {
  document.querySelector(`.cnb-kse-look[data-look="${k}"]`).open = true;
  document.querySelector(`.cnb-kse-look[data-look="${k}"]`).dispatchEvent(new Event("toggle"));
}, kind);
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

check("PANEL: the signature is set in a designer's words (Show the key signature; Draw, Notes, Stacks, Looks and Place), the key definitions below it under Keys for notehead rules",
  await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".cnb-kse-signature .cnb-kse-row-label")].map(e => e.textContent);
    const sections = [...document.querySelectorAll(".cnb-key-signature-editor > .cnb-kse-section")];
    return JSON.stringify(labels) === JSON.stringify(["Draw", "Notes", "Stacks", "Looks", "Place"]) &&
      document.querySelector(".cnb-kse-sig-enable").textContent === "Show the key signature" &&
      sections[0].classList.contains("cnb-kse-signature") &&
      sections[1].querySelector(".cnb-kse-title").textContent === "Keys for notehead rules";
  }));
check("PANEL: no Marks style, placement-rule, tonic-octave or bar-extent control, and no spacing control or Preview only badge; the stored values are kept",
  await page.evaluate(() =>
    !document.querySelector(".cnb-kse-style-option, .cnb-kse-placement-rule, .cnb-kse-octave-auto-check, .cnb-kse-octave-input, .cnb-kse-sep-extent, .cnb-kse-gutter-input") &&
    document.querySelectorAll(".cnb-key-signature-editor .cnb-badge").length === 0) &&
  cfg.keys.keySignature.style === "notehead-chords" && cfg.keys.keySignature.placement.rule === "scale-from-tonic");

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

// The overlap note: a whole step apart in one stack, the 2.7-semitone notehead runs into the next.
check("OVERLAP: with a new stack at each change of parity, C major's marks run together, and the note says so and points to the looks' size",
  await page.evaluate(() => {
    const note = document.querySelector(".cnb-kse-overlap-note");
    return !!note && note.textContent.includes("run together") && note.textContent.includes("Looks");
  }));

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
await openLook("all");
await setField(page, '.cnb-kse-look[data-look="all"] .cnb-kse-look-height', "1.5");
{
  const r = await canvasDraws(C_MAJOR_KEY, "small marks");
  check("LOOKS: all marks 1.5 semitones tall (the width keeping the notehead's proportions) — drawn so, and the overlap note is gone",
    r.cfg.keys.keySignature.looks.all.heightSemis === 1.5 && r.cfg.keys.keySignature.looks.all.widthSemis > 1.5 && r.ok &&
    !(await page.$(".cnb-kse-overlap-note")) &&
    (await page.textContent('.cnb-kse-look[data-look="all"] .cnb-kse-look-words')).includes("1.5"), r.detail);
}
await page.click('.cnb-kse-look[data-look="all"] .cnb-kse-look-shape[data-shape="kite-up"]');
{
  const r = await canvasDraws(C_MAJOR_KEY, "kite marks");
  const kite = r.cfg.shapes["kite-up"];
  check("LOOKS: a built-in shape the notation lacked (Kite up) is added to it and given to all marks, which draw with it",
    r.cfg.keys.keySignature.looks.all.shape === "kite-up" && !!kite && r.ok &&
    await page.$$eval(".cnb-pvd-preview .cnb-key-signature > g > path:first-child",
      (ps, d) => ps.length > 0 && ps.every(p => p.getAttribute("d") === d), kite.svgPath), r.detail);
}
await page.click('.cnb-kse-look[data-look="all"] .cnb-kse-look-shape[data-shape=""]');
check("LOOKS: 'as the noteheads' clears the shape",
  !("shape" in (await fullConfig()).keys.keySignature.looks.all));
await pickKey("D", "major");
await openLook("sharp");
await page.click('.cnb-kse-look[data-look="sharp"] .cnb-kse-look-fill[data-fill="hollow"]');
{
  const r = await canvasDraws(D_MAJOR_KEY, "hollow sharps");
  const hollow = await page.$$eval(".cnb-pvd-preview .cnb-key-signature > g",
    gs => gs.filter(g => [...g.querySelectorAll(":scope > path")].some(p => p.getAttribute("fill") === "white")).length);
  check("LOOKS: hollow sharps — D major's F♯ and C♯ draw hollow, the others solid",
    r.cfg.keys.keySignature.looks.sharp.hollow === true && r.ok && hollow === 2, `${r.detail} hollow=${hollow}`);
}
await page.click('.cnb-kse-look[data-look="sharp"] .cnb-kse-look-fill[data-fill=""]');
await openLook("alternate");
await setField(page, '.cnb-kse-look[data-look="alternate"] .cnb-kse-look-colour-input', "#cc79a7");
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
await page.click('.cnb-kse-look[data-look="alternate"] .cnb-kse-look-colour[data-color=""]');
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
await openLook("all");
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

const before51 = JSON.parse(JSON.stringify((await fullConfig()).keys.keySignature));
await radio("cnb-kse-style", "accidentals");
cfg = await fullConfig();
check("DRAW: Sharps or flats is written as the style \"accidentals\"; the Notes, Stacks and Looks rows hide and Place stays",
  cfg.keys.keySignature.style === "accidentals" &&
  await page.evaluate(() => JSON.stringify([...document.querySelectorAll(".cnb-kse-signature .cnb-kse-row-label")]
    .map(e => e.textContent)) === JSON.stringify(["Draw", "Place"])));
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
  check("DRAW: the export carries the signs through the mark table — D major's (6 0 sharp) (13 1 sharp) and B♭ major's flats, no heads",
    ly.includes("cnb:keysig-style 'marks") && /\(marks \(6 0 sharp\)\s+\(13 1 sharp\)/.test(marks) &&
    /\(-?\d+ 0 flat\)/.test(marks) && !/ head /.test(marks), marks.slice(0, 600));
}
// The panel and the canvas with sharps, at the page's two widths.
await pickKey("D", "major");
for (const [width, height] of [[1440, 900], [1280, 800]]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOT_DIR, `uat-051-accidentals-${width}.png`), fullPage: true });
}
await page.setViewportSize({ width: 1600, height: 1800 });
await page.waitForTimeout(150);
await radio("cnb-kse-position", "middle");
await radio("cnb-kse-style", "notehead-chords");
await pickKey("C", "major");
{
  const r = await canvasDraws(C_MAJOR_KEY, "the key's notes again");
  const after = (await fullConfig()).keys.keySignature;
  check("DRAW: The key's notes again — the Notes, Stacks and Looks rows return, the settings are as they were, and the canvas draws the noteheads as the Node-side renderer does",
    JSON.stringify(after) === JSON.stringify(before51) && r.ok && (await canvasSigns()).length === 0 &&
    await page.evaluate(() => JSON.stringify([...document.querySelectorAll(".cnb-kse-signature .cnb-kse-row-label")]
      .map(e => e.textContent)) === JSON.stringify(["Draw", "Notes", "Stacks", "Looks", "Place"])),
    `${r.detail} before=${JSON.stringify(before51)} after=${JSON.stringify(after)}`);
}
cfg = await fullConfig();

// ── STEP 6: clef composition (set-009 gutter, left to right) ────────────────
await openSection(page, "clef");
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
  savedJson.keys.keySignature.style === "notehead-chords" &&
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
check("LOAD: the key-signature editor re-seeded from the loaded config (master + signature checked, 2 definition rows, its stacking, stems and look)",
  await page.evaluate(() =>
    document.querySelector(".cnb-kse-keys-enable-check").checked &&
    document.querySelector(".cnb-kse-sig-enable-check").checked &&
    document.querySelectorAll(".cnb-kse-def-row").length === 2 &&
    document.querySelector('.cnb-kse-stacking .cnb-kse-radio[data-value="parity-stacks"] input').checked &&
    !document.querySelector(".cnb-kse-sep-share-check").checked &&
    document.querySelector(".cnb-kse-sep-thickness").value === "0.5" &&
    document.querySelector('.cnb-kse-look[data-look="all"] .cnb-kse-look-words').textContent.includes("1.5")));
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

// ── STEP 9b: the Clairnote SN gallery file's own signature (session 50) ─────
await page.setInputFiles("#open-file", path.join(ROOT, "cnb", "assets", "examples", "gallery", "clairnote-sn.json"));
await page.waitForFunction(() =>
  document.querySelector(".cnb-cio-status").textContent.includes("Loaded"));
await openSection(page, "key-signature");
await pickKey("D", "major");
{
  const r = await canvasDraws(D_MAJOR_KEY, "Clairnote SN, D major");
  const slashed = r.cfg.shapes["clairnote-dot-sharp"].svgPath;
  const sharps = await page.$$eval(".cnb-pvd-preview .cnb-key-signature > g > path:first-child",
    (ps, d) => ps.filter(p => p.getAttribute("d") === d).length, slashed);
  check("CLAIRNOTE SN: D major draws as the Node-side renderer draws it — dots on the bottom line set, F♯ and C♯ slashed, no gold stem",
    r.ok && sharps === 2 && (await canvasStems()).length === 0, `${r.detail} slashed=${sharps}`);
  check("CLAIRNOTE SN: the panel shows the file's choices — a new stack at each change of parity, to the left in sharp keys, no upper tonic, no gold stem, the bottom line set, and its looks in words",
    await page.evaluate(() => {
      const on = (group, value) => document.querySelector(`.${group} .cnb-kse-radio[data-value="${value}"] input`).checked;
      return on("cnb-kse-stacking", "parity-stacks") && on("cnb-kse-columns", "left-in-sharp-keys") &&
        on("cnb-kse-position", "bottom-set") &&
        !document.querySelector(".cnb-kse-upper-tonic-check").checked &&
        !document.querySelector(".cnb-kse-sep-enable-check").checked &&
        document.querySelector('.cnb-kse-look[data-look="sharp"] .cnb-kse-look-words').textContent.includes("rising slash");
    }));
}

// ── STEP 9c: the panel and canvas at the page's two widths ──────────────────
for (const [width, height] of [[1440, 900], [1280, 800]]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  await openLook("sharp");
  await page.screenshot({ path: path.join(SHOT_DIR, `uat-050-clairnote-${width}.png`), fullPage: true });
  check(`SCREENSHOT ${width}: the Key signature section does not make the page scroll sideways`,
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
