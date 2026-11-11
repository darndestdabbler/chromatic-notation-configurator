/**
 * cnb-save-file-tests.js — Unit tests for CNBSaveFile (session 36).
 *
 * The save dialog (showSaveFilePicker) and the download are stubbed on
 * globalThis: the tests pin what the dialog is asked for, what is written,
 * the name reported back, a cancel, and the download where there is no
 * dialog.
 */

import { CNBSaveFile } from "../ui/save-file.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}
function eq(actual, expected, message) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
}

/** Run fn with globals replaced (undefined deletes one), then put them back. */
async function withGlobals(overrides, fn) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = { had: key in globalThis, value: globalThis[key] };
    if (overrides[key] === undefined) delete globalThis[key];
    else globalThis[key] = overrides[key];
  }
  try {
    return await fn();
  } finally {
    for (const [key, { had, value }] of Object.entries(saved)) {
      if (had) globalThis[key] = value;
      else delete globalThis[key];
    }
  }
}

const FILE = {
  filename: "default-4-8-system.json",
  text: "{\"version\":\"1.0\"}\n",
  type: "application/json",
  description: "Notation config",
  extension: ".json",
};

/** A save dialog that records its options and saves under `name`. */
function fakePicker(name, log) {
  return async (options) => {
    log.options = options;
    return {
      name,
      async createWritable() {
        return {
          async write(text) { log.written = (log.written || "") + text; },
          async close() { log.closed = true; },
        };
      },
    };
  };
}

/** A document whose anchors record their clicks. */
function fakeDocument(log) {
  return {
    body: { appendChild(a) { log.appended = a; } },
    createElement(tag) {
      return { tag, click() { log.clicked = { href: this.href, download: this.download }; }, remove() { log.removed = true; } };
    },
  };
}

export const tests = [
  {
    name: "saveFile: with a save dialog, it suggests the file name and type, writes the text and returns the chosen name",
    fn: async () => {
      const log = {};
      const name = await withGlobals({ showSaveFilePicker: fakePicker("my-kite.json", log) },
        () => CNBSaveFile.saveFile(FILE));
      eq(name, "my-kite.json", "the chosen name");
      eq(log.options, {
        suggestedName: "default-4-8-system.json",
        types: [{ description: "Notation config", accept: { "application/json": [".json"] } }],
      }, "the dialog's options");
      eq(log.written, FILE.text, "the text written");
      assert(log.closed, "the file is closed");
    },
  },
  {
    name: "saveFile: a cancelled save dialog returns null and writes nothing",
    fn: async () => {
      const cancel = async () => { const e = new Error("The user aborted a request."); e.name = "AbortError"; throw e; };
      const log = {};
      const name = await withGlobals({ showSaveFilePicker: cancel, document: fakeDocument(log) },
        () => CNBSaveFile.saveFile(FILE));
      eq(name, null, "cancel");
      assert(!log.clicked, "no download in its place");
    },
  },
  {
    name: "saveFile: any other failure of the dialog rejects",
    fn: async () => {
      const fail = async () => { const e = new Error("not allowed"); e.name = "SecurityError"; throw e; };
      let error = null;
      await withGlobals({ showSaveFilePicker: fail }, () => CNBSaveFile.saveFile(FILE).catch(e => { error = e; }));
      assert(error && error.message === "not allowed", "the dialog's error is passed on");
    },
  },
  {
    name: "saveFile: the dialog opens before saveFile's first await (it must open within the click)",
    fn: async () => {
      const log = {};
      let opened = false;
      const picker = fakePicker("x.json", log);
      await withGlobals({ showSaveFilePicker: (o) => { opened = true; return picker(o); } }, () => {
        const pending = CNBSaveFile.saveFile(FILE);
        assert(opened, "the dialog was opened synchronously");
        return pending;
      });
    },
  },
  {
    name: "saveFile: without a save dialog, it downloads the file under the suggested name and returns that name",
    fn: async () => {
      const log = {};
      const fakeURL = {
        createObjectURL(blob) { log.blob = blob; return "blob:test"; },
        revokeObjectURL(url) { log.revoked = url; },
      };
      const name = await withGlobals({ showSaveFilePicker: undefined, document: fakeDocument(log), URL: fakeURL },
        () => CNBSaveFile.saveFile(FILE));
      eq(name, "default-4-8-system.json", "the suggested name");
      eq(log.clicked, { href: "blob:test", download: "default-4-8-system.json" }, "the anchor clicked");
      eq(log.blob.type, "application/json", "the blob's type");
      eq(await log.blob.text(), FILE.text, "the blob's text");
      assert(log.removed && log.revoked === "blob:test", "the anchor and the URL are cleaned up");
    },
  },
  {
    name: "saveFile: with neither a dialog nor a document, it rejects with a message",
    fn: async () => {
      let error = null;
      await withGlobals({ showSaveFilePicker: undefined, document: undefined },
        () => CNBSaveFile.saveFile(FILE).catch(e => { error = e; }));
      assert(error && /neither show a save dialog nor download/.test(error.message), String(error));
    },
  },
];
