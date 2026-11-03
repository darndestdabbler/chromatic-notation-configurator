# Session 2 UAT — operator review of both playbook documents

**Set:** `012-notation-builder-playbook` · **Session:** 2 of 2 (final)
**Scope (`uatScope: per-set`, `requiresUAT: true`):** one review pass covering
both playbook documents and the README linkage, as authored/finalized in this
session.

## Review package presented to the operator

The operator was presented the two deliverables under `docs/playbook/` for
review as their intended audience:

1. **`docs/playbook/notation-builder-playbook.md`** (authored session 1,
   VERIFIED) — updated this session with a new **"Using an AI assistant"**
   pointer section forward-linking the companion guide.
2. **`docs/playbook/ai-assisted-workflow.md`** (new this session) — structured
   as:
   - **Part 1** — core discipline: AI drafts; the platform (`CNBConfig.validate()`)
     and the human verify; grounded in the repo's own "never emit a value you
     cannot derive" philosophy.
   - **Part 2** — pipeline map tagging each of the playbook's 12 build-walkthrough
     steps **High / Lower / Human** for AI value, each with the platform
     machinery that verifies the AI output.
   - **Part 3** — six fill-in **prompt templates** for the high-value steps
     (characterize-a-system → skeleton config; staff pattern; ledger templates;
     notehead rules; SVG glyph geometry + toolkit `data-*`; export→render→diff
     loop). Each embeds the schema excerpt or doc pointer and ends with the
     verification instruction (the platform check run before trusting the
     output).
   - **Part 4** — cautions: mandatory `validate()`; mandatory *visual* geometry
     check on the test pages; never guess an underivable value (record unknowns
     and ask); the AI cannot lift an invariant (I1–I5); aesthetic/fidelity
     judgment reserved to the human; IP — keep the model away from a target
     system's implementation code.

Plus the **README** gained a **"Designing a Notation System"** section linking
both playbook documents.

Every capability/constraint claim carries its citation (config schema, source
module, or set-011 fixture); every "cannot" claim cites an invariant plus an
exemplar system — per the set's binding rules 1–4.

Baseline check reported to the operator: full unit suite **709 passed, 0
failed** (unchanged; this session is documentation-only, no product code).

## Operator attestation (verbatim)

Presented via `AskUserQuestion` — "You are the intended audience for both
playbook documents (docs/playbook/notation-builder-playbook.md + the new
ai-assisted-workflow.md, plus the README linkage). Please review them. How do
you attest?"

**Operator selected: "Approved as-is"**
> "Both documents are accurate, useful, and correctly cited; the AI-assisted
> guide's pipeline map, prompt templates, and cautions are sound. Approve and
> proceed to close-out verification."

No changes were requested. This is a clean, final attestation covering both
documents — no prior preliminary attestation to supersede. UAT complete;
proceeding to close-out verification.
