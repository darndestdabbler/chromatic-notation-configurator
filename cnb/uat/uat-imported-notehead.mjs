/**
 * uat-imported-notehead.mjs — Session 17: the preview draws an imported
 * notehead at its own height at once.
 *
 * On 2026-11-05 the operator imported a 4-semitone notehead (the draft of
 * cnb/fixtures/45deg.svg) and applied it in the Default rule. The preview
 * drew it at about 3 semitones or less until an unrelated notehead colour
 * edit redrew it. The default config's crotchet-minim is 2.724 semitones
 * tall, so the preview was showing the head at the old shape's height.
 *
 * This driver imports cnb/fixtures/45deg.svg into cnb/index.html, selects it
 * as a rule's shape, and measures every notehead the preview draws before
 * any further edit. Each must be 4 × pxPerSemi tall. It then makes the
 * unrelated edit (the Default rule's colour set to a custom hex) and
 * measures again: same heights, same shape in the shared config. Routes:
 *
 *   1. Kite 4-369 config loaded, file-input import, Default rule's shape select.
 *   2. Default config (the operator's start), file-input import, Default rule.
 *   3. Default config, drag-and-drop import, a new rule with Shape enabled.
 *
 * Finding (session 17): the stale height did not reproduce. These three
 * routes, a same-name re-import of a 3-semitone version, and the operator's
 * own sequence in six orders (import, 3-6-9 staff, keys and key signature,
 * repeat mode, ledger removal, rule shape) all drew the head at 64 px
 * (4 semitones at 16 px per semitone) immediately, in Chromium, Edge and
 * Firefox. The operator could not recall a further difference. Every path
 * from import to preview is synchronous: index.html stores the new shape in
 * the shared config, re-mounts the editors and redraws the preview, and
 * the rule editor's shape change redraws it again with the new rules. The
 * driver pins that behaviour, so a regression on any of these routes fails here.
 *
 * Dependency resolution, env vars and exit codes are the same as
 * uat-kite-pipeline.mjs (playwright-core plus ms-playwright cache Chromium;
 * exit 2 = missing dependency, 1 = check failure, 0 = all passed).
 *
 * Usage: node cnb/uat/uat-imported-notehead.mjs
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
const KITE = path.join(ROOT, "cnb", "fixtures", "kite-4-369-config.json");
const SVG = path.join(ROOT, "cnb", "fixtures", "45deg.svg");
const PORT = Number(process.env.CNB_UAT_PORT || 8151);

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
      "a Chromium/Chrome binary, or install one (npx playwright install chromium).");
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

const svgText = await readFile(SVG, "utf8");
const browser = await chromium.launch({ executablePath: EXE });
const consoleErrors = [];

async function openApp() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1800 } });
  await page.route("https://fonts.googleapis.com/**", route =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", route =>
    route.fulfill({ status: 200, contentType: "font/woff2", body: "" }));
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", e => consoleErrors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/cnb/index.html`);
  await page.waitForSelector(".cnb-preview-display");
  return page;
}

const fullConfig = async (page) => JSON.parse(await page.textContent("#state-json"));

/** Drawn height (px, rounded) of every notehead in the preview. */
const headHeights = (page) => page.$$eval(
  ".cnb-pvd-preview svg.note-slice g[transform^='translate']",
  gs => gs.map(g => Math.round(g.getBoundingClientRect().height)));

async function importByInput(page) {
  await page.setInputFiles('#svg-importer-host input[type="file"]', {
    name: "45deg.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svgText),
  });
  await page.waitForFunction(() =>
    document.getElementById("import-status").textContent.includes('"45deg"'));
}

async function importByDrop(page) {
  await page.evaluate((text) => {
    const dt = new DataTransfer();
    dt.items.add(new File([text], "45deg.svg", { type: "image/svg+xml" }));
    document.querySelector("#svg-importer-host .cnb-svg-drop-zone")
      .dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, svgText);
  await page.waitForFunction(() =>
    document.getElementById("import-status").textContent.includes('"45deg"'));
}

const rule = (i) => `.cnb-nre-rule-card[data-rule-index="${i}"]`;

const ROUTES = [
  {
    name: "Kite config, file input, Default rule",
    setup: async (page) => {
      await page.setInputFiles(".cnb-cio-file", KITE);
      await page.waitForFunction(() =>
        JSON.parse(document.getElementById("state-json").textContent).shapes["kite-up"] !== undefined);
    },
    importShape: importByInput,
    apply: async (page) => { await page.selectOption(`${rule(0)} .cnb-nre-shape-select`, "45deg"); return 0; },
  },
  {
    name: "default config, file input, Default rule",
    setup: async () => {},
    importShape: importByInput,
    apply: async (page) => { await page.selectOption(`${rule(0)} .cnb-nre-shape-select`, "45deg"); return 0; },
  },
  {
    name: "default config, drag-and-drop, new rule",
    setup: async () => {},
    importShape: importByDrop,
    apply: async (page) => {
      await page.click(".cnb-nre-rule-add");
      const idx = (await page.$$(".cnb-nre-rule-card")).length - 1;
      await page.check(`${rule(idx)} .cnb-nre-apply-shape input`);
      await page.selectOption(`${rule(idx)} .cnb-nre-shape-select`, "45deg");
      return idx;
    },
  },
];

for (const route of ROUTES) {
  const page = await openApp();
  await route.setup(page);
  await route.importShape(page);

  let cfg = await fullConfig(page);
  const expected = cfg.shapes["45deg"].semitoneHeight * cfg.display.pxPerSemi;
  check(`${route.name}: the imported shape is 4 semitones tall`,
    cfg.shapes["45deg"].semitoneHeight === 4, JSON.stringify(cfg.shapes["45deg"].semitoneHeight));

  const idx = await route.apply(page);
  cfg = await fullConfig(page);
  check(`${route.name}: the rule's shape reaches the shared config`,
    cfg.noteheadRules[idx].apply.shape === "45deg", JSON.stringify(cfg.noteheadRules[idx].apply));

  // On the Kite route a later rule keeps kite-up on some pitch classes;
  // kite-up is also 4 semitones tall, so every head must measure the same.
  const heights = await headHeights(page);
  check(`${route.name}: every preview notehead is ${expected} px (4 semitones) at once`,
    heights.length > 0 && heights.every(h => h === expected),
    `heights ${JSON.stringify([...new Set(heights)])}`);

  // The unrelated edit: the Default rule's colour set to a custom hex.
  await page.check(`${rule(0)} .cnb-nre-apply-color input`);
  await page.selectOption(`${rule(0)} .cnb-nre-color-mode`, "custom");
  const after = await headHeights(page);
  cfg = await fullConfig(page);
  check(`${route.name}: an unrelated colour edit leaves every head's height unchanged`,
    cfg.noteheadRules[0].apply.color === "#000000" &&
    JSON.stringify(after) === JSON.stringify(heights),
    `before ${JSON.stringify([...new Set(heights)])} after ${JSON.stringify([...new Set(after)])}`);

  await page.close();
}

check("NO console or page errors on any route", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
process.exit(failCount === 0 ? 0 : 1);
