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
 * The config as the canvas draws it at a Size: the same display copy the
 * preview renders (px per semitone from the Size, no column padding).
 */
export function canvasConfig(config, size) {
  return CNBPreviewDisplay.displayConfig(config, size);
}

/** Show a section's panel ("staff", "noteheads", "clef", "key-signature", "advanced", "export"). */
export async function openSection(page, name) {
  await page.click(`.section-link[data-section="${name}"]`);
}

/**
 * Show Advanced and open its disclosure whose summary starts with `title`
 * ("Durations and engine", "Pitch axis map", "Pitch range shown",
 * "View file (JSON)").
 */
export async function openAdvanced(page, title) {
  await openSection(page, "advanced");
  await page.evaluate((t) => {
    for (const d of document.querySelectorAll('[data-panel="advanced"] details')) {
      if (d.querySelector("summary").textContent.startsWith(t)) d.open = true;
    }
  }, title);
}
