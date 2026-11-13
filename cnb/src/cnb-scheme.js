/**
 * cnb-scheme.js — Scheme emitters for the LilyPond exporter
 *
 * The only way config text may reach an exported .ly file (audit
 * 2026-11-02, H1/L6). Each emitter either produces inert Scheme/LilyPond
 * text or throws an Error naming the config field; the matching predicates
 * (isSymbol, isNumber, parseRatio, isVersion, parsePath) let Module A's
 * validate() reject exactly what an emitter would reject.
 *
 * Dependencies: none
 */

const SYMBOL_RE = /^[a-z][a-z0-9-]*$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const RATIO_RE = /^\d+(\.\d+)?(\/\d+(\.\d+)?)?$/;
const PATH_NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
// C0 and C1 control characters plus the line/paragraph separators
// (U+2028/U+2029, added by char code so the source stays ASCII).
const CONTROL_RE = new RegExp(
  "[\\x00-\\x1f\\x7f-\\x9f" + String.fromCharCode(0x2028, 0x2029) + "]", "g");

// LilyPond path commands and their argument counts.
const PATH_ARITY = new Map([
  ["moveto", 2],
  ["lineto", 2],
  ["curveto", 6],
  ["closepath", 0],
]);

function describe(v) {
  return typeof v === "string" ? JSON.stringify(v) : String(v);
}

export const CNBScheme = {

  /** Scheme-safe slug: lowercase, non-alphanumerics collapsed to hyphens. */
  slug(name) {
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  },

  /** Text for a %% or ;; comment: every control character becomes a space. */
  comment(text) {
    return String(text).replace(CONTROL_RE, " ");
  },

  /** A double-quoted Scheme string literal, `\` and `"` escaped. */
  string(text) {
    return `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  },

  isSymbol(v) {
    return typeof v === "string" && SYMBOL_RE.test(v);
  },

  /** v when it is a safe symbol, else throws naming the field. */
  symbol(v, field) {
    if (!CNBScheme.isSymbol(v)) {
      throw new Error(`${field}: ${describe(v)} is not a valid Scheme symbol (expected ^[a-z][a-z0-9-]*$)`);
    }
    return v;
  },

  isNumber(v) {
    return typeof v === "number" && Number.isFinite(v);
  },

  /** A finite number formatted for Scheme: integers bare, else ≤ 4 decimals. */
  number(v, field) {
    if (!CNBScheme.isNumber(v)) {
      throw new Error(`${field}: ${describe(v)} is not a finite number`);
    }
    if (Number.isInteger(v)) return String(v);
    const rounded = parseFloat(v.toFixed(4));
    return Object.is(rounded, -0) ? "0" : String(rounded);
  },

  /**
   * Parse a positive ratio: a finite number > 0, or a string "a", "a.b",
   * "a/b" of unsigned decimals. Returns { num, den } (den null when there is
   * no fraction), or null. A decimal too long for a double (hundreds of
   * digits parse to Infinity) is refused, so validation rejects what the
   * exporter would.
   */
  parseRatio(v) {
    if (typeof v === "number") {
      return Number.isFinite(v) && v > 0 ? { num: v, den: null } : null;
    }
    if (typeof v !== "string" || !RATIO_RE.test(v)) return null;
    const [a, b] = v.split("/");
    const num = Number(a);
    const den = b === undefined ? null : Number(b);
    const positive = n => Number.isFinite(n) && n > 0;
    if (!positive(num) || (den !== null && !positive(den))) return null;
    return { num, den };
  },

  /** A ratio re-emitted from its parsed numbers, e.g. "7/4". */
  ratio(v, field) {
    const r = CNBScheme.parseRatio(v);
    if (!r) throw new Error(`${field}: ${describe(v)} is not a positive number or fraction`);
    const num = CNBScheme.number(r.num, field);
    return r.den === null ? num : `${num}/${CNBScheme.number(r.den, field)}`;
  },

  isVersion(v) {
    return typeof v === "string" && VERSION_RE.test(v);
  },

  /** v when it is an x.y.z version, else throws naming the field. */
  version(v, field) {
    if (!CNBScheme.isVersion(v)) {
      throw new Error(`${field}: ${describe(v)} is not a version (expected x.y.z)`);
    }
    return v;
  },

  /**
   * Strictly parse LilyPond path data: an optionally quoted list of
   * (moveto x y), (lineto x y), (curveto x1 y1 x2 y2 x3 y3) and (closepath),
   * with numeric literals and nothing else. Returns [{ cmd, args }] or null;
   * null too for a literal too long for a double (it parses to Infinity).
   */
  parsePath(text) {
    if (typeof text !== "string") return null;
    const tokens = text.match(/[()']|[^\s()']+/g) || [];
    let i = 0;
    if (tokens[i] === "'") i++;
    if (tokens[i++] !== "(") return null;

    const commands = [];
    for (;;) {
      const t = tokens[i++];
      if (t === ")") break;
      if (t !== "(") return null;
      const cmd = tokens[i++];
      if (!PATH_ARITY.has(cmd)) return null;
      const args = [];
      for (let k = 0; k < PATH_ARITY.get(cmd); k++) {
        const n = tokens[i++];
        if (n === undefined || !PATH_NUMBER_RE.test(n)) return null;
        const value = Number(n);
        if (!Number.isFinite(value)) return null;
        args.push(value);
      }
      if (tokens[i++] !== ")") return null;
      commands.push({ cmd, args });
    }
    return i === tokens.length ? commands : null;
  },

  /**
   * LilyPond path data re-emitted from its numbers in the exporter's layout:
   * "'(\n    (moveto 0 1)\n    (closepath))". Takes path text or a parsed
   * command array; throws naming the field when it is not valid path data.
   */
  path(value, field) {
    const commands = Array.isArray(value) ? value : CNBScheme.parsePath(value);
    if (!commands) throw new Error(`${field}: not valid LilyPond path data`);
    if (commands.length === 0) return "'()";
    const parts = commands.map(({ cmd, args }) => {
      if (!PATH_ARITY.has(cmd) || !Array.isArray(args) || args.length !== PATH_ARITY.get(cmd)) {
        throw new Error(`${field}: not valid LilyPond path data`);
      }
      return `(${[cmd, ...args.map(n => CNBScheme.number(n, field))].join(" ")})`;
    });
    return "'(\n    " + parts.join("\n    ") + ")";
  },

};
