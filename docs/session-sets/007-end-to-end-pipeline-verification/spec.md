# End-to-end pipeline verification (shared release gate)

> **Purpose:** The same milestone as `lilypond-chromatic-notation-base`'s
> Phase D — design a notation via the full pipeline, export `.ly` from the
> new `cnb/` codebase, render it through the real engine, diff against the
> existing golden baseline, fix discrepancies, and document the full
> workflow end-to-end.
> **Session Set:** `docs/session-sets/007-end-to-end-pipeline-verification/`
> **Created:** 2026-07-04
> **Workflow:** full
> **Prerequisite:** `003-lilypond-exporter` complete (hard minimum);
> `006-config-io-export-and-preview` complete is strongly recommended so
> the full UI golden path can be exercised rather than driving the
> exporter headlessly.

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # a human must visually diff rendered output against the golden baseline
requiresE2E: suggested                  # Playwright coverage of the full golden path would help but the golden-baseline diff is the primary verification method here
uatScope: per-set                      # one UAT pass covering the full pipeline round-trip
uatStyle: ad-hoc                       # cross-repo diffing against a golden .ly/.svg baseline, not a single-repo browser DSL flow
verificationMode: out-of-band-or-none  # Lightweight only: out-of-band-or-none (default) | dedicated-sessions; inert on Full
totalSessions: 2
prerequisites:
  - slug: 003-lilypond-exporter
    condition: complete
  - slug: 006-config-io-export-and-preview
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: this is the shared release gate for the whole three-repo
> ecosystem — cross-provider verification stays on through the final,
> highest-stakes set.

---

## Project Overview

Per `docs/planning/project-plan.md` §3 "Phase 5" and §7 "Documentation
goal", this set:

1. Designs a notation system through the full pipeline: author/confirm a
   notehead shape in `inkscape-music-glyph-toolkit`, import it into this
   repo's Configurator (set 004's SVG importer), assign palette/rules (sets
   004–005), preview it (set 006), and export a `.ly` config (set 003's
   exporter via set 006's export button).
2. Renders that `.ly` file through the `lilypond-chromatic-notation-base`
   engine and diffs the result against the existing golden baseline
   (`joy-to-the-world.ly` / `.svg` in the engine repo) — coordinate with
   that repo rather than duplicating this verification work in both repos'
   Explorers, per the project plan's explicit warning.
3. Fixes any discrepancies found in either repo (most likely in this
   repo's exporter, since it's new code being compared against a
   long-working baseline).
4. Documents the full workflow end-to-end: this repo's `README.md` gets a
   "how to actually use this" walkthrough (install the Inkscape extension →
   author a shape → import it here → assign rules → export a `.ly` file →
   render it with the engine), and coordinates with the engine repo so its
   `README.md` gets the render-side half of the same walkthrough. Per the
   project plan, this doesn't need to be a separate deliverable — it's this
   set's natural documentation output.

**Non-goals:** no new rendering/UI modules — this set is verification and
fixes against already-built functionality, plus documentation.

---

## Sessions

### Session 1 of 2: Full pipeline round-trip and baseline diff

**Goal:** Produce a real `.ly` export from the new `cnb/` codebase via the
full UI golden path, render it through the engine, and diff against the
golden baseline.

**Steps:**
1. Using the assembled UI from set 006 (or, if set 006 isn't complete yet,
   driving `CNBLilypond.generate()` headlessly with a test config fixture —
   use judgment per this spec's prerequisite note), design a notation
   system that matches or closely approximates the existing golden
   baseline's notation (`joy-to-the-world.ly` in the engine repo).
2. Export the resulting `.ly` file from this repo.
3. Render it through the `lilypond-chromatic-notation-base` engine
   (coordinate with that repo/session if the engine work happens there) to
   produce an `.svg`/PDF output.
4. Diff the rendered output against the existing golden baseline
   (`joy-to-the-world.svg` or equivalent) — both visually (does it look
   right) and structurally (does the `.ly` file exercise the same engine
   code paths the baseline expects).
5. Catalog every discrepancy found, noting which repo owns the fix (most
   likely this repo's exporter, since `lilypond-chromatic-notation-base`'s
   rendering engine is the long-stable, proven side of the comparison).

**Creates:** a discrepancy catalog (can live in this session's own working
notes or directly as a checklist in this spec's session — author's
judgment), any test fixtures needed to reproduce the golden-baseline
config in the new codebase

**Touches:** none structurally — this session is diagnostic; fixes happen
in Session 2

**Ends with:** a complete, itemized list of every discrepancy between the
new codebase's `.ly` export (rendered) and the existing golden baseline,
each one attributed to a likely root cause.

**Progress keys:** `session-001/pipeline-round-trip`, `session-001/baseline-diff-catalog`

---

### Session 2 of 2: Fix discrepancies and document the workflow

**Goal:** Resolve the discrepancies found in Session 1, confirm the
pipeline round-trips cleanly, and document the end-to-end workflow.

**Steps:**
1. Fix each cataloged discrepancy in this repo's `cnb/` codebase (most
   likely `cnb/src/cnb-lilypond.js`), re-running the round-trip from
   Session 1 after each fix to confirm it's resolved without introducing a
   new one.
2. Re-run `node cnb/tests/run-tests.js` and `node legacy/run-tests.js` to
   confirm no regressions.
3. Re-diff the final `.ly` export's rendered output against the golden
   baseline — this is the UAT pass for this set (per `uatScope: per-set`
   above): confirm visual and structural equivalence.
4. Write the "how to actually use this" walkthrough in this repo's
   `README.md`: install the Inkscape extension, author a shape, import it
   into this Configurator, assign rules, export a `.ly` file, render it
   with the engine. Coordinate with the engine repo so its `README.md`
   picks up the render-side half of the same walkthrough (link between the
   two rather than duplicating the whole thing in both places).
5. As the final session in this set, follow the shared close-out gate's
   `change-log.md` requirement (per `docs/dabbler/start-here.md` Step 5),
   noting the release-gate milestone this set closes out.

**Creates:** `change-log.md`

**Touches:** `cnb/src/cnb-lilypond.js` (or wherever discrepancies were
rooted), `README.md`

**Ends with:** the new codebase's `.ly` export renders through the engine
with no discrepancies against the golden baseline; `README.md` documents
the full end-to-end workflow; `change-log.md` is written, closing out the
shared release gate for the ecosystem.

**Progress keys:** `session-002/discrepancy-fixes`, `session-002/workflow-documentation`

---

## End-of-set deliverables

- A confirmed, discrepancy-free round-trip: new `cnb/` codebase → `.ly`
  export → `lilypond-chromatic-notation-base` render → match against the
  golden baseline.
- `README.md` end-to-end usage walkthrough, coordinated with the engine
  repo's `README.md`.
- The shared cross-repo release gate is closed.
