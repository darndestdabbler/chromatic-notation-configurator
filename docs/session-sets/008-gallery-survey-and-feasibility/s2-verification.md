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

## Round 2 (2026-07-06)

**VERIFIED**

- **Issue 1 resolved:** records **14** and **42** are now re-tiered from Tier 3 to **Tier 4** with explicit new invariants **I4** and **I5**. The reasoning is architectural, not cosmetic:
  - **I4** = no bounded staff-extent concept; per-octave pattern expands across all octaves.
  - **I5** = absolute pitch-class anchoring; movable-Do semantics are not representable as one system.
- **Issue 4 resolved:** the new invariant test is explicitly **architecture-based**, and the prior “single system does not justify an invariant” prevalence logic is removed. Counts of affected records remain descriptive, not justificatory.
- **Issue 2 resolved:** Tier 3 is restored to the spec definition, and the extra “partial-display” case is clearly separated as an **explicit amendment** rather than silently redefining Tier 3. Record **7** is consistently handled under that amendment.
- **Issue 3 resolved:** `s2-uat.md` now clearly marks the earlier attestation as preliminary/superseded and includes a **post-correction attestation** covering the corrected verdicts and final deliverables.

**Consistency/completeness checks passed from the material shown:**
- Tier counts are internally consistent: **21 / 12 / 1 / 21 = 55**
- Firm/provisional counts reconcile: **37 / 18**
- Tier-4 partition reconciles: **I1:4, I2:9, I3:6, I4:1, I5:1**
- Downstream/feed-forward lists and enhancement-driver tables were updated consistently with the re-tiering of 14 and 42.

**No material false positives found** in the remediation itself.
