#!/usr/bin/env node
import { readdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const mobileDir = path.join(projectRoot, "apps", "mobile");
const port = process.argv[2] ?? "8081";

function removeIfExists(targetPath) {
  try {
    rmSync(targetPath, { recursive: true, force: true });
  } catch {
    // Best effort cache cleanup.
  }
}

removeIfExists(path.join(mobileDir, ".expo"));
const tempDir = process.env.TEMP ?? process.env.TMP ?? "/tmp";
try {
  for (const name of readdirSync(tempDir)) {
    if (name.startsWith("metro-")) {
      removeIfExists(path.join(tempDir, name));
    }
  }
} catch {
  // Best effort cache cleanup.
}

const isWindows = process.platform === "win32";
const pnpmArgs = ["exec", "expo", "start", "--localhost", "--port", String(port), "--clear"];

const child = spawn(
  "pnpm",
  pnpmArgs,
  {
    cwd: mobileDir,
    stdio: "inherit",
    shell: isWindows,
    env: {
      ...process.env,
      EXPO_OFFLINE: "1",
    },
  }
);

child.on("error", (error) => {
  console.error(`Failed to start Metro: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    try {
      process.kill(process.pid, signal);
    } catch {
      process.exit(1);
    }
    return;
  }
  process.exit(code ?? 0);
});
