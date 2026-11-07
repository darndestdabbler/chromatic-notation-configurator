/**
 * uat-pitch-axis.mjs — Chromium geometry smoke for the set-014 s2 consumer
 * rethread (cnb/test-pages/test-pitch-axis.html).
 *
 * Loads the test page in a real browser and measures LAID-OUT geometry
 * (getBoundingClientRect), not just attributes:
 *   1. the compact-axis row's background staff draws one line per distinct
 *      axis position (fewer lines than the linear row of the same pattern);
 *   2. shared-pair noteheads (C/C♯, D♯/E, F/F♯, G♯/A, A♯/B) sit at the same
 *      rendered height;
 *   3. offset heads (C♯, E, F♯, A, B) sit 0.85 staff space (27.2 px) right
 *      of their column's unshifted center — the column widens by 27.2 px,
 *      so that is 13.6 px right of its middle — and their stems shift with
 *      them;
 *   4. the linear row ignores the offset (every head centered);
 *   5. no console or page errors.
 *
 * Usage: node cnb/uat/uat-pitch-axis.mjs
 * Dependencies resolved with explicit errors, no silent fallbacks (the
 * repo's driver pattern): playwright-core (or CNB_UAT_PLAYWRIGHT) + a
 * Chromium binary (CNB_UAT_CHROMIUM, else the newest ms-playwright cache
 * revision). Exit 0 = all checks pass; 1 = a check failed; 2 = setup error.
 */
import http from "http";
import os from "os";
import { readFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8152);
const OFFSET_PX = 0.85 * 2 * 16;   // xOffsetStaffSpaces × axisUnitsPerStaffSpace × pxPerSemi
const TOL = 0.5;                    // px

// ── Dependency resolution (explicit errors) ─────────────────────────────────
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright-core"));
} catch {
  const alt = process.env.CNB_UAT_PLAYWRIGHT;
  if (!alt) {
    console.error("playwright-core not found. Run `npm install` at the repository root, or set CNB_UAT_PLAYWRIGHT.");
    process.exit(2);
  }
  try {
    ({ chromium } = createRequire(path.join(alt, "resolve-anchor.js"))("playwright-core"));
  } catch (err) {
    console.error(`playwright-core not resolvable from CNB_UAT_PLAYWRIGHT=${alt} (${err.message}).`);
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
  const revs = readdirSync(cacheRoot).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  const subs = process.platform === "win32"
    ? ["chrome-win64/chrome.exe", "chrome-win/chrome.exe"]
    : process.platform === "darwin"
      ? ["chrome-mac/Chromium.app/Contents/MacOS/Chromium"]
      : ["chrome-linux/chrome"];
  for (const rev of revs) for (const sub of subs) {
    const exe = path.join(cacheRoot, rev, sub);
    if (existsSync(exe)) return exe;
  }
  return null;
}

let EXE;
if (process.env.CNB_UAT_CHROMIUM) {
  EXE = process.env.CNB_UAT_CHROMIUM;
  if (!existsSync(EXE)) { console.error(`CNB_UAT_CHROMIUM does not exist: ${EXE}`); process.exit(2); }
} else {
  EXE = findCachedChromium();
  if (!EXE) { console.error("No Chromium in ms-playwright cache; set CNB_UAT_CHROMIUM."); process.exit(2); }
}

// ── Static server ────────────────────────────────────────────────────────────
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    const file = path.join(ROOT, urlPath);
    if (!path.resolve(file).startsWith(path.resolve(ROOT))) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise(r => server.listen(PORT, r));

// ── Measure ──────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 } });

const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

await page.goto(`http://localhost:${PORT}/cnb/test-pages/test-pitch-axis.html`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__cnbReady === true, null, { timeout: 10000 });

const geometry = await page.evaluate(() => {
  function row(id) {
    const host = document.getElementById(id);
    const staffLines = [...host.querySelectorAll(".staff-lines-bg .cnb-staff > line")]
      .map(l => l.getBoundingClientRect().top + l.getBoundingClientRect().height / 2);
    const cards = [...host.querySelectorAll(".pc-col")].map(col => {
      const slice = col.querySelector("svg.note-slice");
      const sr = slice.getBoundingClientRect();
      const heads = [...slice.children].filter(c => c.tagName === "g" && c.getAttribute("class") !== "cnb-ledger-set");
      const hr = heads[0].getBoundingClientRect();
      const stem = slice.querySelector(":scope > line");
      const st = stem ? stem.getBoundingClientRect() : null;
      return {
        centerX: sr.left + sr.width / 2,
        headX: hr.left + hr.width / 2,
        headY: hr.top + hr.height / 2,
        stemX: st ? st.left + st.width / 2 : null,
      };
    });
    return { staffLines, cards };
  }
  return { axis: row("axis-row"), linear: row("linear-row") };
});

await browser.close();
await new Promise(r => server.close(r));

// ── Checks ───────────────────────────────────────────────────────────────────
let failed = 0;
function check(ok, label) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed++;
}
const near = (a, b) => Math.abs(a - b) <= TOL;
const { axis, linear } = geometry;

const distinctYs = new Set(axis.staffLines.map(y => Math.round(y * 2) / 2));
check(axis.staffLines.length === distinctYs.size, `axis staff: ${axis.staffLines.length} lines, all at distinct heights`);
check(axis.staffLines.length < linear.staffLines.length,
  `axis staff dedup draws fewer lines than linear (${axis.staffLines.length} < ${linear.staffLines.length})`);

check(axis.cards.length === 13 && linear.cards.length === 13, "13 cards per row");
for (const [a, b] of [[0, 1], [3, 4], [5, 6], [8, 9], [10, 11]]) {
  check(near(axis.cards[a].headY, axis.cards[b].headY), `shared pair pc ${a}/${b} at one height`);
}
check(!near(linear.cards[0].headY, linear.cards[1].headY), "linear: C and C♯ at different heights");

const OFFSET_PCS = new Set([1, 4, 6, 9, 11]);
axis.cards.forEach((c, pc) => {
  const expected = OFFSET_PCS.has(pc % 12) ? OFFSET_PX / 2 : 0;   // head sits centerX + offset/2 in its widened column
  check(near(c.headX - c.centerX, expected), `axis pc ${pc}: head ${expected ? "offset" : "centered"} (${(c.headX - c.centerX).toFixed(2)} px)`);
});
// Stems move with their heads: C♯ (offset) vs C (none), both stem up.
const stemRel = c => c.stemX - c.headX;
check(near(stemRel(axis.cards[1]), stemRel(axis.cards[0])), "axis: C♯ stem keeps its attachment relative to the shifted head");
check(axis.cards[0].stemX > axis.cards[0].headX && axis.cards[1].stemX > axis.cards[1].headX, "axis: C and C♯ pairs stem up");
check(linear.cards[1].stemX < linear.cards[1].headX, "linear: C♯ pair stems down");
check(linear.cards.every(c => near(c.headX, c.centerX)), "linear: every head centered (offset ignored)");

check(consoleErrors.length === 0, `no console/page errors${consoleErrors.length ? ": " + consoleErrors.slice(0, 5).join(" | ") : ""}`);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll pitch-axis geometry checks passed.");
process.exit(failed ? 1 : 0);
