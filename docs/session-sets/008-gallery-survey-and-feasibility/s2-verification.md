# Session 2 verification

## Round 1 (2026-07-06)

# ISSUES FOUND

- **Issue → Structural limitations were treated as Tier 3 gaps instead of Tier 4 invariants**
  - **Location →** `feasibility-matrix.md` §1–§3; row 14; row 42; submission §1 (“one system does not justify an invariant”).
  - **Fix →** Re-evaluate any case the document itself says has **no representation** in the current platform model. Under the spec, that is a Tier-4-style structural limit, regardless of how many systems exhibit it. If bounded staff extent and/or absolute-vs-relative pitch anchoring are real platform invariants, name them and re-tier the affected records; then update counts and set-011 feed-forward lists.

- **Issue → Tier 3 was redefined beyond the spec**
  - **Location →** `feasibility-matrix.md` §2; submission §1 (“devices or display behaviors”).
  - **Fix →** Keep Tier 3 aligned to the spec’s stated definition (“staff/notehead core reproducible, one or more auxiliary devices not”), or explicitly document an amendment to the tier model. As written, the matrix changes the meaning of Tier 3 on its own, which makes downstream scope decisions less reliable.

- **Issue → The recorded UAT attestation does not clearly attest the final corrected deliverables**
  - **Location →** `s2-uat.md`, “Initial attestation” vs. “Corrections made”.
  - **Fix →** Record a post-correction attestation, or explicitly mark the quoted “Attested — records and tier verdicts match the source images” as preliminary/superseded. Right now the verbatim attestation says everything matched, but the same UAT record also says record 14 was wrong and had to be re-tiered. That is internally inconsistent for a required set-level attestation.

- **Issue → Invariant selection is justified by prevalence rather than architecture**
  - **Location →** `feasibility-matrix.md` §1 (“A single system does not justify an invariant”).
  - **Fix →** Base invariant decisions on whether the platform architecture can represent the feature, not on how many surveyed systems need it. Prevalence is relevant for enhancement prioritization, not for deciding whether a limitation is structural.

No other major completeness gaps are evident from the submitted text alone.
