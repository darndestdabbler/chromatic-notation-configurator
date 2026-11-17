/**
 * history.js — Undo and redo of the config (session 41).
 *
 * A history is a list of config snapshots, kept as JSON strings so a later
 * edit to the live config cannot reach one, and a position in it. The page
 * records the config after every change; undo and redo hand back the
 * snapshot to restore.
 *
 * Grouping: consecutive records with the same non-null group fold into one
 * step, so a value typed a character at a time, or a colour dragged, is
 * undone at once. seal() ends the open group (the page seals on a control's
 * change event).
 *
 * No other state, no event listeners.
 */

export const CNBHistory = {

  /**
   * Start a history at a config.
   *
   * @param {object} config the starting config (snapshotted, not kept)
   * @param {{limit?: number}} [options] how many steps can be undone (100)
   */
  create(config, { limit = 100 } = {}) {
    const steps = [JSON.stringify(config)];
    let at = 0;
    let openGroup = null;

    const restore = () => JSON.parse(steps[at]);

    return {
      /**
       * Record the config after a change. Nothing is recorded when it is
       * the current snapshot. A record whose group is non-null and the
       * open group's replaces the last step instead of adding one.
       * Recording drops what could be redone.
       * @returns {boolean} whether the history changed
       */
      record(config, group = null) {
        const json = JSON.stringify(config);
        if (json === steps[at]) return false;
        if (group !== null && group === openGroup) {
          steps[at] = json;
          return true;
        }
        steps.splice(at + 1);
        steps.push(json);
        if (steps.length > limit + 1) steps.shift();
        at = steps.length - 1;
        openGroup = group;
        return true;
      },

      /** End the open group: the next record is a step of its own. */
      seal() {
        openGroup = null;
      },

      /** Replace the current snapshot without adding a step (Save's stamp). */
      amend(config) {
        steps[at] = JSON.stringify(config);
      },

      /** @returns {object|null} the config before the current step, or null */
      undo() {
        openGroup = null;
        if (at === 0) return null;
        at -= 1;
        return restore();
      },

      /** @returns {object|null} the config of the step undone last, or null */
      redo() {
        openGroup = null;
        if (at === steps.length - 1) return null;
        at += 1;
        return restore();
      },

      canUndo() {
        return at > 0;
      },

      canRedo() {
        return at < steps.length - 1;
      },
    };
  },
};
