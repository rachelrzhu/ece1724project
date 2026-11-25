import { expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/[...all]/route";

const handler = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/server", () => ({ getAuth: () => ({ handler }) }));

it("rejects oversized account bodies before invoking authentication, with or without a declared length", async () => {
  const url = "https://example.test/api/auth/sign-in/email";
  const body = new Uint8Array(16 * 1024 + 1);
  for (const headers of [new Headers({ "Content-Length": String(body.length) }), new Headers()]) {
    const response = await POST(new Request(url, { method: "POST", headers, body }));
    expect(response.status).toBe(413);
  }
  expect(handler).not.toHaveBeenCalled();
});
