/**
 * uat-site.mjs — Playwright UAT driver for the published site (session 15).
 *
 * 1. Assembles the site with cnb/site/assemble-site.mjs into a temp
 *    directory, serves that directory over HTTP and loads `/`: the preview
 *    renders (staff lines and noteheads), every editor mounts, the file://
 *    notice is absent, and no page error, console error or failed request
 *    (such as a /favicon.ico 404) is logged. The page requests nothing
 *    outside the site's own origin (session 29): Oswald is served from the
 *    site, and the labels are drawn in it.
 * 2. Loads the working tree's cnb/index.html over file://: the notice is
 *    visible and links to the live site.
 * 3. The tutorial (session 68): on the assembled site the header's Tutorial
 *    link leads to /tutorial/, whose every picture loads and every download
 *    answers, with no error or failed request; opened from the repository
 *    (docs/playbook/tutorial/index.html over file://), every picture loads
 *    and every relative link names a file that exists.
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
      "a Chromium/Chrome binary, or install one (npx playwright-core install chromium).");
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
  ".svg": "image/svg+xml", ".json": "application/json", ".ttf": "font/ttf",
  ".png": "image/png", ".ly": "text/plain",
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
  const errors = [];
  const requests = [];
  page.on("request", r => requests.push(r.url()));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { page, errors, requests };
}

// ── 1. The assembled site over HTTP ─────────────────────────────────────────
{
  const { page, errors, requests } = await newPage();
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
  // The notehead panel's host fills only while a notehead is selected
  // (session 27, design §2).
  const emptyHosts = await page.$$eval('[id$="-host"]', els =>
    els.filter(el => el.children.length === 0 && el.id !== "notehead-panel-host").map(el => el.id));
  check("SITE: the preview and every editor mount", emptyHosts.length === 0, emptyHosts.join(", "));
  check("SITE: no file:// notice over HTTP", (await page.$("#file-notice")) === null);
  check("SITE: no page errors, console errors or failed requests", errors.length === 0, errors.join(" | "));
  const origin = `http://localhost:${PORT}`;
  const foreign = requests.filter(u => !u.startsWith("data:") && new URL(u).origin !== origin);
  check("SITE: every request stays on the site's own origin", foreign.length === 0, foreign.join(" | "));
  const oswald = await page.evaluate(async () => {
    await document.fonts.ready;
    const label = document.querySelector(".cnb-pvd-preview .cnb-label-card");
    return {
      loaded: document.fonts.check('16px "Oswald"') &&
        [...document.fonts].some(f => f.family.replace(/"/g, "") === "Oswald" && f.status === "loaded"),
      family: label ? getComputedStyle(label).fontFamily : null,
    };
  });
  check("SITE: Oswald loads from the site and the labels use it",
    oswald.loaded && requests.some(u => u === `${origin}/assets/fonts/oswald-variable.ttf`) &&
    /Oswald/.test(oswald.family || ""), JSON.stringify(oswald));
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
    text.includes("/cnb/ on that server"), text);
  await page.close();
}

// ── 3. The tutorial, on the site and from the repository (session 68) ───────
/** The page's pictures (each loaded or not) and its relative links,
 *  resolved against the page. */
const tutorialParts = (page) => page.evaluate(async () => {
  await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
  return {
    title: document.title,
    steps: document.querySelectorAll('section[id^="step-"]').length,
    images: [...document.images].map(img => ({ src: img.src, ok: img.complete && img.naturalWidth > 0 })),
    links: [...document.querySelectorAll("a[href]")]
      .filter(a => !/^(?:[a-z]+:|#)/i.test(a.getAttribute("href")))
      .map(a => a.href.split("#")[0]),
  };
});
{
  const { page, errors } = await newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  const link = await page.$("#tutorial-link");
  const href = link && await link.evaluate(a => a.href);
  check('TUTORIAL: the header\'s Tutorial link leads to "/tutorial/"', href === `http://localhost:${PORT}/tutorial/`, String(href));
  await page.goto(`http://localhost:${PORT}/tutorial/`, { waitUntil: "load" });
  const parts = await tutorialParts(page);
  check("TUTORIAL: /tutorial/ serves the tutorial, a section for each of the twelve steps",
    parts.title === "Configurator Tutorial" && parts.steps === 12, JSON.stringify({ title: parts.title, steps: parts.steps }));
  const broken = parts.images.filter(i => !i.ok).map(i => i.src);
  check("TUTORIAL: every picture on /tutorial/ loads", parts.images.length > 0 && broken.length === 0, broken.join(" | "));
  const downloads = [...new Set(parts.links.filter(u => u.includes("/tutorial/downloads/")))];
  const failed = [];
  for (const u of downloads) {
    const status = await page.evaluate(async (u) => (await fetch(u)).status, u);
    if (status !== 200) failed.push(`${status} ${u}`);
  }
  check("TUTORIAL: every download on /tutorial/ answers 200", downloads.length >= 6 && failed.length === 0,
    `${downloads.length} downloads; ${failed.join(" | ")}`);
  check("TUTORIAL: no page errors, console errors or failed requests on /tutorial/", errors.length === 0, errors.join(" | "));
  await page.close();
}
{
  const { page, errors } = await newPage();
  await page.goto(pathToFileURL(path.join(CNB, "..", "docs", "playbook", "tutorial", "index.html")).href, { waitUntil: "load" });
  const parts = await tutorialParts(page);
  check("TUTORIAL (repository): the page opens over file://, a section for each of the twelve steps",
    parts.title === "Configurator Tutorial" && parts.steps === 12, JSON.stringify({ title: parts.title, steps: parts.steps }));
  const broken = parts.images.filter(i => !i.ok).map(i => i.src);
  check("TUTORIAL (repository): every picture loads", parts.images.length > 0 && broken.length === 0, broken.join(" | "));
  const missing = [...new Set(parts.links)].filter(u => !existsSync(fileURLToPath(u)));
  check("TUTORIAL (repository): every relative link names a file that exists",
    parts.links.length > 0 && missing.length === 0, missing.join(" | "));
  check("TUTORIAL (repository): no page errors or console errors", errors.length === 0, errors.join(" | "));
  await page.close();
}

await browser.close();
server.close();
await rm(SITE, { recursive: true, force: true });

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
process.exit(failCount === 0 ? 0 : 1);
