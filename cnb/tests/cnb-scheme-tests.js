/**
 * cnb-scheme-tests.js — Unit tests for the Scheme emitters (cnb-scheme.js)
 */

import { CNBScheme } from "../src/cnb-scheme.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "eq"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function throwsNaming(fn, field, msg) {
  try {
    fn();
  } catch (err) {
    assert(err.message.includes(field), `${msg}: error should name "${field}", got "${err.message}"`);
    return;
  }
  throw new Error(`${msg}: expected a throw`);
}

const EXPORTER_PATH = "'(\n    (moveto 0 0.6667)\n    (lineto 0.6667 0.3333)\n    (curveto 1 2 3 4 5 6)\n    (closepath))";
const TOOLKIT_PATH = "'( (moveto 0 0.6667) (lineto 0.6667 0.3333) (curveto 1 2 3 4 5 6) (closepath))";

export const tests = [

  // ── slug ──────────────────────────────────────────────────────────────────
  { name: "slug lowercases and collapses non-alphanumerics", fn: () => {
    eq(CNBScheme.slug("Crotchet–Minim"), "crotchet-minim");
    eq(CNBScheme.slug("Kite Up"), "kite-up");
    eq(CNBScheme.slug("  --a__b--  "), "a-b");
  }},
  { name: "slug of non-ASCII text is empty", fn: () => eq(CNBScheme.slug("音符"), "") },

  // ── comment ───────────────────────────────────────────────────────────────
  { name: "comment turns newline + #(display …) into one inert line", fn: () => {
    const out = CNBScheme.comment('Innocent\n#(display "INJECTED")\n%%');
    eq(out, 'Innocent #(display "INJECTED") %%');
    assert(!/[\r\n]/.test(out), "no line break survives");
  }},
  { name: "comment replaces CR, tab, NUL, DEL, C1 and line/paragraph separators", fn: () => {
    eq(CNBScheme.comment("a\rb\tc\u0000d\u007fe\u0085f" + String.fromCharCode(0x2028) + "g" + String.fromCharCode(0x2029) + "h"), "a b c d e f g h");
  }},
  { name: "comment keeps ordinary text and non-ASCII as is", fn: () => {
    eq(CNBScheme.comment("C♯ → kite-up, solid"), "C♯ → kite-up, solid");
  }},

  // ── string ────────────────────────────────────────────────────────────────
  { name: "string quotes and escapes backslash and double quote", fn: () => {
    eq(CNBScheme.string('a"b\\c'), '"a\\"b\\\\c"');
  }},
  { name: "string keeps a closing-quote payload inside the literal", fn: () => {
    const out = CNBScheme.string('x") (system "rm") ("');
    eq(out, '"x\\") (system \\"rm\\") (\\""');
  }},
  { name: "string of empty text is an empty literal", fn: () => eq(CNBScheme.string(""), '""') },

  // ── symbol ────────────────────────────────────────────────────────────────
  { name: "isSymbol accepts lowercase hyphenated names", fn: () => {
    assert(CNBScheme.isSymbol("shamrock-1b9e77"));
    assert(CNBScheme.isSymbol("a"));
  }},
  { name: "isSymbol rejects spaces, parens, quotes, leading digits, empty, non-strings", fn: () => {
    for (const v of ["red ff0000", "x)", "(system", "'x", "1abc", "", "-x", "Red", 7, null, undefined]) {
      assert(!CNBScheme.isSymbol(v), `should reject ${JSON.stringify(v)}`);
    }
  }},
  { name: "symbol returns a valid symbol unchanged", fn: () => eq(CNBScheme.symbol("kite-up", "f"), "kite-up") },
  { name: "symbol throws naming the field", fn: () => {
    throwsNaming(() => CNBScheme.symbol("x) (system \"ls\")", "palette.schemeSymbols"), "palette.schemeSymbols", "payload");
    throwsNaming(() => CNBScheme.symbol("", "shapes"), "shapes", "empty");
  }},

  // ── number ────────────────────────────────────────────────────────────────
  { name: "number formats integers bare and floats to at most 4 decimals", fn: () => {
    eq(CNBScheme.number(3, "f"), "3");
    eq(CNBScheme.number(-0.5, "f"), "-0.5");
    eq(CNBScheme.number(2 / 3, "f"), "0.6667");
    eq(CNBScheme.number(0.1 + 0.2, "f"), "0.3");
  }},
  { name: "number prints negative zero as 0", fn: () => {
    eq(CNBScheme.number(-0, "f"), "0");
    eq(CNBScheme.number(-0.00001, "f"), "0");
  }},
  { name: "isNumber / number reject NaN, Infinity, strings and null", fn: () => {
    for (const v of [NaN, Infinity, -Infinity, "3", "(system)", null, undefined]) {
      assert(!CNBScheme.isNumber(v), `isNumber should reject ${String(v)}`);
      throwsNaming(() => CNBScheme.number(v, "engine.indent"), "engine.indent", String(v));
    }
  }},

  // ── ratio ─────────────────────────────────────────────────────────────────
  { name: "parseRatio accepts positive numbers and decimal fractions", fn: () => {
    eq(JSON.stringify(CNBScheme.parseRatio("7/4")), JSON.stringify({ num: 7, den: 4 }));
    eq(JSON.stringify(CNBScheme.parseRatio("1.5")), JSON.stringify({ num: 1.5, den: null }));
    eq(JSON.stringify(CNBScheme.parseRatio(2)), JSON.stringify({ num: 2, den: null }));
  }},
  { name: "parseRatio rejects payloads, zero, negatives and non-finite values", fn: () => {
    for (const v of ["7/4) (system \"ls\"", "(/ 7 4)", "-1", "0", "0/4", "7/0", "7/", "/4", "", 0, -1, NaN, Infinity, null]) {
      eq(CNBScheme.parseRatio(v), null, `parseRatio(${JSON.stringify(v)})`);
    }
  }},
  { name: "ratio re-emits from the parsed numbers", fn: () => {
    eq(CNBScheme.ratio("7/4", "f"), "7/4");
    eq(CNBScheme.ratio("1.50", "f"), "1.5");
    eq(CNBScheme.ratio(2, "f"), "2");
  }},
  { name: "ratio throws naming the field", fn: () => {
    throwsNaming(() => CNBScheme.ratio('7/4) #(display "X")', "engine.defaultMagnify"), "engine.defaultMagnify", "payload");
  }},

  // ── version ───────────────────────────────────────────────────────────────
  { name: "isVersion accepts x.y.z only", fn: () => {
    assert(CNBScheme.isVersion("2.24.2"));
    for (const v of ["2.24", "2.24.2\"\n#(display 1)", "v2.24.2", "2.24.2 ", "", 2.24, null]) {
      assert(!CNBScheme.isVersion(v), `should reject ${JSON.stringify(v)}`);
    }
  }},
  { name: "version returns a valid version and throws naming the field otherwise", fn: () => {
    eq(CNBScheme.version("2.24.2", "f"), "2.24.2");
    throwsNaming(() => CNBScheme.version('2.24.2"\n#(display "X")', "engine.lilypondVersion"), "engine.lilypondVersion", "payload");
  }},

  // ── parsePath ─────────────────────────────────────────────────────────────
  { name: "parsePath reads the four commands with their numbers", fn: () => {
    const cmds = CNBScheme.parsePath(TOOLKIT_PATH);
    eq(JSON.stringify(cmds), JSON.stringify([
      { cmd: "moveto", args: [0, 0.6667] },
      { cmd: "lineto", args: [0.6667, 0.3333] },
      { cmd: "curveto", args: [1, 2, 3, 4, 5, 6] },
      { cmd: "closepath", args: [] },
    ]));
  }},
  { name: "parsePath accepts unquoted lists, signs, bare decimals and the empty path", fn: () => {
    eq(JSON.stringify(CNBScheme.parsePath("((moveto -1 +.5))")), JSON.stringify([{ cmd: "moveto", args: [-1, 0.5] }]));
    eq(JSON.stringify(CNBScheme.parsePath("'()")), "[]");
  }},
  { name: "parsePath rejects a path carrying (system …)", fn: () => {
    eq(CNBScheme.parsePath(`'()) (system "calc") (define x '()`), null, "audit payload");
    eq(CNBScheme.parsePath(`'((moveto 0 0) (system "calc"))`), null, "unknown command");
    eq(CNBScheme.parsePath(`'((moveto 0 0)) #(display "X")`), null, "trailing code");
  }},
  { name: "parsePath rejects unbalanced parens", fn: () => {
    eq(CNBScheme.parsePath("'((moveto 0 0)"), null, "unclosed");
    eq(CNBScheme.parsePath("'((moveto 0 0)))"), null, "extra close");
    eq(CNBScheme.parsePath("'(moveto 0 0)"), null, "not nested");
  }},
  { name: "parsePath rejects wrong argument counts and non-numeric arguments", fn: () => {
    eq(CNBScheme.parsePath("'((moveto 0))"), null, "too few");
    eq(CNBScheme.parsePath("'((lineto 0 0 0))"), null, "too many");
    eq(CNBScheme.parsePath("'((closepath 1))"), null, "closepath with args");
    eq(CNBScheme.parsePath("'((moveto 0 x))"), null, "symbol argument");
    eq(CNBScheme.parsePath("'((moveto 0 1e3))"), null, "exponent");
    eq(CNBScheme.parsePath("'((moveto 0 #t))"), null, "boolean");
  }},
  { name: "parsePath rejects non-strings and empty text", fn: () => {
    for (const v of [null, undefined, 3, "", "   "]) eq(CNBScheme.parsePath(v), null, String(v));
  }},

  // ── path ──────────────────────────────────────────────────────────────────
  { name: "path re-emits toolkit single-line and exporter multi-line paths identically", fn: () => {
    eq(CNBScheme.path(TOOLKIT_PATH, "f"), EXPORTER_PATH, "toolkit");
    eq(CNBScheme.path(EXPORTER_PATH, "f"), EXPORTER_PATH, "exporter");
  }},
  { name: "path accepts a parsed command array and emits the empty path as '()", fn: () => {
    eq(CNBScheme.path([{ cmd: "moveto", args: [1, -0] }, { cmd: "closepath", args: [] }], "f"),
      "'(\n    (moveto 1 0)\n    (closepath))");
    eq(CNBScheme.path("'()", "f"), "'()");
  }},
  { name: "path throws naming the field for text that does not parse", fn: () => {
    throwsNaming(() => CNBScheme.path(`'()) (system "calc") (define x '()`, "shapes.kite.lilypondPath"),
      "shapes.kite.lilypondPath", "payload");
  }},
  { name: "path throws for a command array with a bad command or argument", fn: () => {
    throwsNaming(() => CNBScheme.path([{ cmd: "system", args: [] }], "p"), "p", "bad command");
    throwsNaming(() => CNBScheme.path([{ cmd: "moveto", args: [0, NaN] }], "p"), "p", "NaN");
    throwsNaming(() => CNBScheme.path([{ cmd: "moveto", args: [0] }], "p"), "p", "arity");
  }},

];
