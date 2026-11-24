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

it("imports the Google profile once and keeps local edits on later sign-ins", async () => {
  const profile = {
    sub: "test-google-subject",
    email: "cook@example.test",
    email_verified: true,
    name: "Robin Lee",
    given_name: "Robin",
    family_name: "Lee",
    picture: "https://example.test/robin.jpg",
  };
  // Only the external code exchange is mocked. The provider maps the claims.
  const idToken = [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(profile)).toString("base64url"),
    "",
  ].join(".");
  const { adapter, socialProviders } = await getAuth().$context;
  const google = socialProviders.find((provider) => provider.id === "google")!;
  const exchange = vi
    .spyOn(google, "validateAuthorizationCode")
    .mockResolvedValue({ accessToken: "test-access-token", idToken });

  async function signInWithGoogle() {
    const { callback, headers } = await beginSignIn();
    callback.searchParams.set("code", "test-auth-code");
    const response = await GET(new Request(callback, { headers }));
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("Location")!, origin).href).toBe(
      origin + "/",
    );
    return cookies(response);
  }
  const cookie = await signInWithGoogle();
  expect(exchange).toHaveBeenCalledWith(
    expect.objectContaining({
      code: "test-auth-code",
      codeVerifier: expect.any(String),
      redirectURI: callbackURL,
    }),
  );
  async function readUserSession(sessionCookie: string) {
    const response = await GET(
      new Request(origin + "/api/auth/get-session", {
        headers: { Cookie: sessionCookie },
      }),
    );
    return response.json();
  }
  const { user } = await readUserSession(cookie);
  expect(user).toMatchObject({
    email: profile.email, emailVerified: true, name: profile.name, image: profile.picture,
  });
  const linkedAccounts = await getAuth().api.listUserAccounts({ headers: { Cookie: cookie } });
  expect(linkedAccounts).toEqual([
    expect.objectContaining({ providerId: "google", accountId: profile.sub, userId: user.id }),
  ]);
  const localProfile = { name: "Chef Robin", username: "chef_robin", image: "/images/toast.jpg" };
  await adapter.update({
    model: "user",
    where: [{ field: "id", value: user.id }],
    update: localProfile,
  });

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
  expect(await readUserSession(cookie)).toBeNull();
  const nextSession = await readUserSession(await signInWithGoogle());
  expect(nextSession.user).toMatchObject({ id: user.id, ...localProfile });
});
