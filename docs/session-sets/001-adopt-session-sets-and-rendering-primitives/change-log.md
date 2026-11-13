# Change log — 001-adopt-session-sets-and-rendering-primitives

**Set completed:** 2026-07-04 · 2 sessions · tier: full (cross-provider verification via gpt-5-4)

## What this set changed

### Phase 0 — workflow cutover (session 1)

- `CLAUDE.md` / `README.md`: retired the hand-rolled baton/checklist workflow
  in favor of Dabbler session sets (`docs/dabbler/start-here.md`).
  `docs/batons/` and `docs/checklists/` kept as historical record.
- Committed the Dabbler scaffold (`.dabbler/`, `docs/dabbler/`,
  `docs/planning/`, session-set specs 001–007, `ai_router/budget.yaml`,
  `.gitignore`, engine files `AGENTS.md`/`GEMINI.md`).

### Phase 1 — rendering primitives (both sessions)

An important discovery reframed the set: pre-Dabbler Session 9 (commit
`c9ea41e`) had already built all five Phase-2 modules the spec said to
"build". Both sessions therefore ran as **audits of the Session-9 code**
against `CNB-ARCHITECTURE-PLAN-v2.md` §5, fixing real defects:

- **Session 1 (Modules 2/3/4 — Staff Line, Staff, Ledger Line):**
  - Fixed `cnb-ledger-line.js` rounded-rect defect: the ledger body was
    drawn as a hollow outline at ~2× thickness instead of a filled rect.
  - Repaired corrupted `test-staff.html` (scrambled script after `</html>`).
  - Created missing `test-ledger.html`; added spec-required
    thickness-from-pct conversion tests to `cnb-staff-tests.js`.
- **Session 2 (Modules 6/8 — Notehead, Stem):**
  - Fixed `cnb-stem.js` `geometry()`: it computed the 4-point anchor's y
    offset but never applied it, attaching stems at the notehead's vertical
    center instead of the anchor point (visibly wrong on hollow minims).
    Stems now attach at `noteY + anchor.y × scaleFactor`.
  - `cnb-notehead.js` audited clean against the plan API (no changes).
  - Expanded `cnb-stem-tests.js` 7→14 tests (crotchet-vs-minim anchor
    selection up/down, extension direction/magnitude, anchor-y attachment,
    stemless/no-anchors/missing-key null cases) and
    `cnb-notehead-tests.js` 2→6 tests (aspect ratio, linear scaling).
  - Created missing `test-stem.html` (octave chords up/down × crotchet/minim
    over the debug grid, red crosses marking each stem's attachment anchor);
    reworked `test-notehead.html` onto the debug grid (was fixed-pixel
    placement with no grid).

## End state

- `node cnb/tests/run-tests.js`: **135 passed, 0 failed**
  (music, config, grid, staff, notehead, stem suites).
- `node legacy/run-tests.js`: **240/240** (untouched).
- Architecture plan "Phase 2: Rendering Primitives" complete; session set
  `002-composites` (Ledger Set, Double Notehead, Card, Collection) unblocked.

## Verification

Both sessions: cross-provider API verification routed to gpt-5-4.
Round 1 ISSUES_FOUND → remediated → round 2 VERIFIED (see
`s1-verification.md` / `s1-issues.json`, `s2-verification.md` /
`s2-issues.json`).
