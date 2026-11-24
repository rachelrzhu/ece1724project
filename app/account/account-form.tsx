"use client";

import { Button, Form, Input, Label, TextField } from "@heroui/react";
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
          setError("Enter your name.");
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
      <Form className="grid w-full gap-4" onSubmit={submit}>
        {signedInEmail ? (
          <p className="text-subtle wrap-anywhere">Signed in as <strong className="text-ink">{signedInEmail}</strong></p>
        ) : (
          <>
            <h2 className="site-heading text-2xl">{registering ? "Create your account" : "Sign in to your account"}</h2>
            {registering && (
              <TextField name="name" autoComplete="name" fullWidth isRequired>
                <Label>Name</Label>
                <Input className="site-field" maxLength={120} />
              </TextField>
            )}
            <TextField name="email" type="email" autoComplete="email" fullWidth isRequired>
              <Label>Email</Label>
              <Input className="site-field" />
            </TextField>
            <TextField name="password" type="password" fullWidth isRequired
              autoComplete={registering ? "new-password" : "current-password"}>
              <Label>Password{registering && " (8–128 characters)"}</Label>
              <Input className="site-field" minLength={registering ? 8 : undefined} maxLength={128} />
            </TextField>
          </>
        )}
        <Button type="submit" className="site-button justify-self-start" isDisabled={pending}>
          {pending ? "Please wait…" : submitLabel}
        </Button>
      </Form>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-rust">{error}</p>}
      {!signedInEmail && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {googleEnabled && (
            <Button type="button" variant="secondary" className="site-button-outline" isDisabled={pending} onPress={continueWithGoogle}>
              Continue with Google
            </Button>
          )}
          <Button type="button" variant="ghost" isDisabled={pending} onPress={() => {
            setRegistering(!registering);
            setError("");
          }}>
            {registering ? "Use an existing account" : "Register a new account"}
          </Button>
        </div>
      )}
    </div>
  );
}
