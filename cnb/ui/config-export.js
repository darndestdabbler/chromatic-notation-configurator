/**
 * config-export.js — Module 18: Config Export (LilyPond)
 *
 * Wraps Module 11 (CNBLilypond.generate) behind a UI export button: run
 * CNBConfig.validate() FIRST (surfacing blocking errors per LY spec §8
 * before attempting export), then CNBLilypond.generate(config), then
 * trigger a .ly file download. The .ly export is a one-way artifact (LY
 * spec §1) — exporting does NOT stamp meta.created/meta.modified; those are
 * save-time concerns owned by Module 17.
 *
 * Scope decisions for this build (session-set 006, session 2):
 *   - Filename derivation (spec step 1: "named per meta.fileSuffix /
 *     meta.configName") uses BOTH fields with a documented precedence:
 *     meta.fileSuffix is preferred when it derives a non-empty slug — it is
 *     the config field whose entire purpose is naming exported LilyPond
 *     output (LY spec B3, cnb:file-suffix) — and meta.configName is the
 *     documented fallback when fileSuffix is absent, empty, non-string, or
 *     slugs to nothing. The slug rule is IDENTICAL to Module 17's
 *     (lowercase, every run outside [a-z0-9] becomes one hyphen, edges
 *     trimmed), so "-Default48" → "default48.ly" and a fallback on the
 *     default config would give "default-4-8-system.ly". When NEITHER field
 *     derives a slug, deriveFilename() THROWS — inventing a filename would
 *     be a silent guess. deriveFilename() does not re-check the
 *     leading-hyphen rule for fileSuffix; CNBConfig.validate() owns that
 *     check (LY spec §8 check 6) and a violation blocks export anyway.
 *   - validateForExport() answers one question — "can this config export
 *     right now, and if not why" — by combining three blocking sources:
 *     (1) CNBConfig.validate() errors (LY spec §8), (2) the exporter-side
 *     path-data check that CNBLilypond.generate() also enforces (every
 *     shape the resolved rules reference must carry lilypondPath or svgPath
 *     to emit in Section A — mirrored here through the public
 *     CNBConfig.resolveNotehead API so the block is explained BEFORE
 *     generate() would throw), and (3) filename derivability. Warnings pass
 *     through from CNBConfig.validate() and never block (spec step 3:
 *     "blocked on errors, proceeds with warnings").
 *   - buildExport() returns a blocked result ({ok:false, validation, ...})
 *     instead of throwing for validation failures — an unexportable config
 *     is user state to surface, not a caller bug. It still THROWS on a
 *     non-object config (caller bug), and it lets an unexpected
 *     CNBLilypond.generate() throw propagate: after a clean
 *     validateForExport() such a throw indicates a defect, and render()'s
 *     export path catches it into the error area so the UI never crashes.
 *   - On success, buildExport().ly is EXACTLY the string a direct
 *     CNBLilypond.generate(config) call returns (spec step 3's UAT check) —
 *     Module 18 adds no wrapping or post-processing.
 *
 * Editor-side contract (same rendering rules as Modules 12–17): render()
 * builds plain DOM via document.createElement, wires events as element
 * properties (onclick) so the whole UI is exercisable in Node against a
 * stub document, and leaves all layout/styling to the host via the
 * .cnb-cex-* class hooks. Module 18 does not own config state — the host
 * does ("the UI shell owns state") — so render() takes a `getConfig`
 * accessor plus an onExport callback instead of a config seed.
 *
 * Session 26 (the Export section, design §1 step 6, §8.6): with
 * opts.onMeta the panel also edits the notation's name, file suffix,
 * label and footnote (META_FIELDS), handing the new meta to the host,
 * and it names the preview-only settings once (PREVIEW_ONLY_SENTENCE).
 *
 * Dependencies: Module A (config), Module 11 (LilyPond exporter).
 */

import { CNBConfig } from "../src/cnb-config.js";
import { CNBLilypond } from "../src/cnb-lilypond.js";

const LY_EXTENSION = ".ly";

/**
 * Every setting the export leaves out, in one sentence (design §8.6). It
 * follows the exporter's header comment (LY spec 1.3.3 §5.2a) and adds the
 * clef and the key signature's look, which the exporter emits nothing for
 * (architecture plan §4.9, §4.12), and off-key marks, which neither the
 * preview nor the export draws yet (session 29).
 */
const PREVIEW_ONLY_SENTENCE =
  "Preview only: the look of the staff lines, the ledger lines, the clef, " +
  "the key signature's placement, bar and spacing, stem thickness, repeat " +
  "counts, the colour-blind preview switch and rules for a particular key " +
  "show here but are not exported, because LilyPond draws those its own way; " +
  "off-key marks are kept in the file but neither drawn here nor exported yet.";

/** The meta fields the Export section edits, with their designer wording. */
const META_FIELDS = [
  { key: "configName", label: "Name",
    hint: "Shown at the top of the page, and the name of the saved file." },
  { key: "fileSuffix", label: "File suffix",
    hint: "Names the exported file, and a score can add it to the files it writes. It starts with a hyphen." },
  { key: "notationLabel", label: "Notation label",
    hint: "A score can print it with the music." },
  { key: "notationFootnote", label: "Footnote",
    hint: "A score can print it as a footnote to the label. Left empty, it is not exported." },
];

// ─── Pure helpers ────────────────────────────────────────────────────────────

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Module 17's slug rule, verbatim: the two modules must name files alike. */
function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Duration names defined in the config (same fallback as Module 11). */
function durationNames(config) {
  const defs = ((config.durations || {}).definitions) || [];
  const names = defs.map(d => d.name).filter(Boolean);
  return names.length > 0 ? names : ["crotchet"];
}

/**
 * Shape names the resolved notehead rules actually reference, restricted to
 * shapes that exist in config.shapes — the same set Module 11's Section A
 * emits and its generate() precondition checks. The resolution context is
 * (pc, duration, key=null), matching Module 11's resolveAll()/usedShapes()
 * exactly: key-scoped rules (match.keys other than "all") do not match a
 * null key in EITHER module, so a shape reachable only under a specific key
 * is outside both used-shape sets — generate() cannot throw for a shape
 * this function did not consider. Pinned by the unit test "key-scoped
 * rules: validateForExport and generate() agree". Resolution failures are
 * skipped (CNBConfig.validate() already reports rule-coverage errors).
 */
function usedShapeNames(config) {
  const shapes = config.shapes || {};
  const used = new Set();
  for (const duration of durationNames(config)) {
    for (let pc = 0; pc < 12; pc++) {
      try {
        const r = CNBConfig.resolveNotehead(config, pc, duration, null);
        if (r.shape in shapes) used.add(r.shape);
      } catch (_) {
        // covered by validate() errors
      }
    }
  }
  return [...used].sort();
}

export const CNBConfigExport = {

  LY_EXTENSION,
  PREVIEW_ONLY_SENTENCE,
  META_FIELDS,

  /**
   * Derive the .ly download filename from config.meta (spec step 1: "named
   * per meta.fileSuffix/meta.configName"). Precedence rule (module header):
   * fileSuffix's slug when non-empty ("-Default48" → "default48.ly"), else
   * configName's slug ("Default 4-8 System" → "default-4-8-system.ly").
   * Slug rule identical to Module 17. Throws when meta is not an object or
   * when neither field derives a non-empty slug — set meta.fileSuffix or
   * meta.configName before exporting.
   * @param {object} meta  the config.meta object
   * @returns {string}
   */
  deriveFilename(meta) {
    if (!isPlainObject(meta)) {
      throw new Error(`config.meta must be an object (got ${JSON.stringify(meta)})`);
    }
    if (typeof meta.fileSuffix === "string" && meta.fileSuffix.length > 0) {
      const stem = slugify(meta.fileSuffix);
      if (stem.length > 0) return stem + LY_EXTENSION;
    }
    if (typeof meta.configName === "string") {
      const stem = slugify(meta.configName);
      if (stem.length > 0) return stem + LY_EXTENSION;
    }
    throw new Error(
      "Cannot derive a .ly filename: neither meta.fileSuffix " +
      `(${JSON.stringify(meta.fileSuffix)}) nor meta.configName ` +
      `(${JSON.stringify(meta.configName)}) contains letters or digits. ` +
      "Set one of them before exporting.");
  },

  /**
   * Full pre-export validation: CNBConfig.validate() errors and warnings
   * (LY spec §8), plus the exporter-side path-data check that
   * CNBLilypond.generate() enforces (every used shape needs lilypondPath or
   * svgPath), plus filename derivability. Errors block export; warnings
   * never do. Throws on a non-object config (caller bug).
   * @param {object} config
   * @returns {{valid: boolean, errors: string[], warnings: string[]}}
   */
  validateForExport(config) {
    if (!isPlainObject(config)) {
      throw new Error(`Config must be an object (got ${JSON.stringify(config)})`);
    }
    const base = CNBConfig.validate(config);
    const errors = base.errors.slice();
    const warnings = base.warnings.slice();

    // Exporter-side check mirrored from CNBLilypond.generate() (LY spec §8
    // check 1): surface the block here so the UI can explain it instead of
    // letting generate() throw.
    const shapes = config.shapes || {};
    for (const name of usedShapeNames(config)) {
      const shape = shapes[name];
      if (!shape.lilypondPath && !shape.svgPath) {
        errors.push(`Shape "${name}" has no path data (lilypondPath or svgPath)`);
      }
    }

    // Filename derivability: an export that cannot name its file is blocked.
    try {
      CNBConfigExport.deriveFilename(isPlainObject(config.meta) ? config.meta : {});
    } catch (err) {
      errors.push(err.message);
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  /**
   * The validate-then-export flow (spec step 1). Returns:
   *   - blocked:  { ok: false, validation, ly: null, filename: null }
   *     when validateForExport() finds errors — no throw; the errors are
   *     user state for the UI to surface.
   *   - success:  { ok: true, validation, ly, filename }
   *     where ly === CNBLilypond.generate(config) verbatim and filename
   *     comes from deriveFilename(config.meta).
   * Throws on a non-object config. Does not mutate the input config and
   * does not stamp meta timestamps (module header).
   * @param {object} config
   * @returns {{ok: boolean, validation: object, ly: string|null,
   *            filename: string|null}}
   */
  buildExport(config) {
    const validation = CNBConfigExport.validateForExport(config);
    if (!validation.valid) {
      return { ok: false, validation, ly: null, filename: null };
    }
    return {
      ok: true,
      validation,
      ly: CNBLilypond.generate(config),
      filename: CNBConfigExport.deriveFilename(config.meta),
    };
  },

  /**
   * Render the export panel into a container.
   *
   * Structure (styling left to the host via class hooks):
   *   div.cnb-config-export
   *   ├── div.cnb-cex-meta           (only with onMeta: name, file suffix,
   *   │                               label, footnote; kept across redraws)
   *   ├── p.cnb-cex-preview-only     (PREVIEW_ONLY_SENTENCE)
   *   └── div.cnb-cex-body           (redrawn)
   *       ├── div.cnb-cex-export-row (export button + live filename preview)
   *       ├── div.cnb-cex-status     ("Exported as …" / "Export blocked — …")
   *       ├── div.cnb-cex-error      (unexpected failures only; empty when none)
   *       └── div.cnb-cex-validation (errors/warnings/valid badge from the
   *                                   last export attempt)
   *
   * The status line distinguishes a BLOCKED export (validation errors,
   * shown in .cnb-cex-verror rows — spec step 2: the user sees WHY export
   * is blocked) from an unexpected failure (.cnb-cex-error, e.g. the
   * download delivery throwing). Warnings render as .cnb-cex-vwarning on
   * both blocked and successful attempts.
   *
   * Module 18 does not own config state. The host supplies:
   *   - getConfig (REQUIRED): () => the current shared config. render()
   *     throws without it — there is no sensible default to guess.
   *   - onExport(ly, {filename, validation}): called after a successful
   *     delivery, BEFORE the panel redraw (Modules 12–17 callback-order
   *     contract), with the exact generated .ly text.
   *   - download({filename, ly}): file-delivery override. Default is the
   *     browser Blob + object-URL + anchor-click download (text/plain, as
   *     the legacy exporter used for .ly); in a DOM-less environment the
   *     default throws (pass an override in tests).
   *   - onMeta(meta) (session 26): when given, the panel draws the
   *     META_FIELDS and calls it with a copy of getConfig().meta carrying
   *     the edited field, on every keystroke; the host stores it and
   *     redraws. Without it the panel edits nothing.
   *
   * @param {HTMLElement} container
   * @param {{getConfig: () => object, onExport?: Function,
   *          download?: Function, onMeta?: (meta: object) => void}} opts
   * @returns {{root: HTMLElement, exportLy: () => object|null,
   *            redraw: () => void}}
   */
  render(container, opts = {}) {
    if (typeof opts.getConfig !== "function") {
      throw new Error("CNBConfigExport.render requires opts.getConfig — the host owns config state");
    }
    const doc = globalThis.document;
    const getConfig = opts.getConfig;
    const onExport = opts.onExport || (() => {});
    const download = opts.download || (({ filename, ly }) => {
      if (typeof Blob !== "function" || typeof URL === "undefined" ||
          typeof URL.createObjectURL !== "function") {
        throw new Error(
          "No browser download API available — pass opts.download to CNBConfigExport.render");
      }
      const url = URL.createObjectURL(new Blob([ly], { type: "text/plain" }));
      const a = doc.createElement("a");
      a.href = url;
      a.download = filename;
      doc.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    const onMeta = typeof opts.onMeta === "function" ? opts.onMeta : null;

    const root = doc.createElement("div");
    root.className = "cnb-config-export";

    const el = (tag, className, text) => {
      const e = doc.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };

    const metaOf = () => {
      const cfg = getConfig() || {};
      return isPlainObject(cfg.meta) ? cfg.meta : {};
    };

    // ── Meta fields (session 26): built once and kept, so an input keeps
    // its focus while the host redraws the panel after each keystroke;
    // redraw() only refreshes a value that the config changed elsewhere.
    const metaInputs = {};
    let metaBlock = null;
    if (onMeta) {
      metaBlock = el("div", "cnb-cex-meta");
      for (const f of META_FIELDS) {
        const row = el("label", "cnb-cex-meta-field");
        row.setAttribute("data-meta", f.key);
        row.appendChild(el("span", "cnb-cex-meta-label", f.label));
        const input = el("input", "cnb-cex-meta-input");
        input.type = "text";
        input.oninput = (e) => {
          const value = String((e && e.target && e.target.value !== undefined) ? e.target.value : input.value);
          onMeta({ ...metaOf(), [f.key]: value });
        };
        metaInputs[f.key] = input;
        row.appendChild(input);
        row.appendChild(el("span", "cnb-cex-meta-hint", f.hint));
        metaBlock.appendChild(row);
      }
      root.appendChild(metaBlock);
    }
    root.appendChild(el("p", "cnb-cex-preview-only", PREVIEW_ONLY_SENTENCE));
    const body = el("div", "cnb-cex-body");
    root.appendChild(body);

    // Panel state shown by redraw(); config state stays with the host.
    let statusText = "";
    let statusBlocked = false;   // adds .cnb-cex-status-blocked so hosts can
                                 // style the blocked message distinctly
    let errorText = "";
    let lastValidation = null;   // validation from the last export attempt

    /** Filename the export button will use right now, or the derive error. */
    function filenamePreview() {
      try {
        const cfg = getConfig() || {};
        return { text: CNBConfigExport.deriveFilename(isPlainObject(cfg.meta) ? cfg.meta : {}), ok: true };
      } catch (err) {
        return { text: err.message, ok: false };
      }
    }

    function exportLy() {
      errorText = "";
      let result;
      try {
        result = CNBConfigExport.buildExport(getConfig());
      } catch (err) {
        // Caller bug or unexpected generate() defect — surface, don't crash.
        errorText = "Export failed: " + err.message;
        redraw();
        return null;
      }
      lastValidation = result.validation;
      if (!result.ok) {
        // Blocked by validation: not an unexpected failure — the validation
        // area explains why (spec step 2). No download, no onExport.
        statusText = "Export blocked — fix " + result.validation.errors.length +
          " error" + (result.validation.errors.length === 1 ? "" : "s") + " below";
        statusBlocked = true;
        redraw();
        return null;
      }
      try {
        download({ filename: result.filename, ly: result.ly });
      } catch (err) {
        errorText = "Export failed: " + err.message;
        redraw();
        return null;
      }
      statusText = "Exported as " + result.filename;
      statusBlocked = false;
      // Callback first, redraw second (Modules 12–17 contract).
      onExport(result.ly, { filename: result.filename, validation: result.validation });
      redraw();
      return result;
    }

    function drawExportRow() {
      const row = el("div", "cnb-cex-export-row");
      const btn = el("button", "cnb-cex-export", "Export for LilyPond");
      btn.type = "button";
      btn.onclick = () => exportLy();
      row.appendChild(btn);
      const preview = filenamePreview();
      if (preview.ok) row.appendChild(el("span", "cnb-cex-filename-label", "The file is named"));
      row.appendChild(el("span",
        "cnb-cex-filename" + (preview.ok ? "" : " cnb-cex-filename-error"),
        preview.ok ? preview.text : "No file name: " + preview.text));
      return row;
    }

    function drawValidation() {
      const wrap = el("div", "cnb-cex-validation");
      if (!lastValidation) return wrap;
      if (lastValidation.valid) {
        wrap.appendChild(el("div", "cnb-cex-valid", "Config valid ✓"));
      }
      for (const msg of lastValidation.errors) {
        wrap.appendChild(el("div", "cnb-cex-verror", msg));
      }
      for (const msg of lastValidation.warnings) {
        wrap.appendChild(el("div", "cnb-cex-vwarning", msg));
      }
      return wrap;
    }

    function redraw() {
      const meta = metaOf();
      for (const [key, input] of Object.entries(metaInputs)) {
        const value = typeof meta[key] === "string" ? meta[key] : "";
        if (input.value !== value) input.value = value;
      }
      body.textContent = "";   // clears children on real DOM and on the test stub
      body.appendChild(drawExportRow());
      body.appendChild(el("div",
        "cnb-cex-status" + (statusBlocked ? " cnb-cex-status-blocked" : ""), statusText));
      body.appendChild(el("div", "cnb-cex-error", errorText));
      body.appendChild(drawValidation());
    }

    redraw();
    container.appendChild(root);

    return { root, exportLy, redraw };
  },
};
