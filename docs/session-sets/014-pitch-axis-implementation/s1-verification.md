# Set 014 Session 1 — cross-provider verification

## Round 1 (2026-07-12)

## ISSUES FOUND

- **Issue** → Missing mandatory fail-loud export gate for enabled `pitchAxis`; enabled configs can still export silently through the unchanged linear exporter, which violates binding rule 3.  
  **Location** → `cnb/src/cnb-lilypond.js` was not changed; no gate tests were added in `cnb/tests/cnb-lilypond-tests.js` or `cnb/tests/cnb-config-export-tests.js`; the response explicitly defers the gate to session 3.  
  **Fix** → Add the interim `generate()` throw now for `config.pitchAxis?.enabled === true` and make the export helpers surface/block it, with tests proving enabled `pitchAxis` export fails loudly until session 3 removes the gate with engine-shipment evidence.

- **Issue** → The inverse-candidate contract/testing is overstated and incomplete: the submission claims `semisAtPosition` / `nearestSemisForY` return only `0/1/2` candidates, but legal PA-W1 / PA-8-boundary-equality maps can produce `3+` candidates at one absolute axis position.  
  **Location** → Response narrative (“0/1/2 entries”), `cnb/src/cnb-pitch-axis.js` comments, and missing coverage for a legal overlap/boundary-equality map.  
  **Fix** → Document these APIs as returning candidate arrays of any length, and add a test for a legal map such as `positions[11] === positions[0] + octaveStride` with shared `pc 0/1`, asserting a 3-candidate inverse result.
