/**
 * run-uat.mjs — runs every cnb/uat/uat-*.mjs driver in sequence (`npm run uat`).
 *
 * Each driver runs in its own Node process with inherited stdio. The run
 * stops at the first driver that exits non-zero and exits with that code.
 */
import { readdirSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const drivers = readdirSync(dir).filter(f => /^uat-.*\.mjs$/.test(f)).sort();

for (const [i, driver] of drivers.entries()) {
  console.log(`\n=== [${i + 1}/${drivers.length}] ${driver} ===`);
  const { status, error } = spawnSync(process.execPath, [path.join(dir, driver)], { stdio: "inherit" });
  if (status !== 0) {
    console.error(`\nUAT FAILED: ${driver} (${error ? error.message : `exit ${status}`}); ${i} of ${drivers.length} passed.`);
    process.exit(status || 1);
  }
}
console.log(`\nUAT passed: ${drivers.length} of ${drivers.length} drivers.`);
