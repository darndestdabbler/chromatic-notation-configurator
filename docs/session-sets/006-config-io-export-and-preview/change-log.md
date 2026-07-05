# Change log — session set 006: Config save/load, LilyPond export, and full preview display

**Set:** `006-config-io-export-and-preview` (tier: full, 3 sessions)
**Completed:** 2026-07-05
**Prerequisites:** `005-rule-editors`, `004-svg-import-and-palette-editor`,
`003-lilypond-exporter` (all complete)

This set built the integration layer that turns the individual modules of
sets 001–005 into a usable application: JSON save/load (Module 17), the
LilyPond export button wrapping the set-003 exporter (Module 18), the full
preview display with range/duration/key controls (Module 19), and the
assembled `cnb/index.html` entry point where every editor, the preview,
save/load, and export share one config state object owned by the page (the
UI shell owns state; rendering modules stay pure). All three modules follow
the established editor-side contract — plain DOM via `createElement`,
events as element properties so the UI runs against a stub DOM in Node unit
tests, `.cnb-*` class hooks with styling left to the host — and each
session was UAT-verified in headless Chromium with checked-in Playwright
drivers (`cnb/uat/`) capturing real browser downloads.

## Session 1 — Config Save/Load (Module 17) — VERIFIED

- `cnb/ui/config-io.js`: save the full config as pretty-printed JSON named
  per a documented `meta.configName` slug rule; `meta.created` stamped on
  first save and `meta.modified` on every save (plan §4.11), with the
  stamped config handed back through `onSave` for the host to adopt; load
  runs files through `CNBConfig.merge()` over defaults plus wholesale
  replacement of the open-keyed map sections (`REPLACE_PATHS`: shapes,
  lineOverrides, schemeSymbols, repeatCounts, offKeyMark — Module A's
  key-by-key deepMerge would otherwise resurrect default entries), then
  `CNBConfig.validate()`; validation surfaces but never blocks a load, and
  malformed files error visibly without touching app state.
- `cnb/tests/cnb-config-io-tests.js` (+ runner registration),
  `cnb/test-pages/test-config-io.html`, `cnb/uat/uat-config-io.mjs`,
  `s1-uat.md`.

## Session 2 — Config Export / LilyPond (Module 18) — VERIFIED

- `cnb/ui/config-export.js`: validate-then-export flow per LY spec §8 —
  `validateForExport()` combines Module A errors, the exporter-side
  path-data check (mirrored so the block is explained before `generate()`
  would throw), and filename derivability (`meta.fileSuffix` slug
  preferred, `meta.configName` fallback, Module 17's slug rule); export is
  blocked on errors with the reasons listed in the UI, proceeds with
  warnings, and on success downloads `CNBLilypond.generate(config)`
  verbatim as a `.ly` file. UAT byte-compared the captured browser
  download against a direct Node-side `generate()` call on the same
  config.
- `cnb/tests/cnb-config-export-tests.js` (+ runner registration),
  `cnb/test-pages/test-config-export.html`,
  `cnb/uat/uat-config-export.mjs`, `s2-uat.md`.

## Session 3 — Preview Display + app assembly (Module 19) — this session

- `cnb/ui/preview-display.js`: pitch-class range (from/to selects over
  0–12 with an endpoint-drag rule keeping the range always valid),
  duration toggle pills over the config's duration definitions (selection
  retained in state, pruned to the current vocabulary at build time; an
  explicit empty state when nothing is selected), and — when
  `config.keys.enabled` — a key selector passed through to the collection
  options with a visible note that Module 10 defers key rows (plan §5);
  drives Module 10's `CNBCollection.render()` live through a `getConfig`
  accessor (Modules 17/18 contract) with a documented injection seam for
  the collection renderer.
- `cnb/index.html`: the application entry point assembling Modules 12–19
  around one shared config object — editors write slices via `onChange`,
  the preview/IO/export panels read via accessors and are redrawn after
  every change; JSON load and SVG import re-seed the editors from the new
  config; the SVG importer adds shapes to `config.shapes` (replacement of
  an existing name is stated in the status line); the full live config is
  exposed in a state panel for external parity checks.
- `cnb/tests/cnb-preview-display-tests.js` (+ runner registration),
  `cnb/uat/uat-golden-path.mjs` (the spec step 3 golden path: import SVG →
  palette → staff + notehead rules → common properties → preview controls
  → save → load back → export, with Node-side staff-geometry and `.ly`
  byte parity checks), `s3-uat.md`.

## End-of-set state

- `node cnb/tests/run-tests.js`: **553/553** passing (29 added this set's
  session 3; 524 at session 2 close).
- `node legacy/run-tests.js`: **240/240** passing (untouched).
- Golden-path UAT: **30/30** checks (driver exit 0).
- The `cnb/` application is fully assembled: SVG import, palette editor,
  staff/ledger and notehead rule editors, common properties, save/load,
  LilyPond export, and full preview, all wired to shared config state.
- `docs/session-sets/007-end-to-end-pipeline-verification/` is unblocked:
  the export button produces `.ly` files verified well-formed and
  byte-identical to Module 11 output; running them through the real
  `chromatic-notation-base` engine against the golden baseline is set 007.
