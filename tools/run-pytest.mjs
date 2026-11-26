#!/usr/bin/env node
/**
 * Runs the Python pipeline tests if a Python with pytest is available
 * (python3, python, or the Windows `py` launcher). Skips gracefully —
 * exit 0 with a notice — when none is installed, so `npm test` works on
 * machines without Python. CI installs pytest and always runs them.
 */
import { spawnSync } from "node:child_process";

const candidates = [
  ["python3", []],
  ["python", []],
  ["py", ["-3"]],
];
const env = { ...process.env, PYTHONDONTWRITEBYTECODE: "1" };
for (const [cmd, pre] of candidates) {
  const probe = spawnSync(cmd, [...pre, "-c", "import pytest, requests"], { stdio: "ignore", env });
  if (probe.status !== 0) continue;
  const run = spawnSync(cmd, [...pre, "-m", "pytest", "pipeline/tests", "pipeline/verify_solvability.py", "-q", "-p", "no:cacheprovider"], {
    stdio: "inherit",
    env,
  });
  process.exit(run.status ?? 1);
}
if (process.env.CI) {
  console.error("pipeline tests: no Python with pytest + requests found, but CI requires them.");
  process.exit(1);
}
console.log("pipeline tests: skipped (no Python with pytest + requests found).");
