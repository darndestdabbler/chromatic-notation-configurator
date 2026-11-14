/**
 * screenshot.mjs: screenshots each notehead-first mock-up, full page, at
 * 1440 and 1280 px wide, into shots/<page>-<width>.png.
 *
 *   node docs/planning/notehead-first-mockups/screenshot.mjs [page ...]
 *
 * Serves the repository root (the mock-ups import cnb/src modules) and
 * finds Chromium the way the UAT drivers do: CNB_UAT_CHROMIUM, else the
 * newest chromium-* in the ms-playwright cache. Needs `npm install`.
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
const PAGES = process.argv.slice(2).length ? process.argv.slice(2)
  : ["01-editor", "02-notehead", "03-pitch", "04-rules"];
const WIDTHS = [1440, 1280];
const PORT = Number(process.env.CNB_MOCKUP_PORT || 8157);

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
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

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

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ executablePath: exe });
let failed = 0;
try {
  await mkdir(path.join(HERE, "shots"), { recursive: true });
  for (const name of PAGES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(`http://localhost:${PORT}/docs/planning/notehead-first-mockups/${name}.html`);
      await page.waitForSelector("body[data-ready]", { timeout: 15000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const out = path.join(HERE, "shots", `${name}-${width}.png`);
      await page.screenshot({ path: out, fullPage: true });
      const note = overflow > 0 ? ` HORIZONTAL OVERFLOW ${overflow}px` : "";
      if (errors.length || overflow > 0) failed++;
      console.log(`${name} @ ${width}: ${path.relative(ROOT, out)}${note}${errors.length ? " ERRORS: " + errors.join("; ") : ""}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
