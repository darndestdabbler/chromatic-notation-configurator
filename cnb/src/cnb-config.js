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
