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
 * signature → select the displayed key in the preview → mark styling
 * (notehead-chords ↔ dot, separator, explicit tonic octave) → clef
 * composition → save the config (real download) and load it back →
 * export a .ly file (real download) — with Node-side parity checks run in
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
import { useCanvasSize, canvasConfig, openSection } from "./app-page.mjs";

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

/** Node-side expected mark positions for the current config + key. */
function expectedMarks(cfg, keyName) {
  cfg = drawn(cfg);
  const m = CNBKeySignature.measure(cfg, cfg.display.pxPerSemi, keyName);
  if (!m) return null;
  const grid = CNBGrid.create(drawn(cfg), CNBCollection.gridRange(FULL_ROW));
  const paddingH = cfg.keys.keySignature.gutter.paddingH;
  const leftX = paddingH + m.markWidth / 2;
  const rightX = leftX + m.markWidth;
  return m.semis.map((semi, i) => ({
    x: i % 2 === 0 ? leftX : rightX,
    y: grid.semiToY(semi),
  }));
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
check("DEFAULT-OFF: the preview reserves NO keysig gutter (no .keysig-col), shows 13 cards, and no Key control (keys disabled)",
  (await keysigColCount()) === 0 &&
  await page.$$eval(".cnb-pvd-preview .pc-col", els => els.length === 13) &&
  await page.evaluate(() => !document.querySelector(".cnb-pvd-key")));
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
check("ENABLE KEYS: the preview's Key control appears with the explicit empty-definitions state (disabled select + note — set-006 s3 pattern)",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-pvd-key") &&
    document.querySelector(".cnb-pvd-key-select").disabled &&
    document.querySelector(".cnb-pvd-key-note").textContent.includes("definitions is empty")));
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
check("DEFINE: the preview's Key select now offers both definitions",
  await page.evaluate(() => {
    const select = document.querySelector(".cnb-pvd-key-select");
    const values = [...select.querySelectorAll("option")].map(o => o.value);
    return !select.disabled && values.includes("C") && values.includes("D Dorian");
  }));

// ── STEP 3: enable the key signature ────────────────────────────────────────
await page.check(".cnb-kse-sig-enable-check");
cfg = await fullConfig();
check("ENABLE SIGNATURE: keys.keySignature.enabled true in the shared config, validation still valid",
  cfg.keys.keySignature.enabled === true &&
  await page.evaluate(() => !!document.querySelector(".cnb-key-signature-editor .cnb-kse-valid")));
check("ENABLE SIGNATURE: with NO key selected the preview still reserves no keysig gutter (the displayed key is example data — s1 D5)",
  (await keysigColCount()) === 0);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-sig-enabled-no-key.png"), fullPage: true });

// ── STEP 4: select the displayed key in the preview ─────────────────────────
await page.selectOption(".cnb-pvd-key-select", "C");
cfg = await fullConfig();
const expectedGutterC = CNBKeySignature.gutterWidth(drawn(cfg), drawn(cfg).display.pxPerSemi, "C");
// CSSOM serializes style.width to 3 decimals (138.35264 → "138.353px"),
// so the fractional notehead-derived width is compared numerically ±0.001.
check(`KEY SELECTION: selecting C grew a keysig gutter column of ${expectedGutterC}px (Node-side CNBKeySignature.gutterWidth on the same config, ±0.001 CSSOM rounding)`,
  (await keysigColCount()) === 1 &&
  await page.$eval(".cnb-pvd-preview .keysig-col",
    (el, w) => Math.abs(parseFloat(el.style.width) - w) < 1e-3, expectedGutterC),
  `dom width=${await page.$eval(".cnb-pvd-preview .keysig-col", el => el.style.width).catch(() => "n/a")}`);

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
  const barX = cfg.keys.keySignature.gutter.paddingH + (m.columns * m.markWidth) / 2;
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

await page.selectOption(".cnb-pvd-key-select", "D Dorian");
cfg = await fullConfig();
expected = expectedMarks(cfg, "D Dorian");
actual = await renderedMarks();
check("KEY SELECTION: switching to D Dorian re-anchors the signature on tonic D (same pitch-class set, different tonic — scale-from-tonic placement)",
  expected && expected.length === 8 && marksMatch(actual, expected) &&
  CNBKeySignature.signatureSemis(cfg, "D Dorian")[0] === 2,
  `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-key-d-dorian.png"), fullPage: true });
await page.selectOption(".cnb-pvd-key-select", "C");

// ── STEP 5: mark style + placement/separator/gutter controls ────────────────
// One implemented style (notehead-chords); the task owner deferred simple-mark
// styles to a future set (s2-uat.md). Confirm the style vocabulary and the
// preview-only controls.
check("STYLING: the mark-style panel offers exactly one style (Notehead chords), selected, as LilyPond draws it",
  cfg.keys.keySignature.style === "notehead-chords" &&
  await page.evaluate(() => {
    const opts = [...document.querySelectorAll(".cnb-kse-style-option")];
    return opts.length === 1 &&
      opts[0].getAttribute("data-style") === "notehead-chords" &&
      opts[0].classList.contains("selected") &&
      opts[0].textContent.includes("as LilyPond draws it");
  }));
check("STYLING: only the spacing carries a Preview only badge with a tooltip; placement and the separator export (session 30, design §8.6)",
  await page.evaluate(() => {
    const badges = (part) => document.querySelectorAll(`.cnb-key-signature-editor .cnb-kse-${part} .cnb-badge`);
    const gutter = badges("gutter");
    return gutter.length === 1 && gutter[0].textContent === "Preview only" && gutter[0].title.includes("not exported") &&
      badges("placement").length === 0 && badges("separator").length === 0;
  }));

// Explicit tonic octave (placement control; auto is the s1 D4 decision).
await page.uncheck(".cnb-kse-octave-auto-check");
await page.fill(".cnb-kse-octave-input", "0");
cfg = await fullConfig();
check("STYLING: explicit tonic octave 0 reaches placement.tonicOctave and shifts the marks an octave down (Node-side signatureSemis parity)",
  cfg.keys.keySignature.placement.tonicOctave === 0 &&
  CNBKeySignature.signatureSemis(cfg, "C")[0] === 0 &&
  // The lowest notehead (first degree, now semi 0) sits at semiToY(0).
  await page.evaluate((expY) => {
    const marks = [...document.querySelectorAll(".cnb-pvd-preview .cnb-key-signature > g")]
      .filter(g => g.querySelector(":scope > path"));
    if (marks.length === 0) return false;
    const m = /translate\([-\d.eE+]+,([-\d.eE+]+)\)/.exec(marks[0].getAttribute("transform") || "");
    return m && Math.abs(parseFloat(m[1]) - expY) < 1e-6;
  }, CNBGrid.create(drawn(cfg), CNBCollection.gridRange(FULL_ROW)).semiToY(0)));
await page.check(".cnb-kse-octave-auto-check");
cfg = await fullConfig();
check("STYLING: re-checking auto restores tonicOctave null (centered on the staff midpoint — engine parity for the default config)",
  cfg.keys.keySignature.placement.tonicOctave === null &&
  CNBKeySignature.signatureSemis(cfg, "C")[0] === 12);

// Separator styling + gutter sizing.
await page.fill(".cnb-kse-sep-extent", "6");
await page.fill(".cnb-kse-gutter-input", "16");
cfg = await fullConfig();
{
  const grid = CNBGrid.create(drawn(cfg), CNBCollection.gridRange(FULL_ROW));
  check("STYLING: separator extent 6 and gutter padding 16 reach the config and the preview (bar shortened, column resized)",
    cfg.keys.keySignature.separator.extentSemis === 6 &&
    cfg.keys.keySignature.gutter.paddingH === 16 &&
    await page.$eval(".cnb-pvd-preview .cnb-key-signature-separator",
      (el, exp) => el.getAttribute("y1") === String(exp.y1) && el.getAttribute("y2") === String(exp.y2),
      { y1: grid.semiToY(cfg.staff.midpoint + 6), y2: grid.semiToY(cfg.staff.midpoint - 6) }) &&
    await page.$eval(".cnb-pvd-preview .keysig-col",
      (el, w) => Math.abs(parseFloat(el.style.width) - w) < 1e-3,
      CNBKeySignature.gutterWidth(drawn(cfg), drawn(cfg).display.pxPerSemi, "C")));
}
cfg = await fullConfig();
expected = expectedMarks(cfg, "C");
actual = await renderedMarks();
check("STYLING: the notehead-chords marks remain the 8 two-column stack after the control edits",
  cfg.keys.keySignature.style === "notehead-chords" &&
  expected && marksMatch(actual, expected));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-styled.png"), fullPage: true });

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
check("COMPOSITION: the keysig marks are unchanged inside their own column (gutters compose, no re-anchoring)",
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
check("SAVE: the keys section is in the file — enabled, 2 definitions, signature enabled, extent 6, gutter 16",
  savedJson.keys.enabled === true &&
  savedJson.keys.definitions.length === 2 &&
  savedJson.keys.definitions[1].name === "D Dorian" &&
  savedJson.keys.keySignature.enabled === true &&
  savedJson.keys.keySignature.style === "notehead-chords" &&
  savedJson.keys.keySignature.separator.extentSemis === 6 &&
  savedJson.keys.keySignature.gutter.paddingH === 16,
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
check("LOAD: the key-signature editor re-seeded from the loaded config (master + signature checked, 2 definition rows, gutter input 16)",
  await page.evaluate(() =>
    document.querySelector(".cnb-kse-keys-enable-check").checked &&
    document.querySelector(".cnb-kse-sig-enable-check").checked &&
    document.querySelectorAll(".cnb-kse-def-row").length === 2 &&
    document.querySelector(".cnb-kse-gutter-input").value === "16"));
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
check("EXPORT EMISSION: the keysig-enabled download keeps the signature and its tonic octave; with the signature disabled generate() writes 'none",
  direct !== null && !exported.includes("cnb:keysig-style 'none") &&
  (!Number.isInteger(tonicOctave) || exported.includes(`#(set! cnb:keysig-tonic-octave ${tonicOctave})`)) &&
  CNBLilypond.generate(disabledCfg).includes("#(set! cnb:keysig-style 'none)"),
  `tonic octave ${tonicOctave}; the key-signature settings are wrong in the export`);
check("EXPORT: valid badge shown, no error rows",
  await page.evaluate(() =>
    !!document.querySelector(".cnb-cex-valid") &&
    document.querySelectorAll(".cnb-cex-verror").length === 0));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-010-s2-exported.png"), fullPage: true });

// ── STEP 10: no errors ───────────────────────────────────────────────────────
check("NO console or page errors across the whole key-signature flow", consoleErrors.length === 0,
  consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots + saved/exported files: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
