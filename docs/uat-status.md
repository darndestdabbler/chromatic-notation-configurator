# Browser UAT status

The Playwright drivers under `cnb/uat/` drive the real app (or a module's
test page) in Chromium. `npm run uat` runs every `cnb/uat/uat-*.mjs` in name
order through `cnb/uat/run-uat.mjs` and stops at the first driver that exits
non-zero. Setup is in the README ("Running the Browser UAT").

## A declared suite

The UAT is declared as the second suite, `cnb-uat`, in `dabbler.yaml`
(`command: npm run uat`, expensive, run whole at close, covering `cnb/`).
Every driver passed on the first run with no repairs, and the whole run
takes about a minute, so nothing argues for leaving it to the operator. The
suite does not install its prerequisites (`npm install`,
`npx playwright install chromium`). On a machine without them a driver
exits 2 and names what is missing.

## Last run — 2026-10-31 (session 5)

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
