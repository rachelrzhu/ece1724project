import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateDeployment(environment) {
  if (environment.VERCEL !== "1") return;

  if (environment.VERCEL_ENV === "production" && environment.VERCEL_GIT_COMMIT_REF !== "main") {
    throw new Error("Production builds must come from main. Push to dev or preprod for a Preview deployment.");
  }
}

export function deploymentMigrationUrl(environment) {
  const { VERCEL, VERCEL_ENV, VERCEL_TARGET_ENV, VERCEL_GIT_COMMIT_REF: branch } = environment;
  if (VERCEL !== "1" || !VERCEL_ENV) {
    throw new Error("Enable Vercel system environment variables so the migration step can identify the deployment.");
  }
  validateDeployment(environment);
  if (VERCEL_TARGET_ENV && VERCEL_TARGET_ENV !== VERCEL_ENV) return;
  if (VERCEL_ENV !== "production" && !(VERCEL_ENV === "preview" && ["dev", "preprod"].includes(branch))) {
    return;
  }

  const repository = `${environment.VERCEL_GIT_REPO_OWNER}/${environment.VERCEL_GIT_REPO_SLUG}`;
  if (repository.toLowerCase() !== "rachelrzhu/ece1724project") {
    throw new Error("Automatic database migrations require a Git deployment from rachelrzhu/ece1724project.");
  }
  const directUrl = environment.DIRECT_URL?.trim() || environment.DATABASE_URL_UNPOOLED?.trim();
  if (!environment.DATABASE_URL?.trim() || !directUrl) {
    throw new Error(`Set DATABASE_URL and either DIRECT_URL or DATABASE_URL_UNPOOLED for the ${branch} deployment.`);
  }
  return directUrl;
}

export function validatePromotion(pullRequest) {
  const expectedSource = { preprod: "dev", main: "preprod" }[pullRequest.base.ref];
  if (!expectedSource) return;

  if (pullRequest.head.ref !== expectedSource ||
      pullRequest.head.repo?.full_name !== pullRequest.base.repo.full_name) {
    throw new Error(`Changes to ${pullRequest.base.ref} must come from ${expectedSource} in this repository.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] === "build") {
      validateDeployment(process.env);
    } else if (process.argv[2] === "migrate") {
      const directUrl = deploymentMigrationUrl(process.env);
      if (directUrl) {
        console.log(`Applying committed migrations for ${process.env.VERCEL_GIT_COMMIT_REF}.`);
        execFileSync("npm", ["run", "db:migrate"], {
          stdio: "inherit",
          env: { ...process.env, DIRECT_URL: directUrl },
        });
      } else {
        console.log("Skipping database migrations for this deployment.");
      }
    } else if (process.argv[2] === "promotion") {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
      validatePromotion(event.pull_request);
    } else {
      throw new Error("Usage: node scripts/deployment-policy.mjs build|migrate|promotion");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
