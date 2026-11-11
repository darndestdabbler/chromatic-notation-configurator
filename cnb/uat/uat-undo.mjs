/**
 * uat-undo.mjs — Playwright UAT driver for undo and redo (session 41).
 *
 * On cnb/index.html, starting from the default config:
 *
 *   1. Undo and Redo start disabled.
 *   2. Three changes, each one step: a staff pattern chosen in Staff, a
 *      colour dragged in the notehead panel (several input events, then
 *      change), and a name typed a key at a time in Export.
 *   3. Ctrl+Z undoes them one at a time back to the starting config, then
 *      Ctrl+Shift+Z, the Redo button and Ctrl+Y redo them. Each state is
 *      compared through Advanced › View file (JSON).
 *   4. A change after an undo leaves nothing to redo.
 *   5. Opening a gallery config is one step, which Undo reverts.
 *   6. Save adds no step: after a change and a Save, one undo is back at
 *      the start (but for Save's created/modified stamp).
 *
 * Requirements, as the other drivers (uat-app-layout.mjs): playwright-core
 * plus a Chromium from the ms-playwright cache or CNB_UAT_CHROMIUM
 * (exit 2 = missing dependency, 1 = check failure, 0 = all passed).
 * Optional: CNB_UAT_PORT (default 8164).
 *
 * Usage: node cnb/uat/uat-undo.mjs
 */
import http from "http";
import os from "os";
import { readFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { openSection, selectNotehead, useDownloads } from "./app-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8164);

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

/** The config as Advanced › View file (JSON) shows it. */
const state = () => page.textContent("#state-json");
const disabled = (id) => page.$eval("#" + id, b => b.disabled);
const buttons = async () => ({ undo: !(await disabled("undo-config")), redo: !(await disabled("redo-config")) });
const press = async (keys) => { await page.keyboard.press(keys); };
const withoutStamp = (text) => {
  const c = JSON.parse(text);
  delete c.meta.created;
  delete c.meta.modified;
  return JSON.stringify(c);
};
const open = async (name, text) => {
  await page.setInputFiles("#open-file", { name, mimeType: "application/json", buffer: Buffer.from(text) });
  await page.waitForFunction((n) => document.getElementById("topbar-status").textContent === "Opened " + n, name);
};

await useDownloads(page);
await page.goto(`http://localhost:${PORT}/cnb/index.html`);
await page.waitForSelector(".cnb-pvd-preview .pc-col");

// ── 1. The start ────────────────────────────────────────────────────────────
let b = await buttons();
check("START: Undo and Redo are disabled", !b.undo && !b.redo, JSON.stringify(b));
const s0 = await state();

// ── 2. Three changes ────────────────────────────────────────────────────────
await openSection(page, "staff");
await page.click('[data-panel="staff"] .cnb-sre-pattern-option:not(.selected)');
const s1 = await state();
check("CHANGE 1: choosing a staff pattern changes the config and enables Undo",
  s1 !== s0 && (await buttons()).undo && !(await buttons()).redo);

await selectNotehead(page, 0);
await page.evaluate(() => {
  const input = document.querySelector(".cnb-nhp-color-input");
  for (const value of ["#cc0000", "#cc4400", "#cc79a7"]) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
const s2 = await state();
check("CHANGE 2: the dragged colour is on the config",
  s2 !== s1 && s2.toLowerCase().includes("#cc79a7"));

await openSection(page, "export");
const nameField = '.cnb-cex-meta-field[data-meta="configName"] .cnb-cex-meta-input';
await page.click(nameField);
await page.fill(nameField, "");
await page.type(nameField, "Undo test");
await press("Tab");
const s3 = await state();
check("CHANGE 3: the typed name is on the config", JSON.parse(s3).meta.configName === "Undo test",
  JSON.parse(s3).meta.configName);

// ── 3. Undo and redo, one step at a time ────────────────────────────────────
await page.click("body", { position: { x: 5, y: 300 } });
await press("Control+z");
check("UNDO 1 (Ctrl+Z): the whole typed name is undone at once", (await state()) === s2,
  JSON.parse(await state()).meta.configName);
await press("Control+z");
check("UNDO 2 (Ctrl+Z): the dragged colour is undone at once", (await state()) === s1);
await press("Control+z");
check("UNDO 3 (Ctrl+Z): back at the starting config", (await state()) === s0);
b = await buttons();
check("UNDO: at the start, Undo is disabled and Redo enabled", !b.undo && b.redo, JSON.stringify(b));
await press("Control+z");
check("UNDO: one more Ctrl+Z changes nothing", (await state()) === s0);

await press("Control+Shift+z");
check("REDO 1 (Ctrl+Shift+Z): the staff pattern is back", (await state()) === s1);
await page.click("#redo-config");
check("REDO 2 (the Redo button): the colour is back", (await state()) === s2);
await press("Control+y");
check("REDO 3 (Ctrl+Y): the name is back", (await state()) === s3);
b = await buttons();
check("REDO: at the end, Redo is disabled", b.undo && !b.redo, JSON.stringify(b));

// ── 4. A change after an undo ───────────────────────────────────────────────
await page.click("#undo-config");
check("UNDO (the Undo button): the name is undone", (await state()) === s2);
await openSection(page, "staff");
await page.click('[data-panel="staff"] .cnb-sre-pattern-option:not(.selected)');
b = await buttons();
check("NEW CHANGE after undo: nothing is left to redo", b.undo && !b.redo, JSON.stringify(b));

// ── 5. Opening a config is a step ───────────────────────────────────────────
const beforeOpen = await state();
const gallery = await readFile(path.join(ROOT, "cnb", "assets", "examples", "gallery", "twinline-compact.json"), "utf8");
await open("twinline-compact.json", gallery);
const opened = await state();
check("OPEN: the opened config replaces the one shown", opened !== beforeOpen &&
  JSON.parse(opened).meta.configName === JSON.parse(gallery).meta.configName, JSON.parse(opened).meta.configName);
await page.click("#undo-config");
check("OPEN: one undo puts back the config shown before", (await state()) === beforeOpen);
await page.click("#redo-config");
check("OPEN: redo opens it again", (await state()) === opened);

// ── 6. Save adds no step ────────────────────────────────────────────────────
await page.reload();
await page.waitForSelector(".cnb-pvd-preview .pc-col");
const fresh = await state();
await openSection(page, "staff");
await page.click('[data-panel="staff"] .cnb-sre-pattern-option:not(.selected)');
await Promise.all([page.waitForEvent("download"), page.click("#save-config")]);
const saved = JSON.parse(await state());
check("SAVE: the save stamps the config", !!saved.meta.modified);
await page.click("#undo-config");
check("SAVE: one undo is back at the start, so Save added no step",
  withoutStamp(await state()) === withoutStamp(fresh));
check("SAVE: and nothing is left to undo", !(await buttons()).undo);

check("NO console or page errors", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();
for (const line of results) console.log(line);
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
process.exit(failCount ? 1 : 0);
