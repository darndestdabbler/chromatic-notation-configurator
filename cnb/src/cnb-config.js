/**
 * cnb-config.js — Module A: Config Schema
 *
 * Canonical JSON config structure with defaults, validation, deep merge,
 * clone, notehead rule resolution, and color resolution.
 *
 * No external dependencies.
 *
 * Part of the Chromatic Notation Builder modular architecture.
 */

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

        // 4-point stem anchor model (in native SVG units)
        anchors: {
          crotchetUp:   { x: 157.2926,  y: -42.9985 },
          crotchetDown: { x: -157.2934, y:  43.0027 },
          minimUp:      { x: 157.2926,  y: -42.9985 },
          minimDown:    { x: -157.2934, y:  43.0027 },
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
      lineDefaults: {
        thicknessPct: 20,
        style: "solid",
        color: "#000000",
      },
      lineOverrides: {},
    },

    ledgers: {
      templates: [
        { semiWithinOctave: 0,  triggerPCs: [0, 1, 2], triggerMode: "override" },
        { semiWithinOctave: 2,  triggerPCs: [2],        triggerMode: "override" },
        { semiWithinOctave: 10, triggerPCs: [10],       triggerMode: "override" },
      ],
      proximityRule: true,
      lineDefaults: {
        thicknessPct: 40,
        widthMultiplier: 2.0,
        style: "solid",
        color: "#000000",
        roundedEnds: true,
      },
      lineOverrides: {},
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

    palette: {
      name: "None",
      colors: [],
      cbSafeColors: [],
      useCBSafe: false,
      schemeSymbols: {},
    },

    display: {
      pxPerSemi: 16,
      stemThicknessPct: 26,
      stemExtension: 2.5,
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
      repeatCounts: { minim: 2, semibreve: 4, breve: 8 },
    },

    keys: {
      enabled: false,
      definitions: [],
      offKeyMark: {},

      // Key signature (set 010). Default-off: with enabled:false the preview
      // and the LilyPond export are byte-identical to the pre-set-010 output.
      // The default style "notehead-chords" mirrors the engine's keysig.ly:
      // the key's scale rendered as real noteheads — 7 degrees ascending
      // from the tonic plus the octave tonic, interleaved into two columns
      // (two stacked 7th chords) — capped with a gold separator bar
      // (engine cnb:gold #ffd42a). "dot" is the simple built-in mark
      // alternative. tonicOctave null = auto (center the octave span on
      // staff.midpoint; ties resolve upward, so a C tonic with midpoint 12
      // sits at semitone 12, matching the engine's middle-C anchor for the
      // default config).
      keySignature: {
        enabled: false,
        style: "notehead-chords",
        tonicOctave: null,
        separator: {
          enabled: true,
          color: "#ffd42a",
          thicknessPct: 25,
          extentSemis: 12,
        },
        dot: { radiusPct: 30 },
        gutter: { paddingH: 12 },
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
      multinotePadding: -0.5,
      defaultMagnify: "7/4",
      indent: 0,
      collisionThreshold: 2,
      stemThickness: null,
      useAccessibleColors: false,
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

    // 3. Explicit color hex values in rules must be valid (covers palette hex check per spec)
    //    Config.palette.colors[].hex must also be valid
    for (const rule of rules) {
      if (rule.apply && rule.apply.color !== null && rule.apply.color !== undefined) {
        if (!isValidHex(rule.apply.color)) {
          errors.push(`Rule "${rule.name || "(unnamed)"}" has invalid color hex "${rule.apply.color}"`);
        }
      }
    }
    const palette = config.palette || {};
    for (const entry of (palette.colors || [])) {
      if (!isValidHex(entry.hex)) {
        errors.push(`Palette color for PC ${entry.pc} has invalid hex "${entry.hex}"`);
      }
    }
    for (const entry of (palette.cbSafeColors || [])) {
      if (!isValidHex(entry.hex)) {
        errors.push(`CB-safe palette color for PC ${entry.pc} has invalid hex "${entry.hex}"`);
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

    // 7. All color hex values match #RRGGBB — already covered in check 3 above for rules/palette.
    //    Also check staff and ledger colors.
    const staffColor = ((config.staff || {}).lineDefaults || {}).color;
    if (staffColor !== undefined && staffColor !== null && !isValidHex(staffColor)) {
      errors.push(`staff.lineDefaults.color has invalid hex "${staffColor}"`);
    }
    const ledgerColor = ((config.ledgers || {}).lineDefaults || {}).color;
    if (ledgerColor !== undefined && ledgerColor !== null && !isValidHex(ledgerColor)) {
      errors.push(`ledgers.lineDefaults.color has invalid hex "${ledgerColor}"`);
    }

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
        } else {
          errors.push(`Clef glyph "${clef.active}" has unknown kind "${kind}" (expected "glyph" or "text")`);
        }
        // anchorSemi is deliberately a float: surveyed clef designs
        // (Bravura gClef top +1.392 staff-spaces above the top line,
        // Clairnote glyph tops at fractional extents) do not top-align to
        // integer grid positions.
        if (typeof def.anchorSemi !== "number" || !Number.isFinite(def.anchorSemi)) {
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
      const ksStyle = keySig.style === undefined || keySig.style === null ? "notehead-chords" : keySig.style;
      if (ksStyle !== "notehead-chords" && ksStyle !== "dot") {
        errors.push(`keys.keySignature.style must be "notehead-chords" or "dot" (got ${JSON.stringify(keySig.style)})`);
      }
      if (keySig.tonicOctave !== undefined && keySig.tonicOctave !== null && !Number.isInteger(keySig.tonicOctave)) {
        errors.push(`keys.keySignature.tonicOctave must be an integer octave or null for auto (got ${JSON.stringify(keySig.tonicOctave)})`);
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
        }
      }
      const dot = keySig.dot;
      if (dot !== undefined && dot !== null) {
        if (!isPlainObject(dot)) {
          errors.push("keys.keySignature.dot must be an object");
        } else if (dot.radiusPct !== undefined && dot.radiusPct !== null &&
                   (typeof dot.radiusPct !== "number" || !Number.isFinite(dot.radiusPct) || dot.radiusPct <= 0)) {
          errors.push(`keys.keySignature.dot.radiusPct must be a finite positive number (got ${JSON.stringify(dot.radiusPct)})`);
        }
      }
      const ksGutter = keySig.gutter;
      if (ksGutter !== undefined && ksGutter !== null) {
        if (!isPlainObject(ksGutter)) {
          errors.push("keys.keySignature.gutter must be an object");
        } else if (ksGutter.paddingH !== undefined && ksGutter.paddingH !== null &&
                   (typeof ksGutter.paddingH !== "number" || !Number.isFinite(ksGutter.paddingH) || ksGutter.paddingH < 0)) {
          errors.push(`keys.keySignature.gutter.paddingH must be a finite non-negative number (got ${JSON.stringify(ksGutter.paddingH)})`);
        }
      }
      // Key definitions are what the signature renders from.
      if (keysSection.definitions !== undefined && keysSection.definitions !== null &&
          !Array.isArray(keysSection.definitions)) {
        errors.push("keys.definitions must be an array of key definitions");
      } else {
        const keyDefs = keysSection.definitions || [];
        if (keyDefs.length === 0) {
          warnings.push("keys.keySignature is enabled but keys.definitions is empty — there is no key to render");
        }
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

    // W3. Any shape has lilypondPath: null
    for (const [name, shape] of Object.entries(shapes)) {
      if (shape.lilypondPath === null || shape.lilypondPath === undefined) {
        warnings.push(`Shape "${name}" has no lilypondPath (will use fallback SVG conversion at export)`);
      }
    }

    // W4. Some PCs have color:null and palette is empty
    const hasColors = (palette.colors || []).length > 0;
    if (!hasColors) {
      let anyColorNull = false;
      for (let pc = 0; pc < 12; pc++) {
        try {
          const resolved = CNBConfig.resolveNotehead(config, pc, "crotchet", null);
          if (resolved.color === null) { anyColorNull = true; break; }
        } catch (_) { /* skip */ }
      }
      if (anyColorNull) {
        warnings.push("Some pitch classes have no color rule and no palette — will render black");
      }
    }

    // W5. CB-safe palette has fewer entries than primary palette
    const primaryCount  = (palette.colors || []).length;
    const cbSafeCount   = (palette.cbSafeColors || []).length;
    if (primaryCount > 0 && cbSafeCount < primaryCount) {
      warnings.push(`CB-safe palette has ${cbSafeCount} entries but primary palette has ${primaryCount}`);
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
   * @param {object} config
   * @param {number} pc       0–11
   * @param {string} duration e.g. "crotchet"
   * @param {string|null} key e.g. "C" or null
   * @returns {{ shape: string, hollow: boolean, color: string|null, offKeyMark: boolean|string }}
   */
  resolveNotehead(config, pc, duration, key) {
    const first = firstShapeName(config);

    // Built-in defaults
    const result = {
      shape:       first,
      hollow:      false,
      color:       null,
      offKeyMark:  false,
    };

    const rules = (config.noteheadRules || []).slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));

    for (const rule of rules) {
      if (ruleMatches(rule, pc, duration, key)) {
        const apply = rule.apply || {};
        if (apply.shape      !== undefined) result.shape      = apply.shape;
        if (apply.hollow     !== undefined) result.hollow     = apply.hollow;
        if (apply.color      !== undefined) result.color      = apply.color;
        if (apply.offKeyMark !== undefined) result.offKeyMark = apply.offKeyMark;
      }
    }

    return result;
  },

  /**
   * Get the effective display color for a pitch class.
   * Respects config.palette.useCBSafe to choose between primary and CB-safe colors.
   * Returns hex string (e.g. "#FF0000") or null if no palette is configured.
   * @param {object} config
   * @param {number} pc  0–11
   * @returns {string|null}
   */
  resolveColor(config, pc) {
    const palette = config.palette || {};
    const useCB   = !!palette.useCBSafe;
    const colors  = useCB ? (palette.cbSafeColors || []) : (palette.colors || []);
    if (colors.length === 0) return null;
    const entry = colors.find(c => c.pc === pc);
    return entry ? entry.hex : null;
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
