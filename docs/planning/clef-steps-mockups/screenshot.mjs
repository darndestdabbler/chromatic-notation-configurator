/**
 * screenshot.mjs: screenshots the Clef steps mock-ups (index.html) at
 * 1280 px wide, one shot per section: #clef-step, #clef-anchors,
 * #stacks-dropdown and #dropdowns into shots/clef-step.png,
 * shots/clef-anchors.png, shots/stacks-dropdown.png and shots/dropdowns.png.
 *
 *   node docs/planning/clef-steps-mockups/screenshot.mjs
 *
 * Checks first that every drawn clef's anchor is on the semitone it sits
 * on, and its left edge 0.75 staff spaces after the staff's start, also
 * after the step's controls choose another clef, anchor and pitch.
 *
 * Serves the repository root (the mock-ups import cnb modules and the
 * tutorial's notation) and finds Chromium the way the UAT drivers do:
 * CNB_UAT_CHROMIUM, else the newest chromium-* in the ms-playwright cache.
 * Needs `npm install`. Adapted from the session-59 mock-ups' script.
 */
import http from "http";
import os from "os";
import path from "path";
import { readFile, mkdir } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const SECTIONS = { "clef-step": "clef-step", "clef-anchors": "clef-anchors",
  "stacks-dropdown": "stacks-dropdown", "dropdowns": "dropdowns" };
const WIDTH = 1280;
const PORT = Number(process.env.CNB_MOCKUP_PORT || 8161);

const { chromium } = createRequire(import.meta.url)("playwright-core");

function findChromium() {
  if (process.env.CNB_UAT_CHROMIUM) return process.env.CNB_UAT_CHROMIUM;
  const cache = process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "ms-playwright")
    : process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
      : path.join(os.homedir(), ".cache", "ms-playwright");
  if (!existsSync(cache)) return null;
  const subs = ["chrome-win64/chrome.exe", "chrome-win/chrome.exe",
    "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-linux/chrome"];
  const revs = readdirSync(cache).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const rev of revs) for (const sub of subs) {
    const exe = path.join(cache, rev, sub);
    if (existsSync(exe)) return exe;
  }
  return null;
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".ttf": "font/ttf" };

const server = http.createServer(async (req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
});

const exe = findChromium();
if (!exe) { console.error("No Chromium: set CNB_UAT_CHROMIUM or run `npx playwright install chromium`."); process.exit(2); }

/** Every drawn clef's anchor on its pitch, and its left edge at 0.75 staff spaces. */
async function checkAnchors(page, label) {
  const hosts = await page.evaluate(() => [...document.querySelectorAll(".preview[data-anchor-y]")].map(h => ({
    id: h.id || h.closest(".case")?.querySelector("h4")?.textContent,
    anchorY: Number(h.dataset.anchorY), pitchY: Number(h.dataset.pitchY), left: Number(h.dataset.left) })));
  let bad = 0;
  for (const h of hosts) {
    if (!(Math.abs(h.anchorY - h.pitchY) < 0.01)) { console.log(`${label}: ${h.id}: anchor at y ${h.anchorY}, its pitch at ${h.pitchY}`); bad++; }
    if (!(Math.abs(h.left - 0.75) < 1e-9)) { console.log(`${label}: ${h.id}: left edge ${h.left} staff spaces`); bad++; }
  }
  console.log(`${label}: ${hosts.length} clefs checked`);
  return { bad, count: hosts.length };
}

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ executablePath: exe });
let failed = 0;
try {
  await mkdir(path.join(HERE, "shots"), { recursive: true });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/docs/planning/clef-steps-mockups/index.html`);
  await page.waitForSelector("body[data-ready]", { timeout: 15000 });

  const first = await checkAnchors(page, "as opened");
  failed += first.bad;
  if (first.count !== 8) { console.log(`EXPECTED 8 CLEFS, GOT ${first.count}`); failed++; }

  // The controls: the imported clef, its anchor at the bottom, on a pitch;
  // then the dozenal clef; then back to the treble clef for the shots.
  const selects = () => page.locator("#step10-options select");
  await selects().nth(0).selectOption("c-clef");
  await selects().nth(1).selectOption("bottom");
  await page.locator("#step11-options select").first().selectOption("7");
  failed += (await checkAnchors(page, "C clef, Bottom, on G")).bad;
  await selects().nth(0).selectOption("dozenal");
  failed += (await checkAnchors(page, "dozenal")).bad;
  await selects().nth(0).selectOption("treble");
  failed += (await checkAnchors(page, "treble again")).bad;

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const [id, shot] of Object.entries(SECTIONS)) {
    const out = path.join(HERE, "shots", `${shot}.png`);
    await page.locator(`#${id}`).screenshot({ path: out });
    console.log(`#${id} @ ${WIDTH}: ${path.relative(ROOT, out)}`);
  }
  if (overflow > 0) console.log(`HORIZONTAL OVERFLOW ${overflow}px`);
  if (errors.length) console.log(`ERRORS: ${errors.join("; ")}`);
  if (errors.length || overflow > 0) failed++;
  await page.close();
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
