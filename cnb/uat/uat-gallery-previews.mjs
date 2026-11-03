/**
 * uat-gallery-previews.mjs — capture a preview PNG for each set-011 gallery
 * reproduction fixture, for the human side-by-side UAT (spec session-1 step 5).
 *
 * Each fixture is loaded through the EXACT UI pipeline (CNBConfigIO.loadFromText
 * → the same merge/REPLACE_PATHS/validate a JSON load performs) and rendered by
 * CNBCollection.render() — the real preview renderer — as the full chromatic
 * row (PCs 0–12) at crotchet. The rendered preview is screenshotted at 2×
 * device scale into a UAT package directory the operator can open alongside the
 * published gallery images.
 *
 * Usage (paths resolve relative to this file):
 *   node cnb/uat/uat-gallery-previews.mjs
 * Output dir: CNB_UAT_GALLERY_OUT (default C:\temp\cnb-gallery-uat on win32,
 * else <os tmpdir>/cnb-gallery-uat).
 *
 * Dependencies resolved with explicit errors, no silent fallbacks (set-005
 * lesson): playwright-core (or CNB_UAT_PLAYWRIGHT) + a Chromium binary
 * (CNB_UAT_CHROMIUM, else the newest ms-playwright cache revision).
 * Exit 0 = every fixture captured; 2 = setup/dependency error; 1 = a capture
 * produced no preview element.
 */
import http from "http";
import os from "os";
import { readFile, mkdir, writeFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const GALLERY_DIR = path.join(ROOT, "cnb", "assets", "examples", "gallery");
const PORT = Number(process.env.CNB_UAT_PORT || 8151);
const OUT_DIR = process.env.CNB_UAT_GALLERY_OUT ||
  (process.platform === "win32" ? "C:\\temp\\cnb-gallery-uat" : path.join(os.tmpdir(), "cnb-gallery-uat"));

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
await mkdir(OUT_DIR, { recursive: true });

// ── HTML capture shell (served at /__gallery_capture) ───────────────────────
const CAPTURE_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: system-ui, sans-serif; background:#fff; margin:0; padding:24px; }
  #card { background:#fff; display:inline-block; padding:20px; }
</style></head><body>
<div id="card"></div>
<script type="module">
  import { CNBConfigIO } from "/cnb/ui/config-io.js";
  import { CNBCollection } from "/cnb/src/cnb-collection.js";
  window.__renderFixture = (text) => {
    const card = document.getElementById("card");
    card.textContent = "";
    const { config, validation } = CNBConfigIO.loadFromText(text);
    // The displayed key is EXAMPLE DATA (architecture principle 1): a key
    // signature only renders when the collection is given a selected key.
    // For keysig-enabled fixtures (set-010 Tier-2 systems) supply the
    // fixture's own first key definition so its signature is captured.
    const ks = (config.keys || {});
    const keys = (ks.enabled && (ks.keySignature||{}).enabled && (ks.definitions||[]).length)
      ? [ks.definitions[0].name] : null;
    CNBCollection.render(card, config, { pitchClasses: [0,1,2,3,4,5,6,7,8,9,10,11,12], durations: ["crotchet"], keys });
    return { valid: validation.valid, errors: validation.errors, label: (config.meta||{}).notationLabel || "", key: keys ? keys[0] : null };
  };
</script></body></html>`;

// ── Static server ────────────────────────────────────────────────────────────
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath === "/__gallery_capture") {
      res.writeHead(200, { "Content-Type": "text/html" }); res.end(CAPTURE_HTML); return;
    }
    if (urlPath === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    const file = path.join(ROOT, urlPath);
    if (!path.resolve(file).startsWith(path.resolve(ROOT))) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise(r => server.listen(PORT, r));

// ── Capture ──────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1700, height: 700 }, deviceScaleFactor: 2 });
// Stub Google Fonts (preview-only cosmetics) so capture never depends on the CDN.
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));

const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push(String(e)));

await page.goto(`http://localhost:${PORT}/__gallery_capture`, { waitUntil: "networkidle" });

const files = readdirSync(GALLERY_DIR).filter(f => f.endsWith(".json")).sort();
const manifest = [];
let failed = 0;

for (const f of files) {
  const slug = f.replace(/\.json$/, "");
  const text = await readFile(path.join(GALLERY_DIR, f), "utf8");
  const info = await page.evaluate(t => window.__renderFixture(t), text);
  const card = await page.$("#card .cnb-preview");
  if (!card) { console.log(`  ✗ ${slug}: no preview element rendered`); failed++; continue; }
  const shot = path.join(OUT_DIR, `${slug}.png`);
  await card.screenshot({ path: shot });
  manifest.push({ slug, label: info.label, valid: info.valid, key: info.key, png: shot });
  console.log(`  ✓ ${slug}${info.key ? " [key " + info.key + "]" : ""} → ${shot}${info.valid ? "" : "  (VALIDATION ERRORS: " + info.errors.join("; ") + ")"}`);
}

await writeFile(path.join(OUT_DIR, "manifest.json"),
  JSON.stringify({ generated: "set-011", count: manifest.length, fixtures: manifest }, null, 2));

await browser.close();
await new Promise(r => server.close(r));

console.log(`\n${manifest.length}/${files.length} previews captured into ${OUT_DIR}`);
if (consoleErrors.length) {
  console.log(`\nConsole/page errors (${consoleErrors.length}):`);
  consoleErrors.slice(0, 10).forEach(e => console.log("  - " + e));
}
if (failed > 0) process.exit(1);
