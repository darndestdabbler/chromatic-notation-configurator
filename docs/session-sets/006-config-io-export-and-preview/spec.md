# Config save/load, LilyPond export, and full preview display

> **Purpose:** Wire the remaining UI shell modules together: JSON
> save/load, the LilyPond export button (wrapping the set 003 exporter),
> and the full preview display with range/duration/key controls — the
> integration layer that turns the individual editors (sets 004–005) into
> a usable application.
> **Session Set:** `docs/session-sets/006-config-io-export-and-preview/`
> **Created:** 2026-07-04
> **Workflow:** full
> **Prerequisite:** `005-rule-editors` complete

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # real browser UI whose whole point is visual output; this set produces the actual export button
requiresE2E: true                      # full app assembly — highest-value surface for Playwright regression coverage
uatScope: per-session
uatStyle: dsl                          # web/browser UI — Playwright via dabbler-uat-dsl
verificationMode: out-of-band-or-none  # Lightweight only: out-of-band-or-none (default) | dedicated-sessions; inert on Full
totalSessions: 3
prerequisites:
  - slug: 005-rule-editors
    condition: complete
  - slug: 004-svg-import-and-palette-editor
    condition: complete
  - slug: 003-lilypond-exporter
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: same as prior sets — this set ships the actual `.ly` export
> button and the assembled preview app, both release-relevant surfaces, so
> cross-provider verification stays on.

---

## Project Overview

Per `docs/CNB-ARCHITECTURE-PLAN-v2.md` §6 "Phase 5: UI Components", this
set covers the three modules that assemble everything built in sets
001–005 into a working application:

- **Module 17 — Config Save/Load** (`ui/config-io.js`): save/load config as
  JSON files.
- **Module 18 — Config Export (LilyPond)** (`ui/config-export.js`): wraps
  set 003's `CNBLilypond.generate()` behind a save/download button.
- **Module 19 — Preview Display** (`ui/preview-display.js`): the full
  preview with controls for pitch range, duration range, and key selection,
  composing set 002's Card Collection with live config from all the editors
  in sets 004–005. This module explicitly depends on "all UI modules" per
  the architecture plan's dependency table — it is intentionally last.

**Non-goals:** this set does not include the end-to-end round-trip through
the actual `lilypond-chromatic-notation-base` engine (that's set 007) — the
export button here produces a `.ly` file and this set verifies it's
well-formed and matches set 003's exporter output; running it through the
real engine and diffing against the golden baseline is the next set.

---

## Sessions

### Session 1 of 3: Config Save/Load

**Goal:** Build JSON save/load for the full config object (Module 17).

**Steps:**
1. Build `cnb/ui/config-io.js` (Module 17): serialize the current config to
   a downloadable JSON file (`meta.configName`-derived filename), and load
   a JSON file back into the app state, running it through
   `CNBConfig.merge()` / `CNBConfig.validate()` on load so partial or
   older-shaped configs still work.
2. Set `meta.created` on first save and update `meta.modified` on every
   save, per the Module A schema (architecture plan §4.11).
3. Write unit tests for round-trip save→load fidelity (deep-equal after a
   save/load cycle) and for graceful handling of a partial/malformed config
   file.
4. Write a Playwright UAT script: edit config via an editor from set 005,
   save to JSON, reload the app, load the JSON back, confirm the editors
   reflect the reloaded state.
5. Run `node cnb/tests/run-tests.js` — confirm all tests pass.

**Creates:** `cnb/ui/config-io.js`, corresponding test file(s)

**Touches:** none outside `cnb/`

**Ends with:** a user can save the current config to a JSON file and load
it back with no loss of fidelity; tests pass.

**Progress keys:** `session-001/config-save-load-module`

---

### Session 2 of 3: Config Export (LilyPond)

**Goal:** Wrap set 003's exporter behind a UI export button (Module 18).

**Steps:**
1. Build `cnb/ui/config-export.js` (Module 18): call `CNBConfig.validate()`
   first (surfacing blocking errors per LY spec §8 before attempting
   export), then `CNBLilypond.generate(config)`, then trigger a `.ly` file
   download named per `meta.fileSuffix`/`meta.configName`.
2. Surface validation errors and warnings (architecture plan §5 "Module A"
   error/warning lists) in the UI so a user knows *why* export is blocked,
   not just that it is.
3. Write unit tests for the validate-then-export flow (blocked on errors,
   proceeds with warnings) and a Playwright UAT script: configure a valid
   notation system through the sets 004–005 editors, click export, confirm
   a `.ly` file downloads and its contents match a direct
   `CNBLilypond.generate()` call on the same config.
4. Run `node cnb/tests/run-tests.js` — confirm all tests pass.

**Creates:** `cnb/ui/config-export.js`, corresponding test file(s)

**Touches:** none outside `cnb/`

**Ends with:** a user can export a valid config as a `.ly` file through the
UI, with validation errors surfaced clearly when the config isn't ready;
tests pass.

**Progress keys:** `session-002/config-export-module`

---

### Session 3 of 3: Preview Display

**Goal:** Build the full preview display with range/duration/key controls,
assembling the entire application (Module 19).

**Steps:**
1. Build `cnb/ui/preview-display.js` (Module 19): controls for pitch class
   range, duration selection, and (if `keys.enabled`) key selection, driving
   set 002's `CNBCollection.render()` live from the config produced by all
   the editors in sets 004–005.
2. Assemble `cnb/index.html` (or confirm/extend an existing entry point) so
   the editors, preview, save/load, and export button are all present and
   wired to a single shared `config` state object, per the architecture
   plan's "no global state, no event listeners" principle for rendering
   modules — the UI shell owns state, rendering modules stay pure.
3. Write a Playwright UAT script covering the full golden path: import an
   SVG shape (set 004), pick a palette (set 004), add notehead/staff rules
   (set 005), adjust common properties (set 005), preview the full
   chromatic row, save the config, export a `.ly` file — confirming each
   step's output is visible and correct before moving to the next.
4. Run `node cnb/tests/run-tests.js` and `node legacy/run-tests.js` —
   confirm both pass.
5. As the final session in this set, follow the shared close-out gate's
   `change-log.md` requirement (per `docs/dabbler/start-here.md` Step 5).

**Creates:** `cnb/ui/preview-display.js`, `cnb/index.html` (or equivalent
entry point), `change-log.md`

**Touches:** any UI module wiring needed to share config state across
editors

**Ends with:** the full golden-path UAT script (import → palette → rules →
properties → preview → save → export) passes end to end in the browser;
all automated tests pass; `change-log.md` is written for this set.

**Progress keys:** `session-003/preview-display-module`, `session-003/app-shell-assembly`

---

## End-of-set deliverables

- A fully assembled `cnb/` application: SVG import, palette editor, rule
  editors, common properties, save/load, LilyPond export, and full preview
  — all wired to shared config state.
- `docs/session-sets/007-end-to-end-pipeline-verification/` unblocked
  (this set is the practical prerequisite, though that set's hard minimum
  dependency is set 003 alone).
