import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { getAuth } from "@/lib/auth/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("better-auth/adapters/prisma", async () => {
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  return {
    prismaAdapter: () =>
      memoryAdapter({ user: [], account: [], session: [], verification: [] }),
  };
});

const origin = "https://savor.example.test";
const clientId = "savor-test.apps.googleusercontent.com";
const callbackURL = origin + "/api/auth/callback/google";

beforeAll(() => {
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "local-test-only-secret-for-google-oauth-integration",
  );
  vi.stubEnv("GOOGLE_CLIENT_ID", clientId);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-only-google-secret");
});
afterAll(() => vi.unstubAllEnvs());
afterEach(() => vi.restoreAllMocks());

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

async function beginSignIn() {
  const response = await POST(
    new Request(origin + "/api/auth/sign-in/social", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/account",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const google = new URL((await response.json()).url);
  expect(google.origin).toBe("https://accounts.google.com");
  expect(google.searchParams.get("client_id")).toBe(clientId);
  expect(google.searchParams.get("redirect_uri")).toBe(callbackURL);
  const state = google.searchParams.get("state");
  expect(state).toBeTruthy();
  const callback = new URL(callbackURL);
  callback.searchParams.set("state", state!);
  return { callback, headers: { Cookie: cookies(response) } };
}

it("returns a user who cancels Google sign-in to the app without a session", async () => {
  const { callback, headers } = await beginSignIn();
  callback.searchParams.set("error", "access_denied");
  const response = await GET(new Request(callback, { headers }));
  expect(response.status).toBe(302);
  expect(new URL(response.headers.get("Location")!, origin).href).toBe(
    origin + "/account?error=access_denied",
  );
  expect(cookies(response)).not.toContain("savor.session_token");
});

it("sets an app session after a successful Google callback and revokes it on sign-out", async () => {
  const { callback, headers } = await beginSignIn();
  // Simulate the external provider's code exchange and returned identity.
  const { socialProviders } = await getAuth().$context;
  const google = socialProviders.find((provider) => provider.id === "google")!;
  const exchange = vi
    .spyOn(google, "validateAuthorizationCode")
    .mockResolvedValue({ accessToken: "test-access-token" });
  const user = {
    email: "cook@example.test",
    name: "Test Cook",
    emailVerified: true,
  };
  vi.spyOn(google, "getUserInfo").mockResolvedValue({
    user,
    data: { sub: "test-google-subject" },
  });

  callback.searchParams.set("code", "test-auth-code");
  const response = await GET(new Request(callback, { headers }));
  expect(response.status).toBe(302);
  expect(new URL(response.headers.get("Location")!, origin).href).toBe(
    origin + "/",
  );
  expect(exchange).toHaveBeenCalledWith(
    expect.objectContaining({
      code: "test-auth-code",
      codeVerifier: expect.any(String),
      redirectURI: callbackURL,
    }),
  );
  const cookie = cookies(response);
  const sessionRequest = () =>
    GET(
      new Request(origin + "/api/auth/get-session", {
        headers: { Cookie: cookie },
      }),
    );
  expect(await (await sessionRequest()).json()).toMatchObject({ user });

  const signOut = await POST(
    new Request(origin + "/api/auth/sign-out", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
  );
  expect(signOut.status).toBe(200);
  expect(await (await sessionRequest()).json()).toBeNull();
});
