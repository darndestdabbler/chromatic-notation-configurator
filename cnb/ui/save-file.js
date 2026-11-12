/**
 * save-file.js — Save a text file where the designer chooses (session 36).
 *
 * Save and Export for LilyPond deliver their files through saveFile. Where
 * the browser has a save dialog (window.showSaveFilePicker: Chrome and
 * Edge), it opens that dialog suggesting the file's usual name, and the
 * designer picks the folder and may rename the file. Where it has none
 * (Firefox), the file is a plain download under the suggested name, as
 * every save was before session 36.
 *
 * The dialog has to open while the click that asked for it is still being
 * handled, so call saveFile from the click handler itself: the dialog is
 * opened before saveFile's first await.
 *
 * No other state, no event listeners. Node tests stub globalThis.
 */

export const CNBSaveFile = {

  /**
   * Save text as a file.
   *
   * @param {{filename: string, text: string, type: string,
   *          description: string, extension: string}} file
   *   filename: the suggested name ("default-4-8-system.json");
   *   type: its MIME type ("application/json"); description and extension
   *   label the dialog's file type ("Notation config", ".json").
   * @returns {Promise<string|null>} the name the file was saved under, or
   *   null when the designer cancelled the dialog. Rejects when the file
   *   could not be written.
   */
  async saveFile({ filename, text, type, description, extension }) {
    const g = globalThis;
    if (typeof g.showSaveFilePicker === "function") {
      let handle;
      try {
        handle = await g.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description, accept: { [type]: [extension] } }],
        });
      } catch (err) {
        if (err && err.name === "AbortError") return null;   // cancelled
        throw err;
      }
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return handle.name;
    }
    if (typeof g.Blob !== "function" || !g.URL || typeof g.URL.createObjectURL !== "function" || !g.document) {
      throw new Error("This browser can neither show a save dialog nor download a file");
    }
    const url = g.URL.createObjectURL(new g.Blob([text], { type }));
    const a = g.document.createElement("a");
    a.href = url;
    a.download = filename;
    g.document.body.appendChild(a);
    a.click();
    a.remove();
    g.URL.revokeObjectURL(url);
    return filename;
  },
};
