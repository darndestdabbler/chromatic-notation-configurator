/**
 * cnb-kept-work-tests.js — the notation kept in the browser
 * (cnb/ui/kept-work.js, session 71)
 *
 * A round trip through a stub storage; nothing kept; malformed,
 * wrong-shaped and non-JSON values; a null storage and one that throws;
 * clear.
 */

import { CNBKeptWork } from "../ui/kept-work.js";
import { CNBConfig } from "../src/cnb-config.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(actual, expected, message) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
}

/** A storage as localStorage behaves, in memory. */
function stubStorage() {
  const items = new Map();
  return {
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => { items.set(k, String(v)); },
    removeItem: (k) => { items.delete(k); },
    items,
  };
}

/** A storage whose every method throws, as a blocked one does. */
const throwingStorage = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); },
};

export const tests = [
  {
    name: "CNBKeptWork.keep / read: the notation, its step and whether it is saved come back",
    fn: () => {
      const storage = stubStorage();
      const config = CNBConfig.createDefault();
      config.staff.semitonePattern = [3, 5, 7, 9];
      assert(CNBKeptWork.keep(storage, { config, step: "ledger-lines", saved: false }), "kept");
      const kept = CNBKeptWork.read(storage);
      eq(kept.config, config, "config");
      eq(kept.step, "ledger-lines", "step");
      eq(kept.saved, false, "saved");
      assert(kept.config !== config, "a copy, not the live config");
      assert(storage.items.has(CNBKeptWork.STORAGE_KEY), "stored under STORAGE_KEY");
      CNBKeptWork.keep(storage, { config, step: "export", saved: true });
      eq(CNBKeptWork.read(storage).step, "export", "a second keep replaces the first");
      eq(CNBKeptWork.read(storage).saved, true, "saved");
    },
  },
  {
    name: "CNBKeptWork.read: nothing kept gives null",
    fn: () => {
      eq(CNBKeptWork.read(stubStorage()), null, "empty storage");
    },
  },
  {
    name: "CNBKeptWork.read: malformed, wrong-shaped and non-JSON values give null",
    fn: () => {
      const config = CNBConfig.createDefault();
      const values = [
        "not json", "{", "null", "42", "\"text\"", "[]",
        JSON.stringify({ step: "staff", saved: true }),
        JSON.stringify({ config: null, step: "staff", saved: true }),
        JSON.stringify({ config: [], step: "staff", saved: true }),
        JSON.stringify({ config, saved: true }),
        JSON.stringify({ config, step: 3, saved: true }),
        JSON.stringify({ config, step: "staff" }),
        JSON.stringify({ config, step: "staff", saved: "yes" }),
      ];
      for (const value of values) {
        const storage = stubStorage();
        storage.setItem(CNBKeptWork.STORAGE_KEY, value);
        eq(CNBKeptWork.read(storage), null, value.slice(0, 40));
      }
    },
  },
  {
    name: "CNBKeptWork: a null storage and one that throws are harmless",
    fn: () => {
      const work = { config: CNBConfig.createDefault(), step: "staff", saved: false };
      for (const storage of [null, undefined, throwingStorage]) {
        eq(CNBKeptWork.read(storage), null, "read");
        eq(CNBKeptWork.keep(storage, work), false, "keep");
        CNBKeptWork.clear(storage);
      }
    },
  },
  {
    name: "CNBKeptWork.keep: a full storage keeps nothing and says so",
    fn: () => {
      const storage = stubStorage();
      storage.setItem = () => { throw new Error("QuotaExceededError"); };
      eq(CNBKeptWork.keep(storage, { config: CNBConfig.createDefault(), step: "staff", saved: true }), false, "keep");
      eq(CNBKeptWork.read(storage), null, "nothing kept");
    },
  },
  {
    name: "CNBKeptWork.clear: the kept notation is gone, other items stay",
    fn: () => {
      const storage = stubStorage();
      storage.setItem("cnb.canvasSize", "large");
      CNBKeptWork.keep(storage, { config: CNBConfig.createDefault(), step: "staff", saved: true });
      CNBKeptWork.clear(storage);
      eq(CNBKeptWork.read(storage), null, "cleared");
      eq(storage.getItem("cnb.canvasSize"), "large", "the canvas Size stays");
      CNBKeptWork.clear(storage);
    },
  },
];
