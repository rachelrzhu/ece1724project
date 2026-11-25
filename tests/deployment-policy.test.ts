import { describe, expect, it } from "vitest";
import { deploymentMigrationUrl, validateDeployment, validatePromotion } from "../scripts/deployment-policy.mjs";

describe("deployment safety", () => {
  it("allows local builds and Preview builds for dev and preprod", () => {
    expect(() => validateDeployment({})).not.toThrow();
    for (const branch of ["dev", "preprod", "codex/feature"]) {
      expect(() => validateDeployment({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: branch })).not.toThrow();
    }
  });

  it("allows production builds only from main", () => {
    expect(() => validateDeployment({ VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" })).not.toThrow();
    for (const branch of [undefined, "", "dev", "preprod", "codex/feature"]) {
      expect(() => validateDeployment({ VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: branch })).toThrow("Production builds must come from main");
    }
  });
});

describe("automatic deployment migrations", () => {
  const dev = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "dev",
    VERCEL_GIT_REPO_OWNER: "rachelrzhu",
    VERCEL_GIT_REPO_SLUG: "ece1724project",
    DATABASE_URL: "postgresql://pooled.example/recipes",
    DIRECT_URL: "postgresql://direct.example/recipes",
  };

  it.each(["dev", "preprod"])("uses the configured direct URL for the %s Preview", (branch) => {
    expect(deploymentMigrationUrl({ ...dev, VERCEL_GIT_COMMIT_REF: branch, DATABASE_URL_UNPOOLED: "unused" }))
      .toBe(dev.DIRECT_URL);
  });

  it("uses Neon's unpooled URL when deploying main without DIRECT_URL", () => {
    expect(deploymentMigrationUrl({
      ...dev, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main",
      DIRECT_URL: undefined, DATABASE_URL_UNPOOLED: dev.DIRECT_URL,
    })).toBe(dev.DIRECT_URL);
  });

  it.each([
    { VERCEL_GIT_COMMIT_REF: "feature/recipe" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_TARGET_ENV: "custom" },
    { VERCEL_ENV: "development" },
  ])("skips deployments outside the release path (%o)", (override) => {
    expect(deploymentMigrationUrl({ ...dev, ...override, DIRECT_URL: undefined })).toBeUndefined();
  });

  it("fails closed when release metadata or credentials are missing or incorrect", () => {
    expect(() => deploymentMigrationUrl({})).toThrow("system environment variables");
    expect(() => deploymentMigrationUrl({ ...dev, VERCEL_ENV: "production" })).toThrow("main");
    expect(() => deploymentMigrationUrl({ ...dev, VERCEL_GIT_REPO_OWNER: "fork" })).toThrow("Git deployment");
    expect(() => deploymentMigrationUrl({ ...dev, DATABASE_URL: "" })).toThrow("DATABASE_URL");
    expect(() => deploymentMigrationUrl({ ...dev, DIRECT_URL: " " })).toThrow("DIRECT_URL");
  });
});

describe("release path", () => {
  const promotion = (base: string, head: string, source = "rachelrzhu/ece1724project") => ({
    base: { ref: base, repo: { full_name: "rachelrzhu/ece1724project" } },
    head: { ref: head, repo: { full_name: source } },
  });

  it("accepts dev to preprod and preprod to main", () => {
    expect(() => validatePromotion(promotion("preprod", "dev"))).not.toThrow();
    expect(() => validatePromotion(promotion("main", "preprod"))).not.toThrow();
    expect(() => validatePromotion(promotion("dev", "codex/feature"))).not.toThrow();
  });

  it("rejects changes that skip release stages or use a fork with the same branch name", () => {
    for (const [base, head] of [["main", "dev"], ["main", "codex/feature"], ["preprod", "codex/feature"]]) {
      expect(() => validatePromotion(promotion(base, head))).toThrow("must come from");
    }
    expect(() => validatePromotion(promotion("main", "preprod", "someone/fork"))).toThrow("must come from");
  });
});
