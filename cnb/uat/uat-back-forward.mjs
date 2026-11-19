/**
 * uat-back-forward.mjs — Playwright UAT driver for the browser's Back and
 * Forward, the work kept in the browser, New and Back to every key
 * (session 71; docs/uat-status.md, session 69, rough edges 6 and 7).
 *
 * On cnb/index.html:
 *
 *   1. The page opens at step 1, its id in the address. Steps opened from
 *      the sidebar and by Next put their ids in the address, and Back and
 *      Forward move between them, the panel following.
 *   2. An address with a step opens it; one with a greyed or unknown step
 *      opens the kept step, or step 1 with nothing kept.
 *   3. A change (a staff pattern chosen), then a reload: the page asks first
 *      (beforeunload, accepted) and comes back at the same step with the
 *      change, compared through Advanced › View file (JSON).
 *   4. After Save, a reload asks nothing.
 *   5. New asks while the notation is not saved; dismissed, nothing
 *      changes; accepted, the default notation at step 1. New on the
 *      untouched default asks nothing.
 *   6. With a key signature shown: step 8 opened from the sidebar has no
 *      Back to every key; a key clicked in step 9 opens step 8 with the
 *      link above its canvas, the link returns to step 9, and Forward
 *      returns to step 8 with the link still shown.
 *
 * Requirements, as the other drivers (uat-app-layout.mjs): playwright-core
 * plus a Chromium from the ms-playwright cache or CNB_UAT_CHROMIUM
 * (exit 2 = missing dependency, 1 = check failure, 0 = all passed).
 * Optional: CNB_UAT_PORT (default 8165).
 *
 * Usage: node cnb/uat/uat-back-forward.mjs
 */
import http from "http";
import os from "os";
import { readFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { openSection, useDownloads } from "./app-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8165);

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

const results = [];
let failCount = 0;
function check(label, cond, detail = "") {
  const ok = !!cond;
  if (!ok) failCount++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? "  [" + detail + "]" : ""}`);
}

// ── Browser ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: EXE });
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

// Every dialog is recorded; a confirm is answered by `answer`, a
// beforeunload is accepted.
let dialogs = [];
let answer = true;
page.on("dialog", (d) => {
  dialogs.push(d.type());
  if (d.type() === "confirm" && !answer) d.dismiss(); else d.accept();
});

const APP = `http://localhost:${PORT}/cnb/index.html`;
/** The config as Advanced › View file (JSON) shows it. */
const state = () => page.textContent("#state-json");
const hash = () => page.evaluate(() => location.hash);
/** The panel shown. */
const panel = () => page.evaluate(() => {
  const shown = document.querySelector(".panel:not([hidden])");
  return shown ? shown.dataset.panel : null;
});
const where = async () => `${await hash()} ${await panel()}`;
const at = async (id) => (await hash()) === "#" + id && (await panel()) === id;
// The canvas is drawn though hidden in steps 6–9.
const ready = () => page.waitForSelector(".cnb-pvd-preview .pc-col", { state: "attached" });
const linkShown = () => page.isVisible("#back-to-keys");
/** A fresh load of the page at an address (not a move within the page). */
async function load(url) {
  await page.goto("about:blank");
  await page.goto(url);
  await ready();
}

await useDownloads(page);
await page.goto(APP);
await ready();

// ── 1. Steps in the address; Back and Forward ───────────────────────────────
check("START: the page opens at step 1, its id in the address", await at("notehead-height"), await where());
const s0 = await state();

await openSection(page, "staff");
check("SIDEBAR: opening Staff puts #staff in the address", await at("staff"), await where());
await page.click("#step-bar .step-next");
check("NEXT: Next puts #pitch in the address", await at("pitch"), await where());
await openSection(page, "ledger-lines");
check("SIDEBAR: opening Ledger lines puts #ledger-lines in the address", await at("ledger-lines"), await where());

await page.goBack();
check("BACK: Back opens Pitch", await at("pitch"), await where());
await page.goBack();
check("BACK: Back again opens Staff", await at("staff"), await where());
await page.goBack();
check("BACK: Back again opens step 1, where the page started", await at("notehead-height"), await where());
await page.goForward();
check("FORWARD: Forward opens Staff", await at("staff"), await where());
await page.goForward();
check("FORWARD: Forward again opens Pitch", await at("pitch"), await where());
check("BACK AND FORWARD: no dialog was asked (nothing changed)", dialogs.length === 0, dialogs.join());

// ── 2. An address with a step ───────────────────────────────────────────────
await load(APP + "#export");
check("ADDRESS: a page opened at #export opens Export", await at("export"), await where());
await load(APP + "#ks-designer");
check("ADDRESS: a greyed step (#ks-designer, no signature) opens the kept step instead (Export)",
  await at("export"), await where());
// With nothing kept, step 1.
const forget = () => page.evaluate(() => localStorage.removeItem("cnb.keptWork"));
await forget();
await load(APP + "#ks-designer");
check("ADDRESS: with nothing kept, a greyed step opens step 1", await at("notehead-height"), await where());
await forget();
await load(APP + "#no-such-step");
check("ADDRESS: with nothing kept, an unknown step opens step 1", await at("notehead-height"), await where());

// ── 3. A change, then a reload ──────────────────────────────────────────────
await openSection(page, "staff");
await page.click('[data-panel="staff"] .cnb-sre-pattern-option:not(.selected)');
const s1 = await state();
check("CHANGE: choosing a staff pattern changes the notation", s1 !== s0);
dialogs = [];
await page.reload();
await ready();
check("RELOAD: leaving with a change not saved asks first (beforeunload)",
  JSON.stringify(dialogs) === '["beforeunload"]', dialogs.join());
check("RELOAD: the page comes back at Staff", await at("staff"), await where());
check("RELOAD: with the change kept (View file (JSON) as before the reload)", (await state()) === s1);
dialogs = [];
await page.reload();
await ready();
check("RELOAD: a restored change still not saved asks again",
  JSON.stringify(dialogs) === '["beforeunload"]', dialogs.join());

// ── 4. After Save, no warning ───────────────────────────────────────────────
await Promise.all([page.waitForEvent("download"), page.click("#save-config")]);
await page.waitForFunction(() => document.getElementById("topbar-status").textContent.startsWith("Saved as"));
const s2 = await state();
dialogs = [];
await page.reload();
await ready();
check("SAVE: after Save a reload asks nothing", dialogs.length === 0, dialogs.join());
check("SAVE: and the saved notation comes back at its step", (await state()) === s2 && await at("staff"), await where());

// ── 5. New ──────────────────────────────────────────────────────────────────
await page.click('[data-panel="staff"] .cnb-sre-pattern-option:not(.selected)');
const s3 = await state();
dialogs = [];
answer = false;
await page.click("#new-config");
check("NEW: with a change not saved, New asks first", JSON.stringify(dialogs) === '["confirm"]', dialogs.join());
check("NEW: dismissed, the notation and the step stay", (await state()) === s3 && await at("staff"), await where());
dialogs = [];
answer = true;
await Promise.all([page.waitForEvent("load"), page.click("#new-config")]);
await ready();
check("NEW: accepted, asked once and no leave warning", JSON.stringify(dialogs) === '["confirm"]', dialogs.join());
check("NEW: the default notation at step 1", (await state()) === s0 && await at("notehead-height"), await where());
dialogs = [];
await Promise.all([page.waitForEvent("load"), page.click("#new-config")]);
await ready();
check("NEW: on the untouched default New asks nothing", dialogs.length === 0, dialogs.join());

// ── 6. Back to every key ────────────────────────────────────────────────────
await openSection(page, "ks-symbol-type");
await page.check('[data-panel="ks-symbol-type"] .cnb-kse-sig-enable-check');
await openSection(page, "ks-designer");
check("LINK: step 8 opened from the sidebar has no Back to every key",
  (await at("ks-designer")) && !(await linkShown()), await where());
await openSection(page, "ks-preview");
await page.click('[data-panel="ks-preview"] .cnb-kse-mode-row[data-mode="dorian"] .cnb-kse-mini[data-key="E"]');
check("LINK: a key clicked in step 9 opens step 8 with Back to every key",
  (await at("ks-designer")) && await linkShown(), await where());
check("LINK: the link is above step 8's canvas", await page.evaluate(() => {
  const link = document.getElementById("back-to-keys");
  const canvas = document.querySelector('[data-panel="ks-designer"] .cnb-kse-canvas');
  return !!canvas && !!(link.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING) &&
    link.getBoundingClientRect().bottom <= canvas.getBoundingClientRect().top;
}));
check("LINK: step 8 shows the key clicked",
  (await page.inputValue('[data-panel="ks-designer"] .cnb-kse-key-tonic')) === "E" &&
  (await page.inputValue('[data-panel="ks-designer"] .cnb-kse-key-mode')) === "dorian");
await page.click("#back-to-keys");
check("LINK: Back to every key returns to step 9", await at("ks-preview"), await where());
await page.goForward();
check("LINK: Forward returns to step 8, the link still shown",
  (await at("ks-designer")) && await linkShown(), await where());
await page.goBack();
check("LINK: the browser's Back does what the link does", await at("ks-preview"), await where());
await page.goForward();
await page.reload();
await ready();
check("LINK: after a reload step 8 still shows the link", (await at("ks-designer")) && await linkShown(), await where());

check("NO console or page errors", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();
for (const line of results) console.log(line);
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
process.exit(failCount ? 1 : 0);
