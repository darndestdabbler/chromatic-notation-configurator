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
