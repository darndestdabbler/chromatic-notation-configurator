/**
 * uat-tutorial.mjs — the walk-through (session 67, step-by-step design §6):
 * the stepped UI's golden-path UAT. It builds the tutorial's notation
 * (design §5) from the default config through the controls a reader uses,
 * one stage per step of the registry (cnb/ui/steps.js), in its order. Each
 * stage opens its step from the sidebar, does what §5 says, checks the
 * result on the page and in the live config, and screenshots the main area
 * as NN-<id>.png.
 *
 *   1 Notehead height 2.  2 Lines at 3, 5, 7 and 9, the middle C (12).
 *   3 No change, the middle confirmed C.  4 The automatic ledgers: B (11)
 *   and C♯ (13) in the gap, B taking B's, C and C♯ C♯'s, A♯ and D none.
 *   5 diamond.svg imported for every notehead, solid, C♯ D♯ F♯ G♯ A♯ red
 *   (#cc0000); minims as repeated heads at the default overlap
 *   (05-noteheads-repeated.png), then each duration's own look with Hollow
 *   minims (05-noteheads.png).  6 Show the key signature, Noteheads.
 *   7 Greyed, with its reason.  8 Stacks at each change of parity, the gold
 *   stem drawn.  9 Every key shown, G major and E♭ major picked.
 *   10 c-clef.svg imported, its anchor picked at its left middle, 8
 *   semitones tall (an imported clef has no automatic size: the operator's
 *   choice, session 67).  11 The anchor on middle C (12).  12 Named
 *   "Tutorial 3-5-7-9", suffix -Tutorial3579, saved and exported.
 *
 * Then the optional section, stages 6–8 and 12 again (NN-<id>-optional.png):
 * Custom marks, All selected in step 7 and diamond-wide.svg imported as
 * every spelled note's symbol, the stacks tightened in step 8, exported.
 *
 * The saved config is compared with docs/playbook/tutorial/downloads/
 * tutorial.json without meta.created and meta.modified, and the exports
 * with tutorial.ly and tutorial-custom.ly byte for byte apart from their
 * "%% Date:" line, the main notation's before the optional section starts:
 * those are the only parts that change from run to run. With
 * CNB_UAT_TUTORIAL_UPDATE=1 it writes the three files instead. A file not
 * checked in yet is reported SKIP.
 *
 * Screenshots go to a temporary directory, or to CNB_UAT_TUTORIAL_SHOTS
 * when set (docs/playbook/tutorial/shots refreshes the tutorial's).
 *
 * The browser starts only when this is the script Node started, so
 * cnb/tests/cnb-steps-tests.js imports STAGES without one.
 *
 * Usage: node cnb/uat/uat-tutorial.mjs
 * Requirements as the other drivers (uat-golden-path.mjs): playwright-core
 * (or CNB_UAT_PLAYWRIGHT) and a Chromium (CNB_UAT_CHROMIUM, or the
 * ms-playwright cache). Optional: CNB_UAT_PORT (default 8167).
 * Exit 0 = every check passed; 1 = a check failed; 2 = missing prerequisites.
 */
import path from "path";
import { fileURLToPath } from "url";

/** The stages, the registry's ids in its order, written out by hand (design §4, §6). */
export const STAGES = [
  "notehead-height",
  "staff",
  "pitch",
  "ledger-lines",
  "noteheads",
  "ks-symbol-type",
  "ks-custom-symbols",
  "ks-designer",
  "ks-preview",
  "clef-symbol",
  "clef-placement",
  "export",
];

/** The stages the optional section runs again. */
export const OPTIONAL_STAGES = ["ks-symbol-type", "ks-custom-symbols", "ks-designer", "export"];

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (isMain) await main();

async function main() {
  const http = await import("http");
  const os = await import("os");
  const { readFile, writeFile, mkdir, mkdtemp } = await import("fs/promises");
  const { existsSync, readdirSync } = await import("fs");
  const { createRequire } = await import("module");
  const { CNBConfig } = await import("../src/cnb-config.js");
  const { CNBNotehead } = await import("../src/cnb-notehead.js");
  const { CNBLedgerSet } = await import("../src/cnb-ledger-set.js");
  const { CNBLilypond } = await import("../src/cnb-lilypond.js");
  const { CNBNoteheadPanel } = await import("../ui/notehead-panel.js");
  const { CNBPreviewDisplay } = await import("../ui/preview-display.js");
  const { CNBStaffRuleEditor } = await import("../ui/staff-rule-editor.js");
  const { CNBKeySignatureEditor } = await import("../ui/key-signature-editor.js");
  const { CNBSteps, CNBStepNav } = await import("../ui/steps.js");
  const { useDownloads, openSection, setField, selectNotehead } = await import("./app-page.mjs");

  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const DOWNLOADS = path.join(ROOT, "docs", "playbook", "tutorial", "downloads");
  const PORT = Number(process.env.CNB_UAT_PORT || 8167);
  const UPDATE = process.env.CNB_UAT_TUTORIAL_UPDATE === "1";
  const SHOT_DIR = process.env.CNB_UAT_TUTORIAL_SHOTS
    ? path.resolve(process.env.CNB_UAT_TUTORIAL_SHOTS)
    : await mkdtemp(path.join(os.tmpdir(), "cnb-uat-tutorial-"));
  await mkdir(SHOT_DIR, { recursive: true });
  // The saved config and the exports, kept out of the screenshots' directory.
  const DOWNLOAD_DIR = await mkdtemp(path.join(os.tmpdir(), "cnb-uat-tutorial-downloads-"));

  // ── Dependencies (explicit errors, no silent fallbacks) ──────────────────
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
    const revisions = readdirSync(cacheRoot).filter(d => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    const subs = process.platform === "win32" ? ["chrome-win64/chrome.exe", "chrome-win/chrome.exe"]
      : process.platform === "darwin" ? ["chrome-mac/Chromium.app/Contents/MacOS/Chromium"] : ["chrome-linux/chrome"];
    for (const rev of revisions) {
      for (const sub of subs) {
        const exe = path.join(cacheRoot, rev, sub);
        if (existsSync(exe)) return exe;
      }
    }
    return null;
  }
  let EXE = process.env.CNB_UAT_CHROMIUM;
  if (EXE) {
    if (!existsSync(EXE)) { console.error(`CNB_UAT_CHROMIUM is set but does not exist: ${EXE}`); process.exit(2); }
  } else {
    EXE = findCachedChromium();
    if (!EXE) {
      console.error("No Chromium found in the ms-playwright cache. Set CNB_UAT_CHROMIUM, " +
        "or install one (npx playwright-core install chromium).");
      process.exit(2);
    }
  }

  // ── Static server over the repo root ──────────────────────────────────────
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
    ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2", ".ttf": "font/ttf" };
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (urlPath === "/favicon.ico") { res.writeHead(204); res.end(); return; }
      const file = path.join(ROOT, urlPath);
      if (!path.resolve(file).startsWith(path.resolve(ROOT))) { res.writeHead(403); res.end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  await new Promise(r => server.listen(PORT, r));

  // ── Checks ────────────────────────────────────────────────────────────────
  const results = [];
  let failCount = 0;
  function check(label, cond, detail = "") {
    const ok = !!cond;
    if (!ok) failCount++;
    results.push(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? "  [" + detail + "]" : ""}`);
  }

  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const consoleErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", e => consoleErrors.push(String(e)));
  // Step 6's starting points ask before they replace the signature's settings.
  const dialogs = [];
  page.on("dialog", d => { dialogs.push(d.message()); d.accept(); });
  await useDownloads(page);
  await page.goto(`http://localhost:${PORT}/cnb/index.html`);
  await page.waitForSelector(".cnb-pvd-preview .pc-col");

  const live = async () => JSON.parse(await page.textContent("#state-json"));
  const download = (name) => readFile(path.join(DOWNLOADS, name), "utf8");
  const stepOf = (id) => CNBSteps.find(s => s.id === id);
  const shotName = (id, suffix = "") => `${String(stepOf(id).number).padStart(2, "0")}-${id}${suffix}.png`;
  /** The main area, with the window as tall as the page while it is taken:
   *  a capture that scrolls leaves the sticky title bar and step bar across
   *  the middle of the picture. */
  async function shot(file) {
    const view = page.viewportSize();
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: view.width, height: Math.max(view.height, height) });
    await page.evaluate(() => window.scrollTo(0, 0));
    const clip = await page.$eval("main.main", el => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    await page.screenshot({ path: path.join(SHOT_DIR, file), clip });
    await page.setViewportSize(view);
  }
  /** Open a step from the sidebar, and say so if its panel did not show. */
  async function open(id) {
    await openSection(page, id);
    const shown = await page.isVisible(`.panel[data-panel="${id}"]`);
    check(`${stepOf(id).number}. ${stepOf(id).title}: opens from the sidebar`, shown);
  }
  const resolved = (c, pc, duration = "crotchet") => CNBConfig.resolveNotehead(c, pc, duration, null);
  /** JSON with keys in order. */
  const stable = (v) => Array.isArray(v) ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`
    : JSON.stringify(v);
  const SHARPS = [1, 3, 6, 8, 10];
  const RED = "#cc0000";
  /** Each duration row's column for a pitch class: how many of a path it draws. */
  const pathsIn = (pc, d) => page.$$eval(".cnb-pvd-preview .cnb-duration-row", (rows, [pc, d]) =>
    rows.map(r => [...r.querySelectorAll(`.pc-col[data-pc="${pc}"] path`)]
      .filter(p => p.getAttribute("d") === d).length), [pc, d]);

  /** A downloaded file from clicking selector, as text. */
  async function downloadFrom(selector) {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click(selector)]);
    const file = path.join(DOWNLOAD_DIR, dl.suggestedFilename());
    await dl.saveAs(file);
    return { name: dl.suggestedFilename(), text: await readFile(file, "utf8") };
  }
  /** Compare a result with its checked-in download, or write it with UPDATE. */
  async function fixture(name, text, same, label) {
    const file = path.join(DOWNLOADS, name);
    if (UPDATE) {
      await writeFile(file, text, "utf8");
      results.push(`WROTE ${label}: ${path.relative(ROOT, file)}`);
      return;
    }
    if (!existsSync(file)) {
      results.push(`SKIP  ${label}: ${path.relative(ROOT, file)} is not checked in yet (CNB_UAT_TUTORIAL_UPDATE=1 writes it)`);
      return;
    }
    const want = await readFile(file, "utf8");
    check(`${label}: equals ${path.relative(ROOT, file)}`, same(text, want),
      `regenerate on purpose with CNB_UAT_TUTORIAL_UPDATE=1 if the change is intended`);
  }
  const withoutDate = (ly) => ly.replace(/\r\n/g, "\n").replace(/^%% Date: .*$/m, "%% Date:");
  const sameLy = (a, b) => withoutDate(a) === withoutDate(b);
  const firstDiff = (a, b) => {
    const x = withoutDate(a).split("\n"), y = withoutDate(b).split("\n");
    const i = x.findIndex((l, n) => l !== y[n]);
    return i < 0 ? `lengths ${x.length} ${y.length}` : `line ${i + 1}: ${JSON.stringify(x[i])} vs ${JSON.stringify(y[i])}`;
  };
  const sameConfig = (a, b) => {
    const strip = (t) => { const c = JSON.parse(t); if (c.meta) { delete c.meta.created; delete c.meta.modified; } return stable(c); };
    return strip(a) === strip(b);
  };

  // ── The stages (design §5) ────────────────────────────────────────────────
  const main = {
    async "notehead-height"() {
      await open("notehead-height");
      await setField(page, ".cnb-nhp-general-height", "2");
      const c = await live();
      check("1. Notehead height: 2 semitones, every notehead",
        Math.abs(CNBNoteheadPanel.generalHeight(c) - 2) < 1e-9 &&
        [...Array(12).keys()].every(pc => resolved(c, pc).heightSemis === 2) &&
        (await page.inputValue(".cnb-nhp-general-height")) === "2",
        JSON.stringify(resolved(c, 0)));
    },

    async staff() {
      await open("staff");
      for (const pc of [3, 5, 7, 9, 4, 8]) {   // add four, then remove E and G♯
        await page.click(`#staff-editor-host .cnb-sre-pc-toggle[data-pc="${pc}"]`);
      }
      const c = await live();
      check("2. Staff: lines at 3, 5, 7 and 9 (E♭, F, G, A), 2 semitones a staff space, the middle C (12)",
        JSON.stringify(c.staff.semitonePattern) === "[3,5,7,9]" && c.staff.semitonesPerStaffSpace === 2 &&
        c.staff.midpoint === 12, JSON.stringify(c.staff));
      const ys = await page.$$eval(".cnb-pvd-preview .staff-lines-bg line", ls => ls.map(l => Number(l.getAttribute("y1"))));
      const gaps = [...new Set(ys.slice(1).map((y, i) => Math.round(Math.abs(y - ys[i]))))].sort((a, b) => a - b);
      check("2. Staff: the canvas draws the new staff, lines a staff space apart with a gap of 3 staff spaces",
        ys.length >= 4 && gaps.length === 2 && gaps[1] === 3 * gaps[0], JSON.stringify({ lines: ys.length, gaps }));
    },

    async pitch() {
      await open("pitch");
      const c = await live();
      check("3. Pitch: no change, the middle of the staff confirmed as C (semitone 12)",
        (await page.inputValue(".cnb-pp-middle")) === "0" && c.staff.midpoint === 12 && !c.pitchAxis,
        JSON.stringify({ middle: await page.inputValue(".cnb-pp-middle"), staff: c.staff }));
    },

    async "ledger-lines"() {
      await open("ledger-lines");
      // The default's own ledger rules stay with the old staff: Automatic
      // gives the new one's.
      await page.click('#ledger-editor-host [data-ledger-mode="automatic"]');
      const c = await live();
      const automatic = CNBStaffRuleEditor.ledgerModeOf(c.staff.semitonePattern, c.ledgers) === "automatic";
      const range = { minSemi: -6, maxSemi: 30 };
      const at = (s) => JSON.stringify(CNBLedgerSet.ledgersFor(c, [s], range));
      check("4. Ledger lines: Automatic chosen, and in the gap B (11) takes the B ledger, C (12) and C♯ (13) the C♯ ledger, A♯ (10) and D (14) none",
        automatic && (await page.$eval('#ledger-editor-host [data-ledger-mode="automatic"]', b => b.classList.contains("on"))) &&
        at(11) === "[11]" && at(12) === "[13]" && at(13) === "[13]" && at(10) === "[]" && at(14) === "[]",
        JSON.stringify({ automatic, b: at(11), c: at(12), cs: at(13), as: at(10), d: at(14) }));
      const ledgered = await page.$$eval(".cnb-pvd-preview .pc-col", cols =>
        [...new Set(cols.filter(col => col.dataset.ledgers !== "0").map(col => Number(col.dataset.pc)))].sort((a, b) => a - b));
      check("4. Ledger lines: on the canvas only C, C♯, B and the upper C draw ledgers, the gap's",
        JSON.stringify(ledgered) === "[0,1,11,12]", JSON.stringify(ledgered));
    },

    async noteheads() {
      await open("noteheads");
      // Every notehead: the diamond, solid (the default's sharps are hollow,
      // and a hollow crotchet would read as a minim once minims are hollow).
      await selectNotehead(page, 0);
      for (let pc = 1; pc < 12; pc++) await selectNotehead(page, pc, { add: true });
      check("5. Noteheads: all twelve selected", (await page.textContent(".cnb-nhp-title")).endsWith("(12 noteheads)"),
        await page.textContent(".cnb-nhp-title"));
      await page.setInputFiles('#svg-importer-host input[type="file"]', path.join(DOWNLOADS, "diamond.svg"));
      await page.waitForFunction(() => document.getElementById("import-status").textContent.includes('"diamond"'));
      check("5. Noteheads: diamond.svg imports with no warnings, and the reference picker opens on it",
        (await page.$$eval("#import-warnings li", els => els.length)) === 0 &&
        (await page.isVisible(".cnb-nhp-reference-picker")),
        await page.textContent("#import-status"));
      await page.click(".cnb-nhp-reference-done");
      await page.click('.cnb-nhp-shape-option[data-shape="diamond"]');
      await page.click('.cnb-nhp-fill-option[data-fill="solid"]');
      let c = await live();
      const diamond = c.shapes.diamond;
      const box = CNBNotehead.box(diamond);
      const perSemi = diamond.naturalHeight / diamond.semitoneHeight;
      check("5. Noteheads: every notehead the diamond, solid, at its own 2 × 3 semitones",
        [...Array(12).keys()].every(pc => {
          const r = resolved(c, pc);
          return r.shape === "diamond" && r.hollow === false && r.heightSemis === null && r.widthSemis === null;
        }) && Math.abs((box.y[1] - box.y[0]) / perSemi - 2) < 0.05 && Math.abs((box.x[1] - box.x[0]) / perSemi - 3) < 0.05,
        JSON.stringify(resolved(c, 1)));
      // The sharps red.
      await selectNotehead(page, SHARPS[0]);
      for (const pc of SHARPS.slice(1)) await selectNotehead(page, pc, { add: true });
      await setField(page, ".cnb-nhp-color-input", RED);
      c = await live();
      check("5. Noteheads: C♯, D♯, F♯, G♯ and A♯ red (#cc0000), the rest black",
        [...Array(12).keys()].every(pc => (resolved(c, pc).color || null) === (SHARPS.includes(pc) ? RED : null)),
        JSON.stringify([...Array(12).keys()].map(pc => resolved(c, pc).color)));
      check("5. Noteheads: the canvas draws the red diamonds",
        (await page.$$eval(`.cnb-pvd-preview path[fill="${RED}"]`, els => els.length)) > 0);
      // Minims shown, as repeated heads first.
      await page.click('.cnb-pvd-duration-pill[data-duration="minim"]');
      await page.click('.canvas-card .cnb-pvd-repeat-option[data-mode="repeat"]');
      c = await live();
      const heads = await pathsIn(0, diamond.svgPath);
      check("5. Noteheads: minims as repeated heads at the default overlap, two heads a minim (C's column: 2 crotchet heads, 4 minim heads)",
        c.durations.representationMode === "repeat" && Math.abs((c.durations.repeatOverlap ?? 1 / 3) - 1 / 3) < 1e-9 &&
        JSON.stringify(heads) === "[2,4]", JSON.stringify({ mode: c.durations.representationMode, overlap: c.durations.repeatOverlap, heads }));
      await shot(shotName("noteheads", "-repeated"));
      // Then each duration's own look, and hollow minims.
      await page.click('.canvas-card .cnb-pvd-repeat-option[data-mode="shape"]');
      await page.check(".cnb-pvd-hollow-minims-check");
      c = await live();
      const solid = await pathsIn(0, diamond.svgPath);
      const hollow = await pathsIn(0, diamond.svgHollowPath);
      check("5. Noteheads: switched to each duration's own look with Hollow minims: one rule, minims hollow and crotchets solid, one head a note",
        c.durations.representationMode === "shape" && CNBPreviewDisplay.hasHollowMinims(c) &&
        c.noteheadRules.filter(r => r.name === "Hollow minims").length === 1 &&
        [...Array(12).keys()].every(pc => resolved(c, pc, "minim").hollow === true && resolved(c, pc).hollow === false) &&
        JSON.stringify(solid) === "[2,2]" && JSON.stringify(hollow) === "[0,2]",
        JSON.stringify({ mode: c.durations.representationMode, solid, hollow }));
    },

    async "ks-symbol-type"() {
      await open("ks-symbol-type");
      await page.check('[data-panel="ks-symbol-type"] .cnb-kse-sig-enable-check');
      await page.click('[data-panel="ks-symbol-type"] .cnb-kse-start-card[data-start="noteheads"]');
      const c = await live();
      check("6. Key signature symbol type: shown, starting from Noteheads",
        c.keys.enabled === true && c.keys.keySignature.enabled === true &&
        CNBStepNav.startingPoint(c) === "noteheads" &&
        JSON.stringify(await page.$$eval('[data-panel="ks-symbol-type"] .cnb-kse-start-card.on', els => els.map(e => e.dataset.start))) === '["noteheads"]',
        JSON.stringify({ keys: c.keys.enabled, sig: c.keys.keySignature.enabled, start: CNBStepNav.startingPoint(c) }));
    },

    async "ks-custom-symbols"() {
      const link = '.section-link[data-section="ks-custom-symbols"]';
      const c = await live();
      const reason = stepOf("ks-custom-symbols").unavailable;
      // Forced: Playwright waits for an aria-disabled link to be enabled.
      await page.click(link, { force: true });
      check("7. Custom key signature symbols: greyed, with its reason, and does not open",
        (await page.getAttribute(link, "aria-disabled")) === "true" &&
        (await page.getAttribute(link, "title")) === reason && !CNBStepNav.isAvailable("ks-custom-symbols", c) &&
        !(await page.isVisible('.panel[data-panel="ks-custom-symbols"]')),
        JSON.stringify({ disabled: await page.getAttribute(link, "aria-disabled"), title: await page.getAttribute(link, "title") }));
    },

    async "ks-designer"() {
      await open("ks-designer");
      await page.check('[data-panel="ks-designer"] .cnb-kse-stacking .cnb-kse-radio[data-value="parity-stacks"] input');
      await page.check('[data-panel="ks-designer"] .cnb-kse-sep-enable-check');
      const c = await live();
      const gold = await page.$eval('[data-panel="ks-designer"] .cnb-kse-canvas', el => /#ffd42a/i.test(el.innerHTML));
      check("8. Key signature designer: Clairnote's stacks (a new stack at each change of parity), the gold stem drawn",
        c.keys.keySignature.stacking === "parity-stacks" && c.keys.keySignature.separator.enabled === true && gold,
        JSON.stringify({ stacking: c.keys.keySignature.stacking, separator: c.keys.keySignature.separator, gold }));
    },

    async "ks-preview"() {
      await open("ks-preview");
      const P = '[data-panel="ks-preview"]';
      const rows = await page.$$eval(`${P} .cnb-kse-mode-row`, rs => rs.map(r => r.querySelectorAll(".cnb-kse-mini").length));
      check("9. Key signature preview: every key shown, the 7 modes' 15 keys each",
        rows.length === 7 && rows.every(n => n === 15), JSON.stringify(rows));
      const picked = async () => [await page.inputValue(".cnb-pvd-key-tonic"), await page.inputValue(".cnb-pvd-key-mode")].join(" ");
      await page.click(`${P} .cnb-kse-mode-row[data-mode="major"] .cnb-kse-mini[data-key="G"]`);
      const g = await picked();
      await open("ks-preview");
      await page.click(`${P} .cnb-kse-mode-row[data-mode="major"] .cnb-kse-mini[data-key="E♭"]`);
      const eFlat = await picked();
      await open("ks-preview");
      check("9. Key signature preview: G major, then E♭ major picked, each on the staff",
        g === "G major" && eFlat === "E♭ major" &&
        JSON.stringify(await page.$$eval(`${P} .cnb-kse-mini.on`, els => els.map(e => e.dataset.key))) === '["E♭"]',
        JSON.stringify({ g, eFlat }));
    },

    async "clef-symbol"() {
      await open("clef-symbol");
      await page.setInputFiles(".cnb-cle-file", path.join(DOWNLOADS, "c-clef.svg"));
      await page.waitForFunction(() => document.querySelector(".cnb-cle-import-status").textContent.includes("c-clef"));
      let c = await live();
      let glyph = c.clef.glyphs["c-clef"];
      check("10. Clef symbol: c-clef.svg imports as the active clef, and its anchor picker opens",
        !!glyph && c.clef.active === "c-clef" && !!(await page.$(".cnb-cle-anchor-picker .cnb-cle-anchor-svg")),
        await page.textContent(".cnb-cle-import-status"));
      // The anchor at its left middle: the left edge of its box, half way up.
      const box = CNBNotehead.box(glyph);
      const want = { x: box.x[0], y: (box.y[0] + box.y[1]) / 2 };
      const g = CNBKeySignatureEditor.referenceGeometry(glyph);
      await page.locator(".cnb-cle-anchor-svg").click({ position: { x: g.ox + want.x * g.k, y: g.oy + want.y * g.k } });
      await page.click(".cnb-cle-anchor-done");
      await page.check(".cnb-cle-enable-check");
      // An imported clef has no automatic size: 8 semitones, 4 staff spaces.
      await setField(page, ".cnb-cle-height", "8");
      c = await live();
      glyph = c.clef.glyphs["c-clef"];
      const ref = glyph.reference;
      check("10. Clef symbol: its anchor picked at its left middle, within a unit",
        ref && Math.abs(ref.x - want.x) <= 1 && Math.abs(ref.y - want.y) <= 1, JSON.stringify({ ref, want }));
      check("10. Clef symbol: shown, 8 semitones tall, drawn at the start of the staff",
        c.clef.enabled === true && glyph.semitoneHeight === 8 &&
        (await page.$$eval(".cnb-pvd-preview .cnb-clef", els => els.length)) > 0,
        JSON.stringify({ enabled: c.clef.enabled, height: glyph.semitoneHeight }));
    },

    async "clef-placement"() {
      await open("clef-placement");
      await setField(page, ".cnb-cle-sits", "12");
      const c = await live();
      check("11. Clef placement: the anchor on middle C, the staff's C at semitone 12",
        c.clef.glyphs["c-clef"].anchorSemi === 12 && c.staff.midpoint === 12 &&
        (await page.inputValue(".cnb-cle-sits")) === "12", JSON.stringify(c.clef.glyphs["c-clef"].anchorSemi));
    },

    async export() {
      await open("export");
      const field = (key) => `.cnb-cex-meta-field[data-meta="${key}"] .cnb-cex-meta-input`;
      await page.fill(field("configName"), "Tutorial 3-5-7-9");
      await page.fill(field("notationLabel"), "Tutorial 3-5-7-9");
      await page.fill(field("fileSuffix"), "-Tutorial3579");
      const c = await live();
      check("12. Export: named Tutorial 3-5-7-9, file suffix -Tutorial3579",
        c.meta.configName === "Tutorial 3-5-7-9" && c.meta.notationLabel === "Tutorial 3-5-7-9" &&
        c.meta.fileSuffix === "-Tutorial3579", JSON.stringify(c.meta));
      const saved = await downloadFrom("#save-config");
      const ly = await downloadFrom('[data-panel="export"] .cnb-cex-export');
      const after = await live();
      check("12. Export: the .ly downloads named from its suffix (tutorial3579.ly) and is CNBLilypond.generate of the live config",
        ly.name === "tutorial3579.ly" && sameLy(ly.text, CNBLilypond.generate(after)),
        `${ly.name}; ${firstDiff(ly.text, CNBLilypond.generate(after))}`);
      check("12. Export: the saved config is the live one", sameConfig(saved.text, JSON.stringify(after)));
      await fixture("tutorial.json", saved.text, sameConfig, "12. Export: the saved config (without meta.created and meta.modified)");
      await fixture("tutorial.ly", ly.text, sameLy, "12. Export: the .ly (but its date)");
    },
  };

  const optional = {
    async "ks-symbol-type"() {
      await open("ks-symbol-type");
      await page.click('[data-panel="ks-symbol-type"] .cnb-kse-start-card[data-start="custom"]');
      const c = await live();
      check("6 (optional). Custom marks: every spelled note the parallelogram, and step 7 available",
        CNBConfig.SPELLED_NOTES.every(n => c.keys.keySignature.looks.spelled[n]?.shape === "parallelogram") &&
        CNBStepNav.startingPoint(c) === null && CNBStepNav.isAvailable("ks-custom-symbols", c),
        JSON.stringify(c.keys.keySignature.looks.spelled.C));
    },

    async "ks-custom-symbols"() {
      await open("ks-custom-symbols");
      const P = '[data-panel="ks-custom-symbols"]';
      await page.click(`${P} .cnb-kse-select-button[data-select="all"]`);
      const pressed = await page.$$eval(`${P} .cnb-kse-spelled-note[aria-pressed="true"]`, els => els.length);
      await page.setInputFiles(`${P} .cnb-kse-look-card .cnb-kse-look-import input[type=file]`, path.join(DOWNLOADS, "diamond-wide.svg"));
      await page.waitForSelector(`${P} .cnb-kse-reference-picker`);
      await page.click(`${P} .cnb-kse-reference-done`);
      const c = await live();
      check("7 (optional). Custom symbols: All selected (21 spelled notes), diamond-wide.svg imported as every one's symbol",
        pressed === 21 && !!c.shapes["diamond-wide"] &&
        CNBConfig.SPELLED_NOTES.every(n => c.keys.keySignature.looks.spelled[n]?.shape === "diamond-wide"),
        JSON.stringify({ pressed, C: c.keys.keySignature.looks.spelled.C }));
    },

    async "ks-designer"() {
      await open("ks-designer");
      await setField(page, '[data-panel="ks-designer"] .cnb-kse-gap-input', "-0.5");
      const c = await live();
      check("8 (optional). Designer: the stacks tightened, half a semitone closer",
        c.keys.keySignature.columnGap === -0.5, JSON.stringify(c.keys.keySignature.columnGap));
    },

    async export() {
      await open("export");
      const ly = await downloadFrom('[data-panel="export"] .cnb-cex-export');
      const c = await live();
      check("12 (optional). Export: the custom signature exports as the mark table, CNBLilypond.generate of the live config",
        ly.text.includes("cnb:keysig-style 'marks") && ly.text.includes("diamond-wide") && sameLy(ly.text, CNBLilypond.generate(c)),
        firstDiff(ly.text, CNBLilypond.generate(c)));
      await fixture("tutorial-custom.ly", ly.text, sameLy, "12 (optional). Export: the .ly (but its date)");
    },
  };

  // ── Run ───────────────────────────────────────────────────────────────────
  check("STAGES: the registry's ids in its order", JSON.stringify(STAGES) === JSON.stringify(CNBSteps.map(s => s.id)));
  for (const id of STAGES) {
    try {
      await main[id]();
    } catch (err) {
      check(`${stepOf(id).number}. ${stepOf(id).title}: ran`, false, err.message.split("\n")[0]);
    }
    await shot(shotName(id));
  }
  for (const id of OPTIONAL_STAGES) {
    try {
      await optional[id]();
    } catch (err) {
      check(`${stepOf(id).number} (optional). ${stepOf(id).title}: ran`, false, err.message.split("\n")[0]);
    }
    await shot(shotName(id, "-optional"));
  }
  check("NO console or page errors across the walk-through", consoleErrors.length === 0, consoleErrors.join(" | "));

  await browser.close();
  server.close();
  console.log(results.join("\n"));
  if (dialogs.length) console.log(`Dialogs accepted: ${dialogs.map(d => JSON.stringify(d)).join(", ")}`);
  console.log(`\n${results.filter(r => r.startsWith("PASS")).length}/${results.length - results.filter(r => /^(SKIP|WROTE)/.test(r)).length} checks passed`);
  console.log(`Screenshots: ${SHOT_DIR}`);
  console.log(`Downloads: ${DOWNLOAD_DIR}`);
  process.exit(failCount === 0 ? 0 : 1);
}
