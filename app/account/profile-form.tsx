"use client";

import Image from "next/image";
import { useState, useTransition, type FormEvent } from "react";
import { saveProfile } from "./profile-actions";
import { avatars, usernameHint, usernamePattern } from "./profile-options";

export default function ProfileForm({ name, username, image }: { name: string; username: string; image: string | null }) {
  const [draftName, setDraftName] = useState(name);
  const [draftUsername, setDraftUsername] = useState(username);
  const [avatar, setAvatar] = useState(image);
  const [feedback, setFeedback] = useState({ message: "", error: false });
  const [pending, startTransition] = useTransition();
  const choices = [
    ...(image && !avatars.some(choice => choice.image === image) ? [{ label: "Current photo", image }] : []),
    ...avatars, { label: "Initial", image: null },
  ];

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await saveProfile({ name: draftName, username: draftUsername, image: avatar });
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
      <h2 className="site-heading text-xl">Profile</h2>
      <fieldset disabled={pending} className="grid gap-4">
        <div className="grid gap-1">
          <label htmlFor="profile-name">Display name</label>
          <input id="profile-name" className="site-field" autoComplete="name" required maxLength={120} aria-describedby="profile-name-hint"
            value={draftName} onChange={event => setDraftName(event.target.value)} />
          <p id="profile-name-hint" className="text-sm text-subtle">Shown on recipes you share.</p>
        </div>
        <div className="grid gap-1">
          <label htmlFor="profile-username">Username</label>
          <input id="profile-username" name="username" className="site-field" autoComplete="username" autoCapitalize="none"
            spellCheck={false} required minLength={3} maxLength={32} pattern={usernamePattern}
            aria-describedby="profile-username-hint" title={usernameHint}
            value={draftUsername} onChange={event => setDraftUsername(event.target.value)} />
          <p id="profile-username-hint" className="text-sm text-subtle">{usernameHint}</p>
        </div>
        <fieldset>
          <legend className="mb-2">Avatar</legend>
          <div className="flex flex-wrap gap-3">
            {choices.map(choice => (
              <label key={choice.label} className="grid cursor-pointer justify-items-center gap-1 text-xs">
                <input type="radio" name="avatar" className="peer sr-only" checked={avatar === choice.image}
                  onChange={() => setAvatar(choice.image)} />
                <span className="grid size-12 place-items-center overflow-hidden rounded-full bg-paper text-xl font-bold ring-line peer-checked:ring-2 peer-checked:ring-brand peer-checked:ring-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4">
                  {choice.image ? <Image src={choice.image} unoptimized width={48} height={48} alt="" className="size-full object-cover" />
                    : draftName.trim().charAt(0).toUpperCase() || "?"}
                </span>
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="site-button justify-self-start" disabled={pending || (draftName === name && draftUsername === username && avatar === image)}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </fieldset>
      {feedback.message && <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "text-sm text-rust" : "text-sm"}>{feedback.message}</p>}
    </form>
  );
}
