# Browser UAT status

The Playwright drivers under `cnb/uat/` drive the real app (or a module's
test page) in Chromium; `uat-hostile-input.mjs` (session 6) runs its
checklist in Chromium, Firefox and Edge. `npm run uat` runs every
`cnb/uat/uat-*.mjs` in name order through `cnb/uat/run-uat.mjs` and stops
at the first driver that exits non-zero. Setup is in the README ("Running
the Browser UAT").

## A declared suite

The UAT is declared as the second suite, `cnb-uat`, in `dabbler.yaml`
(`command: npm run uat`, expensive, run whole at close, covering `cnb/`).
Every driver passed on the first run with no repairs, and the whole run
takes about a minute, so nothing argues for leaving it to the operator. The
suite does not install its prerequisites (`npm install`,
`npx playwright install chromium firefox`, an installed Microsoft Edge). On
a machine without them a driver exits 2 and names what is missing.

## Colour picker check — 2026-11-06 (session 21)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- A one-off scratch script outside the tree, not a driver: 43 of 43 checks
  pass against the fixed code. The same script fails 12 checks against the
  pre-fix code (HEAD before session 21).

On 2026-11-05 the operator found that the colour picker closed on every
change, so a hex value had to be typed one digit at a time. Each colour
input redrew its whole panel on `input`, which destroyed the element that
owned the open picker. Session 21 made `input` update the config and the
preview without a redraw, and `change` (fired when the picker closes) do the
full redraw.

The script opens `cnb/index.html` and covers all five colour inputs in the
four editors: the palette's custom cell, a notehead rule's custom colour,
the key-signature separator, and the staff and ledger line defaults. For
each input it runs two sequences of `input` events. One is a drag (4
values). The other is a typed hex value, one digit at a time (`#100000` to
`#123456`, 6 values). It checks that:

- the same element stays in the DOM through every `input` event. This is
  the check that fails before the fix, on the first event, for all five
  inputs.
- the shared config (`#state-json`) follows every `input` event, and so
  does the preview for the four colours the default config draws: the
  palette cell, the rule colour, the staff lines and the ledger lines. The
  separator is not checked in the preview, because the default preview has
  no key selected and so draws no key signature.
- the palette's nearest-colour names stay unchanged until `change`, and
  catch up on it.
- `change` redraws the panel, and the new element holds the final value.
- the page logs no errors.

What it cannot cover: Playwright dispatches the events directly, so it
never opens the browser's native picker window. That the picker stays open
while you drag or type is inferred from the element surviving. A person
has to watch it happen, so the operator's hands-on check of the four
editors is still owed.

## Last run — 2026-11-06 (session 17)

- playwright-core 1.64.1; Chromium `chromium-1248`
- Windows 11, Node 25.8.1
- `npm run uat`: 14 of 14 drivers pass. The thirteen earlier drivers are
  unchanged.

`uat-imported-notehead.mjs` (new) checks the operator's 2026-11-05 report:
a freshly imported 4-semitone notehead was drawn at about 3 semitones until
an unrelated edit redrew the preview. It imports `cnb/fixtures/45deg.svg`
into `cnb/index.html` on three routes: the Kite config with the file
picker and the Default rule, the default config with the file picker and
the Default rule, and the default config with drag-and-drop and a new rule.
On each route it measures every notehead the preview draws as soon as the
shape is selected, which must be 4 × pxPerSemi (64 px). It then sets the
Default rule's colour to a custom hex and checks that no height changed. It
also checks that no console or page error is logged.

| Driver | Page under test | Result |
|---|---|---|
| `uat-imported-notehead.mjs` | `cnb/index.html` | pass, 13/13 checks |

**Not reproduced, so nothing fixed.** The stale height did not show up on
the driver's three routes. It also did not show up on a same-name re-import
of a 3-semitone version, or on the operator's own sequence replayed in six
orders (import, 3-6-9 staff, keys and key signature, repeat mode, ledger
removal, rule shape). Every case drew the head at 64 px at once, in
Chromium, Edge and Firefox. The operator could not recall anything else
about the session. What the operator saw matches the default config's
crotchet-minim, which is 2.724 semitones tall and stays on screen until a
rule selects the new shape. No source file changed. The driver pins the
behaviour in the browser. A unit test in `cnb/tests/cnb-svg-importer-tests.js`
pins that the imported shape measures 4 semitones through
`CNBNotehead.measure`, which the preview uses to size every head.

## Earlier run — 2026-11-05 (session 15)

- playwright-core 1.64.1; Chromium `chromium-1248`, Firefox and Edge as in
  session 6
- Windows 11, Node 25.8.1
- `npm run uat`: 13 of 13 drivers pass. The twelve earlier drivers are
  unchanged and pass as in session 6.

`uat-site.mjs` (new) checks the site GitHub Pages publishes, in Chromium.
It assembles the site with `cnb/site/assemble-site.mjs` into a temp
directory, serves it over HTTP and loads `/`. The preview renders staff
lines and noteheads, every editor mounts, there is no `file://` notice, and
no page error, console error or failed request is logged. It then opens the
working tree's `cnb/index.html` over `file://` and checks that the notice is
visible, links to `https://configurator.darndestdabbler.org/` and gives the
two local commands.

| Driver | Page under test | Result |
|---|---|---|
| `uat-site.mjs` | the assembled site at `/`, and `cnb/index.html` over `file://` | pass, 8/8 checks |

**Fixed:** a served page logged one console error, a 404 for
`/favicon.ico`, which the browser requests on its own. `cnb/index.html` now
declares an empty inline icon (`<link rel="icon" href="data:,">`), so the
request is never made.

## Earlier run — 2026-11-01 (session 6)

- playwright-core 1.64.1; Chromium `chromium-1248` (156.0.8078.4); Firefox
  `firefox-1555` (157.0), installed by `npx playwright install firefox`;
  Microsoft Edge 155.0.4283.62 (system install, channel `msedge`)
- Windows 11, Node 25.8.1
- `npm run uat`: 12 of 12 drivers pass. The eleven drivers below are
  unchanged and pass as in session 5.

`uat-hostile-input.mjs` feeds `cnb/index.html` a toolkit SVG, a non-toolkit
SVG, an SVG without `data-lilypond-*`, a file that is not XML, an
older-version JSON save, a truncated JSON file, a legacy-monolith save, a
JSON file the app cannot display, and an export of an invalid config. It
checks for a visible message each time, that the previous state survives
every refusal, and that no console or page error is logged.

| Browser | Version | Result |
|---|---|---|
| Chromium | 156.0.8078.4 | pass, 18/18 checks |
| Firefox | 157.0 | pass, 18/18 checks |
| Edge | 155.0.4283.62 | pass, 18/18 checks |

**Fixed:** Firefox logs an "XML Parsing Error" to the console as an error
whenever `DOMParser` is handed text that is not XML (Chromium and Edge do
not). The importer now refuses text with no `<svg` element before parsing
it, so a non-SVG file gets its message without a console error. Nothing
else broke in Firefox or Edge.

## Earlier run — 2026-10-31 (session 5)

- playwright-core 1.64.1 (from the repository's `node_modules`, via
  `npm install`)
- Chromium: ms-playwright cache revision `chromium-1248`, installed by
  `npx playwright install chromium`
- Windows 11, Node 25.8.1

There are eleven drivers, not the ten session 5's plan counts:
`uat-gallery-previews.mjs` is a capture tool (it screenshots each gallery
fixture's preview for side-by-side human review) and runs with the others.

| Driver | Page under test | Result | Fixed |
|---|---|---|---|
| `uat-clef-editor.mjs` | `cnb/index.html` | pass, 28/28 checks | — |
| `uat-common-props-editor.mjs` | `cnb/test-pages/test-common-props-editor.html` | pass, 24/24 checks | — |
| `uat-config-export.mjs` | `cnb/test-pages/test-config-export.html` | pass, 22/22 checks | — |
| `uat-config-io.mjs` | `cnb/test-pages/test-config-io.html` | pass, 19/19 checks | — |
| `uat-gallery-previews.mjs` | gallery fixtures rendered by `CNBCollection` | pass, 18/18 previews captured | — |
| `uat-golden-path.mjs` | `cnb/index.html` | pass, 30/30 checks | — |
| `uat-key-signature.mjs` | `cnb/index.html` | pass, 38/38 checks | — |
| `uat-kite-pipeline.mjs` | `cnb/index.html` | pass, 26/26 checks | — |
| `uat-notehead-rule-editor.mjs` | `cnb/test-pages/test-notehead-rule-editor.html` | pass, 34/34 checks | — |
| `uat-pitch-axis.mjs` | `cnb/test-pages/test-pitch-axis.html` | pass, 27/27 checks | — |
| `uat-staff-rule-editor.mjs` | `cnb/test-pages/test-staff-rule-editor.html` | pass, 29/29 checks | — |

**Drift since July: none.** Once playwright-core and a Chromium were
installable from the repository, every driver passed unchanged against the
current app. What had kept them from running was only the missing install:
nothing in the repository declared playwright-core, and the drivers' error
messages pointed at a scratch directory. Session 5 changed only those
messages, which now point at `npm install` at the repository root.
