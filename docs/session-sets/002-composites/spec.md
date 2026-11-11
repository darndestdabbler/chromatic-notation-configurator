# Composites — Ledger Set, Double Notehead, Octave Chord Card, Card Collection

> **Purpose:** Build the composite rendering layer above Phase 2's
> primitives: ledger display-rule evaluation, octave-pair notehead
> rendering, the full octave-chord card, and the row/grid card collection.
> **Session Set:** `docs/session-sets/002-composites/`
> **Created:** 2026-07-04
> **Workflow:** full
> **Prerequisite:** `001-adopt-session-sets-and-rendering-primitives` complete

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # visual test pages for ledger sets, cards, and card collections
requiresE2E: suggested                  # module surface still stabilizing per project-plan.md — revisit once this set lands
uatScope: per-session
uatStyle: ad-hoc                       # static HTML test pages, not yet wired through the browser UI/DSL
verificationMode: out-of-band-or-none  # Lightweight only: out-of-band-or-none (default) | dedicated-sessions; inert on Full
totalSessions: 2
prerequisites:
  - slug: 001-adopt-session-sets-and-rendering-primitives
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: same as set 001 — this repo carries the release-blocking
> exporter work, and Ledger Set is flagged by the architecture plan as the
> single most complex module in the whole rewrite, so automatic
> cross-provider verification is worth the cost here.

---

## Project Overview

Per `docs/CNB-ARCHITECTURE-PLAN-v2.md` §6 "Phase 3: Composites
(Sessions 12–13)", build the four composite modules that sit between the
rendering primitives (set 001) and the LilyPond exporter (set 003):

- **Module 5 — Ledger Set** (`cnb-ledger-set.js`): the octave-aware
  proximity/override display-rule engine described in architecture plan §5.
  Flagged there as the most complex logic in the rewrite — budget real
  attention to the exhaustive test cases it lists (octave awareness, gap
  handling for non-contiguous staff patterns like 3-6-9, etc.).
- **Module 7 — Double Notehead** (`cnb-double-notehead.js`): renders an
  octave pair with horizontal offset for collision avoidance.
- **Module 9 — Octave Chord Card** (`cnb-card.js`): composes staff +
  ledgers + noteheads + stem + labels into one card.
- **Module 10 — Card Collection** (`cnb-collection.js`): lays out multiple
  cards in a row with continuous background staff lines.

Follow the architecture plan's module specs, APIs, and test cases directly
— this spec does not re-derive them.

**Non-goals:** no `.ly` export changes (set 003), no UI (sets 004–006).

---

## Sessions

### Session 1 of 2: Ledger Set, Double Notehead

**Goal:** Ship the octave-aware ledger display-rule engine and the
double-notehead renderer (Modules 5, 7).

**Steps:**
1. Build `cnb/src/cnb-ledger-set.js` (Module 5) per architecture plan §5
   "Module 5: Ledger Set" — `buildDefs()`, `resolve()` (the
   proximity/override algorithm, including `isBetweenNoteAndStaff()`), and
   `render()`.
2. Write `cnb/tests/cnb-ledger-set-tests.js` covering the architecture
   plan's exhaustive ledger test cases: C (semi 0), D (semi 2), E (on staff
   line, no ledgers), F (inside staff, no ledgers), C' under both 4-8 and
   3-6-9 patterns, C'' (upper), A♯, and the octave-awareness case (lower C
   ledger at semi 0 NOT triggered by a note at semi 24).
3. Build `cnb/test-pages/test-ledger.html` (extend or supersede the
   unconditional-ledger test page from set 001 with the display-rule-driven
   version) — a column with noteheads at various positions (on staff, in
   gaps, far outside), showing ledger resolution against the debug grid.
4. Build `cnb/src/cnb-double-notehead.js` (Module 7) per architecture plan
   §5 "Module 7: Double Notehead" — renders a pair (or quad) of noteheads
   with `offsetPercent` collision-avoidance offset.
5. Write unit test coverage for Module 7 (add to an existing test file or
   a new `cnb-double-notehead-tests.js`, following the project's
   `cnb-{module}-tests.js` naming convention).
6. Run `node cnb/tests/run-tests.js` — confirm all tests pass.

**Creates:** `cnb/src/cnb-ledger-set.js`, `cnb/tests/cnb-ledger-set-tests.js`,
`cnb/src/cnb-double-notehead.js`, `cnb/tests/cnb-double-notehead-tests.js`

**Touches:** `cnb/test-pages/test-ledger.html`

**Ends with:** `node cnb/tests/run-tests.js` passes, including the full
ledger-set exhaustive test suite; `cnb/test-pages/test-ledger.html`
correctly shows/hides ledger lines per the proximity and override rules for
both the 4-8 and 3-6-9 staff patterns.

**Progress keys:** `session-001/ledger-set-module`, `session-001/double-notehead-module`

---

### Session 2 of 2: Octave Chord Card, Card Collection

**Goal:** Compose the primitives and composites built so far into a full
octave-chord card and a row/grid card collection (Modules 9, 10).

**Steps:**
1. Build `cnb/src/cnb-card.js` (Module 9) per architecture plan §5
   "Module 9: Octave Chord Card" — composes Module 1 (grid), Module 5
   (ledger set), Module 7 (double notehead), Module 8 (stem), Module B
   (music theory), and Module A (config) into the card visual structure
   (`div.pc-col` with top/bottom labels and a `svg.note-slice`).
2. Build `cnb/src/cnb-collection.js` (Module 10) per architecture plan §5
   "Module 10: Card Collection" — lays out cards in a row/grid with a
   continuous background staff-lines SVG (per architecture plan's
   `svg.staff-lines-bg` + `div.pc-columns` structure).
3. Build `cnb/test-pages/test-card.html` and `cnb/test-pages/test-collection.html`
   — the latter rendering the full chromatic row (PCs 0–12) against the
   default 4-8 config, per architecture plan's Phase 3 deliverable table.
4. Add any remaining unit coverage the card/collection composition needs
   (resolution of notehead config through `CNBCard.resolveNotehead`, label
   rendering).
5. Run `node cnb/tests/run-tests.js` — confirm all tests (new + existing)
   pass.

**Creates:** `cnb/src/cnb-card.js`, `cnb/src/cnb-collection.js`,
`cnb/test-pages/test-card.html`, `cnb/test-pages/test-collection.html`

**Touches:** none outside `cnb/`

**Ends with:** `cnb/test-pages/test-collection.html` renders a full
chromatic row of octave-chord cards (staff, ledgers, noteheads, stems,
labels) against the default 4-8 config, matching the visual structure
described in architecture plan §5 Module 10; all tests pass.

**Progress keys:** `session-002/card-module`, `session-002/collection-module`

---

## End-of-set deliverables

- Four new `cnb/src/` composite modules (Ledger Set, Double Notehead,
  Octave Chord Card, Card Collection) with unit tests and visual test
  pages, completing `CNB-ARCHITECTURE-PLAN-v2.md`'s "Phase 3: Composites".
- A working full-chromatic-row preview (`test-collection.html`) usable as a
  manual reference for the exporter work in the next set.
- `docs/session-sets/003-lilypond-exporter/` unblocked (depends on this set).
