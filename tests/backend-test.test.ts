import { describe, expect, it, vi } from "vitest";
import { backendTestConfigSchema } from "@/lib/backend-test/config";
import { BackendTestError, checkBackendTestRequest } from "@/lib/backend-test/policy";
import { imageBody, limitedBody, recipeBody } from "@/lib/backend-test/http";
import { ownerId } from "./fixtures";

vi.mock("server-only", () => ({}));

describe("local backend tester access", () => {
  it("accepts a local development request", () => {
    expect(() => checkBackendTestRequest(new Request("http://127.0.0.1:3000/api/backend-test/recipes"), "development")).not.toThrow();
  });
  it.each(["production", "test", undefined])("disables tester APIs in %s", (environment) => {
    expect(() => checkBackendTestRequest(new Request("http://localhost/api/backend-test/recipes"), environment)).toThrow(BackendTestError);
  });
  it("rejects remote hosts and lookalike loopback domains", () => {
    for (const host of ["example.com", "localhost.example.com"]) {
      expect(() => checkBackendTestRequest(new Request(`http://${host}/api/backend-test/recipes`), "development")).toThrow();
    }
  });
  it("rejects missing/foreign origins for writes and cross-site reads", () => {
    for (const origin of [undefined, "http://example.com"]) {
      expect(() => checkBackendTestRequest(new Request("http://localhost/api/backend-test/recipes", { method: "POST", headers: origin ? { origin } : {} }), "development")).toThrow();
    }
    expect(() => checkBackendTestRequest(new Request("http://localhost/api/backend-test/recipes", { headers: { "sec-fetch-site": "cross-site" } }), "development")).toThrow();
    expect(() => checkBackendTestRequest(new Request("http://localhost/api/backend-test/recipes", { method: "POST", headers: { origin: "http://localhost" } }), "development")).not.toThrow();
  });
  it("only accepts generated sandbox schema names", () => {
    expect(backendTestConfigSchema.safeParse({ schema: `backend_test_${"a".repeat(32)}`, ownerId }).success).toBe(true);
    for (const schema of ["public", "backend_test_public", 'backend_test_";DROP SCHEMA public;']) {
      expect(backendTestConfigSchema.safeParse({ schema, ownerId }).success).toBe(false);
    }
  });
  it("uses the local Host header when Next normalizes the request URL", () => {
    expect(() => checkBackendTestRequest(new Request("http://localhost:3000/api/backend-test/recipes", {
      method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
    }), "development")).not.toThrow();
    expect(() => checkBackendTestRequest(new Request("http://localhost:3000/api/backend-test/recipes", {
      method: "POST", headers: { host: "example.com", origin: "http://example.com" },
    }), "development")).toThrow();
  });
});

describe("tester request limits", () => {
  it("bounds the actual streamed body despite a misleading Content-Length", async () => {
    const request = new Request("http://localhost", { method: "POST", headers: { "Content-Length": "1" }, body: "12345" });
    await expect(limitedBody(request, 4)).rejects.toMatchObject({ status: 413 });
  });
  it("returns a useful error for malformed JSON", async () => {
    await expect(recipeBody(new Request("http://localhost", { method: "POST", body: "not-json" }))).rejects.toMatchObject({ status: 400 });
  });
  it("returns a client error for malformed multipart rather than a server error", async () => {
    const request = new Request("http://localhost", {
      method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=missing" }, body: "broken multipart",
    });
    await expect(imageBody(request)).rejects.toMatchObject({ status: 400, message: "Send valid multipart form data." });
  });
  it("requires an image file rather than a text field", async () => {
    const form = new FormData();
    form.set("image", "not a file");
    await expect(imageBody(new Request("http://localhost", { method: "POST", body: form }))).rejects.toMatchObject({ status: 400 });
  });
  it("preserves uploaded bytes and the filename for image validation", async () => {
    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "sample.png", { type: "image/png" }));
    await expect(imageBody(new Request("http://localhost", { method: "POST", body: form }))).resolves.toEqual({
      name: "sample.png", bytes: new Uint8Array([1, 2, 3]),
    });
  });
});
