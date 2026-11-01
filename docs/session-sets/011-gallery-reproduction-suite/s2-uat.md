# Session 2 UAT — Tier-2 gallery reproductions + Tier-3 partial

**Set:** `011-gallery-reproduction-suite` · session 2 of 2 (final)
**Config:** `tier: full`, `requiresUAT: true`, `uatScope: per-session`,
`uatStyle: ad-hoc` (side-by-side image comparison, not a browser DSL flow).
**Date:** 2026-07-08 → 2026-07-09

Per the spec (session-2 step 4): a human compares each captured preview
side-by-side with the published system and the operator's per-pitch-class
reference, and attests. This session ran as a **four-round product
collaboration** (the set-010-s2 / set-011-s1 pattern): each round the
operator supplied itemized corrections — including two rounds of authoritative
spreadsheet updates — which were treated as operative product direction, fixed,
re-captured, and re-attested. The full verbatim dialogue is recorded below;
the round-4 selection is the **operative attestation** (all earlier ones are
preliminary and superseded).

---

## Package

Captured by `node cnb/uat/uat-gallery-previews.mjs` — each fixture loaded
through the real UI load pipeline (`CNBConfigIO.loadFromText`) and rendered by
the real preview renderer (`CNBCollection.render`) as the full chromatic row
(PCs 0–12) at crotchet, screenshotted at 2× device scale. For the two
keysig-enabled fixtures (Clairnote SN/DN) the harness passes the fixture's
first key definition (G major) as the example key so the signature renders
(the displayed key is example data, architecture principle 1).

- **Location:** `C:\temp\cnb-gallery-uat\`
- **Contact sheet:** `C:\temp\cnb-gallery-uat\index-s2.html` — each system's
  preview PNG next to its source-gallery link and fidelity claim, plus the
  three session-1 fixtures corrected by the operator's new ledger rule.
- **Per-system PNGs:** 17 files (9 session-2 + the 8 session-1 fixtures,
  re-captured) + `manifest.json`.

**What to compare** (per the report's rendering-model note): staff geometry
(line count / pattern), line styling, ledger placement, and notehead
assignment. New this session: register-label clefs (set 009) and the gold
key-signature bar (set 010) on the Clairnote fixtures. The octave-chord-card
layout and glyph-shape approximations are the standing session-1 deviations.

---

## Operator dialogue (verbatim)

### Round 1 — initial package (preliminary; superseded)

Attestation selection: **"A fixture has a defect."**

Follow-up (verbatim), on request for specifics:

> Ledger lines need attention. I added two additional columns in the
> spreadsheet. Effective Ledger Rules provide a rule set in JSON for where
> ("at") and when ("for") ledger lines are displayed. I also have a general
> rule for ledger lines: `ledger lines are to be shown at every semitone that
> is closer to a displayed notehead's vertical middle than the nearest staff
> line.` The "My General Ledger Rule Sufficient" indicates whether or not my
> rule is sufficient to determine where and when the ledger lines are
> displayed on a particular notation system. Note that some systems either
> don't have ledger lines or they are not indicated in the Gallery.

**Resolution:** the operator's new `Effective Ledger Rules` column (per-system
`{"at":[…],"for":[…]}` JSON) is authoritative. Every fixture's ledgers were
re-derived from it (override templates: `at` → `semiWithinOctave`, `for` →
`triggerPCs`). Three session-1 fixtures (Hass, Numbered-Notes, AxLoMaFi) were
also corrected by the same rule — an operator-directed scope expansion (see
the spec scope note).

### Round 2 — first corrected package (preliminary; superseded)

Attestation selection: **"Still issues — more corrections."** Verbatim:

> 1. The sequence for the triangle, circle, and x is wrong in the Trilinear
>    Notation. It should be x, circle, triangle. Also, the circle should be a
>    circle, not a conventional notehead. 2. I missed a ledger line for
>    Clairnote SN: {"at": ["A#"], "for": ["A#"]}. I corrected the spreadsheet.
>    3. Clairnote DN was supposed to be [ {"at": ["C"], "for":
>    ["B","C","C#"]}]. I corrected the spreadsheet. 4. The sequence for hollows
>    and solids is backwards for Chromatic Lyre Notation. It should be Hollow,
>    Solid (H,S). 5. The express staves only have three defined staff lines --
>    at G#, D, and G#; C is positioned just below (touching) the D staff line;
>    F# is positioned just below (touching) the G# staff line; E is positioned
>    just above (touching) the D staff line; A# is positioned just above
>    (touching) the G# staff line; and all others are positioned such that the
>    middle center of the noteheads are spaced evenly. (It's possible that my
>    gallery-config.xlsx is insufficient to represent all of this.). 6. In the
>    Jazz font, the flat notes are flat ovals, not conventional ovals. 7. I
>    corrected the ledger lines for Hass Notation. It should be [ {"at":
>    ["C#"], "for": ["C","C#"]}]. 8. I corrected Number Notes ledger lines. It
>    should be [ {"at": ["C#"], "for": ["C","C#","D"]}]. 9. AxLoMaFi. Should
>    have the notehead sequence slant right, slant left. Right now the slant
>    left looks too much like a circle. You could just horizontally flip the
>    other notehead, which looks good.

**Resolution (all nine):** (1) Trilinear notehead sequence set to X (below-line
set `{0,3,6,9}`) / real-circle ring O (on-line set `{1,4,7,10}`, always hollow)
/ ◁ (above-line set `{2,5,8,11}`); a dedicated circle glyph replaced the oval.
(2) Added the A# floating ledger to Clairnote SN. (3) Clairnote DN C ledger →
`{B,C,C#}`. (4) Chromatic Lyre fill left as line-side hollow / off-line solid —
it already reads H,S (C hollow, C# solid, line-notes E/G# hollow) and is the
correct inverse of Clairnote DN (flipping it would make the two identical);
flagged for confirmation. (5) Express Stave — recorded as a documented
deviation (bounded 3-line staff + touching compression is invariant I4, not
expressible; operator acknowledged the spreadsheet may be insufficient).
(6) Jazz flat set → a distinct flat (horizontal) oval glyph. (7) Hass ledger →
at C# for `{C,C#}`. (8) Numbered-Notes ledger → at C# for `{C,C#,D}`. (9)
AxLoMaFi slant-left → a clean horizontal mirror of slant-right.

### Round 3 — second corrected package (preliminary; superseded)

Attestation selection: **"Still other issues."** Verbatim:

> 1. Sorry, for Trilinear, the ledgers should be [ {"at": ["C#"], "for":
>    ["C","C#"]}]. 2. for ClairNote SN, you have extra ledger lines at the
>    lower C for A#, B, and the upper C. Perhaps we need a supplementary rule
>    that says that unless a ledger line is always present at a particular
>    pitch (by some rule), it is absent at that pitch when there is a staff
>    line between it and the closest note. (or maybe there is a better way to
>    express this.) 3. For ClairNote DN and Chromatic Lyre, there is an extra
>    ledger line at the lower C for B. 4. Each of the Express Stave systems
>    define and show exactly three staff lines at G#, D, and G#. Also, they
>    have a ledger just above the upper C. 5. The jazz font for Express Stave
>    looks pretty bad (the flat ovals are too large compared to the slanted
>    ovals), but that could be corrected with SVGs. 6. In Hass Notation, each
>    of the following noteheads are top-aligned: D and D#, F and F#, G# and A,
>    B & C. Perhaps we need a config for that ... like a vertical offset
>    vector? 7. In AxLoMaFi, the B note's bottom ledger line is wrong. It
>    should be at the upper C.

**Resolution — the diagnosis (platform ledger octave-region limit).** Items
2, 3 and 7 share one root cause. The platform's ledger display
(`cnb-ledger-set.js` `resolve` + `cnb-music.js` `ledgerOctaveRegion`) keys
octave regions to **C boundaries** (`floor(semi/12)`) and its
`isBetweenNoteAndStaff` test only checks for a staff line *beyond* the ledger,
never one *between* the note and the ledger. So a note just below a C-boundary
(A# = 11-region-boundary−2, B = boundary−1) can only trigger the **lower** C
ledger — across an intervening staff line — and cannot reach the upper C ledger
it visually approaches. The operator's proposed "suppress a ledger when a staff
line intervenes" is exactly the missing enhancement.

Per the set's non-goals (a target needing a feature is documented as a gap, not
built), the in-scope fix trims the cross-boundary triggers so no *wrong* ledger
renders: Trilinear ledger → **at C#** for `{C,C#}` (item 1); the A#/B triggers
were removed from the C ledger of Clairnote SN (→ `{C,C#,D}`), Clairnote DN and
Chromatic Lyre (→ `{C,C#}`), and AxLoMaFi (→ `{C,C#}`), eliminating the extra
lower-C ledgers (items 2, 3, 7). Item 5: the Jazz flat oval was shrunk to match
the slant footprint; a polished SVG is a deferred asset. Items 4 (Express Stave
bounded staff + upper-C ledger) and 6 (Hass notehead top-alignment) are
new-feature gaps carried to the round-4 scope decision.

### Round 4 — scope decision (OPERATIVE attestation)

Presented: the round-3 in-scope fixes are applied and re-captured; the
remaining items (A the ledger octave-region rule, B Express Stave bounded
staff / I4, C Hass notehead vertical-offset, D polished SVG assets) all need
new platform features the set's non-goals exclude. Options: close now with the
gaps documented + feasibility-matrix corrections / build a feature now / more
in-scope fixes.

Selection: **"Close now, document the gaps (Recommended)."**

---

## Outcome (operative)

**All nine session-2 systems — acceptable-with-noted-deviations.** The
structural reproductions (staff geometry, line styling, ledger placement per
the corrected `Effective Ledger Rules`, notehead assignment/shape/fill, clef
register labels, key signatures) are accepted. The operator elected to close
the set with the following recorded deviations, each of which is a named
platform-feature gap (documented in `reproduction-report.md` and flagged in
`feasibility-matrix.md`), per the set's non-goal that a target needing a
feature is documented, not implemented:

- **Ledger octave-region rule** (A) — affects Clairnote SN/DN, Chromatic Lyre,
  AxLoMaFi: a note just below a C-boundary cannot show a ledger connecting up
  to the next C; the operator's "suppress-when-a-staff-line-intervenes" rule is
  the enhancement. Trimmed to render no wrong ledger.
- **Bounded staff extent** (B) — Express Stave (43/44/45): the true 3-line
  G#/D/G# staff + upper-C ledger needs a staff-extent feature (invariant I4);
  the platform renders the continuous repeating [2,8] grid. Feasibility-matrix
  correction recorded.
- **Notehead vertical offset / top-alignment** (C) — Hass: the published
  D&D#, F&F#, G#&A, B&C top-alignment needs a notehead vertical-offset config.
- **Polished glyph SVG assets** (D) — the flat-oval (Jazz) and the geometric
  X/◁/triangle/slant approximations; deferred asset task (the Module 16
  importer already supports replacement).

Plus the standing session-1 deviations: the octave-chord preview layout,
2-semitone notehead height, dashed-line dash length, and register-label (not
glyph) clefs.

No unrecorded deviation remains; the outstanding items are all recorded as
named gaps with the operator's close-now direction.
