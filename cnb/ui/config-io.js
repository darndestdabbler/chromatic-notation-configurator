/**
 * config-io.js — Module 17: Config Save/Load (JSON)
 *
 * Save the full config object (Module A schema) to a downloadable JSON file
 * and load a JSON file back into app state. The JSON file is the
 * Configurator's native save format (LY spec §1: it "preserves the full
 * editing state"); the `.ly` export (Module 18) is the one-way artifact.
 *
 * Scope decisions for this build (session-set 006, session 1):
 *   - Filename derivation from `meta.configName` (spec step 1:
 *     "meta.configName-derived filename") uses one documented rule:
 *     lowercase the name, replace every run of characters outside [a-z0-9]
 *     with a single hyphen, strip leading/trailing hyphens, and append
 *     ".cnb.json". A name that derives to an empty slug (empty string,
 *     whitespace, or no ASCII alphanumerics at all) makes deriveFilename()
 *     THROW — inventing a fallback filename would be a silent guess.
 *   - Timestamps per plan §4.11: `meta.created` is "set on first save" —
 *     stampMeta() writes it only when it is not already a non-empty string —
 *     and `meta.modified` is set on EVERY save. Both are ISO 8601 strings.
 *     Because the stamp lives in the returned copy, the host MUST adopt the
 *     stamped config returned through onSave()/save() back into its shared
 *     config state; otherwise every save looks like the first save and
 *     `created` is re-stamped each time.
 *   - Load runs the parsed file through CNBConfig.merge() over
 *     CNBConfig.createDefault() and then CNBConfig.validate() (spec step 1:
 *     "so partial or older-shaped configs still work"). One correction on
 *     top of the plain deep merge: Module A's deepMerge merges OBJECT MAPS
 *     key-by-key, which would resurrect default entries into loaded configs
 *     for the open-keyed dictionary sections (a config saved with only a
 *     custom shape would come back with the default "crotchet-minim" shape
 *     re-added). mergeLoaded() therefore REPLACES, not merges, each
 *     open-keyed map section that the loaded file provides — the list is
 *     REPLACE_PATHS below (shapes, keys.offKeyMark, clef.glyphs — the last
 *     added with the set-009 clef section; the line-override maps and
 *     durations.repeatCounts left in session 34, palette.schemeSymbols in
 *     session 37). Fixed-schema objects (staff, display,
 *     engine, meta, …) still merge field-by-field so older files gain new
 *     fields' defaults, and arrays already replace wholesale in Module A.
 *   - Loading NEVER blocks on validation: a config with validation errors
 *     still loads (the user needs it in the editors to fix it), and the
 *     errors/warnings are surfaced in the UI and handed to onLoad().
 *     Blocking on errors is Module 18's job (export), per LY spec §8.
 *   - A config saved with a palette (before session 37) loads with its
 *     colours moved onto the noteheads (CNBConfig.paletteToRules).
 *   - A malformed FILE is user input, not a caller bug: parseConfigFile()
 *     throws descriptive errors (non-string input, invalid JSON, non-object
 *     root) and render()'s load path catches them, shows the message in
 *     .cnb-cio-error, and leaves app state untouched (onLoad is not
 *     called). The pure functions themselves keep the verified Modules
 *     13–15 policy: they THROW on invalid input rather than guessing.
 *   - Hostile input (session 6): mergeLoaded() also rejects a file whose
 *     merged value KINDS differ from createDefault()'s (an array where an
 *     object belongs, a string where a number does — older or foreign
 *     saves), naming the first such field, and a file that still makes
 *     CNBConfig.validate() throw. A host whose onLoad() throws (it could
 *     not adopt the config and has restored its own state) gets the same
 *     treatment: the error shows in .cnb-cio-error and loadText() returns
 *     null.
 *
 * Editor-side contract (same rendering rules as Modules 12–15): render()
 * builds plain DOM via document.createElement, wires events as element
 * properties (onclick/onchange) so the whole UI is exercisable in Node
 * against a stub document, and leaves all layout/styling to the host via
 * the .cnb-cio-* class hooks. Module 17 does not own config state — the
 * host does (architecture plan session-set 006 spec: "the UI shell owns
 * state") — so render() takes a `getConfig` accessor plus onSave/onLoad
 * callbacks instead of a config seed.
 *
 * Dependencies: Module A only.
 */

import { CNBConfig } from "../src/cnb-config.js";

/**
 * Open-keyed dictionary sections of the Module A schema. When the loaded
 * file provides one of these, its value replaces the default wholesale
 * instead of merging key-by-key (see module header). Fixed-schema objects
 * are deliberately NOT listed — they merge so older files pick up defaults
 * for fields added since they were saved.
 */
const REPLACE_PATHS = [
  ["shapes"],
  ["keys", "offKeyMark"],
  ["clef", "glyphs"],
];

const FILENAME_EXTENSION = ".cnb.json";

// ─── Pure helpers ────────────────────────────────────────────────────────────

function deepClone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Value at a key path inside an object, or undefined. */
function getPath(obj, pathKeys) {
  let cur = obj;
  for (const key of pathKeys) {
    if (!isPlainObject(cur) || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Set a value at a key path (parents must already exist as objects). */
function setPath(obj, pathKeys, value) {
  let cur = obj;
  for (const key of pathKeys.slice(0, -1)) {
    if (!isPlainObject(cur[key])) return;   // parent absent — nothing to place
    cur = cur[key];
  }
  cur[pathKeys[pathKeys.length - 1]] = value;
}

/** "array" | "object" | "null" | typeof — the kind of a JSON value. */
function kindOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

const ARTICLE = { array: "an array", object: "an object", string: "a string",
  number: "a number", boolean: "a boolean", null: "null" };

/**
 * Throw naming the first field of `config` whose kind differs from the
 * default's at the same path. Recurses into fixed-schema objects, not into
 * the REPLACE_PATHS maps (their keys are the user's), and skips paths whose
 * default is null (those fields legitimately take more than one kind).
 * Keys the default does not have are left alone.
 */
function checkKinds(def, config, pathKeys = []) {
  for (const key of Object.keys(def)) {
    const dv = def[key];
    if (dv === null || !(key in config)) continue;
    const here = [...pathKeys, key];
    const want = kindOf(dv);
    const got = kindOf(config[key]);
    if (got !== want) {
      throw new Error(
        `Config file field "${here.join(".")}" should be ${ARTICLE[want]}, ` +
        `got ${ARTICLE[got] || got} — this file does not match the current ` +
        "configuration schema");
    }
    const isMap = REPLACE_PATHS.some(p => p.join(".") === here.join("."));
    if (want === "object" && !isMap) checkKinds(dv, config[key], here);
  }
}

export const CNBConfigIO = {

  REPLACE_PATHS,
  FILENAME_EXTENSION,

  /**
   * Derive the download filename from a config name (spec step 1). Rule:
   * lowercase → every run of characters outside [a-z0-9] becomes one
   * hyphen → leading/trailing hyphens stripped → ".cnb.json" appended.
   * "Default 4-8 System" → "default-4-8-system.cnb.json".
   * Throws when the name is not a string or the derived slug is empty
   * (e.g. "", "   ", "♯♯♯") — set meta.configName before saving.
   * @param {string} configName
   * @returns {string}
   */
  deriveFilename(configName) {
    if (typeof configName !== "string") {
      throw new Error(`Config name must be a string (got ${JSON.stringify(configName)})`);
    }
    const slug = configName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug.length === 0) {
      throw new Error(
        `Cannot derive a filename from configName ${JSON.stringify(configName)} — ` +
        "it contains no letters or digits. Set meta.configName before saving.");
    }
    return slug + FILENAME_EXTENSION;
  },

  /**
   * Return a new config with save timestamps stamped per plan §4.11:
   * meta.created is set only when not already a non-empty string ("set on
   * first save"); meta.modified is set on every call. The input config is
   * not mutated. Throws on a nowIso that is not a parseable date string.
   * @param {object} config
   * @param {string} nowIso  ISO 8601 timestamp to stamp
   * @returns {object} new config
   */
  stampMeta(config, nowIso) {
    if (typeof nowIso !== "string" || !Number.isFinite(Date.parse(nowIso))) {
      throw new Error(`Invalid timestamp ${JSON.stringify(nowIso)} — must be a parseable ISO 8601 string`);
    }
    const out = CNBConfig.clone(config);
    if (!isPlainObject(out.meta)) out.meta = {};
    if (typeof out.meta.created !== "string" || out.meta.created.length === 0) {
      out.meta.created = nowIso;
    }
    out.meta.modified = nowIso;
    return out;
  },

  /**
   * Build everything a save needs from the current config: the stamped
   * config (which the host must adopt as its new state — see module
   * header), the pretty-printed JSON text, and the derived filename.
   * Pure apart from the clock; pass opts.now to fix the timestamp.
   * Throws on a non-object config, an underivable filename, or a bad
   * opts.now (via stampMeta/deriveFilename).
   * @param {object} config
   * @param {{now?: string}} [opts]  ISO timestamp (default: current time)
   * @returns {{config: object, json: string, filename: string}}
   */
  buildSaveFile(config, opts = {}) {
    if (!isPlainObject(config)) {
      throw new Error(`Config must be an object (got ${JSON.stringify(config)})`);
    }
    const filename = CNBConfigIO.deriveFilename(((config.meta || {}).configName));
    const stamped = CNBConfigIO.stampMeta(config, opts.now !== undefined ? opts.now : new Date().toISOString());
    return { config: stamped, json: JSON.stringify(stamped, null, 2), filename };
  },

  /**
   * Parse the text content of a config file. Throws descriptive errors on
   * non-string input, invalid JSON, and a root that is not a plain object
   * (null / array / primitive) — the UI load path catches these and leaves
   * app state untouched.
   * @param {string} text
   * @returns {object} the parsed root object (no merging yet)
   */
  parseConfigFile(text) {
    if (typeof text !== "string") {
      throw new Error(`Config file content must be a string (got ${typeof text})`);
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(`Config file is not valid JSON: ${err.message}`);
    }
    if (!isPlainObject(parsed)) {
      throw new Error(
        "Config file must contain a JSON object at the root, got " +
        (parsed === null ? "null" : Array.isArray(parsed) ? "an array" : typeof parsed));
    }
    return parsed;
  },

  /**
   * Merge a parsed config file into a ready-to-use config: deep-merge over
   * CNBConfig.createDefault() (so partial/older files gain defaults for
   * everything they omit), then replace each REPLACE_PATHS map section the
   * file provides (so open-keyed dictionaries are taken as saved, not
   * cross-bred with default entries), then CNBConfig.validate().
   * Validation does not block — the result always carries the config.
   * @param {object} parsed  root object from parseConfigFile()
   * @returns {{config: object, validation: {valid: boolean, errors: string[],
   *            warnings: string[]}, notes: string[]}}
   *          notes = load-level advisories (schema version drift)
   */
  mergeLoaded(parsed) {
    if (!isPlainObject(parsed)) {
      throw new Error("mergeLoaded expects the object returned by parseConfigFile()");
    }
    const notes = [];
    if (parsed.version === undefined) {
      notes.push(`Config file has no version field — merged over current schema ${CNBConfig.VERSION} defaults`);
    } else if (parsed.version !== CNBConfig.VERSION) {
      notes.push(
        `Config file version ${JSON.stringify(parsed.version)} differs from schema ` +
        `version ${CNBConfig.VERSION} — merged over current defaults`);
    }
    let config = CNBConfig.merge(CNBConfig.createDefault(), parsed);
    for (const pathKeys of REPLACE_PATHS) {
      const provided = getPath(parsed, pathKeys);
      // Replace only when the file provides an actual map object; a null or
      // wrong-typed value falls back to plain merge behavior (defaults kept).
      if (isPlainObject(provided)) {
        setPath(config, pathKeys, deepClone(provided));
      }
    }
    // A wrong-kinded section (an older or foreign save) is rejected here,
    // naming the field, rather than crashing the editors after adoption.
    checkKinds(CNBConfig.createDefault(), config);
    // A config saved with a palette has its colours moved onto the
    // noteheads (session 37), so it previews and exports as before.
    config = CNBConfig.paletteToRules(config);
    let validation;
    try {
      validation = CNBConfig.validate(config);
    } catch (err) {
      throw new Error(
        "Config file does not match the configuration schema (validation " +
        `could not run: ${err.message})`);
    }
    return { config, validation, notes };
  },

  /**
   * Full load pipeline: parseConfigFile + mergeLoaded. Throws (via
   * parseConfigFile) on malformed input; otherwise always returns a config
   * with its validation result and load notes.
   * @param {string} text
   * @returns {{config: object, validation: object, notes: string[]}}
   */
  loadFromText(text) {
    return CNBConfigIO.mergeLoaded(CNBConfigIO.parseConfigFile(text));
  },

  /**
   * Render the save/load panel into a container.
   *
   * Structure (styling left to the host via class hooks):
   *   div.cnb-config-io
   *   ├── div.cnb-cio-save-row     (save button + live filename preview)
   *   ├── div.cnb-cio-load-row     (file input, .json)
   *   ├── div.cnb-cio-status       (last action, e.g. "Saved as …")
   *   ├── div.cnb-cio-error        (parse/derive errors; empty when none)
   *   └── div.cnb-cio-validation   (post-load validate() + load notes)
   *
   * Module 17 does not own config state. The host supplies:
   *   - getConfig (REQUIRED): () => the current shared config. render()
   *     throws without it — there is no sensible default to guess.
   *   - onSave(stampedConfig, {filename, json}): the host MUST adopt
   *     stampedConfig as its new state so meta.created survives (module
   *     header).
   *   - onLoad(config, {validation, notes}): the host replaces its state
   *     with the merged config and re-renders its editors.
   *   - download({filename, json}): file-delivery override. Default is the
   *     browser Blob + object-URL + anchor-click download; in a DOM-less
   *     environment the default throws (pass an override in tests).
   *   - now: () => ISO string, clock override for deterministic tests.
   *
   * @param {HTMLElement} container
   * @param {{getConfig: () => object, onSave?: Function, onLoad?: Function,
   *          download?: Function, now?: () => string}} opts
   * @returns {{root: HTMLElement, save: () => object|null,
   *            loadText: (text: string) => object|null, redraw: () => void}}
   */
  render(container, opts = {}) {
    if (typeof opts.getConfig !== "function") {
      throw new Error("CNBConfigIO.render requires opts.getConfig — the host owns config state");
    }
    const doc = globalThis.document;
    const getConfig = opts.getConfig;
    const onSave = opts.onSave || (() => {});
    const onLoad = opts.onLoad || (() => {});
    const now = opts.now || (() => new Date().toISOString());
    const download = opts.download || (({ filename, json }) => {
      if (typeof Blob !== "function" || typeof URL === "undefined" ||
          typeof URL.createObjectURL !== "function") {
        throw new Error(
          "No browser download API available — pass opts.download to CNBConfigIO.render");
      }
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = doc.createElement("a");
      a.href = url;
      a.download = filename;
      doc.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    const root = doc.createElement("div");
    root.className = "cnb-config-io";

    const el = (tag, className, text) => {
      const e = doc.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };

    // Panel state shown by redraw(); config state stays with the host.
    let statusText = "";
    let errorText = "";
    let lastValidation = null;   // { validation, notes } from the last load

    /** Filename the save button will use right now, or the derive error. */
    function filenamePreview() {
      try {
        return { text: CNBConfigIO.deriveFilename(((getConfig() || {}).meta || {}).configName), ok: true };
      } catch (err) {
        return { text: err.message, ok: false };
      }
    }

    function save() {
      errorText = "";
      let built;
      try {
        built = CNBConfigIO.buildSaveFile(getConfig(), { now: now() });
        download({ filename: built.filename, json: built.json });
      } catch (err) {
        errorText = "Save failed: " + err.message;
        redraw();
        return null;
      }
      statusText = "Saved as " + built.filename;
      // Callback first, redraw second: the redraw reads getConfig(), which
      // only reflects this action once the host has adopted the new state.
      onSave(built.config, { filename: built.filename, json: built.json });
      redraw();
      return built;
    }

    function loadText(text, sourceName) {
      errorText = "";
      let result;
      try {
        result = CNBConfigIO.loadFromText(text);
      } catch (err) {
        // Malformed file: surface it, keep app state untouched, no onLoad.
        errorText = "Load failed: " + err.message;
        redraw();
        return null;
      }
      // Callback first, redraw second: the filename preview reads
      // getConfig(), so it shows the LOADED config's name only after the
      // host has adopted it. A host that cannot adopt the config throws
      // (after restoring its own state); that is a failed load, shown here.
      try {
        onLoad(result.config, { validation: result.validation, notes: result.notes });
      } catch (err) {
        errorText = "Load failed: " + err.message;
        redraw();
        return null;
      }
      lastValidation = { validation: result.validation, notes: result.notes };
      statusText = "Loaded" + (sourceName ? " " + sourceName : "") +
        " — " + (((result.config.meta || {}).configName) || "(unnamed config)");
      redraw();
      return result;
    }

    function drawSaveRow() {
      const row = el("div", "cnb-cio-save-row");
      const btn = el("button", "cnb-cio-save", "Save config (JSON)");
      btn.type = "button";
      btn.onclick = () => save();
      row.appendChild(btn);
      const preview = filenamePreview();
      row.appendChild(el("span",
        "cnb-cio-filename" + (preview.ok ? "" : " cnb-cio-filename-error"),
        preview.ok ? preview.text : "no filename — " + preview.text));
      return row;
    }

    function drawLoadRow() {
      const row = el("div", "cnb-cio-load-row");
      row.appendChild(el("span", "cnb-cio-load-label", "Load config (JSON)"));
      const input = el("input", "cnb-cio-file");
      input.type = "file";
      input.setAttribute("accept", ".json,application/json");
      input.onchange = (e) => {
        const file = e && e.target && e.target.files && e.target.files[0];
        if (!file) return;
        file.text().then(
          (text) => loadText(text, file.name),
          (err) => { errorText = "Load failed: could not read file — " + err.message; redraw(); }
        );
      };
      row.appendChild(input);
      return row;
    }

    function drawValidation() {
      const wrap = el("div", "cnb-cio-validation");
      if (!lastValidation) return wrap;
      const { validation, notes } = lastValidation;
      for (const note of notes) {
        wrap.appendChild(el("div", "cnb-cio-note", note));
      }
      if (validation.valid) {
        wrap.appendChild(el("div", "cnb-cio-valid", "Loaded config valid ✓"));
      }
      for (const msg of validation.errors) {
        wrap.appendChild(el("div", "cnb-cio-verror", msg));
      }
      for (const msg of validation.warnings) {
        wrap.appendChild(el("div", "cnb-cio-vwarning", msg));
      }
      return wrap;
    }

    function redraw() {
      root.textContent = "";   // clears children on real DOM and on the test stub
      root.appendChild(drawSaveRow());
      root.appendChild(drawLoadRow());
      root.appendChild(el("div", "cnb-cio-status", statusText));
      root.appendChild(el("div", "cnb-cio-error", errorText));
      root.appendChild(drawValidation());
    }

    redraw();
    container.appendChild(root);

    return { root, save, loadText, redraw };
  },
};
