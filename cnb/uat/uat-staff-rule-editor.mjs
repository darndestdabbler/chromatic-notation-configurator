/**
 * uat-staff-rule-editor.mjs — Playwright UAT driver for Module 13
 * (Staff/Ledger Rule Editor), session-set 005 session 1.
 *
 * Executes the DSL-style checklist recorded in
 * docs/session-sets/005-rule-editors/s1-uat.md against
 * cnb/test-pages/test-staff-rule-editor.html, served from the repo root by a
 * built-in static server. (The dabbler-uat-dsl compiler is still in
 * bootstrap; this driver is the checklist's executable form and can be
 * replaced by the compiled DSL output once that pipeline lands.)
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-staff-rule-editor.mjs
 *
 * Requirements — the driver errors out (exit 2) rather than guessing:
 *   - playwright-core resolvable from this file, or set CNB_UAT_PLAYWRIGHT
 *     to a directory whose node_modules contains it
 *     (e.g. a scratch dir where you ran `npm install playwright-core`).
 *   - A Chromium executable at CNB_UAT_CHROMIUM, or the default
 *     ms-playwright cache path below.
 *
 * Optional: CNB_UAT_PORT (default 8143), CNB_UAT_SHOTS (screenshot dir,
 * default <os tmpdir>/cnb-uat).
 *
 * Exit code 0 = all checks passed; 1 = at least one check failed.
 */
import http from "http";
import os from "os";
import { readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8143);
const EXE = process.env.CNB_UAT_CHROMIUM ||
  "C:/Users/denmi/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const SHOT_DIR = process.env.CNB_UAT_SHOTS || path.join(os.tmpdir(), "cnb-uat");

// ── Dependency resolution (explicit errors, no silent fallbacks) ────────────
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright-core"));
} catch {
  const alt = process.env.CNB_UAT_PLAYWRIGHT;
  if (!alt) {
    console.error(
      "playwright-core not found. Run `npm install playwright-core` next to " +
      "this repo, or set CNB_UAT_PLAYWRIGHT to a directory whose " +
      "node_modules contains it.");
    process.exit(2);
  }
  ({ chromium } = createRequire(path.join(alt, "resolve-anchor.js"))("playwright-core"));
}
if (!existsSync(EXE)) {
  console.error(
    `Chromium executable not found at ${EXE}. Set CNB_UAT_CHROMIUM to a ` +
    "Chromium/Chrome binary (e.g. from the ms-playwright cache).");
  process.exit(2);
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

// ── Checklist harness ────────────────────────────────────────────────────────
const results = [];
let failCount = 0;
function check(label, cond, detail = "") {
  const ok = !!cond;
  if (!ok) failCount++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? "  [" + detail + "]" : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });

const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

await page.goto(`http://localhost:${PORT}/cnb/test-pages/test-staff-rule-editor.html`);
await page.waitForSelector(".cnb-staff-rule-editor");

const readJson = async () => JSON.parse(await page.textContent("#config-json"));
const derivedText = async () => (await page.textContent(".cnb-sre-derived")) || "";
const staffLineCount = async () => page.evaluate(() =>
  document.querySelector("#preview-host .cnb-staff").children.length);
const staffLineAttr = async (i, attr) => page.evaluate(([i, attr]) =>
  document.querySelector("#preview-host .cnb-staff").children[i].getAttribute(attr), [i, attr]);
const ledgerCount = async (col) => page.evaluate((col) =>
  document.querySelectorAll("#preview-host .cnb-ledger-set")[col].children.length, col);
const markerCount = async () => page.evaluate(() =>
  document.querySelectorAll("#preview-host .cnb-sre-preview-note").length);

// ── Initial state ────────────────────────────────────────────────────────────
check('PAGE title contains "Staff/Ledger Rule Editor"', (await page.title()).includes("Staff/Ledger Rule Editor"));
check("PATTERN LIST has 3 options, 4–8 selected",
  await page.evaluate(() => {
    const opts = document.querySelectorAll(".cnb-sre-pattern-option");
    const sel = document.querySelector(".cnb-sre-pattern-option.selected");
    return opts.length === 3 && sel && sel.dataset.patternKey === "4-8";
  }));
const d0 = await derivedText();
check("DERIVED PANEL sps 4, midpoint 12, LY positions (-2 -1 1 2)",
  d0.includes("Semitones per staff space: 4") && d0.includes("Staff midpoint: 12") && d0.includes("(-2 -1 1 2)"), d0);
check("PREVIEW staff lines: 4 (semis 4, 8, 16, 20)", (await staffLineCount()) === 4, String(await staffLineCount()));
check("PREVIEW note columns: 25 markers (chromatic 0–24)", (await markerCount()) === 25);
check("PREVIEW column C (semi 0) shows 1 ledger", (await ledgerCount(0)) === 1);
check("PREVIEW column D (semi 2) shows 2 ledgers (C + D)", (await ledgerCount(2)) === 2);
check("PREVIEW column F (semi 5) shows 0 ledgers (inside staff)", (await ledgerCount(5)) === 0);
check("PREVIEW column C'' (semi 24) shows 1 ledger (octave-aware upper C)", (await ledgerCount(24)) === 1);
let j = await readJson();
check("JSON PANEL staff.semitonePattern [4,8], sps 4",
  JSON.stringify(j.staff.semitonePattern) === "[4,8]" && j.staff.semitonesPerStaffSpace === 4);
check("JSON PANEL ledgers: 3 templates, proximityRule true",
  j.ledgers.templates.length === 3 && j.ledgers.proximityRule === true);
check("VALIDATION shows Config valid", await page.evaluate(() => !!document.querySelector(".cnb-sre-valid")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s1-initial.png"), fullPage: true });

// ── Change the staff pattern ────────────────────────────────────────────────
await page.click('[data-pattern-key="3-6-9"]');
const d1 = await derivedText();
check("CLICK 3-6-9: derived sps 3, LY positions (-3 -2 -1 1 2 3)",
  d1.includes("Semitones per staff space: 3") && d1.includes("(-3 -2 -1 1 2 3)"), d1);
check("CLICK 3-6-9: preview staff lines now 6", (await staffLineCount()) === 6, String(await staffLineCount()));
j = await readJson();
check("CLICK 3-6-9: JSON semitonePattern [3,6,9]", JSON.stringify(j.staff.semitonePattern) === "[3,6,9]");
check("CLICK 3-6-9: override rows follow pattern (3 rows)",
  await page.evaluate(() => document.querySelectorAll(".cnb-sre-override-row").length === 3));

// ── Add a line override ─────────────────────────────────────────────────────
await page.click('.cnb-sre-override-row[data-line-pc="3"] .cnb-sre-override-check');
j = await readJson();
check("ENABLE OVERRIDE semi 3: seeded from defaults (thicknessPct 20)",
  j.staff.lineOverrides["3"] && j.staff.lineOverrides["3"].thicknessPct === 20);
await page.evaluate(() => {
  const inp = document.querySelector('.cnb-sre-override-row[data-line-pc="3"] .cnb-sre-color');
  inp.value = "#cc0000";
  inp.dispatchEvent(new Event("input", { bubbles: true }));
});
j = await readJson();
check('SET OVERRIDE COLOR: JSON lineOverrides["3"].color = #cc0000', j.staff.lineOverrides["3"].color === "#cc0000");
check("PREVIEW: semi-3 lines (abs 3 and 15) stroke #cc0000, others still black",
  (await staffLineAttr(0, "stroke")) === "#cc0000" &&
  (await staffLineAttr(3, "stroke")) === "#cc0000" &&
  (await staffLineAttr(1, "stroke")) === "#000000");
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s1-override.png"), fullPage: true });

// ── Add a ledger template ───────────────────────────────────────────────────
check("BEFORE TEMPLATE: column F (semi 5) has 0 ledgers", (await ledgerCount(5)) === 0);
await page.click(".cnb-sre-template-add");
j = await readJson();
check("ADD TEMPLATE: 4 template rows, new one at position 0 triggered by C",
  j.ledgers.templates.length === 4 && j.ledgers.templates[3].semiWithinOctave === 0 &&
  JSON.stringify(j.ledgers.templates[3].triggerPCs) === "[0]");
await page.selectOption('.cnb-sre-template-row[data-template-index="3"] .cnb-sre-template-pos', "5");
await page.click('.cnb-sre-template-row[data-template-index="3"] .cnb-sre-trigger-pill[data-pc="5"]');
await page.click('.cnb-sre-template-row[data-template-index="3"] .cnb-sre-trigger-pill[data-pc="0"]');
j = await readJson();
check("EDIT TEMPLATE: position 5 (F), triggerPCs [5]",
  j.ledgers.templates[3].semiWithinOctave === 5 && JSON.stringify(j.ledgers.templates[3].triggerPCs) === "[5]");
check("PREVIEW: column F (semi 5) now shows 1 ledger", (await ledgerCount(5)) === 1);
check("PREVIEW: column F' (semi 17) shows the same per-octave ledger", (await ledgerCount(17)) === 1);
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s1-template.png"), fullPage: true });

// ── Validation pass-through on a degenerate custom pattern ─────────────────
await page.click('[data-pattern-key="custom"]');
check("CLICK CUSTOM: PC toggles shown, seeded from 3-6-9",
  await page.evaluate(() => {
    const on = [...document.querySelectorAll(".cnb-sre-pc-toggle.on")].map(b => b.dataset.pc);
    return JSON.stringify(on) === '["3","6","9"]';
  }));
await page.click('.cnb-sre-pc-toggle[data-pc="6"]');
await page.click('.cnb-sre-pc-toggle[data-pc="9"]');
check("REMOVE LINES DOWN TO 1: validation error 'at least 2' shown, no valid banner",
  await page.evaluate(() => {
    const errs = [...document.querySelectorAll(".cnb-sre-error")].map(e => e.textContent);
    return errs.some(t => t.includes("at least 2")) && !document.querySelector(".cnb-sre-valid");
  }));
check("DEGENERATE PATTERN: derived panel shows the shortfall",
  await page.evaluate(() => !!document.querySelector(".cnb-sre-derived-error")));
await page.click('.cnb-sre-pc-toggle[data-pc="6"]');
check("RESTORE 2ND LINE: config valid again",
  await page.evaluate(() => !!document.querySelector(".cnb-sre-valid")));
await page.screenshot({ path: path.join(SHOT_DIR, "uat-s1-custom.png"), fullPage: true });

// ── No errors ────────────────────────────────────────────────────────────────
check("NO console or page errors across the whole flow", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
