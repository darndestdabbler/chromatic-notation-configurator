/**
 * kept-work.js — the notation in progress, kept in the browser (session 71).
 *
 * The page keeps the notation after each change, with the step it is on and
 * whether it has been saved to a file, so a page opened again (a reload, or
 * the browser's Back past the first step) restores it. One notation is kept,
 * under STORAGE_KEY, as JSON.
 *
 * The page passes localStorage; every access is guarded, as the canvas Size
 * is (preview-display.js): a null, blocked or full storage keeps nothing and
 * restores nothing, and nothing here throws.
 *
 * No other state, no event listeners.
 */

const STORAGE_KEY = "cnb.keptWork";

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export const CNBKeptWork = {

  STORAGE_KEY,

  /**
   * The kept notation, or null when there is none, the storage is null or
   * throws, or what is stored is not JSON of the kept shape.
   * @param {{getItem: Function}|null} storage
   * @returns {{config: object, step: string, saved: boolean}|null}
   */
  read(storage) {
    try {
      const text = storage ? storage.getItem(STORAGE_KEY) : null;
      if (typeof text !== "string") return null;
      const kept = JSON.parse(text);
      if (!isPlainObject(kept) || !isPlainObject(kept.config) ||
        typeof kept.step !== "string" || typeof kept.saved !== "boolean") return null;
      return { config: kept.config, step: kept.step, saved: kept.saved };
    } catch {
      return null;
    }
  },

  /**
   * Keep the notation, its step and whether it is saved.
   * @param {{setItem: Function}|null} storage
   * @param {{config: object, step: string, saved: boolean}} work
   * @returns {boolean} whether it was kept (false for a null, blocked or
   *   full storage)
   */
  keep(storage, { config, step, saved }) {
    try {
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify({ config, step, saved: !!saved }));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Forget the kept notation (New).
   * @param {{removeItem: Function}|null} storage
   */
  clear(storage) {
    try {
      if (storage) storage.removeItem(STORAGE_KEY);
    } catch {
      // Blocked storage: nothing was kept.
    }
  },
};
