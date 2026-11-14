# Gallery survey and feasibility matrix

> **Purpose:** Characterize every notation system in the Music Notation
> Project gallery (<https://musicnotation.org/systems/gallery/>) into a
> fixed schema, then classify each system's reproducibility on this
> platform. The resulting feasibility matrix and enhancement-requirements
> catalog are the scope authority for sets 009 (custom clefs), 010 (custom
> key signatures), 011 (gallery reproduction suite), and the evidence base
> for set 012 (notation-builder playbook).
> **Session Set:** `docs/session-sets/008-gallery-survey-and-feasibility/`
> **Created:** 2026-07-06
> **Workflow:** full
> **Prerequisite:** `007-end-to-end-pipeline-verification` complete (the
> platform's own round-trip must be proven before measuring other systems
> against it).

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # a human must spot-check characterizations and tier verdicts against the source images
requiresE2E: false                     # research/documentation set — no product code, nothing to drive with Playwright
uatScope: per-set                      # one UAT pass at session 2 covering both the records and the verdicts
uatStyle: ad-hoc                       # image-vs-record comparison, not a browser DSL flow
verificationMode: out-of-band-or-none  # Lightweight only; inert on Full
totalSessions: 2
prerequisites:
  - slug: 007-end-to-end-pipeline-verification
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: this set's outputs gate the scope of three downstream sets;
> cross-provider verification of the catalog's internal consistency and the
> matrix's reasoning is worth paying for. The visual truth of individual
> characterizations is covered by the human UAT spot-check, which the
> text-only verifier cannot perform.

> **Scope note — lifecycle records (explicit exemption; carried forward at
> authoring time from set 007's spec, where the precedent was established at
> the verifier's request in set 006):** each session's **Touches** line
> scopes the session's *product* changes only. The Dabbler session lifecycle
> additionally writes this set's own runtime records under
> `docs/session-sets/008-gallery-survey-and-feasibility/` —
> `session-state.json`, `session-events.jsonl`, `activity-log.json`,
> per-session working notes, `sN-uat.md`, `sN-verification.md` (and
> `sN-issues.json` when a round finds issues), `disposition.json`, and
> `change-log.md` on the final session — as the workflow SSoT describes
> ("Runtime artifacts such as `session-state.json`, … appear as the first
> session runs") and as the shared close gate enforces
> (`check_activity_log_entry`, `working_tree_clean`, `pushed_to_remote`).
> These records are **exempt from the Touches restriction** and are
> committed as docs-only commits, separate from product changes.

---

## Project Overview

Per `docs/planning/project-plan.md` §8 (expansion program), this set:

1. Enumerates the systems listed in the musicnotation.org gallery at survey
   time and characterizes each one into a fixed record schema covering
   (a) staff and ledger lines, (b) noteheads, (c) auxiliary devices (clefs,
   key signatures, octave markers), and (d) duration representation.
2. Classifies each system's reproducibility on this platform into
   feasibility tiers, identifying for each non-reproducible system which
   platform invariant it breaks.
3. Produces an enhancement-requirements catalog: which auxiliary devices
   (custom clefs, custom key signatures, and any other device that the
   survey shows to be prevalent) the platform should support, with
   prevalence counts as the justification, and with the explicit design
   constraint that every enhancement defaults to current platform behavior
   when unconfigured.

**Method notes (binding on both sessions):**

- Characterization draws on each system's gallery image and detail-page
  text. Where an attribute cannot be determined confidently from those
  sources, the record states `unknown` for that attribute — never a guess
  presented as fact.
- The survey covers every system listed in the gallery at survey time. The
  index records the harvested total and enumerates every entry, so coverage
  claims are checkable against the index rather than asserted.
- Dodeka is a known reference case for the platform's duration-encoding
  constraint. If it is not listed in the gallery, it is added as a
  supplementary record (clearly marked as out-of-gallery) so the
  feasibility matrix and the downstream playbook can cite it.
- IP posture per `docs/planning/project-plan.md` §5: records describe and
  cite each system (name, creator, source URL); they do not reproduce
  gallery images into this repo, and they make no claim of endorsement.

**Non-goals:** no product code (`cnb/`) changes; no reproduction configs
(that is set 011); no enhancement implementation (sets 009/010).

---

## Sessions

### Session 1 of 2: Harvest and characterize

**Goal:** A complete, per-system characterization catalog for the gallery,
recorded against a fixed schema.

**Steps:**
1. Define the characterization record schema in
   `docs/research/gallery-survey/schema.md`. At minimum it covers: staff
   (interval structure, lines per octave, the `staff.semitonePattern`
   equivalent where derivable, bold/dashed/heavy line variations, compact
   vs. full-height), ledger usage, notehead system (shape/hollow/color
   assignment by pitch class, glyphs or symbols inside noteheads), auxiliary
   devices (clef, key signature, octave markers, accidental treatment),
   duration representation, and source citations (detail-page URL, creator,
   year). Every attribute value set is closed (defined in the schema) plus
   `unknown`.
2. Fetch the gallery index; write
   `docs/research/gallery-survey/index.md` enumerating every listed system
   (name, creator, year, gallery category, detail-page URL) and the total
   count harvested.
3. For each system in the index, fetch its detail page and gallery image
   and write its characterization record into
   `docs/research/gallery-survey/catalog.md` (one record per system,
   following `schema.md`). Batch/parallel harvesting is acceptable; the
   deliverable is the records, not the harvesting method.
4. Add the supplementary Dodeka record if it is not a gallery entry (step
   is skipped, and the skip noted in the catalog preamble, if the gallery
   already lists it).
5. Log progress against this session's progress keys.

**Creates:** `docs/research/gallery-survey/schema.md`,
`docs/research/gallery-survey/index.md`,
`docs/research/gallery-survey/catalog.md`

**Touches:** none outside `docs/research/gallery-survey/` — this session is
research only

**Ends with:** an index whose entry count matches the gallery at survey
time, and a catalog holding one schema-conformant record for every index
entry (plus the Dodeka supplement if applicable), with `unknown` recorded
wherever the sources did not support a confident value.

**Progress keys:** `session-001/survey-schema`, `session-001/gallery-catalog`

---

### Session 2 of 2: Feasibility matrix and enhancement requirements

**Goal:** Classify every cataloged system's reproducibility on this
platform and derive the enhancement-requirements catalog that scopes sets
009–011.

**Steps:**
1. Define the feasibility tiers in
   `docs/research/gallery-survey/feasibility-matrix.md`:
   - **Tier 1 — expressible today:** current config schema covers it.
   - **Tier 2 — expressible with planned enhancements:** needs one or more
     enhancements from the requirements catalog (step 3), nothing else.
   - **Tier 3 — partially expressible:** staff/notehead core reproducible,
     one or more auxiliary devices not; the gap is named.
   - **Tier 4 — structurally out of scope:** breaks a platform invariant.
     The invariant is named. Candidate invariants (confirm or amend against
     the survey evidence): one pitch per vertical grid position (compact
     staves such as the Twinline family), duration expressed in notehead
     style rather than geometry (Dodeka), horizontal staff orientation
     (Klavar-family vertical notation).
2. Assign each catalog record a tier with a one-to-two-sentence
   justification; records with load-bearing `unknown` attributes get a
   provisional tier flagged as such.
3. Write `docs/research/gallery-survey/enhancement-requirements.md`: for
   each auxiliary device that Tier-2/Tier-3 classifications depend on
   (custom clefs and custom key signatures are expected entries; others
   only if the survey shows meaningful prevalence), record prevalence
   (which systems need it), a requirements sketch (what the config schema,
   preview, exporter, and engine coordination would each need), and the
   binding default rule: **the enhancement disabled must reproduce current
   platform output exactly**. This document is the scope authority for
   sets 009 and 010.
4. Write the feed-forward lists: which systems set 011 should reproduce in
   its session 1 (Tier 1) and session 2 (Tier 2, plus documented Tier-3
   partials), recorded in the feasibility matrix.
5. UAT (per `uatScope: per-set`, `requiresUAT: true`): a human spot-checks
   at least 10 systems — sampled across gallery categories and tiers —
   comparing catalog record and tier verdict against the source images, and
   attests the result. Record the sample, any corrections made, and the
   operator's verbatim attestation in `s2-uat.md` (attestation obtained
   before verification round 1, per the set-007 session 2 procedure).
6. As the final session in this set, write `change-log.md` per the shared
   close-out gate (`docs/dabbler/start-here.md` Step 5).

**Creates:** `docs/research/gallery-survey/feasibility-matrix.md`,
`docs/research/gallery-survey/enhancement-requirements.md`,
`change-log.md`

**Touches:** `docs/research/gallery-survey/catalog.md` (corrections found
during classification or UAT)

**Ends with:** every catalog record carries a tier verdict (or a flagged
provisional one), the enhancement-requirements catalog scopes sets 009/010
with prevalence evidence, the feed-forward lists scope set 011, and a human
has attested the spot-check.

**Progress keys:** `session-002/feasibility-matrix`, `session-002/enhancement-requirements`

---

## End-of-set deliverables

- `docs/research/gallery-survey/` — schema, index, catalog,
  feasibility matrix, enhancement-requirements catalog.
- Scope authority in place for sets 009 (clefs) and 010 (key signatures);
  reproduction target lists in place for set 011; constraints evidence in
  place for set 012's playbook.
