# Change log — set 008: Gallery survey and feasibility matrix

**Set:** `008-gallery-survey-and-feasibility` (2 sessions, tier: full)
**Completed:** 2026-07-06

## What this set produced

All deliverables live under `docs/research/gallery-survey/`. No product
code (`cnb/`) was touched — this was a research/documentation set, per
the spec's non-goals.

### Session 1 — Harvest and characterize (VERIFIED, 2 rounds)

- `schema.md` — fixed characterization record schema: identity/citation,
  staff (orientation, pitch axis, interval structure, lines/octave,
  `semitonePattern` equivalent, line variations, compactness), ledgers,
  noteheads (shape/fill/color/internal glyphs), auxiliary devices (clef,
  key signature, octave markers, accidentals), duration representation.
  Every categorical attribute has a closed value set plus `unknown`;
  `unknown` over guessing is binding.
- `index.md` — enumeration of the gallery at survey time: **54 systems in
  10 categories**, extracted from the gallery page's raw HTML (name,
  creator, year, category, detail URL per entry).
- `catalog.md` — **55 characterization records** (one per index entry
  plus the supplementary out-of-gallery Dodeka record S1), each
  schema-conformant, with `unknown` wherever the gallery image and
  detail-page text did not support a confident value.

### Session 2 — Feasibility matrix and enhancement requirements

- `feasibility-matrix.md` — tier definitions bound to five platform
  invariants: the three spec candidates confirmed (I1 horizontal
  orientation, I2 one pitch per vertical grid position, I3 duration in
  notehead style rather than glyph geometry) plus two amendments forced
  by the evidence under the spec's confirm-or-amend instruction (I4
  per-octave staff periodicity, surfaced by the human UAT round on
  Note for Note; I5 absolute pitch anchoring, Thumline's movable-Do
  axis), each grounded in an architectural test, not prevalence. Every
  record carries a verdict with justification keyed to catalog enums
  and uniform method rules M1–M6. Final classification: **21 Tier 1
  (8 firm / 13 provisional), 12 Tier 2 (8/4), 1 Tier 3 (provisional),
  21 Tier 4** — provisional flags name their load-bearing unknown (16
  of 18 are `duration.representation = unknown`, an artifact of the
  gallery's single-duration scale images). Feed-forward lists scope set
  011: 8 firm Tier-1 reproduction targets (session 1); 8 firm Tier-2
  plus 1 documented Tier-3 partial (session 2). §7 records constraints
  evidence for set 012.
- `enhancement-requirements.md` — the scope authority for sets 009/010:
  E1 custom clefs / register devices (9 Tier-2 drivers → set 009),
  E2 custom key signatures (3 drivers → set 010), E3 custom
  stem/duration marks (4 drivers; cataloged, recommended as a future
  set), E4 custom accidental marks (3 drivers; recommended to ride with
  set 010). Each entry carries prevalence tables, a
  config/preview/exporter/engine requirements sketch, and the binding
  default rule: **disabled ⇒ current platform output exactly.**
- Human UAT (per-set, before verification): operator reviewed 14 sampled
  systems across all 10 categories and all 4 tiers; 13 passes, 1
  correction — record 14 (Note for Note) re-tiered after the operator
  correctly observed its bounded staff (no repeating line/ledger
  sequence across octaves), which exposed the platform's
  no-staff-extent-bound behavior; verification round 1 then elevated
  that gap (and Thumline's movable-Do axis) into invariants I4/I5, and
  the operator re-attested the corrected verdicts. Sample, verbatim
  responses (both attestations), and dispositions in `s2-uat.md`.
- Machine validation: `validate-s2.mjs` cross-checks catalog ↔ matrix ↔
  requirements (record correspondence, closed tier set, count
  consistency, provisional naming, feed-forward membership, driver
  citations) — all checks passed after corrections.

## Downstream effects

- Set 009 (custom clefs) and set 010 (custom key signatures) now have
  their scope authority with prevalence evidence and the binding
  default-compatibility rule.
- Set 011 (gallery reproduction suite) has its target lists and the
  named deviation to document (record 7), plus §7 adaptation notes for
  the I4/I5 systems (records 14, 42).
- Set 012 (notation-builder playbook) has its constraints evidence,
  including the Dodeka I3 reference case, the Decher beat-compartment
  note, and the compact-staff (I2) lineage analysis.
