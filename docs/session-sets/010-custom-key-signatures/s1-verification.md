# Set 010 Session 1 — Verification round 1 (2026-07-07)

Verifier: routed task_type=session-verification → gpt-5-4 (OpenAI;
cross-provider from the anthropic orchestrator). Round-1 prompt: full
session narrative + documented design decisions + scope provenance +
full product/docs diffs + complete suite transcripts (HEAD and base
commit) + Chromium geometry smoke script and transcript (~228K chars).
Cost ~$0.34.

---

# ISSUES FOUND

- **Issue → Missing `placementRule` schema/config surface required by the session spec**
  - **Location →** `cnb/src/cnb-config.js` (`keys.keySignature` defaults/validation) and `cnb/src/cnb-key-signature.js` (`signatureSemis()` / `tonicSemi()` hard-code the only placement behavior)
  - **Fix →** Add an explicit `keys.keySignature.placementRule` subsection and validate it, then drive rendering from that data. If the intent was to permanently hard-code the keysig.ly rule, the session should have explicitly narrowed the spec, because Session 2 is defined to ship "placement-rule controls" and there is currently nothing in the schema for those controls to edit.

- **Issue → Product-file scope drift outside the session's declared Creates/Touches**
  - **Location →** `cnb/src/cnb-music.js`
  - **Fix →** Keep tonic parsing inside an allowed touched/new file for this session (for example `cnb-key-signature.js` or `cnb-config.js`), or amend the session scope before changing shared product modules. As submitted, this does not conform to the session spec's product-file restriction.

- **Issue → The submission overstates preview/engine parity**
  - **Location →** Narrative claims in the submission and `s1-engine-coordination.md` that the preview "reproduces keysig.ly by construction" / "what the preview shows ... is what the engine engraves"
  - **Fix →** Qualify that claim more narrowly. The submission itself documents at least two divergences the engine cannot honor from exported config: `style: "dot"` and `tonicOctave`. The implementation may be acceptable as preview-only behavior, but the parity claim is broader than the evidence supports.

---

# Round 2 (remediation) — 2026-07-07

Verifier: gpt-5-4 (same route). Prompt: claimed verdict line, per-issue
resolutions, complete remediation diffs (74092cf product, eb597b7
lifecycle records), Module B base-identity proof (empty
`git diff 9b033f9 HEAD -- cnb/src/cnb-music.js cnb/tests/cnb-music-tests.js`),
complete unfiltered commit list for the fixed range 9b033f9..eb597b7 with
per-commit file lists, and fresh full transcripts (cnb 660/660, legacy
240/240, Chromium smoke 31/31). ~100K chars, cost ~$0.16.

**VERIFIED**

- **Correctness** — The three round-1 issues were real, and the remediation addresses them cleanly:
  - `keys.keySignature.placement = { rule, tonicOctave }` now exists in schema/defaults/validation and is actually consumed by the renderer.
  - `cnb/src/cnb-music.js` scope drift is resolved in the final tree; the tonic parser was moved into `cnb-key-signature.js`, and the provided base-identity proof for `cnb-music.js`/tests is sufficient.
  - The preview/engine parity claim is now properly narrowed to design correspondence, with concrete divergences documented.

- **Completeness** — Based on the provided diffs, commit partition, and fresh transcripts, the session-1 requirements remain covered:
  - default-off `keys.keySignature` schema and validation,
  - default export-invariance pin,
  - preview renderer and gutter composition,
  - unit coverage,
  - visual test page/smoke coverage,
  - engine coordination note,
  - full `cnb` and `legacy` reruns with passing results.

- **False Positives** — None of the three round-1 issues were false positives. All were legitimate, and all are now resolved.

No remaining blocking errors, omissions, or incorrect reasoning are evident in the submitted remediation.

**Session-level verdict: VERIFIED (round 2, gpt-5-4, 2026-07-07). Total verification cost ~$0.50 (r1 $0.34, r2 $0.16).**
