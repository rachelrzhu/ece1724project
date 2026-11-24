#!/usr/bin/env node

// Uses only Node built-ins so this works before npm packages are installed.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkExistingServer, parseOptions, prepareEnvironment } from "./setup-lib.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeDownload = "https://nodejs.org/en/download";
let activeChild;
let interrupted = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interrupted = true;
    process.exitCode = signal === "SIGINT" ? 130 : 143;
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

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(`ECE1724 local setup

npm run setup                       Install packages and start the app
npm run setup -- --install-only      Install packages without starting
npm run setup -- --port 3002         Start on a specific port

Requires Node.js 24 with npm. No cloud credentials are needed for the homepage or tests.
Generates the Prisma client, fills missing .env.local settings, and checks the configuration.
Next.js serves the frontend and server-side code together in one process tree.`);
    return;
  }

  console.log("\nECE1724 - local development setup\n");
  if (Number(process.versions.node.split(".")[0]) !== 24) {
    throw new Error(`This project uses Node.js 24. You have ${process.version}. Install version 24 from ${nodeDownload}, then reopen your terminal and try again.`);
  }

  for (const file of ["package.json", "package-lock.json", ".env.example", "prisma/schema.prisma"]) {
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

  checkExistingServer(projectRoot);
  console.log(`1/3  Installing the project's packages with Node ${process.version} and npm ${npmVersion.stdout.trim()}.`);
  console.log("Internet is required. This may take a few minutes on the first run.");
  console.log("Setup keeps your existing .env.local settings.\n");

  const installCode = windows
    ? await run("npm ci --include=dev --no-fund --no-audit", [], { shell: true })
    : await run("npm", ["ci", "--include=dev", "--no-fund", "--no-audit"]);
  if (interrupted) return;
  if (installCode !== 0) {
    throw new Error("Package installation failed. Check your internet connection and the error above, then run setup again. If it still fails, share that error with your teammate.");
  }

  console.log("\n2/3  Preparing and checking the local environment.");
  const environment = prepareEnvironment(projectRoot, options.port);
  if (environment.created) {
    console.log("Created .env.local with a local authentication secret.");
  } else if (environment.added.length) {
    console.log(`Added missing settings to .env.local: ${environment.added.join(", ")}.`);
  }
  const checkCode = await run(process.execPath, ["--import", "tsx", "scripts/check-env.ts"]);
  if (interrupted) return;
  if (checkCode !== 0) {
    throw new Error("Check the environment settings listed above and run setup again.");
  }

  if (options.installOnly) {
    console.log("\nSetup complete. Run npm run dev when you are ready to start the app.");
    return;
  }

  console.log("\n3/3  Starting the app (frontend and Next.js server together).");
  console.log("When Next.js is ready, open localhost in your browser using the port shown in its Local URL.");
  console.log("You should see From My Kitchen. Keep this terminal open; press Ctrl+C to stop.\n");

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
