"use client";

import { Button } from "@heroui/react/button";
import { createAuthClient } from "better-auth/client";
import { useState, useTransition } from "react";

const authClient = createAuthClient();

export default function AccountButton({ signedIn }: { signedIn: boolean }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function submit() {
    setFailed(false);
    startTransition(async () => {
      try {
        if (signedIn) {
          const { error } = await authClient.signOut();
          if (error) setFailed(true);
          else window.location.replace("/");
        } else {
          const { error } = await authClient.signIn.social({
            provider: "google",
            callbackURL: "/",
            errorCallbackURL: "/",
          });
          if (error) setFailed(true);
        }
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onPress={submit} isDisabled={pending}>
        {pending ? "Please wait…" : signedIn ? "Sign out" : "Continue with Google"}
      </Button>
      {failed && (
        <p role="alert">
          {signedIn
            ? "Could not sign out. Please try again."
            : "Could not start Google sign-in. Please try again."}
        </p>
      )}
    </>
  );
}
