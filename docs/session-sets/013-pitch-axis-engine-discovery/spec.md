# Pitch-axis (I2 relaxation) — engine discovery & design front end

> **Purpose:** Decide whether the platform can support **compact / non-uniform
> vertical pitch axes** — different pitches at the same vertical position, or at
> non-semitone spacings — and, if so, design the config schema and export format
> for it. This is the **front end** of a prospective compact-staff program: it
> runs the engine-first go/no-go spike and produces the design, but implements
> no product code. Implementation is deferred to a later, separate set that is
> **contingent on this set's GO recommendation**.
> **Session Set:** `docs/session-sets/013-pitch-axis-engine-discovery/`
> **Created:** 2026-07-10
> **Workflow:** full
> **Prerequisite:** `012-notation-builder-playbook` complete (closes the
> expansion program; this set opens a new, separate line of work).
> **Design inputs (authoritative):** the cross-provider design consult
> [`docs/planning/pitch-axis-design-consult.md`](../../planning/pitch-axis-design-consult.md)
> and GPT's verbatim recommendation
> [`docs/planning/pitch-axis-design-recommendation.md`](../../planning/pitch-axis-design-recommendation.md);
> the invariant being relaxed is **I2** in the
> [feasibility matrix](../../research/gallery-survey/feasibility-matrix.md) §1
> (compact-staff family, records 32–40, ~9 systems).

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # the operator signs off the go/no-go and the design before any implementation set is authorized
requiresE2E: false                     # no product code to drive with Playwright; session 1 renders the real engine as a discovery spike, not an app E2E
uatScope: per-set                      # one review pass at session 2 covering the go/no-go finding and the design
uatStyle: ad-hoc                       # operator review of a decision + design docs, not a browser DSL flow
verificationMode: out-of-band-or-none  # Lightweight only; inert on Full
totalSessions: 2
prerequisites:
  - slug: 012-notation-builder-playbook
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch, defined once in the
> SSoT — not restated here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: this set makes one high-stakes, falsifiable claim — *the CNB engine
> can (or cannot) place noteheads/stems/ledgers from an arbitrary
> semitone→staff-position map without a large engraver rewrite* — and designs a
> schema/export change around the answer. A cross-provider verifier checking
> that claim against the actual engine render and the design against the schema
> is the right reviewer.

> **Scope note — lifecycle records (explicit exemption; carried forward at
> authoring time from set 007's spec, where the precedent was established at
> the verifier's request in set 006):** each session's **Touches** line
> scopes the session's *product* changes only. The Dabbler session lifecycle
> additionally writes this set's own runtime records under
> `docs/session-sets/013-pitch-axis-engine-discovery/` —
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

The gallery survey (set 008) found the compact-staff family — two chromatic
neighbors sharing a vertical position, disambiguated by notehead shape and/or
side of the line — to be the single largest structurally-out-of-scope lineage
(invariant **I2**, ~9 systems: Twinline, TwinNote, Bilinear and kin). Set 012's
playbook framed the Tier-4 verdicts as a *prioritized capability roadmap*, and
the operator has recorded standing interest in eventually supporting this
family. Two independent architects (GPT-5-4, Gemini-Pro), briefed identically,
converged on a design (the design-consult doc above). The decisive, and
riskiest, element of that design is an **engine dependency**: the CNB engine's
staff model is a single linear scalar (`cnb:semitones-per-staff-space`) with no
concept of a non-linear or many-to-one pitch axis, and — unlike clefs (009) and
key signatures (010), where a preview-only feature is merely *incomplete* — a
compact-staff config exported through the linear engine engraves at the **wrong
pitch positions**, which is actively wrong. Both architects therefore reject a
preview-only path and require the engine capability to exist first.

This set resolves that dependency and designs around the answer. It does **not**
build the feature.

**Binding rules:**

1. **Engine-first go/no-go decides everything.** Session 1 must reach a
   defensible GO or NO-GO on whether the CNB engine can place noteheads, stems,
   and ledgers from an arbitrary semitone→staff-position procedure (the proposed
   `cnb:get-pitch-staff-position` hook, or equivalent), evidenced by an **actual
   engine render** of a hand-authored compact-axis proof, not by argument. A
   NO-GO with evidence is a complete, valid outcome for this set.
2. **No product code, no engine commits.** This set changes no `cnb/` source and
   commits nothing to the engine repo (`lilypond-chromatic-notation-base`). The
   engine spike is a throwaway proof rendered to observe capability; required
   engine changes are written up as a coordination record (the 009/010 pattern),
   not implemented here.
3. **Default-off byte-identical is a hard design constraint.** Every schema and
   export-format design decision must preserve the rule that a disabled
   `pitchAxis` yields byte-identical preview and `.ly` output to today (pinned by
   the Kite round-trip and export baselines). The design states *how* it holds,
   per the consult (keep the literal old code path when disabled).
4. **The design follows the consult, deviations named.** The explicit
   pitch-class→position map, the axis-gatekeeper grid with a many-to-one inverse,
   the notehead-rule `xOffsetStaffSpaces` disambiguation field, and the
   ledger-in-axis-coordinates reframing are the agreed design; any departure from
   the design-consult synthesis is called out with its reason.

**Non-goals:** no grid rewrite; no `pitchAxis` schema implementation; no
exporter changes; no engine-repo commits; no new gallery fixtures beyond a
throwaway engine-spike proof; no amendment of the canonical
`CNB-ARCHITECTURE-PLAN` / `CNB-LY-EXPORT-SPEC` (the export-format design is
produced as a **v1.3 draft**, to be adopted into the canonical spec by the
implementation set only if this set returns GO).

---

## Sessions

### Session 1 of 2: Engine capability discovery & spike (the go/no-go)

**Goal:** a defensible GO / NO-GO on the engine's ability to render a
compact / non-uniform pitch axis, evidenced by a real engine render, plus a
coordination record naming the minimal engine change required.

**Steps:**
1. Study the engine's current placement model in
   `lilypond-chromatic-notation-base` (LilyPond 2.24.2): how
   `cnb:semitones-per-staff-space`, `cnb:staff-line-positions`, and the
   procedure-model notehead config drive vertical placement of noteheads,
   stems, ledgers, and collisions; identify exactly where a non-linear /
   many-to-one pitch→position map would have to intervene.
2. Hand-author a **throwaway proof** `.ly` that attempts to typeset a simple
   compact-axis scale (e.g. a Twinline-like 7-position octave holding 12
   pitches, two neighbors sharing a position, disambiguated by notehead shape +
   a horizontal side offset). Render it through the real engine
   (`lilypond -dbackend=svg`) and **measure the SVG** to observe whether the
   engine can be coerced into off-linear-axis placement, and what breaks
   (stems, ledgers, collisions).
3. Determine the **minimal engine hook** that would make it clean — evaluate the
   consult's proposed `cnb:get-pitch-staff-position (lambda (semitone) …)`
   returning half-staff-spaces against what the render shows — and whether it is
   a bounded addition or requires a large engraver rewrite (the consult's STOP
   condition).
4. Write the **engine-capability discovery + coordination record** with a clear
   GO / NO-GO recommendation and, on GO, the specific engine-repo work item(s);
   on NO-GO, the evidence and what it would take to change the answer. Mirror the
   set-009/010 `sN-engine-coordination.md` coordination-record shape.

**Creates:** `docs/session-sets/013-pitch-axis-engine-discovery/s1-engine-coordination.md`
(the discovery + coordination record, including the rendered-proof evidence and
the go/no-go). The throwaway proof `.ly` and its render live under the
scratchpad / the record's evidence, not as a checked-in product fixture.

**Touches:** none outside the session-set directory — this session renders an
external engine for discovery and writes a record; it changes no `cnb/` source
and commits nothing to the engine repo.

**Ends with:** a GO or NO-GO recommendation backed by a real engine render, and
the named engine change (on GO) or the blocking evidence (on NO-GO).

**Progress keys:** `session-001/engine-placement-study`, `session-001/spike-and-go-no-go`

---

### Session 2 of 2: Config-schema & export-format design, and operator sign-off

**Goal:** the compact-staff **design** (config schema + export format + the
implementation-program plan), and the operator's go/no-go decision on record.

**Steps:**
1. Design the **`pitchAxis` config section** per the consult: an explicit,
   versioned pitch-class→position map with an octave stride and an
   `axisUnitsPerStaffSpace` unit contract; the exact absent/disabled degeneracy
   to today's linear behavior; and Module A validation rules (including
   rejecting conflicting style overrides for ledger templates that collapse onto
   one axis position). Written as a **design specification**, not code.
2. Design the **grid / coordinate contract**: the axis-gatekeeper API
   (`positionOfSemi` / `regionOfSemi` / `distance`), semitone-as-identity vs
   axis-position-as-geometry, and the many-to-one **inverse-returns-candidates**
   contract; enumerate the consumer modules (staff, ledger-set, double-notehead,
   stem, card/collection) and the precise change each needs.
3. Design the **disambiguation field**: the notehead-rule `xOffsetStaffSpaces`
   resolved property (staff-space units), its preview consequences
   (per-note X offsets in double-notehead layout; stem attachment moving with
   the offset notehead), and its export surface.
4. Draft **export-format v1.3**: the additions for `pitchAxis` and the
   `(x-offset . N)` Section-C field, with the emit-only-when-enabled / missing =
   current-behavior rule that preserves byte-identical output today, aligned to
   session 1's engine hook. Produced as a **draft** alongside — not replacing —
   `CNB-LY-EXPORT-SPEC-v1_2.md`.
5. Write the **implementation-program plan**: the phased breakdown (export spec →
   grid+CNBPitchAxis → consumer rethread → compact fixtures → UI presets →
   feasibility-matrix re-tier), the highest risks, and the explicit recommendation
   to authorize (or not) a subsequent implementation set — gated on session 1's
   GO.
6. UAT (per `uatScope: per-set`, `requiresUAT: true`): the operator reviews the
   go/no-go finding and the design and approves the path (proceed to an
   implementation set / revise / stop). Record the verbatim decision in
   `s2-uat.md` (attestation before verification round 1).
7. As the final session, write `change-log.md` per the shared close-out gate.

**Creates:** `docs/planning/pitch-axis-design.md` (the consolidated schema +
grid + disambiguation + export design and the implementation-program plan),
`docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md` (the export-format draft),
`change-log.md`.

**Touches:** none outside `docs/planning/` and the session-set directory — this
session produces design documents; it amends no canonical spec and changes no
`cnb/` source.

**Ends with:** a complete, consult-grounded compact-staff design and a recorded
operator decision on whether to authorize the implementation set.

**Progress keys:** `session-002/schema-and-export-design`, `session-002/program-plan-and-operator-review`

---

## End-of-set deliverables

- `s1-engine-coordination.md` — engine-capability discovery with a
  render-evidenced GO / NO-GO and the named engine change.
- `docs/planning/pitch-axis-design.md` — the config-schema, grid, disambiguation,
  and implementation-program design (consult-grounded).
- `docs/planning/CNB-LY-EXPORT-SPEC-v1_3-draft.md` — the export-format draft.
- Operator decision on record authorizing (or not) a subsequent implementation
  set. **No product code is written in this set** — it is the go/no-go + design
  front end only.
