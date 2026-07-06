# Session 2 UAT — human spot-check of characterizations and tier verdicts

**Set:** `008-gallery-survey-and-feasibility` · **Session:** 2 of 2
**Date:** 2026-07-06
**Spec basis:** session 2 step 5 (`requiresUAT: true`, `uatScope: per-set`,
`uatStyle: ad-hoc`) — "a human spot-checks at least 10 systems — sampled
across gallery categories and tiers — comparing catalog record and tier
verdict against the source images, and attests the result." Attestation
obtained **before** verification round 1, per the set-007 session 2
procedure the spec cites.

## Review package

A self-contained HTML review package was placed at
`C:\temp\cnb-008-s2-uat-package.html` (outside the repo, per the IP
posture — gallery images are loaded live from musicnotation.org /
dodekamusic.com, not copied). For each sampled system it shows, side by
side: the source image (live URL), a link to the detail page, the catalog
record's key claims (staff pattern, line variations, ledgers, noteheads,
duration), the feasibility-matrix tier verdict with its justification,
and concrete per-system check prompts.

## Sample (14 systems — every gallery category, all four tiers, firm and provisional)

Package item numbers (1–14) are used in the operator's itemized feedback
below.

| Item | Catalog record | System | Gallery category | Tier verdict (pre-UAT) |
|---|---|---|---|---|
| 1 | 3 | C-Symmetrical Semitone Notation | 1 (whole step, 5 lines) | 1 (provisional) |
| 2 | 6 | 6-6 Tetragram | 2 (whole step, 4/3 lines) | 1 (provisional) |
| 3 | 9 | Notation for the System of Equal Tones | 3 (whole step, 6 lines) | 4 (I3) |
| 4 | 14 | Note for Note | 3 (whole step, 6 lines) | 1 (firm) |
| 5 | 17 | DA Notation | 4 (whole step + major 3rd) | 1 (provisional) |
| 6 | 20 | Lautus Notation | 5 (minor 3rd) | 2 (firm) |
| 7 | 25 | Untitled (Arnold Schoenberg) | 6 (major 3rd, 3 lines) | 1 (firm) |
| 8 | 29 | Clairnote DN | 7 (major 3rd, 2 lines) | 2 (firm) |
| 9 | 38 | TwinNote | 8 (compact staff) | 4 (I2) |
| 10 | 42 | Thumline Notation | 9 (tritone / 1 line) | 3 (provisional) |
| 11 | 43 | Express Stave: Pianoforte Notation | 9 (tritone / 1 line) | 2 (firm) |
| 12 | 50 | Klavar, Dekker Version | 10 (7-5 pattern) | 4 (I1) |
| 13 | 54 | 0-5-7 Notation | 10 (7-5 pattern) | 1 (firm) |
| 14 | S1 | Dodeka Music Notation | out-of-gallery supplement | 4 (I3) |

Coverage: 10/10 gallery categories, out-of-gallery supplement, tiers
1/2/3/4, firm and provisional verdicts, and all three invariants (I1
item 12, I2 item 9, I3 items 3 and 14).

## Operator responses (verbatim)

Initial attestation (selected from the session's AskUserQuestion prompt,
2026-07-06):

> **"Attested — records and tier verdicts match the source images"**

Followed by an itemized message (verbatim, numbering = package items):

> I believe that the hollow noteheads indicate that conventional
> noteheads (solid and hollow) are used, with hollows used for half
> notes.
>
> 1. pass
> 2. pass
> 3. I don't know that we should restrict this. Decher's innovation
>    (especially with respect to beat markings) shouldn't be discounted.
> 4. F#, G#, A#, C, D, E -- all on lines or ledgers.  Note that I would
>    not regard this as tier 1 because there isn't a repeating sequence
>    lines and ledgers across octaves.
> 5. pass -- C, E, F#, G# -- all on lines.  No ledgers
> 6. pass -- G#, B, D -- all on lines.  No ledgers
> 7. pass -- if slashes can be baked into noteheads
> 8. pass -- (note that Morris actually prefers Clainote SN)
> 9. pass -- although we should be able to represent this with the
>    platform
> 10. pass
> 11. pass

And a follow-up message (verbatim):

> 12, 13, 14 -- all pass

## Corrections made

**Item 4 / record 14 (Note for Note) — re-tiered 1 → 3.** The operator's
objection is correct and exposed a modeling error in the original
verdict: the platform expands `staff.semitonePattern` across every
rendered octave, so Note for Note's *bounded* 7-line staff — whose same
whole-step pattern positions continue below the staff as ledger lines,
down to a dashed C — has no config representation (the original
"dashed C-ledger template" modeling fails because C is a pattern
position, so the platform draws a staff line there and the ledger
template never fires). Changes propagated to
`docs/research/gallery-survey/feasibility-matrix.md` (row 14 verdict; §1
fourth-constraint discussion; M1/M2 method caveats; tier summary
21/12/3/19; feed-forward lists — record 14 moved from the set-011
session-1 list to the session-2 documented Tier-3 partials; row 20
Lautus note on its single-octave variant) and
`docs/research/gallery-survey/enhancement-requirements.md` (new
"bounded staff extent" entry in the uncataloged-gaps list). The
consistency validator was re-run after the corrections: all checks
passed.

No `catalog.md` characterization changes were needed — the operator's
line/ledger readings (items 4, 5, 6) match the recorded patterns
([0,2,4,6,8,10] whole-step set for record 14; [0,4,6,8] for record 17;
[2,5,8,11] for record 20).

## Remarks recorded without a document change (with dispositions)

- **Preamble remark (hollow noteheads → conventional duration):**
  recorded in the matrix §5 as the *expected* resolution of the 17
  duration-driven provisional verdicts; the catalog retains `unknown`
  per the spec's binding no-guessing method note (the reading is an
  inference from standardized single-duration renderings, not a
  source-determined value). Set 011's per-system source work is tasked
  with resolving them.
- **Item 3 (Decher "shouldn't be discounted"):** the Tier-4 verdict
  stands (I3 is a spec-named platform invariant, confirmed by this
  survey), but the matrix §7 set-012 notes now record Decher's
  beat-compartment device as the tractable entry point should a future
  set relax I3 — the verdict reflects invariants, not merit.
- **Item 7 (conditional pass):** the condition holds — shapes are
  arbitrary imported paths, so the elevation slashes bake into
  per-pitch-class shape variants (matrix rule M5); the verdict already
  rests on exactly that.
- **Item 8 (Morris prefers Clairnote SN):** noted; no record change —
  both Clairnote records carry their own verdicts.
- **Item 9 (TwinNote "we should be able to represent this"):** recorded
  in matrix §7 as operator interest in eventually supporting the
  compact-staff family; doing so means relaxing invariant I2, a
  platform-level decision outside this matrix.

## Result

UAT complete: 14/14 items reviewed by the operator; 13 passes (some with
remarks), 1 correction (record 14 re-tier) applied and re-validated. The
attestation and itemized responses above are the operator's verbatim
words.
