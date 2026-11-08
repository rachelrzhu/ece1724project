import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateDeployment(environment) {
  if (environment.VERCEL !== "1") return;

  if (environment.VERCEL_ENV === "production" && environment.VERCEL_GIT_COMMIT_REF !== "main") {
    throw new Error("Production builds must come from main. Push to dev or preprod for a Preview deployment.");
  }
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
    } else if (process.argv[2] === "promotion") {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
      validatePromotion(event.pull_request);
    } else {
      throw new Error("Usage: node scripts/deployment-policy.mjs build|promotion");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
