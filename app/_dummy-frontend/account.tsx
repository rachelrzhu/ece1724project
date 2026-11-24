import { getGoogleProviderOptions, readSession } from "@/lib/auth/server";
import AccountForm from "./account-form";
import PageFrame from "./page-frame";

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const [session, { error }] = await Promise.all([readSession(), searchParams]);
  return (
    <PageFrame title="Account" back={{ href: "/", label: "Back to recipes" }}>
      {error && (
        <p role="alert">
          {error === "access_denied"
            ? "Google sign-in was canceled. You can try again."
            : "Google sign-in could not be completed. Please try again."}
        </p>
      )}
      <AccountForm signedInEmail={session?.user.email} googleEnabled={Boolean(getGoogleProviderOptions())} />
    </PageFrame>
  );
}
