# Session 1 — Baseline diff: discrepancy catalog

**Session set:** 007-end-to-end-pipeline-verification — Session 1 of 2
**Date:** 2026-07-05
**Golden baseline:** `lilypond-chromatic-notation-base` (local clone at
`d:/Projects/lilypond-chromatic-notation-base`): `joy-to-the-world.ly`
(procedure-model score, includes `Kite-4-369-Notation-Procedure.ly`) and the
101-assertion structural spec `tests/joy-to-the-world.json`.

---

## Method

1. **Fixture** — `cnb/fixtures/kite-4-369-config.json` reproduces the Kite
   4-369 notation system in the Configurator schema: kite-up/kite-down
   diamond shapes with pre-baked LilyPond paths, staff pattern [3,6,9]
   (midpoint 12, 3 semitones per staff space), 3 cumulative notehead rules
   reproducing the reference file's PC table (shape mod 4, hollow mod 2,
   color mod 3 — all octave-invariant), repeat representation mode,
   `falseHollow: true`, and the golden score's CB-safe color overrides
   baked in as the palette (skyblue `#50b4e9` / rose `#cc79a7` / black).
2. **Export, two ways, proven identical**:
   - Headless: `node cnb/fixtures/export-kite-4-369.mjs <out.ly>`
     (calls `CNBLilypond.generate()`, the same call the UI makes).
   - Full UI golden path: `node cnb/uat/uat-kite-pipeline.mjs` loads the
     fixture through the Module 17 config loader in `cnb/index.html`,
     verifies editors/preview adopt it, exports via the Module 18 button,
     and byte-compares the captured download against the direct
     `generate()` call — **11/11 checks passed; UI download byte-identical
     to the headless artifact.**
3. **Render** — a score file with the *same music* as the golden
   `joy-to-the-world.ly` but including the Configurator export instead of
   the hand-written Kite include (plus `cnb/test-ids.ly` for harvesting),
   rendered with LilyPond 2.24.2, `-dbackend=svg`, from the engine repo
   root. Checked in as `cnb/fixtures/joy-to-the-world-configurator.ly`.
4. **Diff** — engine repo's `tools/harvest_svg.py` structural harvest of
   both SVGs (per-element type/color/bbox/position/path-hash comparison)
   plus the engine's own `tools/run_tests.py` 101-assertion golden spec
   run against both renders.

## Result summary

| Render | Outcome |
|---|---|
| Golden reference (`joy-to-the-world.ly` as-is) | 74 passed / 0 failed (101-assertion spec) |
| Configurator export **as generated** | Compiles, but notation config silently ignored: default black noteheads (bbox h 1.75 vs 2.33), staff height halved (5.25 vs 10.5 units) — D1 + D2 below |
| Configurator export **with D1+D2 hand-patched** (2 lines) | 74 passed / 0 failed — same as golden. Per-element harvest diff: staff geometry, all 57 notehead colors, sizes, and vertical positions **exactly match**; only residue is D3 (cosmetic) |

The patched isolation run proves D1 and D2 are the **only** functional
discrepancies: two hand-edited lines take the export from "silently
ignored" to structurally indistinguishable from the golden baseline.

---

## Discrepancies

### D1 — Exporter never emits `#(set! cnb:use-procedure-model #t)` — BLOCKER

- **Symptom:** the generated `.ly` compiles cleanly but the entire notehead
  configuration (shapes, colors, hollow, attachments — all of Sections A
  and C) is silently ignored. The engine's `cnb/config.ly` defaults
  `cnb:use-procedure-model` to `#f` (vector model), and Section B never
  flips it. Render shows default engine noteheads, all black, default size.
- **Evidence:** as-generated harvest — 57/57 noteheads
  `rgb(0,0,0)`, bbox.h 1.75 (engine default) vs golden 2.33; adding the
  single line produces correct kite shapes/colors.
- **Root cause / owner:** **this repo**, `cnb/src/cnb-lilypond.js`
  `sectionB()`. Contributing factor: CNB-LY-EXPORT-SPEC-v1.2 never
  mentions the flag (§5 / Appendix A) — the spec was written as if the
  procedure model were already the engine's only model, but the engine
  (the stable side) still defaults to the vector model. The reference
  config `Kite-4-369-Notation-Procedure.ly` sets it explicitly (line 54).
- **Fix (session 2):** always emit `#(set! cnb:use-procedure-model #t)` in
  Section B (B1 staff-geometry block or a dedicated block before it) —
  every Configurator export is procedure-model by construction. Update the
  LY spec's §5.1 "Always Emitted" table (coordinate with the engine repo,
  which owns the spec's companion engine docs).

### D2 — `cnb:staff-line-positions` emitted in the wrong unit (factor of 2) — MAJOR

- **Symptom:** staff renders at half its intended height (harvest:
  staff_height 5.25 vs golden 10.5; extra ledger lines appear). For the
  Kite 3-6-9 system the exporter emits `'(-3 -2 -1 1 2 3)` where the
  engine needs `'(-6 -4 -2 2 4 6)`.
- **Root cause / owner:** **this repo**, `cnb/src/cnb-lilypond.js`
  `computeStaffLinePositions()`: it implements the Architecture Plan §4.3
  formula `(S − midpoint) / semitonesPerStaffSpace`, which yields
  **staff-space** units. The engine consumes LilyPond staff-position
  units, which are **half** staff-spaces (engine `cnb/config.ly`: "Staff
  line positions, in half-staff-spaces from the center"). The LY spec
  §5.1 example is consistent with the engine (sps 3 → `'(-6 -4 -2 2 4 6)`);
  the Architecture Plan §4.3 example (`4-8 → [-2, -1, 1, 2]`) is the
  erroneous document.
- **Fix (session 2):** `lyPosition = 2 × (S − midpoint) / sps`, update the
  exporter unit tests' expected values, and correct the Architecture Plan
  §4.3 conversion example (and its Appendix A mirror if present).

### D3 — Path-hash difference on runtime-rotated shapes (`-0.0000` vs `0`) — COSMETIC, no fix required

- **Symptom:** with D1+D2 patched, 21/57 noteheads differ *only* in
  `visual.path_hash` — exactly the kite-**down** pitch classes present in
  the D-major music (E=4, G=7, B=11).
- **Root cause:** the golden config computes kite-down at render time via
  `(cnb:rotate-path … 180)`; rotating x=0 by 180° produces IEEE negative
  zero, which LilyPond prints as `-0.0000`. The Configurator ships clean
  pre-baked coordinates. Raw SVG path data for the same notehead:
  - golden: `M-0.0000 0.6667L-0.6667 0.3333L0.0000 -0.6667L0.6667 0.3333L-0.0000 0.6667z`
  - ours:  `M0 0.6667L-0.6667 0.3333L0 -0.6667L0.6667 0.3333L0 0.6667z`
  Identical geometry; textual difference only. All same-shape-consistency
  assertions in the golden spec pass on both renders.
- **Disposition:** not a defect — the pre-baked path is the cleaner of the
  two. Noted for the engine repo's test tooling: any future cross-config
  path-hash comparison should normalize `-0` before hashing.

### E1 — (Engine repo) `tests/joy-to-the-world.ly` references renamed colors — coordination item, engine owns

- The golden spec's `input_file` resolves to `tests/joy-to-the-world.ly`
  (old vector-model score), which fails to compile: `Unbound variable:
  cnb:rose` — `cnb/colors.ly` has since renamed the palette to
  `cnb:1-rose` etc. The engine repo's golden suite is unrunnable as
  checked in; this session ran the assertions by pointing the spec at the
  top-level procedure-model `joy-to-the-world.ly` (74/74) and at the
  Configurator render (74/74). Surface to the engine repo's session
  rather than fixing here (per the project plan's "coordinate, don't
  duplicate" warning).

---

## Verified equivalences (differences that are NOT defects)

| Configurator export | Golden Kite config | Why equivalent |
|---|---|---|
| `(repeat . #t)` emitted explicitly in every clause | field omitted | engine `procedure.ly` defaults `repeat` to `#t` when absent |
| `cnb:multinote-padding` omitted | set explicitly to `-.5` | golden's explicit value equals the engine default; exporter emit-if-changed omits at-default values by design (spec §5.2) |
| Per-shape attachments `kite-up-attach` / `kite-down-attach` (identical point sets) | one shared `'center-top` | both register the same 4-point values; Section C references resolve identically |
| Colors baked as `skyblue-50b4e9` etc. + CB-safe conditional block | named indirection (`kite-color-primary`) overridden at score level | same final hexes; the fixture bakes the golden score's overrides, per spec v1.2 §4.5 design |
| Both CB branches register identical hexes | n/a | fixture *is* the CB-safe palette — identity mapping per spec §4.5 |
| 12 single-PC `cond` clauses | arithmetic on mod 3/4/2 | same (semitone → config) mapping for every pitch class; verified across all 57 rendered notes |

## Reproduction (for session 2 re-runs)

```bash
# 1. export (headless; or run cnb/uat/uat-kite-pipeline.mjs for the UI path)
node cnb/fixtures/export-kite-4-369.mjs <workdir>/kite-4-369-from-configurator.ly
# 2. copy cnb/fixtures/joy-to-the-world-configurator.ly next to it
# 3. render from the engine repo root
cd d:/Projects/lilypond-chromatic-notation-base
lilypond -dbackend=svg -I <workdir> -o <workdir>/out <workdir>/joy-to-the-world-configurator.ly
# 4. reference render
lilypond -dbackend=svg -o <workdir>/golden joy-to-the-world.ly
# 5. structural diff: tools/harvest_svg.py on both SVGs; assertion suite:
#    copy tests/joy-to-the-world.json, point input_file at the round-trip
#    score, run: PYTHONIOENCODING=utf-8 python tools/run_tests.py <spec>
```

Session-1 artifacts (scratchpad, regenerable from the checked-in fixtures):
as-generated/patched/golden SVGs + harvests, UI-export download
(byte-identical to the headless export), UAT screenshots.

## Session 2 fix list

1. `cnb-lilypond.js` `sectionB()`: emit `#(set! cnb:use-procedure-model #t)` (D1).
2. `cnb-lilypond.js` `computeStaffLinePositions()`: multiply by 2 (D2);
   update affected unit tests in `cnb/tests/cnb-lilypond-tests.js`.
3. `docs/CNB-ARCHITECTURE-PLAN-v2.md` §4.3: correct the conversion formula
   and example (D2 root cause).
4. Coordinate with the engine repo: LY spec §5.1 table addition (D1), the
   stale `tests/joy-to-the-world.ly` (E1), and the `-0` hash-normalization
   note (D3).
5. Re-run the full round-trip (both export paths) and confirm 74/74 with
   **zero** hand patches; that re-diff is the set's UAT pass.
