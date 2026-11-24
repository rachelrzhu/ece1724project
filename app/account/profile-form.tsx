"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/client";
import { useState, useTransition, type FormEvent } from "react";

const auth = createAuthClient();
const avatars = [
  { label: "Toast", image: "/images/toast.jpg" },
  { label: "Pasta", image: "/images/pasta.jpg" },
  { label: "Pancakes", image: "/images/pancakes.jpg" },
  { label: "Salad", image: "/images/salad.jpg" },
];

export default function ProfileForm({ name, image }: { name: string; image: string | null }) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(name);
  const [avatar, setAvatar] = useState(image);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const choices = [
    ...(image && !avatars.some(choice => choice.image === image) ? [{ label: "Current photo", image }] : []),
    ...avatars, { label: "Initial", image: null },
  ];

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) {
      setMessage("Enter a display name.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await auth.updateUser({ name: trimmed, image: avatar });
        if (result.error) throw new Error();
        setDraftName(trimmed);
        setMessage("Profile saved.");
        router.refresh();
      } catch {
        setMessage("Couldn’t save your profile. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={save} onChange={() => setMessage("")} className="site-panel space-y-4">
      <h2 className="site-heading text-xl">Profile</h2>
      <fieldset disabled={pending} className="grid gap-4">
        <label className="grid gap-1">Display name
          <input className="site-field" autoComplete="name" required maxLength={120}
            value={draftName} onChange={event => setDraftName(event.target.value)} />
        </label>
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
        <button className="site-button justify-self-start" disabled={pending || (draftName === name && avatar === image)}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </fieldset>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}
