import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
const root = fileURLToPath(new URL("..", import.meta.url));
process.chdir(root);
const state = path.join(root, ".local-poc");
const data = path.join(state, "postgres");
const port = "55432";
const databaseUrl = `postgresql://poc@127.0.0.1:${port}/postgres`;
const appPort = "3100";
const localSettings = {
  POC_LOCAL_ONLY: "1",
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  BETTER_AUTH_URL: `http://127.0.0.1:${appPort}`,
};
const command = process.argv[2] ?? "setup";
mkdirSync(state, { recursive: true, mode: 0o700 });
function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
}
if (command === "stop") {
  if (existsSync(path.join(data, "postmaster.pid")))
    run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  process.exit(0);
}
if (process.env.VERCEL)
  throw new Error("The local database tools require a local checkout.");
if (!existsSync(".env.local")) {
  if (command !== "setup") throw new Error("Run npm run poc:setup first.");
  const settings = {
    ...localSettings,
    BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
  };
  const contents = Object.entries(settings)
    .map(([key, value]) => `${key}=${value}\n`)
    .join("");
  writeFileSync(".env.local", contents, { mode: 0o600, flag: "wx" });
}
const settings = parseEnv(readFileSync(".env.local", "utf8"));
if (
  !settings.BETTER_AUTH_SECRET ||
  Object.entries(localSettings).some(([key, value]) => settings[key] !== value)
)
  throw new Error(
    "This checkout already has a .env.local file for another environment. Run npm run poc:setup in a fresh checkout.",
  );
// Next.js and Prisma prefer inherited variables to .env.local.
Object.assign(process.env, localSettings, {
  BETTER_AUTH_SECRET: settings.BETTER_AUTH_SECRET,
});
if (command === "dev" || command === "start") {
  run(process.execPath, [
    "node_modules/next/dist/bin/next", command,
    "--hostname", "127.0.0.1", "--port", appPort, ...process.argv.slice(3),
  ]);
  process.exit(0);
}
if (command === "verify" || command === "cleanup-images") {
  const script = command === "verify" ? "check-backend.ts" : "cleanup-unused-images.ts";
  run(process.execPath, ["--conditions=react-server", "--import", "tsx", `scripts/${script}`]);
  process.exit(0);
}
if (command !== "setup") throw new Error("Unknown local database command.");
if (!existsSync(path.join(data, "PG_VERSION")))
  run("initdb", [
    "-D",
    data,
    "-U",
    "poc",
    "--auth=trust",
    "--encoding=UTF8",
    "--locale=C",
  ]);
if (!existsSync(path.join(data, "postmaster.pid")))
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(state, "postgres.log"),
    "-o",
    `-p ${port} -h 127.0.0.1 -k ${state}`,
    "-w",
    "start",
  ]);
run(process.execPath, [
  "--import",
  "tsx",
  "node_modules/prisma/build/index.js",
  "migrate",
  "deploy",
]);
run(process.execPath, [
  "--conditions=react-server",
  "--import",
  "tsx",
  "scripts/seed-recipes.ts",
]);
console.log(
  "\nLocal database ready. Start the app with npm run poc:dev and open http://127.0.0.1:3100.",
);
