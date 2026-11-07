import { randomBytes } from "node:crypto";
import { appendFileSync, chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function parseOptions(args) {
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
      options.port = String(Number(value));
    } else {
      throw new Error(`Unknown setup option. Run npm run setup -- --help. Received option at position ${index + 1}.`);
    }
  }
  return options;
}

export function checkExistingServer(projectRoot, isAlive = (pid) => process.kill(pid, 0)) {
  for (const relativePath of [[".next", "dev", "lock"], [".next", "lock"]]) {
    const lockPath = join(projectRoot, ...relativePath);
    if (!existsSync(lockPath)) continue;
    let pid;
    try {
      pid = JSON.parse(readFileSync(lockPath, "utf8")).pid;
    } catch {
      throw new Error("A Next.js lock cannot be read. Stop this checkout's server/build first. For a crashed server, see README.md; setup never deletes locks automatically.");
    }
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new Error("A Next.js lock has invalid process metadata. Stop this checkout's server/build and see README.md.");
    }
    try {
      isAlive(pid);
    } catch (error) {
      if (error.code === "ESRCH") continue;
      throw new Error("Cannot inspect a Next.js lock's process. Stop this checkout's server/build before setup.");
    }
    throw new Error("This checkout already has a running Next.js server/build. Stop it with Ctrl+C before setup reinstalls packages.");
  }
}

export function prepareEnvironment(projectRoot, port = "3000") {
  const localPath = join(projectRoot, ".env.local");
  const templatePath = join(projectRoot, ".env.example");
  if (!existsSync(templatePath)) throw new Error("Missing .env.example. Download the complete repository before running setup.");
  const template = readFileSync(templatePath, "utf8")
    .replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET="${randomBytes(32).toString("hex")}"`)
    .replace(/^BETTER_AUTH_URL=.*$/m, `BETTER_AUTH_URL="http://localhost:${port}"`);
  if (!existsSync(localPath)) {
    writeFileSync(localPath, template, { flag: "wx", mode: 0o600 });
    return { created: true, added: [] };
  }
  const existing = readFileSync(localPath, "utf8");
  if (process.platform !== "win32") chmodSync(localPath, 0o600);
  const keys = new Set([...existing.matchAll(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/gm)].map((match) => match[1]));
  const additions = template.split(/\r?\n/).filter((line) => {
    const match = line.match(/^([A-Za-z_]\w*)=/);
    return match && !keys.has(match[1]);
  });
  if (additions.length) {
    appendFileSync(localPath, `${existing.endsWith("\n") ? "" : "\n"}\n# Missing defaults added by setup; existing values preserved.\n${additions.join("\n")}\n`);
  }
  return { created: false, added: additions.map((line) => line.split("=", 1)[0]) };
}
