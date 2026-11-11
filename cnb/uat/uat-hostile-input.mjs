/**
 * uat-hostile-input.mjs — Playwright UAT driver for hostile input and the
 * browser matrix (session 6 of docs/sessions/session-plan.md).
 *
 * Every other driver follows the golden path in Chromium. This one feeds
 * cnb/index.html what a person exploring will actually hand it — an SVG
 * that is not toolkit output, an SVG without data-lilypond-* attributes, a
 * file that is not XML at all, a save from an older schema version, a
 * truncated JSON file, a JSON file of the wrong shape, a JSON file the app
 * cannot display, and an export of an invalid config — and checks that
 * each one produces a VISIBLE message, leaves the previous state in place
 * where it is refused, and puts nothing on the console. The same checklist
 * runs in Chromium, Firefox and Edge.
 *
 * One exception is pinned (session 29). Malformed XML that still contains an
 * <svg token reaches DOMParser, and Firefox logs every XML parse failure to
 * the console itself: measured with Firefox 157, that case logs exactly one
 * "XML Parsing Error: not well-formed" error. The driver expects that one
 * message in Firefox and nothing in Chromium or Edge, and fails on anything
 * else. (A file with no <svg token is refused before DOMParser sees it, so
 * it logs nothing in any browser.)
 *
 * Usage (from anywhere; paths are resolved relative to this file):
 *   node cnb/uat/uat-hostile-input.mjs
 *
 * Requirements — the driver errors out (exit 2) rather than guessing:
 *   - playwright-core in the repo's node_modules (`npm install`), or set
 *     CNB_UAT_PLAYWRIGHT to a directory whose node_modules contains it.
 *   - Chromium: CNB_UAT_CHROMIUM if set to a non-empty value (a
 *     non-empty-but-invalid path is an error, not a fallback), otherwise the
 *     newest chromium-* browser in the platform's ms-playwright cache
 *     (`npx playwright-core install chromium`).
 *   - Firefox: the Playwright Firefox build matching playwright-core
 *     (`npx playwright-core install firefox`).
 *   - Edge: an installed Microsoft Edge (Playwright channel "msedge").
 *
 * Optional: CNB_UAT_PORT (default 8153), CNB_UAT_SHOTS (screenshot dir,
 * default <os tmpdir>/cnb-uat).
 *
 * Exit code 0 = all checks passed in all three browsers; 1 = at least one
 * check failed; 2 = a prerequisite is missing.
 */
import http from "http";
import os from "os";
import { readFile, mkdir } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { selectNotehead } from "./app-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.CNB_UAT_PORT || 8153);
const SHOT_DIR = process.env.CNB_UAT_SHOTS || path.join(os.tmpdir(), "cnb-uat");

// ── Dependency resolution (explicit errors, no silent fallbacks) ────────────
let playwright;
try {
  playwright = createRequire(import.meta.url)("playwright-core");
} catch {
  const alt = process.env.CNB_UAT_PLAYWRIGHT;
  if (!alt) {
    console.error(
      "playwright-core not found. Run `npm install` at the repository root, " +
      "or set CNB_UAT_PLAYWRIGHT to a directory whose node_modules contains it.");
    process.exit(2);
  }
  try {
    playwright = createRequire(path.join(alt, "resolve-anchor.js"))("playwright-core");
  } catch (err) {
    console.error(
      `playwright-core could not be resolved from CNB_UAT_PLAYWRIGHT=${alt} ` +
      `(${err.message}). Point it at a directory whose node_modules contains playwright-core.`);
    process.exit(2);
  }
}
const { chromium, firefox } = playwright;

/** Newest chromium-* executable in the ms-playwright cache, or null. */
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

let chromiumExe;
if (process.env.CNB_UAT_CHROMIUM) {
  chromiumExe = process.env.CNB_UAT_CHROMIUM;
  if (!existsSync(chromiumExe)) {
    console.error(`CNB_UAT_CHROMIUM is set but does not exist: ${chromiumExe}`);
    process.exit(2);
  }
} else {
  chromiumExe = findCachedChromium();
  if (!chromiumExe) {
    console.error(
      "No Chromium found in the ms-playwright cache. Set CNB_UAT_CHROMIUM to " +
      "a Chromium/Chrome binary, or install one (npx playwright-core install chromium).");
    process.exit(2);
  }
}

const BROWSERS = [
  { name: "Chromium", launch: () => chromium.launch({ executablePath: chromiumExe }),
    missing: "npx playwright-core install chromium, or set CNB_UAT_CHROMIUM" },
  { name: "Firefox", launch: () => firefox.launch(),
    missing: "npx playwright-core install firefox" },
  { name: "Edge", launch: () => chromium.launch({ channel: "msedge" }),
    missing: "install Microsoft Edge" },
];

await mkdir(SHOT_DIR, { recursive: true });

// ── Hostile (and one friendly) inputs ───────────────────────────────────────
const ELLIPSE_D = "M 120 0 C 120 -55 66 -100 0 -100 C -66 -100 -120 -55 -120 0 C -120 55 -66 100 0 100 C 66 100 120 55 120 0 Z";

/** Toolkit-shaped notehead: stem rects, data-semitone-height, data-lilypond-*. */
const TOOLKIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="-120 -100 240 200">
  <rect id="stem-down" x="-120" y="0" width="22.2222" height="350"/>
  <rect id="stem-up" x="97.7778" y="-350" width="22.2222" height="350"/>
  <path id="notehead" d="${ELLIPSE_D}" data-semitone-height="2.0"
        data-lilypond-notehead="'((moveto 1.2 0) (curveto 1.2 0.55 0.66 1.0 0 1.0) (closepath))"/>
</svg>`;

/** Toolkit geometry but no data-lilypond-* (drawn by hand or an old toolkit). */
const NO_LY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="-120 -100 240 200">
  <rect id="stem-down" x="-120" y="0" width="22.2222" height="350"/>
  <rect id="stem-up" x="97.7778" y="-350" width="22.2222" height="350"/>
  <path id="notehead" d="${ELLIPSE_D}" data-semitone-height="2.0"/>
</svg>`;

/** Any SVG from any editor: no #notehead, no toolkit metadata. */
const PLAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path d="M12 2 L22 22 L2 22 Z" fill="#333"/>
</svg>`;

const NOT_XML = "Shape notes\n- kite up\n- kite down\n";

/** Broken XML that still contains an <svg token, so it reaches DOMParser. */
const MALFORMED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <path id="notehead" d="M0 0 L10 10" data-semitone-height="2.0"
</svg`;

const json = (obj) => JSON.stringify(obj, null, 2);

/** A pre-set-009 save: older version stamp, no clef, keys without keySignature. */
const OLDER_SAVE = json({
  version: "0.9",
  staff: { semitonePattern: [4, 8], midpoint: 12, semitonesPerStaffSpace: 4 },
  keys: { enabled: false, definitions: [], offKeyMark: {} },
  meta: { configName: "Older Save", fileSuffix: "-Older" },
});
const TRUNCATED = OLDER_SAVE.slice(0, Math.floor(OLDER_SAVE.length / 2));
/** The legacy single-file app's save: shapes as an array. */
const WRONG_SHAPE = json({ meta: { configName: "Legacy Monolith" }, shapes: [{ name: "kite" }] });
/** Passes the load checks, but a rule with no match block cannot be displayed. */
const UNDISPLAYABLE = json({
  meta: { configName: "Undisplayable" },
  noteheadRules: [{ name: "Broken", priority: 0, apply: { shape: "crotchet-minim" } }],
});
/** Loads (validation never blocks a load) but cannot export: bad fileSuffix. */
const UNEXPORTABLE = json({ meta: { configName: "Unexportable", fileSuffix: "NoHyphen" } });

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

const file = (name, mimeType, text) => ({ name, mimeType, buffer: Buffer.from(text, "utf8") });

async function runIn(spec) {
  let browser;
  try {
    browser = await spec.launch();
  } catch (err) {
    console.error(`${spec.name} could not be launched (${err.message.split("\n")[0]}). ` +
      `To install it: ${spec.missing}.`);
    server.close();
    process.exit(2);
  }
  const tag = `[${spec.name} ${browser.version()}]`;
  const page = await browser.newPage({ viewport: { width: 1600, height: 1800 }, acceptDownloads: true });
  page.setDefaultTimeout(10000);

  const consoleErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", e => consoleErrors.push(String(e)));
  let downloads = 0;
  page.on("download", () => downloads++);

  const state = async () => JSON.parse(await page.textContent("#state-json"));
  const cards = async () => page.$$eval(".cnb-pvd-preview .pc-col", els => els.length);
  const text = async (sel) => (await page.textContent(sel)) || "";
  /** Wait until the element's text contains `part`; the text it ended with. */
  const waitText = async (sel, part) => {
    try {
      await page.waitForFunction(([s, p]) =>
        (document.querySelector(s)?.textContent || "").includes(p), [sel, part]);
    } catch { /* fall through: the check reports the text it found */ }
    return text(sel);
  };
  // Since session 27 the importer is the notehead panel's Import from SVG,
  // so a notehead is selected first.
  const importSvg = async (name, body) => {
    if (!(await page.$(".cnb-notehead-panel"))) await selectNotehead(page, 0);
    return page.setInputFiles('#svg-importer-host input[type="file"]', file(name, "image/svg+xml", body));
  };
  const loadJson = (name, body) =>
    page.setInputFiles("#open-file", file(name, "application/json", body));

  // ── Load ──
  await page.goto(`http://localhost:${PORT}/cnb/index.html`);
  await page.waitForSelector(".cnb-preview-display");
  check(`${tag} LOAD: the app mounts and the preview renders cards`, (await cards()) > 0);
  check(`${tag} LOAD: no console or page errors at start`, consoleErrors.length === 0, consoleErrors.join(" | "));

  // ── SVG import ──
  await importSvg("uat-oval.svg", TOOLKIT_SVG);
  let status = await waitText("#import-status", 'Imported shape "uat-oval"');
  check(`${tag} SVG: a toolkit SVG imports`, status.includes('Imported shape "uat-oval"') &&
    "uat-oval" in (await state()).shapes, status);

  const shapesBefore = Object.keys((await state()).shapes).sort().join(",");
  await importSvg("icon.svg", PLAIN_SVG);
  status = await waitText("#import-status", "Music Glyph Toolkit");
  check(`${tag} SVG: a non-toolkit SVG shows "Import failed" naming the toolkit`,
    status.startsWith("Import failed") && status.includes("Music Glyph Toolkit") &&
    (await page.getAttribute("#import-status", "class")) === "err", status);
  check(`${tag} SVG: the refused SVG leaves the shapes unchanged`,
    Object.keys((await state()).shapes).sort().join(",") === shapesBefore);

  await importSvg("hand-drawn.svg", NO_LY_SVG);
  status = await waitText("#import-status", 'Imported shape "hand-drawn"');
  const warnings = await page.$$eval("#import-warnings li", els => els.map(e => e.textContent));
  check(`${tag} SVG: an SVG without data-lilypond-* imports with a visible fallback warning`,
    status.includes('Imported shape "hand-drawn"') &&
    warnings.some(w => w.includes("data-lilypond-notehead")), status + " / " + warnings.join(" | "));

  await importSvg("notes.svg", NOT_XML);
  status = await waitText("#import-status", "Invalid SVG");
  check(`${tag} SVG: a file that is not XML shows "Invalid SVG"`,
    status.startsWith("Import failed") && status.includes("Invalid SVG"), status);

  const shapesBeforeMalformed = Object.keys((await state()).shapes).sort().join(",");
  const errorsBeforeMalformed = consoleErrors.length;
  await importSvg("broken.svg", MALFORMED_SVG);
  status = await waitText("#import-status", "Invalid SVG");
  await page.waitForTimeout(200); // let a late console message land
  // Taken out of consoleErrors so the closing no-errors check still covers
  // everything else; what this case logs is pinned per browser below.
  const malformedErrors = consoleErrors.splice(errorsBeforeMalformed);
  check(`${tag} SVG: malformed XML containing <svg shows "Invalid SVG"`,
    status.startsWith("Import failed") && status.includes("Invalid SVG"), status);
  check(`${tag} SVG: the malformed SVG leaves the shapes unchanged`,
    Object.keys((await state()).shapes).sort().join(",") === shapesBeforeMalformed);
  if (spec.name === "Firefox") {
    check(`${tag} SVG: the malformed SVG logs exactly Firefox's own XML parse error and nothing else`,
      malformedErrors.length === 1 && malformedErrors[0].includes("XML Parsing Error: not well-formed"),
      JSON.stringify(malformedErrors));
  } else {
    check(`${tag} SVG: the malformed SVG logs nothing to the console`,
      malformedErrors.length === 0, JSON.stringify(malformedErrors));
  }

  // ── JSON load ──
  await loadJson("older.cnb.json", OLDER_SAVE);
  status = await waitText(".cnb-cio-status", "Older Save");
  const notes = await page.$$eval(".cnb-cio-note", els => els.map(e => e.textContent));
  check(`${tag} JSON: an older-version save loads with its version note shown`,
    status.includes("Older Save") && notes.some(n => n.includes('"0.9"')) &&
    (await state()).meta.configName === "Older Save", status + " / " + notes.join(" | "));
  check(`${tag} JSON: the older save gains the later sections and the preview renders it`,
    "clef" in (await state()) && "keySignature" in (await state()).keys && (await cards()) > 0);

  const refusals = [
    ["truncated.cnb.json", TRUNCATED, "not valid JSON", "a truncated file"],
    ["legacy.json", WRONG_SHAPE, '"shapes" should be an object', "a wrong-shaped (legacy) save"],
    ["undisplayable.cnb.json", UNDISPLAYABLE, "could not be displayed", "a file the app cannot display"],
  ];
  for (const [name, body, expect, what] of refusals) {
    await loadJson(name, body);
    const err = await waitText(".cnb-cio-error", expect);
    check(`${tag} JSON: ${what} shows a visible "Load failed" message`,
      err.startsWith("Load failed") && err.includes(expect), err);
    const after = await state();
    check(`${tag} JSON: ${what} leaves the previous config in place, editors and preview working`,
      after.meta.configName === "Older Save" && (await cards()) > 0 &&
      !!(await page.$(".cnb-notehead-rule-editor")) && !!(await page.$(".cnb-staff-rule-editor")),
      after.meta.configName);
  }

  // ── Export of an invalid config ──
  await loadJson("unexportable.cnb.json", UNEXPORTABLE);
  await waitText(".cnb-cio-status", "Unexportable");
  const downloadsBefore = downloads;
  await page.click("#export-ly");
  status = await waitText(".cnb-cex-status", "Export blocked");
  const rows = await page.$$eval(".cnb-cex-verror", els => els.map(e => e.textContent));
  check(`${tag} EXPORT: an invalid config is blocked with its errors listed`,
    status.includes("Export blocked") && rows.some(r => r.includes("NoHyphen") || /hyphen/i.test(r)),
    status + " / " + rows.join(" | "));
  check(`${tag} EXPORT: nothing is downloaded`, downloads === downloadsBefore);
  const indicator = await text("#checks-indicator");
  const tooltip = (await page.getAttribute("#export-ly", "title")) || "";
  check(`${tag} EXPORT: the checks indicator counts the errors and the Export button's tooltip names the block`,
    /\d+ errors?/.test(indicator) && tooltip.startsWith("Export is blocked"), indicator + " / " + tooltip);

  await page.screenshot({ path: path.join(SHOT_DIR, `uat-hostile-input-${spec.name.toLowerCase()}.png`), fullPage: true });
  check(`${tag} NO console or page errors across all hostile input`, consoleErrors.length === 0,
    consoleErrors.join(" | "));
  await browser.close();
}

for (const spec of BROWSERS) await runIn(spec);
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failCount}/${results.length} checks passed`);
console.log(`Screenshots: ${SHOT_DIR}`);
process.exit(failCount === 0 ? 0 : 1);
