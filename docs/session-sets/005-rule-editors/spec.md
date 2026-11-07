# Rule editors — staff/ledger, notehead, and common properties

> **Purpose:** Build the three rule-editing UI modules that let a user
> configure a notation system without writing JSON or Scheme by hand:
> staff/ledger line styling, cumulative notehead rules (shape/hollow/color),
> and global duration/representation settings.
> **Session Set:** `docs/session-sets/005-rule-editors/`
> **Created:** 2026-07-04
> **Workflow:** full
> **Prerequisite:** `004-svg-import-and-palette-editor` complete

---

## Session Set Configuration

```yaml
tier: full                         # full | lightweight — see the tier model SSoT (link below)
requiresUAT: true                      # real browser UI whose whole point is visual output
requiresE2E: true                      # module surface stable; rule-editing UI is exactly where regressions are costly
uatScope: per-session
uatStyle: dsl                          # web/browser UI — Playwright via dabbler-uat-dsl
verificationMode: out-of-band-or-none  # Lightweight only: out-of-band-or-none (default) | dedicated-sessions; inert on Full
totalSessions: 3
prerequisites:
  - slug: 004-svg-import-and-palette-editor
    condition: complete
```

> **Tier:** `full` | `lightweight` is the single switch. The model is defined
> once, in the SSoT — do not restate it here:
> <https://github.com/darndestdabbler/dabbler-ai-orchestration/blob/master/docs/concepts/tier-model.md>.
>
> Rationale: same as prior sets in this repo — these editors directly
> produce the config that drives both the preview and the release-blocking
> `.ly` export, so cross-provider verification stays on.

---

## Project Overview

Per `docs/CNB-ARCHITECTURE-PLAN-v2.md` §6 "Phase 5: UI Components" and
`docs/planning/project-plan.md` §3 "Phase 4", this set covers the three
rule-editing modules:

- **Module 13 — Staff/Ledger Rule Editor** (`ui/staff-rule-editor.js`):
  staff pattern selection, line overrides, ledger templates — porting the
  legacy "Staff rules panel" behavior.
- **Module 14 — Notehead Rule Editor** (`ui/notehead-rule-editor.js`):
  create/edit cumulative rules by pitch class/duration/key — porting the
  legacy "Notehead cards" behavior. This is the most complex editor: rules
  are layered and priority-ordered (architecture plan §4.5's resolution
  algorithm), not first-match-wins.
- **Module 15 — Common Properties Editor** (`ui/common-props-editor.js`):
  durations, representation mode (`shape` vs. `repeat`), and engine
  settings — porting the legacy partial coverage of this area.

All three read/write `config` per the Module A schema and must produce
configs that pass `CNBConfig.validate()` (architecture plan §5 "Module A"
validation checks) before the exporter (set 003) can consume them
cleanly.

**Non-goals:** SVG import and palette editing were set 004. Save/load,
export button, and full preview display are set 006.

---

## Sessions

### Session 1 of 3: Staff/Ledger Rule Editor

**Goal:** Build the UI for configuring staff line patterns/overrides and
ledger line templates (Module 13).

**Steps:**
1. Read the legacy "Staff rules panel" in `legacy/chromatic-configurator.html`
   / `legacy/configurator-core.js` as reference behavior (do not modify).
2. Build `cnb/ui/staff-rule-editor.js` (Module 13): staff pattern selection
   (e.g., 4-8, 3-6-9, custom), per-line `thicknessPct`/style/color
   overrides (`staff.lineOverrides`), and ledger template editing
   (`ledgers.templates`: `semiWithinOctave`, `triggerPCs`, `triggerMode`)
   per the Module A schema (architecture plan §4.3–4.4).
3. Wire the editor's output to live-update a preview using Module 3 (Staff)
   and Module 5 (Ledger Set) from sets 001–002, so changes are visible
   immediately.
4. Write unit tests for the editor's pure logic (config mutation, validation
   pass-through) and a Playwright UAT script (per `uatStyle: dsl`) covering
   the golden path: change the staff pattern, add a line override, add a
   ledger template, confirm the preview updates.
5. Run `node cnb/tests/run-tests.js` — confirm all tests pass.

**Creates:** `cnb/ui/staff-rule-editor.js`, corresponding test file(s)

**Touches:** none outside `cnb/`

**Ends with:** a user can change the staff pattern and ledger templates
through the UI and see the staff/ledger preview update correctly; tests
pass.

**Progress keys:** `session-001/staff-ledger-rule-editor-module`

---

### Session 2 of 3: Notehead Rule Editor

**Goal:** Build the cumulative, priority-ordered notehead rule editor
(Module 14) — the most complex of the three editors in this set.

**Steps:**
1. Read the legacy "Notehead cards" UI in `legacy/chromatic-configurator.html`
   / `legacy/configurator-core.js` as reference behavior (do not modify).
2. Build `cnb/ui/notehead-rule-editor.js` (Module 14): create/edit/reorder
   rules with `match` (pitch classes / durations / keys) and `apply`
   (shape / hollow / color / offKeyMark) blocks per the Module A schema
   (architecture plan §4.5), respecting priority ordering and the
   partial-apply/inherit-from-previous-match semantics.
3. Surface `CNBConfig.resolveNotehead()`'s resolved result per pitch class
   directly in the editor UI (e.g., a live-resolved preview row) so a user
   can see the *effective* config after all rules are applied, not just the
   raw rule list.
4. Write unit tests for rule creation/reordering/merge behavior, plus a
   Playwright UAT script covering: add a rule, reorder it above/below an
   existing rule, confirm the resolved preview updates correctly.
5. Run `node cnb/tests/run-tests.js` — confirm all tests pass.

**Creates:** `cnb/ui/notehead-rule-editor.js`, corresponding test file(s)

**Touches:** none outside `cnb/`

**Ends with:** a user can create layered notehead rules and see the
resolved, effective per-pitch-class config live; tests pass.

**Progress keys:** `session-002/notehead-rule-editor-module`

---

### Session 3 of 3: Common Properties Editor

**Goal:** Build the editor for global duration/representation and engine
settings (Module 15).

**Steps:**
1. Build `cnb/ui/common-props-editor.js` (Module 15): duration definitions
   (crotchet/minim/semibreve/breve — read-only list or limited editing),
   `representationMode` toggle (`shape` vs. `repeat`), `repeatCounts`
   editing, and the `engine` settings block (architecture plan §4.8, §4.10).
2. Wire the `representationMode` toggle to visibly affect the preview (via
   set 002's Card Collection) and note its effect on the exporter's
   `repeat` field (LY spec §6.1) in a code comment or the editor's own
   inline help text.
3. Write unit tests for settings mutation/validation, plus a Playwright UAT
   script covering: toggle representation mode, confirm the preview and
   resolved config both reflect the change.
4. Run `node cnb/tests/run-tests.js` — confirm all tests pass.
5. As the final session in this set, follow the shared close-out gate's
   `change-log.md` requirement (per `docs/dabbler/start-here.md` Step 5).

**Creates:** `cnb/ui/common-props-editor.js`, corresponding test file(s),
`change-log.md` (session-set close-out requirement)

**Touches:** none outside `cnb/`

**Ends with:** a user can toggle representation mode and edit engine
settings through the UI, with both the preview and the underlying config
reflecting the change; tests pass; `change-log.md` is written for this set.

**Progress keys:** `session-003/common-properties-editor-module`

---

## End-of-set deliverables

- `cnb/ui/staff-rule-editor.js` (Module 13), `cnb/ui/notehead-rule-editor.js`
  (Module 14), `cnb/ui/common-props-editor.js` (Module 15) — at parity with
  the corresponding legacy UI behavior.
- `docs/session-sets/006-config-io-export-and-preview/` unblocked (depends
  on this set and on set 004).
