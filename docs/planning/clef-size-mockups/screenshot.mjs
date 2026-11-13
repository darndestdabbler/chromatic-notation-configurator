/**
 * screenshot.mjs: screenshots the clef-size mock-ups (index.html) at
 * 1280 px wide, one shot per section: #clefs into shots/clefs.png.
 *
 *   node docs/planning/clef-size-mockups/screenshot.mjs
 *
 * Serves the repository root (the mock-ups import cnb/src modules and the
 * fixtures) and finds Chromium the way the UAT drivers do: CNB_UAT_CHROMIUM,
 * else the newest chromium-* in the ms-playwright cache. Needs `npm install`.
 * Adapted from the session-58 mock-ups' script.
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
const SECTIONS = ["clefs"];
const WIDTH = 1280;
const PORT = Number(process.env.CNB_MOCKUP_PORT || 8160);

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

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ executablePath: exe });
let failed = 0;
try {
  await mkdir(path.join(HERE, "shots"), { recursive: true });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/docs/planning/clef-size-mockups/index.html`);
  await page.waitForSelector("body[data-ready]", { timeout: 15000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  // What the mock-up shows: each caption's height, and each glyph clef's
  // drawn ink, against today's size (LilyPond's staff spaces) and the
  // automatic one (its symbol spaces): the treble clef, for example, 7.319 × 4
  // = 29.276 and 7.319 × 2.724 = 19.937 semitones on the default staff.
  const WANT = {
    default: { sps: 4, unit: 2.724 },
    kite: { sps: 3, unit: 3 },
  };
  const SIZE = { treble: 1829.75 / 250, bass: 776 / 250, alto: 1000 / 250, dozenal: 3 };
  const cases = await page.evaluate(() => [...document.querySelectorAll(".notation")].flatMap(n =>
    [...n.querySelectorAll(".variant")].map(v => {
      const caption = v.querySelector(".caption");
      const path = v.querySelector("g.cnb-clef path");
      return { notation: n.dataset.notation, clef: caption.dataset.clef, variant: caption.dataset.variant,
        height: Number(caption.dataset.height), drawn: path && caption.dataset.clef !== "dozenal"
          ? path.getBoundingClientRect().height : null };
    })));
  const PX_PER_SEMI = 9;
  if (cases.length !== 16) { console.log(`EXPECTED 16 CASES, GOT ${cases.length}`); failed++; }
  for (const c of cases) {
    const w = WANT[c.notation];
    const want = SIZE[c.clef] * (c.variant === "today" ? w.sps : w.unit);
    if (!(Math.abs(c.height - want) < 0.001)) {
      console.log(`WRONG HEIGHT ${c.notation} ${c.clef} ${c.variant}: ${c.height} semitones, want ${want}`);
      failed++;
    }
    if (c.drawn !== null && !(Math.abs(c.drawn - want * PX_PER_SEMI) < 1)) {
      console.log(`WRONG DRAWN HEIGHT ${c.notation} ${c.clef} ${c.variant}: ${c.drawn} px, want ${want * PX_PER_SEMI}`);
      failed++;
    }
  }
  console.log(`${cases.length} cases checked`);
  for (const id of SECTIONS) {
    const out = path.join(HERE, "shots", `${id}.png`);
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
