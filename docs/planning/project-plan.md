# Project Plan — chromatic-notation-configurator

> **Created:** 2026-07-04
> **Repo role:** Vanilla-JS web UI — the middle stage of the three-repo
> chromatic-notation pipeline (notation design, rule assignment, `.ly`
> export).
> **Tier recommendation:** `full` — this is the most active, most complex
> of the three repos (a real ground-up rewrite in progress, a browser UI,
> and the release-blocking exporter work). Automatic cross-provider
> verification is worth paying for here specifically.
> **`requiresUAT` / `requiresE2E`:** recommend `true` for UAT (it's a real
> browser UI whose whole point is visual output — a human should look at
> rendered noteheads/staves before calling a session set done) and
> `"suggested"` for E2E (Playwright coverage of the rendering primitives
> would catch regressions cheaply once the module surface stabilizes past
> Phase 2 below; it's less valuable while the module shapes are still
> churning in Phases 2–3). Revisit both per session set — they don't have
> to be the same for every set in this repo.

---

## 1. Vision (condensed)

This tool lets a notation designer assign pitch classes, colors, hollow
states, and staff/ledger styling to notehead shapes authored in the sibling
`inkscape-music-glyph-toolkit`, preview the result, and export a `.ly`
config file that the `lilypond-chromatic-notation-base` engine renders.
It's the pipeline's "creative decision" layer — the engine renders, the
toolkit authors shapes, this repo is where a human designs a notation
system without writing Scheme by hand.

**Release criterion this repo owns:** producing a working `.ly` config from
the new modular codebase (not the frozen legacy monolith) that round-trips
correctly through the engine. Nothing else in the ecosystem can reach its
own release gate until this repo's exporter is real.

---

## 2. Current state (what works today)

Two codebases coexist in this repo right now, deliberately:

- **`legacy/`** — the original working monolith
  (`chromatic-configurator.html`, ~3,057 lines, plus `configurator-core.js`
  and `music-color-palettes.js`). Fully functional, 240 passing tests,
  marked **reference only — do not modify**. This is the source of truth
  for behavior the rewrite needs to reach parity with: 6-tab UI, cumulative
  notehead rules (shape/hollow/color as separate layered rule types),
  palette-based color system (standard + colorblind-safe, CIEDE2000-based
  matching), per-shape overlap % for double-notehead minim rendering,
  auto-derived staff geometry, full `.ly` export (Sections A/B/C), JSON
  save/load with version migration, and SVG import from the Inkscape
  toolkit's output.
- **`cnb/`** — the in-progress ground-up modular rewrite, ES modules, no
  build step, no framework. Only through **Phase 1 (Foundation)** of a
  5-phase build order (`docs/CNB-ARCHITECTURE-PLAN-v2.md`): config/music
  primitives and basic grid/staff-line/ledger-line/notehead/stem modules,
  123/123 new tests passing. **There is no `.ly` exporter, no UI, and no
  SVG import in `cnb/` yet** — the rewrite doesn't yet do the things the
  legacy monolith already does.
- Prior sessions used a hand-rolled baton/checklist workflow (`docs/batons/
  baton-sessions-N-to-N+1.md`, `docs/checklists/session-N-checklist.xlsx`)
  documented in `CLAUDE.md`. **This plan and the session sets it produces
  supersede that workflow going forward** — keep the existing baton/
  checklist files as historical record, don't delete them, but don't
  generate new ones once Dabbler session sets are running; retire the
  baton/checklist instructions in `CLAUDE.md` accordingly (Phase 0 below).

---

## 3. Remaining work → session sets

`docs/CNB-ARCHITECTURE-PLAN-v2.md` already has a detailed, sessioned build
order (Phases 2–5, with module-level specs and test cases). The phases below
map onto that plan directly rather than re-deriving it — treat the
architecture plan as the source of truth for module-level detail and this
plan as the session-set-level framing and dependency map.

### Phase 0 — Adopt session-set workflow, retire ad hoc batons
**Goal:** clean transition off the hand-rolled workflow before the next
real feature session starts, so there's exactly one place ("the active
session set's `spec.md`") that says what's being worked on.
- Update `CLAUDE.md` to remove the baton/checklist-generation instructions
  and replace with a pointer to the Dabbler session-set workflow.
- Note in `README.md`/`CLAUDE.md` that `docs/batons/` and
  `docs/checklists/` are historical records of pre-Dabbler sessions, not
  an active workflow.
- **Size:** part of session 1 of set 001 below, not its own set.

### Phase 1 — Rendering Primitives (architecture plan's Phase 2, Sessions 10–11)
**Goal:** per `CNB-ARCHITECTURE-PLAN-v2.md` Phase 2 — the next layer of
rendering-primitive modules above the Phase-1 foundation already shipped.
- Follow the architecture plan's module specs/test cases directly for this
  phase; don't re-derive them here.
- **Size:** 2 sessions (matches the architecture plan's own numbering).
- **Depends on:** Phase 1 Foundation (already done).

### Phase 2 — Composites (architecture plan's Phase 3, Sessions 12–13)
**Goal:** Ledger Set (flagged in the architecture plan as the most complex
composite), Double Notehead, Octave Chord Card, Card Collection.
- **Size:** 2 sessions.
- **Depends on:** Phase 1 above.

### Phase 3 — LilyPond Exporter (architecture plan's Phase 4, Session 14)
**Goal:** the release-blocking deliverable. A real `.ly` exporter from the
new modular codebase, reaching feature parity with `legacy/`'s Sections
A/B/C export (cumulative notehead rules, palette-based color registration
including the `cnb:use-accessible-colors` conditional block, staff/ledger
inline styling) — not a re-implementation from scratch, a **port** of
already-proven logic in `legacy/configurator-core.js` into the new module
shape.
- Cross-check against `docs/CNB-LY-EXPORT-SPEC-v1_2.md` for the exact
  export contract the engine expects.
- **This is the session set that unblocks
  `lilypond-chromatic-notation-base`'s Phase D (end-to-end verification)** —
  flag its completion back to that repo (or just proceed directly to §Phase
  5 below, since it's the same milestone).
- **Size:** 1 session per the architecture plan, but budget for this being
  the highest-risk set in the whole ecosystem — don't be surprised if it
  needs 2.
- **Depends on:** Phase 2 above (composites the exporter needs to serialize).

### Phase 4 — UI Components (architecture plan's Phase 5, Sessions 15–20+)
**Goal:** rebuild the user-facing UI on the new modules: SVG import (from
the Inkscape toolkit — re-validate the `data-*` contract still holds, per
that repo's Phase B), palette system integration (`music-color-palettes.js`
port), cumulative notehead rule editing UI, staff/ledger inline styling UI.
This absorbs what the older ecosystem-wide plan
(`docs/CNB-PROJECT-PLAN-20260224.md`) called "Sessions 6/7" — palette system,
cumulative rules, inline staff/ledger styling — which was written before
this rewrite existed and describes the *legacy* architecture's target
state. Use the legacy monolith's already-working implementation of these
features as the reference behavior, not that older doc's original session
plan.
- This is the largest remaining phase (6+ sessions per the architecture
  plan) — expect multiple session sets here, decomposed by the architecture
  plan's own module boundaries rather than as one giant set.
- **Depends on:** Phase 3 (exporter) for anything that needs to preview
  real export output; some UI work (pure rendering/preview) could start
  earlier if scoped carefully — use judgment per sub-session.

### Phase 5 — End-to-end pipeline verification (shared release gate)
**Goal:** same milestone as `lilypond-chromatic-notation-base`'s Phase D —
design a notation via the full pipeline, export `.ly` from the *new*
codebase, render through the engine, diff against the existing golden
baseline (`joy-to-the-world.ly` / `.svg` in the engine repo), fix
discrepancies, and document the full workflow end-to-end (this repo's
README + the engine repo's README both need the "how to actually use this"
walkthrough — see the documentation goal in the covering message below).
- **Size:** 1–2 sessions, likely run from this repo since it's the one
  producing the export, but coordinate — don't duplicate this set in both
  repos' Explorers.
- **Depends on:** Phase 3 (exporter) at minimum; Phase 4 not strictly
  required if the exporter can be driven headlessly/via test config rather
  than the UI.

---

## 4. Cross-repo context

This repo is the **middle stage** of the pipeline and currently the
critical path for the whole ecosystem:

```
inkscape-music-glyph-toolkit  →  chromatic-notation-configurator (this repo)  →  lilypond-chromatic-notation-base
(SVG shape authoring)              (rule assignment, .ly export)                    (rendering)
```

- **`inkscape-music-glyph-toolkit`** — stable, done for current scope. Its
  SVG `data-*` contract is what Phase 4's SVG-import rebuild needs to
  re-validate against.
- **`lilypond-chromatic-notation-base`** — has two small independent fixes
  of its own (accessible-color flag, callback-collision bug) that can
  proceed in parallel with this repo's work, but its own release-gate
  session (its Phase D) is blocked waiting on this repo's Phase 3/5.

---

## 5. Naming, attribution & IP caution (important — read before writing UI copy or preset names)

This is the one repo in the ecosystem with user-facing strings — tab
labels, palette names, any future "starter preset" — so it's the highest-
risk place for an overclaim or a naming collision to reach an actual user.

- **Clairnote SN** (Paul Morris) and **Chromatic Lyre Notation** (Jan
  Braunstein, via The Music Notation Project) are real, individually-
  authored systems — but note the *notation design* and *code* carry
  different licenses. Clairnote SN's design/site content is CC BY-SA 4.0,
  but Morris's separate LilyPond implementation
  ([`clairnote.ly`](https://github.com/PaulMorris/LilyPond-Clairnote)) is
  **GPL v3**. Braunstein's LilyPond implementation
  ([`lyrebird.ly`](https://github.com/scaleshift-scores/scaleshift_conversion_scripts/blob/main/chromaticlyre.ly))
  carries **no license header** — treat as all-rights-reserved. If this
  UI ever ships a preset or palette that reproduces either system's
  specific notational choices (not just "a chromatic notation that happens
  to look similar"), or ports any of their JS/Scheme logic, that needs
  attribution and a compatible license — for Clairnote SN's *code*
  specifically, that means GPL v3 compatibility, not just ShareAlike. See
  the engine repo's `docs/planning/project-plan.md` §5 for the direct
  code-comparison already done there (four engine files reference this
  prior art; all four were verified as independent implementations, not
  ports — the same standard should apply here if this repo's palette/rule
  code is ever built by studying `clairnote.ly`/`lyrebird.ly` directly).
  Get any such reuse checked before shipping, not after.
- **"Kite" is this project's own original notation**, not an external
  system — no attribution owed. But there's an unrelated real person,
  "Kite Giedraitis," who publishes unrelated notation/tuning work under the
  name "Kite" in the xenharmonic/microtonal community. Any UI label, help
  text, or preset name using "Kite" in this tool should make clear it's
  this project's own coinage, unaffiliated with that other work, so users
  (and search engines, and future AI assistants asked to research this
  project) don't conflate the two.
- **General rule:** don't let a palette name, preset label, or tooltip
  imply this tool "generates Clairnote" or "generates Chromatic Lyre
  Notation" as a supported, endorsed export mode unless that's actually
  true and cleared. "Inspired by" / "compatible in spirit with" framing,
  with a citation, is the safe default.
- Not legal advice — get an actual IP review before any public/commercial
  release that ships named-system presets.
- **Resolved 2026-07-04:** the author confirmed public-domain intent for
  all three repos. Added a `LICENSE` file (CC0 1.0 Universal) and a short
  README note. This repo is pure vanilla JS with no external library
  dependencies identified, so CC0 applies cleanly with no dependency-license
  caveat (contrast the toolkit repo, which imports GPL-licensed `inkex`).

---

## 6. Recommended session-set decomposition

| Set slug (suggested) | Phase | Sessions | Tier | Depends on |
|---|---|---|---|---|
| `001-adopt-session-sets-and-rendering-primitives` | 0 + 1 | 1 (Phase 0) + 2 (Phase 1) | full | — |
| `002-composites` | 2 | 2 | full | Set 001 |
| `003-lilypond-exporter` | 3 | 1–2 | full | Set 002 |
| `004-ui-components` | 4 | 6+ (split into sub-sets by module, per architecture plan) | full | Set 003 (partial overlap possible — use judgment) |
| `005-end-to-end-pipeline-verification` | 5 | 1–2 | full | Set 003 at minimum |

Recommend folding Phase 0 (retire batons) into session 1 of set 001 rather
than its own set — it's small and naturally happens at the moment of
adopting the new workflow. Set 004 is large enough that it should be
decomposed into several smaller session sets by module (Notehead editor,
Staff/Ledger editor, Palette editor, SVG import) rather than run as one
6+-session monolith — use `CNB-ARCHITECTURE-PLAN-v2.md`'s own module
boundaries when splitting it.

---

## 7. Documentation goal (separate from the code work above)

Once Phase 5 lands, all three repos need user-facing documentation that
actually explains how to use the pipeline end-to-end — install the
Inkscape extension, author a shape, import it into this Configurator,
assign rules, export a `.ly` file, render it with the engine. This doesn't
need its own session set necessarily; it's a natural fit for Phase 5's
"document the full workflow" deliverable, extended across all three
READMEs rather than just this repo's.
