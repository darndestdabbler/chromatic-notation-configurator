## Session 2 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s2/`

## Session 3 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s3/`

## Sessions 1–4 — pitch axis (v1 set 014), closing summary

Sessions 1–4 implemented the operator-approved pitch-axis design
(`docs/planning/pitch-axis-design.md`). The design relaxes invariant I2,
"one pitch per vertical grid position", so the configurator can draw
compact staves such as the Twinline family. A config without an enabled
`pitchAxis` still runs the literal pre-existing code paths. Every existing
preview and export baseline stayed byte-identical throughout.

**What shipped**

- **Session 1 (P1, P2):**
  - `docs/CNB-LY-EXPORT-SPEC-v1_3.md` adopted as the canonical export spec.
  - The architecture plan amended (§4.13, Module 24).
  - Validation PA-1…PA-8 and PA-W1/W3/W4, and `resolveNotehead` gained
    `xOffsetStaffSpaces`.
  - The `CNBPitchAxis` gatekeeper (`cnb/src/cnb-pitch-axis.js`).
  - The axis path in the grid.
- **Session 2 (P3):**
  - The consumers rethreaded through the axis: staff dedup, ledger
    re-metrication, stem direction, per-note x-offsets in the
    double-notehead, card and collection.
  - `cnb/test-pages/test-pitch-axis.html`.
- **Session 3 (P4):**
  - v1.3 emission: the compiled `cnb:get-pitch-staff-position`, axis
    staff-line positions with collapse dedup, the `axisUnitsPerStaffSpace`
    substitutions, an explicit `cnb:keysig-tonic-octave`, and
    `(x-offset . N)`.
  - The fail-loud gate lifted once the engine's set-008 handoff confirmed
    E13-1/E13-2 (spec 1.3.1).
  - The Twinline compact gallery fixture and its pinned export baseline.
  - An engine round-trip with PARITY PASS (`docs/sessions/session-003/roundtrip/`).
- **Session 4 (P5, P6):**
  - The pitch-axis editor (`cnb/ui/pitch-axis-editor.js`, on the
    Modules 12–17 editor contract) with the "Twinline-like 7-position"
    preset. The preset compiles into the explicit map plus one named
    offset rule. The editor never creates a `pitchAxis` section the user
    did not ask for.
  - `apply.xOffsetStaffSpaces` editing in the notehead rule editor. Before
    this, its builders dropped the field, so a loaded Twinline config
    silently lost its offsets.
  - The panel wired into `cnb/index.html`.
  - Feasibility-matrix records 32–40 re-tiered by a dated amendment
    (`docs/research/gallery-survey/feasibility-matrix.md` §9): Tier 4
    falls from 21 records to 12.

**UAT:** per-set, held on 2026-10-31 and recorded in
`docs/sessions/uat-session-4.md` before verification round 1. The
operator's verbatim decision was "Approve (Recommended)".

**Records:**
- session 1: `docs/session-sets/014-pitch-axis-implementation/` (`s1-notes.md`, `s1-verification.md`, `s1-evidence/`);
- sessions 2–3: the verification entries above and `.dabbler/runs/`;
- the session-3 round-trip: `docs/sessions/session-003/roundtrip/`.

**Carried forward:**
- The in-gap ledger preview↔engine parity limit (design §2.4).
- Per-system reproduction fixtures for records 32–40. The matrix amendment
  says what the single Twinline-like fixture does and does not prove.
- Running the Playwright UAT drivers from the repository (session 5).

## Session 4 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s4/`

## Session 5 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s5/`

## Session 6 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s6/`

## Session 7 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s7/`

## Session 8 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s8/`

## Session 10 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s10/`

## Session 11 verification — VERIFIED after 3 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s11/`

## Session 12 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s12/`

## Session 13 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s13/`

## Session 15 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s15/`

## Session 15 verification — VERIFIED after 3 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s15/`

## Session 16 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s16/`

## Session 17 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s17/`

## Session 18 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s18/`

## Session 18 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s18/`

## Session 19 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s19/`

## Session 20 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s20/`

## Session 21 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s21/`

## Session 21 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s21/`

## Session 22 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s22/`

## Session 23 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s23/`

## Session 24 verification — VERIFIED after 3 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s24/`

## Session 25 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s25/`

## Session 26 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s26/`

## Session 27 verification — VERIFIED after 3 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s27/`

## Session 28 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s28/`

## Session 29 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s29/`

## Session 30 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s30/`

## Session 31 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s31/`

## Session 32 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s32/`

## Session 32 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s32/`

## Session 33 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s33/`

## Session 34 — the preview draws what the engine engraves: baseline changes

Every preview and export baseline changed in this session. Each change
follows from one of the session's steps.

**Preview baseline** (`cnb/fixtures/preview-baseline.json`): all 22 probes
were re-captured.

- Every probe changed when the stems became the engine's: 0.13 staff
  spaces thick, 3.5 staff spaces past the far notehead, and shortened as
  LilyPond shortens them.
- Every probe changed again when the staff lines and ledgers became the
  engine's: black and solid, staff lines 0.1 and ledgers 0.2 staff spaces
  thick, ledgers 1.5 notehead widths long. The card columns narrowed with
  the ledgers (the column is the ledger plus its padding).
- `default-key-signature`, `gallery/clairnote-dn.json` and
  `gallery/clairnote-sn.json` changed again when the signature's gutter
  began giving the engine's spacing: 0.75 staff spaces before the marks,
  and the first notehead centred 4.8636 after them.

**Export baselines** (the default, Kite 4-369, 45deg-369, sized and
Twinline compact fixtures): each changed in two places, and nowhere else.

- **The header's preview-only comment** now names only the CB-safe toggle
  (LY spec 1.3.9 §5.2a).
- **A ledger block** in Section B, after the staff geometry and the pitch
  axis (§5.7): `cnb:ledgers-by-semitone` and the `\layout` block that gives
  each notehead its entry. The non-empty entries, engine semitone →
  ledger staff positions:
  - default and sized: 0, 1 → −6; 2 → −6 −5; 10 → −1; 12, 13 → 0 (the
    in-gap C ledger); 14 → 0 1; 22 → 5; 24 → 6.
  - Kite 4-369: 0, 1, 2 → −8; 12, 13, 14 → 0 (in the 3-6-9 gap); 24 → 8.
  - 45deg-369: none (its preview draws no ledgers in the card range).
  - Twinline compact: 0, 1 → −4; 10, 11 → 2; 12, 13 → 3; 22, 23 → 9;
    24 → 10.
- **No Section C change.** None of these fixtures has a key-scoped rule, so
  the key dispatch (§6.4) adds nothing to them.

## Session 34 verification — VERIFIED after 6 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s34/`

## Session 35 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s35/`

## Session 36 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s36/`

## Session 37 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s37/`

## Session 38 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s38/`

## Session 39 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s39/`

## Session 40 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s40/`

## Session 40 verification — VERIFIED after 3 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s40/`

## Session 41 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s41/`

## Session 42 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s42/`

## Session 43 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s43/`

## Session 44 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s44/`

## Session 44 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s44/`

## Session 45 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s45/`

## Session 46 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s46/`

## Session 47 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s47/`

## Session 48 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s48/`

## Session 49 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s49/`

## Session 50 verification — VERIFIED after 3 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s50/`

## Session 51 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s51/`

## Session 52 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s52/`

## Session 53 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s53/`

## Session 54 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s54/`

## Session 55 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s55/`

## Session 56 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s56/`

## Session 57 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s57/`

## Session 58 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s58/`

## Session 59 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s59/`

## Session 60 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s60/`

## Session 61 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s61/`

## Session 62 verification — VERIFIED after 2 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s62/`

## Session 63 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s63/`

## Session 64 verification — VERIFIED after 1 round(s)

- Verifier: gpt-5.6-terra (openai) over api
- Orchestrator provider (excluded): anthropic
- Verifier's read surface: agency: none — this round's verifier could not look at the tree
- Raw round output: `.dabbler/runs/s64/`
