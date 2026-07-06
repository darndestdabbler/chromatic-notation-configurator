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
