#!/usr/bin/env node
/**
 * SessionStart hook — prints project context into Claude's conversation.
 * Stdout from this hook is injected directly into Claude's context window.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../");

function run(cmd, fallback = "") {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return fallback;
  }
}

const branch = run("git rev-parse --abbrev-ref HEAD", "unknown");
const lastCommits = run("git log --oneline -5", "");
const status = run("git status --short", "clean");

const memoryPath = path.join(ROOT, ".claude/memory.md");
const memory = fs.existsSync(memoryPath)
  ? fs.readFileSync(memoryPath, "utf8").trim()
  : "(no session memory yet)";

const apiRunning = run("pgrep -a uvicorn", "").includes("uvicorn") ? "running" : "not running";
const webRunning = run("pgrep -f 'next dev'", "").includes("next") ? "running" : "not running";
const dbRunning = run("docker ps --filter name=chatbot_postgres --format '{{.Status}}'", "").includes("Up") ? "running" : "not running";

console.log(`
=== Chatbot SaaS Session Context ===

Branch:    ${branch}
API:       ${apiRunning}
Web:       ${webRunning}
Postgres:  ${dbRunning}

Recent commits:
${lastCommits || "  (none)"}

Working tree changes:
${status || "  clean"}

Session Memory:
${memory}

====================================
`.trim());
