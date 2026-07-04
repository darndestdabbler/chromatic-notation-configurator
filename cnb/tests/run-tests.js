/**
 * run-tests.js — CNB Test Runner
 *
 * Dynamically imports all test modules, runs their tests, and reports results.
 * Exits with code 1 if any test fails.
 *
 * Usage: node cnb/tests/run-tests.js
 *
 * Test files must export:
 *   export const tests = [{ name: string, fn: () => void }]
 *
 * Test functions use assert() imported from this runner, or define their own.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Test files to run ───────────────────────────────────────────────────────

const TEST_FILES = [
  "./cnb-music-tests.js",
  "./cnb-config-tests.js",
  "./cnb-grid-tests.js",
  "./cnb-staff-tests.js",
  "./cnb-notehead-tests.js",
  "./cnb-stem-tests.js",
  "./cnb-ledger-set-tests.js",
  "./cnb-double-notehead-tests.js",
];

// ─── Runner ──────────────────────────────────────────────────────────────────

let totalPass = 0;
let totalFail = 0;
const failures = [];

for (const file of TEST_FILES) {
  const modulePath = new URL(file, import.meta.url).href;
  let mod;
  try {
    mod = await import(modulePath);
  } catch (err) {
    console.error(`\nFailed to load ${file}:\n  ${err.message}`);
    totalFail++;
    failures.push({ file, name: "(load error)", error: err.message });
    continue;
  }

  const tests = mod.tests;
  if (!Array.isArray(tests)) {
    console.error(`\n${file}: no exported 'tests' array found`);
    continue;
  }

  const suiteName = path.basename(file, ".js");
  console.log(`\n${suiteName} (${tests.length} tests)`);

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`  ✓ ${test.name}`);
      totalPass++;
    } catch (err) {
      console.log(`  ✗ ${test.name}`);
      console.log(`      ${err.message}`);
      totalFail++;
      failures.push({ file: suiteName, name: test.name, error: err.message });
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${totalPass} passed, ${totalFail} failed`);

if (failures.length > 0) {
  console.log(`\nFailed tests:`);
  for (const f of failures) {
    console.log(`  [${f.file}] ${f.name}`);
    console.log(`    ${f.error}`);
  }
  process.exit(1);
} else {
  console.log("All tests passed.");
}
