import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { getAuth } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";

vi.mock("server-only", () => ({}));

const origin = "https://savor.example.test";
const clientId = "savor-test.apps.googleusercontent.com";
const callbackURL = origin + "/api/auth/callback/google";
let database: PGlite;
let socket: PGLiteSocketServer;

beforeAll(async () => {
  database = await PGlite.create();
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const name of migrations) {
    await database.exec(readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
  }
  socket = new PGLiteSocketServer({ db: database, host: "127.0.0.1", port: 0 });
  await socket.start();
  vi.stubEnv("DATABASE_URL", `postgresql://postgres@${socket.getServerConn()}/postgres`);
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "local-test-only-secret-for-google-oauth-integration",
  );
  vi.stubEnv("GOOGLE_CLIENT_ID", clientId);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-only-google-secret");
});
afterAll(async () => {
  if (socket) {
    await getDatabase().$disconnect();
    await socket.stop();
  }
  await database?.close();
  vi.unstubAllEnvs();
});
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

function request(path: string, body: object, cookie = "") {
  return POST(new Request(origin + "/api/auth/" + path, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  }));
}

it("registers an email account with a generated username and signs it back in", async () => {
  const credentials = { email: "email-cook@example.test", password: "A test password" };
  const unsupported = { image: "https://example.test/personal-photo.png" };
  expect((await request("sign-up/email", { ...credentials, name: "Email Cook", ...unsupported })).status).toBe(400);
  const registered = await request("sign-up/email", { ...credentials, name: "Email Cook" });
  expect(registered.status).toBe(200);
  const { user } = await registered.json();
  expect(user.username).toBe("email_cook");
  const cookie = cookies(registered);
  expect((await readUserSession(cookie)).user.id).toBe(user.id);
  expect((await request("update-user", unsupported, cookie)).status).toBe(400);
  expect((await request("update-user", { username: "new_cook" }, cookie)).status).toBe(400);
  expect((await request("update-user", { usernameChangeAvailableAt: "2020-01-01" }, cookie)).status).toBe(400);
  const signedIn = await request("sign-in/email", credentials);
  expect(signedIn.status).toBe(200);
  expect((await readUserSession(cookies(signedIn))).user).toMatchObject({
    id: user.id, username: user.username,
  });
});

it("enforces new account limits and lets existing cooks replace a legacy password", async () => {
  const credentials = { email: "limits@example.test", password: "pepper", name: "  Chili Cook  " };
  for (const invalid of [
    { password: "short" }, { password: "x".repeat(33) }, { name: "  " },
    { name: "x".repeat(121) }, { email: "x".repeat(250) + "@a.com" },
  ]) {
    await expect(getAuth().api.signUpEmail({ body: { ...credentials, ...invalid } }))
      .rejects.toMatchObject({ statusCode: 400 });
  }
  const registered = await request("sign-up/email", credentials);
  expect(registered.status).toBe(200);
  const { user } = await registered.json();
  expect(user.name).toBe("Chili Cook");
  expect((await request("update-user", { name: "  " }, cookies(registered))).status).toBe(400);

  const previous = "p".repeat(128);
  const { password } = await getAuth().$context;
  await getDatabase().account.updateMany({
    where: { userId: user.id, providerId: "credential" }, data: { password: await password.hash(previous) },
  });
  const signedIn = await request("sign-in/email", { email: user.email, password: previous });
  expect(signedIn.status).toBe(200);
  const update = (newPassword: string) => request("change-password", { currentPassword: previous, newPassword }, cookies(signedIn));
  expect((await update("p".repeat(33))).status).toBe(400);
  expect((await update("p".repeat(32))).status).toBe(200);
});

async function readUserSession(sessionCookie: string) {
  const response = await GET(
    new Request(origin + "/api/auth/get-session", {
      headers: { Cookie: sessionCookie },
    }),
  );
  return response.json();
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
  const { user } = await readUserSession(cookie);
  expect(user).toMatchObject({
    email: profile.email, emailVerified: true, name: profile.name, image: profile.picture,
    username: "robin_lee",
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
  const updated = await getAuth().api.getSession({ headers: { Cookie: cookie } });
  expect(updated?.user.usernameChangeAvailableAt).toBeInstanceOf(Date);

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
