import { getGoogleProviderOptions, readSession } from "@/lib/auth/server";
import AccountButton from "./account-button";

export default async function Home({ searchParams }: PageProps<"/">) {
  const [session, { error }] = await Promise.all([readSession(), searchParams]);
  const googleEnabled = Boolean(getGoogleProviderOptions());

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">Savor</h1>
      {session && <p>Signed in as {session.user.email}</p>}
      {session || googleEnabled ? (
        <AccountButton signedIn={Boolean(session)} />
      ) : (
        <p>Google sign-in is unavailable.</p>
      )}
      {error && (
        <p role="alert">
          {error === "access_denied"
            ? "Google sign-in was canceled. You can try again."
            : "Google sign-in could not be completed. Please try again."}
        </p>
      )}
      {process.env.NODE_ENV === "development" && (
        <a className="underline" href="/backend-test">Backend test page</a>
      )}
    </main>
  );
}
