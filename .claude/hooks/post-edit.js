#!/usr/bin/env node
/**
 * PostToolUse hook — auto-lints after Edit/Write tool calls.
 * Receives tool input via stdin as JSON.
 */
const { execSync } = require("child_process");
const fs = require("fs");

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const filePath = data?.tool_input?.file_path || data?.file_path || "";
  if (!filePath) process.exit(0);

  const ROOT = "/home/knovator/personal/chatbot";
  const venv = `${ROOT}/apps/api/.venv/bin`;

  function run(cmd) {
    try {
      execSync(cmd, { cwd: ROOT, stdio: "pipe" });
    } catch {
      // non-zero exit (lint warnings) — don't block
    }
  }

  if (filePath.endsWith(".py")) {
    if (fs.existsSync(`${venv}/ruff`)) {
      run(`${venv}/ruff check --fix --quiet "${filePath}"`);
      run(`${venv}/ruff format --quiet "${filePath}"`);
    }
  }

  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
    run(`pnpm --filter web exec eslint --fix --quiet "${filePath}" 2>/dev/null || true`);
  }

  process.exit(0);
});
