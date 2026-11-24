import type { Metadata } from "next";
import PageFrame from "@/app/_components/page-frame";
import { getGoogleProviderOptions, readSession, safeReturnPath } from "@/lib/auth/server";
<<<<<<< Updated upstream
=======
import { readDietaryPreferences } from "@/lib/dietary/server";
import ProfileForm from "./profile-form";
>>>>>>> Stashed changes
import AccountForm from "./account-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const [session, params] = await Promise.all([readSession(), searchParams]);
  const returnTo = safeReturnPath(params.returnTo, "/");
  return (
    <PageFrame title="Your account" back={{ href: "/", label: "Explore recipes" }} narrow>
      {session && <ProfileForm name={session.user.name ?? ""} image={session.user.image ?? null} />}
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
    </PageFrame>
  );
}
