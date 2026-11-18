# Mechanic log

Entries by the Mechanic (`dabbler consult --mechanic`), newest last. Each
says what was found, what was done and why, and nothing is committed here:
the framework lands the change with the session's diff.

## 2026-11-10 — Session 44, step `roundtrip`

**Found.** No framework stop stood. The session was in its work phase with
the `roundtrip` step owed by the author since 12:18, about four and a half
hours. That step waits on the engine repository's session 25 ("The breve as
tied semibreves"), which had not landed when the author reached it; the
author stopped without reporting the step blocked. The operator then landed
engine session 25 (engine tag v1.3.0, handoff
`docs/session-sets/025-breve-tied-semibreves/configurator-handoff.md`). With
that engine beside this repository the whole suite passes, 1168 tests, and
the repeat-mode engine test now measures the breve as the author's test
anticipated. The tree needed no fix.

**Done.** One plan amendment, no file edits besides this log:

- `dabbler session plan amend --step roundtrip --files
  cnb/src/cnb-card.js,cnb/tests/cnb-card-tests.js`. The engine handoff
  (§1, "Flag") records that the tie engraves black whatever the notehead's
  colour, while the preview draws it in the notehead's colour and a card
  test asserts that. The project's rule is to fix a preview-versus-engraving
  difference, so the `roundtrip` step should also draw the tie black, and it
  declared only the test file. The amendment lets the step touch the card
  module.

**Why minimal.** The author's accepted work stands as it is. The author
resumes with `dabbler session next`, which re-issues the owed instruction;
the step's measurements, the tie's colour and the baselines are the
author's to do and report.

## 2026-11-10 — Session 44, step `fix-run-of-record` (blocked)

**Found.** The run of record's UAT fix is done (`npm run uat` 18/18, unit
suite 1168 pass). The step is blocked only by the check the ACCEPTED step
`engine-session` declared, which the run of record runs again: it reads the
engine repository's `docs/sessions/session-plan.md` and requires the
heading `### Session 26: Release 1.3.0`. When the engine landed its session
25 it inserted `### Session 26: Document 1.3.0` and released as
`### Session 27: Release 1.3.0 (release: 1.3.0)` (engine tag v1.3.0). The
release the check waits for did happen; only its session number differs.
The check's other three conditions pass. Nothing in this tree is wrong, and
the first automated Mechanic attempt (17:18) did no diagnosis: its log shows
it failed on an expired login.

**Done.** Nothing in the tree besides this entry. With the operator's
agreement the Mechanic ran the framework's own remedy for a stale check,
`dabbler session plan amend --step engine-session --checks-file …`, with
the one condition loosened to `### Session \d+: Release 1\.3\.0` (the other
three unchanged; the loosened check passes by hand). The router (3.29.1)
refused it: "step 'engine-session' has already been accepted; its report
was measured against the step as it stood, and amending it now would move
that bar afterwards". The rule is deliberate in the framework's source
(`packages/router/src/driver.ts`, `amendPlanStep`), yet the framework's own
rejection and fix-phase texts name that amendment as the way past "a check
an earlier step declared that your fix outgrows". The two disagree, and the
fix belongs to the framework, an installed package here. Editing the
engine's plan to carry the heading was not done: it would record a release
session that does not exist.

**Recommendation.** Fix the framework so an operator-agreed amendment of an
accepted step's checks is allowed with its reason on the record (the
amendment row keeps before, after and reason for the reviewer), install it,
run the amendment above, then `dabbler session next`. Rolling the session
back would discard accepted work for a cause outside this tree.
