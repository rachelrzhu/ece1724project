import { expect, it } from "vitest";
import { safeReturnPath } from "@/lib/auth/return-path";
it("keeps local deep links", () =>
  expect(safeReturnPath("/recipes/new?draft=1")).toBe("/recipes/new?draft=1"));
it.each([
  "https://example.com",
  "//example.com",
  "/\\example.com",
  "/%5cexample.com",
  "/%2fexample.com",
  "/sign-in",
  "/sign-up?next=/sign-in",
  "/%0aevil",
  "%invalid",
  null,
])("rejects unsafe or looping auth return path %s", (value) =>
  expect(safeReturnPath(value)).toBe("/my-recipes"),
);
