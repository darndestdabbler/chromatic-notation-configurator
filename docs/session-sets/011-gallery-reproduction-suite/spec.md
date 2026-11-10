# Gallery reproduction suite

> **Purpose:** Exercise the platform against real published notation
> systems by authoring reproduction-study configs for the systems the
> set-008 feasibility matrix marked reproducible, verifying each one
> validates, previews, and exports cleanly, and recording per-system
> fidelity notes. This is both an expanded test corpus and the worked
> evidence base for set 012's playbook.
> **Session Set:** `docs/session-sets/011-gallery-reproduction-suite/`
> **Created:** 2026-07-06
> **Workflow:** full
> **Prerequisite:** `008-gallery-survey-and-feasibility` complete (target
> lists), `009-custom-clefs` and `010-custom-key-signatures` complete
> (session 2's Tier-2 systems depend on both).

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # a human must visually compare reproduction previews against the published systems
requiresE2E: suggested                 # the automated fixture-check script is the primary mechanical gate; Playwright preview capture supports the UAT
uatScope: per-session                  # each session produces reproductions a human compares before that session closes
uatStyle: ad-hoc                       # side-by-side image comparison, not a browser DSL flow
verificationMode: out-of-band-or-none  # Lightweight only; inert on Full
totalSessions: 2
prerequisites:
  - slug: 008-gallery-survey-and-feasibility
    condition: complete
  - slug: 009-custom-clefs
    condition: complete
  - slug: 010-custom-key-signatures
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: this set makes checkable per-system fidelity claims that
> downstream documentation will repeat; cross-provider verification of
> those claims against the fixtures is worth paying for.

> **Scope note — lifecycle records (explicit exemption; carried forward at
> authoring time from set 007's spec, where the precedent was established at
> the verifier's request in set 006):** each session's **Touches** line
> scopes the session's *product* changes only. The Dabbler session lifecycle
> additionally writes this set's own runtime records under
> `docs/session-sets/011-gallery-reproduction-suite/` —
> `session-state.json`, `session-events.jsonl`, `activity-log.json`,
> per-session working notes, `sN-uat.md`, `sN-verification.md` (and
> `sN-issues.json` when a round finds issues), `disposition.json`, and
> `change-log.md` on the final session — as the workflow SSoT describes
> ("Runtime artifacts such as `session-state.json`, … appear as the first
> session runs") and as the shared close gate enforces
> (`check_activity_log_entry`, `working_tree_clean`, `pushed_to_remote`).
> These records are **exempt from the Touches restriction** and are
> committed as docs-only commits, separate from product code.

---

## Project Overview

Per `docs/planning/project-plan.md` §8 (expansion program), this set
authors one config fixture per target system from the feasibility matrix's
feed-forward lists (`docs/research/gallery-survey/feasibility-matrix.md`),
plus an automated check that every fixture validates, resolves noteheads
for all 12 pitch classes, and exports a `.ly` file without errors.

**Binding rules (both sessions):**

1. **Reproduction-study framing (IP; per `docs/planning/project-plan.md`
   §5, which is binding here).** Each fixture is a *study* of a published
   system built from its public description/image, attributed in the
   fixture's `meta` fields (system name, creator, source URL) and in the
   fidelity report. No code is ported from any system's own implementation
   (for Clairnote specifically: the design is CC BY-SA 4.0 but
   `clairnote.ly` is GPL v3 — study the published design, never that
   code). No fixture name or description claims the platform "generates"
   or is endorsed by the original system; "reproduction study — inspired
   by" is the required framing. Gallery images are compared against, not
   copied into the repo.
2. **Headless authoring is acceptable.** Fixtures are JSON config files;
   authoring them directly (rather than through the UI) is the expected
   method. The UI is exercised by loading fixtures through JSON load
   during UAT, not by re-authoring them.
3. **Fidelity is recorded, not overclaimed.** Each fixture's fidelity note
   states what matches the published system, what approximates it and how,
   and what is omitted. A fixture with a known visible deviation is
   acceptable if the deviation is recorded; an unrecorded deviation found
   at UAT is a defect.
4. **Fixture location:** `cnb/assets/examples/gallery/<system-slug>.json`,
   with the check script at `cnb/tests/check-gallery-examples.js` runnable
   standalone (`node cnb/tests/check-gallery-examples.js`) and registered
   with the main runner if the runner's pattern accommodates it.

**Non-goals:** no new platform features — a target system found to need
one is moved to the fidelity report's gap list (with the feasibility
matrix updated via a correction note), not implemented here; no engine-repo
changes; no gallery-image redistribution in the repo.

---

## Sessions

### Session 1 of 2: Tier-1 reproductions (expressible today)

**Goal:** A validated fixture and fidelity note for each Tier-1 target on
the feasibility matrix's session-1 feed-forward list.

**Steps:**
1. Read the feed-forward list; record the target roster (system, slug,
   source URL) at the top of
   `docs/research/gallery-survey/reproduction-report.md` so coverage is
   checkable against the list.
2. Create `cnb/tests/check-gallery-examples.js`: for every fixture under
   `cnb/assets/examples/gallery/`, assert `CNBConfig.validate()` passes,
   `resolveNotehead()` succeeds for all 12 pitch classes across the
   fixture's defined durations, and `CNBLilypond.generate()` returns
   without error.
3. Author each Tier-1 fixture from its catalog record (staff pattern,
   ledger templates, notehead rules, palette), with attribution in `meta`
   per binding rule 1.
4. Write each system's fidelity note (matches / approximations / omissions)
   into the reproduction report.
5. Capture a preview render of each fixture (the set-006/007 Playwright
   capture pattern) into a UAT package for step 6.
6. UAT (per `uatScope: per-session`, `requiresUAT: true`): a human
   compares each captured preview side-by-side with the published system's
   gallery image and attests, per system, match / acceptable-with-noted-
   deviations / defect. Record the package description, per-system
   outcomes, and the operator's verbatim attestation in `s1-uat.md`
   (attestation before verification round 1).
7. Run `node cnb/tests/run-tests.js`, `node legacy/run-tests.js`, and
   `node cnb/tests/check-gallery-examples.js`; all pass.

**Creates:** `cnb/assets/examples/gallery/*.json` (Tier-1 fixtures),
`cnb/tests/check-gallery-examples.js`,
`docs/research/gallery-survey/reproduction-report.md`

**Touches:** `cnb/tests/run-tests.js` (only if registering the check
script with the runner)

**Ends with:** every session-1 roster entry has a passing fixture, a
fidelity note, and a human UAT outcome; the check script is a repeatable
gate over the fixture corpus.

**Progress keys:** `session-001/tier1-fixtures`, `session-001/fixture-check-and-uat`

---

### Session 2 of 2: Tier-2 reproductions and gap documentation

**Goal:** Fixtures for the Tier-2 targets (systems needing the set-009/010
enhancements), documented Tier-3 partials, and the completed reproduction
report.

**Steps:**
1. Author each Tier-2 fixture from the matrix's session-2 feed-forward
   list, exercising the clef (set 009) and key-signature (set 010)
   capabilities where the system requires them; same attribution and
   fidelity-note rules as session 1.
2. For each Tier-3 target on the list (if the matrix forwarded any):
   author the reproducible core as a fixture and record the named gap in
   its fidelity note; for systems whose gap proves larger than the matrix
   judged, record a correction note in the reproduction report and flag
   the feasibility matrix entry rather than forcing a fixture.
3. Extend the reproduction report with a summary table: per target system,
   its tier, fixture status, UAT outcome, and noted deviations/gaps — the
   direct evidence base for set 012's capability claims.
4. UAT (per session, same procedure as session 1): captured previews of
   the session-2 fixtures compared against the published systems; human
   attestation recorded verbatim in `s2-uat.md` before verification
   round 1.
5. Run `node cnb/tests/run-tests.js`, `node legacy/run-tests.js`, and
   `node cnb/tests/check-gallery-examples.js`; all pass.
6. As the final session in this set, write `change-log.md` per the shared
   close-out gate (`docs/dabbler/start-here.md` Step 5).

**Creates:** `cnb/assets/examples/gallery/*.json` (Tier-2/Tier-3-core
fixtures), `change-log.md`

**Touches:** `docs/research/gallery-survey/reproduction-report.md`,
`docs/research/gallery-survey/feasibility-matrix.md` (correction notes
only, per step 2)

> **Touches amendment (session 2, 2026-07-09, operator-directed at UAT).**
> The `requiresUAT: true` / `uatScope: per-session` UAT became a four-round
> product collaboration in which the task owner supplied an authoritative
> `Effective Ledger Rules` reference and itemized corrections (recorded
> verbatim in `s2-uat.md`). Acting on that direction reached three files
> outside the session-2 Touches/Creates line, recorded here as an explicit,
> task-owner-authorized expansion (the same remedy applied in set-006-s2 and
> set-010-s2): **(1)** three session-1 product fixtures —
> `cnb/assets/examples/gallery/hass-notation-3-line.json`,
> `numbered-notes-notes-only.json`, and `axlomafi.json` — corrected for the
> ledger rule the owner's new reference column fixed (and, for `axlomafi.json`,
> a mirrored slant-left glyph the owner requested); **(2)**
> `cnb/uat/uat-gallery-previews.mjs`, extended to pass a preview key so the
> set-010 key-signature renders for the keysig-enabled Tier-2 fixtures. The
> requiresUAT config + step-4 UAT is the task-owner authority for these; the
> verbatim dialogue lives in `s2-uat.md`. These are committed with the other
> product changes, separate from the docs-only lifecycle commits.

**Ends with:** the fixture corpus covers both feed-forward lists (or
records a flagged correction where a target moved), the reproduction
report's summary table is complete with human-attested outcomes, and the
check script passes over the full corpus.

**Progress keys:** `session-002/tier2-fixtures`, `session-002/reproduction-report`

---

## End-of-set deliverables

- `cnb/assets/examples/gallery/` fixture corpus with attribution, covering
  the feasibility matrix's reproduction targets.
- `cnb/tests/check-gallery-examples.js` — repeatable mechanical gate over
  the corpus.
- `docs/research/gallery-survey/reproduction-report.md` — per-system
  fidelity evidence with human-attested UAT outcomes, feeding set 012.
