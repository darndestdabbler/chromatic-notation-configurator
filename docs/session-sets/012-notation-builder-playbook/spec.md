# Notation-builder playbook and AI-assisted workflow guide

> **Purpose:** Author the operator-facing documentation for designing a
> notation system with this platform: a human playbook (platform model,
> hard constraints with evidence, step-by-step build walkthrough) and an
> AI-assistance guide (which pipeline steps AI helps with, prompt
> templates, verification and human sign-off points). Capability and
> constraint claims are grounded in set 008's feasibility matrix and set
> 011's reproduction report rather than asserted.
> **Session Set:** `docs/session-sets/012-notation-builder-playbook/`
> **Created:** 2026-07-06
> **Workflow:** full
> **Prerequisite:** `011-gallery-reproduction-suite` complete (the playbook
> cites its fidelity evidence; the survey docs arrive transitively via
> 011's own prerequisites).

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # the human operator must review and approve the playbook — they are its audience
requiresE2E: false                     # documentation set — no product code, nothing to drive with Playwright
uatScope: per-set                      # one review pass at session 2 covering both documents
uatStyle: ad-hoc                       # operator document review, not a browser DSL flow
verificationMode: out-of-band-or-none  # Lightweight only; inert on Full
totalSessions: 2
prerequisites:
  - slug: 011-gallery-reproduction-suite
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: the playbook makes falsifiable claims about what the platform
> can and cannot do; a cross-provider verifier checking those claims
> against the actual schema, code, and evidence docs is exactly the right
> reviewer for a docs set of this kind.

> **Scope note — lifecycle records (explicit exemption; carried forward at
> authoring time from set 007's spec, where the precedent was established at
> the verifier's request in set 006):** each session's **Touches** line
> scopes the session's *product* changes only. The Dabbler session lifecycle
> additionally writes this set's own runtime records under
> `docs/session-sets/012-notation-builder-playbook/` —
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

Per `docs/planning/project-plan.md` §8 (expansion program), this set closes
the program with two documents under `docs/playbook/`:

1. **`docs/playbook/notation-builder-playbook.md`** — for a human operator
   designing a notation system with the platform.
2. **`docs/playbook/ai-assisted-workflow.md`** — for an operator using an
   AI assistant at specific steps of that same workflow.

**Binding rules:**

1. **Claims carry citations.** Every "the platform can X" claim cites the
   config schema, a module, or a set-011 fixture; every "the platform
   cannot X" claim cites the invariant in the feasibility matrix and a
   named exemplar system (Dodeka for duration-in-geometry, the Twinline
   family for compact staves, Klavar for vertical orientation — as
   confirmed or amended by set 008's evidence).
2. **Constraints are stated as invariants, not as a list of banned
   systems.** The named systems are exemplars of an invariant, not the
   definition of the limit.
3. **IP posture carries through** (`docs/planning/project-plan.md` §5):
   named-system references use the attribution and "inspired by" framing
   rules; the playbook itself reminds operators of the same rules when
   they set out to reproduce a published system.
4. **The walkthrough is executable.** Its steps reference the real UI and
   file paths as they exist after set 011, and its worked example is a
   fixture from `cnb/assets/examples/gallery/` — so following the
   walkthrough can be literally performed, not just read.

**Non-goals:** no product code changes; no new fixtures; no restructuring
of existing docs beyond the linkage edits named in session 2.

---

## Sessions

### Session 1 of 2: The human operator playbook

**Goal:** `docs/playbook/notation-builder-playbook.md`, complete and
evidence-cited.

**Steps:**
1. Write the platform-model section: the two-input principle (config vs.
   example data), the semitone grid, staff patterns, ledger templates,
   cumulative notehead rules, palettes and CB-safe switching, duration
   representation modes, clefs (set 009) and key signatures (set 010),
   and the JSON-config/LilyPond-export relationship.
2. Write the constraints section per binding rules 1–2: each invariant,
   its exemplar systems, and what the operator should do when their design
   idea hits one (redesign options, or recognition that the platform is
   the wrong tool for that design).
3. Write the capability summary from the set-008/011 evidence: how much of
   the published-systems gallery the platform reproduces, at which tiers,
   citing the feasibility matrix and reproduction report.
4. Write the build walkthrough, ordered by config composition: staff
   pattern → midpoint/stem direction → ledger templates → shape authoring
   and import (glyph toolkit contract) → notehead rules → palette →
   durations → clef/key signature (optional) → validate → preview → save
   JSON → export `.ly` → render through the engine (linking the README
   round-trip walkthrough from set 007 rather than duplicating it). Use
   one set-011 fixture as the worked example throughout.
5. Write the troubleshooting section from failure modes actually
   encountered in sets 001–011 (validation errors and their meanings,
   common rule-priority mistakes, hollow-on-nonwhite-background limitation,
   stem-anchor/thickness consistency).

**Creates:** `docs/playbook/notation-builder-playbook.md`

**Touches:** none outside `docs/playbook/` — this session is documentation
only

**Ends with:** a complete playbook whose capability and constraint claims
each carry their citation, and whose walkthrough references only real,
current UI and paths.

**Progress keys:** `session-001/platform-model-and-constraints`, `session-001/build-walkthrough`

---

### Session 2 of 2: AI-assisted workflow guide, linkage, and operator review

**Goal:** `docs/playbook/ai-assisted-workflow.md`, cross-linking, and the
operator's approval of both documents.

**Steps:**
1. Write the pipeline map: each walkthrough step from session 1 annotated
   with whether AI assistance is high-value (characterizing an existing
   system from its image/description into a draft config; translating
   prose rules into `noteheadRules` JSON; drafting SVG path geometry and
   toolkit `data-*` attributes; running the export-render-diff
   verification loop), lower-value, or reserved to the human (aesthetic
   design decisions, final visual sign-off — mirroring this repo's own
   UAT discipline).
2. Write prompt templates for the high-value steps, each embedding the
   relevant schema excerpt or doc pointer, with expected-output notes and
   a verification instruction (what the operator checks before trusting
   the output — validator run, test page, round-trip diff).
3. Write the cautions section: AI-drafted configs must pass
   `CNBConfig.validate()` and be visually reviewed; anchor points need
   visual verification on the test pages; never let an AI guess values it
   cannot derive (record unknowns and ask), matching the platform's own
   validation philosophy.
4. Cross-link: add a "Designing a notation system" pointer to
   `README.md` referencing both playbook documents, and a pointer from
   `docs/playbook/notation-builder-playbook.md` to the AI guide.
5. UAT (per `uatScope: per-set`, `requiresUAT: true`): the human operator
   reviews both documents as their intended audience and approves or
   requests changes; iterate until approved. Record requested changes and
   the operator's verbatim approval in `s2-uat.md` (attestation before
   verification round 1).
6. As the final session in this set, write `change-log.md` per the shared
   close-out gate (`docs/dabbler/start-here.md` Step 5), noting it closes
   the expansion program.

**Creates:** `docs/playbook/ai-assisted-workflow.md`, `change-log.md`

**Touches:** `docs/playbook/notation-builder-playbook.md` (cross-link and
review-driven edits), `README.md` (pointer section only)

**Ends with:** both playbook documents complete, cross-linked from the
README, and approved by the human operator on record.

**Progress keys:** `session-002/ai-workflow-guide`, `session-002/linkage-and-operator-review`

---

## End-of-set deliverables

- `docs/playbook/notation-builder-playbook.md` — evidence-cited operator
  playbook with an executable walkthrough.
- `docs/playbook/ai-assisted-workflow.md` — AI-assistance pipeline map,
  prompt templates, and cautions.
- README linkage; the expansion program (sets 008–012) closed out.
