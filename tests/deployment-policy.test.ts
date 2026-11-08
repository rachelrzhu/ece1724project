import { describe, expect, it } from "vitest";
import { validateDeployment, validatePromotion } from "../scripts/deployment-policy.mjs";

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
