"use client";

import { Button } from "@/app/_components/material";
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
          callbackURL: "/recipes",
          errorCallbackURL: "/recipes",
        });
        setFailed(Boolean(error));
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="min-h-11" onClick={signIn} disabled={pending}>
        {pending ? "Connecting to Google…" : "Continue with Google"}
      </Button>
      {failed && <p role="alert" className="text-sm text-rust">Couldn’t connect to Google. Try again.</p>}
    </div>
  );
}
