"use client";

import { Button } from "@heroui/react/button";
import { createAuthClient } from "better-auth/client";
import { useState, useTransition } from "react";

const auth = createAuthClient();

export default function GoogleSignInButton() {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function signIn() {
    setFailed(false);
    startTransition(async () => {
      try {
        const { error } = await auth.signIn.social({
          provider: "google",
          callbackURL: "/",
          errorCallbackURL: "/",
        });
        setFailed(Boolean(error));
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="site-button-outline" onPress={signIn} isDisabled={pending}>
        {pending ? "Connecting to Google…" : "Continue with Google"}
      </Button>
      {failed && <p role="alert" className="text-sm text-rust">Couldn’t connect to Google. Try again.</p>}
    </div>
  );
}
