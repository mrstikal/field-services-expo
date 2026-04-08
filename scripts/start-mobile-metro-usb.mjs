#!/usr/bin/env node
import { readdirSync, rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const mobileDir = path.join(projectRoot, "apps", "mobile");
const port = 8081;

function warnIgnoredArgs(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");

  if (args.length > 0) {
    console.warn(
      `[mobile:metro:usb] Ignoring extra arguments (${args.join(" ")}). This workflow always uses port ${port}.`
    );
  }
}

function runCommand(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
  });
}

function checkPortAvailable(portToCheck) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(portToCheck);
  });
}

function getListeningPidsOnWindows(portToCheck) {
  const result = runCommand("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Get-NetTCPConnection -State Listen -LocalPort ${portToCheck} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
  ]);

  if (result.status === 0) {
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line));
  }

  const fallback = runCommand("cmd.exe", ["/d", "/s", "/c", "netstat -ano -p tcp"]);
  if (fallback.status !== 0) {
    throw new Error(fallback.stderr.trim() || fallback.stdout.trim() || "Failed to inspect TCP listeners on Windows.");
  }

  const pids = new Set();
  for (const rawLine of fallback.stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("TCP")) {
      continue;
    }

    const columns = line.split(/\s+/);
    const localAddress = columns[1] ?? "";
    const state = columns[3] ?? "";
    const pid = columns[4] ?? "";

    if (!localAddress.endsWith(`:${portToCheck}`) || state.toUpperCase() !== "LISTENING" || !/^\d+$/.test(pid)) {
      continue;
    }

    pids.add(pid);
  }

  return [...pids];
}

function getListeningPidsOnPosix(portToCheck) {
  const result = runCommand("sh", [
    "-lc",
    `if command -v lsof >/dev/null 2>&1; then lsof -tiTCP:${portToCheck} -sTCP:LISTEN; elif command -v fuser >/dev/null 2>&1; then fuser ${portToCheck}/tcp 2>/dev/null | tr ' ' '\n'; fi`,
  ]);

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "Failed to inspect TCP listeners on POSIX.");
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line));
}

function getListeningPids(portToCheck) {
  return process.platform === "win32"
    ? getListeningPidsOnWindows(portToCheck)
    : getListeningPidsOnPosix(portToCheck);
}

function killPid(pid) {
  if (process.platform === "win32") {
    const result = runCommand("taskkill.exe", ["/PID", String(pid), "/F", "/T"]);
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `Failed to terminate PID ${pid}.`);
    }
    return;
  }

  process.kill(Number(pid), "SIGKILL");
}

async function ensurePortIsFree(portToCheck) {
  const pids = getListeningPids(portToCheck);

  if (pids.length === 0) {
    return;
  }

  console.log(`[mobile:metro:usb] Releasing port ${portToCheck} by stopping PID(s): ${pids.join(", ")}`);
  for (const pid of pids) {
    killPid(pid);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const isPortAvailable = await checkPortAvailable(portToCheck);
  if (!isPortAvailable) {
    throw new Error(`Port ${portToCheck} is still busy after terminating existing process(es).`);
  }
}

warnIgnoredArgs(process.argv);
await ensurePortIsFree(port);

const isPortAvailable = await checkPortAvailable(port);

if (!isPortAvailable) {
  console.error(`[mobile:metro:usb] Port ${port} is still unavailable.`);
  process.exit(1);
}

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

console.log(`[mobile:metro:usb] Starting Expo Metro on port ${port}`);

const child = spawn(
  "pnpm",
  pnpmArgs,
  {
    cwd: mobileDir,
    stdio: "inherit",
    shell: isWindows,
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
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

  if ((code ?? 0) !== 0) {
    console.error(
      [
        "[mobile:metro:usb] Expo Metro terminated before startup.",
        "[mobile:metro:usb] If Expo reported dependency compatibility issues, run:",
        "[mobile:metro:usb]   Set-Location \"F:\\expo\\field-service\\apps\\mobile\"",
        "[mobile:metro:usb]   pnpm install",
      ].join("\n")
    );
  }

  process.exit(code ?? 0);
});
