# Session 1 - routed cross-provider verification

## Round 1

**ISSUES FOUND**

- **Issue → The `VERIFIED` verdict is stronger than the evidence shown.**  
  **Location →** `CITATION DISCIPLINE (binding rule 1) — representative claims...`  
  **Fix →** The spec requires **every** “can X” / “cannot X” claim to be cited correctly. This review only demonstrates **representative** checks for “can X” claims, so it does not substantiate a full pass. Either perform an exhaustive citation audit or lower the verdict to partial verification.

- **Issue → A limitation claim is validated with the wrong evidence class for binding rule 1.**  
  **Location →** `- "hollow noteheads only read on white backgrounds" cites cnb/src/cnb-notehead.js + CLAUDE.md.`  
  **Fix →** If that statement is presented in the playbook as a **cannot/limitation** claim, the binding rule says it must cite the **relevant invariant + named exemplar system**, not just implementation/docs. If it is only troubleshooting guidance, say so explicitly; otherwise this is a binding-rule miss.

- **Issue → The walkthrough’s “executable / real UI-paths” requirement is under-verified.**  
  **Location →** Part 4 verification, especially the README-anchor and fixture checks.  
  **Fix →** Verifying the README anchor and the Hass fixture confirms the worked example and round-trip link, but not that the walkthrough’s **UI names/paths** are real and usable. Check the actual UI/path references in the playbook, or qualify the review as only verifying fixture/README consistency.

- **Issue → The link-resolution statement is imprecise.**  
  **Location →** `All 6 relative markdown links resolve... (... and the Hass fixture)`  
  **Fix →** The Hass fixture is a JSON asset, not a markdown file, and it is outside `docs/playbook/`. Separate **markdown doc links** from **asset links** so the verification is technically accurate.

- **Issue → Constraint-section completeness is asserted, not demonstrated.**  
  **Location →** `Part 2 Constraints -> step 2 (the five invariants I1-I5, each with exemplars + "what to do").`  
  **Fix →** The spec requires, for **each invariant**: the invariant itself, exemplar systems, and operator action when a design hits it. The review summarizes that structure but does not show it was checked invariant-by-invariant. Either verify each one explicitly or soften the conclusion.

- **Issue → “Evidence-cited” compliance is not fully established.**  
  **Location →** Overall verdict and citation-discipline section.  
  **Fix →** The original task required the playbook to be **complete and evidence-cited**. This review samples claims and verifies some links/counts, but does not establish that all major sections are properly cited throughout. A full section-by-section citation audit is needed for a clean `VERIFIED`.

**False Positives →** None obvious. The main problem is **overstated certainty / incomplete verification**, not fabricated defects.


## Round 2 (remediation - exhaustive audit)

**ISSUES FOUND**

- **Issue → Stated path-audit command cannot produce the listed results**  
  **Location →** `AUDIT 1` (`grep -oE 'cnb/...\.(js|json|html|mjs)'`)  
  **Fix →** Use/report a pattern that actually matches full nested `cnb/...` paths. As written, this regex would not match `cnb/index.html` or paths like `cnb/src/cnb-clef.js`, so the claimed mechanical audit is unsupported.

- **Issue → “Exhaustive citation audit” is not actually demonstrated**  
  **Location →** `SECTION-BY-SECTION CITATION CONFIRMATION`  
  **Fix →** Provide claim-level coverage across the whole playbook, not subsection summaries framed as “every major claim.” The requirement was exhaustive, and this write-up does not prove that no uncited claims remain.

- **Issue → Link-vs-asset separation audit is incomplete**  
  **Location →** `LINK vs ASSET PRECISION`  
  **Fix →** Enumerate all markdown links separately from all asset/code references. The response fully lists doc links, but only explicitly classifies one asset reference, despite other fixtures/assets being referenced elsewhere.

- **Issue → Final verdict is overstated**  
  **Location →** `Claimed session-level verdict: VERIFIED`  
  **Fix →** Do not mark the session verified until the path-audit method is corrected and the citation/link audits are shown exhaustively.

- **Issue → No clear false positives, but certainty is overstated**  
  **Location →** Overall conclusion  
  **Fix →** Keep the evaluation at “not yet verified” rather than “verified.”


## Round 3 (remediation - literal transcripts)

**ISSUES FOUND**

- **Issue → “Verbatim/unedited output” is not actually verbatim in CMD3**  
  **Location →** `=== CMD3 (literal) — every backticked asset/code reference under cnb/ ===`  
  **Fix →** Remove inline annotations like ``<- directory (exists)`` from the command output, or show them in a separate explanation block. As written, the transcript is edited, so it does not satisfy the stated requirement for “COMPLETE unedited output.”

- **Issue → The citation audit is not a literal command transcript**  
  **Location →** `=== EXHAUSTIVE CITATION AUDIT — mechanical density per part + manual claim read ===`  
  **Fix →** Provide the actual command(s), with full syntax, target file, raw output, and exit code. `"$ awk (per-Part count ... ) over the playbook:"` is descriptive prose, not a runnable literal command transcript.

- **Issue → The citation audit is still summary-level, not demonstrably exhaustive**  
  **Location →** Same `EXHAUSTIVE CITATION AUDIT` section  
  **Fix →** Show exhaustive evidence, not just per-part counts plus a manual conclusion. The task asked to prove the audit is exhaustive rather than subsection summaries; counts like “Part 1: 40 citation anchors” and “manual claim-by-claim read confirms...” do not expose the full set of claims/citations being checked.

- **Issue → CMD3 narrows scope from “ALL asset/code references” to only backticked `cnb/` paths**  
  **Location →** `=== CMD3 (literal) — every backticked asset/code reference under cnb/ ===`  
  **Fix →** Either justify that every asset/code reference in the document is a backticked `cnb/` path, or broaden the audit. As written, the evidence only proves completeness for that subset, not for “ALL asset/code references” in the document.

- **Issue → An unsupported verification claim is made for internal markdown-link targets**  
  **Location →** After `CMD2`: `All 6 internal targets resolve as real files from docs/playbook/ (verified by test -f).`  
  **Fix →** If that verification is part of the evidence, include the literal `test -f` command transcript and exit code. Otherwise, remove the claim. The current response asserts verification that is not shown.

- **Issue → Final verdict overstates the evidence**  
  **Location →** `Claimed session-level verdict: VERIFIED.`  
  **Fix →** Downgrade the verdict until the literal/exhaustive evidence gaps above are closed. The path-regex issue is adequately addressed, but items (b) and especially (c) are not fully satisfied by the material shown.

- **False Positives →** No clear false-positive findings were introduced; the main problem is incomplete/unsupported evidence, not erroneous issue-spotting.


## Round 4 (remediation - verbatim transcripts + exhaustive reference set)

**ISSUES FOUND**

- **Citation audit is not actually literal or exhaustive**  
  **Location → Transcript D**  
  **Fix →** Transcript D only runs `... | wc -l` and outputs `33`. That is a count, not a literal per-line citation audit and not “every claim-bearing line’s anchor.” The required evidence is missing; the prose after the transcript is doing the audit work instead of the transcript.

- **“ALL asset/code references” is overstated**  
  **Location → Transcript C and the interpretation below it**  
  **Fix →** The command proves that matches for the specific regex prefixes `cnb/`, `docs/`, `../`, and `legacy/` resolve. It does **not** prove there are no other reference forms in the document. So the conclusion “ALL asset/code/doc references” is not established by the transcript as written.

- **Exhaustiveness reasoning is unsupported**  
  **Location → INTERPRETATION section, especially “So the audit is exhaustive by construction”**  
  **Fix →** Resolving referenced paths does not show that every claim-bearing line has a citation, nor that no uncited claims exist. That requires a transcript that enumerates claim-bearing lines and their anchors directly.

- **Round-4 requirement “literal command transcript (not prose) for the citation audit” is still unmet**  
  **Location → Transcript D plus surrounding explanation**  
  **Fix →** The actual audit content appears only in explanatory prose. The transcript itself does not contain the audit details round 4 asked for.

- **Session-level verdict is too strong**  
  **Location → “Claimed session-level verdict: VERIFIED.”**  
  **Fix →** Transcript B appears to satisfy the markdown `test -f` request, and Transcript C is stronger than the prior backtick-only check, but the citation-audit requirement remains unproven. The overall verdict should not be `VERIFIED` based on this response alone.


## Round 5 (remediation - line-by-line claim+citation transcript)

**ISSUES FOUND**

- **Issue** → The remaining ask for every **“can X”** claim is not satisfied.  
  **Location** → **Transcript F** and the final conclusion that “every capability claim's cited target exists.”  
  **Fix** → Provide a literal transcript that **enumerates each capability claim line** and its **specific module/schema/fixture anchor**, then tie each anchor to a resolved target. A citation-density count is not a line-by-line binding-rule check.

- **Issue** → The “100 of 446 non-blank lines carry a citation anchor” metric does not prove claim coverage.  
  **Location** → **Transcript F** (`grep -cE ...`) and the paragraph interpreting it.  
  **Fix** → Replace the aggregate count with direct enumeration of the claim-bearing lines. Density can include non-claim lines and can miss claim lines; it is not evidence that **every** capability claim is cited.

- **Issue** → The verification of **“cannot X”** claims is weaker than claimed because completeness is assumed, not shown.  
  **Location** → **Transcript E**: “Part 2 is the ONLY section with structural-limitation (‘cannot X’) claims.”  
  **Fix** → Either show a document-wide search proving all limitation claims are confined to Part 2, or enumerate all limitation claim lines directly without relying on that premise.

- **Issue** → Transcript E does not clearly map **each claim line** to its anchor; it mostly surfaces nearby marker lines.  
  **Location** → **Transcript E** command: `grep -nE 'invariant|Exemplar|What to do|feasibility-matrix|...'`  
  **Fix** → Show the actual limitation claim lines themselves alongside the invariant/exemplar citations, rather than a marker-based grep that can omit the claim sentence while still showing surrounding context.

- **Issue** → The conclusion conflates **path resolution** with **section/schema/module anchor resolution**.  
  **Location** → Final reasoning that Transcript C + F proves all “can X” citations resolve.  
  **Fix** → If the cited support is a schema section, module number, or internal anchor—not just a file path—verify those anchors explicitly. Transcript C’s accepted result on path-like references does not, by itself, prove internal citation targets.

The verdict **VERIFIED** is therefore not supported by the evidence shown.


## Round 6 (remediation - claim->anchor->resolution enumeration)

**ISSUES FOUND**

- **Issue** → Internal-anchor verification is incomplete, but the conclusion says all internal anchors resolve.  
  **Location** → Transcript H vs. the capability table/conclusion. The table cites `architecture-plan §4.7 (stem anchors)` for Part 5, but Transcript H only verifies `§2`, `§4.9`, `§4.12`, and `LY-spec §5.1`.  
  **Fix** → Add explicit resolution evidence for every cited internal anchor, including `architecture-plan §4.7` and any other cited section/sub-anchor.

- **Issue** → The capability enumeration is not actually line-by-line, which was part of the ask.  
  **Location** → `--- DIRECT capability-claim -> anchor -> resolution enumeration (Part 1, the "can X" section) ---`  
  **Fix** → Enumerate each actual capability claim by its document line number, not just by subsection label (`1.1`, `1.2`, etc.), and map each one to its exact anchor and resolved target.

- **Issue** → Several capability anchors are too vague to satisfy “specific module/schema/fixture anchor.”  
  **Location** → Capability table entries such as `durations schema`, `Ambros/Trigram/Avique`, and `palette-editor.js`.  
  **Fix** → Replace generic labels with exact target names/paths/sections for each cited schema or fixture, and show that each specific target is the one resolved in prior transcripts.

- **Issue** → Part 3 and Part 5 capability claims are grouped rather than individually enumerated.  
  **Location** → `Part 3 capability/evidence claims -> ...` and `Part 5 -> ...`  
  **Fix** → Split these into separate claim-by-claim entries, each with its own anchor and resolution, the same way Part 1 was intended to be handled.

- **Issue** → The limitation-location proof is weaker than the conclusion claims.  
  **Location** → Transcript G and the sentence `So all structural "cannot X" claims are the five invariants in Part 2; nothing structural is uncited.`  
  **Fix** → Either justify that the grep pattern exhausts all limitation wording used in the document, or narrow the conclusion to “all matched cannot-like phrases were classified.” As written, it proves coverage of selected phrases, not necessarily every possible limitation phrasing.

- **Issue** → “Every capability claim’s cited target is a resolved file or internal anchor” is overstated given the gaps above.  
  **Location** → Final paragraph beginning `CONCLUSION (adopting the round-5 framing)...`  
  **Fix** → Only make that conclusion after completing full line-level capability enumeration and verifying every cited internal anchor, including the missing ones.


## Round 7 (terminal - full line-numbered capability text)

**ISSUES FOUND**

- **Issue** → The limitation-phrase classification is slightly overstated. The response says “every matched line is classified,” but the named classes do not clearly account for all grep hits shown in the evidence block, notably the Part 1 line ending “is not expressible,” the Part 2 heading “What the platform can and cannot do,” and the Part 3 table row “breaks an invariant I1–I5.”  
  **Location** → Paragraph **(iii)** and the surrounding limitation-audit discussion.  
  **Fix** → Either explicitly classify those remaining matched lines, or soften the claim to say the grep hits were reviewed and no hit was found to be an uncited structural limitation claim.

- **Issue** → The final conclusion is broader than what the grep evidence alone proves. “Binding rule 1 … holds claim-by-claim” and “the only structural ‘cannot X’ claims are the five Part-2 invariants” go beyond the narrower standard the task requested. The evidence block supports the safer claim that, among the matched limitation-like phrases, none is an uncited structural claim.  
  **Location** → Final **CONCLUSION** paragraph.  
  **Fix** → Narrow the conclusion to: the broadened grep supports that all matched limitation-like phrases were located and none is an uncited structural claim; Part-2 invariants remain the cited structural basis, while Part-1/Part-3 hits are examples, forward references, restatements, or non-structural strings.

- **Issue** → No material correctness/completeness problem on the other two residual asks. Arch §4.7 is shown as resolving, and the full line-numbered capability text is present.  
  **Location** → Items **(i)** and **(ii)**.  
  **Fix** → None.


## Round 8 (terminal - adopt narrowed wording)

**VERIFIED**

- **Correctness:** The response aligns with the stated round-8 scope. It treats the two prior round-7 items as already resolved, classifies the three remaining grep hits, and preserves the overall session verdict as **VERIFIED**.
- **Completeness:** It covers the sole remaining open item described in the task and includes the expected session-scope constraints (`docs-only`, `uatScope per-set`, `non-final`).
- **False positives:** No substantive unsupported issue is introduced. The additional recap of previously accepted items is extra, but it does not contradict the task or reopen closed points.
