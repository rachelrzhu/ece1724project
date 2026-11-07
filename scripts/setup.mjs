#!/usr/bin/env node

// Uses only Node built-ins so this works before npm packages are installed.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeDownload = "https://nodejs.org/en/download";
let activeChild;
let interrupted = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interrupted = true;
    activeChild?.kill(signal);
  });
}

function run(command, args = [], options = {}) {
  return new Promise((resolveRun, reject) => {
    activeChild = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      ...options,
    });
    activeChild.once("error", reject);
    activeChild.once("close", (code) => {
      activeChild = undefined;
      resolveRun(code);
    });
  });
}

function parseOptions(args) {
  const options = { installOnly: false, port: undefined, help: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--install-only") options.installOnly = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--port") {
      const value = args[++index];
      if (!/^\d{1,5}$/.test(value ?? "") || Number(value) < 1024 || Number(value) > 65535) {
        throw new Error("Use --port followed by a number from 1024 to 65535. Example: npm run setup -- --port 3002");
      }
      options.port = value;
    } else {
      throw new Error(`Unknown option: ${arg}. Run npm run setup -- --help for available options.`);
    }
  }
  return options;
}

function checkExistingServer() {
  const lockPath = join(projectRoot, ".next", "dev", "lock");
  if (!existsSync(lockPath)) return;

  let pid;
  try {
    pid = JSON.parse(readFileSync(lockPath, "utf8")).pid;
  } catch {
    throw new Error("A Next.js server lock exists. Stop this project's running server with Ctrl+C before setup. See README.md if a previous server crashed.");
  }
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error("A Next.js server lock exists. See the 'Server already running' instructions in README.md.");
  }

  try {
    process.kill(pid, 0); // Check only; do not stop another process.
  } catch (error) {
    if (error.code === "ESRCH") return; // Stale metadata; Next.js can reacquire its lock.
    throw new Error("Cannot check the existing development server. Stop it before running setup.");
  }
  throw new Error("This project's server is already running. Use its browser page, or press Ctrl+C in its terminal before running setup again.");
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(`ECE1724 local setup

npm run setup                       Install packages and start the app
npm run setup -- --install-only      Install packages without starting
npm run setup -- --port 3002         Start on a specific port

Requires Node.js 24 with npm. No database credentials are needed for Hello world.
Next.js serves the frontend and server-side code together in one process tree.`);
    return;
  }

  console.log("\nECE1724 - local development setup\n");
  if (Number(process.versions.node.split(".")[0]) !== 24) {
    throw new Error(`This project uses Node.js 24. You have ${process.version}. Install version 24 from ${nodeDownload}, then reopen your terminal and try again.`);
  }

  for (const file of ["package.json", "package-lock.json"]) {
    if (!existsSync(join(projectRoot, file))) {
      throw new Error(`Missing ${file}. Download and extract the complete project folder before running setup.`);
    }
  }

  const windows = process.platform === "win32";
  // On Windows, npm.cmd must run through a shell. The command is a fixed string.
  const npmVersion = windows
    ? spawnSync("npm --version", { shell: true, encoding: "utf8", cwd: projectRoot })
    : spawnSync("npm", ["--version"], { encoding: "utf8", cwd: projectRoot });
  if (npmVersion.error || npmVersion.status !== 0) {
    throw new Error(`npm was not found. Reinstall Node.js 24 with npm from ${nodeDownload} and reopen your terminal.`);
  }

  checkExistingServer();
  console.log(`1/2  Installing the project's packages with Node ${process.version} and npm ${npmVersion.stdout.trim()}.`);
  console.log("Internet is required. This may take a few minutes on the first run.");
  console.log("Existing .env.local credentials will be left untouched.\n");

  const installCode = windows
    ? await run("npm ci --include=dev --no-fund --no-audit", [], { shell: true })
    : await run("npm", ["ci", "--include=dev", "--no-fund", "--no-audit"]);
  if (interrupted) return;
  if (installCode !== 0) {
    throw new Error("Package installation failed. Check your internet connection and the error above, then run setup again. If it still fails, share that error with your teammate.");
  }

  if (options.installOnly) {
    console.log("\nSetup complete. Run npm run dev when you are ready to start the app.");
    return;
  }

  console.log("\n2/2  Starting the app (frontend and Next.js server together).");
  console.log("Wait for Ready, then open the Local address printed below in your browser.");
  console.log("You should see Hello world. Keep this terminal open; press Ctrl+C to stop.\n");

  const args = [join(projectRoot, "node_modules", "next", "dist", "bin", "next"), "dev", "--hostname", "127.0.0.1"];
  // Without an explicit port, Next.js selects the next free port if 3000 is busy.
  if (options.port) args.push("--port", options.port);
  const serverCode = await run(process.execPath, args, {
    env: { ...process.env, NODE_ENV: "development" },
  });
  if (!interrupted && serverCode !== 0) {
    throw new Error("The app could not start. Check the error above. If the port is busy, try npm run setup -- --port 3002. If this folder already has a running server, stop it with Ctrl+C first.");
  }
}

main().catch((error) => {
  if (!interrupted) {
    console.error(`\nSetup stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
});
