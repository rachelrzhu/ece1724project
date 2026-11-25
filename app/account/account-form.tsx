"use client";

import { Button, Input } from "@/app/_components/material";
import { createAuthClient } from "better-auth/client";
import { useState, useTransition, type FormEvent } from "react";

const auth = createAuthClient();

type AccountFormProps = {
  signedInEmail?: string;
  googleEnabled: boolean;
  returnTo: string;
};

export default function AccountForm({ signedInEmail, googleEnabled, returnTo }: AccountFormProps) {
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const submitLabel = signedInEmail ? "Sign out" : registering ? "Create account" : "Sign in";
  const pendingLabel = signedInEmail ? "Signing out…" : registering ? "Creating account…" : "Signing in…";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError("");

    startTransition(async () => {
      try {
        const credentials = {
          email: String(fields.get("email") ?? "").trim(),
          password: String(fields.get("password") ?? ""),
        };
        const name = String(fields.get("name") ?? "").trim();
        if (registering && !name) {
          setError("Enter a display name.");
          return;
        }
        const result = signedInEmail ? await auth.signOut()
          : registering ? await auth.signUp.email({ ...credentials, name })
            : await auth.signIn.email(credentials);
        if (result.error) {
          setError(signedInEmail ? "Couldn’t sign out. Please try again."
            : registering ? "Couldn’t create your account. Check your details or try signing in."
              : "Couldn’t sign in. Check your email and password and try again.");
          return;
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
      <form className="grid w-full gap-4" onSubmit={submit}>
        {signedInEmail ? (
          <p className="text-subtle wrap-anywhere">Signed in as <strong className="text-ink">{signedInEmail}</strong></p>
        ) : (
          <>
            <h2 className="site-heading text-xl">{registering ? "Create an account" : "Sign in with email"}</h2>
            {registering && (
              <div className="grid gap-1.5">
                <label htmlFor="account-name" className="text-sm font-medium">Display name</label>
                <Input id="account-name" name="name" autoComplete="name" maxLength={120} required className="min-h-11 text-base" />
              </div>
            )}
            <div className="grid gap-1.5">
              <label htmlFor="account-email" className="text-sm font-medium">Email</label>
              <Input id="account-email" name="email" type="email" autoComplete="email" required className="min-h-11 text-base" />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="account-password" className="text-sm font-medium">Password{registering && " (8–128 characters)"}</label>
              <Input id="account-password" name="password" type="password" required className="min-h-11 text-base"
                autoComplete={registering ? "new-password" : "current-password"}
                minLength={registering ? 8 : undefined} maxLength={128} />
            </div>
          </>
        )}
        <Button type="submit" className="min-h-11 justify-self-start" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </form>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-rust">{error}</p>}
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
          }}>
            {registering ? "Use an existing account" : "Create an account"}
          </Button>
        </div>
      )}
    </div>
  );
}
