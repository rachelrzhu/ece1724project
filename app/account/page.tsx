import type { Metadata } from "next";
import PageFrame from "@/app/_components/page-frame";
import { getGoogleProviderOptions, readSession, safeReturnPath } from "@/lib/auth/server";
import { readDietaryPreferences } from "@/lib/dietary/server";
import AccountForm from "./account-form";
import DietaryPreferencesForm from "./dietary-preferences-form";
import ProfileForm from "./profile-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const [session, params, preferences] = await Promise.all([
    readSession(), searchParams, readDietaryPreferences().catch(() => null),
  ]);
  const returnTo = safeReturnPath(params.returnTo, "/");
  return (
    <PageFrame title="Your account" back={{ href: "/", label: "Explore recipes" }} narrow>
      {session && <ProfileForm name={session.user.name ?? ""} username={session.user.username} image={session.user.image ?? null} />}
      <div className="site-panel space-y-5">
        {params.error && (
          <p role="alert" className="text-sm text-rust">
            {params.error === "access_denied"
              ? "Google sign-in was canceled. You can try again."
              : "Google sign-in couldn’t be completed. Please try again."}
          </p>
        )}
        <AccountForm signedInEmail={session?.user.email} googleEnabled={Boolean(getGoogleProviderOptions())} returnTo={returnTo} />
      </div>
      {session && (preferences ? <DietaryPreferencesForm preferences={preferences} /> : (
        <p role="alert" className="site-panel text-sm text-rust">Couldn’t load your dietary preferences. Reload the page to try again.</p>
      ))}
    </PageFrame>
  );
}
