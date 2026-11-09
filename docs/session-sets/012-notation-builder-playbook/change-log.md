# Change log — 012-notation-builder-playbook

Session set **012-notation-builder-playbook** authored the operator-facing
documentation for designing a chromatic notation system with the platform, and
**closes the expansion program** (sets 008–012) begun after the shared release
gate (`docs/planning/project-plan.md` §8).

## What this set produced

- **`docs/playbook/notation-builder-playbook.md`** (session 1) — the human
  operator playbook: the platform model (two-input principle, semitone grid,
  staff patterns, ledger templates, cumulative notehead rules, palette/CB-safe
  switching, duration modes, clefs, key signatures, JSON↔LilyPond), the five
  architectural invariants (I1–I5) with exemplar systems and redesign guidance,
  the gallery-coverage evidence summary, an executable 12-step build walkthrough
  worked through the Hass 3-Line fixture, and a troubleshooting section. Every
  capability/constraint claim carries a citation to the schema, a module, or a
  set-011 fixture / the feasibility matrix + reproduction report.

- **`docs/playbook/ai-assisted-workflow.md`** (session 2) — the AI-assistance
  companion: the "AI drafts, the platform + the human verify" discipline; a
  pipeline map tagging each walkthrough step High/Lower/Human for AI value with
  its platform verifier; six fill-in prompt templates for the high-value steps
  (each embedding the relevant schema excerpt and ending with a verification
  instruction); and a cautions section (mandatory `validate()`, mandatory visual
  geometry check, never-guess/record-unknowns, invariants can't be prompted
  away, aesthetics reserved to the human, IP posture).

- **README linkage** — a new "Designing a Notation System" section pointing to
  both playbook documents; the human playbook forward-links the AI guide.

## Sessions

- **Session 1** (2026-07-10) — human operator playbook. VERIFIED (gpt-5-4;
  8-round documentary regress on citation exhaustiveness, no deliverable
  defect).
- **Session 2** (2026-07-10, final) — AI-assisted workflow guide, README/playbook
  cross-linking, and per-set operator UAT (operator "Approved as-is" on both
  documents; `s2-uat.md`).

## Verification & scope

Full tier: cross-provider verification recorded per session
(`sN-verification.md`). Documentation-only set — no product code changes, no new
fixtures, no doc restructuring beyond the named linkage edits (spec non-goals).
The full unit suite remained **709 passed, 0 failed** throughout (unchanged from
set 011). Session lifecycle records under this set directory are committed as
docs-only commits per the spec's "Scope note — lifecycle records" exemption.

With this set, the expansion program (survey → clefs → key signatures →
reproduction suite → playbook) is complete: the platform is validated against
the published-systems gallery and documented for both human and AI-assisted
operators, with every can/cannot claim grounded in that evidence.
