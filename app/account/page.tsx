import { accountText } from "@/lib/i18n/account";
import { getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { ButtonLink } from "@/app/_components/material";
import PageFrame from "@/app/_components/page-frame";
import { getGoogleProviderOptions, readSession, safeReturnPath } from "@/lib/auth/server";
import { readDietaryPreferences } from "@/lib/dietary/server";
import AccountForm from "./account-form";
import DietaryPreferencesForm from "./dietary-preferences-form";
import ProfileForm from "./profile-form";
import { activeUsernameCooldown } from "./profile-options";
import AvatarForm from "./avatar-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: accountText(await getLocale())("Account") };
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const [locale, session, params, preferences] = await Promise.all([
    getLocale(), readSession(), searchParams, readDietaryPreferences().catch(() => null),
  ]);
  const t = accountText(locale);
  const returnTo = safeReturnPath(params.returnTo, "/");
  const lockedUntil = activeUsernameCooldown(session?.user.usernameChangeAvailableAt)
    ?.toLocaleString(locale === "en" ? "en-US" : locale, { dateStyle: "long", timeStyle: "long", timeZone: "UTC" }) ?? null;
  return (
    <PageFrame title={t("Your account")} back={{ href: "/recipes", label: t("Explore recipes") }} narrow>
      {session && <ButtonLink href={`/users/${session.user.id}`} variant="outline" className="min-h-11">{t("View my recipe page")}</ButtonLink>}
      {session && <ProfileForm name={session.user.name ?? ""} username={session.user.username} lockedUntil={lockedUntil} />}
      {session && <section id="avatar" aria-label={t("Avatar settings")} className="space-y-3">
        {params.avatar === "retry" && (
          <div className="site-panel space-y-2">
            {!session.user.image && <p role="status">{t("Your account was created. Your photo couldn’t be saved. Choose a photo below to try again.")}</p>}
            <ButtonLink href={returnTo} variant="outline">{t("Continue")}</ButtonLink>
          </div>
        )}
        <AvatarForm name={session.user.name ?? ""} image={session.user.image ?? null} />
      </section>}
      <div className="site-panel space-y-5">
        {params.error && (
          <p role="alert" className="text-sm text-rust">
            {t(params.error === "access_denied"
              ? "Google sign-in was canceled. You can try again."
              : "Google sign-in couldn’t be completed. Please try again.")}
          </p>
        )}
        <AccountForm signedInEmail={session?.user.email} googleEnabled={Boolean(getGoogleProviderOptions())} returnTo={returnTo} />
      </div>
      {session && (preferences ? <DietaryPreferencesForm preferences={preferences} /> : (
        <p role="alert" className="site-panel text-sm text-rust">{t("Couldn’t load your dietary preferences. Reload the page to try again.")}</p>
      ))}
    </PageFrame>
  );
}
