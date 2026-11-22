import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
process.chdir(root);
const state = path.join(root, ".local-poc");
const data = path.join(state, "postgres");
const port = "55432";
mkdirSync(state, { recursive: true, mode: 0o700 });
function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
}
if (process.argv.includes("stop")) {
  if (existsSync(path.join(data, "postmaster.pid")))
    run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  process.exit(0);
}
if (
  existsSync(".env.local") &&
  !readFileSync(".env.local", "utf8").includes("POC_LOCAL_ONLY=1")
)
  throw new Error(
    "Existing environment is not the local POC. Refusing to overwrite it.",
  );
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
if (!existsSync(".env.local"))
  writeFileSync(
    ".env.local",
    `POC_LOCAL_ONLY=1\nDATABASE_URL=postgresql://poc@127.0.0.1:${port}/postgres\nDIRECT_URL=postgresql://poc@127.0.0.1:${port}/postgres\nBETTER_AUTH_URL=http://127.0.0.1:3100\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\n`,
    { mode: 0o600 },
  );
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
  "scripts/seed-poc.ts",
]);
console.log(
  "\nLocal POC ready. Run npm run poc:dev, then open http://127.0.0.1:3100.",
);
