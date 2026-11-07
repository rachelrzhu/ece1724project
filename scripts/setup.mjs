#!/usr/bin/env node

// Bootstrap uses only Node built-ins so it works before dependencies exist.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkExistingServer, parseOptions, prepareEnvironment } from "./setup-lib.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const windows = process.platform === "win32";
let activeChild;
let interrupted = false;

for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.on(signal, () => {
    interrupted = true;
    process.exitCode = exitCode;
    activeChild?.kill(signal);
  });
}

function run(command, args = [], options = {}) {
  return new Promise((resolveRun, reject) => {
    activeChild = spawn(command, args, { cwd: projectRoot, stdio: "inherit", ...options });
    activeChild.once("error", reject);
    activeChild.once("close", (code, signal) => {
      activeChild = undefined;
      resolveRun(signal ? 1 : code);
    });
  });
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(`ECE1724 Recipe App setup

npm run setup                       Install/configure and start the app
npm run setup -- --install-only      Install/configure without starting
npm run setup -- --port 3002         Request a specific port

Requires Node.js 24 with npm. Preserves existing .env.local values.
Generates Prisma Client and a missing local auth secret; never applies migrations.
Next.js serves frontend and server code together. Cloud credentials are optional
for the placeholder; configure them before using database/storage features.`);
    return;
  }

  console.log("\nECE1724 Recipe App — local setup\n");
  if (Number(process.versions.node.split(".")[0]) !== 24) {
    throw new Error(`Use Node.js 24; this terminal has ${process.version}. Install/select Node 24, reopen the terminal, and retry. https://nodejs.org/en/download`);
  }
  for (const file of ["package.json", "package-lock.json", ".env.example", "prisma/schema.prisma"]) {
    if (!existsSync(join(projectRoot, file))) throw new Error(`Missing ${file}. Download/extract the complete repository before setup.`);
  }
  const npmVersion = windows
    ? spawnSync("npm --version", { shell: true, encoding: "utf8", cwd: projectRoot })
    : spawnSync("npm", ["--version"], { encoding: "utf8", cwd: projectRoot });
  if (npmVersion.error || npmVersion.status !== 0) {
    throw new Error("npm was not found. Reinstall Node.js 24 with npm, then reopen the terminal.");
  }

  checkExistingServer(projectRoot);
  console.log(`1/4 Installing locked dependencies with Node ${process.version} and npm ${npmVersion.stdout.trim()}.`);
  console.log("Prisma Client generation runs during installation. Internet access is required.\n");
  // Windows needs a shell for npm.cmd. This is a fixed command, without user input.
  const installCode = windows
    ? await run("npm ci --include=dev --no-fund --no-audit", [], { shell: true })
    : await run("npm", ["ci", "--include=dev", "--no-fund", "--no-audit"]);
  if (interrupted) return;
  if (installCode !== 0) throw new Error("Installation/client generation failed. Check the error above and your network connection, then retry. Dependency versions were not changed.");

  console.log("\n2/4 Preparing local environment.");
  const envResult = prepareEnvironment(projectRoot, options.port);
  console.log(envResult.created ? "Created .env.local with private file permissions and a local auth secret." : `Preserved existing values; added ${envResult.added.length} missing environment keys.`);
  console.log("No database migrations or cloud writes are performed.");

  console.log("\n3/4 Validating configured environment values.");
  const checkCode = await run(process.execPath, [join(projectRoot, "node_modules/tsx/dist/cli.mjs"), join(projectRoot, "scripts/check-env.ts")]);
  if (interrupted) return;
  if (checkCode !== 0) throw new Error("The environment check could not complete. Read the error above and correct any named keys in .env.local, then retry. Existing values were preserved.");

  if (options.installOnly) {
    console.log("\nSetup complete. Run npm run dev when ready. Use npm run storage:check to test cloud connectivity.");
    return;
  }

  console.log("\n4/4 Starting Next.js (frontend and server together).");
  console.log("Open the Local address printed below. Keep this terminal open; Ctrl+C stops the app.\n");
  const args = [join(projectRoot, "node_modules/next/dist/bin/next"), "dev", "--hostname", "localhost"];
  if (options.port) args.push("--port", options.port);
  const code = await run(process.execPath, args, { env: { ...process.env, NODE_ENV: "development" } });
  if (!interrupted && code !== 0) throw new Error("Next.js could not start. Read the error above; check the port or another server running in this checkout.");
}

main().catch((error) => {
  if (!interrupted) {
    console.error(`\nSetup stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
});
