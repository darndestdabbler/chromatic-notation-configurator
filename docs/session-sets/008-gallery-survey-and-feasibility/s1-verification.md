# Session-set 008 session 1 — verification record

## Round 1 (2026-07-06, routed task_type=session-verification)

# ISSUES FOUND

- **Issue** → The schema does not literally satisfy the submission’s claim that “every attribute has a closed value set.”
  **Location** → `docs/research/gallery-survey/schema.md`
  **Fix** → Either change the claim to “all categorical fields are closed” or actually constrain the open-ended fields (`name`, `creator`, `detail-url`, `sources`, `notes`, `year`, `staff.lines-per-octave`) if the spec is being read literally.

- **Issue** → The Dodeka supplementary record is not schema-conformant: `year` is not the allowed literal value `unknown`; it includes explanatory prose.
  **Location** → `docs/research/gallery-survey/catalog.md`, record `S1`, field `year`
  **Fix** → Set `year` to exactly `unknown` and move the explanation into `notes`.

- **Issue** → Several `duration.representation` classifications conflict with the schema definitions and/or the record notes.
  **Location** → `docs/research/gallery-survey/catalog.md`
  **Fix** →
  - **Record 17 (`DA Notation`)**: not `traditional` as defined, because the notes say hollow/solid encodes pitch and duration is only “presumably” on stems/flags. Reclassify to a source-supported value (`stem-flag-only`, `other`, or `unknown`).
  - **Records 32 and 33 (`Chromatic Twinline`, `Diatonic Twinline`)**: not `traditional` as defined, because the notes say fill is pitch-bound and the half-note device is unspecified. Reclassify away from `traditional` or mark `unknown`.
  - **Record 47 (`Untitled` by Robert Stuckey)**: `stem-flag-only` is admitted as an inference while flags/beams are undocumented. Mark `unknown` unless the cited sources explicitly support the duration system.

- **Issue** → Record 19 uses evidence outside its own cited sources, contrary to the session method.
  **Location** → `docs/research/gallery-survey/catalog.md`, record `19`
  **Fix** → Either derive the value from record 19’s own detail page and image only, mark the unsupported field(s) `unknown`, or explicitly cite the additional source if project rules permit it.

- **Issue** → The same system is named inconsistently between the index and catalog.
  **Location** → `docs/research/gallery-survey/index.md` entry `19` vs `docs/research/gallery-survey/catalog.md` record `19`
  **Fix** → Use the exact gallery name consistently in both files.

- **Issue** → The submission’s justification for touching files outside `docs/research/gallery-survey/` is unsupported by the spec provided here.
  **Location** → “Scope — lifecycle records” section of the submission
  **Fix** → Cite an actual binding source in the repo/spec that grants that exemption, or stop claiming that the provided session spec itself allowed those extra touches.

## Not issues

- **Issue** → Missing session-1 UAT artifact
  **Location** → whole submission
  **Fix** → No fix needed; per-set UAT is deferred to session 2 by the provided configuration.

## Round 2 (2026-07-06, resolutions-only + remediation diff)

**VERIFIED**

- **Correctness**
  - **Issue 1** is resolved: `schema.md` no longer claims every attribute has a closed value set; it now scopes that claim to **categorical** attributes and explicitly carves out open-valued fields.
  - **Issue 2** is resolved: Dodeka record `year` is now exactly `unknown`, with the decade-only explanation moved into `notes`.
  - **Issue 3** is resolved: records **17, 32, 33, 47** have `duration.representation` changed to `unknown`, and the rewritten notes correctly limit conclusions to what the cited sources support.
  - **Issue 4** is resolved: record **19** now includes the Hass 3-line page in `sources`, and the note text treats it as corroboration rather than uncited evidence.
  - **Issue 5** is resolved: record **19** `name` now matches the index exactly.
  - **Issue 6** is adequately resolved: the response shows the lifecycle-record exemption already existed in the session-set `spec.md` before this session, so this was effectively a substantiated round-1 false positive rather than a remediation change.

- **Completeness**
  - All six round-1 issues are explicitly addressed.
  - The shown diff covers the actual document edits needed for issues 1–5.
  - Issue 6 is supported with repo-history evidence rather than a new edit, which is appropriate given the claim that the exemption already existed.

- **False positives**
  - No new false positives in this round’s response.
  - Round-1 **issue 6** appears convincingly demonstrated to have been a false positive.

- **Minor imprecision**
  - The sentence **“All fixes are in commit `a8bbc5d`”** is not literally true for issue 6, since that item relies on pre-existing content in commit `afa6132`. This does not affect the remediation verdict.
