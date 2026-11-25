"use client";

import Image from "next/image";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/app/_components/material";
import { avatars, publicAvatarImage } from "@/lib/product/avatar";
import { saveAvatar } from "./avatar-actions";

export default function AvatarForm({ name, image: savedImage }: { name: string; image: string | null }) {
  const image = publicAvatarImage(savedImage);
  const fileInput = useRef<HTMLInputElement>(null);
  const [choice, setChoice] = useState(image ?? "initial");
  const [feedback, setFeedback] = useState({ message: "", error: false });
  const [pending, startTransition] = useTransition();
  const choices = [
    ...(image && !avatars.some(avatar => avatar.image === image) ? [{ label: "Current photo", image }] : []),
    ...avatars, { label: "Initial", image: null },
  ];

  function choosePreset(value: string) {
    if (fileInput.current) fileInput.current.value = "";
    setChoice(value);
    setFeedback({ message: "", error: false });
  }

  function chooseFile(file: File | undefined) {
    if (!file) return choosePreset(image ?? "initial");
    if (!file.size || file.size > 3 * 1024 * 1024) {
      choosePreset(image ?? "initial");
      setFeedback({ message: "Choose a photo up to 3 MiB.", error: true });
      return;
    }
    setChoice("upload");
    setFeedback({ message: "", error: false });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("avatar", choice);
    startTransition(async () => {
      try {
        const result = await saveAvatar(data);
        if ("error" in result) {
          setFeedback({ message: result.error, error: true });
          return;
        }
        choosePreset(result.image ?? "initial");
        setFeedback({ message: "Avatar saved.", error: false });
      } catch {
        setFeedback({ message: "Couldn’t save your avatar. Please try again.", error: true });
      }
    });
  }

  return (
    <form onSubmit={save} className="site-panel space-y-4">
      <fieldset disabled={pending} className="grid gap-4">
        <legend className="site-heading mb-3 text-xl">Avatar</legend>
        <div className="flex flex-wrap gap-3">
          {choices.map(avatar => (
            <label key={avatar.label} className="grid cursor-pointer justify-items-center gap-1 text-xs">
              <input type="radio" name="avatar" className="peer sr-only" value={avatar.image ?? "initial"}
                checked={choice === (avatar.image ?? "initial")} onChange={() => choosePreset(avatar.image ?? "initial")} />
              <span aria-hidden="true" className="grid size-12 place-items-center overflow-hidden rounded-full bg-paper text-xl font-bold ring-line peer-checked:ring-2 peer-checked:ring-brand peer-checked:ring-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4">
                {avatar.image ? <Image src={avatar.image} unoptimized width={48} height={48} alt="" className="size-full object-cover" />
                  : name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              {avatar.label}
            </label>
          ))}
        </div>
        <div className="grid gap-1">
          <label htmlFor="avatar-upload">Upload your own photo</label>
          <input id="avatar-upload" ref={fileInput} name="photo" type="file" accept="image/jpeg,image/png,image/webp"
            className="site-field" aria-describedby="avatar-upload-hint" onChange={event => chooseFile(event.target.files?.[0])} />
          <p id="avatar-upload-hint" className="text-sm text-subtle">Still JPEG, PNG or WebP, up to 3 MiB and 16 megapixels. Your avatar appears on your public recipe page.</p>
        </div>
        <Button type="submit" className="min-h-11 justify-self-start" disabled={pending || choice === (image ?? "initial")}>
          {pending ? "Saving…" : "Save avatar"}
        </Button>
      </fieldset>
      {feedback.message && <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "text-sm text-rust" : "text-sm"}>{feedback.message}</p>}
    </form>
  );
}
