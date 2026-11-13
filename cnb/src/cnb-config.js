/**
 * cnb-config.js — Module A: Config Schema
 *
 * Canonical JSON config structure with defaults, validation, deep merge,
 * clone, notehead rule resolution, and color resolution.
 *
 * Dependencies: cnb-scheme.js (the exporter's emitter predicates, so
 * validation rejects exactly what export would refuse).
 *
 * Part of the Chromatic Notation Builder modular architecture.
 */

import { CNBScheme } from "./cnb-scheme.js";

// ─── Default 4-8 configuration (Architecture Plan Appendix A) ───────────────

function buildDefault() {
  return {
    version: "1.0",

    shapes: {
      "crotchet-minim": {
        displayName: "Crotchet–Minim",

        // SVG data (for preview rendering)
        svgPath: "M 163.578 -81.573 C 193.612 -21.336 144.71 64.016 54.355 109.065 C -35.998 154.113 -133.593 141.801 -163.627 81.565 C -178.047 52.639 -174.644 16.303 -154.159 -19.448 C -133.677 -55.199 -97.792 -87.438 -54.403 -109.072 C -11.013 -130.706 36.328 -139.962 77.208 -134.804 C 118.089 -129.647 149.155 -110.499 163.578 -81.573 Z",
        svgHollowPath: "M 136.312 -67.977 C 155.421 -32.322 90.412 17.577 24.737 50.184 C -40.937 82.792 -116.568 105.433 -136.359 67.971 C -156.151 30.509 -95.666 -15.128 -24.935 -50.371 C 45.798 -85.615 117.202 -103.633 136.312 -67.977 Z",
        naturalHeight: 272.4,
        naturalWidth: 344.852,
        semitoneHeight: 2.724,

        // 4-point stem anchor model (in native SVG units): each is the
        // stem's centre (session 40). On the default staff, 4 semitones per
        // staff space, half the engine's 0.13-staff-space stem is 26 units,
        // so the up stem's right edge is on the path's right extent
        // (172.426) and the down stem's left edge on its left (−172.4267).
        anchors: {
          crotchetUp:   { x: 146.426,   y: -42.9985 },
          crotchetDown: { x: -146.4267, y:  43.0027 },
          minimUp:      { x: 146.426,   y: -42.9985 },
          minimDown:    { x: -146.4267, y:  43.0027 },
        },

        // LilyPond data (for export — null = fallback conversion at export time)
        lilypondPath: null,
        lilypondHollowPath: null,
        lilypondAnchors: null,
      },
    },

    staff: {
      semitonePattern: [4, 8],
      midpoint: 12,
      semitonesPerStaffSpace: 4,
    },

    ledgers: {
      templates: [
        { semiWithinOctave: 0,  triggerPCs: [0, 1, 2], triggerMode: "override" },
        { semiWithinOctave: 2,  triggerPCs: [2],        triggerMode: "override" },
        { semiWithinOctave: 10, triggerPCs: [10],       triggerMode: "override" },
      ],
      proximityRule: true,
    },

    noteheadRules: [
      {
        name: "Default",
        priority: 0,
        match: { pitchClasses: "all", durations: "all", keys: "all" },
        apply: { shape: "crotchet-minim", hollow: false, color: null, offKeyMark: false },
      },
      {
        name: "Sharps are hollow",
        priority: 1,
        match: { pitchClasses: [1, 3, 6, 8, 10], durations: "all", keys: "all" },
        apply: { hollow: true },
      },
    ],

    display: {
      pxPerSemi: 16,
      label: {
        fontFamily: "Oswald",
        fontSize: 22,
        fontWeight: 400,
        color: "#555555",
        marginTop: 14,
        marginBottom: 14,
        padding: 6,
        sharpStyle: { fontSize: 0.75, raise: -0.15 },
      },
      column: { paddingH: 16 },
      card: {
        background: "#FFFFFF",
        borderRadius: 6,
        shadow: "0 2px 12px rgba(0,0,0,0.12)",
      },
      debugGrid: false,
    },

    durations: {
      definitions: [
        { name: "crotchet",  displayName: "Crotchet (Quarter)",   lilypondDuration: 3, defaultShape: "crotchet-minim", defaultHollow: false, hasStem: true  },
        { name: "minim",     displayName: "Minim (Half)",         lilypondDuration: 2, defaultShape: "crotchet-minim", defaultHollow: true,  hasStem: true  },
        { name: "semibreve", displayName: "Semibreve (Whole)",    lilypondDuration: 1, defaultShape: "semibreve",      defaultHollow: false, hasStem: false },
        { name: "breve",     displayName: "Breve (Double Whole)", lilypondDuration: 0, defaultShape: "breve",          defaultHollow: false, hasStem: false },
      ],
      representationMode: "shape",
      // In repeat mode, how much of a head's width each copy overlaps the
      // last (session 58): 0 or more and below 1, each copy starting
      // (1 − repeatOverlap) head widths after the last. It replaces
      // engine.multinotePadding (staff spaces), which is retired: a config
      // that carries it still loads, and it is not read.
      repeatOverlap: 1 / 3,
    },

    keys: {
      enabled: false,
      definitions: [],
      offKeyMark: {},

      // Key signature (set 010). Default-off: with enabled:false the preview
      // and the LilyPond export are byte-identical to the pre-set-010 output.
      // The defaults mirror the engine's keysig.ly: the key's scale rendered
      // as real noteheads — 7 degrees ascending from the tonic plus the
      // octave tonic, interleaved into two columns (two stacked 7th chords) —
      // with a gold separator stem through the middle (engine cnb:gold
      // #ffd42a). Since session 54 (key-signature design §13) one model draws
      // every signature: `style` is retired, and a saved one is converted on
      // load (CNBConfig.signatureStyleToModel); the traditional signature is
      // the sharps or flats only (notes "altered"), Emmentaler's signs as the
      // flats' and sharps' looks, and the cycle of fifths.
      //
      // placement is the explicit placement-rule surface (binding rule 2;
      // session 2's placement-rule controls edit it): rule names how the
      // key's pitch classes map to grid positions — "scale-from-tonic"
      // (the s1 decision D1: full pitch-class set ascending from the tonic
      // plus the octave tonic, per keysig.ly) is the vocabulary's only
      // implemented value; future rules (e.g. a tonic-label mode, catalog
      // record 42) extend it. tonicOctave null = auto (center the octave
      // span on staff.midpoint; ties resolve upward, so a C tonic with
      // midpoint 12 sits at semitone 12, matching the engine's middle-C
      // anchor for the default config); an explicit integer overrides.
      //
      // The separator is the engine's gold STEM: keysig.ly draws it
      // through the horizontal middle of the two notehead columns
      // (bar x = max-notehead-x-offset − width/2), beneath the noteheads,
      // 0.4 staff-space thick (measured from engine SVG renders at sps 3
      // and sps 4 during set-010 s2 UAT; the file's "at the right edge"
      // comment does not match its own computed x). thicknessPct stays in
      // semitone units like every other thickness: 160% of a semitone =
      // 0.4 staff-space at the default staff's 4 semitones per space.
      // dot.radiusPct 60 (diameter 1.2 semitones) per the s2 UAT operator
      // feedback that 30 rendered "really small".
      //
      // The designer's settings (session 48, key-signature design §6) each
      // default to the signature above, so a config saved before them draws
      // as it did: notes "all" (or "tonic-and-half-steps"), upperTonic;
      // looks.all, .flat, .sharp (shape, hollow, color, heightSemis,
      // widthSemis, each unset = the look beneath: the notehead's own, then
      // all marks, then flats or sharps); stacking "degrees" (or "parity",
      // "parity-stacks", "parity-zigzag"); alternate, the look of every second
      // stack (shape, hollow, color); columns "right" (or
      // "left-in-sharp-keys"); placement.position "middle" (or "bottom-set",
      // "top-set", "every-set"); separator.shareThickness, several stems
      // sharing thicknessPct.
      //
      // The model (session 54, design §13.9): notes also "altered" (the
      // sharps or flats only); looks.natural, .line and .space beside all,
      // flat and sharp, laid in the order all, natural/flat/sharp, line or
      // space, alternate; a look's sign ("sharp" | "flat", one slot with
      // shape), offset { x, y } in semitones and added (at most two symbols
      // { shape, heightSemis, widthSemis, offset }), offset and added each
      // replaced whole by a layer that sets it; stacking also "fifths" (the
      // cycle of fifths, one mark to a column), whose heights are "window"
      // (an octave around the line set's middle, raised by window.sharp or
      // window.flat semitones) or "scale" (each at its note in the scale from
      // the tonic). A shape may carry reference { x, y } and ledgers (false =
      // none), read by the key signature only.
      //
      // signs.heightSemis (session 52): the sharp's height from the top left
      // of its upper bar to the top left of its lower bar, in semitones (axis
      // units under a pitch axis); the flat is scaled with it. null is
      // automatic: the least of the noteheads' mean height, one staff space
      // and 3 (CNBKeySignature.signHeight).
      keySignature: {
        enabled: false,
        notes: "all",
        upperTonic: true,
        looks: { all: {}, natural: {}, flat: {}, sharp: {}, line: {}, space: {} },
        stacking: "degrees",
        heights: "window",
        window: { sharp: 0, flat: 0 },
        alternate: {},
        columns: "right",
        placement: {
          rule: "scale-from-tonic",
          tonicOctave: null,
          position: "middle",
        },
        separator: {
          enabled: true,
          color: "#ffd42a",
          thicknessPct: 160,
          extentSemis: 12,
          shareThickness: true,
        },
        signs: { heightSemis: null },
      },
    },

    // Custom clef (set 009). Default-off: with enabled:false the preview and
    // the LilyPond export are byte-identical to the pre-clef output.
    // glyphs is an open-keyed map of named clef definitions; active selects
    // one by name. Each definition carries its own anchorSemi — the semitone
    // the TOP edge of the glyph sits on (floats allowed: glyph designs like
    // the traditional treble clef do not top-align to a staff unit, so the
    // anchor is not restricted to integers).
    clef: {
      enabled: false,
      active: null,
      glyphs: {},
      gutter: { paddingH: 12 },
    },

    engine: {
      lilypondVersion: "2.24.2",
      falseHollow: false,
      defaultMagnify: "7/4",
      indent: 0,
      collisionThreshold: 2,
    },

    meta: {
      configName: "Default 4-8 System",
      fileSuffix: "-Default48",
      notationLabel: "Default 4-8 System",
      notationFootnote: "",
      author: "",
      description: "Two staff lines per octave at semitones 4 (E) and 8 (G♯)",
      created: null,
      modified: null,
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Deep merge: recursively merges `partial` into `base`.
 * Arrays are replaced in full (not concatenated).
 * Objects are merged field by field. Primitives overwrite.
 * Neither argument is mutated; returns a new object.
 */
function deepMerge(base, partial) {
  if (partial === null || partial === undefined) return deepClone(base);
  if (typeof partial !== "object" || Array.isArray(partial)) return deepClone(partial);
  if (typeof base !== "object" || base === null || Array.isArray(base)) return deepClone(partial);

  const result = {};
  const allKeys = new Set([...Object.keys(base), ...Object.keys(partial)]);
  for (const key of allKeys) {
    if (!(key in partial)) {
      result[key] = deepClone(base[key]);
    } else if (!(key in base)) {
      result[key] = deepClone(partial[key]);
    } else {
      result[key] = deepMerge(base[key], partial[key]);
    }
  }
  return result;
}

function deepClone(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

/** Returns the name of the first shape in config.shapes, or null. */
function firstShapeName(config) {
  const keys = Object.keys(config.shapes || {});
  return keys.length > 0 ? keys[0] : null;
}

/** True if the rule's match block covers this (pc, duration, key). */
/**
 * The shapes some notehead uses: those resolved for any pitch class, any
 * duration definition (crotchet when there are none) and no key, or, with
 * keys on, any defined key. Resolutions that fail are skipped (other checks
 * report them).
 */
function usedShapeNames(config) {
  const isPlainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const durations = (((config.durations || {}).definitions) || []).map(d => d && d.name).filter(Boolean);
  const keysSec = isPlainObject(config.keys) ? config.keys : {};
  const keys = [null];
  if (keysSec.enabled && Array.isArray(keysSec.definitions)) {
    for (const def of keysSec.definitions) if (isPlainObject(def) && def.name) keys.push(def.name);
  }
  const used = new Set();
  for (const duration of durations.length ? durations : ["crotchet"]) {
    for (const key of keys) {
      for (let pc = 0; pc < 12; pc++) {
        try {
          used.add(CNBConfig.resolveNotehead(config, pc, duration, key).shape);
        } catch (_) { /* reported elsewhere */ }
      }
    }
  }
  return used;
}

function ruleMatches(rule, pc, duration, key) {
  const m = rule.match;
  const pcMatch  = m.pitchClasses === "all" || (Array.isArray(m.pitchClasses) && m.pitchClasses.includes(pc));
  const durMatch = m.durations    === "all" || (Array.isArray(m.durations)    && m.durations.includes(duration));
  const keyMatch = m.keys         === "all" || (Array.isArray(m.keys)         && m.keys.includes(key));
  return pcMatch && durMatch && keyMatch;
}

/** Returns true if str is a valid #RRGGBB hex color (case-insensitive). */
function isValidHex(str) {
  return typeof str === "string" && /^#[0-9A-Fa-f]{6}$/.test(str);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const CNBConfig = {

  VERSION: "1.0",

  /**
   * Create a complete config with all defaults (the 4-8 system).
   * Each call returns a fresh, independent copy.
   * @returns {object}
   */
  createDefault() {
    return buildDefault();
  },

  /**
   * Validate a config. Returns errors (blocking) and warnings (non-blocking).
   * Implements validation rules from LY Spec §8.
   * @param {object} config
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validate(config) {
    const errors   = [];
    const warnings = [];

    const shapes = config.shapes || {};
    const rules  = config.noteheadRules || [];

    // ── Errors ───────────────────────────────────────────────────────────

    // 1. Shape names in rules must exist in config.shapes
    for (const rule of rules) {
      if (rule.apply && rule.apply.shape !== undefined) {
        if (!(rule.apply.shape in shapes)) {
          errors.push(`Rule "${rule.name || "(unnamed)"}" references unknown shape "${rule.apply.shape}"`);
        }
      }
    }

    // 1a. A shape's reference point and ledgers (session 54, key-signature
    //     design §13.3), read by the key signature only: reference two
    //     finite numbers in native SVG units, ledgers a boolean.
    for (const [name, shape] of Object.entries(shapes)) {
      if (!shape || typeof shape !== "object") continue;
      const ref = shape.reference;
      if (ref !== undefined && ref !== null &&
          (typeof ref !== "object" || !Number.isFinite(ref.x) || !Number.isFinite(ref.y))) {
        errors.push(`Shape "${name}" reference must be { x, y }, two finite numbers (got ${JSON.stringify(ref)})`);
      }
      if (shape.ledgers !== undefined && typeof shape.ledgers !== "boolean") {
        errors.push(`Shape "${name}" ledgers must be true or false (got ${JSON.stringify(shape.ledgers)})`);
      }
    }

    // 2. Shapes referenced with hollow:true must have svgHollowPath
    //    (check rules that explicitly set hollow:true and reference a real shape)
    // We do this through resolution: for each PC, if resolved hollow=true check svgHollowPath.
    // But error 2 from the spec is about *rule-level* references, so check shapes directly:
    // Any shape that exists and is used in a hollow context must have a hollow path.
    // We'll check this at resolution time below (warning 2), but also flag here if a rule
    // sets hollow:true AND an apply.shape that has no hollow path. Only flag if both are in
    // the same rule (direct reference).
    for (const rule of rules) {
      if (rule.apply && rule.apply.hollow === true && rule.apply.shape !== undefined) {
        const shape = shapes[rule.apply.shape];
        if (shape && !shape.svgHollowPath) {
          errors.push(`Rule "${rule.name || "(unnamed)"}" sets hollow:true on shape "${rule.apply.shape}" which has no svgHollowPath`);
        }
      }
    }

    // 3. Explicit color hex values in rules must be valid. A notehead's
    //    colour lives only on its rules (session 37): null is none, black.
    for (const rule of rules) {
      if (rule.apply && rule.apply.color !== null && rule.apply.color !== undefined) {
        if (!isValidHex(rule.apply.color)) {
          errors.push(`Rule "${rule.name || "(unnamed)"}" has invalid color hex "${rule.apply.color}"`);
        }
      }
    }
    // 3a. Notehead size (session 22): apply.heightSemis / apply.widthSemis,
    //     absolute sizes in semitones, must be finite and positive; outside
    //     0.25–4 semitones they warn (allowed, but unlikely to look right).
    for (const rule of rules) {
      if (!rule || !rule.apply || typeof rule.apply !== "object") continue;
      for (const field of ["heightSemis", "widthSemis"]) {
        const v = rule.apply[field];
        if (v === undefined) continue;
        if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
          errors.push(`Rule "${rule.name || "(unnamed)"}" apply.${field} must be a finite number greater than 0 (got ${JSON.stringify(v)})`);
        } else if (v < 0.25 || v > 4) {
          warnings.push(`Rule "${rule.name || "(unnamed)"}" apply.${field} is ${v} semitones, outside the usual 0.25–4`);
        }
      }
    }

    // 4. All 12 PCs must be covered by at least one rule
    const coveredPCs = new Set();
    for (let pc = 0; pc < 12; pc++) {
      for (const rule of rules) {
        const m = rule.match || {};
        if (m.pitchClasses === "all" || (Array.isArray(m.pitchClasses) && m.pitchClasses.includes(pc))) {
          coveredPCs.add(pc);
          break;
        }
      }
    }
    for (let pc = 0; pc < 12; pc++) {
      if (!coveredPCs.has(pc)) {
        errors.push(`Pitch class ${pc} is not covered by any notehead rule`);
      }
    }

    // 5. At least 2 staff lines
    const staffPattern = (config.staff || {}).semitonePattern || [];
    if (staffPattern.length < 2) {
      errors.push(`Staff pattern must have at least 2 semitone positions (found ${staffPattern.length})`);
    }

    // 6. fileSuffix must start with hyphen if non-empty
    const fileSuffix = ((config.meta || {}).fileSuffix) || "";
    if (fileSuffix.length > 0 && !fileSuffix.startsWith("-")) {
      errors.push(`meta.fileSuffix must begin with "-" (got "${fileSuffix}")`);
    }

    // 7. All color hex values match #RRGGBB — covered in check 3 above for
    //    rules. Staff and ledger lines have no colour: the preview
    //    draws them as the engine does, black (session 34).

    // 8. Clef checks (set 009) — only when the clef is enabled, so configs
    //    predating the clef section (and default-off configs) validate
    //    exactly as before. Malformed sections report errors rather than
    //    throwing: validate() must always return a result object.
    const isPlainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
    const clef = isPlainObject(config.clef) ? config.clef : {};
    if (clef.enabled) {
      const glyphsOk = clef.glyphs === undefined || isPlainObject(clef.glyphs);
      if (!glyphsOk) {
        errors.push("clef.glyphs must be an object map of clef definitions");
      }
      const glyphs = glyphsOk && clef.glyphs ? clef.glyphs : {};
      const gutter = clef.gutter;
      if (gutter !== undefined && gutter !== null) {
        if (!isPlainObject(gutter)) {
          errors.push("clef.gutter must be an object");
        } else if (gutter.paddingH !== undefined && gutter.paddingH !== null &&
                   (typeof gutter.paddingH !== "number" || !Number.isFinite(gutter.paddingH) || gutter.paddingH < 0)) {
          errors.push(`clef.gutter.paddingH must be a finite non-negative number (got ${JSON.stringify(gutter.paddingH)})`);
        }
      }
      if (!clef.active || typeof clef.active !== "string") {
        errors.push("clef.enabled is true but clef.active names no glyph");
      } else if (!(clef.active in glyphs)) {
        errors.push(`clef.active references unknown clef glyph "${clef.active}"`);
      } else if (!isPlainObject(glyphs[clef.active])) {
        errors.push(`Clef glyph "${clef.active}" is not an object`);
      } else {
        const def = glyphs[clef.active];
        const kind = def.kind || "glyph";
        if (kind === "glyph") {
          if (!def.svgPath) {
            errors.push(`Clef glyph "${clef.active}" has no svgPath`);
          }
          if (!(def.naturalHeight > 0) || !(def.naturalWidth > 0) || !(def.semitoneHeight > 0)) {
            errors.push(`Clef glyph "${clef.active}" is missing positive natural dimensions / semitoneHeight`);
          }
        } else if (kind === "text") {
          if (typeof def.text !== "string" || def.text.length === 0) {
            errors.push(`Clef text entry "${clef.active}" has no text`);
          }
          if (!(def.textHeightSemis > 0)) {
            errors.push(`Clef text entry "${clef.active}" needs a positive textHeightSemis`);
          }
        } else if (kind !== "dozenal") {
          errors.push(`Clef glyph "${clef.active}" has unknown kind "${kind}" (expected "glyph", "text" or "dozenal")`);
        }
        // anchorSemi is deliberately a float: surveyed clef designs
        // (Bravura gClef top +1.392 staff-spaces above the top line,
        // Clairnote glyph tops at fractional extents) do not top-align to
        // integer grid positions. The engine's dozenal clef (session 45)
        // has no anchor: it sits on the middle line.
        if (kind === "dozenal") {
          // nothing to check: no path, size or anchor of its own
        } else if (typeof def.anchorSemi !== "number" || !Number.isFinite(def.anchorSemi)) {
          errors.push(`Clef glyph "${clef.active}" has no numeric anchorSemi`);
        } else if (def.anchorSemi < -24 || def.anchorSemi > 72) {
          warnings.push(`Clef glyph "${clef.active}" anchorSemi ${def.anchorSemi} is far outside the typical range (-24 to 72)`);
        }
      }
    }

    // 9. Key-signature checks (set 010) — only when the key signature is
    //    enabled, so configs predating the section (and default-off configs)
    //    validate exactly as before. Type-safe against malformed sections:
    //    errors are reported rather than thrown, same posture as the clef
    //    checks above.
    const keysSection = isPlainObject(config.keys) ? config.keys : {};
    const keySig = isPlainObject(keysSection.keySignature) ? keysSection.keySignature : {};
    if (keySig.enabled) {
      if (!keysSection.enabled) {
        warnings.push("keys.keySignature.enabled is true but keys.enabled is false — the key signature will not render (rendering is gated on keys.enabled per the E2 requirements entry)");
      }
      // style is retired (session 54): converted on load, and not read.
      const placement = keySig.placement;
      if (placement !== undefined && placement !== null) {
        if (!isPlainObject(placement)) {
          errors.push("keys.keySignature.placement must be an object");
        } else {
          const rule = placement.rule === undefined || placement.rule === null ? "scale-from-tonic" : placement.rule;
          if (rule !== "scale-from-tonic") {
            errors.push(`keys.keySignature.placement.rule must be "scale-from-tonic" (got ${JSON.stringify(placement.rule)}; the vocabulary extends when new placement rules are implemented)`);
          }
          if (placement.tonicOctave !== undefined && placement.tonicOctave !== null && !Number.isInteger(placement.tonicOctave)) {
            errors.push(`keys.keySignature.placement.tonicOctave must be an integer octave or null for auto (got ${JSON.stringify(placement.tonicOctave)})`);
          }
        }
      }
      const sep = keySig.separator;
      if (sep !== undefined && sep !== null) {
        if (!isPlainObject(sep)) {
          errors.push("keys.keySignature.separator must be an object");
        } else {
          if (sep.color !== undefined && sep.color !== null && !isValidHex(sep.color)) {
            errors.push(`keys.keySignature.separator.color has invalid hex "${sep.color}"`);
          }
          if (sep.thicknessPct !== undefined && sep.thicknessPct !== null &&
              (typeof sep.thicknessPct !== "number" || !Number.isFinite(sep.thicknessPct) || sep.thicknessPct < 0)) {
            errors.push(`keys.keySignature.separator.thicknessPct must be a finite non-negative number (got ${JSON.stringify(sep.thicknessPct)})`);
          }
          if (sep.extentSemis !== undefined && sep.extentSemis !== null &&
              (typeof sep.extentSemis !== "number" || !Number.isFinite(sep.extentSemis) || sep.extentSemis <= 0)) {
            errors.push(`keys.keySignature.separator.extentSemis must be a finite positive number (got ${JSON.stringify(sep.extentSemis)})`);
          }
          if (sep.shareThickness !== undefined && typeof sep.shareThickness !== "boolean") {
            errors.push(`keys.keySignature.separator.shareThickness must be true or false (got ${JSON.stringify(sep.shareThickness)})`);
          }
        }
      }
      // The signs' size (session 52): null is automatic.
      const signs = keySig.signs;
      if (signs !== undefined && signs !== null) {
        if (!isPlainObject(signs)) {
          errors.push("keys.keySignature.signs must be an object");
        } else if (signs.heightSemis !== undefined && signs.heightSemis !== null) {
          const h = signs.heightSemis;
          if (typeof h !== "number" || !Number.isFinite(h) || h <= 0) {
            errors.push(`keys.keySignature.signs.heightSemis must be a finite number greater than 0, or null for automatic (got ${JSON.stringify(h)})`);
          } else if (h < 1 || h > 12) {
            warnings.push(`keys.keySignature.signs.heightSemis is ${h} semitones, outside 1–12: the sharps and flats are unlikely to look right`);
          }
        }
      }
      // The designer's settings (session 48, key-signature design §6): an
      // absent setting is its default.
      const vocabulary = (value, field, values) => {
        if (value !== undefined && !values.includes(value)) {
          errors.push(`keys.keySignature.${field} must be one of ${values.map(v => `"${v}"`).join(", ")} (got ${JSON.stringify(value)})`);
        }
      };
      vocabulary(keySig.notes, "notes", ["all", "tonic-and-half-steps", "altered"]);
      vocabulary(keySig.stacking, "stacking", ["degrees", "parity", "parity-stacks", "parity-zigzag", "fifths"]);
      vocabulary(keySig.heights, "heights", ["window", "scale"]);
      const finite = v => typeof v === "number" && Number.isFinite(v);
      if (keySig.window !== undefined) {
        if (!isPlainObject(keySig.window)) {
          errors.push("keys.keySignature.window must be an object { sharp, flat }");
        } else {
          for (const side of ["sharp", "flat"]) {
            if (keySig.window[side] !== undefined && !finite(keySig.window[side])) {
              errors.push(`keys.keySignature.window.${side} must be a finite number of semitones (got ${JSON.stringify(keySig.window[side])})`);
            }
          }
        }
      }
      vocabulary(keySig.columns, "columns", ["right", "left-in-sharp-keys"]);
      if (isPlainObject(placement)) {
        vocabulary(placement.position, "placement.position", ["middle", "bottom-set", "top-set", "every-set"]);
      }
      if (keySig.upperTonic !== undefined && typeof keySig.upperTonic !== "boolean") {
        errors.push(`keys.keySignature.upperTonic must be true or false (got ${JSON.stringify(keySig.upperTonic)})`);
      }
      // A look is checked as a notehead rule's apply block is (checks 1, 2,
      // 3 and 3a): every second stack's takes no size.
      const checkLook = (look, field, fields) => {
        if (look === undefined) return;
        if (!isPlainObject(look)) {
          errors.push(`keys.keySignature.${field} must be an object`);
          return;
        }
        for (const key of Object.keys(look)) {
          if (!fields.includes(key)) errors.push(`keys.keySignature.${field}.${key} is not a look setting (${fields.join(", ")})`);
        }
        if (look.shape !== undefined && !(look.shape in shapes)) {
          errors.push(`keys.keySignature.${field} references unknown shape "${look.shape}"`);
        } else if (look.hollow === true && look.shape !== undefined && !shapes[look.shape].svgHollowPath) {
          errors.push(`keys.keySignature.${field} sets hollow on shape "${look.shape}", which has no svgHollowPath`);
        }
        if (look.hollow !== undefined && typeof look.hollow !== "boolean") {
          errors.push(`keys.keySignature.${field}.hollow must be true or false (got ${JSON.stringify(look.hollow)})`);
        }
        if (look.color !== undefined && look.color !== null && !isValidHex(look.color)) {
          errors.push(`keys.keySignature.${field} has invalid color hex "${look.color}"`);
        }
        // An added symbol's size of null is its shape's own (design §13.6).
        const checkSizes = (owner, label, nullable = false) => {
          for (const size of ["heightSemis", "widthSemis"]) {
            const v = owner[size];
            if (v === undefined || (nullable && v === null)) continue;
            if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
              errors.push(`keys.keySignature.${label}.${size} must be a finite number greater than 0 (got ${JSON.stringify(v)})`);
            } else if (v < 0.25 || v > 4) {
              warnings.push(`keys.keySignature.${label}.${size} is ${v} semitones, outside the usual 0.25–4`);
            }
          }
        };
        const checkOffset = (offset, label) => {
          if (offset === undefined) return;
          if (!isPlainObject(offset) || !finite(offset.x) || !finite(offset.y)) {
            errors.push(`keys.keySignature.${label}.offset must be { x, y }, two finite numbers of semitones (got ${JSON.stringify(offset)})`);
          }
        };
        if (fields.includes("heightSemis")) checkSizes(look, field);
        // The model's fields (session 54, design §13.9).
        if (look.sign !== undefined && look.sign !== "sharp" && look.sign !== "flat") {
          errors.push(`keys.keySignature.${field}.sign must be "sharp" or "flat" (got ${JSON.stringify(look.sign)})`);
        }
        if (look.sign !== undefined && look.shape !== undefined) {
          errors.push(`keys.keySignature.${field} sets both shape and sign: a mark's base is one or the other`);
        }
        checkOffset(look.offset, field);
        if (look.added !== undefined) {
          if (!Array.isArray(look.added)) {
            errors.push(`keys.keySignature.${field}.added must be an array of added symbols`);
          } else {
            if (look.added.length > 2) {
              errors.push(`keys.keySignature.${field}.added has ${look.added.length} symbols; a mark adds at most 2`);
            }
            look.added.forEach((sym, i) => {
              const label = `${field}.added[${i}]`;
              if (!isPlainObject(sym)) {
                errors.push(`keys.keySignature.${label} must be an object`);
                return;
              }
              if (typeof sym.shape !== "string" || !(sym.shape in shapes)) {
                errors.push(`keys.keySignature.${label} references unknown shape ${JSON.stringify(sym.shape)}`);
              }
              checkSizes(sym, label, true);
              checkOffset(sym.offset, label);
            });
          }
        }
      };
      const MODEL = ["sign", "offset", "added"];
      const LOOK = ["shape", "hollow", "color", "heightSemis", "widthSemis", ...MODEL];
      const LOOKS = ["all", "natural", "flat", "sharp", "line", "space"];
      if (keySig.looks !== undefined && !isPlainObject(keySig.looks)) {
        errors.push("keys.keySignature.looks must be an object");
      } else if (isPlainObject(keySig.looks)) {
        for (const key of Object.keys(keySig.looks)) {
          if (!LOOKS.includes(key)) errors.push(`keys.keySignature.looks.${key} is not a look (${LOOKS.join(", ")})`);
          else checkLook(keySig.looks[key], `looks.${key}`, LOOK);
        }
      }
      checkLook(keySig.alternate, "alternate", ["shape", "hollow", "color", ...MODEL]);
      // Key definitions are what the signature renders from.
      if (keysSection.definitions !== undefined && keysSection.definitions !== null &&
          !Array.isArray(keysSection.definitions)) {
        errors.push("keys.definitions must be an array of key definitions");
      } else {
        // No definitions is fine (session 36): the canvas draws the key
        // picked there, and the engine the score's \key.
        const keyDefs = keysSection.definitions || [];
        keyDefs.forEach((def, i) => {
          if (!isPlainObject(def)) {
            errors.push(`keys.definitions[${i}] must be an object`);
            return;
          }
          const defLabel = typeof def.name === "string" && def.name.length > 0 ? `"${def.name}"` : `[${i}]`;
          if (typeof def.name !== "string" || def.name.length === 0) {
            errors.push(`keys.definitions[${i}] has no name`);
          }
          const pcs = def.pitchClasses;
          if (!Array.isArray(pcs) || pcs.length === 0 ||
              !pcs.every(pc => Number.isInteger(pc) && pc >= 0 && pc <= 11)) {
            errors.push(`Key definition ${defLabel} needs a non-empty pitchClasses array of integers 0–11`);
          }
          if (def.tonicPc !== undefined && def.tonicPc !== null &&
              !(Number.isInteger(def.tonicPc) && def.tonicPc >= 0 && def.tonicPc <= 11)) {
            errors.push(`Key definition ${defLabel} tonicPc must be an integer 0–11 (got ${JSON.stringify(def.tonicPc)})`);
          }
          // Tonic fallback warning: no explicit tonicPc and the name does not
          // lead with a note letter — the exact condition under which
          // CNBMusic.parseTonicPc fails — so the renderer will fall back to
          // the first listed pitch class (s1 decision D3).
          if ((def.tonicPc === undefined || def.tonicPc === null) &&
              typeof def.name === "string" && !/^\s*[A-Ga-g]/.test(def.name)) {
            warnings.push(`Key definition ${defLabel} has no tonicPc and its name does not begin with a note letter — the tonic falls back to the first listed pitch class`);
          }
        });
      }
    }

    // 10. Pitch-axis checks (set 014) — design §1.4, rules PA-1…PA-8 (but
    //     PA-5/PA-6, retired with the line overrides in session 34) and
    //     PA-W1/W3/W4 (docs/planning/pitch-axis-design.md). All checks are
    //     gated on pitchAxis.enabled being truthy — except PA-W4, which by
    //     definition fires on a disabled/absent section — so configs
    //     predating the feature validate exactly as before. Same type-safe
    //     posture as checks 8–9: malformed sections report errors, never
    //     throw.
    const pitchAxis = isPlainObject(config.pitchAxis) ? config.pitchAxis : {};
    if (pitchAxis.enabled) {
      // PA-1: kind vocabulary (single value; extends when new kinds are implemented)
      if (pitchAxis.kind !== "pitch-class-map-v1") {
        errors.push(`pitchAxis.kind must be "pitch-class-map-v1" (got ${JSON.stringify(pitchAxis.kind)}; the vocabulary extends when new axis kinds are implemented)`);
      }

      // PA-3: octaveStride finite > 0
      const strideOk = typeof pitchAxis.octaveStride === "number" &&
                       Number.isFinite(pitchAxis.octaveStride) && pitchAxis.octaveStride > 0;
      if (!strideOk) {
        errors.push(`pitchAxis.octaveStride must be a finite number > 0 (got ${JSON.stringify(pitchAxis.octaveStride)})`);
      }

      // PA-4: axisUnitsPerStaffSpace finite > 0
      const unitsOk = typeof pitchAxis.axisUnitsPerStaffSpace === "number" &&
                      Number.isFinite(pitchAxis.axisUnitsPerStaffSpace) && pitchAxis.axisUnitsPerStaffSpace > 0;
      if (!unitsOk) {
        errors.push(`pitchAxis.axisUnitsPerStaffSpace must be a finite number > 0 (got ${JSON.stringify(pitchAxis.axisUnitsPerStaffSpace)})`);
      }

      // PA-2: exactly one entry per pitch class 0–11, finite numeric positions.
      // `positions` (by pc) is non-null only when the map is structurally
      // sound — the map-dependent checks below (PA-8, W1/W3) need it. PA-5
      // and PA-6 guarded the line overrides retired in session 34.
      let positions = null;
      const pcEntries = pitchAxis.pitchClasses;
      if (!Array.isArray(pcEntries) || pcEntries.length !== 12) {
        errors.push(`pitchAxis.pitchClasses must be an array of exactly 12 entries, one per pitch class 0–11 (got ${Array.isArray(pcEntries) ? pcEntries.length + " entries" : JSON.stringify(pcEntries)})`);
      } else {
        const seen = new Array(12).fill(undefined);
        let entriesOk = true;
        pcEntries.forEach((entry, i) => {
          if (!isPlainObject(entry)) {
            errors.push(`pitchAxis.pitchClasses[${i}] must be an object with integer pc and finite numeric position`);
            entriesOk = false;
            return;
          }
          if (!Number.isInteger(entry.pc) || entry.pc < 0 || entry.pc > 11) {
            errors.push(`pitchAxis.pitchClasses[${i}].pc must be an integer 0–11 (got ${JSON.stringify(entry.pc)})`);
            entriesOk = false;
            return;
          }
          if (seen[entry.pc] !== undefined) {
            errors.push(`pitchAxis.pitchClasses has more than one entry for pc ${entry.pc}`);
            entriesOk = false;
            return;
          }
          if (typeof entry.position !== "number" || !Number.isFinite(entry.position)) {
            errors.push(`pitchAxis.pitchClasses[${i}] (pc ${entry.pc}) position must be a finite number (got ${JSON.stringify(entry.position)})`);
            entriesOk = false;
            return;
          }
          seen[entry.pc] = entry.position;
        });
        if (entriesOk) positions = seen;
      }

      // PA-8: the map must be globally non-decreasing — positions
      // non-decreasing in pc order AND positions[11] ≤ positions[0] +
      // octaveStride, so monotonicity holds across octave boundaries too.
      // Non-monotonic maps are REJECTED in "pitch-class-map-v1" (promoted
      // from warning to blocking error in set-013 s2 verification round 1):
      // the grid's extent math and label layout assume monotonicity.
      if (positions) {
        let nonDecreasing = true;
        for (let pc = 1; pc < 12; pc++) {
          if (positions[pc] < positions[pc - 1]) {
            errors.push(`pitchAxis map is not globally non-decreasing: position of pc ${pc} (${positions[pc]}) is below position of pc ${pc - 1} (${positions[pc - 1]}) — non-monotonic maps are rejected in "pitch-class-map-v1"`);
            nonDecreasing = false;
            break;
          }
        }
        if (nonDecreasing && strideOk && positions[11] > positions[0] + pitchAxis.octaveStride) {
          errors.push(`pitchAxis map breaks monotonicity across the octave boundary: position of pc 11 (${positions[11]}) exceeds position of pc 0 (${positions[0]}) + octaveStride (${pitchAxis.octaveStride}) — non-monotonic maps are rejected in "pitch-class-map-v1"`);
        }
      }

      // PA-7: apply.xOffsetStaffSpaces must be a finite number when present
      for (const rule of rules) {
        if (!rule || !isPlainObject(rule.apply)) continue;
        const v = rule.apply.xOffsetStaffSpaces;
        if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v))) {
          errors.push(`Rule "${rule.name || "(unnamed)"}" apply.xOffsetStaffSpaces must be a finite number (got ${JSON.stringify(v)})`);
        }
      }

      // PA-W1: positions outside [0, octaveStride) — octave bands overlap
      // or interleave (still legal when PA-8 holds).
      if (positions && strideOk) {
        const outside = [];
        for (let pc = 0; pc < 12; pc++) {
          if (positions[pc] < 0 || positions[pc] >= pitchAxis.octaveStride) outside.push(pc);
        }
        if (outside.length > 0) {
          warnings.push(`pitchAxis positions for pc ${outside.join(", ")} lie outside [0, octaveStride) — octave bands overlap or interleave`);
        }
      }

      // PA-W3: a shared-position pc pair whose resolved noteheads (at
      // crotchet, key null) are indistinguishable — same shape, hollow,
      // effective color, and equal xOffsetStaffSpaces — cannot be told
      // apart in the notation.
      if (positions) {
        const byPosition = new Map();
        for (let pc = 0; pc < 12; pc++) {
          const key = String(positions[pc]);
          if (!byPosition.has(key)) byPosition.set(key, []);
          byPosition.get(key).push(pc);
        }
        for (const [posKey, pcs] of byPosition) {
          if (pcs.length < 2) continue;
          for (let i = 0; i < pcs.length; i++) {
            for (let j = i + 1; j < pcs.length; j++) {
              try {
                const a = CNBConfig.resolveNotehead(config, pcs[i], "crotchet", null);
                const b = CNBConfig.resolveNotehead(config, pcs[j], "crotchet", null);
                const colorA = (a.color || "#000000").toLowerCase();
                const colorB = (b.color || "#000000").toLowerCase();
                if (a.shape === b.shape && a.hollow === b.hollow && colorA === colorB &&
                    a.xOffsetStaffSpaces === b.xOffsetStaffSpaces) {
                  warnings.push(`Shared axis position ${posKey}: pitch classes ${pcs[i]} and ${pcs[j]} resolve to indistinguishable noteheads (same shape, hollow, color, and xOffsetStaffSpaces) — the notation cannot disambiguate them`);
                }
              } catch (_) {
                // Skip if resolution fails (covered by error 4)
              }
            }
          }
        }
      }
    } else {
      // PA-W4: xOffsetStaffSpaces present in rules while pitchAxis is
      // disabled/absent — the field's whole lifecycle is axis-gated
      // (design §3.2, deviation D2) and it will be ignored.
      for (const rule of rules) {
        if (!rule || !isPlainObject(rule.apply)) continue;
        if (rule.apply.xOffsetStaffSpaces !== undefined) {
          warnings.push(`Rule "${rule.name || "(unnamed)"}" sets apply.xOffsetStaffSpaces while pitchAxis is disabled or absent — the field is axis-gated and will be ignored`);
        }
      }
    }

    // 11. Export safety (audit 2026-11-02, H1/M5). Every value the LilyPond
    //     exporter emits goes through a CNBScheme emitter; the same
    //     predicates reject here what an emitter would refuse at export.
    const present = v => v !== undefined && v !== null;
    const numberError = (field, v) =>
      errors.push(`${field} must be a finite number (got ${JSON.stringify(v)})`);

    const engine = isPlainObject(config.engine) ? config.engine : {};
    if (engine.lilypondVersion && !CNBScheme.isVersion(engine.lilypondVersion)) {
      errors.push(`engine.lilypondVersion must be a version like "2.24.2" (got ${JSON.stringify(engine.lilypondVersion)})`);
    }
    if (engine.defaultMagnify !== undefined && !CNBScheme.parseRatio(engine.defaultMagnify)) {
      errors.push(`engine.defaultMagnify must be a positive number or fraction like "7/4" (got ${JSON.stringify(engine.defaultMagnify)})`);
    }
    for (const key of ["indent", "collisionThreshold"]) {
      if (engine[key] !== undefined && !CNBScheme.isNumber(engine[key])) numberError(`engine.${key}`, engine[key]);
    }
    // The repeated heads' overlap (session 58), a share of a head's width.
    const overlap = (config.durations || {}).repeatOverlap;
    if (overlap !== undefined && !(CNBScheme.isNumber(overlap) && overlap >= 0 && overlap < 1)) {
      errors.push(`durations.repeatOverlap must be a number from 0 up to (not including) 1 (got ${JSON.stringify(overlap)})`);
    }

    const staffSec = isPlainObject(config.staff) ? config.staff : {};
    if (!Array.isArray(staffPattern)) {
      errors.push("staff.semitonePattern must be an array of numbers");
    } else {
      staffPattern.forEach((v, i) => {
        if (!CNBScheme.isNumber(v)) numberError(`staff.semitonePattern[${i}]`, v);
      });
    }
    for (const key of ["midpoint", "semitonesPerStaffSpace"]) {
      if (present(staffSec[key]) && !CNBScheme.isNumber(staffSec[key])) numberError(`staff.${key}`, staffSec[key]);
    }

    const durationDefs = ((config.durations || {}).definitions) || [];
    for (const def of Array.isArray(durationDefs) ? durationDefs : []) {
      if (def && present(def.lilypondDuration) && !CNBScheme.isNumber(def.lilypondDuration)) {
        numberError(`Duration "${def.name}" lilypondDuration`, def.lilypondDuration);
      }
    }

    const shapeBySymbol = new Map();
    for (const [name, shape] of Object.entries(shapes)) {
      const sym = CNBScheme.slug(name);
      if (!CNBScheme.isSymbol(sym)) {
        errors.push(`Shape "${name}" has no usable LilyPond name: it becomes ${JSON.stringify(sym)}, which is not a Scheme symbol (use a name that starts with a Latin letter)`);
      } else if (shapeBySymbol.has(sym)) {
        errors.push(`Shapes "${shapeBySymbol.get(sym)}" and "${name}" both export as LilyPond name "${sym}" — rename one`);
      } else {
        shapeBySymbol.set(sym, name);
      }
      if (!isPlainObject(shape)) continue;
      for (const key of ["lilypondPath", "lilypondHollowPath"]) {
        if (shape[key] && !CNBScheme.parsePath(shape[key])) {
          errors.push(`Shape "${name}" ${key} is not valid LilyPond path data (moveto/lineto/curveto/closepath with numbers only)`);
        }
      }
      // The anchors the exporter converts: lilypondAnchors (missing
      // coordinates count as 0), else the SVG-unit anchors scaled by the
      // shape's natural and semitone heights.
      const pointKeys = ["crotchetUp", "crotchetDown", "minimUp", "minimDown"];
      if (isPlainObject(shape.lilypondAnchors)) {
        for (const key of pointKeys) {
          const pt = shape.lilypondAnchors[key];
          for (const c of ["x", "y"]) {
            if (pt && present(pt[c]) && !CNBScheme.isNumber(pt[c])) numberError(`Shape "${name}" lilypondAnchors.${key}.${c}`, pt[c]);
          }
        }
      } else if (isPlainObject(shape.anchors)) {
        for (const key of pointKeys) {
          const pt = shape.anchors[key];
          for (const c of ["x", "y"]) {
            if (pt && !CNBScheme.isNumber(pt[c])) numberError(`Shape "${name}" anchors.${key}.${c}`, pt[c]);
          }
        }
        for (const key of ["naturalHeight", "semitoneHeight"]) {
          if (present(shape[key]) && !CNBScheme.isNumber(shape[key])) numberError(`Shape "${name}" ${key}`, shape[key]);
        }
      }
    }

    // ── Warnings ─────────────────────────────────────────────────────────

    // W1. notationLabel is empty
    const label = ((config.meta || {}).notationLabel) || "";
    if (!label) {
      warnings.push("meta.notationLabel is empty");
    }

    // W2. A PC resolves hollow:true but its shape has no svgHollowPath
    const firstShape = firstShapeName(config);
    if (firstShape) {
      for (let pc = 0; pc < 12; pc++) {
        try {
          const resolved = CNBConfig.resolveNotehead(config, pc, "crotchet", null);
          if (resolved.hollow) {
            const shape = shapes[resolved.shape];
            if (shape && !shape.svgHollowPath) {
              warnings.push(`PC ${pc} resolves to hollow but shape "${resolved.shape}" has no svgHollowPath`);
            }
          }
        } catch (_) {
          // Skip if resolution fails (covered by error 4)
        }
      }
    }

    // W3. A shape some notehead uses has lilypondPath: null. A shape nothing
    //     uses is not exported, so it does not warn (session 36): the
    //     shapes resolved for every pitch class and duration, with no key
    //     and, with keys on, each defined key (the export's key branches).
    const used = usedShapeNames(config);
    for (const [name, shape] of Object.entries(shapes)) {
      // Read first: a shape entry that is not an object still throws here,
      // which config-io reports as a schema error.
      const missing = shape.lilypondPath === null || shape.lilypondPath === undefined;
      if (missing && used.has(name)) {
        warnings.push(`Shape "${name}" has no lilypondPath (will use fallback SVG conversion at export)`);
      }
    }

    // W6. Key definitions the engraving cannot tell apart (session 34, LY
    //     spec 1.3.9 §6.4). Section C dispatches on the key's pitch classes,
    //     all the engine passes, so definitions sharing a set engrave alike:
    //     as the first of them a rule names. Warn when the rules draw them
    //     differently. (Key-scoped rules export since session 34.)
    const keysSec = isPlainObject(config.keys) ? config.keys : {};
    if (keysSec.enabled && Array.isArray(keysSec.definitions)) {
      const bySet = new Map();
      for (const def of keysSec.definitions) {
        if (!isPlainObject(def) || !Array.isArray(def.pitchClasses)) continue;
        const set = [...new Set(def.pitchClasses.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b).join(" ");
        if (!bySet.has(set)) bySet.set(set, []);
        bySet.get(set).push(def.name);
      }
      const named = new Set(rules.flatMap(r => (r && isPlainObject(r.match) && Array.isArray(r.match.keys)) ? r.match.keys : []));
      const durationNames = ((config.durations || {}).definitions || []).map(d => d && d.name);
      const looks = (key) => {
        try {
          return JSON.stringify(durationNames.flatMap(d =>
            [...Array(12).keys()].map(pc => CNBConfig.resolveNotehead(config, pc, d, key))));
        } catch (_) { return null; }
      };
      for (const [set, names] of bySet) {
        const exported = names.find(n => named.has(n));
        if (names.length < 2 || exported === undefined) continue;
        if (new Set(names.map(looks)).size > 1) {
          warnings.push(`Key definitions ${names.map(n => `"${n}"`).join(", ")} have the same pitch classes (${set}) but notehead rules draw them differently: the engraving knows a key only by its pitch classes, so it draws them all as "${exported}"`);
        }
      }
    }

    // W7. Off-key marks (architecture §11 question 4; set 005 s2 UAT). A
    //     rule may set one, but the preview draws no mark and the export
    //     writes (off-key-mark . #f) until off-key marking is built.
    for (const rule of rules) {
      if (!rule || !isPlainObject(rule.apply)) continue;
      const mark = rule.apply.offKeyMark;
      if (mark === undefined || mark === false) continue;
      warnings.push(`Rule "${rule.name || "(unnamed)"}" sets an off-key mark (${JSON.stringify(mark)}), which is not drawn in the preview or exported yet`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Deep-merge a partial config over a base config.
   * Arrays in partial replace arrays in base entirely.
   * Objects are merged field by field. Primitives overwrite.
   * Neither argument is mutated; returns a new object.
   * @param {object} base
   * @param {object} partial
   * @returns {object}
   */
  merge(base, partial) {
    return deepMerge(base, partial);
  },

  /**
   * Deep-clone a config. No shared references between clone and original.
   * @param {object} config
   * @returns {object}
   */
  clone(config) {
    return deepClone(config);
  },

  /**
   * Resolve notehead properties for a given (pc, duration, key).
   * Walks noteheadRules in priority order (ascending), merging apply blocks.
   * Only fields explicitly present in rule.apply overwrite the current result.
   *
   * xOffsetStaffSpaces (set 014, design §3.1): horizontal disambiguation
   * offset in STAFF-SPACE units (negative = left, 0 = centered). Default 0;
   * merges in priority order like every other apply field. The field is
   * meaningful only while pitchAxis is enabled (design §3.2) — nothing
   * reads it on the linear path, and export emission is axis-gated.
   *
   * heightSemis / widthSemis (session 22): the notehead's absolute size in
   * semitones. null (the default) means the shape's own semitoneHeight and
   * natural width, each independently.
   *
   * @param {object} config
   * @param {number} pc       0–11
   * @param {string} duration e.g. "crotchet"
   * @param {string|null} key e.g. "C" or null
   * @returns {{ shape: string, hollow: boolean, color: string|null, offKeyMark: boolean|string, xOffsetStaffSpaces: number,
   *            heightSemis: number|null, widthSemis: number|null }}
   */
  resolveNotehead(config, pc, duration, key) {
    const first = firstShapeName(config);

    // Built-in defaults
    const result = {
      shape:       first,
      hollow:      false,
      color:       null,
      offKeyMark:  false,
      xOffsetStaffSpaces: 0,
      heightSemis: null,
      widthSemis:  null,
    };

    const rules = (config.noteheadRules || []).slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));

    for (const rule of rules) {
      if (ruleMatches(rule, pc, duration, key)) {
        const apply = rule.apply || {};
        if (apply.shape      !== undefined) result.shape      = apply.shape;
        if (apply.hollow     !== undefined) result.hollow     = apply.hollow;
        if (apply.color      !== undefined) result.color      = apply.color;
        if (apply.offKeyMark !== undefined) result.offKeyMark = apply.offKeyMark;
        if (apply.xOffsetStaffSpaces !== undefined) result.xOffsetStaffSpaces = apply.xOffsetStaffSpaces;
        if (apply.heightSemis !== undefined) result.heightSemis = apply.heightSemis;
        if (apply.widthSemis  !== undefined) result.widthSemis  = apply.widthSemis;
      }
    }

    return result;
  },

  /**
   * A config saved with a palette, its colours moved onto the noteheads
   * (session 37). A notehead's colour lives only on its rules, so a palette
   * is converted when a config loads:
   *
   *   - each distinct non-black colour of palette.colors (the primary
   *     colours, which the export engraved by default; useCBSafe and the
   *     colour-blind set are dropped) becomes one rule matching the pitch
   *     classes the palette gave it, every duration and key, with
   *     apply.color, listed and prioritised below every existing rule, whose
   *     order is kept. An explicit rule colour therefore still wins.
   *   - rules' explicit color:null ("use the palette") is dropped, so the
   *     palette's colour shows through as before.
   *   - the palette section goes.
   *
   * A config without a palette comes back as it is. The input is not
   * changed.
   * @param {object} config
   * @returns {object}
   */
  paletteToRules(config) {
    if (!config || config.palette === undefined) return config;
    const out = deepClone(config);
    const isPlainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
    const colors = (isPlainObject(out.palette) && Array.isArray(out.palette.colors)) ? out.palette.colors : [];
    delete out.palette;

    const groups = new Map();       // lower-case hex → { hex, name, pcs }
    for (const entry of colors) {
      if (!entry || typeof entry.hex !== "string" || !Number.isInteger(entry.pc)) continue;
      const key = entry.hex.toLowerCase();
      if (key === "#000000") continue;
      if (!groups.has(key)) groups.set(key, { hex: entry.hex, name: entry.name, pcs: [] });
      const g = groups.get(key);
      if (!g.pcs.includes(entry.pc)) g.pcs.push(entry.pc);
    }

    const rules = Array.isArray(out.noteheadRules) ? out.noteheadRules : [];
    for (const rule of rules) {
      if (rule && isPlainObject(rule.apply) && rule.apply.color === null) delete rule.apply.color;
    }
    if (groups.size === 0) return out;

    const priorities = rules.map(r => (r && r.priority) || 0);
    const low = priorities.length ? Math.min(...priorities) : 0;
    const added = [...groups.values()].map((g, i) => ({
      name: `Colour ${g.name || g.hex}`,
      priority: low + i,
      match: { pitchClasses: g.pcs.sort((a, b) => a - b), durations: "all", keys: "all" },
      apply: { color: g.hex },
    }));
    for (const rule of rules) if (rule) rule.priority = ((rule.priority) || 0) + added.length;
    out.noteheadRules = [...added, ...rules];
    return out;
  },

  /**
   * A config saved with a key-signature style, converted to the one model
   * (session 54, key-signature design §13.2). `style` is retired:
   *
   *   - "notehead-chords" (or any other value) needs nothing, since the
   *     model's defaults are that style: the field is dropped.
   *   - "accidentals" becomes the traditional signature as session 51 drew
   *     it: looks.all, .flat, .sharp and alternate are cleared (the style
   *     ignored them), then notes "altered", looks.flat { sign: "flat",
   *     color: null }, looks.sharp { sign: "sharp", color: null }, stacking
   *     "fifths" and heights "scale". signs and placement are kept.
   *
   * Runs on the loaded data before the defaults are merged; a config with
   * no style comes back as it is, so running it twice changes nothing. The
   * input is not changed.
   * @param {object} config
   * @returns {object}
   */
  signatureStyleToModel(config) {
    const ks = config && config.keys && config.keys.keySignature;
    if (!ks || typeof ks !== "object" || !("style" in ks)) return config;
    const out = deepClone(config);
    const sig = out.keys.keySignature;
    const style = sig.style;
    delete sig.style;
    if (style !== "accidentals") return out;
    const looks = sig.looks !== null && typeof sig.looks === "object" && !Array.isArray(sig.looks) ? sig.looks : {};
    looks.all = {};
    looks.flat = { sign: "flat", color: null };
    looks.sharp = { sign: "sharp", color: null };
    sig.looks = looks;
    sig.alternate = {};
    sig.notes = "altered";
    sig.stacking = "fifths";
    sig.heights = "scale";
    return out;
  },

  /**
   * Convert a thickness percentage to pixels for preview rendering.
   * pctToPx(20, 16) = 3.2
   * @param {number} pct       Percentage (e.g. 20 for 20%)
   * @param {number} pxPerSemi Pixels per semitone
   * @returns {number}
   */
  pctToPx(pct, pxPerSemi) {
    return (pct / 100) * pxPerSemi;
  },

};
