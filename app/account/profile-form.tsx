"use client";

import { accountText } from "@/lib/i18n/account";
import { useLocale } from "@/app/_components/language-provider";
import { useState, useTransition, type FormEvent } from "react";
import { Button, Input } from "@/app/_components/material";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/auth/limits";
import { saveProfile } from "./profile-actions";
import { usernameHint, usernamePattern } from "./profile-options";

export default function ProfileForm({ name, username, lockedUntil }: { name: string; username: string; lockedUntil: string | null }) {
  const t = accountText(useLocale());
  const [draftName, setDraftName] = useState(name);
  const [draftUsername, setDraftUsername] = useState(username);
  const [feedback, setFeedback] = useState({ message: "", error: false });
  const [pending, startTransition] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await saveProfile({ name: draftName, ...(draftUsername !== username && { username: draftUsername }) });
        if ("error" in result) {
          setFeedback({ message: result.error, error: true });
          return;
        }
        setDraftName(result.name);
        setDraftUsername(result.username);
        setFeedback({ message: "Profile saved.", error: false });
      } catch {
        setFeedback({ message: "Couldn’t save your profile. Please try again.", error: true });
      }
    });
  }

  return (
    <form onSubmit={save} onChange={() => setFeedback({ message: "", error: false })} className="site-panel space-y-4">
      <h2 className="site-heading text-xl">{t("Profile")}</h2>
      <fieldset disabled={pending} className="grid gap-4">
        <div className="grid gap-1">
          <label htmlFor="profile-name" className="text-sm font-medium">{t("Display name")}</label>
          <Input id="profile-name" className="min-h-11 text-base" autoComplete="name" required maxLength={MAX_DISPLAY_NAME_LENGTH} aria-describedby="profile-name-hint"
            value={draftName} onChange={event => setDraftName(event.target.value)} />
          <p id="profile-name-hint" className="text-sm text-subtle">{t("Shown on your recipes. You can use the same display name as another cook.")}</p>
        </div>
        <div className="grid gap-1">
          <label htmlFor="profile-username" className="text-sm font-medium">{t("Username")}</label>
          <Input id="profile-username" name="username" className="min-h-11 text-base" autoComplete="username" autoCapitalize="none"
            spellCheck={false} disabled={Boolean(lockedUntil)} required pattern={usernamePattern}
            aria-describedby="profile-username-hint" title={t(usernameHint)}
            value={draftUsername} onChange={event => setDraftUsername(event.target.value)} />
          <p id="profile-username-hint" className="text-sm text-subtle">
            {lockedUntil ? t("You can change your username again on {date}.", { date: lockedUntil })
              : t("Your username is unique. {hint} You can change it once a month.", { hint: t(usernameHint) })}
          </p>
        </div>
        <Button type="submit" className="min-h-11 justify-self-start" disabled={pending || (draftName === name && draftUsername === username)}>
          {t(pending ? "Saving…" : "Save profile")}
        </Button>
      </fieldset>
      {feedback.message && <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "text-sm text-rust" : "text-sm"}>{t(feedback.message)}</p>}
    </form>
  );
}
