# Session 1 UAT — Tier-1 gallery reproductions

**Set:** `011-gallery-reproduction-suite` · session 1 of 2
**Config:** `tier: full`, `requiresUAT: true`, `uatScope: per-session`,
`uatStyle: ad-hoc` (side-by-side image comparison, not a browser DSL flow).
**Date:** 2026-07-07

Per the spec (session-1 step 6): a human compares each captured preview
side-by-side with the published system's gallery image and attests, per
system, **match** / **acceptable-with-noted-deviations** / **defect**. The
attestation is recorded verbatim below **before verification round 1**.

---

## Package

Captured by `node cnb/uat/uat-gallery-previews.mjs` — each fixture is
loaded through the real UI load pipeline (`CNBConfigIO.loadFromText`, the
same merge/REPLACE_PATHS/validate a JSON load performs) and rendered by the
real preview renderer (`CNBCollection.render`) as the full chromatic row
(PCs 0–12) at crotchet, screenshotted at 2× device scale.

- **Location:** `C:\temp\cnb-gallery-uat\`
- **Contact sheet:** `C:\temp\cnb-gallery-uat\index.html` — each system's
  preview PNG next to a link to its source gallery page and its fidelity
  claim, for one-screen side-by-side comparison.
- **Per-system PNGs:** `<slug>.png` (8 files) + `manifest.json`.

**What to compare (recorded in the report's rendering-model note):** the
platform preview renders each pitch class as an octave-chord card in a
chromatic row, not as the linear ascending scale the gallery images use.
That layout difference is inherent to the platform, not a per-system
choice. The fidelity comparison is on **staff geometry (line count,
spacing, pattern), line styling (solid/dashed/bold), ledger placement, and
notehead assignment (shape/orientation/marks by pitch class)** — the
substantive reproduction claims in `reproduction-report.md`.

## Checklist (ad-hoc, per system)

For each of the 8 systems, open the fixture preview and the source gallery
page and confirm:

1. **Staff** — line count per octave and the semitone pattern match the
   published staff (Ambros/Notagraph whole-step 6-line; Numbered-Notes and
   Hass minor-3rd 3-line E/G/A# + C# ledger; Schoenberg/AxLoMaFi major-3rd;
   Avique/0-5-7 the 7-5 white-key pattern).
2. **Line styling** — dashed lines (Ambros F#/G#/A#; Notagraph F#), bold
   lines (Schoenberg C) render where the fidelity note claims.
3. **Ledgers** — the claimed ledger positions render (Hass C#; AxLoMaFi
   mid-gap C; Avique D; 0-5-7 D/E/A/B) and nowhere else.
4. **Noteheads** — the claimed shape/orientation/mark scheme is visible
   (Hass ovals + up/down triangles by dim-7th set; Schoenberg slash
   elevations; AxLoMaFi mirror slants; all others uniform ovals).
5. **Deviations** — the fidelity note's recorded approximations
   (geometric triangles/slants; approximate slash geometry; the
   Numbered-Notes anchor assumption; the octave-chord rendering model)
   are the *only* visible differences; no unrecorded deviation appears.

---

## Operator attestation

### Round 1 — initial package (preliminary; superseded by round 2)

The operator reviewed the first preview package and reported mistakes,
supplying an authoritative per-pitch-class reference. Verbatim:

> There were a number of mistakes. I created an Excel spreadsheet
> (docs/research/gallery-config.xslx) that might be easier to read than the
> PNG files on the website. The companion file, gallery-config-notes.txt,
> provides a description of the codes in the spreadsheet. Note that the
> spreadsheet does not capture notehead height, which in most cases is
> equal to two semitones.

The reference is `docs/research/gallery-config.xlsx` (codes in
`gallery-config-notes.txt`: `S`=staff line, `SB`=bold, `SD0`=dotted,
`SD1`=smaller-dashed, `SD2`=larger-dashed, `L`=ledger, `G`=gap; notehead
codes and shape column). This round-1 attestation is **preliminary and
superseded** by the round-2 attestation below.

### Corrections applied (round 1 → round 2)

Every fixture was reconciled against the reference. Three had substantive
errors; all fixtures took the notehead-height correction.

| System | Correction |
|---|---|
| Ambros | Dashed lines moved from D/F#/A# (alternating) to **F#/G#/A#** (solid C/D/E, dashed F#/G#/A#), per the reference. |
| Numbered Notes, Notes-Only | Staff changed from a 4-line `[1,4,7,10]` assumption to the **3-line E/G/A# staff with C# on a ledger** (same as Hass), per the reference; the assumption is withdrawn. |
| Schoenberg | Elevation slash marks changed from low/middle/high (vertical) to **left / through / right** (`/o`, `phi`, `o/`), per the reference's shape set. |
| **All 8** | Notehead height set to **2 semitones** (`semitoneHeight: 2.0`). |
| Notagraph, Hass, AxLoMaFi, Avique, 0-5-7 | Staff/ledger/shape scheme already matched the reference; notehead height applied. |

The fidelity notes in `reproduction-report.md` were updated to record each
correction (catalog-vs-reference differences called out), and the preview
package was regenerated (`node cnb/uat/uat-gallery-previews.mjs`).

### Round 2 — corrected package (operative attestation)

The operator reviewed the corrected package and attested that the
structural reproductions are acceptable, raising stylistic items as future
work. Verbatim:

> You probably need some SVG assets to make them look better. In some
> cases, the dashes in the dashed staff lines are not long enough. So,
> there are some stylistic issues that we will need to address.

On the session scope decision (AskUserQuestion), the operator selected
**"Close now, defer stylistics"** — accept the structural reproductions for
session 1, with the two stylistic items recorded in the reproduction
report's "Known stylistic deviations" section:

- **Dashed-line dash length** — needs a configurable dash pattern (a new
  platform feature this set's non-goals exclude); logged as a platform gap.
- **Polished SVG glyph assets** for the shaped noteheads (Hass triangles,
  AxLoMaFi slants, Schoenberg slashes) — an asset-authoring task the
  existing Module 16 importer already supports; deferred as a follow-on.

**Outcome:** all 8 systems — **acceptable-with-noted-deviations** (the
recorded deviations being the two stylistic items above plus the standing
approximations: 2-semitone heads, geometric shape glyphs, dash length not
distinguishable, and the octave-chord preview layout). No unrecorded
deviation remains; no structural defect outstanding.
