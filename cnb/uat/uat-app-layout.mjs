/**
 * uat-app-layout.mjs — Session 25: the one-screen editor, and the
 * screenshots the UI sessions judge.
 *
 * Opens cnb/index.html at 1440 × 900 and 1280 × 800, first with the default
 * config and then with Kite 4-369 (through the top bar's Open), at the
 * Medium Size the canvas starts at, and checks the layout that design
 * docs/planning/notehead-first-editor-design.md §6.1 and §7 promise:
 *
 *   - the row count each width gives: the default config on one row at
 *     1440 and two at 1280; Kite on two at both;
 *   - the page never scrolls sideways;
 *   - the section list shows one panel at a time;
 *   - a chosen Size survives a reload (it is the browser's, in localStorage),
 *     and changes nothing in the config;
 *   - no console or page errors.
 *
 * Session 26 adds the Ledger lines section to the walk, checks each
 * section's preview (the ledger marks and spots, the Clef and Key
 * signature partial staffs), that the staff editor's three mounts stay in
 * step, and that the Export section edits the name and file suffix.
 *
 * It saves app-default-1440.png, app-default-1280.png, app-kite-1440.png
 * and app-kite-1280.png, and at 1440 with Kite one shot per kept panel
 * (panel-staff, panel-ledger-lines, panel-clef, panel-key-signature,
 * panel-export), to the shots directory. Every UI session (25–29)
 * judges these against the approved mock-ups in design §10 and records the
 * judgement in docs/uat-status.md (design §12, "Screenshot checks").
 *
 * Dependency resolution, env vars and exit codes are the same as
 * uat-kite-pipeline.mjs (playwright-core plus ms-playwright cache Chromium;
 * exit 2 = missing dependency, 1 = check failure, 0 = all passed).
 * Optional: CNB_UAT_PORT (default 8161), CNB_UAT_SHOTS (screenshot dir,
 * default <os tmpdir>/cnb-uat).
 *
 * Usage: node cnb/uat/uat-app-layout.mjs
 */
import http from "http";
import os from "os";
import { readFile, mkdir } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { openSection } from "./app-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const KITE = path.join(ROOT, "cnb", "fixtures", "kite-4-369-config.json");
const PORT = Number(process.env.CNB_UAT_PORT || 8161);
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
      "a Chromium/Chrome binary, or install one (npx playwright install chromium).");
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

const browser = await chromium.launch({ executablePath: EXE });
const consoleErrors = [];

/** A fresh browser context (empty localStorage) on the app at a window size. */
async function openApp(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  // Stub the Google Fonts CDN (preview-only cosmetics) so the run asserts
  // app behavior, not CDN availability.
  await page.route("https://fonts.googleapis.com/**", route =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", route =>
    route.fulfill({ status: 200, contentType: "font/woff2", body: "" }));
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(`${width}: ${m.text()}`); });
  page.on("pageerror", e => consoleErrors.push(`${width}: ${e}`));
  await page.goto(`http://localhost:${PORT}/cnb/index.html`);
  await page.waitForSelector(".cnb-pvd-preview .pc-col");
  return { context, page };
}

/** The canvas as laid out: systems drawn, row count, and the page's scroll width. */
async function layout(page) {
  // The ResizeObserver redraws after the first layout; let it settle.
  await page.waitForTimeout(250);
  return page.evaluate(() => ({
    systems: document.querySelectorAll(".cnb-pvd-preview .preview-container").length,
    cards: document.querySelectorAll(".cnb-pvd-preview .pc-col").length,
    pageScrollWidth: document.documentElement.scrollWidth,
    pageWidth: document.documentElement.clientWidth,
    overflow: document.querySelector(".cnb-pvd-preview").classList.contains("cnb-pvd-overflow"),
    size: document.querySelector(".cnb-pvd-size-option.on")?.getAttribute("data-size"),
  }));
}

const visiblePanels = (page) => page.$$eval(".panel", els =>
  els.filter(e => !e.hidden).map(e => e.dataset.panel));

const EXPECTED_ROWS = { default: { 1440: 1, 1280: 2 }, kite: { 1440: 2, 1280: 2 } };

for (const [width, height] of [[1440, 900], [1280, 800]]) {
  const { context, page } = await openApp(width, height);

  // ── The default config at Medium ──
  let l = await layout(page);
  check(`${width}: the canvas starts at Medium`, l.size === "medium", String(l.size));
  check(`${width}: the default config is ${EXPECTED_ROWS.default[width]} row(s) of the 13 pitch columns, C to C′`,
    l.systems === EXPECTED_ROWS.default[width] && l.cards === 13 && !l.overflow, JSON.stringify(l));
  check(`${width}: the page does not scroll sideways (default config)`,
    l.pageScrollWidth <= l.pageWidth, JSON.stringify(l));
  check(`${width}: the Staff section's panel is the only one shown`,
    JSON.stringify(await visiblePanels(page)) === '["staff"]', JSON.stringify(await visiblePanels(page)));
  await page.screenshot({ path: path.join(SHOT_DIR, `app-default-${width}.png`), fullPage: true });

  // ── One panel at a time ──
  let onePanel = true;
  for (const name of ["noteheads", "ledger-lines", "clef", "key-signature", "advanced", "export", "staff"]) {
    await openSection(page, name);
    const shown = await visiblePanels(page);
    const current = await page.$$eval(".section-link.on", els => els.map(e => e.dataset.section));
    if (JSON.stringify(shown) !== JSON.stringify([name]) || JSON.stringify(current) !== JSON.stringify([name])) {
      onePanel = false;
    }
  }
  check(`${width}: each section shows its own panel and no other, and marks itself current`, onePanel);
  l = await layout(page);
  check(`${width}: no section makes the page scroll sideways`, l.pageScrollWidth <= l.pageWidth, JSON.stringify(l));

  // ── Each section's preview (session 26, design §6) ──
  const marks = () => page.evaluate(() => ({
    focus: document.querySelector(".cnb-pvd-preview").classList.contains("cnb-pvd-focus-ledgers"),
    spots: document.querySelectorAll(".cnb-pvd-preview .ledger-spot").length,
    ledgered: [...document.querySelectorAll(".cnb-pvd-preview .pc-col")]
      .filter(c => c.dataset.ledgers !== "0").map(c => c.dataset.pc),
  }));
  await openSection(page, "ledger-lines");
  let m = await marks();
  check(`${width}: Ledger lines marks the canvas, draws the candidate spots and says which columns draw ledger lines`,
    m.focus && m.spots > 0 && m.ledgered.includes("0") && !m.ledgered.includes("5"), JSON.stringify(m));
  await openSection(page, "clef");
  m = await marks();
  check(`${width}: leaving Ledger lines removes the marks and spots`, !m.focus && m.spots === 0, JSON.stringify(m));
  const partial = (id) => page.evaluate((hostId) => {
    const host = document.getElementById(hostId);
    return [...host.querySelectorAll(".cnb-pvd-partial .pc-col")].map(c => c.dataset.pc).join(",");
  }, id);
  check(`${width}: the Clef panel shows a partial staff of C, C♯ and D`,
    (await partial("clef-preview-host")) === "0,1,2", await partial("clef-preview-host"));
  check(`${width}: the Key signature panel shows a partial staff of C, C♯ and D`,
    (await partial("key-signature-preview-host")) === "0,1,2", await partial("key-signature-preview-host"));

  // ── The staff editor's three mounts stay in step (session 26) ──
  const stateJson = async () => JSON.parse(await page.textContent("#state-json"));
  await openSection(page, "ledger-lines");
  await page.click('#ledger-editor-host [data-ledger-mode="automatic"]');
  let cfg = await stateJson();
  check(`${width}: Ledger lines › Automatic writes the automatic spot (C, by proximity)`,
    JSON.stringify(cfg.ledgers.templates) === JSON.stringify([{ semiWithinOctave: 0, triggerPCs: [], triggerMode: "proximity" }]) &&
    cfg.ledgers.proximityRule === true, JSON.stringify(cfg.ledgers.templates));
  await openSection(page, "staff");
  await page.click('#staff-editor-host [data-pattern-key="custom"]');
  await page.click('#staff-editor-host .cnb-sre-pc-toggle[data-pc="0"]');   // lines on C, E and G♯: spacing 4, no spot left
  cfg = await stateJson();
  check(`${width}: a staff edit keeps the Automatic ledger lines and they follow the pattern`,
    JSON.stringify(cfg.staff.semitonePattern) === "[0,4,8]" && cfg.ledgers.templates.length === 0 &&
    await page.evaluate(() => document.querySelector('#ledger-editor-host [data-ledger-mode="automatic"]').classList.contains("on")),
    JSON.stringify(cfg.ledgers));
  check(`${width}: Advanced › Staff line overrides re-seeds with one row per line of the new pattern`,
    (await page.$$eval("#staff-overrides-host .cnb-sre-override-row", els => els.length)) === 3);

  // ── The Export section edits the notation's name and file suffix ──
  await openSection(page, "export");
  await page.fill('.cnb-cex-meta-field[data-meta="configName"] .cnb-cex-meta-input', "Lines on C");
  await page.fill('.cnb-cex-meta-field[data-meta="fileSuffix"] .cnb-cex-meta-input', "-LinesOnC");
  cfg = await stateJson();
  check(`${width}: Export › Name and File suffix write meta, the top bar and the file name follow`,
    cfg.meta.configName === "Lines on C" && cfg.meta.fileSuffix === "-LinesOnC" &&
    (await page.textContent("#config-name")) === "Lines on C" &&
    (await page.textContent(".cnb-cex-filename")) === "linesonc.ly", JSON.stringify(cfg.meta));
  check(`${width}: the Export section names the preview-only settings once`,
    (await page.$$eval(".cnb-cex-preview-only", els => els.length)) === 1);
  await openSection(page, "staff");

  // ── Kite 4-369 through Open ──
  await page.setInputFiles("#open-file", KITE);
  await page.waitForFunction(() => document.getElementById("topbar-status").textContent.startsWith("Opened"));
  check(`${width}: Open loads Kite 4-369 and the top bar names it`,
    (await page.textContent("#config-name")).includes("Kite 4-369"), await page.textContent("#config-name"));
  l = await layout(page);
  check(`${width}: Kite 4-369 is ${EXPECTED_ROWS.kite[width]} row(s), C to F♯ and G to C′, at Medium`,
    l.systems === EXPECTED_ROWS.kite[width] && l.cards === 13 && !l.overflow, JSON.stringify(l));
  check(`${width}: the page does not scroll sideways (Kite)`, l.pageScrollWidth <= l.pageWidth, JSON.stringify(l));
  check(`${width}: the checks indicator shows the loaded config's state`,
    /^(No problems|\d+ (warning|error)s?)$/.test((await page.textContent("#checks-indicator")).trim()),
    await page.textContent("#checks-indicator"));
  await page.screenshot({ path: path.join(SHOT_DIR, `app-kite-${width}.png`), fullPage: true });

  // ── The kept panels, for the screenshot check (session 26) ──
  if (width === 1440) {
    for (const name of ["staff", "ledger-lines", "clef", "key-signature", "export"]) {
      await openSection(page, name);
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(SHOT_DIR, `panel-${name}.png`), fullPage: true });
    }
    await openSection(page, "staff");
  }

  // ── The Size is the browser's: it survives a reload and leaves the file alone ──
  const before = await page.textContent("#state-json");
  await page.click('.cnb-pvd-size-option[data-size="small"]');
  const after = await page.textContent("#state-json");
  check(`${width}: choosing a Size changes nothing in the config`, before === after);
  await page.reload();
  await page.waitForSelector(".cnb-pvd-preview .pc-col");
  l = await layout(page);
  check(`${width}: the chosen Size survives a reload (Small)`, l.size === "small", String(l.size));
  check(`${width}: at Small the default config is one row`, l.systems === 1, JSON.stringify(l));

  await context.close();
}

check("NO console or page errors", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
