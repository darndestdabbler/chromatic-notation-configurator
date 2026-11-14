/**
 * cnb-history-tests.js — Unit tests for CNBHistory (session 41).
 */

import { CNBHistory } from "../ui/history.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}
function eq(actual, expected, message) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
}

export const tests = [
  {
    name: "create: a new history has nothing to undo or redo",
    fn: () => {
      const h = CNBHistory.create({ n: 0 });
      assert(!h.canUndo() && !h.canRedo(), "nothing to undo or redo");
      eq(h.undo(), null, "undo at the start");
      eq(h.redo(), null, "redo at the end");
    },
  },
  {
    name: "create: the starting config is snapshotted, not kept",
    fn: () => {
      const config = { n: 0 };
      const h = CNBHistory.create(config);
      config.n = 5;
      h.record({ n: 1 });
      eq(h.undo(), { n: 0 }, "the start as it was");
    },
  },
  {
    name: "record: each change is a step, undone and redone in order",
    fn: () => {
      const h = CNBHistory.create({ n: 0 });
      assert(h.record({ n: 1 }), "recorded");
      h.record({ n: 2 });
      assert(h.canUndo() && !h.canRedo(), "can undo only");
      eq(h.undo(), { n: 1 }, "first undo");
      eq(h.undo(), { n: 0 }, "second undo");
      eq(h.undo(), null, "nothing left");
      eq(h.redo(), { n: 1 }, "first redo");
      eq(h.redo(), { n: 2 }, "second redo");
      eq(h.redo(), null, "nothing to redo");
    },
  },
  {
    name: "record: an unchanged config adds no step",
    fn: () => {
      const h = CNBHistory.create({ n: 0 });
      assert(!h.record({ n: 0 }), "not recorded");
      assert(!h.canUndo(), "nothing to undo");
      h.record({ n: 1 });
      h.record({ n: 1 });
      h.undo();
      assert(!h.canUndo(), "one step only");
    },
  },
  {
    name: "record: records of one group fold into one step",
    fn: () => {
      const input = {};
      const h = CNBHistory.create({ name: "" });
      h.record({ name: "a" }, input);
      h.record({ name: "ab" }, input);
      h.record({ name: "abc" }, input);
      eq(h.undo(), { name: "" }, "the typed value undone at once");
      eq(h.redo(), { name: "abc" }, "and redone whole");
    },
  },
  {
    name: "record: a different group, or no group, starts a new step",
    fn: () => {
      const a = {}, b = {};
      const h = CNBHistory.create({ n: 0 });
      h.record({ n: 1 }, a);
      h.record({ n: 2 }, b);
      h.record({ n: 3 });
      h.record({ n: 4 });
      eq(h.undo(), { n: 3 }, "no group");
      eq(h.undo(), { n: 2 }, "no group after b");
      eq(h.undo(), { n: 1 }, "b after a");
      eq(h.undo(), { n: 0 }, "a");
    },
  },
  {
    name: "record: a new change after undo drops what could be redone",
    fn: () => {
      const h = CNBHistory.create({ n: 0 });
      h.record({ n: 1 });
      h.record({ n: 2 });
      h.undo();
      h.record({ n: 9 });
      assert(!h.canRedo(), "nothing to redo");
      eq(h.undo(), { n: 1 }, "back past the new change");
    },
  },
  {
    name: "record: the oldest steps drop beyond the limit",
    fn: () => {
      const h = CNBHistory.create({ n: 0 }, { limit: 3 });
      for (let n = 1; n <= 5; n++) h.record({ n });
      eq(h.undo(), { n: 4 }, "1");
      eq(h.undo(), { n: 3 }, "2");
      eq(h.undo(), { n: 2 }, "3");
      eq(h.undo(), null, "three levels only");
    },
  },
  {
    name: "seal: ends the open group",
    fn: () => {
      const input = {};
      const h = CNBHistory.create({ name: "" });
      h.record({ name: "a" }, input);
      h.seal();
      h.record({ name: "ab" }, input);
      eq(h.undo(), { name: "a" }, "the second value");
      eq(h.undo(), { name: "" }, "the first value");
    },
  },
  {
    name: "amend: replaces the current snapshot without a step",
    fn: () => {
      const h = CNBHistory.create({ n: 0 });
      h.record({ n: 1 });
      h.amend({ n: 1, saved: true });
      assert(!h.record({ n: 1, saved: true }), "the amended config is current");
      eq(h.undo(), { n: 0 }, "one step undone");
      eq(h.redo(), { n: 1, saved: true }, "redo brings the amended config");
    },
  },
  {
    name: "undo: closes the open group",
    fn: () => {
      const input = {};
      const h = CNBHistory.create({ name: "" });
      h.record({ name: "a" }, input);
      h.record({ name: "ab" }, input);
      h.undo();
      h.record({ name: "x" }, input);
      h.record({ name: "xy" }, input);
      eq(h.undo(), { name: "" }, "the new value is one step");
    },
  },
  {
    name: "undo and redo: return an independent copy",
    fn: () => {
      const h = CNBHistory.create({ list: [1] });
      h.record({ list: [1, 2] });
      const back = h.undo();
      back.list.push(99);
      eq(h.redo(), { list: [1, 2] }, "redo unaffected");
      eq(h.undo(), { list: [1] }, "undo unaffected");
    },
  },
  {
    name: "canUndo and canRedo: follow the position",
    fn: () => {
      const h = CNBHistory.create({ n: 0 });
      h.record({ n: 1 });
      assert(h.canUndo() && !h.canRedo(), "after a change");
      h.undo();
      assert(!h.canUndo() && h.canRedo(), "after undo");
      h.redo();
      assert(h.canUndo() && !h.canRedo(), "after redo");
    },
  },
];
