# Project work plan — sessions

**Written by `dabbler` as a fold of `activity-log.json`.**
Hand edits are overwritten by the next append. The record is the log;
this page is one view of it.

---

## Sessions

The numbered sessions are declared from `session-plan.md`; each one's task is what its own plan step declared.

| # | Session | Releasable | Declared |
| ---: | --- | --- | --- |
| 1 | Export-spec adoption + `CNBPitchAxis` + grid (P1, P2) | — | not declared |
| 2 | Consumer rethread (P3) | no | 2026-10-31 |
| 3 | Exporter + fixtures + engine round-trip (P4) — **gated on engine set 008** | — | not declared |
| 4 | UI presets + re-tier + operator UAT (P5, P6) | — | not declared |
| 5 | Browser UAT becomes reproducible | — | not declared |
| 6 | Hostile input, error paths and the browser matrix | — | not declared |
| 7 | Retire `legacy/`, rewrite the README and the guidance | — | not declared |
| 8 | Packaging | — | not declared |
| 9 | Release 1.0.0 (release: 1.0.0) | — | not declared |

### Session 2 — Consumer rethread (P3)

**Releasable: no.**

Rethread every preview geometry consumer through the grid's pitch axis (design docs/planning/pitch-axis-design.md §2.3–§2.5, §3.3), keeping the axis-disabled surface byte-identical by construction. First, before any source change, capture a pre-change preview-DOM baseline fixture (CNBCollection.render through the svg/DOM stub for the default config, the Kite 4-369 config, every gallery example, a key-signature-enabled config, a debug-grid config, and the same configs with a present-but-disabled pitchAxis section) and pin it with a test. Then: CNBStaff.render dedups lines by axis position on the axis path (overrides merged) and keeps its literal loop on the linear path; CNBLedgerSet.resolve/render gain an axis path that converts to axis positions at the top, gates on axis.regionOfSemi, keeps the strict `<` proximity rule, and draws keyed by axis position, while the linear path runs the literal current arithmetic; CNBStem.direction averages axis positions against positionOfSemi(staff.midpoint) when given an enabled axis (literal body otherwise); CNBDoubleNotehead.layout accepts additive per-note lowerOffsetPx/upperOffsetPx (default 0); CNBCard computes offsetPx = xOffsetStaffSpaces × axis.unitsPerStaffSpace × pxPerSemi in axis mode only, applies it to both noteheads, the ledgers and the stem centerX, and widens columnWidth by |offsetPx|; CNBKeySignature treats separator.extentSemis as a length on the axis path and applies the same resolved offset to its marks. The collection needs no code change (everything flows through the grid context) and gets an axis-row integration test. Finally a visual test page cnb/test-pages/test-pitch-axis.html renders a compact-axis card row with the 013 Twinline map and debug grid, and a Chromium geometry smoke driver cnb/uat/uat-pitch-axis.mjs (the repo's existing driver pattern) asserts its geometry in a real browser.
