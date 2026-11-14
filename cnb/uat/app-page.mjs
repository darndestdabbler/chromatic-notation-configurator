/**
 * app-page.mjs — helpers the drivers of cnb/index.html share (session 25).
 *
 * Since session 25 the app is one screen (design
 * docs/planning/notehead-first-editor-design.md §7): a section list shows
 * one panel at a time, so a driver opens a panel's section before it uses
 * the panel's controls. The staff canvas draws at the toolbar's Size,
 * remembered in the browser's localStorage, not at the config's saved
 * display.pxPerSemi (§6.1), so a driver that checks preview geometry sets
 * the Size before the page loads and computes against the same display
 * copy of the config the canvas draws.
 *
 * Not a driver: run-uat.mjs spawns only files named uat-*.mjs, so this
 * module, which the drivers import, is named app-page.mjs.
 */
import { CNBPreviewDisplay } from "../ui/preview-display.js";

/**
 * Before the page loads: draw the canvas at this Size ("small", "medium"
 * or "large"). Call it after newPage() and before goto().
 */
export async function useCanvasSize(page, size) {
  await page.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* blocked: Medium */ }
  }, [CNBPreviewDisplay.SIZE_STORAGE_KEY, size]);
}

/**
 * Before the page loads: take away the browser's save dialog
 * (showSaveFilePicker), so that Save and Export download their files, as
 * they do in a browser without one, and the driver captures them with
 * waitForEvent("download"). Chromium has the dialog (session 36); a
 * headless run cannot answer it. Call it after newPage() and before goto().
 */
export async function useDownloads(page) {
  await page.addInitScript(() => {
    try { delete window.showSaveFilePicker; } catch { /* not deletable */ }
    if (typeof window.showSaveFilePicker === "function") window.showSaveFilePicker = undefined;
  });
}

/**
 * The config as the canvas draws it at a Size: the same display copy the
 * preview renders (px per semitone from the Size, no column padding).
 */
export function canvasConfig(config, size) {
  return CNBPreviewDisplay.displayConfig(config, size);
}

/**
 * Show a step's panel by its id (session 63, cnb/ui/steps.js), in order
 * "notehead-height", where the page opens, "staff", "pitch",
 * "ledger-lines", "noteheads", "ks-symbol-type", "ks-custom-symbols",
 * "ks-designer", "ks-preview", "clef-symbol", "clef-placement", "export",
 * or "advanced". A greyed step does not open: steps 8 and 9 need a key
 * signature shown, step 7 one of its own symbols (Custom marks, session
 * 65), step 11 a clef. The staff canvas is hidden in steps
 * 6–9 ("ks-…"). Since session 26 the staff
 * editor is mounted once per section: its pattern and line look in Staff,
 * the ledger rules (Automatic or My own rules) in Ledger lines, and the
 * line overrides in Advanced.
 */
export async function openSection(page, name) {
  await page.click(`.section-link[data-section="${name}"]`);
}

/**
 * Set a form control's value as a user does: the value, then its input and
 * change events (the panels write on change). Session 28: the Pitch
 * section's spacing and nudge fields and the notehead panel's name select.
 */
export async function setField(page, selector, value) {
  await page.$eval(selector, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
}

/**
 * Select a notehead on the canvas by its pitch class (0–11), which opens
 * the notehead panel (session 27, design §2); add: true Shift-clicks it
 * into the selection. The panel holds the shape row's Import from SVG
 * (#svg-importer-host, #import-status, #import-warnings).
 */
export async function selectNotehead(page, pc, { add = false } = {}) {
  await page.click(`.canvas-card .cnb-pvd-preview .pc-col[data-pc="${pc}"]`,
    add ? { modifiers: ["Shift"] } : {});
  await page.waitForSelector(".cnb-notehead-panel");
}

/**
 * Show Advanced and open its disclosure whose summary starts with `title`
 * ("Rules for particular durations or keys", "Durations and engine",
 * "Staff line overrides", "Pitch axis map", "Pitch range shown", "View
 * file (JSON)"). Since session 27 the notehead rule editor lives here; the
 * palette editor that sat beside it was retired in session 37.
 */
export async function openAdvanced(page, title) {
  await openSection(page, "advanced");
  await page.evaluate((t) => {
    for (const d of document.querySelectorAll('[data-panel="advanced"] details')) {
      if (d.querySelector("summary").textContent.startsWith(t)) d.open = true;
    }
  }, title);
}
