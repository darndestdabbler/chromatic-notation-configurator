/**
 * uat-site.mjs — Playwright UAT driver for the published site (session 15).
 *
 * 1. Assembles the site with cnb/site/assemble-site.mjs into a temp
 *    directory, serves that directory over HTTP and loads `/`: the preview
 *    renders (staff lines and noteheads), every editor mounts, the file://
 *    notice is absent, and no page error, console error or failed request
 *    (such as a /favicon.ico 404) is logged.
 * 2. Loads the working tree's cnb/index.html over file://: the notice is
 *    visible and links to the live site.
 *
 * The Google Fonts CDN requests are stubbed, as in the other drivers.
 *
 * Usage: node cnb/uat/uat-site.mjs
 *
 * Requirements (exit 2 when missing): playwright-core in the repo's
 * node_modules (`npm install`) or under CNB_UAT_PLAYWRIGHT; a Chromium from
 * CNB_UAT_CHROMIUM or the ms-playwright cache.
 * Optional: CNB_UAT_PORT (default 8160).
 *
 * Exit code 0 = all checks passed; 1 = at least one check failed.
 */
import http from "http";
import os from "os";
import { readFile, mkdtemp, rm } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CNB = path.resolve(__dirname, "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8160);
const LIVE_URL = "https://configurator.darndestdabbler.org/";

// ── Dependency resolution (explicit errors, no silent fallbacks) ────────────
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright-core"));
} catch {
  const alt = process.env.CNB_UAT_PLAYWRIGHT;
  if (!alt) {
    console.error("playwright-core not found. Run `npm install` at the repository root, " +
      "or set CNB_UAT_PLAYWRIGHT to a directory whose node_modules contains it.");
    process.exit(2);
  }
  try {
    ({ chromium } = createRequire(path.join(alt, "resolve-anchor.js"))("playwright-core"));
  } catch (err) {
    console.error(`playwright-core could not be resolved from CNB_UAT_PLAYWRIGHT=${alt} (${err.message}).`);
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
    console.error("No Chromium found in the ms-playwright cache. Set CNB_UAT_CHROMIUM to " +
      "a Chromium/Chrome binary, or install one (npx playwright install chromium).");
    process.exit(2);
  }
}

// ── Assemble the site and serve it (no special case for /favicon.ico) ──────
const SITE = await mkdtemp(path.join(os.tmpdir(), "cnb-uat-site-"));
const assembled = spawnSync(process.execPath, [path.join(CNB, "site", "assemble-site.mjs"), SITE],
  { stdio: "inherit" });
if (assembled.status !== 0) {
  console.error("assemble-site.mjs failed");
  process.exit(1);
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const file = path.join(SITE, urlPath);
    if (!path.resolve(file).startsWith(path.resolve(SITE))) {
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

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.route("https://fonts.googleapis.com/**", route =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", route =>
    route.fulfill({ status: 200, contentType: "font/woff2", body: "" }));
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { page, errors };
}

// ── 1. The assembled site over HTTP ─────────────────────────────────────────
{
  const { page, errors } = await newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.waitForSelector(".cnb-pvd-preview .pc-col", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300); // let any late console error or request land

  check('SITE: "/" serves the configurator',
    (await page.title()) === "Chromatic Notation Configurator", await page.title());
  const counts = await page.evaluate(() => ({
    staffLines: document.querySelectorAll(".cnb-pvd-preview .staff-lines-bg line").length,
    noteheads: document.querySelectorAll(".cnb-pvd-preview svg.note-slice path").length,
  }));
  check("SITE: the preview renders staff lines and noteheads",
    counts.staffLines > 0 && counts.noteheads > 0, JSON.stringify(counts));
  const emptyHosts = await page.$$eval('[id$="-host"]', els =>
    els.filter(el => el.children.length === 0).map(el => el.id));
  check("SITE: the preview and every editor mount", emptyHosts.length === 0, emptyHosts.join(", "));
  check("SITE: no file:// notice over HTTP", (await page.$("#file-notice")) === null);
  check("SITE: no page errors, console errors or failed requests", errors.length === 0, errors.join(" | "));
  await page.close();
}

// ── 2. The working tree's cnb/index.html over file:// ───────────────────────
{
  const { page } = await newPage();
  await page.goto(pathToFileURL(path.join(CNB, "index.html")).href, { waitUntil: "load" });
  const notice = await page.$("#file-notice");
  check("FILE: the notice is visible", notice !== null && await notice.isVisible());
  const href = notice && await notice.$eval("a", a => a.getAttribute("href")).catch(() => null);
  check("FILE: the notice links to the live site", href === LIVE_URL, String(href));
  const text = notice ? await notice.textContent() : "";
  check("FILE: the notice gives the two local commands and the page to open",
    text.includes("npx serve .") && text.includes("python -m http.server 8000") &&
    text.includes("/cnb/index.html"), text);
  await page.close();
}

await browser.close();
server.close();
await rm(SITE, { recursive: true, force: true });

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
process.exit(failCount === 0 ? 0 : 1);
