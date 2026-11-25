"use client";

import { Button, Input } from "@/app/_components/material";
import {
  MAX_DISPLAY_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_EXISTING_PASSWORD_LENGTH,
  MAX_NEW_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH,
} from "@/lib/auth/limits";
import { createAuthClient } from "better-auth/client";
import { useState, useTransition, type FormEvent } from "react";
import { saveAvatar } from "./avatar-actions";
import AvatarUploadField from "./avatar-upload-field";

const auth = createAuthClient();

type AccountFormProps = {
  signedInEmail?: string;
  googleEnabled: boolean;
  returnTo: string;
};

export default function AccountForm({ signedInEmail, googleEnabled, returnTo }: AccountFormProps) {
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const submitLabel = signedInEmail ? "Sign out" : registering ? "Create account" : "Sign in";
  const pendingLabel = signedInEmail ? "Signing out…" : registering ? "Creating account…" : "Signing in…";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError("");
    setNotice("");

    startTransition(async () => {
      try {
        const credentials = {
          email: String(fields.get("email") ?? "").trim(),
          password: String(fields.get("password") ?? ""),
        };
        if (registering && !signedInEmail) {
          const name = String(fields.get("name") ?? "").trim();
          if (!name) {
            setError("Enter a display name.");
            return;
          }
          const result = await auth.signUp.email({ ...credentials, name });
          if (result.error) {
            if (result.error.code === "SIGNUP_BROWSER_REQUIRED" || result.error.code === "SIGNUP_CHECK_UNAVAILABLE") {
              setError(result.error.message ?? "We couldn’t verify your browser. Reload the page and try again.");
            } else setError(result.error.status === 429 ? "Too many attempts. Please try again later."
              : "Couldn’t create your account. Check your details or try signing in.");
            return;
          }
          if (!result.data.token) {
            setRegistering(false);
            setNotice("Check your email to finish signing up. After you sign in, you can upload your avatar in Account.");
            return;
          }
          const photo = fields.get("photo");
          if (photo instanceof File && photo.size > 0) {
            const upload = new FormData();
            upload.set("avatar", "upload");
            upload.set("photo", photo);
            const saved = await saveAvatar(upload, result.data.user.id).catch(() => null);
            if (!saved || "error" in saved) {
              const query = new URLSearchParams({ avatar: "retry", returnTo });
              window.location.replace(`/account?${query}#avatar`);
              return;
            }
          }
        } else {
          const result = signedInEmail ? await auth.signOut() : await auth.signIn.email(credentials);
          if (result.error) {
            setError(result.error.status === 429 ? "Too many attempts. Please try again later."
              : signedInEmail ? "Couldn’t sign out. Please try again." : "Couldn’t sign in. Check your email and password and try again.");
            return;
          }
        }

        window.location.replace(signedInEmail ? "/" : returnTo);
      } catch {
        setError("Couldn’t reach the account service. Please try again.");
      }
    });
  }

  function continueWithGoogle() {
    setError("");
    startTransition(async () => {
      try {
        const result = await auth.signIn.social({
          provider: "google",
          callbackURL: returnTo,
          errorCallbackURL: returnTo === "/" ? "/account" : `/account?${new URLSearchParams({ returnTo })}`,
        });
        if (result.error) setError("Couldn’t start Google sign-in. Please try again.");
      } catch {
        setError("Couldn’t reach the account service. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <form method="post" className="grid w-full gap-4" onSubmit={submit}>
        {signedInEmail ? (
          <p className="text-subtle wrap-anywhere">Signed in as <strong className="text-ink">{signedInEmail}</strong></p>
        ) : (
          <>
            <h2 className="site-heading text-xl">{registering ? "Create an account" : "Sign in with email"}</h2>
            {registering && (
              <div className="grid gap-1.5">
                <label htmlFor="account-name" className="text-sm font-medium">Display name</label>
                <Input id="account-name" name="name" autoComplete="name" maxLength={MAX_DISPLAY_NAME_LENGTH} required className="min-h-11 text-base" />
              </div>
            )}
            <div className="grid gap-1.5">
              <label htmlFor="account-email" className="text-sm font-medium">Email</label>
              <Input id="account-email" name="email" type="email" autoComplete="email" maxLength={registering ? MAX_EMAIL_LENGTH : undefined} required className="min-h-11 text-base" />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="account-password" className="text-sm font-medium">Password{registering && ` (${MIN_PASSWORD_LENGTH}–${MAX_NEW_PASSWORD_LENGTH} characters)`}</label>
              <Input id="account-password" name="password" type="password" required className="min-h-11 text-base"
                autoComplete={registering ? "new-password" : "current-password"}
                minLength={registering ? MIN_PASSWORD_LENGTH : undefined}
                maxLength={registering ? MAX_NEW_PASSWORD_LENGTH : MAX_EXISTING_PASSWORD_LENGTH} />
            </div>
            {registering && <AvatarUploadField id="signup-avatar" label="Avatar photo (optional)" />}
          </>
        )}
        <Button type="submit" className="min-h-11 justify-self-start" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </form>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-rust">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {!signedInEmail && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {googleEnabled && (
            <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={continueWithGoogle}>
              Continue with Google
            </Button>
          )}
          <Button type="button" variant="ghost" className="min-h-11" disabled={pending} onClick={() => {
            setRegistering(!registering);
            setError("");
            setNotice("");
          }}>
            {registering ? "Use an existing account" : "Create an account"}
          </Button>
        </div>
      )}
    </div>
  );
}
