# Set 013 Session 1 — Cross-provider verification

## Round 1 (2026-07-10)

# ISSUES FOUND

Core vertical-placement feasibility looks plausible, but the submission overstates what its evidence proves.

| Issue | Location | Fix |
|---|---|---|
| **Ledger-line evidence does not support the claimed `7/7` result.** The provided “complete” measurement transcript reports `ledger-lines=1` and shows only one ledger entry (`ll-1-0.000-0`), while the record claims seven individual ledger rects were extracted and measured. That extraction output is not actually shown. | Summary bullets (“**7/7 ledger lines**...”), `s1-engine-coordination.md` §3.2, measurement transcript header/body. | Provide the actual per-rect ledger extraction output used to get 7 positions, or reduce the claim to what the supplied transcript directly proves. As written, the ledger part of the GO is not independently verifiable from the included evidence. |
| **“Everything downstream reads the geometry back, not the pitch” is too broad and is contradicted later.** The submission later shows a real counterexample: chord-internal head arrangement depends on diatonic `staff-position`, not just geometric `Y-offset`. | `s1-engine-coordination.md` §1.2 vs §3.4 and E13-2. | Narrow the claim. A defensible version is: noteheads/stems/ledgers/dots/articulations followed the coerced geometry in this spike; chord/note-column behavior did not fully do so and needs separate handling. |
| **The “single-site hook is the minimal clean change” conclusion is overstated.** The evidence shows clean many-to-one rendering is **not** solved by the vertical hook alone, because one of the core disambiguation cases (`<gis' a'>`) fails under the tested approach and the engine-side mechanism is still undecided. | Top summary, Recommendation, §4 (“**ONLY required placement change**”), §5. | Reframe the conclusion as: the hook appears sufficient for **vertical placement feasibility**, but clean compact-axis behavior also needs at least one additional bounded engine change for chord-internal X arrangement / collision behavior. |
| **The score-level override is not fully “equivalent to the proposed hook.”** It runs at `stop-translation-timestep` and leaves `staff-position` unchanged, so it cannot validate behaviors that depend on earlier layout phases or on `staff-position`-based logic. The chord finding is exactly such a case. | Top summary (“override equivalent to the proposed hook”), §2.1, §4. | Qualify this as an approximation/proof-of-feasibility for post-placement coercion, not full equivalence to an engine hook. |
| **Collision coverage is only partial.** The task explicitly asked to observe what breaks for stems, ledgers, and collisions. The submission gives strong stem evidence and some chord-arrangement evidence, but no explicit collision-focused measurement or test beyond that one chord-layout failure. | Original task step 2/3 vs record/transcript content. | Either add explicit collision observations/tests, or state clearly that collision behavior is only partially explored and remains follow-on work. |
| **The control-diff claims are asserted but not shown in the quoted transcript.** The record claims exact `+0.850` head shift, identical stem shift, and spacing accumulation from a control render, but the included transcript does not show the offset-vs-control delta table that would verify those statements. | Summary bullets on x-offset, §3.4, “complete” transcript section. | Include the actual control-vs-offset comparison output, or reduce the claims to what the supplied transcript directly demonstrates. |

## False positives to avoid

- **Not an issue:** checking evidence files into `docs/session-sets/013-pitch-axis-engine-discovery/` is consistent with the session’s “record’s evidence” allowance and does not violate the “Touches” restriction.
- **Not an issue:** using a score-level throwaway engraver instead of changing engine source is exactly in scope for this session.
- **Not an issue:** the lack of notehead-shape variation by itself is not a spec failure; the compact-axis example was illustrative (`e.g.`), not a hard requirement.

## Bottom line

The submission does **not** fully verify its own strongest claim as written. A narrower conclusion is supported: **the spike provides plausible GO evidence for vertical notehead/stem placement on a compact axis, but it does not fully substantiate the ledger claim from the supplied transcript, and it overstates how completely a single hook solves clean many-to-one rendering.**


## Round 2 (2026-07-10) — remediation review

VERIFIED
