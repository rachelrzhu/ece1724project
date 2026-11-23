"use client";

import { Button, Form, Input, Label, TextField } from "@heroui/react";
import { createAuthClient } from "better-auth/client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

const auth = createAuthClient();

type AccountFormProps = {
  signedInEmail?: string;
  googleEnabled: boolean;
};

export default function AccountForm({ signedInEmail, googleEnabled }: AccountFormProps) {
  const router = useRouter();
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const submitLabel = signedInEmail ? "Sign out" : registering ? "Create account" : "Sign in";

  function requestAccount(fields: FormData) {
    if (signedInEmail) return auth.signOut();
    const credentials = {
      email: String(fields.get("email") ?? "").trim(),
      password: String(fields.get("password") ?? ""),
    };
    if (registering) {
      const name = String(fields.get("name") ?? "").trim();
      return auth.signUp.email({ ...credentials, name });
    }
    return auth.signIn.email(credentials);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const result = await requestAccount(fields);
        if (result.error) {
          setError(result.error.message || "The account request failed. Please try again.");
          return;
        }
        router.replace("/");
        router.refresh();
      } catch {
        setError("Could not reach the account service. Please try again.");
      }
    });
  }

  function continueWithGoogle() {
    setError("");
    startTransition(async () => {
      try {
        const result = await auth.signIn.social({
          provider: "google",
          callbackURL: "/",
          errorCallbackURL: "/account",
        });
        if (result.error) setError("Could not start Google sign-in. Please try again.");
      } catch {
        setError("Could not reach the account service. Please try again.");
      }
    });
  }

  return (
    <>
      {!signedInEmail && (
        <div className="space-y-1">
          <Button
            type="button"
            variant="secondary"
            isDisabled={pending || !googleEnabled}
            onPress={continueWithGoogle}
          >
            Continue with Google
          </Button>
          {!googleEnabled && <p>Google sign-in is unavailable in this environment.</p>}
        </div>
      )}
      <Form className="max-w-sm space-y-3" onSubmit={submit}>
        {signedInEmail ? (
          <p>Signed in as {signedInEmail}</p>
        ) : (
          <>
            {registering && (
              <TextField name="name" autoComplete="name" isRequired>
                <Label>Name</Label>
                <Input />
              </TextField>
            )}
            <TextField name="email" type="email" autoComplete="email" isRequired>
              <Label>Email</Label>
              <Input />
            </TextField>
            <TextField
              name="password"
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
              minLength={registering ? 8 : undefined}
              maxLength={128}
              isRequired
            >
              <Label>Password{registering && " (8–128 characters)"}</Label>
              <Input />
            </TextField>
          </>
        )}
        <Button type="submit" isDisabled={pending}>
          {pending ? "Please wait…" : submitLabel}
        </Button>
      </Form>
      {error && <p role="alert">{error}</p>}
      {!signedInEmail && (
        <Button
          variant="secondary"
          isDisabled={pending}
          onPress={() => {
            setRegistering(!registering);
            setError("");
          }}
        >
          {registering ? "Use an existing account" : "Register a new account"}
        </Button>
      )}
    </>
  );
}
