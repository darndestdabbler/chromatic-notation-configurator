# Adopt session-set workflow, then build rendering primitives

> **Purpose:** Retire the hand-rolled baton/checklist workflow in favor of
> Dabbler session sets, then build the next layer of `cnb/` rendering
> primitives above the already-shipped Phase 1 Foundation (Staff Line,
> Staff, Ledger Line, Notehead, Stem).
> **Session Set:** `docs/session-sets/001-adopt-session-sets-and-rendering-primitives/`
> **Created:** 2026-07-04
> **Workflow:** full
> **Prerequisite:** None

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # visual test pages exist for every rendering module in this set
requiresE2E: suggested                 # module surface still churning through Phase 2 (composites) per project-plan.md
uatScope: per-session                  # each session ships its own visual test page(s)
uatStyle: ad-hoc                       # static HTML test pages, not yet wired through the browser UI/DSL
verificationMode: out-of-band-or-none  # Lightweight only: out-of-band-or-none (default) | dedicated-sessions; inert on Full
totalSessions: 2
# prerequisites: none — this is the first session set in the repo
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: this repo is the most active, most complex of the three
> ChromaticNotationBase repos (real ground-up rewrite in progress, a browser
> UI, release-blocking exporter work) — per `docs/planning/project-plan.md`,
> automatic cross-provider verification is worth paying for here.

---

## Project Overview

Two things happen in this set, back to back:

1. **Phase 0 — workflow cutover.** `CLAUDE.md` currently instructs sessions to
   generate a baton (`docs/batons/baton-sessions-N-to-N+1.md`) and a
   verification checklist (`docs/checklists/session-N-checklist.xlsx`) at the
   end of every session. That instruction is retired in favor of this
   session-set workflow. `docs/batons/` and `docs/checklists/` stay in the
   repo as historical record of pre-Dabbler sessions — do not delete them.
2. **Phase 1 — rendering primitives.** Per `docs/CNB-ARCHITECTURE-PLAN-v2.md`
   §6 "Phase 2: Rendering Primitives (Sessions 10–11)", build the five
   modules above the Phase 1 Foundation: Staff Line (Module 2), Staff
   (Module 3), Ledger Line (Module 4), Notehead (Module 6), Stem (Module 8).
   Follow the architecture plan's module specs, APIs, and test cases
   directly — this spec does not re-derive them.

**Non-goals:** no ledger *display-rule* logic yet (that's Module 5, Ledger
Set, in the next session set — this set only ships the unconditional
Ledger Line renderer, Module 4). No UI, no `.ly` export changes.

---

## Sessions

### Session 1 of 2: Retire baton workflow; build Staff Line, Staff, Ledger Line

**Goal:** Cut the repo over to the session-set workflow, then ship the first
three Phase-2 rendering-primitive modules (Modules 2, 3, 4).

**Steps:**
1. Edit `CLAUDE.md`: remove the "Session Completion Checklist" section's
   baton/checklist-generation instructions; replace with a pointer to the
   Dabbler session-set workflow (`docs/dabbler/start-here.md`).
2. Add a short note to `README.md` (or confirm `CLAUDE.md` already covers it)
   that `docs/batons/` and `docs/checklists/` are historical records of
   pre-Dabbler sessions, not an active workflow.
3. Build `cnb/src/cnb-staff-line.js` (Module 2) per architecture plan §5
   "Module 2: Staff Line" — pure SVG element factory, no dependencies.
4. Build `cnb/src/cnb-staff.js` (Module 3) per architecture plan §5
   "Module 3: Staff" — depends on Module 1 (grid) + Module 2 + Module A
   (config). Implement `getPositions`, `render`, `getMidpoint`.
5. Build `cnb/src/cnb-ledger-line.js` (Module 4) per architecture plan §5
   "Module 4: Ledger Line" — pure SVG element factory (unconditional
   render only; no display-rule evaluation).
6. Write `cnb/tests/cnb-staff-tests.js` covering the architecture plan's
   staff test cases (4-8 pattern → `[4,8,16,20]`, 3-6-9 pattern →
   `[3,6,9,15,18,21]`, line overrides, thickness-from-pct conversion).
7. Build `cnb/test-pages/test-staff.html` and `cnb/test-pages/test-ledger.html`
   — visual test pages with the debug grid overlay visible, default 4-8
   config.
8. Run `node cnb/tests/run-tests.js` — confirm all new and existing tests
   pass; confirm `node legacy/run-tests.js` still passes untouched.

**Creates:** `cnb/src/cnb-staff-line.js`, `cnb/src/cnb-staff.js`,
`cnb/src/cnb-ledger-line.js`, `cnb/tests/cnb-staff-tests.js`,
`cnb/test-pages/test-staff.html`, `cnb/test-pages/test-ledger.html`

**Touches:** `CLAUDE.md`, `README.md`

**Ends with:** `node cnb/tests/run-tests.js` passes with the new staff test
suite included; `cnb/test-pages/test-staff.html` renders a 4-8 staff with
correct line positions over the debug grid; `CLAUDE.md` no longer instructs
new baton/checklist generation.

**Progress keys:** `session-001/workflow-cutover`, `session-001/staff-line-module`, `session-001/staff-module`, `session-001/ledger-line-module`

---

### Session 2 of 2: Build Notehead, Stem

**Goal:** Ship the remaining two Phase-2 rendering-primitive modules
(Modules 6, 8), completing the architecture plan's "Rendering Primitives"
phase.

**Steps:**
1. Build `cnb/src/cnb-notehead.js` (Module 6) per architecture plan §5
   "Module 6: Notehead" — `measure()` and `render()`, reading shape config
   from `config.shapes[name]` (Module A's schema, already shipped).
2. Build `cnb/src/cnb-stem.js` (Module 8) per architecture plan §5
   "Module 8: Stem" — `direction()`, `geometry()` using the 4-point anchor
   model (crotchetUp/Down, minimUp/Down), `render()`.
3. Write `cnb/tests/cnb-notehead-tests.js` and `cnb/tests/cnb-stem-tests.js`
   covering the architecture plan's listed test cases (stem up/down side and
   extension direction, stemless shape → `null`, crotchet vs. minim anchor
   selection, thickness computed from `stemThicknessPct`).
4. Build `cnb/test-pages/test-notehead.html` and `cnb/test-pages/test-stem.html`
   visual test pages, using the default 4-8 config's `crotchet-minim` shape.
5. Run `node cnb/tests/run-tests.js` — confirm all tests (new + existing)
   pass.

**Creates:** `cnb/src/cnb-notehead.js`, `cnb/src/cnb-stem.js`,
`cnb/tests/cnb-notehead-tests.js`, `cnb/tests/cnb-stem-tests.js`,
`cnb/test-pages/test-notehead.html`, `cnb/test-pages/test-stem.html`

**Touches:** none outside `cnb/`

**Ends with:** `node cnb/tests/run-tests.js` passes with notehead and stem
test suites included; `cnb/test-pages/test-notehead.html` and
`cnb/test-pages/test-stem.html` render correctly against the debug grid,
including a visual check that stem attachment points line up with the
notehead's 4-point anchors.

**Progress keys:** `session-002/notehead-module`, `session-002/stem-module`

---

## End-of-set deliverables

- `CLAUDE.md` updated to point at the Dabbler session-set workflow; no more
  baton/checklist generation instructions.
- Five new `cnb/src/` modules (Staff Line, Staff, Ledger Line, Notehead,
  Stem) with unit tests and visual test pages, completing
  `CNB-ARCHITECTURE-PLAN-v2.md`'s "Phase 2: Rendering Primitives".
- `docs/session-sets/002-composites/` unblocked (depends on this set).
